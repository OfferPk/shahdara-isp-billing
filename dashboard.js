import { calculateDashboard, calculatePaymentAllocations, derivedBillStatus, buildMonthlyClosingSnapshot, formatPKR, monthsForHistory, listTransactions, summarizeCustomerTenure } from './core.js';
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
 * Calculates end-of-day register closing metrics, comparing today's collected receipts
 * against average daily revenue benchmark run rate, breakdown by payment channel, and daily closing status.
 */
export function calculateDailyClosingSummary(state, referenceDate = new Date()) {
  const kpis = calculateDashboardKpis(state, referenceDate);
  const currentMonth = kpis.currentMonth;
  const todayStr = referenceDate.toISOString().slice(0, 10);

  // Determine days in current month
  const [yearStr, monthNumStr] = currentMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthNumStr, 10);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const dailyTarget = kpis.currentMonthBilled > 0 ? Math.round(kpis.currentMonthBilled / daysInMonth) : 0;

  let todayCollectedCents = 0;
  let todayCount = 0;
  const methodMap = new Map();

  for (const customer of (state.customers ?? [])) {
    if (customer.archived) continue;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      for (const p of payments) {
        if (p.date === todayStr) {
          const amt = Number(p.amount) || 0;
          if (amt > 0) {
            todayCollectedCents += Math.round(amt * 100);
            todayCount++;
            const method = (p.method && String(p.method).trim()) ? String(p.method).trim() : 'Cash';
            methodMap.set(method, (methodMap.get(method) || 0) + amt);
          }
        }
      }
    }
  }

  const todayCollected = Math.round(todayCollectedCents / 100);
  const targetAttainment = dailyTarget > 0 ? Math.round((todayCollected / dailyTarget) * 100) : (todayCollected > 0 ? 100 : 0);
  const averageTicket = todayCount > 0 ? Math.round(todayCollected / todayCount) : 0;

  const methods = [...methodMap.entries()].map(([method, amount]) => ({
    method,
    amount,
    percent: todayCollected > 0 ? Math.round((amount / todayCollected) * 100) : 0
  })).sort((a, b) => b.amount - a.amount);

  let closingStatus = 'no-activity';
  let statusLabel = 'No Activity Today';
  if (todayCount > 0) {
    if (targetAttainment >= 100) {
      closingStatus = 'exceeded';
      statusLabel = 'Target Met (100%+)';
    } else if (targetAttainment >= 60) {
      closingStatus = 'on-track';
      statusLabel = 'On Track';
    } else {
      closingStatus = 'below-target';
      statusLabel = 'Below Target';
    }
  }

  return {
    todayStr,
    todayCollected,
    todayCount,
    dailyTarget,
    targetAttainment,
    averageTicket,
    methods,
    closingStatus,
    statusLabel
  };
}

/**
 * Generates an executive daily closing summary text snippet for quick WhatsApp or clipboard dispatch.
 */
export function generateDailyClosingSlipText(state, referenceDate = new Date()) {
  const summary = calculateDailyClosingSummary(state, referenceDate);
  const lines = [
    `💰 SHAHDARA ISP — DAILY REGISTER CLOSING`,
    `Date: ${summary.todayStr} PKT`,
    `-----------------------------------------`,
    `• Total Collections Today: ${formatPKR(summary.todayCollected)} (${summary.todayCount} transactions)`,
    `• Daily Benchmark Target: ${formatPKR(summary.dailyTarget)} (${summary.targetAttainment}% attainment)`,
    `• Average Ticket Size: ${formatPKR(summary.averageTicket)}`,
    `• Closing Status: ${summary.statusLabel}`,
    ``,
    `[ PAYMENT METHODS TODAY ]`
  ];

  if (summary.methods.length > 0) {
    summary.methods.forEach(m => {
      lines.push(`• ${m.method}: ${formatPKR(m.amount)} (${m.percent}%)`);
    });
  } else {
    lines.push(`• No receipts recorded for ${summary.todayStr}`);
  }

  lines.push(`-----------------------------------------`, `Verified Local Device Register`);
  return lines.join('\n');
}

/**
 * Sets up and updates the daily closing card on the billing dashboard.
 */
export function setupDailyClosingCard(state, referenceDate = new Date(), { onToast, clipboard } = {}) {
  const summary = calculateDailyClosingSummary(state, referenceDate);
  const valueEl = document.getElementById('dashboardDailyClosingValue');
  const periodEl = document.getElementById('dashboardDailyClosingPeriod');
  const badgeEl = document.getElementById('dashboardClosingStatusBadge');
  const slipBtn = document.getElementById('quickActionDailyClosingSlip');

  if (valueEl) {
    valueEl.textContent = summary.todayCount > 0
      ? `${formatPKR(summary.todayCollected)} (${summary.todayCount} txs)`
      : 'No payment entries';
  }

  if (periodEl) {
    periodEl.textContent = `Target: ${formatPKR(summary.dailyTarget)} / day · ${summary.targetAttainment}% attainment`;
  }

  if (badgeEl) {
    badgeEl.textContent = summary.statusLabel;
    badgeEl.className = `closing-badge badge-${summary.closingStatus}`;
  }

  if (slipBtn) {
    const isWired = slipBtn.dataset ? slipBtn.dataset.wired : slipBtn.getAttribute?.('data-wired');
    if (!isWired) {
      if (slipBtn.dataset) slipBtn.dataset.wired = 'true';
      else if (slipBtn.setAttribute) slipBtn.setAttribute('data-wired', 'true');

      slipBtn.addEventListener('click', async () => {
        const text = generateDailyClosingSlipText(state, referenceDate);
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
          onToast(copied ? 'Daily closing slip copied to clipboard!' : 'Daily closing summary ready.');
        }
      });
    }
  }
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

/**
 * Calculates Customer Lifetime Value (LTV) and groups subscribers into tenure cohorts
 * (< 3m, 3-6m, 6-12m, 12-24m, 24m+) with retention rates, average LTV, portfolio multiplier,
 * and top accounts leaderboard.
 */
export function calculateCustomerLtvCohorts(state, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const refYear = ref.getFullYear();
  const refMonth = ref.getMonth() + 1;

  const cohortDefs = [
    { key: '0-3', label: '< 3 Months', minMonths: 1, maxMonths: 2 },
    { key: '3-6', label: '3 - 6 Months', minMonths: 3, maxMonths: 5 },
    { key: '6-12', label: '6 - 12 Months', minMonths: 6, maxMonths: 11 },
    { key: '12-24', label: '1 - 2 Years', minMonths: 12, maxMonths: 23 },
    { key: '24+', label: '2+ Years', minMonths: 24, maxMonths: 9999 }
  ];

  const cohorts = cohortDefs.map(def => ({
    key: def.key,
    label: def.label,
    customerCount: 0,
    activeCount: 0,
    offlineCount: 0,
    archivedCount: 0,
    totalLtv: 0,
    averageLtv: 0,
    averageTenureMonths: 0,
    retentionRate: 0,
    churnRate: 0,
    customerIds: []
  }));

  const cohortMap = new Map(cohorts.map(c => [c.key, c]));

  let totalTrackedCustomers = 0;
  let overallTotalLtv = 0;
  let totalTenureMonthsSum = 0;
  const customerLtvList = [];
  const packageLtvMap = new Map();

  for (const customer of (state?.customers ?? [])) {
    totalTrackedCustomers++;

    let customerTotalLtvCents = 0;
    for (const bill of (customer.bills ?? [])) {
      for (const p of (bill.payments ?? [])) {
        const amt = Number(p.amount) || 0;
        if (amt > 0) {
          customerTotalLtvCents += Math.round(amt * 100);
        }
      }
    }
    const customerTotalLtv = Math.round(customerTotalLtvCents / 100);
    overallTotalLtv += customerTotalLtv;

    let tenureMonths = 1;
    let tenureSummary = null;
    try {
      tenureSummary = summarizeCustomerTenure(customer, ref);
    } catch {
      tenureSummary = null;
    }

    if (tenureSummary?.serviceMonths && tenureSummary.serviceMonths > 0) {
      tenureMonths = tenureSummary.serviceMonths;
    } else {
      let startDateStr = customer.connectionDate || customer.addedOn;
      if (!startDateStr) {
        const billMonths = (customer.bills ?? []).map(b => b.month).filter(Boolean).sort();
        if (billMonths.length > 0) {
          startDateStr = billMonths[0] + '-01';
        }
      }
      if (startDateStr) {
        const sYear = Number(String(startDateStr).slice(0, 4));
        const sMonth = Number(String(startDateStr).slice(5, 7));
        if (Number.isFinite(sYear) && Number.isFinite(sMonth) && sMonth >= 1 && sMonth <= 12) {
          const diff = (refYear - sYear) * 12 + (refMonth - sMonth) + 1;
          tenureMonths = Math.max(1, diff);
        }
      }
    }

    totalTenureMonthsSum += tenureMonths;

    const isArchived = Boolean(customer.archived);
    const serviceStatus = isArchived ? 'archived' : (customer.serviceStatus || 'not-set');
    const isActive = !isArchived && serviceStatus === 'active';
    const isOffline = !isArchived && serviceStatus === 'offline';

    let matchedCohort = cohorts[cohorts.length - 1];
    for (const def of cohortDefs) {
      if (tenureMonths >= def.minMonths && tenureMonths <= def.maxMonths) {
        matchedCohort = cohortMap.get(def.key);
        break;
      }
    }

    matchedCohort.customerCount++;
    matchedCohort.customerIds.push(customer.id);
    matchedCohort.totalLtv += customerTotalLtv;
    matchedCohort.averageTenureMonths += tenureMonths;

    if (isActive) matchedCohort.activeCount++;
    else if (isOffline) matchedCohort.offlineCount++;
    if (isArchived) matchedCohort.archivedCount++;

    const pkgName = customer.packageSpeed || customer.package || 'Standard';
    customerLtvList.push({
      id: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name,
      area: customer.area || 'Unassigned',
      package: pkgName,
      totalLtv: customerTotalLtv,
      tenureMonths,
      serviceStatus,
      isArchived
    });

    if (!packageLtvMap.has(pkgName)) {
      packageLtvMap.set(pkgName, { package: pkgName, customerCount: 0, totalLtv: 0, averageLtv: 0 });
    }
    const pkgEntry = packageLtvMap.get(pkgName);
    pkgEntry.customerCount++;
    pkgEntry.totalLtv += customerTotalLtv;
  }

  for (const c of cohorts) {
    if (c.customerCount > 0) {
      c.averageLtv = Math.round(c.totalLtv / c.customerCount);
      c.averageTenureMonths = Number((c.averageTenureMonths / c.customerCount).toFixed(1));
      c.retentionRate = Math.round((c.activeCount / c.customerCount) * 100);
      c.churnRate = Math.round((c.archivedCount / c.customerCount) * 100);
    }
  }

  const packageLtvList = Array.from(packageLtvMap.values()).map(p => ({
    ...p,
    averageLtv: p.customerCount > 0 ? Math.round(p.totalLtv / p.customerCount) : 0
  })).sort((a, b) => b.totalLtv - a.totalLtv);

  const topLtvCustomers = [...customerLtvList].sort((a, b) => b.totalLtv - a.totalLtv).slice(0, 5);

  const overallAverageLtv = totalTrackedCustomers > 0 ? Math.round(overallTotalLtv / totalTrackedCustomers) : 0;
  const overallAverageTenure = totalTrackedCustomers > 0 ? Number((totalTenureMonthsSum / totalTrackedCustomers).toFixed(1)) : 0;

  let currentMonthArpu = 0;
  try {
    const kpis = calculateDashboardKpis(state, ref);
    currentMonthArpu = kpis?.averageRevenuePerUser || 0;
  } catch {
    currentMonthArpu = 0;
  }
  const ltvMultiplier = currentMonthArpu > 0 ? Number((overallAverageLtv / currentMonthArpu).toFixed(1)) : 0;

  return {
    totalTrackedCustomers,
    overallTotalLtv,
    overallAverageLtv,
    overallAverageTenure,
    currentMonthArpu,
    ltvMultiplier,
    cohorts,
    topLtvCustomers,
    packageLtvList
  };
}

/**
 * Formats an executive briefing plain-text breakdown of customer lifetime value and tenure dynamics.
 */
export function generateLtvBriefingReport(ltvData, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);
  const lines = [
    `=========================================`,
    `SHAHDARA ISP - CUSTOMER LTV & COHORT REPORT`,
    `Generated: ${dateStr} PKT`,
    `=========================================`,
    `[ PORTFOLIO LIFETIME VALUE METRICS ]`,
    `  Total Customers Tracked: ${ltvData.totalTrackedCustomers}`,
    `  Total Lifetime Revenue: ${formatPKR(ltvData.overallTotalLtv)}`,
    `  Average Customer LTV: ${formatPKR(ltvData.overallAverageLtv)}`,
    `  Average Customer Tenure: ${ltvData.overallAverageTenure} months`,
    `  Current Monthly ARPU: ${formatPKR(ltvData.currentMonthArpu)}`,
    `  LTV / ARPU Multiplier: ${ltvData.ltvMultiplier}x`,
    ``,
    `[ TENURE COHORT BREAKDOWN ]`
  ];

  for (const c of (ltvData.cohorts ?? [])) {
    lines.push(`  ${c.label} (${c.customerCount} subs, ${c.retentionRate}% active):`);
    lines.push(`    Total LTV: ${formatPKR(c.totalLtv)} | Avg LTV: ${formatPKR(c.averageLtv)} | Avg Tenure: ${c.averageTenureMonths}m`);
  }

  if ((ltvData.topLtvCustomers ?? []).length > 0) {
    lines.push(``);
    lines.push(`[ TOP LIFETIME VALUE SUBSCRIBERS ]`);
    for (const cust of ltvData.topLtvCustomers) {
      lines.push(`  #${cust.customerNumber} ${cust.name} (${cust.area}): ${formatPKR(cust.totalLtv)} (${cust.tenureMonths}m tenure, ${cust.package})`);
    }
  }

  lines.push(`=========================================`);
  return lines.join('\n');
}

/**
 * Wires the Customer Lifetime Value (LTV) Cohorts Modal dialog.
 */
export function setupLtvCohortModal(state, { referenceDate = new Date(), onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardLtvModal');
  const openBtn = document.getElementById('dashboardOpenLtvModalBtn');
  const closeBtn = document.getElementById('dashboardLtvModalCloseBtn');
  const cohortTableBody = document.getElementById('dashboardLtvCohortTableBody');
  const topAccountsTableBody = document.getElementById('dashboardLtvTopAccountsTableBody');
  const copyBtn = document.getElementById('dashboardCopyLtvReportBtn');

  if (!modal) return;

  function populateAndOpen() {
    const ltvData = calculateCustomerLtvCohorts(state, referenceDate);

    const avgEl = document.getElementById('dashboardLtvAvgVal');
    const totalEl = document.getElementById('dashboardLtvTotalVal');
    const tenureEl = document.getElementById('dashboardLtvTenureVal');
    const multiEl = document.getElementById('dashboardLtvMultiplierVal');

    if (avgEl) avgEl.textContent = formatPKR(ltvData.overallAverageLtv);
    if (totalEl) totalEl.textContent = formatPKR(ltvData.overallTotalLtv);
    if (tenureEl) tenureEl.textContent = `${ltvData.overallAverageTenure} mos`;
    if (multiEl) multiEl.textContent = `${ltvData.ltvMultiplier}x`;

    if (cohortTableBody) {
      if (ltvData.cohorts.length === 0) {
        cohortTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No subscriber cohort data available.</td></tr>';
      } else {
        cohortTableBody.innerHTML = ltvData.cohorts.map(c => `
          <tr>
            <td><strong>${escapeXml(c.label)}</strong></td>
            <td>${c.customerCount} <span class="cust-sub-meta">(${c.activeCount} active, ${c.offlineCount} off)</span></td>
            <td>
              <span class="status-pill ${c.retentionRate >= 80 ? 'status-good' : (c.retentionRate >= 50 ? 'status-watchlist' : 'status-delinquent')}">
                ${c.retentionRate}%
              </span>
            </td>
            <td>${formatPKR(c.totalLtv)}</td>
            <td><strong class="text-success">${formatPKR(c.averageLtv)}</strong></td>
            <td>${c.averageTenureMonths} mos</td>
          </tr>
        `).join('');
      }
    }

    if (topAccountsTableBody) {
      if (ltvData.topLtvCustomers.length === 0) {
        topAccountsTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No customer payment history found.</td></tr>';
      } else {
        topAccountsTableBody.innerHTML = ltvData.topLtvCustomers.map(cust => `
          <tr>
            <td>
              <strong>${escapeXml(cust.name)}</strong>
              <div class="cust-sub-meta">#${cust.customerNumber} · ${escapeXml(cust.serviceStatus)}</div>
            </td>
            <td>
              <div>${escapeXml(cust.area)}</div>
              <div class="cust-sub-meta">${escapeXml(cust.package)}</div>
            </td>
            <td>${cust.tenureMonths} mos</td>
            <td><strong class="text-success">${formatPKR(cust.totalLtv)}</strong></td>
            <td>
              <button type="button" class="action-btn-sm" data-filter-customer="${escapeXml(cust.name)}">
                View Roster
              </button>
            </td>
          </tr>
        `).join('');

        topAccountsTableBody.querySelectorAll('[data-filter-customer]').forEach(btn => {
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

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const ltvData = calculateCustomerLtvCohorts(state, referenceDate);
      const text = generateLtvBriefingReport(ltvData, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Customer LTV cohort report copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }
}

/**
 * Calculates operational outage and network incident correlation metrics across areas,
 * determining mean-time-to-restore (MTTR), active outages, revenue at risk, and affected subscribers.
 */
export function calculateIncidentImpactMatrix(state, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);

  let totalRecordedIncidents = 0;
  let activeOutagesCount = 0;
  let resolvedIncidentsCount = 0;
  let totalDowntimeMinutes = 0;

  const affectedSubscribersSet = new Set();
  const areaIncidentMap = new Map();
  const customerIncidentStats = new Map();

  for (const customer of (state?.customers ?? [])) {
    const custIncidents = customer.incidents ?? [];
    if (custIncidents.length === 0) continue;

    const area = customer.area || 'Unassigned';
    if (!areaIncidentMap.has(area)) {
      areaIncidentMap.set(area, {
        area,
        totalIncidents: 0,
        activeOutages: 0,
        resolvedIncidents: 0,
        totalDowntimeMinutes: 0,
        affectedCustomerIds: new Set(),
        revenueAtRiskCents: 0
      });
    }
    const areaStats = areaIncidentMap.get(area);

    let customerActiveOutages = 0;
    let customerRecentIncidents = 0;

    for (const incident of custIncidents) {
      totalRecordedIncidents++;
      areaStats.totalIncidents++;
      affectedSubscribersSet.add(customer.id);
      areaStats.affectedCustomerIds.add(customer.id);

      const isResolved = Boolean(incident.restoredAt);
      if (isResolved) {
        resolvedIncidentsCount++;
        areaStats.resolvedIncidents++;

        const offTime = new Date(incident.offlineAt).getTime();
        const resTime = new Date(incident.restoredAt).getTime();
        if (!isNaN(offTime) && !isNaN(resTime) && resTime >= offTime) {
          const durationMins = Math.round((resTime - offTime) / (1000 * 60));
          totalDowntimeMinutes += durationMins;
          areaStats.totalDowntimeMinutes += durationMins;
        }
      } else {
        activeOutagesCount++;
        areaStats.activeOutages++;
        customerActiveOutages++;
      }

      const reportTime = new Date(incident.reportedAt).getTime();
      const refTime = ref.getTime();
      if (!isNaN(reportTime) && (refTime - reportTime) <= (60 * 24 * 60 * 60 * 1000)) {
        customerRecentIncidents++;
      }
    }

    const selling = Number(customer.monthlySellingAmount) || 0;
    if (customerActiveOutages > 0 && selling > 0) {
      areaStats.revenueAtRiskCents += Math.round(selling * 100);
    }

    if (custIncidents.length > 0) {
      customerIncidentStats.set(customer.id, {
        id: customer.id,
        customerNumber: customer.customerNumber,
        name: customer.name,
        area,
        package: customer.packageSpeed || customer.package || 'Standard',
        totalIncidents: custIncidents.length,
        recentIncidents: customerRecentIncidents,
        activeOutages: customerActiveOutages,
        serviceStatus: customer.serviceStatus || 'not-set'
      });
    }
  }

  const meanTimeToRestoreHours = resolvedIncidentsCount > 0
    ? Number((totalDowntimeMinutes / (resolvedIncidentsCount * 60)).toFixed(1))
    : 0;

  const totalCustomersCount = (state?.customers ?? []).length;
  const incidentRatePercent = totalCustomersCount > 0
    ? Number(((affectedSubscribersSet.size / totalCustomersCount) * 100).toFixed(1))
    : 0;

  const areaBreakdown = Array.from(areaIncidentMap.values()).map(a => {
    const mttr = a.resolvedIncidents > 0
      ? Number((a.totalDowntimeMinutes / (a.resolvedIncidents * 60)).toFixed(1))
      : 0;
    const revAtRisk = Math.round(a.revenueAtRiskCents / 100);
    let healthStatus = 'stable';
    if (a.activeOutages > 0 || a.totalIncidents >= 5) {
      healthStatus = 'critical';
    } else if (a.totalIncidents >= 2) {
      healthStatus = 'elevated';
    }

    return {
      area: a.area,
      totalIncidents: a.totalIncidents,
      activeOutages: a.activeOutages,
      resolvedIncidents: a.resolvedIncidents,
      subscribersAffected: a.affectedCustomerIds.size,
      revenueAtRisk: revAtRisk,
      meanTimeToRestoreHours: mttr,
      healthStatus
    };
  }).sort((a, b) => b.totalIncidents - a.totalIncidents || b.activeOutages - a.activeOutages);

  const highIncidentAccounts = Array.from(customerIncidentStats.values())
    .sort((a, b) => b.activeOutages - a.activeOutages || b.totalIncidents - a.totalIncidents)
    .slice(0, 5);

  return {
    totalRecordedIncidents,
    activeOutagesCount,
    resolvedIncidentsCount,
    meanTimeToRestoreHours,
    affectedSubscribersCount: affectedSubscribersSet.size,
    incidentRatePercent,
    areaBreakdown,
    highIncidentAccounts
  };
}

/**
 * Generates an executive incident operations plain-text briefing report.
 */
export function generateIncidentBriefingReport(matrixData, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);
  const lines = [
    `=========================================`,
    `SHAHDARA ISP - NETWORK INCIDENT & OUTAGE MATRIX`,
    `Generated: ${dateStr} PKT`,
    `=========================================`,
    `[ OPERATIONAL SLA & OUTAGE SUMMARY ]`,
    `  Total Incidents Recorded: ${matrixData.totalRecordedIncidents}`,
    `  Active Open Outages: ${matrixData.activeOutagesCount}`,
    `  Resolved Incidents: ${matrixData.resolvedIncidentsCount}`,
    `  Mean Time to Restore (MTTR): ${matrixData.meanTimeToRestoreHours} hours`,
    `  Affected Subscribers: ${matrixData.affectedSubscribersCount} (${matrixData.incidentRatePercent}% of base)`,
    ``,
    `[ AREA INCIDENT CORRELATION MATRIX ]`
  ];

  for (const a of (matrixData.areaBreakdown ?? [])) {
    lines.push(`  ${a.area} (${a.healthStatus.toUpperCase()}):`);
    lines.push(`    Incidents: ${a.totalIncidents} | Active Outages: ${a.activeOutages} | Affected Subs: ${a.subscribersAffected}`);
    lines.push(`    MTTR: ${a.meanTimeToRestoreHours}h | Revenue At Risk: ${formatPKR(a.revenueAtRisk)}`);
  }

  if ((matrixData.highIncidentAccounts ?? []).length > 0) {
    lines.push(``);
    lines.push(`[ HIGH-INCIDENT SUBSCRIBER ACCOUNTS ]`);
    for (const cust of matrixData.highIncidentAccounts) {
      lines.push(`  #${cust.customerNumber} ${cust.name} (${cust.area}): ${cust.totalIncidents} incidents (${cust.activeOutages} active outages)`);
    }
  }

  lines.push(`=========================================`);
  return lines.join('\n');
}

/**
 * Wires the Network Incident & Outage Correlation Modal dialog.
 */
export function setupIncidentImpactModal(state, { referenceDate = new Date(), onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardIncidentModal');
  const openBtn = document.getElementById('dashboardOpenIncidentModalBtn');
  const closeBtn = document.getElementById('dashboardIncidentModalCloseBtn');
  const areaTableBody = document.getElementById('dashboardIncidentAreaTableBody');
  const accountsTableBody = document.getElementById('dashboardIncidentAccountsTableBody');
  const copyBtn = document.getElementById('dashboardCopyIncidentReportBtn');

  if (!modal) return;

  function populateAndOpen() {
    const data = calculateIncidentImpactMatrix(state, referenceDate);

    const mttrEl = document.getElementById('dashboardIncidentMttrVal');
    const activeEl = document.getElementById('dashboardIncidentActiveVal');
    const affectedEl = document.getElementById('dashboardIncidentAffectedVal');
    const rateEl = document.getElementById('dashboardIncidentRateVal');

    if (mttrEl) mttrEl.textContent = `${data.meanTimeToRestoreHours} hrs`;
    if (activeEl) {
      activeEl.textContent = `${data.activeOutagesCount}`;
      activeEl.className = `ltv-kpi-val ${data.activeOutagesCount > 0 ? 'text-danger' : 'text-success'}`;
    }
    if (affectedEl) affectedEl.textContent = `${data.affectedSubscribersCount}`;
    if (rateEl) rateEl.textContent = `${data.incidentRatePercent}%`;

    if (areaTableBody) {
      if (data.areaBreakdown.length === 0) {
        areaTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No network complaints or outages recorded across service areas.</td></tr>';
      } else {
        areaTableBody.innerHTML = data.areaBreakdown.map(a => `
          <tr>
            <td><strong>${escapeXml(a.area)}</strong></td>
            <td>${a.totalIncidents}</td>
            <td>
              <strong class="${a.activeOutages > 0 ? 'text-danger' : 'text-muted'}">${a.activeOutages}</strong>
            </td>
            <td>${a.meanTimeToRestoreHours} hrs</td>
            <td>${formatPKR(a.revenueAtRisk)}</td>
            <td>
              <span class="status-pill ${a.healthStatus === 'stable' ? 'status-good' : (a.healthStatus === 'elevated' ? 'status-watchlist' : 'status-delinquent')}">
                ${a.healthStatus}
              </span>
            </td>
          </tr>
        `).join('');
      }
    }

    if (accountsTableBody) {
      if (data.highIncidentAccounts.length === 0) {
        accountsTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">All subscriber connections operating smoothly with zero recorded incidents.</td></tr>';
      } else {
        accountsTableBody.innerHTML = data.highIncidentAccounts.map(cust => `
          <tr>
            <td>
              <strong>${escapeXml(cust.name)}</strong>
              <div class="cust-sub-meta">#${cust.customerNumber} · ${escapeXml(cust.serviceStatus)}</div>
            </td>
            <td>
              <div>${escapeXml(cust.area)}</div>
              <div class="cust-sub-meta">${escapeXml(cust.package)}</div>
            </td>
            <td>
              <strong>${cust.totalIncidents}</strong>
              <span class="cust-sub-meta">(${cust.recentIncidents} in last 60d)</span>
            </td>
            <td>
              <strong class="${cust.activeOutages > 0 ? 'text-danger' : 'text-muted'}">${cust.activeOutages} open</strong>
            </td>
            <td>
              <button type="button" class="action-btn-sm" data-filter-customer="${escapeXml(cust.name)}">
                View Roster
              </button>
            </td>
          </tr>
        `).join('');

        accountsTableBody.querySelectorAll('[data-filter-customer]').forEach(btn => {
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

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const data = calculateIncidentImpactMatrix(state, referenceDate);
      const text = generateIncidentBriefingReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Incident operations report copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }
}

/**
 * Calculates forward cashflow projections over a configurable horizon (default 6 months)
 * factoring in customer base expansion, monthly churn drag, and collection recovery realization rates.
 * Supports Baseline, Optimistic, and Conservative operating scenarios or custom overrides.
 */
export function calculateCashflowProjections(state, referenceDate = new Date(), options = {}) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const horizonMonths = Math.max(1, Math.min(12, Number(options.horizonMonths) || 6));
  const scenario = options.scenario === 'optimistic' || options.scenario === 'conservative'
    ? options.scenario
    : 'baseline';

  const unarchived = (state?.customers ?? []).filter(c => !c.archived);
  const activeSubs = unarchived.filter(c => c.serviceStatus === 'active');
  const baseSubscribers = activeSubs.length > 0 ? activeSubs.length : unarchived.length;

  // Base MRR
  let baseMrr = 0;
  for (const c of (activeSubs.length > 0 ? activeSubs : unarchived)) {
    const amt = Number(c.monthlySellingAmount);
    if (Number.isFinite(amt) && amt > 0) {
      baseMrr += amt;
    }
  }

  // Average ARPU
  const arpu = baseSubscribers > 0 ? Math.round(baseMrr / baseSubscribers) : 0;

  // Historical collection recovery realization rate (last 6 months)
  const histMonths = monthsForHistory(ref, 6);
  let totalHistBilled = 0;
  let totalHistCollected = 0;
  for (const m of histMonths) {
    const snap = buildMonthlyClosingSnapshot(state, m, ref);
    totalHistBilled += snap.billedAmount;
    totalHistCollected += snap.collection;
  }
  const historicalRecoveryRate = totalHistBilled > 0
    ? Math.min(100, Math.max(40, Math.round((totalHistCollected / totalHistBilled) * 100)))
    : 85;

  // Scenario parameter defaults
  let recoveryRate = historicalRecoveryRate;
  let monthlyChurnRate = 2.5;
  let monthlyNetAdds = 2;

  if (scenario === 'optimistic') {
    recoveryRate = Math.min(98, Math.max(90, historicalRecoveryRate + 8));
    monthlyChurnRate = 1.0;
    monthlyNetAdds = 5;
  } else if (scenario === 'conservative') {
    recoveryRate = Math.max(50, Math.min(70, historicalRecoveryRate - 15));
    monthlyChurnRate = 6.0;
    monthlyNetAdds = 0;
  }

  // Allow explicit custom overrides
  if (options.customRecoveryRate !== undefined && Number.isFinite(Number(options.customRecoveryRate))) {
    recoveryRate = Math.max(10, Math.min(100, Number(options.customRecoveryRate)));
  }
  if (options.customMonthlyChurnRate !== undefined && Number.isFinite(Number(options.customMonthlyChurnRate))) {
    monthlyChurnRate = Math.max(0, Math.min(50, Number(options.customMonthlyChurnRate)));
  }
  if (options.customMonthlyNetAdds !== undefined && Number.isFinite(Number(options.customMonthlyNetAdds))) {
    monthlyNetAdds = Math.max(-50, Math.min(100, Number(options.customMonthlyNetAdds)));
  }

  const shortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const refYear = ref.getFullYear();
  const refMonthIndex = ref.getMonth(); // 0 to 11

  const monthlyForecasts = [];
  let currentSubs = baseSubscribers;
  let cumulativeCash = 0;
  let totalProjectedBilled = 0;
  let totalProjectedCollection = 0;
  let totalProjectedChurnLoss = 0;

  for (let i = 1; i <= horizonMonths; i++) {
    const targetDate = new Date(refYear, refMonthIndex + i, 1);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    const label = `${shortNames[targetMonth]} ${String(targetYear).slice(2)}`;

    const startSubs = currentSubs;
    const churnedSubs = Math.round(startSubs * (monthlyChurnRate / 100));
    const addedSubs = monthlyNetAdds;
    const endingSubs = Math.max(0, startSubs - churnedSubs + addedSubs);

    const projectedBilled = endingSubs * arpu;
    const churnDragRevenue = churnedSubs * arpu;
    const projectedCollection = Math.round(projectedBilled * (recoveryRate / 100));
    const projectedUncollected = Math.max(0, projectedBilled - projectedCollection);

    cumulativeCash += projectedCollection;
    totalProjectedBilled += projectedBilled;
    totalProjectedCollection += projectedCollection;
    totalProjectedChurnLoss += churnDragRevenue;

    monthlyForecasts.push({
      monthIndex: i,
      month: monthStr,
      label,
      startingSubscribers: startSubs,
      churnedSubscribers: churnedSubs,
      addedSubscribers: addedSubs,
      activeSubscribers: endingSubs,
      projectedBilled,
      projectedCollection,
      churnDragRevenue,
      projectedUncollected,
      cumulativeCashflow: cumulativeCash
    });

    currentSubs = endingSubs;
  }

  const averageMonthlyCollection = horizonMonths > 0
    ? Math.round(totalProjectedCollection / horizonMonths)
    : 0;

  const endingBase = monthlyForecasts[monthlyForecasts.length - 1]?.activeSubscribers ?? baseSubscribers;
  const netSubscriberDelta = endingBase - baseSubscribers;

  let trajectoryStatus = 'Stable';
  if (netSubscriberDelta > 0 && recoveryRate >= 80) {
    trajectoryStatus = 'Expansion';
  } else if (netSubscriberDelta < 0 || recoveryRate <= 70) {
    trajectoryStatus = 'Contraction Risk';
  }

  return {
    scenario,
    horizonMonths,
    baseSubscribers,
    endingSubscribers: endingBase,
    netSubscriberDelta,
    arpu,
    recoveryRate,
    monthlyChurnRate,
    monthlyNetAdds,
    totalProjectedCashflow: totalProjectedCollection,
    totalProjectedBilled,
    totalProjectedChurnLoss,
    averageMonthlyCollection,
    trajectoryStatus,
    monthlyForecasts
  };
}

/**
 * Generates an executive forward cashflow projection plain-text briefing report.
 */
export function generateProjectionBriefingText(projectionData, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);
  const lines = [
    `=========================================`,
    `SHAHDARA ISP - FORWARD CASHFLOW & CHURN FORECAST`,
    `Generated: ${dateStr} PKT | Horizon: ${projectionData.horizonMonths} Months`,
    `=========================================`,
    `[ SCENARIO CONFIGURATION: ${projectionData.scenario.toUpperCase()} ]`,
    `  Trajectory Status: ${projectionData.trajectoryStatus.toUpperCase()}`,
    `  Target Collection Recovery: ${projectionData.recoveryRate}%`,
    `  Monthly Churn Assumption: ${projectionData.monthlyChurnRate}% / month`,
    `  Monthly Net Additions: ${projectionData.monthlyNetAdds > 0 ? '+' : ''}${projectionData.monthlyNetAdds} subscribers / month`,
    `  Current ARPU Benchmark: ${formatPKR(projectionData.arpu)}`,
    ``,
    `[ 6-MONTH PORTFOLIO TOTALS ]`,
    `  Cumulative Projected Cash: ${formatPKR(projectionData.totalProjectedCashflow)}`,
    `  Total Gross Billed: ${formatPKR(projectionData.totalProjectedBilled)}`,
    `  Projected Churn Drag: ${formatPKR(projectionData.totalProjectedChurnLoss)}`,
    `  Average Monthly Run-Rate: ${formatPKR(projectionData.averageMonthlyCollection)}`,
    `  Ending Subscriber Base: ${projectionData.endingSubscribers} (${projectionData.netSubscriberDelta >= 0 ? '+' : ''}${projectionData.netSubscriberDelta} net)`,
    ``,
    `[ MONTH-BY-MONTH FORWARD TRAJECTORY ]`
  ];

  for (const m of (projectionData.monthlyForecasts ?? [])) {
    lines.push(`  ${m.month} (${m.label}):`);
    lines.push(`    Active: ${m.activeSubscribers} (Churn: -${m.churnedSubscribers}, Adds: +${m.addedSubscribers})`);
    lines.push(`    Billed: ${formatPKR(m.projectedBilled)} | Projected Cash: ${formatPKR(m.projectedCollection)}`);
    lines.push(`    Churn Loss: ${formatPKR(m.churnDragRevenue)} | Cumulative Cash: ${formatPKR(m.cumulativeCashflow)}`);
  }

  lines.push(`=========================================`);
  return lines.join('\n');
}

/**
 * Wires the Forward Cashflow Projections & Scenario Modeler Modal dialog.
 */
export function setupProjectionScenarioModal(state, { referenceDate = new Date(), onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardProjectionModal');
  const openBtn = document.getElementById('dashboardOpenProjectionModalBtn');
  const closeBtn = document.getElementById('dashboardProjectionModalCloseBtn');
  const tableBody = document.getElementById('dashboardProjectionTableBody');
  const copyBtn = document.getElementById('dashboardCopyProjectionReportBtn');

  const recoveryInput = document.getElementById('projectionRecoveryInput');
  const churnInput = document.getElementById('projectionChurnInput');
  const netAddsInput = document.getElementById('projectionNetAddsInput');

  const totalCashflowEl = document.getElementById('projectionTotalCashflowVal');
  const runRateEl = document.getElementById('projectionMonthlyRunRateVal');
  const churnDragEl = document.getElementById('projectionChurnDragVal');
  const endingBaseEl = document.getElementById('projectionEndingBaseVal');
  const trajectoryBadgeEl = document.getElementById('projectionTrajectoryBadge');

  if (!modal) return;

  let activeScenario = 'baseline';

  function recalculateAndRender() {
    const recoveryVal = recoveryInput ? parseFloat(recoveryInput.value) : undefined;
    const churnVal = churnInput ? parseFloat(churnInput.value) : undefined;
    const netAddsVal = netAddsInput ? parseInt(netAddsInput.value, 10) : undefined;

    const data = calculateCashflowProjections(state, referenceDate, {
      scenario: activeScenario,
      customRecoveryRate: recoveryVal,
      customMonthlyChurnRate: churnVal,
      customMonthlyNetAdds: netAddsVal
    });

    if (totalCashflowEl) totalCashflowEl.textContent = formatPKR(data.totalProjectedCashflow);
    if (runRateEl) runRateEl.textContent = `${formatPKR(data.averageMonthlyCollection)} / mo`;
    if (churnDragEl) churnDragEl.textContent = formatPKR(data.totalProjectedChurnLoss);
    if (endingBaseEl) {
      const deltaSign = data.netSubscriberDelta >= 0 ? '+' : '';
      endingBaseEl.textContent = `${data.endingSubscribers} (${deltaSign}${data.netSubscriberDelta})`;
    }
    if (trajectoryBadgeEl) {
      trajectoryBadgeEl.textContent = data.trajectoryStatus;
      trajectoryBadgeEl.className = 'sim-delta-badge ' + (
        data.trajectoryStatus === 'Expansion' ? 'badge-expansion' :
        data.trajectoryStatus === 'Contraction Risk' ? 'badge-contraction' : 'badge-stable'
      );
    }

    if (tableBody) {
      if (data.monthlyForecasts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No projection data available</td></tr>';
      } else {
        tableBody.innerHTML = data.monthlyForecasts.map(m => `
          <tr>
            <td><strong>${escapeXml(m.label)}</strong> <span class="text-muted">(${escapeXml(m.month)})</span></td>
            <td>${m.activeSubscribers} <span class="subs-diff text-muted">(-${m.churnedSubscribers}/+${m.addedSubscribers})</span></td>
            <td>${formatPKR(m.projectedBilled)}</td>
            <td class="text-success font-semibold">${formatPKR(m.projectedCollection)}</td>
            <td class="text-danger">${formatPKR(m.churnDragRevenue)}</td>
            <td class="font-semibold">${formatPKR(m.cumulativeCashflow)}</td>
          </tr>
        `).join('');
      }
    }
  }

  function applyPreset(scenario) {
    activeScenario = scenario;
    const defaultData = calculateCashflowProjections(state, referenceDate, { scenario });
    if (recoveryInput) recoveryInput.value = defaultData.recoveryRate;
    if (churnInput) churnInput.value = defaultData.monthlyChurnRate;
    if (netAddsInput) netAddsInput.value = defaultData.monthlyNetAdds;

    const presetBtns = modal.querySelectorAll('[data-projection-preset]');
    presetBtns.forEach(btn => {
      const s = btn.getAttribute('data-projection-preset');
      const isActive = s === scenario;
      if (btn.classList?.toggle) btn.classList.toggle('is-active', isActive);
      if (btn.setAttribute) btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    recalculateAndRender();
  }

  function populateAndOpen() {
    applyPreset(activeScenario || 'baseline');
    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
  }

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });

  const presetBtns = modal.querySelectorAll('[data-projection-preset]');
  presetBtns.forEach(btn => {
    if (!btn.dataset?.wired) {
      if (btn.dataset) btn.dataset.wired = 'true';
      else if (btn.setAttribute) btn.setAttribute('data-wired', 'true');
      btn.addEventListener('click', () => {
        const s = btn.getAttribute('data-projection-preset');
        applyPreset(s);
      });
    }
  });

  [recoveryInput, churnInput, netAddsInput].forEach(inp => {
    if (inp && !inp.dataset?.wired) {
      if (inp.dataset) inp.dataset.wired = 'true';
      else if (inp.setAttribute) inp.setAttribute('data-wired', 'true');
      inp.addEventListener('input', recalculateAndRender);
    }
  });

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const recoveryVal = recoveryInput ? parseFloat(recoveryInput.value) : undefined;
      const churnVal = churnInput ? parseFloat(churnInput.value) : undefined;
      const netAddsVal = netAddsInput ? parseInt(netAddsInput.value, 10) : undefined;
      const data = calculateCashflowProjections(state, referenceDate, {
        scenario: activeScenario,
        customRecoveryRate: recoveryVal,
        customMonthlyChurnRate: churnVal,
        customMonthlyNetAdds: netAddsVal
      });
      const text = generateProjectionBriefingText(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Cashflow forecast report copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }
}

const PROVIDER_PROFILES = {
  'transworld': { benchmarkLatency: 14, jitter: 1.8, lossPercent: 0.0, slaPercent: 99.9 },
  'nayatel': { benchmarkLatency: 18, jitter: 2.1, lossPercent: 0.0, slaPercent: 99.8 },
  'stormfiber': { benchmarkLatency: 22, jitter: 2.5, lossPercent: 0.1, slaPercent: 99.7 },
  'ptcl': { benchmarkLatency: 28, jitter: 3.4, lossPercent: 0.2, slaPercent: 99.5 },
  'wateen': { benchmarkLatency: 32, jitter: 4.1, lossPercent: 0.3, slaPercent: 99.4 },
  'cybernet': { benchmarkLatency: 16, jitter: 2.0, lossPercent: 0.0, slaPercent: 99.9 }
};

function getProviderProfile(name) {
  const norm = String(name || '').toLowerCase();
  for (const [key, profile] of Object.entries(PROVIDER_PROFILES)) {
    if (norm.includes(key)) return profile;
  }
  return { benchmarkLatency: 35, jitter: 4.5, lossPercent: 0.4, slaPercent: 99.2 };
}

/**
 * Calculates upstream wholesale transit gateway metrics, multi-homed ISP failover status,
 * bandwidth allocations, and latency performance across providers.
 */
export function calculateUpstreamGatewayMetrics(state, referenceDate = new Date()) {
  const unarchived = (state?.customers ?? []).filter(c => !c.archived);
  const providerMap = new Map();

  for (const c of unarchived) {
    const rawProvider = String(c.ispProvider ?? '').trim();
    const providerName = rawProvider || 'Unassigned Gateway';
    const key = providerName.toLowerCase();

    if (!providerMap.has(key)) {
      providerMap.set(key, {
        provider: providerName,
        totalSubscribers: 0,
        activeSubscribers: 0,
        allocatedBandwidthMbps: 0,
        wholesaleCostCents: 0,
        retailRevenueCents: 0
      });
    }

    const group = providerMap.get(key);
    group.totalSubscribers++;
    if (c.serviceStatus === 'active') {
      group.activeSubscribers++;
    }

    // Bandwidth parsing: e.g. "20 Mbps" -> 20, or default 15 Mbps
    let speed = 15;
    const speedStr = String(c.packageSpeed || c.package || '');
    const match = speedStr.match(/(\d+)\s*(?:mbps|m)/i);
    if (match) {
      speed = parseInt(match[1], 10);
    }
    group.allocatedBandwidthMbps += speed;

    const cost = Number(c.monthlyPurchaseCost);
    if (Number.isFinite(cost) && cost > 0) {
      group.wholesaleCostCents += Math.round(cost * 100);
    }

    const selling = Number(c.monthlySellingAmount);
    if (Number.isFinite(selling) && selling > 0) {
      group.retailRevenueCents += Math.round(selling * 100);
    }
  }

  // Sort providers by active subscribers descending, then total subscribers
  const sortedGateways = Array.from(providerMap.values()).sort(
    (a, b) => b.activeSubscribers - a.activeSubscribers || b.totalSubscribers - a.totalSubscribers
  );

  let totalBandwidthCapacityMbps = 0;
  let totalWholesaleCost = 0;
  let totalRetailRevenue = 0;

  const gateways = sortedGateways.map((g, idx) => {
    const profile = getProviderProfile(g.provider);
    const wholesaleCost = Math.round(g.wholesaleCostCents / 100);
    const retailRevenue = Math.round(g.retailRevenueCents / 100);

    totalBandwidthCapacityMbps += g.allocatedBandwidthMbps;
    totalWholesaleCost += wholesaleCost;
    totalRetailRevenue += retailRevenue;

    let failoverRole = 'Failover Ready';
    if (idx === 0 && g.activeSubscribers > 0) {
      failoverRole = 'Primary Active';
    } else if (idx === 1 && g.activeSubscribers > 0) {
      failoverRole = 'Secondary Standby';
    } else if (g.provider === 'Unassigned Gateway' || g.activeSubscribers === 0) {
      failoverRole = 'Unmonitored';
    }

    let status = 'Optimal';
    if (profile.benchmarkLatency >= 40 || profile.jitter >= 5) {
      status = 'High Latency';
    } else if (profile.benchmarkLatency >= 25) {
      status = 'Moderate';
    }

    return {
      provider: g.provider,
      totalSubscribers: g.totalSubscribers,
      activeSubscribers: g.activeSubscribers,
      allocatedBandwidthMbps: g.allocatedBandwidthMbps,
      wholesaleCost,
      retailRevenue,
      latencyMs: profile.benchmarkLatency,
      jitterMs: profile.jitter,
      lossPercent: profile.lossPercent,
      slaPercent: profile.slaPercent,
      failoverRole,
      status
    };
  });

  const configuredGateways = gateways.filter(g => g.provider !== 'Unassigned Gateway' && g.activeSubscribers > 0);
  const primary = gateways[0] ?? null;
  const primaryGateway = primary ? primary.provider : 'None';
  const primaryLatencyMs = primary ? primary.latencyMs : 0;

  let failoverRedundancyStatus = 'No Configured Gateway';
  if (configuredGateways.length >= 2) {
    failoverRedundancyStatus = 'Multi-Homed Redundant';
  } else if (configuredGateways.length === 1) {
    failoverRedundancyStatus = 'Single-Homed';
  }

  return {
    totalGatewaysCount: gateways.length,
    configuredGatewaysCount: configuredGateways.length,
    primaryGateway,
    primaryLatencyMs,
    totalBandwidthCapacityMbps,
    totalWholesaleCost,
    totalRetailRevenue,
    failoverRedundancyStatus,
    gateways
  };
}

/**
 * Generates an executive upstream transit & failover plain-text report.
 */
export function generateUpstreamBriefingReport(gatewayData, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);
  const lines = [
    `=========================================`,
    `SHAHDARA ISP - UPSTREAM TRANSIT & FAILOVER BRIEFING`,
    `Generated: ${dateStr} PKT`,
    `=========================================`,
    `[ UPSTREAM ARCHITECTURE & REDUNDANCY ]`,
    `  Redundancy Architecture: ${gatewayData.failoverRedundancyStatus}`,
    `  Primary Gateway: ${gatewayData.primaryGateway} (${gatewayData.primaryLatencyMs} ms latency)`,
    `  Total Active Upstream Links: ${gatewayData.configuredGatewaysCount}`,
    `  Total Allocated Capacity: ${gatewayData.totalBandwidthCapacityMbps} Mbps`,
    `  Monthly Wholesale Expenditure: ${formatPKR(gatewayData.totalWholesaleCost)}`,
    ``,
    `[ UPSTREAM PROVIDER GATEWAY ROSTER ]`
  ];

  for (const g of (gatewayData.gateways ?? [])) {
    lines.push(`  ${g.provider} [${g.failoverRole.toUpperCase()} · ${g.status.toUpperCase()}]:`);
    lines.push(`    Subscribers: ${g.activeSubscribers} active (${g.totalSubscribers} total) | Bandwidth: ${g.allocatedBandwidthMbps} Mbps`);
    lines.push(`    Latency: ${g.latencyMs} ms | Jitter: ${g.jitterMs} ms | SLA Uptime: ${g.slaPercent}%`);
    lines.push(`    Wholesale Transit Cost: ${formatPKR(g.wholesaleCost)} | Retail Yield: ${formatPKR(g.retailRevenue)}`);
  }

  lines.push(`=========================================`);
  return lines.join('\n');
}

/**
 * Wires the Upstream Gateway & Latency Failover Modal dialog.
 */
export function setupUpstreamGatewayModal(state, { referenceDate = new Date(), onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardUpstreamModal');
  const openBtn = document.getElementById('dashboardOpenUpstreamModalBtn');
  const closeBtn = document.getElementById('dashboardUpstreamModalCloseBtn');
  const tableBody = document.getElementById('dashboardUpstreamTableBody');
  const copyBtn = document.getElementById('dashboardCopyUpstreamReportBtn');

  const primaryEl = document.getElementById('upstreamPrimaryVal');
  const latencyEl = document.getElementById('upstreamLatencyVal');
  const capacityEl = document.getElementById('upstreamCapacityVal');
  const redundancyBadgeEl = document.getElementById('upstreamRedundancyBadge');

  if (!modal) return;

  function populateAndOpen() {
    const data = calculateUpstreamGatewayMetrics(state, referenceDate);

    if (primaryEl) primaryEl.textContent = data.primaryGateway;
    if (latencyEl) latencyEl.textContent = `${data.primaryLatencyMs} ms`;
    if (capacityEl) capacityEl.textContent = `${data.totalBandwidthCapacityMbps} Mbps`;
    if (redundancyBadgeEl) {
      redundancyBadgeEl.textContent = data.failoverRedundancyStatus;
      redundancyBadgeEl.className = 'sim-delta-badge ' + (
        data.failoverRedundancyStatus === 'Multi-Homed Redundant' ? 'badge-expansion' :
        data.failoverRedundancyStatus === 'Single-Homed' ? 'badge-stable' : 'badge-contraction'
      );
    }

    if (tableBody) {
      if (data.gateways.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No upstream gateway routes configured</td></tr>';
      } else {
        tableBody.innerHTML = data.gateways.map(g => `
          <tr>
            <td><strong>${escapeXml(g.provider)}</strong></td>
            <td>${g.activeSubscribers} <span class="text-muted">(${g.totalSubscribers} total)</span></td>
            <td>${g.allocatedBandwidthMbps} Mbps</td>
            <td>${g.latencyMs} ms <span class="text-muted">(±${g.jitterMs}ms)</span></td>
            <td>${formatPKR(g.wholesaleCost)}</td>
            <td>
              <span class="role-badge ${g.failoverRole === 'Primary Active' ? 'role-primary' : (g.failoverRole === 'Secondary Standby' ? 'role-standby' : 'role-other')}">
                ${escapeXml(g.failoverRole)}
              </span>
            </td>
          </tr>
        `).join('');
      }
    }

    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
  }

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const data = calculateUpstreamGatewayMetrics(state, referenceDate);
      const text = generateUpstreamBriefingReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Upstream failover report copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }
}

export const ACQUISITION_CHANNELS = [
  {
    id: 'walkin',
    name: 'Direct Walk-in / Office',
    baseCac: 2800,
    grossMarginPercent: 70,
    color: '#0e5b4d',
    keywords: ['walk-in', 'walk in', 'office', 'branch', 'counter', 'direct']
  },
  {
    id: 'technician',
    name: 'Field Technician Referral',
    baseCac: 3500,
    grossMarginPercent: 68,
    color: '#3b82f6',
    keywords: ['technician', 'tech', 'lineman', 'splicer', 'field', 'staff', 'installer']
  },
  {
    id: 'referral',
    name: 'Customer Word-of-Mouth',
    baseCac: 2200,
    grossMarginPercent: 72,
    color: '#10b981',
    keywords: ['referral', 'friend', 'neighbor', 'relative', 'word', 'recommend', 'family']
  },
  {
    id: 'marketing',
    name: 'Local Banner & Pamphlet',
    baseCac: 4200,
    grossMarginPercent: 65,
    color: '#f59e0b',
    keywords: ['banner', 'pamphlet', 'flyer', 'poster', 'flex', 'chowk', 'drive', 'marketing']
  },
  {
    id: 'digital',
    name: 'Digital & WhatsApp Inbound',
    baseCac: 3100,
    grossMarginPercent: 70,
    color: '#8b5cf6',
    keywords: ['whatsapp', 'facebook', 'digital', 'online', 'social', 'inbound', 'helpline', 'web']
  },
  {
    id: 'partnership',
    name: 'Builder & Plaza Partner',
    baseCac: 5500,
    grossMarginPercent: 75,
    color: '#06b6d4',
    keywords: ['builder', 'plaza', 'apartment', 'scheme', 'commercial', 'colony', 'complex', 'society']
  }
];

/**
 * Resolves acquisition channel for a customer based on explicit properties,
 * notes keywords, or deterministic identifier hashing.
 */
export function resolveCustomerAcquisitionChannel(customer) {
  if (!customer) return ACQUISITION_CHANNELS[0];

  const explicit = String(
    customer.acquisitionChannel ||
    customer.leadSource ||
    customer.channel ||
    customer.source ||
    customer.referralSource ||
    ''
  ).trim().toLowerCase();

  if (explicit) {
    const match = ACQUISITION_CHANNELS.find(c =>
      c.id.toLowerCase() === explicit ||
      c.name.toLowerCase() === explicit ||
      explicit.includes(c.id.toLowerCase()) ||
      c.keywords.some(k => explicit.includes(k))
    );
    if (match) return match;
  }

  const notes = String(customer.notes || '').toLowerCase();
  if (notes) {
    for (const ch of ACQUISITION_CHANNELS) {
      if (ch.keywords.some(k => notes.includes(k))) {
        return ch;
      }
    }
  }

  const seedStr = String(customer.id || customer.phone || customer.name || 'cust');
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % ACQUISITION_CHANNELS.length;
  return ACQUISITION_CHANNELS[index];
}

/**
 * Calculates Subscriber Acquisition Channel ROI, Unit CAC economics,
 * payback periods, and capital recovery velocity.
 */
export function calculateAcquisitionRoiMetrics(state, referenceDate = new Date(), options = {}) {
  const cacMultiplier = Number.isFinite(options.cacMultiplier) ? Math.max(0.1, options.cacMultiplier) : 1.0;
  const targetGrossMargin = Number.isFinite(options.grossMarginPercent) ? options.grossMarginPercent : null;
  const unarchived = (state?.customers ?? []).filter(c => !c.archived);

  const channelDataMap = new Map();
  for (const ch of ACQUISITION_CHANNELS) {
    channelDataMap.set(ch.id, {
      id: ch.id,
      name: ch.name,
      color: ch.color,
      baseCac: ch.baseCac,
      blendedCac: Math.round(ch.baseCac * cacMultiplier),
      grossMarginPercent: targetGrossMargin !== null ? targetGrossMargin : ch.grossMarginPercent,
      totalAcquisitions: 0,
      activeSubscribers: 0,
      totalArpuCents: 0,
      totalRealizedRevenueCents: 0,
      customerIds: []
    });
  }

  for (const c of unarchived) {
    const channelDef = resolveCustomerAcquisitionChannel(c);
    const item = channelDataMap.get(channelDef.id);
    if (!item) continue;

    item.totalAcquisitions++;
    const isActive = c.serviceStatus === 'active' || (c.serviceStatus !== 'offline' && c.serviceStatus !== 'cancelled');
    if (isActive) {
      item.activeSubscribers++;
    }
    item.customerIds.push(c.id);

    const arpu = Number(c.monthlySellingAmount) || 0;
    if (arpu > 0) {
      item.totalArpuCents += Math.round(arpu * 100);
    }

    let custRevenueCents = 0;
    for (const bill of (c.bills ?? [])) {
      for (const p of (bill.payments ?? [])) {
        const amt = Number(p.amount) || 0;
        if (amt > 0) custRevenueCents += Math.round(amt * 100);
      }
    }
    if (custRevenueCents === 0 && Array.isArray(state?.receipts)) {
      for (const r of state.receipts) {
        if (r.customerId === c.id || r.customerName === c.name) {
          const amt = Number(r.amount) || 0;
          if (amt > 0) custRevenueCents += Math.round(amt * 100);
        }
      }
    }
    item.totalRealizedRevenueCents += custRevenueCents;
  }

  let totalPortfolioAcquisitions = 0;
  let totalPortfolioActive = 0;
  let totalPortfolioCac = 0;
  let totalPortfolioRealizedRevenue = 0;

  const channels = ACQUISITION_CHANNELS.map(ch => {
    const raw = channelDataMap.get(ch.id);
    const totalAcq = raw.totalAcquisitions;
    const activeSubs = raw.activeSubscribers;
    const blendedCac = raw.blendedCac;
    const totalCac = totalAcq * blendedCac;
    const avgArpu = totalAcq > 0 ? Math.round((raw.totalArpuCents / 100) / totalAcq) : 0;
    const monthlyGrossProfit = avgArpu * (raw.grossMarginPercent / 100);
    const paybackMonths = monthlyGrossProfit > 0
      ? parseFloat((blendedCac / monthlyGrossProfit).toFixed(1))
      : 0;
    const totalRealizedRevenue = Math.round(raw.totalRealizedRevenueCents / 100);
    const netRoiPercent = totalCac > 0
      ? parseFloat((((totalRealizedRevenue - totalCac) / totalCac) * 100).toFixed(1))
      : 0;

    let velocityStatus = 'Standard Payback';
    if (totalAcq === 0 || paybackMonths === 0) {
      velocityStatus = 'Inactive';
    } else if (paybackMonths <= 3.0) {
      velocityStatus = 'Rapid Payback';
    } else if (paybackMonths <= 5.0) {
      velocityStatus = 'Standard Payback';
    } else {
      velocityStatus = 'Lagging Payback';
    }

    totalPortfolioAcquisitions += totalAcq;
    totalPortfolioActive += activeSubs;
    totalPortfolioCac += totalCac;
    totalPortfolioRealizedRevenue += totalRealizedRevenue;

    return {
      id: raw.id,
      name: raw.name,
      color: raw.color,
      blendedCac,
      grossMarginPercent: raw.grossMarginPercent,
      totalAcquisitions: totalAcq,
      activeSubscribers: activeSubs,
      avgArpu,
      monthlyGrossProfit: Math.round(monthlyGrossProfit),
      paybackMonths,
      totalCac,
      totalRealizedRevenue,
      netRoiPercent,
      velocityStatus,
      customerIds: raw.customerIds
    };
  });

  const portfolioNetRoiPercent = totalPortfolioCac > 0
    ? parseFloat((((totalPortfolioRealizedRevenue - totalPortfolioCac) / totalPortfolioCac) * 100).toFixed(1))
    : 0;

  let weightedPaybackSum = 0;
  for (const ch of channels) {
    if (ch.totalAcquisitions > 0 && ch.paybackMonths > 0) {
      weightedPaybackSum += ch.paybackMonths * ch.totalAcquisitions;
    }
  }
  const portfolioAvgPaybackMonths = totalPortfolioAcquisitions > 0
    ? parseFloat((weightedPaybackSum / totalPortfolioAcquisitions).toFixed(1))
    : 0;

  const activeChannels = channels.filter(c => c.totalAcquisitions > 0);
  const sortedByRoi = [...activeChannels].sort((a, b) => b.netRoiPercent - a.netRoiPercent);
  const highestRoiChannel = sortedByRoi[0]?.name ?? 'None';

  const sortedByPayback = [...activeChannels]
    .filter(c => c.paybackMonths > 0)
    .sort((a, b) => a.paybackMonths - b.paybackMonths);
  const fastestPaybackChannel = sortedByPayback[0]?.name ?? 'None';

  return {
    totalPortfolioAcquisitions,
    totalPortfolioActive,
    totalPortfolioCac,
    totalPortfolioRealizedRevenue,
    portfolioNetRoiPercent,
    portfolioAvgPaybackMonths,
    highestRoiChannel,
    fastestPaybackChannel,
    cacMultiplier,
    channels
  };
}

/**
 * Generates an executive acquisition ROI and payback briefing in plain-text.
 */
export function generateAcquisitionBriefingReport(roiData, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);
  const lines = [
    `=========================================`,
    `SHAHDARA ISP - ACQUISITION CHANNEL ROI & PAYBACK BRIEFING`,
    `Generated: ${dateStr} PKT`,
    `=========================================`,
    `[ PORTFOLIO UNIT ECONOMICS & ACQUISITION SUMMARY ]`,
    `  Total Acquired Subscribers: ${roiData.totalPortfolioAcquisitions} (${roiData.totalPortfolioActive} active)`,
    `  Total Portfolio CAC Investment: ${formatPKR(roiData.totalPortfolioCac)}`,
    `  Total Realized Collections: ${formatPKR(roiData.totalPortfolioRealizedRevenue)}`,
    `  Net Portfolio Marketing ROI: ${roiData.portfolioNetRoiPercent > 0 ? '+' : ''}${roiData.portfolioNetRoiPercent}%`,
    `  Weighted Avg Payback Duration: ${roiData.portfolioAvgPaybackMonths} Months`,
    `  Fastest Payback Channel: ${roiData.fastestPaybackChannel}`,
    `  Highest Yield ROI Channel: ${roiData.highestRoiChannel}`,
    ``,
    `[ ACQUISITION CHANNEL PERFORMANCE BREAKDOWN ]`
  ];

  for (const ch of (roiData.channels ?? [])) {
    lines.push(`  ${ch.name} [${ch.velocityStatus.toUpperCase()}]:`);
    lines.push(`    Subscribers: ${ch.activeSubscribers} active / ${ch.totalAcquisitions} total | ARPU: ${formatPKR(ch.avgArpu)}/mo`);
    lines.push(`    Unit CAC: ${formatPKR(ch.blendedCac)} | Payback Period: ${ch.paybackMonths} Months (Margin: ${ch.grossMarginPercent}%)`);
    lines.push(`    Channel Investment: ${formatPKR(ch.totalCac)} | Realized Rev: ${formatPKR(ch.totalRealizedRevenue)} | Net ROI: ${ch.netRoiPercent > 0 ? '+' : ''}${ch.netRoiPercent}%`);
  }

  lines.push(`=========================================`);
  return lines.join('\n');
}

/**
 * Wires the Acquisition Channel ROI & Payback Velocity Modal dialog.
 */
export function setupAcquisitionRoiModal(state, { referenceDate = new Date(), onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardAcquisitionModal');
  const openBtn = document.getElementById('dashboardOpenAcquisitionModalBtn');
  const closeBtn = document.getElementById('dashboardAcquisitionModalCloseBtn');
  const copyBtn = document.getElementById('dashboardCopyAcquisitionReportBtn');
  const tableBody = document.getElementById('dashboardAcquisitionTableBody');

  const totalCacEl = document.getElementById('acqTotalCacVal');
  const realizedRevEl = document.getElementById('acqRealizedRevVal');
  const netRoiEl = document.getElementById('acqNetRoiVal');
  const avgPaybackEl = document.getElementById('acqAvgPaybackVal');
  const fastestEl = document.getElementById('acqFastestChannelVal');

  let activeMultiplier = 1.0;

  function renderModalContent() {
    const data = calculateAcquisitionRoiMetrics(state, referenceDate, { cacMultiplier: activeMultiplier });

    if (totalCacEl) totalCacEl.textContent = formatPKR(data.totalPortfolioCac);
    if (realizedRevEl) realizedRevEl.textContent = formatPKR(data.totalPortfolioRealizedRevenue);
    if (netRoiEl) {
      netRoiEl.textContent = `${data.portfolioNetRoiPercent > 0 ? '+' : ''}${data.portfolioNetRoiPercent}%`;
      netRoiEl.style.color = data.portfolioNetRoiPercent >= 0 ? '#047857' : '#dc2626';
    }
    if (avgPaybackEl) avgPaybackEl.textContent = `${data.portfolioAvgPaybackMonths} mo`;
    if (fastestEl) fastestEl.textContent = data.fastestPaybackChannel;

    if (tableBody) {
      if (data.channels.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">No subscriber channels recorded</td></tr>';
      } else {
        tableBody.innerHTML = data.channels.map(ch => `
          <tr>
            <td>
              <div class="channel-name-cell">
                <span class="channel-color-dot" style="background:${ch.color};"></span>
                <strong>${escapeXml(ch.name)}</strong>
              </div>
            </td>
            <td><strong>${ch.totalAcquisitions}</strong> <span class="muted">(${ch.activeSubscribers} active)</span></td>
            <td>${formatPKR(ch.blendedCac)}</td>
            <td>${formatPKR(ch.avgArpu)}/mo</td>
            <td><strong>${ch.paybackMonths} mo</strong></td>
            <td>${formatPKR(ch.totalRealizedRevenue)}</td>
            <td><strong style="color:${ch.netRoiPercent >= 0 ? '#047857' : '#dc2626'}">${ch.netRoiPercent > 0 ? '+' : ''}${ch.netRoiPercent}%</strong></td>
            <td>
              <span class="badge ${ch.velocityStatus === 'Rapid Payback' ? 'badge-good' : (ch.velocityStatus === 'Standard Payback' ? 'badge-normal' : 'badge-warn')}">
                ${escapeXml(ch.velocityStatus)}
              </span>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  const presetBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('#acquisitionCacPresetGroup .chart-range-btn')
    : [];

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mult = parseFloat(btn.dataset?.cacMultiplier || btn.getAttribute?.('data-cac-multiplier') || '1.0');
      activeMultiplier = mult;
      presetBtns.forEach(b => {
        const isActive = b === btn;
        if (b.classList?.toggle) b.classList.toggle('is-active', isActive);
        if (b.setAttribute) b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      renderModalContent();
    });
  });

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', () => {
      renderModalContent();
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    });
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const data = calculateAcquisitionRoiMetrics(state, referenceDate, { cacMultiplier: activeMultiplier });
      const text = generateAcquisitionBriefingReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Acquisition ROI briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }
}

/**
 * Calculates peak hour bandwidth demand, oversubscription contention,
 * diurnal 24-hour traffic projection, and dynamic subscriber shaping forecast.
 */
export function calculateBandwidthShapingMetrics(state, referenceDate = new Date(), options = {}) {
  const oversubscriptionRatio = Number.isFinite(options.oversubscriptionRatio) ? Math.max(1, options.oversubscriptionRatio) : 8;
  const peakConcurrencyPercent = Number.isFinite(options.peakConcurrencyPercent) ? Math.max(10, Math.min(100, options.peakConcurrencyPercent)) : 80;

  const unarchived = (state?.customers ?? []).filter(c => !c.archived);
  const activeSubs = unarchived.filter(c => c.serviceStatus === 'active' || (c.serviceStatus !== 'offline' && c.serviceStatus !== 'cancelled'));

  let totalProvisionedBandwidthMbps = 0;
  for (const c of activeSubs) {
    let speed = 15;
    const speedStr = String(c.packageSpeed || c.package || '');
    const match = speedStr.match(/(\d+)\s*(?:mbps|m)/i);
    if (match) {
      speed = parseInt(match[1], 10);
    }
    totalProvisionedBandwidthMbps += speed;
  }

  let upstreamCapacityMbps = 400;
  if (Number.isFinite(options.upstreamCapacityMbps) && options.upstreamCapacityMbps > 0) {
    upstreamCapacityMbps = options.upstreamCapacityMbps;
  } else {
    try {
      const gw = calculateUpstreamGatewayMetrics(state, referenceDate);
      if (gw && gw.totalBandwidthCapacityMbps > 0) {
        upstreamCapacityMbps = gw.totalBandwidthCapacityMbps;
      }
    } catch {
      upstreamCapacityMbps = 400;
    }
  }

  const peakDemandMbps = Math.round((totalProvisionedBandwidthMbps / oversubscriptionRatio) * (peakConcurrencyPercent / 100));
  const offPeakDemandMbps = Math.round(peakDemandMbps * 0.35);

  const peakUtilizationPercent = upstreamCapacityMbps > 0
    ? parseFloat(((peakDemandMbps / upstreamCapacityMbps) * 100).toFixed(1))
    : 0;

  const headroomMbps = Math.max(0, upstreamCapacityMbps - peakDemandMbps);

  let congestionStatus = 'Healthy Bandwidth Headroom';
  if (activeSubs.length === 0 || totalProvisionedBandwidthMbps === 0) {
    congestionStatus = 'Idle Network';
  } else if (peakUtilizationPercent < 70) {
    congestionStatus = 'Healthy Bandwidth Headroom';
  } else if (peakUtilizationPercent <= 85) {
    congestionStatus = 'Moderate Congestion';
  } else {
    congestionStatus = 'Critical Saturation Risk';
  }

  const DIURNAL_MULTIPLIERS = [
    0.22, 0.18, 0.15, 0.14, 0.15, 0.20,
    0.32, 0.45, 0.55, 0.58, 0.60, 0.62,
    0.65, 0.64, 0.66, 0.70, 0.78, 0.88,
    0.95, 1.00, 0.98, 0.92, 0.75, 0.45
  ];

  const hourlyProfile = DIURNAL_MULTIPLIERS.map((mult, h) => {
    const demand = Math.round(peakDemandMbps * mult);
    const util = upstreamCapacityMbps > 0
      ? parseFloat(((demand / upstreamCapacityMbps) * 100).toFixed(1))
      : 0;
    return {
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      demandMbps: demand,
      utilizationPercent: util,
      isPeakHour: h >= 19 && h <= 23
    };
  });

  const projected10DemandMbps = Math.round(peakDemandMbps * 1.10);
  const projected25DemandMbps = Math.round(peakDemandMbps * 1.25);
  const projected50DemandMbps = Math.round(peakDemandMbps * 1.50);

  let recommendedUpgradeMbps = 0;
  if (projected25DemandMbps > upstreamCapacityMbps) {
    const def = projected25DemandMbps - upstreamCapacityMbps;
    recommendedUpgradeMbps = Math.ceil(def / 50) * 50;
  }

  return {
    activeSubscribersCount: activeSubs.length,
    totalProvisionedBandwidthMbps,
    upstreamCapacityMbps,
    oversubscriptionRatio,
    peakConcurrencyPercent,
    peakDemandMbps,
    offPeakDemandMbps,
    peakUtilizationPercent,
    headroomMbps,
    congestionStatus,
    hourlyProfile,
    projected10DemandMbps,
    projected25DemandMbps,
    projected50DemandMbps,
    recommendedUpgradeMbps
  };
}

/**
 * Generates plain-text briefing on peak bandwidth utilization and shaping forecast.
 */
export function generateBandwidthShapingReport(metrics, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);
  const lines = [
    `=========================================`,
    `SHAHDARA ISP - PEAK TRAFFIC & SHAPING BRIEFING`,
    `Generated: ${dateStr} PKT`,
    `=========================================`,
    `[ BANDWIDTH CAPACITY & CONCURRENCY SUMMARY ]`,
    `  Active Subscribers: ${metrics.activeSubscribersCount}`,
    `  Total Provisioned Access: ${metrics.totalProvisionedBandwidthMbps} Mbps`,
    `  Upstream Wholesale Transit Link: ${metrics.upstreamCapacityMbps} Mbps`,
    `  Oversubscription Contention Ratio: 1:${metrics.oversubscriptionRatio}`,
    `  Peak Concurrency Assumption: ${metrics.peakConcurrencyPercent}%`,
    ``,
    `[ UTILIZATION & CONGESTION STATUS ]`,
    `  Peak Evening Demand (19:00 - 23:00 PKT): ${metrics.peakDemandMbps} Mbps`,
    `  Peak Link Utilization: ${metrics.peakUtilizationPercent}%`,
    `  Available Link Headroom: ${metrics.headroomMbps} Mbps`,
    `  Network Congestion Status: ${metrics.congestionStatus.toUpperCase()}`,
    ``,
    `[ SUBSCRIBER EXPANSION FORECAST ]`,
    `  +10% Growth Demand: ${metrics.projected10DemandMbps} Mbps (${metrics.upstreamCapacityMbps > 0 ? Math.round((metrics.projected10DemandMbps / metrics.upstreamCapacityMbps) * 100) : 0}% capacity)`,
    `  +25% Growth Demand: ${metrics.projected25DemandMbps} Mbps (${metrics.upstreamCapacityMbps > 0 ? Math.round((metrics.projected25DemandMbps / metrics.upstreamCapacityMbps) * 100) : 0}% capacity)`,
    `  +50% Growth Demand: ${metrics.projected50DemandMbps} Mbps (${metrics.upstreamCapacityMbps > 0 ? Math.round((metrics.projected50DemandMbps / metrics.upstreamCapacityMbps) * 100) : 0}% capacity)`,
    `  Recommended Link Expansion: ${metrics.recommendedUpgradeMbps > 0 ? `+${metrics.recommendedUpgradeMbps} Mbps` : 'Adequate Link Capacity'}`
  ];

  lines.push(`=========================================`);
  return lines.join('\n');
}

/**
 * Wires the Bandwidth Shaping & Concurrency Modal dialog.
 */
export function setupBandwidthShapingModal(state, { referenceDate = new Date(), onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardShapingModal');
  const openBtn = document.getElementById('dashboardOpenShapingModalBtn');
  const closeBtn = document.getElementById('dashboardShapingModalCloseBtn');
  const copyBtn = document.getElementById('dashboardCopyShapingReportBtn');

  const provEl = document.getElementById('shapingProvisionedVal');
  const peakEl = document.getElementById('shapingPeakDemandVal');
  const utilEl = document.getElementById('shapingUtilVal');
  const headroomEl = document.getElementById('shapingHeadroomVal');
  const statusBadge = document.getElementById('shapingStatusBadge');

  const p10El = document.getElementById('shapingProj10Val');
  const p25El = document.getElementById('shapingProj25Val');
  const p50El = document.getElementById('shapingProj50Val');
  const upgradeEl = document.getElementById('shapingUpgradeRecVal');

  let activeRatio = 8;

  function renderModalContent() {
    const data = calculateBandwidthShapingMetrics(state, referenceDate, { oversubscriptionRatio: activeRatio });

    if (provEl) provEl.textContent = `${data.totalProvisionedBandwidthMbps} Mbps`;
    if (peakEl) peakEl.textContent = `${data.peakDemandMbps} Mbps`;
    if (utilEl) {
      utilEl.textContent = `${data.peakUtilizationPercent}%`;
      utilEl.style.color = data.peakUtilizationPercent < 70 ? '#047857' : (data.peakUtilizationPercent <= 85 ? '#d97706' : '#dc2626');
    }
    if (headroomEl) headroomEl.textContent = `${data.headroomMbps} Mbps`;
    if (statusBadge) {
      statusBadge.textContent = data.congestionStatus;
      statusBadge.className = `role-badge ${data.congestionStatus === 'Healthy Bandwidth Headroom' ? 'role-primary' : (data.congestionStatus === 'Moderate Congestion' ? 'role-standby' : 'role-other')}`;
    }

    if (p10El) p10El.textContent = `${data.projected10DemandMbps} Mbps`;
    if (p25El) p25El.textContent = `${data.projected25DemandMbps} Mbps`;
    if (p50El) p50El.textContent = `${data.projected50DemandMbps} Mbps`;
    if (upgradeEl) {
      upgradeEl.textContent = data.recommendedUpgradeMbps > 0 ? `+${data.recommendedUpgradeMbps} Mbps` : 'None required';
      upgradeEl.style.color = data.recommendedUpgradeMbps > 0 ? '#dc2626' : '#047857';
    }
  }

  const ratioBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('#shapingRatioGroup .chart-range-btn')
    : [];

  ratioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const r = parseInt(btn.dataset?.shapingRatio || btn.getAttribute?.('data-shaping-ratio') || '8', 10);
      activeRatio = r;
      ratioBtns.forEach(b => {
        const isActive = b === btn;
        if (b.classList?.toggle) b.classList.toggle('is-active', isActive);
        if (b.setAttribute) b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      renderModalContent();
    });
  });

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', () => {
      renderModalContent();
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    });
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const data = calculateBandwidthShapingMetrics(state, referenceDate, { oversubscriptionRatio: activeRatio });
      const text = generateBandwidthShapingReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Bandwidth shaping briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }
}

/**
 * Calculates Fiber Distribution Hub (FDH) and optical splitter capacity metrics.
 * Evaluates port distribution, active vs offline drops, dark fiber headroom,
 * attenuation estimates (dBm), and capacity expansion requirements per area/hub.
 */
export function calculateFiberDistributionMetrics(state, options = {}) {
  const targetSplitterSize = Number(options.targetSplitterSize) || 8;

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const areaMap = new Map();

  for (const customer of customers) {
    if (customer.archived) continue;
    const rawArea = typeof customer.area === 'string' ? customer.area.trim() : '';
    const areaName = rawArea || 'Central Hub / Unassigned';

    if (!areaMap.has(areaName)) {
      areaMap.set(areaName, {
        areaName,
        totalCustomers: 0,
        activeCustomers: 0,
        offlineCustomers: 0
      });
    }

    const hub = areaMap.get(areaName);
    hub.totalCustomers++;
    if (customer.status === 'offline') {
      hub.offlineCustomers++;
    } else {
      hub.activeCustomers++;
    }
  }

  // Pre-configured distance benchmarks from Core Shahdara OLT Hub (km)
  const AREA_DISTANCES = {
    'Farooq Ganj': 1.8,
    'Baradari Road': 2.0,
    'Saeed Park': 2.5,
    'Begum Kot': 2.8,
    'Shahdara Town': 3.2,
    'Jia Musa': 3.0,
    'Wandala Road': 4.1,
    'Nain Sukh': 4.5,
    'Ravi Toll': 2.2,
    'Chungi Amar Sidhu': 3.5
  };

  const hubs = [];
  let totalDeployedPorts = 0;
  let totalAssignedPorts = 0;
  let totalActivePorts = 0;
  let totalOfflinePorts = 0;
  let totalSparePorts = 0;
  let totalSplittersDeployed = 0;
  let highSaturationCount = 0;
  let criticalSaturationCount = 0;
  let expansionSplittersNeeded25 = 0;

  for (const [areaName, data] of areaMap.entries()) {
    const totalSubscribers = data.totalCustomers;
    const activeSubscribers = data.activeCustomers;
    const offlineSubscribers = data.offlineCustomers;

    // Optical splitters are deployed in discrete blocks of targetSplitterSize (e.g. 1:8 or 1:16)
    const splitters = Math.max(1, Math.ceil(totalSubscribers / targetSplitterSize));
    const totalPorts = splitters * targetSplitterSize;
    const assignedPorts = totalSubscribers;
    const sparePorts = Math.max(0, totalPorts - assignedPorts);
    const saturationPercent = totalPorts > 0
      ? parseFloat(((assignedPorts / totalPorts) * 100).toFixed(1))
      : 0;

    let saturationTier = 'Optimal';
    let badgeClass = 'badge-good';
    if (saturationPercent >= 85) {
      saturationTier = 'Critical Saturation';
      badgeClass = 'badge-danger';
      criticalSaturationCount++;
    } else if (saturationPercent >= 70) {
      saturationTier = 'High Density';
      badgeClass = 'badge-warn';
      highSaturationCount++;
    }

    // Optical Link Loss & Rx Signal calculation (dBm)
    // Nominal OLT Class C+ Tx power = +4.5 dBm
    // 1:8 Splitter Loss ~ 10.5 dB (or 1:16 ~ 13.8 dB)
    const splitterLoss = targetSplitterSize >= 16 ? 13.8 : 10.5;
    const distanceKm = AREA_DISTANCES[areaName] || 2.4;
    const fiberLoss = parseFloat((distanceKm * 0.35).toFixed(2)); // 0.35 dB/km @ 1310nm
    const connectorLoss = 1.6; // 4 connectors / splices @ 0.4 dB
    const totalLossDb = parseFloat((splitterLoss + fiberLoss + connectorLoss).toFixed(2));
    const estRxPowerDbm = parseFloat((4.5 - totalLossDb).toFixed(1));

    let signalStatus = 'Signal Optimal';
    if (estRxPowerDbm < -26.0) {
      signalStatus = 'High Attenuation';
    } else if (estRxPowerDbm < -24.0) {
      signalStatus = 'Acceptable Margin';
    }

    // Growth forecasts (+10%, +25%, +50%)
    const proj10 = Math.ceil(totalSubscribers * 1.10);
    const proj25 = Math.ceil(totalSubscribers * 1.25);
    const proj50 = Math.ceil(totalSubscribers * 1.50);

    const neededSplitters25 = Math.max(0, Math.ceil(proj25 / targetSplitterSize) - splitters);
    expansionSplittersNeeded25 += neededSplitters25;

    totalDeployedPorts += totalPorts;
    totalAssignedPorts += assignedPorts;
    totalActivePorts += activeSubscribers;
    totalOfflinePorts += offlineSubscribers;
    totalSparePorts += sparePorts;
    totalSplittersDeployed += splitters;

    hubs.push({
      areaName,
      totalSubscribers,
      activeSubscribers,
      offlineSubscribers,
      splitters,
      totalPorts,
      assignedPorts,
      sparePorts,
      saturationPercent,
      saturationTier,
      badgeClass,
      distanceKm,
      totalLossDb,
      estRxPowerDbm,
      signalStatus,
      proj10,
      proj25,
      proj50,
      neededSplitters25
    });
  }

  // Sort hubs descending by assigned ports / saturation
  hubs.sort((a, b) => b.assignedPorts - a.assignedPorts || b.saturationPercent - a.saturationPercent);

  const overallSaturationPercent = totalDeployedPorts > 0
    ? parseFloat(((totalAssignedPorts / totalDeployedPorts) * 100).toFixed(1))
    : 0;

  let networkStatus = 'Optimal Headroom Available';
  if (hubs.length === 0 || totalDeployedPorts === 0) {
    networkStatus = 'No Active Fiber Drops';
  } else if (overallSaturationPercent >= 85 || criticalSaturationCount > 0) {
    networkStatus = 'Critical Port Saturation Risk';
  } else if (overallSaturationPercent >= 70 || highSaturationCount > 0) {
    networkStatus = 'High Port Density';
  }

  const projected10TotalPorts = Math.ceil(totalAssignedPorts * 1.10);
  const projected25TotalPorts = Math.ceil(totalAssignedPorts * 1.25);
  const projected50TotalPorts = Math.ceil(totalAssignedPorts * 1.50);

  return {
    hubs,
    totalDeployedPorts,
    totalAssignedPorts,
    totalActivePorts,
    totalOfflinePorts,
    totalSparePorts,
    totalSplittersDeployed,
    overallSaturationPercent,
    highSaturationCount,
    criticalSaturationCount,
    networkStatus,
    targetSplitterSize,
    projected10TotalPorts,
    projected25TotalPorts,
    projected50TotalPorts,
    expansionSplittersNeeded25
  };
}

/**
 * Generates plain-text briefing on fiber distribution hubs and optical splitter capacity.
 */
export function generateFiberDistributionReport(metrics, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);

  const lines = [
    '================================================================',
    'SHAHDARA ISP - FIBER DISTRIBUTION HUB & OPTICAL SPLITTER AUDIT',
    '================================================================',
    `Date: ${dateStr} | Central OLT: Shahdara Core Hub`,
    `Topology: GPON Class C+ | Distribution Splitter Standard: 1:${metrics.targetSplitterSize}`,
    '',
    `Total Splitter Ports Provisioned: ${metrics.totalDeployedPorts}`,
    `Assigned Customer Drops: ${metrics.totalAssignedPorts} (Active: ${metrics.totalActivePorts}, Offline: ${metrics.totalOfflinePorts})`,
    `Dark Fiber / Spare Ports Available: ${metrics.totalSparePorts}`,
    `Network-Wide Port Saturation: ${metrics.overallSaturationPercent}%`,
    `Network Status: ${metrics.networkStatus}`,
    `Hubs In Saturation Warning: ${metrics.highSaturationCount + metrics.criticalSaturationCount} / ${metrics.hubs.length}`,
    '',
    '----------------------------------------------------------------',
    'AREA / HUB DISTRIBUTION MATRIX:',
    '----------------------------------------------------------------'
  ];

  if (!metrics.hubs || metrics.hubs.length === 0) {
    lines.push('No active customer fiber drops recorded.');
  } else {
    for (const h of metrics.hubs) {
      lines.push(
        `• ${h.areaName}: ${h.assignedPorts} / ${h.totalPorts} ports (${h.saturationPercent}%) - ${h.saturationTier} ` +
        `[${h.splitters}x 1:${metrics.targetSplitterSize} splitters, ${h.sparePorts} dark, Rx: ${h.estRxPowerDbm} dBm, ${h.signalStatus}]`
      );
    }
  }

  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('CAPACITY EXPANSION FORECAST (+25% Growth):');
  lines.push('----------------------------------------------------------------');
  lines.push(`Projected Customer Drops: ${metrics.projected25TotalPorts} (+${Math.max(0, metrics.projected25TotalPorts - metrics.totalAssignedPorts)})`);
  lines.push(`Additional 1:${metrics.targetSplitterSize} Splitters Required: ${metrics.expansionSplittersNeeded25} units`);
  lines.push('Target Headroom: Maintain at least 2 dark ports per FDH enclosure.');
  lines.push('================================================================');

  return lines.join('\n');
}

/**
 * Sets up the Fiber Distribution Hub & Optical Splitter modal dialog and clipboard reporting.
 */
export function setupFiberDistributionModal(state, options = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardFiberModal');
  const openBtn = document.getElementById('dashboardOpenFiberModalBtn');
  const closeBtn = document.getElementById('dashboardFiberModalCloseBtn');
  const copyBtn = document.getElementById('dashboardCopyFiberReportBtn');
  const referenceDate = options.referenceDate || new Date();
  const onToast = options.onToast;
  const clipboard = options.clipboard;

  let activeFilter = 'all';

  function renderModalContent() {
    const data = calculateFiberDistributionMetrics(state, { targetSplitterSize: 8 });

    const totalEl = document.getElementById('fiberTotalPortsVal');
    const assignedEl = document.getElementById('fiberAssignedVal');
    const spareEl = document.getElementById('fiberSpareVal');
    const satEl = document.getElementById('fiberSaturationVal');
    const badgeEl = document.getElementById('fiberStatusBadge');
    const tbody = document.getElementById('fiberHubTableBody');
    const p10El = document.getElementById('fiberProj10Val');
    const p25El = document.getElementById('fiberProj25Val');
    const p50El = document.getElementById('fiberProj50Val');
    const expEl = document.getElementById('fiberExpansionSplittersVal');

    if (totalEl) totalEl.textContent = `${data.totalDeployedPorts} Ports`;
    if (assignedEl) assignedEl.textContent = `${data.totalAssignedPorts} Drops`;
    if (spareEl) spareEl.textContent = `${data.totalSparePorts} Ports`;
    if (satEl) satEl.textContent = `${data.overallSaturationPercent}%`;
    if (badgeEl) {
      badgeEl.textContent = data.networkStatus;
      badgeEl.className = 'role-badge ' + (data.overallSaturationPercent >= 85 ? 'role-danger' : (data.overallSaturationPercent >= 70 ? 'role-warn' : 'role-primary'));
    }

    if (p10El) p10El.textContent = `${data.projected10TotalPorts} Drops`;
    if (p25El) p25El.textContent = `${data.projected25TotalPorts} Drops`;
    if (p50El) p50El.textContent = `${data.projected50TotalPorts} Drops`;
    if (expEl) expEl.textContent = data.expansionSplittersNeeded25 > 0 ? `+${data.expansionSplittersNeeded25} Splitters` : 'Headroom sufficient';

    if (tbody) {
      let filteredHubs = data.hubs;
      if (activeFilter === 'high') {
        filteredHubs = data.hubs.filter(h => h.saturationPercent >= 70);
      } else if (activeFilter === 'healthy') {
        filteredHubs = data.hubs.filter(h => h.saturationPercent < 70);
      }

      if (filteredHubs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--muted); padding: 16px;">No hubs match the selected capacity filter.</td></tr>';
      } else {
        tbody.innerHTML = filteredHubs.map(h => `
          <tr>
            <td><strong>${escapeXml(h.areaName)}</strong></td>
            <td>${h.splitters}x (1:8)</td>
            <td>${h.assignedPorts} / ${h.totalPorts}</td>
            <td><strong style="color: ${h.sparePorts > 2 ? '#047857' : '#d97706'};">${h.sparePorts}</strong></td>
            <td>${h.saturationPercent}%</td>
            <td><span class="signal-tag">${h.estRxPowerDbm} dBm</span></td>
            <td><span class="badge ${escapeXml(h.badgeClass)}">${escapeXml(h.saturationTier)}</span></td>
          </tr>
        `).join('');
      }
    }
  }

  const filterBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('#fiberFilterGroup .chart-range-btn')
    : [];

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset?.fiberFilter || btn.getAttribute?.('data-fiber-filter') || 'all';
      activeFilter = f;
      filterBtns.forEach(b => {
        const isActive = b === btn;
        if (b.classList?.toggle) b.classList.toggle('is-active', isActive);
        if (b.setAttribute) b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      renderModalContent();
    });
  });

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', () => {
      renderModalContent();
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    });
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const data = calculateFiberDistributionMetrics(state, { targetSplitterSize: 8 });
      const text = generateFiberDistributionReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Fiber distribution briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }
}

export const DELINQUENCY_STAGES = [
  {
    stageKey: 'grace',
    stageName: 'Grace Period (Gentle Reminder)',
    shortLabel: '1-7 Days (Grace)',
    windowLabel: '1-7 Days',
    minDays: 1,
    maxDays: 7,
    recoveryProbability: 0.90,
    protocol: 'Automated SMS / WhatsApp payment reminder',
    color: '#0e5b4d'
  },
  {
    stageKey: 'notice',
    stageName: 'Notice of Disconnection',
    shortLabel: '8-21 Days (Notice)',
    windowLabel: '8-21 Days',
    minDays: 8,
    maxDays: 21,
    recoveryProbability: 0.70,
    protocol: 'Field collector visit & disconnection notice delivery',
    color: '#0284c7'
  },
  {
    stageKey: 'suspension_risk',
    stageName: 'Soft Suspension Risk',
    shortLabel: '22-45 Days (Throttle)',
    windowLabel: '22-45 Days',
    minDays: 22,
    maxDays: 45,
    recoveryProbability: 0.45,
    protocol: 'Speed throttle / soft suspension & supervisor audit call',
    color: '#d97706'
  },
  {
    stageKey: 'severe',
    stageName: 'Severe Delinquency Escalation',
    shortLabel: '46+ Days (Severed)',
    windowLabel: '46+ Days',
    minDays: 46,
    maxDays: Infinity,
    recoveryProbability: 0.15,
    protocol: 'Physical drop disconnection & CPE equipment recovery',
    color: '#dc2626'
  }
];

export function calculateDelinquencyRecoveryPipeline(state, referenceDate = new Date()) {
  const refTime = referenceDate.getTime();
  const allocations = calculatePaymentAllocations(state);
  const retainedMonths = new Set(monthsForHistory(referenceDate));

  const stages = DELINQUENCY_STAGES.map(def => ({
    ...def,
    subscriberCount: 0,
    subscribers: [],
    totalOverdueAmount: 0,
    expectedRecoverableAmount: 0,
    percentOfTotalDues: 0
  }));

  const stageMap = new Map();
  for (const s of stages) {
    stageMap.set(s.stageKey, s);
  }

  const delinquentCustomers = [];
  const areaAggregationMap = new Map();

  let totalDelinquentAccounts = 0;
  let totalDelinquentDues = 0;

  for (const c of (state?.customers ?? [])) {
    if (c.archived) continue;

    let customerDueCents = 0;
    let oldestUnpaidBill = null;
    let oldestUnpaidDays = 0;

    for (const bill of (c.bills ?? [])) {
      if (!retainedMonths.has(bill.month)) continue;
      const alloc = allocations.forMonth?.(c.id, bill.month);
      const balanceDueCents = alloc?.balanceDueCents ?? Math.round(Number(bill.amount || 0) * 100);

      if (balanceDueCents > 0) {
        customerDueCents += balanceDueCents;
        let billDueDate = null;
        if (bill.dueDate) {
          billDueDate = new Date(bill.dueDate);
        } else if (bill.month) {
          billDueDate = new Date(`${bill.month}-10`);
        }

        let daysOverdue = 1;
        if (billDueDate && !isNaN(billDueDate.getTime())) {
          const diffDays = Math.floor((refTime - billDueDate.getTime()) / (1000 * 60 * 60 * 24));
          daysOverdue = Math.max(1, diffDays);
        }

        if (!oldestUnpaidBill || daysOverdue > oldestUnpaidDays) {
          oldestUnpaidBill = bill;
          oldestUnpaidDays = daysOverdue;
        }
      }
    }

    const totalOverdue = Math.round(customerDueCents / 100);
    if (totalOverdue <= 0) continue;

    totalDelinquentAccounts++;
    totalDelinquentDues += totalOverdue;

    let matchedStage = stages[0];
    for (const s of stages) {
      if (oldestUnpaidDays >= s.minDays && oldestUnpaidDays <= s.maxDays) {
        matchedStage = s;
        break;
      }
    }

    const customerSummary = {
      id: c.id,
      customerNumber: c.customerNumber || '',
      name: c.name || 'Unnamed',
      area: c.area || 'Unassigned',
      phone: c.phone || '',
      package: c.packageSpeed || 'Unassigned',
      balanceDue: totalOverdue,
      daysOverdue: oldestUnpaidDays,
      oldestMonth: oldestUnpaidBill?.month || '',
      stageKey: matchedStage.stageKey,
      stageName: matchedStage.stageName,
      serviceStatus: c.serviceStatus || 'not-set'
    };

    matchedStage.subscriberCount++;
    matchedStage.totalOverdueAmount += totalOverdue;
    matchedStage.subscribers.push(customerSummary);
    delinquentCustomers.push(customerSummary);

    const areaKey = customerSummary.area;
    if (!areaAggregationMap.has(areaKey)) {
      areaAggregationMap.set(areaKey, {
        areaName: areaKey,
        delinquentAccounts: 0,
        totalOverdue: 0,
        severeCount: 0,
        expectedRecovery: 0
      });
    }
    const areaItem = areaAggregationMap.get(areaKey);
    areaItem.delinquentAccounts++;
    areaItem.totalOverdue += totalOverdue;
    if (matchedStage.stageKey === 'severe') {
      areaItem.severeCount++;
    }
    areaItem.expectedRecovery += Math.round(totalOverdue * matchedStage.recoveryProbability);
  }

  let totalExpectedRecovery = 0;
  for (const s of stages) {
    s.expectedRecoverableAmount = Math.round(s.totalOverdueAmount * s.recoveryProbability);
    s.percentOfTotalDues = totalDelinquentDues > 0 ? Math.round((s.totalOverdueAmount / totalDelinquentDues) * 100) : 0;
    totalExpectedRecovery += s.expectedRecoverableAmount;
  }

  const blendedRecoveryRatePercent = totalDelinquentDues > 0
    ? Number(((totalExpectedRecovery / totalDelinquentDues) * 100).toFixed(1))
    : 0;

  const severeStage = stageMap.get('severe');
  const severeAtRiskAmount = severeStage?.totalOverdueAmount ?? 0;
  const severePercent = totalDelinquentDues > 0 ? (severeAtRiskAmount / totalDelinquentDues) * 100 : 0;

  let pipelineHealthStatus = 'Healthy Pacing';
  let pipelineHealthBadgeClass = 'badge-expansion';
  if (totalDelinquentAccounts === 0) {
    pipelineHealthStatus = 'Clean Ledger (Zero Delinquency)';
    pipelineHealthBadgeClass = 'badge-expansion';
  } else if (severePercent >= 35) {
    pipelineHealthStatus = 'Critical Escalation Required';
    pipelineHealthBadgeClass = 'badge-contraction';
  } else if (severePercent >= 15) {
    pipelineHealthStatus = 'Moderate Delinquency Backlog';
    pipelineHealthBadgeClass = 'badge-stable';
  }

  const dailyPacingTarget = Math.round(totalExpectedRecovery / 30);

  const topDelinquentAreas = Array.from(areaAggregationMap.values())
    .sort((a, b) => b.totalOverdue - a.totalOverdue || b.delinquentAccounts - a.delinquentAccounts);

  const topDelinquentAccounts = [...delinquentCustomers]
    .sort((a, b) => b.balanceDue - a.balanceDue || b.daysOverdue - a.daysOverdue);

  return {
    totalDelinquentAccounts,
    totalDelinquentDues,
    totalExpectedRecovery,
    blendedRecoveryRatePercent,
    severeAtRiskAmount,
    pipelineHealthStatus,
    pipelineHealthBadgeClass,
    dailyPacingTarget,
    stages,
    topDelinquentAreas,
    topDelinquentAccounts
  };
}

export function generateDelinquencyPipelineReport(pipelineData, referenceDate = new Date()) {
  const dateStr = referenceDate.toISOString().slice(0, 10);
  const lines = [
    `🚨 SHAHDARA ISP - DELINQUENCY RECOVERY & ESCALATION BRIEFING`,
    `Generated: ${dateStr} PKT`,
    `--------------------------------------------------`,
    `[ PIPELINE RECOVERY STATUS ]`,
    `  Health Status: ${pipelineData.pipelineHealthStatus}`,
    `  Delinquent Accounts: ${pipelineData.totalDelinquentAccounts}`,
    `  Total Overdue Dues: ${formatPKR(pipelineData.totalDelinquentDues)}`,
    `  Expected Realizable Recovery: ${formatPKR(pipelineData.totalExpectedRecovery)} (${pipelineData.blendedRecoveryRatePercent}% blended)`,
    `  Severe At-Risk Dues: ${formatPKR(pipelineData.severeAtRiskAmount)}`,
    `  Daily Collector Pacing Target: ${formatPKR(pipelineData.dailyPacingTarget)} / day`,
    ``,
    `[ AGING STAGES & ESCALATION PROTOCOLS ]`
  ];

  for (const s of pipelineData.stages) {
    lines.push(`  • ${s.stageName} (${s.windowLabel}):`);
    lines.push(`    Subscribers: ${s.subscriberCount} | Overdue: ${formatPKR(s.totalOverdueAmount)} (${s.percentOfTotalDues}%)`);
    lines.push(`    Expected Net: ${formatPKR(s.expectedRecoverableAmount)} (P=${Math.round(s.recoveryProbability * 100)}%)`);
    lines.push(`    Action: ${s.protocol}`);
  }

  lines.push(``);
  lines.push(`[ AREA DELINQUENCY CONCENTRATION ]`);
  if (pipelineData.topDelinquentAreas.length === 0) {
    lines.push(`  None recorded`);
  } else {
    pipelineData.topDelinquentAreas.slice(0, 5).forEach((a, i) => {
      lines.push(`  ${i + 1}. ${a.areaName}: ${a.delinquentAccounts} accounts | Overdue: ${formatPKR(a.totalOverdue)} | Severe: ${a.severeCount}`);
    });
  }

  lines.push(``);
  lines.push(`[ PRIORITY ESCALATION ACCOUNTS ]`);
  if (pipelineData.topDelinquentAccounts.length === 0) {
    lines.push(`  None recorded`);
  } else {
    pipelineData.topDelinquentAccounts.slice(0, 8).forEach(acc => {
      lines.push(`  • ${acc.name} (${acc.area}): ${formatPKR(acc.balanceDue)} overdue (${acc.daysOverdue}d) [${acc.stageName}]`);
    });
  }

  lines.push(`--------------------------------------------------`);
  lines.push(`Shahdara ISP Field Collection & Revenue Recovery Operations`);
  return lines.join('\n');
}

export function setupDelinquencyPipelineModal(state, { referenceDate = new Date(), onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardDelinquencyModal');
  const openBtn = document.getElementById('dashboardOpenDelinquencyModalBtn');
  const closeBtn = document.getElementById('dashboardDelinquencyModalCloseBtn');
  const stageTableBody = document.getElementById('delinquencyStageTableBody');
  const accountsTableBody = document.getElementById('delinquencyAccountsTableBody');
  const copyBtn = document.getElementById('dashboardCopyDelinquencyReportBtn');

  const totalAccountsEl = document.getElementById('delinquencyTotalAccountsVal');
  const totalDuesEl = document.getElementById('delinquencyTotalDuesVal');
  const expectedRecoveryEl = document.getElementById('delinquencyExpectedRecoveryVal');
  const blendedRateEl = document.getElementById('delinquencyBlendedRateVal');
  const statusBadgeEl = document.getElementById('delinquencyStatusBadge');
  const dailyTargetEl = document.getElementById('delinquencyDailyTargetVal');

  if (!modal) return;

  function populateAndOpen() {
    const data = calculateDelinquencyRecoveryPipeline(state, referenceDate);

    if (totalAccountsEl) totalAccountsEl.textContent = String(data.totalDelinquentAccounts);
    if (totalDuesEl) totalDuesEl.textContent = formatPKR(data.totalDelinquentDues);
    if (expectedRecoveryEl) expectedRecoveryEl.textContent = formatPKR(data.totalExpectedRecovery);
    if (blendedRateEl) blendedRateEl.textContent = `${data.blendedRecoveryRatePercent}% blended recovery`;
    if (statusBadgeEl) {
      statusBadgeEl.textContent = data.pipelineHealthStatus;
      statusBadgeEl.className = `sim-delta-badge ${data.pipelineHealthBadgeClass}`;
    }
    if (dailyTargetEl) dailyTargetEl.textContent = `Target: ${formatPKR(data.dailyPacingTarget)} / day`;

    if (stageTableBody) {
      stageTableBody.innerHTML = data.stages.map(s => `
        <tr>
          <td><strong style="color: ${s.color};">${escapeXml(s.stageName)}</strong></td>
          <td><span class="status-pill status-watchlist">${escapeXml(s.windowLabel)}</span></td>
          <td>${s.subscriberCount}</td>
          <td><strong>${formatPKR(s.totalOverdueAmount)}</strong></td>
          <td>${Math.round(s.recoveryProbability * 100)}%</td>
          <td style="color: #047857; font-weight: 700;">${formatPKR(s.expectedRecoverableAmount)}</td>
          <td class="text-muted">${escapeXml(s.protocol)}</td>
        </tr>
      `).join('');
    }

    if (accountsTableBody) {
      if (data.topDelinquentAccounts.length === 0) {
        accountsTableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">No delinquent subscriber accounts</td></tr>';
      } else {
        accountsTableBody.innerHTML = data.topDelinquentAccounts.map(acc => `
          <tr>
            <td><strong>${escapeXml(acc.name)}</strong></td>
            <td>${escapeXml(acc.area)}</td>
            <td>${escapeXml(acc.phone || '—')}</td>
            <td>${escapeXml(acc.package)}</td>
            <td><span class="status-pill ${acc.daysOverdue >= 46 ? 'status-delinquent' : (acc.daysOverdue >= 22 ? 'status-watchlist' : 'status-good')}">${acc.daysOverdue} days</span></td>
            <td><strong style="color: #b91c1c;">${formatPKR(acc.balanceDue)}</strong></td>
            <td><span class="role-badge" style="background: ${acc.stageKey === 'severe' ? '#fee2e2' : (acc.stageKey === 'suspension_risk' ? '#fef3c7' : '#e0f2fe')}; color: ${acc.stageKey === 'severe' ? '#991b1b' : (acc.stageKey === 'suspension_risk' ? '#92400e' : '#075985')}">${escapeXml(acc.stageName)}</span></td>
            <td>
              <button class="small-action-btn" type="button" data-delinquency-filter-id="${acc.id}">View Roster</button>
            </td>
          </tr>
        `).join('');

        const filterBtns = accountsTableBody.querySelectorAll('[data-delinquency-filter-id]');
        filterBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const cid = btn.getAttribute('data-delinquency-filter-id');
            if (typeof onFilterCustomer === 'function') {
              onFilterCustomer(cid);
              if (modal.close) modal.close();
              else modal.removeAttribute('open');
            }
          });
        });
      }
    }

    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
  }

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const data = calculateDelinquencyRecoveryPipeline(state, referenceDate);
      const text = generateDelinquencyPipelineReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Delinquency recovery briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }
}

export const CPE_STANDARD_MODELS = [
  {
    modelId: 'huawei-hg8546m',
    modelName: 'Huawei EchoLife HG8546M GPON',
    category: 'Single-Band GPON ONT',
    standardUnitCost: 4500,
    minSpeedMbps: 10
  },
  {
    modelId: 'zte-f670l',
    modelName: 'ZTE F670L Dual-Band Gigabit XPON',
    category: 'Dual-Band Gigabit XPON',
    standardUnitCost: 6500,
    minSpeedMbps: 20
  },
  {
    modelId: 'fiberhome-an5506',
    modelName: 'FiberHome AN5506 GPON ONT',
    category: 'Gigabit GPON ONT',
    standardUnitCost: 3800,
    minSpeedMbps: 5
  },
  {
    modelId: 'generic-onu',
    modelName: 'Standard 1GE+WiFi Bridge ONU',
    category: 'Entry-Level ONU',
    standardUnitCost: 3200,
    minSpeedMbps: 1
  }
];

export function resolveSubscriberCpeModel(customer) {
  if (customer.cpeModel && String(customer.cpeModel).trim()) {
    const name = String(customer.cpeModel).trim();
    const matched = CPE_STANDARD_MODELS.find(m => m.modelName.toLowerCase().includes(name.toLowerCase()));
    if (matched) return matched;
    return {
      modelId: 'custom-model',
      modelName: name,
      category: 'Customer Specified',
      standardUnitCost: 4500,
      minSpeedMbps: 10
    };
  }

  const pkg = String(customer.packageSpeed || '').toLowerCase();
  let speedMbps = 5;
  const match = pkg.match(/(\d+(?:\.\d+)?)\s*(?:mbps|m\b|g\b)/i);
  if (match) {
    speedMbps = parseFloat(match[1]);
  } else if (pkg.includes('15mbps')) {
    speedMbps = 15;
  } else if (pkg.includes('3mbps')) {
    speedMbps = 3;
  }

  if (speedMbps >= 20 || pkg.includes('gigabit') || pkg.includes('dual')) {
    return CPE_STANDARD_MODELS[1]; // ZTE F670L
  }
  if (speedMbps >= 10) {
    return CPE_STANDARD_MODELS[0]; // Huawei HG8546M
  }
  if (speedMbps >= 5) {
    return CPE_STANDARD_MODELS[2]; // FiberHome AN5506
  }
  return CPE_STANDARD_MODELS[3]; // Generic
}

export function calculateCpeAssetMetrics(state, options = {}) {
  const referenceDate = options.referenceDate ?? new Date();
  const refTime = referenceDate.getTime();
  const allocations = calculatePaymentAllocations(state);
  const retainedMonths = new Set(monthsForHistory(referenceDate));

  let activeDeployedCount = 0;
  let dormantFieldCount = 0;
  let unconfiguredCount = 0;

  let activeFleetValuePkr = 0;
  let dormantCapitalAtRiskPkr = 0;
  let unconfiguredValuePkr = 0;

  const modelCountMap = new Map();
  for (const m of CPE_STANDARD_MODELS) {
    modelCountMap.set(m.modelName, {
      modelName: m.modelName,
      category: m.category,
      unitCost: m.standardUnitCost,
      deployedCount: 0,
      activeCount: 0,
      dormantCount: 0,
      totalValue: 0
    });
  }

  const retrievalCandidates = [];
  const areaCpeMap = new Map();

  for (const c of (state?.customers ?? [])) {
    if (c.archived) continue;

    const cpe = resolveSubscriberCpeModel(c);
    const unitCost = Number(options.customModelCosts?.[cpe.modelName] ?? cpe.standardUnitCost) || 4500;

    let cpeStats = modelCountMap.get(cpe.modelName);
    if (!cpeStats) {
      cpeStats = {
        modelName: cpe.modelName,
        category: cpe.category,
        unitCost,
        deployedCount: 0,
        activeCount: 0,
        dormantCount: 0,
        totalValue: 0
      };
      modelCountMap.set(cpe.modelName, cpeStats);
    }

    cpeStats.deployedCount++;
    cpeStats.totalValue += unitCost;

    const areaKey = c.area || 'Unassigned';
    if (!areaCpeMap.has(areaKey)) {
      areaCpeMap.set(areaKey, {
        areaName: areaKey,
        totalCpe: 0,
        activeCpe: 0,
        dormantCpe: 0,
        dormantValue: 0
      });
    }
    const areaStats = areaCpeMap.get(areaKey);
    areaStats.totalCpe++;

    let customerDueCents = 0;
    let oldestBillDate = null;
    for (const bill of (c.bills ?? [])) {
      if (!retainedMonths.has(bill.month)) continue;
      const alloc = allocations.forMonth?.(c.id, bill.month);
      const balanceDueCents = alloc?.balanceDueCents ?? Math.round(Number(bill.amount || 0) * 100);
      if (balanceDueCents > 0) {
        customerDueCents += balanceDueCents;
        const bDate = bill.dueDate ? new Date(bill.dueDate) : (bill.month ? new Date(`${bill.month}-10`) : null);
        if (bDate && (!oldestBillDate || bDate < oldestBillDate)) {
          oldestBillDate = bDate;
        }
      }
    }
    const totalDue = Math.round(customerDueCents / 100);

    let daysDormant = 0;
    if (c.offlineDate) {
      const offTime = new Date(c.offlineDate).getTime();
      if (!isNaN(offTime)) {
        daysDormant = Math.max(1, Math.floor((refTime - offTime) / (1000 * 60 * 60 * 24)));
      }
    } else if (oldestBillDate && !isNaN(oldestBillDate.getTime())) {
      daysDormant = Math.max(1, Math.floor((refTime - oldestBillDate.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      daysDormant = 14;
    }

    if (c.serviceStatus === 'active') {
      activeDeployedCount++;
      activeFleetValuePkr += unitCost;
      cpeStats.activeCount++;
      areaStats.activeCpe++;
    } else if (c.serviceStatus === 'offline') {
      dormantFieldCount++;
      dormantCapitalAtRiskPkr += unitCost;
      cpeStats.dormantCount++;
      areaStats.dormantCpe++;
      areaStats.dormantValue += unitCost;

      retrievalCandidates.push({
        id: c.id,
        name: c.name || 'Unnamed',
        customerNumber: c.customerNumber || '',
        area: areaKey,
        phone: c.phone || '',
        package: c.packageSpeed || 'Unassigned',
        cpeModel: cpe.modelName,
        unitCost,
        daysDormant,
        balanceDue: totalDue,
        priority: daysDormant >= 45 || totalDue > 3000 ? 'High' : 'Normal'
      });
    } else {
      unconfiguredCount++;
      unconfiguredValuePkr += unitCost;
    }
  }

  let warehouseStock = 0;
  let warehouseValuePkr = 0;
  let damagedStock = 0;
  let damagedValuePkr = 0;

  if (typeof options.warehouseStockOverride === 'number') {
    warehouseStock = options.warehouseStockOverride;
    warehouseValuePkr = warehouseStock * 4500;
  } else {
    const invItems = state?.inventoryItems ?? [];
    const onuItems = invItems.filter(item => {
      const cat = String(item.category || '').toLowerCase();
      const n = String(item.name || '').toLowerCase();
      return cat.includes('onu') || cat.includes('cpe') || cat.includes('router') || cat.includes('ont') ||
             n.includes('onu') || n.includes('router') || n.includes('ont');
    });

    if (onuItems.length > 0) {
      for (const item of onuItems) {
        const qty = Number(item.quantity) || 0;
        const cost = Number(item.costPerUnit) || 4500;
        if (item.status === 'damaged' || item.status === 'rma') {
          damagedStock += qty;
          damagedValuePkr += qty * cost;
        } else {
          warehouseStock += qty;
          warehouseValuePkr += qty * cost;
        }
      }
    } else {
      warehouseStock = Math.max(6, Math.round(activeDeployedCount * 0.12));
      warehouseValuePkr = warehouseStock * 4500;
    }
  }

  const totalCpeFleet = activeDeployedCount + dormantFieldCount + unconfiguredCount + warehouseStock + damagedStock;
  const totalFleetValuePkr = activeFleetValuePkr + dormantCapitalAtRiskPkr + unconfiguredValuePkr + warehouseValuePkr + damagedValuePkr;

  const activeUtilizationPercent = totalCpeFleet > 0 ? Math.round((activeDeployedCount / totalCpeFleet) * 100) : 0;
  const dormantRiskPercent = totalCpeFleet > 0 ? Math.round((dormantFieldCount / totalCpeFleet) * 100) : 0;
  const warehouseSparesPercent = totalCpeFleet > 0 ? Math.round((warehouseStock / totalCpeFleet) * 100) : 0;

  const estimatedWeeklyAdditions = Math.max(1, Math.round(activeDeployedCount * 0.02));
  const sparesRunwayWeeks = Math.round(warehouseStock / estimatedWeeklyAdditions);

  let fleetHealthStatus = 'Optimal Asset Efficiency';
  let fleetHealthBadgeClass = 'badge-expansion';
  if (totalCpeFleet === 0) {
    fleetHealthStatus = 'No CPE Fleet Tracked';
    fleetHealthBadgeClass = 'badge-expansion';
  } else if (dormantRiskPercent >= 25) {
    fleetHealthStatus = 'High Equipment Retrieval Needed';
    fleetHealthBadgeClass = 'badge-contraction';
  } else if (dormantRiskPercent >= 12) {
    fleetHealthStatus = 'Moderate Idle Asset Exposure';
    fleetHealthBadgeClass = 'badge-stable';
  }

  const modelDistribution = Array.from(modelCountMap.values())
    .filter(m => m.deployedCount > 0)
    .sort((a, b) => b.deployedCount - a.deployedCount);

  retrievalCandidates.sort((a, b) => {
    if (a.priority === 'High' && b.priority !== 'High') return -1;
    if (a.priority !== 'High' && b.priority === 'High') return 1;
    return b.daysDormant - a.daysDormant || b.balanceDue - a.balanceDue;
  });

  const areaBreakdown = Array.from(areaCpeMap.values())
    .sort((a, b) => b.dormantValue - a.dormantValue || b.totalCpe - a.totalCpe);

  return {
    totalCpeFleet,
    totalFleetValuePkr,
    activeDeployedCount,
    activeFleetValuePkr,
    activeUtilizationPercent,
    dormantFieldCount,
    dormantCapitalAtRiskPkr,
    dormantRiskPercent,
    unconfiguredCount,
    warehouseStock,
    warehouseValuePkr,
    warehouseSparesPercent,
    damagedStock,
    damagedValuePkr,
    sparesRunwayWeeks,
    fleetHealthStatus,
    fleetHealthBadgeClass,
    modelDistribution,
    retrievalCandidates,
    areaBreakdown
  };
}

export function generateCpeAssetBriefing(cpeData, referenceDate = new Date()) {
  const dateStr = referenceDate.toISOString().slice(0, 10);
  const lines = [
    `📡 SHAHDARA ISP - CPE & ONU ASSET LIFECYCLE AUDIT`,
    `Generated: ${dateStr} PKT`,
    `--------------------------------------------------`,
    `[ ASSET FLEET OVERVIEW ]`,
    `  Total Tracked Units: ${cpeData.totalCpeFleet}`,
    `  Total Fleet Book Value: ${formatPKR(cpeData.totalFleetValuePkr)}`,
    `  Active Field Deployment: ${cpeData.activeDeployedCount} units (${cpeData.activeUtilizationPercent}%) | Value: ${formatPKR(cpeData.activeFleetValuePkr)}`,
    `  Dormant in Field (At Risk): ${cpeData.dormantFieldCount} units (${cpeData.dormantRiskPercent}%) | Capital at Risk: ${formatPKR(cpeData.dormantCapitalAtRiskPkr)}`,
    `  Warehouse Spares: ${cpeData.warehouseStock} tested units (${cpeData.sparesRunwayWeeks} weeks deployment runway)`,
    `  Damaged / RMA: ${cpeData.damagedStock} units`,
    `  Fleet Health Status: ${cpeData.fleetHealthStatus}`,
    ``,
    `[ HARDWARE MODEL DISTRIBUTION ]`
  ];

  for (const m of cpeData.modelDistribution) {
    lines.push(`  • ${m.modelName}: ${m.deployedCount} deployed (${m.activeCount} active, ${m.dormantCount} dormant) | Book: ${formatPKR(m.totalValue)}`);
  }

  lines.push(``);
  lines.push(`[ HIGH-PRIORITY CPE RETRIEVAL MANIFEST ]`);
  if (cpeData.retrievalCandidates.length === 0) {
    lines.push(`  No dormant field equipment pending recovery.`);
  } else {
    cpeData.retrievalCandidates.slice(0, 8).forEach((sub, i) => {
      lines.push(`  ${i + 1}. ${sub.name} (${sub.area}) - ${sub.phone || 'No phone'}`);
      lines.push(`     Model: ${sub.cpeModel} (Est: ${formatPKR(sub.unitCost)}) | ${sub.daysDormant} days offline | Dues: ${formatPKR(sub.balanceDue)} [${sub.priority} Priority]`);
    });
  }

  lines.push(`--------------------------------------------------`);
  lines.push(`Shahdara ISP Field Network Operations & Asset Management`);
  return lines.join('\n');
}

export function setupCpeAssetModal(state, { referenceDate = new Date(), onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardCpeModal');
  const openBtn = document.getElementById('dashboardOpenCpeModalBtn');
  const closeBtn = document.getElementById('dashboardCpeModalCloseBtn');
  const retrievalTbody = document.getElementById('cpeRetrievalTableBody');
  const modelsTbody = document.getElementById('cpeModelsTableBody');
  const copyBtn = document.getElementById('dashboardCopyCpeReportBtn');

  const totalFleetEl = document.getElementById('cpeTotalFleetVal');
  const totalValueEl = document.getElementById('cpeTotalValueVal');
  const activeDeployEl = document.getElementById('cpeActiveDeployVal');
  const dormantRiskEl = document.getElementById('cpeDormantRiskVal');
  const statusBadgeEl = document.getElementById('cpeStatusBadge');
  const runwayEl = document.getElementById('cpeSparesRunwayVal');

  if (!modal) return;

  function populateAndOpen() {
    const data = calculateCpeAssetMetrics(state, { referenceDate });

    if (totalFleetEl) totalFleetEl.textContent = `${data.totalCpeFleet} Units`;
    if (totalValueEl) totalValueEl.textContent = formatPKR(data.totalFleetValuePkr);
    if (activeDeployEl) activeDeployEl.textContent = `${data.activeDeployedCount} Active (${data.activeUtilizationPercent}%)`;
    if (dormantRiskEl) dormantRiskEl.textContent = formatPKR(data.dormantCapitalAtRiskPkr);
    if (statusBadgeEl) {
      statusBadgeEl.textContent = data.fleetHealthStatus;
      statusBadgeEl.className = `sim-delta-badge ${data.fleetHealthBadgeClass}`;
    }
    if (runwayEl) runwayEl.textContent = `${data.warehouseStock} Spares (${data.sparesRunwayWeeks} wks runway)`;

    if (modelsTbody) {
      modelsTbody.innerHTML = data.modelDistribution.map(m => `
        <tr>
          <td><strong>${escapeXml(m.modelName)}</strong></td>
          <td><span class="status-pill status-good">${escapeXml(m.category)}</span></td>
          <td>${m.deployedCount}</td>
          <td>${m.activeCount}</td>
          <td style="color: ${m.dormantCount > 0 ? '#b91c1c' : 'inherit'}; font-weight: 700;">${m.dormantCount}</td>
          <td>${formatPKR(m.unitCost)}</td>
          <td><strong>${formatPKR(m.totalValue)}</strong></td>
        </tr>
      `).join('');
    }

    if (retrievalTbody) {
      if (data.retrievalCandidates.length === 0) {
        retrievalTbody.innerHTML = '<tr><td colspan="8" class="empty-cell">No dormant CPE equipment candidates for retrieval</td></tr>';
      } else {
        retrievalTbody.innerHTML = data.retrievalCandidates.map(sub => `
          <tr>
            <td><strong>${escapeXml(sub.name)}</strong></td>
            <td>${escapeXml(sub.area)}</td>
            <td>${escapeXml(sub.phone || '—')}</td>
            <td>${escapeXml(sub.cpeModel)}</td>
            <td><span class="status-pill ${sub.daysDormant >= 45 ? 'status-delinquent' : 'status-watchlist'}">${sub.daysDormant} days</span></td>
            <td>${formatPKR(sub.balanceDue)}</td>
            <td><span class="role-badge ${sub.priority === 'High' ? 'role-primary' : 'role-other'}">${sub.priority}</span></td>
            <td>
              <button class="small-action-btn" type="button" data-cpe-filter-id="${sub.id}">Locate</button>
            </td>
          </tr>
        `).join('');

        const filterBtns = retrievalTbody.querySelectorAll('[data-cpe-filter-id]');
        filterBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const cid = btn.getAttribute('data-cpe-filter-id');
            if (typeof onFilterCustomer === 'function') {
              onFilterCustomer(cid);
              if (modal.close) modal.close();
              else modal.removeAttribute('open');
            }
          });
        });
      }
    }

    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
  }

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const data = calculateCpeAssetMetrics(state, { referenceDate });
      const text = generateCpeAssetBriefing(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('CPE asset audit briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }
}

export const SHAHDARA_POWER_HUBS = [
  {
    id: 'hub-vandala-core',
    name: 'Shahdara Core NOC (Vandala Road)',
    role: 'Central NOC & Core OLT',
    primaryAreas: ['Vandala Road', 'Main Bazaar', 'Railway Road'],
    powerSource: 'Mains (LESCO)',
    batteryVoltage: 53.2,
    batteryCapacityAh: 200,
    batteryType: '48V LiFePO4 Smart Lithium',
    batteryHealthSoH: 98,
    batteryLevelPercent: 95,
    inverterLoadWatts: 580,
    generatorModel: 'Perkins 15 kVA Diesel Genset',
    generatorFuelLiters: 42,
    generatorCapacityLiters: 60,
    generatorFuelBurnRate: 1.8 // L/hr
  },
  {
    id: 'hub-begum-kot',
    name: 'Begum Kot Sub-POP Node',
    role: 'Area Distribution OLT',
    primaryAreas: ['Begum Kot', 'Shadbagh'],
    powerSource: 'Inverter Battery',
    batteryVoltage: 48.4,
    batteryCapacityAh: 100,
    batteryType: '48V AGM Deep Cycle Gel',
    batteryHealthSoH: 91,
    batteryLevelPercent: 68,
    inverterLoadWatts: 320,
    generatorModel: 'Honda 5.5 kVA Gas/Petrol Genset',
    generatorFuelLiters: 16,
    generatorCapacityLiters: 25,
    generatorFuelBurnRate: 1.1 // L/hr
  },
  {
    id: 'hub-saeed-park',
    name: 'Saeed Park Distribution Hub',
    role: 'Secondary OLT Node',
    primaryAreas: ['Saeed Park', 'Baradari Road'],
    powerSource: 'Mains (LESCO)',
    batteryVoltage: 52.8,
    batteryCapacityAh: 100,
    batteryType: '48V Tubular Deep Cycle',
    batteryHealthSoH: 89,
    batteryLevelPercent: 88,
    inverterLoadWatts: 310,
    generatorModel: 'Yamaha 3.5 kVA Inverter Genset',
    generatorFuelLiters: 11,
    generatorCapacityLiters: 18,
    generatorFuelBurnRate: 0.9 // L/hr
  },
  {
    id: 'hub-jia-musa',
    name: 'Jia Musa Remote OLT Node',
    role: 'Edge OLT & Solar Hybrid',
    primaryAreas: ['Jia Musa', 'Kot Mohibbu', 'Chah Jhabbay Wala'],
    powerSource: 'Mains (LESCO)',
    batteryVoltage: 51.5,
    batteryCapacityAh: 50,
    batteryType: '48V Lithium-Ion Rack',
    batteryHealthSoH: 95,
    batteryLevelPercent: 82,
    inverterLoadWatts: 190,
    generatorModel: 'Loncin 2.8 kVA Portable Genset',
    generatorFuelLiters: 7,
    generatorCapacityLiters: 12,
    generatorFuelBurnRate: 0.7 // L/hr
  }
];

/**
 * Calculates power outage backup telemetry, battery bank health, generator runtime, and outage resilience.
 */
export function calculatePowerBackupMetrics(state, options = {}) {
  const fuelCostPerLiter = typeof options.fuelCostPerLiter === 'number' && options.fuelCostPerLiter > 0
    ? options.fuelCostPerLiter
    : 285;

  const rawHubs = Array.isArray(options.hubsOverride) && options.hubsOverride.length > 0
    ? options.hubsOverride
    : SHAHDARA_POWER_HUBS;

  const customers = Array.isArray(state?.customers) ? state.customers.filter(c => !c.archived) : [];

  // Match customers to hubs by area
  const hubList = rawHubs.map(h => ({
    ...h,
    primaryAreas: Array.isArray(h.primaryAreas) ? [...h.primaryAreas] : [],
    activeSubscribers: 0,
    totalSubscribers: 0,
    subscribersList: []
  }));

  const fallbackHub = hubList[0] || null;

  for (const c of customers) {
    const rawArea = String(c.area || '').trim().toLowerCase();
    const isAct = String(c.serviceStatus || '').toLowerCase() === 'active';

    let matchedHub = hubList.find(h =>
      h.primaryAreas.some(a => String(a).trim().toLowerCase() === rawArea)
    );

    if (!matchedHub) {
      // Partial match
      matchedHub = hubList.find(h =>
        h.primaryAreas.some(a => rawArea.includes(String(a).trim().toLowerCase()) || String(a).trim().toLowerCase().includes(rawArea))
      );
    }

    if (!matchedHub && fallbackHub) {
      matchedHub = fallbackHub;
    }

    if (matchedHub) {
      matchedHub.totalSubscribers++;
      if (isAct) matchedHub.activeSubscribers++;
      matchedHub.subscribersList.push({
        id: c.id,
        name: c.name || 'Unnamed',
        area: c.area || 'Unassigned',
        serviceStatus: c.serviceStatus || 'not-set',
        phone: c.phone || ''
      });
    }
  }

  let totalActiveSubscribers = 0;
  let totalSubscribersProtected = 0;
  let totalFuelReservesLiters = 0;
  let totalFuelCapacityLiters = 0;
  let totalBatteryCapacityKwh = 0;
  let totalBatteryRunwayHoursSum = 0;
  let totalGeneratorBurnRateSum = 0;
  let totalHourlyFuelCostPkr = 0;
  let activeOutagesCount = 0;
  let criticalHubsCount = 0;

  const hubs = hubList.map(h => {
    totalActiveSubscribers += h.activeSubscribers;
    totalSubscribersProtected += h.totalSubscribers;

    const batteryCapAh = Number(h.batteryCapacityAh) || 100;
    const batteryPct = Math.min(100, Math.max(0, Number(h.batteryLevelPercent) || 0));
    const invWatts = Number(h.inverterLoadWatts) || 300;
    const volt = Number(h.batteryVoltage) || 48.0;

    // Battery energy storage in Wh = Ah * 48V * (pct / 100) * 0.85 (inverter efficiency)
    const usableWh = batteryCapAh * 48 * (batteryPct / 100) * 0.85;
    const batteryRunwayHours = invWatts > 0 ? Number((usableWh / invWatts).toFixed(1)) : 0;
    const totalHubBatteryKwh = Number(((batteryCapAh * 48) / 1000).toFixed(1));
    totalBatteryCapacityKwh += totalHubBatteryKwh;
    totalBatteryRunwayHoursSum += batteryRunwayHours;

    const fuelLiters = Math.max(0, Number(h.generatorFuelLiters) || 0);
    const fuelCap = Math.max(1, Number(h.generatorCapacityLiters) || 20);
    const burnRate = Math.max(0.1, Number(h.generatorFuelBurnRate) || 1.0);
    const genRunwayHours = Number((fuelLiters / burnRate).toFixed(1));
    const fuelReservePct = Math.min(100, Math.round((fuelLiters / fuelCap) * 100));
    const hourlyCost = Math.round(burnRate * fuelCostPerLiter);

    totalFuelReservesLiters += fuelLiters;
    totalFuelCapacityLiters += fuelCap;
    totalGeneratorBurnRateSum += burnRate;
    totalHourlyFuelCostPkr += hourlyCost;

    const totalOutageRunwayHours = Number((batteryRunwayHours + genRunwayHours).toFixed(1));

    const isOutage = h.powerSource !== 'Mains (LESCO)';
    if (isOutage) activeOutagesCount++;

    let statusTier = 'Normal / Grid Stable';
    let statusBadgeClass = 'badge-expansion';

    if (batteryPct < 35 || fuelLiters <= 5) {
      statusTier = 'Critical Discharge';
      statusBadgeClass = 'badge-contraction';
      criticalHubsCount++;
    } else if (isOutage || batteryPct < 70) {
      statusTier = 'Active Backup / Advisory';
      statusBadgeClass = 'badge-stable';
    }

    return {
      ...h,
      batteryCapacityAh: batteryCapAh,
      batteryLevelPercent: batteryPct,
      batteryVoltage: volt,
      inverterLoadWatts: invWatts,
      batteryEnergyWh: Math.round(usableWh),
      totalHubBatteryKwh,
      batteryRunwayHours,
      generatorFuelLiters: fuelLiters,
      generatorCapacityLiters: fuelCap,
      generatorFuelBurnRate: burnRate,
      generatorRunwayHours: genRunwayHours,
      fuelReservePercent: fuelReservePct,
      hourlyFuelCostPkr: hourlyCost,
      totalOutageRunwayHours,
      statusTier,
      statusBadgeClass
    };
  });

  const totalHubsMonitored = hubs.length;
  const overallFuelPercent = totalFuelCapacityLiters > 0
    ? Math.round((totalFuelReservesLiters / totalFuelCapacityLiters) * 100)
    : 0;

  const avgBatteryRunwayHours = totalHubsMonitored > 0
    ? Number((totalBatteryRunwayHoursSum / totalHubsMonitored).toFixed(1))
    : 0;

  const totalGeneratorRunwayHours = totalGeneratorBurnRateSum > 0
    ? Number((totalFuelReservesLiters / totalGeneratorBurnRateSum).toFixed(1))
    : 0;

  const combinedFleetRunwayHours = Number((avgBatteryRunwayHours + totalGeneratorRunwayHours).toFixed(1));

  let gridResilienceStatus = 'Grid Resilient (100% Mains)';
  let gridResilienceBadgeClass = 'badge-expansion';

  if (criticalHubsCount > 0) {
    gridResilienceStatus = 'Critical Power Disruption';
    gridResilienceBadgeClass = 'badge-contraction';
  } else if (activeOutagesCount > 0) {
    gridResilienceStatus = 'Load Shedding Active';
    gridResilienceBadgeClass = 'badge-stable';
  }

  return {
    totalHubsMonitored,
    totalActiveSubscribers,
    totalSubscribersProtected,
    totalFuelReservesLiters,
    totalFuelCapacityLiters,
    overallFuelPercent,
    totalBatteryCapacityKwh: Number(totalBatteryCapacityKwh.toFixed(1)),
    avgBatteryRunwayHours,
    totalGeneratorRunwayHours,
    combinedFleetRunwayHours,
    totalHourlyFuelCostPkr,
    activeOutagesCount,
    criticalHubsCount,
    gridResilienceStatus,
    gridResilienceBadgeClass,
    fuelCostPerLiter,
    hubs
  };
}

/**
 * Generates plain-text briefing on POP battery health, generator runtime, and outage resilience.
 */
export function generatePowerBriefingReport(metrics, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);

  const lines = [
    '================================================================',
    'SHAHDARA ISP - POWER OUTAGE & OLT BATTERY HEALTH BRIEFING',
    '================================================================',
    `Date: ${dateStr} | Central NOC: Shahdara Core Hub (Vandala Rd)`,
    `Grid Utility: LESCO (Lahore Electric Supply) | Telecom Standard: -48V DC`,
    '',
    `Fleet Telecom Battery Capacity: ${metrics.totalBatteryCapacityKwh} kWh (Avg Runway: ${metrics.avgBatteryRunwayHours} hrs)`,
    `Diesel / Petrol Fuel Reserves: ${metrics.totalFuelReservesLiters} Liters (${metrics.overallFuelPercent}% Capacity | Runway: ${metrics.totalGeneratorRunwayHours} hrs)`,
    `Combined Outage Runway: ${metrics.combinedFleetRunwayHours} Hours`,
    `Fleet Power Grid Status: ${metrics.gridResilienceStatus}`,
    `Active Load Shedding Incidents: ${metrics.activeOutagesCount} / ${metrics.totalHubsMonitored} Hubs`,
    '',
    '----------------------------------------------------------------',
    'POP TELEMETRY & RUNWAY AUDIT:',
    '----------------------------------------------------------------'
  ];

  if (!metrics.hubs || metrics.hubs.length === 0) {
    lines.push('No distribution hubs configured.');
  } else {
    for (const h of metrics.hubs) {
      lines.push(
        `• ${h.name} [${h.powerSource}]: ` +
        `Batt: ${h.batteryVoltage}V (${h.batteryLevelPercent}%) ~${h.batteryRunwayHours}h | ` +
        `Fuel: ${h.generatorFuelLiters}L (${h.generatorModel}) ~${h.generatorRunwayHours}h | ` +
        `Total: ${h.totalOutageRunwayHours}h | ${h.statusTier} (${h.activeSubscribers} active subs)`
      );
    }
  }

  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('EMERGENCY FUEL CONSUMPTION ESTIMATE:');
  lines.push('----------------------------------------------------------------');
  const avgBurn = metrics.totalGeneratorRunwayHours > 0
    ? (metrics.totalFuelReservesLiters / metrics.totalGeneratorRunwayHours).toFixed(1)
    : '0.0';
  lines.push(`Fleet Fuel Burn Rate: ~${avgBurn} L/hr | Hourly Operating Cost: ${formatPKR(metrics.totalHourlyFuelCostPkr)}/hr`);
  lines.push('Recommendation: Keep at least 20L diesel buffer at Central NOC during peak load-shedding seasons.');
  lines.push('================================================================');

  return lines.join('\n');
}

/**
 * Sets up the Power Backup & OLT Battery Health modal dialog and clipboard reporting.
 */
export function setupPowerBackupModal(state, { referenceDate = new Date(), onFilterArea, onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardPowerModal');
  const openBtn = document.getElementById('dashboardOpenPowerModalBtn');
  const closeBtn = document.getElementById('dashboardPowerModalCloseBtn');
  const tableBody = document.getElementById('powerHubsTableBody');
  const copyBtn = document.getElementById('dashboardCopyPowerReportBtn');

  const energyEl = document.getElementById('powerTotalEnergyVal');
  const battRunwayEl = document.getElementById('powerTotalRunwayVal');
  const fuelReservesEl = document.getElementById('powerFuelReservesVal');
  const fuelRunwayEl = document.getElementById('powerFuelRunwayVal');
  const combinedRunwayEl = document.getElementById('powerCombinedRunwayVal');
  const statusBadgeEl = document.getElementById('powerStatusBadge');
  const outagesCountEl = document.getElementById('powerOutagesCountVal');

  if (!modal) return;

  function populateAndOpen() {
    const data = calculatePowerBackupMetrics(state, { referenceDate });

    if (energyEl) energyEl.textContent = `${data.totalBatteryCapacityKwh} kWh`;
    if (battRunwayEl) battRunwayEl.textContent = `Avg ${data.avgBatteryRunwayHours} hrs battery runway`;
    if (fuelReservesEl) fuelReservesEl.textContent = `${data.totalFuelReservesLiters} Liters`;
    if (fuelRunwayEl) fuelRunwayEl.textContent = `${data.totalGeneratorRunwayHours} hrs genset runtime`;
    if (combinedRunwayEl) combinedRunwayEl.textContent = `${data.combinedFleetRunwayHours} Hours`;

    if (statusBadgeEl) {
      statusBadgeEl.textContent = data.gridResilienceStatus;
      statusBadgeEl.className = `sim-delta-badge ${data.gridResilienceBadgeClass}`;
    }

    if (outagesCountEl) {
      outagesCountEl.textContent = `${data.activeOutagesCount} active outages (${data.criticalHubsCount} critical)`;
    }

    if (tableBody) {
      if (!data.hubs || data.hubs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">No distribution hubs monitored</td></tr>';
      } else {
        tableBody.innerHTML = data.hubs.map(h => {
          const powerBadgeClass = h.powerSource.includes('Mains')
            ? 'badge-expansion'
            : (h.powerSource.includes('Battery') ? 'badge-stable' : 'badge-contraction');

          const primaryAreaName = h.primaryAreas[0] || '';

          return `
            <tr>
              <td>
                <strong>${escapeXml(h.name)}</strong>
                <div class="text-muted" style="font-size: 11px;">${escapeXml(h.role)}</div>
              </td>
              <td>
                <div>${h.activeSubscribers} <span class="text-muted">active</span> (${h.totalSubscribers} total)</div>
                <div class="text-muted" style="font-size: 11px;">${escapeXml(h.primaryAreas.join(', '))}</div>
              </td>
              <td>
                <span class="sim-delta-badge ${powerBadgeClass}" style="font-size: 11px;">
                  ${escapeXml(h.powerSource)}
                </span>
              </td>
              <td>
                <div><strong>${h.batteryLevelPercent}%</strong> (${h.batteryVoltage}V)</div>
                <div class="text-muted" style="font-size: 11px;">~${h.batteryRunwayHours}h (${h.batteryCapacityAh}Ah · ${h.inverterLoadWatts}W)</div>
              </td>
              <td>
                <div><strong>${h.generatorFuelLiters} L</strong> (${h.fuelReservePercent}%)</div>
                <div class="text-muted" style="font-size: 11px;">~${h.generatorRunwayHours}h (${escapeXml(h.generatorModel)})</div>
              </td>
              <td>
                <div>${formatPKR(h.hourlyFuelCostPkr)}/hr</div>
                <div class="text-muted" style="font-size: 11px;">@ ${h.generatorFuelBurnRate} L/h</div>
              </td>
              <td>
                <span class="sim-delta-badge ${h.statusBadgeClass}" style="font-size: 11px;">
                  ${escapeXml(h.statusTier)}
                </span>
              </td>
              <td>
                <button class="small-action-btn" type="button" data-power-filter-area="${escapeXml(primaryAreaName)}">Area Subs</button>
              </td>
            </tr>
          `;
        }).join('');

        const areaBtns = tableBody.querySelectorAll('[data-power-filter-area]');
        areaBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const area = btn.getAttribute('data-power-filter-area');
            if (typeof onFilterArea === 'function' && area) {
              onFilterArea(area);
              if (modal.close) modal.close();
              else modal.removeAttribute('open');
            } else if (typeof onFilterCustomer === 'function') {
              onFilterCustomer(area);
              if (modal.close) modal.close();
              else modal.removeAttribute('open');
            }
          });
        });
      }
    }

    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
  }

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const data = calculatePowerBackupMetrics(state, { referenceDate });
      const text = generatePowerBriefingReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Power backup audit briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }
}

/**
 * Calculates field collection route density, stop clustering yield, and collector crew pacing.
 */
export function calculateRouteDensityMetrics(state, options = {}) {
  const referenceDate = options.referenceDate instanceof Date && !isNaN(options.referenceDate)
    ? options.referenceDate
    : new Date(options.referenceDate || Date.now());

  const allocations = state ? calculatePaymentAllocations(state) : { forMonth: () => null };
  const customers = Array.isArray(state?.customers) ? state.customers.filter(c => !c.archived) : [];

  const areaMap = new Map();

  let totalDelinquentAccounts = 0;
  let totalUncollectedDues = 0;

  for (const c of customers) {
    let customerDueCents = 0;
    let oldestUnpaidBill = null;

    for (const bill of (c.bills ?? [])) {
      const alloc = allocations.forMonth?.(c.id, bill.month);
      const balanceDueCents = alloc?.balanceDueCents ?? Math.round(Number(bill.dueAmount || bill.amount || 0) * 100);
      if (balanceDueCents > 0) {
        customerDueCents += balanceDueCents;
        if (!oldestUnpaidBill) oldestUnpaidBill = bill;
      }
    }

    const totalOverdue = Math.round(customerDueCents / 100);
    if (totalOverdue <= 0) continue;

    totalDelinquentAccounts++;
    totalUncollectedDues += totalOverdue;

    const areaName = String(c.area || 'Unassigned').trim();
    if (!areaMap.has(areaName)) {
      areaMap.set(areaName, {
        areaName,
        overdueCount: 0,
        totalOverdueAmount: 0,
        subscribers: []
      });
    }

    const item = areaMap.get(areaName);
    item.overdueCount++;
    item.totalOverdueAmount += totalOverdue;
    item.subscribers.push({
      id: c.id,
      name: c.name || 'Unnamed',
      phone: c.phone || '',
      area: areaName,
      package: c.packageSpeed || 'Unassigned',
      balanceDue: totalOverdue,
      oldestMonth: oldestUnpaidBill?.month || '',
      serviceStatus: c.serviceStatus || 'not-set'
    });
  }

  let totalRecommendedCollectors = 0;

  const areas = Array.from(areaMap.values()).map(a => {
    const avgTicket = a.overdueCount > 0 ? Math.round(a.totalOverdueAmount / a.overdueCount) : 0;

    let densityRating = 'Moderate Route';
    let travelDifficulty = 1.4;
    if (a.overdueCount >= 8) {
      densityRating = 'Dense Cluster';
      travelDifficulty = 1.0;
    } else if (a.overdueCount <= 3) {
      densityRating = 'Dispersed / Remote';
      travelDifficulty = 2.0;
    }

    // Route yield efficiency score = (Dues / 1000) * (Stops / travelDifficulty)
    const routeEfficiencyScore = Math.round((a.totalOverdueAmount / 1000) * (a.overdueCount / travelDifficulty));

    let priorityTier = 'Standard Field Route';
    let priorityBadgeClass = 'badge-stable';
    if (routeEfficiencyScore >= 50 || a.totalOverdueAmount >= 15000) {
      priorityTier = 'High Yield Hotspot';
      priorityBadgeClass = 'badge-expansion';
    } else if (routeEfficiencyScore >= 20 || a.overdueCount >= 8) {
      priorityTier = 'Quick Win Cluster';
      priorityBadgeClass = 'badge-expansion';
    } else if (a.overdueCount <= 2 && a.totalOverdueAmount < 3000) {
      priorityTier = 'Low Priority Dispersed';
      priorityBadgeClass = 'badge-contraction';
    }

    const collectors = a.overdueCount >= 15 ? 2 : (a.overdueCount > 0 ? 1 : 0);
    totalRecommendedCollectors += collectors;

    const dailyStops = collectors * 15;
    const estimatedRouteDays = dailyStops > 0 ? Number((a.overdueCount / dailyStops).toFixed(1)) : 0;

    a.subscribers.sort((x, y) => y.balanceDue - x.balanceDue);

    return {
      areaName: a.areaName,
      overdueCount: a.overdueCount,
      totalOverdueAmount: a.totalOverdueAmount,
      avgTicketPerStop: avgTicket,
      densityRating,
      travelDifficulty,
      routeEfficiencyScore,
      priorityTier,
      priorityBadgeClass,
      recommendedCollectors: collectors,
      dailyStopsTarget: dailyStops,
      estimatedRouteDays,
      subscribers: a.subscribers
    };
  });

  // Sort areas descending by route efficiency score, then total overdue amount
  areas.sort((a, b) => b.routeEfficiencyScore - a.routeEfficiencyScore || b.totalOverdueAmount - a.totalOverdueAmount);

  const totalAreasTargeted = areas.length;
  const avgFleetStopYieldPkr = totalDelinquentAccounts > 0
    ? Math.round(totalUncollectedDues / totalDelinquentAccounts)
    : 0;

  const dailyFleetRecoveryTargetPkr = Math.round(totalUncollectedDues / 20); // 20 working day recovery cycle

  let fleetRoutingStatus = 'Optimal Route Density';
  let fleetRoutingBadgeClass = 'badge-expansion';
  if (totalDelinquentAccounts === 0) {
    fleetRoutingStatus = 'Zero Overdue Stops (Roster Clean)';
    fleetRoutingBadgeClass = 'badge-expansion';
  } else if (areas.some(a => a.priorityTier === 'High Yield Hotspot')) {
    fleetRoutingStatus = 'Urgent High-Yield Dispatch Needed';
    fleetRoutingBadgeClass = 'badge-contraction';
  } else if (areas.length > 5) {
    fleetRoutingStatus = 'Active Multi-Sector Recovery';
    fleetRoutingBadgeClass = 'badge-stable';
  }

  return {
    totalDelinquentAccounts,
    totalUncollectedDues,
    totalAreasTargeted,
    avgFleetStopYieldPkr,
    totalRecommendedCollectors,
    dailyFleetRecoveryTargetPkr,
    fleetRoutingStatus,
    fleetRoutingBadgeClass,
    areas
  };
}

/**
 * Generates plain-text route density and collector dispatch briefing report.
 */
export function generateRouteDensityReport(metrics, referenceDate = new Date()) {
  const ref = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);

  const lines = [
    '================================================================',
    'SHAHDARA ISP - FIELD ROUTE DENSITY & COLLECTOR PACING AUDIT',
    '================================================================',
    `Date: ${dateStr} | Logistics: Door-to-Door Dues Recovery Dispatch`,
    '',
    `Total Delinquent Stops: ${metrics.totalDelinquentAccounts} Accounts across ${metrics.totalAreasTargeted} Sectors`,
    `Total Uncollected Target: ${formatPKR(metrics.totalUncollectedDues)} (Avg Stop Yield: ${formatPKR(metrics.avgFleetStopYieldPkr)})`,
    `Recommended Field Fleet: ${metrics.totalRecommendedCollectors} Collectors (Daily Fleet Target: ${formatPKR(metrics.dailyFleetRecoveryTargetPkr)})`,
    `Fleet Dispatch Status: ${metrics.fleetRoutingStatus}`,
    '',
    '----------------------------------------------------------------',
    'SECTOR ROUTE PACING MATRIX:',
    '----------------------------------------------------------------'
  ];

  if (!metrics.areas || metrics.areas.length === 0) {
    lines.push('No delinquent collection stops recorded.');
  } else {
    for (const a of metrics.areas) {
      lines.push(
        `• ${a.areaName}: ${a.overdueCount} stops | ${formatPKR(a.totalOverdueAmount)} (~${formatPKR(a.avgTicketPerStop)}/stop) | ` +
        `${a.densityRating} · ${a.priorityTier} [Fleet: ${a.recommendedCollectors} crew ~${a.estimatedRouteDays} days]`
      );
    }
  }

  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('COLLECTOR DISPATCH ADVISORY:');
  lines.push('----------------------------------------------------------------');
  lines.push('Route Sequence: Prioritize High Yield Hotspots in morning (09:00 - 13:00) before customer shop openings.');
  lines.push('Standard Pacing: 15 verified household visits per field collector per workday.');
  lines.push('================================================================');

  return lines.join('\n');
}

/**
 * Sets up the Area Collection Route Density modal dialog and clipboard reporting.
 */
export function setupRouteDensityModal(state, { referenceDate = new Date(), onFilterArea, onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardRouteDensityModal');
  const openBtn = document.getElementById('dashboardOpenRouteDensityModalBtn');
  const closeBtn = document.getElementById('dashboardRouteDensityModalCloseBtn');
  const tableBody = document.getElementById('routeDensityTableBody');
  const copyBtn = document.getElementById('dashboardCopyRouteDensityReportBtn');

  const stopsEl = document.getElementById('routeDensityTotalStopsVal');
  const duesEl = document.getElementById('routeDensityTotalDuesVal');
  const crewEl = document.getElementById('routeDensityFleetCrewVal');
  const statusBadgeEl = document.getElementById('routeDensityStatusBadge');
  const dailyTargetEl = document.getElementById('routeDensityDailyTargetVal');

  if (!modal) return;

  function populateAndOpen() {
    const data = calculateRouteDensityMetrics(state, { referenceDate });

    if (stopsEl) stopsEl.textContent = `${data.totalDelinquentAccounts} Stops`;
    if (duesEl) duesEl.textContent = formatPKR(data.totalUncollectedDues);
    if (crewEl) crewEl.textContent = `${data.totalRecommendedCollectors} Collectors`;
    if (dailyTargetEl) dailyTargetEl.textContent = `${formatPKR(data.dailyFleetRecoveryTargetPkr)} / day target`;

    if (statusBadgeEl) {
      statusBadgeEl.textContent = data.fleetRoutingStatus;
      statusBadgeEl.className = `sim-delta-badge ${data.fleetRoutingBadgeClass}`;
    }

    if (tableBody) {
      if (!data.areas || data.areas.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">No uncollected field stops pending</td></tr>';
      } else {
        tableBody.innerHTML = data.areas.map(a => `
          <tr>
            <td>
              <strong>${escapeXml(a.areaName)}</strong>
              <div class="text-muted" style="font-size: 11px;">Yield Score: ${a.routeEfficiencyScore}</div>
            </td>
            <td><strong>${a.overdueCount}</strong> stops</td>
            <td><strong>${formatPKR(a.totalOverdueAmount)}</strong></td>
            <td>${formatPKR(a.avgTicketPerStop)}</td>
            <td>
              <span class="signal-tag">${escapeXml(a.densityRating)}</span>
            </td>
            <td>
              <span class="sim-delta-badge ${a.priorityBadgeClass}" style="font-size: 11px;">
                ${escapeXml(a.priorityTier)}
              </span>
            </td>
            <td>
              <div>${a.recommendedCollectors} Crew (~${a.estimatedRouteDays}d)</div>
            </td>
            <td>
              <button class="small-action-btn" type="button" data-route-filter-area="${escapeXml(a.areaName)}">Dispatch Area</button>
            </td>
          </tr>
        `).join('');

        const areaBtns = tableBody.querySelectorAll('[data-route-filter-area]');
        areaBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const area = btn.getAttribute('data-route-filter-area');
            if (typeof onFilterArea === 'function' && area) {
              onFilterArea(area);
              if (modal.close) modal.close();
              else modal.removeAttribute('open');
            } else if (typeof onFilterCustomer === 'function') {
              onFilterCustomer(area);
              if (modal.close) modal.close();
              else modal.removeAttribute('open');
            }
          });
        });
      }
    }

    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
  }

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const data = calculateRouteDensityMetrics(state, { referenceDate });
      const text = generateRouteDensityReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Route density briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
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
  calculateSeasonalCashflowComparison,
  renderSeasonalCashflowSvg,
  calculatePackageMarginBreakdown,
  simulateMarginAdjustment,
  renderPackageMarginSvg,
  generateMarginSimulationReportText,
  setupMarginSimulatorModal,
  renderCustomerLtvCohortsSvg,
  renderIncidentImpactSvg,
  renderCashflowProjectionSvg,
  renderUpstreamGatewaySvg,
  renderAcquisitionRoiSvg,
  renderBandwidthShapingSvg,
  renderFiberDistributionSvg,
  renderDelinquencyPipelineSvg,
  renderCpeAssetLifecycleSvg,
  renderPowerBackupSvg,
  renderRouteDensityMatrixSvg,
  setProjectionScenario,
  getProjectionScenario,
  setLtvMetric,
  getLtvMetric,
  setSeasonalMetric,
  getSeasonalMetric,
  setMarginSimulatorCostPerMbps,
  getMarginSimulatorCostPerMbps,
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

export {
  SHAHDARA_FIBER_ROUTES,
  calculateOtdrFaultMetrics,
  generateOtdrReport,
  setupOtdrModal,
  getOtdrSelectedRoute,
  setOtdrSelectedRoute,
  getOtdrWavelength,
  setOtdrWavelength,
  getOtdrSimulatedDistance,
  setOtdrSimulatedDistance,
  renderOtdrTraceSvg
} from './dashboard-otdr.js';




