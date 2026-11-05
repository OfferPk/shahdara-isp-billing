// Plan 306 (Plan 203-350) — Competitor price note.
//
// Competitor packages seen in the area (a poster, a shop visit, a
// customer mention) are forgotten, so pricing decisions are made
// without knowing what neighbours charge. This module adds only the
// missing piece: one competitor price note per sighting — the
// competitor name, the package seen in plain words, the price in
// whole rupees, the date seen, the source in plain words, and who
// recorded it — so notes are listed newest first with package and
// price visible, and the owner can price fairly for about 100
// customers without guessing or undercutting blindly.
//
// What this module is NOT, stated plainly:
//   - It is not a Shahdara price change. Recording a note never
//     changes any package price, bill, or customer record by
//     itself; Shahdara prices live in their own records, which
//     are neither read nor rewritten here.
//   - It is not the Shahdara package price history record, the
//     price notices, or the price review worksheet. Those records
//     describe Shahdara's own prices and are neither read nor
//     rewritten here; this module only records what a competitor
//     was seen charging.
//   - It is not a live record. A competitor price note, once
//     written, is never silently edited: there is no edit
//     function, only record, find, and remove, so a wrong note
//     is removed and recorded again.
//   - It is not a comparison or a verdict. The module never
//     computes a cheaper or dearer result and never recommends
//     a price; it only lists what was seen, newest first.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     note, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A note with no id, no competitor, no package, no
//     whole-rupee price of at least one rupee, no strict date
//     seen, no source, or no recorded-by person is refused
//     outright. Unknown fields are dropped, so a note can never
//     grow a bill, payment, customer, or price-change field.
//   - A duplicate id is never rewritten: the first note stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validCompetitorPriceDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > limit) return false;
  return true;
}

/** Whole rupees of at least one rupee, from a number or digit string, or null. */
function wholeRupees(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const amount = Number(value.trim());
    if (Number.isInteger(amount) && amount >= 1) return amount;
  }
  return null;
}

/**
 * One competitor price note, or null when half-formed. A note needs
 * an id, a competitor, a package in plain words, a whole-rupee price
 * of at least one rupee, a strict date seen, a source in plain
 * words, and a recorded-by person. Unknown fields are dropped; the
 * input is never mutated.
 */
export function normalizeCompetitorPriceNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const competitor = text(raw.competitor);
  const packageSeen = text(raw.package);
  const price = wholeRupees(raw.price);
  const dateSeen = text(raw.dateSeen);
  const source = text(raw.source);
  const recordedBy = text(raw.recordedBy);
  if (!id) return null;
  if (!competitor) return null;
  if (!packageSeen) return null;
  if (price === null) return null;
  if (!validCompetitorPriceDay(dateSeen)) return null;
  if (!source) return null;
  if (!recordedBy) return null;
  return {
    id,
    competitor,
    package: packageSeen,
    price,
    dateSeen,
    source,
    recordedBy,
  };
}

/** Normalised notes only. A duplicate id is never rewritten: the first note stays. */
export function normalizeCompetitorPriceNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeCompetitorPriceNote(raw);
    if (!note) continue;
    if (seenIds.has(note.id)) continue;
    seenIds.add(note.id);
    out.push(note);
  }
  return out;
}

export function findCompetitorPriceNote(list, id) {
  const clean = normalizeCompetitorPriceNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) ?? null;
}

/**
 * Record a competitor price note. Refused when half-formed or when
 * its id is already recorded — the first note for an id always stays.
 */
export function recordCompetitorPriceNote(list, raw) {
  const clean = normalizeCompetitorPriceNoteList(list);
  const note = normalizeCompetitorPriceNote(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  return [...clean, note];
}

export function removeCompetitorPriceNote(list, id) {
  const clean = normalizeCompetitorPriceNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((note) => note.id !== wanted);
}

/** Notes newest first, then competitor A-Z, then id, so the latest sighting is on top. */
export function competitorPriceNotesSorted(list) {
  const clean = normalizeCompetitorPriceNoteList(list);
  return [...clean].sort((a, b) => {
    if (a.dateSeen !== b.dateSeen) return a.dateSeen < b.dateSeen ? 1 : -1;
    if (lower(a.competitor) !== lower(b.competitor)) return lower(a.competitor) < lower(b.competitor) ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Notes for one competitor, newest first; the competitor match is case-insensitive. */
export function competitorPriceNotesForCompetitor(list, competitor) {
  const wanted = lower(competitor);
  if (!wanted) return [];
  return competitorPriceNotesSorted(list).filter((note) => lower(note.competitor) === wanted);
}

/** Competitors with a note, first spelling kept, A-Z. */
export function competitorPriceCompetitors(list) {
  const clean = normalizeCompetitorPriceNoteList(list);
  const seen = new Map();
  for (const note of clean) {
    const key = lower(note.competitor);
    if (!seen.has(key)) seen.set(key, note.competitor);
  }
  return [...seen.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0));
}

export function competitorPriceNoteSummaryText(list) {
  const clean = normalizeCompetitorPriceNoteList(list);
  if (clean.length === 0) return 'No competitor price notes recorded.';
  const word = clean.length === 1 ? 'note' : 'notes';
  const latest = competitorPriceNotesSorted(clean)[0];
  return `${clean.length} competitor price ${word} recorded. Latest: ${latest.competitor}, ${latest.package}, Rs ${latest.price}, seen ${latest.dateSeen}.`;
}

/** Plain-words text for one note: competitor, package and price with the date seen visible. */
export function competitorPriceNoteEntryText(note) {
  const clean = normalizeCompetitorPriceNote(note);
  if (!clean) return 'No competitor price note recorded.';
  return `${clean.dateSeen} — ${clean.competitor}: ${clean.package}, Rs ${clean.price}. Source: ${clean.source}. Recorded by ${clean.recordedBy}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function competitorPriceNoteEntryHtml(note) {
  const clean = normalizeCompetitorPriceNote(note);
  if (!clean) return '<p>No competitor price note recorded.</p>';
  return `<p>${escapeHtml(competitorPriceNoteEntryText(clean))}</p>`;
}

export function competitorPriceNoteAllHtml(list) {
  const rows = competitorPriceNotesSorted(list);
  if (!rows.length) return '<p>No competitor price notes recorded.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(competitorPriceNoteEntryText(note))}</li>`).join('')}</ul>`;
}

export function competitorPriceNotesForCompetitorHtml(list, competitor) {
  const rows = competitorPriceNotesForCompetitor(list, competitor);
  if (!rows.length) return '<p>No competitor price notes recorded for this competitor.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(competitorPriceNoteEntryText(note))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function competitorPriceNoteCsv(list) {
  const rows = competitorPriceNotesSorted(list);
  const lines = ['"id","competitor","package","price","date seen","source","recorded by"'];
  for (const note of rows) {
    lines.push([
      csvCell(note.id),
      csvCell(note.competitor),
      csvCell(note.package),
      csvCell(note.price),
      csvCell(note.dateSeen),
      csvCell(note.source),
      csvCell(note.recordedBy),
    ].join(','));
  }
  return lines.join('\n');
}

export function competitorPriceNoteFilename() {
  return 'competitor-price-notes.csv';
}
