// Report scheduling note (Plan 339): one scheduling note per recurring
// report, so due dates are visible instead of remembered. A note carries
// the report name, the due cycle, the next due date, a recipient list
// reference, and the owner. Overdue reports appear on a dated due list, and
// recording a report as produced moves its next due date forward by one
// cycle. The note only records due dates: it sends nothing automatically,
// it never produces a report, and it never changes any bill, payment, or
// report content by itself. Inputs are never mutated, and the module never
// reads storage, the clock, the network, or the page.

const REPORT_SCHEDULING_NOTE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isReportSchedulingNoteLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validReportSchedulingNoteDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = REPORT_SCHEDULING_NOTE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isReportSchedulingNoteLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanReportSchedulingNoteText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function foldReportSchedulingNoteCycle(value) {
  const clean = cleanReportSchedulingNoteText(value).toLowerCase();
  if (clean === 'weekly' || clean === 'monthly' || clean === 'quarterly' || clean === 'yearly') return clean;
  return null;
}

export function normalizeReportSchedulingNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanReportSchedulingNoteText(raw.id);
  const reportName = cleanReportSchedulingNoteText(raw.reportName);
  const cycle = foldReportSchedulingNoteCycle(raw.cycle);
  const nextDueDate = cleanReportSchedulingNoteText(raw.nextDueDate);
  const recipients = cleanReportSchedulingNoteText(raw.recipients);
  const owner = cleanReportSchedulingNoteText(raw.owner);
  const lastProducedDate = cleanReportSchedulingNoteText(raw.lastProducedDate);
  if (!id || !reportName || !cycle || !validReportSchedulingNoteDay(nextDueDate) || !owner) return null;
  if (lastProducedDate && !validReportSchedulingNoteDay(lastProducedDate)) return null;
  return { id, reportName, cycle, nextDueDate, recipients, owner, lastProducedDate };
}

export function normalizeReportSchedulingNoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeReportSchedulingNote(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordReportSchedulingNote(list, note) {
  const clean = normalizeReportSchedulingNote(note);
  if (!clean) return list;
  const known = normalizeReportSchedulingNoteList(list);
  if (known.some((entry) => entry.id === clean.id)) return list;
  return [...known, clean];
}

export function reportSchedulingNoteForReport(list, reportName) {
  const clean = normalizeReportSchedulingNoteList(list);
  const wanted = cleanReportSchedulingNoteText(reportName).toLowerCase();
  if (!wanted) return null;
  return clean.find((note) => note.reportName.toLowerCase() === wanted) ?? null;
}

function reportSchedulingNoteCompareDue(a, b) {
  if (a.nextDueDate !== b.nextDueDate) return a.nextDueDate < b.nextDueDate ? -1 : 1;
  const aName = a.reportName.toLowerCase();
  const bName = b.reportName.toLowerCase();
  if (aName !== bName) return aName < bName ? -1 : 1;
  return 0;
}

export function reportSchedulingNoteDueList(list, asOfDate) {
  const clean = normalizeReportSchedulingNoteList(list);
  const asOf = validReportSchedulingNoteDay(asOfDate) ? asOfDate : '';
  const sorted = [...clean].sort(reportSchedulingNoteCompareDue);
  return sorted.map((note) => ({ note, overdue: asOf !== '' && note.nextDueDate < asOf }));
}

export function reportSchedulingNoteOverdue(list, asOfDate) {
  if (!validReportSchedulingNoteDay(asOfDate)) return [];
  return reportSchedulingNoteDueList(list, asOfDate)
    .filter((entry) => entry.overdue)
    .map((entry) => entry.note);
}

function addReportSchedulingNoteDays(dayStr, days) {
  const year = Number(dayStr.slice(0, 4));
  const month = Number(dayStr.slice(5, 7));
  let day = Number(dayStr.slice(8, 10));
  let y = year;
  let m = month;
  let remaining = days;
  while (remaining > 0) {
    let lastDay = REPORT_SCHEDULING_NOTE_DAYS_IN_MONTH[m - 1];
    if (m === 2 && isReportSchedulingNoteLeapYear(y)) lastDay = 29;
    day += 1;
    if (day > lastDay) {
      day = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    remaining -= 1;
  }
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addReportSchedulingNoteMonths(dayStr, months) {
  const year = Number(dayStr.slice(0, 4));
  const month = Number(dayStr.slice(5, 7));
  const day = Number(dayStr.slice(8, 10));
  const totalMonths = (year * 12 + (month - 1)) + months;
  const y = Math.floor(totalMonths / 12);
  const m = (totalMonths % 12) + 1;
  let lastDay = REPORT_SCHEDULING_NOTE_DAYS_IN_MONTH[m - 1];
  if (m === 2 && isReportSchedulingNoteLeapYear(y)) lastDay = 29;
  const d = day > lastDay ? lastDay : day;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function advanceReportSchedulingNoteDueDate(dayStr, cycle) {
  if (cycle === 'weekly') return addReportSchedulingNoteDays(dayStr, 7);
  if (cycle === 'monthly') return addReportSchedulingNoteMonths(dayStr, 1);
  if (cycle === 'quarterly') return addReportSchedulingNoteMonths(dayStr, 3);
  return addReportSchedulingNoteMonths(dayStr, 12);
}

export function markReportSchedulingNoteProduced(list, id, producedDate) {
  const cleanId = cleanReportSchedulingNoteText(id);
  if (!cleanId || !validReportSchedulingNoteDay(producedDate)) return list;
  const known = normalizeReportSchedulingNoteList(list);
  const index = known.findIndex((note) => note.id === cleanId);
  if (index === -1) return list;
  const note = known[index];
  const next = {
    ...note,
    nextDueDate: advanceReportSchedulingNoteDueDate(note.nextDueDate, note.cycle),
    lastProducedDate: producedDate,
  };
  const out = [...known];
  out[index] = next;
  return out;
}

export function reportSchedulingNoteCounts(list, asOfDate) {
  const clean = normalizeReportSchedulingNoteList(list);
  return { total: clean.length, overdue: reportSchedulingNoteOverdue(clean, asOfDate).length };
}

export function reportSchedulingNoteSummaryText(list, asOfDate) {
  const counts = reportSchedulingNoteCounts(list, asOfDate);
  if (!counts.total) return 'No scheduled reports.';
  const totalText = counts.total === 1 ? '1 scheduled report' : `${counts.total} scheduled reports`;
  if (!counts.overdue) return `${totalText}.`;
  return `${totalText}, ${counts.overdue} overdue.`;
}

function reportSchedulingNoteDetailText(note) {
  const recipients = note.recipients ? `, recipients ${note.recipients}` : ', recipients not recorded';
  const produced = note.lastProducedDate ? `, last produced ${note.lastProducedDate}` : '';
  return `due ${note.nextDueDate}, cycle ${note.cycle}, owner ${note.owner}${recipients}${produced}`;
}

export function reportSchedulingNoteText(note) {
  const clean = normalizeReportSchedulingNote(note);
  if (!clean) return '';
  return `${clean.reportName} — ${reportSchedulingNoteDetailText(clean)}`;
}

export function reportSchedulingNoteDueText(list, asOfDate) {
  const entries = reportSchedulingNoteDueList(list, asOfDate);
  if (!entries.length) return 'No scheduled reports.';
  return entries
    .map(({ note, overdue }) => `${reportSchedulingNoteText(note)}${overdue ? ' — overdue' : ''}`)
    .join('\n');
}

function escapeReportSchedulingNoteHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function reportSchedulingNoteHtml(note) {
  const clean = normalizeReportSchedulingNote(note);
  if (!clean) return '';
  return `<div><strong>${escapeReportSchedulingNoteHtml(clean.reportName)}</strong> — ${escapeReportSchedulingNoteHtml(reportSchedulingNoteDetailText(clean))}</div>`;
}

export function reportSchedulingNotesHtml(list) {
  const clean = normalizeReportSchedulingNoteList(list);
  if (!clean.length) return '<p>No scheduled reports yet.</p>';
  const items = [...clean]
    .sort(reportSchedulingNoteCompareDue)
    .map((note) => `<li>${escapeReportSchedulingNoteHtml(reportSchedulingNoteText(note))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

export function reportSchedulingNoteDueHtml(list, asOfDate) {
  const entries = reportSchedulingNoteDueList(list, asOfDate);
  if (!entries.length) return '<p>No scheduled reports yet.</p>';
  const items = entries
    .map(({ note, overdue }) => `<li>${escapeReportSchedulingNoteHtml(reportSchedulingNoteText(note))}${overdue ? ' — <strong>overdue</strong>' : ''}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function reportSchedulingNoteCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function reportSchedulingNoteCsv(list) {
  const clean = normalizeReportSchedulingNoteList(list);
  const header = ['id', 'reportName', 'cycle', 'nextDueDate', 'recipients', 'owner', 'lastProducedDate'];
  const lines = [header.map(reportSchedulingNoteCsvCell).join(',')];
  for (const note of clean) {
    lines.push([
      note.id,
      note.reportName,
      note.cycle,
      note.nextDueDate,
      note.recipients,
      note.owner,
      note.lastProducedDate,
    ].map(reportSchedulingNoteCsvCell).join(','));
  }
  return lines.join('\n');
}

export function reportSchedulingNoteFilename() {
  return 'report-scheduling-notes.csv';
}
