// Plan 38 — One-time bill extension (operator-recorded grace, with reason).
//
// A customer who asks for a few extra days gets an informal yes that
// lives in no record, so the next operator treats them as simply
// overdue and the chase restarts unfairly. This module is the record
// for that yes — and nothing more:
//
//   - one extension record per bill: extended due date, reason, and
//     who granted it, for one bill at a time;
//   - the extension changes no amount, creates no Waada promise
//     (Plan O tracks promises separately), and never alters any
//     other bill;
//   - the reminder ladder (Plan 12) pauses for that bill until the
//     extended date passes: while paused the bill is not on the
//     ladder at all, and once the extended date has passed the bill
//     returns to the ladder with the extended date as its due date
//     (days overdue counted from the extended date, not the
//     original — the grace shifts the date, it does not erase it);
//   - an extension cannot be granted twice on the same bill without
//     an operator note explaining why: a second grant with no note
//     is refused and the stored list is unchanged; a second grant
//     with a note is recorded alongside the first, and the latest
//     grant is the active one.
//
// What this module never holds: no amount field, no payment-ledger
// field, no Waada field, no service-state field. Granting an
// extension writes one extension record and nothing else; the bill
// itself is never rewritten — the wiring only ever reads the bill's
// stored due date as the original.
//
// Pure and import-free: every helper takes plain data and returns
// new data. The caller owns storage (the app keeps extensions in
// their own localStorage store); nothing here touches localStorage,
// a bill, a payment, or a Waada record. A bill is identified by
// customer id plus bill month (the app's bill key); a bill id is
// accepted as a fallback when no month is supplied.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** True only for a real calendar date (2026-02-30 is rejected, never guessed). */
export function isValidBillExtensionDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Whole days between two valid dates (later − earlier); null when either is invalid. */
export function billExtensionDaysBetween(earlier, later) {
  if (!isValidBillExtensionDate(earlier) || !isValidBillExtensionDate(later)) return null;
  const a = new Date(`${earlier}T00:00:00Z`).getTime();
  const b = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * The stable key for one bill: customer id plus bill month, or plus
 * bill id when no month is supplied. An empty key means the record
 * cannot identify a bill and is rejected by normalisation.
 */
export function billExtensionKey(ref) {
  const customerId = text(ref?.customerId);
  const month = text(ref?.billMonth);
  const billId = text(ref?.billId);
  if (!customerId) return '';
  if (month) return `${customerId}|${month}`;
  if (billId) return `${customerId}|${billId}`;
  return '';
}

/**
 * One normalised extension record, or null when it cannot be one:
 * a missing customer id, a bill with neither month nor id, an
 * invalid original or extended date, an extended date that is not
 * later than the original (grace only ever moves a date forward),
 * or a blank reason is rejected outright, never stored half-formed.
 * Who granted it and when are optional: missing values stay null,
 * never an invented name or date. A second-grant note, when
 * supplied, is kept verbatim.
 */
export function normalizeBillExtension(value) {
  if (!value || typeof value !== 'object') return null;
  const customerId = text(value.customerId);
  const billMonth = text(value.billMonth);
  const billId = text(value.billId);
  if (!customerId || (!billMonth && !billId)) return null;
  const originalDueDate = isValidBillExtensionDate(value.originalDueDate)
    ? value.originalDueDate
    : null;
  const extendedDueDate = isValidBillExtensionDate(value.extendedDueDate)
    ? value.extendedDueDate
    : null;
  if (!originalDueDate || !extendedDueDate) return null;
  if (billExtensionDaysBetween(originalDueDate, extendedDueDate) <= 0) return null;
  const reason = text(value.reason);
  if (!reason) return null;
  return {
    customerId,
    billMonth: billMonth || null,
    billId: billId || null,
    originalDueDate,
    extendedDueDate,
    reason,
    grantedBy: text(value.grantedBy) || null,
    grantedAt: text(value.grantedAt) || null,
    secondNote: text(value.secondNote) || null,
  };
}

/** Normalised copies of a stored list; invalid entries are dropped, inputs never mutated. */
export function normalizeBillExtensions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const normalized = normalizeBillExtension(entry);
    if (normalized) out.push(normalized);
  }
  return out;
}

/** All extensions granted for one bill, in grant order. */
export function extensionsForBill(extensions, ref) {
  const key = billExtensionKey(ref);
  if (!key) return [];
  return normalizeBillExtensions(extensions).filter(
    (entry) => billExtensionKey(entry) === key,
  );
}

/** The active extension for one bill: the latest grant, or null when none exists. */
export function activeBillExtension(extensions, ref) {
  const matches = extensionsForBill(extensions, ref);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

/**
 * Grant an extension. Returns { extensions, granted, refusal }:
 * - an invalid record is refused ('invalid') and the list is unchanged;
 * - a second grant on the same bill without an operator note is
 *   refused ('second-extension-needs-note') and the list is unchanged;
 * - a first grant, or a second grant carrying a note (either in the
 *   record's secondNote or in options.secondExtensionNote), is
 *   appended and granted.
 * The returned list is always a new array; the input is never mutated.
 */
export function grantBillExtension(extensions, record, options = {}) {
  const list = normalizeBillExtensions(extensions);
  const normalized = normalizeBillExtension(record);
  if (!normalized) return { extensions: list, granted: false, refusal: 'invalid' };
  const note = text(options?.secondExtensionNote) || normalized.secondNote;
  const existing = list.filter(
    (entry) => billExtensionKey(entry) === billExtensionKey(normalized),
  );
  if (existing.length > 0 && !note) {
    return { extensions: list, granted: false, refusal: 'second-extension-needs-note' };
  }
  if (note) normalized.secondNote = note;
  return { extensions: [...list, normalized], granted: true, refusal: null };
}

/**
 * The ladder position of one bill under its active extension:
 * - no extension: { paused: false, dueDate: the bill's own due date };
 * - extension active and today on or before the extended date: the
 *   bill is paused — { paused: true, dueDate: extended date };
 * - extended date already passed: the bill is back on the ladder
 *   with the extended date as its due date.
 * An invalid today date pauses nothing and changes nothing.
 */
export function ladderPositionForBill(bill, extensions, today) {
  const ownDueDate = text(bill?.dueDate) || null;
  const extension = activeBillExtension(extensions, bill);
  if (!extension) return { paused: false, dueDate: ownDueDate, extension: null };
  if (!isValidBillExtensionDate(today)) {
    return { paused: false, dueDate: ownDueDate, extension };
  }
  if (today <= extension.extendedDueDate) {
    return { paused: true, dueDate: extension.extendedDueDate, extension };
  }
  return { paused: false, dueDate: extension.extendedDueDate, extension };
}

/** True only while the ladder must pause for this bill (extension active, extended date not yet passed). */
export function isLadderPausedForBill(bill, extensions, today) {
  return ladderPositionForBill(bill, extensions, today).paused;
}

/**
 * Apply extensions to a ladder bill list (Plan 12 input shape:
 * { customerId, billMonth, dueDate, ... }):
 * - paused bills are removed from `bills` and listed in `paused`;
 * - bills past their extended date keep their row, with dueDate
 *   replaced by the extended date and the original date preserved
 *   as originalDueDate;
 * - bills with no extension pass through unchanged.
 * Returns { bills, paused, counts }; inputs are never mutated.
 * An invalid today date returns the bills unchanged with nothing paused.
 */
export function applyExtensionsToBills(bills, extensions, today) {
  const counts = { total: 0, paused: 0, extended: 0, unaffected: 0 };
  const list = Array.isArray(bills) ? bills : [];
  const out = [];
  const paused = [];
  const validToday = isValidBillExtensionDate(today);
  for (const bill of list) {
    counts.total += 1;
    if (!validToday) {
      out.push({ ...bill });
      counts.unaffected += 1;
      continue;
    }
    const position = ladderPositionForBill(bill, extensions, today);
    if (!position.extension) {
      out.push({ ...bill });
      counts.unaffected += 1;
    } else if (position.paused) {
      paused.push({ ...bill, extension: position.extension });
      counts.paused += 1;
    } else {
      out.push({
        ...bill,
        dueDate: position.dueDate,
        originalDueDate: position.extension.originalDueDate,
        billExtension: position.extension,
      });
      counts.extended += 1;
    }
  }
  return { bills: out, paused, counts };
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(value) {
  if (!isValidBillExtensionDate(value)) return '';
  const [y, m, d] = value.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function billExtensionSummaryText(extensions, today) {
  const list = normalizeBillExtensions(extensions);
  if (list.length === 0) return 'No bill extensions recorded.';
  const paused = isValidBillExtensionDate(today)
    ? list.filter((entry) => today <= entry.extendedDueDate).length
    : 0;
  const bills = new Set(list.map((entry) => billExtensionKey(entry))).size;
  return `${list.length} extension${list.length === 1 ? '' : 's'} on ${bills} bill${bills === 1 ? '' : 's'}${paused > 0 ? ` — ${paused} currently pausing the reminder ladder` : ''}.`;
}

export function billExtensionFilename(today) {
  const day = isValidBillExtensionDate(today) ? today : 'unknown-date';
  return `bill-extensions-${day}.csv`;
}

export function billExtensionHtml(extensions, { names = {}, today = null } = {}) {
  const list = normalizeBillExtensions(extensions);
  if (list.length === 0) return '<p class="empty-state">No bill extensions recorded.</p>';
  const rows = list.map((entry) => {
    const name = names[entry.customerId] || entry.customerId;
    const status = isValidBillExtensionDate(today) && today <= entry.extendedDueDate
      ? 'Ladder paused until extended date'
      : 'Extended date passed — back on the ladder';
    return `<tr><td><strong>${escapeHtml(name)}</strong><br><small>${escapeHtml(entry.billMonth || entry.billId || '')}</small></td><td>${escapeHtml(formatDate(entry.originalDueDate))}</td><td><strong>${escapeHtml(formatDate(entry.extendedDueDate))}</strong></td><td>${escapeHtml(entry.reason)}${entry.secondNote ? `<br><small>Second grant note: ${escapeHtml(entry.secondNote)}</small>` : ''}</td><td>${escapeHtml(entry.grantedBy || 'Not recorded')}${entry.grantedAt ? `<br><small>${escapeHtml(entry.grantedAt)}</small>` : ''}</td><td><small>${escapeHtml(status)}</small></td></tr>`;
  }).join('');
  return `<table class="bill-extension-table"><thead><tr><th>Customer / bill</th><th>Original due date</th><th>Extended due date</th><th>Reason</th><th>Granted by</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function billExtensionCsv(extensions, { names = {} } = {}) {
  const lines = ['Customer, Customer name, Bill month, Bill id, Original due date, Extended due date, Reason, Granted by, Granted at, Second grant note'];
  for (const entry of normalizeBillExtensions(extensions)) {
    lines.push([
      csvCell(entry.customerId),
      csvCell(names[entry.customerId] || ''),
      csvCell(entry.billMonth || ''),
      csvCell(entry.billId || ''),
      csvCell(entry.originalDueDate),
      csvCell(entry.extendedDueDate),
      csvCell(entry.reason),
      csvCell(entry.grantedBy || ''),
      csvCell(entry.grantedAt || ''),
      csvCell(entry.secondNote || ''),
    ].join(','));
  }
  return lines.join('\n');
}
