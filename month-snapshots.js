// month-snapshots.js — Plan 70 (Plan 1-100): frozen month-end
// balance snapshot (read-only, for audit and comparison).
//
// Balances keep moving after month end, so last month's "final"
// figures can never be re-checked. This module is the snapshot
// only: when a month is closed (Plan 67), one frozen record is
// taken holding, as they stood at close, each customer's closing
// balance (from the Plan 68 roll-forward), the total outstanding,
// the month's collections, and the month's expense total, stored
// with the close date. Later payments, corrections (Plan K), or
// concessions never alter a stored snapshot: a corrected record
// appears in the next month's roll-forward (Plan 68), not by
// rewriting history. Opening a snapshot never edits it, and
// comparing two snapshots shows the change between months with
// each month's figures intact.
//
// The fences, stated plainly:
//   - A snapshot is taken only for a month the Plan 67 checklist
//     records as closed. The caller supplies that close state;
//     this module never ticks, closes, or reopens a month.
//   - One snapshot per month, taken once, never overwritten: a
//     second take for the same month is refused outright, so a
//     frozen month cannot be quietly re-frozen on new figures.
//   - A snapshot is never edited in place. There is no update
//     function: the only changes are taking a new month's
//     snapshot and removing a whole snapshot record.
//   - Figures are integer cents, so no float drift. An unusable
//     figure (blank, boolean, negative, or non-finite) refuses
//     the whole snapshot, never zero-fills it: a frozen record
//     with a guessed figure in it would be worse than none.
//   - The module holds no bill, payment, concession, expense, or
//     month-close field of its own: only the frozen figures the
//     caller supplies, copied at take time. It never reads
//     storage, the clock, or the network, and inputs are never
//     mutated — so later ledger movement cannot reach back into
//     a stored snapshot.
//   - Snapshots are exportable with the data export pack
//     (Plan 32): snapshotExportRows returns one flat row per
//     customer per snapshot in the pack's CSV shape, and the
//     pack's snapshots section is built from those rows.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict YYYY-MM-DD calendar date, or false (2026-02-30 is not a date). */
export function validSnapshotDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

/** Strict YYYY-MM month key, or false. */
export function validSnapshotMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

/**
 * Amount to integer cents, or null when unusable. Booleans, blanks,
 * null, undefined, and non-finite values are unusable — never zero.
 * A negative closing balance, collection, or expense total is
 * unusable here, matching the Plan 68 rule that a balance or a
 * bill raised cannot be negative (a credit is a concession line
 * in the roll-forward, not a negative snapshot figure).
 */
export function toSnapshotCents(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');
const rupeesOf = (cents) => (cents === null ? null : cents / 100);

/**
 * Normalise one frozen per-customer row, or null when it cannot be
 * traced or its figure is unusable. A row with no customer id, no
 * name, or an unusable closing balance is refused, never stored
 * with a guessed figure.
 */
export function normalizeSnapshotRow(row) {
  if (!row || typeof row !== 'object') return null;
  const customerId = cleanText(row.customerId);
  const customerName = cleanText(row.customerName);
  if (!customerId || !customerName) return null;
  const closingCents = toSnapshotCents(row.closing);
  if (closingCents === null) return null;
  return {
    customerId,
    customerName,
    mohalla: cleanText(row.mohalla),
    closing: rupeesOf(closingCents),
    closingCents,
  };
}

/**
 * Normalise one snapshot, or null when it is half-formed: no
 * month, no close date, no customer rows, a duplicate customer,
 * an unusable row, or unusable collections/expense totals. The
 * totals are recomputed from the rows, never trusted from the
 * caller: total outstanding is the sum of the frozen closing
 * balances, so a snapshot's figures always match its own rows.
 */
export function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const month = cleanText(raw.month);
  if (!validSnapshotMonth(month)) return null;
  const closeDate = cleanText(raw.closeDate);
  if (!validSnapshotDate(closeDate)) return null;
  if (!Array.isArray(raw.customers) || raw.customers.length === 0) return null;
  const seen = new Set();
  const customers = [];
  for (const row of raw.customers) {
    const normalised = normalizeSnapshotRow(row);
    if (!normalised || seen.has(normalised.customerId)) return null;
    seen.add(normalised.customerId);
    customers.push(normalised);
  }
  customers.sort((a, b) => a.customerName.localeCompare(b.customerName) || a.customerId.localeCompare(b.customerId));
  const collectionsCents = toSnapshotCents(raw.collections);
  const expensesCents = toSnapshotCents(raw.expenses);
  if (collectionsCents === null || expensesCents === null) return null;
  const totalOutstandingCents = customers.reduce((total, row) => total + row.closingCents, 0);
  return {
    month,
    closeDate,
    closedBy: cleanText(raw.closedBy),
    customers,
    customerCount: customers.length,
    totalOutstanding: rupeesOf(totalOutstandingCents),
    totalOutstandingCents,
    collections: rupeesOf(collectionsCents),
    collectionsCents,
    expenses: rupeesOf(expensesCents),
    expensesCents,
  };
}

/** Normalise a list of snapshots, dropping half-formed rows. */
export function normalizeSnapshotList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((row) => normalizeSnapshot(row)).filter(Boolean)
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

/** Find one month's snapshot (a fresh copy), or null. */
export function findSnapshot(list, month) {
  if (!validSnapshotMonth(month)) return null;
  const found = normalizeSnapshotList(list).find((row) => row.month === month);
  return found ? normalizeSnapshot(found) : null;
}

/**
 * Take a snapshot for a month. Refused (list unchanged) unless the
 * caller passes the Plan 67 close record for the month with status
 * 'closed' — a snapshot is taken only when the month is closed —
 * and unless the month has no snapshot yet: one snapshot per
 * month, taken once, never overwritten. The stored figures are
 * copies made at take time, so later ledger movement, payments,
 * corrections, or concessions cannot alter them.
 */
export function takeSnapshot(list, { month, closeDate, closedBy, customers, collections, expenses, monthClose } = {}) {
  const base = Array.isArray(list) ? list : [];
  if (!monthClose || typeof monthClose !== 'object' || monthClose.status !== 'closed') return base;
  if (cleanText(monthClose.month) !== cleanText(month)) return base;
  if (findSnapshot(base, month)) return base;
  const snapshot = normalizeSnapshot({ month, closeDate, closedBy, customers, collections, expenses });
  if (!snapshot) return base;
  return normalizeSnapshotList([...base, snapshot]);
}

/** Remove one month's whole snapshot record. Snapshots are never edited in place. */
export function removeSnapshot(list, month) {
  if (!validSnapshotMonth(month)) return Array.isArray(list) ? list : [];
  return normalizeSnapshotList(list).filter((row) => row.month !== month);
}

/** Plain-words summary of one snapshot. */
export function snapshotSummaryText(snapshot) {
  const normalised = normalizeSnapshot(snapshot);
  if (!normalised) return '';
  const money = (cents) => `Rs. ${(cents / 100).toFixed(2)}`;
  return `${normalised.month} frozen at close on ${normalised.closeDate}: ${normalised.customerCount} customer${normalised.customerCount === 1 ? '' : 's'}, total outstanding ${money(normalised.totalOutstandingCents)}, collections ${money(normalised.collectionsCents)}, expenses ${money(normalised.expensesCents)}. Later payments, corrections, or concessions never alter these figures.`;
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const moneyCell = (cents) => (cents === null ? 'Not recorded' : `Rs. ${(cents / 100).toFixed(2)}`);

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Detail table for one snapshot: every frozen row, plus its totals. */
export function snapshotHtml(snapshot) {
  const normalised = normalizeSnapshot(snapshot);
  if (!normalised) return '';
  const rows = normalised.customers.map((row) => `<tr><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.mohalla || 'Not recorded')}</td><td>${moneyCell(row.closingCents)}</td></tr>`).join('');
  return `<p style="font-size: 12px;">${escapeHtml(snapshotSummaryText(normalised))}</p>`
    + `<table class="data-table"><thead><tr><th>Customer</th><th>Mohalla</th><th>Closing balance at close</th></tr></thead><tbody>${rows}</tbody></table>`
    + `<p style="font-size: 12px;">Total outstanding ${moneyCell(normalised.totalOutstandingCents)} · Collections ${moneyCell(normalised.collectionsCents)} · Expenses ${moneyCell(normalised.expensesCents)} · Closed by ${escapeHtml(normalised.closedBy || 'Not recorded')}.</p>`;
}

/** CSV of one snapshot: one row per customer plus a totals row. */
export function snapshotCsv(snapshot) {
  const normalised = normalizeSnapshot(snapshot);
  if (!normalised) return '';
  const lines = [['Month', 'Close date', 'Customer', 'Mohalla', 'Closing balance'].map(csvCell).join(',')];
  for (const row of normalised.customers) {
    lines.push([normalised.month, normalised.closeDate, row.customerName, row.mohalla || '', row.closing ?? ''].map(csvCell).join(','));
  }
  lines.push([normalised.month, normalised.closeDate, 'TOTAL', '', normalised.totalOutstanding ?? ''].map(csvCell).join(','));
  return lines.join('\n');
}

/** Export filename for one month's snapshot. */
export function snapshotFilename(month) {
  return validSnapshotMonth(month) ? `month-snapshot-${month}.csv` : 'month-snapshot.csv';
}

/**
 * Flat rows for the Plan 32 export pack: one row per customer per
 * snapshot, in the pack's CSV shape. The pack builds its snapshots
 * section from these rows; the snapshot itself is never rewritten
 * by exporting it.
 */
export function snapshotExportRows(list) {
  return normalizeSnapshotList(list).flatMap((snapshot) => snapshot.customers.map((row) => ({
    month: snapshot.month,
    closeDate: snapshot.closeDate,
    customerId: row.customerId,
    customerName: row.customerName,
    mohalla: row.mohalla,
    closingBalance: row.closing,
  })));
}

/**
 * Compare two snapshots. Returns null unless both are valid. Each
 * month's figures stay intact on the result — the comparison adds
 * a change column, it never rewrites either month. A customer in
 * only one month is 'joined' or 'left' with a null change, never a
 * change computed against a guessed zero.
 */
export function compareSnapshots(earlier, later) {
  const a = normalizeSnapshot(earlier);
  const b = normalizeSnapshot(later);
  if (!a || !b) return null;
  const byId = new Map();
  for (const row of a.customers) byId.set(row.customerId, { earlier: row, later: null });
  for (const row of b.customers) {
    if (byId.has(row.customerId)) byId.get(row.customerId).later = row;
    else byId.set(row.customerId, { earlier: null, later: row });
  }
  const perCustomer = [...byId.values()].map(({ earlier: e, later: l }) => {
    const name = (l ?? e).customerName;
    if (e && l) {
      const changeCents = l.closingCents - e.closingCents;
      return {
        customerId: e.customerId,
        customerName: name,
        earlierClosing: e.closing,
        earlierClosingCents: e.closingCents,
        laterClosing: l.closing,
        laterClosingCents: l.closingCents,
        change: rupeesOf(changeCents),
        changeCents,
        status: changeCents === 0 ? 'unchanged' : 'changed',
      };
    }
    if (l) {
      return { customerId: l.customerId, customerName: name, earlierClosing: null, earlierClosingCents: null, laterClosing: l.closing, laterClosingCents: l.closingCents, change: null, changeCents: null, status: 'joined' };
    }
    return { customerId: e.customerId, customerName: name, earlierClosing: e.closing, earlierClosingCents: e.closingCents, laterClosing: null, laterClosingCents: null, change: null, changeCents: null, status: 'left' };
  }).sort((x, y) => x.customerName.localeCompare(y.customerName) || x.customerId.localeCompare(y.customerId));
  return {
    earlierMonth: a.month,
    laterMonth: b.month,
    earlier,
    later,
    totalOutstandingChange: rupeesOf(b.totalOutstandingCents - a.totalOutstandingCents),
    totalOutstandingChangeCents: b.totalOutstandingCents - a.totalOutstandingCents,
    collectionsChange: rupeesOf(b.collectionsCents - a.collectionsCents),
    collectionsChangeCents: b.collectionsCents - a.collectionsCents,
    expensesChange: rupeesOf(b.expensesCents - a.expensesCents),
    expensesChangeCents: b.expensesCents - a.expensesCents,
    perCustomer,
  };
}

/** Plain-words summary of a comparison. */
export function compareSnapshotsSummaryText(comparison) {
  if (!comparison || typeof comparison !== 'object') return '';
  const money = (cents) => (cents === null ? 'not recorded' : `Rs. ${(cents / 100).toFixed(2)}`);
  const signed = (cents) => `${cents < 0 ? '−' : '+'}${money(Math.abs(cents))}`;
  const changed = comparison.perCustomer.filter((row) => row.status === 'changed').length;
  const joined = comparison.perCustomer.filter((row) => row.status === 'joined').length;
  const left = comparison.perCustomer.filter((row) => row.status === 'left').length;
  return `${comparison.earlierMonth} → ${comparison.laterMonth}: total outstanding ${signed(comparison.totalOutstandingChangeCents)}, collections ${signed(comparison.collectionsChangeCents)}, expenses ${signed(comparison.expensesChangeCents)}; ${changed} changed, ${joined} joined, ${left} left. Each month's figures stay as frozen.`;
}

/** Comparison table: both months' frozen figures side by side, plus the change. */
export function compareSnapshotsHtml(comparison) {
  if (!comparison || typeof comparison !== 'object' || !Array.isArray(comparison.perCustomer)) return '';
  const rows = comparison.perCustomer.map((row) => `<tr><td>${escapeHtml(row.customerName)}</td><td>${moneyCell(row.earlierClosingCents)}</td><td>${moneyCell(row.laterClosingCents)}</td><td>${row.changeCents === null ? '—' : moneyCell(row.changeCents)}</td><td>${escapeHtml(row.status)}</td></tr>`).join('');
  return `<p style="font-size: 12px;">${escapeHtml(compareSnapshotsSummaryText(comparison))}</p>`
    + `<table class="data-table"><thead><tr><th>Customer</th><th>${escapeHtml(comparison.earlierMonth)}</th><th>${escapeHtml(comparison.laterMonth)}</th><th>Change</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** CSV of a comparison: one row per customer plus a totals row. */
export function compareSnapshotsCsv(comparison) {
  if (!comparison || typeof comparison !== 'object' || !Array.isArray(comparison.perCustomer)) return '';
  const lines = [['Customer', comparison.earlierMonth, comparison.laterMonth, 'Change', 'Status'].map(csvCell).join(',')];
  for (const row of comparison.perCustomer) {
    lines.push([row.customerName, row.earlierClosing ?? '', row.laterClosing ?? '', row.change ?? '', row.status].map(csvCell).join(','));
  }
  lines.push(['TOTAL', comparison.earlier?.totalOutstanding ?? '', comparison.later?.totalOutstanding ?? '', comparison.totalOutstandingChange ?? '', ''].map(csvCell).join(','));
  return lines.join('\n');
}
