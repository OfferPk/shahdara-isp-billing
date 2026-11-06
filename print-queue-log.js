// Print queue log (Plan 344): one queue entry per print job, so a receipt
// or sheet sent to print is never assumed printed. An entry carries the
// document reference, the template reference, the queued date, the status,
// and a retry note. Queued and failed jobs stay on an open list until a
// job is marked printed, and marking a job printed records its date.
// Logging a job never creates a bill, a payment, or a document, and it
// never prints anything by itself. Inputs are never mutated, and the
// module never reads storage, the clock, the network, or the page.

const PRINT_QUEUE_JOB_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isPrintQueueJobLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validPrintQueueJobDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = PRINT_QUEUE_JOB_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isPrintQueueJobLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanPrintQueueJobText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function foldPrintQueueJobStatus(value) {
  const clean = cleanPrintQueueJobText(value).toLowerCase();
  if (clean === 'printed' || clean === 'print' || clean === 'done') return 'printed';
  if (clean === 'failed' || clean === 'fail' || clean === 'error') return 'failed';
  return 'queued';
}

export function normalizePrintQueueJob(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanPrintQueueJobText(raw.id);
  const documentRef = cleanPrintQueueJobText(raw.documentRef);
  const templateRef = cleanPrintQueueJobText(raw.templateRef);
  const queuedDate = cleanPrintQueueJobText(raw.queuedDate);
  const status = foldPrintQueueJobStatus(raw.status);
  const printedDate = cleanPrintQueueJobText(raw.printedDate);
  const retryNote = cleanPrintQueueJobText(raw.retryNote);
  if (!id || !documentRef) return null;
  if (!validPrintQueueJobDay(queuedDate)) return null;
  if (status === 'printed') {
    if (!validPrintQueueJobDay(printedDate)) return null;
    if (printedDate < queuedDate) return null;
    return { id, documentRef, templateRef, queuedDate, status, printedDate, retryNote };
  }
  return { id, documentRef, templateRef, queuedDate, status, printedDate: '', retryNote };
}

export function normalizePrintQueueJobList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizePrintQueueJob(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordPrintQueueJob(list, job) {
  const clean = normalizePrintQueueJob(job);
  if (!clean) return list;
  const known = normalizePrintQueueJobList(list);
  if (known.some((entry) => entry.id === clean.id)) return list;
  return [...known, clean];
}

export function markPrintQueueJobPrinted(list, id, printedDate) {
  const clean = normalizePrintQueueJobList(list);
  const wantedId = cleanPrintQueueJobText(id);
  const date = cleanPrintQueueJobText(printedDate);
  const index = clean.findIndex((entry) => entry.id === wantedId);
  if (index < 0) return list;
  const entry = clean[index];
  if (entry.status === 'printed') return list;
  if (!validPrintQueueJobDay(date)) return list;
  if (date < entry.queuedDate) return list;
  return clean.map((item, i) => (i === index ? { ...item, status: 'printed', printedDate: date } : item));
}

export function markPrintQueueJobFailed(list, id, retryNote) {
  const clean = normalizePrintQueueJobList(list);
  const wantedId = cleanPrintQueueJobText(id);
  const note = cleanPrintQueueJobText(retryNote);
  const index = clean.findIndex((entry) => entry.id === wantedId);
  if (index < 0) return list;
  const entry = clean[index];
  if (entry.status === 'printed') return list;
  return clean.map((item, i) => (i === index ? { ...item, status: 'failed', retryNote: note } : item));
}

function printQueueJobCompare(a, b) {
  if (a.queuedDate !== b.queuedDate) return a.queuedDate < b.queuedDate ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function printQueueOpenJobs(list) {
  const clean = normalizePrintQueueJobList(list);
  return clean
    .filter((entry) => entry.status === 'queued' || entry.status === 'failed')
    .sort(printQueueJobCompare);
}

export function printQueueJobCounts(list) {
  const clean = normalizePrintQueueJobList(list);
  let queued = 0;
  let printed = 0;
  let failed = 0;
  for (const entry of clean) {
    if (entry.status === 'queued') queued += 1;
    else if (entry.status === 'printed') printed += 1;
    else if (entry.status === 'failed') failed += 1;
  }
  return { total: clean.length, queued, printed, failed };
}

export function printQueueJobSummaryText(list) {
  const counts = printQueueJobCounts(list);
  if (!counts.total) return 'No print jobs logged.';
  const listText = counts.total === 1 ? '1 print job' : `${counts.total} print jobs`;
  return `${listText}: ${counts.queued} queued, ${counts.printed} printed, ${counts.failed} failed.`;
}

function printQueueJobDetailText(job) {
  const templateText = job.templateRef ? `; template ${job.templateRef}` : '';
  if (job.status === 'printed') return `printed on ${job.printedDate}; queued ${job.queuedDate}${templateText}`;
  if (job.status === 'failed') {
    const retryText = job.retryNote ? ` — retry: ${job.retryNote}` : '';
    return `failed; queued ${job.queuedDate}${templateText}${retryText}`;
  }
  return `queued on ${job.queuedDate}${templateText}`;
}

export function printQueueJobText(job) {
  const clean = normalizePrintQueueJob(job);
  if (!clean) return '';
  return `${clean.documentRef} — ${printQueueJobDetailText(clean)}`;
}

export function printQueueJobsText(list) {
  const clean = normalizePrintQueueJobList(list);
  if (!clean.length) return 'No print jobs logged.';
  return [...clean].sort(printQueueJobCompare).map((entry) => printQueueJobText(entry)).join('\n');
}

function escapePrintQueueJobHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function printQueueJobHtml(job) {
  const clean = normalizePrintQueueJob(job);
  if (!clean) return '';
  return `<div><strong>${escapePrintQueueJobHtml(clean.documentRef)}</strong> — ${escapePrintQueueJobHtml(printQueueJobDetailText(clean))}</div>`;
}

export function printQueueJobsHtml(list) {
  const clean = normalizePrintQueueJobList(list);
  if (!clean.length) return '<p>No print jobs logged yet.</p>';
  const items = [...clean]
    .sort(printQueueJobCompare)
    .map((entry) => `<li>${escapePrintQueueJobHtml(printQueueJobText(entry))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

export function printQueueOpenJobsHtml(list) {
  const open = printQueueOpenJobs(list);
  if (!open.length) return '<p>No queued or failed print jobs.</p>';
  const items = open
    .map((entry) => `<li>${escapePrintQueueJobHtml(printQueueJobText(entry))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function printQueueJobCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function printQueueJobCsv(list) {
  const clean = normalizePrintQueueJobList(list);
  const header = ['id', 'documentRef', 'templateRef', 'queuedDate', 'status', 'printedDate', 'retryNote'];
  const lines = [header.map(printQueueJobCsvCell).join(',')];
  for (const entry of clean) {
    lines.push([
      entry.id,
      entry.documentRef,
      entry.templateRef,
      entry.queuedDate,
      entry.status,
      entry.printedDate,
      entry.retryNote,
    ].map(printQueueJobCsvCell).join(','));
  }
  return lines.join('\n');
}

export function printQueueJobFilename() {
  return 'print-queue-log.csv';
}
