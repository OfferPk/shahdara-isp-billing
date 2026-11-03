/**
 * plan37-repayment-plan.test.js — Plan 37: arrears repayment plan.
 * Pins:
 * - a plan is one customer, an arrears balance at agreement time, and
 *   dated instalments; missing customer or non-positive balance is
 *   rejected, never stored half-formed; bad dates become null, never
 *   guessed (2026-02-30 is rejected);
 * - instalments split from a balance sum exactly to that balance;
 * - instalment status is paid / due / missed only: fully paid is paid,
 *   unpaid past its date is missed (even partially paid), undated can
 *   never be missed, and the current month's bill is never touched —
 *   the module holds no bill, payment, or Waada field at all;
 * - recording a payment against an instalment marks only that
 *   instalment paid, never exceeds what it owes, and reports any
 *   excess instead of spreading it silently;
 * - a plan closes early only by full payment or an operator-recorded
 *   reason; otherwise it stays open;
 * - missed instalments appear in a Waada-style follow-up queue that
 *   creates no Waada record and changes no Waada promise.
 * Synthetic data only; no bill, payment total, or Waada record is ever
 * rewritten by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidRepaymentDate,
  normalizeRepaymentAmount,
  repaymentDaysBetween,
  monthlyDueDates,
  normalizeRepaymentInstalment,
  normalizeRepaymentPlan,
  normalizeRepaymentPlans,
  findRepaymentPlan,
  upsertRepaymentPlan,
  removeRepaymentPlan,
  splitArrearsIntoInstalments,
  instalmentStatus,
  planInstalmentStatuses,
  planTotals,
  recordInstalmentPayment,
  canCloseRepaymentPlan,
  closeRepaymentPlan,
  validateRepaymentPlan,
  missedInstalmentFollowUps,
  repaymentPlanSummaryText,
  repaymentPlanHtml,
  repaymentPlanCsv,
  repaymentPlanFilename,
} from '../repayment-plan.js';

const TODAY = '2026-11-10';

const planA = {
  id: 'rp-1', customerId: 'seed-001', arrearsBalance: 9000, agreedAt: '2026-10-01',
  instalments: [
    { sequence: 1, dueDate: '2026-10-15', amount: 3000, paidAmount: 3000 },
    { sequence: 2, dueDate: '2026-11-05', amount: 3000, paidAmount: 1000 },
    { sequence: 3, dueDate: '2026-12-05', amount: 3000, paidAmount: 0 },
  ],
  status: 'open', closeReason: '',
};

test('date validation accepts real dates and rejects impossible ones', () => {
  assert.equal(isValidRepaymentDate('2026-11-10'), true);
  assert.equal(isValidRepaymentDate('2026-02-29'), false);
  assert.equal(isValidRepaymentDate('2026-02-30'), false);
  assert.equal(isValidRepaymentDate('2026-13-01'), false);
  assert.equal(isValidRepaymentDate('10-11-2026'), false);
  assert.equal(isValidRepaymentDate(''), false);
  assert.equal(isValidRepaymentDate(null), false);
});

test('amount normalisation accepts positive numbers and numeric strings only', () => {
  assert.equal(normalizeRepaymentAmount(3000), 3000);
  assert.equal(normalizeRepaymentAmount('3000'), 3000);
  assert.equal(normalizeRepaymentAmount('3000.555'), 3000.56);
  assert.equal(normalizeRepaymentAmount(0), null);
  assert.equal(normalizeRepaymentAmount(-50), null);
  assert.equal(normalizeRepaymentAmount('abc'), null);
  assert.equal(normalizeRepaymentAmount(''), null);
  assert.equal(normalizeRepaymentAmount(Number.NaN), null);
  assert.equal(normalizeRepaymentAmount(Number.POSITIVE_INFINITY), null);
});

test('day arithmetic counts whole days and rejects bad dates', () => {
  assert.equal(repaymentDaysBetween('2026-11-05', '2026-11-10'), 5);
  assert.equal(repaymentDaysBetween('2026-11-10', '2026-11-10'), 0);
  assert.equal(repaymentDaysBetween('2026-02-30', '2026-11-10'), null);
});

test('monthly due dates clamp to the month length and reject bad input', () => {
  assert.deepEqual(monthlyDueDates('2026-01-31', 3), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(monthlyDueDates('2024-01-31', 2), ['2024-01-31', '2024-02-29']);
  assert.deepEqual(monthlyDueDates('2026-11-15', 2), ['2026-11-15', '2026-12-15']);
  assert.equal(monthlyDueDates('2026-02-30', 2), null);
  assert.equal(monthlyDueDates('2026-11-15', 0), null);
  assert.equal(monthlyDueDates('2026-11-15', 1.5), null);
});

test('instalment normalisation rejects bad amounts and clamps paid amounts', () => {
  assert.equal(normalizeRepaymentInstalment({ dueDate: '2026-11-15', amount: 0 }, 1), null);
  assert.equal(normalizeRepaymentInstalment({ dueDate: '2026-11-15', amount: -5 }, 1), null);
  assert.equal(normalizeRepaymentInstalment({ dueDate: '2026-11-15', amount: 'abc' }, 1), null);
  assert.deepEqual(
    normalizeRepaymentInstalment({ dueDate: '2026-02-30', amount: 1000, paidAmount: 1500 }, 2),
    { sequence: 2, dueDate: null, amount: 1000, paidAmount: 1000 },
  );
  assert.deepEqual(
    normalizeRepaymentInstalment({ dueDate: '2026-11-15', amount: 1000, paidAmount: -20 }, 1),
    { sequence: 1, dueDate: '2026-11-15', amount: 1000, paidAmount: 0 },
  );
  assert.equal(normalizeRepaymentInstalment(null, 1), null);
});

test('plan normalisation rejects half-formed plans and never guesses dates', () => {
  assert.equal(normalizeRepaymentPlan({ arrearsBalance: 9000 }), null);
  assert.equal(normalizeRepaymentPlan({ customerId: 'seed-001', arrearsBalance: 0 }), null);
  assert.equal(normalizeRepaymentPlan({ customerId: 'seed-001', arrearsBalance: -100 }), null);
  const clean = normalizeRepaymentPlan({ id: ' rp-9 ', customerId: ' seed-001 ', arrearsBalance: '9000', agreedAt: '2026-02-30', instalments: [], status: 'weird' });
  assert.deepEqual(clean, { id: 'rp-9', customerId: 'seed-001', arrearsBalance: 9000, agreedAt: null, instalments: [], status: 'open', closeReason: '' });
  assert.equal(normalizeRepaymentPlan(null), null);
});

test('plan list normalisation drops rejects and never mutates inputs', () => {
  const input = [planA, { customerId: '', arrearsBalance: 100 }];
  const snapshot = JSON.stringify(input);
  const list = normalizeRepaymentPlans(input);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'rp-1');
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(normalizeRepaymentPlans('not a list'), []);
});

test('find, upsert and remove work by plan id', () => {
  assert.equal(findRepaymentPlan([planA], 'rp-1')?.customerId, 'seed-001');
  assert.equal(findRepaymentPlan([planA], 'nope'), null);
  assert.equal(findRepaymentPlan([planA], ''), null);
  const replaced = upsertRepaymentPlan([planA], { ...planA, arrearsBalance: 12000, instalments: [] });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].arrearsBalance, 12000);
  const appended = upsertRepaymentPlan([planA], { id: 'rp-2', customerId: 'seed-002', arrearsBalance: 1000, instalments: [] });
  assert.equal(appended.length, 2);
  assert.deepEqual(removeRepaymentPlan([planA], 'rp-1'), []);
  assert.equal(removeRepaymentPlan([planA], 'nope').length, 1);
  assert.equal(upsertRepaymentPlan([planA], null).length, 1);
});

test('split instalments sum exactly to the arrears balance', () => {
  const parts = splitArrearsIntoInstalments(10000, ['2026-11-15', '2026-12-15', '2027-01-15']);
  assert.deepEqual(parts.map((p) => p.amount), [3333.33, 3333.33, 3333.34]);
  assert.equal(parts.reduce((sum, p) => sum + p.amount, 0), 10000);
  assert.deepEqual(parts.map((p) => p.sequence), [1, 2, 3]);
  assert.equal(splitArrearsIntoInstalments(9000, ['2026-11-15', '2026-12-15', '2027-01-15']).reduce((s, p) => s + p.amount, 0), 9000);
  assert.equal(splitArrearsIntoInstalments(0, ['2026-11-15']), null);
  assert.equal(splitArrearsIntoInstalments(9000, []), null);
  assert.equal(splitArrearsIntoInstalments(9000, ['2026-11-15', '2026-02-30']), null);
  assert.equal(splitArrearsIntoInstalments('abc', ['2026-11-15']), null);
});

test('instalment status is paid, due, or missed only', () => {
  assert.equal(instalmentStatus({ dueDate: '2026-10-15', amount: 3000, paidAmount: 3000 }, TODAY), 'paid');
  assert.equal(instalmentStatus({ dueDate: '2026-12-05', amount: 3000, paidAmount: 0 }, TODAY), 'due');
  assert.equal(instalmentStatus({ dueDate: '2026-11-05', amount: 3000, paidAmount: 0 }, TODAY), 'missed');
  assert.equal(instalmentStatus({ dueDate: '2026-11-05', amount: 3000, paidAmount: 1000 }, TODAY), 'missed');
  assert.equal(instalmentStatus({ dueDate: '2026-11-10', amount: 3000, paidAmount: 0 }, TODAY), 'due');
  assert.equal(instalmentStatus({ dueDate: null, amount: 3000, paidAmount: 0 }, TODAY), 'due');
  assert.equal(instalmentStatus({ dueDate: '2026-11-05', amount: 3000, paidAmount: 0 }, 'not a date'), 'due');
  assert.equal(instalmentStatus(null, TODAY), 'due');
});

test('plan totals count by status and never exceed the balance', () => {
  const totals = planTotals(planA, TODAY);
  assert.equal(totals.arrearsBalance, 9000);
  assert.equal(totals.paidTotal, 4000);
  assert.equal(totals.remainingTotal, 5000);
  assert.equal(totals.paidCount, 1);
  assert.equal(totals.missedCount, 1);
  assert.equal(totals.dueCount, 1);
  assert.equal(totals.fullyPaid, false);
  const paid = planTotals({ ...planA, instalments: planA.instalments.map((i) => ({ ...i, paidAmount: i.amount })) }, TODAY);
  assert.equal(paid.fullyPaid, true);
  assert.equal(paid.remainingTotal, 0);
  assert.deepEqual(planTotals(null, TODAY).instalmentCount, 0);
});

test('plan instalment statuses attach status without mutating the plan', () => {
  const snapshot = JSON.stringify(planA);
  const rows = planInstalmentStatuses(planA, TODAY);
  assert.deepEqual(rows.map((r) => r.status), ['paid', 'missed', 'due']);
  assert.equal(JSON.stringify(planA), snapshot);
  assert.deepEqual(planInstalmentStatuses(null, TODAY), []);
});

test('recording a payment marks only that instalment and caps at what it owes', () => {
  const { plan, applied, excess } = recordInstalmentPayment(planA, 3, 3000);
  assert.equal(applied, 3000);
  assert.equal(excess, 0);
  assert.equal(plan.instalments[2].paidAmount, 3000);
  assert.equal(plan.instalments[0].paidAmount, 3000);
  assert.equal(plan.instalments[1].paidAmount, 1000);
  assert.equal(JSON.stringify(planA.instalments[2].paidAmount), '0');
});

test('overpaying an instalment reports the excess instead of spreading it', () => {
  const { plan, applied, excess } = recordInstalmentPayment(planA, 2, 5000);
  assert.equal(applied, 2000);
  assert.equal(excess, 3000);
  assert.equal(plan.instalments[1].paidAmount, 3000);
  assert.equal(plan.instalments[2].paidAmount, 0);
});

test('recording a payment against an unknown or paid instalment applies nothing', () => {
  const unknown = recordInstalmentPayment(planA, 99, 1000);
  assert.equal(unknown.applied, 0);
  assert.equal(unknown.excess, 1000);
  assert.deepEqual(unknown.plan, normalizeRepaymentPlan(planA));
  const paid = recordInstalmentPayment(planA, 1, 500);
  assert.equal(paid.applied, 0);
  assert.equal(paid.excess, 500);
  const invalid = recordInstalmentPayment(planA, 2, 'abc');
  assert.equal(invalid.applied, 0);
  assert.equal(invalid.excess, 0);
  const noPlan = recordInstalmentPayment(null, 1, 500);
  assert.equal(noPlan.plan, null);
  assert.equal(noPlan.excess, 500);
});

test('a plan carries no bill, payment, or Waada field', () => {
  const clean = normalizeRepaymentPlan(planA);
  assert.equal('bills' in clean, false);
  assert.equal('payments' in clean, false);
  assert.equal('promiseDate' in clean, false);
  assert.equal('waada' in clean, false);
  assert.equal(JSON.stringify(clean).includes('bill'), false);
});

test('closing needs full payment or an operator-recorded reason', () => {
  assert.equal(canCloseRepaymentPlan(planA), false);
  assert.equal(canCloseRepaymentPlan(planA, '  '), false);
  assert.equal(canCloseRepaymentPlan(planA, 'Customer moved away'), true);
  const fullyPaid = { ...planA, instalments: planA.instalments.map((i) => ({ ...i, paidAmount: i.amount })) };
  assert.equal(canCloseRepaymentPlan(fullyPaid), true);
  assert.equal(canCloseRepaymentPlan(null), false);
});

test('closing records the reason and leaves unclosable plans unchanged', () => {
  const closed = closeRepaymentPlan(planA, 'Customer moved away');
  assert.equal(closed.status, 'closed');
  assert.equal(closed.closeReason, 'Customer moved away');
  assert.equal(closeRepaymentPlan(planA, '').status, 'open');
  const fullyPaid = { ...planA, instalments: planA.instalments.map((i) => ({ ...i, paidAmount: i.amount })) };
  const paidClosed = closeRepaymentPlan(fullyPaid, '');
  assert.equal(paidClosed.status, 'closed');
  assert.equal(paidClosed.closeReason, 'Paid in full');
  assert.equal(closeRepaymentPlan(null, 'x'), null);
});

test('validation catches sum gaps, undated instalments, and empty plans', () => {
  assert.equal(validateRepaymentPlan(planA).valid, true);
  const gap = validateRepaymentPlan({ ...planA, instalments: planA.instalments.slice(0, 2) });
  assert.equal(gap.valid, false);
  assert.ok(gap.issues.join(' ').includes('not the arrears balance'));
  const undated = validateRepaymentPlan({ ...planA, instalments: [{ sequence: 1, dueDate: null, amount: 9000, paidAmount: 0 }] });
  assert.equal(undated.valid, false);
  assert.ok(undated.issues.join(' ').includes('due date'));
  const empty = validateRepaymentPlan({ ...planA, instalments: [] });
  assert.equal(empty.valid, false);
  assert.ok(empty.issues.join(' ').includes('no instalments'));
  const closedUnpaid = validateRepaymentPlan({ ...planA, status: 'closed', closeReason: '' });
  assert.equal(closedUnpaid.valid, false);
  assert.equal(validateRepaymentPlan(null).valid, false);
});

test('missed-instalment follow-up queue is oldest first and skips closed plans', () => {
  const planB = {
    id: 'rp-2', customerId: 'seed-002', arrearsBalance: 2000, agreedAt: '2026-10-01',
    instalments: [{ sequence: 1, dueDate: '2026-10-20', amount: 2000, paidAmount: 0 }],
    status: 'open', closeReason: '',
  };
  const closedMissed = { ...planB, id: 'rp-3', status: 'closed', closeReason: 'Moved away' };
  const rows = missedInstalmentFollowUps([planA, planB, closedMissed], TODAY);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].planId, 'rp-2');
  assert.equal(rows[0].daysOverdue, 21);
  assert.equal(rows[0].outstanding, 2000);
  assert.equal(rows[1].planId, 'rp-1');
  assert.equal(rows[1].sequence, 2);
  assert.equal(rows[1].outstanding, 2000);
  assert.equal(rows[1].daysOverdue, 5);
  assert.deepEqual(missedInstalmentFollowUps([], TODAY), []);
});

test('summary text states balance, paid, remaining, and state', () => {
  const text = repaymentPlanSummaryText(planA, TODAY);
  assert.ok(text.includes('9000'));
  assert.ok(text.includes('4000'));
  assert.ok(text.includes('5000'));
  assert.ok(text.includes('1 missed'));
  assert.ok(repaymentPlanSummaryText({ ...planA, status: 'closed', closeReason: 'Paid in full' }, TODAY).includes('Closed'));
  assert.equal(repaymentPlanSummaryText(null), 'No repayment plan.');
});

test('panel HTML escapes names and shows follow-up queue rows', () => {
  const html = repaymentPlanHtml([planA], { names: { 'seed-001': '<b>Alice & Co</b>' }, today: TODAY });
  assert.ok(!html.includes('<b>Alice'));
  assert.ok(html.includes('&lt;b&gt;Alice &amp; Co&lt;/b&gt;'));
  assert.ok(html.includes('data-repayment-pay="rp-1:2"'));
  assert.ok(html.includes('data-repayment-close="rp-1"'));
  assert.ok(html.includes('follow-up queue'));
  assert.ok(html.includes('5 days overdue'));
  assert.equal(repaymentPlanHtml([]), '<p>No repayment plans yet.</p>');
});

test('CSV quotes fields and carries one row per instalment', () => {
  const csv = repaymentPlanCsv([planA], { names: { 'seed-001': 'Alice, "A"' }, today: TODAY });
  const lines = csv.split('\n');
  assert.equal(lines.length, 4);
  assert.ok(lines[0].startsWith('customerId,customerName,planId'));
  assert.ok(lines[1].includes('"Alice, ""A"""'));
  assert.ok(lines[1].includes('paid'));
  assert.ok(lines[2].includes('missed'));
  assert.equal(repaymentPlanFilename(), 'repayment-plans.csv');
});
