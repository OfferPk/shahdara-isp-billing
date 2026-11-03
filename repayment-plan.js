// Plan 37 — Arrears repayment plan (dated instalments, current bill separate).
//
// A repayment schedule only, agreed by the operator: the arrears balance
// at agreement time split into dated instalments, each tracked as paid,
// due, or missed, while the current month's bill stays due on its own
// date. This is a schedule and a tracker — not a discount, not a waiver,
// not a billing recalculation — and it never rewrites a past bill, a
// payment total, or a Waada promise.
//
// What this module never holds: no bill field, no payment-ledger field,
// no Waada field. Recording a payment against an instalment marks that
// instalment paid and nothing else; the operator still records the real
// payment through the normal payment flow. A missed instalment appears
// in the plan and in a Waada-style follow-up queue (customer, due date,
// amount outstanding) — the queue is a working list, it writes no Waada
// record and never changes a Waada promise (Plan O keeps those).
//
// A plan can be closed early only by full payment or by an
// operator-recorded reason; closing changes only the plan's own status.
//
// Pure and import-free: every helper takes plain data and returns new
// data. The caller owns storage (the app keeps plans in their own
// localStorage store); nothing here touches localStorage, a bill, a
// payment, or a Waada record.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

const round2 = (value) => Math.round(value * 100) / 100;

/** True only for a real calendar date (2026-02-30 is rejected, never guessed). */
export function isValidRepaymentDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * A money amount is a positive finite number, rounded to two decimals.
 * Numeric strings are accepted ("3000" → 3000); zero, negative,
 * non-finite and non-numeric values are null, never stored as zero.
 */
export function normalizeRepaymentAmount(value) {
  let num = null;
  if (typeof value === 'number' && Number.isFinite(value)) num = value;
  else if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) num = parsed;
  }
  if (num === null || num <= 0) return null;
  return round2(num);
}

/** Whole days between two valid dates (later − earlier); null when either is invalid. */
export function repaymentDaysBetween(earlier, later) {
  if (!isValidRepaymentDate(earlier) || !isValidRepaymentDate(later)) return null;
  const a = new Date(`${earlier}T00:00:00Z`).getTime();
  const b = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function daysInMonth(year, monthNumber) {
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/**
 * Monthly due dates starting from `firstDate`: one date per month, the
 * day clamped to the month's length (31st → 28th/29th/30th in a shorter
 * month, never an invalid date). Returns null for an invalid first
 * date or a non-positive count — never a half-formed schedule.
 */
export function monthlyDueDates(firstDate, count) {
  if (!isValidRepaymentDate(firstDate)) return null;
  if (!Number.isInteger(count) || count < 1) return null;
  const [year, month, day] = firstDate.split('-').map(Number);
  const dates = [];
  for (let i = 0; i < count; i += 1) {
    const totalMonths = (year * 12 + (month - 1)) + i;
    const y = Math.floor(totalMonths / 12);
    const m = (totalMonths % 12) + 1;
    const d = Math.min(day, daysInMonth(y, m));
    dates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

/**
 * One normalised instalment, or null when it cannot be one: a
 * non-positive amount is rejected outright, never stored as zero.
 * An invalid due date becomes null (flagged by validation, never
 * guessed); a paid amount is clamped to the instalment amount, never
 * above it. `sequence` is the instalment's 1-based position in its
 * plan, assigned by the caller (or by the split helper).
 */
export function normalizeRepaymentInstalment(value, sequence = 0) {
  if (!value || typeof value !== 'object') return null;
  const amount = normalizeRepaymentAmount(value.amount);
  if (amount === null) return null;
  let paidAmount = 0;
  if (typeof value.paidAmount === 'number' && Number.isFinite(value.paidAmount)) {
    paidAmount = Math.min(amount, Math.max(0, round2(value.paidAmount)));
  } else if (typeof value.paidAmount === 'string' && value.paidAmount.trim() !== '') {
    const parsed = Number(value.paidAmount.trim());
    if (Number.isFinite(parsed)) paidAmount = Math.min(amount, Math.max(0, round2(parsed)));
  }
  return {
    sequence: Number.isInteger(sequence) && sequence >= 1 ? sequence : 0,
    dueDate: isValidRepaymentDate(value.dueDate) ? value.dueDate : null,
    amount,
    paidAmount,
  };
}

/**
 * One normalised plan, or null when it cannot be one: a missing
 * customer id or a non-positive arrears balance is rejected outright,
 * never stored half-formed. An invalid agreement date becomes null
 * (never guessed); instalments that cannot normalise are dropped, and
 * validation (below) reports the resulting sum gap. Status is open
 * unless explicitly closed; a close reason is trimmed, never invented.
 */
export function normalizeRepaymentPlan(value) {
  if (!value || typeof value !== 'object') return null;
  const customerId = text(value.customerId);
  const arrearsBalance = normalizeRepaymentAmount(value.arrearsBalance);
  if (!customerId || arrearsBalance === null) return null;
  const instalments = [];
  if (Array.isArray(value.instalments)) {
    value.instalments.forEach((entry, index) => {
      const clean = normalizeRepaymentInstalment(entry, index + 1);
      if (clean) instalments.push(clean);
    });
  }
  return {
    id: text(value.id),
    customerId,
    arrearsBalance,
    agreedAt: isValidRepaymentDate(value.agreedAt) ? value.agreedAt : null,
    instalments,
    status: value.status === 'closed' ? 'closed' : 'open',
    closeReason: text(value.closeReason),
  };
}

/** A caller-owned list, normalised: rejects dropped, inputs never mutated. */
export function normalizeRepaymentPlans(list) {
  if (!Array.isArray(list)) return [];
  return list.map((entry) => normalizeRepaymentPlan(entry)).filter(Boolean);
}

export function findRepaymentPlan(plans, id) {
  const key = text(id);
  if (!key) return null;
  return normalizeRepaymentPlans(plans).find((plan) => plan.id === key) ?? null;
}

/**
 * Upsert: a plan with an id matching an existing plan replaces it;
 * a plan without an id, or with a new id, is appended. Inputs are
 * never mutated.
 */
export function upsertRepaymentPlan(plans, plan) {
  const next = normalizeRepaymentPlans(plans);
  const clean = normalizeRepaymentPlan(plan);
  if (!clean) return next;
  if (!clean.id) return [...next, clean];
  return [...next.filter((entry) => entry.id !== clean.id), clean];
}

/** Remove a plan by id; an unknown id leaves the list unchanged. */
export function removeRepaymentPlan(plans, id) {
  const key = text(id);
  const next = normalizeRepaymentPlans(plans);
  if (!key) return next;
  return next.filter((entry) => entry.id !== key);
}

/**
 * Split an arrears balance into dated instalments: the balance divided
 * across the given due dates, with any remainder cents on the last
 * instalment, so the instalments sum exactly to the balance. Returns
 * null for a non-positive balance, an empty date list, or any invalid
 * date — never a half-formed schedule.
 */
export function splitArrearsIntoInstalments(balance, dueDates) {
  const total = normalizeRepaymentAmount(balance);
  if (total === null) return null;
  if (!Array.isArray(dueDates) || dueDates.length === 0) return null;
  if (!dueDates.every((date) => isValidRepaymentDate(date))) return null;
  const totalCents = Math.round(total * 100);
  const count = dueDates.length;
  const base = Math.floor(totalCents / count);
  const instalments = dueDates.map((dueDate, index) => {
    const cents = index === count - 1 ? totalCents - base * (count - 1) : base;
    return { sequence: index + 1, dueDate, amount: round2(cents / 100), paidAmount: 0 };
  });
  return instalments;
}

/**
 * One instalment's status against `today`:
 * - paid: fully paid (paid amount reaches the instalment amount);
 * - missed: not fully paid and its due date is before today;
 * - due: everything else (including an undated instalment, which can
 *   never be overdue, and a day with no valid today to judge by).
 * A partially paid instalment past its date is missed — it is still owed.
 */
export function instalmentStatus(instalment, today = '') {
  const clean = normalizeRepaymentInstalment(instalment, instalment?.sequence ?? 0);
  if (!clean) return 'due';
  if (clean.paidAmount >= clean.amount) return 'paid';
  if (clean.dueDate && isValidRepaymentDate(today) && clean.dueDate < today) return 'missed';
  return 'due';
}

/** A plan's instalments with their status attached; inputs never mutated. */
export function planInstalmentStatuses(plan, today = '') {
  const clean = normalizeRepaymentPlan(plan);
  if (!clean) return [];
  return clean.instalments.map((entry) => ({ ...entry, status: instalmentStatus(entry, today) }));
}

/** Totals for one plan: paid, remaining, and counts by instalment status. */
export function planTotals(plan, today = '') {
  const clean = normalizeRepaymentPlan(plan);
  if (!clean) {
    return {
      arrearsBalance: 0, paidTotal: 0, remainingTotal: 0,
      instalmentCount: 0, paidCount: 0, dueCount: 0, missedCount: 0, fullyPaid: false,
    };
  }
  const rows = planInstalmentStatuses(clean, today);
  const paidTotal = round2(rows.reduce((sum, row) => sum + row.paidAmount, 0));
  return {
    arrearsBalance: clean.arrearsBalance,
    paidTotal,
    remainingTotal: round2(Math.max(0, clean.arrearsBalance - paidTotal)),
    instalmentCount: rows.length,
    paidCount: rows.filter((row) => row.status === 'paid').length,
    dueCount: rows.filter((row) => row.status === 'due').length,
    missedCount: rows.filter((row) => row.status === 'missed').length,
    fullyPaid: rows.length > 0 && rows.every((row) => row.status === 'paid'),
  };
}

/**
 * Record a payment against one instalment: returns a new plan plus how
 * much was applied and how much is left over. The applied amount never
 * exceeds what the instalment still owes; the excess is reported, not
 * silently spread to other instalments and not written to any bill.
 * An invalid amount, an unknown sequence, or an already-paid
 * instalment applies nothing (the amount comes back as excess when it
 * was a real payment, so the operator still holds it). No bill, payment
 * ledger, or Waada record is touched — this module holds none of those.
 */
export function recordInstalmentPayment(plan, sequence, amount) {
  const clean = normalizeRepaymentPlan(plan);
  const parsed = normalizeRepaymentAmount(amount);
  if (!clean) return { plan: null, applied: 0, excess: parsed ?? 0 };
  if (parsed === null) return { plan: clean, applied: 0, excess: 0 };
  const target = clean.instalments.find((entry) => entry.sequence === sequence);
  if (!target) return { plan: clean, applied: 0, excess: parsed };
  const owed = round2(target.amount - target.paidAmount);
  if (owed <= 0) return { plan: clean, applied: 0, excess: parsed };
  const applied = Math.min(parsed, owed);
  const next = {
    ...clean,
    instalments: clean.instalments.map((entry) => (
      entry.sequence === sequence ? { ...entry, paidAmount: round2(entry.paidAmount + applied) } : entry
    )),
  };
  return { plan: next, applied, excess: round2(parsed - applied) };
}

/**
 * A plan may close early only when every instalment is paid, or when
 * the operator records a reason. Anything else stays open.
 */
export function canCloseRepaymentPlan(plan, reason = '') {
  const clean = normalizeRepaymentPlan(plan);
  if (!clean) return false;
  if (planTotals(clean).fullyPaid) return true;
  return text(reason) !== '';
}

/**
 * Close a plan when allowed: fully paid plans close with "Paid in
 * full" unless the operator gave a reason; otherwise the reason is
 * recorded. A plan that may not close is returned unchanged.
 */
export function closeRepaymentPlan(plan, reason = '') {
  const clean = normalizeRepaymentPlan(plan);
  if (!clean) return null;
  if (!canCloseRepaymentPlan(clean, reason)) return clean;
  const note = text(reason) || (planTotals(clean).fullyPaid ? 'Paid in full' : '');
  return { ...clean, status: 'closed', closeReason: note };
}

/**
 * Validate a plan: the instalments must sum exactly to the arrears
 * balance (to two decimals), every instalment must be dated, and the
 * plan must carry at least one instalment. A closed plan that is
 * neither fully paid nor reasoned is also reported. Returns
 * { valid, issues[] } — never throws on bad input.
 */
export function validateRepaymentPlan(plan) {
  const clean = normalizeRepaymentPlan(plan);
  if (!clean) return { valid: false, issues: ['Not a valid repayment plan.'] };
  const issues = [];
  if (clean.instalments.length === 0) issues.push('The plan has no instalments.');
  const sum = round2(clean.instalments.reduce((total, entry) => total + entry.amount, 0));
  if (sum !== clean.arrearsBalance) {
    issues.push(`Instalments sum to ${sum}, not the arrears balance ${clean.arrearsBalance}.`);
  }
  if (clean.instalments.some((entry) => !entry.dueDate)) {
    issues.push('Every instalment needs a due date.');
  }
  if (clean.status === 'closed' && !planTotals(clean).fullyPaid && !clean.closeReason) {
    issues.push('A closed plan needs full payment or an operator-recorded reason.');
  }
  return { valid: issues.length === 0, issues };
}

/**
 * The Waada-style follow-up queue: one row per missed instalment across
 * all plans, oldest due date first, then customer, then sequence.
 * This is a working list only — it creates no Waada record and changes
 * no Waada promise; the operator follows up from here and records any
 * real promise through the normal Waada flow.
 */
export function missedInstalmentFollowUps(plans, today = '') {
  const rows = [];
  for (const plan of normalizeRepaymentPlans(plans)) {
    if (plan.status === 'closed') continue;
    for (const entry of planInstalmentStatuses(plan, today)) {
      if (entry.status !== 'missed') continue;
      rows.push({
        planId: plan.id,
        customerId: plan.customerId,
        sequence: entry.sequence,
        dueDate: entry.dueDate,
        amount: entry.amount,
        paidAmount: entry.paidAmount,
        outstanding: round2(entry.amount - entry.paidAmount),
        daysOverdue: repaymentDaysBetween(entry.dueDate, today) ?? 0,
      });
    }
  }
  rows.sort((a, b) => (
    (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0)
    || (a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0)
    || (a.sequence - b.sequence)
  ));
  return rows;
}

/** Plain-words summary for one plan. */
export function repaymentPlanSummaryText(plan, today = '') {
  const clean = normalizeRepaymentPlan(plan);
  if (!clean) return 'No repayment plan.';
  const totals = planTotals(clean, today);
  const state = clean.status === 'closed'
    ? `Closed${clean.closeReason ? ` — ${clean.closeReason}` : ''}`
    : `${totals.missedCount} missed, ${totals.dueCount} due, ${totals.paidCount} paid`;
  return `Arrears ${clean.arrearsBalance}, paid ${totals.paidTotal}, remaining ${totals.remainingTotal} across ${totals.instalmentCount} instalments. ${state}.`;
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const money = (value) => String(value);

/**
 * Escaped panel HTML: one block per plan (instalments with a Mark paid
 * button each, close button for open plans) plus the missed-instalment
 * follow-up queue. Never throws on bad input.
 */
export function repaymentPlanHtml(plans, { names = {}, today = '' } = {}) {
  const list = normalizeRepaymentPlans(plans);
  if (list.length === 0) return '<p>No repayment plans yet.</p>';
  const followUps = missedInstalmentFollowUps(list, today);
  const blocks = list.map((plan) => {
    const totals = planTotals(plan, today);
    const name = names[plan.customerId] || plan.customerId;
    const validation = validateRepaymentPlan(plan);
    const rows = planInstalmentStatuses(plan, today).map((entry) => {
      const payButton = plan.status === 'open' && entry.status !== 'paid'
        ? ` <button type="button" class="secondary-button btn-sm" data-repayment-pay="${escapeHtml(plan.id)}:${entry.sequence}">Mark paid</button>`
        : '';
      return `<tr><td>${entry.sequence}</td><td>${escapeHtml(entry.dueDate ?? 'Not set')}</td><td>${money(entry.amount)}</td><td>${money(entry.paidAmount)}</td><td>${entry.status}</td><td>${payButton}</td></tr>`;
    }).join('');
    const closeButton = plan.status === 'open'
      ? ` <button type="button" class="secondary-button btn-sm" data-repayment-close="${escapeHtml(plan.id)}">Close plan</button>`
      : '';
    const issues = validation.valid ? '' : `<p>⚠️ ${escapeHtml(validation.issues.join(' '))}</p>`;
    return `<div><h4>${escapeHtml(name)} — ${escapeHtml(repaymentPlanSummaryText(plan, today))}</h4>${issues}<table><thead><tr><th>#</th><th>Due</th><th>Amount</th><th>Paid</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table><p>Paid ${money(totals.paidTotal)} of ${money(totals.arrearsBalance)}, remaining ${money(totals.remainingTotal)}.${closeButton}</p></div>`;
  }).join('');
  const queue = followUps.length === 0
    ? '<p>No missed instalments in the follow-up queue.</p>'
    : `<ul>${followUps.map((row) => `<li>${escapeHtml(names[row.customerId] || row.customerId)} — instalment ${row.sequence} due ${escapeHtml(row.dueDate)}: ${money(row.outstanding)} outstanding, ${row.daysOverdue} days overdue.</li>`).join('')}</ul>`;
  return `${blocks}<h4>Missed-instalment follow-up queue</h4>${queue}`;
}

/** CSV for all plans (one row per instalment) plus the follow-up queue. */
export function repaymentPlanCsv(plans, { names = {}, today = '' } = {}) {
  const list = normalizeRepaymentPlans(plans);
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = ['customerId,customerName,planId,agreedAt,arrearsBalance,sequence,dueDate,amount,paidAmount,status,planStatus'];
  for (const plan of list) {
    for (const entry of planInstalmentStatuses(plan, today)) {
      lines.push([
        plan.customerId, names[plan.customerId] || '', plan.id, plan.agreedAt ?? '',
        plan.arrearsBalance, entry.sequence, entry.dueDate ?? '', entry.amount,
        entry.paidAmount, entry.status, plan.status,
      ].map(quote).join(','));
    }
  }
  return lines.join('\n');
}

export function repaymentPlanFilename() {
  return 'repayment-plans.csv';
}
