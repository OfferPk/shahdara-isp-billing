import { calculateDashboard, calculatePaymentAllocations, derivedBillStatus, buildMonthlyClosingSnapshot } from './core.js';

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
 * Wires quick action tiles to their respective callbacks.
 */
export function setupDashboardQuickActions({
  onReceivePayment,
  onAddCustomer,
  onRecordExpense,
  onMonthlyReport,
  onAnalytics,
  onBackup
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
}

export {
  calculateMonthlyTrends,
  calculateDuesByArea,
  renderMonthlyTrendSvg,
  renderBillStatusDonutSvg,
  renderAreaDuesSvg,
  renderDashboardCharts
} from './dashboard-charts.js';
