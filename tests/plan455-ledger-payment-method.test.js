// Plan 455 — Search ledger by payment method: one method lists
// exactly that method's entries — cash folding in the "Cash at …
// shop" variants, bank transfer folding in Raast, NayaPay reachable
// at last — with the method, the count, and the total shown in PKR,
// and never changing any record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LEDGER_METHOD_FILTER_ALL,
  LEDGER_METHOD_FILTERS,
  LEDGER_METHOD_LABELS,
  formatLedgerMethodRupees,
  formatLedgerMethodPkrTotal,
  ledgerMethodGroup,
  isLedgerMethodFilter,
  normalizeLedgerMethodFilter,
  ledgerMethodMatches,
  searchLedgerByMethod,
  ledgerMethodCounts,
  ledgerMethodSummary,
  ledgerMethodSummaryText,
  ledgerMethodEmptyText,
  ledgerMethodDayRangeEmptyText,
} from '../ledger-payment-method.js';

// Generic fixtures only — no real customer names, no phone numbers.
function entry(id, amount, date, customerName = 'Customer A', method = 'Cash', extra = {}) {
  return { id, paymentId: id, amount, date, customerName, customerNumber: 101, method, ...extra };
}

function ledger() {
  return [
    entry('t1', 500, '2026-11-04', 'Customer A', 'Cash'),
    entry('t2', 1000, '2026-11-05', 'Customer B', 'JazzCash'),
    entry('t3', 1500, '2026-11-05', 'Customer C', 'Cash at Waseem Abbasi shop'),
    entry('t4', 2000, '2026-11-05', 'Customer D', 'Bank Transfer'),
    entry('t5', 2500, '2026-11-06', 'Customer E', 'Raast'),
    entry('t6', 3000, '2026-11-06', 'Customer F', 'Easypaisa'),
    entry('t7', 1200, '2026-11-07', 'Customer G', 'NayaPay'),
    entry('t8', 800, '2026-11-07', 'Customer H', 'Cash at Hassan shop'),
    entry('t9', 400, '2026-11-08', 'Customer I', 'Other'),
    // t10 has no method at all — the entry helper defaults method
    // to 'Cash' when it is passed undefined, so this one is built
    // by hand to keep the method genuinely absent.
    { id: 't10', paymentId: 't10', amount: 600, date: '2026-11-08', customerName: 'Customer J', customerNumber: 101 },
  ];
}

test('the filter accepts the screen select values, the group keys, and nothing else', () => {
  assert.equal(LEDGER_METHOD_FILTER_ALL, 'all');
  assert.deepEqual(LEDGER_METHOD_FILTERS, ['cash', 'jazzcash', 'easypaisa', 'nayapay', 'bank_transfer', 'other']);
  assert.deepEqual(LEDGER_METHOD_LABELS, {
    cash: 'Cash',
    jazzcash: 'JazzCash',
    easypaisa: 'Easypaisa',
    nayapay: 'NayaPay',
    bank_transfer: 'Bank Transfer',
    other: 'Other',
  });
  // The screen's select values, as written.
  assert.equal(normalizeLedgerMethodFilter('Cash'), 'cash');
  assert.equal(normalizeLedgerMethodFilter('EasyPaisa'), 'easypaisa');
  assert.equal(normalizeLedgerMethodFilter('JazzCash'), 'jazzcash');
  assert.equal(normalizeLedgerMethodFilter('Bank Transfer'), 'bank_transfer');
  assert.equal(normalizeLedgerMethodFilter('NayaPay'), 'nayapay');
  assert.equal(normalizeLedgerMethodFilter('Other'), 'other');
  assert.equal(normalizeLedgerMethodFilter('all'), 'all');
  // The group keys themselves, and case/space variants.
  assert.equal(normalizeLedgerMethodFilter('bank_transfer'), 'bank_transfer');
  assert.equal(normalizeLedgerMethodFilter('BANK TRANSFER'), 'bank_transfer');
  assert.equal(normalizeLedgerMethodFilter('  JazzCash  '), 'jazzcash');
  assert.equal(normalizeLedgerMethodFilter('bank-transfer'), 'bank_transfer');
  // A damaged choice never drops entries: it reads as 'all'.
  assert.equal(normalizeLedgerMethodFilter('Cheque'), 'all');
  assert.equal(normalizeLedgerMethodFilter('mobile_wallet'), 'all');
  assert.equal(normalizeLedgerMethodFilter(''), 'all');
  assert.equal(normalizeLedgerMethodFilter(null), 'all');
  assert.equal(normalizeLedgerMethodFilter(undefined), 'all');
  assert.equal(normalizeLedgerMethodFilter(42), 'all');
  assert.equal(isLedgerMethodFilter('Cash'), true);
  assert.equal(isLedgerMethodFilter('all'), true);
  assert.equal(isLedgerMethodFilter('Cheque'), false);
  assert.equal(isLedgerMethodFilter(''), false);
});

test('the fold groups cash-shop variants, Raast, and each wallet, and nothing else', () => {
  assert.equal(ledgerMethodGroup('Cash'), 'cash');
  assert.equal(ledgerMethodGroup('Cash at Waseem Abbasi shop'), 'cash');
  assert.equal(ledgerMethodGroup('Cash at Hassan shop'), 'cash');
  assert.equal(ledgerMethodGroup('Cash at Balla shop'), 'cash');
  assert.equal(ledgerMethodGroup('Cash at Hassan Balla shop'), 'cash');
  assert.equal(ledgerMethodGroup('cash at  waseem abbasi shop'), 'cash');
  assert.equal(ledgerMethodGroup('Bank Transfer'), 'bank_transfer');
  assert.equal(ledgerMethodGroup('Raast'), 'bank_transfer');
  assert.equal(ledgerMethodGroup('RAAST'), 'bank_transfer');
  assert.equal(ledgerMethodGroup('JazzCash'), 'jazzcash');
  assert.equal(ledgerMethodGroup('Easypaisa'), 'easypaisa');
  assert.equal(ledgerMethodGroup('NayaPay'), 'nayapay');
  // Cheque is not a recordable payment method, so it reads as
  // Other — never forced into a group it does not belong to.
  assert.equal(ledgerMethodGroup('Cheque'), 'other');
  assert.equal(ledgerMethodGroup('Other'), 'other');
  assert.equal(ledgerMethodGroup('Mystery method'), 'other');
  assert.equal(ledgerMethodGroup(''), 'other');
  assert.equal(ledgerMethodGroup(null), 'other');
  assert.equal(ledgerMethodGroup(undefined), 'other');
});

test('choosing one method lists exactly that method entries and no others', () => {
  const rows = ledger();
  // Cash folds in both shop variants: t1, t3, t8.
  assert.deepEqual(searchLedgerByMethod(rows, 'Cash').map((row) => row.id), ['t1', 't3', 't8']);
  assert.deepEqual(searchLedgerByMethod(rows, 'cash').map((row) => row.id), ['t1', 't3', 't8']);
  // Bank transfer folds in Raast: t4, t5.
  assert.deepEqual(searchLedgerByMethod(rows, 'Bank Transfer').map((row) => row.id), ['t4', 't5']);
  assert.deepEqual(searchLedgerByMethod(rows, 'bank_transfer').map((row) => row.id), ['t4', 't5']);
  // Each wallet alone.
  assert.deepEqual(searchLedgerByMethod(rows, 'JazzCash').map((row) => row.id), ['t2']);
  assert.deepEqual(searchLedgerByMethod(rows, 'Easypaisa').map((row) => row.id), ['t6']);
  assert.deepEqual(searchLedgerByMethod(rows, 'NayaPay').map((row) => row.id), ['t7']);
  // Other is the complement: the recorded 'Other' and the entry
  // with no method at all.
  assert.deepEqual(searchLedgerByMethod(rows, 'Other').map((row) => row.id), ['t9', 't10']);
  // 'all', a missing choice, and an unknown choice keep every
  // entry, in the same order.
  assert.deepEqual(searchLedgerByMethod(rows, 'all').map((row) => row.id), rows.map((row) => row.id));
  assert.deepEqual(searchLedgerByMethod(rows, 'Cheque').map((row) => row.id), rows.map((row) => row.id));
  assert.deepEqual(searchLedgerByMethod(rows, '').map((row) => row.id), rows.map((row) => row.id));
  assert.deepEqual(searchLedgerByMethod(null, 'Cash'), []);
  assert.deepEqual(searchLedgerByMethod(undefined, 'Cash'), []);
});

test('one entry matches its own method and no other', () => {
  const cash = entry('x', 100, '2026-11-05', 'Customer A', 'Cash at Balla shop');
  assert.equal(ledgerMethodMatches(cash, 'Cash'), true);
  assert.equal(ledgerMethodMatches(cash, 'cash'), true);
  assert.equal(ledgerMethodMatches(cash, 'JazzCash'), false);
  assert.equal(ledgerMethodMatches(cash, 'all'), true);
  assert.equal(ledgerMethodMatches(cash, 'Cheque'), true);
  assert.equal(ledgerMethodMatches(entry('y', 100, '2026-11-05', 'Customer A', 'Raast'), 'Bank Transfer'), true);
  // A method-less entry reads as Other. (The entry helper defaults
  // method to 'Cash' when passed undefined, so this one is built
  // by hand to keep the method genuinely absent.)
  const noMethod = { id: 'z', paymentId: 'z', amount: 100, date: '2026-11-05', customerName: 'Customer A', customerNumber: 101 };
  assert.equal(ledgerMethodMatches(noMethod, 'Other'), true);
  assert.equal(ledgerMethodMatches(noMethod, 'Cash'), false);
});

test('the per-group counts always sum to the total', () => {
  assert.deepEqual(ledgerMethodCounts(ledger()), {
    total: 10,
    cash: 3,
    jazzcash: 1,
    easypaisa: 1,
    nayapay: 1,
    bank_transfer: 2,
    other: 2,
  });
  assert.deepEqual(ledgerMethodCounts([]), {
    total: 0,
    cash: 0,
    jazzcash: 0,
    easypaisa: 0,
    nayapay: 0,
    bank_transfer: 0,
    other: 0,
  });
});

test('the search never mutates the list or its entries', () => {
  const rows = ledger();
  const before = rows.map((row) => row.id).join(',');
  searchLedgerByMethod(rows, 'Cash');
  searchLedgerByMethod(rows, 'all');
  assert.equal(rows.map((row) => row.id).join(','), before);
  assert.equal(rows[0].method, 'Cash');
});

test('the method summary counts and totals only collected cash', () => {
  const cash = searchLedgerByMethod(ledger(), 'Cash');
  // t1 500 + t3 1500 + t8 800.
  assert.deepEqual(ledgerMethodSummary(cash), { count: 3, total: 2800 });
  assert.deepEqual(ledgerMethodSummary([]), { count: 0, total: 0 });
  assert.deepEqual(ledgerMethodSummary(null), { count: 0, total: 0 });
  assert.deepEqual(ledgerMethodSummary([entry('x', 'abc', '2026-11-05'), entry('y', 500, '2026-11-05')]), { count: 2, total: 500 });
  assert.deepEqual(ledgerMethodSummary([entry('x', 100, '2026-11-05', 'Customer A', 'Cash', { voided: true })]), { count: 0, total: 0 });
  // A voided JazzCash entry stays listed but counts towards neither.
  const jazz = searchLedgerByMethod(
    [entry('a', 1000, '2026-11-05', 'Customer A', 'JazzCash'), entry('b', 2500, '2026-11-05', 'Customer B', 'JazzCash', { voided: true })],
    'JazzCash',
  );
  assert.deepEqual(jazz.map((row) => row.id), ['a', 'b']);
  assert.deepEqual(ledgerMethodSummary(jazz), { count: 1, total: 1000 });
});

test('the method line names the method, the count, and the PKR total', () => {
  const cash = searchLedgerByMethod(ledger(), 'Cash');
  assert.equal(ledgerMethodSummaryText(cash, 'Cash'), 'Cash: 3 entries · PKR 2,800 total');
  assert.equal(ledgerMethodSummaryText([entry('x', 100, '2026-11-05')], 'JazzCash'), 'JazzCash: 1 entry · PKR 100 total');
  assert.equal(ledgerMethodSummaryText([], 'Easypaisa'), 'Easypaisa: 0 entries · PKR 0 total');
  assert.equal(ledgerMethodSummaryText(cash, 'all'), '');
  assert.equal(ledgerMethodSummaryText(cash, 'Cheque'), '');
  assert.equal(formatLedgerMethodRupees(1500), 'Rs 1,500');
  assert.equal(formatLedgerMethodPkrTotal(4500), 'PKR 4,500');
});

test('a method with no entries says so plainly', () => {
  assert.equal(ledgerMethodEmptyText('JazzCash'), 'No JazzCash entries.');
  assert.equal(ledgerMethodEmptyText('Bank Transfer'), 'No Bank Transfer entries.');
  assert.equal(ledgerMethodEmptyText('NayaPay'), 'No NayaPay entries.');
  assert.equal(ledgerMethodEmptyText('all'), '');
  assert.equal(ledgerMethodEmptyText('Cheque'), '');
});

test('an empty method composes with the day and the range', () => {
  assert.equal(
    ledgerMethodDayRangeEmptyText('JazzCash', '5 Nov 2026', '1000', '2000'),
    'No JazzCash entries on 5 Nov 2026 between Rs 1,000 and Rs 2,000.',
  );
  assert.equal(
    ledgerMethodDayRangeEmptyText('JazzCash', '5 Nov 2026', 'Rs 2,000', 'Rs 1,000'),
    'No JazzCash entries on 5 Nov 2026 between Rs 1,000 and Rs 2,000.',
  );
  assert.equal(
    ledgerMethodDayRangeEmptyText('Cash', '5 Nov 2026', 'Rs 1,500', ''),
    'No Cash entries on 5 Nov 2026 of Rs 1,500 or more.',
  );
  assert.equal(
    ledgerMethodDayRangeEmptyText('Cash', '5 Nov 2026', '', '2,000'),
    'No Cash entries on 5 Nov 2026 up to Rs 2,000.',
  );
  assert.equal(
    ledgerMethodDayRangeEmptyText('JazzCash', '5 Nov 2026', '', ''),
    'No JazzCash entries on 5 Nov 2026.',
  );
  assert.equal(
    ledgerMethodDayRangeEmptyText('JazzCash', '', '1000', '2000'),
    'No JazzCash entries between Rs 1,000 and Rs 2,000.',
  );
  assert.equal(
    ledgerMethodDayRangeEmptyText('JazzCash', '', '1000', ''),
    'No JazzCash entries of Rs 1,000 or more.',
  );
  assert.equal(
    ledgerMethodDayRangeEmptyText('JazzCash', '', '', '2000'),
    'No JazzCash entries up to Rs 2,000.',
  );
  assert.equal(ledgerMethodDayRangeEmptyText('JazzCash', '', '', ''), 'No JazzCash entries.');
  assert.equal(ledgerMethodDayRangeEmptyText('JazzCash', '5 Nov 2026', 'abc', 'xyz'), 'No JazzCash entries on 5 Nov 2026.');
  assert.equal(ledgerMethodDayRangeEmptyText('all', '5 Nov 2026', '1000', '2000'), '');
  assert.equal(ledgerMethodDayRangeEmptyText('Cheque', '5 Nov 2026', '1000', '2000'), '');
});

test('wiring: the Transactions screen imports the method search and filters the list', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './ledger-payment-method.js'"), 'app imports the Plan 455 module');
  assert.ok(app.includes('searchLedgerByMethod(transactions'), 'the method filters the ledger list');
  assert.ok(app.includes('ledgerMethodSummaryText'), 'the method line is shown');
  assert.ok(app.includes('ledgerMethodDayRangeEmptyText'), 'an empty method says so plainly');
  assert.ok(app.includes("$('#transactionMethodFilter')"), 'method select is read');
  assert.ok(app.includes("transactionMethodFilter = 'all';"), 'clearing the filters clears the method');
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="transactionMethodFilter"'), 'method select exists on the Transactions screen');
  assert.ok(page.includes('<option value="NayaPay">NayaPay</option>'), 'NayaPay is offered');
  assert.ok(page.includes('id="lpmMethodSummary"'), 'method summary line exists in the summary bar');
});

test('the new module names no fenced module file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../ledger-payment-method.js', import.meta.url), 'utf8');
  for (const fenced of [
    'payments-list.js',
    'history-amount-search.js',
    'full-history-list.js',
    'history-type-filter.js',
    'history-date-range-filter.js',
    'history-method-filter.js',
    'form-validation.js',
    'nav-customer-search.js',
    'customer-id-lookup.js',
    'customer-status-filter.js',
    'core.js',
    'ledger-amount-range.js',
    'ledger-single-day.js',
    'method-reconciliation.js',
  ]) {
    assert.equal(module.includes(fenced), false, `module must not name ${fenced}`);
  }
  assert.equal(module.includes('localStorage'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches pure function calls, which are not clock reads.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});
