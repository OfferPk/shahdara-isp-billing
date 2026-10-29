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
  applyConcessionToBill,
  deletePayment,
  calculatePaymentAllocations,
  derivedBillStatus,
  monthsForHistory,
  formatPKR,
  PAYMENT_METHODS,
  isDigitalPaymentMethod,
  isCashPaymentMethod,
  findDuplicatePaymentReference,
  removeConcessionFromBill
} from './core.js';
import { loadComplaints } from './complaint-register.js';
import {
  billedTicketChargesPending,
  loadTickets,
  pendingTicketChargeLines,
  planTicketChargeSettlement,
  saveTickets,
  settleTicketCharges,
  unsettleTicketChargesForPayment
} from './complaint-tickets.js';
import { buildConcessionSuggestion, concessionBadgeText, netDueAfterConcession } from './concession-helper.js?v=1.11.0';
import { normalPaymentBlockReason } from './advance-payment.js';
import { buildMonthlyUptime, splitMinutes } from './uptime-tracking.js';
import { t } from './nav-language.js';
import {
  getDigitalPaymentsSettings,
  hasConfiguredDigitalPayments,
  formatDigitalPaymentReceiptNote,
  formatDigitalPaymentWhatsAppText
} from './digital-payments-settings.js';
import { formatWhatsAppUrl } from './form-validation.js';
import { thermalPrinter, buildEscPosReceipt, isWebBluetoothAvailable } from './thermal-printer.js?v=1.0.0';
import {
  isReceiptShared,
  markReceiptShared,
  renderReceiptSharedBadgeHtml
} from './nav-quick-profile.js';
import {
  announcePaymentSuccess,
  trapModalFocus
} from './nav-accessibility.js';

export const QUICK_COLLECT_STORAGE_KEY = 'shahdara_quick_collect_last_used_v1';
export const QUICK_COLLECT_AUDIT_KEY = 'shahdara_quick_collect_audits_v1';

// ------------------------------------------------------ Payment proof image --
// Owner feature (2026-10-29): a payment can carry ONE proof screenshot —
// the wallet receipt image the customer sent, attached by the operator at
// save time and kept on the payment record (payment.screenshot). The
// ledger lives in localStorage under the storage-safety quota guard
// (SAVE_SIZE_WARN_BYTES = 4 MB), so a raw 1-4 MB phone screenshot must
// NEVER be stored as picked: every proof is downscaled + recompressed
// here first, and the stored data URL is capped at
// PAYMENT_PROOF_MAX_DATA_URL_LENGTH characters (~200 KB — small enough
// that many proofs fit before the guard warns, and comfortably inside
// the 350,000-char outer sanitize ceiling validatePayment applies to
// records that arrived by any path). The ladder tries the full 1024 px
// size first, steps JPEG quality down, then the dimension down, until
// the data URL fits; if nothing fits it refuses with a 'proof-too-large'
// coded error and nothing is stored. Receipt PNGs are generated, never
// stored — this is the only image the ledger keeps.
export const PAYMENT_PROOF_MAX_DIMENSION = 1024;
export const PAYMENT_PROOF_MAX_DATA_URL_LENGTH = 200_000;
export const PAYMENT_PROOF_DIMENSION_STEPS = [1024, 832, 640, 512];
export const PAYMENT_PROOF_QUALITY_STEPS = [0.82, 0.7, 0.58, 0.46, 0.34];

/** Pure: fit (width, height) inside maxDimension on the longest side; never upscales. */
export function planPaymentProofSize(width, height, maxDimension = PAYMENT_PROOF_MAX_DIMENSION) {
  const w = Number(width);
  const h = Number(height);
  const max = Number(maxDimension);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || !Number.isFinite(max) || max <= 0) return null;
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Pure: the stored-proof shape rule — an image data URL within the storage cap. */
export function isPaymentProofDataUrl(value, maxLength = PAYMENT_PROOF_MAX_DATA_URL_LENGTH) {
  return typeof value === 'string' && value.startsWith('data:image/') && value.length <= maxLength;
}

function proofTooLargeError() {
  const error = new Error('Payment proof image could not be shrunk enough to store safely.');
  error.code = 'proof-too-large';
  return error;
}

// Browser defaults for the compression pipeline, behind injectable deps
// so the ladder itself is unit-testable in Node with fakes (no DOM).
async function decodeProofImageDefault(source) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(source); } catch { /* fall through to <img> decode */ }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    return img;
  } finally { URL.revokeObjectURL(url); }
}
function drawProofCanvasDefault(image, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  return canvas;
}
function encodeProofJpegDefault(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Could not encode payment proof image.')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read payment proof image.'));
      reader.readAsDataURL(blob);
    }, 'image/jpeg', quality);
  });
}

/**
 * Downscale + recompress a picked image into a storable proof data URL
 * (the cap ladder above). Resolves with a string accepted by
 * isPaymentProofDataUrl; rejects with a 'proof-too-large' coded error
 * when even the smallest ladder step cannot fit the cap.
 */
export async function compressPaymentProofImage(source, deps = {}) {
  const decodeImage = deps.decodeImage ?? decodeProofImageDefault;
  const drawCanvas = deps.drawCanvas ?? drawProofCanvasDefault;
  const encodeJpeg = deps.encodeJpeg ?? encodeProofJpegDefault;
  const image = await decodeImage(source);
  const srcWidth = Number(image?.width ?? image?.naturalWidth);
  const srcHeight = Number(image?.height ?? image?.naturalHeight);
  try {
    for (const maxDimension of PAYMENT_PROOF_DIMENSION_STEPS) {
      const plan = planPaymentProofSize(srcWidth, srcHeight, maxDimension);
      if (!plan) break;
      const canvas = drawCanvas(image, plan.width, plan.height);
      for (const quality of PAYMENT_PROOF_QUALITY_STEPS) {
        const dataUrl = await encodeJpeg(canvas, quality);
        if (isPaymentProofDataUrl(dataUrl)) return dataUrl;
      }
    }
  } finally {
    if (typeof image?.close === 'function') { try { image.close(); } catch { /* already released */ } }
  }
  throw proofTooLargeError();
}

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
export function getCustomerPaymentDefaults(state, customerId, referenceDate = new Date(), tickets = null) {
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
  let currentMonthBalanceCents = 0;
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

  // SISP-43: pending billed ticket charges (SISP-12) join the payable.
  // Tickets live outside the ledger state, so the caller passes the
  // current ticket list; without one the defaults stay bill-only,
  // exactly as before. When charges are pending, the 1-tap suggested
  // amount is the FULL payable (bill dues + charges) so one collection
  // settles both — the spec scenario: 3,000 bill + 500 charge = 3,500.
  const ticketChargeLines = Array.isArray(tickets) ? pendingTicketChargeLines(tickets, customerId) : [];
  const ticketChargesPendingCents = ticketChargeLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
  const ticketChargesPending = ticketChargesPendingCents / 100;
  const payableTotal = (totalDuesCents + ticketChargesPendingCents) / 100;
  if (ticketChargesPending > 0 && payableTotal > 0) {
    suggestedAmount = payableTotal;
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
    currentMonthBalance: Math.max(0, currentMonthBalanceCents / 100),
    totalDues,
    ticketChargeLines,
    ticketChargesPending,
    payableTotal,
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
  paidBy,
  transactionId,
  referenceOverrideReason,
  screenshot,
  strictDigitalReference,
  enforceDigitalReference,
  tickets,
  kind
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

  const isDigital = isDigitalPaymentMethod(pMethod);
  const cleanTxnId = String(transactionId ?? '').trim().slice(0, 64);
  const cleanReason = String(referenceOverrideReason ?? '').trim().slice(0, 100);

  if ((strictDigitalReference || enforceDigitalReference) && isDigital && !cleanTxnId && !cleanReason) {
    throw new Error('Transaction ID / last 6 digits is required for digital payments (or provide an override reason).');
  }

  // Save last used method preference to device storage
  try {
    localStorage.setItem(QUICK_COLLECT_STORAGE_KEY, pMethod);
  } catch {
    // Ignore storage issues
  }

  // SISP-43: when the caller supplies the ticket list, the part of the
  // collection that exceeds the customer's total bill dues settles
  // pending billed ticket charges — whole charges, oldest first. The
  // settled lines are stamped onto the payment itself (core keeps that
  // portion out of bill allocation), so the cash has exactly one ledger
  // record and the tickets are marked paid against it below.
  let settledTicketLines = [];
  if (Array.isArray(tickets)) {
    const preAllocations = calculatePaymentAllocations(state);
    let preDuesCents = 0;
    for (const b of (customer.bills ?? [])) {
      const s = preAllocations.forMonth(customerId, b.month);
      if (s?.balanceDueCents && s.balanceDueCents > 0) preDuesCents += s.balanceDueCents;
    }
    const remainderCents = Math.max(0, Math.round(numAmount * 100) - preDuesCents);
    settledTicketLines = planTicketChargeSettlement(tickets, customerId, remainderCents).lines;
  }

  // Create immutable payment entry through core function. An explicit
  // kind:'advance' tags the collection as advance credit (the only way
  // core accepts money against an already-paid bill); anything else
  // stays an ordinary untagged payment, exactly as before.
  const nextState = addPayment(state, customerId, targetMonth, {
    date: pDate,
    amount: numAmount,
    method: pMethod,
    kind: kind === 'advance' ? 'advance' : undefined,
    paidBy: paidBy ? String(paidBy).trim() : undefined,
    transactionId: cleanTxnId || undefined,
    referenceOverrideReason: cleanReason || undefined,
    screenshot: (typeof screenshot === 'string' && screenshot.startsWith('data:image/')) ? screenshot : undefined,
    ticketCharges: settledTicketLines.length > 0 ? settledTicketLines : undefined
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

  // SISP-43: mark the settled tickets paid against this payment (the
  // caller persists nextTickets) and recompute the overall payable —
  // bill dues plus any ticket charges still pending afterwards.
  let nextTickets;
  let ticketChargesPendingAfter = 0;
  if (Array.isArray(tickets)) {
    if (settledTicketLines.length > 0) {
      nextTickets = settleTicketCharges(tickets, settledTicketLines, paymentId, referenceDate);
    }
    ticketChargesPendingAfter = billedTicketChargesPending(nextTickets ?? tickets, customerId);
  }
  const ticketChargesTotal = settledTicketLines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0) / 100;
  const payableRemaining = Math.round((newTotalDues + ticketChargesPendingAfter) * 100) / 100;

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
    transactionId: cleanTxnId,
    referenceOverrideReason: cleanReason,
    screenshot: (typeof screenshot === 'string' && screenshot.startsWith('data:image/')) ? screenshot : '',
    isDigital,
    newBalanceDue,
    newTotalDues,
    ticketCharges: settledTicketLines,
    ticketChargesTotal,
    ticketChargesPending: ticketChargesPendingAfter,
    payableRemaining,
    isSettled: newTotalDues <= 0 && ticketChargesPendingAfter <= 0,
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

  return { nextState, receipt, nextTickets };
}

/**
 * Builds bilingual (Urdu & English) WhatsApp payment receipt draft.
 *
 * @param {Object} receipt
 * @returns {{ text: string, url: string }}
 */
export function formatQuickCollectWhatsAppReceipt(receipt) {
  const amountStr = Number(receipt.amount).toLocaleString('en-PK');
  const remainingPayable = receipt.payableRemaining ?? receipt.newTotalDues ?? receipt.newBalanceDue ?? 0;
  const balanceStr = Number(remainingPayable).toLocaleString('en-PK');
  const statusUrdu = (remainingPayable <= 0) ? 'مکمل ادا شدہ (PAID IN FULL)' : 'جزوی ادائیگی (PARTIAL)';
  // SISP-43: settled ticket charges print as their own receipt lines.
  const ticketChargeLines = (Array.isArray(receipt.ticketCharges) ? receipt.ticketCharges : [])
    .map(line => `🔧 *Murammat / Material Charge (${line.ticketId}):* PKR ${Number(line.amount).toLocaleString('en-PK')}`);

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
    ...ticketChargeLines,
    `💳 *Payment Method:* ${receipt.method}`,
    receipt.transactionId ? `🔢 *Transaction ID / Ref:* ${receipt.transactionId}` : null,
    receipt.referenceOverrideReason ? `📝 *Ref Note:* ${receipt.referenceOverrideReason}` : null,
    receipt.paidBy ? `✍️ *Paid By:* ${receipt.paidBy}` : null,
    ``,
    `⚖️ *Remaining Balance:* PKR ${balanceStr}`,
    `📌 *Status:* ${statusUrdu}`,
    ``,
    `Shukriya! Thank you for your prompt payment.`,
    `Shahdara NOC & Field Billing Operations`,
    formatDigitalPaymentReceiptNote(getDigitalPaymentsSettings()) ? `ℹ️ ${formatDigitalPaymentReceiptNote(getDigitalPaymentsSettings())}` : null,
    `━━━━━━━━━━━━━━━━━━━━━━━━`
  ];

  const text = lines.filter(Boolean).join('\n');
  const wa = formatWhatsAppUrl(receipt.phone, text);
  return { text, url: wa.url || '', validPhone: wa.validPhone, formattedPhone: wa.formattedPhone };
}

/**
 * Generates an image Blob for the payment receipt using offscreen canvas.
 * Falls back to null if Canvas is not supported.
 *
 * @param {Object} receipt
 * @returns {Promise<Blob|null>}
 */
export async function generateReceiptImageBlob(receipt) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  canvas.width = 600;
  canvas.height = 540;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 600, 540);

  // Top header banner
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 600, 90);

  // Brand title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('SHAHDARA FIBER NETWORK', 30, 40);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText('OFFICIAL PAYMENT RECEIPT / ادائیگی کی رسید', 30, 68);

  // Receipt Number & Date
  ctx.fillStyle = '#64748b';
  ctx.font = '13px monospace';
  ctx.fillText(`Receipt: ${receipt.receiptNumber || 'RCPT'}`, 30, 125);
  ctx.fillText(`Date: ${receipt.date || ''}`, 420, 125);

  // Divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 140);
  ctx.lineTo(570, 140);
  ctx.stroke();

  // Customer info
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillText(receipt.customerName || 'Subscriber', 30, 175);

  ctx.fillStyle = '#64748b';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Account #${receipt.customerNumber || ''} · ${receipt.area || 'Shahdara'}${receipt.phone ? ' · ' + receipt.phone : ''}`, 30, 202);

  // Amount box
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(30, 225, 540, 90);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(30, 225, 540, 90);

  ctx.fillStyle = '#64748b';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText('AMOUNT RECEIVED / وصول شدہ رقم', 50, 255);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(`PKR ${Number(receipt.amount || 0).toLocaleString('en-PK')}`, 50, 295);

  // Grid details
  ctx.fillStyle = '#64748b';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText('Payment Method', 30, 350);
  ctx.fillText('Billing Month', 230, 350);
  ctx.fillText('Remaining Balance', 420, 350);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(receipt.method || 'Cash', 30, 375);
  ctx.fillText(receipt.month || '-', 230, 375);

  const balColor = (receipt.newTotalDues <= 0) ? '#059669' : '#dc2626';
  ctx.fillStyle = balColor;
  ctx.fillText(`PKR ${Number(receipt.newTotalDues || 0).toLocaleString('en-PK')}`, 420, 375);

  // Status badge line
  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(receipt.newTotalDues <= 0 ? '✓ Bill settled in full (مکمل ادا شدہ)' : '⏳ Partial payment recorded (جزوی ادائیگی)', 30, 420);
  if (receipt.transactionId) {
    ctx.fillStyle = '#475569';
    ctx.font = '13px monospace';
    ctx.fillText(`Txn ID: ${receipt.transactionId}`, 30, 442);
    if (receipt.paidBy) {
      ctx.font = 'italic 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Paid by: ${receipt.paidBy}`, 320, 442);
    }
  } else if (receipt.paidBy) {
    ctx.fillText(`Paid by: ${receipt.paidBy}`, 30, 442);
  }

  // Footer divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(30, 465);
  ctx.lineTo(570, 465);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('Shahdara ISP Billing & NOC Operations · Computer generated receipt · Shukriya!', 30, 495);

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    } catch {
      resolve(null);
    }
  });
}


/**
 * Generates customer picker list markup.
 *
 * @param {Array<Object>} customers
 * @param {string|null} [activeCustomerId=null]
 * @returns {string}
 */
/**
 * Empty state shown when nobody has a pending balance: never an empty, broken-looking list.
 * The button switches the picker to the "All" filter (paid customers included).
 *
 * @returns {string}
 */
export function customerHasMonthlyFee(customer) {
  const positive = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0;
  if (positive(customer?.monthlySellingAmount)) return true;
  return (customer?.monthlyPriceSchedule ?? []).some(entry => positive(entry?.amount));
}

/** Active customers with no package / monthly fee, so no bill can be generated for them (#248). */
export function countCustomersWithoutFee(state) {
  return (state?.customers ?? []).filter(c => !c.archived && !customerHasMonthlyFee(c)).length;
}

/**
 * Empty state when nobody owes anything AND customers have no package/fee yet (#248): explain why
 * the list is empty and offer to set packages / generate this month's bills.
 */
export function renderQuickCollectNeedsSetupHtml(withoutFee, { showAll = true } = {}) {
  return `
      <div class="qc-empty-state qc-needs-setup" role="status">
        <span class="qc-empty-icon" aria-hidden="true">🧾</span>
        <h4>No pending dues</h4>
        <p><strong data-qc-no-fee-count>${Number(withoutFee)}</strong> customer${withoutFee === 1 ? ' has' : 's have'} no package / monthly fee yet, so no bill is due. Set a package to generate bills.</p>
        <div class="qc-setup-actions">
          <button type="button" class="primary-button" data-qc-setup-packages>Set packages &amp; monthly fee</button>
          <button type="button" class="secondary-button" data-qc-generate-bills>Generate this month's bills</button>
          ${showAll ? '<button type="button" class="secondary-button qc-show-all-btn" data-qc-show-all>Sab customers dikhayein · Show all</button>' : ''}
        </div>
      </div>
    `;
}

export function renderQuickCollectAllCollectedHtml() {
  return `
      <div class="qc-empty-state qc-all-collected" role="status">
        <span class="qc-empty-icon" aria-hidden="true">✅</span>
        <h4>Sab ka bill wusool ho gaya</h4>
        <p>No pending dues right now — every customer's bill is collected.</p>
        <button type="button" class="secondary-button qc-show-all-btn" data-qc-show-all>Sab customers dikhayein · Show all</button>
      </div>
    `;
}

/**
 * Picker contents for a filter: pending (default) lists only customers with an unpaid balance
 * (partially paid customers stay, with their remaining amount); "all" also shows paid ones.
 *
 * @param {Object} state
 * @param {string} query
 * @param {('all-dues'|'high-dues'|'all')} filterType
 * @param {string|null} [activeCustomerId]
 * @returns {{ html: string, customers: Array<Object>, allCollected: boolean, needsSetup: boolean, withoutFee: number }}
 */
export function renderQuickCollectPickerHtml(state, query = '', filterType = 'all-dues', activeCustomerId = null) {
  const customers = getPendingCollectionCustomers(state, query, filterType);
  const allCollected = customers.length === 0
    && filterType !== 'all'
    && !String(query ?? '').trim()
    && getPendingCollectionCustomers(state, '', 'all-dues').length === 0;
  const withoutFee = allCollected ? countCustomersWithoutFee(state) : 0;
  const needsSetup = allCollected && withoutFee > 0;
  return {
    customers,
    allCollected,
    needsSetup,
    withoutFee,
    html: needsSetup
      ? renderQuickCollectNeedsSetupHtml(withoutFee)
      : allCollected ? renderQuickCollectAllCollectedHtml() : renderQuickCollectCustomerListHtml(customers, activeCustomerId)
  };
}

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
  const remainingPayable = receipt.payableRemaining ?? receipt.newTotalDues;
  const isSettled = remainingPayable <= 0;
  const shared = isReceiptShared(receipt.id);
  const sharedBadge = renderReceiptSharedBadgeHtml(Boolean(shared?.shared), shared);
  // SISP-43: ticket charges settled by this receipt, one row per ticket.
  const ticketChargeRows = (Array.isArray(receipt.ticketCharges) ? receipt.ticketCharges : []).map(line => `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Murammat / Material Charge (${escapeHtml(line.ticketId)})</span>
          <strong class="qc-meta-val">PKR ${Number(line.amount).toLocaleString('en-PK')}</strong>
        </div>`).join('');
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
          <strong class="qc-meta-val ${remainingPayable > 0 ? 'has-balance' : 'zero-balance'}">
            PKR ${Number(remainingPayable).toLocaleString('en-PK')}
          </strong>
        </div>
        ${ticketChargeRows}
        ${receipt.transactionId ? `
        <div class="qc-receipt-item full-width" data-qc-receipt-txnid>
          <span class="qc-meta-label">Transaction ID / Ref</span>
          <strong class="qc-meta-val"><code class="qc-txnid-code">${escapeHtml(receipt.transactionId)}</code></strong>
        </div>` : ''}
        ${receipt.referenceOverrideReason ? `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Ref Note / Override</span>
          <strong class="qc-meta-val">${escapeHtml(receipt.referenceOverrideReason)}</strong>
        </div>` : ''}
        ${receipt.screenshot ? `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Attached Screenshot</span>
          <img src="${escapeHtml(receipt.screenshot)}" alt="Payment proof" style="max-height:80px; border-radius:6px; margin-top:4px; display:block;">
        </div>` : ''}
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
 * @returns {Object} Controller with { open, close, selectAndOpen, isOpen, getState, commitState, refresh }
 */
export function setupQuickCollectModal({
  getState,
  onSaveState,
  onToast,
  onSelectCustomer,
  onEditCustomer
}) {
  const modal = document.getElementById('quickCollectModal');
  if (!modal) {
    return {
      open: () => {},
      close: () => {},
      selectAndOpen: () => {},
      isOpen: () => false,
      getState: () => getState(),
      commitState: (nextState) => { if (typeof onSaveState === 'function') onSaveState(nextState); },
      refresh: () => {}
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
  const advanceCheckbox = document.getElementById('quickCollectAdvanceCheckbox');
  const dueAmountVal = document.getElementById('quickCollectDueAmountVal');
  const quickAmountChips = modal.querySelectorAll('.quick-amount-chip');
  const quickMethodChips = modal.querySelectorAll('.quick-method-chip');

  // SISP-30: outage concession badge host (null when the host page predates it).
  const concessionBox = typeof document !== 'undefined' ? document.getElementById('quickCollectConcessionBox') : null;

  // Uptime tracking: one-line online/offline summary host for the
  // selected bill month (null when the host page predates it).
  const uptimeLine = typeof document !== 'undefined' ? document.getElementById('quickCollectUptimeLine') : null;

  // Digital Payment Elements
  const digitalFieldsContainer = document.getElementById('quickCollectDigitalFields');
  const transactionIdInput = document.getElementById('quickCollectTransactionIdInput');
  const overrideDetails = document.getElementById('quickCollectOverrideDetails');
  const overrideReasonInput = document.getElementById('quickCollectOverrideReasonInput');
  const screenshotInput = document.getElementById('quickCollectScreenshotInput');
  const screenshotPreviewWrap = document.getElementById('quickCollectScreenshotPreviewWrap');
  const screenshotPreview = document.getElementById('quickCollectScreenshotPreview');
  const removeScreenshotBtn = document.getElementById('quickCollectRemoveScreenshotBtn');
  const ownerPaymentInfo = document.getElementById('quickCollectOwnerPaymentInfo');

  // Duplicate Warning In-App Card (#279)
  const dupWarningCard = document.getElementById('quickCollectDuplicateWarning');
  const dupMsg = document.getElementById('quickCollectDuplicateMsg');
  const dupReasonInput = document.getElementById('quickCollectDuplicateReasonInput');
  const dupProceedBtn = document.getElementById('quickCollectDuplicateProceedBtn');
  const dupCancelBtn = document.getElementById('quickCollectDuplicateCancelBtn');
  let duplicateBypassedForTxn = null;

  let currentScreenshotDataUrl = '';

  // Success Elements
  const receiptCardContainer = document.getElementById('quickCollectReceiptCard');
  const whatsAppBtn = document.getElementById('quickCollectWhatsAppBtn');
  const shareImageBtn = document.getElementById('quickCollectShareImageBtn');
  const undoBtn = document.getElementById('quickCollectUndoBtn');
  const printReceiptBtn = document.getElementById('quickCollectPrintReceiptBtn');
  const anotherBtn = document.getElementById('quickCollectAnotherBtn');
  const doneCloseBtn = document.getElementById('quickCollectDoneCloseBtn');
  const goToTransactionsBtn = document.getElementById('quickCollectGoToTransactionsBtn');

  let activeFilter = 'all-dues';
  let activeCustomerId = null;
  let activeDefaults = null;
  let activeReceipt = null;
  let activeUndoContext = null;
  const UNDO_WINDOW_MS = 5000;
  let undoTimeoutId = null;
  let undoCountdownId = null;
  let undoDeadline = 0;
  // True once the current opening's close-cleanup has run. The dialog 'close'
  // event and closeModal() can both fire for one close; cleanup must run
  // exactly once per opening (openModal resets this to false).
  let closeCleanupHandled = true;

  function updateDigitalVisibility(methodVal) {
    const isDig = isDigitalPaymentMethod(methodVal);
    if (digitalFieldsContainer) {
      digitalFieldsContainer.hidden = !isDig;
    }
    if (isDig && ownerPaymentInfo) {
      const settings = getDigitalPaymentsSettings();
      if (hasConfiguredDigitalPayments(settings)) {
        ownerPaymentInfo.hidden = false;
        ownerPaymentInfo.innerHTML = `
          <div class="qc-owner-info-box">
            <span class="qc-owner-info-title">💡 Customer direct pay / اکاؤنٹ تفصیلات:</span>
            <div class="qc-owner-details-grid">
              ${settings.ownerAccountTitle ? `<div><small>Title:</small> <strong>${escapeHtml(settings.ownerAccountTitle)}</strong></div>` : ''}
              ${settings.ownerRaastId ? `<div><small>⚡ Raast:</small> <strong class="qc-copyable-code">${escapeHtml(settings.ownerRaastId)}</strong></div>` : ''}
              ${settings.ownerTillId ? `<div><small>📱 Till ID:</small> <strong class="qc-copyable-code">${escapeHtml(settings.ownerTillId)}</strong></div>` : ''}
              ${(settings.ownerBankName && settings.ownerAccountNumber) ? `<div><small>🏦 ${escapeHtml(settings.ownerBankName)}:</small> <strong>${escapeHtml(settings.ownerAccountNumber)}</strong></div>` : ''}
            </div>
            ${settings.ownerQrDataUrl ? `<div class="qc-owner-qr-thumb-wrap"><img src="${settings.ownerQrDataUrl}" alt="Owner Payment QR" class="qc-owner-qr-thumb"></div>` : ''}
          </div>
        `;
      } else {
        ownerPaymentInfo.hidden = true;
        ownerPaymentInfo.innerHTML = '';
      }
    } else if (ownerPaymentInfo) {
      ownerPaymentInfo.hidden = true;
      ownerPaymentInfo.innerHTML = '';
    }
  }

  // Handle screenshot upload & preview: the picked image is downscaled +
  // recompressed to the storable proof cap BEFORE it is kept — a raw
  // phone screenshot would blow the ledger's storage quota. A pick that
  // cannot be shrunk enough is refused with a message and nothing is
  // stored (the old flat 1 MB pick rejection is gone: big originals
  // are welcome, only the stored copy is small).
  screenshotInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      currentScreenshotDataUrl = await compressPaymentProofImage(file);
      if (screenshotPreview) screenshotPreview.src = currentScreenshotDataUrl;
      if (screenshotPreviewWrap) screenshotPreviewWrap.hidden = false;
    } catch {
      currentScreenshotDataUrl = '';
      screenshotInput.value = '';
      if (screenshotPreviewWrap) screenshotPreviewWrap.hidden = true;
      if (screenshotPreview) screenshotPreview.src = '';
      if (typeof onToast === 'function') onToast(t('proof_too_large'));
    }
  });

  removeScreenshotBtn?.addEventListener('click', () => {
    currentScreenshotDataUrl = '';
    if (screenshotInput) screenshotInput.value = '';
    if (screenshotPreviewWrap) screenshotPreviewWrap.hidden = true;
    if (screenshotPreview) screenshotPreview.src = '';
  });

  function syncMethodChips(val) {
    quickMethodChips.forEach(chip => {
      const isMatch = chip.getAttribute('data-method') === val;
      chip.classList.toggle('is-active', isMatch);
    });
  }

  // Wire 1-tap method chips
  quickMethodChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const chosenMethod = chip.getAttribute('data-method');
      if (methodSelect && chosenMethod) {
        methodSelect.value = chosenMethod;
      }
      syncMethodChips(chosenMethod);
      updateDigitalVisibility(chosenMethod);
    });
  });

  methodSelect?.addEventListener('change', () => {
    syncMethodChips(methodSelect.value);
    updateDigitalVisibility(methodSelect.value);
  });

  // SISP-30: refresh the concession badge when the operator picks another month.
  monthSelect?.addEventListener('change', () => {
    if (activeCustomerId) renderConcessionBox(activeCustomerId, monthSelect.value);
    if (activeCustomerId) renderUptimeLine(activeCustomerId, monthSelect.value);
  });

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
    customerListContainer.innerHTML = renderQuickCollectPickerHtml(state, query, activeFilter, activeCustomerId).html;
  }

  function setFilter(filter) {
    activeFilter = filter || 'all-dues';
    filterChips.forEach(c => {
      const isActive = c.getAttribute('data-filter') === activeFilter;
      c.classList.toggle('is-active', isActive);
      c.setAttribute('aria-selected', String(isActive));
    });
  }

  function showStep(stepName) {
    if (stepPick) stepPick.hidden = (stepName !== 'pick');
    if (stepForm) stepForm.hidden = (stepName !== 'form');
    if (stepSuccess) stepSuccess.hidden = (stepName !== 'success');
  }

  // SISP-30: outage concession badge + 1-click apply/remove for one bill
  // month. The suggested amount is recomputed at click time from fresh
  // complaints, never trusted from markup. After an apply, the amount field
  // is pointed at the net due so the collector collects the conceded amount.
  // Uptime tracking: compact duration text ("28 days 18 hours") from
  // the shared upt_dur_* strings.
  function qcDurationText(totalMinutes) {
    const parts = splitMinutes(totalMinutes);
    const pieces = [];
    if (parts.days) pieces.push(parts.days === 1 ? t('upt_dur_day_1') : t('upt_dur_days', null, { n: parts.days }));
    if (parts.hours) pieces.push(parts.hours === 1 ? t('upt_dur_hour_1') : t('upt_dur_hours', null, { n: parts.hours }));
    if (parts.minutes) pieces.push(parts.minutes === 1 ? t('upt_dur_min_1') : t('upt_dur_mins', null, { n: parts.minutes }));
    return pieces.length ? pieces.join(' ') : t('upt_dur_zero');
  }

  // Uptime tracking: the month-end online/offline summary the owner
  // wants in front of the collector while the month's bill is being
  // paid. Unlike the concession box it needs no bill — it renders for
  // any customer (including free connections) from their recorded
  // offline periods and status history alone.
  function renderUptimeLine(customerId, month) {
    if (!uptimeLine) return;
    uptimeLine.textContent = '';
    try {
      const state = getState();
      if (!state || !customerId || !month) return;
      const customer = state.customers.find(c => c.id === customerId);
      if (!customer) return;
      const summary = buildMonthlyUptime(customer, month, new Date());
      uptimeLine.textContent = t('upt_qc_line', null, {
        month,
        online: qcDurationText(summary.onlineMinutes),
        offline: qcDurationText(summary.offlineMinutes),
        days: summary.daysInMonth
      });
    } catch {
      uptimeLine.textContent = '';
    }
  }

  function renderConcessionBox(customerId, month) {
    if (!concessionBox) return;
    concessionBox.innerHTML = '';
    try {
      const state = getState();
      if (!state || !customerId || !month) return;
      const customer = state.customers.find(c => c.id === customerId);
      const bill = customer?.bills?.find(b => b.month === month);
      if (!customer || !bill) return;
      const suggestion = buildConcessionSuggestion(customer, bill, loadComplaints());
      const allocations = calculatePaymentAllocations(state);
      const balanceCents = allocations.forMonth(customerId, month)?.balanceDueCents;
      const balance = typeof balanceCents === 'number' ? balanceCents / 100 : null;
      if (suggestion.alreadyApplied) {
        const net = balance !== null ? netDueAfterConcession(balance, suggestion.existingAmount) : null;
        concessionBox.innerHTML = `<span class="discount-badge-applied">Outage concession (Reaayat): −PKR ${suggestion.existingAmount}</span> <small>(${escapeHtml(suggestion.existingReason || 'Outage Reaayat')})</small>${net !== null ? ` <span>Net due: PKR ${net}</span>` : ''} <button type="button" class="waive-late-fee-btn" data-qc-remove-concession>Remove</button>`;
      } else if (suggestion.eligible) {
        concessionBox.innerHTML = `<span class="discount-badge-applied">${escapeHtml(concessionBadgeText(suggestion))}</span>${balance !== null && balance > 0 ? ` <button type="button" class="apply-late-fee-btn" data-qc-apply-concession>Apply Rs. ${suggestion.suggestedAmount} Outage Concession</button>` : ''}`;
      } else {
        return;
      }
      concessionBox.querySelector('[data-qc-apply-concession]')?.addEventListener('click', () => {
        try {
          const freshState = getState();
          const freshCustomer = freshState.customers.find(c => c.id === customerId);
          const freshBill = freshCustomer?.bills?.find(b => b.month === month);
          if (!freshCustomer || !freshBill) throw new Error('Bill not found for this concession.');
          const fresh = buildConcessionSuggestion(freshCustomer, freshBill, loadComplaints());
          if (!fresh.eligible) throw new Error('No outage concession is due for this bill month.');
          const next = applyConcessionToBill(freshState, customerId, month, { amount: fresh.suggestedAmount, reason: fresh.reason });
          if (typeof onSaveState === 'function') onSaveState(next);
          openCustomerCollectionForm(customerId);
          const netAllocations = calculatePaymentAllocations(getState());
          const netBalanceCents = netAllocations.forMonth(customerId, month)?.balanceDueCents;
          if (amountInput && typeof netBalanceCents === 'number') {
            amountInput.value = netDueAfterConcession(netBalanceCents / 100, fresh.suggestedAmount).toFixed(2);
          }
          if (typeof onToast === 'function') onToast(`Outage concession of PKR ${fresh.suggestedAmount} applied to bill ${month}.`);
        } catch (err) {
          if (typeof onToast === 'function') onToast(err.message);
        }
      });
      concessionBox.querySelector('[data-qc-remove-concession]')?.addEventListener('click', () => {
        try {
          const next = removeConcessionFromBill(getState(), customerId, month, { reason: 'Outage concession removed by owner' });
          if (typeof onSaveState === 'function') onSaveState(next);
          openCustomerCollectionForm(customerId);
          if (typeof onToast === 'function') onToast(`Outage concession removed from bill ${month}.`);
        } catch (err) {
          if (typeof onToast === 'function') onToast(err.message);
        }
      });
    } catch {
      concessionBox.innerHTML = '';
    }
  }

  function openCustomerCollectionForm(customerId) {
    const state = getState();
    if (!state) return;
    try {
      activeCustomerId = customerId;
      activeDefaults = getCustomerPaymentDefaults(state, customerId, new Date(), loadTickets());

      // Populate form header
      if (customerHeader) {
        // SISP-43: with billed ticket charges pending, the header shows
        // the full payable (bills + charges) with the split spelled out,
        // so the collector sees exactly what the 1-tap amount covers.
        const hasTicketCharges = activeDefaults.ticketChargesPending > 0;
        const chargeLines = hasTicketCharges
          ? activeDefaults.ticketChargeLines.map(line => `<span class="qc-head-charge-line" style="display:block;">🔧 Murammat / Material Charge (${escapeHtml(line.ticketId)}): PKR ${Number(line.amount).toLocaleString('en-PK')}</span>`).join('')
          : '';
        customerHeader.innerHTML = `
          <div class="qc-active-cust-bar">
            <div class="qc-cust-identity">
              <span class="qc-tag-num">#${escapeHtml(String(activeDefaults.customerNumber))}</span>
              <strong class="qc-head-name">${escapeHtml(activeDefaults.name)}</strong>
              <span class="qc-head-area">${escapeHtml(activeDefaults.area)}${activeDefaults.phone ? ' · ' + escapeHtml(activeDefaults.phone) : ''}</span>
            </div>
            <div class="qc-head-due-box">
              <span class="qc-box-label">${hasTicketCharges ? 'Total Payable' : 'Total Dues'}</span>
              <strong class="qc-box-amt">PKR ${(hasTicketCharges ? activeDefaults.payableTotal : activeDefaults.totalDues).toLocaleString('en-PK')}</strong>
            </div>
          </div>
          ${hasTicketCharges ? `<div class="qc-head-charges" style="margin-top:6px;font-size:0.85rem;"><span class="qc-head-charge-line" style="display:block;">🧾 Bill dues: PKR ${activeDefaults.totalDues.toLocaleString('en-PK')}</span>${chargeLines}</div>` : ''}
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
      syncMethodChips(activeDefaults.defaultMethod || 'Cash');
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

      // Advance tag: reset per customer. When nothing is due at all (no
      // bill balance, no ticket charges), money can only be recorded as
      // advance credit — pre-tick the box so the 2-tap flow keeps working
      // for early payers instead of hitting core's fully-paid guard.
      if (advanceCheckbox) {
        advanceCheckbox.checked = activeDefaults.totalDues <= 0 && activeDefaults.ticketChargesPending <= 0;
      }

      // SISP-30: concession badge for the target month (refreshes on month change).
      renderConcessionBox(customerId, activeDefaults.targetMonth);

      // Uptime tracking: month-end online/offline one-liner for the
      // same target month (refreshes on month change too).
      renderUptimeLine(customerId, activeDefaults.targetMonth);

      // Reset digital fields
      if (transactionIdInput) transactionIdInput.value = '';
      if (overrideReasonInput) overrideReasonInput.value = '';
      if (overrideDetails) overrideDetails.open = false;
      currentScreenshotDataUrl = '';
      if (screenshotInput) screenshotInput.value = '';
      if (screenshotPreviewWrap) screenshotPreviewWrap.hidden = true;
      if (screenshotPreview) screenshotPreview.src = '';
      updateDigitalVisibility(activeDefaults.defaultMethod || 'Cash');

      // Update quick amount chips dynamic amounts (#281)
      if (quickAmountChips && activeDefaults) {
        // SISP-43: the "Full" chip covers the whole payable when ticket
        // charges are pending (bills + charges), not just the bill dues.
        const baseBal = activeDefaults.ticketChargesPending > 0
          ? activeDefaults.payableTotal
          : (activeDefaults.balanceDue > 0 ? activeDefaults.balanceDue : activeDefaults.totalDues);
        const curBal = (activeDefaults.currentMonthBalance && activeDefaults.currentMonthBalance > 0)
          ? activeDefaults.currentMonthBalance
          : activeDefaults.suggestedAmount;
        const halfBal = Math.round(baseBal / 2);
        quickAmountChips.forEach(chip => {
          const type = chip.getAttribute('data-quick-amount');
          if (type === 'full') {
            chip.textContent = `Full (Rs ${baseBal > 0 ? baseBal.toLocaleString('en-PK') : '0'})`;
          } else if (type === 'current') {
            chip.textContent = `Monthly (Rs ${curBal > 0 ? curBal.toLocaleString('en-PK') : (baseBal > 0 ? baseBal.toLocaleString('en-PK') : '0')})`;
          } else if (type === 'half') {
            chip.textContent = `50% (Rs ${halfBal > 0 ? halfBal.toLocaleString('en-PK') : '0'})`;
          }
        });
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

  let releaseFocusTrap = null;

  function openModal(defaultCustomerId = null) {
    closeCleanupHandled = false;
    updateCounts();
    if (defaultCustomerId) {
      openCustomerCollectionForm(defaultCustomerId);
    } else {
      showStep('pick');
      // Default to pending customers only (fully paid ones are hidden; "All" shows them).
      // When nothing is pending the picker shows "Sab ka bill wusool ho gaya" instead of
      // an empty list (replaces the #241 fallback to "All").
      setFilter('all-dues');
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

    releaseFocusTrap = trapModalFocus(modal, {
      onEscape: closeModal
    });
  }

  function stopUndoCountdown() {
    if (undoCountdownId) {
      clearInterval(undoCountdownId);
      undoCountdownId = null;
    }
  }

  // Live countdown on the in-dialog Undo button ("Undo Payment (4s)" ... 1s),
  // so the 5-second window is visible instead of a static "(5s)" label.
  // (Was 10s until 2026-10-21 — the user asked for 5s: 10 felt uselessly long.)
  function startUndoCountdown() {
    stopUndoCountdown();
    undoDeadline = Date.now() + UNDO_WINDOW_MS;
    const render = () => {
      if (!undoBtn || undoBtn.hidden) return;
      const left = Math.max(0, Math.ceil((undoDeadline - Date.now()) / 1000));
      undoBtn.textContent = `↩ Undo Payment (${left}s)`;
    };
    render();
    undoCountdownId = setInterval(render, 250);
  }

  // Close-cleanup runs exactly once per opening, whichever way the dialog was
  // closed: the × / Done buttons (closeModal below), Escape, a backdrop tap,
  // the universal dialog controller, Bulk Collect taking over, or route sync.
  // Previously only closeModal() cleaned up, so a close that bypassed it left
  // the 5s undo timer armed, the undo context set and the success step
  // mounted — stale timer/context state then leaked into the next opening.
  function handleDialogClosed() {
    if (closeCleanupHandled) return;
    closeCleanupHandled = true;
    const pendingUndo = activeUndoContext;
    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
    stopUndoCountdown();
    activeUndoContext = null;
    if (undoBtn) undoBtn.hidden = true;
    showStep('pick');
    activeCustomerId = null;
    activeDefaults = null;
    activeReceipt = null;
    duplicateBypassedForTxn = null;
    if (dupWarningCard) dupWarningCard.hidden = true;
    // Closing during the undo window keeps the payment (it is NOT undone).
    // Say so briefly, with no Undo of its own, so there is no doubt it saved.
    if (pendingUndo && typeof onToast === 'function') {
      onToast(`Payment of PKR ${pendingUndo.amount.toLocaleString()} for ${pendingUndo.customerName} saved.`, {
        type: 'success',
        title: 'Payment saved',
        duration: 3000
      });
    }
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
    // If the native 'close' event did not already run the cleanup (it can be
    // queued after close() returns, and removing the attribute fires none),
    // run it now; the guard inside makes the second call a no-op.
    handleDialogClosed();
  }

  modal.addEventListener('close', handleDialogClosed);

  
  // Wire duplicate warning card buttons (#279)
  // "Save anyway" needs a reason (#279); it is stored as the payment's reference override reason.
  function syncDupProceed() {
    if (!dupProceedBtn) return;
    const ok = Boolean((dupReasonInput?.value || '').trim()) || !dupReasonInput;
    dupProceedBtn.disabled = !ok;
    dupProceedBtn.title = ok ? '' : 'Write why this reference is used again';
  }
  dupReasonInput?.addEventListener('input', syncDupProceed);
  dupProceedBtn?.addEventListener('click', () => {
    if (dupProceedBtn.disabled) { dupReasonInput?.focus(); return; }
    duplicateBypassedForTxn = transactionIdInput ? transactionIdInput.value.trim() : '';
    if (dupWarningCard) dupWarningCard.hidden = true;
    if (paymentForm) {
      if (typeof paymentForm.requestSubmit === 'function') {
        paymentForm.requestSubmit();
      } else {
        paymentForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  });

  dupCancelBtn?.addEventListener('click', () => {
    duplicateBypassedForTxn = null;
    if (dupWarningCard) dupWarningCard.hidden = true;
    transactionIdInput?.focus();
  });

  transactionIdInput?.addEventListener('input', () => {
    duplicateBypassedForTxn = null;
    if (dupWarningCard) dupWarningCard.hidden = true;
  });

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
      setFilter(chip.getAttribute('data-filter') || 'all-dues');
      renderList();
    });
  });

  // Wire list card selection
  customerListContainer?.addEventListener('click', (e) => {
    if (e.target.closest('[data-qc-show-all]')) {
      setFilter('all');
      renderList();
      return;
    }
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
      const baseBalance = activeDefaults.ticketChargesPending > 0
        ? activeDefaults.payableTotal
        : (activeDefaults.balanceDue > 0 ? activeDefaults.balanceDue : activeDefaults.totalDues);

      if (type === 'full') {
        amountInput.value = (baseBalance > 0 ? baseBalance : activeDefaults.suggestedAmount).toFixed(2);
      } else if (type === 'current') {
        const cur = (activeDefaults.currentMonthBalance && activeDefaults.currentMonthBalance > 0)
          ? activeDefaults.currentMonthBalance
          : activeDefaults.suggestedAmount;
        amountInput.value = (cur > 0 ? cur : baseBalance).toFixed(2);
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

  function executeUndo() {
    if (!activeUndoContext) return;
    const { customerId, month, paymentId, amount, customerName, ticketCharges } = activeUndoContext;
    activeUndoContext = null;
    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
    stopUndoCountdown();
    if (undoBtn) undoBtn.hidden = true;
    try {
      const state = getState();
      // SISP-43: an undone collection reopens the ticket charges it
      // settled, first — only then may the payment itself be deleted
      // (core refuses to delete a charge-settling payment otherwise).
      const settledLines = Array.isArray(ticketCharges) ? ticketCharges : [];
      let nextState;
      if (settledLines.length > 0) {
        const { tickets: revertedTickets } = unsettleTicketChargesForPayment(loadTickets(), { id: paymentId, ticketCharges: settledLines });
        saveTickets(revertedTickets);
        nextState = deletePayment(state, customerId, month, paymentId, new Date(), { ticketChargesReverted: true });
      } else {
        nextState = deletePayment(state, customerId, month, paymentId);
      }
      if (typeof onSaveState === 'function') {
        onSaveState(nextState);
      }
      updateCounts();
      renderList();
      showStep('pick');
      if (typeof onToast === 'function') {
        onToast(`Payment of PKR ${amount.toLocaleString()} for ${customerName} undone. Ledger restored.`, { type: 'success', title: 'Undone' });
      }
    } catch (err) {
      if (typeof onToast === 'function') {
        onToast(`Could not undo payment: ${err.message}`, { type: 'error' });
      }
    }
  }

  undoBtn?.addEventListener('click', () => {
    executeUndo();
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

      const isDig = isDigitalPaymentMethod(methodVal);
      const txnIdVal = (transactionIdInput?.value || '').trim();
      const overrideReasonVal = (overrideReasonInput?.value || '').trim();

      if (isDig) {
        if (!txnIdVal && !overrideReasonVal) {
          const txnMsg = 'Please enter a Transaction ID or an override reason for digital payments.';
          // #292: show it next to the field too (a toast alone was hidden behind the sheet).
          if (transactionIdInput) {
            let err = document.getElementById('quickCollectTxnError');
            if (!err) {
              err = document.createElement('p');
              err.id = 'quickCollectTxnError';
              err.className = 'qc-field-error';
              err.setAttribute('role', 'alert');
              transactionIdInput.insertAdjacentElement('afterend', err);
              const clear = () => { err.hidden = true; transactionIdInput.removeAttribute('aria-invalid'); };
              transactionIdInput.addEventListener('input', clear);
              overrideReasonInput?.addEventListener('input', clear);
            }
            err.textContent = txnMsg;
            err.hidden = false;
            transactionIdInput.setAttribute('aria-invalid', 'true');
            transactionIdInput.setAttribute('aria-describedby', 'quickCollectTxnError');
          }
          // #296: the message is already shown inline under the field (role="alert"), so no toast
          // on top of the sheet; only fall back to a toast when the field is missing.
          if (!transactionIdInput && typeof onToast === 'function') {
            onToast(txnMsg, { type: 'error' });
          }
          transactionIdInput?.focus();
          return;
        }
        if (txnIdVal) {
          const dup = findDuplicatePaymentReference(state, txnIdVal);
          if (dup && duplicateBypassedForTxn !== txnIdVal) {
            const dupDate = dup.date || dup.paymentDate || 'recently';
            const dupMonth = dup.month || dup.billMonth || 'unknown';
            const dupAmt = Number(dup.amount || 0).toLocaleString('en-PK');
            if (dupWarningCard) {
              if (dupMsg) {
                dupMsg.textContent = `Transaction ID "${txnIdVal}" was already recorded on ${dupDate} for ${dup.customerName || 'customer'} (#${dup.customerNumber || '?'}) in month ${dupMonth} (PKR ${dupAmt}).`;
              }
              if (dupReasonInput) dupReasonInput.value = '';
              syncDupProceed();
              dupWarningCard.hidden = false;
              dupWarningCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              (dupCancelBtn || dupProceedBtn)?.focus(); // Cancel is the safe default (#279)
              return; // in-app card only: no browser confirm() (#279)
            }
            // No card in the page (older markup): fall back to the shared in-app confirm.
            const ask = typeof window.appConfirm === 'function'
              ? window.appConfirm({ tone: 'warning', title: 'Duplicate Transaction ID', subject: `Transaction ID "${txnIdVal}"`, message: `Already recorded on ${dupDate} for ${dup.customerName} (#${dup.customerNumber}) in month ${dupMonth} (PKR ${dupAmt}). Save anyway?`, confirmLabel: 'Save anyway' })
              : Promise.resolve(false);
            ask.then(ok => {
              if (!ok) { transactionIdInput?.focus(); return; }
              duplicateBypassedForTxn = txnIdVal;
              if (typeof paymentForm?.requestSubmit === 'function') paymentForm.requestSubmit();
            });
            return;
            if (dupWarningCard) {
              dupWarningCard.hidden = true;
            }
          }
        }
      }

      // Advance guard (owner rule): an untagged collection against an
      // already-paid bill is refused — the collector ticks the Advance
      // box instead, so money received early stays tagged as advance
      // credit. Collections settling billed ticket charges are exempt
      // (SISP-43: their money belongs to the tickets, and that pinned
      // flow records after a bill is paid).
      if (!advanceCheckbox?.checked
        && normalPaymentBlockReason(state, activeCustomerId, monthVal) === 'fully-paid'
        && billedTicketChargesPending(loadTickets(), activeCustomerId) <= 0) {
        if (typeof onToast === 'function') onToast(t('adv_blocked_paid'), { type: 'error' });
        return;
      }

      const { nextState, receipt, nextTickets } = executeQuickCollection(state, {
        customerId: activeCustomerId,
        month: monthVal,
        amount: amountVal,
        date: dateVal,
        method: methodVal,
        kind: advanceCheckbox?.checked ? 'advance' : undefined,
        paidBy: paidByVal,
        transactionId: txnIdVal,
        referenceOverrideReason: (duplicateBypassedForTxn && txnIdVal === duplicateBypassedForTxn && (dupReasonInput?.value || '').trim()) ? (dupReasonInput.value.trim() + (overrideReasonVal ? ` · ${overrideReasonVal}` : '')) : overrideReasonVal,
        screenshot: currentScreenshotDataUrl,
        // SISP-43: the live ticket list, so billed ticket charges can
        // settle inside this same collection (see executeQuickCollection).
        tickets: loadTickets()
      });

      // SISP-43: persist the settled tickets BEFORE the ledger state —
      // if this write fails, the whole submit aborts and nothing is
      // half-saved (the payment exists only in the unsaved nextState).
      if (nextTickets) {
        saveTickets(nextTickets);
      }

      activeReceipt = receipt;
      activeUndoContext = {
        customerId: activeCustomerId,
        month: monthVal,
        paymentId: receipt.paymentId,
        amount: amountVal,
        customerName: receipt.customerName,
        ticketCharges: receipt.ticketCharges ?? []
      };

      if (undoBtn) {
        undoBtn.hidden = false;
        undoBtn.disabled = false;
        undoBtn.textContent = '↩ Undo Payment (5s)';
      }

      if (undoTimeoutId) clearTimeout(undoTimeoutId);
      undoTimeoutId = setTimeout(() => {
        undoTimeoutId = null;
        activeUndoContext = null;
        stopUndoCountdown();
        if (undoBtn) undoBtn.hidden = true;
      }, UNDO_WINDOW_MS);
      startUndoCountdown();

      // Update parent application state
      if (typeof onSaveState === 'function') {
        onSaveState(nextState);
      }

      if (typeof onToast === 'function') {
        onToast(`Payment of PKR ${amountVal.toLocaleString()} recorded.`, {
          type: 'success',
          title: 'Payment recorded',
          actionLabel: 'Undo',
          onAction: () => {
            executeUndo();
          },
          duration: UNDO_WINDOW_MS
        });
      }

      // Render success screen
      if (receiptCardContainer) {
        receiptCardContainer.innerHTML = renderQuickCollectReceiptCardHtml(receipt);
      }

      showStep('success');
      updateCounts();

      // Accessible screen reader announcement and programmatic focus
      announcePaymentSuccess(receipt);
      setTimeout(() => {
        const successHeading = document.getElementById('quickCollectSuccessHeading') || whatsAppBtn;
        successHeading?.focus();
      }, 60);

    } catch (err) {
      if (typeof onToast === 'function') {
        onToast(err.message, { type: 'error' });
      }
    }
  });

  // #297: a missing phone is a warning, with a shortcut to add the number to the customer's profile.
  function warnNoPhone(message) {
    if (typeof onToast !== 'function') return;
    const customerId = activeReceipt?.customerId;
    const opts = { type: 'warning', title: 'No phone number' };
    if (customerId && typeof onEditCustomer === 'function') {
      opts.actionLabel = 'Add phone';
      opts.onAction = () => {
        closeModal();
        // Let the dialog's own history entry go back first, then open the profile editor.
        setTimeout(() => onEditCustomer(customerId, { focus: 'phone' }), 350);
      };
    }
    onToast(message, opts);
  }

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
        onToast('WhatsApp receipt draft opened.', { type: 'info' });
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
          warnNoPhone('No phone saved for this customer. The receipt text was copied to the clipboard instead.');
        } catch {
          warnNoPhone('No phone number saved for this customer.');
        }
      } else {
        warnNoPhone('No phone number saved for this customer.');
      }
    }

    if (receiptCardContainer) {
      receiptCardContainer.innerHTML = renderQuickCollectReceiptCardHtml(activeReceipt);
    }
  });

  // Share Receipt as Image / PNG download
  shareImageBtn?.addEventListener('click', async () => {
    if (!activeReceipt) return;
    try {
      const blob = await generateReceiptImageBlob(activeReceipt);
      if (!blob) {
        if (typeof onToast === 'function') onToast('Receipt image creation is not supported in this environment.', { type: 'warning' });
        return;
      }
      const filename = `receipt-${activeReceipt.receiptNumber || 'slip'}.png`;
      const file = (typeof File === 'function') ? new File([blob], filename, { type: 'image/png' }) : null;

      let shared = false;
      if (file && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Payment Receipt ${activeReceipt.receiptNumber}`,
            text: `Receipt for ${activeReceipt.customerName} - PKR ${Number(activeReceipt.amount).toLocaleString('en-PK')}`,
            files: [file]
          });
          shared = true;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      if (!shared) {
        if (typeof URL !== 'undefined' && typeof document !== 'undefined') {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }

      markReceiptShared(activeReceipt.id, {
        method: 'image',
        phone: activeReceipt.phone,
        customerId: activeReceipt.customerId,
        amount: activeReceipt.amount
      });

      if (receiptCardContainer) {
        receiptCardContainer.innerHTML = renderQuickCollectReceiptCardHtml(activeReceipt);
      }

      if (typeof onToast === 'function') {
        onToast('Receipt image ready (downloaded / shared).');
      }
    } catch (err) {
      if (typeof onToast === 'function') onToast(`Share failed: ${err.message}`, { type: 'error' });
    }
  });

  // Print slip
  printReceiptBtn?.addEventListener('click', () => {
    window.print?.();
  });

  // #226: Bluetooth thermal print of the just-collected receipt. The button
  // stays hidden when Web Bluetooth is unavailable (system print remains).
  const bluetoothPrintBtn = document.getElementById('quickCollectBluetoothPrintBtn');
  if (bluetoothPrintBtn) {
    bluetoothPrintBtn.hidden = !isWebBluetoothAvailable();
    bluetoothPrintBtn.addEventListener('click', async () => {
      if (!activeReceipt) {
        if (typeof onToast === 'function') onToast('No receipt to print yet.', { type: 'error' });
        return;
      }
      try {
        if (!thermalPrinter.isConnected()) await thermalPrinter.connect();
        const money = (v) => `PKR ${Number(v || 0).toLocaleString('en-PK')}`;
        const { bytes } = buildEscPosReceipt({
          businessName: 'Shahdara ISP',
          receiptNumber: activeReceipt.receiptNumber || '',
          customerName: activeReceipt.customerName || '',
          customerNumber: activeReceipt.customerNumber ? String(activeReceipt.customerNumber) : '',
          monthLabel: activeReceipt.month || '',
          dateTimeLabel: activeReceipt.date || '',
          amount: money(activeReceipt.amount),
          method: activeReceipt.method || '',
          reference: activeReceipt.transactionId || '',
          // SISP-43: settled ticket charges print on the slip too.
          ticketCharges: (activeReceipt.ticketCharges ?? []).map(line => ({
            label: `Murammat (${line.ticketId})`,
            value: money(line.amount)
          })),
          balanceDue: money(activeReceipt.payableRemaining ?? activeReceipt.newBalanceDue),
          statusLabel: activeReceipt.isSettled ? 'PAID' : 'PARTIAL'
        });
        await thermalPrinter.print(bytes);
        if (typeof onToast === 'function') onToast('Receipt sent to the Bluetooth printer.');
      } catch (err) {
        if (typeof onToast === 'function') onToast(`Bluetooth print failed: ${err?.message || err}`, { type: 'error' });
      }
    });
  }

  // Collect Another loop
  anotherBtn?.addEventListener('click', () => {
    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      undoTimeoutId = null;
    }
    stopUndoCountdown();
    activeUndoContext = null;
    if (undoBtn) undoBtn.hidden = true;
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
    isOpen: () => modal.hasAttribute('open') || modal.open,
    // Used by bulk-collect.js: read the live state and save through the same path as a single collection.
    getState: () => getState(),
    commitState: (nextState) => {
      if (typeof onSaveState === 'function') onSaveState(nextState);
      updateCounts();
      renderList();
    },
    refresh: () => { updateCounts(); renderList(); }
  };
}
