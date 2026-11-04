// Plan 154 (Plan 101-202) — On-Call Rota for Nights and Weekends.
//
// Out-of-hours faults fall to whoever happens to answer, with no
// rota saying who is on call. This module is that rota: one entry
// per period, with a person, start/end dates, coverage (night or
// weekend), and a contact note for the operator's own use. A date
// lookup shows exactly who is on call that night or weekend, and
// overlapping entries for the same coverage are flagged, so two
// people are never silently on call for the same night.
//
// What this module is NOT, stated plainly:
//   - It is not a message sender. Recording a rota entry never
//     sends any message automatically; the contact note is for
//     the operator's own use only, and no ticket or payment is
//     ever read or written.
//   - It is not a copy of any existing rota module. No such
//     module existed when this plan was checked: the SISP/MD
//     modules for this area were checked first and nothing
//     matching a dated per-person night/weekend on-call rota was
//     found (the "rota" hits in the codebase are unrelated
//     rotations in tool and chart code), so only this missing
//     piece is added here, and no existing module is read or
//     written.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     entry, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed entries are refused outright, never stored
//     half-formed: an entry needs an id, a person, a real start
//     date, a real end date that is not before the start, and a
//     coverage of exactly "night" or "weekend". Unknown fields
//     are dropped, so an entry can never grow a message,
//     ticket, or payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal of the entry itself.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - A date lookup returns only the entries covering that
//     date (and, when a coverage is asked for, only that
//     coverage), person A-Z then id A-Z, so the operator sees
//     exactly who is on call — never a guessed name.
//   - Overlaps are flagged, never resolved silently: two
//     entries with the same coverage whose date ranges share
//     at least one day are returned as a pair, so the operator
//     fixes the rota instead of the rota picking a winner.

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

/** Coverage is exactly "night" or "weekend", anything else refused. */
function cleanCoverage(value) {
  const text = cleanText(value).toLowerCase();
  return text === 'night' || text === 'weekend' ? text : null;
}

/** Normalize one rota entry, or null when half-formed. */
export function normalizeOnCallEntry(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const person = cleanText(record.person);
  const startDate = strictDate(record.startDate);
  const endDate = strictDate(record.endDate);
  const coverage = cleanCoverage(record.coverage);
  if (!id || !person || !startDate || !endDate || !coverage) return null;
  if (endDate < startDate) return null;
  const contactNote = cleanText(record.contactNote);
  return { id, person, startDate, endDate, coverage, contactNote };
}

/** Normalize a list: half-formed entries dropped, order kept. */
export function normalizeOnCallList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const clean = normalizeOnCallEntry(record);
    if (clean) out.push(clean);
  }
  return out;
}

/** Find one rota entry by id, or null. */
export function findOnCallEntry(list, id) {
  const clean = normalizeOnCallList(list);
  const want = cleanText(id);
  return clean.find((item) => item.id === want) || null;
}

/**
 * Add a rota entry, or leave the list unchanged when the entry
 * is half-formed or a duplicate id carries different figures.
 * An identical re-save leaves the list unchanged.
 */
export function upsertOnCallEntry(list, record) {
  const clean = normalizeOnCallList(list);
  const next = normalizeOnCallEntry(record);
  if (!next) return clean;
  const existing = clean.find((item) => item.id === next.id);
  if (existing) {
    const same = existing.person === next.person
      && existing.startDate === next.startDate
      && existing.endDate === next.endDate
      && existing.coverage === next.coverage
      && existing.contactNote === next.contactNote;
    return same ? clean : clean;
  }
  return [...clean, next];
}

/** Remove a rota entry by id; unknown ids leave the list unchanged. */
export function removeOnCallEntry(list, id) {
  const clean = normalizeOnCallList(list);
  const want = cleanText(id);
  return clean.filter((item) => item.id !== want);
}

/**
 * Exactly who is on call on one date: entries whose period covers
 * the date, person A-Z then id A-Z. When a coverage is given,
 * only that coverage is returned; an invalid date gives an empty
 * list, never a guessed name.
 */
export function onCallForDate(list, date, coverage) {
  const want = strictDate(date);
  if (!want) return [];
  const wantCoverage = coverage === undefined || coverage === null || coverage === ''
    ? null
    : cleanCoverage(coverage);
  if (coverage !== undefined && coverage !== null && coverage !== '' && !wantCoverage) return [];
  const clean = normalizeOnCallList(list)
    .filter((item) => item.startDate <= want && want <= item.endDate)
    .filter((item) => !wantCoverage || item.coverage === wantCoverage);
  clean.sort((a, b) => compareText(a.person, b.person) || compareText(a.id, b.id));
  return clean;
}

/**
 * Overlapping pairs, flagged not resolved: two entries with the
 * same coverage whose date ranges share at least one day, each
 * pair once, first entry id A-Z then second id A-Z.
 */
export function findOnCallOverlaps(list) {
  const clean = normalizeOnCallList(list);
  const pairs = [];
  for (let i = 0; i < clean.length; i += 1) {
    for (let j = i + 1; j < clean.length; j += 1) {
      const a = clean[i];
      const b = clean[j];
      if (a.coverage !== b.coverage) continue;
      if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
        const [first, second] = compareText(a.id, b.id) <= 0 ? [a, b] : [b, a];
        pairs.push({ first, second });
      }
    }
  }
  pairs.sort((x, y) => compareText(x.first.id, y.first.id) || compareText(x.second.id, y.second.id));
  return pairs;
}

/** Summary text: entries / people / overlaps counts. */
export function onCallSummaryText(list) {
  const clean = normalizeOnCallList(list);
  const people = new Set(clean.map((item) => item.person)).size;
  const overlaps = findOnCallOverlaps(list).length;
  return `${clean.length} rota entr${clean.length === 1 ? 'y' : 'ies'} for ${people} person${people === 1 ? '' : 's'}, ${overlaps} overlapping pair${overlaps === 1 ? '' : 's'} flagged.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function onCallRowHtml(item) {
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.person)}</td>`
    + `<td>${esc(item.startDate)}</td><td>${esc(item.endDate)}</td>`
    + `<td>${esc(item.coverage)}</td><td>${esc(item.contactNote || '—')}</td></tr>`;
}

function onCallTableHtml(rows, intro) {
  const body = rows.map(onCallRowHtml).join('');
  return `<p>${intro}</p>`
    + '<table><thead><tr><th>Id</th><th>Person</th>'
    + '<th>From</th><th>To</th><th>Coverage</th><th>Contact note</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

/**
 * Date lookup as HTML: exactly who is on call that date (and
 * coverage, when asked). No match says so plainly.
 */
export function onCallLookupHtml(list, date, coverage) {
  const rows = onCallForDate(list, date, coverage);
  if (rows.length === 0) {
    return '<p>Nobody is on call for that date and coverage. Check the rota before disturbing anyone.</p>';
  }
  const coverageText = coverage ? ` (${esc(cleanText(coverage).toLowerCase())})` : '';
  return onCallTableHtml(rows, `On call on ${esc(cleanText(date))}${coverageText} — call this person first.`);
}

/** Full rota as HTML, earliest start first (then person A-Z, then id A-Z). */
export function onCallAllHtml(list) {
  const clean = normalizeOnCallList(list);
  if (clean.length === 0) return '<p>No rota entries recorded yet.</p>';
  clean.sort((a, b) => compareText(a.startDate, b.startDate) || compareText(a.person, b.person) || compareText(a.id, b.id));
  return onCallTableHtml(clean, 'Full on-call rota, earliest first.');
}

/** Overlapping pairs as HTML, flagged plainly. No overlaps says so. */
export function onCallOverlapHtml(list) {
  const pairs = findOnCallOverlaps(list);
  if (pairs.length === 0) return '<p>No overlapping entries for the same coverage. The rota is clean.</p>';
  const rows = pairs.map(({ first, second }) => `<tr><td>${esc(first.id)} — ${esc(first.person)}</td>`
    + `<td>${esc(second.id)} — ${esc(second.person)}</td>`
    + `<td>${esc(first.coverage)}</td>`
    + `<td>${esc(first.startDate)} to ${esc(first.endDate)}</td>`
    + `<td>${esc(second.startDate)} to ${esc(second.endDate)}</td></tr>`).join('');
  return '<p>Overlapping entries for the same coverage — fix the rota so only one person is on call:</p>'
    + '<table><thead><tr><th>First entry</th><th>Second entry</th>'
    + '<th>Coverage</th><th>First period</th><th>Second period</th></tr></thead><tbody>'
    + rows + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of rota entries. */
export function onCallCsv(list) {
  const rows = normalizeOnCallList(list);
  const lines = ['id,person,startDate,endDate,coverage,contactNote'];
  for (const item of rows) {
    lines.push([item.id, item.person, item.startDate, item.endDate, item.coverage, item.contactNote].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the rota. */
export function onCallFilename() {
  return 'on-call-rota.csv';
}
