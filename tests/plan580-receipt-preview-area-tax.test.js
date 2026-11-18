// Plan 580 — Receipt preview shows area, tax and balance, and proves
// them: the preview carries the area and the sales tax the receipt
// prints, in the receipt's order, and the match proves both. The bill
// month and the remaining balance were already in the preview
// (Sharafat 50), so this item adds only area + tax — it does not
// re-add them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeReceiptPreview,
  receiptPreviewFor,
  receiptPreviewLineText,
  receiptPreviewHtml,
  receiptPreviewMatchesReceipt,
  formatReceiptPreviewAmount,
} from '../receipt-preview.js';
import { amountInWords } from '../amount-in-words.js';
import { nextReceiptNumberFor } from '../next-receipt-number.js';
import { buildPaymentReceipt } from '../receipt.js';

const moduleSrc = readFileSync(new URL('../receipt-preview.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

// The taxed twin of the 433 fixture: Customer One (#41) in Charyaa,
// Side 1, pays PKR 3,000 in cash for November 2026 — settling the
// November bill in full, so the remaining balance is PKR 0. The bill
// carries PKR 195 sales tax; the tax is the bill's own figure, carried
// as-is — the preview proves it matches, it never recomputes the rate.
const taxedCustomer = () => ({
  id: 'c1',
  customerNumber: 41,
  name: 'Customer One',
  mohalla: 'Charyaa',
  zone: 'Side 1',
  packageSpeed: '5 Mbps',
  monthlyPriceSchedule: [],
  bills: [{ id: 'bill-2026-11', month: '2026-11', dueAmount: 3000, status: 'pending', payments: [], amountHistory: [], salesTaxCents: 19500 }],
  incidents: [],
});

const taxedPayment = () => ({
  id: 'PAY-1',
  amount: 3000,
  method: 'Cash',
  date: '2026-11-07',
  receiptNumber: 'RCPT-41-202611-01',
});

const taxedInput = () => ({
  customerName: 'Customer One',
  customerNumber: 41,
  area: 'Charyaa, Side 1',
  amount: 3000,
  amountWords: 'Three thousand',
  salesTaxCents: 19500,
  method: 'Cash',
  receiptNumber: 'RCPT-41-202611-01',
  date: '2026-11-07',
  billMonth: '2026-11',
  remainingBalanceCents: 0,
});

const taxedReceipt = () => {
  const customer = taxedCustomer();
  customer.bills[0].payments = [taxedPayment()];
  return buildPaymentReceipt(customer, customer.bills[0], taxedPayment());
};

// G1 — the rows, in the receipt's order.

test('rows: a taxed preview reads Area after Customer and tax after Amount', () => {
  assert.equal(
    receiptPreviewLineText(normalizeReceiptPreview(taxedInput())),
    'Receipt: RCPT-41-202611-01\nDate: 2026-11-07\nBill month: 2026-11\nCustomer: Customer One (#41)\nArea: Charyaa, Side 1\nAmount: PKR 3,000\n🧾 Sales tax / سیلز ٹیکس (19.5%): PKR 195\nAmount in words: Three thousand\nRemaining balance: PKR 0\nMethod: Cash',
  );
});

test('rows: an untaxed or waived bill shows the Area row and no tax row, never PKR 0', () => {
  const untaxed = normalizeReceiptPreview({ ...taxedInput(), salesTaxCents: null });
  const untaxedText = receiptPreviewLineText(untaxed);
  assert.match(untaxedText, /Area: Charyaa, Side 1/);
  assert.ok(!untaxedText.includes('Sales tax'), 'no tax row on an untaxed bill');
  // A waived first month is the same shape: the caller passes null,
  // so the preview shows no tax row either — never a PKR 0 row.
  const waived = normalizeReceiptPreview({ ...taxedInput(), salesTaxCents: null });
  assert.ok(!receiptPreviewLineText(waived).includes('Sales tax'), 'no tax row on a waived bill');
});

test('rows: a customer with no area recorded previews "Not recorded"', () => {
  const noArea = normalizeReceiptPreview({ ...taxedInput(), area: undefined });
  assert.equal(noArea.area, 'Not recorded');
  assert.match(receiptPreviewLineText(noArea), /Area: Not recorded/);
  const blankArea = normalizeReceiptPreview({ ...taxedInput(), area: ' , ' });
  assert.equal(blankArea.area, 'Not recorded');
});

test('html: a taxed preview shows Area and tax in order, with the receipt label and no + prefix', () => {
  const html = receiptPreviewHtml(normalizeReceiptPreview(taxedInput()));
  assert.match(html, /<dt>Area:<\/dt><dd>Charyaa, Side 1<\/dd>/);
  assert.match(html, /<dt>🧾 Sales tax \/ سیلز ٹیکس \(19\.5%\):<\/dt><dd>PKR 195<\/dd>/);
  assert.ok(!html.includes('+PKR') && !html.includes('+ PKR'), 'no + prefix on the tax figure');
  const areaAt = html.indexOf('Area:');
  const taxAt = html.indexOf('🧾 Sales tax');
  const wordsAt = html.indexOf('Amount in words:');
  assert.ok(areaAt > 0 && areaAt < taxAt && taxAt < wordsAt, 'Area, then tax, then words');
});

test('html: an untaxed preview shows the Area row and no tax row', () => {
  const html = receiptPreviewHtml(normalizeReceiptPreview({ ...taxedInput(), salesTaxCents: null }));
  assert.match(html, /<dt>Area:<\/dt><dd>Charyaa, Side 1<\/dd>/);
  assert.ok(!html.includes('Sales tax'), 'no tax row on an untaxed bill');
});

test('html: the area value is escaped like every other user field', () => {
  const tricky = receiptPreviewHtml(normalizeReceiptPreview({ ...taxedInput(), area: 'Charyaa <b>& "Side"' }));
  assert.ok(!tricky.includes('<b>'), 'no raw markup in the area');
  assert.match(tricky, /Charyaa &lt;b&gt;&amp; &quot;Side&quot;/);
});

// G2 — the match proves area and tax, in cents.

test('match: a taxed preview matches the taxed receipt it previews', () => {
  const receiptNumber = nextReceiptNumberFor(taxedCustomer(), '2026-11');
  assert.equal(receiptNumber, 'RCPT-41-202611-01');
  const preview = receiptPreviewFor({
    customer: taxedCustomer(),
    amount: 3000,
    amountWords: amountInWords(3000),
    method: 'Cash',
    receiptNumber,
    date: '2026-11-07',
    billMonth: '2026-11',
    remainingBalanceCents: 0,
    area: 'Charyaa, Side 1',
    salesTaxCents: 19500,
    split: false,
  });
  const receipt = taxedReceipt();
  assert.equal(receipt.area, 'Charyaa, Side 1');
  assert.equal(receipt.salesTaxCents, 19500);
  assert.equal(receiptPreviewMatchesReceipt(preview, receipt), true);
});

test('match: a wrong area breaks the match', () => {
  const receipt = taxedReceipt();
  const preview = normalizeReceiptPreview(taxedInput());
  assert.equal(receiptPreviewMatchesReceipt(preview, receipt), true);
  assert.equal(receiptPreviewMatchesReceipt({ ...preview, area: 'Gangall' }, receipt), false);
  assert.equal(receiptPreviewMatchesReceipt({ ...preview, area: 'Not recorded' }, receipt), false);
  assert.equal(receiptPreviewMatchesReceipt(preview, { ...receipt, area: 'Gangall' }), false);
});

test('match: a wrong tax breaks the match', () => {
  const receipt = taxedReceipt();
  const preview = normalizeReceiptPreview(taxedInput());
  assert.equal(receiptPreviewMatchesReceipt(preview, receipt), true);
  assert.equal(receiptPreviewMatchesReceipt({ ...preview, salesTaxCents: 58500 }, receipt), false);
  assert.equal(receiptPreviewMatchesReceipt(preview, { ...receipt, salesTaxCents: 58500 }), false);
});

test('match: null tax on one side only breaks the match — null == null passes', () => {
  const receipt = taxedReceipt();
  const preview = normalizeReceiptPreview(taxedInput());
  // The taxed preview against an untaxed receipt: no.
  assert.equal(receiptPreviewMatchesReceipt(preview, { ...receipt, salesTaxCents: null }), false);
  // An untaxed preview against the taxed receipt: no.
  assert.equal(receiptPreviewMatchesReceipt({ ...preview, salesTaxCents: null }, receipt), false);
  // Null on both sides passes — the untaxed fixture the 433
  // acceptance already proves end to end.
  const untaxedPreview = normalizeReceiptPreview({ ...taxedInput(), area: 'Not recorded', salesTaxCents: null });
  const untaxedReceipt = { ...receipt, area: 'Not recorded', salesTaxCents: null };
  assert.equal(receiptPreviewMatchesReceipt(untaxedPreview, untaxedReceipt), true);
});

test('match: "Not recorded" on both sides passes', () => {
  const receipt = taxedReceipt();
  const preview = normalizeReceiptPreview({ ...taxedInput(), area: 'Not recorded' });
  assert.equal(receiptPreviewMatchesReceipt(preview, { ...receipt, area: 'Not recorded' }), true);
  assert.equal(receiptPreviewMatchesReceipt(preview, receipt), false);
});

test('match: whitespace in the area never false-negatives the match', () => {
  const receipt = taxedReceipt();
  const preview = normalizeReceiptPreview({ ...taxedInput(), area: 'Charyaa ,  Side 1 ' });
  assert.equal(preview.area, 'Charyaa, Side 1');
  assert.equal(receiptPreviewMatchesReceipt(preview, receipt), true);
  const padded = normalizeReceiptPreview({ ...taxedInput(), area: '  Charyaa, Side 1  ' });
  assert.equal(receiptPreviewMatchesReceipt(padded, receipt), true);
});

test('normalize: the tax is integer cents or null — never 0, never a float, never a string', () => {
  for (const salesTaxCents of [0, -19500, 195.5, '19500', NaN, Infinity]) {
    assert.equal(normalizeReceiptPreview({ ...taxedInput(), salesTaxCents }).salesTaxCents, null, `tax ${String(salesTaxCents)}`);
  }
  assert.equal(normalizeReceiptPreview({ ...taxedInput(), salesTaxCents: 19500 }).salesTaxCents, 19500);
  assert.equal(formatReceiptPreviewAmount(19500), 'PKR 195');
});

// G3 — the caller derives area and tax above the call, from the receipt's own sources.

test('wiring: the preview builder derives the area from mohalla plus zone, never the short form', () => {
  const start = wiringSrc.indexOf('function buildReceiptPreview()');
  assert.ok(start > 0, 'receipt preview builder exists');
  const slice = wiringSrc.slice(start, start + 1200);
  assert.ok(
    slice.includes("const area = [customer?.mohalla, customer?.zone].filter(Boolean).join(', ') || 'Not recorded';"),
    'area is the receipt derivation, derived above the call',
  );
  assert.ok(!slice.includes('activeDefaults.area'), 'never the mohalla-only short form');
});

test('wiring: the preview builder reads the tax for the selected month through the receipt helper', () => {
  const start = wiringSrc.indexOf('function buildReceiptPreview()');
  const slice = wiringSrc.slice(start, start + 1200);
  assert.ok(
    slice.includes('const taxCents = salesTaxReceiptLine(customer?.bills?.find(b => b.month === month))?.taxCents ?? null;'),
    'tax is the selected month bill through salesTaxReceiptLine',
  );
  assert.ok(!slice.includes('salesTaxCentsOfBill'), 'never the raw per-bill figure (it taxes waived months)');
  assert.ok(!slice.includes('activeDefaults.targetBillSalesTaxCents'), 'never the earliest-unpaid bill tax');
  // The two new arguments ride after `split:` in the call object —
  // past the 1,200-char slice — so they are read on a wider window.
  const call = wiringSrc.slice(start, start + 1600);
  assert.ok(call.includes('area,'), 'area is passed to the preview');
  assert.ok(call.includes('salesTaxCents: taxCents,'), 'tax is passed to the preview');
});

test('wiring: the tax helper joins the existing import line — no new import edge', () => {
  assert.match(
    wiringSrc,
    /import \{ salesTaxCentsForPrice, salesTaxCentsOfBill, salesTaxReceiptLine, SALES_TAX_RECEIPT_LABEL \} from '\.\/package-sales-tax\.js';/,
  );
  assert.equal((wiringSrc.match(/from '\.\/package-sales-tax\.js'/g) || []).length, 1, 'one import line, no new edge');
});

// G4 — guards: defaults, and the preview module stays import-free.

test('normalize: the area default is "Not recorded" for every missing shape', () => {
  for (const area of [undefined, null, '', '   ', ' , ', ',,,']) {
    assert.equal(normalizeReceiptPreview({ ...taxedInput(), area }).area, 'Not recorded', `area ${JSON.stringify(area)}`);
  }
  assert.equal(normalizeReceiptPreview({ ...taxedInput(), area: 'Charyaa' }).area, 'Charyaa');
  assert.equal(normalizeReceiptPreview({ ...taxedInput(), area: 'Charyaa, ' }).area, 'Charyaa');
});

test('normalize: the tax stays null when the caller passes none', () => {
  const preview = normalizeReceiptPreview({ ...taxedInput(), salesTaxCents: undefined });
  assert.equal(preview.salesTaxCents, null);
  assert.ok(!receiptPreviewLineText(preview).includes('Sales tax'));
});

test('purity: the preview module still imports nothing', () => {
  assert.ok(!moduleSrc.includes('import '), 'no imports — the tax label is a hardcoded literal');
  assert.ok(!moduleSrc.includes('package-sales-tax'), 'no tax-module import');
  assert.ok(!moduleSrc.includes('receipt.js'), 'no receipt-module import');
});
