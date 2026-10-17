import {
  type InsuranceTier,
  compareInsuranceTiers,
} from '../../data/insurance.ts';

import type { Pledge } from '../hangar/hangar.ts';
import type { StandaloneOffer, StoreOffers } from '../store/store-offers.ts';
import type { FundingMode } from './planner-state.ts';

export type PlanInput = {
  pledges: Pledge[];
  tradeIn: string[];
  want: { shipId: number; minInsurance: InsuranceTier | 'any' }[];
  offers: StoreOffers;
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
    };

export type Plan = {
  steps: PlanStep[];
  totals: { newMoney: number; creditUsed: number; creditLeft: number };
  unmet: { shipId: number; reason: string }[];
  warnings: string[];
};

type Want = PlanInput['want'][number];

const meetsInsurance = (offer: StandaloneOffer, want: Want) =>
  want.minInsurance === 'any' ||
  (offer.insurance !== null &&
    compareInsuranceTiers(offer.insurance, want.minInsurance) >= 0);

const meltTradeIns = (
  { pledges, tradeIn }: PlanInput,
  creditNeeded: number,
) => {
  const steps: PlanStep[] = [];
  const warnings: string[] = [];
  const selected = new Set(tradeIn);
  let credit = 0;
  let gamePackages = pledges.filter(
    (pledge) => pledge.containsGamePackage,
  ).length;

  // Larger melts fund the purchases with the fewest pledges.
  for (const pledge of pledges.toSorted((a, b) => b.meltValue - a.meltValue)) {
    if (!selected.has(pledge.id)) {
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

const unmetReason = (want: Want, { offers, funding }: PlanInput) => {
  const onSale = offers.standalone.filter(
    (offer) => offer.shipId === want.shipId && offer.available,
  );

  if (onSale.length === 0) {
    return 'Not on sale as a standalone ship.';
  }

  const insured = onSale.filter((offer) => meetsInsurance(offer, want));

  if (insured.length === 0) {
    return want.minInsurance === 'lti'
      ? 'No standalone offer with LTI.'
      : `No standalone offer with at least ${want.minInsurance} months of insurance.`;
  }

  if (funding === 'credit-only' && insured.every((offer) => offer.warbond)) {
    return want.minInsurance === 'lti'
      ? 'LTI needs new money: qualifying offers are warbond only.'
      : 'Qualifying offers are warbond only and need new money.';
  }

  return 'Not enough store credit.';
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

const purchasePlan = (
  input: PlanInput,
  selected: (StandaloneOffer | null)[],
): Plan => {
  const creditNeeded = selected.reduce(
    (sum, offer) => sum + (offer === null || offer.warbond ? 0 : offer.price),
    -input.credit,
  );
  const melts = meltTradeIns(input, creditNeeded);
  const steps = [...melts.steps];
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
    creditLeft -= credit;
    creditUsed += credit;
    newMoney += cash;
  }

  return {
    steps,
    totals: { newMoney, creditUsed, creditLeft },
    unmet,
    warnings: [
      ...melts.warnings,
      'Melting needs MFA.',
      'New pledges cannot be melted for 24 hours.',
      'Figures are in USD before tax. New money is taxed.',
      'Pledges paid with store credit cannot be gifted.',
      `Store offers fetched at ${input.offers.fetchedAt}.`,
      `Store credit fetched at ${input.creditFetchedAt}.`,
      'Offers can change or sell out. Re-plan before buying.',
    ],
  };
};

const comparePlans = (left: Plan, right: Plan, funding: FundingMode) => {
  const cost = (plan: Plan) =>
    plan.totals.newMoney +
    (funding === 'least-new-money' ? 0 : plan.totals.creditUsed);

  return (
    left.unmet.length - right.unmet.length ||
    cost(left) - cost(right) ||
    left.steps.length - right.steps.length
  );
};

export const createPlan = (input: PlanInput): Plan => {
  const choices = input.want.map((want) => {
    const routes = input.offers.standalone.filter(
      (offer) =>
        offer.shipId === want.shipId &&
        offer.available &&
        meetsInsurance(offer, want) &&
        (input.funding !== 'credit-only' || !offer.warbond),
    );

    return input.funding === 'credit-only' || routes.length === 0
      ? [...routes, null]
      : routes;
  });
  let best: Plan | null = null;

  // ponytail: exhaustive search grows with offers per want; replace it if fleets or upgrade routes make planning slow.
  const search = (selected: (StandaloneOffer | null)[]) => {
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
      search([...selected, route]);
    }
  };

  search([]);

  return best!;
};
