import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import {
  setCollectionTarget
} from '../dashboard-collection-target.js';
import {
  calculateMonthTargetProgress,
  monthTargetRemainingText,
  renderMonthTarget
} from '../dashboard-month-target.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const MONTH = '2026-11';

// The ledger's own monthly total, read independently of the
// module under test: non-voided payments grouped by their
// payment date, in integer cents.
function ledgerMonthCents(state, month) {
  let cents = 0;
  for (const customer of state.customers ?? []) {
    for (const bill of customer.bills ?? []) {
      for (const payment of bill.payments ?? []) {
        if (payment?.voided === true) continue;
        if (typeof payment?.date !== 'string' || payment.date.slice(0, 7) !== month) continue;
        cents += Math.round(Number(payment.amount || 0) * 100);
      }
    }
  }
  return cents;
}

function mockStorage() {
  const store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); }
  };
}

function buildFixture() {
  let state = createInitialState([
    'Target Full A',
    'Target Paisa B',
    'Target Voided C',
    'Target Cross D'
  ]);
  const id = (index) => state.customers[index].id;

  // A: 3000 bill this month, paid in full this month — +3000.
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 3000, date: '2026-11-02', method: 'Cash' }, REF_DATE);
  // B: a paisa-exact 1500.50 bill this month, paid in full this
  // month — +1500.50.
  state = saveBillMonth(state, id(1), { month: MONTH, dueAmount: 1500.5, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(1), MONTH, { amount: 1500.5, date: '2026-11-05', method: 'Cash' }, REF_DATE);
  // C: 800 bill this month, 800 paid this month, then voided — a
  // voided receipt is history, never collected cash.
  state = saveBillMonth(state, id(2), { month: MONTH, dueAmount: 800, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(2), MONTH, { amount: 800, date: '2026-11-04', method: 'Cash' }, REF_DATE);
  state.customers[2].bills.find((b) => b.month === MONTH).payments[0].voided = true;
  // D: an October bill paid in November — the payment date rules
  // the ledger's monthly total, so it counts this month.
  state = saveBillMonth(state, id(3), { month: '2026-10', dueAmount: 1000, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id(3), '2026-10', { amount: 1000, date: '2026-11-03', method: 'Cash' }, REF_DATE);
  return state;
}

function storageWithTarget(amount) {
  const storage = mockStorage();
  setCollectionTarget(MONTH, amount, storage);
  return storage;
}

test('month target: the collected-so-far figure matches the ledger\'s own total for the month', () => {
  const state = buildFixture();
  const summary = calculateMonthTargetProgress(state, REF_DATE, storageWithTarget(10000));
  assert.equal(summary.month, MONTH);
  assert.equal(summary.hasTarget, true);
  assert.equal(summary.targetCents, 1000000);
  assert.equal(summary.collectedCents, ledgerMonthCents(state, MONTH));
  assert.equal(summary.collectedCents, 550050);
  assert.equal(summary.isHit, false);
});

test('month target: the remaining figure equals target minus collected', () => {
  const state = buildFixture();
  const summary = calculateMonthTargetProgress(state, REF_DATE, storageWithTarget(10000));
  assert.equal(summary.remainingCents, 1000000 - 550050);
  assert.equal(summary.remainingCents, 449950);
  assert.equal(monthTargetRemainingText(summary), 'PKR 4,499.50 still to collect');
});

test('month target: once collected reaches the target, the remaining reads zero and the line says so', () => {
  const state = buildFixture();
  const summary = calculateMonthTargetProgress(state, REF_DATE, storageWithTarget(5000));
  assert.equal(summary.collectedCents, 550050);
  assert.equal(summary.targetCents, 500000);
  // The target suite's own rule, reused verbatim: the remaining
  // figure never drops below zero, and the line says the target
  // is reached instead of showing a negative remainder.
  assert.equal(summary.remainingCents, 0);
  assert.equal(summary.isHit, true);
  assert.equal(monthTargetRemainingText(summary), 'Target reached');
});

test('month target: a voided payment never counts as collected cash', () => {
  let state = createInitialState(['Voided Only A']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 800, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 800, date: '2026-11-04', method: 'Cash' }, REF_DATE);
  state.customers[0].bills.find((b) => b.month === MONTH).payments[0].voided = true;
  const summary = calculateMonthTargetProgress(state, REF_DATE, storageWithTarget(1000));
  assert.equal(summary.collectedCents, 0);
  assert.equal(summary.remainingCents, 100000);
});

test('month target: with no target set, the line says so plainly and still shows what was collected', () => {
  const state = buildFixture();
  const summary = calculateMonthTargetProgress(state, REF_DATE, mockStorage());
  assert.equal(summary.hasTarget, false);
  assert.equal(summary.targetCents, null);
  assert.equal(summary.collectedCents, 550050);
  assert.equal(summary.remainingCents, null);
  assert.equal(summary.isHit, false);
  assert.equal(monthTargetRemainingText(summary), 'No target set for this month');
});

test('month target: a month with no collections reads zero collected and the full target remaining', () => {
  const summary = calculateMonthTargetProgress({ customers: [] }, REF_DATE, storageWithTarget(7500));
  assert.equal(summary.month, MONTH);
  assert.equal(summary.hasTarget, true);
  assert.equal(summary.collectedCents, 0);
  assert.equal(summary.remainingCents, 750000);
  assert.equal(monthTargetRemainingText(summary), 'PKR 7,500 still to collect');
});

test('month target render: target, collected, and remaining land in the view', () => {
  const summary = calculateMonthTargetProgress(buildFixture(), REF_DATE, storageWithTarget(10000));
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderMonthTarget(doc, summary);
  assert.equal(els.mtpTargetTotal.textContent, 'PKR 10,000');
  assert.equal(els.mtpTargetLine.textContent, 'Collected PKR 5,500.50 of PKR 10,000');
  assert.equal(els.mtpTargetRemaining.textContent, 'PKR 4,499.50 still to collect');
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }
});

test('month target render: with no target set, the total reads Not set and the line still shows collected', () => {
  const summary = calculateMonthTargetProgress(buildFixture(), REF_DATE, mockStorage());
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderMonthTarget(doc, summary);
  assert.equal(els.mtpTargetTotal.textContent, 'Not set');
  assert.equal(els.mtpTargetLine.textContent, 'Collected PKR 5,500.50 so far');
  assert.equal(els.mtpTargetRemaining.textContent, 'No target set for this month');
});

test('month target: the line never changes any bill, payment, or customer record', () => {
  const state = buildFixture();
  const storage = storageWithTarget(10000);
  const before = JSON.stringify(state);
  const summary = calculateMonthTargetProgress(state, REF_DATE, storage);
  monthTargetRemainingText(summary);
  const els = {};
  renderMonthTarget({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before);
});

test('month target wiring: the line sits on the billing dashboard after the month-comparison line, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="monthTargetSection"'), 'target section exists');
  assert.ok(page.indexOf('id="monthTargetSection"') > page.indexOf('id="monthCompareSection"'), 'line follows the month-comparison line');
  assert.ok(page.indexOf('id="monthTargetSection"') < page.indexOf('id="collectionForecastSection"'), 'line sits before the forecast section');
  assert.ok(page.includes('id="mtpTargetTotal"'), 'target total element exists');
  assert.ok(page.includes('id="mtpTargetLine"'), 'figures line element exists');
  assert.ok(page.includes('id="mtpTargetRemaining"'), 'remaining element exists');
  assert.ok(page.includes('data-i18n="dash_monthtarget_title"'), 'line title is translated');
  assert.ok(page.includes('data-i18n="dash_monthtarget_sub"'), 'line subtitle is translated');
  assert.ok(page.includes('Month target progress'), 'line title reads Month target progress');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-month-target.js?v=1.11.0'"), 'dashboard imports the month-target module at the pinned version');
  assert.ok(app.includes('renderMonthTarget(document, calculateMonthTargetProgress(state, referenceDate, storageAvailable ? localStorage : null))'), 'renderDashboard fills the line from the state and the saved target record');
});

test('i18n: every dash_monthtarget_ key used exists in English and Urdu, with Urdu script in the Urdu value', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-month-target.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_monthtarget_[a-z_]+)"/g)) used.add(match[1]);
  // The line and remaining keys sit inside t() calls in the
  // module, not directly after t(' — so the module scan takes
  // every quoted key.
  for (const match of module.matchAll(/'(dash_monthtarget_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 7, `expected at least 7 month-target keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
    assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur[key]), `Urdu value of ${key} carries no Urdu script`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-month-target.js', import.meta.url), 'utf8');
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
