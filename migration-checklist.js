// Plan 181 (Plan 101-202) — Second-OLT migration checklist and
// port-move log.
//
// When a second OLT is added, moving customers between OLTs without
// a written checklist risks missed ports, duplicate assignments, and
// no record of who moved when. This module adds only the migration
// piece: an ordered checklist (step, done/not-done, date, done-by)
// plus a port-move log (customer, old OLT/port, new OLT/port, date,
// reason). It is a written trail, not a live router feed.
//
// Scope fence, stated plainly:
//   - The existing OLT/ONU register (connection-register.js, wired
//     in app.js as loadOltOnuRegister) and the capacity forecast
//     (capacity-forecast.js) are neither read nor written here.
//     This module stores only its own checklist steps and port
//     moves, supplied by the caller; it never touches a bill,
//     payment, package, customer, or connection record, and it
//     never changes any status.
//   - It is import-free (like comms-timeline.js): the caller
//     supplies every record, and the module never reads storage,
//     the clock, or the network, and never mutates an input.
//   - A move is logged once: a second move with the same customer,
//     date, old OLT/port, and new OLT/port is refused, and a move
//     from an OLT/port to itself is not a move at all.
//   - Nothing here sends anything automatically, and nothing here
//     talks to a live router.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1];
}

function parseStrictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isStrictDate(value) {
  return parseStrictDate(value) !== null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function orderValue(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    if (Number.isInteger(n) && n >= 1) return n;
  }
  return null;
}

// ---------------------------------------------------------------- steps

// Normalize one checklist step. Returns null when half-formed: no
// id, no step text, or no valid order (a positive whole number).
// A done step with a bad done date keeps its done flag but no done
// date, so a bad date can never be mistaken for a real one. Unknown
// fields are dropped.
export function normalizeMigrationStep(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id);
  const step = text(value.step);
  const order = orderValue(value.order);
  if (!id || !step || order === null) return null;
  const done = value.done === true;
  const doneDate = done && isStrictDate(text(value.doneDate)) ? text(value.doneDate) : '';
  const doneBy = text(value.doneBy);
  return { id, step, order, done, doneDate, doneBy };
}

export function normalizeMigrationStepList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const step = normalizeMigrationStep(item);
    if (step) out.push(step);
  }
  return out;
}

export function findMigrationStep(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  for (const step of normalizeMigrationStepList(list)) {
    if (step.id === wanted) return step;
  }
  return null;
}

// Steps in checklist order, then id A-Z. Duplicate ids are never
// rewritten: an identical re-save leaves the list unchanged, and a
// different step under the same id is refused.
export function upsertMigrationStep(list, value) {
  const clean = normalizeMigrationStepList(list);
  const step = normalizeMigrationStep(value);
  if (!step) return clean;
  const existing = clean.find((item) => item.id === step.id);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(step)) return clean;
    return clean;
  }
  return [...clean, step];
}

export function removeMigrationStep(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeMigrationStepList(list);
  return normalizeMigrationStepList(list).filter((item) => item.id !== wanted);
}

// Marking done records only the completion date; an invalid date
// leaves the record unchanged. Marking not done clears both the
// flag and the date.
export function markMigrationStepDone(list, id, date, doneBy) {
  const clean = normalizeMigrationStepList(list);
  if (!isStrictDate(text(date))) return clean;
  return clean.map((item) => {
    if (item.id !== text(id)) return item;
    return { ...item, done: true, doneDate: text(date), doneBy: text(doneBy) };
  });
}

export function markMigrationStepUndone(list, id) {
  const clean = normalizeMigrationStepList(list);
  return clean.map((item) => {
    if (item.id !== text(id)) return item;
    return { ...item, done: false, doneDate: '', doneBy: '' };
  });
}

export function migrationStepsSorted(list) {
  return normalizeMigrationStepList(list).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function migrationStepsDone(list) {
  return migrationStepsSorted(list).filter((item) => item.done);
}

export function migrationStepsOpen(list) {
  return migrationStepsSorted(list).filter((item) => !item.done);
}

export function migrationStepSummaryText(list) {
  const clean = normalizeMigrationStepList(list);
  const done = clean.filter((item) => item.done).length;
  return `${done}/${clean.length} migration steps done`;
}

export function migrationStepText(step) {
  const clean = normalizeMigrationStep(step);
  if (!clean) return '';
  const status = clean.done
    ? `Done${clean.doneDate ? ` on ${clean.doneDate}` : ''}${clean.doneBy ? ` by ${clean.doneBy}` : ''}`
    : 'Not done';
  return `Step ${clean.order}: ${clean.step} — ${status}`;
}

export function migrationStepHtml(step) {
  const clean = normalizeMigrationStep(step);
  if (!clean) return '';
  return `<p>${escapeHtml(migrationStepText(clean))}</p>`;
}

export function migrationStepAllHtml(list) {
  const rows = migrationStepsSorted(list);
  if (!rows.length) return '';
  return rows.map((item) => migrationStepHtml(item)).join('');
}

export function migrationStepCsv(list) {
  const header = ['id', 'order', 'step', 'done', 'doneDate', 'doneBy'].map(csvCell).join(',');
  const rows = migrationStepsSorted(list).map((item) => [
    item.id, item.order, item.step, item.done ? 'yes' : 'no', item.doneDate, item.doneBy,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function migrationStepFilename() {
  return 'migration-checklist.csv';
}

// A sensible starter checklist for a second-OLT move, with fixed
// ids, so recording it twice changes nothing.
export function migrationStepStarters() {
  return [
    { id: 'MIG-1', step: 'Confirm the second unit capacity and port plan', order: 1, done: false, doneDate: '', doneBy: '' },
    { id: 'MIG-2', step: 'Record the old unit and port for each moving customer', order: 2, done: false, doneDate: '', doneBy: '' },
    { id: 'MIG-3', step: 'Move one customer and verify the service works', order: 3, done: false, doneDate: '', doneBy: '' },
    { id: 'MIG-4', step: 'Move the remaining customers in batches', order: 4, done: false, doneDate: '', doneBy: '' },
    { id: 'MIG-5', step: 'Verify no customer is on two units at once', order: 5, done: false, doneDate: '', doneBy: '' },
    { id: 'MIG-6', step: 'Close the migration and file the port-move log', order: 6, done: false, doneDate: '', doneBy: '' },
  ];
}

// ---------------------------------------------------------------- moves

// Normalize one port move. Returns null when half-formed: no id, no
// customer, no old unit, no old port, no new unit, no new port, no
// strict date, or no reason; or when the move is from a unit/port
// to itself. Unknown fields are dropped.
export function normalizePortMove(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id);
  const customerId = text(value.customerId);
  const oldUnit = text(value.oldUnit);
  const oldPort = text(value.oldPort);
  const newUnit = text(value.newUnit);
  const newPort = text(value.newPort);
  const date = text(value.date);
  const reason = text(value.reason);
  if (!id || !customerId || !oldUnit || !oldPort || !newUnit || !newPort || !isStrictDate(date) || !reason) return null;
  if (lower(oldUnit) === lower(newUnit) && lower(oldPort) === lower(newPort)) return null;
  return { id, customerId, oldUnit, oldPort, newUnit, newPort, date, reason };
}

export function normalizePortMoveList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const move = normalizePortMove(item);
    if (move) out.push(move);
  }
  return out;
}

export function findPortMove(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  for (const move of normalizePortMoveList(list)) {
    if (move.id === wanted) return move;
  }
  return null;
}

function sameMove(a, b) {
  return lower(a.customerId) === lower(b.customerId)
    && a.date === b.date
    && lower(a.oldUnit) === lower(b.oldUnit)
    && lower(a.oldPort) === lower(b.oldPort)
    && lower(a.newUnit) === lower(b.newUnit)
    && lower(a.newPort) === lower(b.newPort);
}

// Every move is logged once: an identical re-save leaves the list
// unchanged, a different move under the same id is refused, and a
// second move with the same customer, date, and old/new unit/port
// under a different id is refused too.
export function upsertPortMove(list, value) {
  const clean = normalizePortMoveList(list);
  const move = normalizePortMove(value);
  if (!move) return clean;
  const existing = clean.find((item) => item.id === move.id);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(move)) return clean;
    return clean;
  }
  if (clean.some((item) => sameMove(item, move))) return clean;
  return [...clean, move];
}

export function removePortMove(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizePortMoveList(list);
  return normalizePortMoveList(list).filter((item) => item.id !== wanted);
}

// Newest first, then customer A-Z.
export function portMovesSorted(list) {
  return normalizePortMoveList(list).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const ca = lower(a.customerId);
    const cb = lower(b.customerId);
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });
}

export function portMovesForCustomer(list, customerId) {
  const wanted = lower(customerId);
  if (!wanted) return [];
  return portMovesSorted(list).filter((item) => lower(item.customerId) === wanted);
}

export function portMovesOnDate(list, date) {
  const wanted = text(date);
  if (!wanted) return [];
  return portMovesSorted(list).filter((item) => item.date === wanted);
}

export function portMoveCustomers(list) {
  const seen = new Map();
  for (const move of normalizePortMoveList(list)) {
    const key = lower(move.customerId);
    if (!seen.has(key)) seen.set(key, move.customerId);
  }
  return [...seen.values()].sort((a, b) => {
    const x = lower(a);
    const y = lower(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

export function portMoveSummaryText(list) {
  const clean = normalizePortMoveList(list);
  return `${clean.length} port move${clean.length === 1 ? '' : 's'} logged`;
}

export function portMoveText(move) {
  const clean = normalizePortMove(move);
  if (!clean) return '';
  return `${clean.customerId}: ${clean.oldUnit}/${clean.oldPort} → ${clean.newUnit}/${clean.newPort} on ${clean.date} — ${clean.reason}`;
}

export function portMoveHtml(move) {
  const clean = normalizePortMove(move);
  if (!clean) return '';
  return `<p>${escapeHtml(portMoveText(clean))}</p>`;
}

export function portMoveAllHtml(list) {
  const rows = portMovesSorted(list);
  if (!rows.length) return '';
  return rows.map((item) => portMoveHtml(item)).join('');
}

export function portMoveCsv(list) {
  const header = ['id', 'customerId', 'oldUnit', 'oldPort', 'newUnit', 'newPort', 'date', 'reason'].map(csvCell).join(',');
  const rows = portMovesSorted(list).map((item) => [
    item.id, item.customerId, item.oldUnit, item.oldPort, item.newUnit, item.newPort, item.date, item.reason,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function portMoveFilename() {
  return 'port-moves.csv';
}
