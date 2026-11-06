// Data anonymisation note (Plan 340): one note per demo or training copy,
// so the shop knows exactly what was anonymised before a copy is used to
// train a new collector. A note carries the copy reference, the fields
// anonymised, the method in plain words, the date the copy was made, and
// the holder. A copy with no note is flagged as unapproved for training
// use. The note only describes a copy: it never creates a copy and never
// changes any live customer, bill, or payment record. Inputs are never
// mutated, and the module never reads storage, the clock, the network, or
// the page.

const ANONYMISATION_NOTE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isAnonymisationNoteLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validAnonymisationNoteDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = ANONYMISATION_NOTE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isAnonymisationNoteLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanAnonymisationNoteText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAnonymisationNoteFields(value) {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    const clean = cleanAnonymisationNoteText(part);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export function normalizeAnonymisationNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanAnonymisationNoteText(raw.id);
  const copyRef = cleanAnonymisationNoteText(raw.copyRef);
  const fields = normalizeAnonymisationNoteFields(raw.fields);
  const method = cleanAnonymisationNoteText(raw.method);
  const dateMade = cleanAnonymisationNoteText(raw.dateMade);
  const holder = cleanAnonymisationNoteText(raw.holder);
  if (!id || !copyRef || !fields.length || !method || !validAnonymisationNoteDay(dateMade) || !holder) return null;
  return { id, copyRef, fields, method, dateMade, holder };
}

export function normalizeAnonymisationNoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeAnonymisationNote(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordAnonymisationNote(list, note) {
  const clean = normalizeAnonymisationNote(note);
  if (!clean) return list;
  const known = normalizeAnonymisationNoteList(list);
  if (known.some((entry) => entry.id === clean.id)) return list;
  return [...known, clean];
}

export function anonymisationNoteForCopy(list, copyRef) {
  const clean = normalizeAnonymisationNoteList(list);
  const wanted = cleanAnonymisationNoteText(copyRef).toLowerCase();
  if (!wanted) return null;
  return clean.find((note) => note.copyRef.toLowerCase() === wanted) ?? null;
}

function anonymisationNoteCompareDate(a, b) {
  if (a.dateMade !== b.dateMade) return a.dateMade < b.dateMade ? -1 : 1;
  const aRef = a.copyRef.toLowerCase();
  const bRef = b.copyRef.toLowerCase();
  if (aRef !== bRef) return aRef < bRef ? -1 : 1;
  return 0;
}

export function anonymisationNotesForHolder(list, holder) {
  const clean = normalizeAnonymisationNoteList(list);
  const wanted = cleanAnonymisationNoteText(holder).toLowerCase();
  if (!wanted) return [];
  return clean
    .filter((note) => note.holder.toLowerCase() === wanted)
    .sort(anonymisationNoteCompareDate);
}

export function normalizeAnonymisationNoteCopyRefs(value) {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    const clean = cleanAnonymisationNoteText(part);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export function unapprovedAnonymisationCopies(list, copyRefs) {
  const refs = normalizeAnonymisationNoteCopyRefs(copyRefs);
  const clean = normalizeAnonymisationNoteList(list);
  const noted = new Set(clean.map((note) => note.copyRef.toLowerCase()));
  return refs.filter((ref) => !noted.has(ref.toLowerCase()));
}

export function anonymisationNoteCoverage(list, copyRefs) {
  const refs = normalizeAnonymisationNoteCopyRefs(copyRefs);
  const unapprovedRefs = unapprovedAnonymisationCopies(list, refs);
  return { total: refs.length, noted: refs.length - unapprovedRefs.length, unapproved: unapprovedRefs.length, unapprovedRefs };
}

export function anonymisationNoteCounts(list) {
  const clean = normalizeAnonymisationNoteList(list);
  const copies = new Set(clean.map((note) => note.copyRef.toLowerCase())).size;
  return { total: clean.length, copies };
}

export function anonymisationNoteSummaryText(list, copyRefs) {
  const counts = anonymisationNoteCounts(list);
  const coverage = anonymisationNoteCoverage(list, copyRefs);
  if (!counts.total && !coverage.total) return 'No anonymisation notes.';
  const noteText = counts.total === 1 ? '1 anonymisation note' : `${counts.total} anonymisation notes`;
  const copyText = counts.copies === 1 ? '1 copy' : `${counts.copies} copies`;
  let text = `${noteText} covering ${copyText}.`;
  if (coverage.unapproved) {
    const unapprovedText = coverage.unapproved === 1 ? '1 copy' : `${coverage.unapproved} copies`;
    text += ` ${unapprovedText} unapproved for training use.`;
  }
  return text;
}

function anonymisationNoteDetailText(note) {
  return `fields: ${note.fields.join(', ')}; method: ${note.method}; made ${note.dateMade}; holder ${note.holder}`;
}

export function anonymisationNoteText(note) {
  const clean = normalizeAnonymisationNote(note);
  if (!clean) return '';
  return `${clean.copyRef} — ${anonymisationNoteDetailText(clean)}`;
}

export function anonymisationNotesText(list) {
  const clean = normalizeAnonymisationNoteList(list);
  if (!clean.length) return 'No anonymisation notes.';
  return [...clean].sort(anonymisationNoteCompareDate).map((note) => anonymisationNoteText(note)).join('\n');
}

function escapeAnonymisationNoteHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function anonymisationNoteHtml(note) {
  const clean = normalizeAnonymisationNote(note);
  if (!clean) return '';
  return `<div><strong>${escapeAnonymisationNoteHtml(clean.copyRef)}</strong> — ${escapeAnonymisationNoteHtml(anonymisationNoteDetailText(clean))}</div>`;
}

export function anonymisationNotesHtml(list) {
  const clean = normalizeAnonymisationNoteList(list);
  if (!clean.length) return '<p>No anonymisation notes yet.</p>';
  const items = [...clean]
    .sort(anonymisationNoteCompareDate)
    .map((note) => `<li>${escapeAnonymisationNoteHtml(anonymisationNoteText(note))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

export function anonymisationNoteUnapprovedHtml(list, copyRefs) {
  const unapproved = unapprovedAnonymisationCopies(list, copyRefs);
  if (!unapproved.length) return '<p>No copies unapproved for training use.</p>';
  const items = unapproved.map((ref) => `<li>${escapeAnonymisationNoteHtml(ref)} — no anonymisation note</li>`).join('');
  return `<ul>${items}</ul>`;
}

function anonymisationNoteCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function anonymisationNoteCsv(list) {
  const clean = normalizeAnonymisationNoteList(list);
  const header = ['id', 'copyRef', 'fields', 'method', 'dateMade', 'holder'];
  const lines = [header.map(anonymisationNoteCsvCell).join(',')];
  for (const note of clean) {
    lines.push([
      note.id,
      note.copyRef,
      note.fields.join('; '),
      note.method,
      note.dateMade,
      note.holder,
    ].map(anonymisationNoteCsvCell).join(','));
  }
  return lines.join('\n');
}

export function anonymisationNoteFilename() {
  return 'data-anonymisation-notes.csv';
}
