// Plan 410 — History printed statement per customer.
//
// Some customers want a paper statement of their history, but the
// only statement is a WhatsApp draft, which does not help a customer
// without a phone in hand. This module adds only the missing piece:
// one printable history statement per customer — customer details,
// history lines with running balance, totals, print date — printed
// from the history view. It prints only and changes nothing: it
// reads the entries the history list already composed, in the same
// order, and writes to no store. The statement follows the same
// shown rows as the list, so a filter that hides a row hides it
// from the paper too. Every figure matches the on-screen history:
// each line carries the entry's own running balance, the amounts
// print in the same shape the list uses, and the totals are the
// same billed, paid and still-owed arithmetic the monthly and
// yearly views use. The print date is supplied by the caller and
// is never invented here: a statement with no usable print date
// is refused, because a shop file without a print date cannot be
// trusted. Inputs are never mutated, and the module never reads
// storage, the clock, or the network.

export const HISTORY_PRINTED_STATEMENT_EMPTY_TEXT = 'No transactions yet';

export const HISTORY_PRINTED_STATEMENT_UNDATED_LABEL = 'date not recorded';

const HISTORY_PRINTED_STATEMENT_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
  info: 'Info',
});

const PRINTED_STATEMENT_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapPrintedStatementYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// A strict calendar date: YYYY-MM-DD with a real day in a real
// month, leap years included, so 2028-02-29 prints and 2027-02-29
// never does.
export function isStrictPrintedStatementDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const lastDay = month === 2 && isLeapPrintedStatementYear(year) ? 29 : PRINTED_STATEMENT_DAYS_IN_MONTH[month - 1];
  return day <= lastDay;
}

function cleanPrintedStatementKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanPrintedStatementText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// A missing, boolean or blank figure is not a number, never zero:
// Number(null) is 0 and Number(true) is 1, and both would invent
// an amount out of nothing. This helper is for the totals
// arithmetic only; the display formatter below mirrors the
// on-screen one instead, so the paper matches the screen figure
// for figure.
function finitePrintedStatementCents(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

// Amounts print in the same shape the on-screen history uses:
// no decimals for whole rupees (PKR 1,500), one decimal for a
// paisa remainder (PKR 1,500.5), the minus sign before PKR. A
// figure the list cannot read prints as a bare dash, exactly as the
// list does, so the paper never disagrees with the screen (Sharafat
// 13: the screen prints '—' for a figure that is not a number, so
// the paper must too — PKR 0 would invent money out of nothing).
export function formatPrintedStatementAmount(cents) {
  // Sharafat 13: guard the RAW value before Number() — Number(null)
  // is 0, Number('') is 0 and Number(true) is 1. Same guard shape
  // as finitePrintedStatementCents above and formatHistoryAmount.
  if (cents === null || cents === undefined) return '—';
  if (typeof cents === 'boolean') return '—';
  if (typeof cents === 'string' && cents.trim() === '') return '—';
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return '—';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

// The running-balance note, in the same plain words the list
// uses: what is still owed, what stands as credit, or settled.
export function historyPrintedStatementBalanceNote(balanceCents) {
  const balance = Number(balanceCents);
  if (!Number.isFinite(balance) || balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatPrintedStatementAmount(balance)}`;
  return `Credit ${formatPrintedStatementAmount(-balance)}`;
}

// The type label the list shows, with a voided entry marked
// plainly so the paper never hides that the payment was voided.
// An unknown type reads as a payment, never a guessed type.
export function historyPrintedStatementTypeLabel(type, voided) {
  const label = HISTORY_PRINTED_STATEMENT_TYPE_LABELS[cleanPrintedStatementKey(type)] || 'Payment';
  return voided === true ? `${label} (voided)` : label;
}

// The running-balance movement of one entry: charges and refunds
// add to what is owed; payments, advances and adjustments reduce
// it. A credit from an overpayment is already counted inside its
// source payment, so it moves nothing; a credit from an approved
// adjustment reduces what is owed. A voided entry is listed but
// moves nothing. A missing or non-finite amount is not a number,
// never zero-filled into a movement: it moves nothing.
export function historyPrintedStatementDelta(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (entry.voided === true) return 0;
  const amountCents = finitePrintedStatementCents(entry.amountCents);
  if (amountCents === null) return 0;
  const type = cleanPrintedStatementKey(entry.type);
  if (type === 'charge' || type === 'refund') return amountCents;
  if (type === 'payment' || type === 'advance' || type === 'adjustment') return -amountCents;
  if (type === 'credit') {
    return cleanPrintedStatementKey(entry.source) === 'adjustment' ? -amountCents : 0;
  }
  return 0;
}

function isPrintedStatementPayment(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.voided === true) return false;
  const type = cleanPrintedStatementKey(entry.type);
  return type === 'payment' || type === 'advance';
}

// The totals of the entries given: billed is what increased what
// is owed, paid is what reduced it, still owed is billed minus
// paid, and the payment count is the non-voided payments and
// advances. On the full list the still-owed figure is the last
// entry's own running balance; on a filtered view it is the
// shown rows' own total.
export function historyPrintedStatementTotals(entries) {
  const totals = {
    entryCount: 0,
    billedCents: 0,
    paidCents: 0,
    stillOwedCents: 0,
    paymentCount: 0,
  };
  if (!Array.isArray(entries)) return totals;
  totals.entryCount = entries.length;
  for (const entry of entries) {
    const delta = historyPrintedStatementDelta(entry);
    if (delta > 0) totals.billedCents += delta;
    if (delta < 0) totals.paidCents += -delta;
    if (isPrintedStatementPayment(entry)) totals.paymentCount += 1;
  }
  totals.stillOwedCents = totals.billedCents - totals.paidCents;
  return totals;
}

// One plain-text line for one entry: date, type, amount, and the
// running balance after it — the same four facts the list shows
// for that entry.
export function historyPrintedStatementLineText(entry) {
  if (!entry || typeof entry !== 'object') {
    return `${HISTORY_PRINTED_STATEMENT_UNDATED_LABEL} · Payment · PKR 0 · Balance PKR 0`;
  }
  const date = entry.date ? cleanPrintedStatementText(entry.date) : HISTORY_PRINTED_STATEMENT_UNDATED_LABEL;
  const label = historyPrintedStatementTypeLabel(entry.type, entry.voided);
  const amount = formatPrintedStatementAmount(entry.amountCents);
  const balance = formatPrintedStatementAmount(entry.runningBalanceCents);
  return `${date} · ${label} · ${amount} · Balance ${balance}`;
}

// One plain-text summary of a totals object, in the same plain
// words the list uses for its running note.
export function historyPrintedStatementSummaryText(totals) {
  if (!totals || typeof totals !== 'object') return HISTORY_PRINTED_STATEMENT_EMPTY_TEXT;
  const count = totals.entryCount === 1 ? '1 entry' : `${totals.entryCount} entries`;
  const payments = totals.paymentCount === 1 ? '1 payment' : `${totals.paymentCount} payments`;
  return `${count} · Billed ${formatPrintedStatementAmount(totals.billedCents)} · Paid ${formatPrintedStatementAmount(totals.paidCents)} · ${historyPrintedStatementBalanceNote(totals.stillOwedCents)} · ${payments}`;
}

function escapePrintedStatementHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The table rows for the entries given, in the order given: the
// caller passes the shown rows, so the paper matches the on-screen
// history exactly. The input entries are never mutated and never
// reordered. A missing entry is an undated payment row, never a
// crash.
export function historyPrintedStatementRowsHtml(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return `<tr><td>${escapePrintedStatementHtml(HISTORY_PRINTED_STATEMENT_UNDATED_LABEL)}</td><td>Payment</td><td class="num">PKR 0</td><td></td><td></td><td class="num">PKR 0</td></tr>`;
    }
    const date = entry.date ? cleanPrintedStatementText(entry.date) : HISTORY_PRINTED_STATEMENT_UNDATED_LABEL;
    const label = historyPrintedStatementTypeLabel(entry.type, entry.voided);
    return `<tr><td>${escapePrintedStatementHtml(date)}</td><td>${escapePrintedStatementHtml(label)}</td><td class="num">${escapePrintedStatementHtml(formatPrintedStatementAmount(entry.amountCents))}</td><td>${escapePrintedStatementHtml(cleanPrintedStatementText(entry.method))}</td><td>${escapePrintedStatementHtml(cleanPrintedStatementText(entry.ref))}</td><td class="num">${escapePrintedStatementHtml(formatPrintedStatementAmount(entry.runningBalanceCents))}</td></tr>`;
  }).join('');
}

// The whole printable page: customer details, one line per entry
// in the order given, and the totals footer. The page is a
// standalone printable page with its own plain styling, so it
// prints the same from any browser. A statement with no usable
// print date is refused (null), never printed with a guessed
// date. An empty history still prints, with the plain-words
// empty line and zero totals, so the paper never pretends there
// were transactions.
export function buildHistoryPrintedStatementHtml(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const printDate = isStrictPrintedStatementDate(input.printDate) ? input.printDate : '';
  if (!printDate) return null;
  const entries = Array.isArray(input.entries) ? input.entries : [];
  const totals = historyPrintedStatementTotals(entries);
  const name = cleanPrintedStatementText(input.customerName) || 'Customer';
  const number = cleanPrintedStatementText(input.customerNumber);
  const mohalla = cleanPrintedStatementText(input.mohalla);
  const business = cleanPrintedStatementText(input.businessName) || 'Shahdara ISP';
  const rows = historyPrintedStatementRowsHtml(entries);
  const body = rows === ''
    ? `<tr><td colspan="6">${escapePrintedStatementHtml(HISTORY_PRINTED_STATEMENT_EMPTY_TEXT)}</td></tr>`
    : rows;
  return `<!doctype html><html><head><meta charset="utf-8"><title>History statement — ${escapePrintedStatementHtml(name)}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;margin:24px}h1{font-size:20px;margin:0 0 4px}.muted{color:#444}p{margin:4px 0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #444;padding:6px 8px;text-align:left;font-size:13px;vertical-align:top}.num{text-align:right}tfoot td{font-weight:700}@media print{body{margin:0}}</style></head><body><h1>${escapePrintedStatementHtml(business)}</h1><p class="muted">Customer history statement</p><p>Customer: ${escapePrintedStatementHtml(name)}</p>${number ? `<p>Customer no: ${escapePrintedStatementHtml(number)}</p>` : ''}${mohalla ? `<p>Mohalla: ${escapePrintedStatementHtml(mohalla)}</p>` : ''}<p>Print date: ${escapePrintedStatementHtml(printDate)}</p><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Method</th><th>Reference</th><th>Running balance</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="6">Totals — ${escapePrintedStatementHtml(historyPrintedStatementSummaryText(totals))}</td></tr></tfoot></table></body></html>`;
}

// The button the profile history section shows, beside the CSV
// export. It carries no behaviour itself: the wiring in the app
// attaches the print to it.
export function historyPrintedStatementButtonMarkup() {
  return '<button id="hpsHistoryPrintedStatement" class="secondary-button export-button" type="button">Print history statement</button>';
}
