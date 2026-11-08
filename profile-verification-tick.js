// Customer profile verification tick (Plan 372): one verification
// tick per profile, recorded by the operator — verified by whom, on
// what date, and which of the four fields were checked that day
// (name, number, mohalla, and package, as shown that day). The tick
// verifies the record only: it changes no bill, payment, or customer
// field by itself, and it is never sent anywhere. A profile never
// verified shows "not checked yet" (Plan 514: one wording pair —
// "Checked on …" / "Not checked yet" — shared with the freshness
// stamp, so both signals answer "is this record current?" in the
// same words). Other verification records in the app cover backups,
// exports, receipts, and restores — none of them is a per-profile
// tick, so only the missing piece is added here.
//
// Plan 514: the section also takes an optional `formatDate`
// function (a date string in, display text out — the app passes its
// humanDate) so the tick and the stamp share one date format; the
// date input itself keeps the raw ISO value. A null or empty
// `labels.heading` means the caller renders the one group heading
// itself: the section then carries no <h4> of its own.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const PROFILE_VERIFICATION_TICK_STORE_KEY = 'shahdara_pvt_ticks_v1';
export const PROFILE_VERIFICATION_TICK_BY_MAX_LENGTH = 60;
export const PROFILE_VERIFICATION_TICK_FIELDS = ['name', 'number', 'mohalla', 'package'];

const PROFILE_VERIFICATION_TICK_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanProfileVerificationTickText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanProfileVerificationTickKey(value) {
  return cleanProfileVerificationTickText(value).toLowerCase();
}

function isProfileVerificationTickLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictProfileVerificationTickDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = PROFILE_VERIFICATION_TICK_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isProfileVerificationTickLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function escapeProfileVerificationTickHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** Clean a fields-checked list to the known fields, in fixed order, deduped. */
export function cleanProfileVerificationTickFields(value) {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(value.map(item => cleanProfileVerificationTickText(item)));
  return PROFILE_VERIFICATION_TICK_FIELDS.filter(field => wanted.has(field));
}

export function normalizeProfileVerificationTick(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanProfileVerificationTickText(raw.id);
  const customerId = cleanProfileVerificationTickText(raw.customerId);
  const verifiedBy = cleanProfileVerificationTickText(raw.verifiedBy).slice(0, PROFILE_VERIFICATION_TICK_BY_MAX_LENGTH);
  const verifiedDate = cleanProfileVerificationTickText(raw.verifiedDate);
  const fieldsChecked = cleanProfileVerificationTickFields(raw.fieldsChecked);
  if (!id || !customerId) return null;
  if (!verifiedBy) return null;
  if (!isStrictProfileVerificationTickDate(verifiedDate)) return null;
  if (fieldsChecked.length === 0) return null;
  return { id, customerId, verifiedBy, verifiedDate, fieldsChecked };
}

export function normalizeProfileVerificationTickList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const tick = normalizeProfileVerificationTick(raw);
    if (!tick) continue;
    const idKey = cleanProfileVerificationTickKey(tick.id);
    const customerKey = cleanProfileVerificationTickKey(tick.customerId);
    if (seenIds.has(idKey)) continue;
    if (seenCustomers.has(customerKey)) continue;
    seenIds.add(idKey);
    seenCustomers.add(customerKey);
    out.push(tick);
  }
  return out;
}

/**
 * Record (or replace) the verification tick for one profile. One tick
 * per profile: recording a new tick for a profile that already has one
 * replaces that tick in place. Returns the list unchanged when the
 * tick is invalid (no id, no customer, no verifier, no strict date,
 * or no field checked).
 */
export function recordProfileVerificationTick(list, tick) {
  const normalized = normalizeProfileVerificationTickList(list);
  const fresh = normalizeProfileVerificationTick(tick);
  if (!fresh) return normalized;
  const customerKey = cleanProfileVerificationTickKey(fresh.customerId);
  let replaced = false;
  const out = normalized.map(existing => {
    if (cleanProfileVerificationTickKey(existing.customerId) !== customerKey) return existing;
    replaced = true;
    return fresh;
  });
  return replaced ? out : [...normalized, fresh];
}

/** Remove the verification tick for one profile; nothing else changes. */
export function removeProfileVerificationTick(list, customerId) {
  const normalized = normalizeProfileVerificationTickList(list);
  const customerKey = cleanProfileVerificationTickKey(customerId);
  if (!customerKey) return normalized;
  return normalized.filter(tick => cleanProfileVerificationTickKey(tick.customerId) !== customerKey);
}

export function profileVerificationTickForCustomer(list, customerId) {
  const key = cleanProfileVerificationTickKey(customerId);
  if (!key) return null;
  return normalizeProfileVerificationTickList(list).find(tick => cleanProfileVerificationTickKey(tick.customerId) === key) ?? null;
}

export function hasProfileVerificationTick(list, customerId) {
  return profileVerificationTickForCustomer(list, customerId) !== null;
}

export function profileVerificationTickSummaryText(list) {
  const count = normalizeProfileVerificationTickList(list).length;
  if (count === 0) return 'No profile verified yet.';
  if (count === 1) return '1 profile verified.';
  return `${count} profiles verified.`;
}

function profileVerificationTickFieldLabel(field, labels) {
  const defaults = { name: 'Name', number: 'Number', mohalla: 'Mohalla', package: 'Package' };
  const supplied = labels && typeof labels === 'object' && labels.fields && typeof labels.fields === 'object' ? labels.fields : {};
  return cleanProfileVerificationTickText(supplied[field]) || defaults[field];
}

export function profileVerificationTickSectionHtml(customer, list, labels = {}, formatDate) {
  if (!customer || typeof customer !== 'object') return '';
  const tick = profileVerificationTickForCustomer(list, customer.id);
  // Plan 514: a null or empty heading means the caller renders the
  // one group heading itself — the tick then carries no <h4> of its
  // own. The section keeps its class and its aria-label, which falls
  // back to the default heading.
  const heading = (labels.heading === null || labels.heading === '') ? '' : (cleanProfileVerificationTickText(labels.heading) || 'Profile verification');
  const ariaLabel = heading || 'Profile verification';
  const intro = cleanProfileVerificationTickText(labels.intro) || 'A quick yearly check keeps every profile trustworthy. This tick verifies the record only — it changes no field.';
  const verifiedByLabel = cleanProfileVerificationTickText(labels.verifiedBy) || 'Verified by';
  const dateLabel = cleanProfileVerificationTickText(labels.date) || 'Date';
  const fieldsLabel = cleanProfileVerificationTickText(labels.fieldsHeading) || 'Fields checked';
  const saveLabel = cleanProfileVerificationTickText(labels.save) || 'Save';
  const removeLabel = cleanProfileVerificationTickText(labels.remove) || 'Remove';
  const noneText = cleanProfileVerificationTickText(labels.none) || 'Not checked yet.';
  const fieldNames = PROFILE_VERIFICATION_TICK_FIELDS.map(field => profileVerificationTickFieldLabel(field, labels));
  // Plan 514: the display line uses the shared date formatter; the
  // date input below keeps the raw ISO value it needs.
  const displayDate = tick ? (typeof formatDate === 'function' ? formatDate(tick.verifiedDate) : tick.verifiedDate) : '';
  const currentHtml = tick
    ? `<p class="pvt-current"><strong>✓ ${escapeProfileVerificationTickHtml(tick.verifiedBy)}</strong><span class="pvt-meta"> — ${escapeProfileVerificationTickHtml(displayDate)} · ${tick.fieldsChecked.map(field => escapeProfileVerificationTickHtml(profileVerificationTickFieldLabel(field, labels))).join(', ')}</span></p>`
    : `<p class="pvt-none">${escapeProfileVerificationTickHtml(noneText)}</p>`;
  const checksHtml = PROFILE_VERIFICATION_TICK_FIELDS.map((field, index) => `<label class="pvt-field"><input type="checkbox" name="pvtField" value="${field}"${!tick || tick.fieldsChecked.includes(field) ? ' checked' : ''}> ${escapeProfileVerificationTickHtml(fieldNames[index])}</label>`).join('');
  const formHtml = `<form class="pvt-form" id="pvtForm"><label for="pvtBy">${escapeProfileVerificationTickHtml(verifiedByLabel)}<input id="pvtBy" type="text" maxlength="60" value="${tick ? escapeProfileVerificationTickHtml(tick.verifiedBy) : ''}" required></label><label for="pvtDate">${escapeProfileVerificationTickHtml(dateLabel)}<input id="pvtDate" type="date" value="${tick ? escapeProfileVerificationTickHtml(tick.verifiedDate) : ''}" required></label><fieldset class="pvt-fields"><legend>${escapeProfileVerificationTickHtml(fieldsLabel)}</legend>${checksHtml}</fieldset><button type="submit" class="primary-button" id="pvtSaveBtn">${escapeProfileVerificationTickHtml(saveLabel)}</button>${tick ? `<button type="button" class="secondary-button" id="pvtRemoveBtn">${escapeProfileVerificationTickHtml(removeLabel)}</button>` : ''}</form>`;
  return `<section class="profile-custody-section profile-verification-tick" aria-label="${escapeProfileVerificationTickHtml(ariaLabel)}">${heading ? `<h4>${escapeProfileVerificationTickHtml(heading)}</h4>` : ''}<p>${escapeProfileVerificationTickHtml(intro)}</p>${currentHtml}${formHtml}</section>`;
}
