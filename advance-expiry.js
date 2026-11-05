// Plan 209 (Plan 203-350) — Advance payment expiry note.
//
// An advance payment (Plan 101) can sit unconsumed for months with no
// term and no warning, so its status is only discovered when the
// customer asks about it. This module is that note in writing: one
// expiry note per advance, with the advance reference, the remaining
// amount as the operator types it, and the operator-set term or review
// date. Advances nearing their term appear on a review list ordered
// by date, so old advances are reviewed while the customer is still
// around to discuss them.
//
// Scope fence, stated plainly:
//   - This flags only. Expiry or forfeiture, if the shop ever allows
//     it, happens only through a separate operator-recorded decision,
//     never automatically and never through this module.
//   - It is NOT the advance payment record itself (advance-payment.js,
//     advance-allocation.js, advance-dashboard.js, advance-prepay.js)
//     and it is NOT the credit balance (Plan 103): those modules are
//     neither read nor written here. The advance reference here is
//     only a reference the operator types — this module never follows
//     it into a payment, bill, or credit record, and recording a note
//     never changes any advance, bill, payment, or credit balance by
//     itself.
//   - It is import-free: the caller supplies every note and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     refused, never mapped onto a neighbouring date).

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function validExpiryDate(value) {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) limit = 29;
  return day <= limit;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Pure civil-date arithmetic (no clock, no timezone): day numbers count
// days since 1970-01-01, converted with the standard era algorithm.
function floorDiv(a, b) {
  return Math.floor(a / b);
}

function dayNumber(value) {
  let [year, month, day] = value.split('-').map(Number);
  if (month <= 2) year -= 1;
  const era = floorDiv(year, 400);
  const yoe = year - era * 400;
  const mp = month > 2 ? month - 3 : month + 9;
  const doy = floorDiv(153 * mp + 2, 5) + day - 1;
  const doe = yoe * 365 + floorDiv(yoe, 4) - floorDiv(yoe, 100) + doy;
  return era * 146097 + doe - 719468;
}

export function normalizeExpiryNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const advanceRef = cleanText(raw.advanceRef);
  const remainingAmount = cleanText(raw.remainingAmount);
  const termDate = cleanText(raw.termDate);
  if (!id || !advanceRef || !remainingAmount || !validExpiryDate(termDate)) return null;
  return {
    id,
    advanceRef,
    remainingAmount,
    termDate,
    note: cleanText(raw.note),
  };
}

export function normalizeExpiryList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeExpiryNote(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function findExpiryNote(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeExpiryList(list).find((note) => note.id === clean) ?? null;
}

export function recordExpiryNote(list, note) {
  const clean = normalizeExpiryList(list);
  const next = normalizeExpiryNote(note);
  if (!next) return clean;
  if (clean.some((item) => item.id === next.id)) return clean;
  return [...clean, next];
}

export function removeExpiryNote(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeExpiryList(list);
  return normalizeExpiryList(list).filter((note) => note.id !== clean);
}

export function expiryNotesSorted(list) {
  return normalizeExpiryList(list).sort((a, b) => {
    if (a.termDate !== b.termDate) return a.termDate < b.termDate ? -1 : 1;
    const ra = a.advanceRef.toLowerCase();
    const rb = b.advanceRef.toLowerCase();
    if (ra !== rb) return ra < rb ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function expiryNotesForAdvance(list, advanceRef) {
  const want = cleanText(advanceRef).toLowerCase();
  if (!want) return expiryNotesSorted(list);
  return expiryNotesSorted(list).filter((note) =>
    note.advanceRef.toLowerCase().includes(want));
}

// The review list: notes whose term falls within `withinDays` days
// after the reference date, ordered by term date. Terms already past
// are not "nearing" — they are overdue, and expiryNotesOverdue lists
// them separately so neither group hides inside the other.
export function expiryNotesNearing(list, referenceDate, withinDays = 30) {
  const ref = cleanText(referenceDate);
  if (!validExpiryDate(ref)) return [];
  const span = Number.isFinite(Number(withinDays))
    ? Math.max(1, Math.min(365, Math.trunc(Number(withinDays))))
    : 30;
  const refDay = dayNumber(ref);
  const lastDay = refDay + span;
  return expiryNotesSorted(list).filter((note) => {
    const termDay = dayNumber(note.termDate);
    return termDay >= refDay && termDay <= lastDay;
  });
}

export function expiryNotesOverdue(list, referenceDate) {
  const ref = cleanText(referenceDate);
  if (!validExpiryDate(ref)) return [];
  const refDay = dayNumber(ref);
  return expiryNotesSorted(list).filter((note) => dayNumber(note.termDate) < refDay);
}

// Days from the reference date to the term: negative when overdue.
export function expiryDaysLeft(note, referenceDate) {
  const clean = normalizeExpiryNote(note);
  const ref = cleanText(referenceDate);
  if (!clean || !validExpiryDate(ref)) return null;
  return dayNumber(clean.termDate) - dayNumber(ref);
}

export function expiryNoteText(note) {
  const clean = normalizeExpiryNote(note);
  if (!clean) return '';
  const noteText = clean.note ? ` — ${clean.note}` : ' — No note.';
  return `Advance ${clean.advanceRef} · Remaining: ${clean.remainingAmount} · Term: ${clean.termDate}${noteText}`;
}

export function expirySummaryText(list) {
  const clean = normalizeExpiryList(list);
  if (!clean.length) return 'No advance expiry notes recorded.';
  const word = clean.length === 1 ? 'note' : 'notes';
  return `${clean.length} advance expiry ${word} recorded.`;
}

export function expiryReviewText(list, referenceDate, withinDays = 30) {
  const ref = cleanText(referenceDate);
  if (!validExpiryDate(ref)) return '';
  const nearing = expiryNotesNearing(list, ref, withinDays);
  const overdue = expiryNotesOverdue(list, ref);
  const parts = [];
  if (overdue.length) {
    parts.push(`Overdue: ${overdue.map(expiryNoteText).join('; ')}.`);
  }
  if (nearing.length) {
    parts.push(`Nearing term: ${nearing.map(expiryNoteText).join('; ')}.`);
  }
  if (!parts.length) return `No advances nearing their term from ${ref}.`;
  return parts.join(' ');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function expiryNoteHtml(note) {
  const clean = normalizeExpiryNote(note);
  if (!clean) return '';
  const noteText = clean.note ? ` — ${escapeHtml(clean.note)}` : ' — No note.';
  return `<p>Advance ${escapeHtml(clean.advanceRef)} · Remaining: ${escapeHtml(clean.remainingAmount)} · Term: ${escapeHtml(clean.termDate)}${noteText}</p>`;
}

export function expiryAllHtml(list) {
  return expiryNotesSorted(list).map(expiryNoteHtml).join('');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function expiryCsv(list) {
  const rows = [['id', 'advance_ref', 'remaining_amount', 'term_date', 'note']];
  for (const note of expiryNotesSorted(list)) {
    rows.push([note.id, note.advanceRef, note.remainingAmount, note.termDate, note.note]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function expiryFilename() {
  return 'advance-expiry.csv';
}
