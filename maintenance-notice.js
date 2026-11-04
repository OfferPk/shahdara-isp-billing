// Plan 175 (Plan 101-202) — Planned-Maintenance Notice Draft Per Mohalla.
//
// When planned work will briefly affect a mohalla, customers learn
// about it only when their connection drops, and assume it is a
// fault. This module prepares ONE notice draft per planned work
// item per affected mohalla: the work item in plain words, the
// expected date and time window, the mohalla, and the promise that
// the operator will confirm when the work is done. The operator
// reviews and sends each notice by hand before the work.
//
// What this module is NOT, stated plainly:
//   - It is not Plan 14's mohalla broadcast. Plan 14 prepares drafts
//     for a maintenance window, a price change, or a planned outage,
//     addressed to mohallas the operator selected, with a sent log
//     through the WhatsApp route. It is neither read nor written
//     here. This module is for planned-work notices only, one
//     notice per work item per mohalla, with a sent / not-sent
//     mark per copy instead of a sent log.
//   - It does not schedule or record the work itself. A notice
//     names the work and its expected window; it creates no
//     maintenance record, no fault record, no bill, and no payment.
//   - It never sends anything by itself. Marking a copy sent only
//     records that the operator sent that copy; it changes no
//     maintenance record, fault record, bill, or payment.
//   - It is not proof that the details are right. The notice shows
//     the stored work item, date, time window, and mohalla exactly
//     as recorded; the module verifies format and ordering, not
//     truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record
//     and the module never reads storage, the clock, or the
//     network, and never touches another record.
//   - A notice with no id, no work item, no strict expected date,
//     no time window, or no mohalla is refused outright. Unknown
//     fields are dropped, so a notice can never grow a maintenance,
//     fault, bill, payment, scheduling, or sending field.
//   - One notice per work item per mohalla (case-insensitive): a
//     second notice for the same work item and mohalla with a
//     different id is refused outright. To change a notice the
//     operator removes the old one and records a new one.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures also leaves the list unchanged.
//   - A notice for one mohalla never appears as sent to another:
//     the sent mark lives on that mohalla's copy record only, so
//     marking one copy sent leaves every other copy untouched.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function sameRecord(a, b) {
  return a.id === b.id
    && a.workItem === b.workItem
    && a.expectedDate === b.expectedDate
    && a.timeWindow === b.timeWindow
    && a.mohalla === b.mohalla
    && a.sent === b.sent
    && a.sentDate === b.sentDate;
}

export function normalizeMaintenanceNotice(notice) {
  if (!notice || typeof notice !== 'object' || Array.isArray(notice)) return null;
  const id = cleanText(notice.id);
  const workItem = cleanText(notice.workItem);
  const expectedDate = cleanText(notice.expectedDate);
  const timeWindow = cleanText(notice.timeWindow);
  const mohalla = cleanText(notice.mohalla);
  if (!id || !workItem || !expectedDate || !timeWindow || !mohalla) return null;
  if (!isStrictDate(expectedDate)) return null;
  const sent = notice.sent === true;
  let sentDate = '';
  if (notice.sentDate !== undefined && notice.sentDate !== null && notice.sentDate !== '') {
    if (!isStrictDate(notice.sentDate)) return null;
    sentDate = notice.sentDate;
  }
  return { id, workItem, expectedDate, timeWindow, mohalla, sent, sentDate };
}

export function normalizeMaintenanceNoticeList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenIds = new Set();
  const seenPairs = new Set();
  for (const item of list) {
    const record = normalizeMaintenanceNotice(item);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    const pair = `${cleanKey(record.workItem)}\n${cleanKey(record.mohalla)}`;
    if (seenPairs.has(pair)) continue;
    seenIds.add(record.id);
    seenPairs.add(pair);
    out.push(record);
  }
  return out;
}

export function findMaintenanceNotice(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  for (const record of normalizeMaintenanceNoticeList(list)) {
    if (record.id === clean) return record;
  }
  return null;
}

export function upsertMaintenanceNotice(list, notice) {
  const clean = normalizeMaintenanceNoticeList(list);
  const record = normalizeMaintenanceNotice(notice);
  if (!record) return clean;
  const existing = clean.find((item) => item.id === record.id);
  if (existing) return sameRecord(existing, record) ? clean : clean;
  const pairTaken = clean.some((item) =>
    cleanKey(item.workItem) === cleanKey(record.workItem)
    && cleanKey(item.mohalla) === cleanKey(record.mohalla));
  if (pairTaken) return clean;
  return [...clean, record];
}

export function buildMaintenanceCopy(notice, mohalla, id) {
  const source = normalizeMaintenanceNotice(notice);
  if (!source) return null;
  return normalizeMaintenanceNotice({
    id,
    workItem: source.workItem,
    expectedDate: source.expectedDate,
    timeWindow: source.timeWindow,
    mohalla,
    sent: false,
    sentDate: '',
  });
}

export function copyMaintenanceNotice(list, id, mohalla, newId) {
  const clean = normalizeMaintenanceNoticeList(list);
  const source = findMaintenanceNotice(clean, id);
  if (!source) return clean;
  const copy = buildMaintenanceCopy(source, mohalla, newId);
  if (!copy) return clean;
  return upsertMaintenanceNotice(clean, copy);
}

export function removeMaintenanceNotice(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeMaintenanceNoticeList(list);
  return normalizeMaintenanceNoticeList(list).filter((item) => item.id !== clean);
}

export function markMaintenanceSent(list, id, sentDate) {
  const clean = normalizeMaintenanceNoticeList(list);
  const target = cleanText(id);
  if (!target) return clean;
  let date = '';
  if (sentDate !== undefined && sentDate !== null && sentDate !== '') {
    if (!isStrictDate(sentDate)) return clean;
    date = sentDate;
  }
  return clean.map((item) => (item.id === target
    ? { ...item, sent: true, sentDate: date }
    : item));
}

export function markMaintenanceUnsent(list, id) {
  const clean = normalizeMaintenanceNoticeList(list);
  const target = cleanText(id);
  if (!target) return clean;
  return clean.map((item) => (item.id === target
    ? { ...item, sent: false, sentDate: '' }
    : item));
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maintenanceNoticesForMohalla(list, mohalla) {
  const key = cleanKey(mohalla);
  if (!key) return [];
  return normalizeMaintenanceNoticeList(list)
    .filter((item) => cleanKey(item.mohalla) === key)
    .sort((a, b) => compareText(a.expectedDate, b.expectedDate) || compareText(a.workItem, b.workItem));
}

export function maintenanceNoticesForWork(list, workItem) {
  const key = cleanKey(workItem);
  if (!key) return [];
  return normalizeMaintenanceNoticeList(list)
    .filter((item) => cleanKey(item.workItem) === key)
    .sort((a, b) => compareText(a.mohalla, b.mohalla) || compareText(a.id, b.id));
}

export function maintenanceNoticeMohallas(list) {
  const seen = new Map();
  for (const item of normalizeMaintenanceNoticeList(list)) {
    const key = cleanKey(item.mohalla);
    if (!seen.has(key)) seen.set(key, item.mohalla);
  }
  return [...seen.values()].sort(compareText);
}

export function maintenanceNoticeWorks(list) {
  const seen = new Map();
  for (const item of normalizeMaintenanceNoticeList(list)) {
    const key = cleanKey(item.workItem);
    if (!seen.has(key)) seen.set(key, item.workItem);
  }
  return [...seen.values()].sort(compareText);
}

export function maintenanceNoticeSentList(list) {
  return normalizeMaintenanceNoticeList(list)
    .filter((item) => item.sent)
    .sort((a, b) => compareText(a.mohalla, b.mohalla) || compareText(a.expectedDate, b.expectedDate));
}

export function maintenanceNoticeUnsentList(list) {
  return normalizeMaintenanceNoticeList(list)
    .filter((item) => !item.sent)
    .sort((a, b) => compareText(a.mohalla, b.mohalla) || compareText(a.expectedDate, b.expectedDate));
}

export function maintenanceNoticeText(notice) {
  const record = normalizeMaintenanceNotice(notice);
  if (!record) return '';
  return `Planned work in ${record.mohalla} on ${record.expectedDate} (${record.timeWindow}): ${record.workItem}. The connection may drop briefly. The operator will confirm when the work is done.`;
}

export function maintenanceNoticeSummaryText(list) {
  const clean = normalizeMaintenanceNoticeList(list);
  const sent = clean.filter((item) => item.sent).length;
  const mohallas = maintenanceNoticeMohallas(clean).length;
  return `${clean.length} maintenance notices · ${mohallas} mohallas · ${sent} sent`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function maintenanceNoticeHtml(notice) {
  const record = normalizeMaintenanceNotice(notice);
  if (!record) return '';
  const sentLabel = record.sent
    ? `Sent${record.sentDate ? ` on ${escapeHtml(record.sentDate)}` : ''}`
    : 'Not sent';
  return `<div><strong>${escapeHtml(record.workItem)}</strong> — ${escapeHtml(record.mohalla)} — ${escapeHtml(record.expectedDate)} (${escapeHtml(record.timeWindow)}) — ${escapeHtml(sentLabel)}<br>${escapeHtml(maintenanceNoticeText(record))}</div>`;
}

export function maintenanceNoticeAllHtml(list) {
  const clean = normalizeMaintenanceNoticeList(list);
  if (clean.length === 0) return '<p>No maintenance notices recorded yet.</p>';
  const sorted = [...clean].sort((a, b) =>
    compareText(a.mohalla, b.mohalla) || compareText(a.expectedDate, b.expectedDate));
  return sorted.map((item) => maintenanceNoticeHtml(item)).join('');
}

export function maintenanceNoticeMohallaHtml(list, mohalla) {
  const rows = maintenanceNoticesForMohalla(list, mohalla);
  if (rows.length === 0) return '<p>No maintenance notices for this mohalla.</p>';
  return rows.map((item) => maintenanceNoticeHtml(item)).join('');
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function maintenanceNoticeCsv(list) {
  const rows = normalizeMaintenanceNoticeList(list);
  const lines = ['id,workItem,expectedDate,timeWindow,mohalla,sent,sentDate'];
  for (const item of rows) {
    lines.push([
      csvCell(item.id),
      csvCell(item.workItem),
      csvCell(item.expectedDate),
      csvCell(item.timeWindow),
      csvCell(item.mohalla),
      csvCell(item.sent ? 'yes' : 'no'),
      csvCell(item.sentDate),
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function maintenanceNoticeFilename() {
  return 'maintenance-notices.csv';
}
