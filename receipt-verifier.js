/**
 * receipt-verifier.js — SISP-83: Tamper-Evident Receipt Verification
 * Code (VER: XXXX-XX) & Lookup.
 *
 * Every printed/shared payment receipt (A4 HTML, 80mm + 58mm thermal
 * HTML, and the SISP-6 PNG image) carries a short verification code:
 *
 *     VER: AB3F-9K
 *
 * The code is a deterministic 6-character checksum (FNV-1a 32-bit over
 * a canonical string, rendered in Crockford base32 — no I/L/O/U, so a
 * hand-typed code is never ambiguous) computed from the receipt's own
 * facts: receipt number + customer number + amount paid (in cents) +
 * payment date. It is computed AT RENDER TIME from the saved ledger —
 * never stored on the payment — so the same saved payment produces the
 * same code on every device, forever, with no random salt and no
 * secret. Re-printing an old receipt re-derives the identical code.
 *
 * HONEST SCOPE: this is tamper-EVIDENT, not cryptographic proof. The
 * algorithm is public and offline by design (the app has no server and
 * no shared secret), so it cannot stop someone who re-implements it —
 * it catches the realistic fraud/accident cases: a receipt whose amount
 * or date was edited after printing no longer matches the code, and a
 * code typed into the in-app lookup resolves against THIS device's
 * ledger, which shows the true amount/date and the SISP-34 void state.
 * A receipt from another shop's ledger matches nothing here.
 *
 * Lookup workflow (setupReceiptVerifyModal): the operator types the
 * VER code (or the full receipt number) from the paper receipt; the
 * app recomputes the code of every saved payment until one matches,
 * then reports:
 *   - 'verified'  — the code matches a saved, non-voided payment; the
 *                   result carries the LEDGER's amount/date, so an
 *                   edited paper amount is visible at a glance;
 *   - 'void'      — the code matches, but the payment was voided
 *                   (SISP-34): the receipt is not valid;
 *   - 'not_found' — no saved payment produces this code.
 *
 * receipt.js imports the pure code functions from here (they are
 * attached to the buildPaymentReceipt snapshot as `verificationCode`),
 * so this module must NOT import receipt.js — the receipt-number
 * fallback for payments that carry none is injected by callers as
 * `deriveReceiptNumber` (app.js passes generateReceiptNumber), which
 * keeps the module cycle-free exactly like payment-void-audit.js.
 */
import { isVoidedPayment } from './payment-void-audit.js';
import { t } from './nav-language.js';

/** Crockford base32: digits + letters without I, L, O or U. */
export const VERIFICATION_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const VERIFICATION_CODE_LENGTH = 6;

const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

/** Strict YYYY-MM-DD real-date check (mirrors receipt.js validStoredDate). */
function validDate(value) {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? '' : date;
}

/** Amount → integer cents string ('' when the amount is not a number). */
function amountCentsString(value) {
  if (value === null || value === undefined || value === '') return '';
  const amount = Number(value);
  return Number.isFinite(amount) ? String(Math.round(amount * 100)) : '';
}

/** The receipt.js customerId rule, shared so stamp and lookup agree. */
function customerIdString(customerOrId) {
  const num = customerOrId && typeof customerOrId === 'object' ? customerOrId.customerNumber : customerOrId;
  return Number.isSafeInteger(num) && num > 0 ? String(num) : '';
}

/** FNV-1a 32-bit — tiny, stable across engines, no dependencies. */
function fnv1a32(str, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Canonical checksum inputs for a receipt. Every producer (the receipt
 * snapshot, the PNG model, the lookup) funnels through here so the
 * same payment always yields the same code.
 */
export function receiptVerificationInputs({ receiptId, customerId, amountPaid, date } = {}) {
  return {
    receiptId: text(receiptId),
    customerId: text(customerId),
    amountCents: amountCentsString(amountPaid),
    date: validDate(date)
  };
}

/**
 * The deterministic 6-character verification code for a receipt,
 * formatted XXXX-XX. Pure: same inputs → same code on any device.
 */
export function receiptVerificationCode(inputs = {}) {
  const c = receiptVerificationInputs(inputs);
  const canonical = `SISP83-RECEIPT|${c.receiptId}|${c.customerId}|${c.amountCents}|${c.date}`;
  const h1 = fnv1a32(canonical);
  const h2 = fnv1a32(`${canonical}#2`);
  let raw = '';
  for (let i = 0; i < 3; i++) raw += VERIFICATION_ALPHABET[(h1 >>> (i * 5)) & 31];
  for (let i = 0; i < 3; i++) raw += VERIFICATION_ALPHABET[(h2 >>> (i * 5)) & 31];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * Normalizes an operator-typed code: uppercase, separators stripped,
 * confusables folded (O→0, I/L→1, per Crockford decoding). Returns
 * the 6 significant characters, or '' when the input cannot be a code.
 */
export function normalizeVerificationCode(value) {
  const folded = text(value).toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (folded.length !== VERIFICATION_CODE_LENGTH) return '';
  return [...folded].every((ch) => VERIFICATION_ALPHABET.includes(ch)) ? folded : '';
}

/** 'ab3f9k' / 'AB3F9K' / 'ab3f-9k' → 'AB3F-9K'; '' when not a code. */
export function formatVerificationCode(value) {
  const raw = normalizeVerificationCode(value);
  return raw ? `${raw.slice(0, 4)}-${raw.slice(4)}` : '';
}

/** The on-receipt stamp: 'VER: AB3F-9K' ('' when there is no code). */
export function verificationStampText(code) {
  const formatted = formatVerificationCode(code);
  return formatted ? `VER: ${formatted}` : '';
}

/** True when `code` is exactly the code these receipt inputs produce. */
export function verifyReceiptCode(code, inputs = {}) {
  const given = normalizeVerificationCode(code);
  if (!given) return false;
  return given === normalizeVerificationCode(receiptVerificationCode(inputs));
}

/** Code for a buildPaymentReceipt() snapshot ('' for non-receipts). */
export function receiptCodeForReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return '';
  const receiptId = text(receipt.receiptNumber) || text(receipt.permanentReceiptNumber);
  if (!receiptId) return '';
  return receiptVerificationCode({
    receiptId,
    customerId: receipt.customerId,
    amountPaid: receipt.paidAmount,
    date: receipt.paymentDate
  });
}

/**
 * The permanent receipt reference of a saved payment: the stored
 * receiptNumber / permanentReceiptNumber when present, else the
 * caller's deterministic derivation (generateReceiptNumber — the same
 * fallback buildPaymentReceipt uses, so stamp and lookup agree).
 */
export function receiptRefForPayment(customer, bill, payment, deriveReceiptNumber) {
  const stored = text(payment?.receiptNumber) || text(payment?.permanentReceiptNumber);
  if (stored) return stored;
  if (typeof deriveReceiptNumber === 'function') {
    try {
      return text(deriveReceiptNumber({
        customerNumber: customer?.customerNumber,
        paymentDate: validDate(payment?.date),
        paymentId: payment?.id,
        billMonth: bill?.month
      }));
    } catch {
      return '';
    }
  }
  return '';
}

/** Code for one saved ledger payment ('' when it has no receipt ref). */
export function receiptCodeForPayment(customer, bill, payment, { deriveReceiptNumber } = {}) {
  const receiptId = receiptRefForPayment(customer, bill, payment, deriveReceiptNumber);
  if (!receiptId) return '';
  return receiptVerificationCode({
    receiptId,
    customerId: customerIdString(customer),
    amountPaid: payment?.amount,
    date: payment?.date
  });
}

/**
 * Resolves an operator-typed VER code OR full receipt number against
 * the saved ledger. Pure and read-only. Returns one of:
 *   { status: 'verified', ... } — matches a saved, non-voided payment
 *   { status: 'void', ... }     — matches, but the payment is voided
 *   { status: 'not_found' }      — nothing in this ledger matches
 *   { status: 'invalid' }        — empty query
 * A match carries the LEDGER's facts (customer, amount, date, method,
 * bill month, void reason) — never the paper's claims.
 */
export function lookupReceiptVerification(customers, query, { deriveReceiptNumber } = {}) {
  const raw = text(query);
  if (!raw) return { status: 'invalid', code: '', receiptRef: '' };
  const queryCode = normalizeVerificationCode(raw);
  const queryRef = raw.toUpperCase();
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of Array.isArray(bill.payments) ? bill.payments : []) {
        if (!payment || typeof payment !== 'object') continue;
        const receiptRef = receiptRefForPayment(customer, bill, payment, deriveReceiptNumber);
        if (!receiptRef) continue;
        const code = receiptVerificationCode({
          receiptId: receiptRef,
          customerId: customerIdString(customer),
          amountPaid: payment.amount,
          date: payment.date
        });
        const codeMatch = !!queryCode && queryCode === normalizeVerificationCode(code);
        const refMatch = queryRef === receiptRef.toUpperCase();
        if (!codeMatch && !refMatch) continue;
        const voided = isVoidedPayment(payment);
        const amount = Number(payment.amount);
        return {
          status: voided ? 'void' : 'verified',
          matchedBy: codeMatch ? 'code' : 'receipt',
          code,
          receiptRef,
          customerId: customer.id ?? null,
          customerNumber: customerIdString(customer),
          customerName: text(customer.name),
          billMonth: text(bill.month),
          paymentId: payment.id ?? null,
          paymentDate: validDate(payment.date),
          amountPaid: Number.isFinite(amount) ? amount : null,
          method: text(payment.method),
          voided,
          voidReason: voided ? text(payment.voidReason) : ''
        };
      }
    }
  }
  return { status: 'not_found', code: queryCode ? formatVerificationCode(queryCode) : '', receiptRef: '' };
}

// ---------------------------------------------------------------------
// Browser glue: the "Verify Receipt Code" dialog (markup in index.html,
// dialog surface from the shared .billing-modal rule → var(--modal-
// surface) in both themes). Follows the setupQrScannerModal pattern:
// thin DOM wiring over the pure lookup above; idempotent open/close.
// ---------------------------------------------------------------------

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const formatPkr = (value) => {
  const num = Number(value);
  return `PKR ${Number.isFinite(num) ? num.toLocaleString() : 0}`;
};

export function setupReceiptVerifyModal(getState, { onToast, deriveReceiptNumber } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('receiptVerifyModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const form = $('receiptVerifyForm');
  const input = $('receiptVerifyInput');
  const resultEl = $('receiptVerifyResult');
  const closeBtn = $('receiptVerifyCloseBtn');

  const toast = (msg, opts) => {
    if (typeof onToast === 'function') onToast(msg, opts);
  };

  const getCustomers = () => {
    try {
      const state = typeof getState === 'function' ? getState() : null;
      return Array.isArray(state?.customers) ? state.customers : [];
    } catch {
      return [];
    }
  };

  const renderResult = (result) => {
    if (!resultEl) return;
    if (!result) {
      resultEl.hidden = true;
      resultEl.innerHTML = '';
      resultEl.className = 'receipt-verify-result';
      return;
    }
    const lines = [];
    if (result.status === 'verified') lines.push(`<p class="receipt-verify-headline">${escapeHtml(t('rverify_genuine'))}</p>`);
    else if (result.status === 'void') lines.push(`<p class="receipt-verify-headline">${escapeHtml(t('rverify_void'))}</p>`);
    else if (result.status === 'not_found') lines.push(`<p class="receipt-verify-headline">${escapeHtml(t('rverify_not_found'))}</p>`);
    else lines.push(`<p class="receipt-verify-headline">${escapeHtml(t('rverify_invalid'))}</p>`);
    if (result.status === 'verified' || result.status === 'void') {
      const who = result.customerName
        ? `${escapeHtml(result.customerName)}${result.customerNumber ? ` (#${escapeHtml(result.customerNumber)})` : ''}`
        : '—';
      lines.push(`<dl class="receipt-verify-facts">`
        + `<div><dt>${escapeHtml(t('rverify_customer'))}</dt><dd>${who}</dd></div>`
        + `<div><dt>${escapeHtml(t('rverify_amount'))}</dt><dd>${escapeHtml(result.amountPaid === null ? '—' : formatPkr(result.amountPaid))}</dd></div>`
        + `<div><dt>${escapeHtml(t('rverify_date'))}</dt><dd>${escapeHtml(result.paymentDate || '—')}</dd></div>`
        + `<div><dt>${escapeHtml(t('rverify_receipt_no'))}</dt><dd>${escapeHtml(result.receiptRef)}</dd></div>`
        + `<div><dt>${escapeHtml(t('rverify_code_label'))}</dt><dd>${escapeHtml(verificationStampText(result.code))}</dd></div>`
        + (result.voidReason ? `<div><dt>${escapeHtml(t('rverify_void_reason'))}</dt><dd>${escapeHtml(result.voidReason)}</dd></div>` : '')
        + `</dl>`);
    }
    resultEl.className = `receipt-verify-result receipt-verify-result--${result.status}`;
    resultEl.innerHTML = lines.join('');
    resultEl.hidden = false;
  };

  const runLookup = () => {
    const result = lookupReceiptVerification(getCustomers(), input?.value ?? '', { deriveReceiptNumber });
    renderResult(result);
    return result;
  };

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    runLookup();
  });
  closeBtn?.addEventListener('click', () => {
    if (typeof dialog.close === 'function') dialog.close();
  });
  dialog.addEventListener('close', () => renderResult(null));

  return {
    open() {
      renderResult(null);
      if (input) input.value = '';
      if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
      if (input && typeof input.focus === 'function') input.focus();
    },
    close() {
      if (typeof dialog.close === 'function') dialog.close();
    },
    // Exposed for tests / other surfaces: run the lookup for a query
    // string without simulating the form.
    verify(query) {
      if (input) input.value = String(query ?? '');
      return runLookup();
    },
    toast
  };
}
