// Plan 194 (Plan 101-202) — Backup Restore Drill Record.
//
// Backups may be verified as files, but a restore is rarely
// practised, so nobody knows whether a restore actually works
// until a real loss happens. This module writes down each
// practise run — a restore drill — so restore ability is proven
// on a record instead of assumed from a backup file existing.
//
// What this module is NOT, stated plainly:
//   - It is not a restore. It never restores, overwrites, or
//     deletes live data itself: recording a drill changes no
//     bill, payment, customer record, or live backup. The drill
//     is a note about a practise run the operator did by hand.
//   - It is not a backup. The "backup used" is a reference only
//     (a file name, a date, a label the operator types); no
//     backup content is ever stored here, and no backup record
//     is read or written.
//   - It is not the backup verification, health, or store flow.
//     backup-verification.js, backup-health.js, and
//     backup-store.js are neither read nor written here; this
//     adds only the drill-record piece.
//   - It is not a fix. Noting a follow-up does not repair
//     anything and never removes a failed drill from history:
//     a failed drill stays visible until a follow-up is noted,
//     and stays in history afterwards.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment,
//     customer, backup-content, or sending field can ever creep
//     into a drill record.
//   - Duplicate ids are never rewritten, and there is no edit
//     function at all: a drill is recorded, a follow-up is
//     noted, or the drill is removed — never silently
//     rewritten.
//   - Fail-safe outcome: any outcome other than exactly
//     "success" or "partial" is stored as "failed", so a drill
//     can never look successful on bad input.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function normalizeDate(value) {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (month < 1 || month > 12) return null;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > maxDay) return null;
  return date;
}

function normalizeOutcome(value) {
  const outcome = text(value).toLowerCase();
  if (outcome === 'success' || outcome === 'partial') return outcome;
  return 'failed';
}

function normalizeDrill(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const drillDate = normalizeDate(raw.drillDate);
  const backupRef = text(raw.backupRef);
  const practisedBy = text(raw.practisedBy);
  if (!id || !drillDate || !backupRef || !practisedBy) return null;
  return {
    id,
    drillDate,
    backupRef,
    practisedBy,
    outcome: normalizeOutcome(raw.outcome),
    issuesFound: text(raw.issuesFound),
    followUpNote: text(raw.followUpNote),
  };
}

function normalizeDrillList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const drill = normalizeDrill(entry);
    if (!drill) continue;
    if (seen.has(drill.id)) continue;
    seen.add(drill.id);
    out.push(drill);
  }
  return out;
}

function findDrill(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeDrillList(list).find((entry) => entry.id === wanted) || null;
}

function recordDrill(list, raw) {
  const entries = normalizeDrillList(list);
  const drill = normalizeDrill(raw);
  if (!drill) return entries;
  if (entries.some((entry) => entry.id === drill.id)) return entries;
  return [...entries, drill];
}

function removeDrill(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeDrillList(list);
  return normalizeDrillList(list).filter((entry) => entry.id !== wanted);
}

function noteDrillFollowUp(list, id, note) {
  const wanted = text(id);
  const followUpNote = text(note);
  if (!wanted || !followUpNote) return normalizeDrillList(list);
  return normalizeDrillList(list).map((entry) =>
    entry.id === wanted ? { ...entry, followUpNote } : entry
  );
}

function drillsSorted(list) {
  return normalizeDrillList(list).sort((a, b) => {
    if (a.drillDate !== b.drillDate) return a.drillDate < b.drillDate ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function drillsByOutcome(list, outcome) {
  const wanted = normalizeOutcome(outcome);
  return drillsSorted(list).filter((entry) => entry.outcome === wanted);
}

function failedDrillsOpen(list) {
  return drillsSorted(list).filter(
    (entry) => entry.outcome === 'failed' && !entry.followUpNote
  );
}

function drillsForBackup(list, query) {
  const wanted = text(query).toLowerCase();
  if (!wanted) return drillsSorted(list);
  return drillsSorted(list).filter((entry) =>
    entry.backupRef.toLowerCase().includes(wanted)
  );
}

function drillSummaryText(list) {
  const entries = normalizeDrillList(list);
  const openFailed = entries.filter(
    (entry) => entry.outcome === 'failed' && !entry.followUpNote
  ).length;
  return `${entries.length} restore drills recorded, ${openFailed} failed awaiting follow-up`;
}

function drillText(entry) {
  const clean = normalizeDrill(entry);
  if (!clean) return '';
  const lines = [
    `${clean.drillDate} [${clean.outcome}] backup: ${clean.backupRef}, practised by ${clean.practisedBy}`,
  ];
  if (clean.issuesFound) lines.push(`Issues found: ${clean.issuesFound}`);
  if (clean.followUpNote) lines.push(`Follow-up: ${clean.followUpNote}`);
  return lines.join('\n');
}

function drillHtml(entry) {
  const clean = normalizeDrill(entry);
  if (!clean) return '';
  const issues = clean.issuesFound
    ? `<br>Issues found: ${escapeHtml(clean.issuesFound)}`
    : '';
  const followUp = clean.followUpNote
    ? `<br>Follow-up: ${escapeHtml(clean.followUpNote)}`
    : '';
  return `<p>${escapeHtml(clean.drillDate)} [${escapeHtml(clean.outcome)}] backup: ${escapeHtml(clean.backupRef)}, practised by ${escapeHtml(clean.practisedBy)}${issues}${followUp}</p>`;
}

function drillAllHtml(list) {
  return drillsSorted(list).map(drillHtml).join('');
}

function drillCsv(list) {
  const rows = [['id', 'drillDate', 'backupRef', 'practisedBy', 'outcome', 'issuesFound', 'followUpNote']];
  for (const entry of drillsSorted(list)) {
    rows.push([
      entry.id,
      entry.drillDate,
      entry.backupRef,
      entry.practisedBy,
      entry.outcome,
      entry.issuesFound,
      entry.followUpNote,
    ]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function drillFilename() {
  return 'restore-drills.csv';
}

export {
  normalizeDate,
  normalizeOutcome,
  normalizeDrill,
  normalizeDrillList,
  findDrill,
  recordDrill,
  removeDrill,
  noteDrillFollowUp,
  drillsSorted,
  drillsByOutcome,
  failedDrillsOpen,
  drillsForBackup,
  drillSummaryText,
  drillText,
  drillHtml,
  drillAllHtml,
  drillCsv,
  drillFilename,
};
