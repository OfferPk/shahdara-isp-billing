// SISP-6: Visual PNG Image Receipt & Urdu "PAID / وصول پایا" Digital Stamp.
// Pure-function tests on synthetic data only (stub canvas, no browser).
// Spec test criterion (verbatim): generateReceiptPNG() returns a valid
// image/png DataURL/Blob with non-zero dimensions and renders customer
// details accurately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentReceipt } from '../receipt.js';
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
    id: 'synthetic-customer', customerNumber: 42, name: 'RAJA FAISAL', nameUrdu: 'راجہ فیصل',
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
  assert.equal(model.customerName, 'RAJA FAISAL');
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
