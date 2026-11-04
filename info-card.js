// Plan 74 (Plan 1-100) — Package and service info card on request
// (customer asked, operator sends).
//
// A customer who asks "mera package kya hai, aur bill kab due
// hai?" gets a different answer depending on who replies, and
// the answer rarely includes the package price and expiry
// together. This module is the same-shaped answer every time:
// a bilingual info card draft composed from the existing
// profile — current package and monthly price (Plan 34 price
// history), billing cycle and next due date (Plan 36),
// connection status, expiry date, and the support contact.
//
// The fences, stated plainly:
//   - Drafting or sending never changes any package, billing,
//     or lifecycle record. The module holds no package, bill,
//     payment, or lifecycle field of its own: the figures it
//     prints are caller-supplied, carried verbatim, and never
//     written back anywhere. Sending is by the operator through
//     the existing WhatsApp route only; nothing here sends
//     anything on its own, and every send is logged.
//   - A customer mid-package-change shows the CURRENT package
//     with the change noted, never the future package as
//     current: the caller supplies the kept Plan 46 preview, and
//     this module prints it only as a "change noted" line.
//   - Money is integer cents throughout, so no float drift. A
//     missing package or a missing/unusable monthly price
//     refuses the whole card — never zero-filled, never
//     guessed. A missing cycle, due date, status, expiry, or
//     support contact is said plainly ("not recorded"), never
//     invented.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30
//     is not a date). Inputs are never mutated, and the module
//     never reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const INFO_CARD_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

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

export function normalizeInfoCardVariant(value) {
  const raw = text(value).toLowerCase();
  return raw === INFO_CARD_VARIANTS.URDU ? INFO_CARD_VARIANTS.URDU : INFO_CARD_VARIANTS.ROMAN;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validInfoCardDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  const match = DATE_RE.exec(datePart);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

// A due day is an integer day-of-month, 1-31, or null — never
// silently clamped or rounded (Plan 36 rule).
export function normalizeInfoCardDueDay(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= 1 && value <= 31 ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value.trim());
    if (Number.isInteger(num) && num >= 1 && num <= 31) return num;
  }
  return null;
}

// The kept Plan 46 preview, reduced to the note the card may
// print: only a proposed package that differs from the current
// one counts as a pending change. Anything else is no note.
function normalizePendingChange(raw, currentPackage) {
  if (!raw || typeof raw !== 'object') return null;
  const proposed = text(raw.proposedPackage);
  if (!proposed || proposed === currentPackage) return null;
  return {
    proposedPackage: proposed,
    effectiveDate: validInfoCardDate(raw.effectiveDate),
    billMonth: text(raw.billMonth),
    estimatedNextBill: (() => {
      const cents = toLedgerCents(raw.estimatedNextBill);
      return cents === null ? null : fromCents(cents);
    })(),
  };
}

function formatAmount(value) {
  return value === null || value === undefined ? null : `Rs. ${value}`;
}

function buildInfoCardText(card) {
  const name = card.customerName || card.customerId;
  const price = formatAmount(card.monthlyPrice);
  const cycle = card.cycleDueDay === null
    ? 'not recorded'
    : `every month, due on day ${card.cycleDueDay}${card.cycleIsDefault ? ' (default)' : ''}`;
  const due = card.nextDueDate || 'not recorded';
  const status = card.connectionStatus || 'not recorded';
  const expiry = card.expiryDate || 'not recorded';
  const support = card.supportContact || 'not recorded';
  const pending = card.pendingChange
    ? `Package change noted: ${card.pendingChange.proposedPackage}${card.pendingChange.effectiveDate ? ` from ${card.pendingChange.effectiveDate}` : ''} — your current package above stays in force until that change is applied.`
    : null;
  if (card.variant === INFO_CARD_VARIANTS.URDU) {
    const lines = [
      `السلام علیکم ${name}،`,
      `آپ کا موجودہ پیکج: ${card.package}`,
      `ماہانہ قیمت: ${price}`,
      `بلنگ سائیکل: ${cycle}`,
      `اگلی مقررہ تاریخ: ${due}`,
      `کنکشن کی حالت: ${status}`,
      `پیکج کی میعاد: ${expiry}`,
      `رابطہ: ${support}`,
    ];
    if (pending) lines.push(`نوٹ: پیکج تبدیلی درج ہے: ${card.pendingChange.proposedPackage} — موجودہ پیکج ہی برقرار ہے جب تک تبدیلی لاگو نہ ہو۔`);
    lines.push('شکریہ — شاہدرہ فائبر نیٹ');
    return lines.join('\n');
  }
  const lines = [
    `Assalam-o-Alaikum ${name},`,
    `Aap ka current package: ${card.package}`,
    `Monthly price: ${price}`,
    `Billing cycle: ${cycle}`,
    `Next due date: ${due}`,
    `Connection status: ${status}`,
    `Package expiry: ${expiry}`,
    `Support contact: ${support}`,
  ];
  if (pending) lines.push(pending);
  lines.push('Shukriya — Shahdara Fiber Net');
  return lines.join('\n');
}

export function buildInfoCard({
  customerId,
  customerName,
  package: packageName,
  monthlyPrice,
  cycleDueDay,
  cycleIsDefault,
  nextDueDate,
  connectionStatus,
  expiryDate,
  supportContact,
  pendingChange,
  variant,
} = {}) {
  const id = text(customerId);
  const pkg = text(packageName);
  if (!id || !pkg) return null;
  const priceCents = toLedgerCents(monthlyPrice);
  if (priceCents === null) return null;
  const dueDay = normalizeInfoCardDueDay(cycleDueDay);
  const card = {
    customerId: id,
    customerName: text(customerName),
    package: pkg,
    monthlyPriceCents: priceCents,
    monthlyPrice: fromCents(priceCents),
    cycleDueDay: dueDay,
    cycleIsDefault: dueDay === null ? false : Boolean(cycleIsDefault),
    nextDueDate: validInfoCardDate(nextDueDate),
    connectionStatus: text(connectionStatus),
    expiryDate: validInfoCardDate(expiryDate),
    supportContact: text(supportContact),
    pendingChange: normalizePendingChange(pendingChange, pkg),
    variant: normalizeInfoCardVariant(variant),
  };
  card.text = buildInfoCardText(card);
  return card;
}

export function infoCardSummaryText(card) {
  if (!card) return 'Info card unavailable — the package or monthly price is missing or unusable.';
  const pending = card.pendingChange
    ? ` Package change noted: ${card.pendingChange.proposedPackage} (current package stays in force until applied).`
    : '';
  const due = card.nextDueDate ? ` Next due date ${card.nextDueDate}.` : '';
  return `${card.package} — ${formatAmount(card.monthlyPrice)} / month.${due}${pending}`;
}

// Append a send to the log (customer, time, channel, variant),
// returning a new list. Entries without a customer id or a send
// time are ignored: a logged send always carries a real send
// time. The log never touches a package, bill, payment, or
// lifecycle record.
export function logInfoCardSent(log, { customerId, sentAt, channel, variant } = {}) {
  const list = Array.isArray(log) ? [...log] : [];
  const customer = text(customerId);
  const time = text(sentAt);
  if (!customer || !time) return list;
  list.push({
    customerId: customer,
    sentAt: time,
    channel: text(channel) || 'whatsapp',
    variant: normalizeInfoCardVariant(variant),
  });
  return list;
}

export function findInfoCardSends(log, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(log)) return [];
  return log.filter((entry) => text(entry?.customerId) === id);
}

export function infoCardSentText(sends) {
  const list = Array.isArray(sends) ? sends : [];
  if (list.length === 0) return 'Info card not sent yet.';
  const first = list[0];
  const datePart = text(first?.sentAt).slice(0, 10);
  const shown = validInfoCardDate(datePart) || datePart;
  if (list.length === 1) return `Info card sent on ${shown}.`;
  return `Info card sent on ${shown} and ${list.length - 1} more time${list.length - 1 === 1 ? '' : 's'} — re-send anytime from here.`;
}

export function infoCardHtml(card, { draftText = '', sends = [] } = {}) {
  if (!card) return '<p class="empty-state">Info card unavailable — the package or monthly price is missing or unusable.</p>';
  const fields = [
    `Customer: ${escapeHtml(card.customerName || card.customerId)}`,
    `Package: ${escapeHtml(card.package)}`,
    `Monthly price: ${escapeHtml(formatAmount(card.monthlyPrice))}`,
    card.cycleDueDay === null
      ? 'Billing cycle: not recorded'
      : `Billing cycle: due on day ${card.cycleDueDay}${card.cycleIsDefault ? ' (default)' : ''}`,
    card.nextDueDate ? `Next due date: ${escapeHtml(card.nextDueDate)}` : 'Next due date: not recorded',
    `Connection status: ${escapeHtml(card.connectionStatus || 'not recorded')}`,
    card.expiryDate ? `Package expiry: ${escapeHtml(card.expiryDate)}` : 'Package expiry: not recorded',
    `Support contact: ${escapeHtml(card.supportContact || 'not recorded')}`,
  ];
  if (card.pendingChange) {
    fields.push(`Package change noted: ${escapeHtml(card.pendingChange.proposedPackage)} — current package stays in force until applied`);
  }
  const rows = fields.map((field) => `<li>${field}</li>`).join('');
  const textBlock = draftText ? `<pre>${escapeHtml(draftText)}</pre>` : '';
  const sentLine = `<p>${escapeHtml(infoCardSentText(sends))}</p>`;
  return `<ul>${rows}</ul>${textBlock}${sentLine}`;
}
