// Plan 401 — Full transaction history list per customer.
// The profile already shows only a mini-slip of recent payments, so a
// customer who asks "show me everything I have ever paid" gets a
// partial answer. This module composes the missing piece: one full
// read-only list per customer — every payment, charge, credit and
// refund in date order, with the amount and the running balance after
// each entry. It lists only and changes nothing: it reads the bills
// already on the customer record plus the credit entries and refund
// records already stored on this device, and it writes to no store.
// The mini-slip, the receipt-number search, the offline queue view
// and the category tag already exist and are left alone; this list is
// a separate view over the same records, not a search, not today's
// list, and not a filter label.
export const FULL_HISTORY_TYPES = Object.freeze([
  'charge',
  'payment',
  'advance',
  'credit',
  'refund',
  'adjustment',
]);

export const FULL_HISTORY_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
});

export const FULL_HISTORY_EMPTY_TEXT = 'No transactions yet';

const HISTORY_TYPE_ORDER = Object.freeze({
  charge: 0,
  payment: 1,
  advance: 2,
  credit: 3,
  refund: 4,
  adjustment: 5,
});

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapHistoryYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isStrictHistoryDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const lastDay = month === 2 && isLeapHistoryYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= lastDay;
}

function isStrictHistoryMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function cleanHistoryKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanHistoryText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function rupeesToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function finiteCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

function historySortKey(entry) {
  if (!entry.date) return '9999-99-99';
  if (entry.date.length === 7) return `${entry.date}-01`;
  return entry.date;
}

function historyEntryDate(value, month) {
  if (isStrictHistoryDate(value)) return value;
  if (isStrictHistoryMonth(month)) return month;
  if (isStrictHistoryMonth(value)) return value;
  return '';
}

// A payment's type follows what it is, not where it was recorded:
// a negative amount is money returned, an advance kind is an advance,
// and a refund or adjustment tag is a refund or an adjustment.
function paymentHistoryType(payment) {
  if (Number(payment?.amount) < 0) return 'refund';
  if (cleanHistoryKey(payment?.kind) === 'advance') return 'advance';
  const tag = cleanHistoryKey(payment?.categoryTag);
  if (tag === 'refund') return 'refund';
  if (tag === 'adjustment') return 'adjustment';
  if (tag === 'advance') return 'advance';
  return 'payment';
}

// The running balance after an entry: what the customer still owes.
// Charges and refunds add to what is owed; payments, advances and
// adjustments reduce it. A credit entry that came from an overpayment
// is already counted inside its source payment, so it moves nothing;
// a credit entry from an approved adjustment reduces what is owed.
// A voided payment is listed but moves nothing.
function historyBalanceDelta(entry) {
  if (entry.voided) return 0;
  if (entry.type === 'charge' || entry.type === 'refund') return entry.amountCents;
  if (entry.type === 'payment' || entry.type === 'advance' || entry.type === 'adjustment') {
    return -entry.amountCents;
  }
  if (entry.type === 'credit') {
    return entry.source === 'adjustment' ? -entry.amountCents : 0;
  }
  return 0;
}

export function fullHistoryEntries(input = {}) {
  const customerId = cleanHistoryKey(input.customerId);
  if (!customerId) return [];
  const bills = Array.isArray(input.bills) ? input.bills : [];
  const creditEntries = Array.isArray(input.creditEntries) ? input.creditEntries : [];
  const refundRecords = Array.isArray(input.refundRecords) ? input.refundRecords : [];
  const entries = [];

  for (const bill of bills) {
    if (!bill || typeof bill !== 'object') continue;
    const chargeCents = rupeesToCents(bill.dueAmount);
    if (chargeCents === null || chargeCents <= 0) continue;
    entries.push({
      type: 'charge',
      date: historyEntryDate(bill.dueDate, bill.month),
      month: isStrictHistoryMonth(bill.month) ? bill.month : '',
      amountCents: chargeCents,
      runningBalanceCents: 0,
      note: '',
      method: '',
      ref: cleanHistoryText(bill.id),
      voided: false,
    });
    const payments = Array.isArray(bill.payments) ? bill.payments : [];
    for (const payment of payments) {
      if (!payment || typeof payment !== 'object') continue;
      const amountCents = rupeesToCents(payment.amount);
      if (amountCents === null || amountCents === 0) continue;
      const type = paymentHistoryType(payment);
      entries.push({
        type,
        date: historyEntryDate(payment.date, bill.month),
        month: isStrictHistoryMonth(bill.month) ? bill.month : '',
        amountCents: Math.abs(amountCents),
        runningBalanceCents: 0,
        note: cleanHistoryText(payment.note),
        method: cleanHistoryText(payment.method),
        ref: cleanHistoryText(payment.id),
        voided: payment.voided === true,
      });
    }
  }

  for (const credit of creditEntries) {
    if (!credit || typeof credit !== 'object') continue;
    if (cleanHistoryKey(credit.customerId) !== customerId) continue;
    const amountCents = finiteCents(credit.amountCents);
    if (amountCents === null || amountCents <= 0) continue;
    const source = cleanHistoryKey(credit.source);
    if (source !== 'overpayment' && source !== 'adjustment') continue;
    entries.push({
      type: 'credit',
      date: historyEntryDate(credit.date, ''),
      month: '',
      amountCents,
      runningBalanceCents: 0,
      note: cleanHistoryText(credit.note),
      method: '',
      ref: cleanHistoryText(credit.id),
      voided: false,
      source,
    });
  }

  for (const refund of refundRecords) {
    if (!refund || typeof refund !== 'object') continue;
    if (cleanHistoryKey(refund.customerId) !== customerId) continue;
    const amountCents = finiteCents(refund.amountCents);
    if (amountCents === null || amountCents <= 0) continue;
    entries.push({
      type: 'refund',
      date: historyEntryDate(refund.refundDate, ''),
      month: '',
      amountCents,
      runningBalanceCents: 0,
      note: cleanHistoryText(refund.reason),
      method: cleanHistoryText(refund.method),
      ref: cleanHistoryText(refund.id),
      voided: false,
    });
  }

  entries.sort((a, b) => {
    const dateCompare = historySortKey(a) < historySortKey(b) ? -1 : historySortKey(a) > historySortKey(b) ? 1 : 0;
    if (dateCompare !== 0) return dateCompare;
    const typeCompare = HISTORY_TYPE_ORDER[a.type] - HISTORY_TYPE_ORDER[b.type];
    if (typeCompare !== 0) return typeCompare;
    return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
  });

  let balanceCents = 0;
  for (const entry of entries) {
    balanceCents += historyBalanceDelta(entry);
    entry.runningBalanceCents = balanceCents;
  }
  return entries;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatHistoryAmount(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function fullHistoryRunningNote(balanceCents) {
  const balance = Number(balanceCents);
  if (!Number.isFinite(balance) || balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatHistoryAmount(balance)}`;
  return `Credit ${formatHistoryAmount(-balance)}`;
}

export function fullHistoryEntryLineText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const label = FULL_HISTORY_TYPE_LABELS[entry.type] || 'Payment';
  const date = entry.date ? entry.date : 'date not recorded';
  const amount = formatHistoryAmount(entry.amountCents);
  const note = fullHistoryRunningNote(entry.runningBalanceCents);
  const voided = entry.voided ? ' · VOID' : '';
  return `${date} · ${label}${voided} · ${amount} · ${note}`;
}

function escapeHistoryHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fullHistoryListHtml(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const rows = entries.map((entry) => {
    const label = FULL_HISTORY_TYPE_LABELS[entry.type] || 'Payment';
    const date = entry.date ? entry.date : 'date not recorded';
    const amount = formatHistoryAmount(entry.amountCents);
    const note = fullHistoryRunningNote(entry.runningBalanceCents);
    const details = [date, entry.method, entry.note].filter(Boolean).join(' · ');
    const voided = entry.voided ? ' · VOID' : '';
    return `<li class="payment-row"><span class="payment-main"><span class="payment-amount">${escapeHistoryHtml(label)} · ${escapeHistoryHtml(amount)}${escapeHistoryHtml(voided)}</span><span class="payment-meta">${escapeHistoryHtml(details)} · ${escapeHistoryHtml(note)}</span></span></li>`;
  });
  return `<ul class="payment-list">${rows.join('')}</ul>`;
}

export function fullHistorySummaryText(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return FULL_HISTORY_EMPTY_TEXT;
  const last = entries[entries.length - 1];
  const count = entries.length === 1 ? '1 entry' : `${entries.length} entries`;
  return `${count} · ${fullHistoryRunningNote(last.runningBalanceCents)}`;
}
