// Plan 172 (Plan 101-202) — Dormant-but-Paid Customer Check-In List.
//
// Some customers pay regularly but have had no contact for months,
// so nobody notices until they quietly disconnect that they felt
// neglected or had an unresolved irritation. This module builds the
// list that catches them first: customers who are paid up but have
// no recorded contact, visit, or feedback within a period the owner
// sets once, shown oldest-silent first, with the last-contact date
// and mohalla. The operator works through the list with a short
// check-in draft sent by hand; the list itself changes nothing.
//
// What this module is NOT, stated plainly:
//   - It is not a billing, payment, package, or status record. A
//     customer appears here only because the caller says they are
//     paid up; this module never reads a bill or a payment, and it
//     never changes one. Marking a customer contacted updates only
//     the last-contact date in this module's own records.
//   - It never sends anything by itself. The check-in draft is a
//     plain-words text the operator sends by hand; recording a
//     check-in only records that the operator did so.
//   - It promises nothing: no offer, discount, or credit appears
//     in the draft, and no draft claims a service improvement.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     the silence-period settings, and today's date, and the module
//     never reads storage, the clock, or the network, and never
//     mutates an input.
//   - A record with no id or no customer is refused outright.
//     Unknown fields are dropped, so a record can never grow a
//     bill, payment, package, status, or sending field.
//   - One record per customer (case-insensitive): a second record
//     for the same customer with a different id is refused outright.
//     To record a customer again, the operator removes the old
//     record first.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures also leaves the list unchanged.
//   - Dates are strict calendar dates: 2026-02-30, 2026-04-31,
//     and any other impossible date are refused, never guessed.
//   - The list refreshes from stored dates: the last-contact date
//     is always the latest of the stored contact, visit, and
//     feedback dates, so a newer visit or feedback moves a customer
//     off the list without any extra bookkeeping.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

// Pure civil-date arithmetic (no Date object, no clock): days counted
// from 1970-01-01.
function daysFromCivil(year, month, day) {
  const yy = month <= 2 ? year - 1 : year;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = month > 2 ? month - 3 : month + 9;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function daysBetween(fromDate, toDate) {
  const fromYear = Number(fromDate.slice(0, 4));
  const fromMonth = Number(fromDate.slice(5, 7));
  const fromDay = Number(fromDate.slice(8, 10));
  const toYear = Number(toDate.slice(0, 4));
  const toMonth = Number(toDate.slice(5, 7));
  const toDay = Number(toDate.slice(8, 10));
  return daysFromCivil(toYear, toMonth, toDay) - daysFromCivil(fromYear, fromMonth, fromDay);
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function cleanDate(value) {
  const text = cleanText(value);
  return isStrictDate(text) ? text : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const DEFAULT_DORMANT_SETTINGS = { silenceDays: 90 };

function cleanSilenceDays(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const days = Math.floor(number);
  return days >= 1 ? days : fallback;
}

export function normalizeDormantSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    silenceDays: cleanSilenceDays(input.silenceDays, DEFAULT_DORMANT_SETTINGS.silenceDays),
  };
}

export function normalizeDormantCustomer(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const customerId = cleanText(value.customerId);
  if (!id || !customerId) return null;
  return {
    id,
    customerId,
    mohalla: cleanText(value.mohalla),
    paidUp: value.paidUp === true,
    contactDate: cleanDate(value.contactDate),
    visitDate: cleanDate(value.visitDate),
    feedbackDate: cleanDate(value.feedbackDate),
  };
}

export function normalizeDormantCustomerList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const record = normalizeDormantCustomer(item);
    if (record) out.push(record);
  }
  return out;
}

export function findDormantCustomer(list, id) {
  const records = normalizeDormantCustomerList(list);
  const key = cleanText(id);
  return records.find((record) => record.id === key) ?? null;
}

export function recordDormantCustomer(list, record) {
  const records = normalizeDormantCustomerList(list);
  const next = normalizeDormantCustomer(record);
  if (!next) return records;
  if (records.some((item) => item.id === next.id)) return records;
  if (records.some((item) => cleanKey(item.customerId) === cleanKey(next.customerId))) return records;
  return [...records, next];
}

export function removeDormantCustomer(list, id) {
  const records = normalizeDormantCustomerList(list);
  const key = cleanText(id);
  return records.filter((record) => record.id !== key);
}

// The last-contact date is the latest of the stored contact, visit,
// and feedback dates; a customer with none of the three has never
// been in contact, which counts as the longest silence of all.
export function dormantLastContactDate(record) {
  const item = normalizeDormantCustomer(record);
  if (!item) return '';
  const dates = [item.contactDate, item.visitDate, item.feedbackDate].filter(Boolean);
  if (dates.length === 0) return '';
  return dates.sort()[dates.length - 1];
}

export function dormantSilentDays(record, today) {
  const item = normalizeDormantCustomer(record);
  if (!item || !isStrictDate(today)) return null;
  const last = dormantLastContactDate(item);
  if (!last) return null;
  return daysBetween(last, today);
}

// A customer is dormant only when paid up and past the set silence
// period. A customer with no stored contact, visit, or feedback date
// is past any silence period by definition. A customer whose latest
// date is today or in the future is never dormant.
export function dormantIsDormant(record, settings, today) {
  const item = normalizeDormantCustomer(record);
  if (!item || !item.paidUp || !isStrictDate(today)) return false;
  const last = dormantLastContactDate(item);
  if (!last) return true;
  const days = daysBetween(last, today);
  const silence = normalizeDormantSettings(settings).silenceDays;
  return days > silence;
}

function compareDormant(a, b) {
  const lastA = dormantLastContactDate(a);
  const lastB = dormantLastContactDate(b);
  if (!lastA && lastB) return -1;
  if (lastA && !lastB) return 1;
  if (lastA && lastB && lastA !== lastB) return lastA < lastB ? -1 : 1;
  return cleanKey(a.customerId) < cleanKey(b.customerId) ? -1 : 1;
}

export function dormantCheckinList(list, settings, today) {
  const records = normalizeDormantCustomerList(list);
  if (!isStrictDate(today)) return [];
  return records
    .filter((record) => dormantIsDormant(record, settings, today))
    .sort(compareDormant);
}

export function dormantCheckinForCustomer(list, customerId, settings, today) {
  const records = normalizeDormantCustomerList(list);
  const key = cleanKey(customerId);
  const record = records.find((item) => cleanKey(item.customerId) === key);
  if (!record || !dormantIsDormant(record, settings, today)) return null;
  return {
    record,
    lastContactDate: dormantLastContactDate(record),
    silentDays: dormantSilentDays(record, today),
    draftText: dormantCheckinDraftText(record),
  };
}

// Contacting a customer updates only the last-contact date: the
// stored contact date moves, and nothing else on the record changes.
export function markDormantContacted(list, id, contactedDate) {
  if (!isStrictDate(contactedDate)) return normalizeDormantCustomerList(list);
  const records = normalizeDormantCustomerList(list);
  const key = cleanText(id);
  return records.map((record) => (record.id === key ? { ...record, contactDate: contactedDate } : record));
}

export function dormantCheckinDraftText(record) {
  const item = normalizeDormantCustomer(record);
  if (!item) return '';
  return `A short check-in for ${item.customerId}: we hope your connection is running well. If anything has been bothering you, or if there is something we can do better, please tell us — we would like to hear from you.`;
}

export function dormantCustomers(list) {
  const seen = new Map();
  for (const record of normalizeDormantCustomerList(list)) {
    const key = cleanKey(record.customerId);
    if (!seen.has(key)) seen.set(key, record.customerId);
  }
  return [...seen.values()].sort((a, b) => (cleanKey(a) < cleanKey(b) ? -1 : 1));
}

export function dormantCheckinSummaryText(list, settings, today) {
  const records = normalizeDormantCustomerList(list);
  const dormant = dormantCheckinList(list, settings, today);
  const paidUp = records.filter((record) => record.paidUp).length;
  return `${dormant.length} dormant-but-paid of ${paidUp} paid-up customers, silence period ${normalizeDormantSettings(settings).silenceDays} days`;
}

export function dormantCheckinAllHtml(list, settings, today) {
  const dormant = dormantCheckinList(list, settings, today);
  if (dormant.length === 0) return '<p>No dormant-but-paid customers in the check-in list.</p>';
  return dormant.map((record) => {
    const last = dormantLastContactDate(record);
    const days = dormantSilentDays(record, today);
    const silenceText = last ? `last contact ${escapeHtml(last)} (${days} days ago)` : 'no recorded contact yet';
    const mohallaText = record.mohalla ? ` · ${escapeHtml(record.mohalla)}` : '';
    return `<p><strong>${escapeHtml(record.customerId)}</strong>${mohallaText} · ${silenceText} <small>(${escapeHtml(record.id)})</small></p>`;
  }).join('');
}

export function dormantCheckinCsv(list, settings, today) {
  const rows = [['id', 'customer', 'mohalla', 'last contact', 'silent days', 'dormant']];
  for (const record of normalizeDormantCustomerList(list)) {
    const last = dormantLastContactDate(record);
    const days = dormantSilentDays(record, today);
    rows.push([
      record.id,
      record.customerId,
      record.mohalla,
      last,
      days === null ? '' : days,
      dormantIsDormant(record, settings, today) ? 'yes' : 'no',
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function dormantCheckinFilename() {
  return 'shahdara_dormant_checkin.csv';
}
