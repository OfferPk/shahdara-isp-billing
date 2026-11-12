// Plan 55 (Plan 1-100) — Post-outage restoration verification sweep.
//
// After a major fault is fixed, service is assumed back for everyone,
// but one splitter segment or a handful of ONUs may still be dark, and
// those customers only surface when they complain days later. This
// module is the SWEEP only: a checklist over the customers in a
// resolved outage's affected mohallas or segments — each segment
// marked checked with a date and by whom, each customer confirmed
// back or flagged still down, with still-down cases offered as
// follow-up tickets linked to the original outage.
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every sweep, every
//     customer, every connection record, and every ticket, and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - It is NOT the outage grouping (Plan 22): Plan 22 owns the
//     parent fault and its linked tickets. A sweep reads a resolved
//     outage's area and segments as caller-supplied scope; it never
//     reopens the parent outage, never resolves or closes any
//     ticket, and never changes any outage record.
//   - Completing a sweep never alters any billing, payment, or
//     ticket record — except the follow-up tickets the operator
//     confirms, and those are created by the caller through the
//     existing ticket flow (Plan 21), never by this module. The
//     module only prepares the draft for each still-down case.
//   - Mohalla addressing mirrors the Plan T canonical rule, as
//     maintenance-calendar.js (Plan 48) does: the leading generic
//     "Mohalla" word is stripped, comparison is case-insensitive,
//     and known spellings collapse (bani -> BANII, kishti ->
//     KISHTII, chamyaa -> CHAMYAAA). A segment is a splitter name
//     from the connection register (Plan 17): matched
//     case-insensitively after trimming, last record per customer
//     wins.
//   - A sweep with no id, no outage id, or no affected mohalla and
//     no affected segment is refused outright, never stored
//     half-formed. An impossible date (2026-02-30) is refused
//     wherever a date is required; a blank sweep date or note stays
//     null ("not recorded"), never guessed.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const DEFAULT_MOHALLAS = Object.freeze([
  'CHARYAA', 'GANGALL', 'KISHTII', 'BARRIAN', 'THALII', 'CHAMYAAA',
  'PALALIYAA', 'MALLA', 'NAKAR', 'BANII', 'SODAA', 'PULL SIDE',
  'JABBIYAA', 'MOHALLA CHUDRIYAA', 'MOHALLA end side farm house',
  // Sharafat 76 (owner decision 2026-11-12): END POINT is the 16th
  // mohalla — Haweli and End Point are one mohalla (#12 in the
  // numbered display order). "end side farm house" stays separate.
  'END POINT',
]);

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
});

export const SWEEP_STATUSES = Object.freeze({
  OPEN: 'open',
  COMPLETED: 'completed',
});

const NO_SEGMENT_LABEL = 'No segment recorded';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function comparisonKey(value) {
  return normalizedText(value).toLowerCase();
}

function stripMohallaPrefix(value) {
  const stripped = normalizedText(value).replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  return stripped || normalizedText(value);
}

function readableLabel(value) {
  const readableWord = (word) => {
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    const chars = Array.from(word);
    if (!chars.length) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  };
  return normalizedText(value).split(' ').map((word) => word.split(/([-–—/])/u).map((part) => /^[-–—/]$/u.test(part) ? part : readableWord(part)).join('')).join(' ');
}

// Mirrors canonicalMaintenanceMohalla (Plan 48) without importing it.
// Returns { key, label, stored } or null when blank.
export function canonicalSweepMohalla(value) {
  const raw = normalizedText(value);
  if (!raw) return null;
  const stripped = stripMohallaPrefix(raw);
  const key = comparisonKey(stripped);
  const canonical = DEFAULT_MOHALLAS.find((name) => comparisonKey(stripMohallaPrefix(name)) === key) ?? MOHALLA_ALIASES[key];
  if (canonical) return { key: comparisonKey(stripMohallaPrefix(canonical)), label: readableLabel(canonical), stored: canonical };
  return { key, label: readableLabel(stripped), stored: raw };
}

function resolveMohallas(values) {
  const seen = new Map();
  for (const raw of Array.isArray(values) ? values : []) {
    const canon = canonicalSweepMohalla(raw);
    if (canon && !seen.has(canon.key)) seen.set(canon.key, canon);
  }
  return [...seen.values()];
}

function resolveSegments(values) {
  const seen = new Map();
  for (const raw of Array.isArray(values) ? values : []) {
    const label = text(raw);
    if (!label) continue;
    const key = label.toLowerCase();
    if (!seen.has(key)) seen.set(key, { key, label });
  }
  return [...seen.values()];
}

export function isValidSweepDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function normalizeStatus(value) {
  const raw = text(value);
  if (!raw) return SWEEP_STATUSES.OPEN;
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return Object.values(SWEEP_STATUSES).includes(key) ? key : null;
}

// One well-formed segment check, or null: the segment must be named,
// the date must be a real calendar date, and the checker must be
// named. A check without a date or a checker is not a check.
function normalizeSegmentCheck(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const segment = text(raw.segment);
  const date = text(raw.date ?? raw.checkedDate);
  const by = text(raw.by ?? raw.checkedBy);
  if (!segment || !isValidSweepDate(date) || !by) return null;
  return { segment, date, by };
}

function normalizeStillDownCase(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const customerId = text(raw.customerId);
  if (!customerId) return null;
  return {
    customerId,
    originalTicketId: text(raw.originalTicketId) || null,
    note: text(raw.note) || null,
  };
}

// One normalised sweep, or null when it fails any honesty rule.
// Blank date/note stay null, never guessed. Malformed check rows
// and still-down rows are dropped by normalisation; the mark
// helpers below refuse bad input outright instead, so a bad check
// can never be stored through them.
export function normalizeSweep(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const outageId = text(raw.outageId);
  const status = normalizeStatus(raw.status);
  if (!id || !outageId || status === null) return null;
  const date = text(raw.date ?? raw.sweepDate);
  if (date && !isValidSweepDate(date)) return null;
  const mohallas = resolveMohallas(raw.mohallas ?? raw.areas);
  const segments = resolveSegments(raw.segments ?? raw.splitters);
  if (mohallas.length === 0 && segments.length === 0) return null;
  const checks = [];
  const seenSegments = new Set();
  for (const check of Array.isArray(raw.checks) ? raw.checks : []) {
    const clean = normalizeSegmentCheck(check);
    if (!clean) continue;
    const key = clean.segment.toLowerCase();
    if (seenSegments.has(key)) continue;
    seenSegments.add(key);
    checks.push(clean);
  }
  const confirmedIds = [];
  const seenConfirmed = new Set();
  for (const entry of Array.isArray(raw.confirmedCustomerIds) ? raw.confirmedCustomerIds : []) {
    const clean = text(entry);
    if (clean && !seenConfirmed.has(clean)) {
      seenConfirmed.add(clean);
      confirmedIds.push(clean);
    }
  }
  const stillDown = [];
  const seenStillDown = new Set();
  for (const entry of Array.isArray(raw.stillDownCases) ? raw.stillDownCases : []) {
    const clean = normalizeStillDownCase(entry);
    if (!clean || seenStillDown.has(clean.customerId)) continue;
    seenStillDown.add(clean.customerId);
    stillDown.push(clean);
  }
  // A customer is never both confirmed back and still down: the
  // still-down flag wins in stored data, so a confirmed id that
  // also appears still down is dropped from the confirmed list.
  const confirmed = confirmedIds.filter((entry) => !seenStillDown.has(entry));
  return {
    id,
    outageId,
    date: date || null,
    status,
    mohallas: mohallas.map((m) => m.stored),
    segments: segments.map((s) => s.label),
    note: text(raw.note) || null,
    checks,
    confirmedCustomerIds: confirmed,
    stillDownCases: stillDown,
  };
}

export function normalizeSweepList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const sweep = normalizeSweep(entry);
    if (sweep) out.push(sweep);
  }
  return out;
}

function compareSweeps(a, b) {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortSweeps(list) {
  return normalizeSweepList(list).sort(compareSweeps);
}

// Saves (or re-saves) one sweep. An invalid sweep leaves the list
// unchanged (same reference, so the caller can tell nothing was
// stored); a valid one returns a new list, never a mutated input.
// A duplicate id replaces the earlier sweep, so re-saving a
// corrected sweep never creates a second row for it.
export function upsertSweep(list, raw) {
  const normalized = normalizeSweep(raw);
  if (!normalized) return list;
  const current = normalizeSweepList(list);
  const existing = current.findIndex((item) => item.id === normalized.id);
  if (existing >= 0) {
    const next = current.slice();
    next[existing] = normalized;
    return next;
  }
  return [...current, normalized];
}

export function removeSweep(list, id) {
  const key = text(id);
  if (!key) return Array.isArray(list) ? list : [];
  return normalizeSweepList(list).filter((item) => item.id !== key);
}

export function findSweep(list, id) {
  const key = text(id);
  if (!key) return null;
  return normalizeSweepList(list).find((item) => item.id === key) ?? null;
}

// Marks one segment checked. Refuses outright (list unchanged) when
// the sweep is unknown, the segment is blank, the date is not a
// real calendar date, the checker is blank, or — when the caller
// supplies the checklist segments — the segment is not on that
// checklist. Re-checking a segment replaces its earlier check, so a
// segment is never checked twice.
export function markSegmentChecked(list, sweepId, check, checklistSegments) {
  const clean = normalizeSegmentCheck(check);
  if (!clean) return list;
  const current = normalizeSweepList(list);
  const index = current.findIndex((item) => item.id === text(sweepId));
  if (index < 0) return list;
  if (Array.isArray(checklistSegments)) {
    const allowed = new Set(resolveSegments(checklistSegments).map((s) => s.key));
    if (!allowed.has(clean.segment.toLowerCase())) return list;
  }
  const sweep = current[index];
  const next = {
    ...sweep,
    checks: [
      ...sweep.checks.filter((entry) => entry.segment.toLowerCase() !== clean.segment.toLowerCase()),
      clean,
    ],
  };
  const out = current.slice();
  out[index] = next;
  return out;
}

// Marks one customer confirmed back. Refuses outright when the
// sweep or the customer id is unknown; confirming removes the
// customer from the still-down list, so a customer is never both.
export function markCustomerConfirmed(list, sweepId, customerId) {
  const key = text(customerId);
  if (!key) return list;
  const current = normalizeSweepList(list);
  const index = current.findIndex((item) => item.id === text(sweepId));
  if (index < 0) return list;
  const sweep = current[index];
  if (sweep.confirmedCustomerIds.includes(key)) return list;
  const next = {
    ...sweep,
    confirmedCustomerIds: [...sweep.confirmedCustomerIds, key],
    stillDownCases: sweep.stillDownCases.filter((entry) => entry.customerId !== key),
  };
  const out = current.slice();
  out[index] = next;
  return out;
}

// Flags one customer still down, with the original ticket link
// when the caller knows it. Refuses outright when the sweep or
// the customer id is unknown; flagging removes the customer from
// the confirmed list, so a customer is never both.
export function markCustomerStillDown(list, sweepId, stillDownCase) {
  const clean = normalizeStillDownCase(stillDownCase);
  if (!clean) return list;
  const current = normalizeSweepList(list);
  const index = current.findIndex((item) => item.id === text(sweepId));
  if (index < 0) return list;
  const sweep = current[index];
  const existing = sweep.stillDownCases.find((entry) => entry.customerId === clean.customerId);
  if (existing && existing.originalTicketId === clean.originalTicketId && existing.note === clean.note) return list;
  const next = {
    ...sweep,
    confirmedCustomerIds: sweep.confirmedCustomerIds.filter((entry) => entry !== clean.customerId),
    stillDownCases: [
      ...sweep.stillDownCases.filter((entry) => entry.customerId !== clean.customerId),
      clean,
    ],
  };
  const out = current.slice();
  out[index] = next;
  return out;
}

// Completes one sweep. Completing keeps the sweep in the list as
// history and changes nothing else: it never reopens the parent
// outage, never touches a ticket, a bill, or a payment. An unknown
// sweep or an already-completed sweep leaves the list unchanged.
export function completeSweep(list, sweepId) {
  const current = normalizeSweepList(list);
  const index = current.findIndex((item) => item.id === text(sweepId));
  if (index < 0 || current[index].status === SWEEP_STATUSES.COMPLETED) return list;
  const out = current.slice();
  out[index] = { ...current[index], status: SWEEP_STATUSES.COMPLETED };
  return out;
}

// The segment (splitter) serving one customer, from the caller's
// connection records (last record per customer wins, the Plan 17
// rule) or from the customer's own splitter fields when no register
// row exists. Returns the trimmed splitter name, or null.
function segmentForCustomer(customer, connections) {
  const id = text(customer?.id ?? customer?.customerId);
  if (!id) return null;
  if (Array.isArray(connections)) {
    let found = null;
    for (const record of connections) {
      if (!record || typeof record !== 'object') continue;
      const recordId = text(record.customerId ?? record.id);
      const splitter = text(record.splitter ?? record.splitterId ?? record.splitterBoxId ?? record.box);
      if (recordId === id && splitter) found = splitter;
    }
    if (found) return found;
  }
  return text(customer.splitter ?? customer.splitterId ?? customer.splitterBoxId ?? customer.box) || null;
}

// Exactly the customers a sweep covers, on the same fixture: a
// customer matches when its canonical mohalla is one of the
// sweep's mohallas, or its segment is one of the sweep's segments.
// Archived customers are listed separately, never silently dropped,
// and never counted as covered. A customer with no mohalla and no
// segment is never assigned to a sweep.
export function sweepAffectedCustomers(sweep, { customers, connections } = {}) {
  const normalized = normalizeSweep(sweep);
  if (!normalized) return { customers: [], archivedCustomers: [], totalCustomers: 0, affectedCount: 0 };
  const mohallaKeys = new Set(resolveMohallas(normalized.mohallas).map((m) => m.key));
  const segmentKeys = new Set(resolveSegments(normalized.segments).map((s) => s.key));
  const affected = [];
  const archived = [];
  let total = 0;
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object') continue;
    total += 1;
    const canon = canonicalSweepMohalla(customer.mohalla ?? customer.area ?? '');
    const segment = segmentForCustomer(customer, connections);
    const byMohalla = canon !== null && mohallaKeys.has(canon.key);
    const bySegment = segment !== null && segmentKeys.has(segment.toLowerCase());
    if (!byMohalla && !bySegment) continue;
    const row = {
      customerId: text(customer.id ?? customer.customerId),
      customerName: text(customer.customerName ?? customer.name) || text(customer.id ?? customer.customerId),
      mohallaLabel: canon ? canon.label : null,
      segment: segment || null,
      matchedBy: byMohalla && bySegment ? 'mohalla and segment' : byMohalla ? 'mohalla' : 'segment',
      archived: customer.archived === true,
    };
    if (row.archived) archived.push(row);
    else affected.push(row);
  }
  const byName = (a, b) => (a.customerName.toLowerCase() < b.customerName.toLowerCase() ? -1
    : a.customerName.toLowerCase() > b.customerName.toLowerCase() ? 1
    : a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0);
  affected.sort(byName);
  archived.sort(byName);
  return { customers: affected, archivedCustomers: archived, totalCustomers: total, affectedCount: affected.length };
}

// The segment checklist for one sweep: every segment named on the
// sweep plus every segment found among its affected customers,
// each with its customers, its check (when marked), and the
// confirmed / still-down counts inside it. Customers with no
// segment are grouped under "No segment recorded", never dropped.
export function sweepChecklist(sweep, affected) {
  const normalized = normalizeSweep(sweep);
  if (!normalized) return [];
  const rows = Array.isArray(affected?.customers) ? affected.customers : [];
  const checkByKey = new Map();
  for (const check of normalized.checks) checkByKey.set(check.segment.toLowerCase(), check);
  const confirmed = new Set(normalized.confirmedCustomerIds);
  const stillDown = new Set(normalized.stillDownCases.map((entry) => entry.customerId));
  const groups = new Map();
  const addGroup = (label) => {
    const key = label.toLowerCase();
    if (!groups.has(key)) groups.set(key, { segment: label, customers: [], checked: null });
    return groups.get(key);
  };
  for (const label of normalized.segments) addGroup(label);
  for (const row of rows) addGroup(row.segment || NO_SEGMENT_LABEL).customers.push(row);
  const out = [...groups.values()].map((group) => ({
    segment: group.segment,
    customers: group.customers,
    checked: checkByKey.get(group.segment.toLowerCase()) ?? null,
    confirmedCount: group.customers.filter((row) => confirmed.has(row.customerId)).length,
    stillDownCount: group.customers.filter((row) => stillDown.has(row.customerId)).length,
  }));
  out.sort((a, b) => (a.segment.toLowerCase() < b.segment.toLowerCase() ? -1
    : a.segment.toLowerCase() > b.segment.toLowerCase() ? 1 : 0));
  return out;
}

// The still-down follow-up list: each still-down case with the
// customer name and the original ticket link. The stored link
// wins; when the caller supplies the outage's tickets and the case
// carries no link, the first ticket of that customer is used, so
// the follow-up always names the ticket it follows from.
export function sweepFollowUpList(sweep, { customers, tickets } = {}) {
  const normalized = normalizeSweep(sweep);
  if (!normalized) return [];
  const nameById = new Map();
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object') continue;
    const id = text(customer.id ?? customer.customerId);
    if (id) nameById.set(id, text(customer.customerName ?? customer.name) || id);
  }
  const ticketByCustomer = new Map();
  for (const ticket of Array.isArray(tickets) ? tickets : []) {
    if (!ticket || typeof ticket !== 'object') continue;
    const id = text(ticket.customerId);
    if (id && !ticketByCustomer.has(id)) ticketByCustomer.set(id, text(ticket.id));
  }
  const out = normalized.stillDownCases.map((entry) => ({
    customerId: entry.customerId,
    customerName: nameById.get(entry.customerId) ?? entry.customerId,
    originalTicketId: entry.originalTicketId || ticketByCustomer.get(entry.customerId) || null,
    note: entry.note,
  }));
  out.sort((a, b) => (a.customerName.toLowerCase() < b.customerName.toLowerCase() ? -1
    : a.customerName.toLowerCase() > b.customerName.toLowerCase() ? 1
    : a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0));
  return out;
}

// The follow-up ticket draft for one still-down case. This is a
// draft only: the caller creates the ticket through the existing
// ticket flow (Plan 21) when the operator confirms it, and the
// draft never reopens the parent outage or touches any bill or
// payment. The category is the Plan 21 "no connection" category;
// the note names the original outage and ticket, so the follow-up
// is always traceable to the fault it follows from.
export function followUpTicketDraft(followUpCase, { outageId } = {}) {
  const customerId = text(followUpCase?.customerId);
  if (!customerId) return null;
  const outage = text(outageId);
  const ticket = text(followUpCase?.originalTicketId);
  const noteParts = [`Follow-up from restoration sweep after outage ${outage || 'not recorded'}: customer still down after the parent fault was resolved.`];
  if (ticket) noteParts.push(`Original ticket: ${ticket}.`);
  if (text(followUpCase?.note)) noteParts.push(text(followUpCase.note));
  return {
    customerId,
    category: 'no_connection',
    priority: 'high',
    status: 'open',
    note: noteParts.join(' '),
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const STATUS_LABELS = { open: 'Open', completed: 'Completed' };

export function sweepSummaryText(list) {
  const sweeps = sortSweeps(list);
  if (sweeps.length === 0) return 'No restoration sweeps recorded yet.';
  const counts = { open: 0, completed: 0 };
  let checked = 0;
  let confirmed = 0;
  let stillDown = 0;
  for (const sweep of sweeps) {
    counts[sweep.status] += 1;
    checked += sweep.checks.length;
    confirmed += sweep.confirmedCustomerIds.length;
    stillDown += sweep.stillDownCases.length;
  }
  return `${sweeps.length} sweep${sweeps.length === 1 ? '' : 's'}: ${counts.open} open, ${counts.completed} completed; ${checked} segment${checked === 1 ? '' : 's'} checked, ${confirmed} customer${confirmed === 1 ? '' : 's'} confirmed back, ${stillDown} still down.`;
}

export function sweepsHtml(list, detailsById = {}) {
  const sweeps = sortSweeps(list);
  if (sweeps.length === 0) return '<p class="empty-state">No restoration sweeps recorded yet.</p>';
  const rows = sweeps.map((sweep) => {
    const details = detailsById[sweep.id];
    const affectedNote = details ? ` (${details.affectedCount} customer${details.affectedCount === 1 ? '' : 's'} covered)` : '';
    const followUps = details ? details.followUps : [];
    const followUpNote = followUps.length > 0
      ? `<br><small>Still down: ${followUps.map((entry) => escapeHtml(entry.customerName)).join(', ')}</small>`
      : '';
    const buttons = sweep.status === 'completed' ? ''
      : `<button class="secondary-button btn-sm sweep-complete-btn" type="button" data-sweep-complete="${escapeHtml(sweep.id)}">Complete sweep</button> `;
    return `<tr><td><strong>Outage ${escapeHtml(sweep.outageId)}</strong>${sweep.date ? ` · ${escapeHtml(sweep.date)}` : ''}<br><small>Mohallas: ${escapeHtml(resolveMohallas(sweep.mohallas).map((m) => m.label).join(', ') || '—')}; Segments: ${escapeHtml(resolveSegments(sweep.segments).map((s) => s.label).join(', ') || '—')}${affectedNote}</small>${sweep.note ? `<br><small>${escapeHtml(sweep.note)}</small>` : ''}${followUpNote}</td><td>${escapeHtml(STATUS_LABELS[sweep.status])}</td><td>${escapeHtml(String(sweep.checks.length))} checked · ${escapeHtml(String(sweep.confirmedCustomerIds.length))} back · ${escapeHtml(String(sweep.stillDownCases.length))} still down</td><td>${buttons}<button class="secondary-button btn-sm sweep-remove-btn" type="button" data-sweep-remove="${escapeHtml(sweep.id)}">Remove</button></td></tr>`;
  }).join('');
  return `<table class="restoration-sweep-table"><thead><tr><th>Sweep</th><th>Status</th><th>Progress</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function sweepsCsv(list, detailsById = {}) {
  const sweeps = sortSweeps(list);
  const header = 'id,outage_id,date,status,mohallas,segments,covered_customers,segments_checked,customers_confirmed,customers_still_down,note';
  const lines = sweeps.map((sweep) => [
    sweep.id, sweep.outageId, sweep.date ?? '', sweep.status,
    resolveMohallas(sweep.mohallas).map((m) => m.label).join('; '),
    resolveSegments(sweep.segments).map((s) => s.label).join('; '),
    detailsById[sweep.id]?.affectedCount ?? '',
    sweep.checks.length, sweep.confirmedCustomerIds.length, sweep.stillDownCases.length,
    sweep.note ?? '',
  ].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function sweepFilename(today) {
  const day = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : 'unknown-date';
  return `restoration-sweeps-${day}.csv`;
}
