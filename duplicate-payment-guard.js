/**
 * duplicate-payment-guard.js — SISP-146: 5-Minute Double-Tap Duplicate
 * Payment Guard.
 *
 * Problem: in the field, a collector taps "collect" twice (or re-opens
 * the sheet and records again) and the same cash lands on the ledger
 * twice within moments. Nothing about the second record looks wrong on
 * its own — same customer, same amount, same method — so the duplicate
 * is only obvious RIGHT AFTER the first one was logged.
 *
 * This module is the ONE shared implementation every interactive
 * single-payment surface consults before recording:
 *   - Quick Collect sheet (nav-quick-collect.js submit),
 *   - Field Mode collect + advance sheets (field-mode.js),
 *   - profile add-payment form (app.js onPaymentSubmit),
 *   - profile Advance dialog + prepay save (app.js),
 *   - Suspense claim & link (suspense-payments.js modal).
 * Batch flows are deliberately NOT prompted (see the phase report):
 * group collect records many members in one tap (different customers),
 * and the payments inbox already hard-blocks a duplicate TID.
 *
 * Detection is a pure function over the ledger: a candidate
 * { customerId, amount, method } matches an earlier payment when ALL of
 * these hold:
 *   - same customer,
 *   - same amount, exact to the cent,
 *   - same method,
 *   - the earlier payment is NOT voided (SISP-34: re-recording after a
 *     void is legitimate, never a double-tap),
 *   - the earlier payment carries a `recordedAt` stamp and was logged
 *     strictly less than 5 minutes before `now` (the window is
 *     [0, 5min): a payment logged exactly 5:00 ago is OUT, and a stamp
 *     in the future — device clock moved backwards — never matches).
 *
 * The stamp: core.js addPayment stamps every payment it records with
 * `recordedAt` (an ISO instant taken from the call's reference date,
 * which is "now" at every interactive entry point). Payments recorded
 * before SISP-146 — and rows created by history imports, which never
 * pass through addPayment — carry no stamp and can therefore never
 * trigger the guard. That is an honest limit, never papered over: the
 * payment's billing DATE is never used as a stand-in for its logged
 * time (a backdated entry is not a double-tap, and an old payment
 * merely DATED today was not logged today).
 *
 * A match never silently blocks: the surface asks the operator through
 * the shared themed appConfirm dialog (Cancel focused by default —
 * ui-feedback.js's safe default) and records only on an explicit
 * "Record anyway". No match means zero UI change: existing flows stay
 * byte-identical.
 */
import { isVoidedPayment } from './payment-void-audit.js';
import { t } from './nav-language.js';

/** The double-tap window: 5 minutes, in milliseconds. */
export const DUPLICATE_PAYMENT_WINDOW_MS = 5 * 60 * 1000;

const centsOf = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};

const nowMsOf = (now) => {
  if (now instanceof Date) return now.getTime();
  if (typeof now === 'number' && Number.isFinite(now)) return now;
  if (typeof now === 'string' && now.trim()) {
    const parsed = Date.parse(now);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * The instant a payment was LOGGED, in epoch milliseconds — or null when
 * the payment carries no usable stamp (every pre-SISP-146 record, every
 * imported history row). Accepts the ISO stamp core writes, a plain
 * epoch number, or a Date, so tests and future stamp formats stay
 * comparable. The billing `date` field is NEVER consulted here.
 */
export function paymentRecordedAtMs(payment) {
  if (!payment || typeof payment !== 'object') return null;
  const raw = payment.recordedAt;
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) {
    const ms = raw.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw.trim());
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Find the most recent earlier payment that makes `candidate` a likely
 * double-tap, or null. `candidate` is { customerId, amount, method,
 * excludePaymentId? } — the payment ABOUT to be recorded. `now` is
 * injectable for tests (Date | epoch ms | ISO string; defaults to the
 * current instant). Pure: reads state, changes nothing.
 *
 * Returns { paymentId, billMonth, amount, method, date, recordedAt,
 * elapsedMs } describing the EARLIER payment.
 */
export function findRecentDuplicate(state, candidate, now = new Date()) {
  if (!state || !Array.isArray(state.customers) || !candidate) return null;
  const customerId = candidate.customerId;
  if (customerId === null || customerId === undefined || customerId === '') return null;
  const candidateCents = centsOf(candidate.amount);
  if (candidateCents === null || candidateCents <= 0) return null;
  const method = typeof candidate.method === 'string' ? candidate.method : '';
  if (!method) return null;
  const nowMs = nowMsOf(now) ?? Date.now();

  const customer = state.customers.find(c => c && String(c.id) === String(customerId));
  if (!customer) return null;

  let best = null;
  for (const bill of (customer.bills ?? [])) {
    for (const payment of (bill?.payments ?? [])) {
      if (!payment || typeof payment !== 'object') continue;
      if (candidate.excludePaymentId && payment.id === candidate.excludePaymentId) continue;
      // SISP-34: a voided twin never triggers — re-recording after a
      // void is the legitimate correction path, not a double-tap.
      if (isVoidedPayment(payment)) continue;
      if (payment.method !== method) continue;
      if (centsOf(payment.amount) !== candidateCents) continue;
      const recordedMs = paymentRecordedAtMs(payment);
      if (recordedMs === null) continue; // unstamped legacy/imported row
      const elapsedMs = nowMs - recordedMs;
      // Window is [0, 5min): exactly 5:00 ago is OUT; a future stamp
      // (clock moved backwards) can never be proven recent — no match.
      if (elapsedMs < 0 || elapsedMs >= DUPLICATE_PAYMENT_WINDOW_MS) continue;
      if (!best || recordedMs > best.recordedMs) {
        best = {
          paymentId: payment.id ?? null,
          billMonth: bill.month ?? '',
          amount: Number(payment.amount),
          method: payment.method,
          date: typeof payment.date === 'string' ? payment.date : '',
          recordedAt: payment.recordedAt,
          recordedMs,
          elapsedMs
        };
      }
    }
  }
  if (!best) return null;
  const { recordedMs, ...result } = best;
  return result;
}

/**
 * A stable key identifying ONE bypass decision: this operator, having
 * seen the prompt for THIS earlier payment, chose to record anyway.
 * Surfaces store the key after a confirmed prompt and skip re-prompting
 * only while the key still matches (same customer, amount, method and
 * same earlier payment) — a different new duplicate prompts again.
 */
export function duplicatePaymentBypassKey(customerId, amount, method, duplicate) {
  if (!duplicate) return '';
  return [String(customerId ?? ''), String(centsOf(amount) ?? ''), String(method ?? ''), String(duplicate.paymentId ?? '')].join('|');
}

/** "just now" / "3 min ago" for the prompt, via the dupguard_* keys. */
export function duplicatePaymentAgoText(elapsedMs, lang = null) {
  const minutes = Math.max(0, Math.floor(Number(elapsedMs || 0) / 60000));
  if (minutes <= 0) return t('dupguard_ago_now', lang);
  return t('dupguard_ago_minutes', lang, { minutes });
}

/**
 * The shared appConfirm options for a detected duplicate. `formatAmount`
 * is injected by the caller (every surface already has formatPKR in
 * scope) so this module stays free of a core.js import. The dialog
 * itself (ui-feedback.js) focuses Cancel by default.
 */
export function buildDuplicatePaymentConfirmOptions(duplicate, formatAmount, lang = null) {
  const format = typeof formatAmount === 'function' ? formatAmount : (value) => String(value ?? '');
  return {
    tone: 'warning',
    title: t('dupguard_title', lang),
    subject: `${format(duplicate?.amount)} · ${duplicate?.method ?? ''}`,
    message: t('dupguard_message', lang, {
      amount: format(duplicate?.amount),
      method: duplicate?.method ?? '',
      month: duplicate?.billMonth ?? '',
      date: duplicate?.date ?? '',
      ago: duplicatePaymentAgoText(duplicate?.elapsedMs, lang)
    }),
    confirmLabel: t('dupguard_record_anyway', lang),
    cancelLabel: t('dupguard_cancel', lang)
  };
}

/**
 * Ask the operator about a detected duplicate through the app's shared
 * themed confirm (window.appConfirm, installed by ui-feedback.js).
 * Resolves true ONLY on an explicit "Record anyway" ('confirm'); every
 * other outcome — Cancel, close, Esc, or no confirm available in this
 * context — resolves false, so a surface that cannot ask does not
 * record. Callers treat false as "operator stopped the duplicate":
 * nothing is recorded.
 */
export function askDuplicatePayment(duplicate, formatAmount) {
  const ask = (typeof window !== 'undefined' && typeof window.appConfirm === 'function')
    ? window.appConfirm(buildDuplicatePaymentConfirmOptions(duplicate, formatAmount))
    : Promise.resolve(false);
  return Promise.resolve(ask).then(result => result === 'confirm' || result === true);
}

