// Plan 439 — Quick Collect end-of-round totals on screen: during a
// collection round the collector never sees the round's running
// total, so the day's figure is only learned at settlement time.
// One live round total on the Quick Collect screen — the payments
// taken this round: count and total amount, updated after each save.
// It totals only: it settles nothing and never changes any bill,
// payment, digest, or settlement record.
//
// What already exists, and what this plan does NOT rebuild: the day
// total line already on the entry screen totals the whole day, and
// the owner digest and the collector settlement statement both
// already exist and are left alone. A round is shorter than a day:
// it starts when the Quick Collect sheet opens and ends when the
// sheet closes, so payments taken before this opening — an earlier
// round, or a payment taken at the shop — are not this round's.
// This module adds only the round total, derived from the payments
// already recorded on this device, so it needs no store of its own:
// a payment belongs to this round when the stamp the recorder put
// on it falls at or after the round start the caller supplies.
// A voided row is history, not a taking, so it counts for neither
// the count nor the total. A reversal (a negative payment) is a
// recorded transaction in this round, so it counts and nets into
// the total. A row with no usable stamp is never guessed into the
// round. Pure: the caller supplies the rows and the round start,
// and the module never reads storage, the clock, or the network,
// and never mutates an input.

/**
 * Whether the value is a finite epoch-millisecond instant. A null,
 * undefined, empty, boolean, or non-numeric value is "not a
 * number", never zero — a missing instant must never be read as
 * the start of time.
 */
export function isFiniteRoundInstant(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return false;
  const instant = Number(value);
  return Number.isFinite(instant);
}

/**
 * The epoch-millisecond instant a recorded-at stamp names, or null
 * when the stamp is missing, blank, or unparseable. The recorder
 * stamps payments with a UTC ISO stamp; a stamp that parses to
 * nothing is never guessed into a time.
 */
export function roundStampMs(stamp) {
  if (typeof stamp !== 'string' || stamp.trim() === '') return null;
  const parsed = Date.parse(stamp);
  return Number.isFinite(parsed) ? parsed : null;
}

// PKR in the plan modules' own shape: min-0 decimals, never more
// than two (PKR 3,000 · PKR 1,500.5). A null/undefined/empty/boolean
// figure is "not a number", never zero — a missing amount must never
// be printed as PKR 0.
export function formatRoundTotalsAmount(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `PKR ${formatter.format(amount)}`;
}

/**
 * This round's payment count and total amount from the transaction
 * rows the app already projects. Only rows whose recorded-at stamp
 * falls at or after roundStartMs count, and only when roundStartMs
 * is a finite instant; a voided row counts for neither the count
 * nor the total. Only finite amounts count toward the total, so a
 * missing amount never counts as zero — the row still counts as a
 * recorded payment in this round. Pure: the caller supplies the
 * rows and the round start, and the module never reads storage,
 * the clock, or the network, and never mutates an input.
 */
export function quickCollectRoundTotals(rows, roundStartMs) {
  const startedAtMs = isFiniteRoundInstant(roundStartMs) ? Number(roundStartMs) : null;
  if (startedAtMs === null || !Array.isArray(rows)) return { count: 0, total: 0, startedAtMs };
  let count = 0;
  let total = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (row.voided === true) continue;
    const recordedMs = roundStampMs(row.recordedAt);
    if (recordedMs === null || recordedMs < startedAtMs) continue;
    count += 1;
    const amount = Number(row.amount);
    if (Number.isFinite(amount)) total += amount;
  }
  return { count, total, startedAtMs };
}

/**
 * QC Modal Fix: the round segment of the picker's ONE compact
 * summary line — "Round: 3 · PKR 9,000", or "Round: 0" for an empty
 * round. The old sentence ("This round: 3 payments · PKR 9,000")
 * is gone: the banner shows Today + Round on a single line, so the
 * words have to be short — the count is the payments count, and the
 * figure is the round total, exactly as before, only shorter.
 */
export function quickCollectRoundTotalsText(totals) {
  const count = Number(totals?.count);
  const total = Number(totals?.total);
  if (!Number.isFinite(count) || count <= 0) return 'Round: 0';
  return `Round: ${count} · ${formatRoundTotalsAmount(Number.isFinite(total) ? total : 0)}`;
}
