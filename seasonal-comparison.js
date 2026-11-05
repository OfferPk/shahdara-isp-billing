// Plan 320 (Plan 203-350) — Seasonal comparison view (read-only,
// composition only).
//
// Collections and faults vary by season, but yearly totals hide the
// pattern, so the same seasonal dip surprises the owner every year.
// This module closes that gap without a new reporting system: it
// takes the monthly figures the caller supplies — one record per
// month with collections in whole rupees, a fault count, and an exit
// count — and groups them by season (or by quarter) across years, so
// the same season can be lined up year after year.
//
// Seasons, stated plainly:
//   - Winter is December, January, February; Spring is March, April,
//     May; Summer is June, July, August; Autumn is September,
//     October, November.
//   - A winter belongs to the year of its January and February, so
//     December 2025 with January and February 2026 is one season,
//     labelled "Winter 2025-26". Quarters stay inside one calendar
//     year: Q1 is January to March, Q2 April to June, Q3 July to
//     September, Q4 October to December.
//
// Honesty rules, stated plainly rather than hidden:
//   - This module computes NO new kind of figure and makes NO
//     forecast: every total shown is the integer sum of monthly
//     figures the caller supplied. Nothing is projected, estimated,
//     or filled in from another season.
//   - A season with missing months is marked incomplete, and the
//     missing months are named — never shown as zero, never hidden.
//   - The view is READ-ONLY: building it is a pure function of its
//     input. It writes nothing, stores nothing, reads no storage,
//     clock, or network, and mutates no input — so using the view
//     never changes any bill, payment, or customer record. It holds
//     no record of its own; the monthly figures live in the caller's
//     store and are only read through the list the caller passes in.
//   - A change shown beside a season is the plain difference
//     against the SAME season in the previous year, in whole rupees
//     or whole counts. It is a comparison of two supplied seasons,
//     not a prediction of the next one.
//   - This is not the quarterly snapshot of Plan 329 (a snapshot of
//     one quarter on its own) and not the per-mohalla year view of
//     Plan 319 or the multi-year view of Plan 193: those views are
//     neither read nor written here, and none of their records is
//     touched. The caller supplies the monthly figures, and this
//     module only groups them.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SEASONS = [
  { season: 'Winter', months: [12, 1, 2] },
  { season: 'Spring', months: [3, 4, 5] },
  { season: 'Summer', months: [6, 7, 8] },
  { season: 'Autumn', months: [9, 10, 11] },
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
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[\",\n]/.test(str) ? `\"${str.replace(/\"/g, '\"\"')}\"` : str;
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

/** A valid month 'YYYY-MM', or '' when invalid. */
export function validSeasonalComparisonMonth(value) {
  const clean = text(value);
  return MONTH_RE.test(clean) ? clean : '';
}

/** Plain-words label for a month, for example "November 2026". */
export function seasonalComparisonMonthLabel(month) {
  const clean = validSeasonalComparisonMonth(month);
  if (!clean) return '';
  return `${MONTH_NAMES[monthNumber(clean) - 1]} ${yearNumber(clean)}`;
}

/**
 * A usable whole-number figure: a finite integer, or a digit string
 * for one. Whole rupees and whole counts only — money text such as
 * "Rs 1800", negatives, and fractions are refused (null).
 */
export function normalizeSeasonalMonthlyFigure(value) {
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

/** The grouping for the view: 'season' or 'quarter'; anything else reads as 'season'. */
export function normalizeSeasonalComparisonGrouping(value) {
  const raw = text(value).toLowerCase();
  if (raw === 'quarter' || raw === 'q') return 'quarter';
  return 'season';
}

/**
 * Which season a month belongs to, and the season year it belongs
 * to: December belongs to the winter of the following year, so
 * December 2025 is Winter with season year 2026.
 */
export function seasonForMonth(month) {
  const clean = validSeasonalComparisonMonth(month);
  if (!clean) return null;
  const num = monthNumber(clean);
  const year = yearNumber(clean);
  for (const entry of SEASONS) {
    if (!entry.months.includes(num)) continue;
    const seasonYear = entry.season === 'Winter' && num === 12 ? year + 1 : year;
    return { season: entry.season, seasonYear, months: [...entry.months] };
  }
  return null;
}

/** Which quarter a month belongs to, inside its own calendar year. */
export function quarterForMonth(month) {
  const clean = validSeasonalComparisonMonth(month);
  if (!clean) return null;
  const num = monthNumber(clean);
  const year = yearNumber(clean);
  for (const entry of QUARTERS) {
    if (!entry.months.includes(num)) continue;
    return { quarter: entry.quarter, quarterYear: year, months: [...entry.months] };
  }
  return null;
}

/** Label for one season bucket, for example "Winter 2025-26" or "Summer 2026". */
export function seasonalComparisonSeasonLabel(season, seasonYear) {
  const found = SEASONS.find((entry) => entry.season === season);
  if (!found || !Number.isInteger(seasonYear)) return '';
  if (season === 'Winter') return `Winter ${seasonYear - 1}-${String(seasonYear).slice(2)}`;
  return `${season} ${seasonYear}`;
}

/** Label for one quarter bucket, for example "Q1 2026". */
export function seasonalComparisonQuarterLabel(quarter, quarterYear) {
  const found = QUARTERS.find((entry) => entry.quarter === quarter);
  if (!found || !Number.isInteger(quarterYear)) return '';
  return `${quarter} ${quarterYear}`;
}

function emptyTotals() {
  return { collections: 0, faults: 0, exits: 0 };
}

function addTotals(into, figures) {
  into.collections += figures.collections;
  into.faults += figures.faults;
  into.exits += figures.exits;
  return into;
}

/**
 * Normalize one caller-supplied monthly figure record:
 * { id, month, figures: { collections, faults, exits } }.
 * Unknown fields are dropped. Returns null for a record with no
 * usable id, no valid month, or any missing or unusable figure.
 */
export function normalizeSeasonalMonthlyFigureRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const month = validSeasonalComparisonMonth(raw.month);
  if (!id || !month) return null;
  const source = raw.figures && typeof raw.figures === 'object' && !Array.isArray(raw.figures)
    ? raw.figures : {};
  const collections = normalizeSeasonalMonthlyFigure(source.collections);
  const faults = normalizeSeasonalMonthlyFigure(source.faults);
  const exits = normalizeSeasonalMonthlyFigure(source.exits);
  if (collections === null || faults === null || exits === null) return null;
  return { id, month, figures: { collections, faults, exits } };
}

/** Normalize a list of monthly figure records; unusable entries are dropped. */
export function normalizeSeasonalMonthlyFigureRecordList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const record = normalizeSeasonalMonthlyFigureRecord(raw);
    if (record) out.push(record);
  }
  return out;
}

/** Find one monthly figure record by id (exact match); null when absent. */
export function findSeasonalMonthlyFigureRecord(list, id) {
  const clean = text(id);
  if (!clean) return null;
  for (const record of normalizeSeasonalMonthlyFigureRecordList(list)) {
    if (record.id === clean) return record;
  }
  return null;
}

/**
 * Record one monthly figure record onto a list. The record is
 * refused when its id is already in use, when its month already has
 * a record, or when any field is missing or unusable. The input
 * list is never mutated; the new list is returned, or the original
 * list unchanged when the record is refused.
 */
export function recordSeasonalMonthlyFigure(list, raw) {
  const clean = normalizeSeasonalMonthlyFigureRecordList(list);
  const record = normalizeSeasonalMonthlyFigureRecord(raw);
  if (!record) return clean;
  if (clean.some((entry) => entry.id === record.id)) return clean;
  if (clean.some((entry) => entry.month === record.month)) return clean;
  return [...clean, record];
}

/**
 * Remove one monthly figure record by id. The input list is never
 * mutated; removing an unknown id returns the list unchanged.
 */
export function removeSeasonalMonthlyFigure(list, id) {
  const clean = normalizeSeasonalMonthlyFigureRecordList(list);
  const target = text(id);
  if (!target) return clean;
  return clean.filter((entry) => entry.id !== target);
}

/** Months supplied, sorted earliest first. */
export function seasonalComparisonMonths(list) {
  const clean = normalizeSeasonalMonthlyFigureRecordList(list);
  return clean.map((entry) => entry.month).sort();
}

function bucketKeySeason(month) {
  const info = seasonForMonth(month);
  return `${info.season}-${info.seasonYear}`;
}

function bucketKeyQuarter(month) {
  const info = quarterForMonth(month);
  return `${info.quarter}-${info.quarterYear}`;
}

function bucketMonthsSeason(season, seasonYear) {
  const entry = SEASONS.find((item) => item.season === season);
  return entry.months.map((num) => {
    const year = season === 'Winter' && num === 12 ? seasonYear - 1 : seasonYear;
    return `${year}-${String(num).padStart(2, '0')}`;
  });
}

function bucketMonthsQuarter(quarter, quarterYear) {
  const entry = QUARTERS.find((item) => item.quarter === quarter);
  return entry.months.map((num) => `${quarterYear}-${String(num).padStart(2, '0')}`);
}

/**
 * Build the seasonal comparison view from caller-supplied monthly
 * figures. Each group carries its months present, its missing
 * months, a complete flag (all three months present), integer
 * totals composed from the monthly figures, and — where the same
 * season or quarter exists in the previous year — the plain
 * difference against that previous year. The input list is never
 * mutated, and no bill, payment, or customer record is read or
 * changed: the view is composed only from the figures passed in.
 */
export function buildSeasonalComparison(list, grouping) {
  const mode = normalizeSeasonalComparisonGrouping(grouping);
  const clean = normalizeSeasonalMonthlyFigureRecordList(list);
  const byMonth = new Map(clean.map((entry) => [entry.month, entry.figures]));
  const buckets = new Map();
  for (const entry of clean) {
    const key = mode === 'quarter' ? bucketKeyQuarter(entry.month) : bucketKeySeason(entry.month);
    if (!buckets.has(key)) {
      if (mode === 'quarter') {
        const info = quarterForMonth(entry.month);
        buckets.set(key, {
          key,
          label: seasonalComparisonQuarterLabel(info.quarter, info.quarterYear),
          quarter: info.quarter,
          quarterYear: info.quarterYear,
          season: null,
          seasonYear: null,
          expectedMonths: bucketMonthsQuarter(info.quarter, info.quarterYear),
        });
      } else {
        const info = seasonForMonth(entry.month);
        buckets.set(key, {
          key,
          label: seasonalComparisonSeasonLabel(info.season, info.seasonYear),
          season: info.season,
          seasonYear: info.seasonYear,
          quarter: null,
          quarterYear: null,
          expectedMonths: bucketMonthsSeason(info.season, info.seasonYear),
        });
      }
    }
  }
  const groups = [...buckets.values()].map((bucket) => {
    const present = bucket.expectedMonths.filter((month) => byMonth.has(month));
    const missing = bucket.expectedMonths.filter((month) => !byMonth.has(month));
    const totals = emptyTotals();
    for (const month of present) addTotals(totals, byMonth.get(month));
    return {
      ...bucket,
      months: present,
      missingMonths: missing,
      complete: missing.length === 0,
      totals,
      previousTotals: null,
      change: null,
    };
  });
  groups.sort((a, b) => {
    const yearA = a.seasonYear ?? a.quarterYear;
    const yearB = b.seasonYear ?? b.quarterYear;
    if (yearA !== yearB) return yearA - yearB;
    const orderA = mode === 'quarter'
      ? QUARTERS.findIndex((item) => item.quarter === a.quarter)
      : SEASONS.findIndex((item) => item.season === a.season);
    const orderB = mode === 'quarter'
      ? QUARTERS.findIndex((item) => item.quarter === b.quarter)
      : SEASONS.findIndex((item) => item.season === b.season);
    return orderA - orderB;
  });
  for (const group of groups) {
    const year = group.seasonYear ?? group.quarterYear;
    const name = group.season ?? group.quarter;
    const previous = groups.find((other) => (other.season ?? other.quarter) === name
      && (other.seasonYear ?? other.quarterYear) === year - 1);
    if (!previous) continue;
    group.previousTotals = { ...previous.totals };
    group.change = {
      collections: group.totals.collections - previous.totals.collections,
      faults: group.totals.faults - previous.totals.faults,
      exits: group.totals.exits - previous.totals.exits,
    };
  }
  const totals = emptyTotals();
  for (const entry of clean) addTotals(totals, entry.figures);
  return { grouping: mode, groups, totals, monthsSupplied: clean.length };
}

/** Groups in the view whose season or quarter is missing months. */
export function seasonalComparisonIncomplete(view) {
  if (!view || !Array.isArray(view.groups)) return [];
  return view.groups.filter((group) => !group.complete);
}

/**
 * True when every total in the view reconciles to the monthly
 * figures it was composed from: the view totals equal the sum of
 * the supplied figures, and each group total equals the sum of its
 * own months. A view built from different figures does not
 * reconcile.
 */
export function seasonalComparisonReconciles(view, list) {
  if (!view || !Array.isArray(view.groups) || !view.totals) return false;
  const clean = normalizeSeasonalMonthlyFigureRecordList(list);
  const expected = emptyTotals();
  for (const entry of clean) addTotals(expected, entry.figures);
  if (view.totals.collections !== expected.collections
    || view.totals.faults !== expected.faults
    || view.totals.exits !== expected.exits) return false;
  const byMonth = new Map(clean.map((entry) => [entry.month, entry.figures]));
  for (const group of view.groups) {
    const groupExpected = emptyTotals();
    for (const month of group.months || []) {
      const figures = byMonth.get(month);
      if (!figures) return false;
      addTotals(groupExpected, figures);
    }
    if (group.totals.collections !== groupExpected.collections
      || group.totals.faults !== groupExpected.faults
      || group.totals.exits !== groupExpected.exits) return false;
  }
  return true;
}

function changeWords(change, unit) {
  if (change === 0) return 'same as last year';
  const direction = change > 0 ? 'up' : 'down';
  const amount = unit === 'Rs' ? money(Math.abs(change)) : String(Math.abs(change));
  return `${direction} ${amount} on last year`;
}

/** Plain-words line for one season or quarter group. */
export function seasonalComparisonGroupText(group) {
  if (!group || !group.label) return '';
  const parts = [
    `${group.label}: collections ${money(group.totals.collections)}, faults ${group.totals.faults}, exits ${group.totals.exits}`,
  ];
  if (group.complete) {
    parts.push('complete');
  } else {
    parts.push(`incomplete — missing ${(group.missingMonths || []).map(seasonalComparisonMonthLabel).join(', ')}`);
  }
  if (group.change) {
    parts.push(`collections ${changeWords(group.change.collections, 'Rs')}, faults ${changeWords(group.change.faults, '')}, exits ${changeWords(group.change.exits, '')}`);
  }
  return parts.join('; ');
}

/** Plain-words summary of the whole view. */
export function seasonalComparisonSummaryText(view) {
  if (!view || !Array.isArray(view.groups) || view.groups.length === 0) {
    return 'No seasonal figures yet.';
  }
  const incomplete = seasonalComparisonIncomplete(view);
  const base = `${view.groups.length} ${view.grouping === 'quarter' ? 'quarters' : 'seasons'} from ${view.monthsSupplied} months; collections ${money(view.totals.collections)}, faults ${view.totals.faults}, exits ${view.totals.exits}`;
  if (incomplete.length === 0) return `${base}; all complete.`;
  return `${base}; ${incomplete.length} incomplete (${incomplete.map((group) => group.label).join(', ')}).`;
}

/** Plain-words text for the whole view, one group per line. */
export function seasonalComparisonText(view) {
  if (!view || !Array.isArray(view.groups) || view.groups.length === 0) return 'No seasonal figures yet.';
  return view.groups.map(seasonalComparisonGroupText).join('\n');
}

function groupRowHtml(group) {
  const missing = group.complete
    ? 'Complete'
    : `Incomplete — missing ${(group.missingMonths || []).map(seasonalComparisonMonthLabel).join(', ')}`;
  const change = group.change
    ? `${group.change.collections >= 0 ? '+' : ''}${group.change.collections} Rs; ${group.change.faults >= 0 ? '+' : ''}${group.change.faults} faults; ${group.change.exits >= 0 ? '+' : ''}${group.change.exits} exits`
    : 'No previous year to compare';
  return `<tr><th>${escapeHtml(group.label)}</th><td>${escapeHtml(money(group.totals.collections))}</td><td>${escapeHtml(group.totals.faults)}</td><td>${escapeHtml(group.totals.exits)}</td><td>${escapeHtml(missing)}</td><td>${escapeHtml(change)}</td></tr>`;
}

/** HTML table for the whole view; missing months are named, never zeroed. */
export function seasonalComparisonAllHtml(view) {
  if (!view || !Array.isArray(view.groups) || view.groups.length === 0) {
    return '<p>No seasonal figures yet.</p>';
  }
  const heading = view.grouping === 'quarter' ? 'Quarter' : 'Season';
  return `<table><thead><tr><th>${heading}</th><th>Collections</th><th>Faults</th><th>Exits</th><th>Status</th><th>Change on same ${view.grouping === 'quarter' ? 'quarter' : 'season'} last year</th></tr></thead><tbody>${view.groups.map(groupRowHtml).join('')}</tbody></table><p>${escapeHtml(seasonalComparisonSummaryText(view))}</p>`;
}

/** HTML for one season or quarter group. */
export function seasonalComparisonGroupHtml(group) {
  if (!group || !group.label) return '<p>No seasonal figures yet.</p>';
  return `<p>${escapeHtml(seasonalComparisonGroupText(group))}</p>`;
}

/** CSV for the whole view, one row per season or quarter. */
export function seasonalComparisonCsv(view) {
  if (!view || !Array.isArray(view.groups)) return '';
  const heading = view.grouping === 'quarter' ? 'Quarter' : 'Season';
  const lines = [[heading, 'Collections (Rs)', 'Faults', 'Exits', 'Status', 'Missing months', 'Change collections (Rs)', 'Change faults', 'Change exits'].map(csvCell).join(',')];
  for (const group of view.groups) {
    lines.push([
      group.label,
      group.totals.collections,
      group.totals.faults,
      group.totals.exits,
      group.complete ? 'Complete' : 'Incomplete',
      (group.missingMonths || []).join('; '),
      group.change ? group.change.collections : '',
      group.change ? group.change.faults : '',
      group.change ? group.change.exits : '',
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the view. */
export function seasonalComparisonFilename() {
  return 'seasonal-comparison.csv';
}
