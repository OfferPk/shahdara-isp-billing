// Plan 195 (Plan 101-202) — App Version and Release Notes Log for Owner.
//
// The owner hears that the app changed but has no plain-words record
// of which version arrived when and what changed for the shop. This
// module writes that record down — one entry per version: the
// version, the date it arrived, what changed in plain words, and a
// note for the shop.
//
// What this module is NOT, stated plainly:
//   - It is not a release. Logging a version never changes app
//     behaviour, never changes any bill, payment, or customer
//     record, and never ships anything: it only writes down what
//     the operator says arrived.
//   - It is not the release-assurance gate. release-assurance.js
//     (Plan Z: APP_VERSION as the single version source, and the
//     pre-release gate) is neither read nor written here; this
//     adds only the owner-facing log. This module never reads
//     APP_VERSION, never checks a `?v=` pin, and never bumps any
//     version anywhere.
//   - It is not an edit history. There is no edit function at
//     all: a version entry is recorded or removed — never
//     silently rewritten — so past entries stay exactly as the
//     operator first wrote them.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment, customer,
//     or sending field can ever creep into a version entry.
//   - Duplicate ids are never rewritten.
//   - Plain words only: a change line containing technical
//     filler (commit, merge/merged, deploy/deployed, pr, api,
//     endpoint, refactor/refactored, hotfix, pull request,
//     codebase, backend, frontend) is refused outright, so the
//     log stays readable by the owner without asking the
//     developer what a line means.
//   - Inputs are never mutated: every function returns new
//     records.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function normalizeDate(value) {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (month < 1 || month > 12) return null;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > maxDay) return null;
  return date;
}

function normalizeVersion(value) {
  const version = text(value);
  if (!/^\d+(\.\d+){1,2}$/.test(version)) return null;
  return version;
}

// Technical filler words: whole-word matches only, so "price" is
// never mistaken for a filler word and "api" inside another word
// is never flagged.
const TECHNICAL_WORDS = [
  'commit',
  'merge',
  'merged',
  'deploy',
  'deployed',
  'pr',
  'api',
  'endpoint',
  'refactor',
  'refactored',
  'hotfix',
  'pull request',
  'codebase',
  'backend',
  'frontend',
];

function hasTechnicalFiller(line) {
  return TECHNICAL_WORDS.some((word) => {
    const pattern = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`\\b${pattern}\\b`, 'i').test(line);
  });
}

function normalizeChanges(value) {
  const rawLines = Array.isArray(value) ? value : String(value ?? '').split('\n');
  const seen = new Set();
  const out = [];
  for (const raw of rawLines) {
    const line = text(raw);
    if (!line) continue;
    if (hasTechnicalFiller(line)) return null;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function normalizeVersionEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const version = normalizeVersion(raw.version);
  const date = normalizeDate(raw.date);
  const changes = normalizeChanges(raw.changes);
  if (!id || !version || !date || !changes || changes.length === 0) return null;
  return {
    id,
    version,
    date,
    changes,
    shopNote: text(raw.shopNote),
  };
}

function normalizeVersionList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const clean = normalizeVersionEntry(entry);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

function findVersionEntry(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeVersionList(list).find((entry) => entry.id === wanted) || null;
}

function recordVersionEntry(list, raw) {
  const entries = normalizeVersionList(list);
  const entry = normalizeVersionEntry(raw);
  if (!entry) return entries;
  if (entries.some((item) => item.id === entry.id)) return entries;
  return [...entries, entry];
}

function removeVersionEntry(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeVersionList(list);
  return normalizeVersionList(list).filter((entry) => entry.id !== wanted);
}

function versionsSorted(list) {
  return normalizeVersionList(list).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function versionsForVersion(list, version) {
  const wanted = normalizeVersion(version);
  if (!wanted) return [];
  return versionsSorted(list).filter((entry) => entry.version === wanted);
}

function latestVersionEntry(list) {
  return versionsSorted(list)[0] || null;
}

function versionSummaryText(list) {
  const entries = normalizeVersionList(list);
  if (entries.length === 0) return 'No version entries recorded.';
  const latest = latestVersionEntry(list);
  return `${entries.length} version entries recorded, latest: ${latest.version} on ${latest.date}`;
}

function versionText(entry) {
  const clean = normalizeVersionEntry(entry);
  if (!clean) return '';
  const lines = [`${clean.date} — version ${clean.version}`];
  for (const change of clean.changes) lines.push(`- ${change}`);
  if (clean.shopNote) lines.push(`Note for the shop: ${clean.shopNote}`);
  return lines.join('\n');
}

function versionHtml(entry) {
  const clean = normalizeVersionEntry(entry);
  if (!clean) return '';
  const changes = clean.changes.map((change) => `<li>${escapeHtml(change)}</li>`).join('');
  const note = clean.shopNote
    ? `<br>Note for the shop: ${escapeHtml(clean.shopNote)}`
    : '';
  return `<p>${escapeHtml(clean.date)} — version ${escapeHtml(clean.version)}<ul>${changes}</ul>${note}</p>`;
}

function versionAllHtml(list) {
  return versionsSorted(list).map(versionHtml).join('');
}

function versionCsv(list) {
  const rows = [['id', 'version', 'date', 'changes', 'shopNote']];
  for (const entry of versionsSorted(list)) {
    rows.push([
      entry.id,
      entry.version,
      entry.date,
      entry.changes.join(' | '),
      entry.shopNote,
    ]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function versionFilename() {
  return 'version-log.csv';
}

export {
  normalizeDate,
  normalizeVersion,
  normalizeChanges,
  normalizeVersionEntry,
  normalizeVersionList,
  findVersionEntry,
  recordVersionEntry,
  removeVersionEntry,
  versionsSorted,
  versionsForVersion,
  latestVersionEntry,
  versionSummaryText,
  versionText,
  versionHtml,
  versionAllHtml,
  versionCsv,
  versionFilename,
};
