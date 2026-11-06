// Customer handling note (Plan 361): one handling note per customer,
// shown at the top of the profile and again on the payment entry
// screen before saving, in plain words. It is a display note only:
// it blocks nothing, grants nothing, and never changes any bill,
// payment, or customer record by itself. Editing the note changes
// only that note; removing it removes only the note. A customer
// without one shows nothing extra.
//
// The note is not the pin-ordering record that only orders note
// references supplied by the caller, and it is not a general log:
// it belongs to one customer and is read before money moves.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const HANDLING_NOTE_STORE_KEY = 'shahdara_chn_notes_v1';
export const HANDLING_NOTE_TEXT_MAX_LENGTH = 300;
export const HANDLING_NOTE_BY_MAX_LENGTH = 60;

const HANDLING_NOTE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanHandlingNoteText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanHandlingNoteKey(value) {
  return cleanHandlingNoteText(value).toLowerCase();
}

function isHandlingNoteLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictHandlingNoteDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = HANDLING_NOTE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isHandlingNoteLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function escapeHandlingNoteHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function normalizeHandlingNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanHandlingNoteText(raw.id);
  const customerId = cleanHandlingNoteText(raw.customerId);
  const text = cleanHandlingNoteText(raw.text).slice(0, HANDLING_NOTE_TEXT_MAX_LENGTH);
  const updatedBy = cleanHandlingNoteText(raw.updatedBy).slice(0, HANDLING_NOTE_BY_MAX_LENGTH);
  const updatedDate = cleanHandlingNoteText(raw.updatedDate);
  if (!id || !customerId) return null;
  if (!text) return null;
  if (updatedDate && !isStrictHandlingNoteDate(updatedDate)) return null;
  return { id, customerId, text, updatedBy, updatedDate };
}

export function normalizeHandlingNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeHandlingNote(raw);
    if (!note) continue;
    const idKey = cleanHandlingNoteKey(note.id);
    const customerKey = cleanHandlingNoteKey(note.customerId);
    if (seenIds.has(idKey)) continue;
    if (seenCustomers.has(customerKey)) continue;
    seenIds.add(idKey);
    seenCustomers.add(customerKey);
    out.push(note);
  }
  return out;
}

/**
 * Record (or replace) the handling note for one customer. One note per
 * customer: recording a new note for a customer who already has one
 * replaces that note in place. Returns the list unchanged when the
 * note is invalid (no id, no customer, or empty text).
 */
export function recordHandlingNote(list, note) {
  const normalized = normalizeHandlingNoteList(list);
  const fresh = normalizeHandlingNote(note);
  if (!fresh) return normalized;
  const customerKey = cleanHandlingNoteKey(fresh.customerId);
  let replaced = false;
  const out = normalized.map(existing => {
    if (cleanHandlingNoteKey(existing.customerId) !== customerKey) return existing;
    replaced = true;
    return fresh;
  });
  return replaced ? out : [...normalized, fresh];
}

/** Remove the handling note for one customer; nothing else changes. */
export function removeHandlingNote(list, customerId) {
  const normalized = normalizeHandlingNoteList(list);
  const customerKey = cleanHandlingNoteKey(customerId);
  if (!customerKey) return normalized;
  return normalized.filter(note => cleanHandlingNoteKey(note.customerId) !== customerKey);
}

export function handlingNoteForCustomer(list, customerId) {
  const key = cleanHandlingNoteKey(customerId);
  if (!key) return null;
  return normalizeHandlingNoteList(list).find(note => cleanHandlingNoteKey(note.customerId) === key) ?? null;
}

export function hasHandlingNote(list, customerId) {
  return handlingNoteForCustomer(list, customerId) !== null;
}

export function handlingNoteSummaryText(list) {
  const count = normalizeHandlingNoteList(list).length;
  if (count === 0) return 'No handling note recorded.';
  if (count === 1) return '1 customer has a handling note.';
  return `${count} customers have a handling note.`;
}

export function handlingNoteSectionHtml(customer, list, labels = {}) {
  if (!customer || typeof customer !== 'object') return '';
  const note = handlingNoteForCustomer(list, customer.id);
  const heading = cleanHandlingNoteText(labels.heading) || 'Handling note';
  const placeholder = cleanHandlingNoteText(labels.placeholder) || 'e.g. Collect only from the father';
  const notedByLabel = cleanHandlingNoteText(labels.notedBy) || 'Noted by';
  const dateLabel = cleanHandlingNoteText(labels.date) || 'Date';
  const saveLabel = cleanHandlingNoteText(labels.save) || 'Save';
  const removeLabel = cleanHandlingNoteText(labels.remove) || 'Remove';
  const noneText = cleanHandlingNoteText(labels.none) || 'No handling note for this customer.';
  const currentHtml = note
    ? `<p class="chn-current"><strong>${escapeHandlingNoteHtml(note.text)}</strong>${note.updatedBy || note.updatedDate ? `<span class="chn-meta"> — ${escapeHandlingNoteHtml([note.updatedBy, note.updatedDate].filter(Boolean).join(', '))}</span>` : ''}</p>`
    : `<p class="chn-none">${escapeHandlingNoteHtml(noneText)}</p>`;
  const formHtml = `<form class="chn-form" id="chnForm"><label for="chnText">${escapeHandlingNoteHtml(heading)}<textarea id="chnText" maxlength="300" placeholder="${escapeHandlingNoteHtml(placeholder)}" required>${note ? escapeHandlingNoteHtml(note.text) : ''}</textarea></label><label for="chnBy">${escapeHandlingNoteHtml(notedByLabel)}<input id="chnBy" type="text" maxlength="60" value="${note ? escapeHandlingNoteHtml(note.updatedBy) : ''}"></label><label for="chnDate">${escapeHandlingNoteHtml(dateLabel)}<input id="chnDate" type="date" value="${note ? escapeHandlingNoteHtml(note.updatedDate) : ''}"></label><button type="submit" class="primary-button" id="chnSaveBtn">${escapeHandlingNoteHtml(saveLabel)}</button>${note ? `<button type="button" class="secondary-button" id="chnRemoveBtn">${escapeHandlingNoteHtml(removeLabel)}</button>` : ''}</form>`;
  return `<section class="profile-custody-section profile-handling-note" aria-label="${escapeHandlingNoteHtml(heading)}"><h4>${escapeHandlingNoteHtml(heading)}</h4><p>The one instruction that matters for this household is read before the money moves, not discovered after a mistake at the counter. This note blocks nothing and grants nothing; editing it changes only this note.</p>${currentHtml}${formHtml}</section>`;
}

/**
 * The payment-entry alert: the same note, shown on the payment entry
 * screen before saving. Empty when the customer has no note, so a
 * customer without one shows nothing extra.
 */
export function handlingNoteAlertHtml(text, heading = 'Handling note') {
  const clean = cleanHandlingNoteText(text);
  if (!clean) return '';
  const safeHeading = cleanHandlingNoteText(heading) || 'Handling note';
  return `<div class="chn-alert" role="alert"><strong>⚠️ ${escapeHandlingNoteHtml(safeHeading)}</strong><p>${escapeHandlingNoteHtml(clean)}</p></div>`;
}
