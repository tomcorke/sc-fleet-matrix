import { z } from 'zod';

const STORE_GRAPHQL_URL = 'https://robertsspaceindustries.com/graphql';

// RSI's store GraphQL works without signing in. `msrp` is the standard
// edition price in US cents; it's null for ships the store doesn't sell alone.
const QUERY = `query ($query: SearchQuery!) {
  store(name: "pledge", browse: true) {
    search(query: $query) {
      totalCount
      resources {
        id
        ... on RSIShip { msrp }
      }
    }
  }
}`;

const ResponseSchema = z.tuple([
  z.object({
    data: z.object({
      store: z.object({
        search: z.object({
          totalCount: z.number(),
          resources: z.array(
            z.object({ id: z.coerce.number(), msrp: z.number().nullable() }),
          ),
        }),
      }),
    }),
  }),
]);

const fetchPage = async (page: number) => {
  const response = await fetch(STORE_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      {
        query: QUERY,
        variables: {
          query: {
            page,
            limit: 30,
            // Without a fixed order, pages overlap and some ships are skipped.
            sort: { field: 'name', direction: 'asc' },
            ships: { all: true },
          },
        },
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(`Store GraphQL page ${page} failed: ${response.status}`);
  }

  return ResponseSchema.parse(await response.json())[0].data.store.search;
};

// Maps each ship-matrix ship ID to its MSRP in US dollars, or null.
export const fetchShipMsrps = async () => {
  const msrps = new Map<number, number | null>();

  for (let page = 1; ; page++) {
    const { totalCount, resources } = await fetchPage(page);

    for (const { id, msrp } of resources) {
      msrps.set(id, msrp === null ? null : msrp / 100);
    }

    if (resources.length === 0 || msrps.size >= totalCount) {
      return msrps;
    }
  }
};
