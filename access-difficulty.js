// Plan 245 (Plan 203-350) — Customer premises access difficulty note.
//
// The same access problem — a locked gate, a dog, a narrow lane,
// restricted hours — surprises every technician who visits a
// premises, because it was never written down. This module adds
// only the missing piece: one difficulty note per customer
// premises — the customer, the difficulty in plain words, what to
// do about it, the date noted, and who noted it.
//
// One note: the id, the customer, the difficulty type, the
// difficulty in plain words, what to do about it, a strict
// calendar date, who noted it, and dated updates.
//
// The fences, stated plainly:
//   - This records difficulty only. It does not replace the site
//     access permission record (Plan 156), which records
//     permission granted: that module is neither read nor
//     rewritten here, and this module imports nothing.
//   - A premises with a difficulty note shows it on the visit
//     view before the visit, and notes can be listed by
//     difficulty type.
//   - A note is never edited, only followed by a dated update:
//     there is no edit function, only record, add an update, and
//     remove. An update never rewrites the customer, the
//     difficulty type, the difficulty, what to do about it, the
//     date noted, or who noted it.
//   - Recording a difficulty never changes any bill, payment,
//     customer, permission, or visit record by itself: the module
//     takes no bill, payment, customer, permission, or visit
//     object in, edits none, and returns none. It holds
//     difficulty notes only.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const ACCESS_DIFFICULTY_STORE = 'shahdara_access_difficulties_v1';
export const ACCESS_DIFFICULTY_FILENAME = 'access-difficulties.csv';

export const ACCESS_DIFFICULTY_TYPES = [
  'locked-gate',
  'dog',
  'narrow-lane',
  'restricted-hours',
  'other',
];

const ACCESS_DIFFICULTY_TYPE_LABELS = {
  'locked-gate': 'locked gate',
  dog: 'dog',
  'narrow-lane': 'narrow lane',
  'restricted-hours': 'restricted hours',
  other: 'other',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validAccessDifficultyDate(value) {
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

export function normalizeAccessDifficultyType(value) {
  const wanted = text(value).toLowerCase();
  return ACCESS_DIFFICULTY_TYPES.includes(wanted) ? wanted : 'other';
}

export function accessDifficultyTypeLabel(type) {
  const wanted = normalizeAccessDifficultyType(type);
  return ACCESS_DIFFICULTY_TYPE_LABELS[wanted];
}

function cleanUpdates(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const note = text(item.note);
    if (!validAccessDifficultyDate(date) || !note) continue;
    out.push({ date, note });
  }
  return out;
}

function normalizeNote(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const customer = text(entry.customer);
  const difficulty = text(entry.difficulty);
  const whatToDo = text(entry.whatToDo);
  const date = text(entry.date);
  const notedBy = text(entry.notedBy);
  if (!id || !customer || !difficulty || !whatToDo) return null;
  if (!validAccessDifficultyDate(date)) return null;
  if (!notedBy) return null;
  return {
    id,
    customer,
    type: normalizeAccessDifficultyType(entry.type),
    difficulty,
    whatToDo,
    date,
    notedBy,
    updates: cleanUpdates(entry.updates),
  };
}

export function normalizeAccessDifficultyList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const clean = normalizeNote(entry);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

export function recordAccessDifficulty(list, entry) {
  const clean = normalizeNote(entry);
  if (!clean) return null;
  const base = normalizeAccessDifficultyList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  return [...base, clean];
}

export function removeAccessDifficulty(list, id) {
  const base = normalizeAccessDifficultyList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findAccessDifficulty(list, id) {
  const base = normalizeAccessDifficultyList(list);
  return base.find((item) => item.id === text(id)) || null;
}

// A note is never edited, only followed by a dated update: the
// update is appended and the original fields stay exactly as
// recorded.
export function addAccessDifficultyUpdate(list, id, update) {
  const base = normalizeAccessDifficultyList(list);
  const target = text(id);
  if (!update || typeof update !== 'object') return list;
  const date = text(update.date);
  const note = text(update.note);
  if (!validAccessDifficultyDate(date) || !note) return list;
  if (!base.some((item) => item.id === target)) return list;
  return base.map((item) =>
    item.id === target
      ? { ...item, updates: [...item.updates, { date, note }] }
      : item,
  );
}

export function accessDifficultySorted(list) {
  const base = normalizeAccessDifficultyList(list);
  return [...base].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const byCustomer = a.customer
      .toLowerCase()
      .localeCompare(b.customer.toLowerCase());
    if (byCustomer !== 0) return byCustomer;
    return a.id.localeCompare(b.id);
  });
}

export function accessDifficultiesForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return accessDifficultySorted(list).filter(
    (item) => item.customer.toLowerCase() === wanted,
  );
}

export function accessDifficultiesByType(list, type) {
  const wanted = normalizeAccessDifficultyType(type);
  return accessDifficultySorted(list).filter((item) => item.type === wanted);
}

export function accessDifficultyTypes(list) {
  const base = normalizeAccessDifficultyList(list);
  const seen = new Set();
  for (const item of base) seen.add(item.type);
  return [...seen].sort((a, b) =>
    accessDifficultyTypeLabel(a).localeCompare(accessDifficultyTypeLabel(b)),
  );
}

export function accessDifficultySummaryText(list) {
  const base = normalizeAccessDifficultyList(list);
  const customers = new Set(
    base.map((item) => item.customer.toLowerCase()),
  ).size;
  const noteWord = base.length === 1 ? 'difficulty note' : 'difficulty notes';
  return (
    `${base.length} access ${noteWord} for ${customers} customer premises. ` +
    `${accessDifficultyTypes(base)
      .map((type) => accessDifficultyTypeLabel(type))
      .join(', ') || 'No difficulty types recorded yet.'}`
  );
}

export function accessDifficultyText(note) {
  const clean = normalizeNote(note);
  if (!clean) return '';
  const updates =
    clean.updates.length === 0
      ? 'No updates yet.'
      : `${clean.updates.length} dated update${
          clean.updates.length === 1 ? '' : 's'
        }, latest ${clean.updates[clean.updates.length - 1].date}.`;
  return (
    `${clean.customer} — ${accessDifficultyTypeLabel(clean.type)}: ` +
    `${clean.difficulty} — Do this: ${clean.whatToDo} — noted ${clean.date} by ${clean.notedBy}. ${updates}`
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function accessDifficultyHtml(list) {
  const rows = accessDifficultySorted(list);
  if (rows.length === 0) return '<p>No access difficulty notes.</p>';
  const items = rows
    .map((item) => `<li>${escapeHtml(accessDifficultyText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function accessDifficultyCsv(list) {
  const rows = accessDifficultySorted(list);
  const header = [
    'id',
    'customer',
    'difficulty type',
    'difficulty',
    'what to do',
    'date noted',
    'noted by',
    'updates',
  ]
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.customer,
      accessDifficultyTypeLabel(item.type),
      item.difficulty,
      item.whatToDo,
      item.date,
      item.notedBy,
      item.updates.map((u) => `${u.date}: ${u.note}`).join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function accessDifficultyFilename() {
  return ACCESS_DIFFICULTY_FILENAME;
}
