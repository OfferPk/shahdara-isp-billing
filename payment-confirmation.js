// Plan 13 (Plan 1-100) — Payment confirmation message drafts.
//
// AFTER a payment is recorded, the customer hears back in their own
// language — not only on paper. This module prepares one short
// bilingual confirmation draft per recorded payment (amount, date,
// remaining balance if any), ready to send through the existing
// WhatsApp route, plus a send log. It sends nothing by itself: the
// operator taps Send, the existing WhatsApp route opens with the
// draft prefilled, and only then is the send logged (payment,
// time, channel) in a log that lives apart from every payment
// record. Sending a confirmation advances that log and nothing
// else.
//
// What this module NEVER does, stated plainly:
//   - it never changes a receipt or its delivery status (Plan 5
//     owns receipt delivery: generated / sent / pending / failed);
//     a confirmation is a message draft, not a receipt, and the
//     two are tracked separately — sending a confirmation does
//     not mark a receipt sent, and vice versa;
//   - it never changes a payment total, a bill, or a balance;
//   - it never creates, clears, or changes a Waada promise —
//     Waada clearing stays exactly where the payment flow already
//     does it, and a confirmation draft is not a Waada action;
//   - it never generates a draft for a voided payment. A voided
//     payment is frozen history (payment-void-audit.js: voided
//     === true), so it is counted as excluded, never drafted.
//
// Figures are verbatim from the payment record: amount comes from
// payment.amount, date from payment.date, method from
// payment.method when present. The remaining balance is NOT
// derived here — the module reads no ledger, no bill, and no
// storage. The caller supplies remainingBalance when it knows it
// (for example the bill's current balance after the payment was
// recorded); when it is absent the draft simply carries no
// remaining-balance line, never an invented one. A supplied
// balance of exactly 0 is stated as "no balance remains"; a
// positive balance is stated as the amount still due.
//
// The module is import-free by design (like pre-due-reminders.js
// and escalation-ladder.js): the caller supplies every payment,
// and the module never reads storage, the clock, or the network.
// Every timestamp in the send log is caller-supplied, so a logged
// send always carries a real send time.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const CONFIRMATION_DRAFT_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

export function isValidConfirmationDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function formatConfirmationAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `PKR ${formatter.format(amount)}`;
}

export function formatConfirmationDate(value) {
  if (!isValidConfirmationDate(value)) return '';
  const [y, m, d] = value.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Mirrors payment-void-audit.js isVoidedPayment (voided === true)
// without importing the app graph, so this module stays import-free.
export function isVoidedConfirmationPayment(payment) {
  return Boolean(payment) && typeof payment === 'object' && payment.voided === true;
}

function remainingBalanceLine(balance, variant) {
  if (balance === null || balance === undefined) return null;
  const n = Number(balance);
  if (!Number.isFinite(n)) return null;
  if (n > 0) {
    return variant === CONFIRMATION_DRAFT_VARIANTS.URDU
      ? `بقایا ${formatConfirmationAmount(n)} باقی ہے۔`
      : `Baqaya ${formatConfirmationAmount(n)} baqi hai.`;
  }
  if (n === 0) {
    return variant === CONFIRMATION_DRAFT_VARIANTS.URDU
      ? `کوئی بقایا باقی نہیں ہے۔`
      : `Koi baqaya baqi nahi hai.`;
  }
  return null;
}

// One draft for one payment record, or null when no draft may be
// made: a voided payment, a non-record, a missing payment id, a
// non-positive or non-numeric amount, or an invalid payment date.
// The caller may pass customerName / remainingBalance either on
// the payment itself or in options; options win when both exist.
// The original payment object is never touched.
export function buildPaymentConfirmationDraft(payment, options = {}) {
  if (!payment || typeof payment !== 'object' || Array.isArray(payment)) return null;
  if (isVoidedConfirmationPayment(payment)) return null;
  const paymentId = text(options.paymentId ?? payment.id);
  if (!paymentId) return null;
  const amount = money(payment.amount);
  if (!(amount > 0)) return null;
  const date = text(payment.date);
  if (!isValidConfirmationDate(date)) return null;
  const variant = options.variant === CONFIRMATION_DRAFT_VARIANTS.URDU
    ? CONFIRMATION_DRAFT_VARIANTS.URDU
    : CONFIRMATION_DRAFT_VARIANTS.ROMAN;
  const name = text(options.customerName ?? payment.customerName) || '—';
  const method = text(options.method ?? payment.method);
  const balance = options.remainingBalance !== undefined ? options.remainingBalance : payment.remainingBalance;
  const balanceLine = remainingBalanceLine(balance, variant);
  if (variant === CONFIRMATION_DRAFT_VARIANTS.URDU) {
    const parts = [
      `السلام علیکم ${name}،`,
      `آپ کی ادائیگی ${formatConfirmationAmount(amount)} ${formatConfirmationDate(date)} کو موصول ہو گئی ہے۔`,
    ];
    if (method) parts.push(`طریقہ: ${method}۔`);
    if (balanceLine) parts.push(balanceLine);
    parts.push('شکریہ — شاہدرہ فائبر نیٹ۔');
    return { variant, paymentId, text: parts.join(' ') };
  }
  const parts = [
    `Assalam-o-Alaikum ${name},`,
    `aap ki adaigi ${formatConfirmationAmount(amount)} ${formatConfirmationDate(date)} ko wasool ho gayi hai.`,
  ];
  if (method) parts.push(`Tareeqa: ${method}.`);
  if (balanceLine) parts.push(balanceLine);
  parts.push('Shukriya — Shahdara Fiber Net.');
  return { variant, paymentId, text: parts.join(' ') };
}

// One row per recorded payment, newest first (date descending,
// then customer name A–Z, then payment id). Voided payments and
// undraftable records are counted, never drafted and never
// dropped silently from the counts.
export function buildPaymentConfirmationList({ payments } = {}) {
  const counts = {
    totalPayments: 0,
    drafted: 0,
    excludedVoided: 0,
    excludedInvalid: 0,
  };
  const rows = [];
  for (const payment of Array.isArray(payments) ? payments : []) {
    counts.totalPayments += 1;
    if (isVoidedConfirmationPayment(payment)) { counts.excludedVoided += 1; continue; }
    const draft = buildPaymentConfirmationDraft(payment);
    if (!draft) { counts.excludedInvalid += 1; continue; }
    const draftUrdu = buildPaymentConfirmationDraft(payment, { variant: CONFIRMATION_DRAFT_VARIANTS.URDU });
    counts.drafted += 1;
    rows.push({
      paymentId: draft.paymentId,
      customerId: text(payment.customerId),
      customerName: text(payment.customerName) || '—',
      mohalla: text(payment.mohalla),
      amount: money(payment.amount),
      date: text(payment.date),
      method: text(payment.method),
      remainingBalance: payment.remainingBalance !== undefined && Number.isFinite(Number(payment.remainingBalance))
        ? Math.round(Number(payment.remainingBalance))
        : null,
      draft: draft.text,
      draftUrdu: draftUrdu ? draftUrdu.text : '',
    });
  }
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const an = a.customerName.toLowerCase();
    const bn = b.customerName.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return a.paymentId < b.paymentId ? -1 : 1;
  });
  return {
    rows,
    counts,
    totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
  };
}

// Send log: a plain array of { paymentId, customerId, sentAt,
// channel }. It lives apart from payment, receipt-delivery, and
// Waada records by construction — appending here touches none of
// them. Returns a NEW array; an entry without a payment id or a
// send time is not recorded.
export function logConfirmationSent(log, { paymentId, customerId, sentAt, channel } = {}) {
  const list = Array.isArray(log) ? [...log] : [];
  const id = text(paymentId);
  const time = text(sentAt);
  if (!id || !time) return list;
  list.push({
    paymentId: id,
    customerId: text(customerId),
    sentAt: time,
    channel: text(channel) || 'whatsapp',
  });
  return list;
}

export function confirmationSentAt(log, paymentId) {
  const id = text(paymentId);
  if (!id || !Array.isArray(log)) return null;
  let found = null;
  for (const entry of log) {
    if (text(entry?.paymentId) === id && text(entry?.sentAt)) found = entry.sentAt;
  }
  return found;
}

export function paymentConfirmationSummaryText(list) {
  if (!list || !Array.isArray(list.rows)) return 'Payment confirmations unavailable.';
  if (list.rows.length === 0) {
    return list.counts.excludedVoided > 0
      ? `No confirmations ready — ${list.counts.excludedVoided} voided payment${list.counts.excludedVoided === 1 ? '' : 's'} correctly have no draft.`
      : 'No recorded payments to confirm.';
  }
  const voidedNote = list.counts.excludedVoided > 0
    ? ` (${list.counts.excludedVoided} voided payment${list.counts.excludedVoided === 1 ? '' : 's'} excluded, no draft)`
    : '';
  return `${list.rows.length} payment confirmation${list.rows.length === 1 ? '' : 's'} ready, total ${formatConfirmationAmount(list.totalAmount)}${voidedNote}.`;
}

export function paymentConfirmationFilename(today) {
  const day = isValidConfirmationDate(today) ? today : 'unknown-date';
  return `payment-confirmations-${day}.csv`;
}

function formatSentAt(sentAt) {
  const value = text(sentAt);
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return `${value.slice(0, 10)} ${value.slice(11, 16)} UTC`;
  return value;
}

export function paymentConfirmationHtml(list, sentLog = []) {
  if (!list || !Array.isArray(list.rows)) return '<p class="empty-state">Payment confirmations unavailable.</p>';
  if (list.rows.length === 0) return '<p class="empty-state">No recorded payments to confirm.</p>';
  const rows = list.rows.map((row) => {
    const sentAt = confirmationSentAt(sentLog, row.paymentId);
    return `<tr><td><strong>${escapeHtml(row.customerName)}</strong>${row.mohalla ? `<br><small>${escapeHtml(row.mohalla)}</small>` : ''}</td><td>${formatConfirmationAmount(row.amount)}</td><td>${escapeHtml(formatConfirmationDate(row.date))}${row.method ? `<br><small>${escapeHtml(row.method)}</small>` : ''}${row.remainingBalance !== null ? `<br><small>Baqaya: ${escapeHtml(formatConfirmationAmount(row.remainingBalance))}</small>` : ''}</td><td><small>${escapeHtml(row.draft)}</small><details><summary>Urdu draft</summary><small>${escapeHtml(row.draftUrdu)}</small></details></td><td>${sentAt ? `<small>Sent ${escapeHtml(formatSentAt(sentAt))}</small>` : '<small>Not sent</small>'}<br><button class="secondary-button btn-sm payment-confirmation-send-btn" type="button" data-payment-id="${escapeHtml(row.paymentId)}">📲 Send via WhatsApp</button></td></tr>`;
  }).join('');
  return `<table class="payment-confirmations-table"><thead><tr><th>Customer</th><th>Amount</th><th>Date</th><th>Confirmation draft</th><th>Send</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function paymentConfirmationCsv(list, sentLog = []) {
  const lines = ['Customer, Mohalla, Amount (PKR), Date, Method, Remaining balance (PKR), Sent at, Channel'];
  for (const row of list?.rows ?? []) {
    const sentEntry = Array.isArray(sentLog)
      ? [...sentLog].reverse().find((e) => text(e?.paymentId) === row.paymentId)
      : undefined;
    lines.push([
      csvCell(row.customerName), csvCell(row.mohalla), row.amount,
      csvCell(row.date), csvCell(row.method),
      row.remainingBalance !== null ? row.remainingBalance : '',
      csvCell(sentEntry?.sentAt ?? ''), csvCell(sentEntry?.channel ?? ''),
    ].join(','));
  }
  return lines.join('\n');
}
