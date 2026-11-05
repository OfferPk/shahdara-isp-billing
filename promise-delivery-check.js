// Plan 260 (Plan 203-350) — Service promise delivery check.
//
// A promise made to a customer (a visit date, a fix, a package
// change) is tracked as a commitment, but nobody verifies afterwards
// whether it was actually delivered as promised. This module adds
// only the missing piece: one delivery check per promise — the
// promise link, what was promised, what was delivered, the delivered
// date, and met / partly met / missed.
//
// What this module is NOT, stated plainly:
//   - It is not the operator promise tracker. That tracker records
//     commitments — customer, the promise in plain words, the date
//     it was promised by, and a done / still open state — and it is
//     neither read nor rewritten here. This module only verifies
//     delivery afterwards, and it imports nothing.
//   - It never changes a promise. Recording a check never changes
//     the promise record, any customer record, any bill, or any
//     payment. This module holds no promise status, bill, or
//     payment field, so there is nothing here that could rewrite
//     one.
//   - Each checked promise shows promised versus delivered side by
//     side, and missed promises appear on one list sorted by
//     promise date.
//   - A check is never edited, only annotated. There is no edit
//     function: only record, annotate, and remove. A dated
//     follow-up never rewrites the promise link, what was promised,
//     what was delivered, the delivered date, the outcome, or the
//     note.
//   - One check per promise: a second check for the same promise
//     reference is refused.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A record with no id, no promise reference, no customer, no
//     strict promise date, no promised text, no delivered text,
//     no strict delivered date, no clear outcome, or no note is
//     refused outright. Unknown fields are dropped, so a record
//     can never grow a promise-status, bill, payment, or sending
//     field.
//   - A duplicate id is never rewritten, and a second check for
//     the same promise reference is refused.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const OUTCOMES = ['met', 'partly met', 'missed'];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validPromiseDeliveryCheckDate(value) {
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

function cleanOutcome(raw) {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim().toLowerCase();
  if (OUTCOMES.includes(value)) return value;
  return undefined;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validPromiseDeliveryCheckDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const promiseRef = text(raw.promiseRef);
  const customer = text(raw.customer);
  const promiseDate = text(raw.promiseDate);
  const promised = text(raw.promised);
  const delivered = text(raw.delivered);
  const deliveredDate = text(raw.deliveredDate);
  const note = text(raw.note);
  if (!id || !promiseRef || !customer || !promised || !delivered || !note) return null;
  if (!validPromiseDeliveryCheckDate(promiseDate)) return null;
  if (!validPromiseDeliveryCheckDate(deliveredDate)) return null;
  const outcome = cleanOutcome(raw.outcome);
  if (outcome === undefined) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, promiseRef, customer, promiseDate, promised, delivered, deliveredDate, outcome, note, followups };
}

export function normalizePromiseDeliveryCheckList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenPromises = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    const key = entry.promiseRef.toLowerCase();
    if (seenPromises.has(key)) continue;
    seenIds.add(entry.id);
    seenPromises.add(key);
    out.push(entry);
  }
  return out;
}

export function recordPromiseDeliveryCheck(list, raw) {
  const clean = normalizePromiseDeliveryCheckList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.promiseRef.toLowerCase() === entry.promiseRef.toLowerCase())) return clean;
  return [...clean, entry];
}

export function removePromiseDeliveryCheck(list, id) {
  const clean = normalizePromiseDeliveryCheckList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findPromiseDeliveryCheck(list, id) {
  const clean = normalizePromiseDeliveryCheckList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addPromiseDeliveryCheckNote(list, id, date, note) {
  const clean = normalizePromiseDeliveryCheckList(list);
  const wanted = text(id);
  const followup = cleanFollowup({ date, note });
  if (!wanted || !followup) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, followups: [...item.followups, followup] };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.promiseDate !== b.promiseDate) return a.promiseDate < b.promiseDate ? -1 : 1;
  if (a.promiseRef !== b.promiseRef) return a.promiseRef < b.promiseRef ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function promiseDeliveryCheckSorted(list) {
  return normalizePromiseDeliveryCheckList(list).sort(compareEntries);
}

export function checksForPromise(list, promiseRef) {
  const wanted = text(promiseRef).toLowerCase();
  if (!wanted) return [];
  return promiseDeliveryCheckSorted(list).filter((item) => item.promiseRef.toLowerCase() === wanted);
}

export function checksForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return promiseDeliveryCheckSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function promiseDeliveryCheckCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of promiseDeliveryCheckSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

// Missed promises appear on one list, sorted by promise date —
// the oldest promise first, so the owner apologises and fixes
// before trust is lost.
export function missedPromiseDeliveryChecks(list) {
  return promiseDeliveryCheckSorted(list).filter((item) => item.outcome === 'missed');
}

export function promiseDeliveryCheckSummaryText(list) {
  const clean = normalizePromiseDeliveryCheckList(list);
  if (!clean.length) return 'No promise delivery checks recorded.';
  const met = clean.filter((item) => item.outcome === 'met').length;
  const partly = clean.filter((item) => item.outcome === 'partly met').length;
  const missed = clean.filter((item) => item.outcome === 'missed').length;
  return `${clean.length} promise delivery check${clean.length === 1 ? '' : 's'}: ${met} met, ${partly} partly met, ${missed} missed.`;
}

export function promiseDeliveryCheckText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No promise delivery check recorded.';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Promise ${clean.promiseRef} for ${clean.customer} (promised ${clean.promiseDate}): promised \u201c${clean.promised.replace(/\.+$/, '')}\u201d — delivered \u201c${clean.delivered.replace(/\.+$/, '')}\u201d on ${clean.deliveredDate}: ${clean.outcome}. ${clean.note.replace(/\.+$/, '')}.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function promiseDeliveryCheckHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No promise delivery check recorded.</p>';
  const notes = clean.followups.length
    ? `<br>Follow-ups: ${escapeHtml(clean.followups.map((f) => `${f.date}: ${f.note}`).join('; '))}`
    : '';
  return `<p>Promise <strong>${escapeHtml(clean.promiseRef)}</strong> for ${escapeHtml(clean.customer)} (promised ${escapeHtml(clean.promiseDate)}): promised \u201c${escapeHtml(clean.promised.replace(/\.+$/, ''))}\u201d — delivered \u201c${escapeHtml(clean.delivered.replace(/\.+$/, ''))}\u201d on ${escapeHtml(clean.deliveredDate)}: ${clean.outcome}. ${escapeHtml(clean.note.replace(/\.+$/, ''))}.${notes}</p>`;
}

export function promiseDeliveryCheckAllHtml(list) {
  const sorted = promiseDeliveryCheckSorted(list);
  if (!sorted.length) return '<p>No promise delivery checks recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(promiseDeliveryCheckText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function promiseDeliveryCheckCsv(list) {
  const sorted = promiseDeliveryCheckSorted(list);
  const header = ['id', 'promise reference', 'customer', 'promise date', 'promised', 'delivered', 'delivered date', 'outcome', 'note', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.promiseRef,
    item.customer,
    item.promiseDate,
    item.promised,
    item.delivered,
    item.deliveredDate,
    item.outcome,
    item.note,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function promiseDeliveryCheckFilename() {
  return 'promise-delivery-checks.csv';
}
