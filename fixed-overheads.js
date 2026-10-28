/**
 * fixed-overheads.js — SISP-27: Upstream ISP Bandwidth Bill & Fixed
 * Monthly Overhead Tracker.
 *
 * Problem: to compute a TRUE monthly net profit for partners Nasir and
 * Aqib (50/50), recurring fixed ISP overheads need structured monthly
 * tracking with unpaid due alerts. Before this module, a forgotten
 * upstream bandwidth bill silently overstated profit — and therefore
 * both partners' shares.
 *
 * What this module is:
 * - Four recurring overhead templates (localStorage key sisp_overheads_v1):
 *   Upstream Bandwidth Link, OLT Room WAPDA Bill, Lineman Salary and
 *   Maintenance Reserve. Each template carries the expense-ledger
 *   category it posts into plus an editable default amount. Templates
 *   are never seeded into storage: the four built-ins are the default
 *   view, and storage holds only the operator's default-amount
 *   overrides plus posting records.
 * - 1-click post into the selected month's expense ledger: posting runs
 *   through phase3.js addExpense, so the amount lands in state.expenses
 *   exactly like any hand-recorded expense — and therefore flows into
 *   the existing buildPartnerShareReport profit/share computation
 *   (phase3.js, PARTNER_SHARE_RATE = 0.5) with NO second profit
 *   formula anywhere in this module. A posting is refused when a live
 *   posting already exists for the same template and month; a posting
 *   whose expense was later deleted from the ledger is stale and does
 *   NOT block a re-post.
 * - Dashboard due banner: the current month's upstream bandwidth bill
 *   counts as paid when a live posting exists for it OR when an expense
 *   with its category ('Nayatel bill') is dated in the current month —
 *   so an operator who records the bill directly in the ledger also
 *   clears the banner. Anything else leaves the banner up.
 *
 * Backup: the stored {templates, postings} object travels in JSON
 * backups via the `settings.overheads` section (see core.js), under the
 * same safe-merge rule as the monthly closing notes: adopted only when
 * this device has none stored yet; differing records on both sides are
 * kept as a conflict, never overwritten.
 *
 * This module imports phase3.js only (addExpense, categories, PKT
 * month). It never imports core.js (core imports the sanitizer from
 * here for backup restore — the reverse would be a module cycle).
 * Tests use synthetic data only.
 */

import { addExpense, EXPENSE_CATEGORIES, pktMonth } from './phase3.js';

export const OVERHEAD_KEY = 'sisp_overheads_v1';
export const UPSTREAM_TEMPLATE_ID = 'upstream-bandwidth';

export const OVERHEAD_TEMPLATES = Object.freeze([
  { id: 'upstream-bandwidth', label: 'Upstream Bandwidth Link', category: 'Nayatel bill' },
  { id: 'olt-wapda', label: 'OLT Room WAPDA Bill', category: 'Electricity' },
  { id: 'lineman-salary', label: 'Lineman Salary', category: 'Salary — Saad' },
  { id: 'maintenance-reserve', label: 'Maintenance Reserve', category: 'Other expenses' },
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const TEMPLATE_IDS = new Set(OVERHEAD_TEMPLATES.map(template => template.id));

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const cleanText = value => (typeof value === 'string' ? value.trim() : '');
const validAmount = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null;
};
const validDate = value => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

function templateById(id) {
  return OVERHEAD_TEMPLATES.find(template => template.id === id) ?? null;
}

/** Clean a stored {templates, postings} object; unknown/invalid rows are dropped. */
export function sanitizeOverheads(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { templates: [], postings: [] };
  const templates = [];
  if (Array.isArray(value.templates)) {
    for (const row of value.templates) {
      if (!row || typeof row !== 'object' || !TEMPLATE_IDS.has(row.id)) continue;
      if (templates.some(entry => entry.id === row.id)) continue;
      const amount = row.defaultAmount === null || row.defaultAmount === undefined || row.defaultAmount === ''
        ? null
        : validAmount(row.defaultAmount);
      if (row.defaultAmount !== null && row.defaultAmount !== undefined && row.defaultAmount !== '' && amount === null) continue;
      templates.push({ id: row.id, defaultAmount: amount });
    }
  }
  const postings = [];
  if (Array.isArray(value.postings)) {
    for (const row of value.postings) {
      if (!row || typeof row !== 'object' || !TEMPLATE_IDS.has(row.templateId)) continue;
      if (typeof row.month !== 'string' || !MONTH_RE.test(row.month)) continue;
      const amount = validAmount(row.amount);
      if (amount === null || !validDate(row.date)) continue;
      postings.push({
        id: typeof row.id === 'string' && row.id ? row.id : '',
        templateId: row.templateId,
        month: row.month,
        expenseId: typeof row.expenseId === 'string' ? row.expenseId : '',
        amount,
        date: row.date,
        note: cleanText(row.note).slice(0, 500),
      });
    }
  }
  return { templates, postings };
}

export function loadOverheads() {
  try {
    if (typeof localStorage === 'undefined') return { templates: [], postings: [] };
    const raw = localStorage.getItem(OVERHEAD_KEY);
    if (!raw) return { templates: [], postings: [] };
    return sanitizeOverheads(JSON.parse(raw));
  } catch {
    return { templates: [], postings: [] };
  }
}

export function saveOverheads(data) {
  const cleaned = sanitizeOverheads(data);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(OVERHEAD_KEY, JSON.stringify(cleaned));
  } catch { /* storage unavailable — the expense ledger entry itself is unaffected */ }
  return cleaned;
}

/** Built-in templates with the operator's stored default amounts applied. */
export function resolveOverheadTemplates(data) {
  const cleaned = sanitizeOverheads(data);
  return OVERHEAD_TEMPLATES.map(template => {
    const override = cleaned.templates.find(entry => entry.id === template.id);
    return { ...template, defaultAmount: override ? override.defaultAmount : null };
  });
}

/** Set (or clear with null) a template's default amount. Returns new sanitized data. */
export function updateOverheadDefault(data, templateId, defaultAmount) {
  if (!templateById(templateId)) throw new Error('Unknown overhead template.');
  const cleaned = sanitizeOverheads(data);
  const amount = defaultAmount === null || defaultAmount === undefined || defaultAmount === ''
    ? null
    : validAmount(defaultAmount);
  if (amount === null && defaultAmount !== null && defaultAmount !== undefined && defaultAmount !== '') {
    throw new Error('Default amount must be greater than zero.');
  }
  const templates = cleaned.templates.filter(entry => entry.id !== templateId);
  if (amount !== null) templates.push({ id: templateId, defaultAmount: amount });
  return { templates, postings: cleaned.postings };
}

/**
 * The live posting for a template + month: the first posting whose
 * expense still exists in the ledger. A posting whose expense was
 * deleted is stale — it is returned as null, never as paid.
 */
export function overheadPostingFor(data, state, templateId, month) {
  const cleaned = sanitizeOverheads(data);
  const expenseIds = new Set((state?.expenses ?? []).map(row => row.id));
  return cleaned.postings.find(row => row.templateId === templateId && row.month === month && expenseIds.has(row.expenseId)) ?? null;
}

/**
 * Post one overhead into the expense ledger. Returns { state, overheads }.
 * Refuses a second live posting for the same template + month.
 * Profit/share effects come entirely from buildPartnerShareReport reading
 * the new expense — nothing is recomputed here.
 */
export function postOverhead(state, data, templateId, fields) {
  const template = templateById(templateId);
  if (!template) throw new Error('Unknown overhead template.');
  if (!EXPENSE_CATEGORIES.includes(template.category)) throw new Error(`Overhead category "${template.category}" is not a valid expense category.`);
  const amount = validAmount(fields?.amount);
  if (amount === null) throw new Error('Enter a positive overhead amount.');
  const date = fields?.date;
  if (!validDate(date)) throw new Error('Enter a valid payment date (PKT).');
  const month = date.slice(0, 7);
  const cleaned = sanitizeOverheads(data);
  if (overheadPostingFor(cleaned, state, templateId, month)) {
    throw new Error(`${template.label} is already posted for ${month}.`);
  }
  const note = cleanText(fields?.note).slice(0, 500);
  const expenseNotes = note ? `Fixed overhead: ${template.label} — ${note}` : `Fixed overhead: ${template.label}`;
  const nextState = addExpense(state ?? {}, { date, category: template.category, amount, notes: expenseNotes });
  const postedExpense = nextState.expenses[nextState.expenses.length - 1];
  const posting = {
    id: makeId(),
    templateId,
    month,
    expenseId: postedExpense.id,
    amount,
    date,
    note,
  };
  return { state: nextState, overheads: { templates: cleaned.templates, postings: [...cleaned.postings, posting] } };
}

/**
 * Dashboard due status for the current month's upstream bandwidth bill.
 * Paid = a live posting exists, or a same-category expense is dated in
 * the current month (an operator who records the bill directly in the
 * ledger also clears the banner).
 */
export function bandwidthDueStatus(state, data, referenceDate = new Date()) {
  const month = pktMonth(referenceDate);
  const template = templateById(UPSTREAM_TEMPLATE_ID);
  const posting = overheadPostingFor(data, state, UPSTREAM_TEMPLATE_ID, month);
  const directExpense = (state?.expenses ?? []).some(row =>
    row.category === template.category && typeof row.date === 'string' && row.date.slice(0, 7) === month);
  const paid = Boolean(posting || directExpense);
  return {
    due: !paid,
    month,
    templateId: UPSTREAM_TEMPLATE_ID,
    templateLabel: template.label,
    category: template.category,
    paid,
    paidVia: posting ? 'posting' : (directExpense ? 'expense' : null),
    posting,
  };
}
