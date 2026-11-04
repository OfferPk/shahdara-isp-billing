// Plan 193 (Plan 101-202) — Multi-Year Comparison View (read-only,
// composition only).
//
// Annual summaries sit side by side but are never compared, so the
// owner cannot see whether this year is ahead of or behind previous
// years in the same period. This module closes that gap without a
// new reporting system: it takes the named figures that already
// exist — one record per year for one period, supplied by the caller
// from the existing annual summaries (Plan 71) and month snapshots
// (Plan 70) — and lines the SAME figure up across years for the
// SAME period, so the direction over time is visible at a glance.
//
// Honesty rules, stated plainly rather than hidden:
//   - This module computes NO new kind of figure. It adds no total,
//     no difference, no percentage, and no score: every value shown
//     is a figure the caller supplied, carried verbatim. A figure
//     that is missing for a year is shown as "Missing" — never as
//     zero, never estimated, never filled from another year.
//   - A year with no record for the chosen period still appears as a
//     column, with every figure Missing. Missing years are shown as
//     missing, not hidden and not zeroed.
//   - The view is READ-ONLY: buildYearComparison is a pure function
//     of its input. It writes nothing, stores nothing, reads no
//     storage, clock, or network, and mutates no input — so using
//     the view never changes any bill, payment, snapshot, or past
//     total. It holds no record of its own.
//   - Figure names merge case-insensitively across years (first
//     spelling kept), so "Collections" in one year and
//     "collections" in another line up as one row instead of two.
//   - A period is either one month of the year ("01".."12") or the
//     full year ("year"). Anything else is refused, never mapped
//     onto a neighbouring period.
//
// The module never reads or writes any other module's records: the
// caller supplies the records, and this module only aligns them.
// Annual summaries (annual-summary.js) and month snapshots
// (month-snapshots.js) are neither read nor written here.

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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

/** A valid calendar year (four digits), or '' when invalid. */
export function validComparisonYear(value) {
  const year = text(value);
  return YEAR_RE.test(year) ? year : '';
}

/**
 * A valid comparison period: 'year' for the full year, or a
 * two-digit month '01'..'12'. 'Full year' / 'full-year' spellings
 * are accepted as 'year'; anything else is '' (never mapped onto a
 * neighbouring period).
 */
export function validComparisonPeriod(value) {
  const raw = text(value).toLowerCase();
  if (raw === 'year' || raw === 'full-year' || raw === 'full year') return 'year';
  return MONTH_RE.test(raw) ? raw : '';
}

/** Human label for a period: 'Full year' or the month name. */
export function comparisonPeriodLabel(period) {
  const clean = validComparisonPeriod(period);
  if (!clean) return '';
  if (clean === 'year') return 'Full year';
  return MONTH_NAMES[Number(clean) - 1];
}

/**
 * A usable figure value, carried verbatim: a finite number or a
 * non-empty string. Anything else (null, blank, boolean,
 * non-finite) is null — missing, never zero.
 */
function usableFigureValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const clean = value.trim();
    return clean ? clean : null;
  }
  return null;
}

/**
 * Normalize one caller-supplied year record:
 * { year, period, figures: { name: value } }.
 * Unknown fields are dropped. Figure names are trimmed and merged
 * case-insensitively (first spelling kept); unusable values become
 * null (missing). Returns null for a record with no valid year or
 * no valid period.
 */
export function normalizeYearRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const year = validComparisonYear(raw.year);
  const period = validComparisonPeriod(raw.period);
  if (!year || !period) return null;
  const figures = {};
  const seen = new Map();
  const source = raw.figures && typeof raw.figures === 'object' && !Array.isArray(raw.figures)
    ? raw.figures : {};
  for (const [name, value] of Object.entries(source)) {
    const cleanName = text(name);
    if (!cleanName) continue;
    const key = cleanName.toLowerCase();
    if (seen.has(key)) continue;
    seen.set(key, cleanName);
    figures[cleanName] = usableFigureValue(value);
  }
  return { year, period, figures };
}

/** Normalize a list of year records: deduped by year+period (first kept), sorted by year then period. */
export function normalizeYearRecordList(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const record = normalizeYearRecord(raw);
    if (!record) continue;
    const key = `${record.year}|${record.period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  out.sort((a, b) => (a.year === b.year
    ? a.period.localeCompare(b.period)
    : a.year.localeCompare(b.year)));
  return out;
}

/** Distinct years present in the records, ascending. */
export function comparisonYears(records) {
  const years = new Set();
  for (const record of normalizeYearRecordList(records)) years.add(record.year);
  return [...years].sort();
}

/** Distinct periods present in the records: 'year' first, then months in order. */
export function comparisonPeriods(records) {
  const periods = new Set();
  for (const record of normalizeYearRecordList(records)) periods.add(record.period);
  return [...periods].sort((a, b) => {
    if (a === 'year') return -1;
    if (b === 'year') return 1;
    return a.localeCompare(b);
  });
}

/**
 * Build the multi-year comparison for one period from caller-supplied
 * year records. One row per figure name (A-Z), one column per year
 * present anywhere in the records; a year with no record for this
 * period shows Missing for every figure. Returns null when the
 * period is invalid or when no records were supplied at all.
 * No total, difference, percentage, or score is added anywhere.
 */
export function buildYearComparison({ period, records = [] } = {}) {
  const cleanPeriod = validComparisonPeriod(period);
  if (!cleanPeriod) return null;
  const normalized = normalizeYearRecordList(records);
  if (!normalized.length) return null;
  const years = comparisonYears(normalized);
  const byYear = new Map();
  for (const record of normalized) {
    if (record.period === cleanPeriod) byYear.set(record.year, record);
  }
  const figureNames = new Map();
  for (const record of byYear.values()) {
    for (const name of Object.keys(record.figures)) {
      const key = name.toLowerCase();
      if (!figureNames.has(key)) figureNames.set(key, name);
    }
  }
  const rows = [...figureNames.values()].sort((a, b) => a.localeCompare(b)).map((name) => {
    const values = {};
    for (const year of years) {
      const record = byYear.get(year);
      if (!record) { values[year] = null; continue; }
      // Case-insensitive lookup: another year may spell the same
      // figure differently, and it must still line up on this row.
      const match = Object.keys(record.figures)
        .find((key) => key.toLowerCase() === name.toLowerCase());
      values[year] = match === undefined ? null : record.figures[match];
    }
    const missingYears = years.filter((year) => values[year] === null);
    return { figure: name, values, missingYears };
  });
  const missingYearsOverall = years.filter((year) => !byYear.has(year));
  return {
    period: cleanPeriod,
    periodLabel: comparisonPeriodLabel(cleanPeriod),
    years,
    rows,
    missingYears: missingYearsOverall,
  };
}

/** Plain-words summary of one comparison view. */
export function yearComparisonText(view) {
  if (!view) return '';
  const lines = [`Year comparison — ${view.periodLabel} (${view.years.join(', ')})`];
  if (view.missingYears.length) {
    lines.push(`No record for this period in: ${view.missingYears.join(', ')} (shown as Missing).`);
  }
  for (const row of view.rows) {
    const cells = view.years.map((year) => {
      const value = row.values[year];
      return `${year}: ${value === null ? 'Missing' : value}`;
    });
    lines.push(`${row.figure}: ${cells.join(' | ')}`);
  }
  return lines.join('\n');
}

/** HTML table for one comparison view (Missing cells marked plainly). */
export function yearComparisonHtml(view) {
  if (!view) return '';
  const head = `<tr><th>Figure</th>${view.years.map((year) => `<th>${escapeHtml(year)}</th>`).join('')}</tr>`;
  const body = view.rows.map((row) => {
    const cells = view.years.map((year) => {
      const value = row.values[year];
      return value === null ? '<td>Missing</td>' : `<td>${escapeHtml(value)}</td>`;
    }).join('');
    return `<tr><th>${escapeHtml(row.figure)}</th>${cells}</tr>`;
  }).join('');
  const note = view.missingYears.length
    ? `<p>Missing means no record for this period in ${view.missingYears.map(escapeHtml).join(', ')} — never zero.</p>`
    : '';
  return `<table>${head}${body}</table>${note}`;
}

/** CSV for one comparison view (Missing cells marked plainly). */
export function yearComparisonCsv(view) {
  if (!view) return '';
  const lines = [[ 'Figure', ...view.years ].map(csvCell).join(',')];
  for (const row of view.rows) {
    lines.push([row.figure, ...view.years.map((year) => {
      const value = row.values[year];
      return value === null ? 'Missing' : value;
    })].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** Export filename for a comparison period. */
export function yearComparisonFilename(period) {
  const clean = validComparisonPeriod(period);
  return clean ? `year-comparison-${clean}.csv` : 'year-comparison.csv';
}
