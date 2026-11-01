/**
 * payment-method-reassign.js — SISP-156: 1-Click Payment Method / Shop
 * Correction Without Void (وصولی چینل کی فوری درستگی).
 *
 * Problem: a receipt is often recorded on the wrong channel — the
 * customer paid cash at a shop counter but it was logged as direct cash,
 * or a wallet transfer was logged under the wrong shop. Voiding and
 * re-recording changes the receipt number and pollutes the audit trail;
 * the plain correction form could change the method, but with no guard
 * it could also move a receipt whose cash was ALREADY handed over from
 * the shop (silently corrupting the settlement record's allocations)
 * and it dropped the settlement / cleared-Waada stamps on the way.
 *
 * This module adds the guarded 1-click path on top of the ONE existing
 * editor, core.js correctPayment:
 *
 *   - reassignPaymentMethod() gathers the payment's current fields
 *     verbatim (amount, date, discount, kind, prepay terms, stamps are
 *     all correctPayment's own carry-overs) and asks correctPayment to
 *     change ONLY the channel, with strictDigitalReference on — so a
 *     move onto a digital channel faces exactly the Transaction-ID rule
 *     a fresh recording faces.
 *   - LOCKS (paymentChannelLock): a voided payment is frozen history;
 *     a payment with any shop-settled amount (> 0, even partial — the
 *     FIFO settlement can cover a receipt halfway) has physically
 *     handed its cash over through the old channel, so its channel is
 *     locked until the handover is reversed. core.js correctPayment
 *     enforces the same lock for every caller. No other lock exists in
 *     the data: partner settlements are derived snapshots that never
 *     stamp payments, and Roznamcha closed days are frozen DAY
 *     snapshots by design (a correction never rewrote them, for any
 *     field — that is a display freeze, not a payment lock).
 *   - TID rules: moving TO a digital channel uses the operator-entered
 *     TID, else keeps the TID already on the record (digital → digital),
 *     else needs an override reason (strict validation refuses
 *     otherwise). Moving AWAY from digital KEEPS the old TID on the
 *     record as history — it documents how the money originally
 *     arrived; wallet reconciliation keys off the method, so a kept
 *     TID on a cash receipt counts nowhere it should not.
 *   - paidBy: shop attribution derives from method OR paidBy
 *     (resolveShopCollector). When the payer text ITSELF names a shop
 *     (legacy "Cash" + paidBy "Hassan" records) and the destination
 *     channel is a different channel, the payer text was channel data,
 *     not a person — it is cleared so the move actually takes effect,
 *     and the audit entry on the payment is flagged paidByCleared.
 *     A payer text that names no shop is never touched.
 *   - AUDIT: correctPayment stamps payment.methodCorrections
 *     ([{ fromMethod, toMethod, correctedAt }]) whenever the method
 *     changes; the entries ride the payment through backups like every
 *     other stamp. The receipt reprint shows the new method because
 *     receipts derive from the record.
 *
 * Every aggregate (shop trays via buildShopSummaries, the Roznamcha
 * drawer via collectDirectCashPayments, wallet reconciliation) derives
 * from payment.method, so the single record edit moves the money
 * everywhere at once — no aggregate is hand-adjusted here.
 *
 * Imported ONLY by app.js (dist stays at the 25-file budget). Tests use
 * synthetic data only.
 */
import { PAYMENT_METHODS, correctPayment, findDuplicatePaymentReference, formatPKR, isDigitalPaymentMethod } from './core.js';
import { resolveShopCollector } from './shop-settlement.js';
import { t } from './nav-language.js';

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Shop-settled amount on a payment, mirroring shop-settlement.js
 * settledAmountOf (the same mirror payment-void-audit.js keeps).
 */
export function paymentShopSettledAmount(payment) {
  if (!payment || typeof payment !== 'object') return 0;
  const explicit = Number(payment.shopSettledAmount);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, Number(payment.amount) || 0);
  if (payment.shopSettled) return Number(payment.amount) || 0;
  return 0;
}

/**
 * Why a payment's channel cannot change, or null when it can.
 * @returns {null | { reason:'voided' } | { reason:'shop-settled', settledAmount:number }}
 */
export function paymentChannelLock(payment) {
  if (!payment || typeof payment !== 'object') return { reason: 'voided' };
  if (payment.voided === true) return { reason: 'voided' };
  const settledAmount = paymentShopSettledAmount(payment);
  if (settledAmount > 0) return { reason: 'shop-settled', settledAmount };
  return null;
}

/** Owner-facing lock explanation (i18n), for rows and dialogs. */
export function channelLockText(lock) {
  if (!lock) return '';
  if (lock.reason === 'shop-settled') return t('reassign_lock_settled');
  return t('reassign_lock_voided');
}

function findPayment(state, customerId, month, paymentId) {
  const customer = (state && Array.isArray(state.customers) ? state.customers : [])
    .find((c) => c && typeof c === 'object' && c.id === customerId);
  if (!customer) throw new Error('Customer not found.');
  const bill = (Array.isArray(customer.bills) ? customer.bills : [])
    .find((b) => b && typeof b === 'object' && b.month === month);
  const payment = (Array.isArray(bill?.payments) ? bill.payments : [])
    .find((p) => p && typeof p === 'object' && p.id === paymentId);
  if (!payment) throw new Error('Payment not found.');
  return { customer, bill, payment };
}

/**
 * Reassign one payment's channel. Pure: returns the next state; the
 * input state is never mutated. Only the method (plus the channel-bound
 * fields the new method requires: TID / override reason, and a
 * shop-naming paidBy when it was channel data) changes — every other
 * field is carried by correctPayment verbatim.
 *
 * @param {object} state ledger state
 * @param {string} customerId
 * @param {string} month bill month (YYYY-MM)
 * @param {string} paymentId
 * @param {{ method:string, transactionId?:string, referenceOverrideReason?:string }} change
 * @param {Date} [referenceDate]
 * @returns {object} next state
 */
export function reassignPaymentMethod(state, customerId, month, paymentId, change = {}, referenceDate = new Date()) {
  const { payment } = findPayment(state, customerId, month, paymentId);
  const lock = paymentChannelLock(payment);
  if (lock?.reason === 'voided') throw new Error('Cannot change the channel of a voided payment. Voided receipts are kept as history.');
  if (lock?.reason === 'shop-settled') throw new Error('This receipt was already handed over from the shop, so its channel cannot be changed. Reverse the shop handover first.');

  const method = typeof change.method === 'string' ? change.method : '';
  if (!PAYMENT_METHODS.includes(method)) throw new Error('Choose a valid payment method.');
  if (method === payment.method) throw new Error('This payment is already recorded on that channel.');

  // TID: an operator-entered TID wins; otherwise the record keeps the
  // TID it already carries (digital → digital keeps its reference;
  // digital → cash keeps it as arrival history — see module header).
  const enteredTid = typeof change.transactionId === 'string' ? change.transactionId.trim() : '';
  const existingTid = typeof payment.transactionId === 'string' && payment.transactionId
    ? payment.transactionId
    : (typeof payment.reference === 'string' ? payment.reference : '');
  const tid = enteredTid || existingTid;
  const enteredOverride = typeof change.referenceOverrideReason === 'string' ? change.referenceOverrideReason.trim() : '';
  const existingOverride = typeof payment.referenceOverrideReason === 'string' ? payment.referenceOverrideReason : '';
  const overrideReason = enteredOverride || existingOverride;

  // paidBy: preserved, except when the payer text itself shop-resolves
  // to a channel other than the destination (it was channel data).
  const paidByShop = resolveShopCollector('', payment.paidBy ?? '');
  const destinationShop = resolveShopCollector(method, '');
  const clearPaidBy = paidByShop !== null && paidByShop !== destinationShop;

  const fields = {
    date: payment.date,
    amount: payment.amount,
    method,
    discount: payment.discount ?? 0,
    discountReason: payment.discountReason ?? '',
    // correctPayment's carry-over list has no note entry, so the note is
    // passed explicitly — a channel change must never eat the note.
    ...(payment.note !== undefined ? { note: payment.note } : {}),
    ...(clearPaidBy ? { paidBy: '' } : (payment.paidBy !== undefined ? { paidBy: payment.paidBy } : {})),
    ...(tid ? { transactionId: tid } : {}),
    ...(overrideReason ? { referenceOverrideReason: overrideReason } : {})
  };
  const next = correctPayment(state, customerId, month, paymentId, fields, referenceDate, { strictDigitalReference: true });

  if (!clearPaidBy) return next;
  // Flag the audit entry correctPayment just appended, so the paidBy
  // clearing is as visible as the channel change itself.
  return {
    ...next,
    customers: next.customers.map((c) => c.id !== customerId ? c : {
      ...c,
      bills: c.bills.map((b) => b.month !== month ? b : {
        ...b,
        payments: b.payments.map((p) => {
          if (p.id !== paymentId || !Array.isArray(p.methodCorrections) || p.methodCorrections.length === 0) return p;
          const entries = [...p.methodCorrections];
          entries[entries.length - 1] = { ...entries[entries.length - 1], paidByCleared: true };
          return { ...p, methodCorrections: entries };
        })
      })
    })
  };
}

/**
 * Row action for a payment: the 🔀 Channel button when the channel can
 * change, the lock note when it cannot, and nothing for voided rows
 * (both surfaces already render voided payments as frozen history).
 */
export function channelActionMarkup(payment, { customerId, month } = {}) {
  if (!payment || payment.voided === true) return '';
  const lock = paymentChannelLock(payment);
  if (lock) {
    return `<span class="channel-lock-note" title="${escapeHtml(channelLockText(lock))}">🔒 ${escapeHtml(t('reassign_locked_short'))}</span>`;
  }
  return `<button class="reassign-channel" type="button" data-reassign-channel="${escapeHtml(payment.id)}" data-customer-id="${escapeHtml(customerId)}" data-month="${escapeHtml(month)}" aria-label="${escapeHtml(t('reassign_btn_aria', null, { method: payment.method }))}">${escapeHtml(t('reassign_btn'))}</button>`;
}

/**
 * Dialog controller for #paymentMethodReassignDialog (index.html).
 * Follows the setupSuspensePaymentsModal pattern: getState supplies the
 * live ledger; onUpdateState persists + re-renders; onDuplicatePrompt
 * (optional) mirrors the correction form's duplicate-TID confirm.
 * Returns { open(customerId, month, paymentId) } or null without a DOM.
 */
export function setupPaymentMethodReassignModal(getState, { onUpdateState, onToast, onDuplicatePrompt } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('paymentMethodReassignDialog') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let target = null;

  const getPayment = () => {
    if (!target) return null;
    try {
      const state = typeof getState === 'function' ? getState() : null;
      const customer = (state?.customers ?? []).find((c) => c.id === target.customerId);
      const bill = (customer?.bills ?? []).find((b) => b.month === target.month);
      const payment = (bill?.payments ?? []).find((p) => p.id === target.paymentId);
      return customer && payment ? { customer, payment } : null;
    } catch {
      return null;
    }
  };

  const showError = (message) => {
    const errorEl = $('paymentReassignError');
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  };

  const syncTidRow = () => {
    const select = $('paymentReassignMethodSelect');
    const row = $('paymentReassignTidRow');
    if (!select || !row) return;
    row.hidden = !isDigitalPaymentMethod(select.value);
  };

  function open(customerId, month, paymentId) {
    target = { customerId, month, paymentId };
    const found = getPayment();
    if (!found) return;
    const { customer, payment } = found;
    const summary = $('paymentReassignSummary');
    if (summary) {
      summary.textContent = t('reassign_summary', null, {
        number: customer.customerNumber ?? '',
        name: customer.name ?? '',
        amount: formatPKR(payment.amount ?? 0),
        date: payment.date ?? '',
        method: payment.method ?? ''
      });
    }
    const select = $('paymentReassignMethodSelect');
    if (select) {
      select.innerHTML = PAYMENT_METHODS
        .filter((method) => method !== payment.method)
        .map((method) => `<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`)
        .join('');
    }
    const tidInput = $('paymentReassignTidInput');
    if (tidInput) tidInput.value = payment.transactionId || payment.reference || '';
    const overrideInput = $('paymentReassignOverrideInput');
    if (overrideInput) overrideInput.value = payment.referenceOverrideReason || '';
    showError('');
    syncTidRow();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.hidden = false;
  }

  const close = () => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.hidden = true;
  };

  $('paymentReassignMethodSelect')?.addEventListener('change', syncTidRow);
  $('paymentReassignCloseBtn')?.addEventListener('click', close);
  $('paymentReassignCancelBtn')?.addEventListener('click', close);
  $('paymentReassignConfirmBtn')?.addEventListener('click', async () => {
    if (!target) return;
    const found = getPayment();
    if (!found) { close(); return; }
    const method = $('paymentReassignMethodSelect')?.value || '';
    const transactionId = ($('paymentReassignTidInput')?.value || '').trim();
    const referenceOverrideReason = ($('paymentReassignOverrideInput')?.value || '').trim();
    try {
      const state = typeof getState === 'function' ? getState() : null;
      // Same duplicate-TID courtesy as the correction form: warn before
      // this receipt joins another payment under one reference.
      if (transactionId && isDigitalPaymentMethod(method)) {
        const dup = findDuplicatePaymentReference(state, transactionId, target.paymentId);
        if (dup) {
          if (typeof onDuplicatePrompt === 'function') {
            if (!(await onDuplicatePrompt(transactionId, dup))) return;
          } else {
            showError(t('reassign_dup_tid', null, { number: dup.customerNumber ?? '' }));
            return;
          }
        }
      }
      const next = reassignPaymentMethod(state, target.customerId, target.month, target.paymentId, { method, transactionId, referenceOverrideReason });
      if (typeof onUpdateState === 'function') onUpdateState(next);
      const fromMethod = found.payment.method;
      close();
      if (typeof onToast === 'function') onToast(t('reassign_done', null, { from: fromMethod, to: method }), { type: 'success', title: t('reassign_title') });
    } catch (error) {
      showError(error?.message || String(error));
    }
  });

  return { open };
}
