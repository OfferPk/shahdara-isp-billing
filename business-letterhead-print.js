/**
 * business-letterhead-print.js — SISP-125 [P2]: Printable ISP Letterhead
 * Multi-Month Financial & Subscriber Statement
 * ("سرکاری لیٹر ہیڈ مالیاتی و سبسکرائبر گوشوارہ").
 *
 * Spec (read-latest.txt, SISP-125 block): "Render an official A4
 * print/PDF Shahdara ISP Letterhead Financial Statement for any
 * selected multi-month range (YYYY-MM to YYYY-MM) showing Active
 * Subscribers, Gross Collections, Operating Expenses, Net Profit, and
 * Partner Sign-Off Blocks."
 * Test criterion: "Generating a 3-month letterhead statement accurately
 * sums collections, expenses, and net profit across the selected
 * months."
 *
 * Sources of truth ONLY — no figure is recomputed in parallel and no
 * record is ever mutated by this module:
 *   - Per-month income / expenses / net come from the shipped P&L
 *     engine, dashboard-pnl.js `calculatePnlAnalytics`, called once
 *     per month with that month as the selected month. Its cash basis
 *     is inherited exactly: collections are receipts grouped by
 *     PAYMENT date, expenses are dated recorded expenses.
 *   - NO adjustment is applied on top of the engine figures. When
 *     this phase was first built, the P&L engine summed every payment
 *     row in a bill, including payments voided under SISP-34, and the
 *     statement subtracted the voided total itself. FU4 has since
 *     merged: the engine now filters voided payments out of its
 *     income (`dashboard-pnl.js` drops `isVoidedPayment` rows — a
 *     voided receipt is history, not income), so the statement's
 *     figures are EXACTLY the engine's figures: grossCollections is
 *     the engine income and netProfit is the engine net, in every
 *     month, voided or not. Subtracting the voided total here as
 *     well would exclude the same money twice.
 *   - Each row still carries `voidedExcluded` as an INFORMATIONAL,
 *     audit-only figure: that month's voided total (via
 *     payment-void-audit.js `isVoidedPayment`). It is never
 *     subtracted — it simply shows how much reversed money the
 *     engine left out. The raw engine figures ride along on each row
 *     (`engineIncome` / `engineExpenses` / `engineNetProfit`) so the
 *     parity is auditable, never hidden.
 *   - Active Subscribers per month = connections active at that
 *     month's END, derived from recorded dates only: a customer counts
 *     from their join month (core.js `customerJoinMonth`: addedOn →
 *     connectionDate → billingStartMonth → earliest bill month) and
 *     stops counting from their recorded archive month
 *     (archivedAt's month) onward. Honest limits, surfaced on the
 *     model as `limits`: customers with NO datable join month are
 *     never placed in any month (`undatedCustomers`), and customers
 *     archived with no recorded archivedAt are counted in no month
 *     (`archivedUndated`) — the same documented limits the SISP-70
 *     matrix approach carries. FREE connections are real subscribers
 *     and count like any other active connection.
 *   - Partner sign-off blocks iterate partner-settlement.js `PARTNERS`
 *     — names are never re-hardcoded here.
 *
 * Range rules: both months must be valid YYYY-MM, From ≤ To, and the
 * span is capped at LETTERHEAD_MAX_RANGE_MONTHS (36) with a clear
 * thrown refusal beyond it. Every month in the range prints a row —
 * a month with no data is an honest zero row, never skipped.
 * Range totals are plain sums of the printed rows (Voucher Book
 * precedent).
 *
 * The print sheet follows the house print conventions (SISP-60
 * Voucher Book): a standalone HTML document, black on white, the
 * typographic "SHAHDARA FIBER NET" letterhead the Voucher Book uses
 * (no logo asset exists on the print surfaces, and no address or
 * phone is recorded for print — none is invented), printed via
 * window.print ("Save as PDF" in the browser dialog). The on-screen
 * dialog is a standard billing-modal (var(--modal-surface)) with
 * token-only CSS — that split is deliberate: screen follows the
 * dark-mode rule, paper is paper.
 */

import { formatPKR, customerJoinMonth } from './core.js';
import { calculatePnlAnalytics } from './dashboard-pnl.js';
import { isVoidedPayment } from './payment-void-audit.js';
import { PARTNERS, partnerMonthLabel } from './partner-settlement.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const LETTERHEAD_MAX_RANGE_MONTHS = 36;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function centsOf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function rupeesOf(cents) {
  return cents / 100;
}

/** 'YYYY-MM' shifted by `delta` months (pure string/UTC math). */
export function shiftLetterheadMonth(month, delta) {
  if (!MONTH_RE.test(String(month || ''))) return '';
  const [year, mon] = String(month).split('-').map(Number);
  const d = new Date(Date.UTC(year, mon - 1 + Number(delta || 0), 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * The inclusive list of months in a validated range. Throws a clear
 * refusal for malformed months, a reversed range, or a span beyond
 * LETTERHEAD_MAX_RANGE_MONTHS.
 */
export function letterheadMonthsInRange(fromMonth, toMonth) {
  if (!MONTH_RE.test(String(fromMonth || '')) || !MONTH_RE.test(String(toMonth || ''))) {
    throw new Error('Pick a valid From and To month (YYYY-MM).');
  }
  if (String(fromMonth) > String(toMonth)) {
    throw new Error('The From month must be on or before the To month.');
  }
  const months = [];
  let cursor = String(fromMonth);
  while (cursor <= String(toMonth)) {
    months.push(cursor);
    if (months.length > LETTERHEAD_MAX_RANGE_MONTHS) {
      throw new Error(`The letterhead statement covers at most ${LETTERHEAD_MAX_RANGE_MONTHS} months — narrow the range.`);
    }
    cursor = shiftLetterheadMonth(cursor, 1);
  }
  return months;
}

/**
 * Builds the Letterhead Statement model for a month range. Pure and
 * read-only: state is never mutated.
 *
 * @param {Object} state - Full application state
 * @param {Object} [options]
 * @param {string} options.fromMonth - 'YYYY-MM' (required)
 * @param {string} options.toMonth - 'YYYY-MM' (required)
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Object} Statement model: rows[] (one per month, in range
 *   order) with monthLabel, activeSubscribers, grossCollections,
 *   operatingExpenses, netProfit, voidedExcluded (informational
 *   only — that month's voided total, already excluded from the
 *   engine's income by FU4 and never subtracted here) and the raw
 *   engine figures; totals (plain sums of the rows + the range-end
 *   subscriber count); partners; limits.
 */
export function buildLetterheadStatement(state, {
  fromMonth = null,
  toMonth = null,
  referenceDate = new Date()
} = {}) {
  const months = letterheadMonthsInRange(fromMonth, toMonth);
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const customers = Array.isArray(state?.customers) ? state.customers : [];

  // Voided totals per month (SISP-34): recorded payments flagged
  // voided, grouped by their recorded payment date — the same month
  // basis the P&L engine groups income by. INFORMATIONAL ONLY: the
  // FU4-merged engine already excludes these from its income, so
  // they are reported on each row as `voidedExcluded` for audit and
  // are NEVER subtracted from the statement figures.
  const voidedByMonth = new Map();
  for (const customer of customers) {
    for (const bill of (Array.isArray(customer?.bills) ? customer.bills : [])) {
      for (const payment of (Array.isArray(bill?.payments) ? bill.payments : [])) {
        if (!isVoidedPayment(payment)) continue;
        const month = typeof payment.date === 'string' ? payment.date.slice(0, 7) : '';
        if (!MONTH_RE.test(month)) continue;
        voidedByMonth.set(month, (voidedByMonth.get(month) || 0) + centsOf(payment.amount));
      }
    }
  }

  // Subscriber placements: one pass over the recorded join/archive
  // dates, then each month's count is a pure read of the placements.
  let undatedCustomers = 0;
  let archivedUndated = 0;
  const placements = [];
  for (const customer of customers) {
    const join = customerJoinMonth(customer);
    if (!join) { undatedCustomers += 1; continue; }
    let archiveMonth = null;
    let archivedNoDate = false;
    if (customer?.archived === true) {
      const raw = typeof customer.archivedAt === 'string' ? customer.archivedAt.slice(0, 7) : '';
      if (MONTH_RE.test(raw)) archiveMonth = raw;
      else { archivedNoDate = true; archivedUndated += 1; }
    }
    placements.push({ join, archiveMonth, archivedNoDate });
  }
  const subscribersAtMonthEnd = (month) => placements.reduce((count, p) => {
    if (p.join > month) return count;
    if (p.archivedNoDate) return count;
    if (p.archiveMonth && month >= p.archiveMonth) return count;
    return count + 1;
  }, 0);

  const rows = months.map((month) => {
    const pnl = calculatePnlAnalytics(state, {
      selectedMonth: month,
      windowMonths: 6,
      referenceDate: ref
    });
    const engine = (Array.isArray(pnl?.monthlyData) ? pnl.monthlyData : [])
      .find((row) => row && row.month === month) || { income: 0, expenses: 0, netProfit: 0 };
    const voidedCents = voidedByMonth.get(month) || 0;
    // FU4: the engine's income already excludes the voided total —
    // collections ARE the engine income. voidedCents rides along as
    // the informational `voidedExcluded` figure only; subtracting it
    // here too would exclude the same money twice.
    const collectionsCents = centsOf(engine.income);
    const expensesCents = centsOf(engine.expenses);
    return {
      month,
      monthLabel: partnerMonthLabel(month),
      activeSubscribers: subscribersAtMonthEnd(month),
      grossCollections: rupeesOf(collectionsCents),
      operatingExpenses: rupeesOf(expensesCents),
      netProfit: rupeesOf(collectionsCents - expensesCents),
      voidedExcluded: rupeesOf(voidedCents),
      engineIncome: engine.income,
      engineExpenses: engine.expenses,
      engineNetProfit: engine.netProfit
    };
  });

  const sumCents = (pick) => rows.reduce((sum, row) => sum + centsOf(pick(row)), 0);
  const totals = {
    grossCollections: rupeesOf(sumCents((row) => row.grossCollections)),
    operatingExpenses: rupeesOf(sumCents((row) => row.operatingExpenses)),
    netProfit: rupeesOf(sumCents((row) => row.netProfit)),
    voidedExcluded: rupeesOf(sumCents((row) => row.voidedExcluded)),
    activeSubscribersEnd: rows.length ? rows[rows.length - 1].activeSubscribers : 0
  };

  return {
    fromMonth: String(fromMonth),
    toMonth: String(toMonth),
    months,
    rows,
    totals,
    partners: [...PARTNERS],
    limits: { undatedCustomers, archivedUndated }
  };
}

/**
 * Generates the printable Letterhead Statement (A4). Paper output
 * follows the app's print conventions: a standalone HTML document,
 * black on white. Labels follow the requested language via t();
 * recorded figures print as computed. Signature blocks — prepared-by
 * plus one per partner in PARTNERS order — always print, even for an
 * all-zero range.
 *
 * @param {Object} params
 * @param {Object} params.statement - Output of buildLetterheadStatement
 * @param {string} [params.lang] - 'en' or 'ur'
 * @param {string} [params.generatedDate] - YYYY-MM-DD stamp
 * @returns {string} HTML document string
 */
export function generateLetterheadPrintHtml({ statement, lang = null, generatedDate = '' } = {}) {
  const rows = Array.isArray(statement?.rows) ? statement.rows : [];
  const totals = statement?.totals || { grossCollections: 0, operatingExpenses: 0, netProfit: 0, activeSubscribersEnd: 0 };
  const partners = Array.isArray(statement?.partners) && statement.partners.length
    ? statement.partners
    : [...PARTNERS];
  const fromLabel = rows.length ? rows[0].monthLabel : (statement?.fromMonth || '');
  const toLabel = rows.length ? rows[rows.length - 1].monthLabel : (statement?.toMonth || '');

  const bodyRows = rows.map((row) => `
      <tr>
        <td class="month">${escapeHtml(row.monthLabel)}<br><span class="month-key">${escapeHtml(row.month)}</span></td>
        <td class="num">${escapeHtml(String(row.activeSubscribers))}</td>
        <td class="amt">${formatPKR(row.grossCollections)}</td>
        <td class="amt">${formatPKR(row.operatingExpenses)}</td>
        <td class="amt">${formatPKR(row.netProfit)}</td>
      </tr>`).join('');

  const sigBlocks = [
    `<div class="sig"><div class="line"></div>${escapeHtml(t('lh_sign_prepared', lang))}</div>`,
    ...partners.map((name) => `<div class="sig"><div class="line"></div>${escapeHtml(t('lh_sign_partner', lang, { name }))}</div>`)
  ].join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Letterhead Statement — ${escapeHtml(statement?.fromMonth || '')} to ${escapeHtml(statement?.toMonth || '')}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; font-size: 12px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
        .brand { font-size: 19px; font-weight: 800; letter-spacing: .4px; }
        .title { font-size: 14px; font-weight: 700; }
        .range { font-size: 12px; }
        .meta { font-size: 11px; text-align: right; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #eee; font-size: 11px; }
        td.month { white-space: nowrap; }
        .month-key { font-size: 10px; color: #555; }
        td.num, th.num { text-align: right; white-space: nowrap; }
        td.amt, th.amt { text-align: right; white-space: nowrap; }
        tr.grand td { border-top: 2px solid #000; font-weight: 800; font-size: 13px; }
        .basis { margin-top: 10px; font-size: 10px; color: #333; }
        .signatures { display: flex; justify-content: space-between; margin-top: 34px; font-size: 11px; gap: 18px; }
        .sig { flex: 1; text-align: center; }
        .sig .line { border-top: 1px solid #000; margin-bottom: 4px; height: 28px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">SHAHDARA FIBER NET</div>
          <div class="title">${escapeHtml(t('lh_sheet_title', lang))}</div>
          <div class="range">${escapeHtml(fromLabel)} – ${escapeHtml(toLabel)} · ${escapeHtml(statement?.fromMonth || '')} – ${escapeHtml(statement?.toMonth || '')}</div>
        </div>
        <div class="meta">
          <div>${escapeHtml(t('lh_generated_on', lang, { date: generatedDate || '—' }))}</div>
          <div>${rows.length} ${escapeHtml(t('lh_col_month', lang))}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('lh_col_month', lang))}</th>
            <th class="num">${escapeHtml(t('lh_col_subscribers', lang))}</th>
            <th class="amt">${escapeHtml(t('lh_col_collections', lang))}</th>
            <th class="amt">${escapeHtml(t('lh_col_expenses', lang))}</th>
            <th class="amt">${escapeHtml(t('lh_col_profit', lang))}</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
          <tr class="grand">
            <td>${escapeHtml(t('lh_total_row', lang))}</td>
            <td class="num">${escapeHtml(String(totals.activeSubscribersEnd))}</td>
            <td class="amt">${formatPKR(totals.grossCollections)}</td>
            <td class="amt">${formatPKR(totals.operatingExpenses)}</td>
            <td class="amt">${formatPKR(totals.netProfit)}</td>
          </tr>
        </tbody>
      </table>
      <p class="basis">${escapeHtml(t('lh_basis_note', lang))}</p>
      <div class="signatures">
        ${sigBlocks}
      </div>
    </body>
    </html>
  `;
}

/**
 * Controller for the Letterhead Statement dialog (opened from the
 * Expenses ledger toolbar, beside the Voucher Book). Mirrors
 * setupExpenseVoucherDialog's wiring style: returns null when there
 * is no DOM or no dialog markup. Generating or printing the
 * statement never writes any record.
 *
 * @param {Object|Function} getState - State object or () => state
 * @param {Object} [options]
 * @param {Function} [options.onToast]
 * @returns {Object|null} Controller { open, close, refresh, getStatement }
 */
export function setupLetterheadDialog(getState, { onToast = null } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('letterheadDialog');
  if (!dialog) return null;

  const readState = () => (typeof getState === 'function' ? getState() : getState);
  const openBtn = document.getElementById('letterheadOpenBtn');
  const closeBtn = document.getElementById('letterheadCloseBtn');
  const closeSecondaryBtn = document.getElementById('letterheadCloseBtn2');
  const fromInput = document.getElementById('letterheadFromMonth');
  const toInput = document.getElementById('letterheadToMonth');
  const preview = document.getElementById('letterheadPreview');
  const printBtn = document.getElementById('letterheadPrintBtn');

  let currentStatement = null;

  const pktMonthNow = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7);

  const ensureDefaults = () => {
    const current = pktMonthNow();
    if (toInput && !toInput.value) toInput.value = current;
    if (fromInput && !fromInput.value) fromInput.value = shiftLetterheadMonth(current, -2);
  };

  const render = () => {
    ensureDefaults();
    try {
      currentStatement = buildLetterheadStatement(readState(), {
        fromMonth: fromInput ? fromInput.value : null,
        toMonth: toInput ? toInput.value : null
      });
    } catch (error) {
      currentStatement = null;
      if (preview) preview.textContent = '';
      if (typeof onToast === 'function') {
        onToast(error && error.message ? error.message : 'The statement range is not valid.');
      }
      return null;
    }
    if (preview) {
      preview.textContent = t('lh_preview', null, {
        months: currentStatement.rows.length,
        total: formatPKR(currentStatement.totals.netProfit)
      });
    }
    return currentStatement;
  };

  const print = () => {
    if (!currentStatement) render();
    if (!currentStatement) return;
    const generatedDate = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const html = generateLetterheadPrintHtml({ statement: currentStatement, generatedDate });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } else if (typeof onToast === 'function') {
      onToast(t('lh_popup_blocked'));
    }
  };

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      render();
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });
  if (fromInput) fromInput.addEventListener('change', render);
  if (toInput) toInput.addEventListener('change', render);
  if (printBtn) printBtn.addEventListener('click', print);

  return {
    open: (fromMonth, toMonth) => {
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      if (fromMonth && fromInput) fromInput.value = fromMonth;
      if (toMonth && toInput) toInput.value = toMonth;
      render();
    },
    close: () => { dialog.close?.() || (dialog.hidden = true); },
    refresh: render,
    getStatement: () => currentStatement
  };
}

export { escapeHtml };
