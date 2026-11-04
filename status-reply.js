// Plan 75 (Plan 1-100) — Open fault and request status reply draft
// (customer asked, operator sends).
//
// A customer chasing an open fault or request hears "ho jayega"
// with no date, ticket, or next step, so they chase again — and
// the operator answers the same question twice. This module is
// the same-shaped answer every time: a bilingual status reply
// draft composed from the existing ticket (Plan 21), outage
// grouping (Plan 22), or request queue (Plan 50) — what was
// reported or requested, its current status, and the next step
// with a date where one is recorded.
//
// The fences, stated plainly:
//   - Drafting or sending never changes any ticket or request
//     record. The module holds no ticket, outage, or request
//     field of its own: the figures it prints are caller-supplied,
//     carried verbatim, and never written back anywhere. Sending
//     is by the operator through the existing WhatsApp route
//     only; nothing here sends anything on its own, and every
//     send is logged.
//   - Resolved and closed tickets are history, never part of
//     this draft: this plan never replaces the post-resolution
//     confirmation (Plan 25), which covers resolved tickets
//     only. A customer with no open ticket or request gets a
//     plain "no open case" wording, never an invented status.
//   - A missing date, assignee, handler, or next step is said
//     plainly ("not recorded" / "waiting"), never invented.
//     Dates are strict YYYY-MM-DD calendar dates (2026-02-30
//     is not a date). Inputs are never mutated, and the module
//     never reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const STATUS_REPLY_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

export const STATUS_REPLY_TICKET_OPEN_STATUSES = Object.freeze([
  'open',
  'assigned',
  'in_progress',
]);

export const STATUS_REPLY_TICKET_STATUS_LABELS = Object.freeze({
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
});

export const STATUS_REPLY_TICKET_CATEGORY_LABELS = Object.freeze({
  no_connection: 'No connection',
  slow_speed: 'Slow speed',
  billing_query: 'Billing query',
  device_fault: 'Device fault',
  relocation_request: 'Relocation request',
});

export const STATUS_REPLY_REQUEST_OPEN_STATUSES = Object.freeze([
  'pending',
  'in_progress',
]);

export const STATUS_REPLY_REQUEST_TYPE_LABELS = Object.freeze({
  package_change: 'Package change',
  due_date_change: 'Due-date change',
  relocation: 'Relocation',
  other: 'Other',
});

export const STATUS_REPLY_REQUEST_STATUS_LABELS = Object.freeze({
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Done',
  declined: 'Declined',
});

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
export function validStatusReplyDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

export function normalizeStatusReplyVariant(value) {
  return text(value) === STATUS_REPLY_VARIANTS.URDU
    ? STATUS_REPLY_VARIANTS.URDU
    : STATUS_REPLY_VARIANTS.ROMAN;
}

// One open ticket, normalised, or null when it is not an open
// ticket for this customer: a ticket for another customer, a
// resolved or closed ticket, or a row with no customer. The
// returned object is fresh; the input is never mutated.
function normalizeOpenTicket(entry, customerId) {
  if (!entry || typeof entry !== 'object') return null;
  if (text(entry.customerId) !== customerId) return null;
  const status = text(entry.status);
  if (!STATUS_REPLY_TICKET_OPEN_STATUSES.includes(status)) return null;
  const category = text(entry.category);
  return {
    kind: 'ticket',
    id: text(entry.id),
    category,
    categoryLabel: STATUS_REPLY_TICKET_CATEGORY_LABELS[category] || category || 'Fault ticket',
    priority: text(entry.priority),
    status,
    statusLabel: STATUS_REPLY_TICKET_STATUS_LABELS[status] || status,
    reportedDate: validStatusReplyDate(entry.reportedDate),
    assignee: text(entry.assignee) || null,
    note: text(entry.note) || null,
    mohalla: text(entry.mohalla) || null,
  };
}

// The open outage a ticket currently belongs to, or null. Only an
// open outage (open or in progress) whose ticket list names this
// ticket counts; a ticket linked only to resolved outages belongs
// to no open outage.
function openOutageForTicket(outages, ticketId) {
  const wanted = text(ticketId);
  if (!wanted || !Array.isArray(outages)) return null;
  for (const entry of outages) {
    if (!entry || typeof entry !== 'object') continue;
    const status = text(entry.status);
    if (status !== 'open' && status !== 'in_progress') continue;
    const ids = Array.isArray(entry.ticketIds) ? entry.ticketIds.map(text) : [];
    if (!ids.includes(wanted)) continue;
    return {
      id: text(entry.id),
      area: text(entry.area),
      segment: text(entry.segment) || null,
      startTime: text(entry.startTime) || null,
      causeNote: text(entry.causeNote) || null,
      status,
    };
  }
  return null;
}

// One open request, normalised, or null when it is not an open
// request for this customer: a request for another customer, a
// done or declined request, or a row with no customer.
function normalizeOpenRequest(entry, customerId) {
  if (!entry || typeof entry !== 'object') return null;
  if (text(entry.customerId) !== customerId) return null;
  const status = text(entry.status);
  if (!STATUS_REPLY_REQUEST_OPEN_STATUSES.includes(status)) return null;
  const type = text(entry.type);
  return {
    kind: 'request',
    id: text(entry.id),
    type,
    typeLabel: STATUS_REPLY_REQUEST_TYPE_LABELS[type] || type || 'Request',
    status,
    statusLabel: STATUS_REPLY_REQUEST_STATUS_LABELS[status] || status,
    detail: text(entry.detail) || null,
    dateRequested: validStatusReplyDate(entry.dateRequested),
    handler: text(entry.handler) || null,
  };
}

// The next step for one open item, in plain words, from recorded
// fields only. Nothing is promised: an unassigned ticket waits
// for assignment, a request without a handler waits in the queue.
function nextStepFor(item) {
  if (item.kind === 'ticket') {
    if (item.outage) {
      const area = item.outage.segment
        ? `${item.outage.area} (${item.outage.segment})`
        : item.outage.area;
      return `Part of the open outage in ${area || 'your area'} — the team is working on that fault`;
    }
    if (item.assignee) return `Assigned to ${item.assignee}`;
    return 'Waiting for assignment';
  }
  if (item.handler) return `Being handled by ${item.handler}`;
  return 'Waiting in the queue';
}

function buildStatusReplyText(reply) {
  const name = reply.customerName || reply.customerId;
  if (reply.kind === 'none') {
    if (reply.variant === STATUS_REPLY_VARIANTS.URDU) {
      return [
        `السلام علیکم ${name}،`,
        'آپ کا کوئی کھلا کیس نہیں ہے — نہ کوئی کھلی شکایت اور نہ کوئی زیر التواء درخواست۔',
        'اگر کوئی نیا مسئلہ ہو تو براہ کرم ہمیں بتائیں۔',
        'شکریہ — شاہدرہ فائبر نیٹ',
      ].join('\n');
    }
    return [
      `Assalam-o-Alaikum ${name},`,
      'Aap ka koi open case nahi hai — na koi khuli shikayat aur na koi pending request.',
      'Agar koi naya masla ho to please humein batayein.',
      'Shukriya — Shahdara Fiber Net',
    ].join('\n');
  }
  const lines = [];
  if (reply.variant === STATUS_REPLY_VARIANTS.URDU) {
    lines.push(`السلام علیکم ${name}،`);
    lines.push('آپ کے کھلے کیسز کی تازہ صورتحال یہ ہے:');
    for (const item of reply.items) {
      if (item.kind === 'ticket') {
        lines.push(`شکایت: ${item.categoryLabel} — حالت: ${item.statusLabel}`);
        lines.push(`رپورٹ کی تاریخ: ${item.reportedDate || 'not recorded'}`);
        if (item.outage) {
          const area = item.outage.segment
            ? `${item.outage.area} (${item.outage.segment})`
            : item.outage.area;
          lines.push(`یہ شکایت کھلے فالٹ سے منسلک ہے: ${area || 'your area'}`);
          if (item.outage.causeNote) lines.push(`وجہ: ${item.outage.causeNote}`);
          if (item.outage.startTime) lines.push(`فالٹ شروع ہوا: ${item.outage.startTime}`);
        }
        lines.push(`اگلا قدم: ${nextStepFor(item)}`);
      } else {
        lines.push(`درخواست: ${item.typeLabel} — حالت: ${item.statusLabel}`);
        if (item.detail) lines.push(`تفصیل: ${item.detail}`);
        lines.push(`درخواست کی تاریخ: ${item.dateRequested || 'not recorded'}`);
        lines.push(`اگلا قدم: ${nextStepFor(item)}`);
      }
      lines.push('');
    }
    lines.push('شکریہ — شاہدرہ فائبر نیٹ');
    return lines.join('\n').replace(/\n\n$/, '\n');
  }
  lines.push(`Assalam-o-Alaikum ${name},`);
  lines.push('Aap ke open cases ki latest status ye hai:');
  for (const item of reply.items) {
    if (item.kind === 'ticket') {
      lines.push(`Ticket: ${item.categoryLabel} — Status: ${item.statusLabel}`);
      lines.push(`Reported on: ${item.reportedDate || 'not recorded'}`);
      if (item.outage) {
        const area = item.outage.segment
          ? `${item.outage.area} (${item.outage.segment})`
          : item.outage.area;
        lines.push(`Linked to the open outage in ${area || 'your area'}`);
        if (item.outage.causeNote) lines.push(`Cause: ${item.outage.causeNote}`);
        if (item.outage.startTime) lines.push(`Outage started: ${item.outage.startTime}`);
      }
      lines.push(`Next step: ${nextStepFor(item)}`);
    } else {
      lines.push(`Request: ${item.typeLabel} — Status: ${item.statusLabel}`);
      if (item.detail) lines.push(`Detail: ${item.detail}`);
      lines.push(`Requested on: ${item.dateRequested || 'not recorded'}`);
      lines.push(`Next step: ${nextStepFor(item)}`);
    }
    lines.push('');
  }
  lines.push('Shukriya — Shahdara Fiber Net');
  return lines.join('\n').replace(/\n\n$/, '\n');
}

// Build one customer's status reply draft from caller-supplied
// open tickets, outages, and requests. Returns null only when
// there is no customer id at all; a customer with no open item
// gets the plain "no open case" draft, never a null and never an
// invented status. Items are oldest first (reported/requested
// date, undated last), tickets before requests on the same date.
// The caller supplies already-joined rows; this module never
// reads a store and never changes a ticket or request record.
export function buildStatusReply({
  customerId,
  customerName,
  tickets = [],
  outages = [],
  requests = [],
  variant,
} = {}) {
  const id = text(customerId);
  if (!id) return null;
  const cleanVariant = normalizeStatusReplyVariant(variant);
  const items = [];
  for (const entry of Array.isArray(tickets) ? tickets : []) {
    const ticket = normalizeOpenTicket(entry, id);
    if (!ticket) continue;
    ticket.outage = openOutageForTicket(outages, ticket.id);
    ticket.sortDate = ticket.reportedDate || '9999-12-31';
    items.push(ticket);
  }
  for (const entry of Array.isArray(requests) ? requests : []) {
    const request = normalizeOpenRequest(entry, id);
    if (!request) continue;
    request.sortDate = request.dateRequested || '9999-12-31';
    items.push(request);
  }
  items.sort((a, b) => {
    if (a.sortDate !== b.sortDate) return a.sortDate < b.sortDate ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === 'ticket' ? -1 : 1;
    return 0;
  });
  const reply = {
    customerId: id,
    customerName: text(customerName) || null,
    variant: cleanVariant,
    kind: items.length > 0 ? 'open' : 'none',
    items: items.map(({ sortDate, ...rest }) => rest),
  };
  reply.text = buildStatusReplyText(reply);
  return reply;
}

export function statusReplySentText(sends) {
  const list = Array.isArray(sends) ? sends : [];
  if (list.length === 0) return 'Not sent yet.';
  const last = list[list.length - 1];
  return `Sent ${list.length} time${list.length === 1 ? '' : 's'}${last && last.sentAt ? `, last on ${last.sentAt.slice(0, 10)}` : ''}.`;
}

export function logStatusReplySent(list, entry) {
  const clean = Array.isArray(list) ? list.slice() : [];
  if (!entry || typeof entry !== 'object') return clean;
  const customerId = text(entry.customerId);
  if (!customerId) return clean;
  clean.push({
    customerId,
    sentAt: text(entry.sentAt),
    channel: text(entry.channel) || 'whatsapp',
    variant: normalizeStatusReplyVariant(entry.variant),
  });
  return clean;
}

export function findStatusReplySends(list, customerId) {
  const wanted = text(customerId);
  if (!wanted || !Array.isArray(list)) return [];
  return list.filter((entry) => entry && text(entry.customerId) === wanted);
}

export function statusReplyHtml(reply, { draftText, sends } = {}) {
  if (!reply) return '<p class="empty-state">Status reply unavailable.</p>';
  const summary = reply.kind === 'none'
    ? 'No open ticket or request for this customer.'
    : `${reply.items.length} open case${reply.items.length === 1 ? '' : 's'}: ${reply.items.map((item) => (item.kind === 'ticket' ? item.categoryLabel : item.typeLabel)).join(', ')}.`;
  return `<div><p style="font-size: 12px;">${escapeHtml(summary)}</p><pre style="white-space: pre-wrap; font-size: 12px;">${escapeHtml(draftText ?? reply.text)}</pre><p style="font-size: 12px;">${escapeHtml(statusReplySentText(sends))}</p></div>`;
}
