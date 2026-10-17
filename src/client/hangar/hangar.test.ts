import { DOMParser } from 'linkedom';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';

import {
  insuranceForShip,
  loadSavedPledges,
  parsePledges,
  savePledges,
} from './hangar.ts';

// Each node:test file runs in its own process; only this parser needs a DOM.
Object.defineProperty(globalThis, 'DOMParser', { value: DOMParser });

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
const matrixShips = [
  { id: 1, name: 'Aurora Mk II' },
  { id: 2, name: 'Asgard' },
  { id: 3, name: 'Galaxy' },
];
const parseFixture = (name: string) =>
  parsePledges([fixture(name)], matrixShips);

beforeEach(() => {
  const saved = new Map<string, string>();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
      removeItem: (key: string) => saved.delete(key),
    },
  });
});

test('parses a single LTI ship, pledge identity, USD cents and action flags', () => {
  const [pledge] = parseFixture('single-ship-lti');

  assert.equal(pledge.id, '1001');
  assert.equal(pledge.name, 'Standalone Ships - Aurora Mk II plus Modules');
  assert.equal(pledge.meltValue, 5500);
  assert.deepEqual(pledge.ships, [{ name: 'Aurora Mk II', shipId: 1 }]);
  assert.deepEqual(pledge.insuranceItems, [
    { name: 'Lifetime Insurance', tier: 'lti' },
  ]);
  assert.equal(pledge.insurance, 'lti');
  assert.equal(pledge.canMelt, true);
  assert.equal(pledge.canGift, true);
  assert.equal(pledge.hasAppliedUpgrades, false);
  assert.equal(pledge.containsGamePackage, false);
});

test('keeps every insurance item but selects the highest tier', () => {
  const [pledge] = parseFixture('multiple-insurance');

  assert.deepEqual(
    pledge.insuranceItems.map((item) => item.tier),
    ['lti', 120, 120, 120],
  );
  assert.equal(pledge.insurance, 'lti');
  assert.equal(pledge.meltValue, 29000);
  assert.deepEqual(pledge.ships, [{ name: 'Asgard', shipId: 2 }]);
  assert.equal(pledge.hasAppliedUpgrades, true);
  assert.equal(pledge.canMelt, true);
  assert.equal(pledge.canGift, false);
});

test('recognizes game access even when the download has no item kind', () => {
  const [pledge] = parseFixture('game-package');

  assert.equal(pledge.containsGamePackage, true);
  assert.equal(pledge.insurance, null);
  assert.deepEqual(pledge.ships, []);
});

test('reads the upgraded ship rather than the original pledge name', () => {
  const [pledge] = parseFixture('upgraded-pledge');

  assert.equal(pledge.name, 'Digital Scout - LTI');
  assert.deepEqual(pledge.ships, [{ name: 'Galaxy', shipId: 3 }]);
  assert.equal(pledge.hasAppliedUpgrades, true);
  assert.equal(pledge.canMelt, false);
  assert.equal(pledge.canGift, false);
  assert.equal(pledge.containsGamePackage, true);
  assert.equal(pledge.meltValue, 35500);
  assert.equal(pledge.insurance, 'lti');
});

test('keeps non-ship pledges with no insurance and no allowed actions', () => {
  const [pledge] = parseFixture('no-ships');

  assert.equal(pledge.id, '1005');
  assert.equal(pledge.meltValue, 0);
  assert.deepEqual(pledge.ships, []);
  assert.deepEqual(pledge.insuranceItems, []);
  assert.equal(pledge.insurance, null);
  assert.equal(pledge.canMelt, false);
  assert.equal(pledge.canGift, false);
  assert.equal(pledge.hasAppliedUpgrades, false);
  assert.equal(pledge.containsGamePackage, false);
});

test('matches case and spacing, and retains unmatched ship names', () => {
  const [pledge] = parsePledges(
    [fixture('single-ship-lti')],
    [{ id: 10, name: '  AURORA  Mk II  ' }],
  );
  const [unmatched] = parsePledges([fixture('single-ship-lti')], []);

  assert.equal(pledge.ships[0].shipId, 10);
  assert.deepEqual(unmatched.ships, [{ name: 'Aurora Mk II', shipId: null }]);
});

test('keeps several ships together in one pledge with the same insurance', () => {
  const html = fixture('single-ship-lti').replace(
    '</li>',
    '<div class="item"><div class="title">Asgard</div><div class="kind">Ship</div></div></li>',
  );
  const pledges = parsePledges([html], matrixShips);

  assert.equal(pledges.length, 1);
  assert.deepEqual(pledges[0].ships, [
    { name: 'Aurora Mk II', shipId: 1 },
    { name: 'Asgard', shipId: 2 },
  ]);
  assert.equal(insuranceForShip(pledges, 1), 'LTI');
  assert.equal(insuranceForShip(pledges, 2), 'LTI');
});

test('formats the best insurance of each owned copy, across pages and multi-ship pledges', () => {
  const html = fixture('single-ship-lti');
  const second = html
    .replace('value="1001"', 'value="2001"')
    .replace('Lifetime Insurance', '6 Month Insurance');
  const [first] = parsePledges([html], matrixShips);
  const pledges = parsePledges([html, second], matrixShips);

  assert.equal(insuranceForShip(pledges, 1), 'LTI, 6 mo');
  assert.equal(insuranceForShip(pledges, 2), '');
  assert.equal(
    insuranceForShip(
      [{ ...first, ships: [...first.ships, ...first.ships] }],
      1,
    ),
    'LTI, LTI',
  );
});

test('orders month insurance numerically and retains unknown insurance titles', () => {
  const html = fixture('multiple-insurance').replaceAll(
    'Lifetime Insurance',
    '6 Month Insurance',
  );
  const [months] = parsePledges([html], matrixShips);
  const [unknown] = parsePledges(
    [
      fixture('single-ship-lti').replace(
        'Lifetime Insurance',
        'Unrecognized Insurance',
      ),
    ],
    matrixShips,
  );

  assert.equal(months.insurance, 120);
  assert.deepEqual(unknown.insuranceItems, [
    { name: 'Unrecognized Insurance', tier: null },
  ]);
  assert.equal(unknown.insurance, null);
  assert.equal(insuranceForShip([unknown], 1), 'Unknown');
});

test('reads grouped USD amounts without losing cents and rejects invalid melt values', () => {
  const html = fixture('single-ship-lti');
  const [pledge] = parsePledges(
    [html.replace('$55.00 USD', '$1,234.56 USD')],
    matrixShips,
  );

  assert.equal(pledge.meltValue, 123456);

  for (const value of ['€55.00 EUR', '$1,,234.56 USD', '', '$-55.00 USD']) {
    assert.throws(
      () => parsePledges([html.replace('$55.00 USD', value)], matrixShips),
      /melt value in USD/,
    );
  }
});

test('round-trips pledge storage, including a loaded empty hangar', () => {
  const pledges = parseFixture('single-ship-lti');

  assert.equal(loadSavedPledges(), null);
  savePledges(pledges);
  assert.deepEqual(loadSavedPledges(), pledges);
  savePledges([]);
  assert.deepEqual(loadSavedPledges(), []);
});

test('drops old ship lists and ignores malformed or incomplete saved pledges', () => {
  localStorage.setItem('owned-ships', JSON.stringify(['Aurora Mk II']));
  assert.equal(loadSavedPledges(), null);
  assert.equal(localStorage.getItem('owned-ships'), null);

  for (const saved of [
    'bad json',
    'null',
    '{}',
    '["Aurora Mk II"]',
    '[{"ships":[]}]',
  ]) {
    localStorage.setItem('hangar-pledges', saved);
    assert.equal(loadSavedPledges(), null);
  }
});

test('storage access failure does not crash the viewer', (t) => {
  const deny = () => {
    throw new Error('Storage blocked');
  };

  t.mock.method(localStorage, 'removeItem', deny);
  t.mock.method(localStorage, 'setItem', deny);
  assert.equal(loadSavedPledges(), null);
  assert.doesNotThrow(() => savePledges([]));
});
