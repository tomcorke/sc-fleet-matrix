const PLEDGES_URL = 'https://robertsspaceindustries.com/en/account/pledges';

const fetchPage = async (page) => {
  const response = await fetch(`${PLEDGES_URL}?page=${page}`, {
    credentials: 'include',
  });

  return response.text();
};

// Returns every page of the hangar as HTML. Pages past the last one repeat the
// last page, so the page count comes from the pager links on page 1.
const fetchHangar = async () => {
  const first = await fetchPage(1);

  if (!first.includes('js-pledge-id')) {
    return { error: 'Sign in to robertsspaceindustries.com, then try again.' };
  }

  const lastPage = Math.max(
    1,
    ...[...first.matchAll(/pledges\?page=(\d+)/g)].map(([, n]) => Number(n)),
  );
  const rest = [];

  for (let page = 2; page <= lastPage; page++) {
    rest.push(await fetchPage(page));
  }

  return { pages: [first, ...rest] };
};

const STORE_QUERY = `query ($query: SearchQuery!) {
  store(name: "pledge", browse: true) {
    search(query: $query) {
      totalCount
      resources {
        id
        ... on TySku {
          isWarbond
          isPackage
          nativePrice { amount }
          stock { available }
          ships { id }
          gameItems { name kind }
        }
      }
    }
  }
}`;

const fetchStoreOffers = async () => {
  const pages = [];
  let count = 0;

  for (let page = 1; ; page++) {
    const response = await fetch('https://robertsspaceindustries.com/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          query: STORE_QUERY,
          variables: {
            query: {
              page,
              limit: 20,
              // A fixed order keeps results from overlapping across pages.
              sort: { field: 'name', direction: 'asc' },
              skus: { products: [72] },
            },
          },
        },
      ]),
    });

    if (!response.ok) {
      throw new Error(`Store offers page ${page} failed: ${response.status}`);
    }

    const result = await response.json();
    const search = result?.[0]?.data?.store?.search;

    if (
      result?.[0]?.errors?.length ||
      !Array.isArray(search?.resources) ||
      !Number.isSafeInteger(search.totalCount) ||
      search.totalCount < 0
    ) {
      throw new Error('The RSI store returned an invalid offers response.');
    }

    pages.push(result);
    count += search.resources.length;

    if (count >= search.totalCount) {
      return { pages, fetchedAt: new Date().toISOString() };
    }

    if (search.resources.length === 0) {
      throw new Error('The RSI store returned an incomplete offers list.');
    }
  }
};

const REQUEST_HANDLERS = new Map([
  ['hangar', fetchHangar],
  ['store-offers', fetchStoreOffers],
]);

chrome.runtime.onMessage.addListener((kind, _sender, sendResponse) => {
  const request = REQUEST_HANDLERS.get(kind);

  if (!request) {
    sendResponse({ error: 'Unknown request kind.' });

    return;
  }

  request()
    .then(sendResponse)
    .catch((error) => sendResponse({ error: String(error) }));

  return true;
});
