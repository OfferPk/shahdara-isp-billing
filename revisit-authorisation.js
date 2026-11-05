// Plan 244 (Plan 203-350) — Site revisit authorisation note.
//
// A technician returns to a site for further work without any
// written authorisation, so the revisit looks unofficial to the
// customer and is hard to justify later. This module adds only the
// missing piece: one authorisation note per site revisit — the
// original job reference, the reason for the revisit, who
// authorised it, the date it was authorised, and the work allowed.
//
// One authorisation note: the id, the original job reference, the
// reason for the revisit in plain words, who authorised it, the
// date authorised, the work allowed in plain words, and the
// superseding note when a newer note replaces it.
//
// The fences, stated plainly:
//   - This authorises the revisit only. It grants no payment, no
//     discount, and no scope change, and it is not the Plan 140
//     second visit rule, which records a due date and an outcome
//     for a second visit, and it is not the Plan 240 fault revisit
//     pattern view, which only counts repeat faults per segment:
//     those modules are neither read nor rewritten here, and this
//     module imports nothing.
//   - A revisit names its authorisation note, and revisits
//     without one are listed as exceptions by
//     unauthorisedRevisits, from the caller-supplied revisit list.
//   - An authorisation note is never edited, only superseded by
//     a dated newer note: there is no edit function, only record,
//     supersede, and remove. Superseding marks the old note with
//     the newer note's id and the date it was superseded, and the
//     old note's job reference, reason, authoriser, date, and
//     work allowed are never rewritten.
//   - Recording authorisation never changes any bill, payment,
//     customer, fault, or job record by itself: the module takes
//     no bill, payment, customer, fault, or job object in, edits
//     none, and returns none. It holds authorisation notes only.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const REVISIT_AUTHORISATION_STORE =
  'shahdara_revisit_authorisations_v1';
export const REVISIT_AUTHORISATION_FILENAME =
  'revisit-authorisations.csv';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validRevisitAuthorisationDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function normalizeNote(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const jobRef = text(entry.jobRef);
  const reason = text(entry.reason);
  const authorisedBy = text(entry.authorisedBy);
  const dateAuthorised = text(entry.dateAuthorised);
  const workAllowed = text(entry.workAllowed);
  if (!id || !jobRef || !reason) return null;
  if (!authorisedBy || !validRevisitAuthorisationDate(dateAuthorised)) {
    return null;
  }
  if (!workAllowed) return null;
  const rawSupersededBy = text(entry.supersededBy);
  const rawSupersededDate = text(entry.supersededDate);
  const supersededBy = rawSupersededBy;
  const supersededDate =
    rawSupersededDate !== '' &&
    validRevisitAuthorisationDate(rawSupersededDate)
      ? rawSupersededDate
      : '';
  return {
    id,
    jobRef,
    reason,
    authorisedBy,
    dateAuthorised,
    workAllowed,
    supersededBy,
    supersededDate,
  };
}

export function normalizeRevisitAuthorisationList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const clean = normalizeNote(entry);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

export function recordRevisitAuthorisation(list, entry) {
  const clean = normalizeNote(entry);
  if (!clean) return null;
  const base = normalizeRevisitAuthorisationList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  return [...base, clean];
}

export function removeRevisitAuthorisation(list, id) {
  const base = normalizeRevisitAuthorisationList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findRevisitAuthorisation(list, id) {
  const base = normalizeRevisitAuthorisationList(list);
  return base.find((item) => item.id === text(id)) || null;
}

// An authorisation note is never edited, only superseded by a
// dated newer note for the same job: the newer note is recorded
// as its own note, and the old note keeps its own words while
// naming the newer note and the date it was superseded. A note
// that is already superseded cannot be superseded again.
export function supersedeRevisitAuthorisation(
  list,
  id,
  supersedingEntry,
  supersededDate,
) {
  const base = normalizeRevisitAuthorisationList(list);
  const target = text(id);
  const when = text(supersededDate);
  const old = base.find((item) => item.id === target);
  if (!old) return list;
  if (old.supersededBy !== '') return list;
  if (!validRevisitAuthorisationDate(when)) return list;
  const next = normalizeNote(supersedingEntry);
  if (!next) return list;
  if (next.jobRef.toLowerCase() !== old.jobRef.toLowerCase()) return list;
  if (base.some((item) => item.id === next.id)) return list;
  return base.map((item) =>
    item.id === target
      ? { ...item, supersededBy: next.id, supersededDate: when }
      : item,
  ).concat([next]);
}

export function revisitAuthorisationSorted(list) {
  const base = normalizeRevisitAuthorisationList(list);
  return [...base].sort((a, b) => {
    if (a.dateAuthorised !== b.dateAuthorised) {
      return a.dateAuthorised.localeCompare(b.dateAuthorised);
    }
    const byJob = a.jobRef
      .toLowerCase()
      .localeCompare(b.jobRef.toLowerCase());
    if (byJob !== 0) return byJob;
    return a.id.localeCompare(b.id);
  });
}

export function revisitAuthorisationsInPeriod(list, from, to) {
  const fromDate = validRevisitAuthorisationDate(text(from))
    ? text(from)
    : '';
  const toDate = validRevisitAuthorisationDate(text(to)) ? text(to) : '';
  return revisitAuthorisationSorted(list).filter((item) => {
    if (fromDate !== '' && item.dateAuthorised < fromDate) return false;
    if (toDate !== '' && item.dateAuthorised > toDate) return false;
    return true;
  });
}

export function revisitAuthorisationsForJob(list, jobRef) {
  const wanted = text(jobRef).toLowerCase();
  if (!wanted) return [];
  return revisitAuthorisationSorted(list).filter(
    (item) => item.jobRef.toLowerCase() === wanted,
  );
}

export function revisitAuthorisationJobs(list) {
  const base = normalizeRevisitAuthorisationList(list);
  const seen = new Map();
  for (const item of base) {
    const key = item.jobRef.toLowerCase();
    if (!seen.has(key)) seen.set(key, item.jobRef);
  }
  return [...seen.values()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}

// The current authorisation for a job is its latest note that has
// not been superseded; a job whose notes are all superseded has
// no current note.
export function currentRevisitAuthorisationForJob(list, jobRef) {
  const notes = revisitAuthorisationsForJob(list, jobRef).filter(
    (item) => item.supersededBy === '',
  );
  if (notes.length === 0) return null;
  return notes[notes.length - 1];
}

function normalizeRevisitRow(row) {
  if (!row || typeof row !== 'object') return null;
  const jobRef = text(row.jobRef);
  const date = text(row.date);
  if (!jobRef || !validRevisitAuthorisationDate(date)) return null;
  return { jobRef, date };
}

// Revisits in the period with no authorisation note are the
// exceptions: every revisit should name its authorisation note.
// A note authorises a revisit only when it was authorised on or
// before the revisit date. The revisit list is supplied by the
// caller; this module never reads any job or visit record itself.
export function unauthorisedRevisits(revisits, authorisations, from, to) {
  if (!Array.isArray(revisits)) return [];
  const fromDate = validRevisitAuthorisationDate(text(from))
    ? text(from)
    : '';
  const toDate = validRevisitAuthorisationDate(text(to)) ? text(to) : '';
  const notes = normalizeRevisitAuthorisationList(authorisations);
  const seen = new Set();
  const out = [];
  for (const row of revisits) {
    const clean = normalizeRevisitRow(row);
    if (!clean) continue;
    if (fromDate !== '' && clean.date < fromDate) continue;
    if (toDate !== '' && clean.date > toDate) continue;
    const authorised = notes.some(
      (item) =>
        item.jobRef.toLowerCase() === clean.jobRef.toLowerCase() &&
        item.dateAuthorised <= clean.date,
    );
    if (authorised) continue;
    const key = `${clean.jobRef.toLowerCase()}|${clean.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.jobRef.toLowerCase().localeCompare(b.jobRef.toLowerCase());
  });
}

export function revisitAuthorisationSummaryText(list) {
  const base = normalizeRevisitAuthorisationList(list);
  const jobs = revisitAuthorisationJobs(base);
  const superseded = base.filter((item) => item.supersededBy !== '').length;
  const noteWord = base.length === 1 ? 'authorisation note' : 'authorisation notes';
  const jobWord = jobs.length === 1 ? 'job' : 'jobs';
  return (
    `${base.length} site revisit ${noteWord} for ${jobs.length} ${jobWord}. ` +
    `${superseded} superseded by a newer note.`
  );
}

export function unauthorisedRevisitSummaryText(
  revisits,
  authorisations,
  from,
  to,
) {
  const missing = unauthorisedRevisits(revisits, authorisations, from, to);
  const revisitWord = missing.length === 1 ? 'revisit' : 'revisits';
  return missing.length === 0
    ? 'No revisits without an authorisation note in the period.'
    : `${missing.length} ${revisitWord} without an authorisation note in the period: ${missing
        .map((row) => `${row.jobRef} (${row.date})`)
        .join(', ')}.`;
}

export function revisitAuthorisationText(note) {
  const clean = normalizeNote(note);
  if (!clean) return '';
  const superseded =
    clean.supersededBy !== ''
      ? ` Superseded by ${clean.supersededBy} on ${clean.supersededDate}.`
      : '';
  return (
    `Revisit ${clean.jobRef} — authorised ${clean.dateAuthorised} by ` +
    `${clean.authorisedBy} — reason: ${clean.reason} — work allowed: ` +
    `${clean.workAllowed}.${superseded}`
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function revisitAuthorisationHtml(list) {
  const rows = revisitAuthorisationSorted(list);
  if (rows.length === 0) {
    return '<p>No site revisit authorisation notes.</p>';
  }
  const items = rows
    .map((item) => `<li>${escapeHtml(revisitAuthorisationText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function revisitAuthorisationCsv(list) {
  const rows = revisitAuthorisationSorted(list);
  const header = [
    'id',
    'job reference',
    'reason',
    'authorised by',
    'date authorised',
    'work allowed',
    'superseded by',
    'superseded date',
  ]
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.jobRef,
      item.reason,
      item.authorisedBy,
      item.dateAuthorised,
      item.workAllowed,
      item.supersededBy,
      item.supersededDate,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function revisitAuthorisationFilename() {
  return REVISIT_AUTHORISATION_FILENAME;
}
