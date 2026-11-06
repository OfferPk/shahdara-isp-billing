// Customer preferred collection day note (Plan 365): one note per
// customer — the weekday, or the date of the month, the customer
// prefers Saad to call, in plain words, plus a short reason. It is
// shown on the profile and beside the customer on the collection
// round list, so the collector knocks when the customer expects him.
// It sets no due date and no visit time window — it only says when
// the customer prefers to be visited — and it never changes any bill,
// payment, due date, or visit record by itself. A customer without
// one shows nothing extra.
//
// The note is not the due-date shift rule that moves a due date off a
// closed day, not the preferred visit time window record that says
// which part of the day suits, and not the habitual payment-day
// analysis that derives a usual pay day from past payments: this is
// the day the customer SAID suits them, recorded in their own words.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const PREFERRED_COLLECTION_DAY_STORE_KEY = 'shahdara_pcd_notes_v1';
export const PREFERRED_COLLECTION_DAY_REASON_MAX_LENGTH = 120;
export const PREFERRED_COLLECTION_DAY_BY_MAX_LENGTH = 60;
export const PREFERRED_COLLECTION_DAY_KIND_WEEKDAY = 'weekday';
export const PREFERRED_COLLECTION_DAY_KIND_DAY_OF_MONTH = 'dayOfMonth';
export const PREFERRED_COLLECTION_DAY_WEEKDAY_NAMES = Object.freeze([
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]);

const PREFERRED_COLLECTION_DAY_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanPreferredCollectionDayText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanPreferredCollectionDayKey(value) {
  return cleanPreferredCollectionDayText(value).toLowerCase();
}

function isPreferredCollectionDayLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictPreferredCollectionDayDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = PREFERRED_COLLECTION_DAY_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isPreferredCollectionDayLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

/** English ordinal for a day of the month: 1st, 2nd, 3rd, 4th, 21st, 31st. */
export function preferredCollectionDayOrdinal(dayOfMonth) {
  const day = Number(dayOfMonth);
  if (!Number.isInteger(day) || day < 1 || day > 31) return '';
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

function escapePreferredCollectionDayHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function normalizePreferredCollectionDay(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanPreferredCollectionDayText(raw.id);
  const customerId = cleanPreferredCollectionDayText(raw.customerId);
  const kind = cleanPreferredCollectionDayText(raw.kind);
  const reason = cleanPreferredCollectionDayText(raw.reason).slice(0, PREFERRED_COLLECTION_DAY_REASON_MAX_LENGTH);
  const notedBy = cleanPreferredCollectionDayText(raw.notedBy).slice(0, PREFERRED_COLLECTION_DAY_BY_MAX_LENGTH);
  const notedDate = cleanPreferredCollectionDayText(raw.notedDate);
  if (!id || !customerId) return null;
  if (kind !== PREFERRED_COLLECTION_DAY_KIND_WEEKDAY && kind !== PREFERRED_COLLECTION_DAY_KIND_DAY_OF_MONTH) return null;
  if (!reason) return null;
  if (notedDate && !isStrictPreferredCollectionDayDate(notedDate)) return null;
  if (kind === PREFERRED_COLLECTION_DAY_KIND_WEEKDAY) {
    const weekday = Number(raw.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
    return { id, customerId, kind, weekday, dayOfMonth: null, reason, notedBy, notedDate };
  }
  const dayOfMonth = Number(raw.dayOfMonth);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return null;
  return { id, customerId, kind, weekday: null, dayOfMonth, reason, notedBy, notedDate };
}

export function normalizePreferredCollectionDayList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizePreferredCollectionDay(raw);
    if (!note) continue;
    const idKey = cleanPreferredCollectionDayKey(note.id);
    const customerKey = cleanPreferredCollectionDayKey(note.customerId);
    if (seenIds.has(idKey)) continue;
    if (seenCustomers.has(customerKey)) continue;
    seenIds.add(idKey);
    seenCustomers.add(customerKey);
    out.push(note);
  }
  return out;
}

/**
 * Read the note list from a storage-like object (the caller supplies
 * storage; this module never touches the page store itself). A missing
 * or unreadable store reads as an empty list.
 */
export function loadPreferredCollectionDayList(storage) {
  try {
    const raw = storage?.getItem?.(PREFERRED_COLLECTION_DAY_STORE_KEY);
    return normalizePreferredCollectionDayList(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

/**
 * Record (or replace) the preferred collection day note for one
 * customer. One note per customer: recording a new note for a
 * customer who already has one replaces that note in place. Returns
 * the list unchanged when the note is invalid (no id, no customer,
 * no reason, unknown kind, or a weekday / date outside its range).
 */
export function recordPreferredCollectionDay(list, note) {
  const normalized = normalizePreferredCollectionDayList(list);
  const fresh = normalizePreferredCollectionDay(note);
  if (!fresh) return normalized;
  const customerKey = cleanPreferredCollectionDayKey(fresh.customerId);
  let replaced = false;
  const out = normalized.map(existing => {
    if (cleanPreferredCollectionDayKey(existing.customerId) !== customerKey) return existing;
    replaced = true;
    return fresh;
  });
  return replaced ? out : [...normalized, fresh];
}

/** Remove the preferred collection day note for one customer; nothing else changes. */
export function removePreferredCollectionDay(list, customerId) {
  const normalized = normalizePreferredCollectionDayList(list);
  const customerKey = cleanPreferredCollectionDayKey(customerId);
  if (!customerKey) return normalized;
  return normalized.filter(note => cleanPreferredCollectionDayKey(note.customerId) !== customerKey);
}

export function preferredCollectionDayForCustomer(list, customerId) {
  const key = cleanPreferredCollectionDayKey(customerId);
  if (!key) return null;
  return normalizePreferredCollectionDayList(list).find(note => cleanPreferredCollectionDayKey(note.customerId) === key) ?? null;
}

export function hasPreferredCollectionDay(list, customerId) {
  return preferredCollectionDayForCustomer(list, customerId) !== null;
}

export function preferredCollectionDaySummaryText(list) {
  const count = normalizePreferredCollectionDayList(list).length;
  if (count === 0) return 'No preferred collection day recorded.';
  if (count === 1) return '1 customer has a preferred collection day.';
  return `${count} customers have a preferred collection day.`;
}

/**
 * The note in plain words: "Every Saturday — salary day" or "On the
 * 7th of each month — pension day". Weekday names default to English
 * (the same convention as the promised-date weekday); the caller may
 * pass its own seven names, Sunday first.
 */
export function preferredCollectionDayText(note, weekdayNames = PREFERRED_COLLECTION_DAY_WEEKDAY_NAMES) {
  const fresh = normalizePreferredCollectionDay(note);
  if (!fresh) return '';
  const names = Array.isArray(weekdayNames) && weekdayNames.length === 7 ? weekdayNames : PREFERRED_COLLECTION_DAY_WEEKDAY_NAMES;
  const dayText = fresh.kind === PREFERRED_COLLECTION_DAY_KIND_WEEKDAY
    ? `Every ${names[fresh.weekday] || PREFERRED_COLLECTION_DAY_WEEKDAY_NAMES[fresh.weekday]}`
    : `On the ${preferredCollectionDayOrdinal(fresh.dayOfMonth)} of each month`;
  return `${dayText} — ${fresh.reason}`;
}

export function preferredCollectionDaySectionHtml(customer, list, labels = {}) {
  if (!customer || typeof customer !== 'object') return '';
  const note = preferredCollectionDayForCustomer(list, customer.id);
  const heading = cleanPreferredCollectionDayText(labels.heading) || 'Preferred collection day';
  const intro = cleanPreferredCollectionDayText(labels.intro) || 'The day Saad should knock — so the visit is expected, not wasted.';
  const kindLabel = cleanPreferredCollectionDayText(labels.kind) || 'Preferred day';
  const kindWeekday = cleanPreferredCollectionDayText(labels.kindWeekday) || 'Day of the week';
  const kindDayOfMonth = cleanPreferredCollectionDayText(labels.kindDayOfMonth) || 'Date of the month';
  const weekdayLabel = cleanPreferredCollectionDayText(labels.weekday) || 'Weekday';
  const dayOfMonthLabel = cleanPreferredCollectionDayText(labels.dayOfMonth) || 'Date of the month';
  const reasonLabel = cleanPreferredCollectionDayText(labels.reason) || 'Reason';
  const reasonPlaceholder = cleanPreferredCollectionDayText(labels.reasonPlaceholder) || 'e.g. Salary day, home all day';
  const notedByLabel = cleanPreferredCollectionDayText(labels.notedBy) || 'Noted by';
  const dateLabel = cleanPreferredCollectionDayText(labels.date) || 'Date';
  const saveLabel = cleanPreferredCollectionDayText(labels.save) || 'Save';
  const removeLabel = cleanPreferredCollectionDayText(labels.remove) || 'Remove';
  const noneText = cleanPreferredCollectionDayText(labels.none) || 'No preferred collection day recorded for this customer.';
  const weekdayOptions = PREFERRED_COLLECTION_DAY_WEEKDAY_NAMES.map((name, index) =>
    `<option value="${index}"${note && note.kind === PREFERRED_COLLECTION_DAY_KIND_WEEKDAY && note.weekday === index ? ' selected' : ''}>${escapePreferredCollectionDayHtml(name)}</option>`).join('');
  const currentHtml = note
    ? `<p class="pcd-current"><strong>${escapePreferredCollectionDayHtml(preferredCollectionDayText(note, labels.weekdayNames))}</strong>${note.notedBy || note.notedDate ? `<span class="pcd-meta"> — ${escapePreferredCollectionDayHtml([note.notedBy, note.notedDate].filter(Boolean).join(', '))}</span>` : ''}</p>`
    : `<p class="pcd-none">${escapePreferredCollectionDayHtml(noneText)}</p>`;
  const formHtml = `<form class="pcd-form" id="pcdForm"><label for="pcdKind">${escapePreferredCollectionDayHtml(kindLabel)}<select id="pcdKind"><option value="weekday"${!note || note.kind === PREFERRED_COLLECTION_DAY_KIND_WEEKDAY ? ' selected' : ''}>${escapePreferredCollectionDayHtml(kindWeekday)}</option><option value="dayOfMonth"${note && note.kind === PREFERRED_COLLECTION_DAY_KIND_DAY_OF_MONTH ? ' selected' : ''}>${escapePreferredCollectionDayHtml(kindDayOfMonth)}</option></select></label><label for="pcdWeekday" class="pcd-weekday-field">${escapePreferredCollectionDayHtml(weekdayLabel)}<select id="pcdWeekday">${weekdayOptions}</select></label><label for="pcdDayOfMonth" class="pcd-dayofmonth-field">${escapePreferredCollectionDayHtml(dayOfMonthLabel)}<input id="pcdDayOfMonth" type="number" min="1" max="31" value="${note && note.kind === PREFERRED_COLLECTION_DAY_KIND_DAY_OF_MONTH ? note.dayOfMonth : ''}"></label><label for="pcdReason">${escapePreferredCollectionDayHtml(reasonLabel)}<input id="pcdReason" type="text" maxlength="120" placeholder="${escapePreferredCollectionDayHtml(reasonPlaceholder)}" value="${note ? escapePreferredCollectionDayHtml(note.reason) : ''}" required></label><label for="pcdBy">${escapePreferredCollectionDayHtml(notedByLabel)}<input id="pcdBy" type="text" maxlength="60" value="${note ? escapePreferredCollectionDayHtml(note.notedBy) : ''}"></label><label for="pcdDate">${escapePreferredCollectionDayHtml(dateLabel)}<input id="pcdDate" type="date" value="${note ? escapePreferredCollectionDayHtml(note.notedDate) : ''}"></label><button type="submit" class="primary-button" id="pcdSaveBtn">${escapePreferredCollectionDayHtml(saveLabel)}</button>${note ? `<button type="button" class="secondary-button" id="pcdRemoveBtn">${escapePreferredCollectionDayHtml(removeLabel)}</button>` : ''}</form>`;
  return `<section class="profile-custody-section profile-preferred-collection-day pcd-section" aria-label="${escapePreferredCollectionDayHtml(heading)}"><h4>${escapePreferredCollectionDayHtml(heading)}</h4><p>${escapePreferredCollectionDayHtml(intro)}</p>${currentHtml}${formHtml}</section>`;
}

/**
 * The round-list line: the same note, beside the customer on the
 * collection round list. Empty when the customer has no note, so a
 * customer without one shows nothing extra.
 */
export function preferredCollectionDayLineHtml(note) {
  const text = preferredCollectionDayText(note);
  if (!text) return '';
  return `<div class="pcd-route-line">📅 Prefers: ${escapePreferredCollectionDayHtml(text)}</div>`;
}
