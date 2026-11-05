// Plan 268 (Plan 203-350) — Service visit feedback trend per mohalla.
//
// Visit feedback is collected per visit, but nobody can see whether one
// mohalla's service is trending better or worse over time. This module is
// the TREND VIEW for that question: one view per mohalla per period,
// composed from caller-supplied visit feedback rows only — a feedback
// count, a positive/negative split, and the common note themes in plain
// words. Counts in a trend always sum to that mohalla's feedback for the
// period on the same rows, and a mohalla with no feedback says so plainly.
//
// What this module is NOT, stated plainly:
//   - It is not the per-visit feedback record. That record holds one
//     entry per visit with a rating and a comment, and it is neither
//     read nor written here: the caller supplies every row, and this
//     module imports nothing.
//   - It is not the ticket note recorded at closure. That note rates a
//     resolved ticket, and it is neither read nor written here either.
//   - It is not a score. Counts are simple totals only — how many
//     satisfied, how many partly satisfied, how many not satisfied —
//     never a blended score, average, or percentage rating.
//   - It is not proof that a visit really helped. The view says what
//     the supplied rows say; the module verifies format and ordering,
//     not truth.
//   - Viewing a trend never changes any feedback, visit, bill, or
//     payment record. There is no record, edit, or remove function
//     here at all: this module only reads the rows it is given.
//
// How the module keeps those fences:
//   - It is pure and import-free: no storage, no clock, no network.
//   - A row is mohalla + strict date + one of the three fixed ratings
//     + an optional comment in plain words. Bad rows are dropped, never
//     guessed at, and the caller's list is never mutated.
//   - Positive means satisfied and negative means not satisfied; the
//     middle rating (partly satisfied) is counted on its own, so the
//     three counts always add up to the total exactly.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const FEEDBACK_TREND_RATINGS = ['satisfied', 'partly-satisfied', 'not-satisfied'];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
function strictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day > limit) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** True when value is a real calendar date in YYYY-MM-DD form. */
export function validFeedbackTrendDate(value) {
  return strictDate(value) !== null;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Rating from the fixed three only; space/underscore spellings fold to hyphens. */
function normalizeRating(value) {
  if (typeof value !== 'string') return null;
  const folded = value.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (folded === 'partly') return 'partly-satisfied';
  if (folded === 'not') return 'not-satisfied';
  return FEEDBACK_TREND_RATINGS.includes(folded) ? folded : null;
}

/** One trend row, or null when half-formed. Never mutates its input. */
export function normalizeFeedbackTrendRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const mohalla = text(row.mohalla);
  const date = strictDate(row.date);
  const rating = normalizeRating(row.rating);
  if (!mohalla || !date || !rating) return null;
  return { mohalla, date, rating, comment: text(row.comment) };
}

/** Normalised rows only; bad rows are dropped, order is kept. */
export function normalizeFeedbackTrendRows(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const row = normalizeFeedbackTrendRow(raw);
    if (row) out.push(row);
  }
  return out;
}

/** True when from/to are real dates with from on or before to. */
function validPeriod(from, to) {
  const a = strictDate(from);
  const b = strictDate(to);
  return a !== null && b !== null && a <= b;
}

/** Rows inside the inclusive period; a bad period gives no rows. */
export function feedbackTrendInPeriod(rows, from, to) {
  const list = normalizeFeedbackTrendRows(rows);
  if (!validPeriod(from, to)) return [];
  const a = strictDate(from);
  const b = strictDate(to);
  return list.filter((row) => row.date >= a && row.date <= b);
}

/** Common note themes: most frequent comments, first spelling kept. */
function commonThemes(rows, limit = 5) {
  const byKey = new Map();
  for (const row of rows) {
    if (!row.comment) continue;
    const key = row.comment.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { theme: row.comment, count: 0 });
    byKey.get(key).count += 1;
  }
  return [...byKey.values()]
    .sort((x, y) => y.count - x.count || (x.theme < y.theme ? -1 : x.theme > y.theme ? 1 : 0))
    .slice(0, limit);
}

/**
 * One mohalla's trend for a period, or null for a bad period or no mohalla.
 * Counts always sum to that mohalla's feedback for the period.
 */
export function feedbackTrendFor(rows, mohalla, from, to) {
  const name = text(mohalla);
  if (!name || !validPeriod(from, to)) return null;
  const a = strictDate(from);
  const b = strictDate(to);
  const scoped = normalizeFeedbackTrendRows(rows)
    .filter((row) => row.mohalla.toLowerCase() === name.toLowerCase() && row.date >= a && row.date <= b);
  const satisfied = scoped.filter((row) => row.rating === 'satisfied').length;
  const partlySatisfied = scoped.filter((row) => row.rating === 'partly-satisfied').length;
  const notSatisfied = scoped.filter((row) => row.rating === 'not-satisfied').length;
  return {
    mohalla: scoped.length ? scoped[0].mohalla : name,
    from: a,
    to: b,
    total: scoped.length,
    satisfied,
    partlySatisfied,
    notSatisfied,
    themes: commonThemes(scoped),
    hasFeedback: scoped.length > 0,
  };
}

/** One trend per mohalla present in the period, mohalla A-Z. Bad period gives []. */
export function feedbackTrendsByMohalla(rows, from, to) {
  const inPeriod = feedbackTrendInPeriod(rows, from, to);
  const names = new Map();
  for (const row of inPeriod) {
    const key = row.mohalla.toLowerCase();
    if (!names.has(key)) names.set(key, row.mohalla);
  }
  return [...names.values()]
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))
    .map((name) => feedbackTrendFor(rows, name, from, to));
}

/** Unique mohallas in the rows, first spelling kept, A-Z. */
export function feedbackTrendMohallas(rows) {
  const names = new Map();
  for (const row of normalizeFeedbackTrendRows(rows)) {
    const key = row.mohalla.toLowerCase();
    if (!names.has(key)) names.set(key, row.mohalla);
  }
  return [...names.values()]
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
}

function themeText(themes) {
  if (!themes.length) return '';
  return ` Most common notes: ${themes.map((t) => `\u201c${t.theme}\u201d \u00d7${t.count}`).join('; ')}.`;
}

/** Plain-words text for one trend; a mohalla with no feedback says so plainly. */
export function feedbackTrendText(trend) {
  if (!trend) return 'Give a mohalla and a real period to see its feedback trend.';
  if (!trend.hasFeedback) {
    return `No feedback recorded for ${trend.mohalla} from ${trend.from} to ${trend.to}.`;
  }
  const plural = trend.total === 1 ? 'feedback' : 'feedback';
  return `${trend.mohalla} \u2014 ${trend.from} to ${trend.to}: ${trend.total} ${plural} `
    + `(${trend.satisfied} satisfied, ${trend.partlySatisfied} partly satisfied, `
    + `${trend.notSatisfied} not satisfied).${themeText(trend.themes)}`;
}

/** Plain-words summary across mohallas for a period. */
export function feedbackTrendSummaryText(rows, from, to) {
  if (!validPeriod(from, to)) return 'Give a real period to summarise feedback trends.';
  const trends = feedbackTrendsByMohalla(rows, from, to);
  const total = trends.reduce((sum, t) => sum + t.total, 0);
  const satisfied = trends.reduce((sum, t) => sum + t.satisfied, 0);
  const partly = trends.reduce((sum, t) => sum + t.partlySatisfied, 0);
  const not = trends.reduce((sum, t) => sum + t.notSatisfied, 0);
  if (!total) return `No feedback recorded from ${strictDate(from)} to ${strictDate(to)}.`;
  const mohallaWord = trends.length === 1 ? 'mohalla' : 'mohallas';
  return `${trends.length} ${mohallaWord}, ${total} feedback in the period `
    + `(${satisfied} satisfied, ${partly} partly satisfied, ${not} not satisfied).`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escaped HTML for one trend. */
export function feedbackTrendHtml(trend) {
  if (!trend) return '<p>Give a mohalla and a real period to see its feedback trend.</p>';
  if (!trend.hasFeedback) {
    return `<p>No feedback recorded for ${escapeHtml(trend.mohalla)} from ${escapeHtml(trend.from)} to ${escapeHtml(trend.to)}.</p>`;
  }
  const themes = trend.themes.length
    ? `<p>Most common notes: ${trend.themes.map((t) => `${escapeHtml(t.theme)} \u00d7${t.count}`).join('; ')}</p>`
    : '';
  return `<div><p><strong>${escapeHtml(trend.mohalla)}</strong> \u2014 ${escapeHtml(trend.from)} to ${escapeHtml(trend.to)}</p>`
    + `<p>${trend.total} feedback (${trend.satisfied} satisfied, ${trend.partlySatisfied} partly satisfied, ${trend.notSatisfied} not satisfied)</p>`
    + `${themes}</div>`;
}

/** Escaped HTML for a list of trends. */
export function feedbackTrendsHtml(trends) {
  if (!Array.isArray(trends) || !trends.length) return '<p>No feedback trends to show for this period.</p>';
  return trends.map((trend) => feedbackTrendHtml(trend)).join('');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** CSV for a list of trends, one row per mohalla. */
export function feedbackTrendCsv(trends) {
  const lines = ['mohalla,from,to,total,satisfied,partly_satisfied,not_satisfied,top_theme,top_theme_count'];
  for (const trend of Array.isArray(trends) ? trends : []) {
    const top = trend.themes && trend.themes.length ? trend.themes[0] : null;
    lines.push([
      trend.mohalla, trend.from, trend.to, trend.total,
      trend.satisfied, trend.partlySatisfied, trend.notSatisfied,
      top ? top.theme : '', top ? top.count : '',
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function feedbackTrendFilename() {
  return 'feedback-trends.csv';
}
