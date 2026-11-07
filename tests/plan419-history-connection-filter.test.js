import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_CONNECTION_FILTER_ALL,
  historyConnectionFilterConnectionOf,
  historyConnectionFilterOptions,
  normalizeHistoryConnectionFilter,
  filterHistoryEntriesByConnection,
  historyConnectionFilterCounts,
  historyConnectionFilterSubtotals,
  formatHistoryConnectionFilterAmount,
  historyConnectionFilterSelectMarkup,
  historyConnectionFilterEmptyText,
  historyConnectionFilterSummaryText,
} from '../history-connection-filter.js';

function linkFixture() {
  return {
    id: 'BL-1',
    customer: 'CUST-1',
    primaryConnection: 'house',
    linkedConnection: 'shop',
    linkDate: '2026-09-01',
    linkNote: '',
    dateUnlinked: '',
  };
}

function entriesFixture() {
  return [
    { type: 'charge', date: '2026-09-05', month: '2026-09', amountCents: 300000, runningBalanceCents: 300000, note: '', method: '', ref: 'BILL-1', voided: false, connection: 'house' },
    { type: 'payment', date: '2026-09-06', month: '2026-09', amountCents: 300000, runningBalanceCents: 0, note: '', method: 'Cash', ref: 'PAY-1', voided: false, connection: 'house' },
    { type: 'charge', date: '2026-10-05', month: '2026-10', amountCents: 200000, runningBalanceCents: 200000, note: '', method: '', ref: 'BILL-2', voided: false, connection: 'shop' },
    { type: 'payment', date: '2026-10-06', month: '2026-10', amountCents: 150000, runningBalanceCents: 50000, note: '', method: 'JazzCash', ref: 'PAY-2', voided: false, connection: 'shop' },
    { type: 'payment', date: '2026-10-07', month: '2026-10', amountCents: 100000, runningBalanceCents: -50000, note: '', method: 'Cash', ref: 'PAY-3', voided: false },
    { type: 'refund', date: '2026-10-08', month: '2026-10', amountCents: 50000, runningBalanceCents: 0, note: 'double charge', method: 'Cash', ref: 'REF-1', voided: false, connection: 'shop' },
    { type: 'payment', date: '2026-10-09', month: '2026-10', amountCents: 200000, runningBalanceCents: -200000, note: '', method: 'Cash', ref: 'PAY-4', voided: true, connection: 'house' },
  ];
}

test('options from a billing-link record: all first, then primary and linked in order', () => {
  assert.deepEqual(historyConnectionFilterOptions(linkFixture()), [
    { id: 'all', label: 'All connections' },
    { id: 'house', label: 'house' },
    { id: 'shop', label: 'shop' },
  ]);
});

test('options dedupe a link that names the same connection twice, case-insensitively', () => {
  const link = linkFixture();
  link.linkedConnection = 'House';
  assert.deepEqual(historyConnectionFilterOptions(link), [
    { id: 'all', label: 'All connections' },
    { id: 'house', label: 'house' },
  ]);
});

test('options from connection rows keep their labels', () => {
  assert.deepEqual(
    historyConnectionFilterOptions([
      { id: 'house', label: 'House connection' },
      { id: 'shop', label: 'Shop connection' },
    ]),
    [
      { id: 'all', label: 'All connections' },
      { id: 'house', label: 'House connection' },
      { id: 'shop', label: 'Shop connection' },
    ],
  );
});

test('options from plain connection names use the name as the label', () => {
  assert.deepEqual(historyConnectionFilterOptions(['house', 'shop']), [
    { id: 'all', label: 'All connections' },
    { id: 'house', label: 'house' },
    { id: 'shop', label: 'shop' },
  ]);
});

test('options with no source offer All connections only', () => {
  assert.deepEqual(historyConnectionFilterOptions(null), [
    { id: 'all', label: 'All connections' },
  ]);
  assert.deepEqual(historyConnectionFilterOptions(undefined), [
    { id: 'all', label: 'All connections' },
  ]);
  assert.deepEqual(historyConnectionFilterOptions([]), [
    { id: 'all', label: 'All connections' },
  ]);
});

test('options drop blank connections and blank rows', () => {
  assert.deepEqual(historyConnectionFilterOptions(['', '  ', 'house']), [
    { id: 'all', label: 'All connections' },
    { id: 'house', label: 'house' },
  ]);
});

test('normalize keeps a valid choice and folds case', () => {
  const link = linkFixture();
  assert.equal(normalizeHistoryConnectionFilter('house', link), 'house');
  assert.equal(normalizeHistoryConnectionFilter('SHOP', link), 'shop');
  assert.equal(normalizeHistoryConnectionFilter('all', link), 'all');
});

test('normalize reads an unknown or missing choice as all, so a damaged choice never drops entries', () => {
  const link = linkFixture();
  assert.equal(normalizeHistoryConnectionFilter('office', link), 'all');
  assert.equal(normalizeHistoryConnectionFilter('', link), 'all');
  assert.equal(normalizeHistoryConnectionFilter(null, link), 'all');
  assert.equal(normalizeHistoryConnectionFilter(undefined, link), 'all');
});

test('normalize with no source reads any named choice as all', () => {
  assert.equal(normalizeHistoryConnectionFilter('house', null), 'all');
  assert.equal(normalizeHistoryConnectionFilter('house'), 'all');
});

test('connection of an entry reads its recorded connection, folded', () => {
  assert.equal(historyConnectionFilterConnectionOf({ connection: 'House' }), 'house');
  assert.equal(historyConnectionFilterConnectionOf({ connectionId: ' SHOP ' }), 'shop');
  assert.equal(historyConnectionFilterConnectionOf({ connection: 'house', connectionId: 'shop' }), 'house');
  assert.equal(historyConnectionFilterConnectionOf({}), '');
  assert.equal(historyConnectionFilterConnectionOf(null), '');
  assert.equal(historyConnectionFilterConnectionOf('house'), '');
});

test('filter all returns every entry in order, as a new array, without mutating the input', () => {
  const entries = entriesFixture();
  const before = JSON.stringify(entries);
  const filtered = filterHistoryEntriesByConnection(entries, 'all');
  assert.deepEqual(filtered, entries);
  assert.notEqual(filtered, entries);
  assert.equal(JSON.stringify(entries), before);
});

test('filter house returns exactly the house entries, in order', () => {
  const refs = filterHistoryEntriesByConnection(entriesFixture(), 'house').map((entry) => entry.ref);
  assert.deepEqual(refs, ['BILL-1', 'PAY-1', 'PAY-4']);
});

test('filter shop returns exactly the shop entries, in order', () => {
  const refs = filterHistoryEntriesByConnection(entriesFixture(), 'shop').map((entry) => entry.ref);
  assert.deepEqual(refs, ['BILL-2', 'PAY-2', 'REF-1']);
});

test('filter matches case-insensitively', () => {
  const refs = filterHistoryEntriesByConnection(entriesFixture(), 'SHOP').map((entry) => entry.ref);
  assert.deepEqual(refs, ['BILL-2', 'PAY-2', 'REF-1']);
});

test('an untagged entry appears only under all', () => {
  const entries = entriesFixture();
  assert.ok(filterHistoryEntriesByConnection(entries, 'all').some((entry) => entry.ref === 'PAY-3'));
  assert.ok(!filterHistoryEntriesByConnection(entries, 'house').some((entry) => entry.ref === 'PAY-3'));
  assert.ok(!filterHistoryEntriesByConnection(entries, 'shop').some((entry) => entry.ref === 'PAY-3'));
});

test('filter with an unknown connection matches nothing', () => {
  assert.deepEqual(filterHistoryEntriesByConnection(entriesFixture(), 'office'), []);
});

test('filter with a missing or non-array list returns an empty list', () => {
  assert.deepEqual(filterHistoryEntriesByConnection(null, 'house'), []);
  assert.deepEqual(filterHistoryEntriesByConnection(undefined, 'house'), []);
  assert.deepEqual(filterHistoryEntriesByConnection('house', 'house'), []);
});

test('counts: named counts plus untagged plus other always sum to the total', () => {
  const counts = historyConnectionFilterCounts(entriesFixture(), linkFixture());
  assert.equal(counts.total, 7);
  assert.equal(counts.all, 7);
  assert.equal(counts.house, 3);
  assert.equal(counts.shop, 3);
  assert.equal(counts.untagged, 1);
  assert.equal(counts.other, 0);
  assert.equal(counts.house + counts.shop + counts.untagged + counts.other, counts.total);
});

test('counts: an entry tagged with a connection the options do not offer counts as other', () => {
  const entries = entriesFixture();
  entries.push({ type: 'payment', date: '2026-10-10', month: '2026-10', amountCents: 50000, runningBalanceCents: 0, note: '', method: 'Cash', ref: 'PAY-5', voided: false, connection: 'office' });
  const counts = historyConnectionFilterCounts(entries, linkFixture());
  assert.equal(counts.total, 8);
  assert.equal(counts.other, 1);
  assert.equal(counts.house + counts.shop + counts.untagged + counts.other, counts.total);
});

test('subtotals for house: billed PKR 3,000, paid PKR 3,000, still owed PKR 0', () => {
  const house = filterHistoryEntriesByConnection(entriesFixture(), 'house');
  assert.deepEqual(historyConnectionFilterSubtotals(house), {
    count: 3,
    billedCents: 300000,
    paidCents: 300000,
    stillOwedCents: 0,
  });
});

test('subtotals for shop: billed PKR 2,500, paid PKR 1,500, still owed PKR 1,000', () => {
  const shop = filterHistoryEntriesByConnection(entriesFixture(), 'shop');
  assert.deepEqual(historyConnectionFilterSubtotals(shop), {
    count: 3,
    billedCents: 250000,
    paidCents: 150000,
    stillOwedCents: 100000,
  });
});

test('subtotals for all: billed PKR 5,500, paid PKR 5,500, still owed PKR 0', () => {
  assert.deepEqual(historyConnectionFilterSubtotals(entriesFixture()), {
    count: 7,
    billedCents: 550000,
    paidCents: 550000,
    stillOwedCents: 0,
  });
});

test('subtotals: a voided entry contributes nothing', () => {
  const house = filterHistoryEntriesByConnection(entriesFixture(), 'house');
  // The voided PKR 2,000 house payment is listed (count 3) but moves no total:
  // paid stays PKR 3,000, not PKR 5,000.
  assert.equal(historyConnectionFilterSubtotals(house).paidCents, 300000);
});

test('subtotals: an adjustment-sourced credit counts as paid, an overpayment credit counts nothing', () => {
  const entries = [
    { type: 'charge', date: '2026-09-05', month: '2026-09', amountCents: 100000, runningBalanceCents: 100000, note: '', method: '', ref: 'BILL-1', voided: false, connection: 'house' },
    { type: 'credit', date: '2026-09-06', month: '', amountCents: 40000, runningBalanceCents: 60000, note: '', method: '', ref: 'CR-1', voided: false, source: 'adjustment', connection: 'house' },
    { type: 'credit', date: '2026-09-07', month: '', amountCents: 60000, runningBalanceCents: 60000, note: '', method: '', ref: 'CR-2', voided: false, source: 'overpayment', connection: 'house' },
  ];
  assert.deepEqual(historyConnectionFilterSubtotals(entries), {
    count: 3,
    billedCents: 100000,
    paidCents: 40000,
    stillOwedCents: 60000,
  });
});

test('subtotals: an entry with no usable amount contributes nothing, never a guessed zero', () => {
  const entries = [
    { type: 'charge', date: '2026-09-05', month: '2026-09', amountCents: null, runningBalanceCents: 0, note: '', method: '', ref: 'BILL-1', voided: false, connection: 'house' },
    { type: 'charge', date: '2026-09-06', month: '2026-09', amountCents: true, runningBalanceCents: 0, note: '', method: '', ref: 'BILL-2', voided: false, connection: 'house' },
    { type: 'payment', date: '2026-09-07', month: '2026-09', amountCents: 100000, runningBalanceCents: 0, note: '', method: 'Cash', ref: 'PAY-1', voided: false, connection: 'house' },
  ];
  assert.deepEqual(historyConnectionFilterSubtotals(entries), {
    count: 3,
    billedCents: 0,
    paidCents: 100000,
    stillOwedCents: -100000,
  });
});

test('subtotals with a missing or non-array list are all zero', () => {
  assert.deepEqual(historyConnectionFilterSubtotals(null), {
    count: 0,
    billedCents: 0,
    paidCents: 0,
    stillOwedCents: 0,
  });
  assert.deepEqual(historyConnectionFilterSubtotals([]), {
    count: 0,
    billedCents: 0,
    paidCents: 0,
    stillOwedCents: 0,
  });
});

test('amounts print with no decimals for whole rupees and one decimal for a paisa remainder', () => {
  assert.equal(formatHistoryConnectionFilterAmount(150000), 'PKR 1,500');
  assert.equal(formatHistoryConnectionFilterAmount(150050), 'PKR 1,500.5');
  assert.equal(formatHistoryConnectionFilterAmount(0), 'PKR 0');
  assert.equal(formatHistoryConnectionFilterAmount(-5000), '-PKR 50');
  assert.equal(formatHistoryConnectionFilterAmount(null), 'PKR 0');
  assert.equal(formatHistoryConnectionFilterAmount('not a number'), 'PKR 0');
});

test('select markup lists each connection with its live count and marks the chosen one', () => {
  const markup = historyConnectionFilterSelectMarkup(linkFixture(), 'shop', entriesFixture());
  assert.equal(
    markup,
    '<label class="field-label" for="hcfHistoryConnectionFilter">Connection</label><select id="hcfHistoryConnectionFilter" class="hcf-filter">'
    + '<option value="all">All connections (7)</option>'
    + '<option value="house">house (3)</option>'
    + '<option value="shop" selected>shop (3)</option>'
    + '</select>',
  );
});

test('select markup defaults to all and escapes labels', () => {
  const markup = historyConnectionFilterSelectMarkup([{ id: 'a<b', label: 'A <b> connection' }], '', []);
  assert.ok(markup.includes('<option value="all" selected>All connections (0)</option>'));
  assert.ok(markup.includes('<option value="a&lt;b">A &lt;b&gt; connection (0)</option>'));
  assert.ok(!markup.includes('<b> connection'));
});

test('empty text is blank for all and names the connection otherwise', () => {
  const link = linkFixture();
  assert.equal(historyConnectionFilterEmptyText('all', link), '');
  assert.equal(historyConnectionFilterEmptyText('house', link), 'No house entries');
  assert.equal(historyConnectionFilterEmptyText('shop', link), 'No shop entries');
  assert.equal(historyConnectionFilterEmptyText('office', link), '');
});

test('summary is blank for all', () => {
  const entries = entriesFixture();
  assert.equal(historyConnectionFilterSummaryText(entries, entries, 'all', linkFixture()), '');
});

test('summary for shop shows its subtotals', () => {
  const entries = entriesFixture();
  const shop = filterHistoryEntriesByConnection(entries, 'shop');
  assert.equal(
    historyConnectionFilterSummaryText(shop, entries, 'shop', linkFixture()),
    '3 of 7 entries · shop · Billed PKR 2,500 · Paid PKR 1,500 · Still owed PKR 1,000',
  );
});

test('summary for house shows its subtotals, with a voided entry listed but moving nothing', () => {
  const entries = entriesFixture();
  const house = filterHistoryEntriesByConnection(entries, 'house');
  assert.equal(
    historyConnectionFilterSummaryText(house, entries, 'house', linkFixture()),
    '3 of 7 entries · house · Billed PKR 3,000 · Paid PKR 3,000 · Still owed PKR 0',
  );
});

test('summary adds the disputed-only note when a disputed view is in force', () => {
  const entries = entriesFixture();
  const shop = filterHistoryEntriesByConnection(entries, 'shop');
  assert.equal(
    historyConnectionFilterSummaryText(shop, entries, 'shop', linkFixture(), 'disputed'),
    '3 of 7 entries · shop · Disputed only · Billed PKR 2,500 · Paid PKR 1,500 · Still owed PKR 1,000',
  );
});

test('summary uses the singular entry count for one shown entry', () => {
  const entries = entriesFixture();
  const one = filterHistoryEntriesByConnection(entries, 'house').slice(0, 1);
  assert.equal(
    historyConnectionFilterSummaryText(one, entries, 'house', linkFixture()),
    '1 entry of 7 · house · Billed PKR 3,000 · Paid PKR 0 · Still owed PKR 3,000',
  );
});

test('clearing the filter returns the full history', () => {
  const entries = entriesFixture();
  const filtered = filterHistoryEntriesByConnection(entries, 'house');
  assert.equal(filtered.length, 3);
  assert.deepEqual(filterHistoryEntriesByConnection(entries, 'all'), entries);
});

test('filtering, subtotals and summary never mutate the entries given', () => {
  const entries = entriesFixture();
  const before = JSON.stringify(entries);
  filterHistoryEntriesByConnection(entries, 'house');
  historyConnectionFilterSubtotals(entries);
  historyConnectionFilterSummaryText(entries, entries, 'shop', linkFixture());
  historyConnectionFilterCounts(entries, linkFixture());
  assert.equal(JSON.stringify(entries), before);
});

test('wiring: app.js imports the module, offers the link connections, and filters the shown rows', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("import { HISTORY_CONNECTION_FILTER_ALL, historyConnectionFilterOptions, normalizeHistoryConnectionFilter, filterHistoryEntriesByConnection, historyConnectionFilterSelectMarkup, historyConnectionFilterEmptyText, historyConnectionFilterSummaryText } from './history-connection-filter.js';"));
  assert.ok(app.includes("findBillingLink(loadBillingLinks(), customer.id)"));
  assert.ok(app.includes("$('#hcfHistoryConnectionFilterHost')"));
  assert.ok(app.includes("filterHistoryEntriesByConnection("));
  assert.ok(app.includes("historyConnectionFilterSummaryText(shown, entries, fullHistoryConnectionFilter"));
});

test('wiring: index.html carries the connection filter host after the disputed host', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const disputedAt = html.indexOf('id="hdfHistoryDisputedFlagHost"');
  const connectionAt = html.indexOf('id="hcfHistoryConnectionFilterHost"');
  assert.ok(disputedAt !== -1);
  assert.ok(connectionAt !== -1);
  assert.ok(connectionAt > disputedAt);
});

test('module header names no fenced filename literally', () => {
  const source = readFileSync(new URL('../history-connection-filter.js', import.meta.url), 'utf8');
  const fenced = [
    'full-' + 'history-list.js',
    'combined-' + 'dues.js',
    'billing-' + 'link.js',
    'history-' + 'type-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'disputed-flag.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'history-' + 'csv-export.js',
    'history-' + 'printed-statement.js',
    'history-' + 'gap-view.js',
    'history-' + 'largest-payment.js',
    'history-' + 'first-dates.js',
    'history-' + 'refunds-inline.js',
    'history-' + 'credit-inline.js',
    'history-' + 'adjustments-inline.js',
    'history-' + 'month-comparison.js',
    'history-' + 'running-balance.js',
  ];
  for (const name of fenced) {
    assert.ok(!source.includes(name), `header must not name ${name}`);
  }
});

test('module is pure: no clock, storage, network, or page access', () => {
  const source = readFileSync(new URL('../history-connection-filter.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('window.'));
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('OLT'));
});
