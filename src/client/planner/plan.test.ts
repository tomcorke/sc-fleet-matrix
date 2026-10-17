import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { Pledge } from '../hangar/hangar.ts';
import type { StandaloneOffer } from '../store/store-offers.ts';
import { type UpgradeData, parseUpgradeData } from '../store/upgrade-data.ts';
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

const upgrades = (changes: Partial<UpgradeData> = {}): UpgradeData => ({
  sources: [{ shipId: 1, msrp: 5000 }],
  targets: [
    {
      shipId: 2,
      msrp: 10000,
      skus: [
        { skuId: 'upgrade', price: 10000, warbond: false, available: true },
      ],
    },
  ],
  fetchedAt: '2026-10-17T10:02:00Z',
  ...changes,
});

const input = (changes: Partial<PlanInput> = {}): PlanInput => ({
  pledges: [],
  tradeIn: [],
  want: [{ shipId: 2, minInsurance: 'any' }],
  offers: { standalone: [offer()], fetchedAt: '2026-10-17T10:00:00Z' },
  upgrades: upgrades({ sources: [], targets: [] }),
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
    options.upgrades.fetchedAt,
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

test('reuses an LTI trade-in with an exact-source standard upgrade instead of melting it', () => {
  const options = input({
    pledges: [
      pledge({
        insurance: 'lti',
        containsGamePackage: true,
        hasAppliedUpgrades: true,
        name: 'Original starter',
      }),
    ],
    tradeIn: ['pledge'],
    want: [{ shipId: 2, minInsurance: 'lti' }],
    upgrades: upgrades(),
    credit: 2000,
  });
  const original = structuredClone(options);
  const plan = createPlan(options);

  assert.deepEqual(plan.steps, [
    {
      kind: 'buy-upgrade',
      pledgeId: 'pledge',
      skuId: 'upgrade',
      fromShipId: 1,
      toShipId: 2,
      warbond: false,
      credit: 2000,
      newMoney: 3000,
    },
    {
      kind: 'apply-upgrade',
      pledgeId: 'pledge',
      fromShipId: 1,
      toShipId: 2,
      warbond: false,
    },
  ]);
  assert.deepEqual(plan.unmet, []);
  assert.deepEqual(plan.totals, {
    newMoney: 3000,
    creditUsed: 2000,
    creditLeft: 0,
  });
  assert.deepEqual(options, original);
});

test('compares upgrades with melt-and-buy in both directions', () => {
  const options = input({
    pledges: [pledge({ meltValue: 1000 })],
    tradeIn: ['pledge'],
    upgrades: upgrades(),
  });
  const upgrade = createPlan(options);
  const buy = createPlan({
    ...options,
    pledges: [pledge({ meltValue: 9000 })],
  });

  assert.deepEqual(
    upgrade.steps.map((step) => step.kind),
    ['buy-upgrade', 'apply-upgrade'],
  );
  assert.equal(upgrade.totals.newMoney, 5000);
  assert.deepEqual(
    buy.steps.map((step) => step.kind),
    ['melt', 'buy-standalone'],
  );
  assert.equal(buy.totals.newMoney, 1000);
});

test('prefers the cheaper upgrade when both routes need no new money', () => {
  for (const funding of [
    'least-new-money',
    'lowest-total',
    'credit-only',
  ] as const) {
    const plan = createPlan(
      input({
        pledges: [pledge()],
        tradeIn: ['pledge'],
        upgrades: upgrades(),
        credit: 10000,
        funding,
      }),
    );

    assert.deepEqual(
      plan.steps.map((step) => step.kind),
      ['buy-upgrade', 'apply-upgrade'],
    );
    assert.deepEqual(plan.totals, {
      newMoney: 0,
      creditUsed: 5000,
      creditLeft: 5000,
    });
  }
});

test('refuses equal-value ships, downgrades, unknown sources, variants and Keep pledges', () => {
  for (const changes of [
    { upgrades: upgrades({ sources: [{ shipId: 1, msrp: 10000 }] }) },
    { upgrades: upgrades({ sources: [{ shipId: 1, msrp: 11000 }] }) },
    { upgrades: upgrades({ sources: [] }) },
    { pledges: [pledge({ ships: [{ name: 'Aurora variant', shipId: 3 }] })] },
    { pledges: [pledge({ ships: [{ name: 'Aurora', shipId: null }] })] },
    { tradeIn: [] },
  ]) {
    const plan = createPlan(
      input({
        pledges: [pledge()],
        tradeIn: ['pledge'],
        offers: { standalone: [], fetchedAt: '2026-10-17T10:00:00Z' },
        upgrades: upgrades(),
        ...changes,
      }),
    );

    assert.deepEqual(plan.steps, []);
    assert.equal(plan.unmet.length, 1);
  }
});

test('refuses an upgrade target or SKU that is not on sale', () => {
  for (const targets of [
    [],
    [
      {
        shipId: 2,
        msrp: 10000,
        skus: [
          { skuId: 'sold-out', price: 10000, warbond: false, available: false },
        ],
      },
    ],
  ]) {
    const plan = createPlan(
      input({
        pledges: [pledge()],
        tradeIn: ['pledge'],
        offers: { standalone: [], fetchedAt: '2026-10-17T10:00:00Z' },
        upgrades: upgrades({ targets }),
      }),
    );

    assert.deepEqual(plan.steps, []);
    assert.match(plan.unmet[0].reason, /Not on sale/);
  }
});

test('multi-ship pledges stay melt-only even when their ships are valid upgrade sources', () => {
  const plan = createPlan(
    input({
      pledges: [
        pledge({
          ships: [
            { name: 'Aurora', shipId: 1 },
            { name: 'Other', shipId: 3 },
          ],
        }),
      ],
      tradeIn: ['pledge'],
      upgrades: upgrades(),
    }),
  );

  assert.deepEqual(
    plan.steps.map((step) => step.kind),
    ['melt', 'buy-standalone'],
  );
});

test('warbond upgrades need new money, not credit, and are excluded in credit-only mode', () => {
  const options = input({
    pledges: [pledge({ insurance: 'lti' })],
    tradeIn: ['pledge'],
    credit: 20000,
    want: [{ shipId: 2, minInsurance: 'lti' }],
    upgrades: upgrades({
      targets: [
        {
          shipId: 2,
          msrp: 10000,
          skus: [
            {
              skuId: 'wb-upgrade',
              price: 8000,
              warbond: true,
              available: true,
            },
          ],
        },
      ],
    }),
  });
  const plan = createPlan(options);
  const creditOnly = createPlan({ ...options, funding: 'credit-only' });

  assert.equal(plan.steps[0].kind, 'buy-upgrade');
  assert.deepEqual(plan.totals, {
    newMoney: 3000,
    creditUsed: 0,
    creditLeft: 20000,
  });
  assert.deepEqual(creditOnly.steps, []);
  assert.match(creditOnly.unmet[0].reason, /LTI needs new money/);
});

test('uses MSRP for standard upgrades and refuses zero or negative warbond differences', () => {
  const options = input({
    pledges: [pledge()],
    tradeIn: ['pledge'],
    upgrades: upgrades({
      targets: [
        {
          shipId: 2,
          msrp: 10000,
          skus: [
            { skuId: 'upgrade', price: 8000, warbond: false, available: true },
          ],
        },
      ],
    }),
  });

  assert.equal(createPlan(options).totals.newMoney, 5000);

  for (const price of [4000, 5000]) {
    const plan = createPlan({
      ...options,
      offers: { ...options.offers, standalone: [] },
      upgrades: upgrades({
        targets: [
          {
            shipId: 2,
            msrp: 10000,
            skus: [
              { skuId: 'wb-upgrade', price, warbond: true, available: true },
            ],
          },
        ],
      }),
    });

    assert.deepEqual(plan.steps, []);
    assert.equal(plan.unmet.length, 1);
  }
});

test('cannot meet an insurance minimum by upgrading an underinsured pledge', () => {
  for (const insurance of [null, 6, 120]) {
    const plan = createPlan(
      input({
        pledges: [pledge({ insurance })],
        tradeIn: ['pledge'],
        upgrades: upgrades(),
        want: [{ shipId: 2, minInsurance: 'lti' }],
      }),
    );

    assert.deepEqual(plan.steps, []);
    assert.match(plan.unmet[0].reason, /LTI/);
  }
});

test('uses each trade-in once and orders melts, purchases, then applies', () => {
  const options = input({
    pledges: [
      pledge({ insurance: 'lti' }),
      pledge({ id: 'funding', ships: [] }),
    ],
    tradeIn: ['pledge', 'funding'],
    want: [
      { shipId: 2, minInsurance: 'lti' },
      { shipId: 2, minInsurance: 'lti' },
    ],
    upgrades: upgrades(),
  });
  const plan = createPlan(options);

  assert.deepEqual(
    plan.steps.map((step) => step.kind),
    ['melt', 'buy-upgrade', 'apply-upgrade'],
  );
  assert.deepEqual(plan.steps[0], {
    kind: 'melt',
    pledgeId: 'funding',
    credit: 5000,
  });
  assert.equal(plan.unmet.length, 1);
  assert.deepEqual(plan.totals, {
    newMoney: 0,
    creditUsed: 5000,
    creditLeft: 0,
  });
});

test('assigns scarce LTI pledges globally rather than consuming them for any-insurance wants', () => {
  const plan = createPlan(
    input({
      pledges: [pledge({ insurance: 'lti' }), pledge({ id: 'six-month' })],
      tradeIn: ['pledge', 'six-month'],
      want: [
        { shipId: 2, minInsurance: 'any' },
        { shipId: 2, minInsurance: 'lti' },
      ],
      upgrades: upgrades(),
    }),
  );

  assert.deepEqual(plan.unmet, []);
  assert.deepEqual(
    plan.steps
      .filter((step) => step.kind === 'apply-upgrade')
      .map((step) => step.pledgeId),
    ['six-month', 'pledge'],
  );
  assert.equal(
    plan.steps.some((step) => step.kind === 'melt'),
    false,
  );
  assert.equal(plan.totals.newMoney, 10000);
});

const chainInput = (): PlanInput =>
  input({
    pledges: [pledge({ insurance: 'lti' })],
    tradeIn: ['pledge'],
    want: [{ shipId: 2, minInsurance: 'lti' }],
    offers: { standalone: [], fetchedAt: '2026-10-17T10:00:00Z' },
    upgrades: upgrades({
      sources: [
        { shipId: 1, msrp: 5000 },
        { shipId: 3, msrp: 8000 },
        { shipId: 4, msrp: 9000 },
      ],
      targets: [
        ...upgrades().targets,
        {
          shipId: 4,
          msrp: 9000,
          skus: [
            { skuId: 'second-wb', price: 8500, warbond: true, available: true },
          ],
        },
        {
          shipId: 3,
          msrp: 8000,
          skus: [
            { skuId: 'first-wb', price: 6500, warbond: true, available: true },
          ],
        },
      ],
    }),
  });

test('warbond steps lower cost, follow increasing MSRP, and keep payment totals exact', () => {
  const options = chainInput();
  const plan = createPlan({ ...options, credit: 600, funding: 'lowest-total' });
  const purchases = plan.steps.filter((step) => step.kind === 'buy-upgrade');
  const applies = plan.steps.filter((step) => step.kind === 'apply-upgrade');

  assert.deepEqual(purchases, [
    {
      kind: 'buy-upgrade',
      pledgeId: 'pledge',
      skuId: 'first-wb',
      fromShipId: 1,
      toShipId: 3,
      warbond: true,
      credit: 0,
      newMoney: 1500,
    },
    {
      kind: 'buy-upgrade',
      pledgeId: 'pledge',
      skuId: 'second-wb',
      fromShipId: 3,
      toShipId: 4,
      warbond: true,
      credit: 0,
      newMoney: 500,
    },
    {
      kind: 'buy-upgrade',
      pledgeId: 'pledge',
      skuId: 'upgrade',
      fromShipId: 4,
      toShipId: 2,
      warbond: false,
      credit: 600,
      newMoney: 400,
    },
  ]);
  assert.deepEqual(
    applies.map((step) => [step.fromShipId, step.toShipId]),
    [
      [1, 3],
      [3, 4],
      [4, 2],
    ],
  );
  assert.deepEqual(
    plan.steps.map((step) => step.kind),
    [
      'buy-upgrade',
      'buy-upgrade',
      'buy-upgrade',
      'apply-upgrade',
      'apply-upgrade',
      'apply-upgrade',
    ],
  );
  assert.deepEqual(plan.totals, {
    newMoney: 2400,
    creditUsed: 600,
    creditLeft: 0,
  });
  assert.equal(
    purchases.reduce((sum, step) => sum + step.credit + step.newMoney, 0),
    3000,
  );
  const direct = createPlan({ ...options, upgrades: upgrades() });

  assert.ok(
    plan.totals.newMoney + plan.totals.creditUsed < direct.totals.newMoney,
  );
  assert.deepEqual(plan.unmet, []);
});

test('keeps direct standard routes when they need less new money than a discounted chain', () => {
  const options = { ...chainInput(), credit: 20000 };
  const leastNewMoney = createPlan(options);
  const lowestTotal = createPlan({ ...options, funding: 'lowest-total' });
  const creditOnly = createPlan({ ...options, funding: 'credit-only' });

  for (const plan of [leastNewMoney, creditOnly]) {
    assert.equal(plan.steps.length, 2);
    assert.deepEqual(plan.totals, {
      newMoney: 0,
      creditUsed: 5000,
      creditLeft: 15000,
    });
  }

  assert.deepEqual(lowestTotal.totals, {
    newMoney: 2000,
    creditUsed: 1000,
    creditLeft: 19000,
  });
  assert.equal(lowestTotal.steps.length, 6);
});

test('melts other trade-ins before funding the standard part of a chain, never the upgraded pledge', () => {
  const options = chainInput();
  const plan = createPlan({
    ...options,
    pledges: [
      ...options.pledges,
      pledge({ id: 'funding', ships: [], meltValue: 1500 }),
    ],
    tradeIn: ['pledge', 'funding'],
  });

  assert.deepEqual(plan.steps[0], {
    kind: 'melt',
    pledgeId: 'funding',
    credit: 1500,
  });
  assert.deepEqual(plan.totals, {
    newMoney: 2000,
    creditUsed: 1000,
    creditLeft: 500,
  });
});

test('refuses unavailable, invalid-source and non-positive-price intermediate steps', () => {
  const options = chainInput();

  for (const upgrades of [
    {
      ...options.upgrades,
      sources: options.upgrades.sources.filter((source) => source.shipId === 1),
    },
    {
      ...options.upgrades,
      targets: options.upgrades.targets.map((target) => ({
        ...target,
        skus: target.skus.map((sku) => ({ ...sku, available: !sku.warbond })),
      })),
    },
    {
      ...options.upgrades,
      targets: options.upgrades.targets.map((target) => ({
        ...target,
        skus: target.skus.map((sku) => ({
          ...sku,
          price: sku.warbond ? 5000 : sku.price,
        })),
      })),
    },
  ]) {
    const plan = createPlan({ ...options, upgrades, funding: 'lowest-total' });

    assert.equal(plan.steps.length, 2);
    assert.equal(plan.totals.newMoney, 5000);
  }
});

const baseInput = (): PlanInput =>
  input({
    want: [{ shipId: 2, minInsurance: 'lti' }],
    credit: 3000,
    offers: {
      fetchedAt: '2026-10-17T10:00:00Z',
      standalone: [
        offer(),
        offer({
          skuId: 'lti-base',
          shipId: 3,
          price: 2000,
          warbond: true,
          insurance: 'lti',
        }),
        offer({
          skuId: 'costlier-base',
          shipId: 3,
          price: 4000,
          warbond: true,
          insurance: 'lti',
        }),
      ],
    },
    upgrades: upgrades({ sources: [{ shipId: 3, msrp: 4000 }] }),
  });

test('buys a cheap LTI base and upgrades it rather than buying the wanted ship without LTI', () => {
  const options = baseInput();
  const original = structuredClone(options);
  const plan = createPlan(options);

  assert.deepEqual(plan.steps, [
    {
      kind: 'buy-standalone',
      skuId: 'lti-base',
      shipId: 3,
      pledgeId: 'new pledge 1',
      credit: 0,
      newMoney: 2000,
    },
    {
      kind: 'buy-upgrade',
      pledgeId: 'new pledge 1',
      skuId: 'upgrade',
      fromShipId: 3,
      toShipId: 2,
      warbond: false,
      credit: 3000,
      newMoney: 3000,
    },
    {
      kind: 'apply-upgrade',
      pledgeId: 'new pledge 1',
      fromShipId: 3,
      toShipId: 2,
      warbond: false,
    },
  ]);
  assert.deepEqual(plan.totals, {
    newMoney: 5000,
    creditUsed: 3000,
    creditLeft: 0,
  });
  assert.ok(
    plan.totals.newMoney + plan.totals.creditUsed <
      options.offers.standalone[0].price,
  );
  assert.deepEqual(plan.unmet, []);
  assert.deepEqual(options, original);
});

test('credit-only refuses warbond LTI bases even with enough credit for the full route', () => {
  const plan = createPlan({
    ...baseInput(),
    credit: 20000,
    funding: 'credit-only',
  });

  assert.deepEqual(plan.steps, []);
  assert.match(plan.unmet[0].reason, /LTI needs new money/);
  assert.deepEqual(plan.totals, {
    newMoney: 0,
    creditUsed: 0,
    creditLeft: 20000,
  });
});

test('standard insured bases can use credit, and each duplicate want gets its own new pledge', () => {
  const options = baseInput();
  const plan = createPlan({
    ...options,
    credit: 20000,
    funding: 'credit-only',
    want: [options.want[0], options.want[0]],
    offers: {
      ...options.offers,
      standalone: [{ ...options.offers.standalone[1], warbond: false }],
    },
  });

  assert.deepEqual(plan.unmet, []);
  assert.deepEqual(
    plan.steps
      .filter((step) => step.kind === 'apply-upgrade')
      .map((step) => step.pledgeId),
    ['new pledge 1', 'new pledge 2'],
  );
  assert.deepEqual(plan.totals, {
    newMoney: 0,
    creditUsed: 16000,
    creditLeft: 4000,
  });
});

test('new bases must be available, insured, lower-value valid upgrade sources', () => {
  const options = baseInput();

  for (const changes of [
    { available: false },
    { insurance: 120 },
    { insurance: null },
    { shipId: 4 },
  ]) {
    const plan = createPlan({
      ...options,
      offers: {
        ...options.offers,
        standalone: [{ ...options.offers.standalone[1], ...changes }],
      },
    });

    assert.deepEqual(plan.steps, []);
    assert.equal(plan.unmet.length, 1);
  }

  for (const msrp of [10000, 11000]) {
    const plan = createPlan({
      ...options,
      upgrades: upgrades({ sources: [{ shipId: 3, msrp }] }),
    });

    assert.deepEqual(plan.steps, []);
    assert.equal(plan.unmet.length, 1);
  }
});

test('a newly bought base can use a multi-step chain and meet a month-based minimum', () => {
  const options = chainInput();
  const plan = createPlan({
    ...options,
    pledges: [],
    tradeIn: [],
    want: [{ shipId: 2, minInsurance: 120 }],
    offers: {
      ...options.offers,
      standalone: [
        offer({
          skuId: 'insured-base',
          shipId: 1,
          price: 3000,
          warbond: true,
          insurance: 120,
        }),
      ],
    },
  });

  assert.deepEqual(plan.unmet, []);
  assert.deepEqual(
    plan.steps.map((step) => step.kind),
    [
      'buy-standalone',
      'buy-upgrade',
      'buy-upgrade',
      'buy-upgrade',
      'apply-upgrade',
      'apply-upgrade',
      'apply-upgrade',
    ],
  );
  assert.deepEqual(plan.totals, {
    newMoney: 6000,
    creditUsed: 0,
    creditLeft: 0,
  });
  assert.ok(
    plan.steps.every(
      (step) => 'pledgeId' in step && step.pledgeId === 'new pledge 1',
    ),
  );
});

test('recorded offers make Aurora Mk II to Sabre Raven EX to Centaurus cheaper than a direct upgrade', () => {
  const recorded = parseUpgradeData(
    JSON.parse(
      readFileSync(
        new URL('../store/fixtures/filter-ships.json', import.meta.url),
        'utf8',
      ),
    ),
    '2026-10-17T10:02:00Z',
  );
  const plan = createPlan(
    input({
      pledges: [
        pledge({
          ships: [{ name: 'Aurora Mk II', shipId: 312 }],
          insurance: 'lti',
        }),
      ],
      tradeIn: ['pledge'],
      want: [{ shipId: 325, minInsurance: 'lti' }],
      offers: { standalone: [], fetchedAt: '2026-10-17T10:00:00Z' },
      upgrades: recorded,
      funding: 'lowest-total',
    }),
  );

  assert.deepEqual(
    plan.steps
      .filter((step) => step.kind === 'buy-upgrade')
      .map((step) => [step.fromShipId, step.toShipId, step.newMoney]),
    [
      [312, 328, 12000],
      [328, 325, 9000],
    ],
  );
  assert.deepEqual(plan.totals, {
    newMoney: 21000,
    creditUsed: 0,
    creditLeft: 0,
  });
  assert.deepEqual(plan.unmet, []);
});
