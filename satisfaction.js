// Plan 49 (Plan 1-100) — Post-resolution satisfaction note and monthly
// satisfaction view.
//
// The owner never learns, in any countable form, whether fixed faults
// actually left customers happy, so service quality is judged by
// complaint volume alone. This module is the RECORD for that answer:
// one satisfaction note per resolved ticket — a simple rating plus
// an optional short note, recorded by the operator from the customer's
// reply — plus a read-only monthly view counting ratings by mohalla
// and category.
//
// Scope fence, stated plainly against the neighbouring systems:
//   - Plan 25 covers the confirmation draft itself; this plan does
//     not rebuild it, and it never sends anything. The note is
//     recorded by the operator from a reply that already arrived.
//   - This is not a second ticket system and it does not touch
//     Plan 21's ticket log: recording a rating never reopens or
//     alters a ticket. The module takes ticket rows as read-only
//     input for the view (mohalla, category, status) and returns
//     them unchanged; it holds no bill, payment, priority, or
//     ticket-status field, so there is nothing here that could
//     rewrite one.
//   - A ticket with no reply shows as "no response" in the view,
//     never as a guessed rating. A note with no recorded date is
//     counted in the all-notes total but belongs to no month,
//     never to a guessed month.
//
// How the fence is kept in this module:
//   - It is import-free: the caller supplies every note, every
//     ticket, and the month, and the module never reads storage,
//     the clock, or the network, and never mutates an input.
//   - A note without a ticket id, or with a rating outside the
//     three in the plan, is not a note: normalisation returns null
//     instead of inventing a ticket or a rating. An impossible
//     recorded date (2026-02-30) is refused outright, never stored
//     as a neighbouring date, because the month is derived from it.
//   - One note per ticket, enforced by upsert: recording a second
//     note for the same ticket replaces the first, so a ticket can
//     never carry two ratings at once. When the caller supplies
//     the eligible (resolved or closed) ticket ids, a note for any
//     other ticket is refused with the list unchanged.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export const SATISFACTION_RATINGS = ['satisfied', 'neutral', 'unhappy'];

export const SATISFACTION_RATING_LABELS = {
  satisfied: 'Satisfied',
  neutral: 'Neutral',
  unhappy: 'Unhappy',
};

// Plan 21's five categories, repeated here so this module stays
// import-free; the values must match ticket-log.js exactly.
export const SATISFACTION_CATEGORIES = [
  'no_connection',
  'slow_speed',
  'billing_query',
  'device_fault',
  'relocation_request',
];

export const SATISFACTION_CATEGORY_LABELS = {
  no_connection: 'No connection',
  slow_speed: 'Slow speed',
  billing_query: 'Billing query',
  device_fault: 'Device fault',
  relocation_request: 'Relocation request',
};

// A ticket counts as post-resolution once it is resolved or closed.
// Open, assigned, and in-progress tickets are still work waiting,
// not resolutions a customer can rate.
export const SATISFACTION_RESOLVED_STATUSES = ['resolved', 'closed'];

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
export function validSatisfactionDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

// A month in YYYY-MM form with a real calendar month (01–12), or null.
export function validSatisfactionMonth(value) {
  const str = text(value);
  if (!MONTH_RE.test(str)) return null;
  const month = Number(str.slice(5, 7));
  return month >= 1 && month <= 12 ? str : null;
}

// One satisfaction note, normalised, or null when it is not a note:
// no ticket id, a rating outside the three in the plan, or an
// impossible recorded date. A blank note becomes null ("no note"),
// never an invented comment; a blank recorded date becomes null
// ("date not recorded"), never a guessed date.
export function normalizeSatisfactionNote(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const ticketId = text(entry.ticketId);
  if (!ticketId) return null;
  const rating = text(entry.rating);
  if (!SATISFACTION_RATINGS.includes(rating)) return null;
  const recordedRaw = text(entry.recordedDate);
  if (recordedRaw && !validSatisfactionDate(recordedRaw)) return null;
  return {
    ticketId,
    rating,
    note: text(entry.note) || null,
    recordedDate: recordedRaw ? validSatisfactionDate(recordedRaw) : null,
  };
}

// Every note in the list, normalised, with unusable entries dropped.
// Input order is preserved; inputs are never mutated.
export function normalizeSatisfactionNoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const note = normalizeSatisfactionNote(entry);
    if (note) out.push(note);
  }
  return out;
}

export function findSatisfactionNote(list, ticketId) {
  const clean = normalizeSatisfactionNoteList(list);
  const id = text(ticketId);
  if (!id) return null;
  return clean.find((note) => note.ticketId === id) || null;
}

// Record one note, replacing any earlier note for the same ticket,
// so a ticket never carries two ratings. Returns a new list; a
// refused note leaves the list unchanged. When eligibleTicketIds is
// supplied (an array or Set of resolved/closed ticket ids), a note
// for any other ticket is refused; when it is null, the caller owns
// eligibility and no gate is applied.
export function upsertSatisfactionNote(list, raw, eligibleTicketIds = null) {
  const clean = normalizeSatisfactionNoteList(list);
  const note = normalizeSatisfactionNote(raw);
  if (!note) return clean;
  if (eligibleTicketIds !== null && eligibleTicketIds !== undefined) {
    const eligible = eligibleTicketIds instanceof Set
      ? eligibleTicketIds
      : new Set(Array.from(eligibleTicketIds, (id) => String(id)));
    if (!eligible.has(note.ticketId)) return clean;
  }
  const next = clean.filter((entry) => entry.ticketId !== note.ticketId);
  next.push(note);
  return next;
}

// Remove a note. An unknown ticket id leaves the list unchanged.
export function removeSatisfactionNote(list, ticketId) {
  const clean = normalizeSatisfactionNoteList(list);
  const id = text(ticketId);
  if (!id) return clean;
  return clean.filter((entry) => entry.ticketId !== id);
}

// The ticket ids eligible for a note: resolved or closed tickets
// only. Open work is never rateable.
export function satisfactionEligibleTicketIds(tickets) {
  if (!Array.isArray(tickets)) return [];
  const out = [];
  for (const ticket of tickets) {
    if (!ticket || typeof ticket !== 'object') continue;
    if (!SATISFACTION_RESOLVED_STATUSES.includes(text(ticket.status))) continue;
    const id = text(ticket.id);
    if (id) out.push(id);
  }
  return out;
}

// The mohalla label for one ticket in the view: the caller-supplied
// canonical key when present, else the ticket's own mohalla label,
// else "Unassigned" — never dropped. Grouping is case-insensitive
// with first-seen casing kept, so "Bani" and "bani" are one mohalla.
function groupKey(label) {
  return label.trim().toLowerCase();
}

function ticketMohalla(ticket) {
  if (!ticket || typeof ticket !== 'object') return 'Unknown';
  if (text(ticket.mohallaKey)) return text(ticket.mohallaKey);
  if (text(ticket.mohalla)) return text(ticket.mohalla);
  return 'Unassigned';
}

function ticketCategoryLabel(ticket) {
  if (!ticket || typeof ticket !== 'object') return 'Unknown';
  const category = text(ticket.category);
  return SATISFACTION_CATEGORY_LABELS[category] || 'Unknown';
}

function emptyCounts() {
  return { satisfied: 0, neutral: 0, unhappy: 0, total: 0 };
}

function addRating(counts, rating) {
  if (SATISFACTION_RATINGS.includes(rating)) counts[rating] += 1;
  counts.total += 1;
}

function sortedGroupRows(groups) {
  return [...groups.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name);
  });
}

// The read-only monthly view for one month. Returns null for an
// invalid month, never a view for a guessed month.
//
//   - monthNotes: notes recorded inside the month, joined to their
//     tickets for mohalla and category; a note whose ticket is not
//     in the supplied list still counts, under "Unknown".
//   - byMohalla / byCategory: rating counts for the month's notes.
//   - undatedNotes: notes with no recorded date — counted in the
//     all-notes total, belonging to no month.
//   - noResponse: resolved or closed tickets carrying no note at
//     all, with their own mohalla/category breakdowns. Plan 21
//     rows carry no resolved month, so this list is not
//     month-scoped; the view says so, rather than guessing which
//     month a silent ticket belongs to.
export function buildMonthlySatisfaction(notes, tickets, month) {
  const cleanMonth = validSatisfactionMonth(month);
  if (!cleanMonth) return null;
  const cleanNotes = normalizeSatisfactionNoteList(notes);
  const ticketList = Array.isArray(tickets) ? tickets.filter((t) => t && typeof t === 'object') : [];
  const byId = new Map();
  for (const ticket of ticketList) {
    const id = text(ticket.id);
    if (id && !byId.has(id)) byId.set(id, ticket);
  }
  const monthNotes = cleanNotes.filter((note) => note.recordedDate && note.recordedDate.slice(0, 7) === cleanMonth);
  const totals = emptyCounts();
  const mohallaGroups = new Map();
  const categoryGroups = new Map();
  for (const note of monthNotes) {
    addRating(totals, note.rating);
    const ticket = byId.get(note.ticketId);
    const mohalla = ticketMohalla(ticket);
    const mohallaKey = groupKey(mohalla);
    if (!mohallaGroups.has(mohallaKey)) mohallaGroups.set(mohallaKey, { name: mohalla, ...emptyCounts() });
    addRating(mohallaGroups.get(mohallaKey), note.rating);
    const category = ticketCategoryLabel(ticket);
    const categoryKey = groupKey(category);
    if (!categoryGroups.has(categoryKey)) categoryGroups.set(categoryKey, { name: category, ...emptyCounts() });
    addRating(categoryGroups.get(categoryKey), note.rating);
  }
  const notedIds = new Set(cleanNotes.map((note) => note.ticketId));
  const noResponseTickets = ticketList.filter((ticket) => {
    if (!SATISFACTION_RESOLVED_STATUSES.includes(text(ticket.status))) return false;
    const id = text(ticket.id);
    return id && !notedIds.has(id);
  });
  const noResponseMohalla = new Map();
  const noResponseCategory = new Map();
  for (const ticket of noResponseTickets) {
    const mohalla = ticketMohalla(ticket);
    const mohallaKey = groupKey(mohalla);
    if (!noResponseMohalla.has(mohallaKey)) noResponseMohalla.set(mohallaKey, { name: mohalla, count: 0 });
    noResponseMohalla.get(mohallaKey).count += 1;
    const category = ticketCategoryLabel(ticket);
    const categoryKey = groupKey(category);
    if (!noResponseCategory.has(categoryKey)) noResponseCategory.set(categoryKey, { name: category, count: 0 });
    noResponseCategory.get(categoryKey).count += 1;
  }
  return {
    month: cleanMonth,
    totals,
    byMohalla: sortedGroupRows(mohallaGroups),
    byCategory: sortedGroupRows(categoryGroups),
    monthNotes,
    undatedNotes: cleanNotes.filter((note) => !note.recordedDate).length,
    allNotes: cleanNotes.length,
    noResponse: {
      total: noResponseTickets.length,
      tickets: noResponseTickets,
      byMohalla: [...noResponseMohalla.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      byCategory: [...noResponseCategory.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    },
  };
}

export function satisfactionSummaryText(view) {
  if (!view || typeof view !== 'object') return 'No satisfaction view.';
  const t = view.totals || emptyCounts();
  return `${view.month}: ${t.total} rated (${t.satisfied} satisfied, ${t.neutral} neutral, ${t.unhappy} unhappy); ${view.noResponse ? view.noResponse.total : 0} resolved tickets with no response yet.`;
}

function groupRowsHtml(rows) {
  if (!rows || rows.length === 0) return '<p style="font-size: 12px;">No notes recorded.</p>';
  const body = rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.satisfied}</td><td>${row.neutral}</td><td>${row.unhappy}</td><td>${row.total}</td></tr>`).join('');
  return `<table><thead><tr><th>Group</th><th>Satisfied</th><th>Neutral</th><th>Unhappy</th><th>Total</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function satisfactionHtml(view) {
  if (!view || typeof view !== 'object') return '<p style="font-size: 12px;">No satisfaction view for this month.</p>';
  const t = view.totals || emptyCounts();
  const notes = Array.isArray(view.monthNotes) ? view.monthNotes : [];
  const notesHtml = notes.length === 0
    ? '<p style="font-size: 12px;">No notes recorded this month.</p>'
    : `<table><thead><tr><th>Ticket</th><th>Rating</th><th>Recorded</th><th>Note</th></tr></thead><tbody>${notes.map((note) => `<tr><td>${escapeHtml(note.ticketId)}</td><td>${escapeHtml(SATISFACTION_RATING_LABELS[note.rating] || note.rating)}</td><td>${escapeHtml(note.recordedDate || 'Not recorded')}</td><td>${escapeHtml(note.note || '—')}</td></tr>`).join('')}</tbody></table>`;
  const noResponse = view.noResponse || { total: 0, byMohalla: [], byCategory: [] };
  const noResponseHtml = noResponse.total === 0
    ? '<p style="font-size: 12px;">Every resolved ticket has a rating — no silence to follow up.</p>'
    : `<p style="font-size: 12px;">${noResponse.total} resolved ticket(s) with no response yet (not month-scoped: ticket rows carry no resolved month, so no month is guessed for them).</p>`;
  return `<p style="font-size: 12px;">${escapeHtml(view.month)}: ${t.total} rated — ${t.satisfied} satisfied, ${t.neutral} neutral, ${t.unhappy} unhappy. ${view.undatedNotes ? `${view.undatedNotes} note(s) with no recorded date belong to no month. ` : ''}${escapeHtml(satisfactionSummaryText(view))}</p>`
    + `<h4 style="font-size: 13px; margin: 8px 0 4px;">By mohalla</h4>${groupRowsHtml(view.byMohalla)}`
    + `<h4 style="font-size: 13px; margin: 8px 0 4px;">By category</h4>${groupRowsHtml(view.byCategory)}`
    + `<h4 style="font-size: 13px; margin: 8px 0 4px;">Notes this month</h4>${notesHtml}`
    + `<h4 style="font-size: 13px; margin: 8px 0 4px;">No response yet</h4>${noResponseHtml}`;
}

export function satisfactionCsv(view) {
  if (!view || typeof view !== 'object') return '';
  const lines = ['section,name,satisfied,neutral,unhappy,total'];
  for (const row of view.byMohalla || []) lines.push(['mohalla', row.name, row.satisfied, row.neutral, row.unhappy, row.total].map(csvCell).join(','));
  for (const row of view.byCategory || []) lines.push(['category', row.name, row.satisfied, row.neutral, row.unhappy, row.total].map(csvCell).join(','));
  for (const note of view.monthNotes || []) {
    lines.push(['note', note.ticketId, SATISFACTION_RATING_LABELS[note.rating] || note.rating, note.recordedDate || '', note.note || ''].map(csvCell).join(','));
  }
  const noResponse = view.noResponse || { byMohalla: [], byCategory: [] };
  for (const row of noResponse.byMohalla || []) lines.push(['no-response-mohalla', row.name, '', '', '', row.count].map(csvCell).join(','));
  for (const row of noResponse.byCategory || []) lines.push(['no-response-category', row.name, '', '', '', row.count].map(csvCell).join(','));
  return lines.join('\n');
}

export function satisfactionFilename(month) {
  const clean = validSatisfactionMonth(month) || 'all';
  return `satisfaction-${clean}.csv`;
}
