// Plan 311 (Plan 203-350) — Staff duty roster.
//
// Who is on duty each day of the week is arranged verbally,
// so cover gaps are found only when a customer arrives and
// nobody is there. This module adds only the missing piece:
// one posted roster entry per day of a week — the week, the
// day, the staff member on duty, the duty in plain words,
// and who posted it — so each week shows its days with the
// staff member on duty visible, and a day with nobody
// posted stands out as a gap before the week starts.
//
// What this module is NOT, stated plainly:
//   - It is not the Plan 154 on-call rota, which covers
//     out-of-hours call only. That rota already exists and
//     is neither read nor rewritten here; this roster is
//     the general weekly shop and field cover, and it
//     never says who is on call at night.
//   - It is not the Plan 310 daily shop diary, which
//     records what happened on a day. That diary already
//     exists and is neither read nor rewritten here; a
//     roster entry says who will be on duty, it records
//     nothing about what happened.
//   - It is not the Plan 309 absence handover checklist,
//     which lists work for a cover period. That checklist
//     already exists and is neither read nor rewritten
//     here; a roster entry names the person on duty, it
//     lists no handover jobs.
//   - It is not the Plan 202 owner absence cover roster,
//     which covers the owner being away. That roster
//     already exists and is neither read nor rewritten
//     here; this roster covers ordinary weekly staff duty.
//   - It is not a bill, payment, customer, or leave
//     change. Posting a roster never changes any bill,
//     payment, customer record, or leave record by itself.
//   - It is not an editable record. A past entry is never
//     silently edited: there is no edit function, only
//     record, find, and remove; a wrong entry is removed
//     and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every entry, and the module never reads storage,
//     the clock, or the network, and never mutates an
//     input.
//   - An entry with no id, no strict week date, no real
//     weekday, no staff member, no duty in plain words,
//     or no posted-by name is refused outright. Unknown
//     fields are dropped, so an entry can never grow a
//     bill, payment, customer, or leave field.
//   - One entry per week and day: a second entry for a
//     week and day that already has one is never written
//     over the first; the first entry for that day stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const DUTY_ROSTER_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_ALIASES = {
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
  sun: 'Sunday',
  sunday: 'Sunday',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validDutyRosterWeek(value) {
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
 * One weekday in canonical form — Monday through Sunday —
 * or null when the value names no real weekday. Full names
 * and three-letter short forms are accepted, in any case.
 */
export function validDutyRosterDay(value) {
  const key = text(value).toLowerCase();
  if (!key) return null;
  return DAY_ALIASES[key] ?? null;
}

/**
 * One roster entry, or null when half-formed. An entry
 * needs an id, a strict week date, a real weekday, a staff
 * member, a duty in plain words, and a posted-by name.
 * Unknown fields are dropped; the input is never mutated.
 */
export function normalizeDutyRosterEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const week = text(raw.week);
  const day = validDutyRosterDay(raw.day);
  const staff = text(raw.staff);
  const duty = text(raw.duty);
  const postedBy = text(raw.postedBy);
  if (!id) return null;
  if (!validDutyRosterWeek(week)) return null;
  if (!day) return null;
  if (!staff) return null;
  if (!duty) return null;
  if (!postedBy) return null;
  return { id, week, day, staff, duty, postedBy };
}

/** Normalised roster entries only; a duplicate id is never rewritten, the first stays. */
export function normalizeDutyRosterEntryList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeDutyRosterEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findDutyRosterEntry(list, id) {
  const clean = normalizeDutyRosterEntryList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

/** The roster entry for one week and day, or null when that day has nobody posted. */
export function findDutyRosterEntryForWeekDay(list, week, day) {
  const clean = normalizeDutyRosterEntryList(list);
  const wantedWeek = text(week);
  const wantedDay = validDutyRosterDay(day);
  if (!wantedWeek || !wantedDay) return null;
  return clean.find((entry) => entry.week === wantedWeek && entry.day === wantedDay) ?? null;
}

/**
 * Record a roster entry. Refused when half-formed, when
 * its id is already recorded, or when its week and day
 * already have an entry — the first entry for a day
 * always stays.
 */
export function recordDutyRosterEntry(list, raw) {
  const clean = normalizeDutyRosterEntryList(list);
  const entry = normalizeDutyRosterEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.week === entry.week && item.day === entry.day)) return clean;
  return [...clean, entry];
}

export function removeDutyRosterEntry(list, id) {
  const clean = normalizeDutyRosterEntryList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

function dayOrder(day) {
  return DUTY_ROSTER_DAYS.indexOf(day);
}

/** Roster entries for one week, Monday first, so the same week always reads the same way. */
export function dutyRosterEntriesForWeek(list, week) {
  const clean = normalizeDutyRosterEntryList(list);
  const wanted = text(week);
  if (!wanted) return [];
  return clean
    .filter((entry) => entry.week === wanted)
    .sort((a, b) => dayOrder(a.day) - dayOrder(b.day));
}

/** Weeks that have roster entries, earliest first. */
export function dutyRosterWeeks(list) {
  const clean = normalizeDutyRosterEntryList(list);
  const weeks = [...new Set(clean.map((entry) => entry.week))];
  return weeks.sort();
}

/**
 * Which days of one week have somebody posted and which
 * have nobody — the uncovered days are the gaps to fill
 * before the week starts.
 */
export function dutyRosterWeekCoverage(list, week) {
  const wanted = text(week);
  if (!wanted || !validDutyRosterWeek(wanted)) return { week: wanted, covered: [], missing: [...DUTY_ROSTER_DAYS] };
  const covered = dutyRosterEntriesForWeek(list, wanted).map((entry) => entry.day);
  const missing = DUTY_ROSTER_DAYS.filter((day) => !covered.includes(day));
  return { week: wanted, covered, missing };
}

/** Roster entries for one staff member, earliest week first, then Monday first. */
export function dutyRosterEntriesForStaff(list, staff) {
  const wanted = text(staff).toLowerCase();
  if (!wanted) return [];
  const clean = normalizeDutyRosterEntryList(list);
  return clean
    .filter((entry) => entry.staff.toLowerCase() === wanted)
    .sort((a, b) => {
      if (a.week !== b.week) return a.week < b.week ? -1 : 1;
      return dayOrder(a.day) - dayOrder(b.day);
    });
}

/**
 * Staff members on the roster, in A-Z order, keeping the
 * first spelling seen, so "Saad" and "saad" never list as
 * two people.
 */
export function dutyRosterStaff(list) {
  const clean = normalizeDutyRosterEntryList(list);
  const byLower = new Map();
  for (const entry of clean) {
    const key = entry.staff.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, entry.staff);
  }
  return [...byLower.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

/** Plain-words summary: the count, the weeks covered, and the latest week. */
export function dutyRosterSummaryText(list) {
  const clean = normalizeDutyRosterEntryList(list);
  if (!clean.length) return 'No staff duty roster entries recorded.';
  const weeks = dutyRosterWeeks(clean);
  const countWord = clean.length === 1 ? '1 roster entry' : `${clean.length} roster entries`;
  const weekWord = weeks.length === 1 ? '1 week' : `${weeks.length} weeks`;
  const latest = weeks[weeks.length - 1];
  const coverage = dutyRosterWeekCoverage(clean, latest);
  const gapWord = coverage.missing.length === 0
    ? 'every day covered'
    : `${coverage.missing.length} day${coverage.missing.length === 1 ? '' : 's'} still uncovered (${coverage.missing.join(', ')})`;
  return `${countWord} across ${weekWord}. Latest week: ${latest}, ${gapWord}.`;
}

/** One line naming a roster entry, for lists and messages. */
export function dutyRosterEntryText(entry) {
  const clean = normalizeDutyRosterEntry(entry);
  if (!clean) return '';
  return `${clean.week} ${clean.day} — ${clean.staff} on duty: ${clean.duty} (posted by ${clean.postedBy}).`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function dutyRosterEntryHtml(entry) {
  const clean = normalizeDutyRosterEntry(entry);
  if (!clean) return '';
  return `<li>${escapeHtml(dutyRosterEntryText(clean))}</li>`;
}

/**
 * One week as a list of all seven days, Monday first, with
 * the staff member on duty visible on each covered day and
 * the uncovered days named plainly, so a gap is visible
 * before the week starts.
 */
export function dutyRosterWeekHtml(list, week) {
  const wanted = text(week);
  if (!wanted || !validDutyRosterWeek(wanted)) return '<p>Pick a week to see its duty roster.</p>';
  const entries = dutyRosterEntriesForWeek(list, wanted);
  const byDay = new Map(entries.map((entry) => [entry.day, entry]));
  const items = DUTY_ROSTER_DAYS.map((day) => {
    const entry = byDay.get(day);
    if (!entry) return `<li>${escapeHtml(day)} — No one posted yet.</li>`;
    return `<li>${escapeHtml(day)} — ${escapeHtml(entry.staff)} on duty: ${escapeHtml(entry.duty)} (posted by ${escapeHtml(entry.postedBy)})</li>`;
  });
  return `<ul>${items.join('')}</ul>`;
}

export function dutyRosterAllHtml(list) {
  const weeks = dutyRosterWeeks(list);
  if (!weeks.length) return '<p>No staff duty roster entries recorded.</p>';
  return weeks.map((week) => `<h4>Week of ${escapeHtml(week)}</h4>${dutyRosterWeekHtml(list, week)}`).join('');
}

export function dutyRosterEntriesForStaffHtml(list, staff) {
  const entries = dutyRosterEntriesForStaff(list, staff);
  if (!entries.length) return '<p>No roster entries for that staff member.</p>';
  return `<ul>${entries.map((entry) => dutyRosterEntryHtml(entry)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function dutyRosterCsv(list) {
  const clean = normalizeDutyRosterEntryList(list);
  const sorted = [...clean].sort((a, b) => {
    if (a.week !== b.week) return a.week < b.week ? -1 : 1;
    return dayOrder(a.day) - dayOrder(b.day);
  });
  const header = ['id', 'week', 'day', 'staff', 'duty', 'postedBy'].join(',');
  const rows = sorted.map((entry) => [entry.id, entry.week, entry.day, entry.staff, entry.duty, entry.postedBy].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function dutyRosterFilename() {
  return 'duty-roster.csv';
}
