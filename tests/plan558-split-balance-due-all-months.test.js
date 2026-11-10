// Plan 558 — Split "Balance Due" says it covers all months.
//
// buildSplitTenderReceipt sums balanceDueCents across *every* bill of
// the customer, while each leg's own receipt balance is per-bill
// through that payment. The combined receipt then printed that
// all-months total under the bare label "Balance Due"
// (t('split_balance_due')), so a customer who split-paid this month's
// bill in full but still owed an old month saw a "Balance Due" that
// contradicted both leg receipts, with no label explaining it covers
// all months.
//
// RELABEL ONLY — the figure stays the all-months total. The spec is
// explicit: do NOT scope the figure to the split's month (that changes
// what the balance means — a product decision, not polish). So the
// fix is the dictionary value of the one key both combined surfaces
// already read: EN "Total dues (all months)", UR "کل بقایا". The key
// is used at exactly two render sites (WhatsApp :482, HTML :536 in
// split-tender-collect.js), so the relabel reaches exactly the two
// combined surfaces and nothing else.
//
// OUT OF SCOPE (recorded, not fixed): the QC success-step card
// (renderSplitReceiptCardHtml) shows the same all-months figure under
// the hardcoded label "Remaining Balance" — that card is Plan 579's
// job, so its label stays untouched here.
//
// Pattern-fake data only: Test Customer, EP99887766.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveBillMonth } from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import {
  executeSplitTenderCollection, buildSplitTenderReceipt,
  formatSplitTenderWhatsAppText, generateSplitTenderReceiptHtml
} from '../split-tender-collect.js';
import { t } from '../nav-language.js';

const NOW = new Date('2026-10-29T12:00:00+05:00');
const MONTH = '2026-10';
const DATE = '2026-10-29';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const splitSrc = read('split-tender-collect.js');

// Two bills: an older September bill (PKR 2,000, unpaid) and the
// current October bill (1,000 package + 195 tax = 1,195 due). The
// split settles October in full: 1,000 Cash + 195 Easypaisa.
function multiMonthFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: [],
    monthlySellingAmount: 1000, packageSpeed: '3Mbps / 100GB'
  }] };
  s = saveBillMonth(s, 'a', { month: '2026-09', dueAmount: 2000, status: 'pending' }, NOW);
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 1195, packageId: '3mbps-100gb', salesTaxCents: 19500, status: 'pending' }, NOW);
  return s;
}
const multiMonthSpec = {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
  legs: [
    { amount: 1000, method: 'Cash' },
    { amount: 195, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
};

// A single-month split settled in full (the Plan 557 taxed shape):
// 1,000 package + 195 tax = 1,195 due, settled 1,000 Cash + 195
// Easypaisa. Nothing is owed afterwards.
function settledFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: [],
    monthlySellingAmount: 1000, packageSpeed: '3Mbps / 100GB'
  }] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 1195, packageId: '3mbps-100gb', salesTaxCents: 19500, status: 'pending' }, NOW);
  return s;
}
const settledSpec = multiMonthSpec;

const run = (state, spec) => executeSplitTenderCollection(state, spec, { execute: executeQuickCollection, referenceDate: NOW });

test('Plan 558 REPRO: the combined WhatsApp text labels the balance as all-months dues', () => {
  const { combinedReceipt } = run(multiMonthFixture(), multiMonthSpec);
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('⚖️ *Total dues (all months):* PKR 2,000'), 'balance line names the all-months scope');
  assert.ok(!text.includes('*Balance Due:*'), 'the bare "Balance Due" label is gone from the combined text');
});

test('Plan 558 REPRO: the combined HTML labels the balance as all-months dues', () => {
  const { combinedReceipt } = run(multiMonthFixture(), multiMonthSpec);
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(html.includes('<dt><strong>Total dues (all months):</strong></dt>'), 'balance row names the all-months scope');
  assert.ok(!html.includes('<strong>Balance Due:</strong>'), 'the bare "Balance Due" label is gone from the combined HTML');
});

test('Plan 558: the figure is still the all-months total — October settled in full, September still owed', () => {
  const { combinedReceipt } = run(multiMonthFixture(), multiMonthSpec);
  // Total billed 3,195 − total paid 1,195 = 2,000: the September dues
  // survive. A figure scoped to the split's month would read 0 here
  // (October is settled), so this pins the relabel-only scope: the
  // figure is NOT re-scoped, only the label changes.
  assert.equal(combinedReceipt.balanceDueCents, 200000, 'figure is the all-months total, not this month only');
  assert.equal(combinedReceipt.status, 'PARTIAL', 'status still reflects the old month owed');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(text.includes('PKR 2,000'), 'WhatsApp figure is the old month\'s dues');
  assert.ok(html.includes('PKR 2,000'), 'HTML figure is the old month\'s dues');
});

test('Plan 558: the all-months label shows even when nothing is owed', () => {
  const { combinedReceipt } = run(settledFixture(), settledSpec);
  assert.equal(combinedReceipt.balanceDueCents, 0, 'nothing owed');
  assert.equal(combinedReceipt.status, 'PAID');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(text.includes('⚖️ *Total dues (all months):* PKR 0'), 'label is unconditional, not conditional on a balance');
  assert.ok(html.includes('<dt><strong>Total dues (all months):</strong></dt>'), 'HTML label is unconditional too');
});

test('Plan 558: the dictionary values are the new label in both languages', () => {
  assert.equal(t('split_balance_due'), 'Total dues (all months)', 'English label names the scope');
  assert.equal(t('split_balance_due', 'ur'), 'کل بقایا', 'Urdu label names the scope');
});

test('Plan 558 PIN: both combined surfaces read the one key — no re-typed label string', () => {
  // The two render sites keep reading t('split_balance_due'), so the
  // label stays one wording everywhere by construction.
  const hits = splitSrc.match(/t\('split_balance_due'\)/g) || [];
  assert.equal(hits.length, 2, 'exactly two render sites read the key (WhatsApp + HTML)');
  assert.ok(!splitSrc.includes('Total dues (all months)'), 'the label lives in the dictionary, not re-typed in the renderer');
  assert.ok(!splitSrc.includes('کل بقایا'), 'the Urdu label lives in the dictionary too');
});

test('Plan 558 PIN: the balance is still summed across every bill — never scoped to the split month', () => {
  assert.ok(splitSrc.includes('for (const bill of (customer.bills ?? []))'), 'the all-bills sum loop is still there');
  assert.ok(splitSrc.includes('totalDuesCents += summary.balanceDueCents'), 'every positive bill balance still feeds the total');
  // A reprint after the split still reflects the ledger as saved now.
  const { nextState, splitGroupId } = run(multiMonthFixture(), multiMonthSpec);
  const rebuilt = buildSplitTenderReceipt(nextState, 'a', splitGroupId);
  assert.equal(rebuilt.balanceDueCents, 200000, 'reprint keeps the all-months figure');
  assert.ok(formatSplitTenderWhatsAppText(rebuilt).includes('Total dues (all months)'), 'reprint keeps the all-months label');
});
