import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validExportDate,
  buildExportPack,
  exportPackSummaryText,
  exportPackHtml,
  exportPackCsv,
  exportPackJson,
  exportPackFilename,
} from '../export-pack.js';

const customers = () => ([
  {
    id: 'c1',
    name: 'Ahmed',
    phone: '0300-1111111',
    mohalla: 'Bani',
    packageSpeed: '20 Mbps',
    monthlySellingAmount: 1500,
    bills: [
      {
        month: '2026-10',
        dueAmount: 1500,
        dueDate: '2026-10-05',
        payments: [
          { amount: 1500, date: '2026-10-03', method: 'Cash', transactionId: 'T1' },
          { amount: 200, date: '2026-10-04', method: 'Cash', voided: true },
        ],
      },
      {
        month: '2026-11',
        dueAmount: 1500,
        dueDate: '2026-11-05',
        payments: [{ amount: 'not-a-number', date: '2026-11-02', method: 'Cash' }],
      },
    ],
    promiseDate: '2026-11-10',
    promiseAmount: 1500,
    promiseNote: 'Pay on 10th',
  },
  {
    id: 'c2',
    customerName: 'Bilal',
    area: 'Kishti',
    monthlySellingAmount: '2000',
    archived: true,
    bills: [{ month: '2026-10', dueAmount: 'bad', payments: [] }],
  },
  { name: 'No id at all', bills: [] },
]);

const expenses = () => ([
  { id: 'e1', date: '2026-10-12', amount: 5000, category: 'Cable', notes: 'Drop cable' },
  { id: 'e2', date: '2026-10-13', amount: '250', category: 'Fuel', note: 'Bike' },
  { id: 'e3', date: '2026-02-30', amount: 999, category: 'Bad date row' },
]);

test('date validation: real dates kept, 2026-02-30 and bad formats rejected', () => {
  assert.equal(validExportDate('2026-10-05'), '2026-10-05');
  assert.equal(validExportDate('2024-02-29'), '2024-02-29');
  assert.equal(validExportDate('2026-02-30'), null);
  assert.equal(validExportDate('05-10-2026'), null);
  assert.equal(validExportDate(''), null);
  assert.equal(validExportDate(null), null);
});

test('customer rows: name fallback, archived flag, bill/payment counts, no-id excluded', () => {
  const pack = buildExportPack({ customers: customers(), expenses: [], exportDate: '2026-11-04' });
  assert.equal(pack.counts.customers, 2);
  assert.equal(pack.excluded.customers, 1);
  const bilal = pack.customers.find((r) => r.customerId === 'c2');
  assert.equal(bilal.customerName, 'Bilal');
  assert.equal(bilal.mohalla, 'Kishti');
  assert.equal(bilal.monthlyAmount, 2000);
  assert.equal(bilal.archived, true);
  const ahmed = pack.customers.find((r) => r.customerId === 'c1');
  assert.equal(ahmed.billCount, 2);
  assert.equal(ahmed.paymentCount, 3);
  assert.ok(pack.customers.every((r) => typeof r.customerId === 'string' && r.customerId !== ''));
});

test('bill totals match the ledger: finite dueAmount only, bad amount excluded from total', () => {
  const pack = buildExportPack({ customers: customers(), expenses: [], exportDate: '2026-11-04' });
  assert.equal(pack.counts.bills, 3);
  assert.equal(pack.totals.billTotal, 3000);
  assert.equal(pack.excluded.bills, 1);
  assert.ok(pack.bills.every((r) => r.customerId !== ''));
  assert.deepEqual(pack.bills.map((r) => `${r.customerId}/${r.month}`), ['c1/2026-10', 'c1/2026-11', 'c2/2026-10']);
  assert.deepEqual(pack.billMonthRange, { first: '2026-10', last: '2026-11' });
});

test('payment totals: voided kept separate, never blended into collected', () => {
  const pack = buildExportPack({ customers: customers(), expenses: [], exportDate: '2026-11-04' });
  assert.equal(pack.counts.payments, 3);
  assert.equal(pack.totals.paymentTotal, 1500);
  assert.equal(pack.totals.voidedPaymentTotal, 200);
  assert.equal(pack.excluded.payments, 1);
  const voided = pack.payments.find((r) => r.voided);
  assert.equal(voided.amount, 200);
  assert.equal(voided.billMonth, '2026-10');
  assert.equal(pack.payments.find((r) => r.transactionId === 'T1').amount, 1500);
  assert.ok(pack.payments.every((r) => r.customerId !== ''));
});

test('waada rows: only customers with waada data, invalid dates blanked, totals summed', () => {
  const pack = buildExportPack({ customers: customers(), expenses: [], exportDate: '2026-11-04' });
  assert.equal(pack.counts.waadas, 1);
  assert.equal(pack.totals.waadaTotal, 1500);
  assert.equal(pack.waadas[0].promiseDate, '2026-11-10');
  assert.equal(pack.waadas[0].promiseNote, 'Pay on 10th');
  const bad = buildExportPack({
    customers: [{ id: 'x', promiseDate: '2026-02-30', promiseAmount: 100 }],
    expenses: [],
    exportDate: '2026-11-04',
  });
  assert.equal(bad.waadas[0].promiseDate, '');
  assert.equal(bad.totals.waadaTotal, 100);
});

test('expense rows always carry a customerId field; totals sum finite amounts only', () => {
  const pack = buildExportPack({ customers: [], expenses: expenses(), exportDate: '2026-11-04' });
  assert.equal(pack.counts.expenses, 3);
  assert.equal(pack.totals.expenseTotal, 6249);
  assert.ok(pack.expenses.every((r) => 'customerId' in r));
  assert.equal(pack.expenses.find((r) => r.expenseId === 'e3').date, '');
  assert.equal(pack.expenses.find((r) => r.expenseId === 'e2').notes, 'Bike');
});

test('manifest: one export date, date range from dated rows, counts stated', () => {
  const pack = buildExportPack({ customers: customers(), expenses: expenses(), exportDate: '2026-11-04' });
  assert.equal(pack.exportDate, '2026-11-04');
  assert.deepEqual(pack.dateRange, { start: '2026-10-03', end: '2026-11-10' });
  assert.deepEqual(pack.counts, { customers: 2, bills: 3, payments: 3, waadas: 1, expenses: 3 });
  const empty = buildExportPack({ customers: [], expenses: [], exportDate: '2026-02-30' });
  assert.equal(empty.exportDate, null);
  assert.equal(empty.dateRange, null);
  assert.equal(empty.billMonthRange, null);
});

test('inputs are not mutated', () => {
  const input = customers();
  const snapshot = JSON.stringify(input);
  buildExportPack({ customers: input, expenses: expenses(), exportDate: '2026-11-04' });
  assert.equal(JSON.stringify(input), snapshot);
});

test('summary text and HTML state counts, totals, range, and the no-import scope', () => {
  const pack = buildExportPack({ customers: customers(), expenses: expenses(), exportDate: '2026-11-04' });
  const text = exportPackSummaryText(pack);
  assert.match(text, /2026-11-04/);
  assert.match(text, /2 customers/);
  assert.match(text, /3 bills/);
  assert.match(text, /Re-importing is out of scope/);
  const html = exportPackHtml(pack);
  assert.match(html, /Customers/);
  assert.match(html, /PKR 3,000/);
  assert.doesNotMatch(html, /<script/);
});

test('CSV: headers, customer reference on every row, quoting, manifest keys', () => {
  const pack = buildExportPack({ customers: customers(), expenses: expenses(), exportDate: '2026-11-04' });
  const paymentsCsv = exportPackCsv(pack, 'payments');
  assert.ok(paymentsCsv.startsWith('customerId,customerName,billMonth,date,amount,method,transactionId,voided'));
  assert.equal(paymentsCsv.split('\n').length, 4);
  const quoted = buildExportPack({
    customers: [{ id: 'q', name: 'A "quoted", name', bills: [{ month: '2026-10', dueAmount: 100, payments: [] }] }],
    expenses: [],
    exportDate: '2026-11-04',
  });
  assert.match(exportPackCsv(quoted, 'customers'), /"A ""quoted"", name"/);
  const manifest = exportPackCsv(pack, 'manifest');
  assert.match(manifest, /exportDate,2026-11-04/);
  assert.match(manifest, /billTotal,3000/);
  assert.equal(exportPackCsv(pack, 'unknown-section'), '');
});

test('JSON round-trips the whole pack, filenames carry section and export date', () => {
  const pack = buildExportPack({ customers: customers(), expenses: expenses(), exportDate: '2026-11-04' });
  const parsed = JSON.parse(exportPackJson(pack));
  assert.equal(parsed.totals.billTotal, 3000);
  assert.equal(parsed.counts.payments, 3);
  assert.equal(exportPackFilename('payments', '2026-11-04'), 'export-pack-payments-2026-11-04.csv');
  assert.equal(exportPackFilename('json', '2026-11-04'), 'export-pack-2026-11-04.json');
  assert.equal(exportPackFilename('manifest', '2026-02-30'), 'export-pack-manifest-undated.csv');
});
