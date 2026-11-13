// Plan 401 — Full transaction history list per customer:
// one read-only list per customer — every payment, charge, credit
// and refund in date order, with the amount and the running balance
// after each entry. The list is composed from existing records only:
// the bills already on the customer record plus the credit entries
// and refund records already stored on this device. It lists only
// and changes nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FULL_HISTORY_TYPES,
  FULL_HISTORY_TYPE_LABELS,
  FULL_HISTORY_EMPTY_TEXT,
  isStrictHistoryDate,
  fullHistoryEntries,
  formatHistoryAmount,
  fullHistoryRunningNote,
  fullHistoryEntryLineText,
  fullHistoryListHtml,
  fullHistorySummaryText,
} from '../full-history-list.js';

function bill(overrides = {}) {
  return {
    id: 'BILL-1',
    month: '2026-11',
    dueDate: '2026-11-05',
    dueAmount: 3000,
    status: 'pending',
    payments: [],
    ...overrides,
  };
}

function payment(overrides = {}) {
  return { id: 'PAY-1', amount: 3000, date: '2026-11-06', method: 'Cash', ...overrides };
}

function creditEntry(overrides = {}) {
  return {
    id: 'CR-1',
    customerId: 'CUST-1',
    source: 'overpayment',
    sourcePaymentId: 'PAY-1',
    amountCents: 50000,
    date: '2026-11-06',
    note: '',
    ...overrides,
  };
}

function refundRecord(overrides = {}) {
  return {
    id: 'RF-1',
    customerId: 'CUST-1',
    sourceKind: 'payment',
    sourceId: 'PAY-1',
    sourceAmountCents: 350000,
    amountCents: 20000,
    reason: 'Overcharge',
    method: 'Cash',
    refundDate: '2026-11-07',
    ...overrides,
  };
}

const CUSTOMER = 'CUST-1';

// --- Strict dates ---

test('Plan 401: strict history dates accept real dates only', () => {
  assert.equal(isStrictHistoryDate('2026-11-05'), true);
  assert.equal(isStrictHistoryDate('2028-02-29'), true);
  assert.equal(isStrictHistoryDate('2000-02-29'), true);
  assert.equal(isStrictHistoryDate('2026-02-29'), false);
  assert.equal(isStrictHistoryDate('1900-02-29'), false);
  assert.equal(isStrictHistoryDate('2100-02-29'), false);
  assert.equal(isStrictHistoryDate('2026-13-01'), false);
  assert.equal(isStrictHistoryDate('2026-11-31'), false);
  assert.equal(isStrictHistoryDate('2026-11-5'), false);
  assert.equal(isStrictHistoryDate(''), false);
  assert.equal(isStrictHistoryDate(null), false);
  assert.equal(isStrictHistoryDate(20261105), false);
});

// --- Charges ---

test('Plan 401: a bill becomes one charge entry with its due date and amount', () => {
  const entries = fullHistoryEntries({ customerId: CUSTOMER, bills: [bill()] });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, 'charge');
  assert.equal(entries[0].date, '2026-11-05');
  assert.equal(entries[0].month, '2026-11');
  assert.equal(entries[0].amountCents, 300000);
  assert.equal(entries[0].runningBalanceCents, 300000);
  assert.equal(entries[0].voided, false);
});

test('Plan 401: a charge with no due date falls back to its bill month', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ dueDate: undefined })],
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].date, '2026-11');
});

test('Plan 401: a bill with no due amount contributes no charge entry', () => {
  // Sharafat 12: an unpriced bill (dueAmount null — no charge yet)
  // still contributes nothing, but a priced zero bill (dueAmount 0)
  // now keeps a visible PKR 0 charge entry, so a fully-concessed
  // month still appears in history instead of vanishing from it.
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ dueAmount: null })],
  });
  assert.equal(entries.length, 0);
  const zeroEntries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ dueAmount: 0 })],
  });
  assert.equal(zeroEntries.length, 1);
  assert.equal(zeroEntries[0].type, 'charge');
  assert.equal(zeroEntries[0].amountCents, 0);
  assert.equal(zeroEntries[0].runningBalanceCents, 0);
});

// --- Payments ---

test('Plan 401: a normal payment reduces the running balance to settled', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment()] })],
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[1].type, 'payment');
  assert.equal(entries[1].date, '2026-11-06');
  assert.equal(entries[1].amountCents, 300000);
  assert.equal(entries[1].runningBalanceCents, 0);
  assert.equal(
    fullHistoryEntryLineText(entries[1]),
    '2026-11-06 · Payment · PKR 3,000 · Settled',
  );
});

test('Plan 401: an advance-kind payment is typed advance and reduces the balance', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ kind: 'advance', amount: 1000 })] })],
  });
  assert.equal(entries[1].type, 'advance');
  assert.equal(entries[1].runningBalanceCents, 200000);
});

test('Plan 401: a negative payment is a refund and adds back to the balance', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment(), payment({ id: 'PAY-2', amount: -1000, date: '2026-11-07' })] })],
  });
  assert.equal(entries.length, 3);
  assert.equal(entries[2].type, 'refund');
  assert.equal(entries[2].amountCents, 100000);
  assert.equal(entries[2].runningBalanceCents, 100000);
  assert.equal(fullHistoryRunningNote(entries[2].runningBalanceCents), 'Still owed PKR 1,000');
});

test('Plan 401: a refund-tagged payment is typed refund', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ categoryTag: 'refund', amount: 500 })] })],
  });
  assert.equal(entries[1].type, 'refund');
  assert.equal(entries[1].runningBalanceCents, 350000);
});

test('Plan 401: an adjustment-tagged payment is typed adjustment and reduces the balance', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ categoryTag: 'adjustment', amount: 500 })] })],
  });
  assert.equal(entries[1].type, 'adjustment');
  assert.equal(entries[1].runningBalanceCents, 250000);
});

test('Plan 401: a voided payment is listed, marked void, and moves nothing', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ voided: true })] })],
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[1].voided, true);
  assert.equal(entries[1].runningBalanceCents, 300000);
  assert.ok(fullHistoryEntryLineText(entries[1]).includes('VOID'));
  assert.ok(fullHistoryListHtml(entries).includes('VOID'));
});

// --- Credits and refunds ---

test('Plan 401: a credit from an overpayment is listed and moves nothing', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ amount: 3500 })] })],
    creditEntries: [creditEntry()],
  });
  assert.equal(entries.length, 3);
  assert.equal(entries[2].type, 'credit');
  assert.equal(entries[2].amountCents, 50000);
  assert.equal(entries[2].runningBalanceCents, -50000);
  assert.equal(fullHistoryRunningNote(entries[2].runningBalanceCents), 'Credit PKR 500');
});

test('Plan 401: a credit from an approved adjustment reduces the balance', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill()],
    creditEntries: [creditEntry({ source: 'adjustment', amountCents: 100000 })],
  });
  assert.equal(entries[1].type, 'credit');
  assert.equal(entries[1].runningBalanceCents, 200000);
});

test('Plan 401: credit entries for another customer are excluded; any recorded source is kept', () => {
  // Sharafat 12: the other-customer half of this rule stays — a
  // credit for another customer never appears — but the source half
  // reverses: a credit of any recorded source (here 'gift') is now
  // kept, with its source shown, instead of being dropped.
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill()],
    creditEntries: [
      creditEntry({ customerId: 'CUST-2' }),
      creditEntry({ id: 'CR-2', source: 'gift', amountCents: 100000 }),
    ],
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[1].type, 'credit');
  assert.equal(entries[1].source, 'gift');
});

test('Plan 401: a refund record increases the balance and carries its reason', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment()] })],
    refundRecords: [refundRecord()],
  });
  assert.equal(entries.length, 3);
  assert.equal(entries[2].type, 'refund');
  assert.equal(entries[2].date, '2026-11-07');
  assert.equal(entries[2].note, 'Overcharge');
  assert.equal(entries[2].runningBalanceCents, 20000);
});

test('Plan 401: refund records for another customer are excluded', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill()],
    refundRecords: [refundRecord({ customerId: 'CUST-2' })],
  });
  assert.equal(entries.length, 1);
});

// --- Order and running balance ---

test('Plan 401: entries sort by date and undated entries sort last', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ date: '2026-11-06' })] })],
    creditEntries: [creditEntry({ date: '' })],
    refundRecords: [refundRecord({ refundDate: '2026-11-04' })],
  });
  assert.deepEqual(
    entries.map((entry) => entry.type),
    ['refund', 'charge', 'payment', 'credit'],
  );
  assert.equal(entries[3].date, '');
  assert.ok(fullHistoryEntryLineText(entries[3]).includes('date not recorded'));
});

test('Plan 401: same-day entries order charge, payment, credit, refund', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ date: '2026-11-05' })] })],
    creditEntries: [creditEntry({ date: '2026-11-05' })],
    refundRecords: [refundRecord({ refundDate: '2026-11-05' })],
  });
  assert.deepEqual(
    entries.map((entry) => entry.type),
    ['charge', 'payment', 'credit', 'refund'],
  );
});

test('Plan 401: running balance end to end — overpay, credit, refund', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ amount: 3500 })] })],
    creditEntries: [creditEntry()],
    refundRecords: [refundRecord()],
  });
  assert.deepEqual(
    entries.map((entry) => entry.runningBalanceCents),
    [300000, -50000, -50000, -30000],
  );
  assert.equal(fullHistoryRunningNote(entries[3].runningBalanceCents), 'Credit PKR 300');
  assert.equal(fullHistorySummaryText(entries), '4 entries · Credit PKR 300');
});

test('Plan 401: a customer with no transactions gets an empty list', () => {
  assert.deepEqual(fullHistoryEntries({ customerId: CUSTOMER, bills: [] }), []);
  assert.deepEqual(fullHistoryEntries({ customerId: CUSTOMER }), []);
  assert.deepEqual(fullHistoryEntries({ customerId: '' }), []);
  assert.deepEqual(fullHistoryEntries({}), []);
  assert.equal(fullHistorySummaryText([]), FULL_HISTORY_EMPTY_TEXT);
  assert.equal(FULL_HISTORY_EMPTY_TEXT, 'No transactions yet');
});

test('Plan 401: inputs are never mutated', () => {
  const input = {
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment()] })],
    creditEntries: [creditEntry()],
    refundRecords: [refundRecord()],
  };
  const before = JSON.stringify(input);
  fullHistoryEntries(input);
  assert.equal(JSON.stringify(input), before);
});

// --- Formatting ---

test('Plan 401: history amounts print whole rupees with no decimals', () => {
  assert.equal(formatHistoryAmount(150000), 'PKR 1,500');
  assert.equal(formatHistoryAmount(150050), 'PKR 1,500.5');
  assert.equal(formatHistoryAmount(-50000), '-PKR 500');
  assert.equal(formatHistoryAmount(0), 'PKR 0');
  assert.equal(formatHistoryAmount(Number.NaN), 'PKR 0');
});

test('Plan 401: running notes read in plain words', () => {
  assert.equal(fullHistoryRunningNote(0), 'Settled');
  assert.equal(fullHistoryRunningNote(100000), 'Still owed PKR 1,000');
  assert.equal(fullHistoryRunningNote(-50000), 'Credit PKR 500');
});

test('Plan 401: entry line text names date, type, amount and balance', () => {
  const entries = fullHistoryEntries({ customerId: CUSTOMER, bills: [bill()] });
  assert.equal(
    fullHistoryEntryLineText(entries[0]),
    '2026-11-05 · Charge · PKR 3,000 · Still owed PKR 3,000',
  );
  assert.equal(fullHistoryEntryLineText(null), '');
});

test('Plan 401: list html escapes user-entered notes', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ note: 'A <b>bold</b> note' })] })],
  });
  const html = fullHistoryListHtml(entries);
  assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt;'));
  assert.equal(html.includes('<b>bold</b>'), false);
  assert.ok(html.startsWith('<ul class="payment-list">'));
});

test('Plan 401: list html is empty for an empty list', () => {
  assert.equal(fullHistoryListHtml([]), '');
  assert.equal(fullHistoryListHtml(null), '');
});

test('Plan 401: summary text counts entries and names the final balance', () => {
  const one = fullHistoryEntries({ customerId: CUSTOMER, bills: [bill()] });
  assert.equal(fullHistorySummaryText(one), '1 entry · Still owed PKR 3,000');
  const settled = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment()] })],
  });
  assert.equal(fullHistorySummaryText(settled), '2 entries · Settled');
});

test('Plan 401: type labels cover every history type', () => {
  // Sharafat 12: a seventh type, 'info' — an informational line for
  // ticket/add-on charges already inside the payment cash, which
  // moves nothing.
  assert.deepEqual([...FULL_HISTORY_TYPES], [
    'charge',
    'payment',
    'advance',
    'credit',
    'refund',
    'adjustment',
    'info',
  ]);
  for (const type of FULL_HISTORY_TYPES) {
    assert.ok(FULL_HISTORY_TYPE_LABELS[type], `missing label for ${type}`);
  }
});

// --- Fences and guards ---

test('Plan 401: the module header never names a fenced filename literally', () => {
  const moduleSrc = readFileSync(new URL('../full-history-list.js', import.meta.url), 'utf8');
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  const miniSlipModule = 'payment-' + 'slip.js';
  const receiptSearchModule = 'receipt-number-' + 'search.js';
  const queueStatusModule = 'offline-queue-' + 'status.js';
  const categoryTagModule = 'transaction-category-' + 'tag.js';
  for (const fenced of [miniSlipModule, receiptSearchModule, queueStatusModule, categoryTagModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(testSrc.includes(fenced), false, fenced);
  }
});

test('Plan 401: the module imports nothing, keeps no store, and touches no live state', () => {
  const moduleSrc = readFileSync(new URL('../full-history-list.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
  assert.equal(moduleSrc.includes('calculatePaymentAllocations'), false);
});

test('Plan 401: the fenced neighbours contain no full-history references', () => {
  const miniSlipModule = 'payment-' + 'slip.js';
  const receiptSearchModule = 'receipt-number-' + 'search.js';
  const queueStatusModule = 'offline-queue-' + 'status.js';
  const categoryTagModule = 'transaction-category-' + 'tag.js';
  for (const fenced of [miniSlipModule, receiptSearchModule, queueStatusModule, categoryTagModule]) {
    const src = readFileSync(new URL(`../${fenced}`, import.meta.url), 'utf8');
    assert.equal(src.includes('fullHistory'), false, fenced);
  }
});

test('Plan 401: the mini-slip still exists and is still wired, untouched', () => {
  const miniSlipModule = 'payment-' + 'slip.js';
  const slipSrc = readFileSync(new URL(`../${miniSlipModule}`, import.meta.url), 'utf8');
  assert.ok(slipSrc.includes('buildPaymentSlip'));
  assert.ok(slipSrc.includes('PAYMENT_SLIP_DEFAULT_COUNT'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${miniSlipModule}'`));
  assert.ok(appSrc.includes('buildPaymentSlip'));
});

test('Plan 401: the profile wires the full history list after the month history', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes("from './full-history-list.js'"));
  assert.ok(appSrc.includes('fullHistoryEntries'));
  assert.ok(appSrc.includes('fullHistoryListHtml'));
  assert.ok(appSrc.includes('fullHistorySummaryText'));
  assert.ok(appSrc.includes('FULL_HISTORY_EMPTY_TEXT'));
  assert.ok(appSrc.includes('renderFullHistory(customer)'));
  assert.ok(appSrc.includes('renderHistory(customer);'));
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexSrc.includes('id="fhlFullHistoryList"'));
  assert.ok(indexSrc.includes('id="fhlFullHistorySummary"'));
});

test('Plan 401: no new styles are added — the list reuses existing classes only', () => {
  // Billing & ledger redesign (2026-11-11, user-locked): the redesign
  // layers its own `fhl-*` / `hist-*` presentation on the Full History
  // section (filter bar, Reset All Filters, summary, legend, table
  // cards, row type borders — spec §§1–2, 6.5), so styles.css now
  // carries `fhl-` rules and the old whole-file assertion no longer
  // holds. What this test still pins is Plan 401's own fence: the
  // list module emits only its original classes and carries no
  // redesign class names; the redesign's styles are pinned by
  // tests/billing-ledger-redesign.test.js instead.
  const listSrc = readFileSync(new URL('../full-history-list.js', import.meta.url), 'utf8');
  assert.equal(listSrc.includes('fhl-'), false);
  assert.equal(listSrc.includes('hist-type'), false);
  assert.equal(listSrc.includes('hist-amount'), false);
  assert.equal(listSrc.includes('hist-ref'), false);
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexSrc.includes('class="payment-list"') || indexSrc.includes('fhlFullHistoryList'));
});

test('Plan 401: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.equal(mobilePattern.test(testSrc), false, 'test carries a mobile number');
  assert.ok(!testSrc.includes(fakeFamily), 'test uses a fake number outside the allowed family');
});
