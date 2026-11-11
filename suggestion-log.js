// Plan 96 (Plan 1-100) — Customer suggestion and idea log: ideas from
// customers, kept in the customer's own words, in one list the owner
// can actually act on.
//
// This module is the LOG only, and nothing else:
//
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never mutates an input. It holds no bill, payment, ticket,
//     or lifecycle field of its own; a suggestion names a customer,
//     the suggestion text, one category, one date, and one status.
//   - This is NOT the fault ticket log (Plan 21) and NOT the enquiry
//     log (Plan 76). A fault is something broken; an enquiry is a
//     question asked; a suggestion is an idea offered. Plans 21 and
//     76 are never read or rewritten here — at most a suggestion
//     carries a link id to the change that fulfilled it, where one
//     exists, and that link is only a stored id.
//   - Adopting a suggestion changes nothing by itself. Any real
//     change — a new package, a different due date, a new payment
//     option — still goes through its own existing path. Logging
//     or closing a suggestion never alters any bill, payment, or
//     customer record.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). A suggestion with no date is kept
//     undated and sorts last, never given an invented date.
//   - Half-formed records are refused outright, never stored
//     half-formed. An adopted suggestion without its note, and a
//     declined suggestion without its reason, are refused the same
//     way — an outcome without its words is not an outcome.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
});

export const SUGGESTION_CATEGORIES = Object.freeze([
  'package',
  'payment',
  'service-hours',
  'coverage',
  'other',
]);

export const SUGGESTION_CATEGORY_LABELS = Object.freeze({
  package: 'Package',
  payment: 'Payment',
  'service-hours': 'Service hours',
  coverage: 'Coverage',
  other: 'Other',
});

export const SUGGESTION_STATUSES = Object.freeze([
  'noted',
  'under-consideration',
  'adopted',
  'declined',
]);

export const SUGGESTION_STATUS_LABELS = Object.freeze({
  noted: 'Noted',
  'under-consideration': 'Under consideration',
  adopted: 'Adopted',
  declined: 'Declined',
});

// Statuses that still count as open work. Adopted and declined are
// history: the idea has been decided, and it leaves the open list.
export const OPEN_SUGGESTION_STATUSES = Object.freeze([
  'noted',
  'under-consideration',
]);

export function suggestionCategoryLabel(category) {
  return SUGGESTION_CATEGORY_LABELS[category] || 'Not recorded';
}

export function suggestionStatusLabel(status) {
  return SUGGESTION_STATUS_LABELS[status] || 'Not recorded';
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function normalizedText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function stripMohallaPrefix(value) {
  const stripped = normalizedText(value).replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  return stripped || normalizedText(value);
}

function readableLabel(value) {
  return normalizedText(value).split(' ').map((word) => {
    const chars = Array.from(word);
    if (!chars.length) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  }).join(' ');
}

// Mirrors the Plan T canonical rule without importing it.
export function canonicalSuggestionMohalla(value) {
  const raw = normalizedText(value);
  if (!raw) return null;
  const stripped = stripMohallaPrefix(raw);
  const key = stripped.toLowerCase();
  const canonical = MOHALLA_ALIASES[key];
  if (canonical) return { key: canonical.toLowerCase(), label: readableLabel(canonical), stored: canonical };
  return { key, label: readableLabel(stripped), stored: stripped };
}

export function validSuggestionDate(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 30, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Only these keys ever survive normalisation. Anything else on the
// input is dropped, so the record can never grow a bill, payment,
// ticket, or lifecycle field of its own.
const SUGGESTION_KEYS = [
  'id', 'customer', 'customerName', 'mohalla', 'text', 'category',
  'date', 'status', 'adoptedNote', 'declineReason', 'fulfilledLink',
];

export function normalizeSuggestion(record) {
  if (!record || typeof record !== 'object') return null;
  const id = text(record.id);
  const customer = text(record.customer);
  const suggestionText = text(record.text);
  const category = text(record.category);
  const status = text(record.status);
  if (!id || !customer || !suggestionText) return null;
  if (!SUGGESTION_CATEGORIES.includes(category)) return null;
  if (!SUGGESTION_STATUSES.includes(status)) return null;
  const date = record.date === undefined || record.date === null || record.date === ''
    ? null
    : validSuggestionDate(record.date);
  if (record.date !== undefined && record.date !== null && record.date !== '' && date === null) return null;
  const adoptedNote = text(record.adoptedNote);
  const declineReason = text(record.declineReason);
  // An adopted suggestion without its note, and a declined one
  // without its reason, are half-formed and refused outright.
  if (status === 'adopted' && !adoptedNote) return null;
  if (status === 'declined' && !declineReason) return null;
  const out = {
    id,
    customer,
    customerName: text(record.customerName),
    mohalla: text(record.mohalla),
    text: suggestionText,
    category,
    date,
    status,
    // An adopted note belongs only to an adopted suggestion, and a
    // decline reason only to a declined one; anything else is
    // dropped so a reopened record carries no stale outcome.
    adoptedNote: status === 'adopted' ? adoptedNote : '',
    declineReason: status === 'declined' ? declineReason : '',
    // The fulfilling-change link belongs only to an adopted
    // suggestion; anything else drops it, so a reopened record
    // never points at a change that no longer fulfils it.
    fulfilledLink: status === 'adopted' ? text(record.fulfilledLink) : '',
  };
  return out;
}

export function normalizeSuggestionList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const normalized = normalizeSuggestion(record);
    if (normalized) out.push(normalized);
  }
  return out;
}

export function upsertSuggestion(list, record) {
  const normalized = normalizeSuggestion(record);
  if (!normalized) return normalizeSuggestionList(list);
  const next = normalizeSuggestionList(list).filter((item) => item.id !== normalized.id);
  next.push(normalized);
  return next;
}

export function removeSuggestion(list, id) {
  return normalizeSuggestionList(list).filter((item) => item.id !== text(id));
}

export function findSuggestion(list, id) {
  return normalizeSuggestionList(list).find((item) => item.id === text(id)) || null;
}

function compareSuggestionOrder(a, b) {
  // Oldest first; undated last, then id so the order is stable.
  if (a.date && b.date) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  } else if (a.date) {
    return -1;
  } else if (b.date) {
    return 1;
  }
  return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
}

// The open list: noted and under-consideration only, oldest first,
// filterable by category and mohalla. Adopted and declined are
// history and never appear here.
export function openSuggestions(list, filters = {}) {
  const records = normalizeSuggestionList(list);
  const category = text(filters.category);
  const mohallaFilter = text(filters.mohalla);
  const filterKey = mohallaFilter === '__unassigned__'
    ? '__unassigned__'
    : (canonicalSuggestionMohalla(mohallaFilter)?.key ?? null);
  return records
    .filter((item) => OPEN_SUGGESTION_STATUSES.includes(item.status))
    .filter((item) => !category || item.category === category)
    .filter((item) => {
      if (!mohallaFilter) return true;
      if (filterKey === '__unassigned__') return !item.mohalla;
      const key = canonicalSuggestionMohalla(item.mohalla)?.key ?? null;
      return key !== null && key === filterKey;
    })
    .sort(compareSuggestionOrder);
}

export function filterSuggestions(list, filters = {}) {
  const records = normalizeSuggestionList(list);
  const category = text(filters.category);
  const status = text(filters.status);
  const mohallaFilter = text(filters.mohalla);
  const filterKey = mohallaFilter === '__unassigned__'
    ? '__unassigned__'
    : (canonicalSuggestionMohalla(mohallaFilter)?.key ?? null);
  return records
    .filter((item) => !category || item.category === category)
    .filter((item) => !status || item.status === status)
    .filter((item) => {
      if (!mohallaFilter) return true;
      if (filterKey === '__unassigned__') return !item.mohalla;
      const key = canonicalSuggestionMohalla(item.mohalla)?.key ?? null;
      return key !== null && key === filterKey;
    })
    .sort(compareSuggestionOrder);
}

// Move a suggestion to a new status. A move to adopted needs its
// note, a move to declined needs its reason; anything less leaves
// the suggestion exactly where it was, never half-moved. Reopening
// (back to noted) clears the outcome fields, so a reopened record
// carries no stale note or reason.
export function moveSuggestion(list, id, nextStatus, outcome = {}) {
  const records = normalizeSuggestionList(list);
  const current = records.find((item) => item.id === text(id));
  if (!current) return records;
  if (!SUGGESTION_STATUSES.includes(nextStatus)) return records;
  const adoptedNote = text(outcome.adoptedNote);
  const declineReason = text(outcome.declineReason);
  if (nextStatus === 'adopted' && !adoptedNote) return records;
  if (nextStatus === 'declined' && !declineReason) return records;
  const updated = {
    ...current,
    status: nextStatus,
    adoptedNote: nextStatus === 'adopted' ? adoptedNote : '',
    declineReason: nextStatus === 'declined' ? declineReason : '',
    fulfilledLink: nextStatus === 'adopted' ? text(outcome.fulfilledLink ?? current.fulfilledLink) : '',
  };
  return records.map((item) => (item.id === current.id ? updated : item));
}

export function suggestionSummaryText(list) {
  const records = normalizeSuggestionList(list);
  const open = records.filter((item) => OPEN_SUGGESTION_STATUSES.includes(item.status)).length;
  const adopted = records.filter((item) => item.status === 'adopted').length;
  const declined = records.filter((item) => item.status === 'declined').length;
  return `${records.length} suggestion${records.length === 1 ? '' : 's'} logged · ${open} open · ${adopted} adopted · ${declined} declined`;
}

export function suggestionHtml(list) {
  const records = normalizeSuggestionList(list);
  if (records.length === 0) return '<p class="chart-caption">No suggestions logged yet.</p>';
  const rows = records.map((item) => `<tr><td>${escapeHtml(item.date || 'No date')}</td><td>${escapeHtml(item.customerName || item.customer)}</td><td>${escapeHtml(suggestionCategoryLabel(item.category))}</td><td>${escapeHtml(item.text)}</td><td>${escapeHtml(suggestionStatusLabel(item.status))}</td><td>${escapeHtml(item.status === 'adopted' ? item.adoptedNote : (item.status === 'declined' ? item.declineReason : '—'))}</td></tr>`).join('');
  return `<table class="data-table"><thead><tr><th>Date</th><th>Customer</th><th>Category</th><th>Suggestion</th><th>Status</th><th>Note / reason</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function suggestionCsv(list) {
  const records = normalizeSuggestionList(list);
  const header = 'id,customer,customerName,mohalla,text,category,date,status,adoptedNote,declineReason,fulfilledLink';
  const lines = records.map((item) => [
    item.id, item.customer, item.customerName, item.mohalla, item.text,
    item.category, item.date || '', item.status, item.adoptedNote,
    item.declineReason, item.fulfilledLink,
  ].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function suggestionFilename(today) {
  const stamp = validSuggestionDate(today) ? today : 'undated';
  return `suggestion-log-${stamp}.csv`;
}
