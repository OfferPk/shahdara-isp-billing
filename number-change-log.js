// Contact number change log (Plan 358): one number-change entry per
// change (old number, new number, change date, who recorded it), kept
// as a log on the profile. The current number is always the latest
// entry. A change entry is never edited, only annotated. Logging a
// change never changes any bill, payment, or reminder record by
// itself; it changes no contact preference and no record of a
// preference change, which it sits beside.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const NUMBER_CHANGE_STORE_KEY = 'shahdara_ncl_logs_v1';
export const NUMBER_CHANGE_NUMBER_MAX_LENGTH = 30;
export const NUMBER_CHANGE_RECORDED_BY_MAX_LENGTH = 60;
export const NUMBER_CHANGE_ANNOTATION_MAX_LENGTH = 200;

const NUMBER_CHANGE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanNumberChangeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNumberChangeKey(value) {
  return cleanNumberChangeText(value).toLowerCase();
}

function isNumberChangeLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictNumberChangeDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = NUMBER_CHANGE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isNumberChangeLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

/**
 * The 10 national digits of a Pakistani mobile number, so the same
 * number written with a leading 0 or with the +92 country code counts
 * as the same number. Returns '' when the value is not a 10-digit
 * mobile core — such a value is still recorded as written, it just
 * cannot be compared this way.
 */
export function numberChangeDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  let core = digits;
  if (core.length === 12 && core.startsWith('92')) core = core.slice(2);
  else if (core.length === 11 && core.startsWith('0')) core = core.slice(1);
  return core.length === 10 ? core : '';
}

function escapeNumberChangeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function normalizeNumberChangeAnnotation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = cleanNumberChangeText(raw.text).slice(0, NUMBER_CHANGE_ANNOTATION_MAX_LENGTH);
  const date = cleanNumberChangeText(raw.date);
  if (!text) return null;
  if (!isStrictNumberChangeDate(date)) return null;
  return { text, date };
}

export function normalizeNumberChangeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanNumberChangeText(raw.id);
  const customerId = cleanNumberChangeText(raw.customerId);
  const oldNumber = cleanNumberChangeText(raw.oldNumber).slice(0, NUMBER_CHANGE_NUMBER_MAX_LENGTH);
  const newNumber = cleanNumberChangeText(raw.newNumber).slice(0, NUMBER_CHANGE_NUMBER_MAX_LENGTH);
  const changeDate = cleanNumberChangeText(raw.changeDate);
  const recordedBy = cleanNumberChangeText(raw.recordedBy).slice(0, NUMBER_CHANGE_RECORDED_BY_MAX_LENGTH);
  if (!id || !customerId) return null;
  if (!oldNumber || !newNumber) return null;
  if (cleanNumberChangeKey(oldNumber) === cleanNumberChangeKey(newNumber)) return null;
  const oldCore = numberChangeDigits(oldNumber);
  const newCore = numberChangeDigits(newNumber);
  if (oldCore && newCore && oldCore === newCore) return null;
  if (!isStrictNumberChangeDate(changeDate)) return null;
  const annotations = Array.isArray(raw.annotations)
    ? raw.annotations.map(normalizeNumberChangeAnnotation).filter(Boolean)
    : [];
  return { id, customerId, oldNumber, newNumber, changeDate, recordedBy, annotations };
}

export function normalizeNumberChangeList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeNumberChangeEntry(raw);
    if (!entry) continue;
    const idKey = cleanNumberChangeKey(entry.id);
    if (seenIds.has(idKey)) continue;
    seenIds.add(idKey);
    out.push(entry);
  }
  return out;
}

export function recordNumberChangeEntry(list, entry) {
  const normalized = normalizeNumberChangeList(list);
  const fresh = normalizeNumberChangeEntry(entry);
  if (!fresh) return normalized;
  if (normalized.some(existing => cleanNumberChangeKey(existing.id) === cleanNumberChangeKey(fresh.id))) return normalized;
  return [...normalized, fresh];
}

/**
 * Add a note to a number-change entry. The entry itself is never
 * edited: only an annotation is appended, and the old number, new
 * number, change date and recorded-by stay exactly as recorded.
 * Returns the very list passed in when nothing changes, so a caller
 * can tell a refused note from an added one by reference.
 */
export function annotateNumberChangeEntry(list, id, text, date) {
  const note = normalizeNumberChangeAnnotation({ text, date });
  if (!note) return list;
  const normalized = normalizeNumberChangeList(list);
  const idKey = cleanNumberChangeKey(id);
  let changed = false;
  const out = normalized.map(entry => {
    if (cleanNumberChangeKey(entry.id) !== idKey) return entry;
    changed = true;
    return { ...entry, annotations: [...entry.annotations, note] };
  });
  return changed ? out : list;
}

function compareNumberChangeEntries(a, b) {
  if (a.changeDate !== b.changeDate) return a.changeDate < b.changeDate ? 1 : -1;
  return cleanNumberChangeKey(a.id).localeCompare(cleanNumberChangeKey(b.id));
}

export function numberChangesForCustomer(list, customerId) {
  const key = cleanNumberChangeKey(customerId);
  if (!key) return [];
  return normalizeNumberChangeList(list)
    .filter(entry => cleanNumberChangeKey(entry.customerId) === key)
    .sort(compareNumberChangeEntries);
}

/**
 * The current number is always the latest entry: the new number of
 * the newest change. Empty when no change is recorded.
 */
export function currentNumberForCustomer(list, customerId) {
  const changes = numberChangesForCustomer(list, customerId);
  if (!changes.length) return '';
  return changes[0].newNumber;
}

/**
 * Which number was current on a given date: the new number of the
 * latest change on or before that date. Empty when the date is not a
 * real calendar date, or before the first recorded change — the log
 * only knows from the first recorded change onwards.
 */
export function numberForCustomerOnDate(list, customerId, date) {
  if (!isStrictNumberChangeDate(date)) return '';
  const changes = numberChangesForCustomer(list, customerId);
  for (const entry of changes) {
    if (entry.changeDate <= date) return entry.newNumber;
  }
  return '';
}

export function numberChangeRowText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const recorded = cleanNumberChangeText(entry.recordedBy);
  const base = `${cleanNumberChangeText(entry.newNumber)} — changed ${cleanNumberChangeText(entry.changeDate)} — from ${cleanNumberChangeText(entry.oldNumber)}`;
  return recorded ? `${base} — recorded by ${recorded}` : base;
}

export function numberChangeSummaryText(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return 'No number change recorded yet.';
  if (list.length === 1) return '1 number change recorded.';
  return `${list.length} number changes recorded.`;
}

export function numberChangeLogSectionHtml(customer, entries) {
  if (!customer || typeof customer !== 'object') return '';
  const changes = numberChangesForCustomer(entries, customer.id);
  const current = currentNumberForCustomer(entries, customer.id);
  const currentLine = changes.length
    ? `<p class="ncl-current">Current number: ${escapeNumberChangeHtml(current)} — from the latest change on ${escapeNumberChangeHtml(changes[0].changeDate)}.</p>`
    : '<p class="ncl-current">No number change recorded yet — the number on the profile is the current one.</p>';
  const listHtml = changes.length
    ? `<ul class="ncl-list">${changes.map(entry => {
      const annotationsHtml = entry.annotations.length
        ? `<ul class="ncl-annotations">${entry.annotations.map(note => `<li>${escapeNumberChangeHtml(note.text)}<span class="ncl-annotation-date">noted ${escapeNumberChangeHtml(note.date)}</span></li>`).join('')}</ul>`
        : '';
      return `<li><span class="ncl-change">${escapeNumberChangeHtml(numberChangeRowText(entry))}</span>${annotationsHtml}<form class="ncl-annotate" data-number-change-annotate="${escapeNumberChangeHtml(entry.id)}"><label>Add a note to this change<input type="text" maxlength="200" placeholder="e.g. customer confirmed on call" required></label><label>Date<input type="date" class="ncl-annotate-date" required></label><button type="submit" class="secondary-button">Add note</button></form></li>`;
    }).join('')}</ul>`
    : '<p class="ncl-none">No number change recorded yet.</p>';
  const formHtml = `<form class="ncl-form" id="nclForm"><label for="nclOldNumber">Old number<input id="nclOldNumber" type="tel" maxlength="30" required></label><label for="nclNewNumber">New number<input id="nclNewNumber" type="tel" maxlength="30" required></label><label for="nclDate">Change date<input id="nclDate" type="date" required></label><label for="nclRecordedBy">Recorded by<input id="nclRecordedBy" type="text" maxlength="60" placeholder="e.g. Saad"></label><button type="submit" class="primary-button" id="nclSaveBtn">Record number change</button></form>`;
  return `<section class="profile-custody-section profile-number-change-log" aria-label="Contact number change log"><h4>Contact number change log</h4><p>When a customer's number changes, the old number is kept here with the date, so a reminder sent to the wrong number can be explained and the number that was current on that date can be seen. Logging a change never changes any bill, payment, or reminder record; a change entry is never edited, only annotated.</p>${currentLine}<p class="ncl-summary">${escapeNumberChangeHtml(numberChangeSummaryText(changes))}</p>${listHtml}${formHtml}</section>`;
}
