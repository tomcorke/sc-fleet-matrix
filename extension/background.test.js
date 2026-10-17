import assert from 'node:assert/strict';
import { test } from 'node:test';

const loadHandler = async () => {
  const originalChrome = globalThis.chrome;
  let onMessage;

  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: (listener) => {
          onMessage = listener;
        },
      },
    },
  };

  try {
    await import('./background.js');

    return onMessage;
  } finally {
    if (originalChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = originalChrome;
    }
  }
};

const onMessage = await loadHandler();
const request = (kind) =>
  new Promise((resolve) => onMessage(kind, {}, resolve));
const page = (totalCount, resources) =>
  Response.json([{ data: { store: { search: { totalCount, resources } } } }]);

test('returns an error for unknown kinds and page-provided request bodies', async () => {
  assert.deepEqual(await request('unknown'), {
    error: 'Unknown request kind.',
  });
  assert.deepEqual(
    await request({ kind: 'store-offers', url: 'https://example.com' }),
    {
      error: 'Unknown request kind.',
    },
  );
});

test('pages through standalone ship browse with a fixed query and fetch time', async (t) => {
  const responses = [
    page(3, [{ id: '1' }, { id: '2' }]),
    page(3, [{ id: '3' }]),
  ];
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    responses.shift(),
  );
  const result = await request('store-offers');

  assert.equal(result.pages.length, 2);
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
  assert.equal(fetchMock.mock.callCount(), 2);

  for (const [index, call] of fetchMock.mock.calls.entries()) {
    const [url, options] = call.arguments;
    const body = JSON.parse(options.body)[0];

    assert.equal(url, 'https://robertsspaceindustries.com/graphql');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'include');
    assert.deepEqual(body.variables.query, {
      page: index + 1,
      limit: 20,
      sort: { field: 'name', direction: 'asc' },
      skus: { products: [72] },
    });
  }
});

test('reports HTTP and GraphQL failures, not a partial offers list', async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 503 }),
  );

  assert.match((await request('store-offers')).error, /503/);
  fetchMock.mock.mockImplementation(async () =>
    Response.json([{ errors: [{ message: 'Failed' }] }]),
  );
  assert.match(
    (await request('store-offers')).error,
    /invalid offers response/,
  );
  fetchMock.mock.mockImplementation(async () => page(2, []));
  assert.match((await request('store-offers')).error, /incomplete offers list/);
});

test('accepts an empty store and still stamps the fetch time', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => page(0, []));

  const result = await request('store-offers');

  assert.equal(result.pages.length, 1);
  assert.ok(result.fetchedAt);
});

const credit = (isAnonymous, amount) =>
  Response.json([
    {
      data: {
        account: { isAnonymous },
        store: { cart: { totals: { credits: { amount } } } },
      },
    },
  ]);

test('reads the store credit balance and rejects signed-out sessions', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    credit(false, 12_345),
  );
  const result = await request('credit');

  assert.equal(result.amount, 12_345);
  assert.ok(result.fetchedAt);
  assert.equal(
    JSON.parse(fetchMock.mock.calls[0].arguments[1].body)[0].operationName,
    'Credit',
  );
  fetchMock.mock.mockImplementation(async () => credit(true, 0));
  assert.match((await request('credit')).error, /Sign in/);
  fetchMock.mock.mockImplementation(async () => credit(false, 'x'));
  assert.match((await request('credit')).error, /invalid credit/);
});
