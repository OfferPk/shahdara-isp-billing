// SISP-180: Lock Due (15th+) 1-Tap Bulk WhatsApp "Final 24h
// Pre-Suspension Notice" Queue. Pure-function tests on synthetic data
// only; all dates injected (todayString) — never the wall clock.
//
// Pinned behaviour:
//   - The queue is EXACTLY the SISP-38 Lock Due set minus the customers
//     the MikroTik lock script itself spares (future Waada, vacation
//     hold), via the single predicate isPrelockNoticeEligible.
//   - A customer who pays in full drops out; FREE and archived
//     customers never appear.
//   - Each item's draft text carries the customer's real engine due
//     amount and its wa.me target is built by formatWhatsAppUrl (the
//     same normalizer the Reminders Today queue uses).
//   - The finalPrelockNotice catalogue template renders in both
//     variants with no raw placeholder left behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  isPrelockNoticeEligible,
  buildPrelockNoticeQueue,
  buildPrelockNoticeMessage,
  PRELOCK_NOTICE_TEMPLATE_ID,
  PRELOCK_NOTICE_STAGE
} from '../reminder-queue.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';
import {
  getWaTemplates,
  renderWaTemplateFor
} from '../whatsapp-templates.js';
import { normalizePakistaniWhatsAppPhone } from '../form-validation.js';
import { TRANSLATIONS } from '../nav-language.js';
import { createInitialState, saveBillMonth } from '../core.js';

const TODAY = '2026-10-16';
const REF = new Date(2026, 9, 16, 12);

const unpaid = (overrides = {}) => ({ id: 'c1', name: 'Test Defaulter', ...overrides });

// --- The eligibility predicate: one clause per exclusion -------------------

test('predicate: plain Lock Due customer is eligible', () => {
  assert.equal(isPrelockNoticeEligible(unpaid(), 3000, TODAY), true);
  assert.equal(isPrelockNoticeEligible(unpaid(), 1, TODAY), true);
});

test('predicate: Waada promises spare the customer (future, today; broken does not)', () => {
  assert.equal(isPrelockNoticeEligible(unpaid({ promiseDate: '2026-10-20' }), 3000, TODAY), false, 'future promise');
  assert.equal(isPrelockNoticeEligible(unpaid({ promiseDate: '2026-10-16' }), 3000, TODAY), false, 'promise dated today still snoozes (SISP-3 tier promised)');
  assert.equal(isPrelockNoticeEligible(unpaid({ promiseDate: '2026-10-10' }), 3000, TODAY), true, 'broken promise stays eligible');
});

test('predicate: vacation hold spares the customer in every hold state (lock-script rule)', () => {
  const active = unpaid({ paused: true, pauseStartDate: '2026-10-01' });
  const scheduled = unpaid({ paused: true, pauseStartDate: '2026-11-01' });
  const expired = unpaid({ paused: true, pauseStartDate: '2026-09-01', autoResumeDate: '2026-10-10' });
  assert.equal(isPrelockNoticeEligible(active, 3000, TODAY), false, 'active hold');
  assert.equal(isPrelockNoticeEligible(scheduled, 3000, TODAY), false, 'scheduled hold (generator skips any state !== none)');
  assert.equal(isPrelockNoticeEligible(expired, 3000, TODAY), false, 'expired-but-not-resumed hold (same generator rule)');
  assert.equal(isPrelockNoticeEligible(unpaid({ paused: false }), 3000, TODAY), true, 'no hold recorded');
});

test('predicate: paid-up, pre-15th and FREE customers are never eligible', () => {
  assert.equal(isPrelockNoticeEligible(unpaid(), 0, TODAY), false, 'nothing owed');
  assert.equal(isPrelockNoticeEligible(unpaid(), -100, TODAY), false);
  assert.equal(isPrelockNoticeEligible(unpaid(), 3000, '2026-10-12'), false, 'before the 15th: Final Notice stage, not Lock Due');
  assert.equal(isPrelockNoticeEligible(unpaid({ isFreeConnection: true }), 3000, TODAY), false, 'FREE connections owe nothing, ever');
  assert.equal(isPrelockNoticeEligible(null, 3000, TODAY), false);
});

// --- Queue construction over a real core state ------------------------------

const SAMPLE_NAMES = Array.from({ length: 8 }, (_, i) => `Test Customer ${String(i + 1).padStart(2, '0')}`);
const pricedBill = (state, customerId, dueAmount) =>
  saveBillMonth(state, customerId, { month: '2026-10', dueAmount, dueDate: '2026-10-05', status: 'pending' }, REF);
const patch = (state, customerId, fields) => ({
  ...state,
  customers: state.customers.map(c => c.id === customerId ? { ...c, ...fields } : c)
});

function queueState() {
  let state = createInitialState(SAMPLE_NAMES);
  state = pricedBill(state, 'seed-001', '3000'); // eligible
  state = pricedBill(state, 'seed-002', '5000'); // eligible, larger balance (sorts first)
  state = pricedBill(state, 'seed-003', '2000'); // future Waada -> excluded
  state = pricedBill(state, 'seed-004', '1500'); // vacation hold -> excluded
  state = pricedBill(state, 'seed-005', '2500'); // FREE -> excluded
  state = pricedBill(state, 'seed-006', '2500'); // archived -> excluded
  state = patch(state, 'seed-001', { phone: '0300-1112223', packageSpeed: '5 Mbps' });
  state = patch(state, 'seed-002', { phone: '0321-4445556', packageSpeed: '10 Mbps' });
  state = patch(state, 'seed-003', { phone: '0333-0001112', promiseDate: '2026-10-20' });
  state = patch(state, 'seed-004', { phone: '0333-0001113', paused: true, pauseStartDate: '2026-10-01' });
  state = patch(state, 'seed-005', { phone: '0333-0001114', isFreeConnection: true });
  state = patch(state, 'seed-006', { phone: '0333-0001115', archived: true });
  return state;
}

test('queue contains exactly the eligible Lock Due set (waada / paused / FREE / archived excluded)', () => {
  const { queue, totalCount, totalDuesPkr } = buildPrelockNoticeQueue(queueState(), { todayString: TODAY });
  assert.deepEqual(queue.map(i => i.customerId), ['seed-002', 'seed-001'], 'highest balance first');
  assert.equal(totalCount, 2);
  assert.equal(totalDuesPkr, 8000);
});

test('queue matches the Lock Due surface set once paused customers are spared', () => {
  const state = queueState();
  const surface = calculateTopDefaulters(state, {
    referenceDate: REF, limit: 0, escalation: 'lock-due'
  });
  // The modal's Lock Due filter lists seed-004 too (its row is badged
  // On Hold); the notice queue additionally applies the generator's
  // vacation-hold spare, so it is exactly the surface set minus held.
  assert.deepEqual(surface.accounts.map(a => a.id).sort(), ['seed-001', 'seed-002', 'seed-004']);
  const { queue } = buildPrelockNoticeQueue(state, { todayString: TODAY });
  assert.deepEqual(queue.map(i => i.customerId).sort(), ['seed-001', 'seed-002']);
});

test('a customer who pays in full drops out of the queue', () => {
  const before = buildPrelockNoticeQueue(queueState(), { todayString: TODAY });
  assert.equal(before.totalCount, 2);

  const paid = patch(queueState(), 'seed-001', {});
  const withPayment = {
    ...paid,
    customers: paid.customers.map(c => c.id === 'seed-001'
      ? { ...c, bills: c.bills.map(b => ({ ...b, payments: [{ id: 'pay-x1', date: '2026-10-16', amount: 3000, method: 'Cash' }] })) }
      : c)
  };
  const after = buildPrelockNoticeQueue(withPayment, { todayString: TODAY });
  assert.deepEqual(after.queue.map(i => i.customerId), ['seed-002']);
});

test('queue is empty before the 15th and for an empty state', () => {
  assert.equal(buildPrelockNoticeQueue(queueState(), { todayString: '2026-10-12' }).totalCount, 0);
  assert.deepEqual(buildPrelockNoticeQueue({ customers: [] }, { todayString: TODAY }).queue, []);
  assert.deepEqual(buildPrelockNoticeQueue(null, { todayString: TODAY }).queue, []);
});

// --- Draft text + wa.me target ----------------------------------------------

test('draft text carries the real engine amount; wa.me target uses the shared phone normalizer', () => {
  const { queue } = buildPrelockNoticeQueue(queueState(), { todayString: TODAY });
  const item = queue.find(i => i.customerId === 'seed-001');
  assert.ok(item, 'seed-001 queued');
  assert.equal(item.balance, 3000, 'engine outstanding, not a re-derived figure');
  assert.equal(item.daysOverdue, 11, 'due 5 Oct, reference 16 Oct — same rule as the Lock Due rows');
  assert.ok(item.messageText.includes('PKR 3,000'), 'real amount rendered into the notice');
  assert.ok(item.messageText.includes('24 ghanton'), '24-hour window wording present');
  assert.ok(!item.messageText.includes('{') && !item.messageText.includes('undefined'), 'no raw placeholder / undefined');

  const norm = normalizePakistaniWhatsAppPhone('0300-1112223');
  assert.equal(item.validPhone, true);
  assert.equal(item.normalizedPhone, norm.formattedPhone);
  assert.ok(item.whatsappUrl.startsWith(`https://wa.me/${norm.intlDigits}?text=`), 'wa.me target is the normalized number');
});

test('urdu variant renders the same figures through the bilingual name', () => {
  const { queue } = buildPrelockNoticeQueue(queueState(), { todayString: TODAY, variant: 'urdu' });
  const item = queue.find(i => i.customerId === 'seed-001');
  assert.ok(item.messageText.includes('PKR 3,000'));
  assert.ok(item.messageText.includes('24 گھنٹوں'));
  assert.ok(!item.messageText.includes('{') && !item.messageText.includes('undefined'));
});

test('catalogue template renders both variants with no placeholder left behind', () => {
  const templates = getWaTemplates(null);
  const cust = { name: 'Test Customer 01', customerNumber: 1, packageSpeed: '5 Mbps', phone: '03001112223' };
  for (const variant of ['roman', 'urdu']) {
    const out = renderWaTemplateFor(templates, PRELOCK_NOTICE_TEMPLATE_ID, cust, { totalDue: 4500 }, variant);
    assert.ok(out.includes('PKR 4,500'), `${variant} carries the amount`);
    assert.ok(!out.includes('{'), `${variant}: no raw placeholder`);
    assert.ok(!out.includes('undefined'), `${variant}: no undefined`);
  }
  const msg = buildPrelockNoticeMessage(cust, 4500, { templates });
  assert.ok(msg.includes('PKR 4,500'));
  assert.equal(PRELOCK_NOTICE_TEMPLATE_ID, 'finalPrelockNotice');
  assert.deepEqual({ ...PRELOCK_NOTICE_STAGE }, { id: 'prelock_final_24h', label: 'Final Pre-Lock Notice (24h)' });
});

// --- i18n mechanical audit ----------------------------------------------------

test('every prelock_* key used in code and markup exists in en and ur with placeholder parity', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const controller = fs.readFileSync(path.join(root, 'dashboard-top-defaulters.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  const usedKeys = new Set();
  for (const m of controller.matchAll(/t\('(prelock_[a-z_]+)'/g)) usedKeys.add(m[1]);
  for (const m of html.matchAll(/data-i18n="(prelock_[a-z_]+)"/g)) usedKeys.add(m[1]);
  assert.ok(usedKeys.size >= 8, `expected the prelock key family in use, found ${[...usedKeys].join(', ')}`);

  const placeholders = (s) => [...s.matchAll(/\{[a-z]+\}/g)].map(x => x[0]).sort();
  for (const key of usedKeys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder parity for ${key}`);
  }
});

// --- Markup / wiring ------------------------------------------------------------

test('markup + wiring: footer button, dialog, token CSS, app.js setup', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'components.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'dashboard-top-defaulters.js'), 'utf8');

  assert.match(html, /id="topDefaultersPrelockNoticeBtn"/, 'open button in the Top Defaulters footer');
  assert.match(html, /id="prelockNoticeModal"/, 'queue dialog present');
  assert.match(html, /id="prelockNoticeList"/, 'queue list host present');
  assert.match(html, /id="prelockNoticeLangSelect"/, 'language select present');
  // The button sits beside the Lock Due filter it pairs with.
  assert.ok(html.indexOf('id="topDefaultersLockDueBtn"') < html.indexOf('id="topDefaultersPrelockNoticeBtn"'));
  assert.ok(html.indexOf('id="topDefaultersPrelockNoticeBtn"') < html.indexOf('id="topDefaultersMikrotikLockBtn"'));

  assert.match(css, /\.prelock-row\s*\{/, 'row styles present');
  // Same comment-stripping the #230 ratchet applies ("#230" in a comment
  // is an issue number, not a colour).
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/.test(cssNoComments), 'components.css stays hex-free (token-only)');

  assert.match(controller, /export function setupPrelockNoticeDialog/, 'controller exported');
  assert.match(appJs, /setupPrelockNoticeDialog/, 'app.js wires the dialog');
  // No auto-send affordance may exist in the controller.
  assert.ok(!/send\s*all/i.test(controller.split('setupPrelockNoticeDialog')[1] || ''), 'no send-all path');
});
