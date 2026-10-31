import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import { normalise } from './normalise.ts';

const matrix = JSON.parse(
  fs.readFileSync(
    new URL('../data/sources/rsi-ship-matrix.json', import.meta.url),
    'utf8',
  ),
);
const aurora = { ...matrix.data[0], id: 1, scm_speed: 0, size: 'SMALL' };

const storePages = [
  [
    {
      data: {
        store: {
          search: { totalCount: 1, resources: [{ id: '1', msrp: 2000 }] },
        },
      },
    },
  ],
];

const features = {
  feature_keys: ['toilet', 'shower', 'emp'],
  wiki_feature_keys: ['shower', 'emp', 'bathroom'],
  ships: [
    {
      matrix_id: 1,
      api_status: 'matched',
      api_source: { uuid: 'aurora-uuid' },
      features: {
        toilet: { state: 'present' },
        shower: { state: 'not-mentioned' },
        emp: { state: 'unresolved' },
      },
      wiki_features: {
        shower: { state: 'present' },
        emp: { state: 'not-mentioned' },
        bathroom: { state: 'unresolved' },
      },
      reported: {
        seating: { beds: 2, medical_beds: { T3: 1, T2: 1 }, jump_seats: null },
        max_medical_tier: 'T2',
      },
    },
  ],
};

const vehiclePages = [
  {
    meta: { last_page: 1 },
    data: [
      {
        uuid: 'aurora-uuid',
        quantum: {
          quantum_speed: 189309100,
          quantum_spool_time: 4.6,
          quantum_fuel_capacity: 0.6,
          quantum_range: 61224489796,
        },
        armor: [],
        weaponry: { pilot_dps: 1944.5 },
        turrets: { manned: [], remote: [{}] },
        insurance: {
          claim_time: 4.86,
          expedite_time: 1.62,
          expedite_cost: 2658,
        },
        uex_prices: {
          purchase: [
            {
              price_buy: 2000,
              terminal_name: 'Shop A',
              starmap_location: { name: 'Lorville' },
            },
            {
              price_buy: 1500,
              terminal_name: 'Shop B',
              starmap_location: { name: 'Area 18' },
            },
            { price_buy: 1800, terminal_name: 'Shop C', starmap_location: [] },
          ],
          rental: [],
        },
      },
    ],
  },
];

test('normalises every source into stat values', () => {
  const data = normalise({
    matrix: { ...matrix, data: [aurora] },
    storePages,
    features,
    vehiclePages,
  });
  const { values } = data.ships[0];

  assert.equal(values.size, 'Small');
  assert.equal(values.price, 20);
  assert.equal('scm' in values, false, 'RSI zero speed means unknown');
  assert.equal(values['feature:toilet'], 'Yes');
  assert.equal(values['feature:shower'], 'Yes', 'wiki evidence wins');
  assert.equal(values['feature:emp'], 'No', 'a check beats none');
  assert.equal('feature:bathroom' in values, false, 'unresolved is unknown');
  assert.equal(values['seating:medical_beds'], 2);
  assert.equal(values.max_medical_tier, 'T2');
  assert.equal(values.ingame_availability, 'Buy listed');
  assert.equal(values.ingame_buy_price, 1500, 'lowest listing wins');
  assert.equal(values.ingame_buy_locations, 'Area 18, Lorville, Shop C');
  assert.equal('ingame_rent_price' in values, false, 'no rental listing');
  assert.equal('ingame_rent_locations' in values, false);
  assert.equal(values.insurance_claim, 4.9);
  assert.equal(values.insurance_expedite_cost, 2658);
  assert.equal(values.quantum_speed, 189309);
  assert.equal(values.quantum_range, 61.2);
  assert.equal('armour_hp' in values, false, 'empty array means no armour');
  assert.equal(values.pilot_dps, 1945);
  assert.equal(values.missiles, 0, 'weapons without missiles is zero');
  assert.equal(values.manned_turrets, 0);
  assert.equal(values.remote_turrets, 1);
  assert.equal(
    data.stats.some((stat) => stat.id === 'seating:jump_seats'),
    false,
    'stats without data are dropped',
  );
});

test('works without a feature snapshot', () => {
  const data = normalise({
    matrix: { ...matrix, data: [aurora] },
    storePages,
    features: null,
    vehiclePages,
  });

  assert.equal(
    data.stats.some((stat) => stat.source !== 'RSI ship matrix'),
    true,
  );
  assert.equal(
    data.stats.some((stat) => stat.id.startsWith('feature:')),
    false,
  );
  assert.equal('quantum_speed' in data.ships[0].values, false, 'no mapping');
});
