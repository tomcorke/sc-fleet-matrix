import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { fetchUpgradeData } from './fetch-upgrade-data.ts';

const bridge = (response: Record<string, unknown>, installed = true) => {
  const window = Object.assign(new EventTarget(), {
    location: { origin: 'http://localhost:5173' },
    postMessage: (message: unknown, origin: string) => {
      assert.deepEqual(message, {
        type: 'sc-fleet:request',
        kind: 'upgrade-data',
      });
      assert.equal(origin, window.location.origin);
      window.dispatchEvent(
        Object.assign(new Event('message'), {
          source: window,
          data: {
            type: 'sc-fleet:response',
            kind: 'upgrade-data',
            ...response,
          },
        }),
      );
    },
  });

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: window,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: { dataset: installed ? { scFleetHangar: '' } : {} },
    },
  });
};

test('requests only the upgrade-data kind and preserves the extension fetch time', async () => {
  const response = JSON.parse(
    readFileSync(
      new URL('./fixtures/filter-ships.json', import.meta.url),
      'utf8',
    ),
  );

  bridge({ response, fetchedAt: '2026-10-17T12:34:56Z' });
  const result = await fetchUpgradeData();

  assert.equal(result.fetchedAt, '2026-10-17T12:34:56Z');
  assert.equal(result.sources.length, 3);
});

test('reports missing or outdated extensions and invalid upgrade responses', async () => {
  bridge({}, false);
  await assert.rejects(fetchUpgradeData(), /Upgrade data needs the extension/);
  bridge({ error: 'Unknown request kind.' });
  await assert.rejects(fetchUpgradeData(), /Unknown request kind/);
  bridge({ response: [] });
  await assert.rejects(fetchUpgradeData());
});
