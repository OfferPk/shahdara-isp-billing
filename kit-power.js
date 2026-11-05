// Plan 234 (Plan 203-350) — Field kit power backup log.
//
// Portable batteries and chargers carried for field work run flat or
// go missing, and nobody knows which kit was last charged or which
// visit drained it. This module adds only the missing piece: one log
// entry per charge of a field-kit power item — the item itself
// (a portable battery or charger), the kit it belongs to, the date
// charged, the visit it was carried on, and a condition note.
//
// One log entry: the id, the item, the kit it belongs to, a strict
// calendar date charged, the visit it was carried on, and the
// condition note.
//
// The fences, stated plainly:
//   - This covers field kit only. It is not site power (Plan 53),
//     not site battery runtime (Plan 147), and not tool issue
//     (Plan 148): those modules are neither read nor rewritten
//     here, and this module imports nothing.
//   - A log entry is never edited, only followed by a newer entry.
//     There is no edit function: only record and remove. A newer
//     entry never rewrites an earlier entry.
//   - Each kit item shows its last charge date and the visits it
//     was carried on, and items not charged within the
//     operator-set interval are flagged against a caller-supplied
//     as-of date.
//   - Recording a charge never changes any bill, payment,
//     customer, visit, or staff record by itself: the module takes
//     no bill, payment, customer, visit, or staff object in, edits
//     none, and returns none. It holds kit power entries only.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validKitPowerDate(value) {
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

// Days from civil date, Howard Hinnant's algorithm: pure integer
// arithmetic, no Date object, so age in days never depends on a clock.
function daysFromCivil(year, month, day) {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = month > 2 ? month - 3 : month + 9;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function daysBetween(from, to) {
  const parse = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };
  return daysFromCivil(...parse(to)) - daysFromCivil(...parse(from));
}

function cleanEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const item = text(entry.item);
  const kit = text(entry.kit);
  const dateCharged = text(entry.dateCharged);
  if (!id || !item || !kit || !validKitPowerDate(dateCharged)) return null;
  return {
    id,
    item,
    kit,
    dateCharged,
    visit: text(entry.visit),
    condition: text(entry.condition),
  };
}

export function normalizeKitPowerList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const cleaned = cleanEntry(entry);
    if (!cleaned || seen.has(cleaned.id)) continue;
    seen.add(cleaned.id);
    out.push(cleaned);
  }
  return out;
}

export function recordKitPower(list, entry) {
  const cleaned = cleanEntry(entry);
  if (!cleaned) return null;
  const base = normalizeKitPowerList(list);
  if (base.some((item) => item.id === cleaned.id)) return null;
  return [...base, cleaned];
}

export function removeKitPower(list, id) {
  return normalizeKitPowerList(list).filter((item) => item.id !== text(id));
}

export function findKitPower(list, id) {
  return normalizeKitPowerList(list).find((item) => item.id === text(id)) ?? null;
}

export function kitPowerSorted(list) {
  return normalizeKitPowerList(list).sort((a, b) =>
    a.item.localeCompare(b.item) ||
    a.dateCharged.localeCompare(b.dateCharged) ||
    a.id.localeCompare(b.id));
}

export function kitPowerForItem(list, item) {
  const wanted = text(item).toLowerCase();
  if (!wanted) return [];
  return kitPowerSorted(list).filter((entry) => entry.item.toLowerCase().includes(wanted));
}

export function kitPowerItems(list) {
  const seen = new Set();
  const out = [];
  for (const entry of normalizeKitPowerList(list)) {
    const key = entry.item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry.item);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function kitPowerLastCharge(list, item) {
  const entries = kitPowerForItem(list, item);
  if (!entries.length) return null;
  return entries[entries.length - 1];
}

export function kitPowerVisits(list, item) {
  const visits = [];
  for (const entry of kitPowerForItem(list, item)) {
    if (entry.visit && !visits.includes(entry.visit)) visits.push(entry.visit);
  }
  return visits;
}

// Items whose last charge is more than intervalDays before the
// caller-supplied as-of date are flagged stale. Exactly intervalDays
// old is not flagged. A bad as-of date or interval flags nothing,
// never a guessed list.
export function kitPowerStale(list, asOf, intervalDays) {
  if (!validKitPowerDate(asOf)) return [];
  const interval = Number(intervalDays);
  if (!Number.isFinite(interval) || interval < 0) return [];
  const stale = [];
  for (const item of kitPowerItems(list)) {
    const last = kitPowerLastCharge(list, item);
    if (!last) continue;
    if (daysBetween(last.dateCharged, text(asOf)) > interval) stale.push(item);
  }
  return stale;
}

export function kitPowerSummaryText(list) {
  const entries = normalizeKitPowerList(list);
  const items = kitPowerItems(list);
  if (!entries.length) return 'No kit power entries recorded.';
  return `${entries.length} charge ${entries.length === 1 ? 'entry' : 'entries'} across ${items.length} kit ${items.length === 1 ? 'item' : 'items'}.`;
}

export function kitPowerText(entry) {
  const cleaned = cleanEntry(entry);
  if (!cleaned) return 'No kit power entry.';
  const visit = cleaned.visit || 'No visit noted';
  const condition = cleaned.condition || 'No condition noted';
  return `${cleaned.item} (${cleaned.kit}) charged on ${cleaned.dateCharged}, carried on ${visit}. Condition: ${condition}.`;
}

export function kitPowerItemText(list, item) {
  const last = kitPowerLastCharge(list, item);
  if (!last) return `No charge recorded for ${text(item) || 'that item'}.`;
  const visits = kitPowerVisits(list, item);
  const visitText = visits.length ? visits.join(', ') : 'no visits noted';
  return `${last.item} (${last.kit}) last charged on ${last.dateCharged}. Carried on: ${visitText}.`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function kitPowerHtml(entry) {
  const cleaned = cleanEntry(entry);
  if (!cleaned) return '';
  return `<p>${escapeHtml(kitPowerText(cleaned))}</p>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

export function kitPowerCsv(list) {
  const rows = [['id', 'item', 'kit', 'date charged', 'visit', 'condition']];
  for (const entry of kitPowerSorted(list)) {
    rows.push([entry.id, entry.item, entry.kit, entry.dateCharged, entry.visit, entry.condition]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function kitPowerFilename() {
  return 'kit-power-log.csv';
}
