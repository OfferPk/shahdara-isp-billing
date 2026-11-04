// Plan 50 (Plan 1-100) — Customer-requested plan change queue.
//
// A customer who asks by phone or WhatsApp to change package, shift
// a due date, or move house is remembered by whoever took the call,
// so requests wait, duplicate, or vanish when that person is busy.
// This module is the one visible queue for those asks: one request
// per record, linked to the customer profile, with a type, a date
// requested, a status, and the operator handling it.
//
// Scope fence, stated plainly against the neighbouring systems:
//   - The queue RECORDS and TRACKS a request. It never changes a
//     record by itself: the package change itself still goes through
//     the existing change flow with its preview (Plan 46), the
//     due-date change through its own rule (Plan 36), and no queue
//     action ever alters a bill, a payment, or a package. The module
//     holds no amount, bill, payment, or package field, so there is
//     nothing here that could rewrite one. Marking a request done
//     only records the link to the change that fulfilled it — the
//     change itself happened elsewhere, through its own flow.
//   - Plan 21's ticket log keeps "relocation request" as a category
//     only. A relocation ask is tracked HERE, in this one queue,
//     not in a second relocation queue, and Plan 21 is neither read
//     nor rewritten by this module.
//   - This is not a second ticket system: a request is an ask from
//     a customer, not a fault. Faults stay in Plan 21's ticket log.
//
// How the fence is kept in this module:
//   - It is import-free: the caller supplies every request and every
//     customer row, and the module never reads storage, the clock,
//     or the network, and never mutates an input.
//   - A request without a customer, without an id, or with a type
//     outside the four in the plan is not a request: normalisation
//     returns null instead of inventing a customer or a type. An
//     impossible requested date (2026-02-30) is refused outright,
//     never stored as a neighbouring date; a blank date becomes
//     null ("date not recorded") and sorts last, never a guessed
//     date.
//   - Declining requires a reason: a declined record without one is
//     refused with the list unchanged, at normalisation and at the
//     status change alike, so a refusal can never slip in silently.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const CHANGE_REQUEST_TYPES = [
  'package_change',
  'due_date_change',
  'relocation',
  'other',
];

export const CHANGE_REQUEST_TYPE_LABELS = {
  package_change: 'Package change',
  due_date_change: 'Due-date change',
  relocation: 'Relocation',
  other: 'Other',
};

export const CHANGE_REQUEST_STATUSES = [
  'pending',
  'in_progress',
  'done',
  'declined',
];

export const CHANGE_REQUEST_STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Done',
  declined: 'Declined',
};

// Open statuses: work still waiting, in the order the queue shows.
// Done and declined are history, never part of the waiting queue.
export const CHANGE_REQUEST_OPEN_STATUSES = ['pending', 'in_progress'];

// Allowed status moves. Done and declined are terminal: once a
// request is settled it stays settled, and its history is not
// rewritten by moving it back into the queue.
const ALLOWED_MOVES = {
  pending: ['in_progress', 'done', 'declined'],
  in_progress: ['pending', 'done', 'declined'],
  done: [],
  declined: [],
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
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
  const str = String(value ?? '');
  return /[\",\n]/.test(str) ? `\"${str.replace(/\"/g, '\"\"')}\"` : str;
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
export function validChangeRequestDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

// One change request, normalised, or null when it is not a request:
// no id, no customer, a type outside the four in the plan, a status
// outside the four, an impossible requested date, or a declined
// record without a reason. Blank detail, handler, link, and reason
// (for non-declined records) become null, never invented text;
// a blank requested date becomes null, never a guessed date.
export function normalizeChangeRequest(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  if (!id) return null;
  const customerId = text(entry.customerId);
  if (!customerId) return null;
  const type = text(entry.type);
  if (!CHANGE_REQUEST_TYPES.includes(type)) return null;
  const statusRaw = text(entry.status);
  const status = statusRaw === '' ? 'pending' : statusRaw;
  if (!CHANGE_REQUEST_STATUSES.includes(status)) return null;
  const dateRequestedRaw = text(entry.dateRequested);
  const dateRequested = dateRequestedRaw === ''
    ? null
    : validChangeRequestDate(dateRequestedRaw);
  if (dateRequestedRaw !== '' && dateRequested === null) return null;
  const declineReason = text(entry.declineReason) || null;
  if (status === 'declined' && !declineReason) return null;
  return {
    id,
    customerId,
    customerName: text(entry.customerName) || null,
    type,
    detail: text(entry.detail) || null,
    dateRequested,
    status,
    handler: text(entry.handler) || null,
    fulfilledBy: text(entry.fulfilledBy) || null,
    declineReason: status === 'declined' ? declineReason : null,
  };
}

export function normalizeChangeRequestList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const row = normalizeChangeRequest(entry);
    if (row) out.push(row);
  }
  return out;
}

export function findChangeRequest(list, id) {
  const rows = normalizeChangeRequestList(list);
  return rows.find((row) => row.id === text(id)) || null;
}

// Upsert by id: a second record with the same id replaces the
// first, so one id can never carry two requests at once. Invalid
// records leave the list unchanged.
export function upsertChangeRequest(list, entry) {
  const rows = normalizeChangeRequestList(list);
  const row = normalizeChangeRequest(entry);
  if (!row) return rows;
  const idx = rows.findIndex((item) => item.id === row.id);
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  return rows;
}

export function removeChangeRequest(list, id) {
  return normalizeChangeRequestList(list)
    .filter((row) => row.id !== text(id));
}

// Move one request to a new status. Returns the new list plus
// whether the move applied and, when it did not, a plain refusal:
// 'not-found', 'invalid-status', 'same-status',
// 'illegal-transition', or 'decline-needs-reason'. A refused move
// leaves the list unchanged. Marking done records the link to the
// change that fulfilled it when the caller supplies one; declining
// records the reason, which is required.
export function setChangeRequestStatus(list, id, status, options = {}) {
  const rows = normalizeChangeRequestList(list);
  const target = text(status);
  if (!CHANGE_REQUEST_STATUSES.includes(target)) {
    return { requests: rows, applied: false, refusal: 'invalid-status' };
  }
  const idx = rows.findIndex((row) => row.id === text(id));
  if (idx < 0) return { requests: rows, applied: false, refusal: 'not-found' };
  const current = rows[idx];
  if (current.status === target) {
    return { requests: rows, applied: false, refusal: 'same-status' };
  }
  if (!ALLOWED_MOVES[current.status].includes(target)) {
    return { requests: rows, applied: false, refusal: 'illegal-transition' };
  }
  const declineReason = text(options?.declineReason) || null;
  if (target === 'declined' && !declineReason) {
    return { requests: rows, applied: false, refusal: 'decline-needs-reason' };
  }
  const next = { ...current, status: target };
  if (target === 'declined') {
    next.declineReason = declineReason;
    next.fulfilledBy = null;
  } else {
    next.declineReason = null;
    if (target === 'done') {
      const link = text(options?.fulfilledBy);
      if (link) next.fulfilledBy = link;
    }
  }
  rows[idx] = next;
  return { requests: rows, applied: true, refusal: null };
}

// The mohalla label of a request's customer, from the caller-supplied
// customer rows (mohalla, else area, else blank). Never guessed.
export function changeRequestMohallaOf(request, customers = []) {
  if (!request) return '';
  const rows = Array.isArray(customers) ? customers : [];
  const customer = rows.find((c) => String(c?.id) === String(request.customerId));
  if (!customer) return '';
  return text(customer.mohalla ?? customer.area ?? '');
}

function mohallaKey(label) {
  const raw = text(label).toLowerCase();
  return raw.startsWith('mohalla ') ? raw.slice('mohalla '.length).trim() : raw;
}

// Filter a list by type, status, and mohalla. A blank filter means
// "all". The mohalla filter matches the customer's label
// case-insensitively ("Bani" matches "bani" and "Mohalla Bani");
// the special value '__unassigned__' matches customers with no
// mohalla recorded, who are never dropped from the list.
export function filterChangeRequests(list, filters = {}) {
  const rows = normalizeChangeRequestList(list);
  const type = text(filters?.type);
  const status = text(filters?.status);
  const mohalla = text(filters?.mohalla);
  const customers = Array.isArray(filters?.customers) ? filters.customers : [];
  return rows.filter((row) => {
    if (type && row.type !== type) return false;
    if (status && row.status !== status) return false;
    if (mohalla) {
      const label = changeRequestMohallaOf(row, customers);
      if (mohalla === '__unassigned__') {
        if (label) return false;
      } else if (mohallaKey(label) !== mohallaKey(mohalla)) return false;
    }
    return true;
  });
}

// Sort for the queue: oldest requested date first, undated last,
// then customer name A–Z (id when no name), then id. Inputs are
// never mutated.
export function sortChangeRequests(list) {
  const rows = normalizeChangeRequestList(list);
  return rows.slice().sort((a, b) => {
    if (a.dateRequested && b.dateRequested && a.dateRequested !== b.dateRequested) {
      return a.dateRequested < b.dateRequested ? -1 : 1;
    }
    if (a.dateRequested && !b.dateRequested) return -1;
    if (!a.dateRequested && b.dateRequested) return 1;
    const nameA = (a.customerName || a.customerId).toLowerCase();
    const nameB = (b.customerName || b.customerId).toLowerCase();
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// The waiting queue: open requests (pending or in progress) only,
// filtered by type and mohalla, in queue order. Done and declined
// requests are history and never appear here.
export function changeRequestQueue(list, filters = {}) {
  const open = normalizeChangeRequestList(list)
    .filter((row) => CHANGE_REQUEST_OPEN_STATUSES.includes(row.status));
  return sortChangeRequests(filterChangeRequests(open, filters));
}

export function changeRequestSummaryText(list, customers = []) {
  const rows = normalizeChangeRequestList(list);
  const queue = changeRequestQueue(rows, { customers });
  const pending = rows.filter((r) => r.status === 'pending').length;
  const inProgress = rows.filter((r) => r.status === 'in_progress').length;
  const done = rows.filter((r) => r.status === 'done').length;
  const declined = rows.filter((r) => r.status === 'declined').length;
  return `${rows.length} request${rows.length === 1 ? '' : 's'} recorded; `
    + `${queue.length} waiting (${pending} pending, ${inProgress} in progress), `
    + `${done} done, ${declined} declined.`;
}

export function changeRequestsHtml(list, options = {}) {
  const rows = sortChangeRequests(list);
  const names = options?.names ?? {};
  const customers = Array.isArray(options?.customers) ? options.customers : [];
  if (rows.length === 0) return '<p style="font-size: 12px;">No change requests recorded yet.</p>';
  const body = rows.map((row) => {
    const name = names[row.customerId] || row.customerName || row.customerId;
    const mohalla = changeRequestMohallaOf(row, customers);
    const extra = row.status === 'declined'
      ? `Reason: ${escapeHtml(row.declineReason)}`
      : row.status === 'done' && row.fulfilledBy
        ? `Fulfilled by: ${escapeHtml(row.fulfilledBy)}`
        : row.detail ? escapeHtml(row.detail) : '—';
    return `<tr><td>${escapeHtml(row.dateRequested || 'Date not recorded')}</td>`
      + `<td>${escapeHtml(name)}</td>`
      + `<td>${escapeHtml(mohalla || 'Unassigned')}</td>`
      + `<td>${escapeHtml(CHANGE_REQUEST_TYPE_LABELS[row.type])}</td>`
      + `<td>${escapeHtml(CHANGE_REQUEST_STATUS_LABELS[row.status])}</td>`
      + `<td>${escapeHtml(row.handler || 'Not recorded')}</td>`
      + `<td>${extra}</td></tr>`;
  }).join('');
  return '<table style="font-size: 12px;"><thead><tr>'
    + '<th>Date requested</th><th>Customer</th><th>Mohalla</th><th>Type</th>'
    + '<th>Status</th><th>Handler</th><th>Detail</th></tr></thead>'
    + `<tbody>${body}</tbody></table>`;
}

export function changeRequestsCsv(list, options = {}) {
  const rows = sortChangeRequests(list);
  const names = options?.names ?? {};
  const customers = Array.isArray(options?.customers) ? options.customers : [];
  const header = 'id,customer_id,customer_name,mohalla,type,date_requested,status,handler,detail,fulfilled_by,decline_reason';
  const body = rows.map((row) => [
    row.id,
    row.customerId,
    names[row.customerId] || row.customerName || '',
    changeRequestMohallaOf(row, customers),
    row.type,
    row.dateRequested || '',
    row.status,
    row.handler || '',
    row.detail || '',
    row.fulfilledBy || '',
    row.declineReason || '',
  ].map(csvCell).join(','));
  return [header, ...body].join('\n');
}

export function changeRequestFilename(date) {
  const safe = validChangeRequestDate(date) ? date : 'requests';
  return `change-requests-${safe}.csv`;
}
