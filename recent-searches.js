/* Recent searches (Plan 458): one on-device list of the customer
 * searches the operator just ran, latest first, with the search text
 * and the filter shown — so a search run five minutes ago is one tap
 * away instead of a re-type during a busy collection round.
 *
 * No such list existed anywhere: the fast sheet keeps a recents cache
 * of customers picked, and the recently viewed list records profiles
 * opened — neither remembers a search. This module is the missing
 * piece, not a second list: it stores the search itself (the typed
 * text plus the billing chip, the account-state chip, and the mohalla
 * filter that were active), deduplicated, newest first, capped at
 * twelve, and cleared by the operator.
 *
 * The list records searching only. It never changes any customer,
 * bill, or payment record, and it never sends anything. Inputs are
 * never mutated, and the module never reads storage, the clock, the
 * network, or the page. */

export const RECENT_SEARCHES_STORE_KEY = 'shahdara_recent_searches_v1';
export const RECENT_SEARCHES_MAX = 12;

const BILLING_FILTERS = ['all', 'pending', 'partial', 'paid'];
const ACCOUNT_FILTERS = ['all', 'paid-up', 'due', 'overdue', 'suspended', 'new'];

function cleanRecentSearchText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function foldRecentSearchFilter(value, allowed) {
  const text = cleanRecentSearchText(value).toLowerCase();
  return allowed.includes(text) ? text : 'all';
}

function escapeRecentSearchHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function normalizeRecentSearch(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const entry = {
    text: cleanRecentSearchText(raw.text),
    statusFilter: foldRecentSearchFilter(raw.statusFilter, BILLING_FILTERS),
    customerStatus: foldRecentSearchFilter(raw.customerStatus, ACCOUNT_FILTERS),
    mohalla: cleanRecentSearchText(raw.mohalla),
  };
  // A blank box with every filter cleared is not a search worth
  // remembering — recording it would fill the list with empty rows.
  if (!entry.text && entry.statusFilter === 'all' && entry.customerStatus === 'all' && !entry.mohalla) return null;
  return entry;
}

export function normalizeRecentSearchList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeRecentSearch(raw);
    if (!entry) continue;
    const key = recentSearchKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= RECENT_SEARCHES_MAX) break;
  }
  return out;
}

export function recentSearchKey(entry) {
  const normalized = normalizeRecentSearch(entry);
  if (!normalized) return '';
  return [
    normalized.text.toLowerCase(),
    normalized.statusFilter,
    normalized.customerStatus,
    normalized.mohalla.toLowerCase(),
  ].join('|');
}

export function recordRecentSearch(list, entry) {
  const normalized = normalizeRecentSearchList(list);
  const fresh = normalizeRecentSearch(entry);
  if (!fresh) return normalized;
  return normalizeRecentSearchList([fresh, ...normalized]);
}

export function recentSearchFilterLabel(entry) {
  const normalized = normalizeRecentSearch(entry);
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

export function recentSearchRowText(entry) {
  const normalized = normalizeRecentSearch(entry);
  if (!normalized) return '';
  const text = normalized.text ? `"${normalized.text}"` : 'All customers';
  const filter = recentSearchFilterLabel(normalized);
  return filter ? `${text} — ${filter}` : text;
}

export function recentSearchHtml(rows) {
  const list = normalizeRecentSearchList(rows);
  if (list.length === 0) return '<p>No recent searches yet.</p>';
  const items = list.map((row, index) => `<button type="button" class="fcs-status-chip" data-recent-search-index="${index}" title="Run this search again">${escapeRecentSearchHtml(recentSearchRowText(row))}</button>`).join('');
  return items;
}
