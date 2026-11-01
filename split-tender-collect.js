/**
 * split-tender-collect.js — SISP-121: Split-Tender Cash + Digital Wallet
 * Checkout for Quick Collect.
 *
 * One bill payment tendered across TWO methods in a single checkout
 * (e.g. Leg 1: Cash Rs 2,000 + Leg 2: Easypaisa Rs 1,000 with TID).
 *
 * MODEL (deliberate — do not "simplify" into a multi-method payment):
 * a split is TWO ordinary payment records, one per leg, each recorded
 * through the EXISTING Quick Collect recorder (executeQuickCollection,
 * injected by the caller exactly like group-billing.js injects it).
 * Every aggregate in the app keys off ONE method per payment — method
 * totals, the Roznamcha drawer, wallet reconciliation, shop
 * settlements — so each leg flows through all of them NATURALLY, with
 * zero changes to those engines. The two records are linked only by a
 * stamp on each record: `splitGroupId` (shared) + `splitLeg` (1 | 2).
 * The stamp survives every persistence path the house already has:
 * readState (bills ride as-is), JSON backup (validateBackupState's
 * raw-spread keeps later fields on purpose), backup merge, and
 * correctPayment (core carries the stamp over verbatim, SISP-121).
 *
 * ATOMICITY: the recorder chain is pure — execute() returns a new
 * state and the CALLER decides whether to persist it. This module
 * validates BOTH legs completely BEFORE recording either (the same
 * validatePayment the recorder itself will run, plus split rules), and
 * if leg 2 still throws, the whole chain is discarded and the error
 * says nothing was recorded — because nothing was: the input state is
 * never mutated and the leg-1 nextState is dropped, not saved. (The
 * recorder also appends to a device-local recent-collects display log;
 * that log is not the ledger and never feeds a balance.)
 *
 * VOID (SISP-34): each leg is an ordinary payment, so each voids
 * individually under the existing rules — voiding one leg reopens
 * exactly that leg's amount; the other leg stands. The combined
 * receipt is DERIVED from the saved records, so a reprint after a void
 * shows the voided leg marked VOID and excludes it from the total.
 *
 * SENDER (SISP-63, FU-SISP121-SENDER): each leg also carries the
 * sender proof metadata (senderTitle + senderDigits, name + last-4
 * only) under the exact SISP-63 contract — the recorder stamps it on
 * digital legs, cash legs store nothing — so wallet statement
 * matching treats a split's digital leg like any digital payment.
 *
 * Imported ONLY by nav-quick-collect.js (an existing build entry), so
 * the module inlines into the existing bundle graph — dist stays at
 * the 25-file perf budget (pinned by tests/split-tender-collect.test.js
 * via the build-output suite).
 */
import {
  PAYMENT_METHODS,
  isDigitalPaymentMethod,
  validatePayment,
  calculatePaymentAllocations
} from './core.js';
import { buildPaymentReceipt, RECEIPT_URDU_NOTE } from './receipt.js';
import { isVoidedPayment } from './payment-void-audit.js';
import { normalizeTid } from './wallet-reconciliation.js';
import { t } from './nav-language.js';

export const SPLIT_TENDER_LEG_COUNT = 2;

const centsOf = (value) => Math.round(Number(value) * 100);
const moneyOf = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Unique split-group id (mirrors payment-void-audit's voidId pattern). */
export function newSplitGroupId() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return `split-${globalThis.crypto.randomUUID()}`;
    }
  } catch { /* fall through */ }
  return `split-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * True only for a payment record that is one leg of a split tender.
 * Legacy records (no stamp) always read false — the stamp is the only
 * source of truth, exactly like the SISP-34 void stamp.
 */
export function splitTenderOf(payment) {
  if (!payment || typeof payment !== 'object') return null;
  const groupId = typeof payment.splitGroupId === 'string' ? payment.splitGroupId.trim() : '';
  const leg = Number(payment.splitLeg);
  if (!groupId || (leg !== 1 && leg !== 2)) return null;
  return { groupId, leg };
}

function cleanLeg(rawLeg, index) {
  const leg = rawLeg && typeof rawLeg === 'object' ? rawLeg : {};
  return {
    leg: index + 1,
    amount: Number(leg.amount),
    method: typeof leg.method === 'string' ? leg.method.trim() : '',
    transactionId: String(leg.transactionId ?? '').trim().slice(0, 64),
    // FU-SISP121-SENDER: SISP-63 sender proof metadata rides each leg
    // exactly as the single-payment path hands it to the recorder —
    // trimmed pass-through here; core's validatePayment is the single
    // sanitization point (single-line title, <= 100 chars or throw,
    // digits reduced to digits-only LAST 4, kept for digital methods
    // only — a cash leg's values are dropped there, never stored).
    senderTitle: String(leg.senderTitle ?? '').trim(),
    senderDigits: String(leg.senderDigits ?? '').trim(),
    referenceOverrideReason: String(leg.referenceOverrideReason ?? '').trim().slice(0, 100),
    // A proof screenshot may ride ONE leg only (the caller puts it on
    // leg 1); validatePayment applies its own data-URL rules later.
    screenshot: index === 0 && typeof leg.screenshot === 'string' ? leg.screenshot : undefined
  };
}

/**
 * Validates a split-tender spec COMPLETELY, before anything is
 * recorded. Returns the cleaned { customerId, month, date, paidBy,
 * legs } on success; throws with a precise message otherwise. The
 * per-leg field validation runs the REAL core validatePayment with the
 * exact fields the recorder will pass to addPayment, so a spec that
 * passes here cannot fail inside leg recording for a field reason.
 */
export function validateSplitTender(state, spec, referenceDate = new Date()) {
  const { customerId, month, date, paidBy, legs } = spec ?? {};
  if (!customerId) throw new Error('Customer ID is required.');
  const customer = (state && Array.isArray(state.customers) ? state.customers : []).find(c => c.id === customerId);
  if (!customer) throw new Error(`Customer ${customerId} not found.`);
  if (customer.archived) throw new Error('Archived customers cannot receive payments. Unarchive the customer first.');
  if (month !== undefined && month !== null && month !== '' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) {
    throw new Error('Choose a valid billing month for the split payment.');
  }
  if (!Array.isArray(legs) || legs.length !== SPLIT_TENDER_LEG_COUNT) {
    throw new Error('A split payment needs exactly two legs.');
  }
  const cleaned = legs.map((leg, index) => cleanLeg(leg, index));
  for (const leg of cleaned) {
    if (!Number.isFinite(leg.amount) || leg.amount <= 0) {
      throw new Error(`Leg ${leg.leg}: enter a valid amount greater than zero.`);
    }
    if (!PAYMENT_METHODS.includes(leg.method)) {
      throw new Error(`Leg ${leg.leg}: choose a valid payment method.`);
    }
  }
  if (cleaned[0].method === cleaned[1].method) {
    throw new Error('Both legs use the same method — record it as one normal payment instead of a split.');
  }
  // One wallet transfer can never pay twice: the same normalized TID on
  // both legs would double-count a single digital receipt.
  const tid0 = normalizeTid(cleaned[0].transactionId);
  const tid1 = normalizeTid(cleaned[1].transactionId);
  if (tid0 && tid1 && tid0 === tid1) {
    throw new Error('Both legs carry the same Transaction ID — one transfer cannot pay twice. Give each digital leg its own TID.');
  }
  // Strict digital-reference rule, mirrored from the recorder BEFORE
  // anything is written (the recorder enforces it per leg as well).
  if ((spec?.strictDigitalReference || spec?.enforceDigitalReference)) {
    for (const leg of cleaned) {
      if (isDigitalPaymentMethod(leg.method) && !leg.transactionId && !leg.referenceOverrideReason) {
        throw new Error(`Leg ${leg.leg}: Transaction ID / last 6 digits is required for digital payments (or provide an override reason).`);
      }
    }
  }
  // Field-level pre-validation through the real payment sanitizer, with
  // the same field set executeQuickCollection hands to addPayment. The
  // fallback date mirrors the recorder's own default (Pakistan-local
  // today — the same Intl computation as nav-quick-collect's
  // getPakistanLocalDate, mirrored here to keep this module cycle-free).
  const pDate = date || undefined;
  const fallbackDate = (() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(referenceDate);
    const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${p.year}-${p.month}-${p.day}`;
  })();
  for (const leg of cleaned) {
    validatePayment({
      date: pDate ?? fallbackDate,
      amount: leg.amount,
      method: leg.method,
      paidBy: paidBy ? String(paidBy).trim() : undefined,
      transactionId: leg.transactionId || undefined,
      senderTitle: leg.senderTitle || undefined,
      senderDigits: leg.senderDigits || undefined,
      referenceOverrideReason: leg.referenceOverrideReason || undefined,
      screenshot: leg.screenshot
    }, referenceDate, {
      strictDigitalReference: spec?.strictDigitalReference,
      enforceDigitalReference: spec?.enforceDigitalReference
    });
  }
  return {
    customerId,
    month: month || undefined,
    date: pDate,
    paidBy: paidBy ? String(paidBy).trim() : '',
    legs: cleaned,
    totalAmount: Math.round(cleaned.reduce((sum, leg) => sum + centsOf(leg.amount), 0)) / 100
  };
}

/** Stamps the split link onto the two recorded payments (immutable). */
function stampSplitLegs(state, customerId, month, groupId, paymentIds) {
  return {
    ...state,
    customers: (state.customers ?? []).map(c => {
      if (c.id !== customerId) return c;
      return {
        ...c,
        bills: (c.bills ?? []).map(b => {
          if (b.month !== month) return b;
          let touched = false;
          const payments = (b.payments ?? []).map(p => {
            const legIndex = paymentIds.indexOf(p.id);
            if (legIndex < 0) return p;
            touched = true;
            return { ...p, splitGroupId: groupId, splitLeg: legIndex + 1 };
          });
          return touched ? { ...b, payments } : b;
        })
      };
    })
  };
}

/**
 * Records a split tender: validates both legs, then records leg 1 and
 * leg 2 through the injected recorder (executeQuickCollection) exactly
 * as two sequential collections — FIFO allocation, waada clearing,
 * ticket-charge settlement (threaded: leg 2 receives leg 1's settled
 * ticket list), auto-package follow, all unchanged. Both legs share
 * the same date/month/paidBy; each keeps its own method + TID.
 *
 * All-or-nothing at the ledger level: the input state is never
 * mutated, and if leg 2 fails the leg-1 state is DISCARDED (the
 * caller never receives it), so no half-split can be saved.
 *
 * @returns {{ nextState, receipts: [object, object], nextTickets,
 *   splitGroupId, combinedReceipt }}
 */
export function executeSplitTenderCollection(state, spec, { execute, referenceDate = new Date() } = {}) {
  if (typeof execute !== 'function') throw new Error('A payment executor is required.');
  const clean = validateSplitTender(state, spec, referenceDate);
  const groupId = newSplitGroupId();
  const shared = {
    customerId: clean.customerId,
    month: clean.month,
    date: clean.date,
    paidBy: clean.paidBy || undefined,
    strictDigitalReference: spec?.strictDigitalReference,
    enforceDigitalReference: spec?.enforceDigitalReference
  };
  const legFields = (leg) => ({
    ...shared,
    amount: leg.amount,
    method: leg.method,
    transactionId: leg.transactionId || undefined,
    // FU-SISP121-SENDER: the recorder (executeQuickCollection) already
    // accepts senderTitle/senderDigits and stamps them via addPayment —
    // the split spec now carries them per leg, so a digital leg's
    // recorded payment is indistinguishable in shape from a normal
    // digital payment and SISP-63 statement matching works on it
    // unchanged (the matcher reads the record fields directly).
    senderTitle: leg.senderTitle || undefined,
    senderDigits: leg.senderDigits || undefined,
    referenceOverrideReason: leg.referenceOverrideReason || undefined,
    screenshot: leg.screenshot
  });

  const first = execute(state, { ...legFields(clean.legs[0]), tickets: spec?.tickets }, referenceDate);
  let second;
  try {
    second = execute(first.nextState, {
      ...legFields(clean.legs[1]),
      tickets: first.nextTickets ?? spec?.tickets
    }, referenceDate);
  } catch (error) {
    // The leg-1 result lives only in first.nextState, which is dropped
    // here — the saved ledger never sees either leg.
    throw new Error(`Split payment was NOT saved: leg 2 (${clean.legs[1].method} ${clean.legs[1].amount}) failed — ${error.message} Nothing was recorded; no part of the split reached the ledger.`);
  }

  const month = second.receipt.month;
  const stamped = stampSplitLegs(second.nextState, clean.customerId, month, groupId, [
    first.receipt.paymentId,
    second.receipt.paymentId
  ]);
  // The stamp must land on BOTH records — if a payment id cannot be
  // found, the records and the link disagree, so refuse the whole
  // split rather than save an unlinked half.
  const check = splitPaymentsOf(stamped, clean.customerId, groupId);
  if (check.length !== SPLIT_TENDER_LEG_COUNT) {
    throw new Error('Split payment was NOT saved: the split link could not be stamped on both payments. Nothing was recorded.');
  }

  return {
    nextState: stamped,
    receipts: [first.receipt, second.receipt],
    nextTickets: second.nextTickets ?? first.nextTickets,
    splitGroupId: groupId,
    combinedReceipt: buildSplitTenderReceipt(stamped, clean.customerId, groupId)
  };
}

/**
 * Finds the recorded legs of one split group for a customer, in leg
 * order: [{ leg, payment, bill }]. Searches every bill — the two legs
 * are recorded against the same month, but the group id is the link,
 * not the month.
 */
export function splitPaymentsOf(state, customerId, groupId) {
  const customer = (state && Array.isArray(state.customers) ? state.customers : []).find(c => c.id === customerId);
  if (!customer || !groupId) return [];
  const found = [];
  for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
    for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
      const split = splitTenderOf(payment);
      if (split && split.groupId === groupId) found.push({ leg: split.leg, payment, bill });
    }
  }
  return found.sort((a, b) => a.leg - b.leg);
}

/**
 * Builds the ONE combined receipt for a split group from the SAVED
 * records — per-leg lines carry each leg's REAL permanent receipt
 * number (buildPaymentReceipt), method, amount and TID; no combined
 * receipt number is ever fabricated. Voided legs stay listed, marked
 * voided, and are excluded from the total (SISP-34 rule). The balance
 * is the allocation engine's live total dues across the customer's
 * bills, so a reprint always reflects the ledger as saved NOW.
 */
export function buildSplitTenderReceipt(state, customerId, groupId) {
  const customer = (state && Array.isArray(state.customers) ? state.customers : []).find(c => c.id === customerId);
  if (!customer) throw new Error(`Customer ${customerId} not found.`);
  const entries = splitPaymentsOf(state, customerId, groupId);
  if (!entries.length) throw new Error('No split payment found for this group.');

  const allocations = calculatePaymentAllocations(state);
  let totalDuesCents = 0;
  for (const bill of (customer.bills ?? [])) {
    const summary = allocations.forMonth(customerId, bill.month);
    if (summary?.balanceDueCents && summary.balanceDueCents > 0) totalDuesCents += summary.balanceDueCents;
  }

  const legs = entries.map(({ leg, payment, bill }) => {
    const receipt = buildPaymentReceipt(customer, bill, payment);
    return {
      leg,
      paymentId: payment.id,
      receiptNumber: receipt.permanentReceiptNumber || receipt.receiptNumber,
      method: receipt.paymentMethod || payment.method || '',
      amount: moneyOf(payment.amount),
      transactionId: receipt.transactionId || '',
      date: receipt.paymentDate || payment.date || '',
      voided: isVoidedPayment(payment)
    };
  });
  const liveLegs = legs.filter(leg => !leg.voided);
  const totalReceivedCents = liveLegs.reduce((sum, leg) => sum + centsOf(leg.amount), 0);
  const firstReceipt = buildPaymentReceipt(customer, entries[0].bill, entries[0].payment);

  return {
    splitGroupId: groupId,
    customerId: String(customer.customerNumber ?? ''),
    customerNumber: customer.customerNumber,
    customerName: firstReceipt.customerName,
    customerNameUrdu: firstReceipt.customerNameUrdu,
    phone: customer.phone || '',
    area: customer.area || 'Unassigned',
    month: entries[0].bill.month,
    date: legs[0]?.date || '',
    package: firstReceipt.package,
    legs,
    totalReceivedCents,
    totalReceived: totalReceivedCents / 100,
    balanceDueCents: totalDuesCents,
    status: legs.every(leg => leg.voided) ? 'VOID' : (totalDuesCents <= 0 ? 'PAID' : 'PARTIAL')
  };
}

const formatAmount = (value) => `PKR ${Number(value || 0).toLocaleString('en-PK')}`;

/** WhatsApp / plain-text combined receipt (house receipt text style). */
export function formatSplitTenderWhatsAppText(combined) {
  const legLines = combined.legs.map(leg => {
    const tid = leg.transactionId ? ` · TID ${leg.transactionId}` : '';
    const voided = leg.voided ? ` (${t('split_voided_leg')})` : '';
    return `${t('split_leg_label', null, { leg: leg.leg })}: ${leg.method} — ${formatAmount(leg.amount)}${tid} · ${t('split_receipt_no')}: ${leg.receiptNumber}${voided}`;
  });
  const lines = [
    '*SHAHDARA FIBER NETWORK & ISP BILLING*',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    `*${t('split_receipt_title')}*`,
    '',
    `👤 *Customer:* ${combined.customerName} (#${combined.customerNumber})`,
    `🗓️ *Billing Month:* ${combined.month}`,
    `📅 *Date:* ${combined.date}`,
    '',
    ...legLines,
    '',
    `💵 *${t('split_total_received')}:* ${formatAmount(combined.totalReceived)}`,
    `⚖️ *${t('split_balance_due')}:* ${formatAmount(combined.balanceDueCents / 100)}`,
    `📌 *Status:* ${combined.status === 'PAID' ? 'Paid in Full / مکمل ادا شدہ' : combined.status}`,
    '',
    'Shukriya! Thank you for your prompt payment.',
    '━━━━━━━━━━━━━━━━━━━━━━━━'
  ];
  return lines.join('\n');
}

/**
 * Printable combined receipt sheet (receipt.js CSS classes, so the
 * existing print styles apply). One sheet lists both legs with their
 * real receipt numbers — there is deliberately no combined number.
 */
export function generateSplitTenderReceiptHtml(combined, {
  businessName = 'Shahdara ISP',
  businessPhone = '0300-1234567',
  areaName = 'Shahdara, Lahore'
} = {}) {
  if (!combined) return '';
  const displayName = combined.customerNameUrdu && combined.customerNameUrdu !== combined.customerName
    ? `${combined.customerNameUrdu} (${combined.customerName})`
    : combined.customerName;
  const statusClass = combined.status === 'PAID' ? 'receipt-status-paid' : combined.status === 'PARTIAL' ? 'receipt-status-partial' : '';
  const legRows = combined.legs.map(leg => `
    <div class="receipt-field"><dt>${escapeHtml(t('split_leg_label', null, { leg: leg.leg }))} — ${escapeHtml(leg.method)}:</dt><dd>${formatAmount(leg.amount)}${leg.voided ? ` (${escapeHtml(t('split_voided_leg'))})` : ''}</dd></div>
    <div class="receipt-field"><dt>${escapeHtml(t('split_receipt_no'))} (${escapeHtml(t('split_leg_label', null, { leg: leg.leg }))}):</dt><dd>${escapeHtml(leg.receiptNumber)}</dd></div>
    ${leg.transactionId ? `<div class="receipt-field"><dt>Transaction ID:</dt><dd>${escapeHtml(leg.transactionId)}</dd></div>` : ''}`).join('');
  return `<article class="receipt-sheet a4-receipt split-tender-receipt" data-receipt-format="a4">
  <header class="receipt-head">
    <div>
      <span class="receipt-brand">${escapeHtml(businessName)}</span>
      <h1>${escapeHtml(t('split_receipt_title'))} / رسید ادائیگی</h1>
      <p>Official Customer Record · ${escapeHtml(areaName)} · Phone: ${escapeHtml(businessPhone)}</p>
    </div>
    <span class="receipt-mark ${statusClass}">${escapeHtml(combined.status)}</span>
  </header>
  <dl class="receipt-fields">
    <div class="receipt-field"><dt>Customer Name / صارف کا نام:</dt><dd>${escapeHtml(displayName)}</dd></div>
    <div class="receipt-field"><dt>Account / Customer ID:</dt><dd>#${escapeHtml(combined.customerId)}</dd></div>
    <div class="receipt-field"><dt>Billing Month / بل کا مہینہ:</dt><dd>${escapeHtml(combined.month)}</dd></div>
    <div class="receipt-field"><dt>Payment Date / تاریخ ادائیگی:</dt><dd>${escapeHtml(combined.date)}</dd></div>
    ${legRows}
    <div class="receipt-field receipt-paid-field"><dt><strong>${escapeHtml(t('split_total_received'))}:</strong></dt><dd><strong>${formatAmount(combined.totalReceived)}</strong></dd></div>
    <div class="receipt-field receipt-balance-field"><dt><strong>${escapeHtml(t('split_balance_due'))}:</strong></dt><dd class="${statusClass}"><strong>${formatAmount(combined.balanceDueCents / 100)}</strong></dd></div>
  </dl>
  <div class="receipt-urdu-notice" dir="rtl" lang="ur">
    <strong>اہم معلوماتی نوٹ:</strong> ${escapeHtml(RECEIPT_URDU_NOTE)}
  </div>
</article>`;
}

/**
 * Badge for one split leg on payment rows (profile history +
 * Transactions), mirroring payment-void-audit's voidBadgeMarkup.
 * Empty string for ordinary payments, so non-split rows render
 * byte-identically to before.
 */
export function splitBadgeMarkup(payment) {
  const split = splitTenderOf(payment);
  if (!split) return '';
  return `<span class="split-badge">${escapeHtml(t('split_badge', null, { leg: split.leg }))}</span>`;
}

/**
 * Quick Collect success-step card for a combined split receipt —
 * same qc-receipt-* classes as renderQuickCollectReceiptCardHtml, so
 * the existing styles (and print behaviour) apply unchanged. Shows the
 * total received, BOTH legs with their real receipt numbers, and the
 * remaining balance.
 */
export function renderSplitReceiptCardHtml(combined) {
  if (!combined) return '';
  const remaining = combined.balanceDueCents / 100;
  const isSettled = combined.status === 'PAID';
  const legRows = combined.legs.map(leg => `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">${escapeHtml(t('split_leg_label', null, { leg: leg.leg }))} · ${escapeHtml(leg.method)}${leg.voided ? ` (${escapeHtml(t('split_voided_leg'))})` : ''}</span>
          <strong class="qc-meta-val">PKR ${Number(leg.amount).toLocaleString('en-PK')} · ${escapeHtml(leg.receiptNumber)}${leg.transactionId ? ` · TID ${escapeHtml(leg.transactionId)}` : ''}</strong>
        </div>`).join('');
  return `
    <div class="qc-receipt-card" role="region" aria-label="Split Payment Receipt Slip">
      <div class="qc-receipt-header">
        <span class="qc-receipt-badge ${isSettled ? 'settled' : 'partial'}">
          ${isSettled ? '✓ Settle in Full' : '⏳ Partial Payment'}
        </span>
        <span class="qc-receipt-id">${escapeHtml(t('split_receipt_title'))}</span>
      </div>

      <div class="qc-receipt-amount-row">
        <span class="qc-receipt-label">${escapeHtml(t('split_total_received'))}</span>
        <strong class="qc-receipt-amount">PKR ${Number(combined.totalReceived).toLocaleString('en-PK')}</strong>
      </div>

      <div class="qc-receipt-grid">
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Customer</span>
          <strong class="qc-meta-val">${escapeHtml(combined.customerName)} (#${escapeHtml(String(combined.customerNumber))})</strong>
        </div>
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Area / Location</span>
          <strong class="qc-meta-val">${escapeHtml(combined.area)}</strong>
        </div>
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Remaining Balance</span>
          <strong class="qc-meta-val ${remaining > 0 ? 'has-balance' : 'zero-balance'}">
            PKR ${Number(remaining).toLocaleString('en-PK')}
          </strong>
        </div>
        ${legRows}
      </div>
    </div>
  `;
}
