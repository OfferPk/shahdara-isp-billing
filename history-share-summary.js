// Plan 424 — History share as a plain-text summary.
//
// A customer asks for their history on WhatsApp, but the only
// shareable text is the monthly statement draft, which covers one
// month, not the whole history. This module adds only the missing
// piece: one plain-text summary of a customer's history — customer
// name, period covered, totals billed, paid, and still owed, plus
// the last five transactions — prepared as a draft the operator
// sends. It drafts only and sends nothing automatically: it reads
// the entries the full history list already composed, in the same
// order, and writes to no store. The summary is drawn from the
// full entries, not the filtered shown rows: the period, the totals
// and the last five are whole-history facts, so a filter can never
// rewrite how much the customer still owes — the same whole-history
// rule the first-dates line and the month comparison already use.
// Every figure matches the on-screen history on the same fixture:
// the totals follow the same billed and paid rules the monthly
// grouping uses, and the still-owed total is the running balance
// after the last entry. The monthly statement draft, the CSV
// export and the printed statement are untouched.

export const HISTORY_SHARE_SUMMARY_EMPTY_TEXT = 'No transactions yet';
export const HISTORY_SHARE_SUMMARY_LAST_FIVE_COUNT = 5;
export const HISTORY_SHARE_SUMMARY_BUTTON_TEXT = 'Share history summary';
export const HISTORY_SHARE_SUMMARY_SEND_TEXT = 'Send on WhatsApp';
export const HISTORY_SHARE_SUMMARY_NO_NUMBER_TEXT = 'No WhatsApp number';
export const HISTORY_SHARE_SUMMARY_DO_NOT_MESSAGE_TEXT = 'Do not message';

const HISTORY_SHARE_SUMMARY_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
});

const HISTORY_SHARE_SUMMARY_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanHistoryShareKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanHistoryShareText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// A missing, boolean or blank figure is not a number, never zero:
// Number(null) is 0 and Number(true) is 1, and both would invent
// an amount out of nothing.
function finiteHistoryShareCents(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

function isLeapHistoryShareYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isStrictHistoryShareDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const lastDay = month === 2 && isLeapHistoryShareYear(year) ? 29 : HISTORY_SHARE_SUMMARY_DAYS_IN_MONTH[month - 1];
  return day <= lastDay;
}

function isStrictHistoryShareMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function isDatedHistoryShareEntry(entry) {
  return isStrictHistoryShareDate(entry.date) || isStrictHistoryShareMonth(entry.date);
}

// A month-only date counts as the first of that month for ordering,
// but it is shown exactly as recorded — a day is never guessed.
function historyShareSortKey(entry) {
  if (!entry.date) return '9999-99-99';
  if (entry.date.length === 7) return `${entry.date}-01`;
  return entry.date;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
function formatHistoryShareAmount(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

function historyShareBalanceNote(balanceCents) {
  const balance = Number(balanceCents);
  if (!Number.isFinite(balance) || balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatHistoryShareAmount(balance)}`;
  return `Credit ${formatHistoryShareAmount(-balance)}`;
}

// Totals follow the monthly grouping rules: billed is charges plus
// refunds; paid is payments, advances and adjustments, plus credits
// that came from an approved adjustment. A voided entry moves
// nothing, exactly like the running balance. A credit that came
// from an overpayment is already counted inside its source payment,
// so it moves nothing.
export function historyShareSummaryTotals(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  let billedCents = 0;
  let paidCents = 0;
  for (const entry of rows) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.voided === true) continue;
    const cents = finiteHistoryShareCents(entry.amountCents);
    if (cents === null || cents <= 0) continue;
    const type = cleanHistoryShareKey(entry.type);
    if (type === 'charge' || type === 'refund') {
      billedCents += cents;
    } else if (type === 'payment' || type === 'advance' || type === 'adjustment') {
      paidCents += cents;
    } else if (type === 'credit' && cleanHistoryShareKey(entry.source) === 'adjustment') {
      paidCents += cents;
    }
  }
  return { billedCents, paidCents, stillOwedCents: billedCents - paidCents };
}

export function historyShareSummaryPeriod(entries) {
  const rows = (Array.isArray(entries) ? entries : []).filter(
    (entry) => entry && typeof entry === 'object' && isDatedHistoryShareEntry(entry),
  );
  if (rows.length === 0) return { from: '', to: '' };
  const sorted = [...rows].sort((a, b) => {
    if (historyShareSortKey(a) < historyShareSortKey(b)) return -1;
    if (historyShareSortKey(a) > historyShareSortKey(b)) return 1;
    return 0;
  });
  return { from: sorted[0].date, to: sorted[sorted.length - 1].date };
}

export function historyShareSummaryLastFive(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  return rows.slice(-HISTORY_SHARE_SUMMARY_LAST_FIVE_COUNT);
}

export function historyShareSummaryEntryLineText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const label = HISTORY_SHARE_SUMMARY_TYPE_LABELS[cleanHistoryShareKey(entry.type)] || 'Payment';
  const date = entry.date ? entry.date : 'date not recorded';
  const amount = formatHistoryShareAmount(entry.amountCents);
  const note = historyShareBalanceNote(entry.runningBalanceCents);
  const voided = entry.voided ? ' · VOID' : '';
  return `${date} · ${label}${voided} · ${amount} · ${note}`;
}

export function historyShareSummaryText(input = {}) {
  const entries = Array.isArray(input.entries) ? input.entries : [];
  if (entries.length === 0) return '';
  const name = cleanHistoryShareText(input.customerName) || 'Customer';
  const totals = historyShareSummaryTotals(entries);
  const period = historyShareSummaryPeriod(entries);
  const lastFive = historyShareSummaryLastFive(entries);
  const lines = [`History — ${name}`];
  if (period.from && period.to) {
    lines.push(period.from === period.to ? `Period: ${period.from}` : `Period: ${period.from} to ${period.to}`);
  } else {
    lines.push('Period: not recorded');
  }
  lines.push(`Billed: ${formatHistoryShareAmount(totals.billedCents)}`);
  lines.push(`Paid: ${formatHistoryShareAmount(totals.paidCents)}`);
  if (totals.stillOwedCents > 0) {
    lines.push(`Still owed: ${formatHistoryShareAmount(totals.stillOwedCents)}`);
  } else if (totals.stillOwedCents < 0) {
    lines.push(`Credit: ${formatHistoryShareAmount(-totals.stillOwedCents)}`);
  } else {
    lines.push('Settled');
  }
  lines.push(entries.length > HISTORY_SHARE_SUMMARY_LAST_FIVE_COUNT ? 'Last 5 transactions:' : 'Transactions:');
  for (const entry of lastFive) {
    lines.push(historyShareSummaryEntryLineText(entry));
  }
  return lines.join('\n');
}

export function historyShareSummaryButtonMarkup() {
  return '<button id="hsxHistoryShareSummary" class="secondary-button export-button" type="button">Share history summary</button><div id="hsxHistoryShareSummaryResult"></div>';
}

function escapeHistoryShareHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function historyShareSummaryDraftHtml(text) {
  if (!text) return '';
  return `<pre class="hsx-share-summary-text">${escapeHistoryShareHtml(text)}</pre><button id="hsxHistoryShareSummarySend" class="secondary-button" type="button">Send on WhatsApp</button>`;
}
