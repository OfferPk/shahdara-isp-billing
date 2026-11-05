// Plan 316 (Plan 203-350) — Device backup schedule record.
//
// Backups happen when someone remembers, so a device can go
// weeks without a fresh backup and nobody notices. This module
// adds only the missing piece: one schedule record per device
// — the device, the backup frequency, the last backup date,
// the next backup due date, and the owner — so overdue devices
// appear on a dated due list and recording a backup moves the
// next due date forward by the schedule.
//
// What this module is NOT, stated plainly:
//   - It is not the backup itself. Backups are made and
//     checked by the backup modules that already exist, which
//     are neither read nor rewritten here; a schedule never
//     makes, copies, or changes any backup file.
//   - It is not a restore drill. Restore rehearsals are
//     recorded by the restore drill module that already
//     exists, which is neither read nor rewritten here; a
//     schedule never restores anything.
//   - It is not the business device inventory. That inventory
//     already exists and is neither read nor rewritten here;
//     a schedule names a device, it never adds, edits, or
//     removes an inventory entry.
//   - It is not an export verification checklist. That
//     checklist already exists and is neither read nor
//     rewritten here; a schedule never checks an export.
//   - It is not a bill, payment, or customer record change.
//     Recording a schedule, or recording a backup against
//     one, never changes any bill, payment, or customer
//     record by itself.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     schedule and every date, and the module never reads
//     storage, the clock, or the network, and never mutates
//     an input.
//   - A schedule with no id, no device, or no frequency is
//     refused outright, as is a second schedule for the same
//     device. Unknown fields are dropped, so a schedule can
//     never grow a bill, payment, customer, or backup field.
//   - The next due date is always worked out from the last
//     backup date and the frequency by plain calendar
//     arithmetic, never guessed: daily adds one day, weekly
//     adds seven days, monthly adds one calendar month with
//     the day clamped to the end of a shorter month.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function deviceKey(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar day: YYYY-MM-DD that really exists, or false. */
export function validDeviceBackupScheduleDay(value) {
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

/** A frequency folded to daily, weekly, or monthly; anything missing or unknown reads as empty. */
export function foldDeviceBackupScheduleFrequency(value) {
  const folded = text(value).toLowerCase();
  if (folded === 'daily' || folded === 'every day' || folded === 'each day') return 'daily';
  if (folded === 'weekly' || folded === 'every week' || folded === 'each week') return 'weekly';
  if (folded === 'monthly' || folded === 'every month' || folded === 'each month') return 'monthly';
  return '';
}

/** Days since 1970-01-01 for a calendar date, by plain integer arithmetic. */
function daysFromCivil(year, month, day) {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = month > 2 ? month - 3 : month + 9;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Calendar date for days since 1970-01-01, by plain integer arithmetic. */
function civilFromDays(z) {
  const shifted = z + 719468;
  const era = Math.floor(shifted / 146097);
  const doe = shifted - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const year = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: month <= 2 ? year + 1 : year, month, day };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDay(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function splitDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** One calendar month after a date, with the day clamped to the end of a shorter month. */
function addOneMonth(parts) {
  const month = parts.month === 12 ? 1 : parts.month + 1;
  const year = parts.month === 12 ? parts.year + 1 : parts.year;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return { year, month, day: Math.min(parts.day, limit) };
}

/**
 * The next due date after a backup on a given day, by the
 * frequency: daily adds one day, weekly adds seven days,
 * monthly adds one calendar month. Returns an empty string
 * when the day is not strict or the frequency is unknown.
 */
export function deviceBackupScheduleNextDueDate(lastBackupDate, frequency) {
  const folded = foldDeviceBackupScheduleFrequency(frequency);
  if (!folded || !validDeviceBackupScheduleDay(lastBackupDate)) return '';
  const parts = splitDay(lastBackupDate);
  if (!parts) return '';
  if (folded === 'daily') return formatDay(civilFromDays(daysFromCivil(parts.year, parts.month, parts.day) + 1));
  if (folded === 'weekly') return formatDay(civilFromDays(daysFromCivil(parts.year, parts.month, parts.day) + 7));
  return formatDay(addOneMonth(parts));
}

/**
 * One schedule in canonical form, or null when the raw
 * schedule is missing an id, a device, or a frequency, has
 * a last backup date or next due date that is not a strict
 * day, or has a next due date before its last backup date.
 * A missing next due date is worked out from the last backup
 * date and the frequency; unknown fields are dropped.
 */
export function normalizeDeviceBackupSchedule(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const device = text(raw.device);
  const frequency = foldDeviceBackupScheduleFrequency(raw.frequency);
  const lastBackupDate = text(raw.lastBackupDate);
  const nextBackupDue = text(raw.nextBackupDue);
  const owner = text(raw.owner);
  if (!id || !device || !frequency) return null;
  if (lastBackupDate && !validDeviceBackupScheduleDay(lastBackupDate)) return null;
  if (nextBackupDue && !validDeviceBackupScheduleDay(nextBackupDue)) return null;
  if (lastBackupDate && nextBackupDue && nextBackupDue < lastBackupDate) return null;
  const due = nextBackupDue || (lastBackupDate ? deviceBackupScheduleNextDueDate(lastBackupDate, frequency) : '');
  return { id, device, frequency, lastBackupDate, nextBackupDue: due, owner };
}

/** A list of schedules in canonical form; bad entries and later duplicate ids or devices are dropped. */
export function normalizeDeviceBackupScheduleList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenDevices = new Set();
  const out = [];
  for (const raw of list) {
    const schedule = normalizeDeviceBackupSchedule(raw);
    if (!schedule) continue;
    if (seenIds.has(schedule.id) || seenDevices.has(deviceKey(schedule.device))) continue;
    seenIds.add(schedule.id);
    seenDevices.add(deviceKey(schedule.device));
    out.push(schedule);
  }
  return out;
}

/** The schedule with this id, or null when there is none. */
export function findDeviceBackupSchedule(list, id) {
  const schedules = normalizeDeviceBackupScheduleList(list);
  const wanted = text(id);
  return schedules.find((schedule) => schedule.id === wanted) ?? null;
}

/**
 * Record one schedule. A schedule that is refused, whose id
 * is already recorded, or whose device already has a schedule
 * leaves the list exactly as it was.
 */
export function recordDeviceBackupSchedule(list, raw) {
  const schedules = normalizeDeviceBackupScheduleList(list);
  const schedule = normalizeDeviceBackupSchedule(raw);
  if (!schedule) return schedules;
  if (schedules.some((entry) => entry.id === schedule.id)) return schedules;
  if (schedules.some((entry) => deviceKey(entry.device) === deviceKey(schedule.device))) return schedules;
  return [...schedules, schedule];
}

/** Remove the schedule with this id; removing an unknown id changes nothing. */
export function removeDeviceBackupSchedule(list, id) {
  const schedules = normalizeDeviceBackupScheduleList(list);
  const wanted = text(id);
  return schedules.filter((schedule) => schedule.id !== wanted);
}

/**
 * Record a backup against one schedule: the last backup date
 * becomes the backup date and the next due date moves forward
 * by the schedule. An unknown id, a date that is not a strict
 * day, or a date before the last backup already recorded
 * leaves the list exactly as it was.
 */
export function recordDeviceBackup(list, id, backupDate) {
  const schedules = normalizeDeviceBackupScheduleList(list);
  const wanted = text(id);
  const date = text(backupDate);
  if (!validDeviceBackupScheduleDay(date)) return schedules;
  return schedules.map((schedule) => {
    if (schedule.id !== wanted) return schedule;
    if (schedule.lastBackupDate && date < schedule.lastBackupDate) return schedule;
    return {
      ...schedule,
      lastBackupDate: date,
      nextBackupDue: deviceBackupScheduleNextDueDate(date, schedule.frequency),
    };
  });
}

function dueOrder(a, b) {
  if (a.nextBackupDue && b.nextBackupDue && a.nextBackupDue !== b.nextBackupDue) {
    return a.nextBackupDue < b.nextBackupDue ? -1 : 1;
  }
  if (a.nextBackupDue && !b.nextBackupDue) return -1;
  if (!a.nextBackupDue && b.nextBackupDue) return 1;
  if (a.device !== b.device) return a.device < b.device ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** All schedules, earliest next due date first; schedules with no due date yet come last. */
export function deviceBackupSchedulesSorted(list) {
  return normalizeDeviceBackupScheduleList(list).sort(dueOrder);
}

/** Whether a schedule is overdue against a caller-supplied as-of day. */
export function deviceBackupScheduleIsOverdue(schedule, asOf) {
  const clean = normalizeDeviceBackupSchedule(schedule);
  if (!clean || !validDeviceBackupScheduleDay(asOf)) return false;
  return Boolean(clean.nextBackupDue) && clean.nextBackupDue < asOf;
}

/** Schedules whose next due date is before the caller-supplied as-of day, earliest due first. */
export function overdueDeviceBackupSchedules(list, asOf) {
  if (!validDeviceBackupScheduleDay(asOf)) return [];
  return deviceBackupSchedulesSorted(list).filter((schedule) => deviceBackupScheduleIsOverdue(schedule, asOf));
}

/** Schedules for one device, earliest next due date first; capital letters do not matter. */
export function deviceBackupSchedulesForDevice(list, device) {
  const wanted = deviceKey(device);
  if (!wanted) return [];
  return deviceBackupSchedulesSorted(list).filter((schedule) => deviceKey(schedule.device) === wanted);
}

/** Devices with at least one schedule, in the order first recorded. */
export function deviceBackupScheduleDevices(list) {
  const seen = new Set();
  const out = [];
  for (const schedule of normalizeDeviceBackupScheduleList(list)) {
    const key = deviceKey(schedule.device);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(schedule.device);
  }
  return out;
}

/** Plain-words summary: how many schedules, and how many are overdue against the as-of day. */
export function deviceBackupScheduleSummaryText(list, asOf) {
  const schedules = normalizeDeviceBackupScheduleList(list);
  if (!schedules.length) return 'No device backup schedules recorded.';
  const overdue = overdueDeviceBackupSchedules(list, asOf).length;
  const totalWord = schedules.length === 1 ? 'schedule' : 'schedules';
  const overdueWord = overdue === 1 ? 'device is' : 'devices are';
  return `${schedules.length} backup ${totalWord}: ${overdue} ${overdueWord} overdue.`;
}

/** One schedule as one plain-words line, with its due date and overdue state named. */
export function deviceBackupScheduleText(schedule, asOf) {
  const clean = normalizeDeviceBackupSchedule(schedule);
  if (!clean) return '';
  const last = clean.lastBackupDate ? `last backup ${clean.lastBackupDate}` : 'no backup recorded yet';
  const due = clean.nextBackupDue ? `next backup due ${clean.nextBackupDue}` : 'no due date yet';
  const state = deviceBackupScheduleIsOverdue(clean, asOf) ? 'overdue' : 'on track';
  const owner = clean.owner ? ` — owner ${clean.owner}` : '';
  return `${clean.device} — ${clean.frequency} — ${last} — ${due} — ${state}${owner}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One schedule as one list item, with user text escaped. */
export function deviceBackupScheduleHtml(schedule, asOf) {
  const clean = normalizeDeviceBackupSchedule(schedule);
  if (!clean) return '';
  return `<li>${escapeHtml(deviceBackupScheduleText(clean, asOf))}</li>`;
}

/** All schedules grouped overdue first, then on track, then no due date yet. */
export function deviceBackupScheduleAllHtml(list, asOf) {
  const schedules = normalizeDeviceBackupScheduleList(list);
  if (!schedules.length) return '<p>No device backup schedules recorded.</p>';
  const overdue = deviceBackupSchedulesSorted(list).filter((schedule) => deviceBackupScheduleIsOverdue(schedule, asOf));
  const onTrack = deviceBackupSchedulesSorted(list).filter((schedule) => schedule.nextBackupDue && !deviceBackupScheduleIsOverdue(schedule, asOf));
  const noDue = deviceBackupSchedulesSorted(list).filter((schedule) => !schedule.nextBackupDue);
  const groups = [
    ['Overdue', overdue],
    ['On track', onTrack],
    ['No due date yet', noDue],
  ];
  return groups
    .filter(([, items]) => items.length)
    .map(([heading, items]) => `<h4>${heading}</h4><ul>${items.map((schedule) => deviceBackupScheduleHtml(schedule, asOf)).join('')}</ul>`)
    .join('');
}

/** Overdue schedules as a dated due list, earliest due first. */
export function overdueDeviceBackupSchedulesHtml(list, asOf) {
  const overdue = overdueDeviceBackupSchedules(list, asOf);
  if (!overdue.length) return '<p>No devices overdue for backup.</p>';
  return `<ul>${overdue.map((schedule) => deviceBackupScheduleHtml(schedule, asOf)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Schedules as CSV, earliest next due date first, with a fixed header. */
export function deviceBackupScheduleCsv(list) {
  const lines = ['id,device,frequency,lastBackupDate,nextBackupDue,owner'];
  for (const schedule of deviceBackupSchedulesSorted(list)) {
    lines.push([schedule.id, schedule.device, schedule.frequency, schedule.lastBackupDate, schedule.nextBackupDue, schedule.owner].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** Fixed filename for the CSV export. */
export function deviceBackupScheduleFilename() {
  return 'device-backup-schedules.csv';
}
