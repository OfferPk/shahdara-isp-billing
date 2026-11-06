// Offline data conflict note (Plan 334): one note per clash between the
// field-device copy and the shop copy, so the decision is recorded
// instead of silently overwriting one side. A note carries the record
// involved, the field that clashed, the field-device value, the shop
// value, the resolution chosen, who resolved it, and the date. The
// note records conflicts only: it never transfers any data itself, and
// recording or resolving a note never overwrites any bill, payment, or
// customer record by itself — the resolution is applied through the
// normal correction path. The pack that brings field changes back is a
// separate record and is neither read nor rewritten here. Unresolved
// notes stay on an open list until someone resolves them. Notes are
// never edited and never deleted: a wrong note is resolved, not
// rewritten, and the record of the clash stays. Inputs are never
// mutated, and the module never reads storage, the clock, the network,
// or the page.

const DATA_CONFLICT_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isDataConflictLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDataConflictDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = DATA_CONFLICT_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isDataConflictLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

export function foldDataConflictResolution(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (text === 'field' || text === 'shop' || text === 'merged') return text;
  return 'unresolved';
}

function dataConflictText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeDataConflict(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = dataConflictText(raw.id);
  const recordRef = dataConflictText(raw.recordRef);
  const field = dataConflictText(raw.field);
  const date = dataConflictText(raw.date);
  if (!id || !recordRef || !field || !validDataConflictDay(date)) return null;
  if (typeof raw.fieldValue !== 'string' || typeof raw.shopValue !== 'string') return null;
  const fieldValue = raw.fieldValue.trim();
  const shopValue = raw.shopValue.trim();
  const resolution = foldDataConflictResolution(raw.resolution);
  const resolver = dataConflictText(raw.resolver);
  if (resolution !== 'unresolved' && !resolver) return null;
  return { id, recordRef, field, fieldValue, shopValue, resolution, resolver, date };
}

export function normalizeDataConflictList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeDataConflict(raw);
    if (note && !seen.has(note.id)) {
      seen.add(note.id);
      out.push(note);
    }
  }
  return out;
}

export function findDataConflict(list, id) {
  const clean = normalizeDataConflictList(list);
  const wanted = dataConflictText(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) || null;
}

export function recordDataConflict(list, note) {
  const clean = normalizeDataConflictList(list);
  const next = normalizeDataConflict(note);
  if (!next) return clean;
  if (clean.some((entry) => entry.id === next.id)) return clean;
  return [...clean, next];
}

export function resolveDataConflict(list, id, resolution, resolver) {
  const clean = normalizeDataConflictList(list);
  const wanted = dataConflictText(id);
  const folded = foldDataConflictResolution(resolution);
  const by = dataConflictText(resolver);
  if (!wanted || folded === 'unresolved' || !by) return clean;
  const target = clean.find((note) => note.id === wanted);
  if (!target) return clean;
  if (target.resolution !== 'unresolved') return clean;
  return clean.map((note) => (note.id === wanted ? { ...note, resolution: folded, resolver: by } : note));
}

function compareDataConflictsNewestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function compareDataConflictsOldestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function openDataConflicts(list) {
  const clean = normalizeDataConflictList(list);
  return clean
    .filter((note) => note.resolution === 'unresolved')
    .sort(compareDataConflictsOldestFirst);
}

export function dataConflictsForRecord(list, recordRef) {
  const clean = normalizeDataConflictList(list);
  const wanted = dataConflictText(recordRef).toLowerCase();
  if (!wanted) return [];
  return clean
    .filter((note) => note.recordRef.toLowerCase() === wanted)
    .sort(compareDataConflictsNewestFirst);
}

export function dataConflictRecords(list) {
  const clean = normalizeDataConflictList(list);
  const seen = new Map();
  for (const note of clean) {
    const key = note.recordRef.toLowerCase();
    if (!seen.has(key)) seen.set(key, note.recordRef);
  }
  return [...seen.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
}

export function dataConflictSummaryText(list) {
  const clean = normalizeDataConflictList(list);
  if (!clean.length) return 'No offline data conflicts recorded.';
  const open = clean.filter((note) => note.resolution === 'unresolved').length;
  const field = clean.filter((note) => note.resolution === 'field').length;
  const shop = clean.filter((note) => note.resolution === 'shop').length;
  const merged = clean.filter((note) => note.resolution === 'merged').length;
  return `${clean.length} offline data conflict note${clean.length === 1 ? '' : 's'}; ${open} open. Resolved: field copy kept ${field}, shop copy kept ${shop}, merged ${merged}.`;
}

export function dataConflictResolutionText(resolution) {
  const folded = foldDataConflictResolution(resolution);
  if (folded === 'field') return 'Field copy kept';
  if (folded === 'shop') return 'Shop copy kept';
  if (folded === 'merged') return 'Merged by hand';
  return 'Unresolved';
}

function escapeDataConflictHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dataConflictValueText(value) {
  return value ? value : 'blank';
}

export function dataConflictNoteText(note) {
  const clean = normalizeDataConflict(note);
  if (!clean) return '';
  const resolved = clean.resolution === 'unresolved'
    ? 'Unresolved'
    : `${dataConflictResolutionText(clean.resolution)} by ${clean.resolver}`;
  return `${clean.recordRef} — ${clean.field}: field "${dataConflictValueText(clean.fieldValue)}" vs shop "${dataConflictValueText(clean.shopValue)}" — ${resolved} (${clean.date})`;
}

export function dataConflictNoteHtml(note) {
  const clean = normalizeDataConflict(note);
  if (!clean) return '';
  const resolved = clean.resolution === 'unresolved'
    ? 'Unresolved'
    : `${dataConflictResolutionText(clean.resolution)} by ${clean.resolver}`;
  return `<div><strong>${escapeDataConflictHtml(clean.recordRef)}</strong> — ${escapeDataConflictHtml(clean.field)} (${escapeDataConflictHtml(clean.date)})<br>Field: ${escapeDataConflictHtml(dataConflictValueText(clean.fieldValue))}<br>Shop: ${escapeDataConflictHtml(dataConflictValueText(clean.shopValue))}<br>Resolution: ${escapeDataConflictHtml(resolved)}</div>`;
}

export function dataConflictsHtml(list) {
  const clean = normalizeDataConflictList(list);
  if (!clean.length) return '<p>No offline data conflicts recorded.</p>';
  return dataConflictRecords(clean).map((recordRef) => {
    const notes = dataConflictsForRecord(clean, recordRef);
    const items = notes.map((note) => `<li>${escapeDataConflictHtml(dataConflictNoteText(note))}</li>`).join('');
    return `<h4>${escapeDataConflictHtml(recordRef)}</h4><ul>${items}</ul>`;
  }).join('');
}

export function openDataConflictsHtml(list) {
  const open = openDataConflicts(list);
  if (!open.length) return '<p>No unresolved conflicts.</p>';
  return `<ul>${open.map((note) => `<li>${escapeDataConflictHtml(dataConflictNoteText(note))}</li>`).join('')}</ul>`;
}

function dataConflictCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function dataConflictCsv(list) {
  const clean = normalizeDataConflictList(list);
  const header = ['id', 'record', 'field', 'field value', 'shop value', 'resolution', 'resolver', 'date'];
  const lines = [header.map(dataConflictCsvCell).join(',')];
  for (const note of clean) {
    lines.push([
      note.id,
      note.recordRef,
      note.field,
      note.fieldValue,
      note.shopValue,
      note.resolution,
      note.resolver,
      note.date,
    ].map(dataConflictCsvCell).join(','));
  }
  return lines.join('\n');
}

export function dataConflictFilename() {
  return 'offline-data-conflicts.csv';
}
