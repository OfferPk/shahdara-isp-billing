// Plan 219 (Plan 203-350) — Waiver reason catalogue.
//
// Waivers are written in free words ("helped him out", "good
// customer"), so the same reason is written many ways and waiver
// patterns cannot be counted. Approval limits (Plan 110) control who
// may waive, not why. This module is the catalogue only: one entry
// per standard waiver reason — a short code, a plain-words meaning,
// and a category — so operators pick a reason from the catalogue
// when recording a waiver, and waivers can be filtered and counted
// by catalogue reason.
//
// What this module is NOT, stated plainly:
//   - It is not a waiver. It grants no waiver, waives no fee, and
//     never rewrites any past waiver: a waiver recorded in free
//     words before the catalogue stays exactly as written, and
//     adding the catalogue never rewrites any existing waiver,
//     bill, or payment.
//   - It is not the approval limit (Plan 110). The Plan 110
//     approval-limits module was checked first: it holds who may
//     waive and how much, and this module never reads or
//     rewrites it. A catalogue code is a reason, not permission.
//   - It is not the late-fee waiver record (late-fee-waiver.js).
//     That SISP module holds the waiver itself, and this module
//     never reads or rewrites it: the counting functions take a
//     waiver list supplied by the caller and only read each
//     waiver's reason code, never changing a waiver.
//   - It is not any SISP/MD module. The corresponding SISP/MD
//     material was checked first: no standard waiver-reason
//     catalogue exists there, so this module adds only the
//     missing piece and never reads or rewrites an SISP/MD record.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every entry
//     and every waiver list, and the module never reads storage,
//     the clock, or the network, and never mutates an input.
//   - A catalogue entry with no code, no meaning, or no category
//     is refused outright. Codes are stored upper-cased and
//     trimmed, so "hardship" and "HARDSHIP" are the same reason
//     and can never become two reasons. Unknown fields are
//     dropped, so an entry can never grow a bill, payment, or
//     waiver field.
//   - A duplicate code is never rewritten: a re-save with a
//     different meaning also leaves the catalogue unchanged.
//     There is no edit function; only recording an entry and
//     removal.
//   - Counting is by catalogue code only. A waiver whose reason
//     code matches no catalogue entry is counted separately as
//     uncatalogued, never silently folded into a catalogue
//     reason, so the pattern the owner sees is honest.

export const WAIVER_REASON_STARTERS = [
  { code: 'HARDSHIP', meaning: 'Customer facing genuine financial hardship', category: 'hardship' },
  { code: 'GOODWILL', meaning: 'Goodwill gesture for a loyal customer', category: 'goodwill' },
  { code: 'ERROR', meaning: 'Correction of a billing error', category: 'error correction' },
];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeWaiverReason(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code = cleanText(raw.code).toUpperCase();
  const meaning = cleanText(raw.meaning);
  const category = cleanText(raw.category);
  if (!code || !meaning || !category) return null;
  return { code, meaning, category };
}

export function normalizeWaiverReasonList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const clean = normalizeWaiverReason(raw);
    if (!clean || seen.has(clean.code)) continue;
    seen.add(clean.code);
    out.push(clean);
  }
  return out;
}

export function findWaiverReason(list, code) {
  const clean = normalizeWaiverReasonList(list);
  const wanted = cleanText(code).toUpperCase();
  return clean.find((entry) => entry.code === wanted) ?? null;
}

export function recordWaiverReason(list, entry) {
  const clean = normalizeWaiverReasonList(list);
  const next = normalizeWaiverReason(entry);
  if (!next) return clean;
  if (clean.some((item) => item.code === next.code)) return clean;
  return [...clean, next];
}

export function removeWaiverReason(list, code) {
  const wanted = cleanText(code).toUpperCase();
  return normalizeWaiverReasonList(list).filter((entry) => entry.code !== wanted);
}

export function waiverReasonsSorted(list) {
  return normalizeWaiverReasonList(list).sort((a, b) => a.code.localeCompare(b.code));
}

export function waiverReasonsForCategory(list, category) {
  const query = cleanText(category).toLowerCase();
  if (!query) return [];
  return waiverReasonsSorted(list).filter((entry) =>
    entry.category.toLowerCase().includes(query),
  );
}

// A waiver, for counting, is any record carrying a reasonCode
// string. Only the reason code is read; the waiver itself is
// never changed, and a record with no usable code counts as
// uncatalogued rather than being guessed into a reason.
function waiverReasonCodeOf(waiver) {
  if (!waiver || typeof waiver !== 'object') return '';
  return cleanText(waiver.reasonCode).toUpperCase();
}

export function waiversForReason(waivers, code) {
  const wanted = cleanText(code).toUpperCase();
  if (!wanted || !Array.isArray(waivers)) return [];
  return waivers.filter((waiver) => waiverReasonCodeOf(waiver) === wanted);
}

export function waiverReasonCounts(catalogue, waivers) {
  const entries = waiverReasonsSorted(catalogue);
  const list = Array.isArray(waivers) ? waivers : [];
  return entries.map((entry) => ({
    code: entry.code,
    meaning: entry.meaning,
    category: entry.category,
    count: list.filter((waiver) => waiverReasonCodeOf(waiver) === entry.code).length,
  }));
}

export function waiverReasonUncataloguedCount(catalogue, waivers) {
  const known = new Set(waiverReasonsSorted(catalogue).map((entry) => entry.code));
  const list = Array.isArray(waivers) ? waivers : [];
  return list.filter((waiver) => !known.has(waiverReasonCodeOf(waiver))).length;
}

export function waiverReasonSummary(catalogue, waivers) {
  const counts = waiverReasonCounts(catalogue, waivers);
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  const uncatalogued = waiverReasonUncataloguedCount(catalogue, waivers);
  const used = counts.filter((row) => row.count > 0).length;
  const uncataloguedText = uncatalogued === 0
    ? 'none uncatalogued'
    : `${uncatalogued} uncatalogued`;
  return `${total} waiver(s) across ${used} catalogue reason(s) (${counts.length} reason(s) in catalogue), ${uncataloguedText}.`;
}

export function waiverReasonText(entry) {
  if (!entry) return 'No waiver reason.';
  return `${entry.code}: ${entry.meaning} (${entry.category}).`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function waiverReasonHtml(entry) {
  if (!entry) return '<p>No waiver reason.</p>';
  return `<p>${escapeHtml(waiverReasonText(entry))}</p>`;
}

export function waiverReasonAllHtml(entries) {
  const clean = Array.isArray(entries) ? waiverReasonsSorted(entries) : [];
  if (!clean.length) return '<p>No waiver reasons in the catalogue yet.</p>';
  const rows = clean.map((entry) =>
    `<tr><td>${escapeHtml(entry.code)}</td><td>${escapeHtml(entry.meaning)}</td><td>${escapeHtml(entry.category)}</td></tr>`,
  ).join('');
  return `<table><thead><tr><th>Code</th><th>Meaning</th><th>Category</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function waiverReasonCsv(entries) {
  const clean = Array.isArray(entries) ? waiverReasonsSorted(entries) : [];
  const header = 'Code,Meaning,Category';
  const rows = clean.map((entry) => [
    entry.code, entry.meaning, entry.category,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function waiverReasonFilename() {
  return 'waiver-reasons.csv';
}
