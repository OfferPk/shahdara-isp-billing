// Transaction linked to the collection promise it fulfils (Plan 399):
// a customer promises "I will pay by Friday" and then pays, but the
// payment is never linked to the promise, so the promise stays open
// and the collector chases a customer who already paid. One link
// record joins a transaction to the promise it fulfils — the promise
// reference, the transaction reference, and the date — recorded when
// the payment is entered. The link rides the payment record itself
// (the same field the payment validator keeps), so it needs no store
// of its own: the record is the link.
//
// A fulfilled promise shows its payment and the payment shows its
// promise, resolved by scanning the transaction rows — the promise
// record itself is never written to. The link links only: it closes
// nothing by itself, it never fills the promise's paid date or
// amount, and it never changes any bill, payment total, promise
// record, or customer record by itself. An unlinked promise stays
// open and shows nothing extra; a payment with no link shows
// nothing extra. A voided payment never counts as fulfilling a
// promise — voided receipts are frozen history.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Inputs are never mutated.

export const PROMISE_PAYMENT_LINK_PROMISE_ID_MAX_LENGTH = 64;

const PROMISE_LINK_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanPromiseLinkText(value) {
  return typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim() : '';
}

function isPromiseLinkLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictPromisePaymentLinkDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = PROMISE_LINK_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isPromiseLinkLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

/**
 * Normalize one promise-payment link record. A link needs the
 * promise it fulfils (promiseId) and a date: the date supplied on
 * the link, else the fallback date (the payment's own day). The
 * value may be an object { promiseId, date } or a plain string
 * (the promise id only, dated by the fallback). A link with no
 * promise id, or with a date that is neither strict on the link
 * nor strict as a fallback, is refused and reads as null, never
 * silently kept. The promise id caps at 64 chars and is kept
 * exactly as given, never stored raw beyond the cap.
 */
export function normalizePromisePaymentLink(raw, fallbackDate) {
  if (typeof raw === 'string') raw = { promiseId: raw };
  if (!raw || typeof raw !== 'object') return null;
  const promiseId = cleanPromiseLinkText(raw.promiseId).slice(0, PROMISE_PAYMENT_LINK_PROMISE_ID_MAX_LENGTH);
  if (!promiseId) return null;
  const rawDate = cleanPromiseLinkText(raw.date);
  const date = isStrictPromisePaymentLinkDate(rawDate)
    ? rawDate
    : (isStrictPromisePaymentLinkDate(fallbackDate) ? String(fallbackDate) : '');
  if (!date) return null;
  return { promiseId, date };
}

/**
 * The promise-payment link on a payment record, or null when the
 * payment carries none. Reads the same field the payment validator
 * keeps, so a link recorded with the payment is the link shown.
 * The fallback date is the payment's own day.
 */
export function promisePaymentLinkOf(payment) {
  if (!payment || typeof payment !== 'object') return null;
  return normalizePromisePaymentLink(payment.promiseLink, payment.date);
}

/**
 * One promise record, read defensively: the fields the link needs
 * (id, customer, promised date, promised amount, paid date) with
 * nothing else. A record with no id, no customer, no strict
 * promised date, or no positive promised amount reads as null, so
 * a damaged record can never offer itself as a promise to fulfil.
 * The customer match is case-insensitive, so a promise recorded
 * under a differently-cased id still belongs to its customer.
 */
function cleanPromiseRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanPromiseLinkText(record.id);
  const customer = cleanPromiseLinkText(record.customer);
  const promisedDate = cleanPromiseLinkText(record.promisedDate);
  if (!id || !customer || !isStrictPromisePaymentLinkDate(promisedDate)) return null;
  const amount = record.amountPromised;
  const amountPromised = (amount === null || amount === undefined || amount === '')
    ? null
    : Number(amount);
  if (amountPromised === null || !Number.isFinite(amountPromised) || amountPromised <= 0) return null;
  const paidDateRaw = cleanPromiseLinkText(record.paidDate);
  const paidDate = paidDateRaw && isStrictPromisePaymentLinkDate(paidDateRaw) ? paidDateRaw : '';
  return { id, customer, amountPromised, promisedDate, paidDate };
}

function byPromisedThenId(a, b) {
  if (a.promisedDate !== b.promisedDate) return a.promisedDate < b.promisedDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The customer's still-unpaid promises — open or overdue, the
 * ones a payment can fulfil — earliest promised date first. A
 * promise that already carries a paid date is never offered: it
 * was already paid, so no new payment can fulfil it. The customer
 * may be the customer record ({ id, name }) or a plain id string:
 * the promise's customer field is operator-typed free text, so it
 * is matched against the id and the name alike, case-insensitively.
 * The list never mutates its input.
 */
export function openPromisesForCustomer(promises, customer) {
  if (!Array.isArray(promises)) return [];
  const keys = new Set();
  const candidates = typeof customer === 'string'
    ? [customer]
    : (customer && typeof customer === 'object' ? [customer.id, customer.name] : []);
  for (const field of candidates) {
    const key = cleanPromiseLinkText(field).toLowerCase();
    if (key) keys.add(key);
  }
  if (keys.size === 0) return [];
  const out = [];
  for (const record of promises) {
    const clean = cleanPromiseRecord(record);
    if (!clean) continue;
    if (!keys.has(clean.customer.toLowerCase())) continue;
    if (clean.paidDate) continue;
    out.push(clean);
  }
  return out.sort(byPromisedThenId);
}

/**
 * The entry-form options for the promise picker: a blank "no
 * promise" option first, then one option per unpaid promise —
 * "Rs 3,000 promised by 2026-11-10 (CP-…)". The value is the
 * promise id. Every word is always escaped. The selected id is
 * honoured when it names one of the options.
 */
export function promisePaymentLinkSelectOptions(promises, selectedId) {
  const wanted = cleanPromiseLinkText(selectedId);
  const blank = `<option value=""${wanted ? '' : ' selected'}>No promise</option>`;
  const options = (Array.isArray(promises) ? promises : []).map((record) => {
    const clean = cleanPromiseRecord(record);
    if (!clean) return '';
    const label = `Rs ${clean.amountPromised} promised by ${clean.promisedDate} (${clean.id})`;
    return `<option value="${escapePromiseLinkHtml(clean.id)}"${clean.id === wanted ? ' selected' : ''}>${escapePromiseLinkHtml(label)}</option>`;
  }).join('');
  return blank + options;
}

function escapePromiseLinkHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The payment fulfilling a promise, found by scanning flat
 * transaction rows (the listTransactions projection, which
 * carries the normalized link) for the row whose link names the
 * promise — or null when no payment fulfils it. A voided payment
 * never counts: voided receipts are frozen history, not a kept
 * promise. When several payments link the same promise, the
 * earliest dated one wins (then the lowest payment id), so the
 * promise shows one payment, deterministically.
 */
export function paymentFulfillingPromise(promiseId, rows) {
  const wanted = cleanPromiseLinkText(promiseId);
  if (!wanted || !Array.isArray(rows)) return null;
  let found = null;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || row.voided === true) continue;
    const link = promisePaymentLinkOf(row);
    if (!link || link.promiseId !== wanted) continue;
    if (!found) { found = row; continue; }
    const rowDate = cleanPromiseLinkText(row.date);
    const foundDate = cleanPromiseLinkText(found.date);
    if (rowDate && foundDate && rowDate !== foundDate) {
      if (rowDate < foundDate) found = row;
    } else if (String(row.paymentId ?? row.id ?? '') < String(found.paymentId ?? found.id ?? '')) {
      found = row;
    }
  }
  return found;
}

/**
 * The link in plain words. With the fulfilling payment supplied:
 * "Fulfils promise CP-… — Rs 3,000 on 2026-11-10". Without it:
 * "Fulfils promise CP-…". Empty when the link has nothing to
 * say. The returned text is unescaped: callers that put it in
 * HTML must escape it, as the markup helper below does.
 */
export function promisePaymentLinkLineText(link, payment) {
  const normalized = normalizePromisePaymentLink(link, link?.date);
  if (!normalized) return '';
  let text = `Fulfils promise ${normalized.promiseId}`;
  if (payment && typeof payment === 'object') {
    const amount = Number(payment.amount);
    const date = cleanPromiseLinkText(payment.date);
    if (Number.isFinite(amount)) text += ` — Rs ${amount}`;
    if (date) text += ` on ${date}`;
  }
  return text;
}

/**
 * The link as it appears beside a transaction: a ' · …' suffix
 * for the payment-meta line, or '' when the payment carries no
 * link, so a transaction without one shows nothing extra. The
 * promise id is always escaped.
 */
export function promisePaymentLinkMarkup(payment) {
  const link = promisePaymentLinkOf(payment);
  if (!link) return '';
  return ` · ${escapePromiseLinkHtml(promisePaymentLinkLineText(link))}`;
}

/**
 * The receipt reference printed for a payment: the payment's real
 * stored receipt number, else its permanent receipt number (the
 * same read the receipt-number search uses). Never derived or
 * fabricated — a payment carrying neither yields ''.
 */
export function promiseLinkReceiptRef(payment) {
  return String(payment?.receiptNumber ?? payment?.permanentReceiptNumber ?? '').trim();
}

/**
 * The fulfilment line on a promise's display: "Linked payment:
 * PKR 3,000 on 2026-11-10 (receipt RCPT-…)." — the payment that
 * fulfils this promise, found by scanning the transaction rows.
 * '' when no payment fulfils the promise, so an unlinked promise
 * stays open and shows nothing extra. The amount formatter is
 * the caller's (the app's PKR formatter); without one the amount
 * reads as plain "Rs <amount>". The line says "linked", never
 * "kept" or "paid": the link links only and closes nothing by
 * itself, so the promise record still carries its own status.
 */
export function promiseFulfilmentLineHtml(promise, rows, formatAmount) {
  const clean = cleanPromiseRecord(promise);
  if (!clean) return '';
  const payment = paymentFulfillingPromise(clean.id, rows);
  if (!payment) return '';
  const fmt = typeof formatAmount === 'function' ? formatAmount : (amount) => `Rs ${amount}`;
  const amount = Number(payment.amount);
  const date = cleanPromiseLinkText(payment.date);
  const ref = promiseLinkReceiptRef(payment);
  let text = 'Linked payment:';
  if (Number.isFinite(amount)) text += ` ${escapePromiseLinkHtml(fmt(amount))}`;
  if (date) text += ` on ${escapePromiseLinkHtml(date)}`;
  if (ref) text += ` (receipt ${escapePromiseLinkHtml(ref)})`;
  return `<p>${text}.</p>`;
}
