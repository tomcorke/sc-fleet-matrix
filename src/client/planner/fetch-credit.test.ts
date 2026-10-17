import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fetchCredit } from './fetch-credit.ts';

const bridge = (response: Record<string, unknown>, installed = true) => {
  const window = Object.assign(new EventTarget(), {
    location: { origin: 'http://localhost:5173' },
    postMessage: (message: unknown, origin: string) => {
      assert.deepEqual(message, { type: 'sc-fleet:request', kind: 'credit' });
      assert.equal(origin, window.location.origin);
      window.dispatchEvent(
        Object.assign(new Event('message'), {
          source: window,
          data: { type: 'sc-fleet:response', kind: 'credit', ...response },
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

test('preserves the credit balance and the extension fetch time, including zero credit', async () => {
  const credit = { amount: 0, fetchedAt: '2026-10-17T12:34:56Z' };

  bridge(credit);
  assert.deepEqual(await fetchCredit(), credit);
});

test('reports sign-out and rejects responses missing the fetch time', async () => {
  bridge({ error: 'Sign in to RSI.' });
  await assert.rejects(fetchCredit(), /Sign in to RSI/);
  bridge({ amount: 5000 });
  await assert.rejects(fetchCredit(), /Invalid store credit response/);
});

test('reports a missing extension without requesting credit', async () => {
  bridge({}, false);
  await assert.rejects(fetchCredit(), /Store credit needs the extension/);
});
