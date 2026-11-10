// Plan 555 — Receipt figures agree, and format identically.
//
// The HTML receipt prints two balances for the same payment — the
// arrears block's "Baqi Rehta" (buildArrearsBreakdown.balanceDue, gross
// of every bill-field waiver) and the "Balance" field
// (receipt.balanceDueCents, net of them) — so a receipt with a
// concession, referral credit, deposit offset, credit transfer, feeder
// credit or first-month tag contradicts itself on the amount still
// owed; the PNG slip's remaining-balance math subtracts only some of
// the waivers, so it can show a third figure. Money formatting drifts
// the same way: four formatters print the same rupees differently
// (292.5 as "292.5" on HTML/PNG/WhatsApp and "292.50" in the profile
// draft), and a null package price prints as an invented "PKR 0".
//
// The fix is display-only: the arrears "Baqi Rehta" row shows the net
// balance — the receipt's own Balance Due figure, with the gross still
// shown as "Kul Qabil-e-Ada" — and one shared min-0/max-2 en-PK money
// format (receipt-money.js, modelled on formatPKR in core.js) for the
// HTML, PNG, split, thermal and WhatsApp receipt surfaces, with
// null/empty rendering as "—", never PKR 0. The allocation engine and
// buildArrearsBreakdown's stored shape are untouched.
//
// Pattern-fake data only: Test Customer, RCPT-12-202611-01.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPKR, saveBillMonth } from '../core.js';
import { buildArrearsBreakdown } from '../billing-cycle.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { escPosFieldsFromPaymentReceipt } from '../thermal-printer.js';
import { formatReceiptMoney, formatReceiptMoneyFigure, netArrearsBalanceRupees } from '../receipt-money.js';
import {
  executeQuickCollection,
  formatQuickCollectWhatsAppReceipt,
  renderQuickCollectReceiptCardHtml,
} from '../nav-quick-collect.js';
import {
  executeSplitTenderCollection,
  buildSplitTenderReceipt,
  formatSplitTenderWhatsAppText,
  generateSplitTenderReceiptHtml,
} from '../split-tender-collect.js';

const MONTH = '2026-10';
const DATE = '2026-10-05';

// One bill + one payment, with any of the six bill-field waivers set.
const waiverFixture = ({ due = 1000, paid = 800, waiver = {} } = {}) => {
  const payment = { id: 'pay-1', amount: paid, date: DATE, method: 'Cash' };
  const bill = { id: 'bill-2026-10', month: MONTH, dueAmount: due, status: 'pending', payments: [payment], ...waiver };
  const customer = { id: 'c1', customerNumber: 34, name: 'Test Customer', packageHistory: [], bills: [bill] };
  const receipt = buildPaymentReceipt(customer, bill, payment);
  return { customer, bill, payment, receipt };
};

// The "Baqi Rehta" value on an HTML layout, or null when absent.
const baqiRehtaOf = (html) => {
  const m = html.match(/Baqi Rehta[^<]*(?:<\/strong>)?<\/dt><dd[^>]*>([^<]*)<\/dd>/);
  return m ? m[1] : null;
};
// The "Balance" value on an HTML layout, or null when absent.
const balanceOf = (html) => {
  const m = html.match(/Balance[^<]*(?:<\/strong>)?<\/dt><dd[^>]*>(?:<strong>)?([^<]*)/);
  return m ? m[1].trim() : null;
};
const pngRemainingOf = (model) => model.financial.find((row) => row.label.startsWith('Remaining Balance'))?.value ?? null;
const pngTaxOf = (model) => model.financial.find((row) => row.label.includes('Sales tax') || row.label.includes('سیلز ٹیکس'))?.value ?? null;

// ---------------------------------------------------------------- shared format

test('Plan 555: the shared receipt format is en-PK min-0/max-2, never PKR 0 for a missing figure', () => {
  assert.equal(formatReceiptMoney(null), '—');
  assert.equal(formatReceiptMoney(undefined), '—');
  assert.equal(formatReceiptMoney(''), '—');
  assert.equal(formatReceiptMoney('abc'), '—');
  assert.equal(formatReceiptMoney(NaN), '—');
  assert.equal(formatReceiptMoney(0), 'PKR 0');
  assert.equal(formatReceiptMoney(300), 'PKR 300');
  assert.equal(formatReceiptMoney(292.5), 'PKR 292.50');
  assert.equal(formatReceiptMoney(1500.5), 'PKR 1,500.50');
  assert.equal(formatReceiptMoney(1500), 'PKR 1,500');
  assert.equal(formatReceiptMoney(100000), 'PKR 100,000');
  assert.equal(formatReceiptMoneyFigure(null), '—');
  assert.equal(formatReceiptMoneyFigure(292.5), '292.50');
  assert.equal(formatReceiptMoneyFigure(1500), '1,500');
});

test('Plan 555: the net arrears balance prefers the receipt balance, falls back to the derived net, never invents one', () => {
  // The receipt's own Balance Due is the figure, whatever the gross says.
  assert.equal(netArrearsBalanceRupees({ balanceDueCents: 30000, arrearsBreakdown: { balanceDue: 500 } }), 300);
  assert.equal(netArrearsBalanceRupees({ balanceDueCents: 0, arrearsBreakdown: { balanceDue: 200 } }), 0);
  // Balance unknown: the breakdown's gross minus all six waivers.
  assert.equal(netArrearsBalanceRupees({ balanceDueCents: null, arrearsBreakdown: { balanceDue: 500 }, concessionAmount: 200 }), 300);
  assert.equal(netArrearsBalanceRupees({ balanceDueCents: null, arrearsBreakdown: { balanceDue: 200 }, firstMonthWaivedAmount: 200 }), 0);
  assert.equal(netArrearsBalanceRupees({
    balanceDueCents: null,
    arrearsBreakdown: { balanceDue: 1000 },
    concessionAmount: 100, referralCreditAmount: 100, depositOffsetAmount: 100,
    creditTransferInAmount: 100, feederHostCreditAmount: 100, firstMonthWaivedAmount: 100,
  }), 400);
  // Nothing known: no figure at all, never a guessed zero.
  assert.equal(netArrearsBalanceRupees({ balanceDueCents: null, arrearsBreakdown: null }), null);
  assert.equal(netArrearsBalanceRupees({}), null);
});

// ---------------------------------------------------------------- arrears agreement

test('Plan 555: a PKR 200 concession — the arrears block and the Balance Due field agree on every HTML layout', () => {
  const { receipt } = waiverFixture({ due: 1000, paid: 800, waiver: { concessionAmount: 200, concessionReason: 'Outage' } });
  assert.equal(receipt.balanceDueCents, 0);
  assert.equal(receipt.status, 'PAID');
  // The stored breakdown is untouched: it still carries the gross.
  assert.equal(receipt.arrearsBreakdown.balanceDue, 200);
  for (const format of ['thermal-58', 'thermal-80', 'a4']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.equal(baqiRehtaOf(html), 'PKR 0', `${format}: Baqi Rehta is the net balance`);
    assert.ok(balanceOf(html).startsWith('PKR 0'), `${format}: Balance is PKR 0`);
    assert.equal(baqiRehtaOf(html), balanceOf(html).replace(/ \(.*\)$/, ''), `${format}: the two figures agree`);
  }
});

test('Plan 555: a partial payment with a concession — Baqi Rehta is the net 300, not the gross 500', () => {
  const { receipt } = waiverFixture({ due: 1000, paid: 500, waiver: { concessionAmount: 200, concessionReason: 'Outage' } });
  assert.equal(receipt.balanceDueCents, 30000);
  assert.equal(receipt.status, 'PARTIAL');
  assert.equal(receipt.arrearsBreakdown.balanceDue, 500);
  for (const format of ['thermal-58', 'thermal-80', 'a4']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.equal(baqiRehtaOf(html), 'PKR 300', `${format}: Baqi Rehta nets the concession`);
    assert.ok(balanceOf(html).startsWith('PKR 300'), `${format}: Balance is PKR 300`);
  }
});

test('Plan 555: every bill-field waiver nets the arrears row on HTML, PNG and thermal alike', () => {
  const waivers = [
    ['concession', { concessionAmount: 200, concessionReason: 'Outage' }],
    ['referral credit', { referralCreditAmount: 200, referralCreditReason: 'Hamsaya' }],
    ['deposit offset', { depositOffsetAmount: 200 }],
    ['credit transfer', { creditTransferInAmount: 200 }],
    ['feeder-host credit', { feederHostCreditAmount: 200, feederHostCreditReason: 'Bijli' }],
    ['first-month tag', { firstMonthWaivedAmount: 200, firstMonthWaivedReason: 'First month included' }],
  ];
  for (const [name, waiver] of waivers) {
    const { customer, receipt } = waiverFixture({ due: 1000, paid: 800, waiver });
    assert.equal(receipt.balanceDueCents, 0, `${name}: the engine nets the waiver`);
    assert.equal(receipt.status, 'PAID', `${name}: sealed PAID on the net`);
    const html = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
    assert.equal(baqiRehtaOf(html), 'PKR 0', `${name}: HTML Baqi Rehta is the net balance`);
    assert.equal(pngRemainingOf(buildPngReceiptModel(receipt, customer)), 'PKR 0', `${name}: PNG remaining equals the HTML Balance Due`);
    assert.equal(escPosFieldsFromPaymentReceipt(receipt).arrearsBalance, 'PKR 0', `${name}: thermal arrears balance equals the HTML Balance Due`);
  }
});

test('Plan 555: the PNG remaining balance equals the HTML Balance Due on the same fixture', () => {
  const { customer, receipt } = waiverFixture({ due: 1000, paid: 500, waiver: { concessionAmount: 200, concessionReason: 'Outage' } });
  assert.equal(receipt.balanceDueCents, 30000);
  assert.equal(pngRemainingOf(buildPngReceiptModel(receipt, customer)), 'PKR 300');
  assert.equal(baqiRehtaOf(generatePaymentReceiptHtml(receipt, { format: 'a4' })), 'PKR 300');
});

// ---------------------------------------------------------------- format parity

// A taxed 1,500-package bill: 1,500 package + 292.50 tax = 1,792.50 due.
const taxedFixture = () => {
  const taxCents = 29250;
  const bill = {
    id: 'bill-2026-11', month: '2026-11', dueAmount: 1792.5, status: 'pending',
    packageSnapshot: { nominalPrice: 1500 }, salesTaxCents: taxCents, salesTaxRateBps: 1950, payments: [],
  };
  const payment = { id: 'pay-taxed', amount: 1792.5, date: '2026-11-07', method: 'Cash' };
  bill.payments = [payment];
  const customer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', packageHistory: [], bills: [bill] };
  return { customer, bill, payment, receipt: buildPaymentReceipt(customer, bill, payment) };
};

const qcReceipt = (overrides = {}) => ({
  id: 'receipt-12', receiptNumber: 'RCPT-12-202611-01', amount: 1792.5,
  customerName: 'Test Customer', customerNumber: 12, date: '2026-11-08', month: '2026-11',
  method: 'Cash', area: 'Sodaa', payableRemaining: 0, newTotalDues: 0, salesTaxCents: 29250, ...overrides,
});

test('Plan 555: the same 292.5 tax prints identically — PKR 292.50 — on HTML, PNG and the QC WhatsApp draft', () => {
  const { customer, receipt } = taxedFixture();
  assert.equal(receipt.salesTaxCents, 29250);
  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.ok(a4.includes('+PKR 292.50'), 'A4 shows PKR 292.50');
  const t80 = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
  assert.ok(t80.includes('+PKR 292.50'), 'thermal-80 shows PKR 292.50');
  assert.equal(pngTaxOf(buildPngReceiptModel(receipt, customer)), '+PKR 292.50');
  const draft = formatQuickCollectWhatsAppReceipt(qcReceipt()).text;
  assert.ok(draft.includes('Sales tax / سیلز ٹیکس (19.5%):* PKR 292.50'), 'QC WhatsApp draft shows PKR 292.50');
  const card = renderQuickCollectReceiptCardHtml(qcReceipt());
  assert.ok(card.includes('PKR 292.50'), 'QC success card shows PKR 292.50');
});

test('Plan 555: the same 1500.50 payment prints identically — PKR 1,500.50 — on HTML, PNG, split and WhatsApp', () => {
  const payment = { id: 'pay-half', amount: 1500.5, date: DATE, method: 'Cash' };
  const bill = { id: 'bill-2026-10', month: MONTH, dueAmount: 1500.5, status: 'pending', payments: [payment] };
  const customer = { id: 'c1', customerNumber: 34, name: 'Test Customer', packageHistory: [], bills: [bill] };
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.status, 'PAID');
  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.ok(a4.includes('PKR 1,500.50'), 'A4 shows PKR 1,500.50');
  const png = buildPngReceiptModel(receipt, customer);
  assert.equal(png.financial.find((row) => row.label.startsWith('Amount Paid'))?.value, 'PKR 1,500.50');

  // Split: one 1,500.50 Cash leg + one 500 Easypaisa leg on a 3,000 bill.
  let state = { version: 1, nextCustomerNumber: 2, customers: [{ id: 'a', customerNumber: 1, name: 'Customer 1', phone: '03000000001', area: 'Shahdara', archived: false, bills: [] }] };
  state = saveBillMonth(state, 'a', { month: MONTH, dueAmount: 3000, status: 'pending' }, new Date('2026-10-29T12:00:00+05:00'));
  const groupId = 'split-555';
  const { nextState: after, splitGroupId } = executeSplitTenderCollection(state, {
    customerId: 'a', month: MONTH, date: '2026-10-29', paidBy: 'Self',
    legs: [{ amount: 1500.5, method: 'Cash' }, { amount: 500, method: 'Easypaisa', transactionId: 'EP99887766' }],
  }, { execute: executeQuickCollection, referenceDate: new Date('2026-10-29T12:00:00+05:00') });
  const combined = buildSplitTenderReceipt(after, 'a', splitGroupId);
  assert.equal(combined.totalReceived, 2000.5);
  const waText = formatSplitTenderWhatsAppText(combined);
  assert.ok(waText.includes('PKR 1,500.50'), 'split WhatsApp leg shows PKR 1,500.50');
  assert.ok(waText.includes('PKR 2,000.50'), 'split WhatsApp total shows PKR 2,000.50');
  const splitHtml = generateSplitTenderReceiptHtml(combined, {});
  assert.ok(splitHtml.includes('PKR 1,500.50'), 'split HTML leg shows PKR 1,500.50');
  assert.ok(splitHtml.includes('PKR 2,000.50'), 'split HTML total shows PKR 2,000.50');

  const draft = formatQuickCollectWhatsAppReceipt(qcReceipt({ amount: 1500.5, salesTaxCents: undefined })).text;
  assert.ok(draft.includes('PKR 1,500.50'), 'QC WhatsApp draft shows PKR 1,500.50');
});

// ---------------------------------------------------------------- null is never PKR 0

test('Plan 555: a null package price never prints as PKR 0 on HTML or PNG', () => {
  const nullReceipt = {
    customerName: 'Ahmed', customerId: '12', paymentDate: '2026-11-03', receiptNumber: 'R-1',
    status: 'RECEIVED', package: '20 Mbps', paymentMethod: 'Cash', paidAmount: 1500.5,
    nominalPrice: null, servicePeriodStart: '2026-11-01', balanceDueCents: null, verificationCode: 'AB12-CD',
  };
  const html = generatePaymentReceiptHtml(nullReceipt, { format: 'thermal-80' });
  assert.ok(html.includes('Monthly Fee / ماہانہ واجبات:</dt><dd>—</dd>'), 'HTML Billed row is a dash, never PKR 0');
  assert.ok(!html.includes('<dd>PKR 0</dd>'), 'no invented PKR 0 figure on the sheet');
  assert.ok(balanceOf(html).startsWith('—'), 'unknown balance is a dash, never PKR 0');
  const model = buildPngReceiptModel({ ...nullReceipt, customerName: 'Ahmed' }, { name: 'Ahmed', mohalla: 'Shahdara Town', zone: 'Barrian' });
  assert.equal(model.financial.find((row) => row.label.startsWith('Current Month Bill'))?.value, '—');
});

// ---------------------------------------------------------------- pins: what Plan 555 does NOT change

test('Plan 555 PIN: formatPKR in core.js is untouched — the model the shared format follows', () => {
  assert.equal(formatPKR(292.5), 'PKR 292.50');
  assert.equal(formatPKR(1500.5), 'PKR 1,500.50');
  assert.equal(formatPKR(1500), 'PKR 1,500');
  assert.equal(formatPKR(null), 'Not set');
  assert.equal(formatPKR(0), 'PKR 0');
});

test('Plan 555 PIN: buildArrearsBreakdown keeps its stored shape — the gross balance stays gross', () => {
  const { bill, customer } = waiverFixture({ due: 1000, paid: 800, waiver: { concessionAmount: 200 } });
  const breakdown = buildArrearsBreakdown(customer, bill);
  assert.equal(breakdown.balanceDue, 200, 'the stored breakdown is gross of waivers, by house convention');
  assert.equal(breakdown.totalDue, 1000);
  assert.equal(breakdown.paidAmount, 800);
});

test('Plan 555 PIN: the engine balance is untouched — only the display nets the waivers', () => {
  const { receipt } = waiverFixture({ due: 1000, paid: 800, waiver: { concessionAmount: 200 } });
  assert.equal(receipt.balanceDueCents, 0);
  assert.equal(receipt.concessionAmount, 200);
});
