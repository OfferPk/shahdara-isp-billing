// Plan 98 (Plan 1-100) — Time-boxed promotional offer record, applied
// only through the existing concession path.
//
// This module is the RECORD only, and nothing else:
//
//   - It is pure and import-free: the caller supplies every record
//     and every date, and the module never reads storage, the clock,
//     or the network, and never mutates an input. It names no bill,
//     payment, or package-price field of its own, and it never reads
//     or rewrites the price history (Plan 34) or a collection
//     campaign (Plan 30) — those live elsewhere and are untouched.
//   - A promotion grants no billing change of its own. The benefit
//     is stated here in plain words only; when it is actually given,
//     it goes through the existing concession path with its own
//     audit note, and this record only keeps the concession
//     reference that carried it. Creating or viewing a promotion
//     never changes any bill, payment, or package price.
//   - Each promotion carries exactly one benefit wording, one date
//     window, and its covered mohallas. The window is inclusive at
//     both ends: active on the start date and on the end date, and
//     expired the day after the end date. An expired promotion
//     offers no benefit, and an application dated outside the
//     window is refused outright.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). Half-formed records are refused
//     outright, never stored half-formed. Unknown fields are
//     dropped on normalisation, so the record can never grow a
//     field it does not own.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
});

export function validPromoDate(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function normalizedText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function stripMohallaPrefix(value) {
  const stripped = normalizedText(value).replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  return stripped || normalizedText(value);
}

function readableLabel(value) {
  return normalizedText(value).split(' ').map((word) => {
    const chars = Array.from(word);
    if (!chars.length) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  }).join(' ');
}

// Mirrors the Plan T canonical rule without importing it.
export function canonicalPromoMohalla(value) {
  const raw = normalizedText(value);
  if (!raw) return null;
  const stripped = stripMohallaPrefix(raw);
  const key = stripped.toLowerCase();
  const canonical = MOHALLA_ALIASES[key];
  if (canonical) return { key: canonical.toLowerCase(), label: readableLabel(canonical), stored: canonical };
  return { key, label: readableLabel(stripped), stored: stripped };
}

function stringList(value) {
  const raw = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const itemText = text(item);
    if (!itemText) continue;
    const key = itemText.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(itemText);
  }
  return out;
}

// Only these keys ever survive normalisation. Anything else on the
// input is dropped, so the record can never grow a bill, payment,
// or price field of its own.
const PROMO_KEYS = [
  'id', 'name', 'packages', 'benefit', 'startDate', 'endDate', 'mohallas',
];

export function normalizePromo(record) {
  if (!record || typeof record !== 'object') return null;
  const id = text(record.id);
  const name = text(record.name);
  const benefit = text(record.benefit);
  if (!id || !name || !benefit) return null;
  const packages = stringList(record.packages);
  const mohallas = stringList(record.mohallas);
  if (packages.length === 0 || mohallas.length === 0) return null;
  const startDate = validPromoDate(record.startDate);
  const endDate = validPromoDate(record.endDate);
  if (!startDate || !endDate) return null;
  // A window that ends before it starts is half-formed, refused.
  if (endDate < startDate) return null;
  return { id, name, packages, benefit, startDate, endDate, mohallas };
}

export function normalizePromoList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const normalized = normalizePromo(record);
    if (normalized) out.push(normalized);
  }
  return out;
}

export function upsertPromo(list, record) {
  const normalized = normalizePromo(record);
  if (!normalized) return normalizePromoList(list);
  const next = normalizePromoList(list).filter((item) => item.id !== normalized.id);
  next.push(normalized);
  return next;
}

export function removePromo(list, id) {
  return normalizePromoList(list).filter((item) => item.id !== text(id));
}

export function findPromo(list, id) {
  return normalizePromoList(list).find((item) => item.id === text(id)) || null;
}

// Status on the caller-supplied day: upcoming before the window,
// active inside it (both ends inclusive), expired after it. A
// promotion with an unusable day has no status, never a guessed one.
export function promoStatus(promo, today) {
  const normalized = normalizePromo(promo);
  const day = validPromoDate(today);
  if (!normalized || !day) return null;
  if (day < normalized.startDate) return 'upcoming';
  if (day > normalized.endDate) return 'expired';
  return 'active';
}

export function promoStatusLabel(status) {
  return { upcoming: 'Upcoming', active: 'Active', expired: 'Expired' }[status] || 'Not recorded';
}

// The benefit wording is offered only while the promotion is
// active on the given day. An expired (or not-yet-started)
// promotion offers nothing — null, never the wording.
export function promoBenefit(promo, today) {
  const normalized = normalizePromo(promo);
  if (!normalized) return null;
  return promoStatus(normalized, today) === 'active' ? normalized.benefit : null;
}

export function filterPromos(list, filters = {}, today = '') {
  const records = normalizePromoList(list);
  const status = text(filters.status);
  const packageFilter = text(filters.package);
  const mohallaFilter = text(filters.mohalla);
  const filterKey = mohallaFilter
    ? (canonicalPromoMohalla(mohallaFilter)?.key ?? null)
    : null;
  return records
    .filter((item) => !status || promoStatus(item, today) === status)
    .filter((item) => !packageFilter
      || item.packages.some((pkg) => pkg.toLowerCase() === packageFilter.toLowerCase()))
    .filter((item) => {
      if (!mohallaFilter || filterKey === null) return true;
      return item.mohallas.some((m) => canonicalPromoMohalla(m)?.key === filterKey);
    })
    .sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
}

// An application is only a link: which promotion, which customer,
// and the concession reference that carried the benefit. It grants
// nothing by itself, and it is refused when the promotion is not
// active on the application date, or when the concession reference
// is missing — an application without its carrying concession is
// half-formed.
const APPLICATION_KEYS = [
  'id', 'promotionId', 'customer', 'customerName', 'concessionRef', 'date',
];

export function normalizePromoApplication(record) {
  if (!record || typeof record !== 'object') return null;
  const id = text(record.id);
  const promotionId = text(record.promotionId);
  const customer = text(record.customer);
  const concessionRef = text(record.concessionRef);
  if (!id || !promotionId || !customer || !concessionRef) return null;
  const date = validPromoDate(record.date);
  if (!date) return null;
  return {
    id, promotionId, customer,
    customerName: text(record.customerName),
    concessionRef, date,
  };
}

export function normalizePromoApplicationList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const normalized = normalizePromoApplication(record);
    if (normalized) out.push(normalized);
  }
  return out;
}

// Records an application, or leaves the list exactly unchanged when
// the promotion does not exist, the application is half-formed, or
// the promotion is not active on the application date. The
// promotions list itself is never touched here.
export function recordPromoApplication(promotions, applications, application) {
  const records = normalizePromoApplicationList(applications);
  const normalized = normalizePromoApplication(application);
  if (!normalized) return records;
  const promo = findPromo(promotions, normalized.promotionId);
  if (!promo) return records;
  if (promoStatus(promo, normalized.date) !== 'active') return records;
  const next = records.filter((item) => item.id !== normalized.id);
  next.push(normalized);
  return next;
}

export function removePromoApplication(list, id) {
  return normalizePromoApplicationList(list).filter((item) => item.id !== text(id));
}

export function applicationsForPromo(applications, promotionId) {
  return normalizePromoApplicationList(applications)
    .filter((item) => item.promotionId === text(promotionId))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
}

export function promoSummaryText(list, today) {
  const records = normalizePromoList(list);
  const active = records.filter((item) => promoStatus(item, today) === 'active').length;
  const upcoming = records.filter((item) => promoStatus(item, today) === 'upcoming').length;
  const expired = records.filter((item) => promoStatus(item, today) === 'expired').length;
  return `${records.length} promotion${records.length === 1 ? '' : 's'} recorded · ${active} active · ${upcoming} upcoming · ${expired} expired`;
}

export function promoHtml(list, today) {
  const records = normalizePromoList(list);
  if (records.length === 0) return '<p class="chart-caption">No promotions recorded yet.</p>';
  const rows = records.map((item) => {
    const status = promoStatus(item, today);
    return `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.packages.join(', '))}</td><td>${escapeHtml(item.benefit)}</td><td>${escapeHtml(item.startDate)} to ${escapeHtml(item.endDate)}</td><td>${escapeHtml(item.mohallas.join(', '))}</td><td>${escapeHtml(promoStatusLabel(status))}</td></tr>`;
  }).join('');
  return `<table class="data-table"><thead><tr><th>Offer</th><th>Packages</th><th>Benefit (plain words)</th><th>Window</th><th>Mohallas</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function promoApplicationHtml(list) {
  const records = normalizePromoApplicationList(list);
  if (records.length === 0) return '<p class="chart-caption">No promotion applied to any customer yet.</p>';
  const rows = records.map((item) => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.customerName || item.customer)}</td><td>${escapeHtml(item.promotionId)}</td><td>${escapeHtml(item.concessionRef)}</td></tr>`).join('');
  return `<table class="data-table"><thead><tr><th>Date applied</th><th>Customer</th><th>Promotion</th><th>Concession reference</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function promoCsv(list) {
  const records = normalizePromoList(list);
  const header = 'id,name,packages,benefit,startDate,endDate,mohallas';
  const lines = records.map((item) => [
    item.id, item.name, item.packages.join('; '), item.benefit,
    item.startDate, item.endDate, item.mohallas.join('; '),
  ].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function promoApplicationCsv(list) {
  const records = normalizePromoApplicationList(list);
  const header = 'id,promotionId,customer,customerName,concessionRef,date';
  const lines = records.map((item) => [
    item.id, item.promotionId, item.customer, item.customerName,
    item.concessionRef, item.date,
  ].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function promoFilename(today) {
  const stamp = validPromoDate(today) ? today : 'undated';
  return `promo-offers-${stamp}.csv`;
}
