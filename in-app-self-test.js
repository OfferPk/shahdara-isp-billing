/**
 * SISP-150: 150-Phase In-Browser Isolated Smoke-Test Runner.
 *
 * A [🧪 Run 150-Phase Self-Test] button in the System Health Center
 * (SISP-100) runs 25+ end-to-end assertions against the app's REAL pure
 * engines — the allocation engine, the SISP-2 billing cycle, SISP-33
 * FIFO, SISP-34 void, the Advance recorder, SISP-61 prepay quotes,
 * SISP-35 group dues and the Khata Doctor — entirely in memory.
 *
 * ISOLATION IS THE FEATURE:
 * - every fixture is built fresh inside this module from SYNTHETIC data
 *   (names like "Self-Test Customer" — never a real customer's name,
 *   never a clone of a live record);
 * - the runner never receives, reads or writes the live state, and
 *   never touches localStorage (this module contains no storage calls
 *   at all — pinned by tests/in-app-self-test.test.js);
 * - runSelfTests() is a pure function (no DOM), so the Node test suite
 *   drives exactly the code the browser runs.
 *
 * HOST NOTE: the System Health Center dialog (#systemHealthModal)
 * ships with SISP-100. This module is imported ONLY by app.js; its
 * setup mounts the button + results panel into that dialog at runtime
 * when the dialog exists, and is a safe no-op when it does not — so the
 * branch builds and tests cleanly with or without the host present.
 *
 * Assertion labels are technical English strings naming the phase and
 * engine they guard (the System Health Center's own convention for its
 * technical rows); the panel chrome (title, button, summary, isolation
 * note) is translated via selftest_* keys in nav-language.js.
 */

import {
  addPayment,
  calculateMethodCollectionTotals,
  calculatePaymentAllocations,
  createInitialState,
  derivedBillStatus,
  generateMonthlyBillsThroughCurrentMonth,
  updateCustomerProfile
} from './core.js';
import {
  allocateFifoPayment,
  arrearsAndAdvance,
  planCustomerCycleLine
} from './billing-cycle.js';
import { computeLedgerBalance, runKhataDoctor } from './qa-khata-doctor.js';
import { advanceBalanceCents, recordAdvancePayment } from './advance-payment.js';
import { prepayQuote } from './advance-prepay.js';
import { isVoidedPayment, voidPayment } from './payment-void-audit.js';
import { createInstallmentPlan, kistSchedule } from './installment-plan.js';
import { buildPaymentReceipt } from './receipt.js';
import { buildGroupDue } from './group-billing.js';
import { getAppLanguage, t } from './nav-language.js';

/* ------------------------------------------------------------------ */
/* Synthetic fixtures (fresh objects per check — checks cannot leak)   */
/* ------------------------------------------------------------------ */

const REF_OCT = new Date(2026, 9, 29, 12); // fixed clock: 29 Oct 2026

const stBill = (overrides = {}, payments = []) => ({
  id: 'st-bill-2026-10',
  month: '2026-10',
  dueAmount: 3000,
  dueDate: '2026-10-05',
  status: 'pending',
  generated: true,
  priceSnapshot: 3000,
  amountHistory: [],
  payments,
  ...overrides
});

const stPay = (amount, overrides = {}) => ({
  id: 'st-pay-1',
  date: '2026-10-06',
  amount,
  method: 'Cash',
  ...overrides
});

const stCustomer = (id, bills, overrides = {}) => ({
  id,
  customerNumber: 901,
  name: 'Self-Test Customer',
  archived: false,
  isFreeConnection: false,
  billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 3000 }],
  installmentPlans: [],
  bills,
  ...overrides
});

const engineSummary = (customer, month = '2026-10') => {
  const allocations = calculatePaymentAllocations({ customers: [customer] });
  return { allocations, summary: allocations.forMonth(customer.id, month) };
};

function expectEq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${expected}, got ${actual}`);
  }
}

function expectTrue(value, what) {
  if (value !== true) throw new Error(`${what}: expected true, got ${value}`);
}

/* ------------------------------------------------------------------ */
/* The checks. Each run() returns true or throws with a detail.        */
/* ------------------------------------------------------------------ */

export const SELF_TEST_CHECKS = Object.freeze([
  {
    id: 'net-due-basic',
    label: 'SISP-2 · Bill cycle: net due = package price for a clean month',
    run() {
      const line = planCustomerCycleLine(stCustomer('st-c1', []), '2026-10');
      expectEq(line.skipped, false, 'skipped');
      expectEq(line.currentMonthBill, 3000, 'currentMonthBill');
      expectEq(line.netDue, 3000, 'netDue');
      return true;
    }
  },
  {
    id: 'net-due-arrears',
    label: 'SISP-2 · Bill cycle: previous arrears add to the next net due',
    run() {
      const cust = stCustomer('st-c2', [
        stBill({ id: 'st-bill-2026-09', month: '2026-09' }, [stPay(2000, { id: 'st-pay-sep' })])
      ]);
      const line = planCustomerCycleLine(cust, '2026-10');
      expectEq(line.previousArrears, 1000, 'previousArrears');
      expectEq(line.netDue, 4000, 'netDue');
      return true;
    }
  },
  {
    id: 'net-due-advance',
    label: 'SISP-2 · Bill cycle: advance credit reduces the net due',
    run() {
      const cust = stCustomer('st-c3', [
        stBill({ id: 'st-bill-2026-09', month: '2026-09' }, [stPay(4000, { id: 'st-pay-sep' })])
      ]);
      const line = planCustomerCycleLine(cust, '2026-10');
      expectEq(line.advanceCredit, 1000, 'advanceCredit');
      expectEq(line.netDue, 2000, 'netDue');
      return true;
    }
  },
  {
    id: 'engine-settles-paid',
    label: 'Engine · Allocation: a full payment settles the bill (status paid)',
    run() {
      const cust = stCustomer('st-c4', [stBill({}, [stPay(3000)])]);
      const { allocations, summary } = engineSummary(cust);
      expectEq(summary.balanceDueCents, 0, 'balanceDueCents');
      expectEq(derivedBillStatus(cust, cust.bills[0], allocations), 'paid', 'status');
      return true;
    }
  },
  {
    id: 'engine-partial',
    label: 'Engine · Allocation: a partial payment leaves the exact remainder (status partial)',
    run() {
      const cust = stCustomer('st-c5', [stBill({}, [stPay(2000)])]);
      const { allocations, summary } = engineSummary(cust);
      expectEq(summary.balanceDueCents, 100000, 'balanceDueCents');
      expectEq(derivedBillStatus(cust, cust.bills[0], allocations), 'partial', 'status');
      return true;
    }
  },
  {
    id: 'engine-pending',
    label: 'Engine · Allocation: an unpaid bill stays pending with the full balance',
    run() {
      const cust = stCustomer('st-c6', [stBill({}, [])]);
      const { allocations, summary } = engineSummary(cust);
      expectEq(summary.balanceDueCents, 300000, 'balanceDueCents');
      expectEq(derivedBillStatus(cust, cust.bills[0], allocations), 'pending', 'status');
      return true;
    }
  },
  {
    id: 'arrears-carry-forward',
    label: 'SISP-2 · Arrears: an unpaid remainder carries into the next cycle',
    run() {
      const cust = stCustomer('st-c7', [stBill({}, [stPay(2000)])]);
      expectEq(arrearsAndAdvance(cust, '2026-11').previousArrears, 1000, 'previousArrears');
      return true;
    }
  },
  {
    id: 'fifo-default-order',
    label: 'SISP-33 · FIFO: default order is arrears → package → kist',
    run() {
      const split = allocateFifoPayment({ previousArrears: 1000, currentMonthBill: 3000, monthlyKist: 500, amount: 3500 });
      expectEq(split.toArrears, 1000, 'toArrears');
      expectEq(split.toPackage, 2500, 'toPackage');
      expectEq(split.toKist, 0, 'toKist');
      return true;
    }
  },
  {
    id: 'fifo-priority-toggle',
    label: 'SISP-33 · FIFO: "Prioritize Kist First" swaps package and kist',
    run() {
      const split = allocateFifoPayment({ previousArrears: 1000, currentMonthBill: 3000, monthlyKist: 500, amount: 3500, prioritizeKistFirst: true });
      expectEq(split.toArrears, 1000, 'toArrears');
      expectEq(split.toKist, 500, 'toKist');
      expectEq(split.toPackage, 2000, 'toPackage');
      return true;
    }
  },
  {
    id: 'fifo-overpay-remainder',
    label: 'SISP-33 · FIFO: allocation never exceeds the buckets owed',
    run() {
      const split = allocateFifoPayment({ previousArrears: 1000, currentMonthBill: 3000, monthlyKist: 500, amount: 5000 });
      expectEq(split.allocatedTotal, 4500, 'allocatedTotal');
      expectEq(split.remainingTotal, 0, 'remainingTotal');
      return true;
    }
  },
  {
    id: 'void-restores-dues',
    label: 'SISP-34 · Void: voiding a payment restores the full balance',
    run() {
      const state = { customers: [stCustomer('st-c8', [stBill({}, [stPay(3000)])])] };
      expectEq(engineSummary(state.customers[0]).summary.balanceDueCents, 0, 'balance before void');
      const { state: next, voidRecord } = voidPayment(state, 'st-c8', '2026-10', 'st-pay-1', {
        voidReason: 'Self-test reversal',
        voidedAt: '2026-10-07T00:00:00.000Z'
      });
      expectEq(voidRecord.amount, 3000, 'voidRecord.amount');
      expectEq(engineSummary(next.customers[0]).summary.balanceDueCents, 300000, 'balance after void');
      expectTrue(isVoidedPayment(next.customers[0].bills[0].payments[0]), 'isVoidedPayment');
      // The input state is untouched (void works on a clone).
      expectEq(state.customers[0].bills[0].payments[0].voided, undefined, 'input payment voided flag');
      return true;
    }
  },
  {
    id: 'void-kills-credit',
    label: 'SISP-34 · Void: voiding an overpayment removes its advance credit',
    run() {
      const state = { customers: [stCustomer('st-c9', [stBill({}, [stPay(4000)])])] };
      expectEq(engineSummary(state.customers[0]).summary.pendingCreditCents, 100000, 'credit before void');
      const { state: next } = voidPayment(state, 'st-c9', '2026-10', 'st-pay-1', {
        voidReason: 'Self-test reversal',
        voidedAt: '2026-10-07T00:00:00.000Z'
      });
      const after = engineSummary(next.customers[0]).summary;
      expectEq(after.pendingCreditCents, 0, 'credit after void');
      expectEq(after.balanceDueCents, 300000, 'balance after void');
      return true;
    }
  },
  {
    id: 'void-requires-reason',
    label: 'SISP-34 · Void: a void without a reason is refused',
    run() {
      const state = { customers: [stCustomer('st-c10', [stBill({}, [stPay(3000)])])] };
      let refused = false;
      try {
        voidPayment(state, 'st-c10', '2026-10', 'st-pay-1', {});
      } catch {
        refused = true;
      }
      expectTrue(refused, 'void without reason refused');
      return true;
    }
  },
  {
    id: 'advance-balance',
    label: 'Advance Payment · Recorder: an advance waits as credit on a paid bill',
    run() {
      let state = createInitialState(['Self-Test Advance Customer']);
      const customerId = state.customers[0].id;
      state = updateCustomerProfile(state, customerId, { monthlySellingAmount: '3000' }, REF_OCT);
      state = generateMonthlyBillsThroughCurrentMonth(state, REF_OCT);
      state = addPayment(state, customerId, '2026-10', { date: '2026-10-05', amount: '3000', method: 'Cash' }, REF_OCT);
      const { nextState, payment } = recordAdvancePayment(state, customerId, { amount: 3000, date: '2026-10-29', method: 'Cash' }, REF_OCT);
      expectEq(payment.kind, 'advance', 'payment kind');
      expectEq(advanceBalanceCents(nextState, customerId), 300000, 'advanceBalanceCents');
      return true;
    }
  },
  {
    id: 'advance-settles-next-month',
    label: 'Advance Payment · Cycle: recorded advance settles the next month (net due 0)',
    run() {
      let state = createInitialState(['Self-Test Advance Customer']);
      const customerId = state.customers[0].id;
      state = updateCustomerProfile(state, customerId, { monthlySellingAmount: '3000' }, REF_OCT);
      state = generateMonthlyBillsThroughCurrentMonth(state, REF_OCT);
      state = addPayment(state, customerId, '2026-10', { date: '2026-10-05', amount: '3000', method: 'Cash' }, REF_OCT);
      const { nextState } = recordAdvancePayment(state, customerId, { amount: 3000, date: '2026-10-29', method: 'Cash' }, REF_OCT);
      const customer = nextState.customers.find((entry) => entry.id === customerId);
      const line = planCustomerCycleLine(customer, '2026-11');
      expectEq(line.advanceCredit, 3000, 'advanceCredit');
      expectEq(line.netDue, 0, 'netDue');
      return true;
    }
  },
  {
    id: 'free-never-billed',
    label: 'FREE · Cycle: a free connection is skipped — no bill, no dues, ever',
    run() {
      const line = planCustomerCycleLine(stCustomer('st-c11', [], { isFreeConnection: true }), '2026-10');
      expectEq(line.skipped, true, 'skipped');
      expectEq(line.reason, 'free-connection', 'reason');
      return true;
    }
  },
  {
    id: 'archived-skipped',
    label: 'SISP-2 · Cycle: an archived customer is skipped by the cycle',
    run() {
      const line = planCustomerCycleLine(stCustomer('st-c12', [], { archived: true }), '2026-10');
      expectEq(line.skipped, true, 'skipped');
      expectEq(line.reason, 'archived', 'reason');
      return true;
    }
  },
  {
    id: 'kist-schedule-math',
    label: 'SISP-4 · Kist: the schedule splits the remainder into equal months',
    run() {
      const plan = createInstallmentPlan(
        { itemTitle: 'Self-Test Router', totalAmount: 6000, downPayment: 1000, totalMonths: 5, startDate: '2026-10-01' },
        { id: 'st-plan-1' }
      );
      const schedule = kistSchedule(plan);
      expectEq(schedule.length, 5, 'schedule length');
      const total = schedule.reduce((sum, row) => sum + row.amount, 0);
      expectEq(total, 5000, 'schedule total');
      return true;
    }
  },
  {
    id: 'kist-lands-on-bill',
    label: 'SISP-4 · Kist: the monthly kist rides the cycle bill (never a separate bill)',
    run() {
      const plan = createInstallmentPlan(
        { itemTitle: 'Self-Test Router', totalAmount: 6000, downPayment: 1000, totalMonths: 5, startDate: '2026-10-01' },
        { id: 'st-plan-1' }
      );
      const cust = stCustomer('st-c13', [], { installmentPlans: [plan] });
      const line = planCustomerCycleLine(cust, '2026-10');
      expectEq(line.kistAmount, 1000, 'kistAmount');
      expectEq(line.netDue, 4000, 'netDue');
      return true;
    }
  },
  {
    id: 'doctor-equals-engine',
    label: 'Khata Doctor · Agreement: Doctor balance equals the engine balance on a mixed ledger',
    run() {
      const cust = stCustomer('st-c14', [
        stBill({ id: 'st-bill-2026-09', month: '2026-09' }, [stPay(2000, { id: 'st-pay-sep' })]),
        stBill({ referralCreditAmount: 500 }, [stPay(2500, { id: 'st-pay-oct' })])
      ]);
      const allocations = calculatePaymentAllocations({ customers: [cust] });
      let engineTotal = 0;
      for (const summary of allocations.byCustomerMonth.values()) engineTotal += summary.balanceDueCents ?? 0;
      expectEq(engineTotal, 100000, 'engine total');
      expectEq(computeLedgerBalance(cust).balanceCents, engineTotal, 'doctor balance');
      return true;
    }
  },
  {
    id: 'doctor-clean-on-waivers',
    label: 'Khata Doctor · FU1b: waiver-settled ledgers report no errors or warnings',
    run() {
      const ref = stCustomer('st-c15', [stBill({ referralCreditAmount: 500 }, [stPay(2500)])]);
      const con = stCustomer('st-c16', [stBill({ concessionAmount: 300 }, [stPay(2700)])]);
      const report = runKhataDoctor({ customers: [ref, con] }, {});
      for (const id of ['st-c15', 'st-c16']) {
        const row = report.customers.find((entry) => entry.customerId === id);
        const bad = row.issues.filter((entry) => entry.severity === 'error' || entry.severity === 'warning');
        expectEq(bad.length, 0, `issues for ${id}`);
      }
      return true;
    }
  },
  {
    id: 'referral-credit-settles',
    label: 'SISP-40 · FU1b: referral credit + cash settles the bill in the engine',
    run() {
      const cust = stCustomer('st-c17', [stBill({ referralCreditAmount: 500, referralCreditReason: 'Hamsaya Referral Credit' }, [stPay(2500)])]);
      const { allocations, summary } = engineSummary(cust);
      expectEq(summary.balanceDueCents, 0, 'balanceDueCents');
      expectEq(derivedBillStatus(cust, cust.bills[0], allocations), 'paid', 'status');
      return true;
    }
  },
  {
    id: 'concession-settles',
    label: 'SISP-30 · FU1b: outage concession + cash settles the bill in the engine',
    run() {
      const cust = stCustomer('st-c18', [stBill({ concessionAmount: 300, concessionReason: 'Outage Reaayat' }, [stPay(2700)])]);
      const { allocations, summary } = engineSummary(cust);
      expectEq(summary.balanceDueCents, 0, 'balanceDueCents');
      expectEq(derivedBillStatus(cust, cust.bills[0], allocations), 'paid', 'status');
      return true;
    }
  },
  {
    id: 'waiver-no-phantom-arrears',
    label: 'FU1b · Waivers: waived money never returns as phantom arrears',
    run() {
      const ref = stCustomer('st-c19', [stBill({ referralCreditAmount: 500 }, [stPay(2500)])]);
      const con = stCustomer('st-c20', [stBill({ concessionAmount: 300 }, [stPay(2700)])]);
      expectEq(arrearsAndAdvance(ref, '2026-11').previousArrears, 0, 'referral arrears');
      expectEq(arrearsAndAdvance(con, '2026-11').previousArrears, 0, 'concession arrears');
      return true;
    }
  },
  {
    id: 'stacked-waivers-clamp',
    label: 'SISP-50 · FU1b: stacked waivers clamp at the bill — cash becomes credit, never negative due',
    run() {
      const cust = stCustomer('st-c21', [stBill({ depositOffsetAmount: 3000, referralCreditAmount: 500 }, [stPay(2500)])]);
      const { summary } = engineSummary(cust);
      expectEq(summary.balanceDueCents, 0, 'balanceDueCents');
      expectEq(summary.pendingCreditCents, 250000, 'pendingCreditCents');
      return true;
    }
  },
  {
    id: 'feeder-credit-settles',
    label: 'SISP-97 · FU1b: feeder-host credit + cash settles the bill in the engine',
    run() {
      const cust = stCustomer('st-c22', [stBill({ feederHostCreditAmount: 300, feederHostCreditReason: 'Feeder Host Bijli Credit' }, [stPay(2700)])]);
      const { allocations, summary } = engineSummary(cust);
      expectEq(summary.balanceDueCents, 0, 'balanceDueCents');
      expectEq(derivedBillStatus(cust, cust.bills[0], allocations), 'paid', 'status');
      expectEq(computeLedgerBalance(cust).feederHostCreditsCents, 30000, 'doctor feeder credits');
      return true;
    }
  },
  {
    id: 'receipt-paid',
    label: 'Receipt · Status: a settled bill prints PAID with zero balance',
    run() {
      const cust = stCustomer('st-c23', [stBill({}, [stPay(3000)])]);
      const receipt = buildPaymentReceipt(cust, cust.bills[0], cust.bills[0].payments[0]);
      expectEq(receipt.status, 'PAID', 'receipt status');
      expectEq(receipt.balanceDueCents, 0, 'receipt balanceDueCents');
      return true;
    }
  },
  {
    id: 'receipt-partial',
    label: 'Receipt · Status: a part-paid bill prints PARTIAL with the remainder',
    run() {
      const cust = stCustomer('st-c24', [stBill({}, [stPay(2000)])]);
      const receipt = buildPaymentReceipt(cust, cust.bills[0], cust.bills[0].payments[0]);
      expectEq(receipt.status, 'PARTIAL', 'receipt status');
      expectEq(receipt.balanceDueCents, 100000, 'receipt balanceDueCents');
      return true;
    }
  },
  {
    id: 'late-fee-counted',
    label: 'Late Fee · Engine: a stamped late fee stays due after the package is paid',
    run() {
      const cust = stCustomer('st-c25', [stBill({ lateFee: 100 }, [stPay(3000)])]);
      const { allocations, summary } = engineSummary(cust);
      expectEq(summary.balanceDueCents, 10000, 'balanceDueCents');
      expectEq(derivedBillStatus(cust, cust.bills[0], allocations), 'partial', 'status');
      return true;
    }
  },
  {
    id: 'discount-settles',
    label: 'Discount · Engine: a payment discount counts toward the bill it settles',
    run() {
      const cust = stCustomer('st-c26', [stBill({}, [stPay(2500, { discount: 500, discountReason: 'Self-test discount' })])]);
      const { allocations, summary } = engineSummary(cust);
      expectEq(summary.balanceDueCents, 0, 'balanceDueCents');
      expectEq(derivedBillStatus(cust, cust.bills[0], allocations), 'paid', 'status');
      return true;
    }
  },
  {
    id: 'method-totals-exclude-voided',
    label: 'SISP-21 · Totals: method collection totals count live payments only (voided excluded)',
    run() {
      const cust = stCustomer('st-c27', [stBill({}, [
        stPay(3000, { id: 'st-pay-cash' }),
        stPay(1500, { id: 'st-pay-ep', method: 'Easypaisa' }),
        stPay(999, { id: 'st-pay-void', voided: true })
      ])]);
      const totals = calculateMethodCollectionTotals({ customers: [cust] }, '2026-10');
      expectEq(totals.total, 4500, 'total');
      expectEq(totals.cashTotal, 3000, 'cashTotal');
      expectEq(totals.digitalTotal, 1500, 'digitalTotal');
      return true;
    }
  },
  {
    id: 'prepay-quote-math',
    label: 'SISP-61 · Prepay: quote = months × rate − discount, with the right end month',
    run() {
      const quote = prepayQuote(stCustomer('st-c28', []), { months: 3, startMonth: '2026-11', discount: 500 });
      expectEq(quote.gross, 9000, 'gross');
      expectEq(quote.netPaid, 8500, 'netPaid');
      expectEq(quote.endMonth, '2027-01', 'endMonth');
      return true;
    }
  },
  {
    id: 'group-due-total',
    label: 'SISP-35 · Group billing: the group total sums live member dues',
    run() {
      const a = stCustomer('st-c29', [stBill({}, [stPay(2000)])]);
      const b = stCustomer('st-c30', [stBill({}, [])]);
      const allocations = calculatePaymentAllocations({ customers: [a, b] });
      const due = buildGroupDue(
        { billingGroupId: 'GRP-101', groupTitle: 'Self-Test Group', memberIds: ['st-c29', 'st-c30'] },
        [a, b],
        '2026-10',
        allocations
      );
      expectEq(due.totalCents, 400000, 'group totalCents');
      expectEq(due.payableCount, 2, 'group payableCount');
      return true;
    }
  }
]);

/* ------------------------------------------------------------------ */
/* The runner (pure — no DOM, no storage, no live state)               */
/* ------------------------------------------------------------------ */

/**
 * Runs the self-test checks against freshly built synthetic fixtures.
 * @param {{ checks?: Array<{id: string, label: string, run: Function}> }} [options]
 *   `checks` is a test seam: the Node suite passes a tampered check to
 *   prove failures are reported, never swallowed. The browser always
 *   runs the default SELF_TEST_CHECKS.
 * @returns {{ total: number, passed: number, failed: number,
 *   durationMs: number, results: Array<{id, label, ok, detail}> }}
 */
export function runSelfTests({ checks = SELF_TEST_CHECKS } = {}) {
  const started = performance.now();
  const results = [];
  for (const check of checks) {
    try {
      const outcome = check.run();
      if (outcome === true) {
        results.push({ id: check.id, label: check.label, ok: true, detail: '' });
      } else {
        results.push({ id: check.id, label: check.label, ok: false, detail: 'Check did not confirm its expectation.' });
      }
    } catch (error) {
      results.push({
        id: check.id,
        label: check.label,
        ok: false,
        detail: error && error.message ? String(error.message) : 'Check failed.'
      });
    }
  }
  const durationMs = Math.round((performance.now() - started) * 10) / 10;
  const passed = results.filter((row) => row.ok).length;
  return { total: results.length, passed, failed: results.length - passed, durationMs, results };
}

/* ------------------------------------------------------------------ */
/* Health Center UI (mounted at runtime into the SISP-100 dialog)      */
/* ------------------------------------------------------------------ */

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** The Run button markup (goes into the Health Center's actions row). */
export function buildSelfTestButtonHtml({ lang = null } = {}) {
  return `<button id="systemHealthSelfTestBtn" class="action-btn-sm daily-slip-btn" type="button">${escapeHtml(t('selftest_btn_run', lang))}</button>`;
}

/** Results panel markup for a finished run. */
export function renderSelfTestResultsHtml(report, { lang = null } = {}) {
  if (!report) return '';
  const summary = t('selftest_summary', lang, { passed: report.passed, total: report.total });
  const duration = t('selftest_duration', lang, { ms: report.durationMs });
  const verdict = report.failed === 0
    ? `<p class="self-test-verdict self-test-verdict--ok">${escapeHtml(t('selftest_all_passed', lang))}</p>`
    : `<p class="self-test-verdict self-test-verdict--fail">${escapeHtml(t('selftest_failures', lang, { count: report.failed }))}</p>`;
  const rows = report.results.map((row) => row.ok
    ? `<li class="self-test-row self-test-row--ok"><span class="self-test-mark" aria-hidden="true">✓</span><span>${escapeHtml(row.label)}</span></li>`
    : `<li class="self-test-row self-test-row--fail"><span class="self-test-mark" aria-hidden="true">✗</span><span>${escapeHtml(row.label)}${row.detail ? ` — <span class="self-test-detail">${escapeHtml(row.detail)}</span>` : ''}</span></li>`
  ).join('');
  return `<div class="self-test-panel">
    <h3 class="self-test-title">${escapeHtml(t('selftest_title', lang))}</h3>
    <p class="self-test-summary">${escapeHtml(summary)} · ${escapeHtml(duration)}</p>
    ${verdict}
    <ul class="self-test-list">${rows}</ul>
    <p class="self-test-note">${escapeHtml(t('selftest_note', lang))}</p>
  </div>`;
}

/**
 * Mounts the self-test button + results panel into the System Health
 * Center dialog (SISP-100). Safe no-op (returns null) when the dialog
 * is not in the document — e.g. on a build where SISP-100 has not
 * landed yet. Idempotent: a second call returns the existing mount.
 */
export function setupInAppSelfTest({ document: doc = (typeof document !== 'undefined' ? document : null), onToast = null } = {}) {
  if (!doc || typeof doc.querySelector !== 'function') return null;
  if (doc.querySelector('#systemHealthSelfTestBtn')) return { mounted: true, alreadyMounted: true };
  const actions = doc.querySelector('#systemHealthModal .system-health-actions');
  const body = doc.querySelector('#systemHealthModal .modal-body');
  if (!actions || !body) return null;

  const lang = getAppLanguage();
  const holder = doc.createElement('span');
  holder.innerHTML = buildSelfTestButtonHtml({ lang });
  const button = holder.firstElementChild ?? holder.querySelector('button');
  if (!button) return null;
  actions.appendChild(button);

  const panel = doc.createElement('div');
  panel.id = 'systemHealthSelfTestResults';
  body.appendChild(panel);

  button.addEventListener('click', () => {
    const report = runSelfTests();
    panel.innerHTML = renderSelfTestResultsHtml(report, { lang: getAppLanguage() });
    if (typeof onToast === 'function') {
      onToast(report.failed === 0
        ? t('selftest_all_passed')
        : t('selftest_failures', null, { count: report.failed }));
    }
  });
  return { mounted: true, alreadyMounted: false, button, panel };
}
