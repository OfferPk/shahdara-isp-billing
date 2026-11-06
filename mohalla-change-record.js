// Mohalla change record (Plan 374): one mohalla-change entry per
// move (old mohalla, new mohalla, change date, who recorded it), kept
// as a record on the profile. The current mohalla is always the
// latest entry. A change entry is never edited, only annotated.
// Recording a change never changes any bill, payment, or dues by
// itself; it is a record only, not the move-house transfer and not
// the billing address note, which it sits beside.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const MOHALLA_CHANGE_STORE_KEY = 'shahdara_mcr_changes_v1';
export const MOHALLA_CHANGE_MOHALLA_MAX_LENGTH = 60;
export const MOHALLA_CHANGE_RECORDED_BY_MAX_LENGTH = 60;
export const MOHALLA_CHANGE_ANNOTATION_MAX_LENGTH = 200;

const MOHALLA_CHANGE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanMohallaChangeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanMohallaChangeKey(value) {
  return cleanMohallaChangeText(value).toLowerCase();
}

function isMohallaChangeLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictMohallaChangeDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = MOHALLA_CHANGE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isMohallaChangeLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function escapeMohallaChangeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function normalizeMohallaChangeAnnotation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = cleanMohallaChangeText(raw.text).slice(0, MOHALLA_CHANGE_ANNOTATION_MAX_LENGTH);
  const date = cleanMohallaChangeText(raw.date);
  if (!text) return null;
  if (!isStrictMohallaChangeDate(date)) return null;
  return { text, date };
}

export function normalizeMohallaChangeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanMohallaChangeText(raw.id);
  const customerId = cleanMohallaChangeText(raw.customerId);
  const oldMohalla = cleanMohallaChangeText(raw.oldMohalla).slice(0, MOHALLA_CHANGE_MOHALLA_MAX_LENGTH);
  const newMohalla = cleanMohallaChangeText(raw.newMohalla).slice(0, MOHALLA_CHANGE_MOHALLA_MAX_LENGTH);
  const changeDate = cleanMohallaChangeText(raw.changeDate);
  const recordedBy = cleanMohallaChangeText(raw.recordedBy).slice(0, MOHALLA_CHANGE_RECORDED_BY_MAX_LENGTH);
  if (!id || !customerId) return null;
  if (!oldMohalla || !newMohalla) return null;
  if (cleanMohallaChangeKey(oldMohalla) === cleanMohallaChangeKey(newMohalla)) return null;
  if (!isStrictMohallaChangeDate(changeDate)) return null;
  const annotations = Array.isArray(raw.annotations)
    ? raw.annotations.map(normalizeMohallaChangeAnnotation).filter(Boolean)
    : [];
  return { id, customerId, oldMohalla, newMohalla, changeDate, recordedBy, annotations };
}

export function normalizeMohallaChangeList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeMohallaChangeEntry(raw);
    if (!entry) continue;
    const idKey = cleanMohallaChangeKey(entry.id);
    if (seenIds.has(idKey)) continue;
    seenIds.add(idKey);
    out.push(entry);
  }
  return out;
}

export function recordMohallaChangeEntry(list, entry) {
  const normalized = normalizeMohallaChangeList(list);
  const fresh = normalizeMohallaChangeEntry(entry);
  if (!fresh) return normalized;
  if (normalized.some(existing => cleanMohallaChangeKey(existing.id) === cleanMohallaChangeKey(fresh.id))) return normalized;
  return [...normalized, fresh];
}

/**
 * Add a note to a mohalla-change entry. The entry itself is never
 * edited: only an annotation is appended, and the old mohalla, new
 * mohalla, change date and recorded-by stay exactly as recorded.
 * Returns the very list passed in when nothing changes, so a caller
 * can tell a refused note from an added one by reference.
 */
export function annotateMohallaChangeEntry(list, id, text, date) {
  const note = normalizeMohallaChangeAnnotation({ text, date });
  if (!note) return list;
  const normalized = normalizeMohallaChangeList(list);
  const idKey = cleanMohallaChangeKey(id);
  let changed = false;
  const out = normalized.map(entry => {
    if (cleanMohallaChangeKey(entry.id) !== idKey) return entry;
    changed = true;
    return { ...entry, annotations: [...entry.annotations, note] };
  });
  return changed ? out : list;
}

function compareMohallaChangeEntries(a, b) {
  if (a.changeDate !== b.changeDate) return a.changeDate < b.changeDate ? 1 : -1;
  return cleanMohallaChangeKey(a.id).localeCompare(cleanMohallaChangeKey(b.id));
}

export function mohallaChangesForCustomer(list, customerId) {
  const key = cleanMohallaChangeKey(customerId);
  if (!key) return [];
  return normalizeMohallaChangeList(list)
    .filter(entry => cleanMohallaChangeKey(entry.customerId) === key)
    .sort(compareMohallaChangeEntries);
}

/**
 * The current mohalla is always the latest entry: the new mohalla of
 * the newest change. Empty when no change is recorded — the mohalla
 * on the profile is then the current one.
 */
export function currentMohallaForCustomer(list, customerId) {
  const changes = mohallaChangesForCustomer(list, customerId);
  if (!changes.length) return '';
  return changes[0].newMohalla;
}

export function mohallaChangeRowText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const recorded = cleanMohallaChangeText(entry.recordedBy);
  const base = `${cleanMohallaChangeText(entry.newMohalla)} — changed ${cleanMohallaChangeText(entry.changeDate)} — from ${cleanMohallaChangeText(entry.oldMohalla)}`;
  return recorded ? `${base} — recorded by ${recorded}` : base;
}

export function mohallaChangeSummaryText(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return 'No mohalla change recorded yet.';
  if (list.length === 1) return '1 mohalla change recorded.';
  return `${list.length} mohalla changes recorded.`;
}

const MOHALLA_CHANGE_DEFAULT_LABELS = {
  heading: 'Mohalla change record',
  intro: 'When a customer moves from one mohalla to another, the move is kept here with the date, so every customer sits on exactly one mohalla\u2019s list. Recording a change never changes any bill, payment, or dues.',
  oldMohalla: 'Old mohalla',
  newMohalla: 'New mohalla',
  date: 'Change date',
  recordedBy: 'Recorded by',
  recordedByPlaceholder: 'e.g. Saad',
  save: 'Record mohalla change',
  addNote: 'Add note',
  annotatePlaceholder: 'e.g. customer confirmed the move',
  current: 'Current mohalla',
  none: 'No mohalla change recorded yet.',
  noChangeCurrent: 'No mohalla change recorded yet \u2014 the mohalla on the profile is the current one.',
};

export function mohallaChangeRecordSectionHtml(customer, entries, labels = {}) {
  if (!customer || typeof customer !== 'object') return '';
  const text = { ...MOHALLA_CHANGE_DEFAULT_LABELS, ...labels };
  const changes = mohallaChangesForCustomer(entries, customer.id);
  const current = currentMohallaForCustomer(entries, customer.id);
  const currentLine = changes.length
    ? `<p class="mcr-current">${escapeMohallaChangeHtml(text.current)}: ${escapeMohallaChangeHtml(current)} \u2014 from the latest change on ${escapeMohallaChangeHtml(changes[0].changeDate)}.</p>`
    : `<p class="mcr-current">${escapeMohallaChangeHtml(text.noChangeCurrent)}</p>`;
  const listHtml = changes.length
    ? `<ul class="mcr-list">${changes.map(entry => {
      const annotationsHtml = entry.annotations.length
        ? `<ul class="mcr-annotations">${entry.annotations.map(note => `<li>${escapeMohallaChangeHtml(note.text)}<span class="mcr-annotation-date">noted ${escapeMohallaChangeHtml(note.date)}</span></li>`).join('')}</ul>`
        : '';
      return `<li><span class="mcr-change">${escapeMohallaChangeHtml(mohallaChangeRowText(entry))}</span>${annotationsHtml}<form class="mcr-annotate" data-mohalla-change-annotate="${escapeMohallaChangeHtml(entry.id)}"><label>Add a note to this change<input type="text" maxlength="200" placeholder="${escapeMohallaChangeHtml(text.annotatePlaceholder)}" required></label><label>${escapeMohallaChangeHtml(text.date)}<input type="date" class="mcr-annotate-date" required></label><button type="submit" class="secondary-button">${escapeMohallaChangeHtml(text.addNote)}</button></form></li>`;
    }).join('')}</ul>`
    : `<p class="mcr-none">${escapeMohallaChangeHtml(text.none)}</p>`;
  const formHtml = `<form class="mcr-form" id="mcrForm"><label for="mcrOldMohalla">${escapeMohallaChangeHtml(text.oldMohalla)}<input id="mcrOldMohalla" type="text" maxlength="60" required></label><label for="mcrNewMohalla">${escapeMohallaChangeHtml(text.newMohalla)}<input id="mcrNewMohalla" type="text" maxlength="60" required></label><label for="mcrDate">${escapeMohallaChangeHtml(text.date)}<input id="mcrDate" type="date" required></label><label for="mcrRecordedBy">${escapeMohallaChangeHtml(text.recordedBy)}<input id="mcrRecordedBy" type="text" maxlength="60" placeholder="${escapeMohallaChangeHtml(text.recordedByPlaceholder)}"></label><button type="submit" class="primary-button" id="mcrSaveBtn">${escapeMohallaChangeHtml(text.save)}</button></form>`;
  return `<section class="profile-custody-section profile-mohalla-change-record" aria-label="Mohalla change record"><h4>${escapeMohallaChangeHtml(text.heading)}</h4><p>${escapeMohallaChangeHtml(text.intro)}</p>${currentLine}<p class="mcr-summary">${escapeMohallaChangeHtml(mohallaChangeSummaryText(changes))}</p>${listHtml}${formHtml}</section>`;
}
