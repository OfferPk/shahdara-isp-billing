// Plan 177 (Plan 101-202) — New-customer check-in list after onboarding.
//
// A new customer is installed and then left alone, so early confusion
// about the package, the bill, or the equipment surfaces only as a
// complaint or a disconnection. This module adds only the timed
// check-in list and its short check-in draft; the onboarding
// checklist itself (onboarding-checklist.js) is neither read nor
// written, and no bill, payment, package, or onboarding record is
// ever changed here.
//
// Scope fence, stated plainly:
//   - This is a list ONLY. It never changes a bill, a payment, a
//     package, or an onboarding record, and it never sends anything
//     automatically — the operator works through the list with a
//     short check-in draft sent by hand.
//   - It is import-free (like promise-tracker.js): the caller supplies
//     every record and every date, and the module never reads
//     storage, the clock, or the network, and never mutates an input.
//   - The first-month window is one calendar month after the
//     connection date: a customer connected on 2026-11-04 is in the
//     list from 2026-11-04 through 2026-12-03, and leaves the list on
//     2026-12-04. A customer with no recorded window is never
//     assumed to be inside it — only a strict connection date counts.
//   - Checking in updates ONLY the last-contact date. It never
//     changes the connection date, the mohalla, or anything else.
//   - Dates are strict YYYY-MM-DD calendar dates. A date that is not
//     real becomes null, never a guessed date.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1];
}

function parseStrictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

function isStrictDate(value) {
  return parseStrictDate(value) !== null;
}

function compareDates(a, b) {
  const pa = parseStrictDate(a);
  const pb = parseStrictDate(b);
  if (!pa || !pb) return 0;
  if (pa.year !== pb.year) return pa.year < pb.year ? -1 : 1;
  if (pa.month !== pb.month) return pa.month < pb.month ? -1 : 1;
  if (pa.day !== pb.day) return pa.day < pb.day ? -1 : 1;
  return 0;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

// One calendar month after the given date, with the day clamped to
// the target month (31 January -> 28 February, or 29 in a leap year).
export function windowEndDate(connectionDate) {
  const parsed = parseStrictDate(connectionDate);
  if (!parsed) return null;
  let year = parsed.year;
  let month = parsed.month + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  const day = Math.min(parsed.day, daysInMonth(year, month));
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function normalizeNewCustomerCheckin(record) {
  if (!record || typeof record !== 'object') return null;
  const id = text(record.id);
  const customerId = text(record.customerId);
  const connectionDate = text(record.connectionDate);
  const mohalla = text(record.mohalla);
  if (!id || !customerId || !mohalla) return null;
  if (!isStrictDate(connectionDate)) return null;
  const lastContactDate = text(record.lastContactDate);
  if (lastContactDate && !isStrictDate(lastContactDate)) return null;
  return {
    id,
    customerId,
    connectionDate,
    mohalla,
    lastContactDate,
  };
}

export function normalizeNewCustomerCheckinList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const item = normalizeNewCustomerCheckin(record);
    if (item) out.push(item);
  }
  return out;
}

export function findNewCustomerCheckin(list, id) {
  const items = normalizeNewCustomerCheckinList(list);
  const wanted = text(id);
  return items.find((item) => item.id === wanted) || null;
}

// A duplicate id is never rewritten: an identical re-save leaves the
// list unchanged, and a different record under the same id is
// refused. One record per customer (case-insensitive): a second
// record for the same customer is refused outright.
export function upsertNewCustomerCheckin(list, record) {
  const items = normalizeNewCustomerCheckinList(list);
  const item = normalizeNewCustomerCheckin(record);
  if (!item) return items;
  if (items.some((entry) => entry.id === item.id)) return items;
  if (items.some((entry) => entry.customerId.toLowerCase() === item.customerId.toLowerCase())) return items;
  return [...items, item];
}

export function removeNewCustomerCheckin(list, id) {
  const items = normalizeNewCustomerCheckinList(list);
  const wanted = text(id);
  return items.filter((item) => item.id !== wanted);
}

// Checking in updates ONLY the last-contact date. A bad date leaves
// the record unchanged; nothing else on the record ever moves.
export function markNewCustomerCheckedIn(list, id, contactDate) {
  const items = normalizeNewCustomerCheckinList(list);
  const wanted = text(id);
  const date = text(contactDate);
  if (!isStrictDate(date)) return items;
  return items.map((item) => (item.id === wanted ? { ...item, lastContactDate: date } : item));
}

// Inside the first-month window: connection date <= today < the date
// one calendar month after connection. A customer who leaves the
// window leaves the list; a future connection date is never inside.
export function isInFirstMonth(record, today) {
  const item = normalizeNewCustomerCheckin(record);
  if (!item) return false;
  if (!isStrictDate(today)) return false;
  const end = windowEndDate(item.connectionDate);
  if (!end) return false;
  return compareDates(item.connectionDate, today) <= 0 && compareDates(today, end) < 0;
}

// The timed list only: customers inside their first month, oldest
// connection first (those closest to leaving the window first), then
// customer A-Z.
export function newCustomerCheckinList(list, today) {
  const items = normalizeNewCustomerCheckinList(list);
  return items
    .filter((item) => isInFirstMonth(item, today))
    .sort((a, b) => {
      const byDate = compareDates(a.connectionDate, b.connectionDate);
      if (byDate !== 0) return byDate;
      return a.customerId.localeCompare(b.customerId);
    });
}

export function checkinsForCustomer(list, customerId) {
  const items = normalizeNewCustomerCheckinList(list);
  const wanted = text(customerId).toLowerCase();
  if (!wanted) return [];
  return items.filter((item) => item.customerId.toLowerCase() === wanted);
}

export function newCustomerCheckinCustomers(list) {
  const items = normalizeNewCustomerCheckinList(list);
  const seen = new Map();
  for (const item of items) {
    const key = item.customerId.toLowerCase();
    if (!seen.has(key)) seen.set(key, item.customerId);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

// Short plain-words check-in draft, sent by hand only. It promises no
// offer, discount, or credit — it only asks how the new connection is
// going and whether anything is confusing yet.
export function newCustomerCheckinDraftText(record) {
  const item = normalizeNewCustomerCheckin(record);
  if (!item) return '';
  return `Hello ${item.customerId}, just checking in on your new connection in ${item.mohalla} (connected ${item.connectionDate}). Is everything working as you expected — the package, the bill, and the equipment? If anything is confusing, tell us now while it is easy to fix.`;
}

export function newCustomerCheckinSummaryText(list, today) {
  const items = normalizeNewCustomerCheckinList(list);
  const inWindow = newCustomerCheckinList(items, today);
  const checkedIn = inWindow.filter((item) => item.lastContactDate !== '').length;
  return `${inWindow.length} new customer(s) in their first month${isStrictDate(today) ? ` (as of ${text(today)})` : ''}, ${checkedIn} already checked in.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function newCustomerCheckinHtml(record) {
  const item = normalizeNewCustomerCheckin(record);
  if (!item) return '';
  const contact = item.lastContactDate ? `Last contact: ${escapeHtml(item.lastContactDate)}` : 'Not checked in yet';
  return `<p><strong>${escapeHtml(item.customerId)}</strong> — ${escapeHtml(item.mohalla)} — connected ${escapeHtml(item.connectionDate)} — ${contact}</p>`;
}

export function newCustomerCheckinAllHtml(list) {
  const items = normalizeNewCustomerCheckinList(list);
  if (!items.length) return '<p>No new-customer check-in records.</p>';
  return items.map((item) => newCustomerCheckinHtml(item)).join('');
}

export function newCustomerCheckinCsv(list) {
  const items = normalizeNewCustomerCheckinList(list);
  const cell = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const rows = ['id,customerId,connectionDate,mohalla,lastContactDate'];
  for (const item of items) {
    rows.push([item.id, item.customerId, item.connectionDate, item.mohalla, item.lastContactDate].map(cell).join(','));
  }
  return rows.join('\n');
}

export function newCustomerCheckinFilename() {
  return 'new-customer-checkins.csv';
}
