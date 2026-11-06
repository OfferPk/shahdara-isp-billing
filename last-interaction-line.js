// Customer profile last-interaction line (Plan 371): one line on the
// profile naming the most recent of the last payment, the last visit,
// and the last sent message, with its date, composed from existing
// records only. It is a display line only: it creates no history
// list and no timeline, and it never changes any bill, payment,
// visit, or customer record by itself. A customer with no
// interaction yet shows the "no interaction recorded" line.
//
// The three dates are supplied by the caller from the records the
// profile already uses: the last payment from the balance reply,
// the last visit from the field visit log, and the last sent message
// from the sent-draft records. Only strict YYYY-MM-DD dates count;
// a date that is not strict is ignored, never treated as the latest.
// On the same date, a payment outranks a visit, and a visit
// outranks a message, because money moving is the strongest sign
// the customer was reached that day.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const LAST_INTERACTION_TYPES = ['payment', 'visit', 'message'];

const LAST_INTERACTION_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanLastInteractionText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanLastInteractionKey(value) {
  return cleanLastInteractionText(value).toLowerCase();
}

function isLastInteractionLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictLastInteractionDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = LAST_INTERACTION_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLastInteractionLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function escapeLastInteractionHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * Latest strict visit date for one customer, from the field visit
 * log rows supplied by the caller (each row carries `date` and
 * `customerId`). Customer match is case-insensitive. Returns the
 * date string, or null when the customer has no strictly dated visit.
 */
export function latestVisitDateForCustomer(visits, customerId) {
  const key = cleanLastInteractionKey(customerId);
  if (!key || !Array.isArray(visits)) return null;
  let latest = null;
  for (const visit of visits) {
    if (!visit || typeof visit !== 'object') continue;
    if (cleanLastInteractionKey(visit.customerId) !== key) continue;
    const date = cleanLastInteractionText(visit.date);
    if (!isStrictLastInteractionDate(date)) continue;
    if (latest === null || date > latest) latest = date;
  }
  return latest;
}

/**
 * Latest strict sent-message date for one customer, from the
 * normalized sent-draft rows supplied by the caller (each row
 * carries `sentDate` and `customerId`). Customer match is
 * case-insensitive. Returns the date string, or null when the
 * customer has no strictly dated sent message.
 */
export function latestMessageDateForCustomer(entries, customerId) {
  const key = cleanLastInteractionKey(customerId);
  if (!key || !Array.isArray(entries)) return null;
  let latest = null;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    if (cleanLastInteractionKey(entry.customerId) !== key) continue;
    const date = cleanLastInteractionText(entry.sentDate);
    if (!isStrictLastInteractionDate(date)) continue;
    if (latest === null || date > latest) latest = date;
  }
  return latest;
}

/**
 * The most recent interaction from the three caller-supplied dates.
 * Returns `{ type, date }`, or null when no date is a strict date.
 * Ties are broken payment first, then visit, then message.
 */
export function lastInteractionFor(dates) {
  if (!dates || typeof dates !== 'object') return null;
  const candidates = [
    { type: 'payment', date: cleanLastInteractionText(dates.paymentDate) },
    { type: 'visit', date: cleanLastInteractionText(dates.visitDate) },
    { type: 'message', date: cleanLastInteractionText(dates.messageDate) },
  ];
  let best = null;
  for (const candidate of candidates) {
    if (!isStrictLastInteractionDate(candidate.date)) continue;
    if (best === null || candidate.date > best.date) best = candidate;
  }
  return best ? { type: best.type, date: best.date } : null;
}

const LAST_INTERACTION_DEFAULT_TEXTS = {
  heading: 'Last interaction',
  payment: 'Last payment',
  visit: 'Last visit',
  message: 'Last message',
  none: 'No interaction recorded',
};

/**
 * One line on the profile: the latest interaction type and its date,
 * or the "no interaction recorded" line when there is none. Labels
 * come from the caller; plain defaults apply when a label is missing.
 * All text is escaped.
 */
export function lastInteractionLineHtml(latest, texts) {
  const labels = { ...LAST_INTERACTION_DEFAULT_TEXTS, ...(texts || {}) };
  const heading = escapeLastInteractionHtml(labels.heading);
  if (!latest || typeof latest !== 'object' || !isStrictLastInteractionDate(latest.date)) {
    return `<section class="profile-last-interaction" aria-label="${heading}"><h4>${heading}</h4><p class="lil-line lil-none">${escapeLastInteractionHtml(labels.none)}</p></section>`;
  }
  const typeLabel = latest.type === 'payment'
    ? labels.payment
    : latest.type === 'visit'
      ? labels.visit
      : labels.message;
  return `<section class="profile-last-interaction" aria-label="${heading}"><h4>${heading}</h4><p class="lil-line">${escapeLastInteractionHtml(typeLabel)}: <strong>${escapeLastInteractionHtml(latest.date)}</strong></p></section>`;
}
