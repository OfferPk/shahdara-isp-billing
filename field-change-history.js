// Field change history (Plan 364): one change-history entry per field
// change on a customer profile (field name, old value, new value, who
// changed it, date), shown on that customer's profile, newest first.
//
// The profile shows only the current value of each field, so when a
// package, a number, or a mohalla changes, nobody can say who changed
// it or when. The global operator action log already exists, but it
// records operator actions (a payment recorded, a record archived)
// with no field-level old and new values and no per-customer filter,
// so a per-profile field history cannot be composed from it. The
// monthly audit summary composes counts from that same log, and the
// preference change log covers contact and language preferences only.
// This module is the missing piece: the general per-field history.
//
// Entries are written by the profile save paths only (the per-field
// Save and the full profile form save): each save diffs the saved
// record against the record the save started from, over the same
// profile fields the completion counter counts, and records one entry
// per field whose stored value actually changed. The operator who
// changed it is the app's own operator mode (owner or collector) at
// save time. There is no manual add form — history is written when
// the change happens, never typed in afterwards — and no entry is
// ever edited or removed. The history view is read-only: it edits
// nothing, and recording a change never changes any bill, payment,
// or other customer record by itself. A field never changed shows
// no entry.
//
// The module never reads storage, the clock, the network, or the
// page. Inputs are never mutated. The caller supplies the date and
// the operator mode, so tests pin history on fixed fixture dates.

export const FIELD_CHANGE_STORE_KEY = 'shahdara_fch_changes_v1';
export const FIELD_CHANGE_VALUE_MAX_LENGTH = 200;
export const FIELD_CHANGE_CHANGED_BY_MAX_LENGTH = 60;

const FIELD_CHANGE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanFieldChangeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanFieldChangeKey(value) {
  return cleanFieldChangeText(value).toLowerCase();
}

function isFieldChangeLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictFieldChangeDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = FIELD_CHANGE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isFieldChangeLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

/**
 * One stored value as plain text, so an old and a new value can be
 * compared and shown. Null and undefined read as blank; a string is
 * trimmed; a finite number reads as its digits; a boolean reads as
 * "true" or "false"; an array reads as its entries joined with a
 * comma. Anything else reads as blank, never as "[object Object]".
 */
export function fieldChangeValueText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.map((entry) => fieldChangeValueText(entry)).filter((part) => part !== '').join(', ');
  return '';
}

function escapeFieldChangeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * A change draft is what the save-path diff produces: everything an
 * entry carries except its id, which is assigned when the entry is
 * recorded. A draft is valid only when it names a customer and a
 * field, the old and new values genuinely differ, and the date is a
 * real calendar date. The recorder is capped at 60 characters and
 * may be blank (an entry recorded without one still shows the date
 * and both values).
 */
export function normalizeFieldChangeDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const customerId = cleanFieldChangeText(raw.customerId);
  const field = cleanFieldChangeText(raw.field);
  const oldValue = fieldChangeValueText(raw.oldValue).slice(0, FIELD_CHANGE_VALUE_MAX_LENGTH);
  const newValue = fieldChangeValueText(raw.newValue).slice(0, FIELD_CHANGE_VALUE_MAX_LENGTH);
  const changedBy = cleanFieldChangeText(raw.changedBy).slice(0, FIELD_CHANGE_CHANGED_BY_MAX_LENGTH);
  const date = cleanFieldChangeText(raw.date);
  if (!customerId || !field) return null;
  if (oldValue === newValue) return null;
  if (!isStrictFieldChangeDate(date)) return null;
  return { customerId, field, oldValue, newValue, changedBy, date };
}

export function normalizeFieldChangeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanFieldChangeText(raw.id);
  if (!id) return null;
  const draft = normalizeFieldChangeDraft(raw);
  if (!draft) return null;
  return { id, ...draft };
}

export function normalizeFieldChangeList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeFieldChangeEntry(raw);
    if (!entry) continue;
    const idKey = cleanFieldChangeKey(entry.id);
    if (seenIds.has(idKey)) continue;
    seenIds.add(idKey);
    out.push(entry);
  }
  return out;
}

function nextFieldChangeId(list) {
  let max = 0;
  for (const entry of list) {
    const match = /^fch-(\d+)$/.exec(cleanFieldChangeKey(entry.id));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `fch-${max + 1}`;
}

/**
 * Record one complete entry (with its own id). A refused entry — an
 * invalid shape, or an id already in the list — leaves the list
 * unchanged and returns the normalized list.
 */
export function recordFieldChange(list, entry) {
  const normalized = normalizeFieldChangeList(list);
  const fresh = normalizeFieldChangeEntry(entry);
  if (!fresh) return normalized;
  if (normalized.some((existing) => cleanFieldChangeKey(existing.id) === cleanFieldChangeKey(fresh.id))) return normalized;
  return [...normalized, fresh];
}

/**
 * Record change drafts (no ids): each valid draft gets the next free
 * sequential id, so two changes to the same field on the same date
 * still land as two entries. Invalid drafts are skipped; when none
 * lands, the normalized list is returned unchanged.
 */
export function recordFieldChanges(list, drafts) {
  const normalized = normalizeFieldChangeList(list);
  const rows = Array.isArray(drafts) ? drafts : [];
  let out = normalized;
  let changed = false;
  for (const draft of rows) {
    const valid = normalizeFieldChangeDraft(draft);
    if (!valid) continue;
    const entry = { id: nextFieldChangeId(out), ...valid };
    out = [...out, entry];
    changed = true;
  }
  return changed ? out : normalized;
}

/**
 * Diff a saved record against the record the save started from, over
 * the caller-supplied field keys. Returns one draft per field whose
 * stored value actually changed — in the order the keys were given —
 * each carrying the customer, the field, the old and new values, the
 * recorder and the date. No change, no draft: an unchanged save
 * records nothing. A missing or invalid date records nothing either,
 * because history without a trustworthy date is worse than none.
 * Inputs are never mutated.
 */
export function fieldChangesForSave(oldRecord, newRecord, { by = '', date = '', fieldKeys = [] } = {}) {
  const customerId = cleanFieldChangeText(newRecord?.id) || cleanFieldChangeText(oldRecord?.id);
  if (!customerId) return [];
  if (!isStrictFieldChangeDate(cleanFieldChangeText(date))) return [];
  const keys = Array.isArray(fieldKeys) ? fieldKeys : [];
  const seen = new Set();
  const drafts = [];
  for (const key of keys) {
    if (typeof key !== 'string' || key === '') continue;
    const keyValue = cleanFieldChangeText(key);
    if (seen.has(keyValue)) continue;
    seen.add(keyValue);
    const oldValue = fieldChangeValueText(oldRecord?.[key]);
    const newValue = fieldChangeValueText(newRecord?.[key]);
    if (oldValue === newValue) continue;
    drafts.push({ customerId, field: key, oldValue, newValue, changedBy: cleanFieldChangeText(by), date: cleanFieldChangeText(date) });
  }
  return drafts;
}

function compareFieldChangeEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return cleanFieldChangeKey(a.id).localeCompare(cleanFieldChangeKey(b.id));
}

/** One customer's changes, newest first. */
export function fieldChangesForCustomer(list, customerId) {
  const key = cleanFieldChangeKey(customerId);
  if (!key) return [];
  return normalizeFieldChangeList(list)
    .filter((entry) => cleanFieldChangeKey(entry.customerId) === key)
    .sort(compareFieldChangeEntries);
}

export function fieldChangeSummaryText(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return 'No field change recorded yet.';
  if (list.length === 1) return '1 field change recorded.';
  return `${list.length} field changes recorded.`;
}

/**
 * The history section HTML for the profile. `entries` is the full
 * list (filtered here per customer); `labels` maps each field key to
 * the display name the form itself shows (a missing label falls back
 * to the field key, never to a blank); `texts` carries the heading,
 * the intro line, the empty line and the not-set word in the app's
 * current language. A field never changed shows no entry. Every
 * value is escaped, so a stored value can never break the markup.
 */
export function fieldChangeHistorySectionHtml(customer, entries, labels, texts) {
  if (!customer || typeof customer !== 'object') return '';
  const changes = fieldChangesForCustomer(entries, customer.id);
  const names = labels && typeof labels === 'object' ? labels : {};
  const heading = texts?.heading || 'Field change history';
  const intro = texts?.intro || 'Every change to this profile, with the old and new value, the date, and who recorded it — so a disputed change can be shown, not argued.';
  const none = texts?.none || 'No field change recorded yet.';
  const notSet = texts?.notSet || 'not set';
  const listHtml = changes.length
    ? `<ul class="fch-list">${changes.map((entry) => {
      const name = names[entry.field] || entry.field;
      const oldValue = entry.oldValue === '' ? notSet : entry.oldValue;
      const newValue = entry.newValue === '' ? notSet : entry.newValue;
      const by = entry.changedBy ? ` — by ${escapeFieldChangeHtml(entry.changedBy)}` : '';
      return `<li><strong>${escapeFieldChangeHtml(name)}</strong> — changed ${escapeFieldChangeHtml(entry.date)} — from ${escapeFieldChangeHtml(oldValue)} to ${escapeFieldChangeHtml(newValue)}${by}</li>`;
    }).join('')}</ul>`
    : `<p class="fch-none">${escapeFieldChangeHtml(none)}</p>`;
  return `<section class="profile-custody-section profile-field-change-history fch-history" aria-label="${escapeFieldChangeHtml(heading)}"><h4>${escapeFieldChangeHtml(heading)}</h4><p>${escapeFieldChangeHtml(intro)}</p><p class="fch-summary">${escapeFieldChangeHtml(fieldChangeSummaryText(changes))}</p>${listHtml}</section>`;
}
