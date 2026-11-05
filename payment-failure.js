// Plan 215 (Plan 203-350) — Payment Channel Failure Note (failed
// mobile-wallet attempt log).
//
// A failed Easypaisa or JazzCash attempt used to be told to the
// collector verbally and lost, so the same customer was later shown
// as simply not having paid, with no trace of the failed attempt.
// This module records one failure note per failed attempt: customer,
// channel, date, amount attempted, plain-words reason as reported,
// and a reference if one was given. A genuine failed wallet payment
// is then distinguishable from a customer who never tried, which
// keeps the conversation fair on the next visit.
//
// What this module is NOT, stated plainly:
//   - It is not a payment. Recording a failure creates no payment,
//     settles no bill, and never appears in collections.
//   - It never retries anything. A failed attempt stays failed;
//     the collector acts on it by hand.
//   - It is not the payment-channel record (Plan 40). That record
//     holds a customer's preferred channel and its instruction
//     line; this module holds failed attempts only and never reads
//     or writes any channel choice.
//   - It is not the pending-clearance record (Plan 123). That
//     record tracks cheque and bank-transfer payments waiting for
//     clearance; wallet attempts do not wait for clearance, and
//     this module never reads or writes any clearance record.
//   - It is not wallet reconciliation (Plan V). Reconciliation
//     matches money that moved; this module records attempts where
//     no money moved, and never reads or writes any
//     reconciliation record.
//   - Recording a failure never changes any bill, payment,
//     customer, or staff record by itself.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input. Dates compare as
//     YYYY-MM-DD strings, so no Date object is ever used.
//   - A note with no id, no customer, no channel, no strict
//     date, or no positive amount attempted is refused outright.
//     Unknown fields are dropped, so a note can never grow a
//     bill, payment, settlement, or customer-status field.
//   - A duplicate id is never rewritten: a re-save with
//     different figures also leaves the list unchanged. There is
//     no edit function; only recording a failure and removal.
//   - The reason is stored exactly as reported, in plain words;
//     the module verifies format only, never the truth of it.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cleanPositiveAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function normalizePaymentFailure(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const channel = cleanText(record.channel);
  const date = cleanText(record.date);
  if (!id || !customer || !channel || !isStrictDate(date)) return null;
  const amountAttempted = cleanPositiveAmount(record.amountAttempted);
  if (amountAttempted === null) return null;
  return {
    id,
    customer,
    channel,
    date,
    amountAttempted,
    reason: cleanText(record.reason),
    reference: cleanText(record.reference),
  };
}

export function normalizePaymentFailureList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const record = normalizePaymentFailure(item);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

export function findPaymentFailure(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return null;
  return normalizePaymentFailureList(list).find((record) => record.id === wanted) || null;
}

export function recordPaymentFailure(list, record) {
  const base = normalizePaymentFailureList(list);
  const next = normalizePaymentFailure(record);
  if (!next) return base;
  if (base.some((record) => record.id === next.id)) return base;
  return [...base, next];
}

export function removePaymentFailure(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return normalizePaymentFailureList(list);
  return normalizePaymentFailureList(list).filter((record) => record.id !== wanted);
}

function byDateThenCustomer(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const customerA = cleanKey(a.customer);
  const customerB = cleanKey(b.customer);
  if (customerA !== customerB) return customerA < customerB ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function paymentFailuresSorted(list) {
  return normalizePaymentFailureList(list).sort(byDateThenCustomer);
}

export function paymentFailuresForCustomer(list, customerQuery) {
  const wanted = cleanKey(customerQuery);
  if (!wanted) return [];
  return paymentFailuresSorted(list).filter((record) => cleanKey(record.customer).includes(wanted));
}

export function paymentFailuresForChannel(list, channel) {
  const wanted = cleanKey(channel);
  if (!wanted) return [];
  return paymentFailuresSorted(list).filter((record) => cleanKey(record.channel) === wanted);
}

export function paymentFailureCountsForCustomer(list, customerQuery) {
  const failures = paymentFailuresForCustomer(list, customerQuery);
  const byChannel = {};
  for (const failure of failures) {
    byChannel[failure.channel] = (byChannel[failure.channel] || 0) + 1;
  }
  return { total: failures.length, byChannel };
}

export function paymentFailureText(record) {
  const normalized = normalizePaymentFailure(record);
  if (!normalized) return '';
  const reason = normalized.reason ? normalized.reason.replace(/\.+$/, '') : 'No reason noted';
  const reference = normalized.reference ? ` Reference: ${normalized.reference}.` : ' No reference given.';
  return `${normalized.customer}: Rs ${normalized.amountAttempted} attempted via ${normalized.channel} on ${normalized.date} — failed. ${reason}.${reference}`;
}

export function paymentFailureSummaryText(list) {
  const failures = normalizePaymentFailureList(list);
  if (!failures.length) return 'No failed payment attempts recorded.';
  return failures.length === 1
    ? '1 failed payment attempt recorded.'
    : `${failures.length} failed payment attempts recorded.`;
}

export function paymentFailureHtml(record) {
  const normalized = normalizePaymentFailure(record);
  if (!normalized) return '';
  const reason = normalized.reason ? escapeHtml(normalized.reason).replace(/\.+$/, '') : 'No reason noted';
  const reference = normalized.reference ? ` Reference: ${escapeHtml(normalized.reference)}.` : ' No reference given.';
  return `<p><strong>${escapeHtml(normalized.customer)}</strong>: Rs ${normalized.amountAttempted} attempted via ${escapeHtml(normalized.channel)} on ${escapeHtml(normalized.date)} — failed. ${reason}.${reference}</p>`;
}

export function paymentFailureAllHtml(list) {
  return paymentFailuresSorted(list).map(paymentFailureHtml).join('');
}

export function paymentFailureCsv(list) {
  const rows = paymentFailuresSorted(list).map((record) => [
    record.id,
    record.customer,
    record.channel,
    record.date,
    record.amountAttempted,
    record.reason,
    record.reference,
  ].map(csvCell).join(','));
  return ['id,customer,channel,date,amount_attempted,reason,reference', ...rows].join('\n');
}

export function paymentFailureFilename() {
  return 'payment-failures.csv';
}
