// Plan 211 (Plan 203-350) — Bill correction approval trail.
//
// Plan 109's correction workflow preserves the original bill and the
// corrected bill, and records one approver on the correction itself.
// What it does not record separately is the approval trail: who
// approved a correction, and whether a large correction had a second
// approver. This module is that missing piece, and nothing more.
//
// What this module is NOT:
//   - It does not itself correct any bill. A correction reference
//     here is text only: the Plan 109 correction record is never
//     opened, read, or rewritten, and no bill, payment, or
//     correction changes because an approval was recorded.
//   - It grants no discount and no waiver. Plan 110 covers discount
//     tiers; no Plan 110 tier, discount, or waiver record is read or
//     rewritten here. The operator-tier limit used to flag a missing
//     second approver is supplied by the caller at review time, so
//     this module invents no threshold of its own.
//   - It is not a permission system. Recording an approval never
//     grants anyone the right to do anything; it only writes down
//     who approved, and whether a second approver was present.
//
// One record per bill correction approval:
//   id, correctionRef, approver, secondApprover (empty when none),
//   date, amountCents (the correction amount being approved, when
//   known; null when the operator records an approval without an
//   amount, in which case no tier flag can apply).
//
// A correction above the operator tier without a second approver is
// flagged: requiresSecondApprover() is true when the recorded amount
// is strictly greater than the operator-tier limit supplied at
// review time. The approval list is reviewable by period
// (approvalsForPeriod, inclusive at both ends).
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Money is integer cents throughout; a plain rupees figure
// converts to cents exactly once on the way in. Dates are strict
// civil dates checked against a days-in-month table, so no clock and
// no timezone can move a date.

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
  if (cents === null || cents === undefined) return 'Amount not recorded';
  const sign = cents < 0 ? '-' : '';
  return `${sign}PKR ${Math.abs(cents / 100).toLocaleString('en-US')}`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validApprovalDate(value) {
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
 * Normalize one approval record. Returns null when half-formed:
 * no id, no correction reference, no approver, or no strict date.
 * A second approver is optional; unknown fields are dropped.
 */
export function normalizeCorrectionApproval(input) {
  if (!input || typeof input !== 'object') return null;
  const id = cleanText(input.id);
  const correctionRef = cleanText(input.correctionRef);
  const approver = cleanText(input.approver);
  const date = cleanText(input.date);
  if (!id || !correctionRef || !approver) return null;
  if (!validApprovalDate(date)) return null;
  const amountCents = moneyToCents(input.amountCents, input.amount);
  if (amountCents !== null && amountCents < 0) return null;
  return {
    id,
    correctionRef,
    approver,
    secondApprover: cleanText(input.secondApprover),
    date,
    amountCents,
  };
}

export function normalizeCorrectionApprovalList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const clean = normalizeCorrectionApproval(item);
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
export function recordCorrectionApproval(list, input) {
  const clean = normalizeCorrectionApproval(input);
  if (!clean) return null;
  const base = normalizeCorrectionApprovalList(list);
  if (base.some((item) => item.id === clean.id)) return null;
  return [...base, clean];
}

export function removeCorrectionApproval(list, id) {
  const cleanId = cleanText(id);
  if (!cleanId) return normalizeCorrectionApprovalList(list);
  return normalizeCorrectionApprovalList(list).filter((item) => item.id !== cleanId);
}

export function findCorrectionApproval(list, id) {
  const cleanId = cleanText(id);
  if (!cleanId) return null;
  return normalizeCorrectionApprovalList(list).find((item) => item.id === cleanId) ?? null;
}

/** Approvals for one correction reference, in recorded order. */
export function approvalsForCorrection(list, correctionRef) {
  const ref = cleanText(correctionRef);
  if (!ref) return [];
  return normalizeCorrectionApprovalList(list).filter((item) => item.correctionRef === ref);
}

/** All approvals, by date, then correction reference, then id. */
export function approvalsSorted(list) {
  return normalizeCorrectionApprovalList(list).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.correctionRef !== b.correctionRef) return a.correctionRef < b.correctionRef ? -1 : 1;
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
  if (fromDate && !validApprovalDate(fromDate)) return [];
  if (toDate && !validApprovalDate(toDate)) return [];
  if (fromDate && toDate && fromDate > toDate) return [];
  return approvalsSorted(list).filter((item) => {
    if (fromDate && item.date < fromDate) return false;
    if (toDate && item.date > toDate) return false;
    return true;
  });
}

/**
 * True when the recorded amount is strictly greater than the
 * operator-tier limit supplied at review time. An approval with no
 * recorded amount, or a missing/invalid limit, never requires a
 * second approver — the flag must come from a recorded figure,
 * never from a guess.
 */
export function requiresSecondApprover(approval, operatorTierLimitCents) {
  const clean = normalizeCorrectionApproval(approval);
  if (!clean || clean.amountCents === null) return false;
  if (!Number.isInteger(operatorTierLimitCents) || operatorTierLimitCents < 0) return false;
  return clean.amountCents > operatorTierLimitCents;
}

/** Approvals above the operator tier with no second approver. */
export function approvalsMissingSecondApprover(list, operatorTierLimitCents) {
  return normalizeCorrectionApprovalList(list).filter(
    (item) => requiresSecondApprover(item, operatorTierLimitCents) && !item.secondApprover,
  );
}

export function correctionApprovalSummaryText(list, operatorTierLimitCents) {
  const clean = normalizeCorrectionApprovalList(list);
  if (clean.length === 0) return 'No correction approvals recorded.';
  const flagged = approvalsMissingSecondApprover(clean, operatorTierLimitCents);
  const flagPart = flagged.length
    ? ` ${flagged.length} flagged: above the operator tier with no second approver.`
    : ' None flagged missing a second approver.';
  return `${clean.length} correction approval${clean.length === 1 ? '' : 's'} recorded.${flagPart} Recording an approval never changes any bill, payment, or correction.`;
}

export function correctionApprovalText(approval, operatorTierLimitCents) {
  const clean = normalizeCorrectionApproval(approval);
  if (!clean) return '';
  const second = clean.secondApprover ? `Second approver: ${clean.secondApprover}` : 'No second approver';
  const flag = requiresSecondApprover(clean, operatorTierLimitCents) && !clean.secondApprover
    ? ' — FLAGGED: above the operator tier with no second approver'
    : '';
  return `${clean.correctionRef} · Approver: ${clean.approver} · ${second} · ${clean.date} · ${formatMoney(clean.amountCents)}${flag}`;
}

export function correctionApprovalHtml(approval, operatorTierLimitCents) {
  const clean = normalizeCorrectionApproval(approval);
  if (!clean) return '';
  return `<div><p><strong>${escapeHtml(clean.correctionRef)}</strong> · Approver: ${escapeHtml(clean.approver)} · ${escapeHtml(clean.secondApprover || 'No second approver')} · ${escapeHtml(clean.date)} · ${escapeHtml(formatMoney(clean.amountCents))}${requiresSecondApprover(clean, operatorTierLimitCents) && !clean.secondApprover ? ' · <strong>FLAGGED: above the operator tier with no second approver</strong>' : ''}</p></div>`;
}

export function correctionApprovalAllHtml(list, operatorTierLimitCents) {
  return approvalsSorted(list).map((item) => correctionApprovalHtml(item, operatorTierLimitCents)).join('');
}

export function correctionApprovalCsv(list) {
  const clean = approvalsSorted(list);
  const header = 'id,correctionRef,approver,secondApprover,date,amountCents';
  const rows = clean.map((item) => [item.id, item.correctionRef, item.approver, item.secondApprover, item.date, item.amountCents ?? ''].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function correctionApprovalFilename() {
  return 'correction-approvals.csv';
}
