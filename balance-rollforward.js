// balance-rollforward.js — Plan 68 (Plan 1-100): customer balance
// roll-forward (opening plus charges minus payments equals closing).
//
// A customer's closing balance used to be shown as one number, so
// nobody could prove, in one view, how the opening balance became
// the closing balance during the month. This module is the proof
// view only, per customer and for the whole business:
//
//   closing = opening + charges - payments - concessions
//
// in integer cents, so no float drift. Charges are the bills raised
// in the month, payments are the cash received in the month, and
// concessions are the waivers applied through their existing paths
// (Plan K correction, concession path, and the other bill-field
// credits Plan P already displays). Every line traces to its source
// record by id, so Saad or the owner can walk one line at a time
// from last month to this month.
//
// The fences, stated plainly:
//   - Read-only. The module composes figures from caller-supplied
//     lines; it creates no new calculation of its own and never
//     rewrites any figure. It holds no bill, payment, concession,
//     or Waada field of its own: only amounts, source ids, and
//     labels the caller supplies.
//   - A roll-forward that does not reconcile shows the difference
//     plainly instead of forcing agreement. The computed closing
//     is never overwritten with the reported closing.
//   - An unusable figure (blank, boolean, negative where a total
//     cannot be negative, or non-finite) is counted and named,
//     never zero-filled: a missing amount is not a zero amount.
//   - Months are strict YYYY-MM. Inputs are never mutated, and
//     the module never reads storage, the clock, or the network.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Strict YYYY-MM month key, or false. */
export function validRollMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

/**
 * Amount to integer cents, or null when unusable. Booleans, blanks,
 * null, undefined, and non-finite values are unusable — never zero.
 * Negative amounts are unusable for opening, reported closing, and
 * charge lines (a balance or a bill raised cannot be negative);
 * payment and concession lines are non-negative by the same rule,
 * since a negative payment or waiver is a correction, not a line.
 */
export function toRollCents(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

const rupeesOf = (cents) => (cents === null ? null : cents / 100);

/** Line kinds, in roll-forward order. */
export const ROLL_LINE_KINDS = Object.freeze(['charge', 'payment', 'concession']);

/**
 * Normalise one caller-supplied line. Returns null when the line
 * carries no source id or no label — a line that cannot be traced
 * to its source record is not a line at all. An unusable amount
 * stays null on the line and is counted by the builder, never
 * zero-filled.
 */
export function normalizeRollLine(line, kind) {
  if (!line || typeof line !== 'object') return null;
  const sourceId = typeof line.sourceId === 'string' ? line.sourceId.trim() : '';
  const label = typeof line.label === 'string' ? line.label.trim() : '';
  if (!sourceId || !label || !ROLL_LINE_KINDS.includes(kind)) return null;
  return { sourceId, label, kind, amountCents: toRollCents(line.amount) };
}

function normalizeLines(lines, kind) {
  if (!Array.isArray(lines)) return [];
  return lines.map((line) => normalizeRollLine(line, kind)).filter((line) => line !== null);
}

function sumLines(lines) {
  return lines.reduce((total, line) => total + (line.amountCents ?? 0), 0);
}

/**
 * One customer's roll-forward for one month. Returns null for a
 * missing customer id or an invalid month. The caller supplies the
 * opening balance, the three line groups, and (when the app has
 * one) the independently reported closing balance to check against.
 * When no reported closing is supplied, reconciles is null: the
 * computed closing stands on its own and is never claimed checked.
 */
export function buildCustomerRollForward(input) {
  if (!input || typeof input !== 'object') return null;
  const customerId = typeof input.customerId === 'string' ? input.customerId.trim()
    : (input.customerId ?? null);
  if (customerId === null || customerId === '') return null;
  if (!validRollMonth(input.month)) return null;
  const customerName = typeof input.customerName === 'string' && input.customerName.trim() !== ''
    ? input.customerName.trim() : String(customerId);
  const mohalla = typeof input.mohalla === 'string' ? input.mohalla.trim() : '';

  const charges = normalizeLines(input.charges, 'charge');
  const payments = normalizeLines(input.payments, 'payment');
  const concessions = normalizeLines(input.concessions, 'concession');
  const allLines = [...charges, ...payments, ...concessions];
  const unusableLines = allLines.filter((line) => line.amountCents === null);

  const openingCents = toRollCents(input.opening);
  const reportedCents = input.reportedClosing === undefined ? null : toRollCents(input.reportedClosing);
  // A group total is null when any of its lines is unusable: a partial
  // sum presented as a total would hide the missing amount.
  const groupTotal = (lines) => (lines.some((line) => line.amountCents === null) ? null : sumLines(lines));
  const chargesCents = groupTotal(charges);
  const paymentsCents = groupTotal(payments);
  const concessionsCents = groupTotal(concessions);
  const computedCents = openingCents === null || unusableLines.length > 0
    ? null
    : openingCents + chargesCents - paymentsCents - concessionsCents;
  const reconciles = computedCents === null || reportedCents === null
    ? null
    : computedCents === reportedCents;
  const differenceCents = reconciles === false ? computedCents - reportedCents : null;
  const status = reconciles === true ? 'reconciles'
    : reconciles === false ? 'difference' : 'uncheckable';

  return {
    customerId: String(customerId),
    customerName,
    mohalla,
    month: input.month,
    opening: rupeesOf(openingCents),
    openingCents,
    charges,
    payments,
    concessions,
    chargesTotal: rupeesOf(chargesCents),
    chargesCents,
    paymentsTotal: rupeesOf(paymentsCents),
    paymentsCents,
    concessionsTotal: rupeesOf(concessionsCents),
    concessionsCents,
    computedClosing: rupeesOf(computedCents),
    computedCents,
    reportedClosing: rupeesOf(reportedCents),
    reportedCents,
    reconciles,
    difference: rupeesOf(differenceCents),
    differenceCents,
    unusableLines: unusableLines.map((line) => ({ sourceId: line.sourceId, label: line.label, kind: line.kind })),
    status,
  };
}

/**
 * Whole-business totals over per-customer rows. Totals reconcile
 * only when every row reconciles; a single differing row makes the
 * total differ, and the summed difference is shown plainly. Rows
 * that are uncheckable keep the total uncheckable, never forced.
 */
export function buildRollForwardTotals(rows) {
  const list = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
  // A totals component is null when any row lacks it: summing over a
  // missing figure would silently zero-fill it.
  const sumOrNull = (key) => (list.length > 0 && list.every((row) => typeof row[key] === 'number')
    ? list.reduce((total, row) => total + row[key], 0) : null);
  const sum = (key) => sumOrNull(key) ?? 0;
  const allUsable = list.length > 0 && list.every((row) => row.computedCents !== null);
  const computedCents = allUsable ? sum('computedCents') : null;
  const reportedCents = sumOrNull('reportedCents');
  const reconciles = computedCents === null || reportedCents === null
    ? null
    : computedCents === reportedCents;
  const differenceCents = reconciles === false ? computedCents - reportedCents : null;
  return {
    customerCount: list.length,
    reconcilingCount: list.filter((row) => row.reconciles === true).length,
    differingCount: list.filter((row) => row.reconciles === false).length,
    uncheckableCount: list.filter((row) => row.reconciles === null).length,
    opening: rupeesOf(sumOrNull('openingCents')),
    openingCents: sumOrNull('openingCents'),
    chargesTotal: rupeesOf(sumOrNull('chargesCents')),
    chargesCents: sumOrNull('chargesCents'),
    paymentsTotal: rupeesOf(sumOrNull('paymentsCents')),
    paymentsCents: sumOrNull('paymentsCents'),
    concessionsTotal: rupeesOf(sumOrNull('concessionsCents')),
    concessionsCents: sumOrNull('concessionsCents'),
    computedClosing: rupeesOf(computedCents),
    computedCents,
    reportedClosing: rupeesOf(reportedCents),
    reportedCents,
    reconciles,
    difference: rupeesOf(differenceCents),
    differenceCents,
    status: reconciles === true ? 'reconciles' : reconciles === false ? 'difference' : 'uncheckable',
  };
}

/** Plain-words summary of one row or of the whole-business totals. */
export function rollForwardSummaryText(view) {
  if (!view || typeof view !== 'object') return '';
  // Owner 5-part fix: whole-rupee amounts print without decimals and
  // with thousands grouping (Rs. 6,000, not Rs. 6000.00); a fractional
  // amount keeps up to two decimals. Null stays "not recorded", never 0.
  const money = (cents) => (cents === null ? 'not recorded' : `Rs. ${(cents / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
  const head = view.customerName
    ? `${view.customerName} — ${view.month}`
    : `All customers${view.month ? ` — ${view.month}` : ''} — ${view.customerCount} customer${view.customerCount === 1 ? '' : 's'}`;
  const proof = `${head}: opening ${money(view.openingCents)} + charges ${money(view.chargesCents)} - payments ${money(view.paymentsCents)} - concessions ${money(view.concessionsCents)} = computed closing ${money(view.computedCents)}.`;
  if (view.reconciles === true) return `${proof} Reported closing ${money(view.reportedCents)} matches.`;
  if (view.reconciles === false) {
    return `${proof} Reported closing ${money(view.reportedCents)} differs by ${money(view.differenceCents)} — the difference is shown, not forced away.`;
  }
  const unusable = (view.unusableLines ?? []).length;
  return `${proof} No independent closing to check against${unusable ? `, and ${unusable} unusable line${unusable === 1 ? '' : 's'}` : ''}.`;
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const moneyCell = (cents) => (cents === null ? 'Not recorded' : `Rs. ${(cents / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);

function rollLinesHtml(lines, title) {
  if (!lines.length) return '';
  const rows = lines.map((line) => `<tr><td>${escapeHtml(line.label)}</td><td>${escapeHtml(line.sourceId)}</td><td>${moneyCell(line.amountCents)}</td></tr>`).join('');
  return `<p style="font-size: 12px; margin: 8px 0 2px;"><strong>${escapeHtml(title)}</strong></p><table class="data-table"><thead><tr><th>Line</th><th>Source record</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** Detail table for one customer's roll-forward, every line traced. */
export function rollForwardHtml(row) {
  if (!row || typeof row !== 'object') return '';
  const statusText = row.reconciles === true ? 'Reconciles — computed and reported closing match.'
    : row.reconciles === false ? `Does NOT reconcile — difference ${moneyCell(row.differenceCents)} shown plainly, not forced away.`
    : 'Uncheckable — no independent closing supplied, or a figure is unusable.';
  const unusableNote = (row.unusableLines ?? []).length
    ? `<p style="font-size: 12px;">Unusable amounts (counted, never zero-filled): ${escapeHtml(row.unusableLines.map((line) => `${line.label} (${line.sourceId})`).join(', '))}.</p>`
    : '';
  return `<p style="font-size: 12px;">${escapeHtml(rollForwardSummaryText(row))}</p>`
    + `<p style="font-size: 12px;"><strong>${escapeHtml(statusText)}</strong></p>`
    + unusableNote
    + rollLinesHtml(row.charges, 'Charges — bills raised this month')
    + rollLinesHtml(row.payments, 'Payments — cash received this month')
    + rollLinesHtml(row.concessions, 'Concessions and waivers — existing paths only');
}

/** Summary table over per-customer rows. */
export function rollForwardTableHtml(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return '<p style="font-size: 12px;">No roll-forward rows for this month.</p>';
  const body = list.map((row) => `<tr><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.mohalla || 'Not recorded')}</td><td>${moneyCell(row.openingCents)}</td><td>${moneyCell(row.chargesCents)}</td><td>${moneyCell(row.paymentsCents)}</td><td>${moneyCell(row.concessionsCents)}</td><td>${moneyCell(row.computedCents)}</td><td>${moneyCell(row.reportedCents)}</td><td>${row.reconciles === true ? 'Matches' : row.reconciles === false ? `Differs ${moneyCell(row.differenceCents)}` : 'Uncheckable'}</td></tr>`).join('');
  // Owner 5-part fix: the nine-column table scrolls inside its own
  // card on a phone instead of clipping the columns after Charges.
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Customer</th><th>Mohalla</th><th>Opening</th><th>Charges</th><th>Payments</th><th>Concessions</th><th>Computed closing</th><th>Reported closing</th><th>Check</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV over per-customer rows, one row per customer plus a totals row. */
export function rollForwardCsv(rows, totals) {
  const lines = [['Customer', 'Mohalla', 'Month', 'Opening', 'Charges', 'Payments', 'Concessions', 'Computed closing', 'Reported closing', 'Reconciles', 'Difference'].map(csvCell).join(',')];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push([row.customerName, row.mohalla || '', row.month, row.opening ?? '', row.chargesTotal ?? '', row.paymentsTotal ?? '', row.concessionsTotal ?? '', row.computedClosing ?? '', row.reportedClosing ?? '', row.reconciles === null ? 'uncheckable' : String(row.reconciles), row.difference ?? ''].map(csvCell).join(','));
  }
  if (totals) {
    lines.push(['TOTAL', '', totals.month ?? '', totals.opening ?? '', totals.chargesTotal ?? '', totals.paymentsTotal ?? '', totals.concessionsTotal ?? '', totals.computedClosing ?? '', totals.reportedClosing ?? '', totals.reconciles === null ? 'uncheckable' : String(totals.reconciles), totals.difference ?? ''].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** Export filename for a month's roll-forward. */
export function rollForwardFilename(month) {
  return validRollMonth(month) ? `balance-roll-forward-${month}.csv` : 'balance-roll-forward.csv';
}
