// Plan 228 (Plan 203-350) — Bill format version note.
//
// The bill's printed format changes over time, but a bill does not
// record which format version it used, so an old bill cannot be
// explained or faithfully reprinted later. This module adds only the
// missing piece: one format-version record per format change (the
// version number, the date it became effective, and a plain-words
// description of what changed), plus the version stamped on each bill
// issued under it.
//
// The fences, stated plainly:
//   - This describes formats only: it changes no bill amount and no
//     bill content. Stamping a version never changes any bill,
//     payment, or customer record by itself.
//   - The app release-notes log (Plan 195) records app versions, not
//     bill formats, and is neither read nor rewritten here. The bill
//     reissue note (Plan 216) marks a copy as a reissue, not which
//     format it used, and is neither read nor rewritten here. The
//     bill delivery log (Plan 205) records how a bill reached the
//     customer, not its format, and is neither read nor rewritten.
//   - A version record with no id, no version, no strict effective
//     date, or no description is refused outright. A bill stamp with
//     no id, no bill reference, no version, or no strict stamped
//     date is refused outright. Duplicate ids are never rewritten,
//     a version number is recorded only once, and a bill carries
//     only one stamp. There is no edit function: only record and
//     remove.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validFormatDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  const cell = String(value);
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function normalizeFormatVersion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const version = text(raw.version);
  const dateEffective = text(raw.dateEffective);
  const description = text(raw.description);
  if (!id || !version || !description) return null;
  if (!validFormatDate(dateEffective)) return null;
  return { id, version, dateEffective, description };
}

export function normalizeFormatVersionList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenVersions = new Set();
  const out = [];
  for (const raw of list) {
    const version = normalizeFormatVersion(raw);
    if (!version || seenIds.has(version.id) || seenVersions.has(version.version)) continue;
    seenIds.add(version.id);
    seenVersions.add(version.version);
    out.push(version);
  }
  return out;
}

export function recordFormatVersion(list, raw) {
  const clean = normalizeFormatVersionList(list);
  const version = normalizeFormatVersion(raw);
  if (!version) return null;
  if (clean.some((item) => item.id === version.id)) return null;
  if (clean.some((item) => item.version === version.version)) return null;
  return [...clean, version];
}

export function removeFormatVersion(list, id) {
  const clean = normalizeFormatVersionList(list);
  return clean.filter((item) => item.id !== text(id));
}

export function formatVersionsSorted(list) {
  const clean = normalizeFormatVersionList(list);
  return [...clean].sort((a, b) =>
    a.dateEffective.localeCompare(b.dateEffective) ||
    a.version.localeCompare(b.version) ||
    a.id.localeCompare(b.id));
}

export function findFormatVersion(list, version) {
  const clean = normalizeFormatVersionList(list);
  return clean.find((item) => item.version === text(version)) ?? null;
}

export function normalizeBillFormatStamp(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const billRef = text(raw.billRef);
  const version = text(raw.version);
  const dateStamped = text(raw.dateStamped);
  if (!id || !billRef || !version) return null;
  if (!validFormatDate(dateStamped)) return null;
  return { id, billRef, version, dateStamped };
}

export function normalizeBillFormatStampList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenBills = new Set();
  const out = [];
  for (const raw of list) {
    const stamp = normalizeBillFormatStamp(raw);
    if (!stamp || seenIds.has(stamp.id) || seenBills.has(stamp.billRef)) continue;
    seenIds.add(stamp.id);
    seenBills.add(stamp.billRef);
    out.push(stamp);
  }
  return out;
}

export function stampBillFormat(list, raw) {
  const clean = normalizeBillFormatStampList(list);
  const stamp = normalizeBillFormatStamp(raw);
  if (!stamp) return null;
  if (clean.some((item) => item.id === stamp.id)) return null;
  if (clean.some((item) => item.billRef === stamp.billRef)) return null;
  return [...clean, stamp];
}

export function removeBillFormatStamp(list, id) {
  const clean = normalizeBillFormatStampList(list);
  return clean.filter((item) => item.id !== text(id));
}

export function billFormatStampsSorted(list) {
  const clean = normalizeBillFormatStampList(list);
  return [...clean].sort((a, b) =>
    a.dateStamped.localeCompare(b.dateStamped) ||
    a.billRef.localeCompare(b.billRef) ||
    a.id.localeCompare(b.id));
}

export function flaggedBillFormatStamps(stamps, versions) {
  const cleanStamps = normalizeBillFormatStampList(stamps);
  const cleanVersions = normalizeFormatVersionList(versions);
  const known = new Set(cleanVersions.map((item) => item.version));
  return cleanStamps.filter((stamp) => !known.has(stamp.version));
}

export function billFormatStampText(stamp, versions) {
  const clean = normalizeBillFormatStamp(stamp);
  if (!clean) return '';
  const record = findFormatVersion(versions, clean.version);
  if (!record) return `Bill ${clean.billRef} uses format version ${clean.version}, which has no format record — flagged.`;
  return `Bill ${clean.billRef} uses format version ${clean.version} (effective ${record.dateEffective}).`;
}

export function formatVersionEntryText(version) {
  const clean = normalizeFormatVersion(version);
  if (!clean) return '';
  return `Format version ${clean.version} (effective ${clean.dateEffective}): ${clean.description}`;
}

export function buildFormatVersionSummary(versions, stamps) {
  const cleanVersions = normalizeFormatVersionList(versions);
  const cleanStamps = normalizeBillFormatStampList(stamps);
  const flagged = flaggedBillFormatStamps(cleanStamps, cleanVersions);
  return {
    versions: cleanVersions.length,
    billsStamped: cleanStamps.length,
    flaggedBills: flagged.length,
  };
}

export function formatVersionSummaryText(versions, stamps) {
  const summary = buildFormatVersionSummary(versions, stamps);
  return `${summary.versions} format versions, ${summary.billsStamped} bills stamped, ${summary.flaggedBills} bills flagged (version has no record).`;
}

export function formatVersionEntryHtml(version) {
  const clean = normalizeFormatVersion(version);
  if (!clean) return '';
  return `<p>Format version ${escapeHtml(clean.version)} (effective ${escapeHtml(clean.dateEffective)}): ${escapeHtml(clean.description)}</p>`;
}

export function billFormatStampHtml(stamp, versions) {
  const clean = normalizeBillFormatStamp(stamp);
  if (!clean) return '';
  return `<p>${escapeHtml(billFormatStampText(clean, versions))}</p>`;
}

export function formatVersionCsv(versions, stamps) {
  const cleanVersions = formatVersionsSorted(versions);
  const cleanStamps = billFormatStampsSorted(stamps);
  const lines = ['type,id,reference,version,date,description'];
  for (const version of cleanVersions) {
    lines.push(['version', version.id, '', version.version, version.dateEffective, version.description].map(escapeCsv).join(','));
  }
  for (const stamp of cleanStamps) {
    lines.push(['bill-stamp', stamp.id, stamp.billRef, stamp.version, stamp.dateStamped, billFormatStampText(stamp, versions)].map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

export function formatVersionFilename() {
  return 'bill-format-versions.csv';
}
