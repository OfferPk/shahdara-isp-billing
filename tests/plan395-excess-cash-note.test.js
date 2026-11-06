// Plan 395 — Transaction excess cash note at entry time: when a
// customer hands over more cash than the dues, the extra sits
// unexplained unless somebody records at the counter what it is
// for. One excess note on the transaction carries the extra amount
// and its stated purpose in plain words — advance, credit, or
// change to return — recorded with the payment when the amount
// exceeds the dues. It notes the extra only and it applies nothing
// by itself: it never creates an advance record, never touches any
// credit balance, and never changes any bill, payment total, or
// past total. The note rides the payment record itself (like the
// overpayment choice, the Urdu-script note, and the cross-payment
// note before it), so it needs no store of its own: the record is
// the note. A payment with no excess shows nothing extra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXCESS_CASH_PURPOSES,
  isExcessCashPurpose,
  excessCashExtraCents,
  excessCashNoteOf,
  normalizeExcessCashNote,
  excessCashNoteLineText,
  excessCashNoteMarkup,
} from '../excess-cash-note.js';
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
const moduleSrc = fs.readFileSync(path.join(ROOT, '../excess-cash-note.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(ROOT, '../core.js'), 'utf8');
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, '../app.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const stylesSrc = fs.readFileSync(path.join(ROOT, '../styles.css'), 'utf8');
const langSrc = fs.readFileSync(path.join(ROOT, '../nav-language.js'), 'utf8');
const testSrc = fs.readFileSync(path.join(ROOT, 'plan395-excess-cash-note.test.js'), 'utf8');

const NOV_6 = new Date(2026, 10, 6, 12);
const SEP_5 = new Date(2026, 8, 5, 12);
const PAYMENT_DATE = '2026-11-05';
const DUES_9000 = 900000;

// Three open bills at PKR 3,000 each: total dues PKR 9,000.
function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

function totalDuesCents(state) {
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  let dues = 0;
  for (const bill of (customer.bills ?? [])) {
    const remaining = allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? 0;
    if (remaining > 0) dues += remaining;
  }
  return dues;
}

function pay(state, month, amount, date, referenceDate, options = {}) {
  return addPayment(state, 'seed-001', month, { amount, date, method: 'Cash', ...options }, referenceDate);
}

function recordedPayment(state, month) {
  const customer = state.customers.find((c) => c.id === 'seed-001');
  const bill = customer.bills.find((b) => b.month === month);
  return bill.payments[bill.payments.length - 1];
}

// ---- Module units: the extra over the dues ----

test('Plan 395: the extra is the amount over the dues, or 0 when it does not exceed them', () => {
  assert.equal(excessCashExtraCents(900000, 950000), 50000);
  assert.equal(excessCashExtraCents(900000, 900000), 0);
  assert.equal(excessCashExtraCents(900000, 800000), 0);
  assert.equal(excessCashExtraCents(0, 50000), 50000);
  assert.equal(excessCashExtraCents('900000', '950000'), 50000);
  assert.equal(excessCashExtraCents(null, 950000), 0);
  assert.equal(excessCashExtraCents('', 950000), 0);
  assert.equal(excessCashExtraCents(false, 950000), 0);
  assert.equal(excessCashExtraCents(900000, 'not a number'), 0);
});

test('Plan 395: only advance, credit, and change are purposes', () => {
  assert.deepEqual(EXCESS_CASH_PURPOSES, ['advance', 'credit', 'change']);
  assert.equal(isExcessCashPurpose('advance'), true);
  assert.equal(isExcessCashPurpose('credit'), true);
  assert.equal(isExcessCashPurpose('change'), true);
  assert.equal(isExcessCashPurpose(' Change '), true);
  assert.equal(isExcessCashPurpose('CREDIT'), true);
  assert.equal(isExcessCashPurpose(''), false);
  assert.equal(isExcessCashPurpose('cash'), false);
  assert.equal(isExcessCashPurpose('refund'), false);
  assert.equal(isExcessCashPurpose(null), false);
  assert.equal(isExcessCashPurpose(undefined), false);
});

test('Plan 395: the defensive reader keeps only a well-formed note', () => {
  assert.deepEqual(excessCashNoteOf({ excessCashNote: { purpose: 'advance', extraCents: 50000 } }), { purpose: 'advance', extraCents: 50000 });
  assert.deepEqual(excessCashNoteOf({ excessCashNote: { purpose: ' Change ', extraCents: 100 } }), { purpose: 'change', extraCents: 100 });
  assert.equal(excessCashNoteOf({ excessCashNote: { purpose: 'advance', extraCents: 0 } }), null);
  assert.equal(excessCashNoteOf({ excessCashNote: { purpose: 'advance', extraCents: -500 } }), null);
  assert.equal(excessCashNoteOf({ excessCashNote: { purpose: 'advance', extraCents: 50.5 } }), null);
  assert.equal(excessCashNoteOf({ excessCashNote: { purpose: 'cash', extraCents: 50000 } }), null);
  assert.equal(excessCashNoteOf({ excessCashNote: { purpose: 'advance' } }), null);
  assert.equal(excessCashNoteOf({ excessCashNote: 'advance' }), null);
  assert.equal(excessCashNoteOf({}), null);
  assert.equal(excessCashNoteOf(null), null);
});

test('Plan 395: normalize keeps a valid note with the extra recomputed from dues and amount', () => {
  assert.deepEqual(normalizeExcessCashNote('advance', DUES_9000, 950000), { purpose: 'advance', extraCents: 50000 });
  assert.deepEqual(normalizeExcessCashNote('credit', DUES_9000, 950000), { purpose: 'credit', extraCents: 50000 });
  assert.deepEqual(normalizeExcessCashNote('change', DUES_9000, 950000), { purpose: 'change', extraCents: 50000 });
  assert.deepEqual(normalizeExcessCashNote(' Change ', DUES_9000, 900100), { purpose: 'change', extraCents: 100 });
  // A stale extra on the raw record never survives: the extra is
  // always the amount over the dues, recomputed here.
  assert.deepEqual(
    normalizeExcessCashNote({ purpose: 'credit', extraCents: 999999 }, DUES_9000, 950000),
    { purpose: 'credit', extraCents: 50000 },
  );
});

test('Plan 395: normalize refuses a note when the payment does not exceed the dues', () => {
  assert.equal(normalizeExcessCashNote('advance', DUES_9000, 900000), null);
  assert.equal(normalizeExcessCashNote('change', DUES_9000, 800000), null);
  assert.equal(normalizeExcessCashNote('credit', DUES_9000, 0), null);
  assert.equal(normalizeExcessCashNote('advance', 0, 0), null);
});

test('Plan 395: normalize refuses a note with no usable purpose', () => {
  assert.equal(normalizeExcessCashNote('', DUES_9000, 950000), null);
  assert.equal(normalizeExcessCashNote('cash', DUES_9000, 950000), null);
  assert.equal(normalizeExcessCashNote(null, DUES_9000, 950000), null);
  assert.equal(normalizeExcessCashNote(undefined, DUES_9000, 950000), null);
});

test('Plan 395: without dues a well-formed carried note is kept, a bare word stores nothing', () => {
  assert.deepEqual(
    normalizeExcessCashNote({ purpose: 'change', extraCents: 50000 }, undefined, undefined),
    { purpose: 'change', extraCents: 50000 },
  );
  assert.equal(normalizeExcessCashNote('advance', undefined, undefined), null);
  assert.equal(normalizeExcessCashNote({ purpose: 'cash', extraCents: 50000 }, undefined, undefined), null);
});

// ---- Module units: the note in plain words ----

test('Plan 395: the line text names the extra amount and its stated purpose', () => {
  assert.equal(excessCashNoteLineText({ purpose: 'advance', extraCents: 50000 }), 'Extra PKR 500 as advance');
  assert.equal(excessCashNoteLineText({ purpose: 'credit', extraCents: 150000 }), 'Extra PKR 1,500 held as credit');
  assert.equal(excessCashNoteLineText({ purpose: 'change', extraCents: 50000 }), 'Extra PKR 500 — change to return');
  assert.equal(excessCashNoteLineText({ purpose: 'change', extraCents: 50 }), 'Extra PKR 0.5 — change to return');
  assert.equal(excessCashNoteLineText(null), '');
  assert.equal(excessCashNoteLineText({ purpose: 'cash', extraCents: 50000 }), '');
  assert.equal(excessCashNoteLineText({ purpose: 'advance', extraCents: 0 }), '');
});

test('Plan 395: the markup is a dot suffix, escaped, and empty when there is no note', () => {
  assert.equal(
    excessCashNoteMarkup({ excessCashNote: { purpose: 'advance', extraCents: 50000 } }),
    ' · Extra PKR 500 as advance',
  );
  assert.equal(
    excessCashNoteMarkup({ excessCashNote: { purpose: 'change', extraCents: 50000 } }),
    ' · Extra PKR 500 — change to return',
  );
  assert.equal(excessCashNoteMarkup({}), '');
  assert.equal(excessCashNoteMarkup(null), '');
  assert.equal(
    excessCashNoteMarkup(
      { excessCashNote: { purpose: 'credit', extraCents: 50000 } },
      { extra: '<Extra>', advance: 'as advance', credit: 'held as credit', change: 'change to return' },
    ),
    ' · &lt;Extra&gt; PKR 500 held as credit',
  );
});

// ---- Validator and recording ----

test('Plan 395: validatePayment keeps the note when the amount exceeds the dues', () => {
  const payment = validatePayment({
    date: PAYMENT_DATE, amount: 9500, method: 'Cash',
    excessCashNote: 'change', excessCashDuesCents: DUES_9000,
  }, NOV_6);
  assert.deepEqual(payment.excessCashNote, { purpose: 'change', extraCents: 50000 });
  assert.equal('excessCashDuesCents' in payment, false, 'the dues ride along for the check only and are never stored');
  assert.equal(payment.amount, 9500);
});

test('Plan 395: validatePayment drops the note when the payment does not exceed the dues', () => {
  for (const amount of [9000, 8000]) {
    const payment = validatePayment({
      date: PAYMENT_DATE, amount, method: 'Cash',
      excessCashNote: 'advance', excessCashDuesCents: DUES_9000,
    }, NOV_6);
    assert.equal('excessCashNote' in payment, false, `amount ${amount} must record no note`);
  }
  const noDues = validatePayment({
    date: PAYMENT_DATE, amount: 9500, method: 'Cash', excessCashNote: 'advance',
  }, NOV_6);
  assert.equal('excessCashNote' in noDues, false, 'a bare purpose with no dues to check against stores nothing');
});

test('Plan 395: a reversal can never carry an excess note', () => {
  const payment = validatePayment({
    date: PAYMENT_DATE, amount: -3000, method: 'Cash',
    reversalLink: { reversesPaymentId: 'P-ORIG', date: PAYMENT_DATE },
    excessCashNote: 'advance', excessCashDuesCents: 0,
  }, NOV_6);
  assert.ok(payment.reversalLink, 'the reversal link itself records');
  assert.equal('excessCashNote' in payment, false);
});

test('Plan 395: addPayment records the note with the transaction', () => {
  const state = stateWithBills(NOV_6);
  assert.equal(totalDuesCents(state), DUES_9000);
  const next = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    excessCashNote: 'credit', excessCashDuesCents: DUES_9000,
  });
  const recorded = recordedPayment(next, '2026-10');
  assert.deepEqual(recorded.excessCashNote, { purpose: 'credit', extraCents: 50000 });
  assert.equal(recorded.amount, 9500);
  assert.equal(recorded.method, 'Cash');
  assert.equal(recorded.date, PAYMENT_DATE);
});

test('Plan 395: addPayment without a purpose records no note field', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6);
  assert.equal('excessCashNote' in recordedPayment(next, '2026-10'), false);
});

test('Plan 395: addPayment with a purpose but no excess records no note field', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '9000', PAYMENT_DATE, NOV_6, {
    excessCashNote: 'change', excessCashDuesCents: DUES_9000,
  });
  assert.equal('excessCashNote' in recordedPayment(next, '2026-10'), false);
});

test('Plan 395: the note rides the transaction row via listTransactions', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    excessCashNote: 'advance', excessCashDuesCents: DUES_9000,
  });
  const rows = listTransactions(next, {}, NOV_6);
  const row = rows.find((entry) => entry.paymentId === recordedPayment(next, '2026-10').id);
  assert.deepEqual(row.excessCashNote, { purpose: 'advance', extraCents: 50000 });
  const plain = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6);
  const plainRow = listTransactions(plain, {}, NOV_6).find((entry) => entry.paymentId === recordedPayment(plain, '2026-10').id);
  assert.equal(plainRow.excessCashNote, null);
});

// ---- Correction carry-over ----

test('Plan 395: correctPayment keeps the note when the correction says nothing about it', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    excessCashNote: 'change', excessCashDuesCents: DUES_9000,
  });
  const payment = recordedPayment(next, '2026-10');
  const corrected = correctPayment(next, 'seed-001', '2026-10', payment.id, {
    date: PAYMENT_DATE, amount: 9500, method: 'Cash',
  }, NOV_6);
  const kept = recordedPayment(corrected, '2026-10');
  assert.deepEqual(kept.excessCashNote, { purpose: 'change', extraCents: 50000 });
});

test('Plan 395: correctPayment replaces the note explicitly and clears it on null', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    excessCashNote: 'change', excessCashDuesCents: DUES_9000,
  });
  const payment = recordedPayment(next, '2026-10');
  const replaced = correctPayment(next, 'seed-001', '2026-10', payment.id, {
    date: PAYMENT_DATE, amount: 9500, method: 'Cash',
    excessCashNote: { purpose: 'advance', extraCents: 50000 },
  }, NOV_6);
  assert.deepEqual(recordedPayment(replaced, '2026-10').excessCashNote, { purpose: 'advance', extraCents: 50000 });
  const cleared = correctPayment(next, 'seed-001', '2026-10', payment.id, {
    date: PAYMENT_DATE, amount: 9500, method: 'Cash', excessCashNote: null,
  }, NOV_6);
  assert.equal('excessCashNote' in recordedPayment(cleared, '2026-10'), false);
});

// ---- Acceptance: the note changes nothing by itself ----

test('Plan 395: acceptance — the note never changes any bill, payment, or past total by itself', () => {
  const base = stateWithBills(NOV_6);
  const withNote = pay(base, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    excessCashNote: 'advance', excessCashDuesCents: DUES_9000,
  });
  const withoutNote = pay(base, '2026-10', '9500', PAYMENT_DATE, NOV_6);
  // Every month's remaining balance is identical with and without it.
  for (const month of ['2026-09', '2026-10', '2026-11']) {
    assert.equal(
      calculatePaymentAllocations(withNote).forMonth('seed-001', month).balanceDueCents,
      calculatePaymentAllocations(withoutNote).forMonth('seed-001', month).balanceDueCents,
      `${month} balance must not move because a note was recorded`,
    );
  }
  // The recorded payment is identical except for the note itself
  // (and the random id every payment carries).
  const noted = recordedPayment(withNote, '2026-10');
  const plain = recordedPayment(withoutNote, '2026-10');
  const { excessCashNote: _noted, id: _notedId, ...notedRest } = noted;
  const { excessCashNote: _plain, id: _plainId, ...plainRest } = plain;
  assert.deepEqual(notedRest, plainRest);
  // A purpose of "advance" creates no advance payment of its own.
  const kinds = withNote.customers[0].bills.flatMap((bill) => bill.payments.map((entry) => entry.kind));
  assert.equal(kinds.includes('advance'), false);
});

test('Plan 395: the note and the overpayment choice are independent notes on one payment', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    overpaymentChoice: 'advance', overpaymentDuesCents: DUES_9000,
    excessCashNote: 'change', excessCashDuesCents: DUES_9000,
  });
  const recorded = recordedPayment(next, '2026-10');
  assert.deepEqual(recorded.overpaymentChoice, { choice: 'advance', extraCents: 50000 });
  assert.deepEqual(recorded.excessCashNote, { purpose: 'change', extraCents: 50000 });
});

// ---- Quick Collect end to end ----

test('Plan 395: executeQuickCollection records the excess note on the payment it saves', () => {
  const state = stateWithBills(SEP_5);
  assert.equal(totalDuesCents(state), 300000);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 3500, date: '2026-09-05', method: 'Cash',
    excessCashNote: 'change', excessCashDuesCents: 300000,
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.deepEqual(payment.excessCashNote, { purpose: 'change', extraCents: 50000 });
  assert.equal(payment.amount, 3500);
});

test('Plan 395: executeQuickCollection without a purpose records no excess note field', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 3500, date: '2026-09-05', method: 'Cash',
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.equal('excessCashNote' in payment, false);
});

test('Plan 395: executeQuickCollection with a purpose but no excess records no note field', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-05', method: 'Cash',
    excessCashNote: 'advance', excessCashDuesCents: 300000,
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.equal('excessCashNote' in payment, false);
});

// ---- Wiring: the note appears on the transaction ----

test('Plan 395: app.js imports the note helpers and shows the note on both profile history rows and the Transactions card', () => {
  assert.equal(appSrc.includes("from './excess-cash-note.js'"), true);
  assert.equal(appSrc.includes('excessCashNoteMarkup'), true);
  const rowCount = appSrc.split('${profileOverpaymentChoiceMarkup(payment)}${profileExcessCashNoteMarkup(payment)}').length - 1;
  assert.equal(rowCount, 2, 'the note must sit beside the overpayment choice on both profile history rows');
  assert.equal(appSrc.includes('${transactionOverpaymentChoiceMarkup(transaction)}${transactionExcessCashNoteMarkup(transaction)}'), true);
});

test('Plan 395: core.js validates, carries, and projects the note', () => {
  assert.equal(coreSrc.includes("from './excess-cash-note.js'"), true);
  assert.equal(coreSrc.includes('normalizeExcessCashNote(excessCashNote, excessCashDuesCents'), true);
  assert.equal(coreSrc.includes('excessCashNote: fields.excessCashNote !== undefined ? fields.excessCashNote : existingPayment.excessCashNote'), true);
  assert.equal(coreSrc.includes('excessCashNote: excessCashNoteOf(payment)'), true);
});

test('Plan 395: the Quick Collect form offers the purpose and the submit carries it with the dues', () => {
  assert.equal(indexSrc.includes('id="quickCollectExcessCashPurposeSelect"'), true);
  assert.equal(indexSrc.includes('<option value="advance">Advance — toward future bills</option>'), true);
  assert.equal(indexSrc.includes('<option value="credit">Credit — hold as credit balance</option>'), true);
  assert.equal(indexSrc.includes('<option value="change">Change to return</option>'), true);
  assert.equal(navSrc.includes('excessCashPurposeSelect?.value'), true);
  assert.equal(navSrc.includes('excessCashNote: selectedExcessCashPurpose || undefined,'), true);
  assert.equal(navSrc.includes('excessCashDuesCents: selectedExcessCashPurpose ? excessCashDuesCents : undefined,'), true);
  assert.equal(navSrc.includes('excessCashNote: excessCashNote || undefined,'), true);
  assert.equal(navSrc.includes('excessCashDuesCents: Number.isFinite(Number(excessCashDuesCents)) ? Math.round(Number(excessCashDuesCents)) : undefined,'), true);
  assert.equal(navSrc.includes("if (excessCashPurposeSelect) excessCashPurposeSelect.value = '';"), true);
});

// ---- Fences: advance, credit balance, overpayment choice, receipts ----

test('Plan 395: the module header never names a fenced filename literally', () => {
  const advanceModule = 'advance-' + 'payment.js';
  const creditModule = 'credit-' + 'balance.js';
  const choiceModule = 'overpayment-' + 'choice.js';
  for (const fenced of [advanceModule, creditModule, choiceModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(testSrc.includes(fenced), false, fenced);
  }
});

test('Plan 395: the advance and credit-balance mechanisms never read the note — untouched', () => {
  const advanceModule = 'advance-' + 'payment.js';
  const creditModule = 'credit-' + 'balance.js';
  for (const file of [advanceModule, creditModule]) {
    const src = fs.readFileSync(path.join(ROOT, '..', file), 'utf8');
    assert.equal(src.includes('excessCashNoteOf'), false, file);
    assert.equal(src.includes('normalizeExcessCashNote'), false, file);
    assert.equal(src.includes('excessCashNote'), false, file);
  }
});

test('Plan 395: the receipt never reads the excess note — receipts are untouched', () => {
  const receiptModule = 'receipt-' + 'script.js';
  for (const file of ['receipt.js', receiptModule, 'png-receipt.js']) {
    const src = fs.readFileSync(path.join(ROOT, '..', file), 'utf8');
    assert.equal(src.includes('excessCashNoteOf'), false, file);
    assert.equal(src.includes('normalizeExcessCashNote'), false, file);
  }
});

test('Plan 395: no new store — the note rides the payment record', () => {
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(coreSrc.includes('shahdara_excess'), false);
});

test('Plan 395: no new styling and no new language keys', () => {
  assert.equal(stylesSrc.includes('.ecn-'), false);
  assert.equal(stylesSrc.includes('excess-cash'), false);
  assert.equal(langSrc.includes('excessCash'), false);
  assert.equal(indexSrc.includes('quickCollectExcessCashPurposeSelect'), true);
});

test('Plan 395: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.ok(!mobilePattern.test(testSrc), 'test carries a realistic phone number');
  assert.ok(!testSrc.includes(fakeFamily), 'test carries a phone-like number');
  for (const name of ['Ki' + 'ran', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Ahmed ' + 'Khan']) {
    assert.ok(!testSrc.includes(name), `test carries a real customer name: ${name}`);
  }
});
