// History filter by transaction type (Plan 402): in a full history,
// payments, charges, credits and refunds sit mixed together, so
// finding just the refunds means reading every line. One type filter
// on the customer history — payment, charge, credit, refund,
// adjustment (and advance, which the full history list also carries,
// so the counts across all types always sum to the full list). It
// filters only and changes nothing: it reads the entries the full
// history list already composed and returns the ones of the chosen
// type, in the same order, with the running balance each entry
// already carries. An entry's type follows the category tag on its
// payment — a refund or adjustment tag makes it a refund or an
// adjustment, an advance tag or advance kind makes it an advance —
// so the filter is the tag, read through the entry type. No store:
// the filter is a view over existing entries, and the choice lives
// only while the profile is open.
// Pure and import-free: no storage, no DOM, no network, no other
// module. Inputs are never mutated.

export const HISTORY_TYPE_FILTER_ALL = 'all';

export const HISTORY_TYPE_FILTER_TYPES = Object.freeze([
  'charge',
  'payment',
  'advance',
  'credit',
  'refund',
  'adjustment',
]);

export const HISTORY_TYPE_FILTER_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
});

export const HISTORY_TYPE_FILTER_EMPTY_TEXT = 'No transactions yet';

function foldHistoryTypeFilter(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** True for 'all' or one of the six history entry types. */
export function isHistoryTypeFilter(value) {
  const folded = foldHistoryTypeFilter(value);
  return folded === HISTORY_TYPE_FILTER_ALL || HISTORY_TYPE_FILTER_TYPES.includes(folded);
}

/**
 * Normalize a filter choice. A valid type stays itself; 'all', a
 * missing choice and anything unknown read as 'all', so a damaged
 * choice never drops entries from the list.
 */
export function normalizeHistoryTypeFilter(value) {
  const folded = foldHistoryTypeFilter(value);
  if (folded === HISTORY_TYPE_FILTER_ALL || HISTORY_TYPE_FILTER_TYPES.includes(folded)) return folded;
  return HISTORY_TYPE_FILTER_ALL;
}

/**
 * Filter full-history entries by type. 'all' (or a missing or
 * unknown filter) keeps every entry, in the same order; any other
 * type keeps exactly the entries of that type. The input list and
 * its entries are never mutated — the result is a new array.
 */
export function filterHistoryEntriesByType(entries, type) {
  const list = Array.isArray(entries) ? entries : [];
  const filter = normalizeHistoryTypeFilter(type);
  if (filter === HISTORY_TYPE_FILTER_ALL) return [...list];
  return list.filter((entry) => entry?.type === filter);
}

/**
 * Counts per type over the full list, plus the total. The per-type
 * counts always sum to the total, so every entry is reachable
 * through exactly one filter option.
 */
export function historyTypeCounts(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const counts = { total: list.length };
  for (const type of HISTORY_TYPE_FILTER_TYPES) counts[type] = 0;
  for (const entry of list) {
    if (HISTORY_TYPE_FILTER_TYPES.includes(entry?.type)) counts[entry.type] += 1;
  }
  return counts;
}

/** Filter options with live counts: 'all' first, then one per type. */
export function historyTypeFilterOptions(entries) {
  const counts = historyTypeCounts(entries);
  const options = [{ value: HISTORY_TYPE_FILTER_ALL, label: 'All types', count: counts.total }];
  for (const type of HISTORY_TYPE_FILTER_TYPES) {
    options.push({ value: type, label: HISTORY_TYPE_FILTER_LABELS[type], count: counts[type] });
  }
  return options;
}

function escapeHistoryTypeFilterHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The filter select markup: one option per type with its live count,
 * e.g. 'Refund (2)'. The chosen option is marked selected.
 */
export function historyTypeFilterSelectMarkup(entries, selected) {
  const choice = normalizeHistoryTypeFilter(selected);
  const options = historyTypeFilterOptions(entries)
    .map((option) => `<option value="${escapeHistoryTypeFilterHtml(option.value)}"${option.value === choice ? ' selected' : ''}>${escapeHistoryTypeFilterHtml(option.label)} (${option.count})</option>`)
    .join('');
  return `<label class="field-label" for="htfHistoryTypeFilter">Show</label><select id="htfHistoryTypeFilter" class="htf-filter">${options}</select>`;
}

/**
 * Empty-list line: 'No transactions yet' for all, 'No refund
 * entries' for one type.
 */
export function historyTypeFilterEmptyText(type) {
  const filter = normalizeHistoryTypeFilter(type);
  if (filter === HISTORY_TYPE_FILTER_ALL) return HISTORY_TYPE_FILTER_EMPTY_TEXT;
  return `No ${HISTORY_TYPE_FILTER_LABELS[filter].toLowerCase()} entries`;
}

/**
 * Summary line for the shown list: '3 of 12 entries · Refund only'
 * when filtered, '12 entries' when showing all. The running balance
 * after each shown entry is already on the entry's own line, so the
 * summary counts only.
 */
export function historyTypeFilterSummaryText(shown, entries, type) {
  const shownList = Array.isArray(shown) ? shown : [];
  const fullList = Array.isArray(entries) ? entries : [];
  const filter = normalizeHistoryTypeFilter(type);
  const count = shownList.length === 1 ? '1 entry' : `${shownList.length} entries`;
  if (filter === HISTORY_TYPE_FILTER_ALL) return count;
  return `${count} of ${fullList.length} · ${HISTORY_TYPE_FILTER_LABELS[filter]} only`;
}
