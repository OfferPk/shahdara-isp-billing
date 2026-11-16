// Plan 213 (Plan 203-350) — Dues ageing note per mohalla.
//
// READ-ONLY summary grouped per mohalla. Plan 7 (receivables-ageing.js)
// already ages outstanding bills by bill month across the whole
// business and already lists per-mohalla totals for mohallas that HAVE
// outstanding bills — but a mohalla with no dues is simply absent from
// that list, so a mohalla whose dues are all ageing badly still hides
// inside the overall figure, and a mohalla with nothing outstanding
// never says so plainly. This module adds ONLY that missing piece: it
// takes a Plan 7 ageing view (duck-typed, never re-aged here) plus the
// list of known mohallas, and returns one row per mohalla — including
// every known mohalla with no dues, which says "No dues." plainly.
//
// It ages nothing itself: the age bands come straight from the Plan 7
// view, and a mohalla that appears in the view but is not in the known
// list is still included, because dropping it would break the sum to
// the business total. It changes no bill, payment, or customer record
// by itself, and it never reads or writes any store.
//
// Row shape:
//   { key, label, byBucket: { current, one, two, threePlus },
//     unaged, bandsTotal, total, billCount, hasDues, note }
// where total = bandsTotal + unaged exactly. `unaged` is the amount of
// bills whose bill month could not be read (Plan 7 counts those in the
// total but in no bucket); when it is 0, the four age bands sum exactly
// to the mohalla total, which is the acceptance on the usual fixture.
//
// Summary shape:
//   { valid, asOfMonth, rows, mohallaCount, mohallasWithDues,
//     mohallasWithoutDues, businessTotal, rowsTotal, sumsMatch,
//     bandsMatch }
// `sumsMatch` is true when every mohalla total sums to the business
// total on the same view; `bandsMatch` is true when every row's bands
// plus its unaged amount equals its total. Rows sort by mohalla label
// A-Z so any one of the 11 mohallas is found at a glance.
//
// Amounts are integer cents end-to-end (Sharafat 14, same as Plan 7):
// the view this module reads already carries cents, sums stay in
// cents, and only the display (formatAmount) rounds to whole rupees;
// the CSV writes exact decimal rupees (mohallaAgeingCsv).
//
// Key normalisation matches Plan 7 exactly (trimmed, upper-cased,
// leading "MOHALLA " stripped, internal whitespace collapsed; blank
// maps to "UNASSIGNED" / "Unassigned"), so "Bani", "MOHALLA BANI" and
// a canonical key from the app all land on the same row. Sharafat 88:
// the module now imports { t } from nav-language.js ONLY —
// nav-language.js itself imports nothing, so the module still pulls in
// no app graph and stays usable standalone; the import exists so the
// renderers can translate at render time while the data model
// (MOHALLA_AGEING_BUCKETS labels, row.note) stays English-canonical.

import { t } from './nav-language.js';

// Sharafat 88: bucket keys ('current'/'one'/'two'/'threePlus') map to the
// ageing_bucket_* dict keys at RENDER time only — 'threePlus' needs its
// 'three_plus' suffix here, not a model change.
const AGEING_BUCKET_DICT_SUFFIX = Object.freeze({ current: 'current', one: 'one', two: 'two', threePlus: 'three_plus' });
function ageingBucketLabel(bucketKey, lang = null) {
  return t(`ageing_bucket_${AGEING_BUCKET_DICT_SUFFIX[bucketKey] ?? bucketKey}`, lang);
}

// Sharafat 88: the CSV header is lowercase by convention
// ('mohalla,current,1 month,…' — pinned by the plan213 CSV test),
// while the per-row note keeps the sentence-case 'No dues.'.
// Lowercasing the first character is a no-op for Urdu script (no
// case), so the Urdu header shows exactly the translated bucket label.
function ageingCsvBucketLabel(bucketKey, lang = null) {
  const label = ageingBucketLabel(bucketKey, lang);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export const MOHALLA_AGEING_BUCKETS = Object.freeze([
  Object.freeze({ key: 'current', label: 'Current' }),
  Object.freeze({ key: 'one', label: '1 month' }),
  Object.freeze({ key: 'two', label: '2 months' }),
  Object.freeze({ key: 'threePlus', label: '3+ months' }),
]);

export const MOHALLA_AGEING_BUCKET_KEYS = Object.freeze(
  MOHALLA_AGEING_BUCKETS.map((bucket) => bucket.key),
);

// Sharafat 14: amounts are integer cents — Math.round here is only
// the guard against non-integer input, never a rupee rounding.
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function str(value) {
  return value == null ? '' : String(value);
}

function escapeHtml(value) {
  return str(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const text = str(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatAmount(value) {
  // Sharafat 14: value is integer cents — round to whole rupees ONLY
  // at display, so 150050 cents prints "Rs. 1,501", never "Rs. 150,050".
  return `Rs. ${Math.round(num(value) / 100).toLocaleString('en-US')}`;
}

// Sharafat 14 (parent decision 2026-11-13): the CSV writes exact
// decimal rupees — 150050 cents is "1500.50", never "150050" (cents
// in a CSV would be misread as rupees). Two decimals always, so the
// rows and the business-total line reconcile to the paisa.
function formatCsvAmount(cents) {
  return (num(cents) / 100).toFixed(2);
}

/**
 * Mohalla grouping key, identical to Plan 7's ageingMohallaKey:
 * trimmed, upper-cased, leading "MOHALLA " stripped, internal
 * whitespace collapsed. Blank input maps to "UNASSIGNED" so
 * unassigned dues are grouped, never dropped. Owner-confirmed
 * 2026-11-11: JABBIYAAA is the same mohalla as JABBIYAA, so it
 * folds to the same key. Charyaa is its own mohalla and never
 * folds to Chamyaa.
 */
export function mohallaAgeingKey(raw) {
  const text = str(raw).trim().replace(/\s+/g, ' ');
  if (!text) return 'UNASSIGNED';
  const upper = text.toUpperCase();
  const stripped = upper.startsWith('MOHALLA ') ? upper.slice('MOHALLA '.length) : upper;
  return stripped === 'JABBIYAAA' ? 'JABBIYAA' : stripped;
}

export function mohallaAgeingLabel(raw, lang = null) {
  const text = str(raw).trim().replace(/\s+/g, ' ');
  if (!text) return t('ageing_unassigned', lang);
  // Owner 5-part fix: display label in consistent Title Case, so a
  // stored 'CHARYAA' and a stored 'Charyaa' read the same; the folded
  // JABBIYAAA spelling reads as its canonical 'Jabbiyaa'.
  if (mohallaAgeingKey(raw) === 'JABBIYAA') return 'Jabbiyaa';
  return text.split(' ').map((word) => {
    const chars = Array.from(word);
    if (!chars.length) return word;
    // Same rule as phase3's readableLabel: a 2–3-letter all-caps
    // word (an acronym or a short label such as 'X<Y') keeps its
    // own casing instead of being forced to Title Case.
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  }).join(' ');
}

function emptySummary(valid, asOfMonth) {
  return {
    valid,
    asOfMonth: str(asOfMonth).trim(),
    rows: [],
    mohallaCount: 0,
    mohallasWithDues: 0,
    mohallasWithoutDues: 0,
    businessTotal: 0,
    rowsTotal: 0,
    sumsMatch: true,
    bandsMatch: true,
  };
}

// Mohalla Numbering: rows read in the caller's mohalla order when
// given (the app passes the numbered order), otherwise label A–Z —
// the order is supplied, never copied here (the module's only import
// is nav-language.js, which carries no mohalla order).
function compareRows(a, b, compareAreas = null) {
  if (typeof compareAreas === 'function') return compareAreas(a.label, b.label);
  return str(a.label).localeCompare(str(b.label));
}

/**
 * Build the per-mohalla ageing summary from a Plan 7 view.
 *
 * `view` is the object returned by buildReceivablesAgeing (valid flag,
 * asOfMonth, mohallaTotals with byBucket, unaged list, totalOutstanding).
 * `mohallas` is the list of known mohalla names (raw strings, or
 * { key, label } pairs when the caller already resolved them through
 * canonicalMohalla). A known mohalla with no dues gets a zero row whose
 * note says "No dues." — never silence.
 *
 * Returns the summary shape documented above. `valid` is false (and
 * every total is 0) when the view is missing or invalid; the caller
 * must not render an invalid summary.
 */
export function buildMohallaAgeing(view, mohallas, compareAreas = null) {
  if (!view || !view.valid) return emptySummary(false, view ? view.asOfMonth : '');
  const asOfMonth = str(view.asOfMonth).trim();
  const rowsByKey = new Map();

  const ensureRow = (key, label) => {
    let row = rowsByKey.get(key);
    if (!row) {
      row = {
        key,
        label,
        byBucket: { current: 0, one: 0, two: 0, threePlus: 0 },
        unaged: 0,
        bandsTotal: 0,
        total: 0,
        billCount: 0,
        hasDues: false,
        note: '',
      };
      rowsByKey.set(key, row);
    }
    return row;
  };

  for (const known of Array.isArray(mohallas) ? mohallas : []) {
    if (known == null) continue;
    const key = str(known.key) || mohallaAgeingKey(known);
    const label = str(known.label) || mohallaAgeingLabel(known);
    ensureRow(key, label);
  }

  for (const item of Array.isArray(view.mohallaTotals) ? view.mohallaTotals : []) {
    if (!item) continue;
    const key = str(item.key) || mohallaAgeingKey(item.label);
    const row = ensureRow(key, str(item.label) || mohallaAgeingLabel(item.key));
    for (const bucketKey of MOHALLA_AGEING_BUCKET_KEYS) {
      row.byBucket[bucketKey] += num(item.byBucket ? item.byBucket[bucketKey] : 0);
    }
    row.total += num(item.total);
    row.billCount += num(item.billCount);
  }

  for (const item of Array.isArray(view.unaged) ? view.unaged : []) {
    if (!item) continue;
    const key = str(item.mohallaKey) || mohallaAgeingKey(item.mohallaLabel);
    const row = ensureRow(key, str(item.mohallaLabel) || mohallaAgeingLabel(item.mohallaKey));
    row.unaged += num(item.amount);
  }

  const rows = [...rowsByKey.values()];
  let rowsTotal = 0;
  let bandsMatch = true;
  for (const row of rows) {
    row.bandsTotal = MOHALLA_AGEING_BUCKET_KEYS.reduce((sum, key) => sum + row.byBucket[key], 0);
    // The Plan 7 mohalla total already includes unaged amounts, so
    // the row total is bands + unaged by construction; keep the
    // stored total only when it agrees, otherwise trust the parts.
    if (row.total !== row.bandsTotal + row.unaged) row.total = row.bandsTotal + row.unaged;
    if (row.bandsTotal + row.unaged !== row.total) bandsMatch = false;
    row.hasDues = row.total > 0;
    row.note = row.hasDues ? '' : 'No dues.';
    rowsTotal += row.total;
  }
  rows.sort((a, b) => compareRows(a, b, compareAreas));

  const businessTotal = num(view.totalOutstanding);
  return {
    valid: true,
    asOfMonth,
    rows,
    mohallaCount: rows.length,
    mohallasWithDues: rows.filter((row) => row.hasDues).length,
    mohallasWithoutDues: rows.filter((row) => !row.hasDues).length,
    businessTotal,
    rowsTotal,
    sumsMatch: rowsTotal === businessTotal,
    bandsMatch,
  };
}

/** One-line headline for a summary. */
export function mohallaAgeingSummaryText(summary, lang = null) {
  if (!summary || !summary.valid) return '';
  const dues = summary.mohallasWithDues;
  const empty = summary.mohallasWithoutDues;
  const params = {
    count: summary.mohallaCount,
    mohallaWord: t(summary.mohallaCount === 1 ? 'ageing_word_mohalla' : 'ageing_word_mohallas', lang),
    dues,
    total: formatAmount(summary.businessTotal),
    asOf: summary.asOfMonth,
  };
  if (empty > 0) {
    return t('ageing_summary_with_empty', lang, {
      ...params,
      empty,
      emptyWord: t(empty === 1 ? 'ageing_word_mohalla' : 'ageing_word_mohallas', lang),
    });
  }
  return t('ageing_summary_no_empty', lang, params);
}

/** Plain-words text for one row. */
export function mohallaAgeingRowText(row, lang = null) {
  if (!row) return '';
  if (!row.hasDues) return `${row.label}: ${t('ageing_no_dues', lang)}`;
  const unagedPart = row.unaged > 0 ? t('ageing_row_unaged_part', lang, { amount: formatAmount(row.unaged) }) : '';
  return t('ageing_row_with_dues', lang, {
    label: row.label,
    total: formatAmount(row.total),
    currentLabel: ageingBucketLabel('current', lang),
    current: formatAmount(row.byBucket.current),
    oneLabel: ageingBucketLabel('one', lang),
    one: formatAmount(row.byBucket.one),
    twoLabel: ageingBucketLabel('two', lang),
    two: formatAmount(row.byBucket.two),
    threePlusLabel: ageingBucketLabel('threePlus', lang),
    threePlus: formatAmount(row.byBucket.threePlus),
    unagedPart,
  });
}

/** Printable HTML for a summary: one row per mohalla, totals row. */
export function mohallaAgeingHtml(summary, lang = null) {
  if (!summary || !summary.valid) return '';
  const rows = summary.rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${formatAmount(row.byBucket.current)}</td><td>${formatAmount(row.byBucket.one)}</td><td>${formatAmount(row.byBucket.two)}</td><td>${formatAmount(row.byBucket.threePlus)}</td><td>${formatAmount(row.unaged)}</td><td>${formatAmount(row.total)}</td><td>${row.billCount}</td><td>${escapeHtml(row.hasDues ? row.note : t('ageing_no_dues', lang))}</td></tr>`).join('')
    || `<tr><td colspan="9">${escapeHtml(t('ageing_empty_no_mohallas', lang))}</td></tr>`;
  return `<p>${escapeHtml(t('ageing_intro_mohalla', lang, { asOf: summary.asOfMonth, summary: mohallaAgeingSummaryText(summary, lang) }))}</p>`
    // Owner 5-part fix: the nine-column table scrolls inside its own
    // card on a phone instead of clipping the right-side columns.
    + `<div class="table-scroll"><table><thead><tr><th>${escapeHtml(t('ageing_col_mohalla', lang))}</th><th>${escapeHtml(ageingBucketLabel('current', lang))}</th><th>${escapeHtml(ageingBucketLabel('one', lang))}</th><th>${escapeHtml(ageingBucketLabel('two', lang))}</th><th>${escapeHtml(ageingBucketLabel('threePlus', lang))}</th><th>${escapeHtml(t('ageing_col_bill_month_unreadable', lang))}</th><th>${escapeHtml(t('ageing_col_total', lang))}</th><th>${escapeHtml(t('ageing_col_bills', lang))}</th><th>${escapeHtml(t('ageing_col_note', lang))}</th></tr></thead><tbody>${rows}</tbody>`
    + `<tfoot><tr><td>${escapeHtml(t('ageing_business_total', lang))}</td><td colspan="5"></td><td>${formatAmount(summary.businessTotal)}</td><td></td><td>${summary.sumsMatch ? '' : escapeHtml(t('ageing_totals_mismatch', lang))}</td></tr></tfoot></table></div>`;
}

/** CSV export: one row per mohalla, then the business total. */
export function mohallaAgeingCsv(summary, lang = null) {
  if (!summary || !summary.valid) return '';
  const lines = [[t('ageing_csv_mohalla', lang), ageingCsvBucketLabel('current', lang), ageingCsvBucketLabel('one', lang), ageingCsvBucketLabel('two', lang), ageingCsvBucketLabel('threePlus', lang), t('ageing_csv_bill_month_unreadable', lang), t('ageing_csv_total', lang), t('ageing_csv_bills', lang), t('ageing_csv_note', lang)].join(',')];
  for (const row of summary.rows) {
    lines.push([
      csvCell(row.label),
      csvCell(formatCsvAmount(row.byBucket.current)),
      csvCell(formatCsvAmount(row.byBucket.one)),
      csvCell(formatCsvAmount(row.byBucket.two)),
      csvCell(formatCsvAmount(row.byBucket.threePlus)),
      csvCell(formatCsvAmount(row.unaged)),
      csvCell(formatCsvAmount(row.total)),
      csvCell(row.billCount),
      csvCell(row.hasDues ? row.note : t('ageing_no_dues', lang)),
    ].join(','));
  }
  lines.push([t('ageing_business_total', lang), '', '', '', '', '', csvCell(formatCsvAmount(summary.businessTotal)), '', ''].join(','));
  return lines.join('\n');
}

export function mohallaAgeingFilename(summary) {
  return `mohalla-ageing-${summary && summary.asOfMonth ? summary.asOfMonth : 'unknown'}.csv`;
}
