// SISP-166: Active Customer Security Deposit → Monthly Bill Offset.
// Pure-function + core-integration tests on synthetic data only.
//
// Mechanism (mirrors SISP-50): the offset rides as audited BILL fields
// (depositOffsetAmount + reason + appliedAt + amountHistory), the
// engine subtracts it from the bill due, and NO payment record exists —
// so drawer/shop/wallet/P&L figures cannot move. The per-application
// record lives on customer.depositOffsets (DOF-101+) and drives the
// receipt + exact reversal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACTIVE_DEPOSIT_OFFSET_REASON,
  activeDepositOffsetQuote,
  applyActiveDepositOffset,
  depositOffsetEntryOf,
  depositOffsetsOf,
  nextDepositOffsetId,
  reverseActiveDepositOffset,
  sanitizeDepositOffsets
} from '../deposit-to-bill-offset.js';
import { applyDepositSettlement } from '../hardware-custody.js';
import {
  calculatePaymentAllocations,
  createInitialState,
  createJsonBackup,
  persistState,
  previewJsonBackupMerge,
  readState
} from '../core.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import { collectDirectCashPayments } from '../roznamcha.js';
import { buildShopSummaries } from '../shop-settlement.js';
import { buildWalletReconciliation } from '../wallet-reconciliation.js';
import { buildDepositOffsetReceipt, generateDepositOffsetReceiptHtml } from '../receipt.js';
import { activeDepositOffsetPresentation } from '../profile-ui.js';
import { TRANSLATIONS } from '../nav-language.js';

const OFFSET_DATE = '2026-10-15';
const REVERSE_DATE = '2026-10-20';

// Engine pending balance + per-bill balances for one synthetic
// customer, exactly as app.js computes them at render/click time.
function enginePending(customer) {
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
  return { pending: cents / 100, billBalances };
}

const activeCustomer = (overrides = {}) => ({
  id: 'cust-off-1',
  customerNumber: 51,
  name: 'Test Customer 51',
  archived: false,
  isFreeConnection: false,
  securityDeposit: 5000,
  bills: [{ id: 'bill-oct', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [] }],
  ...overrides
});

const paymentCount = (customer) => (customer.bills ?? []).reduce((sum, bill) => sum + (bill.payments ?? []).length, 0);

test('spec pin: deposit 5000, due 3000 -> offset 3000 leaves deposit 2000 and due 0', () => {
  const customer = activeCustomer();
  const { pending, billBalances } = enginePending(customer);
  assert.equal(pending, 3000);
  const quote = activeDepositOffsetQuote(customer, pending);
  assert.equal(quote.eligible, true);
  assert.equal(quote.maxOffset, 3000);
  const updated = applyActiveDepositOffset(customer, pending, { date: OFFSET_DATE, amount: 3000, billBalances });
  assert.equal(updated.securityDeposit, 2000);
  assert.equal(enginePending(updated).pending, 0);
  // Single representation: the bill stamp carries the offset.
  const bill = updated.bills[0];
  assert.equal(bill.depositOffsetAmount, 3000);
  assert.equal(bill.depositOffsetReason, ACTIVE_DEPOSIT_OFFSET_REASON);
  assert.equal(bill.depositOffsetAppliedAt, OFFSET_DATE);
  assert.equal(bill.amountHistory.at(-1).type, 'deposit_offset_active_applied');
  assert.equal(bill.amountHistory.at(-1).offsetId, 'DOF-101');
  // The audit entry on the customer record.
  const entry = depositOffsetEntryOf(updated, 'DOF-101');
  assert.equal(entry.amount, 3000);
  assert.equal(entry.depositBefore, 5000);
  assert.equal(entry.depositAfter, 2000);
  assert.deepEqual(entry.bills, [{ month: '2026-10', amount: 3000 }]);
  assert.equal(entry.reversedAt, null);
  // Input never mutated.
  assert.equal(customer.securityDeposit, 5000);
  assert.equal(customer.bills[0].depositOffsetAmount, undefined);
});

test('spec pin: zero cash impact — drawer, shop trays, wallet and P&L figures byte-identical', () => {
  const payer = {
    id: 'cust-pay-2', customerNumber: 52, name: 'Test Customer 52', archived: false,
    bills: [{
      id: 'bill-pay-oct', month: '2026-10', dueAmount: 9000, status: 'partial',
      payments: [
        { id: 'pay-cash', date: '2026-10-10', amount: 2000, method: 'Cash' },
        { id: 'pay-shop', date: '2026-10-10', amount: 3000, method: 'Cash at Hassan shop' },
        { id: 'pay-wallet', date: '2026-10-11', amount: 1500, method: 'Easypaisa' }
      ]
    }]
  };
  const target = activeCustomer();
  const figures = (state) => ({
    drawer: collectDirectCashPayments(state, '2026-10-10'),
    shops: buildShopSummaries(state, [], new Date('2026-10-15T00:00:00Z')),
    wallet: buildWalletReconciliation(state.customers, '2026-10', []),
    pnl: calculatePnlAnalytics(state, { selectedMonth: '2026-10', referenceDate: new Date('2026-10-15T00:00:00Z') })
  });
  const before = figures({ customers: [target, payer], expenses: [] });
  const { pending, billBalances } = enginePending(target);
  const updatedTarget = applyActiveDepositOffset(target, pending, { date: OFFSET_DATE, amount: 3000, billBalances });
  const after = figures({ customers: [updatedTarget, payer], expenses: [] });
  assert.deepEqual(after, before);
  // And concretely: the P&L income for October is exactly the recorded
  // payments (6500) — the offset contributed Rs 0 income.
  const october = after.pnl.monthlyData.find((row) => row.month === '2026-10');
  assert.equal(october.income, 6500);
});

test('P&L identity: a clearance offset and an active offset of the same amount are treated identically', () => {
  // Archived customer settled through SISP-50 clearance.
  const archived = {
    id: 'cust-clr-3', customerNumber: 53, name: 'Test Customer 53', archived: true,
    securityDeposit: 5000, routerOwnership: '', mediaConverterOwnership: '',
    hardwareRecovered: { router: null, mediaConverter: null },
    bills: [{ id: 'bill-clr', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [] }]
  };
  const cleared = applyDepositSettlement(archived, 3000, { date: OFFSET_DATE, billBalances: [{ month: '2026-10', balanceDue: 3000 }] });
  // Active customer offset through SISP-166.
  const target = activeCustomer();
  const { pending, billBalances } = enginePending(target);
  const offset = applyActiveDepositOffset(target, pending, { date: OFFSET_DATE, amount: 3000, billBalances });
  const incomeOf = (customer) => calculatePnlAnalytics({ customers: [customer], expenses: [] }, { selectedMonth: '2026-10', referenceDate: new Date('2026-10-15T00:00:00Z') })
    .monthlyData.find((row) => row.month === '2026-10').income;
  assert.equal(incomeOf(cleared), 0);
  assert.equal(incomeOf(offset), 0);
  assert.equal(paymentCount(cleared), 0);
  assert.equal(paymentCount(offset), 0);
});

test('spec pin: partial offset 1500 of 3000 due -> due 1500, deposit reduced by exactly 1500', () => {
  const customer = activeCustomer();
  const { pending, billBalances } = enginePending(customer);
  const updated = applyActiveDepositOffset(customer, pending, { date: OFFSET_DATE, amount: 1500, billBalances });
  assert.equal(updated.securityDeposit, 3500);
  assert.equal(enginePending(updated).pending, 1500);
  assert.equal(updated.bills[0].depositOffsetAmount, 1500);
});

test('allocation target: the offset settles the OLDEST dues first, spanning bills in month order', () => {
  const customer = activeCustomer({
    bills: [
      { id: 'bill-sep', month: '2026-09', dueAmount: 1000, status: 'pending', payments: [] },
      { id: 'bill-oct', month: '2026-10', dueAmount: 2000, status: 'pending', payments: [] }
    ]
  });
  const { pending, billBalances } = enginePending(customer);
  assert.equal(pending, 3000);
  const updated = applyActiveDepositOffset(customer, pending, { date: OFFSET_DATE, amount: 1500, billBalances });
  assert.equal(updated.bills[0].depositOffsetAmount, 1000);
  assert.equal(updated.bills[1].depositOffsetAmount, 500);
  assert.deepEqual(depositOffsetEntryOf(updated, 'DOF-101').bills, [
    { month: '2026-09', amount: 1000 },
    { month: '2026-10', amount: 500 }
  ]);
  assert.equal(enginePending(updated).pending, 1500);
});

test('spec pin: over-offset refused — amount above the due and amount above the deposit both throw', () => {
  const customer = activeCustomer();
  const { pending, billBalances } = enginePending(customer);
  assert.throws(
    () => applyActiveDepositOffset(customer, pending, { date: OFFSET_DATE, amount: 3001, billBalances }),
    /cannot exceed the pending balance/
  );
  const rich = activeCustomer({ securityDeposit: 2000 });
  assert.throws(
    () => applyActiveDepositOffset(rich, pending, { date: OFFSET_DATE, amount: 2500, billBalances }),
    /cannot exceed the security deposit/
  );
  assert.throws(
    () => applyActiveDepositOffset(customer, pending, { date: OFFSET_DATE, amount: 0, billBalances }),
    /greater than zero/
  );
});

test('spec pin: FREE and archived customers are refused; archived points at clearance', () => {
  const free = activeCustomer({ isFreeConnection: true });
  assert.equal(activeDepositOffsetQuote(free, 3000).reason, 'free-connection');
  assert.throws(
    () => applyActiveDepositOffset(free, 3000, { date: OFFSET_DATE, amount: 1000, billBalances: [] }),
    /Free connections have no bills/
  );
  const archived = activeCustomer({ archived: true, archivedAt: '2026-10-05T10:00' });
  assert.equal(activeDepositOffsetQuote(archived, 3000).reason, 'archived');
  assert.throws(
    () => applyActiveDepositOffset(archived, 3000, { date: OFFSET_DATE, amount: 1000, billBalances: [] }),
    /disconnection clearance settles their deposit/
  );
  const noDeposit = activeCustomer({ securityDeposit: null });
  assert.equal(activeDepositOffsetQuote(noDeposit, 3000).reason, 'no-deposit');
  const noDues = activeCustomer({ bills: [{ id: 'b', month: '2026-10', dueAmount: 3000, status: 'paid', payments: [{ id: 'p1', date: '2026-10-03', amount: 3000, method: 'Cash' }] }] });
  assert.equal(activeDepositOffsetQuote(noDues, enginePending(noDues).pending).reason, 'no-dues');
});

test('spec pin: reversal restores deposit and dues EXACTLY; double reversal and archived reversal refused', () => {
  const customer = activeCustomer({
    bills: [
      { id: 'bill-sep', month: '2026-09', dueAmount: 1000, status: 'pending', payments: [] },
      { id: 'bill-oct', month: '2026-10', dueAmount: 2000, status: 'pending', payments: [] }
    ]
  });
  const { pending, billBalances } = enginePending(customer);
  const offset = applyActiveDepositOffset(customer, pending, { date: OFFSET_DATE, amount: 2500, billBalances });
  assert.equal(offset.securityDeposit, 2500);
  assert.equal(enginePending(offset).pending, 500);
  const reversed = reverseActiveDepositOffset(offset, 'DOF-101', { date: REVERSE_DATE });
  assert.equal(reversed.securityDeposit, 5000);
  assert.equal(enginePending(reversed).pending, 3000);
  assert.equal(reversed.bills[0].depositOffsetAmount, 0);
  assert.equal(reversed.bills[1].depositOffsetAmount, 0);
  assert.equal(reversed.bills[0].amountHistory.at(-1).type, 'deposit_offset_active_reversed');
  assert.equal(depositOffsetEntryOf(reversed, 'DOF-101').reversedAt, REVERSE_DATE);
  assert.throws(() => reverseActiveDepositOffset(reversed, 'DOF-101', { date: REVERSE_DATE }), /already reversed/);
  assert.throws(() => reverseActiveDepositOffset(offset, 'DOF-999', { date: REVERSE_DATE }), /not found/);
  const archivedAfter = { ...offset, archived: true, archivedAt: '2026-10-18T09:00' };
  assert.throws(() => reverseActiveDepositOffset(archivedAfter, 'DOF-101', { date: REVERSE_DATE }), /closed by the disconnection clearance/);
});

test('no-double-mechanism pin: an active offset creates NO payment and the engine + Khata Doctor agree', () => {
  const customer = activeCustomer();
  const { pending, billBalances } = enginePending(customer);
  const updated = applyActiveDepositOffset(customer, pending, { date: OFFSET_DATE, amount: 3000, billBalances });
  assert.equal(paymentCount(updated), 0);
  assert.equal(updated.depositSettlement, undefined);
  const doctorBalance = computeLedgerBalance(updated).balanceCents;
  assert.equal(doctorBalance, 0);
  assert.equal(enginePending(updated).pending, doctorBalance / 100);
});

test('repeat offsets accumulate on the same bill stamp and take sequential ids', () => {
  const customer = activeCustomer();
  const first = enginePending(customer);
  const afterFirst = applyActiveDepositOffset(customer, first.pending, { date: OFFSET_DATE, amount: 1000, billBalances: first.billBalances });
  const second = enginePending(afterFirst);
  const afterSecond = applyActiveDepositOffset(afterFirst, second.pending, { date: '2026-10-16', amount: 2000, billBalances: second.billBalances });
  assert.equal(afterSecond.bills[0].depositOffsetAmount, 3000);
  assert.equal(afterSecond.securityDeposit, 2000);
  assert.deepEqual(depositOffsetsOf(afterSecond).map((entry) => entry.id), ['DOF-101', 'DOF-102']);
  assert.equal(nextDepositOffsetId(afterSecond), 'DOF-103');
  // Reversing the first leaves the second's share standing.
  const reversedFirst = reverseActiveDepositOffset(afterSecond, 'DOF-101', { date: REVERSE_DATE });
  assert.equal(reversedFirst.bills[0].depositOffsetAmount, 2000);
  assert.equal(reversedFirst.securityDeposit, 3000);
});

test('sanitizer drops malformed entries and survives readState + backup merge round-trips', () => {
  const messy = sanitizeDepositOffsets([
    { id: 'DOF-101', date: OFFSET_DATE, amount: 1000, bills: [{ month: '2026-10', amount: 1000 }], depositBefore: 5000, depositAfter: 4000, reversedAt: null },
    { id: 'DOF-101', date: OFFSET_DATE, amount: 500, bills: [] },
    { id: 'DOF-102', date: 'not-a-date', amount: 500, bills: [] },
    { id: 'DOF-103', date: OFFSET_DATE, amount: -5, bills: [] },
    'junk',
    null
  ]);
  assert.equal(messy.length, 1);
  assert.equal(messy[0].id, 'DOF-101');

  const customer = activeCustomer();
  const { pending, billBalances } = enginePending(customer);
  const offset = applyActiveDepositOffset(customer, pending, { date: OFFSET_DATE, amount: 3000, billBalances });
  const state = { ...createInitialState(), customers: [offset] };
  const data = new Map();
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  };
  persistState(state, storage);
  const reloaded = readState(storage);
  assert.equal(depositOffsetsOf(reloaded.customers[0]).length, 1);
  assert.equal(reloaded.customers[0].securityDeposit, 2000);

  // Backup round trip: the log travels in the JSON and merges into a
  // device whose copy of the customer has no offsets yet.
  const backupText = createJsonBackup(state, new Date('2026-10-16T00:00:00Z'));
  const backupCustomer = JSON.parse(backupText).state.customers[0];
  assert.equal(depositOffsetsOf(backupCustomer).length, 1);
  const emptyDevice = { ...createInitialState(), customers: [{ ...activeCustomer(), securityDeposit: 5000, depositOffsets: [], monthlyPriceSchedule: [], incidents: [] }] };
  const merged = previewJsonBackupMerge(emptyDevice, backupText);
  const adopted = merged.state.customers.find((row) => row.id === offset.id);
  assert.equal(depositOffsetsOf(adopted).length, 1);
  assert.equal(depositOffsetEntryOf(adopted, 'DOF-101').amount, 3000);
});

test('receipt: non-cash offset receipt shows amount, per-month rows and deposit remaining', () => {
  const customer = activeCustomer();
  const { pending, billBalances } = enginePending(customer);
  const updated = applyActiveDepositOffset(customer, pending, { date: OFFSET_DATE, amount: 3000, billBalances });
  const receipt = buildDepositOffsetReceipt(updated, 'DOF-101');
  assert.equal(receipt.nonCash, true);
  assert.equal(receipt.method, 'Security Deposit Offset');
  assert.equal(receipt.amount, 3000);
  assert.equal(receipt.depositBefore, 5000);
  assert.equal(receipt.depositAfter, 2000);
  assert.equal(receipt.status, 'OFFSET APPLIED');
  const html = generateDepositOffsetReceiptHtml(receipt, { businessName: 'Shahdara ISP', businessPhone: '0300-0000000' });
  assert.match(html, /NON-CASH ADJUSTMENT/);
  assert.match(html, /Security Deposit Remaining/);
  assert.match(html, /Bill offset — 2026-10/);
  assert.match(html, /PKR 2,000/);
  assert.equal(buildDepositOffsetReceipt(updated, 'DOF-999'), null);
  const reversed = reverseActiveDepositOffset(updated, 'DOF-101', { date: REVERSE_DATE });
  assert.equal(buildDepositOffsetReceipt(reversed, 'DOF-101').status, 'REVERSED');
});

test('presentation: visible for active deposit holders, hidden for archived and deposit-less actives', () => {
  const customer = activeCustomer();
  const pres = activeDepositOffsetPresentation(customer, 3000);
  assert.equal(pres.visible, true);
  assert.equal(pres.canOffset, true);
  assert.equal(pres.maxOffset, 3000);
  assert.equal(activeDepositOffsetPresentation({ ...customer, archived: true }, 3000).visible, false);
  assert.equal(activeDepositOffsetPresentation({ ...customer, securityDeposit: null }, 3000).visible, false);
  const { pending, billBalances } = enginePending(customer);
  const offset = applyActiveDepositOffset(customer, pending, { date: OFFSET_DATE, amount: 3000, billBalances });
  const historyPres = activeDepositOffsetPresentation(offset, 0);
  assert.equal(historyPres.visible, true);
  assert.equal(historyPres.entries.length, 1);
  assert.equal(historyPres.entries[0].reversed, false);
});

test('i18n audit: every depoff_ key used in code exists in BOTH dictionaries', () => {
  const used = new Set();
  for (const file of ['app.js', 'profile-ui.js', 'index.html', 'deposit-to-bill-offset.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/depoff_[a-z_]+/g)) used.add(match[0]);
  }
  assert.ok(used.size >= 15, `expected at least 15 depoff_ keys in use, found ${used.size}`);
  for (const key of used) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `missing en key ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `missing ur key ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
  }
});
