/**
 * saad-visits.js — Saad visit log (per-visit job record, NOT daily attendance).
 *
 * Vision (owner's words): Saad does NOT come to work every day — he comes
 * only when needed, mainly to do splicing. Every time he comes, the
 * operator records: whose work he did (customer), which area's fiber he
 * fixed, or which new connection he installed — plus HOW LONG he worked.
 *
 * This is deliberately NOT the phase3 payroll attendance list
 * (state.saadAttendanceDays, informational dates only). Nothing here
 * touches any pay computation: SAAD_BASE_MONTHLY_SALARY and the
 * per-eligible-customer rate in phase3.js are untouched. Payments recorded
 * here are a record of what was ACTUALLY PAID (manual entries), never a
 * computed salary.
 *
 * Storage: visits live in localStorage under SAAD_VISITS_KEY
 * (sisp_saad_visits_v1) and payments under SAAD_PAYMENTS_KEY
 * (sisp_saad_payments_v1), each a flat array. One record per visit:
 * date (Pakistan date), visit type, customer (picked from the real
 * customer list — never a typed free-text name alone), area/mohalla
 * (defaults from the picked customer, editable override for area-level
 * fiber work with no single customer), fiber meters used (recorded only
 * — NEVER auto-deducted from stock, SISP-18 inventory code untouched),
 * start/end time and/or hours worked (first-class fields, never a
 * free-text note), optional link to a SISP-12 field ticket (TKT id, only
 * when that ticket exists), optional note.
 *
 * Monthly figures are always COMPUTED from the stored visits, never typed
 * in: distinct days present (a day counts once even with 2 visits),
 * total hours (sum of visit durations), per-day breakdown (date -> where
 * he worked + hours that day), and payment totals split Salary /
 * Commission. Attendance entry is fully MANUAL: the operator opens the
 * log, picks the date, and the month view aggregates what was entered.
 * No auto check-in, no GPS, no automatic detection.
 *
 * SISP-56: the recorded payments are also the source of truth for two
 * convergent mirrors (syncSaadPaymentLedgers below), following the
 * SISP-45 roznamcha pattern: every payment lands as exactly ONE row in
 * the main Expenses ledger (category 'Salary — Saad', deduplicated by
 * saadPaymentId), so monthly P&L (dashboard-pnl.js) and the Nasir/Aqib
 * 50% partner shares deduct what Saad was actually paid — never a
 * computed salary, and never twice. A payment flagged paidFromDrawer
 * additionally lands as exactly ONE roznamcha outflow (deterministic
 * id `saad-<payment id>`, petty-cash category 'Lineman Allowance',
 * lineman 'Saad'); syncRoznamchaExpenses skips those outflows because
 * their expense mirror lives here. The mirror never mutates a CLOSED
 * roznamcha day (frozen snapshots are history): a drawer payout whose
 * day is already closed still mirrors into Expenses and is reported as
 * drawerSkippedClosed so the caller can surface it.
 *
 * Backup: visits + payments travel in the JSON backup `settings.saadVisits`
 * and `settings.saadPayments` sections (see core.js), under the same
 * safe-merge rule as the SISP-15 complaint register and SISP-18 stock
 * book: adopted only when this device has none stored yet.
 *
 * This module imports nothing: customers and ticket ids are passed in by
 * callers, so the pure helpers stay testable without the app. Tests use
 * synthetic data only.
 */

export const SAAD_VISITS_KEY = 'sisp_saad_visits_v1';
export const SAAD_PAYMENTS_KEY = 'sisp_saad_payments_v1';

/** Visit types: id + display label. */
export const VISIT_TYPES = [
  { id: 'splicing', label: 'Splicing' },
  { id: 'fiber-fix', label: 'Fiber fix' },
  { id: 'install', label: 'New connection install' },
  { id: 'other', label: 'Other work' }
];

export const VISIT_TYPE_IDS = VISIT_TYPES.map((t) => t.id);

/** Payment types: id + display label. */
export const PAYMENT_TYPES = [
  { id: 'salary', label: 'Salary' },
  { id: 'commission', label: 'Commission' }
];

export const PAYMENT_TYPE_IDS = PAYMENT_TYPES.map((t) => t.id);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const VISIT_ID_RE = /^SV-(\d+)$/;
const PAYMENT_ID_RE = /^SP-(\d+)$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** YYYY-MM-DD in Pakistan time (mirrors roznamcha.js pakistanToday). */
export function pakistanDateToday(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** YYYY-MM month of a YYYY-MM-DD date. */
export function monthOf(date) {
  return DATE_RE.test(String(date || '')) ? String(date).slice(0, 7) : '';
}

/** Minutes between two HH:MM times on the same day, or null when unusable. */
export function minutesBetween(startTime, endTime) {
  if (!TIME_RE.test(String(startTime || '')) || !TIME_RE.test(String(endTime || ''))) return null;
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return toMin(endTime) - toMin(startTime);
}

/** Duration in hours (2dp) from start/end times, or null when not computable. */
export function hoursFromTimes(startTime, endTime) {
  const mins = minutesBetween(startTime, endTime);
  if (mins === null || mins <= 0) return null;
  return Math.round((mins / 60) * 100) / 100;
}

/** Display hours without trailing zeros: 7, 3.5, 7.25. */
export function formatHours(hours) {
  const n = Math.round(Number(hours || 0) * 100) / 100;
  if (!Number.isFinite(n)) return '0';
  return String(n);
}

export function visitTypeLabel(typeId) {
  return VISIT_TYPES.find((t) => t.id === typeId)?.label || typeId || '—';
}

export function paymentTypeLabel(typeId) {
  return PAYMENT_TYPES.find((t) => t.id === typeId)?.label || typeId || '—';
}

/** Where Saad worked on this visit: customer name (+ number) or area. */
export function visitWhereLabel(visit) {
  if (!visit) return '—';
  if (visit.customerName) {
    return visit.customerNumber !== null && visit.customerNumber !== undefined && visit.customerNumber !== ''
      ? `${visit.customerName} (#${visit.customerNumber})`
      : visit.customerName;
  }
  return visit.area || '—';
}

/** Drops malformed rows; keeps clean visits in stored order. */
export function sanitizeSaadVisits(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const date = DATE_RE.test(String(entry.date || '')) ? String(entry.date) : '';
    if (!date) continue;
    const type = VISIT_TYPE_IDS.includes(entry.type) ? entry.type : null;
    if (!type) continue;
    const startTime = TIME_RE.test(String(entry.startTime || '')) ? String(entry.startTime) : '';
    const endTime = TIME_RE.test(String(entry.endTime || '')) ? String(entry.endTime) : '';
    let hoursWorked = null;
    if (entry.hoursWorked !== null && entry.hoursWorked !== undefined && entry.hoursWorked !== '') {
      const n = Number(entry.hoursWorked);
      if (Number.isFinite(n) && n >= 0) hoursWorked = Math.round(n * 100) / 100;
    }
    if (hoursWorked === null) hoursWorked = hoursFromTimes(startTime, endTime);
    let fiberMeters = null;
    if (entry.fiberMeters !== null && entry.fiberMeters !== undefined && entry.fiberMeters !== '') {
      const n = Number(entry.fiberMeters);
      if (Number.isFinite(n) && n > 0) fiberMeters = Math.round(n * 100) / 100;
    }
    out.push({
      id: cleanText(entry.id),
      date,
      type,
      customerId: cleanText(entry.customerId),
      customerName: cleanText(entry.customerName),
      customerNumber: entry.customerNumber === null || entry.customerNumber === undefined || entry.customerNumber === ''
        ? null
        : entry.customerNumber,
      area: cleanText(entry.area),
      fiberMeters,
      startTime,
      endTime,
      hoursWorked,
      ticketId: cleanText(entry.ticketId),
      note: cleanText(entry.note),
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Drops malformed rows; keeps clean payments in stored order. */
export function sanitizeSaadPayments(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const date = DATE_RE.test(String(entry.date || '')) ? String(entry.date) : '';
    if (!date) continue;
    const type = PAYMENT_TYPE_IDS.includes(entry.type) ? entry.type : null;
    if (!type) continue;
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    out.push({
      id: cleanText(entry.id),
      date,
      type,
      amount: Math.round(amount * 100) / 100,
      note: cleanText(entry.note),
      paidFromDrawer: entry.paidFromDrawer === true,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Reads visit records; [] on missing/corrupt storage. */
export function loadSaadVisits(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(SAAD_VISITS_KEY);
    if (!raw) return [];
    return sanitizeSaadVisits(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists visit records; never throws. */
export function saveSaadVisits(visits, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(SAAD_VISITS_KEY, JSON.stringify(sanitizeSaadVisits(visits)));
    return true;
  } catch {
    return false;
  }
}

/** Reads payment records; [] on missing/corrupt storage. */
export function loadSaadPayments(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(SAAD_PAYMENTS_KEY);
    if (!raw) return [];
    return sanitizeSaadPayments(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists payment records; never throws. */
export function saveSaadPayments(payments, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(SAAD_PAYMENTS_KEY, JSON.stringify(sanitizeSaadPayments(payments)));
    return true;
  } catch {
    return false;
  }
}

function nextVisitId(visits) {
  let max = 0;
  for (const v of visits) {
    const match = VISIT_ID_RE.exec(String(v.id || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `SV-${max + 1}`;
}

function nextPaymentId(payments) {
  let max = 0;
  for (const p of payments) {
    const match = PAYMENT_ID_RE.exec(String(p.id || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `SP-${max + 1}`;
}

/**
 * Hours for one visit: stored hours, else duration from start/end times,
 * else 0 (unknown hours never inflate a monthly total).
 */
export function visitHours(visit) {
  if (!visit) return 0;
  if (visit.hoursWorked !== null && visit.hoursWorked !== undefined && Number.isFinite(Number(visit.hoursWorked))) {
    return Math.round(Number(visit.hoursWorked) * 100) / 100;
  }
  return hoursFromTimes(visit.startTime, visit.endTime) || 0;
}

/**
 * Validates one visit's form input and returns the stored fields (no id,
 * no createdAt). Shared by create and edit so both enforce the SAME
 * rules and messages. Hours rule: start + end times together win
 * (duration); otherwise the entered hours number is used; at least one
 * of the two is required, and a lone start or end time without its pair
 * is rejected. A visit must identify the work: a real customer, an
 * area, or both — never neither. When `existing` is given (edit) and
 * its customer id is unchanged but that customer left the list, the
 * stored name/number snapshot is kept instead of throwing — the entry
 * stays readable; changing to a different id still requires a live
 * customer from the list. Fiber meters are recorded only: this never
 * touches stock.
 */
export function buildVisitFields(input, { customers = [], ticketIds = [], existing = null } = {}) {
  const date = DATE_RE.test(String(input.date || '')) ? String(input.date) : '';
  if (!date) throw new Error('A valid visit date is required.');
  const type = VISIT_TYPE_IDS.includes(input.type) ? input.type : null;
  if (!type) throw new Error('A valid work type is required.');
  const customerId = cleanText(input.customerId);
  let customerName = '';
  let customerNumber = null;
  let area = cleanText(input.area);
  if (customerId) {
    const customer = customers.find((c) => String(c.id) === customerId);
    if (customer) {
      customerName = cleanText(customer.name);
      customerNumber = customer.customerNumber === null || customer.customerNumber === undefined
        ? null
        : customer.customerNumber;
      if (!area) area = cleanText(customer.mohalla) || cleanText(customer.zone);
    } else if (existing && String(existing.customerId) === customerId) {
      customerName = cleanText(existing.customerName);
      customerNumber = existing.customerNumber === null || existing.customerNumber === undefined
        ? null
        : existing.customerNumber;
      if (!area) area = cleanText(existing.area);
    } else {
      throw new Error('Pick a customer from the list — free-text names are not accepted.');
    }
  }
  if (!customerId && !area) {
    throw new Error('Pick a customer or enter the area — every visit must say where Saad worked.');
  }
  const startTime = TIME_RE.test(String(input.startTime || '')) ? String(input.startTime) : '';
  const endTime = TIME_RE.test(String(input.endTime || '')) ? String(input.endTime) : '';
  if ((startTime && !endTime) || (!startTime && endTime)) {
    throw new Error('Enter both start and end time, or neither (with hours worked instead).');
  }
  let hoursWorked = null;
  if (startTime && endTime) {
    hoursWorked = hoursFromTimes(startTime, endTime);
    if (hoursWorked === null) throw new Error('End time must be after start time.');
  } else if (input.hoursWorked !== null && input.hoursWorked !== undefined && input.hoursWorked !== '') {
    const n = Number(input.hoursWorked);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Hours worked must be a positive number.');
    hoursWorked = Math.round(n * 100) / 100;
  }
  if (hoursWorked === null) throw new Error('Enter start + end time, or hours worked — every visit must record how long Saad worked.');
  let fiberMeters = null;
  if (input.fiberMeters !== null && input.fiberMeters !== undefined && input.fiberMeters !== '') {
    const n = Number(input.fiberMeters);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Fiber meters must be a positive number.');
    fiberMeters = Math.round(n * 100) / 100;
  }
  const ticketId = cleanText(input.ticketId);
  if (ticketId && !ticketIds.map(String).includes(ticketId)) {
    throw new Error('That ticket id does not exist — link only a real field ticket, or leave it blank.');
  }
  return {
    date,
    type,
    customerId,
    customerName,
    customerNumber,
    area,
    fiberMeters,
    startTime,
    endTime,
    hoursWorked,
    ticketId,
    note: cleanText(input.note)
  };
}

/**
 * Appends one visit. Throws on a bad date, unknown type, an unknown
 * customer id, an unknown ticket id, bad fiber meters, or missing hours.
 * Returns the new visit list (input untouched).
 */
export function addSaadVisit(visits, input, { customers = [], ticketIds = [] } = {}) {
  const clean = sanitizeSaadVisits(visits);
  const fields = buildVisitFields(input, { customers, ticketIds });
  const record = {
    id: nextVisitId(clean),
    ...fields,
    createdAt: new Date().toISOString()
  };
  return [...clean, record];
}

/**
 * Edits one visit IN PLACE (same id, same list position, same
 * createdAt). Same validation as create via buildVisitFields; the
 * stored record is merged, never replaced wholesale, so id/createdAt
 * and any field the form does not show survive the edit. Throws on an
 * unknown id. Returns the new visit list (input untouched). Monthly
 * summaries are computed from the list, so they reflect the edit at
 * once — no stored summary ever needs updating.
 */
export function updateSaadVisit(visits, id, input, { customers = [], ticketIds = [] } = {}) {
  const clean = sanitizeSaadVisits(visits);
  const index = clean.findIndex((v) => String(v.id) === String(id));
  if (index === -1) throw new Error('That visit was not found.');
  const fields = buildVisitFields(input, { customers, ticketIds, existing: clean[index] });
  const out = [...clean];
  out[index] = { ...clean[index], ...fields };
  return out;
}

/**
 * Deletes one visit. Throws on an unknown id. Returns the new visit
 * list (input untouched). Computed month summaries drop the visit at
 * once; a later backup export no longer contains it, so a fresh-state
 * restore cannot resurrect it.
 */
export function deleteSaadVisit(visits, id) {
  const clean = sanitizeSaadVisits(visits);
  if (!clean.some((v) => String(v.id) === String(id))) throw new Error('That visit was not found.');
  return clean.filter((v) => String(v.id) !== String(id));
}

/** Validates one payment's form input; shared by create and edit. */
export function buildPaymentFields(input) {
  const date = DATE_RE.test(String(input.date || '')) ? String(input.date) : '';
  if (!date) throw new Error('A valid payment date is required.');
  const type = PAYMENT_TYPE_IDS.includes(input.type) ? input.type : null;
  if (!type) throw new Error('Payment type must be Salary or Commission.');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be a positive PKR number.');
  return {
    date,
    type,
    amount: Math.round(amount * 100) / 100,
    note: cleanText(input.note),
    paidFromDrawer: input.paidFromDrawer === true
  };
}

/**
 * Appends one payment (record of what was ACTUALLY PAID — never a salary
 * computation). Throws on a bad date, a non-positive amount, or an unknown
 * type. Returns the new payment list (input untouched).
 */
export function addSaadPayment(payments, input) {
  const clean = sanitizeSaadPayments(payments);
  const fields = buildPaymentFields(input);
  const record = {
    id: nextPaymentId(clean),
    ...fields,
    createdAt: new Date().toISOString()
  };
  return [...clean, record];
}

/**
 * Edits one payment IN PLACE (same id, same list position, same
 * createdAt). Same validation as create; the stored record is merged,
 * never replaced wholesale. Throws on an unknown id. Returns the new
 * payment list (input untouched). The month summary split (Salary /
 * Commission / total) is computed, so it reflects the edit at once.
 */
export function updateSaadPayment(payments, id, input) {
  const clean = sanitizeSaadPayments(payments);
  const index = clean.findIndex((p) => String(p.id) === String(id));
  if (index === -1) throw new Error('That payment was not found.');
  const fields = buildPaymentFields(input);
  const out = [...clean];
  out[index] = { ...clean[index], ...fields };
  return out;
}

/**
 * Deletes one payment. Throws on an unknown id. Returns the new payment
 * list (input untouched). A later backup export no longer contains it,
 * so a fresh-state restore cannot resurrect it.
 */
export function deleteSaadPayment(payments, id) {
  const clean = sanitizeSaadPayments(payments);
  if (!clean.some((p) => String(p.id) === String(id))) throw new Error('That payment was not found.');
  return clean.filter((p) => String(p.id) !== String(id));
}

/** Visits in one YYYY-MM month, oldest first (for per-day breakdowns). */
export function visitsForMonth(visits, month) {
  return sanitizeSaadVisits(visits)
    .filter((v) => monthOf(v.date) === month)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
}

/** Visit log, latest first (date desc, then created order desc). */
export function sortedVisitLog(visits) {
  const clean = sanitizeSaadVisits(visits);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

/** Filtered log: by month and/or type; newest first. */
export function filterSaadVisits(visits, { month = '', type = '' } = {}) {
  return sortedVisitLog(visits).filter((v) => {
    if (month && monthOf(v.date) !== month) return false;
    if (type && v.type !== type) return false;
    return true;
  });
}

/**
 * Month-end summary, fully COMPUTED from stored visits + payments:
 * - daysPresent: exact dates Saad came (a day counts ONCE even with 2 visits)
 * - totalHours: sum of all visit durations that month
 * - perDay: [{ date, visits, hours, places[] }] — where he worked each day
 * - type counts + total fiber meters recorded
 * - payments: salaryTotal, commissionTotal, grandTotal (0 when none)
 * A month with no visits yields 0 days / 0 hours, never blank or a crash.
 */
export function buildMonthlySaadSummary(visits, payments, month) {
  const monthVisits = visitsForMonth(visits, month);
  const byDay = new Map();
  for (const v of monthVisits) {
    if (!byDay.has(v.date)) byDay.set(v.date, []);
    byDay.get(v.date).push(v);
  }
  const perDay = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, dayVisits]) => ({
      date,
      visits: dayVisits,
      hours: Math.round(dayVisits.reduce((sum, v) => sum + visitHours(v), 0) * 100) / 100,
      places: [...new Set(dayVisits.map((v) => visitWhereLabel(v)))]
    }));
  const countType = (id) => monthVisits.filter((v) => v.type === id).length;
  const monthPayments = sanitizeSaadPayments(payments).filter((p) => monthOf(p.date) === month);
  const salaryTotal = monthPayments.filter((p) => p.type === 'salary').reduce((s, p) => s + p.amount, 0);
  const commissionTotal = monthPayments.filter((p) => p.type === 'commission').reduce((s, p) => s + p.amount, 0);
  return {
    month,
    visits: monthVisits,
    daysPresent: perDay.map((d) => d.date),
    dayCount: perDay.length,
    totalHours: Math.round(perDay.reduce((s, d) => s + d.hours, 0) * 100) / 100,
    perDay,
    splicingCount: countType('splicing'),
    fiberFixCount: countType('fiber-fix'),
    installCount: countType('install'),
    otherCount: countType('other'),
    totalFiberMeters: Math.round(monthVisits.reduce((s, v) => s + (v.fiberMeters || 0), 0) * 100) / 100,
    payments: monthPayments,
    salaryTotal: Math.round(salaryTotal * 100) / 100,
    commissionTotal: Math.round(commissionTotal * 100) / 100,
    grandTotal: Math.round((salaryTotal + commissionTotal) * 100) / 100
  };
}

/**
 * SISP-56: Saad payments ↔ Expenses + Roznamcha sync.
 *
 * The Expenses ledger (state.expenses) is what monthly P&L
 * (dashboard-pnl.js calculatePnlAnalytics) and the partner-share report
 * (phase3.js buildPartnerShareReport) read. Saad payments live in their
 * own store, so before this sync what Saad was actually paid never
 * reduced monthly profit or the partners' 50% shares.
 *
 * The sync is a convergent reconcile in the SISP-45 shape, run at
 * startup, after every Saad-log change, after every roznamcha change
 * and after a backup restore. The payment list is the source of truth:
 * - Each payment maps to exactly ONE expense row carrying
 *   saadPaymentId = the payment's id (the dedup key) plus a
 *   deterministic expense id (`saad-<payment id>`), saadPaymentType
 *   (the verbatim Salary/Commission type) and source: 'saad-visits'.
 *   Salary and Commission both map onto the canonical expense
 *   category 'Salary — Saad' (EXPENSE_CATEGORIES in phase3.js) — it is
 *   the ledger's one Saad-pay category, and the verbatim type survives
 *   in saadPaymentType and in the notes text.
 * - A payment with paidFromDrawer also maps to exactly ONE roznamcha
 *   outflow (same deterministic id, petty-cash category
 *   'Lineman Allowance', lineman 'Saad'). syncRoznamchaExpenses skips
 *   outflows with this id prefix — their expense mirror lives here, so
 *   a drawer payout is never deducted twice.
 * - Drifted mirrors are restored to the payment's values, a mirror
 *   whose payment was deleted (or un-flagged as drawer) is removed,
 *   and duplicated mirrors collapse back to one row. Manual expenses
 *   (no saadPaymentId) and manual roznamcha outflows (no `saad-` id)
 *   are never touched.
 * - A CLOSED roznamcha day is never mutated: a drawer payout whose day
 *   is closed keeps only its expense mirror and is counted in
 *   drawerSkippedClosed; an outflow already frozen into a closed day
 *   stays exactly as frozen.
 * - Idempotent: running it on an already-synced pair of ledgers
 *   returns changed: false with the identical array references, so
 *   re-running it can never duplicate an entry.
 */

/** The canonical Expenses-ledger category every Saad payout maps to. */
export const SAAD_EXPENSE_CATEGORY = 'Salary — Saad';

/** The petty-cash category a drawer-paid Saad payout lands under. */
export const SAAD_DRAWER_ROZNAMCHA_CATEGORY = 'Lineman Allowance';

/** Deterministic expense id for a mirrored payment. */
export function syncedSaadExpenseId(paymentId) {
  return `saad-${paymentId}`;
}

/** Deterministic roznamcha outflow id for a drawer-paid payment. */
export function syncedSaadDrawerOutflowId(paymentId) {
  return `saad-${paymentId}`;
}

/** Notes text for a mirrored expense — keeps the verbatim payment facts. */
export function buildSaadPaymentExpenseNotes(payment) {
  const head = `Saad Visit Log · ${paymentTypeLabel(payment.type)}`;
  return (payment.note ? `${head} — ${payment.note}` : head).slice(0, 1000);
}

/** Note text for a mirrored drawer outflow (roznamcha caps notes at 200). */
export function buildSaadDrawerOutflowNote(payment) {
  const head = `Saad ${payment.type === 'salary' ? 'salary' : 'commission'} · ${payment.id}`;
  return (payment.note ? `${head} — ${payment.note}` : head).slice(0, 200);
}

function syncedSaadExpenseRow(payment, existing, referenceDate) {
  const fields = {
    date: payment.date,
    amount: Math.round(payment.amount * 100) / 100,
    category: SAAD_EXPENSE_CATEGORY,
    notes: buildSaadPaymentExpenseNotes(payment),
    area: '',
    saadPaymentId: payment.id,
    saadPaymentType: payment.type,
    source: 'saad-visits'
  };
  if (!existing) {
    return { id: syncedSaadExpenseId(payment.id), ...fields, createdAt: new Date(referenceDate).toISOString() };
  }
  const drifted = existing.date !== fields.date || existing.amount !== fields.amount
    || existing.category !== fields.category || existing.notes !== fields.notes
    || existing.saadPaymentType !== fields.saadPaymentType || existing.source !== 'saad-visits';
  return drifted ? { ...existing, ...fields, updatedAt: new Date(referenceDate).toISOString() } : existing;
}

function syncedSaadDrawerOutflow(payment) {
  return {
    id: syncedSaadDrawerOutflowId(payment.id),
    category: SAAD_DRAWER_ROZNAMCHA_CATEGORY,
    amount: Math.round(payment.amount * 100) / 100,
    lineman: 'Saad',
    note: buildSaadDrawerOutflowNote(payment)
  };
}

function sameDrawerOutflow(a, b) {
  return a && b && a.category === b.category && a.amount === b.amount
    && a.lineman === b.lineman && a.note === b.note;
}

/**
 * Reconcile the Expenses ledger and the roznamcha day ledger with the
 * recorded Saad payments. Pure: returns { expenses, days,
 * expensesChanged, daysChanged, changed, added, updated, removed,
 * drawerAdded, drawerUpdated, drawerRemoved, drawerSkippedClosed }
 * and never mutates its inputs. `expenses` / `days` are the SAME
 * array references when their side did not change, so callers can
 * skip persisting. `days` is treated as plain sanitized day data
 * (see roznamcha.js sanitizeRoznamchaDays); closed days are read
 * but never written.
 */
export function syncSaadPaymentLedgers(expenses, days, payments, referenceDate = new Date()) {
  const cleanPayments = sanitizeSaadPayments(payments);

  // --- Expenses side: one mirror row per payment, keyed saadPaymentId.
  const desiredPayments = new Map(cleanPayments.map((p) => [p.id, p]));
  const currentExpenses = Array.isArray(expenses) ? expenses : [];
  const seenPayments = new Set();
  let added = 0;
  let updated = 0;
  let removed = 0;
  const nextExpenses = [];
  for (const row of currentExpenses) {
    const paymentId = typeof row?.saadPaymentId === 'string' && row.saadPaymentId ? row.saadPaymentId : null;
    if (!paymentId) { nextExpenses.push(row); continue; }
    const want = desiredPayments.get(paymentId);
    if (!want || seenPayments.has(paymentId)) { removed += 1; continue; }
    seenPayments.add(paymentId);
    const synced = syncedSaadExpenseRow(want, row, referenceDate);
    if (synced !== row) updated += 1;
    nextExpenses.push(synced);
  }
  for (const [paymentId, want] of desiredPayments) {
    if (seenPayments.has(paymentId)) continue;
    seenPayments.add(paymentId);
    nextExpenses.push(syncedSaadExpenseRow(want, null, referenceDate));
    added += 1;
  }
  const expensesChanged = added + updated + removed > 0;

  // --- Roznamcha side: one outflow per drawer-paid payment, keyed by
  // the deterministic outflow id. Clone-on-write so frozen/untouched
  // days keep their identity and closed days are never rebuilt.
  const drawerDesired = new Map(
    cleanPayments.filter((p) => p.paidFromDrawer).map((p) => [syncedSaadDrawerOutflowId(p.id), p])
  );
  const currentDays = Array.isArray(days) ? days : [];
  let nextDays = currentDays;
  let drawerAdded = 0;
  let drawerUpdated = 0;
  let drawerRemoved = 0;
  let drawerSkippedClosed = 0;
  const writableDays = () => {
    if (nextDays === currentDays) {
      nextDays = currentDays.map((d) => ({ ...d, outflows: [...(Array.isArray(d?.outflows) ? d.outflows : [])] }));
    }
    return nextDays;
  };
  // Pass 1: drop or repair existing Saad-owned outflows in OPEN days.
  const present = new Set();
  currentDays.forEach((day, dayIndex) => {
    if (!day || day.closed === true || !Array.isArray(day.outflows)) return;
    for (const outflow of day.outflows) {
      const outflowId = typeof outflow?.id === 'string' ? outflow.id : '';
      if (!outflowId.startsWith('saad-')) continue;
      const want = drawerDesired.get(outflowId);
      if (!want || want.date !== day.date) {
        const target = writableDays()[dayIndex];
        target.outflows = target.outflows.filter((o) => o.id !== outflowId);
        drawerRemoved += 1;
        continue;
      }
      present.add(outflowId);
      const clean = syncedSaadDrawerOutflow(want);
      if (!sameDrawerOutflow(outflow, clean)) {
        const target = writableDays()[dayIndex];
        target.outflows = target.outflows.map((o) => (o.id === outflowId ? clean : o));
        drawerUpdated += 1;
      }
    }
  });
  // Pass 2: add missing outflows; a closed (or frozen) target day is
  // reported, never mutated.
  for (const [outflowId, want] of drawerDesired) {
    if (present.has(outflowId)) continue;
    const frozen = currentDays.some((d) => d && d.date === want.date && Array.isArray(d.outflows)
      && d.outflows.some((o) => o.id === outflowId));
    if (frozen) { present.add(outflowId); continue; }
    const existingIndex = currentDays.findIndex((d) => d && d.date === want.date);
    if (existingIndex >= 0 && currentDays[existingIndex].closed === true) {
      drawerSkippedClosed += 1;
      continue;
    }
    const target = writableDays();
    const writableIndex = target.findIndex((d) => d && d.date === want.date);
    if (writableIndex >= 0) {
      target[writableIndex].outflows = [...target[writableIndex].outflows, syncedSaadDrawerOutflow(want)];
    } else {
      target.push({ date: want.date, outflows: [syncedSaadDrawerOutflow(want)], closed: false });
      target.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    }
    present.add(outflowId);
    drawerAdded += 1;
  }
  const daysChanged = drawerAdded + drawerUpdated + drawerRemoved > 0;

  return {
    expenses: expensesChanged ? nextExpenses : currentExpenses,
    days: daysChanged ? nextDays : currentDays,
    expensesChanged,
    daysChanged,
    changed: expensesChanged || daysChanged,
    added,
    updated,
    removed,
    drawerAdded,
    drawerUpdated,
    drawerRemoved,
    drawerSkippedClosed
  };
}

/**
 * Dashboard + modal controller, following the inventory-book pattern:
 * open() / refresh(), open button wired by id, close button, form submits.
 * getState supplies the live customer list; listTicketIds supplies existing
 * field-ticket ids for the optional ticket link (both injected so this
 * module stays import-free).
 */
export function setupSaadVisitsModal(getState, { onVisitsChanged, onToast, listTicketIds, onConfirm } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('saadVisitsModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  // Edit state: null while the form adds a new entry; an id while it edits one.
  let editingVisitId = null;
  let editingPaymentId = null;
  const getCustomers = () => {
    try {
      const state = typeof getState === 'function' ? getState() : null;
      return Array.isArray(state?.customers) ? state.customers : [];
    } catch {
      return [];
    }
  };

  // Delete confirmation via the app's own in-app dialog (injected as
  // onConfirm by app.js); never a silent delete. Falls back to the
  // browser confirm only where the app dialog is unavailable, and
  // refuses when neither exists.
  async function confirmDelete(title, subject) {
    if (typeof onConfirm === 'function') {
      return !!(await onConfirm({ tone: 'danger', title, subject, message: 'This cannot be undone from this device except by re-entering it.', confirmLabel: 'Delete' }));
    }
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(`${title}\n\n${subject}`);
    }
    if (typeof onToast === 'function') onToast('Delete needs confirmation — not available here.');
    return false;
  }

  function customerOptions(customers, query) {
    const q = (query || '').trim().toLowerCase();
    const rows = customers.filter((c) => {
      if (!q) return true;
      return String(c.name || '').toLowerCase().includes(q)
        || String(c.customerNumber ?? '').includes(q)
        || String(c.mohalla || '').toLowerCase().includes(q);
    });
    return rows.map((c) => {
      const label = `${c.name || 'Unnamed'} (#${c.customerNumber ?? '—'})${c.mohalla ? ` · ${c.mohalla}` : ''}`;
      return `<option value="${escapeHtml(String(c.id))}">${escapeHtml(label)}</option>`;
    }).join('');
  }

  function refreshCustomerSelect() {
    const select = $('saadVisitCustomer');
    if (!select) return;
    const prev = select.value;
    const placeholder = '<option value="">Area-level work — no single customer</option>';
    let options = customerOptions(getCustomers(), $('saadVisitCustomerSearch')?.value);
    // While editing an entry whose customer left the list, keep its
    // stored customer selectable so the edit does not silently unlink it.
    if (editingVisitId) {
      const editing = loadSaadVisits().find((v) => String(v.id) === String(editingVisitId));
      if (editing && editing.customerId && !getCustomers().some((c) => String(c.id) === String(editing.customerId))) {
        const label = `${editing.customerName || 'Unnamed'}${editing.customerNumber !== null && editing.customerNumber !== undefined ? ` (#${editing.customerNumber})` : ''} · not in list`;
        options += `<option value="${escapeHtml(String(editing.customerId))}">${escapeHtml(label)}</option>`;
      }
    }
    select.innerHTML = placeholder + options;
    if ([...select.options].some((o) => o.value === prev)) select.value = prev;
  }

  function render() {
    const month = $('saadVisitsMonth')?.value || monthOf(pakistanDateToday());
    if ($('saadVisitsMonth') && !$('saadVisitsMonth').value) $('saadVisitsMonth').value = month;
    const typeFilter = $('saadVisitsTypeFilter')?.value || '';
    const visits = loadSaadVisits();
    const payments = loadSaadPayments();
    const summary = buildMonthlySaadSummary(visits, payments, month);
    const summaryEl = $('saadVisitsMonthSummary');
    if (summaryEl) {
      const dayLines = summary.perDay.length === 0
        ? '<p class="saad-visits-empty">Is mahine koi visit darj nahi hui.</p>'
        : summary.perDay.map((d) => `
          <article class="saad-visits-day-card">
            <p><span>${escapeHtml(d.date)}</span><strong>${escapeHtml(formatHours(d.hours))} h</strong></p>
            <p><span>Where</span><strong>${escapeHtml(d.places.join(' · '))}</strong></p>
            <p><span>Work</span><strong>${escapeHtml(d.visits.map((v) => visitTypeLabel(v.type)).join(', '))}</strong></p>
          </article>`).join('');
      const paymentLines = summary.payments.length === 0
        ? '<p class="saad-visits-empty">Is mahine koi payment darj nahi hui (0 PKR).</p>'
        : summary.payments.map((p) => `
          <p><span>${escapeHtml(p.date)} · ${escapeHtml(paymentTypeLabel(p.type))}${p.paidFromDrawer ? ' · Drawer cash (Roznamcha)' : ''}</span><strong>${escapeHtml(String(p.amount))} PKR</strong><span class="saad-visits-payment-actions"><button type="button" class="secondary-button" data-edit-payment="${escapeHtml(String(p.id))}">✏️ Edit</button><button type="button" class="secondary-button danger" data-delete-payment="${escapeHtml(String(p.id))}">🗑 Delete</button></span></p>`).join('');
      summaryEl.innerHTML = `
        <div class="saad-visits-summary-cards">
          <p><span>Days present</span><strong>${summary.dayCount}</strong></p>
          <p><span>Total hours</span><strong>${escapeHtml(formatHours(summary.totalHours))} h</strong></p>
          <p><span>Visits</span><strong>${summary.visits.length}</strong></p>
          <p><span>Splicing / Fiber fix / Installs</span><strong>${summary.splicingCount} / ${summary.fiberFixCount} / ${summary.installCount}</strong></p>
          <p><span>Paid — Salary</span><strong>${escapeHtml(String(summary.salaryTotal))} PKR</strong></p>
          <p><span>Paid — Commission</span><strong>${escapeHtml(String(summary.commissionTotal))} PKR</strong></p>
          <p><span>Paid — Total</span><strong>${escapeHtml(String(summary.grandTotal))} PKR</strong></p>
        </div>
        <h3>Days he came (${escapeHtml(month)})</h3>
        <p class="saad-visits-dates">${summary.daysPresent.length ? escapeHtml(summary.daysPresent.join(' · ')) : '—'}</p>
        <h3>Per-day breakdown</h3>
        <div class="saad-visits-day-list">${dayLines}</div>
        <h3>Payments this month</h3>
        <div class="saad-visits-payment-list">${paymentLines}</div>`;
      summaryEl.querySelectorAll('[data-edit-payment]').forEach((btn) => btn.addEventListener('click', () => {
        const payment = loadSaadPayments().find((p) => String(p.id) === btn.dataset.editPayment);
        if (payment) startPaymentEdit(payment);
      }));
      summaryEl.querySelectorAll('[data-delete-payment]').forEach((btn) => btn.addEventListener('click', async () => {
        const payment = loadSaadPayments().find((p) => String(p.id) === btn.dataset.deletePayment);
        if (!payment) return;
        const confirmed = await confirmDelete('Delete this payment?', `${paymentTypeLabel(payment.type)} · ${payment.date} · ${payment.amount} PKR`);
        if (!confirmed) return;
        try {
          saveSaadPayments(deleteSaadPayment(loadSaadPayments(), payment.id));
          if (editingPaymentId === payment.id) cancelPaymentEdit();
          render();
          if (typeof onVisitsChanged === 'function') onVisitsChanged();
          if (typeof onToast === 'function') onToast('Payment deleted.');
        } catch (error) {
          if (typeof onToast === 'function') onToast(error.message || 'Could not delete payment.');
        }
      }));
    }
    const listEl = $('saadVisitsList');
    if (listEl) {
      const rows = filterSaadVisits(visits, { month, type: typeFilter });
      listEl.innerHTML = rows.length === 0
        ? '<p class="saad-visits-empty">No visits match this filter.</p>'
        : rows.map((v) => `
          <article class="saad-visits-card">
            <p><span>${escapeHtml(visitTypeLabel(v.type))}</span><strong>${escapeHtml(v.date)} · ${escapeHtml(formatHours(visitHours(v)))} h</strong></p>
            <p><span>Where</span><strong>${escapeHtml(visitWhereLabel(v))}</strong></p>
            ${v.area && v.customerName ? `<p><span>Area</span><strong>${escapeHtml(v.area)}</strong></p>` : ''}
            ${v.fiberMeters !== null ? `<p><span>Fiber used</span><strong>${escapeHtml(String(v.fiberMeters))} m (recorded only)</strong></p>` : ''}
            ${v.startTime && v.endTime ? `<p><span>Time</span><strong>${escapeHtml(v.startTime)} – ${escapeHtml(v.endTime)}</strong></p>` : ''}
            ${v.ticketId ? `<p><span>Ticket</span><strong>${escapeHtml(v.ticketId)}</strong></p>` : ''}
            ${v.note ? `<p><span>Note</span><strong>${escapeHtml(v.note)}</strong></p>` : ''}
            <div class="saad-visits-card-actions"><button type="button" class="secondary-button" data-edit-visit="${escapeHtml(String(v.id))}">✏️ Edit</button><button type="button" class="secondary-button danger" data-delete-visit="${escapeHtml(String(v.id))}">🗑 Delete</button></div>
          </article>`).join('');
      listEl.querySelectorAll('[data-edit-visit]').forEach((btn) => btn.addEventListener('click', () => {
        const visit = loadSaadVisits().find((v) => String(v.id) === btn.dataset.editVisit);
        if (visit) startVisitEdit(visit);
      }));
      listEl.querySelectorAll('[data-delete-visit]').forEach((btn) => btn.addEventListener('click', async () => {
        const visit = loadSaadVisits().find((v) => String(v.id) === btn.dataset.deleteVisit);
        if (!visit) return;
        const confirmed = await confirmDelete('Delete this visit?', `${visitTypeLabel(visit.type)} · ${visit.date} · ${visitWhereLabel(visit)}`);
        if (!confirmed) return;
        try {
          saveSaadVisits(deleteSaadVisit(loadSaadVisits(), visit.id));
          if (editingVisitId === visit.id) cancelVisitEdit();
          render();
          if (typeof onVisitsChanged === 'function') onVisitsChanged();
          if (typeof onToast === 'function') onToast('Visit deleted.');
        } catch (error) {
          if (typeof onToast === 'function') onToast(error.message || 'Could not delete visit.');
        }
      }));
    }
    refreshCustomerSelect();
    const dateInput = $('saadVisitDate');
    if (dateInput && !dateInput.value) dateInput.value = pakistanDateToday();
    const payDateInput = $('saadPaymentDate');
    if (payDateInput && !payDateInput.value) payDateInput.value = pakistanDateToday();
  }

  const searchInput = $('saadVisitCustomerSearch');
  if (searchInput) searchInput.addEventListener('input', refreshCustomerSelect);
  const customerSelect = $('saadVisitCustomer');
  if (customerSelect) customerSelect.addEventListener('change', () => {
    const customer = getCustomers().find((c) => String(c.id) === customerSelect.value);
    const areaInput = $('saadVisitArea');
    if (customer && areaInput) {
      const fallback = cleanText(customer.mohalla) || cleanText(customer.zone);
      if (fallback) areaInput.value = fallback;
    }
  });
  const monthInput = $('saadVisitsMonth');
  if (monthInput) monthInput.addEventListener('change', render);
  const typeFilter = $('saadVisitsTypeFilter');
  if (typeFilter) typeFilter.addEventListener('change', render);

  // Edit helpers: pre-fill the SAME form, swap the submit label, and
  // show a Cancel button that restores the add-new state. The stored
  // record is never touched until the edited form saves successfully.
  function setVisitSubmitMode() {
    const submit = $('saadVisitForm')?.querySelector('button[type="submit"]');
    if (submit) submit.textContent = editingVisitId ? '💾 Changes save karein' : '➕ Visit darj karein';
    const cancel = $('saadVisitCancelEditBtn');
    if (cancel) cancel.hidden = !editingVisitId;
  }
  function startVisitEdit(visit) {
    editingVisitId = visit.id;
    const set = (id, value) => { const el = $(id); if (el) el.value = value ?? ''; };
    set('saadVisitDate', visit.date);
    set('saadVisitType', visit.type);
    refreshCustomerSelect();
    set('saadVisitCustomer', visit.customerId);
    set('saadVisitArea', visit.area);
    set('saadVisitFiberMeters', visit.fiberMeters === null || visit.fiberMeters === undefined ? '' : String(visit.fiberMeters));
    set('saadVisitStartTime', visit.startTime);
    set('saadVisitEndTime', visit.endTime);
    set('saadVisitHours', visit.hoursWorked === null || visit.hoursWorked === undefined ? '' : String(visit.hoursWorked));
    set('saadVisitTicket', visit.ticketId);
    set('saadVisitNote', visit.note);
    setVisitSubmitMode();
    try { $('saadVisitForm')?.scrollIntoView({ block: 'start' }); } catch { /* scroll is a nicety, never a failure */ }
  }
  function cancelVisitEdit() {
    editingVisitId = null;
    const visitForm = $('saadVisitForm');
    if (visitForm) visitForm.reset();
    const dateInput = $('saadVisitDate');
    if (dateInput) dateInput.value = pakistanDateToday();
    refreshCustomerSelect();
    setVisitSubmitMode();
  }
  // SISP-56: pre-fill the visit form from a resolved field ticket
  // ("Log Saad Visit from Ticket"). Only facts the ticket actually
  // records are filled — date, work type, customer, area, fiber meters
  // and the ticket link; the operator still enters the hours worked,
  // because a ticket's created/resolved stamps are not work duration.
  function applyVisitPrefill(prefill) {
    if (editingVisitId) cancelVisitEdit();
    const set = (id, value) => { const el = $(id); if (el) el.value = value ?? ''; };
    if (prefill.date) set('saadVisitDate', prefill.date);
    if (prefill.type) set('saadVisitType', prefill.type);
    refreshCustomerSelect();
    if (prefill.customerId) set('saadVisitCustomer', prefill.customerId);
    if (prefill.area) set('saadVisitArea', prefill.area);
    set('saadVisitFiberMeters', prefill.fiberMeters === null || prefill.fiberMeters === undefined ? '' : String(prefill.fiberMeters));
    if (prefill.ticketId) set('saadVisitTicket', prefill.ticketId);
    if (prefill.note) set('saadVisitNote', prefill.note);
    try { $('saadVisitForm')?.scrollIntoView({ block: 'start' }); } catch { /* scroll is a nicety, never a failure */ }
    const hoursInput = $('saadVisitHours');
    if (hoursInput) { try { hoursInput.focus(); } catch { /* focus is a nicety */ } }
    if (typeof onToast === 'function') {
      onToast(`Ticket ${prefill.ticketId || ''} se visit tayyar hai — hours darj karke save karein.`);
    }
  }
  function setPaymentSubmitMode() {
    const submit = $('saadPaymentForm')?.querySelector('button[type="submit"]');
    if (submit) submit.textContent = editingPaymentId ? '💾 Changes save karein' : '➕ Payment darj karein';
    const cancel = $('saadPaymentCancelEditBtn');
    if (cancel) cancel.hidden = !editingPaymentId;
  }
  function startPaymentEdit(payment) {
    editingPaymentId = payment.id;
    const set = (id, value) => { const el = $(id); if (el) el.value = value ?? ''; };
    set('saadPaymentDate', payment.date);
    set('saadPaymentAmount', String(payment.amount));
    set('saadPaymentType', payment.type);
    set('saadPaymentNote', payment.note);
    const drawerBox = $('saadPaymentFromDrawer');
    if (drawerBox) drawerBox.checked = payment.paidFromDrawer === true;
    setPaymentSubmitMode();
    try { $('saadPaymentForm')?.scrollIntoView({ block: 'start' }); } catch { /* scroll is a nicety, never a failure */ }
  }
  function cancelPaymentEdit() {
    editingPaymentId = null;
    const paymentForm = $('saadPaymentForm');
    if (paymentForm) paymentForm.reset();
    const payDateInput = $('saadPaymentDate');
    if (payDateInput) payDateInput.value = pakistanDateToday();
    setPaymentSubmitMode();
  }
  // Closing the modal abandons any in-progress edit, so reopening
  // always starts from a clean add-new form.
  dialog.addEventListener('close', () => {
    if (editingVisitId) cancelVisitEdit();
    if (editingPaymentId) cancelPaymentEdit();
  });

  const form = $('saadVisitForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const ticketIds = typeof listTicketIds === 'function' ? listTicketIds() : [];
        const input = {
          date: $('saadVisitDate')?.value,
          type: $('saadVisitType')?.value,
          customerId: $('saadVisitCustomer')?.value,
          area: $('saadVisitArea')?.value,
          fiberMeters: $('saadVisitFiberMeters')?.value,
          startTime: $('saadVisitStartTime')?.value,
          endTime: $('saadVisitEndTime')?.value,
          hoursWorked: $('saadVisitHours')?.value,
          ticketId: $('saadVisitTicket')?.value,
          note: $('saadVisitNote')?.value
        };
        const wasEditing = editingVisitId;
        const updated = wasEditing
          ? updateSaadVisit(loadSaadVisits(), wasEditing, input, { customers: getCustomers(), ticketIds })
          : addSaadVisit(loadSaadVisits(), input, { customers: getCustomers(), ticketIds });
        saveSaadVisits(updated);
        if (wasEditing) {
          cancelVisitEdit();
        } else {
          form.reset();
          const dateInput = $('saadVisitDate');
          if (dateInput) dateInput.value = pakistanDateToday();
          refreshCustomerSelect();
        }
        render();
        if (typeof onVisitsChanged === 'function') onVisitsChanged();
        if (typeof onToast === 'function') onToast(wasEditing ? 'Visit updated.' : 'Saad visit recorded.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not record visit.');
      }
    });
  }
  const visitCancelBtn = $('saadVisitCancelEditBtn');
  if (visitCancelBtn) visitCancelBtn.addEventListener('click', cancelVisitEdit);
  const payForm = $('saadPaymentForm');
  if (payForm) {
    payForm.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const input = {
          date: $('saadPaymentDate')?.value,
          amount: $('saadPaymentAmount')?.value,
          type: $('saadPaymentType')?.value,
          note: $('saadPaymentNote')?.value,
          paidFromDrawer: $('saadPaymentFromDrawer')?.checked === true
        };
        const wasEditing = editingPaymentId;
        const updated = wasEditing
          ? updateSaadPayment(loadSaadPayments(), wasEditing, input)
          : addSaadPayment(loadSaadPayments(), input);
        saveSaadPayments(updated);
        if (wasEditing) {
          cancelPaymentEdit();
        } else {
          payForm.reset();
          const payDateInput = $('saadPaymentDate');
          if (payDateInput) payDateInput.value = pakistanDateToday();
        }
        render();
        if (typeof onVisitsChanged === 'function') onVisitsChanged();
        if (typeof onToast === 'function') onToast(wasEditing ? 'Payment updated.' : 'Saad payment recorded.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not record payment.');
      }
    });
  }
  const paymentCancelBtn = $('saadPaymentCancelEditBtn');
  if (paymentCancelBtn) paymentCancelBtn.addEventListener('click', cancelPaymentEdit);
  const closeBtn = $('saadVisitsCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openSaadVisitsModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    render();
    dialog.showModal();
  });

  return {
    open(prefill = null) {
      // SISP-56: a ticket prefill opens the log on the ticket's month
      // so the visit being logged is in view once saved.
      if (prefill && typeof prefill === 'object' && prefill.date) {
        const monthInput = $('saadVisitsMonth');
        if (monthInput) monthInput.value = monthOf(prefill.date);
      }
      render();
      if (prefill && typeof prefill === 'object') applyVisitPrefill(prefill);
      dialog.showModal();
    },
    refresh: render
  };
}
