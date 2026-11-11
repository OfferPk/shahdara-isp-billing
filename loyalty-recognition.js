// Plan 100 (Plan 1-100) — Long-standing customer recognition list and
// anniversary thank-you draft.
//
// This module is the RECOGNITION LIST and the DRAFT only, and nothing
// else:
//
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never mutates an input. It never reads or rewrites the
//     drifting-away list from Plan 56 — loyal customers and drifting
//     customers are two different lists, and this module touches only
//     the loyal side. It names no bill, payment, or lifecycle field
//     of its own: payment standing arrives as caller-supplied counts
//     only (bills counted, bills paid in full, bills still
//     outstanding), so the module never opens a bill record itself.
//   - Tenure counts from the customer's activation date. Where a
//     service period list is supplied, tenure counts from the start
//     of the LATEST period only: a customer whose service lapsed
//     and restarted shows tenure from the latest continuous period,
//     never from the original connection. A recorded restart date
//     (continuousSince / restartDate) beats the connection date the
//     same way. A customer whose latest period already ended before
//     the fixture date is not currently continuous and never enters
//     the list.
//   - The list contains exactly the customers meeting the milestone
//     on the same fixture date: full years of continuous service at
//     or above the operator-set milestone (default one full year).
//     A customer one day short of the milestone is not listed, and
//     a future start date is never listed.
//   - A thank-you draft is bilingual (Roman Urdu or Urdu script)
//     and carries only the customer's name and their full years of
//     service. It promises nothing and changes nothing: no price
//     change, no bill change, no lifecycle change. Sending is never
//     automatic — the operator sends through the existing WhatsApp
//     route, and logging a send only records that send.
//   - Half-formed records are refused outright, never stored
//     half-formed. Unknown fields are dropped on normalisation, so
//     a record can never grow a field it does not own.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

/** Strict YYYY-MM-DD calendar date, or null (2026-02-30 is refused). */
export function validLoyaltyDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function dateParts(value) {
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)), day: Number(value.slice(8, 10)) };
}

function compareDates(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Add whole calendar years, clamping 29 February to 28 February. */
export function addLoyaltyYears(start, years) {
  const { year, month, day } = dateParts(start);
  const targetYear = year + years;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return `${targetYear}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/** Add whole calendar months, clamping to the target month's last day. */
export function addLoyaltyMonths(start, months) {
  const { year, month, day } = dateParts(start);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = total - targetYear * 12 + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Whole calendar years between start and asOf (anniversary-based).
 * A 29 February start reaches its anniversary on 28 February in a
 * non-leap year, matching the clamped anniversary date.
 */
export function fullLoyaltyYears(start, asOf) {
  const s = dateParts(start);
  const a = dateParts(asOf);
  let years = a.year - s.year;
  if (compareDates(asOf, addLoyaltyYears(start, years)) < 0) years -= 1;
  return years;
}

/** Whole calendar months between start and asOf, same clamping rule. */
export function fullLoyaltyMonths(start, asOf) {
  const s = dateParts(start);
  const a = dateParts(asOf);
  let months = (a.year - s.year) * 12 + (a.month - s.month);
  if (compareDates(asOf, addLoyaltyMonths(start, months)) < 0) months -= 1;
  return months;
}

/**
 * Start of the latest continuous service period for one customer, or
 * null when no usable start is recorded. Precedence: the latest
 * entry of a supplied period list, then a recorded restart date,
 * then the activation / connection date.
 */
export function continuousStartDate(customer) {
  if (!customer || typeof customer !== 'object') return null;
  const periods = Array.isArray(customer.periods) ? customer.periods : [];
  const validPeriods = periods
    .map((period) => {
      if (!period || typeof period !== 'object') return null;
      const start = validLoyaltyDate(period.start);
      if (!start) return null;
      return { start, end: validLoyaltyDate(period.end) };
    })
    .filter(Boolean)
    .sort((a, b) => compareDates(a.start, b.start) || compareDates(a.end ?? '9999-12-31', b.end ?? '9999-12-31'));
  if (validPeriods.length > 0) return validPeriods[validPeriods.length - 1].start;
  return validLoyaltyDate(customer.continuousSince)
    || validLoyaltyDate(customer.restartDate)
    || validLoyaltyDate(customer.activationDate)
    || validLoyaltyDate(customer.connectionDate);
}

/** Latest supplied period for one customer, or null when none is usable. */
export function latestServicePeriod(customer) {
  if (!customer || typeof customer !== 'object' || !Array.isArray(customer.periods)) return null;
  const validPeriods = customer.periods
    .map((period) => {
      if (!period || typeof period !== 'object') return null;
      const start = validLoyaltyDate(period.start);
      if (!start) return null;
      return { start, end: validLoyaltyDate(period.end) };
    })
    .filter(Boolean)
    .sort((a, b) => compareDates(a.start, b.start) || compareDates(a.end ?? '9999-12-31', b.end ?? '9999-12-31'));
  return validPeriods.length > 0 ? validPeriods[validPeriods.length - 1] : null;
}

/**
 * Tenure of one customer on one fixture date. Statuses: 'current'
 * (continuous to the fixture date), 'future' (start after the
 * fixture date), 'ended' (latest period ended before the fixture
 * date), 'no-date' (no usable start recorded). Invalid fixture
 * dates and customers without an id return null.
 */
export function tenureFor(customer, asOf) {
  const fixture = validLoyaltyDate(asOf);
  if (!fixture) return null;
  if (!customer || typeof customer !== 'object') return null;
  const customerId = cleanText(customer.id);
  if (!customerId) return null;
  const start = continuousStartDate(customer);
  const base = {
    customerId,
    customerName: cleanText(customer.name ?? customer.customerName),
    mohalla: cleanText(customer.mohalla ?? customer.area),
    start,
    fullYears: null,
    fullMonths: null,
    nextAnniversary: null,
    status: 'no-date',
  };
  if (!start) return base;
  if (compareDates(start, fixture) > 0) return { ...base, status: 'future' };
  const latest = latestServicePeriod(customer);
  if (latest && latest.end && compareDates(latest.end, fixture) < 0) {
    return { ...base, status: 'ended', fullYears: fullLoyaltyYears(start, latest.end), fullMonths: fullLoyaltyMonths(start, latest.end) };
  }
  const fullYears = fullLoyaltyYears(start, fixture);
  return {
    ...base,
    status: 'current',
    fullYears,
    fullMonths: fullLoyaltyMonths(start, fixture),
    nextAnniversary: addLoyaltyYears(start, fullYears + 1),
  };
}

/** Operator-set milestone in whole years; anything unusable is 1. */
export function normalizeMilestoneYears(value) {
  const years = Number(value);
  if (!Number.isInteger(years) || years < 1) return 1;
  return years;
}

function cleanCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.floor(count);
}

/** Plain-words payment standing from caller-supplied counts only. */
export function standingLabel(standing) {
  const billsCount = cleanCount(standing?.billsCount);
  const paidInFullCount = cleanCount(standing?.paidInFullCount);
  const outstandingCount = cleanCount(standing?.outstandingCount);
  if (outstandingCount > 0) return `${outstandingCount} bill${outstandingCount === 1 ? '' : 's'} still outstanding`;
  if (paidInFullCount > 0) return 'All bills paid in full';
  if (billsCount > 0) return 'Bills recorded';
  return 'No bills recorded';
}

/**
 * The recognition list: exactly the customers with current tenure
 * at or above the milestone on the fixture date, longest tenure
 * first, then name A–Z. Caller-supplied standings are looked up by
 * customer id; a customer without a standing row shows 'No bills
 * recorded', never a guessed standing.
 */
export function buildRecognitionList(customers, { asOf, milestoneYears = 1, standings = [] } = {}) {
  const fixture = validLoyaltyDate(asOf);
  if (!fixture || !Array.isArray(customers)) return [];
  const milestone = normalizeMilestoneYears(milestoneYears);
  const standingById = new Map();
  for (const row of Array.isArray(standings) ? standings : []) {
    if (row && typeof row === 'object' && cleanText(row.customerId)) standingById.set(cleanText(row.customerId), row);
  }
  const rows = [];
  for (const customer of customers) {
    const tenure = tenureFor(customer, fixture);
    if (!tenure || tenure.status !== 'current') continue;
    if (tenure.fullYears < milestone) continue;
    const standing = standingById.get(tenure.customerId);
    rows.push({
      ...tenure,
      standing: standingLabel(standing),
      isAnniversaryToday: tenure.start.slice(5) === fixture.slice(5),
    });
  }
  rows.sort((a, b) => b.fullYears - a.fullYears
    || b.fullMonths - a.fullMonths
    || a.customerName.localeCompare(b.customerName)
    || a.customerId.localeCompare(b.customerId));
  return rows;
}

const RECOGNITION_MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
});

export function canonicalRecognitionMohalla(value) {
  const key = cleanText(value).toLocaleUpperCase().replace(/\s+/g, ' ');
  if (!key) return null;
  const stripped = key.startsWith('MOHALLA ') ? key.slice('MOHALLA '.length).trim() : key;
  if (!stripped) return null;
  return RECOGNITION_MOHALLA_ALIASES[stripped.toLocaleLowerCase()] ?? stripped;
}

/** Filter recognition rows by mohalla (aliases folded); blank keeps all. */
export function filterRecognitionByMohalla(rows, mohalla) {
  const wanted = canonicalRecognitionMohalla(mohalla);
  if (!wanted) return Array.isArray(rows) ? [...rows] : [];
  return (Array.isArray(rows) ? rows : []).filter((row) => canonicalRecognitionMohalla(row.mohalla) === wanted);
}

/**
 * One bilingual thank-you draft for one recognition row. The draft
 * thanks the customer for their full years of service and promises
 * nothing: it carries no offer, no price, and no change of any kind.
 */
export function thankYouDraft(row, variant = 'roman') {
  if (!row || typeof row !== 'object') return '';
  const name = cleanText(row.customerName) || cleanText(row.customerId);
  const years = cleanCount(row.fullYears);
  if (!name || years < 1) return '';
  if (variant === 'urdu') {
    return `السلام علیکم ${name}! شاہدرہ فائبر نیٹ کی طرف سے دل سے شکریہ — آپ ${years} سال سے ہمارے ساتھ ہیں۔ آپ کے اعتماد پر ہی ہماری سروس چلتی ہے۔ شکریہ!`;
  }
  return `Assalam-o-Alaikum ${name}! Shahdara Fiber Net ki taraf se dil se shukriya — aap ${years} saal se hamare saath hain. Aap ke bharose par hi hamari service chalti hai. Shukriya!`;
}

// Only these keys ever survive normalisation of a send-log entry.
const THANK_YOU_SEND_KEYS = ['id', 'customer', 'customerName', 'date', 'channel', 'variant'];

export function normalizeThankYouSend(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const date = validLoyaltyDate(record.date);
  const channel = cleanText(record.channel);
  const variant = cleanText(record.variant) || 'roman';
  if (!id || !customer || !date) return null;
  if (channel !== 'whatsapp') return null;
  if (variant !== 'roman' && variant !== 'urdu') return null;
  const out = {
    id,
    customer,
    customerName: cleanText(record.customerName),
    date,
    channel,
    variant,
  };
  if (Object.keys(out).some((key) => !THANK_YOU_SEND_KEYS.includes(key))) return null;
  return out;
}

export function normalizeThankYouSendList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const item of list) {
    const record = normalizeThankYouSend(item);
    if (record) byId.set(record.id, record);
  }
  return [...byId.values()];
}

export function upsertThankYouSend(list, record) {
  const normalized = normalizeThankYouSend(record);
  const kept = normalizeThankYouSendList(list);
  if (!normalized) return kept;
  return [...kept.filter((item) => item.id !== normalized.id), normalized];
}

export function removeThankYouSend(list, id) {
  return normalizeThankYouSendList(list).filter((item) => item.id !== cleanText(id));
}

export function sendsForCustomer(list, customerId) {
  return normalizeThankYouSendList(list)
    .filter((item) => item.customer === cleanText(customerId))
    .sort((a, b) => compareDates(b.date, a.date) || a.id.localeCompare(b.id));
}

// Only these keys ever survive normalisation of a restart record.
const RESTART_KEYS = ['customer', 'restartDate'];

export function normalizeRestart(record) {
  if (!record || typeof record !== 'object') return null;
  const customer = cleanText(record.customer);
  const restartDate = validLoyaltyDate(record.restartDate);
  if (!customer || !restartDate) return null;
  const out = { customer, restartDate };
  if (Object.keys(out).some((key) => !RESTART_KEYS.includes(key))) return null;
  return out;
}

export function normalizeRestartList(list) {
  if (!Array.isArray(list)) return [];
  const byCustomer = new Map();
  for (const item of list) {
    const record = normalizeRestart(item);
    if (record) byCustomer.set(record.customer, record);
  }
  return [...byCustomer.values()];
}

export function upsertRestart(list, record) {
  const normalized = normalizeRestart(record);
  const kept = normalizeRestartList(list);
  if (!normalized) return kept;
  return [...kept.filter((item) => item.customer !== normalized.customer), normalized];
}

export function removeRestart(list, customerId) {
  return normalizeRestartList(list).filter((item) => item.customer !== cleanText(customerId));
}

export function restartDateFor(list, customerId) {
  const found = normalizeRestartList(list).find((item) => item.customer === cleanText(customerId));
  return found ? found.restartDate : null;
}

export function recognitionSummaryText(rows, milestoneYears) {
  const list = Array.isArray(rows) ? rows : [];
  const milestone = normalizeMilestoneYears(milestoneYears);
  if (list.length === 0) return `No customer has reached ${milestone} full year${milestone === 1 ? '' : 's'} of continuous service yet.`;
  const anniversaries = list.filter((row) => row.isAnniversaryToday).length;
  const extra = anniversaries > 0 ? `, including ${anniversaries} anniversary today` : '';
  return `${list.length} loyal customer${list.length === 1 ? '' : 's'} at ${milestone} full year${milestone === 1 ? '' : 's'} or more of continuous service${extra}.`;
}

function escapeLoyaltyHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function recognitionHtml(rows, sends = []) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return '<p>No loyal customer meets the milestone yet.</p>';
  const sentByCustomer = new Map();
  for (const send of normalizeThankYouSendList(sends)) {
    sentByCustomer.set(send.customer, (sentByCustomer.get(send.customer) ?? 0) + 1);
  }
  const body = list.map((row) => {
    const sentCount = sentByCustomer.get(row.customerId) ?? 0;
    const sentNote = sentCount > 0 ? ` · Thank-you sent ${sentCount} time${sentCount === 1 ? '' : 's'}` : ' · Thank-you not sent yet';
    const anniversaryNote = row.isAnniversaryToday ? ' · Anniversary today' : '';
    return `<tr><td>${escapeLoyaltyHtml(row.customerName || row.customerId)}</td><td>${escapeLoyaltyHtml(row.mohalla || 'Not recorded')}</td><td>${escapeLoyaltyHtml(row.start)}</td><td>${row.fullYears} year${row.fullYears === 1 ? '' : 's'} (${row.fullMonths} months)</td><td>${escapeLoyaltyHtml(row.standing)}</td><td>${escapeLoyaltyHtml(`Next anniversary ${row.nextAnniversary}${anniversaryNote}${sentNote}`)}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>Customer</th><th>Mohalla</th><th>Continuous since</th><th>Tenure</th><th>Payment standing</th><th>Note</th></tr></thead><tbody>${body}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function recognitionCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const lines = ['Customer,Mohalla,Continuous since,Full years,Full months,Payment standing,Next anniversary'];
  for (const row of list) {
    lines.push([row.customerName || row.customerId, row.mohalla || '', row.start, row.fullYears, row.fullMonths, row.standing, row.nextAnniversary].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function recognitionFilename() {
  return 'loyalty-recognition.csv';
}
