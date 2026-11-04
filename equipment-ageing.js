// Plan 197 (Plan 101-202) — Replacement Reserve and Equipment Ageing Tracker.
//
// Key shop equipment ages quietly, so replacement arrives as an
// emergency purchase instead of a planned one. This module writes
// down, per item, what it is, when it was bought, the expected life
// the owner entered, a condition note, and a reserve note — so
// replacements can be planned and budgeted for before a failure
// forces a rushed decision.
//
// What this module is NOT, stated plainly:
//   - It is not a purchase. Tracking an item never creates an
//     expense, a purchase, or a stock movement by itself, and
//     never changes any bill, payment, expense, or stock record.
//   - It is not the asset register. shop-asset.js (Plan 190:
//     purchase detail and insurance cover) is neither read nor
//     written here; this adds only the ageing and reserve-note
//     piece.
//   - It is not the equipment cycle. equipment-cycle.js (Plan
//     143: calibration and replacement-cycle checks) is neither
//     read nor written here; this tracker follows the owner's
//     entered expected life, not a check cycle.
//   - It is not an edit history. There is no edit function at
//     all: an item is recorded or removed — never silently
//     rewritten — so past entries stay exactly as the operator
//     first wrote them.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment, expense,
//     stock, purchase, or sending field can ever creep into an
//     ageing item.
//   - Duplicate ids are never rewritten.
//   - The replacement date is pure civil-date arithmetic:
//     purchase date plus the entered expected life in whole
//     years, with 29 February clamped to 28 February in a
//     non-leap year (the Plan 177 pattern).
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

// Expected life, in whole years, exactly as the owner entered it.
// Missing is allowed (the item is then tracked with no due date);
// a present value must be a positive whole number of years.
function normalizeExpectedLife(value) {
  if (value === undefined || value === null || value === '') return null;
  const years = typeof value === 'number' ? value : Number(text(value));
  if (!Number.isFinite(years) || !Number.isInteger(years) || years <= 0) return null;
  return years;
}

function normalizeAgeingItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const item = text(raw.item);
  const purchaseDate = normalizeDate(raw.purchaseDate);
  if (!id || !item || !purchaseDate) return null;
  const rawLife = raw.expectedLifeYears;
  const lifePresent = !(rawLife === undefined || rawLife === null || (typeof rawLife === 'string' && rawLife.trim() === ''));
  const expectedLifeYears = normalizeExpectedLife(rawLife);
  if (lifePresent && expectedLifeYears === null) return null;
  return {
    id,
    item,
    purchaseDate,
    expectedLifeYears,
    conditionNote: text(raw.conditionNote),
    reserveNote: text(raw.reserveNote),
  };
}

function normalizeAgeingList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const clean = normalizeAgeingItem(entry);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

function findAgeingItem(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeAgeingList(list).find((entry) => entry.id === wanted) || null;
}

function recordAgeingItem(list, raw) {
  const items = normalizeAgeingList(list);
  const item = normalizeAgeingItem(raw);
  if (!item) return items;
  if (items.some((entry) => entry.id === item.id)) return items;
  return [...items, item];
}

function removeAgeingItem(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeAgeingList(list);
  return normalizeAgeingList(list).filter((entry) => entry.id !== wanted);
}

// Purchase date plus whole years, with 29 February clamped to
// 28 February when the target year is not a leap year. Null when
// the item carries no entered expected life.
function replacementDueDate(item) {
  const clean = normalizeAgeingItem(item);
  if (!clean || clean.expectedLifeYears === null) return null;
  const year = Number(clean.purchaseDate.slice(0, 4)) + clean.expectedLifeYears;
  const month = clean.purchaseDate.slice(5, 7);
  let day = Number(clean.purchaseDate.slice(8, 10));
  if (month === '02' && day === 29 && !isLeapYear(year)) day = 28;
  return `${String(year).padStart(4, '0')}-${month}-${String(day).padStart(2, '0')}`;
}

// Past expected life means the replacement date is strictly
// before today; due today is not past, and an item with no due
// date is never flagged.
function isPastExpectedLife(item, today) {
  const due = replacementDueDate(item);
  const day = normalizeDate(today);
  if (!due || !day) return false;
  return due < day;
}

function ageingSorted(list) {
  return normalizeAgeingList(list).sort((a, b) => {
    const dueA = replacementDueDate(a);
    const dueB = replacementDueDate(b);
    if (dueA && dueB && dueA !== dueB) return dueA < dueB ? -1 : 1;
    if (dueA && !dueB) return -1;
    if (!dueA && dueB) return 1;
    if (a.purchaseDate !== b.purchaseDate) return a.purchaseDate < b.purchaseDate ? -1 : 1;
    const nameA = a.item.toLowerCase();
    const nameB = b.item.toLowerCase();
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function pastLifeItems(list, today) {
  return ageingSorted(list).filter((item) => isPastExpectedLife(item, today));
}

function ageingForItem(list, query) {
  const wanted = text(query).toLowerCase();
  if (!wanted) return ageingSorted(list);
  return ageingSorted(list).filter((entry) => entry.item.toLowerCase().includes(wanted));
}

function ageingSummaryText(list, today) {
  const items = normalizeAgeingList(list);
  if (items.length === 0) return 'No equipment items recorded.';
  const past = pastLifeItems(list, today).length;
  if (past === 0) return `${items.length} equipment items recorded, none past expected life.`;
  return `${items.length} equipment items recorded, ${past} past expected life.`;
}

function ageingText(item, today) {
  const clean = normalizeAgeingItem(item);
  if (!clean) return '';
  const due = replacementDueDate(clean);
  const lines = [`${clean.item} — bought ${clean.purchaseDate}`];
  lines.push(due ? `Replacement due: ${due}` : 'Replacement due: no expected life entered.');
  if (isPastExpectedLife(clean, today)) lines.push('PAST EXPECTED LIFE — plan replacement.');
  if (clean.expectedLifeYears !== null) lines.push(`Expected life: ${clean.expectedLifeYears} years`);
  if (clean.conditionNote) lines.push(`Condition: ${clean.conditionNote}`);
  if (clean.reserveNote) lines.push(`Reserve note: ${clean.reserveNote}`);
  return lines.join('\n');
}

function ageingHtml(item, today) {
  const clean = normalizeAgeingItem(item);
  if (!clean) return '';
  const due = replacementDueDate(clean);
  const flag = isPastExpectedLife(clean, today)
    ? '<br><strong>PAST EXPECTED LIFE — plan replacement.</strong>'
    : '';
  const dueText = due ? `Replacement due: ${escapeHtml(due)}` : 'Replacement due: no expected life entered.';
  const condition = clean.conditionNote ? `<br>Condition: ${escapeHtml(clean.conditionNote)}` : '';
  const reserve = clean.reserveNote ? `<br>Reserve note: ${escapeHtml(clean.reserveNote)}` : '';
  return `<p>${escapeHtml(clean.item)} — bought ${escapeHtml(clean.purchaseDate)}<br>${dueText}${flag}${condition}${reserve}</p>`;
}

function ageingAllHtml(list, today) {
  return ageingSorted(list).map((item) => ageingHtml(item, today)).join('');
}

function equipmentAgeingCsv(list, today) {
  const rows = [['id', 'item', 'purchaseDate', 'expectedLifeYears', 'replacementDue', 'pastExpectedLife', 'conditionNote', 'reserveNote']];
  for (const item of ageingSorted(list)) {
    rows.push([
      item.id,
      item.item,
      item.purchaseDate,
      item.expectedLifeYears === null ? '' : item.expectedLifeYears,
      replacementDueDate(item) || '',
      isPastExpectedLife(item, today) ? 'yes' : 'no',
      item.conditionNote,
      item.reserveNote,
    ]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function equipmentAgeingFilename() {
  return 'equipment-ageing.csv';
}

export {
  normalizeDate,
  normalizeExpectedLife,
  normalizeAgeingItem,
  normalizeAgeingList,
  findAgeingItem,
  recordAgeingItem,
  removeAgeingItem,
  replacementDueDate,
  isPastExpectedLife,
  ageingSorted,
  pastLifeItems,
  ageingForItem,
  ageingSummaryText,
  ageingText,
  ageingHtml,
  ageingAllHtml,
  equipmentAgeingCsv,
  equipmentAgeingFilename,
};
