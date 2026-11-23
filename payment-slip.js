// Plan 73 (Plan 1-100) — Payment history mini-slip on request.
//
// A customer who asks "maine kab kab pay kiya?" gets a verbal list
// or a single receipt, never a short, checkable history, so an old
// payment is argued about instead of shown. This module is the short
// payment-history DRAFT that answers it: the last few payments
// (operator-set count, default 6) with date, amount, and channel,
// plus the current balance line, sent by the operator through the
// existing WhatsApp route.
//
// The fences, stated plainly:
//   - Drafting or sending never changes any bill, payment, or
//     Waada record. The module holds no bill total, payment row,
//     or Waada field of its own: the ledger rows it prints are
//     caller-supplied, carried verbatim, and never written back
//     anywhere. Sending is by the operator through the existing
//     WhatsApp route only; nothing here sends anything on its
//     own, and every send is logged.
//   - It creates no new calculation: every listed payment matches
//     the caller-supplied ledger on the same fixture, in date
//     order, and the subtotal is the exact integer-cent sum of
//     the live payments listed — never a rounded or forced fit.
//   - A voided payment (Plan K) is never presented as a
//     successful payment: it is listed marked VOID, excluded
//     from the subtotal, and the exclusion is stated in the
//     draft itself ("N voided payment(s) excluded from the
//     subtotal").
//   - Money is integer cents throughout, so no float drift. A
//     missing or unusable balance figure refuses the whole
//     draft — never zero-filled, never guessed. A payment row
//     with no usable date or amount is counted as skipped
//     (never zero-filled into the subtotal) and the skip count
//     is stated. A blank channel is said plainly ("not
//     recorded"), never invented.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is
//     not a date). Inputs are never mutated, and the module never
//     reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const PAYMENT_SLIP_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

export const PAYMENT_SLIP_DEFAULT_COUNT = 6;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// A ledger figure in integer cents, or null when missing or
// unusable. Zero is a real figure; a blank, a boolean, a
// non-finite value, or a negative amount is not a figure at all.
function toLedgerCents(amount) {
  if (typeof amount === 'boolean' || amount === null || amount === undefined) return null;
  if (typeof amount === 'string' && amount.trim() === '') return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function fromCents(cents) {
  return cents / 100;
}

export function normalizePaymentSlipVariant(value) {
  const raw = text(value).toLowerCase();
  return raw === PAYMENT_SLIP_VARIANTS.URDU ? PAYMENT_SLIP_VARIANTS.URDU : PAYMENT_SLIP_VARIANTS.ROMAN;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validPaymentSlipDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  const match = DATE_RE.exec(datePart);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

// The operator-set count of payments to list: a positive integer,
// defaulting to 6 for anything else (blank, zero, negative,
// fractional, non-numeric). The default is a display choice, never
// a ledger figure, so falling back to it invents nothing.
export function normalizePaymentSlipCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1) return PAYMENT_SLIP_DEFAULT_COUNT;
  return num;
}

// One caller-supplied payment row, normalised, or null when it
// cannot be listed honestly: no usable date, or no usable amount.
// A row with a usable figure but a blank channel keeps the row
// with channel "not recorded" — the channel is display text, and
// saying it is not recorded invents nothing.
function normalizeSlipPayment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = validPaymentSlipDate(raw.date);
  const amountCents = toLedgerCents(raw.amount);
  if (!date || amountCents === null) return null;
  return {
    date,
    amountCents,
    amount: fromCents(amountCents),
    channel: text(raw.channel ?? raw.method) || 'not recorded',
    voided: raw.voided === true,
  };
}

// Build one customer's payment-history mini-slip. Returns null
// when the slip cannot be built honestly: no customer id, or no
// usable balance figure. A customer with no usable payment rows
// still gets a slip — an empty history plus the balance line —
// because "no payments listed" is a true statement about the
// supplied ledger, not a guessed figure.
export function buildPaymentSlip({ customerId, customerName, payments, count, balance, variant } = {}) {
  const id = text(customerId);
  if (!id) return null;
  const balanceCents = toLedgerCents(balance);
  if (balanceCents === null) return null;
  const wanted = normalizePaymentSlipCount(count);
  const rows = Array.isArray(payments) ? payments : [];
  let skippedUnusable = 0;
  const usable = [];
  for (const raw of rows) {
    const row = normalizeSlipPayment(raw);
    if (!row) skippedUnusable += 1;
    else usable.push(row);
  }
  // Date order, oldest first; the last `wanted` rows are the most
  // recent ones, and they are presented in that same date order.
  usable.sort((a, b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)));
  const listed = usable.slice(-wanted);
  let subtotalCents = 0;
  let voidedCount = 0;
  for (const row of listed) {
    if (row.voided) voidedCount += 1;
    else subtotalCents += row.amountCents;
  }
  const slip = {
    customerId: id,
    customerName: text(customerName) || id,
    variant: normalizePaymentSlipVariant(variant),
    count: wanted,
    payments: listed,
    liveCount: listed.length - voidedCount,
    voidedCount,
    skippedUnusable,
    subtotalCents,
    subtotal: fromCents(subtotalCents),
    balanceCents,
    balance: fromCents(balanceCents),
  };
  slip.text = buildPaymentSlipText(slip);
  return slip;
}

function formatAmount(value) {
  return value === null || value === undefined ? null : `Rs. ${value}`;
}

export function buildPaymentSlipText(slip) {
  if (!slip) return '';
  const lines = [];
  if (slip.variant === PAYMENT_SLIP_VARIANTS.URDU) {
    // Profile Billing tab M3 (Specs P+Q+R, 2026-11-22) — the 'urdu'
    // variant was Roman Urdu text mislabeled "Urdu script"; it now
    // emits real Urdu script. The 'roman' branch below carries the
    // Roman Urdu wording the old 'urdu' branch used to hold.
    lines.push(`شاہدرہ آئی ایس پی — ${slip.customerName} کی ادائیگی کی تاریخ`);
    if (slip.payments.length === 0) {
      lines.push('کوئی ادائیگی درج نہیں ہے۔');
    } else {
      for (const row of slip.payments) {
        lines.push(`${row.date} — ${formatAmount(row.amount)} — ${row.channel}${row.voided ? ' — VOID' : ''}`);
      }
    }
    lines.push(`ذیلی مجموعہ (زندہ ادائیگیاں): ${formatAmount(slip.subtotal)}`);
    if (slip.voidedCount > 0) lines.push(`${slip.voidedCount} منسوخ ادائیگیاں ذیلی مجموعے میں شامل نہیں ہیں — یہ کامیاب ادائیگیاں نہیں ہیں۔`);
    if (slip.skippedUnusable > 0) lines.push(`${slip.skippedUnusable} ادائیگی کی قطاریں تاریخ یا رقم نہ ہونے کی وجہ سے درج نہیں ہو سکیں۔`);
    lines.push(`موجودہ بیلنس: ${formatAmount(slip.balance)}`);
    return lines.join('\n');
  }
  // The 'roman' variant is Roman Urdu, not English: the draft a
  // customer reads on WhatsApp speaks the operator's language. The
  // figures (amounts, dates, the VOID stamp) render exactly as before.
  lines.push(`Shahdara ISP — ${slip.customerName} ki payment history`);
  if (slip.payments.length === 0) {
    lines.push('Koi payment list nahi hai.');
  } else {
    for (const row of slip.payments) {
      lines.push(`${row.date} — ${formatAmount(row.amount)} — ${row.channel}${row.voided ? ' — VOID' : ''}`);
    }
  }
  lines.push(`Kul (zinda adaigiyan): ${formatAmount(slip.subtotal)}`);
  if (slip.voidedCount > 0) lines.push(`${slip.voidedCount} voided payment(s) kul mein shamil nahi hain — ye kamyab adaigiyan nahi hain.`);
  if (slip.skippedUnusable > 0) lines.push(`${slip.skippedUnusable} payment row(s) tareekh ya raqam na hone ki wajah se list nahi ho sakin.`);
  lines.push(`Maujooda balance: ${formatAmount(slip.balance)}`);
  return lines.join('\n');
}

// Plan 600 — the preview chrome renders through a caller-supplied
// labels object (the 591 header-strip pattern), so this module stays
// import-free. Defaults are the English strings, so old callers (and
// old tests) keep byte-identical output. 'Payment slip unavailable.'
// is the shared template key (dft_slip_unavailable); 'Not sent yet.'
// is shared with status-reply; 'Current balance:' with balance-reply.
// The VOID stamp stays 'VOID' in both languages (a code stamp, like
// the draft text's own VOID marking).
const DEFAULT_PAYMENT_SLIP_LABELS = {
  unavailable: 'Payment slip unavailable.',
  summary: 'Payment history: {live} live payment(s), {voided} voided, subtotal {subtotal}, current balance {balance}.',
  notSent: 'Not sent yet.',
  sent: 'Sent {count} time(s), last {last}.',
  noPayments: 'No payments listed.',
  subtotal: 'Subtotal (live payments):',
  currentLine: 'Current balance:',
  voidStamp: 'VOID',
  voidedExcluded: '{count} voided payment(s) excluded from the subtotal — not successful payments.',
  skippedRows: '{count} payment row(s) could not be listed (no usable date or amount).',
  unavailableLong: 'Payment slip unavailable — the balance figure is missing or unusable.',
};
function slipLabel(labels, key) {
  return (labels && typeof labels[key] === 'string' && labels[key] !== '') ? labels[key] : DEFAULT_PAYMENT_SLIP_LABELS[key];
}
function slipFill(template, params) {
  let out = String(template);
  for (const [k, v] of Object.entries(params || {})) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export function paymentSlipSummaryText(slip, labels = DEFAULT_PAYMENT_SLIP_LABELS) {
  if (!slip) return slipLabel(labels, 'unavailable');
  return slipFill(slipLabel(labels, 'summary'), { live: slip.liveCount, voided: slip.voidedCount, subtotal: formatAmount(slip.subtotal), balance: formatAmount(slip.balance) });
}

// The send log: one entry per send (customer, time, channel,
// variant). A half-formed entry is ignored, never stored
// half-formed; logging a send changes no payment record.
export function logPaymentSlipSent(list, entry) {
  const base = Array.isArray(list) ? list.slice() : [];
  if (!entry || typeof entry !== 'object') return base;
  const customerId = text(entry.customerId);
  const sentAt = text(entry.sentAt);
  if (!customerId || !sentAt) return base;
  base.push({
    customerId,
    sentAt,
    channel: text(entry.channel) || 'whatsapp',
    variant: normalizePaymentSlipVariant(entry.variant),
  });
  return base;
}

export function findPaymentSlipSends(list, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(list)) return [];
  return list.filter((entry) => entry && entry.customerId === id);
}

export function paymentSlipSentText(sends, labels = DEFAULT_PAYMENT_SLIP_LABELS) {
  const list = Array.isArray(sends) ? sends : [];
  if (list.length === 0) return slipLabel(labels, 'notSent');
  return slipFill(slipLabel(labels, 'sent'), { count: list.length, last: list[list.length - 1].sentAt });
}

export function paymentSlipHtml(slip, { draftText = '', sends = [], labels = DEFAULT_PAYMENT_SLIP_LABELS } = {}) {
  if (!slip) return `<p class="empty-state">${escapeHtml(slipLabel(labels, 'unavailableLong'))}</p>`;
  const rows = slip.payments.length === 0
    ? `<li>${escapeHtml(slipLabel(labels, 'noPayments'))}</li>`
    : slip.payments.map((row) => `<li>${escapeHtml(row.date)} — ${escapeHtml(formatAmount(row.amount))} — ${escapeHtml(row.channel)}${row.voided ? ` — <strong>${escapeHtml(slipLabel(labels, 'voidStamp'))}</strong>` : ''}</li>`).join('');
  const fields = [
    `${slipLabel(labels, 'subtotal')} ${escapeHtml(formatAmount(slip.subtotal))}`,
    `${slipLabel(labels, 'currentLine')} ${escapeHtml(formatAmount(slip.balance))}`,
  ];
  if (slip.voidedCount > 0) fields.push(slipFill(slipLabel(labels, 'voidedExcluded'), { count: slip.voidedCount }));
  if (slip.skippedUnusable > 0) fields.push(slipFill(slipLabel(labels, 'skippedRows'), { count: slip.skippedUnusable }));
  return `<p>${escapeHtml(paymentSlipSummaryText(slip, labels))}</p><ul style="font-size: 12px;">${rows}</ul><ul style="font-size: 12px;">${fields.map((field) => `<li>${field}</li>`).join('')}</ul>`
    + (draftText ? `<p style="font-size: 12px; white-space: pre-wrap;">${escapeHtml(draftText)}</p>` : '')
    + `<p style="font-size: 12px;">${escapeHtml(paymentSlipSentText(sends, labels))}</p>`;
}
