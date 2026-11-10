import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { loadStarredShipIds, saveStarredShipIds } from './starred-ships.ts';

beforeEach(() => {
  const saved = new Map<string, string>();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    },
  });
});

test('restores starred ship IDs across loads, including removing all stars', () => {
  assert.deepEqual(loadStarredShipIds(), []);
  saveStarredShipIds([7, 42]);
  assert.deepEqual(loadStarredShipIds(), [7, 42]);
  saveStarredShipIds([42]);
  assert.deepEqual(loadStarredShipIds(), [42]);
  saveStarredShipIds([]);
  assert.deepEqual(loadStarredShipIds(), []);
});

test('ignores malformed saved stars rather than crashing the matrix', () => {
  for (const saved of [
    'bad json',
    'null',
    '{}',
    '["7"]',
    '[7, null]',
    '[1.5]',
    '[-1]',
  ]) {
    localStorage.setItem('starred-ships', saved);
    assert.deepEqual(loadStarredShipIds(), []);
  }
});

test('storage access failure does not crash the matrix', (t) => {
  const deny = () => {
    throw new Error('Storage blocked');
  };

  t.mock.method(localStorage, 'getItem', deny);
  t.mock.method(localStorage, 'setItem', deny);
  assert.deepEqual(loadStarredShipIds(), []);
  assert.doesNotThrow(() => saveStarredShipIds([7]));
});
