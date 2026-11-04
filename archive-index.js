// Plan 200 (Plan 101-202) — Year-end archive index.
//
// Year-end packs, summaries, and archived records accumulate without
// an index, so finding last year's pack means searching through
// everything again. This module is that index: one entry per pack,
// with its year, pack kind, pack reference, location as entered,
// date archived, and note.
//
// Scope fence, stated plainly:
//   - This indexes packs only. It creates no pack and moves no record
//     by itself, and it never deletes, moves, or changes any archived
//     record, bill, or payment.
//   - It stores references only — a pack name and a location as
//     entered — never the pack's contents and never any bill,
//     payment, or customer record content.
//   - An entry with no pack reference is allowed and is rendered
//     plainly as missing ("Pack missing"), never silently filled in
//     with a neighbouring pack's name.
//   - It is NOT the Plan 187 retention policy module: that module
//     stores the rule for how long each kind is kept, while this
//     module only says where a year's pack can be found. The
//     retention policy module is neither read nor written here.
//   - It is import-free: the caller supplies every entry and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     refused, never mapped onto a neighbouring date).
//   - Years are whole years in 1900-2100, never mapped onto a
//     neighbouring year.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function validArchiveDate(value) {
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

export function normalizeArchiveYear(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d{4}$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function normalizeArchiveEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const year = normalizeArchiveYear(raw.year);
  const packKind = cleanText(raw.packKind);
  const dateArchived = cleanText(raw.dateArchived);
  if (!id || year === null || year < 1900 || year > 2100 || !packKind || !validArchiveDate(dateArchived)) return null;
  return {
    id,
    year,
    packKind,
    packReference: cleanText(raw.packReference),
    location: cleanText(raw.location),
    dateArchived,
    note: cleanText(raw.note),
  };
}

export function normalizeArchiveList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeArchiveEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findArchiveEntry(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeArchiveList(list).find((entry) => entry.id === clean) ?? null;
}

export function recordArchiveEntry(list, entry) {
  const clean = normalizeArchiveList(list);
  const next = normalizeArchiveEntry(entry);
  if (!next) return clean;
  if (clean.some((entry) => entry.id === next.id)) return clean;
  return [...clean, next];
}

export function removeArchiveEntry(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeArchiveList(list);
  return normalizeArchiveList(list).filter((entry) => entry.id !== clean);
}

export function archiveEntriesSorted(list) {
  return normalizeArchiveList(list).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const ka = a.packKind.toLowerCase();
    const kb = b.packKind.toLowerCase();
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function archiveByYear(list, year) {
  const want = normalizeArchiveYear(year);
  if (want === null) return [];
  return archiveEntriesSorted(list).filter((entry) => entry.year === want);
}

export function archiveByKind(list, kind) {
  const want = cleanText(kind).toLowerCase();
  if (!want) return archiveEntriesSorted(list);
  return archiveEntriesSorted(list).filter((entry) => entry.packKind.toLowerCase() === want);
}

export function archiveMissing(list) {
  return archiveEntriesSorted(list).filter((entry) => !entry.packReference);
}

export function archiveSummaryText(list) {
  const clean = normalizeArchiveList(list);
  if (!clean.length) return 'No archive entries logged.';
  const years = new Set(clean.map((entry) => entry.year)).size;
  const missing = clean.filter((entry) => !entry.packReference).length;
  const yearWord = years === 1 ? 'year' : 'years';
  if (!missing) return `${clean.length} archive ${clean.length === 1 ? 'entry' : 'entries'} across ${years} ${yearWord}, none missing.`;
  return `${clean.length} archive ${clean.length === 1 ? 'entry' : 'entries'} across ${years} ${yearWord}, ${missing} missing.`;
}

export function archiveText(entry) {
  const clean = normalizeArchiveEntry(entry);
  if (!clean) return '';
  const pack = clean.packReference ? clean.packReference : 'Pack missing';
  const location = clean.location ? ` · kept at ${clean.location}` : '';
  const note = clean.note ? ` — ${clean.note}` : '';
  return `${clean.year} · ${clean.packKind} · ${pack}${location} · archived ${clean.dateArchived}${note}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function archiveHtml(entry) {
  const clean = normalizeArchiveEntry(entry);
  if (!clean) return '';
  const pack = clean.packReference ? escapeHtml(clean.packReference) : 'Pack missing';
  const location = clean.location ? ` · kept at ${escapeHtml(clean.location)}` : '';
  const note = clean.note ? ` — ${escapeHtml(clean.note)}` : '';
  return `<p>${clean.year} · ${escapeHtml(clean.packKind)} · ${pack}${location} · archived ${escapeHtml(clean.dateArchived)}${note}</p>`;
}

export function archiveAllHtml(list) {
  return archiveEntriesSorted(list).map(archiveHtml).join('');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function archiveCsv(list) {
  const rows = [['id', 'year', 'pack_kind', 'pack_reference', 'location', 'date_archived', 'note']];
  for (const entry of archiveEntriesSorted(list)) {
    rows.push([entry.id, entry.year, entry.packKind, entry.packReference, entry.location, entry.dateArchived, entry.note]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function archiveFilename() {
  return 'archive-index.csv';
}
