/**
 * plan68-balance-rollforward.test.js — Plan 68: customer balance
 * roll-forward (opening plus charges minus payments equals closing).
 * Pins:
 * - opening + charges - payments - concessions = closing exactly,
 *   per customer and in total, in integer cents;
 * - every line traces to its source record by id;
 * - a roll-forward that does not reconcile shows the difference
 *   plainly instead of forcing agreement;
 * - unusable figures are counted and named, never zero-filled;
 * - the module holds no bill, payment, concession, or Waada field
 *   of its own, and never mutates its inputs.
 * Synthetic data only; no ledger record is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validRollMonth,
  toRollCents,
  normalizeRollLine,
  buildCustomerRollForward,
  buildRollForwardTotals,
  rollForwardSummaryText,
  rollForwardHtml,
  rollForwardTableHtml,
  rollForwardCsv,
  rollForwardFilename,
} from '../balance-rollforward.js';

function rowA() {
  return buildCustomerRollForward({
    customerId: 'c1',
    customerName: 'Ahmed',
    mohalla: 'Bani',
    month: '2026-10',
    opening: 1000,
    charges: [{ sourceId: 'bill-2026-10', label: 'Bill Oct', amount: 1200 }],
    payments: [{ sourceId: 'receipt-1', label: 'Cash receipt', amount: 500 }],
    concessions: [{ sourceId: 'bill-2026-10-concession', label: 'Concession', amount: 100 }],
    reportedClosing: 1600,
  });
}

function rowB() {
  return buildCustomerRollForward({
    customerId: 'c2',
    customerName: 'Bilal',
    mohalla: 'Kishti',
    month: '2026-10',
    opening: 200,
    charges: [{ sourceId: 'bill-2026-10-b', label: 'Bill Oct', amount: 300 }],
    payments: [{ sourceId: 'receipt-2', label: 'Cash receipt', amount: 100 }],
    concessions: [],
    reportedClosing: 400,
  });
}

test('strict months and amount conversion', () => {
  assert.equal(validRollMonth('2026-10'), true);
  assert.equal(validRollMonth('2026-13'), false);
  assert.equal(validRollMonth('10-2026'), false);
  assert.equal(toRollCents(100), 10000);
  assert.equal(toRollCents('333.33'), 33333);
  assert.equal(toRollCents(null), null);
  assert.equal(toRollCents(''), null);
  assert.equal(toRollCents('   '), null);
  assert.equal(toRollCents(true), null);
  assert.equal(toRollCents(false), null);
  assert.equal(toRollCents(Number.NaN), null);
  assert.equal(toRollCents(-5), null);
  assert.equal(toRollCents('abc'), null);
});

test('per-customer roll-forward reconciles exactly', () => {
  const row = rowA();
  assert.equal(row.opening, 1000);
  assert.equal(row.chargesTotal, 1200);
  assert.equal(row.paymentsTotal, 500);
  assert.equal(row.concessionsTotal, 100);
  assert.equal(row.computedClosing, 1600);
  assert.equal(row.reportedClosing, 1600);
  assert.equal(row.reconciles, true);
  assert.equal(row.difference, null);
  assert.equal(row.status, 'reconciles');
});

test('exact cent sums, no float drift', () => {
  const row = buildCustomerRollForward({
    customerId: 'c3',
    customerName: 'Usman',
    month: '2026-10',
    opening: 0,
    charges: [
      { sourceId: 'bill-a', label: 'Package', amount: 333.33 },
      { sourceId: 'bill-b', label: 'Kist', amount: 166.67 },
    ],
    payments: [],
    concessions: [],
    reportedClosing: 500,
  });
  assert.equal(row.chargesTotal, 500);
  assert.equal(row.computedClosing, 500);
  assert.equal(row.reconciles, true);
});

test('a differing roll-forward shows the difference plainly', () => {
  const row = buildCustomerRollForward({ customerId: 'c1', customerName: 'Ahmed', month: '2026-10', opening: 1000, charges: [{ sourceId: 'bill-2026-10', label: 'Bill Oct', amount: 1200 }], payments: [{ sourceId: 'receipt-1', label: 'Cash receipt', amount: 500 }], concessions: [{ sourceId: 'bill-2026-10-concession', label: 'Concession', amount: 100 }], reportedClosing: 1500 });
  assert.equal(row.computedClosing, 1600);
  assert.equal(row.reconciles, false);
  assert.equal(row.difference, 100);
  assert.equal(row.status, 'difference');
  assert.match(rollForwardSummaryText(row), /differs by Rs\. 100\.00/);
});

test('no reported closing means uncheckable, never forced', () => {
  const row = buildCustomerRollForward({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-10', opening: 1000,
    charges: [{ sourceId: 'bill-2026-10', label: 'Bill Oct', amount: 1200 }],
    payments: [], concessions: [],
  });
  assert.equal(row.computedClosing, 2200);
  assert.equal(row.reportedClosing, null);
  assert.equal(row.reconciles, null);
  assert.equal(row.status, 'uncheckable');
});

test('unusable figures are counted, never zero-filled', () => {
  const row = buildCustomerRollForward({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-10', opening: 1000,
    charges: [{ sourceId: 'bill-2026-10', label: 'Bill Oct', amount: null }],
    payments: [], concessions: [], reportedClosing: 2200,
  });
  assert.equal(row.computedClosing, null);
  assert.equal(row.chargesTotal, null);
  assert.equal(row.reconciles, null);
  assert.equal(row.unusableLines.length, 1);
  assert.equal(row.unusableLines[0].sourceId, 'bill-2026-10');
  assert.match(rollForwardSummaryText(row), /1 unusable line/);
});

test('lines without a traceable source are dropped, not guessed', () => {
  const row = buildCustomerRollForward({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-10', opening: 100,
    charges: [
      { sourceId: '', label: 'No source', amount: 999 },
      { sourceId: 'bill-2026-10', label: '', amount: 999 },
      { sourceId: 'bill-2026-10', label: 'Bill Oct', amount: 200 },
    ],
    payments: [], concessions: [], reportedClosing: 300,
  });
  assert.equal(row.charges.length, 1);
  assert.equal(row.chargesTotal, 200);
  assert.equal(row.reconciles, true);
  assert.equal(normalizeRollLine({ sourceId: 'x', label: 'y', amount: 5 }, 'bogus'), null);
});

test('invalid month or missing customer returns null', () => {
  assert.equal(buildCustomerRollForward({ customerId: 'c1', month: '2026-13', opening: 0 }), null);
  assert.equal(buildCustomerRollForward({ month: '2026-10', opening: 0 }), null);
  assert.equal(buildCustomerRollForward({ customerId: '', month: '2026-10', opening: 0 }), null);
  assert.equal(buildCustomerRollForward(null), null);
});

test('whole-business totals reconcile exactly', () => {
  const totals = buildRollForwardTotals([rowA(), rowB()]);
  assert.equal(totals.customerCount, 2);
  assert.equal(totals.opening, 1200);
  assert.equal(totals.chargesTotal, 1500);
  assert.equal(totals.paymentsTotal, 600);
  assert.equal(totals.concessionsTotal, 100);
  assert.equal(totals.computedClosing, 2000);
  assert.equal(totals.reportedClosing, 2000);
  assert.equal(totals.reconciles, true);
  assert.equal(totals.reconcilingCount, 2);
  assert.equal(totals.differingCount, 0);
});

test('one differing row makes the total differ, with the summed difference', () => {
  const differing = buildCustomerRollForward({
    customerId: 'c2', customerName: 'Bilal', month: '2026-10', opening: 200,
    charges: [{ sourceId: 'bill-2026-10-b', label: 'Bill Oct', amount: 300 }],
    payments: [{ sourceId: 'receipt-2', label: 'Cash receipt', amount: 100 }],
    concessions: [], reportedClosing: 350,
  });
  const totals = buildRollForwardTotals([rowA(), differing]);
  assert.equal(totals.reconciles, false);
  assert.equal(totals.difference, 50);
  assert.equal(totals.differingCount, 1);
});

test('totals never zero-fill a missing component', () => {
  const unusable = buildCustomerRollForward({
    customerId: 'c9', customerName: 'Noor', month: '2026-10', opening: 100,
    charges: [{ sourceId: 'bill-x', label: 'Bill Oct', amount: null }],
    payments: [], concessions: [],
  });
  const totals = buildRollForwardTotals([rowA(), unusable]);
  assert.equal(totals.chargesTotal, null);
  assert.equal(totals.computedClosing, null);
  assert.equal(totals.reconciles, null);
  assert.equal(totals.uncheckableCount, 1);
});

test('inputs are never mutated, and no ledger field is held', () => {
  const input = {
    customerId: 'c1', customerName: 'Ahmed', month: '2026-10', opening: 1000,
    charges: [{ sourceId: 'bill-2026-10', label: 'Bill Oct', amount: 1200 }],
    payments: [{ sourceId: 'receipt-1', label: 'Cash receipt', amount: 500 }],
    concessions: [],
    reportedClosing: 1700,
  };
  const before = JSON.stringify(input);
  const row = buildCustomerRollForward(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(row.reconciles, true);
  const forbidden = ['dueAmount', 'receipt', 'waada', 'payment', 'bill', 'concessionAmount', 'balanceDue'];
  const keys = [...Object.keys(row), ...row.charges.flatMap((line) => Object.keys(line))];
  for (const field of forbidden) assert.ok(!keys.includes(field), `row must not hold ${field}`);
});

test('HTML escaping, CSV quoting, and filename', () => {
  const row = buildCustomerRollForward({
    customerId: 'c1', customerName: 'Ahmed <script>alert(1)</script>', mohalla: 'Bani, North', month: '2026-10',
    opening: 100, charges: [{ sourceId: 'bill-1', label: 'Bill Oct', amount: 200 }],
    payments: [], concessions: [], reportedClosing: 300,
  });
  const html = rollForwardHtml(row);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  const csv = rollForwardCsv([row], buildRollForwardTotals([row]));
  assert.ok(csv.includes('"Bani, North"'));
  assert.ok(csv.startsWith('Customer,Mohalla,Month,Opening,Charges,Payments,Concessions,Computed closing,Reported closing,Reconciles,Difference'));
  assert.ok(csv.includes('TOTAL'));
  assert.equal(rollForwardFilename('2026-10'), 'balance-roll-forward-2026-10.csv');
  assert.equal(rollForwardFilename('2026-13'), 'balance-roll-forward.csv');
  const table = rollForwardTableHtml([row]);
  assert.ok(table.includes('Ahmed'));
  assert.equal(rollForwardTableHtml([]), '<p style="font-size: 12px;">No roll-forward rows for this month.</p>');
});
