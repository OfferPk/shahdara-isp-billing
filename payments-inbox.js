/**
 * payments-inbox.js - Easypaisa Payments Inbox module (#305).
 *
 * Provides a dedicated Payments Inbox view (#/easypaisa) that:
 * 1. Synchronizes transaction rows from John's published Google Sheet CSV (or web app)
 *    and supports manual paste, CSV upload, and PDF statement imports.
 * 2. Displays Today & This Month Sent vs Received KPI summary cards.
 * 3. Filters transactions by Direction, Status, Search query, and Date.
 * 4. Matches incoming payments by sender phone to existing CRM customers.
 * 5. Provides one-tap "Record Payment" writing directly to the customer ledger via core addPayment,
 *    strictly de-duplicated by Transaction ID against existing payments, with toast confirmation & undo.
 *
 * Part of GitHub Issue #305 (OfferPk/shahdara-isp-billing).
 */

import {
  parseEasypaisaEmail,
  parseEasypaisaEmails,
  parseEasypaisaCsv,
  normalizeEasypaisaPhone,
  parseEasypaisaAmount,
  parsePakistanDateTime
} from './easypaisa-parser.js';

import {
  addPayment,
  deletePayment,
  findDuplicatePaymentReference,
  formatPKR,
  calculatePaymentAllocations
} from './core.js';

export const PAKISTAN_TIME_ZONE = 'Asia/Karachi';

export function dateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: PAKISTAN_TIME_ZONE
    }).formatToParts(d).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export const INBOX_STORAGE_KEY = 'easypaisaInbox.items';
export const INBOX_SETTINGS_KEY = 'easypaisaInbox.settings';

export const DEFAULT_SETTINGS = {
  sheetUrl: '',
  ownerNumber: '',
  autoMatchPhone: true
};

/**
 * Loads inbox settings from localStorage.
 *
 * @returns {{ sheetUrl: string, ownerNumber: string, autoMatchPhone: boolean }}
 */
export function getInboxSettings() {
  try {
    const raw = localStorage.getItem(INBOX_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      sheetUrl: typeof parsed.sheetUrl === 'string' ? parsed.sheetUrl.trim() : DEFAULT_SETTINGS.sheetUrl,
      ownerNumber: typeof parsed.ownerNumber === 'string' ? normalizeEasypaisaPhone(parsed.ownerNumber) || DEFAULT_SETTINGS.ownerNumber : DEFAULT_SETTINGS.ownerNumber,
      autoMatchPhone: parsed.autoMatchPhone !== false
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Saves inbox settings to localStorage.
 *
 * @param {Object} settings
 */
export function saveInboxSettings(settings) {
  try {
    const current = getInboxSettings();
    const updated = {
      ...current,
      ...settings,
      ownerNumber: normalizeEasypaisaPhone(settings.ownerNumber || current.ownerNumber)
    };
    localStorage.setItem(INBOX_SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return { ...DEFAULT_SETTINGS, ...settings };
  }
}

/**
 * Loads all cached inbox items from localStorage.
 *
 * @returns {Object[]}
 */
export function loadInboxItems() {
  try {
    const raw = localStorage.getItem(INBOX_STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/**
 * Saves inbox items array to localStorage.
 *
 * @param {Object[]} items
 */
export function saveInboxItems(items) {
  try {
    const clean = Array.isArray(items) ? items.slice(0, 1000) : [];
    localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(clean));
    return clean;
  } catch {
    return items;
  }
}

/**
 * Calculates Today and This Month Sent vs Received totals, plus counts.
 *
 * @param {Object[]} items
 * @param {Date} [referenceDate]
 * @returns {Object}
 */
export function calculateInboxTotals(items = [], referenceDate = new Date()) {
  const todayDateStr = dateKey(referenceDate);
  const currentMonthStr = todayDateStr.slice(0, 7);

  let todayReceived = 0;
  let todayReceivedCount = 0;
  let todaySent = 0;
  let todaySentCount = 0;

  let monthReceived = 0;
  let monthReceivedCount = 0;
  let monthSent = 0;
  let monthSentCount = 0;

  let totalReceived = 0;
  let totalSent = 0;
  let unrecordedCount = 0;
  let needsReviewCount = 0;

  for (const item of items) {
    const amt = Number(item.amount || 0);
    const date = item.date || (item.datetimeIso ? item.datetimeIso.slice(0, 10) : '');
    const isToday = date === todayDateStr;
    const isThisMonth = date.slice(0, 7) === currentMonthStr;

    if (item.status === 'Needs review') {
      needsReviewCount++;
    }

    if (item.direction === 'Received') {
      totalReceived += amt;
      if (isToday) {
        todayReceived += amt;
        todayReceivedCount++;
      }
      if (isThisMonth) {
        monthReceived += amt;
        monthReceivedCount++;
      }
      if (!item.recorded) {
        unrecordedCount++;
      }
    } else if (item.direction === 'Sent') {
      totalSent += amt;
      if (isToday) {
        todaySent += amt;
        todaySentCount++;
      }
      if (isThisMonth) {
        monthSent += amt;
        monthSentCount++;
      }
    }
  }

  return {
    today: {
      date: todayDateStr,
      received: Math.round(todayReceived * 100) / 100,
      receivedCount: todayReceivedCount,
      sent: Math.round(todaySent * 100) / 100,
      sentCount: todaySentCount
    },
    month: {
      month: currentMonthStr,
      received: Math.round(monthReceived * 100) / 100,
      receivedCount: monthReceivedCount,
      sent: Math.round(monthSent * 100) / 100,
      sentCount: monthSentCount
    },
    total: {
      received: Math.round(totalReceived * 100) / 100,
      sent: Math.round(totalSent * 100) / 100,
      unrecordedCount,
      needsReviewCount,
      totalCount: items.length
    }
  };
}

/**
 * Matches customer by phone number (sender phone for received transfers).
 *
 * @param {string} phone
 * @param {Object[]} customers
 * @returns {Object|null}
 */
export function matchCustomerByPhone(phone, customers = []) {
  if (!phone || !Array.isArray(customers)) return null;
  const normPhone = normalizeEasypaisaPhone(phone);
  if (!normPhone) return null;

  for (const c of customers) {
    if (!c || c.archived) continue;
    const cPhone = normalizeEasypaisaPhone(c.phone);
    if (cPhone && cPhone === normPhone) {
      return c;
    }
  }
  return null;
}

/**
 * Finds best candidate bill month for recording payment (earliest unpaid month, or current month).
 *
 * @param {Object} customer
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {Date} [referenceDate]
 * @returns {string} Month 'YYYY-MM'
 */
export function findCandidateBillMonth(customer, dateStr, referenceDate = new Date()) {
  const currentMonth = dateKey(referenceDate).slice(0, 7);
  if (!customer || !Array.isArray(customer.bills)) return currentMonth;

  // Look for unpaid / pending bills, sorted earliest first
  const sortedBills = [...customer.bills].sort((a, b) => a.month.localeCompare(b.month));
  for (const b of sortedBills) {
    const due = Number(b.dueAmount || 0);
    const paid = (b.payments ?? []).filter((p) => p?.voided !== true).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    if (due > paid || b.status === 'pending') {
      return b.month;
    }
  }

  // Fallback to month of payment date
  if (dateStr && /^\d{4}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 7);
  }

  return currentMonth;
}

/**
 * Merges new items into existing list, de-duplicating by transaction ID.
 * Preserves existing 'recorded' status on previous items.
 *
 * @param {Object[]} existingItems
 * @param {Object[]} newItems
 * @returns {Object[]}
 */
export function mergeInboxItems(existingItems = [], newItems = []) {
  const map = new Map();
  // Existing items first
  for (const item of existingItems) {
    if (item && item.txnId) {
      map.set(item.txnId, { ...item });
    }
  }

  // Overlay new items (preserving recorded flag if already recorded)
  for (const item of newItems) {
    if (!item || !item.txnId) continue;
    const prev = map.get(item.txnId);
    if (prev) {
      map.set(item.txnId, {
        ...item,
        recorded: prev.recorded || false,
        recordedPaymentId: prev.recordedPaymentId || null,
        recordedMonth: prev.recordedMonth || null,
        recordedCustomerId: prev.recordedCustomerId || null
      });
    } else {
      map.set(item.txnId, { ...item });
    }
  }

  // Return sorted newest first
  return Array.from(map.values()).sort((a, b) => {
    const da = a.datetimeIso || a.date || '';
    const db = b.datetimeIso || b.date || '';
    return db.localeCompare(da) || (b.txnId || '').localeCompare(a.txnId || '');
  });
}

/**
 * Filters items according to active search, direction, status, and date filters.
 *
 * @param {Object[]} items
 * @param {Object} filters
 * @param {Object} state
 * @param {Date} [referenceDate]
 * @returns {Object[]}
 */
export function filterInboxItems(items = [], filters = {}, state = null, referenceDate = new Date()) {
  const query = (filters.query || '').trim().toLowerCase();
  const direction = filters.direction || 'all';
  const status = filters.status || 'all';
  const dateRange = filters.dateRange || 'all';
  const todayStr = dateKey(referenceDate);
  const currentMonthStr = todayStr.slice(0, 7);

  return items.filter(item => {
    // 1. Direction filter
    if (direction !== 'all') {
      if (item.direction?.toLowerCase() !== direction.toLowerCase()) return false;
    }

    // 2. Status filter
    if (status === 'recorded') {
      const isRec = item.recorded || (state && item.txnId && findDuplicatePaymentReference(state, item.txnId));
      if (!isRec) return false;
    } else if (status === 'unrecorded') {
      const isRec = item.recorded || (state && item.txnId && findDuplicatePaymentReference(state, item.txnId));
      if (isRec || item.direction !== 'Received') return false;
    } else if (status === 'review') {
      if (item.status !== 'Needs review') return false;
    }

    // 3. Date filter
    const itemDate = item.date || (item.datetimeIso ? item.datetimeIso.slice(0, 10) : '');
    if (dateRange === 'today') {
      if (itemDate !== todayStr) return false;
    } else if (dateRange === 'month') {
      if (!itemDate.startsWith(currentMonthStr)) return false;
    }

    // 4. Query search
    if (query) {
      const matchTxn = (item.txnId || '').toLowerCase().includes(query);
      const matchSender = (item.senderName || '').toLowerCase().includes(query) || (item.senderNumber || '').includes(query);
      const matchReceiver = (item.receiverName || '').toLowerCase().includes(query) || (item.receiverNumber || '').includes(query);
      const matchAmount = String(item.amount || '').includes(query);
      if (!matchTxn && !matchSender && !matchReceiver && !matchAmount) return false;
    }

    return true;
  });
}

/**
 * Records an incoming Easypaisa payment against a customer's monthly bill.
 * Uses core addPayment and strictly checks for duplicate transaction references.
 *
 * @param {Object} params
 * @param {Object} params.state Live CRM state
 * @param {Object} params.txn Parsed inbox transaction
 * @param {string} params.customerId
 * @param {string} params.month Target month 'YYYY-MM'
 * @param {Date} [params.referenceDate]
 * @returns {{ nextState: Object, payment: Object, txn: Object }}
 */
export function recordInboxPayment({ state, txn, customerId, month, referenceDate = new Date() }) {
  if (!state || !Array.isArray(state.customers)) {
    throw new Error('Invalid app state');
  }
  if (!txn || !txn.txnId) {
    throw new Error('Invalid transaction record: missing transaction ID');
  }
  const amount = Number(txn.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid transaction amount for payment recording');
  }

  // Deduplication check: check if this transaction ID was already recorded anywhere in CRM ledger
  const dup = findDuplicatePaymentReference(state, txn.txnId);
  if (dup) {
    throw new Error(`Transaction ${txn.txnId} was already recorded for #${dup.customerNumber} ${dup.customerName} in ${dup.month}.`);
  }

  const customer = state.customers.find(c => c.id === customerId);
  if (!customer) {
    throw new Error('Selected customer not found in CRM');
  }

  const targetDate = txn.date || dateKey(referenceDate);
  const targetMonth = month || findCandidateBillMonth(customer, targetDate, referenceDate);

  const paymentFields = {
    date: targetDate,
    amount: amount,
    method: 'Easypaisa',
    paidBy: (txn.senderName || customer.name).slice(0, 100),
    transactionId: txn.txnId
  };

  const nextState = addPayment(state, customerId, targetMonth, paymentFields, referenceDate);

  const updatedCustomer = nextState.customers.find(c => c.id === customerId);
  const targetBill = updatedCustomer?.bills?.find(b => b.month === targetMonth);
  const recordedPayment = targetBill?.payments?.find(p => p.transactionId === txn.txnId) ||
    targetBill?.payments?.[targetBill.payments.length - 1];

  const updatedTxn = {
    ...txn,
    recorded: true,
    recordedPaymentId: recordedPayment?.id || null,
    recordedMonth: targetMonth,
    recordedCustomerId: customerId
  };

  return {
    nextState,
    payment: recordedPayment,
    txn: updatedTxn
  };
}

/**
 * Controller class that manages the DOM lifecycle for #easypaisaView.
 */
export class PaymentsInboxController {
  constructor(options = {}) {
    this.options = options;
    this.container = null;
    this.items = [];
    this.filters = {
      query: '',
      direction: 'all',
      status: 'all',
      dateRange: 'all'
    };
    this.selectedCustomerMatches = new Map(); // txnId -> customerId override
  }

  init() {
    this.container = document.getElementById('easypaisaView');
    if (!this.container) return;

    this.items = loadInboxItems();
    this.render();
    this.bindEvents();

    // Re-render when route changes to #/easypaisa
    window.addEventListener('hashchange', () => {
      if (window.location.hash.includes('easypaisa')) {
        this.refresh();
      }
    });
  }

  getState() {
    if (typeof this.options.getState === 'function') {
      return this.options.getState();
    }
    if (window.quickCollectModalController?.getState) {
      return window.quickCollectModalController.getState();
    }
    return null;
  }

  commitState(nextState) {
    if (typeof this.options.onSaveState === 'function') {
      this.options.onSaveState(nextState);
      return;
    }
    if (window.quickCollectModalController?.commitState) {
      window.quickCollectModalController.commitState(nextState);
    }
  }

  notify(message, opts = {}) {
    if (typeof window.toast === 'function') {
      window.toast(message, opts);
    } else {
      console.log(`[Inbox Toast] ${message}`);
    }
  }

  async confirm(opts) {
    if (typeof window.appConfirm === 'function') {
      return await window.appConfirm(opts);
    }
    return window.confirm(opts.message || 'Are you sure?');
  }

  refresh() {
    this.items = loadInboxItems();
    this.render();
  }

  async syncSheet() {
    const settings = getInboxSettings();
    if (!settings.sheetUrl) {
      this.openSettingsModal();
      this.notify('Please enter your Google Sheet published CSV link first.', { type: 'info', title: 'Setup Needed' });
      return;
    }

    const syncBtn = this.container.querySelector('#easypaisaSyncBtn');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.textContent = 'Syncing...';
    }

    try {
      this.notify('Fetching Easypaisa sheet CSV...', { type: 'info' });
      const resp = await fetch(settings.sheetUrl, { cache: 'no-cache' });
      if (!resp.ok) {
        throw new Error(`Failed to fetch sheet (HTTP ${resp.status})`);
      }
      const csvText = await resp.text();
      const parsedRows = parseEasypaisaCsv(csvText, { ownerNumber: settings.ownerNumber });

      if (!parsedRows.length) {
        this.notify('Sheet reached, but no transaction rows were found.', { type: 'warning' });
        return;
      }

      const merged = mergeInboxItems(this.items, parsedRows);
      const addedCount = merged.length - this.items.length;
      this.items = merged;
      saveInboxItems(this.items);
      this.render();

      this.notify(`Synced ${parsedRows.length} transactions from Google Sheet (${addedCount} new).`, {
        type: 'success',
        title: 'Sheet Synced'
      });
    } catch (err) {
      this.notify(`Sync failed: ${err.message}`, { type: 'error', title: 'Sync Error' });
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync Sheet';
      }
    }
  }

  render() {
    if (!this.container) return;
    const settings = getInboxSettings();
    const state = this.getState();
    const totals = calculateInboxTotals(this.items);
    const filteredItems = filterInboxItems(this.items, this.filters, state);
    const customers = state?.customers?.filter(c => !c.archived) || [];

    this.container.innerHTML = `
      <div class="easypaisa-inbox-shell">
        <!-- Top Action Bar -->
        <div class="easypaisa-top-bar">
          <div class="easypaisa-top-actions">
            <button type="button" id="easypaisaSyncBtn" class="primary-button easypaisa-btn-sync">
              <span aria-hidden="true">↻</span> Sync Sheet
            </button>
            <button type="button" id="easypaisaImportManualBtn" class="secondary-button">
              <span aria-hidden="true">📋</span> Paste / CSV
            </button>
            <button type="button" id="easypaisaSettingsBtn" class="secondary-button" title="Configure Sheet URL & Owner Number">
              <span aria-hidden="true">⚙</span> Settings
            </button>
          </div>
        </div>

        <!-- KPI Summary Cards -->
        <div class="easypaisa-kpi-grid">
          <div class="easypaisa-kpi-card highlight-green">
            <div class="kpi-label">Today Received</div>
            <div class="kpi-value">${formatPKR(totals.today.received)}</div>
            <div class="kpi-sub">${totals.today.receivedCount} incoming payment(s)</div>
          </div>
          <div class="easypaisa-kpi-card highlight-blue">
            <div class="kpi-label">Today Sent</div>
            <div class="kpi-value">${formatPKR(totals.today.sent)}</div>
            <div class="kpi-sub">${totals.today.sentCount} outgoing transfer(s)</div>
          </div>
          <div class="easypaisa-kpi-card">
            <div class="kpi-label">This Month Received</div>
            <div class="kpi-value">${formatPKR(totals.month.received)}</div>
            <div class="kpi-sub">${totals.month.receivedCount} incoming transfer(s)</div>
          </div>
          <div class="easypaisa-kpi-card">
            <div class="kpi-label">Inbox Status</div>
            <div class="kpi-value">${totals.total.unrecordedCount} Pending</div>
            <div class="kpi-sub">${totals.total.totalCount} total (${totals.total.needsReviewCount} review)</div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="easypaisa-filter-toolbar">
          <div class="filter-search-group">
            <input type="search" id="easypaisaSearchInput" class="easypaisa-search-input" placeholder="Search Txn ID, customer, phone, or amount..." value="${escapeHtml(this.filters.query)}">
          </div>
          <div class="filter-selects-group">
            <select id="easypaisaFilterDirection" class="table-filter-select">
              <option value="all" ${this.filters.direction === 'all' ? 'selected' : ''}>All Directions</option>
              <option value="Received" ${this.filters.direction === 'Received' ? 'selected' : ''}>Received (Incoming)</option>
              <option value="Sent" ${this.filters.direction === 'Sent' ? 'selected' : ''}>Sent (Outgoing)</option>
            </select>
            <select id="easypaisaFilterStatus" class="table-filter-select">
              <option value="all" ${this.filters.status === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="unrecorded" ${this.filters.status === 'unrecorded' ? 'selected' : ''}>Unrecorded Only</option>
              <option value="recorded" ${this.filters.status === 'recorded' ? 'selected' : ''}>Recorded on Ledger</option>
              <option value="review" ${this.filters.status === 'review' ? 'selected' : ''}>Needs Review</option>
            </select>
            <select id="easypaisaFilterDate" class="table-filter-select">
              <option value="all" ${this.filters.dateRange === 'all' ? 'selected' : ''}>All Dates</option>
              <option value="today" ${this.filters.dateRange === 'today' ? 'selected' : ''}>Today</option>
              <option value="month" ${this.filters.dateRange === 'month' ? 'selected' : ''}>This Month</option>
            </select>
            ${(this.filters.query || this.filters.direction !== 'all' || this.filters.status !== 'all' || this.filters.dateRange !== 'all')
              ? '<button type="button" id="easypaisaClearFiltersBtn" class="secondary-button table-filter-clear">Clear</button>'
              : ''}
          </div>
        </div>

        <!-- Transactions Container -->
        <div class="easypaisa-list-container">
          ${filteredItems.length === 0
            ? this.renderEmptyState()
            : this.renderTransactionsList(filteredItems, customers, state)}
        </div>
      </div>

      <!-- Settings Dialog -->
      <dialog id="easypaisaSettingsModal" class="modal-dialog easypaisa-modal">
        <div class="modal-heading">
          <h2>Easypaisa Sheet Settings</h2>
          <button type="button" class="close-btn" data-close-settings aria-label="Close">✕</button>
        </div>
        <form id="easypaisaSettingsForm" class="easypaisa-form">
          <div class="form-group">
            <label for="settingSheetUrl">Published Google Sheet CSV URL</label>
            <input type="url" id="settingSheetUrl" name="sheetUrl" class="form-input" placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv" value="${escapeHtml(settings.sheetUrl)}">
            <small class="form-hint">Publish your Google Sheet: File &gt; Share &gt; Publish to web &gt; Select 'Easypaisa Transactions' sheet tab &gt; CSV.</small>
          </div>
          <div class="form-group">
            <label for="settingOwnerNumber">Your Registered Easypaisa Mobile Number</label>
            <input type="tel" id="settingOwnerNumber" name="ownerNumber" class="form-input" placeholder="Your Easypaisa number, e.g. 03XX-XXXXXXX" value="${escapeHtml(settings.ownerNumber)}" required>
            <small class="form-hint">Used to automatically classify transfers as Received vs Sent.</small>
          </div>
          <div class="modal-actions">
            <button type="submit" class="primary-button">Save Settings</button>
            <button type="button" class="secondary-button" data-close-settings>Cancel</button>
          </div>
        </form>
      </dialog>

      <!-- Manual Import Modal -->
      <dialog id="easypaisaImportModal" class="modal-dialog easypaisa-modal">
        <div class="modal-heading">
          <h2>Import Easypaisa Transactions</h2>
          <button type="button" class="close-btn" data-close-import aria-label="Close">✕</button>
        </div>
        <div class="easypaisa-import-content">
          <div class="import-section">
            <h3>Option A: Paste Notification Email or SMS Text</h3>
            <textarea id="manualPasteInput" class="form-textarea" rows="6" placeholder="Paste standard Easypaisa notification email or SMS text here..."></textarea>
            <button type="button" id="manualPasteSubmitBtn" class="primary-button">Parse &amp; Add</button>
          </div>
          <hr class="modal-separator">
          <div class="import-section">
            <h3>Option B: Upload CSV File</h3>
            <input type="file" id="csvFileInput" accept=".csv,text/csv" class="form-file-input">
          </div>
          <hr class="modal-separator">
          <div class="import-section">
            <h3>Option C: Upload PDF Statement</h3>
            <input type="file" id="pdfFileInput" accept=".pdf,application/pdf" class="form-file-input">
            <small class="form-hint">Extracts transaction rows from Easypaisa monthly statements.</small>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary-button" data-close-import>Close</button>
        </div>
      </dialog>
    `;
  }

  renderEmptyState() {
    return `
      <div class="easypaisa-empty-state">
        <div class="empty-icon">📥</div>
        <h3>No Easypaisa transactions found</h3>
        <p>Sync your Google Sheet or paste an Easypaisa email to populate the inbox.</p>
        <div class="empty-actions">
          <button type="button" class="primary-button" id="emptySyncBtn">Sync Sheet</button>
          <button type="button" class="secondary-button" id="emptyPasteBtn">Paste Email / SMS</button>
        </div>
      </div>
    `;
  }

  renderTransactionsList(items, customers, state) {
    return `
      <div class="easypaisa-table-card">
        <table class="easypaisa-table">
          <thead>
            <tr>
              <th>Status / Date</th>
              <th>Transaction ID</th>
              <th>Direction</th>
              <th>Amount</th>
              <th>Counterparty</th>
              <th>Customer Matching</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => this.renderTransactionRow(item, customers, state)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderTransactionRow(item, customers, state) {
    const isRecorded = item.recorded || (state && item.txnId && findDuplicatePaymentReference(state, item.txnId));
    const isReceived = item.direction === 'Received';
    const isNeedsReview = item.status === 'Needs review';

    // Resolve matching customer: either overridden in UI, auto-matched by phone, or matched via existing recorded payment
    let matchedCustomer = null;
    const overriddenId = this.selectedCustomerMatches.get(item.txnId);
    if (overriddenId) {
      matchedCustomer = customers.find(c => c.id === overriddenId);
    } else if (isRecorded && typeof isRecorded === 'object' && isRecorded.customerId) {
      matchedCustomer = customers.find(c => c.id === isRecorded.customerId);
    } else if (item.recordedCustomerId) {
      matchedCustomer = customers.find(c => c.id === item.recordedCustomerId);
    } else if (isReceived && item.senderNumber) {
      matchedCustomer = matchCustomerByPhone(item.senderNumber, customers);
    }

    const directionBadge = isReceived
      ? '<span class="badge badge-received">Received</span>'
      : item.direction === 'Sent'
        ? '<span class="badge badge-sent">Sent</span>'
        : '<span class="badge badge-review">Review</span>';

    const statusBadge = isRecorded
      ? '<span class="badge badge-recorded" title="Recorded on CRM ledger">✓ Recorded</span>'
      : isNeedsReview
        ? '<span class="badge badge-review">Needs review</span>'
        : isReceived
          ? '<span class="badge badge-pending">Unrecorded</span>'
          : '<span class="badge badge-sent">Sent Transfer</span>';

    const candidateMonth = matchedCustomer
      ? findCandidateBillMonth(matchedCustomer, item.date || item.datetimeIso?.slice(0, 10))
      : '';

    return `
      <tr class="easypaisa-row ${isRecorded ? 'row-recorded' : ''}" data-txn-id="${escapeHtml(item.txnId)}">
        <td class="col-date">
          <div class="date-primary">${escapeHtml(item.date || item.datetime?.slice(0, 11) || '')}</div>
          <div class="date-secondary">${escapeHtml(item.datetime || '')}</div>
          <div class="row-status-mobile">${statusBadge}</div>
        </td>
        <td class="col-txnid">
          <code class="txnid-badge">${escapeHtml(item.txnId)}</code>
          <div class="txnid-type">${escapeHtml(item.type || '')}</div>
        </td>
        <td class="col-direction">
          ${directionBadge}
        </td>
        <td class="col-amount">
          <strong class="amount-val">${formatPKR(item.amount)}</strong>
          ${item.fee ? `<span class="fee-val">Fee: ${formatPKR(item.fee)}</span>` : ''}
        </td>
        <td class="col-party">
          ${isReceived
            ? `<div><strong>From:</strong> ${escapeHtml(item.senderName || 'Anonymous')}</div><div class="phone-num">${escapeHtml(item.senderNumber || '')}</div>`
            : `<div><strong>To:</strong> ${escapeHtml(item.receiverName || 'Recipient')}</div><div class="phone-num">${escapeHtml(item.receiverNumber || '')}</div>`}
        </td>
        <td class="col-match">
          ${isRecorded
            ? `<div class="matched-cust-badge">✓ #${escapeHtml(matchedCustomer?.customerNumber || '')} ${escapeHtml(matchedCustomer?.name || 'Customer')} (${escapeHtml(item.recordedMonth || candidateMonth)})</div>`
            : isReceived
              ? `<select class="easypaisa-customer-select" data-select-match="${escapeHtml(item.txnId)}" aria-label="Match Customer">
                  <option value="">${matchedCustomer ? `✓ Matched: #${matchedCustomer.customerNumber} ${matchedCustomer.name}` : '-- Link to Customer --'}</option>
                  ${customers.map(c => `<option value="${escapeHtml(c.id)}" ${matchedCustomer?.id === c.id ? 'selected' : ''}>#${escapeHtml(c.customerNumber)} ${escapeHtml(c.name)} (${escapeHtml(c.area || 'No Area')})</option>`).join('')}
                </select>`
              : '<span class="text-muted">—</span>'}
        </td>
        <td class="col-actions">
          ${isRecorded
            ? `<span class="text-success-label">Ledger Updated</span>`
            : isReceived && !isNeedsReview
              ? `<button type="button" class="primary-button btn-record-payment" data-record-txn="${escapeHtml(item.txnId)}">
                  Record Payment
                </button>`
              : isNeedsReview
                ? `<span class="text-muted">Review Required</span>`
                : `<span class="text-muted">Outgoing</span>`}
        </td>
      </tr>
    `;
  }

  bindEvents() {
    if (!this.container) return;

    // Delegated click handler
    this.container.addEventListener('click', async (e) => {
      // Sync button
      if (e.target.closest('#easypaisaSyncBtn, #emptySyncBtn')) {
        this.syncSheet();
        return;
      }

      // Settings Modal open
      if (e.target.closest('#easypaisaSettingsBtn')) {
        this.openSettingsModal();
        return;
      }

      // Settings Modal close
      if (e.target.closest('[data-close-settings]')) {
        this.container.querySelector('#easypaisaSettingsModal')?.close();
        return;
      }

      // Manual Import Modal open
      if (e.target.closest('#easypaisaImportManualBtn, #emptyPasteBtn')) {
        const importModal = this.container.querySelector('#easypaisaImportModal');
        if (typeof importModal?.showModal === 'function') importModal.showModal();
        else importModal?.setAttribute('open', '');
        return;
      }

      // Manual Import Modal close
      if (e.target.closest('[data-close-import]')) {
        this.container.querySelector('#easypaisaImportModal')?.close();
        return;
      }

      // Clear filters
      if (e.target.closest('#easypaisaClearFiltersBtn')) {
        this.filters = { query: '', direction: 'all', status: 'all', dateRange: 'all' };
        this.render();
        return;
      }

      // Manual Paste Submit
      if (e.target.closest('#manualPasteSubmitBtn')) {
        const text = this.container.querySelector('#manualPasteInput')?.value || '';
        if (!text.trim()) {
          this.notify('Please paste email or SMS notification text.', { type: 'warning' });
          return;
        }
        const settings = getInboxSettings();
        const parsed = parseEasypaisaEmails(text, { ownerNumber: settings.ownerNumber });
        if (!parsed.length) {
          this.notify('Could not detect any valid Easypaisa transactions.', { type: 'error' });
          return;
        }
        this.items = mergeInboxItems(this.items, parsed);
        saveInboxItems(this.items);
        const input = this.container.querySelector('#manualPasteInput');
        if (input) input.value = '';
        this.container.querySelector('#easypaisaImportModal')?.close();
        this.render();
        this.notify(`Parsed and added ${parsed.length} transaction(s).`, { type: 'success' });
        return;
      }

      // Record Payment Click
      const btn = e.target.closest('[data-record-txn]');
      if (!btn) return;

      const txnId = btn.dataset.recordTxn;
      const txn = this.items.find(i => i.txnId === txnId);
      if (!txn) return;

      const state = this.getState();
      if (!state) {
        this.notify('Unable to access live CRM state.', { type: 'error' });
        return;
      }

      const customers = state.customers?.filter(c => !c.archived) || [];

      // Determine customer: user-selected or auto-matched
      let customerId = this.selectedCustomerMatches.get(txnId);
      if (!customerId && txn.senderNumber) {
        const matched = matchCustomerByPhone(txn.senderNumber, customers);
        if (matched) customerId = matched.id;
      }

      if (!customerId) {
        this.notify('Please choose a customer from the dropdown first.', { type: 'warning' });
        const row = btn.closest('tr');
        row?.querySelector('.easypaisa-customer-select')?.focus();
        return;
      }

      const customer = customers.find(c => c.id === customerId);
      if (!customer) {
        this.notify('Selected customer not found.', { type: 'error' });
        return;
      }

      const targetDate = txn.date || dateKey(new Date());
      const targetMonth = findCandidateBillMonth(customer, targetDate);

      // Confirm with user
      const ok = await this.confirm({
        title: 'Record Easypaisa Payment',
        message: `Record ${formatPKR(txn.amount)} from #${customer.customerNumber} ${customer.name} for ${targetMonth}? (Txn ID: ${txn.txnId})`,
        confirmLabel: 'Record Payment',
        tone: 'default'
      });
      if (!ok) return;

      btn.disabled = true;
      btn.textContent = 'Recording...';

      try {
        const res = recordInboxPayment({
          state,
          txn,
          customerId,
          month: targetMonth
        });

        // Commit live CRM state
        this.commitState(res.nextState);

        // Update local inbox cache
        this.items = this.items.map(i => i.txnId === txnId ? res.txn : i);
        saveInboxItems(this.items);

        // Provide undo action in toast
        const undoAction = {
          label: 'Undo',
          onAction: () => {
            try {
              const liveState = this.getState();
              if (!liveState) return;
              const undoneState = deletePayment(liveState, customerId, targetMonth, res.payment.id);
              this.commitState(undoneState);

              this.items = this.items.map(i => i.txnId === txnId ? { ...i, recorded: false, recordedPaymentId: null } : i);
              saveInboxItems(this.items);
              this.render();
              this.notify('Payment undone. Ledger restored.', { type: 'info' });
            } catch (err) {
              this.notify(`Undo failed: ${err.message}`, { type: 'error' });
            }
          }
        };

        this.notify(`Payment of ${formatPKR(txn.amount)} recorded for #${customer.customerNumber} ${customer.name} (${targetMonth}).`, {
          type: 'success',
          title: 'Payment Recorded',
          actions: [undoAction]
        });

        this.render();
      } catch (err) {
        this.notify(`Failed to record payment: ${err.message}`, { type: 'error', title: 'Payment Error' });
        btn.disabled = false;
        btn.textContent = 'Record Payment';
      }
    });

    // Delegated change handler
    this.container.addEventListener('change', async (e) => {
      // CSV File Upload
      if (e.target.matches('#csvFileInput')) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const csvText = evt.target.result;
            const settings = getInboxSettings();
            const parsed = parseEasypaisaCsv(csvText, { ownerNumber: settings.ownerNumber });
            if (!parsed.length) {
              this.notify('No valid transaction rows found in CSV.', { type: 'warning' });
              return;
            }
            this.items = mergeInboxItems(this.items, parsed);
            saveInboxItems(this.items);
            this.container.querySelector('#easypaisaImportModal')?.close();
            this.render();
            this.notify(`Imported ${parsed.length} transaction(s) from CSV.`, { type: 'success' });
          } catch (err) {
            this.notify(`CSV import failed: ${err.message}`, { type: 'error' });
          }
        };
        reader.readAsText(file);
        return;
      }

      // PDF Statement Upload
      if (e.target.matches('#pdfFileInput')) {
        const file = e.target.files?.[0];
        if (!file) return;
        this.notify('Processing PDF statement...', { type: 'info' });
        try {
          const text = await extractTextFromPdf(file);
          const settings = getInboxSettings();
          const parsed = parseEasypaisaEmails(text, { ownerNumber: settings.ownerNumber });
          if (!parsed.length) {
            this.notify('No recognizable transactions in PDF.', { type: 'warning' });
            return;
          }
          this.items = mergeInboxItems(this.items, parsed);
          saveInboxItems(this.items);
          this.container.querySelector('#easypaisaImportModal')?.close();
          this.render();
          this.notify(`Imported ${parsed.length} transaction(s) from statement.`, { type: 'success' });
        } catch (err) {
          this.notify(`PDF import error: ${err.message}`, { type: 'error' });
        }
        return;
      }

      // Direction filter
      if (e.target.matches('#easypaisaFilterDirection')) {
        this.filters.direction = e.target.value;
        this.updateListOnly();
        return;
      }

      // Status filter
      if (e.target.matches('#easypaisaFilterStatus')) {
        this.filters.status = e.target.value;
        this.updateListOnly();
        return;
      }

      // Date filter
      if (e.target.matches('#easypaisaFilterDate')) {
        this.filters.dateRange = e.target.value;
        this.updateListOnly();
        return;
      }

      // Customer manual match dropdown change
      const select = e.target.closest('[data-select-match]');
      if (select) {
        const txnId = select.dataset.selectMatch;
        const customerId = select.value;
        if (customerId) {
          this.selectedCustomerMatches.set(txnId, customerId);
        } else {
          this.selectedCustomerMatches.delete(txnId);
        }
      }
    });

    // Delegated input handler for search
    this.container.addEventListener('input', (e) => {
      if (e.target.matches('#easypaisaSearchInput')) {
        this.filters.query = e.target.value;
        this.updateListOnly();
      }
    });

    // Delegated submit handler for settings
    this.container.addEventListener('submit', (e) => {
      if (e.target.matches('#easypaisaSettingsForm')) {
        e.preventDefault();
        const form = e.target;
        const sheetUrl = form.sheetUrl.value.trim();
        const ownerNumber = form.ownerNumber.value.trim();
        saveInboxSettings({ sheetUrl, ownerNumber });
        this.container.querySelector('#easypaisaSettingsModal')?.close();
        this.notify('Settings saved. You can now sync your Google Sheet.', { type: 'success' });
        this.render();
      }
    });
  }



  openSettingsModal() {
    const modal = this.container?.querySelector('#easypaisaSettingsModal');
    if (modal) {
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    }
  }

  updateListOnly() {
    const state = this.getState();
    const customers = state?.customers?.filter(c => !c.archived) || [];
    const filteredItems = filterInboxItems(this.items, this.filters, state);
    const listContainer = this.container?.querySelector('.easypaisa-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = filteredItems.length === 0
      ? this.renderEmptyState()
      : this.renderTransactionsList(filteredItems, customers, state);
  }
}

/**
 * Helper to extract plain text from PDF statement files.
 * Uses window.pdfjsLib if available, or simple binary string scan.
 */
async function extractTextFromPdf(file) {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      fullText += strings.join(' ') + '\n';
    }
    return fullText;
  }

  // Fallback: simple text decoding from ArrayBuffer
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(buffer);
  // Match text objects inside stream (...)Tj
  const textMatches = [...raw.matchAll(/\((.*?)\)\s*Tj/g)].map(m => m[1]);
  if (textMatches.length > 0) {
    return textMatches.join(' ');
  }
  return raw;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Setup function that bootstraps Payments Inbox module on the page.
 */
export function setupPaymentsInbox(options = {}) {
  const controller = new PaymentsInboxController(options);
  controller.init();
  if (typeof window !== 'undefined') {
    window.paymentsInboxController = controller;
  }
  return controller;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setupPaymentsInbox());
  } else {
    setupPaymentsInbox();
  }
}
