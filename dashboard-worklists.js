/**
 * dashboard-worklists.js
 * Disconnection & Reconnection Worklists Management Suite (Issue #227).
 *
 * Implements:
 * - "To Disconnect" work list: Active/Not-set customers with overdue > N days (default 10)
 *   and balance > X (default 0 PKR).
 * - "To Reconnect" work list: Disconnected (offline) customers who have paid their dues
 *   (balance <= 0 PKR / credit).
 * - Settings rule thresholds: configurable in PKT with local persistence in `shahdara_worklist_rules`.
 * - One-tap action execution: marks manual serviceStatus ('offline' / 'active') with timestamp.
 * - Reversible actions: allows instant undo / toggling back without data loss.
 * - One-tap bilingual Urdu & English WhatsApp notices (drafts only, never auto-sent).
 * - Pure-vector SVG telemetry visualizer (renderWorklistsSvg).
 * - RFC-4180 CSV export with UTF-8 BOM.
 * - Printable field technician work order manifest (A4 & 80mm slip format).
 * - Accessible modal dialog controller (setupWorklistsModal).
 * - Strictly offline and local-only; zero network or router calls.
 */

import {
  calculatePaymentAllocations,
  formatPKR,
  updateCustomerProfile
} from './core.js';
import {
  formatWhatsAppUrl,
  buildPaymentReminderMessage
} from './form-validation.js';

export const WORKLIST_RULES_STORAGE_KEY = 'shahdara_worklist_rules';

export const DEFAULT_WORKLIST_RULES = {
  disconnectOverdueDays: 10,
  disconnectMinBalance: 0,
  reconnectMaxBalance: 0
};

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(str) {
  return escapeHtml(str);
}

/**
 * Formats a Date object as YYYY-MM-DD using Pakistan Standard Time (Asia/Karachi).
 * @param {Date} date
 * @returns {string}
 */
export function formatDateYmd(date = new Date()) {
  if (!date || isNaN(date.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Calculates calendar day difference (B minus A) in whole days.
 * @param {string} ymdA - 'YYYY-MM-DD'
 * @param {string} ymdB - 'YYYY-MM-DD'
 * @returns {number}
 */
export function diffCalendarDays(ymdA, ymdB) {
  if (!ymdA || !ymdB) return 0;
  const [y1, m1, d1] = ymdA.split('-').map(Number);
  const [y2, m2, d2] = ymdB.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const utcA = Date.UTC(y1, m1 - 1, d1);
  const utcB = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((utcA - utcB) / (1000 * 60 * 60 * 24));
}

/**
 * Resolves bill due date as a YYYY-MM-DD string.
 * Defaults to 10th of bill month if not explicitly specified.
 * @param {object} bill
 * @returns {string|null}
 */
export function parseBillDueDateString(bill) {
  if (!bill) return null;
  if (bill.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(bill.dueDate)) {
    return bill.dueDate;
  }
  if (bill.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(bill.month)) {
    return `${bill.month}-10`;
  }
  return null;
}

/**
 * Retrieves persisted worklist threshold rules from localStorage.
 * @returns {object}
 */
export function getWorklistRules() {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_WORKLIST_RULES };
  try {
    const raw = localStorage.getItem(WORKLIST_RULES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WORKLIST_RULES };
    const parsed = JSON.parse(raw);
    return {
      disconnectOverdueDays: Number.isFinite(Number(parsed.disconnectOverdueDays))
        ? Math.max(0, Math.floor(Number(parsed.disconnectOverdueDays)))
        : DEFAULT_WORKLIST_RULES.disconnectOverdueDays,
      disconnectMinBalance: Number.isFinite(Number(parsed.disconnectMinBalance))
        ? Math.max(0, Number(parsed.disconnectMinBalance))
        : DEFAULT_WORKLIST_RULES.disconnectMinBalance,
      reconnectMaxBalance: Number.isFinite(Number(parsed.reconnectMaxBalance))
        ? Number(parsed.reconnectMaxBalance)
        : DEFAULT_WORKLIST_RULES.reconnectMaxBalance
    };
  } catch {
    return { ...DEFAULT_WORKLIST_RULES };
  }
}

/**
 * Persists worklist threshold rules to localStorage.
 * @param {object} rules
 * @returns {object} Sanitized saved rules
 */
export function saveWorklistRules(rules) {
  const sanitized = {
    disconnectOverdueDays: Number.isFinite(Number(rules?.disconnectOverdueDays))
      ? Math.max(0, Math.floor(Number(rules.disconnectOverdueDays)))
      : DEFAULT_WORKLIST_RULES.disconnectOverdueDays,
    disconnectMinBalance: Number.isFinite(Number(rules?.disconnectMinBalance))
      ? Math.max(0, Number(rules.disconnectMinBalance))
      : DEFAULT_WORKLIST_RULES.disconnectMinBalance,
    reconnectMaxBalance: Number.isFinite(Number(rules?.reconnectMaxBalance))
      ? Number(rules.reconnectMaxBalance)
      : DEFAULT_WORKLIST_RULES.reconnectMaxBalance
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(WORKLIST_RULES_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Storage quota or sandboxed
    }
  }
  return sanitized;
}

/**
 * Calculates Disconnection and Reconnection Worklists for all customers.
 *
 * @param {object} state - App state with customers, bills, etc.
 * @param {object} [options={}]
 * @param {Date|string} [options.referenceDate=new Date()] - Calculation reference date in PKT
 * @param {object} [options.rules=null] - Optional override rules
 * @returns {object} Worklists payload
 */
export function calculateDisconnectReconnectWorklists(state, options = {}) {
  const refDate = options.referenceDate
    ? (options.referenceDate instanceof Date ? options.referenceDate : new Date(options.referenceDate))
    : new Date();
  const refYmd = formatDateYmd(refDate);

  const rules = options.rules
    ? { ...DEFAULT_WORKLIST_RULES, ...options.rules }
    : getWorklistRules();

  const allocations = calculatePaymentAllocations(state || { customers: [] });
  const customers = Array.isArray(state?.customers) ? state.customers : [];

  const toDisconnect = [];
  const toReconnect = [];

  let toDisconnectTotalAmount = 0;

  for (const c of customers) {
    if (c.archived) continue;

    let customerDuesCents = 0;
    const unpaidBills = [];
    let oldestDueDateYmd = null;
    let maxOverdueDays = 0;

    let latestPayment = null;
    let totalPaymentsCount = 0;

    const bills = Array.isArray(c.bills) ? c.bills : [];
    for (const bill of bills) {
      if (Array.isArray(bill.payments)) {
        for (const p of bill.payments) {
          totalPaymentsCount++;
          if (!latestPayment || (p.date && p.date.localeCompare(latestPayment.date) > 0)) {
            latestPayment = p;
          }
        }
      }

      const allocSummary = allocations.forMonth?.(c.id, bill.month);
      const balanceDueCents = allocSummary?.balanceDueCents !== null && allocSummary?.balanceDueCents !== undefined
        ? allocSummary.balanceDueCents
        : Math.round(Number(bill.dueAmount || bill.amount || 0) * 100);

      if (balanceDueCents > 0) {
        customerDuesCents += balanceDueCents;
        const dueYmd = parseBillDueDateString(bill) || `${bill.month}-10`;
        const daysOverdue = Math.max(0, diffCalendarDays(refYmd, dueYmd));

        unpaidBills.push({
          month: bill.month,
          dueYmd,
          daysOverdue,
          balanceDue: Math.round(balanceDueCents / 100)
        });

        if (!oldestDueDateYmd || dueYmd.localeCompare(oldestDueDateYmd) < 0) {
          oldestDueDateYmd = dueYmd;
        }
        if (daysOverdue > maxOverdueDays) {
          maxOverdueDays = daysOverdue;
        }
      }
    }

    const totalOutstanding = Math.round(customerDuesCents / 100);
    const serviceStatus = c.serviceStatus || 'not-set';

    // 1. Check "To Disconnect" criteria:
    // Customer is NOT already offline
    // Overdue > N days (strictly > rules.disconnectOverdueDays per spec)
    // Balance > X (strictly > rules.disconnectMinBalance)
    if (serviceStatus !== 'offline') {
      const isOverdue = maxOverdueDays > rules.disconnectOverdueDays;
      const isBalanceExceeded = totalOutstanding > rules.disconnectMinBalance;

      if (isOverdue && isBalanceExceeded) {
        toDisconnectTotalAmount += totalOutstanding;

        const whatsappMessage = buildPaymentReminderMessage({
          customer: c,
          templateType: 'disconnection',
          billingData: {
            currentMonth: refYmd.slice(0, 7),
            totalDue: totalOutstanding,
            dueDate: oldestDueDateYmd || refYmd
          }
        });
        const whatsappUrl = formatWhatsAppUrl(c.phone, whatsappMessage);

        toDisconnect.push({
          id: c.id,
          customerNumber: c.customerNumber,
          name: c.name || 'Unnamed Subscriber',
          phone: c.phone || '',
          area: c.area || c.mohalla || 'Shahdara',
          mohalla: c.mohalla || '',
          address: c.address || '',
          package: c.packageSpeed || c.package || 'Standard',
          serviceStatus,
          totalOutstanding,
          maxOverdueDays,
          oldestDueDate: oldestDueDateYmd || 'N/A',
          unpaidBillsCount: unpaidBills.length,
          unpaidBills,
          whatsappUrl,
          latestPaymentDate: latestPayment?.date || null,
          actionRequired: 'disconnect'
        });
      }
    }

    // 2. Check "To Reconnect" criteria:
    // Customer IS currently offline (disconnected)
    // Dues have been cleared (totalOutstanding <= rules.reconnectMaxBalance)
    // Has previous bills/history and is in good standing
    if (serviceStatus === 'offline') {
      const isDuesCleared = totalOutstanding <= rules.reconnectMaxBalance;

      if (isDuesCleared) {
        const greetingMsg = `*✅ SERVICE RECONNECTION / سروس بحالی - Shahdara ISP*\n\n` +
          `محترم ${c.name || 'صارف'},\n` +
          `آپ کا انٹرنیٹ اکاؤنٹ نمبر #${c.customerNumber} کے تمام واجبات کلیئر ہو چکے ہیں۔\n\n` +
          `آپ کی سروس دوبارہ بحال کی جا رہی ہے۔ شکریہ!\n\n` +
          `_Shahdara Fiber Net & Cable Network_`;
        const whatsappUrl = formatWhatsAppUrl(c.phone, greetingMsg);

        toReconnect.push({
          id: c.id,
          customerNumber: c.customerNumber,
          name: c.name || 'Unnamed Subscriber',
          phone: c.phone || '',
          area: c.area || c.mohalla || 'Shahdara',
          mohalla: c.mohalla || '',
          address: c.address || '',
          package: c.packageSpeed || c.package || 'Standard',
          serviceStatus: 'offline',
          totalOutstanding,
          latestPaymentDate: latestPayment?.date || 'N/A',
          latestPaymentAmount: latestPayment?.amount || 0,
          latestPaymentMethod: latestPayment?.method || 'Cash',
          whatsappUrl,
          cancellationDate: c.cancellationDate || null,
          actionRequired: 'reconnect'
        });
      }
    }
  }

  // Sort "To Disconnect" by highest balance then oldest overdue days
  toDisconnect.sort((a, b) => b.totalOutstanding - a.totalOutstanding || b.maxOverdueDays - a.maxOverdueDays);

  // Sort "To Reconnect" by most recent payment date
  toReconnect.sort((a, b) => String(b.latestPaymentDate || '').localeCompare(String(a.latestPaymentDate || '')));

  return {
    referenceDate: refYmd,
    rules,
    toDisconnect,
    toReconnect,
    kpis: {
      toDisconnectCount: toDisconnect.length,
      toDisconnectTotalAmount,
      toReconnectCount: toReconnect.length,
      totalActionable: toDisconnect.length + toReconnect.length
    }
  };
}

/**
 * Marks a customer as disconnected (offline) in state.
 * Sets manual serviceStatus to 'offline' and records cancellationDate.
 * Reversible!
 *
 * @param {object} state
 * @param {string} customerId
 * @param {object} [options={}]
 * @returns {{ newState: object, customer: object, previousStatus: string, action: string }}
 */
export function markCustomerDisconnected(state, customerId, options = {}) {
  const refDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const refYmd = formatDateYmd(refDate);

  const customer = (state?.customers ?? []).find(c => c.id === customerId);
  if (!customer) throw new Error(`Customer #${customerId} not found.`);

  const previousStatus = customer.serviceStatus || 'not-set';
  const previousCancellationDate = customer.cancellationDate || null;

  const newState = updateCustomerProfile(state, customerId, {
    serviceStatus: 'offline',
    cancellationDate: refYmd
  }, refDate);

  return {
    newState,
    customer,
    previousStatus,
    previousCancellationDate,
    action: 'disconnect',
    timestamp: refYmd
  };
}

/**
 * Marks a customer as reconnected (active) in state.
 * Sets manual serviceStatus to 'active' and updates connectionDate.
 * Reversible!
 *
 * @param {object} state
 * @param {string} customerId
 * @param {object} [options={}]
 * @returns {{ newState: object, customer: object, previousStatus: string, action: string }}
 */
export function markCustomerReconnected(state, customerId, options = {}) {
  const refDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const refYmd = formatDateYmd(refDate);

  const customer = (state?.customers ?? []).find(c => c.id === customerId);
  if (!customer) throw new Error(`Customer #${customerId} not found.`);

  const previousStatus = customer.serviceStatus || 'offline';
  const previousConnectionDate = customer.connectionDate || null;

  const newState = updateCustomerProfile(state, customerId, {
    serviceStatus: 'active',
    connectionDate: refYmd,
    cancellationDate: null
  }, refDate);

  return {
    newState,
    customer,
    previousStatus,
    previousConnectionDate,
    action: 'reconnect',
    timestamp: refYmd
  };
}

/**
 * Reverts a customer's service status back to its previous state.
 *
 * @param {object} state
 * @param {string} customerId
 * @param {string} previousStatus
 * @param {object} [previousMeta={}]
 * @param {Date} [referenceDate=new Date()]
 * @returns {object} New state
 */
export function revertCustomerServiceStatus(state, customerId, previousStatus, previousMeta = {}, referenceDate = new Date()) {
  const changes = {
    serviceStatus: previousStatus || 'not-set'
  };
  if ('cancellationDate' in previousMeta) {
    changes.cancellationDate = previousMeta.cancellationDate;
  }
  if ('connectionDate' in previousMeta) {
    changes.connectionDate = previousMeta.connectionDate;
  }
  return updateCustomerProfile(state, customerId, changes, referenceDate);
}

/**
 * Generates an SVG telemetry chart for the worklists.
 * @param {object} worklistData
 * @returns {string} SVG markup
 */
export function renderWorklistsSvg(worklistData) {
  const { kpis, rules, referenceDate } = worklistData || {
    kpis: { toDisconnectCount: 0, toDisconnectTotalAmount: 0, toReconnectCount: 0 },
    rules: DEFAULT_WORKLIST_RULES,
    referenceDate: ''
  };

  const total = (kpis?.toDisconnectCount || 0) + (kpis?.toReconnectCount || 0);
  const discCount = kpis?.toDisconnectCount || 0;
  const recCount = kpis?.toReconnectCount || 0;

  const discWidth = total > 0 ? Math.round((discCount / total) * 360) : 180;
  const recWidth = total > 0 ? 360 - discWidth : 180;

  return `
    <svg viewBox="0 0 460 170" width="100%" height="170" class="worklists-telemetry-svg" role="img" aria-label="Disconnection and Reconnection Worklists Telemetry">
      <defs>
        <linearGradient id="discGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#dc2626"/>
        </linearGradient>
        <linearGradient id="recGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="460" height="170" rx="12" fill="#18221f" stroke="#253530" stroke-width="1"/>
      
      <!-- Top Title Bar -->
      <text x="20" y="28" fill="#e2e8f0" font-size="13" font-weight="700">SERVICE ACTION DISPATCH</text>
      <text x="440" y="28" fill="#94a3b8" font-size="11" text-anchor="end">${escapeXml(referenceDate)} (PKT)</text>
      
      <!-- Split Ratio Bar -->
      <rect x="20" y="44" width="420" height="18" rx="9" fill="#0f1715"/>
      <rect x="20" y="44" width="${Math.max(10, discWidth)}" height="18" rx="9" fill="url(#discGrad)"/>
      <rect x="${20 + discWidth}" y="44" width="${Math.max(0, recWidth)}" height="18" rx="9" fill="url(#recGrad)"/>
      
      <!-- Metrics Boxes -->
      <!-- Disconnect Metric -->
      <g transform="translate(20, 76)">
        <rect width="202" height="74" rx="8" fill="#201515" stroke="#451a1a" stroke-width="1"/>
        <circle cx="16" cy="20" r="5" fill="#ef4444"/>
        <text x="28" y="24" fill="#fca5a5" font-size="11" font-weight="600">TO DISCONNECT</text>
        <text x="16" y="52" fill="#fee2e2" font-size="22" font-weight="800">${discCount}</text>
        <text x="60" y="52" fill="#ef4444" font-size="12" font-weight="600">subscribers</text>
        <text x="16" y="66" fill="#f87171" font-size="11">PKR ${formatPKR(kpis?.toDisconnectTotalAmount || 0)} dues (> ${rules.disconnectOverdueDays}d)</text>
      </g>
      
      <!-- Reconnect Metric -->
      <g transform="translate(238, 76)">
        <rect width="202" height="74" rx="8" fill="#14211a" stroke="#134e35" stroke-width="1"/>
        <circle cx="16" cy="20" r="5" fill="#10b981"/>
        <text x="28" y="24" fill="#6ee7b7" font-size="11" font-weight="600">TO RECONNECT</text>
        <text x="16" y="52" fill="#d1fae5" font-size="22" font-weight="800">${recCount}</text>
        <text x="60" y="52" fill="#10b981" font-size="12" font-weight="600">subscribers</text>
        <text x="16" y="66" fill="#34d399" font-size="11">Dues cleared &middot; ready to restore</text>
      </g>
    </svg>
  `;
}

/**
 * Generates an RFC-4180 CSV export with UTF-8 BOM.
 * @param {object} worklistData
 * @returns {string} CSV text
 */
export function generateWorklistsCsv(worklistData) {
  const { toDisconnect = [], toReconnect = [], referenceDate = '', rules = DEFAULT_WORKLIST_RULES } = worklistData || {};

  const lines = [
    '\uFEFF"Shahdara ISP Billing - Field Disconnection & Reconnection Worklists"',
    `"Generated Date (PKT)","${referenceDate}"`,
    `"Threshold Rules","Overdue > ${rules.disconnectOverdueDays} days, Min Balance > PKR ${rules.disconnectMinBalance}"`,
    '""'
  ];

  // 1. To Disconnect Section
  lines.push('"SECTION 1: TO DISCONNECT (SUSPENSION FOR NON-PAYMENT)"');
  lines.push('"Action","Customer #","Name","Phone","Area / Mohalla","Package","Outstanding Dues (PKR)","Overdue Days","Oldest Due Date","Service Status"');
  for (const c of toDisconnect) {
    lines.push([
      '"DISCONNECT"',
      c.customerNumber,
      `"${String(c.name).replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${String(c.area).replace(/"/g, '""')}"`,
      `"${c.package}"`,
      c.totalOutstanding,
      c.maxOverdueDays,
      `"${c.oldestDueDate}"`,
      `"${c.serviceStatus}"`
    ].join(','));
  }

  lines.push('""');

  // 2. To Reconnect Section
  lines.push('"SECTION 2: TO RECONNECT (SERVICE RESTORATION AFTER PAYMENT)"');
  lines.push('"Action","Customer #","Name","Phone","Area / Mohalla","Package","Current Balance (PKR)","Latest Payment Date","Latest Payment Amount","Payment Method"');
  for (const c of toReconnect) {
    lines.push([
      '"RECONNECT"',
      c.customerNumber,
      `"${String(c.name).replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${String(c.area).replace(/"/g, '""')}"`,
      `"${c.package}"`,
      c.totalOutstanding,
      `"${c.latestPaymentDate}"`,
      c.latestPaymentAmount,
      `"${c.latestPaymentMethod}"`
    ].join(','));
  }

  return lines.join('\r\n');
}

/**
 * Generates printer-friendly HTML for field technicians.
 * @param {object} worklistData
 * @returns {string} HTML string
 */
export function generateWorklistsPrintHtml(worklistData) {
  const { toDisconnect = [], toReconnect = [], referenceDate = '', rules = DEFAULT_WORKLIST_RULES, kpis = {} } = worklistData || {};

  return `
    <!DOCTYPE html>
    <html lang="ur" dir="ltr">
    <head>
      <meta charset="utf-8">
      <title>Field Work Order - Disconnections &amp; Reconnections</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #111; line-height: 1.4; }
        .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
        .header h1 { margin: 0 0 5px; font-size: 20px; }
        .meta { font-size: 12px; color: #555; }
        .kpi-row { display: flex; gap: 20px; margin: 15px 0; }
        .kpi-card { border: 1px solid #ccc; padding: 10px 15px; border-radius: 6px; flex: 1; }
        .kpi-card strong { font-size: 18px; display: block; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f4f4f4; font-weight: 700; }
        .section-title { font-size: 15px; font-weight: 700; margin: 20px 0 8px; border-left: 4px solid #000; padding-left: 8px; }
        .title-disc { border-color: #dc2626; color: #991b1b; }
        .title-rec { border-color: #10b981; color: #065f46; }
        .check-col { width: 40px; text-align: center; }
        .box { width: 14px; height: 14px; border: 1px solid #333; display: inline-block; }
        @media print {
          @page { margin: 12mm; }
          body { margin: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Shahdara ISP &mdash; Field Work Orders (Disconnect / Reconnect)</h1>
        <div class="meta">Date: ${escapeHtml(referenceDate)} (PKT) &bull; Rule: Overdue &gt; ${rules.disconnectOverdueDays} days, Min Balance &gt; PKR ${rules.disconnectMinBalance}</div>
      </div>

      <div class="kpi-row">
        <div class="kpi-card">
          <span>To Disconnect (منقطع کریں)</span>
          <strong>${kpis.toDisconnectCount || 0} accounts &bull; PKR ${formatPKR(kpis.toDisconnectTotalAmount || 0)}</strong>
        </div>
        <div class="kpi-card">
          <span>To Reconnect (بحال کریں)</span>
          <strong>${kpis.toReconnectCount || 0} accounts &bull; Dues Cleared</strong>
        </div>
      </div>

      <div class="section-title title-disc">1. TO DISCONNECT / فہرست منقطع کنکشنز (${toDisconnect.length})</div>
      <table>
        <thead>
          <tr>
            <th class="check-col">Done</th>
            <th>#</th>
            <th>Customer Name</th>
            <th>Phone</th>
            <th>Area / Mohalla</th>
            <th>Package</th>
            <th>Dues (PKR)</th>
            <th>Overdue</th>
            <th>Technician Note</th>
          </tr>
        </thead>
        <tbody>
          ${toDisconnect.map(c => `
            <tr>
              <td class="check-col"><span class="box"></span></td>
              <td>${c.customerNumber}</td>
              <td><strong>${escapeHtml(c.name)}</strong></td>
              <td>${escapeHtml(c.phone)}</td>
              <td>${escapeHtml(c.area)}</td>
              <td>${escapeHtml(c.package)}</td>
              <td><strong>${formatPKR(c.totalOutstanding)}</strong></td>
              <td>${c.maxOverdueDays}d</td>
              <td style="width: 100px;"></td>
            </tr>
          `).join('')}
          ${toDisconnect.length === 0 ? '<tr><td colspan="9" style="text-align:center;">No accounts scheduled for disconnection.</td></tr>' : ''}
        </tbody>
      </table>

      <div class="section-title title-rec">2. TO RECONNECT / فہرست بحالی کنکشنز (${toReconnect.length})</div>
      <table>
        <thead>
          <tr>
            <th class="check-col">Done</th>
            <th>#</th>
            <th>Customer Name</th>
            <th>Phone</th>
            <th>Area / Mohalla</th>
            <th>Package</th>
            <th>Paid Date</th>
            <th>Paid (PKR)</th>
            <th>Technician Note</th>
          </tr>
        </thead>
        <tbody>
          ${toReconnect.map(c => `
            <tr>
              <td class="check-col"><span class="box"></span></td>
              <td>${c.customerNumber}</td>
              <td><strong>${escapeHtml(c.name)}</strong></td>
              <td>${escapeHtml(c.phone)}</td>
              <td>${escapeHtml(c.area)}</td>
              <td>${escapeHtml(c.package)}</td>
              <td>${escapeHtml(c.latestPaymentDate)}</td>
              <td><strong>${formatPKR(c.latestPaymentAmount)}</strong></td>
              <td style="width: 100px;"></td>
            </tr>
          `).join('')}
          ${toReconnect.length === 0 ? '<tr><td colspan="9" style="text-align:center;">No accounts scheduled for reconnection.</td></tr>' : ''}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

/**
 * Generates WhatsApp/clipboard dispatch summary text for the field team.
 * @param {object} worklistData
 * @returns {string} Text summary
 */
export function generateWorklistsBriefing(worklistData) {
  const { toDisconnect = [], toReconnect = [], referenceDate = '', kpis = {}, rules = DEFAULT_WORKLIST_RULES } = worklistData || {};

  const lines = [
    `*📋 SHAHDARA ISP - FIELD ACTION MANIFEST*`,
    `📅 Date: *${referenceDate}* (PKT)`,
    `⚙️ Rules: Overdue > ${rules.disconnectOverdueDays}d | Dues > PKR ${rules.disconnectMinBalance}`,
    '',
    `*⚠️ TO DISCONNECT / منقطع لسٹ:* *${kpis.toDisconnectCount || 0}* accounts (Total: *PKR ${formatPKR(kpis.toDisconnectTotalAmount || 0)}*)`
  ];

  if (toDisconnect.length > 0) {
    toDisconnect.slice(0, 10).forEach((c, i) => {
      lines.push(`${i + 1}. #${c.customerNumber} ${c.name} (${c.area}) - PKR ${formatPKR(c.totalOutstanding)} [${c.maxOverdueDays}d late] 📞 ${c.phone}`);
    });
    if (toDisconnect.length > 10) {
      lines.push(`... and ${toDisconnect.length - 10} more accounts.`);
    }
  } else {
    lines.push(`(None scheduled for disconnection)`);
  }

  lines.push('');
  lines.push(`*✅ TO RECONNECT / بحالی لسٹ:* *${kpis.toReconnectCount || 0}* accounts (Dues cleared)`);

  if (toReconnect.length > 0) {
    toReconnect.slice(0, 10).forEach((c, i) => {
      lines.push(`${i + 1}. #${c.customerNumber} ${c.name} (${c.area}) - Paid PKR ${formatPKR(c.latestPaymentAmount)} on ${c.latestPaymentDate} 📞 ${c.phone}`);
    });
    if (toReconnect.length > 10) {
      lines.push(`... and ${toReconnect.length - 10} more accounts.`);
    }
  } else {
    lines.push(`(None scheduled for reconnection)`);
  }

  lines.push('');
  lines.push(`_Shahdara Fiber Net Field Operations_`);

  return lines.join('\n');
}

/**
 * Sets up and controls the Disconnection and Reconnection Worklists Modal Dialog.
 *
 * @param {Function} getState - Returns current app state
 * @param {object} [options={}]
 * @param {Function} [options.onUpdateState] - Callback with updated state
 * @param {Function} [options.onToast] - Toast notification function
 * @param {Function} [options.onFilterCustomer] - Function to inspect customer profile
 * @returns {object} Controller instance with open/render methods
 */
export function setupWorklistsModal(getState, options = {}) {
  const modal = document.getElementById('workListModal');
  const openBtn = document.getElementById('openWorklistsModalBtn');
  const openFromDuesBtn = document.getElementById('openWorklistsFromDuesBtn');
  const closeBtn = document.getElementById('worklistCloseBtn');

  if (!modal) return null;

  let activeTab = 'disconnect'; // 'disconnect' | 'reconnect' | 'rules'
  let searchQuery = '';
  let selectedArea = 'all';

  function getWorklistData() {
    const state = typeof getState === 'function' ? getState() : getState;
    return calculateDisconnectReconnectWorklists(state);
  }

  function render() {
    const data = getWorklistData();
    const { toDisconnect, toReconnect, kpis, rules } = data;

    // Update KPI badges in header/tabs
    const discBadge = document.getElementById('worklistDiscCountBadge');
    if (discBadge) discBadge.textContent = String(kpis.toDisconnectCount);

    const recBadge = document.getElementById('worklistRecCountBadge');
    if (recBadge) recBadge.textContent = String(kpis.toReconnectCount);

    // Update SVG host
    const svgHost = document.getElementById('worklistSvgHost');
    if (svgHost) {
      svgHost.innerHTML = renderWorklistsSvg(data);
    }

    // Populate area filter options if empty
    const areaFilter = document.getElementById('worklistAreaFilter');
    if (areaFilter && areaFilter.options.length <= 1) {
      const allAreas = new Set();
      toDisconnect.forEach(c => { if (c.area) allAreas.add(c.area); });
      toReconnect.forEach(c => { if (c.area) allAreas.add(c.area); });
      Array.from(allAreas).sort().forEach(area => {
        const opt = document.createElement('option');
        opt.value = area;
        opt.textContent = area;
        areaFilter.appendChild(opt);
      });
    }

    // Render Tab Panes
    const discPane = document.getElementById('worklistDisconnectPane');
    const recPane = document.getElementById('worklistReconnectPane');
    const rulesPane = document.getElementById('worklistRulesPane');

    if (discPane) discPane.hidden = activeTab !== 'disconnect';
    if (recPane) recPane.hidden = activeTab !== 'reconnect';
    if (rulesPane) rulesPane.hidden = activeTab !== 'rules';

    // Highlight active tab button
    document.querySelectorAll('.worklist-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === activeTab);
      btn.setAttribute('aria-selected', btn.dataset.tab === activeTab ? 'true' : 'false');
    });

    // 1. Render To Disconnect List
    if (discPane && activeTab === 'disconnect') {
      const listEl = document.getElementById('worklistDisconnectList');
      if (listEl) {
        let filtered = toDisconnect;
        if (selectedArea && selectedArea !== 'all') {
          filtered = filtered.filter(c => c.area === selectedArea);
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(c =>
            String(c.name).toLowerCase().includes(q) ||
            String(c.customerNumber).includes(q) ||
            String(c.phone).includes(q) ||
            String(c.area).toLowerCase().includes(q)
          );
        }

        if (filtered.length === 0) {
          listEl.innerHTML = `
            <div class="worklist-empty-state">
              <span class="empty-icon">✅</span>
              <h4>No accounts scheduled for disconnection</h4>
              <p>All active accounts are within normal due limits or no customers match the search.</p>
            </div>
          `;
        } else {
          listEl.innerHTML = filtered.map(c => `
            <article class="worklist-item worklist-item-disconnect" data-customer-id="${c.id}">
              <div class="worklist-item-main">
                <div class="worklist-item-header">
                  <span class="worklist-cust-badge">#${c.customerNumber}</span>
                  <strong class="worklist-cust-name">${escapeHtml(c.name)}</strong>
                  <span class="worklist-tag worklist-tag-overdue">${c.maxOverdueDays} days late</span>
                </div>
                <div class="worklist-item-meta">
                  <span>📍 ${escapeHtml(c.area)}</span>
                  <span>📦 ${escapeHtml(c.package)}</span>
                  <span>📅 Oldest due: ${escapeHtml(c.oldestDueDate)}</span>
                </div>
              </div>
              <div class="worklist-item-actions">
                <div class="worklist-amount-col">
                  <span class="amount-label">Dues</span>
                  <strong class="amount-val amount-val-due">PKR ${formatPKR(c.totalOutstanding)}</strong>
                </div>
                <div class="worklist-buttons-group">
                  <a href="${escapeHtml(c.whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="secondary-button btn-sm worklist-wa-btn" title="Send WhatsApp disconnection warning">
                    💬 Notice
                  </a>
                  <button type="button" class="danger-button btn-sm worklist-mark-btn" data-action="disconnect" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-num="${c.customerNumber}">
                    ✂️ Mark Disconnected
                  </button>
                </div>
              </div>
            </article>
          `).join('');
        }
      }
    }

    // 2. Render To Reconnect List
    if (recPane && activeTab === 'reconnect') {
      const listEl = document.getElementById('worklistReconnectList');
      if (listEl) {
        let filtered = toReconnect;
        if (selectedArea && selectedArea !== 'all') {
          filtered = filtered.filter(c => c.area === selectedArea);
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(c =>
            String(c.name).toLowerCase().includes(q) ||
            String(c.customerNumber).includes(q) ||
            String(c.phone).includes(q) ||
            String(c.area).toLowerCase().includes(q)
          );
        }

        if (filtered.length === 0) {
          listEl.innerHTML = `
            <div class="worklist-empty-state">
              <span class="empty-icon">🔌</span>
              <h4>No accounts waiting for reconnection</h4>
              <p>Disconnected accounts with cleared balances will appear here automatically.</p>
            </div>
          `;
        } else {
          listEl.innerHTML = filtered.map(c => `
            <article class="worklist-item worklist-item-reconnect" data-customer-id="${c.id}">
              <div class="worklist-item-main">
                <div class="worklist-item-header">
                  <span class="worklist-cust-badge">#${c.customerNumber}</span>
                  <strong class="worklist-cust-name">${escapeHtml(c.name)}</strong>
                  <span class="worklist-tag worklist-tag-cleared">Dues Cleared</span>
                </div>
                <div class="worklist-item-meta">
                  <span>📍 ${escapeHtml(c.area)}</span>
                  <span>📦 ${escapeHtml(c.package)}</span>
                  <span>💰 Paid PKR ${formatPKR(c.latestPaymentAmount)} on ${escapeHtml(c.latestPaymentDate)} (${escapeHtml(c.latestPaymentMethod)})</span>
                </div>
              </div>
              <div class="worklist-item-actions">
                <div class="worklist-amount-col">
                  <span class="amount-label">Balance</span>
                  <strong class="amount-val amount-val-zero">PKR 0</strong>
                </div>
                <div class="worklist-buttons-group">
                  <a href="${escapeHtml(c.whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="secondary-button btn-sm worklist-wa-btn" title="Send WhatsApp reconnection confirmation">
                    💬 Greeting
                  </a>
                  <button type="button" class="primary-button btn-sm worklist-mark-btn" data-action="reconnect" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-num="${c.customerNumber}">
                    ✅ Mark Reconnected
                  </button>
                </div>
              </div>
            </article>
          `).join('');
        }
      }
    }

    // 3. Render Rules Input Values
    if (rulesPane && activeTab === 'rules') {
      const daysInput = document.getElementById('worklistRuleOverdueDays');
      if (daysInput && document.activeElement !== daysInput) {
        daysInput.value = String(rules.disconnectOverdueDays);
      }
      const minBalInput = document.getElementById('worklistRuleMinBalance');
      if (minBalInput && document.activeElement !== minBalInput) {
        minBalInput.value = String(rules.disconnectMinBalance);
      }
    }
  }

  // Bind tab switching
  document.querySelectorAll('.worklist-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab || 'disconnect';
      render();
    });
  });

  // Search input
  const searchInput = document.getElementById('worklistSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      render();
    });
  }

  // Area filter
  const areaFilter = document.getElementById('worklistAreaFilter');
  if (areaFilter) {
    areaFilter.addEventListener('change', (e) => {
      selectedArea = e.target.value;
      render();
    });
  }

  // Delegated mark button clicks
  modal.addEventListener('click', async (e) => {
    const markBtn = e.target.closest('.worklist-mark-btn');
    if (!markBtn) return;

    const action = markBtn.dataset.action;
    const custId = markBtn.dataset.id;
    const custName = markBtn.dataset.name;
    const custNum = markBtn.dataset.num;

    const currentState = typeof getState === 'function' ? getState() : getState;

    if (action === 'disconnect') {
      const ask = typeof window !== 'undefined' && typeof window.appConfirm === 'function'
        ? await window.appConfirm({
            tone: 'warning',
            title: 'Mark customer as Disconnected?',
            subject: `#${custNum} ${custName}`,
            message: `Sets manual service status to Offline and records today's disconnection date. Reversible.`,
            confirmLabel: 'Mark Offline'
          })
        : (typeof confirm === 'function' ? confirm(`Mark #${custNum} ${custName} as Disconnected?`) : true);

      if (!ask) return;

      try {
        const { newState, previousStatus, previousCancellationDate } = markCustomerDisconnected(currentState, custId);
        if (typeof options.onUpdateState === 'function') {
          options.onUpdateState(newState);
        }
        if (typeof options.onToast === 'function') {
          options.onToast(`Customer #${custNum} marked Offline.`, {
            actionLabel: 'Undo',
            onAction: () => {
              const reverted = revertCustomerServiceStatus(newState, custId, previousStatus, { cancellationDate: previousCancellationDate });
              if (typeof options.onUpdateState === 'function') {
                options.onUpdateState(reverted);
              }
              render();
            }
          });
        }
        render();
      } catch (err) {
        if (typeof options.onToast === 'function') options.onToast(err.message);
      }
    } else if (action === 'reconnect') {
      const ask = typeof window !== 'undefined' && typeof window.appConfirm === 'function'
        ? await window.appConfirm({
            tone: 'warning',
            title: 'Mark customer as Reconnected?',
            subject: `#${custNum} ${custName}`,
            message: `Sets manual service status to Active and clears disconnection date. Reversible.`,
            confirmLabel: 'Mark Active'
          })
        : (typeof confirm === 'function' ? confirm(`Mark #${custNum} ${custName} as Reconnected?`) : true);

      if (!ask) return;

      try {
        const { newState, previousStatus, previousConnectionDate } = markCustomerReconnected(currentState, custId);
        if (typeof options.onUpdateState === 'function') {
          options.onUpdateState(newState);
        }
        if (typeof options.onToast === 'function') {
          options.onToast(`Customer #${custNum} marked Active!`, {
            actionLabel: 'Undo',
            onAction: () => {
              const reverted = revertCustomerServiceStatus(newState, custId, previousStatus, { connectionDate: previousConnectionDate, cancellationDate: formatDateYmd() });
              if (typeof options.onUpdateState === 'function') {
                options.onUpdateState(reverted);
              }
              render();
            }
          });
        }
        render();
      } catch (err) {
        if (typeof options.onToast === 'function') options.onToast(err.message);
      }
    }
  });

  // Save rules form
  const rulesForm = document.getElementById('worklistRulesForm');
  if (rulesForm) {
    rulesForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const days = Number(document.getElementById('worklistRuleOverdueDays')?.value || 10);
      const minBal = Number(document.getElementById('worklistRuleMinBalance')?.value || 0);
      saveWorklistRules({
        disconnectOverdueDays: days,
        disconnectMinBalance: minBal,
        reconnectMaxBalance: 0
      });
      if (typeof options.onToast === 'function') {
        options.onToast('Worklist rules saved! List updated.');
      }
      activeTab = 'disconnect';
      render();
    });
  }

  // Export CSV
  const exportCsvBtn = document.getElementById('worklistExportCsvBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const data = getWorklistData();
      const csv = generateWorklistsCsv(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara-field-worklists-${data.referenceDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (typeof options.onToast === 'function') {
        options.onToast('Field worklists CSV downloaded.');
      }
    });
  }

  // Print Work Orders
  const printBtn = document.getElementById('worklistPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const data = getWorklistData();
      const html = generateWorklistsPrintHtml(data);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
      }
    });
  }

  // Copy Dispatch Summary
  const copyBtn = document.getElementById('worklistCopyDispatchBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const data = getWorklistData();
      const text = generateWorklistsBriefing(data);
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        if (typeof options.onToast === 'function') {
          options.onToast('Field dispatch manifest copied to clipboard!');
        }
      } catch {
        if (typeof options.onToast === 'function') {
          options.onToast('Could not copy to clipboard.');
        }
      }
    });
  }

  // Open modal handlers
  const openModal = () => {
    render();
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (openFromDuesBtn) openFromDuesBtn.addEventListener('click', openModal);

  // Close modal handler
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    }
  });

  return {
    open: openModal,
    render,
    getData: getWorklistData
  };
}
