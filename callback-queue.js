// Plan 276 (Plan 203-350) — Customer-requested callback queue.
//
// Customers who ask for a call back were noted informally and
// forgotten. This module adds only the missing piece: one callback
// entry per customer request — the customer, the requested date and
// time, the reason in plain words, and the status pending, done, or
// missed.
//
// What this module is NOT, stated plainly:
//   - It is not the inbound enquiry log from Plan 76. That log
//     records enquiries of all kinds; it is neither read nor
//     rewritten here, and this module imports nothing. A callback
//     entry only queues a promised call back, nothing else.
//   - It never sends any message. Queueing a callback only records
//     the promise; nobody is called or messaged by this module.
//   - It never changes any customer, bill, or payment record.
//     This module holds no customer status, bill, or payment
//     field, so there is nothing here that could rewrite one.
//   - A callback entry is never edited, only its status moves:
//     pending to done, pending to missed, or missed back to
//     pending with a new requested time (rebooked). There is no
//     edit function. Marking done, marking missed, or rebooking
//     never rewrites the customer, the reason, or the entry id.
//   - Missed callbacks stay visible until they are done or
//     rebooked; nothing here clears a missed callback on its own.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const CALLBACK_QUEUE_STORE = 'shahdara_callback_queue_v1';
export const CALLBACK_QUEUE_FILENAME = 'callback-queue.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const STATUS_WORDS = {
  pending: 'pending',
  waiting: 'pending',
  open: 'pending',
  done: 'done',
  completed: 'done',
  finished: 'done',
  called: 'done',
  missed: 'missed',
  'no answer': 'missed',
  'no-answer': 'missed',
  unanswered: 'missed',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validCallbackQueueDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

export function validCallbackQueueTime(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function foldStatus(value) {
  const key = text(value).toLowerCase();
  if (!key) return 'pending';
  return STATUS_WORDS[key] || 'pending';
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const requestedDate = text(raw.requestedDate);
  const requestedTime = text(raw.requestedTime);
  const reason = text(raw.reason);
  if (!id || !customer || !reason) return null;
  if (!validCallbackQueueDate(requestedDate)) return null;
  if (!validCallbackQueueTime(requestedTime)) return null;
  return { id, customer, requestedDate, requestedTime, reason, status: foldStatus(raw.status) };
}

export function normalizeCallbackQueueList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordCallback(list, raw) {
  const clean = normalizeCallbackQueueList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeCallback(list, id) {
  const clean = normalizeCallbackQueueList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findCallback(list, id) {
  const clean = normalizeCallbackQueueList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

function setStatus(list, id, status) {
  const clean = normalizeCallbackQueueList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted || item.status === status) return item;
    changed = true;
    return { ...item, status };
  });
  return changed ? out : clean;
}

// Marking a callback done only moves its status; the customer, the
// requested time, and the reason are never rewritten.
export function markCallbackDone(list, id) {
  return setStatus(list, id, 'done');
}

// Marking a callback missed only moves its status; the entry stays
// visible until it is done or rebooked.
export function markCallbackMissed(list, id) {
  return setStatus(list, id, 'missed');
}

// Rebooking only moves a missed (or pending) callback to a new
// requested date and time and back to pending; the customer and the
// reason are never rewritten.
export function rebookCallback(list, id, requestedDate, requestedTime) {
  const clean = normalizeCallbackQueueList(list);
  const wanted = text(id);
  const date = text(requestedDate);
  const time = text(requestedTime);
  if (!wanted || !validCallbackQueueDate(date) || !validCallbackQueueTime(time)) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, requestedDate: date, requestedTime: time, status: 'pending' };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.requestedDate !== b.requestedDate) return a.requestedDate < b.requestedDate ? -1 : 1;
  if (a.requestedTime !== b.requestedTime) return a.requestedTime < b.requestedTime ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function callbackQueueSorted(list) {
  return normalizeCallbackQueueList(list).sort(compareEntries);
}

// The queue itself: pending callbacks only, sorted by requested
// time, so the next call to make is always first.
export function pendingCallbackQueue(list) {
  return callbackQueueSorted(list).filter((item) => item.status === 'pending');
}

// Missed callbacks stay visible until done or rebooked.
export function missedCallbacks(list) {
  return callbackQueueSorted(list).filter((item) => item.status === 'missed');
}

// Pending callbacks whose requested time is already past, against a
// caller-supplied as-of date and time. This only lists them; it
// never changes any status by itself.
export function overdueCallbacks(list, asOfDate, asOfTime) {
  const date = text(asOfDate);
  const time = text(asOfTime);
  if (!validCallbackQueueDate(date) || !validCallbackQueueTime(time)) return [];
  return pendingCallbackQueue(list).filter((item) => {
    if (item.requestedDate < date) return true;
    if (item.requestedDate > date) return false;
    return item.requestedTime < time;
  });
}

export function callbacksForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return callbackQueueSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function callbackQueueCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of callbackQueueSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

export function callbackQueueSummaryText(list) {
  const clean = normalizeCallbackQueueList(list);
  if (!clean.length) return 'No callbacks queued.';
  const pending = clean.filter((item) => item.status === 'pending').length;
  const done = clean.filter((item) => item.status === 'done').length;
  const missed = clean.filter((item) => item.status === 'missed').length;
  return `${clean.length} callback${clean.length === 1 ? '' : 's'} queued, ${pending} pending, ${done} done, ${missed} missed.`;
}

export function callbackQueueText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No callback queued.';
  return `Call ${clean.customer} on ${clean.requestedDate} at ${clean.requestedTime} (${clean.status}): ${clean.reason.replace(/\.+$/, '')}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function callbackQueueHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No callback queued.</p>';
  return `<p>${escapeHtml(callbackQueueText(entry))}</p>`;
}

export function callbackQueueAllHtml(list) {
  const sorted = callbackQueueSorted(list);
  if (!sorted.length) return '<p>No callbacks queued.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(callbackQueueText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function callbackQueueCsv(list) {
  const sorted = callbackQueueSorted(list);
  const header = ['id', 'customer', 'requested date', 'requested time', 'reason', 'status'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.requestedDate,
    item.requestedTime,
    item.reason,
    item.status,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function callbackQueueFilename() {
  return CALLBACK_QUEUE_FILENAME;
}
