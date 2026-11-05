// Plan 296 (Plan 203-350) — Vendor payment due note.
//
// A vendor payment falls due and is remembered too late, because
// the due date lives only in the vendor's bill or in someone's
// head. This module adds only the missing piece: one dated due
// note per vendor payment — the vendor, the amount in whole
// rupees, the due date, a schedule reference in plain words,
// and the status in plain words — so due notes are listed by
// due date with overdue ones visible, and a missed payment
// stops being a strained relationship.
//
// What this module is NOT, stated plainly:
//   - It is not a bill, payment, or schedule change. Recording
//     a due note never changes any bill, payment, or schedule
//     record by itself, and the payment itself goes through
//     its own existing flow; this note only reminds the owner
//     that a payment is due.
//   - It is not the recurring vendor bill schedule. That
//     schedule already exists and is neither read nor rewritten
//     here; this module only covers the due note itself, and
//     the schedule reference it carries is plain words, never
//     a link into the schedule.
//   - It is not a live record. A due note, once written, is
//     never silently edited: there is no edit function, only
//     record, find, remove, and marking a note seen or
//     settled — and marking a note seen or settled changes
//     only the note's own status, never any bill, payment,
//     or schedule record.
//   - It holds no payment function: a due note is a reminder,
//     not a payment.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     due note, and the module never reads storage, the clock,
//     or the network, and never mutates an input.
//   - A due note with no id, no vendor, no whole-rupee amount,
//     or no strict due date is refused outright. Unknown fields
//     are dropped, so a note can never grow a bill, payment,
//     or schedule field.
//   - A duplicate id is never rewritten: the first note stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validVendorPaymentDueDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

/** Whole rupees only: a number that is an integer, or a string of digits, or null. */
function wholeRupees(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * Status folds from plain spellings. A missing or unclear
 * status reads as due, because a payment nobody has looked
 * at yet is still due.
 */
export function foldVendorPaymentDueStatus(value) {
  const word = text(value).toLowerCase();
  if (['seen', 'noted', 'acknowledged', 'read'].includes(word)) return 'seen';
  if (['settled', 'paid', 'done', 'closed', 'cleared'].includes(word)) return 'settled';
  return 'due';
}

/**
 * One vendor payment due note, or null when half-formed. A
 * note needs an id, a vendor, a whole-rupee amount of at
 * least one rupee, and a strict due date. The schedule
 * reference is plain words and optional. The status folds
 * from plain spellings and defaults to due. Unknown fields
 * are dropped; the input is never mutated.
 */
export function normalizeVendorPaymentDue(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const vendor = text(raw.vendor);
  const amount = wholeRupees(raw.amount);
  const dueDate = text(raw.dueDate);
  const scheduleRef = text(raw.scheduleRef);
  if (!id) return null;
  if (!vendor) return null;
  if (amount === null || amount < 1) return null;
  if (!validVendorPaymentDueDate(dueDate)) return null;
  return {
    id,
    vendor,
    amount,
    dueDate,
    scheduleRef,
    status: foldVendorPaymentDueStatus(raw.status),
  };
}

/** Normalised due notes only; a duplicate id is never rewritten, the first stays. */
export function normalizeVendorPaymentDueList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeVendorPaymentDue(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function findVendorPaymentDue(list, id) {
  const clean = normalizeVendorPaymentDueList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) ?? null;
}

/**
 * Record a due note. Refused when half-formed or when its id
 * is already recorded — the first note for an id always stays.
 */
export function recordVendorPaymentDue(list, raw) {
  const clean = normalizeVendorPaymentDueList(list);
  const note = normalizeVendorPaymentDue(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  return [...clean, note];
}

export function removeVendorPaymentDue(list, id) {
  const clean = normalizeVendorPaymentDueList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((note) => note.id !== wanted);
}

/**
 * Mark a due note seen. Only the note's own status changes,
 * and only from due to seen — a settled note stays settled,
 * because a payment already made is not unmade by looking
 * at the note again. No bill, payment, or schedule record
 * is touched.
 */
export function markVendorPaymentDueSeen(list, id) {
  const clean = normalizeVendorPaymentDueList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.map((note) => (
    note.id === wanted && note.status === 'due' ? { ...note, status: 'seen' } : note
  ));
}

/**
 * Mark a due note settled. Only the note's own status changes
 * to settled. No bill, payment, or schedule record is touched
 * — the payment itself goes through its own existing flow.
 */
export function markVendorPaymentDueSettled(list, id) {
  const clean = normalizeVendorPaymentDueList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.map((note) => (
    note.id === wanted ? { ...note, status: 'settled' } : note
  ));
}

/** Due notes by due date, then vendor, then id, so the same list always reads the same way. */
export function vendorPaymentDuesSorted(list) {
  const clean = normalizeVendorPaymentDueList(list);
  return [...clean].sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.vendor.toLowerCase() !== b.vendor.toLowerCase()) return a.vendor.toLowerCase() < b.vendor.toLowerCase() ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** The next due note that is not settled yet, or null when none is outstanding. */
export function vendorPaymentDueNext(list) {
  const open = vendorPaymentDuesSorted(list).filter((note) => note.status !== 'settled');
  return open.length ? open[0] : null;
}

/** Due notes for one vendor, in due-date order; the vendor match is case-insensitive. */
export function vendorPaymentDuesForVendor(list, vendor) {
  const wanted = text(vendor).toLowerCase();
  if (!wanted) return [];
  return vendorPaymentDuesSorted(list).filter(
    (note) => note.vendor.toLowerCase() === wanted,
  );
}

/** Vendor names in first-seen spelling, A-Z, so the vendor view stays tidy. */
export function vendorPaymentDueVendors(list) {
  const clean = normalizeVendorPaymentDueList(list);
  const seen = new Map();
  for (const note of clean) {
    const key = note.vendor.toLowerCase();
    if (!seen.has(key)) seen.set(key, note.vendor);
  }
  return [...seen.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

/**
 * Overdue notes: due before the caller-supplied as-of
 * date and not settled yet. The as-of date is supplied by
 * the caller, never read from a clock. An invalid as-of date
 * means no note is overdue.
 */
export function vendorPaymentDuesOverdue(list, asOfDate) {
  if (!validVendorPaymentDueDate(asOfDate)) return [];
  return vendorPaymentDuesSorted(list).filter(
    (note) => note.status !== 'settled' && note.dueDate < asOfDate,
  );
}

export function vendorPaymentDueSummaryText(list, asOfDate) {
  const clean = normalizeVendorPaymentDueList(list);
  if (clean.length === 0) return 'No vendor payment due notes recorded.';
  const word = clean.length === 1 ? 'note' : 'notes';
  const due = clean.filter((note) => note.status === 'due').length;
  const seen = clean.filter((note) => note.status === 'seen').length;
  const settled = clean.filter((note) => note.status === 'settled').length;
  const overdue = vendorPaymentDuesOverdue(clean, asOfDate).length;
  const next = vendorPaymentDueNext(clean);
  const nextText = next
    ? ` Next due: ${next.vendor}, Rs ${next.amount}, due ${next.dueDate}.`
    : ' Nothing outstanding.';
  return `${clean.length} vendor payment due ${word} recorded: ${due} due, ${seen} seen, ${settled} settled, ${overdue} overdue.${nextText}`;
}

/** Plain-words text for one due note: vendor, amount, due date, schedule reference, and status. */
export function vendorPaymentDueEntryText(note) {
  const clean = normalizeVendorPaymentDue(note);
  if (!clean) return 'No vendor payment due note recorded.';
  const ref = clean.scheduleRef ? `, schedule ${clean.scheduleRef}` : '';
  return `${clean.dueDate} — ${clean.vendor}, Rs ${clean.amount}${ref}, ${clean.status}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function vendorPaymentDueEntryHtml(note) {
  const clean = normalizeVendorPaymentDue(note);
  if (!clean) return '<p>No vendor payment due note recorded.</p>';
  return `<p>${escapeHtml(vendorPaymentDueEntryText(clean))}</p>`;
}

export function vendorPaymentDueAllHtml(list) {
  const rows = vendorPaymentDuesSorted(list);
  if (!rows.length) return '<p>No vendor payment due notes recorded.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(vendorPaymentDueEntryText(note))}</li>`).join('')}</ul>`;
}

export function vendorPaymentDuesOverdueHtml(list, asOfDate) {
  const rows = vendorPaymentDuesOverdue(list, asOfDate);
  if (!rows.length) return '<p>No overdue vendor payments.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(vendorPaymentDueEntryText(note))}</li>`).join('')}</ul>`;
}

export function vendorPaymentDuesForVendorHtml(list, vendor) {
  const rows = vendorPaymentDuesForVendor(list, vendor);
  if (!rows.length) return '<p>No vendor payment due notes for this vendor.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(vendorPaymentDueEntryText(note))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function vendorPaymentDueCsv(list) {
  const rows = vendorPaymentDuesSorted(list);
  const lines = ['"id","vendor","amount","due date","schedule reference","status"'];
  for (const note of rows) {
    lines.push([
      csvCell(note.id),
      csvCell(note.vendor),
      csvCell(note.amount),
      csvCell(note.dueDate),
      csvCell(note.scheduleRef),
      csvCell(note.status),
    ].join(','));
  }
  return lines.join('\n');
}

export function vendorPaymentDueFilename() {
  return 'vendor-payment-dues.csv';
}
