// SISP-6: Visual PNG Image Receipt & Urdu "PAID / وصول پایا" Digital Stamp.
// Pure-function tests on synthetic data only (stub canvas, no browser).
// Spec test criterion (verbatim): generateReceiptPNG() returns a valid
// image/png DataURL/Blob with non-zero dimensions and renders customer
// details accurately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { createBillPackageSnapshot } from '../package-catalog.js';
import { SALES_TAX_RECEIPT_LABEL } from '../package-sales-tax.js';
import {
  PNG_RECEIPT_WIDTH,
  PNG_RECEIPT_HEIGHT,
  PNG_RECEIPT_MIME,
  buildPngReceiptModel,
  computePngReceiptLayout,
  renderPngReceipt,
  generateReceiptPNG,
  shareOrDownloadPng,
  decideSeal,
  pngReceiptFilename,
} from '../png-receipt.js';

function stubCanvas() {
  const calls = [];
  const ctx = {
    calls,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
    textAlign: '', textBaseline: '', direction: '',
    fillRect: (...a) => calls.push(['fillRect', ...a]),
    strokeRect: (...a) => calls.push(['strokeRect', ...a]),
    fillText: (...a) => calls.push(['fillText', ...a]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...a) => calls.push(['moveTo', ...a]),
    lineTo: (...a) => calls.push(['lineTo', ...a]),
    arc: (...a) => calls.push(['arc', ...a]),
    stroke: () => calls.push(['stroke']),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    translate: (...a) => calls.push(['translate', ...a]),
    rotate: (...a) => calls.push(['rotate', ...a]),
    measureText: (t) => ({ width: t.length * 20 }),
  };
  return {
    ctx, width: 0, height: 0,
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,FAKEPNG',
    toBlob: (cb) => cb({ type: 'image/png', size: 1234 }),
  };
}

function paidFixture() {
  const payment = { id: 'pay-full', amount: 3000, date: '2026-10-05', method: 'Cash' };
  const bill = { id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [payment] };
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Test Customer 34', nameUrdu: 'راجہ فیصل',
    mohalla: 'Shahdara Town', zone: 'Barrian', packageSpeed: '10 Mbps',
    packageHistory: [], bills: [bill],
  };
  return { customer, bill, payment };
}

function kistFixture() {
  const payment = { id: 'pay-kist', amount: 4000, date: '2026-10-05', method: 'EasyPaisa', transactionId: 'TID123456' };
  const bill = {
    id: 'bill-2026-10', month: '2026-10', dueAmount: 4000, status: 'pending', payments: [payment],
    kistLines: [{ planId: 'plan-1', installmentNumber: 1, totalMonths: 3, amount: 1000, itemTitle: 'Tenda F3 Router' }],
  };
  const customer = {
    id: 'synthetic-customer', customerNumber: 7, name: 'AHMED KHAN',
    mohalla: 'Palaliya', zone: '', packageSpeed: '10 Mbps',
    packageHistory: [], bills: [bill],
  };
  return { customer, bill, payment };
}

test('seal is green PAID only when the balance is exactly zero; unknown balance never claims PAID', () => {
  assert.equal(decideSeal({ balanceDueCents: 0 }).kind, 'PAID');
  assert.equal(decideSeal({ balanceDueCents: 0 }).label, 'PAID');
  assert.equal(decideSeal({ balanceDueCents: 0 }).urdu, 'وصول پایا');
  assert.equal(decideSeal({ balanceDueCents: 5000 }).kind, 'PARTIAL');
  assert.equal(decideSeal({ balanceDueCents: null }).kind, 'PARTIAL');
  assert.equal(decideSeal({}).kind, 'PARTIAL');
});

test('full payment through the real receipt path stamps PAID with accurate details + Urdu name', () => {
  const { customer, bill, payment } = paidFixture();
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.status, 'PAID');
  assert.equal(receipt.balanceDueCents, 0);
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(model.seal.kind, 'PAID');
  assert.equal(model.customerName, 'Test Customer 34');
  assert.equal(model.urduName, 'راجہ فیصل');
  assert.equal(model.connectionId, '42');
  assert.equal(model.areaZone, 'Shahdara Town, Barrian');
  assert.equal(model.receiptNumber, receipt.receiptNumber);
  assert.equal(model.paymentDate, '2026-10-05');
  assert.match(model.packageLine, /10 Mbps/);
  const paid = model.financial.find((row) => row.label.startsWith('Amount Paid'));
  assert.equal(paid.value, 'PKR 3,000');
  const remaining = model.financial.find((row) => row.label.startsWith('Remaining Balance'));
  assert.equal(remaining.value, 'PKR 0');
  assert.equal(model.financial.some((row) => /Kist/.test(row.label)), false, 'no kist rows without kist');
});

test('partial payment stamps amber PARTIAL with the remaining balance', () => {
  const payment = { id: 'pay-part', amount: 1000, date: '2026-10-05', method: 'Cash' };
  const bill = { id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [payment] };
  const customer = { id: 'synthetic-customer', customerNumber: 3, name: 'BILAL', packageSpeed: '5 Mbps', packageHistory: [], bills: [bill] };
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.status, 'PARTIAL');
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(model.seal.kind, 'PARTIAL');
  assert.equal(model.seal.label, 'PARTIAL PAID');
  const remaining = model.financial.find((row) => row.label.startsWith('Remaining Balance'));
  assert.equal(remaining.value, 'PKR 2,000');
});

test('SISP-2 arrears + SISP-4 kist lines flow into the PNG financial box (no parallel computation)', () => {
  const { customer, bill, payment } = kistFixture();
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.status, 'PAID');
  assert.equal(receipt.arrearsBreakdown.kistAmount, 1000);
  const model = buildPngReceiptModel(receipt, customer);
  const byLabel = new Map(model.financial.map((row) => [row.label, row.value]));
  assert.equal(byLabel.get('Current Month Bill / Mahana Package'), 'PKR 3,000', 'package line excludes kist');
  assert.equal(byLabel.get('Hardware / Kist'), 'PKR 1,000');
  assert.equal(byLabel.get('Kist 1/3: Tenda F3 Router'), 'PKR 1,000');
  assert.equal(byLabel.get('Previous Balance / Sabiqa Baqaya'), 'PKR 0');
  assert.equal(byLabel.get('Payment Method / طریقہ'), 'EasyPaisa (Txn: TID123456)');
  assert.equal(model.seal.kind, 'PAID');
});

test('layout is 1600x2000, seal present, all commands in bounds, footer inside the canvas', () => {
  const { customer, bill, payment } = kistFixture();
  const model = buildPngReceiptModel(buildPaymentReceipt(customer, bill, payment), customer);
  const layout = computePngReceiptLayout(model);
  assert.equal(layout.width, PNG_RECEIPT_WIDTH);
  assert.equal(layout.height, PNG_RECEIPT_HEIGHT);
  assert.ok(layout.footerY > 0 && layout.footerY <= PNG_RECEIPT_HEIGHT, `footerY ${layout.footerY} inside canvas`);
  const seal = layout.commands.find((cmd) => cmd.type === 'seal');
  assert.ok(seal, 'seal command present');
  assert.equal(seal.label, 'PAID');
  assert.equal(seal.color, '#1a7a3c');
  assert.ok(seal.cx - seal.r >= 0 && seal.cx + seal.r <= PNG_RECEIPT_WIDTH);
  const texts = layout.commands.filter((cmd) => cmd.type === 'text').map((cmd) => cmd.text);
  assert.ok(texts.some((t) => t.includes(model.receiptNumber)), 'receipt number drawn');
  assert.ok(texts.some((t) => t.includes('AHMED KHAN')), 'customer name drawn');
  assert.ok(texts.some((t) => t.includes('Kist 1/3: Tenda F3 Router')), 'kist line drawn');
  for (const cmd of layout.commands) {
    if (cmd.type === 'rect') {
      assert.ok(cmd.x >= 0 && cmd.y >= 0 && cmd.x + cmd.w <= PNG_RECEIPT_WIDTH, 'rect in bounds');
    }
    if (cmd.type === 'text') {
      assert.ok(cmd.y >= 0 && cmd.y <= PNG_RECEIPT_HEIGHT, 'text y in bounds');
    }
  }
});

test('render executes on a stub context and draws the seal circles + receipt number', () => {
  const { customer, bill, payment } = paidFixture();
  const model = buildPngReceiptModel(buildPaymentReceipt(customer, bill, payment), customer);
  const layout = computePngReceiptLayout(model);
  const canvas = stubCanvas();
  renderPngReceipt(canvas.ctx, layout);
  const drawn = canvas.ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
  assert.ok(drawn.some((t) => t.includes(model.receiptNumber)), 'receipt number rendered');
  assert.ok(drawn.some((t) => t.includes('راجہ فیصل')), 'Urdu name rendered');
  assert.ok(canvas.ctx.calls.some((c) => c[0] === 'arc'), 'seal circles drawn');
  assert.ok(canvas.ctx.calls.some((c) => c[0] === 'rotate'), 'seal angled');
});

test('generateReceiptPNG returns a valid image/png DataURL/Blob with non-zero dimensions', async () => {
  const { customer, bill, payment } = paidFixture();
  const receipt = buildPaymentReceipt(customer, bill, payment);
  const canvas = stubCanvas();
  const png = await generateReceiptPNG(receipt, customer, { createCanvas: () => canvas });
  assert.equal(png.mime, PNG_RECEIPT_MIME);
  assert.equal(png.width, 1600);
  assert.equal(png.height, 2000);
  assert.ok(png.width > 0 && png.height > 0, 'non-zero dimensions');
  assert.ok(png.dataUrl.startsWith('data:image/png'), 'valid PNG data URL');
  assert.ok(png.blob && png.blob.type === 'image/png', 'valid PNG blob');
  assert.equal(png.filename, `SIP-receipt-${png.model.receiptNumber}.png`);
  assert.equal(png.model.seal.kind, 'PAID');
});

test('filename sanitizes unsafe receipt numbers', () => {
  assert.equal(pngReceiptFilename({ receiptNumber: 'REC-26/10 42#A' }), 'SIP-receipt-REC-26-10-42-A.png');
  assert.equal(pngReceiptFilename({ receiptNumber: '' }), 'SIP-receipt-receipt.png');
});

test('shareOrDownloadPng shares via navigator.share when canShare allows, else downloads', async () => {
  class FakeFile {
    constructor(parts, name, opts) { this.parts = parts; this.name = name; this.type = opts?.type; }
  }
  const shared = [];
  const navShare = {
    canShare: () => true,
    share: async (arg) => { shared.push(arg); },
  };
  const outcome = await shareOrDownloadPng(
    { blob: { type: 'image/png' }, dataUrl: 'data:image/png;base64,X', filename: 'SIP-receipt-R1.png' },
    { navigator: navShare, File: FakeFile },
  );
  assert.equal(outcome, 'shared');
  assert.equal(shared.length, 1);
  assert.equal(shared[0].files[0].name, 'SIP-receipt-R1.png');
  assert.equal(shared[0].files[0].type, 'image/png');

  const anchors = [];
  const docStub = {
    createElement: () => {
      const el = { href: '', download: '', clicked: false, click() { this.clicked = true; } };
      anchors.push(el);
      return el;
    },
    body: { appendChild: () => {}, removeChild: () => {} },
  };
  const navNoShare = { canShare: () => false, share: async () => { throw new Error('must not share'); } };
  const outcome2 = await shareOrDownloadPng(
    { blob: null, dataUrl: 'data:image/png;base64,X', filename: 'SIP-receipt-R2.png' },
    { navigator: navNoShare, document: docStub },
  );
  assert.equal(outcome2, 'downloaded');
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].download, 'SIP-receipt-R2.png');
  assert.equal(anchors[0].href, 'data:image/png;base64,X');
  assert.equal(anchors[0].clicked, true);
});

// --- Plan 551: PNG receipt shows the sales-tax line -----------------------
// The PNG slip was the only receipt surface hiding the tax: the package
// row read the tax-inclusive dueAmount (1,195 for a 1,000 package)
// with no tax line explaining the extra 195. Fixtures reuse the
// polish #11 taxed-receipt shape (bill carries salesTaxCents).

function taxedFixture({ price = 1000, packageId = '3mbps-100gb', kistAmount = 0 } = {}) {
  const taxCents = Math.round(price * 100 * 195 / 1000);
  const dueAmount = price + taxCents / 100 + kistAmount;
  const bill = {
    id: 'bill-2026-11', month: '2026-11', dueAmount, status: 'pending', payments: [],
    packageSnapshot: createBillPackageSnapshot(packageId),
    salesTaxCents: taxCents, salesTaxRateBps: 1950,
    ...(kistAmount > 0 ? {
      kistLines: [{ planId: 'plan-1', installmentNumber: 1, totalMonths: 3, amount: kistAmount, itemTitle: 'Tenda F3 Router' }],
    } : {}),
  };
  const payment = { id: 'pay-taxed', amount: dueAmount, date: '2026-11-07', method: 'Cash' };
  bill.payments = [payment];
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer',
    packageSpeed: '3Mbps / 100GB', packageHistory: [], bills: [bill],
  };
  return { customer, bill, payment, taxCents, dueAmount };
}

function taxRowOf(model) {
  return model.financial.find((row) => row.label.includes('Sales tax') || row.label.includes('سیلز ٹیکس'));
}

function packageRowOf(model) {
  return model.financial.find((row) => row.label.startsWith('Current Month Bill'));
}

test('Plan 551 REPRO: a taxed 1,000-package PNG shows a tax row of PKR 195 and a package row of PKR 1,000', () => {
  const { customer, bill, payment } = taxedFixture();
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.salesTaxCents, 19500);
  assert.equal(receipt.totalBilled, 1195);
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(packageRowOf(model).value, 'PKR 1,000', 'package row is the pre-tax price');
  const tax = taxRowOf(model);
  assert.ok(tax, 'tax row present');
  assert.equal(tax.label, SALES_TAX_RECEIPT_LABEL, 'same label as the HTML receipt');
  assert.equal(tax.value, '+PKR 195');
  // Placement: the tax row sits right after the package row, before kist.
  const labels = model.financial.map((row) => row.label);
  assert.equal(labels[0], 'Previous Balance / Sabiqa Baqaya');
  assert.equal(labels[1], 'Current Month Bill / Mahana Package');
  assert.equal(labels[2], SALES_TAX_RECEIPT_LABEL);
});

test('Plan 551: an untaxed PNG shows no tax row (never PKR 0)', () => {
  const { customer, bill, payment } = paidFixture();
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.salesTaxCents, null);
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(taxRowOf(model), undefined, 'no tax row on an untaxed receipt');
  assert.equal(packageRowOf(model).value, 'PKR 3,000', 'untaxed package row unchanged');

  // An explicit zero tax is also no row, never PKR 0.
  const taxed = taxedFixture();
  taxed.bill.salesTaxCents = 0;
  const zeroReceipt = buildPaymentReceipt(taxed.customer, taxed.bill, taxed.payment);
  assert.equal(taxRowOf(buildPngReceiptModel(zeroReceipt, taxed.customer)), undefined);
});

test('Plan 551: the PNG tax figure equals the HTML receipt tax figure on the same fixture', () => {
  const { customer, bill, payment } = taxedFixture();
  const receipt = buildPaymentReceipt(customer, bill, payment);
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(taxRowOf(model).value, '+PKR 195');
  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.ok(a4.includes('+PKR 195'), 'the A4 receipt shows the tax as +PKR 195');
  assert.match(a4, /Sales tax \/ سیلز ٹیکس \(19\.5%\)/);
  const thermal80 = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
  assert.ok(thermal80.includes('+PKR 195'), 'the thermal-80 receipt shows the same figure');
});

test('Plan 551: the tax row label collapses with the customer saved receipt language (SISP-91)', () => {
  const { customer, bill, payment } = taxedFixture();
  const receipt = buildPaymentReceipt(customer, bill, payment);
  const urduModel = buildPngReceiptModel(receipt, { ...customer, preferredReceiptLang: 'urdu' });
  assert.equal(taxRowOf(urduModel).label, 'سیلز ٹیکس (19.5%)', 'Urdu preference keeps the Urdu segment');
  const englishModel = buildPngReceiptModel(receipt, { ...customer, preferredReceiptLang: 'english' });
  assert.equal(taxRowOf(englishModel).label, 'Sales tax', 'English preference keeps the Latin segment');
  assert.equal(taxRowOf(englishModel).value, '+PKR 195', 'figure unchanged by language');
});

test('Plan 551: kist + tax — the package row excludes both kist and tax', () => {
  const { customer, bill, payment } = taxedFixture({ kistAmount: 1000 });
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.arrearsBreakdown.packageAmount, 1195, 'breakdown package still carries the tax');
  assert.equal(receipt.arrearsBreakdown.kistAmount, 1000);
  const model = buildPngReceiptModel(receipt, customer);
  const byLabel = new Map(model.financial.map((row) => [row.label, row.value]));
  assert.equal(byLabel.get('Current Month Bill / Mahana Package'), 'PKR 1,000', 'package row is pre-tax, not due minus kist');
  assert.equal(byLabel.get('Hardware / Kist'), 'PKR 1,000');
  assert.equal(taxRowOf(model).value, '+PKR 195');
});

test('Plan 551: a fractional tax (1,500 package) reads PKR 292.50 on the PNG, same as the HTML receipt', () => {
  const { customer, bill, payment } = taxedFixture({ price: 1500, packageId: '5mbps-150gb' });
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.salesTaxCents, 29250);
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(packageRowOf(model).value, 'PKR 1,500');
  // Plan 555: the shared receipt format prints a fractional figure with
  // two decimals (PKR 292.50, like formatPKR) — the intent pinned here,
  // "the same figure on both surfaces", is unchanged.
  assert.equal(taxRowOf(model).value, '+PKR 292.50');
  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.ok(a4.includes('+PKR 292.50'), 'the A4 receipt shows the same fractional figure');
});

test('Plan 551: the taxed slip still fits the 1600x2000 canvas with the footer inside', () => {
  const { customer, bill, payment } = taxedFixture();
  const model = buildPngReceiptModel(buildPaymentReceipt(customer, bill, payment), customer);
  const layout = computePngReceiptLayout(model);
  assert.equal(layout.width, PNG_RECEIPT_WIDTH);
  assert.equal(layout.height, PNG_RECEIPT_HEIGHT, 'no-history taxed receipt keeps the exact canvas');
  assert.ok(layout.footerY > 0 && layout.footerY <= PNG_RECEIPT_HEIGHT, `footerY ${layout.footerY} inside canvas`);
  const texts = layout.commands.filter((cmd) => cmd.type === 'text').map((cmd) => cmd.text);
  assert.ok(texts.some((t) => t.includes('+PKR 195')), 'tax row drawn');
  for (const cmd of layout.commands) {
    if (cmd.type === 'text') {
      assert.ok(cmd.y >= 0 && cmd.y <= PNG_RECEIPT_HEIGHT, 'text y in bounds');
    }
  }
});
