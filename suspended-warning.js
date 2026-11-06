// Transaction warning when the customer is suspended (Plan 388): a
// suspended customer pays at the counter and the operator takes the
// money without realising the service is suspended, so the customer
// leaves still disconnected and angry. On the transaction entry form
// the warning says, in plain words, that the service is suspended —
// the payment is recorded, and reconnection needs its own step — so
// the operator can tell a returning customer at the moment of
// payment, before they walk home expecting the net to work.
//
// The warning only reads. It warns and blocks nothing, takes the
// payment normally, and never changes any suspension, reconnection,
// bill, or payment record by itself: the caller supplies the
// suspension records (the same list the app itself loads) and the
// customer, and the warning is shown only while that customer holds
// an open suspension record — a closed record, another customer's
// record, or no record at all warns about nothing. The suspension
// record itself (Plan 83) is a different thing and is left
// untouched: this module never reads it, never writes it, and never
// reconnects anyone.
//
// The module never reads storage, the clock, the network, or the
// page. Inputs are never mutated. A suspension date is shown only
// when it is a strict real calendar date; anything else is dropped,
// never guessed.

const SUSPENDED_WARNING_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isSuspendedWarningLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function labelOr(labels, key, fallback) {
  const value = labels?.[key];
  return typeof value === 'string' && value ? value : fallback;
}

/**
 * Strict YYYY-MM-DD validation against the real calendar (leap-aware).
 * A date that is not a real calendar date is never shown on the
 * warning, so a damaged record cannot print a made-up suspension day.
 */
export function isStrictSuspendedWarningDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = SUSPENDED_WARNING_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isSuspendedWarningLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

/**
 * The customer's open suspension record, or null when there is none
 * to warn about: the records are not a list, the customer is not
 * given, the record is not an object, its status is not open, or its
 * customer is someone else. A closed suspension never warns — the
 * service is back — and a record for another customer never warns
 * this one. The first open record wins; the list is never mutated.
 * The status check is the app's own idiom: only 'open' counts.
 */
export function openSuspensionFor(records, customerId) {
  if (!Array.isArray(records)) return null;
  if (customerId === null || customerId === undefined || customerId === '') return null;
  const wanted = String(customerId);
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    if (record.status !== 'open') continue;
    if (record.customerId === null || record.customerId === undefined || record.customerId === '') continue;
    if (String(record.customerId) !== wanted) continue;
    return record;
  }
  return null;
}

/**
 * The warning in plain words for one open suspension record, or ''
 * when there is no record to warn about. The core sentence is always
 * the same — the service is suspended, the payment is recorded, and
 * reconnection needs its own step — with the suspension day added
 * only when it is a strict real calendar date. Labels may supply the
 * two halves in another language; the date is never relabelled.
 */
export function suspendedWarningLineText(record, labels = {}) {
  if (!record || typeof record !== 'object') return '';
  const suspended = labelOr(labels, 'suspended', 'Service suspended');
  const reconnection = labelOr(labels, 'reconnection', 'payment recorded, reconnection needs its own step');
  const date = isStrictSuspendedWarningDate(record.date) ? ` since ${record.date}` : '';
  return `${suspended}${date} — ${reconnection}`;
}

/**
 * The warning as escaped markup for the entry form, or '' when there
 * is no open suspension to warn about. The caller escapes nothing:
 * a suspension date or label carrying markup is printed as text.
 */
export function suspendedWarningMarkup(record, labels = {}) {
  const line = suspendedWarningLineText(record, labels);
  return line === '' ? '' : escapeHtml(line);
}
