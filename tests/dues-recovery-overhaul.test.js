// Dues Recovery Overhaul (2026-11-12): the Collect tab's Smart Dues
// Recovery queue renders first at the top (the 20+ home operational
// cards no longer sit above it), with a summary bar, a sticky
// search/mohalla/priority filter row, a fixed priority calculation
// (arrears, 2+ unpaid bills or an overdue Waada force High at the
// 75-point floor), actionable health tags instead of "Health:
// Insufficient history", compact cards (Collect / Waada / History +
// a 50/50 WhatsApp row), Pakistani-number normalisation for WhatsApp
// links, an inline Add Phone on the card, a hidden LOWEST UPTIME
// list at 100% uptime, FAB clearance, and a wrapping header subtitle.
//
// Fixture data only — pattern-fake phones (03001234567 family), no
// real customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment, setManualBaqayaOutstanding } from '../core.js';
import {
  buildSmartDuesRecovery, recoveryHealthTag, recoveryMohallaRank, RECOVERY_MOHALLA_ORDER,
} from '../owner-insights.js';
import { normalisePakistanWhatsAppNumber } from '../profile-ui.js';
import { TRANSLATIONS } from '../nav-language.js';

const today = new Date('2026-11-10T12:00:00+05:00');
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const ui = read('owner-ui.js');
const index = read('index.html');
const styles = read('styles.css');
const routerCss = read('screen-router.css');
const app = read('app.js');
const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;
const URDU = /[\u0600-\u06FF]/;

function rowFor(result, customerId) {
  return result.groups.flatMap((group) => group.customers).find((row) => row.customerId === customerId);
}
function bill(state, id, month, amount, dueDay = '05') {
  return saveBillMonth(state, id, { month, dueAmount: String(amount), status: 'pending', dueDate: `${month}-${dueDay}` }, today);
}

// --- Priority floor -----------------------------------------------------

test('overhaul floor: previous-month arrears raise a low raw score to 75 High', () => {
  let state = createInitialState(['Arrears One']);
  state = bill(state, 'seed-001', '2026-09', 1000);
  const result = buildSmartDuesRecovery(state, today);
  const row = rowFor(result, 'seed-001');
  assert.equal(row.priorityScore, 75);
  assert.equal(row.group, 'High Priority');
  assert.equal(row.highPriorityFloor, true);
  assert.ok(row.reasons.some((reason) => reason.startsWith('High-priority floor:')));
  assert.ok(row.reasons.some((reason) => reason.includes('arrears from 2026-09')));
  assert.equal(row.oldestBillMonth, '2026-09');
});

test('overhaul floor: 2+ unpaid bills raise the score to 75 High', () => {
  // One bill per month per customer, so a second unpaid bill is
  // always from an earlier month — the two signals co-fire, and both
  // are spelled out on the row.
  let state = createInitialState(['Two Bills']);
  state = bill(state, 'seed-001', '2026-10', 1000);
  state = bill(state, 'seed-001', '2026-11', 1000);
  const result = buildSmartDuesRecovery(state, today);
  const row = rowFor(result, 'seed-001');
  assert.equal(row.priorityScore, 75);
  assert.equal(row.group, 'High Priority');
  assert.equal(row.highPriorityFloor, true);
  assert.ok(row.highPrioritySignals.includes('2 unpaid bills'));
  assert.ok(row.highPrioritySignals.includes('arrears from 2026-10'));
});

test('overhaul floor: an overdue Waada raises the score to 75 High; a future Waada does not', () => {
  let state = createInitialState(['Broken Waada', 'Future Waada', 'Due Today Waada']);
  state = bill(state, 'seed-001', '2026-11', 1000);
  state = bill(state, 'seed-002', '2026-11', 1000);
  state = bill(state, 'seed-003', '2026-11', 1000);
  state.customers[0].promiseDate = '2026-11-01';
  state.customers[1].promiseDate = '2026-11-20';
  state.customers[2].promiseDate = '2026-11-10';
  const result = buildSmartDuesRecovery(state, today);
  const broken = rowFor(result, 'seed-001');
  assert.equal(broken.waadaOverdue, true);
  assert.equal(broken.waadaDue, true);
  assert.equal(broken.priorityScore, 75);
  assert.equal(broken.group, 'High Priority');
  assert.ok(broken.highPrioritySignals.some((signal) => signal.startsWith('Waada overdue since 2026-11-01')));
  const future = rowFor(result, 'seed-002');
  assert.equal(future.waadaOverdue, false);
  assert.equal(future.waadaDue, false);
  assert.equal(future.highPriorityFloor, false);
  assert.equal(future.group, 'Low Priority');
  const dueToday = rowFor(result, 'seed-003');
  assert.equal(dueToday.waadaDue, true);
  assert.equal(dueToday.waadaOverdue, false);
  assert.equal(dueToday.highPriorityFloor, false);
  assert.equal(dueToday.group, 'Low Priority');
});

test('overhaul threshold: a 70-point score with no floor signal is Medium now, not High', () => {
  let state = createInitialState(['Seventy']);
  state.customers[0].monthlySellingAmount = 5000;
  state = bill(state, 'seed-001', '2026-11', 60000);
  for (let day = 6; day <= 10; day += 1) {
    state = addPayment(state, 'seed-001', '2026-11', { date: `2026-11-${String(day).padStart(2, '0')}`, amount: '100', method: 'Cash' }, today);
  }
  const result = buildSmartDuesRecovery(state, today);
  const row = rowFor(result, 'seed-001');
  assert.deepEqual(row.components, { amount: 30, overdue: 5, history: 10, latePayments: 15, customerValue: 10 });
  assert.equal(row.priorityScore, 70);
  assert.equal(row.group, 'Medium Priority');
  assert.equal(row.highPriorityFloor, false);
});

// --- Health tags ----------------------------------------------------------

test('overhaul health tags: months unpaid, arrears, regular payer, first month', () => {
  assert.deepEqual(recoveryHealthTag({ openBillCount: 1, longestOverdueDays: 5, health: { score: null }, latePaymentCount: 0 }), { tag: '1st Month Due', tone: 'info' });
  assert.deepEqual(recoveryHealthTag({ openBillCount: 2, longestOverdueDays: 5, health: { score: null }, latePaymentCount: 0 }), { tag: '2 Months Unpaid', tone: 'overdue' });
  assert.deepEqual(recoveryHealthTag({ openBillCount: 3, longestOverdueDays: 40, health: { score: 50 }, latePaymentCount: 1 }), { tag: '3 Months Unpaid', tone: 'overdue' });
  assert.deepEqual(recoveryHealthTag({ openBillCount: 1, longestOverdueDays: 45, health: { score: null }, latePaymentCount: 0 }), { tag: 'Overdue Arrears', tone: 'overdue' });
  assert.deepEqual(recoveryHealthTag({ openBillCount: 1, longestOverdueDays: 5, health: { score: 85 }, latePaymentCount: 0 }), { tag: 'Regular Payer', tone: 'paid' });
  assert.deepEqual(recoveryHealthTag({ openBillCount: 1, longestOverdueDays: 5, health: { score: 85 }, latePaymentCount: 2 }), { tag: '1st Month Due', tone: 'info' });
  assert.deepEqual(recoveryHealthTag({}), { tag: '1st Month Due', tone: 'info' });
});

// --- Arrears / current-month split ----------------------------------------

test('overhaul summary split: arrears and current month reconcile to the recoverable total', () => {
  let state = createInitialState(['Split A', 'Split B']);
  state = bill(state, 'seed-001', '2026-09', 1000);
  state = bill(state, 'seed-001', '2026-11', 1000);
  state = bill(state, 'seed-002', '2026-11', 2000);
  state = setManualBaqayaOutstanding(state, 'seed-002', { amount: 500, date: '2026-10-01', note: 'test baqaya' }, today);
  const result = buildSmartDuesRecovery(state, today);
  const a = rowFor(result, 'seed-001');
  assert.equal(a.arrearsCents, 100000);
  assert.equal(a.currentMonthCents, 100000);
  const b = rowFor(result, 'seed-002');
  assert.equal(b.arrearsCents, 50000);
  assert.equal(b.currentMonthCents, 200000);
  assert.equal(result.totalArrears, 1500);
  assert.equal(result.totalCurrentMonth, 3000);
  assert.equal(result.totalRecoverable, 4500);
  assert.equal(result.totalArrears + result.totalCurrentMonth, result.totalRecoverable);
});

// --- Numbered mohalla order -----------------------------------------------

test('overhaul mohalla order: the user\'s fixed 1–12 order, Haweli/End Point as one #12', () => {
  assert.equal(RECOVERY_MOHALLA_ORDER.length, 12);
  assert.deepEqual(RECOVERY_MOHALLA_ORDER.map((entry) => entry.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(RECOVERY_MOHALLA_ORDER.map((entry) => entry.label), ['CHARYAA', 'GANGALL', 'BARRIAN', 'CHAMYAA', 'MALLA', 'PALALIYAA', 'THALI', 'NAKAR', 'BANI', 'JABBIYAA', 'SODAA', 'HAWELI OR END POINT']);
  assert.equal(recoveryMohallaRank('CHARYAA').number, 1);
  assert.equal(recoveryMohallaRank('MOHALLA GANGALL').number, 2);
  assert.equal(recoveryMohallaRank('MOHALLA CHAMYAA').number, 4);
  assert.equal(recoveryMohallaRank('Bani').number, 9);
  assert.equal(recoveryMohallaRank('End Point').number, 12);
  assert.equal(recoveryMohallaRank('Haweli').number, 12);
  assert.equal(recoveryMohallaRank('MOHALLA end side farm house'), null);
  assert.equal(recoveryMohallaRank('KISHTII'), null);
  assert.equal(recoveryMohallaRank('PULL SIDE'), null);
  assert.equal(recoveryMohallaRank('MOHALLA CHUDRIYAA'), null);
  assert.equal(recoveryMohallaRank(''), null);
  assert.equal(recoveryMohallaRank('Somewhere Else'), null);
});

// --- Pakistani WhatsApp normalisation --------------------------------------

test('overhaul phone format: saved 03xx and 923xx numbers normalise to +92, anything else is untouched', () => {
  assert.equal(normalisePakistanWhatsAppNumber('03001234567'), '+923001234567');
  assert.equal(normalisePakistanWhatsAppNumber('0300-1234567'), '+923001234567');
  assert.equal(normalisePakistanWhatsAppNumber('0300 123 4567'), '+923001234567');
  assert.equal(normalisePakistanWhatsAppNumber('923001234567'), '+923001234567');
  assert.equal(normalisePakistanWhatsAppNumber('+923001234567'), '+923001234567');
  assert.equal(normalisePakistanWhatsAppNumber('0511234567'), '0511234567');
  assert.equal(normalisePakistanWhatsAppNumber('not-a-number'), 'not-a-number');
  assert.equal(normalisePakistanWhatsAppNumber(''), '');
});

// --- i18n -------------------------------------------------------------------

test('overhaul keys exist in EN and UR, with Urdu script in the Urdu values', () => {
  assert.equal(en.recovery_collect, '💰 Collect');
  assert.equal(en.recovery_waada, '🤝 Waada');
  assert.equal(en.recovery_history, '📜 History');
  assert.equal(en.recovery_send_whatsapp, '💬 Send WhatsApp');
  assert.equal(en.recovery_add_phone, '📞 + Add Phone');
  for (const key of ['recovery_collect', 'recovery_waada', 'recovery_history', 'recovery_send_whatsapp', 'recovery_add_phone']) {
    assert.ok(typeof ur[key] === 'string' && ur[key].length > 0, `missing UR value for ${key}`);
    assert.ok(URDU.test(ur[key]), `UR value for ${key} must carry Urdu script`);
  }
});

// --- Structure: panel first, summary bar, filter row -------------------------

test('overhaul structure: the recovery panel renders first on the recovery screen, with summary bar and filter row', () => {
  // The queue renders first at the top of the Collect screen because
  // the recovery screen isolates it: every other .report-pane child
  // is hidden (the #287 isolation), so DOM order among the hidden
  // siblings cannot push it down. The panel itself moved up from
  // last in the pane to before Smart Alerts.
  assert.ok(index.indexOf('id="duesRecoveryPanel"') < index.indexOf('id="smartAlertsPanel"'), 'recovery precedes smart alerts');
  assert.ok(styles.includes('#billingReportsView[data-report-screen="recovery"] .report-pane > :not(#duesRecoveryPanel)'), 'the recovery screen hides every other report-pane child');
  for (const id of ['recoverySummaryBar', 'recoverySearchInput', 'recoveryMohallaFilter', 'recoveryPriorityPills', 'duesRecoveryGroups']) {
    assert.ok(index.includes(`id="${id}"`), `${id} is present`);
  }
  assert.ok(index.includes('placeholder="Search name, #ID or phone"'), 'search covers name, #ID and phone');
  for (const pill of ['data-recovery-priority="all"', 'data-recovery-priority="High Priority"', 'data-recovery-priority="Medium Priority"', 'data-recovery-priority="Low Priority"', 'data-recovery-priority="waada"']) {
    assert.ok(index.includes(pill), `missing priority pill ${pill}`);
  }
  assert.ok(ui.includes('recoveryMohallaRank'), 'mohalla filter uses the numbered order');
  assert.ok(ui.includes('RECOVERY_MOHALLA_ORDER'), 'mohalla options come from the numbered order');
});

// --- Structure: compact cards, no empty groups -------------------------------

test('overhaul cards: Collect / Waada / History, health tag, WhatsApp row, no empty group boxes', () => {
  for (const attr of ['data-recovery-collect', 'data-recovery-waada', 'data-open-recovery-customer', 'data-recovery-template', 'data-recovery-draft', 'data-recovery-add-phone', 'data-recovery-phone-save', 'data-recovery-phone-cancel', 'data-recovery-phone-input']) {
    assert.ok(ui.includes(attr), `missing card wiring ${attr}`);
  }
  assert.ok(ui.includes("t('recovery_collect')"), 'Collect label is keyed');
  assert.ok(ui.includes("t('recovery_waada')"), 'Waada label is keyed');
  assert.ok(ui.includes("t('recovery_history')"), 'History label is keyed');
  assert.ok(ui.includes("t('recovery_send_whatsapp')"), 'Send WhatsApp label is keyed');
  assert.ok(ui.includes("t('recovery_add_phone')"), 'Add Phone label is keyed');
  assert.ok(ui.includes('Friendly reminder'), 'template list carries Friendly reminder');
  assert.ok(ui.includes('Urgent due'), 'template list carries Urgent due');
  assert.ok(ui.includes('Disconnection notice'), 'template list carries Disconnection notice');
  assert.ok(ui.includes('healthTag'), 'cards show the actionable health tag');
  // "Insufficient history" still exists in owner-ui.js for other
  // features (payment-health answers, lifetime-value estimates) —
  // the pin is that the recovery render never prints it.
  const recoveryRender = ui.slice(ui.indexOf('function renderRecoveryGroups'));
  assert.ok(!recoveryRender.includes('Insufficient history'), 'the recovery card never shows "Insufficient history"');
  assert.ok(!ui.includes('No recorded outstanding balances in this priority group.'), 'empty priority groups render nothing, not an empty box');
  assert.ok(ui.includes('whatsappPhoneFor(customer)'), 'drafts go to the WhatsApp number, not just the primary phone');
  assert.ok(ui.includes('validatePakistanPhone'), 'inline Add Phone validates like the receipt editor');
  assert.ok(ui.includes('receiptPhoneSaveField'), 'inline Add Phone saves to the field that produced the displayed number');
  assert.ok(ui.includes('updateCustomerProfile'), 'inline Add Phone saves through the canonical profile path');
  assert.ok(ui.includes('openCollect'), 'Collect opens through the host opener');
  assert.ok(ui.includes('openWaadaDialog'), 'Waada opens through the host opener');
  assert.ok(!ui.includes('window.open('), 'no window.open anywhere in the recovery render');
});

// --- Structure: home cards hidden, subtitle wraps, fleet, FAB ------------------

test('overhaul screen: home cards hide on the recovery screen and the subtitle wraps', () => {
  assert.ok(routerCss.includes('body[data-screen="recovery"] main > article.summary-card{display:none}'), 'home summary cards hide on the recovery screen');
  assert.ok(!/\.sr-screen-subtitle\s*\{[^}]*white-space:\s*nowrap/.test(routerCss), 'the screen subtitle no longer truncates on one line');
  assert.ok(routerCss.includes('-webkit-line-clamp: 2'), 'the subtitle wraps to at most two lines');
});

test('overhaul fleet: the LOWEST UPTIME list hides when every subscriber is at 100% uptime', () => {
  assert.ok(app.includes('fleetAllPerfect'), 'fleet render gates on the all-perfect condition');
  assert.ok(app.includes('fleet.perfectCount === fleet.includedCount'), 'all-perfect means perfectCount equals includedCount');
  assert.ok(app.includes("t('upt_fleet_lowest')"), 'the lowest-uptime heading still renders when not all perfect');
});

test('overhaul FAB clearance: the recovery panel clears the floating button at mobile widths', () => {
  assert.ok(styles.includes('#duesRecoveryPanel{padding-bottom:126px}'), 'the panel gets bottom clearance for the floating button');
  assert.ok(styles.includes('.recovery-amount{margin-right:48px}'), 'the right-hand amount keeps a safe margin from the floating button');
  assert.ok(styles.includes('.recovery-filter-row{position:sticky'), 'the filter row sticks while scrolling');
  assert.ok(styles.includes('.recovery-whatsapp-row select'), 'the WhatsApp row carries the template selector');
  assert.ok(styles.includes('.recovery-whatsapp{flex:1 1 50%'), 'the Send WhatsApp button takes half the WhatsApp row');
  assert.ok(styles.includes('.recovery-summary-bar{display:grid'), 'the summary bar renders as a stat grid');
  // Design-tokens ratchet: every hex on a recovery CSS line must
  // already occur on a non-recovery line (no new colour tokens).
  const styleLines = styles.split('\n');
  const isRecoveryLine = (line) => line.includes('.recovery-') || line.includes('#recovery') || line.includes('#duesRecovery');
  const regionHexes = [...new Set(styleLines.filter(isRecoveryLine).flatMap((line) => line.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []))];
  const otherHexes = new Set(styleLines.filter((line) => !isRecoveryLine(line)).flatMap((line) => line.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []));
  assert.ok(regionHexes.length > 0, 'recovery CSS lines found');
  assert.ok(regionHexes.every((hex) => otherHexes.has(hex)), `recovery CSS reuses only pre-existing hex tokens (new: ${regionHexes.filter((hex) => !otherHexes.has(hex)).join(', ')})`);
});

test('overhaul host wiring: app passes the Collect and Waada openers into the owner center', () => {
  assert.ok(app.includes('openCollect:'), 'setupOwnerCenter receives the Collect opener');
  assert.ok(app.includes('openWaadaDialog'), 'setupOwnerCenter receives the Waada opener');
  // Regression: the call site once passed the bare shorthand
  // `openWaadaDialog`, but no such identifier exists — the hoisted
  // function is named openGroupWaadaDialog, so boot threw a
  // ReferenceError, refreshOwnerCenter stayed a no-op, and the whole
  // recovery list rendered empty. And the function itself once lived
  // inside the `if (typeof document !== 'undefined')` block below,
  // where a block-scoped declaration is invisible at module top
  // level — so it now lives at module level (column 0), ahead of
  // this call, where both this call and the group flow can see it.
  assert.ok(app.includes('openWaadaDialog:openGroupWaadaDialog'), 'the Waada opener names the hoisted openGroupWaadaDialog function');
  assert.ok(!/setupOwnerCenter\(\{[^}]*,openWaadaDialog,/.test(app), 'no bare openWaadaDialog shorthand in the setupOwnerCenter call');
  assert.ok(app.includes('\nfunction openGroupWaadaDialog(customerId) {'), 'openGroupWaadaDialog is a module-level declaration, visible to the call site');
  assert.ok(app.indexOf('\nfunction openGroupWaadaDialog(customerId) {') < app.indexOf('refreshOwnerCenter = setupOwnerCenter({'), 'the declaration precedes the setupOwnerCenter call');
  assert.ok(app.includes('function openGroupWaadaDialog(customerId)'), 'one Waada dialog serves the group flow and the recovery card');
  assert.ok(app.includes('window.quickCollectModalController?.open?.(customerId)'), 'Collect opens the Quick Collect modal pre-filled for the customer');
});
