/**
 * nav-pending-actions.js - Pending Actions Center & Collection Promises Suite (agent2 - shahdara-mobile-nav)
 *
 * Implements Backlog Item 7:
 * 1. Pending Actions Center:
 *    - Unshared WhatsApp payment receipts queue: identifies all recent payment receipts
 *      created in the system that have not been dispatched via WhatsApp to the subscriber.
 *    - Collection promises & follow-ups due today or overdue: allows operators and field
 *      collectors to record customer payment promises (date, amount, note), tracks fulfillment,
 *      and flags overdue follow-ups.
 *    - Offline synchronization queue integration: surfaces pending offline transactions
 *      stored locally waiting for browser reconnection or sync review.
 *    - Comprehensive daily plain-text action digest generator for WhatsApp/clipboard dispatch.
 * 2. Mobile Bottom Sheet / Modal Dialog (#pendingActionsModal):
 *    - Touch-first tabbed view: All Actions, WhatsApp Receipts, Promises Due, Offline Queue.
 *    - 1-Tap "📱 Send WhatsApp" with automated delivery tracking and UI updates.
 *    - 1-Tap "💵 Collect Cash" connecting directly to Quick Collect modal.
 *    - 1-Tap "✓ Mark Done" for promises and "✓ Mark All Shared" for receipts.
 *    - Inline "Schedule Collection Promise" form with validation.
 *    - Accessible keyboard dismiss (Escape), backdrop click, and close button.
 * 3. Bilingual English / Urdu localization with RTL compatibility.
 * 4. Badge indicators in Topbar (#topbarPendingBadge) and Navigation Drawer (#navBadgePendingActions).
 * 5. 100% offline-capable, zero cloud network dependencies, dark & light theme styling.
 */

import {
  calculatePaymentAllocations,
  formatPKR,
  PAYMENT_METHODS
} from './core.js';
import {
  RECEIPT_SHARED_STORAGE_KEY,
  isReceiptShared,
  markReceiptShared,
  executeReceiptWhatsAppShare,
  formatPakistaniPhone,
  escapeHtml
} from './nav-quick-profile.js';
import { getOfflineSyncQueue } from './nav.js';

export const COLLECTION_PROMISES_STORAGE_KEY = 'shahdara_collection_promises_v1';
export const OFFLINE_PAYMENT_QUEUE_KEY = 'shahdara_offline_payment_queue';
export const PAKISTAN_TIME_ZONE = 'Asia/Karachi';

/**
 * Returns today's date formatted as YYYY-MM-DD in Pakistan Standard Time (Asia/Karachi).
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD
 */
export function getTodayDateString(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: PAKISTAN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export const getPendingActionsDateString = getTodayDateString;

/**
 * Formats a date string (YYYY-MM-DD) into readable human-friendly text.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = monthNames[monthIdx] || parts[1];
  return `${parseInt(parts[2], 10)} ${monthName} ${parts[0]}`;
}

/**
 * Calculates calendar day difference (dateStr1 - dateStr2).
 * Positive if dateStr1 is later than dateStr2.
 * @param {string} dateStr1
 * @param {string} dateStr2
 * @returns {number}
 */
export function calculateDaysDifference(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 0;
  try {
    const d1 = new Date(`${dateStr1}T00:00:00Z`);
    const d2 = new Date(`${dateStr2}T00:00:00Z`);
    const diffMs = d1.getTime() - d2.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Retrieves all collection promises from storage.
 *
 * @param {Storage|object} [storage]
 * @returns {Array<Object>}
 */
export function getCollectionPromises(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || typeof storage.getItem !== 'function') return [];
  try {
    const raw = storage.getItem(COLLECTION_PROMISES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => String(a.promisedDate || '').localeCompare(String(b.promisedDate || '')));
  } catch {
    return [];
  }
}

/**
 * Saves or updates a collection promise in storage.
 *
 * @param {Object} promiseData
 * @param {Storage|object} [storage]
 * @returns {Object|null}
 */
export function saveCollectionPromise(promiseData, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!promiseData || !promiseData.customerId || !promiseData.promisedDate) {
    return null;
  }
  if (!storage || typeof storage.setItem !== 'function') return null;

  try {
    const promises = getCollectionPromises(storage);
    const id = promiseData.id || `prom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    const record = {
      id,
      customerId: String(promiseData.customerId),
      customerNumber: promiseData.customerNumber != null ? Number(promiseData.customerNumber) : null,
      customerName: String(promiseData.customerName || 'Customer').trim(),
      phone: String(promiseData.phone || '').trim(),
      area: String(promiseData.area || '').trim(),
      promisedDate: String(promiseData.promisedDate),
      promisedAmount: Math.max(0, Number(promiseData.promisedAmount || 0)),
      note: String(promiseData.note || '').trim(),
      status: promiseData.status || 'pending',
      createdAt: promiseData.createdAt || nowIso,
      updatedAt: nowIso,
      fulfilledAt: promiseData.fulfilledAt || null,
      fulfilledPaymentId: promiseData.fulfilledPaymentId || null
    };

    const existingIndex = promises.findIndex(p => p.id === id);
    if (existingIndex >= 0) {
      promises[existingIndex] = record;
    } else {
      promises.push(record);
    }

    storage.setItem(COLLECTION_PROMISES_STORAGE_KEY, JSON.stringify(promises));
    return record;
  } catch {
    return null;
  }
}

/**
 * Marks a collection promise as fulfilled.
 *
 * @param {string} promiseId
 * @param {string} [paymentId]
 * @param {Storage|object} [storage]
 * @returns {Object|null}
 */
export function fulfillCollectionPromise(promiseId, paymentId = null, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!promiseId || !storage || typeof storage.getItem !== 'function') return null;
  try {
    const promises = getCollectionPromises(storage);
    const target = promises.find(p => p.id === promiseId);
    if (!target) return null;

    target.status = 'fulfilled';
    target.fulfilledAt = new Date().toISOString();
    target.updatedAt = target.fulfilledAt;
    target.fulfilledPaymentId = paymentId || null;

    storage.setItem(COLLECTION_PROMISES_STORAGE_KEY, JSON.stringify(promises));
    return target;
  } catch {
    return null;
  }
}

/**
 * Cancels or dismisses a collection promise.
 *
 * @param {string} promiseId
 * @param {string} [reason]
 * @param {Storage|object} [storage]
 * @returns {Object|null}
 */
export function cancelCollectionPromise(promiseId, reason = '', storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!promiseId || !storage || typeof storage.getItem !== 'function') return null;
  try {
    const promises = getCollectionPromises(storage);
    const target = promises.find(p => p.id === promiseId);
    if (!target) return null;

    target.status = 'cancelled';
    target.cancelledReason = String(reason || '');
    target.updatedAt = new Date().toISOString();

    storage.setItem(COLLECTION_PROMISES_STORAGE_KEY, JSON.stringify(promises));
    return target;
  } catch {
    return null;
  }
}

/**
 * Reschedules a collection promise to a new date.
 *
 * @param {string} promiseId
 * @param {string} newDateStr
 * @param {Storage|object} [storage]
 * @returns {Object|null}
 */
export function rescheduleCollectionPromise(promiseId, newDateStr, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!promiseId || !newDateStr || !storage || typeof storage.getItem !== 'function') return null;
  try {
    const promises = getCollectionPromises(storage);
    const target = promises.find(p => p.id === promiseId);
    if (!target) return null;

    target.previousPromisedDate = target.promisedDate;
    target.promisedDate = newDateStr;
    target.status = 'pending';
    target.updatedAt = new Date().toISOString();

    storage.setItem(COLLECTION_PROMISES_STORAGE_KEY, JSON.stringify(promises));
    return target;
  } catch {
    return null;
  }
}

/**
 * Clears all collection promises from storage (useful for resets & test isolation).
 * @param {Storage|object} [storage]
 */
export function clearCollectionPromises(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || typeof storage.removeItem !== 'function') return;
  try {
    storage.removeItem(COLLECTION_PROMISES_STORAGE_KEY);
  } catch {}
}

/**
 * Extracts all recorded payment entries across non-archived customers.
 * @param {Object} state
 * @returns {Array<Object>}
 */
export function getAllPaymentsFromState(state) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const results = [];
  for (const c of customers) {
    if (c.archived) continue;
    const bills = Array.isArray(c.bills) ? c.bills : [];
    for (const b of bills) {
      const payments = Array.isArray(b.payments) ? b.payments : [];
      for (const p of payments) {
        if (!p || !p.id) continue;
        results.push({
          id: p.id,
          paymentId: p.id,
          customerId: c.id,
          customerNumber: c.customerNumber ?? null,
          customerName: c.name || 'Subscriber',
          customerPhone: c.phone || '',
          customerArea: c.area || c.mohalla || c.address || '',
          amount: Number(p.amount || 0),
          date: p.date || '',
          method: p.method || 'cash',
          month: b.month || '',
          paidBy: p.paidBy || '',
          billAmount: b.dueAmount != null ? Number(b.dueAmount) : null
        });
      }
    }
  }
  return results;
}

/**
 * Computes a comprehensive summary of all pending operational actions:
 * 1. Unshared WhatsApp Receipts (payments within lookback period not yet marked shared).
 * 2. Collection Promises Due (pending promises due today or overdue).
 * 3. Offline Payment Queue (items stored locally waiting for sync).
 *
 * @param {Object} state - The ISP billing application state.
 * @param {Object} [options={}]
 * @returns {Object} Pending actions summary
 */
export function getPendingActionsSummary(state, options = {}) {
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const refDate = options.referenceDate instanceof Date ? options.referenceDate : new Date();
  const todayStr = options.todayString || getTodayDateString(refDate);
  const lookbackDays = options.includeOlderReceiptsDays ?? 30;

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const customerMap = new Map(customers.map(c => [c.id, c]));

  // Calculate cutoff date for receipts
  let cutoffDateStr = '';
  try {
    const cutoffDate = new Date(refDate.getTime() - (lookbackDays * 24 * 60 * 60 * 1000));
    cutoffDateStr = getTodayDateString(cutoffDate);
  } catch {
    cutoffDateStr = '2000-01-01';
  }

  // 1. Unshared WhatsApp Receipts
  const unsharedReceipts = [];
  const rawPayments = getAllPaymentsFromState(state);

  for (const pay of rawPayments) {
    if (!pay || !pay.id) continue;
    if (pay.date && cutoffDateStr && pay.date < cutoffDateStr) continue;

    const sharedRecord = isReceiptShared(pay.id, storage);
    if (!sharedRecord || !sharedRecord.shared) {
      const cust = customerMap.get(pay.customerId) || {
        id: pay.customerId,
        name: pay.customerName,
        customerNumber: pay.customerNumber,
        phone: pay.customerPhone,
        area: pay.customerAddress
      };

      unsharedReceipts.push({
        paymentId: pay.id,
        receiptId: pay.id,
        customerId: pay.customerId,
        customerNumber: pay.customerNumber ?? cust.customerNumber ?? null,
        customerName: cust.name || pay.customerName || 'Subscriber',
        customerPhone: cust.phone || pay.customerPhone || '',
        customerArea: cust.area || cust.mohalla || cust.address || '',
        amount: Number(pay.amount || 0),
        date: pay.date || '',
        method: pay.method || 'cash',
        month: pay.month || '',
        paidBy: pay.paidBy || '',
        billAmount: pay.billAmount ?? null,
        isShared: false
      });
    }
  }

  // Sort unshared receipts: newest date first
  unsharedReceipts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.paymentId || '').localeCompare(a.paymentId || ''));

  // 2. Collection Promises Due & Follow-ups
  const allPromises = getCollectionPromises(storage);
  const promisesDue = [];

  for (const prom of allPromises) {
    if (prom.status !== 'pending') continue;

    const diffDays = calculateDaysDifference(todayStr, prom.promisedDate);
    const isDueToday = prom.promisedDate === todayStr;
    const isOverdue = diffDays > 0;

    // Check if customer exists and calculate their balance
    const cust = customerMap.get(prom.customerId);
    let currentBalance = 0;
    if (cust && Array.isArray(cust.bills)) {
      currentBalance = cust.bills.reduce((sum, b) => {
        const due = Number(b.dueAmount || 0);
        const paid = (b.payments || []).reduce((pSum, p) => pSum + Number(p.amount || 0), 0);
        return sum + Math.max(0, due - paid);
      }, 0);
    }

    // Include if due today or overdue
    if (isDueToday || isOverdue) {
      promisesDue.push({
        ...prom,
        isDueToday,
        isOverdue,
        daysOverdue: Math.max(0, diffDays),
        currentBalance,
        isSettled: currentBalance === 0 && (cust?.bills?.length > 0)
      });
    }
  }

  // Sort promises: overdue highest first, then today
  promisesDue.sort((a, b) => (b.daysOverdue - a.daysOverdue) || (a.promisedDate || '').localeCompare(b.promisedDate || ''));

  // 3. Offline Sync Queue
  let offlineQueue = [];
  try {
    offlineQueue = getOfflineSyncQueue(storage);
    if (!Array.isArray(offlineQueue) || offlineQueue.length === 0) {
      const rawPay = storage?.getItem?.(OFFLINE_PAYMENT_QUEUE_KEY);
      if (rawPay) {
        const parsedPay = JSON.parse(rawPay);
        if (Array.isArray(parsedPay)) offlineQueue = parsedPay;
      }
    }
  } catch {
    offlineQueue = [];
  }
  const pendingOfflineItems = (offlineQueue || []).filter(item => item && item.status !== 'synced' && item.status !== 'dead_letter');

  const counts = {
    unsharedReceipts: unsharedReceipts.length,
    promisesDue: promisesDue.length,
    offlineQueue: pendingOfflineItems.length,
    total: unsharedReceipts.length + promisesDue.length + pendingOfflineItems.length
  };

  return {
    unsharedReceipts,
    promisesDue,
    allPromises,
    offlineQueue: pendingOfflineItems,
    counts,
    generatedAt: new Date().toISOString(),
    todayDate: todayStr
  };
}

/**
 * Bulk marks all given unshared receipts as shared in storage.
 *
 * @param {Array<Object>} receipts
 * @param {Storage|object} [storage]
 * @returns {number} Count of receipts marked
 */
export function markAllReceiptsSharedInQueue(receipts, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!Array.isArray(receipts) || !storage) return 0;
  let count = 0;
  for (const r of receipts) {
    if (!r || !r.paymentId) continue;
    markReceiptShared(r.paymentId, {
      method: 'bulk_cleared',
      phone: r.customerPhone,
      customerId: r.customerId,
      customerNumber: r.customerNumber,
      amount: r.amount
    }, storage);
    count++;
  }
  return count;
}

/**
 * Formats a plain-text operational digest ready to share on WhatsApp or copy to clipboard.
 *
 * @param {Object} summary - Output of getPendingActionsSummary
 * @param {Object} [options={}] - { language: 'en'|'ur' }
 * @returns {string} Plain-text report
 */
export function generatePendingActionsDigest(summary, options = {}) {
  const isUrdu = options.language === 'ur';
  const today = summary.todayDate || getTodayDateString();
  const displayDate = formatDisplayDate(today);

  if (isUrdu) {
    const lines = [
      '⚡ *شاہدرہ فائبر نیٹ - ایکشن سینٹر سمری*',
      `📅 تاریخ: ${displayDate} | وقت: شام`,
      '----------------------------------------',
      `📌 کل زیر التواء کام: *${summary.counts.total}*`,
      ''
    ];

    lines.push(`📱 *غیر ارسال شدہ واٹس ایپ رسیدیں (${summary.counts.unsharedReceipts}):*`);
    if (summary.unsharedReceipts.length === 0) {
      lines.push('  ✓ تمام رسیدیں واٹس ایپ پر بھیج دی گئی ہیں۔');
    } else {
      summary.unsharedReceipts.slice(0, 10).forEach((r, idx) => {
        const phone = r.customerPhone ? formatPakistaniPhone(r.customerPhone) : 'فون نمبر نہیں';
        lines.push(`  ${idx + 1}. ${r.customerName} (#${r.customerNumber || '-'}) - Rs. ${r.amount.toLocaleString()} (${r.method}) · ${phone}`);
      });
      if (summary.unsharedReceipts.length > 10) {
        lines.push(`  ...اور ${summary.unsharedReceipts.length - 10} مزید رسیدیں`);
      }
    }
    lines.push('');

    lines.push(`🤝 *ادائیگی کے وعدے / فالو اپ (${summary.counts.promisesDue}):*`);
    if (summary.promisesDue.length === 0) {
      lines.push('  ✓ آج کی تاریخ میں کوئی بقایا وعدہ زیر التواء نہیں۔');
    } else {
      summary.promisesDue.forEach((p, idx) => {
        const tag = p.isOverdue ? `(تاخیر: ${p.daysOverdue} دن)` : '(آج)';
        const note = p.note ? ` - "${p.note}"` : '';
        const phone = p.phone ? formatPakistaniPhone(p.phone) : '';
        lines.push(`  ${idx + 1}. ${p.customerName} (#${p.customerNumber || '-'}) - Rs. ${p.promisedAmount.toLocaleString()} ${tag}${note} · ${phone}`);
      });
    }
    lines.push('');

    if (summary.counts.offlineQueue > 0) {
      lines.push(`💾 *آف لائن کیو:* ${summary.counts.offlineQueue} ٹرانزیکشنز سنک ہونے کے منتظر`);
      lines.push('');
    }

    lines.push('----------------------------------------');
    lines.push('شاہدرہ آئی ایس پی بلنگ · بغیر انٹرنیٹ فیلڈ ریکوری');
    return lines.join('\n');
  }

  // English default
  const lines = [
    '⚡ *SHAHDARA FIBER NET - PENDING ACTIONS CENTER*',
    `📅 Date: ${displayDate}`,
    '----------------------------------------',
    `📌 Total Pending Tasks: *${summary.counts.total}*`,
    ''
  ];

  lines.push(`📱 *UNSHARED WHATSAPP RECEIPTS (${summary.counts.unsharedReceipts}):*`);
  if (summary.unsharedReceipts.length === 0) {
    lines.push('  ✓ All payment receipts have been sent via WhatsApp.');
  } else {
    summary.unsharedReceipts.slice(0, 10).forEach((r, idx) => {
      const phone = r.customerPhone ? formatPakistaniPhone(r.customerPhone) : 'No phone';
      lines.push(`  ${idx + 1}. ${r.customerName} (#${r.customerNumber || '-'}) - Rs. ${r.amount.toLocaleString()} (${r.method}) · ${phone}`);
    });
    if (summary.unsharedReceipts.length > 10) {
      lines.push(`  ...and ${summary.unsharedReceipts.length - 10} more unshared receipts`);
    }
  }
  lines.push('');

  lines.push(`🤝 *COLLECTION PROMISES DUE (${summary.counts.promisesDue}):*`);
  if (summary.promisesDue.length === 0) {
    lines.push('  ✓ No customer payment promises due today.');
  } else {
    summary.promisesDue.forEach((p, idx) => {
      const tag = p.isOverdue ? `(OVERDUE by ${p.daysOverdue}d)` : '(DUE TODAY)';
      const note = p.note ? ` - "${p.note}"` : '';
      const phone = p.phone ? formatPakistaniPhone(p.phone) : '';
      lines.push(`  ${idx + 1}. ${p.customerName} (#${p.customerNumber || '-'}) - Rs. ${p.promisedAmount.toLocaleString()} ${tag}${note} · ${phone}`);
    });
  }
  lines.push('');

  if (summary.counts.offlineQueue > 0) {
    lines.push(`💾 *OFFLINE QUEUE:* ${summary.counts.offlineQueue} transaction(s) pending sync`);
    lines.push('');
  }

  lines.push('----------------------------------------');
  lines.push('Shahdara ISP Billing · Offline Field Collection Ledger');
  return lines.join('\n');
}

/**
 * Updates navigation badge indicators in topbar and navigation drawer.
 *
 * @param {Object} summary - Output of getPendingActionsSummary
 */
export function updatePendingActionsBadges(summary) {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;

  const total = Number(summary?.counts?.total || 0);
  const badges = document.querySelectorAll('[data-nav-badge="pending-actions"], #topbarPendingBadge, #navBadgePendingActions');

  badges.forEach(badge => {
    badge.textContent = total > 99 ? '99+' : String(total);
    badge.hidden = total === 0;
    if (badge.classList?.toggle) {
      badge.classList.toggle('badge-alert', total > 0);
    }
  });

  const topbarBtn = document.getElementById('topbarPendingActionsBtn');
  if (topbarBtn) {
    topbarBtn.setAttribute('title', `Pending Actions: ${total} task(s) waiting`);
  }
}

/**
 * Sets up and manages the interactive Pending Actions Modal Dialog (#pendingActionsModal).
 *
 * @param {Object} options
 * @param {Function} options.getState - Returns latest application state
 * @param {Storage|object} [options.storage]
 * @param {Function} [options.onStateChange] - Called when state or storage updates
 * @param {Function} [options.toast] - Toast notification callback
 * @returns {Object} Controller instance
 */
export function setupPendingActionsModal(options = {}) {
  const modal = typeof document !== 'undefined' ? document.getElementById('pendingActionsModal') : null;
  const listContainer = typeof document !== 'undefined' ? document.getElementById('pendingActionsListContainer') : null;
  const countBadge = typeof document !== 'undefined' ? document.getElementById('pendingActionsTotalBadge') : null;
  const emptyState = typeof document !== 'undefined' ? document.getElementById('pendingActionsEmptyState') : null;
  const closeBtn = typeof document !== 'undefined' ? document.getElementById('closePendingActionsModalBtn') : null;
  const copyDigestBtn = typeof document !== 'undefined' ? document.getElementById('pendingActionsCopyDigestBtn') : null;
  const markAllSharedBtn = typeof document !== 'undefined' ? document.getElementById('pendingActionsMarkAllSharedBtn') : null;
  const schedulePromiseToggleBtn = typeof document !== 'undefined' ? document.getElementById('toggleSchedulePromiseFormBtn') : null;
  const promiseFormContainer = typeof document !== 'undefined' ? document.getElementById('pendingPromiseFormContainer') : null;
  const promiseForm = typeof document !== 'undefined' ? document.getElementById('pendingPromiseForm') : null;
  const promiseCustomerSelect = typeof document !== 'undefined' ? document.getElementById('promiseCustomerSelect') : null;
  const promiseDateInput = typeof document !== 'undefined' ? document.getElementById('promiseDateInput') : null;
  const promiseAmountInput = typeof document !== 'undefined' ? document.getElementById('promiseAmountInput') : null;
  const promiseNoteInput = typeof document !== 'undefined' ? document.getElementById('promiseNoteInput') : null;
  const cancelPromiseFormBtn = typeof document !== 'undefined' ? document.getElementById('cancelPromiseFormBtn') : null;

  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const getState = options.getState || (() => ({ customers: [] }));
  const toast = options.toast || (msg => console.log(msg));
  let activeTab = 'all'; // 'all' | 'receipts' | 'promises' | 'offline'

  function getLang() {
    if (typeof window !== 'undefined' && window.languageController?.getCurrentLanguage) {
      return window.languageController.getCurrentLanguage();
    }
    try {
      return storage?.getItem?.('shahdara_language_v1') || 'en';
    } catch {
      return 'en';
    }
  }

  function renderCustomerSelectOptions(state) {
    if (!promiseCustomerSelect) return;
    const customers = Array.isArray(state?.customers) ? state.customers : [];
    const prevVal = promiseCustomerSelect.value;
    promiseCustomerSelect.innerHTML = '<option value="">-- Choose Customer with Dues --</option>';

    customers.filter(c => !c.archived).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      const num = c.customerNumber ? `#${c.customerNumber} · ` : '';
      const area = c.area || c.mohalla ? ` (${c.area || c.mohalla})` : '';
      opt.textContent = `${num}${c.name}${area}`;
      promiseCustomerSelect.appendChild(opt);
    });

    if (prevVal) promiseCustomerSelect.value = prevVal;
  }

  function render() {
    const state = getState();
    const summary = getPendingActionsSummary(state, { storage });
    updatePendingActionsBadges(summary);

    if (countBadge) {
      countBadge.textContent = summary.counts.total > 0 ? `${summary.counts.total} Pending` : 'All Clear';
      countBadge.classList.toggle('badge-alert', summary.counts.total > 0);
      countBadge.classList.toggle('badge-success', summary.counts.total === 0);
    }

    // Update tab counts
    const tabAllBadge = document.getElementById('pendingTabAllCount');
    const tabReceiptsBadge = document.getElementById('pendingTabReceiptsCount');
    const tabPromisesBadge = document.getElementById('pendingTabPromisesCount');
    const tabOfflineBadge = document.getElementById('pendingTabOfflineCount');

    if (tabAllBadge) tabAllBadge.textContent = String(summary.counts.total);
    if (tabReceiptsBadge) tabReceiptsBadge.textContent = String(summary.counts.unsharedReceipts);
    if (tabPromisesBadge) tabPromisesBadge.textContent = String(summary.counts.promisesDue);
    if (tabOfflineBadge) tabOfflineBadge.textContent = String(summary.counts.offlineQueue);

    if (markAllSharedBtn) {
      markAllSharedBtn.hidden = summary.counts.unsharedReceipts === 0;
    }

    if (!listContainer) return;
    listContainer.innerHTML = '';

    let itemsToRender = [];

    if (activeTab === 'all' || activeTab === 'receipts') {
      summary.unsharedReceipts.forEach(r => {
        itemsToRender.push({ type: 'receipt', data: r });
      });
    }

    if (activeTab === 'all' || activeTab === 'promises') {
      summary.promisesDue.forEach(p => {
        itemsToRender.push({ type: 'promise', data: p });
      });
    }

    if (activeTab === 'all' || activeTab === 'offline') {
      summary.offlineQueue.forEach(o => {
        itemsToRender.push({ type: 'offline', data: o });
      });
    }

    if (emptyState) {
      emptyState.hidden = itemsToRender.length > 0;
    }

    if (itemsToRender.length === 0) {
      return;
    }

    itemsToRender.forEach(item => {
      const card = document.createElement('div');
      card.className = `pending-action-card pending-card-${item.type}`;

      if (item.type === 'receipt') {
        const r = item.data;
        const phoneFormatted = r.customerPhone ? formatPakistaniPhone(r.customerPhone) : 'No phone saved';
        card.innerHTML = `
          <div class="pending-card-header">
            <span class="pending-card-badge badge-receipt">📱 Unshared Receipt</span>
            <span class="pending-card-date">${escapeHtml(formatDisplayDate(r.date))}</span>
          </div>
          <div class="pending-card-body">
            <div class="pending-card-title">
              <strong>${escapeHtml(r.customerName)}</strong>
              ${r.customerNumber ? `<span class="pending-cust-num">#${escapeHtml(r.customerNumber)}</span>` : ''}
            </div>
            <div class="pending-card-meta">
              <span>Amount: <strong>Rs. ${Number(r.amount).toLocaleString()}</strong></span>
              <span>Method: <span class="method-tag">${escapeHtml(r.method)}</span></span>
              <span>Phone: ${escapeHtml(phoneFormatted)}</span>
            </div>
          </div>
          <div class="pending-card-actions">
            <button type="button" class="btn-primary pending-wa-btn" data-receipt-id="${escapeHtml(r.paymentId)}">
              <span>📱 Send WhatsApp</span>
            </button>
            <button type="button" class="btn-secondary pending-mark-shared-btn" data-receipt-id="${escapeHtml(r.paymentId)}" title="Mark as sent without opening WhatsApp">
              <span>✓ Mark Shared</span>
            </button>
          </div>
        `;

        // Wire WhatsApp button
        const waBtn = card.querySelector('.pending-wa-btn');
        if (waBtn) {
          waBtn.addEventListener('click', async () => {
            const cust = { id: r.customerId, name: r.customerName, phone: r.customerPhone, customerNumber: r.customerNumber };
            const receipt = { id: r.paymentId, amount: r.amount, method: r.method, date: r.date, originMonth: r.month };
            await executeReceiptWhatsAppShare(cust, receipt, { storage });
            toast(`WhatsApp draft opened for ${r.customerName}`);
            render();
            if (typeof options.onStateChange === 'function') options.onStateChange();
          });
        }

        // Wire Mark Shared button
        const markBtn = card.querySelector('.pending-mark-shared-btn');
        if (markBtn) {
          markBtn.addEventListener('click', () => {
            markReceiptShared(r.paymentId, {
              method: 'manual_cleared',
              phone: r.customerPhone,
              customerId: r.customerId,
              customerNumber: r.customerNumber,
              amount: r.amount
            }, storage);
            toast(`Receipt marked as shared`);
            render();
            if (typeof options.onStateChange === 'function') options.onStateChange();
          });
        }

      } else if (item.type === 'promise') {
        const p = item.data;
        const phoneFormatted = p.phone ? formatPakistaniPhone(p.phone) : 'No phone';
        const statusBadgeClass = p.isOverdue ? 'badge-alert' : 'badge-warning';
        const statusBadgeText = p.isOverdue ? `⚠️ Overdue ${p.daysOverdue}d` : '📅 Due Today';

        card.innerHTML = `
          <div class="pending-card-header">
            <span class="pending-card-badge ${statusBadgeClass}">${statusBadgeText}</span>
            <span class="pending-card-date">Promised: ${escapeHtml(formatDisplayDate(p.promisedDate))}</span>
          </div>
          <div class="pending-card-body">
            <div class="pending-card-title">
              <strong>${escapeHtml(p.customerName)}</strong>
              ${p.customerNumber ? `<span class="pending-cust-num">#${escapeHtml(p.customerNumber)}</span>` : ''}
              ${p.area ? `<span class="pending-area-tag">${escapeHtml(p.area)}</span>` : ''}
            </div>
            <div class="pending-card-meta">
              <span>Promised: <strong>Rs. ${Number(p.promisedAmount).toLocaleString()}</strong></span>
              <span>Balance: Rs. ${Number(p.currentBalance || 0).toLocaleString()}</span>
              ${p.note ? `<div class="pending-promise-note">📝 "${escapeHtml(p.note)}"</div>` : ''}
            </div>
          </div>
          <div class="pending-card-actions">
            <button type="button" class="btn-primary pending-collect-btn" data-customer-id="${escapeHtml(p.customerId)}">
              <span>💵 Collect Cash</span>
            </button>
            <button type="button" class="btn-success pending-fulfill-btn" data-promise-id="${escapeHtml(p.id)}">
              <span>✓ Mark Done</span>
            </button>
            ${p.phone ? `<a href="tel:${escapeHtml(p.phone)}" class="btn-secondary pending-call-btn" title="Call subscriber">📞 Call</a>` : ''}
            <button type="button" class="btn-secondary pending-reschedule-btn" data-promise-id="${escapeHtml(p.id)}" title="Postpone promise">
              <span>⏱ Postpone</span>
            </button>
          </div>
        `;

        // Wire Collect Cash button
        const collectBtn = card.querySelector('.pending-collect-btn');
        if (collectBtn) {
          collectBtn.addEventListener('click', () => {
            if (modal?.close) modal.close();
            else modal?.removeAttribute('open');
            if (typeof window !== 'undefined' && window.quickCollectModalController?.selectAndOpen) {
              window.quickCollectModalController.selectAndOpen(p.customerId);
            }
          });
        }

        // Wire Mark Done button
        const fulfillBtn = card.querySelector('.pending-fulfill-btn');
        if (fulfillBtn) {
          fulfillBtn.addEventListener('click', () => {
            fulfillCollectionPromise(p.id, null, storage);
            toast(`Promise marked as fulfilled for ${p.customerName}`);
            render();
            if (typeof options.onStateChange === 'function') options.onStateChange();
          });
        }

        // Wire Postpone/Reschedule button
        const rescheduleBtn = card.querySelector('.pending-reschedule-btn');
        if (rescheduleBtn) {
          rescheduleBtn.addEventListener('click', () => {
            // Postpone by 2 days
            const d = new Date();
            d.setDate(d.getDate() + 2);
            const newDate = getTodayDateString(d);
            rescheduleCollectionPromise(p.id, newDate, storage);
            toast(`Promise postponed to ${formatDisplayDate(newDate)}`);
            render();
            if (typeof options.onStateChange === 'function') options.onStateChange();
          });
        }

      } else if (item.type === 'offline') {
        const o = item.data;
        card.innerHTML = `
          <div class="pending-card-header">
            <span class="pending-card-badge badge-neutral">💾 Offline Queue</span>
            <span class="pending-card-date">${escapeHtml(o.status || 'pending')}</span>
          </div>
          <div class="pending-card-body">
            <div class="pending-card-title">
              <strong>${escapeHtml(o.summary || o.action || 'Queued Payment')}</strong>
            </div>
            <div class="pending-card-meta">
              <span>ID: ${escapeHtml(o.id || '')}</span>
              ${o.createdAt ? `<span>Queued: ${escapeHtml(o.createdAt.slice(0, 16))}</span>` : ''}
            </div>
          </div>
        `;
      }

      listContainer.appendChild(card);
    });
  }

  // Filter tab events
  if (typeof document !== 'undefined') {
    const tabButtons = document.querySelectorAll('.pending-actions-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        activeTab = btn.getAttribute('data-pending-tab') || 'all';
        render();
      });
    });
  }

  // Close modal button
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  // Modal backdrop click
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        if (modal.close) modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  // Escape key handled natively by <dialog>, but add safety listener
  if (modal) {
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (modal.close) modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  // Copy plain text digest
  if (copyDigestBtn) {
    copyDigestBtn.addEventListener('click', async () => {
      const state = getState();
      const summary = getPendingActionsSummary(state, { storage });
      const lang = getLang();
      const text = generatePendingActionsDigest(summary, { language: lang });

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          toast(lang === 'ur' ? 'ایکشن لسٹ کاپی ہو گئی ہے!' : 'Pending action list copied to clipboard!');
        } else {
          toast('Copied action digest summary');
        }
      } catch {
        toast('Copied action digest summary');
      }
    });
  }

  // Mark all receipts shared
  if (markAllSharedBtn) {
    markAllSharedBtn.addEventListener('click', () => {
      const state = getState();
      const summary = getPendingActionsSummary(state, { storage });
      const count = markAllReceiptsSharedInQueue(summary.unsharedReceipts, storage);
      toast(`Marked ${count} payment receipt(s) as shared`);
      render();
      if (typeof options.onStateChange === 'function') options.onStateChange();
    });
  }

  // Toggle promise form
  if (schedulePromiseToggleBtn && promiseFormContainer) {
    schedulePromiseToggleBtn.addEventListener('click', () => {
      const isHidden = promiseFormContainer.hidden;
      promiseFormContainer.hidden = !isHidden;
      if (!isHidden) return;

      const state = getState();
      renderCustomerSelectOptions(state);
      if (promiseDateInput) {
        // Default tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        promiseDateInput.value = getTodayDateString(tomorrow);
      }
    });
  }

  if (cancelPromiseFormBtn && promiseFormContainer) {
    cancelPromiseFormBtn.addEventListener('click', () => {
      promiseFormContainer.hidden = true;
    });
  }

  // Submit promise form
  if (promiseForm) {
    promiseForm.addEventListener('submit', e => {
      e.preventDefault();
      const customerId = promiseCustomerSelect?.value;
      const date = promiseDateInput?.value;
      const amount = Number(promiseAmountInput?.value || 0);
      const note = promiseNoteInput?.value || '';

      if (!customerId) {
        toast('Please select a customer for the promise');
        return;
      }
      if (!date) {
        toast('Please choose a promised payment date');
        return;
      }

      const state = getState();
      const cust = (state.customers || []).find(c => c.id === customerId);

      saveCollectionPromise({
        customerId,
        customerNumber: cust?.customerNumber,
        customerName: cust?.name,
        phone: cust?.phone,
        area: cust?.area || cust?.mohalla,
        promisedDate: date,
        promisedAmount: amount,
        note
      }, storage);

      toast(`Promise scheduled for ${cust?.name || 'Customer'}`);
      if (promiseFormContainer) promiseFormContainer.hidden = true;
      if (promiseAmountInput) promiseAmountInput.value = '';
      if (promiseNoteInput) promiseNoteInput.value = '';
      render();
      if (typeof options.onStateChange === 'function') options.onStateChange();
    });
  }

  return {
    open: () => {
      if (modal) {
        if (modal.showModal) modal.showModal();
        else modal.setAttribute('open', '');
      }
      render();
    },
    close: () => {
      if (modal) {
        if (modal.close) modal.close();
        else modal.removeAttribute('open');
      }
    },
    render,
    getSummary: () => getPendingActionsSummary(getState(), { storage })
  };
}
