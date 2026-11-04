// Plan 147 (Plan 101-202) — Battery backup runtime log.
//
// Backup batteries are assumed to work until a power cut proves
// they do not. This module is the test log that stops that guess:
// one runtime record per backup unit test, with a unit/site name,
// a test date, the measured runtime, and a note. A unit page then
// shows its runtimes newest first with the latest runtime
// prominent, so a weak battery is replaced after a test, not
// discovered during a real outage.
//
// What this module is NOT, stated plainly:
//   - It is not a power status log. The power status log
//     (shahdara_power_status_log_v1) and the UPS node / live
//     outage monitor (power-backup-monitor.js) are neither read
//     nor written here: a runtime record is an operator's test
//     result, not a live outage reading, and recording it never
//     opens, closes, rewrites, or otherwise changes any power
//     status entry, any outage, any expense, or any payment.
//   - It is not a replacement order. A short runtime only makes
//     the weakness visible; it does not order a battery, change
//     any stock count, or change any service state.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a unit/site name, a
//     real calendar date, and a measured runtime above zero.
//     A record with no unit or no date is refused, and so is
//     one with an impossible date or a missing, zero, negative,
//     or non-numeric runtime. Unknown fields are dropped, so a
//     record can never grow a power-status, expense, or payment
//     field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - A unit's runtimes list newest first, and its latest
//     runtime is simply the newest record's runtime. A unit
//     with no runtime record is not hidden, it is reported as
//     having none.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validBatteryRuntimeDate(value) {
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

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanRuntime(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one runtime record, or null when half-formed. */
export function normalizeBatteryRuntimeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const unit = cleanText(raw.unit);
  const date = validBatteryRuntimeDate(raw.date);
  const runtimeMinutes = cleanRuntime(raw.runtimeMinutes);
  if (!id || !unit || !date || runtimeMinutes === null) return null;
  return {
    id,
    unit,
    date,
    runtimeMinutes,
    note: cleanText(raw.note),
  };
}

/** Normalize a list: drop half-formed records and duplicate ids (first wins). */
export function normalizeBatteryRuntimeList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeBatteryRuntimeRecord(raw);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

/** Find one record by id, or null. */
export function findBatteryRuntimeRecord(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeBatteryRuntimeList(list).find((item) => item.id === clean) || null;
}

/**
 * Save one record. Returns a new list, or the input unchanged when
 * the record is half-formed or repeats an id with different figures.
 */
export function upsertBatteryRuntimeRecord(list, raw) {
  const clean = normalizeBatteryRuntimeList(list);
  const record = normalizeBatteryRuntimeRecord(raw);
  if (!record) return clean;
  const existing = clean.find((item) => item.id === record.id);
  if (existing) return clean;
  return [...clean, record];
}

/** Remove one record by id. Returns a new list. */
export function removeBatteryRuntimeRecord(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeBatteryRuntimeList(list);
  return normalizeBatteryRuntimeList(list).filter((item) => item.id !== clean);
}

function matchesUnit(item, unit) {
  const key = cleanText(unit).toLowerCase();
  if (!key) return false;
  return item.unit.toLowerCase() === key;
}

/** A unit's runtimes, newest first (then id A-Z for a stable order). */
export function runtimesForUnit(list, unit) {
  const clean = normalizeBatteryRuntimeList(list);
  return clean
    .filter((item) => matchesUnit(item, unit))
    .sort((a, b) => compareText(b.date, a.date) || compareText(a.id, b.id));
}

/** Latest runtime record for a unit, or null when it has no record. */
export function latestBatteryRuntime(list, unit) {
  const rows = runtimesForUnit(list, unit);
  return rows.length === 0 ? null : rows[0];
}

/** Every unit with its latest runtime, unit name A-Z. */
export function unitLatestRuntimes(list) {
  const clean = normalizeBatteryRuntimeList(list);
  const byKey = new Map();
  for (const item of clean) {
    const key = item.unit.toLowerCase();
    if (!byKey.has(key) || item.date > byKey.get(key).date) {
      byKey.set(key, { unit: item.unit, date: item.date, runtimeMinutes: item.runtimeMinutes });
    }
  }
  return [...byKey.values()].sort((a, b) => compareText(a.unit.toLowerCase(), b.unit.toLowerCase()));
}

/** Measured minutes as plain text: 45 -> "45 min", 90 -> "1h 30m". */
export function formatBatteryRuntime(minutes) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return '';
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} min`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, '0')}m`;
}

/** One-line summary of the whole log. */
export function batteryRuntimeSummaryText(list) {
  const clean = normalizeBatteryRuntimeList(list);
  if (clean.length === 0) return 'No battery runtime record yet.';
  const units = unitLatestRuntimes(clean);
  const shortest = units.reduce((best, row) => (best === null || row.runtimeMinutes < best.runtimeMinutes ? row : best), null);
  return `${clean.length} runtime record${clean.length === 1 ? '' : 's'} across ${units.length} unit${units.length === 1 ? '' : 's'}; `
    + `shortest latest runtime: ${formatBatteryRuntime(shortest.runtimeMinutes)} (${shortest.unit}).`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function runtimeRowHtml(item) {
  return `<tr><td>${esc(item.date)}</td><td>${esc(formatBatteryRuntime(item.runtimeMinutes))}</td>`
    + `<td>${esc(item.note)}</td></tr>`;
}

/**
 * A unit page: its runtimes newest first with the latest runtime
 * prominent. A unit with no record says so plainly.
 */
export function batteryRuntimeHtml(list, unit) {
  const rows = runtimesForUnit(list, unit);
  if (rows.length === 0) return '<p>No runtime record for this unit.</p>';
  const heading = `<p><strong>Latest runtime: ${esc(formatBatteryRuntime(rows[0].runtimeMinutes))}</strong> `
    + `(as of ${esc(rows[0].date)}). ${rows.length} record${rows.length === 1 ? '' : 's'} recorded.</p>`;
  const body = rows.map(runtimeRowHtml).join('');
  return `${heading}<table><thead><tr><th>Test date</th><th>Measured runtime</th>`
    + '<th>Note</th></tr></thead><tbody>' + body + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of runtime records. */
export function batteryRuntimeCsv(list) {
  const rows = normalizeBatteryRuntimeList(list);
  const lines = ['id,unit,date,runtimeMinutes,note'];
  for (const item of rows) {
    lines.push([item.id, item.unit, item.date, item.runtimeMinutes, item.note].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the log. */
export function batteryRuntimeFilename() {
  return 'battery-runtime.csv';
}
