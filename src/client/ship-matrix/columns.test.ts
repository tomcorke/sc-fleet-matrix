import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Stat } from '../../data/schema.ts';

import { type Ship, applyView, choicesFor, coverage } from './columns.ts';

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
