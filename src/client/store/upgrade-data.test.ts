import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parseUpgradeData } from './upgrade-data.ts';

const fixture = () =>
  JSON.parse(
    readFileSync(
      new URL('./fixtures/filter-ships.json', import.meta.url),
      'utf8',
    ),
  );
const fetchedAt = '2026-10-17T12:34:56Z';

test('parses recorded filterShips sources and both standard and warbond target SKUs', () => {
  const data = parseUpgradeData(fixture(), fetchedAt);

  assert.deepEqual(data.sources, [
    { shipId: 165, msrp: 17500 },
    { shipId: 312, msrp: 4500 },
    { shipId: 328, msrp: 18500 },
  ]);
  assert.equal(data.targets.length, 3);
  assert.deepEqual(
    data.targets.find((ship) => ship.shipId === 328),
    {
      shipId: 328,
      msrp: 18500,
      skus: [
        { skuId: '19626', price: 16500, warbond: true, available: true },
        { skuId: '19627', price: 18500, warbond: false, available: true },
      ],
    },
  );
  assert.equal(data.fetchedAt, fetchedAt);
});

test('preserves sold-out upgrade SKUs without making them available', () => {
  const response = fixture();

  response[0].data.to.ships[0].skus[0].available = false;
  assert.equal(
    parseUpgradeData(response, fetchedAt).targets[0].skus[0].available,
    false,
  );
});

test('rejects malformed prices, ship IDs, timestamps and GraphQL errors', () => {
  const response = fixture();

  response[0].data.to.ships[0].skus[0].price = -1;
  assert.throws(() => parseUpgradeData(response, fetchedAt));
  response[0].data.to.ships[0].skus[0].price = 1.5;
  assert.throws(() => parseUpgradeData(response, fetchedAt));
  assert.throws(() =>
    parseUpgradeData([{ errors: [{ message: 'Failed' }] }], fetchedAt),
  );
  assert.throws(() => parseUpgradeData(fixture(), 'not a timestamp'));
  const badSource = fixture();

  badSource[0].data.from.ships[0].id = 0;
  assert.throws(() => parseUpgradeData(badSource, fetchedAt));
});
