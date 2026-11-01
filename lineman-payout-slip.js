/**
 * lineman-payout-slip.js — SISP-155 [P2]: Lineman Monthly Salary + Visit
 * Commissions − Mid-Month Advance (Upad) Settlement Slip.
 *
 * Spec (read-latest.txt, SISP-155 block): "Compute Base Salary +
 * Installation/Visit Commissions + Field Bonuses − Mid-Month Advances
 * (Upad) = Net End-of-Month Payable PKR, generate a printable bilingual
 * settlement slip, and post the final payout to Roznamcha." Test
 * criterion: "Unit tests for commission + salary − advance math and
 * duplicate settlement prevention."
 *
 * SOURCE AUDIT (every slip line — recorded source vs owner-entered):
 * - Base Salary: a recorded figure exists — SAAD_BASE_MONTHLY_SALARY in
 *   phase3.js (also surfaced by core.js buildPayrollSummary as
 *   saadBaseMonthlySalary). The settlement form is PRE-FILLED with it
 *   and the owner may change it; the value actually used is stored on
 *   the settlement record.
 * - Installation / Visit Commissions: COUNTS come from the recorded
 *   visit log (sisp_saad_visits_v1, saad-visits.js) — visits of type
 *   'install' in the month are installs, every other recorded visit
 *   type (splicing / fiber-fix / other) counts as a visit. NO per-visit
 *   rate is recorded anywhere in this codebase (phase3's
 *   SAAD_PER_ELIGIBLE_CUSTOMER_MONTHLY is a per-eligible-CUSTOMER
 *   monthly payroll figure, not a per-visit rate, and is deliberately
 *   NOT reused as one), so both RATES are owner-entered on the form
 *   and stored on the record. Counts are pre-filled and editable.
 * - Field Bonuses: owner-entered — no recorded source exists.
 * - Mid-Month Advances (Upad): a real trail exists — the recorded
 *   lineman payments (sisp_saad_payments_v1, saad-visits.js): money
 *   already paid to the lineman inside the month (Salary / Commission
 *   payment records). Advances pre-fill with that month's payments
 *   total and stay owner-adjustable. Roznamcha petty-cash outflows are
 *   deliberately NOT summed in: they are field-expense money, and
 *   drawer-paid lineman payments already appear inside the payments
 *   trail, so adding both would double-count the same cash.
 * - Lineman name: never hardcoded in this module. It pre-fills with
 *   the most frequent `lineman` value recorded on Roznamcha outflows
 *   (runtime data), else blank for the owner to type; the settlement
 *   stores whoever's name is on the slip.
 *
 * SETTLEMENT RECORDS live in localStorage under
 * LINEMAN_PAYOUTS_KEY (sisp_lineman_payouts_v1), a flat array in the
 * sibling-store house pattern (saad-visits / partner-settlement). The
 * id is DETERMINISTIC per (lineman, month) — settling the same lineman
 * for the same month twice is refused; correcting a settlement means
 * deleting it first (which reverses its posting, below) and settling
 * again. The record stores every line figure and input, so the printed
 * slip reprints identically forever.
 *
 * POSTING (exactly once — the SISP-56 convergent-mirror pattern):
 * syncLinemanPayoutLedgers reconciles two mirrors from the settlement
 * list, which stays the source of truth:
 *   - Expenses: ONE row per settlement with netPayable > 0, in the
 *     real frozen category 'Salary — Saad' (EXPENSE_CATEGORIES), with
 *     deterministic id + dedup key `linemanPayoutId`, so monthly P&L
 *     (dashboard-pnl.js) and the partner shares deduct the payout
 *     exactly once — never a computed or duplicated figure. (The row
 *     is built by this sync, exactly as syncSaadPaymentLedgers builds
 *     its rows; phase3's addExpense cannot carry a dedup key, so it
 *     cannot be the recorder for a convergent mirror.)
 *   - Roznamcha: a settlement flagged paidFromDrawer with netPayable
 *     > 0 also lands as exactly ONE petty-cash outflow (deterministic
 *     id, category 'Lineman Allowance') on its paid date.
 *     syncRoznamchaExpenses skips these outflows (see roznamcha.js),
 *     so the drawer row never spawns a second expense. A CLOSED
 *     roznamcha day is never mutated: the expense mirror still lands
 *     and the skip is reported as drawerSkippedClosed.
 *   Deleting a settlement removes both mirrors on the next sync.
 *   Re-running the sync on synced ledgers changes nothing.
 *
 * NEGATIVE-NET RULE: when advances exceed gross earnings the payable
 * clamps to 0 — nothing is posted anywhere — and the excess advance is
 * stored on the record and printed on the slip as an advance carried
 * forward against next month. A negative expense is never created.
 *
 * Backup: settlements travel in the JSON backup `settings.
 * linemanPayouts` section (core.js), under the same safe-merge rule
 * as the Saad visit log: adopted only when this device has none.
 *
 * This module imports only leaf modules (phase3.js, saad-visits.js,
 * nav-language.js) so core.js can import its sanitizer without a
 * cycle. It is imported by app.js (UI wiring) and core.js
 * (sanitizer) only — never an entry file, so the dist bundle count
 * stays at the perf budget. Tests use synthetic data only.
 */

import { SAAD_BASE_MONTHLY_SALARY } from './phase3.js';
import {
  loadSaadPayments,
  loadSaadVisits,
  monthOf,
  pakistanDateToday,
  sanitizeSaadPayments,
  sanitizeSaadVisits
} from './saad-visits.js';
import { t } from './nav-language.js';

export const LINEMAN_PAYOUTS_KEY = 'sisp_lineman_payouts_v1';

/** The canonical Expenses-ledger category a lineman payout maps to. */
export const LINEMAN_PAYOUT_EXPENSE_CATEGORY = 'Salary — Saad';

/** The petty-cash category a drawer-paid payout lands under. */
export const LINEMAN_PAYOUT_DRAWER_CATEGORY = 'Lineman Allowance';

/** Deterministic mirror id prefix (expense row + roznamcha outflow). */
export const LINEMAN_PAYOUT_ID_PREFIX = 'lineman-payout-';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value, max = 200) {
  return typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, max) : '';
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

/** PKR formatting mirroring roznamcha.js (this module never imports core.js). */
export function formatLinemanPayoutPKR(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `PKR ${formatter.format(amount)}`;
}

function validDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Last day (YYYY-MM-DD) of a valid YYYY-MM month. */
export function linemanPayoutMonthEnd(month) {
  if (!MONTH_RE.test(String(month || ''))) return '';
  const [year, number] = String(month).split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, '0')}`;
}

/** Whole-PKR figure for storage: finite > 0 rounds, anything else is 0. */
function wholeRupees(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Non-negative integer count for storage. */
function wholeCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** URL/record-safe slug of a lineman name (identity for the deterministic id). */
export function linemanNameSlug(name) {
  const slug = String(name || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'lineman';
}

/** Deterministic settlement id for one (lineman, month) pair. */
export function linemanPayoutIdFor(linemanName, month) {
  return `LP-${linemanNameSlug(linemanName)}-${String(month || '')}`;
}

/** Deterministic expense id for a settlement's mirror row. */
export function syncedLinemanPayoutExpenseId(settlementId) {
  return `${LINEMAN_PAYOUT_ID_PREFIX}${settlementId}`;
}

/** Deterministic roznamcha outflow id for a settlement's mirror row. */
export function syncedLinemanPayoutOutflowId(settlementId) {
  return `${LINEMAN_PAYOUT_ID_PREFIX}${settlementId}`;
}

/**
 * The computed money lines for a set of resolved inputs. Pure: takes
 * the inputs, never reads a store. Every figure is whole PKR.
 */
export function computeLinemanPayoutLines(inputs = {}) {
  const baseSalary = wholeRupees(inputs.baseSalary);
  const installCount = wholeCount(inputs.installCount);
  const installRate = wholeRupees(inputs.installRate);
  const visitCount = wholeCount(inputs.visitCount);
  const visitRate = wholeRupees(inputs.visitRate);
  const bonuses = wholeRupees(inputs.bonuses);
  const advances = wholeRupees(inputs.advances);
  const installCommission = installCount * installRate;
  const visitCommission = visitCount * visitRate;
  const grossEarnings = baseSalary + installCommission + visitCommission + bonuses;
  const netPayable = Math.max(0, grossEarnings - advances);
  const excessAdvance = Math.max(0, advances - grossEarnings);
  return {
    baseSalary, installCount, installRate, installCommission,
    visitCount, visitRate, visitCommission,
    bonuses, advances, grossEarnings, netPayable, excessAdvance
  };
}

function sanitizeOnePayout(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const linemanName = cleanText(entry.linemanName, 100);
  const month = MONTH_RE.test(String(entry.month || '')) ? String(entry.month) : '';
  if (!linemanName || !month) return null;
  const lines = computeLinemanPayoutLines(entry);
  return {
    id: linemanPayoutIdFor(linemanName, month),
    linemanName,
    month,
    paidDate: validDate(entry.paidDate) ? String(entry.paidDate) : linemanPayoutMonthEnd(month),
    ...lines,
    recordedPaymentsTotal: wholeRupees(entry.recordedPaymentsTotal),
    recordedPaymentsCount: wholeCount(entry.recordedPaymentsCount),
    paidFromDrawer: entry.paidFromDrawer === true,
    note: cleanText(entry.note, 200),
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
  };
}

/**
 * Drops malformed rows, recomputes every derived figure from the
 * stored inputs (a tampered gross/net can never survive), and
 * collapses duplicate (lineman, month) rows to the first.
 */
export function sanitizeLinemanPayouts(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of value) {
    const clean = sanitizeOnePayout(entry);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

/** Reads settlement records; [] on missing/corrupt storage. */
export function loadLinemanPayouts(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(LINEMAN_PAYOUTS_KEY);
    if (!raw) return [];
    return sanitizeLinemanPayouts(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists settlement records; never throws. */
export function saveLinemanPayouts(payouts, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(LINEMAN_PAYOUTS_KEY, JSON.stringify(sanitizeLinemanPayouts(payouts)));
    return true;
  } catch {
    return false;
  }
}

/** The stored settlement for one (lineman, month), or null. */
export function findLinemanPayout(payouts, linemanName, month) {
  const id = linemanPayoutIdFor(linemanName, month);
  return sanitizeLinemanPayouts(payouts).find((row) => row.id === id) || null;
}

function requireMoneyInput(value, label) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be zero or greater.`);
  return Math.round(n);
}

function requireCountInput(value, label) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be zero or greater.`);
  return Math.floor(n);
}

/**
 * Build one settlement record from resolved inputs (the pure builder —
 * it takes the figures, it never reads a store). Throws on an empty
 * name, an invalid month, an invalid paid date, or a negative /
 * non-finite figure.
 */
export function buildLinemanPayout(inputs = {}, referenceDate = new Date()) {
  const linemanName = cleanText(inputs.linemanName, 100);
  if (!linemanName) throw new Error('Lineman name is required.');
  const month = String(inputs.month || '');
  if (!MONTH_RE.test(month)) throw new Error('Choose a valid settlement month.');
  let paidDate = pakistanDateToday(referenceDate);
  if (inputs.paidDate !== null && inputs.paidDate !== undefined && inputs.paidDate !== '') {
    if (!validDate(inputs.paidDate)) throw new Error('Paid date must be a valid date.');
    paidDate = String(inputs.paidDate);
  }
  const lines = computeLinemanPayoutLines({
    baseSalary: requireMoneyInput(inputs.baseSalary, 'Base salary'),
    installCount: requireCountInput(inputs.installCount, 'Install count'),
    installRate: requireMoneyInput(inputs.installRate, 'Install rate'),
    visitCount: requireCountInput(inputs.visitCount, 'Visit count'),
    visitRate: requireMoneyInput(inputs.visitRate, 'Visit rate'),
    bonuses: requireMoneyInput(inputs.bonuses, 'Field bonuses'),
    advances: requireMoneyInput(inputs.advances, 'Mid-month advances')
  });
  return {
    id: linemanPayoutIdFor(linemanName, month),
    linemanName,
    month,
    paidDate,
    ...lines,
    recordedPaymentsTotal: requireMoneyInput(inputs.recordedPaymentsTotal, 'Recorded payments total'),
    recordedPaymentsCount: requireCountInput(inputs.recordedPaymentsCount, 'Recorded payments count'),
    paidFromDrawer: inputs.paidFromDrawer === true,
    note: cleanText(inputs.note, 200),
    createdAt: (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date()).toISOString()
  };
}

/**
 * Settle one (lineman, month): appends the built record to the
 * sanitized list. Settling the same lineman for the same month twice
 * is REFUSED with an error — delete the existing settlement first
 * (which reverses its posting) and settle again.
 */
export function settleLinemanPayout(payouts, inputs, referenceDate = new Date()) {
  const clean = sanitizeLinemanPayouts(payouts);
  const settlement = buildLinemanPayout(inputs, referenceDate);
  if (clean.some((row) => row.id === settlement.id)) {
    throw new Error(`${settlement.linemanName} is already settled for ${settlement.month}. Delete that settlement first to correct it.`);
  }
  return { payouts: [...clean, settlement], settlement };
}

/** Remove one settlement by id (its mirrors reverse on the next sync). */
export function deleteLinemanPayout(payouts, settlementId) {
  const clean = sanitizeLinemanPayouts(payouts);
  if (!clean.some((row) => row.id === settlementId)) throw new Error('Lineman payout settlement not found.');
  return clean.filter((row) => row.id !== settlementId);
}

/**
 * Pre-fill for the settlement form from the recorded trails. Pure:
 * the caller passes the loaded visit log, payment log and roznamcha
 * days. Counts come from the visit log; advances pre-fill with the
 * month's recorded lineman payments (the upad trail); the name
 * pre-fills with the most frequent lineman named on roznamcha
 * outflows; the base salary pre-fills with the recorded payroll
 * constant unless the caller passes another default.
 */
export function buildLinemanPayoutPrefill({
  visits = [],
  payments = [],
  roznamchaDays = [],
  month,
  baseSalary = SAAD_BASE_MONTHLY_SALARY
} = {}) {
  const cleanMonth = MONTH_RE.test(String(month || '')) ? String(month) : '';
  const cleanVisits = sanitizeSaadVisits(visits);
  const cleanPayments = sanitizeSaadPayments(payments);
  let installCount = 0;
  let visitCount = 0;
  for (const visit of cleanVisits) {
    if (!cleanMonth || monthOf(visit.date) !== cleanMonth) continue;
    if (visit.type === 'install') installCount += 1;
    else visitCount += 1;
  }
  let recordedPaymentsTotal = 0;
  let recordedPaymentsCount = 0;
  for (const payment of cleanPayments) {
    if (!cleanMonth || monthOf(payment.date) !== cleanMonth) continue;
    recordedPaymentsTotal += payment.amount;
    recordedPaymentsCount += 1;
  }
  const nameCounts = new Map();
  for (const day of Array.isArray(roznamchaDays) ? roznamchaDays : []) {
    for (const outflow of Array.isArray(day?.outflows) ? day.outflows : []) {
      const name = cleanText(outflow?.lineman, 100);
      if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }
  }
  let linemanName = '';
  let best = 0;
  for (const [name, count] of nameCounts) {
    if (count > best) { best = count; linemanName = name; }
  }
  return {
    linemanName,
    month: cleanMonth,
    baseSalary: wholeRupees(baseSalary),
    installCount,
    visitCount,
    advances: wholeRupees(recordedPaymentsTotal),
    recordedPaymentsTotal: wholeRupees(recordedPaymentsTotal),
    recordedPaymentsCount
  };
}

/** Notes text for a mirrored expense — keeps the verbatim settlement facts. */
export function buildLinemanPayoutExpenseNotes(settlement) {
  const head = `Lineman monthly settlement · ${settlement.linemanName} · ${settlement.month}`;
  return (settlement.note ? `${head} — ${settlement.note}` : head).slice(0, 1000);
}

/** Note text for a mirrored drawer outflow (roznamcha caps notes at 200). */
export function buildLinemanPayoutOutflowNote(settlement) {
  const head = `Monthly settlement ${settlement.month} · ${settlement.id}`;
  return (settlement.note ? `${head} — ${settlement.note}` : head).slice(0, 200);
}

function syncedLinemanPayoutExpenseRow(settlement, existing, referenceDate) {
  const fields = {
    date: settlement.paidDate,
    amount: settlement.netPayable,
    category: LINEMAN_PAYOUT_EXPENSE_CATEGORY,
    notes: buildLinemanPayoutExpenseNotes(settlement),
    area: '',
    linemanPayoutId: settlement.id,
    source: 'lineman-payout'
  };
  if (!existing) {
    return { id: syncedLinemanPayoutExpenseId(settlement.id), ...fields, createdAt: new Date(referenceDate).toISOString() };
  }
  const drifted = existing.date !== fields.date || existing.amount !== fields.amount
    || existing.category !== fields.category || existing.notes !== fields.notes
    || existing.source !== 'lineman-payout';
  return drifted ? { ...existing, ...fields, updatedAt: new Date(referenceDate).toISOString() } : existing;
}

function syncedLinemanPayoutOutflow(settlement) {
  return {
    id: syncedLinemanPayoutOutflowId(settlement.id),
    category: LINEMAN_PAYOUT_DRAWER_CATEGORY,
    amount: settlement.netPayable,
    lineman: settlement.linemanName,
    note: buildLinemanPayoutOutflowNote(settlement)
  };
}

function samePayoutOutflow(a, b) {
  return a && b && a.category === b.category && a.amount === b.amount
    && a.lineman === b.lineman && a.note === b.note;
}

/**
 * Reconcile the Expenses ledger and the roznamcha day ledger with the
 * recorded lineman settlements — the SISP-56 convergent shape. The
 * settlement list is the source of truth:
 * - every settlement with netPayable > 0 owns exactly ONE expense row
 *   (category 'Salary — Saad', keyed by linemanPayoutId + deterministic
 *   id); drifted mirrors are restored, a deleted settlement's mirror
 *   is removed, duplicates collapse to one;
 * - a drawer-paid settlement additionally owns exactly ONE roznamcha
 *   outflow (deterministic id). Manual expenses (no linemanPayoutId)
 *   and manual outflows (no lineman-payout- id) are never touched;
 * - a CLOSED roznamcha day is never mutated: a drawer payout whose day
 *   is closed keeps only its expense mirror and is counted in
 *   drawerSkippedClosed;
 * - idempotent: running it on already-synced ledgers returns
 *   changed: false with the identical array references.
 * Pure: never mutates its inputs.
 */
export function syncLinemanPayoutLedgers(expenses, days, payouts, referenceDate = new Date()) {
  const cleanPayouts = sanitizeLinemanPayouts(payouts);

  // --- Expenses side: one mirror row per payable settlement.
  const desired = new Map(
    cleanPayouts.filter((row) => row.netPayable > 0).map((row) => [row.id, row])
  );
  const currentExpenses = Array.isArray(expenses) ? expenses : [];
  const seen = new Set();
  let added = 0;
  let updated = 0;
  let removed = 0;
  const nextExpenses = [];
  for (const row of currentExpenses) {
    const payoutId = typeof row?.linemanPayoutId === 'string' && row.linemanPayoutId ? row.linemanPayoutId : null;
    if (!payoutId) { nextExpenses.push(row); continue; }
    const want = desired.get(payoutId);
    if (!want || seen.has(payoutId)) { removed += 1; continue; }
    seen.add(payoutId);
    const synced = syncedLinemanPayoutExpenseRow(want, row, referenceDate);
    if (synced !== row) updated += 1;
    nextExpenses.push(synced);
  }
  for (const [payoutId, want] of desired) {
    if (seen.has(payoutId)) continue;
    seen.add(payoutId);
    nextExpenses.push(syncedLinemanPayoutExpenseRow(want, null, referenceDate));
    added += 1;
  }
  const expensesChanged = added + updated + removed > 0;

  // --- Roznamcha side: one outflow per drawer-paid payable settlement.
  const drawerDesired = new Map(
    cleanPayouts
      .filter((row) => row.netPayable > 0 && row.paidFromDrawer)
      .map((row) => [syncedLinemanPayoutOutflowId(row.id), row])
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
  // Pass 1: drop or repair existing payout-owned outflows in OPEN days.
  const present = new Set();
  currentDays.forEach((day, dayIndex) => {
    if (!day || day.closed === true || !Array.isArray(day.outflows)) return;
    for (const outflow of day.outflows) {
      const outflowId = typeof outflow?.id === 'string' ? outflow.id : '';
      if (!outflowId.startsWith(LINEMAN_PAYOUT_ID_PREFIX)) continue;
      const want = drawerDesired.get(outflowId);
      if (!want || want.paidDate !== day.date) {
        const target = writableDays()[dayIndex];
        target.outflows = target.outflows.filter((o) => o.id !== outflowId);
        drawerRemoved += 1;
        continue;
      }
      present.add(outflowId);
      const clean = syncedLinemanPayoutOutflow(want);
      if (!samePayoutOutflow(outflow, clean)) {
        const target = writableDays()[dayIndex];
        target.outflows = target.outflows.map((o) => (o.id === outflowId ? clean : o));
        drawerUpdated += 1;
      }
    }
  });
  // Pass 2: add missing outflows; a closed target day is reported,
  // never mutated.
  for (const [outflowId, want] of drawerDesired) {
    if (present.has(outflowId)) continue;
    const frozen = currentDays.some((d) => d && d.date === want.paidDate && Array.isArray(d.outflows)
      && d.outflows.some((o) => o.id === outflowId));
    if (frozen) { present.add(outflowId); continue; }
    const existingIndex = currentDays.findIndex((d) => d && d.date === want.paidDate);
    if (existingIndex >= 0 && currentDays[existingIndex].closed === true) {
      drawerSkippedClosed += 1;
      continue;
    }
    const target = writableDays();
    const writableIndex = target.findIndex((d) => d && d.date === want.paidDate);
    if (writableIndex >= 0) {
      target[writableIndex].outflows = [...target[writableIndex].outflows, syncedLinemanPayoutOutflow(want)];
    } else {
      target.push({ date: want.paidDate, outflows: [syncedLinemanPayoutOutflow(want)], closed: false });
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
 * The slip model for one settlement — the sanitized stored record
 * itself, so a reprint at any later date shows exactly the figures
 * that were settled. Null when the input is not a usable settlement.
 */
export function buildLinemanPayoutSlipModel(settlement) {
  const clean = sanitizeLinemanPayouts([settlement]);
  return clean.length ? clean[0] : null;
}

/** One bilingual slip line pair: [English label, Urdu label, value]. */
function slipLines(model, formatAmount) {
  const lines = [
    ['Base Salary', 'بنیادی تنخواہ', model.baseSalary],
    [`Installation Commission (${model.installCount} × ${formatAmount(model.installRate)})`, `انسٹالیشن کمیشن (${model.installCount} × ${formatAmount(model.installRate)})`, model.installCommission],
    [`Visit Commission (${model.visitCount} × ${formatAmount(model.visitRate)})`, `وزٹ کمیشن (${model.visitCount} × ${formatAmount(model.visitRate)})`, model.visitCommission],
    ['Field Bonuses', 'فیلڈ بونس', model.bonuses],
    ['Gross Earnings', 'کل کمائی', model.grossEarnings],
    ['Less: Mid-Month Advances (Upad)', 'منہا: درمیانی پیشگی (اپاد)', -model.advances]
  ];
  return lines;
}

/**
 * Printable bilingual (English / اردو) monthly settlement slip — a
 * standalone A4 black-on-white document in the house print pattern
 * (SISP-60 voucher book). Paper styling is deliberate, not an app UI
 * surface. Every figure comes from the stored settlement record.
 */
export function buildLinemanPayoutSlipHtml(settlement, {
  businessName = 'Shahdara ISP',
  businessPhone = '0300-1234567',
  areaName = 'Shahdara, Lahore',
  generatedDate = ''
} = {}) {
  const model = buildLinemanPayoutSlipModel(settlement);
  if (!model) return '';
  const formatAmount = (value) => formatLinemanPayoutPKR(value);
  const rows = slipLines(model, formatAmount)
    .map(([en, ur, value]) => `<tr><td>${escapeHtml(en)}<br><span dir="rtl" lang="ur">${escapeHtml(ur)}</span></td><td class="amount">${escapeHtml(formatAmount(value))}</td></tr>`)
    .join('');
  const excessRow = model.excessAdvance > 0
    ? `<tr class="excess"><td>Advance Carried Forward to Next Month<br><span dir="rtl" lang="ur">اضافی پیشگی اگلے مہینے منتقل</span></td><td class="amount">${escapeHtml(formatAmount(model.excessAdvance))}</td></tr>`
    : '';
  const recordedLine = model.recordedPaymentsCount > 0
    ? `<p>Recorded mid-month payments / درمیانی ریکارڈ شدہ ادائیگیاں: ${model.recordedPaymentsCount} · ${escapeHtml(formatAmount(model.recordedPaymentsTotal))}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Lineman Monthly Settlement — ${escapeHtml(model.month)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; margin: 24px; }
  .slip { max-width: 760px; margin: 0 auto; border: 2px solid #000; padding: 24px; }
  header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
  .brand { font-size: 24px; font-weight: bold; }
  h1 { font-size: 19px; margin: 8px 0 4px; }
  .meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  td { border: 1px solid #000; padding: 8px 10px; font-size: 14px; vertical-align: top; }
  td.amount { text-align: right; font-weight: bold; white-space: nowrap; width: 170px; }
  tr.net td { font-size: 16px; background: #eee; }
  .signatures { display: flex; justify-content: space-between; gap: 24px; margin-top: 48px; }
  .sig { flex: 1; border-top: 1px solid #000; padding-top: 6px; text-align: center; font-size: 13px; }
  .note { font-size: 13px; }
</style>
</head>
<body>
<article class="slip">
  <header>
    <div class="brand">${escapeHtml(businessName)}</div>
    <div>${escapeHtml(areaName)} · Tel: ${escapeHtml(businessPhone)}</div>
    <h1>Lineman Monthly Settlement Slip / لائن مین ماہانہ حساب پرچی</h1>
  </header>
  <div class="meta">
    <span><strong>Lineman / لائن مین:</strong> ${escapeHtml(model.linemanName)}</span>
    <span><strong>Month / مہینہ:</strong> ${escapeHtml(model.month)}</span>
    <span><strong>Paid Date / تاریخ ادائیگی:</strong> ${escapeHtml(model.paidDate)}</span>
    <span><strong>Ref:</strong> ${escapeHtml(model.id)}</span>
  </div>
  <table>
    ${rows}
    ${excessRow}
    <tr class="net"><td>Net Payable / قابل ادا خالص رقم</td><td class="amount">${escapeHtml(formatAmount(model.netPayable))}</td></tr>
  </table>
  ${recordedLine}
  ${model.note ? `<p class="note">Note / نوٹ: ${escapeHtml(model.note)}</p>` : ''}
  ${generatedDate ? `<p class="note">Generated / تیار کردہ: ${escapeHtml(generatedDate)}</p>` : ''}
  <div class="signatures">
    <div class="sig">Signature — Lineman / دستخط — لائن مین<br>(${escapeHtml(model.linemanName)})</div>
    <div class="sig">Signature — Owner / Partner / دستخط — مالک / پارٹنر</div>
  </div>
</article>
</body>
</html>`;
}

/**
 * Wires the Lineman Payout dialog (index.html #linemanPayoutModal).
 * The controller owns only the settlement store; the caller passes
 * onChanged so app.js can run the ledger sync (Expenses + Roznamcha)
 * and re-render, exactly like the Saad payment sync wiring.
 */
export function setupLinemanPayoutModal({ loadRoznamchaDays = () => [], onChanged, onToast } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('linemanPayoutModal');
  if (!dialog) return null;
  const $ = (id) => document.getElementById(id);
  const openBtn = $('openLinemanPayoutBtn');
  const closeBtn = $('linemanPayoutCloseBtn');
  const form = $('linemanPayoutForm');
  const prefillBtn = $('linPayoutPrefillBtn');
  const totalsEl = $('linPayoutTotals');
  const advancesHintEl = $('linPayoutAdvancesHint');
  const listEl = $('linemanPayoutList');
  const fields = {
    linemanName: $('linPayoutName'),
    month: $('linPayoutMonth'),
    paidDate: $('linPayoutPaidDate'),
    baseSalary: $('linPayoutBaseSalary'),
    installCount: $('linPayoutInstallCount'),
    installRate: $('linPayoutInstallRate'),
    visitCount: $('linPayoutVisitCount'),
    visitRate: $('linPayoutVisitRate'),
    bonuses: $('linPayoutBonuses'),
    advances: $('linPayoutAdvances'),
    paidFromDrawer: $('linPayoutFromDrawer'),
    note: $('linPayoutNote')
  };

  const toast = (message) => { if (typeof onToast === 'function') onToast(message); };
  const currentMonth = () => pakistanDateToday().slice(0, 7);
  const prefillFor = (month) => buildLinemanPayoutPrefill({
    visits: loadSaadVisits(),
    payments: loadSaadPayments(),
    roznamchaDays: loadRoznamchaDays(),
    month
  });

  const readForm = () => ({
    linemanName: fields.linemanName?.value || '',
    month: fields.month?.value || '',
    paidDate: fields.paidDate?.value || '',
    baseSalary: fields.baseSalary?.value ?? '',
    installCount: fields.installCount?.value ?? '',
    installRate: fields.installRate?.value ?? '',
    visitCount: fields.visitCount?.value ?? '',
    visitRate: fields.visitRate?.value ?? '',
    bonuses: fields.bonuses?.value ?? '',
    advances: fields.advances?.value ?? '',
    paidFromDrawer: fields.paidFromDrawer?.checked === true,
    note: fields.note?.value || ''
  });

  const renderTotals = () => {
    if (!totalsEl) return;
    let lines;
    try {
      lines = computeLinemanPayoutLines(readForm());
    } catch {
      totalsEl.textContent = '';
      return;
    }
    const parts = [
      `${t('linpayout_gross')}: ${formatLinemanPayoutPKR(lines.grossEarnings)}`,
      `${t('linpayout_net_payable')}: ${formatLinemanPayoutPKR(lines.netPayable)}`
    ];
    if (lines.excessAdvance > 0) {
      parts.push(`${t('linpayout_excess_advance')}: ${formatLinemanPayoutPKR(lines.excessAdvance)}`);
    }
    totalsEl.textContent = parts.join(' · ');
  };

  const applyPrefill = (force = false) => {
    const month = fields.month?.value || currentMonth();
    const prefill = prefillFor(month);
    const setIf = (el, value) => {
      if (!el) return;
      if (force || el.value === '' || el.value === null) el.value = value;
    };
    setIf(fields.linemanName, prefill.linemanName);
    setIf(fields.baseSalary, prefill.baseSalary || '');
    setIf(fields.installCount, prefill.installCount);
    setIf(fields.visitCount, prefill.visitCount);
    setIf(fields.advances, prefill.advances || '');
    if (advancesHintEl) {
      advancesHintEl.textContent = prefill.recordedPaymentsCount > 0
        ? t('linpayout_advances_hint', null, {
          count: prefill.recordedPaymentsCount,
          total: formatLinemanPayoutPKR(prefill.recordedPaymentsTotal)
        })
        : t('linpayout_advances_none');
    }
    renderTotals();
    return prefill;
  };

  const renderList = () => {
    if (!listEl) return;
    const payouts = loadLinemanPayouts()
      .slice()
      .sort((a, b) => b.month.localeCompare(a.month) || a.linemanName.localeCompare(b.linemanName));
    if (!payouts.length) {
      listEl.innerHTML = `<p class="lineman-payout-empty">${escapeHtml(t('linpayout_empty_list'))}</p>`;
      return;
    }
    listEl.innerHTML = payouts.map((row) => `<div class="lineman-payout-row">
      <span>${escapeHtml(row.linemanName)} · ${escapeHtml(row.month)} · ${escapeHtml(row.id)}</span>
      <strong>${escapeHtml(formatLinemanPayoutPKR(row.netPayable))}</strong>
      <button type="button" class="secondary-button" data-linpayout-print="${escapeHtml(row.id)}">${escapeHtml(t('linpayout_print_btn'))}</button>
      <button type="button" class="secondary-button" data-linpayout-delete="${escapeHtml(row.id)}">${escapeHtml(t('linpayout_delete_btn'))}</button>
    </div>`).join('');
  };

  const render = () => { renderList(); renderTotals(); };

  const printSettlement = (settlement) => {
    const generatedDate = pakistanDateToday();
    const html = buildLinemanPayoutSlipHtml(settlement, { generatedDate });
    const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } else {
      toast(t('linpayout_popup_blocked'));
    }
  };

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (fields.month && !fields.month.value) fields.month.value = currentMonth();
      if (fields.paidDate && !fields.paidDate.value) fields.paidDate.value = pakistanDateToday();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.hidden = false;
      applyPrefill(false);
      render();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.hidden = true;
    });
  }
  if (prefillBtn) prefillBtn.addEventListener('click', () => applyPrefill(true));
  if (fields.month) fields.month.addEventListener('change', () => applyPrefill(true));
  for (const el of Object.values(fields)) {
    if (el) el.addEventListener('input', renderTotals);
  }
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const inputs = readForm();
      // Recorded upad facts always come fresh from the payments trail
      // for the settled month; the advances FIGURE is the form's own
      // (pre-filled from that trail, owner-adjustable).
      const prefill = prefillFor(inputs.month);
      try {
        const { payouts } = settleLinemanPayout(loadLinemanPayouts(), {
          ...inputs,
          recordedPaymentsTotal: prefill.recordedPaymentsTotal,
          recordedPaymentsCount: prefill.recordedPaymentsCount
        });
        saveLinemanPayouts(payouts);
        if (typeof onChanged === 'function') onChanged();
        toast(t('linpayout_settled_ok'));
        render();
      } catch (error) {
        if (String(error?.message || '').includes('already settled')) {
          toast(t('linpayout_duplicate', null, { month: inputs.month }));
        } else {
          toast(String(error?.message || error));
        }
      }
    });
  }
  if (listEl) {
    listEl.addEventListener('click', (event) => {
      const printBtn = event.target.closest('[data-linpayout-print]');
      const deleteBtn = event.target.closest('[data-linpayout-delete]');
      if (printBtn) {
        const settlement = loadLinemanPayouts().find((row) => row.id === printBtn.getAttribute('data-linpayout-print'));
        if (settlement) printSettlement(settlement);
        return;
      }
      if (deleteBtn) {
        try {
          const next = deleteLinemanPayout(loadLinemanPayouts(), deleteBtn.getAttribute('data-linpayout-delete'));
          saveLinemanPayouts(next);
          if (typeof onChanged === 'function') onChanged();
          toast(t('linpayout_deleted_ok'));
          render();
        } catch (error) {
          toast(String(error?.message || error));
        }
      }
    });
  }
  return { render };
}
