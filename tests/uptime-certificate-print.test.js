/**
 * uptime-certificate-print.test.js — SISP-170 [P2]: Commercial
 * Subscriber Monthly Uptime % & Invoice Certificate.
 *
 * Spec criterion (read-latest.txt, SISP-170): "For commercial
 * subscribers (clinics, schools, pharmacies, offices), generate a
 * 1-page printable Monthly Commercial Invoice & Service Uptime
 * Certificate combining billing summary, last 3 payments, and
 * calculated monthly uptime % (99.X%)." Tests: "Unit tests for monthly
 * uptime % calculation and bilingual commercial certificate layout."
 *
 * Pins:
 *  - uptime math: a 30-day month is 43,200 minutes; 432 recorded
 *    downtime minutes -> 99.0%; zero recorded downtime -> 100.0%;
 *    downtime beyond the month clamps to 0.0%; leap/common Februaries
 *    use real calendar minutes;
 *  - downtime attribution is downtime-analytics.js's own: the
 *    customer's register entries for the reportedAt month only,
 *    AREA_OUTAGE zone faults never count toward a customer, other
 *    customers never leak in, unresolved entries count as entries
 *    with 0 minutes;
 *  - billing figures equal the Billing Register's derivation (engine
 *    allocations): paid in full -> Paid 3000/3000/0; partial ->
 *    3000/1200/1800 Partial; a month with no priced bill -> the
 *    honest no-bill line, never invented figures;
 *  - last 3 payments: non-voided only, dated on/before the cert
 *    month's end, newest first, receipt ref = the STORED chain
 *    (receiptNumber -> permanentReceiptNumber -> ''), never generated;
 *  - the bilingual A4 layout: brand, both title languages, subscriber
 *    facts as recorded, billing figures, the payment rows with real
 *    refs, the big uptime %, the recorded-downtime basis footnote in
 *    both languages, signature blocks, ZERO raw i18n keys, and NO
 *    tax wording / tax id anywhere (no recorded tax field exists);
 *  - read-only: building + rendering mutates neither state nor the
 *    complaint register;
 *  - i18n: every upcert_* key used by the module, the profile section
 *    or the dialog markup exists in BOTH dictionaries, and the en/ur
 *    upcert_* key sets are identical;
 *  - wiring: profile section + button, dialog markup with the shared
 *    ↩ close button, app.js controller (both setup sites), token-only
 *    CSS, and the module reachable in the runtime graph WITHOUT being
 *    a build entry (dist budget #219).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildUptimeCertificate,
  computeMonthlyUptimePct,
  formatUptimePct,
  generateUptimeCertificatePrintHtml,
  lastPaymentsForCertificate,
  minutesInMonth,
  uptimeCertMonthLabel
} from '../uptime-certificate-print.js';
import { collectRuntimeFiles, ENTRY_FILES } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

const bill = (id, month, dueAmount, payments = []) => ({
  id, month, dueAmount, dueDate: `${month}-05`, status: 'pending', payments
});
const pay = (id, date, amount, extra = {}) => ({ id, date, amount, method: 'Cash', ...extra });
const complaint = (overrides = {}) => ({
  id: 'CMP-201',
  customerId: 'c-clinic',
  customerName: 'Test Clinic 41',
  zone: 'BARRIAN',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-09-05T10:00',
  resolvedAt: '2026-09-05T17:12',
  downtimeHours: 7.2,
  downtimeManual: false,
  status: 'Resolved',
  resolutionNote: '',
  createdAt: '',
  ...overrides
});

const clinicCustomer = (bills) => ({
  id: 'c-clinic',
  customerNumber: 41,
  name: 'Test Clinic 41',
  phone: '0300 9998877',
  address: 'House 4, Main Bazaar',
  mohalla: 'BARRIAN',
  zone: '',
  packageSpeed: '15 Mbps',
  bills
});

test('uptime math: calendar minutes and the 99.X% formula', () => {
  assert.equal(minutesInMonth('2026-09'), 43200, '30-day month = 43,200 minutes');
  assert.equal(minutesInMonth('2026-10'), 44640, '31-day month = 44,640 minutes');
  assert.equal(minutesInMonth('2026-02'), 40320, 'Feb 2026 (28 days)');
  assert.equal(minutesInMonth('2024-02'), 41760, 'Feb 2024 (leap, 29 days)');
  assert.equal(minutesInMonth('bogus'), null);
  assert.equal(minutesInMonth('2026-13'), null);

  assert.equal(computeMonthlyUptimePct(432, 43200), 99, 'spec pin: 432 of 43,200 minutes down = 99.0%');
  assert.equal(formatUptimePct(computeMonthlyUptimePct(432, 43200)), '99.0%');
  assert.equal(computeMonthlyUptimePct(0, 43200), 100, 'zero recorded downtime = 100.0%');
  assert.equal(formatUptimePct(100), '100.0%');
  assert.equal(computeMonthlyUptimePct(48000, 43200), 0, 'downtime beyond the month clamps to 0.0%');
  assert.equal(formatUptimePct(computeMonthlyUptimePct(48000, 43200)), '0.0%');
  assert.equal(computeMonthlyUptimePct(10, 0), null, 'no month length, no percentage');
  assert.equal(uptimeCertMonthLabel('2026-09'), 'September 2026');
});

test('uptime attribution: register entries for the month, area outages excluded', () => {
  const state = { customers: [clinicCustomer([bill('b-sep', '2026-09', 3000)])] };
  const complaints = [
    complaint({ id: 'CMP-201', downtimeHours: 7.2 }),
    complaint({ id: 'CMP-202', status: 'Open', resolvedAt: '', downtimeHours: null, reportedAt: '2026-09-10T09:00', issueCategory: 'Slow Speed' }),
    complaint({ id: 'CMP-203', customerId: 'AREA_OUTAGE', customerName: 'Zone fault', downtimeHours: 50 }),
    complaint({ id: 'CMP-204', customerId: 'c-other', customerName: 'Other Customer', downtimeHours: 10 }),
    complaint({ id: 'CMP-205', reportedAt: '2026-08-05T10:00', resolvedAt: '2026-08-05T15:00', downtimeHours: 5 })
  ];
  const cert = buildUptimeCertificate(state, complaints, 'c-clinic', { month: '2026-09' });
  assert.equal(cert.uptime.entries, 2, 'only this customer\'s September entries count (incl. the unresolved one)');
  assert.equal(cert.uptime.downtimeMinutes, 432, '7.2 recorded hours = 432 minutes; unresolved adds 0');
  assert.equal(cert.uptime.uptimePct, 99);
  assert.equal(cert.uptime.uptimePctText, '99.0%');
  assert.equal(cert.uptime.noDowntimeRecorded, false);
  assert.equal(cert.uptime.primaryIssueTag, 'Fiber Cut');
});

test('uptime: zero recorded downtime is an honest 100.0%', () => {
  const state = { customers: [clinicCustomer([bill('b-sep', '2026-09', 3000)])] };
  const cert = buildUptimeCertificate(state, [], 'c-clinic', { month: '2026-09' });
  assert.equal(cert.uptime.uptimePct, 100);
  assert.equal(cert.uptime.uptimePctText, '100.0%');
  assert.equal(cert.uptime.noDowntimeRecorded, true);
  assert.equal(cert.uptime.entries, 0);
});

test('billing summary: engine figures for paid, partial and missing bills', () => {
  const paidState = {
    customers: [clinicCustomer([bill('b-sep', '2026-09', 3000, [pay('p1', '2026-09-06', 3000, { receiptNumber: 'REC-2609-0041-FULL' })])])]
  };
  const paid = buildUptimeCertificate(paidState, [], 'c-clinic', { month: '2026-09' });
  assert.equal(paid.billing.found, true);
  assert.equal(paid.billing.status, 'paid');
  assert.equal(paid.billing.billAmount, 3000);
  assert.equal(paid.billing.paidAmount, 3000);
  assert.equal(paid.billing.balanceDue, 0);

  const partialState = {
    customers: [clinicCustomer([bill('b-sep', '2026-09', 3000, [pay('p1', '2026-09-06', 1200)])])]
  };
  const partial = buildUptimeCertificate(partialState, [], 'c-clinic', { month: '2026-09' });
  assert.equal(partial.billing.found, true);
  assert.equal(partial.billing.status, 'partial');
  assert.equal(partial.billing.billAmount, 3000);
  assert.equal(partial.billing.paidAmount, 1200);
  assert.equal(partial.billing.balanceDue, 1800);

  const noBill = buildUptimeCertificate(paidState, [], 'c-clinic', { month: '2026-07' });
  assert.equal(noBill.billing.found, false, 'no July bill exists — nothing is invented');
  assert.equal(noBill.billing.status, 'not-set');

  const ghost = buildUptimeCertificate(paidState, [], 'c-missing', { month: '2026-09' });
  assert.equal(ghost, null, 'unknown customer yields null, never a fabricated certificate');
});

test('last 3 payments: stored refs only, voided + future excluded, newest first', () => {
  const customer = clinicCustomer([
    bill('b-aug', '2026-08', 3000, [
      pay('p-aug', '2026-08-04', 3000, { receiptNumber: 'REC-2608-0041-AAAA' })
    ]),
    bill('b-sep', '2026-09', 3000, [
      pay('p-sep-1', '2026-09-03', 1500, { method: 'Cash at Balla shop', permanentReceiptNumber: 'REC-2609-0041-BBBB' }),
      pay('p-sep-2', '2026-09-20', 1500, { method: 'Easypaisa', receiptNumber: 'REC-2609-0041-CCCC' }),
      pay('p-sep-3', '2026-09-25', 200, {}),
      pay('p-sep-void', '2026-09-26', 9999, { voided: true, voidedAt: '2026-09-27T10:00:00', voidReason: 'Duplicate entry' })
    ]),
    bill('b-oct', '2026-10', 3000, [
      pay('p-oct', '2026-10-02', 3000, { receiptNumber: 'REC-2610-0041-DDDD' })
    ])
  ]);
  const rows = lastPaymentsForCertificate(customer, '2026-09');
  assert.equal(rows.length, 3, 'exactly the last 3 eligible payments');
  assert.deepEqual(rows.map((r) => r.paymentId), ['p-sep-3', 'p-sep-2', 'p-sep-1'], 'newest first; the voided and the October payment are out, August is cut off by the limit');
  assert.equal(rows[0].receiptRef, '', 'a payment with no stored ref keeps an empty ref — never a generated one');
  assert.equal(rows[1].receiptRef, 'REC-2609-0041-CCCC', 'stored receiptNumber wins');
  assert.equal(rows[2].receiptRef, 'REC-2609-0041-BBBB', 'permanentReceiptNumber is the stored fallback');
  assert.equal(rows[2].method, 'Cash at Balla shop');

  const october = lastPaymentsForCertificate(customer, '2026-10');
  assert.equal(october[0].paymentId, 'p-oct', 'the October payment joins once its month is the cert month');
});

function fullFixture() {
  const state = {
    customers: [clinicCustomer([
      bill('b-sep', '2026-09', 3000, [pay('p-sep-full', '2026-09-06', 3000, { receiptNumber: 'REC-2609-0041-FULL' })])
    ])]
  };
  const complaints = [complaint({ id: 'CMP-201', downtimeHours: 7.2 })];
  return { state, complaints };
}

test('certificate layout: bilingual A4 with real figures, refs and uptime', () => {
  const { state, complaints } = fullFixture();
  const cert = buildUptimeCertificate(state, complaints, 'c-clinic', { month: '2026-09' });
  const html = generateUptimeCertificatePrintHtml({ certificate: cert, lang: 'en', generatedDate: '2026-10-30' });

  assert.ok(html.includes('SHAHDARA FIBER NET'), 'business brand as the app\'s print sheets carry it');
  assert.ok(html.includes('Monthly Invoice &amp; Service Uptime Certificate'), 'English title (HTML-escaped & in the document source)');
  assert.ok(html.includes('ماہانہ انوائس اور سروس اپ ٹائم سرٹیفکیٹ'), 'Urdu title');
  assert.ok(html.includes('Test Clinic 41'), 'subscriber name as recorded');
  assert.ok(html.includes('#41'), 'customer number as recorded');
  assert.ok(html.includes('House 4, Main Bazaar'), 'recorded address');
  assert.ok(html.includes('15 Mbps'), 'recorded package');
  assert.ok(html.includes('September 2026'), 'month label');
  assert.ok(html.includes('PKR 3,000'), 'real bill figure from the fixture');
  assert.ok(html.includes('REC-2609-0041-FULL'), 'the payment\'s real stored receipt ref');
  assert.ok(html.includes('2026-09-06'), 'the payment\'s recorded date');
  assert.ok(html.includes('99.0%'), 'calculated uptime, big');
  assert.ok(html.includes('7.2 h'), 'recorded downtime total');
  assert.ok(html.includes('Paid / ادا شدہ'), 'bilingual status label');
  assert.ok(html.includes('Uptime is calculated from recorded downtime only'), 'basis footnote (en)');
  assert.ok(html.includes('اپ ٹائم صرف ریکارڈ شدہ بندش سے گنا جاتا ہے'), 'basis footnote (ur)');
  assert.ok(html.includes('Subscriber signature / صارف کے دستخط'), 'subscriber signature block');
  assert.ok(html.includes('Authorized signature / مجاز دستخط'), 'authorized signature block');
  assert.ok(!html.includes('upcert_'), 'no raw i18n key leaks into the paper');
  assert.ok(!/tax invoice/i.test(html), 'no "tax invoice" claim — no recorded tax field exists');
  assert.ok(!html.includes('NTN'), 'no invented tax id');
  assert.ok(!/sales tax/i.test(html), 'no invented tax line');

  const urdu = generateUptimeCertificatePrintHtml({ certificate: cert, lang: 'ur', generatedDate: '2026-10-30' });
  assert.ok(urdu.includes('ماہانہ انوائس اور سروس اپ ٹائم سرٹیفکیٹ'), 'Urdu render keeps the Urdu title');
  assert.ok(urdu.includes('99.0%'), 'Urdu render keeps the uptime figure');
});

test('certificate layout: sparse records stay honest', () => {
  const bare = { id: 'c-new', customerNumber: 77, name: 'New Customer 77', bills: [] };
  const state = { customers: [bare] };
  const cert = buildUptimeCertificate(state, [], 'c-new', { month: '2026-09' });
  assert.equal(cert.billing.found, false);
  assert.deepEqual(cert.payments, []);
  const html = generateUptimeCertificatePrintHtml({ certificate: cert, lang: 'en', generatedDate: '2026-10-30' });
  assert.ok(html.includes('No bill generated for this month.'), 'honest no-bill line');
  assert.ok(html.includes('No payments recorded up to this month.'), 'honest no-payments line');
  assert.ok(html.includes('No downtime recorded this month.'), 'honest no-downtime label next to 100.0%');
  assert.ok(html.includes('100.0%'));
  assert.ok(!html.includes('0300'), 'no phone row is printed when none is recorded');
  assert.equal(generateUptimeCertificatePrintHtml({ certificate: null }), '', 'null certificate renders nothing');
});

test('read-only: building and rendering mutate nothing', () => {
  const { state, complaints } = fullFixture();
  const beforeState = JSON.stringify(state);
  const beforeComplaints = JSON.stringify(complaints);
  const cert = buildUptimeCertificate(state, complaints, 'c-clinic', { month: '2026-09' });
  generateUptimeCertificatePrintHtml({ certificate: cert, lang: 'en', generatedDate: '2026-10-30' });
  generateUptimeCertificatePrintHtml({ certificate: cert, lang: 'ur', generatedDate: '2026-10-30' });
  assert.equal(JSON.stringify(state), beforeState, 'state untouched');
  assert.equal(JSON.stringify(complaints), beforeComplaints, 'complaint register untouched');
});

test('i18n: every upcert_* key exists in both dictionaries, sets identical', () => {
  const moduleSource = readFileSync(new URL('../uptime-certificate-print.js', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = new Set();
  for (const m of moduleSource.matchAll(/(?:t|bi)\('(upcert_[a-z_]+)'/g)) used.add(m[1]);
  for (const m of appSource.matchAll(/t\('(upcert_[a-z_]+)'/g)) used.add(m[1]);
  for (const m of indexHtml.matchAll(/data-i18n="(upcert_[a-z_]+)"/g)) used.add(m[1]);
  assert.ok(used.size >= 30, `expected at least 30 upcert keys in use, found ${used.size}`);
  for (const key of used) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en missing ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur missing ${key}`);
    assert.ok(String(TRANSLATIONS.en[key]).trim().length > 0, `en empty ${key}`);
    assert.ok(String(TRANSLATIONS.ur[key]).trim().length > 0, `ur empty ${key}`);
  }
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('upcert_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('upcert_')).sort();
  assert.deepEqual(urKeys, enKeys, 'en/ur upcert_* key sets are identical');
});

test('wiring: profile section, dialog, controller, token CSS, runtime graph', async () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');

  assert.ok(indexHtml.includes('id="uptimeCertificateDialog"'), 'dialog present');
  assert.ok(indexHtml.includes('id="uptimeCertificateMonthInput"'), 'month picker present');
  assert.ok(indexHtml.includes('id="uptimeCertificatePrintBtn"'), 'print action present');
  assert.ok(indexHtml.includes('uptime-certificate-modal'), 'dialog class present');
  assert.ok(indexHtml.includes('billing-modal uptime-certificate-modal'), 'dialog uses the shared billing-modal shell (var(--modal-surface))');
  const dialogStart = indexHtml.indexOf('id="uptimeCertificateDialog"');
  const dialogSlice = indexHtml.slice(dialogStart, dialogStart + 700);
  assert.ok(dialogSlice.includes('id="uptimeCertificateCloseBtn" class="close-btn"'), 'shared close button present');
  assert.ok(dialogSlice.includes('↩'), 'close button shows the shared back-arrow glyph');

  assert.ok(app.includes("from './uptime-certificate-print.js'"), 'app.js imports the module');
  assert.ok(app.includes('id="profileOpenUptimeCertBtn"'), 'profile print action present');
  assert.ok(app.includes('uptimeCertSectionHtml'), 'profile section is rendered');
  assert.ok(app.includes("querySelector('#profileOpenUptimeCertBtn')"), 'profile button is bound');
  assert.ok(app.includes('uptimeCertificateDialogController.open(String(customer.id))'), 'binding opens the dialog for THIS customer');
  assert.equal(app.split('setupUptimeCertificateDialog(() => state').length - 1, 2, 'controller set up at both init sites');
  assert.ok(app.includes('getComplaints: () => loadComplaints()'), 'downtime comes from the real complaint register loader');

  assert.ok(css.includes('.uptime-certificate-preview'), 'dialog CSS present');
  assert.ok(css.includes('.profile-uptime-cert-section'), 'profile section CSS present');
  const cssRules = css.match(/\.(?:uptime-certificate|profile-uptime-cert)[^{]*\{[^}]*\}/g) || [];
  assert.ok(cssRules.length >= 6, 'SISP-170 CSS rules found');
  for (const rule of cssRules) {
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(rule), `no hardcoded hex in SISP-170 screen CSS: ${rule}`);
  }

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('uptime-certificate-print.js'), 'module is reachable in the build runtime graph');
  assert.ok(!ENTRY_FILES.includes('uptime-certificate-print.js'), 'module is NOT a build entry (dist stays 25)');
});
