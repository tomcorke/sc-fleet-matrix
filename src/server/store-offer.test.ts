import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseStoreOffer } from './store-offer.ts';

const ldJson = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

test('reads the top-level offer, not related products', () => {
  const page = [
    ldJson({ '@type': 'BreadcrumbList', itemListElement: [] }),
    ldJson({
      '@type': 'Product',
      offers: { '@type': 'Offer', price: '45.00', priceCurrency: 'USD' },
      isRelatedTo: [
        {
          '@type': 'Product',
          offers: { price: '275.00', priceCurrency: 'USD' },
        },
      ],
    }),
  ].join('');

  assert.deepEqual(parseStoreOffer(page), {
    price: '45.00',
    priceCurrency: 'USD',
  });
});

test('reads the low price of an aggregate offer', () => {
  const page = ldJson({
    '@type': 'Product',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '60.00',
      highPrice: '60.00',
      offers: [{ price: '60.00', priceCurrency: 'USD' }],
    },
  });

  assert.deepEqual(parseStoreOffer(page), {
    price: '60.00',
    priceCurrency: 'USD',
  });
});

test('returns null when the page has no product offer', () => {
  assert.equal(parseStoreOffer('<div class="buying-options"></div>'), null);
});
