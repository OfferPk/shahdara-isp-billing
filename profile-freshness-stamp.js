// Customer profile data freshness stamp (Plan 375): one line on the
// profile showing when this profile was last checked, in plain words
// ("checked on <date>"), drawn from the latest per-field change or
// the latest verification tick. Display only: it reads the two records
// the profile already keeps and it syncs nothing; it never changes
// any bill, payment, or customer record by itself. A profile never
// touched shows "never checked".
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

const PROFILE_FRESHNESS_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanProfileFreshnessText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanProfileFreshnessKey(value) {
  return cleanProfileFreshnessText(value).toLowerCase();
}

function isProfileFreshnessLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictProfileFreshnessDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = PROFILE_FRESHNESS_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isProfileFreshnessLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function escapeProfileFreshnessHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The latest strict date of any field change recorded for one
 * customer. The raw list is scanned as given: entries with another
 * customer, or without a strict date, are ignored. Empty when the
 * customer has no dated change.
 */
export function latestFieldChangeDateForCustomer(changes, customerId) {
  const key = cleanProfileFreshnessKey(customerId);
  if (!key || !Array.isArray(changes)) return '';
  let latest = '';
  for (const entry of changes) {
    if (!entry || typeof entry !== 'object') continue;
    if (cleanProfileFreshnessKey(entry.customerId) !== key) continue;
    const date = cleanProfileFreshnessText(entry.date);
    if (!isStrictProfileFreshnessDate(date)) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

/**
 * The strict verified date of the verification tick recorded for one
 * customer, or '' when the profile has no tick. Only one tick exists
 * per profile, so there is no latest-of-many to pick.
 */
export function latestVerificationDateForCustomer(ticks, customerId) {
  const key = cleanProfileFreshnessKey(customerId);
  if (!key || !Array.isArray(ticks)) return '';
  for (const tick of ticks) {
    if (!tick || typeof tick !== 'object') continue;
    if (cleanProfileFreshnessKey(tick.customerId) !== key) continue;
    const date = cleanProfileFreshnessText(tick.verifiedDate);
    return isStrictProfileFreshnessDate(date) ? date : '';
  }
  return '';
}

/**
 * The freshness of one profile: the later of the latest field-change
 * date and the latest verification-tick date. `source` names which
 * record the date came from ('change' or 'verification'); on a tie
 * the verification wins, because a deliberate check beats an edit
 * made the same day. Both empty when the profile was never touched.
 */
export function profileFreshnessForCustomer(changes, ticks, customerId) {
  const changeDate = latestFieldChangeDateForCustomer(changes, customerId);
  const verificationDate = latestVerificationDateForCustomer(ticks, customerId);
  if (!changeDate && !verificationDate) return { date: '', source: '' };
  if (verificationDate && (!changeDate || verificationDate >= changeDate)) {
    return { date: verificationDate, source: 'verification' };
  }
  return { date: changeDate, source: 'change' };
}

const PROFILE_FRESHNESS_DEFAULT_TEXTS = {
  heading: 'Profile freshness',
  checkedOn: 'Checked on {date}.',
  neverChecked: 'Never checked.',
};

/**
 * The stamp in plain words: "Checked on <date>." or "Never checked."
 * `freshness` is the object profileFreshnessForCustomer returns;
 * `texts` carries the heading, the checked-on template (with a
 * {date} placeholder) and the never-checked line in the app's
 * current language. Plain defaults apply when a text is missing.
 */
export function profileFreshnessStampText(freshness, texts) {
  const labels = { ...PROFILE_FRESHNESS_DEFAULT_TEXTS, ...(texts || {}) };
  if (!freshness || typeof freshness !== 'object' || !isStrictProfileFreshnessDate(freshness.date)) {
    return labels.neverChecked;
  }
  return String(labels.checkedOn).replace('{date}', freshness.date);
}

/**
 * The stamp line on the profile: the heading plus "checked on
 * <date>" with the date emphasised, or the "never checked" line
 * when the profile was never touched. Labels come from the caller;
 * plain defaults apply when a label is missing. All text is
 * escaped, so a stored value can never break the markup.
 */
export function profileFreshnessStampHtml(customer, changes, ticks, texts) {
  if (!customer || typeof customer !== 'object') return '';
  const labels = { ...PROFILE_FRESHNESS_DEFAULT_TEXTS, ...(texts || {}) };
  const heading = escapeProfileFreshnessHtml(labels.heading);
  const freshness = profileFreshnessForCustomer(changes, ticks, customer.id);
  if (!freshness.date) {
    return `<section class="profile-freshness-stamp" aria-label="${heading}"><h4>${heading}</h4><p class="dfs-stamp dfs-none">${escapeProfileFreshnessHtml(labels.neverChecked)}</p></section>`;
  }
  const dateHtml = `<strong>${escapeProfileFreshnessHtml(freshness.date)}</strong>`;
  const line = escapeProfileFreshnessHtml(labels.checkedOn).replace('{date}', dateHtml);
  return `<section class="profile-freshness-stamp" aria-label="${heading}"><h4>${heading}</h4><p class="dfs-stamp">${line}</p></section>`;
}
