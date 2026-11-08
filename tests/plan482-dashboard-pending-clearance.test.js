import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import { recordClearance } from '../payment-clearance.js';
import {
  calculatePendingClearance,
  pendingClearanceCountText,
  renderDashboardPendingClearance
} from '../dashboard-pending-clearance.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const MONTH = '2026-11';

// The pending-clearance total, read independently of the module
// under test: the recorded amounts of the payments whose
// clearance record is still pending, in integer cents. A voided
// receipt is history, never collected cash; a record naming no
// payment contributes nothing; an archived customer never
// appears; one payment counts once, however many records name
// it; a payment with no usable positive amount pays nothing.
function ledgerPendingClearanceCents(state, clearanceList) {
  const payments = new Map();
  for (const customer of state.customers ?? []) {
    if (customer?.archived) continue;
    for (const bill of customer.bills ?? []) {
      for (const payment of bill.payments ?? []) {
        if (typeof payment?.id !== 'string' || payments.has(payment.id)) continue;
        payments.set(payment.id, payment);
      }
    }
  }
  let cents = 0;
  let count = 0;
  const seen = new Set();
  for (const record of clearanceList ?? []) {
    if (record?.status !== 'pending') continue;
    const paymentId = typeof record?.paymentId === 'string' ? record.paymentId : '';
    if (!paymentId || seen.has(paymentId)) continue;
    seen.add(paymentId);
    const payment = payments.get(paymentId);
    if (!payment || payment.voided === true) continue;
    const amountCents = Math.round(Number(payment.amount || 0) * 100);
    if (amountCents <= 0) continue;
    cents += amountCents;
    count += 1;
  }
  return { cents, count };
}

function buildFixture() {
  let state = createInitialState([
    'Clear Cust A',
    'Clear Cust B',
    'Clear Cust C',
    'Clear Cust D',
    'Clear Cust E',
    'Clear Cust F',
    'Clear Cust G',
    'Clear Cust I',
    'Clear Cust J',
    'Clear Cust K'
  ]);
  const id = (index) => state.customers[index].id;
  const paymentId = (index) => state.customers[index].bills.find((b) => b.month === MONTH).payments[0].id;

  // A: 2000 bank transfer, pending clearance — +2000.
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 2000, date: '2026-11-02', method: 'Bank Transfer' }, REF_DATE);
  // B: a paisa-exact 1500.50 bank transfer, pending clearance
  // with the record's method 'cheque' — a cheque recorded in
  // the app arrives as a bank transfer, so the record's method
  // is the test, never the payment's spelling — +1500.50.
  state = saveBillMonth(state, id(1), { month: MONTH, dueAmount: 1500.5, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(1), MONTH, { amount: 1500.5, date: '2026-11-05', method: 'Bank Transfer' }, REF_DATE);
  // C: 800 bank transfer, clearance marked cleared — settled,
  // never pending.
  state = saveBillMonth(state, id(2), { month: MONTH, dueAmount: 800, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(2), MONTH, { amount: 800, date: '2026-11-04', method: 'Bank Transfer' }, REF_DATE);
  // D: 600 bank transfer, clearance marked bounced — the money
  // never landed, and it is not waiting either.
  state = saveBillMonth(state, id(3), { month: MONTH, dueAmount: 600, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(3), MONTH, { amount: 600, date: '2026-11-03', method: 'Bank Transfer' }, REF_DATE);
  // E: 900 bank transfer with no clearance record at all — never
  // tracked, never pending, never a guessed state.
  state = saveBillMonth(state, id(4), { month: MONTH, dueAmount: 900, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(4), MONTH, { amount: 900, date: '2026-11-06', method: 'Bank Transfer' }, REF_DATE);
  // F: 700 bank transfer, pending clearance, then voided — a
  // voided receipt is history, never collected cash.
  state = saveBillMonth(state, id(5), { month: MONTH, dueAmount: 700, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(5), MONTH, { amount: 700, date: '2026-11-05', method: 'Bank Transfer' }, REF_DATE);
  state.customers[5].bills.find((b) => b.month === MONTH).payments[0].voided = true;
  // G: 500 bank transfer, pending clearance — but the customer
  // is archived, so the payment never appears.
  state = saveBillMonth(state, id(6), { month: MONTH, dueAmount: 500, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(6), MONTH, { amount: 500, date: '2026-11-05', method: 'Bank Transfer' }, REF_DATE);
  state.customers[6].archived = true;
  // I: 400 bank transfer dated last month, pending clearance —
  // the total has no month scope, so a cheque from last month
  // that still has not cleared still counts — +400.
  state = saveBillMonth(state, id(7), { month: '2026-10', dueAmount: 400, status: 'pending', dueDate: '2026-10-08' }, REF_DATE);
  state = addPayment(state, id(7), '2026-10', { amount: 400, date: '2026-10-28', method: 'Bank Transfer' }, REF_DATE);
  // J: 1000 bank transfer, pending clearance — and a second
  // pending record names the same payment, so the payment must
  // count once — +1000.
  state = saveBillMonth(state, id(8), { month: MONTH, dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(8), MONTH, { amount: 1000, date: '2026-11-06', method: 'Bank Transfer' }, REF_DATE);
  // K: a zero-amount payment record with a pending clearance
  // record — a zero-amount record pays nothing.
  state.customers[9].bills.push({
    id: 'bill-pending-zero',
    month: MONTH,
    dueAmount: 1200,
    status: 'pending',
    dueDate: TODAY,
    payments: [{ id: 'pay-pending-zero', date: '2026-11-05', amount: 0, method: 'Bank Transfer' }]
  });

  // The clearance records, written the way the clearance
  // screen writes them. The duplicate record for J and the
  // record naming no payment are placed raw: the write path
  // refuses a second record for one payment, but the read
  // path must still count the payment once and the missing
  // payment never.
  let clearances = [];
  clearances = recordClearance(clearances, { id: 'clr-a', paymentId: paymentId(0), customer: 'Clear Cust A', method: 'bank_transfer', status: 'pending', dateRecorded: '2026-11-02' });
  clearances = recordClearance(clearances, { id: 'clr-b', paymentId: paymentId(1), customer: 'Clear Cust B', method: 'cheque', status: 'pending', dateRecorded: '2026-11-05' });
  clearances = recordClearance(clearances, { id: 'clr-c', paymentId: paymentId(2), customer: 'Clear Cust C', method: 'bank_transfer', status: 'cleared', dateRecorded: '2026-11-04', decisionDate: '2026-11-06' });
  clearances = recordClearance(clearances, { id: 'clr-d', paymentId: paymentId(3), customer: 'Clear Cust D', method: 'cheque', status: 'bounced', dateRecorded: '2026-11-03', decisionDate: '2026-11-06', note: 'Insufficient funds' });
  clearances = recordClearance(clearances, { id: 'clr-f', paymentId: paymentId(5), customer: 'Clear Cust F', method: 'bank_transfer', status: 'pending', dateRecorded: '2026-11-05' });
  clearances = recordClearance(clearances, { id: 'clr-g', paymentId: paymentId(6), customer: 'Clear Cust G', method: 'bank_transfer', status: 'pending', dateRecorded: '2026-11-05' });
  clearances = recordClearance(clearances, { id: 'clr-i', paymentId: state.customers[7].bills.find((b) => b.month === '2026-10').payments[0].id, customer: 'Clear Cust I', method: 'bank_transfer', status: 'pending', dateRecorded: '2026-10-28' });
  clearances = recordClearance(clearances, { id: 'clr-j', paymentId: paymentId(8), customer: 'Clear Cust J', method: 'bank_transfer', status: 'pending', dateRecorded: '2026-11-06' });
  clearances = recordClearance(clearances, { id: 'clr-k', paymentId: 'pay-pending-zero', customer: 'Clear Cust K', method: 'bank_transfer', status: 'pending', dateRecorded: '2026-11-05' });
  clearances = [
    ...clearances,
    { id: 'clr-j-dup', paymentId: paymentId(8), customer: 'Clear Cust J', method: 'bank_transfer', status: 'pending', dateRecorded: '2026-11-06' },
    { id: 'clr-missing', paymentId: 'pay-missing', customer: 'Clear Cust M', method: 'cheque', status: 'pending', dateRecorded: '2026-11-06' }
  ];
  return { state, clearances };
}

test('pending clearance: the total equals the sum of the not-yet-cleared cheque and transfer payments', () => {
  const { state, clearances } = buildFixture();
  const summary = calculatePendingClearance(state, clearances);
  // 2000 + 1500.50 + 400 + 1000 = 4900.50, over 4 payments.
  assert.equal(summary.amountCents, 490050);
  assert.equal(summary.count, 4);
  assert.deepEqual(ledgerPendingClearanceCents(state, clearances), { cents: 490050, count: 4 });
});

test('pending clearance: cleared, bounced, and untracked payments never count', () => {
  const { state, clearances } = buildFixture();
  const summary = calculatePendingClearance(state, clearances);
  assert.equal(summary.count, 4, 'only the four pending payments count');
  const onlySettled = clearances.filter((record) => record.status !== 'pending');
  assert.deepEqual(calculatePendingClearance(state, onlySettled), { amountCents: 0, count: 0 });
});

test('pending clearance: a voided pending payment counts towards neither the total nor the count', () => {
  const { state, clearances } = buildFixture();
  const summary = calculatePendingClearance(state, clearances);
  assert.equal(summary.amountCents, 490050, 'the voided 700 never lands in the total');
});

test('pending clearance: a pending record naming no payment contributes nothing, never a guessed amount', () => {
  const { state } = buildFixture();
  const summary = calculatePendingClearance(state, [
    { id: 'clr-ghost', paymentId: 'pay-ghost', customer: 'Clear Cust G', method: 'cheque', status: 'pending', dateRecorded: '2026-11-06' }
  ]);
  assert.deepEqual(summary, { amountCents: 0, count: 0 });
});

test('pending clearance: an archived customer never appears', () => {
  const { state, clearances } = buildFixture();
  const summary = calculatePendingClearance(state, clearances);
  assert.equal(summary.amountCents, 490050, 'the archived 500 never lands in the total');
});

test('pending clearance: one payment counts once, however many records name it', () => {
  const { state, clearances } = buildFixture();
  const summary = calculatePendingClearance(state, clearances);
  assert.equal(summary.count, 4, 'the duplicate record for J adds no second payment');
});

test('pending clearance: a pending payment from a previous month still counts — the total has no month scope', () => {
  const { state, clearances } = buildFixture();
  const summary = calculatePendingClearance(state, clearances);
  assert.equal(summary.amountCents, 490050, 'the October 400 still counts in November');
});

test('pending clearance: a zero-amount payment record pays nothing', () => {
  const { state, clearances } = buildFixture();
  const summary = calculatePendingClearance(state, clearances);
  assert.equal(summary.count, 4, 'the zero-amount record is not a payment behind the total');
});

test('pending clearance: a business with nothing pending shows zero, not a blank', () => {
  const summary = calculatePendingClearance({ customers: [] }, []);
  assert.deepEqual(summary, { amountCents: 0, count: 0 });
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderDashboardPendingClearance(doc, summary);
  assert.equal(els.pclPendingTotal.textContent, 'PKR 0');
  assert.equal(els.pclPendingLine.textContent, '0 payments waiting on clearance');
  assert.equal(els.pclPendingEmpty.hidden, false, 'empty state shows');
});

test('pending clearance render: PKR figures, line, and empty state land in the view', () => {
  const { state, clearances } = buildFixture();
  const summary = calculatePendingClearance(state, clearances);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderDashboardPendingClearance(doc, summary);
  assert.equal(els.pclPendingTotal.textContent, 'PKR 4,900.50');
  assert.equal(els.pclPendingLine.textContent, '4 payments waiting on clearance');
  assert.equal(els.pclPendingEmpty.hidden, true, 'empty state hides while payments are pending');
});

test('pending clearance: the singular count line reads one payment', () => {
  assert.equal(pendingClearanceCountText({ amountCents: 200000, count: 1 }), '1 payment waiting on clearance');
  assert.equal(pendingClearanceCountText({ amountCents: 0, count: 0 }), '0 payments waiting on clearance');
});

test('pending clearance: calculating and rendering never mutate the state or the clearance list', () => {
  const { state, clearances } = buildFixture();
  const beforeState = JSON.stringify(state);
  const beforeClearances = JSON.stringify(clearances);
  const summary = calculatePendingClearance(state, clearances);
  pendingClearanceCountText(summary);
  const els = {};
  renderDashboardPendingClearance({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(JSON.stringify(clearances), beforeClearances);
});

test('pending clearance wiring: the total sits on the billing dashboard after the cash-in-hand figure, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="pendingClearanceSection"'), 'pending-clearance section exists');
  assert.ok(page.indexOf('id="pendingClearanceSection"') > page.indexOf('id="cashInHandSection"'), 'total follows the cash-in-hand figure');
  assert.ok(page.indexOf('id="pendingClearanceSection"') < page.indexOf('id="collectionForecastSection"'), 'total sits before the forecast section');
  assert.ok(page.includes('id="pclPendingTotal"'), 'pending total element exists');
  assert.ok(page.includes('id="pclPendingLine"'), 'count line element exists');
  assert.ok(page.includes('id="pclPendingEmpty"'), 'empty state element exists');
  assert.ok(page.includes('data-i18n="dash_pendingclear_title"'), 'total title is translated');
  assert.ok(page.includes('data-i18n="dash_pendingclear_sub"'), 'total subtitle is translated');
  assert.ok(page.includes('Pending clearance'), 'total title reads Pending clearance');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-pending-clearance.js?v=1.11.0'"), 'dashboard imports the pending-clearance module at the pinned version');
  assert.ok(app.includes('renderDashboardPendingClearance(document, calculatePendingClearance(state, loadPaymentClearance()))'), 'renderDashboard fills the total from the state and the saved clearance records');
});

test('i18n: every dash_pendingclear_ key used exists in English and Urdu, with Urdu script in the Urdu value', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-pending-clearance.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_pendingclear_[a-z_]+)"/g)) used.add(match[1]);
  // The count keys sit inside t() calls in the module, not directly
  // after t(' — so the module scan takes every quoted key.
  for (const match of module.matchAll(/'(dash_pendingclear_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 4, `expected at least 4 pending-clearance keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
    assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur[key]), `Urdu value of ${key} carries no Urdu script`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-pending-clearance.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false, 'header names no module file');
  assert.equal(module.includes('full-history-list.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('document'), false);
  assert.equal(/\bwindow\s*[.([]/.test(module), false, 'module touches the window global');
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches a pure function call, not a clock read.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
  // The header is a /* */ block, never // line comments.
  assert.ok(module.startsWith('/*'), 'header is a block comment');
  // PKR only — no other currency symbol or code in the module source
  // (a dollar followed by a digit would be money; `${` template
  // placeholders are not).
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(module), false);
});
