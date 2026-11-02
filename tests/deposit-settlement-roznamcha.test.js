// SISP-195: Disconnection Deposit Settlement (SISP-50) Optional
// Roznamcha Cash Refund Outflow Bridge. Pure-function + wiring tests
// on synthetic data only. Spec test criterion: netDepositRefund =
// Rs. 800 creates one Rs. 800 Roznamcha outflow when the option is
// ticked, and the bridge is idempotent on reload.
//
// The bridge mirrors the SISP-56 house precedent (syncSaadPaymentLedgers):
// the settlement record carries the owner's choice as a stamp
// (roznamchaRefund === true), a convergent sync owns exactly ONE
// outflow per settlement under the deterministic id
// `deposit-refund-<customer id>`, a closed Roznamcha day is never
// mutated, and syncRoznamchaExpenses skips the bridge's outflows — a
// deposit was never income, so its refund is never an expense.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEPOSIT_REFUND_ROZNAMCHA_CATEGORY,
  applyDepositSettlement,
  buildDepositRefundOutflowNote,
  depositSettlementOf,
  sanitizeDepositSettlement,
  syncDepositRefundRoznamcha,
  syncedDepositRefundOutflowId
} from '../hardware-custody.js';
import {
  ROZNAMCHA_CATEGORIES,
  buildMonthEndCashInHand,
  buildRoznamchaDay,
  loadRoznamchaDays,
  saveRoznamchaDays,
  syncRoznamchaExpenses
} from '../roznamcha.js';
import {
  calculatePaymentAllocations,
  createInitialState,
  createJsonBackup,
  persistState,
  previewJsonBackupMerge,
  readState
} from '../core.js';
import { depositSettlementPresentation } from '../profile-ui.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const SETTLE_DATE = '2026-10-29';

// Engine arrears for one synthetic customer, exactly as app.js
// computes them at settle time (canonical allocation balances).
function engineArrears(customer) {
  const allocations = calculatePaymentAllocations({ customers: [customer] });
  let cents = 0;
  const billBalances = [];
  for (const bill of customer.bills ?? []) {
    const summary = allocations.forMonth(customer.id, bill.month);
    if (summary && typeof summary.balanceDueCents === 'number' && summary.balanceDueCents > 0) {
      cents += summary.balanceDueCents;
      billBalances.push({ month: bill.month, balanceDue: summary.balanceDueCents / 100 });
    }
  }
  return { arrears: cents / 100, billBalances };
}

// Same fixture shape as tests/deposit-settlement.test.js: deposit
// 2000, arrears 1200, all hardware recovered -> refund 800.
const disconnected = (overrides = {}) => ({
  id: 'cust-dep-1',
  customerNumber: 41,
  name: 'Test Customer 41',
  archived: true,
  archivedAt: '2026-10-05T10:00',
  securityDeposit: 2000,
  routerOwnership: 'isp-owned',
  mediaConverterOwnership: 'isp-owned',
  routerPrice: 1500,
  mediaConverterCost: 800,
  hardwareRecovered: { router: '2026-10-06', mediaConverter: '2026-10-06' },
  bills: [{ id: 'bill-sep', month: '2026-09', dueAmount: 1200, status: 'pending', payments: [] }],
  ...overrides
});

function settle(customer, options = {}) {
  const { arrears, billBalances } = engineArrears(customer);
  return applyDepositSettlement(customer, arrears, { date: SETTLE_DATE, billBalances, ...options });
}

function closedDay(date, outflows = []) {
  return {
    date, closed: true, outflows,
    openingBalance: 5000, cashIn: 0, shopIn: 0, cashPayments: [], handovers: [],
    expectedClosing: 5000, closingBalance: 5000, countedCash: 5000, discrepancy: 0
  };
}

test('spec criterion: ticked settlement (refund 800) records exactly one Rs. 800 outflow in the settlement day Roznamcha', () => {
  const settled = settle(disconnected(), { recordRoznamchaRefund: true });
  assert.equal(depositSettlementOf(settled)?.refundAmount, 800);
  assert.equal(depositSettlementOf(settled)?.roznamchaRefund, true);

  const customersBefore = JSON.stringify([settled]);
  const result = syncDepositRefundRoznamcha([], [settled]);
  assert.equal(JSON.stringify([settled]), customersBefore, 'sync never mutates the customer records');
  assert.equal(result.added, 1);
  assert.equal(result.daysChanged, true);
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].date, SETTLE_DATE);
  assert.equal(result.days[0].outflows.length, 1);
  const outflow = result.days[0].outflows[0];
  assert.equal(outflow.id, 'deposit-refund-cust-dep-1');
  assert.equal(outflow.id, syncedDepositRefundOutflowId('cust-dep-1'));
  assert.equal(outflow.amount, 800);
  assert.equal(outflow.category, 'Security Deposit Refund');
  assert.equal(outflow.category, DEPOSIT_REFUND_ROZNAMCHA_CATEGORY);
  assert.match(outflow.note, /Test Customer 41/);
  assert.match(outflow.note, /#41/);
});

test('the outflow moves the drawer through the real derivations: day expected closing and month-end closingCashInHand drop by exactly 800', () => {
  const settled = settle(disconnected(), { recordRoznamchaRefund: true });
  const state = { customers: [settled] };
  const { days } = syncDepositRefundRoznamcha([], [settled]);

  const baselineView = buildRoznamchaDay(state, [], SETTLE_DATE, []);
  const view = buildRoznamchaDay(state, days, SETTLE_DATE, []);
  assert.equal(view.outTotal, 800);
  assert.equal(baselineView.expectedClosing - view.expectedClosing, 800);

  const baselineCash = buildMonthEndCashInHand(state, [], '2026-10', []);
  const cash = buildMonthEndCashInHand(state, days, '2026-10', []);
  assert.equal(baselineCash.balance - cash.balance, 800);
});

test('unticked settlement is byte-identical to the pre-bridge record and writes no outflow', () => {
  const settled = settle(disconnected());
  const settlement = depositSettlementOf(settled);
  assert.ok(settlement);
  assert.equal('roznamchaRefund' in settlement, false);
  // The sanitized round trip is stable: no bridge key appears or moves.
  assert.deepEqual(sanitizeDepositSettlement(settlement), settlement);
  assert.equal(sanitizeDepositSettlement({ ...settlement, roznamchaRefund: false }).roznamchaRefund, undefined);

  const days = [];
  const result = syncDepositRefundRoznamcha(days, [settled]);
  assert.equal(result.changed, false);
  assert.equal(result.days, days, 'unchanged days keep the identical array reference');
});

test('the stamp survives persist/readState and a JSON backup merge, so a restore still converges', () => {
  const settled = settle(disconnected(), { recordRoznamchaRefund: true });
  const state = { ...createInitialState(), customers: [settled] };
  const data = new Map();
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  };
  persistState(state, storage);
  const restored = readState(storage);
  assert.equal(depositSettlementOf(restored.customers[0])?.roznamchaRefund, true);

  const backupText = createJsonBackup(state, new Date('2026-10-29T00:00:00Z'));
  assert.equal(JSON.parse(backupText).state.customers[0].depositSettlement.roznamchaRefund, true);
  const merged = previewJsonBackupMerge(createInitialState(), backupText);
  const mergedCustomer = (merged.state?.customers ?? []).find(c => c.id === settled.id);
  assert.equal(depositSettlementOf(mergedCustomer)?.roznamchaRefund, true);

  // And the restored record still produces its single outflow.
  const result = syncDepositRefundRoznamcha([], [mergedCustomer]);
  assert.equal(result.added, 1);
  assert.equal(result.days[0].outflows[0].amount, 800);
});

test('refund of 0: no stamp even when ticked, no checkbox label, no outflow', () => {
  const customer = disconnected({ securityDeposit: 1200 });
  const presentation = depositSettlementPresentation(customer, 1200);
  assert.equal(presentation.canSettle, true);
  assert.equal(presentation.roznamchaRefundLabel, '');

  const settled = settle(customer, { recordRoznamchaRefund: true });
  assert.equal(depositSettlementOf(settled)?.refundAmount, 0);
  assert.equal('roznamchaRefund' in depositSettlementOf(settled), false);
  const result = syncDepositRefundRoznamcha([], [settled]);
  assert.equal(result.changed, false);
  assert.deepEqual(result.days, []);
});

test('idempotency: re-running the sync and a save/load reload never duplicate the outflow', () => {
  const settled = settle(disconnected(), { recordRoznamchaRefund: true });
  const first = syncDepositRefundRoznamcha([], [settled]);
  const second = syncDepositRefundRoznamcha(first.days, [settled]);
  assert.equal(second.changed, false);
  assert.equal(second.days, first.days, 'second pass returns the identical array reference');
  assert.equal(second.days[0].outflows.length, 1);

  // Reload through the real Roznamcha storage path: the outflow must
  // survive sanitize-on-save (its category is a registered
  // ROZNAMCHA_CATEGORIES member), and syncing the reloaded days is
  // still a no-op.
  const data = new Map();
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  };
  saveRoznamchaDays(first.days, storage);
  const reloaded = loadRoznamchaDays(storage);
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].outflows.length, 1);
  assert.equal(reloaded[0].outflows[0].id, 'deposit-refund-cust-dep-1');
  assert.equal(reloaded[0].outflows[0].category, 'Security Deposit Refund');
  const third = syncDepositRefundRoznamcha(reloaded, [settled]);
  assert.equal(third.changed, false);
  assert.equal(third.days[0].outflows.length, 1);
});

test('the refund never becomes an expense: syncRoznamchaExpenses skips bridge outflows entirely', () => {
  const settled = settle(disconnected(), { recordRoznamchaRefund: true });
  const { days } = syncDepositRefundRoznamcha([], [settled]);
  const result = syncRoznamchaExpenses([], days, new Date('2026-10-29T00:00:00Z'));
  assert.equal(result.changed, false);
  assert.equal(result.expenses.length, 0);
  assert.ok(ROZNAMCHA_CATEGORIES.includes(DEPOSIT_REFUND_ROZNAMCHA_CATEGORY));
});

test('closed settlement day is never mutated: the refund is reported skipped, the settlement still stands', () => {
  const settled = settle(disconnected(), { recordRoznamchaRefund: true });
  const days = [closedDay(SETTLE_DATE)];
  const result = syncDepositRefundRoznamcha(days, [settled]);
  assert.equal(result.skippedClosed, 1);
  assert.equal(result.added, 0);
  assert.equal(result.daysChanged, false);
  assert.equal(result.days, days);
  assert.deepEqual(result.days[0], closedDay(SETTLE_DATE));
  // The settlement itself is unaffected by the skip — only the
  // drawer record is missing, exactly what the UI toast reports.
  assert.equal(depositSettlementOf(settled)?.refundAmount, 800);
});

test('an outflow already frozen into a closed day stays frozen, even if the settlement record later disappears', () => {
  const settled = settle(disconnected(), { recordRoznamchaRefund: true });
  const { days } = syncDepositRefundRoznamcha([], [settled]);
  const frozenOutflow = days[0].outflows[0];
  const frozen = [closedDay(SETTLE_DATE, [frozenOutflow])];

  const stillThere = syncDepositRefundRoznamcha(frozen, [settled]);
  assert.equal(stillThere.changed, false);
  assert.deepEqual(stillThere.days[0].outflows, [frozenOutflow]);

  const recordGone = syncDepositRefundRoznamcha(frozen, [disconnected()]);
  assert.equal(recordGone.changed, false);
  assert.equal(recordGone.removed, 0);
  assert.deepEqual(recordGone.days[0].outflows, [frozenOutflow]);
});

test('if the settlement record disappears (pre-settlement restore), the open-day outflow is removed exactly once', () => {
  const settled = settle(disconnected(), { recordRoznamchaRefund: true });
  const first = syncDepositRefundRoznamcha([], [settled]);
  const removed = syncDepositRefundRoznamcha(first.days, [{ ...settled, depositSettlement: null }]);
  assert.equal(removed.removed, 1);
  assert.equal(removed.days[0].outflows.length, 0);
  const again = syncDepositRefundRoznamcha(removed.days, [{ ...settled, depositSettlement: null }]);
  assert.equal(again.changed, false);
  assert.equal(again.removed, 0);
});

test('a drifted outflow is restored to the stamped refund; a settlement can never be settled twice', () => {
  const settled = settle(disconnected(), { recordRoznamchaRefund: true });
  const { days } = syncDepositRefundRoznamcha([], [settled]);
  const tampered = [{ ...days[0], outflows: [{ ...days[0].outflows[0], amount: 500 }] }];
  const repaired = syncDepositRefundRoznamcha(tampered, [settled]);
  assert.equal(repaired.updated, 1);
  assert.equal(repaired.days[0].outflows[0].amount, 800);

  // One-shot: the SISP-50 flow itself refuses a second settlement,
  // so the UI path can never fire the bridge twice for one deposit.
  assert.throws(() => settle(settled, { recordRoznamchaRefund: true }), /already settled/);
});

test('deterministic id + note helpers; presentation shows the checkbox label only when a refund is payable', () => {
  assert.equal(syncedDepositRefundOutflowId('cust-x'), 'deposit-refund-cust-x');
  assert.equal(buildDepositRefundOutflowNote(disconnected()), 'Security deposit refund · Test Customer 41 (#41)');

  const presentation = depositSettlementPresentation(disconnected(), 1200);
  assert.equal(presentation.canSettle, true);
  assert.match(presentation.roznamchaRefundLabel, /800/);
  assert.match(presentation.roznamchaRefundLabel, /Roznamcha/);
});

test('i18n: both bridge strings exist in en + ur with matching placeholders and render through t()', () => {
  for (const lang of ['en', 'ur']) {
    assert.equal(typeof TRANSLATIONS[lang].prof_dep_roznamcha_refund, 'string');
    assert.equal(typeof TRANSLATIONS[lang].prof_dep_roznamcha_closed, 'string');
    assert.match(TRANSLATIONS[lang].prof_dep_roznamcha_refund, /\{amount\}/);
  }
  const rendered = t('prof_dep_roznamcha_refund', 'en', { amount: 'PKR 800' });
  assert.match(rendered, /PKR 800/);
  assert.doesNotMatch(rendered, /\{amount\}/);
  assert.doesNotMatch(t('prof_dep_roznamcha_closed', 'ur'), /\{/);
});

test('wiring pins: checkbox in the settle section, stamp read at click time, sync passes in app.js, skip in roznamcha.js', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('id="profileDepositRoznamchaRefund"'), 'settle section renders the checkbox');
  assert.ok(app.includes("querySelector('#profileDepositRoznamchaRefund')"), 'settle handler reads the checkbox');
  assert.ok(app.includes('recordRoznamchaRefund'), 'settle handler passes the choice into applyDepositSettlement');
  assert.ok(app.includes('syncDepositRefundRoznamcha(loadRoznamchaDays(), state.customers ?? [])'), 'recordDepositRefundSync converges from live state');
  assert.ok(app.includes("t('prof_dep_roznamcha_closed')"), 'closed-day skip is surfaced to the owner');

  const profileUi = readFileSync(new URL('../profile-ui.js', import.meta.url), 'utf8');
  assert.ok(profileUi.includes("t('prof_dep_roznamcha_refund'"), 'presentation builds the checkbox label');
  assert.ok(profileUi.includes('quote.netDepositRefund > 0'), 'label is gated on a payable refund');

  const roznamcha = readFileSync(new URL('../roznamcha.js', import.meta.url), 'utf8');
  assert.ok(roznamcha.includes("outflow.id.startsWith('deposit-refund-')"), 'expense sync skips bridge outflows');
  assert.ok(roznamcha.includes("'Security Deposit Refund'"), 'refund category is registered');
});
