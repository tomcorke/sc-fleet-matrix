import {
  type InsuranceTier,
  compareInsuranceTiers,
} from '../../data/insurance.ts';

import type { Pledge } from '../hangar/hangar.ts';
import type { StandaloneOffer, StoreOffers } from '../store/store-offers.ts';
import type { UpgradeData } from '../store/upgrade-data.ts';
import type { FundingMode } from './planner-state.ts';

export type PlanInput = {
  pledges: Pledge[];
  tradeIn: string[];
  want: { shipId: number; minInsurance: InsuranceTier | 'any' }[];
  offers: StoreOffers;
  upgrades: UpgradeData;
  credit: number;
  creditFetchedAt: string;
  funding: FundingMode;
};

export type PlanStep =
  | { kind: 'melt'; pledgeId: string; credit: number }
  | {
      kind: 'buy-standalone';
      skuId: string;
      shipId: number;
      credit: number;
      newMoney: number;
      note?: string;
    }
  | {
      kind: 'buy-upgrade';
      pledgeId: string;
      skuId: string;
      fromShipId: number;
      toShipId: number;
      warbond: boolean;
      credit: number;
      newMoney: number;
    }
  | {
      kind: 'apply-upgrade';
      pledgeId: string;
      fromShipId: number;
      toShipId: number;
      warbond: boolean;
    };

export type Plan = {
  steps: PlanStep[];
  totals: { newMoney: number; creditUsed: number; creditLeft: number };
  unmet: { shipId: number; reason: string }[];
  warnings: string[];
};

type Want = PlanInput['want'][number];

type Route =
  | (StandaloneOffer & { kind: 'standalone' })
  | {
      kind: 'upgrade';
      pledgeId: string;
      fromShipId: number;
      toShipId: number;
      skuId: string;
      price: number;
      warbond: boolean;
    };

const meetsInsurance = (
  offer: Pick<StandaloneOffer, 'insurance'>,
  want: Want,
) =>
  want.minInsurance === 'any' ||
  (offer.insurance !== null &&
    compareInsuranceTiers(offer.insurance, want.minInsurance) >= 0);

const routesForWant = (input: PlanInput, want: Want): Route[] => {
  const standalone: Route[] = input.offers.standalone
    .filter(
      (offer) =>
        offer.shipId === want.shipId &&
        offer.available &&
        meetsInsurance(offer, want),
    )
    .map((offer) => ({ ...offer, kind: 'standalone' }));
  const target = input.upgrades.targets.find(
    (ship) => ship.shipId === want.shipId,
  );

  if (!target) {
    return standalone;
  }

  const upgrades: Route[] = input.pledges.flatMap((pledge) => {
    if (
      !input.tradeIn.includes(pledge.id) ||
      pledge.ships.length !== 1 ||
      !meetsInsurance(pledge, want)
    ) {
      return [];
    }

    const source = input.upgrades.sources.find(
      (ship) => ship.shipId === pledge.ships[0].shipId,
    );

    if (
      !source ||
      source.shipId === target.shipId ||
      source.msrp >= target.msrp
    ) {
      return [];
    }

    return target.skus
      .filter(
        (sku) =>
          sku.available &&
          (sku.warbond ? sku.price : target.msrp) > source.msrp,
      )
      .map((sku) => ({
        kind: 'upgrade',
        pledgeId: pledge.id,
        fromShipId: source.shipId,
        toShipId: target.shipId,
        skuId: sku.skuId,
        price: (sku.warbond ? sku.price : target.msrp) - source.msrp,
        warbond: sku.warbond,
      }));
  });

  return [...standalone, ...upgrades];
};

const meltTradeIns = (
  { pledges, tradeIn }: PlanInput,
  creditNeeded: number,
  upgraded: Set<string>,
) => {
  const steps: Extract<PlanStep, { kind: 'melt' }>[] = [];
  const warnings: string[] = [];
  const selected = new Set(tradeIn);
  let credit = 0;
  let gamePackages = pledges.filter(
    (pledge) => pledge.containsGamePackage,
  ).length;

  // Larger melts fund the purchases with the fewest pledges.
  for (const pledge of pledges.toSorted((a, b) => b.meltValue - a.meltValue)) {
    if (!selected.has(pledge.id) || upgraded.has(pledge.id)) {
      continue;
    }

    if (pledge.containsGamePackage && gamePackages === 1) {
      warnings.push(
        `Keep ${pledge.name}: melting it would remove your only game package.`,
      );
    } else if (!pledge.canMelt) {
      warnings.push(
        `Cannot melt ${pledge.name}: this pledge cannot be reclaimed.`,
      );
    } else if (credit < creditNeeded && pledge.meltValue > 0) {
      steps.push({
        kind: 'melt',
        pledgeId: pledge.id,
        credit: pledge.meltValue,
      });
      credit += pledge.meltValue;
      gamePackages -= Number(pledge.containsGamePackage);
    }
  }

  return { steps, warnings };
};

const unmetReason = (want: Want, input: PlanInput) => {
  const onSale =
    input.offers.standalone.some(
      (offer) => offer.shipId === want.shipId && offer.available,
    ) ||
    input.upgrades.targets.some(
      (target) =>
        target.shipId === want.shipId &&
        target.skus.some((sku) => sku.available),
    );

  if (!onSale) {
    return 'Not on sale as a standalone ship or upgrade target.';
  }

  const routes = routesForWant(input, want);

  if (routes.length === 0) {
    if (want.minInsurance === 'any') {
      return 'No eligible trade-in pledge for a direct upgrade.';
    }

    return want.minInsurance === 'lti'
      ? 'No standalone offer with LTI or eligible trade-in pledge with LTI.'
      : `No standalone offer or eligible trade-in pledge with at least ${want.minInsurance} months of insurance.`;
  }

  if (
    input.funding === 'credit-only' &&
    routes.every((route) => route.warbond)
  ) {
    return want.minInsurance === 'lti'
      ? 'LTI needs new money: qualifying offers and upgrades are warbond only.'
      : 'Qualifying offers and upgrades are warbond only and need new money.';
  }

  return routes.some((route) => route.kind === 'standalone')
    ? 'Not enough store credit.'
    : 'Not enough store credit or no unused qualifying trade-in pledge.';
};

const warbondNote = (
  offer: StandaloneOffer,
  want: Want,
  offers: StandaloneOffer[],
) => {
  const standard = offers
    .filter(
      (alternative) =>
        alternative.shipId === offer.shipId &&
        alternative.available &&
        !alternative.warbond,
    )
    .sort(
      (a, b) =>
        Number(meetsInsurance(b, want)) - Number(meetsInsurance(a, want)) ||
        a.price - b.price,
    )[0];

  if (!standard) {
    return undefined;
  }

  const usd = (cents: number) =>
    (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

  return (
    `Chose the ${usd(offer.price)} warbond over the ${usd(standard.price)} standard edition, which accepts store credit.` +
    (meetsInsurance(standard, want)
      ? ''
      : ' The standard edition does not meet your insurance minimum.')
  );
};

const purchasePlan = (input: PlanInput, selected: (Route | null)[]): Plan => {
  const creditNeeded = selected.reduce(
    (sum, offer) => sum + (offer === null || offer.warbond ? 0 : offer.price),
    -input.credit,
  );
  const upgraded = new Set(
    selected.flatMap((route) =>
      route?.kind === 'upgrade' ? [route.pledgeId] : [],
    ),
  );
  const melts = meltTradeIns(input, creditNeeded, upgraded);
  const steps: PlanStep[] = [...melts.steps];
  const applies: PlanStep[] = [];
  const unmet: Plan['unmet'] = [];
  let creditLeft =
    input.credit + melts.steps.reduce((sum, step) => sum + step.credit, 0);
  let creditUsed = 0;
  let newMoney = 0;

  for (const [index, offer] of selected.entries()) {
    if (offer === null) {
      const want = input.want[index];

      unmet.push({ shipId: want.shipId, reason: unmetReason(want, input) });
      continue;
    }

    const credit = offer.warbond ? 0 : Math.min(creditLeft, offer.price);
    const cash = offer.price - credit;

    if (offer.kind === 'standalone') {
      const note = offer.warbond
        ? warbondNote(offer, input.want[index], input.offers.standalone)
        : undefined;

      steps.push({
        kind: 'buy-standalone',
        skuId: offer.skuId,
        shipId: offer.shipId,
        credit,
        newMoney: cash,
        ...(note ? { note } : {}),
      });
    } else {
      const upgrade = {
        pledgeId: offer.pledgeId,
        fromShipId: offer.fromShipId,
        toShipId: offer.toShipId,
        warbond: offer.warbond,
      };

      steps.push({
        kind: 'buy-upgrade',
        ...upgrade,
        skuId: offer.skuId,
        credit,
        newMoney: cash,
      });
      applies.push({ kind: 'apply-upgrade', ...upgrade });
    }

    creditLeft -= credit;
    creditUsed += credit;
    newMoney += cash;
  }

  return {
    steps: [...steps, ...applies],
    totals: { newMoney, creditUsed, creditLeft },
    unmet,
    warnings: [
      ...melts.warnings,
      'Melting needs MFA.',
      'New pledges cannot be melted for 24 hours.',
      'Figures are in USD before tax. New money is taxed.',
      'Pledges paid with store credit cannot be gifted.',
      `Store offers fetched at ${input.offers.fetchedAt}.`,
      `Upgrade data fetched at ${input.upgrades.fetchedAt}.`,
      `Store credit fetched at ${input.creditFetchedAt}.`,
      'Offers can change or sell out. Re-plan before buying.',
    ],
  };
};

const comparePlans = (left: Plan, right: Plan, funding: FundingMode) => {
  const totalCost = (plan: Plan) =>
    plan.totals.newMoney + plan.totals.creditUsed;
  const cost = (plan: Plan) =>
    funding === 'least-new-money' ? plan.totals.newMoney : totalCost(plan);

  return (
    left.unmet.length - right.unmet.length ||
    cost(left) - cost(right) ||
    totalCost(left) - totalCost(right) ||
    left.steps.length - right.steps.length
  );
};

export const createPlan = (input: PlanInput): Plan => {
  const choices = input.want.map((want) => {
    const routes = routesForWant(input, want).filter(
      (route) => input.funding !== 'credit-only' || !route.warbond,
    );

    return input.funding === 'credit-only' ||
      routes.every((route) => route.kind === 'upgrade')
      ? [...routes, null]
      : routes;
  });
  let best: Plan | null = null;

  // shortcut: route assignments grow exponentially, prune the search if larger fleets make planning slow.
  const search = (selected: (Route | null)[]) => {
    if (selected.length === choices.length) {
      const candidate = purchasePlan(input, selected);

      if (input.funding === 'credit-only' && candidate.totals.newMoney > 0) {
        return;
      }

      if (best === null || comparePlans(candidate, best, input.funding) < 0) {
        best = candidate;
      }

      return;
    }

    for (const route of choices[selected.length]) {
      if (
        route?.kind === 'upgrade' &&
        selected.some(
          (used) =>
            used?.kind === 'upgrade' && used.pledgeId === route.pledgeId,
        )
      ) {
        continue;
      }

      search([...selected, route]);
    }
  };

  search([]);

  return best!;
};
