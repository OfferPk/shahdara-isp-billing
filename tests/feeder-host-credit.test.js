// SISP-97: Upstream Feeder / Switch Power-Host Electricity Credit
// (feederHostCreditPKR). Pure-function + state-layer tests on synthetic
// data only.
// Spec test criterion (verbatim): "Configuring feederHostCreditPKR: 300
// on Upstream House A reduces House A's monthly bill from Rs. 3,000 to
// Rs. 2,700 during the SISP-2 cycle."
//
// The credit follows the SISP-30 concession precedent exactly: it is
// stamped on the bill as audited fields (feederHostCreditAmount +
// feederHostCreditReason + feederHostCreditAppliedAt + amountHistory),
// dueAmount is never rewritten, and the receipt layers subtract the
// stamp. calculatePaymentAllocations is deliberately NOT touched (the
// FU1b fix owns engine-side subtraction of bill-field waivers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FEEDER_HOST_CREDIT_REASON,
  activeDownstreamCount,
  clampFeederHostCredit,
  eligibleFeederHostCredit,
  feederHostCreditOf,
  isFeederHost,
  sanitizeFeederHostCreditPKR
} from '../feeder-host-credit.js';
import {
  applyBillingCycle,
  arrearsBreakdownTextLines,
  buildArrearsBreakdown,
  planBillingCycle,
  planCustomerCycleLine,
  runBillingCycle,
  sanitizeBillingCycles
} from '../billing-cycle.js';
import {
  addPayment,
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge,
  updateCustomerProfile
} from '../core.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { buildEscPosReceipt, escPosFieldsFromPaymentReceipt } from '../thermal-printer.js';
import { feederHostCreditPresentation } from '../profile-ui.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const REF = new Date('2026-10-01T09:00:00+05:00');
const REF_PAY = new Date('2026-10-06T12:00:00+05:00');

const bill = (month, overrides) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending',
  payments: [], generated: true, priceSnapshot: 3000,
  createdAt: '2026-09-01T00:00:00.000Z', amountHistory: [], ...overrides
});
const customer = (id, number, name, overrides) => ({
  id, customerNumber: number, name, archived: false, billingStartMonth: null,
  // Price starts 2026-10 so no earlier month is billable (addPayment's
  // auto-generator would otherwise backfill Aug/Sep bills as arrears).
  monthlyPriceSchedule: [{ effectiveMonth: '2026-10', amount: 3000 }],
  bills: [], incidents: [], ...overrides
});
// Upstream House A feeds Downstream House B; House C stands alone.
const hostState = (credit = 300) => ({
  customers: [
    customer('a', 1, 'Upstream House A', { feederHostCreditPKR: credit }),
    customer('b', 2, 'Downstream House B', { upstreamCustomerId: 'a' }),
    customer('c', 3, 'Standalone House C')
  ]
});

test('sanitizer: clean money or 0; clamp never exceeds the package fee', () => {
  assert.equal(sanitizeFeederHostCreditPKR(300), 300);
  assert.equal(sanitizeFeederHostCreditPKR('250.50'), 250.5);
  assert.equal(sanitizeFeederHostCreditPKR(-50), 0);
  assert.equal(sanitizeFeederHostCreditPKR('abc'), 0);
  assert.equal(sanitizeFeederHostCreditPKR(''), 0);
  assert.equal(sanitizeFeederHostCreditPKR(null), 0);
  assert.equal(sanitizeFeederHostCreditPKR(undefined), 0);
  assert.equal(feederHostCreditOf({ feederHostCreditPKR: 200 }), 200);
  assert.equal(feederHostCreditOf({}), 0);
  assert.equal(clampFeederHostCredit(300, 3000), 300);
  assert.equal(clampFeederHostCredit(5000, 3000), 3000, 'clamped at the package fee');
  assert.equal(clampFeederHostCredit(300, 0), 0);
  assert.equal(clampFeederHostCredit(300, null), 0);
  assert.equal(clampFeederHostCredit(0, 3000), 0);
});

test('eligibility: derived live from the SISP-7 topology walk', () => {
  const state = hostState();
  const [a, b, c] = state.customers;
  assert.equal(isFeederHost(state.customers, a), true);
  assert.equal(activeDownstreamCount(state.customers, 'a'), 1);
  assert.equal(eligibleFeederHostCredit(state.customers, a), 300);
  assert.equal(isFeederHost(state.customers, b), false, 'a fed house is not itself a host');
  assert.equal(isFeederHost(state.customers, c), false);
  assert.equal(eligibleFeederHostCredit(state.customers, c), 0);

  // Transitive: A -> B -> D counts both active homes.
  const chain = {
    customers: [
      customer('a', 1, 'Upstream House A', { feederHostCreditPKR: 300 }),
      customer('b', 2, 'Middle House B', { upstreamCustomerId: 'a' }),
      customer('d', 4, 'Far House D', { upstreamCustomerId: 'b' })
    ]
  };
  assert.equal(activeDownstreamCount(chain.customers, 'a'), 2);
  assert.equal(isFeederHost(chain.customers, chain.customers[0]), true);

  // An archived middle house is traversed through: the active far home
  // still counts (its power still flows through the host).
  const throughArchived = {
    customers: [
      customer('a', 1, 'Upstream House A', { feederHostCreditPKR: 300 }),
      customer('b', 2, 'Middle House B', { upstreamCustomerId: 'a', archived: true }),
      customer('d', 4, 'Far House D', { upstreamCustomerId: 'b' })
    ]
  };
  assert.equal(activeDownstreamCount(throughArchived.customers, 'a'), 1);
  assert.equal(isFeederHost(throughArchived.customers, throughArchived.customers[0]), true);

  // The only downstream home archived -> nobody active is fed -> no host.
  const deadEnd = {
    customers: [
      customer('a', 1, 'Upstream House A', { feederHostCreditPKR: 300 }),
      customer('b', 2, 'Downstream House B', { upstreamCustomerId: 'a', archived: true })
    ]
  };
  assert.equal(activeDownstreamCount(deadEnd.customers, 'a'), 0);
  assert.equal(isFeederHost(deadEnd.customers, deadEnd.customers[0]), false);
  assert.equal(eligibleFeederHostCredit(deadEnd.customers, deadEnd.customers[0]), 0);
  // An archived house is never a host, even with links pointing away.
  assert.equal(isFeederHost(deadEnd.customers, { ...deadEnd.customers[0], archived: true }), false);
});

test('profile guard: a non-host can never hold the credit (sanitizer zeroes it)', () => {
  let state = createInitialState(['Host House', 'Fed House', 'Solo House']);
  // Link Fed House to Host House, then configure credits.
  state = updateCustomerProfile(state, 'seed-002', { upstreamCustomerId: 'seed-001' }, REF);
  state = updateCustomerProfile(state, 'seed-001', { feederHostCreditPKR: '300' }, REF);
  assert.equal(state.customers[0].feederHostCreditPKR, 300, 'a genuine host keeps its configured credit');
  state = updateCustomerProfile(state, 'seed-003', { feederHostCreditPKR: '300' }, REF);
  assert.equal(state.customers[2].feederHostCreditPKR, 0, 'a house feeding nobody is refused (zeroed)');
  state = updateCustomerProfile(state, 'seed-002', { feederHostCreditPKR: '300' }, REF);
  assert.equal(state.customers[1].feederHostCreditPKR, 0, 'a fed house that feeds nobody is refused too');
  // Garbage input sanitizes to 0 even for a host.
  state = updateCustomerProfile(state, 'seed-001', { feederHostCreditPKR: '-50' }, REF);
  assert.equal(state.customers[0].feederHostCreditPKR, 0);
  // Once the last downstream link is removed, the host's own next save
  // zeroes the stale amount instead of letting it survive.
  state = updateCustomerProfile(state, 'seed-001', { feederHostCreditPKR: '300' }, REF);
  assert.equal(state.customers[0].feederHostCreditPKR, 300);
  state = updateCustomerProfile(state, 'seed-002', { upstreamCustomerId: '' }, REF);
  state = updateCustomerProfile(state, 'seed-001', { notes: 'routine edit' }, REF);
  assert.equal(state.customers[0].feederHostCreditPKR, 0, 'stale credit zeroed on the host\u2019s next save');
});

test('SPEC PIN: feederHostCreditPKR 300 on Upstream House A -> Rs. 3,000 bill, Rs. 2,700 net due in the SISP-2 cycle', () => {
  const state = hostState(300);
  const plan = planBillingCycle(state, '2026-10');
  const lineA = plan.lines.find((line) => line.customerId === 'a');
  assert.equal(lineA.skipped, false);
  assert.equal(lineA.currentMonthBill, 3000);
  assert.equal(lineA.feederCreditApplied, 300);
  assert.equal(lineA.netDue, 2700);
  const lineB = plan.lines.find((line) => line.customerId === 'b');
  assert.equal(lineB.feederCreditApplied, 0);
  assert.equal(lineB.netDue, 3000);
  assert.equal(plan.totals.totalFeederHostCredit, 300);
  assert.equal(plan.totals.netExpectedCollection, 2700 + 3000 + 3000);

  const { state: next, cycle } = runBillingCycle(state, '2026-10', [], REF);
  assert.equal(cycle.totals.totalFeederHostCredit, 300);
  const hostA = next.customers.find((row) => row.id === 'a');
  const october = hostA.bills.find((row) => row.month === '2026-10');
  assert.equal(october.dueAmount, 3000, 'the bill amount itself is never rewritten');
  assert.equal(october.feederHostCreditAmount, 300);
  assert.equal(october.feederHostCreditReason, FEEDER_HOST_CREDIT_REASON);
  assert.ok(october.feederHostCreditAppliedAt);
  const history = october.amountHistory.filter((entry) => entry.type === 'feeder_host_credit_applied');
  assert.equal(history.length, 1);
  assert.equal(history[0].feederHostCredit, 300);
  const houseB = next.customers.find((row) => row.id === 'b');
  assert.equal(houseB.bills[0].feederHostCreditAmount, undefined, 'only the host is stamped');
});

test('receipt: paying Rs. 2,700 settles the stamped bill as PAID on every receipt surface', () => {
  const { state: cycled } = runBillingCycle(hostState(300), '2026-10', [], REF);
  const paid = addPayment(cycled, 'a', '2026-10', { amount: 2700, date: '2026-10-06', method: 'Cash' }, REF_PAY);
  const hostA = paid.customers.find((row) => row.id === 'a');
  const october = hostA.bills.find((row) => row.month === '2026-10');
  const payment = october.payments.at(-1);
  const receipt = buildPaymentReceipt(hostA, october, payment);
  assert.equal(receipt.feederHostCreditAmount, 300);
  assert.equal(receipt.feederHostCreditReason, FEEDER_HOST_CREDIT_REASON);
  assert.equal(receipt.balanceDueCents, 0);
  assert.equal(receipt.status, 'PAID');

  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.match(a4, /Feeder Host Bijli Credit/);
  const t80 = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
  assert.match(t80, /Feeder Host Credit/);
  const t58 = generatePaymentReceiptHtml(receipt, { format: 'thermal-58' });
  assert.match(t58, /Feeder Host Credit/);

  const breakdown = buildArrearsBreakdown(hostA, october);
  assert.equal(breakdown.feederHostCreditAmount, 300);
  assert.ok(arrearsBreakdownTextLines(breakdown).some((line) => line === 'Feeder Host Bijli Credit: -PKR 300'));

  const png = buildPngReceiptModel(receipt, hostA);
  assert.ok(png.financial.some((row) => row.label === 'Feeder Host Credit / فیڈر ہوسٹ کریڈٹ' && row.value === '-PKR 300'));
  assert.ok(png.financial.some((row) => row.label === 'Remaining Balance / Baqi Rehta' && row.value === 'PKR 0'));

  const fields = escPosFieldsFromPaymentReceipt(receipt);
  assert.equal(fields.feederHostCredit, 'PKR 300');
  assert.equal(fields.arrearsBalance, 'PKR 0');
  const esc = buildEscPosReceipt(fields);
  assert.match(esc.text, /Feeder host credit/);
});

test('exactly once: a re-applied cycle never double-stamps, and an adopted bill is stamped like a created one', () => {
  const { state: cycled } = runBillingCycle(hostState(300), '2026-10', [], REF);
  // Backstop re-apply (cycle record lost): the bill already carries the
  // stamp, so the plan applies 0 new credit and nothing is re-stamped.
  const line = planCustomerCycleLine(cycled.customers[0], '2026-10', 0, 300);
  assert.equal(line.feederCreditApplied, 0, 'already-stamped bill receives no second credit');
  const reapplied = applyBillingCycle(cycled, '2026-10', REF);
  const hostA = reapplied.state.customers.find((row) => row.id === 'a');
  assert.equal(hostA.bills.length, 1);
  const october = hostA.bills[0];
  assert.equal(october.feederHostCreditAmount, 300, 'still exactly 300, never 600');
  assert.equal(october.amountHistory.filter((entry) => entry.type === 'feeder_host_credit_applied').length, 1);

  // Adopted path: the auto-generator already created October's bill.
  const preGenerated = hostState(300);
  preGenerated.customers[0] = { ...preGenerated.customers[0], bills: [bill('2026-10')] };
  const adopted = applyBillingCycle(preGenerated, '2026-10', REF);
  const adoptedA = adopted.state.customers.find((row) => row.id === 'a');
  assert.deepEqual(adopted.createdBillIds, adopted.createdBillIds.filter((id) => id !== 'bill-2026-10'));
  assert.equal(adoptedA.bills.length, 1, 'no second bill is created for the month');
  assert.equal(adoptedA.bills[0].dueAmount, 3000);
  assert.equal(adoptedA.bills[0].feederHostCreditAmount, 300);
});

test('live derivation at cycle time: link removed or downstream archived -> no credit next cycle', () => {
  // Link removed before the cycle ever runs.
  const unlinked = hostState(300);
  unlinked.customers[1] = { ...unlinked.customers[1], upstreamCustomerId: '' };
  const planUnlinked = planBillingCycle(unlinked, '2026-10');
  assert.equal(planUnlinked.lines.find((line) => line.customerId === 'a').feederCreditApplied, 0);
  assert.equal(planUnlinked.lines.find((line) => line.customerId === 'a').netDue, 3000);
  assert.equal(planUnlinked.totals.totalFeederHostCredit, 0);

  // Downstream archived before the cycle.
  const archivedDown = hostState(300);
  archivedDown.customers[1] = { ...archivedDown.customers[1], archived: true };
  const planArchived = planBillingCycle(archivedDown, '2026-10');
  assert.equal(planArchived.lines.find((line) => line.customerId === 'a').feederCreditApplied, 0);

  // Month 2 after the link is removed: October was stamped + settled,
  // November gets no stamp at all.
  const { state: cycled } = runBillingCycle(hostState(300), '2026-10', [], REF);
  const paid = addPayment(cycled, 'a', '2026-10', { amount: 2700, date: '2026-10-06', method: 'Cash' }, REF_PAY);
  const novState = {
    customers: paid.customers.map((row) => (row.id === 'b' ? { ...row, upstreamCustomerId: '' } : row))
  };
  const novPlan = planBillingCycle(novState, '2026-11');
  assert.equal(novPlan.lines.find((line) => line.customerId === 'a').feederCreditApplied, 0);
  const novApplied = applyBillingCycle(novState, '2026-11', new Date('2026-11-01T09:00:00+05:00'));
  const hostA = novApplied.state.customers.find((row) => row.id === 'a');
  const november = hostA.bills.find((row) => row.month === '2026-11');
  assert.equal(november.feederHostCreditAmount, undefined, 'no stamp once the host feeds nobody');
});

test('guards: paused and FREE hosts are skipped whole; oversized credit clamps to the package fee', () => {
  const paused = hostState(300);
  paused.customers[0] = { ...paused.customers[0], paused: true, pauseStartDate: '2026-10-01', autoResumeDate: null };
  const planPaused = planBillingCycle(paused, '2026-10');
  assert.equal(planPaused.skipped.find((line) => line.customerId === 'a').reason, 'paused');
  assert.equal(planPaused.totals.totalFeederHostCredit, 0, 'a paused month earns no credit');

  const free = hostState(300);
  free.customers[0] = { ...free.customers[0], isFreeConnection: true };
  const planFree = planBillingCycle(free, '2026-10');
  assert.equal(planFree.skipped.find((line) => line.customerId === 'a').reason, 'free-connection');

  const oversized = planBillingCycle(hostState(5000), '2026-10');
  const lineA = oversized.lines.find((line) => line.customerId === 'a');
  assert.equal(lineA.feederCreditApplied, 3000, 'credit clamps at the month\u2019s package fee');
  assert.equal(lineA.netDue, 0, 'never below zero, never phantom advance');
  assert.equal(lineA.remainingAdvance, 0);
});

test('cycle record + backup: totals sanitize and both the config and the stamp survive a merge', () => {
  const [record] = sanitizeBillingCycles([{ month: '2026-10', ranAt: 'x', totals: { totalFeederHostCredit: 300 } }]);
  assert.equal(record.totals.totalFeederHostCredit, 300);
  const [legacy] = sanitizeBillingCycles([{ month: '2026-09', ranAt: 'x', totals: {} }]);
  assert.equal(legacy.totals.totalFeederHostCredit, 0, 'pre-SISP-97 cycle records read as 0');

  // Backup of a cycled host merged onto a device whose records predate
  // the feature: the configured amount and the bill stamp both land.
  const { state: cycled } = runBillingCycle(hostState(300), '2026-10', [], REF);
  const backupState = {
    version: 1, nextCustomerNumber: 4,
    customers: cycled.customers, inventoryItems: [], inventoryMovements: [],
    expenses: [], saadAttendanceDays: [], umairWorkdays: [], monthlyClosings: []
  };
  const baseState = {
    version: 1, nextCustomerNumber: 4,
    customers: [
      { ...customer('a', 1, 'Upstream House A'), feederHostCreditPKR: undefined, bills: [bill('2026-10')] },
      customer('b', 2, 'Downstream House B', { upstreamCustomerId: 'a' }),
      customer('c', 3, 'Standalone House C')
    ],
    inventoryItems: [], inventoryMovements: [], expenses: [], saadAttendanceDays: [], umairWorkdays: [], monthlyClosings: []
  };
  const backup = createJsonBackup(backupState, REF);
  const preview = previewJsonBackupMerge(baseState, backup);
  const mergedA = preview.state.customers.find((row) => row.id === 'a');
  assert.equal(mergedA.feederHostCreditPKR, 300);
  const mergedBill = mergedA.bills.find((row) => row.month === '2026-10');
  assert.equal(mergedBill.feederHostCreditAmount, 300);
  assert.equal(mergedBill.feederHostCreditReason, FEEDER_HOST_CREDIT_REASON);
  assert.ok(mergedBill.feederHostCreditAppliedAt);
  assert.equal(mergedBill.dueAmount, 3000);
});

test('profile presentation: configured credit shows with its live eligibility label', () => {
  const state = hostState(300);
  const host = feederHostCreditPresentation(state.customers[0], state.customers);
  assert.equal(host.show, true);
  assert.equal(host.creditPKR, 300);
  assert.equal(host.activeDownstream, 1);
  assert.equal(host.eligible, true);
  assert.match(host.label, /PKR 300/);
  const unlinked = hostState(300);
  unlinked.customers[1] = { ...unlinked.customers[1], upstreamCustomerId: '' };
  const stale = feederHostCreditPresentation(unlinked.customers[0], unlinked.customers);
  assert.equal(stale.show, true, 'a stale amount stays visible rather than vanishing');
  assert.equal(stale.eligible, false);
  assert.match(stale.label, /feeds no active downstream/);
  const none = feederHostCreditPresentation(state.customers[2], state.customers);
  assert.equal(none.show, false);
});

test('i18n audit: every fhost_ key used by the UI exists in en + ur and never renders raw', () => {
  const used = new Set();
  for (const file of ['../app.js', '../profile-ui.js']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/'(fhost_[a-z_]+)'/g)) used.add(match[1]);
  }
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const match of indexHtml.matchAll(/data-i18n="(fhost_[a-z_]+)"/g)) used.add(match[1]);
  assert.deepEqual([...used].sort(), [
    'fhost_form_label', 'fhost_form_note', 'fhost_profile_applied', 'fhost_profile_ineligible'
  ]);
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.notEqual(t(key, 'en'), key, `t() returned the raw key for ${key}`);
    assert.notEqual(t(key, 'ur'), key, `t() returned the raw key for ${key}`);
  }
});
