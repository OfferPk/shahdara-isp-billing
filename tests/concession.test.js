// SISP-30: Outage-Linked Bill Concession (Reaayat) Calculator & Dispute Guard.
// Pure-function + state-layer tests on synthetic data only.
//
// Pinned test criteria (spec):
//   (1) Rs. 3,000 package + 72h logged monthly downtime -> suggested pro-rata
//       concession Rs. 300; applying it reduces net due 3,000 -> 2,700, with an
//       audit note on the bill.
//   (2) Rs. 1,000 package + 72h -> Rs. 100; net due 1,000 -> 900 (older draft
//       example, kept as a second assertion).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONCESSION_THRESHOLD_HOURS,
  buildConcessionSuggestion,
  concessionAmountFor,
  concessionBadgeText,
  concessionReasonFor,
  netDueAfterConcession,
  suggestConcession
} from '../concession-helper.js';
import {
  applyConcessionToBill,
  createJsonBackup,
  previewJsonBackupMerge,
  removeConcessionFromBill
} from '../core.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { buildEscPosReceipt, escPosFieldsFromPaymentReceipt } from '../thermal-printer.js';

const REF = new Date('2026-10-15T12:00:00+05:00');

const complaint = (overrides = {}) => ({
  id: 'CMP-101',
  customerId: 'c1',
  customerName: 'Synthetic Customer',
  zone: 'Shahdara Town',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-10-05T10:00',
  resolvedAt: '2026-10-05T14:00',
  downtimeHours: 72,
  downtimeManual: false,
  status: 'Resolved',
  resolutionNote: '',
  createdAt: '',
  ...overrides
});

const customerWithBill = (dueAmount, scheduleAmount = null) => ({
  id: 'c1',
  customerNumber: 101,
  name: 'Synthetic Customer',
  packageSpeed: '5 Mbps',
  monthlyPriceSchedule: scheduleAmount === null ? [] : [{ effectiveMonth: '2026-10', amount: scheduleAmount, recordedAt: '2026-10-01T00:00' }],
  bills: [{ id: 'bill-2026-10', month: '2026-10', dueAmount, status: 'pending', payments: [], amountHistory: [] }],
  incidents: []
});

const stateWithBill = (dueAmount, scheduleAmount = null) => ({
  version: 1,
  nextCustomerNumber: 102,
  customers: [customerWithBill(dueAmount, scheduleAmount)]
});

test('formula: round((packageRate / 720) * downtimeHours), zero on bad input', () => {
  assert.equal(concessionAmountFor(3000, 72), 300);
  assert.equal(concessionAmountFor(1000, 72), 100);
  assert.equal(concessionAmountFor(1500, 24), 50);
  assert.equal(concessionAmountFor(3000, 0), 0);
  assert.equal(concessionAmountFor(3000, -5), 0);
  assert.equal(concessionAmountFor(null, 72), 0);
  assert.equal(concessionAmountFor(3000, null), 0);
  assert.equal(concessionReasonFor(72), 'Outage Reaayat: 72h offline');
});

test('threshold: below 12h not eligible, at 12h eligible', () => {
  assert.equal(CONCESSION_THRESHOLD_HOURS, 12);
  assert.equal(suggestConcession({ packageRate: 3000, downtimeHours: 11 }).eligible, false);
  assert.equal(suggestConcession({ packageRate: 3000, downtimeHours: 11 }).suggestedAmount, 46);
  const at = suggestConcession({ packageRate: 3000, downtimeHours: 12 });
  assert.equal(at.eligible, true);
  assert.equal(at.suggestedAmount, 50);
  assert.equal(at.reason, 'Outage Reaayat: 12h offline');
});

test('PINNED (1): 3000 package + 72h downtime -> Rs. 300 suggestion, badge text, net 2700', () => {
  const customer = customerWithBill(3000, 3000);
  const bill = customer.bills[0];
  const suggestion = buildConcessionSuggestion(customer, bill, [complaint()]);
  assert.equal(suggestion.eligible, true);
  assert.equal(suggestion.downtimeHours, 72);
  assert.equal(suggestion.suggestedAmount, 300);
  assert.equal(suggestion.reason, 'Outage Reaayat: 72h offline');
  assert.equal(concessionBadgeText(suggestion), 'Monthly Downtime: 72 hrs • Suggested Pro-Rata Concession: Rs. 300');
  assert.equal(netDueAfterConcession(3000, suggestion.suggestedAmount), 2700);

  let state = stateWithBill(3000, 3000);
  state = applyConcessionToBill(state, 'c1', '2026-10', { amount: suggestion.suggestedAmount, reason: suggestion.reason }, REF);
  const updated = state.customers[0].bills[0];
  assert.equal(updated.concessionAmount, 300);
  assert.equal(updated.concessionReason, 'Outage Reaayat: 72h offline');
  assert.ok(updated.concessionAppliedAt);
  assert.equal(updated.dueAmount, 3000, 'the bill amount itself is never rewritten');
  assert.equal(updated.amountHistory.length, 1);
  assert.equal(updated.amountHistory[0].type, 'concession_applied');
  assert.equal(updated.amountHistory[0].concession, 300);
  assert.equal(netDueAfterConcession(updated.dueAmount, updated.concessionAmount), 2700);
});

test('PINNED (2): 1000 package + 72h downtime -> Rs. 100 suggestion, net 900', () => {
  const customer = customerWithBill(1000, 1000);
  const suggestion = buildConcessionSuggestion(customer, customer.bills[0], [complaint()]);
  assert.equal(suggestion.suggestedAmount, 100);
  assert.equal(netDueAfterConcession(1000, suggestion.suggestedAmount), 900);
});

test('suggestion builder: only the bill month counts, area outages never count, fallback rate is the bill amount', () => {
  const customer = customerWithBill(3000, null);
  const bill = customer.bills[0];
  const list = [
    complaint({ id: 'CMP-101', downtimeHours: 48 }),
    complaint({ id: 'CMP-102', downtimeHours: 24, reportedAt: '2026-10-20T10:00', resolvedAt: '2026-10-20T12:00' }),
    complaint({ id: 'CMP-103', downtimeHours: 100, reportedAt: '2026-09-05T10:00', resolvedAt: '2026-09-05T12:00' }),
    complaint({ id: 'CMP-104', downtimeHours: 500, customerId: 'AREA_OUTAGE' })
  ];
  const suggestion = buildConcessionSuggestion(customer, bill, list);
  assert.equal(suggestion.downtimeHours, 72);
  assert.equal(suggestion.complaintCount, 2);
  assert.equal(suggestion.suggestedAmount, 300, 'no price schedule -> bill dueAmount is the rate');
});

test('dispute guard: apply SETS (never stacks), clamps to gross, throws on bad input, remove clears', () => {
  let state = stateWithBill(3000, 3000);
  state = applyConcessionToBill(state, 'c1', '2026-10', { amount: 300, reason: 'Outage Reaayat: 72h offline' }, REF);
  state = applyConcessionToBill(state, 'c1', '2026-10', { amount: 200, reason: 'Outage Reaayat: 48h offline' }, REF);
  assert.equal(state.customers[0].bills[0].concessionAmount, 200, 're-apply replaces, it never adds');
  assert.equal(state.customers[0].bills[0].amountHistory.length, 2);

  state = applyConcessionToBill(state, 'c1', '2026-10', { amount: 5000, reason: 'Outage Reaayat: 72h offline' }, REF);
  assert.equal(state.customers[0].bills[0].concessionAmount, 3000, 'clamped to the bill gross, never above it');

  assert.throws(() => applyConcessionToBill(state, 'c1', '2026-10', { amount: 0, reason: 'x' }, REF), /positive/);
  assert.throws(() => applyConcessionToBill(state, 'c1', '2026-09', { amount: 100, reason: 'x' }, REF), /not found/);
  const unpriced = { version: 1, nextCustomerNumber: 102, customers: [{ id: 'c1', customerNumber: 101, name: 'X', bills: [{ id: 'b1', month: '2026-10', dueAmount: null, status: 'pending', payments: [] }] }] };
  assert.throws(() => applyConcessionToBill(unpriced, 'c1', '2026-10', { amount: 100, reason: 'x' }, REF), /unpriced/);

  state = removeConcessionFromBill(state, 'c1', '2026-10', { reason: 'Outage concession removed by owner' }, REF);
  assert.equal(state.customers[0].bills[0].concessionAmount, 0);
  assert.equal(state.customers[0].bills[0].amountHistory.at(-1).type, 'concession_removed');
  const again = removeConcessionFromBill(state, 'c1', '2026-10', {}, REF);
  assert.equal(again, state, 'removing when none exists is a no-op returning the same state');
});

test('net due guard: never increases, never below zero', () => {
  assert.equal(netDueAfterConcession(3000, 300), 2700);
  assert.equal(netDueAfterConcession(100, 500), 0);
  assert.equal(netDueAfterConcession(3000, 0), 3000);
  assert.equal(netDueAfterConcession(3000, -50), 3000);
  assert.equal(netDueAfterConcession(null, 300), 0);
});

test('receipt: concession reduces the settled balance, seals PAID on net, prints on all layouts', () => {
  const payment = { id: 'pay-1', amount: 2700, date: '2026-10-20', method: 'Cash' };
  const customer = customerWithBill(3000, 3000);
  const bill = { ...customer.bills[0], concessionAmount: 300, concessionReason: 'Outage Reaayat: 72h offline', payments: [payment] };
  customer.bills = [bill];
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.concessionAmount, 300);
  assert.equal(receipt.concessionReason, 'Outage Reaayat: 72h offline');
  assert.equal(receipt.balanceDueCents, 0);
  assert.equal(receipt.status, 'PAID');

  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.match(a4, /Outage Concession \(Reaayat\)/);
  assert.match(a4, /Outage Reaayat: 72h offline/);
  const t80 = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
  assert.match(t80, /Outage Concession/);
  const t58 = generatePaymentReceiptHtml(receipt, { format: 'thermal-58' });
  assert.match(t58, /Outage Concession/);

  const png = buildPngReceiptModel(receipt, customer);
  assert.ok(png.financial.some((row) => row.label === 'Outage Concession / رعایت' && row.value === '-PKR 300'));
  assert.ok(png.financial.some((row) => row.label === 'Remaining Balance / Baqi Rehta' && row.value === 'PKR 0'));

  const fields = escPosFieldsFromPaymentReceipt(receipt);
  assert.equal(fields.concession, 'PKR 300');
  assert.equal(fields.arrearsBalance, 'PKR 0');
  const esc = buildEscPosReceipt(fields);
  assert.match(esc.text, /Outage concession/);
});

test('backup round-trip: concession fields survive a JSON backup merge', () => {
  const without = stateWithBill(3000, 3000);
  const withConcession = stateWithBill(3000, 3000);
  withConcession.customers[0].bills[0] = {
    ...withConcession.customers[0].bills[0],
    concessionAmount: 300,
    concessionReason: 'Outage Reaayat: 72h offline',
    concessionAppliedAt: '2026-10-15 12:00'
  };
  const backup = createJsonBackup(withConcession, REF);
  const preview = previewJsonBackupMerge(without, backup);
  const mergedBill = preview.state.customers[0].bills[0];
  assert.equal(mergedBill.concessionAmount, 300);
  assert.equal(mergedBill.concessionReason, 'Outage Reaayat: 72h offline');
  assert.equal(mergedBill.concessionAppliedAt, '2026-10-15 12:00');
  assert.equal(mergedBill.dueAmount, 3000);
});
