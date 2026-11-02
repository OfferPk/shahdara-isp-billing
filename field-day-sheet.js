/**
 * field-day-sheet.js — M10
 * Saad Field Day Sheet (printable, read-only).
 *
 * A one-page printed sheet for the field day, composed ONLY from the
 * derivations the app already runs for the Home surfaces — no list is
 * selected twice and no rule is re-invented here:
 *
 * - Pending installations: the Installation Tracker rows whose
 *   requestStatus (install-tracker.js) is 'Pending' — the exact set
 *   buildMorningBriefing (SISP-145) counts as pendingInstalls, in the
 *   requests' recorded order. Name/phone are the request's own recorded
 *   values; the mohalla comes from the linked customer record when the
 *   request names one.
 * - Open complaints: the rows buildComplaintSummary
 *   (complaint-register.js) counts as open — status 'Open' or
 *   'In Progress' (never 'Resolved') — in recorded order. The customer
 *   label is the register's own complaintCustomerLabel; mohalla/phone
 *   join from the customer record by customerId. Area-outage rows keep
 *   their zone as the location and carry no phone (there is no single
 *   customer to call).
 * - Waadas due today: buildMorningBriefing's waadas.entries verbatim —
 *   the SISP-145 derivation (promiseDate == today, customer not
 *   archived, outstanding balance > 0 per the core allocation engine,
 *   so a settled promise is already dead). Mohalla/phone join from the
 *   customer record by customerId.
 * - Expired vacation holds awaiting resume:
 *   buildExpiredVacationHoldQueue (pause-billing.js, SISP-186) verbatim
 *   — the same queue the Dashboard alert shows (vacationHoldState
 *   'expired', archived excluded, earliest auto-resume date first).
 *
 * The sheet is READ-ONLY: buildFieldDaySheet is a pure function of
 * (state, today, extras). It writes nothing, stores nothing and
 * mutates no state; the only side effect in this module is the print
 * window the owner explicitly opens from the Morning Briefing card.
 *
 * PHONE NUMBERS: the printed sheet shows each phone exactly as
 * recorded, because the paper never leaves the owner's hands — the
 * opposite of the SISP-145 WhatsApp copy text, which never carries a
 * number. This module deliberately has NO WhatsApp/text variant.
 */

import { buildMorningBriefing, morningBriefingDateStr } from './morning-briefing.js';
import { AREA_OUTAGE_CUSTOMER_ID, complaintCustomerLabel, loadComplaints } from './complaint-register.js';
import { loadInstallRequests, requestNameLabel, requestStatus } from './install-tracker.js';
import { buildExpiredVacationHoldQueue } from './pause-billing.js';
import { escapeHtml, formatPKR } from './owner-khata.js';
import { displayCustomerName } from './urdu-names.js';
import { t } from './nav-language.js';

function customerIndex(customers) {
  const byId = new Map();
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (customer && customer.id != null && !byId.has(customer.id)) byId.set(customer.id, customer);
  }
  return byId;
}

function contactFields(customer) {
  return {
    nameUrdu: String(customer?.nameUrdu ?? ''),
    mohalla: String(customer?.mohalla ?? ''),
    phone: String(customer?.phone ?? '')
  };
}

/**
 * Pure: builds the field day sheet for `today` (Date | 'YYYY-MM-DD',
 * PKT — the Morning Briefing's own date rule). `extras` carries the
 * side stores exactly as the host loads them for the briefing:
 * { complaints, installRequests, settlements, backupRecord, now }.
 * Never mutates its inputs.
 */
export function buildFieldDaySheet(state = {}, today = new Date(), extras = {}) {
  const safeState = state && typeof state === 'object' ? state : {};
  const customers = Array.isArray(safeState.customers) ? safeState.customers : [];
  const byId = customerIndex(customers);
  const dateStr = morningBriefingDateStr(today);

  // --- 1. Pending installations (install-tracker status rule) --------------
  const installRequests = Array.isArray(extras?.installRequests) ? extras.installRequests : [];
  const installs = installRequests
    .filter((request) => requestStatus(request) === 'Pending')
    .map((request) => {
      const linked = request.customerId ? byId.get(request.customerId) : undefined;
      return {
        requestId: request.id ?? null,
        customerId: request.customerId ?? null,
        customerNumber: request.customerNumber ?? linked?.customerNumber ?? null,
        name: requestNameLabel(request),
        nameUrdu: String(linked?.nameUrdu ?? ''),
        mohalla: String(linked?.mohalla ?? ''),
        phone: String(request.phone || linked?.phone || ''),
        requestDate: String(request.requestDate ?? '')
      };
    });

  // --- 2. Open complaints (buildComplaintSummary's open set) ---------------
  const complaintRows = Array.isArray(extras?.complaints) ? extras.complaints : [];
  const complaints = complaintRows
    .filter((complaint) => complaint && (complaint.status === 'Open' || complaint.status === 'In Progress'))
    .map((complaint) => {
      const isAreaOutage = complaint.customerId === AREA_OUTAGE_CUSTOMER_ID;
      const customer = !isAreaOutage && complaint.customerId != null ? byId.get(complaint.customerId) : undefined;
      return {
        complaintId: complaint.id ?? null,
        customerId: complaint.customerId ?? null,
        name: complaintCustomerLabel(complaint),
        nameUrdu: String(customer?.nameUrdu ?? ''),
        isAreaOutage,
        mohalla: isAreaOutage ? String(complaint.zone ?? '') : String(customer?.mohalla ?? ''),
        phone: isAreaOutage ? '' : String(customer?.phone ?? ''),
        status: String(complaint.status ?? ''),
        issueCategory: String(complaint.issueCategory ?? ''),
        reportedAt: String(complaint.reportedAt ?? '')
      };
    });

  // --- 3. Waadas due today (the Morning Briefing's own entries) ------------
  const briefing = buildMorningBriefing(safeState, today, extras);
  const waadas = briefing.waadas.entries.map((entry) => {
    const customer = byId.get(entry.customerId);
    return {
      customerId: entry.customerId,
      customerNumber: entry.customerNumber ?? null,
      name: entry.name,
      ...contactFields(customer),
      promiseAmount: entry.promiseAmount ?? null
    };
  });

  // --- 4. Expired vacation holds (the SISP-186 queue, verbatim) ------------
  const holds = buildExpiredVacationHoldQueue(customers, dateStr).map((row) => ({
    customerId: row.id,
    customerNumber: row.customerNumber ?? null,
    name: row.name,
    ...contactFields(row.customer),
    pauseStartDate: row.pauseStartDate,
    autoResumeDate: row.autoResumeDate
  }));

  return {
    dateStr,
    installs,
    complaints,
    waadas,
    holds,
    counts: {
      installs: installs.length,
      complaints: complaints.length,
      waadas: waadas.length,
      holds: holds.length,
      total: installs.length + complaints.length + waadas.length + holds.length
    }
  };
}

function sectionRows(rows, detailOf) {
  return rows.map((row) => `<tr><td>${escapeHtml(row.displayName)}</td><td>${escapeHtml(row.mohalla || '—')}</td><td>${escapeHtml(row.phone || '—')}</td><td>${escapeHtml(detailOf(row))}</td></tr>`).join('');
}

/** Standalone single-page printable field sheet HTML. Pure. */
export function buildFieldDaySheetPrintHtml(sheet, { lang = null } = {}) {
  if (!sheet || typeof sheet !== 'object') {
    return '<!doctype html><html><body><p>No field day sheet.</p></body></html>';
  }
  const L = (key, params) => t(key, lang, params);
  const withDisplayName = (row) => ({ ...row, displayName: displayCustomerName(row, lang) });
  const sections = [
    {
      title: L('fds_installs'), rows: (sheet.installs ?? []).map(withDisplayName),
      detail: (row) => (row.requestDate ? L('fds_requested_on', { date: row.requestDate }) : '—')
    },
    {
      title: L('fds_complaints'), rows: (sheet.complaints ?? []).map(withDisplayName),
      detail: (row) => [row.issueCategory, row.status].filter(Boolean).join(' · ') || '—'
    },
    {
      title: L('fds_waadas'), rows: (sheet.waadas ?? []).map(withDisplayName),
      detail: (row) => (row.promiseAmount !== null && row.promiseAmount !== undefined ? formatPKR(row.promiseAmount) : '—')
    },
    {
      title: L('fds_holds'), rows: (sheet.holds ?? []).map(withDisplayName),
      detail: (row) => (row.autoResumeDate ? L('fds_resume_was', { date: row.autoResumeDate }) : '—')
    }
  ];
  const sectionsHtml = sections.map((section) => `
  <h2>${escapeHtml(section.title)} (${escapeHtml(String(section.rows.length))})</h2>
  ${section.rows.length
    ? `<table><tr><th>${escapeHtml(L('fds_col_name'))}</th><th>${escapeHtml(L('fds_col_mohalla'))}</th><th>${escapeHtml(L('fds_col_phone'))}</th><th>${escapeHtml(L('fds_col_detail'))}</th></tr>${sectionRows(section.rows, section.detail)}</table>`
    : `<p>${escapeHtml(L('fds_none'))}</p>`}`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(L('fds_title'))} — ${escapeHtml(sheet.dateStr || '')}</title><style>
    body{font-family:system-ui,Arial,sans-serif;color:#111;max-width:720px;margin:16px auto;padding:0 12px;font-size:13px}
    h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
    table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:4px;border-bottom:1px solid #eee;vertical-align:top}
    .foot{color:#555;font-size:11px;margin-top:20px}
  </style></head><body>
  <h1>🗓️ ${escapeHtml(L('fds_title'))}</h1>
  <p><strong>Shahdara ISP</strong> · ${escapeHtml(sheet.dateStr || '')}</p>
  ${sectionsHtml}
  <p class="foot">${escapeHtml(L('fds_foot'))}</p>
  </body></html>`;
}

/**
 * Print-button controller for the Field Day Sheet. The entry button
 * lives on the Home Morning Briefing card (index.html); a tap builds
 * the sheet from the same side-store loaders the briefing itself
 * uses (app.js getBriefingExtras) and opens the print window —
 * following the Owner Month Report controller pattern. Returns
 * { print, buildSheet } or null when the button is absent (e.g.
 * unit-test DOM).
 */
export function setupFieldDaySheet(getState, { onToast } = {}) {
  const btn = typeof document !== 'undefined' ? document.getElementById('fieldDaySheetBtn') : null;
  if (!btn) return null;

  function buildSheet() {
    return buildFieldDaySheet(getState(), new Date(), {
      complaints: loadComplaints(),
      installRequests: loadInstallRequests()
    });
  }

  function print() {
    const html = buildFieldDaySheetPrintHtml(buildSheet());
    const printWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!printWindow) {
      if (onToast) onToast(t('fds_popup_blocked'));
      return null;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return html;
  }

  btn.addEventListener('click', print);
  return { print, buildSheet };
}
