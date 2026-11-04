// Plan 161 (Plan 101-202) — Complaint Acknowledgement SLA Note.
//
// A customer who complains hears nothing back at first, so a small
// complaint feels ignored even before anyone looks into it. This
// module is the written acknowledgement: one note per complaint,
// stored by customer id, with the date received, the complaint in
// the customer's own words, and a plain-words next-step note
// stating when the customer will hear back.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of any neighbouring module. No
//     existing module records a complaint acknowledgement: the
//     complaint register records complaints, the complaint
//     tickets track tickets, and the monthly complaint report
//     counts complaints — and none of them is read or written
//     here. An acknowledgement names a customer, a date, the
//     complaint text, and a fixed next-step note only.
//   - It is not an action on any other record. An
//     acknowledgement never changes any fault record, bill,
//     payment, or status, and it never sends anything by itself.
//     The draft text is for the operator to print or copy and
//     send themselves.
//   - It is not a promise of a fix date. The operator picks the
//     next-step note from a short fixed list; no free-form
//     promise of a fix date is allowed, so a free-form
//     next-step value is refused outright.
//   - It is not proof that a complaint is really resolved. The
//     record says what the operator recorded; the module
//     verifies format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, and never touches another record type.
//   - An acknowledgement with no customer id, no date received,
//     no complaint text, or no fixed next-step note is refused
//     outright, as is any impossible date. Unknown fields are
//     dropped, so a record can never grow a field from any
//     other record type.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal of the record itself.
//   - A customer with no acknowledgement says so plainly, so
//     an unacknowledged complaint is never hidden.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
function strictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  if (day < 1 || day > limit) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The short fixed list of next-step notes. Keys are what the
 * operator picks; values are the plain words the customer sees.
 * Nothing here promises a fix date — only when the customer
 * will hear back.
 */
export const COMPLAINT_ACK_NEXT_STEPS = {
  'next-working-day': 'We will update you by the next working day.',
  'within-two-days': 'We will update you within two working days.',
  'visit-arranged': 'A field visit is being arranged; we will confirm the visit time with you.',
  'under-review': 'Your complaint is under review; we will update you once it has been checked.',
};

export function complaintAckNextStepText(key) {
  return COMPLAINT_ACK_NEXT_STEPS[key] ?? '';
}

/** Normalize one acknowledgement, or null when it must be refused. */
export function normalizeComplaintAck(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customerId = cleanText(record.customerId);
  const dateReceived = strictDate(record.dateReceived);
  const complaint = cleanText(record.complaint);
  const nextStep = cleanText(record.nextStep);
  if (!id || !customerId || !dateReceived || !complaint) return null;
  if (!Object.prototype.hasOwnProperty.call(COMPLAINT_ACK_NEXT_STEPS, nextStep)) return null;
  return { id, customerId, dateReceived, complaint, nextStep };
}

export function normalizeComplaintAckList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const record = normalizeComplaintAck(item);
    if (record && !out.some((entry) => entry.id === record.id)) out.push(record);
  }
  return out;
}

export function findComplaintAck(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeComplaintAckList(list).find((item) => item.id === clean) ?? null;
}

/**
 * Add an acknowledgement. An identical re-save leaves the list
 * unchanged; a re-save with different figures is refused, so a
 * duplicate id is never rewritten.
 */
export function upsertComplaintAck(list, record) {
  const clean = normalizeComplaintAckList(list);
  const next = normalizeComplaintAck(record);
  if (!next) return clean;
  const existing = clean.find((item) => item.id === next.id);
  if (existing) return clean;
  return [...clean, next];
}

export function removeComplaintAck(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeComplaintAckList(list);
  return normalizeComplaintAckList(list).filter((item) => item.id !== clean);
}

/** Acknowledgements for one customer, newest first, then id A-Z. */
export function acknowledgementsForCustomer(list, customerId) {
  const clean = cleanText(customerId);
  if (!clean) return [];
  const lower = clean.toLowerCase();
  return normalizeComplaintAckList(list)
    .filter((item) => item.customerId.toLowerCase() === lower)
    .sort((a, b) => compareText(b.dateReceived, a.dateReceived) || compareText(a.id, b.id));
}

/** Customer ids (first spelling kept) that have an acknowledgement. */
export function acknowledgedCustomers(list) {
  const seen = new Map();
  for (const item of normalizeComplaintAckList(list)) {
    const key = item.customerId.toLowerCase();
    if (!seen.has(key)) seen.set(key, item.customerId);
  }
  return [...seen.values()].sort(compareText);
}

/**
 * Customers from a supplied list with no acknowledgement at all,
 * so an unacknowledged complaint is named, never hidden.
 */
export function unacknowledgedCustomers(customerIds, list) {
  if (!Array.isArray(customerIds)) return [];
  const known = new Set(normalizeComplaintAckList(list).map((item) => item.customerId.toLowerCase()));
  const out = [];
  for (const raw of customerIds) {
    const customer = cleanText(raw);
    if (customer && !known.has(customer.toLowerCase()) && !out.some((entry) => entry.toLowerCase() === customer.toLowerCase())) out.push(customer);
  }
  return out.sort(compareText);
}

export function complaintAckSummaryText(list) {
  const clean = normalizeComplaintAckList(list);
  const customers = acknowledgedCustomers(clean).length;
  return `${clean.length} acknowledgement${clean.length === 1 ? '' : 's'} for ${customers} customer${customers === 1 ? '' : 's'}.`;
}

/**
 * The draft the operator prints or copies and sends themselves.
 * This module never sends anything; the text is only prepared.
 */
export function complaintAckDraftText(record) {
  const item = normalizeComplaintAck(record);
  if (!item) return '';
  return `We received your complaint on ${item.dateReceived}: "${item.complaint}". ${COMPLAINT_ACK_NEXT_STEPS[item.nextStep]} — Shahdara Fiber Net.`;
}

function ackRowHtml(item) {
  return `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.customerId)}</td><td>${escapeHtml(item.dateReceived)}</td><td>${escapeHtml(item.complaint)}</td><td>${escapeHtml(COMPLAINT_ACK_NEXT_STEPS[item.nextStep])}</td><td>${escapeHtml(complaintAckDraftText(item))}</td></tr>`;
}

export function complaintAckAllHtml(list) {
  const clean = normalizeComplaintAckList(list)
    .sort((a, b) => compareText(b.dateReceived, a.dateReceived) || compareText(a.id, b.id));
  if (!clean.length) return '<p>No complaint acknowledgement recorded yet.</p>';
  return `<table><thead><tr><th>Id</th><th>Customer</th><th>Date received</th><th>Complaint</th><th>Next step</th><th>Draft to send</th></tr></thead><tbody>${clean.map(ackRowHtml).join('')}</tbody></table>`;
}

export function complaintAckCustomerHtml(list, customerId) {
  const rows = acknowledgementsForCustomer(list, customerId);
  if (!rows.length) return '<p>No acknowledgement recorded for this customer yet — this complaint is unacknowledged.</p>';
  return `<table><thead><tr><th>Id</th><th>Customer</th><th>Date received</th><th>Complaint</th><th>Next step</th><th>Draft to send</th></tr></thead><tbody>${rows.map(ackRowHtml).join('')}</tbody></table>`;
}

export function complaintAckCsv(list) {
  const rows = normalizeComplaintAckList(list);
  const lines = ['id,customerId,dateReceived,complaint,nextStep'];
  for (const item of rows) {
    lines.push([item.id, item.customerId, item.dateReceived, item.complaint, item.nextStep].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the complaint acknowledgement export. */
export function complaintAckFilename() {
  return 'complaint-acknowledgements.csv';
}
