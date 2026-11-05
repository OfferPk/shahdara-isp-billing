// Plan 329 (Plan 203-350) — Quarterly business snapshot (read-only,
// composition only).
//
// The owner only gets a full picture once a year, so a bad quarter is
// discovered months too late. This module closes that gap without a
// new reporting system: it takes the monthly figures the caller
// supplies — one record per month with collections in whole rupees,
// customers gained, customers lost, open faults, and dues outstanding
// in whole rupees — and composes one snapshot per quarter from them.
//
// A quarter stays inside one calendar year: Q1 is January to March,
// Q2 April to June, Q3 July to September, Q4 October to December.
//
// Honesty rules, stated plainly rather than hidden:
//   - This module computes NO new kind of figure and makes NO
//     forecast: every figure shown is composed from monthly figures
//     the caller supplied. Collections, customers gained, and
//     customers lost are the integer sums of the three months.
//     Open faults and dues outstanding are stocks, not flows, so
//     they are carried from the latest month present in the quarter,
//     and that month is named — they are never summed, never
//     averaged, and never guessed.
//   - A quarter with a missing month is marked incomplete, and the
//     missing months are named — never shown as zero, never hidden.
//   - The snapshot is READ-ONLY: building it is a pure function of
//     its input. It writes nothing, stores nothing, reads no storage,
//     clock, or network, and mutates no input — so using the snapshot
//     never changes any bill, payment, customer, or monthly figure.
//     It holds no record of its own; the monthly figures live in the
//     caller's store and are only read through the list the caller
//     passes in.
//   - This is not the seasonal view of Plan 320 (seasons across
//     years), not the monthly KPI sheet of Plan 318, and not the
//     annual summary of Plan 71: those views are neither read nor
//     written here, and none of their records is touched. The caller
//     supplies the monthly figures, and this module only composes
//     them into quarters.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const QUARTERS = [
  { quarter: 'Q1', months: [1, 2, 3] },
  { quarter: 'Q2', months: [4, 5, 6] },
  { quarter: 'Q3', months: [7, 8, 9] },
  { quarter: 'Q4', months: [10, 11, 12] },
];

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
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

function money(value) {
  return `Rs ${Number(value).toLocaleString('en-PK')}`;
}

function monthNumber(month) {
  return Number(month.slice(5, 7));
}

function yearNumber(month) {
  return Number(month.slice(0, 4));
}

function padMonth(num) {
  return String(num).padStart(2, '0');
}

/** A valid month 'YYYY-MM', or '' when invalid. */
export function validQuarterlySnapshotMonth(value) {
  const clean = text(value);
  return MONTH_RE.test(clean) ? clean : '';
}

/** Plain-words label for a month, for example "November 2026". */
export function quarterlySnapshotMonthLabel(month) {
  const clean = validQuarterlySnapshotMonth(month);
  if (!clean) return '';
  return `${MONTH_NAMES[monthNumber(clean) - 1]} ${yearNumber(clean)}`;
}

/**
 * The quarter a month belongs to: { year, quarter } with quarter
 * 'Q1' to 'Q4', or null when the month is invalid.
 */
export function quarterForMonth(month) {
  const clean = validQuarterlySnapshotMonth(month);
  if (!clean) return null;
  const num = monthNumber(clean);
  const quarter = QUARTERS.find((entry) => entry.months.includes(num));
  return { year: yearNumber(clean), quarter: quarter.quarter };
}

/** Plain-words label for a quarter, for example "Q1 2026". */
export function quarterlySnapshotQuarterLabel(year, quarter) {
  const cleanYear = Number(year);
  const entry = QUARTERS.find((item) => item.quarter === quarter);
  if (!Number.isInteger(cleanYear) || cleanYear < 1 || !entry) return '';
  return `${quarter} ${cleanYear}`;
}

/** The three months of a quarter, in order, or [] when invalid. */
export function quarterlySnapshotQuarterMonths(year, quarter) {
  const cleanYear = Number(year);
  const entry = QUARTERS.find((item) => item.quarter === quarter);
  if (!Number.isInteger(cleanYear) || cleanYear < 1 || !entry) return [];
  return entry.months.map((num) => `${cleanYear}-${padMonth(num)}`);
}

/**
 * A usable whole-number figure: a finite integer, or a digit string
 * for one. Whole rupees and whole counts only — money text such as
 * "Rs 1800", negatives, and fractions are refused (null).
 */
export function normalizeQuarterlySnapshotFigure(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string') {
    const clean = value.trim();
    if (!/^\d+$/.test(clean)) return null;
    const num = Number(clean);
    return Number.isSafeInteger(num) ? num : null;
  }
  return null;
}

/**
 * Normalize one monthly figure record, or null when half-formed.
 * A record is { id, month, figures: { collections, gained, lost,
 * openFaults, dues } } with every figure a whole number >= 0.
 */
export function normalizeQuarterlyMonthlyFigure(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const month = validQuarterlySnapshotMonth(raw.month);
  if (!id || !month) return null;
  const figures = raw.figures && typeof raw.figures === 'object' ? raw.figures : null;
  if (!figures) return null;
  const collections = normalizeQuarterlySnapshotFigure(figures.collections);
  const gained = normalizeQuarterlySnapshotFigure(figures.gained);
  const lost = normalizeQuarterlySnapshotFigure(figures.lost);
  const openFaults = normalizeQuarterlySnapshotFigure(figures.openFaults);
  const dues = normalizeQuarterlySnapshotFigure(figures.dues);
  if (
    collections === null || gained === null || lost === null
    || openFaults === null || dues === null
  ) return null;
  return { id, month, figures: { collections, gained, lost, openFaults, dues } };
}

/** Normalize a list of monthly figure records, dropping the unusable. */
export function normalizeQuarterlyMonthlyFigureList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const record = normalizeQuarterlyMonthlyFigure(raw);
    if (record) out.push(record);
  }
  return out;
}

/** Find the monthly figure for one month, or null. */
export function findQuarterlyMonthlyFigure(list, month) {
  const clean = validQuarterlySnapshotMonth(month);
  if (!clean) return null;
  const records = normalizeQuarterlyMonthlyFigureList(list);
  return records.find((record) => record.month === clean) ?? null;
}

/**
 * Record one monthly figure. A record with no id, no strict month,
 * or a missing or non-whole figure is refused; a duplicate id or a
 * second figure for the same month is never rewritten. Returns the
 * new list (unchanged on refusal).
 */
export function recordQuarterlyMonthlyFigure(list, raw) {
  const clean = normalizeQuarterlyMonthlyFigureList(list);
  const record = normalizeQuarterlyMonthlyFigure(raw);
  if (!record) return clean;
  if (clean.some((entry) => entry.id === record.id)) return clean;
  if (clean.some((entry) => entry.month === record.month)) return clean;
  return [...clean, record];
}

/** Remove one monthly figure by id; unknown ids leave the list alone. */
export function removeQuarterlyMonthlyFigure(list, id) {
  const clean = normalizeQuarterlyMonthlyFigureList(list);
  const key = text(id);
  if (!key) return clean;
  return clean.filter((entry) => entry.id !== key);
}

/**
 * Compose one quarterly snapshot from caller-supplied monthly
 * figures. Collections, gained, and lost are the integer sums of
 * the months present; net change is gained minus lost. Open faults
 * and dues outstanding are carried from the latest month present,
 * and that month is named. A quarter with a missing month is marked
 * incomplete and the missing months are named. Returns null for an
 * invalid quarter.
 */
export function buildQuarterlySnapshot(list, year, quarter) {
  const months = quarterlySnapshotQuarterMonths(year, quarter);
  if (!months.length) return null;
  const records = normalizeQuarterlyMonthlyFigureList(list);
  const present = months.filter((month) => records.some((record) => record.month === month));
  const missing = months.filter((month) => !present.includes(month));
  const presentRecords = present.map((month) => records.find((record) => record.month === month));
  const sum = (key) => presentRecords.reduce((total, record) => total + record.figures[key], 0);
  const collections = sum('collections');
  const gained = sum('gained');
  const lost = sum('lost');
  const latest = present.length ? present[present.length - 1] : '';
  const latestRecord = latest ? records.find((record) => record.month === latest) : null;
  return {
    year: Number(year),
    quarter,
    label: quarterlySnapshotQuarterLabel(year, quarter),
    months,
    presentMonths: present,
    missingMonths: missing,
    complete: missing.length === 0,
    collections,
    gained,
    lost,
    netChange: gained - lost,
    openFaults: latestRecord ? latestRecord.figures.openFaults : null,
    openFaultsMonth: latest,
    dues: latestRecord ? latestRecord.figures.dues : null,
    duesMonth: latest,
  };
}

/**
 * Build a snapshot for every quarter that has at least one monthly
 * figure recorded, newest quarter first.
 */
export function buildQuarterlySnapshots(list) {
  const records = normalizeQuarterlyMonthlyFigureList(list);
  const keys = new Set();
  for (const record of records) {
    const found = quarterForMonth(record.month);
    if (found) keys.add(`${found.year}-${found.quarter}`);
  }
  const snapshots = [];
  for (const key of keys) {
    const [yearText, quarter] = key.split('-');
    const snapshot = buildQuarterlySnapshot(records, Number(yearText), quarter);
    if (snapshot) snapshots.push(snapshot);
  }
  snapshots.sort((a, b) => (b.year - a.year) || (b.quarter.localeCompare(a.quarter)));
  return snapshots;
}

/**
 * Prove a snapshot reconciles exactly to the monthly figures it was
 * composed from on the same list: true on the same figures, false
 * when any figure was changed or a month added or removed.
 */
export function quarterlySnapshotReconciles(snapshot, list) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const rebuilt = buildQuarterlySnapshot(list, snapshot.year, snapshot.quarter);
  if (!rebuilt) return false;
  return JSON.stringify(rebuilt) === JSON.stringify(snapshot);
}

/** Plain-words summary of one snapshot. */
export function quarterlySnapshotSummaryText(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return 'No quarterly snapshot.';
  const parts = [
    `${snapshot.label}: collections ${money(snapshot.collections)}, ${snapshot.gained} customers gained, ${snapshot.lost} lost (net ${snapshot.netChange}), `,
  ];
  if (snapshot.openFaults === null) {
    parts.push('open faults not recorded, dues not recorded');
  } else {
    parts.push(`open faults ${snapshot.openFaults} and dues ${money(snapshot.dues)} as of ${quarterlySnapshotMonthLabel(snapshot.openFaultsMonth)}`);
  }
  parts.push(snapshot.complete ? '. Complete.' : `. Incomplete — missing ${snapshot.missingMonths.map((month) => quarterlySnapshotMonthLabel(month)).join(', ')}.`);
  return parts.join('');
}

/** Plain-words summary of a list of snapshots. */
export function quarterlySnapshotsSummaryText(snapshots) {
  const list = Array.isArray(snapshots) ? snapshots : [];
  if (!list.length) return 'No quarterly snapshots.';
  const complete = list.filter((snapshot) => snapshot.complete).length;
  return `${list.length} quarterly snapshot${list.length === 1 ? '' : 's'} (${complete} complete, ${list.length - complete} incomplete).`;
}

/** Escaped HTML for one snapshot. */
export function quarterlySnapshotHtml(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return '<p>No quarterly snapshot.</p>';
  const rows = [
    ['Collections', money(snapshot.collections)],
    ['Customers gained', String(snapshot.gained)],
    ['Customers lost', String(snapshot.lost)],
    ['Net change', String(snapshot.netChange)],
    ['Open faults', snapshot.openFaults === null ? 'Not recorded' : `${snapshot.openFaults} (as of ${escapeHtml(quarterlySnapshotMonthLabel(snapshot.openFaultsMonth))})`],
    ['Dues outstanding', snapshot.dues === null ? 'Not recorded' : `${money(snapshot.dues)} (as of ${escapeHtml(quarterlySnapshotMonthLabel(snapshot.duesMonth))})`],
    ['Months', snapshot.months.map((month) => escapeHtml(quarterlySnapshotMonthLabel(month))).join(', ')],
    ['Status', snapshot.complete ? 'Complete' : `Incomplete — missing ${snapshot.missingMonths.map((month) => escapeHtml(quarterlySnapshotMonthLabel(month))).join(', ')}`],
  ];
  return `<h4>${escapeHtml(snapshot.label)}</h4><p>${escapeHtml(quarterlySnapshotSummaryText(snapshot))}</p><table><tbody>${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`).join('')}</tbody></table>`;
}

/** Escaped HTML for a list of snapshots, newest first. */
export function quarterlySnapshotAllHtml(snapshots) {
  const list = Array.isArray(snapshots) ? snapshots : [];
  if (!list.length) return '<p>No quarterly snapshots recorded.</p>';
  return list.map((snapshot) => quarterlySnapshotHtml(snapshot)).join('');
}

/** CSV for a list of snapshots. */
export function quarterlySnapshotCsv(snapshots) {
  const list = Array.isArray(snapshots) ? snapshots : [];
  const header = ['Quarter', 'Collections (Rs)', 'Gained', 'Lost', 'Net change', 'Open faults', 'Open faults as of', 'Dues (Rs)', 'Dues as of', 'Complete', 'Missing months'];
  const lines = [header.map(csvCell).join(',')];
  for (const snapshot of list) {
    lines.push([
      snapshot.label,
      snapshot.collections,
      snapshot.gained,
      snapshot.lost,
      snapshot.netChange,
      snapshot.openFaults === null ? '' : snapshot.openFaults,
      snapshot.openFaultsMonth ? quarterlySnapshotMonthLabel(snapshot.openFaultsMonth) : '',
      snapshot.dues === null ? '' : snapshot.dues,
      snapshot.duesMonth ? quarterlySnapshotMonthLabel(snapshot.duesMonth) : '',
      snapshot.complete ? 'yes' : 'no',
      snapshot.missingMonths.map((month) => quarterlySnapshotMonthLabel(month)).join('; '),
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function quarterlySnapshotFilename() {
  return 'quarterly-snapshots.csv';
}
