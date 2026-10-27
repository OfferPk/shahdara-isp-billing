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
import { calculatePaymentAllocations, formatPKR } from './core.js';
import { advancePlansForBilledLines, billKistTotal, dueKistLines, kistLineLabel, sanitizeBillKistLines } from './installment-plan.js';

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

export function planCustomerCycleLine(customer, month) {
  const base = { customerId: customer?.id ?? null, customerNumber: customer?.customerNumber ?? null, name: customer?.name ?? '' };
  if (!customer || customer.archived) return { ...base, skipped: true, reason: 'archived' };
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
  return {
    ...base,
    skipped: false,
    currentMonthBill: price,
    kistLines,
    kistAmount,
    kistNewAmount,
    previousArrears,
    advanceCredit,
    netDue: Math.max(0, gross - advanceCredit),
    remainingAdvance: Math.max(0, advanceCredit - gross),
    arrearsMonths,
    existingBillId: existing?.id ?? null
  };
}

export function planBillingCycle(state, month) {
  if (!isBillingCycleMonth(month)) throw new Error('Choose a valid billing month (YYYY-MM).');
  const lines = [];
  const skipped = [];
  for (const customer of state?.customers ?? []) {
    const line = planCustomerCycleLine(customer, month);
    if (line.skipped) skipped.push(line);
    else lines.push(line);
  }
  const sum = (field) => lines.reduce((total, line) => total + (line[field] || 0), 0);
  const totals = {
    totalBilled: sum('currentMonthBill'),
    totalKist: sum('kistAmount'),
    totalArrears: sum('previousArrears'),
    totalAdvanceAvailable: sum('advanceCredit'),
    totalAdvanceApplied: lines.reduce((total, line) => total + Math.min(line.advanceCredit, line.currentMonthBill + (line.kistAmount || 0) + line.previousArrears), 0),
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
/**
 * Apply a planned cycle to state. Existing bills are adopted untouched;
 * missing priced bills are created in the exact auto-generator shape
 * (rate-locked priceSnapshot, 5th due date). Never creates a second bill
 * for the same month — that is what makes re-runs safe even if the cycle
 * record itself is ever lost (e.g. a backup restore without it).
 */
export function applyBillingCycle(state, month, referenceDate = new Date()) {
  const plan = planBillingCycle(state, month);
  const byCustomerId = new Map(plan.lines.map((line) => [line.customerId, line]));
  let changed = false;
  const createdBillIds = [];
  const customers = (state?.customers ?? []).map((customer) => {
    const line = byCustomerId.get(customer.id);
    if (!line) return customer;
    // SISP-4: an adopted bill still receives this month's kist lines
    // (existing bill's dueAmount grows by exactly the new kist, and the
    // plan's monthsBilled advances). Lines already on the bill are never
    // re-added — dueKistLines excluded them from the plan.
    if (line.existingBillId) {
      if (!line.kistLines?.length) return customer;
      const bills = (customer.bills ?? []).map((bill) => {
        if (bill?.id !== line.existingBillId) return bill;
        const oldLines = sanitizeBillKistLines(bill.kistLines);
        const nextLines = [...oldLines, ...line.kistLines];
        return {
          ...bill,
          dueAmount: rupees(cents(bill.dueAmount) + cents(line.kistNewAmount)),
          kistLines: nextLines,
          kistTotal: rupees(nextLines.reduce((sum, row) => sum + cents(row.amount), 0))
        };
      });
      changed = true;
      return {
        ...customer,
        bills,
        installmentPlans: advancePlansForBilledLines(customer.installmentPlans, line.kistLines)
      };
    }
    const bill = {
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
    createdBillIds.push(bill.id);
    changed = true;
    return {
      ...customer,
      bills: [...(customer.bills ?? []), bill].sort((a, b) => b.month.localeCompare(a.month)),
      installmentPlans: advancePlansForBilledLines(customer.installmentPlans, line.kistLines)
    };
  });
  return { state: changed ? { ...state, customers } : state, plan, createdBillIds };
}

/**
 * Run one cycle. Throws when the month was already cycled — the record is
 * the re-run guard; applyBillingCycle's adopt-not-duplicate rule is the
 * backstop. Callers persist the returned state, then save the cycle.
 */
export function runBillingCycle(state, month, cycles, referenceDate = new Date()) {
  const existing = (cycles ?? []).find((cycle) => cycle?.month === month);
  if (existing) {
    throw new Error(`Monthly billing cycle for ${month} already ran${existing.ranAt ? ` on ${existing.ranAt}` : ''}. It cannot run again — re-running would double-bill.`);
  }
  const { state: nextState, plan } = applyBillingCycle(state, month, referenceDate);
  const cycle = {
    month,
    ranAt: pakistanDateTime(referenceDate),
    lines: plan.lines,
    skipped: plan.skipped,
    totals: plan.totals,
    defaulterBuckets: plan.defaulterBuckets
  };
  return { state: nextState, cycle };
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
  return {
    month: bill.month,
    packageAmount: Math.max(0, rupees(cents(amount) - cents(kistAmount))),
    kistAmount,
    kistLines,
    previousArrears,
    totalDue,
    paidAmount,
    discountApplied,
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
    `Kul Qabil-e-Ada (Total Due): ${formatPKR(breakdown.totalDue)}`,
    `Wusool Paya (Paid): ${formatPKR(breakdown.paidAmount)}`,
    `Baqi Rehta (Balance): ${formatPKR(breakdown.balanceDue)}`
  ];
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
  const skipReasonLabel = (reason) => ({
    archived: 'Archived',
    'billing-not-started': 'Billing starts later',
    'no-price': 'No price for this month',
    'unpriced-bill': 'Bill has no price'
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
      currentPlan = planBillingCycle(state, month);
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
      const { state: nextState, cycle } = runBillingCycle(state, currentPlan.month, cycles);
      if (onUpdateState) onUpdateState(nextState);
      saveBillingCycles([...cycles, cycle]);
      currentPlan = null;
      if (confirmBtn) confirmBtn.hidden = true;
      if (previewBox) previewBox.innerHTML = '';
      if (resultBox) resultBox.innerHTML = `<p class="billing-cycle-success">✅ Billing cycle for ${escapeHtml(cycle.month)} ran: ${cycle.totals.billedCount} bills · ${money(cycle.totals.totalBilled)} billed${cycle.totals.totalKist > 0 ? ` · ${money(cycle.totals.totalKist)} kist included` : ''} · ${money(cycle.totals.totalArrears)} arrears carried · ${money(cycle.totals.netExpectedCollection)} net expected.</p>`;
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
