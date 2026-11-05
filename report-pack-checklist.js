// Plan 328 (Plan 203-350) — Monthly report pack assembly checklist.
//
// The monthly pack (annual summary inputs, business review,
// tax figures) is assembled from memory, so a month's pack
// can silently miss a report. This module adds only the
// missing piece: one assembly checklist per month — the
// reports required for that month's pack, each report's
// status included or missing, the assembler, and the date
// completed — so a completed pack lists every required
// report as included or names what is missing, and an
// incomplete pack is flagged, never presented as complete.
//
// What this module is NOT, stated plainly:
//   - It is not the annual summary (Plan 71), the business
//     review template (Plan 185), or the tax figures pack
//     (Plan 186). Those reports already exist and are
//     neither read nor rewritten here; this checklist only
//     records whether each required report is included in
//     a month's pack, it never assembles or changes a
//     source report.
//   - It is not a customer data completeness score
//     (Plan 327), which scores customer records. That
//     view already exists and is neither read nor
//     rewritten here; this checklist is about monthly
//     report packs only.
//   - It is not a quarterly business snapshot (Plan 329).
//     That snapshot is a different plan and is not
//     implemented here; this checklist is monthly only.
//   - It is not a bill, payment, or source report change.
//     The checklist never changes any bill, payment, or
//     source report by itself: it only lists what a
//     month's pack must contain and what is still missing.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every checklist, and the module never reads storage,
//     the clock, or the network, and never mutates an
//     input.
//   - One checklist per month: a second checklist for the
//     same month is refused, and a duplicate id is never
//     rewritten, the first stays.
//   - A checklist with no id, no strict month, no
//     required reports, or no assembler is refused
//     outright. Unknown fields are dropped, so a
//     checklist can never grow a bill, payment, or
//     customer field.
//   - A report status folds to included or missing;
//     anything unknown reads as missing, so a pack is
//     never shown complete on a guessed status.
//   - Completing a checklist needs every required report
//     included and a real completion date; marking a
//     report missing clears the completion date, so an
//     incomplete pack can never wear a completed date.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict month: YYYY-MM with a real month, or false. */
export function validReportPackMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validReportPackDay(value) {
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

/** Fold a report status to included or missing; anything unknown reads as missing. */
export function foldReportPackStatus(value) {
  return text(value).toLowerCase() === 'included' ? 'included' : 'missing';
}

/**
 * One required report of a pack, or null when it has no
 * name. The status folds to included or missing, so an
 * unknown status never reads as included.
 */
export function normalizeReportPackReport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const name = text(raw.name);
  if (!name) return null;
  return { name, status: foldReportPackStatus(raw.status) };
}

/**
 * One monthly assembly checklist, or null when
 * half-formed. A checklist needs an id, a strict month,
 * at least one named required report, and an assembler.
 * The completion date is a strict calendar date or null
 * when the pack is not completed yet. Unknown fields are
 * dropped; the input is never mutated.
 */
export function normalizeReportPackChecklist(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const month = text(raw.month);
  const assembler = text(raw.assembler);
  if (!id) return null;
  if (!validReportPackMonth(month)) return null;
  if (!assembler) return null;
  if (!Array.isArray(raw.reports) || !raw.reports.length) return null;
  const seen = new Set();
  const reports = [];
  for (const item of raw.reports) {
    const clean = normalizeReportPackReport(item);
    if (!clean) continue;
    const key = clean.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    reports.push(clean);
  }
  if (!reports.length) return null;
  const dateCompleted = text(raw.dateCompleted);
  return {
    id,
    month,
    reports,
    assembler,
    dateCompleted: dateCompleted ? (validReportPackDay(dateCompleted) ? dateCompleted : null) : null,
  };
}

/** Normalised checklists only; a duplicate id or a duplicate month is never rewritten, the first stays. */
export function normalizeReportPackChecklistList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenMonths = new Set();
  const out = [];
  for (const raw of list) {
    const clean = normalizeReportPackChecklist(raw);
    if (!clean) continue;
    if (seenIds.has(clean.id)) continue;
    if (seenMonths.has(clean.month)) continue;
    seenIds.add(clean.id);
    seenMonths.add(clean.month);
    out.push(clean);
  }
  return out;
}

/** Find one checklist by id, or null. */
export function findReportPackChecklist(list, id) {
  const clean = normalizeReportPackChecklistList(list);
  return clean.find((item) => item.id === text(id)) ?? null;
}

/** Find one checklist by month, or null. */
export function findReportPackChecklistByMonth(list, month) {
  const clean = normalizeReportPackChecklistList(list);
  return clean.find((item) => item.month === text(month)) ?? null;
}

/** Record one checklist; a half-formed checklist, a duplicate id, or a duplicate month leaves the list unchanged. */
export function recordReportPackChecklist(list, raw) {
  const clean = normalizeReportPackChecklistList(list);
  const entry = normalizeReportPackChecklist(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.month === entry.month)) return clean;
  return [...clean, entry];
}

/** Remove one checklist by id; removing a missing id leaves the list unchanged. */
export function removeReportPackChecklist(list, id) {
  const clean = normalizeReportPackChecklistList(list);
  const wanted = text(id);
  if (!clean.some((item) => item.id === wanted)) return clean;
  return clean.filter((item) => item.id !== wanted);
}

/**
 * Mark one report of one checklist included or missing;
 * only that report changes. Marking a report missing
 * clears the completion date, so an incomplete pack can
 * never keep a completed date. A missing checklist, a
 * missing report, or an unknown status leaves the list
 * unchanged.
 */
export function markReportPackReport(list, checklistId, reportName, status) {
  const clean = normalizeReportPackChecklistList(list);
  const wantedStatus = text(status).toLowerCase();
  if (wantedStatus !== 'included' && wantedStatus !== 'missing') return clean;
  const wanted = text(checklistId);
  const wantedReport = text(reportName).toLowerCase();
  const index = clean.findIndex((item) => item.id === wanted);
  if (index < 0) return clean;
  const reportIndex = clean[index].reports.findIndex((report) => report.name.toLowerCase() === wantedReport);
  if (reportIndex < 0) return clean;
  const next = clean.map((item, i) => {
    if (i !== index) return item;
    const reports = item.reports.map((report, j) =>
      j === reportIndex ? { ...report, status: wantedStatus } : report,
    );
    return {
      ...item,
      reports,
      dateCompleted: wantedStatus === 'missing' ? null : item.dateCompleted,
    };
  });
  return next;
}

/**
 * Complete one checklist with a real completion date; the
 * date is set only when every required report is included
 * and the date is a strict calendar date. Otherwise the
 * list is unchanged, so an incomplete pack is never
 * presented as complete.
 */
export function completeReportPackChecklist(list, checklistId, dateCompleted) {
  const clean = normalizeReportPackChecklistList(list);
  const wanted = text(checklistId);
  const date = text(dateCompleted);
  if (!validReportPackDay(date)) return clean;
  const index = clean.findIndex((item) => item.id === wanted);
  if (index < 0) return clean;
  if (clean[index].reports.some((report) => report.status !== 'included')) return clean;
  return clean.map((item, i) => (i === index ? { ...item, dateCompleted: date } : item));
}

/**
 * Assembly status of one checklist: totals, how many
 * reports are included and missing, the missing report
 * names in order, and whether the pack is complete. A
 * pack is complete only when every required report is
 * included; a half-formed checklist returns null.
 */
export function reportPackChecklistStatus(checklist) {
  const clean = normalizeReportPackChecklist(checklist);
  if (!clean) return null;
  const missingNames = clean.reports.filter((report) => report.status !== 'included').map((report) => report.name);
  return {
    total: clean.reports.length,
    includedCount: clean.reports.length - missingNames.length,
    missingCount: missingNames.length,
    missingNames,
    complete: missingNames.length === 0,
  };
}

/** One checklist as one plain-words status line. */
export function reportPackChecklistStatusText(checklist) {
  const status = reportPackChecklistStatus(checklist);
  if (!status) return '';
  if (status.complete) return `Complete: all ${status.total} report${status.total === 1 ? '' : 's'} included.`;
  return `Incomplete: missing ${status.missingNames.join(', ')}.`;
}

/** Checklists newest month first, then id A-Z. */
export function reportPackChecklistsSorted(list) {
  return normalizeReportPackChecklistList(list).sort((a, b) =>
    a.month < b.month ? 1 : a.month > b.month ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

/** Checklists whose pack is not complete, newest month first. */
export function incompleteReportPackChecklists(list) {
  return reportPackChecklistsSorted(list).filter((item) => !reportPackChecklistStatus(item).complete);
}

/** Plain-words summary of all tracked packs. */
export function reportPackChecklistSummaryText(list) {
  const clean = normalizeReportPackChecklistList(list);
  if (!clean.length) return 'No monthly report packs tracked.';
  const complete = clean.filter((item) => reportPackChecklistStatus(item).complete).length;
  const incomplete = clean.length - complete;
  const packNoun = clean.length === 1 ? 'monthly pack' : 'monthly packs';
  return `${clean.length} ${packNoun} tracked, ${complete} complete, ${incomplete} incomplete.`;
}

/** One checklist as one plain-words line. */
export function reportPackChecklistText(checklist) {
  const clean = normalizeReportPackChecklist(checklist);
  if (!clean) return '';
  const status = reportPackChecklistStatus(clean);
  const done = clean.dateCompleted ? `, completed ${clean.dateCompleted}` : ', not completed yet';
  return `${clean.month}: ${status.includedCount} of ${status.total} reports included${status.missingCount ? ` (missing ${status.missingNames.join(', ')})` : ''}, assembled by ${clean.assembler}${done}.`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** One checklist as one HTML list item, with user text escaped. */
export function reportPackChecklistHtml(checklist) {
  const clean = normalizeReportPackChecklist(checklist);
  if (!clean) return '';
  return `<li>${escapeHtml(reportPackChecklistText(clean))} ${escapeHtml(reportPackChecklistStatusText(clean))}</li>`;
}

/** All checklists as HTML, newest month first. */
export function reportPackChecklistsHtml(list) {
  const clean = reportPackChecklistsSorted(list);
  if (!clean.length) return '<p>No monthly report packs tracked.</p>';
  return `<ul>${clean.map((item) => reportPackChecklistHtml(item)).join('')}</ul>`;
}

/** Incomplete packs as HTML, newest month first. */
export function incompleteReportPackChecklistsHtml(list) {
  const clean = incompleteReportPackChecklists(list);
  if (!clean.length) return '<p>Every tracked pack is complete.</p>';
  return `<ul>${clean.map((item) => reportPackChecklistHtml(item)).join('')}</ul>`;
}

function csvCell(value) {
  const clean = String(value ?? '');
  return /[",\n]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}

/** All checklists as CSV text, one row per required report. */
export function reportPackChecklistCsv(list) {
  const clean = reportPackChecklistsSorted(list);
  const header = 'month,checklist id,report,status,assembler,date completed';
  const rows = [];
  for (const item of clean) {
    for (const report of item.reports) {
      rows.push(
        [item.month, item.id, report.name, report.status, item.assembler, item.dateCompleted ?? '']
          .map(csvCell)
          .join(','),
      );
    }
  }
  return [header, ...rows].join('\n');
}

/** CSV filename for the checklists. */
export function reportPackChecklistFilename() {
  return 'report-pack-checklists.csv';
}
