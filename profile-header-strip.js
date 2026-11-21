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

// Plan 591 (D1(a)/D5(a)/D6(a)) — the translated strings reach this pure
// module as a labels object passed by app.js (the freshness-stamp
// precedent, app.js:8418): the module cannot pull t() in directly
// (plan351 :211 bans module imports here), so app.js passes t('phs_*')
// values and the module defaults to the English strings when no labels
// are passed — which is why plan351/plan502 tests calling with no
// labels arg keep passing unchanged. 'Not set' is a DATA value (buildProfileHeaderStrip
// :119, Plan 502); the render maps that exact sentinel to the
// translated value via labels.notSet (t('prof_not_set')), never by
// re-wording the data. The text sentences get their own keys because
// Urdu sentences end with '۔', not '.' (trap T8).
const DEFAULT_PHS_LABELS = {
  // Plan 614: the strip figure is the ALL-MONTHS total (all bills + manual
  // baqaya), so the label says so — 'Total dues', not the bare 'Dues' that
  // reads like the current month's net due beside it. Fallbacks aligned.
  dues: 'Total dues',
  package: 'Package',
  lastPayment: 'Last payment',
  nextDue: 'Next due',
  noAmountDue: 'No total dues',
  noPaymentYet: 'No payment yet',
  notRecorded: 'Not recorded',
  noAmountDueText: 'No total dues.',
  noPaymentYetText: 'No payment yet.',
  nextDueNotRecorded: 'Next due date not recorded.',
  unavailable: 'Profile header strip unavailable.',
  aria: 'Customer at a glance',
  perMonth: '/month',
  notSet: 'Not set',
};

function phsLabels(labels) {
  if (!labels || typeof labels !== 'object') return { ...DEFAULT_PHS_LABELS };
  const out = {};
  for (const key of Object.keys(DEFAULT_PHS_LABELS)) {
    out[key] = typeof labels[key] === 'string' && labels[key] !== '' ? labels[key] : DEFAULT_PHS_LABELS[key];
  }
  return out;
}

export function profileHeaderStripText(strip, formatAmount = defaultFormatAmount, labels = {}) {
  const L = phsLabels(labels);
  if (!strip || typeof strip !== 'object') return L.unavailable;
  const format = typeof formatAmount === 'function' ? formatAmount : defaultFormatAmount;
  const packageLabel = strip.packageLabel === 'Not set' ? L.notSet : strip.packageLabel;
  // Plan 591 (D6(a)/T8) — the populated sentences end with the same
  // terminator as the translated fallback sentences: '.' in English,
  // '۔' in Urdu. The terminator is derived from the labels object, so
  // no extra key is needed; the fallback sentences carry their own '۔'.
  const end = L.noAmountDueText.endsWith('۔') ? '۔' : '.';
  const parts = [];
  parts.push(strip.duesCents === 0 ? L.noAmountDueText : `${L.dues} ${format(strip.dues)}${end}`);
  if (strip.packagePriceCents === null) {
    parts.push(`${L.package} ${packageLabel}${end}`);
  } else {
    parts.push(`${L.package} ${packageLabel} (${format(strip.packagePrice)}${L.perMonth})${end}`);
  }
  if (strip.lastPayment) {
    parts.push(`${L.lastPayment} ${format(strip.lastPayment.amount)} on ${strip.lastPayment.date}${end}`);
  } else {
    parts.push(L.noPaymentYetText);
  }
  if (strip.nextDueDate) {
    parts.push(`${L.nextDue} ${strip.nextDueDate}${end}`);
  } else {
    parts.push(L.nextDueNotRecorded);
  }
  return parts.join(' ');
}

export function profileHeaderStripHtml(strip, formatAmount = defaultFormatAmount, labels = {}) {
  if (!strip || typeof strip !== 'object') return '';
  const L = phsLabels(labels);
  const format = typeof formatAmount === 'function' ? formatAmount : defaultFormatAmount;
  const packageLabel = strip.packageLabel === 'Not set' ? L.notSet : strip.packageLabel;
  const dues = strip.duesCents === 0
    ? L.noAmountDue
    : escapeHtml(format(strip.dues));
  const packageValue = strip.packagePriceCents === null
    ? escapeHtml(packageLabel)
    : `${escapeHtml(packageLabel)} · ${escapeHtml(format(strip.packagePrice))}${escapeHtml(L.perMonth)}`;
  const lastPayment = strip.lastPayment
    ? `${escapeHtml(format(strip.lastPayment.amount))} · ${escapeHtml(strip.lastPayment.date)}`
    : L.noPaymentYet;
  const nextDue = strip.nextDueDate ? escapeHtml(strip.nextDueDate) : L.notRecorded;
  // Profile View Polish — the strip is a 2-column grid now (Dues |
  // Package on row 1, Last payment | Next due on row 2), and a zero
  // balance reads soft emerald, not alarm red: the dues pill takes the
  // phs-pill-dues-zero modifier while its text stays 'No amount due'.
  // The base pill colours stay literal hex (Polish B (14) test reads
  // them by regex); only the zero modifier uses tokens. Red for every
  // dues > 0 — there is no amber band anywhere today.
  // Plan 591 — the section/label/value styles moved into
  // .profile-header-strip / .phs-label / .phs-value (styles.css); the
  // template carries no inline style attribute and no hex literal.
  return `<section class="profile-header-strip" id="phsStrip" aria-label="${escapeHtml(L.aria)}"><div class="phs-stat phs-pill phs-pill-dues${strip.duesCents === 0 ? ' phs-pill-dues-zero' : ''}"><span class="phs-label">${L.dues}</span><strong class="phs-value">${dues}</strong></div><div class="phs-stat phs-pill phs-pill-package"><span class="phs-label">${L.package}</span><strong class="phs-value">${packageValue}</strong></div><div class="phs-stat phs-pill phs-pill-last-payment"><span class="phs-label">${L.lastPayment}</span><strong class="phs-value">${lastPayment}</strong></div><div class="phs-stat phs-pill phs-pill-next-due"><span class="phs-label">${L.nextDue}</span><strong class="phs-value">${nextDue}</strong></div></section>`;
}
