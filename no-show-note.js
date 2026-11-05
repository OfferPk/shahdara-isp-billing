// Plan 281 (Plan 203-350) — Appointment no-show note.
//
// A missed appointment is only a missed scheduling slot, with no note
// of why the customer was not there or what was agreed next. This
// module adds only the missing piece: one no-show note per missed
// appointment — the appointment link, the date, the reason if known,
// and the next step agreed.
//
// What this module is NOT, stated plainly:
//   - It is not the day-part scheduling record. That record decides
//     which part of the day a field visit is scheduled for; this
//     module only notes that a scheduled appointment was missed,
//     and the scheduling record is neither read nor rewritten here.
//     The caller supplies the appointment links, and this module
//     never touches them.
//   - It is not the preferred visit time window record. That record
//     stores when a customer prefers to be visited; this module
//     only notes a missed appointment, and the time-window record
//     is neither read nor rewritten here.
//   - It never changes any visit outcome, any bill, or any payment
//     record. Recording a no-show note never changes any of those,
//     and this module holds no visit-outcome, bill, or payment
//     field beyond the names on the note itself, so there is
//     nothing here that could rewrite one. A wrong note is removed
//     and recorded again; there is no edit function.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every note,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A note with no id, no appointment link, or no strict date is
//     refused outright. The reason and the next step are optional,
//     because a no-show is often unexplained at first. Unknown
//     fields are dropped, so a note can never grow a visit,
//     bill, or payment field.
//   - A duplicate id is never rewritten.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validNoShowNoteDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

export function normalizeNoShowNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const appointmentId = text(raw.appointmentId);
  const date = text(raw.date);
  if (!id || !appointmentId) return null;
  if (!validNoShowNoteDate(date)) return null;
  return {
    id,
    appointmentId,
    customer: text(raw.customer),
    date,
    reason: text(raw.reason),
    nextStep: text(raw.nextStep),
  };
}

export function normalizeNoShowNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeNoShowNote(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findNoShowNote(list, id) {
  const clean = normalizeNoShowNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordNoShowNote(list, raw) {
  const clean = normalizeNoShowNoteList(list);
  const entry = normalizeNoShowNote(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeNoShowNote(list, id) {
  const clean = normalizeNoShowNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

export function noShowNoteSorted(list) {
  return normalizeNoShowNoteList(list).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.customer !== b.customer) return a.customer < b.customer ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function noShowNotesForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return noShowNoteSorted(list).filter(
    (entry) => entry.customer.toLowerCase() === wanted,
  );
}

export function noShowNotesInPeriod(list, from, to) {
  const start = text(from);
  const end = text(to);
  if (!validNoShowNoteDate(start) || !validNoShowNoteDate(end)) return [];
  if (start > end) return [];
  return noShowNoteSorted(list).filter(
    (entry) => entry.date >= start && entry.date <= end,
  );
}

export function noShowNoteCustomers(list) {
  const seen = new Map();
  for (const entry of normalizeNoShowNoteList(list)) {
    if (!entry.customer) continue;
    const key = entry.customer.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.customer);
  }
  return [...seen.values()];
}

export function noShowNoteSummaryText(list) {
  const clean = normalizeNoShowNoteList(list);
  if (clean.length === 0) return 'No appointment no-show notes recorded.';
  const withReason = clean.filter((entry) => entry.reason).length;
  const word = clean.length === 1 ? 'note' : 'notes';
  return `${clean.length} appointment no-show ${word} recorded, ${withReason} with a reason given.`;
}

export function noShowNoteText(entry) {
  const clean = normalizeNoShowNote(entry);
  if (!clean) return 'No appointment no-show note recorded.';
  const who = clean.customer ? `${clean.customer} — ` : '';
  const reason = clean.reason ? ` — reason: ${clean.reason}` : ' — reason not known';
  const next = clean.nextStep ? ` — next step: ${clean.nextStep}` : '';
  return `${who}appointment ${clean.appointmentId} — missed ${clean.date}${reason}${next}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function noShowNoteHtml(entry) {
  const clean = normalizeNoShowNote(entry);
  if (!clean) return '<p>No appointment no-show note recorded.</p>';
  return `<p>${escapeHtml(noShowNoteText(clean))}</p>`;
}

export function noShowNoteAllHtml(list) {
  const rows = noShowNoteSorted(list);
  if (!rows.length) return '<p>No appointment no-show notes recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(noShowNoteText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function noShowNoteCsv(list) {
  const rows = noShowNoteSorted(list);
  const lines = ['"id","appointment","customer","date","reason","next step"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.appointmentId),
      csvCell(entry.customer),
      csvCell(entry.date),
      csvCell(entry.reason),
      csvCell(entry.nextStep),
    ].join(','));
  }
  return lines.join('\n');
}

export function noShowNoteFilename() {
  return 'no-show-notes.csv';
}
