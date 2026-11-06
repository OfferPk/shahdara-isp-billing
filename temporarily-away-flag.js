// Customer temporarily-away flag (Plan 373): one flag per profile —
// away from date, expected return date where known, and a short note —
// shown on the profile and on round lists. It is a flag only: it never
// changes any bill, payment, due date, or customer record by itself.
// It is not a seasonal hold, an exit, or an archive — those live in
// their own records and are left alone here. A flagged customer
// appears as "away until <date>" on round lists and is skipped from
// visit reminders while flagged; clearing the flag removes only the
// flag, and the customer returns to a clean record.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const TEMPORARILY_AWAY_FLAG_STORE_KEY = 'shahdara_taw_flags_v1';
export const TEMPORARILY_AWAY_NOTE_MAX_LENGTH = 200;

const TEMPORARILY_AWAY_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanTemporarilyAwayText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanTemporarilyAwayKey(value) {
  return cleanTemporarilyAwayText(value).toLowerCase();
}

function isTemporarilyAwayLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictTemporarilyAwayDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = TEMPORARILY_AWAY_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isTemporarilyAwayLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function escapeTemporarilyAwayHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function normalizeTemporarilyAwayFlag(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanTemporarilyAwayText(raw.id);
  const customerId = cleanTemporarilyAwayText(raw.customerId);
  const awayFrom = cleanTemporarilyAwayText(raw.awayFrom);
  const returnDate = cleanTemporarilyAwayText(raw.returnDate);
  const note = cleanTemporarilyAwayText(raw.note).slice(0, TEMPORARILY_AWAY_NOTE_MAX_LENGTH);
  if (!id || !customerId) return null;
  if (!isStrictTemporarilyAwayDate(awayFrom)) return null;
  // An expected return date is optional, but when one is given it must
  // be a strict date on or after the away-from date — a return before
  // the customer even left is refused, never silently kept.
  if (returnDate && (!isStrictTemporarilyAwayDate(returnDate) || returnDate < awayFrom)) return null;
  return { id, customerId, awayFrom, returnDate, note };
}

export function normalizeTemporarilyAwayFlagList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const flag = normalizeTemporarilyAwayFlag(raw);
    if (!flag) continue;
    const idKey = cleanTemporarilyAwayKey(flag.id);
    const customerKey = cleanTemporarilyAwayKey(flag.customerId);
    if (seenIds.has(idKey)) continue;
    if (seenCustomers.has(customerKey)) continue;
    seenIds.add(idKey);
    seenCustomers.add(customerKey);
    out.push(flag);
  }
  return out;
}

/**
 * Read the flag list from a storage-like object ({ getItem }) — the
 * round list passes its storage in, so the same list is read once per
 * recalculation. Returns [] when storage is missing or unreadable.
 */
export function loadTemporarilyAwayFlagList(storage) {
  try {
    const raw = storage?.getItem?.(TEMPORARILY_AWAY_FLAG_STORE_KEY);
    return normalizeTemporarilyAwayFlagList(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

/**
 * Record (or replace) the temporarily-away flag for one customer. One
 * flag per customer: recording a new flag for a customer who already
 * has one replaces that flag in place. Returns the list unchanged when
 * the flag is invalid (no id, no customer, no strict away-from date,
 * or a return date before the away-from date).
 */
export function recordTemporarilyAwayFlag(list, flag) {
  const normalized = normalizeTemporarilyAwayFlagList(list);
  const fresh = normalizeTemporarilyAwayFlag(flag);
  if (!fresh) return normalized;
  const customerKey = cleanTemporarilyAwayKey(fresh.customerId);
  let replaced = false;
  const out = normalized.map(existing => {
    if (cleanTemporarilyAwayKey(existing.customerId) !== customerKey) return existing;
    replaced = true;
    return fresh;
  });
  return replaced ? out : [...normalized, fresh];
}

/** Clear the temporarily-away flag for one customer; nothing else changes. */
export function removeTemporarilyAwayFlag(list, customerId) {
  const normalized = normalizeTemporarilyAwayFlagList(list);
  const customerKey = cleanTemporarilyAwayKey(customerId);
  if (!customerKey) return normalized;
  return normalized.filter(flag => cleanTemporarilyAwayKey(flag.customerId) !== customerKey);
}

export function temporarilyAwayFlagForCustomer(list, customerId) {
  const key = cleanTemporarilyAwayKey(customerId);
  if (!key) return null;
  return normalizeTemporarilyAwayFlagList(list).find(flag => cleanTemporarilyAwayKey(flag.customerId) === key) ?? null;
}

export function hasTemporarilyAwayFlag(list, customerId) {
  return temporarilyAwayFlagForCustomer(list, customerId) !== null;
}

/**
 * Is the flag active on a given day (strict YYYY-MM-DD)? Active from
 * the away-from date up to and including the expected return date; a
 * flag with no return date stays active from the away-from date on.
 * A flag that starts in the future, or whose return date has passed,
 * is not active — the operator clears it on the customer's return.
 */
export function isTemporarilyAwayFlagActive(flag, today) {
  const clean = normalizeTemporarilyAwayFlag(flag);
  if (!clean) return false;
  if (!isStrictTemporarilyAwayDate(today)) return false;
  if (today < clean.awayFrom) return false;
  if (clean.returnDate && today > clean.returnDate) return false;
  return true;
}

function fillTemporarilyAwayDate(template, date) {
  const text = cleanTemporarilyAwayText(template);
  if (!text) return date;
  return text.includes('{date}') ? text.replace('{date}', date) : `${text} ${date}`;
}

/** Plain-words flag text: "away until <date>", or "away since <date>" when no return date is known. */
export function temporarilyAwayFlagText(flag, labels = {}) {
  const clean = normalizeTemporarilyAwayFlag(flag);
  if (!clean) return '';
  const until = cleanTemporarilyAwayText(labels.awayUntil) || 'Away until {date}';
  const since = cleanTemporarilyAwayText(labels.awaySince) || 'Away since {date}';
  const noReturn = cleanTemporarilyAwayText(labels.noReturnDate) || 'return date not known';
  const base = clean.returnDate
    ? fillTemporarilyAwayDate(until, clean.returnDate)
    : `${fillTemporarilyAwayDate(since, clean.awayFrom)} · ${noReturn}`;
  return clean.note ? `${base} · ${clean.note}` : base;
}

/** One line for a round list beside the customer; empty when there is no flag or the flag is not active today. */
export function temporarilyAwayLineHtml(flag, today, labels = {}) {
  if (!isTemporarilyAwayFlagActive(flag, today)) return '';
  const text = temporarilyAwayFlagText(flag, labels);
  if (!text) return '';
  return `<div class="taw-route-line">🏠 ${escapeTemporarilyAwayHtml(text)}</div>`;
}

export function temporarilyAwayFlagSectionHtml(customer, list, labels = {}) {
  if (!customer || typeof customer !== 'object') return '';
  const flag = temporarilyAwayFlagForCustomer(list, customer.id);
  const heading = cleanTemporarilyAwayText(labels.heading) || 'Temporarily away';
  const intro = cleanTemporarilyAwayText(labels.intro) || 'Away for a few weeks — harvest, family visit, or travel. This flag only marks the customer away; it never changes any bill, payment, due date, or record.';
  const awayFromLabel = cleanTemporarilyAwayText(labels.awayFrom) || 'Away from';
  const returnDateLabel = cleanTemporarilyAwayText(labels.returnDate) || 'Expected return';
  const noteLabel = cleanTemporarilyAwayText(labels.note) || 'Note';
  const notePlaceholder = cleanTemporarilyAwayText(labels.notePlaceholder) || 'e.g. Harvest in the village';
  const saveLabel = cleanTemporarilyAwayText(labels.save) || 'Save';
  const removeLabel = cleanTemporarilyAwayText(labels.remove) || 'Remove';
  const noneText = cleanTemporarilyAwayText(labels.none) || 'Not away — no flag recorded.';
  const currentHtml = flag
    ? `<p class="taw-current"><strong>🏠 ${escapeTemporarilyAwayHtml(temporarilyAwayFlagText(flag, labels))}</strong></p>`
    : `<p class="taw-none">${escapeTemporarilyAwayHtml(noneText)}</p>`;
  const formHtml = `<form class="taw-form" id="tawForm"><label for="tawFrom">${escapeTemporarilyAwayHtml(awayFromLabel)}<input id="tawFrom" type="date" value="${flag ? escapeTemporarilyAwayHtml(flag.awayFrom) : ''}" required></label><label for="tawUntil">${escapeTemporarilyAwayHtml(returnDateLabel)}<input id="tawUntil" type="date" value="${flag ? escapeTemporarilyAwayHtml(flag.returnDate) : ''}"></label><label for="tawNote">${escapeTemporarilyAwayHtml(noteLabel)}<input id="tawNote" type="text" maxlength="200" placeholder="${escapeTemporarilyAwayHtml(notePlaceholder)}" value="${flag ? escapeTemporarilyAwayHtml(flag.note) : ''}"></label><button type="submit" class="primary-button" id="tawSaveBtn">${escapeTemporarilyAwayHtml(saveLabel)}</button>${flag ? `<button type="button" class="secondary-button" id="tawRemoveBtn">${escapeTemporarilyAwayHtml(removeLabel)}</button>` : ''}</form>`;
  return `<section class="profile-custody-section temporarily-away-flag" aria-label="${escapeTemporarilyAwayHtml(heading)}"><h4>${escapeTemporarilyAwayHtml(heading)}</h4><p>${escapeTemporarilyAwayHtml(intro)}</p>${currentHtml}${formHtml}</section>`;
}
