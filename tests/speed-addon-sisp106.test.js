// SISP-106 — Temporary Bandwidth Boost / Add-On Micro-Billing.
//
// The boost log lives on the customer record (customer.speedBoosts,
// sanitized in core readState); the fee is a one-time charge that
// settles through Quick Collect ONLY, stamped on the settling payment
// as payment.addonCharges — the SISP-43 ticket-charge lineage. The
// core allocation engine, billing-cycle FIFO and Khata Doctor all
// EXCLUDE the stamped portion from bill money, so the base package
// price and the bill are never touched by a boost.
//
// Spec pin: a 10-day 15 Mbps boost (Rs 500) on a Rs 2,000 customer
// keeps packagePrice 2000, adds Rs 500 to current dues, and flags
// expiry once expiryDate < today.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  calculatePaymentAllocations,
  correctPayment,
  createInitialState,
  deletePayment,
  monthFeeTakenCents,
  persistState,
  readState,
  sanitizeSpeedBoosts,
  saveBillMonth,
  validatePayment
} from '../core.js';
import {
  addSpeedBoost,
  addonChargesPending,
  boostDateKey,
  createSpeedBoost,
  isSpeedBoostExpired,
  pendingAddonChargeLines,
  planAddonChargeSettlement,
  settleAddonCharges,
  speedBoostStatus,
  speedBoostsOf,
  unsettleAddonChargesForPayment
} from '../speed-addon.js';
import {
  executeQuickCollection,
  formatQuickCollectWhatsAppReceipt,
  getCustomerPaymentDefaults,
  renderQuickCollectReceiptCardHtml
} from '../nav-quick-collect.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { buildEscPosReceipt, escPosFieldsFromPaymentReceipt } from '../thermal-printer.js';
import { voidPayment } from '../payment-void-audit.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import { fifoAllocationForPayment } from '../billing-cycle.js';
import { buildSpeedBoostRestoreSnippet, buildSpeedBoostSnippet } from '../mikrotik-generator.js';
import { speedBoostProfileSectionHtml } from '../profile-ui.js';
import { t } from '../nav-language.js';

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key)
  };
}

function stateWithBill(fee = 2000) {
  const state = createInitialState([]);
  state.customers.push({
    id: 'cust-1',
    customerNumber: 101,
    name: 'Synthetic Subscriber',
    phone: '03001234567',
    area: 'Test Area',
    archived: false,
    packageSpeed: '5 Mbps',
    monthlySellingAmount: fee,
    bills: []
  });
  return saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount: fee, status: 'pending' }, REF);
}

const BOOST = { boostMbps: 15, durationDays: 10, addonFeePKR: 500, startDate: '2026-10-05' };

function stateWithBoost() {
  const { state } = addSpeedBoost(stateWithBill(2000), 'cust-1', BOOST, REF);
  return state;
}

// ── Spec pin ────────────────────────────────────────────────────────

test('SPEC PIN: 10-day 15 Mbps boost (Rs 500) on a Rs 2,000 customer — packagePrice stays 2000, dues +500, expiry flags after expiryDate', () => {
  const state = stateWithBoost();
  const customer = state.customers[0];
  const boost = speedBoostsOf(customer)[0];

  // Base package and bill untouched.
  assert.equal(customer.monthlySellingAmount, 2000);
  assert.equal(customer.packageSpeed, '5 Mbps');
  assert.equal(customer.bills.find((b) => b.month === MONTH).dueAmount, 2000);
  assert.equal(addonChargesPending(customer), 500);

  // Logged with the derived expiry: start + durationDays.
  assert.equal(boost.boostId, 'BST-101');
  assert.equal(boost.boostMbps, 15);
  assert.equal(boost.durationDays, 10);
  assert.equal(boost.addonFeePKR, 500);
  assert.equal(boost.startDate, '2026-10-05');
  assert.equal(boost.expiryDate, '2026-10-15');
  assert.equal(boost.chargePaid, false);

  // Current dues = bill 2000 + boost fee 500 on the collect surface.
  const defaults = getCustomerPaymentDefaults(state, 'cust-1', REF, []);
  assert.equal(defaults.totalDues, 2000);
  assert.equal(defaults.addonChargesPending, 500);
  assert.equal(defaults.payableTotal, 2500);
  assert.equal(defaults.suggestedAmount, 2500);

  // Expiry is DERIVED live: the boost still covers its expiry day and
  // is flagged only once expiryDate < today (injectable clock).
  assert.equal(isSpeedBoostExpired(boost, '2026-10-15'), false);
  assert.equal(speedBoostStatus(boost, '2026-10-15'), 'active');
  assert.equal(isSpeedBoostExpired(boost, '2026-10-16'), true);
  assert.equal(speedBoostStatus(boost, '2026-10-16'), 'expired');
  assert.equal(speedBoostStatus(boost, '2026-10-01'), 'upcoming');
  assert.equal(speedBoostStatus(boost, '2026-10-05'), 'active');
});

// ── Log storage: sanitizing + backup travel ─────────────────────────

test('boost log: readState round-trips boosts; legacy customers load with none; corrupt entries drop', () => {
  const storage = memoryStorage();
  persistState(stateWithBoost(), storage);
  const restored = readState(storage);
  const boosts = speedBoostsOf(restored.customers[0]);
  assert.equal(boosts.length, 1);
  assert.equal(boosts[0].boostId, 'BST-101');
  assert.equal(boosts[0].addonFeePKR, 500);

  const legacyStorage = memoryStorage();
  persistState(stateWithBill(2000), legacyStorage);
  assert.deepEqual(speedBoostsOf(readState(legacyStorage).customers[0]), []);

  const dirty = sanitizeSpeedBoosts([
    { boostId: 'BST-101', boostMbps: 15, durationDays: 10, addonFeePKR: 500, startDate: '2026-10-05', expiryDate: '2026-10-15' },
    { boostId: 'BST-101', boostMbps: 99, durationDays: 1, addonFeePKR: 1, startDate: '2026-10-06', expiryDate: '2026-10-07' }, // duplicate id
    { boostId: 'XXX-1', boostMbps: 15, durationDays: 10, addonFeePKR: 500, startDate: '2026-10-05', expiryDate: '2026-10-15' }, // bad id
    { boostId: 'BST-102', boostMbps: 0, durationDays: 10, addonFeePKR: 500, startDate: '2026-10-05', expiryDate: '2026-10-15' }, // zero speed
    { boostId: 'BST-103', boostMbps: 15, durationDays: 10, addonFeePKR: 500, startDate: '2026-02-30', expiryDate: '2026-10-15' }, // impossible date
    'junk'
  ]);
  assert.equal(dirty.length, 1);
  assert.equal(dirty[0].boostId, 'BST-101');
});

test('createSpeedBoost derives expiryDate (leap-aware) and rejects bad input', () => {
  const nobody = { id: 'cust-x', speedBoosts: [] };
  assert.equal(createSpeedBoost(nobody, { ...BOOST, startDate: '2028-02-28', durationDays: 2 }).expiryDate, '2028-03-01');
  assert.equal(boostDateKey(new Date('2026-01-02T03:04:05Z')), '2026-01-02');
  assert.throws(() => createSpeedBoost(nobody, { ...BOOST, boostMbps: 0 }), /valid boost speed/);
  assert.throws(() => createSpeedBoost(nobody, { ...BOOST, durationDays: 0 }), /whole number of days/);
  assert.throws(() => createSpeedBoost(nobody, { ...BOOST, addonFeePKR: 0 }), /valid add-on fee/);
  assert.throws(() => createSpeedBoost(nobody, { ...BOOST, startDate: '2026-13-01' }), /valid boost start date/);
});

// ── Settlement through Quick Collect ────────────────────────────────

test('full collect settles boost + bill: stamp on the payment, boost marked paid, no phantom advance credit', () => {
  const { nextState, receipt } = executeQuickCollection(stateWithBoost(), {
    customerId: 'cust-1', month: MONTH, amount: 2500, date: '2026-10-15', method: 'Cash', tickets: []
  }, REF);
  const customer = nextState.customers[0];
  const bill = customer.bills.find((b) => b.month === MONTH);
  const payment = bill.payments[0];

  assert.deepEqual(payment.addonCharges, [{ boostId: 'BST-101', amount: 500 }]);
  assert.deepEqual(receipt.addonCharges, [{ boostId: 'BST-101', amount: 500 }]);
  assert.equal(receipt.addonChargesTotal, 500);
  assert.equal(receipt.addonChargesPending, 0);
  assert.equal(receipt.payableRemaining, 0);
  assert.equal(receipt.isSettled, true);
  assert.equal(receipt.newTotalDues, 0);

  const boost = speedBoostsOf(customer)[0];
  assert.equal(boost.chargePaid, true);
  assert.equal(boost.chargePaymentId, payment.id);
  assert.equal(boost.chargePaidAt, '2026-10-15');
  assert.equal(addonChargesPending(customer), 0);

  // The 500 is NOT bill money: no excess / advance credit is minted
  // from it, the package fee taken is exactly the 2,000 bill, and the
  // base package is unchanged.
  const allocations = calculatePaymentAllocations(nextState);
  const summary = allocations.forMonth('cust-1', MONTH);
  assert.equal(summary.balanceDueCents, 0);
  const ledger = allocations.byPaymentId.get(payment.id);
  assert.equal(ledger.addonChargeCents, 50000);
  assert.equal(ledger.unappliedCreditCents, 0);
  assert.equal(ledger.excessCents, 0);
  assert.equal(monthFeeTakenCents(customer, MONTH), 200000);
  assert.equal(customer.monthlySellingAmount, 2000);

  // Khata Doctor and the FIFO splitter agree with the engine.
  assert.equal(computeLedgerBalance(customer).balanceCents, 0);
  const fifo = fifoAllocationForPayment(customer, bill, payment.id);
  assert.equal(fifo.allocation.toArrears + fifo.allocation.toPackage, 2000);
});

test('receipts print the boost as its own line on every layout', () => {
  const { nextState, receipt } = executeQuickCollection(stateWithBoost(), {
    customerId: 'cust-1', month: MONTH, amount: 2500, date: '2026-10-15', method: 'Cash', tickets: []
  }, REF);
  const customer = nextState.customers[0];
  const bill = customer.bills.find((b) => b.month === MONTH);
  const built = buildPaymentReceipt(customer, bill, bill.payments[0]);

  assert.deepEqual(built.addonCharges, [{ boostId: 'BST-101', amount: 500 }]);
  assert.equal(built.addonChargesTotal, 500);
  assert.equal(built.paidAmount, 2500);
  assert.equal(built.status, 'PAID');
  assert.equal(built.balanceDueCents, 0);

  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(built, { format });
    assert.ok(html.includes('Speed Boost / سپیڈ بوسٹ (BST-101)'), `${format} prints the boost line`);
    assert.ok(html.includes('PKR 500'), `${format} prints the boost amount`);
    assert.ok(html.includes('PKR 2,500'), `${format} prints the total received`);
  }

  const pngModel = buildPngReceiptModel(built, customer);
  const boostLine = pngModel.financial.find((line) => line.label === 'Speed Boost / سپیڈ بوسٹ (BST-101)');
  assert.ok(boostLine, 'PNG model carries the boost line');
  assert.ok(boostLine.value.includes('500'));
  assert.equal(pngModel.seal.kind, 'PAID');

  const escpos = buildEscPosReceipt(escPosFieldsFromPaymentReceipt(built));
  assert.ok(escpos.text.includes('Boost (BST-101)'));
  assert.ok(escpos.text.includes('PKR 500'));

  const waQuick = formatQuickCollectWhatsAppReceipt(receipt);
  assert.ok(waQuick.text.includes('Speed Boost / سپیڈ بوسٹ (BST-101):* PKR 500'));
  assert.ok(waQuick.text.includes('PAID IN FULL'));

  const card = renderQuickCollectReceiptCardHtml(receipt);
  assert.ok(card.includes('Speed Boost / سپیڈ بوسٹ (BST-101)'));
});

test('settlement is plug-shaped: whole boosts only, oldest first, remainder after ALL bill dues', () => {
  let state = stateWithBoost();
  ({ state } = addSpeedBoost(state, 'cust-1', { boostMbps: 30, durationDays: 5, addonFeePKR: 700, startDate: '2026-10-20' }, REF));
  const customer = state.customers[0];
  assert.deepEqual(speedBoostsOf(customer).map((b) => b.boostId), ['BST-101', 'BST-102']);
  assert.deepEqual(pendingAddonChargeLines(customer), [
    { boostId: 'BST-101', amount: 500 },
    { boostId: 'BST-102', amount: 700 }
  ]);

  // 499 left after dues: nothing settles (whole-charge rule).
  assert.deepEqual(planAddonChargeSettlement(customer, 49900), { lines: [], totalCents: 0 });
  // 500: only the oldest settles; 1199: still only the oldest (700 does not fit).
  assert.deepEqual(planAddonChargeSettlement(customer, 50000).lines, [{ boostId: 'BST-101', amount: 500 }]);
  assert.deepEqual(planAddonChargeSettlement(customer, 119900).lines, [{ boostId: 'BST-101', amount: 500 }]);
  assert.equal(planAddonChargeSettlement(customer, 120000).totalCents, 120000);

  // A bill-only payment leaves the boost pending.
  const { nextState } = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 2000, date: '2026-10-15', method: 'Cash', tickets: []
  }, REF);
  assert.equal(addonChargesPending(nextState.customers[0]), 1200);
});

test('boost charges stay invisible off the collect surface (defaults without the tickets array)', () => {
  const defaults = getCustomerPaymentDefaults(stateWithBoost(), 'cust-1', REF);
  assert.equal(defaults.addonChargesPending, 0);
  assert.equal(defaults.payableTotal, 2000);
  assert.equal(defaults.suggestedAmount, 2000);
});

// ── Void / delete / correct consistency ─────────────────────────────

test('voiding the settling payment un-settles the boost; deleting it without the flag is refused', () => {
  const { nextState } = executeQuickCollection(stateWithBoost(), {
    customerId: 'cust-1', month: MONTH, amount: 2500, date: '2026-10-15', method: 'Cash', tickets: []
  }, REF);
  const payment = nextState.customers[0].bills.find((b) => b.month === MONTH).payments[0];

  // The core guard: the boost settlement must be reverted first.
  assert.throws(
    () => deletePayment(nextState, 'cust-1', MONTH, payment.id, REF),
    /settled a speed boost charge/
  );

  const { state: voidedState } = voidPayment(nextState, 'cust-1', MONTH, payment.id, {
    voidReason: 'Wrong amount recorded', voidedBy: 'Owner', voidedAt: '2026-10-16T09:00:00.000Z'
  });
  const voidedCustomer = voidedState.customers[0];
  const voidedBill = voidedCustomer.bills.find((b) => b.month === MONTH);
  const voidedPayment = voidedBill.payments[0];
  // The voided receipt no longer covers the bill in the engine.
  assert.equal(calculatePaymentAllocations(voidedState).forMonth('cust-1', MONTH).balanceDueCents, 200000);

  const { customer: reopenedCustomer, reopened } = unsettleAddonChargesForPayment(voidedCustomer, voidedPayment);
  assert.deepEqual(reopened, ['BST-101']);
  const boost = speedBoostsOf(reopenedCustomer)[0];
  assert.equal(boost.chargePaid, false);
  assert.equal(boost.chargePaidAt, '');
  assert.equal(boost.chargePaymentId, '');
  assert.equal(addonChargesPending(reopenedCustomer), 500);
});

test('Quick Collect undo order: unsettle first, then deletePayment under the house flag removes the receipt', () => {
  const { nextState } = executeQuickCollection(stateWithBoost(), {
    customerId: 'cust-1', month: MONTH, amount: 2500, date: '2026-10-15', method: 'Cash', tickets: []
  }, REF);
  const payment = nextState.customers[0].bills.find((b) => b.month === MONTH).payments[0];
  const { customer: reopenedCustomer } = unsettleAddonChargesForPayment(nextState.customers[0], payment);
  const withReopened = { ...nextState, customers: [reopenedCustomer] };
  const afterDelete = deletePayment(withReopened, 'cust-1', MONTH, payment.id, REF, { addonChargesReverted: true });
  assert.equal(afterDelete.customers[0].bills.find((b) => b.month === MONTH).payments.length, 0);
  assert.equal(addonChargesPending(afterDelete.customers[0]), 500);
});

test('correcting a boost-settling payment keeps its settlement stamp; shrinking below it is refused', () => {
  const { nextState } = executeQuickCollection(stateWithBoost(), {
    customerId: 'cust-1', month: MONTH, amount: 2500, date: '2026-10-15', method: 'Cash', tickets: []
  }, REF);
  const payment = nextState.customers[0].bills.find((b) => b.month === MONTH).payments[0];
  const corrected = correctPayment(nextState, 'cust-1', MONTH, payment.id, {
    date: '2026-10-15', amount: '2600', method: 'Cash'
  }, REF);
  const correctedPayment = corrected.customers[0].bills.find((b) => b.month === MONTH).payments[0];
  assert.deepEqual(correctedPayment.addonCharges, [{ boostId: 'BST-101', amount: 500 }]);
  assert.throws(
    () => correctPayment(nextState, 'cust-1', MONTH, payment.id, { date: '2026-10-15', amount: '400', method: 'Cash' }, REF),
    /settled a speed boost charge/
  );
});

test('validatePayment guards the addon stamp: total over the amount, bad ids, ticket+addon overflow', () => {
  const base = { month: MONTH, amount: 2500, method: 'Cash', date: '2026-10-15' };
  assert.equal(validatePayment({ ...base, addonCharges: [{ boostId: 'BST-101', amount: 500 }] }).addonCharges.length, 1);
  assert.throws(() => validatePayment({ ...base, amount: 400, addonCharges: [{ boostId: 'BST-101', amount: 500 }] }), /cannot exceed the amount collected/);
  assert.throws(() => validatePayment({ ...base, addonCharges: [{ boostId: 'NOPE', amount: 500 }] }), /needs a boost id like BST-101/);
  assert.throws(() => validatePayment({
    ...base, amount: 700,
    ticketCharges: [{ ticketId: 'TKT-101', amount: 400 }],
    addonCharges: [{ boostId: 'BST-101', amount: 400 }]
  }), /cannot exceed the amount collected/);
  // A payment with no stamp carries no addonCharges key (legacy shape).
  assert.equal('addonCharges' in validatePayment(base), false);
});

test('settleAddonCharges settles only exact-amount lines and never re-settles under a second payment', () => {
  const customer = stateWithBoost().customers[0];
  // A line whose amount does not equal the boost fee settles nothing.
  const mismatched = settleAddonCharges(customer, [{ boostId: 'BST-101', amount: 400 }], 'pay-x', '2026-10-15');
  assert.equal(speedBoostsOf(mismatched)[0].chargePaid, false);
  // The exact line settles and stamps the paying receipt.
  const settled = settleAddonCharges(customer, [{ boostId: 'BST-101', amount: 500 }], 'pay-x', '2026-10-15');
  assert.equal(speedBoostsOf(settled)[0].chargePaid, true);
  assert.equal(speedBoostsOf(settled)[0].chargePaymentId, 'pay-x');
  // A second payment can never steal the settlement.
  const again = settleAddonCharges(settled, [{ boostId: 'BST-101', amount: 500 }], 'pay-y', '2026-10-16');
  assert.equal(speedBoostsOf(again)[0].chargePaymentId, 'pay-x');
});

// ── FREE / hold / archived refusals ─────────────────────────────────

test('FREE connections are refused a paid boost (a FREE line is never billed)', () => {
  const state = createInitialState([]);
  state.customers.push({
    id: 'cust-free', customerNumber: 102, name: 'Synthetic Free Line', archived: false,
    isFreeConnection: true, monthlySellingAmount: 0, bills: []
  });
  assert.throws(() => addSpeedBoost(state, 'cust-free', BOOST, REF), /FREE connections are never billed/);
  assert.equal(speedBoostsOf(state.customers[0]).length, 0);
});

test('a boost starting inside an active vacation hold is refused and never unpauses billing; one starting before the hold is allowed', () => {
  const state = stateWithBill(2000);
  state.customers[0].paused = true;
  state.customers[0].pauseStartDate = '2026-10-01';
  state.customers[0].pauseReason = 'vacation';
  // Boost start 2026-10-05 falls inside the open-ended hold.
  assert.throws(() => addSpeedBoost(state, 'cust-1', BOOST, REF), /vacation hold/);
  // Billing state is untouched by the refusal.
  assert.equal(state.customers[0].paused, true);
  assert.equal(speedBoostsOf(state.customers[0]).length, 0);
  // A boost that starts (and runs) before the hold begins is fine.
  const ok = addSpeedBoost(state, 'cust-1', { ...BOOST, startDate: '2026-09-20', durationDays: 5 }, REF);
  assert.equal(speedBoostsOf(ok.state.customers[0]).length, 1);
  assert.equal(ok.state.customers[0].paused, true);
});

test('archived customers are refused; unknown customers are refused', () => {
  const state = stateWithBill(2000);
  state.customers[0].archived = true;
  assert.throws(() => addSpeedBoost(state, 'cust-1', BOOST, REF), /Archived customers/);
  assert.throws(() => addSpeedBoost(stateWithBill(2000), 'nope', BOOST, REF), /Customer not found/);
});

// ── MikroTik snippets ───────────────────────────────────────────────

test('MikroTik boost snippet boosts the queue with the expiry in the comment; restore returns to the base rate', () => {
  const customer = stateWithBoost().customers[0];
  const boost = speedBoostsOf(customer)[0];
  const snippet = buildSpeedBoostSnippet(customer, boost);
  assert.ok(snippet.includes('/queue simple set'));
  assert.ok(snippet.includes('max-limit=15M/15M'));
  assert.ok(snippet.includes('runs through 2026-10-15'));

  const restore = buildSpeedBoostRestoreSnippet(customer);
  assert.ok(restore.includes('max-limit=5M/5M'));

  // Honest TODO when the boost speed is unusable or the base package
  // speed is unknown — never a fabricated router command.
  const todoBoost = buildSpeedBoostSnippet({ ...customer, id: 'x' }, { ...boost, boostMbps: 'fast' });
  assert.ok(todoBoost.includes('TODO'));
  assert.ok(!todoBoost.includes('/queue simple set'));
  const todoRestore = buildSpeedBoostRestoreSnippet({ ...customer, packageSpeed: '' });
  assert.ok(todoRestore.includes('TODO'));
  assert.ok(!todoRestore.includes('/queue simple set'));
});

// ── Profile section + i18n + dark mode ──────────────────────────────

test('profile section renders the log, the pending fee, an expired-boost restore button and the add form', () => {
  const customer = stateWithBoost().customers[0];
  const html = speedBoostProfileSectionHtml(customer, { todayStr: '2026-10-20', formatAmountFn: (n) => `PKR ${n}` });
  assert.ok(html.includes('BST-101'));
  assert.ok(html.includes('Expired')); // 2026-10-20 is past the 2026-10-15 expiry
  assert.ok(html.includes('data-boost-restore="1"'));
  assert.ok(html.includes('id="profileBoostAddBtn"'));
  assert.ok(html.includes('Boost charges pending: PKR 500'));

  const activeHtml = speedBoostProfileSectionHtml(customer, { todayStr: '2026-10-10', formatAmountFn: (n) => `PKR ${n}` });
  assert.ok(activeHtml.includes('Active'));
  assert.ok(!activeHtml.includes('data-boost-restore'));

  const free = { ...customer, isFreeConnection: true, speedBoosts: [] };
  const freeHtml = speedBoostProfileSectionHtml(free, { todayStr: '2026-10-10', formatAmountFn: (n) => `PKR ${n}` });
  assert.ok(freeHtml.includes('FREE connection'));
  assert.ok(!freeHtml.includes('profileBoostAddBtn'));
});

test('every boost_* key resolves in English AND Urdu (missing keys return the raw key = fail)', () => {
  const keys = [
    'boost_current_charges', 'boost_heading', 'boost_pending', 'boost_empty', 'boost_line',
    'boost_status_active', 'boost_status_expired', 'boost_status_upcoming', 'boost_paid',
    'boost_unpaid', 'boost_copy_snippet', 'boost_copy_restore', 'boost_form_mbps',
    'boost_form_days', 'boost_form_fee', 'boost_form_start', 'boost_add', 'boost_free_note',
    'boost_added', 'boost_copied', 'boost_copy_failed'
  ];
  for (const key of keys) {
    assert.notEqual(t(key, 'en'), key, `en resolves ${key}`);
    assert.notEqual(t(key, 'ur'), key, `ur resolves ${key}`);
  }
  // Urdu values carry Urdu script; params substitute in both languages.
  assert.match(t('boost_heading', 'ur'), /[\u0600-\u06FF]/);
  assert.equal(t('boost_added', 'en', { id: 'BST-101', fee: 'PKR 500' }), 'Speed boost BST-101 added — PKR 500 is now due with the bill.');
  assert.match(t('boost_added', 'ur', { id: 'BST-101', fee: 'PKR 500' }), /BST-101/);
});

test('boost profile CSS uses theme tokens only (no hardcoded hex / white)', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* SISP-106: profile speed-boost section');
  assert.ok(start >= 0, 'boost CSS block exists');
  const block = css.slice(start, css.indexOf('.boost-add-form input:focus', start));
  assert.ok(block.includes('var(--line)'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hex colours in the boost CSS block');
  assert.ok(!/white/i.test(block), 'no hardcoded white in the boost CSS block');
});
