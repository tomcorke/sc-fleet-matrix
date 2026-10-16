import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COLUMNS, type Ship, applyView, choicesFor } from './columns.ts';

const ship = (name: string, fields: Partial<Ship> = {}) =>
  ({
    name,
    size: 'small',
    type: 'combat',
    focus: 'Light Fighter',
    production_status: 'flight-ready',
    manufacturer: { name: 'Aegis Dynamics' },
    min_crew: 1,
    max_crew: 1,
    cargocapacity: 0,
    scm_speed: null,
    afterburner_speed: null,
    price: undefined,
    ...fields,
  }) as Ship;

const names = (ships: Ship[]) => ships.map((s) => s.name);

const fleet = [
  ship('Idris-P', { size: 'capital', price: 1900 }),
  ship('Gladius', { price: 90 }),
  ship('Ursa', { size: null }),
  ship('Arrow', { size: 'small', price: 75 }),
  ship('Cyclone', { size: 'vehicle', price: 55 }),
];

test('sorts sizes by scale, with missing values last both ways', () => {
  const asc = applyView(fleet, {}, { columnId: 'size', direction: 'asc' });
  const desc = applyView(fleet, {}, { columnId: 'size', direction: 'desc' });

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
  const view = applyView(
    fleet,
    { 'price:min': '75', 'price:max': '90' },
    { columnId: 'price', direction: 'desc' },
  );

  assert.deepEqual(names(view), ['Gladius', 'Arrow']);
});

test('matches text filters against the manufacturer too', () => {
  const ships = [
    ...fleet,
    ship('Hull C', { manufacturer: { name: 'MISC' } as Ship['manufacturer'] }),
  ];
  const view = applyView(
    ships,
    { name: 'misc' },
    { columnId: 'name', direction: 'asc' },
  );

  assert.deepEqual(names(view), ['Hull C']);
});

test('lists size choices in scale order', () => {
  const size = COLUMNS.find((c) => c.id === 'size');

  assert.equal(size?.kind, 'choice');
  assert.deepEqual(size?.kind === 'choice' ? choicesFor(size, fleet) : [], [
    'vehicle',
    'small',
    'capital',
  ]);
});
