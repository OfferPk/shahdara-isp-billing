// Plan 39 (Plan 1-100) — Monthly customer statement draft via WhatsApp.
//
// A customer who asks "what do I actually owe and for what?" gets a
// verbal answer or a single receipt, never a clear month statement, so
// the same question returns every month. This module is the monthly
// statement DRAFT that answers it once per month: opening balance,
// this month's charges, payments received, and closing balance, sent by
// the operator through the existing WhatsApp route. It sends nothing
// by itself, it creates no new calculation, and it changes no bill or
// payment: every figure is a sum of ledger rows the caller supplies
// (the customer's own bills and payments), so the statement always
// matches the ledger on the same fixture.
//
// What is new here, stated plainly against the existing statement
// material: the printed statement (Plan P billing-clarity breakdowns,
// shown on the profile and in print) is the detailed, range-based
// ledger view, and form-validation.js already formats that full ledger
// for WhatsApp. This plan is the MONTHLY draft instead: one statement
// per customer per month, offered once for that month, re-sendable
// from the profile, with its own send log. The draft's figures are the
// bill's own due/late/shifting figures — the same figures Plan P
// displays for the month — and the header brand mirrors Plan Q's
// BRAND_DEFAULTS ("Shahdara ISP"); neither Plan P nor Plan Q is
// rewritten, and the printed statement is untouched.
//
// Plan 15 contact preferences are respected by the CALLER, not here:
// this module never reads a preference. The profile wiring picks the
// draft variant from the customer's preferred language (Urdu script
// or Roman Urdu, default Roman), sends to the preferred WhatsApp
// number first, and refuses to send at all for a do-not-message
// customer — exactly as Plans 11–13 and Plan 19 do.
//
// The module is import-free by design (like welcome-pack.js): the
// caller supplies every figure, and the module never reads storage,
// the clock, or the network. Every timestamp in the send log is
// caller-supplied, so a logged send always carries a real send time.
// All money is summed in integer cents, so no float drift can move a
// figure by a paisa.

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const STATEMENT_DRAFT_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
export function isValidStatementDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidStatementMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

export function normalizeStatementVariant(value) {
  return value === STATEMENT_DRAFT_VARIANTS.URDU
    ? STATEMENT_DRAFT_VARIANTS.URDU
    : STATEMENT_DRAFT_VARIANTS.ROMAN;
}

export function formatStatementAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `PKR ${formatter.format(amount)}`;
}

export function formatStatementMonth(value) {
  if (!isValidStatementMonth(value)) return '';
  const [y, m] = value.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function formatStatementDate(value) {
  if (!isValidStatementDate(value)) return '';
  const [y, m, d] = value.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

// Cents of a money value: non-finite and negative amounts are not
// money and count as zero here, never as a guessed figure.
function centsOf(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

function rupeesOf(centsValue) {
  return centsValue / 100;
}

// One bill row, normalised, or null when it carries no usable month.
// A bill counts toward the month it names; its charges are its own
// due amount plus its own late and shifting fees — the same figures
// Plan P displays for that bill month.
function normalizeStatementBill(bill) {
  if (!bill || typeof bill !== 'object' || Array.isArray(bill)) return null;
  const month = text(bill.month);
  if (!isValidStatementMonth(month)) return null;
  const due = Number(bill.dueAmount);
  if (!Number.isFinite(due) || due < 0) return null;
  return {
    month,
    dueCents: Math.round(due * 100),
    lateCents: centsOf(bill.lateFee),
    shiftingCents: centsOf(bill.shiftingFee),
  };
}

// One payment row, normalised, or null when it cannot be placed in a
// month at all (no valid date). Voided payments are kept, flagged,
// and never counted toward any total — voided is history, not money.
function normalizeStatementPayment(payment) {
  if (!payment || typeof payment !== 'object' || Array.isArray(payment)) return null;
  const date = text(payment.date);
  if (!isValidStatementDate(date)) return null;
  const amount = Number(payment.amount);
  return {
    month: date.slice(0, 7),
    date,
    amountCents: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0,
    voided: payment.voided === true,
    method: text(payment.method),
  };
}

// The monthly statement for one customer and one month, or null when
// there is no customer or no valid month — never a statement for a
// guessed customer or month. Inputs are never mutated.
//
//   openingBalance .... prior months' charges minus prior months'
//                        payments (non-voided, positive only); a
//                        negative opening is advance, kept as-is.
//   charges ............ this month's bills: due + late + shifting.
//   paymentsReceived ... this month's non-voided payments by date.
//   closingBalance ..... opening + charges - paymentsReceived.
// A month with no bill still gets a statement (charges 0, and the
// draft says so) — a customer with only prior balance still deserves
// one clear page; hasBill tells the caller whether a bill exists.
export function buildMonthlyStatement({ customerId, customerName, month, bills, payments } = {}) {
  const id = text(customerId);
  if (!id || !isValidStatementMonth(month)) return null;
  const billRows = (Array.isArray(bills) ? bills : [])
    .map(normalizeStatementBill)
    .filter(Boolean);
  const paymentRows = (Array.isArray(payments) ? payments : [])
    .map(normalizeStatementPayment)
    .filter(Boolean);

  const chargeLines = [];
  let chargesCents = 0;
  let hasBill = false;
  for (const bill of billRows) {
    if (bill.month !== month) continue;
    hasBill = true;
    chargeLines.push({ label: `Monthly bill (${month})`, amount: rupeesOf(bill.dueCents) });
    if (bill.lateCents > 0) chargeLines.push({ label: 'Late fee', amount: rupeesOf(bill.lateCents) });
    if (bill.shiftingCents > 0) chargeLines.push({ label: 'Shifting fee', amount: rupeesOf(bill.shiftingCents) });
    chargesCents += bill.dueCents + bill.lateCents + bill.shiftingCents;
  }

  let priorChargesCents = 0;
  for (const bill of billRows) {
    if (bill.month < month) priorChargesCents += bill.dueCents + bill.lateCents + bill.shiftingCents;
  }

  let priorPaymentsCents = 0;
  let paymentsReceivedCents = 0;
  let paymentCount = 0;
  let voidedCount = 0;
  let excludedCount = 0;
  const monthPayments = [];
  for (const payment of paymentRows) {
    if (payment.voided) {
      // Voided payments are counted wherever they fall, never totalled.
      if (payment.month === month) voidedCount += 1;
      continue;
    }
    if (payment.amountCents <= 0) {
      if (payment.month === month) excludedCount += 1;
      continue;
    }
    if (payment.month === month) {
      paymentsReceivedCents += payment.amountCents;
      paymentCount += 1;
      monthPayments.push(payment);
    } else if (payment.month < month) {
      priorPaymentsCents += payment.amountCents;
    }
  }

  const openingCents = priorChargesCents - priorPaymentsCents;
  const closingCents = openingCents + chargesCents - paymentsReceivedCents;
  return {
    customerId: id,
    customerName: text(customerName) || '—',
    month,
    hasBill,
    openingBalance: rupeesOf(openingCents),
    charges: rupeesOf(chargesCents),
    chargeLines,
    paymentsReceived: rupeesOf(paymentsReceivedCents),
    paymentCount,
    voidedCount,
    excludedCount,
    closingBalance: rupeesOf(closingCents),
    payments: monthPayments,
  };
}

function closingLine(balance, variant) {
  const n = Number(balance);
  if (!Number.isFinite(n)) return null;
  if (n > 0) {
    return variant === STATEMENT_DRAFT_VARIANTS.URDU
      ? `بقایا ${formatStatementAmount(n)} باقی ہے۔`
      : `Baqaya ${formatStatementAmount(n)} baqi hai.`;
  }
  if (n === 0) {
    return variant === STATEMENT_DRAFT_VARIANTS.URDU
      ? `کوئی بقایا باقی نہیں ہے۔`
      : `Koi baqaya baqi nahi hai.`;
  }
  return variant === STATEMENT_DRAFT_VARIANTS.URDU
    ? `ایڈوانس ${formatStatementAmount(-n)} آپ کے کھاتے میں موجود ہے۔`
    : `Advance ${formatStatementAmount(-n)} aap ke khaatay mein maujood hai.`;
}

// One WhatsApp draft for one monthly statement, or null when no
// draft may be made (no statement). The draft carries the statement
// figures verbatim — it never rounds, re-allocates, or re-prices.
export function buildStatementDraftText(statement, variant = STATEMENT_DRAFT_VARIANTS.ROMAN) {
  if (!statement || typeof statement !== 'object') return null;
  const useVariant = normalizeStatementVariant(variant);
  const monthLabel = formatStatementMonth(statement.month) || statement.month;
  const closing = closingLine(statement.closingBalance, useVariant);
  if (useVariant === STATEMENT_DRAFT_VARIANTS.URDU) {
    const parts = [
      `السلام علیکم ${statement.customerName}،`,
      `شاہدرہ آئی ایس پی — ${monthLabel} کا ماہانہ اسٹیٹمنٹ:`,
      `ابتدائی بقایا: ${formatStatementAmount(statement.openingBalance)}۔`,
      `اس ماہ کے چارجز: ${formatStatementAmount(statement.charges)}۔`,
    ];
    if (!statement.hasBill) parts.push('اس ماہ کا کوئی بل جاری نہیں ہوا۔');
    parts.push(`اس ماہ موصول ادائیگیاں: ${formatStatementAmount(statement.paymentsReceived)}۔`);
    parts.push(`اختتامی بقایا: ${formatStatementAmount(statement.closingBalance)}۔`);
    if (closing) parts.push(closing);
    parts.push('شکریہ — شاہدرہ فائبر نیٹ۔');
    return { variant: useVariant, month: statement.month, text: parts.join(' ') };
  }
  const parts = [
    `Assalam-o-Alaikum ${statement.customerName},`,
    `Shahdara ISP — Monthly statement for ${monthLabel}:`,
    `Opening balance: ${formatStatementAmount(statement.openingBalance)}.`,
    `This month's charges: ${formatStatementAmount(statement.charges)}.`,
  ];
  if (!statement.hasBill) parts.push('No bill was raised for this month.');
  parts.push(`Payments received this month: ${formatStatementAmount(statement.paymentsReceived)}.`);
  parts.push(`Closing balance: ${formatStatementAmount(statement.closingBalance)}.`);
  if (closing) parts.push(closing);
  parts.push('Shukriya — Shahdara Fiber Net.');
  return { variant: useVariant, month: statement.month, text: parts.join(' ') };
}

export function statementDraftSummaryText(statement) {
  if (!statement || typeof statement !== 'object') return 'Monthly statement unavailable.';
  const monthLabel = formatStatementMonth(statement.month) || statement.month;
  return `Monthly statement for ${statement.customerName} — ${monthLabel}: opening ${formatStatementAmount(statement.openingBalance)}, charges ${formatStatementAmount(statement.charges)}, payments ${formatStatementAmount(statement.paymentsReceived)}, closing ${formatStatementAmount(statement.closingBalance)}.`;
}

// Append a send to the log (customer, month, time, channel), returning
// a new list. Entries without a customer id, a month, or a send time
// are ignored: a logged send always carries a real send time. The log
// never touches a payment, bill, Waada, or lifecycle record.
export function logStatementSent(log, { customerId, month, sentAt, channel, variant } = {}) {
  const list = Array.isArray(log) ? [...log] : [];
  const id = text(customerId);
  const time = text(sentAt);
  if (!id || !isValidStatementMonth(month) || !time) return list;
  list.push({
    customerId: id,
    month,
    sentAt: time,
    channel: text(channel) || 'whatsapp',
    variant: normalizeStatementVariant(variant),
  });
  return list;
}

export function findStatementSends(log, customerId, month) {
  const id = text(customerId);
  if (!id || !isValidStatementMonth(month) || !Array.isArray(log)) return [];
  return log.filter((entry) => text(entry?.customerId) === id && entry?.month === month);
}

export function statementSentText(sends) {
  const list = Array.isArray(sends) ? sends : [];
  if (list.length === 0) return 'Monthly statement not sent yet — send it once for this month.';
  const first = list[0];
  const datePart = text(first?.sentAt).slice(0, 10);
  const shown = formatStatementDate(datePart) || datePart;
  if (list.length === 1) return `Monthly statement sent on ${shown}.`;
  return `Monthly statement sent on ${shown} and ${list.length - 1} more time${list.length - 1 === 1 ? '' : 's'} — re-send anytime from here.`;
}

export function statementDraftHtml(statement, { draftText = '', sends = [] } = {}) {
  if (!statement || typeof statement !== 'object') return '<p class="empty-state">Monthly statement unavailable.</p>';
  const fields = [
    `Month: ${escapeHtml(formatStatementMonth(statement.month) || statement.month)}`,
    `Opening balance: ${escapeHtml(formatStatementAmount(statement.openingBalance))}`,
    `This month's charges: ${escapeHtml(formatStatementAmount(statement.charges))}`,
    `Payments received: ${escapeHtml(formatStatementAmount(statement.paymentsReceived))} (${statement.paymentCount} payment${statement.paymentCount === 1 ? '' : 's'})`,
    `Closing balance: ${escapeHtml(formatStatementAmount(statement.closingBalance))}`,
  ];
  if (!statement.hasBill) fields.push('No bill was raised for this month.');
  if (statement.voidedCount > 0) fields.push(`Voided payments this month (not counted): ${statement.voidedCount}`);
  return `<p>${escapeHtml(statementDraftSummaryText(statement))}</p>`
    + `<ul class="statement-draft-fields">${fields.map((field) => `<li>${field}</li>`).join('')}</ul>`
    + (draftText ? `<p class="statement-draft-text">${escapeHtml(draftText)}</p>` : '')
    + `<p id="statementDraftSent">${escapeHtml(statementSentText(sends))}</p>`;
}
