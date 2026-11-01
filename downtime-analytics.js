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
  computeDowntimeHours,
  formatDowntimeHours,
  loadComplaints,
  pakistanMonthNow
} from './complaint-register.js';
import { loadTickets } from './complaint-tickets.js';
import { traceDownstreamImpact } from './outage-impact.js';

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
 * SISP-139: Power Outage & Charger-Off Downtime Correlation Report.
 *
 * Answers two questions SISP-16 could not: (1) what share of the month's
 * closed-incident downtime was upstream power/adapter trouble vs. fiber
 * plant damage, and (2) which upstream "root houses" (customers whose
 * recorded feeder position feeds other houses — SISP-7 topology) caused
 * the most downstream outage when they went down.
 *
 * Incident set: CLOSED (Resolved) records from BOTH real stores — the
 * SISP-15 register and the SISP-12 tickets — for the selected month
 * (complaint month = reportedAt month, ticket month = createdAt month,
 * the SISP-16 month rule). A ticket linked to a complaint
 * (ticket.complaintId) whose complaint is itself in the closed set is
 * the SISP-44 synced pair and counts ONCE, through the complaint record
 * (the register owns the category + downtime). A linked ticket whose
 * complaint is not closed/in-month counts on its own — the field work
 * did close, so the incident is real.
 *
 * Durations follow SISP-16 exactly: a complaint's duration is its stored
 * downtimeHours (the register's resolvedAt − reportedAt figure, manual
 * overrides honoured); when that field is absent the same
 * computeDowntimeHours(reportedAt, resolvedAt) derivation is applied; a
 * ticket's duration is computeDowntimeHours(createdAt, resolvedAt).
 * An incident with no valid duration is excluded from every minute
 * figure and counted in unmeasurableIncidents — never given invented
 * minutes. AREA_OUTAGE zone faults DO enter the cause shares (their
 * recorded category is real network downtime, exactly as SISP-16 counts
 * them in the network breakdown) but can never anchor a root house.
 */

/** Stated root-cause mapping over the real COMPLAINT_CATEGORIES values. */
export const ROOT_CAUSE_CATEGORY_BUCKETS = Object.freeze({
  'WAPDA / Power Outage': 'power',
  'Media Converter / Charger Off': 'power',
  'Fiber Cut': 'fiber',
  'Fiber Splice Loss': 'fiber'
});

/** Stated root-cause mapping over the real ticket fault presets. */
export const ROOT_CAUSE_PRESET_BUCKETS = Object.freeze({
  'Media Converter Power/Charger': 'power',
  'Fiber Cut / Splice Loss': 'fiber'
});

export const ROOT_CAUSE_BUCKET_LABELS = Object.freeze({
  power: 'Power / adapter (upstream)',
  fiber: 'Fiber cuts & splice loss',
  other: 'Other causes'
});

function rootBucketForCategory(category) {
  return ROOT_CAUSE_CATEGORY_BUCKETS[category] || 'other';
}

function rootBucketForTicket(ticket) {
  return ROOT_CAUSE_PRESET_BUCKETS[ticket?.faultPreset] || 'other';
}

/** Minutes for a closed complaint, or null when no valid duration exists. */
function complaintDurationMinutes(complaint) {
  // NB: an absent downtimeHours is null on the record — Number(null)
  // would coerce to 0, so absence is checked BEFORE coercion. A stored
  // 0 is a real recorded figure (resolved within the minute) and stays
  // measurable; only a missing figure falls through to derivation.
  const raw = complaint?.downtimeHours;
  const stored = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
  if (Number.isFinite(stored) && stored >= 0) return Math.round(stored * 60);
  const computed = computeDowntimeHours(complaint?.reportedAt, complaint?.resolvedAt);
  return computed === null ? null : Math.round(computed * 60);
}

/** Minutes for a closed ticket, or null when no valid duration exists. */
function ticketDurationMinutes(ticket) {
  const computed = computeDowntimeHours(ticket?.createdAt, ticket?.resolvedAt);
  return computed === null ? null : Math.round(computed * 60);
}

function sharePct(minutes, totalMinutes) {
  if (!totalMinutes) return null;
  return Math.round((minutes / totalMinutes) * 1000) / 10;
}

/**
 * Whole-month correlation report. Pure: reads nothing, writes nothing.
 * { complaints, tickets, customers } are the raw store arrays; month is
 * YYYY-MM (anything else yields a zeroed result, like SISP-16).
 */
export function buildPowerOutageCorrelation(sources = {}, month) {
  const validMonth = MONTH_RE.test(String(month || '')) ? String(month) : '';
  const complaints = Array.isArray(sources?.complaints) ? sources.complaints : [];
  const tickets = Array.isArray(sources?.tickets) ? sources.tickets : [];
  const customers = Array.isArray(sources?.customers) ? sources.customers : [];

  const closedComplaints = complaints.filter((c) =>
    c && typeof c === 'object' && c.status === 'Resolved' && validMonth && monthOf(c) === validMonth);
  const closedComplaintIds = new Set(closedComplaints.map((c) => String(c.id)));
  const standaloneTickets = tickets.filter((tk) =>
    tk && typeof tk === 'object' && tk.status === 'Resolved' && validMonth &&
    String(tk.createdAt || '').slice(0, 7) === validMonth &&
    !(tk.complaintId && closedComplaintIds.has(String(tk.complaintId))));

  const incidents = [
    ...closedComplaints.map((c) => ({
      customerId: c.customerId ?? null,
      customerName: cleanText(c.customerName),
      bucket: rootBucketForCategory(COMPLAINT_CATEGORIES.includes(c.issueCategory) ? c.issueCategory : 'Other'),
      minutes: complaintDurationMinutes(c),
      areaOutage: isAreaOutage(c)
    })),
    ...standaloneTickets.map((tk) => ({
      customerId: tk.customerId ?? null,
      customerName: cleanText(tk.customerName),
      bucket: rootBucketForTicket(tk),
      minutes: ticketDurationMinutes(tk),
      areaOutage: false
    }))
  ];

  const bucketTotals = {
    power: { minutes: 0, incidents: 0 },
    fiber: { minutes: 0, incidents: 0 },
    other: { minutes: 0, incidents: 0 }
  };
  let totalMinutes = 0;
  let measurableIncidents = 0;
  for (const incident of incidents) {
    if (incident.minutes === null) continue;
    measurableIncidents += 1;
    bucketTotals[incident.bucket].minutes += incident.minutes;
    bucketTotals[incident.bucket].incidents += 1;
    totalMinutes += incident.minutes;
  }

  // Root houses: impact = Σ (incident minutes × ACTIVE downstream count)
  // over the house's measurable closed incidents — "customer-minutes of
  // downstream outage caused". Downstream comes only from the recorded
  // SISP-7 topology (traceDownstreamImpact: archived traversed through,
  // never counted). Houses with no active downstream never rank.
  const customerById = new Map(customers.filter((c) => c && c.id !== null && c.id !== undefined).map((c) => [String(c.id), c]));
  const houseMap = new Map();
  for (const incident of incidents) {
    if (incident.areaOutage || incident.minutes === null) continue;
    const customerId = incident.customerId;
    if (customerId === null || customerId === undefined || String(customerId) === '') continue;
    const key = String(customerId);
    let entry = houseMap.get(key);
    if (!entry) {
      const downstreamCount = traceDownstreamImpact(customers, customerId).length;
      const record = customerById.get(key);
      entry = {
        customerId,
        customerName: cleanText(record?.name) || incident.customerName || 'Unknown customer',
        customerNumber: Number.isSafeInteger(record?.customerNumber) ? record.customerNumber : null,
        incidents: 0,
        downstreamCount,
        impactCustomerMinutes: 0
      };
      houseMap.set(key, entry);
    }
    entry.incidents += 1;
    entry.impactCustomerMinutes += incident.minutes * entry.downstreamCount;
  }
  const topRootHouses = [...houseMap.values()]
    .filter((entry) => entry.downstreamCount >= 1 && entry.impactCustomerMinutes > 0)
    .sort((a, b) =>
      (b.impactCustomerMinutes - a.impactCustomerMinutes) ||
      (b.incidents - a.incidents) ||
      ((a.customerNumber ?? Number.MAX_SAFE_INTEGER) - (b.customerNumber ?? Number.MAX_SAFE_INTEGER)) ||
      String(a.customerName).localeCompare(String(b.customerName)))
    .slice(0, 5);

  return {
    month: validMonth,
    closedIncidents: incidents.length,
    measurableIncidents,
    unmeasurableIncidents: incidents.length - measurableIncidents,
    totalMinutes,
    buckets: ['power', 'fiber', 'other'].map((key) => ({
      key,
      label: ROOT_CAUSE_BUCKET_LABELS[key],
      minutes: bucketTotals[key].minutes,
      incidents: bucketTotals[key].incidents,
      sharePct: sharePct(bucketTotals[key].minutes, totalMinutes)
    })),
    topRootHouses
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
    // SISP-139: power/fiber root-cause correlation + top root houses for
    // the same month, from the register + tickets + recorded topology.
    const correlation = buildPowerOutageCorrelation(
      { complaints: loadComplaints(), tickets: loadTickets(), customers: getState()?.customers ?? [] },
      month
    );
    const correlationEl = $('downtimeAnalyticsCorrelationList');
    if (correlationEl) {
      const rows = correlation.buckets.map((row) => `
        <article class="downtime-cause-card">
          <p><span>Cause</span><strong>${escapeHtml(row.label)}</strong></p>
          <p><span>Closed incidents</span><strong>${escapeHtml(String(row.incidents))}</strong></p>
          <p><span>Offline</span><strong>${escapeHtml(String(round2(row.minutes / 60)))} h</strong></p>
          <p><span>Share of downtime</span><strong>${row.sharePct === null ? '—' : `${escapeHtml(String(row.sharePct))}%`}</strong></p>
        </article>`).join('');
      const unmeasured = correlation.unmeasurableIncidents > 0
        ? `<p class="downtime-analytics-empty">${escapeHtml(String(correlation.unmeasurableIncidents))} closed incident${correlation.unmeasurableIncidents === 1 ? '' : 's'} without a measurable duration (not counted in the shares).</p>`
        : '';
      correlationEl.innerHTML = rows + unmeasured;
    }
    const rootHousesEl = $('downtimeAnalyticsRootHouses');
    if (rootHousesEl) {
      if (correlation.topRootHouses.length === 0) {
        rootHousesEl.innerHTML = '<p class="downtime-analytics-empty">No upstream root house caused downstream downtime this month.</p>';
      } else {
        rootHousesEl.innerHTML = correlation.topRootHouses.map((entry) => `
          <article class="downtime-customer-card">
            <p><span>Root house</span><strong>${escapeHtml(entry.customerName)}${entry.customerNumber !== null ? ` #${escapeHtml(String(entry.customerNumber))}` : ''}</strong></p>
            <p><span>Closed incidents</span><strong>${escapeHtml(String(entry.incidents))}</strong></p>
            <p><span>Houses fed downstream</span><strong>${escapeHtml(String(entry.downstreamCount))}</strong></p>
            <p><span>Downstream outage impact</span><strong>${escapeHtml(String(entry.impactCustomerMinutes))} customer-min</strong></p>
          </article>`).join('');
      }
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
