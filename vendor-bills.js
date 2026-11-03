// Plan 41 (Plan 1-100) — Recurring vendor bill schedule and due queue.
//
// The ISP's own recurring bills — upstream bandwidth, shop rent,
// electricity, OLT maintenance — used to live only in the owner's
// memory, so a missed upstream payment could threaten service for
// all 11 mohallas at once. This module writes the schedule down:
// one vendor record per recurring bill (vendor, bill type, expected
// amount, due day of month), one occurrence per schedule per month,
// and a due-soon queue that keeps overdue bills visible until they
// are paid or operator-cancelled with a reason.
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every schedule and
//     every occurrence, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - It records and reminds only. It never pays a bill, moves
//     money, or changes any customer record, and it never writes
//     into the ledger — a paid vendor bill here is a note that
//     the operator paid it elsewhere, not a payment record.
//   - It feeds the month cash-flow snapshot (Plan 10) only as a
//     read-only monthly outflow summary computed from the same
//     schedule; Plan 10's own snapshot is untouched and is never
//     replaced by this view.
//   - The schedule record built here is the one vendor record
//     Plan 43's vendor/contract register is meant to share; no
//     second vendor system is built here.
//   - An occurrence with no recorded amount is shown as
//     "Amount not set", never as zero, and totals exclude it
//     while counting it separately.

export const VENDOR_OCCURRENCE_STATUSES = Object.freeze({
  UNPAID: 'unpaid',
  PAID: 'paid',
  CANCELLED: 'cancelled',
});

export const VENDOR_DISPLAY_STATUSES = Object.freeze({
  PAID: 'paid',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue',
  DUE_SOON: 'due-soon',
  DUE: 'due',
});

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[\",\n]/.test(str) ? `"${str.replace(/\"/g, '""')}"` : str;
}

function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function parseDateParts(value) {
  const match = DATE_PATTERN.exec(text(value));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

// A real calendar date only: 2026-02-30 is rejected, never guessed.
export function isValidVendorDate(value) {
  return parseDateParts(value) !== null;
}

export function isValidVendorMonth(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(text(value));
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Whole days from date A to date B (B minus A); both must be real dates.
export function vendorDaysBetween(from, to) {
  const a = parseDateParts(from);
  const b = parseDateParts(to);
  if (!a || !b) return null;
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86400000);
}

function normalizeDueDay(value) {
  const num = typeof value === 'string' && text(value) !== '' ? Number(text(value)) : value;
  if (typeof num !== 'number' || !Number.isFinite(num) || !Number.isInteger(num)) return null;
  if (num < 1 || num > 31) return null;
  return num;
}

// One vendor schedule record, or null when it carries no vendor, no
// bill type, or no usable due day. An expected amount is optional:
// unknown stays null ("Amount not set"), never a guessed zero.
export function normalizeVendorSchedule(row) {
  if (!row || typeof row !== 'object') return null;
  const id = text(row.id);
  const vendor = text(row.vendor);
  const billType = text(row.billType);
  const dueDay = normalizeDueDay(row.dueDay);
  if (!id || !vendor || !billType || dueDay === null) return null;
  let expectedAmount = null;
  if (row.expectedAmount !== null && row.expectedAmount !== undefined && row.expectedAmount !== '') {
    expectedAmount = money(typeof row.expectedAmount === 'string' ? Number(row.expectedAmount) : row.expectedAmount);
    if (expectedAmount === null) return null;
  }
  return {
    id,
    vendor,
    billType,
    expectedAmount,
    dueDay,
    note: text(row.note),
    active: row.active !== false,
  };
}

export function normalizeVendorSchedules(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const row of list) {
    const schedule = normalizeVendorSchedule(row);
    if (schedule) out.push(schedule);
  }
  return out;
}

export function findVendorSchedule(list, id) {
  const key = text(id);
  if (!key) return null;
  return normalizeVendorSchedules(list).find((row) => row.id === key) ?? null;
}

// Last write wins per schedule id; inputs are never mutated.
export function upsertVendorSchedule(list, row) {
  const schedule = normalizeVendorSchedule(row);
  if (!schedule) return normalizeVendorSchedules(list);
  const kept = normalizeVendorSchedules(list).filter((entry) => entry.id !== schedule.id);
  kept.push(schedule);
  kept.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.billType.localeCompare(b.billType) || a.id.localeCompare(b.id));
  return kept;
}

export function removeVendorSchedule(list, id) {
  const key = text(id);
  if (!key) return normalizeVendorSchedules(list);
  return normalizeVendorSchedules(list).filter((entry) => entry.id !== key);
}

export function vendorOccurrenceKey(scheduleId, month) {
  return `${text(scheduleId)}|${text(month)}`;
}

// One stored occurrence state, or null when it names no schedule or
// no month, or carries an unknown status. Dates are validated;
// a bad paid date becomes null, never guessed.
export function normalizeVendorOccurrence(row) {
  if (!row || typeof row !== 'object') return null;
  const scheduleId = text(row.scheduleId);
  const month = text(row.month);
  if (!scheduleId || !isValidVendorMonth(month)) return null;
  const status = text(row.status);
  if (!Object.values(VENDOR_OCCURRENCE_STATUSES).includes(status)) return null;
  let paidDate = null;
  if (row.paidDate !== null && row.paidDate !== undefined && row.paidDate !== '') {
    if (!isValidVendorDate(row.paidDate)) return null;
    paidDate = text(row.paidDate);
  }
  let paidAmount = null;
  if (row.paidAmount !== null && row.paidAmount !== undefined && row.paidAmount !== '') {
    paidAmount = money(typeof row.paidAmount === 'string' ? Number(row.paidAmount) : row.paidAmount);
    if (paidAmount === null) return null;
  }
  return {
    scheduleId,
    month,
    status,
    paidDate,
    paidAmount,
    cancelReason: text(row.cancelReason),
  };
}

export function normalizeVendorOccurrences(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const row of list) {
    const occurrence = normalizeVendorOccurrence(row);
    if (occurrence) out.push(occurrence);
  }
  return out;
}

export function findVendorOccurrence(list, scheduleId, month) {
  const key = vendorOccurrenceKey(scheduleId, month);
  return normalizeVendorOccurrences(list).find(
    (row) => vendorOccurrenceKey(row.scheduleId, row.month) === key,
  ) ?? null;
}

function upsertVendorOccurrence(list, row) {
  const occurrence = normalizeVendorOccurrence(row);
  if (!occurrence) return normalizeVendorOccurrences(list);
  const key = vendorOccurrenceKey(occurrence.scheduleId, occurrence.month);
  const kept = normalizeVendorOccurrences(list).filter(
    (entry) => vendorOccurrenceKey(entry.scheduleId, entry.month) !== key,
  );
  kept.push(occurrence);
  return kept;
}

// The due date for a schedule in a month: the due day clamped to
// the month's length (31st becomes 28th/29th/30th, leap-aware).
export function vendorDueDateForMonth(dueDay, month) {
  const day = normalizeDueDay(dueDay);
  if (day === null || !isValidVendorMonth(month)) return null;
  const [yearText, monthText] = text(month).split('-');
  const year = Number(yearText);
  const monthNum = Number(monthText);
  const clamped = Math.min(day, daysInMonth(year, monthNum));
  return `${yearText}-${monthText}-${String(clamped).padStart(2, '0')}`;
}

// Exactly one occurrence per schedule for a month: an active
// schedule always appears, and a stored paid/cancelled occurrence
// still appears even if its schedule was later deactivated, so
// history is never hidden by deactivation.
export function buildMonthOccurrences(schedules, occurrences, month) {
  if (!isValidVendorMonth(month)) return [];
  const cleanSchedules = normalizeVendorSchedules(schedules);
  const cleanOccurrences = normalizeVendorOccurrences(occurrences);
  const rows = [];
  for (const schedule of cleanSchedules) {
    const stored = cleanOccurrences.find(
      (entry) => entry.scheduleId === schedule.id && entry.month === month,
    );
    if (!schedule.active && !stored) continue;
    rows.push({
      scheduleId: schedule.id,
      vendor: schedule.vendor,
      billType: schedule.billType,
      month,
      dueDate: vendorDueDateForMonth(schedule.dueDay, month),
      expectedAmount: schedule.expectedAmount,
      note: schedule.note,
      status: stored ? stored.status : VENDOR_OCCURRENCE_STATUSES.UNPAID,
      paidDate: stored ? stored.paidDate : null,
      paidAmount: stored ? stored.paidAmount : null,
      cancelReason: stored ? stored.cancelReason : '',
    });
  }
  rows.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
    || a.vendor.localeCompare(b.vendor) || a.billType.localeCompare(b.billType));
  return rows;
}

// Display status for one occurrence row against today.
export function vendorOccurrenceDisplayStatus(row, today, dueSoonDays = 7) {
  if (!row || typeof row !== 'object') return VENDOR_DISPLAY_STATUSES.DUE;
  if (row.status === VENDOR_OCCURRENCE_STATUSES.PAID) return VENDOR_DISPLAY_STATUSES.PAID;
  if (row.status === VENDOR_OCCURRENCE_STATUSES.CANCELLED) return VENDOR_DISPLAY_STATUSES.CANCELLED;
  const due = row.dueDate;
  if (!isValidVendorDate(due) || !isValidVendorDate(today)) return VENDOR_DISPLAY_STATUSES.DUE;
  const diff = vendorDaysBetween(today, due);
  if (diff < 0) return VENDOR_DISPLAY_STATUSES.OVERDUE;
  const window = typeof dueSoonDays === 'number' && Number.isFinite(dueSoonDays) && dueSoonDays >= 0
    ? Math.floor(dueSoonDays) : 7;
  if (diff <= window) return VENDOR_DISPLAY_STATUSES.DUE_SOON;
  return VENDOR_DISPLAY_STATUSES.DUE;
}

// Mark one occurrence paid: records the date and amount paid and
// clears it from the due queue. Refused (applied false, list
// unchanged) when the schedule is unknown, the occurrence is
// already paid or cancelled, the paid date is invalid, or the
// paid amount is not positive. A blank paid date means today.
export function markVendorOccurrencePaid(schedules, occurrences, scheduleId, month, options = {}) {
  const cleanOccurrences = normalizeVendorOccurrences(occurrences);
  const schedule = findVendorSchedule(schedules, scheduleId);
  if (!schedule || !isValidVendorMonth(month)) return { occurrences: cleanOccurrences, applied: false };
  const stored = findVendorOccurrence(cleanOccurrences, scheduleId, month);
  if (stored && stored.status !== VENDOR_OCCURRENCE_STATUSES.UNPAID) {
    return { occurrences: cleanOccurrences, applied: false };
  }
  const today = isValidVendorDate(options.today) ? text(options.today) : null;
  const paidDate = text(options.paidDate) !== '' ? text(options.paidDate) : today;
  if (!isValidVendorDate(paidDate)) return { occurrences: cleanOccurrences, applied: false };
  const paidAmount = money(typeof options.paidAmount === 'string' ? Number(options.paidAmount) : options.paidAmount);
  if (paidAmount === null) return { occurrences: cleanOccurrences, applied: false };
  return {
    occurrences: upsertVendorOccurrence(cleanOccurrences, {
      scheduleId: schedule.id, month: text(month),
      status: VENDOR_OCCURRENCE_STATUSES.PAID, paidDate, paidAmount, cancelReason: '',
    }),
    applied: true,
  };
}

// Cancel one occurrence: refused without a reason, or when it is
// already paid or cancelled. An unpaid bill past its due date
// stays visible as overdue until paid or cancelled this way.
export function cancelVendorOccurrence(schedules, occurrences, scheduleId, month, reason) {
  const cleanOccurrences = normalizeVendorOccurrences(occurrences);
  const schedule = findVendorSchedule(schedules, scheduleId);
  if (!schedule || !isValidVendorMonth(month)) return { occurrences: cleanOccurrences, applied: false };
  const note = text(reason);
  if (!note) return { occurrences: cleanOccurrences, applied: false };
  const stored = findVendorOccurrence(cleanOccurrences, scheduleId, month);
  if (stored && stored.status !== VENDOR_OCCURRENCE_STATUSES.UNPAID) {
    return { occurrences: cleanOccurrences, applied: false };
  }
  return {
    occurrences: upsertVendorOccurrence(cleanOccurrences, {
      scheduleId: schedule.id, month: text(month),
      status: VENDOR_OCCURRENCE_STATUSES.CANCELLED, paidDate: null, paidAmount: null, cancelReason: note,
    }),
    applied: true,
  };
}

// The due-soon queue: every unpaid occurrence whose due date falls
// on or before today + dueSoonDays — overdue first (oldest due
// first), then by due date, then vendor A–Z. Overdue rows stay in
// the queue until paid or cancelled; nothing ages out of it.
export function buildVendorDueQueue(schedules, occurrences, options = {}) {
  const today = text(options.today);
  if (!isValidVendorDate(today)) return [];
  const window = typeof options.dueSoonDays === 'number' && Number.isFinite(options.dueSoonDays) && options.dueSoonDays >= 0
    ? Math.floor(options.dueSoonDays) : 7;
  const cleanSchedules = normalizeVendorSchedules(schedules);
  const cleanOccurrences = normalizeVendorOccurrences(occurrences);
  const rows = [];
  for (const occurrence of cleanOccurrences) {
    if (occurrence.status !== VENDOR_OCCURRENCE_STATUSES.UNPAID) continue;
    const schedule = cleanSchedules.find((entry) => entry.id === occurrence.scheduleId);
    if (!schedule) continue;
    const dueDate = vendorDueDateForMonth(schedule.dueDay, occurrence.month);
    if (!dueDate) continue;
    const diff = vendorDaysBetween(today, dueDate);
    if (diff === null || diff > window) continue;
    rows.push({
      scheduleId: schedule.id,
      vendor: schedule.vendor,
      billType: schedule.billType,
      month: occurrence.month,
      dueDate,
      expectedAmount: schedule.expectedAmount,
      note: schedule.note,
      displayStatus: diff < 0 ? VENDOR_DISPLAY_STATUSES.OVERDUE : VENDOR_DISPLAY_STATUSES.DUE_SOON,
      daysOverdue: diff < 0 ? -diff : 0,
      daysUntilDue: diff >= 0 ? diff : 0,
    });
  }
  // Unpaid occurrences never stored yet (this month's schedules with
  // no occurrence row) count too: a schedule with no stored state
  // is unpaid by default.
  const currentMonth = today.slice(0, 7);
  for (const schedule of cleanSchedules) {
    if (!schedule.active) continue;
    const stored = cleanOccurrences.find(
      (entry) => entry.scheduleId === schedule.id && entry.month === currentMonth,
    );
    if (stored) continue;
    const dueDate = vendorDueDateForMonth(schedule.dueDay, currentMonth);
    if (!dueDate) continue;
    const diff = vendorDaysBetween(today, dueDate);
    if (diff === null || diff > window) continue;
    rows.push({
      scheduleId: schedule.id,
      vendor: schedule.vendor,
      billType: schedule.billType,
      month: currentMonth,
      dueDate,
      expectedAmount: schedule.expectedAmount,
      note: schedule.note,
      displayStatus: diff < 0 ? VENDOR_DISPLAY_STATUSES.OVERDUE : VENDOR_DISPLAY_STATUSES.DUE_SOON,
      daysOverdue: diff < 0 ? -diff : 0,
      daysUntilDue: diff >= 0 ? diff : 0,
    });
  }
  rows.sort((a, b) => {
    const aOver = a.displayStatus === VENDOR_DISPLAY_STATUSES.OVERDUE ? 0 : 1;
    const bOver = b.displayStatus === VENDOR_DISPLAY_STATUSES.OVERDUE ? 0 : 1;
    return aOver - bOver || a.dueDate.localeCompare(b.dueDate)
      || a.vendor.localeCompare(b.vendor) || a.billType.localeCompare(b.billType);
  });
  return rows;
}

// Read-only monthly outflow summary for the Plan 10 cash-flow
// snapshot to read alongside its own figures: expected, paid and
// unpaid totals for one month, with amount-less occurrences counted
// separately and never folded into a total as zero.
export function vendorMonthOutflow(schedules, occurrences, month) {
  const rows = buildMonthOccurrences(schedules, occurrences, month);
  let expectedTotal = 0;
  let paidTotal = 0;
  let unpaidTotal = 0;
  let unknownAmountCount = 0;
  for (const row of rows) {
    if (row.expectedAmount === null) {
      unknownAmountCount += 1;
      continue;
    }
    expectedTotal += row.expectedAmount;
    if (row.status === VENDOR_OCCURRENCE_STATUSES.PAID) {
      paidTotal += row.paidAmount ?? row.expectedAmount;
    } else if (row.status === VENDOR_OCCURRENCE_STATUSES.UNPAID) {
      unpaidTotal += row.expectedAmount;
    }
  }
  return {
    month: text(month),
    rows,
    expectedTotal: Math.round(expectedTotal * 100) / 100,
    paidTotal: Math.round(paidTotal * 100) / 100,
    unpaidTotal: Math.round(unpaidTotal * 100) / 100,
    unknownAmountCount,
    count: rows.length,
  };
}

export function vendorBillsSummaryText(queue, outflow) {
  const overdue = queue.filter((row) => row.displayStatus === VENDOR_DISPLAY_STATUSES.OVERDUE).length;
  const dueSoon = queue.length - overdue;
  const monthPart = outflow
    ? ` ${outflow.month} expected vendor outgo ${outflow.expectedTotal} PKR (${outflow.paidTotal} paid, ${outflow.unpaidTotal} unpaid${outflow.unknownAmountCount ? `, ${outflow.unknownAmountCount} without a recorded amount` : ''}).`
    : '';
  return `${queue.length} vendor bill(s) in the due queue (${overdue} overdue, ${dueSoon} due soon).${monthPart}`;
}

export function vendorBillsHtml(queue, outflow) {
  const queueRows = queue.length === 0
    ? '<tr><td colspan="6">No vendor bills due soon.</td></tr>'
    : queue.map((row) => `<tr><td>${escapeHtml(row.vendor)}</td><td>${escapeHtml(row.billType)}</td><td>${escapeHtml(row.month)}</td><td>${escapeHtml(row.dueDate)}</td><td>${row.expectedAmount === null ? 'Amount not set' : `${row.expectedAmount} PKR`}</td><td>${row.displayStatus === VENDOR_DISPLAY_STATUSES.OVERDUE ? `Overdue ${row.daysOverdue} day(s)` : `Due in ${row.daysUntilDue} day(s)`} <button type="button" data-vendor-pay="${escapeHtml(row.scheduleId)}:${escapeHtml(row.month)}">Mark paid</button> <button type="button" data-vendor-cancel="${escapeHtml(row.scheduleId)}:${escapeHtml(row.month)}">Cancel</button></td></tr>`).join('');
  const monthRows = !outflow || outflow.rows.length === 0
    ? '<tr><td colspan="6">No vendor schedules for this month.</td></tr>'
    : outflow.rows.map((row) => `<tr><td>${escapeHtml(row.vendor)}</td><td>${escapeHtml(row.billType)}</td><td>${escapeHtml(row.dueDate)}</td><td>${row.expectedAmount === null ? 'Amount not set' : `${row.expectedAmount} PKR`}</td><td>${escapeHtml(row.status)}${row.paidDate ? ` on ${escapeHtml(row.paidDate)}` : ''}${row.cancelReason ? ` (${escapeHtml(row.cancelReason)})` : ''}</td><td>${escapeHtml(row.note)}</td></tr>`).join('');
  return `<h4>Due queue</h4><table><thead><tr><th>Vendor</th><th>Bill type</th><th>Month</th><th>Due date</th><th>Expected</th><th>Status</th></tr></thead><tbody>${queueRows}</tbody></table>`
    + `<h4>This month</h4><table><thead><tr><th>Vendor</th><th>Bill type</th><th>Due date</th><th>Expected</th><th>Status</th><th>Note</th></tr></thead><tbody>${monthRows}</tbody></table>`;
}

export function vendorBillsCsv(queue, outflow) {
  const lines = ['vendor,bill_type,month,due_date,expected_amount,status,paid_date,paid_amount,cancel_reason'];
  const rows = outflow ? outflow.rows : [];
  for (const row of rows) {
    lines.push([
      csvCell(row.vendor), csvCell(row.billType), csvCell(row.month), csvCell(row.dueDate),
      csvCell(row.expectedAmount === null ? '' : row.expectedAmount), csvCell(row.status),
      csvCell(row.paidDate ?? ''), csvCell(row.paidAmount === null ? '' : row.paidAmount),
      csvCell(row.cancelReason ?? ''),
    ].join(','));
  }
  const queuePart = queue.map((row) => [
    csvCell(row.vendor), csvCell(row.billType), csvCell(row.month), csvCell(row.dueDate),
    csvCell(row.expectedAmount === null ? '' : row.expectedAmount), csvCell(row.displayStatus),
    csvCell(''), csvCell(''), csvCell(''),
  ].join(',')).join('\n');
  return lines.join('\n') + (queuePart ? `\n${queuePart}` : '');
}

export function vendorBillsFilename(month) {
  return `vendor-bills-${isValidVendorMonth(month) ? text(month) : 'month'}.csv`;
}
