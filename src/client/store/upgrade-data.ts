import { z } from 'zod';

export type UpgradeSku = {
  skuId: string;
  price: number; // USD cents for the target, before tax, not the upgrade difference.
  warbond: boolean;
  available: boolean;
};

export type UpgradeData = {
  sources: { shipId: number; msrp: number }[];
  targets: { shipId: number; msrp: number; skus: UpgradeSku[] }[];
  fetchedAt: string;
};

const ShipSchema = z.object({
  id: z.number().int().positive(),
  msrp: z.number().int().nonnegative(),
});
const ResponseSchema = z.tuple([
  z.object({
    data: z.object({
      from: z.object({ ships: z.array(ShipSchema) }),
      to: z.object({
        ships: z.array(
          ShipSchema.extend({
            skus: z.array(
              z.object({
                id: z.number().int().positive(),
                title: z.string(),
                price: z.number().int().nonnegative(),
                available: z.boolean(),
              }),
            ),
          }),
        ),
      }),
    }),
    errors: z.never().optional(),
  }),
]);

export const parseUpgradeData = (
  response: unknown,
  fetchedAt: string,
): UpgradeData => {
  const { from, to } = ResponseSchema.parse(response)[0].data;

  return {
    sources: from.ships.map((ship) => ({ shipId: ship.id, msrp: ship.msrp })),
    targets: to.ships.map((ship) => ({
      shipId: ship.id,
      msrp: ship.msrp,
      skus: ship.skus.map((sku) => ({
        skuId: String(sku.id),
        price: sku.price,
        warbond: /warbond/i.test(sku.title),
        available: sku.available,
      })),
    })),
    fetchedAt: z.iso.datetime().parse(fetchedAt),
  };
};
