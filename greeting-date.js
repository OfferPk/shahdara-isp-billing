// Plan 163 (Plan 101-202) — Birthday and Anniversary Greeting Draft.
//
// Customers are only contacted about money, so the relationship feels
// purely transactional. This module is the RECORD for the small
// personal exception: one optional date per customer for a birthday
// or a connection anniversary, plus a short greeting draft in Roman
// Urdu or Urdu script that the operator reviews and sends by hand.
// A list shows whose date falls in the next seven days.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of Plan 100's loyalty recognition.
//     Plan 100 lists long-standing customers by tenure milestone and
//     drafts a thank-you for full years of service; it is neither
//     read nor written here. This module stores an optional
//     birthday or anniversary DATE per customer and a greeting
//     draft for that date — nothing about tenure, milestones, or
//     payment standing.
//   - It never sends anything. A greeting is a draft the operator
//     must confirm before sending; marking it sent only records
//     the sent date so the same occurrence is not repeated.
//   - It attaches no offer or discount, and it never changes any
//     bill, payment, package, or customer status. It reads and
//     writes no other record type at all.
//   - It is not proof that a date is real. The record says what
//     the operator recorded; the module verifies format and
//     ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record
//     and every reference date, and the module never reads storage,
//     the clock, or the network, and never touches another record.
//   - A record with no customer, no kind from the fixed two, no
//     date, or no id is refused outright, as is any impossible
//     date. Unknown fields are dropped, so a record can never
//     grow a bill, payment, package, or status field.
//   - One date per customer per kind: a second record for the
//     same customer (case-insensitive) and the same kind with a
//     different id is refused outright. A customer may still hold
//     both a birthday and an anniversary.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later changes are removal, and marking a greeting
//     sent for its current occurrence.
//   - Upcoming means the next occurrence of the stored month-day
//     falls within the next seven days (today included) of the
//     caller-supplied reference date, wrapping the year boundary.
//     A Feb 29 date falls back to Feb 28 in a non-leap year, so
//     the customer is never silently skipped. A greeting already
//     marked sent for that occurrence year is left off the list,
//     so it is not repeated.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const GREETING_KINDS = ['birthday', 'anniversary'];

export const GREETING_KIND_LABELS = {
  birthday: 'Birthday',
  anniversary: 'Connection anniversary',
};

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseDateParts(value) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

// Day count for a UTC calendar date, so differences never depend on
// the local timezone.
function dayNumber(year, month, day) {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function occurrenceFor(record, referenceYear) {
  const { month, day } = parseDateParts(record.date);
  let useDay = day;
  if (month === 2 && day === 29 && !isLeapYear(referenceYear)) useDay = 28;
  return { year: referenceYear, month, day: useDay };
}

// Next occurrence of the stored month-day on or after the reference
// date, plus how many days away it is.
function nextOccurrence(record, referenceDate) {
  const ref = parseDateParts(referenceDate);
  const refDay = dayNumber(ref.year, ref.month, ref.day);
  let occ = occurrenceFor(record, ref.year);
  let occDay = dayNumber(occ.year, occ.month, occ.day);
  if (occDay < refDay) {
    occ = occurrenceFor(record, ref.year + 1);
    occDay = dayNumber(occ.year, occ.month, occ.day);
  }
  return { occurrence: occ, daysUntil: occDay - refDay };
}

export function normalizeGreetingDate(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = cleanText(entry.id);
  const customer = cleanText(entry.customer);
  const kind = cleanText(entry.kind).toLowerCase();
  const date = cleanText(entry.date);
  if (!id || !customer || !GREETING_KINDS.includes(kind)) return null;
  if (!isStrictDate(date)) return null;
  const draft = cleanText(entry.draft);
  const sentDate = cleanText(entry.sentDate);
  if (sentDate && !isStrictDate(sentDate)) return null;
  const sentYear = entry.sentYear === undefined || entry.sentYear === null
    ? null
    : Number(entry.sentYear);
  if (sentYear !== null && (!Number.isInteger(sentYear) || sentYear < 0)) return null;
  return {
    id,
    customer,
    kind,
    date,
    draft: draft || '',
    sentDate: sentDate || '',
    sentYear,
  };
}

export function normalizeGreetingDateList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenIds = new Set();
  const seenCustomerKind = new Set();
  for (const entry of list) {
    const record = normalizeGreetingDate(entry);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    const key = `${record.customer.toLowerCase()}|${record.kind}`;
    if (seenCustomerKind.has(key)) continue;
    seenIds.add(record.id);
    seenCustomerKind.add(key);
    out.push(record);
  }
  return out;
}

export function findGreetingDate(list, id) {
  const records = normalizeGreetingDateList(list);
  return records.find((record) => record.id === id) || null;
}

export function upsertGreetingDate(list, raw) {
  const records = normalizeGreetingDateList(list);
  const record = normalizeGreetingDate(raw);
  if (!record) return records;
  const existing = records.find((item) => item.id === record.id);
  // A duplicate id is never rewritten: an identical re-save leaves
  // the list unchanged, and different figures are refused outright.
  if (existing) return records;
  const clash = records.some((item) => item.customer.toLowerCase() === record.customer.toLowerCase()
    && item.kind === record.kind);
  if (clash) return records;
  return [...records, record];
}

export function removeGreetingDate(list, id) {
  return normalizeGreetingDateList(list).filter((record) => record.id !== id);
}

// Marks the greeting sent for its current occurrence, so the same
// occurrence is not repeated. Only the sent date and sent year
// change; nothing else about the record moves.
export function markGreetingSent(list, id, referenceDate) {
  const records = normalizeGreetingDateList(list);
  if (!isStrictDate(referenceDate)) return records;
  return records.map((record) => {
    if (record.id !== id) return record;
    const { occurrence } = nextOccurrence(record, referenceDate);
    return { ...record, sentDate: referenceDate, sentYear: occurrence.year };
  });
}

export function greetingForCustomer(list, customer) {
  const wanted = cleanText(customer).toLowerCase();
  if (!wanted) return [];
  return normalizeGreetingDateList(list)
    .filter((record) => record.customer.toLowerCase() === wanted)
    .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function greetingCustomers(list) {
  const firstSpelling = new Map();
  for (const record of normalizeGreetingDateList(list)) {
    const key = record.customer.toLowerCase();
    if (!firstSpelling.has(key)) firstSpelling.set(key, record.customer);
  }
  return [...firstSpelling.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

// Dates whose next occurrence falls within the next seven days
// (today included) of the reference date, nearest first, then
// customer A-Z. Already sent for that occurrence year: left off.
export function upcomingGreetings(list, referenceDate) {
  if (!isStrictDate(referenceDate)) return [];
  const out = [];
  for (const record of normalizeGreetingDateList(list)) {
    const { occurrence, daysUntil } = nextOccurrence(record, referenceDate);
    if (daysUntil < 0 || daysUntil > 7) continue;
    if (record.sentYear === occurrence.year) continue;
    out.push({ ...record, occurrenceYear: occurrence.year, daysUntil });
  }
  out.sort((a, b) => (a.daysUntil - b.daysUntil)
    || (a.customer.toLowerCase() < b.customer.toLowerCase() ? -1 : 1)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

export function greetingSummaryText(list) {
  const records = normalizeGreetingDateList(list);
  const customers = greetingCustomers(list).length;
  return `${records.length} greeting date${records.length === 1 ? '' : 's'} for ${customers} customer${customers === 1 ? '' : 's'} (birthday or connection anniversary; drafts only, nothing sent automatically).`;
}

export function greetingDraft(record, language) {
  const clean = normalizeGreetingDate(record);
  if (!clean) return '';
  if (clean.draft) return clean.draft;
  const name = clean.customer;
  if (language === 'urdu') {
    return clean.kind === 'birthday'
      ? `سالگرہ مبارک ہو، ${name}! — شاہدرہ فائبر نیٹ`
      : `کنکشن کی سالگرہ مبارک ہو، ${name}! — شاہدرہ فائبر نیٹ`;
  }
  return clean.kind === 'birthday'
    ? `Janam din mubarak ho, ${name}! — Shahdara Fiber Net`
    : `Connection anniversary mubarak ho, ${name}! — Shahdara Fiber Net`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function greetingRow(record, extra) {
  return `<tr><td>${escapeHtml(record.customer)}</td>`
    + `<td>${escapeHtml(GREETING_KIND_LABELS[record.kind])}</td>`
    + `<td>${escapeHtml(record.date)}</td>`
    + `<td>${escapeHtml(record.draft || greetingDraft(record, 'roman'))}</td>`
    + `<td>${escapeHtml(record.sentDate ? `Sent ${record.sentDate}` : 'Draft — not sent')}</td>`
    + (extra || '')
    + '</tr>';
}

function greetingTable(rows, emptyText) {
  if (rows.length === 0) return `<p>${escapeHtml(emptyText)}</p>`;
  return '<table><thead><tr><th>Customer</th><th>Kind</th><th>Date</th><th>Greeting draft</th><th>Status</th></tr></thead>'
    + `<tbody>${rows.join('')}</tbody></table>`;
}

export function greetingAllHtml(list) {
  const records = normalizeGreetingDateList(list)
    .sort((a, b) => (a.customer.toLowerCase() < b.customer.toLowerCase() ? -1 : 1)
      || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  return greetingTable(records.map((record) => greetingRow(record)), 'No greeting dates stored yet.');
}

export function greetingCustomerHtml(list, customer) {
  const records = greetingForCustomer(list, customer);
  if (!records.length) return '<p>No greeting date stored for this customer.</p>';
  return greetingTable(records.map((record) => greetingRow(record)), '');
}

export function greetingUpcomingHtml(list, referenceDate) {
  const records = upcomingGreetings(list, referenceDate);
  if (!records.length) return '<p>No greeting dates in the next seven days.</p>';
  const rows = records.map((record) => greetingRow(record,
    `<td>${record.daysUntil === 0 ? 'Today' : `In ${record.daysUntil} day${record.daysUntil === 1 ? '' : 's'}`}</td>`));
  return '<table><thead><tr><th>Customer</th><th>Kind</th><th>Date</th><th>Greeting draft</th><th>Status</th><th>When</th></tr></thead>'
    + `<tbody>${rows.join('')}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function greetingCsv(list) {
  const records = normalizeGreetingDateList(list);
  const lines = ['id,customer,kind,date,draft,sentDate,sentYear'];
  for (const record of records) {
    lines.push([record.id, record.customer, record.kind, record.date, record.draft, record.sentDate, record.sentYear ?? '']
      .map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function greetingFilename() {
  return 'greeting-dates.csv';
}
