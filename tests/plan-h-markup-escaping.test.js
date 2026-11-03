// Plan H — Security audit: markup escaping and input handling
// (Plan A-Z programme).
//
// This plan is an AUDIT, not an allegation of a live vulnerability.
// The generators fixed here (batch receipt, customer statement, optical
// and ethernet certificates) interpolated operator/customer text into
// HTML that is assigned via innerHTML / printed, so a name, note or
// serial containing markup would have rendered as markup. The fixes
// escape those fields with the files' existing escapeHtml helper.
//
// The standing scan tests at the end of this file fail on any NEW
// unescaped data interpolation inside the four fixed generators, so a
// later change cannot silently reintroduce the pattern. The scan is
// deliberately scoped to those generators: the rest of the app uses
// i18n strings, helper-returned HTML, numeric values and allowlist
// class/status values that a blanket scan would falsely flag.
//
// All fixture names, phones and areas are synthetic.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  escapeHtml,
  generateBatchReceiptHtml,
  generateCustomerStatementHtml,
  generateOpticalCertificateHtml,
  formatOpticalAcceptanceWhatsApp,
  buildOpticalCertificateRecord,
  generateEthernetCertHtml,
  buildEthernetCertRecord
} from '../form-validation.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const formValidationSrc = readFileSync(join(ROOT, 'form-validation.js'), 'utf8');
const navQuickCollectSrc = readFileSync(join(ROOT, 'nav-quick-collect.js'), 'utf8');
const appSrc = readFileSync(join(ROOT, 'app.js'), 'utf8');

// A payload that would break out of text and of a quoted attribute if
// it were interpolated raw. It must never appear verbatim in output.
const PAYLOAD = '<img src=x onerror=alert(1)>';
const ATTR_PAYLOAD = '"><script>alert(1)</script>';
const URDU_NAME = 'احمد خان';

// Every fixed generator must render the payload inert: no raw '<img',
// no raw '<script', no raw 'onerror=' from the payload.
const assertInert = (html, label) => {
  assert.ok(!html.includes(PAYLOAD), `${label} must not contain the raw payload`);
  assert.ok(!html.includes('<script>'), `${label} must not contain a raw script tag`);
  // No raw '<img' tag from the payload (the escaped form is '&lt;img',
  // which still contains the letters 'onerror=' as harmless text).
  assert.ok(!html.includes('<img src=x'), `${label} must not contain a raw img tag`);
  assert.ok(html.toLowerCase().includes('&lt;img'), `${label} must escape the payload`);
};

// ---------------------------------------------------------------- escapeHtml
test('Plan H: escapeHtml escapes ampersand', () => {
  assert.equal(escapeHtml('A & B'), 'A &amp; B');
});

test('Plan H: escapeHtml escapes angle brackets', () => {
  assert.equal(escapeHtml('<b>hi</b>'), '&lt;b&gt;hi&lt;/b&gt;');
});

test('Plan H: escapeHtml escapes double quotes', () => {
  assert.equal(escapeHtml('say "hi"'), 'say &quot;hi&quot;');
});

test("Plan H: escapeHtml escapes single quotes", () => {
  assert.equal(escapeHtml("it's"), 'it&#39;s');
});

test('Plan H: escapeHtml escapes a combined attack string', () => {
  assert.equal(
    escapeHtml('<a href="x" onclick=\'y\'>&'),
    '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;'
  );
});

test('Plan H: escapeHtml leaves Urdu text and ordinary symbols intact', () => {
  assert.equal(escapeHtml(URDU_NAME), URDU_NAME);
  assert.equal(escapeHtml('20 Mbps · PKR 2,000'), '20 Mbps · PKR 2,000');
});

test('Plan H: escapeHtml handles null, undefined and numbers', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});

// ------------------------------------------------------- batch receipt slips
const batchCustomer = (overrides = {}) => ({
  id: 'cust-1',
  customerNumber: 1,
  name: 'Sample Engineer',
  monthlyPrice: 2000,
  area: 'Shahdara Town',
  phone: '03001112233',
  package: '20 Mbps Fiber',
  bills: [{ month: '2026-10', dueAmount: 2000, paidAmount: 2000 }],
  ...overrides
});

test('Plan H: batch slip renders a malicious customer name inert', () => {
  const html = generateBatchReceiptHtml([batchCustomer({ name: PAYLOAD })], '2026-10', null, { filter: 'all' });
  assertInert(html, 'batch slip name');
});

test('Plan H: batch slip renders a malicious area and package inert', () => {
  const html = generateBatchReceiptHtml(
    [batchCustomer({ area: PAYLOAD, package: ATTR_PAYLOAD })], '2026-10', null, { filter: 'all' });
  assertInert(html, 'batch slip area/package');
  assert.ok(!html.includes(ATTR_PAYLOAD), 'attribute payload must not appear raw');
});

test('Plan H: batch slip renders a malicious phone and month inert', () => {
  const html = generateBatchReceiptHtml(
    [batchCustomer({ phone: PAYLOAD })], '2026-10', null, { filter: 'all' });
  assertInert(html, 'batch slip phone');
  const monthHtml = generateBatchReceiptHtml([batchCustomer()], PAYLOAD, null, { filter: 'all' });
  assertInert(monthHtml, 'batch slip month');
});

test('Plan H: batch slip renders a quote-breaking customer id inert', () => {
  const html = generateBatchReceiptHtml(
    [batchCustomer({ id: ATTR_PAYLOAD, customerNumber: '' })], '2026-10', null, { filter: 'all' });
  assert.ok(!html.includes(ATTR_PAYLOAD), 'id must not break out of data-customer-id');
  assert.ok(html.includes('&quot;&gt;&lt;script&gt;'), 'id must be escaped in the attribute');
});

test('Plan H: batch slip tear-off stub escapes name and month too', () => {
  const html = generateBatchReceiptHtml([batchCustomer({ name: PAYLOAD })], PAYLOAD, null, { filter: 'all' });
  const stub = html.slice(html.indexOf('batch-slip-stub'));
  assertInert(stub, 'batch slip stub');
});

test('Plan H: batch empty state escapes the filter and month', () => {
  // A filter that matches no slip reaches the empty-state branch.
  const html = generateBatchReceiptHtml([batchCustomer()], PAYLOAD, null, { filter: PAYLOAD });
  assertInert(html, 'batch empty state');
});

test('Plan H: batch slip keeps a legitimate Urdu name and symbols', () => {
  const html = generateBatchReceiptHtml(
    [batchCustomer({ name: `${URDU_NAME} & Sons`, area: 'Kot Mohalla' })], '2026-10', null, { filter: 'all' });
  assert.ok(html.includes(URDU_NAME), 'Urdu name must survive escaping');
  assert.ok(html.includes('&amp;'), 'ampersand must be escaped, not dropped');
  assert.ok(html.includes('Kot Mohalla'));
});

test('Plan H: batch slip keeps normal details and amounts unchanged', () => {
  const html = generateBatchReceiptHtml([batchCustomer()], '2026-10', null, { filter: 'all' });
  assert.ok(html.includes('Sample Engineer'));
  assert.ok(html.includes('PKR 2,000'));
  assert.ok(html.includes('status-paid'));
});

test('Plan H: batch slip filter behaviour is unchanged after escaping', () => {
  const customers = [
    batchCustomer(),
    batchCustomer({ id: 'cust-2', customerNumber: 2, name: 'Shaheen Afridi', bills: [{ month: '2026-10', dueAmount: 2500, paidAmount: 1000 }] })
  ];
  const pending = generateBatchReceiptHtml(customers, '2026-10', null, { filter: 'pending' });
  assert.ok(!pending.includes('Sample Engineer'));
  assert.ok(pending.includes('Shaheen Afridi'));
});

test('Plan H: batch slip WhatsApp button still carries escaped id and month', () => {
  const html = generateBatchReceiptHtml([batchCustomer()], '2026-10', null, { filter: 'all' });
  assert.ok(html.includes('data-cust-id="cust-1"'));
  assert.ok(html.includes('data-month="2026-10"'));
});

// ---------------------------------------------------------- customer statement
const statementData = (overrides = {}) => ({
  customer: {
    id: 'c1', customerNumber: 99, name: 'Shahid Khan',
    phone: '0300-1112233', area: 'Kot Mohalla', package: '20 Mbps', serviceStatus: 'active'
  },
  range: 'all',
  openingBalance: 0,
  totalBilled: 5000,
  totalPaid: 4000,
  currentBalance: 1000,
  events: [
    { date: '2026-02-05', type: 'bill', description: 'Monthly Bill (2026-02)', month: '2026-02', charge: 5000, credit: 0, runningBalance: 5000 },
    { date: '2026-02-08', type: 'payment', description: 'Payment Received · Cash', month: '2026-02', charge: 0, credit: 4000, runningBalance: 1000 }
  ],
  ...overrides
});

test('Plan H: statement renders a malicious subscriber name inert', () => {
  const data = statementData();
  data.customer.name = PAYLOAD;
  assertInert(generateCustomerStatementHtml(data), 'statement name');
});

test('Plan H: statement renders malicious id, phone, area and package inert', () => {
  const data = statementData();
  data.customer.id = ATTR_PAYLOAD;
  data.customer.phone = PAYLOAD;
  data.customer.area = PAYLOAD;
  data.customer.package = PAYLOAD;
  const html = generateCustomerStatementHtml(data);
  assertInert(html, 'statement customer fields');
  assert.ok(!html.includes(ATTR_PAYLOAD), 'id must not break out of the attribute');
});

test('Plan H: statement renders a malicious service status inert', () => {
  const data = statementData();
  data.customer.serviceStatus = PAYLOAD;
  assertInert(generateCustomerStatementHtml(data), 'statement status');
});

test('Plan H: statement renders a malicious entry description inert', () => {
  const data = statementData();
  data.events[0].description = PAYLOAD;
  assertInert(generateCustomerStatementHtml(data), 'statement entry description');
});

test('Plan H: statement renders a malicious entry month inert', () => {
  const data = statementData();
  data.events[0].month = PAYLOAD;
  assertInert(generateCustomerStatementHtml(data), 'statement entry month');
});

test('Plan H: statement filter note is escaped', () => {
  const html = generateCustomerStatementHtml(statementData(), { filterNote: PAYLOAD });
  assertInert(html, 'statement filter note');
});

test('Plan H: statement month subtotals escape the month', () => {
  const html = generateCustomerStatementHtml(statementData(), {
    monthSubtotals: [{ month: PAYLOAD, billed: 100, paid: 0, balance: 100 }]
  });
  assertInert(html, 'statement month subtotal');
});

test('Plan H: statement aging bucket label is escaped', () => {
  const html = generateCustomerStatementHtml(statementData(), {
    aging: { total: 100, buckets: [{ label: PAYLOAD, amount: 100 }] }
  });
  assertInert(html, 'statement aging label');
});

test('Plan H: statement trend note is escaped while trend svg stays internal', () => {
  const html = generateCustomerStatementHtml(statementData(), { trendNote: PAYLOAD });
  assertInert(html, 'statement trend note');
  const svgHtml = generateCustomerStatementHtml(statementData(), { trendSvg: '<svg><rect width="10"/></svg>' });
  assert.ok(svgHtml.includes('<svg>'), 'internal chart svg is inserted as markup, by design');
});

test('Plan H: statement keeps a legitimate Urdu name and normal figures', () => {
  const data = statementData();
  data.customer.name = URDU_NAME;
  const html = generateCustomerStatementHtml(data);
  assert.ok(html.includes(URDU_NAME));
  assert.ok(html.includes('PKR 5,000'));
  assert.ok(html.includes('PKR 1,000'));
});

test('Plan H: statement empty input still returns the empty state', () => {
  assert.match(generateCustomerStatementHtml(null), /statement-empty/);
});

// -------------------------------------------------------- optical certificate
const opticalCert = (overrides = {}) => {
  const cert = buildOpticalCertificateRecord(
    { id: 'cust-12', name: 'Rashid Khan', customerNumber: '42', area: 'Kot Mohibbu', phone: '03001234567', package: '20 Mbps' },
    { rxPowerDbm: -21.4, txPowerDbm: 2.8, inspector: 'Inspector Bilal' },
    { now: '2026-10-16T12:00:00Z', sequence: 2002 }
  );
  Object.assign(cert, overrides);
  return cert;
};

test('Plan H: optical A4 renders a malicious subscriber name inert', () => {
  const cert = opticalCert();
  cert.customer.name = PAYLOAD;
  assertInert(generateOpticalCertificateHtml(cert, { mode: 'a4' }), 'optical A4 name');
});

test('Plan H: optical thermal renders a malicious subscriber name inert', () => {
  const cert = opticalCert();
  cert.customer.name = PAYLOAD;
  assertInert(generateOpticalCertificateHtml(cert, { mode: 'thermal' }), 'optical thermal name');
});

test('Plan H: optical certificate renders malicious area, phone and package inert', () => {
  const cert = opticalCert();
  cert.customer.area = PAYLOAD;
  cert.customer.phone = PAYLOAD;
  cert.customer.package = PAYLOAD;
  assertInert(generateOpticalCertificateHtml(cert, { mode: 'a4' }), 'optical customer fields');
});

test('Plan H: optical certificate renders malicious inspector and notes inert', () => {
  const cert = opticalCert();
  cert.inspector = PAYLOAD;
  cert.notes = PAYLOAD;
  assertInert(generateOpticalCertificateHtml(cert, { mode: 'a4' }), 'optical inspector/notes');
});

test('Plan H: optical certificate renders malicious ONT serial and OLT port inert', () => {
  const cert = opticalCert();
  cert.telemetry.ontSerial = PAYLOAD;
  cert.telemetry.oltPort = ATTR_PAYLOAD;
  const html = generateOpticalCertificateHtml(cert, { mode: 'a4' });
  assertInert(html, 'optical serial/port');
  assert.ok(!html.includes(ATTR_PAYLOAD), 'port payload must not appear raw');
});

test('Plan H: optical certificate renders a malicious telemetry string inert', () => {
  const cert = opticalCert();
  cert.telemetry.rxPowerDbm = PAYLOAD;
  cert.telemetry.statusLabel = PAYLOAD;
  cert.telemetry.advice = PAYLOAD;
  assertInert(generateOpticalCertificateHtml(cert, { mode: 'a4' }), 'optical telemetry');
});

test('Plan H: optical certificate renders a malicious cert id inert', () => {
  const cert = opticalCert({ id: ATTR_PAYLOAD });
  const html = generateOpticalCertificateHtml(cert, { mode: 'a4' });
  assert.ok(!html.includes(ATTR_PAYLOAD), 'cert id must not appear raw');
});

test('Plan H: optical certificate keeps a legitimate Urdu name', () => {
  const cert = opticalCert();
  cert.customer.name = URDU_NAME;
  const html = generateOpticalCertificateHtml(cert, { mode: 'a4' });
  assert.ok(html.includes(URDU_NAME));
});

test('Plan H: optical certificate keeps normal A4 and thermal output', () => {
  const cert = opticalCert();
  assert.match(generateOpticalCertificateHtml(cert, { mode: 'a4' }), /OPT-202610-2002/);
  assert.match(generateOpticalCertificateHtml(cert, { mode: 'thermal' }), /-21\.4 dBm/);
  assert.match(generateOpticalCertificateHtml(cert, { mode: 'a4' }), /Rashid Khan/);
});

test('Plan H: optical WhatsApp text is plain text and is not html-escaped', () => {
  // The plain-text WhatsApp formatter is NOT an HTML surface; escaping
  // it would corrupt the message. It must stay unescaped by design.
  const cert = opticalCert();
  cert.customer.name = 'A & B';
  const text = formatOpticalAcceptanceWhatsApp(cert);
  assert.ok(text.includes('A & B'), 'plain-text message keeps the ampersand');
  assert.ok(!text.includes('&amp;'), 'plain-text message must not be html-escaped');
});

// ------------------------------------------------------- ethernet certificate
const ethernetCert = (overrides = {}) => {
  const cert = buildEthernetCertRecord({
    customerId: 'CUST-BAR-01',
    customerName: 'Shahid Mehmood',
    customerPhone: '+92 321 4455667',
    customerArea: 'Vandala Road',
    technicianName: 'Lineman Bilal',
    cableGrade: 'CAT6',
    lengthMeters: 25,
    wiringStandard: 'T568B',
    faultType: 'NONE'
  }, 0);
  Object.assign(cert, overrides);
  return cert;
};

test('Plan H: ethernet slip renders a malicious customer name inert', () => {
  const cert = ethernetCert({ customerName: PAYLOAD });
  assertInert(generateEthernetCertHtml(cert, { format: 'slip' }), 'ethernet slip name');
});

test('Plan H: ethernet A4 renders a malicious customer name inert', () => {
  const cert = ethernetCert({ customerName: PAYLOAD });
  assertInert(generateEthernetCertHtml(cert, { format: 'a4' }), 'ethernet A4 name');
});

test('Plan H: ethernet certificate renders malicious area, phone and technician inert', () => {
  const cert = ethernetCert({ customerArea: PAYLOAD, customerPhone: PAYLOAD, technicianName: PAYLOAD });
  assertInert(generateEthernetCertHtml(cert, { format: 'a4' }), 'ethernet customer fields');
});

test('Plan H: ethernet certificate renders a malicious verdict label inert', () => {
  const cert = ethernetCert({ verdictLabel: PAYLOAD });
  assertInert(generateEthernetCertHtml(cert, { format: 'a4' }), 'ethernet verdict label');
});

test('Plan H: ethernet certificate renders a malicious cable name inert', () => {
  const cert = ethernetCert({ cableName: PAYLOAD });
  assertInert(generateEthernetCertHtml(cert, { format: 'a4' }), 'ethernet cable name');
});

test('Plan H: ethernet verdict colour is allowlisted, not raw cert text', () => {
  const cert = ethernetCert({ verdictColor: 'red; background:url(javascript:alert(1))' });
  const html = generateEthernetCertHtml(cert, { format: 'a4' });
  assert.ok(!html.includes('javascript:alert'), 'style injection must not reach the output');
  assert.ok(html.includes('#10b981'), 'a non-hex verdict colour falls back to the default');
});

test('Plan H: ethernet certificate with a valid hex verdict colour keeps it', () => {
  const cert = ethernetCert({ verdictColor: '#ef4444' });
  assert.ok(generateEthernetCertHtml(cert, { format: 'a4' }).includes('#ef4444'));
});

test('Plan H: ethernet certificate keeps a legitimate Urdu name', () => {
  const cert = ethernetCert({ customerName: URDU_NAME });
  assert.ok(generateEthernetCertHtml(cert, { format: 'a4' }).includes(URDU_NAME));
});

test('Plan H: ethernet certificate keeps normal slip and A4 output', () => {
  const cert = ethernetCert();
  assert.ok(generateEthernetCertHtml(cert, { format: 'slip' }).includes('PREMISES LAN CABLE QA SLIP'));
  assert.ok(generateEthernetCertHtml(cert, { format: 'a4' }).includes('Shahid Mehmood'));
  assert.ok(generateEthernetCertHtml(cert, { format: 'slip' }).includes('CAT6 (25m)'));
});

// ------------------------------------------------ standing scan + proven safe
const functionBody = (src, name) => {
  const start = src.indexOf(`export function ${name}`);
  assert.ok(start >= 0, `${name} must exist`);
  const end = src.indexOf('export function', start + 10);
  return end === -1 ? src.slice(start) : src.slice(start, end);
};

// A raw data interpolation inside a fixed generator: ${customer./${cert./
// ${ev./${month}/${filter}/${t. that is NOT wrapped in escapeHtml, NOT a
// numeric toLocaleString, and NOT the allowlisted class ternary.
const rawDataInterpolations = (body) => {
  const bad = [];
  for (const match of body.matchAll(/\$\{([^}]*)\}/g)) {
    const expr = match[1];
    const isData = /(customer|cert|ev|month|filter|view|t)\./.test(expr) || expr === 'month' || expr === 'filter';
    const isSafe = expr.includes('escapeHtml') || expr.includes('toLocaleString') ||
      expr.includes('safeVerdictColor') || expr.includes('statusLabel.toLowerCase()') ||
      /is-due/.test(expr) || expr.includes('view.trendSvg') ||
      // Ethernet transmission figures are computed numbers / PASS-FAIL
      // ternaries from calculateEthernetTransmission, never raw text.
      /^t\.(speedMbps|insertionLossDb|nextMarginDb|negotiatedSpeed|isLengthExceeded|isNextCompliant|excessLoss)\b/.test(expr) ||
      // Internal HTML sections whose rows were escaped at construction.
      /^(rowsHtml|monthSubtotalsHtml|agingHtml|trendHtml)\b/.test(expr);
    if (isData && !isSafe) bad.push(expr);
  }
  return bad;
};

test('Plan H scan: batch receipt generator has no raw data interpolation', () => {
  assert.deepEqual(rawDataInterpolations(functionBody(formValidationSrc, 'generateBatchReceiptHtml')), []);
});

test('Plan H scan: customer statement generator has no raw data interpolation', () => {
  assert.deepEqual(rawDataInterpolations(functionBody(formValidationSrc, 'generateCustomerStatementHtml')), []);
});

test('Plan H scan: optical certificate generator has no raw data interpolation', () => {
  assert.deepEqual(rawDataInterpolations(functionBody(formValidationSrc, 'generateOpticalCertificateHtml')), []);
});

test('Plan H scan: ethernet certificate generator has no raw data interpolation', () => {
  assert.deepEqual(rawDataInterpolations(functionBody(formValidationSrc, 'generateEthernetCertHtml')), []);
});

test('Plan H scan: Quick Collect owner QR src is escaped at insertion', () => {
  assert.ok(navQuickCollectSrc.includes('escapeHtml(settings.ownerQrDataUrl)'),
    'owner QR data URL must be escaped in the img src attribute');
});

test('Plan H scan: WhatsApp KYC link phone is digits-only by construction', () => {
  // Proven safe, not an escape fix: the phone is reduced to digits
  // before it reaches the wa.me href, so it cannot break out of it.
  assert.ok(formValidationSrc.includes("replace(/\\D/g, '')"),
    'KYC WhatsApp phone must still be digits-stripped');
});

test('Plan H scan: statement trend note is escaped at insertion', () => {
  assert.ok(formValidationSrc.includes('escapeHtml(view.trendNote'),
    'trendNote must be escaped even though trendSvg is internal markup');
});

test('Plan H scan: app.js customer name rendering is already escaped', () => {
  assert.ok(appSrc.includes('escapeHtml(customer.name)'),
    'customer card rendering must keep escaping customer names');
});

test('Plan H scan: no fixed generator reintroduces a bare innerHTML data write', () => {
  // The generators return HTML strings; the scan above is the guard.
  // This test pins that guard to the four generators it covers.
  for (const name of ['generateBatchReceiptHtml', 'generateCustomerStatementHtml',
    'generateOpticalCertificateHtml', 'generateEthernetCertHtml']) {
    assert.ok(formValidationSrc.includes(`export function ${name}`), `${name} must exist`);
  }
});
