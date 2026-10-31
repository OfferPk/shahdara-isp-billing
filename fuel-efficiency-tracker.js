/**
 * fuel-efficiency-tracker.js — SISP-112 [P1-HIGH]: Lineman Petrol vs.
 * Field Activity Efficiency Calculator.
 *
 * Problem: petrol is burned every day in the field, but nobody could see
 * what one field job actually costs in fuel, or spot days where petrol
 * was spent with no field work recorded at all.
 *
 * COUNTING DEFINITIONS — only fields that really exist in the data
 * model are used (the SISP-39 scorecard precedents are followed):
 * - Petrol: roznamcha.js (SISP-11) day outflows whose category is the
 *   petrol entry of the app's own ROZNAMCHA_CATEGORIES catalogue
 *   (derived live by matching /petrol/i — never a hardcoded category
 *   list of our own). Roznamcha petrol ALSO mirrors into the Expenses
 *   ledger as an 'Other expenses' row (syncRoznamchaExpenses), so the
 *   Expenses ledger is deliberately NOT read here — counting it would
 *   double every roznamcha rupee, and standalone expense rows carry no
 *   petrol category in this app anyway.
 * - Field Collections: bill payments recorded in the month. Payments
 *   carry no field-vs-office flag (SISP-39 finding), so every recorded
 *   collection counts — Field Mode, Quick Collect and shop collections
 *   all land as bill payments. Voided payments (SISP-34,
 *   isVoidedPayment) are not receipts and never count.
 * - Saad Visits: saad-visits.js log entries dated inside the month
 *   (visitsForMonth semantics: the sanitizer + the visit's own date).
 * - Resolved Tickets: the SISP-39 union rule, team-wide — a resolved
 *   SISP-12 ticket keyed by its linked SISP-15 complaint when it has
 *   one, plus resolved register complaints keyed by their own id, so a
 *   ticket + register pair for the same job counts ONCE, never twice.
 *   Resolution month comes from each record's own resolvedAt.
 * - Unmatched Fuel Day: a date inside the month whose petrol total is
 *   > 0 while that date saw zero field activity (no non-voided payment,
 *   no Saad visit, no ticket/complaint resolution).
 *
 * Read-only calculator: no storage key, no writes, nothing cached.
 * Every figure is derived live from the recorded ledgers on each call.
 * All builders are pure; the dashboard card is rendered by app.js from
 * buildFuelEfficiency + fuelEfficiencyCardHtml.
 */

import { ROZNAMCHA_CATEGORIES, formatRoznamchaPKR, loadRoznamchaDays, sanitizeRoznamchaDays } from './roznamcha.js';
import { loadSaadVisits, sanitizeSaadVisits } from './saad-visits.js';
import { loadTickets, sanitizeTickets } from './complaint-tickets.js';
import { loadComplaints, sanitizeComplaints } from './complaint-register.js';
import { isVoidedPayment } from './payment-void-audit.js';
import { t } from './nav-language.js';

const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round(moneyValue(value) * 100) / 100;
}

function zonedParts(date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PAKISTAN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
}

/** YYYY-MM in Pakistan time. */
export function fuelMonthNow(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}`;
}

/** A valid YYYY-MM month string, or the current PKT month as fallback. */
export function normalizeFuelMonth(month, referenceDate = new Date()) {
  return MONTH_RE.test(String(month || '')) ? String(month) : fuelMonthNow(referenceDate);
}

/**
 * The petrol category, derived live from the app's own roznamcha
 * category catalogue (the entry matching /petrol/i). Returns null when
 * the catalogue has no petrol entry — petrol then honestly totals 0.
 */
export function fuelPetrolCategory() {
  const categories = Array.isArray(ROZNAMCHA_CATEGORIES) ? ROZNAMCHA_CATEGORIES : [];
  return categories.find((category) => /petrol/i.test(String(category || ''))) || null;
}

/** PKR rendering shared with the roznamcha surfaces. */
export function formatFuelPKR(value) {
  return formatRoznamchaPKR(value);
}

function monthOfDate(value) {
  const text = String(value || '');
  return DATE_RE.test(text) ? text.slice(0, 7) : '';
}

function dateOfDateTime(value) {
  const text = String(value || '');
  return DATE_RE.test(text.slice(0, 10)) ? text.slice(0, 10) : '';
}

function monthOfDateTime(value) {
  const date = dateOfDateTime(value);
  return date ? date.slice(0, 7) : '';
}

/**
 * The monthly fuel-efficiency bundle.
 *
 * @param {{state?: object, roznamchaDays?: Array, saadVisits?: Array,
 *   tickets?: Array, complaints?: Array}} sources — live ledgers; any
 *   missing source simply contributes zeros.
 * @param {string} month YYYY-MM
 * @returns {{month: string, petrolCategory: string|null,
 *   petrolTotal: number, petrolDays: Array<{date, amount}>,
 *   fieldCollections: number, fieldCollectionAmount: number,
 *   saadVisits: number, resolvedTickets: number, totalJobs: number,
 *   fuelCostPerJob: number|null,
 *   unmatchedFuelDays: Array<{date, amount}>}}
 *   fuelCostPerJob is null when the month has no field jobs (never a
 *   fabricated 0 or Infinity).
 */
export function buildFuelEfficiency(sources = {}, month, referenceDate = new Date()) {
  const targetMonth = normalizeFuelMonth(month, referenceDate);
  const petrolCategory = fuelPetrolCategory();
  const state = sources?.state && typeof sources.state === 'object' ? sources.state : {};
  const days = sanitizeRoznamchaDays(Array.isArray(sources?.roznamchaDays) ? sources.roznamchaDays : []);
  const visits = sanitizeSaadVisits(Array.isArray(sources?.saadVisits) ? sources.saadVisits : []);
  const tickets = sanitizeTickets(Array.isArray(sources?.tickets) ? sources.tickets : []);
  const complaints = sanitizeComplaints(Array.isArray(sources?.complaints) ? sources.complaints : []);

  // Per-date activity presence for the unmatched-day flag.
  const activity = new Map();
  const markActivity = (date, kind) => {
    if (!date) return;
    if (!activity.has(date)) activity.set(date, { collections: 0, visits: 0, resolved: 0 });
    activity.get(date)[kind] += 1;
  };

  // Petrol: roznamcha outflows in the petrol category, per day + total.
  const petrolByDate = new Map();
  for (const day of days) {
    if (monthOfDate(day.date) !== targetMonth) continue;
    let dayPetrol = 0;
    for (const outflow of (day.outflows || [])) {
      if (petrolCategory && outflow.category === petrolCategory) {
        dayPetrol = round2(dayPetrol + moneyValue(outflow.amount));
      }
    }
    if (dayPetrol > 0) petrolByDate.set(day.date, dayPetrol);
  }
  const petrolDays = [...petrolByDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const petrolTotal = round2(petrolDays.reduce((sum, day) => sum + day.amount, 0));

  // Field Collections: non-voided bill payments dated in the month.
  let fieldCollections = 0;
  let fieldCollectionAmount = 0;
  const customers = Array.isArray(state.customers) ? state.customers : [];
  for (const customer of customers) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
        if (!payment || typeof payment !== 'object') continue;
        if (isVoidedPayment(payment)) continue;
        if (monthOfDate(payment.date) !== targetMonth) continue;
        fieldCollections += 1;
        fieldCollectionAmount = round2(fieldCollectionAmount + moneyValue(payment.amount));
        markActivity(payment.date, 'collections');
      }
    }
  }

  // Saad Visits: log entries dated in the month.
  let saadVisits = 0;
  for (const visit of visits) {
    if (monthOfDate(visit.date) !== targetMonth) continue;
    saadVisits += 1;
    markActivity(visit.date, 'visits');
  }

  // Resolved Tickets: union of resolved tickets + resolved register
  // complaints (linked pair = one job), per the SISP-39 rule.
  const resolvedKeys = new Set();
  for (const ticket of tickets) {
    if (ticket.status !== 'Resolved') continue;
    if (monthOfDateTime(ticket.resolvedAt) !== targetMonth) continue;
    resolvedKeys.add(ticket.complaintId ? `cmp:${ticket.complaintId}` : `tkt:${ticket.id}`);
    markActivity(dateOfDateTime(ticket.resolvedAt), 'resolved');
  }
  for (const complaint of complaints) {
    if (complaint.status !== 'Resolved') continue;
    if (monthOfDateTime(complaint.resolvedAt) !== targetMonth) continue;
    resolvedKeys.add(`cmp:${complaint.id}`);
    markActivity(dateOfDateTime(complaint.resolvedAt), 'resolved');
  }
  const resolvedTickets = resolvedKeys.size;

  const totalJobs = fieldCollections + saadVisits + resolvedTickets;
  const fuelCostPerJob = totalJobs > 0 ? round2(petrolTotal / totalJobs) : null;

  const unmatchedFuelDays = petrolDays.filter(({ date }) => {
    const day = activity.get(date);
    return !day || (day.collections + day.visits + day.resolved) === 0;
  });

  return {
    month: targetMonth,
    petrolCategory,
    petrolTotal,
    petrolDays,
    fieldCollections,
    fieldCollectionAmount,
    saadVisits,
    resolvedTickets,
    totalJobs,
    fuelCostPerJob,
    unmatchedFuelDays
  };
}

/** Live bundle from the real stores (dashboard wiring + tests). */
export function loadFuelEfficiency(getState, month, referenceDate = new Date()) {
  let state = null;
  try { state = typeof getState === 'function' ? getState() : null; } catch { state = null; }
  return buildFuelEfficiency({
    state,
    roznamchaDays: loadRoznamchaDays(),
    saadVisits: loadSaadVisits(),
    tickets: loadTickets(),
    complaints: loadComplaints()
  }, month, referenceDate);
}

/**
 * Dashboard card body HTML for one monthly bundle (pure; app.js sets
 * it as the card's innerHTML). All strings go through t() — the caller
 * renders with the app's current language.
 */
export function fuelEfficiencyCardHtml(summary, lang = null) {
  const s = summary && typeof summary === 'object' ? summary : {};
  const rows = [
    [t('fuel_petrol_total', lang), formatFuelPKR(s.petrolTotal || 0)],
    [t('fuel_collections', lang), String(s.fieldCollections || 0)],
    [t('fuel_visits', lang), String(s.saadVisits || 0)],
    [t('fuel_resolved', lang), String(s.resolvedTickets || 0)],
    [t('fuel_total_jobs', lang), String(s.totalJobs || 0)],
    [t('fuel_per_job', lang), s.fuelCostPerJob === null || s.fuelCostPerJob === undefined
      ? t('fuel_no_jobs', lang)
      : formatFuelPKR(s.fuelCostPerJob)]
  ];
  const statsHtml = rows
    .map(([label, value]) => `<p><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></p>`)
    .join('');
  const unmatched = Array.isArray(s.unmatchedFuelDays) ? s.unmatchedFuelDays : [];
  const unmatchedHtml = unmatched.length === 0
    ? `<p class="fuel-efficiency-ok">${escapeHtml(t('fuel_unmatched_none', lang))}</p>`
    : `<p class="fuel-efficiency-warn-title">${escapeHtml(t('fuel_unmatched_title', lang))}</p>`
      + '<ul class="fuel-efficiency-unmatched">'
      + unmatched.map((day) => `<li>${escapeHtml(t('fuel_unmatched_row', lang, { date: day.date, amount: formatFuelPKR(day.amount) }))}</li>`).join('')
      + '</ul>';
  const emptyNote = (s.petrolTotal || 0) <= 0 && (s.totalJobs || 0) <= 0
    ? `<p class="fuel-efficiency-empty">${escapeHtml(t('fuel_empty', lang))}</p>`
    : '';
  return `<div class="fuel-efficiency-stats">${statsHtml}</div>${emptyNote}${unmatchedHtml}`;
}
