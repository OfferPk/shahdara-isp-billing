// Plan 76 (Plan 1-100) — Inbound enquiry log and unanswered-enquiry
// queue.
//
// Questions that arrive by WhatsApp or phone — balance, history,
// package, status — are answered or missed with no record, so an
// unanswered question is discovered only when the customer asks
// again, angrier. This module is the record: one enquiry per
// question, with exactly one customer, one type, and one reply
// status, and a pending list ordered by age that the operator
// works through.
//
// The fences, stated plainly:
//   - This log records enquiries; it does not replace the fault
//     ticket log (Plan 21), the dispute case log (Plan 61), or
//     the request queue (Plan 50). An enquiry that becomes one
//     of those is linked to it by id only — the ticket, case, or
//     request itself is never read or written here, and answering
//     an enquiry never changes any bill, payment, ticket, or
//     request record by itself.
//   - Marking an enquiry answered records the reply draft used
//     (Plans 72-75) where one was sent, or "none" where the
//     answer used no draft. A referral needs the linked ticket,
//     case, or request id; a referral without one is refused.
//   - A missing date is kept as no date and sorts last in the
//     pending queue, never invented. Dates are strict YYYY-MM-DD
//     calendar dates (2026-02-30 is not a date). Inputs are never
//     mutated, and the module never reads storage, the clock, or
//     the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const ENQUIRY_TYPES = [
  'balance',
  'payment_history',
  'package_info',
  'fault_status',
  'request_status',
  'other',
];

export const ENQUIRY_TYPE_LABELS = {
  balance: 'Balance',
  payment_history: 'Payment history',
  package_info: 'Package info',
  fault_status: 'Fault status',
  request_status: 'Request status',
  other: 'Other',
};

export const ENQUIRY_STATUSES = [
  'pending',
  'answered',
  'referred_ticket',
  'referred_case',
  'referred_request',
];

export const ENQUIRY_STATUS_LABELS = {
  pending: 'Pending',
  answered: 'Answered',
  referred_ticket: 'Referred to ticket',
  referred_case: 'Referred to dispute case',
  referred_request: 'Referred to request queue',
};

// Reply drafts from Plans 72-75, recorded when one was sent to
// answer the enquiry. 'none' means the answer used no draft.
export const ENQUIRY_REPLY_DRAFTS = [
  'balance_reply',
  'payment_slip',
  'info_card',
  'status_reply',
  'none',
];

export const ENQUIRY_REPLY_DRAFT_LABELS = {
  balance_reply: 'Balance Reply',
  payment_slip: 'Payment history slip',
  info_card: 'Package info card',
  status_reply: 'Fault/request status reply',
  none: 'No draft used',
};

export const ENQUIRY_REFERRED_STATUSES = [
  'referred_ticket',
  'referred_case',
  'referred_request',
];

export const ENQUIRY_LINK_LABELS = {
  referred_ticket: 'Ticket',
  referred_case: 'Dispute case',
  referred_request: 'Request',
};

const MOHALLA_ALIASES = {
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
};

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const raw = text(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function validEnquiryDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

// Canonical mohalla key for filtering, mirroring the Plan T rule
// as the other pure modules do: a leading "Mohalla" is stripped,
// case and whitespace are folded, and the known aliases apply.
// Anything else keeps its own folded label, never rewritten.
export function enquiryMohallaKey(value) {
  const raw = text(value);
  if (!raw) return null;
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return null;
  const folded = stripped.toLowerCase().replace(/\s+/g, ' ');
  const aliased = MOHALLA_ALIASES[folded.replace(/\s+/g, '')] ?? MOHALLA_ALIASES[folded];
  if (aliased) return aliased;
  return stripped.toUpperCase();
}

function enquiryMohallaLabel(value) {
  const raw = text(value);
  if (!raw) return '';
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  return stripped;
}

// Owner 5-part fix: the mohalla cell reads in consistent Title Case,
// so a stored 'CHARYAA' and a stored 'Charyaa' read the same; the
// folded JABBIYAAA spelling reads as its canonical 'Jabbiyaa'.
// (Stored values are untouched — only the display is normalised.)
function displayMohalla(value) {
  const raw = text(value);
  if (!raw) return '';
  if (enquiryMohallaKey(value) === 'JABBIYAA') return 'Jabbiyaa';
  return raw.split(/\s+/).map((word) => {
    const chars = Array.from(word);
    if (!chars.length) return word;
    // Same rule as phase3's readableLabel: a 2–3-letter all-caps
    // word (an acronym or a short label such as 'X<Y') keeps its
    // own casing instead of being forced to Title Case.
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  }).join(' ');
}

function normalizeKey(value) {
  return text(value).toLowerCase().replace(/[\s-]+/g, '_');
}

// A half-formed enquiry is refused outright, never stored
// half-formed: it needs an id, a customer, one type from the
// list, and one status from the list. A referral status without
// a linked id is refused the same way.
export function normalizeEnquiry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  if (!id || !customerId) return null;
  const type = normalizeKey(raw.type);
  if (!ENQUIRY_TYPES.includes(type)) return null;
  const status = normalizeKey(raw.status);
  if (!ENQUIRY_STATUSES.includes(status)) return null;
  const linkedId = text(raw.linkedId ?? raw.linkId ?? raw.ticketId ?? raw.caseId ?? raw.requestId);
  if (ENQUIRY_REFERRED_STATUSES.includes(status) && !linkedId) return null;
  const draft = normalizeKey(raw.replyDraft ?? raw.draft);
  const replyDraft = ENQUIRY_REPLY_DRAFTS.includes(draft) ? draft : 'none';
  const channel = normalizeKey(raw.channel);
  const date = validEnquiryDate(raw.date ?? raw.dateAsked);
  const mohalla = enquiryMohallaLabel(raw.mohalla ?? raw.area);
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    date,
    type,
    status,
    channel: ['whatsapp', 'phone', 'other'].includes(channel) ? channel : '',
    question: text(raw.question ?? raw.note),
    replyDraft,
    linkedId: linkedId || null,
    mohalla,
    mohallaKey: enquiryMohallaKey(mohalla),
  };
}

export function normalizeEnquiryList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const row of list) {
    const entry = normalizeEnquiry(row);
    if (entry) out.push(entry);
  }
  return out;
}

export function findEnquiry(list, id) {
  const rows = normalizeEnquiryList(list);
  return rows.find((row) => row.id === text(id)) || null;
}

export function upsertEnquiry(list, row) {
  const rows = normalizeEnquiryList(list);
  const entry = normalizeEnquiry(row);
  if (!entry) return rows;
  const index = rows.findIndex((row) => row.id === entry.id);
  if (index >= 0) rows[index] = entry;
  else rows.push(entry);
  return rows;
}

export function removeEnquiry(list, id) {
  const rows = normalizeEnquiryList(list);
  return rows.filter((row) => row.id !== text(id));
}

// Marking answered records the reply draft used (Plans 72-75)
// where one was sent, or 'none' where the answer used no draft.
// Only a pending enquiry can be marked answered; answering a
// referred enquiry happens in the ticket, case, or request it
// was referred to, not here.
export function markEnquiryAnswered(list, id, replyDraft) {
  const rows = normalizeEnquiryList(list);
  const index = rows.findIndex((row) => row.id === text(id));
  if (index < 0 || rows[index].status !== 'pending') return rows;
  const draft = normalizeKey(replyDraft);
  rows[index] = {
    ...rows[index],
    status: 'answered',
    replyDraft: ENQUIRY_REPLY_DRAFTS.includes(draft) ? draft : 'none',
  };
  return rows;
}

// Referring an enquiry hands it to the ticket log, dispute case
// log, or request queue: the link id is stored, the enquiry
// leaves the pending queue, and the link stays visible on the
// record. Only a pending enquiry can be referred, and a
// referral without a linked id is refused.
export function referEnquiry(list, id, status, linkedId) {
  const rows = normalizeEnquiryList(list);
  const index = rows.findIndex((row) => row.id === text(id));
  if (index < 0 || rows[index].status !== 'pending') return rows;
  const target = normalizeKey(status);
  if (!ENQUIRY_REFERRED_STATUSES.includes(target)) return rows;
  if (!text(linkedId)) return rows;
  rows[index] = { ...rows[index], status: target, linkedId: text(linkedId) };
  return rows;
}

// Reopening returns an answered or referred enquiry to the
// pending queue. The recorded link and reply draft stay on the
// record as history, so nothing about the earlier handling is
// erased by reopening.
export function reopenEnquiry(list, id) {
  const rows = normalizeEnquiryList(list);
  const index = rows.findIndex((row) => row.id === text(id));
  if (index < 0 || rows[index].status === 'pending') return rows;
  rows[index] = { ...rows[index], status: 'pending' };
  return rows;
}

// The queue the operator works through: pending enquiries only,
// oldest first, undated last, then id A-Z. Answered and referred
// enquiries are history, never part of the pending queue.
export function pendingEnquiries(list, filters = {}) {
  const rows = normalizeEnquiryList(list).filter((row) => row.status === 'pending');
  const type = normalizeKey(filters.type);
  const mohallaKey = enquiryMohallaKey(filters.mohalla);
  const filtered = rows.filter((row) => {
    if (type && row.type !== type) return false;
    // Annual Owner Summary cleanup (2026-11-13): the filter
    // placeholder now reads "Filter by mohalla (or Unassigned)", so
    // the folded word must match the same no-mohalla rows as the
    // literal '__unassigned__' sentinel (kept for back-compat).
    // enquiryMohallaKey('Unassigned') folds to 'UNASSIGNED'; a row
    // whose mohalla literally reads 'Unassigned' keeps that key and
    // is still excluded here, as before.
    if (filters.mohalla === '__unassigned__' || enquiryMohallaKey(filters.mohalla) === 'UNASSIGNED') return row.mohallaKey === null;
    if (mohallaKey && row.mohallaKey !== mohallaKey) return false;
    return true;
  });
  filtered.sort((a, b) => {
    if (a.date && b.date) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    } else if (a.date) return -1;
    else if (b.date) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return filtered;
}

export function buildEnquirySummary(list) {
  const rows = normalizeEnquiryList(list);
  const byStatus = {};
  const byType = {};
  for (const status of ENQUIRY_STATUSES) byStatus[status] = 0;
  for (const type of ENQUIRY_TYPES) byType[type] = 0;
  for (const row of rows) {
    byStatus[row.status] += 1;
    byType[row.type] += 1;
  }
  return {
    total: rows.length,
    pending: byStatus.pending,
    answered: byStatus.answered,
    referred: byStatus.referred_ticket + byStatus.referred_case + byStatus.referred_request,
    byStatus,
    byType,
  };
}

export function enquirySummaryText(summary) {
  if (!summary) return 'No enquiries recorded yet.';
  // Annual Owner Summary cleanup (2026-11-13): at 0 the count line
  // is the summary — the old 'No enquiries recorded yet.' sentence
  // duplicated the body's empty state, so the same words appeared
  // twice. Same shape as the deposit/loan summaries.
  return `${summary.total} enquir${summary.total === 1 ? 'y' : 'ies'} recorded · ${summary.pending} pending · ${summary.answered} answered · ${summary.referred} referred to a ticket, case, or request queue.`;
}

function enquiryLinkText(row) {
  if (!row.linkedId) return '';
  const label = ENQUIRY_LINK_LABELS[row.status] || 'Linked record';
  return `${label} ${row.linkedId}`;
}

export function enquiryHtml(list) {
  const rows = normalizeEnquiryList(list);
  if (rows.length === 0) return '<p class="empty-state">No enquiries recorded yet.</p>';
  const body = rows.map((row) => {
    const link = enquiryLinkText(row);
    return `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.customerName || row.customerId)}</td><td>${escapeHtml(row.date || 'No date')}</td><td>${escapeHtml(ENQUIRY_TYPE_LABELS[row.type])}</td><td>${escapeHtml(ENQUIRY_STATUS_LABELS[row.status])}</td><td>${escapeHtml(row.channel || 'Not recorded')}</td><td>${escapeHtml(row.question || '')}</td><td>${escapeHtml(row.replyDraft === 'none' ? 'No draft used' : ENQUIRY_REPLY_DRAFT_LABELS[row.replyDraft])}</td><td>${escapeHtml(link)}</td><td>${escapeHtml(displayMohalla(row.mohalla))}</td></tr>`;
  }).join('');
  // Owner 5-part fix: the ten-column table scrolls inside its own
  // card on a phone instead of clipping the right-side controls.
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Id</th><th>Customer</th><th>Date</th><th>Type</th><th>Reply status</th><th>Channel</th><th>Question</th><th>Reply draft used</th><th>Linked record</th><th>Mohalla</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export function enquiryCsv(list) {
  const rows = normalizeEnquiryList(list);
  const header = ['id', 'customer', 'date', 'type', 'reply_status', 'channel', 'question', 'reply_draft', 'linked_record', 'mohalla'];
  const lines = rows.map((row) => [
    row.id,
    row.customerName || row.customerId,
    row.date || '',
    ENQUIRY_TYPE_LABELS[row.type],
    ENQUIRY_STATUS_LABELS[row.status],
    row.channel || '',
    row.question,
    row.replyDraft === 'none' ? '' : ENQUIRY_REPLY_DRAFT_LABELS[row.replyDraft],
    enquiryLinkText(row),
    row.mohalla,
  ].map(csvCell).join(','));
  return [header.join(','), ...lines].join('\n');
}

export function enquiryFilename() {
  return 'enquiries.csv';
}
