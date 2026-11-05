// Plan 331 (Plan 203-350) — Backup media register.
//
// USB drives and disks used for backups are unlabelled and
// untracked, so nobody knows which drive holds which backup or
// whether a drive is still reliable. This module is the register
// that fixes that: one entry per backup medium, with a label, a
// type, a capacity note, a first use date, the backups it holds,
// and a condition of good, watch, or retired.
//
// Honesty rules, stated plainly rather than hidden:
//   - This module registers media only. It never reads, writes,
//     copies, or deletes any backup file, and it never changes
//     any bill, payment, or customer record. It holds no backup
//     content at all — only the label and the names of the
//     backups a medium holds, as entered by the operator.
//   - A medium with no label is refused: an unlabelled drive is
//     the exact problem this register exists to end, so it can
//     never enter the register.
//   - Retired media stay listed as retired, never deleted:
//     marking a medium retired keeps it visible in the register,
//     and removing a retired medium is refused, so the history
//     of what a drive held is never lost by accident.
//   - A condition the register does not know is never guessed:
//     it reads as "not recorded" until the operator says
//     otherwise.
//   - The first use date must be a real calendar date; a made-up
//     date is stored as blank, never as a guessed date.
//   - This is not the business device inventory of Plan 188,
//     not the restore drill record of Plan 194, and not the
//     retention review log of Plan 330: those are neither read
//     nor written here, and none of their records is touched.
//     The register is a list the operator keeps; nothing in it
//     is computed from live data.

const DAY_RE = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const CONDITIONS = ['good', 'watch', 'retired', 'not recorded'];

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** A valid calendar date 'YYYY-MM-DD', or '' when invalid. */
export function validBackupMediaDay(value) {
  const clean = text(value);
  const match = DAY_RE.exec(clean);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit ? clean : '';
}

/**
 * Fold a condition to 'good', 'watch', 'retired', or
 * 'not recorded'. Anything unknown reads as 'not recorded' —
 * the register never guesses how reliable a drive is.
 */
export function foldBackupMediaCondition(value) {
  const clean = text(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return CONDITIONS.includes(clean) ? clean : 'not recorded';
}

/**
 * Normalize the backups a medium holds: an array of names, or
 * one comma-separated string. Names are trimmed; empty names
 * are dropped; repeats collapse to the first spelling.
 */
export function normalizeBackupMediaBackups(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const out = [];
  for (const item of raw) {
    const name = text(item);
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Normalize one register entry, or null when half-formed.
 * An entry is { id, label, type, capacity, firstUseDate,
 * backupsHeld, condition }. Only the id and the label are
 * required: a medium with no label is refused, and a made-up
 * first use date is stored as blank. Unknown fields are
 * dropped, so no backup, bill, payment, or customer field can
 * survive in the register.
 */
export function normalizeBackupMedium(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const label = text(raw.label);
  if (!id || !label) return null;
  const firstUseDate = raw.firstUseDate ? validBackupMediaDay(raw.firstUseDate) : '';
  return {
    id,
    label,
    type: text(raw.type),
    capacity: text(raw.capacity),
    firstUseDate,
    backupsHeld: normalizeBackupMediaBackups(raw.backupsHeld),
    condition: foldBackupMediaCondition(raw.condition),
  };
}

/** Normalize a list of register entries, dropping the unusable. */
export function normalizeBackupMediaList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const entry = normalizeBackupMedium(raw);
    if (entry) out.push(entry);
  }
  return out;
}

/** Find one medium by id, or null. */
export function findBackupMedium(list, id) {
  const key = text(id);
  if (!key) return null;
  const entries = normalizeBackupMediaList(list);
  return entries.find((entry) => entry.id === key) ?? null;
}

/**
 * Record one medium. A medium with no id or no label is
 * refused; a duplicate id is never rewritten. Returns the new
 * list (unchanged on refusal).
 */
export function recordBackupMedium(list, raw) {
  const clean = normalizeBackupMediaList(list);
  const entry = normalizeBackupMedium(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

/**
 * Remove one medium by id. A retired medium is never removed:
 * retired media stay listed as retired, so the register keeps
 * the history of what the drive held. Unknown ids and retired
 * media leave the list alone.
 */
export function removeBackupMedium(list, id) {
  const clean = normalizeBackupMediaList(list);
  const key = text(id);
  if (!key) return clean;
  const entry = clean.find((item) => item.id === key);
  if (!entry || entry.condition === 'retired') return clean;
  return clean.filter((item) => item.id !== key);
}

/**
 * Set the condition of only one medium. The condition folds to
 * 'good', 'watch', or 'retired'; anything else leaves the
 * medium exactly as it was. A missing medium leaves the list
 * alone.
 */
export function setBackupMediumCondition(list, id, condition) {
  const clean = normalizeBackupMediaList(list);
  const key = text(id);
  const folded = foldBackupMediaCondition(condition);
  if (!key || folded === 'not recorded') return clean;
  return clean.map((entry) => (entry.id === key ? { ...entry, condition: folded } : entry));
}

/**
 * Add one backup name to the backups a medium holds. Only that
 * medium changes; an empty name, a name already held, or a
 * missing medium leaves the list alone.
 */
export function addBackupToMedium(list, id, backup) {
  const clean = normalizeBackupMediaList(list);
  const key = text(id);
  const name = text(backup);
  if (!key || !name) return clean;
  return clean.map((entry) => {
    if (entry.id !== key) return entry;
    if (entry.backupsHeld.includes(name)) return entry;
    return { ...entry, backupsHeld: [...entry.backupsHeld, name] };
  });
}

/** Media in one condition, label A-Z, or [] for an unknown condition. */
export function backupMediaByCondition(list, condition) {
  const folded = foldBackupMediaCondition(condition);
  const entries = normalizeBackupMediaList(list);
  const found = entries.filter((entry) => entry.condition === folded);
  found.sort((a, b) => a.label.localeCompare(b.label));
  return found;
}

/** Retired media, label A-Z. They stay listed, never deleted. */
export function retiredBackupMedia(list) {
  return backupMediaByCondition(list, 'retired');
}

/** Media flagged watch — drives the owner should check — label A-Z. */
export function watchBackupMedia(list) {
  return backupMediaByCondition(list, 'watch');
}

/**
 * Media holding one named backup, label A-Z. The match is a
 * case-insensitive exact name match, so a backup is never
 * confused with a different one that only sounds similar.
 */
export function mediaHoldingBackup(list, backup) {
  const name = text(backup).toLowerCase();
  if (!name) return [];
  const entries = normalizeBackupMediaList(list);
  const found = entries.filter((entry) => entry.backupsHeld.some((held) => held.toLowerCase() === name));
  found.sort((a, b) => a.label.localeCompare(b.label));
  return found;
}

/** Plain-words summary of the register. */
export function backupMediaSummaryText(list) {
  const entries = normalizeBackupMediaList(list);
  if (!entries.length) return 'No backup media registered.';
  const counts = CONDITIONS.map((condition) => {
    const count = entries.filter((entry) => entry.condition === condition).length;
    return `${count} ${condition}`;
  }).join(', ');
  const held = entries.reduce((total, entry) => total + entry.backupsHeld.length, 0);
  return `${entries.length} backup ${entries.length === 1 ? 'medium' : 'media'} registered (${counts}); ${held} backup${held === 1 ? '' : 's'} held in total.`;
}

/** Plain-words summary of one medium. */
export function backupMediumSummaryText(entry) {
  const clean = normalizeBackupMedium(entry);
  if (!clean) return 'No backup medium.';
  const parts = [`${clean.label}${clean.type ? ` (${clean.type})` : ''}: condition ${clean.condition}`];
  if (clean.capacity) parts.push(`capacity ${clean.capacity}`);
  if (clean.firstUseDate) parts.push(`first used ${clean.firstUseDate}`);
  parts.push(clean.backupsHeld.length ? `holds ${clean.backupsHeld.join(', ')}` : 'holds no backup yet');
  return `${parts.join(', ')}.`;
}

/** Escaped HTML for one medium. */
export function backupMediumHtml(entry) {
  const clean = normalizeBackupMedium(entry);
  if (!clean) return '<p>No backup medium.</p>';
  const rows = [
    ['Label', escapeHtml(clean.label)],
    ['Type', clean.type ? escapeHtml(clean.type) : 'Not recorded'],
    ['Capacity', clean.capacity ? escapeHtml(clean.capacity) : 'Not recorded'],
    ['First used', clean.firstUseDate ? escapeHtml(clean.firstUseDate) : 'Not recorded'],
    ['Backups held', clean.backupsHeld.length ? clean.backupsHeld.map((name) => escapeHtml(name)).join(', ') : 'None yet'],
    ['Condition', escapeHtml(clean.condition)],
  ];
  return `<h4>${escapeHtml(clean.label)}</h4><table><tbody>${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`).join('')}</tbody></table>`;
}

/** Escaped HTML for the register, label A-Z. */
export function backupMediaHtml(list) {
  const entries = normalizeBackupMediaList(list);
  if (!entries.length) return '<p>No backup media registered.</p>';
  const sorted = [...entries].sort((a, b) => a.label.localeCompare(b.label));
  return sorted.map((entry) => backupMediumHtml(entry)).join('');
}

/** CSV for the register, label A-Z. */
export function backupMediaCsv(list) {
  const entries = normalizeBackupMediaList(list);
  const header = ['Label', 'Type', 'Capacity', 'First used', 'Backups held', 'Condition'];
  const lines = [header.map(csvCell).join(',')];
  const sorted = [...entries].sort((a, b) => a.label.localeCompare(b.label));
  for (const entry of sorted) {
    lines.push([
      entry.label,
      entry.type,
      entry.capacity,
      entry.firstUseDate,
      entry.backupsHeld.join('; '),
      entry.condition,
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function backupMediaFilename() {
  return 'backup-media-register.csv';
}
