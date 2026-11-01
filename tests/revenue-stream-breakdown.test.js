// SISP-164: 4-Stream Monthly Collection Breakdown. Pure-builder tests on
// synthetic data only. The partition must satisfy, for every month:
//   current + arrears + kist + fees + other == total
//   total == Σ non-voided payment amounts dated in the month
//            + connection fees recorded for that join month.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRevenueStreamBreakdown, revenueStreamCardHtml } from '../revenue-stream-breakdown.js';
import { TRANSLATIONS } from '../nav-language.js';

const payment = (id, overrides) => ({ id, date: '2026-10-06', amount: 0, method: 'Cash', ...overrides });
const bill = (month, overrides) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending',
  payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z', amountHistory: [],
  ...overrides
});
const customer = (id, bills, overrides = {}) => ({
  id, customerNumber: 7, name: `Synthetic ${id}`, archived: false, billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  installmentPlans: [], bills, ...overrides
});
const plan = (overrides) => ({
  id: 'plan-1', itemTitle: 'Tenda F3 Router', totalAmount: 3000, downPayment: 0,
  monthlyKist: 1000, totalMonths: 3, monthsBilled: 1, monthsPaid: 0, startDate: null, ...overrides
});
const kistLine = (overrides) => ({
  planId: 'plan-1', installmentNumber: 1, totalMonths: 3, amount: 1000, itemTitle: 'Tenda F3 Router', ...overrides
});
const identity = (data) => {
  assert.equal(
    data.currentCents + data.arrearsCents + data.kistCents + data.feesCents + data.otherCents,
    data.totalCents,
    'streams + other must equal the total exactly'
  );
  assert.equal(data.feesCents, data.shiftingCents + data.connectionCents);
};

test('SISP-164 spec pin: FIFO arrear-first — Sep arrears 3,000 + Oct bill 3,000, pays 4,500 in Oct', () => {
  const state = { customers: [customer('c1', [
    bill('2026-09'),
    bill('2026-10', { payments: [payment('p1', { amount: 4500 })] })
  ])] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.arrearsCents, 300000);
  assert.equal(data.currentCents, 150000);
  assert.equal(data.kistCents, 0);
  assert.equal(data.feesCents, 0);
  assert.equal(data.otherCents, 0);
  assert.equal(data.totalCents, 450000);
  assert.equal(data.paymentCount, 1);
  identity(data);
});

test('SISP-164: a kist-carrying payment splits its kist portion to stream 3', () => {
  const state = { customers: [customer('c1', [
    bill('2026-10', { dueAmount: 4000, kistLines: [kistLine()], kistTotal: 1000, payments: [payment('p1', { amount: 4000 })] })
  ], { installmentPlans: [plan()] })] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.currentCents, 300000);
  assert.equal(data.kistCents, 100000);
  assert.equal(data.totalCents, 400000);
  identity(data);
});

test('SISP-164: Prioritize Kist First toggle — kist bucket fills before package', () => {
  const state = { customers: [customer('c1', [
    bill('2026-10', { dueAmount: 4000, kistLines: [kistLine()], kistTotal: 1000, payments: [payment('p1', { amount: 3500, fifoPrioritizeKistFirst: true })] })
  ], { installmentPlans: [plan()] })] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.kistCents, 100000);
  assert.equal(data.currentCents, 250000);
  identity(data);
});

test('SISP-164: a recorded connection fee lands in stream 4 for its join month only', () => {
  const state = { customers: [
    customer('c1', [bill('2026-10')], { addedOn: '2026-10-02', connectionFee: 1500 }),
    customer('c2', [bill('2026-09')], { addedOn: '2026-09-02', connectionFee: 2000 })
  ] };
  const oct = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(oct.connectionCents, 150000);
  assert.equal(oct.feesCents, 150000);
  assert.equal(oct.totalCents, 150000);
  assert.equal(oct.paymentCount, 0);
  identity(oct);
  const sep = buildRevenueStreamBreakdown(state, '2026-09');
  assert.equal(sep.connectionCents, 200000);
  identity(sep);
});

test('SISP-164: a shifting fee on the origin bill lands in stream 4', () => {
  const state = { customers: [customer('c1', [
    bill('2026-10', { shiftingFee: 500, payments: [payment('p1', { amount: 3500 })] })
  ])] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.currentCents, 300000);
  assert.equal(data.shiftingCents, 50000);
  assert.equal(data.feesCents, 50000);
  assert.equal(data.otherCents, 0);
  assert.equal(data.totalCents, 350000);
  identity(data);
});

test('SISP-164: shifting coverage is capped across payments; the rest falls to Other', () => {
  const state = { customers: [customer('c1', [
    bill('2026-10', { shiftingFee: 500, payments: [payment('p1', { amount: 3200 }), payment('p2', { amount: 1000, date: '2026-10-20' })] })
  ])] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.currentCents, 300000);
  assert.equal(data.shiftingCents, 50000);
  assert.equal(data.otherCents, 70000);
  assert.equal(data.totalCents, 420000);
  identity(data);
});

test('SISP-164: a voided payment vanishes from every stream (and does not eat the FIFO buckets)', () => {
  const state = { customers: [customer('c1', [
    bill('2026-09'),
    bill('2026-10', { payments: [
      payment('pv', { amount: 6000, voided: true, voidedAt: '2026-10-07T00:00:00.000Z' }),
      payment('p1', { amount: 4500 })
    ] })
  ])] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.arrearsCents, 300000);
  assert.equal(data.currentCents, 150000);
  assert.equal(data.totalCents, 450000);
  assert.equal(data.paymentCount, 1);
  identity(data);
});

test('SISP-164: ticket-charge portion lands in Other, never in stream 1', () => {
  const state = { customers: [customer('c1', [
    bill('2026-10', { payments: [payment('p1', { amount: 3500, ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }] })] })
  ])] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.currentCents, 300000);
  assert.equal(data.otherCents, 50000);
  assert.equal(data.totalCents, 350000);
  identity(data);
});

test('SISP-164: a payment dated in Sep settling Sep’s own bill is stream 1, not arrears', () => {
  const state = { customers: [customer('c1', [
    bill('2026-09', { payments: [payment('p1', { date: '2026-09-06', amount: 3000 })] }),
    bill('2026-10')
  ])] };
  const sep = buildRevenueStreamBreakdown(state, '2026-09');
  assert.equal(sep.currentCents, 300000);
  assert.equal(sep.arrearsCents, 0);
  identity(sep);
  const oct = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(oct.totalCents, 0);
  assert.equal(oct.paymentCount, 0);
  identity(oct);
});

test('SISP-164: a payment recorded on a prior month’s bill but collected this month is arrears recovery', () => {
  const state = { customers: [customer('c1', [
    bill('2026-09', { payments: [payment('p1', { date: '2026-10-06', amount: 3000 })] })
  ])] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.arrearsCents, 300000);
  assert.equal(data.currentCents, 0);
  identity(data);
});

test('SISP-164: discounts are not cash — a 2,500 cash + 500 discount payment streams only 2,500', () => {
  const state = { customers: [customer('c1', [
    bill('2026-10', { payments: [payment('p1', { amount: 2500, discount: 500 })] })
  ])] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.currentCents, 250000);
  assert.equal(data.totalCents, 250000);
  identity(data);
});

test('SISP-164: overpayment beyond all dues falls to Other as advance credit', () => {
  const state = { customers: [customer('c1', [
    bill('2026-10', { payments: [payment('p1', { amount: 5000 })] }),
    bill('2026-11')
  ])] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.currentCents, 300000);
  assert.equal(data.otherCents, 200000);
  assert.equal(data.totalCents, 500000);
  identity(data);
});

test('SISP-164: identity holds on a mixed fixture and shares are 1-decimal', () => {
  const state = { customers: [
    customer('c1', [bill('2026-09'), bill('2026-10', { payments: [payment('p1', { amount: 4500 })] })]),
    customer('c2', [bill('2026-10', { dueAmount: 4000, kistLines: [kistLine()], kistTotal: 1000, payments: [payment('p2', { amount: 4000 })] })], { installmentPlans: [plan()] }),
    customer('c3', [bill('2026-10', { shiftingFee: 500, payments: [payment('p3', { amount: 3500 })] })], { addedOn: '2026-10-03', connectionFee: 1500 }),
    customer('c4', [bill('2026-10', { payments: [payment('p4', { amount: 3500, ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }] })] })])
  ] };
  const data = buildRevenueStreamBreakdown(state, '2026-10');
  assert.equal(data.currentCents, 150000 + 300000 + 300000 + 300000);
  assert.equal(data.arrearsCents, 300000);
  assert.equal(data.kistCents, 100000);
  assert.equal(data.feesCents, 50000 + 150000);
  assert.equal(data.otherCents, 50000);
  assert.equal(data.totalCents, 450000 + 400000 + 350000 + 350000 + 150000);
  assert.equal(data.paymentCount, 4);
  identity(data);
  const shareSum = data.shares.current + data.shares.arrears + data.shares.kist + data.shares.fees + data.shares.other;
  assert.ok(Math.abs(shareSum - 100) <= 0.3, `shares should sum to ~100, got ${shareSum}`);
  for (const share of Object.values(data.shares)) {
    assert.equal(Math.round(share * 10) / 10, share, 'shares carry at most 1 decimal');
  }
});

test('SISP-164: a zero month is honest zeros', () => {
  const state = { customers: [customer('c1', [bill('2026-10', { payments: [payment('p1', { amount: 3000 })] })])] };
  const data = buildRevenueStreamBreakdown(state, '2026-08');
  assert.deepEqual(
    [data.currentCents, data.arrearsCents, data.kistCents, data.feesCents, data.otherCents, data.totalCents, data.paymentCount],
    [0, 0, 0, 0, 0, 0, 0]
  );
  assert.deepEqual(Object.values(data.shares), [0, 0, 0, 0, 0]);
  identity(data);
});

test('SISP-164: builder is pure — state is byte-identical after the run', () => {
  const state = { customers: [customer('c1', [
    bill('2026-09'),
    bill('2026-10', { shiftingFee: 500, payments: [payment('p1', { amount: 4500 }), payment('pv', { amount: 900, voided: true })] })
  ], { addedOn: '2026-10-02', connectionFee: 1500 })] };
  const before = JSON.stringify(state);
  buildRevenueStreamBreakdown(state, '2026-10');
  revenueStreamCardHtml(state, '2026-10', 'en');
  assert.equal(JSON.stringify(state), before);
});

test('SISP-164: every revstream_* key exists in en + ur and the card renders no raw keys', () => {
  const keys = ['revstream_title', 'revstream_current', 'revstream_arrears', 'revstream_kist', 'revstream_fees', 'revstream_other', 'revstream_total'];
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `missing en ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur ${key}`);
  }
  const state = { customers: [customer('c1', [bill('2026-10', { payments: [payment('p1', { amount: 3000 })] })])] };
  for (const lang of ['en', 'ur']) {
    const html = revenueStreamCardHtml(state, '2026-10', lang);
    assert.ok(!html.includes('revstream_'), `${lang} card leaked a raw key`);
    assert.ok(html.includes('PKR 3,000'), `${lang} card shows the formatted total`);
  }
});

test('SISP-164: card CSS uses theme tokens only (no hex in the revstream block)', () => {
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('.revstream-card'));
  assert.ok(block.length > 0, 'revstream CSS block exists');
  const section = block.slice(0, block.indexOf('/* SISP-', 1) > 0 ? block.indexOf('/* SISP-', 1) : block.length);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(section), 'revstream CSS must not introduce hex colours');
});
