// Plan 4 (Plan 1-100) — Cash denomination handover count.
//
// COUNTING ONLY. This module never changes a payment total, a
// handover expected figure, a handover counted figure, a variance,
// or a handover status. It answers one question — "what notes and
// coins were actually counted, and what do they add up to?" — so a
// day-end shortfall can be traced to a count instead of discovered
// late as a single unexplained total.
//
// How it relates to the existing handover (dashboard-daily-closing.js):
//   * recordCashHandover already computes expectedCash from the day's
//     cash receipts, countedCash from a single typed total, and
//     variance = counted - expected with status balanced / shortage /
//     surplus. None of that changes here.
//   * A denomination count is an AUDIT NOTE attached to that record:
//     it breaks the counted cash into notes and coins, sums to a
//     stated total, and is compared against the expected cash with
//     the difference shown. It never rewrites countedCash — if the
//     count total and the typed countedCash disagree, that mismatch
//     is reported (denominationCountMatchesCounted), not silently
//     "fixed" by overwriting either figure.
//   * The count is compared against the day's cash receipts figure
//     (expectedCash), not against the route sheet's "collected"
//     figure: the Plan S note in field-day-flow.js explains that the
//     two measure different things, and only the receipts figure is
//     the handover's expectation.
//
// The module is import-free by design (like route-sequencing.js,
// visit-outcomes.js and day-target.js), so the daily-closing module
// can use it without pulling in the app graph. It never mutates its
// inputs, never reads the clock, and never touches storage.
//
// Denominations are current Pakistani rupee notes and coins. The
// Rs. 10 note and the Rs. 10 coin are different physical pieces, so
// they are different rows (note-10 vs coin-10) and are never merged.

export const PKR_DENOMINATIONS = Object.freeze([
  { id: 'note-5000', value: 5000, kind: 'note', label: 'Rs. 5,000 note' },
  { id: 'note-1000', value: 1000, kind: 'note', label: 'Rs. 1,000 note' },
  { id: 'note-500', value: 500, kind: 'note', label: 'Rs. 500 note' },
  { id: 'note-100', value: 100, kind: 'note', label: 'Rs. 100 note' },
  { id: 'note-50', value: 50, kind: 'note', label: 'Rs. 50 note' },
  { id: 'note-20', value: 20, kind: 'note', label: 'Rs. 20 note' },
  { id: 'note-10', value: 10, kind: 'note', label: 'Rs. 10 note' },
  { id: 'coin-10', value: 10, kind: 'coin', label: 'Rs. 10 coin' },
  { id: 'coin-5', value: 5, kind: 'coin', label: 'Rs. 5 coin' },
  { id: 'coin-2', value: 2, kind: 'coin', label: 'Rs. 2 coin' },
  { id: 'coin-1', value: 1, kind: 'coin', label: 'Rs. 1 coin' },
]);

export const DENOMINATION_COUNT_STATUSES = Object.freeze({
  BALANCED: 'balanced',
  SHORTAGE: 'shortage',
  SURPLUS: 'surplus',
});

export const DENOMINATION_COUNT_STATUS_LABELS = Object.freeze({
  balanced: 'Balanced',
  shortage: 'Shortage',
  surplus: 'Surplus',
});

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

function formatAmount(value) {
  return `Rs. ${Math.round(num(value)).toLocaleString('en-US')}`;
}

export function denominationById(id) {
  return PKR_DENOMINATIONS.find((d) => d.id === id) || null;
}

// Normalises one raw count entry. A count is valid only as a
// non-negative whole number of physical pieces: a negative count,
// a fractional count (2.5 notes do not exist), or a non-numeric
// value is not coerced — it is counted as 0 and its denomination
// id is reported in `invalid`, so a mistyped count is visible
// instead of silently becoming a different count.
function normalizeCount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

// Accepts the shapes a caller may reasonably pass:
//   * an object mapping denomination id -> count, e.g.
//     { 'note-1000': 3, 'coin-5': 4 }
//   * an array of rows, e.g. [{ id: 'note-1000', count: 3 }]
//   * a previously built count sheet ({ rows: [...] }), so a stored
//     audit note can be re-read without re-typing it.
// Unknown denomination ids are ignored and reported in `invalid`;
// they never contribute to the total.
export function normalizeDenominationCounts(input) {
  const counts = {};
  const invalid = [];
  for (const d of PKR_DENOMINATIONS) counts[d.id] = 0;
  if (input == null || typeof input !== 'object') return { counts, invalid };

  const entries = [];
  if (Array.isArray(input)) {
    for (const row of input) {
      if (row && typeof row === 'object') {
        entries.push([row.id != null ? row.id : row.denomination, row.count]);
      }
    }
  } else if (Array.isArray(input.rows)) {
    for (const row of input.rows) {
      if (row && typeof row === 'object') {
        entries.push([row.id != null ? row.id : row.denomination, row.count]);
      }
    }
  } else {
    for (const [id, count] of Object.entries(input)) entries.push([id, count]);
  }

  for (const [id, raw] of entries) {
    if (!denominationById(id)) {
      if (id != null && String(id) !== '') invalid.push(String(id));
      continue;
    }
    const count = normalizeCount(raw);
    if (count === null) {
      invalid.push(String(id));
      continue;
    }
    counts[id] = count;
  }
  return { counts, invalid };
}

// Builds the count sheet: one row per denomination actually
// counted (count > 0), in largest-to-smallest order, plus the
// stated total. Rows for denominations with a zero count are
// omitted — a sheet lists what was counted, not what was not.
export function buildDenominationCount(input) {
  const { counts, invalid } = normalizeDenominationCounts(input);
  const rows = [];
  let total = 0;
  let pieces = 0;
  for (const d of PKR_DENOMINATIONS) {
    const count = counts[d.id];
    if (count > 0) {
      rows.push({
        id: d.id,
        value: d.value,
        kind: d.kind,
        label: d.label,
        count,
        amount: d.value * count,
      });
      total += d.value * count;
      pieces += count;
    }
  }
  return {
    rows,
    total,
    pieces,
    denominationsUsed: rows.length,
    isEmpty: rows.length === 0,
    invalid,
  };
}

// Compares a count sheet against the day's cash receipts figure
// (expectedCash, from calculateCollectorCashExpected). The status
// vocabulary matches recordCashHandover exactly — balanced when the
// difference is zero, shortage when counted is less, surplus when
// counted is more — so the two can never disagree on wording.
// The difference is shown signed, never hidden behind "balanced".
export function compareDenominationCount(input, expectedCash) {
  const sheet = buildDenominationCount(input);
  const expected = Math.round(num(expectedCash) * 100) / 100;
  const difference = Math.round((sheet.total - expected) * 100) / 100;
  const status = difference === 0
    ? DENOMINATION_COUNT_STATUSES.BALANCED
    : difference < 0
      ? DENOMINATION_COUNT_STATUSES.SHORTAGE
      : DENOMINATION_COUNT_STATUSES.SURPLUS;
  return {
    ...sheet,
    expectedCash: expected,
    countedTotal: sheet.total,
    difference,
    status,
    statusLabel: DENOMINATION_COUNT_STATUS_LABELS[status],
  };
}

// Does the count sheet's total agree with the handover's typed
// countedCash? A disagreement is reported, never resolved by
// overwriting either figure — see the module header.
export function denominationCountMatchesCounted(input, countedCash) {
  const sheet = buildDenominationCount(input);
  return sheet.total === Math.round(num(countedCash) * 100) / 100;
}

// Attaches a count sheet to a handover record as an audit note and
// returns a NEW record object: every other field (countedCash,
// expectedCash, variance, status, corrections, notes) is carried
// over untouched. Passing null/undefined attaches nothing and
// returns the record unchanged.
export function attachDenominationCountToHandover(handover, input) {
  if (!handover || typeof handover !== 'object' || input == null) return handover;
  return { ...handover, denominationCount: buildDenominationCount(input) };
}

// Plain-text summary, for the handover slip and for tests that
// should not depend on HTML markup. Amounts are formatted here,
// never recomputed, so the summary cannot drift from the sheet.
export function denominationCountSummaryText(input, expectedCash) {
  const comparison = expectedCash === undefined || expectedCash === null
    ? null
    : compareDenominationCount(input, expectedCash);
  const sheet = comparison || buildDenominationCount(input);
  const lines = sheet.rows.map(
    (row) => `${row.label} x ${row.count} = ${formatAmount(row.amount)}`,
  );
  lines.push(`Counted total: ${formatAmount(sheet.total)} (${sheet.pieces} piece${sheet.pieces === 1 ? '' : 's'})`);
  if (comparison) {
    const sign = comparison.difference > 0 ? '+' : '';
    lines.push(
      `Expected cash: ${formatAmount(comparison.expectedCash)} · ` +
      `difference: ${sign}${formatAmount(comparison.difference)} [${comparison.statusLabel.toUpperCase()}]`,
    );
  }
  if (sheet.invalid.length > 0) {
    lines.push(`Ignored entries: ${sheet.invalid.join(', ')}`);
  }
  return lines.join('\n');
}

// The count sheet, rendered from one sheet/comparison object.
// Amounts are formatted here, never recomputed, so the view cannot
// drift from the sheet the tests pin.
export function denominationCountHtml(input, expectedCash) {
  const comparison = expectedCash === undefined || expectedCash === null
    ? null
    : compareDenominationCount(input, expectedCash);
  const sheet = comparison || buildDenominationCount(input);
  const rowsHtml = sheet.rows.length > 0
    ? sheet.rows.map((row) =>
      `<div><span>${escapeHtml(row.label)}</span> <span>x ${row.count} = ${escapeHtml(formatAmount(row.amount))}</span></div>`,
    ).join('')
    : '<div>No denominations counted.</div>';
  const comparisonHtml = comparison
    ? `<div><strong>Expected cash:</strong> ${escapeHtml(formatAmount(comparison.expectedCash))}</div>` +
      `<div><strong>Difference:</strong> ${escapeHtml(formatAmount(comparison.difference))} (${escapeHtml(comparison.statusLabel)})</div>`
    : '';
  const invalidHtml = sheet.invalid.length > 0
    ? `<div class="denomination-count-note">Ignored entries: ${escapeHtml(sheet.invalid.join(', '))}</div>`
    : '';
  return `<div class="denomination-count-sheet" role="region" aria-label="Cash denomination count">` +
    rowsHtml +
    `<div><strong>Counted total:</strong> ${escapeHtml(formatAmount(sheet.total))}</div>` +
    comparisonHtml +
    invalidHtml +
    `</div>`;
}
