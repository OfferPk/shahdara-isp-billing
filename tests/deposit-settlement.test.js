// SISP-50: Disconnection Security Deposit Refund vs. Final Arrears
// Offset Calculator (enhancing SISP-19). Pure-function + core-integration
// tests on synthetic data only.
// Spec test criterion (verbatim): "A disconnected customer with
// securityDeposit: 2000 and unpaidArrears: 1200 (all hardware recovered)
// computes netDepositRefund: 800 and clears the arrears upon settlement."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDepositSettlement,
  depositSettlementOf,
  depositSettlementQuote,
  sanitizeDepositSettlement,
  unrecoveredHardwareCharges
} from '../hardware-custody.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import {
  calculatePaymentAllocations,
  createInitialState,
  createJsonBackup,
  derivedBillStatus,
  persistState,
  previewJsonBackupMerge,
  readState
} from '../core.js';
import { buildDepositSettlementReceipt, generateDepositSettlementReceiptHtml } from '../receipt.js';
import { depositSettlementPresentation } from '../profile-ui.js';

const SETTLE_DATE = '2026-10-29';

// Engine arrears for one synthetic customer, exactly as app.js computes
// them at render/click time (canonical allocation balances).
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

test('SISP-50 spec criterion: deposit 2000, arrears 1200, hardware recovered -> netDepositRefund 800', () => {
  const customer = disconnected();
  const { arrears } = engineArrears(customer);
  assert.equal(arrears, 1200);
  const quote = depositSettlementQuote(customer, arrears);
  assert.equal(quote.eligible, true);
  assert.equal(quote.securityDeposit, 2000);
  assert.equal(quote.unpaidArrears, 1200);
  assert.equal(quote.unrecoveredHardwareCharge, 0);
  assert.equal(quote.netDepositRefund, 800);
  assert.equal(quote.arrearsOffset, 1200);
  assert.equal(quote.arrearsRemaining, 0);
});

test('SISP-50 spec criterion: settlement clears the arrears in the engine and stamps the record', () => {
  const customer = disconnected();
  const { arrears, billBalances } = engineArrears(customer);
  const settled = applyDepositSettlement(customer, arrears, { date: SETTLE_DATE, billBalances });
  assert.equal(settled.securityDeposit, 0);
  const record = depositSettlementOf(settled);
  assert.ok(record);
  assert.equal(record.settledAt, SETTLE_DATE);
  assert.equal(record.securityDeposit, 2000);
  assert.equal(record.arrearsOffset, 1200);
  assert.equal(record.refundAmount, 800);
  assert.deepEqual(record.offsets, [{ month: '2026-09', amount: 1200 }]);
  // The arrears are actually gone from the canonical engine, and the
  // bill now derives as paid. The Khata Doctor formula agrees.
  const after = engineArrears(settled);
  assert.equal(after.arrears, 0);
  assert.equal(computeLedgerBalance(settled).balanceCents, 0);
  const allocations = calculatePaymentAllocations({ customers: [settled] });
  assert.equal(derivedBillStatus(settled, settled.bills[0], allocations), 'paid');
  // The offset rode audited BILL fields (the SISP-30/40 shape) — never
  // a fabricated payment: no payment record exists, so collection/P&L
  // cash sums and backup payment validation are untouched, and the
  // bill carries its own audit trail.
  assert.equal(settled.bills[0].payments.length, 0);
  assert.equal(settled.bills[0].depositOffsetAmount, 1200);
  assert.match(settled.bills[0].depositOffsetReason, /Security deposit offset/);
  assert.equal(settled.bills[0].depositOffsetAppliedAt, SETTLE_DATE);
  const history = settled.bills[0].amountHistory.at(-1);
  assert.equal(history.type, 'deposit_offset_applied');
  assert.equal(history.depositOffset, 1200);
  assert.equal(history.previousDepositOffset, 0);
});

test('SISP-50: unrecovered ISP-owned hardware is charged at its recorded install cost', () => {
  const customer = disconnected({ hardwareRecovered: { router: null, mediaConverter: '2026-10-06' } });
  const charges = unrecoveredHardwareCharges(customer);
  assert.deepEqual(charges, [{ key: 'router', label: 'Router', amount: 1500, priceRecorded: true }]);
  const quote = depositSettlementQuote(customer, 1200);
  assert.equal(quote.unrecoveredHardwareCharge, 1500);
  // Deposit 2000: arrears clear first (1200), 800 covers part of the
  // hardware charge, 700 stays outstanding, refund 0.
  assert.equal(quote.arrearsOffset, 1200);
  assert.equal(quote.hardwareCovered, 800);
  assert.equal(quote.netDepositRefund, 0);
  assert.equal(quote.hardwareOutstanding, 700);
  const { billBalances } = engineArrears(customer);
  const settled = applyDepositSettlement(customer, 1200, { date: SETTLE_DATE, billBalances });
  const record = depositSettlementOf(settled);
  assert.equal(record.hardwareCovered, 800);
  assert.equal(record.hardwareOutstanding, 700);
  assert.equal(record.refundAmount, 0);
  assert.equal(engineArrears(settled).arrears, 0);
});

test('SISP-50: customer-owned hardware never charges, recovered ISP hardware never charges', () => {
  const customerOwned = disconnected({
    routerOwnership: 'customer-owned', mediaConverterOwnership: 'customer-owned',
    hardwareRecovered: { router: null, mediaConverter: null }
  });
  assert.deepEqual(unrecoveredHardwareCharges(customerOwned), []);
  assert.equal(depositSettlementQuote(customerOwned, 1200).unrecoveredHardwareCharge, 0);
  const recovered = disconnected();
  assert.deepEqual(unrecoveredHardwareCharges(recovered), []);
});

test('SISP-50: unrecovered item with no recorded price charges 0 and is flagged, never invented', () => {
  const customer = disconnected({
    routerPrice: null, hardwareRecovered: { router: null, mediaConverter: '2026-10-06' }
  });
  const charges = unrecoveredHardwareCharges(customer);
  assert.deepEqual(charges, [{ key: 'router', label: 'Router', amount: 0, priceRecorded: false }]);
  assert.equal(depositSettlementQuote(customer, 1200).netDepositRefund, 800);
});

test('SISP-50: eligibility — connected, deposit-less and already-settled customers cannot settle', () => {
  const connected = disconnected({ archived: false, archivedAt: null });
  assert.equal(depositSettlementQuote(connected, 1200).reason, 'not-disconnected');
  assert.throws(() => applyDepositSettlement(connected, 1200, { date: SETTLE_DATE, billBalances: [] }), /disconnected/);
  const noDeposit = disconnected({ securityDeposit: null });
  assert.equal(depositSettlementQuote(noDeposit, 1200).reason, 'no-deposit');
  assert.throws(() => applyDepositSettlement(noDeposit, 1200, { date: SETTLE_DATE, billBalances: [] }), /No security deposit/);
  const customer = disconnected();
  const { arrears, billBalances } = engineArrears(customer);
  const settled = applyDepositSettlement(customer, arrears, { date: SETTLE_DATE, billBalances });
  assert.equal(depositSettlementQuote(settled, 0).reason, 'already-settled');
  assert.throws(() => applyDepositSettlement(settled, 0, { date: SETTLE_DATE, billBalances: [] }), /already settled/);
  assert.throws(() => applyDepositSettlement(customer, arrears, { date: '29-10-2026', billBalances }), /valid settlement date/);
});

test('SISP-50: partial deposit clears oldest bills first and leaves the rest honestly due', () => {
  const customer = disconnected({
    securityDeposit: 500,
    bills: [
      { id: 'bill-aug', month: '2026-08', dueAmount: 700, status: 'pending', payments: [] },
      { id: 'bill-sep', month: '2026-09', dueAmount: 500, status: 'pending', payments: [] }
    ]
  });
  const { arrears, billBalances } = engineArrears(customer);
  assert.equal(arrears, 1200);
  const settled = applyDepositSettlement(customer, arrears, { date: SETTLE_DATE, billBalances });
  const record = depositSettlementOf(settled);
  assert.equal(record.arrearsOffset, 500);
  assert.deepEqual(record.offsets, [{ month: '2026-08', amount: 500 }]);
  assert.equal(record.arrearsRemaining, 700);
  assert.equal(record.refundAmount, 0);
  assert.equal(engineArrears(settled).arrears, 700);
});

test('SISP-50: apply is pure — a frozen input customer is never mutated', () => {
  const customer = disconnected();
  Object.freeze(customer.bills[0].payments);
  Object.freeze(customer.bills[0]);
  Object.freeze(customer.bills);
  Object.freeze(customer);
  const { arrears, billBalances } = engineArrears(customer);
  const settled = applyDepositSettlement(customer, arrears, { date: SETTLE_DATE, billBalances });
  assert.equal(customer.securityDeposit, 2000);
  assert.equal(customer.bills[0].depositOffsetAmount, undefined);
  assert.equal(customer.depositSettlement, undefined);
  assert.equal(settled.bills[0].depositOffsetAmount, 1200);
});

test('SISP-50: sanitizeDepositSettlement rejects garbage and clamps a real record', () => {
  assert.equal(sanitizeDepositSettlement(null), null);
  assert.equal(sanitizeDepositSettlement('settled'), null);
  assert.equal(sanitizeDepositSettlement({ settledAt: 'not-a-date', securityDeposit: 100 }), null);
  const clean = sanitizeDepositSettlement({
    settledAt: SETTLE_DATE, securityDeposit: -50, arrearsOffset: 1200.456, refundAmount: 800,
    offsets: [{ month: '2026-09', amount: 1200 }, { month: 'Sep', amount: 5 }, { month: '2026-08', amount: -1 }],
    hardwareCharges: [{ key: 'router', amount: 1500, priceRecorded: true }, { key: 'dish', amount: 10 }]
  });
  assert.equal(clean.securityDeposit, 0);
  assert.equal(clean.arrearsOffset, 1200.46);
  assert.deepEqual(clean.offsets, [{ month: '2026-09', amount: 1200 }]);
  assert.deepEqual(clean.hardwareCharges, [{ key: 'router', label: 'Router', amount: 1500, priceRecorded: true }]);
});

test('SISP-50: clearance receipt snapshot + HTML carry the full settlement picture', () => {
  const customer = disconnected();
  assert.equal(buildDepositSettlementReceipt(customer), null);
  const { arrears, billBalances } = engineArrears(customer);
  const settled = applyDepositSettlement(customer, arrears, { date: SETTLE_DATE, billBalances });
  const receipt = buildDepositSettlementReceipt(settled);
  assert.equal(receipt.status, 'CLEARED');
  assert.equal(receipt.securityDeposit, 2000);
  assert.equal(receipt.arrearsOffset, 1200);
  assert.equal(receipt.refundAmount, 800);
  assert.match(receipt.receiptNumber, /^REC-/);
  const html = generateDepositSettlementReceiptHtml(receipt);
  assert.ok(html.includes('Final Disconnection Clearance Receipt'));
  assert.ok(html.includes('PKR 2,000'));
  assert.ok(html.includes('PKR 800'));
  assert.ok(html.includes('CLEARED'));
  // Partial coverage reads PARTIALLY CLEARED with the outstanding line.
  const partial = disconnected({ securityDeposit: 500 });
  const p = engineArrears(partial);
  const settledPartial = applyDepositSettlement(partial, p.arrears, { date: SETTLE_DATE, billBalances: p.billBalances });
  const partialReceipt = buildDepositSettlementReceipt(settledPartial);
  assert.equal(partialReceipt.status, 'PARTIALLY CLEARED');
  assert.ok(generateDepositSettlementReceiptHtml(partialReceipt).includes('Arrears Still Outstanding'));
});

test('SISP-50: settlement survives persist/readState and a JSON backup merge', () => {
  const customer = disconnected();
  const { arrears, billBalances } = engineArrears(customer);
  const settled = applyDepositSettlement(customer, arrears, { date: SETTLE_DATE, billBalances });
  const state = { ...createInitialState(), customers: [settled] };
  const data = new Map();
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  };
  persistState(state, storage);
  const restored = readState(storage);
  assert.equal(depositSettlementOf(restored.customers[0])?.refundAmount, 800);
  assert.equal(restored.customers[0].securityDeposit, 0);
  // Backup round trip: the stamp travels in the JSON and merges back.
  const backupText = createJsonBackup(state, new Date('2026-10-29T00:00:00Z'));
  const backupCustomer = JSON.parse(backupText).state.customers[0];
  assert.equal(backupCustomer.depositSettlement.refundAmount, 800);
  const merged = previewJsonBackupMerge(createInitialState(), backupText);
  const mergedCustomer = (merged.state?.customers ?? []).find(c => c.id === customer.id);
  assert.ok(mergedCustomer, 'merged state carries the settled customer');
  assert.equal(depositSettlementOf(mergedCustomer)?.arrearsOffset, 1200);
});

test('SISP-50: profile presentation — hidden while connected, quote before, settled line after', () => {
  const connected = disconnected({ archived: false, archivedAt: null });
  assert.equal(depositSettlementPresentation(connected, 1200).visible, false);
  const customer = disconnected();
  const before = depositSettlementPresentation(customer, 1200);
  assert.equal(before.visible, true);
  assert.equal(before.canSettle, true);
  assert.match(before.refundLabel, /800/);
  const { arrears, billBalances } = engineArrears(customer);
  const settled = applyDepositSettlement(customer, arrears, { date: SETTLE_DATE, billBalances });
  const after = depositSettlementPresentation(settled, 0);
  assert.equal(after.settled, true);
  assert.match(after.settledLabel, /2026-10-29/);
  const noDeposit = disconnected({ securityDeposit: null });
  assert.equal(depositSettlementPresentation(noDeposit, 1200).visible, false);
});
