/**
 * collector-commission.js — SISP-93: Shop Collector & Field Lineman
 * Recovery Commission Calculator (sisp_commission_rules_v1).
 *
 * Problem: shops (Waseem Abbasi, Hassan, Balla, and any custom "Cash at X
 * shop" collector) and field linemen who recover dues currently get paid
 * informally — nothing computed what each collector earned for a month.
 * This module lets the owner configure ONE optional commission rule per
 * collector (a fixed PKR amount per receipt, or a percentage of what the
 * collector collected), computes the month's earned commission from the
 * RECORDED payments only, and posts it to Monthly Expenses in one click.
 *
 * Rules default to 0 / absent: with no rule configured the feature is
 * completely inert and no commission is ever owed or posted.
 *
 * Collectors are NEVER a hardcoded name list (SISP-75 rule): they are
 * enumerated from the recorded payments themselves —
 *   - shop collectors: the shops resolveShopCollector derives from
 *     payment methods / paidBy strings (shop-settlement.js, SISP-1), and
 *   - field collectors: the distinct non-empty `paidBy` names recorded on
 *     non-shop payments (the app's own collector attribution, see
 *     dashboard-daily-closing.js resolveCollectorName).
 * A collector named only by a stored rule (no payments yet) is listed too,
 * so a rule survives quiet months and stays editable.
 *
 * Money rules:
 *   - Voided payments (SISP-34) never count — they are history, not cash.
 *   - Receipts are counted exactly like shop-settlement counts them: one
 *     recorded payment entry on a bill, grouped by PAYMENT DATE month
 *     (the same basis as buildShopSummaries' collectedThisMonth and the
 *     partner-share revenue basis).
 *   - Percentage commission rounds to the nearest cent, the house money
 *     pattern (Math.round on cents).
 *
 * Expense posting is IDEMPOTENT: the posted expense (built through the
 * existing phase3 addExpense, category 'Other expenses') is stamped with
 * a deterministic `commissionRef` of `commission:<collectorKey>:<month>`.
 * Posting the same collector + month again finds that stamp and reports
 * "already posted" instead of creating a duplicate. The stamp travels
 * with the expense through JSON backups (validatePhase3State keeps the
 * expense spread).
 *
 * Storage: rules live in localStorage under COMMISSION_RULES_KEY
 * (sisp_commission_rules_v1) and travel inside JSON backups via the
 * `settings.commissionRules` section (see core.js createJsonBackup),
 * under the usual safe-merge rule: a restore adopts the backup's rules
 * only when this device has none stored yet, and never silently
 * overwrites differing device rules.
 *
 * This module imports nothing from core.js on purpose: core.js imports
 * sanitizeCommissionRules from here for backup restore, and a core import
 * here would create a module cycle. PKR formatting and PKT dates come
 * from shop-settlement.js, which mirrors core.js the same way.
 *
 * All helpers are pure except load/saveCommissionRules and the modal
 * setup. Tests use synthetic data only.
 */

import { collectShopPayments, resolveShopCollector, formatShopPKR, pakistanToday, pakistanMonth } from './shop-settlement.js';
import { addExpense, EXPENSE_CATEGORIES } from './phase3.js';
import { t } from './nav-language.js';

export const COMMISSION_RULES_KEY = 'sisp_commission_rules_v1';

/** Commission expenses post under the existing 'Other expenses' category. */
export const COMMISSION_EXPENSE_CATEGORY = 'Other expenses';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PER_RECEIPT = 1_000_000;

function moneyCents(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function moneyValue(cents) {
  return Math.round(cents) / 100;
}

function roundMoney(value) {
  return moneyValue(moneyCents(value));
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

/** Stable collector keys: `shop:<Shop Name>` / `field:<paidBy name>`. */
export function commissionCollectorKey(kind, label) {
  return `${kind === 'shop' ? 'shop' : 'field'}:${String(label || '').trim()}`;
}

/**
 * Flattens every NON-shop payment in the ledger state, oldest first.
 * Shop payments are shop-settlement's domain (collectShopPayments); this
 * is its field counterpart with the same traversal and the same SISP-34
 * rule: voided receipts are skipped entirely.
 */
export function collectFieldPayments(state) {
  const out = [];
  for (const customer of (state && Array.isArray(state.customers) ? state.customers : [])) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
        if (!payment || typeof payment !== 'object') continue;
        if (payment.voided === true) continue;
        if (resolveShopCollector(payment.method, payment.paidBy) !== null) continue;
        out.push({
          collector: typeof payment.paidBy === 'string' ? payment.paidBy.trim() : '',
          customerId: customer.id ?? null,
          customerNumber: customer.customerNumber ?? null,
          billMonth: bill.month ?? '',
          paymentId: payment.id ?? null,
          date: payment.date ?? '',
          amount: Number.isFinite(Number(payment.amount)) ? Number(payment.amount) : 0,
          method: payment.method ?? ''
        });
      }
    }
  }
  out.sort((a, b) => {
    const da = DATE_RE.test(a.date) ? a.date : '9999-99-99';
    const db = DATE_RE.test(b.date) ? b.date : '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    return String(a.paymentId ?? '') < String(b.paymentId ?? '') ? -1 : 1;
  });
  return out;
}

/**
 * Every collector the calculator knows about, derived from recorded
 * payments plus any stored rules. Shops first, then field collectors,
 * each alphabetical. Returns [{ key, kind, label }].
 */
export function listCommissionCollectors(state, rules = []) {
  const byKey = new Map();
  const add = (kind, label) => {
    const name = String(label || '').trim();
    if (!name) return;
    const key = commissionCollectorKey(kind, name);
    if (!byKey.has(key)) byKey.set(key, { key, kind, label: name });
  };
  for (const payment of collectShopPayments(state)) add('shop', payment.shop);
  for (const payment of collectFieldPayments(state)) add('field', payment.collector);
  for (const rule of sanitizeCommissionRules(rules)) {
    if (!byKey.has(rule.collectorKey)) {
      byKey.set(rule.collectorKey, { key: rule.collectorKey, kind: rule.kind, label: rule.label });
    }
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'shop' ? -1 : 1;
    return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
  });
}

/** Drops malformed rule entries; keeps only known fields, clamped. */
export function sanitizeCommissionRules(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const kind = entry.kind === 'shop' ? 'shop' : entry.kind === 'field' ? 'field' : null;
    if (!kind) continue;
    const label = typeof entry.label === 'string' ? entry.label.trim().slice(0, 120) : '';
    if (!label) continue;
    const collectorKey = typeof entry.collectorKey === 'string' && entry.collectorKey.trim()
      ? entry.collectorKey.trim().slice(0, 200)
      : commissionCollectorKey(kind, label);
    if (seen.has(collectorKey)) continue;
    seen.add(collectorKey);
    const perReceiptFixedRaw = Number(entry.perReceiptFixed);
    const percentageRaw = Number(entry.percentageOfCollection);
    out.push({
      collectorKey,
      kind,
      label,
      mode: entry.mode === 'percent' ? 'percent' : 'perReceipt',
      perReceiptFixed: Number.isFinite(perReceiptFixedRaw)
        ? Math.min(MAX_PER_RECEIPT, Math.max(0, roundMoney(perReceiptFixedRaw)))
        : 0,
      percentageOfCollection: Number.isFinite(percentageRaw)
        ? Math.min(100, Math.max(0, roundMoney(percentageRaw)))
        : 0
    });
  }
  return out;
}

/** The rule for one collector, or the inert default (mode perReceipt, 0). */
export function ruleForCollector(rules, collectorKey) {
  const found = sanitizeCommissionRules(rules).find((rule) => rule.collectorKey === collectorKey);
  return found || { collectorKey, kind: 'field', label: '', mode: 'perReceipt', perReceiptFixed: 0, percentageOfCollection: 0 };
}

/** Returns a NEW rules array with the collector's rule inserted/replaced. */
export function upsertCommissionRule(rules, rule) {
  const cleaned = sanitizeCommissionRules([rule]);
  if (cleaned.length === 0) return sanitizeCommissionRules(rules);
  const next = sanitizeCommissionRules(rules).filter((r) => r.collectorKey !== cleaned[0].collectorKey);
  next.push(cleaned[0]);
  return next;
}

/** Reads commission rules; [] on missing/corrupt storage. */
export function loadCommissionRules(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(COMMISSION_RULES_KEY);
    if (!raw) return [];
    return sanitizeCommissionRules(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists commission rules (sanitized); never throws. */
export function saveCommissionRules(rules, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(COMMISSION_RULES_KEY, JSON.stringify(sanitizeCommissionRules(rules)));
    return true;
  } catch {
    return false;
  }
}

/** Deterministic idempotency stamp for a collector + month posting. */
export function commissionExpenseRef(collectorKey, month) {
  return `commission:${String(collectorKey || '')}:${String(month || '')}`;
}

/** The expense a previous posting created for this collector + month. */
export function findCommissionExpense(state, collectorKey, month) {
  const ref = commissionExpenseRef(collectorKey, month);
  const expenses = state && Array.isArray(state.expenses) ? state.expenses : [];
  return expenses.find((expense) => expense && expense.commissionRef === ref) || null;
}

/**
 * Monthly commission report. Activity is grouped by PAYMENT DATE month.
 * Each row: { key, kind, label, receipts, collected, mode, perReceiptFixed,
 * percentageOfCollection, commission, posted, postedExpenseId }.
 * Rows are the union of collectors with activity in the month and
 * collectors known from payments/rules; sorted shops first, then by
 * commission earned (highest first), then label.
 */
export function buildMonthlyCommission(state, rules, month) {
  const cleanRules = sanitizeCommissionRules(rules);
  const targetMonth = typeof month === 'string' && MONTH_RE.test(month) ? month : pakistanMonth();
  const activity = new Map();
  const bump = (key, amount) => {
    const row = activity.get(key) || { receipts: 0, collectedCents: 0 };
    row.receipts += 1;
    row.collectedCents += moneyCents(amount);
    activity.set(key, row);
  };
  for (const payment of collectShopPayments(state)) {
    if (typeof payment.date === 'string' && payment.date.slice(0, 7) === targetMonth) {
      bump(commissionCollectorKey('shop', payment.shop), payment.amount);
    }
  }
  for (const payment of collectFieldPayments(state)) {
    if (!payment.collector) continue;
    if (typeof payment.date === 'string' && payment.date.slice(0, 7) === targetMonth) {
      bump(commissionCollectorKey('field', payment.collector), payment.amount);
    }
  }
  const rows = listCommissionCollectors(state, cleanRules).map((collector) => {
    const rule = ruleForCollector(cleanRules, collector.key);
    const act = activity.get(collector.key) || { receipts: 0, collectedCents: 0 };
    const collected = moneyValue(act.collectedCents);
    const commissionCents = rule.mode === 'percent'
      ? Math.round(act.collectedCents * rule.percentageOfCollection / 100)
      : act.receipts * moneyCents(rule.perReceiptFixed);
    const postedExpense = findCommissionExpense(state, collector.key, targetMonth);
    return {
      key: collector.key,
      kind: collector.kind,
      label: collector.label,
      receipts: act.receipts,
      collected,
      mode: rule.mode,
      perReceiptFixed: rule.perReceiptFixed,
      percentageOfCollection: rule.percentageOfCollection,
      commission: moneyValue(commissionCents),
      posted: postedExpense !== null,
      postedExpenseId: postedExpense ? (postedExpense.id ?? null) : null
    };
  });
  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'shop' ? -1 : 1;
    if (b.commission !== a.commission) return b.commission - a.commission;
    return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
  });
  return {
    month: targetMonth,
    rows,
    totalReceipts: rows.reduce((sum, row) => sum + row.receipts, 0),
    totalCollected: moneyValue(rows.reduce((sum, row) => sum + moneyCents(row.collected), 0)),
    totalCommission: moneyValue(rows.reduce((sum, row) => sum + moneyCents(row.commission), 0))
  };
}

/** Expense date for a commission month: month end, never in the future. */
export function commissionExpenseDate(month, referenceDate = new Date()) {
  const targetMonth = typeof month === 'string' && MONTH_RE.test(month) ? month : pakistanMonth(referenceDate);
  const [year, monthNum] = targetMonth.split('-').map((part) => parseInt(part, 10));
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const monthEnd = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;
  const today = pakistanToday(referenceDate);
  return monthEnd <= today ? monthEnd : today;
}

/** Human-readable expense note (record data, like settlement receipts). */
export function commissionExpenseNote(row, month) {
  const ruleText = row.mode === 'percent'
    ? `${row.percentageOfCollection}% of collection`
    : `${formatShopPKR(row.perReceiptFixed)} per receipt`;
  return `Collector commission — ${row.label} — ${month} — ${row.receipts} receipts, collected ${formatShopPKR(row.collected)}, rule ${ruleText}`.slice(0, 1000);
}

/**
 * Posts one report row's commission to Monthly Expenses through the
 * existing phase3 expense store. IDEMPOTENT: when an expense already
 * carries this collector + month's commissionRef stamp, the state is
 * returned untouched with alreadyPosted: true. Throws when there is no
 * commission to post. Returns a NEW state; the input is never mutated.
 */
export function postCommissionExpense(state, row, month, referenceDate = new Date()) {
  if (!row || typeof row !== 'object' || !row.key) throw new Error('Choose a collector to post commission for.');
  const targetMonth = typeof month === 'string' && MONTH_RE.test(month) ? month : pakistanMonth(referenceDate);
  const existing = findCommissionExpense(state, row.key, targetMonth);
  if (existing) return { state, expense: existing, alreadyPosted: true };
  const commission = roundMoney(row.commission);
  if (!Number.isFinite(commission) || commission <= 0) throw new Error('No commission to post for this collector and month.');
  if (!EXPENSE_CATEGORIES.includes(COMMISSION_EXPENSE_CATEGORY)) throw new Error('Commission expense category is unavailable.');
  const withExpense = addExpense(state, {
    date: commissionExpenseDate(targetMonth, referenceDate),
    amount: commission,
    category: COMMISSION_EXPENSE_CATEGORY,
    notes: commissionExpenseNote(row, targetMonth)
  }, referenceDate);
  const previousIds = new Set((Array.isArray(state?.expenses) ? state.expenses : []).map((expense) => expense && expense.id));
  const expenses = withExpense.expenses.map((expense) => {
    if (!expense || previousIds.has(expense.id)) return expense;
    return {
      ...expense,
      commissionRef: commissionExpenseRef(row.key, targetMonth),
      commissionCollector: String(row.label || ''),
      commissionMonth: targetMonth
    };
  });
  return { state: { ...withExpense, expenses }, expense: expenses.find((expense) => expense && !previousIds.has(expense.id)) || null, alreadyPosted: false };
}

/**
 * Wires the collector commission modal (dialog in index.html). Pure logic
 * lives above; this controller only renders and delegates persistence:
 * rules via load/saveCommissionRules, ledger changes via onUpdateState.
 */
export function setupCommissionModal(getState, { onUpdateState, onToast, onRulesChanged } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('commissionModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const monthInput = $('commissionMonthInput');
  const rowsBox = $('commissionRows');
  const totalsBox = $('commissionTotals');
  let currentMonth = pakistanMonth();

  function render() {
    if (!rowsBox) return;
    const state = getState() || { customers: [], expenses: [] };
    const rules = loadCommissionRules();
    const report = buildMonthlyCommission(state, rules, currentMonth);
    if (monthInput && monthInput.value !== currentMonth) monthInput.value = currentMonth;
    if (report.rows.length === 0) {
      rowsBox.innerHTML = `<p class="shop-settlement-empty">${escapeHtml(t('comm_empty'))}</p>`;
    } else {
      rowsBox.innerHTML = report.rows.map((row) => `
        <article class="shop-settlement-card commission-card" data-key="${escapeHtml(row.key)}">
          <h3>${escapeHtml(row.label)} <span class="commission-badge">${escapeHtml(row.kind === 'shop' ? t('comm_kind_shop') : t('comm_kind_field'))}</span></h3>
          <p><span>${escapeHtml(t('comm_receipts'))}</span><strong>${escapeHtml(String(row.receipts))}</strong></p>
          <p><span>${escapeHtml(t('comm_collected'))}</span><strong>${escapeHtml(formatShopPKR(row.collected))}</strong></p>
          <div class="commission-rule-row">
            <label>${escapeHtml(t('comm_rule_label'))}
              <select class="form-input commission-mode" data-key="${escapeHtml(row.key)}">
                <option value="perReceipt" ${row.mode === 'perReceipt' ? 'selected' : ''}>${escapeHtml(t('comm_mode_per_receipt'))}</option>
                <option value="percent" ${row.mode === 'percent' ? 'selected' : ''}>${escapeHtml(t('comm_mode_percent'))}</option>
              </select>
            </label>
            <label>${escapeHtml(t('comm_value_label'))}
              <input class="form-input commission-value" data-key="${escapeHtml(row.key)}" type="number" min="0" step="any" inputmode="decimal" value="${escapeHtml(String(row.mode === 'percent' ? row.percentageOfCollection : row.perReceiptFixed))}">
            </label>
          </div>
          <p><span>${escapeHtml(t('comm_commission'))}</span><strong>${escapeHtml(formatShopPKR(row.commission))}</strong></p>
          ${row.posted
            ? `<p class="commission-posted">${escapeHtml(t('comm_posted_label'))}</p>`
            : `<button type="button" class="secondary-button commission-post-btn" data-commission-post="${escapeHtml(row.key)}" ${row.commission <= 0 ? 'disabled' : ''}>${escapeHtml(t('comm_post_btn'))}</button>`}
        </article>`).join('');
    }
    if (totalsBox) {
      totalsBox.textContent = report.rows.length === 0
        ? ''
        : t('comm_totals', null, { receipts: report.totalReceipts, collected: formatShopPKR(report.totalCollected), commission: formatShopPKR(report.totalCommission) });
    }
  }

  function saveRule(key, mode, value) {
    const state = getState() || { customers: [], expenses: [] };
    const current = loadCommissionRules();
    const collector = listCommissionCollectors(state, current).find((c) => c.key === key);
    if (!collector) return;
    const numeric = Number(value);
    const previous = ruleForCollector(current, key);
    const cleanMode = mode === 'percent' ? 'percent' : 'perReceipt';
    const rules = upsertCommissionRule(current, {
      collectorKey: key,
      kind: collector.kind,
      label: collector.label,
      mode: cleanMode,
      perReceiptFixed: cleanMode === 'percent' ? previous.perReceiptFixed : (Number.isFinite(numeric) ? numeric : 0),
      percentageOfCollection: cleanMode === 'percent' ? (Number.isFinite(numeric) ? numeric : 0) : previous.percentageOfCollection
    });
    saveCommissionRules(rules);
    onRulesChanged && onRulesChanged(rules);
    onToast && onToast(t('comm_rule_saved', null, { collector: collector.label }));
    render();
  }

  if (monthInput) monthInput.addEventListener('change', () => {
    if (MONTH_RE.test(monthInput.value)) currentMonth = monthInput.value;
    render();
  });
  if (rowsBox) {
    rowsBox.addEventListener('change', (event) => {
      const card = event.target.closest('.commission-card');
      if (!card) return;
      const modeSelect = card.querySelector('.commission-mode');
      const valueInput = card.querySelector('.commission-value');
      if (event.target === modeSelect || event.target === valueInput) {
        saveRule(card.getAttribute('data-key'), modeSelect ? modeSelect.value : 'perReceipt', valueInput ? valueInput.value : 0);
      }
    });
    rowsBox.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-commission-post]');
      if (!btn) return;
      const key = btn.getAttribute('data-commission-post');
      const state = getState() || { customers: [], expenses: [] };
      const report = buildMonthlyCommission(state, loadCommissionRules(), currentMonth);
      const row = report.rows.find((r) => r.key === key);
      if (!row) return;
      try {
        const result = postCommissionExpense(state, row, currentMonth);
        if (result.alreadyPosted) {
          onToast && onToast(t('comm_already_posted', null, { collector: row.label, month: currentMonth }));
        } else {
          onUpdateState && onUpdateState(result.state);
          onToast && onToast(t('comm_posted_toast', null, { collector: row.label, amount: formatShopPKR(row.commission), month: currentMonth }));
        }
      } catch (error) {
        onToast && onToast(error && error.message ? error.message : t('comm_nothing_to_post', null, { collector: row.label, month: currentMonth }));
      }
      render();
    });
  }
  const closeBtn = $('commissionCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openCommissionModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    currentMonth = pakistanMonth();
    render();
    dialog.showModal();
  });

  return {
    open() {
      currentMonth = pakistanMonth();
      render();
      dialog.showModal();
    },
    refresh: render
  };
}
