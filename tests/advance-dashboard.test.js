/**
 * advance-dashboard.test.js — Owner feature (2026-10-29): Dashboard
 * "Advance Held" KPI card + advance holders dialog data.
 *
 * The owner asked for the advance money to show on the Home dashboard.
 * The card headline is the advance HELD right now (unapplied credit
 * across all customers); the sub-line is the advance COLLECTED this
 * month (tagged receipts dated in the month). The dialog lists the
 * holders. This builder is presentation + aggregation only — the money
 * machinery is PR #488's (advance-payment.js + the core engine).
 *
 * Pins:
 *  - end-to-end pipeline scenario: two holders (one advance partially
 *    consumed by the generated November bill, one likewise), one
 *    VOIDED advance, one normal payer → the headline equals the
 *    hand-computed outstanding total (PKR 3,500), holders are exactly
 *    the two holders sorted by amount desc with name/mohalla/amount;
 *  - the this-month sub-line counts only this month's NON-VOIDED
 *    advance receipts (PKR 9,500: 4,500 + 5,000; the voided 4,000 and
 *    the ordinary October payments never count), and a different month
 *    argument yields 0 while the held figure is unchanged;
 *  - record-level pins on a raw ledger: an advance DATED last month is
 *    held but not "collected this month"; a voided advance is neither
 *    held (the allocation engine filters voided payments before
 *    allocating — core.js) nor collected;
 *  - empty / malformed states return zeros, never throw;
 *  - i18n: every new dashboard advance string exists in BOTH language
 *    dictionaries; wiring: card, dialog, build entry and styles.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, updateMohalla,
  generateMonthlyBillsThroughCurrentMonth, addPayment
} from '../core.js';
import { recordAdvancePayment, advanceBalanceCents } from '../advance-payment.js';
import { voidPayment } from '../payment-void-audit.js';
import { buildAdvanceDashboard } from '../advance-dashboard.js';
import { TRANSLATIONS } from '../nav-language.js';

const OCT_29 = new Date(2026, 9, 29, 12);
const NOV_2 = new Date(2026, 10, 2, 12);
const IDS = ['seed-001', 'seed-002', 'seed-003', 'seed-004'];

/**
 * Four synthetic customers, PKR 3,000/month, October 2026 bills paid in
 * full. Advances recorded 29 Oct: Holder One 4,500; Holder Two 5,000;
 * Voided Vic 4,000 (voided before November); Normal Payer none.
 * November bills are then generated, consuming 3,000 of each holder's
 * credit → held afterwards: Holder One 1,500, Holder Two 2,000.
 */
function pipelineState() {
  let state = createInitialState(['Holder One', 'Holder Two', 'Voided Vic', 'Normal Payer']);
  for (const id of IDS) {
    state = updateCustomerProfile(state, id, { monthlySellingAmount: '3000' }, OCT_29);
  }
  state = updateMohalla(state, 'seed-001', 'BARRIAN');
  state = updateMohalla(state, 'seed-002', 'GANGALL');
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  for (const id of IDS) {
    state = addPayment(state, id, '2026-10', { date: '2026-10-05', amount: '3000', method: 'Cash' }, OCT_29);
  }
  state = recordAdvancePayment(state, 'seed-001', { amount: 4500, date: '2026-10-29', method: 'Cash' }, OCT_29).nextState;
  state = recordAdvancePayment(state, 'seed-002', { amount: 5000, date: '2026-10-29', method: 'JazzCash' }, OCT_29).nextState;
  const vic = recordAdvancePayment(state, 'seed-003', { amount: 4000, date: '2026-10-29', method: 'Cash' }, OCT_29);
  state = vic.nextState;
  state = voidPayment(state, 'seed-003', '2026-10', vic.payment.id, { voidReason: 'Advance returned to customer' }).state;
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  return state;
}

test('headline equals the hand-computed outstanding advance after partial consumption', () => {
  const state = pipelineState();
  // Ground truth from the shipped per-customer figure (PR #488).
  assert.equal(advanceBalanceCents(state, 'seed-001'), 150000);
  assert.equal(advanceBalanceCents(state, 'seed-002'), 200000);
  assert.equal(advanceBalanceCents(state, 'seed-003'), 0, 'voided advance holds nothing');
  assert.equal(advanceBalanceCents(state, 'seed-004'), 0);
  const summary = buildAdvanceDashboard(state, '2026-10');
  assert.equal(summary.heldTotalCents, 350000, 'PKR 3,500 held in total');
  assert.equal(summary.heldTotalCents, IDS.reduce((sum, id) => sum + advanceBalanceCents(state, id), 0), 'headline is the sum of the per-customer balances');
});

test('holders dialog lists exactly the holders, amount descending, with name and mohalla', () => {
  const summary = buildAdvanceDashboard(pipelineState(), '2026-10');
  assert.deepEqual(summary.holders, [
    { customerId: 'seed-002', customerNumber: 2, customerName: 'Holder Two', mohalla: 'GANGALL', amountCents: 200000 },
    { customerId: 'seed-001', customerNumber: 1, customerName: 'Holder One', mohalla: 'BARRIAN', amountCents: 150000 }
  ]);
  assert.equal(summary.holders.reduce((sum, h) => sum + h.amountCents, 0), summary.heldTotalCents, 'dialog rows sum to the card total');
});

test('this-month sub-line counts only this month\'s non-voided advance receipts', () => {
  const state = pipelineState();
  // October intake: 4,500 + 5,000 tagged advances. The voided 4,000 is
  // excluded; the four ordinary 3,000 October payments are not advances.
  assert.equal(buildAdvanceDashboard(state, '2026-10').collectedThisMonthCents, 950000);
  // November saw no advance receipts; the held figure is month-independent.
  const november = buildAdvanceDashboard(state, '2026-11');
  assert.equal(november.collectedThisMonthCents, 0);
  assert.equal(november.heldTotalCents, 350000);
});

/** Raw ledger: no pipeline — the engine reads bills + payments directly. */
function rawState() {
  return {
    customers: [
      {
        id: 'c1', customerNumber: 7, name: 'Raw Holder', mohalla: 'NAKAR',
        bills: [{ month: '2026-10', dueAmount: 3000, payments: [
          { id: 'rp1', date: '2026-09-29', amount: 2000, method: 'Cash', kind: 'advance' },
          { id: 'rp2', date: '2026-10-05', amount: 3000, method: 'Cash' }
        ] }]
      },
      {
        id: 'c2', customerNumber: 8, name: 'Raw Voided', mohalla: '',
        bills: [{ month: '2026-10', dueAmount: 3000, payments: [
          { id: 'rv1', date: '2026-10-05', amount: 3000, method: 'Cash' },
          { id: 'rv2', date: '2026-10-20', amount: 4000, method: 'Cash', kind: 'advance', voided: true }
        ] }]
      }
    ]
  };
}

test('record-level: last month\'s advance is held but not collected this month; voided is neither', () => {
  const state = rawState();
  // c1: the 2,000 advance (29 Sep) + the 3,000 October payment settle
  // the 3,000 bill and leave 2,000 of unapplied credit — held now.
  // c2: the voided 4,000 advance is filtered by the allocation engine
  // before allocating, so it holds nothing.
  const october = buildAdvanceDashboard(state, '2026-10');
  assert.equal(october.heldTotalCents, 200000);
  assert.deepEqual(october.holders.map(h => h.customerId), ['c1']);
  assert.equal(october.holders[0].amountCents, 200000);
  // The only non-voided advance receipt is dated September.
  assert.equal(october.collectedThisMonthCents, 0);
  assert.equal(buildAdvanceDashboard(state, '2026-09').collectedThisMonthCents, 200000);
});

test('empty and malformed states return zeros and no holders', () => {
  for (const bad of [null, undefined, {}, { customers: [] }, { customers: [null, { id: 'x' }] }]) {
    const summary = buildAdvanceDashboard(bad, '2026-10');
    assert.equal(summary.heldTotalCents, 0);
    assert.equal(summary.collectedThisMonthCents, 0);
    assert.deepEqual(summary.holders, []);
  }
  // A malformed month argument never guesses a collected figure.
  assert.equal(buildAdvanceDashboard(rawState(), 'October').collectedThisMonthCents, 0);
  assert.equal(buildAdvanceDashboard(rawState()).collectedThisMonthCents, 0);
});

test('i18n: every dashboard advance string exists in both dictionaries', () => {
  const keys = ['dash_adv_held_label', 'dash_adv_month_sub', 'adv_hold_title', 'adv_hold_help', 'adv_hold_empty', 'adv_hold_total_label', 'adv_hold_close'];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  assert.ok(TRANSLATIONS.en.dash_adv_month_sub.includes('{amount}'));
  assert.ok(TRANSLATIONS.ur.dash_adv_month_sub.includes('{amount}'));
});

test('wiring: card, dialog, renderer and build entry are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="kpiCardAdvance"'), 'KPI card present');
  assert.ok(html.includes('id="kpiAdvanceHeld"'), 'held value hook present');
  assert.ok(html.includes('id="kpiAdvanceMonthSub"'), 'month sub-line hook present');
  assert.ok(html.includes('data-i18n="dash_adv_held_label"'), 'card label translated');
  assert.ok(html.includes('id="advanceHoldersModal"'), 'holders dialog present');
  assert.ok(html.includes('class="billing-modal advance-holders-modal"'), 'dialog uses the billing-modal shell (var(--modal-surface))');
  assert.ok(html.includes('id="advanceHoldersList"'), 'holders list hook present');
  assert.ok(html.includes('id="advanceHoldersTotal"'), 'dialog total hook present');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './advance-dashboard.js'"), 'app imports the builder');
  assert.ok(app.includes('buildAdvanceDashboard(state, totals.currentMonth)'), 'card renders from the builder');
  assert.ok(app.includes("t('dash_adv_month_sub'"), 'sub-line goes through t()');
  assert.ok(app.includes('openAdvanceHoldersDialog'), 'card tap opens the dialog');
  assert.ok(app.includes('selectCustomer(button.dataset.advHolderId)'), 'dialog row tap opens the profile');
  const build = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.ok(build.includes("'advance-dashboard.js'"), 'build ships the module');
  const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
  assert.ok(css.includes('grid-template-columns: repeat(5, minmax(0, 1fr))'), 'desktop strip fits five cards');
  const advanceCss = css.slice(css.indexOf('Dashboard Advance Held KPI card'));
  assert.ok(advanceCss.includes('.advance-holder-row'), 'holder row styles present');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(advanceCss), 'advance card/dialog styles use tokens only, no hex');
});
