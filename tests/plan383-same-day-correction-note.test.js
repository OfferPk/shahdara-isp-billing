// Plan 383 — Transaction same-day correction note.
// One correction note on a transaction (what was wrong, what it
// should be, who recorded it, date), allowed only on the day the
// transaction was recorded and only as a note attached to the
// original. It corrects nothing by itself and never rewrites the
// original entry. A transaction without one shows the customer only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SAME_DAY_CORRECTION_WRONG_MAX_LENGTH,
  SAME_DAY_CORRECTION_SHOULD_BE_MAX_LENGTH,
  SAME_DAY_CORRECTION_RECORDED_BY_MAX_LENGTH,
  isStrictSameDayCorrectionDate,
  sameDayCorrectionAllowed,
  normalizeSameDayCorrectionNote,
  sameDayCorrectionNoteOf,
  sameDayCorrectionNoteLineText,
  sameDayCorrectionNoteMarkup,
} from '../same-day-correction-note.js';
import { validatePayment, addPayment, correctPayment, listTransactions, calculatePaymentAllocations } from '../core.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'same-day-correction-note.js'), 'utf8');
const coreSrc = readFileSync(join(dir, '..', 'core.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

const REF = new Date('2026-11-06T10:00:00Z');
const PAYMENT_DATE = '2026-11-06';

// Generic fixtures only — clearly made-up names, never a real person.
const RECORDER_ONE = 'Recorder One';
const RECORDER_TWO = 'Recorder Two';

function note(overrides = {}) {
  return {
    wrong: 'Method was Cash',
    shouldBe: 'Easypaisa',
    recordedBy: RECORDER_ONE,
    date: PAYMENT_DATE,
    ...overrides,
  };
}

function bill(month, dueAmount, payments = []) {
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    id: `B-${month}`,
    month,
    dueAmount,
    status: paid >= dueAmount ? 'paid' : paid > 0 ? 'partial' : 'pending',
    payments,
  };
}

function customerWithBills(bills, overrides = {}) {
  return {
    id: 'CUST-1',
    customerNumber: 1,
    name: 'Customer One',
    mohalla: 'Mohalla A',
    archived: false,
    monthlySellingAmount: 2500,
    bills,
    ...overrides,
  };
}

function stateWith(customer) {
  return { version: 1, nextCustomerNumber: 2, customers: [customer] };
}

function recordedPayment(state, month = '2026-11') {
  const customer = state.customers.find(c => c.id === 'CUST-1');
  const found = (customer.bills ?? []).find(b => b.month === month);
  return (found.payments ?? [])[0];
}

function stateWithNotedPayment() {
  let state = stateWith(customerWithBills([bill('2026-11', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-11', {
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
    sameDayCorrection: note(),
  }, REF);
  return state;
}

// ---------------------------------------------------------------------------
// Strict dates and the same-day rule
// ---------------------------------------------------------------------------

test('strict date: leap-aware, YYYY-MM-DD only', () => {
  assert.equal(isStrictSameDayCorrectionDate('2024-02-29'), true);
  assert.equal(isStrictSameDayCorrectionDate('2023-02-29'), false);
  assert.equal(isStrictSameDayCorrectionDate('2026-11-31'), false);
  assert.equal(isStrictSameDayCorrectionDate('2026-13-01'), false);
  assert.equal(isStrictSameDayCorrectionDate('2026-11-6'), false);
  assert.equal(isStrictSameDayCorrectionDate('2026-11-06'), true);
  assert.equal(isStrictSameDayCorrectionDate(null), false);
  assert.equal(isStrictSameDayCorrectionDate(''), false);
  assert.equal(isStrictSameDayCorrectionDate(20261106), false);
});

test('same-day rule: allowed only on the payment day itself', () => {
  const payment = { id: 'P-1', date: PAYMENT_DATE, amount: 1500, method: 'Cash' };
  assert.equal(sameDayCorrectionAllowed(payment, '2026-11-06'), true);
  assert.equal(sameDayCorrectionAllowed(payment, '2026-11-07'), false);
  assert.equal(sameDayCorrectionAllowed(payment, '2026-11-05'), false);
  assert.equal(sameDayCorrectionAllowed(payment, 'not-a-date'), false);
  assert.equal(sameDayCorrectionAllowed({ ...payment, date: '2026-11-31' }, '2026-11-31'), false);
  assert.equal(sameDayCorrectionAllowed(null, '2026-11-06'), false);
  assert.equal(sameDayCorrectionAllowed(undefined, '2026-11-06'), false);
});

// ---------------------------------------------------------------------------
// Normalizing the note
// ---------------------------------------------------------------------------

test('normalize: a plain note keeps wrong, should-be, recorder, and date', () => {
  assert.deepEqual(
    normalizeSameDayCorrectionNote(note(), PAYMENT_DATE),
    { wrong: 'Method was Cash', shouldBe: 'Easypaisa', recordedBy: RECORDER_ONE, date: PAYMENT_DATE },
  );
  assert.deepEqual(
    normalizeSameDayCorrectionNote(note({ recordedBy: RECORDER_TWO }), PAYMENT_DATE),
    { wrong: 'Method was Cash', shouldBe: 'Easypaisa', recordedBy: RECORDER_TWO, date: PAYMENT_DATE },
  );
});

test('normalize: wrong-only or should-be-only is still a note', () => {
  assert.deepEqual(
    normalizeSameDayCorrectionNote({ wrong: 'Method was Cash', date: PAYMENT_DATE }, PAYMENT_DATE),
    { wrong: 'Method was Cash', date: PAYMENT_DATE },
  );
  assert.deepEqual(
    normalizeSameDayCorrectionNote({ shouldBe: 'Easypaisa', recordedBy: RECORDER_ONE, date: PAYMENT_DATE }, PAYMENT_DATE),
    { shouldBe: 'Easypaisa', recordedBy: RECORDER_ONE, date: PAYMENT_DATE },
  );
  assert.equal(
    normalizeSameDayCorrectionNote({ recordedBy: RECORDER_ONE, date: PAYMENT_DATE }, PAYMENT_DATE),
    null,
  );
});

test('normalize: a note dated after the transaction day is refused', () => {
  assert.equal(normalizeSameDayCorrectionNote(note({ date: '2026-11-07' }), PAYMENT_DATE), null);
  assert.equal(normalizeSameDayCorrectionNote(note({ date: '2026-11-05' }), PAYMENT_DATE), null);
  assert.equal(normalizeSameDayCorrectionNote(note(), '2026-11-07'), null);
  assert.deepEqual(normalizeSameDayCorrectionNote(note(), PAYMENT_DATE), note());
});

test('normalize: a note with no usable date is refused', () => {
  assert.equal(normalizeSameDayCorrectionNote({ wrong: 'Method was Cash' }, PAYMENT_DATE), null);
  assert.equal(normalizeSameDayCorrectionNote({ wrong: 'Method was Cash', date: '2026-11-31' }, PAYMENT_DATE), null);
  assert.equal(normalizeSameDayCorrectionNote({ wrong: 'Method was Cash', date: '' }, PAYMENT_DATE), null);
});

test('normalize: line breaks fold to spaces, blanks are dropped', () => {
  assert.deepEqual(
    normalizeSameDayCorrectionNote({ wrong: 'Method\nwas Cash', shouldBe: 'Easy\r\npaisa', recordedBy: RECORDER_ONE, date: PAYMENT_DATE }, PAYMENT_DATE),
    { wrong: 'Method was Cash', shouldBe: 'Easy paisa', recordedBy: RECORDER_ONE, date: PAYMENT_DATE },
  );
  assert.equal(normalizeSameDayCorrectionNote({ wrong: '   ', shouldBe: '', recordedBy: '', date: PAYMENT_DATE }, PAYMENT_DATE), null);
});

test('normalize: nothing at all is not a note', () => {
  assert.equal(normalizeSameDayCorrectionNote({}, PAYMENT_DATE), null);
  assert.equal(normalizeSameDayCorrectionNote({ wrong: '', shouldBe: '', recordedBy: '', date: PAYMENT_DATE }, PAYMENT_DATE), null);
  assert.equal(normalizeSameDayCorrectionNote(null, PAYMENT_DATE), null);
  assert.equal(normalizeSameDayCorrectionNote(undefined, PAYMENT_DATE), null);
  assert.equal(normalizeSameDayCorrectionNote('wrong', PAYMENT_DATE), null);
  assert.equal(normalizeSameDayCorrectionNote(42, PAYMENT_DATE), null);
});

test('normalize: wrong and should-be cap at 200 chars, recorder at 60', () => {
  assert.equal(SAME_DAY_CORRECTION_WRONG_MAX_LENGTH, 200);
  assert.equal(SAME_DAY_CORRECTION_SHOULD_BE_MAX_LENGTH, 200);
  assert.equal(SAME_DAY_CORRECTION_RECORDED_BY_MAX_LENGTH, 60);
  const normalized = normalizeSameDayCorrectionNote({
    wrong: 'W'.repeat(240),
    shouldBe: 'S'.repeat(240),
    recordedBy: 'R'.repeat(90),
    date: PAYMENT_DATE,
  }, PAYMENT_DATE);
  assert.equal(normalized.wrong.length, 200);
  assert.equal(normalized.shouldBe.length, 200);
  assert.equal(normalized.recordedBy.length, 60);
  assert.equal(normalized.date, PAYMENT_DATE);
});

test('normalize: the input is never mutated', () => {
  const raw = note({ wrong: 'Method\nwas Cash' });
  normalizeSameDayCorrectionNote(raw, PAYMENT_DATE);
  assert.deepEqual(raw, note({ wrong: 'Method\nwas Cash' }));
});

// ---------------------------------------------------------------------------
// Reading the note off a payment record
// ---------------------------------------------------------------------------

test('sameDayCorrectionNoteOf: reads the field the validator keeps', () => {
  assert.deepEqual(
    sameDayCorrectionNoteOf({ id: 'P-1', date: PAYMENT_DATE, amount: 1500, method: 'Cash', sameDayCorrection: note() }),
    note(),
  );
});

test('sameDayCorrectionNoteOf: a payment without a note reads as null', () => {
  assert.equal(sameDayCorrectionNoteOf({ id: 'P-1', date: PAYMENT_DATE, amount: 1500, method: 'Cash' }), null);
  assert.equal(sameDayCorrectionNoteOf({ id: 'P-1', date: PAYMENT_DATE, amount: 1500, method: 'Cash', sameDayCorrection: note({ date: '2026-11-07' }) }), null);
  assert.equal(sameDayCorrectionNoteOf(null), null);
  assert.equal(sameDayCorrectionNoteOf(undefined), null);
});

// ---------------------------------------------------------------------------
// The note in plain words
// ---------------------------------------------------------------------------

test('line text: wrong, should-be, recorder, and date in plain words', () => {
  assert.equal(
    sameDayCorrectionNoteLineText(note()),
    'Correction 2026-11-06: Method was Cash, should be Easypaisa — by Recorder One',
  );
  assert.equal(
    sameDayCorrectionNoteLineText(note({ recordedBy: RECORDER_TWO })),
    'Correction 2026-11-06: Method was Cash, should be Easypaisa — by Recorder Two',
  );
});

test('line text: each part shows only when given', () => {
  assert.equal(
    sameDayCorrectionNoteLineText({ wrong: 'Method was Cash', date: PAYMENT_DATE }),
    'Correction 2026-11-06: Method was Cash',
  );
  assert.equal(
    sameDayCorrectionNoteLineText({ shouldBe: 'Easypaisa', date: PAYMENT_DATE }),
    'Correction 2026-11-06: should be Easypaisa',
  );
  assert.equal(
    sameDayCorrectionNoteLineText({ wrong: 'Method was Cash', shouldBe: 'Easypaisa', date: PAYMENT_DATE }),
    'Correction 2026-11-06: Method was Cash, should be Easypaisa',
  );
  assert.equal(sameDayCorrectionNoteLineText({}), '');
  assert.equal(sameDayCorrectionNoteLineText(null), '');
});

test('line text: caller-supplied labels are used', () => {
  assert.equal(
    sameDayCorrectionNoteLineText(note(), { correction: 'Fix', shouldBe: 'ought to be', by: 'via' }),
    'Fix 2026-11-06: Method was Cash, ought to be Easypaisa — via Recorder One',
  );
});

test('markup: a suffix for the payment-meta line, escaped, empty without a note', () => {
  assert.equal(
    sameDayCorrectionNoteMarkup({ id: 'P-1', date: PAYMENT_DATE, amount: 1500, method: 'Cash', sameDayCorrection: note() }),
    ' · Correction 2026-11-06: Method was Cash, should be Easypaisa — by Recorder One',
  );
  assert.equal(
    sameDayCorrectionNoteMarkup({ id: 'P-1', date: PAYMENT_DATE, amount: 1500, method: 'Cash', sameDayCorrection: note({ wrong: '<script>alert(1)</script>' }) }),
    ' · Correction 2026-11-06: &lt;script&gt;alert(1)&lt;/script&gt;, should be Easypaisa — by Recorder One',
  );
  assert.equal(
    sameDayCorrectionNoteMarkup({ id: 'P-1', date: PAYMENT_DATE, amount: 1500, method: 'Cash' }),
    '',
  );
});

// ---------------------------------------------------------------------------
// Recording the note with the payment
// ---------------------------------------------------------------------------

test('validatePayment: the note is kept when its date is the payment day', () => {
  const validated = validatePayment({
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
    sameDayCorrection: note(),
  }, REF);
  assert.deepEqual(validated.sameDayCorrection, note());
  assert.equal(validated.amount, 1500);
  assert.equal(validated.method, 'Cash');
});

test('validatePayment: a note dated after the payment day is refused', () => {
  assert.throws(() => validatePayment({
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
    sameDayCorrection: note({ date: '2026-11-07' }),
  }, REF), /only be recorded on the day of the payment/);
  assert.throws(() => validatePayment({
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
    sameDayCorrection: note({ date: '2026-11-05' }),
  }, REF), /only be recorded on the day of the payment/);
});

test('addPayment: the note is recorded with the payment', () => {
  const state = stateWith(customerWithBills([bill('2026-11', 3000)]));
  const next = addPayment(state, 'CUST-1', '2026-11', {
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
    sameDayCorrection: note(),
  }, REF);
  const recorded = recordedPayment(next);
  assert.deepEqual(recorded.sameDayCorrection, note());
  assert.equal(recorded.amount, 1500);
});

test('addPayment: a payment without a note records no note field', () => {
  const state = stateWith(customerWithBills([bill('2026-11', 3000)]));
  const next = addPayment(state, 'CUST-1', '2026-11', {
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
  }, REF);
  const recorded = recordedPayment(next);
  assert.equal('sameDayCorrection' in recorded, false);
});

test('correctPayment: a correction that says nothing about the note keeps it', () => {
  const state = stateWithNotedPayment();
  const id = recordedPayment(state).id;
  const next = correctPayment(state, 'CUST-1', '2026-11', id, {
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
  }, REF);
  const corrected = recordedPayment(next);
  assert.deepEqual(corrected.sameDayCorrection, note());
  assert.equal(corrected.date, PAYMENT_DATE);
});

test('correctPayment: a correction that supplies the note replaces it', () => {
  const state = stateWithNotedPayment();
  const id = recordedPayment(state).id;
  const next = correctPayment(state, 'CUST-1', '2026-11', id, {
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
    sameDayCorrection: note({ wrong: 'Amount was 1400', shouldBe: '1500', recordedBy: RECORDER_TWO }),
  }, REF);
  const corrected = recordedPayment(next);
  assert.deepEqual(corrected.sameDayCorrection, note({ wrong: 'Amount was 1400', shouldBe: '1500', recordedBy: RECORDER_TWO }));
});

test('correctPayment: a correction that empties the note clears it', () => {
  const state = stateWithNotedPayment();
  const id = recordedPayment(state).id;
  const next = correctPayment(state, 'CUST-1', '2026-11', id, {
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
    sameDayCorrection: null,
  }, REF);
  const corrected = recordedPayment(next);
  assert.equal('sameDayCorrection' in corrected, false);
});

test('correctPayment: moving the payment date away from the note day is refused', () => {
  const state = stateWithNotedPayment();
  const id = recordedPayment(state).id;
  assert.throws(() => correctPayment(state, 'CUST-1', '2026-11', id, {
    date: '2026-11-05',
    amount: 1500,
    method: 'Cash',
  }, REF), /Clear the note to change the payment date/);
  // Clearing the note in the same correction lets the date move.
  const next = correctPayment(state, 'CUST-1', '2026-11', id, {
    date: '2026-11-05',
    amount: 1500,
    method: 'Cash',
    sameDayCorrection: null,
  }, REF);
  const corrected = recordedPayment(next);
  assert.equal(corrected.date, '2026-11-05');
  assert.equal('sameDayCorrection' in corrected, false);
});

test('acceptance: the note never changes any bill, payment total, or past total', () => {
  const state = stateWithNotedPayment();
  const id = recordedPayment(state).id;
  const beforeDue = calculatePaymentAllocations(state).forMonth('CUST-1', '2026-11')?.balanceDueCents;
  const beforeBill = state.customers[0].bills[0].dueAmount;
  const beforePayment = { ...recordedPayment(state) };
  delete beforePayment.sameDayCorrection;
  // The note is already on this payment; re-record it through a fresh
  // correction that changes nothing else and compare every figure.
  const next = correctPayment(state, 'CUST-1', '2026-11', id, {
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
    sameDayCorrection: note(),
  }, REF);
  const after = recordedPayment(next);
  const afterDue = calculatePaymentAllocations(next).forMonth('CUST-1', '2026-11')?.balanceDueCents;
  assert.equal(afterDue, beforeDue);
  assert.equal(next.customers[0].bills[0].dueAmount, beforeBill);
  assert.equal(after.amount, beforePayment.amount);
  assert.equal(after.method, beforePayment.method);
  assert.equal(after.date, beforePayment.date);
  // The original entry is unchanged apart from the note itself.
  const { sameDayCorrection: _note, ...afterRest } = after;
  assert.deepEqual(afterRest, beforePayment);
});

test('listTransactions: the note rides the transaction row', () => {
  const state = stateWithNotedPayment();
  const rows = listTransactions(state, {}, REF);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].sameDayCorrection, note());
  assert.equal(rows[0].amount, 1500);
  assert.equal(rows[0].method, 'Cash');
});

test('listTransactions: a row without a note carries a null note', () => {
  let state = stateWith(customerWithBills([bill('2026-11', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-11', {
    date: PAYMENT_DATE,
    amount: 1500,
    method: 'Cash',
  }, REF);
  const rows = listTransactions(state, {}, REF);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sameDayCorrection, null);
});

// ---------------------------------------------------------------------------
// Wiring — the correction form records the note, the rows show it
// ---------------------------------------------------------------------------

test('wiring: the correction form carries the three note fields and passes them on', () => {
  assert.ok(appSrc.includes('sameDayCorrectionNoteFieldsMarkup'), 'correction form helper');
  assert.ok(appSrc.includes('edit-sdc-'), 'correction note field id prefix');
  assert.ok(appSrc.includes('name="correctionWrong"'), 'correction form carries the wrong field');
  assert.ok(appSrc.includes('name="correctionShouldBe"'), 'correction form carries the should-be field');
  assert.ok(appSrc.includes('name="correctionRecordedBy"'), 'correction form carries the recorded-by field');
  assert.ok(appSrc.includes('sameDayCorrection: correctionNote'), 'correction submit passes the note on');
  assert.ok(appSrc.includes("data.get('correctionWrong')"), 'correction submit reads the wrong field');
  assert.ok(appSrc.includes("data.get('correctionShouldBe')"), 'correction submit reads the should-be field');
  assert.ok(appSrc.includes("data.get('correctionRecordedBy')"), 'correction submit reads the recorded-by field');
  assert.ok(appSrc.includes('date: pktDateKey()'), 'correction submit stamps today as the note date');
  assert.ok(appSrc.includes("from './same-day-correction-note.js'"), 'app imports the module');
  assert.ok(appSrc.includes('profileSameDayCorrectionMarkup('), 'profile history shows the note');
  assert.ok(appSrc.includes('sameDayCorrectionNoteMarkup('), 'Transactions card shows the note');
  assert.ok(coreSrc.includes("from './same-day-correction-note.js'"), 'core imports the module');
});

test('wiring: the note appears beside the original on both history rows and the card', () => {
  const profileRows = appSrc.split('profileSameDayCorrectionMarkup(payment)').length - 1;
  assert.ok(profileRows >= 2, `expected the note on both profile history rows, found ${profileRows}`);
  assert.ok(appSrc.includes('sameDayCorrectionNoteMarkup(transaction)'), 'Transactions card shows the note');
  assert.ok(!indexSrc.includes('correctionWrong'), 'no new element id in index.html for this plan');
  assert.ok(!stylesSrc.includes('sdc'), 'no styles change for this plan');
});

test('wiring: the labels exist in both language tables', () => {
  for (const key of [
    'prof_sdc_wrong_label',
    'prof_sdc_wrong_ph',
    'prof_sdc_should_label',
    'prof_sdc_should_ph',
    'prof_sdc_by_label',
    'prof_sdc_by_ph',
    'prof_sdc_hist_correction',
    'prof_sdc_hist_should_be',
    'prof_sdc_hist_by',
  ]) {
    const count = langSrc.split(`${key}:`).length - 1;
    assert.ok(count >= 2, `language key ${key} must exist in both tables, found ${count}`);
  }
  assert.ok(langSrc.includes('What was wrong (optional)'), 'wrong label in English');
  assert.ok(langSrc.includes('کیا غلط تھا (اختیاری)'), 'wrong label in Urdu');
  assert.ok(langSrc.includes('درستگی'), 'history label in Urdu');
});

// ---------------------------------------------------------------------------
// Guards — purity, fences, no real names
// ---------------------------------------------------------------------------

test('guard: the module is pure — no store, no DOM, no clock, no network', () => {
  assert.ok(!moduleSrc.includes('shahdara_'), 'no store key');
  assert.ok(!moduleSrc.includes('localStorage'), 'no storage');
  assert.ok(!moduleSrc.includes('document.'), 'no document access');
  assert.ok(!moduleSrc.includes('window.'), 'no window access');
  assert.ok(!moduleSrc.includes('new Date('), 'no clock read');
  assert.ok(!moduleSrc.includes('Date.now('), 'no clock read');
  assert.ok(!moduleSrc.includes('fetch('), 'no network');
  assert.ok(!moduleSrc.includes('import '), 'no imports — pure module');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'no standalone OLT word');
});

test('guard: the module never names a fenced neighbour module', () => {
  // Neighbour modules are checked by filename only and left untouched:
  // the bill correction workflow, the bill correction approval trail,
  // and the part-payment receipt note. This plan is a note attached to
  // a transaction, not an edit, and must not re-implement any of them.
  // Filenames are built from fragments so this very test never
  // contains them literally either.
  const fenced = [
    'billing-' + 'corrections.js',
    'correction-' + 'approval.js',
    'part-payment-receipt-' + 'note.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('guard: no real person or customer name anywhere in this file', () => {
  // Names are built from fragments so the list itself never contains
  // one literally.
  const forbidden = [
    'Sa' + 'ad',
    'Ki' + 'ran',
    'Hai' + 'der',
    'Shu' + 'naid',
    'Kha' + 'zer',
    'Mo' + 'hsin',
    'Shar' + 'jell',
    'No' + 'mi',
    'Aq' + 'ib',
    'Ej' + 'az',
  ];
  for (const name of forbidden) {
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});
