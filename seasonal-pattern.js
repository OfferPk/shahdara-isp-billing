// Plan 203 (Plan 203-350) — Seasonal collection pattern note per mohalla.
//
// Collection is slower in some seasons (for example winter, when
// field visits are harder, or harvest months, when cash timing
// shifts), but that pattern lives only in the collector's memory,
// so monthly targets and route plans ignore it. This module is
// that note in writing: one seasonal pattern note per mohalla per
// season, with the expected slow or busy period, a plain-words
// reason, and the months affected, so collection rounds can be
// planned around known slow months instead of being surprised
// by them.
//
// Scope fence, stated plainly:
//   - This is a planning note only. It is NOT a discount rule
//     (Plan 98), NOT a campaign planner (Plan 30), and NOT a
//     field risk note (Plan 159): seasonal-risk.js records a
//     risk and a preparedness action for a season and an area,
//     campaign-planner.js plans campaigns, and neither of them
//     is read or written here. This module records only what
//     collection pattern to expect, in which months, and why.
//   - A note never changes any price, discount, due date, bill,
//     or payment by itself. It changes no other record at all.
//   - It is import-free: the caller supplies every note and the
//     module never reads storage, the clock, or the network,
//     never imports another module, and never mutates an input.
//   - One note per mohalla per season: a second note for the
//     same mohalla and season (case-insensitive) is refused,
//     and a duplicate id is never rewritten. There is no edit
//     function; the only later change is removal of the note.
//   - Half-formed notes are refused outright: a note needs an
//     id, a mohalla, a season, a slow-or-busy pattern, a
//     plain-words reason, and at least one affected month.
//     A note with no mohalla or no months is refused, as is a
//     note with no season, no pattern, or no reason. Unknown
//     fields are dropped, so no price, discount, or billing
//     field can creep into a planning note.
//   - Months are whole numbers 1-12 only; anything else is
//     dropped, and a note left with no valid month is refused.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function cleanMonths(value) {
  if (!Array.isArray(value)) return [];
  const months = new Set();
  for (const item of value) {
    const n = typeof item === 'number' ? item : (typeof item === 'string' && item.trim() !== '' ? Number(item.trim()) : NaN);
    if (Number.isInteger(n) && n >= 1 && n <= 12) months.add(n);
  }
  return [...months].sort((a, b) => a - b);
}

/** Month number (1-12) to its name, or '' for anything else. */
export function seasonalPatternMonthName(month) {
  const n = typeof month === 'number' ? month : Number(month);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? MONTH_NAMES[n - 1] : '';
}

/** Normalize one seasonal pattern note, or null when half-formed. */
export function normalizeSeasonalPattern(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const mohalla = cleanText(record.mohalla);
  const season = cleanText(record.season);
  const pattern = cleanText(record.pattern).toLowerCase();
  const reason = cleanText(record.reason);
  const months = cleanMonths(record.months);
  if (!id || !mohalla || !season || (pattern !== 'slow' && pattern !== 'busy') || !reason || months.length === 0) return null;
  return { id, mohalla, season, pattern, reason, months };
}

/** Normalize a list: half-formed notes dropped, first of a duplicate id or mohalla+season kept, order kept. */
export function normalizeSeasonalPatternList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenPairs = new Set();
  const out = [];
  for (const record of list) {
    const clean = normalizeSeasonalPattern(record);
    if (!clean) continue;
    const pair = `${clean.mohalla.toLowerCase()}|${clean.season.toLowerCase()}`;
    if (seenIds.has(clean.id) || seenPairs.has(pair)) continue;
    seenIds.add(clean.id);
    seenPairs.add(pair);
    out.push(clean);
  }
  return out;
}

/** Find one seasonal pattern note by id, or null. */
export function findSeasonalPattern(list, id) {
  const want = cleanText(id);
  if (!want) return null;
  return normalizeSeasonalPatternList(list).find((item) => item.id === want) || null;
}

/**
 * Record a seasonal pattern note, or leave the list unchanged when
 * the note is half-formed, its id already exists, or its mohalla
 * already has a note for that season. An identical re-save leaves
 * the list unchanged.
 */
export function recordSeasonalPattern(list, record) {
  const clean = normalizeSeasonalPatternList(list);
  const next = normalizeSeasonalPattern(record);
  if (!next) return clean;
  const pair = `${next.mohalla.toLowerCase()}|${next.season.toLowerCase()}`;
  if (clean.some((item) => item.id === next.id)) return clean;
  if (clean.some((item) => `${item.mohalla.toLowerCase()}|${item.season.toLowerCase()}` === pair)) return clean;
  return [...clean, next];
}

/** Remove a seasonal pattern note by id; unknown ids leave the list unchanged. */
export function removeSeasonalPattern(list, id) {
  const want = cleanText(id);
  if (!want) return normalizeSeasonalPatternList(list);
  return normalizeSeasonalPatternList(list).filter((item) => item.id !== want);
}

/** All notes sorted: mohalla A-Z (case-insensitive), then season A-Z, then id A-Z. */
export function seasonalPatternsSorted(list) {
  return normalizeSeasonalPatternList(list).sort((a, b) =>
    compareText(a.mohalla.toLowerCase(), b.mohalla.toLowerCase())
    || compareText(a.season.toLowerCase(), b.season.toLowerCase())
    || compareText(a.id, b.id));
}

/** Notes for one mohalla (case-insensitive substring), season A-Z, then id A-Z. */
export function seasonalPatternsForMohalla(list, mohalla) {
  const want = cleanText(mohalla).toLowerCase();
  const clean = seasonalPatternsSorted(list);
  if (!want) return clean;
  return clean.filter((item) => item.mohalla.toLowerCase().includes(want));
}

/** Notes affecting one month (1-12): the mohalla planning view for that month. Months outside 1-12 give []. */
export function seasonalPatternsForMonth(list, month) {
  const n = typeof month === 'number' ? month : Number(month);
  if (!Number.isInteger(n) || n < 1 || n > 12) return [];
  return seasonalPatternsSorted(list).filter((item) => item.months.includes(n));
}

/** Notes for one season (case-insensitive), mohalla A-Z, then id A-Z. */
export function seasonalPatternsForSeason(list, season) {
  const want = cleanText(season).toLowerCase();
  if (!want) return [];
  return seasonalPatternsSorted(list).filter((item) => item.season.toLowerCase() === want);
}

/** Every mohalla with a note, A-Z by lowercase spelling, first spelling kept. */
export function seasonalPatternMohallas(list) {
  const byLower = new Map();
  for (const item of normalizeSeasonalPatternList(list)) {
    const key = item.mohalla.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, item.mohalla);
  }
  return [...byLower.values()].sort((a, b) => compareText(a.toLowerCase(), b.toLowerCase()));
}

/** Summary text: notes / mohallas / seasons counts. */
export function seasonalPatternSummaryText(list) {
  const clean = normalizeSeasonalPatternList(list);
  if (clean.length === 0) return 'No seasonal collection pattern notes recorded.';
  const mohallas = seasonalPatternMohallas(list).length;
  const seasons = new Set(clean.map((item) => item.season.toLowerCase())).size;
  return `${clean.length} seasonal collection pattern note${clean.length === 1 ? '' : 's'} across ${mohallas} mohalla${mohallas === 1 ? '' : 's'} and ${seasons} season${seasons === 1 ? '' : 's'}.`;
}

/** One note as plain text: mohalla, season, slow/busy, months, reason. */
export function seasonalPatternText(note) {
  const clean = normalizeSeasonalPattern(note);
  if (!clean) return '';
  const months = clean.months.map((m) => seasonalPatternMonthName(m)).join(', ');
  const reason = clean.reason ? ` — ${clean.reason}` : ' — No reason recorded.';
  return `${clean.mohalla} · ${clean.season}: expect ${clean.pattern} collection in ${months}${reason}`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function seasonalPatternRowHtml(item) {
  const months = item.months.map((m) => seasonalPatternMonthName(m)).join(', ');
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.mohalla)}</td><td>${esc(item.season)}</td>`
    + `<td>${esc(item.pattern)}</td><td>${esc(months)}</td><td>${esc(item.reason)}</td></tr>`;
}

function seasonalPatternTableHtml(rows, intro) {
  const body = rows.map((item) => seasonalPatternRowHtml(item)).join('');
  return `<p>${intro}</p>`
    + '<table><thead><tr><th>Id</th><th>Mohalla</th><th>Season</th>'
    + '<th>Expected pattern</th><th>Months</th><th>Reason</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

/** All seasonal pattern notes as HTML, mohalla A-Z, then season A-Z. */
export function seasonalPatternAllHtml(list) {
  const rows = seasonalPatternsSorted(list);
  if (rows.length === 0) return '<p>No seasonal collection pattern notes recorded yet.</p>';
  return seasonalPatternTableHtml(rows, 'All seasonal collection pattern notes, mohalla by mohalla. A note never changes any price, discount, due date, bill, or payment.');
}

/** One mohalla's planning view as HTML: its notes, season A-Z. */
export function seasonalPatternMohallaHtml(list, mohalla) {
  const rows = seasonalPatternsForMohalla(list, mohalla);
  if (rows.length === 0) return '<p>No seasonal pattern notes recorded for this mohalla yet.</p>';
  return seasonalPatternTableHtml(rows, `Seasonal collection pattern notes for ${esc(mohalla)}.`);
}

/** One month's planning view as HTML: every note affecting that month, mohalla A-Z. */
export function seasonalPatternMonthHtml(list, month) {
  const rows = seasonalPatternsForMonth(list, month);
  if (rows.length === 0) return '<p>No seasonal pattern notes affect this month yet.</p>';
  return seasonalPatternTableHtml(rows, `Seasonal collection pattern notes affecting ${esc(seasonalPatternMonthName(month))}.`);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** All seasonal pattern notes as CSV text (months as semicolon-joined numbers). */
export function seasonalPatternCsv(list) {
  const rows = seasonalPatternsSorted(list);
  const lines = ['id,mohalla,season,pattern,months,reason'];
  for (const item of rows) {
    lines.push([item.id, item.mohalla, item.season, item.pattern, item.months.join(';'), item.reason].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the seasonal pattern export. */
export function seasonalPatternFilename() {
  return 'seasonal-patterns.csv';
}
