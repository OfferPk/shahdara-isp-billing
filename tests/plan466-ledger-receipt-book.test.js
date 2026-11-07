import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeLedgerReceiptBookFilter,
  ledgerReceiptBookActive,
  ledgerReceiptBookLabel,
  ledgerReceiptBookOptions,
  ledgerReceiptBookOfEntry,
  ledgerReceiptBookMatches,
  searchLedgerByReceiptBook,
  ledgerReceiptBookSummary,
  ledgerReceiptBookSummaryText,
  ledgerReceiptBookEmptyText,
  ledgerReceiptBookRangeEmptyText,
} from '../ledger-receipt-book.js';

// Plan 466 — Search ledger by receipt book or series.
//
// Fixtures are invented and pattern-fake only: names are "First
// Last" fixtures (never a real customer), phones are the 03012345678
// family the PII ratchet allows, record ids are seed-* fixtures,
// and the series ids are RS-* fixtures.
const SERIES = [
  { id: 'RS-1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01' },
  { id: 'RS-2', collector: 'Noman Tariq', startNumber: 51, endNumber: 100, dateIssued: '2026-11-02' },
];

const ROWS = [
  { paymentId: 'seed-466-01', customerId: 'seed-466-c1', customerNumber: 101, customerName: 'Raja Ahmed', customerPhone: '03012345678', amount: 1000, date: '2026-03-05', month: '2026-03', method: 'Cash', status: 'paid', collectedBy: 'Saad', receiptNumber: '12' },
  { paymentId: 'seed-466-02', customerId: 'seed-466-c2', customerNumber: 102, customerName: 'Faisal Khan', customerPhone: '03012345679', amount: 1500, date: '2026-03-20', month: '2026-03', method: 'JazzCash', status: 'paid', collectedBy: 'Saad', receiptNumber: '47' },
  { paymentId: 'seed-466-03', customerId: 'seed-466-c3', customerNumber: 103, customerName: 'Bilal Hussain', customerPhone: '03012345670', amount: 2000, date: '2026-02-28', month: '2026-02', method: 'Cash', status: 'partial', collectedBy: 'Noman Tariq', receiptNumber: '60' },
  // A voided entry from the first book: it still lists as
  // history, but the book line skips it like the ledger does.
  { paymentId: 'seed-466-04', customerId: 'seed-466-c4', customerNumber: 104, customerName: 'Usman Ghani', customerPhone: '03012345671', amount: 500, date: '2026-03-02', month: '2026-03', method: 'Easypaisa', status: 'paid', voided: true, collectedBy: 'Saad', receiptNumber: '12' },
  // A generated reference is never a book number.
  { paymentId: 'seed-466-05', customerId: 'seed-466-c5', customerNumber: 105, customerName: 'Ahmed Raza', customerPhone: '03012345672', amount: 3000, date: '2026-02-15', month: '2026-02', method: 'Cash', status: 'paid', receiptNumber: 'REC-2601-0001-AB12' },
  // A plain number in no recorded range belongs to no book.
  { paymentId: 'seed-466-06', customerId: 'seed-466-c6', customerNumber: 106, customerName: 'Saad Malik', customerPhone: '03012345673', amount: 1200, date: '2026-04-02', month: '2026-03', method: 'Cash', status: 'paid', receiptNumber: '250' },
  // No receipt number at all belongs to no book.
  { paymentId: 'seed-466-07', customerId: 'seed-466-c7', customerNumber: 107, customerName: 'Hassan Ali', customerPhone: '03012345674', amount: 800, date: '2026-04-03', month: '2026-03', method: 'Cash', status: 'paid' },
  // A stored reference that is not a plain integer belongs to no book.
  { paymentId: 'seed-466-08', customerId: 'seed-466-c8', customerNumber: 108, customerName: 'Imran Shah', customerPhone: '03012345675', amount: 900, date: '2026-04-04', month: '2026-03', method: 'Cash', status: 'paid', receiptNumber: 'RCPT-41-202611-01' },
  // The permanent number is the fallback when no receipt
  // number is stored.
  { paymentId: 'seed-466-09', customerId: 'seed-466-c9', customerNumber: 109, customerName: 'Zubair Ahmed', customerPhone: '03012345676', amount: 700, date: '2026-04-05', month: '2026-03', method: 'Cash', status: 'paid', permanentReceiptNumber: '55' },
];

const ids = (list) => list.map((row) => row.paymentId);

test('a book choice is a trimmed series id, or nothing', () => {
  assert.equal(normalizeLedgerReceiptBookFilter('RS-1'), 'RS-1');
  assert.equal(normalizeLedgerReceiptBookFilter('  RS-1  '), 'RS-1');
  assert.equal(normalizeLedgerReceiptBookFilter(''), '');
  assert.equal(normalizeLedgerReceiptBookFilter('   '), '');
  assert.equal(normalizeLedgerReceiptBookFilter(null), '');
  assert.equal(normalizeLedgerReceiptBookFilter(undefined), '');
  assert.equal(normalizeLedgerReceiptBookFilter(123), '');
  assert.equal(ledgerReceiptBookActive('RS-1'), true);
  assert.equal(ledgerReceiptBookActive(''), false);
  assert.equal(ledgerReceiptBookActive('   '), false);
});

test('a book reads in plain words, and an unknown id reads as itself', () => {
  assert.equal(ledgerReceiptBookLabel(SERIES, 'RS-1'), 'Saad — numbers 1 to 50');
  assert.equal(ledgerReceiptBookLabel(SERIES, 'RS-2'), 'Noman Tariq — numbers 51 to 100');
  assert.equal(ledgerReceiptBookLabel(SERIES, '  RS-1  '), 'Saad — numbers 1 to 50');
  assert.equal(ledgerReceiptBookLabel(SERIES, 'RS-9'), 'RS-9');
  assert.equal(ledgerReceiptBookLabel(SERIES, ''), '');
  assert.equal(ledgerReceiptBookLabel(null, 'RS-1'), 'RS-1');
  assert.equal(ledgerReceiptBookLabel([], 'RS-1'), 'RS-1');
});

test('the book options are the recorded series, in recorded order', () => {
  assert.deepEqual(ledgerReceiptBookOptions(SERIES), [
    { id: 'RS-1', label: 'Saad — numbers 1 to 50' },
    { id: 'RS-2', label: 'Noman Tariq — numbers 51 to 100' },
  ]);
  assert.deepEqual(ledgerReceiptBookOptions([]), []);
  assert.deepEqual(ledgerReceiptBookOptions(null), []);
  assert.deepEqual(ledgerReceiptBookOptions(undefined), []);
  // A duplicated series id is one option, not two.
  assert.deepEqual(
    ledgerReceiptBookOptions([...SERIES, { id: 'RS-1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01' }]),
    ledgerReceiptBookOptions(SERIES),
  );
});

test('an entry belongs to the book its plain receipt number falls in', () => {
  assert.equal(ledgerReceiptBookOfEntry(ROWS[0], SERIES)?.id, 'RS-1');
  assert.equal(ledgerReceiptBookOfEntry(ROWS[1], SERIES)?.id, 'RS-1');
  assert.equal(ledgerReceiptBookOfEntry(ROWS[2], SERIES)?.id, 'RS-2');
  // A voided entry still belongs to its book — it stays listed.
  assert.equal(ledgerReceiptBookOfEntry(ROWS[3], SERIES)?.id, 'RS-1');
  // The permanent number is the fallback.
  assert.equal(ledgerReceiptBookOfEntry(ROWS[8], SERIES)?.id, 'RS-2');
  // A generated reference is never a book number.
  assert.equal(ledgerReceiptBookOfEntry(ROWS[4], SERIES), null);
  // A number in no recorded range belongs to no book.
  assert.equal(ledgerReceiptBookOfEntry(ROWS[5], SERIES), null);
  // No receipt number at all belongs to no book.
  assert.equal(ledgerReceiptBookOfEntry(ROWS[6], SERIES), null);
  // A stored reference that is not a plain integer belongs to no book.
  assert.equal(ledgerReceiptBookOfEntry(ROWS[7], SERIES), null);
  assert.equal(ledgerReceiptBookOfEntry(null, SERIES), null);
  assert.equal(ledgerReceiptBookOfEntry(ROWS[0], null), null);
});

test('matching is by the book the entry was issued from', () => {
  assert.equal(ledgerReceiptBookMatches(ROWS[0], SERIES, 'RS-1'), true);
  assert.equal(ledgerReceiptBookMatches(ROWS[0], SERIES, 'RS-2'), false);
  assert.equal(ledgerReceiptBookMatches(ROWS[2], SERIES, 'RS-2'), true);
  assert.equal(ledgerReceiptBookMatches(ROWS[2], SERIES, 'RS-1'), false);
  // An entry with no book belongs to no chosen book.
  assert.equal(ledgerReceiptBookMatches(ROWS[4], SERIES, 'RS-1'), false);
  assert.equal(ledgerReceiptBookMatches(ROWS[5], SERIES, 'RS-1'), false);
  assert.equal(ledgerReceiptBookMatches(ROWS[6], SERIES, 'RS-1'), false);
  assert.equal(ledgerReceiptBookMatches(ROWS[7], SERIES, 'RS-1'), false);
  assert.equal(ledgerReceiptBookMatches(null, SERIES, 'RS-1'), false);
  // With no book chosen every entry belongs.
  assert.equal(ledgerReceiptBookMatches(ROWS[0], SERIES, ''), true);
  assert.equal(ledgerReceiptBookMatches(ROWS[4], SERIES, ''), true);
  assert.equal(ledgerReceiptBookMatches(null, SERIES, ''), true);
});

test('one book returns exactly that book, and no other book', () => {
  assert.deepEqual(ids(searchLedgerByReceiptBook(ROWS, SERIES, 'RS-1')), ['seed-466-01', 'seed-466-02', 'seed-466-04']);
  assert.deepEqual(ids(searchLedgerByReceiptBook(ROWS, SERIES, 'RS-2')), ['seed-466-03', 'seed-466-09']);
  assert.deepEqual(ids(searchLedgerByReceiptBook(ROWS, SERIES, 'RS-9')), []);
});

test('with no book chosen every entry is kept, in the same order, and the input is never mutated', () => {
  const input = [ROWS[2], ROWS[0], ROWS[1]];
  const before = JSON.stringify(input);
  const result = searchLedgerByReceiptBook(input, SERIES, 'RS-1');
  assert.deepEqual(ids(result), ['seed-466-01', 'seed-466-02']);
  assert.notEqual(result, input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(searchLedgerByReceiptBook(ROWS, SERIES, ''), [...ROWS]);
  assert.notEqual(searchLedgerByReceiptBook(ROWS, SERIES, ''), ROWS);
  assert.deepEqual(searchLedgerByReceiptBook(ROWS, SERIES, '   '), [...ROWS]);
  assert.deepEqual(searchLedgerByReceiptBook(null, SERIES, 'RS-1'), []);
  assert.deepEqual(searchLedgerByReceiptBook(undefined, SERIES, 'RS-1'), []);
  assert.deepEqual(searchLedgerByReceiptBook(ROWS, null, 'RS-1'), []);
});

test('a voided entry still lists, but the summary skips it like the ledger does', () => {
  assert.deepEqual(ledgerReceiptBookSummary([ROWS[0], ROWS[1], ROWS[3]]), { count: 2, total: 2500 });
  assert.deepEqual(ledgerReceiptBookSummary([]), { count: 0, total: 0 });
  assert.deepEqual(ledgerReceiptBookSummary([{ amount: 'not-a-number' }, { amount: 1000 }]), { count: 2, total: 1000 });
  assert.deepEqual(ledgerReceiptBookSummary([{ amount: 1000, voided: true }]), { count: 0, total: 0 });
  assert.equal(ledgerReceiptBookSummaryText([ROWS[0], ROWS[1], ROWS[3]], SERIES, 'RS-1'), 'Saad — numbers 1 to 50: 2 entries · PKR 2,500 total');
  assert.equal(ledgerReceiptBookSummaryText([ROWS[0]], SERIES, 'RS-1'), 'Saad — numbers 1 to 50: 1 entry · PKR 1,000 total');
  assert.equal(ledgerReceiptBookSummaryText([], SERIES, 'RS-1'), 'Saad — numbers 1 to 50: 0 entries · PKR 0 total');
  assert.equal(ledgerReceiptBookSummaryText(ROWS, SERIES, ''), '');
  assert.equal(ledgerReceiptBookSummaryText([ROWS[0]], SERIES, 'RS-9'), 'RS-9: 1 entry · PKR 1,000 total');
});

test('the book total equals the sum of the listed non-voided entries', () => {
  const first = searchLedgerByReceiptBook(ROWS, SERIES, 'RS-1');
  const summary = ledgerReceiptBookSummary(first);
  const listed = first.filter((row) => row.voided !== true).reduce((sum, row) => sum + Number(row.amount), 0);
  assert.equal(summary.total, listed);
  assert.equal(summary.total, 1000 + 1500);
  const second = searchLedgerByReceiptBook(ROWS, SERIES, 'RS-2');
  assert.equal(ledgerReceiptBookSummary(second).total, 2000 + 700);
});

test('the empty text names the book', () => {
  assert.equal(ledgerReceiptBookEmptyText(SERIES, 'RS-1'), 'No entries from book Saad — numbers 1 to 50.');
  assert.equal(ledgerReceiptBookEmptyText(SERIES, 'RS-2'), 'No entries from book Noman Tariq — numbers 51 to 100.');
  assert.equal(ledgerReceiptBookEmptyText(SERIES, 'RS-9'), 'No entries from book RS-9.');
  assert.equal(ledgerReceiptBookEmptyText(SERIES, ''), 'No recorded payments match these filters.');
});

test('the empty text with a range names the book and the range', () => {
  assert.equal(ledgerReceiptBookRangeEmptyText(SERIES, 'RS-1', '1000', '2000'), 'No entries from book Saad — numbers 1 to 50 between Rs 1,000 and Rs 2,000.');
  assert.equal(ledgerReceiptBookRangeEmptyText(SERIES, 'RS-1', '2000', '1000'), 'No entries from book Saad — numbers 1 to 50 between Rs 1,000 and Rs 2,000.');
  assert.equal(ledgerReceiptBookRangeEmptyText(SERIES, 'RS-1', 'Rs 1,000', ''), 'No entries from book Saad — numbers 1 to 50 of Rs 1,000 or more.');
  assert.equal(ledgerReceiptBookRangeEmptyText(SERIES, 'RS-1', '', '2000'), 'No entries from book Saad — numbers 1 to 50 up to Rs 2,000.');
  assert.equal(ledgerReceiptBookRangeEmptyText(SERIES, 'RS-1', '', ''), 'No entries from book Saad — numbers 1 to 50.');
  assert.equal(ledgerReceiptBookRangeEmptyText(SERIES, 'RS-1', 'abc', 'def'), 'No entries from book Saad — numbers 1 to 50.');
  assert.equal(ledgerReceiptBookRangeEmptyText(SERIES, '', '1000', '2000'), 'No recorded payments match these filters.');
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../ledger-receipt-book.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false);
  assert.equal(module.includes('localStorage'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches pure helpers, which are not clock reads.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});

// --- wiring into the Transactions screen and the page ---

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('wiring: the app imports the module and applies it in the ledger render', () => {
  assert.ok(appSrc.includes("from './ledger-receipt-book.js'"), 'app imports the receipt-book ledger module');
  const renderStart = appSrc.indexOf('function renderTransactions()');
  const renderEnd = appSrc.indexOf('function reportStatusLabel(', renderStart);
  const renderBody = appSrc.slice(renderStart, renderEnd);
  assert.ok(renderBody.includes('normalizeLedgerReceiptBookFilter(transactionReceiptBookFilter)'), 'the render normalizes the chosen book');
  assert.ok(renderBody.includes('loadReceiptSeries()'), 'the render reads the recorded receipt series');
  assert.ok(renderBody.includes('ledgerReceiptBookOptions(receiptSeries)'), 'the book options come from the recorded series');
  assert.ok(renderBody.includes('searchLedgerByReceiptBook(transactions, receiptSeries, book)'), 'the render narrows the ledger with the book');
  assert.ok(renderBody.includes("$('#lrbBookSummary')"), 'the render updates the book summary line');
  assert.ok(renderBody.includes('ledgerReceiptBookSummaryText(transactions, receiptSeries, book)'), 'the summary line shows the book, count, and total');
  assert.ok(renderBody.includes('ledgerReceiptBookEmptyText(receiptSeries, book)'), 'an empty book says so plainly');
  assert.ok(renderBody.includes('ledgerReceiptBookRangeEmptyText(receiptSeries, book, transactionAmountMin, transactionAmountMax)'), 'an empty book inside a range names both');
});

test('wiring: choosing a book re-renders the ledger and clearing the filters clears it', () => {
  assert.ok(appSrc.includes("$('#transactionReceiptBookFilter').addEventListener('change'"), 'the receipt-book select listens for a chosen book');
  const listenerStart = appSrc.indexOf("$('#transactionReceiptBookFilter').addEventListener('change'");
  const listenerBody = appSrc.slice(listenerStart, listenerStart + 300);
  assert.ok(listenerBody.includes('transactionCurrentPage = 1'), 'the listener restarts at the first page');
  assert.ok(listenerBody.includes('renderTransactions()'), 'the listener re-renders the ledger');
  const clearStart = appSrc.indexOf("$('#clearTransactionFilters').addEventListener('click'");
  const clearBody = appSrc.slice(clearStart, clearStart + 4000);
  assert.ok(clearBody.includes("$('#transactionReceiptBookFilter')"), 'clearing the filters clears the receipt-book select');
  assert.ok(clearBody.includes('transactionReceiptBookFilter = '), 'clearing the filters resets the receipt-book state');
});

test('wiring: the page carries the receipt-book select and the book summary line', () => {
  assert.ok(page.includes('id="transactionReceiptBookFilter"'), 'the Transactions screen has a receipt-book select');
  assert.ok(page.includes('id="lrbBookSummary"'), 'the book summary line exists in the summary bar');
  const filtersStart = page.indexOf('<div class="transaction-filters">');
  const filtersEnd = page.indexOf('</div>', page.indexOf('id="rnsReceiptSearchForm"'));
  const filtersBody = page.slice(filtersStart, filtersEnd);
  assert.ok(filtersBody.includes('for="transactionReceiptBookFilter"'), 'the receipt-book select is labelled');
  assert.ok(filtersBody.includes('All receipt books'), 'the receipt-book select offers all books');
  // The pinned first sentence of the help text stays word for word.
  assert.ok(page.includes('Customer search, recency, exact payment date, and the amount range combine'), 'the pinned help sentence is untouched');
  assert.ok(page.includes('Pick a receipt book to see only the entries issued from that book'), 'the help text names the receipt-book search');
});
