// Plan 119 (Plan 101-202) — Month-end cash-to-ledger reconciliation.
//
// At month end, cash in hand, cash deposited, and the ledger can
// disagree, and the month-end close checklist ticks boxes without
// proving the money itself reconciles. This module is the cash proof
// only: one record per month that sets the ledger cash total beside
// the cash actually counted, the cash deposited, and the cash still
// in hand. Counted plus deposited plus in-hand either equals the
// ledger total, or the difference is named in plain words and
// explained while it is still fresh.
//
// The fences, stated plainly:
//   - This record proves cash; it never replaces the close
//     checklist, the pre-close sweep, or the frozen month snapshot.
//     Those are named only by reference text the operator types
//     (a close record id, a snapshot id); none of them is opened,
//     read, or rewritten here, and agreement with them is checked
//     by comparing caller-supplied figures, never by editing
//     anything.
//   - A difference is never resolved by editing a payment. There
//     is no edit function, no remove function, and no payment,
//     bill, or total field anywhere in a record. A record with a
//     difference is locked only once an explanation is recorded;
//     a locked record can never be changed again, and there is
//     deliberately no unlock function.
//   - Money is integer cents throughout. A plain rupees figure
//     converts exactly once on the way in; a figure already in
//     cents passes through as-is. A difference of zero means the
//     month balanced; a nonzero difference is never zero-filled
//     away, and an unusable figure refuses the whole record
//     instead of being guessed.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Strict YYYY-MM-DD calendar date, or null (2026-02-30 is not a date). */
export function validCashReconDate(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const max = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > max) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Strict YYYY-MM month, or null. */
export function validCashReconMonth(value) {
  if (typeof value !== 'string') return null;
  const m = MONTH_RE.exec(value.trim());
  return m ? `${m[1]}-${m[2]}` : null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// One money figure: a cents field passes through as-is; otherwise a
// plain rupees figure converts exactly once. Anything else is
// unusable (null), never guessed.
function moneyCents(raw, key) {
  const centsValue = raw[`${key}Cents`];
  if (Number.isInteger(centsValue)) return centsValue;
  const plain = raw[key];
  if (isFiniteNumber(plain)) return Math.round(plain * 100);
  return null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatRs(cents) {
  if (!Number.isInteger(cents)) return 'not recorded';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

// Normalise one record, or null when half-formed. Unknown fields
// are dropped, so a record can never grow a payment, bill, or price
// field. Derived figures are always recomputed from the inputs.
export function normalizeCashRecon(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const month = validCashReconMonth(raw.month);
  const operator = text(raw.operator);
  const date = validCashReconDate(raw.date);
  if (!id || !month || !operator || !date) return null;
  const ledgerCashCents = moneyCents(raw, 'ledgerCash');
  const countedCents = moneyCents(raw, 'counted');
  const depositedCents = moneyCents(raw, 'deposited');
  const inHandCents = moneyCents(raw, 'inHand');
  if (
    ledgerCashCents === null || countedCents === null ||
    depositedCents === null || inHandCents === null ||
    ledgerCashCents < 0 || countedCents < 0 ||
    depositedCents < 0 || inHandCents < 0
  ) return null;
  const status = raw.status === 'locked' ? 'locked' : 'open';
  const lockedDate = status === 'locked' ? validCashReconDate(raw.lockedDate) : null;
  if (status === 'locked' && !lockedDate) return null;
  const accountedCents = countedCents + depositedCents + inHandCents;
  const differenceCents = ledgerCashCents - accountedCents;
  return Object.freeze({
    id,
    month,
    ledgerCashCents,
    countedCents,
    depositedCents,
    inHandCents,
    accountedCents,
    differenceCents,
    balanced: differenceCents === 0,
    explanation: text(raw.explanation),
    operator,
    date,
    closeRef: text(raw.closeRef),
    snapshotRef: text(raw.snapshotRef),
    status,
    lockedDate,
  });
}

export function normalizeCashReconList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const record = normalizeCashRecon(raw);
    if (record && !seen.has(record.id)) {
      seen.add(record.id);
      out.push(record);
    }
  }
  return out;
}

function sameRecord(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Add a record. A duplicate id is never rewritten: an identical
// re-save leaves the list unchanged, and different figures for an
// existing id are refused with the list exactly unchanged.
export function addCashRecon(list, raw) {
  const base = normalizeCashReconList(list);
  const record = normalizeCashRecon(raw);
  if (!record) return base;
  const existing = base.find((item) => item.id === record.id);
  if (existing) return sameRecord(existing, record) ? base : base;
  return [...base, record];
}

// Lock a record once its month is closed. A locked record can
// never be changed again, and there is no unlock. Locking refuses:
// an already-locked record, a bad lock date, and — the point of
// the whole record — a nonzero difference with no explanation.
export function lockCashRecon(list, id, lockDate) {
  const base = normalizeCashReconList(list);
  const date = validCashReconDate(lockDate);
  if (!date) return base;
  const index = base.findIndex((item) => item.id === id);
  if (index < 0) return base;
  const record = base[index];
  if (record.status === 'locked') return base;
  if (record.differenceCents !== 0 && !record.explanation) return base;
  const locked = Object.freeze({ ...record, status: 'locked', lockedDate: date });
  return [...base.slice(0, index), locked, ...base.slice(index + 1)];
}

export function findCashRecon(list, id) {
  return normalizeCashReconList(list).find((item) => item.id === id) ?? null;
}

export function cashReconsForMonth(list, month) {
  const valid = validCashReconMonth(month);
  if (!valid) return [];
  return normalizeCashReconList(list).filter((item) => item.month === valid);
}

// Compare a record's ledger figure against a caller-supplied
// snapshot figure. Agreement is reported plainly; a mismatch is
// never corrected here, and an unusable snapshot figure gives no
// answer at all rather than a guessed one.
export function verifyAgainstSnapshot(record, snapshotLedgerCents) {
  const clean = normalizeCashRecon(record);
  if (!clean) return null;
  if (!Number.isInteger(snapshotLedgerCents)) return null;
  const differenceCents = clean.ledgerCashCents - snapshotLedgerCents;
  return {
    recordId: clean.id,
    month: clean.month,
    ledgerCashCents: clean.ledgerCashCents,
    snapshotLedgerCents,
    differenceCents,
    agrees: differenceCents === 0,
  };
}

export function cashReconSummary(list) {
  const records = normalizeCashReconList(list);
  const balanced = records.filter((item) => item.balanced).length;
  const locked = records.filter((item) => item.status === 'locked').length;
  const unexplained = records.filter(
    (item) => item.differenceCents !== 0 && !item.explanation,
  ).length;
  return { total: records.length, balanced, locked, unexplained };
}

export function cashReconSummaryText(list) {
  const summary = cashReconSummary(list);
  if (summary.total === 0) return 'No month-end cash reconciliation recorded yet.';
  return `${summary.total} reconciliation record(s): ${summary.balanced} balanced, ` +
    `${summary.total - summary.balanced} with a difference, ` +
    `${summary.unexplained} difference(s) still unexplained, ${summary.locked} locked.`;
}

export function cashReconHtml(record) {
  const clean = normalizeCashRecon(record);
  if (!clean) return '';
  const differenceLine = clean.balanced
    ? 'Balanced: counted + deposited + in-hand equals the ledger cash total.'
    : clean.explanation
      ? `Difference: ${formatRs(clean.differenceCents)} (${clean.differenceCents > 0 ? 'shortfall' : 'surplus'}) — explained: ${escapeHtml(clean.explanation)}`
      : `Difference: ${formatRs(clean.differenceCents)} (${clean.differenceCents > 0 ? 'shortfall' : 'surplus'}) — not yet explained.`;
  const refs = [clean.closeRef ? `Close record: ${escapeHtml(clean.closeRef)}` : '',
    clean.snapshotRef ? `Snapshot: ${escapeHtml(clean.snapshotRef)}` : ''].filter(Boolean).join(' · ');
  return `<div class="cash-recon-row"><strong>${escapeHtml(clean.month)}</strong> — ` +
    `ledger ${formatRs(clean.ledgerCashCents)}, counted ${formatRs(clean.countedCents)}, ` +
    `deposited ${formatRs(clean.depositedCents)}, in hand ${formatRs(clean.inHandCents)} ` +
    `(${differenceLine}) — ${escapeHtml(clean.operator)}, ${escapeHtml(clean.date)}` +
    `${clean.status === 'locked' ? ` — locked ${escapeHtml(clean.lockedDate)}` : ' — open'}` +
    `${refs ? ` — ${refs}` : ''}</div>`;
}

export function cashReconCsv(list) {
  const records = normalizeCashReconList(list);
  const header = 'id,month,ledger_cash_cents,counted_cents,deposited_cents,in_hand_cents,accounted_cents,difference_cents,balanced,explanation,operator,date,close_ref,snapshot_ref,status,locked_date';
  const rows = records.map((item) => [
    item.id, item.month, item.ledgerCashCents, item.countedCents,
    item.depositedCents, item.inHandCents, item.accountedCents,
    item.differenceCents, item.balanced ? 'yes' : 'no', item.explanation,
    item.operator, item.date, item.closeRef, item.snapshotRef,
    item.status, item.lockedDate ?? '',
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function cashReconFilename() {
  return 'month-end-cash-reconciliation.csv';
}
