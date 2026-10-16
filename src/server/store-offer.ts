import * as cheerio from 'cheerio';
import { z } from 'zod';

const OfferSchema = z.union([
  z.object({ price: z.string(), priceCurrency: z.string() }),
  // Ships sold both standalone and as an upgrade list each as a sub-offer.
  z
    .object({ lowPrice: z.string(), priceCurrency: z.string() })
    .transform(({ lowPrice, priceCurrency }) => ({
      price: lowPrice,
      priceCurrency,
    })),
]);

const ProductSchema = z.object({
  '@type': z.literal('Product'),
  offers: OfferSchema,
});

// RSI store pages describe the ship in schema.org JSON-LD. Prices of related
// packages sit under `isRelatedTo`, so only the top-level offer is the ship's.
export const parseStoreOffer = (pageContent: string) => {
  const page = cheerio.load(pageContent);

  for (const script of page('script[type="application/ld+json"]')) {
    const result = ProductSchema.safeParse(JSON.parse(page(script).text()));

    if (result.success) {
      return result.data.offers;
    }
  }

  return null;
};
