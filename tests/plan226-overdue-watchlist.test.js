import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validWatchlistDate,
  normalizeOverdueWatchlistList,
  overdueWatchlistSorted,
  watchlistActive,
  watchlistHistory,
  findOverdueWatchlistEntry,
  recordOverdueWatchlistEntry,
  removeOverdueWatchlistEntry,
  watchlistOverdueReviews,
  watchlistForCustomer,
  watchlistForOwner,
  watchlistTotalOverdueCents,
  overdueWatchlistEntryText,
  overdueWatchlistSummaryText,
  overdueWatchlistEntryHtml,
  overdueWatchlistAllHtml,
  overdueWatchlistCsv,
  overdueWatchlistFilename,
} from '../overdue-watchlist.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'overdue-watchlist.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const base = { id: 'OW-1', customer: 'Ahmed', amountOverdueCents: 500000, reason: 'Two months unpaid', reviewDate: '2026-11-10', owner: 'Saad' };

test('half-formed watch entry is refused', () => {
  assert.equal(recordOverdueWatchlistEntry([], { ...base, customer: '' }), null);
  assert.equal(recordOverdueWatchlistEntry([], { ...base, amountOverdueCents: 0 }), null);
  assert.equal(recordOverdueWatchlistEntry([], { ...base, amountOverdueCents: -100 }), null);
  assert.equal(recordOverdueWatchlistEntry([], { ...base, reviewDate: '' }), null);
  assert.equal(recordOverdueWatchlistEntry([], { ...base, id: '' }), null);
});

test('strict dates: calendar dates only', () => {
  assert.equal(validWatchlistDate('2026-02-30'), false);
  assert.equal(validWatchlistDate('2026-02-29'), false);
  assert.equal(validWatchlistDate('2024-02-29'), true);
  assert.equal(validWatchlistDate('2026-13-01'), false);
  assert.equal(validWatchlistDate('2026-11-10'), true);
  assert.equal(recordOverdueWatchlistEntry([], { ...base, reviewDate: '2026-02-30' }), null);
});

test('unknown fields are dropped', () => {
  const list = recordOverdueWatchlistEntry([], { ...base, suspended: true, disconnectNow: 'yes' });
  assert.equal(list.length, 1);
  assert.equal('suspended' in list[0], false);
  assert.equal('disconnectNow' in list[0], false);
});

test('missing reason and owner render as plain fallbacks', () => {
  const list = recordOverdueWatchlistEntry([], { id: 'OW-2', customer: 'Bilal', amountOverdueCents: 10000, reviewDate: '2026-11-12' });
  assert.equal(list[0].reason, 'No reason noted.');
  assert.equal(list[0].owner, 'No owner noted.');
});

test('duplicate id is refused', () => {
  const first = recordOverdueWatchlistEntry([], base);
  assert.equal(recordOverdueWatchlistEntry(first, { ...base, customer: 'Other' }), null);
});

test('one active entry per customer', () => {
  const first = recordOverdueWatchlistEntry([], base);
  assert.equal(recordOverdueWatchlistEntry(first, { ...base, id: 'OW-9', reviewDate: '2026-11-20' }), null);
  assert.equal(recordOverdueWatchlistEntry(first, { ...base, id: 'OW-9', customer: 'ahmed', reviewDate: '2026-11-20' }), null);
});

test('find entry by id', () => {
  const list = recordOverdueWatchlistEntry([], base);
  assert.equal(findOverdueWatchlistEntry(list, 'OW-1').customer, 'Ahmed');
  assert.equal(findOverdueWatchlistEntry(list, 'OW-99'), null);
  assert.equal(findOverdueWatchlistEntry(list, ''), null);
});

test('removal keeps a dated history entry', () => {
  const list = recordOverdueWatchlistEntry([], base);
  const after = removeOverdueWatchlistEntry(list, 'OW-1', '2026-11-15');
  assert.equal(watchlistActive(after).length, 0);
  assert.equal(watchlistHistory(after).length, 1);
  assert.equal(watchlistHistory(after)[0].removedDate, '2026-11-15');
  assert.equal(watchlistHistory(after)[0].customer, 'Ahmed');
  assert.match(overdueWatchlistEntryText(watchlistHistory(after)[0]), /Removed 2026-11-15/);
});

test('removed customer may be watched again with a fresh entry', () => {
  const list = recordOverdueWatchlistEntry([], base);
  const after = removeOverdueWatchlistEntry(list, 'OW-1', '2026-11-15');
  const again = recordOverdueWatchlistEntry(after, { ...base, id: 'OW-2', reviewDate: '2026-12-01' });
  assert.equal(watchlistActive(again).length, 1);
  assert.equal(watchlistActive(again)[0].id, 'OW-2');
  assert.equal(watchlistHistory(again).length, 1);
});

test('bad removal leaves the list unchanged', () => {
  const list = recordOverdueWatchlistEntry([], base);
  assert.deepEqual(removeOverdueWatchlistEntry(list, 'OW-1', '2026-02-30'), list);
  assert.deepEqual(removeOverdueWatchlistEntry(list, 'OW-99', '2026-11-15'), list);
  assert.deepEqual(removeOverdueWatchlistEntry(list, 'OW-1', ''), list);
  const removed = removeOverdueWatchlistEntry(list, 'OW-1', '2026-11-15');
  assert.deepEqual(removeOverdueWatchlistEntry(removed, 'OW-1', '2026-11-20'), removed);
});

test('watchlist sorts by review date, then customer', () => {
  let list = recordOverdueWatchlistEntry([], { ...base, id: 'OW-1', customer: 'Zara', reviewDate: '2026-11-20' });
  list = recordOverdueWatchlistEntry(list, { ...base, id: 'OW-2', customer: 'Ahmed', reviewDate: '2026-11-10' });
  list = recordOverdueWatchlistEntry(list, { ...base, id: 'OW-3', customer: 'Bilal', reviewDate: '2026-11-10' });
  assert.deepEqual(overdueWatchlistSorted(list).map((e) => e.id), ['OW-2', 'OW-3', 'OW-1']);
});

test('overdue reviews flagged only before the as-of date', () => {
  let list = recordOverdueWatchlistEntry([], { ...base, id: 'OW-1', reviewDate: '2026-11-09' });
  list = recordOverdueWatchlistEntry(list, { ...base, id: 'OW-2', customer: 'Bilal', reviewDate: '2026-11-10' });
  list = recordOverdueWatchlistEntry(list, { ...base, id: 'OW-3', customer: 'Sara', reviewDate: '2026-11-11' });
  assert.deepEqual(watchlistOverdueReviews(list, '2026-11-10').map((e) => e.id), ['OW-1']);
  assert.deepEqual(watchlistOverdueReviews(list, 'bad-date'), []);
  assert.match(overdueWatchlistEntryText(list[0], '2026-11-10'), /REVIEW OVERDUE/);
  assert.doesNotMatch(overdueWatchlistEntryText(list[1], '2026-11-10'), /REVIEW OVERDUE/);
});

test('customer and owner filters are case-insensitive substrings', () => {
  let list = recordOverdueWatchlistEntry([], base);
  list = recordOverdueWatchlistEntry(list, { ...base, id: 'OW-2', customer: 'Bilal', owner: 'Owner2' });
  assert.deepEqual(watchlistForCustomer(list, 'ahm').map((e) => e.id), ['OW-1']);
  assert.deepEqual(watchlistForOwner(list, 'saad').map((e) => e.id), ['OW-1']);
  assert.equal(watchlistForCustomer(list, '').length, 2);
});

test('active total sums overdue amounts exactly', () => {
  let list = recordOverdueWatchlistEntry([], base);
  list = recordOverdueWatchlistEntry(list, { ...base, id: 'OW-2', customer: 'Bilal', amountOverdueCents: 250000 });
  assert.equal(watchlistTotalOverdueCents(list), 750000);
  const after = removeOverdueWatchlistEntry(list, 'OW-2', '2026-11-15');
  assert.equal(watchlistTotalOverdueCents(after), 500000);
});

test('summary text counts active, overdue, and history', () => {
  let list = recordOverdueWatchlistEntry([], { ...base, reviewDate: '2026-11-09' });
  list = recordOverdueWatchlistEntry(list, { ...base, id: 'OW-2', customer: 'Bilal', reviewDate: '2026-11-20' });
  const after = removeOverdueWatchlistEntry(list, 'OW-2', '2026-11-15');
  assert.match(overdueWatchlistSummaryText(after, '2026-11-10'), /1 account\(s\) on the watchlist/);
  assert.match(overdueWatchlistSummaryText(after, '2026-11-10'), /1 review\(s\) overdue/);
  assert.match(overdueWatchlistSummaryText(after, '2026-11-10'), /1 removed entr/);
});

test('rupees convert once, cents pass through as-is', () => {
  const byRupees = recordOverdueWatchlistEntry([], { ...base, amountOverdue: 5000 });
  assert.equal(byRupees[0].amountOverdueCents, 500000);
  const byCents = recordOverdueWatchlistEntry([], { ...base, amountOverdueCents: 500000 });
  assert.equal(byCents[0].amountOverdueCents, 500000);
  const reread = normalizeOverdueWatchlistList(byRupees);
  assert.equal(reread[0].amountOverdueCents, 500000);
});

test('inputs are never mutated', () => {
  const before = [base];
  const frozen = JSON.parse(JSON.stringify(before));
  recordOverdueWatchlistEntry(before, { ...base, id: 'OW-2', customer: 'Bilal' });
  removeOverdueWatchlistEntry(before, 'OW-1', '2026-11-15');
  assert.deepEqual(before, frozen);
});

test('text and HTML escaping', () => {
  const list = recordOverdueWatchlistEntry([], { ...base, customer: 'A <b>& Co', reason: 'Late "twice"' });
  assert.match(overdueWatchlistEntryHtml(list[0]), /A &lt;b&gt;&amp; Co/);
  assert.match(overdueWatchlistEntryHtml(list[0]), /Late &quot;twice&quot;/);
  assert.equal(overdueWatchlistAllHtml([]), '<p>No accounts on the watchlist.</p>');
});

test('CSV export and filename', () => {
  let list = recordOverdueWatchlistEntry([], base);
  list = recordOverdueWatchlistEntry(list, { ...base, id: 'OW-2', customer: 'Bilal, Jr', reviewDate: '2026-11-20' });
  const csv = overdueWatchlistCsv(list);
  assert.match(csv, /^id,customer,amountOverdueCents,reason,reviewDate,owner,removedDate\n/);
  assert.match(csv, /"Bilal, Jr"/);
  assert.equal(overdueWatchlistFilename(), 'overdue-watchlist.csv');
});

test('purity fence: no storage, clock, or network access', () => {
  assert.doesNotMatch(moduleSrc, /new Date\(|Date\.now\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest/);
});

test('neighbour-module fence: ladder, signals, and dashboard untouched by this module', () => {
  assert.doesNotMatch(moduleSrc, /escalation-ladder|at-risk-signals|dashboard\.js|from '\.\//);
});

test('panel ids present in index.html', () => {
  for (const id of ['owHeading', 'owSummary', 'owExportBtn', 'owCustomer', 'owAmount', 'owReason', 'owReviewDate', 'owOwner', 'owSaveBtn', 'owRemoveId', 'owRemoveDate', 'owRemoveBtn', 'owCustomerFilter', 'owOwnerFilter', 'owAsOf', 'owBody', 'owHistoryBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring present', () => {
  assert.ok(appJs.includes("from './overdue-watchlist.js'"));
  assert.ok(appJs.includes('renderOverdueWatchlist()'));
  assert.ok(appJs.includes('OVERDUE_WATCHLIST_KEY'));
});

test('deployment guard: no standalone OLT word added to app.js', () => {
  assert.doesNotMatch(appJs, /\bOLT\b/);
});
