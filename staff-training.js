// Plan 292 (Plan 203-350) — Training record per staff member.
//
// Training given to a staff member (a new device, a safety step, a
// billing step) is never written down, so nobody knows who was
// trained in what. This module adds only the missing piece: one
// training record per session — the staff member, the topic, the
// date, the trainer, and the outcome in plain words — so training
// is listed per staff member with topic, date, and trainer visible.
//
// What this module is NOT, stated plainly:
//   - It is not a bill, payment, customer, or staff-record
//     change. Recording training never changes any bill, payment,
//     customer record, or staff record by itself; it only records
//     that training happened, for whom, about what, and when.
//   - It is not the field-skills training note. Field skills
//     practised or observed on site stay in their own record;
//     this module covers general training after onboarding and
//     never reads or rewrites that record.
//   - It is not the new-collector onboarding checklist.
//     Onboarding steps for a new collector stay in their own
//     record; this module covers training after onboarding only.
//   - It is not a live record. A past training entry is
//     read-only: there is no edit function, only record, find,
//     and remove, so a wrong entry is removed and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     entry, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - An entry with no id, no staff member, no topic, no strict
//     date, or no trainer is refused outright. Unknown fields
//     are dropped, so an entry can never grow a bill, payment,
//     customer, or staff field.
//   - A duplicate id is never rewritten.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validStaffTrainingDate(value) {
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

/**
 * One staff training record, or null when half-formed. A record
 * needs an id, a staff member, a topic, a strict date, and a
 * trainer. The outcome is plain words and optional; unknown
 * fields are dropped; the input is never mutated.
 */
export function normalizeStaffTraining(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const staffMember = text(raw.staffMember);
  const topic = text(raw.topic);
  const date = text(raw.date);
  const trainer = text(raw.trainer);
  if (!id || !staffMember || !topic || !trainer) return null;
  if (!validStaffTrainingDate(date)) return null;
  return {
    id,
    staffMember,
    topic,
    date,
    trainer,
    outcome: text(raw.outcome),
  };
}

/** Normalised records only; a duplicate id is never rewritten, the first stays. */
export function normalizeStaffTrainingList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeStaffTraining(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findStaffTraining(list, id) {
  const clean = normalizeStaffTrainingList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordStaffTraining(list, raw) {
  const clean = normalizeStaffTrainingList(list);
  const entry = normalizeStaffTraining(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeStaffTraining(list, id) {
  const clean = normalizeStaffTrainingList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

/** Records in date order, then staff member A-Z, then id, so the same list always reads the same way. */
export function staffTrainingSorted(list) {
  const clean = normalizeStaffTrainingList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const aStaff = a.staffMember.toLowerCase();
    const bStaff = b.staffMember.toLowerCase();
    if (aStaff !== bStaff) return aStaff < bStaff ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Training for one staff member, in date order; the match is case-insensitive. */
export function staffTrainingForStaff(list, staffMember) {
  const wanted = text(staffMember).toLowerCase();
  if (!wanted) return [];
  return staffTrainingSorted(list).filter((entry) => entry.staffMember.toLowerCase() === wanted);
}

/** Staff members with training recorded, first spelling kept, A-Z. */
export function staffTrainingStaffList(list) {
  const clean = normalizeStaffTrainingList(list);
  const seen = new Map();
  for (const entry of clean) {
    const key = entry.staffMember.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.staffMember);
  }
  return [...seen.values()].sort((a, b) => {
    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();
    return lowerA < lowerB ? -1 : lowerA > lowerB ? 1 : 0;
  });
}

/** Training on one topic, in date order; the match is case-insensitive. */
export function staffTrainingForTopic(list, topic) {
  const wanted = text(topic).toLowerCase();
  if (!wanted) return [];
  return staffTrainingSorted(list).filter((entry) => entry.topic.toLowerCase() === wanted);
}

export function staffTrainingSummaryText(list) {
  const clean = normalizeStaffTrainingList(list);
  if (clean.length === 0) return 'No staff training recorded.';
  const word = clean.length === 1 ? 'record' : 'records';
  const latest = staffTrainingSorted(clean).at(-1);
  return `${clean.length} staff training ${word} recorded. Latest training on ${latest.date}.`;
}

/** Plain-words text for one record: who, what topic, when, who trained them, and the outcome when given. */
export function staffTrainingEntryText(entry) {
  const clean = normalizeStaffTraining(entry);
  if (!clean) return 'No staff training recorded.';
  const base = `${clean.staffMember} — ${clean.topic} — ${clean.date} — trainer ${clean.trainer}`;
  return clean.outcome ? `${base} — ${clean.outcome}` : base;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function staffTrainingEntryHtml(entry) {
  const clean = normalizeStaffTraining(entry);
  if (!clean) return '<p>No staff training recorded.</p>';
  return `<p>${escapeHtml(staffTrainingEntryText(clean))}</p>`;
}

export function staffTrainingStaffHtml(list, staffMember) {
  const rows = staffTrainingForStaff(list, staffMember);
  if (!rows.length) return `<p>No training recorded for ${escapeHtml(text(staffMember))}.</p>`;
  const word = rows.length === 1 ? 'session' : 'sessions';
  return `<p>${escapeHtml(rows[0].staffMember)} — ${rows.length} training ${word} recorded.</p><ul>${rows.map((entry) => `<li>${escapeHtml(staffTrainingEntryText(entry))}</li>`).join('')}</ul>`;
}

export function staffTrainingAllHtml(list) {
  const rows = staffTrainingSorted(list);
  if (!rows.length) return '<p>No staff training recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(staffTrainingEntryText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function staffTrainingCsv(list) {
  const rows = staffTrainingSorted(list);
  const lines = ['"id","staff member","topic","date","trainer","outcome"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.staffMember),
      csvCell(entry.topic),
      csvCell(entry.date),
      csvCell(entry.trainer),
      csvCell(entry.outcome),
    ].join(','));
  }
  return lines.join('\n');
}

export function staffTrainingFilename() {
  return 'staff-training.csv';
}
