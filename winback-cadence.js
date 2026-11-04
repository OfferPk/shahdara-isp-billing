// Plan 171 (Plan 101-202) — Winback Follow-Up Cadence Beyond Plan 59.
//
// Plan 59 provides a winback queue, but it does not say when to
// follow up again, so a lost customer is contacted once and then
// forgotten, or contacted too often and annoyed. This module adds
// only the cadence that sits on top of that queue: a first
// follow-up, a second follow-up after a longer gap, and a final
// closing note, each as a draft the operator sends by hand, with
// the gap between steps stored as a simple day count the owner
// can set once.
//
// What this module is NOT, stated plainly:
//   - It is not the Plan 59 queue. It neither reads nor writes the
//     queue's records: the caller supplies the queued customer id,
//     and this module only tracks that customer's cadence steps.
//     Rebuilding the queue, reordering it, or changing an entry
//     in it is out of scope.
//   - It never changes any bill, payment, package, or customer
//     status. Completing a step moves only the step marker;
//     marking a customer as returned or as do-not-contact only
//     removes them from the cadence.
//   - It never sends anything by itself. The step drafts are
//     plain-words texts the operator sends by hand; marking a
//     step complete only records that the operator did so.
//   - It promises nothing: no offer, discount, or credit appears
//     in any draft, and no draft claims a service improvement.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, the gap settings, and today's date, and the module
//     never reads storage, the clock, or the network, and never
//     mutates an input.
//   - A cadence record with no id, no customer, or no real start
//     date is refused outright. Unknown fields are dropped, so a
//     record can never grow a bill, payment, package, status, or
//     sending field.
//   - One cadence record per customer (case-insensitive): a
//     second record for the same customer with a different id is
//     refused outright. To start a customer again, the operator
//     removes the old record first.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures also leaves the list unchanged.
//   - Dates are strict calendar dates: 2026-02-30, 2026-04-31,
//     and any other impossible date are refused, never guessed.

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

// Pure civil-date arithmetic (no Date object, no clock): days counted
// from 1970-01-01, converted back with integer math only.
function daysFromCivil(year, month, day) {
  const yy = month <= 2 ? year - 1 : year;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = month > 2 ? month - 3 : month + 9;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z) {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [m <= 2 ? y + 1 : y, m, d];
}

function addDays(dateStr, days) {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  const day = Number(dateStr.slice(8, 10));
  const [y, m, d] = civilFromDays(daysFromCivil(year, month, day) + days);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const WINBACK_CADENCE_STEPS = [
  {
    step: 1,
    label: 'First follow-up',
    draft: 'First follow-up: a short check-in — we miss you as a customer, and we would like to hear what made you leave.',
  },
  {
    step: 2,
    label: 'Second follow-up',
    draft: 'Second follow-up: a gentle reminder — if anything has changed on your side, we are here and ready to help.',
  },
  {
    step: 3,
    label: 'Closing note',
    draft: 'Closing note: a final polite note — the door stays open, and you are welcome back whenever you are ready. No further follow-ups after this one.',
  },
];

export function winbackCadenceStepLabel(step) {
  const found = WINBACK_CADENCE_STEPS.find((item) => item.step === step);
  return found ? found.label : '';
}

export function winbackCadenceDraftText(step) {
  const found = WINBACK_CADENCE_STEPS.find((item) => item.step === step);
  return found ? found.draft : '';
}

export const DEFAULT_CADENCE_SETTINGS = { firstGapDays: 7, secondGapDays: 14 };

function cleanGapDays(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const days = Math.floor(number);
  return days >= 1 ? days : fallback;
}

export function normalizeCadenceSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    firstGapDays: cleanGapDays(input.firstGapDays, DEFAULT_CADENCE_SETTINGS.firstGapDays),
    secondGapDays: cleanGapDays(input.secondGapDays, DEFAULT_CADENCE_SETTINGS.secondGapDays),
  };
}

const CADENCE_STATUSES = ['active', 'completed', 'returned', 'do-not-contact'];

export function normalizeWinbackCadence(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const customerId = cleanText(value.customerId);
  const startDate = cleanText(value.startDate);
  if (!id || !customerId || !isStrictDate(startDate)) return null;
  const step = Number(value.step);
  const status = CADENCE_STATUSES.includes(value.status) ? value.status : 'active';
  const lastStepDate = cleanText(value.lastStepDate);
  return {
    id,
    customerId,
    step: step === 2 || step === 3 ? step : 1,
    startDate,
    lastStepDate: isStrictDate(lastStepDate) ? lastStepDate : '',
    status,
  };
}

export function normalizeWinbackCadenceList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const record = normalizeWinbackCadence(item);
    if (record) out.push(record);
  }
  return out;
}

export function findWinbackCadence(list, id) {
  const records = normalizeWinbackCadenceList(list);
  const key = cleanText(id);
  return records.find((record) => record.id === key) ?? null;
}

export function startWinbackCadence(list, record) {
  const records = normalizeWinbackCadenceList(list);
  const next = normalizeWinbackCadence(record);
  if (!next) return records;
  if (records.some((item) => item.id === next.id)) return records;
  if (records.some((item) => cleanKey(item.customerId) === cleanKey(next.customerId))) return records;
  return [...records, { ...next, step: 1, status: 'active', lastStepDate: '' }];
}

export function removeWinbackCadence(list, id) {
  const records = normalizeWinbackCadenceList(list);
  const key = cleanText(id);
  return records.filter((record) => record.id !== key);
}

export function completeWinbackStep(list, id, completedDate) {
  if (!isStrictDate(completedDate)) return normalizeWinbackCadenceList(list);
  const records = normalizeWinbackCadenceList(list);
  const key = cleanText(id);
  return records.map((record) => {
    if (record.id !== key || record.status !== 'active') return record;
    if (record.step === 1) return { ...record, step: 2, lastStepDate: completedDate };
    if (record.step === 2) return { ...record, step: 3, lastStepDate: completedDate };
    return { ...record, status: 'completed', lastStepDate: completedDate };
  });
}

export function markWinbackCadenceReturned(list, id) {
  const records = normalizeWinbackCadenceList(list);
  const key = cleanText(id);
  return records.map((record) => (record.id === key ? { ...record, status: 'returned' } : record));
}

export function markWinbackCadenceDoNotContact(list, id) {
  const records = normalizeWinbackCadenceList(list);
  const key = cleanText(id);
  return records.map((record) => (record.id === key ? { ...record, status: 'do-not-contact' } : record));
}

export function winbackCadenceDueDate(record, settings) {
  const item = normalizeWinbackCadence(record);
  if (!item || item.status !== 'active') return null;
  const gaps = normalizeCadenceSettings(settings);
  if (item.step === 1) return item.startDate;
  if (item.step === 2) return item.lastStepDate ? addDays(item.lastStepDate, gaps.firstGapDays) : item.startDate;
  return item.lastStepDate ? addDays(item.lastStepDate, gaps.secondGapDays) : item.startDate;
}

export function winbackCadenceNext(list, customerId, settings, today) {
  const records = normalizeWinbackCadenceList(list);
  const key = cleanKey(customerId);
  const record = records.find((item) => cleanKey(item.customerId) === key && item.status === 'active');
  if (!record) return null;
  const dueDate = winbackCadenceDueDate(record, settings);
  return {
    record,
    step: record.step,
    stepLabel: winbackCadenceStepLabel(record.step),
    draftText: winbackCadenceDraftText(record.step),
    dueDate,
    overdue: isStrictDate(today) && dueDate !== null && dueDate < today,
  };
}

function compareCadence(a, b, settings) {
  const dueA = winbackCadenceDueDate(a, settings);
  const dueB = winbackCadenceDueDate(b, settings);
  if (dueA && dueB && dueA !== dueB) return dueA < dueB ? -1 : 1;
  if (dueA && !dueB) return -1;
  if (!dueA && dueB) return 1;
  return cleanKey(a.customerId) < cleanKey(b.customerId) ? -1 : 1;
}

export function winbackCadenceActive(list, settings) {
  const records = normalizeWinbackCadenceList(list).filter((record) => record.status === 'active');
  return [...records].sort((a, b) => compareCadence(a, b, settings));
}

export function winbackCadenceOverdue(list, settings, today) {
  if (!isStrictDate(today)) return [];
  return winbackCadenceActive(list, settings).filter((record) => {
    const due = winbackCadenceDueDate(record, settings);
    return due !== null && due < today;
  });
}

export function winbackCadenceCustomers(list) {
  const seen = new Map();
  for (const record of normalizeWinbackCadenceList(list)) {
    const key = cleanKey(record.customerId);
    if (!seen.has(key)) seen.set(key, record.customerId);
  }
  return [...seen.values()].sort((a, b) => (cleanKey(a) < cleanKey(b) ? -1 : 1));
}

export function winbackCadenceSummaryText(list) {
  const records = normalizeWinbackCadenceList(list);
  const active = records.filter((record) => record.status === 'active').length;
  const completed = records.filter((record) => record.status === 'completed').length;
  const returned = records.filter((record) => record.status === 'returned').length;
  const doNot = records.filter((record) => record.status === 'do-not-contact').length;
  return `${active} in cadence, ${completed} finished, ${returned} returned, ${doNot} do-not-contact`;
}

export function winbackCadenceAllHtml(list, settings, today) {
  const active = winbackCadenceActive(list, settings);
  if (active.length === 0) return '<p>No customers in the winback cadence.</p>';
  return active.map((record) => {
    const due = winbackCadenceDueDate(record, settings);
    const overdue = isStrictDate(today) && due !== null && due < today;
    return `<p><strong>${escapeHtml(record.customerId)}</strong> · ${escapeHtml(winbackCadenceStepLabel(record.step))} · due ${escapeHtml(due ?? '')}${overdue ? ' · overdue' : ''} <small>(${escapeHtml(record.id)})</small></p>`;
  }).join('');
}

export function winbackCadenceCsv(list, settings) {
  const rows = [['id', 'customer', 'next step', 'due date', 'status']];
  for (const record of normalizeWinbackCadenceList(list)) {
    rows.push([
      record.id,
      record.customerId,
      record.status === 'active' ? winbackCadenceStepLabel(record.step) : record.status,
      winbackCadenceDueDate(record, settings) ?? '',
      record.status,
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function winbackCadenceFilename() {
  return 'shahdara_winback_cadence.csv';
}
