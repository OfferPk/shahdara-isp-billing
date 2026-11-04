// Plan 166 (Plan 101-202) — New-Package Announcement Draft Per Mohalla.
//
// When a new package appears, telling customers one by one is slow and
// uneven, so some mohallas hear about it weeks later than others. This
// module prepares ONE announcement draft per new package per mohalla:
// package name, monthly rate, and a plain-words description, prepared
// once and then copied per mohalla with only the mohalla name changed.
// The operator reviews and sends each copy by hand.
//
// What this module is NOT, stated plainly:
//   - It is not Plan 14's mohalla broadcast. Plan 14 prepares drafts for
//     a maintenance window, a price change, or a planned outage,
//     addressed to mohallas the operator selected, with a sent log
//     through the WhatsApp route. It is neither read nor written here.
//     This module is for NEW-PACKAGE announcements only, one draft
//     per package per mohalla, with a sent / not-sent mark per copy.
//   - It never sends anything by itself, and it never enrols anyone.
//     Marking a copy sent only records that the operator sent that
//     copy; it changes no customer's package, bill, or payment.
//   - It never alters a customer list. Preparing a draft touches no
//     customer record at all — a draft names a package and a mohalla,
//     not a customer.
//   - It is not proof that the details are right. The draft shows the
//     stored package, rate, and description exactly as recorded; the
//     module verifies format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record and
//     the module never reads storage, the clock, or the network, and
//     never touches another record.
//   - A draft with no id, no package name, no usable monthly rate, no
//     description, or no mohalla is refused outright. Unknown fields
//     are dropped, so a draft can never grow a customer, package
//     assignment, bill, payment, enrolment, or sending field.
//   - One draft per package per mohalla (case-insensitive): a second
//     draft for the same package and mohalla with a different id is
//     refused outright. To change a draft the operator removes the
//     old one and records a new one.
//   - A duplicate id is never rewritten: an identical re-save leaves
//     the list unchanged, and a re-save with different figures also
//     leaves the list unchanged.
//   - A draft for one mohalla never appears as sent to another: the
//     sent mark lives on that mohalla's copy record only, so marking
//     one copy sent leaves every other copy untouched.

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

function usableRate(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function sameRecord(a, b) {
  return a.id === b.id
    && a.packageName === b.packageName
    && a.monthlyRate === b.monthlyRate
    && a.description === b.description
    && a.mohalla === b.mohalla
    && a.sent === b.sent
    && a.sentDate === b.sentDate;
}

export function normalizeAnnouncementDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const id = cleanText(draft.id);
  const packageName = cleanText(draft.packageName);
  const description = cleanText(draft.description);
  const mohalla = cleanText(draft.mohalla);
  if (!id || !packageName || !description || !mohalla) return null;
  const monthlyRate = usableRate(draft.monthlyRate);
  if (monthlyRate === null) return null;
  const sent = draft.sent === true;
  let sentDate = '';
  if (draft.sentDate !== undefined && draft.sentDate !== null && draft.sentDate !== '') {
    if (!isStrictDate(draft.sentDate)) return null;
    sentDate = draft.sentDate;
  }
  return { id, packageName, monthlyRate, description, mohalla, sent, sentDate };
}

export function normalizeAnnouncementDraftList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenIds = new Set();
  const seenPairs = new Set();
  for (const item of list) {
    const record = normalizeAnnouncementDraft(item);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    const pair = `${cleanKey(record.packageName)}\n${cleanKey(record.mohalla)}`;
    if (seenPairs.has(pair)) continue;
    seenIds.add(record.id);
    seenPairs.add(pair);
    out.push(record);
  }
  return out;
}

export function findAnnouncementDraft(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  for (const record of normalizeAnnouncementDraftList(list)) {
    if (record.id === clean) return record;
  }
  return null;
}

export function upsertAnnouncementDraft(list, draft) {
  const clean = normalizeAnnouncementDraftList(list);
  const record = normalizeAnnouncementDraft(draft);
  if (!record) return clean;
  const existing = clean.find((item) => item.id === record.id);
  if (existing) return sameRecord(existing, record) ? clean : clean;
  const pairTaken = clean.some((item) =>
    cleanKey(item.packageName) === cleanKey(record.packageName)
    && cleanKey(item.mohalla) === cleanKey(record.mohalla));
  if (pairTaken) return clean;
  return [...clean, record];
}

export function buildAnnouncementCopy(draft, mohalla, id) {
  const source = normalizeAnnouncementDraft(draft);
  if (!source) return null;
  return normalizeAnnouncementDraft({
    id,
    packageName: source.packageName,
    monthlyRate: source.monthlyRate,
    description: source.description,
    mohalla,
    sent: false,
    sentDate: '',
  });
}

export function copyAnnouncementDraft(list, id, mohalla, newId) {
  const clean = normalizeAnnouncementDraftList(list);
  const source = findAnnouncementDraft(clean, id);
  if (!source) return clean;
  const copy = buildAnnouncementCopy(source, mohalla, newId);
  if (!copy) return clean;
  return upsertAnnouncementDraft(clean, copy);
}

export function removeAnnouncementDraft(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeAnnouncementDraftList(list);
  return normalizeAnnouncementDraftList(list).filter((item) => item.id !== clean);
}

export function markAnnouncementSent(list, id, sentDate) {
  const clean = normalizeAnnouncementDraftList(list);
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

export function markAnnouncementUnsent(list, id) {
  const clean = normalizeAnnouncementDraftList(list);
  const target = cleanText(id);
  if (!target) return clean;
  return clean.map((item) => (item.id === target
    ? { ...item, sent: false, sentDate: '' }
    : item));
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function announcementDraftsForMohalla(list, mohalla) {
  const key = cleanKey(mohalla);
  if (!key) return [];
  return normalizeAnnouncementDraftList(list)
    .filter((item) => cleanKey(item.mohalla) === key)
    .sort((a, b) => compareText(a.packageName, b.packageName) || compareText(a.id, b.id));
}

export function announcementDraftsForPackage(list, packageName) {
  const key = cleanKey(packageName);
  if (!key) return [];
  return normalizeAnnouncementDraftList(list)
    .filter((item) => cleanKey(item.packageName) === key)
    .sort((a, b) => compareText(a.mohalla, b.mohalla) || compareText(a.id, b.id));
}

export function announcementDraftMohallas(list) {
  const seen = new Map();
  for (const item of normalizeAnnouncementDraftList(list)) {
    const key = cleanKey(item.mohalla);
    if (!seen.has(key)) seen.set(key, item.mohalla);
  }
  return [...seen.values()].sort(compareText);
}

export function announcementDraftPackages(list) {
  const seen = new Map();
  for (const item of normalizeAnnouncementDraftList(list)) {
    const key = cleanKey(item.packageName);
    if (!seen.has(key)) seen.set(key, item.packageName);
  }
  return [...seen.values()].sort(compareText);
}

export function announcementDraftSentList(list) {
  return normalizeAnnouncementDraftList(list)
    .filter((item) => item.sent)
    .sort((a, b) => compareText(a.mohalla, b.mohalla) || compareText(a.packageName, b.packageName));
}

export function announcementDraftUnsentList(list) {
  return normalizeAnnouncementDraftList(list)
    .filter((item) => !item.sent)
    .sort((a, b) => compareText(a.mohalla, b.mohalla) || compareText(a.packageName, b.packageName));
}

export function announcementDraftText(draft) {
  const record = normalizeAnnouncementDraft(draft);
  if (!record) return '';
  return `New package in ${record.mohalla}: ${record.packageName} — Rs ${record.monthlyRate}/month. ${record.description}`;
}

export function announcementDraftSummaryText(list) {
  const clean = normalizeAnnouncementDraftList(list);
  const sent = clean.filter((item) => item.sent).length;
  const mohallas = announcementDraftMohallas(clean).length;
  return `${clean.length} announcement drafts · ${mohallas} mohallas · ${sent} sent`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function announcementDraftHtml(draft) {
  const record = normalizeAnnouncementDraft(draft);
  if (!record) return '';
  const sentLabel = record.sent
    ? `Sent${record.sentDate ? ` on ${escapeHtml(record.sentDate)}` : ''}`
    : 'Not sent';
  return `<div><strong>${escapeHtml(record.packageName)}</strong> — ${escapeHtml(record.mohalla)} — Rs ${record.monthlyRate}/month — ${escapeHtml(sentLabel)}<br>${escapeHtml(announcementDraftText(record))}</div>`;
}

export function announcementDraftAllHtml(list) {
  const clean = normalizeAnnouncementDraftList(list);
  if (clean.length === 0) return '<p>No announcement drafts recorded yet.</p>';
  const sorted = [...clean].sort((a, b) =>
    compareText(a.mohalla, b.mohalla) || compareText(a.packageName, b.packageName));
  return sorted.map((item) => announcementDraftHtml(item)).join('');
}

export function announcementDraftMohallaHtml(list, mohalla) {
  const rows = announcementDraftsForMohalla(list, mohalla);
  if (rows.length === 0) return '<p>No announcement drafts for this mohalla.</p>';
  return rows.map((item) => announcementDraftHtml(item)).join('');
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function announcementDraftCsv(list) {
  const rows = normalizeAnnouncementDraftList(list);
  const lines = ['id,packageName,monthlyRate,description,mohalla,sent,sentDate'];
  for (const item of rows) {
    lines.push([
      csvCell(item.id),
      csvCell(item.packageName),
      csvCell(item.monthlyRate),
      csvCell(item.description),
      csvCell(item.mohalla),
      csvCell(item.sent ? 'yes' : 'no'),
      csvCell(item.sentDate),
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function announcementDraftFilename() {
  return 'announcement-drafts.csv';
}
