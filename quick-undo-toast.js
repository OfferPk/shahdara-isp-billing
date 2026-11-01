/**
 * quick-undo-toast.js — SISP-141: 10-Second [↩ Undo Payment] Toast
 * After 1-Tap Collection.
 *
 * After a 1-tap collection in Quick Collect or Field Mode, a floating
 * toast offers a 10-second Undo:
 *   "✅ PKR 3,000 collected from <Name> (<receipt ref>)  [↩ Undo (10s)]"
 * The countdown is live; on expiry the toast dismisses and the payment
 * simply stands (the toast is session UI only — nothing is persisted,
 * a page reload kills the offer, never the payment).
 *
 * REVERSAL DISCIPLINE — there is exactly ONE undo machinery in this
 * app: the Quick Collect undo (nav-quick-collect.js executeUndo).
 * reverseCollectedPayment below composes that exact machinery with
 * the exact same call shapes, in executeUndo's own order, deriving
 * every stamp from the payment record itself: a SISP-101 waived late
 * fee is restored first (restoreWaivedLateFee, then the delete is
 * flagged lateFeeWaiverReverted), SISP-106 boost charges reopen in
 * the working state (unsettleAddonChargesForPayment,
 * addonChargesReverted), SISP-43 ticket charges reopen in the ticket
 * store (unsettleTicketChargesForPayment, ticketChargesReverted),
 * the payment is removed via core deletePayment, and a SISP-126
 * remainder waada the payment set is rolled back last (the replaced
 * promise restored, or the promise cleared — never a newer one).
 * Every side effect therefore unwinds identically to the in-dialog
 * undo: engine balances re-derive, Roznamcha + shop-tray figures
 * (derived from payments) restore, and charges/fees/promises reopen.
 * (SISP-141 was built before the SISP-101/106/126 extensions landed;
 * its reversal was composed onto the extended seam at reconciliation
 * so the toast never half-reverses a payment carrying those stamps.
 * SISP-121 split collections never offer this toast — the split path
 * keeps its own in-dialog undo over both legs.) This is a DELETE-style immediate
 * reversal of a just-made mistake — deliberately NOT a SISP-34 void:
 * a void is the audit-preserving path for settled history and keeps
 * the receipt as a frozen record; the 10-second undo exists for the
 * fat-finger moment before the collection becomes history.
 *
 * The controller is DOM-free (clock + timers + presentation are
 * injected) so the window/replacement/idempotency rules are unit
 * tested without a browser; app.js supplies the real toast presenter.
 */

import { addonChargeLinesOf, deletePayment, formatPKR, ticketChargeLinesOf } from './core.js';
import { unsettleTicketChargesForPayment } from './complaint-tickets.js';
import { lateFeeWaiverOf, restoreWaivedLateFee } from './late-fee-waiver.js';
import { unsettleAddonChargesForPayment } from './speed-addon.js';
import { clearCustomerWaada, isRemainderWaadaCurrent, remainderWaadaOf, remainderWaadaPreviousOf, setCustomerWaada } from './waada-queue.js';
import { t } from './nav-language.js';

/** The undo window: 10 seconds from the collection moment. */
export const QUICK_UNDO_WINDOW_MS = 10000;
/** Countdown refresh cadence (the Quick Collect in-dialog precedent). */
export const QUICK_UNDO_TICK_MS = 250;

/**
 * The receipt reference printed on the toast: the payment's REAL
 * stored receiptNumber, else its permanentReceiptNumber (the
 * Recent Payments / PR #471 precedent). Never derived or fabricated —
 * a payment carrying neither yields '' and the toast omits the ref.
 */
export function quickUndoReceiptRef(payment) {
  const ref = String(payment?.receiptNumber ?? '').trim()
    || String(payment?.permanentReceiptNumber ?? '').trim();
  return ref;
}

/** Locate a recorded payment across a customer's bills. */
export function findCollectedPayment(state, customerId, paymentId) {
  const customer = (state?.customers ?? []).find(c => c.id === customerId);
  if (!customer || !paymentId) return null;
  for (const bill of customer.bills ?? []) {
    const payment = (bill.payments ?? []).find(p => p.id === paymentId);
    if (payment) return { payment, month: bill.month, customer };
  }
  return null;
}

/** Toast body: "✅ <amount> collected from <name>" + " (<ref>)" when a ref exists. */
export function buildQuickUndoMessage({ amount, customerName, receiptRef } = {}) {
  const base = t('qundo_collected', null, {
    amount: formatPKR(Number(amount) || 0),
    name: String(customerName ?? '')
  });
  const ref = String(receiptRef ?? '').trim();
  return ref ? `${base} (${ref})` : base;
}

/** The live countdown action label: "↩ Undo (10s)" … "↩ Undo (1s)". */
export function quickUndoCountdownLabel(secondsLeft) {
  const seconds = Math.max(0, Math.ceil(Number(secondsLeft) || 0));
  return t('qundo_undo', null, { seconds });
}

/** Error code marking "the payment is no longer there" (already undone/deleted elsewhere). */
export const QUICK_UNDO_GONE = 'qundo-gone';

function goneError() {
  const err = new Error(t('qundo_gone'));
  err.code = QUICK_UNDO_GONE;
  return err;
}

/**
 * Reverse a just-recorded collection through the SAME composed seam
 * the Quick Collect in-dialog Undo uses (nav-quick-collect
 * executeUndo), in its order, with every stamp read off the payment
 * record itself:
 *   1. a SISP-101 waived late fee is restored from the payment's
 *      reversal stamp (restoreWaivedLateFee), because core refuses
 *      to delete a waiver payment otherwise;
 *   2. SISP-106 boost charges the payment settled reopen in the
 *      working state (unsettleAddonChargesForPayment);
 *   3. SISP-43 ticket charges reopen in the ticket store
 *      (unsettleTicketChargesForPayment);
 *   4. the payment itself is removed with core deletePayment,
 *      flagged with exactly the reversions that ran
 *      (lateFeeWaiverReverted / addonChargesReverted /
 *      ticketChargesReverted);
 *   5. a SISP-126 remainder waada the payment set is rolled back —
 *      the promise it replaced is restored, or the promise cleared —
 *      but only while the live promise is still exactly that stamp.
 * Pure: returns { nextState, nextTickets, payment, month } and never
 * mutates its inputs. Throws a QUICK_UNDO_GONE-coded error when the
 * payment no longer exists; every other refusal (e.g. the payment was
 * voided meanwhile — deletePayment keeps voided receipts as history)
 * propagates core's own error verbatim so the caller can show it
 * honestly. `tickets` may be omitted only for payments without ticket
 * charges; a charged payment without the ticket list surfaces core's
 * guard error instead of half-reversing.
 */
export function reverseCollectedPayment({ state, tickets, customerId, paymentId, referenceDate = new Date() } = {}) {
  const found = findCollectedPayment(state, customerId, paymentId);
  if (!found) throw goneError();
  const { payment, month } = found;
  // Capture everything the payment carried BEFORE the delete — the
  // delete removes the only record holding the stamps.
  const waadaStamp = remainderWaadaOf(payment);
  const waadaPrevious = remainderWaadaPreviousOf(payment);
  let workingState = state;
  const deleteOptions = {};
  // SISP-101: restore the waived late fee first (core refuses the
  // delete otherwise), exactly as executeUndo does.
  if (lateFeeWaiverOf(payment)) {
    workingState = restoreWaivedLateFee(workingState, customerId, payment, { note: 'Late fee restored (payment undone)' }).state;
    deleteOptions.lateFeeWaiverReverted = true;
  }
  // SISP-106: reopen the boost charges in the working state.
  if (addonChargeLinesOf(payment).length > 0) {
    const cust = workingState.customers.find(c => c.id === customerId);
    if (cust) {
      const { customer: reopenedCustomer } = unsettleAddonChargesForPayment(cust, payment);
      workingState = { ...workingState, customers: workingState.customers.map(c => (c.id === customerId ? reopenedCustomer : c)) };
    }
    deleteOptions.addonChargesReverted = true;
  }
  // SISP-43: reopen the ticket charges in the ticket store.
  const settledLines = ticketChargeLinesOf(payment);
  let nextTickets = null;
  if (settledLines.length > 0 && Array.isArray(tickets)) {
    const { tickets: revertedTickets } = unsettleTicketChargesForPayment(tickets, { id: paymentId, ticketCharges: settledLines });
    nextTickets = revertedTickets;
    deleteOptions.ticketChargesReverted = true;
  }
  let nextState = Object.keys(deleteOptions).length > 0
    ? deletePayment(workingState, customerId, month, paymentId, referenceDate, deleteOptions)
    : deletePayment(workingState, customerId, month, paymentId, referenceDate);
  // SISP-126: roll back the remainder waada this payment set — only
  // while the live promise is still exactly this payment's stamp, so
  // a newer promise is never clobbered.
  if (waadaStamp) {
    const custAfter = nextState.customers.find(c => c.id === customerId);
    if (custAfter && isRemainderWaadaCurrent(custAfter, waadaStamp)) {
      const restored = waadaPrevious
        ? setCustomerWaada(custAfter, waadaPrevious)
        : clearCustomerWaada(custAfter);
      nextState = { ...nextState, customers: nextState.customers.map(c => (c.id === customerId ? restored : c)) };
    }
  }
  return { nextState, nextTickets, payment, month };
}

/**
 * The 10-second offer state machine. One pending offer at a time: a
 * second collection REPLACES the pending toast (its handle is
 * dismissed first, so the earlier payment's toast-undo is gone — it
 * can still be reversed through the in-dialog / profile paths).
 * Undo is idempotent: a double-tap reverses at most once.
 *
 * Injected deps:
 *   present({ message, undoLabel, onUndo }) -> { dismiss(), setUndoLabel(text) } | null
 *   reverse(entry) -> performs the reversal (may throw; QUICK_UNDO_GONE
 *                     code routes to onGone, anything else to onFailure)
 *   onReversed(entry) / onGone(entry) / onFailure(entry, err)
 *   now() / setInterval / clearInterval — injectable clock + timers.
 */
export function createQuickUndoController(deps = {}) {
  const {
    present,
    reverse,
    onReversed,
    onGone,
    onFailure,
    now = () => Date.now(),
    setIntervalFn = (fn, ms) => setInterval(fn, ms),
    clearIntervalFn = (id) => clearInterval(id),
    tickMs = QUICK_UNDO_TICK_MS,
    windowMs = QUICK_UNDO_WINDOW_MS
  } = deps;

  let pendingEntry = null;
  let handle = null;
  let timerId = null;
  let deadline = 0;
  let lastSecondsShown = null;
  let reversing = false;

  function stopTimer() {
    if (timerId !== null) {
      try { clearIntervalFn(timerId); } catch { /* noop */ }
      timerId = null;
    }
  }

  function dismissHandle() {
    if (handle) {
      try { handle.dismiss(); } catch { /* noop */ }
      handle = null;
    }
  }

  function clearOffer() {
    stopTimer();
    dismissHandle();
    pendingEntry = null;
    lastSecondsShown = null;
  }

  function secondsLeft() {
    return Math.max(0, Math.ceil((deadline - now()) / 1000));
  }

  function tick() {
    if (!pendingEntry) return;
    if (now() >= deadline) {
      // Expiry: the offer dies, the payment stands untouched.
      clearOffer();
      return;
    }
    const left = secondsLeft();
    if (left !== lastSecondsShown) {
      lastSecondsShown = left;
      try { handle?.setUndoLabel?.(quickUndoCountdownLabel(left)); } catch { /* noop */ }
    }
  }

  function offer(entry) {
    if (!entry || !entry.customerId || !entry.paymentId) return false;
    // Replacement rule: retire the previous offer before presenting.
    clearOffer();
    pendingEntry = { ...entry };
    deadline = now() + windowMs;
    lastSecondsShown = secondsLeft();
    const message = buildQuickUndoMessage(entry);
    try {
      handle = typeof present === 'function'
        ? present({
          message,
          undoLabel: quickUndoCountdownLabel(lastSecondsShown),
          onUndo: () => { undo(); }
        })
        : null;
    } catch {
      handle = null;
    }
    timerId = setIntervalFn(tick, tickMs);
    return true;
  }

  function undo() {
    if (!pendingEntry || reversing) return false;
    const entry = pendingEntry;
    // Clear first: a re-entrant tap (or the toast system's own action
    // wiring) can never reverse twice.
    clearOffer();
    reversing = true;
    try {
      if (typeof reverse === 'function') reverse(entry);
      if (typeof onReversed === 'function') onReversed(entry);
    } catch (err) {
      if (err && err.code === QUICK_UNDO_GONE) {
        if (typeof onGone === 'function') onGone(entry);
      } else if (typeof onFailure === 'function') {
        onFailure(entry, err);
      }
    } finally {
      reversing = false;
    }
    return true;
  }

  return {
    offer,
    undo,
    /** The currently offered entry (a copy), or null. */
    pending: () => (pendingEntry ? { ...pendingEntry } : null),
    /** Retire any pending offer without reversing (page teardown). */
    dispose: () => { clearOffer(); }
  };
}
