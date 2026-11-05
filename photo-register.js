// Plan 238 (Plan 203-350) — Field visit photo register.
//
// Photos taken on field visits sit on phones with no link to the
// visit, so a useful photo of a pole, cabinet, or drop cable cannot
// be found when the fault returns. This module adds only the
// missing piece: one register entry per photo — the date, the visit
// reference, the subject in plain words, the purpose, and the phone
// or folder where the photo is kept.
//
// This stores a dated log with purpose, not the photo itself. No
// photo bytes, no file path to a live image, and no link to any
// gallery live here: the register only says where the photo is
// kept, in the operator's own words.
//
// The fences, stated plainly:
//   - This is not the field photo and note attachment record
//     (Plan 138), which is attachment metadata on a record: that
//     module is neither read nor rewritten here, and this module
//     imports nothing.
//   - An entry is never edited, only annotated. There is no edit
//     function: only record, annotate, and remove. An annotation
//     never rewrites the date, the visit reference, the subject,
//     the purpose, or where the photo is kept.
//   - Photos list by visit and by date, and each entry states its
//     purpose. Entries for one visit can be listed together.
//   - Keeping the register never changes any bill, payment,
//     customer, fault, or attachment record by itself: the module
//     takes no bill, payment, customer, fault, or attachment
//     object in, edits none, and returns none. Visit references,
//     subjects, and purposes arrive as plain text.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validPhotoRegisterDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function cleanAnnotation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validPhotoRegisterDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const visitRef = text(raw.visitRef);
  const subject = text(raw.subject);
  const purpose = text(raw.purpose);
  const keptOn = text(raw.keptOn);
  if (!id || !validPhotoRegisterDate(date) || !visitRef || !subject || !purpose || !keptOn) return null;
  const annotations = Array.isArray(raw.annotations)
    ? raw.annotations.map(cleanAnnotation).filter(Boolean)
    : [];
  return { id, date, visitRef, subject, purpose, keptOn, annotations };
}

export function normalizePhotoRegisterList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordPhotoRegister(list, raw) {
  const clean = normalizePhotoRegisterList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removePhotoRegister(list, id) {
  const clean = normalizePhotoRegisterList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findPhotoRegister(list, id) {
  const clean = normalizePhotoRegisterList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addPhotoRegisterAnnotation(list, id, date, note) {
  const clean = normalizePhotoRegisterList(list);
  const wanted = text(id);
  const annotation = cleanAnnotation({ date, note });
  if (!wanted || !annotation) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, annotations: [...item.annotations, annotation] };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.visitRef !== b.visitRef) return a.visitRef < b.visitRef ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function photoRegisterSorted(list) {
  return normalizePhotoRegisterList(list).sort(compareEntries);
}

export function photoRegisterForVisit(list, visitRef) {
  const wanted = text(visitRef).toLowerCase();
  if (!wanted) return [];
  return photoRegisterSorted(list).filter((item) => item.visitRef.toLowerCase() === wanted);
}

export function photoRegisterOnDate(list, date) {
  const wanted = text(date);
  if (!validPhotoRegisterDate(wanted)) return [];
  return photoRegisterSorted(list).filter((item) => item.date === wanted);
}

export function photoRegisterVisitRefs(list) {
  const seen = new Set();
  const out = [];
  for (const item of photoRegisterSorted(list)) {
    const key = item.visitRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.visitRef);
  }
  return out;
}

export function photoRegisterSummaryText(list) {
  const clean = normalizePhotoRegisterList(list);
  const visits = photoRegisterVisitRefs(list).length;
  if (!clean.length) return 'No visit photos registered.';
  return `${clean.length} photo${clean.length === 1 ? '' : 's'} registered across ${visits} visit${visits === 1 ? '' : 's'}.`;
}

export function photoRegisterText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No photo registered.';
  const notes = clean.annotations.length
    ? ` Annotations: ${clean.annotations.map((a) => `${a.date}: ${a.note}`).join('; ')}`
    : '';
  return `Photo of ${clean.subject} on ${clean.date} for visit ${clean.visitRef}. Purpose: ${clean.purpose}. Kept on ${clean.keptOn}.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function photoRegisterHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No photo registered.</p>';
  const notes = clean.annotations.length
    ? `<br>Annotations: ${escapeHtml(clean.annotations.map((a) => `${a.date}: ${a.note}`).join('; '))}`
    : '';
  return `<p>Photo of <strong>${escapeHtml(clean.subject)}</strong> on ${escapeHtml(clean.date)} for visit ${escapeHtml(clean.visitRef)}. Purpose: ${escapeHtml(clean.purpose)}. Kept on ${escapeHtml(clean.keptOn)}.${notes}</p>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function photoRegisterCsv(list) {
  const sorted = photoRegisterSorted(list);
  const header = ['id', 'date', 'visit reference', 'subject', 'purpose', 'kept on', 'annotations'];
  const rows = sorted.map((item) => [
    item.id,
    item.date,
    item.visitRef,
    item.subject,
    item.purpose,
    item.keptOn,
    item.annotations.map((a) => `${a.date}: ${a.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function photoRegisterFilename() {
  return 'photo-register.csv';
}
