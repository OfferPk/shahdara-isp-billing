/* Saved search filters (Plan 459): one on-device list of the
 * searches the operator chose to keep, each with a name in plain
 * words plus the search text and the filters it holds — so Saad's
 * daily "overdue in my round" search becomes a named one-tap button
 * instead of five taps every morning, and it always shows today's
 * truth.
 *
 * No such store existed anywhere: the recent searches list (Plan
 * 458) remembers the searches just run, and it has no names and no
 * keep/remove — a saved filter is the missing piece, not a second
 * list. It saves the filter definition only, never copies of the
 * results: running a saved filter re-applies its text and filters
 * to the live customer list, so it returns the current matching
 * entries, not a stale copy. Removing one removes only the saved
 * definition. Saving never changes any customer, bill, or payment
 * record, and it never sends anything. Inputs are never mutated,
 * and the module never reads storage, the clock, the network, or
 * the page. */

export const SAVED_SEARCH_FILTERS_STORE_KEY = 'shahdara_saved_filters_v1';
export const SAVED_SEARCH_FILTERS_MAX = 12;
export const SAVED_SEARCH_FILTER_NAME_MAX = 60;

const BILLING_FILTERS = ['all', 'pending', 'partial', 'paid'];
const ACCOUNT_FILTERS = ['all', 'paid-up', 'due', 'overdue', 'suspended', 'new'];

function cleanSavedFilterText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanSavedFilterName(value) {
  return cleanSavedFilterText(value).slice(0, SAVED_SEARCH_FILTER_NAME_MAX);
}

function foldSavedFilterValue(value, allowed) {
  const text = cleanSavedFilterText(value).toLowerCase();
  return allowed.includes(text) ? text : 'all';
}

function escapeSavedFilterHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function normalizeSavedSearchFilter(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanSavedFilterName(raw.name);
  if (!name) return null;
  const entry = {
    name,
    text: cleanSavedFilterText(raw.text),
    statusFilter: foldSavedFilterValue(raw.statusFilter, BILLING_FILTERS),
    customerStatus: foldSavedFilterValue(raw.customerStatus, ACCOUNT_FILTERS),
    mohalla: cleanSavedFilterText(raw.mohalla),
  };
  // A name with nothing behind it is not a filter worth keeping —
  // saving it would fill the list with buttons that only show the
  // full list. A filter-only search (no text, overdue list) counts.
  if (!entry.text && entry.statusFilter === 'all' && entry.customerStatus === 'all' && !entry.mohalla) return null;
  return entry;
}

export function normalizeSavedSearchFilterList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeSavedSearchFilter(raw);
    if (!entry) continue;
    const key = savedSearchFilterKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= SAVED_SEARCH_FILTERS_MAX) break;
  }
  return out;
}

export function savedSearchFilterKey(entry) {
  const normalized = normalizeSavedSearchFilter(entry);
  if (!normalized) return '';
  return normalized.name.toLowerCase();
}

export function saveSavedSearchFilter(list, raw) {
  const normalized = normalizeSavedSearchFilterList(list);
  const fresh = normalizeSavedSearchFilter(raw);
  if (!fresh) return normalized;
  // The same name (case-insensitive) is the same filter: saving it
  // again replaces the definition and moves it to the top, never a
  // second button with the same name.
  const kept = normalized.filter(entry => savedSearchFilterKey(entry) !== savedSearchFilterKey(fresh));
  return normalizeSavedSearchFilterList([fresh, ...kept]);
}

export function removeSavedSearchFilter(list, nameOrIndex) {
  const normalized = normalizeSavedSearchFilterList(list);
  if (typeof nameOrIndex === 'number') {
    if (!Number.isInteger(nameOrIndex) || nameOrIndex < 0 || nameOrIndex >= normalized.length) return normalized;
    return normalized.filter((_, index) => index !== nameOrIndex);
  }
  const key = cleanSavedFilterName(nameOrIndex).toLowerCase();
  if (!key) return normalized;
  return normalized.filter(entry => savedSearchFilterKey(entry) !== key);
}

export function savedSearchFilterDefinition(entry) {
  const normalized = normalizeSavedSearchFilter(entry);
  if (!normalized) return null;
  return {
    text: normalized.text,
    statusFilter: normalized.statusFilter,
    customerStatus: normalized.customerStatus,
    mohalla: normalized.mohalla,
  };
}

export function savedSearchFilterLabel(entry) {
  const normalized = normalizeSavedSearchFilter(entry);
  if (!normalized) return '';
  const parts = [];
  if (normalized.statusFilter === 'pending') parts.push('Pending Dues');
  if (normalized.statusFilter === 'partial') parts.push('Partial Paid');
  if (normalized.statusFilter === 'paid') parts.push('Settled (Paid)');
  if (normalized.customerStatus === 'paid-up') parts.push('Paid up');
  if (normalized.customerStatus === 'due') parts.push('Due');
  if (normalized.customerStatus === 'overdue') parts.push('Overdue');
  if (normalized.customerStatus === 'suspended') parts.push('Suspended');
  if (normalized.customerStatus === 'new') parts.push('New');
  if (normalized.mohalla) parts.push(normalized.mohalla);
  return parts.join(' · ');
}

export function savedSearchFilterRowText(entry) {
  const normalized = normalizeSavedSearchFilter(entry);
  if (!normalized) return '';
  return normalized.name;
}

export function savedSearchFilterTitle(entry) {
  const normalized = normalizeSavedSearchFilter(entry);
  if (!normalized) return '';
  const text = normalized.text ? `"${normalized.text}"` : 'All customers';
  const filter = savedSearchFilterLabel(normalized);
  return filter ? `${text} — ${filter}` : text;
}

export function savedSearchFilterHtml(rows) {
  const list = normalizeSavedSearchFilterList(rows);
  if (list.length === 0) return '<p>No saved filters yet.</p>';
  return list.map((row, index) => {
    const name = escapeSavedFilterHtml(savedSearchFilterRowText(row));
    const title = escapeSavedFilterHtml(savedSearchFilterTitle(row));
    return `<span style="display:flex;align-items:center;gap:2px;"><button type="button" class="fcs-status-chip" data-saved-filter-index="${index}" title="${title}">${name}</button><button type="button" class="fcs-clear-recent-btn" data-saved-filter-remove-index="${index}" title="Remove this saved filter" aria-label="Remove saved filter ${name}">×</button></span>`;
  }).join('');
}
