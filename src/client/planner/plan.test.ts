import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pledge } from '../hangar/hangar.ts';
import type { StandaloneOffer } from '../store/store-offers.ts';
import { type PlanInput, createPlan } from './plan.ts';

const pledge = (changes: Partial<Pledge> = {}): Pledge => ({
  id: 'pledge',
  name: 'Aurora pledge',
  meltValue: 5000,
  ships: [{ name: 'Aurora', shipId: 1 }],
  insuranceItems: [],
  insurance: 6,
  canMelt: true,
  canGift: true,
  hasAppliedUpgrades: false,
  containsGamePackage: false,
  ...changes,
});

const offer = (changes: Partial<StandaloneOffer> = {}): StandaloneOffer => ({
  skuId: 'standard',
  shipId: 2,
  price: 10000,
  warbond: false,
  insurance: 6,
  available: true,
  ...changes,
});

const input = (changes: Partial<PlanInput> = {}): PlanInput => ({
  pledges: [],
  tradeIn: [],
  want: [{ shipId: 2, minInsurance: 'any' }],
  offers: { standalone: [offer()], fetchedAt: '2026-10-17T10:00:00Z' },
  credit: 0,
  creditFetchedAt: '2026-10-17T10:01:00Z',
  funding: 'least-new-money',
  ...changes,
});

test('buys the cheapest available standalone meeting the insurance minimum', () => {
  const plan = createPlan(
    input({
      want: [{ shipId: 2, minInsurance: 120 }],
      offers: {
        fetchedAt: '2026-10-17T10:00:00Z',
        standalone: [
          offer({ skuId: 'short', price: 5000 }),
          offer({ skuId: 'unknown', price: 1000, insurance: null }),
          offer({
            skuId: 'sold-out',
            price: 2000,
            insurance: 'lti',
            available: false,
          }),
          offer({ skuId: 'lti', price: 12000, insurance: 'lti' }),
          offer({ skuId: '120-months', price: 9000, insurance: 120 }),
        ],
      },
    }),
  );

  assert.deepEqual(plan.steps, [
    {
      kind: 'buy-standalone',
      skuId: '120-months',
      shipId: 2,
      credit: 0,
      newMoney: 9000,
    },
  ]);
  assert.deepEqual(plan.unmet, []);
});

test('credit-only excludes warbonds and explains unavailable insurance and ships', () => {
  const plan = createPlan(
    input({
      funding: 'credit-only',
      credit: 100000,
      want: [
        { shipId: 2, minInsurance: 'lti' },
        { shipId: 3, minInsurance: 'any' },
        { shipId: 4, minInsurance: 'lti' },
        { shipId: 5, minInsurance: 'any' },
        { shipId: 6, minInsurance: 120 },
      ],
      offers: {
        fetchedAt: '2026-10-17T10:00:00Z',
        standalone: [
          offer(),
          offer({ skuId: 'lti-wb', warbond: true, insurance: 'lti' }),
          offer({ skuId: 'wb', shipId: 3, warbond: true }),
          offer({ skuId: 'short', shipId: 4 }),
          offer({ skuId: 'sold-out', shipId: 5, available: false }),
          offer({ skuId: 'six-months', shipId: 6 }),
        ],
      },
    }),
  );

  assert.equal(plan.steps.length, 0);
  assert.match(plan.unmet[0].reason, /LTI needs new money/);
  assert.match(plan.unmet[1].reason, /warbond only/);
  assert.match(plan.unmet[2].reason, /No standalone offer with LTI/);
  assert.match(plan.unmet[3].reason, /Not on sale/);
  assert.match(plan.unmet[4].reason, /at least 120 months/);
  assert.equal(plan.totals.newMoney, 0);
});

test('credit-only chooses the cheapest qualifying standard offer', () => {
  const plan = createPlan(
    input({
      funding: 'credit-only',
      credit: 20000,
      offers: {
        fetchedAt: '2026-10-17T10:00:00Z',
        standalone: [offer(), offer({ skuId: 'cheaper', price: 8000 })],
      },
    }),
  );

  assert.deepEqual(plan.totals, {
    newMoney: 0,
    creditUsed: 8000,
    creditLeft: 12000,
  });
  assert.equal(
    plan.steps[0].kind === 'buy-standalone' && plan.steps[0].skuId,
    'cheaper',
  );
});

test('funding modes choose differently when credit is short', () => {
  const options = input({
    credit: 8000,
    offers: {
      fetchedAt: '2026-10-17T10:00:00Z',
      standalone: [
        offer(),
        offer({ skuId: 'warbond', price: 7000, warbond: true }),
      ],
    },
  });
  const leastNewMoney = createPlan(options);
  const lowestTotal = createPlan({ ...options, funding: 'lowest-total' });

  assert.deepEqual(leastNewMoney.steps, [
    {
      kind: 'buy-standalone',
      skuId: 'standard',
      shipId: 2,
      credit: 8000,
      newMoney: 2000,
    },
  ]);
  assert.deepEqual(lowestTotal.steps, [
    {
      kind: 'buy-standalone',
      skuId: 'warbond',
      shipId: 2,
      credit: 0,
      newMoney: 7000,
      note: 'Chose the $70.00 warbond over the $100.00 standard edition, which accepts store credit.',
    },
  ]);
  assert.equal(lowestTotal.totals.creditLeft, 8000);
});

test('never melts the only game package or a pledge that cannot melt', () => {
  const plan = createPlan(
    input({
      pledges: [
        pledge({ containsGamePackage: true }),
        pledge({ id: 'locked', name: 'Locked pledge', canMelt: false }),
      ],
      tradeIn: ['pledge', 'locked'],
    }),
  );

  assert.equal(
    plan.steps.some((step) => step.kind === 'melt'),
    false,
  );
  assert.match(plan.warnings.join('\n'), /only game package/);
  assert.match(plan.warnings.join('\n'), /Cannot melt Locked pledge/);
  assert.equal(plan.totals.creditUsed, 0);
});

test('keeps game access even when all game packages are in Trade in', () => {
  const plan = createPlan(
    input({
      pledges: [
        pledge({ containsGamePackage: true }),
        pledge({ id: 'second', containsGamePackage: true }),
      ],
      tradeIn: ['pledge', 'second'],
    }),
  );

  assert.deepEqual(
    plan.steps.filter((step) => step.kind === 'melt'),
    [{ kind: 'melt', pledgeId: 'pledge', credit: 5000 }],
  );
  assert.match(plan.warnings.join('\n'), /only game package/);
});

test('melts multi-ship trade-ins once before buying, leaves Keep alone, and totals add up', () => {
  const plan = createPlan(
    input({
      pledges: [
        pledge({
          ships: [
            { name: 'Aurora', shipId: 1 },
            { name: 'Other', shipId: 3 },
          ],
        }),
        pledge({ id: 'keep' }),
      ],
      tradeIn: ['pledge', 'pledge', 'missing'],
      credit: 1000,
      want: [
        { shipId: 2, minInsurance: 'any' },
        { shipId: 2, minInsurance: 'any' },
      ],
    }),
  );

  assert.deepEqual(plan.steps, [
    { kind: 'melt', pledgeId: 'pledge', credit: 5000 },
    {
      kind: 'buy-standalone',
      skuId: 'standard',
      shipId: 2,
      credit: 6000,
      newMoney: 4000,
    },
    {
      kind: 'buy-standalone',
      skuId: 'standard',
      shipId: 2,
      credit: 0,
      newMoney: 10000,
    },
  ]);
  assert.deepEqual(plan.totals, {
    newMoney: 14000,
    creditUsed: 6000,
    creditLeft: 0,
  });
  assert.equal(plan.totals.creditUsed + plan.totals.newMoney, 20000);
  assert.equal(plan.totals.creditUsed + plan.totals.creditLeft, 1000 + 5000);
});

test('searches combinations globally rather than spending credit greedily per want', () => {
  const plan = createPlan(
    input({
      credit: 10000,
      want: [
        { shipId: 2, minInsurance: 'any' },
        { shipId: 3, minInsurance: 'any' },
      ],
      offers: {
        fetchedAt: '2026-10-17T10:00:00Z',
        standalone: [
          offer(),
          offer({ skuId: 'cheap-wb', warbond: true, price: 5000 }),
          offer({ skuId: 'second', shipId: 3 }),
        ],
      },
    }),
  );

  assert.deepEqual(plan.totals, {
    newMoney: 5000,
    creditUsed: 10000,
    creditLeft: 0,
  });
  assert.equal(
    plan.steps[0].kind === 'buy-standalone' && plan.steps[0].skuId,
    'cheap-wb',
  );
});

test('credit-only fulfills as many wants as the balance allows and reports the rest', () => {
  const plan = createPlan(
    input({
      funding: 'credit-only',
      credit: 10000,
      want: [
        { shipId: 2, minInsurance: 'any' },
        { shipId: 3, minInsurance: 'any' },
        { shipId: 4, minInsurance: 'any' },
      ],
      offers: {
        fetchedAt: '2026-10-17T10:00:00Z',
        standalone: [
          offer(),
          offer({ shipId: 3, price: 5000 }),
          offer({ shipId: 4, price: 5000 }),
        ],
      },
    }),
  );

  assert.equal(plan.unmet.length, 1);
  assert.deepEqual(plan.unmet[0], {
    shipId: 2,
    reason: 'Not enough store credit.',
  });
  assert.deepEqual(plan.totals, {
    newMoney: 0,
    creditUsed: 10000,
    creditLeft: 0,
  });
});

test('does not melt the $170 and $290 trade-ins for a $275 warbond-only purchase', () => {
  const plan = createPlan(
    input({
      pledges: [
        pledge({ id: 'mtc-170', meltValue: 17000 }),
        pledge({ id: 'mtc-290', meltValue: 29000 }),
      ],
      tradeIn: ['mtc-170', 'mtc-290'],
      offers: {
        fetchedAt: '2026-10-17T10:00:00Z',
        standalone: [
          offer({ skuId: 'centaurus-wb', price: 27500, warbond: true }),
        ],
      },
    }),
  );

  assert.deepEqual(plan.steps, [
    {
      kind: 'buy-standalone',
      skuId: 'centaurus-wb',
      shipId: 2,
      credit: 0,
      newMoney: 27500,
    },
  ]);
  assert.deepEqual(plan.totals, {
    newMoney: 27500,
    creditUsed: 0,
    creditLeft: 0,
  });
});

test('funding modes compare a credit-payable offer with warbond before melting', () => {
  const options = input({
    pledges: [
      pledge({ id: 'mtc-170', meltValue: 17000 }),
      pledge({ id: 'mtc-290', meltValue: 29000 }),
    ],
    tradeIn: ['mtc-170', 'mtc-290'],
    offers: {
      fetchedAt: '2026-10-17T10:00:00Z',
      standalone: [
        offer({ price: 30000 }),
        offer({ skuId: 'centaurus-wb', price: 27500, warbond: true }),
      ],
    },
  });

  for (const funding of ['credit-only', 'least-new-money'] as const) {
    const plan = createPlan({ ...options, funding });

    assert.deepEqual(
      plan.steps.slice(0, 2).map((step) => step.kind),
      ['melt', 'melt'],
    );
    assert.deepEqual(plan.steps[2], {
      kind: 'buy-standalone',
      skuId: 'standard',
      shipId: 2,
      credit: 30000,
      newMoney: 0,
    });
    assert.deepEqual(plan.totals, {
      newMoney: 0,
      creditUsed: 30000,
      creditLeft: 16000,
    });
    assert.deepEqual(plan.unmet, []);
  }

  const lowestTotal = createPlan({ ...options, funding: 'lowest-total' });

  assert.equal(lowestTotal.steps.length, 1);
  assert.ok(lowestTotal.steps[0].kind === 'buy-standalone');
  assert.deepEqual(lowestTotal.totals, {
    newMoney: 27500,
    creditUsed: 0,
    creditLeft: 0,
  });
  assert.match(
    lowestTotal.steps[0].note ?? '',
    /\$275\.00.*warbond.*\$300\.00.*standard.*store credit/i,
  );
});

test('warbond notes compare the cheapest qualifying standard offer, or explain its insurance shortfall', () => {
  for (const minInsurance of [120, 'lti'] as const) {
    const plan = createPlan(
      input({
        funding: 'lowest-total',
        want: [{ shipId: 2, minInsurance }],
        offers: {
          fetchedAt: '2026-10-17T10:00:00Z',
          standalone: [
            offer({ skuId: 'short', price: 29000 }),
            offer({ skuId: '120-months', price: 30000, insurance: 120 }),
            offer({ skuId: 'higher-price', price: 32000, insurance: 120 }),
            offer({ skuId: 'sold-out', price: 1000, available: false }),
            offer({ skuId: 'other-ship', shipId: 3, price: 1000 }),
            offer({
              skuId: 'wb',
              price: 27500,
              warbond: true,
              insurance: 'lti',
            }),
          ],
        },
      }),
    );
    const step = plan.steps[0];

    assert.ok(step.kind === 'buy-standalone');
    assert.equal(step.skuId, 'wb');
    assert.match(step.note ?? '', /\$275\.00/);

    if (minInsurance === 'lti') {
      assert.match(step.note ?? '', /\$290\.00/);
      assert.match(step.note ?? '', /does not meet your insurance minimum/);
    } else {
      assert.match(step.note ?? '', /\$300\.00/);
      assert.doesNotMatch(step.note ?? '', /does not meet/);
    }
  }
});

test('mixed purchases melt only for the standard offer, not the warbond price', () => {
  const plan = createPlan(
    input({
      pledges: [pledge(), pledge({ id: 'unused' })],
      tradeIn: ['pledge', 'unused'],
      credit: 2000,
      want: [
        { shipId: 2, minInsurance: 'any' },
        { shipId: 3, minInsurance: 'any' },
      ],
      offers: {
        fetchedAt: '2026-10-17T10:00:00Z',
        standalone: [
          offer({ skuId: 'wb', warbond: true }),
          offer({ skuId: 'standard', shipId: 3, price: 6000 }),
        ],
      },
    }),
  );

  assert.deepEqual(plan.steps, [
    { kind: 'melt', pledgeId: 'pledge', credit: 5000 },
    {
      kind: 'buy-standalone',
      skuId: 'wb',
      shipId: 2,
      credit: 0,
      newMoney: 10000,
    },
    {
      kind: 'buy-standalone',
      skuId: 'standard',
      shipId: 3,
      credit: 6000,
      newMoney: 0,
    },
  ]);
  assert.deepEqual(plan.totals, {
    newMoney: 10000,
    creditUsed: 6000,
    creditLeft: 1000,
  });
});

test('melts only enough pledges to fund the selected standard purchases', () => {
  const plan = createPlan(
    input({
      pledges: [
        pledge({ id: 'smaller', meltValue: 17000 }),
        pledge({ id: 'larger', meltValue: 29000 }),
      ],
      tradeIn: ['smaller', 'larger'],
      credit: 1000,
      offers: {
        fetchedAt: '2026-10-17T10:00:00Z',
        standalone: [offer({ price: 25000 })],
      },
    }),
  );

  assert.deepEqual(plan.steps, [
    { kind: 'melt', pledgeId: 'larger', credit: 29000 },
    {
      kind: 'buy-standalone',
      skuId: 'standard',
      shipId: 2,
      credit: 25000,
      newMoney: 0,
    },
  ]);
  assert.deepEqual(plan.totals, {
    newMoney: 0,
    creditUsed: 25000,
    creditLeft: 5000,
  });
});

test('does not melt when existing credit suffices, no wants exist, or no wants can be met', () => {
  for (const changes of [
    { credit: 10000 },
    { want: [] },
    { offers: { standalone: [], fetchedAt: '2026-10-17T10:00:00Z' } },
    { funding: 'credit-only' as const },
  ]) {
    const plan = createPlan(
      input({ pledges: [pledge()], tradeIn: ['pledge'], ...changes }),
    );

    assert.equal(
      plan.steps.some((step) => step.kind === 'melt'),
      false,
    );
    assert.equal(plan.totals.creditLeft, 0);
  }
});

test('includes standing warnings and the exact fetch times without mutating inputs', () => {
  const options = input();
  const original = structuredClone(options);
  const plan = createPlan(options);
  const warnings = plan.warnings.join('\n');

  for (const text of [
    'MFA',
    '24 hours',
    'before tax',
    'New money is taxed',
    'cannot be gifted',
    options.offers.fetchedAt,
    options.creditFetchedAt,
    'change or sell out',
  ]) {
    assert.ok(warnings.includes(text), text);
  }

  assert.deepEqual(options, original);
  assert.deepEqual(createPlan(input({ want: [] })).totals, {
    newMoney: 0,
    creditUsed: 0,
    creditLeft: 0,
  });
});
