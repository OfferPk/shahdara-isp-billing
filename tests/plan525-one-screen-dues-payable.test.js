// Plan 525 — One-screen dues line matches the prefilled amount:
// the one-screen flow set its dues line from
// quickCollectOneScreenDuesText(activeDefaults.totalDues) — bill dues
// only — while the amount field prefills from
// activeDefaults.suggestedAmount, the payable total including charges
// and baqaya. With a charge pending the screen said "Total dues:
// PKR 3,000" above an amount field holding Rs 3,500, with nothing
// explaining the Rs 500. This plan shows the payable figure on the
// dues line (the same figure the amount prefills), labelled
// "Total payable". Touch only the one-screen dues line and its module
// text; no figure, prefill, or allocation change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quickCollectOneScreenDuesText } from '../quick-collect-one-screen.js';
import { createTicket, resolveTicket } from '../complaint-tickets.js';

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

// Dues Rs 3,000 and no charge pending — the no-charge fixture.
function noChargeState() {
  return { state: stateWith(customerWithBills([bill('2026-10', 3000)])), tickets: [] };
}

async function defaultsFor(state, tickets = []) {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  return getCustomerPaymentDefaults(state, 'CUST-1', REF, tickets);
}

function oneScreenBlock() {
  const start = navSrc.indexOf('function bindOneScreenControls');
  assert.notEqual(start, -1);
  const end = navSrc.indexOf('function submitOneScreenPayment', start);
  assert.notEqual(end, -1);
  return navSrc.slice(start, end);
}

test('the dues line names the payable figure, not bill dues alone', () => {
  assert.equal(quickCollectOneScreenDuesText(350000), 'Total payable: PKR 3,500');
  assert.equal(quickCollectOneScreenDuesText(300000), 'Total payable: PKR 3,000');
});

test('the dues line still prints a zero payable instead of hiding it', () => {
  assert.equal(quickCollectOneScreenDuesText(0), 'Total payable: PKR 0');
});

test('the dues line stays empty without a usable figure', () => {
  assert.equal(quickCollectOneScreenDuesText(null), '');
  assert.equal(quickCollectOneScreenDuesText(undefined), '');
  assert.equal(quickCollectOneScreenDuesText(-100), '');
  assert.equal(quickCollectOneScreenDuesText(true), '');
});

test('wiring: the one-screen dues line is fed the prefilled amount figure', () => {
  const block = oneScreenBlock();
  assert.match(block, /quickCollectOneScreenDuesText\(activeDefaults\.suggestedAmount\)/);
});

test('wiring: the one-screen dues line is no longer fed bill dues only', () => {
  const block = oneScreenBlock();
  assert.doesNotMatch(block, /quickCollectOneScreenDuesText\(activeDefaults\.totalDues\)/);
});

test('fixture with a pending charge: the dues line and the prefilled amount agree', async () => {
  const { state, tickets } = ticketChargeState();
  const defaults = await defaultsFor(state, tickets);
  // The old line read bill dues only (3,000) while the field held
  // the payable total (3,500); the two figures disagreed by the
  // Rs 500 charge.
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.suggestedAmount, 3500);
  const duesText = quickCollectOneScreenDuesText(Math.round(defaults.suggestedAmount * 100));
  assert.equal(duesText, 'Total payable: PKR 3,500');
  // The amount field prefills from the same figure, formatted the
  // same way the one screen fills it (two decimals).
  const prefilled = defaults.suggestedAmount > 0 ? defaults.suggestedAmount.toFixed(2) : '';
  assert.equal(prefilled, '3500.00');
  assert.equal(Number(prefilled), 3500);
});

test('fixture with no charge: the dues line reads the same figure as before', async () => {
  const { state, tickets } = noChargeState();
  const defaults = await defaultsFor(state, tickets);
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.suggestedAmount, 3000);
  assert.equal(
    quickCollectOneScreenDuesText(Math.round(defaults.suggestedAmount * 100)),
    'Total payable: PKR 3,000',
  );
});

test('the module is still pure: no imports, no store, no date, no document, no recorder call', () => {
  const source = readFileSync(new URL('../quick-collect-one-screen.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\s/);
  assert.doesNotMatch(source, /require\(/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /new Date\(/);
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /addPayment\(/);
});
