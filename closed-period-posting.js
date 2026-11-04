// Plan 125 (Plan 101-202) — Closed-period posting and backdating guard.
//
// A payment or correction dated into an already-closed month used
// to quietly change that month's figures, undoing the close. This
// module is the guard in front of posting: an entry whose intended
// date falls in a closed period is held for review instead of
// posting, and it posts only with an owner approval and a dated
// note. An approved entry posts to the current period while its
// original intended date stays noted on the record, and the closed
// period's figures are never touched here — nothing in this module
// edits a closed month, a frozen figure, or any past total, and
// nothing is sent anywhere.
//
// The fences, stated plainly:
//   - A closed period is supplied by the caller as a plain record
//     (month, date closed, closed by). This module never opens
//     any other record to find out which months are closed.
//   - A held entry is listed with its intended date and the reason
//     it was held. The reason is always the closed period it fell
//     in, never an invented explanation.
//   - Posting needs all three: an owner approval id, an approver,
//     and a dated note. A held entry without them stays held.
//   - There is no edit function and no remove function. A posted
//     entry keeps its original intended date on the record, so the
//     backdating stays visible instead of being rewritten away.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Strict YYYY-MM-DD calendar date, or null (2026-02-30 is not a date). */
export function validGuardDate(value) {
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

/** Strict YYYY-MM calendar month, or null. */
export function validGuardMonth(value) {
  if (typeof value !== 'string') return null;
  const m = MONTH_RE.exec(value.trim());
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}`;
}

/** The YYYY-MM month an intended date falls in, or null. */
export function monthOfDate(value) {
  const date = validGuardDate(value);
  return date ? date.slice(0, 7) : null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Money is integer cents throughout. A plain rupees figure
// converts exactly once; a *Cents figure passes through as-is,
// so re-normalising never inflates an amount.
function moneyCents(raw, key) {
  const centsValue = raw[`${key}Cents`];
  if (Number.isInteger(centsValue)) return centsValue;
  const plain = raw[key];
  if (isFiniteNumber(plain)) return Math.round(plain * 100);
  return null;
}

export function formatGuardRs(cents) {
  if (!Number.isInteger(cents)) return 'not recorded';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const rupees = Math.floor(abs / 100);
  const paisa = abs % 100;
  return `${sign}Rs. ${rupees.toLocaleString('en-US')}.${String(paisa).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const ENTRY_KINDS = ['payment', 'correction', 'other'];

/** One closed period, or null when half-formed. Unknown fields are dropped. */
export function normalizeClosedPeriod(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const month = validGuardMonth(raw.month);
  const closedDate = validGuardDate(raw.closedDate);
  if (!month || !closedDate) return null;
  return {
    month,
    closedDate,
    closedBy: text(raw.closedBy),
  };
}

export function normalizeClosedPeriodList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const period = normalizeClosedPeriod(item);
    if (!period || seen.has(period.month)) continue;
    seen.add(period.month);
    out.push(period);
  }
  return out;
}

export function findClosedPeriod(list, month) {
  const cleanMonth = validGuardMonth(month);
  if (!cleanMonth) return null;
  return normalizeClosedPeriodList(list).find((item) => item.month === cleanMonth) || null;
}

/**
 * Record a closed period. A month already recorded is never
 * rewritten: an identical re-save leaves the list unchanged, and
 * a different record for the same month is refused.
 */
export function recordClosedPeriod(list, raw) {
  const clean = normalizeClosedPeriodList(list);
  const period = normalizeClosedPeriod(raw);
  if (!period) return clean;
  const existing = clean.find((item) => item.month === period.month);
  if (existing) return clean;
  return [...clean, period];
}

/** One held or posted entry, or null when half-formed. Unknown fields are dropped. */
export function normalizeHeldEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const kind = text(raw.kind);
  const intendedDate = validGuardDate(raw.intendedDate);
  if (!id || !customer || !ENTRY_KINDS.includes(kind) || !intendedDate) return null;
  const status = text(raw.status);
  if (status !== '' && status !== 'held' && status !== 'posted') return null;
  const hasAmount = raw.amountCents != null || raw.amount != null;
  const amountCents = hasAmount ? moneyCents(raw, 'amount') : null;
  if (hasAmount && amountCents === null) return null;
  const approvalDate = raw.approvalDate != null && raw.approvalDate !== ''
    ? validGuardDate(raw.approvalDate)
    : null;
  if (raw.approvalDate != null && raw.approvalDate !== '' && !approvalDate) return null;
  const postedToMonth = raw.postedToMonth != null && raw.postedToMonth !== ''
    ? validGuardMonth(raw.postedToMonth)
    : null;
  if (raw.postedToMonth != null && raw.postedToMonth !== '' && !postedToMonth) return null;
  return {
    id,
    customer,
    kind,
    intendedDate,
    intendedMonth: intendedDate.slice(0, 7),
    amountCents,
    reason: text(raw.reason),
    status: status === '' ? 'held' : status,
    postedToMonth,
    originalDateNoted: text(raw.originalDateNoted) || intendedDate,
    approvalId: text(raw.approvalId),
    approver: text(raw.approver),
    approvalDate,
    approvalNote: text(raw.approvalNote),
  };
}

export function normalizeHeldEntryList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const entry = normalizeHeldEntry(item);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findHeldEntry(list, id) {
  const cleanId = text(id);
  if (!cleanId) return null;
  return normalizeHeldEntryList(list).find((item) => item.id === cleanId) || null;
}

/**
 * The guard check itself. Returns { blocked, closedMonth }: blocked
 * is true exactly when the intended date falls in a closed period.
 * It answers only — it holds nothing and changes nothing.
 */
export function checkGuardPosting(closedPeriods, intendedDate) {
  const month = monthOfDate(intendedDate);
  if (!month) return { blocked: false, closedMonth: null };
  const period = findClosedPeriod(closedPeriods, month);
  return { blocked: Boolean(period), closedMonth: period ? period.month : null };
}

/**
 * Hold an entry for review. Only an entry whose intended date
 * falls in a closed period can be held — anything else is refused
 * with the list unchanged, because there is nothing to hold it
 * for. The reason names the closed period, never an invention.
 * A duplicate id is never rewritten.
 */
export function holdEntry(list, closedPeriods, raw) {
  const clean = normalizeHeldEntryList(list);
  const entry = normalizeHeldEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  const check = checkGuardPosting(closedPeriods, entry.intendedDate);
  if (!check.blocked) return clean;
  return [...clean, {
    ...entry,
    status: 'held',
    reason: `Intended date falls in closed period ${check.closedMonth}.`,
    postedToMonth: null,
    approvalId: '',
    approver: '',
    approvalDate: null,
    approvalNote: '',
    originalDateNoted: entry.intendedDate,
  }];
}

/**
 * Approve a held entry so it posts to the current period. Needs an
 * owner approval id, an approver, a real approval date, and a dated
 * note, plus a post-to month that is itself open. The original
 * intended date stays noted on the record, and the closed period
 * is untouched. Only a held entry can be approved; a posted entry
 * can never be approved again, and there is no edit or remove.
 */
export function approveHeldEntry(list, closedPeriods, id, approval) {
  const clean = normalizeHeldEntryList(list);
  const cleanId = text(id);
  if (!cleanId || !approval || typeof approval !== 'object') return clean;
  const target = clean.find((item) => item.id === cleanId);
  if (!target || target.status !== 'held') return clean;
  const approvalId = text(approval.approvalId);
  const approver = text(approval.approver);
  const approvalDate = validGuardDate(approval.approvalDate);
  const approvalNote = text(approval.approvalNote);
  const postedToMonth = validGuardMonth(approval.postedToMonth);
  if (!approvalId || !approver || !approvalDate || !approvalNote || !postedToMonth) return clean;
  if (findClosedPeriod(closedPeriods, postedToMonth)) return clean;
  return clean.map((item) => item.id === cleanId ? {
    ...item,
    status: 'posted',
    postedToMonth,
    approvalId,
    approver,
    approvalDate,
    approvalNote,
    originalDateNoted: item.intendedDate,
  } : item);
}

/** Held entries only, oldest intended date first. */
export function heldEntries(list) {
  return normalizeHeldEntryList(list)
    .filter((item) => item.status === 'held')
    .sort((a, b) => a.intendedDate < b.intendedDate ? -1 : a.intendedDate > b.intendedDate ? 1 : a.id < b.id ? -1 : 1);
}

/** Posted entries only, oldest intended date first. */
export function postedEntries(list) {
  return normalizeHeldEntryList(list)
    .filter((item) => item.status === 'posted')
    .sort((a, b) => a.intendedDate < b.intendedDate ? -1 : a.intendedDate > b.intendedDate ? 1 : a.id < b.id ? -1 : 1);
}

export function heldEntrySummaryText(list) {
  const clean = normalizeHeldEntryList(list);
  const held = clean.filter((item) => item.status === 'held').length;
  const posted = clean.filter((item) => item.status === 'posted').length;
  return `${held} held for review, ${posted} approved and posted to the current period.`;
}

export function heldEntryHtml(item) {
  const entry = normalizeHeldEntry(item);
  if (!entry) return '';
  const amount = entry.amountCents === null ? 'amount not recorded' : formatGuardRs(entry.amountCents);
  const posted = entry.status === 'posted'
    ? `Posted to ${escapeHtml(entry.postedToMonth)}; original date noted: ${escapeHtml(entry.originalDateNoted)}; approval ${escapeHtml(entry.approvalId)} by ${escapeHtml(entry.approver)} on ${escapeHtml(entry.approvalDate)} — ${escapeHtml(entry.approvalNote)}`
    : 'Still held — not posted anywhere.';
  return `<p><strong>${escapeHtml(entry.id)}</strong> — ${escapeHtml(entry.customer)} — ${escapeHtml(entry.kind)} — intended ${escapeHtml(entry.intendedDate)} (${escapeHtml(entry.intendedMonth)}) — ${escapeHtml(amount)} — ${escapeHtml(entry.status)} — ${escapeHtml(entry.reason)} ${escapeHtml(posted)}</p>`;
}

export function closedPeriodHtml(period) {
  const clean = normalizeClosedPeriod(period);
  if (!clean) return '';
  return `<p><strong>${escapeHtml(clean.month)}</strong> — closed ${escapeHtml(clean.closedDate)}${clean.closedBy ? ` by ${escapeHtml(clean.closedBy)}` : ''}</p>`;
}

export function heldEntryCsv(list) {
  const clean = normalizeHeldEntryList(list);
  const header = 'id,customer,kind,intended_date,intended_month,amount_cents,status,reason,posted_to_month,original_date_noted,approval_id,approver,approval_date,approval_note';
  const rows = clean.map((item) => [
    item.id, item.customer, item.kind, item.intendedDate, item.intendedMonth,
    item.amountCents === null ? '' : item.amountCents, item.status, item.reason,
    item.postedToMonth || '', item.originalDateNoted, item.approvalId,
    item.approver, item.approvalDate || '', item.approvalNote,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function heldEntryFilename() {
  return 'closed-period-posting.csv';
}
