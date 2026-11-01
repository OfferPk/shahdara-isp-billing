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
 * Performs fast search across customer records with status chip filtering.
 *
 * @param {Object} state - Billing state
 * @param {Object} [options={}]
 * @param {string} [options.query='']
 * @param {('all'|'pending'|'partial'|'paid')} [options.statusFilter='all']
 * @param {Date} [referenceDate=new Date()]
 * @returns {Array<Object>}
 */
export function searchFastCustomers(state, {
  query = '',
  statusFilter = 'all'
} = {}, referenceDate = new Date()) {
  if (!state || !Array.isArray(state.customers)) return [];

  const allocations = calculatePaymentAllocations(state);
  const currentMonth = monthsForHistory(referenceDate)[0];
  const normalized = String(query ?? '').normalize('NFKC').trim().toLowerCase();

  const results = [];

  for (const customer of state.customers) {
    if (customer.archived) continue;

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

    // Apply text search query
    if (normalized) {
      const numStr = String(customer.customerNumber ?? '');
      const matches =
        customer.name.toLowerCase().includes(normalized) ||
        // SISP-165: father's/reference name + search aliases, with
        // Roman-Urdu phonetic matching ("Fesal" finds "Faisal").
        fuzzyCustomerNameMatches(customer, query) ||
        numStr.includes(normalized) ||
        `#${numStr}`.includes(normalized) ||
        (customer.phone && customer.phone.toLowerCase().includes(normalized)) ||
        (customer.area && customer.area.toLowerCase().includes(normalized)) ||
        (customer.mohalla && customer.mohalla.toLowerCase().includes(normalized)) ||
        (customer.address && customer.address.toLowerCase().includes(normalized)) ||
        // SISP-74: the global search also finds a customer by PPPoE
        // username, static IP, MAC address or router serial number.
        identitySearchMatches(customer, normalized);

      if (!matches) continue;
    }

    results.push({
      id: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
      phone: customer.phone || '',
      area: customer.area || 'Unassigned',
      mohalla: customer.mohalla || '',
      address: customer.address || '',
      serviceStatus: customer.serviceStatus || 'not-set',
      billingStatus: currentStatus,
      totalDues,
      currentDue,
      monthlySellingAmount: customer.monthlySellingAmount || 0
    });
  }

  // Sort: pending/partial accounts with highest dues first, then customer number
  results.sort((a, b) => {
    if (b.totalDues !== a.totalDues) {
      return b.totalDues - a.totalDues;
    }
    return a.customerNumber - b.customerNumber;
  });

  return results;
}

/**
 * Renders customer search results list HTML with accessible touch buttons.
 *
 * @param {Array<Object>} customers
 * @param {Object} [options={}]
 * @param {boolean} [options.isRecent=false]
 * @returns {string}
 */
export function renderFastCustomerSearchResultsHtml(customers, { isRecent = false } = {}) {
  if (!customers || customers.length === 0) {
    return `
      <div class="fcs-empty-state" role="status">
        <span class="fcs-empty-icon" aria-hidden="true">${isRecent ? '🕒' : '🔍'}</span>
        <h4>${isRecent ? 'No recent customers' : 'No matching customers found'}</h4>
        <p>${isRecent ? 'Search for any customer above to start your field work.' : 'Try searching with a shorter name, phone digits, or area.'}</p>
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
 * @returns {Object} Controller with { open, close, isOpen }
 */
export function setupFastCustomerSearchModal({
  getState,
  onSelectCustomer,
  onOpenQuickCollect,
  onToast
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
  const statusChips = modal.querySelectorAll('.fcs-status-chip');
  const resultsContainer = document.getElementById('fastCustomerSearchResults');
  const countBadge = document.getElementById('fastCustomerSearchCountBadge');
  const clearRecentBtn = document.getElementById('fastCustomerClearRecentBtn');
  const sectionTitle = document.getElementById('fastCustomerSearchSectionTitle');

  let activeStatusFilter = 'all';
  let highlightedIndex = -1;

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

    if (!hasQuery && activeStatusFilter === 'all') {
      // Show recent customers
      const recents = getRecentCustomers(state);
      if (sectionTitle) sectionTitle.textContent = `Recent Customers (${recents.length})`;
      if (clearRecentBtn) clearRecentBtn.hidden = recents.length === 0;
      if (countBadge) countBadge.textContent = `${recents.length} recent`;

      // Map recents to full search shape
      const fullList = searchFastCustomers(state, { query: '', statusFilter: 'all' });
      const fullMap = new Map(fullList.map(c => [c.id, c]));
      const recentFull = recents.map(r => fullMap.get(r.id)).filter(Boolean);

      resultsContainer.innerHTML = renderFastCustomerSearchResultsHtml(recentFull, { isRecent: true });
    } else {
      // Show search query results
      if (clearRecentBtn) clearRecentBtn.hidden = true;
      const results = searchFastCustomers(state, {
        query,
        statusFilter: activeStatusFilter
      });

      if (sectionTitle) sectionTitle.textContent = `Search Results (${results.length})`;
      if (countBadge) countBadge.textContent = `${results.length} found`;

      resultsContainer.innerHTML = renderFastCustomerSearchResultsHtml(results, { isRecent: false });
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
    highlightedIndex = -1;
    statusChips.forEach(chip => {
      chip.classList.toggle('is-active', chip.getAttribute('data-status') === 'all');
    });
    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.hidden = true;
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

  // Wire status filter chips
  statusChips.forEach(chip => {
    chip.addEventListener('click', () => {
      statusChips.forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      activeStatusFilter = chip.getAttribute('data-status') || 'all';
      render();
    });
  });

  // Clear recent list
  clearRecentBtn?.addEventListener('click', () => {
    clearRecentCustomers();
    render();
    if (typeof onToast === 'function') onToast('Recent search history cleared.');
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
        const action = e.shiftKey ? 'profile' : 'collect';
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
        const action = e.shiftKey ? 'profile' : 'collect';
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
