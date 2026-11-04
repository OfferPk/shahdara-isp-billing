// Plan 124 (Plan 101-202) — Unmatched bank credit matching queue.
//
// Money arriving in the bank without a clear customer reference
// used to sit unrecorded, or get guessed onto the wrong customer,
// while the customer who sent it was still shown as owing. This
// module keeps every such credit in a queue until it is matched
// to exactly one customer payment, or explained. A match creates
// the link to a normal payment record; it never creates a bill,
// and it never changes any bill or payment total — totals move
// only when the operator records the match through the existing
// payment path. This queue is for bank credits only, and it is
// separate from the customer-raised check for payments a customer
// says they already made: that workflow starts from the customer,
// this one starts from the bank statement.
//
// The fences, stated plainly:
//   - One credit matches at most one customer payment, and one
//     payment is matched to at most one credit. A credit already
//     matched, or already explained, can never be matched again.
//   - An unmatched credit stays listed until it is matched or
//     explained. Explaining needs a reason and a date, and an
//     explained credit is history, not a silent deletion.
//   - A credit's amount, date, and reference are recorded exactly
//     as received. A missing reference stays missing (null),
//     never invented, and a candidate customer is only a
//     suggestion until the operator records the match.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Strict YYYY-MM-DD calendar date, or null (2026-02-30 is not a date). */
export function validCreditDate(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  const max = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > max) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Money is integer cents throughout. A plain rupees figure
// converts exactly once; a *Cents figure passes through as-is,
// so re-normalising never inflates an amount.
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

export function formatCreditRs(cents) {
  if (!Number.isInteger(cents)) return 'not recorded';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

export const CREDIT_STATUSES = ['unmatched', 'matched', 'explained'];

// Candidate customers: operator-typed suggestions, deduped in
// order, blanks dropped. A candidate is never a match by itself.
function candidateList(raw) {
  const input = raw.candidates ?? raw.candidateCustomers;
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of input) {
    const name = text(entry);
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

// Normalise one bank credit, or null when half-formed.
// Unknown fields are dropped, so a credit can never grow a bill,
// payment, or total field. A matched credit must carry its
// payment link and match date; an explained credit must carry
// its explanation and date; an unmatched credit carries neither.
export function normalizeBankCredit(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const date = validCreditDate(raw.date);
  const amountCents = moneyCents(raw, 'amount');
  const status = text(raw.status) || 'unmatched';
  if (!id || !date) return null;
  if (!Number.isInteger(amountCents) || amountCents <= 0) return null;
  if (!CREDIT_STATUSES.includes(status)) return null;
  const reference = text(raw.reference);
  const candidates = candidateList(raw);
  let matchedPaymentId = null;
  let matchedCustomer = null;
  let matchedDate = null;
  let explanation = null;
  let explanationDate = null;
  if (status === 'matched') {
    matchedPaymentId = text(raw.matchedPaymentId);
    matchedCustomer = text(raw.matchedCustomer);
    matchedDate = raw.matchedDate !== undefined && raw.matchedDate !== null && text(raw.matchedDate) !== ''
      ? validCreditDate(raw.matchedDate)
      : null;
    if (!matchedPaymentId || !matchedCustomer || !matchedDate) return null;
  }
  if (status === 'explained') {
    explanation = text(raw.explanation);
    explanationDate = raw.explanationDate !== undefined && raw.explanationDate !== null && text(raw.explanationDate) !== ''
      ? validCreditDate(raw.explanationDate)
      : null;
    if (!explanation || !explanationDate) return null;
  }
  if (status === 'unmatched' && (raw.matchedPaymentId || raw.explanation)) {
    // An unmatched credit carries no match and no explanation.
    return null;
  }
  return Object.freeze({
    id,
    date,
    amountCents,
    reference: reference || null,
    candidates,
    status,
    matchedPaymentId,
    matchedCustomer,
    matchedDate,
    explanation,
    explanationDate,
  });
}

export function normalizeBankCreditList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const record = normalizeBankCredit(raw);
    if (record && !seen.has(record.id)) {
      seen.add(record.id);
      out.push(record);
    }
  }
  return out;
}

export function findBankCredit(list, id) {
  const clean = normalizeBankCreditList(list);
  return clean.find((item) => item.id === id) ?? null;
}

export function bankCreditForPayment(list, paymentId) {
  const id = text(paymentId);
  if (!id) return null;
  return normalizeBankCreditList(list).find((item) => item.matchedPaymentId === id) ?? null;
}

// Record a bank credit, or return the list unchanged when
// refused: a half-formed credit, or an id already on record.
// An existing credit is never rewritten, not even by an
// identical re-save — the list simply stays as it was.
export function recordBankCredit(list, raw) {
  const clean = normalizeBankCreditList(list);
  const record = normalizeBankCredit(raw);
  if (!record) return clean;
  if (clean.some((item) => item.id === record.id)) return clean;
  return [...clean, record];
}

// Match an unmatched credit to exactly one customer payment, or
// return the list unchanged when refused: unknown credit, a
// credit already matched or explained, a missing payment id or
// customer, a bad match date, or a payment id already matched
// to another credit. The match is only a link on this record;
// no bill or payment total changes here.
export function matchBankCredit(list, creditId, paymentId, customer, matchDate) {
  const clean = normalizeBankCreditList(list);
  const pid = text(paymentId);
  const cust = text(customer);
  const date = validCreditDate(matchDate);
  if (!pid || !cust || !date) return clean;
  const index = clean.findIndex((item) => item.id === text(creditId));
  if (index < 0) return clean;
  if (clean[index].status !== 'unmatched') return clean;
  if (clean.some((item) => item.matchedPaymentId === pid)) return clean;
  const next = [...clean];
  next[index] = Object.freeze({
    ...clean[index],
    status: 'matched',
    matchedPaymentId: pid,
    matchedCustomer: cust,
    matchedDate: date,
  });
  return next;
}

// Explain an unmatched credit so it leaves the queue without
// being matched — for example bank charges, or money that is
// not a customer payment at all. Refused without a non-blank
// explanation and a real date, or when the credit is already
// matched or explained. An explained credit stays in history.
export function explainBankCredit(list, creditId, explanation, explanationDate) {
  const clean = normalizeBankCreditList(list);
  const reason = text(explanation);
  const date = validCreditDate(explanationDate);
  if (!reason || !date) return clean;
  const index = clean.findIndex((item) => item.id === text(creditId));
  if (index < 0) return clean;
  if (clean[index].status !== 'unmatched') return clean;
  const next = [...clean];
  next[index] = Object.freeze({
    ...clean[index],
    status: 'explained',
    explanation: reason,
    explanationDate: date,
  });
  return next;
}

// The queue itself: every credit still waiting for a match or
// an explanation, oldest first. Nothing leaves this list except
// by a recorded match or a recorded explanation.
export function unmatchedBankCredits(list) {
  return normalizeBankCreditList(list)
    .filter((item) => item.status === 'unmatched')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
}

export function matchedBankCredits(list) {
  return normalizeBankCreditList(list).filter((item) => item.status === 'matched');
}

export function explainedBankCredits(list) {
  return normalizeBankCreditList(list).filter((item) => item.status === 'explained');
}

export function unmatchedBankCreditTotalCents(list) {
  return unmatchedBankCredits(list).reduce((sum, item) => sum + item.amountCents, 0);
}

export function bankCreditSummaryText(list) {
  const clean = normalizeBankCreditList(list);
  const unmatched = clean.filter((item) => item.status === 'unmatched').length;
  const matched = clean.filter((item) => item.status === 'matched').length;
  const explained = clean.filter((item) => item.status === 'explained').length;
  return `${clean.length} bank credits, ${unmatched} still unmatched (${formatCreditRs(unmatchedBankCreditTotalCents(list))}), ${matched} matched, ${explained} explained.`;
}

export function bankCreditHtml(item) {
  const ref = item.reference ? ` — ref ${escapeHtml(item.reference)}` : ' — ref not recorded';
  const candidates = item.candidates.length > 0 ? ` — candidates: ${escapeHtml(item.candidates.join(', '))}` : '';
  const matched = item.status === 'matched'
    ? ` — matched to ${escapeHtml(item.matchedCustomer)} (payment ${escapeHtml(item.matchedPaymentId)}) on ${escapeHtml(item.matchedDate)}`
    : '';
  const explained = item.status === 'explained'
    ? ` — explained ${escapeHtml(item.explanationDate)}: ${escapeHtml(item.explanation)}`
    : '';
  return `<div class="bank-credit-row"><strong>${formatCreditRs(item.amountCents)}</strong> — ${escapeHtml(item.date)}${ref} — ${escapeHtml(item.status)}${candidates}${matched}${explained}</div>`;
}

export function bankCreditCsv(list) {
  const rows = [['id', 'date', 'amount_cents', 'reference', 'candidates', 'status', 'matched_payment_id', 'matched_customer', 'matched_date', 'explanation', 'explanation_date']];
  for (const item of normalizeBankCreditList(list)) {
    rows.push([item.id, item.date, item.amountCents, item.reference ?? '', item.candidates.join('; '), item.status, item.matchedPaymentId ?? '', item.matchedCustomer ?? '', item.matchedDate ?? '', item.explanation ?? '', item.explanationDate ?? '']);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function bankCreditFilename() {
  return 'bank-credits.csv';
}
