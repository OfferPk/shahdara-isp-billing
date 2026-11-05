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
// Key normalisation matches Plan 7 exactly (trimmed, upper-cased,
// leading "MOHALLA " stripped, internal whitespace collapsed; blank
// maps to "UNASSIGNED" / "Unassigned"), so "Bani", "MOHALLA BANI" and
// a canonical key from the app all land on the same row. The module is
// import-free by design, like receivables-ageing.js itself.

export const MOHALLA_AGEING_BUCKETS = Object.freeze([
  Object.freeze({ key: 'current', label: 'Current' }),
  Object.freeze({ key: 'one', label: '1 month' }),
  Object.freeze({ key: 'two', label: '2 months' }),
  Object.freeze({ key: 'threePlus', label: '3+ months' }),
]);

export const MOHALLA_AGEING_BUCKET_KEYS = Object.freeze(
  MOHALLA_AGEING_BUCKETS.map((bucket) => bucket.key),
);

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
  return `Rs. ${num(value).toLocaleString('en-US')}`;
}

/**
 * Mohalla grouping key, identical to Plan 7's ageingMohallaKey:
 * trimmed, upper-cased, leading "MOHALLA " stripped, internal
 * whitespace collapsed. Blank input maps to "UNASSIGNED" so
 * unassigned dues are grouped, never dropped.
 */
export function mohallaAgeingKey(raw) {
  const text = str(raw).trim().replace(/\s+/g, ' ');
  if (!text) return 'UNASSIGNED';
  const upper = text.toUpperCase();
  return upper.startsWith('MOHALLA ') ? upper.slice('MOHALLA '.length) : upper;
}

export function mohallaAgeingLabel(raw) {
  const text = str(raw).trim().replace(/\s+/g, ' ');
  if (!text) return 'Unassigned';
  return text;
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

function compareRows(a, b) {
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
export function buildMohallaAgeing(view, mohallas) {
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
  rows.sort(compareRows);

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
export function mohallaAgeingSummaryText(summary) {
  if (!summary || !summary.valid) return '';
  const dues = summary.mohallasWithDues;
  const empty = summary.mohallasWithoutDues;
  const emptyPart = empty > 0 ? `; ${empty} mohalla${empty === 1 ? '' : 's'} with no dues` : '';
  return `${summary.mohallaCount} mohalla${summary.mohallaCount === 1 ? '' : 's'}, ${dues} with dues${emptyPart}. Business total ${formatAmount(summary.businessTotal)} as of ${summary.asOfMonth}.`;
}

/** Plain-words text for one row. */
export function mohallaAgeingRowText(row) {
  if (!row) return '';
  if (!row.hasDues) return `${row.label}: No dues.`;
  return `${row.label}: ${formatAmount(row.total)} outstanding — Current ${formatAmount(row.byBucket.current)}, 1 month ${formatAmount(row.byBucket.one)}, 2 months ${formatAmount(row.byBucket.two)}, 3+ months ${formatAmount(row.byBucket.threePlus)}${row.unaged > 0 ? `, bill month unreadable ${formatAmount(row.unaged)}` : ''}.`;
}

/** Printable HTML for a summary: one row per mohalla, totals row. */
export function mohallaAgeingHtml(summary) {
  if (!summary || !summary.valid) return '';
  const rows = summary.rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${formatAmount(row.byBucket.current)}</td><td>${formatAmount(row.byBucket.one)}</td><td>${formatAmount(row.byBucket.two)}</td><td>${formatAmount(row.byBucket.threePlus)}</td><td>${formatAmount(row.unaged)}</td><td>${formatAmount(row.total)}</td><td>${row.billCount}</td><td>${escapeHtml(row.note)}</td></tr>`).join('')
    || '<tr><td colspan="9">No mohallas recorded.</td></tr>';
  return `<p>Dues ageing note per mohalla, as of ${escapeHtml(summary.asOfMonth)}. Bill age only — the same Plan 7 ageing, grouped so each mohalla stands on its own. Read-only: it changes no bill, payment, or customer record. ${escapeHtml(mohallaAgeingSummaryText(summary))}</p>`
    + `<table><thead><tr><th>Mohalla</th><th>Current</th><th>1 month</th><th>2 months</th><th>3+ months</th><th>Bill month unreadable</th><th>Total</th><th>Bills</th><th>Note</th></tr></thead><tbody>${rows}</tbody>`
    + `<tfoot><tr><td>Business total</td><td colspan="5"></td><td>${formatAmount(summary.businessTotal)}</td><td></td><td>${summary.sumsMatch ? '' : 'Totals do not match the business total.'}</td></tr></tfoot></table>`;
}

/** CSV export: one row per mohalla, then the business total. */
export function mohallaAgeingCsv(summary) {
  if (!summary || !summary.valid) return '';
  const lines = ['mohalla,current,1 month,2 months,3+ months,bill month unreadable,total,bills,note'];
  for (const row of summary.rows) {
    lines.push([
      csvCell(row.label),
      csvCell(row.byBucket.current),
      csvCell(row.byBucket.one),
      csvCell(row.byBucket.two),
      csvCell(row.byBucket.threePlus),
      csvCell(row.unaged),
      csvCell(row.total),
      csvCell(row.billCount),
      csvCell(row.note),
    ].join(','));
  }
  lines.push(['Business total', '', '', '', '', '', csvCell(summary.businessTotal), '', ''].join(','));
  return lines.join('\n');
}

export function mohallaAgeingFilename(summary) {
  return `mohalla-ageing-${summary && summary.asOfMonth ? summary.asOfMonth : 'unknown'}.csv`;
}
