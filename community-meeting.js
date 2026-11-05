// Plan 285 (Plan 203-350) — Community meeting note per mohalla.
//
// Meetings with a mohalla's residents happen, but what was discussed
// and agreed is not recorded, so the same issues are raised at the
// next meeting. This module adds only the missing piece: one meeting
// note per community meeting — the mohalla, the date, the topics
// discussed, the agreed actions, and a note.
//
// What this module is NOT, stated plainly:
//   - It is not a broadcast announcement. That record is a message
//     sent out to a mohalla; this module only records what was
//     discussed and agreed at a meeting that already happened, and
//     the announcement record is neither read nor rewritten here.
//   - It is not a maintenance notice. That draft tells customers
//     about planned work; this module only records a meeting, and
//     the maintenance record is neither read nor rewritten here.
//   - It never sends any message. Recording a note writes a record
//     and nothing else; there is no send step anywhere in this
//     module.
//   - It never changes any customer record, bill, or payment.
//     Recording a meeting creates no bill and changes no customer;
//     this module holds no bill or payment field, so there is
//     nothing here that could rewrite one. A wrong note is removed
//     and recorded again; there is no edit function.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every meeting
//     note, and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A note with no id, no mohalla, or no strict date is refused
//     outright. Unknown fields are dropped, so a note can never
//     grow a customer, bill, or payment field.
//   - A duplicate id is never rewritten.
//   - A mohalla page lists that mohalla's meeting notes newest
//     first, with the agreed actions named.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validCommunityMeetingDate(value) {
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

function splitLines(value) {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split('\n').map((line) => text(line)).filter(Boolean);
  }
  return [];
}

export function normalizeCommunityMeeting(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const mohalla = text(raw.mohalla);
  const date = text(raw.date);
  if (!id || !mohalla) return null;
  if (!validCommunityMeetingDate(date)) return null;
  return {
    id,
    mohalla,
    date,
    topics: splitLines(raw.topics),
    agreedActions: splitLines(raw.agreedActions),
    note: text(raw.note),
  };
}

export function normalizeCommunityMeetingList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeCommunityMeeting(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findCommunityMeeting(list, id) {
  const clean = normalizeCommunityMeetingList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordCommunityMeeting(list, raw) {
  const clean = normalizeCommunityMeetingList(list);
  const entry = normalizeCommunityMeeting(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeCommunityMeeting(list, id) {
  const clean = normalizeCommunityMeetingList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

export function communityMeetingSorted(list) {
  const clean = normalizeCommunityMeetingList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const aMohalla = a.mohalla.toLowerCase();
    const bMohalla = b.mohalla.toLowerCase();
    if (aMohalla !== bMohalla) return aMohalla < bMohalla ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function communityMeetingsForMohalla(list, mohalla) {
  const clean = normalizeCommunityMeetingList(list);
  const wanted = text(mohalla).toLowerCase();
  if (!wanted) return [];
  const rows = clean.filter((entry) => entry.mohalla.toLowerCase() === wanted);
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function communityMeetingMohallas(list) {
  const clean = normalizeCommunityMeetingList(list);
  const seen = new Map();
  for (const entry of clean) {
    const key = entry.mohalla.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.mohalla);
  }
  return [...seen.values()];
}

export function communityMeetingSummaryText(list) {
  const clean = normalizeCommunityMeetingList(list);
  if (clean.length === 0) return 'No community meeting notes recorded.';
  const word = clean.length === 1 ? 'note' : 'notes';
  const mohallas = communityMeetingMohallas(clean);
  const mohallaWord = mohallas.length === 1 ? 'mohalla' : 'mohallas';
  return `${clean.length} community meeting ${word} recorded across ${mohallas.length} ${mohallaWord}.`;
}

export function communityMeetingText(entry) {
  const clean = normalizeCommunityMeeting(entry);
  if (!clean) return 'No community meeting note recorded.';
  const topics = clean.topics.length ? `Topics: ${clean.topics.join('; ')}` : 'No topics recorded';
  const actions = clean.agreedActions.length
    ? `Agreed actions: ${clean.agreedActions.join('; ')}`
    : 'No agreed actions recorded';
  const note = clean.note ? ` — Note: ${clean.note}` : '';
  return `${clean.mohalla} — ${clean.date} — ${topics} — ${actions}${note}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function communityMeetingHtml(entry) {
  const clean = normalizeCommunityMeeting(entry);
  if (!clean) return '<p>No community meeting note recorded.</p>';
  return `<p>${escapeHtml(communityMeetingText(clean))}</p>`;
}

export function communityMeetingAllHtml(list) {
  const rows = communityMeetingSorted(list);
  if (!rows.length) return '<p>No community meeting notes recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(communityMeetingText(entry))}</li>`).join('')}</ul>`;
}

export function communityMeetingsForMohallaHtml(list, mohalla) {
  const rows = communityMeetingsForMohalla(list, mohalla);
  if (!rows.length) return '<p>No community meeting notes recorded for this mohalla.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(communityMeetingText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function communityMeetingCsv(list) {
  const rows = communityMeetingSorted(list);
  const lines = ['"id","mohalla","date","topics","agreed actions","note"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.mohalla),
      csvCell(entry.date),
      csvCell(entry.topics.join('; ')),
      csvCell(entry.agreedActions.join('; ')),
      csvCell(entry.note),
    ].join(','));
  }
  return lines.join('\n');
}

export function communityMeetingFilename() {
  return 'community-meetings.csv';
}
