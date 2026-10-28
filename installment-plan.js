// SISP-4: Hardware & Wire Installment (Kist / EMI) Auto-Billing Engine.
//
// Customers buy routers (Tenda/TP-Link), ONUs, media converters, or extra
// fiber drop wire on 2-6 monthly installments (kist) alongside their monthly
// internet package. A plan lives on the customer record
// (customer.installmentPlans[]) and is deliberately SEPARATE from the
// one-time new-customer fields (connectionFee, routerModel, routerPrice,
// fiberMeters): those describe what was installed once; a plan describes
// money still owed in monthly slices.
//
// INTEGRATION — this module is pure and standalone (it imports nothing,
// so core.js can import it without a cycle). The billing integration lives
// in billing-cycle.js: when the SISP-2 monthly cycle runs, any active plan
// with monthsBilled < totalMonths appends one line item to that month's
// bill ("Kist [N]/[Total]: [ItemTitle]") and monthsBilled increments by
// one; when monthsBilled reaches totalMonths the plan marks itself
// "completed". No parallel billing path is created — the cycle's existing
// adopt-or-create bill rule still applies, and a kist line is never added
// twice for the same plan + installment (the bill's own kistLines are the
// guard, so even a repeated apply for the same month is safe).
//
// monthsPaid is NOT incremented by the cycle. It is derived at display
// time (buildKistProgress) from settled bills: a billed installment counts
// as paid when its bill month's FIFO balance is zero. The stored
// monthsPaid field is kept only as a fallback for callers without
// allocation data, and sanitize() never lets it exceed monthsBilled.
//
// Tests use synthetic data only; no customer, bill or payment data is ever
// fabricated here.
//
// SISP-29: Early Payoff & Down-Payment Receipt. A plan may be settled early
// (settlePlanEarly) — monthsBilled/monthsPaid jump to totalMonths and the
// status flips to "completed", so dueKistLines (and therefore the SISP-2
// cycle) never bills it again. The payoff amount is exactly
// totalAmount - downPayment - monthlyKist * monthsBilled. A settled-early
// plan keeps optional payoffAmount/payoffDate audit fields, which
// buildKistProgress honours (paid in full, Rs 0 remaining) even when the
// allocation-derived paid count would say otherwise, because the unbilled
// installments were never turned into bills. kistSchedule mirrors cycle
// billing (monthlyKist per installment) for receipts; any rounding
// remainder is reconciled by the payoff formula at settlement, and the
// cycle's per-month math is never changed by this module.

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const isKistMonth = (value) => typeof value === 'string' && MONTH_RE.test(value);

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `kist-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const money = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
};
const validDate = (value) => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Month (YYYY-MM) a plan starts billing from; null means "already started". */
export function planStartMonth(plan) {
  if (typeof plan?.startDate === 'string' && validDate(plan.startDate)) return plan.startDate.slice(0, 7);
  return null;
}

/**
 * Sanitize one stored kist line on a bill. A line is the receipt of one
 * installment: which plan, which installment number, how much, for what.
 */
export function sanitizeKistLine(value) {
  if (!value || typeof value !== 'object') return null;
  const installmentNumber = Number(value.installmentNumber);
  const totalMonths = Number(value.totalMonths);
  const amount = Number(value.amount);
  if (typeof value.planId !== 'string' || !value.planId) return null;
  if (!Number.isSafeInteger(installmentNumber) || installmentNumber < 1) return null;
  if (!Number.isSafeInteger(totalMonths) || totalMonths < 1) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    planId: value.planId,
    installmentNumber,
    totalMonths,
    amount: money(amount),
    itemTitle: typeof value.itemTitle === 'string' ? value.itemTitle.slice(0, 100) : ''
  };
}

/** Sanitized kist lines for one bill (deduplicated by plan + installment). */
export function sanitizeBillKistLines(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const lines = [];
  for (const entry of value) {
    const line = sanitizeKistLine(entry);
    if (!line) continue;
    const key = `${line.planId}:${line.installmentNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines.sort((a, b) => a.installmentNumber - b.installmentNumber || a.planId.localeCompare(b.planId));
}

/** Total kist already recorded on a bill (prefers the stored total). */
export function billKistTotal(bill) {
  if (!bill || typeof bill !== 'object') return 0;
  const stored = Number(bill.kistTotal);
  if (Number.isFinite(stored) && stored >= 0) return money(stored);
  return money(sanitizeBillKistLines(bill.kistLines).reduce((sum, line) => sum + line.amount, 0));
}

/** Sanitize one stored installment plan; returns null when unusable. */
export function sanitizeInstallmentPlan(value) {
  if (!value || typeof value !== 'object') return null;
  const totalAmount = Number(value.totalAmount);
  const downPayment = Number(value.downPayment);
  const monthlyKist = Number(value.monthlyKist);
  const totalMonths = Number(value.totalMonths);
  if (typeof value.id !== 'string' || !value.id) return null;
  if (typeof value.itemTitle !== 'string' || !value.itemTitle.trim()) return null;
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return null;
  if (!Number.isFinite(downPayment) || downPayment < 0 || downPayment >= totalAmount) return null;
  if (!Number.isFinite(monthlyKist) || monthlyKist <= 0) return null;
  if (!Number.isSafeInteger(totalMonths) || totalMonths < 1) return null;
  let monthsBilled = Number.isSafeInteger(Number(value.monthsBilled)) ? Number(value.monthsBilled) : 0;
  let monthsPaid = Number.isSafeInteger(Number(value.monthsPaid)) ? Number(value.monthsPaid) : 0;
  monthsBilled = Math.max(0, Math.min(totalMonths, monthsBilled));
  monthsPaid = Math.max(0, Math.min(monthsBilled, monthsPaid));
  // SISP-29: optional early-payoff audit fields. Absent on old plans
  // (null); a settled-early plan always carries at least payoffAmount
  // (0 is valid — a rounding-zero remainder still counts as settled).
  // NOTE: Number(null) is 0, so null/undefined must map to NaN first,
  // otherwise every old plan would look settled-early.
  const payoffAmountRaw = value.payoffAmount ?? NaN;
  const payoffAmount = payoffAmountRaw !== '' && Number.isFinite(Number(payoffAmountRaw)) && Number(payoffAmountRaw) >= 0
    ? money(Number(payoffAmountRaw))
    : null;
  const payoffDate = validDate(value.payoffDate) ? value.payoffDate : null;
  return {
    id: value.id,
    itemTitle: value.itemTitle.trim().slice(0, 100),
    totalAmount: money(totalAmount),
    downPayment: money(downPayment),
    monthlyKist: money(monthlyKist),
    totalMonths,
    monthsBilled,
    monthsPaid,
    payoffAmount,
    payoffDate,
    startDate: validDate(value.startDate) ? value.startDate : null,
    // Status is derived, never trusted from storage: a plan is completed
    // exactly when every installment has been billed.
    status: monthsBilled >= totalMonths ? 'completed' : 'active'
  };
}

/** Sanitized installment plans for one customer (deduplicated by id). */
export function sanitizeInstallmentPlans(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const plans = [];
  for (const entry of value) {
    const plan = sanitizeInstallmentPlan(entry);
    if (!plan || seen.has(plan.id)) continue;
    seen.add(plan.id);
    plans.push(plan);
  }
  return plans;
}

/**
 * Validate + build a new plan from form input. Throws with a plain message
 * on bad input (the profile form surfaces it as a toast). Spec range is
 * 2-6 monthly installments; monthlyKist may be omitted, in which case it
 * is derived as (totalAmount - downPayment) / totalMonths.
 */
export function createInstallmentPlan(input, { id = makeId() } = {}) {
  const itemTitle = typeof input?.itemTitle === 'string' ? input.itemTitle.trim() : '';
  if (!itemTitle) throw new Error('Enter what the installment is for (e.g. Tenda F3 Router + 120m Fiber).');
  if (itemTitle.length > 100) throw new Error('Installment item name must be 100 characters or less.');
  const totalAmount = Number(input?.totalAmount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new Error('Enter a total installment amount greater than zero.');
  const downPayment = input?.downPayment === '' || input?.downPayment === null || input?.downPayment === undefined
    ? 0
    : Number(input.downPayment);
  if (!Number.isFinite(downPayment) || downPayment < 0) throw new Error('Down payment cannot be negative.');
  if (downPayment >= totalAmount) throw new Error('Down payment must be less than the total amount — otherwise there is nothing left to pay in installments.');
  const totalMonths = Number(input?.totalMonths);
  if (!Number.isSafeInteger(totalMonths) || totalMonths < 2 || totalMonths > 6) {
    throw new Error('Installments must be between 2 and 6 months.');
  }
  let monthlyKist;
  if (input?.monthlyKist === '' || input?.monthlyKist === null || input?.monthlyKist === undefined) {
    monthlyKist = money((totalAmount - downPayment) / totalMonths);
  } else {
    monthlyKist = Number(input.monthlyKist);
  }
  if (!Number.isFinite(monthlyKist) || monthlyKist <= 0) throw new Error('Enter a monthly installment amount greater than zero.');
  let startDate = null;
  if (typeof input?.startDate === 'string' && input.startDate.trim() !== '') {
    if (!validDate(input.startDate.trim())) throw new Error('Enter a valid installment start date.');
    startDate = input.startDate.trim();
  }
  return sanitizeInstallmentPlan({
    id,
    itemTitle,
    totalAmount: money(totalAmount),
    downPayment: money(downPayment),
    monthlyKist: money(monthlyKist),
    totalMonths,
    monthsBilled: 0,
    monthsPaid: 0,
    startDate,
    status: 'active'
  });
}

/**
 * The kist lines a billing cycle for `month` still owes this customer:
 * one per active plan whose next installment has not been billed yet and
 * is not already recorded on this month's bill. Plans whose start month
 * is after the cycle month are not due yet.
 *
 * Idempotency rule: if this month's bill already carries ANY line for a
 * plan, that plan is done for this month — even though monthsBilled has
 * already advanced past that installment. Without this, a repeated apply
 * for the same month would bill the NEXT installment into the same bill.
 */
export function dueKistLines(customer, month) {
  if (!customer || !isKistMonth(month)) return [];
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const bill = bills.find((row) => row?.month === month) ?? null;
  const billLines = sanitizeBillKistLines(bill?.kistLines);
  const applied = new Set(billLines.map((line) => `${line.planId}:${line.installmentNumber}`));
  const appliedPlans = new Set(billLines.map((line) => line.planId));
  const lines = [];
  for (const plan of sanitizeInstallmentPlans(customer.installmentPlans)) {
    if (plan.status !== 'active') continue;
    if (plan.monthsBilled >= plan.totalMonths) continue;
    if (appliedPlans.has(plan.id)) continue;
    const startMonth = planStartMonth(plan);
    if (startMonth && startMonth > month) continue;
    const installmentNumber = plan.monthsBilled + 1;
    if (applied.has(`${plan.id}:${installmentNumber}`)) continue;
    lines.push({
      planId: plan.id,
      installmentNumber,
      totalMonths: plan.totalMonths,
      amount: plan.monthlyKist,
      itemTitle: plan.itemTitle
    });
  }
  return lines;
}

/** Display label for one kist line, e.g. "Kist 2/3: Tenda F3 Router". */
export function kistLineLabel(line) {
  if (!line) return '';
  const title = typeof line.itemTitle === 'string' && line.itemTitle ? line.itemTitle : 'Installment';
  return `Kist ${line.installmentNumber}/${line.totalMonths}: ${title}`;
}

/**
 * Advance plans after a cycle billed `appliedLines` for a month. Returns a
 * new sanitized plan list: monthsBilled +1 per applied line, status flips
 * to "completed" exactly when the last installment is billed. Plans with
 * no applied line are returned unchanged.
 */
export function advancePlansForBilledLines(plans, appliedLines) {
  const sanitized = sanitizeInstallmentPlans(plans);
  if (!Array.isArray(appliedLines) || !appliedLines.length) return sanitized;
  const billedByPlan = new Map();
  for (const line of appliedLines) {
    if (line && typeof line.planId === 'string') billedByPlan.set(line.planId, (billedByPlan.get(line.planId) ?? 0) + 1);
  }
  return sanitized.map((plan) => {
    const billed = billedByPlan.get(plan.id);
    if (!billed) return plan;
    return sanitizeInstallmentPlan({ ...plan, monthsBilled: plan.monthsBilled + billed });
  });
}

/**
 * Remaining unpaid balance of one plan, exactly as SISP-29 defines it:
 * totalAmount - downPayment - monthlyKist * monthsBilled. Zero for
 * completed plans (including settled-early ones) and for unusable input.
 */
export function earlyPayoffAmount(plan) {
  const sanitized = sanitizeInstallmentPlan(plan);
  if (!sanitized || sanitized.status !== 'active') return 0;
  return Math.max(0, money(sanitized.totalAmount - sanitized.downPayment - sanitized.monthlyKist * sanitized.monthsBilled));
}

/**
 * Settle one active plan early. Returns a new sanitized plan list: the
 * matching plan gets monthsBilled = monthsPaid = totalMonths (so sanitize
 * derives status "completed") plus payoffAmount/payoffDate audit fields.
 * Completed plans, unknown ids and unusable input leave the list
 * unchanged (sanitized). This alone guarantees the next SISP-2 cycle
 * bills Rs 0 for the plan: dueKistLines skips completed plans and plans
 * with monthsBilled >= totalMonths.
 */
export function settlePlanEarly(plans, planId, { date = null } = {}) {
  const sanitized = sanitizeInstallmentPlans(plans);
  if (typeof planId !== 'string' || !planId) return sanitized;
  return sanitized.map((plan) => {
    if (plan.id !== planId || plan.status !== 'active') return plan;
    return sanitizeInstallmentPlan({
      ...plan,
      monthsBilled: plan.totalMonths,
      monthsPaid: plan.totalMonths,
      payoffAmount: earlyPayoffAmount(plan),
      payoffDate: validDate(date) ? date : null
    });
  });
}

/**
 * Receipt schedule for one plan: one row per installment at the cycle's
 * monthlyKist, marked billed/remaining by monthsBilled. The rows mirror
 * what the SISP-2 cycle bills each month; they are not a second billing
 * path, and the payoff formula (not this schedule) reconciles any
 * rounding remainder when a plan is settled early.
 */
export function kistSchedule(plan) {
  const sanitized = sanitizeInstallmentPlan(plan);
  if (!sanitized) return [];
  const rows = [];
  for (let i = 1; i <= sanitized.totalMonths; i++) {
    rows.push({
      installmentNumber: i,
      totalMonths: sanitized.totalMonths,
      amount: sanitized.monthlyKist,
      status: i <= sanitized.monthsBilled ? 'billed' : 'remaining'
    });
  }
  return rows;
}

/**
 * Progress for every plan on a customer, for the profile progress bar.
 * `allocations` is the optional result of core.calculatePaymentAllocations
 * ({ forMonth(customerId, month) -> { balanceDueCents } }); when supplied,
 * monthsPaid counts billed installments whose bill month is fully settled
 * (FIFO balance zero). Without it, the stored monthsPaid is used.
 * Returns { plans: [...], totals: { activeCount, completedCount,
 * totalRemaining, totalMonthlyKist } }.
 */
export function buildKistProgress(customer, allocations = null) {
  const plans = sanitizeInstallmentPlans(customer?.installmentPlans);
  const bills = Array.isArray(customer?.bills) ? customer.bills : [];
  const settledMonths = new Set();
  if (allocations && typeof allocations.forMonth === 'function') {
    for (const bill of bills) {
      if (!bill || !isKistMonth(bill.month)) continue;
      let summary = null;
      try { summary = allocations.forMonth(customer.id, bill.month); } catch { summary = null; }
      if (summary && summary.balanceDueCents === 0) settledMonths.add(bill.month);
    }
  }
  const detailed = plans.map((plan) => {
    // SISP-29: a settled-early plan is paid in full with Rs 0 remaining,
    // even though its unbilled installments never became bills (so the
    // allocation-derived paid count below would undercount them).
    const settledEarly = plan.payoffAmount !== null || plan.payoffDate !== null;
    let monthsPaid = plan.monthsPaid;
    if (!settledEarly && allocations && typeof allocations.forMonth === 'function') {
      const paidLines = bills.flatMap((bill) => sanitizeBillKistLines(bill.kistLines)
        .filter((line) => line.planId === plan.id && settledMonths.has(bill.month)));
      monthsPaid = Math.min(plan.monthsBilled, paidLines.length);
    }
    if (settledEarly) monthsPaid = plan.totalMonths;
    const remainingAmount = settledEarly
      ? 0
      : Math.max(0, money(plan.totalAmount - plan.downPayment - plan.monthlyKist * monthsPaid));
    return {
      ...plan,
      monthsPaid,
      remainingAmount,
      percentBilled: plan.totalMonths ? Math.round((plan.monthsBilled / plan.totalMonths) * 100) : 0,
      percentPaid: plan.totalMonths ? Math.round((monthsPaid / plan.totalMonths) * 100) : 0,
      statusLabel: plan.status === 'completed' ? 'Completed' : 'Active'
    };
  });
  return {
    plans: detailed,
    totals: {
      activeCount: detailed.filter((plan) => plan.status === 'active').length,
      completedCount: detailed.filter((plan) => plan.status === 'completed').length,
      totalRemaining: money(detailed.reduce((sum, plan) => sum + plan.remainingAmount, 0)),
      totalMonthlyKist: money(detailed.filter((plan) => plan.status === 'active').reduce((sum, plan) => sum + plan.monthlyKist, 0))
    }
  };
}
