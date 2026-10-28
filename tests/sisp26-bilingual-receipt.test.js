import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { urduNameFor, bilingualCustomerName, transliterateRomanToUrdu } from '../urdu-names.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import {
  WA_PLACEHOLDER_KEYS, resolveWaTemplateValues, renderWaTemplateFor,
  getWaTemplates, buildPaymentReceivedMessage
} from '../whatsapp-templates.js';
import { buildAreaSummaryCards } from '../phase3.js';
import {
  addPayment, createInitialState, saveBillMonth
} from '../core.js';

// SISP-26: #areaSummaryTable Mobile Cards Follow-Up & Bilingual Receipt Name
// Header. The carding half (PR #417) is already live: one card per row at
// <=700px with all nine metrics as labeled lines. This file verifies the
// follow-up (cards CSS switch + theme tokens + no-overflow rules) and builds
// the bilingual header: "Urdu name (Roman name)" on receipt layouts and in
// WhatsApp Urdu-variant drafts. The saved Roman name is never dropped, so
// records always match.

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const referenceDate = new Date('2026-10-07T12:00:00+05:00');
const syntheticPayment = (date, amount) => ({ date, amount: String(amount), method: 'Cash' });

function receiptFor(name, overrides = {}) {
  let state = createInitialState([name]);
  const customerId = 'seed-001';
  state = saveBillMonth(state, customerId, {
    month: '2026-10', dueAmount: '75', status: 'pending', packageId: '15mbps-unlimited'
  }, referenceDate);
  state = addPayment(state, customerId, '2026-10', syntheticPayment('2026-10-07', 75), referenceDate);
  const customer = { ...state.customers[0], ...overrides };
  const bill = customer.bills.find(row => row.month === '2026-10');
  return buildPaymentReceipt(customer, bill, bill.payments[0]);
}

test('urduNameFor: manual override wins, else transliteration, else empty', () => {
  assert.equal(urduNameFor({ name: 'RAJA FAISAL' }), 'راجہ فیصل');
  assert.equal(urduNameFor({ name: 'Ahmed', nameUrdu: 'احمد صاحب' }), 'احمد صاحب');
  assert.equal(urduNameFor({ name: '03001234567' }), '');
  assert.equal(urduNameFor({ name: '' }), '');
  assert.equal(urduNameFor(null), '');
  assert.equal(transliterateRomanToUrdu('RAJA FAISAL'), 'راجہ فیصل');
});

test('bilingualCustomerName: Urdu (Roman) when they differ, Roman only otherwise', () => {
  assert.equal(bilingualCustomerName({ name: 'RAJA FAISAL' }), 'راجہ فیصل (RAJA FAISAL)');
  assert.equal(bilingualCustomerName({ name: 'Ahmed', nameUrdu: 'احمد' }), 'احمد (Ahmed)');
  assert.equal(bilingualCustomerName({ name: '03001234567' }), '03001234567');
  assert.equal(bilingualCustomerName({ name: 'احمد' }), 'احمد');
});

test('buildPaymentReceipt carries customerNameUrdu without changing the Roman name', () => {
  const receipt = receiptFor('RAJA FAISAL');
  assert.equal(receipt.customerName, 'RAJA FAISAL');
  assert.equal(receipt.customerNameUrdu, 'راجہ فیصل');
  const overridden = receiptFor('RAJA FAISAL', { nameUrdu: 'راجہ فیصل صاحب' });
  assert.equal(overridden.customerNameUrdu, 'راجہ فیصل صاحب');
  const digits = receiptFor('03001234567');
  assert.equal(digits.customerName, '03001234567');
  assert.equal(digits.customerNameUrdu, '');
});

test('all three receipt layouts show the bilingual header', () => {
  const receipt = receiptFor('RAJA FAISAL');
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes('راجہ فیصل (RAJA FAISAL)'), `${format} shows the bilingual header`);
  }
  // Thermal-58 pins the exact Name field; the Roman name is never dropped.
  const thermal58 = generatePaymentReceiptHtml(receipt, { format: 'thermal-58' });
  assert.ok(thermal58.includes('<dt>Name / صارف:</dt><dd>راجہ فیصل (RAJA FAISAL)</dd>'));
});

test('receipts without an Urdu rendering, or built before the field, show Roman only', () => {
  const digits = receiptFor('03001234567');
  const html = generatePaymentReceiptHtml(digits, { format: 'a4' });
  assert.ok(html.includes('03001234567'));
  assert.ok(!html.includes('03001234567 ('), 'no empty-Urdu parens duplication');
  const legacy = { ...receiptFor('RAJA FAISAL') };
  delete legacy.customerNameUrdu;
  const legacyHtml = generatePaymentReceiptHtml(legacy, { format: 'thermal-80' });
  assert.ok(legacyHtml.includes('<dd>RAJA FAISAL</dd>'));
  assert.ok(!legacyHtml.includes('راجہ فیصل'), 'legacy receipts stay Roman-only');
});

test('WhatsApp templates: bilingualName placeholder, Urdu greeting bilingual, urduName unchanged', () => {
  assert.ok(WA_PLACEHOLDER_KEYS.includes('bilingualName'));
  const values = resolveWaTemplateValues({
    id: 'c1', name: 'Ahmed', nameUrdu: 'احمد', customerNumber: 1,
    connectionId: 'SH-001', packageSpeed: '5 Mbps', promiseDate: '2026-01-01'
  }, { totalDue: 1500 });
  assert.equal(values.name, 'Ahmed');
  assert.equal(values.urduName, 'احمد', 'plain urduName keeps its old meaning for saved custom templates');
  assert.equal(values.bilingualName, 'احمد (Ahmed)');
  const rendered = renderWaTemplateFor(getWaTemplates(null), 'billGenerated', {
    id: 'c1', name: 'Ahmed', nameUrdu: 'احمد', customerNumber: 1,
    connectionId: 'SH-001', packageSpeed: '5 Mbps', promiseDate: '2026-01-01'
  }, { totalDue: 1500 }, 'urdu');
  assert.ok(rendered.includes('السلام علیکم احمد (Ahmed)'), 'Urdu greeting carries both scripts');
  const roman = renderWaTemplateFor(getWaTemplates(null), 'billGenerated', {
    id: 'c1', name: 'Ahmed', nameUrdu: 'احمد', customerNumber: 1,
    connectionId: 'SH-001', packageSpeed: '5 Mbps', promiseDate: '2026-01-01'
  }, { totalDue: 1500 }, 'roman');
  assert.ok(roman.includes('Ahmed') && !roman.includes('احمد'), 'Roman variant is untouched');
  const digits = resolveWaTemplateValues({ name: '03001234567' }, {});
  assert.equal(digits.bilingualName, '03001234567');
  const received = buildPaymentReceivedMessage({
    id: 'c1', name: 'Ahmed', nameUrdu: 'احمد', customerNumber: 1,
    connectionId: 'SH-001', packageSpeed: '5 Mbps'
  }, { amount: 1500 }, null, 'urdu');
  assert.ok(received.includes('احمد (Ahmed)'));
});

test('area summary cards follow-up: switch rule, theme tokens, no-overflow rules', () => {
  const css = read('styles.css');
  const index = read('index.html');
  assert.ok(index.includes('id="areaSummaryTable"'));
  assert.ok(index.includes('id="areaSummaryCards"'));
  assert.ok(css.includes('@media(max-width:700px){.area-summary-card .table-scroll{display:none}.area-summary-cards{display:grid;gap:12px}}'),
    'at <=700px the wide table hides and the cards grid shows');
  assert.ok(css.includes('.area-intel-card{min-width:0'));
  assert.ok(css.includes('.area-intel-card{') && css.includes('background:var(--surface,'));
  assert.ok(css.includes('.area-intel-metric>strong') && css.includes('overflow-wrap:anywhere'),
    'long amounts wrap instead of overflowing a 360px card');
  // The card data layer still carries all nine metrics (PR #417 contract).
  const [card] = buildAreaSummaryCards([{
    area: 'Area: GANGALL', level: 'area', parentArea: '', depth: 0, customerCount: 10,
    activeCustomers: 8, billedRevenue: 15000, outstanding: 2500, hasBilledRevenue: true,
    hasBillHistory: true, excludedSubscriptions: 2, online: 6, onlineDenominator: 8,
    onlinePercent: 75, complaints: 1, newConnections: 3, arpu: 1875
  }], true, value => `PKR ${value}`);
  assert.deepEqual(card.metrics.map(metric => metric.label), [
    'Profiles', 'Active configured subscriptions', 'Service-month billed', 'Outstanding',
    'Excluded from ARPU', 'Online % (n/N)', 'Incidents', 'New connections', 'ARPU · billed / active'
  ]);
  assert.equal(card.metrics.find(metric => metric.label === 'Service-month billed').value, 'PKR 15000');
  assert.equal(card.metrics.find(metric => metric.label === 'ARPU · billed / active').value, 'PKR 1875');
});
