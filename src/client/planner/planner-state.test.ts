import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EMPTY_PLANNER, parsePlannerState } from './planner-state.ts';

test('round-trips saved choices and falls back on missing or invalid data', () => {
  const state = {
    tradeIn: ['123'],
    wants: [
      { key: 'a', shipId: 7, insurance: 'lti' },
      { key: 'b', shipId: 7, insurance: 120 },
    ],
    funding: 'credit-only',
  };

  assert.deepEqual(parsePlannerState(JSON.stringify(state)), state);
  assert.equal(parsePlannerState(null), EMPTY_PLANNER);
  assert.equal(parsePlannerState('{oops'), EMPTY_PLANNER);
  assert.equal(
    parsePlannerState(JSON.stringify({ ...state, funding: 'free' })),
    EMPTY_PLANNER,
  );
});
