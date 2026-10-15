import { calculateDashboard, calculatePaymentAllocations, derivedBillStatus, buildMonthlyClosingSnapshot, formatPKR, monthsForHistory, listTransactions } from './core.js';
import { calculateDuesByArea, calculateAreaDetailedBreakdown, calculateAreaCollectionHeatmap } from './dashboard-charts.js';

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
 * Calculates current month collection velocity, daily run-rate, days remaining,
 * and projected month-end collection.
 */
export function calculateCollectionVelocity(state, referenceDate = new Date()) {
  const totals = calculateDashboard(state, referenceDate);
  const currentMonth = totals.currentMonth;
  const currentCash = buildMonthlyClosingSnapshot(state, currentMonth, referenceDate);

  const year = parseInt(currentMonth.slice(0, 4), 10);
  const month = parseInt(currentMonth.slice(5, 7), 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const currentDay = Math.max(1, Math.min(referenceDate.getDate(), daysInMonth));

  const collectedSoFar = Number(currentCash.collection) || 0;
  const billedAmount = Number(currentCash.billedAmount) || 0;

  const dailyRunRate = currentDay > 0 ? Math.round(collectedSoFar / currentDay) : 0;
  const daysRemaining = Math.max(0, daysInMonth - currentDay);
  const projectedMonthEnd = Math.round(collectedSoFar + dailyRunRate * daysRemaining);

  const currentRate = billedAmount > 0 ? Math.round((collectedSoFar / billedAmount) * 100) : null;
  const projectedRate = billedAmount > 0 ? Math.round((projectedMonthEnd / billedAmount) * 100) : null;

  return {
    currentMonth,
    daysInMonth,
    currentDay,
    daysRemaining,
    collectedSoFar,
    billedAmount,
    dailyRunRate,
    projectedMonthEnd,
    currentRate,
    projectedRate
  };
}

/**
 * Categorizes active ledger customers into health buckets based on payment delinquency and service status:
 * - goodStanding: Active/non-offline, zero outstanding dues across retained months.
 * - watchlist: 1 unpaid/partial bill, or dues <= monthly rate.
 * - delinquent: 2+ unpaid bills or severe overdue balance.
 * - offline: Service status is 'offline'.
 */
export function calculateCustomerHealthBreakdown(state, referenceDate = new Date()) {
  const allocations = calculatePaymentAllocations(state);
  const retainedMonths = new Set(monthsForHistory(referenceDate));

  let totalTracked = 0;
  const goodStanding = { category: 'goodStanding', label: 'Good Standing', count: 0, percent: 0, totalDue: 0, customerIds: [] };
  const watchlist = { category: 'watchlist', label: 'Watchlist (1 Due)', count: 0, percent: 0, totalDue: 0, customerIds: [] };
  const delinquent = { category: 'delinquent', label: 'Delinquent (2+ Dues)', count: 0, percent: 0, totalDue: 0, customerIds: [] };
  const offline = { category: 'offline', label: 'Offline Service', count: 0, percent: 0, totalDue: 0, customerIds: [] };

  for (const customer of (state.customers ?? [])) {
    if (customer.archived) continue;
    totalTracked++;

    if (customer.serviceStatus === 'offline') {
      offline.count++;
      offline.customerIds.push(customer.id);
      let custDueCents = 0;
      for (const bill of (customer.bills ?? [])) {
        if (!retainedMonths.has(bill.month)) continue;
        const alloc = allocations.forMonth?.(customer.id, bill.month);
        custDueCents += alloc?.balanceDueCents ?? (bill.dueAmount ? Math.round(Number(bill.dueAmount) * 100) : 0);
      }
      offline.totalDue += Math.round(custDueCents / 100);
      continue;
    }

    let unpaidBillsCount = 0;
    let custDueCents = 0;
    for (const bill of (customer.bills ?? [])) {
      if (!retainedMonths.has(bill.month)) continue;
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '' || Number(amount) <= 0) continue;
      const alloc = allocations.forMonth?.(customer.id, bill.month);
      const balanceDueCents = alloc?.balanceDueCents ?? Math.round(Number(amount) * 100);
      if (balanceDueCents > 0) {
        custDueCents += balanceDueCents;
        unpaidBillsCount++;
      }
    }

    const dueAmount = Math.round(custDueCents / 100);

    if (dueAmount === 0) {
      goodStanding.count++;
      goodStanding.customerIds.push(customer.id);
    } else if (unpaidBillsCount <= 1) {
      watchlist.count++;
      watchlist.totalDue += dueAmount;
      watchlist.customerIds.push(customer.id);
    } else {
      delinquent.count++;
      delinquent.totalDue += dueAmount;
      delinquent.customerIds.push(customer.id);
    }
  }

  if (totalTracked > 0) {
    goodStanding.percent = Math.round((goodStanding.count / totalTracked) * 100);
    watchlist.percent = Math.round((watchlist.count / totalTracked) * 100);
    delinquent.percent = Math.round((delinquent.count / totalTracked) * 100);
    offline.percent = Math.round((offline.count / totalTracked) * 100);
  }

  return {
    totalTracked,
    goodStanding,
    watchlist,
    delinquent,
    offline
  };
}

/**
 * Calculates payment method breakdown, transaction counts, digital vs physical cash share,
 * and average ticket sizes for a selected time period ('currentMonth', '30days', 'all').
 */
export function calculatePaymentMethodBreakdown(state, referenceDate = new Date(), { period = 'currentMonth' } = {}) {
  const totals = calculateDashboard(state, referenceDate);
  const currentMonth = totals.currentMonth;

  let txs = [];
  if (period === '30days') {
    txs = listTransactions(state, { recencyDays: 30 }, referenceDate);
  } else {
    txs = listTransactions(state, { recencyDays: null }, referenceDate);
    if (period === 'currentMonth') {
      txs = txs.filter(t => typeof t.date === 'string' && t.date.slice(0, 7) === currentMonth);
    }
  }

  const methodMap = new Map();
  let totalAmount = 0;
  let totalCount = 0;
  let cashTotal = 0;
  let digitalTotal = 0;

  for (const t of txs) {
    const rawMethod = t.method && String(t.method).trim() ? String(t.method).trim() : 'Unspecified';
    const amount = Number(t.amount) || 0;
    if (amount <= 0) continue;

    totalAmount += amount;
    totalCount++;

    const isDigital = ['JazzCash', 'Easypaisa', 'Bank Transfer'].some(m => rawMethod.toLowerCase().includes(m.toLowerCase()));
    if (isDigital) {
      digitalTotal += amount;
    } else {
      cashTotal += amount;
    }

    if (!methodMap.has(rawMethod)) {
      methodMap.set(rawMethod, {
        method: rawMethod,
        amount: 0,
        count: 0,
        isDigital
      });
    }

    const entry = methodMap.get(rawMethod);
    entry.amount += amount;
    entry.count++;
  }

  const methods = [...methodMap.values()]
    .map(m => ({
      ...m,
      percent: totalAmount > 0 ? Math.round((m.amount / totalAmount) * 100) : 0,
      avgAmount: m.count > 0 ? Math.round(m.amount / m.count) : 0
    }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count);

  const cashPercent = totalAmount > 0 ? Math.round((cashTotal / totalAmount) * 100) : 0;
  const digitalPercent = totalAmount > 0 ? Math.round((digitalTotal / totalAmount) * 100) : 0;

  return {
    methods,
    totalAmount,
    totalCount,
    cashTotal,
    digitalTotal,
    cashPercent,
    digitalPercent,
    period,
    currentMonth
  };
}

/**
 * Evaluates retention and churn risk across all unarchived subscriber accounts.
 * Classifies customers into High, Moderate, and Low risk cohorts based on service status,
 * unpaid bill count, delinquency duration, and unconfigured profile parameters.
 */
export function calculateChurnRiskAnalysis(state, referenceDate = new Date()) {
  const allocations = calculatePaymentAllocations(state);
  const retainedMonths = new Set(monthsForHistory(referenceDate));

  let totalCustomers = 0;
  const highRiskCustomers = [];
  const moderateRiskCustomers = [];
  const lowRiskCustomers = [];

  let highRiskTotalDue = 0;
  let moderateRiskTotalDue = 0;

  for (const customer of (state.customers ?? [])) {
    if (customer.archived) continue;
    totalCustomers++;

    let unpaidBillsCount = 0;
    let totalDueCents = 0;
    let latestPaymentDate = null;

    for (const bill of (customer.bills ?? [])) {
      for (const p of (bill.payments ?? [])) {
        if (p.date && (!latestPaymentDate || p.date > latestPaymentDate)) {
          latestPaymentDate = p.date;
        }
      }

      if (!retainedMonths.has(bill.month)) continue;
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '' || Number(amount) <= 0) continue;
      const alloc = allocations.forMonth?.(customer.id, bill.month);
      const balanceDueCents = alloc?.balanceDueCents ?? Math.round(Number(amount) * 100);
      if (balanceDueCents > 0) {
        totalDueCents += balanceDueCents;
        unpaidBillsCount++;
      }
    }

    const totalDue = Math.round(totalDueCents / 100);
    const riskFactors = [];

    let daysSinceLastPayment = null;
    if (latestPaymentDate) {
      const pTime = new Date(latestPaymentDate).getTime();
      const rTime = referenceDate.getTime();
      if (!isNaN(pTime) && !isNaN(rTime)) {
        daysSinceLastPayment = Math.max(0, Math.floor((rTime - pTime) / (1000 * 60 * 60 * 24)));
      }
    }

    const isOffline = customer.serviceStatus === 'offline';
    const isUnset = customer.serviceStatus === 'not-set' || !customer.serviceStatus;

    if (isOffline) {
      riskFactors.push('Offline service');
    }
    if (unpaidBillsCount >= 2) {
      riskFactors.push(`${unpaidBillsCount} overdue bills`);
    } else if (unpaidBillsCount === 1) {
      riskFactors.push('1 unpaid bill');
    }
    if (daysSinceLastPayment !== null && daysSinceLastPayment > 45 && unpaidBillsCount > 0) {
      riskFactors.push(`No payment in ${daysSinceLastPayment} days`);
    }

    const customerSummary = {
      id: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
      area: customer.area || 'Unassigned',
      phone: customer.phone || '',
      serviceStatus: customer.serviceStatus || 'not-set',
      totalDue,
      unpaidBillsCount,
      latestPaymentDate,
      daysSinceLastPayment,
      riskFactors
    };

    if ((isOffline && totalDue > 0) || unpaidBillsCount >= 2 || (isOffline && daysSinceLastPayment !== null && daysSinceLastPayment > 45)) {
      customerSummary.riskLevel = 'high';
      customerSummary.riskBadge = 'High Risk';
      highRiskCustomers.push(customerSummary);
      highRiskTotalDue += totalDue;
    } else if (unpaidBillsCount === 1 || isOffline || isUnset || !customer.packageSpeed) {
      customerSummary.riskLevel = 'moderate';
      customerSummary.riskBadge = 'Moderate Risk';
      if (!isOffline && unpaidBillsCount === 0) {
        if (isUnset) riskFactors.push('Service status unconfigured');
        if (!customer.packageSpeed) riskFactors.push('Package speed not set');
      }
      moderateRiskCustomers.push(customerSummary);
      moderateRiskTotalDue += totalDue;
    } else {
      customerSummary.riskLevel = 'low';
      customerSummary.riskBadge = 'Healthy';
      lowRiskCustomers.push(customerSummary);
    }
  }

  const topAtRiskCustomers = [...highRiskCustomers, ...moderateRiskCustomers]
    .sort((a, b) => b.totalDue - a.totalDue || b.unpaidBillsCount - a.unpaidBillsCount);

  const highRiskCount = highRiskCustomers.length;
  const moderateRiskCount = moderateRiskCustomers.length;
  const lowRiskCount = lowRiskCustomers.length;

  const highPercent = totalCustomers > 0 ? Math.round((highRiskCount / totalCustomers) * 100) : 0;
  const moderatePercent = totalCustomers > 0 ? Math.round((moderateRiskCount / totalCustomers) * 100) : 0;
  const lowPercent = totalCustomers > 0 ? Math.round((lowRiskCount / totalCustomers) * 100) : 0;

  const churnRiskScore = totalCustomers > 0
    ? Math.min(100, Math.round(((highRiskCount * 1.0 + moderateRiskCount * 0.5) / totalCustomers) * 100))
    : 0;

  const atRiskRevenue = highRiskTotalDue + moderateRiskTotalDue;

  let riskTier = 'low';
  let riskTierLabel = 'Low Churn Risk';
  if (churnRiskScore >= 35) {
    riskTier = 'high';
    riskTierLabel = 'High Churn Risk';
  } else if (churnRiskScore >= 15) {
    riskTier = 'moderate';
    riskTierLabel = 'Moderate Churn Risk';
  }

  return {
    totalCustomers,
    churnRiskScore,
    riskTier,
    riskTierLabel,
    atRiskRevenue,
    highRisk: {
      count: highRiskCount,
      percent: highPercent,
      totalDue: highRiskTotalDue,
      customers: highRiskCustomers
    },
    moderateRisk: {
      count: moderateRiskCount,
      percent: moderatePercent,
      totalDue: moderateRiskTotalDue,
      customers: moderateRiskCustomers
    },
    lowRisk: {
      count: lowRiskCount,
      percent: lowPercent,
      customers: lowRiskCustomers
    },
    topAtRiskCustomers
  };
}

/**
 * Generates formatted executive summary text suitable for clipboard copy, WhatsApp, or printing.
 */
export function generateDashboardBriefingText(state, referenceDate = new Date()) {
  const kpis = calculateDashboardKpis(state, referenceDate);
  const health = calculateCustomerHealthBreakdown(state, referenceDate);
  const areas = calculateDuesByArea(state, referenceDate, 4);
  const methods = calculatePaymentMethodBreakdown(state, referenceDate, { period: 'currentMonth' });
  const churn = calculateChurnRiskAnalysis(state, referenceDate);
  const heatmap = calculateAreaCollectionHeatmap(state, referenceDate);
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
    `• Health Standing: ${health.goodStanding.count} Good, ${health.watchlist.count} Watchlist, ${health.delinquent.count} Delinquent, ${health.offline.count} Offline`,
    `• New Connections (${monthStr}): ${kpis.newConnectionsCount}`,
    ``,
    `[ RETENTION & CHURN RISK ]`,
    `• Churn Risk Score: ${churn.churnRiskScore}% (${churn.riskTierLabel})`,
    `• High-Risk Accounts: ${churn.highRisk.count} accounts (${formatPKR(churn.highRisk.totalDue)} dues)`,
    `• Moderate-Risk Accounts: ${churn.moderateRisk.count} accounts (${formatPKR(churn.moderateRisk.totalDue)} dues)`,
    `• Total Revenue at Risk: ${formatPKR(churn.atRiskRevenue)}`,
    ``,
    `[ MONTHLY FINANCIALS (${monthStr}) ]`,
    `• Billed Snapshot Revenue: ${formatPKR(kpis.currentMonthBilled)}`,
    `• Actual Cash Collected: ${formatPKR(kpis.currentMonthCollection)}${kpis.collectionRate !== null ? ` (${kpis.collectionRate}% collection rate)` : ''}`,
    `• Known Outstanding Dues: ${formatPKR(kpis.totalDue)}`,
    `• Bill Settlement: ${kpis.paidBillsCount} Paid, ${kpis.partialBillsCount} Partial, ${kpis.unpaidBillsCount} Unpaid`,
    ``,
    `[ PAYMENT SETTLEMENT CHANNELS (${monthStr}) ]`,
    `• Total Collected: ${formatPKR(methods.totalAmount)} across ${methods.totalCount} receipts`,
    `• Settlement Mix: ${methods.cashPercent}% Cash (${formatPKR(methods.cashTotal)}) | ${methods.digitalPercent}% Digital (${formatPKR(methods.digitalTotal)})`
  ];

  if (methods.methods.length > 0) {
    methods.methods.slice(0, 3).forEach((m, idx) => {
      lines.push(`  ${idx + 1}. ${m.method}: ${formatPKR(m.amount)} (${m.percent}%, ${m.count} txs)`);
    });
  }

  lines.push(
    ``,
    `[ GEOGRAPHIC COLLECTION HEATMAP (${monthStr}) ]`,
    `• Overall Area Recovery: ${heatmap.summary.overallRecoveryRate}% across ${heatmap.summary.totalAreas} zones`,
    `• Zone Health: ${heatmap.summary.highRecoveryCount} Optimal, ${heatmap.summary.moderateRecoveryCount} Moderate, ${heatmap.summary.laggingCount} Lagging`
  );
  if (heatmap.summary.topPerformingArea) {
    lines.push(`• Top Performing Zone: ${heatmap.summary.topPerformingArea.area} (${heatmap.summary.topPerformingArea.rate}% recovery)`);
  }
  if (heatmap.summary.highestDueArea) {
    lines.push(`• Highest Outstanding Dues: ${heatmap.summary.highestDueArea.area} (${formatPKR(heatmap.summary.highestDueArea.due)})`);
  }

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
 * Generates rich semantic HTML for the printable executive operations slip.
 */
export function generateDashboardBriefingHtml(state, referenceDate = new Date()) {
  const kpis = calculateDashboardKpis(state, referenceDate);
  const velocity = calculateCollectionVelocity(state, referenceDate);
  const health = calculateCustomerHealthBreakdown(state, referenceDate);
  const areas = calculateDuesByArea(state, referenceDate, 4);
  const methods = calculatePaymentMethodBreakdown(state, referenceDate, { period: 'currentMonth' });
  const churn = calculateChurnRiskAnalysis(state, referenceDate);
  const heatmap = calculateAreaCollectionHeatmap(state, referenceDate);
  const monthStr = kpis.currentMonth;
  const dateStr = referenceDate.toISOString().slice(0, 10);

  return `
    <div class="briefing-slip">
      <div class="briefing-slip-header">
        <div class="briefing-brand">
          <span class="briefing-logo-icon">📡</span>
          <span class="briefing-brand-name">SHAHDARA ISP OPERATIONS</span>
        </div>
        <h4 class="briefing-slip-title">EXECUTIVE LEDGER BRIEFING</h4>
        <p class="briefing-meta">Billing Month: <strong>${monthStr}</strong> · Generated: ${dateStr} PKT</p>
      </div>

      <div class="briefing-divider"></div>

      <div class="briefing-section">
        <h5 class="briefing-sec-title">SUBSCRIBER HEALTH MATRIX</h5>
        <div class="briefing-grid-2">
          <div class="briefing-stat-row"><span>Total Profiles:</span> <strong>${kpis.totalCustomers}</strong></div>
          <div class="briefing-stat-row"><span>Active Subscribers:</span> <strong>${kpis.activeSubscribers} (${kpis.activePercent}%)</strong></div>
          <div class="briefing-stat-row"><span>Good Standing:</span> <strong class="text-success">${health.goodStanding.count} (${health.goodStanding.percent}%)</strong></div>
          <div class="briefing-stat-row"><span>Watchlist (1 Due):</span> <strong class="text-warning">${health.watchlist.count} (${health.watchlist.percent}%)</strong></div>
          <div class="briefing-stat-row"><span>Delinquent (2+):</span> <strong class="text-danger">${health.delinquent.count} (${health.delinquent.percent}%)</strong></div>
          <div class="briefing-stat-row"><span>Offline Service:</span> <strong class="text-muted">${health.offline.count} (${health.offline.percent}%)</strong></div>
        </div>
      </div>

      <div class="briefing-divider"></div>

      <div class="briefing-section">
        <h5 class="briefing-sec-title">RETENTION &amp; CHURN RISK</h5>
        <div class="briefing-grid-2">
          <div class="briefing-stat-row"><span>Risk Score:</span> <strong class="text-${churn.riskTier === 'high' ? 'danger' : (churn.riskTier === 'moderate' ? 'warning' : 'success')}">${churn.churnRiskScore}% (${churn.riskTierLabel})</strong></div>
          <div class="briefing-stat-row"><span>Revenue at Risk:</span> <strong class="text-danger">${formatPKR(churn.atRiskRevenue)}</strong></div>
          <div class="briefing-stat-row"><span>High Risk Accounts:</span> <strong>${churn.highRisk.count}</strong></div>
          <div class="briefing-stat-row"><span>Moderate Risk:</span> <strong>${churn.moderateRisk.count}</strong></div>
        </div>
      </div>

      <div class="briefing-divider"></div>

      <div class="briefing-section">
        <h5 class="briefing-sec-title">MONTHLY FINANCIAL PERFORMANCE (${monthStr})</h5>
        <table class="briefing-data-table">
          <tbody>
            <tr>
              <td>Billed Snapshot Revenue:</td>
              <td class="text-right"><strong>${formatPKR(kpis.currentMonthBilled)}</strong></td>
            </tr>
            <tr>
              <td>Actual Cash Collected:</td>
              <td class="text-right"><strong class="text-success">${formatPKR(kpis.currentMonthCollection)}</strong></td>
            </tr>
            <tr>
              <td>Collection Rate:</td>
              <td class="text-right"><strong>${kpis.collectionRate !== null ? `${kpis.collectionRate}%` : 'N/A'}</strong></td>
            </tr>
            <tr>
              <td>Daily Run Rate:</td>
              <td class="text-right"><strong>${formatPKR(velocity.dailyRunRate)} / day</strong></td>
            </tr>
            <tr>
              <td>Projected Month-End:</td>
              <td class="text-right"><strong>${formatPKR(velocity.projectedMonthEnd)}</strong></td>
            </tr>
            <tr>
              <td>Known Outstanding Dues:</td>
              <td class="text-right"><strong class="text-danger">${formatPKR(kpis.totalDue)}</strong></td>
            </tr>
            <tr>
              <td>Bill Settlements:</td>
              <td class="text-right"><strong>${kpis.paidBillsCount} Paid · ${kpis.partialBillsCount} Partial · ${kpis.unpaidBillsCount} Unpaid</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="briefing-divider"></div>

      <div class="briefing-section">
        <h5 class="briefing-sec-title">PAYMENT SETTLEMENT CHANNELS (${monthStr})</h5>
        <div class="briefing-stat-row">
          <span>Settlement Mix:</span>
          <strong>${methods.cashPercent}% Cash · ${methods.digitalPercent}% Digital</strong>
        </div>
        ${methods.methods.length > 0 ? `
        <table class="briefing-data-table">
          <tbody>
            ${methods.methods.slice(0, 4).map(m => `
              <tr>
                <td>${escapeXml(m.method)} (${m.count} txs)</td>
                <td class="text-right"><strong>${formatPKR(m.amount)}</strong> <small class="text-muted">(${m.percent}%)</small></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p class="text-muted" style="margin: 4px 0; font-size: 11px;">No payments recorded in current billing month.</p>'}
      </div>

      <div class="briefing-divider"></div>

      <div class="briefing-section">
        <h5 class="briefing-sec-title">GEOGRAPHIC COLLECTION HEATMAP (${monthStr})</h5>
        <div class="briefing-grid-2">
          <div class="briefing-stat-row"><span>Overall Recovery:</span> <strong class="text-${heatmap.summary.overallRecoveryRate >= 80 ? 'success' : 'warning'}">${heatmap.summary.overallRecoveryRate}%</strong></div>
          <div class="briefing-stat-row"><span>Total Zones:</span> <strong>${heatmap.summary.totalAreas} Areas</strong></div>
          <div class="briefing-stat-row"><span>Optimal (≥85%):</span> <strong class="text-success">${heatmap.summary.highRecoveryCount}</strong></div>
          <div class="briefing-stat-row"><span>Moderate (60-84%):</span> <strong class="text-warning">${heatmap.summary.moderateRecoveryCount}</strong></div>
          <div class="briefing-stat-row"><span>Lagging (&lt;60%):</span> <strong class="text-danger">${heatmap.summary.laggingCount}</strong></div>
          <div class="briefing-stat-row"><span>Top Recovery Zone:</span> <strong class="text-success">${escapeXml(heatmap.summary.topPerformingArea?.area || 'None')} (${heatmap.summary.topPerformingArea?.rate || 0}%)</strong></div>
        </div>
      </div>

      ${areas.length > 0 ? `
      <div class="briefing-divider"></div>
      <div class="briefing-section">
        <h5 class="briefing-sec-title">TOP OUTSTANDING AREAS</h5>
        <ul class="briefing-area-list">
          ${areas.map(a => `<li><span>${escapeXml(a.area)} (${a.customerCount} cust)</span> <strong>${formatPKR(a.totalDue)}</strong></li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="briefing-divider"></div>

      <div class="briefing-slip-footer">
        <p>Shahdara ISP Billing Ledger · Offline Device Verification</p>
        <p class="briefing-signature">Authorized Signature: _________________________</p>
      </div>
    </div>
  `;
}

/**
 * Wires the Executive Briefing Modal dialog with slip preview, print, copy, and WhatsApp sharing.
 */
export function setupDashboardBriefingModal(state, referenceDate = new Date(), { onToast, clipboard } = {}) {
  const modal = document.getElementById('dashboardBriefingModal');
  const slipContainer = document.getElementById('dashboardBriefingSlipContent');
  const closeBtn = document.getElementById('dashboardBriefingModalCloseBtn');
  const printBtn = document.getElementById('dashboardBriefingPrintBtn');
  const copyBtn = document.getElementById('dashboardBriefingCopyBtn');
  const whatsappBtn = document.getElementById('dashboardBriefingWhatsappBtn');
  const openTile = document.getElementById('quickActionExecutiveBriefing');

  function openBriefing() {
    if (slipContainer) {
      slipContainer.innerHTML = generateDashboardBriefingHtml(state, referenceDate);
    }
    if (modal) {
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
    }
  }

  if (openTile) {
    const isWired = openTile.dataset ? openTile.dataset.wiredBriefingModal : openTile.getAttribute?.('data-wired-briefing-modal');
    if (!isWired) {
      if (openTile.dataset) openTile.dataset.wiredBriefingModal = 'true';
      else if (openTile.setAttribute) openTile.setAttribute('data-wired-briefing-modal', 'true');
      openTile.addEventListener('click', openBriefing);
    }
  }

  if (closeBtn) {
    const isWired = closeBtn.dataset ? closeBtn.dataset.wired : closeBtn.getAttribute?.('data-wired');
    if (!isWired) {
      if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
      else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
      closeBtn.addEventListener('click', () => {
        if (modal) {
          if (modal.close) modal.close();
          else modal.removeAttribute('open');
        }
      });
    }
  }

  if (printBtn) {
    const isWired = printBtn.dataset ? printBtn.dataset.wired : printBtn.getAttribute?.('data-wired');
    if (!isWired) {
      if (printBtn.dataset) printBtn.dataset.wired = 'true';
      else if (printBtn.setAttribute) printBtn.setAttribute('data-wired', 'true');
      printBtn.addEventListener('click', () => {
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
          window.print();
        }
      });
    }
  }

  if (copyBtn) {
    const isWired = copyBtn.dataset ? copyBtn.dataset.wired : copyBtn.getAttribute?.('data-wired');
    if (!isWired) {
      if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
      else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
      copyBtn.addEventListener('click', async () => {
        const text = generateDashboardBriefingText(state, referenceDate);
        let copied = false;
        const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
        if (clip && typeof clip.writeText === 'function') {
          try {
            await clip.writeText(text);
            copied = true;
          } catch {
            copied = false;
          }
        }
        if (typeof onToast === 'function') {
          onToast(copied ? 'Briefing text copied to clipboard!' : 'Briefing text generated.');
        }
      });
    }
  }

  if (whatsappBtn) {
    const isWired = whatsappBtn.dataset ? whatsappBtn.dataset.wired : whatsappBtn.getAttribute?.('data-wired');
    if (!isWired) {
      if (whatsappBtn.dataset) whatsappBtn.dataset.wired = 'true';
      else if (whatsappBtn.setAttribute) whatsappBtn.setAttribute('data-wired', 'true');
      whatsappBtn.addEventListener('click', () => {
        const text = generateDashboardBriefingText(state, referenceDate);
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        if (typeof window !== 'undefined' && typeof window.open === 'function') {
          window.open(url, '_blank');
        }
      });
    }
  }

  if (modal) {
    const isWired = modal.dataset ? modal.dataset.wiredClickOutside : modal.getAttribute?.('data-wired-click-outside');
    if (!isWired) {
      if (modal.dataset) modal.dataset.wiredClickOutside = 'true';
      else if (modal.setAttribute) modal.setAttribute('data-wired-click-outside', 'true');
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (modal.close) modal.close();
          else modal.removeAttribute('open');
        }
      });
    }
  }
}

/**
 * Wires executive briefing button to generate text, copy to clipboard, or open briefing modal.
 */
export function setupDashboardBriefingButton(state, referenceDate = new Date(), { onToast, clipboard } = {}) {
  const modal = document.getElementById('dashboardBriefingModal');
  if (modal) {
    setupDashboardBriefingModal(state, referenceDate, { onToast, clipboard });
    return;
  }
  const btn = document.getElementById('quickActionExecutiveBriefing');
  if (!btn) return;
  const isWired = btn.dataset ? btn.dataset.wiredBriefing : btn.getAttribute?.('data-wired-briefing');
  if (isWired) return;
  if (btn.dataset) btn.dataset.wiredBriefing = 'true';
  else if (btn.setAttribute) btn.setAttribute('data-wired-briefing', 'true');

  btn.addEventListener('click', async () => {
    const text = generateDashboardBriefingText(state, referenceDate);
    let copied = false;
    const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
    if (clip && typeof clip.writeText === 'function') {
      try {
        await clip.writeText(text);
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
 * Wires customer health action filter buttons to filter customer roster.
 */
export function setupCustomerHealthActions(state, referenceDate = new Date(), { onFilterHealth } = {}) {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  const buttons = document.querySelectorAll('[data-filter-health]');
  const healthData = calculateCustomerHealthBreakdown(state, referenceDate);

  buttons.forEach(btn => {
    const isWired = btn.dataset ? btn.dataset.wiredHealth : btn.getAttribute?.('data-wired-health');
    if (isWired) return;
    if (btn.dataset) btn.dataset.wiredHealth = 'true';
    else if (btn.setAttribute) btn.setAttribute('data-wired-health', 'true');
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-filter-health') || btn.dataset?.filterHealth;
      if (typeof onFilterHealth === 'function') {
        onFilterHealth(category, healthData);
      }
    });
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

/**
 * Wires the Churn Risk Modal dialog to display at-risk subscriber breakdown and filter customer roster.
 */
export function setupChurnRiskModal(state, referenceDate = new Date(), { onFilterCustomer } = {}) {
  const openBtn = document.getElementById('dashboardOpenChurnModalBtn');
  const modal = document.getElementById('dashboardChurnRiskModal');
  const closeBtn = document.getElementById('dashboardChurnModalCloseBtn');
  const tableBody = document.getElementById('dashboardChurnModalTableBody');

  if (!modal) return;

  function populateAndOpen() {
    const analysis = calculateChurnRiskAnalysis(state, referenceDate);
    if (tableBody) {
      if (analysis.topAtRiskCustomers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">All subscriber accounts are healthy with zero overdue balances.</td></tr>';
      } else {
        tableBody.innerHTML = analysis.topAtRiskCustomers.map(cust => `
          <tr>
            <td>
              <strong>${escapeXml(cust.name)}</strong>
              <div class="cust-sub-meta">#${cust.customerNumber} · ${escapeXml(cust.area)}</div>
            </td>
            <td>
              <span class="status-pill status-${cust.riskLevel}">${cust.riskBadge}</span>
            </td>
            <td>
              <span class="risk-factors-text">${escapeXml(cust.riskFactors.join(', ') || 'None')}</span>
            </td>
            <td>
              <strong class="text-${cust.totalDue > 0 ? 'danger' : 'muted'}">${formatPKR(cust.totalDue)}</strong>
            </td>
            <td>
              <button type="button" class="action-btn-sm" data-filter-customer="${escapeXml(cust.name)}">
                View Roster
              </button>
            </td>
          </tr>
        `).join('');

        tableBody.querySelectorAll('[data-filter-customer]').forEach(btn => {
          btn.addEventListener('click', () => {
            const name = btn.getAttribute('data-filter-customer');
            if (modal.close) modal.close();
            else modal.removeAttribute('open');
            if (typeof onFilterCustomer === 'function') {
              onFilterCustomer(name);
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

/**
 * Sets up interactions for the Geographic Area Heatmap, allowing direct clicking on
 * area rows to filter the customer roster by area.
 */
export function setupAreaHeatmapEvents(state, referenceDate = new Date(), { onFilterArea } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const container = document.getElementById('dashboardHeatmapChart');
  if (!container) return;

  const isWired = container.dataset ? container.dataset.wired : container.getAttribute?.('data-wired');
  if (!isWired) {
    if (container.dataset) container.dataset.wired = 'true';
    else if (container.setAttribute) container.setAttribute('data-wired', 'true');

    container.addEventListener('click', (e) => {
      const row = e.target.closest?.('.heatmap-area-row');
      if (!row) return;
      const ariaLabel = row.getAttribute?.('aria-label') || '';
      const areaName = ariaLabel.split(':')[0]?.trim();
      if (areaName && typeof onFilterArea === 'function') {
        onFilterArea(areaName);
      }
    });
  }
}

export {
  calculateMonthlyTrends,
  calculateDuesByArea,
  calculateAreaDetailedBreakdown,
  calculateAreaCollectionHeatmap,
  calculatePackageDistribution,
  renderMonthlyTrendSvg,
  renderBillStatusDonutSvg,
  renderAreaDuesSvg,
  renderPackageDistributionSvg,
  renderCustomerHealthSvg,
  renderPaymentMethodSvg,
  renderChurnRiskGaugeSvg,
  renderAreaCollectionHeatmapSvg,
  renderDashboardCharts,
  setTrendChartDuration,
  getTrendChartDuration,
  setMethodChartPeriod,
  getMethodChartPeriod,
  setHeatmapFilter,
  getHeatmapFilter,
  setupDashboardChartsEvents,
  PKG_PALETTE,
  METHOD_COLORS
} from './dashboard-charts.js';

