import assert from 'node:assert/strict';
import { test } from 'node:test';

test('returns an error for unknown request kinds', async () => {
  const originalChrome = globalThis.chrome;
  let onMessage;

  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: (listener) => {
          onMessage = listener;
        },
      },
    },
  };

  try {
    await import('./background.js');

    let result;

    onMessage('store-offers', {}, (response) => {
      result = response;
    });

    assert.deepEqual(result, { error: 'Unknown request kind.' });
  } finally {
    if (originalChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = originalChrome;
    }
  }
});
