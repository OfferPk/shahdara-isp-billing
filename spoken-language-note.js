// Customer spoken language note (Plan 366): one spoken-language note
// per customer, shown at the top of the profile in plain words — the
// language or dialect the customer speaks comfortably, as the customer
// uses it (for example Urdu, Punjabi, or Saraiki). It is a profile
// note only: it is not the per-draft-type language preference record,
// and it is not the per-visit language note. It appears on the profile
// for that customer and nowhere else; a profile without one shows no
// language. The note never changes any bill, payment, draft, or
// customer record by itself, and it is never sent anywhere.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const SPOKEN_LANGUAGE_NOTE_STORE_KEY = 'shahdara_sln_notes_v1';
export const SPOKEN_LANGUAGE_NOTE_LANGUAGE_MAX_LENGTH = 60;
export const SPOKEN_LANGUAGE_NOTE_BY_MAX_LENGTH = 60;

const SPOKEN_LANGUAGE_NOTE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanSpokenLanguageNoteText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanSpokenLanguageNoteKey(value) {
  return cleanSpokenLanguageNoteText(value).toLowerCase();
}

function isSpokenLanguageNoteLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictSpokenLanguageNoteDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = SPOKEN_LANGUAGE_NOTE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isSpokenLanguageNoteLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function escapeSpokenLanguageNoteHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function normalizeSpokenLanguageNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanSpokenLanguageNoteText(raw.id);
  const customerId = cleanSpokenLanguageNoteText(raw.customerId);
  const language = cleanSpokenLanguageNoteText(raw.language).slice(0, SPOKEN_LANGUAGE_NOTE_LANGUAGE_MAX_LENGTH);
  const notedBy = cleanSpokenLanguageNoteText(raw.notedBy).slice(0, SPOKEN_LANGUAGE_NOTE_BY_MAX_LENGTH);
  const notedDate = cleanSpokenLanguageNoteText(raw.notedDate);
  if (!id || !customerId) return null;
  if (!language) return null;
  if (notedDate && !isStrictSpokenLanguageNoteDate(notedDate)) return null;
  return { id, customerId, language, notedBy, notedDate };
}

export function normalizeSpokenLanguageNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeSpokenLanguageNote(raw);
    if (!note) continue;
    const idKey = cleanSpokenLanguageNoteKey(note.id);
    const customerKey = cleanSpokenLanguageNoteKey(note.customerId);
    if (seenIds.has(idKey)) continue;
    if (seenCustomers.has(customerKey)) continue;
    seenIds.add(idKey);
    seenCustomers.add(customerKey);
    out.push(note);
  }
  return out;
}

/**
 * Record (or replace) the spoken-language note for one customer. One
 * note per customer: recording a new note for a customer who already
 * has one replaces that note in place. Returns the list unchanged when
 * the note is invalid (no id, no customer, or empty language).
 */
export function recordSpokenLanguageNote(list, note) {
  const normalized = normalizeSpokenLanguageNoteList(list);
  const fresh = normalizeSpokenLanguageNote(note);
  if (!fresh) return normalized;
  const customerKey = cleanSpokenLanguageNoteKey(fresh.customerId);
  let replaced = false;
  const out = normalized.map(existing => {
    if (cleanSpokenLanguageNoteKey(existing.customerId) !== customerKey) return existing;
    replaced = true;
    return fresh;
  });
  return replaced ? out : [...normalized, fresh];
}

/** Remove the spoken-language note for one customer; nothing else changes. */
export function removeSpokenLanguageNote(list, customerId) {
  const normalized = normalizeSpokenLanguageNoteList(list);
  const customerKey = cleanSpokenLanguageNoteKey(customerId);
  if (!customerKey) return normalized;
  return normalized.filter(note => cleanSpokenLanguageNoteKey(note.customerId) !== customerKey);
}

export function spokenLanguageNoteForCustomer(list, customerId) {
  const key = cleanSpokenLanguageNoteKey(customerId);
  if (!key) return null;
  return normalizeSpokenLanguageNoteList(list).find(note => cleanSpokenLanguageNoteKey(note.customerId) === key) ?? null;
}

export function hasSpokenLanguageNote(list, customerId) {
  return spokenLanguageNoteForCustomer(list, customerId) !== null;
}

export function spokenLanguageNoteSummaryText(list) {
  const count = normalizeSpokenLanguageNoteList(list).length;
  if (count === 0) return 'No spoken language noted.';
  if (count === 1) return '1 customer has a spoken language noted.';
  return `${count} customers have a spoken language noted.`;
}

export function spokenLanguageNoteSectionHtml(customer, list, labels = {}) {
  if (!customer || typeof customer !== 'object') return '';
  const note = spokenLanguageNoteForCustomer(list, customer.id);
  const heading = cleanSpokenLanguageNoteText(labels.heading) || 'Spoken language';
  const placeholder = cleanSpokenLanguageNoteText(labels.placeholder) || 'e.g. Urdu, Punjabi';
  const notedByLabel = cleanSpokenLanguageNoteText(labels.notedBy) || 'Noted by';
  const dateLabel = cleanSpokenLanguageNoteText(labels.date) || 'Date';
  const saveLabel = cleanSpokenLanguageNoteText(labels.save) || 'Save';
  const removeLabel = cleanSpokenLanguageNoteText(labels.remove) || 'Remove';
  const noneText = cleanSpokenLanguageNoteText(labels.none) || 'No spoken language noted for this customer.';
  const currentHtml = note
    ? `<p class="sln-current"><strong>${escapeSpokenLanguageNoteHtml(note.language)}</strong>${note.notedBy || note.notedDate ? `<span class="sln-meta"> — ${escapeSpokenLanguageNoteHtml([note.notedBy, note.notedDate].filter(Boolean).join(', '))}</span>` : ''}</p>`
    : `<p class="sln-none">${escapeSpokenLanguageNoteHtml(noneText)}</p>`;
  const formHtml = `<form class="sln-form" id="slnForm"><label for="slnLanguage">${escapeSpokenLanguageNoteHtml(heading)}<input id="slnLanguage" type="text" maxlength="60" placeholder="${escapeSpokenLanguageNoteHtml(placeholder)}" value="${note ? escapeSpokenLanguageNoteHtml(note.language) : ''}" required></label><label for="slnBy">${escapeSpokenLanguageNoteHtml(notedByLabel)}<input id="slnBy" type="text" maxlength="60" value="${note ? escapeSpokenLanguageNoteHtml(note.notedBy) : ''}"></label><label for="slnDate">${escapeSpokenLanguageNoteHtml(dateLabel)}<input id="slnDate" type="date" value="${note ? escapeSpokenLanguageNoteHtml(note.notedDate) : ''}"></label><button type="submit" class="primary-button" id="slnSaveBtn">${escapeSpokenLanguageNoteHtml(saveLabel)}</button>${note ? `<button type="button" class="secondary-button" id="slnRemoveBtn">${escapeSpokenLanguageNoteHtml(removeLabel)}</button>` : ''}</form>`;
  return `<section class="profile-custody-section profile-spoken-language-note" aria-label="${escapeSpokenLanguageNoteHtml(heading)}"><h4>${escapeSpokenLanguageNoteHtml(heading)}</h4><p>Saad greets each household in the language they are comfortable with, which is a small thing that builds the trust the whole business runs on. This note changes nothing by itself.</p>${currentHtml}${formHtml}</section>`;
}
