// SISP-14: QR Khata Card & Deep-Link Lookup.
// Pure-function tests on synthetic data only. Spec test criteria (verbatim):
// deep-link URL parameter ?customer=[id] opens the target customer's
// profile/payment drawer immediately on app load, and the QR canvas renders
// cleanly offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KHATA_APP_URL,
  KHATA_PAYMENT_SHOPS,
  buildKhataCardModel,
  buildKhataCardPrintHtml,
  buildKhataDeepLink,
  drawQrToCanvas,
  encodeQrMatrix,
  parseCustomerDeepLink,
  qrFormatBits,
  resolveDeepLinkCustomer,
  resolveQrBaseUrl
} from '../qr-card.js';

const customers = [
  { id: 'cust-abc', customerNumber: 42, name: 'Test Customer 34', mohalla: 'Shahdara', zone: 'Side 1', packageSpeed: '5Mbps', monthlySellingAmount: 1500 },
  { id: 'cust-def', customerNumber: 7, name: 'BILAL', mohalla: '', zone: '', packageSpeed: '', monthlySellingAmount: null }
];

// ------------------------------------------------------------ deep link

test('deep link: builds the canonical shop-counter URL with action=pay', () => {
  assert.equal(
    buildKhataDeepLink('cust-abc'),
    `${KHATA_APP_URL}?customer=cust-abc&action=pay`
  );
  assert.equal(buildKhataDeepLink(''), null);
  assert.equal(buildKhataDeepLink(null), null);
  assert.equal(
    buildKhataDeepLink('cust-abc', { baseUrl: 'https://example.com/app', action: 'profile' }),
    'https://example.com/app/?customer=cust-abc'
  );
});

test('deep link: parses ?customer=[id]&action=pay, defaults to profile', () => {
  assert.deepEqual(parseCustomerDeepLink('?customer=cust-abc&action=pay'), { customerId: 'cust-abc', action: 'pay' });
  assert.deepEqual(parseCustomerDeepLink('customer=cust-abc'), { customerId: 'cust-abc', action: 'profile' });
  assert.deepEqual(parseCustomerDeepLink('?customer=cust-abc&action=other'), { customerId: 'cust-abc', action: 'profile' });
  assert.equal(parseCustomerDeepLink(''), null);
  assert.equal(parseCustomerDeepLink('?action=pay'), null);
  assert.equal(parseCustomerDeepLink('?customer=%20'), null);
});

test('deep link: resolves id, customerNumber and cust-<number>; unknown is null', () => {
  const extended = [
    ...customers,
    { id: 'cust-99', customerNumber: 5, name: 'THIRD', mohalla: '', zone: '', packageSpeed: '', monthlySellingAmount: null }
  ];
  assert.equal(resolveDeepLinkCustomer(customers, 'cust-abc'), customers[0]);
  assert.equal(resolveDeepLinkCustomer(customers, '42'), customers[0]);
  assert.equal(resolveDeepLinkCustomer(extended, '99'), extended[2], 'cust-<number> form');
  assert.equal(resolveDeepLinkCustomer(customers, 'cust-42'), null, 'no customer literally has id cust-42');
  assert.equal(resolveDeepLinkCustomer(customers, 'cust-zzz'), null);
  assert.equal(resolveDeepLinkCustomer(customers, ''), null);
  assert.equal(resolveDeepLinkCustomer([], 'cust-abc'), null);
});

test('deep link: base URL stays canonical for localhost/file/garbage pages', () => {
  assert.equal(resolveQrBaseUrl('http://localhost:8080/index.html'), KHATA_APP_URL);
  assert.equal(resolveQrBaseUrl('file:///home/user/app/index.html'), KHATA_APP_URL);
  assert.equal(resolveQrBaseUrl('not a url'), KHATA_APP_URL);
  assert.equal(resolveQrBaseUrl('https://offerpk.github.io/shahdara-isp-billing/index.html'), KHATA_APP_URL);
  assert.equal(resolveQrBaseUrl('https://example.com/shop/app.html'), 'https://example.com/shop/');
});

// ------------------------------------------------------------ card model

test('card model: carries display fields, rate and shops, and the deep link', () => {
  const model = buildKhataCardModel(customers[0]);
  assert.equal(model.ispName, 'Shahdara ISP');
  assert.equal(model.customerName, 'Test Customer 34');
  assert.equal(model.connectionLabel, '#42');
  assert.equal(model.monthlyPackageRate, 1500);
  assert.equal(model.packageSpeed, '5Mbps');
  assert.equal(model.areaZone, 'Shahdara · Side 1');
  assert.deepEqual(model.shops, KHATA_PAYMENT_SHOPS);
  assert.equal(model.deepLink, `${KHATA_APP_URL}?customer=cust-abc&action=pay`);
  // The QR payload itself carries no financial data — only id + route.
  assert.ok(!model.deepLink.includes('1500'));
  assert.equal(buildKhataCardModel(null), null);
  assert.equal(buildKhataCardModel({ name: 'No id' }), null);
  const unset = buildKhataCardModel(customers[1]);
  assert.equal(unset.monthlyPackageRate, null);
  assert.equal(unset.connectionLabel, '#7');
});

test('print HTML: wallet card shows name, connection, rate, shops and QR image', () => {
  const model = buildKhataCardModel(customers[0]);
  const html = buildKhataCardPrintHtml(model, 'data:image/png;base64,QRDATA');
  assert.match(html, /Test Customer 34/);
  assert.match(html, /#42/);
  assert.match(html, /1,500/);
  assert.match(html, /Waseem Abbasi Shop/);
  // OWNER-CASH-SHOP: the printed shop line names the ONE unified shop.
  assert.match(html, /Hassan Balla Shop/);
  assert.match(html, /data:image\/png;base64,QRDATA/);
  assert.match(html, /width:58mm/);
  const noQr = buildKhataCardPrintHtml(model, null);
  assert.match(noQr, /QR code unavailable/);
});

// ------------------------------------------------------------ QR encoder

test('format bits: match the QR specification table for M and L', () => {
  assert.equal(qrFormatBits(0, 0), 0b101010000010010);
  assert.equal(qrFormatBits(3, 0), 0b101101101001011);
  assert.equal(qrFormatBits(7, 0), 0b100101010100000);
  assert.equal(qrFormatBits(0, 1), 0b111011111000100);
});

const FINDER = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1]
];

function assertFinderAt(matrix, ox, oy) {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      assert.equal(matrix.modules[oy + dy][ox + dx], FINDER[dy][dx], `finder cell (${ox + dx},${oy + dy})`);
    }
  }
}

function readFormatBits(matrix) {
  const size = matrix.size;
  const bit = (x, y) => matrix.modules[y][x];
  let format = 0;
  for (let i = 0; i <= 5; i++) format |= bit(8, i) << i;
  format |= bit(8, 7) << 6;
  format |= bit(8, 8) << 7;
  format |= bit(7, 8) << 8;
  for (let i = 9; i < 15; i++) format |= bit(14 - i, 8) << i;
  // Second copy must agree: top-right bits 0..7, bottom-left bits 8..14.
  let copy = 0;
  for (let i = 0; i < 8; i++) copy |= bit(size - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) copy |= bit(8, size - 15 + i) << i;
  assert.equal(copy, format, 'format info copies agree');
  return format;
}

test('QR: HELLO WORLD encodes as version 1 with valid structure', () => {
  const qr = encodeQrMatrix('HELLO WORLD');
  assert.equal(qr.version, 1);
  assert.equal(qr.size, 21);
  assert.equal(qr.ecLevel, 'M');
  assert.ok(qr.mask >= 0 && qr.mask <= 7);
  assert.equal(qr.modules.length, 21);
  for (const row of qr.modules) {
    assert.equal(row.length, 21);
    for (const cell of row) assert.ok(cell === 0 || cell === 1);
  }
  assertFinderAt(qr, 0, 0);
  assertFinderAt(qr, 14, 0);
  assertFinderAt(qr, 0, 14);
  for (let i = 8; i < 13; i++) {
    assert.equal(qr.modules[6][i], i % 2 === 0 ? 1 : 0, `timing row ${i}`);
    assert.equal(qr.modules[i][6], i % 2 === 0 ? 1 : 0, `timing col ${i}`);
  }
  assert.equal(qr.modules[13][8], 1, 'dark module');
  assert.equal(readFormatBits(qr), qrFormatBits(qr.mask, 0), 'format info matches mask');
});

test('QR: version selection follows byte capacity; oversize throws', () => {
  assert.equal(encodeQrMatrix('A'.repeat(14)).version, 1);
  assert.equal(encodeQrMatrix('A'.repeat(15)).version, 2);
  assert.equal(encodeQrMatrix('A'.repeat(84)).version, 5);
  assert.equal(encodeQrMatrix('A'.repeat(106)).version, 6);
  assert.throws(() => encodeQrMatrix('A'.repeat(107)), /too long/);
  assert.throws(() => encodeQrMatrix(''), /must not be empty/);
});

test('QR: deterministic, and UTF-8 payloads (Urdu, emoji) encode', () => {
  const a = encodeQrMatrix('HELLO WORLD');
  const b = encodeQrMatrix('HELLO WORLD');
  assert.deepEqual(a.modules, b.modules);
  assert.equal(a.mask, b.mask);
  const urdu = encodeQrMatrix('فیصل');
  assert.equal(urdu.version, 1); // 4 chars x 2 bytes = 8 bytes
  const emoji = encodeQrMatrix('🎉');
  assert.equal(emoji.version, 1); // 1 char x 4 bytes = 4 bytes
});

test('QR: deep-link payload encodes within version 6; oversize links throw', () => {
  const link = buildKhataDeepLink('cust-a1b2c3');
  const qr = encodeQrMatrix(link);
  assert.ok(qr.version <= 6);
  assert.equal(readFormatBits(qr), qrFormatBits(qr.mask, 0));
  // A 109-byte link exceeds version 6-M capacity: the UI must fall back to
  // card + copyable link instead of rendering a broken code.
  const longLink = buildKhataDeepLink('cust-abcdefghijklmnopqrstuvwxyz0123456789');
  assert.ok(longLink.length > 106);
  assert.throws(() => encodeQrMatrix(longLink), /too long/);
});

test('QR canvas: draws offline onto a canvas-like object', () => {
  const qr = encodeQrMatrix('HELLO WORLD');
  const calls = [];
  const ctx = { fillStyle: '', fillRect: (...args) => calls.push(args) };
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const out = drawQrToCanvas(canvas, qr, { modulePx: 4, margin: 4 });
  assert.equal(out, canvas);
  assert.equal(canvas.width, (21 + 8) * 4);
  assert.equal(canvas.height, (21 + 8) * 4);
  assert.deepEqual(calls[0], [0, 0, canvas.width, canvas.height], 'background first');
  let dark = 0;
  for (const row of qr.modules) for (const cell of row) dark += cell;
  assert.equal(calls.length - 1, dark, 'one fillRect per dark module');
});
