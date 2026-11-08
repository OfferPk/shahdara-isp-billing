// Plan 351 — Customer profile at-a-glance header strip.
//
// Opening a customer profile shows a long page of fields, so the
// operator must scroll to answer the three questions that matter
// at the counter — what does this customer owe, which package are
// they on, and when did they last pay. This module composes the
// one read-only strip that answers them at the top of the profile:
// current dues, package name and price, last payment date and
// amount, next due date.
//
// The strip is composed from the profile's own figures, supplied
// by the caller, and invents nothing:
//   - dues come from the profile's own outstanding figure;
//   - the package name and price come from the customer's own
//     package record (catalogue label, monthly amount);
//   - the last payment and the next due date come from the
//     profile's own balance figures.
// A customer with no payment yet reads "No payment yet" instead
// of a blank; a missing next due date reads "not recorded"; a
// customer with no package reads "Not set" — the package is a value
// the operator never entered, like the view's Service group
// (Plan 502). Money is integer cents throughout, so no float drift.
// Dates are strict YYYY-MM-DD calendar dates (integer days-in-month
// arithmetic; 2026-02-30 is not a date). Inputs are never mutated,
// and the module never reads storage, the clock, or the network.
//
// The strip edits nothing and adds no new field: it never changes
// any bill, payment, or customer record by itself, and it holds no
// store of its own. It is distinct from the balance enquiry reply
// draft (same four figures, different job: that draft is a message
// the operator sends; this strip is a read-only glance at the top
// of the profile) and from the per-field profile completion count.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validProfileHeaderStripDay(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
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
// is not shown as a last payment — the strip says plainly that
// no payment is recorded yet, rather than printing half a payment.
function normalizeLastPayment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amountCents = toLedgerCents(raw.amount);
  const date = validProfileHeaderStripDay(raw.date);
  if (amountCents === null || amountCents <= 0 || !date) return null;
  return { amountCents, amount: fromCents(amountCents), date };
}

const defaultFormatAmount = (value) => `PKR ${String(value ?? '')}`;

// Build one header strip from the profile's own figures, or null
// when the outstanding figure itself is missing or unusable.
// The caller supplies the figures (dues, package, last payment,
// next due date); this module composes them and invents nothing.
// A missing package label reads "Not set" (Plan 502: the package is
// a never-entered field, like the view's Service group); a missing
// package price is shown without a price, never guessed.
export function buildProfileHeaderStrip({
  customerId,
  customerName,
  outstanding,
  packageLabel,
  packagePrice,
  lastPayment,
  nextDueDate,
} = {}) {
  const duesCents = toLedgerCents(outstanding);
  if (duesCents === null) return null;
  const label = text(packageLabel) || 'Not set';
  const priceCents = toLedgerCents(packagePrice);
  return {
    customerId: text(customerId),
    customerName: text(customerName),
    duesCents,
    dues: fromCents(duesCents),
    packageLabel: label,
    packagePriceCents: priceCents,
    packagePrice: priceCents === null ? null : fromCents(priceCents),
    lastPayment: normalizeLastPayment(lastPayment),
    nextDueDate: validProfileHeaderStripDay(nextDueDate),
  };
}

export function profileHeaderStripText(strip, formatAmount = defaultFormatAmount) {
  if (!strip || typeof strip !== 'object') return 'Profile header strip unavailable.';
  const format = typeof formatAmount === 'function' ? formatAmount : defaultFormatAmount;
  const parts = [];
  parts.push(strip.duesCents === 0 ? 'No amount due.' : `Dues ${format(strip.dues)}.`);
  if (strip.packagePriceCents === null) {
    parts.push(`Package ${strip.packageLabel}.`);
  } else {
    parts.push(`Package ${strip.packageLabel} (${format(strip.packagePrice)}/month).`);
  }
  if (strip.lastPayment) {
    parts.push(`Last payment ${format(strip.lastPayment.amount)} on ${strip.lastPayment.date}.`);
  } else {
    parts.push('No payment yet.');
  }
  if (strip.nextDueDate) {
    parts.push(`Next due ${strip.nextDueDate}.`);
  } else {
    parts.push('Next due date not recorded.');
  }
  return parts.join(' ');
}

export function profileHeaderStripHtml(strip, formatAmount = defaultFormatAmount) {
  if (!strip || typeof strip !== 'object') return '';
  const format = typeof formatAmount === 'function' ? formatAmount : defaultFormatAmount;
  const dues = strip.duesCents === 0
    ? 'No amount due'
    : escapeHtml(format(strip.dues));
  const packageValue = strip.packagePriceCents === null
    ? escapeHtml(strip.packageLabel)
    : `${escapeHtml(strip.packageLabel)} · ${escapeHtml(format(strip.packagePrice))}/month`;
  const lastPayment = strip.lastPayment
    ? `${escapeHtml(format(strip.lastPayment.amount))} · ${escapeHtml(strip.lastPayment.date)}`
    : 'No payment yet';
  const nextDue = strip.nextDueDate ? escapeHtml(strip.nextDueDate) : 'Not recorded';
  return `<section class="profile-header-strip" id="phsStrip" aria-label="Customer at a glance" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: stretch; margin: 8px 0 12px; padding: 10px 12px; border: 1px solid #d8dee9; border-radius: 8px; background: #f7f9fc;"><div class="phs-stat"><span class="phs-label" style="display: block; font-size: 11px; color: #5b6472;">Dues</span><strong class="phs-value" style="font-size: 15px;">${dues}</strong></div><div class="phs-stat"><span class="phs-label" style="display: block; font-size: 11px; color: #5b6472;">Package</span><strong class="phs-value" style="font-size: 15px;">${packageValue}</strong></div><div class="phs-stat"><span class="phs-label" style="display: block; font-size: 11px; color: #5b6472;">Last payment</span><strong class="phs-value" style="font-size: 15px;">${lastPayment}</strong></div><div class="phs-stat"><span class="phs-label" style="display: block; font-size: 11px; color: #5b6472;">Next due</span><strong class="phs-value" style="font-size: 15px;">${nextDue}</strong></div></section>`;
}
