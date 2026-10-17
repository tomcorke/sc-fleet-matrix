import { z } from 'zod';

import {
  compareInsuranceTiers,
  parseInsuranceTier,
} from '../../data/insurance.ts';

// The hangar comes from the browser extension in `extension/`, which reads the
// RSI pledges pages with the user's sign-in. Only RSI can make those requests.
const TIMEOUT_MS = 60_000;
const STORAGE_KEY = 'hangar-pledges';
const INSURANCE_TIER = z.union([z.literal('lti'), z.number().int().positive()]);
const PLEDGES = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    meltValue: z.number().int().nonnegative(),
    ships: z.array(
      z.object({
        name: z.string().min(1),
        shipId: z.number().int().positive().nullable(),
      }),
    ),
    insuranceItems: z.array(
      z.object({ name: z.string().min(1), tier: INSURANCE_TIER.nullable() }),
    ),
    insurance: INSURANCE_TIER.nullable(),
    canMelt: z.boolean(),
    canGift: z.boolean(),
    hasAppliedUpgrades: z.boolean(),
    containsGamePackage: z.boolean(),
  }),
);
const HANGAR_RESULT = z.object({
  type: z.literal('sc-fleet:response'),
  kind: z.literal('hangar'),
  pages: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export type Pledge = z.infer<typeof PLEDGES>[number];
type MatrixShip = { id: number; name: string };

// Hangar names match ship-matrix names, give or take case and spacing.
const nameKey = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

const parseMeltValue = (value: string) => {
  const match = /^\$(\d+|\d{1,3}(?:,\d{3})+)\.(\d{2})\s+USD$/.exec(value);

  if (!match) {
    throw new Error('Cannot read a pledge melt value in USD.');
  }

  return Number(match[1].replaceAll(',', '')) * 100 + Number(match[2]);
};

export const parsePledges = (
  pages: string[],
  ships: MatrixShip[],
): Pledge[] => {
  const shipIds = new Map(ships.map((ship) => [nameKey(ship.name), ship.id]));
  const pledges = pages.flatMap((html) => {
    const document = new DOMParser().parseFromString(html, 'text/html');

    return [...document.querySelectorAll('.list-items > li')].map((pledge) => {
      const input = (className: string) =>
        pledge.querySelector(`.${className}`)?.getAttribute('value')?.trim() ??
        '';
      const items = [...pledge.querySelectorAll('.item')].map((item) => ({
        name: item.querySelector('.title')?.textContent?.trim() ?? '',
        kind: item.querySelector('.kind')?.textContent?.trim() ?? '',
      }));
      const insuranceItems = items
        .filter((item) => item.kind === 'Insurance')
        .map(({ name }) => ({ name, tier: parseInsuranceTier(name) }));
      const tiers = insuranceItems
        .map((item) => item.tier)
        .filter((tier) => tier !== null)
        .sort(compareInsuranceTiers);

      return {
        id: input('js-pledge-id'),
        name: input('js-pledge-name'),
        meltValue: parseMeltValue(input('js-pledge-value')),
        ships: items
          .filter((item) => item.kind === 'Ship')
          .map(({ name }) => ({
            name,
            shipId: shipIds.get(nameKey(name)) ?? null,
          })),
        insuranceItems,
        insurance: tiers.at(-1) ?? null,
        canMelt: pledge.querySelector('.js-reclaim') !== null,
        canGift: pledge.querySelector('.js-gift') !== null,
        hasAppliedUpgrades: pledge.querySelector('.js-upgrade-log') !== null,
        containsGamePackage: items.some(
          (item) => item.name === 'Star Citizen Digital Download',
        ),
      };
    });
  });

  return PLEDGES.parse(pledges);
};

// Each owned copy inherits the best insurance of the pledge that holds it.
export const insuranceForShip = (pledges: Pledge[], shipId: number) =>
  pledges
    .flatMap((pledge) =>
      pledge.ships
        .filter((ship) => ship.shipId === shipId)
        .map(() => {
          if (pledge.insurance === null) {
            return 'Unknown';
          }

          return pledge.insurance === 'lti' ? 'LTI' : `${pledge.insurance} mo`;
        }),
    )
    .join(', ');

const fetchHangarPages = () =>
  new Promise<string[]>((resolve, reject) => {
    if (document.documentElement.dataset.scFleetHangar === undefined) {
      reject(new Error('Install the hangar extension from extension/ first.'));

      return;
    }

    const finish = (settle: () => void) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      settle();
    };

    const onMessage = ({ source, data }: MessageEvent) => {
      const result = HANGAR_RESULT.safeParse(data);

      if (source !== window || !result.success) {
        return;
      }

      finish(() =>
        result.data.pages
          ? resolve(result.data.pages)
          : reject(new Error(result.data.error ?? 'Invalid hangar response.')),
      );
    };

    const timer = setTimeout(
      () =>
        finish(() => reject(new Error('The hangar extension did not reply.'))),
      TIMEOUT_MS,
    );

    window.addEventListener('message', onMessage);
    window.postMessage(
      { type: 'sc-fleet:request', kind: 'hangar' },
      window.location.origin,
    );
  });

export const fetchPledges = async (ships: MatrixShip[]) =>
  parsePledges(await fetchHangarPages(), ships);

export const loadSavedPledges = (): Pledge[] | null => {
  try {
    localStorage.removeItem('owned-ships');

    return PLEDGES.parse(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'),
    );
  } catch {
    return null;
  }
};

export const savePledges = (pledges: Pledge[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pledges));
  } catch {
    // Not saved; the hangar loads again next visit.
  }
};
