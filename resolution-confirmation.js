// Plan 25 (Plan 1-100) — Post-resolution confirmation draft and reopen
// window.
//
// A ticket is closed when the technician leaves, but if the fault
// returns the next day the customer must start again from scratch,
// and nobody checks whether the fix actually held. This module is
// the follow-through for a resolved ticket only: one short bilingual
// confirmation draft (what was fixed, when, and how to report a
// return), plus a reopen window in which the same ticket can be
// reopened with its history intact.
//
// Scope fence, stated plainly:
//   - This is not a second ticket system and it does not replace
//     Plan 21's ticket log: it reads the same ticket rows, and a
//     reopen changes only the matched ticket's status, exactly as
//     Plan 21's own status change does. It never touches a bill,
//     a payment, a lifecycle record, a connection-register record
//     (Plan 17), or a field-visit outcome (Plan 2).
//   - Nothing here sends anything. The draft is prepared for the
//     operator to send through the existing WhatsApp route; the
//     caller decides when, and to whom, it goes.
//   - Reopening inside the window keeps the ticket's original id
//     and every other field: only its status moves back to open.
//     Past the window, the old ticket is left exactly as it is
//     and a NEW ticket is created, linked to the old one by a
//     caller-owned link record (and by a note on the new ticket
//     naming the old ticket), so the old history is never
//     rewritten and the new case is never a silent duplicate.
//   - The reopen window is anchored at the date the ticket was
//     first seen resolved, because Plan 21's ticket rows carry no
//     resolved date of their own. The caller records that date
//     (see recordResolution); a ticket with no recorded
//     resolution date has an unknown window, never a guessed one.
//
// How the fence is kept in this module:
//   - It is import-free: the caller supplies every ticket, every
//     resolution record, every date, and today, and the module
//     never reads storage, the clock, or the network, and never
//     mutates an input.
//   - A ticket without a customer, or with a category outside
//     Plan 21's five, is not a ticket here: normalisation returns
//     null instead of inventing a customer or a category. A bad
//     reported or resolved date becomes null — shown as
//     "Not recorded", never guessed.
//   - An invalid reopen window falls back to the default (7 days)
//     as a whole, so a bad setting can never silently reopen
//     everything or nothing.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Plan 21's five categories, repeated here so this module stays
// import-free; the values must match ticket-log.js exactly.
export const RESOLUTION_CATEGORIES = [
  'no_connection',
  'slow_speed',
  'billing_query',
  'device_fault',
  'relocation_request',
];

export const RESOLUTION_CATEGORY_LABELS = {
  no_connection: 'No connection',
  slow_speed: 'Slow speed',
  billing_query: 'Billing query',
  device_fault: 'Device fault',
  relocation_request: 'Relocation request',
};

export const RESOLUTION_CONFIRMATION_VARIANTS = {
  ROMAN: 'roman',
  URDU: 'urdu',
};

export const RESOLUTION_DEFAULT_WINDOW_DAYS = 7;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
export function validResolutionDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

// Whole days from dateA to dateB (UTC calendar days), or null when
// either date is not a real calendar date.
export function wholeDaysBetweenResolutionDates(dateA, dateB) {
  const a = validResolutionDate(dateA);
  const b = validResolutionDate(dateB);
  if (!a || !b) return null;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

// A date shifted forward by a whole number of days, or null.
export function addResolutionDays(date, days) {
  const clean = validResolutionDate(date);
  if (!clean || !Number.isInteger(days)) return null;
  const ms = Date.parse(`${clean}T00:00:00Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

// The reopen window in days: a positive integer, or the default
// when the caller's value is missing, fractional, zero, or
// negative — never a silent zero-day or endless window.
export function normalizeReopenWindowDays(value) {
  const days = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return Number.isInteger(days) && days >= 1 ? days : RESOLUTION_DEFAULT_WINDOW_DAYS;
}

// Normalised ticket, or null when the entry cannot be a ticket:
// no customer, or a category outside the plan's five. The returned
// object is fresh; the input is never mutated. Every field Plan 21
// stores is carried, so a reopened list can be saved back through
// the ticket log's own store without losing a field.
export function normalizeConfirmationTicket(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const customerId = text(entry.customerId);
  if (!customerId) return null;
  const category = text(entry.category);
  if (!RESOLUTION_CATEGORIES.includes(category)) return null;
  const status = text(entry.status);
  return {
    id: text(entry.id),
    customerId,
    customerName: text(entry.customerName),
    mohalla: text(entry.mohalla),
    mohallaKey: text(entry.mohallaKey),
    category,
    priority: text(entry.priority),
    status: status || 'open',
    reportedDate: validResolutionDate(entry.reportedDate),
    assignee: text(entry.assignee),
    note: text(entry.note),
  };
}

// Every ticket in the list, normalised, with unusable entries
// dropped. Input order is preserved; inputs are never mutated.
export function normalizeConfirmationTicketList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const ticket = normalizeConfirmationTicket(entry);
    if (ticket) out.push(ticket);
  }
  return out;
}

// Only resolved tickets offer a confirmation draft.
export function resolvedConfirmationTickets(list) {
  return normalizeConfirmationTicketList(list).filter((ticket) => ticket.status === 'resolved');
}

// ---- Resolution records: when a ticket was first seen resolved ----

// One record: the ticket id and the date it was first seen resolved.
// A record without a ticket id or a real date is dropped, never
// invented.
export function normalizeResolutionList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const ticketId = text(entry.ticketId);
    const resolvedDate = validResolutionDate(entry.resolvedDate);
    if (!ticketId || !resolvedDate || seen.has(ticketId)) continue;
    seen.add(ticketId);
    out.push({ ticketId, resolvedDate });
  }
  return out;
}

// Record a ticket as resolved on a date. If the ticket already has
// a record, the first date stands — the window is anchored at the
// first resolution, not reset by re-rendering. A bad ticket id or
// date leaves the list unchanged.
export function recordResolution(list, ticketId, resolvedDate) {
  const clean = normalizeResolutionList(list);
  const id = text(ticketId);
  const date = validResolutionDate(resolvedDate);
  if (!id || !date) return clean;
  if (clean.some((entry) => entry.ticketId === id)) return clean;
  return [...clean, { ticketId: id, resolvedDate: date }];
}

// The recorded resolution date for one ticket, or null.
export function resolutionDateFor(list, ticketId) {
  const clean = normalizeResolutionList(list);
  const entry = clean.find((item) => item.ticketId === text(ticketId));
  return entry ? entry.resolvedDate : null;
}

// ---- Reopen window ----

// The reopen decision for one ticket. Returns:
//   - { eligible: true } when the ticket is resolved and today is
//     inside its window (inclusive both ends: a ticket resolved
//     exactly windowDays ago is still inside);
//   - { eligible: false, reason: 'window_passed' } when the window
//     has passed — the old ticket stays as it is and a new,
//     linked ticket is the way back;
//   - { eligible: false, reason: 'not_resolved' } for any ticket
//     that is not resolved (open, assigned, in progress, closed);
//   - { eligible: 'unknown', reason: 'no_resolution_date' } when
//     the ticket is resolved but no resolution date was recorded
//     — the window cannot be judged, so it is never guessed.
export function reopenDecision(ticket, resolutions, today, windowDays) {
  const clean = normalizeConfirmationTicket(ticket);
  const window = normalizeReopenWindowDays(windowDays);
  if (!clean) return { eligible: false, reason: 'not_a_ticket', windowDays: window, daysSinceResolved: null, windowEndDate: null };
  if (clean.status !== 'resolved') {
    return { eligible: false, reason: 'not_resolved', windowDays: window, daysSinceResolved: null, windowEndDate: null };
  }
  const resolvedDate = resolutionDateFor(resolutions, clean.id);
  if (!resolvedDate) {
    return { eligible: 'unknown', reason: 'no_resolution_date', windowDays: window, daysSinceResolved: null, windowEndDate: null };
  }
  const days = wholeDaysBetweenResolutionDates(resolvedDate, today);
  if (days === null) {
    return { eligible: 'unknown', reason: 'bad_today', windowDays: window, daysSinceResolved: null, windowEndDate: addResolutionDays(resolvedDate, window) };
  }
  const daysSinceResolved = days < 0 ? 0 : days;
  const windowEndDate = addResolutionDays(resolvedDate, window);
  if (daysSinceResolved <= window) {
    return { eligible: true, reason: 'within_window', windowDays: window, daysSinceResolved, windowEndDate };
  }
  return { eligible: false, reason: 'window_passed', windowDays: window, daysSinceResolved, windowEndDate };
}

// Reopen one resolved ticket inside its window: only the matched
// ticket's status moves back to open; every other field, and every
// other ticket, is unchanged. Any other outcome — not resolved,
// window passed, unknown window, unknown id — leaves the list
// exactly as it was (normalised). Reopening never creates a
// second ticket.
export function reopenResolvedTicket(list, id, today, windowDays, resolutions) {
  const clean = normalizeConfirmationTicketList(list);
  const wanted = text(id);
  const matched = clean.find((ticket) => ticket.id === wanted);
  if (!matched) return clean;
  const decision = reopenDecision(matched, resolutions, today, windowDays);
  if (decision.eligible !== true) return clean;
  return clean.map((ticket) => (ticket.id === wanted ? { ...ticket, status: 'open' } : ticket));
}

// ---- Follow-up ticket for a ticket past its window ----

// The input for a new Plan 21 ticket that follows up an old one:
// same customer, category and priority, status open, reported
// today, and a note naming the old ticket so the link is visible
// on the new ticket itself. The caller creates it through the
// ticket log's own createTicket and records the link below; this
// function invents no customer, no category and no date.
export function createFollowUpTicketInput(oldTicket, options = {}) {
  const clean = normalizeConfirmationTicket(oldTicket);
  if (!clean) return null;
  const reportedDate = validResolutionDate(options.reportedDate);
  if (!reportedDate) return null;
  const oldNote = clean.note;
  const note = oldNote
    ? `${oldNote} (Follow-up of ticket ${clean.id})`
    : `Follow-up of ticket ${clean.id}`;
  return {
    id: text(options.id),
    customerId: clean.customerId,
    customerName: clean.customerName,
    mohalla: clean.mohalla,
    category: clean.category,
    priority: clean.priority || 'medium',
    status: 'open',
    reportedDate,
    assignee: clean.assignee,
    note,
  };
}

// Caller-owned links from a follow-up ticket to the ticket it
// follows up: { oldTicketId, newTicketId }. A link without both
// ids is dropped; the same new ticket is linked once.
export function normalizeFollowUpLinkList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const oldTicketId = text(entry.oldTicketId);
    const newTicketId = text(entry.newTicketId);
    if (!oldTicketId || !newTicketId || seen.has(newTicketId)) continue;
    seen.add(newTicketId);
    out.push({ oldTicketId, newTicketId });
  }
  return out;
}

export function recordFollowUpLink(list, oldTicketId, newTicketId) {
  const clean = normalizeFollowUpLinkList(list);
  const oldId = text(oldTicketId);
  const newId = text(newTicketId);
  if (!oldId || !newId) return clean;
  if (clean.some((link) => link.newTicketId === newId)) return clean;
  return [...clean, { oldTicketId: oldId, newTicketId: newId }];
}

export function followUpLinksFor(list, oldTicketId) {
  return normalizeFollowUpLinkList(list).filter((link) => link.oldTicketId === text(oldTicketId));
}

// ---- Confirmation draft ----

// One confirmation draft for a resolved ticket, in Roman Urdu or
// Urdu script. What was fixed is the ticket's own category and
// note, verbatim; when no note was recorded the draft says so
// instead of inventing a fix. Dates are the ticket's reported date
// and its recorded resolution date; a missing date is shown as
// "Not recorded", never guessed. The return line names the reopen
// window in plain words and promises nothing beyond it; a support
// contact line appears only when the caller supplies one.
export function buildConfirmationDraft(ticket, resolution, variant = RESOLUTION_CONFIRMATION_VARIANTS.ROMAN, options = {}) {
  const clean = normalizeConfirmationTicket(ticket);
  if (!clean || clean.status !== 'resolved') return null;
  const resolvedDate = resolutionDateFor(resolution, clean.id);
  const window = normalizeReopenWindowDays(options.windowDays);
  const categoryLabel = RESOLUTION_CATEGORY_LABELS[clean.category] ?? clean.category;
  const name = clean.customerName || clean.customerId;
  const reported = clean.reportedDate || 'Not recorded';
  const resolved = resolvedDate || 'Not recorded';
  const fixLine = clean.note ? `Fix note: ${clean.note}.` : 'Fix note: not recorded.';
  const supportContact = text(options.supportContact);
  if (variant === RESOLUTION_CONFIRMATION_VARIANTS.URDU) {
    const lines = [
      `السلام علیکم ${name}، آپ کی شکایت (${categoryLabel}) ٹھیک ہو گئی ہے۔`,
      `شکایت کی تاریخ: ${reported}۔ ٹھیک ہونے کی تاریخ: ${resolved}۔ ${fixLine}`,
      `اگر مسئلہ ${window} دن کے اندر واپس آئے تو یہی ٹکٹ دوبارہ کھولی جا سکتی ہے — ہمیں واٹس ایپ پر بتا دیں، نیا ٹکٹ بنانے کی ضرورت نہیں۔`,
    ];
    if (supportContact) lines.push(`رابطہ: ${supportContact}۔`);
    lines.push('شکریہ!');
    return {
      variant: RESOLUTION_CONFIRMATION_VARIANTS.URDU,
      text: lines.join(' '),
      ticketId: clean.id,
      customerName: name,
      category: clean.category,
      reportedDate: clean.reportedDate,
      resolvedDate,
      windowDays: window,
    };
  }
  const lines = [
    `Assalam-o-Alaikum ${name}, aap ki shikayat (${categoryLabel}) theek ho gayi hai.`,
    `Reported: ${reported}. Resolved: ${resolved}. ${fixLine}`,
    `Agar masla ${window} din ke andar wapas aaye to yehi ticket dobara kholi ja sakti hai — humein WhatsApp par batayein, naya ticket banane ki zaroorat nahi.`,
  ];
  if (supportContact) lines.push(`Rabta: ${supportContact}.`);
  lines.push('Shukriya!');
  return {
    variant: RESOLUTION_CONFIRMATION_VARIANTS.ROMAN,
    text: lines.join(' '),
    ticketId: clean.id,
    customerName: name,
    category: clean.category,
    reportedDate: clean.reportedDate,
    resolvedDate,
    windowDays: window,
  };
}

// ---- Summary, HTML, CSV ----

// One row per resolved ticket: the ticket, its reopen decision and
// its draft (null when no draft can be built).
export function buildConfirmationRows(list, resolutions, today, windowDays, options = {}) {
  const resolved = resolvedConfirmationTickets(list);
  return resolved.map((ticket) => {
    const decision = reopenDecision(ticket, resolutions, today, windowDays);
    const draft = buildConfirmationDraft(ticket, resolutions, options.variant, { windowDays, supportContact: options.supportContact });
    return { ticket, decision, draft };
  });
}

export function confirmationSummary(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    resolved: list.length,
    withinWindow: list.filter((row) => row.decision && row.decision.eligible === true).length,
    windowPassed: list.filter((row) => row.decision && row.decision.eligible === false && row.decision.reason === 'window_passed').length,
    unknownWindow: list.filter((row) => row.decision && row.decision.eligible === 'unknown').length,
  };
}

export function confirmationSummaryText(summary) {
  if (!summary || typeof summary !== 'object') return 'No resolved tickets';
  return `${summary.resolved} resolved · ${summary.withinWindow} can reopen in window · ${summary.windowPassed} past window · ${summary.unknownWindow} unknown window`;
}

function decisionLabel(decision) {
  if (!decision) return 'Unknown';
  if (decision.eligible === true) return `Can reopen — ${decision.daysSinceResolved} day${decision.daysSinceResolved === 1 ? '' : 's'} since resolved, window ends ${decision.windowEndDate || 'unknown'}`;
  if (decision.reason === 'window_passed') return `Window passed — ${decision.daysSinceResolved} day${decision.daysSinceResolved === 1 ? '' : 's'} since resolved, window ended ${decision.windowEndDate || 'unknown'}; needs a new linked ticket`;
  if (decision.reason === 'not_resolved') return 'Not resolved';
  if (decision.reason === 'no_resolution_date') return 'Window unknown — resolution date not recorded';
  return 'Window unknown';
}

export function confirmationHtml(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return '<p class="empty-state">No resolved tickets yet.</p>';
  return list.map((row) => {
    const ticket = row.ticket;
    const labels = RESOLUTION_CATEGORY_LABELS[ticket.category] ?? ticket.category;
    return `<div class="resolution-confirmation-row" data-ticket-id="${escapeHtml(ticket.id)}"><strong>${escapeHtml(ticket.customerName || ticket.customerId)}</strong> · ${escapeHtml(labels)} · Reported: ${escapeHtml(ticket.reportedDate || 'Not recorded')} · Resolved: ${escapeHtml(row.draft?.resolvedDate || 'Not recorded')} · ${escapeHtml(decisionLabel(row.decision))}${ticket.note ? `<div>Note: ${escapeHtml(ticket.note)}</div>` : ''}</div>`;
  }).join('');
}

export function confirmationCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const header = ['Ticket id', 'Customer', 'Category', 'Reported date', 'Resolved date', 'Reopen decision', 'Days since resolved', 'Window ends'];
  const lines = [header.map(csvCell).join(',')];
  for (const row of list) {
    const ticket = row.ticket;
    const decision = row.decision || {};
    lines.push([
      ticket.id,
      ticket.customerName || ticket.customerId,
      RESOLUTION_CATEGORY_LABELS[ticket.category] ?? ticket.category,
      ticket.reportedDate || '',
      row.draft?.resolvedDate || '',
      decision.eligible === true ? 'within_window' : decision.reason || '',
      decision.daysSinceResolved === null || decision.daysSinceResolved === undefined ? '' : decision.daysSinceResolved,
      decision.windowEndDate || '',
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function confirmationFilename() {
  return 'resolution-confirmation.csv';
}
