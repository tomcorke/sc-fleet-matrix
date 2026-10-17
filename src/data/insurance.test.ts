import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareInsuranceTiers, parseInsuranceTier } from './insurance.ts';

test('parses lifetime and month-based insurance titles', () => {
  assert.equal(parseInsuranceTier('Lifetime Insurance'), 'lti');
  assert.equal(parseInsuranceTier('1 Month Insurance'), 1);
  assert.equal(parseInsuranceTier('120 Months Insurance'), 120);
});

test('returns null for unknown insurance titles', () => {
  assert.equal(parseInsuranceTier('Lifetime Coverage'), null);
  assert.equal(parseInsuranceTier('0 Months Insurance'), null);
});

test('orders month tiers numerically and LTI above every month tier', () => {
  assert.equal(compareInsuranceTiers(6, 120), -1);
  assert.equal(compareInsuranceTiers(120, 120), 0);
  assert.equal(compareInsuranceTiers('lti', Number.MAX_SAFE_INTEGER), 1);
});
