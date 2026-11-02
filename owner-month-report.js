/**
 * owner-month-report.js — M8
 * Month-End Owner Report (printable A4, read-only).
 *
 * A one-click month-end summary for the owner, composed ONLY from
 * existing builders over existing records — no figure is recomputed
 * in a parallel path:
 *
 * - Total collected, the collection-channel split, expenses (total +
 *   category breakdown), net profit and the Nasir / Aqib partner
 *   shares: buildOwnerKhataReport (owner-khata.js), fed the exact
 *   inputs the Owner Khata modal itself assembles, so the figures are
 *   the Owner Khata figures by construction. The partner basis is
 *   phase3.js paymentEntries — void-exclusive at the shared source
 *   (FU4) — so a voided receipt never counts as collected here.
 * - Arrears movement (opening pending -> closing pending): phase3.js
 *   outstandingAtMonthEnd for the previous month (opening) and for
 *   the report month (closing — the same value Owner Khata shows as
 *   Pending Arrears). The change line is closing minus opening.
 * - Top 5 defaulters at month end: ranked from the SAME
 *   outstandingAtMonthEnd result's byCustomer map (amounts are the
 *   builder's own per-customer month-end balances; only customers
 *   with a positive balance are listed, highest first). Ranking and
 *   slicing are presentation, not arithmetic.
 * - New connections in the month: calculateDashboardKpis
 *   (dashboard.js) newConnectionsCount, read with a mid-month
 *   reference date — the dashboard's own rule (connectionDate month,
 *   else addedOn month; archived customers excluded).
 *
 * The report is READ-ONLY: buildOwnerMonthReport is a pure function
 * of (state, month, inputs). It writes nothing, stores nothing and
 * mutates no state; the only side effect in this module is the print
 * window the owner explicitly opens from the dialog.
 */

import { buildOwnerKhataReport, escapeHtml, formatPKR } from './owner-khata.js';
import { outstandingAtMonthEnd } from './phase3.js';
import { calculateDashboardKpis } from './dashboard.js';
import { loadComplaints, pakistanMonthNow } from './complaint-register.js';
import { loadPartnerSettings } from './partner-settlement.js';
import { loadShopSettlements } from './shop-settlement.js';
import { loadTickets } from './complaint-tickets.js';
import { loadMonthlyClosingNotes } from './monthly-closing-notes.js';
import { loadRoznamchaDays } from './roznamcha.js';
import { loadCharityReserveSettings } from './charity-reserve.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-\d{2}$/;

function wholeRupees(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function previousMonth(month) {
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const prevYear = mon === 1 ? year - 1 : year;
  const prevMon = mon === 1 ? 12 : mon - 1;
  return `${String(prevYear).padStart(4, '0')}-${String(prevMon).padStart(2, '0')}`;
}

function monthLabel(month) {
  if (!MONTH_RE.test(String(month || ''))) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${month}-01T00:00:00Z`));
  } catch {
    return String(month);
  }
}

/**
 * Pure: builds the month-end owner report for `month` from ledger
 * state + the same side inputs Owner Khata takes. An invalid month
 * yields a zeroed report (same convention as buildOwnerKhataReport).
 * Never mutates its inputs.
 */
export function buildOwnerMonthReport(state, month, inputs = {}) {
  const validMonth = MONTH_RE.test(String(month || '')) ? String(month) : '';
  if (!validMonth) {
    return {
      month: '', validMonth: false, collected: 0, receiptCount: 0,
      collectionChannels: [], expenses: 0, expenseCount: 0, expenseCategories: [],
      profit: 0, isLoss: false, nasirShare: 0, aqibShare: 0,
      openingArrears: 0, closingArrears: 0, arrearsChange: 0, arrearsBillCount: 0,
      topDefaulters: [], newConnections: 0
    };
  }
  const referenceDate = inputs.referenceDate instanceof Date ? inputs.referenceDate : new Date();

  // Collections, expenses, profit and shares — Owner Khata verbatim.
  const khata = buildOwnerKhataReport(state, validMonth, inputs);

  // Arrears movement — the month-end outstanding builder at both ends
  // of the month. The closing total is the Owner Khata figure itself;
  // the closing detail call also yields the per-customer balances the
  // defaulter ranking reads (same builder, same reference date, so
  // the ranking always agrees with the closing total's own source).
  const opening = outstandingAtMonthEnd(state, previousMonth(validMonth), referenceDate);
  const closingDetail = outstandingAtMonthEnd(state, validMonth, referenceDate);
  const openingArrears = wholeRupees(opening.total);
  const closingArrears = wholeRupees(khata.pendingArrears);

  const names = new Map();
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  for (const customer of customers) {
    if (customer && customer.id != null && !names.has(customer.id)) {
      names.set(customer.id, String(customer.name || customer.id));
    }
  }
  const topDefaulters = [...(closingDetail.byCustomer?.entries() ?? [])]
    .map(([customerId, amount]) => ({
      customerId,
      name: names.get(customerId) ?? String(customerId),
      amount: Number(amount || 0)
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount
      || a.name.localeCompare(b.name)
      || String(a.customerId).localeCompare(String(b.customerId)))
    .slice(0, 5);

  // New connections — the dashboard KPI's own count for this month.
  let newConnections = 0;
  if (Array.isArray(state?.customers)) {
    const midMonth = new Date(`${validMonth}-15T12:00:00Z`);
    if (!Number.isNaN(midMonth.getTime())) {
      newConnections = Number(calculateDashboardKpis(state, midMonth).newConnectionsCount || 0);
    }
  }

  return {
    month: validMonth,
    validMonth: true,
    collected: khata.collected,
    receiptCount: khata.receiptCount,
    collectionChannels: khata.collectionChannels,
    expenses: khata.expenses,
    expenseCount: khata.expenseCount,
    expenseCategories: khata.expenseCategories,
    profit: khata.profit,
    isLoss: khata.isLoss === true,
    nasirShare: khata.nasirShare,
    aqibShare: khata.aqibShare,
    openingArrears,
    closingArrears,
    arrearsChange: closingArrears - openingArrears,
    arrearsBillCount: khata.arrearsBillCount,
    topDefaulters,
    newConnections
  };
}

/** Standalone single-page printable A4 report HTML. Pure. */
export function buildOwnerMonthReportPrintHtml(report, { lang = null } = {}) {
  if (!report || !report.validMonth) {
    return '<!doctype html><html><body><p>No month selected.</p></body></html>';
  }
  const L = (key, params) => t(key, lang, params);
  const channelRows = (Array.isArray(report.collectionChannels) ? report.collectionChannels : []).map((row) =>
    `<tr><td>${escapeHtml(row.kind === 'cash' ? L('khata2_channel_direct_cash') : row.channel)}</td><td>${escapeHtml(String(row.count))}</td><td>${escapeHtml(formatPKR(row.amount))}</td></tr>`).join('');
  const categoryRows = (Array.isArray(report.expenseCategories) ? report.expenseCategories : []).map((row) =>
    `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(String(row.count))}</td><td>${escapeHtml(formatPKR(row.amount))}</td></tr>`).join('');
  const defaulterRows = (Array.isArray(report.topDefaulters) ? report.topDefaulters : []).map((row, index) =>
    `<tr><td>${escapeHtml(String(index + 1))}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(formatPKR(row.amount))}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(L('omr_title'))} — ${escapeHtml(monthLabel(report.month))}</title><style>
    body{font-family:system-ui,Arial,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}
    h1{font-size:20px}h2{font-size:16px;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}
    table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 4px;border-bottom:1px solid #eee}td:last-child,th:last-child{text-align:right}
    .pair{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}
    .foot{color:#555;font-size:12px;margin-top:24px}
  </style></head><body>
  <h1>📊 ${escapeHtml(L('omr_title'))}</h1>
  <p><strong>Shahdara ISP</strong> · ${escapeHtml(monthLabel(report.month))}</p>
  <h2>${escapeHtml(L('omr_collections'))}</h2>
  <div class="pair"><span>${escapeHtml(L('omr_collected'))} (${escapeHtml(String(report.receiptCount))})</span><strong>${escapeHtml(formatPKR(report.collected))}</strong></div>
  ${channelRows ? `<table><tr><th>${escapeHtml(L('omr_channels'))}</th><th></th><th></th></tr>${channelRows}</table>` : ''}
  <h2>${escapeHtml(L('omr_expenses'))}</h2>
  <div class="pair"><span>${escapeHtml(L('omr_expenses'))} (${escapeHtml(String(report.expenseCount))})</span><strong>${escapeHtml(formatPKR(report.expenses))}</strong></div>
  ${categoryRows ? `<table><tr><th>${escapeHtml(L('omr_expenses'))}</th><th></th><th></th></tr>${categoryRows}</table>` : ''}
  <h2>${escapeHtml(L('omr_shares'))}</h2>
  <div class="pair"><span>${escapeHtml(L('omr_profit'))}${report.isLoss ? escapeHtml(L('omr_loss_suffix')) : ''}</span><strong>${escapeHtml(formatPKR(report.profit))}</strong></div>
  <div class="pair"><span>${escapeHtml(L('omr_nasir_share'))}</span><strong>${escapeHtml(formatPKR(report.nasirShare))}</strong></div>
  <div class="pair"><span>${escapeHtml(L('omr_aqib_share'))}</span><strong>${escapeHtml(formatPKR(report.aqibShare))}</strong></div>
  <h2>${escapeHtml(L('omr_arrears'))}</h2>
  <div class="pair"><span>${escapeHtml(L('omr_opening'))}</span><strong>${escapeHtml(formatPKR(report.openingArrears))}</strong></div>
  <div class="pair"><span>${escapeHtml(L('omr_closing'))}</span><strong>${escapeHtml(formatPKR(report.closingArrears))}</strong></div>
  <div class="pair"><span>${escapeHtml(L('omr_change'))}</span><strong>${escapeHtml(formatPKR(report.arrearsChange))}</strong></div>
  <h2>${escapeHtml(L('omr_defaulters'))}</h2>
  ${defaulterRows ? `<table><tr><th>#</th><th></th><th></th></tr>${defaulterRows}</table>` : `<p>${escapeHtml(L('omr_no_defaulters'))}</p>`}
  <h2>${escapeHtml(L('omr_new_connections'))}</h2>
  <div class="pair"><span>${escapeHtml(L('omr_new_connections'))}</span><strong>${escapeHtml(String(report.newConnections))}</strong></div>
  <p class="foot">${escapeHtml(L('omr_foot'))}</p>
  </body></html>`;
}

/**
 * Dialog controller for the Month-End Owner Report. The entry button
 * lives inside the Owner Khata modal (index.html); the report opens
 * in its own dialog for the month selected there. Returns
 * { open, refresh, close, getReport } or null when the dialog is
 * absent (e.g. unit-test DOM). Following the Owner Khata / letterhead
 * controller pattern.
 */
export function setupOwnerMonthReport(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('ownerMonthReportModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const openBtn = typeof document !== 'undefined' ? document.getElementById('ownerMonthReportBtn') : null;
  let month = pakistanMonthNow();
  let lastReport = null;

  function currentReport() {
    const state = getState();
    const savedSnapshot = (state.monthlyClosings ?? []).find((row) => row.month === month) ?? null;
    return buildOwnerMonthReport(state, month, {
      complaints: loadComplaints(),
      settlements: loadShopSettlements(),
      tickets: loadTickets(),
      notes: loadMonthlyClosingNotes(),
      roznamchaDays: loadRoznamchaDays(),
      charityReservePct: loadCharityReserveSettings().charityReservePct,
      savedSnapshot,
      // The same persisted partner-settings toggle Owner Khata
      // passes, so the shares here and there can never disagree.
      includeInstallationCapexInSplit: loadPartnerSettings().includeInstallationCapexInSplit,
      referenceDate: new Date()
    });
  }

  function render() {
    const report = currentReport();
    lastReport = report;
    const summaryEl = $('ownerMonthReportSummary');
    if (summaryEl) {
      summaryEl.textContent = !report.validMonth
        ? ''
        : `${t('omr_collected')} ${formatPKR(report.collected)} · ${t('omr_profit')} ${formatPKR(report.profit)} · ${t('omr_closing')} ${formatPKR(report.closingArrears)}`;
    }
    const bodyEl = $('ownerMonthReportBody');
    if (bodyEl) {
      const channelLines = report.collectionChannels.map((row) =>
        `<p><span>${escapeHtml(row.kind === 'cash' ? t('khata2_channel_direct_cash') : row.channel)}</span><strong>${escapeHtml(formatPKR(row.amount))}</strong><small> · ${escapeHtml(t(row.count === 1 ? 'khata2_receipt_sing' : 'khata2_receipt_plur', null, { count: row.count }))}</small></p>`).join('');
      const categoryLines = report.expenseCategories.map((row) =>
        `<p><span>${escapeHtml(row.category)}</span><strong>${escapeHtml(formatPKR(row.amount))}</strong><small> · ${escapeHtml(t(row.count === 1 ? 'omr_entry_sing' : 'omr_entry_plur', null, { count: row.count }))}</small></p>`).join('');
      const defaulterLines = report.topDefaulters.length
        ? report.topDefaulters.map((row) =>
          `<p><span>${escapeHtml(row.name)}</span><strong>${escapeHtml(formatPKR(row.amount))}</strong></p>`).join('')
        : `<p><span>${escapeHtml(t('omr_no_defaulters'))}</span></p>`;
      bodyEl.innerHTML = `
        <article class="owner-month-report-section"><h3>${escapeHtml(t('omr_collections'))}</h3>
          <p><span>${escapeHtml(t('omr_collected'))}</span><strong>${escapeHtml(formatPKR(report.collected))}</strong><small> · ${escapeHtml(t(report.receiptCount === 1 ? 'khata2_receipt_sing' : 'khata2_receipt_plur', null, { count: report.receiptCount }))}</small></p>
          ${channelLines}
        </article>
        <article class="owner-month-report-section"><h3>${escapeHtml(t('omr_expenses'))}</h3>
          <p><span>${escapeHtml(t('omr_expenses'))}</span><strong>${escapeHtml(formatPKR(report.expenses))}</strong><small> · ${escapeHtml(t(report.expenseCount === 1 ? 'omr_entry_sing' : 'omr_entry_plur', null, { count: report.expenseCount }))}</small></p>
          ${categoryLines}
        </article>
        <article class="owner-month-report-section"><h3>${escapeHtml(t('omr_shares'))}</h3>
          <p><span>${escapeHtml(t('omr_profit'))}${report.isLoss ? escapeHtml(t('omr_loss_suffix')) : ''}</span><strong>${escapeHtml(formatPKR(report.profit))}</strong></p>
          <p><span>${escapeHtml(t('omr_nasir_share'))}</span><strong>${escapeHtml(formatPKR(report.nasirShare))}</strong></p>
          <p><span>${escapeHtml(t('omr_aqib_share'))}</span><strong>${escapeHtml(formatPKR(report.aqibShare))}</strong></p>
        </article>
        <article class="owner-month-report-section"><h3>${escapeHtml(t('omr_arrears'))}</h3>
          <p><span>${escapeHtml(t('omr_opening'))}</span><strong>${escapeHtml(formatPKR(report.openingArrears))}</strong></p>
          <p><span>${escapeHtml(t('omr_closing'))}</span><strong>${escapeHtml(formatPKR(report.closingArrears))}</strong></p>
          <p><span>${escapeHtml(t('omr_change'))}</span><strong>${escapeHtml(formatPKR(report.arrearsChange))}</strong></p>
          <p><span>${escapeHtml(t('omr_new_connections'))}</span><strong>${escapeHtml(String(report.newConnections))}</strong></p>
        </article>
        <article class="owner-month-report-section"><h3>${escapeHtml(t('omr_defaulters'))}</h3>
          ${defaulterLines}
        </article>
        <p class="owner-month-report-footnote">${escapeHtml(t('omr_foot'))}</p>`;
    }
    return report;
  }

  function open() {
    // Start from the month the owner is already viewing in Owner
    // Khata, so the two surfaces open on the same month.
    const khataMonth = typeof document !== 'undefined' ? document.getElementById('ownerKhataMonth') : null;
    if (khataMonth && MONTH_RE.test(String(khataMonth.value || ''))) month = String(khataMonth.value);
    const monthInput = $('ownerMonthReportMonth');
    if (monthInput) monthInput.value = month;
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.hidden = false;
    render();
  }

  const monthInput = $('ownerMonthReportMonth');
  if (monthInput) {
    monthInput.value = month;
    monthInput.addEventListener('change', () => {
      month = monthInput.value || pakistanMonthNow();
      render();
    });
  }
  if (openBtn) openBtn.addEventListener('click', open);
  const printBtn = $('ownerMonthReportPrintBtn');
  if (printBtn) printBtn.addEventListener('click', () => {
    const report = lastReport ?? render();
    if (!report || !report.validMonth) return;
    const html = buildOwnerMonthReportPrintHtml(report);
    const printWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!printWindow) {
      if (onToast) onToast(t('omr_popup_blocked'));
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  });
  const close = () => { if (typeof dialog.close === 'function' && dialog.open) dialog.close(); else dialog.hidden = true; };
  const closeBtn = $('ownerMonthReportCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', close);
  const closeBtn2 = $('ownerMonthReportCloseBtn2');
  if (closeBtn2) closeBtn2.addEventListener('click', close);

  return { open, refresh: render, close, getReport: () => lastReport };
}
