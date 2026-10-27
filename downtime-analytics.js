/**
 * downtime-analytics.js — SISP-16: Customer-Wise and Network-Wide Downtime
 * Hours Analytics.
 *
 * Problem: SISP-15 records every complaint, but nobody could answer "how
 * many hours was THIS customer down this month?" or "how many hours did
 * the whole network lose to fiber cuts this month?". This module answers
 * both from the same register — it builds ON SISP-15 storage
 * (sisp_complaints_ledger_v1 via complaint-register.js) and invents no
 * storage of its own.
 *
 * Month rule (mirrors filterComplaints): a complaint belongs to the month
 * of its reportedAt (YYYY-MM). Unresolved complaints count as complaints
 * but contribute 0 downtime hours (no resolved endpoint yet). AREA_OUTAGE
 * zone-wide faults count toward the network breakdown and the totals, but
 * never toward any single customer.
 *
 * Primary issue tag: the customer's most common category in the month.
 * Ties break by COMPLAINT_CATEGORIES order (deterministic, spec order),
 * so "1 Fiber Cut + 1 Charger Off" tags as Fiber Cut.
 *
 * All helpers are pure except loadComplaints calls inside the modal
 * controller and the dashboard/profile render helpers. Tests use synthetic
 * data only.
 */

import {
  AREA_OUTAGE_CUSTOMER_ID,
  COMPLAINT_CATEGORIES,
  formatDowntimeHours,
  loadComplaints,
  pakistanMonthNow
} from './complaint-register.js';

const MONTH_RE = /^\d{4}-\d{2}$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function round2(value) {
  return Math.round(value * 100) / 100;
}

/** Downtime a complaint contributes: finite non-negative hours, else 0. */
function downtimeOf(complaint) {
  const n = Number(complaint?.downtimeHours);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function monthOf(complaint) {
  return String(complaint?.reportedAt || '').slice(0, 7);
}

function isAreaOutage(complaint) {
  return complaint?.customerId === AREA_OUTAGE_CUSTOMER_ID;
}

/**
 * Most common category from a { category: count } map. Ties break by
 * COMPLAINT_CATEGORIES order. Returns '' when the map is empty.
 */
export function primaryIssueTag(categoryCounts) {
  let best = '';
  let bestCount = 0;
  for (const category of COMPLAINT_CATEGORIES) {
    const count = Number(categoryCounts?.[category]) || 0;
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

function emptyCauseRows() {
  return COMPLAINT_CATEGORIES.map((category) => ({ category, incidents: 0, totalDowntime: 0 }));
}

function sortCauseRows(rows) {
  const order = new Map(COMPLAINT_CATEGORIES.map((c, i) => [c, i]));
  return [...rows].sort((a, b) =>
    (b.totalDowntime - a.totalDowntime) ||
    (b.incidents - a.incidents) ||
    ((order.get(a.category) ?? 99) - (order.get(b.category) ?? 99)));
}

/**
 * Whole-month analytics for every customer + the network breakdown.
 * month must be YYYY-MM; anything else yields a zeroed result for ''.
 */
export function buildMonthlyDowntimeAnalytics(list, month) {
  const validMonth = MONTH_RE.test(String(month || '')) ? String(month) : '';
  const rows = (Array.isArray(list) ? list : []).filter((c) => c && typeof c === 'object' && validMonth && monthOf(c) === validMonth);
  const causeMap = new Map(COMPLAINT_CATEGORIES.map((c) => [c, { category: c, incidents: 0, totalDowntime: 0 }]));
  const customerMap = new Map();
  let areaOutageComplaints = 0;
  let areaOutageDowntime = 0;

  for (const complaint of rows) {
    const category = COMPLAINT_CATEGORIES.includes(complaint.issueCategory) ? complaint.issueCategory : 'Other';
    const hours = downtimeOf(complaint);
    const cause = causeMap.get(category);
    cause.incidents += 1;
    cause.totalDowntime = round2(cause.totalDowntime + hours);
    if (isAreaOutage(complaint)) {
      areaOutageComplaints += 1;
      areaOutageDowntime = round2(areaOutageDowntime + hours);
      continue;
    }
    const key = complaint.customerId !== null && complaint.customerId !== undefined && String(complaint.customerId) !== ''
      ? `id:${complaint.customerId}`
      : `name:${complaint.customerName || 'Unknown customer'}`;
    let entry = customerMap.get(key);
    if (!entry) {
      entry = {
        customerId: complaint.customerId ?? null,
        customerName: cleanText(complaint.customerName) || 'Unknown customer',
        complaintCount: 0,
        totalDowntime: 0,
        categoryCounts: {}
      };
      customerMap.set(key, entry);
    }
    entry.complaintCount += 1;
    entry.totalDowntime = round2(entry.totalDowntime + hours);
    entry.categoryCounts[category] = (entry.categoryCounts[category] || 0) + 1;
  }

  const perCustomer = [...customerMap.values()].map((entry) => ({
    customerId: entry.customerId,
    customerName: entry.customerName,
    complaintCount: entry.complaintCount,
    totalDowntime: entry.totalDowntime,
    primaryIssueTag: primaryIssueTag(entry.categoryCounts),
    categoryCounts: entry.categoryCounts
  })).sort((a, b) =>
    (b.totalDowntime - a.totalDowntime) ||
    (b.complaintCount - a.complaintCount) ||
    String(a.customerName).localeCompare(String(b.customerName)));

  const totalDowntime = round2(rows.reduce((sum, c) => sum + downtimeOf(c), 0));
  return {
    month: validMonth,
    totalComplaints: rows.length,
    totalDowntime,
    areaOutageComplaints,
    areaOutageDowntime,
    perCustomer,
    byCause: sortCauseRows([...causeMap.values()])
  };
}

/**
 * One customer's downtime summary. month '' means all months (all-time).
 * Returns zeros + '' tag when the customer has no complaints in scope.
 */
export function buildCustomerDowntimeSummary(list, customerId, month = '') {
  const validMonth = month === '' ? '' : (MONTH_RE.test(String(month)) ? String(month) : null);
  if (validMonth === null) {
    return { customerId: customerId ?? null, customerName: '', complaintCount: 0, totalDowntime: 0, primaryIssueTag: '', byCause: emptyCauseRows() };
  }
  const rows = (Array.isArray(list) ? list : []).filter((c) => {
    if (!c || typeof c !== 'object' || isAreaOutage(c)) return false;
    if (String(c.customerId) !== String(customerId)) return false;
    if (validMonth && monthOf(c) !== validMonth) return false;
    return true;
  });
  const categoryCounts = {};
  let totalDowntime = 0;
  let customerName = '';
  for (const complaint of rows) {
    const category = COMPLAINT_CATEGORIES.includes(complaint.issueCategory) ? complaint.issueCategory : 'Other';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    totalDowntime = round2(totalDowntime + downtimeOf(complaint));
    if (!customerName) customerName = cleanText(complaint.customerName);
  }
  const causeMap = new Map(COMPLAINT_CATEGORIES.map((c) => [c, { category: c, incidents: 0, totalDowntime: 0 }]));
  for (const complaint of rows) {
    const category = COMPLAINT_CATEGORIES.includes(complaint.issueCategory) ? complaint.issueCategory : 'Other';
    const cause = causeMap.get(category);
    cause.incidents += 1;
    cause.totalDowntime = round2(cause.totalDowntime + downtimeOf(complaint));
  }
  return {
    customerId: customerId ?? null,
    customerName,
    complaintCount: rows.length,
    totalDowntime,
    primaryIssueTag: primaryIssueTag(categoryCounts),
    byCause: sortCauseRows([...causeMap.values()])
  };
}

/**
 * Wires the downtime analytics modal (dialog in index.html). Reads the
 * register fresh on every render so complaint changes show immediately.
 */
export function setupDowntimeAnalyticsModal(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('downtimeAnalyticsModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let month = pakistanMonthNow();

  function render() {
    const analytics = buildMonthlyDowntimeAnalytics(loadComplaints(), month);
    const summaryEl = $('downtimeAnalyticsSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = analytics.totalComplaints === 0
        ? `No complaints reported in ${month || 'this month'}.`
        : `${analytics.totalComplaints} complaint${analytics.totalComplaints === 1 ? '' : 's'} · ${analytics.totalDowntime} h total downtime · ${analytics.areaOutageComplaints} zone-wide fault${analytics.areaOutageComplaints === 1 ? '' : 's'} (${analytics.areaOutageDowntime} h)`;
    }
    const causeEl = $('downtimeAnalyticsCauseList');
    if (causeEl) {
      causeEl.innerHTML = analytics.byCause.map((row) => `
        <article class="downtime-cause-card">
          <p><span>Issue</span><strong>${escapeHtml(row.category)}</strong></p>
          <p><span>Incidents</span><strong>${escapeHtml(String(row.incidents))}</strong></p>
          <p><span>Offline hours</span><strong>${escapeHtml(String(row.totalDowntime))} h</strong></p>
        </article>`).join('');
    }
    const customerEl = $('downtimeAnalyticsCustomerList');
    if (customerEl) {
      if (analytics.perCustomer.length === 0) {
        customerEl.innerHTML = '<p class="downtime-analytics-empty">No customer complaints in this month.</p>';
      } else {
        customerEl.innerHTML = analytics.perCustomer.map((entry) => `
          <article class="downtime-customer-card">
            <p><span>Customer</span><strong>${escapeHtml(entry.customerName)}</strong></p>
            <p><span>Complaints</span><strong>${escapeHtml(String(entry.complaintCount))}</strong></p>
            <p><span>Total offline</span><strong>${escapeHtml(String(entry.totalDowntime))} h</strong></p>
            <p><span>Main issue</span><strong>${escapeHtml(entry.primaryIssueTag || 'Not set')}</strong></p>
          </article>`).join('');
      }
    }
  }

  const monthInput = $('downtimeAnalyticsMonth');
  if (monthInput) {
    monthInput.value = month;
    monthInput.addEventListener('change', () => {
      month = monthInput.value || pakistanMonthNow();
      render();
    });
  }
  const closeBtn = $('downtimeAnalyticsCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openDowntimeAnalyticsModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    month = pakistanMonthNow();
    if (monthInput) monthInput.value = month;
    render();
    dialog.showModal();
  });

  return {
    open(prefilter = {}) {
      if (MONTH_RE.test(String(prefilter.month || ''))) month = String(prefilter.month);
      if (monthInput) monthInput.value = month;
      render();
      dialog.showModal();
    },
    refresh: render
  };
}
