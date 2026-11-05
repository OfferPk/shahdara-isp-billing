// Plan 299 (Plan 203-350) — Monthly target record per collector.
//
// A collector's month has no written target, so "a good month" is
// judged by feeling instead of against a figure agreed in advance.
// This module adds only the missing piece: one dated target record
// per collector per month — the collector, the month, the target in
// plain words and figures, and the month-end achieved figure entered
// by the operator from existing settlement figures — so the target
// and the achieved figure sit side by side for the month.
//
// What this module is NOT, stated plainly:
//   - It is not the field day target. A daily target for one field
//     day already exists and is neither read nor rewritten here;
//     this module only covers a whole month's target per collector.
//   - It is not the collector performance view. That view shows
//     measured visits, promises kept, and cash; this module only
//     records the agreed target and the entered achieved figure.
//   - It is not the monthly collection target per mohalla. That
//     record already exists and is neither read nor rewritten here;
//     this module only covers a target per collector.
//   - It is not a live figure. Achieved figures are entered by the
//     operator, never recomputed from live data, and recording a
//     target never changes any bill, payment, or collection figure
//     by itself.
//   - It is not an editable record. A target record, once written,
//     is never silently edited: there is no edit function, only
//     record, find, and remove, so a wrong record is removed and
//     recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never mutates an input.
//   - A record with no id, no collector, no strict month, no target
//     in plain words, or no whole-rupee target amount is refused
//     outright. Unknown fields are dropped, so a record can never
//     grow a bill, payment, or collection field.
//   - One record per collector per month: a second record for a
//     collector and month already recorded is refused, so the agreed
//     figure for a month can never be quietly replaced.
//   - A duplicate id is never rewritten: the first record stays.

const MONTHS_IN_YEAR = 12;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

/** Strict month: YYYY-MM with a real month, or false. */
export function validCollectorMonthlyTargetMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= MONTHS_IN_YEAR;
}

/** Whole rupees only: an integer number, or a string of digits, or null. */
function wholeRupees(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/** Whole rupees or nothing: an empty value reads as no achieved figure yet. */
function optionalWholeRupees(value) {
  if (value === null || value === undefined || value === '') return null;
  return wholeRupees(value);
}

/**
 * One monthly target record, or null when half-formed. A record needs
 * an id, a collector, a strict month, a target in plain words, and a
 * whole-rupee target amount of at least one rupee. The achieved
 * figure is optional — it is entered by the operator from existing
 * settlement figures — and when given must be whole rupees of zero
 * or more. Unknown fields are dropped; the input is never mutated.
 */
export function normalizeCollectorMonthlyTarget(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const collector = text(raw.collector);
  const month = text(raw.month);
  const target = text(raw.target);
  const targetAmount = wholeRupees(raw.targetAmount);
  const achievedAmount = optionalWholeRupees(raw.achievedAmount);
  if (!id) return null;
  if (!collector) return null;
  if (!validCollectorMonthlyTargetMonth(month)) return null;
  if (!target) return null;
  if (targetAmount === null || targetAmount < 1) return null;
  if (raw.achievedAmount !== null && raw.achievedAmount !== undefined && raw.achievedAmount !== '' && achievedAmount === null) return null;
  if (achievedAmount !== null && achievedAmount < 0) return null;
  return {
    id,
    collector,
    month,
    target,
    targetAmount,
    achievedAmount,
  };
}

/**
 * Normalised records only. A duplicate id is never rewritten, and
 * only the first record for one collector in one month stays — the
 * first record for an id or a collector-month always stays.
 */
export function normalizeCollectorMonthlyTargetList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCollectorMonths = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeCollectorMonthlyTarget(raw);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    const key = `${lower(record.collector)}|${record.month}`;
    if (seenCollectorMonths.has(key)) continue;
    seenIds.add(record.id);
    seenCollectorMonths.add(key);
    out.push(record);
  }
  return out;
}

export function findCollectorMonthlyTarget(list, id) {
  const clean = normalizeCollectorMonthlyTargetList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((record) => record.id === wanted) ?? null;
}

/**
 * Record a target. Refused when half-formed, when its id is already
 * recorded, or when that collector already has a target for that
 * month — the first record for an id or a collector-month always
 * stays.
 */
export function recordCollectorMonthlyTarget(list, raw) {
  const clean = normalizeCollectorMonthlyTargetList(list);
  const record = normalizeCollectorMonthlyTarget(raw);
  if (!record) return clean;
  if (clean.some((item) => item.id === record.id)) return clean;
  if (clean.some((item) => lower(item.collector) === lower(record.collector) && item.month === record.month)) return clean;
  return [...clean, record];
}

export function removeCollectorMonthlyTarget(list, id) {
  const clean = normalizeCollectorMonthlyTargetList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((record) => record.id !== wanted);
}

/** Records by month, then collector A-Z, then id, so the same list always reads the same way. */
export function collectorMonthlyTargetsSorted(list) {
  const clean = normalizeCollectorMonthlyTargetList(list);
  return [...clean].sort((a, b) => {
    if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    if (lower(a.collector) !== lower(b.collector)) return lower(a.collector) < lower(b.collector) ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Targets for one collector, in month order; the collector match is case-insensitive. */
export function collectorMonthlyTargetsForCollector(list, collector) {
  const wanted = lower(collector);
  if (!wanted) return [];
  return collectorMonthlyTargetsSorted(list).filter((record) => lower(record.collector) === wanted);
}

/** Targets for one month, collector A-Z. */
export function collectorMonthlyTargetsForMonth(list, month) {
  const wanted = text(month);
  if (!validCollectorMonthlyTargetMonth(wanted)) return [];
  return collectorMonthlyTargetsSorted(list).filter((record) => record.month === wanted);
}

/** Collectors with a target, first spelling kept, A-Z. */
export function collectorMonthlyTargetCollectors(list) {
  const clean = normalizeCollectorMonthlyTargetList(list);
  const seen = new Map();
  for (const record of clean) {
    const key = lower(record.collector);
    if (!seen.has(key)) seen.set(key, record.collector);
  }
  return [...seen.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0));
}

/** Plain-words comparison of achieved against target, or that no achieved figure is entered yet. */
export function collectorMonthlyTargetComparisonText(record) {
  const clean = normalizeCollectorMonthlyTarget(record);
  if (!clean) return '';
  if (clean.achievedAmount === null) return `target Rs ${clean.targetAmount}, achieved not yet entered`;
  if (clean.achievedAmount === clean.targetAmount) return `target Rs ${clean.targetAmount} met, achieved Rs ${clean.achievedAmount}`;
  if (clean.achievedAmount < clean.targetAmount) return `target Rs ${clean.targetAmount}, achieved Rs ${clean.achievedAmount}, short by Rs ${clean.targetAmount - clean.achievedAmount}`;
  return `target Rs ${clean.targetAmount}, achieved Rs ${clean.achievedAmount}, over by Rs ${clean.achievedAmount - clean.targetAmount}`;
}

export function collectorMonthlyTargetSummaryText(list) {
  const clean = normalizeCollectorMonthlyTargetList(list);
  if (clean.length === 0) return 'No monthly collector targets recorded.';
  const word = clean.length === 1 ? 'target' : 'targets';
  const sorted = collectorMonthlyTargetsSorted(clean);
  const latest = sorted[sorted.length - 1];
  return `${clean.length} monthly collector ${word} recorded. Latest: ${latest.collector}, ${latest.month}, ${collectorMonthlyTargetComparisonText(latest)}.`;
}

/** Plain-words text for one record: target and achieved side by side for the month. */
export function collectorMonthlyTargetEntryText(record) {
  const clean = normalizeCollectorMonthlyTarget(record);
  if (!clean) return 'No monthly collector target recorded.';
  return `${clean.collector} — ${clean.month}: ${clean.target} (${collectorMonthlyTargetComparisonText(clean)}).`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function collectorMonthlyTargetEntryHtml(record) {
  const clean = normalizeCollectorMonthlyTarget(record);
  if (!clean) return '<p>No monthly collector target recorded.</p>';
  return `<p>${escapeHtml(collectorMonthlyTargetEntryText(clean))}</p>`;
}

export function collectorMonthlyTargetAllHtml(list) {
  const rows = collectorMonthlyTargetsSorted(list);
  if (!rows.length) return '<p>No monthly collector targets recorded.</p>';
  return `<ul>${rows.map((record) => `<li>${escapeHtml(collectorMonthlyTargetEntryText(record))}</li>`).join('')}</ul>`;
}

export function collectorMonthlyTargetsForCollectorHtml(list, collector) {
  const rows = collectorMonthlyTargetsForCollector(list, collector);
  if (!rows.length) return '<p>No monthly collector targets recorded for this collector.</p>';
  return `<ul>${rows.map((record) => `<li>${escapeHtml(collectorMonthlyTargetEntryText(record))}</li>`).join('')}</ul>`;
}

export function collectorMonthlyTargetsForMonthHtml(list, month) {
  const rows = collectorMonthlyTargetsForMonth(list, month);
  if (!rows.length) return '<p>No monthly collector targets recorded for this month.</p>';
  return `<ul>${rows.map((record) => `<li>${escapeHtml(collectorMonthlyTargetEntryText(record))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function collectorMonthlyTargetCsv(list) {
  const rows = collectorMonthlyTargetsSorted(list);
  const lines = ['"id","collector","month","target","target amount","achieved amount"'];
  for (const record of rows) {
    lines.push([
      csvCell(record.id),
      csvCell(record.collector),
      csvCell(record.month),
      csvCell(record.target),
      csvCell(record.targetAmount),
      csvCell(record.achievedAmount === null ? '' : record.achievedAmount),
    ].join(','));
  }
  return lines.join('\n');
}

export function collectorMonthlyTargetFilename() {
  return 'collector-monthly-targets.csv';
}
