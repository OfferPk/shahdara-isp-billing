// Plan 252 (Plan 203-350) — Job delay reason log.
//
// Jobs slip, and the reason — waiting for material, weather, a
// customer who was not at home, an access problem — is lost, so
// the same delay repeats without anyone seeing the pattern. This
// module adds only the missing piece: one log entry per delayed
// job — the job reference, the planned date, the actual date, the
// delay reason in plain words, and the days delayed, counted
// from the two dates so the figure can never disagree with them.
//
// The fences, stated plainly:
//   - This logs reasons only. It assigns no blame and changes no
//     schedule by itself: it takes no job, visit, bill, payment,
//     or customer object in, edits none, and returns none. It
//     holds delay entries only, and this module imports nothing.
//   - It is not a second copy of any neighbouring record. The
//     field visit time and travel log holds departure, arrival,
//     and finish times per visit with no delay reason; the job
//     checklist holds steps per job with no dates; and the job
//     cost record holds costs with no reason for a slip — and
//     none of them is read or written here. A delay entry names
//     a job by reference only; it never changes that job.
//   - An entry is never edited, only corrected by a dated
//     follow-up note: there is no edit function, only record,
//     annotate, and remove. A dated follow-up note never rewrites
//     the job reference, the planned date, the actual date, the
//     reason, or the days delayed.
//   - Days delayed is counted from the planned and actual dates,
//     so a job done on its planned date is not a delay at all and
//     cannot be recorded here: the actual date must fall after
//     the planned date.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const JOB_DELAY_STORE = 'shahdara_job_delays_v1';
export const JOB_DELAY_FILENAME = 'job-delay-reasons.csv';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validJobDelayDate(value) {
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

function dateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Whole days between two strict dates, counted on the calendar so
// the figure can never disagree with the dates it comes from.
export function daysBetweenJobDelayDates(plannedDate, actualDate) {
  if (!validJobDelayDate(plannedDate) || !validJobDelayDate(actualDate)) {
    return null;
  }
  const [py, pm, pd] = dateParts(plannedDate);
  const [ay, am, ad] = dateParts(actualDate);
  const planned = Date.UTC(py, pm - 1, pd);
  const actual = Date.UTC(ay, am - 1, ad);
  return Math.round((actual - planned) / 86400000);
}

function cleanFollowUps(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const note = text(item.note);
    if (!validJobDelayDate(date) || !note) continue;
    out.push({ date, note });
  }
  return out;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const jobRef = text(entry.jobRef);
  const plannedDate = text(entry.plannedDate);
  const actualDate = text(entry.actualDate);
  const reason = text(entry.reason);
  if (!id || !jobRef || !plannedDate || !actualDate || !reason) return null;
  if (!validJobDelayDate(plannedDate) || !validJobDelayDate(actualDate)) {
    return null;
  }
  const daysDelayed = daysBetweenJobDelayDates(plannedDate, actualDate);
  if (daysDelayed === null || daysDelayed < 1) return null;
  return {
    id,
    jobRef,
    plannedDate,
    actualDate,
    reason,
    daysDelayed,
    followUps: cleanFollowUps(entry.followUps),
  };
}

export function normalizeJobDelayList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const entry of list) {
    const clean = normalizeEntry(entry);
    if (!clean) continue;
    if (seenIds.has(clean.id)) continue;
    seenIds.add(clean.id);
    out.push(clean);
  }
  return out;
}

export function recordJobDelay(list, entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return null;
  const base = normalizeJobDelayList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  return [...base, clean];
}

export function removeJobDelay(list, id) {
  const base = normalizeJobDelayList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findJobDelay(list, id) {
  const base = normalizeJobDelayList(list);
  return base.find((item) => item.id === text(id)) || null;
}

// A follow-up is a dated note added after the delay was logged,
// never a rewrite: the job reference, the planned date, the
// actual date, the reason, and the days delayed all stay exactly
// as recorded.
export function annotateJobDelay(list, id, followUp) {
  const base = normalizeJobDelayList(list);
  const target = text(id);
  if (!followUp || typeof followUp !== 'object') return list;
  const date = text(followUp.date);
  const note = text(followUp.note);
  if (!validJobDelayDate(date) || !note) return list;
  if (!base.some((item) => item.id === target)) return list;
  return base.map((item) =>
    item.id === target
      ? { ...item, followUps: [...item.followUps, { date, note }] }
      : item,
  );
}

export function jobDelaySorted(list) {
  const base = normalizeJobDelayList(list);
  return [...base].sort((a, b) => {
    if (a.plannedDate !== b.plannedDate) {
      return a.plannedDate.localeCompare(b.plannedDate);
    }
    const byJob = a.jobRef.toLowerCase().localeCompare(b.jobRef.toLowerCase());
    if (byJob !== 0) return byJob;
    return a.id.localeCompare(b.id);
  });
}

export function jobDelaysForReason(list, reason) {
  const wanted = text(reason).toLowerCase();
  return jobDelaySorted(list).filter(
    (item) => item.reason.toLowerCase() === wanted,
  );
}

// Unique reasons, first spelling kept, in reason order (A-Z,
// case-insensitive).
export function jobDelayReasons(list) {
  const base = normalizeJobDelayList(list);
  const seen = new Set();
  const out = [];
  for (const item of base) {
    const key = item.reason.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.reason);
  }
  return out.sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}

function periodBounds(from, to) {
  const fromDate = from === undefined || from === null || from === '' ? null : text(from);
  const toDate = to === undefined || to === null || to === '' ? null : text(to);
  if (fromDate !== null && !validJobDelayDate(fromDate)) return null;
  if (toDate !== null && !validJobDelayDate(toDate)) return null;
  return { from: fromDate, to: toDate };
}

function inPeriod(item, bounds) {
  if (bounds.from !== null && item.plannedDate < bounds.from) return false;
  if (bounds.to !== null && item.plannedDate > bounds.to) return false;
  return true;
}

// Delayed jobs whose planned date falls in the period, both ends
// inclusive. A bad period bound returns null instead of a guess.
export function jobDelaysInPeriod(list, from, to) {
  const bounds = periodBounds(from, to);
  if (bounds === null) return null;
  return jobDelaySorted(list).filter((item) => inPeriod(item, bounds));
}

// Reason counts for the same period, most first, then reason
// A-Z. The counts always sum to the total delayed jobs in that
// period: the total is counted from the same rows, never apart.
export function jobDelayReasonCounts(list, from, to) {
  const bounds = periodBounds(from, to);
  if (bounds === null) return null;
  const rows = normalizeJobDelayList(list).filter((item) =>
    inPeriod(item, bounds),
  );
  const counts = new Map();
  for (const item of rows) {
    const key = item.reason.toLowerCase();
    const found = counts.get(key);
    if (found) {
      found.count += 1;
    } else {
      counts.set(key, { reason: item.reason, count: 1 });
    }
  }
  const ordered = [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.reason.toLowerCase().localeCompare(b.reason.toLowerCase());
  });
  return { rows: ordered, total: rows.length };
}

export function jobDelaySummaryText(list) {
  const base = normalizeJobDelayList(list);
  const reasons = jobDelayReasons(list);
  const reasonWord = reasons.length === 1 ? 'reason' : 'reasons';
  if (base.length === 0) return 'No delayed jobs recorded.';
  return (
    `${base.length} delayed ${base.length === 1 ? 'job' : 'jobs'} logged across ` +
    `${reasons.length} ${reasonWord}. ` +
    `Reason counts sum to the total delayed jobs in the same period.`
  );
}

export function jobDelayText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '';
  const dayWord = clean.daysDelayed === 1 ? 'day' : 'days';
  const followUps =
    clean.followUps.length === 0
      ? 'No dated follow-up notes yet.'
      : `${clean.followUps.length} dated follow-up note${clean.followUps.length === 1 ? '' : 's'}, latest ${clean.followUps[clean.followUps.length - 1].date}.`;
  const reasonText = clean.reason.endsWith('.')
    ? clean.reason
    : `${clean.reason}.`;
  return (
    `Job ${clean.jobRef} was planned for ${clean.plannedDate} and done on ` +
    `${clean.actualDate}, ${clean.daysDelayed} ${dayWord} late. Reason: ${reasonText} ${followUps}`
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

export function jobDelayHtml(list) {
  const rows = jobDelaySorted(list);
  if (rows.length === 0) return '<p>No delayed jobs recorded.</p>';
  const items = rows
    .map((item) => `<li>${escapeHtml(jobDelayText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function jobDelayCsv(list) {
  const rows = jobDelaySorted(list);
  const header = [
    'id',
    'job reference',
    'planned date',
    'actual date',
    'delay reason',
    'days delayed',
    'dated follow-up notes',
  ]
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.jobRef,
      item.plannedDate,
      item.actualDate,
      item.reason,
      item.daysDelayed,
      item.followUps.map((a) => `${a.date}: ${a.note}`).join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function jobDelayFilename() {
  return JOB_DELAY_FILENAME;
}
