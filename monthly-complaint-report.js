// SISP-17: On-Demand Monthly Complaint and Outage Report Generator.
// Builds a 4-part executive report for one month from the SISP-15 complaint
// register, reusing the SISP-16 downtime analytics for network totals and
// per-cause breakdowns instead of recomputing them. Pure report builders are
// unit-testable in Node; the modal setup wires them into the dashboard.
// Offline-first: everything reads localStorage via loadComplaints(); exports
// are generated client-side (print window, CSV blob, clipboard copy).
import {
  AREA_OUTAGE_CUSTOMER_ID,
  complaintCustomerLabel,
  loadComplaints,
  pakistanMonthNow
} from './complaint-register.js';
import { buildMonthlyDowntimeAnalytics } from './downtime-analytics.js';

const MONTH_INPUT_RE = /^\d{4}-\d{2}$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function round1(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function monthOf(complaint) {
  return String(complaint?.reportedAt || '').slice(0, 7);
}

function downtimeOf(complaint) {
  const n = Number(complaint?.downtimeHours);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function isAreaOutage(complaint) {
  return complaint?.customerId === AREA_OUTAGE_CUSTOMER_ID;
}

function monthRows(list, month) {
  const validMonth = MONTH_INPUT_RE.test(String(month || '')) ? String(month) : '';
  if (!validMonth) return { month: '', rows: [] };
  const rows = (Array.isArray(list) ? list : []).filter(
    (c) => c && typeof c === 'object' && monthOf(c) === validMonth
  );
  return { month: validMonth, rows };
}

/**
 * Whole-month executive report. month must be YYYY-MM; anything else yields
 * a zeroed report for ''. Area outages count toward the summary and the
 * cause breakdown but never toward a single customer (SISP-16 rule).
 * Returns { month, summary, perCustomer, byCause, log }.
 */
export function buildMonthlyComplaintReport(list, month) {
  const { month: validMonth, rows } = monthRows(list, month);
  const analytics = buildMonthlyDowntimeAnalytics(list, validMonth);
  const resolvedCount = rows.filter((c) => c.status === 'Resolved').length;
  const fiberCutRow = analytics.byCause.find((row) => row.category === 'Fiber Cut');
  const totalDowntime = analytics.totalDowntime;

  const customerMap = new Map();
  for (const complaint of rows) {
    if (isAreaOutage(complaint)) continue;
    const key = complaint.customerId !== null && complaint.customerId !== undefined && String(complaint.customerId) !== ''
      ? `id:${complaint.customerId}`
      : `name:${complaint.customerName || 'Unknown customer'}`;
    let entry = customerMap.get(key);
    if (!entry) {
      entry = {
        customerId: complaint.customerId ?? null,
        customerName: cleanText(complaint.customerName) || 'Unknown customer',
        areaZone: '',
        complaintCount: 0,
        pendingCount: 0,
        totalDowntime: 0,
        lastResolvedAt: ''
      };
      customerMap.set(key, entry);
    }
    entry.complaintCount += 1;
    entry.totalDowntime = round2(entry.totalDowntime + downtimeOf(complaint));
    const zone = cleanText(complaint.zone);
    if (zone && !entry.areaZone) entry.areaZone = zone;
    if (complaint.status === 'Resolved') {
      const resolvedAt = String(complaint.resolvedAt || '');
      if (resolvedAt && (!entry.lastResolvedAt || resolvedAt > entry.lastResolvedAt)) {
        entry.lastResolvedAt = resolvedAt;
      }
    } else {
      entry.pendingCount += 1;
    }
  }

  const perCustomer = [...customerMap.values()].map((entry) => ({
    ...entry,
    status: entry.pendingCount > 0 ? `Pending (${entry.pendingCount})` : 'Resolved'
  })).sort((a, b) =>
    (b.complaintCount - a.complaintCount) ||
    (b.totalDowntime - a.totalDowntime) ||
    String(a.customerName).localeCompare(String(b.customerName)));

  const byCause = analytics.byCause
    .filter((row) => row.incidents > 0)
    .map((row) => ({
      category: row.category,
      incidents: row.incidents,
      totalDowntime: row.totalDowntime,
      sharePct: totalDowntime > 0 ? round1((100 * row.totalDowntime) / totalDowntime) : 0
    }));

  const log = [...rows].sort((a, b) =>
    String(a.reportedAt || '').localeCompare(String(b.reportedAt || '')) ||
    String(a.id || '').localeCompare(String(b.id || ''))).map((c) => ({
    id: cleanText(c.id),
    customer: complaintCustomerLabel(c) || 'Unknown customer',
    issueCategory: cleanText(c.issueCategory) || 'Other',
    reportedAt: String(c.reportedAt || ''),
    resolvedAt: String(c.resolvedAt || ''),
    downtimeHours: downtimeOf(c),
    resolutionNote: cleanText(c.resolutionNote),
    status: c.status === 'Resolved' ? 'Resolved' : 'Pending'
  }));

  return {
    month: validMonth,
    summary: {
      totalComplaints: rows.length,
      resolvedCount,
      pendingCount: rows.length - resolvedCount,
      totalDowntime,
      fiberCutHours: fiberCutRow ? fiberCutRow.totalDowntime : 0
    },
    perCustomer,
    byCause,
    log
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function monthLabel(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(month || '');
  const index = Number(match[2]) - 1;
  return index >= 0 && index < 12 ? `${MONTH_NAMES[index]} ${match[1]}` : String(month);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values) {
  return values.map(csvEscape).join(',');
}

/** Full report as CSV text: summary lines, then the 3 tables. */
export function buildReportCsv(report) {
  const lines = [];
  const label = monthLabel(report.month);
  lines.push(csvRow(['Monthly Complaint Report', label]));
  lines.push(csvRow(['Total Complaints Logged', report.summary.totalComplaints]));
  lines.push(csvRow(['Resolved', report.summary.resolvedCount]));
  lines.push(csvRow(['Pending', report.summary.pendingCount]));
  lines.push(csvRow(['Total Hours Net Off', report.summary.totalDowntime]));
  lines.push(csvRow(['Fiber Cut Hours', report.summary.fiberCutHours]));
  lines.push('');
  lines.push(csvRow(['Customer', 'Area/Zone', 'Complaints', 'Total Hours Off', 'Last Resolved', 'Status']));
  for (const row of report.perCustomer) {
    lines.push(csvRow([row.customerName, row.areaZone, row.complaintCount, row.totalDowntime, row.lastResolvedAt, row.status]));
  }
  lines.push('');
  lines.push(csvRow(['Issue Cause', 'Incidents', 'Total Hours Off', 'Share %']));
  for (const row of report.byCause) {
    lines.push(csvRow([row.category, row.incidents, row.totalDowntime, row.sharePct]));
  }
  lines.push('');
  lines.push(csvRow(['Ticket ID', 'Customer', 'Issue', 'Complaint Date/Time', 'Resolved Date/Time', 'Hours Off', 'Resolution Note', 'Status']));
  for (const row of report.log) {
    lines.push(csvRow([row.id, row.customer, row.issueCategory, row.reportedAt, row.resolvedAt, row.downtimeHours, row.resolutionNote, row.status]));
  }
  return lines.join('\n');
}

/**
 * Short WhatsApp monthly summary. script 'roman' (Roman Urdu, default) or
 * 'urdu' (Urdu script). Empty months get a no-complaints line.
 */
export function buildReportWhatsAppSummary(report, script = 'roman') {
  const label = monthLabel(report.month);
  const { totalComplaints, resolvedCount, pendingCount, totalDowntime, fiberCutHours } = report.summary;
  const top = report.perCustomer[0];
  if (totalComplaints === 0) {
    return script === 'urdu'
      ? `شاہدرہ آئی ایس پی — ماہانہ شکایات رپورٹ (${label}): اس ماہ کوئی شکایت درج نہیں ہوئی۔`
      : `Shahdara ISP — Mahana Shikayat Report (${label}): Is mahine koi shikayat darj nahi hui.`;
  }
  const topLine = top
    ? (script === 'urdu'
      ? ` سب سے زیادہ: ${top.customerName} (${top.complaintCount} شکایات، ${top.totalDowntime} گھنٹے)۔`
      : ` Sab se zyada: ${top.customerName} (${top.complaintCount} shikayat, ${top.totalDowntime} ghante).`)
    : '';
  if (script === 'urdu') {
    return `شاہدرہ آئی ایس پی — ماہانہ شکایات رپورٹ (${label}): کل ${totalComplaints} شکایات — ${resolvedCount} حل، ${pendingCount} زیر التواء۔ نیٹ بند کا کل وقت: ${totalDowntime} گھنٹے (فائبر کٹ: ${fiberCutHours} گھنٹے)۔${topLine}`;
  }
  return `Shahdara ISP — Mahana Shikayat Report (${label}): Kul ${totalComplaints} shikayat — ${resolvedCount} hal, ${pendingCount} pending. Total net band: ${totalDowntime} ghante (Fiber Cut: ${fiberCutHours} ghante).${topLine}`;
}

/** Standalone printable HTML document for the print window (paper-white by design). */
export function buildPrintableReportHtml(report) {
  const label = escapeHtml(monthLabel(report.month));
  const s = report.summary;
  const customerRows = report.perCustomer.map((row) => `
      <tr><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.areaZone || '—')}</td><td>${row.complaintCount}</td><td>${row.totalDowntime} h</td><td>${escapeHtml(row.lastResolvedAt || '—')}</td><td>${escapeHtml(row.status)}</td></tr>`).join('');
  const causeRows = report.byCause.map((row) => `
      <tr><td>${escapeHtml(row.category)}</td><td>${row.incidents}</td><td>${row.totalDowntime} h</td><td>${row.sharePct}%</td></tr>`).join('');
  const logRows = report.log.map((row) => `
      <tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.customer)}</td><td>${escapeHtml(row.issueCategory)}</td><td>${escapeHtml(row.reportedAt || '—')}</td><td>${escapeHtml(row.resolvedAt || '—')}</td><td>${row.downtimeHours} h</td><td>${escapeHtml(row.resolutionNote || '—')}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Monthly Complaint Report — ${label}</title>
<style>body{font-family:system-ui,sans-serif;color:#111;margin:24px}h1{font-size:20px}h2{font-size:15px;margin-top:24px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}.cards{display:flex;gap:12px;flex-wrap:wrap}.cards div{border:1px solid #bbb;border-radius:8px;padding:10px 14px}.cards b{font-size:18px;display:block}</style></head><body>
<h1>Shahdara ISP — Monthly Complaint Report</h1><p>${label}</p>
<div class="cards"><div><b>${s.totalComplaints}</b>Total complaints</div><div><b>${s.resolvedCount}</b>Resolved</div><div><b>${s.pendingCount}</b>Pending</div><div><b>${s.totalDowntime} h</b>Total net off</div><div><b>${s.fiberCutHours} h</b>Fiber Cut hours</div></div>
<h2>Customer complaint frequency &amp; offline hours</h2>
<table><thead><tr><th>Customer</th><th>Area/Zone</th><th>Complaints</th><th>Total hours off</th><th>Last resolved</th><th>Status</th></tr></thead><tbody>${customerRows || '<tr><td colspan="6">No customer complaints in this month.</td></tr>'}</tbody></table>
<h2>Cause-wise outage breakdown</h2>
<table><thead><tr><th>Issue cause</th><th>Incidents</th><th>Total hours off</th><th>Share</th></tr></thead><tbody>${causeRows || '<tr><td colspan="4">No outages in this month.</td></tr>'}</tbody></table>
<h2>Full chronological complaint log</h2>
<table><thead><tr><th>Ticket ID</th><th>Customer</th><th>Issue</th><th>Complaint date/time</th><th>Resolved date/time</th><th>Hours off</th><th>Resolution note</th></tr></thead><tbody>${logRows || '<tr><td colspan="7">No complaints in this month.</td></tr>'}</tbody></table>
</body></html>`;
}

function downloadTextFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Dashboard modal wiring, mirroring setupDowntimeAnalyticsModal. The dialog
 * uses the shared .billing-modal styling (theme tokens, dark-mode safe).
 * Returns { open, refresh } or null when the dialog is absent (Node tests).
 */
export function setupMonthlyComplaintReportModal(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('monthlyComplaintReportModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const toast = typeof onToast === 'function' ? onToast : () => {};
  let month = pakistanMonthNow();
  let script = 'roman';

  function render() {
    const report = buildMonthlyComplaintReport(loadComplaints(), month);
    const s = report.summary;
    const summaryEl = $('monthlyReportSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = s.totalComplaints === 0
        ? `No complaints reported in ${month || 'this month'}.`
        : `${s.totalComplaints} complaints · ${s.resolvedCount} resolved · ${s.pendingCount} pending · ${s.totalDowntime} h net off · ${s.fiberCutHours} h Fiber Cut`;
    }
    const cardsEl = $('monthlyReportSummaryCards');
    if (cardsEl) {
      const card = (value, labelText) => `<article class="monthly-report-stat-card"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(labelText)}</span></article>`;
      cardsEl.innerHTML =
        card(s.totalComplaints, 'Total complaints') +
        card(s.resolvedCount, 'Resolved') +
        card(s.pendingCount, 'Pending') +
        card(`${s.totalDowntime} h`, 'Total hours net off') +
        card(`${s.fiberCutHours} h`, 'Fiber Cut hours');
    }
    const customerEl = $('monthlyReportCustomerTable');
    if (customerEl) {
      customerEl.innerHTML = report.perCustomer.length === 0
        ? '<p class="monthly-report-empty">No customer complaints in this month.</p>'
        : `<table class="monthly-report-table"><thead><tr><th>Customer</th><th>Area/Zone</th><th>Complaints</th><th>Total hours off</th><th>Last resolved</th><th>Status</th></tr></thead><tbody>${report.perCustomer.map((row) => `
          <tr><td data-label="Customer">${escapeHtml(row.customerName)}</td><td data-label="Area/Zone">${escapeHtml(row.areaZone || '—')}</td><td data-label="Complaints">${row.complaintCount}</td><td data-label="Total hours off">${row.totalDowntime} h</td><td data-label="Last resolved">${escapeHtml(row.lastResolvedAt || '—')}</td><td data-label="Status">${escapeHtml(row.status)}</td></tr>`).join('')}</tbody></table>`;
    }
    const causeEl = $('monthlyReportCauseTable');
    if (causeEl) {
      causeEl.innerHTML = report.byCause.length === 0
        ? '<p class="monthly-report-empty">No outages in this month.</p>'
        : `<table class="monthly-report-table"><thead><tr><th>Issue cause</th><th>Incidents</th><th>Total hours off</th><th>Share</th></tr></thead><tbody>${report.byCause.map((row) => `
          <tr><td data-label="Issue cause">${escapeHtml(row.category)}</td><td data-label="Incidents">${row.incidents}</td><td data-label="Total hours off">${row.totalDowntime} h</td><td data-label="Share">${row.sharePct}%</td></tr>`).join('')}</tbody></table>`;
    }
    const logEl = $('monthlyReportLogTable');
    if (logEl) {
      logEl.innerHTML = report.log.length === 0
        ? '<p class="monthly-report-empty">No complaints in this month.</p>'
        : `<table class="monthly-report-table"><thead><tr><th>Ticket ID</th><th>Customer</th><th>Issue</th><th>Complaint date/time</th><th>Resolved date/time</th><th>Hours off</th><th>Resolution note</th></tr></thead><tbody>${report.log.map((row) => `
          <tr><td data-label="Ticket ID">${escapeHtml(row.id)}</td><td data-label="Customer">${escapeHtml(row.customer)}</td><td data-label="Issue">${escapeHtml(row.issueCategory)}</td><td data-label="Complaint date/time">${escapeHtml(row.reportedAt || '—')}</td><td data-label="Resolved date/time">${escapeHtml(row.resolvedAt || '—')}</td><td data-label="Hours off">${row.downtimeHours} h</td><td data-label="Resolution note">${escapeHtml(row.resolutionNote || '—')}</td></tr>`).join('')}</tbody></table>`;
    }
    const summaryTextEl = $('monthlyReportSummaryText');
    if (summaryTextEl) summaryTextEl.value = buildReportWhatsAppSummary(report, script);
    dialog.dataset.reportMonth = month;
  }

  const monthInput = $('monthlyComplaintReportMonth');
  if (monthInput) {
    monthInput.value = month;
    monthInput.addEventListener('change', () => {
      month = monthInput.value || pakistanMonthNow();
      render();
    });
  }
  const scriptSelect = $('monthlyReportSummaryScript');
  if (scriptSelect) {
    scriptSelect.addEventListener('change', () => {
      script = scriptSelect.value === 'urdu' ? 'urdu' : 'roman';
      render();
    });
  }
  const printBtn = $('monthlyReportPrintBtn');
  if (printBtn) printBtn.addEventListener('click', () => {
    const report = buildMonthlyComplaintReport(loadComplaints(), month);
    const win = window.open('', '_blank');
    if (!win) {
      toast('Print window blocked — allow pop-ups for this site and try again.');
      return;
    }
    win.document.write(buildPrintableReportHtml(report));
    win.document.close();
    win.focus();
    win.print();
  });
  const csvBtn = $('monthlyReportCsvBtn');
  if (csvBtn) csvBtn.addEventListener('click', () => {
    const report = buildMonthlyComplaintReport(loadComplaints(), month);
    downloadTextFile(`shahdara_complaint_report_${month}.csv`, buildReportCsv(report), 'text/csv;charset=utf-8;');
    toast('Monthly complaint report CSV downloaded.');
  });
  const copyBtn = $('monthlyReportCopyBtn');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const report = buildMonthlyComplaintReport(loadComplaints(), month);
    const text = buildReportWhatsAppSummary(report, script);
    try {
      await navigator.clipboard.writeText(text);
      toast('Monthly summary copied — paste it into WhatsApp.');
    } catch (e) {
      const area = $('monthlyReportSummaryText');
      if (area) {
        area.focus();
        area.select();
        toast('Copy failed — the summary is selected above, copy it manually.');
      } else {
        toast('Copy failed — copy the summary text manually.');
      }
    }
  });
  const closeBtn = $('monthlyComplaintReportCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openMonthlyComplaintReportModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    month = pakistanMonthNow();
    if (monthInput) monthInput.value = month;
    render();
    dialog.showModal();
  });

  return {
    open(prefilter = {}) {
      if (MONTH_INPUT_RE.test(String(prefilter.month || ''))) month = String(prefilter.month);
      if (monthInput) monthInput.value = month;
      render();
      dialog.showModal();
    },
    refresh: render
  };
}
