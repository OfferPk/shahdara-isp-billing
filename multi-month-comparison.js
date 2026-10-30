/**
 * multi-month-comparison.js — SISP-70 [P2]: 3 / 6 / 12-Month Historical
 * Financial & Subscriber Growth Matrix
 * ("سہ ماہی و سالانہ ترقی اور منافع موازنہ").
 *
 * Spec (read-latest.txt, SISP-70 block): "Side-by-side multi-month
 * comparison (Desktop Table + Mobile Cards at ≤700px using dark-mode
 * theme tokens) showing Active Subscribers, New Connections, Churned,
 * Total Billed, Collected, Collection %, Expenses, Net Profit, and
 * Network Downtime Hours per month."
 * Test criterion: "Selecting 2026-08 to 2026-10 aggregates each month's
 * collections, expenses, net profit, and net subscriber growth with
 * zero horizontal overflow at 390px."
 *
 * This module is a PURE builder plus a thin dashboard-section
 * controller, in the collection-forecaster.js / expense-voucher-print.js
 * mould: it reads the ledger and returns figures. It writes nothing,
 * mutates nothing, adds no storage keys, and changes NO money logic.
 *
 * Sources of truth ONLY — every figure is taken from the SAME engine
 * or loader its own source screen uses, so the matrix can never
 * disagree with that screen:
 *   1. billedCents / collectedCents — the allocation engine
 *      (core.js calculatePaymentAllocations, the SISP-2 engine behind
 *      the dashboard, the forecaster and the billing register):
 *      billed = the engine's billAmountCents for the month's bills
 *      (a priced bill's dueAmount + lateFee + shiftingFee; unpriced
 *      bills contribute nothing). Collected = billed − the engine's
 *      balanceDueCents for those same bills: the settled share of the
 *      month's billing, whether settled by cash, carried-forward
 *      credit, an applied discount or a SISP-50 deposit offset. The
 *      engine excludes voided payments before allocating, so a voided
 *      receipt never collects anything here.
 *   2. collectionPercent = collected / billed × 100, one decimal;
 *      null when nothing was billed (no honest percentage exists).
 *   3. expensesCents / netProfitCents — dashboard-pnl.js
 *      calculatePnlAnalytics (the P&L screen's own engine), read from
 *      its 12-month window ending at the selected end month. NOTE the
 *      P&L basis, exactly as on the P&L screen: profit = cash income
 *      RECEIVED in the month (payments by payment date) − the month's
 *      expenses. That is a different lens from the allocation-based
 *      Collected above (which measures bills settled, whenever the
 *      cash arrived) — the two are shown side by side deliberately,
 *      each agreeing with its own source screen.
 *   4. downtimeHours — downtime-analytics.js (SISP-16)
 *      buildMonthlyDowntimeAnalytics over the SISP-15 complaint
 *      register: the month's totalDowntime, area outages and
 *      per-customer hours together, the SISP-16 screen's own total.
 *   5. Subscriber movement — core.js customerJoinMonth (the same join
 *      month buildNewCustomerReport / the PR #398 new-customer counts
 *      use: addedOn, then connectionDate, then billingStartMonth,
 *      then the earliest bill month) and the archive stamp
 *      (customer.archivedAt, written by core.js archiveCustomer):
 *        newConnections(M)  = customers whose join month is M.
 *        churned(M)         = customers STILL archived whose
 *                             archivedAt falls in M.
 *        activeSubscribers(M) = customers with join month ≤ M who
 *                             had not churned out by the end of M.
 *        netGrowth(M)       = newConnections(M) − churned(M).
 *      Honest limits, by construction: un-archiving a customer clears
 *      archivedAt (core.js unarchiveCustomer), so a churn that was
 *      later reversed leaves no dated trace and is not counted — the
 *      churn column counts exactly the customers the ledger can still
 *      prove churned in that month, never a guess. An archived
 *      customer with NO archivedAt stamp (legacy rows) cannot be
 *      dated either: they count in no month's churn and in no month's
 *      active total. A customer with no derivable join month counts
 *      in no month at all; the model surfaces their number separately
 *      as `undatedCustomers` instead of placing them by guesswork.
 *
 * Money is integer cents throughout the model; the view formats with
 * formatPKR. Months are 'YYYY-MM' strings, Latin digits — the house
 * rule for month keys on every screen.
 *
 * Tests use synthetic data only.
 */

import {
  calculatePaymentAllocations,
  customerJoinMonth,
  formatPKR,
  monthsForHistory
} from './core.js';
import { addMonths, pktMonth } from './phase3.js';
import { calculatePnlAnalytics } from './dashboard-pnl.js';
import { buildMonthlyDowntimeAnalytics } from './downtime-analytics.js';
import { partnerMonthLabel } from './partner-settlement.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const MATRIX_RANGE_OPTIONS = Object.freeze([3, 6, 12]);

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const centsOf = value => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const monthOfStamp = value => {
  const text = typeof value === 'string' ? value.slice(0, 7) : '';
  return MONTH_RE.test(text) ? text : null;
};

/** The selectable ranges are exactly 3 / 6 / 12 months; anything else falls back to 3. */
export function normalizeMatrixRange(value) {
  const n = Number(value);
  return MATRIX_RANGE_OPTIONS.includes(n) ? n : 3;
}

/**
 * Build the multi-month growth & finance matrix.
 *
 * @param {object} state - the app ledger state ({ customers, expenses }).
 * @param {Array} complaints - the SISP-15 complaint register list
 *   (complaint-register.js loadComplaints()); anything else reads as an
 *   empty register (zero downtime, never a throw).
 * @param {object} [options]
 * @param {string} [options.endMonth] - 'YYYY-MM' the comparison ends
 *   at; anything else falls back to the reference date's PKT month.
 * @param {number} [options.rangeMonths=3] - one of 3 / 6 / 12.
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {object} { endMonth, rangeMonths, months: [row, …] ascending,
 *   undatedCustomers } — see the header for each row's definitions.
 */
export function buildMultiMonthMatrix(state, complaints, {
  endMonth = null,
  rangeMonths = 3,
  referenceDate = new Date()
} = {}) {
  const ref = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const end = typeof endMonth === 'string' && MONTH_RE.test(endMonth) ? endMonth : pktMonth(ref);
  const range = normalizeMatrixRange(rangeMonths);
  const months = Array.from({ length: range }, (_, i) => addMonths(end, i - (range - 1)));

  const customers = (Array.isArray(state?.customers) ? state.customers : [])
    .filter(customer => customer && typeof customer === 'object');
  // The engines assume the sanitized state's shape (bills always an
  // array). Hand them a normalized view — identical for every real
  // ledger, and a malformed row degrades to "no bills" instead of a
  // throw. The builder's own loops read the same view.
  const engineCustomers = customers.map(customer => ({
    ...customer,
    bills: Array.isArray(customer.bills) ? customer.bills : []
  }));

  // 1) Billed / collected per month from the allocation engine.
  const allocations = calculatePaymentAllocations({ customers: engineCustomers });
  const billedByMonth = new Map(months.map(m => [m, 0]));
  const dueByMonth = new Map(months.map(m => [m, 0]));
  for (const customer of engineCustomers) {
    const bills = customer.bills;
    for (const bill of bills) {
      if (!bill || typeof bill !== 'object' || typeof bill.month !== 'string') continue;
      if (!billedByMonth.has(bill.month)) continue;
      const summary = allocations.forMonth(customer.id, bill.month);
      if (!summary || summary.billAmountCents === null || summary.billAmountCents === undefined) continue;
      billedByMonth.set(bill.month, billedByMonth.get(bill.month) + summary.billAmountCents);
      dueByMonth.set(bill.month, dueByMonth.get(bill.month) + (Number(summary.balanceDueCents) || 0));
    }
  }

  // 2) Expenses / net profit per month from the P&L engine's own
  // 12-month window ending at the selected end month.
  const pnl = calculatePnlAnalytics({ ...(state ?? {}), customers: engineCustomers }, {
    selectedMonth: end,
    windowMonths: 12,
    referenceDate: ref
  });
  const pnlByMonth = new Map(
    (Array.isArray(pnl?.monthlyData) ? pnl.monthlyData : []).map(row => [row.month, row])
  );

  // 3) Subscriber movement from join months + archive stamps.
  const newByMonth = new Map(months.map(m => [m, 0]));
  const churnedByMonth = new Map(months.map(m => [m, 0]));
  let undatedCustomers = 0;
  const joined = engineCustomers.map(customer => ({
    joinMonth: customerJoinMonth(customer),
    archived: customer.archived === true,
    archivedMonth: monthOfStamp(customer.archivedAt)
  }));
  for (const entry of joined) {
    if (!entry.joinMonth) { undatedCustomers += 1; continue; }
    if (newByMonth.has(entry.joinMonth)) {
      newByMonth.set(entry.joinMonth, newByMonth.get(entry.joinMonth) + 1);
    }
    if (entry.archived && entry.archivedMonth && churnedByMonth.has(entry.archivedMonth)) {
      churnedByMonth.set(entry.archivedMonth, churnedByMonth.get(entry.archivedMonth) + 1);
    }
  }
  const activeForMonth = month => joined.reduce((count, entry) => {
    if (!entry.joinMonth || entry.joinMonth > month) return count;
    // Churned out by the end of `month`: archived with a stamp in or
    // before it; an undated archive stamp can prove no active month.
    if (entry.archived && (entry.archivedMonth === null || entry.archivedMonth <= month)) return count;
    return count + 1;
  }, 0);

  // 4) Assemble the rows (downtime from the SISP-16 engine per month).
  const rows = months.map(month => {
    const billedCents = billedByMonth.get(month) ?? 0;
    const collectedCents = Math.max(0, billedCents - (dueByMonth.get(month) ?? 0));
    const collectionPercent = billedCents > 0
      ? Number(((collectedCents / billedCents) * 100).toFixed(1))
      : null;
    const pnlRow = pnlByMonth.get(month);
    const newConnections = newByMonth.get(month) ?? 0;
    const churned = churnedByMonth.get(month) ?? 0;
    const downtime = buildMonthlyDowntimeAnalytics(complaints, month);
    return {
      month,
      activeSubscribers: activeForMonth(month),
      newConnections,
      churned,
      netGrowth: newConnections - churned,
      billedCents,
      collectedCents,
      collectionPercent,
      expensesCents: centsOf(pnlRow?.expenses),
      netProfitCents: centsOf(pnlRow?.netProfit),
      downtimeHours: Number(downtime?.totalDowntime) || 0
    };
  });

  return { endMonth: end, rangeMonths: range, months: rows, undatedCustomers };
}

const formatHours = hours => {
  const n = Number(hours) || 0;
  return `${Number.isInteger(n) ? n : n.toFixed(1)} h`;
};

const signedCount = n => (n > 0 ? `+${n}` : String(n));

/**
 * Pure HTML render of a built matrix: the desktop table and the mobile
 * card list, from the SAME rows (house pattern — CSS shows exactly one
 * of them; ≤700px gets the cards, so a 390px phone never scrolls
 * sideways and every amount stays fully visible).
 *
 * @param {object} matrix - buildMultiMonthMatrix() result.
 * @param {string|null} [lang] - language override for t().
 * @returns {{ tableHtml: string, cardsHtml: string }}
 */
export function renderMultiMonthMatrixHtml(matrix, lang = null) {
  const rows = Array.isArray(matrix?.months) ? matrix.months : [];
  const head = [
    t('mmx_col_month', lang), t('mmx_col_active', lang), t('mmx_col_new', lang),
    t('mmx_col_churned', lang), t('mmx_col_growth', lang), t('mmx_col_billed', lang),
    t('mmx_col_collected', lang), t('mmx_col_pct', lang), t('mmx_col_expenses', lang),
    t('mmx_col_profit', lang), t('mmx_col_downtime', lang)
  ];
  const cellsOf = row => [
    { label: head[0], value: `${partnerMonthLabel(row.month)} · ${row.month}`, strong: true },
    { label: head[1], value: String(row.activeSubscribers) },
    { label: head[2], value: String(row.newConnections) },
    { label: head[3], value: String(row.churned) },
    { label: head[4], value: signedCount(row.netGrowth) },
    { label: head[5], value: formatPKR(row.billedCents / 100) },
    { label: head[6], value: formatPKR(row.collectedCents / 100) },
    { label: head[7], value: row.collectionPercent === null ? '—' : `${row.collectionPercent}%` },
    { label: head[8], value: formatPKR(row.expensesCents / 100) },
    { label: head[9], value: formatPKR(row.netProfitCents / 100) },
    { label: head[10], value: formatHours(row.downtimeHours) }
  ];

  const tableHtml = `
    <thead><tr>${head.map(label => `<th>${escapeHtml(label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${cellsOf(row).map((cell, i) =>
      i === 0
        ? `<th scope="row">${escapeHtml(cell.value)}</th>`
        : `<td>${escapeHtml(cell.value)}</td>`).join('')}</tr>`).join('')}
    </tbody>`;

  const cardsHtml = rows.map(row => `
    <article class="mmx-card-item">
      <h4 class="mmx-card-title">${escapeHtml(`${partnerMonthLabel(row.month)} · ${row.month}`)}</h4>
      ${cellsOf(row).slice(1).map(cell => `<p><span>${escapeHtml(cell.label)}</span><strong>${escapeHtml(cell.value)}</strong></p>`).join('')}
    </article>`).join('');

  return { tableHtml, cardsHtml };
}

/**
 * Dashboard-section controller: wires the range + end-month controls
 * once and renders the matrix into the section's table + card
 * containers. Mirrors setupExpenseVoucherDialog's wiring style:
 * returns null when there is no DOM or no section markup. Read-only —
 * rendering never writes any record.
 *
 * @param {Object|Function} getState - State object or () => state
 * @param {Object} [options]
 * @param {Function} [options.getComplaints] - () => SISP-15 register
 *   list (defaults to an empty list)
 * @param {Function} [options.onToast]
 * @returns {Object|null} Controller { refresh, getMatrix }
 */
export function setupMultiMonthMatrix(getState, { getComplaints = null, onToast = null } = {}) {
  if (typeof document === 'undefined') return null;
  const section = document.getElementById('multiMonthMatrixSection');
  if (!section) return null;

  const readState = () => (typeof getState === 'function' ? getState() : getState);
  const readComplaints = () => {
    try {
      const value = typeof getComplaints === 'function' ? getComplaints() : getComplaints;
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const rangeSelect = document.getElementById('multiMonthRangeSelect');
  const endSelect = document.getElementById('multiMonthEndSelect');
  const table = document.getElementById('multiMonthMatrixTable');
  const cards = document.getElementById('multiMonthMatrixCards');
  const emptyEl = document.getElementById('multiMonthMatrixEmpty');

  let currentMatrix = null;

  const render = () => {
    if (endSelect && !endSelect.options.length) {
      monthsForHistory(new Date()).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `${partnerMonthLabel(m)} · ${m}`;
        endSelect.appendChild(opt);
      });
    }
    currentMatrix = buildMultiMonthMatrix(readState(), readComplaints(), {
      endMonth: endSelect ? endSelect.value : null,
      rangeMonths: rangeSelect ? rangeSelect.value : 3
    });
    const { tableHtml, cardsHtml } = renderMultiMonthMatrixHtml(currentMatrix);
    if (table) table.innerHTML = tableHtml;
    if (cards) cards.innerHTML = cardsHtml;
    if (emptyEl) {
      const hasActivity = currentMatrix.months.some(row =>
        row.billedCents > 0 || row.newConnections > 0 || row.expensesCents !== 0 || row.downtimeHours > 0);
      emptyEl.hidden = hasActivity;
    }
    return currentMatrix;
  };

  if (rangeSelect && !rangeSelect.dataset.mmxWired) {
    rangeSelect.dataset.mmxWired = 'true';
    rangeSelect.addEventListener('change', render);
  }
  if (endSelect && !endSelect.dataset.mmxWired) {
    endSelect.dataset.mmxWired = 'true';
    endSelect.addEventListener('change', render);
  }

  return {
    refresh: render,
    getMatrix: () => currentMatrix
  };
}

export { escapeHtml };
