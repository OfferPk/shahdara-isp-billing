// Plan 126 (Plan 101-202) — Due-date weekend and holiday shift rule.
//
// A due date that falls on a closed day used to be enforced as if
// the shop were open, so a customer who would have paid on time
// was treated as late. This module is the one written shift rule:
// the operator chooses whether a closed-day due date moves forward
// to the next working day or back to the previous one, and which
// days count as closed (weekdays plus named holiday dates).
//
// What this module does, and nothing more:
//   - It shifts due dates only. It never changes a bill amount,
//     a cycle choice, or any individual extension, and it
//     never opens any other record to do its work — the rule and
//     the bills arrive as caller-supplied values.
//   - Every shifted bill keeps both dates: the original due date
//     and the shifted due date, shown side by side. A past due
//     date is never rewritten in place; the view carries the
//     original along with the shift.
//   - The rule applies only from its effective date: a due date
//     before the effective date is returned unshifted, whatever
//     day of the week it falls on.
//   - The shifted date is the date any later fee or reminder
//     logic should use. This module only answers that date; it
//     does not run that logic itself.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Strict YYYY-MM-DD calendar date, or null (2026-02-30 is not a date). */
export function validShiftDate(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  const max = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > max) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function dateToUtcDays(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function utcDaysToDate(days) {
  const dt = new Date(days * 86400000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Weekday of a strict date: 0 = Sunday … 6 = Saturday, or null. */
export function weekdayOf(date) {
  const clean = validShiftDate(date);
  if (!clean) return null;
  return new Date(Date.UTC(...clean.split('-').map(Number).map((v, i) => (i === 1 ? v - 1 : v)))).getUTCDay();
}

function normalizeWeekdays(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const day = typeof item === 'number' ? item : (typeof item === 'string' && item.trim() !== '' ? Number(item.trim()) : NaN);
    if (!Number.isInteger(day) || day < 0 || day > 6 || seen.has(day)) {
      if (!Number.isInteger(day) || day < 0 || day > 6) return null;
      continue;
    }
    seen.add(day);
    out.push(day);
  }
  return out.sort((a, b) => a - b);
}

function normalizeHolidays(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const date = validShiftDate(item);
    if (!date) return null;
    if (seen.has(date)) continue;
    seen.add(date);
    out.push(date);
  }
  return out.sort();
}

export const SHIFT_DIRECTIONS = ['forward', 'back'];

/** One shift rule, or null when half-formed. Unknown fields are dropped. */
export function normalizeShiftRule(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const direction = text(raw.direction);
  const effectiveDate = validShiftDate(raw.effectiveDate);
  if (!id || !SHIFT_DIRECTIONS.includes(direction) || !effectiveDate) return null;
  const closedWeekdays = normalizeWeekdays(raw.closedWeekdays);
  if (closedWeekdays === null) return null;
  const holidays = normalizeHolidays(raw.holidays);
  if (holidays === null) return null;
  return {
    id,
    name: text(raw.name),
    direction,
    closedWeekdays,
    holidays,
    effectiveDate,
    note: text(raw.note),
  };
}

export function normalizeShiftRuleList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const rule = normalizeShiftRule(item);
    if (!rule || seen.has(rule.id)) continue;
    seen.add(rule.id);
    out.push(rule);
  }
  return out;
}

export function findShiftRule(list, id) {
  const cleanId = text(id);
  if (!cleanId) return null;
  return normalizeShiftRuleList(list).find((item) => item.id === cleanId) || null;
}

/**
 * Record a shift rule. A rule id already recorded is never
 * rewritten: an identical re-save leaves the list unchanged, and
 * a different rule under the same id is refused.
 */
export function recordShiftRule(list, raw) {
  const clean = normalizeShiftRuleList(list);
  const rule = normalizeShiftRule(raw);
  if (!rule) return clean;
  if (clean.some((item) => item.id === rule.id)) return clean;
  return [...clean, rule];
}

/** True when the date is a working day under this rule, false when closed. */
export function isWorkingDay(rule, date) {
  const clean = normalizeShiftRule(rule);
  const cleanDate = validShiftDate(date);
  if (!clean || !cleanDate) return false;
  if (clean.holidays.includes(cleanDate)) return false;
  return !clean.closedWeekdays.includes(weekdayOf(cleanDate));
}

/**
 * The rule in force for a due date: the one with the latest
 * effective date on or before it, or null when no rule covers it.
 * A due date before every rule's effective date has no rule, so
 * it is never shifted by a rule that did not exist yet.
 */
export function shiftRuleForDate(list, date) {
  const cleanDate = validShiftDate(date);
  if (!cleanDate) return null;
  const covering = normalizeShiftRuleList(list)
    .filter((rule) => rule.effectiveDate <= cleanDate)
    .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : a.effectiveDate > b.effectiveDate ? -1 : a.id < b.id ? -1 : 1));
  return covering[0] || null;
}

/**
 * Shift one due date under one rule. Returns
 * { originalDate, shiftedDate, shifted, ruleId, reason }.
 * Unshifted when the date is a working day, when it falls before
 * the rule's effective date, or when the rule is half-formed.
 * Returns null only when the original date itself is not real,
 * or when no working day exists within a year of stepping (for
 * example a rule that closes every weekday) — never a guessed date.
 */
export function shiftDueDate(rule, originalDate) {
  const clean = normalizeShiftRule(rule);
  const original = validShiftDate(originalDate);
  if (!clean || !original) return null;
  if (original < clean.effectiveDate) {
    return { originalDate: original, shiftedDate: original, shifted: false, ruleId: clean.id, reason: 'Before the rule effective date — not shifted.' };
  }
  if (isWorkingDay(clean, original)) {
    return { originalDate: original, shiftedDate: original, shifted: false, ruleId: clean.id, reason: 'Already a working day — not shifted.' };
  }
  const step = clean.direction === 'back' ? -1 : 1;
  let days = dateToUtcDays(original);
  for (let i = 0; i < 366; i++) {
    days += step;
    const candidate = utcDaysToDate(days);
    if (isWorkingDay(clean, candidate)) {
      return {
        originalDate: original,
        shiftedDate: candidate,
        shifted: true,
        ruleId: clean.id,
        reason: clean.direction === 'back'
          ? `Closed day — shifted back to the previous working day.`
          : `Closed day — shifted forward to the next working day.`,
      };
    }
  }
  return null;
}

/**
 * The date later logic should use for a due date: the shifted
 * date when a rule covers it, otherwise the original date itself.
 * Returns null only for an unreal original date.
 */
export function effectiveDueDate(list, originalDate) {
  const original = validShiftDate(originalDate);
  if (!original) return null;
  const rule = shiftRuleForDate(list, original);
  if (!rule) return original;
  const shifted = shiftDueDate(rule, original);
  return shifted ? shifted.shiftedDate : original;
}

/**
 * Shift a list of bills. Each bill keeps its original due date
 * beside the shifted one, and every other field — amount included —
 * passes through untouched. A bill with no usable due date is
 * carried with shiftedDate null, never dropped and never guessed.
 * Bills are never mutated; a new list is returned.
 */
export function applyShiftToBills(list, bills) {
  const rules = normalizeShiftRuleList(list);
  if (!Array.isArray(bills)) return [];
  return bills.map((bill) => {
    if (!bill || typeof bill !== 'object') return bill;
    const original = validShiftDate(bill.dueDate);
    if (!original) return { ...bill, originalDueDate: bill.dueDate ?? null, shiftedDueDate: null, shifted: false };
    const rule = shiftRuleForDate(rules, original);
    if (!rule) return { ...bill, originalDueDate: original, shiftedDueDate: original, shifted: false };
    const shifted = shiftDueDate(rule, original);
    if (!shifted) return { ...bill, originalDueDate: original, shiftedDueDate: null, shifted: false };
    return { ...bill, originalDueDate: original, shiftedDueDate: shifted.shiftedDate, shifted: shifted.shifted };
  });
}

export function shiftRuleSummaryText(list) {
  const clean = normalizeShiftRuleList(list);
  if (clean.length === 0) return 'No due-date shift rule recorded yet.';
  return clean.map((rule) => {
    const days = rule.closedWeekdays.length ? `closed weekdays ${rule.closedWeekdays.join(', ')}` : 'no weekday closure';
    const holidays = rule.holidays.length ? `, ${rule.holidays.length} holiday date(s)` : '';
    return `${rule.name || rule.id}: shift ${rule.direction} from ${rule.effectiveDate} (${days}${holidays}).`;
  }).join(' ');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function shiftRuleHtml(rule) {
  const clean = normalizeShiftRule(rule);
  if (!clean) return '';
  const days = clean.closedWeekdays.length ? `Closed weekdays: ${escapeHtml(clean.closedWeekdays.join(', '))}` : 'No weekday closure';
  const holidays = clean.holidays.length ? `Holidays: ${escapeHtml(clean.holidays.join(', '))}` : 'No holiday dates';
  return `<p><strong>${escapeHtml(clean.name || clean.id)}</strong> — shift ${escapeHtml(clean.direction)} — effective ${escapeHtml(clean.effectiveDate)} — ${days} — ${holidays}${clean.note ? ` — ${escapeHtml(clean.note)}` : ''}</p>`;
}

export function shiftedBillHtml(bill) {
  if (!bill || typeof bill !== 'object') return '';
  const original = escapeHtml(bill.originalDueDate ?? bill.dueDate ?? 'not recorded');
  const shifted = bill.shiftedDueDate ? escapeHtml(bill.shiftedDueDate) : 'not shifted';
  return `<p><strong>${escapeHtml(bill.id ?? '')}</strong> — ${escapeHtml(bill.customer ?? '')} — original due ${original} — shifted due ${shifted}</p>`;
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function shiftRuleCsv(list) {
  const clean = normalizeShiftRuleList(list);
  const header = 'id,name,direction,effective_date,closed_weekdays,holidays,note';
  const rows = clean.map((rule) => [
    rule.id, rule.name, rule.direction, rule.effectiveDate,
    rule.closedWeekdays.join(';'), rule.holidays.join(';'), rule.note,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function shiftRuleFilename() {
  return 'due-date-shift-rules.csv';
}
