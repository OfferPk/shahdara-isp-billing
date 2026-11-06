// Report recipient list (Plan 345): one recipient list per report, so
// every report reaches the person who needs it — owner, accountant, or
// collector — without relying on memory as reporting grows. A list names
// the report, its recipients by role or name, the delivery method (in
// person, or paper kept at shop), and the date it was set. A report with
// no recipients is flagged, never hidden. The list only names recipients:
// it never sends any report and never changes any bill, payment, or
// report content. It is distinct from the export custody log (Plan 199),
// which records who held an export after it left. Inputs are never
// mutated, and the module never reads storage, the clock, the network,
// or the page.

const REPORT_RECIPIENT_LIST_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isReportRecipientListLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validReportRecipientListDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = REPORT_RECIPIENT_LIST_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isReportRecipientListLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanReportRecipientListText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function foldReportRecipientDeliveryMethod(value) {
  const clean = cleanReportRecipientListText(value).toLowerCase();
  if (clean === 'paper kept at shop' || clean === 'paper' || clean === 'shop') return 'paper kept at shop';
  return 'in person';
}

export function normalizeReportRecipients(value) {
  const parts = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    const clean = cleanReportRecipientListText(part);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export function normalizeReportRecipientList(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanReportRecipientListText(raw.id);
  const reportName = cleanReportRecipientListText(raw.reportName);
  const recipients = normalizeReportRecipients(raw.recipients);
  const deliveryMethod = foldReportRecipientDeliveryMethod(raw.deliveryMethod);
  const dateSet = cleanReportRecipientListText(raw.dateSet);
  if (!id || !reportName) return null;
  if (!validReportRecipientListDay(dateSet)) return null;
  return { id, reportName, recipients, deliveryMethod, dateSet };
}

export function normalizeReportRecipientListList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeReportRecipientList(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordReportRecipientList(list, entry) {
  const clean = normalizeReportRecipientList(entry);
  if (!clean) return list;
  const known = normalizeReportRecipientListList(list);
  if (known.some((item) => item.id === clean.id)) return list;
  if (known.some((item) => item.reportName.toLowerCase() === clean.reportName.toLowerCase())) return list;
  return [...known, clean];
}

export function setReportRecipients(list, reportName, recipients) {
  const known = normalizeReportRecipientListList(list);
  const wanted = cleanReportRecipientListText(reportName).toLowerCase();
  const index = known.findIndex((item) => item.reportName.toLowerCase() === wanted);
  if (index < 0) return list;
  const next = normalizeReportRecipients(recipients);
  return known.map((item, i) => (i === index ? { ...item, recipients: next } : item));
}

export function reportRecipientListFor(list, reportName) {
  const known = normalizeReportRecipientListList(list);
  const wanted = cleanReportRecipientListText(reportName).toLowerCase();
  return known.find((item) => item.reportName.toLowerCase() === wanted) ?? null;
}

function reportRecipientListCompare(a, b) {
  const nameA = a.reportName.toLowerCase();
  const nameB = b.reportName.toLowerCase();
  if (nameA !== nameB) return nameA < nameB ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function reportRecipientListsWithoutRecipients(list) {
  const known = normalizeReportRecipientListList(list);
  return known
    .filter((item) => item.recipients.length === 0)
    .sort(reportRecipientListCompare);
}

export function reportRecipientListCounts(list) {
  const known = normalizeReportRecipientListList(list);
  let withRecipients = 0;
  let withoutRecipients = 0;
  for (const item of known) {
    if (item.recipients.length === 0) withoutRecipients += 1;
    else withRecipients += 1;
  }
  return { total: known.length, withRecipients, withoutRecipients };
}

export function reportRecipientListSummaryText(list) {
  const counts = reportRecipientListCounts(list);
  if (counts.total === 0) return 'No report recipient lists recorded.';
  if (counts.withoutRecipients === 0) {
    return `${counts.total} report${counts.total === 1 ? '' : 's'} with recipients listed.`;
  }
  return `${counts.total} report${counts.total === 1 ? '' : 's'} with recipients listed, ${counts.withoutRecipients} with no recipients — flagged below.`;
}

export function reportRecipientListText(item) {
  const recipients = item.recipients.length
    ? item.recipients.join(', ')
    : 'No recipients — flagged';
  return `${item.reportName}: ${recipients} (${item.deliveryMethod}, set ${item.dateSet})`;
}

export function reportRecipientListsText(list) {
  const known = normalizeReportRecipientListList(list);
  return [...known].sort(reportRecipientListCompare).map(reportRecipientListText);
}

function escapeReportRecipientListHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function reportRecipientListHtml(item) {
  const recipients = item.recipients.length
    ? item.recipients.map(escapeReportRecipientListHtml).join(', ')
    : '<strong>No recipients — flagged</strong>';
  return `<li>${escapeReportRecipientListHtml(item.reportName)}: ${recipients} (${escapeReportRecipientListHtml(item.deliveryMethod)}, set ${escapeReportRecipientListHtml(item.dateSet)})</li>`;
}

export function reportRecipientListsHtml(list) {
  const known = normalizeReportRecipientListList(list);
  const items = [...known].sort(reportRecipientListCompare).map(reportRecipientListHtml).join('');
  return `<ul>${items}</ul>`;
}

function reportRecipientListCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function reportRecipientListCsv(list) {
  const known = normalizeReportRecipientListList(list);
  const header = ['id', 'reportName', 'recipients', 'deliveryMethod', 'dateSet'];
  const lines = [header.map(reportRecipientListCsvCell).join(',')];
  for (const item of [...known].sort(reportRecipientListCompare)) {
    lines.push([
      item.id,
      item.reportName,
      item.recipients.join('; '),
      item.deliveryMethod,
      item.dateSet,
    ].map(reportRecipientListCsvCell).join(','));
  }
  return lines.join('\n');
}

export function reportRecipientListFilename() {
  return 'report-recipient-list.csv';
}
