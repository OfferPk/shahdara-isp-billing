/**
 * payment-void-audit.js — SISP-34: Wrong / Duplicate Payment Reversal
 * (Void Receipt) & Cross-Ledger Rollback.
 *
 * Problem: a wrong or duplicate payment was recorded (wrong amount, wrong
 * customer, entered twice). Deleting it would erase history; editing it
 * cannot undo the cross-ledger effects it already caused (balance settled,
 * shop cash counted, Waada promise auto-cleared). So voiding keeps the
 * original payment row forever and rolls every leg back:
 *
 *   1. The payment is marked voided: true + voidedAt + voidReason — it is
 *      NEVER deleted. All money derivations in the app skip voided
 *      payments (see the SISP-34 notes in core.js, shop-settlement.js,
 *      dashboard.js, roznamcha.js, profile-ui.js, owner-insights.js,
 *      payments-inbox.js, qa-discounts-late-fee.js and
 *      form-validation.js), so the customer's unpaid balance is restored
 *      and the voided amount stops counting as collected cash.
 *   2. Shop cash: voided payments are excluded from collectShopPayments,
 *      so a voided shop receipt drops out of that shop's unsettled cash.
 *      A payment whose cash was ALREADY handed over to the owner
 *      (shopSettledAmount > 0 or shopSettled) can NOT be voided — handed
 *      cash cannot be silently un-handed by voiding a receipt. The void
 *      refuses with a clear message instead of a partial rollback.
 *   3. Waada promise: when a full payment auto-clears a promise, core.js
 *      addPayment stamps the cleared promise onto that payment
 *      (payment.clearedWaada). Voiding that payment restores the stamped
 *      promise — but ONLY when the customer has no newer promise now, so
 *      a void never clobbers a promise the operator set afterwards.
 *      Payments recorded before SISP-34 carry no stamp, so their cleared
 *      promises cannot be recovered by a void; the operator re-sets those
 *      manually (the void record says promiseRestored: false).
 *   3b. Remainder Waada (SISP-126): a partial payment that set a
 *      remainder waada carries a payment.remainderWaada stamp (plus the
 *      promise it replaced). Voiding it reverts that promise — restoring
 *      the replaced one when the stamp kept it, otherwise clearing —
 *      but ONLY while the live promise is still exactly that remainder
 *      waada, so a newer promise is never clobbered (the void record
 *      says remainderWaadaReverted).
 *   4. The void itself is logged in localStorage under VOIDED_PAYMENTS_KEY
 *      (sisp_voided_payments_v1) and travels in JSON backups via the
 *      `settings.voidPayments` section (see core.js createJsonBackup).
 *   5. Late-fee waiver (SISP-101): a payment recorded with the Quick
 *      Collect "Waive Late Fee" toggle carries the bill's pre-waiver
 *      fee fields as a stamp (payment.waivedLateFee) and zeroed the
 *      bill's lateFee. Voiding restores exactly that fee — but ONLY
 *      when the bill carries no late fee now, so a void never clobbers
 *      a fee the owner applied afterwards (the promise guard in 3,
 *      applied to fees). The void record says lateFeeRestored.
 *
 * ATOMICITY: voidPayment is a pure function. It validates EVERYTHING
 * first (payment exists, not already voided, non-empty reason, no shop
 * settlement), then builds the whole next state from a deep clone. If any
 * leg throws, the input state is untouched and the caller persists
 * nothing — a void can never half-apply in memory. Persistence is two
 * localStorage keys (ledger + void log); the app caller writes the ledger
 * first and the log second, and if the log write fails it writes the
 * previous ledger back and reports failure, so a failed void leaves no
 * half-applied state behind. A double failure (both writes failing) is
 * surfaced by toast, never silent.
 *
 * This module imports nothing on purpose, so core.js can import
 * sanitizeVoidPayments for backup restore without a module cycle.
 * Tests use synthetic data only.
 */

export const VOIDED_PAYMENTS_KEY = 'sisp_voided_payments_v1';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// SISP-126: the marker note a remainder waada carries. Must match
// REMAINDER_WAADA_NOTE in waada-queue.js — duplicated here (like the
// Intl date pattern in waada-queue.js) so this module stays import-free.
const REMAINDER_WAADA_NOTE_TEXT = 'Remainder waada — partial payment';

function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * SISP-101: local mirror of late-fee-waiver.js sanitizeWaivedLateFeeStamp
 * + formatLocalMinute (kept local so this module stays dependency-free,
 * like shopSettledAmountOf below). The stamp is the bill's pre-waiver
 * fee fields { month, lateFee, lateFeeAppliedAt, lateFeeReason }; a
 * malformed stamp reads as null and can never steer a restoration.
 * Timestamps written into bill amountHistory must use the strict
 * 'YYYY-MM-DDTHH:mm' local shape core's backup validation accepts.
 */
function sanitizeWaivedLateFeeStampLocal(value) {
  if (!value || typeof value !== 'object') return null;
  const month = typeof value.month === 'string' ? value.month : '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const lateFee = Number(value.lateFee);
  if (!Number.isFinite(lateFee) || lateFee <= 0) return null;
  return {
    month,
    lateFee: Math.round(lateFee * 100) / 100,
    lateFeeAppliedAt: typeof value.lateFeeAppliedAt === 'string' && value.lateFeeAppliedAt ? value.lateFeeAppliedAt : null,
    lateFeeReason: typeof value.lateFeeReason === 'string' ? value.lateFeeReason.replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 100) : ''
  };
}

function formatLocalMinuteLocal(isoValue) {
  const parsed = new Date(isoValue);
  const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** True only for payments voided by SISP-34 (never for legacy rows). */
export function isVoidedPayment(payment) {
  return !!payment && typeof payment === 'object' && payment.voided === true;
}

/**
 * Shop-settled amount on a payment, mirroring shop-settlement.js
 * settledAmountOf (kept local so this module stays dependency-free).
 */
function shopSettledAmountOf(payment) {
  if (!payment || typeof payment !== 'object') return 0;
  const explicit = Number(payment.shopSettledAmount);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, moneyValue(payment.amount));
  if (payment.shopSettled) return moneyValue(payment.amount);
  return 0;
}

function voidId() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return `void-${globalThis.crypto.randomUUID()}`;
    }
  } catch { /* fall through */ }
  return `void-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Reads void records; [] on missing/corrupt storage. */
export function loadVoidPayments(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(VOIDED_PAYMENTS_KEY);
    if (!raw) return [];
    return sanitizeVoidPayments(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists void records; never throws. Returns false on failure. */
export function saveVoidPayments(records, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(VOIDED_PAYMENTS_KEY, JSON.stringify(Array.isArray(records) ? records : []));
    return true;
  } catch {
    return false;
  }
}

/** Drops malformed void records; keeps only known fields. */
export function sanitizeVoidPayments(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.paymentId !== 'string' || !entry.paymentId) continue;
    if (typeof entry.voidReason !== 'string' || !entry.voidReason.trim()) continue;
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    out.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : voidId(),
      customerId: entry.customerId ?? null,
      customerNumber: entry.customerNumber ?? null,
      customerName: typeof entry.customerName === 'string' ? entry.customerName : '',
      billMonth: typeof entry.billMonth === 'string' ? entry.billMonth : '',
      paymentId: entry.paymentId,
      paymentDate: typeof entry.paymentDate === 'string' ? entry.paymentDate : '',
      amount,
      method: typeof entry.method === 'string' ? entry.method : '',
      shop: typeof entry.shop === 'string' ? entry.shop : '',
      voidReason: entry.voidReason.trim(),
      voidedAt: typeof entry.voidedAt === 'string' ? entry.voidedAt : '',
      promiseRestored: entry.promiseRestored === true,
      restoredPromiseDate: typeof entry.restoredPromiseDate === 'string' ? entry.restoredPromiseDate : '',
      // SISP-126: kept only when a remainder waada was actually reverted,
      // so pre-SISP-126 void records sanitize byte-identically.
      ...(entry.remainderWaadaReverted === true ? { remainderWaadaReverted: true } : {}),
      // SISP-101: the fee-restoration pair is emitted ONLY on records
      // that actually restored a waived late fee — every pre-SISP-101
      // void record stays byte-identical through this sanitizer.
      ...(entry.lateFeeRestored === true ? {
        lateFeeRestored: true,
        restoredLateFeeAmount: Number.isFinite(Number(entry.restoredLateFeeAmount)) && Number(entry.restoredLateFeeAmount) > 0
          ? Math.round(Number(entry.restoredLateFeeAmount) * 100) / 100
          : 0
      } : {}),
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/**
 * Voids one payment with a full cross-ledger rollback. Pure: the input
 * state is never mutated; on any failure it throws and nothing changes.
 *
 * @param {object} state ledger state ({ customers: [...] })
 * @param {string} customerId
 * @param {string} month bill month (YYYY-MM)
 * @param {string} paymentId
 * @param {object} options { voidReason (REQUIRED, non-empty), voidedAt? }
 * @returns {{ state: object, voidRecord: object }}
 * @throws on missing customer/bill/payment, already-voided payment,
 *   empty reason, or a shop-settled payment.
 */
export function voidPayment(state, customerId, month, paymentId, options = {}) {
  const voidReason = typeof options.voidReason === 'string' ? options.voidReason.trim() : '';
  if (!voidReason) throw new Error('A void reason is required. Void was not applied.');
  const customer = (state && Array.isArray(state.customers) ? state.customers : [])
    .find((c) => c && typeof c === 'object' && c.id === customerId);
  if (!customer) throw new Error('Customer not found. Void was not applied.');
  const bill = (Array.isArray(customer.bills) ? customer.bills : [])
    .find((b) => b && typeof b === 'object' && b.month === month);
  if (!bill) throw new Error('Bill not found. Void was not applied.');
  const payment = (Array.isArray(bill.payments) ? bill.payments : [])
    .find((p) => p && typeof p === 'object' && p.id === paymentId);
  if (!payment) throw new Error('Payment not found. Void was not applied.');
  if (payment.voided === true) throw new Error('This payment is already voided.');
  if (shopSettledAmountOf(payment) > 0) {
    throw new Error('This payment was already handed over from the shop and cannot be voided. Reverse the shop handover first, then void.');
  }

  const voidedAt = typeof options.voidedAt === 'string' && options.voidedAt
    ? options.voidedAt
    : new Date().toISOString();
  const stamp = payment.clearedWaada && typeof payment.clearedWaada === 'object'
    ? payment.clearedWaada
    : null;
  const hasCurrentPromise = typeof customer.promiseDate === 'string' && customer.promiseDate.trim() !== '';
  const restorePromise = !!stamp
    && typeof stamp.promiseDate === 'string' && DATE_RE.test(stamp.promiseDate.trim())
    && !hasCurrentPromise;

  // SISP-126: a partial payment that set a Remainder Waada carries a
  // remainderWaada stamp. Voiding it rolls that promise back — but ONLY
  // while the customer's live promise is still exactly that remainder
  // waada (same date, amount and marker note); a promise set afterwards
  // is never clobbered, mirroring the clearedWaada discipline above.
  const remStamp = payment.remainderWaada && typeof payment.remainderWaada === 'object'
    ? payment.remainderWaada
    : null;
  const remDate = remStamp && typeof remStamp.promiseDate === 'string' ? remStamp.promiseDate.trim() : '';
  const remAmount = remStamp ? Number(remStamp.promiseAmount) : NaN;
  const remainderWaadaLive = !!remStamp
    && DATE_RE.test(remDate)
    && Number.isFinite(remAmount) && remAmount > 0
    && !restorePromise
    && customer.promiseDate === remDate
    && Number(customer.promiseAmount) === remAmount
    && String(customer.promiseNote ?? '') === REMAINDER_WAADA_NOTE_TEXT;
  const remPrevious = remainderWaadaLive && remStamp.previousWaada && typeof remStamp.previousWaada === 'object'
    ? remStamp.previousWaada
    : null;
  const remPreviousDate = remPrevious && typeof remPrevious.promiseDate === 'string'
    ? remPrevious.promiseDate.trim()
    : '';
  // SISP-101: restore the waived late fee from the payment's stamp —
  // only when the stamp names THIS bill and the bill carries no late
  // fee now (a fee the owner applied after the waiver is never
  // clobbered by a void, mirroring the promise guard above).
  const waiverStamp = payment.lateFeeWaived === true
    ? sanitizeWaivedLateFeeStampLocal(payment.waivedLateFee)
    : null;
  const restoreLateFee = !!waiverStamp
    && waiverStamp.month === bill.month
    && !(Number(bill.lateFee || 0) > 0);

  // Shop name for the log (same "Cash at X shop" derivation as
  // shop-settlement.js resolveShopCollector, kept local + dependency-free).
  let shop = '';
  const methodLower = String(payment.method || '').toLowerCase();
  const paidByLower = String(payment.paidBy || '').toLowerCase();
  if (methodLower.includes('waseem') || paidByLower.includes('waseem')) shop = 'Waseem Abbasi Shop';
  // OWNER-CASH-SHOP: hassan/balla are the ONE shop "Hassan Balla Shop",
  // mirroring the unified resolveShopCollector derivation.
  else if (methodLower.includes('hassan') || paidByLower.includes('hassan') || methodLower.includes('balla') || paidByLower.includes('balla')) shop = 'Hassan Balla Shop';
  else {
    const custom = String(payment.method || '').match(/cash\s+at\s+(.+?)\s+shop/i);
    if (custom && custom[1].trim()) shop = `${custom[1].trim()} Shop`;
  }

  const voidRecord = {
    id: voidId(),
    customerId: customer.id ?? null,
    customerNumber: customer.customerNumber ?? null,
    customerName: customer.name ?? '',
    billMonth: bill.month ?? '',
    paymentId: payment.id ?? null,
    paymentDate: payment.date ?? '',
    amount: moneyValue(payment.amount),
    method: payment.method ?? '',
    shop,
    voidReason,
    voidedAt,
    promiseRestored: restorePromise,
    restoredPromiseDate: restorePromise ? stamp.promiseDate.trim() : '',
    // SISP-126: present only when this void reverted a remainder waada.
    ...(remainderWaadaLive ? { remainderWaadaReverted: true } : {}),
    // SISP-101: stamped only when this void actually restored a waived
    // late fee (same conditional-emission rule as the sanitizer above),
    // so ordinary void records keep their pre-SISP-101 shape.
    ...(restoreLateFee ? { lateFeeRestored: true, restoredLateFeeAmount: waiverStamp.lateFee } : {}),
    createdAt: voidedAt
  };

  const next = clone(state || { customers: [] });
  const nextCustomer = (Array.isArray(next.customers) ? next.customers : [])
    .find((c) => c && typeof c === 'object' && c.id === customerId);
  const nextBill = (Array.isArray(nextCustomer.bills) ? nextCustomer.bills : [])
    .find((b) => b && typeof b === 'object' && b.month === month);
  const nextPayment = (Array.isArray(nextBill.payments) ? nextBill.payments : [])
    .find((p) => p && typeof p === 'object' && p.id === paymentId);
  nextPayment.voided = true;
  nextPayment.voidedAt = voidedAt;
  nextPayment.voidReason = voidReason;
  if (restorePromise) {
    nextCustomer.promiseDate = stamp.promiseDate.trim();
    if (stamp.promiseAmount !== null && stamp.promiseAmount !== undefined && stamp.promiseAmount !== '') {
      nextCustomer.promiseAmount = stamp.promiseAmount;
    }
    if (typeof stamp.promiseNote === 'string' && stamp.promiseNote !== '') {
      nextCustomer.promiseNote = stamp.promiseNote;
    }
  }
  if (remainderWaadaLive) {
    // Roll the remainder waada back: restore the promise it replaced
    // when the stamp kept one (field by field — an absent amount/note
    // on the old promise means the field goes away), otherwise clear.
    if (remPrevious && DATE_RE.test(remPreviousDate)) {
      nextCustomer.promiseDate = remPreviousDate;
      if (remPrevious.promiseAmount !== null && remPrevious.promiseAmount !== undefined && remPrevious.promiseAmount !== '') {
        nextCustomer.promiseAmount = remPrevious.promiseAmount;
      } else {
        delete nextCustomer.promiseAmount;
      }
      if (typeof remPrevious.promiseNote === 'string' && remPrevious.promiseNote !== '') {
        nextCustomer.promiseNote = remPrevious.promiseNote;
      } else {
        delete nextCustomer.promiseNote;
      }
    } else {
      delete nextCustomer.promiseDate;
      delete nextCustomer.promiseAmount;
      delete nextCustomer.promiseNote;
    }
  }

  if (restoreLateFee) {
    nextBill.lateFee = waiverStamp.lateFee;
    nextBill.lateFeeAppliedAt = waiverStamp.lateFeeAppliedAt;
    nextBill.lateFeeReason = waiverStamp.lateFeeReason;
    const amountHistory = Array.isArray(nextBill.amountHistory) ? [...nextBill.amountHistory] : [];
    amountHistory.push({
      changedAt: formatLocalMinuteLocal(voidedAt),
      type: 'late_fee_restored',
      previousLateFee: 0,
      lateFee: waiverStamp.lateFee,
      note: 'Late fee restored (payment voided)'
    });
    nextBill.amountHistory = amountHistory;
  }
  return { state: next, voidRecord };
}

/**
 * Sharafat 63: predict what voiding one payment would undo, WITHOUT
 * voiding it — the void confirmation dialog shows this list before the
 * operator confirms. Pure and never throws: the dialog calls it for
 * every payment (including shop-settled ones, which voidPayment
 * refuses), so a throwing helper would break dialog open. It mirrors
 * voidPayment's predicates clause for clause (cleared-waada restore,
 * remainder-waada revert, waived late-fee restore) and the two unsettle
 * filters (ticket / boost reopen counts, through the same sanitized
 * views the real rollback reads). If any predicate here drifted from
 * voidPayment, the dialog would promise something the void will not
 * do (or hide something it will). Returns [] for a voided payment
 * and for any malformed input.
 *
 * @param {object} customer
 * @param {object} bill the bill the payment belongs to (late-fee month check)
 * @param {object} payment
 * @param {object} options { tickets } the ticket list (loadTickets())
 * @returns {Array<{ kind: string, text: string }>} effect descriptors, in void order
 */
export function describeVoidUndo(customer, bill, payment, options = {}) {
  try {
    if (!payment || typeof payment !== 'object') return [];
    if (payment.voided === true) return [];
    const effects = [];
    const safeCustomer = customer && typeof customer === 'object' ? customer : null;

    // 1. Cleared-waada restore — mirrors voidPayment's restorePromise
    // predicate exactly: a stamped date in YYYY-MM-DD shape, and no
    // newer promise on the customer now.
    const stamp = payment.clearedWaada && typeof payment.clearedWaada === 'object'
      ? payment.clearedWaada
      : null;
    const hasCurrentPromise = !!safeCustomer
      && typeof safeCustomer.promiseDate === 'string' && safeCustomer.promiseDate.trim() !== '';
    const restorePromise = !!stamp
      && typeof stamp.promiseDate === 'string' && DATE_RE.test(stamp.promiseDate.trim())
      && !hasCurrentPromise;
    if (restorePromise) {
      const date = stamp.promiseDate.trim();
      const amount = Number(stamp.promiseAmount);
      effects.push({
        kind: 'waada-restore',
        promiseDate: date,
        promiseAmount: Number.isFinite(amount) ? amount : null,
        text: Number.isFinite(amount)
          ? `Will restore the waada of ${date} (PKR ${amount})`
          : `Will restore the waada of ${date}`
      });
    }

    // 2. Remainder-waada revert (SISP-126) — mirrors voidPayment's
    // remainderWaadaLive predicate exactly, including the !restorePromise
    // guard (a payment cannot restore both a cleared waada and revert
    // a remainder waada).
    const remStamp = payment.remainderWaada && typeof payment.remainderWaada === 'object'
      ? payment.remainderWaada
      : null;
    const remDate = remStamp && typeof remStamp.promiseDate === 'string' ? remStamp.promiseDate.trim() : '';
    const remAmount = remStamp ? Number(remStamp.promiseAmount) : NaN;
    const remainderWaadaLive = !!remStamp
      && DATE_RE.test(remDate)
      && Number.isFinite(remAmount) && remAmount > 0
      && !restorePromise
      && !!safeCustomer
      && safeCustomer.promiseDate === remDate
      && Number(safeCustomer.promiseAmount) === remAmount
      && String(safeCustomer.promiseNote ?? '') === REMAINDER_WAADA_NOTE_TEXT;
    if (remainderWaadaLive) {
      const remPrevious = remStamp.previousWaada && typeof remStamp.previousWaada === 'object'
        ? remStamp.previousWaada
        : null;
      const remPreviousDate = remPrevious && typeof remPrevious.promiseDate === 'string'
        ? remPrevious.promiseDate.trim()
        : '';
      if (remPrevious && DATE_RE.test(remPreviousDate)) {
        effects.push({
          kind: 'remainder-waada-revert',
          promiseDate: remDate,
          previousPromiseDate: remPreviousDate,
          text: `Will restore the previous waada of ${remPreviousDate}`
        });
      } else {
        effects.push({
          kind: 'remainder-waada-revert',
          promiseDate: remDate,
          previousPromiseDate: '',
          text: `Will clear the remainder waada of ${remDate}`
        });
      }
    }

    // 3. Waived late-fee restore (SISP-101) — mirrors voidPayment's
    // restoreLateFee predicate exactly: the stamp must name this bill
    // and the bill must carry no late fee now.
    const waiverStamp = payment.lateFeeWaived === true
      ? sanitizeWaivedLateFeeStampLocal(payment.waivedLateFee)
      : null;
    const restoreLateFee = !!waiverStamp
      && !!bill && typeof bill === 'object'
      && waiverStamp.month === bill.month
      && !(Number(bill.lateFee || 0) > 0);
    if (restoreLateFee) {
      effects.push({
        kind: 'late-fee-restore',
        amount: waiverStamp.lateFee,
        text: `Will restore the waived late fee of PKR ${waiverStamp.lateFee}`
      });
    }

    // 4. Ticket charges the void would reopen — the
    // unsettleTicketChargesForPayment filter shape, counted through
    // the same sanitized ticket view the real rollback reads.
    const ticketCount = countReopenableTicketCharges(options.tickets, payment);
    if (ticketCount > 0) {
      effects.push({
        kind: 'ticket-reopen',
        count: ticketCount,
        text: `Will reopen ${ticketCount} ticket charge${ticketCount === 1 ? '' : 's'}`
      });
    }

    // 5. Speed-boost charges the void would reopen — the
    // unsettleAddonChargesForPayment filter shape, counted through
    // the same sanitized boost view the real rollback reads.
    const addonCount = countReopenableAddonCharges(safeCustomer, payment);
    if (addonCount > 0) {
      effects.push({
        kind: 'addon-reopen',
        count: addonCount,
        text: `Will reopen ${addonCount} speed boost charge${addonCount === 1 ? '' : 's'}`
      });
    }

    return effects;
  } catch {
    return [];
  }
}

// Local mirror of complaint-tickets.js sanitizeTickets for the three
// fields the reopen filter reads (id / chargePaid / chargePaymentId):
// a ticket with a malformed id or no customer is dropped by the real
// sanitizer, so it can never be reopened by a void either. Kept local
// so this module stays import-free.
const TICKET_ID_RE = /^TKT-(\d+)$/;
function sanitizeTicketReopenView(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!TICKET_ID_RE.test(id)) continue;
    const customerId = typeof entry.customerId === 'string' ? entry.customerId.trim() : '';
    if (!customerId) continue;
    out.push({
      id,
      chargePaid: entry.chargePaid === true,
      chargePaymentId: entry.chargePaid === true && typeof entry.chargePaymentId === 'string'
        ? entry.chargePaymentId.slice(0, 80)
        : ''
    });
  }
  return out;
}

/**
 * How many ticket charges voiding this payment would reopen — the
 * unsettleTicketChargesForPayment filter, counted not applied: only
 * charges still paid, whose settlement still belongs to this payment.
 */
function countReopenableTicketCharges(tickets, payment) {
  const lines = Array.isArray(payment?.ticketCharges) ? payment.ticketCharges : [];
  const ids = new Set(lines.map((line) => String(line?.ticketId || '')).filter(Boolean));
  if (ids.size === 0) return 0;
  const paymentId = typeof payment?.id === 'string' ? payment.id : '';
  let count = 0;
  for (const ticket of sanitizeTicketReopenView(tickets)) {
    if (!ids.has(ticket.id) || !ticket.chargePaid) continue;
    if (paymentId && ticket.chargePaymentId && ticket.chargePaymentId !== paymentId) continue;
    count += 1;
  }
  return count;
}

// Local mirror of core.js validBoostDate (strict YYYY-MM-DD calendar
// date) — kept local so this module stays import-free.
function validBoostDateLocal(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

// Local mirror of core.js sanitizeSpeedBoosts for the fields the
// reopen filter reads (boostId / chargePaid / chargePaymentId): a boost
// that fails sanitization (bad id, fee, dates, or a duplicate id)
// never reopens, so it must never be counted either.
const BOOST_ID_RE_LOCAL = /^BST-\d+$/;
function sanitizeBoostReopenView(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    const boostId = typeof entry?.boostId === 'string' ? entry.boostId.trim() : '';
    if (!BOOST_ID_RE_LOCAL.test(boostId) || seen.has(boostId)) continue;
    const boostMbps = Number(entry?.boostMbps);
    const durationDays = Number(entry?.durationDays);
    const addonFeePKR = Number(entry?.addonFeePKR);
    const startDate = validBoostDateLocal(entry?.startDate);
    const expiryDate = validBoostDateLocal(entry?.expiryDate);
    if (!Number.isFinite(boostMbps) || boostMbps <= 0 || boostMbps > 10000) continue;
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) continue;
    if (!Number.isFinite(addonFeePKR) || addonFeePKR <= 0) continue;
    if (!startDate || !expiryDate || expiryDate < startDate) continue;
    seen.add(boostId);
    out.push({
      boostId,
      chargePaid: entry?.chargePaid === true,
      chargePaymentId: typeof entry?.chargePaymentId === 'string' ? entry.chargePaymentId.slice(0, 100) : ''
    });
  }
  return out;
}

/**
 * How many boost charges voiding this payment would reopen — the
 * unsettleAddonChargesForPayment filter, counted not applied.
 */
function countReopenableAddonCharges(customer, payment) {
  const lines = Array.isArray(payment?.addonCharges) ? payment.addonCharges : [];
  const ids = new Set(lines.map((line) => String(line?.boostId || '')).filter(Boolean));
  if (ids.size === 0) return 0;
  const paymentId = typeof payment?.id === 'string' ? payment.id : '';
  let count = 0;
  for (const boost of sanitizeBoostReopenView(customer?.speedBoosts)) {
    if (!ids.has(boost.boostId) || !boost.chargePaid) continue;
    if (paymentId && boost.chargePaymentId && boost.chargePaymentId !== paymentId) continue;
    count += 1;
  }
  return count;
}

/** HTML for the VOID badge + reason shown on a voided payment row. */
export function voidBadgeMarkup(payment) {
  if (!isVoidedPayment(payment)) return '';
  const reason = typeof payment.voidReason === 'string' && payment.voidReason.trim()
    ? payment.voidReason.trim()
    : 'No reason recorded';
  return `<span class="void-badge">VOID</span><span class="payment-meta">Voided: ${escapeHtml(reason)}</span>`;
}
