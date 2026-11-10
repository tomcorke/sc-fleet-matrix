import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Stat } from '../../data/schema.ts';

import {
  type Ship,
  applyView,
  choicesFor,
  compileTextFilter,
  coverage,
} from './columns.ts';

const COLUMNS: Stat[] = [
  { id: 'name', label: 'Ship', kind: 'text', source: 'test' },
  {
    id: 'size',
    label: 'Size',
    kind: 'choice',
    source: 'test',
    order: ['Vehicle', 'Small', 'Capital'],
  },
  { id: 'price', label: 'Price', kind: 'number', source: 'test', unit: 'usd' },
];

const ship = (name: string, values: Ship['values'] = {}): Ship => ({
  id: name.length,
  name,
  values: { name, size: 'Small', manufacturer: 'Aegis Dynamics', ...values },
});

const names = (ships: Ship[]) => ships.map((s) => s.name);

const ursa = ship('Ursa');

delete ursa.values.size;

const fleet = [
  ship('Idris-P', { size: 'Capital', price: 1900 }),
  ship('Gladius', { price: 90 }),
  ursa,
  ship('Arrow', { size: 'Small', price: 75 }),
  ship('Cyclone', { size: 'Vehicle', price: 55 }),
];

const view = (
  filters: Record<string, string>,
  columnId: string,
  direction: 'asc' | 'desc' = 'asc',
  ships = fleet,
) => applyView(ships, COLUMNS, filters, { columnId, direction });

test('sorts sizes by scale, with missing values last both ways', () => {
  const asc = view({}, 'size');
  const desc = view({}, 'size', 'desc');

  assert.deepEqual(names(asc), [
    'Cyclone',
    'Arrow',
    'Gladius',
    'Idris-P',
    'Ursa',
  ]);
  assert.deepEqual(names(desc), [
    'Idris-P',
    'Arrow',
    'Gladius',
    'Cyclone',
    'Ursa',
  ]);
});

test('filters numbers by an inclusive range and drops missing values', () => {
  assert.deepEqual(
    names(view({ 'price:min': '75', 'price:max': '90' }, 'price', 'desc')),
    ['Gladius', 'Arrow'],
  );
});

test('matches text filters against the manufacturer too', () => {
  const ships = [...fleet, ship('Hull C', { manufacturer: 'MISC' })];

  assert.deepEqual(names(view({ name: 'misc' }, 'name', 'asc', ships)), [
    'Hull C',
  ]);
});

test('matches slash-delimited regexes without case sensitivity', () => {
  assert.deepEqual(names(view({ name: ' /^(ARROW|gladius)\\b/ ' }, 'name')), [
    'Arrow',
    'Gladius',
  ]);
  assert.equal(view({ name: '/aegis\\s+dynamics$/' }, 'name').length, 5);
});

test('supports regexes in every text column and combines them with other filters', () => {
  const columns: Stat[] = [
    ...COLUMNS,
    { id: 'manufacturer', label: 'Manufacturer', kind: 'text', source: 'test' },
  ];
  const ships = [
    ...fleet,
    ship('Hull C', { manufacturer: 'MISC', price: 500 }),
  ];
  const result = applyView(
    ships,
    columns,
    { manufacturer: '/^(misc|aegis)/', 'price:min': '100' },
    { columnId: 'name', direction: 'asc' },
  );

  assert.deepEqual(names(result), ['Hull C', 'Idris-P']);
});

test('keeps ordinary searches literal, including incomplete regex delimiters', () => {
  const ships = [ship('A.B'), ship('AxB'), ship('A/B'), ship('A/B/C')];

  assert.deepEqual(names(view({ name: 'a.b' }, 'name', 'asc', ships)), ['A.B']);
  assert.deepEqual(names(view({ name: '/B' }, 'name', 'asc', ships)), [
    'A/B',
    'A/B/C',
  ]);
  assert.deepEqual(names(view({ name: 'B/' }, 'name', 'asc', ships)), [
    'A/B/C',
  ]);
});

test('invalid regexes report an error and match no ships without throwing', () => {
  for (const pattern of ['/[/', '/(/', '/*/']) {
    assert.equal(
      compileTextFilter(pattern).error,
      'Invalid regular expression',
    );
    assert.deepEqual(view({ name: pattern }, 'name'), []);
  }

  assert.equal(compileTextFilter('/arrow/').error, null);
  assert.deepEqual(names(view({ name: '/arrow/' }, 'name')), ['Arrow']);
});

test('empty regexes match all ships and hidden regex filters are ignored', () => {
  assert.equal(view({ name: '//' }, 'name').length, fleet.length);
  assert.equal(
    applyView(
      fleet,
      [COLUMNS[1]],
      { name: '/[/' },
      {
        columnId: 'size',
        direction: 'asc',
      },
    ).length,
    fleet.length,
  );
});

test('lists size choices in scale order', () => {
  assert.deepEqual(choicesFor(COLUMNS[1], fleet), [
    'Vehicle',
    'Small',
    'Capital',
  ]);
});

test('counts ships with data for a column', () => {
  assert.deepEqual(coverage(COLUMNS[1], fleet), { count: 4, total: 5 });
});

test('ignores filters on hidden columns', () => {
  const visible = COLUMNS.filter((c) => c.id !== 'price');

  assert.equal(
    applyView(
      fleet,
      visible,
      { 'price:min': '1000' },
      { columnId: 'name', direction: 'asc' },
    ).length,
    5,
  );
});
