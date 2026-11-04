// Plan 53 (Plan 1-100) — Site power and backup-power status log.
//
// A "network down" report may really be a power cut at the main site
// or a dead backup battery, but power state was recorded nowhere, so
// the same diagnosis was repeated at every outage. This module is
// that written record: one entry per noting — site, power state,
// time noted, and a short note, entered by the operator.
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every entry, and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - It is a manual log, not a live power sensor: nothing here
//     measures mains, battery charge, or runtime, and nothing here
//     watches a site. The state is whatever the operator recorded,
//     dated by the time they noted it.
//   - It is NOT the optical power logger (nav-power-logger.js),
//     which records fibre dBm telemetry, and NOT the SISP-62 UPS
//     backup monitor (power-backup-monitor.js), which registers UPS
//     nodes, times outages, and derives battery runtime. Neither
//     store is read or written here, and no runtime, depletion, or
//     complaint is ever computed by this module.
//   - Logging a power state never opens, closes, or alters a fault
//     ticket on its own. An entry may carry a ticket id so a ticket
//     can be traced back to the power state noted at the time, but
//     the link is one-way only: ticket rows are never written, and
//     this module holds no bill, payment, or customer field.
//   - An entry with no site, an unknown state, or an impossible
//     time (2026-02-30 included) is refused outright, never stored
//     half-formed. A blank note stays empty and a blank ticket link
//     stays null, never guessed.

export const POWER_STATES = Object.freeze({
  MAINS: 'mains',
  BACKUP: 'backup',
  GENERATOR: 'generator',
  OUT: 'out',
});

export const POWER_STATE_LABELS = Object.freeze({
  mains: 'Mains power',
  backup: 'Backup battery / UPS',
  generator: 'Generator',
  out: 'Power out',
});

export const POWER_STATE_OPTIONS = Object.freeze(
  Object.values(POWER_STATES).map((key) => ({ key, label: POWER_STATE_LABELS[key] })),
);

const KNOWN_STATES = new Set(Object.values(POWER_STATES));

const STATE_ALIASES = Object.freeze({
  mains: 'mains',
  wapda: 'mains',
  grid: 'mains',
  mainspower: 'mains',
  backup: 'backup',
  battery: 'backup',
  ups: 'backup',
  backupbattery: 'backup',
  backupups: 'backup',
  generator: 'generator',
  gen: 'generator',
  out: 'out',
  nopower: 'out',
  powerout: 'out',
  down: 'out',
  off: 'out',
});

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function squashed(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isRealDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

export function normalizePowerState(value) {
  if (typeof value !== 'string') return null;
  const key = squashed(value);
  if (KNOWN_STATES.has(key)) return key;
  return STATE_ALIASES[key] ?? null;
}

// Accepts "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" (seconds tolerated and
// dropped). Returns the normalised form, or null when the date is
// impossible (2026-02-30), the time is out of range, or the shape is
// wrong. A date-only entry keeps no invented time of day.
export function normalizeNotedAt(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isRealDate(year, month, day)) return null;
  if (match[4] === undefined) return `${match[1]}-${match[2]}-${match[3]}`;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
}

export function normalizePowerEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const site = text(entry.site);
  const state = normalizePowerState(entry.state);
  const notedAt = normalizeNotedAt(entry.notedAt ?? entry.time ?? entry.date);
  if (!id || !site || !state || !notedAt) return null;
  const note = text(entry.note);
  const ticketId = text(entry.ticketId ?? entry.linkedTicketId);
  return {
    id,
    site,
    siteKey: site.toLowerCase(),
    state,
    stateLabel: POWER_STATE_LABELS[state],
    notedAt,
    note,
    ticketId: ticketId || null,
  };
}

export function normalizePowerLog(entries) {
  if (!Array.isArray(entries)) return [];
  const byId = new Map();
  for (const raw of entries) {
    const entry = normalizePowerEntry(raw);
    if (entry) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

export function findPowerEntry(entries, id) {
  const list = normalizePowerLog(entries);
  return list.find((entry) => entry.id === text(id)) ?? null;
}

export function upsertPowerEntry(entries, entry) {
  const list = normalizePowerLog(entries);
  const next = normalizePowerEntry(entry);
  if (!next) return list;
  const existing = list.findIndex((item) => item.id === next.id);
  if (existing >= 0) list[existing] = next;
  else list.push(next);
  return list;
}

export function removePowerEntry(entries, id) {
  return normalizePowerLog(entries).filter((entry) => entry.id !== text(id));
}

function compareNotedAt(a, b) {
  if (a.notedAt < b.notedAt) return -1;
  if (a.notedAt > b.notedAt) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// History for one site (or all sites when site is blank), oldest
// first, so the log reads in the order things happened.
export function powerHistoryForSite(entries, site) {
  const list = normalizePowerLog(entries);
  const key = text(site).toLowerCase();
  const filtered = key ? list.filter((entry) => entry.siteKey === key) : list;
  return [...filtered].sort(compareNotedAt);
}

// Latest state per site, one row each, site A-Z. The latest entry is
// the one noted last; on a tie the later-recorded entry wins, so a
// correction noted at the same time replaces the earlier note.
export function latestPowerStatePerSite(entries) {
  const list = normalizePowerLog(entries);
  const bySite = new Map();
  for (const entry of list) {
    const current = bySite.get(entry.siteKey);
    if (!current || compareNotedAt(current, entry) <= 0) bySite.set(entry.siteKey, entry);
  }
  return [...bySite.values()].sort((a, b) => (a.site < b.site ? -1 : a.site > b.site ? 1 : 0));
}

// One-way ticket link only: entries that name this ticket, oldest
// first. Nothing here writes into a ticket.
export function entriesForTicket(entries, ticketId) {
  const id = text(ticketId);
  if (!id) return [];
  return normalizePowerLog(entries)
    .filter((entry) => entry.ticketId === id)
    .sort(compareNotedAt);
}

export function powerSummaryText(entries) {
  const list = normalizePowerLog(entries);
  const latest = latestPowerStatePerSite(list);
  const outSites = latest.filter((entry) => entry.state === 'out');
  const backupSites = latest.filter((entry) => entry.state === 'backup');
  const parts = [`${list.length} power note${list.length === 1 ? '' : 's'} across ${latest.length} site${latest.length === 1 ? '' : 's'}`];
  if (outSites.length) parts.push(`${outSites.length} site${outSites.length === 1 ? '' : 's'} currently out: ${outSites.map((entry) => entry.site).join(', ')}`);
  if (backupSites.length) parts.push(`${backupSites.length} site${backupSites.length === 1 ? '' : 's'} on backup battery: ${backupSites.map((entry) => entry.site).join(', ')}`);
  return parts.join('. ') + '.';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function entryRowHtml(entry) {
  return `<tr><td>${escapeHtml(entry.site)}</td><td>${escapeHtml(entry.stateLabel)}</td>`
    + `<td>${escapeHtml(entry.notedAt)}</td><td>${escapeHtml(entry.note || '—')}</td>`
    + `<td>${escapeHtml(entry.ticketId || '—')}</td></tr>`;
}

export function latestPowerHtml(latest) {
  const rows = Array.isArray(latest) ? latest : [];
  if (!rows.length) return '<p>No power notes yet.</p>';
  const body = rows.map((entry) => entryRowHtml(entry)).join('');
  return '<table class="data-table"><thead><tr><th>Site</th><th>Latest state</th><th>Time noted</th><th>Note</th><th>Ticket</th></tr></thead>'
    + `<tbody>${body}</tbody></table>`;
}

export function powerLogHtml(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return '<p>No power notes in this view.</p>';
  const body = list.map((entry) => entryRowHtml(entry)).join('');
  return '<table class="data-table"><thead><tr><th>Site</th><th>State</th><th>Time noted</th><th>Note</th><th>Ticket</th></tr></thead>'
    + `<tbody>${body}</tbody></table>`;
}

export function powerCsv(entries) {
  const list = normalizePowerLog(entries).sort(compareNotedAt);
  const header = ['Site', 'State', 'Time noted', 'Note', 'Ticket'].map(csvCell).join(',');
  const rows = list.map((entry) => [entry.site, entry.stateLabel, entry.notedAt, entry.note, entry.ticketId ?? ''].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function powerFilename(date) {
  const safe = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'undated';
  return `power-status-log-${safe}.csv`;
}
