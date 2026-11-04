// Plan 151 (Plan 101-202) — Fault Root-Cause Code Catalogue.
//
// Fault notes describe causes in free words, so the same cause is
// written many ways and cannot be counted. This module is the
// catalogue that fixes that: one root-cause code with a short
// code, a plain-words meaning, and a category (cable, power,
// equipment, customer-side, or other). Fault tickets link to a
// code through a separate link record, so faults filter and count
// by root-cause code, and the real top causes of faults become
// countable — fixes target the cause, not the symptom.
//
// What this module is NOT, stated plainly:
//   - It is not SISP-123's root-cause advisor. That module
//     (root-cause-advisor.js) derives a permanent-fix prescription
//     from repeat complaint/ticket categories; it is neither read
//     nor written here, and no advice, prescription, or category
//     from it is copied into this catalogue. This catalogue holds
//     only operator-defined codes and ticket links.
//   - It is not a ticket editor. Linking a ticket to a code never
//     opens, closes, rewrites, or otherwise changes any ticket
//     note, and it never changes any bill or payment. The link is
//     a separate record that points at the ticket id.
//   - It is not a repair order. A code or a link does not
//     schedule a fix, order a part, or change any service state;
//     it only makes the cause countable.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed codes are refused outright, never stored
//     half-formed: a code needs a short code and a plain-words
//     meaning. A code with no meaning is refused. Unknown fields
//     are dropped, so a code can never grow a ticket, bill, or
//     payment field, and a link can never grow one either.
//   - A duplicate code is never rewritten: an identical re-save
//     leaves the catalogue unchanged, and a re-save with a
//     different meaning or category is refused outright. There
//     is no edit function; the only later change is removal.
//     Removing a code also drops its ticket links, so a count
//     can never point at a code that no longer exists.
//   - One link per ticket: a ticket already linked to a code
//     keeps that link. An identical re-link leaves the list
//     unchanged, and a re-link to a different code is refused
//     outright. The only later change is removing the link.
//   - Category is one of cable, power, equipment, customer-side,
//     or other; anything else is recorded as other, never stored
//     as a sixth category.
//   - Counts count only links whose code exists in the
//     catalogue, so a stray link can never inflate a count.

const CATEGORIES = ['cable', 'power', 'equipment', 'customer-side', 'other'];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize a category to cable, power, equipment, customer-side, or other. */
export function cleanRootCauseCategory(value) {
  const category = cleanText(value).toLowerCase();
  return CATEGORIES.includes(category) ? category : 'other';
}

/** Normalize one root-cause code, or null when half-formed (no code or no meaning). */
export function normalizeRootCauseCode(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code = cleanText(raw.code).toUpperCase();
  const meaning = cleanText(raw.meaning);
  if (!code || !meaning) return null;
  return {
    code,
    meaning,
    category: cleanRootCauseCategory(raw.category),
  };
}

/** Normalize a catalogue: drop half-formed codes and duplicate codes (first wins). */
export function normalizeRootCauseCodeList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const code = normalizeRootCauseCode(raw);
    if (!code || seen.has(code.code)) continue;
    seen.add(code.code);
    out.push(code);
  }
  return out;
}

/** Find one code by its short code (case-insensitive), or null. */
export function findRootCauseCode(list, code) {
  const clean = cleanText(code).toUpperCase();
  if (!clean) return null;
  return normalizeRootCauseCodeList(list).find((item) => item.code === clean) || null;
}

/**
 * Save one code. Returns a new catalogue, or the input unchanged
 * when the code is half-formed or repeats an existing code.
 */
export function upsertRootCauseCode(list, raw) {
  const clean = normalizeRootCauseCodeList(list);
  const code = normalizeRootCauseCode(raw);
  if (!code) return clean;
  if (clean.some((item) => item.code === code.code)) return clean;
  return [...clean, code];
}

/**
 * Remove one code by its short code, and drop every ticket link
 * that pointed at it. Returns { codes, links }.
 */
export function removeRootCauseCode(list, links, code) {
  const clean = cleanText(code).toUpperCase();
  const codes = normalizeRootCauseCodeList(list).filter((item) => item.code !== clean);
  const kept = normalizeRootCauseLinkList(links).filter((item) => item.code !== clean);
  return { codes, links: kept };
}

/** Normalize one ticket link, or null when half-formed (no id, no ticket, or no code). */
export function normalizeRootCauseLink(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const ticketId = cleanText(raw.ticketId);
  const code = cleanText(raw.code).toUpperCase();
  if (!id || !ticketId || !code) return null;
  return { id, ticketId, code };
}

/** Normalize a link list: drop half-formed links and duplicate ids (first wins). */
export function normalizeRootCauseLinkList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const link = normalizeRootCauseLink(raw);
    if (!link || seen.has(link.id)) continue;
    seen.add(link.id);
    out.push(link);
  }
  return out;
}

/**
 * Link one ticket to one code. Returns a new link list, or the
 * input unchanged when the link is half-formed or the ticket is
 * already linked (one link per ticket, never rewritten).
 */
export function upsertRootCauseLink(list, raw) {
  const clean = normalizeRootCauseLinkList(list);
  const link = normalizeRootCauseLink(raw);
  if (!link) return clean;
  if (clean.some((item) => item.ticketId === link.ticketId)) return clean;
  return [...clean, link];
}

/** Remove one link by id. Returns a new list. */
export function removeRootCauseLink(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeRootCauseLinkList(list);
  return normalizeRootCauseLinkList(list).filter((item) => item.id !== clean);
}

/**
 * Ticket ids linked to one code, ticket id A-Z. Only links whose
 * code exists in the catalogue count; a code absent from the
 * catalogue returns no tickets.
 */
export function faultsForRootCauseCode(links, codes, code) {
  const clean = cleanText(code).toUpperCase();
  if (!clean || !findRootCauseCode(codes, clean)) return [];
  return normalizeRootCauseLinkList(links)
    .filter((item) => item.code === clean)
    .map((item) => item.ticketId)
    .sort(compareText);
}

/**
 * Every catalogue code with its linked-fault count, most faults
 * first (then code A-Z). Codes with no linked faults still appear
 * with a count of zero, so the catalogue is always fully visible.
 */
export function rootCauseCounts(links, codes) {
  const catalogue = normalizeRootCauseCodeList(codes);
  const cleanLinks = normalizeRootCauseLinkList(links);
  const rows = catalogue.map((item) => ({
    code: item.code,
    meaning: item.meaning,
    category: item.category,
    count: cleanLinks.filter((link) => link.code === item.code).length,
  }));
  return rows.sort((a, b) => (b.count - a.count) || compareText(a.code, b.code));
}

/** One-line summary of the catalogue and its links. */
export function rootCauseSummaryText(links, codes) {
  const catalogue = normalizeRootCauseCodeList(codes);
  if (catalogue.length === 0) return 'No root-cause code recorded yet.';
  const cleanLinks = normalizeRootCauseLinkList(links);
  const known = new Set(catalogue.map((item) => item.code));
  const linked = cleanLinks.filter((link) => known.has(link.code)).length;
  return `${catalogue.length} root-cause code${catalogue.length === 1 ? '' : 's'} in the catalogue; `
    + `${linked} fault${linked === 1 ? '' : 's'} linked to a code.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The catalogue as HTML: every code with its meaning and category. */
export function rootCauseCodeHtml(codes) {
  const catalogue = normalizeRootCauseCodeList(codes);
  if (catalogue.length === 0) return '<p>No root-cause code recorded yet.</p>';
  const body = catalogue.map((item) => `<tr><td>${esc(item.code)}</td>`
    + `<td>${esc(item.meaning)}</td><td>${esc(item.category)}</td></tr>`).join('');
  return '<table><thead><tr><th>Code</th><th>Meaning</th>'
    + '<th>Category</th></tr></thead><tbody>' + body + '</tbody></table>';
}

/** Fault counts by root-cause code as HTML, most faults first. */
export function rootCauseCountHtml(links, codes) {
  const rows = rootCauseCounts(links, codes);
  if (rows.length === 0) return '<p>No root-cause code recorded yet.</p>';
  const body = rows.map((row) => `<tr><td>${esc(row.code)}</td>`
    + `<td>${esc(row.meaning)}</td><td>${esc(row.category)}</td>`
    + `<td>${row.count}</td></tr>`).join('');
  return '<table><thead><tr><th>Code</th><th>Meaning</th>'
    + '<th>Category</th><th>Faults</th></tr></thead><tbody>' + body + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for the catalogue with fault counts. */
export function rootCauseCsv(links, codes) {
  const rows = rootCauseCounts(links, codes);
  const lines = ['code,meaning,category,faultCount'];
  for (const row of rows) {
    lines.push([row.code, row.meaning, row.category, row.count].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the root-cause catalogue. */
export function rootCauseFilename() {
  return 'root-cause-codes.csv';
}
