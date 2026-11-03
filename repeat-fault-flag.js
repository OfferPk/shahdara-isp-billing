// Plan 24 (Plan 1-100) — Repeat-fault flag for chronic problems.
//
// A customer whose connection fails every few weeks is treated as a
// fresh case each time, so a weak cable, a faulty ONU, or a bad
// splitter segment is never recognised as a pattern. This module is
// the READ-ONLY flag for that pattern, computed from the Plan 21
// ticket log: a customer with a set number of tickets in the same
// category within an operator-set window (default 3 in 60 days) is
// flagged as repeat-fault, with the past tickets that caused the
// flag listed alongside it.
//
// Scope fence, stated plainly:
//   - The flag is computed, never stored on a ticket, a customer,
//     or any other record. Flagging changes no billing, no priority
//     rule, and no customer status by itself: this module holds no
//     bill, payment, priority, or customer-status field, and the
//     caller passes no such records in. A flagged customer is
//     still visited, billed, and prioritised exactly as before —
//     the operator simply sees the pattern first.
//   - It is not a second ticket system and it does not replace
//     Plan 21's log, Plan 22's outage grouping, or Plan 23's
//     dispatch queue. It reads the same ticket rows those panels
//     read and adds one derived view on top of them.
//   - The window is anchored at the caller-supplied today, so a
//     flag disappears on its own when the window passes without a
//     new ticket in that category: no ticket is ever deleted or
//     rewritten to make a flag go away.
//
// How the fence is kept in this module:
//   - It is import-free: the caller supplies every ticket, every
//     date, and today, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - A ticket without a customer, with a category outside Plan
//     21's five, or without a real reported date cannot be placed
//     inside a window, so it never causes a flag — it is dropped
//     from the computation, never invented. A ticket reported in
//     the future is likewise outside every window ending today.
//   - The window is inclusive on both ends: a ticket reported
//     exactly windowDays - 1 days before today still counts, and
//     a ticket reported exactly today counts. Anything older
//     than that is outside the window, even by one day.
//   - Invalid operator settings fall back to the defaults as a
//     whole (3 tickets in 60 days), so a bad threshold or window
//     can never silently flag every single ticket or flag none.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Plan 21's five categories, repeated here so this module stays
// import-free; the values must match ticket-log.js exactly.
export const REPEAT_FAULT_CATEGORIES = [
  'no_connection',
  'slow_speed',
  'billing_query',
  'device_fault',
  'relocation_request',
];

export const REPEAT_FAULT_CATEGORY_LABELS = {
  no_connection: 'No connection',
  slow_speed: 'Slow speed',
  billing_query: 'Billing query',
  device_fault: 'Device fault',
  relocation_request: 'Relocation request',
};

export const REPEAT_FAULT_DEFAULT_THRESHOLD = 3;
export const REPEAT_FAULT_DEFAULT_WINDOW_DAYS = 60;

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
export function validRepeatFaultDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

// Whole days from dateA to dateB (UTC calendar days), or null when
// either date is not a real calendar date.
export function wholeDaysBetweenRepeatFaultDates(dateA, dateB) {
  const a = validRepeatFaultDate(dateA);
  const b = validRepeatFaultDate(dateB);
  if (!a || !b) return null;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

function dateMinusDays(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - days);
  return parsed.toISOString().slice(0, 10);
}

// Operator settings, normalised. A threshold below 2 would flag
// every single ticket, and a window below 1 day would flag nothing
// real, so either out-of-range value falls back to the defaults
// as a whole — the settings never silently collapse to a
// meaningless pair. Non-integer values are floored only when they
// stay in range; anything else is a default.
export function normalizeRepeatFaultSettings(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const threshold = Number(raw.threshold);
  const windowDays = Number(raw.windowDays);
  const thresholdOk = Number.isFinite(threshold)
    && Math.floor(threshold) === threshold && threshold >= 2 && threshold <= 99;
  const windowOk = Number.isFinite(windowDays)
    && Math.floor(windowDays) === windowDays && windowDays >= 1 && windowDays <= 365;
  if (!thresholdOk || !windowOk) {
    return {
      threshold: REPEAT_FAULT_DEFAULT_THRESHOLD,
      windowDays: REPEAT_FAULT_DEFAULT_WINDOW_DAYS,
    };
  }
  return { threshold, windowDays };
}

// One ticket row, normalised for window counting. Returns null for
// a ticket without a customer, with a category outside Plan 21's
// five, or without a real reported date — such a row cannot be
// placed inside a window, so it never causes a flag.
export function normalizeRepeatFaultTicket(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const customerId = text(entry.customerId);
  if (!customerId) return null;
  const category = text(entry.category);
  if (!REPEAT_FAULT_CATEGORIES.includes(category)) return null;
  const reportedDate = validRepeatFaultDate(entry.reportedDate);
  if (!reportedDate) return null;
  return {
    id: text(entry.id),
    customerId,
    customerName: text(entry.customerName),
    mohalla: text(entry.mohalla),
    category,
    reportedDate,
  };
}

// Every usable ticket row, normalised, with unusable entries
// dropped. Input order is preserved; inputs are never mutated.
export function normalizeRepeatFaultTicketList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const ticket = normalizeRepeatFaultTicket(entry);
    if (ticket) out.push(ticket);
  }
  return out;
}

// The repeat-fault flags for one ticket list. One flag per
// (customer, category) pair that has at least `threshold` tickets
// inside the window ending at `today` (inclusive both ends, so
// the window starts windowDays - 1 days before today). Each flag
// links to exactly the tickets that caused it — the qualifying
// tickets inside the window, oldest first — and to nothing else.
// A flag carries no billing, priority, or status field, because
// flagging changes none of those. Sorted by customer name A–Z,
// then category label, then customer id. Inputs are never mutated.
export function buildRepeatFaultFlags(list, options = {}) {
  const today = validRepeatFaultDate(options.today);
  if (!today) return [];
  const settings = normalizeRepeatFaultSettings(options);
  const windowStart = dateMinusDays(today, settings.windowDays - 1);
  const groups = new Map();
  for (const ticket of normalizeRepeatFaultTicketList(list)) {
    if (ticket.reportedDate < windowStart || ticket.reportedDate > today) continue;
    const key = `${ticket.customerId}\n${ticket.category}`;
    if (!groups.has(key)) {
      groups.set(key, {
        customerId: ticket.customerId,
        customerName: ticket.customerName,
        mohalla: ticket.mohalla,
        category: ticket.category,
        tickets: [],
      });
    }
    groups.get(key).tickets.push(ticket);
  }
  const flags = [];
  for (const group of groups.values()) {
    if (group.tickets.length < settings.threshold) continue;
    const tickets = [...group.tickets].sort((a, b) => {
      if (a.reportedDate !== b.reportedDate) return a.reportedDate < b.reportedDate ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    flags.push({
      customerId: group.customerId,
      customerName: group.customerName,
      mohalla: group.mohalla,
      category: group.category,
      categoryLabel: REPEAT_FAULT_CATEGORY_LABELS[group.category] ?? group.category,
      count: tickets.length,
      threshold: settings.threshold,
      windowDays: settings.windowDays,
      windowStart,
      windowEnd: today,
      latestDate: tickets[tickets.length - 1].reportedDate,
      ticketIds: tickets.map((ticket) => ticket.id),
      tickets,
    });
  }
  return flags.sort((a, b) => {
    const name = (a.customerName || a.customerId).localeCompare(b.customerName || b.customerId);
    if (name !== 0) return name;
    const category = a.categoryLabel.localeCompare(b.categoryLabel);
    if (category !== 0) return category;
    return a.customerId.localeCompare(b.customerId);
  });
}

// Counts for a flag list: flagged customers and flags, and the
// largest ticket count on any single flag.
export function repeatFaultSummary(flags) {
  const list = Array.isArray(flags) ? flags : [];
  const customers = new Set(list.map((flag) => flag.customerId));
  return {
    flags: list.length,
    customers: customers.size,
    largestCount: list.reduce((max, flag) => Math.max(max, flag.count || 0), 0),
  };
}

export function repeatFaultSummaryText(summary) {
  if (!summary || typeof summary !== 'object') return 'No repeat-fault flags';
  const flags = summary.flags ?? 0;
  const customers = summary.customers ?? 0;
  if (!flags) return 'No repeat-fault flags';
  return `${flags} repeat-fault flag${flags === 1 ? '' : 's'} on ${customers} customer${customers === 1 ? '' : 's'}`;
}

function flagLabel(flag) {
  return REPEAT_FAULT_CATEGORY_LABELS[flag.category] ?? flag.category;
}

// One block per flag, escaped, naming the customer, the category,
// how many tickets in how many days, the window, and the ticket
// ids and dates that caused the flag — and nothing else.
export function repeatFaultHtml(flags, options = {}) {
  const list = Array.isArray(flags) ? flags : [];
  if (!list.length) return '<p class="empty-state">No repeat-fault flags at these settings.</p>';
  const showTickets = options.showTickets !== false;
  return list.map((flag) => {
    const ticketLines = showTickets
      ? `<div>Tickets: ${flag.tickets.map((ticket) => `${escapeHtml(ticket.id || 'no id')} (${escapeHtml(ticket.reportedDate)})`).join(', ')}</div>`
      : '';
    return `<div class="repeat-fault-flag-row"><strong>${escapeHtml(flag.customerName || flag.customerId)}</strong> · ${escapeHtml(flagLabel(flag))} · ${escapeHtml(flag.count)} tickets in ${escapeHtml(flag.windowDays)} days (threshold ${escapeHtml(flag.threshold)}) · Window: ${escapeHtml(flag.windowStart)} to ${escapeHtml(flag.windowEnd)} · Latest: ${escapeHtml(flag.latestDate)}${flag.mohalla ? ` · ${escapeHtml(flag.mohalla)}` : ''}${ticketLines}</div>`;
  }).join('');
}

export function repeatFaultCsv(flags) {
  const list = Array.isArray(flags) ? flags : [];
  const header = ['Customer', 'Mohalla', 'Category', 'Ticket count', 'Threshold', 'Window days', 'Window start', 'Window end', 'Latest ticket date', 'Ticket ids'];
  const lines = [header.map(csvCell).join(',')];
  for (const flag of list) {
    lines.push([
      flag.customerName || flag.customerId, flag.mohalla,
      flagLabel(flag), flag.count, flag.threshold, flag.windowDays,
      flag.windowStart, flag.windowEnd, flag.latestDate,
      flag.ticketIds.join('; '),
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function repeatFaultFilename() {
  return 'repeat-fault-flags.csv';
}
