import { calculateDashboard, calculatePaymentAllocations, derivedBillStatus, buildMonthlyClosingSnapshot, formatPKR } from './core.js';
import { calculateDuesByArea, calculateAreaDetailedBreakdown } from './dashboard-charts.js';

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Calculates extended dashboard KPIs including active subscriber breakdown,
 * bill payment status for the current month, new connections, and collection rates.
 */
export function calculateDashboardKpis(state, referenceDate = new Date()) {
  const totals = calculateDashboard(state, referenceDate);
  const currentMonth = totals.currentMonth;
  const currentCash = buildMonthlyClosingSnapshot(state, currentMonth, referenceDate);
  const allocations = calculatePaymentAllocations(state);

  let paidBillsCount = 0;
  let unpaidBillsCount = 0;
  let partialBillsCount = 0;
  let unpricedBillsCount = 0;
  let totalCurrentMonthBills = 0;

  let newConnectionsCount = 0;

  for (const customer of state.customers) {
    if (customer.archived) continue;

    // Check new connection this month: explicit connectionDate first, then addedOn
    const connMonth = typeof customer.connectionDate === 'string' ? customer.connectionDate.slice(0, 7) : null;
    const addedMonth = typeof customer.addedOn === 'string' ? customer.addedOn.slice(0, 7) : null;
    if (connMonth === currentMonth || (!connMonth && addedMonth === currentMonth)) {
      newConnectionsCount++;
    }

    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      if (bill.month === currentMonth) {
        totalCurrentMonthBills++;
        if (bill.dueAmount === null || bill.dueAmount === undefined || bill.dueAmount === '' || Number(bill.dueAmount) <= 0) {
          unpricedBillsCount++;
          continue;
        }
        const status = derivedBillStatus(customer, bill, allocations);
        if (status === 'paid') paidBillsCount++;
        else if (status === 'partial') partialBillsCount++;
        else unpaidBillsCount++;
      }
    }
  }

  const activePercent = totals.totalCustomers > 0
    ? Math.round((totals.activeServiceCount / totals.totalCustomers) * 100)
    : 0;

  const currentMonthBilled = currentCash.billedAmount;
  const currentMonthCollection = currentCash.collection;

  const collectionRate = currentMonthBilled > 0
    ? Math.round((currentMonthCollection / currentMonthBilled) * 100)
    : null;

  return {
    ...totals,
    activeSubscribers: totals.activeServiceCount,
    activePercent,
    offlineSubscribers: totals.offlineServiceCount,
    unsetSubscribers: totals.unsetServiceCount,
    currentMonth,
    currentCash,
    paidBillsCount,
    unpaidBillsCount,
    partialBillsCount,
    unpricedBillsCount,
    totalCurrentMonthBills,
    currentMonthBilled,
    currentMonthCollection,
    collectionRate,
    newConnectionsCount
  };
}

/**
 * Generates formatted executive summary text suitable for clipboard copy, WhatsApp, or printing.
 */
export function generateDashboardBriefingText(state, referenceDate = new Date()) {
  const kpis = calculateDashboardKpis(state, referenceDate);
  const areas = calculateDuesByArea(state, referenceDate, 4);
  const monthStr = kpis.currentMonth;
  const dateStr = referenceDate.toISOString().slice(0, 10);

  const lines = [
    `📡 SHAHDARA ISP — EXECUTIVE SUMMARY`,
    `Month: ${monthStr} | Date: ${dateStr} PKT`,
    `-----------------------------------------`,
    `[ SUBSCRIBER OVERVIEW ]`,
    `• Total Profiles: ${kpis.totalCustomers}`,
    `• Active Subscribers: ${kpis.activeSubscribers} (${kpis.activePercent}%)`,
    `• Offline: ${kpis.offlineSubscribers} | Unset: ${kpis.unsetSubscribers}`,
    `• New Connections (${monthStr}): ${kpis.newConnectionsCount}`,
    ``,
    `[ MONTHLY FINANCIALS (${monthStr}) ]`,
    `• Billed Snapshot Revenue: ${formatPKR(kpis.currentMonthBilled)}`,
    `• Actual Cash Collected: ${formatPKR(kpis.currentMonthCollection)}${kpis.collectionRate !== null ? ` (${kpis.collectionRate}% collection rate)` : ''}`,
    `• Known Outstanding Dues: ${formatPKR(kpis.totalDue)}`,
    `• Bill Settlement: ${kpis.paidBillsCount} Paid, ${kpis.partialBillsCount} Partial, ${kpis.unpaidBillsCount} Unpaid`
  ];

  if (areas && areas.length > 0) {
    lines.push(``, `[ TOP OUTSTANDING AREAS ]`);
    areas.forEach((a, idx) => {
      lines.push(`${idx + 1}. ${a.area}: ${formatPKR(a.totalDue)} (${a.customerCount} customers)`);
    });
  }

  lines.push(`-----------------------------------------`, `Shahdara ISP Billing Engine — Offline Local Ledger`);
  return lines.join('\n');
}

/**
 * Wires the quick action tiles to their respective callbacks.
 */
export function setupDashboardQuickActions({
  onReceivePayment,
  onAddCustomer,
  onRecordExpense,
  onMonthlyReport,
  onAnalytics,
  onBackup,
  onBriefing
} = {}) {
  function wire(id, handler) {
    const btn = document.getElementById(id);
    if (btn && typeof handler === 'function') {
      const isWired = btn.dataset ? btn.dataset.wiredQuickAction : btn.getAttribute?.('data-wired-quick-action');
      if (!isWired) {
        if (btn.dataset) btn.dataset.wiredQuickAction = 'true';
        else if (btn.setAttribute) btn.setAttribute('data-wired-quick-action', 'true');
        btn.addEventListener('click', handler);
      }
    }
  }

  wire('quickActionReceivePayment', onReceivePayment);
  wire('quickActionAddCustomer', onAddCustomer);
  wire('quickActionRecordExpense', onRecordExpense);
  wire('quickActionMonthlyReports', onMonthlyReport);
  wire('quickActionAnalytics', onAnalytics);
  wire('quickActionBackupData', onBackup);
  wire('quickActionExecutiveBriefing', onBriefing);
}

/**
 * Wires executive briefing button to generate text, copy to clipboard, and show toast.
 */
export function setupDashboardBriefingButton(state, referenceDate = new Date(), { onToast } = {}) {
  const btn = document.getElementById('quickActionExecutiveBriefing');
  if (!btn) return;
  const isWired = btn.dataset ? btn.dataset.wiredBriefing : btn.getAttribute?.('data-wired-briefing');
  if (isWired) return;
  if (btn.dataset) btn.dataset.wiredBriefing = 'true';
  else if (btn.setAttribute) btn.setAttribute('data-wired-briefing', 'true');

  btn.addEventListener('click', async () => {
    const text = generateDashboardBriefingText(state, referenceDate);
    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (typeof onToast === 'function') {
      onToast(copied ? 'Executive Briefing copied to clipboard!' : 'Executive Briefing generated.');
    }
  });
}

/**
 * Wires the Area Drilldown Modal dialog to display a full area table breakdown and filter customer roster.
 */
export function setupAreaDrilldownModal(state, referenceDate = new Date(), { onFilterRoster } = {}) {
  const openBtn = document.getElementById('dashboardOpenAreaModalBtn');
  const modal = document.getElementById('dashboardAreaModal');
  const closeBtn = document.getElementById('dashboardAreaModalCloseBtn');
  const tableBody = document.getElementById('dashboardAreaModalTableBody');

  if (!modal) return;

  function populateAndOpen() {
    const breakdown = calculateAreaDetailedBreakdown(state, referenceDate);
    if (tableBody) {
      if (breakdown.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No customer areas found in ledger.</td></tr>';
      } else {
        tableBody.innerHTML = breakdown.map(item => `
          <tr>
            <td><strong>${escapeXml(item.area)}</strong></td>
            <td>${item.customerCount}</td>
            <td><span class="status-pill status-active">${item.activeCount} active</span> / <span class="status-pill status-offline">${item.offlineCount} offline</span></td>
            <td><strong>${formatPKR(item.totalDue)}</strong></td>
            <td>
              <button type="button" class="action-btn-sm" data-filter-area="${escapeXml(item.area)}">
                Filter Roster
              </button>
            </td>
          </tr>
        `).join('');

        tableBody.querySelectorAll('[data-filter-area]').forEach(btn => {
          btn.addEventListener('click', () => {
            const area = btn.getAttribute('data-filter-area');
            if (modal.close) modal.close();
            else modal.removeAttribute('open');
            if (typeof onFilterRoster === 'function') {
              onFilterRoster(area);
            }
          });
        });
      }
    }

    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
  }

  if (openBtn) {
    const isWired = openBtn.dataset ? openBtn.dataset.wired : openBtn.getAttribute?.('data-wired');
    if (!isWired) {
      if (openBtn.dataset) openBtn.dataset.wired = 'true';
      else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
      openBtn.addEventListener('click', populateAndOpen);
    }
  }

  if (closeBtn) {
    const isWired = closeBtn.dataset ? closeBtn.dataset.wired : closeBtn.getAttribute?.('data-wired');
    if (!isWired) {
      if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
      else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
      closeBtn.addEventListener('click', () => {
        if (modal.close) modal.close();
        else modal.removeAttribute('open');
      });
    }
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });
}

export {
  calculateMonthlyTrends,
  calculateDuesByArea,
  calculateAreaDetailedBreakdown,
  calculatePackageDistribution,
  renderMonthlyTrendSvg,
  renderBillStatusDonutSvg,
  renderAreaDuesSvg,
  renderPackageDistributionSvg,
  renderDashboardCharts,
  setTrendChartDuration,
  getTrendChartDuration,
  setupDashboardChartsEvents,
  PKG_PALETTE
} from './dashboard-charts.js';
