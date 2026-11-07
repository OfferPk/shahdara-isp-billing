// Quick Collect receipt share draft (Plan 443): the receipt's share
// text, prepared right after a Quick Collect save so the operator
// reads it first, then sends it or dismisses it — never the other
// way round. Today the success screen only offers a button that
// opens the messaging app straight away with the full receipt text,
// so the operator never sees what is about to go out. This plan adds
// only the missing piece: one visible draft of that same text, with
// Send and Dismiss, on the success screen.
//
// Where the text comes from, so the draft can never drift from what
// Send will send: the caller supplies the text the dispatch already
// builds for this receipt — the ordinary receipt text for a single
// payment, the combined-receipt text for a split collection (both
// legs, both real receipt numbers, one total; a combined number is
// never fabricated). The draft carries the receipt's own figures
// beside the text, and the match check proves them against the
// receipt on the same fixture before the draft is ever shown.
//
// What this module NEVER does, stated plainly:
//   - it never sends anything: Send is the operator's tap, and the
//     wiring routes it through the success screen's existing
//     messaging dispatch, exactly as the existing button does;
//   - it never changes a bill, a payment, a receipt, or a customer
//     record, and it never touches the confirmation draft, the
//     monthly statement draft, or the whole-history share text —
//     those are separate drafts for separate messages, and this
//     draft is the receipt's own share text only;
//   - it never invents a figure: a receipt with no usable number,
//     amount, method, date, or month, or with no text to share,
//     yields no draft at all, never a guessed one;
//   - it never reads storage, the clock, or the page, takes no other
//     module, and never mutates an input.

const RECEIPT_SHARE_DRAFT_DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})$/;
const RECEIPT_SHARE_DRAFT_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const RECEIPT_SHARE_DRAFT_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const RECEIPT_SHARE_DRAFT_HEADING_TEXT = 'Receipt share draft';
export const RECEIPT_SHARE_DRAFT_SEND_TEXT = 'Send on WhatsApp';
export const RECEIPT_SHARE_DRAFT_DISMISS_TEXT = 'Dismiss';
export const RECEIPT_SHARE_DRAFT_NO_RECEIPT_TEXT = 'No receipt to share.';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function isLeapReceiptShareYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

// A missing, boolean or blank figure is not a number, never zero:
// Number(null) is 0 and Number(true) is 1, and both would invent an
// amount out of nothing. The value is in rupees; the result is in
// integer cents.
export function receiptShareDraftFigureCents(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const rupees = Number(value);
  if (!Number.isFinite(rupees)) return null;
  return Math.round(rupees * 100);
}

// The value is already in integer cents (a split total, for example).
function receiptShareDraftCentsDirect(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const cents = Number(value);
  if (!Number.isFinite(cents)) return null;
  return Math.round(cents);
}

export function receiptShareDraftIsStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = RECEIPT_SHARE_DRAFT_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const days = RECEIPT_SHARE_DRAFT_DAYS_IN_MONTH[month - 1] + (month === 2 && isLeapReceiptShareYear(year) ? 1 : 0);
  return day >= 1 && day <= days;
}

export function receiptShareDraftIsStrictMonth(value) {
  return typeof value === 'string' && RECEIPT_SHARE_DRAFT_MONTH_RE.test(value);
}

// Min-0 decimals, grouped like the other live lines: 300000 cents
// reads '3,000', 150050 cents reads '1,500.5'.
export function formatReceiptShareDraftAmount(cents) {
  const safe = receiptShareDraftCentsDirect(cents) ?? 0;
  return (safe / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// The amount behind a receipt, in integer cents: a single payment's
// amount in rupees, or a split collection's combined total (already
// in cents, with the rupee total as fallback).
function receiptShareDraftAmountCents(receipt) {
  const split = receipt?.splitTender;
  if (split && Array.isArray(split.legs)) {
    const direct = receiptShareDraftCentsDirect(split.totalReceivedCents);
    if (direct !== null) return direct;
    return receiptShareDraftFigureCents(split.totalReceived);
  }
  return receiptShareDraftFigureCents(receipt?.amount);
}

// The method behind a receipt: one method, or the split legs' methods
// in leg order, joined the way the image share already joins them.
function receiptShareDraftMethod(receipt) {
  const split = receipt?.splitTender;
  if (split && Array.isArray(split.legs)) {
    return split.legs.map((leg) => text(leg?.method)).filter(Boolean).join(' + ');
  }
  return text(receipt?.method);
}

// The receipt number(s) behind a receipt: one number, or the split
// legs' real numbers in leg order. A split has no single number of
// its own, and none is ever fabricated.
function receiptShareDraftNumbers(receipt) {
  const split = receipt?.splitTender;
  if (split && Array.isArray(split.legs)) {
    return {
      receiptNumber: '',
      receiptNumbers: split.legs.map((leg) => text(leg?.receiptNumber)).filter(Boolean),
    };
  }
  return { receiptNumber: text(receipt?.receiptNumber), receiptNumbers: [] };
}

// The sales tax recorded on the receipt's bill, in integer cents —
// null when the receipt carries no tax. A missing, boolean or blank
// figure is not a number, never zero.
function receiptShareDraftSalesTaxCents(receipt) {
  const cents = receipt?.salesTaxCents;
  if (cents === null || cents === undefined) return null;
  if (typeof cents === 'boolean') return null;
  if (typeof cents === 'string' && cents.trim() === '') return null;
  const value = Number(cents);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

// Prepare one share draft from the saved payment and its receipt, plus
// the share text the dispatch already builds for it. Returns null
// when there is nothing safe to share — no usable receipt number,
// amount, method, date, or month, no customer name, or no text —
// never a guessed figure.
export function receiptShareDraftFor(receipt, shareText) {
  if (!receipt || typeof receipt !== 'object') return null;
  const draftText = text(shareText);
  if (draftText === '') return null;
  const numbers = receiptShareDraftNumbers(receipt);
  if (numbers.receiptNumber === '' && numbers.receiptNumbers.length === 0) return null;
  const amountCents = receiptShareDraftAmountCents(receipt);
  if (amountCents === null) return null;
  const method = receiptShareDraftMethod(receipt);
  if (method === '') return null;
  const split = receipt?.splitTender;
  const date = text(split?.date) || text(receipt?.date);
  if (!receiptShareDraftIsStrictDate(date)) return null;
  const month = text(split?.month) || text(receipt?.month);
  if (!receiptShareDraftIsStrictMonth(month)) return null;
  const customerName = text(receipt?.customerName);
  if (customerName === '') return null;
  const customerNumber = receipt?.customerNumber === null || receipt?.customerNumber === undefined
    ? ''
    : String(receipt.customerNumber).trim();
  return {
    receiptNumber: numbers.receiptNumber,
    receiptNumbers: numbers.receiptNumbers,
    customerName,
    customerNumber,
    amountCents,
    method,
    date,
    month,
    phone: text(receipt?.phone),
    // Polish #11: the sales tax figure, proved against the receipt by
    // the match check below — a draft can never show a tax the receipt
    // does not carry. Null when the receipt carries no tax.
    salesTaxCents: receiptShareDraftSalesTaxCents(receipt),
    text: draftText,
  };
}

// The acceptance, stated as a function: the draft's figures match the
// saved payment and its receipt on the same fixture. Any tampered
// figure — amount, method, date, month, name, or receipt number —
// fails the match.
export function receiptShareDraftMatchesReceipt(draft, receipt) {
  if (!draft || typeof draft !== 'object') return false;
  if (text(draft.text) === '') return false;
  const expected = receiptShareDraftFor(receipt, draft.text);
  if (!expected) return false;
  if (draft.receiptNumber !== expected.receiptNumber) return false;
  if (draft.receiptNumbers.length !== expected.receiptNumbers.length) return false;
  for (let i = 0; i < draft.receiptNumbers.length; i += 1) {
    if (draft.receiptNumbers[i] !== expected.receiptNumbers[i]) return false;
  }
  if (draft.amountCents !== expected.amountCents) return false;
  if (draft.method !== expected.method) return false;
  if (draft.date !== expected.date) return false;
  if (draft.month !== expected.month) return false;
  if (draft.customerName !== expected.customerName) return false;
  if (draft.customerNumber !== expected.customerNumber) return false;
  // Polish #11: the tax figure is part of the match — a draft whose
  // tax disagrees with the receipt's recorded tax never shows. The
  // null-coalescing keeps drafts built before this field existed
  // (no key at all) matching an untaxed receipt.
  if ((draft.salesTaxCents ?? null) !== (expected.salesTaxCents ?? null)) return false;
  return true;
}

export function receiptShareDraftText(draft) {
  return draft && typeof draft === 'object' ? text(draft.text) : '';
}

// One plain line naming the draft: number, amount, method, date.
export function receiptShareDraftLineText(draft) {
  if (!draft || typeof draft !== 'object') return '';
  const numbers = draft.receiptNumber !== ''
    ? draft.receiptNumber
    : (Array.isArray(draft.receiptNumbers) ? draft.receiptNumbers.join(', ') : '');
  if (numbers === '') return '';
  const label = draft.receiptNumber !== '' ? 'Receipt' : 'Receipts';
  const who = draft.customerNumber !== '' ? `${draft.customerName} (#${draft.customerNumber})` : draft.customerName;
  return `${label} ${numbers} · ${who} · PKR ${formatReceiptShareDraftAmount(draft.amountCents)} · ${draft.method} · ${draft.date}`;
}

// The draft as shown: heading, one plain line, the share text exactly
// as it will go out, and Send / Dismiss. The buttons only ask; the
// wiring sends or dismisses, and nothing here posts anything.
export function receiptShareDraftHtml(draft) {
  if (!draft || typeof draft !== 'object') return '';
  const line = receiptShareDraftLineText(draft);
  if (line === '' || text(draft.text) === '') return '';
  return `<div class="rsd-share-draft" role="region" aria-label="${escapeHtml(RECEIPT_SHARE_DRAFT_HEADING_TEXT)}">`
    + `<p class="rsd-share-draft-heading">${escapeHtml(RECEIPT_SHARE_DRAFT_HEADING_TEXT)}</p>`
    + `<p class="rsd-share-draft-line">${escapeHtml(line)}</p>`
    + `<pre class="rsd-share-draft-text">${escapeHtml(draft.text)}</pre>`
    + '<div class="rsd-share-draft-actions">'
    + `<button type="button" class="primary-button" data-rsd-send>${escapeHtml(RECEIPT_SHARE_DRAFT_SEND_TEXT)}</button>`
    + `<button type="button" class="secondary-button" data-rsd-dismiss>${escapeHtml(RECEIPT_SHARE_DRAFT_DISMISS_TEXT)}</button>`
    + '</div></div>';
}
