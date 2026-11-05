// Plan 308 (Plan 203-350) — Partnership note.
//
// Informal partnerships (a local shop that takes payments, an
// agent who refers customers) run on verbal terms, so what was
// agreed is disputed later. This module adds only the missing
// piece: one note per partnership — the partner, the type in
// plain words, the terms agreed, the start date, a contact,
// and who recorded it — so partnerships are listed with their
// terms and start date visible.
//
// What this module is NOT, stated plainly:
//   - It is not the partner settlement flow, which settles
//     money with a partner. That flow already exists and is
//     neither read nor rewritten here; this module only
//     records what was agreed, and creates no payment or
//     commission record by itself.
//   - It is not the collector commission record, which tracks
//     commission earned. That record already exists and is
//     neither read nor rewritten here.
//   - It is not the daily partner digest, which summarises a
//     partner's day. That digest already exists and is neither
//     read nor rewritten here.
//   - It is not the referral record, which tracks customers
//     referred in. That record already exists and is neither
//     read nor rewritten here; a partnership may name a
//     referring agent as its type, but the referral itself
//     stays in its own record.
//   - It is not a bill, payment, customer, or staff change.
//     Recording a note never changes any bill, payment,
//     customer, or staff record by itself.
//   - It is not a live record. A note, once written, is never
//     silently edited: there is no edit function, only record,
//     find, and remove; a wrong note is removed and recorded
//     again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     note, and the module never reads storage, the clock,
//     or the network, and never mutates an input.
//   - A note with no id, no partner, no type in plain words,
//     no terms agreed, no strict start date, no contact, or
//     no recorded-by person is refused outright. Unknown
//     fields are dropped, so a note can never grow a bill,
//     payment, customer, or staff field.
//   - A duplicate id is never rewritten: the first note stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validPartnershipNoteDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

/**
 * One partnership note, or null when half-formed. A note
 * needs an id, a partner, a type in plain words, the terms
 * agreed in plain words, a strict start date, a contact,
 * and the person who recorded it. Unknown fields are
 * dropped; the input is never mutated.
 */
export function normalizePartnershipNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const partner = text(raw.partner);
  const type = text(raw.type);
  const terms = text(raw.terms);
  const startDate = text(raw.startDate);
  const contact = text(raw.contact);
  const recordedBy = text(raw.recordedBy);
  if (!id) return null;
  if (!partner) return null;
  if (!type) return null;
  if (!terms) return null;
  if (!validPartnershipNoteDate(startDate)) return null;
  if (!contact) return null;
  if (!recordedBy) return null;
  return {
    id,
    partner,
    type,
    terms,
    startDate,
    contact,
    recordedBy,
  };
}

/** Normalised partnership notes only; a duplicate id is never rewritten, the first stays. */
export function normalizePartnershipNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizePartnershipNote(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function findPartnershipNote(list, id) {
  const clean = normalizePartnershipNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) ?? null;
}

/**
 * Record a partnership note. Refused when half-formed or when
 * its id is already recorded — the first note for an id always stays.
 */
export function recordPartnershipNote(list, raw) {
  const clean = normalizePartnershipNoteList(list);
  const note = normalizePartnershipNote(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  return [...clean, note];
}

export function removePartnershipNote(list, id) {
  const clean = normalizePartnershipNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((note) => note.id !== wanted);
}

/** Partnership notes by start date, then partner, then id, so the same list always reads the same way. */
export function partnershipNotesSorted(list) {
  const clean = normalizePartnershipNoteList(list);
  return [...clean].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    if (a.partner.toLowerCase() !== b.partner.toLowerCase()) return a.partner.toLowerCase() < b.partner.toLowerCase() ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Partnership notes for one partner, in start-date order; the partner match is case-insensitive. */
export function partnershipNotesForPartner(list, partner) {
  const wanted = text(partner).toLowerCase();
  if (!wanted) return [];
  return partnershipNotesSorted(list).filter((note) => note.partner.toLowerCase() === wanted);
}

/**
 * Partners in A-Z order, keeping the first spelling seen, so
 * "Corner Shop" and "corner shop" never list as two partners.
 */
export function partnershipPartners(list) {
  const clean = normalizePartnershipNoteList(list);
  const byLower = new Map();
  for (const note of clean) {
    const key = note.partner.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, note.partner);
  }
  return [...byLower.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

/** Plain-words summary: the count, the partners, and the latest note. */
export function partnershipNoteSummaryText(list) {
  const clean = normalizePartnershipNoteList(list);
  if (!clean.length) return 'No partnership notes recorded.';
  const sorted = partnershipNotesSorted(clean);
  const partners = partnershipPartners(clean);
  const latest = sorted[sorted.length - 1];
  const countWord = clean.length === 1 ? '1 partnership' : `${clean.length} partnerships`;
  const partnerWord = partners.length === 1 ? '1 partner' : `${partners.length} partners`;
  return `${countWord} with ${partnerWord}. Latest: ${latest.partner} (${latest.type}) from ${latest.startDate}.`;
}

/** One line naming a note, for lists and messages. */
export function partnershipNoteEntryText(note) {
  const clean = normalizePartnershipNote(note);
  if (!clean) return '';
  return `${clean.partner} (${clean.type}) — from ${clean.startDate}; terms: ${clean.terms}; contact ${clean.contact}; recorded by ${clean.recordedBy}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function partnershipNoteEntryHtml(note) {
  const clean = normalizePartnershipNote(note);
  if (!clean) return '';
  return `<li>${escapeHtml(partnershipNoteEntryText(clean))}</li>`;
}

export function partnershipNoteAllHtml(list) {
  const sorted = partnershipNotesSorted(list);
  if (!sorted.length) return '<p>No partnership notes recorded.</p>';
  return `<ul>${sorted.map((note) => partnershipNoteEntryHtml(note)).join('')}</ul>`;
}

export function partnershipNotesForPartnerHtml(list, partner) {
  const notes = partnershipNotesForPartner(list, partner);
  if (!notes.length) return '<p>No partnership notes for that partner.</p>';
  return `<ul>${notes.map((note) => partnershipNoteEntryHtml(note)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function partnershipNoteCsv(list) {
  const sorted = partnershipNotesSorted(list);
  const header = ['id', 'partner', 'type', 'terms', 'start_date', 'contact', 'recorded_by'].join(',');
  const rows = sorted.map((note) => [note.id, note.partner, note.type, note.terms, note.startDate, note.contact, note.recordedBy].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function partnershipNoteFilename() {
  return 'partnership-notes.csv';
}
