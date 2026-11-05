// Plan 226 (Plan 203-350) — Overdue account watchlist.
//
// Overdue accounts are already chased through the escalation ladder
// (Plan 12) and the at-risk signals list (Plan 56), but neither one
// is a single operator-curated list of the accounts currently being
// watched, with a review date for each. The dashboard health
// "watchlist" category is also not this: it is a computed standing
// bucket, not a list the operator chooses. This module adds only the
// missing curated piece.
//
// One watchlist entry per overdue account: the customer, the amount
// overdue, the reason for watching, the review date, and the owner
// (the operator watching it). Entries are added and removed by the
// operator only — nothing here ever adds an account by itself, and
// the list never suspends or disconnects anyone by itself. Adding or
// removing an entry never changes any bill, payment, or customer
// status by itself.
//
// The fences, stated plainly:
//   - The Plan 12 escalation ladder, the Plan 56 at-risk signals
//     list, the dashboard health watchlist category, and any billing,
//     payment, or customer module are neither read nor rewritten
//     here. Customers, amounts, reasons, dates, and owners arrive as
//     caller-supplied values only.
//   - One active entry per customer: a second active entry for the
//     same customer is refused, never used to overwrite the first.
//     A customer removed from the watchlist may be watched again
//     later with a fresh entry, because removal moves the old entry
//     to dated history instead of erasing it.
//   - Removing an entry keeps it in a dated history: the entry stays
//     in the list with its removed date, and only the active view
//     hides it. History is never rewritten or deleted by this module
//     except through the remove function itself.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validWatchlistDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function amountToCents(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function centsField(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

// A raw entry is usable only when it names its customer, carries a
// positive amount overdue, and carries a strict review date. A missing
// reason or owner renders as a plain fallback, never as an invented
// reason or owner. Unknown fields are dropped, never kept. Amounts
// are integer cents: an *Cents field passes through as-is, a plain
// amount converts rupees once, so a re-read never inflates a
// hundredfold. A removedDate, when present, must itself be a strict
// date, or the whole entry is unusable.
function normalizeOverdueWatchlistEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id);
  const customer = text(value.customer);
  const reviewDate = text(value.reviewDate);
  if (!id || !customer || !validWatchlistDate(reviewDate)) return null;
  let amountOverdueCents = null;
  if (value.amountOverdueCents != null && value.amountOverdueCents !== '') {
    amountOverdueCents = centsField(value.amountOverdueCents);
  } else {
    amountOverdueCents = amountToCents(value.amountOverdue);
  }
  if (amountOverdueCents === null) return null;
  let removedDate = null;
  if (value.removedDate != null && value.removedDate !== '') {
    removedDate = text(value.removedDate);
    if (!validWatchlistDate(removedDate)) return null;
  }
  const entry = {
    id,
    customer,
    amountOverdueCents,
    reason: text(value.reason) || 'No reason noted.',
    reviewDate,
    owner: text(value.owner) || 'No owner noted.',
  };
  if (removedDate) entry.removedDate = removedDate;
  return entry;
}

export function normalizeOverdueWatchlistList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const entry = normalizeOverdueWatchlistEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function overdueWatchlistSorted(list) {
  const entries = normalizeOverdueWatchlistList(list);
  entries.sort((a, b) => {
    if (a.reviewDate !== b.reviewDate) return a.reviewDate < b.reviewDate ? -1 : 1;
    const ca = a.customer.toLowerCase();
    const cb = b.customer.toLowerCase();
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return entries;
}

// The active watchlist: entries not yet removed, sorted by review date.
export function watchlistActive(list) {
  return overdueWatchlistSorted(list).filter((entry) => !entry.removedDate);
}

// The dated history: removed entries, newest removal first.
export function watchlistHistory(list) {
  const removed = normalizeOverdueWatchlistList(list).filter((entry) => entry.removedDate);
  removed.sort((a, b) => {
    if (a.removedDate !== b.removedDate) return a.removedDate < b.removedDate ? 1 : -1;
    const ca = a.customer.toLowerCase();
    const cb = b.customer.toLowerCase();
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return removed;
}

export function findOverdueWatchlistEntry(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeOverdueWatchlistList(list).find((entry) => entry.id === wanted) || null;
}

// Record a new watch entry. Returns the new list, or null when the
// entry is half-formed, its id is already used, or its customer
// already has an active entry. The input list is never mutated.
export function recordOverdueWatchlistEntry(list, entry) {
  const clean = normalizeOverdueWatchlistList(list);
  const next = normalizeOverdueWatchlistEntry(entry);
  if (!next || next.removedDate) return null;
  if (clean.some((row) => row.id === next.id)) return null;
  if (clean.some((row) => !row.removedDate && row.customer.toLowerCase() === next.customer.toLowerCase())) return null;
  return [...clean, next];
}

// Remove an entry from the active watchlist, keeping it in dated
// history. Returns the new list, or the unchanged list when the id
// is unknown, already removed, or the removed date is not strict.
// The input list is never mutated.
export function removeOverdueWatchlistEntry(list, id, removedDate) {
  const clean = normalizeOverdueWatchlistList(list);
  const wanted = text(id);
  const date = text(removedDate);
  if (!wanted || !validWatchlistDate(date)) return clean;
  const target = clean.find((row) => row.id === wanted && !row.removedDate);
  if (!target) return clean;
  return clean.map((row) => (row.id === wanted ? { ...row, removedDate: date } : row));
}

// Active entries whose review date has passed as of the caller-given
// date. A review due today is not overdue; only a review date
// strictly before the as-of date is flagged. String comparison is
// safe here because both dates are strict YYYY-MM-DD.
export function watchlistOverdueReviews(list, asOf) {
  const date = text(asOf);
  if (!validWatchlistDate(date)) return [];
  return watchlistActive(list).filter((entry) => entry.reviewDate < date);
}

export function watchlistForCustomer(list, query) {
  const q = text(query).toLowerCase();
  if (!q) return watchlistActive(list);
  return watchlistActive(list).filter((entry) => entry.customer.toLowerCase().includes(q));
}

export function watchlistForOwner(list, query) {
  const q = text(query).toLowerCase();
  if (!q) return watchlistActive(list);
  return watchlistActive(list).filter((entry) => entry.owner.toLowerCase().includes(q));
}

export function watchlistTotalOverdueCents(list) {
  return watchlistActive(list).reduce((sum, entry) => sum + entry.amountOverdueCents, 0);
}

function rupees(cents) {
  return `Rs. ${Math.round(cents / 100).toLocaleString('en-US')}`;
}

export function overdueWatchlistEntryText(entry, asOf) {
  const clean = normalizeOverdueWatchlistEntry(entry);
  if (!clean) return '';
  const overdue = asOf && validWatchlistDate(text(asOf)) && !clean.removedDate && clean.reviewDate < text(asOf);
  let line = `${clean.customer} — ${rupees(clean.amountOverdueCents)} overdue — review ${clean.reviewDate} — ${clean.reason} — owner ${clean.owner}.`;
  if (overdue) line += ' REVIEW OVERDUE.';
  if (clean.removedDate) line += ` Removed ${clean.removedDate}.`;
  return line;
}

export function overdueWatchlistSummaryText(list, asOf) {
  const active = watchlistActive(list);
  const overdue = watchlistOverdueReviews(list, asOf);
  const history = watchlistHistory(list);
  return `${active.length} account(s) on the watchlist, ${rupees(watchlistTotalOverdueCents(list))} overdue in total, ${overdue.length} review(s) overdue, ${history.length} removed entr(ies) kept in history.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function overdueWatchlistEntryHtml(entry, asOf) {
  const clean = normalizeOverdueWatchlistEntry(entry);
  if (!clean) return '';
  return `<p>${escapeHtml(overdueWatchlistEntryText(clean, asOf))}</p>`;
}

export function overdueWatchlistAllHtml(list, asOf) {
  const active = watchlistActive(list);
  if (!active.length) return '<p>No accounts on the watchlist.</p>';
  return active.map((entry) => overdueWatchlistEntryHtml(entry, asOf)).join('');
}

function csvCell(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function overdueWatchlistCsv(list) {
  const rows = [['id', 'customer', 'amountOverdueCents', 'reason', 'reviewDate', 'owner', 'removedDate']];
  for (const entry of normalizeOverdueWatchlistList(list)) {
    rows.push([entry.id, entry.customer, entry.amountOverdueCents, entry.reason, entry.reviewDate, entry.owner, entry.removedDate || '']);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function overdueWatchlistFilename() {
  return 'overdue-watchlist.csv';
}
