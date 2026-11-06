// Plan 397 — Transaction owner approval for large cash amounts at entry
// time: a very large cash payment can be recorded by any operator
// with no second pair of eyes, so a large figure typed wrong — or
// taken wrong — is only found at settlement. One approval step at
// entry fixes that: a cash payment above an operator-set threshold
// cannot post without the owner's initials or name recorded with
// the transaction, and the approval appears on the transaction
// itself. It approves only — it never changes any bill, payment
// total, customer record, or approval-limits record. The approval
// rides the payment record itself (like the excess cash note, the
// Urdu-script note, and the cross-payment note before it), so it
// needs no store of its own: the record is the approval. A payment
// below the threshold stores nothing extra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LARGE_CASH_DEFAULT_THRESHOLD_CENTS,
  LARGE_CASH_APPROVER_MAX_LENGTH,
  normalizeLargeCashThresholdCents,
  requiresLargeCashApproval,
  normalizeLargeCashApproval,
  largeCashApprovalOf,
  largeCashApprovalLineText,
  largeCashApprovalMarkup,
} from '../large-cash-approval.js';
import {
  validatePayment,
  addPayment,
  correctPayment,
  listTransactions,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations,
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const moduleSrc = fs.readFileSync(path.join(ROOT, '../large-cash-approval.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(ROOT, '../core.js'), 'utf8');
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, '../app.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const stylesSrc = fs.readFileSync(path.join(ROOT, '../styles.css'), 'utf8');
const langSrc = fs.readFileSync(path.join(ROOT, '../nav-language.js'), 'utf8');
const testSrc = fs.readFileSync(path.join(ROOT, 'plan397-large-cash-approval.test.js'), 'utf8');

const NOV_6 = new Date(2026, 10, 6, 12);
const SEP_5 = new Date(2026, 8, 5, 12);
const PAYMENT_DATE = '2026-11-05';
const THRESHOLD = LARGE_CASH_DEFAULT_THRESHOLD_CENTS;

// One open bill at PKR 3,000: dues PKR 3,000.
function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

function pay(state, month, amount, date, referenceDate, options = {}) {
  return addPayment(state, 'seed-001', month, { amount, date, method: 'Cash', ...options }, referenceDate);
}

function recordedPayment(state, month) {
  const customer = state.customers.find((c) => c.id === 'seed-001');
  const bill = customer.bills.find((b) => b.month === month);
  return bill.payments[bill.payments.length - 1];
}

// ---- Module units: the threshold ----

test('Plan 397: the standing default threshold is PKR 10,000 in cents', () => {
  assert.equal(LARGE_CASH_DEFAULT_THRESHOLD_CENTS, 1000000);
  assert.equal(LARGE_CASH_APPROVER_MAX_LENGTH, 100);
  assert.equal(normalizeLargeCashThresholdCents(1500000), 1500000);
  assert.equal(normalizeLargeCashThresholdCents('2500000'), 2500000);
  assert.equal(normalizeLargeCashThresholdCents(1000000.4), 1000000);
  assert.equal(normalizeLargeCashThresholdCents(0), LARGE_CASH_DEFAULT_THRESHOLD_CENTS);
  assert.equal(normalizeLargeCashThresholdCents(-500), LARGE_CASH_DEFAULT_THRESHOLD_CENTS);
  assert.equal(normalizeLargeCashThresholdCents(null), LARGE_CASH_DEFAULT_THRESHOLD_CENTS);
  assert.equal(normalizeLargeCashThresholdCents(undefined), LARGE_CASH_DEFAULT_THRESHOLD_CENTS);
  assert.equal(normalizeLargeCashThresholdCents(''), LARGE_CASH_DEFAULT_THRESHOLD_CENTS);
  assert.equal(normalizeLargeCashThresholdCents(false), LARGE_CASH_DEFAULT_THRESHOLD_CENTS);
  assert.equal(normalizeLargeCashThresholdCents('not a number'), LARGE_CASH_DEFAULT_THRESHOLD_CENTS);
});

// ---- Module units: when approval is required ----

test('Plan 397: approval is required only for cash strictly above the threshold', () => {
  assert.equal(requiresLargeCashApproval(true, 1500000, THRESHOLD), true);
  assert.equal(requiresLargeCashApproval(true, 1000001, THRESHOLD), true);
  assert.equal(requiresLargeCashApproval(true, 1000000, THRESHOLD), false);
  assert.equal(requiresLargeCashApproval(true, 500000, THRESHOLD), false);
  assert.equal(requiresLargeCashApproval(false, 1500000, THRESHOLD), false);
  assert.equal(requiresLargeCashApproval(true, 1500000, undefined), true);
  assert.equal(requiresLargeCashApproval(true, 500000, undefined), false);
  assert.equal(requiresLargeCashApproval(true, null, THRESHOLD), false);
  assert.equal(requiresLargeCashApproval(true, '', THRESHOLD), false);
  assert.equal(requiresLargeCashApproval(true, 'not a number', THRESHOLD), false);
  assert.equal(requiresLargeCashApproval(null, 1500000, THRESHOLD), false);
  assert.equal(requiresLargeCashApproval(undefined, 1500000, THRESHOLD), false);
});

// ---- Module units: normalizing the approval ----

test('Plan 397: the approval is kept only when it is actually needed', () => {
  assert.deepEqual(normalizeLargeCashApproval('AB', { isCash: true, amountCents: 1500000, thresholdCents: THRESHOLD }), { by: 'AB' });
  assert.deepEqual(normalizeLargeCashApproval({ by: '  AB  ' }, { isCash: true, amountCents: 1500000, thresholdCents: THRESHOLD }), { by: 'AB' });
  assert.deepEqual(normalizeLargeCashApproval('AB\nCD', { isCash: true, amountCents: 1500000, thresholdCents: THRESHOLD }), { by: 'AB CD' });
  assert.equal(normalizeLargeCashApproval('AB', { isCash: true, amountCents: 500000, thresholdCents: THRESHOLD }), null);
  assert.equal(normalizeLargeCashApproval('AB', { isCash: true, amountCents: 1000000, thresholdCents: THRESHOLD }), null);
  assert.equal(normalizeLargeCashApproval('AB', { isCash: false, amountCents: 1500000, thresholdCents: THRESHOLD }), null);
  assert.equal(normalizeLargeCashApproval('', { isCash: true, amountCents: 1500000, thresholdCents: THRESHOLD }), null);
  assert.equal(normalizeLargeCashApproval('   ', { isCash: true, amountCents: 1500000, thresholdCents: THRESHOLD }), null);
  assert.equal(normalizeLargeCashApproval(null, { isCash: true, amountCents: 1500000, thresholdCents: THRESHOLD }), null);
  assert.equal(normalizeLargeCashApproval({ by: '' }, { isCash: true, amountCents: 1500000, thresholdCents: THRESHOLD }), null);
});

test('Plan 397: a carried approval is kept as-is when no threshold is passed', () => {
  assert.deepEqual(normalizeLargeCashApproval({ by: 'AB' }, {}), { by: 'AB' });
  assert.deepEqual(normalizeLargeCashApproval('AB', {}), { by: 'AB' });
  assert.equal(normalizeLargeCashApproval('', {}), null);
  assert.equal(normalizeLargeCashApproval(null, {}), null);
  assert.equal(normalizeLargeCashApproval({ by: '' }, {}), null);
});

test('Plan 397: the approver name is capped at 100 characters', () => {
  const long = 'A'.repeat(150);
  assert.deepEqual(normalizeLargeCashApproval(long, { isCash: true, amountCents: 1500000, thresholdCents: THRESHOLD }), { by: 'A'.repeat(100) });
  assert.equal(largeCashApprovalOf({ largeCashApproval: { by: 'B'.repeat(150) } }).by.length, 100);
});

// ---- Module units: the defensive reader, line text, markup ----

test('Plan 397: the defensive reader keeps only a well-formed approval', () => {
  assert.deepEqual(largeCashApprovalOf({ largeCashApproval: { by: 'AB' } }), { by: 'AB' });
  assert.deepEqual(largeCashApprovalOf({ largeCashApproval: { by: '  AB  ' } }), { by: 'AB' });
  assert.equal(largeCashApprovalOf({ largeCashApproval: { by: '' } }), null);
  assert.equal(largeCashApprovalOf({ largeCashApproval: {} }), null);
  assert.equal(largeCashApprovalOf({ largeCashApproval: 'AB' }), null);
  assert.equal(largeCashApprovalOf({}), null);
  assert.equal(largeCashApprovalOf(null), null);
});

test('Plan 397: the approval reads in plain words', () => {
  assert.equal(largeCashApprovalLineText({ by: 'AB' }), 'Approved by AB');
  assert.equal(largeCashApprovalLineText({ by: '  AB  ' }), 'Approved by AB');
  assert.equal(largeCashApprovalLineText({ by: '' }), '');
  assert.equal(largeCashApprovalLineText(null), '');
  assert.equal(largeCashApprovalLineText('AB'), '');
});

test('Plan 397: the markup is an escaped suffix, empty when there is no approval', () => {
  assert.equal(largeCashApprovalMarkup({ largeCashApproval: { by: 'AB' } }), ' · Approved by AB');
  assert.equal(largeCashApprovalMarkup({}), '');
  assert.equal(largeCashApprovalMarkup({ largeCashApproval: null }), '');
  assert.equal(largeCashApprovalMarkup({ largeCashApproval: { by: '<script>' } }), ' · Approved by &lt;script&gt;');
  assert.equal(largeCashApprovalMarkup({ largeCashApproval: { by: 'A&B' } }), ' · Approved by A&amp;B');
});

// ---- Validator: the gate ----

test('Plan 397: validatePayment refuses a large cash payment with no approval recorded', () => {
  assert.throws(() => validatePayment({ date: PAYMENT_DATE, amount: 15000, method: 'Cash', largeCashThresholdCents: THRESHOLD }, NOV_6), /Large cash payments need the owner/);
  assert.throws(() => validatePayment({ date: PAYMENT_DATE, amount: 15000, method: 'Cash', largeCashApproval: '', largeCashThresholdCents: THRESHOLD }, NOV_6), /Large cash payments need the owner/);
  assert.throws(() => validatePayment({ date: PAYMENT_DATE, amount: 15000, method: 'Cash at Hassan shop', largeCashThresholdCents: THRESHOLD }, NOV_6), /Large cash payments need the owner/);
});

test('Plan 397: validatePayment keeps the approval on a large cash payment', () => {
  const clean = validatePayment({ date: PAYMENT_DATE, amount: 15000, method: 'Cash', largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD }, NOV_6);
  assert.deepEqual(clean.largeCashApproval, { by: 'AB' });
  assert.equal('largeCashThresholdCents' in clean, false);
  const shop = validatePayment({ date: PAYMENT_DATE, amount: 15000, method: 'Cash at Hassan shop', largeCashApproval: { by: 'AB' }, largeCashThresholdCents: THRESHOLD }, NOV_6);
  assert.deepEqual(shop.largeCashApproval, { by: 'AB' });
});

test('Plan 397: validatePayment stores nothing when no approval is needed', () => {
  const below = validatePayment({ date: PAYMENT_DATE, amount: 5000, method: 'Cash', largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD }, NOV_6);
  assert.equal('largeCashApproval' in below, false);
  const at = validatePayment({ date: PAYMENT_DATE, amount: 10000, method: 'Cash', largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD }, NOV_6);
  assert.equal('largeCashApproval' in at, false);
  const digital = validatePayment({ date: PAYMENT_DATE, amount: 15000, method: 'Easypaisa', largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD }, NOV_6);
  assert.equal('largeCashApproval' in digital, false);
});

test('Plan 397: without a threshold passed, a large cash payment keeps its historical behaviour', () => {
  const clean = validatePayment({ date: PAYMENT_DATE, amount: 15000, method: 'Cash' }, NOV_6);
  assert.equal('largeCashApproval' in clean, false);
  const carried = validatePayment({ date: PAYMENT_DATE, amount: 15000, method: 'Cash', largeCashApproval: { by: 'AB' } }, NOV_6);
  assert.deepEqual(carried.largeCashApproval, { by: 'AB' });
});

// ---- addPayment: the approval rides the record and changes nothing else ----

test('Plan 397: addPayment records the approval on the payment it saves', () => {
  const state = stateWithBills(SEP_5);
  const next = pay(state, '2026-09', 15000, '2026-09-05', SEP_5, { largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD });
  const recorded = recordedPayment(next, '2026-09');
  assert.deepEqual(recorded.largeCashApproval, { by: 'AB' });
  assert.equal(recorded.amount, 15000);
  assert.equal(recorded.method, 'Cash');
});

test('Plan 397: the approval changes no bill or payment total by itself', () => {
  const withApproval = pay(stateWithBills(SEP_5), '2026-09', 15000, '2026-09-05', SEP_5, { largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD });
  const withoutApproval = pay(stateWithBills(SEP_5), '2026-09', 15000, '2026-09-05', SEP_5);
  const a = recordedPayment(withApproval, '2026-09');
  const b = recordedPayment(withoutApproval, '2026-09');
  assert.deepEqual({ ...a, id: undefined, largeCashApproval: undefined }, { ...b, id: undefined, largeCashApproval: undefined });
  assert.equal('largeCashApproval' in b, false);
  const allocA = calculatePaymentAllocations(withApproval);
  const allocB = calculatePaymentAllocations(withoutApproval);
  assert.equal(allocA.forMonth('seed-001', '2026-09')?.balanceDueCents, allocB.forMonth('seed-001', '2026-09')?.balanceDueCents);
});

// ---- correctPayment: carry-over ----

test('Plan 397: correctPayment carries the approval silently, replaces it explicitly, and clears it on null', () => {
  const state = pay(stateWithBills(SEP_5), '2026-09', 15000, '2026-09-05', SEP_5, { largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD });
  const paymentId = recordedPayment(state, '2026-09').id;
  const kept = correctPayment(state, 'seed-001', '2026-09', paymentId, { date: '2026-09-05', amount: 14000, method: 'Cash' }, SEP_5);
  assert.deepEqual(recordedPayment(kept, '2026-09').largeCashApproval, { by: 'AB' });
  const replaced = correctPayment(state, 'seed-001', '2026-09', paymentId, { date: '2026-09-05', amount: 15000, method: 'Cash', largeCashApproval: 'CD' }, SEP_5);
  assert.deepEqual(recordedPayment(replaced, '2026-09').largeCashApproval, { by: 'CD' });
  const cleared = correctPayment(state, 'seed-001', '2026-09', paymentId, { date: '2026-09-05', amount: 15000, method: 'Cash', largeCashApproval: null }, SEP_5);
  assert.equal('largeCashApproval' in recordedPayment(cleared, '2026-09'), false);
});

test('Plan 397: a correction that raises a cash payment above the threshold posts without a fresh approval (the approval step lives at entry)', () => {
  const state = pay(stateWithBills(SEP_5), '2026-09', 5000, '2026-09-05', SEP_5);
  const paymentId = recordedPayment(state, '2026-09').id;
  const corrected = correctPayment(state, 'seed-001', '2026-09', paymentId, { date: '2026-09-05', amount: 15000, method: 'Cash' }, SEP_5);
  assert.equal(recordedPayment(corrected, '2026-09').amount, 15000);
  assert.equal('largeCashApproval' in recordedPayment(corrected, '2026-09'), false);
});

// ---- listTransactions: the approval rides the row ----

test('Plan 397: listTransactions projects the approval onto the row', () => {
  const state = pay(stateWithBills(SEP_5), '2026-09', 15000, '2026-09-05', SEP_5, { largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD });
  const rows = listTransactions(state, {}, SEP_5);
  const row = rows.find((entry) => entry.paymentId === recordedPayment(state, '2026-09').id);
  assert.deepEqual(row.largeCashApproval, { by: 'AB' });
  const plain = pay(stateWithBills(SEP_5), '2026-09', 5000, '2026-09-05', SEP_5);
  const plainRows = listTransactions(plain, {}, SEP_5);
  const plainRow = plainRows.find((entry) => entry.paymentId === recordedPayment(plain, '2026-09').id);
  assert.equal(plainRow.largeCashApproval, null);
});

// ---- Quick Collect end to end ----

test('Plan 397: executeQuickCollection refuses a large cash payment with no approval', () => {
  const state = stateWithBills(SEP_5);
  assert.throws(() => executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 15000, date: '2026-09-05', method: 'Cash',
    largeCashThresholdCents: THRESHOLD,
  }, SEP_5), /Large cash payments need the owner/);
});

test('Plan 397: executeQuickCollection records the approval on the payment it saves', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 15000, date: '2026-09-05', method: 'Cash',
    largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD,
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.deepEqual(payment.largeCashApproval, { by: 'AB' });
  assert.equal(payment.amount, 15000);
});

test('Plan 397: executeQuickCollection below the threshold records no approval field', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 5000, date: '2026-09-05', method: 'Cash',
    largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD,
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.equal('largeCashApproval' in payment, false);
});

test('Plan 397: executeQuickCollection for a digital payment above the threshold records no approval field', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 15000, date: '2026-09-05', method: 'Easypaisa',
    largeCashApproval: 'AB', largeCashThresholdCents: THRESHOLD,
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.equal('largeCashApproval' in payment, false);
});

// ---- Wiring: the approval appears on the transaction ----

test('Plan 397: app.js imports the approval helpers and shows the approval on both profile history rows and the Transactions card', () => {
  assert.equal(appSrc.includes("from './large-cash-approval.js'"), true);
  assert.equal(appSrc.includes('largeCashApprovalMarkup'), true);
  const rowCount = appSrc.split('${profileExcessCashNoteMarkup(payment)}${profileLargeCashApprovalMarkup(payment)}').length - 1;
  assert.equal(rowCount, 2, 'the approval must sit beside the excess note on both profile history rows');
  assert.equal(appSrc.includes('${transactionExcessCashNoteMarkup(transaction)}${transactionLargeCashApprovalMarkup(transaction)}'), true);
});

test('Plan 397: core.js validates, carries, and projects the approval', () => {
  assert.equal(coreSrc.includes("from './large-cash-approval.js'"), true);
  assert.equal(coreSrc.includes('normalizeLargeCashApproval(largeCashApproval,'), true);
  assert.equal(coreSrc.includes("Large cash payments need the owner\\'s approval recorded."), true);
  assert.equal(coreSrc.includes('largeCashApproval: fields.largeCashApproval !== undefined ? fields.largeCashApproval : existingPayment.largeCashApproval'), true);
  assert.equal(coreSrc.includes('largeCashApproval: largeCashApprovalOf(payment)'), true);
});

test('Plan 397: the Quick Collect form offers the threshold and approver and the submit carries them', () => {
  assert.equal(indexSrc.includes('id="quickCollectLargeCashThreshold"'), true);
  assert.equal(indexSrc.includes('id="quickCollectLargeCashApprover"'), true);
  assert.equal(indexSrc.includes('value="10000"'), true);
  assert.equal(LARGE_CASH_DEFAULT_THRESHOLD_CENTS / 100, 10000);
  assert.equal(navSrc.includes("from './large-cash-approval.js'"), true);
  assert.equal(navSrc.includes('largeCashThresholdInput?.value'), true);
  assert.equal(navSrc.includes('largeCashApproverInput?.value'), true);
  assert.equal(navSrc.includes('largeCashApproval: largeCashApprover || undefined,'), true);
  assert.equal(navSrc.includes('largeCashThresholdCents: largeCashThresholdCents,'), true);
  assert.equal(navSrc.includes('largeCashApproval: largeCashApproval || undefined,'), true);
  assert.equal(navSrc.includes("if (largeCashThresholdInput) largeCashThresholdInput.value = String(LARGE_CASH_DEFAULT_THRESHOLD_CENTS / 100);"), true);
  assert.equal(navSrc.includes("if (largeCashApproverInput) largeCashApproverInput.value = '';"), true);
});

test('Plan 397: the profile payment form carries the threshold and approver fields', () => {
  assert.equal(appSrc.includes('name="largeCashThreshold"'), true);
  assert.equal(appSrc.includes('name="largeCashApprover"'), true);
  assert.equal(appSrc.includes('largeCashApprovalFieldsMarkup'), true);
  assert.equal(appSrc.includes('`lca-${month}`'), true);
  assert.equal(appSrc.includes('largeCashApproval: profileLargeCashApprover || undefined,'), true);
  assert.equal(appSrc.includes('largeCashThresholdCents: profileLargeCashThresholdCents,'), true);
});

// ---- Fences: approval limits, save confirmation, offline queue, receipts ----

test('Plan 397: the module header never names a fenced filename literally', () => {
  const limitsModule = 'approval-' + 'limits.js';
  const confirmModule = 'save-confirmation-' + 'summary.js';
  const queueModule = 'offline-queue-' + 'status.js';
  for (const fenced of [limitsModule, confirmModule, queueModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(testSrc.includes(fenced), false, fenced);
  }
});

test('Plan 397: the approval-limits record never reads the approval — untouched', () => {
  const limitsModule = 'approval-' + 'limits.js';
  const src = fs.readFileSync(path.join(ROOT, '..', limitsModule), 'utf8');
  assert.equal(src.includes('largeCashApprovalOf'), false, limitsModule);
  assert.equal(src.includes('normalizeLargeCashApproval'), false, limitsModule);
  assert.equal(src.includes('largeCashApproval'), false, limitsModule);
});

test('Plan 397: the receipt never reads the approval — receipts are untouched', () => {
  const receiptModule = 'receipt-' + 'script.js';
  for (const file of ['receipt.js', receiptModule, 'png-receipt.js']) {
    const src = fs.readFileSync(path.join(ROOT, '..', file), 'utf8');
    assert.equal(src.includes('largeCashApprovalOf'), false, file);
    assert.equal(src.includes('normalizeLargeCashApproval'), false, file);
  }
});

test('Plan 397: no new store — the approval rides the payment record', () => {
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(coreSrc.includes('shahdara_lca'), false);
});

test('Plan 397: no new styling and no new language keys', () => {
  assert.equal(stylesSrc.includes('.lca-'), false);
  assert.equal(stylesSrc.includes('large-cash'), false);
  assert.equal(langSrc.includes('largeCash'), false);
  assert.equal(appSrc.includes('largeCashApprovalFieldsMarkup'), true);
});

test('Plan 397: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.ok(!mobilePattern.test(testSrc), 'test carries a realistic phone number');
  assert.ok(!testSrc.includes(fakeFamily), 'test carries a phone-like number');
  for (const name of ['Ki' + 'ran', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Ahmed ' + 'Khan']) {
    assert.ok(!testSrc.includes(name), `test carries a real customer name: ${name}`);
  }
});
