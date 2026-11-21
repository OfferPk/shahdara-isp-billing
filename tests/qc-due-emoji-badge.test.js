// QC DUE-badge emoji — the DUE pill picks its emoji from how much of
// the customer's bill is still remaining (remainingDue / totalBill).
//
// Spec (user, 2026-11-21): 100% due (full bill unpaid, or total bill
// unavailable/0) => "⏰ DUE"; partial due (>20% and <100% remaining) =>
// "⏳ DUE"; small remainder (<=20% remaining, 80%+ paid) => "🤏 DUE".
// Settled customers show the SETTLED tag instead (the DUE badge never
// renders at 0% remaining), so the spec's silence on 0% needs no rule.
// The badge keeps its size and stays on one line next to the PKR amount
// at 360px (inline-flex + 4px gap + nowrap).
//
// The denominator is the OPEN bills only: totalBilled = Σ billAmountCents
// over bills with balanceDueCents > 0. A settled month never inflates it
// (B2 is the discriminator: Oct settled + Nov 700/3000 open => ⏳ at
// 23.3%; an all-bills denominator would give 11.7% => 🤏). The numerator
// is totalDues, the figure the badge shows; a ratio above 1 (bills +
// baqaya) clamps to ⏰. Missing/0 total => ⏰, never a crash.
//
// Harness: real core.js state + real addPayment for the single-bill
// cases, hand-built bills (plan524 pattern) for the multi-month case —
// updateCustomerProfile does NOT keep a passed billingStartMonth, so a
// second bill month cannot be generated that way.
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
// This file is NOT a pinning file: it carries no parity total.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, addPayment,
} from '../core.js';
import {
  getPendingCollectionCustomers, renderQuickCollectCustomerListHtml,
} from '../nav-quick-collect.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = new Date('2026-11-07T10:00:00Z');
const MONTH = '2026-11';

// One customer, one bill month. (generateMonthlyBills only prices from
// the customer's price-effective month — the profile update prices the
// current month, so a single-month fixture needs no start-month control.)
function dueState({ paid = null, payMonth = MONTH } = {}) {
  let state = createInitialState(['Due Emoji Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000,
  }, REF);
  state = generateMonthlyBillsThroughCurrentMonth(state, REF);
  if (paid !== null) {
    state = addPayment(state, 'seed-001', payMonth, {
      amount: paid, method: 'Cash', date: '2026-11-05',
    }, REF);
  }
  return state;
}

const poolOf = (state) => getPendingCollectionCustomers(state, '', 'all', REF);
const renderPool = (state) => renderQuickCollectCustomerListHtml(poolOf(state));
const badgeOf = (html) => {
  const at = html.indexOf('qc-due-tag');
  if (at < 0) return null;
  return html.slice(at, html.indexOf('</span>', at));
};
const ruleBlock = (src, selector) => {
  const at = src.indexOf(selector);
  if (at < 0) return '';
  return src.slice(at, src.indexOf('}', at));
};

test('C1: 100% due (full bill unpaid) shows ⏰ DUE', () => {
  const html = renderPool(dueState());
  assert.ok(html.includes('⏰ DUE'), 'the badge reads ⏰ DUE');
  assert.ok(!html.includes('⏳ DUE') && !html.includes('🤏 DUE'), 'no other emoji on the badge');
});

test('C2: partial due (50% remaining, half due) shows ⏳ DUE', () => {
  const html = renderPool(dueState({ paid: 1500 }));
  assert.ok(html.includes('⏳ DUE'), 'the badge reads ⏳ DUE');
});

test('C3: small remainder (exactly 20% remaining) shows 🤏 DUE', () => {
  const html = renderPool(dueState({ paid: 2400 }));
  assert.ok(html.includes('🤏 DUE'), '600 of 3000 remaining is exactly 20%, so the badge reads 🤏 DUE');
});

test('C4: just above 20% remaining shows ⏳ DUE, not 🤏', () => {
  const html = renderPool(dueState({ paid: 2399 }));
  assert.ok(html.includes('⏳ DUE'), '601 of 3000 remaining is 20.03%, so the badge reads ⏳ DUE');
});

test('C5: a plain fixture without a total-bill figure falls back to ⏰ DUE', () => {
  // Mirrors the qc-customer-list-no-crush fixture: the renderer is also
  // called with hand-built entries that carry no totalBilled — an
  // unavailable total is ⏰ by the spec, never a crash or a blank badge.
  const html = renderQuickCollectCustomerListHtml([{
    id: 'c-1', customerNumber: 1, name: 'Plain Fixture', area: 'BARRIAN',
    phone: '03012345678', totalDues: 1000,
  }], null);
  assert.ok(html.includes('⏰ DUE'), 'no total-bill figure means ⏰ DUE');
});

test('C6: baqaya-only (dues but no open bill, total 0) shows ⏰ DUE', () => {
  let state = createInitialState(['Baqaya Only Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000,
  }, REF);
  // No bills generated on purpose: only a manual baqaya record, so the
  // customer owes money but has no open bill to ratio against.
  state.customers[0].manualBaqaya = [
    { id: 'MBQ-1', amount: 1000, date: '2026-09-15', month: '2026-09', note: 'test' },
  ];
  const entry = poolOf(state)[0];
  assert.equal(entry.totalDues, 1000, 'the baqaya is the whole due');
  assert.equal(entry.totalBilled ?? 0, 0, 'no open bill means total billed 0');
  const html = renderQuickCollectCustomerListHtml(poolOf(state));
  assert.ok(html.includes('⏰ DUE'), 'total bill 0 means ⏰ DUE');
});

test('C7: the DUE badge stays compact — inline-flex, gap, nowrap, same size', () => {
  const styles = readFileSync(join(ROOT, 'styles.css'), 'utf8');
  const rule = ruleBlock(styles, '.qc-due-tag {');
  assert.ok(rule.includes('display: inline-flex'), 'the badge is inline-flex');
  assert.ok(rule.includes('align-items: center'), 'the badge centres its emoji + text');
  assert.ok(/gap:\s*4px/.test(rule), 'the badge keeps a 4px gap between emoji and text');
  assert.ok(rule.includes('white-space: nowrap'), 'emoji + DUE never split across lines');
  assert.ok(rule.includes('font-size: 0.69rem'), 'the shipped 0.69rem stays');
  assert.ok(rule.includes('padding: 1px 6px'), 'the shipped 1px 6px stays');
});

test('C8: the pool entry carries the total billed (unchanged by payment)', () => {
  const unpaid = poolOf(dueState())[0];
  assert.equal(unpaid.totalDues, 3000, 'unpaid: dues are the whole bill');
  assert.equal(unpaid.totalBilled, 3000, 'unpaid: total billed is the bill');
  const partial = poolOf(dueState({ paid: 1500 }))[0];
  assert.equal(partial.totalDues, 1500, 'partial: dues are what is left');
  assert.equal(partial.totalBilled, 3000, 'partial: total billed is still the whole bill');
});

test('S1: a settled customer still shows SETTLED, never a DUE badge', () => {
  const html = renderPool(dueState({ paid: 3000 }));
  assert.ok(html.includes('qc-settled-tag'), 'the settled tag renders');
  assert.ok(!html.includes('qc-due-tag'), 'no DUE badge at 0% remaining');
});

test('S2: the word DUE still appears on a dues card', () => {
  // plan524 pins mainHtml.includes('DUE') — the emoji is a prefix, the
  // word survives.
  const html = renderPool(dueState());
  assert.ok(html.includes('DUE'), 'the word DUE is still in the badge');
});

test('S3: the DUE pill keeps its size and its seat before the subtitle', () => {
  // qc-customer-list-no-crush D7 + quick-collect-polish G1, verbatim.
  const styles = readFileSync(join(ROOT, 'styles.css'), 'utf8');
  const rule = ruleBlock(styles, '.qc-due-tag {');
  assert.ok(rule.includes('font-size: 0.69rem'), 'the DUE pill stays 0.69rem');
  assert.ok(rule.includes('padding: 1px 6px'), 'the DUE pill stays 1px 6px');
  const html = renderQuickCollectCustomerListHtml([{
    id: 'c-1', customerNumber: 1, name: 'Fixture One', area: 'BARRIAN',
    phone: '03012345678', totalDues: 1000,
  }], null);
  assert.ok(html.includes('qc-due-tag'), 'a dues card renders the DUE pill');
  assert.ok(html.indexOf('qc-due-tag') < html.indexOf('qc-cust-meta'),
    'the DUE pill comes before the subtitle in DOM order (Row 1, then Row 2)');
});

test('B1: the emoji is per-card — two customers, two ratios, two badges', () => {
  let state = createInitialState(['First Tester', 'Second Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000, billingStartMonth: MONTH,
  }, REF);
  state = updateCustomerProfile(state, 'seed-002', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000, billingStartMonth: MONTH,
  }, REF);
  state = generateMonthlyBillsThroughCurrentMonth(state, REF);
  state = addPayment(state, 'seed-001', MONTH, { amount: 1500, method: 'Cash', date: '2026-11-05' }, REF);
  state = addPayment(state, 'seed-002', MONTH, { amount: 2400, method: 'Cash', date: '2026-11-05' }, REF);
  const html = renderPool(state);
  assert.ok(html.includes('⏳ DUE'), 'the half-paid card reads ⏳');
  assert.ok(html.includes('🤏 DUE'), 'the 80%-paid card reads 🤏');
  const firstAt = html.indexOf('First Tester');
  const secondAt = html.indexOf('Second Tester');
  assert.ok(firstAt > -1 && secondAt > -1, 'both cards render');
  assert.ok(badgeOf(html.slice(firstAt)).includes('⏳'), 'the first card carries ⏳');
  assert.ok(badgeOf(html.slice(secondAt)).includes('🤏'), 'the second card carries 🤏');
});

test('B2: the total is the OPEN bills only — a settled month never inflates it', () => {
  // October paid in full + November paid 2300 of 3000: remaining 700.
  // Open-bills total is 3000 (November only), so 700/3000 = 23.3% => ⏳.
  // If settled months counted, the total would be 6000 and 700/6000 =
  // 11.7% => 🤏 — the numeric assertion is the real discriminator.
  // Hand-built bills (plan524 pattern): generateMonthlyBills only prices
  // from the customer's price-effective month, so a second month needs a
  // literal bill — and its payment record is a plain {id, amount, date,
  // method} the allocation engine reads as-is (verified in prep).
  const bill = (month, dueAmount, dueDate, payments = []) =>
    ({ month, dueAmount, dueDate, status: 'pending', payments });
  const state = { customers: [{ id: 'seed-001', name: 'Two Bill Tester', customerNumber: 1, phone: '03012345678', mohalla: 'Mohalla Bani', area: 'Mohalla Bani', archived: false, addedOn: '2026-08-15', bills: [
    bill('2026-10', 3000, '2026-10-10', [{ id: 'p-oct', amount: 3000, date: '2026-10-15', method: 'Cash' }]),
    bill('2026-11', 3000, '2026-11-10', [{ id: 'p-nov', amount: 2300, date: '2026-11-05', method: 'Cash' }]),
  ] }] };
  const entry = poolOf(state)[0];
  assert.equal(entry.totalDues, 700, 'only November is still owed');
  assert.equal(entry.totalBilled, 3000, 'the settled October bill is not in the total');
  const html = renderPool(state);
  assert.ok(html.includes('⏳ DUE'), '700 of 3000 open is 23.3%, so the badge reads ⏳ DUE');
});
