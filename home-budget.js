/**
 * home-budget.js — Home Budget: the owner's PERSONAL household expense ledger.
 *
 * Problem: the owner also pays household bills (shops, milk, electricity,
 * plumber, electrician, weddings, funerals) but the app only had the BUSINESS
 * expense ledger. Recording home spending there would corrupt profit and the
 * Nasir/Aqib partner shares, so home money gets its own ledger instead.
 *
 * Separation, by construction:
 * - Records live in localStorage under HOME_BUDGET_KEY (sisp_home_budget_v1),
 *   never in the business ledger state (state.expenses) and never under the
 *   business storage key. No profit, partner-share, billing, or report code
 *   reads this key, so home spending cannot leak into business figures.
 * - Records additionally travel inside JSON backups via the
 *   `settings.homeBudget` section (see core.js createJsonBackup), under the
 *   same safe-merge rules as complaints: a backup's home entries are adopted
 *   only when this device has none stored yet.
 *
 * This module imports nothing from core.js on purpose: core.js imports
 * sanitizeHomeBudget from here for backup restore, and a core import here
 * would create a module cycle. PKT dates are small local helpers mirroring
 * core.js (Intl en-PK / Asia/Karachi).
 *
 * All helpers are pure except load/saveHomeBudgetExpenses. Tests use
 * synthetic data only.
 */

export const HOME_BUDGET_KEY = 'sisp_home_budget_v1';

/** Default categories, from the owner's own examples. Custom categories are
 *  saved with their entry and offered in the filter afterwards; the defaults
 *  are never a closed list. */
export const HOME_BUDGET_CATEGORIES = [
  'Balla shop',
  'Waseem shop',
  'Milk expense',
  'Electricity bill',
  'Plumber',
  'Electrician maintenance',
  'Wedding expense',
  'Death expense',
];

const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const ID_RE = /^HB-(\d+)$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function zonedParts(date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PAKISTAN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
}

/** "YYYY-MM-DD" in Pakistan time. */
export function pakistanDateNow(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** "YYYY-MM" in Pakistan time. */
export function pakistanMonthNow(referenceDate = new Date()) {
  return pakistanDateNow(referenceDate).slice(0, 7);
}

function isRealDate(text) {
  if (!DATE_RE.test(String(text || ''))) return false;
  const [year, month, day] = String(text).split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function toCents(amount) {
  const number = Number(amount);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
}

function fromCents(cents) {
  return Math.round(cents) / 100;
}

/** Next entry id: one above the highest existing HB-N, starting at HB-1. */
export function nextHomeBudgetId(existing) {
  let max = 0;
  for (const entry of (Array.isArray(existing) ? existing : [])) {
    if (!entry || typeof entry !== 'object') continue;
    const match = String(entry.id || '').match(ID_RE);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `HB-${max + 1}`;
}

/**
 * Drops malformed home-budget entries; keeps only known fields with safe
 * defaults so old records (missing new fields) never break the ledger.
 * A custom category is kept as-is: the defaults are suggestions, not a
 * closed list, so backup restore must never drop a custom category.
 */
export function sanitizeHomeBudget(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const id = cleanText(entry.id);
    if (!id || seen.has(id)) continue;
    if (!isRealDate(entry.date)) continue;
    const cents = toCents(entry.amount);
    if (cents === null) continue;
    const category = cleanText(entry.category);
    if (!category) continue;
    seen.add(id);
    out.push({
      id,
      date: String(entry.date),
      category: category.slice(0, 100),
      amount: fromCents(cents),
      notes: cleanText(entry.notes).slice(0, 1000)
    });
  }
  return out;
}

/** Reads home-budget records; [] on missing/corrupt storage. */
export function loadHomeBudgetExpenses(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(HOME_BUDGET_KEY);
    if (!raw) return [];
    return sanitizeHomeBudget(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists home-budget records; never throws. */
export function saveHomeBudgetExpenses(entries, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(HOME_BUDGET_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
    return true;
  } catch {
    return false;
  }
}

function validateEntryFields(fields) {
  const date = cleanText(fields?.date);
  if (!isRealDate(date)) throw new Error('Pick a valid date for the home expense.');
  const cents = toCents(fields?.amount);
  if (cents === null) throw new Error('Enter an amount above zero for the home expense.');
  const category = cleanText(fields?.category);
  if (!category) throw new Error('Pick or type a category for the home expense.');
  if (category.length > 100) throw new Error('Category must be 100 characters or fewer.');
  const notes = cleanText(fields?.notes);
  if (notes.length > 1000) throw new Error('Notes must be 1000 characters or fewer.');
  return { date, amount: fromCents(cents), category, notes };
}

/**
 * Builds a new home-budget entry. Throws on a missing/invalid date, amount,
 * or category. Custom categories pass through untouched.
 */
export function createHomeBudgetExpense(fields, existing) {
  const valid = validateEntryFields(fields);
  return { id: nextHomeBudgetId(existing), ...valid };
}

/** Appends a validated entry; returns a new list, never mutates the input. */
export function addHomeBudgetExpense(entries, fields) {
  const list = Array.isArray(entries) ? entries : [];
  return [...list, createHomeBudgetExpense(fields, list)];
}

/** Replaces one entry by id; throws when the id is not found. */
export function updateHomeBudgetExpense(entries, id, fields) {
  const list = Array.isArray(entries) ? entries : [];
  const index = list.findIndex(entry => entry && entry.id === id);
  if (index === -1) throw new Error('Home expense entry not found.');
  const valid = validateEntryFields(fields);
  const next = [...list];
  next[index] = { id, ...valid };
  return next;
}

/** Removes one entry by id; throws when the id is not found. */
export function deleteHomeBudgetExpense(entries, id) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.some(entry => entry && entry.id === id)) throw new Error('Home expense entry not found.');
  return list.filter(entry => entry.id !== id);
}

/**
 * Totals for the ledger. allTimeTotal never depends on the month filter, so
 * it stays visible no matter how many months are recorded. months lists
 * every recorded month (newest first) with its own total and entry count.
 * Amounts are summed in integer cents, so PKR totals never drift by a paisa.
 */
export function summarizeHomeBudget(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const byMonth = new Map();
  const byCategory = new Map();
  let allTimeCents = 0;
  for (const entry of list) {
    const cents = toCents(entry.amount);
    if (cents === null) continue;
    allTimeCents += cents;
    const month = String(entry.date || '').slice(0, 7);
    if (MONTH_RE.test(month)) {
      const row = byMonth.get(month) ?? { month, totalCents: 0, count: 0 };
      row.totalCents += cents;
      row.count += 1;
      byMonth.set(month, row);
    }
    const category = cleanText(entry.category) || 'Uncategorized';
    const cat = byCategory.get(category) ?? { category, totalCents: 0, count: 0 };
    cat.totalCents += cents;
    cat.count += 1;
    byCategory.set(category, cat);
  }
  const months = [...byMonth.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map(row => ({ month: row.month, total: fromCents(row.totalCents), count: row.count }));
  const categories = [...byCategory.values()]
    .sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category))
    .map(row => ({ category: row.category, total: fromCents(row.totalCents), count: row.count }));
  return { count: list.length, allTimeTotal: fromCents(allTimeCents), months, categories };
}

/** Newest first; stable by id so equal dates keep a predictable order. */
export function sortHomeBudgetEntries(entries) {
  return [...(Array.isArray(entries) ? entries : [])].sort(
    (a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id || '').localeCompare(String(a.id || ''))
  );
}

/**
 * Filters entries by month (YYYY-MM or 'all'), exact category ('all' keeps
 * everything), and a free-text search over category + notes. The month
 * filter never changes the all-time total — see summarizeHomeBudget.
 */
export function filterHomeBudget(entries, { month = 'all', category = 'all', query = '' } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const q = cleanText(query).toLowerCase();
  return list.filter(entry => {
    if (month && month !== 'all' && String(entry.date || '').slice(0, 7) !== month) return false;
    if (category && category !== 'all' && cleanText(entry.category) !== category) return false;
    if (q) {
      const haystack = `${cleanText(entry.category)} ${cleanText(entry.notes)}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Distinct months in the ledger, newest first, for the month filter. */
export function homeBudgetMonths(entries) {
  const months = new Set();
  for (const entry of (Array.isArray(entries) ? entries : [])) {
    const month = String(entry.date || '').slice(0, 7);
    if (MONTH_RE.test(month)) months.add(month);
  }
  return [...months].sort((a, b) => b.localeCompare(a));
}

/** Distinct categories in the ledger, for the category filter. */
export function homeBudgetCategories(entries) {
  const seen = new Set();
  for (const entry of (Array.isArray(entries) ? entries : [])) {
    const category = cleanText(entry.category);
    if (category) seen.add(category);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function cloneHomeBudget(value) {
  return clone(value);
}
