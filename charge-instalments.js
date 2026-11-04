// Plan 104 (Plan 101-202) — One-time charge instalment schedule.
//
// This module is the SCHEDULE and the SCHEDULE VIEW only, and
// nothing else:
//
//   - One schedule per one-time charge (for example an
//     installation-related fee): a label, a total, a number of
//     instalments, and the months covered, in order. The
//     instalment amounts are computed from the total in integer
//     cents and always sum exactly to the original charge.
//   - Each bill carries its instalment as a separate line: which
//     instalment it is, how much, and how many remain after it.
//     A missed instalment (its month passed, still unpaid) stays
//     visible as outstanding — it is never dropped, forgiven,
//     or moved to another month by this module.
//   - The original charge record is never deleted or rewritten:
//     once a schedule exists, its label, total, instalment count,
//     and first month cannot be changed through upsert, and there
//     is no remove function at all. Only the paid marks move,
//     and only forward (an instalment once marked paid stays
//     paid). Recording a paid mark changes no bill, no payment,
//     and no total — the operator still records the real payment
//     through the normal payment flow.
//
// This is NOT an arrears repayment schedule: arrears are existing
// dues already owed, while this schedule splits one new one-time
// charge across future months. The two schedules are separate
// records and this module never touches the other one.
//
// Pure and import-free: every helper takes plain data and returns
// new data. The caller owns storage (the app keeps schedules in
// their own store); nothing here reads stored data, a bill, a
// payment, or the network, and no input is ever mutated.

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** True only for a real YYYY-MM month (2026-13 is rejected, never guessed). */
export function validChargeMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

function monthIndex(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return year * 12 + (monthNumber - 1);
}

function monthFromIndex(index) {
  const year = Math.floor(index / 12);
  const monthNumber = (index % 12) + 1;
  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}

/**
 * Integer cents for a money figure: an integer `amountCents` is used
 * as-is, while a plain rupees `amount` converts to cents exactly
 * once (x100, rounded). Zero, negative, non-finite and non-numeric
 * values are null, never stored as zero.
 */
export function chargeAmountCents(value) {
  if (value !== null && typeof value === 'object') {
    // A stored schedule carries totalCents already: accept it as-is so
    // normalising an already-normalised schedule is a no-op.
    if (Number.isInteger(value.totalCents) && value.totalCents > 0) return value.totalCents;
    if (Number.isInteger(value.amountCents) && value.amountCents > 0) return value.amountCents;
    if (typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0) {
      return Math.round(value.amount * 100);
    }
    if (typeof value.amount === 'string' && value.amount.trim() !== '') {
      const parsed = Number(value.amount.trim());
      if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed * 100);
    }
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value * 100);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed * 100);
  }
  return null;
}

function normalizePaidIndexes(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (Number.isInteger(item) && item >= 1 && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out.sort((a, b) => a - b);
}

/**
 * Normalise one schedule, or null when half-formed: no id, no
 * customer, blank label, unusable total, instalment count outside
 * 1..60, or an invalid first month. Unknown fields are dropped, so
 * the record can never grow a bill, payment, or discount field.
 * Paid marks beyond the instalment count are dropped, never kept.
 */
export function normalizeChargeSchedule(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = text(value.id);
  const customerId = text(value.customerId);
  const label = text(value.label);
  if (!id || !customerId || !label) return null;
  const totalCents = chargeAmountCents(value);
  if (totalCents === null) return null;
  const count = value.instalmentCount;
  if (!Number.isInteger(count) || count < 1 || count > 60) return null;
  const firstMonth = text(value.firstMonth);
  if (!validChargeMonth(firstMonth)) return null;
  const paid = normalizePaidIndexes(value.paidInstalments).filter((index) => index <= count);
  return {
    id,
    customerId,
    customerName: text(value.customerName),
    label,
    totalCents,
    instalmentCount: count,
    firstMonth,
    paidInstalments: paid,
  };
}

export function normalizeChargeScheduleList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const schedule = normalizeChargeSchedule(item);
    if (schedule && !seen.has(schedule.id)) {
      seen.add(schedule.id);
      out.push(schedule);
    }
  }
  return out;
}

/**
 * Insert a new schedule, or update only its paid marks. An upsert
 * that tries to change an existing schedule's label, total,
 * instalment count, first month, or customer is refused outright
 * (null, list left exactly unchanged) — the original charge is
 * never rewritten. A half-formed schedule is refused the same way.
 */
export function upsertChargeSchedule(list, schedule) {
  const clean = normalizeChargeSchedule(schedule);
  if (!clean) return null;
  const base = normalizeChargeScheduleList(list);
  const existing = base.find((item) => item.id === clean.id);
  if (existing) {
    const termsChanged = existing.label !== clean.label
      || existing.totalCents !== clean.totalCents
      || existing.instalmentCount !== clean.instalmentCount
      || existing.firstMonth !== clean.firstMonth
      || existing.customerId !== clean.customerId;
    if (termsChanged) return null;
    return base.map((item) => (item.id === clean.id ? clean : item));
  }
  return [...base, clean];
}

/**
 * Mark one instalment paid. Returns the updated schedule, or null
 * when the instalment is out of range or already paid — a paid mark
 * never moves backwards and never changes the charge terms.
 */
export function markInstalmentPaid(schedule, index) {
  const clean = normalizeChargeSchedule(schedule);
  if (!clean) return null;
  if (!Number.isInteger(index) || index < 1 || index > clean.instalmentCount) return null;
  if (clean.paidInstalments.includes(index)) return null;
  return { ...clean, paidInstalments: [...clean.paidInstalments, index].sort((a, b) => a - b) };
}

/** The months a schedule covers, in order, from its first month. */
export function scheduleMonths(schedule) {
  const clean = normalizeChargeSchedule(schedule);
  if (!clean) return [];
  const start = monthIndex(clean.firstMonth);
  const months = [];
  for (let i = 0; i < clean.instalmentCount; i += 1) months.push(monthFromIndex(start + i));
  return months;
}

/**
 * The instalment amounts in integer cents: the total split as
 * evenly as possible, with each leftover cent going to the
 * earliest instalments. The amounts always sum exactly to the
 * total — never rounded away, never estimated.
 */
export function instalmentAmounts(totalCents, count) {
  if (!Number.isInteger(totalCents) || totalCents <= 0) return [];
  if (!Number.isInteger(count) || count < 1 || count > 60) return [];
  const base = Math.floor(totalCents / count);
  const leftover = totalCents - base * count;
  const amounts = [];
  for (let i = 0; i < count; i += 1) amounts.push(base + (i < leftover ? 1 : 0));
  return amounts;
}

function statusFor(month, currentMonth, paid) {
  if (paid) return 'paid';
  if (!validChargeMonth(currentMonth)) return 'scheduled';
  if (month < currentMonth) return 'missed';
  if (month === currentMonth) return 'due';
  return 'upcoming';
}

/**
 * The full view of one schedule on a caller-supplied current
 * month: every instalment with its month, amount, and status
 * (paid / due / missed / upcoming / scheduled), plus totals.
 * A missed instalment is listed as missed with its amount still
 * outstanding — it is never hidden or moved.
 */
export function scheduleView(schedule, currentMonth) {
  const clean = normalizeChargeSchedule(schedule);
  if (!clean) return null;
  const months = scheduleMonths(clean);
  const amounts = instalmentAmounts(clean.totalCents, clean.instalmentCount);
  const instalments = months.map((month, i) => {
    const index = i + 1;
    return {
      index,
      month,
      amountCents: amounts[i],
      status: statusFor(month, currentMonth, clean.paidInstalments.includes(index)),
    };
  });
  const paidCents = instalments.filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + item.amountCents, 0);
  const paidCount = instalments.filter((item) => item.status === 'paid').length;
  const missed = instalments.filter((item) => item.status === 'missed');
  const nextDue = instalments.find((item) => item.status === 'due' || item.status === 'missed') ?? null;
  return {
    ...clean,
    months,
    instalments,
    paidCents,
    paidCount,
    remainingCents: clean.totalCents - paidCents,
    remainingCount: clean.instalmentCount - paidCount,
    missedCount: missed.length,
    missedCents: missed.reduce((sum, item) => sum + item.amountCents, 0),
    nextDue,
  };
}

/** Every missed instalment across schedules on the current month, oldest month first. */
export function missedInstalments(schedules, currentMonth) {
  const views = normalizeChargeScheduleList(schedules)
    .map((schedule) => scheduleView(schedule, currentMonth))
    .filter(Boolean);
  const missed = [];
  for (const view of views) {
    for (const item of view.instalments) {
      if (item.status === 'missed') {
        missed.push({
          scheduleId: view.id,
          customerId: view.customerId,
          customerName: view.customerName,
          label: view.label,
          index: item.index,
          month: item.month,
          amountCents: item.amountCents,
          remainingAfter: view.instalmentCount - item.index,
        });
      }
    }
  }
  return missed.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

/**
 * The bill line a schedule contributes to one month's bill: the
 * instalment number, how many remain after it, and its amount —
 * or null when the schedule covers no instalment that month.
 * The line is a view: it never changes the bill.
 */
export function billLineForSchedule(schedule, billMonth) {
  const view = scheduleView(schedule, billMonth);
  if (!view) return null;
  const item = view.instalments.find((entry) => entry.month === billMonth);
  if (!item) return null;
  return {
    scheduleId: view.id,
    customerId: view.customerId,
    label: view.label,
    index: item.index,
    ofCount: view.instalmentCount,
    month: item.month,
    amountCents: item.amountCents,
    status: item.status,
    remainingAfter: view.instalmentCount - item.index,
    text: `Instalment ${item.index} of ${view.instalmentCount} — ${view.label} — Rs. ${(item.amountCents / 100).toFixed(2)} — ${view.instalmentCount - item.index} remaining after this.`,
  };
}

/** All bill lines for one month across schedules. */
export function billLinesForMonth(schedules, billMonth) {
  return normalizeChargeScheduleList(schedules)
    .map((schedule) => billLineForSchedule(schedule, billMonth))
    .filter(Boolean);
}

export function chargeScheduleSummaryText(view) {
  if (!view) return 'No charge schedule.';
  return `${view.label}: Rs. ${(view.totalCents / 100).toFixed(2)} in ${view.instalmentCount} instalments, `
    + `${view.paidCount} paid (Rs. ${(view.paidCents / 100).toFixed(2)}), `
    + `${view.remainingCount} remaining (Rs. ${(view.remainingCents / 100).toFixed(2)})`
    + (view.missedCount > 0 ? `, ${view.missedCount} missed (Rs. ${(view.missedCents / 100).toFixed(2)} outstanding).` : '.');
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function chargeScheduleHtml(view) {
  if (!view) return '<p>No charge schedule.</p>';
  const rows = view.instalments.map((item) => `<tr><td>${item.index} of ${view.instalmentCount}</td>`
    + `<td>${esc(item.month)}</td><td>Rs. ${(item.amountCents / 100).toFixed(2)}</td>`
    + `<td>${esc(item.status)}</td></tr>`).join('');
  return `<h4>${esc(view.customerName || view.customerId)} — ${esc(view.label)}</h4>`
    + `<p>${esc(chargeScheduleSummaryText(view))}</p>`
    + `<table><thead><tr><th>Instalment</th><th>Month</th><th>Amount</th><th>Status</th></tr></thead>`
    + `<tbody>${rows}</tbody></table>`;
}

export function chargeScheduleCsv(schedules, currentMonth) {
  const lines = ['schedule_id,customer_id,label,total_cents,instalment_count,first_month,paid_count,remaining_cents,missed_count'];
  for (const schedule of normalizeChargeScheduleList(schedules)) {
    const view = scheduleView(schedule, currentMonth);
    const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
    lines.push([view.id, view.customerId, quote(view.label), view.totalCents,
      view.instalmentCount, view.firstMonth, view.paidCount,
      view.remainingCents, view.missedCount].join(','));
  }
  return lines.join('\n');
}

export function chargeScheduleFilename() {
  return 'charge-instalment-schedules.csv';
}
