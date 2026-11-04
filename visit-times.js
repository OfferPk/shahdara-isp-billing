// Plan 155 (Plan 101-202) — Field Visit Time and Travel Log.
//
// Nobody knows how long visits and travel between mohallas
// actually take, so routes are planned on guesswork. This module
// is the measurement: one time record per visit with a visit
// link, a route-day date, a departure time, an arrival time, a
// finish time, and a travel note. A route day shows its total
// travel time and total visit time from its records, so the next
// route across the 11 mohallas is planned on measured times,
// not guesses.
//
// What this module is NOT, stated plainly:
//   - It is not a record of what happened on a visit. Recording
//     times here never writes, changes, or replaces any visit
//     outcome, any ticket, any bill, or any payment anywhere
//     else: the times only say how long the travel and the
//     visit took.
//   - It is not a second copy of any neighbouring visit log.
//     No existing module records departure, arrival, and finish
//     times per visit: the Saad visit log (saad-visits.js)
//     holds start/end time and hours for one person's paid job
//     record, the route proof (route-proof.js) holds which
//     stops were visited or skipped with no times at all, and
//     the day-part schedule (visit-day-part.js) and visit
//     outcomes (visit-outcomes.js) hold bookings and outcomes
//     with no times — and none of them is read or written
//     here. A time record names a visit by id only; it never
//     changes that visit.
//   - It is not proof that a visit happened at those times.
//     The times say what the operator recorded; the module
//     verifies format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a visit link, a real
//     date, and three real HH:MM times in order — departure
//     no later than arrival, arrival no later than finish.
//     A record with impossible times (finish before arrival,
//     or arrival before departure) is refused outright.
//     Unknown fields are dropped, so a record can never grow
//     a visit-outcome, ticket, bill, or payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal of the record itself.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass). Times are real HH:MM
//     wall-clock times on one day (24:00 is rejected, never
//     guessed); travel and visit minutes are simple
//     differences, never negative.

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

/** Strict HH:MM wall-clock time, or null. */
function strictTime(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${match[1]}:${match[2]}`;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Minutes since midnight for a strict HH:MM time. */
function minutesOf(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Travel minutes for one record: arrival minus departure, never negative. */
export function travelMinutes(record) {
  const clean = normalizeVisitTime(record);
  if (!clean) return null;
  return minutesOf(clean.arrivalTime) - minutesOf(clean.departureTime);
}

/** Visit minutes for one record: finish minus arrival, never negative. */
export function visitMinutes(record) {
  const clean = normalizeVisitTime(record);
  if (!clean) return null;
  return minutesOf(clean.finishTime) - minutesOf(clean.arrivalTime);
}

/** Normalize one time record, or null when half-formed or impossible. */
export function normalizeVisitTime(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const visitId = cleanText(record.visitId);
  const date = strictDate(record.date);
  const departureTime = strictTime(record.departureTime);
  const arrivalTime = strictTime(record.arrivalTime);
  const finishTime = strictTime(record.finishTime);
  if (!id || !visitId || !date || !departureTime || !arrivalTime || !finishTime) return null;
  if (arrivalTime < departureTime) return null;
  if (finishTime < arrivalTime) return null;
  const travelNote = cleanText(record.travelNote);
  return { id, visitId, date, departureTime, arrivalTime, finishTime, travelNote };
}

/** Normalize a list: half-formed records dropped, order kept. */
export function normalizeVisitTimeList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const clean = normalizeVisitTime(record);
    if (clean) out.push(clean);
  }
  return out;
}

/** Find one time record by id, or null. */
export function findVisitTime(list, id) {
  const clean = normalizeVisitTimeList(list);
  const want = cleanText(id);
  return clean.find((item) => item.id === want) || null;
}

/**
 * Add a time record, or leave the list unchanged when the record
 * is half-formed, impossible, or a duplicate id carrying
 * different figures. An identical re-save leaves the list
 * unchanged.
 */
export function upsertVisitTime(list, record) {
  const clean = normalizeVisitTimeList(list);
  const next = normalizeVisitTime(record);
  if (!next) return clean;
  const existing = clean.find((item) => item.id === next.id);
  if (existing) {
    const same = existing.visitId === next.visitId
      && existing.date === next.date
      && existing.departureTime === next.departureTime
      && existing.arrivalTime === next.arrivalTime
      && existing.finishTime === next.finishTime
      && existing.travelNote === next.travelNote;
    return same ? clean : clean;
  }
  return [...clean, next];
}

/** Remove a time record by id; unknown ids leave the list unchanged. */
export function removeVisitTime(list, id) {
  const clean = normalizeVisitTimeList(list);
  const want = cleanText(id);
  return clean.filter((item) => item.id !== want);
}

/** Records for one route-day date, departure time then id A-Z. */
export function visitTimesForDate(list, date) {
  const want = strictDate(date);
  if (!want) return [];
  const clean = normalizeVisitTimeList(list).filter((item) => item.date === want);
  clean.sort((a, b) => compareText(a.departureTime, b.departureTime) || compareText(a.id, b.id));
  return clean;
}

/**
 * Totals for one route day: its records plus total travel and
 * total visit minutes. An invalid date gives null, never a
 * guessed total.
 */
export function routeDayTotals(list, date) {
  const want = strictDate(date);
  if (!want) return null;
  const records = visitTimesForDate(list, want);
  let travel = 0;
  let visit = 0;
  for (const record of records) {
    travel += minutesOf(record.arrivalTime) - minutesOf(record.departureTime);
    visit += minutesOf(record.finishTime) - minutesOf(record.arrivalTime);
  }
  return { date: want, records, travelMinutes: travel, visitMinutes: visit, totalMinutes: travel + visit };
}

/** Totals for every route day present, newest date first. */
export function allRouteDayTotals(list) {
  const clean = normalizeVisitTimeList(list);
  const dates = [...new Set(clean.map((item) => item.date))];
  dates.sort((a, b) => compareText(b, a));
  return dates.map((date) => routeDayTotals(list, date));
}

/** Minutes as "45 min" or "1h 30m". */
export function formatMinutes(minutes) {
  const total = Number(minutes) || 0;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Summary text: records / route days / total travel / total visit. */
export function visitTimeSummaryText(list) {
  const clean = normalizeVisitTimeList(list);
  const days = new Set(clean.map((item) => item.date)).size;
  let travel = 0;
  let visit = 0;
  for (const record of clean) {
    travel += minutesOf(record.arrivalTime) - minutesOf(record.departureTime);
    visit += minutesOf(record.finishTime) - minutesOf(record.arrivalTime);
  }
  return `${clean.length} time record${clean.length === 1 ? '' : 's'} across ${days} route day${days === 1 ? '' : 's'}: ${formatMinutes(travel)} travel, ${formatMinutes(visit)} on visits.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function visitTimeRowHtml(item) {
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.visitId)}</td>`
    + `<td>${esc(item.date)}</td><td>${esc(item.departureTime)}</td>`
    + `<td>${esc(item.arrivalTime)}</td><td>${esc(item.finishTime)}</td>`
    + `<td>${esc(formatMinutes(minutesOf(item.arrivalTime) - minutesOf(item.departureTime)))}</td>`
    + `<td>${esc(formatMinutes(minutesOf(item.finishTime) - minutesOf(item.arrivalTime)))}</td>`
    + `<td>${esc(item.travelNote || '—')}</td></tr>`;
}

function visitTimeTableHtml(rows, intro) {
  const body = rows.map(visitTimeRowHtml).join('');
  return `<p>${intro}</p>`
    + '<table><thead><tr><th>Id</th><th>Visit</th>'
    + '<th>Date</th><th>Departed</th><th>Arrived</th><th>Finished</th>'
    + '<th>Travel</th><th>Visit</th><th>Travel note</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

/** All time records as HTML, newest date first (then departure, then id). */
export function visitTimeAllHtml(list) {
  const clean = normalizeVisitTimeList(list);
  if (clean.length === 0) return '<p>No visit times recorded yet.</p>';
  clean.sort((a, b) => compareText(b.date, a.date) || compareText(a.departureTime, b.departureTime) || compareText(a.id, b.id));
  return visitTimeTableHtml(clean, 'All visit times, newest route day first.');
}

/** One route day as HTML: its records plus its totals. */
export function routeDayHtml(list, date) {
  const totals = routeDayTotals(list, date);
  if (!totals) return '<p>Pick a real route-day date to see its totals.</p>';
  if (totals.records.length === 0) return `<p>No time records for ${esc(cleanText(date))}. Nothing to total yet.</p>`;
  return visitTimeTableHtml(totals.records, `Route day ${esc(totals.date)}: ${formatMinutes(totals.travelMinutes)} travel, ${formatMinutes(totals.visitMinutes)} on visits, ${formatMinutes(totals.totalMinutes)} in total.`);
}

/** Every route day's totals as HTML, newest date first. */
export function routeDayTotalsHtml(list) {
  const days = allRouteDayTotals(list);
  if (days.length === 0) return '<p>No route days recorded yet.</p>';
  const rows = days.map((day) => `<tr><td>${esc(day.date)}</td><td>${day.records.length}</td>`
    + `<td>${esc(formatMinutes(day.travelMinutes))}</td>`
    + `<td>${esc(formatMinutes(day.visitMinutes))}</td>`
    + `<td>${esc(formatMinutes(day.totalMinutes))}</td></tr>`).join('');
  return '<p>Route-day totals, newest first — plan the next route on these, not on guesses:</p>'
    + '<table><thead><tr><th>Route day</th><th>Visits</th>'
    + '<th>Total travel</th><th>Total visit time</th><th>Total</th></tr></thead><tbody>'
    + rows + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of time records. */
export function visitTimeCsv(list) {
  const rows = normalizeVisitTimeList(list);
  const lines = ['id,visitId,date,departureTime,arrivalTime,finishTime,travelNote'];
  for (const item of rows) {
    lines.push([item.id, item.visitId, item.date, item.departureTime, item.arrivalTime, item.finishTime, item.travelNote].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the time log. */
export function visitTimeFilename() {
  return 'visit-times.csv';
}
