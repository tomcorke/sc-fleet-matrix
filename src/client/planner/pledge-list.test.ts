import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pledge } from '../hangar/hangar.ts';
import { arrangePledges, pledgeTitle } from './pledge-list.ts';

const pledge = (
  id: string,
  name: string,
  meltValue: number,
  insurance: Pledge['insurance'],
  ships: string[],
  hasAppliedUpgrades = false,
): Pledge => ({
  id,
  name,
  meltValue,
  ships: ships.map((ship) => ({ name: ship, shipId: null })),
  insuranceItems: [],
  insurance,
  canMelt: true,
  canGift: false,
  hasAppliedUpgrades,
  containsGamePackage: false,
});

const mtc = pledge(
  '1',
  'Standalone Ships - MTC',
  9000,
  'lti',
  ['Asgard'],
  true,
);
const paint = pledge('2', 'Paints - Blue', 0, null, []);
const aurora = pledge('3', 'Standalone Ships - Aurora', 2000, 6, ['Aurora']);
const ids = (groups: [string, Pledge[]][]) =>
  groups.map(([key, members]) => [key, members.map((member) => member.id)]);

test('upgraded pledges are titled by the ship they hold now', () => {
  assert.equal(pledgeTitle(mtc), 'Asgard');
  assert.equal(pledgeTitle(aurora), 'Standalone Ships - Aurora');
});

test('filters, sorts and groups pledges', () => {
  const all = [paint, aurora, mtc];

  assert.deepEqual(
    ids(
      arrangePledges(all, { hideWorthless: true, sort: 'melt', group: 'none' }),
    ),
    [['', ['1', '3']]],
  );
  assert.deepEqual(
    ids(
      arrangePledges(all, {
        hideWorthless: false,
        sort: 'name',
        group: 'none',
      }),
    ),
    [['', ['1', '2', '3']]],
  );
  assert.deepEqual(
    ids(
      arrangePledges(all, {
        hideWorthless: false,
        sort: 'insurance',
        group: 'type',
      }),
    ),
    [
      ['Paints', ['2']],
      ['Standalone Ships', ['1', '3']],
    ],
  );
  assert.deepEqual(
    ids(
      arrangePledges(all, {
        hideWorthless: false,
        sort: 'melt',
        group: 'ship',
      }),
    ),
    [
      ['Asgard', ['1']],
      ['Aurora', ['3']],
      ['No ships', ['2']],
    ],
  );
});
