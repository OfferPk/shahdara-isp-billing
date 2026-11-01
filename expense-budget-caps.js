/**
 * expense-budget-caps.js — SISP-134: Monthly Expense Category Budget
 * Caps & Over-Spend Alert (خرچ حد بندی).
 *
 * What this module is:
 * - A small owner-set monthly spending cap per expense category, stored
 *   outside the ledger state in localStorage under
 *   EXPENSE_BUDGETS_KEY (sisp_expense_budgets_v1) as a plain object
 *   { [category]: capPKR }. Only categories from the frozen
 *   EXPENSE_CATEGORIES list (phase3.js) can carry a cap — this module
 *   never invents a category. A cap is a positive whole-rupee amount;
 *   absent / zero / invalid means NO cap for that category. The store
 *   starts EMPTY: nothing is seeded.
 * - A pure builder (buildCategoryBudgetStatus) that compares the caps
 *   with the month's REAL recorded spend. Spend is aggregated with the
 *   exact inclusion rules of the P&L engine
 *   (dashboard-pnl.js calculatePnlAnalytics): rows of state.expenses
 *   whose string date falls in the month (date.slice(0, 7)), category =
 *   the row's trimmed category string with 'Other expenses' as the
 *   fallback for a blank one, amount = Number(amount) || 0. Synced rows
 *   (roznamcha petty cash, Saad payouts, supplier khata, overhead
 *   postings) are ordinary state.expenses rows, so they count exactly
 *   as the P&L counts them — there is no parallel expense scan with
 *   different rules.
 * - Alert levels per capped category, from the unrounded ratio
 *   spent / cap: 'ok' below 80%, 'warn' from 80% up to (not including)
 *   100%, 'over' at 100% and beyond. Uncapped categories report
 *   cap/pct = null and level 'none' — never an alert. pct is null
 *   whenever there is no cap, so nothing ever divides by zero or
 *   renders Infinity/NaN.
 * - Surfaces: the P&L modal (dashboard-pnl.js setupPnlModal) renders one
 *   progress bar per capped category for its selected month plus a
 *   compact caps editor; the Roznamcha modal (roznamcha.js) renders a
 *   compact callout listing only the warn/over categories for the
 *   modal's month. Everything is derived live on every render — no
 *   totals are cached anywhere.
 *
 * READ-ONLY against the ledger: caps never block, alter, or gate an
 * expense entry. The alerts are informational only; the only write this
 * feature ever performs is saving the caps object itself when the owner
 * edits it in the P&L editor. Builders and renderers mutate nothing.
 *
 * Backup: the caps object travels in JSON backups via the
 * `settings.expenseBudgets` section (see core.js), under the same
 * safe-merge rule as the fixed overheads (SISP-37 precedent): adopted
 * only when this device has none stored yet; differing caps on both
 * sides are kept as a conflict, never overwritten.
 *
 * This module imports phase3.js (categories) and nav-language.js (t)
 * only. It never imports core.js (core imports the sanitizer from here
 * for backup restore — the reverse would be a module cycle).
 * Tests use synthetic data only.
 */

import { EXPENSE_CATEGORIES } from './phase3.js';
import { t } from './nav-language.js';

export const EXPENSE_BUDGETS_KEY = 'sisp_expense_budgets_v1';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Alert thresholds on the spent/cap ratio (SISP-134 spec). */
export const BUDGET_WARN_RATIO = 0.8;
export const BUDGET_OVER_RATIO = 1;

const LEVEL_META = Object.freeze({
  ok: { emoji: '🟢', labelKey: 'ebud_level_ok' },
  warn: { emoji: '🟡', labelKey: 'ebud_level_warn' },
  over: { emoji: '🔴', labelKey: 'ebud_level_over' },
  none: { emoji: '', labelKey: '' },
});

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Whole rupees grouped, e.g. 6500 -> "PKR 6,500"; paise shown only when nonzero. */
export function formatBudgetPKR(value) {
  const number = Number(value) || 0;
  const fraction = Number.isInteger(number) ? 0 : 2;
  return `PKR ${number.toLocaleString('en-PK', { minimumFractionDigits: fraction, maximumFractionDigits: fraction })}`;
}

function validCap(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const whole = Math.round(number);
  return whole > 0 ? whole : null;
}

/**
 * Clean a stored caps object: only real EXPENSE_CATEGORIES keys with a
 * positive whole-rupee amount survive. Keys are emitted in canonical
 * EXPENSE_CATEGORIES order so equal caps always serialize identically
 * (the backup safe-merge compares canonical JSON).
 */
export function sanitizeExpenseBudgets(value) {
  const cleaned = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return cleaned;
  for (const category of EXPENSE_CATEGORIES) {
    if (!Object.hasOwn(value, category)) continue;
    const cap = validCap(value[category]);
    if (cap !== null) cleaned[category] = cap;
  }
  return cleaned;
}

export function loadExpenseBudgets(storage) {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return {};
    const raw = store.getItem(EXPENSE_BUDGETS_KEY);
    if (!raw) return {};
    return sanitizeExpenseBudgets(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveExpenseBudgets(caps, storage) {
  const cleaned = sanitizeExpenseBudgets(caps);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) store.setItem(EXPENSE_BUDGETS_KEY, JSON.stringify(cleaned));
  } catch { /* storage unavailable — caps are informational only, nothing else depends on them */ }
  return cleaned;
}

/**
 * Return a NEW caps object with one category's cap set (positive whole
 * rupees) or cleared (amount null / '' / 0). Throws on an unknown
 * category or a non-positive amount that is not a clear request. The
 * input object is never mutated.
 */
export function setExpenseBudgetCap(caps, category, amount) {
  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw new Error(`"${category}" is not a valid expense category.`);
  }
  const isClear = amount === null || amount === undefined || amount === '' || Number(amount) === 0;
  if (isClear) {
    const next = sanitizeExpenseBudgets(caps);
    delete next[category];
    return sanitizeExpenseBudgets(next);
  }
  const cap = validCap(amount);
  if (cap === null) throw new Error('Budget cap must be a positive whole number of rupees.');
  return sanitizeExpenseBudgets({ ...sanitizeExpenseBudgets(caps), [category]: cap });
}

/**
 * Monthly spend per category using EXACTLY the P&L engine's inclusion
 * rules (dashboard-pnl.js calculatePnlAnalytics): a row counts when its
 * string date falls in the month; the category is the row's trimmed
 * category string, or 'Other expenses' when blank; the amount is
 * Number(amount) || 0. Returns { [category]: spentPKR }.
 */
export function aggregateMonthlyCategorySpend(expenses, month) {
  const totals = new Map();
  if (!Array.isArray(expenses) || typeof month !== 'string' || !MONTH_RE.test(month)) return {};
  for (const exp of expenses) {
    if (!exp || typeof exp.date !== 'string' || exp.date.slice(0, 7) !== month) continue;
    const category = (typeof exp.category === 'string' && exp.category.trim())
      ? exp.category.trim()
      : 'Other expenses';
    totals.set(category, (totals.get(category) || 0) + (Number(exp.amount) || 0));
  }
  const spend = {};
  for (const [category, amount] of totals) spend[category] = Number(amount.toFixed(2));
  return spend;
}

/**
 * Pure budget status for one month. `state` may be the full app state
 * or a bare expenses array. Rows cover every capped category plus every
 * category with recorded spend in the month, ordered by
 * EXPENSE_CATEGORIES then any non-standard recorded categories
 * alphabetically (the P&L keeps any trimmed category string; such rows
 * can never carry a cap). Each row: { category, cap, spent, pct,
 * level } with cap/pct null and level 'none' when uncapped. Inputs are
 * never mutated.
 */
export function buildCategoryBudgetStatus(state, caps, month) {
  const expenses = Array.isArray(state)
    ? state
    : (state && Array.isArray(state.expenses) ? state.expenses : []);
  const cleanCaps = sanitizeExpenseBudgets(caps);
  const validMonth = typeof month === 'string' && MONTH_RE.test(month) ? month : '';
  const spend = validMonth ? aggregateMonthlyCategorySpend(expenses, validMonth) : {};

  const ordered = [];
  const seen = new Set();
  const consider = (category) => {
    if (seen.has(category)) return;
    if (!Object.hasOwn(cleanCaps, category) && !Object.hasOwn(spend, category)) return;
    seen.add(category);
    ordered.push(category);
  };
  EXPENSE_CATEGORIES.forEach(consider);
  Object.keys(spend).filter(category => !seen.has(category)).sort().forEach(consider);

  const categories = ordered.map(category => {
    const cap = Object.hasOwn(cleanCaps, category) ? cleanCaps[category] : null;
    const spent = Number((Number(spend[category]) || 0).toFixed(2));
    let pct = null;
    let level = 'none';
    if (cap !== null) {
      const ratio = spent / cap;
      pct = Number((ratio * 100).toFixed(1));
      level = ratio >= BUDGET_OVER_RATIO ? 'over' : ratio >= BUDGET_WARN_RATIO ? 'warn' : 'ok';
    }
    return { category, cap, spent, pct, level };
  });

  return {
    month: validMonth,
    categories,
    capped: categories.filter(row => row.cap !== null),
    alerts: categories.filter(row => row.level === 'warn' || row.level === 'over'),
    hasCaps: categories.some(row => row.cap !== null),
  };
}

/** Emoji + translated word label for a budget level (spec 🟢/🟡/🔴). */
export function budgetLevelMeta(level) {
  return LEVEL_META[level] ?? LEVEL_META.none;
}

function budgetBarRowHtml(row) {
  const meta = budgetLevelMeta(row.level);
  const width = row.pct === null ? 0 : Math.min(100, Math.max(0, row.pct));
  return `<div class="expense-budget-row" data-budget-level="${row.level}">
    <div class="expense-budget-row-head">
      <span class="expense-budget-name">${meta.emoji} ${escapeHtml(row.category)}</span>
      <span class="expense-budget-figures">${escapeHtml(formatBudgetPKR(row.spent))} / ${escapeHtml(formatBudgetPKR(row.cap))} · ${escapeHtml(t('ebud_pct_used', null, { pct: row.pct }))}</span>
    </div>
    <div class="expense-budget-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width}" aria-label="${escapeHtml(row.category)}">
      <div class="expense-budget-fill expense-budget-fill--${row.level}" style="width: ${width}%;"></div>
    </div>
    <span class="expense-budget-level expense-budget-level--${row.level}">${escapeHtml(t(meta.labelKey))}</span>
  </div>`;
}

/**
 * P&L surface: one progress bar per CAPPED category for the status
 * month, or the honest "no caps set" line when nothing is capped.
 */
export function renderBudgetSectionHtml(status) {
  if (!status || !status.hasCaps) {
    return `<p class="expense-budget-empty">${escapeHtml(t('ebud_no_caps'))}</p>`;
  }
  return status.capped.map(budgetBarRowHtml).join('');
}

/**
 * Roznamcha surface: compact callout listing ONLY the warn/over
 * categories for the status month. Returns '' when nothing needs
 * attention (including when no caps exist at all).
 */
export function renderBudgetAlertsHtml(status) {
  if (!status || !Array.isArray(status.alerts) || status.alerts.length === 0) return '';
  const lines = status.alerts.map(row => {
    const meta = budgetLevelMeta(row.level);
    return `<p class="expense-budget-alert-line">${meta.emoji} <strong>${escapeHtml(row.category)}</strong> — ${escapeHtml(formatBudgetPKR(row.spent))} / ${escapeHtml(formatBudgetPKR(row.cap))} (${row.pct}%) · ${escapeHtml(t(meta.labelKey))}</p>`;
  }).join('');
  return `<div class="expense-budget-alerts" role="note"><h3 class="expense-budget-alerts-title">${escapeHtml(t('ebud_alert_title'))}</h3>${lines}</div>`;
}

/**
 * P&L caps editor: one number input per real expense category (blank =
 * no cap) plus the save button. Inputs carry data-budget-cap="<category>"
 * for collectBudgetCapsFromEditor.
 */
export function renderBudgetEditorHtml(caps) {
  const clean = sanitizeExpenseBudgets(caps);
  const rows = EXPENSE_CATEGORIES.map(category => `
      <label class="expense-budget-editor-row">
        <span class="expense-budget-editor-name">${escapeHtml(category)}</span>
        <input class="expense-budget-editor-input" type="number" min="0" step="1" inputmode="numeric" data-budget-cap="${escapeHtml(category)}" value="${Object.hasOwn(clean, category) ? clean[category] : ''}" placeholder="—" aria-label="${escapeHtml(category)}">
      </label>`).join('');
  return `<div class="expense-budget-editor">
    <h4 class="expense-budget-editor-title">${escapeHtml(t('ebud_editor_title'))}</h4>
    <p class="expense-budget-hint">${escapeHtml(t('ebud_editor_hint'))}</p>
    <div class="expense-budget-editor-grid">${rows}
    </div>
    <button id="pnlBudgetSaveBtn" class="secondary-button" type="button">${escapeHtml(t('ebud_save_btn'))}</button>
  </div>`;
}

/**
 * Read the editor inputs under `root` into a fresh caps object. Blank,
 * zero, negative or non-numeric inputs mean "no cap" — the editor never
 * blocks on a bad value, it simply leaves that category uncapped.
 */
export function collectBudgetCapsFromEditor(root) {
  const caps = {};
  if (!root || typeof root.querySelectorAll !== 'function') return caps;
  root.querySelectorAll('[data-budget-cap]').forEach(input => {
    const category = input.getAttribute('data-budget-cap');
    if (!EXPENSE_CATEGORIES.includes(category)) return;
    const cap = validCap(input.value);
    if (cap !== null) caps[category] = cap;
  });
  return sanitizeExpenseBudgets(caps);
}
