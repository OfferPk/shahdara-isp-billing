// Plan 196 (Plan 101-202) — Shop Keys and Access Register.
//
// Shop keys, lock codes, and access items are handed out
// informally, so it is unclear who currently holds what and
// whether a returned item was actually returned. This module
// writes that custody down — one record per issue: the item,
// the holder, the date issued, the date returned, and a note.
//
// What this module is NOT, stated plainly:
//   - It is not a place that stores secrets. It records
//     custody only: the item name, who holds it, and the
//     dates. It never stores a code, password, PIN, or any
//     other secret value, and unknown fields are dropped, so
//     no secret field can ever creep into a record.
//   - It is not access control. Recording an issue or a
//     return never grants or revokes any system access, and
//     never changes any bill, payment, staff record, or
//     system permission.
//   - It is not site access permission. site-access.js
//     (Plan 156: site permission with scope and expiry) and
//     the tool-custody register are neither read nor written
//     here; this adds only the shop-keys custody piece.
//   - It is not an edit history. There is no edit function
//     at all: a record is issued, returned, or removed —
//     never silently rewritten — so returned items stay in
//     history exactly as first recorded.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, and never touches another record type.
//   - Each item has at most one current holder: issuing an
//     item that already has an unreturned record is refused
//     outright (item names match case-insensitively, first
//     spelling kept), so two people can never quietly hold
//     the same key at once.
//   - A return only records the return date: it never
//     removes the record, never overwrites an existing
//     return date, and a return date before the issue date
//     is refused.
//   - Duplicate ids are never rewritten.
//   - Inputs are never mutated: every function returns new
//     records.

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

function normalizeAccessEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const item = text(raw.item);
  const holder = text(raw.holder);
  const dateIssued = normalizeDate(raw.dateIssued);
  if (!id || !item || !holder || !dateIssued) return null;
  let dateReturned = '';
  if (raw.dateReturned !== undefined && raw.dateReturned !== null && text(raw.dateReturned) !== '') {
    dateReturned = normalizeDate(raw.dateReturned);
    if (!dateReturned) return null;
    if (dateReturned < dateIssued) return null;
  }
  return {
    id,
    item,
    holder,
    dateIssued,
    dateReturned,
    note: text(raw.note),
  };
}

function normalizeAccessList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const clean = normalizeAccessEntry(entry);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

function findAccessEntry(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeAccessList(list).find((entry) => entry.id === wanted) || null;
}

function isCurrentlyHeld(list, item) {
  const wanted = text(item).toLowerCase();
  if (!wanted) return false;
  return normalizeAccessList(list).some(
    (entry) => entry.item.toLowerCase() === wanted && !entry.dateReturned,
  );
}

function recordAccessEntry(list, raw) {
  const entries = normalizeAccessList(list);
  const entry = normalizeAccessEntry(raw);
  if (!entry) return entries;
  if (entries.some((item) => item.id === entry.id)) return entries;
  if (isCurrentlyHeld(entries, entry.item)) return entries;
  return [...entries, entry];
}

function markAccessReturned(list, id, dateReturned) {
  const entries = normalizeAccessList(list);
  const wanted = text(id);
  const returned = normalizeDate(dateReturned);
  if (!wanted || !returned) return entries;
  return entries.map((entry) => {
    if (entry.id !== wanted) return entry;
    if (entry.dateReturned) return entry;
    if (returned < entry.dateIssued) return entry;
    return { ...entry, dateReturned: returned };
  });
}

function removeAccessEntry(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeAccessList(list);
  return normalizeAccessList(list).filter((entry) => entry.id !== wanted);
}

function accessSorted(list) {
  return normalizeAccessList(list).sort((a, b) => {
    const itemA = a.item.toLowerCase();
    const itemB = b.item.toLowerCase();
    if (itemA !== itemB) return itemA < itemB ? -1 : 1;
    if (a.dateIssued !== b.dateIssued) return a.dateIssued < b.dateIssued ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function currentHolders(list) {
  return accessSorted(list).filter((entry) => !entry.dateReturned);
}

function returnedAccess(list) {
  return accessSorted(list).filter((entry) => entry.dateReturned);
}

function accessForHolder(list, holder) {
  const wanted = text(holder).toLowerCase();
  if (!wanted) return [];
  return accessSorted(list).filter((entry) => entry.holder.toLowerCase() === wanted);
}

function accessForItem(list, item) {
  const wanted = text(item).toLowerCase();
  if (!wanted) return [];
  return accessSorted(list).filter((entry) => entry.item.toLowerCase() === wanted);
}

function accessSummaryText(list) {
  const entries = normalizeAccessList(list);
  if (entries.length === 0) return 'No access items recorded.';
  const current = entries.filter((entry) => !entry.dateReturned).length;
  const returned = entries.length - current;
  return `${entries.length} access records, ${current} currently held, ${returned} returned.`;
}

function accessText(entry) {
  const clean = normalizeAccessEntry(entry);
  if (!clean) return '';
  const status = clean.dateReturned
    ? `returned ${clean.dateReturned}`
    : 'currently held';
  const note = clean.note ? ` — ${clean.note}` : '';
  return `${clean.item} held by ${clean.holder} since ${clean.dateIssued}, ${status}${note}`;
}

function accessHtml(entry) {
  const clean = normalizeAccessEntry(entry);
  if (!clean) return '';
  const status = clean.dateReturned
    ? `returned ${escapeHtml(clean.dateReturned)}`
    : 'currently held';
  const note = clean.note ? ` — ${escapeHtml(clean.note)}` : '';
  return `<p>${escapeHtml(clean.item)} held by ${escapeHtml(clean.holder)} since ${escapeHtml(clean.dateIssued)}, ${status}${note}</p>`;
}

function accessAllHtml(list) {
  return accessSorted(list).map(accessHtml).join('');
}

function accessCsv(list) {
  const rows = [['id', 'item', 'holder', 'dateIssued', 'dateReturned', 'note']];
  for (const entry of accessSorted(list)) {
    rows.push([
      entry.id,
      entry.item,
      entry.holder,
      entry.dateIssued,
      entry.dateReturned,
      entry.note,
    ]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function accessFilename() {
  return 'access-register.csv';
}

export {
  normalizeDate,
  normalizeAccessEntry,
  normalizeAccessList,
  findAccessEntry,
  isCurrentlyHeld,
  recordAccessEntry,
  markAccessReturned,
  removeAccessEntry,
  accessSorted,
  currentHolders,
  returnedAccess,
  accessForHolder,
  accessForItem,
  accessSummaryText,
  accessText,
  accessHtml,
  accessAllHtml,
  accessCsv,
  accessFilename,
};
