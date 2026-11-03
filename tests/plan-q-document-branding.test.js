// Plan Q — Receipts, slips, and the branding pack.
// One brand header/footer system across the receipt-family documents,
// the printed statement, and the clearance NOC. Presentation only:
// no test here asserts a changed total, balance, or VOID decision —
// those are pinned by the receipt / Plan K tests, and the VOID test
// below only checks the stamp still prints on every layout.
//
// Fixtures are synthetic; no real customer data is used.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BRAND_DEFAULTS,
  DOCUMENT_TITLES,
  brandHeaderContentHtml,
  brandHeaderHtml,
  brandMetaLine,
  brandTitleLine,
  documentFooterHtml,
  resolveDocumentTitle,
  sanitizeBrand
} from '../document-branding.js';
import {
  buildDownPaymentKistReceiptHtml,
  buildPaymentReceipt,
  generateDepositOffsetReceiptHtml,
  generateDepositSettlementReceiptHtml,
  generatePaymentReceiptHtml
} from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { generateClearanceNocSlipHtml, buildClearanceNocSlip } from '../clearance-noc-slip.js';
import { formatCustomerStatement, generateCustomerStatementHtml } from '../form-validation.js';
import { buildLinemanPayoutSlipHtml, settleLinemanPayout } from '../lineman-payout-slip.js';

const FOOTER = {
  footerText: 'Shukriya — Shahdara Fiber Net',
  easypaisaNumber: '03450001122',
  nayapayNumber: '',
  helplineWhatsapp: '03001112233',
  shopsText: 'Synthetic Shop A'
};

const payment = (id, amount, date, extra = {}) => ({ id, amount, date, method: 'Cash', ...extra });
const receiptFixture = (dueAmount = 2000, payments = [payment('pay-q', 2000, '2026-10-17')]) => {
  const bill = { id: 'bill-2026-10', month: '2026-10', dueAmount, status: 'pending', payments };
  const customer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '5 Mbps', packageHistory: [], bills: [bill] };
  return { customer, bill, receipt: buildPaymentReceipt(customer, bill, payments[0]) };
};
const headerOf = (html) => {
  const start = html.indexOf('<header');
  const end = html.indexOf('</header>') + '</header>'.length;
  return html.slice(start, end);
};

// ---------------------------------------------------------------- brand data

test('sanitizeBrand: empty, null, and non-object inputs fall back to the house defaults', () => {
  assert.deepEqual(sanitizeBrand(), BRAND_DEFAULTS);
  assert.deepEqual(sanitizeBrand(null), BRAND_DEFAULTS);
  assert.deepEqual(sanitizeBrand('Shahdara ISP'), BRAND_DEFAULTS);
  assert.deepEqual(sanitizeBrand({}), BRAND_DEFAULTS);
});

test('sanitizeBrand: whitespace-only fields fall back, real values are trimmed', () => {
  assert.deepEqual(sanitizeBrand({ businessName: '  My ISP  ', businessPhone: ' ', areaName: '\t' }), {
    businessName: 'My ISP',
    businessPhone: BRAND_DEFAULTS.businessPhone,
    areaName: BRAND_DEFAULTS.areaName
  });
});

test('sanitizeBrand: non-string fields fall back instead of printing junk', () => {
  assert.deepEqual(sanitizeBrand({ businessName: 42, businessPhone: null, areaName: undefined }), BRAND_DEFAULTS);
});

test('sanitizeBrand: a fully configured identity passes through untouched', () => {
  const brand = { businessName: 'Shahdara Fiber Net', businessPhone: '0300-0000000', areaName: 'Shahdara Village' };
  assert.deepEqual(sanitizeBrand(brand), brand);
});

test('brandMetaLine: the canonical meta line is "area · Tel: phone"', () => {
  assert.equal(brandMetaLine(), 'Shahdara, Islamabad · Tel: 0300-1234567');
  assert.equal(
    brandMetaLine({ businessName: 'X', businessPhone: '0300-0000000', areaName: 'Shahdara Village' }),
    'Shahdara Village · Tel: 0300-0000000'
  );
});

test('brandMetaLine: blank identity fields fall back to defaults in the line', () => {
  assert.equal(brandMetaLine({ areaName: '  ', businessPhone: '' }), 'Shahdara, Islamabad · Tel: 0300-1234567');
});

// ---------------------------------------------------------------- titles

test('brandTitleLine: a bilingual pair renders as "English / اردو"', () => {
  assert.equal(brandTitleLine({ en: 'Payment Receipt', ur: 'رسید ادائیگی' }), 'Payment Receipt / رسید ادائیگی');
});

test('brandTitleLine: a single side renders alone, both empty render nothing', () => {
  assert.equal(brandTitleLine({ en: 'Payment Receipt', ur: '' }), 'Payment Receipt');
  assert.equal(brandTitleLine({ en: '', ur: 'رسید ادائیگی' }), 'رسید ادائیگی');
  assert.equal(brandTitleLine({}), '');
});

test('DOCUMENT_TITLES: every receipt-family document has both languages', () => {
  for (const [key, title] of Object.entries(DOCUMENT_TITLES)) {
    assert.ok(title.en, `${key} has an English title`);
    assert.ok(title.ur, `${key} has an Urdu title`);
    assert.ok(!title.en.includes('{') && !title.ur.includes('{'), `${key} has no raw i18n placeholder`);
  }
});

test('resolveDocumentTitle: the map entry is used when no override is given', () => {
  assert.deepEqual(resolveDocumentTitle({ document: 'deposit-offset' }), DOCUMENT_TITLES['deposit-offset']);
  assert.deepEqual(resolveDocumentTitle({ document: 'down-payment-kist' }), DOCUMENT_TITLES['down-payment-kist']);
});

test('resolveDocumentTitle: an explicit title wins over the map entry', () => {
  assert.deepEqual(
    resolveDocumentTitle({ document: 'payment-receipt', titleEn: 'Custom Title', titleUr: 'حسب ضرورت' }),
    { en: 'Custom Title', ur: 'حسب ضرورت' }
  );
});

test('resolveDocumentTitle: an unknown document resolves to empty sides, never a raw key', () => {
  assert.deepEqual(resolveDocumentTitle({ document: 'no-such-document' }), { en: '', ur: '' });
  assert.ok(!brandTitleLine(resolveDocumentTitle({ document: 'no-such-document' })).includes('no-such-document'));
});

// ---------------------------------------------------------------- header builder

test('brandHeaderHtml: the thermal header carries brand, bilingual title, meta, and number', () => {
  const html = brandHeaderHtml({ businessName: 'My ISP', businessPhone: '0300-1111111', areaName: 'My Area' }, {
    document: 'payment-receipt', documentNumber: 'REC-1', documentNumberLabel: 'Receipt #:'
  });
  assert.ok(html.startsWith('<header class="receipt-head">'));
  assert.ok(html.includes('<div class="receipt-brand">My ISP</div>'));
  assert.ok(html.includes('<div class="receipt-subbrand">Payment Receipt / رسید ادائیگی</div>'));
  assert.ok(html.includes('<div class="receipt-meta-line">My Area · Tel: 0300-1111111</div>'));
  assert.ok(html.includes('<div class="receipt-num">Receipt #: <strong>REC-1</strong></div>'));
  assert.ok(!html.includes('<h1>'), 'thermal variant has no h1 (compact print)');
});

test('brandHeaderHtml: the number line is omitted when there is no document number', () => {
  const html = brandHeaderHtml({}, { document: 'payment-receipt' });
  assert.ok(!html.includes('receipt-num'));
});

test('brandHeaderHtml: brand, title, and number are escaped, never injected', () => {
  const html = brandHeaderHtml({ businessName: '<script>alert(1)</script>' }, {
    document: 'payment-receipt', documentNumber: 'REC-<b>1</b>', documentNumberLabel: 'Receipt #:'
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('REC-&lt;b&gt;1&lt;/b&gt;'));
});

test('brandHeaderContentHtml: the A4 variant has an h1 title, a brand span, and a number badge', () => {
  const html = brandHeaderContentHtml({}, {
    document: 'payment-receipt', documentNumber: 'REC-9', documentNumberLabel: 'Permanent Receipt:', variant: 'a4'
  });
  assert.ok(html.includes('<span class="receipt-brand">Shahdara ISP</span>'));
  assert.ok(html.includes('<h1>Payment Receipt / رسید ادائیگی</h1>'));
  assert.ok(html.includes('<p>Shahdara, Islamabad · Tel: 0300-1234567</p>'));
  assert.ok(html.includes('<div class="receipt-num-badge">Permanent Receipt: <strong>REC-9</strong></div>'));
});

test('brandHeaderContentHtml: the A4 metaPrefix keeps the Official Customer Record qualifier', () => {
  const html = brandHeaderContentHtml({}, {
    document: 'payment-receipt', variant: 'a4', metaPrefix: 'Official Customer Record'
  });
  assert.ok(html.includes('<p>Official Customer Record · Shahdara, Islamabad · Tel: 0300-1234567</p>'));
});

test('brandHeaderContentHtml: the number suffix carries a reference after the number', () => {
  const html = brandHeaderContentHtml({}, {
    document: 'deposit-offset', documentNumber: 'REC-9', documentNumberLabel: 'Offset Receipt:',
    documentNumberSuffix: ' · Ref: OFF-1', variant: 'a4'
  });
  assert.ok(html.includes('<div class="receipt-num-badge">Offset Receipt: <strong>REC-9</strong> · Ref: OFF-1</div>'));
});

test('brandHeaderContentHtml: thermal and A4 headers share the same brand, title, meta, and number data', () => {
  const brand = { businessName: 'My ISP', businessPhone: '0300-1111111', areaName: 'My Area' };
  const thermal = brandHeaderContentHtml(brand, { document: 'payment-receipt', documentNumber: 'REC-1', documentNumberLabel: 'Receipt #:' });
  const a4 = brandHeaderContentHtml(brand, { document: 'payment-receipt', documentNumber: 'REC-1', documentNumberLabel: 'Receipt #:', variant: 'a4' });
  for (const fragment of ['My ISP', 'Payment Receipt / رسید ادائیگی', 'My Area · Tel: 0300-1111111', 'REC-1']) {
    assert.ok(thermal.includes(fragment), `thermal carries ${fragment}`);
    assert.ok(a4.includes(fragment), `a4 carries ${fragment}`);
  }
});

// ---------------------------------------------------------------- footer builder

test('documentFooterHtml: a thank-you line alone renders without a studio block', () => {
  assert.equal(
    documentFooterHtml(null, { thankYou: '* شکریہ! Shahdara ISP *' }),
    '<p class="receipt-footer-text">* شکریہ! Shahdara ISP *</p>'
  );
});

test('documentFooterHtml: a configured footer alone renders the studio block, no thank-you line', () => {
  const html = documentFooterHtml(FOOTER);
  assert.ok(!html.includes('receipt-footer-text'));
  assert.ok(html.includes('receipt-custom-footer'));
  assert.ok(html.includes('EasyPaisa: 03450001122'));
  assert.ok(html.includes('Helpline (WhatsApp): 03001112233'));
  assert.ok(html.includes('Synthetic Shop A'));
});

test('documentFooterHtml: thank-you plus studio renders the thank-you first, then the studio block', () => {
  const html = documentFooterHtml(FOOTER, { thankYou: 'Thank you!' });
  assert.ok(html.indexOf('Thank you!') < html.indexOf('receipt-custom-footer'));
});

test('documentFooterHtml: nothing configured and no thank-you renders empty', () => {
  assert.equal(documentFooterHtml(null), '');
  assert.equal(documentFooterHtml({}), '');
});

test('documentFooterHtml: the thank-you line is escaped, never injected', () => {
  const html = documentFooterHtml(null, { thankYou: '<b>bold</b>' });
  assert.ok(!html.includes('<b>bold</b>'));
  assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt;'));
});

// ---------------------------------------------------------------- payment receipt layouts

test('payment receipt: thermal-58 and thermal-80 headers are now identical for the same receipt', () => {
  const { receipt } = receiptFixture();
  const h58 = headerOf(generatePaymentReceiptHtml(receipt, { format: 'thermal-58' }));
  const h80 = headerOf(generatePaymentReceiptHtml(receipt, { format: 'thermal-80' }));
  assert.equal(h58, h80);
});

test('payment receipt: the thermal header uses the canonical title and Tel label, never Phone:', () => {
  const { receipt } = receiptFixture();
  for (const format of ['thermal-58', 'thermal-80']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes('Payment Receipt / رسید ادائیگی'), `${format} canonical title`);
    assert.ok(html.includes('Shahdara, Islamabad · Tel: 0300-1234567'), `${format} canonical meta`);
    assert.ok(!html.includes('Phone: 0300-1234567'), `${format} has no Phone: label`);
  }
});

test('payment receipt: the A4 header carries the canonical title, the qualifier, and the Permanent Receipt badge', () => {
  const { receipt } = receiptFixture();
  const html = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.ok(html.includes('<h1>Payment Receipt / رسید ادائیگی</h1>'));
  assert.ok(!html.includes('رسید بل ادائیگی'), 'the old A4-only Urdu title is retired');
  assert.ok(html.includes('Official Customer Record · Shahdara, Islamabad · Tel: 0300-1234567'));
  assert.ok(html.includes(`Permanent Receipt: <strong>${receipt.receiptNumber}</strong>`));
});

test('payment receipt: all three layouts carry the same brand, title, and receipt number', () => {
  const { receipt } = receiptFixture();
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes('Shahdara ISP'), `${format} brand`);
    assert.ok(html.includes('Payment Receipt / رسید ادائیگی'), `${format} title`);
    assert.ok(html.includes(receipt.receiptNumber), `${format} number`);
  }
});

test('payment receipt: a custom brand flows through all three headers', () => {
  const { receipt } = receiptFixture();
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format, businessName: 'Shahdara Fiber Net', businessPhone: '0300-0000000', areaName: 'Shahdara Village' });
    assert.ok(html.includes('Shahdara Fiber Net'), `${format} custom brand`);
    assert.ok(html.includes('Shahdara Village · Tel: 0300-0000000'), `${format} custom meta`);
  }
});

test('payment receipt: blank brand options fall back to the house defaults in the header', () => {
  const { receipt } = receiptFixture();
  const html = generatePaymentReceiptHtml(receipt, { format: 'thermal-80', businessName: '   ', businessPhone: '', areaName: '' });
  assert.ok(html.includes('Shahdara ISP'));
  assert.ok(html.includes('Shahdara, Islamabad · Tel: 0300-1234567'));
});

test('payment receipt: a configured studio footer prints on all three layouts, unconfigured prints none', () => {
  const { receipt } = receiptFixture();
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const plain = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(!plain.includes('receipt-custom-footer'), `${format} plain has no studio block`);
    const configured = generatePaymentReceiptHtml(receipt, { format, receiptFooter: FOOTER });
    assert.ok(configured.includes('EasyPaisa: 03450001122'), `${format} carries the studio footer`);
    assert.ok(configured.includes('Synthetic Shop A'), `${format} carries the shops list`);
  }
});

test('payment receipt: money is untouched — a paid fixture still reads PAID with a zero balance', () => {
  const { receipt } = receiptFixture();
  assert.equal(receipt.status, 'PAID');
  assert.equal(receipt.balanceDueCents, 0);
  assert.equal(receipt.paidAmount, 2000);
  const html = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.ok(html.includes('PKR 2,000'));
});

test('payment receipt: the Plan K VOID stamp still prints in the header of every layout', () => {
  const voided = payment('pay-void', 2000, '2026-10-17', { voided: true });
  const { receipt } = receiptFixture(2000, [voided]);
  assert.equal(receipt.status, 'VOID');
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes('VOID — This payment was voided'), `${format} VOID stamp`);
  }
});

// ---------------------------------------------------------------- other receipt-family documents

test('kist receipt: shared header title and Tel meta, and the studio footer only when configured', () => {
  const kist = {
    receiptNumber: 'REC-KIST-1', paymentDate: '2026-10-17', customerId: '42', customerName: 'Synthetic Customer',
    itemTitle: 'Router', paymentMethod: 'Cash', totalAmount: 12000, paidDownPayment: 4000,
    monthlyKist: 2000, totalMonths: 4, remainingAfterDownPayment: 8000, verificationCode: 'AB12-CD',
    urduNote: 'Note', schedule: [{ installmentNumber: 1, totalMonths: 4, amount: 2000, status: 'billed' }]
  };
  const plain = buildDownPaymentKistReceiptHtml(kist);
  assert.ok(plain.includes('Down Payment Receipt / پیشگی ادائیگی رسید'));
  assert.ok(plain.includes('Shahdara, Islamabad · Tel: 0300-1234567'));
  assert.ok(plain.includes('Receipt #: <strong>REC-KIST-1</strong>'));
  assert.ok(!plain.includes('receipt-custom-footer'));
  const configured = buildDownPaymentKistReceiptHtml(kist, { receiptFooter: FOOTER });
  assert.ok(configured.includes('EasyPaisa: 03450001122'));
});

test('deposit settlement receipt: shared A4 header, status mark, and studio footer when configured', () => {
  const settlement = {
    receiptNumber: 'REC-SET-1', settlementDate: '2026-10-20', customerId: '42', customerName: 'Synthetic Customer',
    securityDeposit: 5000, arrearsOffset: 3000, offsets: [], hardwareCharges: [], unrecoveredHardwareCharge: 0,
    hardwareCovered: 0, refundAmount: 2000, arrearsRemaining: 0, hardwareOutstanding: 0, status: 'CLEARED',
    urduNote: 'Note'
  };
  const html = generateDepositSettlementReceiptHtml(settlement, { receiptFooter: FOOTER });
  assert.ok(html.includes('Final Disconnection Clearance Receipt / حتمی منقطعی کلیئرنس رسید'));
  assert.ok(html.includes('Clearance Receipt: <strong>REC-SET-1</strong>'));
  assert.ok(html.includes('CLEARED'));
  assert.ok(html.includes('EasyPaisa: 03450001122'));
});

test('deposit offset receipt: shared A4 header with the Ref suffix, and the NON-CASH notice intact', () => {
  const offset = {
    receiptNumber: 'REC-OFF-1', offsetId: 'OFF-7', offsetDate: '2026-10-20', customerId: '42',
    customerName: 'Synthetic Customer', bills: [], depositBefore: 5000, amount: 2000, depositAfter: 3000,
    reversed: false, reversedAt: null, status: 'OFFSET APPLIED', urduNote: 'Note'
  };
  const html = generateDepositOffsetReceiptHtml(offset);
  assert.ok(html.includes('Security Deposit Offset Receipt / سیکیورٹی ڈپازٹ تصفیہ رسید'));
  assert.ok(html.includes('Offset Receipt: <strong>REC-OFF-1</strong> · Ref: OFF-7'));
  assert.ok(html.includes('NON-CASH ADJUSTMENT'));
});

// ---------------------------------------------------------------- PNG, payout, statement, NOC

test('PNG receipt: the model title and brand defaults come from the one branding source', () => {
  const { customer, receipt } = receiptFixture();
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(model.title, 'Payment Receipt / رسید ادائیگی');
  assert.equal(model.businessName, BRAND_DEFAULTS.businessName);
  assert.equal(model.businessPhone, BRAND_DEFAULTS.businessPhone);
  assert.equal(model.areaName, BRAND_DEFAULTS.areaName);
});

test('PNG receipt: a custom brand identity flows into the model', () => {
  const { customer, receipt } = receiptFixture();
  const model = buildPngReceiptModel(receipt, customer, {
    businessName: 'Shahdara Fiber Net', businessPhone: '0300-0000000', areaName: 'Shahdara Village'
  });
  assert.equal(model.businessName, 'Shahdara Fiber Net');
  assert.equal(model.businessPhone, '0300-0000000');
  assert.equal(model.areaName, 'Shahdara Village');
});

test('lineman payout slip: the header meta line is the canonical brand meta line', () => {
  const settlement = settleLinemanPayout([], {
    linemanName: 'Test Lineman', month: '2026-10', paidDate: '2026-10-31', baseSalary: 30000,
    installCount: 5, installRate: 1000, visitCount: 12, visitRate: 250, bonuses: 2000, advances: 8000,
    recordedPaymentsTotal: 8000, recordedPaymentsCount: 3, paidFromDrawer: false, note: ''
  }).settlement;
  const html = buildLinemanPayoutSlipHtml(settlement, { generatedDate: '2026-11-05' });
  assert.ok(html.includes('Shahdara, Islamabad · Tel: 0300-1234567'));
  const configured = buildLinemanPayoutSlipHtml(settlement, {
    businessName: 'Shahdara Fiber Net', businessPhone: '0300-0000000', areaName: 'Shahdara Village', generatedDate: '2026-11-05'
  });
  assert.ok(configured.includes('Shahdara Village · Tel: 0300-0000000'));
});

test('statement: a configured studio footer prints after the signature block; unconfigured prints none', () => {
  const customer = {
    id: 'c1', customerNumber: '1', name: 'Test Customer', phone: '03001234567', area: 'Shahdara',
    package: '20 Mbps', serviceStatus: 'active',
    bills: [{ id: 'b1', month: '2026-09', dueDate: '2026-09-05', dueAmount: 2000, lateFee: 0, payments: [{ id: 'p1', date: '2026-09-06', amount: 2000, method: 'Cash' }] }]
  };
  const statement = formatCustomerStatement(customer, { range: 'all', adjustments: [] });
  const plain = generateCustomerStatementHtml(statement, {});
  assert.ok(!plain.includes('receipt-custom-footer'));
  const configured = generateCustomerStatementHtml(statement, { receiptFooter: FOOTER });
  assert.ok(configured.includes('EasyPaisa: 03450001122'));
  assert.ok(configured.includes('Synthetic Shop A'));
  assert.ok(configured.indexOf('Customer Signature') < configured.indexOf('receipt-custom-footer'));
});

test('statement: a malicious footer text renders inert, never as markup', () => {
  const customer = {
    id: 'c1', customerNumber: '1', name: 'Test Customer', phone: '03001234567', area: 'Shahdara',
    package: '20 Mbps', serviceStatus: 'active',
    bills: [{ id: 'b1', month: '2026-09', dueDate: '2026-09-05', dueAmount: 2000, lateFee: 0, payments: [{ id: 'p1', date: '2026-09-06', amount: 2000, method: 'Cash' }] }]
  };
  const statement = formatCustomerStatement(customer, { range: 'all', adjustments: [] });
  const html = generateCustomerStatementHtml(statement, {
    receiptFooter: { footerText: '<script>alert("x")</script>', easypaisaNumber: '', nayapayNumber: '', helplineWhatsapp: '', shopsText: '' }
  });
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('clearance NOC: the studio footer prints when configured; the slip keeps its own business line either way', () => {
  const customer = {
    id: 'cust-noc-1', customerNumber: 51, name: 'Test Customer 51', mohalla: 'Test Mohalla',
    connectionDate: '2025-03-01', archived: true, archivedAt: '2026-10-05T10:00',
    routerOwnership: 'isp-owned', mediaConverterOwnership: 'isp-owned',
    hardwareRecovered: { router: '2026-10-06', mediaConverter: '2026-10-07' }, securityDeposit: null,
    bills: [
      { id: 'bill-aug', month: '2026-08', dueAmount: 3000, status: 'paid', payments: [{ id: 'p-aug', date: '2026-08-04', amount: 3000, method: 'Cash' }] },
      { id: 'bill-sep', month: '2026-09', dueAmount: 3000, status: 'paid', payments: [{ id: 'p-sep', date: '2026-09-03', amount: 3000, method: 'Cash' }] }
    ]
  };
  const slip = buildClearanceNocSlip(customer, { tickets: [], issueDate: '2026-10-30' });
  assert.ok(slip, 'fixture clears');
  const plain = generateClearanceNocSlipHtml(slip, {});
  assert.ok(!plain.includes('receipt-custom-footer'));
  assert.ok(plain.includes('* Shahdara ISP *'));
  const configured = generateClearanceNocSlipHtml(slip, { receiptFooter: FOOTER });
  assert.ok(configured.includes('* Shahdara ISP *'));
  assert.ok(configured.includes('EasyPaisa: 03450001122'));
  assert.ok(configured.includes('Helpline (WhatsApp): 03001112233'));
});

// ---------------------------------------------------------------- print-layout contracts

test('print contracts: each payment layout declares its format and width class', () => {
  const { receipt } = receiptFixture();
  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.ok(a4.includes('data-receipt-format="a4"') && a4.includes('a4-receipt'));
  assert.ok(headerOf(a4).includes('<h1>'), 'A4 header has a full-size title');
  for (const format of ['thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes(`data-receipt-format="${format}"`), `${format} declares its format`);
    assert.ok(!headerOf(html).includes('<h1>'), `${format} header stays compact`);
  }
});

test('print contracts: kist, settlement, and offset sheets each declare their own format', () => {
  const kist = buildDownPaymentKistReceiptHtml({ receiptNumber: 'R1', paymentDate: '2026-10-17', customerId: '42', customerName: 'C', itemTitle: 'Router', paymentMethod: 'Cash', totalAmount: 12000, paidDownPayment: 4000, monthlyKist: 2000, totalMonths: 4, remainingAfterDownPayment: 8000, urduNote: '', schedule: [] });
  assert.ok(kist.includes('data-receipt-format="down-payment-kist"'));
  const settlement = generateDepositSettlementReceiptHtml({ receiptNumber: 'R2', settlementDate: '2026-10-20', customerId: '42', customerName: 'C', securityDeposit: 5000, arrearsOffset: 0, offsets: [], hardwareCharges: [], unrecoveredHardwareCharge: 0, hardwareCovered: 0, refundAmount: 5000, arrearsRemaining: 0, hardwareOutstanding: 0, status: 'CLEARED', urduNote: '' });
  assert.ok(settlement.includes('data-receipt-format="deposit-settlement"'));
  const offset = generateDepositOffsetReceiptHtml({ receiptNumber: 'R3', offsetId: 'OFF-1', offsetDate: '2026-10-20', customerId: '42', customerName: 'C', bills: [], depositBefore: 5000, amount: 2000, depositAfter: 3000, reversed: false, reversedAt: null, status: 'OFFSET APPLIED', urduNote: '' });
  assert.ok(offset.includes('data-receipt-format="deposit-offset"'));
});

test('print contracts: no payment header carries a raw i18n key or an undefined placeholder', () => {
  const { receipt } = receiptFixture();
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const header = headerOf(generatePaymentReceiptHtml(receipt, { format }));
    assert.ok(!header.includes('undefined'), `${format} header has no undefined`);
    assert.ok(!/rcpt_[a-z_]+/.test(header), `${format} header has no raw i18n key`);
    assert.ok(!header.includes('{'), `${format} header has no unfilled placeholder`);
  }
});
