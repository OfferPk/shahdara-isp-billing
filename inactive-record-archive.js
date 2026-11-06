// Inactive record archive note (Plan 349): one note per inactive record,
// so records of long-gone customers and closed matters stop cluttering
// every live list. A note names the record reference, the reason it is
// inactive, the archive date, the archiver, and the retrieval reference.
// It archives a record's listing status only, under the shop retention
// policy, and it never deletes anything: an archived record leaves live
// lists but stays retrievable by reference, and its history stays intact
// and visible. The note only records the archive: it never deletes any
// customer, bill, or payment record, and it never changes any of them.
// Inputs are never mutated, and the module never reads storage, the
// clock, the network, or the page.

const INACTIVE_RECORD_ARCHIVE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isInactiveRecordArchiveLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validInactiveRecordArchiveDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = INACTIVE_RECORD_ARCHIVE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isInactiveRecordArchiveLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanInactiveRecordArchiveText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeInactiveRecordArchive(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanInactiveRecordArchiveText(raw.id);
  const recordRef = cleanInactiveRecordArchiveText(raw.recordRef);
  const reasonInactive = cleanInactiveRecordArchiveText(raw.reasonInactive);
  const archiveDate = cleanInactiveRecordArchiveText(raw.archiveDate);
  const archiver = cleanInactiveRecordArchiveText(raw.archiver);
  const retrievalRef = cleanInactiveRecordArchiveText(raw.retrievalRef);
  if (!id) return null;
  if (!recordRef) return null;
  if (!reasonInactive) return null;
  if (!validInactiveRecordArchiveDay(archiveDate)) return null;
  if (!archiver) return null;
  return {
    id,
    recordRef,
    reasonInactive,
    archiveDate,
    archiver,
    retrievalRef,
  };
}

export function normalizeInactiveRecordArchiveList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeInactiveRecordArchive(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordInactiveRecordArchive(list, note) {
  const clean = normalizeInactiveRecordArchive(note);
  if (!clean) return list;
  const known = normalizeInactiveRecordArchiveList(list);
  if (known.some((item) => item.id === clean.id)) return list;
  if (known.some((item) => item.recordRef.toLowerCase() === clean.recordRef.toLowerCase())) return list;
  return [...known, clean];
}

export function inactiveRecordArchiveFor(list, recordRef) {
  const known = normalizeInactiveRecordArchiveList(list);
  const wanted = cleanInactiveRecordArchiveText(recordRef).toLowerCase();
  if (!wanted) return null;
  const match = known.find((item) => item.recordRef.toLowerCase() === wanted);
  return match || null;
}

export function inactiveRecordArchiveRetrievable(list, recordRef) {
  return inactiveRecordArchiveFor(list, recordRef);
}

function inactiveRecordArchiveCompare(a, b) {
  if (a.archiveDate !== b.archiveDate) return a.archiveDate < b.archiveDate ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function inactiveRecordArchives(list) {
  const known = normalizeInactiveRecordArchiveList(list);
  return [...known].sort(inactiveRecordArchiveCompare);
}

function normalizeInactiveRecordArchiveRefList(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const text = cleanInactiveRecordArchiveText(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function inactiveRecordArchiveLiveRecords(list, refs) {
  const known = normalizeInactiveRecordArchiveList(list);
  const archived = new Set(known.map((item) => item.recordRef.toLowerCase()));
  return normalizeInactiveRecordArchiveRefList(refs).filter((ref) => !archived.has(ref.toLowerCase()));
}

function normalizeInactiveRecordArchiveRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const reference = cleanInactiveRecordArchiveText(raw.reference);
  if (!reference) return null;
  const history = [];
  if (Array.isArray(raw.history)) {
    for (const entry of raw.history) {
      if (!entry || typeof entry !== 'object') continue;
      const text = cleanInactiveRecordArchiveText(entry.text);
      if (!text) continue;
      history.push({ date: cleanInactiveRecordArchiveText(entry.date), text });
    }
  }
  return { reference, history };
}

export function inactiveRecordArchiveHistory(note, records) {
  const clean = normalizeInactiveRecordArchive(note);
  if (!clean) return null;
  const supplied = Array.isArray(records) ? records.map(normalizeInactiveRecordArchiveRecord).filter(Boolean) : [];
  const found = supplied.find((record) => record.reference.toLowerCase() === clean.recordRef.toLowerCase());
  if (!found) return null;
  const history = [...found.history].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
  });
  return {
    recordRef: clean.recordRef,
    reasonInactive: clean.reasonInactive,
    archiveDate: clean.archiveDate,
    retrievalRef: clean.retrievalRef,
    history,
  };
}

export function inactiveRecordArchiveCountsAll(list) {
  const known = normalizeInactiveRecordArchiveList(list);
  const archived = new Set(known.map((item) => item.recordRef.toLowerCase()));
  return { notes: known.length, archived: archived.size };
}

export function inactiveRecordArchiveSummaryText(list) {
  const counts = inactiveRecordArchiveCountsAll(list);
  if (counts.notes === 0) return 'No inactive records archived.';
  return `${counts.notes} archive note${counts.notes === 1 ? '' : 's'} recorded, ${counts.archived} record${counts.archived === 1 ? '' : 's'} archived, none deleted.`;
}

export function inactiveRecordArchiveText(note) {
  const clean = normalizeInactiveRecordArchive(note);
  if (!clean) return '';
  const retrieval = clean.retrievalRef ? `, retrieval reference: ${clean.retrievalRef}` : ', no retrieval reference recorded';
  return `${clean.archiveDate} — ${clean.recordRef} archived by ${clean.archiver}, reason: ${clean.reasonInactive}${retrieval}.`;
}

function escapeInactiveRecordArchiveHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function inactiveRecordArchivesHtml(list) {
  const items = inactiveRecordArchives(list).map((item) => `<li>${escapeInactiveRecordArchiveHtml(inactiveRecordArchiveText(item))} Kept as archived, never deleted.</li>`).join('');
  return `<ul>${items}</ul>`;
}

export function inactiveRecordArchiveLiveHtml(list, refs) {
  const live = inactiveRecordArchiveLiveRecords(list, refs);
  const items = live.map((ref) => `<li>${escapeInactiveRecordArchiveHtml(ref)}</li>`).join('');
  return `<ul>${items}</ul>`;
}

function inactiveRecordArchiveCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function inactiveRecordArchiveCsv(list) {
  const known = inactiveRecordArchives(list);
  const header = ['id', 'recordRef', 'reasonInactive', 'archiveDate', 'archiver', 'retrievalRef'];
  const lines = [header.map(inactiveRecordArchiveCsvCell).join(',')];
  for (const item of known) {
    lines.push([
      item.id,
      item.recordRef,
      item.reasonInactive,
      item.archiveDate,
      item.archiver,
      item.retrievalRef,
    ].map(inactiveRecordArchiveCsvCell).join(','));
  }
  return lines.join('\n');
}

export function inactiveRecordArchiveFilename() {
  return 'inactive-record-archive-notes.csv';
}
