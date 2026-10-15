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



