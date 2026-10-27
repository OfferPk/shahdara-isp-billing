// Customer statement, second enhancement round: filtered export, payment
// method filter, sort, month subtotals, aging, trend chart, row detail.
// Every helper here is pure and tested on synthetic data only. Invariants
// carried over from the filters round: sorting/filtering never recompute
// running balances, and the HTML generator is unchanged without a view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCustomerStatement,
  filterStatementEvents,
  statementFilterMethods,
  sortStatementEvents,
  statementMonthSubtotals,
  statementDaysOverdue,
  statementAging,
  statementTrendSvg,
  generateCustomerStatementHtml,
  formatCustomerStatementWhatsApp,
  downloadCustomerStatementCsv
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

test('statementFilterMethods derives the sorted method list from the data', () => {
  const st = fixtureStatement();
  assert.deepEqual(statementFilterMethods(st.events), ['Billed Snapshot', 'Cash', 'Discount', 'JazzCash', 'Voucher']);
  assert.deepEqual(statementFilterMethods([]), []);
});

test('filterStatementEvents filters by method and ANDs it with type', () => {
  const st = fixtureStatement();
  assert.equal(filterStatementEvents(st.events, { method: 'JazzCash' }).length, 1);
  assert.equal(filterStatementEvents(st.events, { method: 'JazzCash' })[0].type, 'payment');
  assert.equal(filterStatementEvents(st.events, { type: 'payment', method: 'Cash' }).length, 1);
  assert.equal(filterStatementEvents(st.events, { type: 'payment', method: 'JazzCash' })[0].ref, 'p2');
  assert.match(filterStatementEvents(st.events, { type: 'payment', method: 'JazzCash' })[0].description, /JC9/);
  assert.equal(filterStatementEvents(st.events, { method: 'NoSuchMethod' }).length, 0);
  // Old callers without method still see everything.
  assert.equal(filterStatementEvents(st.events, {}).length, 6);
});

test('sortStatementEvents orders all four ways without mutating input or balances', () => {
  const st = fixtureStatement();
  const before = st.events.map(ev => `${ev.date}|${ev.type}`);
  const asc = sortStatementEvents(st.events, 'date-asc');
  assert.deepEqual(asc.map(ev => `${ev.date}|${ev.type}`), before);
  const desc = sortStatementEvents(st.events, 'date-desc');
  assert.equal(desc[0].date, '2026-10-15');
  assert.equal(desc[desc.length - 1].date, '2026-09-05');
  const highLow = sortStatementEvents(st.events, 'amount-desc');
  assert.deepEqual(highLow.map(ev => (ev.charge > 0 ? ev.charge : ev.credit)), [2600, 2000, 1800, 1000, 500, 200]);
  const lowHigh = sortStatementEvents(st.events, 'amount-asc');
  assert.deepEqual(lowHigh.map(ev => (ev.charge > 0 ? ev.charge : ev.credit)), [200, 500, 1000, 1800, 2000, 2600]);
  // Balances travel with their rows: the 2600 bill still carries balance 2600.
  assert.equal(highLow[0].runningBalance, 2600);
  // Input untouched and unknown sort falls back to today's order.
  assert.deepEqual(st.events.map(ev => `${ev.date}|${ev.type}`), before);
  assert.deepEqual(sortStatementEvents(st.events, 'bogus').map(ev => `${ev.date}|${ev.type}`), before);
});

test('statementMonthSubtotals groups billed/paid/balance newest first', () => {
  const st = fixtureStatement();
  const subs = statementMonthSubtotals(st.events);
  assert.deepEqual(subs.map(s => s.month), ['2026-10', '2026-09']);
  assert.deepEqual(subs[0], { month: '2026-10', billed: 2600, paid: 1500, balance: 1100 });
  assert.deepEqual(subs[1], { month: '2026-09', billed: 2000, paid: 2000, balance: 0 });
  assert.deepEqual(statementMonthSubtotals([]), []);
});

test('statementDaysOverdue counts whole past days only', () => {
  assert.equal(statementDaysOverdue('2026-09-05', '2026-10-20'), 45);
  assert.equal(statementDaysOverdue('2026-10-20', '2026-10-20'), 0);
  assert.equal(statementDaysOverdue('2026-10-21', '2026-10-20'), 0);
  assert.equal(statementDaysOverdue('not-a-date', '2026-10-20'), 0);
});

test('statementAging allocates outstanding to the oldest bills first (FIFO)', () => {
  const st = fixtureStatement();
  // Reference 2026-10-20: Sep bill 45 days overdue (31-60), Oct bill 15 days (1-30).
  const aged = statementAging(st.events, st.currentBalance, '2026-10-20');
  assert.equal(aged.total, 1100);
  assert.deepEqual(aged.buckets.map(b => [b.key, b.amount]), [
    ['not-due', 0], ['1-30', 0], ['31-60', 1100], ['61-90', 0], ['90+', 0]
  ]);
  // Zero outstanding ages to zero everywhere.
  const zero = statementAging(st.events, 0, '2026-10-20');
  assert.equal(zero.total, 0);
  assert.ok(zero.buckets.every(b => b.amount === 0));
  // Outstanding beyond total bill charges: remainder ages with the oldest bill.
  const big = statementAging(st.events, 5000, '2026-10-20');
  assert.equal(big.total, 5000);
  assert.equal(big.buckets.find(b => b.key === '31-60').amount, 2400);
  assert.equal(big.buckets.find(b => b.key === '1-30').amount, 2600);
  // No bills at all: unageable outstanding lands in Not due.
  const noBills = statementAging([{ type: 'adjustment', charge: 500, date: '2026-10-01' }], 500, '2026-10-20');
  assert.equal(noBills.buckets.find(b => b.key === 'not-due').amount, 500);
});

test('statementTrendSvg handles empty, single and multi-point data', () => {
  assert.equal(statementTrendSvg([]), '');
  const st = fixtureStatement();
  const single = statementTrendSvg([st.events[0]]);
  assert.match(single, /<svg/);
  assert.match(single, /<circle/);
  const multi = statementTrendSvg(st.events);
  assert.match(multi, /<polyline/);
  assert.equal((multi.match(/<circle/g) || []).length, st.events.length);
});

test('generateCustomerStatementHtml renders the new blocks only with a view', () => {
  const st = fixtureStatement();
  const plain = generateCustomerStatementHtml(st);
  assert.doesNotMatch(plain, /Month subtotals/);
  assert.doesNotMatch(plain, /Aging of outstanding/);
  assert.doesNotMatch(plain, /Balance trend/);
  const view = {
    events: st.events,
    monthSubtotals: statementMonthSubtotals(st.events),
    aging: statementAging(st.events, st.currentBalance, '2026-10-20'),
    trendSvg: statementTrendSvg(st.events)
  };
  const html = generateCustomerStatementHtml(st, view);
  assert.match(html, /Month subtotals \(visible entries\)/);
  assert.match(html, /Aging of outstanding balance/);
  assert.match(html, /Balance trend \(visible entries\)/);
  assert.match(html, /data-statement-row="0"/);
  // Both fixture bills are past due relative to any real today after Oct 2026.
  assert.match(html, /statement-overdue-badge/);
});

test('formatCustomerStatementWhatsApp filtered view covers only visible rows', () => {
  const st = fixtureStatement();
  const full = formatCustomerStatementWhatsApp(st);
  assert.match(full, /Total Billed Charges/);
  const payments = filterStatementEvents(st.events, { type: 'payment' });
  const filtered = formatCustomerStatementWhatsApp(st, { events: payments });
  assert.match(filtered, /Filtered view:/);
  assert.match(filtered, /Filtered Payments/);
  assert.match(filtered, /2,800/);
  assert.doesNotMatch(filtered, /Total Billed Charges/);
});

test('downloadCustomerStatementCsv filtered view exports visible rows plus a NOTE row', () => {
  const statementData = {
    customer: { id: 'c1', customerNumber: 7, name: 'Bilal Ahmad' },
    range: 'all',
    events: [
      { date: '2026-01-05', type: 'bill', month: '2026-01', description: 'Monthly Bill', method: 'Billed', charge: 2500, credit: 0, runningBalance: 2500 },
      { date: '2026-01-10', type: 'payment', month: '2026-01', description: 'Payment Received', method: 'Cash', charge: 0, credit: 2500, runningBalance: 0 }
    ]
  };
  let downloadedFilename = '';
  let downloadedContent = '';
  const fakeLink = {
    setAttribute(k, v) {
      if (k === 'download') downloadedFilename = v;
      if (k === 'href') downloadedContent = v;
    },
    style: {},
    click() {}
  };
  const origBlob = globalThis.Blob;
  const origURL = globalThis.URL;
  try {
    globalThis.Blob = class {
      constructor(chunks) { this.content = chunks.join(''); }
    };
    globalThis.URL = {
      createObjectURL: (blob) => `blob:${blob.content}`,
      revokeObjectURL: () => {}
    };
    const fakeDoc = {
      createElement: () => fakeLink,
      body: { appendChild: () => {}, removeChild: () => {} }
    };
    const visible = [statementData.events[1]];
    const res = downloadCustomerStatementCsv(statementData, fakeDoc, { events: visible });
    assert.equal(res, true);
    assert.match(downloadedFilename, /_filtered_/);
    assert.match(downloadedContent, /Filtered view: showing 1 of 2 entries/);
    assert.match(downloadedContent, /Payment Received/);
    assert.doesNotMatch(downloadedContent, /Monthly Bill/);
    // Unfiltered export is byte-identical in shape to before: no NOTE row.
    downloadedContent = '';
    downloadCustomerStatementCsv(statementData, fakeDoc);
    assert.doesNotMatch(downloadedContent, /Filtered view/);
    assert.match(downloadedContent, /Monthly Bill/);
  } finally {
    globalThis.Blob = origBlob;
    globalThis.URL = origURL;
  }
});
