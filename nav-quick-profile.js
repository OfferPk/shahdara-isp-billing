/**
 * nav-quick-profile.js - Mobile Customer Quick Profile Sheet & WhatsApp Receipt Delivery Suite (agent2 - shahdara-mobile-nav)
 *
 * Implements Backlog Items 3 & 5:
 * 1. Mobile Quick Profile Sheet:
 *    - Instant 1-tap view showing customer name, ID #, phone, area, package, total outstanding dues, current bill status, and last payment.
 *    - Touch-first 48px action grid: Collect Cash, WhatsApp Reminder, Call, Full Ledger.
 * 2. WhatsApp Receipt Share & Delivery Tracking:
 *    - Opens user-reviewed wa.me draft using verified receipt template from profile-ui.js.
 *    - Automatic copy-text clipboard fallback when no phone is saved on file.
 *    - Tracks delivery state under `shahdara_receipts_shared_v1` in localStorage.
 *    - Renders dynamic "✓ WhatsApp Shared" badges across quick sheets and receipt cards.
 * 3. 100% Offline-capable, zero cloud network requests, full dark/light theme support, and accessible dialog controls.
 */

import {
  calculatePaymentAllocations,
  derivedBillStatus,
  monthsForHistory,
  formatPKR,
  PAYMENT_METHODS,
  whatsappPhoneFor
} from './core.js';
import {
  contactActionTargets,
  createWhatsAppFollowupDraft,
  createReceiptWhatsAppDraft,
  resolveReceiptWhatsAppAction
} from './profile-ui.js';
import { formatWhatsAppUrl } from './form-validation.js';

export const RECEIPT_SHARED_STORAGE_KEY = 'shahdara_receipts_shared_v1';

/**
 * Escapes HTML characters for safe template string interpolation.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Formats a Pakistani phone number into human-readable 03xx-xxxxxxx format.
 * @param {string} phone
 * @returns {string}
 */
export function formatPakistaniPhone(phone) {
  if (!phone) return 'No phone saved';
  const clean = String(phone).replace(/[^\d]/g, '');
  if (clean.length === 11 && clean.startsWith('03')) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  if (clean.length === 12 && clean.startsWith('923')) {
    return `0${clean.slice(2, 5)}-${clean.slice(5)}`;
  }
  if (clean.length === 10 && clean.startsWith('3')) {
    return `0${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return String(phone);
}

/**
 * Marks a payment receipt as shared via WhatsApp or clipboard.
 *
 * @param {string} receiptId - Unique payment/receipt identifier
 * @param {Object} [metadata={}] - Optional metadata (method, phone, customerId)
 * @param {Storage} [storage=localStorage]
 * @returns {Object} Updated shared record
 */
export function markReceiptShared(receiptId, metadata = {}, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!receiptId) return null;
  if (!storage) return null;

  try {
    const raw = storage.getItem(RECEIPT_SHARED_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const record = {
      shared: true,
      sharedAt: new Date().toISOString(),
      method: metadata.method || 'whatsapp',
      recipientPhone: metadata.phone || '',
      customerId: metadata.customerId || '',
      customerNumber: metadata.customerNumber || null,
      amount: metadata.amount || null
    };

    map[receiptId] = record;
    storage.setItem(RECEIPT_SHARED_STORAGE_KEY, JSON.stringify(map));
    return record;
  } catch {
    return null;
  }
}

/**
 * Checks whether a given payment receipt has been shared.
 *
 * @param {string} receiptId
 * @param {Storage} [storage=localStorage]
 * @returns {Object|null}
 */
export function isReceiptShared(receiptId, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!receiptId || !storage) return null;
  try {
    const raw = storage.getItem(RECEIPT_SHARED_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map && typeof map === 'object' && map[receiptId] ? map[receiptId] : null;
  } catch {
    return null;
  }
}

/**
 * Retrieves all recorded shared receipts.
 *
 * @param {Storage} [storage=localStorage]
 * @returns {Record<string, Object>}
 */
export function getSharedReceipts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(RECEIPT_SHARED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Clears all shared receipt history (useful for tests or data resets).
 *
 * @param {Storage} [storage=localStorage]
 */
export function clearSharedReceipts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(RECEIPT_SHARED_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Shares a payment receipt via WhatsApp or fallback to clipboard.
 * Automatically marks the receipt as shared upon execution.
 *
 * @param {Object} customer - Customer record
 * @param {Object} receipt - Payment receipt details
 * @param {Object} [options={}] - Options { storage, windowObj, clipboardObj }
 * @returns {Promise<{ success: boolean, method: 'whatsapp'|'clipboard', message: string, url: string|null, wasCopied: boolean }>}
 */
export async function executeReceiptWhatsAppShare(customer, receipt, options = {}) {
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const win = options.windowObj ?? (typeof window !== 'undefined' ? window : null);
  const clip = options.clipboardObj ?? (typeof navigator !== 'undefined' && navigator.clipboard ? navigator.clipboard : null);

  const rawPhone = String(customer?.phone ?? '').trim();
  const cleanDigits = rawPhone.replace(/[^\d+]/g, '');
  let intlPhone = rawPhone;
  if (cleanDigits.startsWith('03') && cleanDigits.length === 11) {
    intlPhone = `+92${cleanDigits.slice(1)}`;
  } else if (cleanDigits.startsWith('3') && cleanDigits.length === 10) {
    intlPhone = `+92${cleanDigits}`;
  } else if (cleanDigits.startsWith('923') && cleanDigits.length === 12) {
    intlPhone = `+${cleanDigits}`;
  }

  const customerForAction = { ...customer, phone: intlPhone };
  const action = resolveReceiptWhatsAppAction(customerForAction, receipt);

  if (action && action.type === 'draft' && action.draft?.url) {
    // Valid phone and draft URL generated
    if (win && typeof win.open === 'function' && options.open !== false) {
      win.open(action.draft.url, '_blank', 'noopener,noreferrer');
    }

    const record = markReceiptShared(receipt.id, {
      method: 'whatsapp',
      phone: rawPhone,
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      amount: receipt.amount
    }, storage);

    return {
      success: true,
      method: 'whatsapp',
      message: action.draft.message,
      url: action.draft.url,
      record,
      wasCopied: false
    };
  }

  // Fallback: No phone number or invalid phone
  // Generate textual receipt for clipboard copy
  const fallbackMessage = [
    '🧾 SHAHDARA ISP — PAYMENT RECEIPT',
    '',
    `👤 Customer: ${customer?.name || 'Customer'}`,
    `🆔 Customer #: ${customer?.customerNumber || ''}`,
    `💰 Amount Received: ${formatPKR(receipt?.amount || 0)}`,
    `📅 Received Date: ${receipt?.date || ''}`,
    `💳 Method: ${receipt?.method || 'Cash'}`,
    `📆 Billing Month: ${receipt?.month || ''}`,
    '',
    'شکریہ! ادائیگی موصول ہو چکی ہے۔'
  ].join('\n');

  let wasCopied = false;
  if (clip && typeof clip.writeText === 'function') {
    try {
      await clip.writeText(fallbackMessage);
      wasCopied = true;
    } catch {
      wasCopied = false;
    }
  }

  const record = markReceiptShared(receipt?.id, {
    method: 'clipboard',
    phone: '',
    customerId: customer?.id,
    customerNumber: customer?.customerNumber,
    amount: receipt?.amount
  }, storage);

  return {
    success: true,
    method: 'clipboard',
    message: fallbackMessage,
    url: null,
    record,
    wasCopied
  };
}

/**
 * Calculates comprehensive quick profile metrics for mobile field use.
 *
 * @param {Object} customer - Customer object
 * @param {Object} state - Full application state
 * @param {Object} [options={}]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {Storage} [options.storage=localStorage]
 * @returns {Object} Quick profile telemetry
 */
export function calculateCustomerQuickProfile(customer, state, options = {}) {
  if (!customer) return null;
  const referenceDate = options.referenceDate instanceof Date ? options.referenceDate : new Date();
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const allocations = calculatePaymentAllocations(state);
  const currentMonth = monthsForHistory(referenceDate)[0];

  const rawPhone = String(customer.phone ?? '').trim();
  const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
  // SISP-118: the WhatsApp targets derive from the customer's dedicated
  // WhatsApp number when one is recorded; the Call target always dials
  // the primary number, and a recorded alternate number gets its own
  // tel: target alongside it.
  const waRawPhone = whatsappPhoneFor(customer);
  const waCleanPhone = waRawPhone.replace(/[^\d+]/g, '');
  let whatsappPhone = waCleanPhone;
  if (whatsappPhone.startsWith('03')) {
    whatsappPhone = '92' + whatsappPhone.slice(1);
  } else if (whatsappPhone.startsWith('3')) {
    whatsappPhone = '92' + whatsappPhone;
  }
  const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}` : null;
  const phoneUrl = cleanPhone ? `tel:${cleanPhone}` : null;
  const rawAlternatePhone = String(customer.alternatePhone ?? '').trim();
  const cleanAlternatePhone = rawAlternatePhone.replace(/[^\d+]/g, '');
  const alternatePhoneUrl = cleanAlternatePhone ? `tel:${cleanAlternatePhone}` : null;

  // Ledger and Dues
  let totalOutstandingCents = 0;
  let unpaidMonthsCount = 0;
  let earliestUnpaidMonth = null;
  let currentMonthBalanceCents = 0;
  let currentMonthStatus = 'UNBILLED';

  const bills = [...(customer.bills ?? [])].sort((a, b) => a.month.localeCompare(b.month));

  for (const bill of bills) {
    const summary = allocations.forMonth(customer.id, bill.month);
    const balance = summary?.balanceDueCents;
    if (typeof balance === 'number' && balance > 0) {
      totalOutstandingCents += balance;
      unpaidMonthsCount++;
      if (!earliestUnpaidMonth) {
        earliestUnpaidMonth = bill.month;
      }
    }
    if (bill.month === currentMonth) {
      if (typeof balance === 'number') {
        currentMonthBalanceCents = balance;
        if (balance <= 0) {
          currentMonthStatus = 'PAID';
        } else if ((summary?.sameMonthAppliedCents || 0) > 0 || (summary?.creditAppliedCents || 0) > 0 || balance < (summary?.billAmountCents || 0)) {
          currentMonthStatus = 'PARTIAL';
        } else {
          currentMonthStatus = 'PENDING';
        }
      }
    }
  }

  const totalOutstandingPkr = Math.round(totalOutstandingCents / 100);

  // Latest Payment
  let lastPayment = null;
  const allPayments = [];
  for (const bill of bills) {
    if (Array.isArray(bill.payments)) {
      for (const p of bill.payments) {
        allPayments.push({
          ...p,
          month: bill.month,
          billDueAmount: bill.dueAmount
        });
      }
    }
  }

  allPayments.sort((a, b) => {
    const cmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (cmp !== 0) return cmp;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  if (allPayments.length > 0) {
    const latest = allPayments[0];
    const sharedRecord = isReceiptShared(latest.id, storage);
    lastPayment = {
      id: latest.id,
      amount: Number(latest.amount) || 0,
      date: latest.date || '',
      method: latest.method || 'Cash',
      paidBy: latest.paidBy || '',
      month: latest.month,
      isShared: Boolean(sharedRecord?.shared),
      sharedRecord
    };
  }

  // Package Information
  const packageSpeed = customer.packageSpeed || customer.package || 'Standard';
  const monthlyRate = Number(customer.monthlySellingAmount) || 0;

  // Status Presentation
  let statusBadge = 'ACTIVE';
  if (customer.archived) {
    statusBadge = 'ARCHIVED';
  } else if (customer.status === 'offline') {
    statusBadge = 'OFFLINE';
  } else if (customer.status === 'suspended') {
    statusBadge = 'SUSPENDED';
  }

  // WhatsApp Follow-up Reminder URL
  let whatsappReminderUrl = null;
  if (totalOutstandingPkr > 0 && waRawPhone) {
    let intlPhone = waRawPhone;
    if (waCleanPhone.startsWith('03') && waCleanPhone.length === 11) {
      intlPhone = `+92${waCleanPhone.slice(1)}`;
    } else if (waCleanPhone.startsWith('3') && waCleanPhone.length === 10) {
      intlPhone = `+92${waCleanPhone}`;
    } else if (waCleanPhone.startsWith('923') && waCleanPhone.length === 12) {
      intlPhone = `+${waCleanPhone}`;
    }

    const reminder = createWhatsAppFollowupDraft(intlPhone, customer, {
      outstanding: totalOutstandingPkr,
      previousBalance: 0,
      dueDate: earliestUnpaidMonth ? `${earliestUnpaidMonth}-05` : `${currentMonth}-05`,
      packageName: packageSpeed
    }, 'friendly');
    whatsappReminderUrl = reminder?.url || null;
  }

  return {
    id: customer.id,
    customerNumber: customer.customerNumber || 0,
    name: customer.name || 'Unnamed Subscriber',
    phone: rawPhone,
    formattedPhone: formatPakistaniPhone(rawPhone),
    cleanPhone,
    whatsappUrl,
    whatsappReminderUrl,
    phoneUrl,
    alternatePhone: rawAlternatePhone,
    alternatePhoneUrl,
    area: (customer.area || customer.zone || 'Shahdara').trim(),
    mohalla: (customer.mohalla || '').trim(),
    address: (customer.address || 'Address on file').trim(),
    packageSpeed,
    monthlyRate,
    statusBadge,
    isOffline: customer.status === 'offline',
    isSuspended: customer.status === 'suspended',
    archived: Boolean(customer.archived),
    totalOutstandingCents,
    totalOutstandingPkr,
    unpaidMonthsCount,
    earliestUnpaidMonth,
    currentMonth,
    currentMonthStatus,
    currentMonthBalanceCents,
    lastPayment
  };
}

/**
 * Renders the HTML markup for the "Shared via WhatsApp" status badge.
 *
 * @param {boolean} isShared
 * @param {Object} [sharedRecord]
 * @returns {string} HTML markup
 */
export function renderReceiptSharedBadgeHtml(isShared, sharedRecord = null) {
  if (isShared) {
    let timeText = 'Shared';
    if (sharedRecord?.sharedAt) {
      try {
        const d = new Date(sharedRecord.sharedAt);
        timeText = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      } catch {
        timeText = 'Shared';
      }
    }
    const methodText = sharedRecord?.method === 'clipboard' ? 'Copied' : 'WhatsApp Sent';
    return `<span class="badge-receipt-shared" title="Receipt shared on ${sharedRecord?.sharedAt || ''}"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> ${escapeHtml(methodText)} (${escapeHtml(timeText)})</span>`;
  }
  return `<span class="badge-receipt-unshared"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> WhatsApp Pending</span>`;
}

/**
 * Renders the complete HTML body for the Mobile Customer Quick Profile sheet.
 *
 * @param {Object} profile - Result of calculateCustomerQuickProfile
 * @returns {string} HTML markup
 */
export function renderQuickProfileCardHtml(profile) {
  if (!profile) {
    return `
      <div class="mqp-empty-state">
        <p class="mqp-empty-title">Customer details unavailable</p>
      </div>
    `;
  }

  const isDuesZero = profile.totalOutstandingPkr <= 0;
  const balanceClass = isDuesZero ? 'is-settled' : (profile.currentMonthStatus === 'PARTIAL' ? 'is-partial' : 'is-overdue');
  const balanceTitle = isDuesZero
    ? 'PAID UP · NO OUTSTANDING'
    : (profile.unpaidMonthsCount > 1
      ? `OVERDUE · ${profile.unpaidMonthsCount} MONTHS UNPAID`
      : 'PENDING DUES');

  const statusClass = profile.isOffline
    ? 'role-warn'
    : profile.isSuspended
    ? 'role-danger'
    : 'role-primary';

  let lastPaymentHtml = '<p class="mqp-no-payment">No payment history recorded yet</p>';
  if (profile.lastPayment) {
    const sharedBadge = renderReceiptSharedBadgeHtml(profile.lastPayment.isShared, profile.lastPayment.sharedRecord);
    lastPaymentHtml = `
      <div class="mqp-last-payment-box">
        <div class="mqp-last-payment-row">
          <span class="mqp-last-payment-amt">PKR ${profile.lastPayment.amount.toLocaleString()}</span>
          <span class="mqp-last-payment-date">📅 ${escapeHtml(profile.lastPayment.date)}</span>
          <span class="mqp-last-payment-method">${escapeHtml(profile.lastPayment.method)}</span>
        </div>
        <div class="mqp-last-payment-sub">
          <span class="mqp-last-payment-month">Month: ${escapeHtml(profile.lastPayment.month)}</span>
          ${sharedBadge}
        </div>
      </div>
    `;
  }

  return `
    <div class="mqp-card" data-customer-id="${escapeHtml(profile.id)}">
      <!-- Header / Avatar Row -->
      <div class="mqp-header">
        <div class="mqp-avatar" aria-hidden="true">
          <span>#${escapeHtml(profile.customerNumber)}</span>
        </div>
        <div class="mqp-identity">
          <div class="mqp-name-row">
            <h3 class="mqp-name">${escapeHtml(profile.name)}</h3>
            <span class="role-badge ${statusClass}">${escapeHtml(profile.statusBadge)}</span>
          </div>
          <p class="mqp-area">📍 ${escapeHtml(profile.area)}${profile.mohalla ? ` · ${escapeHtml(profile.mohalla)}` : ''}</p>
        </div>
      </div>

      <!-- Hero Balance Banner -->
      <div class="mqp-balance-hero ${balanceClass}">
        <span class="mqp-balance-eyebrow">${escapeHtml(balanceTitle)}</span>
        <div class="mqp-balance-amount">
          <span class="mqp-currency">PKR</span>
          <span class="mqp-val">${profile.totalOutstandingPkr.toLocaleString()}</span>
        </div>
        <p class="mqp-balance-status">Current Cycle: <strong>${escapeHtml(profile.currentMonthStatus)}</strong></p>
      </div>

      <!-- Details Chips Strip -->
      <div class="mqp-details-strip">
        <div class="mqp-detail-item">
          <span class="mqp-detail-label">PACKAGE</span>
          <span class="mqp-detail-val">🚀 ${escapeHtml(profile.packageSpeed)}</span>
        </div>
        <div class="mqp-detail-item">
          <span class="mqp-detail-label">RATE</span>
          <span class="mqp-detail-val">💰 PKR ${profile.monthlyRate.toLocaleString()}/mo</span>
        </div>
        <div class="mqp-detail-item">
          <span class="mqp-detail-label">PHONE</span>
          <span class="mqp-detail-val">📱 ${escapeHtml(profile.formattedPhone)}</span>
        </div>
      </div>

      <!-- Last Payment & Delivery Section -->
      <div class="mqp-section">
        <h4 class="mqp-section-heading">Last Payment Record</h4>
        ${lastPaymentHtml}
      </div>

      <!-- 48px Touch Action Grid -->
      <div class="mqp-actions-grid" role="group" aria-label="Customer Quick Actions">
        <button type="button" class="mqp-action-btn mqp-btn-collect" data-mqp-action="collect" data-customer-id="${escapeHtml(profile.id)}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          <span>Collect Cash</span>
        </button>

        ${profile.whatsappReminderUrl || profile.whatsappUrl ? `
          <a href="${escapeHtml(profile.whatsappReminderUrl || profile.whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="mqp-action-btn mqp-btn-whatsapp" data-mqp-action="whatsapp">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <span>WhatsApp</span>
          </a>
        ` : `
          <button type="button" class="mqp-action-btn mqp-btn-whatsapp" data-mqp-action="copy-reminder" data-customer-id="${escapeHtml(profile.id)}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copy Bill</span>
          </button>
        `}

        ${profile.phoneUrl ? `
          <a href="${escapeHtml(profile.phoneUrl)}" class="mqp-action-btn mqp-btn-call" data-mqp-action="call">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>Call</span>
          </a>
        ` : ``}
        ${profile.alternatePhoneUrl ? `
          <a href="${escapeHtml(profile.alternatePhoneUrl)}" class="mqp-action-btn mqp-btn-call" data-mqp-action="call-alternate">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>Alt Call</span>
          </a>
        ` : ``}
        ${!profile.phoneUrl && !profile.alternatePhoneUrl ? `
          <button type="button" class="mqp-action-btn mqp-btn-disabled" disabled>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>No Phone</span>
          </button>
        ` : ``}

        <button type="button" class="mqp-action-btn mqp-btn-profile" data-mqp-action="profile" data-customer-id="${escapeHtml(profile.id)}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>Full Ledger</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Initializes and wires the Mobile Customer Quick Profile modal dialog.
 *
 * @param {Object} options
 * @param {Object} [options.state]
 * @param {Function} [options.getState]
 * @param {Storage} [options.storage]
 * @param {Function} [options.onCollect]
 * @param {Function} [options.onNavigate]
 * @param {Function} [options.onToast]
 * @returns {Object} Controller interface
 */
export function setupMobileQuickProfileModal(options = {}) {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) {
    return {
      open: () => false,
      close: () => false,
      refresh: () => false
    };
  }

  const modal = doc.getElementById('mobileQuickProfileModal');
  const bodyContainer = doc.getElementById('mobileQuickProfileBody');
  const closeBtn = doc.getElementById('mobileQuickProfileCloseBtn');

  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  let activeCustomerId = null;

  function getState() {
    if (typeof options.getState === 'function') {
      return options.getState();
    }
    return options.state || {};
  }

  function openCustomerProfile(customerId) {
    if (!customerId) return false;
    activeCustomerId = customerId;

    const state = getState();
    const customer = (state.customers || []).find(c => c.id === customerId);
    if (!customer) {
      if (typeof options.onToast === 'function') options.onToast('Customer not found');
      return false;
    }

    const profileData = calculateCustomerQuickProfile(customer, state, { storage });
    if (bodyContainer) {
      bodyContainer.innerHTML = renderQuickProfileCardHtml(profileData);
    }

    if (modal) {
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    }
    return true;
  }

  function closeProfileModal() {
    activeCustomerId = null;
    if (modal) {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    }
  }

  // Close button
  if (closeBtn && !closeBtn.dataset.wiredMqp) {
    closeBtn.dataset.wiredMqp = 'true';
    closeBtn.addEventListener('click', closeProfileModal);
  }

  // Backdrop click closes dialog
  if (modal && !modal.dataset.wiredMqp) {
    modal.dataset.wiredMqp = 'true';
    modal.addEventListener('click', (event) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        closeProfileModal();
      }
    });

    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeProfileModal();
      }
    });
  }

  // Actions delegate on body container
  if (bodyContainer && !bodyContainer.dataset.wiredMqp) {
    bodyContainer.dataset.wiredMqp = 'true';
    bodyContainer.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-mqp-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-mqp-action');
      const custId = btn.getAttribute('data-customer-id') || activeCustomerId;

      if (action === 'collect') {
        closeProfileModal();
        if (typeof options.onCollect === 'function') {
          options.onCollect(custId);
        } else if (typeof window !== 'undefined' && window.quickCollectController?.openForCustomer) {
          window.quickCollectController.openForCustomer(custId);
        }
      } else if (action === 'profile') {
        closeProfileModal();
        if (typeof options.onNavigate === 'function') {
          options.onNavigate(custId);
        } else if (typeof window !== 'undefined' && typeof window.selectCustomer === 'function') {
          window.selectCustomer(custId);
        }
      } else if (action === 'copy-reminder') {
        const state = getState();
        const cust = (state.customers || []).find(c => c.id === custId);
        if (cust) {
          const profileData = calculateCustomerQuickProfile(cust, state, { storage });
          const text = [
            `🧾 *SHAHDARA ISP BILL REMINDER*`,
            `👤 Customer: ${cust.name} (#${cust.customerNumber})`,
            `💰 Outstanding Balance: PKR ${profileData.totalOutstandingPkr.toLocaleString()}`,
            `📦 Package: ${profileData.packageSpeed}`,
            `مهربانی فرما کر اپنے انٹرنیٹ کے بقایا جات بروقت ادا کریں۔ شکریہ!`
          ].join('\n');

          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(text);
              if (typeof options.onToast === 'function') {
                options.onToast('Bill summary copied to clipboard!');
              }
            } catch {
              // Ignore copy error
            }
          }
        }
      }
    });
  }

  // Global delegate for [data-open-quick-profile]
  if (doc && !doc.dataset?.wiredMqpGlobal) {
    if (doc.dataset) doc.dataset.wiredMqpGlobal = 'true';
    doc.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-open-quick-profile]');
      if (!trigger) return;
      const custId = trigger.getAttribute('data-customer-id') || trigger.getAttribute('data-open-quick-profile');
      if (custId) {
        event.preventDefault();
        openCustomerProfile(custId);
      }
    });
  }

  const controller = {
    open: openCustomerProfile,
    close: closeProfileModal,
    refresh: () => {
      if (activeCustomerId) {
        openCustomerProfile(activeCustomerId);
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.mobileQuickProfileController = controller;
  }

  return controller;
}
