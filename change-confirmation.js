// Plan 167 (Plan 101-202) — Service-Change Confirmation Draft.
//
// After a customer agrees to a change — a package change, a move, a
// pause — there is no written confirmation, so later the customer and
// the shop remember the change differently. This module prepares ONE
// confirmation draft per agreed service change, linked by customer id
// and change date, stating in plain words what was agreed, from when
// it applies, and what stays unchanged. The operator prepares the
// draft after the change is agreed and sends it by hand.
//
// What this module is NOT, stated plainly:
//   - It is not Plan 50's change-request queue. That queue tracks an
//     ASK before anything is agreed. This module records a draft
//     AFTER a change is agreed; it is neither read nor written here.
//   - It is not Plan 46's package-change preview. That preview prices
//     a change BEFORE it is applied. This draft confirms a change
//     already agreed; it prices nothing and previews nothing.
//   - It is not Plan 128's balance confirmation. That record
//     acknowledges a balance figure. This draft confirms a service
//     change; it carries no balance, bill, or payment figure.
//   - It never applies, alters, or reverses any package, bill,
//     payment, or status change by itself, and it never sends
//     anything automatically. Marking a draft sent only records that
//     the operator sent that draft; the change itself happened
//     elsewhere, through its own flow.
//   - It is not proof that the details are right. The draft states
//     the agreed change and its start date exactly as the operator
//     entered them; the module verifies format and ordering, not
//     truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record
//     and the module never reads storage, the clock, or the network,
//     and never touches another record.
//   - A draft with no id, no customer id, no change date, no agreed
//     change, or no applies-from date is refused outright. Unknown
//     fields are dropped, so a draft can never grow a package,
//     bill, payment, status, or sending field.
//   - A duplicate id is never rewritten: an identical re-save leaves
//     the list unchanged, and a re-save with different figures also
//     leaves the list unchanged.
//   - To change a draft the operator removes the old one and records
//     a new one. There is no edit function.

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

function cleanUnchanged(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const text = cleanText(item);
    if (text) out.push(text);
  }
  return out;
}

function sameRecord(a, b) {
  return a.id === b.id
    && a.customerId === b.customerId
    && a.changeDate === b.changeDate
    && a.agreedChange === b.agreedChange
    && a.appliesFrom === b.appliesFrom
    && a.unchanged.length === b.unchanged.length
    && a.unchanged.every((item, index) => item === b.unchanged[index])
    && a.sent === b.sent
    && a.sentDate === b.sentDate;
}

export function normalizeChangeConfirmation(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const id = cleanText(draft.id);
  const customerId = cleanText(draft.customerId);
  const agreedChange = cleanText(draft.agreedChange);
  if (!id || !customerId || !agreedChange) return null;
  if (!isStrictDate(draft.changeDate)) return null;
  if (!isStrictDate(draft.appliesFrom)) return null;
  const sent = draft.sent === true;
  let sentDate = '';
  if (draft.sentDate !== undefined && draft.sentDate !== null && draft.sentDate !== '') {
    if (!isStrictDate(draft.sentDate)) return null;
    sentDate = draft.sentDate;
  }
  return {
    id,
    customerId,
    changeDate: draft.changeDate,
    agreedChange,
    appliesFrom: draft.appliesFrom,
    unchanged: cleanUnchanged(draft.unchanged),
    sent,
    sentDate,
  };
}

export function normalizeChangeConfirmationList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenIds = new Set();
  for (const item of list) {
    const record = normalizeChangeConfirmation(item);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    seenIds.add(record.id);
    out.push(record);
  }
  return out;
}

export function findChangeConfirmation(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  for (const record of normalizeChangeConfirmationList(list)) {
    if (record.id === clean) return record;
  }
  return null;
}

export function upsertChangeConfirmation(list, draft) {
  const clean = normalizeChangeConfirmationList(list);
  const record = normalizeChangeConfirmation(draft);
  if (!record) return clean;
  const existing = clean.find((item) => item.id === record.id);
  if (existing) return clean;
  return [...clean, record];
}

export function removeChangeConfirmation(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeChangeConfirmationList(list);
  return normalizeChangeConfirmationList(list).filter((item) => item.id !== clean);
}

export function markChangeConfirmationSent(list, id, sentDate) {
  const clean = normalizeChangeConfirmationList(list);
  const target = cleanText(id);
  if (!target) return clean;
  let date = '';
  if (sentDate !== undefined && sentDate !== null && sentDate !== '') {
    if (!isStrictDate(sentDate)) return clean;
    date = sentDate;
  }
  return clean.map((item) => (item.id === target
    ? { ...item, sent: true, sentDate: date }
    : item));
}

export function markChangeConfirmationUnsent(list, id) {
  const clean = normalizeChangeConfirmationList(list);
  const target = cleanText(id);
  if (!target) return clean;
  return clean.map((item) => (item.id === target
    ? { ...item, sent: false, sentDate: '' }
    : item));
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function changeConfirmationsForCustomer(list, customerId) {
  const key = cleanKey(customerId);
  if (!key) return [];
  return normalizeChangeConfirmationList(list)
    .filter((item) => cleanKey(item.customerId) === key)
    .sort((a, b) => compareText(b.changeDate, a.changeDate) || compareText(a.id, b.id));
}

export function changeConfirmationCustomers(list) {
  const seen = new Map();
  for (const item of normalizeChangeConfirmationList(list)) {
    const key = cleanKey(item.customerId);
    if (!seen.has(key)) seen.set(key, item.customerId);
  }
  return [...seen.values()].sort(compareText);
}

export function changeConfirmationSentList(list) {
  return normalizeChangeConfirmationList(list).filter((item) => item.sent);
}

export function changeConfirmationUnsentList(list) {
  return normalizeChangeConfirmationList(list).filter((item) => !item.sent);
}

export function changeConfirmationText(record) {
  const clean = normalizeChangeConfirmation(record);
  if (!clean) return '';
  const unchanged = clean.unchanged.length > 0
    ? clean.unchanged.join('; ')
    : 'nothing listed';
  return `Agreed change for ${clean.customerId}: ${clean.agreedChange}. Applies from ${clean.appliesFrom}. Unchanged: ${unchanged}.`;
}

export function changeConfirmationSummaryText(list) {
  const clean = normalizeChangeConfirmationList(list);
  const customers = changeConfirmationCustomers(clean).length;
  const sent = clean.filter((item) => item.sent).length;
  return `${clean.length} confirmation drafts · ${customers} customers · ${sent} sent`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function changeConfirmationHtml(record) {
  const clean = normalizeChangeConfirmation(record);
  if (!clean) return '';
  const sentLabel = clean.sent
    ? `Sent${clean.sentDate ? ` on ${escapeHtml(clean.sentDate)}` : ''}`
    : 'Not sent';
  return `<div><strong>${escapeHtml(clean.customerId)}</strong> — ${escapeHtml(clean.changeDate)} — ${escapeHtml(sentLabel)}<br>${escapeHtml(changeConfirmationText(clean))}</div>`;
}

export function changeConfirmationAllHtml(list) {
  const clean = normalizeChangeConfirmationList(list);
  if (clean.length === 0) return '<p>No confirmation drafts.</p>';
  return clean.map((item) => changeConfirmationHtml(item)).join('');
}

export function changeConfirmationCustomerHtml(list, customerId) {
  const rows = changeConfirmationsForCustomer(list, customerId);
  if (rows.length === 0) return '<p>No confirmation drafts for this customer.</p>';
  return rows.map((item) => changeConfirmationHtml(item)).join('');
}

function csvCell(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function changeConfirmationCsv(list) {
  const rows = normalizeChangeConfirmationList(list).map((item) => [
    item.id,
    item.customerId,
    item.changeDate,
    item.agreedChange,
    item.appliesFrom,
    item.unchanged.join('; '),
    item.sent ? 'sent' : 'not sent',
    item.sentDate,
  ].map(csvCell).join(','));
  return ['id,customerId,changeDate,agreedChange,appliesFrom,unchanged,sent,sentDate', ...rows].join('\n');
}

export function changeConfirmationFilename() {
  return 'change-confirmations.csv';
}
