// Plan 523 — Every payable-derived line uses the shared payable figure:
// the overpayment choice, the underpayment warning and the waada
// remainder used to sum bill balances only, ignoring pending ticket /
// addon charges and manual baqaya — while the amount field defaults
// to payableTotal, which includes all of those. So a payment exactly
// equal to the payable total was offered an "Extra amount" choice for
// a phantom extra, a part-payment warned the customer they owed Rs 0
// while a charge still stood open, and the waada remainder counted
// addon/baqaya only when a ticket charge happened to be pending. This
// plan bases all three lines — in the render functions and in the
// submit-time re-read — on the one shared payable figure
// (activeDefaults.payableTotal). No change to the choice options, the
// warning text shape, waada chip dates, the promise write, or the
// allocation engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpaymentExtraCents } from '../overpayment-choice.js';
import { underpaymentWarning, underpaymentWarningLineText } from '../underpayment-warning.js';
import { computeRemainderWaada } from '../waada-queue.js';
import { calculatePaymentAllocations } from '../core.js';
import { createTicket, resolveTicket } from '../complaint-tickets.js';
import { addSpeedBoost } from '../speed-addon.js';

const dir = dirname(fileURLToPath(import.meta.url));
const navSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');

const REF = new Date('2026-10-15T10:00:00Z');

// Generic fixtures only — clearly made-up names, never a real customer.
function bill(month, dueAmount, payments = []) {
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    id: `B-${month}`,
    month,
    dueAmount,
    status: paid >= dueAmount ? 'paid' : paid > 0 ? 'partial' : 'pending',
    payments,
  };
}

function payment(date, amount, method = 'Cash') {
  return { id: `P-${date}`, date, amount, method };
}

function customerWithBills(bills, overrides = {}) {
  return {
    id: 'CUST-1',
    customerNumber: 1,
    name: 'Customer One',
    mohalla: 'Mohalla A',
    archived: false,
    monthlySellingAmount: 2500,
    bills,
    ...overrides,
  };
}

function stateWith(customer) {
  return { version: 1, nextCustomerNumber: 2, customers: [customer] };
}

// Dues Rs 3,000 on one open bill, plus one billed ticket charge of
// Rs 500 — the plan's acceptance fixture (dues 3,000 + charge 500).
function ticketChargeState() {
  const state = stateWith(customerWithBills([bill('2026-10', 3000)]));
  const created = createTicket({
    customerId: 'CUST-1',
    customerName: 'Customer One',
    faultPreset: 'Fiber Cut / Splice Loss',
    technician: 'Saad',
  }, []);
  const resolved = resolveTicket([created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500 }],
    billingType: 'billed',
    referenceDate: REF,
  });
  return { state, tickets: resolved };
}

// Dues Rs 3,000 plus one unpaid speed-boost addon fee of Rs 500 and
// NO ticket charge — the waada-remainder acceptance fixture.
function addonChargeState() {
  const base = stateWith(customerWithBills([bill('2026-10', 3000)]));
  const { state } = addSpeedBoost(base, 'CUST-1', {
    boostMbps: 15, durationDays: 10, addonFeePKR: 500, startDate: '2026-10-05',
  }, REF);
  return state;
}

// Dues Rs 3,000 plus Rs 500 of unpaid manual baqaya, no ticket or
// addon charge — the third leg of the payable figure.
function baqayaState() {
  return stateWith(customerWithBills([bill('2026-10', 3000)], {
    manualBaqaya: [{ id: 'MBQ-101', amount: 500, date: '2026-09-15', note: 'Old dues', createdAt: '2026-09-15' }],
  }));
}

async function defaultsFor(state, tickets = []) {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  return getCustomerPaymentDefaults(state, 'CUST-1', REF, tickets);
}

// The bill-only sum the three lines used to read — kept here only to
// prove the fixture discriminates the old base from the shared figure.
function billOnlyDuesCents(state) {
  const customer = state.customers[0];
  const allocations = calculatePaymentAllocations(state);
  let duesCents = 0;
  for (const b of (customer.bills ?? [])) {
    const remaining = allocations.forMonth(customer.id, b.month)?.balanceDueCents ?? 0;
    if (remaining > 0) duesCents += remaining;
  }
  return duesCents;
}

// ---------------------------------------------------------------------------
// The shared payable figure — bills + ticket + addon + baqaya
// ---------------------------------------------------------------------------

test('figure ticket charge: payableTotal 3,500 while bill dues are 3,000', async () => {
  const { state, tickets } = ticketChargeState();
  const defaults = await defaultsFor(state, tickets);
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.ticketChargesPending, 500);
  assert.equal(defaults.addonChargesPending, 0);
  assert.equal(defaults.manualBaqayaPending, 0);
  assert.equal(defaults.payableTotal, 3500);
  assert.equal(defaults.suggestedAmount, 3500);
  assert.equal(billOnlyDuesCents(state), 300000);
});

test('figure addon only: payableTotal 3,500 with no ticket charge pending', async () => {
  const state = addonChargeState();
  const defaults = await defaultsFor(state, []);
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.ticketChargesPending, 0);
  assert.equal(defaults.addonChargesPending, 500);
  assert.equal(defaults.payableTotal, 3500);
  assert.equal(defaults.suggestedAmount, 3500);
  assert.equal(billOnlyDuesCents(state), 300000);
});

test('figure manual baqaya only: payableTotal 3,500 with no ticket or addon', async () => {
  const state = baqayaState();
  const defaults = await defaultsFor(state, []);
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.ticketChargesPending, 0);
  assert.equal(defaults.addonChargesPending, 0);
  assert.equal(defaults.manualBaqayaPending, 500);
  assert.equal(defaults.payableTotal, 3500);
  assert.equal(defaults.suggestedAmount, 3500);
  assert.equal(billOnlyDuesCents(state), 300000);
});

test('figure no charges: payableTotal equals bill dues, behaviour unchanged', async () => {
  const state = stateWith(customerWithBills([bill('2026-10', 3000)]));
  const defaults = await defaultsFor(state, []);
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.payableTotal, 3000);
  assert.equal(defaults.suggestedAmount, 3000);
  assert.equal(billOnlyDuesCents(state), 300000);
});

// ---------------------------------------------------------------------------
// Acceptance — overpayment: a payment exactly equal to the payable
// total offers no choice; the old bill-only base offered a phantom one
// ---------------------------------------------------------------------------

test('overpayment: amount 3,500 against payable 3,500 offers no choice', () => {
  assert.equal(overpaymentExtraCents(350000, 350000), 0);
  assert.equal(overpaymentExtraCents(350000, 400000), 50000);
  // Contrast: the old bill-only base (3,000) would have offered a
  // phantom Rs 500 choice on the exact payable amount.
  assert.equal(overpaymentExtraCents(300000, 350000), 50000);
});

test('overpayment: zero dues offers nothing, never an invented extra', () => {
  assert.equal(overpaymentExtraCents(0, 50000), 50000);
  assert.equal(overpaymentExtraCents(350000, 0), 0);
});

// ---------------------------------------------------------------------------
// Acceptance — underpayment: a Rs 3,000 part-payment against payable
// Rs 3,500 warns Rs 500 still owed
// ---------------------------------------------------------------------------

test('underpayment: amount 3,000 against payable 3,500 warns Rs 500 still owed', () => {
  assert.deepEqual(underpaymentWarning(350000, 300000), {
    amountCents: 300000, duesCents: 350000, remainingCents: 50000,
  });
  assert.equal(
    underpaymentWarningLineText(underpaymentWarning(350000, 300000)),
    'Paid PKR 3,000 of PKR 3,500 dues — PKR 500 still due'
  );
  // Contrast: the old bill-only base (3,000) warned about nothing —
  // the customer was told they owed Rs 0 while Rs 500 of charges
  // still stood open.
  assert.equal(underpaymentWarning(300000, 300000), null);
});

test('underpayment: amount covering the payable in full warns nothing', () => {
  assert.equal(underpaymentWarning(350000, 350000), null);
  assert.equal(underpaymentWarning(350000, 400000), null);
});

// ---------------------------------------------------------------------------
// Acceptance — waada remainder: addon pending, no ticket charge — the
// remainder is payable total minus typed amount
// ---------------------------------------------------------------------------

test('waada remainder: addon pending, no ticket — remainder is payable minus typed', () => {
  assert.deepEqual(computeRemainderWaada(3500, 3000), { remainder: 500 });
  assert.equal(computeRemainderWaada(3500, 3500), null);
  // Contrast: the old ticket-gated base read total dues (3,000) here,
  // so a Rs 3,000 typed amount hid the row entirely instead of
  // showing the Rs 500 remainder.
  assert.equal(computeRemainderWaada(3000, 3000), null);
});

test('waada remainder: no charges — remainder is dues minus typed, as before', () => {
  assert.deepEqual(computeRemainderWaada(3000, 2500), { remainder: 500 });
  assert.equal(computeRemainderWaada(3000, 3000), null);
});

// ---------------------------------------------------------------------------
// Wiring — the three render functions read the shared payable figure
// ---------------------------------------------------------------------------

function fnSlice(name, endMarker) {
  const start = navSrc.indexOf(`function ${name}()`);
  assert.ok(start > 0, `${name} must exist`);
  const end = navSrc.indexOf(endMarker, start);
  assert.ok(end > start, `end marker for ${name} must follow it`);
  return navSrc.slice(start, end);
}

test('wiring: the overpayment choice reads the shared payable figure', () => {
  const fn = fnSlice('renderOverpaymentChoice', 'function renderUnderpaymentWarning()');
  assert.ok(fn.includes('activeDefaults.payableTotal'), 'choice reads the shared payable figure');
  assert.ok(fn.includes('overpaymentExtraCents(payableCents, amountCents)'), 'choice passes the payable figure to the pure helper');
  assert.ok(!fn.includes('calculatePaymentAllocations(state)'), 'choice no longer re-sums bill balances');
  assert.ok(!fn.includes('allocations.forMonth(customer.id, bill.month)?.balanceDueCents'), 'choice no longer reads bill-only balances');
});

test('wiring: the underpayment warning reads the shared payable figure', () => {
  const fn = fnSlice('renderUnderpaymentWarning', 'function renderSuspendedWarning()');
  assert.ok(fn.includes('activeDefaults.payableTotal'), 'warning reads the shared payable figure');
  assert.ok(fn.includes('underpaymentWarning(payableCents, amountCents)'), 'warning passes the payable figure to the pure helper');
  assert.ok(!fn.includes('calculatePaymentAllocations(state)'), 'warning no longer re-sums bill balances');
  assert.ok(!fn.includes('allocations.forMonth(customer.id, bill.month)?.balanceDueCents'), 'warning no longer reads bill-only balances');
});

test('wiring: the waada remainder is always the shared payable figure', () => {
  const fn = fnSlice('renderRemainderWaadaRow', '// Chip taps are the ONLY way');
  assert.ok(fn.includes('const payable = activeDefaults.payableTotal;'), 'remainder is the shared payable figure, unconditionally');
  assert.ok(!fn.includes('ticketChargesPending > 0'), 'remainder no longer gates on a ticket charge');
  assert.ok(fn.includes('computeRemainderWaada(payable, Number(amountInput?.value))'), 'remainder still goes through the shared helper');
});

test('wiring: the submit-time re-read records the shared payable figure', () => {
  const start = navSrc.indexOf('let selectedOverpaymentChoice = \'\';');
  assert.ok(start > 0, 'submit overpayment block must exist');
  // End at the Plan 395 excess-cash block: that separate feature keeps
  // its own dues read and is out of this plan's scope.
  const end = navSrc.indexOf('// Plan 395: the excess cash note', start);
  assert.ok(end > start, 'submit overpayment block must end at the excess-cash block');
  const block = navSrc.slice(start, end);
  assert.ok(block.includes('overpaymentDuesCents = Math.round(Number(activeDefaults?.payableTotal ?? 0) * 100);'), 'submit re-read uses the shared payable figure');
  assert.ok(!block.includes('submitAllocations.forMonth'), 'submit re-read no longer re-sums bill balances');
  assert.ok(navSrc.includes('overpaymentDuesCents: selectedOverpaymentChoice ? overpaymentDuesCents : undefined,'), 'the recorded dues still ride the choice');
});

// ---------------------------------------------------------------------------
// Guards — the old bill-only base is gone from the payable-derived
// lines; neighbouring features are untouched
// ---------------------------------------------------------------------------

test('guard: no payable-derived line still sums bill balances only', () => {
  for (const name of ['renderOverpaymentChoice', 'renderUnderpaymentWarning', 'renderRemainderWaadaRow']) {
    const fn = fnSlice(name, name === 'renderOverpaymentChoice'
      ? 'function renderUnderpaymentWarning()'
      : name === 'renderUnderpaymentWarning'
        ? 'function renderSuspendedWarning()'
        : '// Chip taps are the ONLY way');
    assert.ok(!fn.includes('for (const bill of (customer.bills ?? []))'), `${name} must not loop bills for its base`);
  }
});

test('boundary: the excess-cash note and the package-change reopen are untouched', () => {
  // Plan 395's excess-cash note is a separate feature with its own
  // dues read — this plan does not change it.
  assert.ok(navSrc.includes('selectedExcessCashPurpose'), 'excess-cash note block still exists');
  assert.ok(navSrc.includes('excessCashDuesCents'), 'excess-cash dues read still exists');
  // Polish #13's package-change reopen keeps the typed amount.
  assert.ok(navSrc.includes('packageChangeAmountOptions('), 'package-change reopen still uses its helper');
});
