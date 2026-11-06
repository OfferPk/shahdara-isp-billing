// Transaction standing instruction note (Plan 390): one note per
// customer — the usual amount, the usual day of the month, and the
// usual payment method, in plain words. Shown on the profile and on
// the transaction entry screen for that customer, so the operator
// expects the regulars on their usual day and a regular who does not
// come is noticed in days, not in months. It is a note only: it never
// auto-debits, auto-records, or auto-sends anything, and it never
// changes any bill, payment, arrears plan, or customer record by
// itself. A customer without one shows nothing extra.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const STANDING_INSTRUCTION_STORE_KEY = 'shahdara_sin_notes_v1';
export const STANDING_INSTRUCTION_METHOD_MAX_LENGTH = 60;
export const STANDING_INSTRUCTION_BY_MAX_LENGTH = 60;
export const STANDING_INSTRUCTION_AMOUNT_MAX_CENTS = 100000000;

const STANDING_INSTRUCTION_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanStandingInstructionText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStandingInstructionKey(value) {
  return cleanStandingInstructionText(value).toLowerCase();
}

function isStandingInstructionLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictStandingInstructionDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = STANDING_INSTRUCTION_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isStandingInstructionLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function cleanStandingInstructionAmountCents(value) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return null;
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function cleanStandingInstructionDay(value) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return null;
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function escapeStandingInstructionHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * Normalize one standing instruction note. The usual amount (in
 * integer cents, PKR) and the usual day of the month (1-31) are
 * required; the usual method is plain words and may be left blank.
 * Returns null for anything that is not a usable note.
 */
export function normalizeStandingInstruction(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanStandingInstructionText(raw.id);
  const customerId = cleanStandingInstructionText(raw.customerId);
  const amountCents = cleanStandingInstructionAmountCents(raw.amountCents);
  const dayOfMonth = cleanStandingInstructionDay(raw.dayOfMonth);
  const method = cleanStandingInstructionText(raw.method).slice(0, STANDING_INSTRUCTION_METHOD_MAX_LENGTH);
  const recordedBy = cleanStandingInstructionText(raw.recordedBy).slice(0, STANDING_INSTRUCTION_BY_MAX_LENGTH);
  const recordedDate = cleanStandingInstructionText(raw.recordedDate);
  if (!id || !customerId) return null;
  if (amountCents === null || amountCents <= 0 || amountCents > STANDING_INSTRUCTION_AMOUNT_MAX_CENTS) return null;
  if (dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > 31) return null;
  if (recordedDate && !isStrictStandingInstructionDate(recordedDate)) return null;
  return { id, customerId, amountCents, dayOfMonth, method, recordedBy, recordedDate };
}

export function normalizeStandingInstructionList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeStandingInstruction(raw);
    if (!note) continue;
    const idKey = cleanStandingInstructionKey(note.id);
    const customerKey = cleanStandingInstructionKey(note.customerId);
    if (seenIds.has(idKey)) continue;
    if (seenCustomers.has(customerKey)) continue;
    seenIds.add(idKey);
    seenCustomers.add(customerKey);
    out.push(note);
  }
  return out;
}

/**
 * Record (or replace) the standing instruction note for one customer.
 * One note per customer: recording a new note for a customer who
 * already has one replaces that note in place. Returns the list
 * unchanged when the note is invalid.
 */
export function recordStandingInstruction(list, note) {
  const normalized = normalizeStandingInstructionList(list);
  const fresh = normalizeStandingInstruction(note);
  if (!fresh) return normalized;
  const customerKey = cleanStandingInstructionKey(fresh.customerId);
  let replaced = false;
  const out = normalized.map(existing => {
    if (cleanStandingInstructionKey(existing.customerId) !== customerKey) return existing;
    replaced = true;
    return fresh;
  });
  return replaced ? out : [...normalized, fresh];
}

/** Remove the standing instruction note for one customer; nothing else changes. */
export function removeStandingInstruction(list, customerId) {
  const normalized = normalizeStandingInstructionList(list);
  const customerKey = cleanStandingInstructionKey(customerId);
  if (!customerKey) return normalized;
  return normalized.filter(note => cleanStandingInstructionKey(note.customerId) !== customerKey);
}

export function standingInstructionForCustomer(list, customerId) {
  const key = cleanStandingInstructionKey(customerId);
  if (!key) return null;
  return normalizeStandingInstructionList(list).find(note => cleanStandingInstructionKey(note.customerId) === key) ?? null;
}

export function hasStandingInstruction(list, customerId) {
  return standingInstructionForCustomer(list, customerId) !== null;
}

/** Day of the month in plain words: 1st, 2nd, 3rd, 4th, 21st, 22nd, 31st. */
export function standingInstructionDayLabel(dayOfMonth) {
  const day = cleanStandingInstructionDay(dayOfMonth);
  if (day === null || day < 1 || day > 31) return '';
  if (day === 11 || day === 12 || day === 13) return `${day}th`;
  const last = day % 10;
  if (last === 1) return `${day}st`;
  if (last === 2) return `${day}nd`;
  if (last === 3) return `${day}rd`;
  return `${day}th`;
}

/**
 * Amount in plain words, PKR, min-0 decimals — the app's own
 * convention (a whole-rupee amount shows no paisa).
 */
export function formatStandingInstructionAmount(amountCents) {
  const cents = cleanStandingInstructionAmountCents(amountCents);
  if (cents === null || cents <= 0) return '';
  const rupees = cents / 100;
  const shown = Number.isInteger(rupees)
    ? rupees.toLocaleString('en-US')
    : rupees.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `PKR ${shown}`;
}

/**
 * The note in one plain sentence: "Usually pays PKR 3,000 on the 5th
 * by Easypaisa" — the method part only when a method is recorded.
 * Unescaped: callers must escape before inserting into HTML.
 */
export function standingInstructionLineText(note, labels = {}) {
  const clean = normalizeStandingInstruction(note);
  if (!clean) return '';
  const usually = cleanStandingInstructionText(labels.usually) || 'Usually pays';
  const onThe = cleanStandingInstructionText(labels.onThe) || 'on the';
  const by = cleanStandingInstructionText(labels.by) || 'by';
  const amount = formatStandingInstructionAmount(clean.amountCents);
  const day = standingInstructionDayLabel(clean.dayOfMonth);
  let line = `${usually} ${amount} ${onThe} ${day}`;
  if (clean.method) line += ` ${by} ${clean.method}`;
  return line;
}

/**
 * The note as an escaped line for the transaction entry screen.
 * Empty when the customer has no note, so a customer without one
 * shows nothing extra.
 */
export function standingInstructionLineHtml(note, labels = {}) {
  const line = standingInstructionLineText(note, labels);
  if (!line) return '';
  const heading = cleanStandingInstructionText(labels.heading) || 'Standing instruction';
  return `<p class="sin-line"><strong>${escapeStandingInstructionHtml(heading)}:</strong> ${escapeStandingInstructionHtml(line)}</p>`;
}

export function standingInstructionSectionHtml(customer, list, labels = {}) {
  if (!customer || typeof customer !== 'object') return '';
  const note = standingInstructionForCustomer(list, customer.id);
  const heading = cleanStandingInstructionText(labels.heading) || 'Standing instruction';
  const amountLabel = cleanStandingInstructionText(labels.amount) || 'Usual amount (PKR)';
  const dayLabel = cleanStandingInstructionText(labels.day) || 'Usual day of the month';
  const methodLabel = cleanStandingInstructionText(labels.method) || 'Usual method';
  const methodPlaceholder = cleanStandingInstructionText(labels.methodPlaceholder) || 'e.g. Easypaisa';
  const notedByLabel = cleanStandingInstructionText(labels.notedBy) || 'Noted by';
  const dateLabel = cleanStandingInstructionText(labels.date) || 'Date';
  const saveLabel = cleanStandingInstructionText(labels.save) || 'Save';
  const removeLabel = cleanStandingInstructionText(labels.remove) || 'Remove';
  const noneText = cleanStandingInstructionText(labels.none) || 'No standing instruction for this customer.';
  const currentHtml = note
    ? `<p class="sin-current"><strong>${escapeStandingInstructionHtml(standingInstructionLineText(note))}</strong>${note.recordedBy || note.recordedDate ? `<span class="sin-meta"> — ${escapeStandingInstructionHtml([note.recordedBy, note.recordedDate].filter(Boolean).join(', '))}</span>` : ''}</p>`
    : `<p class="sin-none">${escapeStandingInstructionHtml(noneText)}</p>`;
  const amountRupees = note ? String(note.amountCents / 100) : '';
  const formHtml = `<form class="sin-form" id="sinForm"><label for="sinAmount">${escapeStandingInstructionHtml(amountLabel)}<input id="sinAmount" type="number" min="1" max="1000000" step="1" value="${escapeStandingInstructionHtml(amountRupees)}" required></label><label for="sinDay">${escapeStandingInstructionHtml(dayLabel)}<input id="sinDay" type="number" min="1" max="31" step="1" value="${note ? escapeStandingInstructionHtml(String(note.dayOfMonth)) : ''}" required></label><label for="sinMethod">${escapeStandingInstructionHtml(methodLabel)}<input id="sinMethod" type="text" maxlength="60" placeholder="${escapeStandingInstructionHtml(methodPlaceholder)}" value="${note ? escapeStandingInstructionHtml(note.method) : ''}"></label><label for="sinBy">${escapeStandingInstructionHtml(notedByLabel)}<input id="sinBy" type="text" maxlength="60" value="${note ? escapeStandingInstructionHtml(note.recordedBy) : ''}"></label><label for="sinDate">${escapeStandingInstructionHtml(dateLabel)}<input id="sinDate" type="date" value="${note ? escapeStandingInstructionHtml(note.recordedDate) : ''}"></label><button type="submit" class="primary-button" id="sinSaveBtn">${escapeStandingInstructionHtml(saveLabel)}</button>${note ? `<button type="button" class="secondary-button" id="sinRemoveBtn">${escapeStandingInstructionHtml(removeLabel)}</button>` : ''}</form>`;
  return `<section class="profile-custody-section profile-standing-instruction" aria-label="${escapeStandingInstructionHtml(heading)}"><h4>${escapeStandingInstructionHtml(heading)}</h4><p>The regulars pay the same amount on the same day every month. Write that pattern down once, and the operator expects them on their usual day — a regular who does not come is noticed in days, not in months. This note never auto-debits, auto-records, or auto-sends anything.</p>${currentHtml}${formHtml}</section>`;
}
