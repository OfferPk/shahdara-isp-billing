// Plan 220 (Plan 203-350) — Instalment default note.
//
// When an instalment is missed — on an arrears plan (Plan 37) or a
// one-time-charge schedule (Plan 104) — the miss is visible only on
// that bill, with no default note and no recorded next step. This
// module is the note only: one default note per missed instalment
// (schedule reference, instalment due date, amount missed, date
// noted, next step recorded), so a missed instalment stops drifting
// and is not rediscovered at month end.
//
// What this module is NOT, stated plainly:
//   - It is not the schedule. It changes no schedule, charges no
//     penalty by itself, and never writes, edits, or voids a bill
//     or a payment: recording a note never changes any bill,
//     payment, or schedule by itself.
//   - It is not the arrears plan (Plan 37) or the one-time-charge
//     schedule (Plan 104). Those modules were checked first: the
//     Plan 104 module computes which instalments are missed, but
//     it keeps no dated default note and no next step, and this
//     module never reads or rewrites either module. The caller
//     supplies every note.
//   - It is not any SISP/MD module. The corresponding SISP/MD
//     material was checked first: no instalment default note
//     exists there, so this module adds only the missing piece
//     and never reads or rewrites an SISP/MD record.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every note,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A note with no id, no schedule reference, no strict due
//     date, no strict date noted, no positive amount missed, or
//     no next step is refused outright. Unknown fields are
//     dropped, so a note can never grow a bill, payment, or
//     schedule field.
//   - A duplicate id is never rewritten. There is no edit
//     function; only recording a note, marking it paid late, and
//     removal.
//   - A paid-late instalment leaves the open default list, but
//     its note is kept: the paid date is stored on the note and
//     the note still appears in the full sorted list. Marking a
//     note paid late never rewrites its due date, amount missed,
//     or next step, and a note already paid late keeps its first
//     paid date.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function validInstalmentDefaultDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= limit;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeInstalmentDefault(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const scheduleRef = cleanText(raw.scheduleRef);
  const dueDate = cleanText(raw.dueDate);
  const dateNoted = cleanText(raw.dateNoted);
  const nextStep = cleanText(raw.nextStep);
  const customer = cleanText(raw.customer);
  const amount = Number(raw.amountMissed);
  if (!id || !scheduleRef || !validInstalmentDefaultDate(dueDate)
    || !validInstalmentDefaultDate(dateNoted) || !nextStep
    || !Number.isFinite(amount) || amount <= 0) return null;
  const paidDate = cleanText(raw.paidDate);
  const status = paidDate && validInstalmentDefaultDate(paidDate) ? 'paid late' : 'open';
  return {
    id,
    scheduleRef,
    dueDate,
    amountMissed: amount,
    dateNoted,
    nextStep,
    customer,
    status,
    paidDate: status === 'paid late' ? paidDate : '',
  };
}

export function normalizeInstalmentDefaultList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const clean = normalizeInstalmentDefault(raw);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

export function findInstalmentDefault(list, id) {
  const clean = normalizeInstalmentDefaultList(list);
  const wanted = cleanText(id);
  return clean.find((note) => note.id === wanted) ?? null;
}

export function recordInstalmentDefault(list, record) {
  const clean = normalizeInstalmentDefaultList(list);
  const next = normalizeInstalmentDefault(record);
  if (!next) return clean;
  if (clean.some((note) => note.id === next.id)) return clean;
  return [...clean, next];
}

export function removeInstalmentDefault(list, id) {
  const wanted = cleanText(id);
  return normalizeInstalmentDefaultList(list).filter((note) => note.id !== wanted);
}

export function markInstalmentPaidLate(list, id, paidDate) {
  const date = cleanText(paidDate);
  if (!validInstalmentDefaultDate(date)) return normalizeInstalmentDefaultList(list);
  const wanted = cleanText(id);
  return normalizeInstalmentDefaultList(list).map((note) => {
    if (note.id !== wanted || note.status === 'paid late') return note;
    return { ...note, status: 'paid late', paidDate: date };
  });
}

function compareDefaults(a, b) {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  const byRef = a.scheduleRef.localeCompare(b.scheduleRef);
  if (byRef !== 0) return byRef;
  return a.id.localeCompare(b.id);
}

export function instalmentDefaultsSorted(list) {
  return normalizeInstalmentDefaultList(list).sort(compareDefaults);
}

export function instalmentDefaultsOpen(list) {
  return instalmentDefaultsSorted(list).filter((note) => note.status === 'open');
}

export function instalmentDefaultsForSchedule(list, scheduleRef) {
  const query = cleanText(scheduleRef);
  if (!query) return [];
  return instalmentDefaultsSorted(list).filter((note) => note.scheduleRef === query);
}

export function instalmentDefaultSummaryText(list) {
  const all = normalizeInstalmentDefaultList(list);
  const open = all.filter((note) => note.status === 'open');
  const paidLate = all.length - open.length;
  return `${open.length} open instalment default(s), ${paidLate} paid late, ${all.length} note(s) in total.`;
}

export function instalmentDefaultText(note) {
  if (!note) return 'No instalment default note.';
  const customer = note.customer ? `${note.customer} — ` : '';
  const paid = note.status === 'paid late' ? ` Paid late on ${note.paidDate}.` : '';
  return `${customer}Schedule ${note.scheduleRef}: instalment due ${note.dueDate}, ${note.amountMissed} missed, noted ${note.dateNoted}. Next step: ${note.nextStep}.${paid}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function instalmentDefaultHtml(note) {
  if (!note) return '<p>No instalment default note.</p>';
  return `<p>${escapeHtml(instalmentDefaultText(note))}</p>`;
}

export function instalmentDefaultAllHtml(notes) {
  const clean = Array.isArray(notes) ? instalmentDefaultsSorted(notes) : [];
  if (!clean.length) return '<p>No instalment default notes yet.</p>';
  const rows = clean.map((note) =>
    `<tr><td>${escapeHtml(note.scheduleRef)}</td><td>${escapeHtml(note.customer || 'No customer noted.')}</td><td>${escapeHtml(note.dueDate)}</td><td>${escapeHtml(note.amountMissed)}</td><td>${escapeHtml(note.dateNoted)}</td><td>${escapeHtml(note.nextStep)}</td><td>${escapeHtml(note.status === 'paid late' ? `Paid late ${note.paidDate}` : 'Open')}</td></tr>`,
  ).join('');
  return `<table><thead><tr><th>Schedule</th><th>Customer</th><th>Due date</th><th>Amount missed</th><th>Date noted</th><th>Next step</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function instalmentDefaultCsv(notes) {
  const clean = Array.isArray(notes) ? instalmentDefaultsSorted(notes) : [];
  const header = 'Schedule,Customer,Due date,Amount missed,Date noted,Next step,Status,Paid date';
  const rows = clean.map((note) => [
    note.scheduleRef, note.customer, note.dueDate, note.amountMissed,
    note.dateNoted, note.nextStep, note.status, note.paidDate,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function instalmentDefaultFilename() {
  return 'instalment-defaults.csv';
}
