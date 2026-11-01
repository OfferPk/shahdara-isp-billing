// SISP-169: Shop Settlement Lag & Volume Scorecard.
// Pure-function tests on synthetic data only (synthetic shop names via
// "Cash at <Name> shop" methods — no real shop is named in fixtures).
// Spec pins: settlement lag calculation (Oct 2 + Oct 5 settled Oct 9 →
// lags 7 + 4 → avg 5.5; same-day → 0) and the >7-day unsettled warning
// threshold (oldest 8 days → warning; exactly 7 → none).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildShopScorecard,
  renderShopScorecardHtml
} from '../shop-performance-analytics.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const customer = (id, number, name, bills) => ({ id, customerNumber: number, name, bills });
const bill = (month, payments) => ({ month, payments });
const payment = (id, overrides) => ({ id, date: '2026-10-06', amount: 0, method: 'Cash', ...overrides });
const settlement = (id, shop, date, amount, allocations) => ({
  id, shop, amount, date, note: '', createdAt: '', allocations
});
const alloc = (paymentId, date, amount) => ({
  customerId: 'c1', customerNumber: 11, customerName: 'Test Customer 11',
  billMonth: date.slice(0, 7), paymentId, date, amount
});

// 2026-10-16 12:00 PKT — "today" for every age computation below.
const REF = new Date('2026-10-16T07:00:00Z');

const shopRow = (card, shop) => card.shops.find((row) => row.shop === shop);

test('settlement lag: payments Oct 2 + Oct 5 handed over Oct 9 average 5.5 days', () => {
  const state = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [
        payment('p1', { date: '2026-10-02', amount: 3000, method: 'Cash at Alpha shop' }),
        payment('p2', { date: '2026-10-05', amount: 2000, method: 'Cash at Alpha shop' })
      ])
    ])]
  };
  const settlements = [
    settlement('stl-1', 'Alpha Shop', '2026-10-09', 5000, [
      alloc('p1', '2026-10-02', 3000),
      alloc('p2', '2026-10-05', 2000)
    ])
  ];
  const card = buildShopScorecard(state, settlements, '2026-10', REF);
  const alpha = shopRow(card, 'Alpha Shop');
  assert.ok(alpha, 'Alpha Shop row exists');
  assert.equal(alpha.avgSettlementLagDays, 5.5);
  assert.equal(alpha.lagSamples, 2);
  assert.equal(alpha.settlementsInMonth, 1);
});

test('settlement lag: same-day handover is 0; other-month handovers do not leak in', () => {
  const state = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [
        payment('p1', { date: '2026-10-03', amount: 1000, method: 'Cash at Beta shop' }),
        payment('p2', { date: '2026-10-04', amount: 1500, method: 'Cash at Gamma shop' })
      ])
    ])]
  };
  const settlements = [
    settlement('stl-b', 'Beta Shop', '2026-10-03', 1000, [alloc('p1', '2026-10-03', 1000)]),
    settlement('stl-g', 'Gamma Shop', '2026-11-02', 1500, [alloc('p2', '2026-10-04', 1500)])
  ];
  const oct = buildShopScorecard(state, settlements, '2026-10', REF);
  assert.equal(shopRow(oct, 'Beta Shop').avgSettlementLagDays, 0);
  assert.equal(shopRow(oct, 'Gamma Shop').avgSettlementLagDays, null);
  assert.equal(shopRow(oct, 'Gamma Shop').settlementsInMonth, 0);
  const nov = buildShopScorecard(state, settlements, '2026-11', REF);
  assert.equal(shopRow(nov, 'Gamma Shop').avgSettlementLagDays, 29);
  assert.equal(shopRow(nov, 'Gamma Shop').settlementsInMonth, 1);
});

test('settlement lag: a handover with no recorded allocations yields no average', () => {
  const state = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [payment('p1', { date: '2026-10-03', amount: 1000, method: 'Cash at Beta shop' })])
    ])]
  };
  const settlements = [settlement('stl-b', 'Beta Shop', '2026-10-10', 1000, [])];
  const card = buildShopScorecard(state, settlements, '2026-10', REF);
  const beta = shopRow(card, 'Beta Shop');
  assert.equal(beta.settlementsInMonth, 1);
  assert.equal(beta.lagSamples, 0);
  assert.equal(beta.avgSettlementLagDays, null);
});

test('collected + share: two-shop month math, other months excluded, zero month shares null', () => {
  const state = {
    customers: [
      customer('c1', 11, 'Test Customer 11', [
        bill('2026-09', [payment('p0', { date: '2026-09-12', amount: 9000, method: 'Cash at Alpha shop' })]),
        bill('2026-10', [
          payment('p1', { date: '2026-10-02', amount: 3000, method: 'Cash at Alpha shop' }),
          payment('p2', { date: '2026-10-20', amount: 3000, method: 'Cash at Alpha shop' })
        ])
      ]),
      customer('c2', 9, 'Test Customer 09', [
        bill('2026-10', [payment('p3', { date: '2026-10-08', amount: 4000, method: 'Cash at Beta shop' })])
      ])
    ]
  };
  const oct = buildShopScorecard(state, [], '2026-10', REF);
  assert.equal(oct.totalCollected, 10000);
  assert.equal(shopRow(oct, 'Alpha Shop').collected, 6000);
  assert.equal(shopRow(oct, 'Alpha Shop').sharePct, 60);
  assert.equal(shopRow(oct, 'Beta Shop').collected, 4000);
  assert.equal(shopRow(oct, 'Beta Shop').sharePct, 40);

  const sep = buildShopScorecard(state, [], '2026-09', REF);
  assert.equal(shopRow(sep, 'Alpha Shop').collected, 9000);
  assert.equal(shopRow(sep, 'Alpha Shop').sharePct, 100);
  assert.equal(shopRow(sep, 'Beta Shop').sharePct, 0);

  const aug = buildShopScorecard(state, [], '2026-08', REF);
  assert.equal(aug.totalCollected, 0);
  assert.equal(shopRow(aug, 'Alpha Shop').sharePct, null);
});

test('voided shop payments are excluded from collected and unsettled', () => {
  const state = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [
        payment('p1', { date: '2026-10-02', amount: 2000, method: 'Cash at Alpha shop' }),
        payment('p2', { date: '2026-10-03', amount: 7000, method: 'Cash at Alpha shop', voided: true })
      ])
    ])]
  };
  const card = buildShopScorecard(state, [], '2026-10', REF);
  const alpha = shopRow(card, 'Alpha Shop');
  assert.equal(alpha.collected, 2000);
  assert.equal(alpha.unsettled, 2000);
});

test('unsettled reuses buildShopSummaries: a partial handover leaves the exact remainder', () => {
  const state = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [
        payment('p1', { date: '2026-10-02', amount: 3000, method: 'Cash at Alpha shop', shopSettledAmount: 1000 })
      ])
    ])]
  };
  const card = buildShopScorecard(state, [], '2026-10', REF);
  assert.equal(shopRow(card, 'Alpha Shop').unsettled, 2000);
});

test('warning threshold: oldest unsettled 8 days warns, exactly 7 does not, none unsettled is null', () => {
  const state = {
    customers: [
      customer('c1', 11, 'Test Customer 11', [
        bill('2026-10', [
          // Fully settled old receipt must not become the "oldest unsettled".
          payment('p0', { date: '2026-09-01', amount: 1000, method: 'Cash at Alpha shop', shopSettled: true }),
          payment('p1', { date: '2026-10-08', amount: 3000, method: 'Cash at Alpha shop' })
        ])
      ]),
      customer('c2', 9, 'Test Customer 09', [
        bill('2026-10', [payment('p2', { date: '2026-10-09', amount: 2000, method: 'Cash at Beta shop' })])
      ]),
      customer('c3', 73, 'Test Customer 73', [
        bill('2026-10', [payment('p3', { date: '2026-10-01', amount: 500, method: 'Cash at Gamma shop', shopSettled: true })])
      ])
    ]
  };
  const card = buildShopScorecard(state, [], '2026-10', REF);
  const alpha = shopRow(card, 'Alpha Shop');
  assert.equal(alpha.oldestUnsettledDate, '2026-10-08');
  assert.equal(alpha.oldestUnsettledDays, 8);
  assert.equal(alpha.unsettledWarning, true);
  const beta = shopRow(card, 'Beta Shop');
  assert.equal(beta.oldestUnsettledDays, 7);
  assert.equal(beta.unsettledWarning, false);
  const gamma = shopRow(card, 'Gamma Shop');
  assert.equal(gamma.oldestUnsettledDays, null);
  assert.equal(gamma.unsettledWarning, false);
});

test('a shop with settlements but no collections still gets a row with a lag', () => {
  const state = { customers: [] };
  const settlements = [
    settlement('stl-d', 'Delta Shop', '2026-10-10', 1500, [alloc('px', '2026-10-04', 1500)])
  ];
  const card = buildShopScorecard(state, settlements, '2026-10', REF);
  const delta = shopRow(card, 'Delta Shop');
  assert.ok(delta, 'Delta Shop row exists from its settlement record alone');
  assert.equal(delta.collected, 0);
  assert.equal(delta.unsettled, 0);
  assert.equal(delta.avgSettlementLagDays, 6);
});

test('shop set is derived from recorded data — a synthetic fourth shop appears', () => {
  const state = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [payment('p1', { date: '2026-10-05', amount: 1200, method: 'Cash at Gamma shop' })])
    ])]
  };
  const card = buildShopScorecard(state, [], '2026-10', REF);
  assert.deepEqual(card.shops.map((row) => row.shop), ['Gamma Shop']);
});

test('the analytics module itself names no shop (no hardcoded collectors)', () => {
  const source = readFileSync(new URL('../shop-performance-analytics.js', import.meta.url), 'utf8');
  assert.ok(!/Waseem|Hassan|Balla/.test(source), 'module source must not name any real shop');
});

test('build + render are read-only: state and settlements are byte-identical afterwards', () => {
  const state = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [payment('p1', { date: '2026-10-02', amount: 3000, method: 'Cash at Alpha shop' })])
    ])]
  };
  const settlements = [
    settlement('stl-1', 'Alpha Shop', '2026-10-09', 3000, [alloc('p1', '2026-10-02', 3000)])
  ];
  const beforeState = JSON.stringify(state);
  const beforeSettlements = JSON.stringify(settlements);
  const card = buildShopScorecard(state, settlements, '2026-10', REF);
  renderShopScorecardHtml(card, 'en');
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(JSON.stringify(settlements), beforeSettlements);
});

test('invalid month falls back to the reference month; empty data renders the empty state', () => {
  const card = buildShopScorecard({ customers: [] }, [], 'bogus', REF);
  assert.equal(card.month, '2026-10');
  assert.deepEqual(card.shops, []);
  const html = renderShopScorecardHtml(card, 'en');
  assert.ok(html.includes('No shop collections or settlements recorded yet.'));
  assert.ok(!html.includes('shopscore_'), 'no raw i18n keys in the empty render');
});

test('render: figures, warning marker and placeholders — en and ur, zero raw keys', () => {
  const state = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [
        // p1 carries the stamps applySettlement writes; p2 is still pending.
        payment('p1', { date: '2026-10-02', amount: 3000, method: 'Cash at Alpha shop', shopSettledAmount: 3000, shopSettled: true, settlementIds: ['stl-1'] }),
        payment('p2', { date: '2026-10-05', amount: 3000, method: 'Cash at Alpha shop' })
      ])
    ])]
  };
  const settlements = [
    settlement('stl-1', 'Alpha Shop', '2026-10-09', 3000, [alloc('p1', '2026-10-02', 3000)])
  ];
  const card = buildShopScorecard(state, settlements, '2026-10', REF);
  const en = renderShopScorecardHtml(card, 'en');
  assert.ok(en.includes('Alpha Shop'), 'shop name renders verbatim');
  assert.ok(en.includes('PKR 6,000'), 'collected renders via PKR formatting');
  assert.ok(en.includes('100%'), 'sole shop takes the full share');
  assert.ok(en.includes('11 days'), 'oldest unsettled is the pending Oct 5 receipt (11 days at Oct 16)');
  assert.ok(en.includes('7 days'), 'lag of the Oct 9 handover over the Oct 2 receipt is 7 days');
  assert.ok(en.includes('⚠️'), 'oldest unsettled over 7 days warns');
  assert.ok(!en.includes('shopscore_'), 'no raw keys (en)');
  const ur = renderShopScorecardHtml(card, 'ur');
  assert.ok(ur.includes('دکان سکور کارڈ'), 'Urdu title renders');
  assert.ok(ur.includes('Alpha Shop'), 'shop name stays verbatim in Urdu render');
  assert.ok(!ur.includes('shopscore_'), 'no raw keys (ur)');
});

test('i18n: every shopscore key exists in en + ur with matching placeholders, none renders raw', () => {
  const source = readFileSync(new URL('../shop-performance-analytics.js', import.meta.url), 'utf8');
  const keys = [...new Set([...source.matchAll(/t\('([a-z0-9_]+)'/g)].map((m) => m[1]))];
  assert.ok(keys.length >= 9, `expected at least 9 audited keys, found ${keys.length}`);
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur key ${key}`);
    const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder parity ${key}`);
    assert.notEqual(t(key, 'en', { count: 5 }), key, `${key} renders raw in en`);
    assert.notEqual(t(key, 'ur', { count: 5 }), key, `${key} renders raw in ur`);
  }
});

test('owner khata modal wires the scorecard into its render for the selected month', () => {
  const source = readFileSync(new URL('../owner-khata.js', import.meta.url), 'utf8');
  assert.ok(source.includes("from './shop-performance-analytics.js'"), 'owner-khata imports the module');
  assert.ok(
    source.includes('renderShopScorecardHtml(buildShopScorecard(getState(), loadShopSettlements(), month))'),
    'render() builds + renders the scorecard with the modal month and stored settlements'
  );
});
