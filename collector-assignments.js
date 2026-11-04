// Plan 99 (Plan 1-100) — Mohalla-to-collector assignment for a second
// collector.
//
// This module is the ASSIGNMENT RECORD and the FILTER only, and nothing
// else:
//
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never mutates an input. It names no record field of its own
//     beyond id, mohalla, and collector, and it never reads or
//     rewrites the route list (Plan 1), the visit queue (Plan 2), or
//     the dispatch queue (Plan 23) — those live elsewhere and are
//     untouched. The three filter functions below only select, from a
//     caller-supplied list, the entries whose mohalla belongs to one
//     collector; they never change an entry.
//   - Each mohalla carries at most one assigned collector. Assigning
//     a mohalla that already has one replaces the old assignment, so
//     a mohalla can never point at two collectors at once. A mohalla
//     with no assignment stays visible to the owner view, which
//     always shows every mohalla together.
//   - Reassigning a mohalla moves only future filtered views: the
//     assignment list is the only thing this module ever changes, so
//     no past record of any kind is rewritten by an assignment change.
//   - A blank collector filter means the owner view: every entry is
//     shown, assigned or not. A named collector sees exactly the
//     entries of their assigned mohallas, and nothing else.
//   - Mohalla names are canonicalised the same way the other
//     mohalla-aware plans do: case and surrounding space ignored,
//     a leading "MOHALLA " prefix ignored, and the known aliases
//     BANI, KISHTI, and CHAMYAA folded to their canonical spellings.
//     An entry whose mohalla cannot be read belongs to no collector
//     and appears only in the owner view.
//   - Half-formed records are refused outright, never stored
//     half-formed. Unknown fields are dropped on normalisation, so
//     the record can never grow a field it does not own.

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
});

/** Canonical mohalla key for a raw name, or null for a blank name. */
export function canonicalCollectorMohalla(value) {
  if (value === null || value === undefined) return null;
  let key = String(value).normalize('NFKC').trim().toLocaleUpperCase().replace(/\s+/g, ' ');
  if (!key) return null;
  if (key.startsWith('MOHALLA ')) key = key.slice('MOHALLA '.length).trim();
  if (!key) return null;
  const folded = MOHALLA_ALIASES[key.toLocaleLowerCase()];
  return folded ?? key;
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

/**
 * Normalise one assignment record, or null when it is half-formed:
 * no id, a blank mohalla, or a blank collector. Unknown fields are
 * dropped, so the returned record carries exactly id, mohalla, and
 * collector.
 */
export function normalizeAssignment(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const mohalla = canonicalCollectorMohalla(record.mohalla);
  const collector = cleanText(record.collector);
  if (!id || !mohalla || !collector) return null;
  return { id, mohalla, collector };
}

/** Normalise a list, dropping every half-formed record. */
export function normalizeAssignmentList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const row = normalizeAssignment(record);
    if (row) out.push(row);
  }
  return out;
}

/** Find the assignment for one mohalla, or null when unassigned. */
export function findAssignment(list, mohalla) {
  const key = canonicalCollectorMohalla(mohalla);
  if (!key) return null;
  const rows = normalizeAssignmentList(list);
  return rows.find((row) => row.mohalla === key) ?? null;
}

/** The collector assigned to one mohalla, or null when unassigned. */
export function collectorForMohalla(list, mohalla) {
  const row = findAssignment(list, mohalla);
  return row ? row.collector : null;
}

/**
 * Save one assignment. A mohalla that already has an assignment gets
 * the new collector instead: the old row is replaced, never kept
 * alongside. A half-formed record leaves the list unchanged. The
 * input list is never mutated.
 */
export function upsertAssignment(list, record) {
  const rows = normalizeAssignmentList(list);
  const row = normalizeAssignment(record);
  if (!row) return rows;
  const next = rows.filter((entry) => entry.mohalla !== row.mohalla);
  next.push(row);
  return next;
}

/**
 * Remove an assignment, by its id or by its mohalla. Removing a
 * mohalla that has no assignment leaves the list unchanged.
 */
export function removeAssignment(list, mohallaOrId) {
  const rows = normalizeAssignmentList(list);
  const key = canonicalCollectorMohalla(mohallaOrId);
  const id = cleanText(mohallaOrId);
  return rows.filter((entry) => entry.mohalla !== key && entry.id !== id);
}

/** Every mohalla assigned to one collector, sorted A–Z. */
export function assignedMohallasForCollector(list, collector) {
  const name = cleanText(collector).toLocaleLowerCase();
  if (!name) return [];
  const rows = normalizeAssignmentList(list).filter(
    (row) => row.collector.toLocaleLowerCase() === name,
  );
  return rows.map((row) => row.mohalla).sort((a, b) => a.localeCompare(b));
}

/** Every collector named in the list, sorted A–Z, each named once. */
export function collectorsList(list) {
  const seen = new Set();
  const out = [];
  for (const row of normalizeAssignmentList(list)) {
    const key = row.collector.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row.collector);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Every mohalla in the caller's full list that carries no assignment,
 * sorted A–Z. These stay visible to the owner view.
 */
export function unassignedMohallas(allMohallas, list) {
  const assigned = new Set(normalizeAssignmentList(list).map((row) => row.mohalla));
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(allMohallas) ? allMohallas : []) {
    const key = canonicalCollectorMohalla(raw);
    if (!key || assigned.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** The mohalla an entry belongs to, from any of its usual fields. */
export function itemMohalla(item) {
  if (!item || typeof item !== 'object') return '';
  return item.mohalla ?? item.area ?? item.customerMohalla ?? '';
}

/**
 * Filter one list to one collector's assigned mohallas. A blank
 * collector means the owner view: every entry is returned. The input
 * list is never mutated, and no entry is changed.
 */
export function filterForCollector(items, collector, assignments) {
  const rows = Array.isArray(items) ? items : [];
  const name = cleanText(collector);
  if (!name) return [...rows];
  const allowed = new Set(assignedMohallasForCollector(assignments, name));
  return rows.filter((item) => allowed.has(canonicalCollectorMohalla(itemMohalla(item))));
}

/** The route list (Plan 1) filtered to one collector's mohallas. */
export function filterRouteForCollector(stops, collector, assignments) {
  return filterForCollector(stops, collector, assignments);
}

/** The visit queue (Plan 2) filtered to one collector's mohallas. */
export function filterVisitQueueForCollector(queue, collector, assignments) {
  return filterForCollector(queue, collector, assignments);
}

/** The dispatch queue (Plan 23) filtered to one collector's mohallas. */
export function filterDispatchForCollector(queue, collector, assignments) {
  return filterForCollector(queue, collector, assignments);
}

/** The owner view: every assignment, sorted by mohalla A–Z. */
export function assignmentsForOwner(list) {
  return normalizeAssignmentList(list).sort((a, b) => a.mohalla.localeCompare(b.mohalla));
}

/**
 * A preview for one collector: their assigned mohallas, how many
 * entries of a caller-supplied list fall in them, and the filtered
 * list itself. A blank collector previews the owner view.
 */
export function collectorPreview(list, collector, items) {
  const mohallas = assignedMohallasForCollector(list, collector);
  const filtered = filterForCollector(items, collector, assignmentsForOwner(list));
  return {
    collector: cleanText(collector),
    mohallas,
    total: Array.isArray(items) ? items.length : 0,
    filteredCount: filtered.length,
    filtered,
  };
}

/** One-line summary of the assignment state. */
export function assignmentSummaryText(list, allMohallas) {
  const rows = normalizeAssignmentList(list);
  const collectors = collectorsList(list);
  const unassigned = unassignedMohallas(allMohallas, list);
  const assignedWord = rows.length === 1 ? 'mohalla' : 'mohallas';
  const collectorWord = collectors.length === 1 ? 'collector' : 'collectors';
  const unassignedWord = unassigned.length === 1 ? 'mohalla' : 'mohallas';
  return `${rows.length} ${assignedWord} assigned to ${collectors.length} ${collectorWord}; ${unassigned.length} ${unassignedWord} unassigned and still visible to the owner.`;
}

function escapeCell(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Assignment table HTML; an empty list says so plainly. */
export function assignmentHtml(list) {
  const rows = assignmentsForOwner(list);
  if (rows.length === 0) return '<p>No mohalla is assigned to a collector yet. Unassigned mohallas stay visible to the owner.</p>';
  const body = rows.map((row) => `<tr><td>${escapeCell(row.mohalla)}</td><td>${escapeCell(row.collector)}</td></tr>`).join('');
  return `<table><thead><tr><th>Mohalla</th><th>Assigned collector</th></tr></thead><tbody>${body}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Assignment list as CSV rows, header first. */
export function assignmentCsv(list) {
  const rows = assignmentsForOwner(list);
  const lines = ['id,mohalla,collector'];
  for (const row of rows) lines.push([row.id, row.mohalla, row.collector].map(csvCell).join(','));
  return lines.join('\n');
}

/** Stable CSV filename for an assignment export. */
export function assignmentFilename() {
  return 'collector-assignments.csv';
}
