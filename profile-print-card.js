// Plan 362 — Customer profile print card for the shop file.
//
// The shop keeps paper files, but the profile can only be read on
// screen, so the operator copies details by hand and the paper copy
// drifts from the app. This module is the missing piece: one
// single-page printable card composed from the profile's own figures
// (name, known-as name, mohalla, package, current dues, last
// payment, contact number, handling note), printed from the profile
// with a print date. It is a printout only: it changes no bill, no
// payment, and no customer record, and it holds no store of its own.
//
// The card is composed from figures the caller supplies — the same
// figures the profile already shows — and invents nothing:
//   - dues, package name and price, and the last payment come from
//     the profile's own balance figures;
//   - the known-as name comes from the profile's own known-as
//     derivation, and the handling note from the profile's own
//     handling-note record.
// A figure the record does not carry reads "Not recorded" (or the
// plain-words equivalent for that row) instead of a blank or a
// guess. Money is integer cents throughout, so no float drift.
// Dates are strict YYYY-MM-DD calendar dates. The print date is
// supplied by the caller and is never invented here: a card with
// no usable print date is refused (null), because a shop file
// without a print date cannot be trusted. Inputs are never
// mutated, and the module never reads storage, the clock, or the
// network.
//
// What this module is NOT, stated plainly:
//   - It is not the print template register, which records which
//     template version a printout uses and never creates a
//     printout itself.
//   - It is not the print queue log, which logs print jobs and
//     never prints anything by itself.
//   - It is not the QR khata card, which is a wallet card built
//     around a QR code; this card carries the full profile
//     figures and no QR code.
//   - It is not a receipt: a receipt records a payment, while
//     this card records no payment and carries no receipt number.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validProfilePrintCardDay(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  const match = DATE_RE.exec(datePart);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day > maxDay) return null;
  return datePart;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// A ledger figure in integer cents, or null when missing or
// unusable. Zero is a real figure; a blank, a boolean, a
// non-finite value, or a negative amount is not a figure at all.
function toLedgerCents(amount) {
  if (typeof amount === 'boolean' || amount === null || amount === undefined) return null;
  if (typeof amount === 'string' && amount.trim() === '') return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function fromCents(cents) {
  return cents / 100;
}

// The last payment, or null: both a usable positive amount and a
// strict date are required. A payment with no amount or no date
// is not shown as a last payment — the card says plainly that
// no payment is recorded yet, rather than printing half a payment.
function normalizeLastPayment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amountCents = toLedgerCents(raw.amount);
  const date = validProfilePrintCardDay(raw.date);
  if (amountCents === null || amountCents <= 0 || !date) return null;
  return { amountCents, amount: fromCents(amountCents), date };
}

const defaultFormatAmount = (value) => `PKR ${String(value ?? '')}`;

// Build one single-page printable profile card as a standalone
// printable page, or null when the print date is missing or not a
// strict date. The caller supplies every figure from the profile
// itself (name, known-as name, mohalla, package, current dues,
// last payment, contact number, handling note, print date) plus
// the money formatter; this module composes them and invents
// nothing. All money is PKR, never converted.
export function buildProfilePrintCardHtml(input = {}, formatAmount = defaultFormatAmount) {
  const format = typeof formatAmount === 'function' ? formatAmount : defaultFormatAmount;
  const printDate = validProfilePrintCardDay(input.printDate);
  if (!printDate) return null;
  const businessName = text(input.businessName) || 'Shahdara ISP';
  const name = text(input.customerName) || 'Not recorded';
  const number = text(input.customerNumber);
  const knownAs = text(input.knownAs) || 'Not recorded';
  const mohalla = text(input.mohalla) || 'Not recorded';
  const packageLabel = text(input.packageLabel);
  const packagePriceCents = toLedgerCents(input.packagePrice);
  const packageLine = !packageLabel
    ? 'No package recorded'
    : packagePriceCents === null
      ? packageLabel
      : `${packageLabel} · ${format(fromCents(packagePriceCents))}/month`;
  const duesCents = toLedgerCents(input.outstanding);
  const duesLine = duesCents === null
    ? 'Not recorded'
    : duesCents === 0
      ? 'No amount due'
      : format(fromCents(duesCents));
  const lastPayment = normalizeLastPayment(input.lastPayment);
  const lastPaymentLine = lastPayment
    ? `${format(lastPayment.amount)} · ${lastPayment.date}`
    : 'No payment yet';
  const contactNumber = text(input.contactNumber) || 'Not recorded';
  const handlingNote = text(input.handlingNote) || 'No handling note recorded';
  const rows = [
    ['Known as', knownAs],
    ['Mohalla', mohalla],
    ['Package', packageLine],
    ['Current dues', duesLine],
    ['Last payment', lastPaymentLine],
    ['Contact number', contactNumber],
    ['Handling note', handlingNote],
  ];
  const rowsHtml = rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Profile card — ${escapeHtml(name)}</title>\n<style>body{font-family:system-ui,sans-serif;color:#111;margin:0;padding:8px}@page{size:A4;margin:12mm}.ppc-card{max-width:170mm;margin:0 auto;border:2px solid #111;border-radius:10px;padding:16px}.ppc-card h1{font-size:20px;margin:0 0 2px}.ppc-card .ppc-sub{font-size:12px;color:#444;margin:0 0 12px}.ppc-card h2{font-size:17px;margin:0 0 10px}.ppc-card table{width:100%;border-collapse:collapse;font-size:14px}.ppc-card th{text-align:left;padding:6px 8px 6px 0;color:#444;font-weight:600;width:34%;vertical-align:top}.ppc-card td{padding:6px 0;vertical-align:top}.ppc-card .ppc-foot{font-size:11px;color:#444;margin-top:14px;border-top:1px solid #111;padding-top:8px}</style></head><body>\n<div class="ppc-card"><h1>${escapeHtml(businessName)}</h1><p class="ppc-sub">Customer profile card</p>\n<h2>${escapeHtml(name)}${number ? ` <span>#${escapeHtml(number)}</span>` : ''}</h2>\n<table>${rowsHtml}</table>\n<p class="ppc-foot">Printed on ${escapeHtml(printDate)} · Shop file copy — figures as recorded on the print date.</p>\n</div>\n</body></html>`;
}
