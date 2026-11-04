// Plan 135 (Plan 101-202) — Generator/fuel log for sites.
//
// A site generator runs out of fuel during a power cut because
// nobody logged the last fill or the level. This module is that
// log: one fuel record per site with a site name, a date, fuel
// added, the level after the fill, and running hours noted.
//
// What this module is NOT, stated plainly:
//   - It is not the Plan 53 site power-status log (power-status-log.js),
//     which records a site's power state (mains, backup, generator,
//     out) at a noted time. That log holds no fuel amount and no
//     level, and it is neither read nor written here: a fuel record
//     here never changes a power-status entry, and a power-status
//     entry never becomes a fuel record.
//   - It is not the SISP-62 UPS backup monitor
//     (power-backup-monitor.js), which registers UPS nodes and times
//     outages on battery runtime. No UPS node is read or written
//     here, and no battery runtime is computed by this module.
//   - It is not the SISP-112 lineman petrol tracker
//     (fuel-efficiency-tracker.js), which derives petrol cost per
//     field job from roznamcha petrol outflows. No roznamcha day,
//     no field job, and no petrol cost is read or written here:
//     site generator fuel and lineman petrol are different fuel.
//   - It is not an expense, a vendor bill, or a payment. Recording
//     a fill here creates no expense row, no vendor bill, and no
//     payment figure of any kind, and it never changes one: fuel
//     bought on credit, if that ever happens, is recorded through
//     the normal expense/vendor path, not through this log.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the
//     network, never imports another module, and never mutates an
//     input. Every function returns a new list or new rows.
//   - Half-formed entries are refused outright, never stored
//     half-formed: an entry needs an id, a site, and a real
//     calendar date, plus fuel added above zero and a level after
//     the fill of zero or more. An entry with no site or no date
//     is refused, and so is one with an impossible date, no fuel
//     added, a negative level, or negative running hours. Unknown
//     fields are dropped, so an entry can never grow an expense,
//     vendor-bill, or payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function; the
//     only later change is removal.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - A site page shows the site's latest level (from its newest
//     fill) and its fill history newest first. A site with no
//     fills says so plainly, never pretends a level.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validGeneratorFuelDate(value) {
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

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function cleanAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Normalise one entry, or null when it is half-formed. */
export function normalizeGeneratorFuel(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const site = cleanText(record.site);
  const date = validGeneratorFuelDate(record.date);
  const fuelAdded = cleanAmount(record.fuelAdded);
  const levelAfterFill = cleanAmount(record.levelAfterFill);
  if (!id || !site || !date) return null;
  if (fuelAdded === null || fuelAdded <= 0) return null;
  if (levelAfterFill === null || levelAfterFill < 0) return null;
  let runningHours = null;
  if (record.runningHours !== undefined && record.runningHours !== null && !(typeof record.runningHours === 'string' && record.runningHours.trim() === '')) {
    runningHours = cleanAmount(record.runningHours);
    if (runningHours === null || runningHours < 0) return null;
  }
  return {
    id,
    site,
    date,
    fuelAdded,
    levelAfterFill,
    runningHours,
    note: cleanText(record.note),
  };
}

/** Normalise a list, dropping half-formed entries. */
export function normalizeGeneratorFuelList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const item = normalizeGeneratorFuel(record);
    if (item && !out.some((row) => row.id === item.id)) out.push(item);
  }
  return out;
}

/** Find one entry by id, or null. */
export function findGeneratorFuel(list, id) {
  const base = normalizeGeneratorFuelList(list);
  return base.find((item) => item.id === cleanText(id)) ?? null;
}

/**
 * Save one entry. An identical re-save leaves the list unchanged;
 * a re-save of the same id with different figures is refused.
 * A half-formed entry is refused. Returns a new list.
 */
export function upsertGeneratorFuel(list, record) {
  const base = normalizeGeneratorFuelList(list);
  const item = normalizeGeneratorFuel(record);
  if (!item) return base;
  const at = base.findIndex((row) => row.id === item.id);
  if (at === -1) return [...base, item];
  const existing = base[at];
  const same = existing.site === item.site
    && existing.date === item.date
    && existing.fuelAdded === item.fuelAdded
    && existing.levelAfterFill === item.levelAfterFill
    && existing.runningHours === item.runningHours
    && existing.note === item.note;
  if (same) return base;
  return base;
}

/** Remove one entry by id. Returns a new list. */
export function removeGeneratorFuel(list, id) {
  const base = normalizeGeneratorFuelList(list);
  const key = cleanText(id);
  return base.filter((item) => item.id !== key);
}

function sortNewestFirst(rows) {
  return [...rows].sort((a, b) => compareText(b.date, a.date) || compareText(a.id, b.id));
}

/** All fills, newest first. */
export function generatorFuelsNewestFirst(list) {
  return sortNewestFirst(normalizeGeneratorFuelList(list));
}

/** Fills for one site (case-insensitive), newest first. */
export function generatorFuelsForSite(list, site) {
  const base = normalizeGeneratorFuelList(list);
  const key = cleanText(site).toLowerCase();
  if (!key) return [];
  return sortNewestFirst(base.filter((item) => item.site.toLowerCase() === key));
}

/** A site's latest level after fill, or null when it has no fills. */
export function latestGeneratorFuelLevel(list, site) {
  const rows = generatorFuelsForSite(list, site);
  return rows.length === 0 ? null : rows[0].levelAfterFill;
}

/** A site's latest fill record, or null when it has no fills. */
export function latestGeneratorFuel(list, site) {
  const rows = generatorFuelsForSite(list, site);
  return rows.length === 0 ? null : rows[0];
}

/** Counts: fills and distinct sites. */
export function generatorFuelCounts(list) {
  const base = normalizeGeneratorFuelList(list);
  const sites = new Set(base.map((item) => item.site.toLowerCase()));
  return { fills: base.length, sites: sites.size };
}

/** One-line summary of the whole log. */
export function generatorFuelSummaryText(list) {
  const base = normalizeGeneratorFuelList(list);
  if (base.length === 0) return 'No fuel fill recorded yet.';
  const counts = generatorFuelCounts(base);
  const newest = generatorFuelsNewestFirst(base)[0];
  return `${counts.fills} fuel fill${counts.fills === 1 ? '' : 's'} across ${counts.sites} site${counts.sites === 1 ? '' : 's'}; latest fill ${newest.date} at ${newest.site}.`;
}

/** A site page: latest level plus fill history newest first. */
export function generatorFuelHtml(list, site) {
  const key = cleanText(site);
  if (!key) return '<p>Pick a site to see its fuel log.</p>';
  const rows = generatorFuelsForSite(list, key);
  if (rows.length === 0) return `<p>No fuel fill recorded yet for ${escapeHtml(key)}.</p>`;
  const latest = rows[0];
  const heading = `<p>Latest level at ${escapeHtml(key)}: ${latest.levelAfterFill} litres (filled ${escapeHtml(latest.date)}).</p>`;
  const body = rows
    .map((item) => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.date)}</td><td>${item.fuelAdded}</td><td>${item.levelAfterFill}</td><td>${item.runningHours === null ? '—' : item.runningHours}</td><td>${escapeHtml(item.note)}</td></tr>`)
    .join('');
  return `${heading}<table><thead><tr><th>Id</th><th>Date</th><th>Fuel added (litres)</th><th>Level after fill (litres)</th><th>Running hours</th><th>Note</th></tr></thead><tbody>${body}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of entries. */
export function generatorFuelCsv(list) {
  const base = normalizeGeneratorFuelList(list);
  const header = 'id,site,date,fuel_added_litres,level_after_fill_litres,running_hours,note';
  const rows = base.map((item) => [item.id, item.site, item.date, item.fuelAdded, item.levelAfterFill, item.runningHours === null ? '' : item.runningHours, item.note].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

/** CSV filename for the log. */
export function generatorFuelFilename() {
  return 'generator-fuel-log.csv';
}
