// Plan 64 (Plan 1-100) — Dispute resolution checklist and owner
// sign-off for large adjustments.
//
// A dispute is settled verbally and an adjustment is applied
// without a second check, so a large correction is later
// questioned with no record of who approved it. This module is
// the resolution record that sits on a Plan 61 dispute case: a
// finding, an outcome, and the existing path used to apply it —
// a correction via Plan K, a concession via the existing
// concession path, or a matched payment via Plan 63.
//
// The fences, stated plainly:
//   - This plan grants no discount, correction, or write-off of
//     its own. A resolution record never changes any total by
//     itself: it only records what the operator already did
//     through an existing path, and the link id of the
//     correction, concession, or payment it used. Saving a
//     checklist does not resolve the case, and resolving the
//     case does not apply anything.
//   - The operator action audit log (Plan 31) still records the
//     action itself: a correction is logged by the correction
//     path and a concession by the concession path. This module
//     adds no audit action and never writes the audit log.
//   - A case cannot be marked resolved without a finding and an
//     outcome. The checklist gate (resolutionReadiness) refuses
//     a resolve where either is missing, where the applied path
//     needs a link and none is recorded, or where an
//     above-threshold correction or concession has no owner
//     sign-off note.
//   - Sign-off rule: adjustments above an operator-set threshold
//     additionally require an owner sign-off note before the
//     existing path is used. "Above" is strict: an adjustment
//     exactly at the threshold needs no sign-off. A matched
//     payment moves no new money, so it never needs sign-off,
//     and a path of "none" (the bill was right, nothing applied)
//     needs neither a link nor a sign-off. When no threshold is
//     set, nothing is above it, and the checklist says so in
//     plain words instead of inventing a limit.
//   - The module holds no bill total, payment row, Waada field,
//     or customer record — only the case id, the finding and
//     outcome text, the path, the link id, and the recorded
//     amount. It never reads storage, the clock, or the network,
//     and it never mutates its inputs. Amounts are summed in
//     integer cents, so no float drift. Dates are strict
//     YYYY-MM-DD calendar dates (2026-02-30 is not a date).

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const RESOLUTION_PATHS = [
  'correction',
  'concession',
  'matched_payment',
  'none',
];

export const RESOLUTION_PATH_LABELS = {
  correction: 'Correction via Plan K',
  concession: 'Concession via the existing concession path',
  matched_payment: 'Matched payment via Plan 63',
  none: 'No adjustment — bill was right',
};

// Only these paths move money out of a bill, so only these can
// trip the owner sign-off threshold.
export const SIGNOFF_PATHS = ['correction', 'concession'];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

function toCents(amount) {
  if (typeof amount === 'boolean' || amount === null || amount === undefined || amount === '') return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function fromCents(cents) {
  return cents / 100;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validResolutionDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

// The operator-set sign-off threshold, in integer cents, or null
// when no threshold is set. A non-positive or non-finite value is
// not a threshold — it is treated as unset, never as zero, so an
// unset threshold can never make every adjustment need sign-off.
export function thresholdCents(threshold) {
  return toCents(threshold);
}

export function normalizeResolutionPath(value) {
  const path = text(value).toLowerCase().replace(/[\s-]+/g, '_');
  return RESOLUTION_PATHS.includes(path) ? path : null;
}

// One resolution record. Half-formed records are refused outright,
// never stored half-formed: no case id, no finding, no outcome,
// an unknown path, a money path without a positive amount, or a
// path that needs a link without one. A sign-off note is NOT
// required here — a checklist may be saved while it is still
// waiting for the owner; the sign-off gate lives in
// resolutionReadiness, at resolve time, not at record time.
// A "none" path carries no amount and no link: any amount or link
// supplied with it is dropped to null, never kept as a quiet
// adjustment.
export function normalizeResolution(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const caseId = text(raw.caseId);
  const finding = text(raw.finding);
  const outcome = text(raw.outcome);
  if (!caseId || !finding || !outcome) return null;
  const path = normalizeResolutionPath(raw.path ?? raw.appliedPath);
  if (!path) return null;
  let amountCents = null;
  if (path === 'correction' || path === 'concession') {
    amountCents = toCents(raw.adjustmentAmount ?? raw.amount);
    if (amountCents === null) return null;
  } else if (path === 'matched_payment') {
    const cents = toCents(raw.adjustmentAmount ?? raw.amount);
    amountCents = cents;
  }
  let linkedId = null;
  if (path !== 'none') {
    linkedId = text(raw.linkedId ?? raw.appliedLinkId ?? raw.linkId);
    if (!linkedId) return null;
  }
  return {
    caseId,
    finding,
    outcome,
    path,
    adjustmentAmount: amountCents === null ? null : fromCents(amountCents),
    adjustmentAmountCents: amountCents,
    linkedId,
    signOffNote: text(raw.signOffNote),
    signOffBy: text(raw.signOffBy),
    dateResolved: validResolutionDate(raw.dateResolved ?? raw.date),
  };
}

export function normalizeDisputeResolutionList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const item = normalizeResolution(raw);
    if (item) out.push(item);
  }
  return out;
}

// Upsert: a second resolution for the same case replaces the
// first, so a case id never carries two resolutions. A
// half-formed record leaves the list unchanged.
export function upsertResolution(list, raw) {
  const item = normalizeResolution(raw);
  const base = normalizeDisputeResolutionList(list);
  if (!item) return base;
  const next = base.filter((entry) => entry.caseId !== item.caseId);
  next.push(item);
  return next;
}

export function removeResolution(list, caseId) {
  const key = text(caseId);
  if (!key) return normalizeDisputeResolutionList(list);
  return normalizeDisputeResolutionList(list).filter((entry) => entry.caseId !== key);
}

export function findResolution(list, caseId) {
  const key = text(caseId);
  if (!key) return null;
  return normalizeDisputeResolutionList(list).find((entry) => entry.caseId === key) ?? null;
}

// Does this resolution need an owner sign-off note? Only a
// correction or concession strictly above the threshold does.
// A matched payment, a "none" path, an unset threshold, and an
// adjustment exactly at the threshold never need one.
export function signOffRequired(resolution, threshold) {
  const item = normalizeResolution(resolution);
  if (!item) return false;
  const limit = thresholdCents(threshold);
  if (limit === null) return false;
  if (!SIGNOFF_PATHS.includes(item.path)) return false;
  if (item.adjustmentAmountCents === null) return false;
  return item.adjustmentAmountCents > limit;
}

// The resolve gate. `resolution` may be a stored record or a
// draft object; a case record is accepted as an optional plain
// object carrying a status, and a case that is already resolved
// is not re-resolved through this gate. Returns every missing
// piece by name, so the panel can say exactly what is still
// needed instead of a bare refusal.
export function resolutionReadiness(resolution, threshold, caseRecord = null) {
  const item = normalizeResolution(resolution);
  const reasons = [];
  if (!item) {
    reasons.push('A finding, an outcome, a valid path, and — for a correction, concession, or matched payment — a positive amount and a link are all required.');
    return { ready: false, reasons, signOffRequired: false, signOffPresent: false, thresholdSet: thresholdCents(threshold) !== null };
  }
  if (caseRecord && typeof caseRecord === 'object' && text(caseRecord.status).toLowerCase() === 'resolved') {
    reasons.push('This case is already resolved.');
  }
  const required = signOffRequired(item, threshold);
  const present = Boolean(item.signOffNote);
  if (required && !present) {
    reasons.push('This adjustment is above the owner sign-off threshold, so an owner sign-off note is required before the correction or concession is applied.');
  }
  return {
    ready: reasons.length === 0,
    reasons,
    signOffRequired: required,
    signOffPresent: present,
    thresholdSet: thresholdCents(threshold) !== null,
  };
}

// The checklist itself: one row per acceptance item, each marked
// done or still missing, with items that do not apply (a link for
// a "none" path, a sign-off for a below-threshold or matched
// adjustment) shown as not applicable rather than missing.
export function resolutionChecklist(resolution, threshold) {
  const item = normalizeResolution(resolution);
  const required = item ? signOffRequired(item, threshold) : false;
  const rows = [
    { key: 'finding', label: 'Finding recorded', done: Boolean(item?.finding), applies: true },
    { key: 'outcome', label: 'Outcome recorded', done: Boolean(item?.outcome), applies: true },
    { key: 'path', label: 'Existing path chosen (correction, concession, matched payment, or none)', done: Boolean(item?.path), applies: true },
    { key: 'link', label: 'Correction, concession, or payment link recorded', done: Boolean(item?.linkedId), applies: Boolean(item) && item.path !== 'none' },
    { key: 'amount', label: 'Adjustment amount recorded', done: item?.adjustmentAmountCents !== null && item?.adjustmentAmountCents !== undefined, applies: Boolean(item) && SIGNOFF_PATHS.includes(item.path) },
    { key: 'signoff', label: 'Owner sign-off note recorded', done: Boolean(item?.signOffNote), applies: required },
  ];
  return {
    rows,
    complete: rows.filter((row) => row.applies).every((row) => row.done),
    signOffRequired: required,
    thresholdSet: thresholdCents(threshold) !== null,
  };
}

export function buildResolutionSummary(list) {
  const base = normalizeDisputeResolutionList(list);
  const byPath = {};
  for (const path of RESOLUTION_PATHS) byPath[path] = 0;
  let adjustmentCents = 0;
  let awaitingSignOff = 0;
  for (const entry of base) {
    byPath[entry.path] += 1;
    if (SIGNOFF_PATHS.includes(entry.path) && entry.adjustmentAmountCents !== null) {
      adjustmentCents += entry.adjustmentAmountCents;
    }
  }
  return {
    total: base.length,
    byPath,
    totalAdjustment: fromCents(adjustmentCents),
    totalAdjustmentCents: adjustmentCents,
    awaitingSignOff,
  };
}

// Summary with the threshold applied: how many stored resolutions
// are still waiting for a sign-off note. Kept separate from
// buildResolutionSummary so a summary without a threshold never
// invents one.
export function buildResolutionSummaryWithThreshold(list, threshold) {
  const summary = buildResolutionSummary(list);
  const base = normalizeDisputeResolutionList(list);
  summary.awaitingSignOff = base.filter((entry) => signOffRequired(entry, threshold) && !entry.signOffNote).length;
  summary.thresholdSet = thresholdCents(threshold) !== null;
  summary.threshold = summary.thresholdSet ? fromCents(thresholdCents(threshold)) : null;
  return summary;
}

export function resolutionSummaryText(summary) {
  if (!summary) return '';
  const parts = [`${summary.total} dispute resolution${summary.total === 1 ? '' : 's'} recorded`];
  parts.push(`total adjustments Rs. ${summary.totalAdjustment}`);
  if (summary.thresholdSet) {
    parts.push(`owner sign-off threshold Rs. ${summary.threshold}`);
    parts.push(`${summary.awaitingSignOff} awaiting a sign-off note`);
  } else {
    parts.push('no owner sign-off threshold set');
  }
  return parts.join('. ') + '.';
}

function resolutionRowHtml(entry) {
  return `<tr><td>${escapeHtml(entry.caseId)}</td><td>${escapeHtml(entry.finding)}</td><td>${escapeHtml(entry.outcome)}</td><td>${escapeHtml(RESOLUTION_PATH_LABELS[entry.path])}</td><td>${entry.adjustmentAmount === null ? '—' : `Rs. ${entry.adjustmentAmount}`}</td><td>${escapeHtml(entry.linkedId || '—')}</td><td>${escapeHtml(entry.signOffNote || '—')}</td><td>${escapeHtml(entry.signOffBy || '')}</td><td>${escapeHtml(entry.dateResolved || 'Not recorded')}</td></tr>`;
}

export function resolutionHtml(list) {
  const rows = normalizeDisputeResolutionList(list);
  if (rows.length === 0) return '<p style="font-size: 12px;">No dispute resolutions recorded.</p>';
  return `<table class="data-table"><thead><tr><th>Case</th><th>Finding</th><th>Outcome</th><th>Path used</th><th>Adjustment</th><th>Link</th><th>Owner sign-off</th><th>Signed by</th><th>Date resolved</th></tr></thead><tbody>${rows.map(resolutionRowHtml).join('')}</tbody></table>`;
}

export function resolutionCsv(list) {
  const rows = normalizeDisputeResolutionList(list);
  const header = ['caseId', 'finding', 'outcome', 'path', 'adjustmentAmount', 'linkedId', 'signOffNote', 'signOffBy', 'dateResolved'].map(csvCell).join(',');
  const lines = rows.map((entry) => [entry.caseId, entry.finding, entry.outcome, entry.path, entry.adjustmentAmount, entry.linkedId, entry.signOffNote, entry.signOffBy, entry.dateResolved].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function resolutionFilename() {
  return 'dispute-resolutions.csv';
}

export function checklistHtml(checklist) {
  if (!checklist) return '';
  const rows = checklist.rows.map((row) => `<li>${row.applies ? (row.done ? '✅ ' : '⬜ ') : '— '}${escapeHtml(row.label)}${row.applies ? '' : ' (not applicable)'}</li>`).join('');
  return `<ul style="font-size: 12px;">${rows}</ul><p style="font-size: 12px;">${checklist.complete ? 'Checklist complete — the case may be marked resolved.' : 'Checklist incomplete — the case cannot be marked resolved yet.'}${checklist.thresholdSet ? '' : ' No owner sign-off threshold is set.'}</p>`;
}
