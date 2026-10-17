import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { hasAvailableWarbond, parseStandaloneOffers } from './store-offers.ts';

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'),
  );

test('parses a recorded page, preserving both editions, USD cents and insurance', () => {
  const offers = parseStandaloneOffers([fixture('standalone-page')]);

  assert.equal(offers.length, 20);
  assert.deepEqual(
    offers.filter((offer) => offer.shipId === 328),
    [
      {
        skuId: '19623',
        shipId: 328,
        price: 18500,
        warbond: false,
        insurance: 6,
        available: true,
      },
      {
        skuId: '19624',
        shipId: 328,
        price: 16500,
        warbond: true,
        insurance: 'lti',
        available: true,
      },
    ],
  );
  assert.equal(hasAvailableWarbond(offers, 328), true);
  assert.equal(hasAvailableWarbond(offers, 65), false);
});

test('keeps unavailable SKUs but excludes them from the warbond-on-sale filter', () => {
  const offers = parseStandaloneOffers([fixture('unavailable')]);

  assert.equal(offers.length, 1);
  assert.equal(offers[0].available, false);
  assert.equal(hasAvailableWarbond(offers, 328), false);
});

test('deduplicates pages by SKU, not ship', () => {
  const page = fixture('standalone-page');

  assert.equal(parseStandaloneOffers([page, page]).length, 20);
});

test('uses only insurance items and takes the highest recognized tier', () => {
  const page = fixture('unavailable');
  const sku = page[0].data.store.search.resources[0];

  sku.gameItems = [
    { kind: 'SHIP', name: 'Lifetime Insurance' },
    { kind: 'INSURANCE', name: '6 Month Insurance' },
    { kind: 'INSURANCE', name: '120 Months Insurance' },
    { kind: 'INSURANCE', name: 'Unknown insurance' },
  ];
  assert.equal(parseStandaloneOffers([page])[0].insurance, 120);
  sku.gameItems = [{ kind: 'INSURANCE', name: 'Unknown insurance' }];
  assert.equal(parseStandaloneOffers([page])[0].insurance, null);
});

test('ignores packages, non-ship SKUs and multi-ship packs', () => {
  const page = fixture('unavailable');
  const sku = page[0].data.store.search.resources[0];

  sku.isPackage = true;
  assert.deepEqual(parseStandaloneOffers([page]), []);
  sku.isPackage = false;
  sku.ships = [];
  assert.deepEqual(parseStandaloneOffers([page]), []);
  sku.ships = [{ id: '328' }, { id: '325' }];
  assert.deepEqual(parseStandaloneOffers([page]), []);
});

test('rejects malformed prices and GraphQL errors instead of showing no offers', () => {
  const page = fixture('unavailable');

  page[0].data.store.search.resources[0].nativePrice.amount = -1;
  assert.throws(() => parseStandaloneOffers([page]));
  assert.throws(() =>
    parseStandaloneOffers([[{ errors: [{ message: 'Unavailable' }] }]]),
  );
});
