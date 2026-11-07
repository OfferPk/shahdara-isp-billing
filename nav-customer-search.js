/**
 * nav-customer-search.js - Fast Customer Search Sheet & Recent Accounts (agent2 - shahdara-mobile-nav)
 *
 * Implements Backlog Item 2:
 * 1. Instant mobile search sheet by name, phone, customer number, area and mohalla.
 * 2. Recent customers cache stored in localStorage (deduplicated, newest first).
 * 3. Quick status filter chips: All, Pending, Partial, Paid.
 * 4. Large touch targets (>= 48px) with quick action shortcuts: Quick Collect, Profile, WhatsApp.
 * 5. Works 100% offline with zero cloud requests.
 * 6. Keyboard shortcut support (press '/' anywhere to focus/open).
 */

import {
  calculatePaymentAllocations,
  derivedBillStatus,
  monthsForHistory,
  formatPKR,
  identitySearchMatches,
  whatsappPhoneFor
} from './core.js';
import { formatWhatsAppUrl } from './form-validation.js';
import { fuzzyCustomerNameMatches } from './fuzzy-alias-search.js';
import { partialPhoneMatches } from './partial-phone-search.js';
// Plan 353: mohalla-first combined filter — pick a mohalla, then search
// names within that mohalla only, from the app's own mohalla list.
import { mohallaNameMatches, mohallaFilterOptionsHtml } from './mohalla-name-filter.js';
// Plan 451: exact customer ID / connection ID lookup — a full ID typed
// at the counter returns that one customer only, and an unknown ID
// says so plainly; the sheet's partial matching is untouched otherwise.
import {
  customerIdLookupMatches,
  customerIdLookupIsIdQuery,
  customerIdLookupUnknownText,
  customerIdLookupOpensProfileDirectly,
} from './customer-id-lookup.js';
// Plan 452: status filter — paid up, due, overdue, suspended, new.
// The five states come from the app's own rules (bill balances, the
// dues-aging due date, open suspension records, the addedOn month);
// the filter reads them only and never changes any record.
import {
  normalizeCustomerStatusFilter,
  customerStatusFilterMatches,
} from './customer-status-filter.js';
// Plan 355: known-as name beside the formal name on search cards and in
// the recent list — the father / reference name first, else the first
// nickname; the sheet's own strings stay English, as elsewhere here.
import { knownAsNameFor, knownAsLabelKeyFor, KNOWN_AS_FATHER_LABEL_KEY } from './known-as-name.js';
// Plan 457: relevance ranking for search results — the exact name
// first, then names starting with the typed text, then names
// containing it, then nickname matches.
import { rankCustomerSearchResults } from './search-result-ranking.js';
// Plan 458: recent searches — the searches the operator just ran,
// latest first with the text and the filter shown, so a search run
// five minutes ago is one tap away instead of a re-type.
import {
  RECENT_SEARCHES_STORE_KEY,
  normalizeRecentSearch,
  normalizeRecentSearchList,
  recordRecentSearch,
  recentSearchHtml,
} from './recent-searches.js';
import { DEFAULT_MOHALLAS } from './phase3.js';
import { trapModalFocus } from './nav-accessibility.js';

export const RECENT_CUSTOMERS_STORAGE_KEY = 'shahdara_recent_customers_v1';

/**
 * Escapes HTML characters for safe template string interpolation.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Records a customer into the recent accounts cache.
 *
 * @param {Object} customer
 * @param {Storage} [storage=localStorage]
 * @returns {Array<Object>} Updated recent list
 */
export function recordRecentCustomer(customer, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!customer || !customer.id) return [];
  if (!storage) return [];

  try {
    const raw = storage.getItem(RECENT_CUSTOMERS_STORAGE_KEY);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    // Remove previous entry for this customer
    list = list.filter(item => item.id !== customer.id);

    // Insert at beginning
    list.unshift({
      id: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
      phone: customer.phone || '',
      area: customer.area || 'Unassigned',
      viewedAt: new Date().toISOString()
    });

    // Keep top 12 recent customers
    list = list.slice(0, 12);
    storage.setItem(RECENT_CUSTOMERS_STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch {
    return [];
  }
}

/**
 * Retrieves valid recent customers that currently exist and are not archived in state.
 *
 * @param {Object} state
 * @param {Storage} [storage=localStorage]
 * @returns {Array<Object>}
 */
export function getRecentCustomers(state, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !state || !Array.isArray(state.customers)) return [];
  try {
    const raw = storage.getItem(RECENT_CUSTOMERS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];

    const activeMap = new Map(state.customers.filter(c => !c.archived).map(c => [c.id, c]));
    return list
      .filter(item => activeMap.has(item.id))
      .map(item => {
        const full = activeMap.get(item.id);
        return {
          ...item,
          name: full.name,
          customerNumber: full.customerNumber,
          phone: full.phone || '',
          area: full.area || 'Unassigned'
        };
      });
  } catch {
    return [];
  }
}

/**
 * Clears the recent customers cache from storage.
 * @param {Storage} [storage=localStorage]
 */
export function clearRecentCustomers(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(RECENT_CUSTOMERS_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Records one run search — the typed text plus the billing chip, the
 * account-state chip, and the mohalla filter that were active — into
 * the on-device recent searches list.
 *
 * @param {Object} search - { text, statusFilter, customerStatus, mohalla }
 * @param {Storage} [storage=localStorage]
 * @returns {Array<Object>} Updated recent searches list
 */
export function recordRecentSearchRun(search, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_SEARCHES_STORE_KEY);
    const before = normalizeRecentSearchList(raw ? JSON.parse(raw) : []);
    // A search that normalizes to nothing (a blank box with every
    // filter cleared) records nothing and touches no storage.
    if (!normalizeRecentSearch(search)) return before;
    const list = recordRecentSearch(before, search);
    storage.setItem(RECENT_SEARCHES_STORE_KEY, JSON.stringify(list));
    return list;
  } catch {
    return [];
  }
}

/**
 * Retrieves the recent searches list, newest first.
 *
 * @param {Storage} [storage=localStorage]
 * @returns {Array<Object>}
 */
export function getRecentSearches(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_SEARCHES_STORE_KEY);
    return normalizeRecentSearchList(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

/**
 * Clears the recent searches list from storage.
 * @param {Storage} [storage=localStorage]
 */
export function clearRecentSearches(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(RECENT_SEARCHES_STORE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Performs fast search across customer records with status chip filtering.
 *
 * @param {Object} state - Billing state
 * @param {Object} [options={}]
 * @param {string} [options.query='']
 * @param {('all'|'pending'|'partial'|'paid')} [options.statusFilter='all']
 * @param {('all'|'paid-up'|'due'|'overdue'|'suspended'|'new')} [options.customerStatus='all']
 * @param {Array<string>|Set<string>} [options.suspendedCustomerIds=[]]
 * @param {Date} [referenceDate=new Date()]
 * @returns {Array<Object>}
 */
export function searchFastCustomers(state, {
  query = '',
  statusFilter = 'all',
  // Plan 452: a chosen account state narrows the search to that
  // state only — paid up, due, overdue, suspended, or new; 'all'
  // means the full list. The open suspension ids are caller-supplied
  // (the sheet's controller passes the app's open suspensions);
  // without them the suspended state matches nobody.
  customerStatus = 'all',
  suspendedCustomerIds = [],
  // Plan 353: a chosen mohalla narrows the search to that mohalla only;
  // blank means the full list.
  mohalla = ''
} = {}, referenceDate = new Date()) {
  if (!state || !Array.isArray(state.customers)) return [];

  const allocations = calculatePaymentAllocations(state);
  const currentMonth = monthsForHistory(referenceDate)[0];
  const normalized = String(query ?? '').normalize('NFKC').trim().toLowerCase();

  // Plan 457: the raw customer rides with its result row, so the
  // relevance ranking below can read the father / reference name and
  // the search aliases the row itself does not carry.
  const results = new Map();
  // Plan 451: an exact customer ID / connection ID hit is returned on
  // its own — a full ID never drags in look-alike numbers, and the
  // record id is matched here at all. The hit still has to pass the
  // mohalla and status filters above, exactly like any other result.
  let exactIdHit = null;

  for (const customer of state.customers) {
    if (customer.archived) continue;

    // Plan 353: mohalla first — a chosen mohalla narrows every later
    // match to that mohalla only; blank means the full list.
    if (!mohallaNameMatches(customer, mohalla)) continue;

    // Evaluate billing status for current month and aggregate dues
    const currentBill = (customer.bills ?? []).find(b => b.month === currentMonth);
    const currentStatus = derivedBillStatus(customer, currentBill, allocations);
    const currentSummary = allocations.forMonth(customer.id, currentMonth);

    let totalDuesCents = 0;
    for (const b of (customer.bills ?? [])) {
      const s = allocations.forMonth(customer.id, b.month);
      if (s?.balanceDueCents && s.balanceDueCents > 0) {
        totalDuesCents += s.balanceDueCents;
      }
    }
    const totalDues = Math.max(0, totalDuesCents / 100);
    const currentDue = currentSummary?.balanceDueCents ? Math.max(0, currentSummary.balanceDueCents / 100) : 0;

    // Apply status filter chip
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending' && currentStatus !== 'pending') continue;
      if (statusFilter === 'partial' && currentStatus !== 'partial') continue;
      if (statusFilter === 'paid' && currentStatus !== 'paid') continue;
    }

    // Plan 452: the account-state filter runs next, on the same
    // footing as the billing chips and the mohalla filter — an
    // exact-ID hit below still has to pass it, exactly like the
    // other filters. 'all' (unknown values included) passes
    // everyone, so the sheet's old behaviour is unchanged.
    if (!customerStatusFilterMatches(customer, customerStatus, {
      allocations,
      suspendedCustomerIds,
      currentMonth,
      referenceDate,
    })) continue;

    // Apply text search query
    // Plan 451: the exact-ID check runs first — when the typed query
    // is a full customer ID or connection ID, this customer is the
    // answer and the partial branches below never run for them.
    let isExactIdHit = false;
    if (normalized) {
      if (customerIdLookupMatches(customer, query)) {
        isExactIdHit = true;
      } else {
        const numStr = String(customer.customerNumber ?? '');
        const matches =
          customer.name.toLowerCase().includes(normalized) ||
          // SISP-165: father's/reference name + search aliases, with
          // Roman-Urdu phonetic matching ("Fesal" finds "Faisal").
          fuzzyCustomerNameMatches(customer, query) ||
          numStr.includes(normalized) ||
          `#${numStr}`.includes(normalized) ||
          (customer.phone && customer.phone.toLowerCase().includes(normalized)) ||
          // Plan 352: digit-normalized partial phone search — the typed
          // digits match any substring of the stored number whatever the
          // stored or typed formatting, so "2345678" finds a number
          // stored as "0301-234 5678" or "+92 301 2345678".
          partialPhoneMatches(customer, query) ||
          (customer.area && customer.area.toLowerCase().includes(normalized)) ||
          (customer.mohalla && customer.mohalla.toLowerCase().includes(normalized)) ||
          (customer.address && customer.address.toLowerCase().includes(normalized)) ||
          // SISP-74: the global search also finds a customer by PPPoE
          // username, static IP, MAC address or router serial number.
          identitySearchMatches(customer, normalized);

        if (!matches) continue;
      }
    }

    const result = {
      id: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
      // Plan 355: the known-as name rides with the result, so both the
      // search cards and the recent list (mapped from these same results)
      // show it beside the formal name.
      knownAs: knownAsNameFor(customer),
      knownAsLabelKey: knownAsLabelKeyFor(customer),
      phone: customer.phone || '',
      area: customer.area || 'Unassigned',
      mohalla: customer.mohalla || '',
      address: customer.address || '',
      serviceStatus: customer.serviceStatus || 'not-set',
      billingStatus: currentStatus,
      totalDues,
      currentDue,
      monthlySellingAmount: customer.monthlySellingAmount || 0
    };
    if (isExactIdHit) exactIdHit = result;
    else results.set(customer, result);
  }

  // Plan 451: a single exact-ID hit is the whole answer.
  if (exactIdHit) return [exactIdHit];

  // Sort: pending/partial accounts with highest dues first, then customer number
  const ordered = [...results.keys()].sort((a, b) => {
    const duesA = results.get(a).totalDues;
    const duesB = results.get(b).totalDues;
    if (duesB !== duesA) {
      return duesB - duesA;
    }
    return results.get(a).customerNumber - results.get(b).customerNumber;
  });

  // Plan 457: with a query typed, relevance ranks the results — the
  // exact name first, then names starting with the typed text, then
  // names containing it, then nickname matches. The ranking runs
  // over the dues order above, so anything that matched by another
  // field (phone, number, area) keeps that order. With no query
  // the dues order stands as before.
  const ranked = normalized
    ? rankCustomerSearchResults(ordered, query)
    : ordered;

  return ranked.map((customer) => results.get(customer));
}

/**
 * Renders customer search results list HTML with accessible touch buttons.
 *
 * @param {Array<Object>} customers
 * @param {Object} [options={}]
 * @param {boolean} [options.isRecent=false]
 * @param {string} [options.emptyText] - Plan 451: the plain message
 *   shown when an ID-shaped query matches nobody; without it the
 *   generic hint is shown, exactly as before.
 * @returns {string}
 */
export function renderFastCustomerSearchResultsHtml(customers, { isRecent = false, emptyText = '' } = {}) {
  if (!customers || customers.length === 0) {
    return `
      <div class="fcs-empty-state" role="status">
        <span class="fcs-empty-icon" aria-hidden="true">${isRecent ? '🕒' : '🔍'}</span>
        <h4>${isRecent ? 'No recent customers' : 'No matching customers found'}</h4>
        <p>${isRecent ? 'Search for any customer above to start your field work.' : escapeHtml(emptyText) || 'Try searching with a shorter name, phone digits, or area.'}</p>
      </div>
    `;
  }

  return customers.map((c, index) => {
    const hasDues = c.totalDues > 0;
    const statusClass = (c.billingStatus || '').toLowerCase();
    const statusLabel =
      c.billingStatus === 'paid' ? 'PAID' :
      c.billingStatus === 'partial' ? 'PARTIAL' :
      c.billingStatus === 'pending' ? 'PENDING' : 'NOT SET';

    return `
      <article class="fcs-card" id="fcs-card-${escapeHtml(c.id)}" data-customer-id="${escapeHtml(c.id)}" data-index="${index}" role="option" aria-selected="false">
        <div class="fcs-card-main">
          <div class="fcs-avatar">#${escapeHtml(String(c.customerNumber))}</div>
          <div class="fcs-info">
            <div class="fcs-name-row">
              <strong class="fcs-name">${escapeHtml(c.name)}</strong>
              <span class="fcs-status-tag ${statusClass}">${escapeHtml(statusLabel)}</span>
            </div>
            ${c.knownAs ? `<span class="fcs-known-as">${escapeHtml(c.knownAsLabelKey === KNOWN_AS_FATHER_LABEL_KEY ? 'Father / reference' : 'Also known as')}: ${escapeHtml(c.knownAs)}</span>` : ''}
            <div class="fcs-meta-row">
              <span class="fcs-area">${escapeHtml(c.area)}</span>
              ${c.phone ? `<span class="fcs-phone"> · ${escapeHtml(c.phone)}</span>` : ''}
            </div>
          </div>
          <div class="fcs-dues-col">
            <span class="fcs-dues-label">${hasDues ? 'Due' : 'Balance'}</span>
            <strong class="fcs-dues-val ${hasDues ? 'has-due' : 'settled'}">
              PKR ${Number(c.totalDues).toLocaleString('en-PK')}
            </strong>
          </div>
        </div>

        <div class="fcs-card-actions">
          <button type="button"
                  class="fcs-action-btn fcs-collect-btn"
                  data-fcs-action="collect"
                  data-customer-id="${escapeHtml(c.id)}"
                  title="${statusLabel === 'NOT SET' ? `Set monthly fee or collect from ${escapeHtml(c.name)}` : `Quick Collect from ${escapeHtml(c.name)}`}">
            ${statusLabel === 'NOT SET' ? '⚡ Collect / Set Fee' : '⚡ Quick Collect'}
          </button>
          <button type="button"
                  class="fcs-action-btn fcs-profile-btn"
                  data-fcs-action="profile"
                  data-customer-id="${escapeHtml(c.id)}"
                  title="View full profile of ${escapeHtml(c.name)}">
            👤 Profile
          </button>
          ${c.phone || c.whatsappPhone ? `
          <button type="button"
                  class="fcs-action-btn fcs-wa-btn"
                  data-fcs-action="whatsapp"
                  data-customer-id="${escapeHtml(c.id)}"
                  data-phone="${escapeHtml(whatsappPhoneFor(c))}"
                  title="Send WhatsApp message to ${escapeHtml(c.name)}">
            💬 WhatsApp
          </button>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

/**
 * Sets up the Fast Customer Search Sheet controller.
 *
 * @param {Object} options
 * @param {Function} options.getState
 * @param {Function} options.onSelectCustomer
 * @param {Function} [options.onOpenQuickCollect]
 * @param {Function} [options.onToast]
 * @param {Function} [options.getSuspendedCustomerIds]
 * @returns {Object} Controller with { open, close, isOpen }
 */
export function setupFastCustomerSearchModal({
  getState,
  onSelectCustomer,
  onOpenQuickCollect,
  onToast,
  // Plan 452: the ids of customers with an open suspension record,
  // supplied by the app (which owns the suspension store). Without
  // it the suspended state matches nobody.
  getSuspendedCustomerIds
}) {
  const modal = document.getElementById('mobileCustomerSearchModal');
  if (!modal) {
    return {
      open: () => {},
      close: () => {},
      isOpen: () => false
    };
  }

  const closeBtn = document.getElementById('closeMobileCustomerSearchModalBtn');
  const searchInput = document.getElementById('fastCustomerSearchInput');
  const searchClearBtn = document.getElementById('fastCustomerSearchClearBtn');
  // Plan 353: mohalla-first filter select — options come from the app's
  // own mohalla list so the sheet never carries a second list.
  const mohallaSelect = document.getElementById('fastCustomerSearchMohallaSelect');
  if (mohallaSelect) mohallaSelect.innerHTML = mohallaFilterOptionsHtml(DEFAULT_MOHALLAS, '');
  const statusChips = modal.querySelectorAll('#fcsBillingChips .fcs-status-chip');
  // Plan 452: the account-state chips live in their own row and share
  // the billing chips' styling; they are wired separately below, so
  // the billing row above is scoped to its own container.
  const accountChips = modal.querySelectorAll('#fcsAccountChips .fcs-status-chip');
  const resultsContainer = document.getElementById('fastCustomerSearchResults');
  const countBadge = document.getElementById('fastCustomerSearchCountBadge');
  const clearRecentBtn = document.getElementById('fastCustomerClearRecentBtn');
  const sectionTitle = document.getElementById('fastCustomerSearchSectionTitle');
  // Plan 458: the recent searches section — the searches just run,
  // shown only while nothing is being searched.
  const recentSearchesHeader = document.getElementById('fastCustomerRecentSearchesHeader');
  const recentSearchesTitle = document.getElementById('fastCustomerRecentSearchesTitle');
  const recentSearchesContainer = document.getElementById('fastCustomerRecentSearches');
  const clearRecentSearchesBtn = document.getElementById('fastCustomerClearRecentSearchesBtn');

  let activeStatusFilter = 'all';
  // Plan 452: the chosen account state — paid up, due, overdue,
  // suspended, or new; 'all' is the full list.
  let activeCustomerStatus = 'all';
  let highlightedIndex = -1;
  // Plan 451: the results of the last render, so Enter can tell an
  // exact-ID single hit (which opens the profile directly) from any
  // other single result.
  let lastResults = [];

  function updateHighlight(newIndex, scroll = true) {
    if (!resultsContainer) return;
    const cards = Array.from(resultsContainer.querySelectorAll('.fcs-card'));
    cards.forEach((card, idx) => {
      if (idx === newIndex) {
        card.classList.add('is-highlighted');
        card.setAttribute('aria-selected', 'true');
        card.setAttribute('tabindex', '0');
        searchInput?.setAttribute('aria-activedescendant', card.id || `fcs-card-${idx}`);
        if (scroll) {
          card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else {
        card.classList.remove('is-highlighted');
        card.setAttribute('aria-selected', 'false');
        card.removeAttribute('tabindex');
      }
    });

    if (newIndex >= 0 && newIndex < cards.length) {
      highlightedIndex = newIndex;
    } else {
      highlightedIndex = -1;
      searchInput?.removeAttribute('aria-activedescendant');
    }
  }

  function triggerCardAction(card, action = 'collect') {
    if (!card) return;
    const customerId = card.getAttribute('data-customer-id');
    const state = getState();
    const customer = state?.customers?.find(c => c.id === customerId);

    if (customer) {
      recordRecentCustomer(customer);
    }

    closeModal();

    if (action === 'profile') {
      if (typeof onSelectCustomer === 'function') {
        onSelectCustomer(customerId);
      }
    } else {
      if (typeof onOpenQuickCollect === 'function') {
        onOpenQuickCollect(customerId);
      }
    }
  }

  function render() {
    const state = getState();
    if (!state || !resultsContainer) return;

    const query = searchInput?.value ?? '';
    const hasQuery = Boolean(query.trim());
    // Plan 353: a chosen mohalla shows filtered results, never the
    // recent list — clearing it returns to recents / the full list.
    const mohallaValue = mohallaSelect?.value ?? '';

    if (!hasQuery && activeStatusFilter === 'all' && activeCustomerStatus === 'all' && !mohallaValue) {
      // Show recent customers
      const recents = getRecentCustomers(state);
      if (sectionTitle) sectionTitle.textContent = `Recent Customers (${recents.length})`;
      if (clearRecentBtn) clearRecentBtn.hidden = recents.length === 0;
      if (countBadge) countBadge.textContent = `${recents.length} recent`;

      // Map recents to full search shape
      const fullList = searchFastCustomers(state, { query: '', statusFilter: 'all' });
      const fullMap = new Map(fullList.map(c => [c.id, c]));
      const recentFull = recents.map(r => fullMap.get(r.id)).filter(Boolean);
      lastResults = recentFull;

      resultsContainer.innerHTML = renderFastCustomerSearchResultsHtml(recentFull, { isRecent: true });

      // Plan 458: the recent searches sit above the recent customers
      // — the searches just run, latest first, with the text and the
      // filter shown. The section hides entirely when the list is
      // empty; the header and the row use display:flex in CSS, which
      // overrides the hidden attribute, so they hide by style.
      const searches = getRecentSearches();
      const showSearches = searches.length > 0;
      if (recentSearchesHeader) recentSearchesHeader.style.display = showSearches ? '' : 'none';
      if (recentSearchesContainer) recentSearchesContainer.style.display = showSearches ? '' : 'none';
      if (recentSearchesTitle) recentSearchesTitle.textContent = `Recent Searches (${searches.length})`;
      if (clearRecentSearchesBtn) clearRecentSearchesBtn.hidden = searches.length === 0;
      if (recentSearchesContainer) recentSearchesContainer.innerHTML = recentSearchHtml(searches);
    } else {
      // Show search query results
      if (clearRecentBtn) clearRecentBtn.hidden = true;
      // Plan 458: a search is running, so the recent searches hide.
      if (recentSearchesHeader) recentSearchesHeader.style.display = 'none';
      if (recentSearchesContainer) {
        recentSearchesContainer.style.display = 'none';
        recentSearchesContainer.innerHTML = '';
      }
      const results = searchFastCustomers(state, {
        query,
        statusFilter: activeStatusFilter,
        // Plan 452: the account-state filter composes with the
        // billing chips, the mohalla filter, and the typed query.
        customerStatus: activeCustomerStatus,
        suspendedCustomerIds: typeof getSuspendedCustomerIds === 'function'
          ? getSuspendedCustomerIds()
          : [],
        mohalla: mohallaValue
      });
      lastResults = results;

      if (sectionTitle) sectionTitle.textContent = `Search Results (${results.length})`;
      if (countBadge) countBadge.textContent = `${results.length} found`;

      // Plan 451: an unknown ID says so plainly instead of the
      // generic hint; any other empty search keeps that hint.
      const emptyText = results.length === 0 && customerIdLookupIsIdQuery(query)
        ? customerIdLookupUnknownText(query)
        : '';
      resultsContainer.innerHTML = renderFastCustomerSearchResultsHtml(results, { isRecent: false, emptyText });
    }

    // Keyboard navigation update (#312):
    // When there is exactly 1 result, auto-highlight it so Enter activates it immediately
    const cards = Array.from(resultsContainer.querySelectorAll('.fcs-card'));
    if (cards.length === 1) {
      updateHighlight(0, false);
    } else {
      updateHighlight(-1, false);
    }
  }

  let releaseFocusTrap = null;

  function openModal() {
    activeStatusFilter = 'all';
    // Plan 452: the account-state filter starts cleared on every open.
    activeCustomerStatus = 'all';
    highlightedIndex = -1;
    statusChips.forEach(chip => {
      chip.classList.toggle('is-active', chip.getAttribute('data-status') === 'all');
    });
    accountChips.forEach(chip => {
      chip.classList.toggle('is-active', chip.getAttribute('data-account-status') === 'all');
    });
    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.hidden = true;
    // Plan 353: the mohalla filter starts cleared on every open.
    if (mohallaSelect) mohallaSelect.value = '';
    render();

    if (typeof modal.showModal === 'function') {
      try {
        if (!modal.open) modal.showModal();
      } catch {
        modal.setAttribute('open', '');
      }
    } else {
      modal.setAttribute('open', '');
    }

    releaseFocusTrap = trapModalFocus(modal, {
      initialFocus: searchInput,
      onEscape: closeModal
    });

    setTimeout(() => {
      searchInput?.focus();
    }, 60);
  }

  function closeModal() {
    // Plan 458: the search that was running when the sheet closes is
    // the operator's most recent search — record it now, so the next
    // open offers it back in one tap. A blank box with every filter
    // cleared records nothing.
    recordRecentSearchRun({
      text: searchInput?.value ?? '',
      statusFilter: activeStatusFilter,
      customerStatus: activeCustomerStatus,
      mohalla: mohallaSelect?.value ?? '',
    });

    if (releaseFocusTrap) {
      releaseFocusTrap();
      releaseFocusTrap = null;
    }

    if (typeof modal.close === 'function') {
      try {
        if (modal.open) modal.close();
      } catch {
        modal.removeAttribute('open');
      }
    } else {
      modal.removeAttribute('open');
    }
  }

  // Wire search input
  searchInput?.addEventListener('input', () => {
    if (searchClearBtn) searchClearBtn.hidden = !searchInput.value;
    render();
  });

  searchClearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    searchClearBtn.hidden = true;
    searchInput?.focus();
    render();
  });

  // Plan 353: changing the mohalla re-renders the results at once.
  mohallaSelect?.addEventListener('change', () => {
    render();
  });

  // Wire status filter chips
  statusChips.forEach(chip => {
    chip.addEventListener('click', () => {
      statusChips.forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      activeStatusFilter = chip.getAttribute('data-status') || 'all';
      render();
    });
  });

  // Plan 452: wire the account-state chips — one tap lists every
  // customer in that state; "All" clears the filter and returns the
  // full list. The billing chips above are untouched.
  accountChips.forEach(chip => {
    chip.addEventListener('click', () => {
      accountChips.forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      activeCustomerStatus = normalizeCustomerStatusFilter(chip.getAttribute('data-account-status'));
      render();
    });
  });

  // Clear recent list
  clearRecentBtn?.addEventListener('click', () => {
    clearRecentCustomers();
    render();
    if (typeof onToast === 'function') onToast('Recent search history cleared.');
  });

  // Plan 458: tapping a recent search runs it again — the box fills
  // with its text, its chips and mohalla come back, and the results
  // render exactly as typing it again would.
  function applyRecentSearch(entry) {
    if (!entry) return;
    if (searchInput) searchInput.value = entry.text ?? '';
    if (searchClearBtn) searchClearBtn.hidden = !searchInput?.value;
    activeStatusFilter = entry.statusFilter ?? 'all';
    statusChips.forEach(chip => {
      chip.classList.toggle('is-active', chip.getAttribute('data-status') === activeStatusFilter);
    });
    activeCustomerStatus = entry.customerStatus ?? 'all';
    accountChips.forEach(chip => {
      chip.classList.toggle('is-active', chip.getAttribute('data-account-status') === activeCustomerStatus);
    });
    if (mohallaSelect) mohallaSelect.value = entry.mohalla ?? '';
    render();
  }

  recentSearchesContainer?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-recent-search-index]');
    if (!row) return;
    const index = Number(row.getAttribute('data-recent-search-index'));
    const searches = getRecentSearches();
    if (!Number.isInteger(index) || index < 0 || index >= searches.length) return;
    applyRecentSearch(searches[index]);
  });

  // Plan 458: clear the recent searches list entirely.
  clearRecentSearchesBtn?.addEventListener('click', () => {
    clearRecentSearches();
    render();
    if (typeof onToast === 'function') onToast('Recent searches cleared.');
  });

  // Wire keyboard navigation for search input (#312)
  searchInput?.addEventListener('keydown', (e) => {
    const cards = Array.from(resultsContainer?.querySelectorAll('.fcs-card') || []);
    if (e.key === 'ArrowDown') {
      if (cards.length > 0) {
        e.preventDefault();
        let nextIndex = highlightedIndex + 1;
        if (nextIndex >= cards.length) nextIndex = 0;
        updateHighlight(nextIndex, true);
      }
    } else if (e.key === 'ArrowUp') {
      if (cards.length > 0) {
        e.preventDefault();
        let prevIndex = highlightedIndex - 1;
        if (prevIndex < 0) prevIndex = cards.length - 1;
        updateHighlight(prevIndex, true);
      }
    } else if (e.key === 'Enter') {
      if (cards.length === 0) return;
      e.preventDefault();
      let targetCard = null;
      if (highlightedIndex >= 0 && cards[highlightedIndex]) {
        targetCard = cards[highlightedIndex];
      } else if (cards.length === 1) {
        targetCard = cards[0];
      } else if (cards.length > 1) {
        updateHighlight(0, true);
        return;
      }
      if (targetCard) {
        // Plan 451: an exact ID lookup opens the matching customer
        // directly — Enter on the single exact-ID result goes to the
        // profile, not Quick Collect. Any other result keeps the
        // sheet's usual Enter action.
        const action = customerIdLookupOpensProfileDirectly(searchInput?.value ?? '', lastResults)
          ? 'profile'
          : (e.shiftKey ? 'profile' : 'collect');
        triggerCardAction(targetCard, action);
      }
    }
  });

  // Wire keyboard navigation for results list container (#312)
  resultsContainer?.addEventListener('keydown', (e) => {
    const cards = Array.from(resultsContainer.querySelectorAll('.fcs-card'));
    if (e.key === 'ArrowDown') {
      if (cards.length > 0) {
        e.preventDefault();
        let nextIndex = highlightedIndex + 1;
        if (nextIndex >= cards.length) nextIndex = 0;
        updateHighlight(nextIndex, true);
      }
    } else if (e.key === 'ArrowUp') {
      if (cards.length > 0) {
        e.preventDefault();
        let prevIndex = highlightedIndex - 1;
        if (prevIndex < 0) {
          searchInput?.focus();
          updateHighlight(-1, false);
        } else {
          updateHighlight(prevIndex, true);
        }
      }
    } else if (e.key === 'Enter' && !e.target.closest('button')) {
      if (cards.length === 0) return;
      e.preventDefault();
      let targetCard = null;
      if (highlightedIndex >= 0 && cards[highlightedIndex]) {
        targetCard = cards[highlightedIndex];
      } else if (cards.length === 1) {
        targetCard = cards[0];
      }
      if (targetCard) {
        // Plan 451: same as the search-input Enter above — an exact
        // ID lookup opens the matching customer directly.
        const action = customerIdLookupOpensProfileDirectly(searchInput?.value ?? '', lastResults)
          ? 'profile'
          : (e.shiftKey ? 'profile' : 'collect');
        triggerCardAction(targetCard, action);
      }
    }
  });

  // Wire card action clicks
  resultsContainer?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fcs-action]');
    if (btn) {
      const action = btn.getAttribute('data-fcs-action');
      const customerId = btn.getAttribute('data-customer-id');
      const state = getState();
      const customer = state?.customers?.find(c => c.id === customerId);

      if (customer) {
        recordRecentCustomer(customer);
      }

      if (action === 'collect') {
        closeModal();
        if (typeof onOpenQuickCollect === 'function') {
          onOpenQuickCollect(customerId);
        }
      } else if (action === 'profile') {
        closeModal();
        if (typeof onSelectCustomer === 'function') {
          onSelectCustomer(customerId);
        }
      } else if (action === 'quick-profile') {
        closeModal();
        if (typeof window !== 'undefined' && window.mobileQuickProfileController?.open) {
          window.mobileQuickProfileController.open(customerId);
        }
      } else if (action === 'whatsapp') {
        const phone = btn.getAttribute('data-phone');
        if (phone) {
          const text = `Assalam-o-Alaikum ${customer?.name || 'Customer'},\nThis is Shahdara ISP Billing & Support.\nRegarding your internet subscription account #${customer?.customerNumber || ''}.`;
          const wa = formatWhatsAppUrl(phone, text);
          if (wa.url) {
            window.open(wa.url, '_blank', 'noopener,noreferrer');
          }
        }
      }
      return;
    }

    const card = e.target.closest('.fcs-card');
    if (card) {
      const cards = Array.from(resultsContainer.querySelectorAll('.fcs-card'));
      const idx = cards.indexOf(card);
      if (idx !== -1) {
        updateHighlight(idx, false);
      }
    }
  });

  closeBtn?.addEventListener('click', closeModal);

  // Wire keyboard shortcut '/' to open fast search sheet
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !modal.open) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
        openModal();
      }
    }
  });

  // Wire topbar mobile search button if present
  document.querySelectorAll('[data-open-mobile-search]').forEach(btn => {
    btn.addEventListener('click', () => openModal());
  });

  const topbarTrigger = document.getElementById('mobileCustomerSearchTrigger');
  topbarTrigger?.addEventListener('click', () => openModal());

  return {
    open: openModal,
    close: closeModal,
    isOpen: () => modal.hasAttribute('open') || modal.open
  };
}
