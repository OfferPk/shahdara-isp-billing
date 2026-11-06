// Export format version note (Plan 333): one version note per export
// format, so an old export file can still be read back years later.
// A note carries the format name, the version, the fields included,
// the date it was adopted, and the older versions it superseded.
// Each format shows its current version and field list, and an export
// names the format version it used. Superseded versions stay listed
// and are never deleted: there is no remove function and no edit
// function — a new version is recorded, never written over an old one.
// The note documents formats only: it creates no export and it never
// changes any export file, bill, or payment. The export pack itself
// and the export verification checklist are separate records and are
// neither read nor rewritten here; the bill format note records bill
// formats, not export formats, and is neither read nor rewritten here.
// Inputs are never mutated, and the module never reads storage, the
// clock, the network, or the page.

const EXPORT_FORMAT_VERSION_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isExportFormatVersionLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validExportFormatVersionDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = EXPORT_FORMAT_VERSION_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isExportFormatVersionLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function exportFormatVersionText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function exportFormatVersionWordList(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const word = exportFormatVersionText(entry);
    if (word && !seen.has(word)) {
      seen.add(word);
      out.push(word);
    }
  }
  return out;
}

export function normalizeExportFormatVersion(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = exportFormatVersionText(raw.id);
  const format = exportFormatVersionText(raw.format);
  const version = exportFormatVersionText(raw.version);
  const dateAdopted = exportFormatVersionText(raw.dateAdopted);
  const fields = exportFormatVersionWordList(raw.fields);
  if (!id || !format || !version || !validExportFormatVersionDay(dateAdopted)) return null;
  if (fields.length === 0) return null;
  const supersededVersions = exportFormatVersionWordList(raw.supersededVersions)
    .filter((entry) => entry !== version);
  return { id, format, version, fields, dateAdopted, supersededVersions };
}

export function normalizeExportFormatVersionList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeExportFormatVersion(raw);
    if (note && !seen.has(note.id)) {
      seen.add(note.id);
      out.push(note);
    }
  }
  return out;
}

export function findExportFormatVersion(list, id) {
  const clean = normalizeExportFormatVersionList(list);
  return clean.find((note) => note.id === id) || null;
}

export function recordExportFormatVersion(list, note) {
  const clean = normalizeExportFormatVersionList(list);
  const next = normalizeExportFormatVersion(note);
  if (!next) return clean;
  if (clean.some((entry) => entry.id === next.id)) return clean;
  if (clean.some((entry) => entry.format.toLowerCase() === next.format.toLowerCase() && entry.version === next.version)) return clean;
  return [...clean, next];
}

function compareExportFormatVersions(a, b) {
  if (a.dateAdopted !== b.dateAdopted) return a.dateAdopted < b.dateAdopted ? 1 : -1;
  if (a.version !== b.version) return a.version < b.version ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function exportFormatVersionsForFormat(list, format) {
  const clean = normalizeExportFormatVersionList(list);
  const wanted = exportFormatVersionText(format).toLowerCase();
  if (!wanted) return [];
  return clean
    .filter((note) => note.format.toLowerCase() === wanted)
    .sort(compareExportFormatVersions);
}

export function currentExportFormatVersion(list, format) {
  return exportFormatVersionsForFormat(list, format)[0] || null;
}

export function exportFormatNames(list) {
  const clean = normalizeExportFormatVersionList(list);
  const seen = new Map();
  for (const note of clean) {
    const key = note.format.toLowerCase();
    if (!seen.has(key)) seen.set(key, note.format);
  }
  return [...seen.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
}

export function formatVersionForExport(list, format) {
  const current = currentExportFormatVersion(list, format);
  return current ? current.version : null;
}

export function exportFormatVersionSummaryText(list) {
  const clean = normalizeExportFormatVersionList(list);
  const formats = exportFormatNames(clean);
  if (!clean.length) return 'No export format versions recorded.';
  const currents = formats.map((format) => {
    const current = currentExportFormatVersion(clean, format);
    return `${format} ${current.version}`;
  }).join('; ');
  return `${clean.length} export format version note${clean.length === 1 ? '' : 's'} across ${formats.length} format${formats.length === 1 ? '' : 's'}. Current: ${currents}.`;
}

function escapeExportFormatVersionHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportFormatVersionNoteHtml(note) {
  const clean = normalizeExportFormatVersion(note);
  if (!clean) return '';
  const fields = clean.fields.map(escapeExportFormatVersionHtml).join(', ');
  const superseded = clean.supersededVersions.length
    ? `<br>Superseded: ${clean.supersededVersions.map(escapeExportFormatVersionHtml).join(', ')}`
    : '<br>No superseded versions.';
  return `<div><strong>${escapeExportFormatVersionHtml(clean.format)} ${escapeExportFormatVersionHtml(clean.version)}</strong> — adopted ${escapeExportFormatVersionHtml(clean.dateAdopted)}<br>Fields: ${fields}${superseded}</div>`;
}

export function exportFormatVersionsHtml(list) {
  const clean = normalizeExportFormatVersionList(list);
  if (!clean.length) return '<p>No export format versions recorded.</p>';
  return exportFormatNames(clean).map((format) => {
    const notes = exportFormatVersionsForFormat(clean, format);
    const items = notes.map((note, index) => {
      const marker = index === 0 ? ' (current)' : ' (superseded by a later version)';
      const superseded = note.supersededVersions.length
        ? `<br>Superseded: ${note.supersededVersions.map(escapeExportFormatVersionHtml).join(', ')}`
        : '';
      return `<li><strong>${escapeExportFormatVersionHtml(note.version)}</strong> — adopted ${escapeExportFormatVersionHtml(note.dateAdopted)}${marker}<br>Fields: ${note.fields.map(escapeExportFormatVersionHtml).join(', ')}${superseded}</li>`;
    }).join('');
    return `<h4>${escapeExportFormatVersionHtml(format)}</h4><ul>${items}</ul>`;
  }).join('');
}

function exportFormatVersionCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function exportFormatVersionCsv(list) {
  const clean = normalizeExportFormatVersionList(list);
  const header = ['id', 'format', 'version', 'fields', 'date adopted', 'superseded versions'];
  const lines = [header.map(exportFormatVersionCsvCell).join(',')];
  for (const note of clean) {
    lines.push([
      note.id,
      note.format,
      note.version,
      note.fields.join('; '),
      note.dateAdopted,
      note.supersededVersions.join('; '),
    ].map(exportFormatVersionCsvCell).join(','));
  }
  return lines.join('\n');
}

export function exportFormatVersionFilename() {
  return 'export-format-versions.csv';
}

export function normalizeExportFormatStamp(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = exportFormatVersionText(raw.id);
  const exportRef = exportFormatVersionText(raw.exportRef);
  const format = exportFormatVersionText(raw.format);
  const version = exportFormatVersionText(raw.version);
  const date = exportFormatVersionText(raw.date);
  if (!id || !exportRef || !format || !version || !validExportFormatVersionDay(date)) return null;
  return { id, exportRef, format, version, date };
}

export function normalizeExportFormatStampList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const stamp = normalizeExportFormatStamp(raw);
    if (stamp && !seen.has(stamp.id)) {
      seen.add(stamp.id);
      out.push(stamp);
    }
  }
  return out;
}

export function stampExportFormat(stamps, versions, stamp) {
  const cleanStamps = normalizeExportFormatStampList(stamps);
  const next = normalizeExportFormatStamp(stamp);
  if (!next) return cleanStamps;
  if (cleanStamps.some((entry) => entry.id === next.id)) return cleanStamps;
  if (cleanStamps.some((entry) => entry.exportRef === next.exportRef)) return cleanStamps;
  const known = normalizeExportFormatVersionList(versions);
  const match = known.some((note) => note.format.toLowerCase() === next.format.toLowerCase() && note.version === next.version);
  if (!match) return cleanStamps;
  return [...cleanStamps, next];
}

export function exportFormatStampsSorted(list) {
  const clean = normalizeExportFormatStampList(list);
  return clean.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.exportRef !== b.exportRef) return a.exportRef < b.exportRef ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });
}

export function exportFormatStampText(stamp) {
  const clean = normalizeExportFormatStamp(stamp);
  if (!clean) return '';
  return `${clean.exportRef} uses ${clean.format} ${clean.version} (${clean.date})`;
}

export function exportFormatStampsHtml(list) {
  const clean = exportFormatStampsSorted(list);
  if (!clean.length) return '<p>No exports stamped with a format version yet.</p>';
  return `<ul>${clean.map((stamp) => `<li>${escapeExportFormatVersionHtml(exportFormatStampText(stamp))}</li>`).join('')}</ul>`;
}
