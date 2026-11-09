import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import { calculateDashboardTodayCard } from '../dashboard-today-card.js';
import { calculateDailyClosingSummary } from '../dashboard-daily-closing.js';
import { getPendingCollectionCustomers } from '../nav-quick-collect.js';
import { dailyTargetProgress } from '../daily-target-progress.js';
import { setDayTarget } from '../day-target.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  calculateFieldRecoveryToday,
  renderFieldRecoveryTodayCard,
} from '../dashboard-field-recovery.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';

// Fake storage object, same shape the day-target helpers take —
// never the real localStorage, so tests stay hermetic.
function fakeStorage() {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
  };
}

// Mirror of the Plan 471 today-card fixture, extended with a
// second payment for one customer (two bills, one customer) so
// "customers visited" and "payments" can disagree.
function buildFixture() {
  let state = createInitialState([
    'Today Cust A',
    'Today Cust B',
    'Today Cust C',
    'Today Cust D',
    'Today Cust E',
    'Today Cust F',
    'Today Cust G',
    'Today Cust H',
  ]);
  const id = (index) => state.customers[index].id;

  // A: bill 2000 due today, paid 1500.50 today — 499.50 still due.
  state = saveBillMonth(state, id(0), { month: '2026-11', dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), '2026-11', { amount: 1500.50, date: TODAY, method: 'Cash' }, REF_DATE);
  // B: bill 1000 due today paid 400 today + bill 600 (Oct) paid 200
  // today — two receipts, one visited customer, 1000 still due.
  state = saveBillMonth(state, id(1), { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = saveBillMonth(state, id(1), { month: '2026-10', dueAmount: 600, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id(1), '2026-11', { amount: 400, date: TODAY, method: 'Cash' }, REF_DATE);
  state = addPayment(state, id(1), '2026-10', { amount: 200, date: TODAY, method: 'Cash' }, REF_DATE);
  // C: bill 3000 due today, nothing paid — 3000 still due.
  state = saveBillMonth(state, id(2), { month: '2026-11', dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  // D: bill 500 due today, paid in full today — visited, nothing due.
  state = saveBillMonth(state, id(3), { month: '2026-11', dueAmount: 500, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(3), '2026-11', { amount: 500, date: TODAY, method: 'Cash' }, REF_DATE);
  // E: bill 800 due tomorrow, paid 700 yesterday — 100 still due,
  // but neither figure counts for today.
  state = saveBillMonth(state, id(4), { month: '2026-11', dueAmount: 800, status: 'pending', dueDate: '2026-11-09' }, REF_DATE);
  state = addPayment(state, id(4), '2026-11', { amount: 700, date: '2026-11-07', method: 'Cash' }, REF_DATE);
  // F: bill 1200 due 6 Nov, paid 200 today then voided — voided is
  // history, never collected cash, and the 1200 stays due.
  state = saveBillMonth(state, id(5), { month: '2026-11', dueAmount: 1200, status: 'pending', dueDate: '2026-11-06' }, REF_DATE);
  state = addPayment(state, id(5), '2026-11', { amount: 200, date: TODAY, method: 'Cash' }, REF_DATE);
  state.customers[5].bills.find((b) => b.month === '2026-11').payments[0].voided = true;
  // G: bill 900 due today, paid 400 today — then archived, so the
  // card never shows this customer.
  state = saveBillMonth(state, id(6), { month: '2026-11', dueAmount: 900, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(6), '2026-11', { amount: 400, date: TODAY, method: 'Cash' }, REF_DATE);
  state.customers[6].archived = true;
  // H: an unpriced bill due today carries no amount — nothing is due.
  state.customers[7].bills.push({
    id: 'bill-today-unpriced',
    month: '2026-11',
    dueAmount: null,
    status: 'pending',
    dueDate: TODAY,
    payments: [],
  });
  return state;
}

// Minimal fake document for the render function: the card is found
// by class, its fields by class — no element ids are introduced.
function fakeDoc() {
  const els = {};
  const make = () => ({ textContent: '', style: {}, setAttribute() {} });
  const card = { querySelector: (sel) => (els[sel] ??= make()) };
  return {
    card,
    els,
    querySelector: (sel) => (sel === '.qc5-field-recovery-card' ? card : null),
  };
}

test('QC-5: collected and payment count match the existing today card (same source, no second truth)', () => {
  const state = buildFixture();
  const todayCard = calculateDashboardTodayCard(state, REF_DATE);
  const summary = calculateFieldRecoveryToday(state, REF_DATE, fakeStorage());
  assert.equal(summary.today, TODAY);
  assert.equal(summary.todayCollectedCents, 260050);
  assert.equal(summary.todayCollectedCents, todayCard.todayCollectedCents);
  assert.equal(summary.todayPaymentCount, 4);
  assert.equal(summary.todayPaymentCount, todayCard.todayPaymentCount);
});

test('QC-5: customers visited counts distinct customers, not receipts', () => {
  const state = buildFixture();
  const summary = calculateFieldRecoveryToday(state, REF_DATE, fakeStorage());
  // A paid once, B paid twice (two bills), D paid once: 4 receipts
  // from 3 customers. Voided F and archived G never count.
  assert.equal(summary.todayPaymentCount, 4);
  assert.equal(summary.customersVisitedCount, 3);
  const daily = calculateDailyClosingSummary(state, REF_DATE, { selectedDate: TODAY });
  const distinct = new Set(daily.receipts.map((r) => r.customerId).filter(Boolean)).size;
  assert.equal(summary.customersVisitedCount, distinct);
});

test('QC-5: yesterday payments, voided payments and archived customers never count as visited', () => {
  const state = buildFixture();
  const summary = calculateFieldRecoveryToday(state, REF_DATE, fakeStorage());
  assert.equal(summary.todayCollectedCents, 260050);
  assert.equal(summary.customersVisitedCount, 3);
});

test('QC-5: pending customers and pending dues agree with the QC picker pool', () => {
  const state = buildFixture();
  const summary = calculateFieldRecoveryToday(state, REF_DATE, fakeStorage());
  const pool = getPendingCollectionCustomers(state, '', 'all-dues', REF_DATE);
  assert.equal(summary.pendingCustomersCount, 5);
  assert.equal(summary.pendingCustomersCount, pool.length);
  const poolCents = pool.reduce((sum, e) => sum + Math.round(e.totalDues * 100), 0);
  assert.equal(summary.pendingDuesCents, 579950);
  assert.equal(summary.pendingDuesCents, poolCents);
});

test('QC-5: operator day target is reused, remaining and progress follow it', () => {
  const state = buildFixture();
  const storage = fakeStorage();
  setDayTarget(storage, TODAY, 5000);
  const summary = calculateFieldRecoveryToday(state, REF_DATE, storage);
  assert.equal(summary.operatorTargetCents, 500000);
  assert.equal(summary.targetSource, 'operator');
  assert.equal(summary.targetCents, 500000);
  assert.equal(summary.remainingCents, 239950);
  assert.equal(summary.progressPct, 52);
  assert.equal(summary.targetReached, false);
});

test('QC-5: with no operator target the target is today\'s pending dues at day start', () => {
  const state = buildFixture();
  const summary = calculateFieldRecoveryToday(state, REF_DATE, fakeStorage());
  assert.equal(summary.operatorTargetCents, null);
  assert.equal(summary.targetSource, 'pending');
  // Pending now (5799.50) + collected today (2600.50) = 8400.00:
  // everything the field team could recover today.
  assert.equal(summary.targetCents, 840000);
  // Remaining is exactly what is still pending now.
  assert.equal(summary.remainingCents, 579950);
  assert.equal(summary.progressPct, 31);
});

test('QC-5: over-target clamps the bar at 100 and the remaining at zero', () => {
  const state = buildFixture();
  const storage = fakeStorage();
  setDayTarget(storage, TODAY, 2000);
  const summary = calculateFieldRecoveryToday(state, REF_DATE, storage);
  assert.equal(summary.remainingCents, 0);
  assert.equal(summary.progressPct, 100);
  assert.equal(summary.targetReached, true);
});

test('QC-5: progress and remaining match the existing daily-target-progress rule on whole rupees', () => {
  let state = createInitialState(['Today Cust A']);
  const id = state.customers[0].id;
  state = saveBillMonth(state, id, { month: '2026-11', dueAmount: 4000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id, '2026-11', { amount: 1000, date: TODAY, method: 'Cash' }, REF_DATE);
  const storage = fakeStorage();
  setDayTarget(storage, TODAY, 4000);
  const summary = calculateFieldRecoveryToday(state, REF_DATE, storage);
  const rule = dailyTargetProgress(1000, 4000);
  assert.equal(summary.progressPct, rule.progressPct);
  assert.equal(summary.remainingCents, rule.remaining * 100);
});

test('QC-5: an empty day reads zero everywhere, never a blank or a negative', () => {
  const state = createInitialState(['Today Cust A']);
  const summary = calculateFieldRecoveryToday(state, REF_DATE, fakeStorage());
  assert.equal(summary.todayCollectedCents, 0);
  assert.equal(summary.todayPaymentCount, 0);
  assert.equal(summary.customersVisitedCount, 0);
  assert.equal(summary.pendingCustomersCount, 0);
  assert.equal(summary.pendingDuesCents, 0);
  assert.equal(summary.targetCents, 0);
  assert.equal(summary.progressPct, 0);
  assert.equal(summary.remainingCents, 0);
  assert.equal(summary.targetReached, false);
});

test('QC-5: render fills every figure and the progress bar from one summary', () => {
  const doc = fakeDoc();
  const summary = calculateFieldRecoveryToday(buildFixture(), REF_DATE, fakeStorage());
  renderFieldRecoveryTodayCard(doc, summary);
  assert.equal(doc.els['.qc5-recovered'].textContent, 'PKR 2,600.50');
  assert.equal(doc.els['.qc5-target'].textContent, 'PKR 8,400');
  assert.equal(doc.els['.qc5-payments'].textContent, '4');
  assert.equal(doc.els['.qc5-visited'].textContent, '3');
  assert.equal(doc.els['.qc5-remaining'].textContent, 'PKR 5,799.50');
  assert.equal(doc.els['.qc5-pending'].textContent, '5');
  assert.equal(doc.els['.qc5-progress-fill'].style.width, '31%');
  assert.match(doc.els['.qc5-progress-text'].textContent, /PKR 2,600\.50/);
  assert.match(doc.els['.qc5-progress-text'].textContent, /31%/);
});

test('QC-5: render says plainly when nothing is pending today', () => {
  const doc = fakeDoc();
  const state = createInitialState(['Today Cust A']);
  renderFieldRecoveryTodayCard(doc, calculateFieldRecoveryToday(state, REF_DATE, fakeStorage()));
  assert.equal(doc.els['.qc5-progress-fill'].style.width, '0%');
  assert.match(doc.els['.qc5-progress-text'].textContent, /Nothing pending today/);
});

test('QC-5: render tolerates a missing card and a missing summary', () => {
  assert.doesNotThrow(() => renderFieldRecoveryTodayCard({ querySelector: () => null }, calculateFieldRecoveryToday(buildFixture(), REF_DATE, fakeStorage())));
  assert.doesNotThrow(() => renderFieldRecoveryTodayCard(fakeDoc(), null));
  assert.doesNotThrow(() => renderFieldRecoveryTodayCard(null, null));
});

test('QC-5 pin: the card markup sits in the summary grid right after the today card', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('qc5-field-recovery-card'), 'recovery card article missing');
  assert.ok(page.indexOf('summary-today-card') < page.indexOf('qc5-field-recovery-card'), 'card must sit after the today card');
  for (const key of ['qc5_payments_label', 'qc5_visited_label', 'qc5_remaining_label', 'qc5_pending_label']) {
    assert.ok(page.includes(`data-i18n="${key}"`), `tile label ${key} missing`);
  }
  assert.ok(page.includes('qc5-progress-track'), 'progress track missing');
  assert.ok(page.includes('role="progressbar"'), 'progress bar role missing');
});

test('QC-5 pin: app wires the new module at the pinned version next to the today card', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-field-recovery.js?v=1.11.0'"), 'module import missing or unpinned');
  assert.ok(app.includes('calculateFieldRecoveryToday'), 'calculate import missing');
  assert.ok(app.includes('renderFieldRecoveryTodayCard'), 'render import missing');
  assert.ok(app.includes('renderFieldRecoveryTodayCard(document, calculateFieldRecoveryToday(state, referenceDate,'), 'render call missing');
});

test('QC-5 pin: every qc5_ key exists in EN and UR, and the UR values carry Urdu script', () => {
  const keys = [
    'qc5_card_title', 'qc5_target_label', 'qc5_target_source_operator',
    'qc5_target_source_pending', 'qc5_progress_text', 'qc5_nothing_pending',
    'qc5_payments_label', 'qc5_visited_label', 'qc5_remaining_label',
    'qc5_pending_label', 'qc5_progress_aria',
  ];
  for (const key of keys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `en.${key} missing`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `ur.${key} missing`);
    assert.match(TRANSLATIONS.ur[key], /[\u0600-\u06FF]/, `ur.${key} must carry Urdu script`);
  }
});

test('QC-5 pin: dashboard.css carries the card rules with tokens only — no new hex, no hard-coded scale sizes', () => {
  const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
  const start = css.indexOf('.qc5-field-recovery-card');
  assert.ok(start >= 0, 'card CSS missing');
  const block = css.slice(start);
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block), 'new card CSS must not introduce hex colours');
  assert.ok(!/font-size:\s*(10|12|14|16|20|24|32)px/.test(block), 'new card CSS must use type tokens, not hard-coded sizes');
  const distinct = new Set(css.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.ok(distinct.size <= 87, `dashboard.css has ${distinct.size} distinct hex colours, Plan A cap is 87`);
});

test('QC-5 pin: the module is pure — no clock, no storage access, no new store key', () => {
  const raw = readFileSync(new URL('../dashboard-field-recovery.js', import.meta.url), 'utf8');
  // Comments describe the design (they name localStorage as the
  // caller's storage); the pin applies to code, so strip them first.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  assert.doesNotMatch(src, /new Date\(/, 'module must not read the clock');
  assert.doesNotMatch(src, /Date\.now\(/, 'module must not read the clock');
  assert.doesNotMatch(src, /localStorage/, 'storage arrives as a parameter, never read directly');
  assert.doesNotMatch(src, /setItem\(/, 'module never writes storage');
  assert.doesNotMatch(src, /shahdara_/, 'no new store key — the day-target module owns its key');
});
