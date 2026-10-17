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

test('rejects account action kinds without making a network request', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Account actions must never reach the network.');
  });

  for (const kind of [
    'melt',
    'buy-standalone',
    'buy-upgrade',
    'apply-upgrade',
    'purchase',
    'addToCart',
    'reclaimPledge',
  ]) {
    assert.deepEqual(await request(kind), { error: 'Unknown request kind.' });
  }

  assert.equal(fetchMock.mock.callCount(), 0);
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

test('fetches upgrades only after both fixed token requests and stamps the result', async (t) => {
  const data = [{ data: { from: { ships: [] }, to: { ships: [] } } }];
  const responses = [
    Response.json({ success: 1 }),
    Response.json({ success: 1 }),
    Response.json(data),
  ];
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    responses.shift(),
  );
  const result = await request('upgrade-data');
  const calls = fetchMock.mock.calls.map((call) => call.arguments);

  assert.deepEqual(result.response, data);
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
  assert.deepEqual(
    calls.map(([url]) => url),
    [
      'https://robertsspaceindustries.com/api/account/v2/setAuthToken',
      'https://robertsspaceindustries.com/api/ship-upgrades/setContextToken',
      'https://robertsspaceindustries.com/pledge-store/api/upgrade/v2/graphql',
    ],
  );
  assert.equal(calls[0][1].body, 'null');
  assert.equal(calls[1][1].body, '{}');
  const body = JSON.parse(calls[2][1].body);

  assert.equal(body[0].operationName, 'filterShips');
  assert.match(body[0].query, /from \{ ships \{ id msrp \} \}/);
  assert.match(body[0].query, /skus \{ id title price available \}/);

  for (const [, options] of calls) {
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'include');
  }
});

test('stops on failed upgrade handshakes and rejects HTTP or GraphQL failures', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ success: 0 }),
  );

  assert.match((await request('upgrade-data')).error, /handshake failed/);
  assert.equal(fetchMock.mock.callCount(), 1);

  for (const failure of [
    new Response('', { status: 503 }),
    Response.json([{ errors: [{ message: 'Failed' }] }]),
    Response.json([{ data: {} }]),
  ]) {
    const responses = [
      Response.json({ success: 1 }),
      Response.json({ success: 1 }),
      failure,
    ];

    fetchMock.mock.mockImplementation(async () => responses.shift());
    assert.match(
      (await request('upgrade-data')).error,
      /503|invalid upgrade response/,
    );
  }
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
