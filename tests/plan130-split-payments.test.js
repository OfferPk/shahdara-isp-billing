import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validSplitReceiptDate,
  splitPartAmountCents,
  splitMethodGroup,
  splitMethodGroupLabel,
  normalizeSplitPart,
  normalizeSplitReceipt,
  normalizeSplitReceiptList,
  upsertSplitReceipt,
  findSplitReceipt,
  splitReceiptsForCustomer,
  methodTotalsForReceipt,
  methodTotalsAcrossReceipts,
  formatSplitCents,
  splitReceiptSummaryText,
  splitReceiptHtml,
  splitReceiptListHtml,
  splitReceiptCsv,
  splitReceiptFilename,
} from '../split-payments.js';

const receipt = (over = {}) => ({
  id: 'SP-1',
  receiptNumber: 'REC-2601-0001',
  customer: 'CUST-1',
  customerName: 'Ahmed',
  date: '2026-10-05',
  parts: [
    { method: 'Cash', amount: 1000 },
    { method: 'Bank Transfer', amount: 500 },
  ],
  note: 'Half cash, half transfer',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(validSplitReceiptDate('2026-10-05'), '2026-10-05');
  assert.equal(validSplitReceiptDate('2026-08-31'), '2026-08-31');
  assert.equal(validSplitReceiptDate('2026-10-31'), '2026-10-31');
  assert.equal(validSplitReceiptDate('2026-12-31'), '2026-12-31');
  assert.equal(validSplitReceiptDate('2024-02-29'), '2024-02-29');
  assert.equal(validSplitReceiptDate('2026-02-30'), null);
  assert.equal(validSplitReceiptDate('2026-09-31'), null);
  assert.equal(validSplitReceiptDate('2026-11-31'), null);
  assert.equal(validSplitReceiptDate('2026-13-01'), null);
  assert.equal(validSplitReceiptDate('05-10-2026'), null);
  assert.equal(validSplitReceiptDate(''), null);
  assert.equal(validSplitReceiptDate(null), null);
});

test('rupees convert once, *Cents pass through as-is, unusable refused', () => {
  assert.equal(splitPartAmountCents({ method: 'Cash', amount: 1500 }), 150000);
  assert.equal(splitPartAmountCents({ method: 'Cash', amount: 1500.55 }), 150055);
  assert.equal(splitPartAmountCents({ method: 'Cash', amountCents: 150000 }), 150000);
  assert.equal(splitPartAmountCents({ method: 'Cash', amountCents: 150000, amount: 9999 }), 150000);
  assert.equal(splitPartAmountCents({ method: 'Cash', amount: 0 }), null);
  assert.equal(splitPartAmountCents({ method: 'Cash', amount: -50 }), null);
  assert.equal(splitPartAmountCents({ method: 'Cash', amount: 'abc' }), null);
  assert.equal(splitPartAmountCents({ method: 'Cash' }), null);
  assert.equal(splitPartAmountCents(null), null);
});

test('half-formed records refused, unknown fields dropped', () => {
  assert.equal(normalizeSplitReceipt(receipt({ id: '' })), null);
  assert.equal(normalizeSplitReceipt(receipt({ receiptNumber: '' })), null);
  assert.equal(normalizeSplitReceipt(receipt({ customer: '' })), null);
  assert.equal(normalizeSplitReceipt(receipt({ date: '2026-02-30' })), null);
  assert.equal(normalizeSplitReceipt(receipt({ parts: [{ method: 'Cash', amount: 1000 }] })), null);
  assert.equal(normalizeSplitReceipt(receipt({ parts: [] })), null);
  assert.equal(normalizeSplitReceipt(receipt({ parts: [{ method: '', amount: 1000 }, { method: 'Cash', amount: 500 }] })), null);
  assert.equal(normalizeSplitReceipt(receipt({ parts: [{ method: 'Cash', amount: 0 }, { method: 'Bank Transfer', amount: 500 }] })), null);
  const clean = normalizeSplitReceipt(receipt({ billId: 'B-9', paymentId: 'P-9', allocation: 'x' }));
  assert.ok(clean);
  assert.deepEqual(Object.keys(clean).sort(), ['customer', 'customerName', 'date', 'id', 'note', 'parts', 'receiptNumber', 'totalCents']);
  const cleanPart = normalizeSplitPart({ method: 'Cash', amount: 100, billId: 'B-1' });
  assert.deepEqual(Object.keys(cleanPart).sort(), ['amountCents', 'group', 'method']);
});

test('parts sum exactly to the receipt total, in integer cents', () => {
  const rec = normalizeSplitReceipt(receipt({
    parts: [
      { method: 'Cash', amount: 666.67 },
      { method: 'Easypaisa', amount: 333.34 },
    ],
  }));
  assert.ok(rec);
  assert.equal(rec.totalCents, 100001);
  assert.equal(rec.parts[0].amountCents + rec.parts[1].amountCents, rec.totalCents);
  const paisa = normalizeSplitReceipt(receipt({
    parts: [
      { method: 'JazzCash', amountCents: 33334 },
      { method: 'Cash', amountCents: 33333 },
      { method: 'Raast', amountCents: 33334 },
    ],
  }));
  assert.equal(paisa.totalCents, 100001);
});

test('a caller-supplied total that disagrees with its parts is refused, never corrected', () => {
  assert.equal(normalizeSplitReceipt(receipt({ totalCents: 149999 })), null);
  assert.equal(normalizeSplitReceipt(receipt({ total: 1499.99 })), null);
  assert.ok(normalizeSplitReceipt(receipt({ totalCents: 150000 })));
  assert.ok(normalizeSplitReceipt(receipt({ total: 1500 })));
});

test('the same method twice is not a split across methods', () => {
  assert.equal(normalizeSplitReceipt(receipt({
    parts: [
      { method: 'Cash', amount: 1000 },
      { method: 'cash', amount: 500 },
    ],
  })), null);
  // Two different methods in one group are a real split.
  assert.ok(normalizeSplitReceipt(receipt({
    parts: [
      { method: 'JazzCash', amount: 1000 },
      { method: 'Easypaisa', amount: 500 },
    ],
  })));
});

test('duplicate id or duplicate receipt number never rewritten — first record wins', () => {
  const first = receipt();
  const second = receipt({
    id: 'SP-2',
    parts: [
      { method: 'Cash', amount: 2000 },
      { method: 'Bank Transfer', amount: 2000 },
    ],
  });
  const third = receipt({ id: 'SP-1', receiptNumber: 'REC-2601-0002' });
  const list = normalizeSplitReceiptList([first, second, third]);
  assert.equal(list.length, 1);
  assert.equal(list[0].totalCents, 150000);
  const appended = upsertSplitReceipt(list, second);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].totalCents, 150000);
  const other = upsertSplitReceipt(list, receipt({ id: 'SP-9', receiptNumber: 'REC-2601-0009' }));
  assert.equal(other.length, 2);
});

test('method grouping mirrors the per-method reconciliation groups', () => {
  assert.equal(splitMethodGroup('Cash'), 'cash');
  assert.equal(splitMethodGroup('Cash at shop'), 'cash');
  assert.equal(splitMethodGroup('Bank Transfer'), 'bank_transfer');
  assert.equal(splitMethodGroup('Raast'), 'bank_transfer');
  assert.equal(splitMethodGroup('JazzCash'), 'mobile_wallet');
  assert.equal(splitMethodGroup('Easypaisa'), 'mobile_wallet');
  assert.equal(splitMethodGroup('NayaPay'), 'mobile_wallet');
  assert.equal(splitMethodGroup('Cheque'), 'cheque');
  assert.equal(splitMethodGroup(''), null);
  assert.equal(splitMethodGroupLabel('cash'), 'Cash');
  assert.equal(splitMethodGroupLabel('bank_transfer'), 'Bank transfer');
  assert.equal(splitMethodGroupLabel('mobile_wallet'), 'Mobile wallet');
  assert.equal(splitMethodGroupLabel('cheque'), 'cheque');
});

test('method totals for one receipt: parts in one group sum into one row', () => {
  const rec = normalizeSplitReceipt(receipt({
    parts: [
      { method: 'JazzCash', amount: 1000 },
      { method: 'Easypaisa', amount: 500 },
      { method: 'Cash', amount: 250 },
    ],
  }));
  const totals = methodTotalsForReceipt(rec);
  assert.equal(totals.length, 2);
  const wallet = totals.find((row) => row.group === 'mobile_wallet');
  assert.equal(wallet.amountCents, 150000);
  assert.deepEqual(wallet.methods, ['JazzCash', 'Easypaisa']);
  const cash = totals.find((row) => row.group === 'cash');
  assert.equal(cash.amountCents, 25000);
  assert.equal(totals.reduce((sum, row) => sum + row.amountCents, 0), rec.totalCents);
  assert.deepEqual(methodTotalsForReceipt({}), []);
});

test('method totals across receipts: every part lands in its method row', () => {
  const list = [
    receipt(),
    receipt({
      id: 'SP-2',
      receiptNumber: 'REC-2601-0002',
      parts: [
        { method: 'Cash', amount: 700 },
        { method: 'Easypaisa', amount: 300 },
      ],
    }),
  ];
  const totals = methodTotalsAcrossReceipts(list);
  const cash = totals.find((row) => row.group === 'cash');
  assert.equal(cash.amountCents, 170000);
  const bank = totals.find((row) => row.group === 'bank_transfer');
  assert.equal(bank.amountCents, 50000);
  const wallet = totals.find((row) => row.group === 'mobile_wallet');
  assert.equal(wallet.amountCents, 30000);
});

test('find, per-customer listing newest first, and no second receipt number', () => {
  const list = [
    receipt(),
    receipt({ id: 'SP-2', receiptNumber: 'REC-2601-0002', date: '2026-10-06' }),
    receipt({ id: 'SP-3', receiptNumber: 'REC-2601-0003', customer: 'CUST-2', date: '2026-10-07' }),
  ];
  assert.equal(findSplitReceipt(list, 'REC-2601-0002').id, 'SP-2');
  assert.equal(findSplitReceipt(list, 'REC-2601-9999'), null);
  const mine = splitReceiptsForCustomer(list, 'CUST-1');
  assert.deepEqual(mine.map((item) => item.receiptNumber), ['REC-2601-0002', 'REC-2601-0001']);
  assert.deepEqual(splitReceiptsForCustomer(list, 'NOBODY'), []);
  // The receipt view carries exactly one receipt number and one total.
  const html = splitReceiptHtml(list[0]);
  assert.equal(html.split('REC-2601-0001').length - 1, 1);
  assert.ok(html.includes('Rs. 1500.00'));
});

test('recording a split changes no input (non-mutation)', () => {
  const input = receipt();
  const before = JSON.stringify(input);
  const partsBefore = JSON.stringify(input.parts);
  normalizeSplitReceipt(input);
  upsertSplitReceipt([], input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(JSON.stringify(input.parts), partsBefore);
});

test('format, summary, HTML escaping, CSV quoting', () => {
  assert.equal(formatSplitCents(150000), 'Rs. 1500.00');
  assert.equal(formatSplitCents(null), '—');
  const list = [receipt()];
  assert.ok(splitReceiptSummaryText(list, 'REC-2601-0001').includes('Cash Rs. 1000.00 + Bank Transfer Rs. 500.00 = Rs. 1500.00'));
  assert.equal(splitReceiptSummaryText(list, 'REC-2601-9999'), 'No split receipt recorded.');
  assert.equal(splitReceiptListHtml([], null), '<p>No split receipt recorded.</p>');
  const nasty = receipt({ customerName: '<b>&"q"</b>', note: 'a,"b"' });
  const html = splitReceiptHtml(nasty);
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;b&gt;'));
  const csv = splitReceiptCsv([nasty]);
  assert.ok(csv.startsWith('receipt_number,customer,customer_name,date,method,method_group,part_cents,receipt_total_cents,note\n'));
  // One CSV row per part, each carrying the single receipt number and total.
  assert.equal(csv.trim().split('\n').length, 3);
  assert.ok(csv.includes('REC-2601-0001'));
  assert.ok(csv.includes('150000'));
  assert.equal(splitReceiptFilename(), 'split-receipts.csv');
});

test('purity fence: module is import-free and names no other record module', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(dir, '..', 'split-payments.js'), 'utf8');
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /localStorage|document\.|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /partPayment|methodRecon|combinedDues|balanceConfirmation|part-payment-rules|method-reconciliation\.js/);
});

test('panel ids present in index.html', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['splitBody', 'splitReceiptNumber', 'splitCustomer', 'splitDate', 'splitParts', 'splitSaveBtn', 'splitFilter', 'splitExportBtn', 'splitSummary']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
