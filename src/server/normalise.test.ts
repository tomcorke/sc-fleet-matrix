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

test('normalises every source into stat values', () => {
  const data = normalise({
    matrix: { ...matrix, data: [aurora] },
    storePages,
    features,
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
  });

  assert.equal(
    data.stats.some((stat) => stat.source !== 'RSI ship matrix'),
    true,
  );
  assert.equal(
    data.stats.some((stat) => stat.id.startsWith('feature:')),
    false,
  );
});
