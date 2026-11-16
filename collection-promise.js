// Plan 214 (Plan 203-350) — Collection Promise Versus Actual Tracker.
//
// Sharafat 74: amounts print through the shared formatPKR formatter
// (core.js) — "PKR 10,000", never raw "Rs 10000".
import { formatPKR } from './core.js';
//
// A customer promises "I will pay on Friday" and the promise is
// forgotten, so nobody can tell which promises were kept and which
// were not. This module records one promise per customer promise:
// customer, amount promised, date promised for, date actually paid
// (or still unpaid), and the collector who recorded it. Each promise
// shows the promised date and amount against the actual payment date
// and amount, or plainly as unkept once its date passes, and kept and
// unkept promises count per customer.
//
// What this module is NOT, stated plainly:
//   - It is not a bill extension (Plan 38). Recording a promise never
//     extends, moves, or changes any due date, bill, or payment.
//   - It is not the Waada record (SISP-3). The Waada record holds the
//     one live promise on the customer record and is auto-cleared on
//     full payment; this module keeps a separate promise history and
//     never reads or writes any Waada, bill, payment, customer, or
//     staff record. A promise recorded here changes nothing else.
//   - It is not the operator promise tracker (Plan 176). That tracker
//     covers service promises only and explicitly excludes payment
//     promises; this module covers payment promises only.
//   - It is not the collector performance view (Plan 9). That view
//     aggregates performance but keeps no per-customer promise
//     record; this module is the per-customer record itself.
//   - It never sends anything and never collects anything. The
//     collector acts on each promise by hand.
//
// How the module keeps those fences:
//   - It is pure and imports only the pure formatPKR formatter: the
//     caller supplies every record, and the module never reads
//     storage, the clock, or the network, and never mutates an input.
//     Dates compare as YYYY-MM-DD strings, so no Date object is ever
//     used. (Sharafat 74: the module used to be import-free; the
//     purity fence now pins that the import is the pure formatter
//     only — see the plan214 test.)
//   - A record with no id, no customer, no strict promised date, or
//     no positive promised amount is refused outright. Unknown
//     fields are dropped, so a record can never grow a bill,
//     payment, due-date, or customer-status field.
//   - A duplicate id is never rewritten: a re-save with different
//     figures also leaves the list unchanged. There is no edit
//     function; only recording a promise, recording its payment,
//     and removal.
//   - Recording a payment only fills the actual payment date and
//     amount of an unpaid promise. An invalid date or amount, or a
//     promise already paid, leaves the record unchanged.

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
  return String(value ?? '').trim();
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '')
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

function cleanPositiveAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function cleanPaidAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function normalizeCollectionPromise(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const promisedDate = cleanText(record.promisedDate);
  if (!id || !customer || !isStrictDate(promisedDate)) return null;
  const amountPromised = cleanPositiveAmount(record.amountPromised);
  if (amountPromised === null) return null;
  const paidDateRaw = cleanText(record.paidDate);
  const paidDate = paidDateRaw && isStrictDate(paidDateRaw) ? paidDateRaw : '';
  const amountPaid = paidDate ? cleanPaidAmount(record.amountPaid) : null;
  return {
    id,
    customer,
    amountPromised,
    promisedDate,
    paidDate,
    amountPaid,
    collector: cleanText(record.collector),
  };
}

export function normalizeCollectionPromiseList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const record = normalizeCollectionPromise(item);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

export function findCollectionPromise(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return null;
  return normalizeCollectionPromiseList(list).find((record) => record.id === wanted) || null;
}

export function recordCollectionPromise(list, record) {
  const base = normalizeCollectionPromiseList(list);
  const next = normalizeCollectionPromise(record);
  if (!next) return base;
  if (base.some((record) => record.id === next.id)) return base;
  return [...base, next];
}

export function removeCollectionPromise(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return normalizeCollectionPromiseList(list);
  return normalizeCollectionPromiseList(list).filter((record) => record.id !== wanted);
}

export function recordCollectionPromisePayment(list, id, paidDate, amountPaid) {
  const base = normalizeCollectionPromiseList(list);
  const wanted = cleanText(id);
  const date = cleanText(paidDate);
  const amount = cleanPositiveAmount(amountPaid);
  if (!wanted || !isStrictDate(date) || amount === null) return base;
  return base.map((record) => {
    if (record.id !== wanted || record.paidDate) return record;
    return { ...record, paidDate: date, amountPaid: amount };
  });
}

function byPromisedThenCustomer(a, b) {
  if (a.promisedDate !== b.promisedDate) return a.promisedDate < b.promisedDate ? -1 : 1;
  const customerA = cleanKey(a.customer);
  const customerB = cleanKey(b.customer);
  if (customerA !== customerB) return customerA < customerB ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function collectionPromisesSorted(list) {
  return normalizeCollectionPromiseList(list).sort(byPromisedThenCustomer);
}

export function collectionPromisesForCustomer(list, customerId) {
  const wanted = cleanKey(customerId);
  if (!wanted) return [];
  return collectionPromisesSorted(list).filter((record) => cleanKey(record.customer) === wanted);
}

export function collectionPromiseStatus(record, today) {
  const normalized = normalizeCollectionPromise(record);
  if (!normalized) return '';
  if (normalized.paidDate) {
    // Sharafat 65: a paid date alone no longer means kept — the amount
    // decides. A null amount (a legacy record with no amount recorded)
    // or a short payment reads as 'partial', never kept; a full payment
    // reads 'paid' on time and 'paidLate' when the paid date falls
    // after the promised date. Direct Number comparison, no rounding:
    // paisa is real, and rounding would forgive a 1-paisa shortfall.
    if (normalized.amountPaid === null || normalized.amountPaid < normalized.amountPromised) return 'partial';
    return normalized.paidDate > normalized.promisedDate ? 'paidLate' : 'paid';
  }
  const day = cleanText(today);
  if (isStrictDate(day) && day > normalized.promisedDate) return 'unkept';
  return 'open';
}

export function collectionPromiseCountsForCustomer(list, customerId, today) {
  const promises = collectionPromisesForCustomer(list, customerId);
  let kept = 0;
  let keptLate = 0;
  let partial = 0;
  let unkept = 0;
  let open = 0;
  for (const promise of promises) {
    const status = collectionPromiseStatus(promise, today);
    if (status === 'paid') kept += 1;
    else if (status === 'paidLate') keptLate += 1;
    else if (status === 'partial') partial += 1;
    else if (status === 'unkept') unkept += 1;
    else open += 1;
  }
  return { kept, keptLate, partial, unkept, open, total: promises.length };
}

export function collectionPromiseText(record, today) {
  const normalized = normalizeCollectionPromise(record);
  if (!normalized) return '';
  const promised = `${formatPKR(normalized.amountPromised)} promised by ${normalized.promisedDate}`;
  const status = collectionPromiseStatus(normalized, today);
  if (status === 'paid' || status === 'paidLate') {
    const amountPart = normalized.amountPaid !== null ? `${formatPKR(normalized.amountPaid)}` : 'amount not recorded';
    const late = normalized.paidDate > normalized.promisedDate ? ' (paid late)' : '';
    return `${normalized.customer}: ${promised} — paid on ${normalized.paidDate} (${amountPart})${late}.`;
  }
  if (status === 'partial') {
    // Sharafat 65: a short payment names its shortfall, computed from
    // the promise's own amountPaid only; a paid date with no recorded
    // amount keeps "amount not recorded" and no shortfall figure — one
    // cannot be computed, and "short by PKR NaN" must never print.
    const late = normalized.paidDate > normalized.promisedDate ? ' (paid late)' : '';
    if (normalized.amountPaid === null) {
      return `${normalized.customer}: ${promised} — paid on ${normalized.paidDate} (amount not recorded)${late}.`;
    }
    const shortfall = normalized.amountPromised - normalized.amountPaid;
    return `${normalized.customer}: ${promised} — paid on ${normalized.paidDate} (paid ${formatPKR(normalized.amountPaid)} of ${formatPKR(normalized.amountPromised)} (short by ${formatPKR(shortfall)}))${late}.`;
  }
  if (status === 'unkept') {
    return `${normalized.customer}: ${promised} — unkept, still unpaid.`;
  }
  return `${normalized.customer}: ${promised} — still open.`;
}

export function collectionPromiseSummaryText(list, today) {
  const promises = normalizeCollectionPromiseList(list);
  if (!promises.length) return 'No collection promises recorded.';
  let kept = 0;
  let keptLate = 0;
  let partial = 0;
  let unkept = 0;
  let open = 0;
  for (const promise of promises) {
    const status = collectionPromiseStatus(promise, today);
    if (status === 'paid') kept += 1;
    else if (status === 'paidLate') keptLate += 1;
    else if (status === 'partial') partial += 1;
    else if (status === 'unkept') unkept += 1;
    else open += 1;
  }
  return `${promises.length} collection promise(s): ${kept} kept, ${keptLate} kept late, ${partial} partial, ${unkept} unkept, ${open} still open.`;
}

export function collectionPromiseHtml(record, today) {
  const normalized = normalizeCollectionPromise(record);
  if (!normalized) return '';
  const status = collectionPromiseStatus(normalized, today);
  // Sharafat 65: the row names a shortfall exactly like the text twin,
  // and notes a late payment the same way — the two surfaces must never
  // disagree about the same promise.
  let paid = 'Still unpaid';
  if (normalized.paidDate) {
    const late = normalized.paidDate > normalized.promisedDate ? ' (paid late)' : '';
    if (status === 'partial' && normalized.amountPaid !== null) {
      const shortfall = normalized.amountPromised - normalized.amountPaid;
      paid = `${escapeHtml(normalized.paidDate)} (paid ${formatPKR(normalized.amountPaid)} of ${formatPKR(normalized.amountPromised)} (short by ${formatPKR(shortfall)}))${late}`;
    } else {
      paid = `${escapeHtml(normalized.paidDate)} (${normalized.amountPaid !== null ? `${formatPKR(normalized.amountPaid)}` : 'amount not recorded'})${late}`;
    }
  }
  return `<p><strong>${escapeHtml(normalized.customer)}</strong> — promised ${formatPKR(normalized.amountPromised)} by ${escapeHtml(normalized.promisedDate)}; actual: ${paid}; status: ${status}; recorded by ${normalized.collector ? escapeHtml(normalized.collector) : 'No collector noted.'}</p>`;
}

export function collectionPromiseAllHtml(list, today) {
  return collectionPromisesSorted(list).map((record) => collectionPromiseHtml(record, today)).join('');
}

export function collectionPromiseCsv(list, today) {
  const rows = [['id', 'customer', 'amount_promised', 'promised_date', 'paid_date', 'amount_paid', 'collector', 'status']];
  for (const record of collectionPromisesSorted(list)) {
    rows.push([
      record.id,
      record.customer,
      formatPKR(record.amountPromised),
      record.promisedDate,
      record.paidDate,
      record.amountPaid !== null ? formatPKR(record.amountPaid) : '',
      record.collector,
      collectionPromiseStatus(record, today),
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function collectionPromiseFilename() {
  return 'collection-promises.csv';
}
