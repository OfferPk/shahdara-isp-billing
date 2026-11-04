// Plan 160 (Plan 101-202) — Field Handover Note.
//
// When field work passes from one collector or operator to
// another, open jobs and warnings are passed by word of mouth
// and lost. This module is the written handover: one note per
// handover with a date, a from person, a to person, the open
// jobs listed with their current status, and warnings. A second
// collector can pick up the first collector's open field work
// cleanly, with warnings intact.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of any neighbouring module.
//     No existing module records a field handover note: the
//     cash handovers elsewhere in the app count cash changing
//     hands, the route proof records visited and skipped stops,
//     and the visit log records a visit that already happened
//     — and none of them is read or written here. A handover
//     note names people, jobs, and warnings only.
//   - It is not an action on any other record. A handover
//     never changes any ticket, visit, bill, or payment record
//     by itself; it only lists open jobs with their status so
//     the next person can pick them up.
//   - It is not proof that a job is really open. The record
//     says what the operator recorded; the module verifies
//     format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, and never touches another record type.
//   - A handover with no from person, no to person, or no
//     date is refused outright, as is any impossible date.
//     Unknown fields are dropped, so a record can never grow
//     a field from any other record type.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal of the record itself.
//   - Jobs keep the order they were recorded in. Each job
//     carries its current status in plain words; a job with
//     no status recorded counts as open, so nothing open is
//     ever hidden by a missing status word.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
function strictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  if (day < 1 || day > limit) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Normalize one open job. A plain string becomes an open job;
 * an object keeps its description and status (default open).
 * A job with no description is dropped (null).
 */
export function normalizeHandoverJob(job) {
  if (typeof job === 'string') {
    const description = job.trim();
    return description ? { description, status: 'open' } : null;
  }
  if (!job || typeof job !== 'object') return null;
  const description = cleanText(job.description);
  if (!description) return null;
  const status = cleanText(job.status).toLowerCase() || 'open';
  return { description, status };
}

/** Normalize a jobs list: undescribed jobs dropped, order kept. */
export function normalizeHandoverJobs(jobs) {
  if (!Array.isArray(jobs)) return [];
  const out = [];
  for (const job of jobs) {
    const clean = normalizeHandoverJob(job);
    if (clean) out.push(clean);
  }
  return out;
}

/** Normalize one field handover note, or null when half-formed. */
export function normalizeHandover(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const date = strictDate(record.date);
  const from = cleanText(record.from);
  const to = cleanText(record.to);
  if (!id || !date || !from || !to) return null;
  return {
    id,
    date,
    from,
    to,
    jobs: normalizeHandoverJobs(record.jobs),
    warnings: cleanText(record.warnings),
  };
}

/** Normalize a list: half-formed records dropped, order kept. */
export function normalizeHandoverList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const clean = normalizeHandover(record);
    if (clean) out.push(clean);
  }
  return out;
}

/** Find one field handover note by id, or null. */
export function findHandover(list, id) {
  const clean = normalizeHandoverList(list);
  const want = cleanText(id);
  return clean.find((item) => item.id === want) || null;
}

function sameHandover(a, b) {
  return a.date === b.date
    && a.from === b.from
    && a.to === b.to
    && a.warnings === b.warnings
    && a.jobs.length === b.jobs.length
    && a.jobs.every((job, i) => job.description === b.jobs[i].description
      && job.status === b.jobs[i].status);
}

/**
 * Add a field handover note, or leave the list unchanged when
 * the record is half-formed or a duplicate id carrying
 * different figures. An identical re-save leaves the list
 * unchanged.
 */
export function upsertHandover(list, record) {
  const clean = normalizeHandoverList(list);
  const next = normalizeHandover(record);
  if (!next) return clean;
  const existing = clean.find((item) => item.id === next.id);
  if (existing) return sameHandover(existing, next) ? clean : clean;
  return [...clean, next];
}

/** Remove a field handover note by id; unknown ids leave the list unchanged. */
export function removeHandover(list, id) {
  const clean = normalizeHandoverList(list);
  const want = cleanText(id);
  return clean.filter((item) => item.id !== want);
}

/** Jobs of one handover, in recorded order; [] when unknown or jobless. */
export function handoverJobs(list, id) {
  const found = findHandover(list, id);
  return found ? found.jobs : [];
}

/** Open jobs of one handover (status open), in recorded order. */
export function handoverOpenJobs(list, id) {
  return handoverJobs(list, id).filter((job) => job.status === 'open');
}

/** Handovers involving one person (from or to, case-insensitive), newest first. */
export function handoversForPerson(list, person) {
  const want = cleanText(person).toLowerCase();
  if (!want) return [];
  const clean = normalizeHandoverList(list)
    .filter((item) => item.from.toLowerCase() === want || item.to.toLowerCase() === want);
  clean.sort((a, b) => compareText(b.date, a.date) || compareText(a.id, b.id));
  return clean;
}

/** Every person named in a handover (from or to), A-Z by lowercase, first spelling kept. */
export function handoverPeople(list) {
  const clean = normalizeHandoverList(list);
  const byLower = new Map();
  for (const item of clean) {
    for (const name of [item.from, item.to]) {
      const key = name.toLowerCase();
      if (!byLower.has(key)) byLower.set(key, name);
    }
  }
  return [...byLower.values()].sort((a, b) => compareText(a.toLowerCase(), b.toLowerCase()));
}

/** Summary text: notes / people / open jobs counts. */
export function handoverSummaryText(list) {
  const clean = normalizeHandoverList(list);
  const people = handoverPeople(list).length;
  const open = clean.reduce((sum, item) => sum + item.jobs.filter((job) => job.status === 'open').length, 0);
  return `${clean.length} field handover note${clean.length === 1 ? '' : 's'} across ${people} person${people === 1 ? '' : 's'}, ${open} open job${open === 1 ? '' : 's'} listed.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function handoverJobsHtml(jobs) {
  if (jobs.length === 0) return '<p>No open jobs listed.</p>';
  const rows = jobs.map((job) => `<tr><td>${esc(job.description)}</td><td>${esc(job.status)}</td></tr>`).join('');
  return '<table><thead><tr><th>Open job</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function handoverCardHtml(item) {
  return `<h5>${esc(item.id)} — ${esc(item.date)}: ${esc(item.from)} → ${esc(item.to)}</h5>`
    + handoverJobsHtml(item.jobs)
    + (item.warnings ? `<p>Warnings: ${esc(item.warnings)}</p>` : '<p>No warnings recorded.</p>');
}

/** All field handover notes as HTML, newest first, then id A-Z. */
export function handoverAllHtml(list) {
  const clean = normalizeHandoverList(list);
  if (clean.length === 0) return '<p>No field handover notes recorded yet.</p>';
  clean.sort((a, b) => compareText(b.date, a.date) || compareText(a.id, b.id));
  return '<p>All field handover notes, newest first — open jobs with their current status, warnings intact.</p>'
    + clean.map((item) => handoverCardHtml(item)).join('');
}

/** One person's handovers as HTML, newest first. */
export function handoverPersonHtml(list, person) {
  const records = handoversForPerson(list, person);
  if (records.length === 0) return '<p>No handovers recorded for this person yet.</p>';
  return `<p>Handovers involving ${esc(person)}, newest first.</p>`
    + records.map((item) => handoverCardHtml(item)).join('');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** All field handover notes as CSV text. */
export function handoverCsv(list) {
  const rows = normalizeHandoverList(list);
  const lines = ['id,date,from,to,jobs,warnings'];
  for (const item of rows) {
    const jobs = item.jobs.map((job) => `${job.description} [${job.status}]`).join('; ');
    lines.push([item.id, item.date, item.from, item.to, jobs, item.warnings].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the field handover export. */
export function handoverFilename() {
  return 'field-handovers.csv';
}
