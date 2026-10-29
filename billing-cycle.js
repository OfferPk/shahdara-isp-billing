// SISP-2: Automated Monthly Bill Cycle, Arrears Carry-Forward & Advance
// Adjustment Engine ("ماہانہ بل جنریٹر و بقایا جات").
//
// INTEGRATION NOTE — this does NOT build a parallel billing cycle. The app
// already auto-generates rate-locked monthly bill snapshots on open
// (generateMonthlyBillsThroughCurrentMonth in core.js) and already derives
// FIFO carry-forward credit in calculatePaymentAllocations. This engine:
//   (1) plans one explicit, operator-confirmed cycle for a chosen month,
//   (2) ADOPTS the already-generated bill for that month when it exists and
//       creates it (same shape, same price-schedule rule, same 5th due date)
//       only when it is missing — never a second bill for the same month,
//   (3) records the cycle so a re-run for the same month is refused.
// Per-customer math (spec): netDue = currentMonthBill + previousArrears
// - advanceCredit. previousArrears is the sum of unpaid balances of months
// BEFORE the cycle month; advanceCredit is unapplied credit left after those
// months — both derived from the same allocation engine, never stored twice.
//
// All helpers are pure except load/saveBillingCycles and the modal setup.
// Tests use synthetic data only; no customer, bill or payment data is ever
// fabricated here.
import { calculatePaymentAllocations, formatPKR, paymentTicketChargeCents } from './core.js';
import { advancePlansForBilledLines, advancePlansForCoveredKist, billKistTotal, dueKistLines, kistLineLabel, sanitizeBillKistLines, sanitizeInstallmentPlans } from './installment-plan.js';
import { isBillingPaused, sanitizePauseFields } from './pause-billing.js';
import { REFERRAL_CREDIT_REASON, applyReferralApplications, loadReferralCredits, planReferralApplications, queuedReferralTotalFor, reconcileReferralCredits, saveReferralCredits } from './referral-credits.js';

export const BILLING_CYCLES_KEY = 'sisp_billing_cycles_v1';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isBillingCycleMonth = (value) => typeof value === 'string' && MONTH_RE.test(value);

const cents = (value) => Math.round(Number(value) * 100);
const rupees = (centsValue) => centsValue / 100;
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Current PKT calendar month as YYYY-MM (offline app: no scheduler, wall clock only). */
export function pakistanMonthKey(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit' }).format(date).slice(0, 7);
  } catch {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

/** PKT wall-clock timestamp for cycle records, e.g. "2026-10-27 23:51 PKT". */
export function pakistanDateTime(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} PKT`;
  } catch {
    return date.toISOString();
  }
}

// ---------------------------------------------------------------- storage
export function sanitizeBillingCycles(value) {
  if (!Array.isArray(value)) return [];
  const months = new Set();
  const cycles = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || !isBillingCycleMonth(entry.month) || months.has(entry.month)) continue;
    months.add(entry.month);
    const totals = entry.totals && typeof entry.totals === 'object' ? entry.totals : {};
    const num = (field) => Number.isFinite(Number(totals[field])) ? Number(totals[field]) : 0;
    cycles.push({
      month: entry.month,
      ranAt: typeof entry.ranAt === 'string' ? entry.ranAt : '',
      totals: {
        totalBilled: num('totalBilled'),
        totalKist: num('totalKist'),
        totalArrears: num('totalArrears'),
        totalAdvanceAvailable: num('totalAdvanceAvailable'),
        totalAdvanceApplied: num('totalAdvanceApplied'),
        totalReferralCredit: num('totalReferralCredit'),
        netExpectedCollection: num('netExpectedCollection'),
        billedCount: Number.isSafeInteger(totals.billedCount) ? totals.billedCount : 0,
        skippedCount: Number.isSafeInteger(totals.skippedCount) ? totals.skippedCount : 0
      },
      defaulterBuckets: entry.defaulterBuckets && typeof entry.defaulterBuckets === 'object' ? entry.defaulterBuckets : {},
      lines: Array.isArray(entry.lines) ? entry.lines : [],
      skipped: Array.isArray(entry.skipped) ? entry.skipped : []
    });
  }
  return cycles.sort((a, b) => b.month.localeCompare(a.month));
}

export function loadBillingCycles(storage) {
  const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(BILLING_CYCLES_KEY);
    if (!raw) return [];
    return sanitizeBillingCycles(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveBillingCycles(cycles, storage) {
  const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (!store) return;
  store.setItem(BILLING_CYCLES_KEY, JSON.stringify(sanitizeBillingCycles(cycles)));
}

// ---------------------------------------------------------------- planning
/**
 * The applicable selling price for a month, using the exact rule of the
 * auto-generator: the latest price-schedule entry effective on or before
 * the month. Null when no positive price applies (bill cannot be priced).
 */
export function applicablePriceForMonth(customer, month) {
  const schedule = Array.isArray(customer?.monthlyPriceSchedule) ? customer.monthlyPriceSchedule : [];
  const applicable = schedule
    .filter((entry) => typeof entry?.effectiveMonth === 'string' && entry.effectiveMonth <= month)
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
    .at(-1);
  const amount = applicable?.amount;
  if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return null;
  return Number(amount);
}

/**
 * Arrears + advance BEFORE a month, from the allocation engine run over
 * only the earlier bills. Scoping matters: unapplied credit is only
 * "advance" if no earlier bill consumed it, and earlier balances are final
 * before the cycle month is processed (later bills never rewrite them).
 */
export function arrearsAndAdvance(customer, month) {
  const scoped = { ...customer, bills: (customer?.bills ?? []).filter((bill) => bill && bill.month < month) };
  const allocations = calculatePaymentAllocations({ customers: [scoped] });
  let arrearsCents = 0;
  let advanceCents = 0;
  let arrearsMonths = 0;
  for (const summary of allocations.byCustomerMonth.values()) {
    if (summary.balanceDueCents !== null && summary.balanceDueCents !== undefined) {
      arrearsCents += summary.balanceDueCents;
      if (summary.balanceDueCents > 0) arrearsMonths += 1;
    }
    advanceCents += summary.pendingCreditCents || 0;
  }
  return { previousArrears: rupees(arrearsCents), advanceCredit: rupees(advanceCents), arrearsMonths };
}

export function planCustomerCycleLine(customer, month, referralQueued = 0) {
  const base = { customerId: customer?.id ?? null, customerNumber: customer?.customerNumber ?? null, name: customer?.name ?? '' };
  if (!customer || customer.archived) return { ...base, skipped: true, reason: 'archived' };
  // Owner rule (2026-10-29): free connections (AQIB 1 / AQIB 999 /
  // FREE ID LINE MAN) never get a bill — no fee, no dues, ever.
  if (customer.isFreeConnection) return { ...base, skipped: true, reason: 'free-connection' };
  // SISP-8: a billing-paused month generates no new charge at all — not
  // even kist — and an existing bill for that month is left untouched.
  // The cycle preview lists the customer as skipped, and apply records
  // the month as skipped so a later resume never backfills it.
  if (isBillingPaused(customer, month)) return { ...base, skipped: true, reason: 'paused' };
  if (isBillingCycleMonth(customer.billingStartMonth) && customer.billingStartMonth > month) return { ...base, skipped: true, reason: 'billing-not-started' };
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const existing = bills.find((bill) => bill?.month === month);
  let price;
  let existingKistTotal = 0;
  if (existing) {
    const amount = Number(existing.dueAmount);
    if (!Number.isFinite(amount) || amount <= 0) return { ...base, skipped: true, reason: 'unpriced-bill' };
    // Rate-locked: never recompute an existing bill's amount. Its dueAmount
    // already includes any kist billed earlier, so recover the package part
    // by subtracting that kist — otherwise the kist would be counted twice.
    existingKistTotal = billKistTotal(existing);
    price = Math.max(0, rupees(cents(amount) - cents(existingKistTotal)));
  } else {
    price = applicablePriceForMonth(customer, month);
    if (price === null) return { ...base, skipped: true, reason: 'no-price' };
  }
  // SISP-4: kist due this month rides the cycle, never a separate bill.
  // kistLines are only the NEW installments (already-recorded ones on an
  // existing bill are excluded by dueKistLines); kistAmount is the full
  // kist on this month's bill so netDue stays correct after an apply.
  const kistLines = dueKistLines(customer, month);
  const kistNewAmount = rupees(kistLines.reduce((sum, line) => sum + cents(line.amount), 0));
  const kistAmount = rupees(cents(existingKistTotal) + cents(kistNewAmount));
  const { previousArrears, advanceCredit, arrearsMonths } = arrearsAndAdvance(customer, month);
  const gross = price + kistAmount + previousArrears;
  // SISP-40: queued hamsaya referral credit deducts from this cycle's
  // gross BEFORE the customer's own advance money is touched, capped at
  // the gross so the net due can never go below Rs. 0. A bill that
  // already carries a referral credit never receives a second one (the
  // adopt-not-duplicate rule), and with no queued credit every figure
  // below is exactly the pre-SISP-40 value.
  const alreadyCredited = existing ? Number(existing.referralCreditAmount) > 0 : false;
  const referralCreditApplied = alreadyCredited
    ? 0
    : Math.min(Math.max(0, rupees(cents(Number(referralQueued) || 0))), rupees(cents(gross)));
  const advanceApplied = Math.min(advanceCredit, Math.max(0, gross - referralCreditApplied));
  return {
    ...base,
    skipped: false,
    currentMonthBill: price,
    kistLines,
    kistAmount,
    kistNewAmount,
    previousArrears,
    advanceCredit,
    referralCreditApplied,
    advanceApplied,
    netDue: Math.max(0, gross - referralCreditApplied - advanceCredit),
    remainingAdvance: Math.max(0, advanceCredit - advanceApplied),
    arrearsMonths,
    existingBillId: existing?.id ?? null
  };
}

export function planBillingCycle(state, month, options = {}) {
  if (!isBillingCycleMonth(month)) throw new Error('Choose a valid billing month (YYYY-MM).');
  // SISP-40: the referral queue is an optional input — callers that pass
  // no credits get exactly the pre-SISP-40 plan.
  const referralCredits = Array.isArray(options?.referralCredits) ? options.referralCredits : [];
  const lines = [];
  const skipped = [];
  for (const customer of state?.customers ?? []) {
    const line = planCustomerCycleLine(customer, month, queuedReferralTotalFor(referralCredits, customer?.id));
    if (!line.skipped && line.referralCreditApplied > 0) {
      line.referralApplications = planReferralApplications(referralCredits, customer.id, line.referralCreditApplied);
    }
    if (line.skipped) skipped.push(line);
    else lines.push(line);
  }
  const sum = (field) => lines.reduce((total, line) => total + (line[field] || 0), 0);
  const totals = {
    totalBilled: sum('currentMonthBill'),
    totalKist: sum('kistAmount'),
    totalArrears: sum('previousArrears'),
    totalAdvanceAvailable: sum('advanceCredit'),
    totalAdvanceApplied: lines.reduce((total, line) => total + (line.advanceApplied ?? Math.min(line.advanceCredit, line.currentMonthBill + (line.kistAmount || 0) + line.previousArrears)), 0),
    totalReferralCredit: sum('referralCreditApplied'),
    netExpectedCollection: sum('netDue'),
    billedCount: lines.length,
    skippedCount: skipped.length
  };
  const defaulterBuckets = { current: 0, oneMonth: 0, twoToThreeMonths: 0, fourPlusMonths: 0 };
  for (const line of lines) {
    if (line.netDue <= 0) continue;
    if (line.arrearsMonths === 0) defaulterBuckets.current += 1;
    else if (line.arrearsMonths === 1) defaulterBuckets.oneMonth += 1;
    else if (line.arrearsMonths <= 3) defaulterBuckets.twoToThreeMonths += 1;
    else defaulterBuckets.fourPlusMonths += 1;
  }
  return { month, lines, skipped, totals, defaulterBuckets };
}

// ---------------------------------------------------------------- applying
// SISP-40: stamp a cycle-applied referral credit onto a bill, mirroring
// the SISP-30 concession shape — the bill amount itself is never
// rewritten; the credit rides as audited bill fields plus an
// amountHistory entry, and presentation layers subtract it.
function withReferralCredit(bill, amount, referenceDate) {
  const stamp = (referenceDate instanceof Date ? referenceDate : new Date()).toISOString();
  return {
    ...bill,
    referralCreditAmount: amount,
    referralCreditReason: REFERRAL_CREDIT_REASON,
    referralCreditAppliedAt: stamp,
    amountHistory: [...(bill.amountHistory ?? []), {
      changedAt: stamp,
      type: 'referral_credit_applied',
      referralCredit: amount,
      note: REFERRAL_CREDIT_REASON
    }]
  };
}

/**
 * Apply a planned cycle to state. Existing bills are adopted untouched;
 * missing priced bills are created in the exact auto-generator shape
 * (rate-locked priceSnapshot, 5th due date). Never creates a second bill
 * for the same month — that is what makes re-runs safe even if the cycle
 * record itself is ever lost (e.g. a backup restore without it).
 */
export function applyBillingCycle(state, month, referenceDate = new Date(), options = {}) {
  const plan = planBillingCycle(state, month, options);
  const byCustomerId = new Map(plan.lines.map((line) => [line.customerId, line]));
  let changed = false;
  const createdBillIds = [];
  const referralApplications = [];
  const customers = (state?.customers ?? []).map((customer) => {
    const line = byCustomerId.get(customer.id);
    if (!line) return customer;
    const referralAmount = line.referralCreditApplied || 0;
    if (referralAmount > 0 && Array.isArray(line.referralApplications)) {
      for (const application of line.referralApplications) {
        referralApplications.push({ ...application, referrerCustomerId: customer.id, month });
      }
    }
    // SISP-4: an adopted bill still receives this month's kist lines
    // (existing bill's dueAmount grows by exactly the new kist, and the
    // plan's monthsBilled advances). Lines already on the bill are never
    // re-added — dueKistLines excluded them from the plan.
    if (line.existingBillId) {
      if (!line.kistLines?.length && !(referralAmount > 0)) return customer;
      const bills = (customer.bills ?? []).map((bill) => {
        if (bill?.id !== line.existingBillId) return bill;
        let next = bill;
        if (line.kistLines?.length) {
          const oldLines = sanitizeBillKistLines(bill.kistLines);
          const nextLines = [...oldLines, ...line.kistLines];
          next = {
            ...next,
            dueAmount: rupees(cents(bill.dueAmount) + cents(line.kistNewAmount)),
            kistLines: nextLines,
            kistTotal: rupees(nextLines.reduce((sum, row) => sum + cents(row.amount), 0))
          };
        }
        // SISP-40: an adopted bill receives the referral credit fields
        // exactly like a created one — the amount itself stays untouched.
        if (referralAmount > 0) next = withReferralCredit(next, referralAmount, referenceDate);
        return next;
      });
      changed = true;
      return {
        ...customer,
        bills,
        installmentPlans: advancePlansForBilledLines(customer.installmentPlans, line.kistLines)
      };
    }
    const createdBill = {
      id: makeId(),
      month,
      dueAmount: rupees(cents(line.currentMonthBill) + cents(line.kistNewAmount || 0)),
      dueDate: `${month}-05`,
      status: 'pending',
      payments: [],
      generated: true,
      priceSnapshot: line.currentMonthBill,
      createdAt: (referenceDate instanceof Date ? referenceDate : new Date()).toISOString(),
      amountHistory: [],
      // SISP-4: kist rides this bill; priceSnapshot stays the package price.
      kistLines: line.kistLines ?? [],
      kistTotal: rupees((line.kistLines ?? []).reduce((sum, row) => sum + cents(row.amount), 0))
    };
    const bill = referralAmount > 0 ? withReferralCredit(createdBill, referralAmount, referenceDate) : createdBill;
    createdBillIds.push(bill.id);
    changed = true;
    return {
      ...customer,
      bills: [...(customer.bills ?? []), bill].sort((a, b) => b.month.localeCompare(a.month)),
      installmentPlans: advancePlansForBilledLines(customer.installmentPlans, line.kistLines)
    };
  });
  // SISP-8: a cycle-skipped paused month is recorded as skipped (same
  // rule as the auto-generator) so a later resume never backfills it.
  // Months that already have a bill are never recorded as skipped.
  const pausedSkippedIds = new Set(plan.skipped.filter((line) => line.reason === 'paused').map((line) => line.customerId));
  const withSkipped = customers.map((customer) => {
    if (!pausedSkippedIds.has(customer.id)) return customer;
    if ((customer.bills ?? []).some((bill) => bill?.month === month)) return customer;
    const current = sanitizePauseFields(customer).pauseSkippedMonths;
    if (current.includes(month)) return customer;
    changed = true;
    return { ...customer, pauseSkippedMonths: [...current, month].sort() };
  });
  return { state: changed ? { ...state, customers: withSkipped } : state, plan, createdBillIds, referralApplications };
}

/**
 * Run one cycle. Throws when the month was already cycled — the record is
 * the re-run guard; applyBillingCycle's adopt-not-duplicate rule is the
 * backstop. Callers persist the returned state, then save the cycle.
 * SISP-40: when options.referralCredits is passed, the returned
 * referralApplications tells the caller which queue entries the cycle
 * consumed, so it can mark them applied (applyReferralApplications) and
 * persist the queue.
 */
export function runBillingCycle(state, month, cycles, referenceDate = new Date(), options = {}) {
  const existing = (cycles ?? []).find((cycle) => cycle?.month === month);
  if (existing) {
    throw new Error(`Monthly billing cycle for ${month} already ran${existing.ranAt ? ` on ${existing.ranAt}` : ''}. It cannot run again — re-running would double-bill.`);
  }
  const { state: nextState, plan, referralApplications } = applyBillingCycle(state, month, referenceDate, options);
  const cycle = {
    month,
    ranAt: pakistanDateTime(referenceDate),
    lines: plan.lines,
    skipped: plan.skipped,
    totals: plan.totals,
    defaulterBuckets: plan.defaulterBuckets
  };
  return { state: nextState, cycle, referralApplications };
}

// ---------------------------------------------------------------- receipts
/**
 * Itemized arrears breakdown for one bill month, for Urdu WhatsApp and
 * thermal receipts. paidAmount is cash/credit actually applied to this
 * month (same-month receipts + carry-forward credit); balanceDue is
 * derived so the five lines always reconcile:
 *   totalDue - paidAmount - discountApplied = balanceDue
 * (the bill's own late-fee line, when present, is shown separately by the
 * existing receipt renderers, exactly as before).
 */
export function buildArrearsBreakdown(customer, bill) {
  if (!customer || !bill || !isBillingCycleMonth(bill.month)) return null;
  const amount = Number(bill.dueAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const { previousArrears } = arrearsAndAdvance(customer, bill.month);
  const full = calculatePaymentAllocations({ customers: [customer] });
  const summary = full.forMonth(customer.id, bill.month);
  const paidAmount = rupees((summary?.sameMonthAppliedCents ?? 0) + (summary?.creditAppliedCents ?? 0));
  const discountApplied = rupees(summary?.discountAppliedCents ?? 0);
  const totalDue = amount + previousArrears;
  // SISP-4: the bill amount already includes kist, so split it back out —
  // the package line must show the package price, with kist as its own
  // breakdown lines (WhatsApp + thermal receipts render them from here).
  const kistAmount = billKistTotal(bill);
  const kistLines = sanitizeBillKistLines(bill.kistLines);
  // SISP-40: an applied referral credit rides the bill like the SISP-30
  // concession — exposed here for receipt renderers, which subtract it
  // for display; balanceDue keeps the same gross derivation as before.
  const referralCreditAmount = Number.isFinite(Number(bill.referralCreditAmount)) && Number(bill.referralCreditAmount) > 0
    ? rupees(cents(bill.referralCreditAmount))
    : 0;
  return {
    month: bill.month,
    packageAmount: Math.max(0, rupees(cents(amount) - cents(kistAmount))),
    kistAmount,
    kistLines,
    previousArrears,
    totalDue,
    paidAmount,
    discountApplied,
    referralCreditAmount,
    balanceDue: Math.max(0, totalDue - paidAmount - discountApplied)
  };
}

export function arrearsBreakdownTextLines(breakdown) {
  if (!breakdown) return [];
  return [
    `Mahana Package: ${formatPKR(breakdown.packageAmount)}`,
    ...(breakdown.kistAmount > 0 ? [
      `Kist (installments this month): ${formatPKR(breakdown.kistAmount)}`,
      ...(Array.isArray(breakdown.kistLines) ? breakdown.kistLines.map((line) => `  ${kistLineLabel(line)} — ${formatPKR(line.amount)}`) : [])
    ] : []),
    `Sabiqa Baqaya (Previous Arrears): ${formatPKR(breakdown.previousArrears)}`,
    ...(breakdown.referralCreditAmount > 0 ? [`Hamsaya Referral Credit: -${formatPKR(breakdown.referralCreditAmount)}`] : []),
    `Kul Qabil-e-Ada (Total Due): ${formatPKR(breakdown.totalDue)}`,
    `Wusool Paya (Paid): ${formatPKR(breakdown.paidAmount)}`,
    `Baqi Rehta (Balance): ${formatPKR(breakdown.balanceDue)}`
  ];
}

// ---------------------------------------------------------------- SISP-33
// Partial Payment FIFO Allocation Across Arrears, Package Bill & Hardware
// Kist. This is an ATTRIBUTION view, not new billing math, and it changes
// nothing in the engine: SISP-2 net-due, core payment allocations and
// SISP-4 plan math are untouched. A partial payment on one month's bill is
// attributed, in order, to previousArrears first, then the current month's
// package bill, then that month's kist — or, with the operator's
// "Prioritize Kist First" toggle, to arrears, then kist, then package.
// The total remaining always reconciles with the outstanding total
// (buckets minus actual receipts on the bill); only the SPLIT differs
// from the engine's month-by-month balances.
//
// Idempotency rule: allocation is a PURE derivation from stored data
// (bill totals + the bill's payments in recording order + each payment's
// stored toggle flag). Re-rendering therefore never re-allocates: the
// inputs change only on a payment event (add/edit/delete). The payment
// event itself stores exactly two things (see
// applyFifoPaymentEventToState): the operator's toggle choice on the
// payment record, and a stored monthsPaid bump when the payment fully
// covers the month's kist. Everything else is derived at display time,
// so an edited payment's split follows the edited ledger instead of
// going stale. Effective payment amount is amount + discount (a discount
// waives balance exactly like cash in the existing receipt math).
// Advance/credit applied by the engine is NOT attributed here — it is
// shown separately by the existing "Unused advance credit" figures.

/**
 * Pure FIFO split of one payment amount across the three buckets.
 * All amounts are rupees (2dp); negatives and non-numbers count as 0.
 * An amount above the bucket total attributes only up to the total —
 * the excess stays engine credit, never negative remaining.
 */
export function allocateFifoPayment({ previousArrears = 0, currentMonthBill = 0, monthlyKist = 0, amount = 0, prioritizeKistFirst = false } = {}) {
  // Buckets and the payment are clamped at zero: a negative stored value
  // must never manufacture allocation room for another bucket.
  let arrears = Math.max(0, cents(previousArrears));
  let pkg = Math.max(0, cents(currentMonthBill));
  let kist = Math.max(0, cents(monthlyKist));
  let left = Math.max(0, cents(amount));
  const take = (bucket) => {
    const used = Math.min(bucket, Math.max(0, left));
    left -= used;
    return used;
  };
  let toArrears = 0;
  let toPackage = 0;
  let toKist = 0;
  // Arrears always clear first; the toggle only swaps package and kist.
  toArrears = take(arrears);
  if (prioritizeKistFirst === true) {
    toKist = take(kist);
    toPackage = take(pkg);
  } else {
    toPackage = take(pkg);
    toKist = take(kist);
  }
  return {
    toArrears: rupees(toArrears),
    toPackage: rupees(toPackage),
    toKist: rupees(toKist),
    remainingArrears: rupees(arrears - toArrears),
    remainingPackage: rupees(pkg - toPackage),
    remainingKist: rupees(kist - toKist),
    allocatedTotal: rupees(toArrears + toPackage + toKist),
    remainingTotal: rupees((arrears - toArrears) + (pkg - toPackage) + (kist - toKist))
  };
}

/**
 * The FIFO bucket totals for one bill month: previous arrears before the
 * month (already net of older bills' payments, from the SISP-2 engine),
 * the package part of this bill (dueAmount minus its kist), and this
 * bill's kist total. Null when the bill is unpriced or the month is
 * invalid — an unpriced bill carries no split.
 */
export function fifoBillContext(customer, bill) {
  if (!customer || !bill || !isBillingCycleMonth(bill.month)) return null;
  const due = Number(bill.dueAmount);
  if (!Number.isFinite(due) || due <= 0) return null;
  const kistTotal = billKistTotal(bill);
  const packageTotal = Math.max(0, rupees(cents(due) - cents(kistTotal)));
  const { previousArrears } = arrearsAndAdvance(customer, bill.month);
  return {
    month: bill.month,
    previousArrears,
    packageTotal,
    kistTotal,
    kistLines: sanitizeBillKistLines(bill.kistLines),
    totalDue: rupees(cents(previousArrears) + cents(packageTotal) + cents(kistTotal))
  };
}

/**
 * Derive the FIFO attribution for every payment on one bill, in
 * recording (array) order. Each entry carries its own split plus the
 * remaining split before and after it, so a receipt can show both what
 * this payment covered and what was left right after it. Returns null
 * when the bill has no FIFO context.
 */
export function allocateFifoForBill(customer, bill) {
  const context = fifoBillContext(customer, bill);
  if (!context) return null;
  let remArrears = cents(context.previousArrears);
  let remPkg = cents(context.packageTotal);
  let remKist = cents(context.kistTotal);
  const payments = [];
  for (const payment of (bill?.payments ?? [])) {
    if (!payment || typeof payment !== 'object') continue;
    const remainingBefore = { arrears: rupees(remArrears), package: rupees(remPkg), kist: rupees(remKist) };
    // SISP-43: the ticket-charge portion of a receipt settled field-work
    // charges, not any FIFO bucket — the split sees the bill portion only.
    const effective = Math.max(0, (Number(payment.amount) || 0) - paymentTicketChargeCents(payment) / 100) + (Number(payment.discount) || 0);
    const alloc = allocateFifoPayment({
      previousArrears: remainingBefore.arrears,
      currentMonthBill: remainingBefore.package,
      monthlyKist: remainingBefore.kist,
      amount: effective,
      prioritizeKistFirst: payment.fifoPrioritizeKistFirst === true
    });
    remArrears = cents(alloc.remainingArrears);
    remPkg = cents(alloc.remainingPackage);
    remKist = cents(alloc.remainingKist);
    payments.push({
      paymentId: payment.id ?? null,
      prioritizeKistFirst: payment.fifoPrioritizeKistFirst === true,
      toArrears: alloc.toArrears,
      toPackage: alloc.toPackage,
      toKist: alloc.toKist,
      remainingBefore,
      remainingAfter: { arrears: alloc.remainingArrears, package: alloc.remainingPackage, kist: alloc.remainingKist }
    });
  }
  return {
    context,
    payments,
    remaining: {
      arrears: rupees(remArrears),
      package: rupees(remPkg),
      kist: rupees(remKist),
      total: rupees(remArrears + remPkg + remKist)
    }
  };
}

/**
 * One payment's FIFO split plus the remaining split right after it.
 * Null when the bill has no FIFO context or the payment is not on it.
 * `show` is false for a plain package-only bill (no arrears, no kist),
 * where the split would be trivial — callers hide the block then.
 */
export function fifoAllocationForPayment(customer, bill, paymentId) {
  const derived = allocateFifoForBill(customer, bill);
  if (!derived) return null;
  const entry = derived.payments.find((row) => row.paymentId === paymentId) ?? null;
  if (!entry) return null;
  return {
    allocation: {
      toArrears: entry.toArrears,
      toPackage: entry.toPackage,
      toKist: entry.toKist,
      prioritizeKistFirst: entry.prioritizeKistFirst
    },
    remaining: entry.remainingAfter,
    show: derived.context.previousArrears > 0 || derived.context.kistTotal > 0,
    context: derived.context
  };
}

/** Remaining FIFO split for a bill after all its payments (profile view). */
export function fifoRemainingForBill(customer, bill) {
  const derived = allocateFifoForBill(customer, bill);
  if (!derived) return null;
  return {
    previousArrears: derived.context.previousArrears,
    packageTotal: derived.context.packageTotal,
    kistTotal: derived.context.kistTotal,
    remainingArrears: derived.remaining.arrears,
    remainingPackage: derived.remaining.package,
    remainingKist: derived.remaining.kist,
    remainingTotal: derived.remaining.total,
    show: derived.context.previousArrears > 0 || derived.context.kistTotal > 0
  };
}

/** Receipt / WhatsApp lines for one payment's split and its remaining. */
export function fifoTextLines(allocation, remaining) {
  if (!allocation || !remaining) return [];
  return [
    `FIFO taqseem: Sabiqa Baqaya ${formatPKR(allocation.toArrears)} · Mahana Bill ${formatPKR(allocation.toPackage)} · Kist ${formatPKR(allocation.toKist)}`,
    `Baqi Sabiqa Baqaya: ${formatPKR(remaining.arrears)} · Baqi Mahana Bill: ${formatPKR(remaining.package)} · Baqi Kist: ${formatPKR(remaining.kist)}`
  ];
}

/**
 * Payment-event effects for SISP-33, applied once per recorded payment
 * (the profile payment form calls this right after addPayment, before
 * save). Pure state transform; returns the input state unchanged when:
 * the customer/bill/payment is missing, the bill is unpriced, or this
 * payment already carries the fifoEventApplied marker (so calling it
 * twice never double-applies). Effects: (1) records the operator's
 * toggle choice on the payment, but only when the bill actually carries
 * kist — otherwise the default order already applies and no flag is
 * stored; (2) when this payment fully covers the month's outstanding
 * kist, advances stored monthsPaid by one per kist line on the bill
 * (capped by monthsBilled via sanitize). The allocation itself is NOT
 * stored — it is derived at display time, so edits never leave it stale.
 */
export function applyFifoPaymentEventToState(state, customerId, month, paymentId, { prioritizeKistFirst = false } = {}) {
  const customers = state?.customers ?? [];
  const customer = customers.find((row) => row?.id === customerId);
  if (!customer) return state;
  const bill = (customer.bills ?? []).find((row) => row?.month === month);
  if (!bill) return state;
  const payment = (bill.payments ?? []).find((row) => row?.id === paymentId);
  if (!payment || payment.fifoEventApplied === true) return state;
  const context = fifoBillContext(customer, bill);
  if (!context) return state;
  const wantFlag = prioritizeKistFirst === true && context.kistTotal > 0;
  // Derive with the incoming toggle choice applied, so the kist-covered
  // check below sees the split the operator actually chose.
  const workingCustomer = {
    ...customer,
    bills: customer.bills.map((row) => (row?.month !== month ? row : {
      ...row,
      payments: (row.payments ?? []).map((rowPayment) => (rowPayment?.id !== paymentId ? rowPayment : {
        ...rowPayment,
        ...(wantFlag ? { fifoPrioritizeKistFirst: true } : {})
      }))
    }))
  };
  const workingBill = workingCustomer.bills.find((row) => row?.month === month);
  const derived = allocateFifoForBill(workingCustomer, workingBill);
  const entry = derived?.payments.find((row) => row.paymentId === paymentId);
  if (!entry) return state;
  const kistCovered = entry.remainingBefore.kist > 0 && entry.remainingAfter.kist === 0 && entry.toKist > 0;
  let nextPlans = customer.installmentPlans;
  let bumpApplied = false;
  if (kistCovered) {
    const coveredIds = new Set(context.kistLines.map((line) => line.planId));
    const beforePaid = (sanitizeInstallmentPlans(customer.installmentPlans) ?? []).reduce((sum, plan) => sum + plan.monthsPaid, 0);
    nextPlans = advancePlansForCoveredKist(customer.installmentPlans, coveredIds);
    const afterPaid = (nextPlans ?? []).reduce((sum, plan) => sum + plan.monthsPaid, 0);
    bumpApplied = afterPaid > beforePaid;
  }
  const nextCustomer = {
    ...customer,
    bills: customer.bills.map((row) => (row?.month !== month ? row : {
      ...row,
      payments: (row.payments ?? []).map((rowPayment) => (rowPayment?.id !== paymentId ? rowPayment : {
        ...rowPayment,
        ...(wantFlag ? { fifoPrioritizeKistFirst: true } : {}),
        fifoEventApplied: true,
        ...(bumpApplied ? { fifoKistBumpApplied: true } : {})
      }))
    })),
    ...(bumpApplied ? { installmentPlans: nextPlans } : {})
  };
  return { ...state, customers: customers.map((row) => (row?.id !== customerId ? row : nextCustomer)) };
}

// ---------------------------------------------------------------- modal
export function setupBillingCycleModal(getState, { onUpdateState, onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('billingCycleModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const monthInput = $('billingCycleMonthInput');
  const previewBtn = $('billingCyclePreviewBtn');
  const confirmBtn = $('billingCycleConfirmBtn');
  const previewBox = $('billingCyclePreview');
  const resultBox = $('billingCycleResult');
  const lastRunBox = $('billingCycleLastRun');
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openBillingCycleModalBtn') : null;
  let currentPlan = null;

  const money = (value) => formatPKR(value);
  // SISP-40: keep the referral queue in step with the ledger before a
  // plan is built, so a first payment recorded moments ago already
  // counts. Reconcile is idempotent; a storage failure must never block
  // the billing cycle itself, so fall back to the stored queue.
  function syncReferralCredits(state) {
    try {
      const { credits, changed } = reconcileReferralCredits(state, loadReferralCredits());
      if (changed) saveReferralCredits(credits);
      return credits;
    } catch {
      return loadReferralCredits();
    }
  }
  const skipReasonLabel = (reason) => ({
    archived: 'Archived',
    'billing-not-started': 'Billing starts later',
    'no-price': 'No price for this month',
    'unpriced-bill': 'Bill has no price',
    paused: 'Paused (vacation hold)',
    'free-connection': 'Free connection'
  }[reason] || reason);

  function renderLastRun() {
    if (!lastRunBox) return;
    const cycles = loadBillingCycles();
    if (!cycles.length) {
      lastRunBox.textContent = 'No billing cycle has been run yet.';
      return;
    }
    const latest = cycles[0];
    lastRunBox.textContent = `Last cycle: ${latest.month} (${latest.ranAt || 'date not recorded'}) · ${latest.totals.billedCount} bills · ${money(latest.totals.netExpectedCollection)} net expected.`;
  }

  function renderPreview(plan, alreadyRun) {
    if (!previewBox) return;
    if (alreadyRun) {
      previewBox.innerHTML = `<p class="billing-cycle-warning">⚠️ Monthly billing cycle for ${escapeHtml(plan.month)} already ran${alreadyRun.ranAt ? ` on ${escapeHtml(alreadyRun.ranAt)}` : ''}. It cannot run again — re-running would double-bill.</p>`;
      if (confirmBtn) confirmBtn.hidden = true;
      return;
    }
    const lines = plan.lines.map((line) => `<tr><td>#${escapeHtml(String(line.customerNumber ?? ''))} ${escapeHtml(line.name)}</td><td>${money(line.currentMonthBill)}</td><td>${money(line.previousArrears)}</td><td>${money(line.advanceCredit)}</td><td><strong>${money(line.netDue)}</strong></td></tr>`).join('');
    const skipped = plan.skipped.map((line) => `<li>#${escapeHtml(String(line.customerNumber ?? ''))} ${escapeHtml(line.name)} — ${escapeHtml(skipReasonLabel(line.reason))}</li>`).join('');
    const buckets = plan.defaulterBuckets;
    previewBox.innerHTML = `<div class="billing-cycle-totals">
      <p><span>Total billed this month</span><strong>${money(plan.totals.totalBilled)}</strong></p>
      ${plan.totals.totalKist > 0 ? `<p><span>Kist installments included</span><strong>${money(plan.totals.totalKist)}</strong></p>` : ''}
      <p><span>Total arrears carried forward</span><strong>${money(plan.totals.totalArrears)}</strong></p>
      <p><span>Advance available / applied</span><strong>${money(plan.totals.totalAdvanceAvailable)} / ${money(plan.totals.totalAdvanceApplied)}</strong></p>
      ${plan.totals.totalReferralCredit > 0 ? `<p><span>Hamsaya referral credits applied</span><strong>${money(plan.totals.totalReferralCredit)}</strong></p>` : ''}
      <p><span>Net expected collection</span><strong>${money(plan.totals.netExpectedCollection)}</strong></p>
      <p><span>Defaulters by age</span><strong>Current ${buckets.current} · 1 month ${buckets.oneMonth} · 2–3 months ${buckets.twoToThreeMonths} · 4+ months ${buckets.fourPlusMonths}</strong></p>
    </div>
    <h3>Customers in this cycle (${plan.lines.length})</h3>
    <div class="table-scroll"><table class="billing-cycle-table"><thead><tr><th>Customer</th><th>Package</th><th>Arrears</th><th>Advance</th><th>Net due</th></tr></thead><tbody>${lines || '<tr><td colspan="5">No customers to bill for this month.</td></tr>'}</tbody></table></div>
    ${skipped ? `<h3>Skipped (${plan.skipped.length})</h3><ul class="billing-cycle-skipped">${skipped}</ul>` : ''}
    <p class="billing-cycle-confirm-note">Check the month above, then confirm. Rates are locked per bill — later price changes never alter this cycle.</p>`;
    if (confirmBtn) confirmBtn.hidden = false;
  }

  function preview() {
    const month = (monthInput?.value || '').trim();
    currentPlan = null;
    if (resultBox) resultBox.textContent = '';
    try {
      if (!isBillingCycleMonth(month)) throw new Error('Choose a valid billing month (YYYY-MM).');
      if (month > pakistanMonthKey()) throw new Error('Future months cannot be cycled yet. Pick the current month or an earlier one.');
      const state = getState() || { customers: [] };
      const alreadyRun = loadBillingCycles().find((cycle) => cycle.month === month);
      if (alreadyRun) {
        renderPreview({ month }, alreadyRun);
        return;
      }
      currentPlan = planBillingCycle(state, month, { referralCredits: syncReferralCredits(state) });
      renderPreview(currentPlan, null);
    } catch (error) {
      if (previewBox) previewBox.innerHTML = `<p class="billing-cycle-warning">⚠️ ${escapeHtml(error.message)}</p>`;
      if (confirmBtn) confirmBtn.hidden = true;
    }
  }

  function confirm() {
    if (!currentPlan) return;
    try {
      const state = getState() || { customers: [] };
      const cycles = loadBillingCycles();
      const referralCredits = syncReferralCredits(state);
      const { state: nextState, cycle, referralApplications } = runBillingCycle(state, currentPlan.month, cycles, new Date(), { referralCredits });
      if (onUpdateState) onUpdateState(nextState);
      saveBillingCycles([...cycles, cycle]);
      // SISP-40: mark the queue entries this cycle consumed, so a credit
      // is deducted exactly once and any remainder stays queued.
      if (Array.isArray(referralApplications) && referralApplications.length) {
        saveReferralCredits(applyReferralApplications(referralCredits, referralApplications, currentPlan.month));
      }
      currentPlan = null;
      if (confirmBtn) confirmBtn.hidden = true;
      if (previewBox) previewBox.innerHTML = '';
      if (resultBox) resultBox.innerHTML = `<p class="billing-cycle-success">✅ Billing cycle for ${escapeHtml(cycle.month)} ran: ${cycle.totals.billedCount} bills · ${money(cycle.totals.totalBilled)} billed${cycle.totals.totalKist > 0 ? ` · ${money(cycle.totals.totalKist)} kist included` : ''} · ${money(cycle.totals.totalArrears)} arrears carried${cycle.totals.totalReferralCredit > 0 ? ` · ${money(cycle.totals.totalReferralCredit)} referral credit applied` : ''} · ${money(cycle.totals.netExpectedCollection)} net expected.</p>`;
      renderLastRun();
      if (onToast) onToast(`Billing cycle for ${cycle.month} ran: ${cycle.totals.billedCount} bills.`);
    } catch (error) {
      if (resultBox) resultBox.innerHTML = `<p class="billing-cycle-warning">⚠️ ${escapeHtml(error.message)}</p>`;
    }
  }

  previewBtn?.addEventListener('click', preview);
  confirmBtn?.addEventListener('click', confirm);
  dialog.querySelector('#billingCycleCloseBtn')?.addEventListener('click', () => dialog.close());
  openBtn?.addEventListener('click', () => {
    if (monthInput && !monthInput.value) monthInput.value = pakistanMonthKey();
    renderLastRun();
    if (previewBox) previewBox.innerHTML = '';
    if (resultBox) resultBox.textContent = '';
    if (confirmBtn) confirmBtn.hidden = true;
    dialog.showModal();
  });

  return {
    open() {
      if (monthInput && !monthInput.value) monthInput.value = pakistanMonthKey();
      renderLastRun();
      dialog.showModal();
    },
    refresh: renderLastRun
  };
}
