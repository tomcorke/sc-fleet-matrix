import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fetchStorePages, msrpsFromPages } from './store-prices.ts';

const page = (totalCount: number, resources: unknown[]) =>
  Response.json([{ data: { store: { search: { totalCount, resources } } } }]);

test('pages through every ship and converts cents to dollars', async (t) => {
  const pages = [
    page(3, [
      { id: '1', msrp: 2000 },
      { id: '37', msrp: null },
    ]),
    page(3, [{ id: '317', msrp: 590000 }]),
  ];
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    pages.shift(),
  );

  assert.deepEqual(
    msrpsFromPages(await fetchStorePages()),
    new Map([
      [1, 20],
      [37, null],
      [317, 5900],
    ]),
  );
  assert.equal(fetchMock.mock.callCount(), 2);
});
