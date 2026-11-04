// Plan 131 (Plan 101-202) — Field visit scheduling by day part.
//
// Field visits were booked without a day part, so the collector could
// arrive when the customer was out and the visit was wasted. This
// module is the booking record for a visit: one record per visit with
// a customer, a date, a day part (morning / afternoon / evening), a
// job type, a collector, and a status (booked / done / missed /
// rescheduled).
//
// What this module is NOT, stated plainly:
//   - It is not a record of what happened on a visit. Recording,
//     completing, or missing a booking here never writes, changes,
//     or replaces any outcome, payment, or bill record anywhere
//     else: the booking only says when the visit is planned and
//     what came of the plan itself.
//   - It is not a second copy of the neighbouring ticket-ordering
//     view or of any staff visit log: those keep their own records
//     and are never read or written here. The caller supplies every
//     record; this module holds no other system's identifiers.
//   - It is not a customer preference. A stored preference about
//     when a customer likes to be visited is a different fact from
//     a booked slot, and it is neither read nor written here; the
//     operator can compare the two side by side in the panel, but
//     booking a slot never changes the preference.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the
//     network, never imports another module, and never mutates an
//     input. Every function returns a new list or new rows.
//   - Half-formed bookings are refused outright, never stored
//     half-formed: a booking needs an id, a customer, a real
//     calendar date, a day part from the catalogue, and a job type.
//     Unknown fields are dropped, so a booking can never grow a
//     payment, bill, or outcome field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function; the
//     only later changes are the status moves below and removal.
//   - Double-booking is flagged, never silently allowed and never
//     silently blocked: booking a second visit for the same
//     collector on the same date in the same day part is recorded,
//     and the day-part list marks both visits as double-booked so
//     the operator sees the clash and fixes it. A visit with no
//     collector named (unassigned) can never count as a clash.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass). A status that is missing
//     defaults to booked; a status outside the catalogue is
//     refused, never guessed.
//   - Status moves: booked -> done, booked -> missed. A done visit
//     is terminal and cannot move again. Rescheduling keeps the
//     history: the original booking becomes rescheduled and a new
//     booked booking carries the visit forward to its new date and
//     day part. A missed visit stays listed for rebooking until it
//     is rescheduled the same way; it is never dropped silently.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validVisitDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

/** The day-part catalogue, in the order a day runs. */
export const VISIT_DAY_PARTS = Object.freeze(['morning', 'afternoon', 'evening']);

export const VISIT_DAY_PART_LABELS = Object.freeze({
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
});

/** The booking-status catalogue. */
export const VISIT_SCHEDULE_STATUSES = Object.freeze(['booked', 'done', 'missed', 'rescheduled']);

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function dayPartOrder(part) {
  return VISIT_DAY_PARTS.indexOf(part);
}

function compareText(a, b) {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA < lowerB) return -1;
  if (lowerA > lowerB) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Normalize one booking record, or null when it is half-formed.
 * Missing status defaults to booked; an unknown status refuses.
 * Unknown fields are dropped.
 */
export function normalizeVisitSchedule(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const date = validVisitDate(record.date);
  const dayPart = cleanText(record.dayPart);
  const jobType = cleanText(record.jobType);
  if (!id || !customer || !date || !VISIT_DAY_PARTS.includes(dayPart) || !jobType) return null;
  let status = 'booked';
  if (record.status !== null && record.status !== undefined && cleanText(record.status) !== '') {
    status = cleanText(record.status);
    if (!VISIT_SCHEDULE_STATUSES.includes(status)) return null;
  }
  return {
    id,
    customer,
    collector: cleanText(record.collector),
    date,
    dayPart,
    jobType,
    status,
    note: cleanText(record.note),
  };
}

/** Normalize a list, dropping half-formed rows, keeping order. */
export function normalizeVisitScheduleList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const normalized = normalizeVisitSchedule(record);
    if (normalized) out.push(normalized);
  }
  return out;
}

/**
 * Add a booking. A duplicate id is never rewritten: an identical
 * re-save returns the list unchanged, a re-save with different
 * figures returns the list unchanged too. A half-formed booking
 * is refused the same way.
 */
export function upsertVisitSchedule(list, record) {
  const normalized = normalizeVisitSchedule(record);
  if (!normalized) return Array.isArray(list) ? [...list] : [];
  const base = normalizeVisitScheduleList(list);
  const existing = base.find((item) => item.id === normalized.id);
  if (existing) return base;
  return [...base, normalized];
}

/** Remove a booking by id; an unknown id leaves the list unchanged. */
export function removeVisitSchedule(list, id) {
  const base = normalizeVisitScheduleList(list);
  const wanted = cleanText(id);
  return base.filter((item) => item.id !== wanted);
}

/** Find one booking by id, or null. */
export function findVisitSchedule(list, id) {
  const base = normalizeVisitScheduleList(list);
  return base.find((item) => item.id === cleanText(id)) ?? null;
}

function compareDayPartRows(a, b) {
  const byPart = dayPartOrder(a.dayPart) - dayPartOrder(b.dayPart);
  if (byPart !== 0) return byPart;
  const byCustomer = compareText(a.customer, b.customer);
  if (byCustomer !== 0) return byCustomer;
  return compareText(a.id, b.id);
}

/**
 * Every double-booked group among booked visits: same collector,
 * same date, same day part, two or more visits. Unassigned visits
 * (no collector named) never form a group.
 */
export function doubleBookingFlags(list) {
  const base = normalizeVisitScheduleList(list).filter((item) => item.status === 'booked' && item.collector !== '');
  const groups = new Map();
  for (const item of base) {
    const key = `${item.collector}\n${item.date}\n${item.dayPart}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item.id);
  }
  const out = [];
  for (const [key, ids] of groups) {
    if (ids.length < 2) continue;
    const [collector, date, dayPart] = key.split('\n');
    out.push({ collector, date, dayPart, visitIds: [...ids].sort(compareText), count: ids.length });
  }
  out.sort((a, b) => compareText(a.date, b.date) || dayPartOrder(a.dayPart) - dayPartOrder(b.dayPart) || compareText(a.collector, b.collector));
  return out;
}

/**
 * The day-part list for one date: booked visits only, in day-part
 * order, then customer A-Z, then id. Pass a day part to narrow to
 * that part; pass 'all', blank, or nothing for every part. An
 * unknown day-part filter gives an empty list, never a guessed
 * part. Each row carries doubleBooked: true when the visit sits
 * in a double-booked group for its collector, date, and part.
 */
export function dayPartSchedule(list, date, dayPart) {
  const wantedDate = validVisitDate(date);
  if (!wantedDate) return [];
  const filter = dayPart === null || dayPart === undefined || cleanText(dayPart) === '' || cleanText(dayPart) === 'all'
    ? null
    : cleanText(dayPart);
  if (filter !== null && !VISIT_DAY_PARTS.includes(filter)) return [];
  const flagged = new Set();
  for (const group of doubleBookingFlags(list)) {
    if (group.date === wantedDate) {
      for (const id of group.visitIds) flagged.add(id);
    }
  }
  return normalizeVisitScheduleList(list)
    .filter((item) => item.status === 'booked' && item.date === wantedDate && (filter === null || item.dayPart === filter))
    .sort(compareDayPartRows)
    .map((item) => ({ ...item, doubleBooked: flagged.has(item.id) }));
}

/**
 * Missed visits, still visible for rebooking: oldest date first,
 * then day-part order, then customer A-Z, then id.
 */
export function missedVisits(list) {
  return normalizeVisitScheduleList(list)
    .filter((item) => item.status === 'missed')
    .sort((a, b) => compareText(a.date, b.date) || dayPartOrder(a.dayPart) - dayPartOrder(b.dayPart) || compareText(a.customer, b.customer) || compareText(a.id, b.id));
}

/** Mark a booked visit done. Any other status leaves the list unchanged. */
export function markVisitDone(list, id) {
  const base = normalizeVisitScheduleList(list);
  const wanted = cleanText(id);
  const target = base.find((item) => item.id === wanted);
  if (!target || target.status !== 'booked') return base;
  return base.map((item) => (item.id === wanted ? { ...item, status: 'done' } : item));
}

/** Mark a booked visit missed. Any other status leaves the list unchanged. */
export function markVisitMissed(list, id) {
  const base = normalizeVisitScheduleList(list);
  const wanted = cleanText(id);
  const target = base.find((item) => item.id === wanted);
  if (!target || target.status !== 'booked') return base;
  return base.map((item) => (item.id === wanted ? { ...item, status: 'missed' } : item));
}

/**
 * Reschedule a booked or missed visit: the original booking becomes
 * rescheduled (its date and day part stay as history) and a new
 * booked booking carries the visit to the new date and day part,
 * keeping the customer, collector, and job type. Refused when the
 * booking is missing or done, when the new date or day part is
 * unusable, or when the new id is missing or already on record —
 * in every refusal the list is returned unchanged.
 */
export function rescheduleVisit(list, id, change) {
  const base = normalizeVisitScheduleList(list);
  const wanted = cleanText(id);
  const target = base.find((item) => item.id === wanted);
  if (!target || target.status === 'done' || target.status === 'rescheduled') return base;
  if (!change || typeof change !== 'object') return base;
  const newId = cleanText(change.newId);
  const newDate = validVisitDate(change.newDate);
  const newDayPart = cleanText(change.newDayPart);
  if (!newId || !newDate || !VISIT_DAY_PARTS.includes(newDayPart)) return base;
  if (base.some((item) => item.id === newId)) return base;
  const carried = {
    id: newId,
    customer: target.customer,
    collector: target.collector,
    date: newDate,
    dayPart: newDayPart,
    jobType: target.jobType,
    status: 'booked',
    note: cleanText(change.note),
  };
  return [...base.map((item) => (item.id === wanted ? { ...item, status: 'rescheduled' } : item)), carried];
}

export function visitScheduleSummaryText(list) {
  const base = normalizeVisitScheduleList(list);
  if (base.length === 0) return 'No visit booked.';
  const booked = base.filter((item) => item.status === 'booked').length;
  const missed = base.filter((item) => item.status === 'missed').length;
  const clashes = doubleBookingFlags(base).length;
  let text = `${base.length} visit booking${base.length === 1 ? '' : 's'}; ${booked} booked, ${missed} missed.`;
  if (clashes > 0) text += ` ${clashes} double-booked clash${clashes === 1 ? '' : 'es'} flagged.`;
  return text;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function visitScheduleHtml(list) {
  const base = normalizeVisitScheduleList(list);
  if (base.length === 0) return '<p>No visit booked.</p>';
  const flagged = new Set();
  for (const group of doubleBookingFlags(base)) {
    for (const id of group.visitIds) flagged.add(id);
  }
  const rows = [...base]
    .sort((a, b) => compareText(a.date, b.date) || dayPartOrder(a.dayPart) - dayPartOrder(b.dayPart) || compareText(a.customer, b.customer) || compareText(a.id, b.id))
    .map((item) => {
      const clash = item.status === 'booked' && flagged.has(item.id) ? ' — DOUBLE-BOOKED' : '';
      return `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(VISIT_DAY_PART_LABELS[item.dayPart])}</td><td>${escapeHtml(item.customer)}</td><td>${escapeHtml(item.collector === '' ? 'Unassigned' : item.collector)}</td><td>${escapeHtml(item.jobType)}</td><td>${escapeHtml(item.status)}${escapeHtml(clash)}</td><td>${escapeHtml(item.note)}</td></tr>`;
    })
    .join('');
  return `<table><thead><tr><th>Date</th><th>Day part</th><th>Customer</th><th>Collector</th><th>Job type</th><th>Status</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function visitScheduleCsv(list) {
  const base = normalizeVisitScheduleList(list);
  const header = 'id,customer,collector,date,day_part,job_type,status,note';
  const rows = base.map((item) => [item.id, item.customer, item.collector, item.date, item.dayPart, item.jobType, item.status, item.note].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function visitScheduleFilename() {
  return 'visit-day-part-schedule.csv';
}
