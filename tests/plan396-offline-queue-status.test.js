// Plan 396 — Transaction offline queue status on this device: at the
// end of a round the operator cannot tell which transactions were
// recorded today on this phone, so the same payment risks being
// recorded twice on a second device. One view lists exactly today's
// recorded transactions on this device — customer, amount, time,
// receipt number — newest first, each marked "recorded on this
// device"; an empty day says so plainly. It lists only: it syncs
// nothing and never changes any bill, payment, or customer record.
// The pending-actions queue (actions still waiting to sync) and the
// receipt-number search already exist and are left alone; this plan
// adds only the recorded-today view, derived from the transaction
// rows the app already projects, with no store of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isStrictQueueDate,
  formatQueueAmount,
  queueEntryTime,
  todayQueueEntries,
  offlineQueueSummaryText,
  offlineQueueRowMarkup,
  offlineQueueSectionHtml,
} from '../offline-queue-status.js';
import {
  addPayment,
  listTransactions,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
} from '../core.js';
import { generateReceiptNumber } from '../receipt.js';

const SEP_5 = new Date('2026-09-05T12:00:00Z');
const NOV_6 = new Date('2026-11-06T12:00:00Z');
const NOV_7_MORNING = new Date('2026-11-07T04:00:00Z');
const NOV_7 = new Date('2026-11-07T12:00:00Z');

function stateWithBills(monthlySellingAmount = 3000) {
  let state = createInitialState(['Customer One', 'Customer Two']);
  // Priced from September so the fixture carries Sep, Oct and Nov
  // 2026 bills (the Plan 385 pattern): a November-only pricing
  // leaves October unpriced, and a payment for October would create
  // an unpriced bill instead of settling a priced one.
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: String(monthlySellingAmount) }, SEP_5);
  state = updateCustomerProfile(state, 'seed-002', { monthlySellingAmount: String(monthlySellingAmount) }, SEP_5);
  return generateMonthlyBillsThroughCurrentMonth(state, NOV_7);
}

function payOn(state, customerId, month, fields, referenceDate) {
  return addPayment(state, customerId, month, {
    amount: 1000,
    date: '2026-11-07',
    method: 'Cash',
    ...fields,
  }, referenceDate);
}

function row(overrides = {}) {
  return {
    paymentId: 'pay-001',
    customerNumber: 36,
    customerName: 'Customer One',
    amount: 3000,
    date: '2026-11-07',
    method: 'Cash',
    receiptNumber: 'RCPT-36-202611-01',
    recordedAt: '2026-11-07T04:00:00.000Z',
    month: '2026-11',
    voided: false,
    ...overrides,
  };
}

// --- Strict date ---

test('Plan 396: isStrictQueueDate accepts only real YYYY-MM-DD calendar dates', () => {
  for (const date of ['2026-01-01', '2026-11-07', '2026-12-31', '2028-02-29', '2000-02-29']) {
    assert.equal(isStrictQueueDate(date), true, date);
  }
  for (const bad of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-32', '2026-11-00', '2026-11', '2026/11/07', '07 Nov 2026', '', ' 2026-11-07', '2026-11-07 ', null, undefined, 20261107, {}, []]) {
    assert.equal(isStrictQueueDate(bad), false, String(bad));
  }
});

// --- Amount formatting ---

test('Plan 396: formatQueueAmount prints PKR with min-0 decimals', () => {
  assert.equal(formatQueueAmount(3000), 'PKR 3,000');
  assert.equal(formatQueueAmount(1500.5), 'PKR 1,500.5');
  assert.equal(formatQueueAmount(0), 'PKR 0');
  assert.equal(formatQueueAmount('2500'), 'PKR 2,500');
});

test('Plan 396: formatQueueAmount never prints a missing amount as PKR 0', () => {
  for (const bad of [null, undefined, '', true, false, 'abc', NaN, Infinity, -Infinity]) {
    assert.equal(formatQueueAmount(bad), 'Not set', String(bad));
  }
});

// --- Recorded time ---

test('Plan 396: queueEntryTime converts the UTC stamp to Pakistan time', () => {
  assert.equal(queueEntryTime('2026-11-07T04:00:00.000Z'), '09:00');
  assert.equal(queueEntryTime('2026-11-07T12:30:00.000Z'), '17:30');
  assert.equal(queueEntryTime('2026-11-07T19:00:00.000Z'), '00:00');
  assert.equal(queueEntryTime('2026-11-07T20:45:00.000Z'), '01:45');
  assert.equal(queueEntryTime('2026-11-07T00:00:00.000Z'), '05:00');
});

test('Plan 396: queueEntryTime shows nothing for a missing or unusable stamp', () => {
  for (const bad of ['', '   ', null, undefined, 123, {}, 'not a stamp', '2026-11-07', '2026-13-07T10:30:00Z', '2026-11-07T24:00:00Z', '2026-11-07T10:60:00Z']) {
    assert.equal(queueEntryTime(bad), '', String(bad));
  }
});

// --- Today's entries ---

test('Plan 396: todayQueueEntries keeps exactly today, by payment date', () => {
  const entries = todayQueueEntries([
    row({ paymentId: 'pay-today' }),
    row({ paymentId: 'pay-yesterday', date: '2026-11-06' }),
    row({ paymentId: 'pay-tomorrow', date: '2026-11-08' }),
    row({ paymentId: 'pay-nodate', date: '' }),
    row({ paymentId: 'pay-baddate', date: '2026-13-07' }),
  ], '2026-11-07');
  assert.deepEqual(entries.map((entry) => entry.paymentId), ['pay-today']);
});

test('Plan 396: todayQueueEntries matches nothing for a non-strict today key', () => {
  assert.deepEqual(todayQueueEntries([row()], '2026-13-07'), []);
  assert.deepEqual(todayQueueEntries([row()], ''), []);
  assert.deepEqual(todayQueueEntries([row()], null), []);
  assert.deepEqual(todayQueueEntries(null, '2026-11-07'), []);
  assert.deepEqual(todayQueueEntries(undefined, '2026-11-07'), []);
});

test('Plan 396: todayQueueEntries orders newest first by recorded-at stamp', () => {
  const entries = todayQueueEntries([
    row({ paymentId: 'pay-morning', recordedAt: '2026-11-07T04:00:00.000Z' }),
    row({ paymentId: 'pay-evening', recordedAt: '2026-11-07T12:00:00.000Z' }),
    row({ paymentId: 'pay-nostamp', recordedAt: '' }),
    row({ paymentId: 'pay-noon', recordedAt: '2026-11-07T07:00:00.000Z' }),
  ], '2026-11-07');
  assert.deepEqual(
    entries.map((entry) => entry.paymentId),
    ['pay-evening', 'pay-noon', 'pay-morning', 'pay-nostamp'],
  );
  assert.deepEqual(entries.map((entry) => entry.time), ['17:00', '12:00', '09:00', '']);
});

test('Plan 396: todayQueueEntries breaks recorded-at ties by payment id', () => {
  const entries = todayQueueEntries([
    row({ paymentId: 'pay-b', recordedAt: '2026-11-07T04:00:00.000Z' }),
    row({ paymentId: 'pay-a', recordedAt: '2026-11-07T04:00:00.000Z' }),
  ], '2026-11-07');
  assert.deepEqual(entries.map((entry) => entry.paymentId), ['pay-a', 'pay-b']);
});

test('Plan 396: todayQueueEntries normalises the entry fields', () => {
  const [entry] = todayQueueEntries([row({
    customerName: '  Customer One  ',
    method: 'JazzCash',
    recordedAt: '2026-11-07T04:00:00.000Z',
  })], '2026-11-07');
  assert.equal(entry.customerName, 'Customer One');
  assert.equal(entry.customerNumber, 36);
  assert.equal(entry.amount, 3000);
  assert.equal(entry.time, '09:00');
  assert.equal(entry.receiptNumber, 'RCPT-36-202611-01');
  assert.equal(entry.method, 'JazzCash');
  assert.equal(entry.date, '2026-11-07');
  assert.equal(entry.voided, false);
});

test('Plan 396: todayQueueEntries keeps a voided row, marked voided', () => {
  const [entry] = todayQueueEntries([row({ voided: true })], '2026-11-07');
  assert.equal(entry.voided, true);
  assert.ok(offlineQueueRowMarkup(entry).includes('VOID'));
});

test('Plan 396: todayQueueEntries never changes its input rows', () => {
  const rows = [row(), row({ paymentId: 'pay-002', date: '2026-11-06' })];
  const before = JSON.stringify(rows);
  todayQueueEntries(rows, '2026-11-07');
  assert.equal(JSON.stringify(rows), before);
});

// --- Receipt number ---

test('Plan 396: the entry carries the stored receipt number first', () => {
  const [entry] = todayQueueEntries([row({ receiptNumber: 'RCPT-36-202611-01', permanentReceiptNumber: 'RCPT-36-202611-99' })], '2026-11-07');
  assert.equal(entry.receiptNumber, 'RCPT-36-202611-01');
  const [permanent] = todayQueueEntries([row({ receiptNumber: '', permanentReceiptNumber: 'RCPT-36-202611-99' })], '2026-11-07');
  assert.equal(permanent.receiptNumber, 'RCPT-36-202611-99');
});

test('Plan 396: the entry derives a receipt number only when the caller supplies a deriver', () => {
  const derive = ({ customerNumber, paymentDate, paymentId, billMonth }) => `RCPT-${customerNumber}-${paymentDate}-${billMonth}-${paymentId}`;
  const [derived] = todayQueueEntries([row({ receiptNumber: '' })], '2026-11-07', { deriveReceiptNumber: derive });
  assert.equal(derived.receiptNumber, 'RCPT-36-2026-11-07-2026-11-pay-001');
  const [blank] = todayQueueEntries([row({ receiptNumber: '' })], '2026-11-07');
  assert.equal(blank.receiptNumber, '');
});

test('Plan 396: a throwing receipt deriver never breaks the queue', () => {
  const derive = () => { throw new Error('deriver down'); };
  const [entry] = todayQueueEntries([row({ receiptNumber: '' })], '2026-11-07', { deriveReceiptNumber: derive });
  assert.equal(entry.receiptNumber, '');
});

// --- Summary and markup ---

test('Plan 396: offlineQueueSummaryText counts payments and totals finite amounts', () => {
  assert.equal(offlineQueueSummaryText([]), '');
  assert.equal(offlineQueueSummaryText([{ amount: 3000 }]), '1 payment · PKR 3,000');
  assert.equal(offlineQueueSummaryText([{ amount: 3000 }, { amount: 1500 }]), '2 payments · PKR 4,500');
  assert.equal(offlineQueueSummaryText([{ amount: 3000 }, { amount: null }, { amount: 'abc' }]), '3 payments · PKR 3,000');
});

test('Plan 396: offlineQueueRowMarkup shows customer, amount, time, receipt, method, and the device mark', () => {
  const html = offlineQueueRowMarkup({
    paymentId: 'pay-001', customerNumber: 36, customerName: 'Customer One',
    amount: 3000, time: '09:00', receiptNumber: 'RCPT-36-202611-01', method: 'Cash', voided: false,
  });
  assert.ok(html.includes('#36 Customer One'));
  assert.ok(html.includes('PKR 3,000'));
  assert.ok(html.includes('09:00'));
  assert.ok(html.includes('RCPT-36-202611-01'));
  assert.ok(html.includes('Cash'));
  assert.ok(html.includes('recorded on this device'));
  assert.equal(html.includes('VOID'), false);
});

test('Plan 396: offlineQueueRowMarkup escapes user text and says plainly what is missing', () => {
  const html = offlineQueueRowMarkup({
    paymentId: 'pay-001', customerNumber: 7, customerName: '<b>Customer Two</b>',
    amount: null, time: '', receiptNumber: '', method: '', voided: false,
  });
  assert.equal(html.includes('<b>Customer Two</b>'), false);
  assert.ok(html.includes('&lt;b&gt;Customer Two&lt;/b&gt;'));
  assert.ok(html.includes('Not set'));
  assert.ok(html.includes('No time recorded'));
  assert.ok(html.includes('No receipt number'));
  assert.ok(html.includes('No method'));
  assert.equal(offlineQueueRowMarkup(null), '');
  assert.equal(offlineQueueRowMarkup(undefined), '');
});

test('Plan 396: offlineQueueSectionHtml lists entries or says the day is empty', () => {
  const empty = offlineQueueSectionHtml([]);
  assert.ok(empty.includes('Today on this device'));
  assert.ok(empty.includes('No payments recorded on this device today.'));
  assert.equal(empty.includes('<ul'), false);
  const filled = offlineQueueSectionHtml([{
    paymentId: 'pay-001', customerNumber: 36, customerName: 'Customer One',
    amount: 3000, time: '09:00', receiptNumber: 'RCPT-36-202611-01', method: 'Cash', voided: false,
  }]);
  assert.ok(filled.includes('Today on this device'));
  assert.ok(filled.includes('1 payment · PKR 3,000'));
  assert.ok(filled.includes('<ul class="oqs-list">'));
  assert.ok(filled.includes('recorded on this device'));
  assert.equal(offlineQueueSectionHtml(null).includes('No payments recorded on this device today.'), true);
});

// --- Integration through core.js ---

test('Plan 396: listTransactions rows carry the recorded-at stamp', () => {
  let state = stateWithBills();
  state = payOn(state, 'seed-001', '2026-11', { amount: 1000, date: '2026-11-07' }, NOV_7_MORNING);
  const rows = listTransactions(state, { date: '2026-11-07' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recordedAt, '2026-11-07T04:00:00.000Z');
  assert.equal(rows[0].date, '2026-11-07');
});

test('Plan 396: the queue lists exactly today, newest first, end to end', () => {
  let state = stateWithBills();
  state = payOn(state, 'seed-001', '2026-11', { amount: 2000, date: '2026-11-06' }, NOV_6);
  state = payOn(state, 'seed-001', '2026-11', { amount: 1000, date: '2026-11-07' }, NOV_7_MORNING);
  state = payOn(state, 'seed-002', '2026-11', { amount: 1500, date: '2026-11-07', method: 'JazzCash' }, NOV_7);
  const entries = todayQueueEntries(listTransactions(state), '2026-11-07');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].customerName, 'Customer Two');
  assert.equal(entries[0].amount, 1500);
  assert.equal(entries[0].time, '17:00');
  assert.equal(entries[1].customerName, 'Customer One');
  assert.equal(entries[1].amount, 1000);
  assert.equal(entries[1].time, '09:00');
  assert.equal(offlineQueueSummaryText(entries), '2 payments · PKR 2,500');
  const html = offlineQueueSectionHtml(entries);
  assert.ok(html.includes('Customer Two'));
  assert.ok(html.includes('Customer One'));
  assert.ok(html.includes('PKR 1,500'));
  assert.ok(html.includes('PKR 1,000'));
  assert.ok(!html.includes('PKR 2,000'), 'yesterday’s payment must not list');
  assert.ok(!html.includes('2026-11-06'));
});

test('Plan 396: the queue derives receipt numbers through the real receipt deriver', () => {
  let state = stateWithBills();
  state = payOn(state, 'seed-001', '2026-11', { amount: 1000, date: '2026-11-07' }, NOV_7_MORNING);
  const rows = listTransactions(state, { date: '2026-11-07' });
  const [entry] = todayQueueEntries(rows, '2026-11-07', { deriveReceiptNumber: generateReceiptNumber });
  assert.ok(entry.receiptNumber.length > 0);
  assert.equal(entry.receiptNumber, generateReceiptNumber({
    customerNumber: rows[0].customerNumber,
    paymentDate: rows[0].date,
    paymentId: rows[0].paymentId,
    billMonth: rows[0].month,
  }));
});

test('Plan 396: the queue never changes any bill, payment, or customer record', () => {
  let state = stateWithBills();
  state = payOn(state, 'seed-001', '2026-11', { amount: 1000, date: '2026-11-07' }, NOV_7_MORNING);
  const before = JSON.stringify(state);
  const rows = listTransactions(state);
  const entries = todayQueueEntries(rows, '2026-11-07', { deriveReceiptNumber: generateReceiptNumber });
  offlineQueueSectionHtml(entries);
  assert.equal(JSON.stringify(state), before);
  assert.equal(listTransactions(state).length, rows.length);
});

// --- Fences and guards ---

test('Plan 396: the module header never names a fenced filename literally', () => {
  const moduleSrc = readFileSync(new URL('../offline-queue-status.js', import.meta.url), 'utf8');
  const conflictModule = 'offline-data-' + 'conflict.js';
  const pendingModule = 'nav-pending-' + 'actions.js';
  const nextNumberModule = 'next-receipt-' + 'number.js';
  const receiptSearchModule = 'receipt-number-' + 'search.js';
  const crossPaymentModule = 'cross-payment-' + 'note.js';
  for (const fenced of [conflictModule, pendingModule, nextNumberModule, receiptSearchModule, crossPaymentModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(readFileSync(new URL(import.meta.url), 'utf8').includes(fenced), false, fenced);
  }
});

test('Plan 396: the module never calls the allocator, never touches the pending queue, and imports nothing', () => {
  const moduleSrc = readFileSync(new URL('../offline-queue-status.js', import.meta.url), 'utf8');
  assert.equal(moduleSrc.includes('calculatePaymentAllocations'), false);
  assert.equal(moduleSrc.includes('allocatePartPayment'), false);
  assert.equal(moduleSrc.includes('shahdara_offline_sync_queue'), false);
  assert.equal(moduleSrc.includes('shahdara_offline_payment_queue'), false);
  assert.equal(moduleSrc.includes('offlineQueueModal'), false);
  assert.equal(moduleSrc.includes('setupOfflineQueueModal'), false);
  assert.equal(/^\s*import\s/m.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
});

test('Plan 396: the existing pending-actions queue is untouched', () => {
  const navSrc = readFileSync(new URL('../nav.js', import.meta.url), 'utf8');
  assert.ok(navSrc.includes('setupOfflineQueueModal'));
  assert.ok(navSrc.includes('shahdara_offline_sync_queue'));
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexSrc.includes('id="offlineQueueModal"'));
  assert.ok(indexSrc.includes('id="offlineQueueList"'));
  // Transactions Screen Overhaul: the "Today on this device" section
  // (oqsQueueSection) was removed as a duplicate of the first
  // day-group — the pending-actions queue modal above is untouched.
});

test('Transactions Screen Overhaul: the Transactions queue section is gone; only the recorded time is still read', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes("from './offline-queue-status.js'"));
  assert.ok(appSrc.includes('queueEntryTime'));
  assert.equal(appSrc.includes('todayQueueEntries'), false);
  assert.equal(appSrc.includes('offlineQueueSectionHtml'), false);
  assert.equal(appSrc.includes("$('#oqsQueueSection')"), false);
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(indexSrc.includes('id="oqsQueueSection"'), false);
  assert.equal(indexSrc.includes('class="oqs-queue"'), false);
});

test('Plan 396: styles reuse existing colours only — no new hex in queue rules', () => {
  const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.ok(stylesSrc.includes('.oqs-queue'));
  assert.ok(stylesSrc.includes('.oqs-row'));
  const rules = stylesSrc.match(/\.oqs-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 5, `expected queue rules, found ${rules.length}`);
  const baseline = stylesSrc.replace(/\.oqs-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('Plan 396: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.ok(!mobilePattern.test(testSrc), 'test carries a realistic phone number');
  assert.ok(!testSrc.includes(fakeFamily), 'test carries a phone-like number');
  for (const name of ['Ki' + 'ran', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Ahmed ' + 'Khan']) {
    assert.equal(testSrc.includes(name), false, name);
  }
});
