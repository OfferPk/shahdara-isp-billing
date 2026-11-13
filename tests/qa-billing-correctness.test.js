import test from 'node:test';
import assert from 'node:assert/strict';
import { auditBillingCorrectness } from '../qa-billing-correctness.js';
import { countActiveCustomers } from '../pending-works.js';
import { answerOwnerCommand } from '../owner-insights.js';
import { buildPhase3Analytics } from '../phase3.js';

const REF = new Date('2026-11-13T12:00:00+05:00');

function customer(number, overrides = {}) {
  return {
    id: `c${number}`,
    customerNumber: number,
    name: `TEST CUSTOMER ${number}`,
    monthlySellingAmount: 3000,
    monthlyPriceSchedule: [{ amount: 3000, effectiveMonth: '2026-01', recordedAt: '2026-01-01 00:00' }],
    billingStartMonth: '2026-01',
    bills: [],
    archived: false,
    serviceStatus: 'active',
    ...overrides
  };
}

// Subscriber Count & Tab Isolation: the Billing Audit "Total Customers"
// used to be the raw roster length, so archived profiles inflated it.
// The fix rewires it to countActiveCustomers — the same source of truth
// as the dashboard KPI and Pucho counts-overview — while
// archivedCustomers still reports the archived profile separately.
test('audit totalCustomers excludes archived customers and reports them separately', () => {
  const state = {
    customers: [customer(1), customer(2), customer(3, { archived: true, serviceStatus: 'active' })],
    nextCustomerNumber: 4
  };
  const audit = auditBillingCorrectness(state, REF);
  assert.equal(audit.totalCustomers, 2);
  assert.equal(audit.archivedCustomers, 1);
  assert.equal(audit.activeCustomers, 2);
});

// Subscriber Count & Tab Isolation (D1 cross-surface pin, prep §4.3 #1):
// the three headline totals must agree on ONE fixture — they all read the
// same live roster now, so a future rewire of any single surface back to
// the raw array length shows up here instead of silently diverging again.
// (Analytics Profiles is asserted via the unassigned-area rollup: these
// fixture customers carry no zone/mohalla, so they land there.)
test('D1 cross-surface: Pucho total, audit total and Analytics Profiles agree on one fixture', () => {
  const state = {
    customers: [customer(1), customer(2), customer(3, { archived: true, serviceStatus: 'active' })],
    nextCustomerNumber: 4
  };
  assert.equal(countActiveCustomers(state.customers), 2);
  assert.equal(answerOwnerCommand(state, 'Total kitne customer hain?', REF).total, 2);
  assert.equal(auditBillingCorrectness(state, REF).totalCustomers, 2);
  assert.equal(buildPhase3Analytics(state, REF).unassignedArea.profiles, 2);
});
