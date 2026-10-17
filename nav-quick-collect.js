/**
 * nav-quick-collect.js - 2-Tap Quick Collect Mobile Field Flow (agent2 - shahdara-mobile-nav)
 *
 * Designed for field collection rounds and on-the-spot subscriber billing in Shahdara:
 * 1. Tap 1: Open collection from bottom nav -> fast searchable customer picker prioritizing accounts with dues.
 * 2. Tap 2: Tap customer -> opens sheet prefilled with remaining balance, today's PKT date, and last-used payment method.
 * 3. Confirm: Creates immutable payment receipt via addPayment() from core.js.
 * 4. Success: Displays receipt card with instant 1-tap WhatsApp receipt dispatch, print slip, and next-customer collection loop.
 */

import {
  addPayment,
  calculatePaymentAllocations,
  derivedBillStatus,
  monthsForHistory,
  formatPKR,
  PAYMENT_METHODS
} from './core.js';
import { formatWhatsAppUrl } from './form-validation.js';
import {
  isReceiptShared,
  markReceiptShared,
  renderReceiptSharedBadgeHtml
} from './nav-quick-profile.js';

export const QUICK_COLLECT_STORAGE_KEY = 'shahdara_quick_collect_last_used_v1';
export const QUICK_COLLECT_AUDIT_KEY = 'shahdara_quick_collect_audits_v1';

/**
 * Returns current date formatted as YYYY-MM-DD in Pakistan Standard Time (PKT).
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getPakistanLocalDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Helper to escape HTML characters in strings for safe rendering.
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
 * Retrieves unarchived customers formatted for quick field collection.
 * Sorted with largest dues first for fast field recovery.
 *
 * @param {Object} state - Billing state
 * @param {string} [query=''] - Search term (matches name, number, phone, area, mohalla)
 * @param {('all-dues'|'high-dues'|'all')} [filterType='all-dues']
 * @param {Date} [referenceDate=new Date()]
 * @returns {Array<Object>}
 */
export function getPendingCollectionCustomers(state, query = '', filterType = 'all-dues', referenceDate = new Date()) {
  if (!state || !Array.isArray(state.customers)) return [];
  const allocations = calculatePaymentAllocations(state);
  const currentMonth = monthsForHistory(referenceDate)[0];
  const normalizedQuery = String(query ?? '').normalize('NFKC').trim().toLowerCase();

  const list = [];
  for (const customer of state.customers) {
    if (customer.archived) continue;

    let totalDuesCents = 0;
    let earliestUnpaidMonth = null;
    let currentMonthBalanceCents = 0;
    const bills = [...(customer.bills ?? [])].sort((a, b) => a.month.localeCompare(b.month));

    for (const bill of bills) {
      const summary = allocations.forMonth(customer.id, bill.month);
      const balance = summary?.balanceDueCents;
      if (typeof balance === 'number' && balance > 0) {
        totalDuesCents += balance;
        if (!earliestUnpaidMonth) {
          earliestUnpaidMonth = bill.month;
        }
      }
      if (bill.month === currentMonth && typeof balance === 'number') {
        currentMonthBalanceCents = balance;
      }
    }

    const targetMonth = earliestUnpaidMonth || currentMonth;
    const targetSummary = allocations.forMonth(customer.id, targetMonth);
    const targetDueCents = targetSummary?.balanceDueCents ?? 0;

    let lastMethod = 'Cash';
    let lastPaidBy = '';
    const allPayments = bills.flatMap(b => b.payments ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    if (allPayments.length > 0) {
      const lastP = allPayments[allPayments.length - 1];
      if (lastP.method && PAYMENT_METHODS.includes(lastP.method)) {
        lastMethod = lastP.method;
      }
      if (lastP.paidBy) {
        lastPaidBy = lastP.paidBy;
      }
    }

    const totalDues = Math.max(0, totalDuesCents / 100);
    const targetDue = Math.max(0, targetDueCents / 100);

    // Apply filter criteria
    if (filterType === 'all-dues' && totalDues <= 0) continue;
    if (filterType === 'high-dues' && totalDues < 2000) continue;

    // Apply search query
    if (normalizedQuery) {
      const numStr = String(customer.customerNumber ?? '');
      const match =
        customer.name.toLowerCase().includes(normalizedQuery) ||
        numStr.includes(normalizedQuery) ||
        `#${numStr}`.includes(normalizedQuery) ||
        (customer.phone && customer.phone.toLowerCase().includes(normalizedQuery)) ||
        (customer.area && customer.area.toLowerCase().includes(normalizedQuery)) ||
        (customer.mohalla && customer.mohalla.toLowerCase().includes(normalizedQuery)) ||
        (customer.address && customer.address.toLowerCase().includes(normalizedQuery));
      if (!match) continue;
    }

    list.push({
      id: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
      phone: customer.phone || '',
      area: customer.area || 'Unassigned',
      mohalla: customer.mohalla || '',
      address: customer.address || '',
      serviceStatus: customer.serviceStatus || 'not-set',
      totalDues,
      targetMonth,
      targetDue,
      currentMonthBalance: Math.max(0, currentMonthBalanceCents / 100),
      lastPaymentMethod: lastMethod,
      lastPaidBy,
      billsCount: bills.length
    });
  }

  // Sort: highest total dues first, then customer number ascending
  list.sort((a, b) => {
    if (b.totalDues !== a.totalDues) {
      return b.totalDues - a.totalDues;
    }
    return a.customerNumber - b.customerNumber;
  });

  return list;
}

/**
 * Computes default prefilled values for a 2-tap payment collection sheet.
 *
 * @param {Object} state
 * @param {string} customerId
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object}
 */
export function getCustomerPaymentDefaults(state, customerId, referenceDate = new Date()) {
  if (!state || !Array.isArray(state.customers)) {
    throw new Error('State must contain customers list.');
  }
  const customer = state.customers.find(c => c.id === customerId);
  if (!customer) {
    throw new Error(`Customer ${customerId} not found.`);
  }
  if (customer.archived) {
    throw new Error('Archived customers cannot receive payments. Unarchive the customer first.');
  }

  const allocations = calculatePaymentAllocations(state);
  const currentMonth = monthsForHistory(referenceDate)[0];
  const bills = [...(customer.bills ?? [])].sort((a, b) => a.month.localeCompare(b.month));

  let earliestUnpaidMonth = null;
  let totalDuesCents = 0;
  for (const bill of bills) {
    const summary = allocations.forMonth(customer.id, bill.month);
    const balance = summary?.balanceDueCents;
    if (typeof balance === 'number' && balance > 0) {
      totalDuesCents += balance;
      if (!earliestUnpaidMonth) {
        earliestUnpaidMonth = bill.month;
      }
    }
  }

  const targetMonth = earliestUnpaidMonth || currentMonth;
  const targetSummary = allocations.forMonth(customer.id, targetMonth);
  const targetDueCents = targetSummary?.balanceDueCents;
  const targetDue = (typeof targetDueCents === 'number' && targetDueCents > 0) ? (targetDueCents / 100) : 0;
  const totalDues = Math.max(0, totalDuesCents / 100);

  // Suggested amount is remaining balance due on the target bill (or total dues if target due is 0)
  let suggestedAmount = targetDue;
  if (suggestedAmount <= 0 && totalDues > 0) {
    suggestedAmount = totalDues;
  }
  if (suggestedAmount <= 0 && typeof customer.monthlySellingAmount === 'number' && customer.monthlySellingAmount > 0) {
    suggestedAmount = customer.monthlySellingAmount;
  }

  // Find customer's last-used payment method & payer note
  let lastMethod = 'Cash';
  let lastPaidBy = '';
  const allPayments = bills.flatMap(b => b.payments ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if (allPayments.length > 0) {
    const lastP = allPayments[allPayments.length - 1];
    if (lastP.method && PAYMENT_METHODS.includes(lastP.method)) {
      lastMethod = lastP.method;
    }
    if (lastP.paidBy) {
      lastPaidBy = lastP.paidBy;
    }
  }

  // Check if collector stored an explicit device default method
  try {
    const savedMethod = localStorage.getItem(QUICK_COLLECT_STORAGE_KEY);
    if (savedMethod && PAYMENT_METHODS.includes(savedMethod) && allPayments.length === 0) {
      lastMethod = savedMethod;
    }
  } catch {
    // Ignore storage errors in test or private mode
  }

  return {
    customer,
    customerId: customer.id,
    customerNumber: customer.customerNumber,
    name: customer.name,
    phone: customer.phone || '',
    area: customer.area || 'Unassigned',
    targetMonth,
    suggestedAmount,
    balanceDue: targetDue,
    totalDues,
    todayDate: getPakistanLocalDate(referenceDate),
    defaultMethod: lastMethod,
    lastPaidBy
  };
}

/**
 * Executes confirmed quick collection and creates the immutable receipt record.
 *
 * @param {Object} state
 * @param {Object} fields - { customerId, month, amount, date, method, paidBy }
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ nextState: Object, receipt: Object }}
 */
export function executeQuickCollection(state, {
  customerId,
  month,
  amount,
  date,
  method,
  paidBy
}, referenceDate = new Date()) {
  if (!customerId) throw new Error('Customer ID is required.');
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw new Error('Enter a valid collected amount greater than zero.');
  }

  const customer = state?.customers?.find(c => c.id === customerId);
  if (!customer) {
    throw new Error(`Customer ${customerId} not found.`);
  }
  if (customer.archived) {
    throw new Error('Archived customers cannot receive payments. Unarchive the customer first.');
  }

  const pDate = date || getPakistanLocalDate(referenceDate);
  const targetMonth = month || monthsForHistory(referenceDate)[0];
  const pMethod = method || 'Cash';
  if (!PAYMENT_METHODS.includes(pMethod)) {
    throw new Error(`Choose a valid payment method from: ${PAYMENT_METHODS.join(', ')}`);
  }

  // Save last used method preference to device storage
  try {
    localStorage.setItem(QUICK_COLLECT_STORAGE_KEY, pMethod);
  } catch {
    // Ignore storage issues
  }

  // Create immutable payment entry through core function
  const nextState = addPayment(state, customerId, targetMonth, {
    date: pDate,
    amount: numAmount,
    method: pMethod,
    paidBy: paidBy ? String(paidBy).trim() : undefined
  }, referenceDate);

  // Compute updated balance & allocations
  const newAllocations = calculatePaymentAllocations(nextState);
  const updatedCustomer = nextState.customers.find(c => c.id === customerId);
  const updatedMonthSummary = newAllocations.forMonth(customerId, targetMonth);
  const newBalanceDue = updatedMonthSummary?.balanceDueCents ? Math.max(0, updatedMonthSummary.balanceDueCents / 100) : 0;

  let newTotalDuesCents = 0;
  for (const b of (updatedCustomer?.bills ?? [])) {
    const s = newAllocations.forMonth(customerId, b.month);
    if (s?.balanceDueCents && s.balanceDueCents > 0) {
      newTotalDuesCents += s.balanceDueCents;
    }
  }
  const newTotalDues = Math.max(0, newTotalDuesCents / 100);

  // Resolve receipt identifier
  const targetBill = updatedCustomer?.bills?.find(b => b.month === targetMonth);
  const newPayment = targetBill?.payments?.[targetBill.payments.length - 1];
  const paymentId = newPayment?.id || `qc-${Date.now()}`;
  const receiptNumber = `RCPT-${customer.customerNumber}-${targetMonth.replace('-', '')}-${String(targetBill?.payments?.length || 1).padStart(2, '0')}`;

  const receipt = {
    success: true,
    paymentId,
    receiptNumber,
    customerId: customer.id,
    customerNumber: customer.customerNumber,
    customerName: customer.name,
    phone: customer.phone || '',
    area: customer.area || 'Unassigned',
    month: targetMonth,
    date: pDate,
    amount: numAmount,
    method: pMethod,
    paidBy: paidBy ? String(paidBy).trim() : '',
    newBalanceDue,
    newTotalDues,
    isSettled: newTotalDues <= 0,
    collectedAt: new Date().toISOString()
  };

  // Persist quick collection audit log
  try {
    const audits = JSON.parse(localStorage.getItem(QUICK_COLLECT_AUDIT_KEY) || '[]');
    audits.unshift(receipt);
    localStorage.setItem(QUICK_COLLECT_AUDIT_KEY, JSON.stringify(audits.slice(0, 100)));
  } catch {
    // Ignore storage issues
  }

  return { nextState, receipt };
}

/**
 * Builds bilingual (Urdu & English) WhatsApp payment receipt draft.
 *
 * @param {Object} receipt
 * @returns {{ text: string, url: string }}
 */
export function formatQuickCollectWhatsAppReceipt(receipt) {
  const amountStr = Number(receipt.amount).toLocaleString('en-PK');
  const balanceStr = Number(receipt.newTotalDues || receipt.newBalanceDue || 0).toLocaleString('en-PK');
  const statusUrdu = (receipt.newTotalDues <= 0) ? 'مکمل ادا شدہ (PAID IN FULL)' : 'جزوی ادائیگی (PARTIAL)';

  const lines = [
    `*SHAHDARA FIBER NETWORK & ISP BILLING*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `*PAYMENT RECEIPT / ادائیگی کی رسید*`,
    ``,
    `🧾 *Receipt No:* ${receipt.receiptNumber}`,
    `📅 *Date:* ${receipt.date}`,
    `👤 *Customer:* ${receipt.customerName} (#${receipt.customerNumber})`,
    receipt.phone ? `📱 *Phone:* ${receipt.phone}` : null,
    `📍 *Area:* ${receipt.area}`,
    `🗓️ *Billing Month:* ${receipt.month}`,
    ``,
    `💵 *Amount Received:* PKR ${amountStr}`,
    `💳 *Payment Method:* ${receipt.method}`,
    receipt.paidBy ? `✍️ *Paid By:* ${receipt.paidBy}` : null,
    ``,
    `⚖️ *Remaining Balance:* PKR ${balanceStr}`,
    `📌 *Status:* ${statusUrdu}`,
    ``,
    `Shukriya! Thank you for your prompt payment.`,
    `Shahdara NOC & Field Billing Operations`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`
  ];

  const text = lines.filter(Boolean).join('\n');
  const wa = formatWhatsAppUrl(receipt.phone, text);
  return { text, url: wa.url || '', validPhone: wa.validPhone, formattedPhone: wa.formattedPhone };
}

/**
 * Generates customer picker list markup.
 *
 * @param {Array<Object>} customers
 * @param {string|null} [activeCustomerId=null]
 * @returns {string}
 */
export function renderQuickCollectCustomerListHtml(customers, activeCustomerId = null) {
  if (!customers || customers.length === 0) {
    return `
      <div class="qc-empty-state" role="status">
        <span class="qc-empty-icon" aria-hidden="true">🔍</span>
        <h4>No matching accounts found</h4>
        <p>Try searching by customer name, 3-digit phone, or clear filters.</p>
      </div>
    `;
  }

  return customers.map(c => {
    const isSelected = c.id === activeCustomerId;
    const hasDues = c.totalDues > 0;
    const dueClass = hasDues ? 'qc-has-dues' : 'qc-settled';
    const dueLabel = hasDues
      ? `<strong class="qc-due-val">PKR ${c.totalDues.toLocaleString('en-PK')}</strong><span class="qc-due-tag">DUE</span>`
      : `<strong class="qc-due-val qc-val-settled">PKR 0</strong><span class="qc-settled-tag">SETTLED</span>`;

    return `
      <button type="button"
              class="qc-customer-card ${dueClass} ${isSelected ? 'is-selected' : ''}"
              data-customer-id="${escapeHtml(c.id)}"
              aria-label="Pick ${escapeHtml(c.name)} with dues PKR ${c.totalDues}">
        <div class="qc-card-left">
          <span class="qc-cust-num">#${escapeHtml(String(c.customerNumber))}</span>
          <div class="qc-cust-info">
            <span class="qc-cust-name">${escapeHtml(c.name)}</span>
            <span class="qc-cust-meta">${escapeHtml(c.area)}${c.phone ? ' · ' + escapeHtml(c.phone) : ''}</span>
          </div>
        </div>
        <div class="qc-card-right">
          ${dueLabel}
        </div>
      </button>
    `;
  }).join('');
}

/**
 * Generates receipt confirmation card markup for the success screen.
 *
 * @param {Object} receipt
 * @returns {string}
 */
export function renderQuickCollectReceiptCardHtml(receipt) {
  const isSettled = receipt.newTotalDues <= 0;
  const shared = isReceiptShared(receipt.id);
  const sharedBadge = renderReceiptSharedBadgeHtml(Boolean(shared?.shared), shared);
  return `
    <div class="qc-receipt-card" role="region" aria-label="Payment Receipt Slip">
      <div class="qc-receipt-header">
        <span class="qc-receipt-badge ${isSettled ? 'settled' : 'partial'}">
          ${isSettled ? '✓ Settle in Full' : '⏳ Partial Payment'}
        </span>
        ${sharedBadge}
        <span class="qc-receipt-id">${escapeHtml(receipt.receiptNumber)}</span>
      </div>

      <div class="qc-receipt-amount-row">
        <span class="qc-receipt-label">Amount Collected</span>
        <strong class="qc-receipt-amount">PKR ${Number(receipt.amount).toLocaleString('en-PK')}</strong>
      </div>

      <div class="qc-receipt-grid">
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Customer</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.customerName)} (#${escapeHtml(String(receipt.customerNumber))})</strong>
        </div>
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Date &amp; Method</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.date)} · ${escapeHtml(receipt.method)}</strong>
        </div>
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Area / Location</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.area)}</strong>
        </div>
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Remaining Balance</span>
          <strong class="qc-meta-val ${receipt.newTotalDues > 0 ? 'has-balance' : 'zero-balance'}">
            PKR ${Number(receipt.newTotalDues).toLocaleString('en-PK')}
          </strong>
        </div>
        ${receipt.paidBy ? `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Paid By / Note</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.paidBy)}</strong>
        </div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Sets up and manages the Quick Collect Modal Dialog controller.
 *
 * @param {Object} options
 * @param {Function} options.getState
 * @param {Function} options.onSaveState
 * @param {Function} options.onToast
 * @param {Function} [options.onSelectCustomer]
 * @returns {Object} Controller with { open, close, selectAndOpen, isOpen }
 */
export function setupQuickCollectModal({
  getState,
  onSaveState,
  onToast,
  onSelectCustomer
}) {
  const modal = document.getElementById('quickCollectModal');
  if (!modal) {
    return {
      open: () => {},
      close: () => {},
      selectAndOpen: () => {},
      isOpen: () => false
    };
  }

  // Elements
  const closeBtn = document.getElementById('closeQuickCollectModalBtn');
  const stepPick = document.getElementById('quickCollectStepPick');
  const stepForm = document.getElementById('quickCollectStepForm');
  const stepSuccess = document.getElementById('quickCollectStepSuccess');

  const searchInput = document.getElementById('quickCollectSearchInput');
  const searchClearBtn = document.getElementById('quickCollectSearchClearBtn');
  const customerListContainer = document.getElementById('quickCollectCustomerList');
  const filterChips = modal.querySelectorAll('.quick-collect-filter-chip');
  const duesCountEl = document.getElementById('quickCollectDuesCount');
  const highDuesCountEl = document.getElementById('quickCollectHighDuesCount');
  const allCountEl = document.getElementById('quickCollectAllCount');

  // Form Elements
  const backToPickBtn = document.getElementById('quickCollectBackToPickBtn');
  const customerHeader = document.getElementById('quickCollectCustomerHeader');
  const paymentForm = document.getElementById('quickCollectPaymentForm');
  const amountInput = document.getElementById('quickCollectAmountInput');
  const dateInput = document.getElementById('quickCollectDateInput');
  const methodSelect = document.getElementById('quickCollectMethodSelect');
  const monthSelect = document.getElementById('quickCollectMonthSelect');
  const paidByInput = document.getElementById('quickCollectPaidByInput');
  const dueAmountVal = document.getElementById('quickCollectDueAmountVal');
  const quickAmountChips = modal.querySelectorAll('.quick-amount-chip');

  // Success Elements
  const receiptCardContainer = document.getElementById('quickCollectReceiptCard');
  const whatsAppBtn = document.getElementById('quickCollectWhatsAppBtn');
  const printReceiptBtn = document.getElementById('quickCollectPrintReceiptBtn');
  const anotherBtn = document.getElementById('quickCollectAnotherBtn');
  const doneCloseBtn = document.getElementById('quickCollectDoneCloseBtn');
  const goToTransactionsBtn = document.getElementById('quickCollectGoToTransactionsBtn');

  let activeFilter = 'all-dues';
  let activeCustomerId = null;
  let activeDefaults = null;
  let activeReceipt = null;

  // Populate payment methods select once
  if (methodSelect && methodSelect.options.length <= 1) {
    methodSelect.innerHTML = PAYMENT_METHODS.map(m =>
      `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`
    ).join('');
  }

  function updateCounts() {
    const state = getState();
    if (!state) return;
    const allDues = getPendingCollectionCustomers(state, '', 'all-dues');
    const highDues = getPendingCollectionCustomers(state, '', 'high-dues');
    const all = getPendingCollectionCustomers(state, '', 'all');

    if (duesCountEl) duesCountEl.textContent = allDues.length;
    if (highDuesCountEl) highDuesCountEl.textContent = highDues.length;
    if (allCountEl) allCountEl.textContent = all.length;
  }

  function renderList() {
    const state = getState();
    if (!state || !customerListContainer) return;
    const query = searchInput?.value ?? '';
    const customers = getPendingCollectionCustomers(state, query, activeFilter);
    customerListContainer.innerHTML = renderQuickCollectCustomerListHtml(customers, activeCustomerId);
  }

  function showStep(stepName) {
    if (stepPick) stepPick.hidden = (stepName !== 'pick');
    if (stepForm) stepForm.hidden = (stepName !== 'form');
    if (stepSuccess) stepSuccess.hidden = (stepName !== 'success');
  }

  function openCustomerCollectionForm(customerId) {
    const state = getState();
    if (!state) return;
    try {
      activeCustomerId = customerId;
      activeDefaults = getCustomerPaymentDefaults(state, customerId);

      // Populate form header
      if (customerHeader) {
        customerHeader.innerHTML = `
          <div class="qc-active-cust-bar">
            <div class="qc-cust-identity">
              <span class="qc-tag-num">#${escapeHtml(String(activeDefaults.customerNumber))}</span>
              <strong class="qc-head-name">${escapeHtml(activeDefaults.name)}</strong>
              <span class="qc-head-area">${escapeHtml(activeDefaults.area)}${activeDefaults.phone ? ' · ' + escapeHtml(activeDefaults.phone) : ''}</span>
            </div>
            <div class="qc-head-due-box">
              <span class="qc-box-label">Total Dues</span>
              <strong class="qc-box-amt">PKR ${activeDefaults.totalDues.toLocaleString('en-PK')}</strong>
            </div>
          </div>
        `;
      }

      if (dueAmountVal) {
        dueAmountVal.textContent = activeDefaults.balanceDue.toLocaleString('en-PK');
      }

      // Prefill fields
      if (amountInput) {
        amountInput.value = activeDefaults.suggestedAmount > 0 ? activeDefaults.suggestedAmount.toFixed(2) : '';
        amountInput.max = '999999';
      }
      if (dateInput) {
        dateInput.value = activeDefaults.todayDate;
        dateInput.max = activeDefaults.todayDate;
      }
      if (methodSelect) {
        methodSelect.value = activeDefaults.defaultMethod || 'Cash';
      }
      if (paidByInput) {
        paidByInput.value = activeDefaults.lastPaidBy || '';
      }

      // Populate billing month select
      if (monthSelect) {
        const historyMonths = monthsForHistory();
        monthSelect.innerHTML = historyMonths.map(m =>
          `<option value="${m}" ${m === activeDefaults.targetMonth ? 'selected' : ''}>${m}</option>`
        ).join('');
      }

      showStep('form');
      setTimeout(() => {
        amountInput?.focus();
        amountInput?.select();
      }, 50);

    } catch (err) {
      if (typeof onToast === 'function') onToast(err.message);
    }
  }

  function openModal(defaultCustomerId = null) {
    updateCounts();
    if (defaultCustomerId) {
      openCustomerCollectionForm(defaultCustomerId);
    } else {
      showStep('pick');
      renderList();
      setTimeout(() => {
        searchInput?.focus();
      }, 50);
    }

    if (typeof modal.showModal === 'function') {
      try {
        if (!modal.open) modal.showModal();
      } catch {
        modal.setAttribute('open', '');
      }
    } else {
      modal.setAttribute('open', '');
    }
  }

  function closeModal() {
    if (typeof modal.close === 'function') {
      try {
        if (modal.open) modal.close();
      } catch {
        modal.removeAttribute('open');
      }
    } else {
      modal.removeAttribute('open');
    }
    showStep('pick');
    activeCustomerId = null;
    activeDefaults = null;
    activeReceipt = null;
  }

  // Wire search input
  searchInput?.addEventListener('input', () => {
    if (searchClearBtn) searchClearBtn.hidden = !searchInput.value;
    renderList();
  });

  searchClearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    searchClearBtn.hidden = true;
    searchInput?.focus();
    renderList();
  });

  // Wire filter tabs
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      activeFilter = chip.getAttribute('data-filter') || 'all-dues';
      renderList();
    });
  });

  // Wire list card selection
  customerListContainer?.addEventListener('click', (e) => {
    const card = e.target.closest('.qc-customer-card');
    if (!card) return;
    const cid = card.getAttribute('data-customer-id');
    if (cid) {
      if (typeof onSelectCustomer === 'function') {
        onSelectCustomer(cid);
      }
      openCustomerCollectionForm(cid);
    }
  });

  // Wire quick amount helper chips
  quickAmountChips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (!amountInput || !activeDefaults) return;
      const type = chip.getAttribute('data-quick-amount');
      const baseBalance = activeDefaults.balanceDue > 0 ? activeDefaults.balanceDue : activeDefaults.totalDues;

      if (type === 'full') {
        amountInput.value = (baseBalance > 0 ? baseBalance : activeDefaults.suggestedAmount).toFixed(2);
      } else if (type === 'half') {
        const half = Math.round(baseBalance / 2);
        amountInput.value = (half > 0 ? half : 500).toFixed(2);
      } else {
        const val = Number(type);
        if (Number.isFinite(val)) {
          amountInput.value = val.toFixed(2);
        }
      }
      amountInput.focus();
    });
  });

  // Back to pick
  backToPickBtn?.addEventListener('click', () => {
    showStep('pick');
    renderList();
    searchInput?.focus();
  });

  // Form submit
  paymentForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeCustomerId) return;

    try {
      const state = getState();
      const amountVal = Number(amountInput?.value);
      const dateVal = dateInput?.value || getPakistanLocalDate();
      const methodVal = methodSelect?.value || 'Cash';
      const monthVal = monthSelect?.value || activeDefaults.targetMonth;
      const paidByVal = paidByInput?.value || '';

      const { nextState, receipt } = executeQuickCollection(state, {
        customerId: activeCustomerId,
        month: monthVal,
        amount: amountVal,
        date: dateVal,
        method: methodVal,
        paidBy: paidByVal
      });

      activeReceipt = receipt;

      // Update parent application state
      if (typeof onSaveState === 'function') {
        onSaveState(nextState);
      }

      if (typeof onToast === 'function') {
        onToast(`Payment of PKR ${amountVal.toLocaleString()} recorded.`);
      }

      // Render success screen
      if (receiptCardContainer) {
        receiptCardContainer.innerHTML = renderQuickCollectReceiptCardHtml(receipt);
      }

      showStep('success');
      updateCounts();

    } catch (err) {
      if (typeof onToast === 'function') {
        onToast(err.message);
      }
    }
  });

  // WhatsApp receipt dispatch
  whatsAppBtn?.addEventListener('click', async () => {
    if (!activeReceipt) return;
    const { url, text } = formatQuickCollectWhatsAppReceipt(activeReceipt);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      markReceiptShared(activeReceipt.id, {
        method: 'whatsapp',
        phone: activeReceipt.phone,
        customerId: activeReceipt.customerId,
        amount: activeReceipt.amount
      });
      if (typeof onToast === 'function') {
        onToast('WhatsApp receipt draft opened.');
      }
    } else {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          markReceiptShared(activeReceipt.id, {
            method: 'clipboard',
            phone: '',
            customerId: activeReceipt.customerId,
            amount: activeReceipt.amount
          });
          if (typeof onToast === 'function') {
            onToast('No phone saved. Receipt copied to clipboard!');
          }
        } catch {
          if (typeof onToast === 'function') {
            onToast('No phone number saved for customer.');
          }
        }
      } else if (typeof onToast === 'function') {
        onToast('No phone number saved for customer.');
      }
    }

    if (receiptCardContainer) {
      receiptCardContainer.innerHTML = renderQuickCollectReceiptCardHtml(activeReceipt);
    }
  });

  // Print slip
  printReceiptBtn?.addEventListener('click', () => {
    window.print?.();
  });

  // Collect Another loop
  anotherBtn?.addEventListener('click', () => {
    showStep('pick');
    if (searchInput) searchInput.value = '';
    activeCustomerId = null;
    activeDefaults = null;
    activeReceipt = null;
    renderList();
    searchInput?.focus();
  });

  // Done button
  doneCloseBtn?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);

  // Link to full transactions view
  goToTransactionsBtn?.addEventListener('click', () => {
    closeModal();
    const navCollectionBtn = document.querySelector('[data-mobile-nav="collection"]');
    const txView = document.getElementById('transactionsView');
    if (txView) {
      // Switch view and scroll
      const custView = document.getElementById('customersView');
      if (custView) custView.hidden = true;
      txView.hidden = false;
      txView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Wire bottom nav & More menu Collection tab triggers
  document.querySelectorAll('[data-mobile-nav="collection"], [data-mobile-more="collection"]').forEach(btn => {
    if (btn.dataset.wiredQuickCollect) return;
    btn.dataset.wiredQuickCollect = 'true';
    btn.addEventListener('click', (e) => {
      // Intercept on mobile/touch, open Quick Collect
      e.preventDefault();
      openModal();
    });
  });

  // Wire Quick Actions button if present
  document.querySelectorAll('[data-open-quick-collect]').forEach(btn => {
    if (btn.dataset.wiredQuickCollect) return;
    btn.dataset.wiredQuickCollect = 'true';
    btn.addEventListener('click', () => openModal());
  });

  return {
    open: openModal,
    close: closeModal,
    selectAndOpen: openCustomerCollectionForm,
    isOpen: () => modal.hasAttribute('open') || modal.open
  };
}
