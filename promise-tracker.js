// Plan 176 (Plan 101-202) — Operator Promise and Commitment Tracker.
//
// The operator promises a customer something — a call back by
// Friday, a visit next week, an answer about a package — and the
// promise lives only in memory, so it is forgotten and trust is
// lost. This module records one commitment per promise: customer
// id, the promise in plain words, the date it was promised by,
// and a done / still open state.
//
// What this module is NOT, stated plainly:
//   - It is not a Waada record. Payment promises remain under the
//     existing Waada record and are never duplicated here: this
//     tracker covers service promises only, and it never reads
//     or writes any Waada record.
//   - It is not a bill, payment, fault, or customer-status
//     record. Marking a commitment done or withdrawing it never
//     changes any Waada, bill, payment, fault, or customer
//     status, and this module never reads or writes one.
//   - It never sends anything. There is no message, no call, and
//     no notification of any kind. The operator acts on each
//     commitment by hand.
//   - An overdue commitment is never hidden. It stays visible
//     until the operator marks it done or withdraws it.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A record with no id, no customer, no promise, or no
//     strict promised-by date is refused outright. Unknown
//     fields are dropped, so a record can never grow a Waada,
//     bill, payment, fault, status, or sending field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures also leaves the list unchanged. There is no edit
//     function; only marking done, withdrawing, and removal.
//   - Marking done records only the completion date, and only
//     from the open state with a strict date. An invalid
//     completion date leaves the record unchanged.

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

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
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

function cleanStatus(value) {
  const key = cleanKey(value);
  if (key === 'done') return 'done';
  if (key === 'withdrawn') return 'withdrawn';
  return 'open';
}

export function normalizePromise(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const id = cleanText(record.id);
  const customerId = cleanText(record.customerId);
  const promise = cleanText(record.promise);
  const dueDate = cleanText(record.dueDate);
  if (!id || !customerId || !promise || !dueDate) return null;
  if (!isStrictDate(dueDate)) return null;
  const status = cleanStatus(record.status);
  let completionDate = '';
  if (record.completionDate !== undefined && record.completionDate !== null && record.completionDate !== '') {
    if (!isStrictDate(record.completionDate)) return null;
    completionDate = record.completionDate;
  }
  return { id, customerId, promise, dueDate, status, completionDate };
}

export function normalizePromiseList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenIds = new Set();
  for (const item of list) {
    const record = normalizePromise(item);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    seenIds.add(record.id);
    out.push(record);
  }
  return out;
}

export function findPromise(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  for (const record of normalizePromiseList(list)) {
    if (record.id === clean) return record;
  }
  return null;
}

export function upsertPromise(list, record) {
  const clean = normalizePromiseList(list);
  const next = normalizePromise(record);
  if (!next) return clean;
  if (clean.some((item) => item.id === next.id)) return clean;
  return [...clean, next];
}

export function removePromise(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizePromiseList(list);
  return normalizePromiseList(list).filter((item) => item.id !== clean);
}

export function markPromiseDone(list, id, completionDate) {
  const clean = cleanText(id);
  const date = cleanText(completionDate);
  const records = normalizePromiseList(list);
  if (!clean || !isStrictDate(date)) return records;
  return records.map((item) => {
    if (item.id !== clean || item.status !== 'open') return item;
    return { ...item, status: 'done', completionDate: date };
  });
}

export function markPromiseWithdrawn(list, id) {
  const clean = cleanText(id);
  const records = normalizePromiseList(list);
  if (!clean) return records;
  return records.map((item) => {
    if (item.id !== clean || item.status !== 'open') return item;
    return { ...item, status: 'withdrawn' };
  });
}

function byDueThenCustomer(a, b) {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  const ka = cleanKey(a.customerId);
  const kb = cleanKey(b.customerId);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function openPromises(list) {
  return normalizePromiseList(list)
    .filter((item) => item.status === 'open')
    .sort(byDueThenCustomer);
}

export function overduePromises(list, today) {
  const day = cleanText(today);
  if (!isStrictDate(day)) return [];
  return openPromises(list).filter((item) => item.dueDate < day);
}

export function donePromises(list) {
  return normalizePromiseList(list)
    .filter((item) => item.status === 'done')
    .sort(byDueThenCustomer);
}

export function withdrawnPromises(list) {
  return normalizePromiseList(list)
    .filter((item) => item.status === 'withdrawn')
    .sort(byDueThenCustomer);
}

export function promisesForCustomer(list, customerId) {
  const key = cleanKey(customerId);
  if (!key) return [];
  return normalizePromiseList(list)
    .filter((item) => cleanKey(item.customerId) === key)
    .sort(byDueThenCustomer);
}

export function promiseCustomers(list) {
  const seen = new Map();
  for (const item of normalizePromiseList(list)) {
    const key = cleanKey(item.customerId);
    if (!seen.has(key)) seen.set(key, item.customerId);
  }
  return [...seen.values()].sort((a, b) => {
    const ka = cleanKey(a);
    const kb = cleanKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

export function promiseText(record) {
  const item = normalizePromise(record);
  if (!item) return '';
  const state = item.status === 'done'
    ? ` Done on ${item.completionDate || 'an unrecorded date'}.`
    : item.status === 'withdrawn' ? ' Withdrawn by the operator.' : ' Still open.';
  return `Promise to ${item.customerId}: ${item.promise} — promised by ${item.dueDate}.${state}`;
}

export function promiseSummaryText(list) {
  const records = normalizePromiseList(list);
  const open = records.filter((item) => item.status === 'open').length;
  const done = records.filter((item) => item.status === 'done').length;
  const withdrawn = records.filter((item) => item.status === 'withdrawn').length;
  return `${records.length} commitments: ${open} open, ${done} done, ${withdrawn} withdrawn.`;
}

export function promiseHtml(record) {
  const item = normalizePromise(record);
  if (!item) return '';
  return `<div class="promise-row"><strong>${escapeHtml(item.customerId)}</strong> — ${escapeHtml(item.promise)}`
    + ` <span>promised by ${escapeHtml(item.dueDate)}</span>`
    + ` <span>(${escapeHtml(item.status)}${item.completionDate ? `, completed ${escapeHtml(item.completionDate)}` : ''})</span></div>`;
}

export function promiseAllHtml(list) {
  const records = normalizePromiseList(list).sort(byDueThenCustomer);
  if (!records.length) return '<p>No commitments recorded.</p>';
  return records.map(promiseHtml).join('');
}

export function promiseOpenHtml(list) {
  const records = openPromises(list);
  if (!records.length) return '<p>No open commitments.</p>';
  return records.map(promiseHtml).join('');
}

export function promiseCsv(list) {
  const header = 'id,customerId,promise,dueDate,status,completionDate';
  const rows = normalizePromiseList(list).sort(byDueThenCustomer).map((item) =>
    [item.id, item.customerId, item.promise, item.dueDate, item.status, item.completionDate]
      .map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function promiseFilename() {
  return 'promise-tracker.csv';
}
