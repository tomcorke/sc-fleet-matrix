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

const REQUEST_HANDLERS = new Map([['hangar', fetchHangar]]);

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
