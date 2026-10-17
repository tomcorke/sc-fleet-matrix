import { z } from 'zod';

import {
  type InsuranceTier,
  compareInsuranceTiers,
  parseInsuranceTier,
} from '../../data/insurance.ts';

export type StandaloneOffer = {
  skuId: string;
  shipId: number;
  price: number; // USD cents, before tax.
  warbond: boolean;
  insurance: InsuranceTier | null;
  available: boolean;
};

export type StoreOffers = {
  standalone: StandaloneOffer[];
  fetchedAt: string;
};

const PageSchema = z.tuple([
  z.object({
    data: z.object({
      store: z.object({
        search: z.object({
          totalCount: z.number().int().nonnegative(),
          resources: z.array(
            z.object({
              id: z.string().min(1),
              isWarbond: z.boolean(),
              isPackage: z.boolean(),
              nativePrice: z.object({ amount: z.number().int().nonnegative() }),
              stock: z.object({ available: z.boolean() }),
              ships: z.array(
                z.object({ id: z.coerce.number().int().positive() }),
              ),
              gameItems: z.array(
                z.object({ name: z.string(), kind: z.string().nullable() }),
              ),
            }),
          ),
        }),
      }),
    }),
    errors: z.never().optional(),
  }),
]);

const insuranceFor = (items: { name: string; kind: string | null }[]) => {
  let insurance: InsuranceTier | null = null;

  for (const item of items) {
    const tier =
      item.kind === 'INSURANCE' ? parseInsuranceTier(item.name) : null;

    if (
      tier !== null &&
      (insurance === null || compareInsuranceTiers(tier, insurance) > 0)
    ) {
      insurance = tier;
    }
  }

  return insurance;
};

export const parseStandaloneOffers = (pages: unknown[]): StandaloneOffer[] => {
  const offers = new Map<string, StandaloneOffer>();

  for (const page of pages) {
    const resources = PageSchema.parse(page)[0].data.store.search.resources;

    for (const sku of resources) {
      if (sku.isPackage || sku.ships.length !== 1) {
        continue;
      }

      offers.set(sku.id, {
        skuId: sku.id,
        shipId: sku.ships[0].id,
        price: sku.nativePrice.amount,
        warbond: sku.isWarbond,
        insurance: insuranceFor(sku.gameItems),
        available: sku.stock.available,
      });
    }
  }

  return [...offers.values()].sort(
    (a, b) => Number(a.warbond) - Number(b.warbond),
  );
};

export const hasAvailableWarbond = (
  offers: StandaloneOffer[],
  shipId: number,
) =>
  offers.some(
    (offer) => offer.shipId === shipId && offer.warbond && offer.available,
  );
