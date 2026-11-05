import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validReceiptBookDate,
  normalizeReceiptBook,
  normalizeReceiptBookList,
  receiptBooksSorted,
  findReceiptBook,
  recordReceiptBook,
  removeReceiptBook,
  returnReceiptBook,
  receiptBooksOutstanding,
  receiptBooksReturned,
  receiptBooksForHolder,
  doubleIssuedBooks,
  receiptBookAgeDays,
  receiptBookText,
  receiptBookHtml,
  receiptBookAllHtml,
  receiptBookSummaryText,
  receiptBookCsv,
  receiptBookFilename,
} from '../receipt-book.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'receipt-book.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const base = { id: 'RB-1', bookId: 'BOOK-7', issuedTo: 'Saad', dateIssued: '2026-10-05' };

test('half-formed issue is refused', () => {
  assert.equal(recordReceiptBook([], { ...base, bookId: '' }), null);
  assert.equal(recordReceiptBook([], { ...base, issuedTo: '' }), null);
  assert.equal(recordReceiptBook([], { ...base, dateIssued: '' }), null);
  assert.equal(recordReceiptBook([], { id: '' }), null);
});

test('strict dates: impossible dates refused, leap day accepted', () => {
  assert.equal(validReceiptBookDate('2026-02-30'), false);
  assert.equal(validReceiptBookDate('2024-02-29'), true);
  assert.equal(validReceiptBookDate('2026-13-01'), false);
  assert.equal(recordReceiptBook([], { ...base, dateIssued: '2026-02-30' }), null);
  assert.notEqual(recordReceiptBook([], { ...base, dateIssued: '2024-02-29' }), null);
});

test('unknown fields dropped and inputs never mutated', () => {
  const input = { ...base, seriesStart: 100, receiptCount: 50 };
  const frozen = JSON.parse(JSON.stringify(input));
  const next = recordReceiptBook([], input);
  assert.deepEqual(next, [{ ...base, dateReturned: '', conditionOnReturn: '' }]);
  assert.deepEqual(input, frozen);
});

test('duplicate id never rewritten', () => {
  const first = recordReceiptBook([], base);
  const again = recordReceiptBook(first, { ...base, issuedTo: 'Other' });
  assert.equal(again.length, 1);
  assert.equal(again[0].issuedTo, 'Saad');
});

test('fresh issue carries no return, even when caller passes one', () => {
  const next = recordReceiptBook([], { ...base, dateReturned: '2026-10-20', conditionOnReturn: 'Good' });
  assert.equal(next[0].dateReturned, '');
  assert.equal(next[0].conditionOnReturn, '');
});

test('find and remove', () => {
  const list = recordReceiptBook([], base);
  assert.equal(findReceiptBook(list, 'RB-1').bookId, 'BOOK-7');
  assert.equal(findReceiptBook(list, 'RB-9'), null);
  assert.equal(removeReceiptBook(list, 'RB-1').length, 0);
  assert.equal(removeReceiptBook(list, '').length, 1);
});

test('outstanding list sorted by holder then date issued', () => {
  const list = [
    { id: 'RB-3', bookId: 'BOOK-9', issuedTo: 'Saad', dateIssued: '2026-10-10' },
    { id: 'RB-1', bookId: 'BOOK-7', issuedTo: 'Ayesha', dateIssued: '2026-10-05' },
    { id: 'RB-2', bookId: 'BOOK-8', issuedTo: 'Saad', dateIssued: '2026-10-01' },
  ];
  const out = receiptBooksOutstanding(list);
  assert.deepEqual(out.map((row) => row.id), ['RB-1', 'RB-2', 'RB-3']);
});

test('returning a book clears it from outstanding and keeps the return date', () => {
  const list = recordReceiptBook([], base);
  const returned = returnReceiptBook(list, 'RB-1', '2026-10-20', 'Good');
  assert.equal(receiptBooksOutstanding(returned).length, 0);
  assert.equal(receiptBooksReturned(returned).length, 1);
  assert.equal(receiptBooksReturned(returned)[0].dateReturned, '2026-10-20');
  assert.equal(receiptBooksReturned(returned)[0].conditionOnReturn, 'Good');
});

test('a returned book can never be re-dated or un-returned', () => {
  const list = returnReceiptBook(recordReceiptBook([], base), 'RB-1', '2026-10-20', 'Good');
  const again = returnReceiptBook(list, 'RB-1', '2026-10-25', 'Damaged');
  assert.equal(again[0].dateReturned, '2026-10-20');
  assert.equal(again[0].conditionOnReturn, 'Good');
});

test('return dated before issue is refused', () => {
  const list = recordReceiptBook([], base);
  const next = returnReceiptBook(list, 'RB-1', '2026-10-01', 'Good');
  assert.equal(next[0].dateReturned, '');
  assert.equal(receiptBooksOutstanding(next).length, 1);
});

test('bad return date leaves the list untouched', () => {
  const list = recordReceiptBook([], base);
  assert.deepEqual(returnReceiptBook(list, 'RB-1', '2026-02-30', 'Good'), list);
  assert.deepEqual(returnReceiptBook(list, 'RB-1', '', 'Good'), list);
});

test('a book issued to two holders at once is flagged', () => {
  const list = [
    { id: 'RB-1', bookId: 'BOOK-7', issuedTo: 'Saad', dateIssued: '2026-10-05' },
    { id: 'RB-2', bookId: 'BOOK-7', issuedTo: 'Ayesha', dateIssued: '2026-10-06' },
    { id: 'RB-3', bookId: 'BOOK-8', issuedTo: 'Saad', dateIssued: '2026-10-07' },
  ];
  const flagged = doubleIssuedBooks(list);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].bookId, 'BOOK-7');
  assert.deepEqual(flagged[0].holders, ['Ayesha', 'Saad']);
  assert.ok(receiptBookSummaryText(list).includes('issued to two holders at once'));
});

test('returned then re-issued is not a double issue', () => {
  const list = returnReceiptBook(recordReceiptBook([], base), 'RB-1', '2026-10-20', 'Good');
  const reissued = recordReceiptBook(list, { id: 'RB-2', bookId: 'BOOK-7', issuedTo: 'Ayesha', dateIssued: '2026-10-21' });
  assert.equal(doubleIssuedBooks(reissued).length, 0);
});

test('age in days against a caller-supplied as-of date', () => {
  assert.equal(receiptBookAgeDays(base, '2026-10-15'), 10);
  assert.equal(receiptBookAgeDays(base, 'not-a-date'), null);
  assert.equal(receiptBookAgeDays({ ...base, dateIssued: '2026-02-30' }, '2026-10-15'), null);
});

test('holder filter is case-insensitive substring', () => {
  const list = [
    { id: 'RB-1', bookId: 'BOOK-7', issuedTo: 'Saad', dateIssued: '2026-10-05' },
    { id: 'RB-2', bookId: 'BOOK-8', issuedTo: 'Ayesha', dateIssued: '2026-10-06' },
  ];
  assert.equal(receiptBooksForHolder(list, 'saa').length, 1);
  assert.equal(receiptBooksForHolder(list, '').length, 2);
});

test('note text covers outstanding and returned with fallbacks', () => {
  assert.equal(receiptBookText(base), 'Book BOOK-7 issued to Saad on 2026-10-05, not yet returned.');
  const returned = { ...base, dateReturned: '2026-10-20', conditionOnReturn: '' };
  assert.ok(receiptBookText(returned).includes('No condition noted.'));
  assert.equal(receiptBookText({ ...base, dateIssued: '2026-02-30' }), '');
});

test('summary counts outstanding and returned', () => {
  const list = returnReceiptBook([
    { id: 'RB-1', bookId: 'BOOK-7', issuedTo: 'Saad', dateIssued: '2026-10-05' },
    { id: 'RB-2', bookId: 'BOOK-8', issuedTo: 'Ayesha', dateIssued: '2026-10-06' },
  ], 'RB-1', '2026-10-20', 'Good');
  assert.equal(receiptBookSummaryText(list), '2 receipt book(s) recorded: 1 outstanding, 1 returned.');
});

test('HTML escapes holder and book text', () => {
  const row = { ...base, issuedTo: '<b>Saad</b>', bookId: 'BOOK-&' };
  const html = receiptBookHtml(row);
  assert.ok(!html.includes('<b>Saad</b>'));
  assert.ok(html.includes('&lt;b&gt;Saad&lt;/b&gt;'));
  assert.ok(html.includes('BOOK-&amp;'));
  assert.ok(receiptBookAllHtml([]).includes('No receipt books recorded.'));
});

test('CSV export and filename', () => {
  const list = recordReceiptBook([], base);
  assert.equal(receiptBookFilename(), 'receipt-books.csv');
  const csv = receiptBookCsv(list);
  assert.ok(csv.startsWith('id,book_id,issued_to,date_issued,date_returned,condition_on_return'));
  assert.ok(csv.includes('RB-1,BOOK-7,Saad,2026-10-05,,'));
});

test('purity fence: module reads no storage, clock, or network', () => {
  assert.ok(!/localStorage|sessionStorage|new Date\(|Date\.now\(|fetch\(|XMLHttpRequest/.test(moduleSrc));
});

test('neighbour-module fence: series, reprint, and gap modules never opened', () => {
  assert.ok(!/receipt-series|receipt-reprints|receipt-gap|seriesStart|seriesEnd/.test(moduleSrc));
  assert.ok(!/from '\.\/receipt-series\.js'|from '\.\/receipt-reprints\.js'|from '\.\/receipt-gap-audit\.js'/.test(moduleSrc));
});

test('panel ids present in index.html', () => {
  for (const id of ['rbHeading', 'rbSummary', 'rbExportBtn', 'rbBookId', 'rbHolder', 'rbDateIssued', 'rbSaveBtn', 'rbRemoveId', 'rbRemoveBtn', 'rbReturnId', 'rbReturnDate', 'rbReturnCondition', 'rbReturnBtn', 'rbHolderFilter', 'rbAsOf', 'rbOpenBody', 'rbBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring present', () => {
  assert.ok(appJs.includes("from './receipt-book.js'"));
  assert.ok(appJs.includes('renderReceiptBooks'));
  assert.ok(appJs.includes('shahdara_receipt_books_v1'));
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const added = appJs.match(/renderReceiptBooks[\s\S]{0,4000}/);
  assert.ok(added && !/\bOLT\b/.test(added[0]));
});
