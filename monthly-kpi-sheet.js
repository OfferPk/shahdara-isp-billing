// Plan 318 (Plan 203-350) — Monthly KPI record sheet.
//
// Monthly figures live scattered across separate reports, so the
// owner cannot compare one month with the next on the same
// measures. This module adds only the missing piece: one KPI
// record sheet per month — collections, new and exited customers,
// open faults, and dues outstanding — where every figure names
// the source report it was copied from. It records figures only
// and creates no new measure.
//
// What this module is NOT, stated plainly:
//   - It is not the annual summary (Plan 71), which covers a
//     whole year. That summary already exists and is neither
//     read nor rewritten here; a KPI sheet covers one month.
//   - It is not the monthly business review template (Plan
//     185), which is a review with notes and decisions. That
//     template already exists and is neither read nor rewritten
//     here; a KPI sheet holds figures only, no review text.
//   - It is not the multi-year comparison view (Plan 193),
//     which compares years. That view already exists and is
//     neither read nor rewritten here; a KPI sheet records one
//     month at a time and compares nothing by itself.
//   - It is not the monthly audit trail summary view (Plan
//     317), which counts operator actions only. That summary
//     already exists and is neither read nor rewritten here;
//     a KPI sheet counts collections, customers, faults, and
//     dues, never operator actions.
//   - It is not a device backup schedule record (Plan 316).
//     That record already exists and is neither read nor
//     rewritten here.
//   - It is not a bill, payment, or customer change.
//     Recording a sheet never changes any bill, payment,
//     customer, or source report by itself: the sheet only
//     copies figures that already exist in their reports.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     sheet and every source figure, and the module never
//     reads storage, the clock, or the network, and never
//     mutates an input.
//   - Every figure names its source report in plain words, and
//     a figure is accepted only as a whole number of at least
//     zero — whole rupees for money figures, whole counts for
//     the rest. A figure written as "Rs 1800", a negative, or
//     a fraction is refused, never repaired.
//   - A month with a missing source is marked incomplete, not
//     filled by guesswork: a figure with no source value stays
//     blank on the sheet and the sheet says which sources are
//     missing. Nothing is ever computed to stand in for a
//     missing figure.
//   - One sheet per month: a second sheet for a month already
//     recorded is refused and the first sheet stays.
//   - A sheet, once written, is never silently edited: there
//     is no edit function, only record, find, and remove; a
//     wrong sheet is removed and recorded again.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The five figures on every sheet, in sheet order. Each figure
 * names the source report it is copied from, so a reader can
 * always check it against that report. Money figures are whole
 * rupees; the rest are whole counts.
 */
export const MONTHLY_KPI_FIGURES = [
  { key: 'collections', label: 'Collections', source: 'Collections report', unit: 'PKR' },
  { key: 'newCustomers', label: 'New customers', source: 'New customers report', unit: 'customers' },
  { key: 'exitedCustomers', label: 'Exited customers', source: 'Exited customers report', unit: 'customers' },
  { key: 'openFaults', label: 'Open faults', source: 'Faults report', unit: 'faults' },
  { key: 'duesOutstanding', label: 'Dues outstanding', source: 'Dues report', unit: 'PKR' },
];

const FIGURE_KEYS = MONTHLY_KPI_FIGURES.map((figure) => figure.key);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** A month in YYYY-MM form with a real month number, or false. */
export function validMonthlyKpiMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return Boolean(match);
}

/** Plain-words label for a month, for example "November 2026"; empty for a bad month. */
export function monthlyKpiMonthLabel(month) {
  if (!validMonthlyKpiMonth(month)) return '';
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

/**
 * One figure value: a whole number of at least zero, given as an
 * integer or a plain digit string. A blank or missing value reads
 * as null, meaning the source report was not available — it is
 * never filled by guesswork. Anything else (a negative, a
 * fraction, a "Rs 1800"-style string, or any other text) is
 * invalid and reads as undefined, so the caller can refuse it.
 */
export function normalizeMonthlyKpiFigure(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
  }
  return undefined;
}

/** The figure definition for one key, or null for an unknown key. */
export function monthlyKpiFigureDef(key) {
  return MONTHLY_KPI_FIGURES.find((figure) => figure.key === key) ?? null;
}

/**
 * One sheet reduced to its stored shape — id, month, recorder,
 * and the five figures (a whole number, or null when that source
 * was missing) — or null when the sheet is refused: no id, no
 * valid month, no recorder in plain words, every figure missing,
 * or any figure invalid. Unknown fields are dropped, so a sheet
 * can never grow a bill, payment, or customer field.
 */
export function normalizeMonthlyKpiSheet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const month = text(raw.month);
  const recordedBy = text(raw.recordedBy);
  if (!id || !validMonthlyKpiMonth(month) || !recordedBy) return null;
  const figures = {};
  let present = 0;
  const source = raw.figures && typeof raw.figures === 'object' ? raw.figures : {};
  for (const key of FIGURE_KEYS) {
    const value = normalizeMonthlyKpiFigure(source[key]);
    if (value === undefined) return null;
    figures[key] = value;
    if (value !== null) present += 1;
  }
  if (present === 0) return null;
  return { id, month, recordedBy, figures };
}

/** A list of sheets reduced to stored shape; refused sheets are dropped, never repaired. */
export function normalizeMonthlyKpiSheetList(list) {
  if (!Array.isArray(list)) return [];
  const clean = [];
  for (const raw of list) {
    const sheet = normalizeMonthlyKpiSheet(raw);
    if (sheet && !clean.some((kept) => kept.month === sheet.month || kept.id === sheet.id)) {
      clean.push(sheet);
    }
  }
  return clean;
}

/** The sheet for one month, or null when no sheet is recorded for it. */
export function findMonthlyKpiSheet(list, month) {
  if (!validMonthlyKpiMonth(month)) return null;
  const clean = normalizeMonthlyKpiSheetList(list);
  return clean.find((sheet) => sheet.month === month) ?? null;
}

/**
 * Record one sheet: the list is returned unchanged when the
 * sheet is refused, and a second sheet for a month already
 * recorded is refused so the first sheet stays. Recording never
 * changes any other sheet, bill, payment, customer, or report.
 */
export function recordMonthlyKpiSheet(list, raw) {
  const clean = normalizeMonthlyKpiSheetList(list);
  const sheet = normalizeMonthlyKpiSheet(raw);
  if (!sheet) return clean;
  if (clean.some((kept) => kept.month === sheet.month || kept.id === sheet.id)) return clean;
  return [...clean, sheet];
}

/** Remove one sheet by id; removing an unknown id changes nothing. */
export function removeMonthlyKpiSheet(list, id) {
  const clean = normalizeMonthlyKpiSheetList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((sheet) => sheet.id !== wanted);
}

/** Sheets earliest month first; the input list is never changed. */
export function monthlyKpiSheetsSorted(list) {
  return normalizeMonthlyKpiSheetList(list).sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

/** Months that have a recorded sheet, earliest first. */
export function monthlyKpiSheetMonths(list) {
  return monthlyKpiSheetsSorted(list).map((sheet) => sheet.month);
}

/** True when every figure on the sheet has a value — no source missing. */
export function monthlyKpiSheetComplete(sheet) {
  const clean = normalizeMonthlyKpiSheet(sheet);
  if (!clean) return false;
  return FIGURE_KEYS.every((key) => clean.figures[key] !== null);
}

/** The figures whose source was missing, each with its label and source report name. */
export function monthlyKpiSheetMissingSources(sheet) {
  const clean = normalizeMonthlyKpiSheet(sheet);
  if (!clean) return [];
  return MONTHLY_KPI_FIGURES
    .filter((figure) => clean.figures[figure.key] === null)
    .map((figure) => ({ key: figure.key, label: figure.label, source: figure.source }));
}

/**
 * Whether a sheet matches its source reports on the same
 * fixture: every figure the sheet carries equals the matching
 * figure the caller supplies from that source report. A figure
 * the sheet marks missing is not checked — it was never filled —
 * and a supplied source value that is not a whole number of at
 * least zero cannot match. False for a missing or refused sheet.
 */
export function monthlyKpiSheetMatches(sources, sheet) {
  const clean = normalizeMonthlyKpiSheet(sheet);
  if (!clean) return false;
  if (!sources || typeof sources !== 'object') return false;
  for (const key of FIGURE_KEYS) {
    const onSheet = clean.figures[key];
    if (onSheet === null) continue;
    if (normalizeMonthlyKpiFigure(sources[key]) !== onSheet) return false;
  }
  return true;
}

/** Plain-words summary of all recorded sheets: how many, how many complete, how many incomplete. */
export function monthlyKpiSheetSummaryText(list) {
  const clean = monthlyKpiSheetsSorted(list);
  if (clean.length === 0) return 'No monthly KPI sheets recorded.';
  const complete = clean.filter((sheet) => monthlyKpiSheetComplete(sheet)).length;
  const incomplete = clean.length - complete;
  const sheetWord = clean.length === 1 ? 'sheet' : 'sheets';
  return `${clean.length} monthly KPI ${sheetWord} recorded: ${complete} complete, ${incomplete} incomplete.`;
}

/** One sheet in plain words: the month, each figure with its source report, and complete or incomplete. */
export function monthlyKpiSheetEntryText(sheet) {
  const clean = normalizeMonthlyKpiSheet(sheet);
  if (!clean) return 'No monthly KPI sheet.';
  const label = monthlyKpiMonthLabel(clean.month);
  const parts = MONTHLY_KPI_FIGURES.map((figure) => {
    const value = clean.figures[figure.key];
    if (value === null) return `${figure.label} (${figure.source}): not recorded, source missing`;
    const shown = figure.unit === 'PKR' ? `Rs ${value}` : `${value} ${figure.unit}`;
    return `${figure.label} (${figure.source}): ${shown}`;
  });
  const state = monthlyKpiSheetComplete(clean) ? 'Complete' : 'Incomplete';
  return `${label} — ${state}. Recorded by ${clean.recordedBy}. ${parts.join('; ')}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * One sheet as a table: every figure on its own row with the
 * source report it was copied from. A missing figure reads
 * "Not recorded — source missing", never a guessed number.
 */
export function monthlyKpiSheetEntryHtml(sheet) {
  const clean = normalizeMonthlyKpiSheet(sheet);
  if (!clean) return '<p>No monthly KPI sheet.</p>';
  const label = monthlyKpiMonthLabel(clean.month);
  const state = monthlyKpiSheetComplete(clean) ? 'Complete' : 'Incomplete — a source is missing';
  const rows = MONTHLY_KPI_FIGURES.map((figure) => {
    const value = clean.figures[figure.key];
    const shown = value === null
      ? 'Not recorded — source missing'
      : figure.unit === 'PKR' ? `Rs ${value}` : `${value} ${figure.unit}`;
    return `<tr><td>${escapeHtml(figure.label)}</td><td>${escapeHtml(figure.source)}</td><td>${escapeHtml(shown)}</td></tr>`;
  }).join('');
  return `<h4>${escapeHtml(label)} — ${escapeHtml(state)}</h4>`
    + `<p>Recorded by ${escapeHtml(clean.recordedBy)}.</p>`
    + `<table class="audit-log-table"><thead><tr><th>Figure</th><th>Source report</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** All recorded sheets, earliest month first, each with its figures and source reports. */
export function monthlyKpiSheetAllHtml(list) {
  const clean = monthlyKpiSheetsSorted(list);
  if (clean.length === 0) return '<p>No monthly KPI sheets recorded.</p>';
  return clean.map((sheet) => monthlyKpiSheetEntryHtml(sheet)).join('');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** All sheets as CSV: one row per figure, with the source report named on every row. */
export function monthlyKpiSheetCsv(list) {
  const lines = ['month,figure,source_report,value,recorded_by,complete'];
  for (const sheet of monthlyKpiSheetsSorted(list)) {
    const complete = monthlyKpiSheetComplete(sheet) ? 'yes' : 'no';
    for (const figure of MONTHLY_KPI_FIGURES) {
      const value = sheet.figures[figure.key];
      lines.push([sheet.month, figure.label, figure.source, value === null ? '' : value, sheet.recordedBy, complete].map(csvCell).join(','));
    }
  }
  return lines.join('\n');
}

/** Fixed filename for the monthly KPI sheets CSV. */
export function monthlyKpiSheetFilename() {
  return 'monthly-kpi-sheets.csv';
}
