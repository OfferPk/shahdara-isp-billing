// Plan 206 (Plan 203-350) — Payment reminder log.
//
// Problem: reminders are sent, but which reminder went to whom,
// when, and by which channel is never recorded, so a customer can
// be reminded twice or never, and nobody can tell. This module is
// the reminder record: one record per reminder sent — the customer,
// the bill, the date, the channel, and the reminder draft used —
// so the collector stops double-reminding one customer while
// missing another, and the reminder history is visible before the
// next visit.
//
// Scope fence, stated plainly:
//   - This is the reminder LOG only. It creates no reminder draft:
//     the pre-due drafts (Plan 11, pre-due-reminders.js), the
//     escalation ladder (Plan 12), and the WhatsApp templates
//     (Plan 13, whatsapp-templates.js) are neither read nor
//     written here, and no draft is ever created, changed, or
//     derived from a reminder record. The draft reference on a
//     record is plain text the operator types, never followed
//     into a draft.
//   - It is not the stage queue's dispatch audit
//     (reminder-queue.js, shahdara_reminder_history_v1) and not
//     the pre-due send log (pre-due-reminders.js): neither store
//     is read or written here. This log covers every channel in
//     one place, including reminders sent outside any queue.
//   - It logs only and never sends anything automatically: no
//     message, WhatsApp route, or SMS is ever opened from here.
//   - It records only and never changes any bill, payment,
//     customer, or contact preference (Plan 15,
//     contact-preferences.js) by itself: a reminder record
//     carries its customer and bill as plain text references,
//     and no bill, payment, customer, or preference object is
//     ever taken in, edited, or returned.
//   - It is import-free (like bill-delivery.js): the caller
//     supplies every record, and the module never reads storage,
//     the clock, or the network, and never mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). Channels are exactly the plan's
//     catalogue: WhatsApp, SMS, in person, or phone call —
//     anything else is refused, never stored as a guess.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validReminderDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

export const REMINDER_CHANNELS = Object.freeze([
  'whatsapp',
  'sms',
  'in-person',
  'phone',
]);

export const REMINDER_CHANNEL_LABELS = Object.freeze({
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  'in-person': 'In person',
  phone: 'Phone call',
});

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Bill references match case-insensitively with collapsed whitespace,
// so a typed bill reference and a stored bill label that differ only
// in case or spacing still resolve to the same bill.
export function normalizeReminderBillKey(value) {
  const text = cleanText(value);
  if (!text) return '';
  return text.replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeReminder(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = cleanText(entry.id);
  const customerId = cleanText(entry.customerId);
  const billId = cleanText(entry.billId);
  const date = cleanText(entry.date);
  const channel = cleanText(entry.channel);
  if (!id || !customerId || !billId) return null;
  if (!validReminderDate(date)) return null;
  if (!REMINDER_CHANNELS.includes(channel)) return null;
  // The draft reference is optional: a reminder spoken in person
  // may use no written draft, and that is recorded plainly as
  // "No draft noted." rather than refused or invented.
  // Unknown fields are dropped, never carried forward.
  return { id, customerId, billId, date, channel, draftRef: cleanText(entry.draftRef) };
}

export function normalizeReminderList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const entry of list) {
    const record = normalizeReminder(entry);
    if (!record) continue;
    // A duplicate id never rewrites the first record and is
    // never stored twice. Unlike bill delivery, several
    // reminders for the same bill are expected — that is the
    // whole point of the log — so no one-record-per-bill rule
    // applies here.
    if (seenIds.has(record.id)) continue;
    seenIds.add(record.id);
    out.push(record);
  }
  return out;
}

export function recordReminder(list, entry) {
  const records = normalizeReminderList(list);
  const record = normalizeReminder(entry);
  if (!record) return records;
  if (records.some((item) => item.id === record.id)) return records;
  return [...records, record];
}

export function removeReminder(list, id) {
  const target = cleanText(id);
  if (!target) return normalizeReminderList(list);
  return normalizeReminderList(list).filter((record) => record.id !== target);
}

// Listed by date, then bill, then customer, then id — so a
// customer page shows reminders in date order.
export function remindersSorted(list) {
  return normalizeReminderList(list).sort((a, b) =>
    a.date.localeCompare(b.date)
    || a.billId.localeCompare(b.billId)
    || a.customerId.localeCompare(b.customerId)
    || a.id.localeCompare(b.id));
}

export function remindersForCustomer(list, customerId) {
  const query = cleanText(customerId).toLowerCase();
  if (!query) return remindersSorted(list);
  return remindersSorted(list).filter((record) => record.customerId.toLowerCase().includes(query));
}

export function remindersForBill(list, billId) {
  const query = normalizeReminderBillKey(billId);
  if (!query) return remindersSorted(list);
  return remindersSorted(list).filter((record) => normalizeReminderBillKey(record.billId).includes(query));
}

// How many reminders one bill has had: an exact bill-reference
// match, never a substring count, so a bill never inherits
// another bill's reminders.
export function reminderCountForBill(list, billId) {
  const key = normalizeReminderBillKey(billId);
  if (!key) return 0;
  return normalizeReminderList(list).filter(
    (record) => normalizeReminderBillKey(record.billId) === key).length;
}

export function remindersForChannel(list, channel) {
  const query = cleanText(channel);
  if (!query) return remindersSorted(list);
  return remindersSorted(list).filter((record) => record.channel === query);
}

// One line per reminder: its channel, bill, and date — or plainly
// "No draft noted." when no draft reference was recorded.
export function reminderText(record) {
  if (!record) return 'No reminder recorded.';
  const clean = normalizeReminder(record);
  if (!clean) return 'No reminder recorded.';
  const draft = clean.draftRef ? ` (draft: ${clean.draftRef})` : ' (No draft noted.)';
  return `${REMINDER_CHANNEL_LABELS[clean.channel]} reminder for bill ${clean.billId} on ${clean.date}${draft}`;
}

export function reminderSummaryText(list) {
  const records = normalizeReminderList(list);
  if (!records.length) return 'No payment reminders recorded.';
  const byChannel = {};
  for (const record of records) byChannel[record.channel] = (byChannel[record.channel] || 0) + 1;
  const parts = REMINDER_CHANNELS.filter((channel) => byChannel[channel]).map(
    (channel) => `${byChannel[channel]} ${REMINDER_CHANNEL_LABELS[channel].toLowerCase()}`);
  return `${records.length} payment ${records.length === 1 ? 'reminder' : 'reminders'} recorded (${parts.join(', ')}).`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function reminderHtml(list) {
  const records = remindersSorted(list);
  if (!records.length) return '';
  const rows = records.map((record) => `<tr><td>${escapeHtml(record.customerId)}</td><td>${escapeHtml(record.billId)}</td><td>${escapeHtml(record.date)}</td><td>${escapeHtml(REMINDER_CHANNEL_LABELS[record.channel])}</td><td>${escapeHtml(record.draftRef || 'No draft noted.')}</td><td>${escapeHtml(record.id)}</td></tr>`).join('');
  return `<table><thead><tr><th>Customer</th><th>Bill</th><th>Date</th><th>Channel</th><th>Draft used</th><th>Record id</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function reminderCsv(list) {
  const records = remindersSorted(list);
  const esc = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = ['customer,bill,date,channel,draft used,record id'];
  for (const record of records) {
    lines.push([record.customerId, record.billId, record.date, REMINDER_CHANNEL_LABELS[record.channel], record.draftRef || 'No draft noted.', record.id].map(esc).join(','));
  }
  return lines.join('\n');
}

export function reminderFilename() {
  return 'payment-reminders.csv';
}
