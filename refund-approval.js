// Plan 222 (Plan 203-350) — Refund approval note (pre-refund sign-off).
//
// The refund record (Plan 116) shows a refund after it happens, but
// a refund above the operator tier had no separate pre-approval
// showing it was signed off before the money went back. This module
// is that missing piece, and nothing more.
//
// What this module is NOT:
//   - It posts no refund and it does not replace the refund record
//     itself. A refund reference here is text only: the Plan 116
//     refund record is never opened, read, or rewritten, and no
//     refund, payment, or bill changes because an approval was
//     recorded. Recording an approval never moves money.
//   - It grants no discount and no waiver. Plan 110 covers approval
//     limits; no Plan 110 tier, discount, or waiver record is read
//     or rewritten here. The operator-tier limit used to flag a
//     refund without prior approval is supplied by the caller at
//     review time, so this module invents no threshold of its own.
//   - It is not a permission system. Recording an approval never
//     grants anyone the right to do anything; it only writes down
//     who approved a refund, for how much, and on which date.
//
// One record per refund approval:
//   id, refundRef, approver, date, amountCents (the refund amount
//   being approved). A refund above the operator tier without a
//   prior approval is flagged: refundApprovalStatus() is
//   'missing-approval' when the refund amount is strictly greater
//   than the operator-tier limit supplied at review time and no
//   approval for that refund reference is dated on or before the
//   refund date. A refund at or below the tier needs no approval
//   ('not-required'); a refund with no usable amount, or with no
//   usable tier limit supplied, is 'unknown' — the flag must come
//   from recorded figures, never from a guess. Approvals are
//   reviewable by period (approvalsForPeriod, inclusive at both
//   ends).
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Money is integer cents throughout; a plain rupees figure
// converts to cents exactly once on the way in. Dates are strict
// civil dates checked against a days-in-month table, so no clock
// and no timezone can move a date.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  return `${sign}PKR ${Math.abs(cents / 100).toLocaleString('en-US')}`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validRefundApprovalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= limit;
}

function moneyToCents(centsValue, rupeesValue) {
  if (Number.isInteger(centsValue)) return centsValue;
  if (typeof rupeesValue === 'number' && Number.isFinite(rupeesValue)) {
    return Math.round(rupeesValue * 100);
  }
  if (typeof centsValue === 'number' && Number.isFinite(centsValue)) {
    return Math.round(centsValue * 100);
  }
  return null;
}

/**
 * Normalize one refund approval record. Returns null when
 * half-formed: no id, no refund reference, no approver, no strict
 * date, or no positive amount being approved. Unknown fields are
 * dropped.
 */
export function normalizeRefundApproval(input) {
  if (!input || typeof input !== 'object') return null;
  const id = cleanText(input.id);
  const refundRef = cleanText(input.refundRef);
  const approver = cleanText(input.approver);
  const date = cleanText(input.date);
  if (!id || !refundRef || !approver) return null;
  if (!validRefundApprovalDate(date)) return null;
  const amountCents = moneyToCents(input.amountCents, input.amount);
  if (amountCents === null || amountCents <= 0) return null;
  return { id, refundRef, approver, date, amountCents };
}

export function normalizeRefundApprovalList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const clean = normalizeRefundApproval(item);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

/**
 * Record an approval. Returns null when half-formed or when the id
 * is already recorded — a recorded approval is never overwritten.
 * Otherwise returns a new list with the approval appended.
 */
export function recordRefundApproval(list, input) {
  const clean = normalizeRefundApproval(input);
  if (!clean) return null;
  const base = normalizeRefundApprovalList(list);
  if (base.some((item) => item.id === clean.id)) return null;
  return [...base, clean];
}

export function removeRefundApproval(list, id) {
  const cleanId = cleanText(id);
  if (!cleanId) return normalizeRefundApprovalList(list);
  return normalizeRefundApprovalList(list).filter((item) => item.id !== cleanId);
}

export function findRefundApproval(list, id) {
  const cleanId = cleanText(id);
  if (!cleanId) return null;
  return normalizeRefundApprovalList(list).find((item) => item.id === cleanId) ?? null;
}

/** Approvals for one refund reference, in recorded order. */
export function approvalsForRefund(list, refundRef) {
  const ref = cleanText(refundRef);
  if (!ref) return [];
  return normalizeRefundApprovalList(list).filter((item) => item.refundRef === ref);
}

/** All approvals, by date, then refund reference, then id. */
export function approvalsSorted(list) {
  return normalizeRefundApprovalList(list).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.refundRef !== b.refundRef) return a.refundRef < b.refundRef ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Approvals inside a period, inclusive at both ends. Either bound
 * may be empty (open-ended); an empty or reversed range yields [].
 */
export function approvalsForPeriod(list, { from = '', to = '' } = {}) {
  const fromDate = cleanText(from);
  const toDate = cleanText(to);
  if (fromDate && !validRefundApprovalDate(fromDate)) return [];
  if (toDate && !validRefundApprovalDate(toDate)) return [];
  if (fromDate && toDate && fromDate > toDate) return [];
  return approvalsSorted(list).filter((item) => {
    if (fromDate && item.date < fromDate) return false;
    if (toDate && item.date > toDate) return false;
    return true;
  });
}

/**
 * Normalize one refund fixture supplied by the caller for a tier
 * check (the refund record itself is never opened here). Returns
 * null when half-formed: no refund reference or no positive
 * amount. A date, when given, must be a strict date; a missing
 * date is kept as an empty string.
 */
export function normalizeRefundForCheck(input) {
  if (!input || typeof input !== 'object') return null;
  const refundRef = cleanText(input.refundRef);
  if (!refundRef) return null;
  const amountCents = moneyToCents(input.amountCents, input.amount);
  if (amountCents === null || amountCents <= 0) return null;
  const date = cleanText(input.date);
  if (date && !validRefundApprovalDate(date)) return null;
  return { refundRef, amountCents, date };
}

/**
 * True when the refund amount is strictly greater than the
 * operator-tier limit supplied at review time. An amount equal to
 * the limit needs no approval, and a missing or invalid limit
 * never requires one.
 */
export function refundNeedsApproval(refund, operatorTierLimitCents) {
  const clean = normalizeRefundForCheck(refund);
  if (!clean) return false;
  if (!Number.isInteger(operatorTierLimitCents) || operatorTierLimitCents < 0) return false;
  return clean.amountCents > operatorTierLimitCents;
}

/**
 * True when an approval for the same refund reference is dated on
 * or before the refund date. When the refund carries no date, any
 * approval for that reference counts as prior.
 */
export function refundHasPriorApproval(refund, approvals) {
  const clean = normalizeRefundForCheck(refund);
  if (!clean) return false;
  return approvalsForRefund(approvals, clean.refundRef).some(
    (approval) => !clean.date || approval.date <= clean.date,
  );
}

/**
 * One of 'not-required', 'approved', 'missing-approval', or
 * 'unknown'. 'unknown' covers a half-formed refund fixture and a
 * missing or invalid tier limit: without a recorded amount and a
 * real limit there is nothing honest to flag.
 */
export function refundApprovalStatus(refund, approvals, operatorTierLimitCents) {
  const clean = normalizeRefundForCheck(refund);
  if (!clean) return 'unknown';
  if (!Number.isInteger(operatorTierLimitCents) || operatorTierLimitCents < 0) return 'unknown';
  if (clean.amountCents <= operatorTierLimitCents) return 'not-required';
  return refundHasPriorApproval(clean, approvals) ? 'approved' : 'missing-approval';
}

/** Refunds (caller-supplied fixtures) flagged as missing approval. */
export function refundsMissingApproval(refunds, approvals, operatorTierLimitCents) {
  if (!Array.isArray(refunds)) return [];
  return refunds
    .map((refund) => normalizeRefundForCheck(refund))
    .filter(
      (clean) =>
        clean && refundApprovalStatus(clean, approvals, operatorTierLimitCents) === 'missing-approval',
    );
}

/** One-line plain text for one approval. */
export function refundApprovalText(approval) {
  const clean = normalizeRefundApproval(approval);
  if (!clean) return '';
  return `Refund ${clean.refundRef} approved by ${clean.approver} on ${clean.date} for ${formatMoney(clean.amountCents)}.`;
}

/** One-line escaped HTML for one approval. */
export function refundApprovalHtml(approval) {
  const clean = normalizeRefundApproval(approval);
  if (!clean) return '';
  return `<p>Refund ${escapeHtml(clean.refundRef)} approved by ${escapeHtml(clean.approver)} on ${escapeHtml(clean.date)} for ${escapeHtml(formatMoney(clean.amountCents))}.</p>`;
}

export function refundApprovalAllHtml(list) {
  const sorted = approvalsSorted(list);
  if (!sorted.length) return '<p>No refund approvals recorded.</p>';
  return sorted.map((item) => refundApprovalHtml(item)).join('');
}

/** Summary: total approvals, and how many refunds are flagged. */
export function refundApprovalSummaryText(list, refunds, operatorTierLimitCents) {
  const approvals = normalizeRefundApprovalList(list);
  const flagged = refundsMissingApproval(refunds ?? [], approvals, operatorTierLimitCents);
  return `${approvals.length} refund approval(s) recorded. ${flagged.length} refund(s) flagged as missing prior approval.`;
}

export function refundApprovalCsv(list) {
  const rows = [['id', 'refundRef', 'approver', 'date', 'amountCents']];
  for (const item of approvalsSorted(list)) {
    rows.push([item.id, item.refundRef, item.approver, item.date, String(item.amountCents)]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function refundApprovalFilename() {
  return 'refund-approvals.csv';
}
