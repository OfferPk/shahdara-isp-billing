// Customer ledger statement filters: view-only filtering over the statement
// computed by formatCustomerStatement. Filters must hide rows without ever
// rewriting running balances, and the HTML generator must stay identical
// when no view override is passed (existing statement tests depend on it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCustomerStatement,
  filterStatementEvents,
  statementFilterMonths,
  generateCustomerStatementHtml
} from '../form-validation.js';

function fixtureStatement() {
  const customer = {
    id: 'c1',
    customerNumber: '1',
    name: 'Test Customer',
    phone: '03001234567',
    area: 'Shahdara',
    package: '20 Mbps',
    serviceStatus: 'active',
    bills: [
      {
        id: 'b1', month: '2026-09', dueDate: '2026-09-05', dueAmount: 2000, lateFee: 0,
        payments: [
          { id: 'p1', date: '2026-09-06', amount: 1800, method: 'Cash', reference: 'R1', discount: 200, discountReason: 'Loyalty' }
        ]
      },
      {
        id: 'b2', month: '2026-10', dueDate: '2026-10-05', dueAmount: 2500, lateFee: 100,
        payments: [
          { id: 'p2', date: '2026-10-06', amount: 1000, method: 'JazzCash', reference: 'JC9' }
        ]
      }
    ]
  };
  const adjustments = [
    { id: 'v1', customerId: 'c1', date: '2026-10-15', month: '2026-10', amount: -500, type: 'credit', category: 'waiver', categoryLabel: 'Waiver', reason: 'Outage' }
  ];
  return formatCustomerStatement(customer, { range: 'all', adjustments });
}

test('statement fixture has all four entry types in chronological order', () => {
  const st = fixtureStatement();
  assert.deepEqual(st.events.map(ev => ev.type), ['bill', 'payment', 'discount', 'bill', 'payment', 'adjustment']);
  assert.equal(st.openingBalance + st.totalBilled - st.totalPaid, st.currentBalance);
  assert.equal(st.totalBilled, 4600);
  assert.equal(st.totalPaid, 3500);
  assert.equal(st.currentBalance, 1100);
});

test('filterStatementEvents filters by entry type', () => {
  const st = fixtureStatement();
  assert.equal(filterStatementEvents(st.events, { type: 'bill' }).length, 2);
  assert.ok(filterStatementEvents(st.events, { type: 'bill' }).every(ev => ev.type === 'bill'));
  assert.equal(filterStatementEvents(st.events, { type: 'payment' }).length, 2);
  assert.equal(filterStatementEvents(st.events, { type: 'discount' }).length, 1);
  assert.equal(filterStatementEvents(st.events, { type: 'adjustment' }).length, 1);
  assert.equal(filterStatementEvents(st.events, { type: 'all' }).length, 6);
});

test('filterStatementEvents filters by billing month', () => {
  const st = fixtureStatement();
  assert.equal(filterStatementEvents(st.events, { month: '2026-09' }).length, 3);
  assert.equal(filterStatementEvents(st.events, { month: '2026-10' }).length, 3);
  assert.equal(filterStatementEvents(st.events, { month: '2026-11' }).length, 0);
});

test('filterStatementEvents searches description, ref, method and type case-insensitively', () => {
  const st = fixtureStatement();
  assert.equal(filterStatementEvents(st.events, { query: 'jazzcash' }).length, 1);
  assert.equal(filterStatementEvents(st.events, { query: 'JAZZCASH' }).length, 1);
  assert.equal(filterStatementEvents(st.events, { query: 'r1' }).length, 1);
  assert.equal(filterStatementEvents(st.events, { query: 'waiver' }).length, 1);
  assert.equal(filterStatementEvents(st.events, { query: 'zzz-no-match' }).length, 0);
  assert.equal(filterStatementEvents(st.events, { query: '' }).length, 6);
});

test('filterStatementEvents combines type, month and query', () => {
  const st = fixtureStatement();
  const only = filterStatementEvents(st.events, { type: 'payment', month: '2026-10', query: 'jazz' });
  assert.equal(only.length, 1);
  assert.equal(only[0].method, 'JazzCash');
});

test('filtering never rewrites running balances', () => {
  const st = fixtureStatement();
  const payments = filterStatementEvents(st.events, { type: 'payment' });
  // Sep payment leaves 200 (the 200 discount settles it to zero afterwards);
  // Oct payment leaves 2600 - 1000 = 1600.
  assert.deepEqual(payments.map(ev => ev.runningBalance), [200, 1600]);
});

test('statementFilterMonths lists present months newest first', () => {
  const st = fixtureStatement();
  assert.deepEqual(statementFilterMonths(st.events), ['2026-10', '2026-09']);
  assert.deepEqual(statementFilterMonths([]), []);
});

test('generateCustomerStatementHtml without a view override is unchanged', () => {
  const st = fixtureStatement();
  const html = generateCustomerStatementHtml(st);
  assert.doesNotMatch(html, /statement-filter-note/);
  assert.match(html, /Monthly Bill \(2026-09\)/);
  assert.match(html, /Payment Received/);
  assert.match(html, /PKR 4,600/);
});

test('generateCustomerStatementHtml with a filtered view shows only those rows plus a status note', () => {
  const st = fixtureStatement();
  const payments = filterStatementEvents(st.events, { type: 'payment' });
  const html = generateCustomerStatementHtml(st, { events: payments, filterNote: 'Showing 2 of 6 entries' });
  assert.match(html, /Showing 2 of 6 entries/);
  assert.match(html, /Payment Received/);
  assert.doesNotMatch(html, /Monthly Bill \(2026-09\)/);
  // Period totals in the summary strip stay untouched by the view filter.
  assert.match(html, /PKR 4,600/);
});

test('generateCustomerStatementHtml with an empty filtered view shows the filtered empty state', () => {
  const st = fixtureStatement();
  const html = generateCustomerStatementHtml(st, { events: [], filterNote: 'Showing 0 of 6 entries' });
  assert.match(html, /No entries match these filters/);
  assert.match(html, /Showing 0 of 6 entries/);
});
