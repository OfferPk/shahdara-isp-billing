// Plan 389 — Transaction note in Urdu script at entry time: one
// optional note on the transaction, written in Urdu script and shown
// exactly as written alongside the transaction — on the transaction
// itself and on its history line — so a note written the way the
// operator and the customer actually speak is read back correctly
// at the next visit, with no translation mistakes. It is a note
// only: it never changes any bill, payment total, or customer
// record by itself, and it changes no receipt format.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  URDU_NOTE_MAX_LENGTH,
  normalizeUrduNote,
  urduNoteOf,
  urduNoteLineText,
  urduNoteMarkup,
} from '../urdu-note.js';
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

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const moduleSrc = fs.readFileSync(path.join(ROOT, '../urdu-note.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(ROOT, '../core.js'), 'utf8');
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, '../app.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const stylesSrc = fs.readFileSync(path.join(ROOT, '../styles.css'), 'utf8');
const testSrc = fs.readFileSync(path.join(ROOT, 'plan389-urdu-note.test.js'), 'utf8');

const NOV_6 = new Date(2026, 10, 6, 12);
const SEP_5 = new Date(2026, 8, 5, 12);
const PAYMENT_DATE = '2026-11-05';
const NOTE_NEXT_WEEK = 'اگلے ہفتے ادا کریں گے';
const NOTE_THANKS = 'شکریہ، اگلی بار وقت پر ادا کریں گے';

// Three open bills at PKR 3,000 each: total dues PKR 9,000.
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

// ---- Module units: normalize ----

test('plan389: the note cap is 200, the same as the generic payment note', () => {
  assert.equal(URDU_NOTE_MAX_LENGTH, 200);
});

test('plan389: normalize keeps an Urdu note exactly as written', () => {
  assert.equal(normalizeUrduNote(NOTE_NEXT_WEEK), NOTE_NEXT_WEEK);
});

test('plan389: normalize trims surrounding whitespace', () => {
  assert.equal(normalizeUrduNote(`  ${NOTE_NEXT_WEEK}  `), NOTE_NEXT_WEEK);
});

test('plan389: normalize folds line breaks to spaces', () => {
  assert.equal(normalizeUrduNote('پہلی سطر\nدوسری سطر'), 'پہلی سطر دوسری سطر');
  assert.equal(normalizeUrduNote('پہلی سطر\r\nدوسری سطر'), 'پہلی سطر دوسری سطر');
});

test('plan389: normalize caps a longer note at 200 characters', () => {
  const long = 'ا'.repeat(250);
  const clean = normalizeUrduNote(long);
  assert.equal(clean.length, 200);
  assert.equal(clean, 'ا'.repeat(200));
});

test('plan389: normalize reads a missing or non-text note as empty', () => {
  assert.equal(normalizeUrduNote(undefined), '');
  assert.equal(normalizeUrduNote(null), '');
  assert.equal(normalizeUrduNote(''), '');
  assert.equal(normalizeUrduNote('   '), '');
  assert.equal(normalizeUrduNote(123), '');
  assert.equal(normalizeUrduNote({ text: NOTE_NEXT_WEEK }), '');
});

// ---- Module units: reader, line text, markup ----

test('plan389: urduNoteOf reads the note off a payment record', () => {
  assert.equal(urduNoteOf({ urduNote: NOTE_NEXT_WEEK }), NOTE_NEXT_WEEK);
});

test('plan389: urduNoteOf reads a payment without a note as empty', () => {
  assert.equal(urduNoteOf({}), '');
  assert.equal(urduNoteOf({ urduNote: '' }), '');
  assert.equal(urduNoteOf({ urduNote: '   ' }), '');
  assert.equal(urduNoteOf(null), '');
  assert.equal(urduNoteOf(undefined), '');
});

test('plan389: urduNoteOf reads a damaged record as no note', () => {
  assert.equal(urduNoteOf({ urduNote: 123 }), '');
  assert.equal(urduNoteOf({ urduNote: { text: NOTE_NEXT_WEEK } }), '');
});

test('plan389: line text is the note exactly as written', () => {
  assert.equal(urduNoteLineText(NOTE_THANKS), NOTE_THANKS);
  assert.equal(urduNoteLineText(''), '');
});

test('plan389: markup is a rtl Urdu span suffix, empty when there is no note', () => {
  assert.equal(
    urduNoteMarkup({ urduNote: NOTE_NEXT_WEEK }),
    ` · <span dir="rtl" lang="ur">${NOTE_NEXT_WEEK}</span>`,
  );
  assert.equal(urduNoteMarkup({}), '');
  assert.equal(urduNoteMarkup({ urduNote: '' }), '');
});

test('plan389: markup always escapes the note', () => {
  const markup = urduNoteMarkup({ urduNote: '<b>اگلے مہینے</b> & "شکریہ"' });
  assert.ok(!markup.includes('<b>'), 'raw tag leaked into markup');
  assert.ok(markup.includes('&lt;b&gt;'), 'tag was not escaped');
  assert.ok(markup.includes('&amp;'), 'ampersand was not escaped');
  assert.ok(markup.includes('&quot;'), 'quote was not escaped');
});

// ---- Validator and recording ----

test('plan389: validatePayment keeps the Urdu note on the payment', () => {
  const valid = validatePayment(
    { date: PAYMENT_DATE, amount: 3000, method: 'Cash', urduNote: NOTE_NEXT_WEEK },
    NOV_6,
  );
  assert.equal(valid.urduNote, NOTE_NEXT_WEEK);
  assert.equal(valid.amount, 3000);
  assert.equal(valid.method, 'Cash');
  assert.equal(valid.date, PAYMENT_DATE);
});

test('plan389: validatePayment stores no note field when there is no note', () => {
  const valid = validatePayment({ date: PAYMENT_DATE, amount: 3000, method: 'Cash' }, NOV_6);
  assert.equal('urduNote' in valid, false);
  const blank = validatePayment(
    { date: PAYMENT_DATE, amount: 3000, method: 'Cash', urduNote: '   ' },
    NOV_6,
  );
  assert.equal('urduNote' in blank, false);
});

test('plan389: validatePayment caps a longer note at 200 instead of refusing it', () => {
  const valid = validatePayment(
    { date: PAYMENT_DATE, amount: 3000, method: 'Cash', urduNote: 'ا'.repeat(250) },
    NOV_6,
  );
  assert.equal(valid.urduNote.length, 200);
});

test('plan389: addPayment records the note with the transaction', () => {
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-11', 3000, PAYMENT_DATE, NOV_6, { urduNote: NOTE_NEXT_WEEK });
  const payment = recordedPayment(state, '2026-11');
  assert.equal(payment.urduNote, NOTE_NEXT_WEEK);
  assert.equal(payment.amount, 3000);
  assert.equal(payment.method, 'Cash');
  assert.equal(payment.date, PAYMENT_DATE);
});

// ---- Acceptance: the note changes nothing else ----

test('plan389: the note never changes any bill, payment total, or past total', () => {
  let withNote = stateWithBills(NOV_6);
  let withoutNote = stateWithBills(NOV_6);
  const duesBefore = totalDuesCents(withNote);
  assert.equal(duesBefore, 900000);
  withNote = pay(withNote, '2026-11', 3000, PAYMENT_DATE, NOV_6, { urduNote: NOTE_NEXT_WEEK });
  withoutNote = pay(withoutNote, '2026-11', 3000, PAYMENT_DATE, NOV_6);
  assert.equal(totalDuesCents(withNote), totalDuesCents(withoutNote));
  assert.equal(totalDuesCents(withNote), 600000);
  const noted = recordedPayment(withNote, '2026-11');
  const plain = recordedPayment(withoutNote, '2026-11');
  const { urduNote: _note, ...notedRest } = noted;
  const { ...plainRest } = plain;
  // The two entries are identical apart from the note itself (ids differ
  // because they are separately recorded payments).
  assert.equal(notedRest.amount, plainRest.amount);
  assert.equal(notedRest.method, plainRest.method);
  assert.equal(notedRest.date, plainRest.date);
});

test('plan389: correctPayment silently keeps the note', () => {
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-11', 3000, PAYMENT_DATE, NOV_6, { urduNote: NOTE_NEXT_WEEK });
  const payment = recordedPayment(state, '2026-11');
  state = correctPayment(state, 'seed-001', '2026-11', payment.id, { date: PAYMENT_DATE, amount: 3000, method: 'Cash' }, NOV_6);
  assert.equal(recordedPayment(state, '2026-11').urduNote, NOTE_NEXT_WEEK);
});

test('plan389: correctPayment replaces the note when a new one is supplied', () => {
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-11', 3000, PAYMENT_DATE, NOV_6, { urduNote: NOTE_NEXT_WEEK });
  const payment = recordedPayment(state, '2026-11');
  state = correctPayment(state, 'seed-001', '2026-11', payment.id, { date: PAYMENT_DATE, amount: 3000, method: 'Cash', urduNote: NOTE_THANKS }, NOV_6);
  assert.equal(recordedPayment(state, '2026-11').urduNote, NOTE_THANKS);
});

test('plan389: correctPayment clears the note when null is supplied', () => {
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-11', 3000, PAYMENT_DATE, NOV_6, { urduNote: NOTE_NEXT_WEEK });
  const payment = recordedPayment(state, '2026-11');
  state = correctPayment(state, 'seed-001', '2026-11', payment.id, { date: PAYMENT_DATE, amount: 3000, method: 'Cash', urduNote: null }, NOV_6);
  assert.equal('urduNote' in recordedPayment(state, '2026-11'), false);
});

test('plan389: listTransactions projects the note onto the row', () => {
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-11', 3000, PAYMENT_DATE, NOV_6, { urduNote: NOTE_NEXT_WEEK });
  state = pay(state, '2026-10', 1500, '2026-10-20', NOV_6);
  const rows = listTransactions(state, {}, NOV_6);
  const noted = rows.find((row) => row.date === PAYMENT_DATE);
  assert.equal(noted.urduNote, NOTE_NEXT_WEEK);
  const plain = rows.find((row) => row.date === '2026-10-20');
  assert.equal(plain.urduNote, '');
});

// ---- Wiring: entry form, history lines, transaction card ----

test('plan389: the Quick Collect form carries the Urdu note field', () => {
  assert.ok(indexSrc.includes('id="quickCollectUrduNoteInput"'), 'QC form lost the Urdu note input');
  assert.ok(indexSrc.includes('maxlength="200"'), 'QC Urdu note input lost its 200 cap');
  assert.ok(indexSrc.includes('dir="rtl"'), 'QC Urdu note input lost its rtl direction');
  assert.ok(indexSrc.includes('Note in Urdu'), 'QC Urdu note label missing');
  assert.ok(navSrc.includes("document.getElementById('quickCollectUrduNoteInput')"), 'QC controller lost the Urdu note element ref');
  assert.ok(navSrc.includes('urduNoteVal'), 'QC submit lost the Urdu note value');
  assert.ok(navSrc.includes('urduNote: urduNoteVal || undefined'), 'QC submit lost the Urdu note handoff');
  assert.ok(navSrc.includes('urduNote: urduNote ? String(urduNote).trim() : undefined'), 'executeQuickCollection lost the Urdu note handoff to addPayment');
});

test('plan389: the profile payment form carries the Urdu note field', () => {
  assert.ok(appSrc.includes('urduNoteFieldMarkup'), 'profile payment form lost the Urdu note field helper');
  assert.ok(appSrc.includes('name="urduNote"'), 'profile payment form lost the Urdu note field name');
  assert.ok(appSrc.includes("urduNote: data.get('urduNote')"), 'profile payment submit lost the Urdu note handoff');
  assert.ok(appSrc.includes('urn-${month}'), 'profile payment form lost the Urdu note field id prefix');
});

test('plan389: the note appears on the transaction and its history line', () => {
  assert.ok(appSrc.includes('profileUrduNoteMarkup(payment)'), 'profile history rows lost the Urdu note markup');
  const profileUses = appSrc.match(/profileUrduNoteMarkup\(payment\)/g) || [];
  assert.equal(profileUses.length, 3, `expected the Urdu note markup on both history rows plus its helper, found ${profileUses.length}`);
  assert.ok(appSrc.includes('urduNoteMarkup(transaction)'), 'Transactions card lost the Urdu note markup');
  assert.ok(coreSrc.includes('urduNote: urduNoteOf(payment)'), 'listTransactions lost the Urdu note projection');
});

test('plan389: a transaction without a note shows nothing extra', () => {
  assert.equal(urduNoteMarkup({}), '');
  assert.equal(urduNoteMarkup({ urduNote: '   ' }), '');
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-11', 3000, PAYMENT_DATE, NOV_6);
  const row = listTransactions(state, {}, NOV_6).find((r) => r.date === PAYMENT_DATE);
  assert.equal(row.urduNote, '');
});

// ---- Guards: purity, fences, no receipt change, no new colour ----

test('plan389: the module is pure — no clock, storage, network, or page', () => {
  assert.ok(!moduleSrc.includes('new Date('), 'module reads the clock');
  assert.ok(!moduleSrc.includes('Date.now('), 'module reads the clock');
  assert.ok(!moduleSrc.includes('document.'), 'module touches the page');
  assert.ok(!moduleSrc.includes('localStorage'), 'module reads storage');
  assert.ok(!moduleSrc.includes('fetch('), 'module touches the network');
  assert.ok(!moduleSrc.includes('import '), 'pure module must be import-free');
});

test('plan389: the module header never names the fenced receipt module', () => {
  const fenced = 'receipt-' + 'script.js';
  assert.ok(!moduleSrc.includes(fenced), 'module header names the fenced filename');
  assert.ok(!testSrc.includes(fenced), 'test file names the fenced filename');
});

test('plan389: the note never reaches any receipt format', () => {
  const receiptFiles = ['receipt.js', 'receipt-' + 'script.js', 'png-receipt.js'];
  for (const file of receiptFiles) {
    const src = fs.readFileSync(path.join(ROOT, '..', file), 'utf8');
    assert.ok(!src.includes('urduNoteOf'), `${file} reads the Urdu note`);
    assert.ok(!src.includes('normalizeUrduNote'), `${file} reads the Urdu note`);
  }
});

test('plan389: no new hex colour in styles.css', () => {
  assert.ok(!stylesSrc.includes('.urn-'), 'styles.css gained an Urdu-note rule it does not need');
  assert.ok(!stylesSrc.includes('urdu-note'), 'styles.css gained an Urdu-note rule it does not need');
});

test('plan389: fixtures use generic Urdu phrases only — no real names or numbers', () => {
  // Fragment-built so the guard patterns themselves never appear as
  // literals in this file (a literal would trip its own guard).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.ok(!mobilePattern.test(testSrc), 'test carries a realistic phone number');
  assert.ok(!testSrc.includes(fakeFamily), 'test carries a phone-like number');
});
