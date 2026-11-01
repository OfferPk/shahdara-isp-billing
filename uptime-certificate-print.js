/**
 * uptime-certificate-print.js — SISP-170 [P2]: Commercial Subscriber
 * Monthly Uptime % & Invoice Certificate
 * ("کمرشل اپ ٹائم اور ٹیکس انوائس" in the spec's wording — see the tax
 * note below).
 *
 * What it does: from a customer profile, generate a 1-page printable
 * Monthly Invoice & Service Uptime Certificate for one month, combining
 *   - the month's billing summary (bill / paid / balance),
 *   - the customer's last 3 payments (up to that month's end), and
 *   - the month's calculated service uptime % (e.g. 99.0%).
 * Commercial subscribers (clinics, schools, pharmacies, offices) are
 * the intended audience — they ask for exactly this paper at audit /
 * reimbursement time.
 *
 * COMMERCIAL MARKER AUDIT (honest): there is NO commercial /
 * residenceType marker on customer records on main (addCustomer /
 * readState carry none; the word "commercial" elsewhere in the app is
 * unrelated QA/dashboard prose). So this module does NOT invent a
 * classification: the certificate is a profile print action available
 * for ANY customer the owner chooses to print it for, and the
 * subscriber block prints only recorded facts.
 *
 * TAX WORDING AUDIT (honest): no recorded field anywhere in the app
 * holds a tax registration (NTN/STRN) or a tax amount, so the document
 * never calls itself a "Tax Invoice" and prints no tax number or tax
 * line. It titles itself "Monthly Invoice & Service Uptime
 * Certificate". The spec's "ٹیکس انوائس" wording cannot be honestly
 * met from recorded data — stated deviation, by design.
 *
 * Sources of truth ONLY — nothing recomputed in parallel, nothing
 * written, no record ever mutated:
 *   - Billing figures come from the ledger engine exactly as the
 *     Billing Register reads them: core.js calculatePaymentAllocations
 *     (which already excludes voided payments — SISP-34) +
 *     derivedBillStatus. paid = billAmount − balanceDue for the month.
 *   - Uptime comes from downtime-analytics.js's OWN per-customer
 *     derivation, buildCustomerDowntimeSummary(complaints, id, month):
 *     the complaint register (sisp_complaints_ledger_v1) is the single
 *     downtime store; a SISP-44 complaint↔ticket pair is ONE register
 *     entry, so pairs count exactly once by construction; AREA_OUTAGE
 *     zone-wide faults never attribute to a single customer (the
 *     module's own rule); unresolved complaints contribute 0 hours
 *     (no resolved endpoint yet); a complaint belongs to the month of
 *     its reportedAt. Unrecorded downtime is simply not counted — the
 *     certificate states this basis in its footnote.
 *   - Payment rows follow receipt.js / recent-payments.js discipline:
 *     non-voided payments only, and the receipt reference is the one
 *     the record itself carries (payment.receiptNumber, else
 *     payment.permanentReceiptNumber). NO reference is ever generated
 *     here — inventing one would fabricate ledger data.
 *
 * Uptime formula: uptime % = (minutes in month − recorded downtime
 * minutes) ÷ minutes in month × 100, one decimal, clamped to
 * [0, 100]. Minutes in month are the real calendar minutes of the
 * PKT month. A month with zero recorded downtime is 100.0%, labelled
 * on the certificate as "no downtime recorded".
 *
 * The print sheet follows the house print conventions (SISP-60
 * voucher book, SISP-110 welcome slip): a standalone HTML document,
 * black on white, printed via window.print ("Save as PDF"). Static
 * labels print bilingually (English / اردو) exactly like receipt.js;
 * prose lines follow the requested language via t().
 *
 * This module is imported ONLY by app.js (never a build entry), so
 * the dist bundle count stays at the #219 budget of 25.
 */

import {
  calculatePaymentAllocations,
  derivedBillStatus,
  formatPKR,
  monthsForHistory
} from './core.js';
import { buildCustomerDowntimeSummary } from './downtime-analytics.js';
import {
  formatDowntimeHours,
  loadComplaints,
  pakistanMonthNow
} from './complaint-register.js';
import { isVoidedPayment } from './payment-void-audit.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const UPTIME_CERT_PAYMENT_LIMIT = 3;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function centsOf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function rupeesOf(cents) {
  return cents / 100;
}

/** Bilingual static label, receipt.js style: "English / اردو". */
function bi(key) {
  return `${t(key, 'en')} / ${t(key, 'ur')}`;
}

/** "October 2026" for a YYYY-MM month key (month names stay Latin). */
export function uptimeCertMonthLabel(month) {
  if (!MONTH_RE.test(String(month || ''))) return String(month || '');
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
}

/** Real calendar minutes in a YYYY-MM month; null for a bad month. */
export function minutesInMonth(month) {
  if (!MONTH_RE.test(String(month || ''))) return null;
  const [year, mon] = String(month).split('-').map(Number);
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return days * 24 * 60;
}

/**
 * Monthly uptime percentage, one decimal, clamped to [0, 100].
 * Returns null when the month length is not a positive number.
 */
export function computeMonthlyUptimePct(downtimeMinutes, totalMinutes) {
  const total = Number(totalMinutes);
  if (!Number.isFinite(total) || total <= 0) return null;
  const down = Number(downtimeMinutes);
  const safeDown = Number.isFinite(down) && down > 0 ? down : 0;
  const pct = ((total - safeDown) / total) * 100;
  const clamped = Math.min(100, Math.max(0, pct));
  return Math.round(clamped * 10) / 10;
}

/** Format a 1-decimal uptime value the spec's way: "99.0%". */
export function formatUptimePct(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

/**
 * The customer's last payments for the certificate: non-voided, valid
 * recorded date on or before the certificate month's last day, newest
 * first (same-date ties break by ledger traversal order DESC, the
 * recent-payments.js discipline). The receipt reference is the stored
 * one only — never generated.
 */
export function lastPaymentsForCertificate(customer, month, limit = UPTIME_CERT_PAYMENT_LIMIT) {
  if (!MONTH_RE.test(String(month || ''))) return [];
  const monthEnd = `${month}-${String(minutesInMonth(month) / 1440).padStart(2, '0')}`;
  const cap = Number.isSafeInteger(limit) && limit > 0 ? limit : UPTIME_CERT_PAYMENT_LIMIT;
  const ranked = [];
  let sequence = 0;
  for (const bill of (Array.isArray(customer?.bills) ? customer.bills : [])) {
    if (!bill || typeof bill !== 'object') continue;
    for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
      sequence += 1;
      if (!payment || typeof payment !== 'object') continue;
      if (isVoidedPayment(payment)) continue;
      const date = text(payment.date);
      if (!DATE_RE.test(date) || date > monthEnd) continue;
      const amount = Number(payment.amount);
      ranked.push({
        paymentId: payment.id ?? '',
        billMonth: text(bill.month),
        date,
        amount: Number.isFinite(amount) ? amount : 0,
        method: text(payment.method),
        receiptRef: text(payment.receiptNumber) || text(payment.permanentReceiptNumber),
        sequence
      });
    }
  }
  ranked.sort((a, b) => b.date.localeCompare(a.date) || b.sequence - a.sequence);
  return ranked.slice(0, cap).map(({ sequence: _sequence, ...row }) => row);
}

/**
 * Builds the certificate model for one customer + month. Pure and
 * read-only: state and complaints are never mutated.
 *
 * @param {Object} state - Full application state ({ customers: [...] })
 * @param {Array} complaints - Raw complaint register rows
 *   (complaint-register.js loadComplaints output)
 * @param {string|number} customerId
 * @param {Object} [options]
 * @param {string} [options.month] - 'YYYY-MM'; defaults to the
 *   reference date's PKT month.
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Object|null} Certificate model, or null when the customer
 *   does not exist.
 */
export function buildUptimeCertificate(state, complaints, customerId, {
  month = null,
  referenceDate = new Date()
} = {}) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const customer = customers.find((c) => c && String(c.id) === String(customerId)) ?? null;
  if (!customer) return null;
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const certMonth = MONTH_RE.test(String(month || '')) ? String(month) : pakistanMonthNow(ref);
  const totalMinutes = minutesInMonth(certMonth);

  // Billing summary — the Billing Register's exact derivation.
  const bill = (Array.isArray(customer.bills) ? customer.bills : [])
    .find((row) => row && row.month === certMonth) ?? null;
  const allocations = calculatePaymentAllocations(state);
  const status = derivedBillStatus(customer, bill, allocations);
  const summary = allocations?.forMonth?.(customer.id, certMonth) ?? null;
  const billFound = Boolean(bill) && status !== 'not-set';
  const billAmountCents = summary?.billAmountCents ?? (bill ? centsOf(bill.dueAmount) : 0);
  const balanceDueCents = summary?.balanceDueCents ?? billAmountCents;
  const paidAmountCents = Math.max(0, billAmountCents - balanceDueCents);

  // Uptime — downtime-analytics.js's own per-customer summary.
  const downtime = buildCustomerDowntimeSummary(
    Array.isArray(complaints) ? complaints : [],
    customer.id,
    certMonth
  );
  const downtimeMinutes = Math.round((Number(downtime.totalDowntime) || 0) * 60);
  const uptimePct = computeMonthlyUptimePct(downtimeMinutes, totalMinutes);

  const areaParts = [text(customer.mohalla), text(customer.zone)].filter(Boolean);
  return {
    customerId: customer.id,
    month: certMonth,
    monthLabel: uptimeCertMonthLabel(certMonth),
    subscriber: {
      name: text(customer.name),
      customerNumber: customer.customerNumber ?? null,
      phone: text(customer.phone),
      address: text(customer.address),
      area: areaParts.join(' · '),
      packageLabel: text(customer.packageSpeed)
    },
    billing: {
      found: billFound,
      status: billFound ? status : 'not-set',
      billAmount: rupeesOf(billAmountCents),
      paidAmount: rupeesOf(paidAmountCents),
      balanceDue: rupeesOf(balanceDueCents)
    },
    payments: lastPaymentsForCertificate(customer, certMonth),
    uptime: {
      totalMinutes,
      downtimeHours: Number(downtime.totalDowntime) || 0,
      downtimeMinutes,
      downtimeText: formatDowntimeHours(downtime.totalDowntime),
      entries: downtime.complaintCount,
      primaryIssueTag: downtime.primaryIssueTag || '',
      uptimePct,
      uptimePctText: formatUptimePct(uptimePct),
      noDowntimeRecorded: downtimeMinutes <= 0
    }
  };
}

function statusLabelBi(status) {
  if (status === 'paid') return bi('upcert_status_paid');
  if (status === 'partial') return bi('upcert_status_partial');
  return bi('upcert_status_unpaid');
}

/**
 * Generates the printable Monthly Invoice & Service Uptime Certificate
 * (1-page A4). Paper output follows the app's print conventions: a
 * standalone HTML document, black on white. Static labels print
 * bilingually (receipt.js style); recorded data prints as stored.
 * Only recorded subscriber facts print — a field the record does not
 * carry produces no row at all (never a placeholder guess).
 *
 * @param {Object} params
 * @param {Object} params.certificate - Output of buildUptimeCertificate
 * @param {string} [params.lang] - 'en' or 'ur' for prose lines
 * @param {string} [params.generatedDate] - YYYY-MM-DD stamp
 * @returns {string} HTML document string ('' for a null certificate)
 */
export function generateUptimeCertificatePrintHtml({ certificate, lang = null, generatedDate = '' } = {}) {
  if (!certificate) return '';
  const sub = certificate.subscriber || {};
  const billing = certificate.billing || {};
  const uptime = certificate.uptime || {};
  const payments = Array.isArray(certificate.payments) ? certificate.payments : [];

  const subscriberRows = [
    [bi('upcert_subscriber'), sub.name || '—'],
    [bi('upcert_customer_no'), sub.customerNumber !== null && sub.customerNumber !== undefined ? `#${sub.customerNumber}` : '—'],
    sub.phone ? [bi('upcert_phone'), sub.phone] : null,
    sub.address ? [bi('upcert_address'), sub.address] : null,
    sub.area ? [bi('upcert_area'), sub.area] : null,
    sub.packageLabel ? [bi('upcert_package'), sub.packageLabel] : null
  ].filter(Boolean).map(([label, value]) => `
        <tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');

  const billingBody = billing.found ? `
      <table class="kv">
        <tr><th>${escapeHtml(bi('upcert_bill_amount'))}</th><td class="amt">${formatPKR(billing.billAmount || 0)}</td></tr>
        <tr><th>${escapeHtml(bi('upcert_paid_amount'))}</th><td class="amt">${formatPKR(billing.paidAmount || 0)}</td></tr>
        <tr><th>${escapeHtml(bi('upcert_balance'))}</th><td class="amt">${formatPKR(billing.balanceDue || 0)}</td></tr>
        <tr><th>${escapeHtml(bi('upcert_bill_status'))}</th><td>${escapeHtml(statusLabelBi(billing.status))}</td></tr>
      </table>` : `
      <p class="note-line">${escapeHtml(t('upcert_no_bill', lang))}</p>`;

  const paymentRows = payments.map((row) => `
        <tr>
          <td class="date">${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.receiptRef || '—')}</td>
          <td>${escapeHtml(row.method || '—')}</td>
          <td class="amt">${formatPKR(row.amount)}</td>
        </tr>`).join('');
  const paymentsBody = payments.length ? `
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(bi('upcert_col_date'))}</th>
            <th>${escapeHtml(bi('upcert_col_receipt'))}</th>
            <th>${escapeHtml(bi('upcert_col_method'))}</th>
            <th class="amt">${escapeHtml(bi('upcert_col_amount'))}</th>
          </tr>
        </thead>
        <tbody>${paymentRows}
        </tbody>
      </table>` : `
      <p class="note-line">${escapeHtml(t('upcert_no_payments', lang))}</p>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(t('upcert_sheet_title', 'en'))} — ${escapeHtml(certificate.month || '')}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; font-size: 12px; line-height: 1.45; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
        .brand { font-size: 19px; font-weight: 800; }
        .title { font-size: 14px; font-weight: 700; }
        .title-ur { font-size: 13px; }
        .meta { font-size: 11px; text-align: right; }
        h3.section { font-size: 13px; margin: 14px 0 6px; border-bottom: 1px solid #999; padding-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #eee; font-size: 11px; }
        table.kv th { width: 34%; }
        td.amt, th.amt { text-align: right; white-space: nowrap; }
        td.date { white-space: nowrap; }
        .uptime-box { border: 2px solid #000; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .uptime-big { font-size: 30px; font-weight: 800; white-space: nowrap; }
        .uptime-facts { font-size: 12px; text-align: right; }
        .note-line { margin: 4px 0; }
        .basis { margin-top: 10px; font-size: 10.5px; color: #333; }
        .signatures { display: flex; justify-content: space-between; margin-top: 36px; font-size: 11px; gap: 18px; }
        .sig { flex: 1; text-align: center; }
        .sig .line { border-top: 1px solid #000; margin-bottom: 4px; height: 28px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">SHAHDARA FIBER NET</div>
          <div class="title">${escapeHtml(t('upcert_sheet_title', 'en'))}</div>
          <div class="title-ur">${escapeHtml(t('upcert_sheet_title', 'ur'))}</div>
          <div>${escapeHtml(certificate.monthLabel || '')} · ${escapeHtml(certificate.month || '')}</div>
        </div>
        <div class="meta">
          <div>${escapeHtml(t('upcert_generated_on', lang, { date: generatedDate || '—' }))}</div>
        </div>
      </div>
      <h3 class="section">${escapeHtml(bi('upcert_subscriber_heading'))}</h3>
      <table class="kv">
        ${subscriberRows}
      </table>
      <h3 class="section">${escapeHtml(bi('upcert_billing_heading'))}</h3>
      ${billingBody}
      <h3 class="section">${escapeHtml(bi('upcert_payments_heading'))}</h3>
      ${paymentsBody}
      <h3 class="section">${escapeHtml(bi('upcert_uptime_heading'))}</h3>
      <div class="uptime-box">
        <div>
          <div>${escapeHtml(bi('upcert_uptime_label'))}</div>
          <div class="uptime-big">${escapeHtml(uptime.uptimePctText || '—')}</div>
          ${uptime.noDowntimeRecorded ? `<div>${escapeHtml(t('upcert_no_downtime', lang))}</div>` : ''}
        </div>
        <div class="uptime-facts">
          <div>${escapeHtml(bi('upcert_downtime_label'))}: <strong>${escapeHtml(uptime.downtimeText || '0 h')}</strong></div>
          <div>${escapeHtml(bi('upcert_entries_label'))}: <strong>${escapeHtml(String(uptime.entries || 0))}</strong></div>
          ${uptime.primaryIssueTag ? `<div>${escapeHtml(bi('upcert_main_issue_label'))}: <strong>${escapeHtml(uptime.primaryIssueTag)}</strong></div>` : ''}
        </div>
      </div>
      <p class="basis">${escapeHtml(t('upcert_basis_note', 'en'))}</p>
      <p class="basis">${escapeHtml(t('upcert_basis_note', 'ur'))}</p>
      <div class="signatures">
        <div class="sig"><div class="line"></div>${escapeHtml(bi('upcert_sign_subscriber'))}</div>
        <div class="sig"><div class="line"></div>${escapeHtml(bi('upcert_sign_authorized'))}</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Controller for the Uptime Certificate dialog (opened from a customer
 * profile). Mirrors setupExpenseVoucherDialog's wiring style: returns
 * null when there is no DOM or no dialog markup. Generating or
 * printing the certificate never writes any record.
 *
 * @param {Object|Function} getState - State object or () => state
 * @param {Object} [options]
 * @param {Function} [options.getComplaints] - () => raw complaint
 *   register rows (defaults to loadComplaints())
 * @param {Function} [options.onToast]
 * @returns {Object|null} Controller { open, close, refresh, getCertificate }
 */
export function setupUptimeCertificateDialog(getState, { getComplaints = null, onToast = null } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('uptimeCertificateDialog');
  if (!dialog) return null;

  const readState = () => (typeof getState === 'function' ? getState() : getState);
  const readComplaints = () => {
    try {
      const value = typeof getComplaints === 'function' ? getComplaints() : getComplaints;
      return Array.isArray(value) ? value : loadComplaints();
    } catch {
      return [];
    }
  };
  const closeBtn = document.getElementById('uptimeCertificateCloseBtn');
  const closeSecondaryBtn = document.getElementById('uptimeCertificateCloseBtn2');
  const monthInput = document.getElementById('uptimeCertificateMonthInput');
  const customerLine = document.getElementById('uptimeCertificateCustomerLine');
  const preview = document.getElementById('uptimeCertificatePreview');
  const printBtn = document.getElementById('uptimeCertificatePrintBtn');

  let currentCustomerId = null;
  let currentCertificate = null;

  const render = () => {
    const state = readState();
    if (currentCustomerId === null || currentCustomerId === undefined) {
      currentCertificate = null;
      if (preview) preview.textContent = t('upcert_preview_pick');
      return currentCertificate;
    }
    const month = monthInput && MONTH_RE.test(String(monthInput.value || ''))
      ? String(monthInput.value)
      : pakistanMonthNow();
    currentCertificate = buildUptimeCertificate(state, readComplaints(), currentCustomerId, { month });
    const customer = (Array.isArray(state?.customers) ? state.customers : [])
      .find((c) => c && String(c.id) === String(currentCustomerId)) ?? null;
    if (customerLine) {
      customerLine.textContent = customer
        ? `${customer.name || ''}${customer.customerNumber !== null && customer.customerNumber !== undefined ? ` · #${customer.customerNumber}` : ''}`
        : '';
    }
    if (preview) {
      if (!currentCertificate) {
        preview.textContent = t('upcert_preview_pick');
      } else {
        const billPart = currentCertificate.billing.found
          ? `${t('upcert_bill_amount')}: ${formatPKR(currentCertificate.billing.billAmount)} · ${t('upcert_balance')}: ${formatPKR(currentCertificate.billing.balanceDue)}`
          : t('upcert_no_bill');
        preview.textContent = `${t('upcert_uptime_label')}: ${currentCertificate.uptime.uptimePctText} · ${t('upcert_downtime_label')}: ${currentCertificate.uptime.downtimeText} · ${billPart}`;
      }
    }
    return currentCertificate;
  };

  const print = () => {
    if (!currentCertificate) render();
    if (!currentCertificate) {
      if (typeof onToast === 'function') onToast(t('upcert_preview_pick'));
      return;
    }
    const generatedDate = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const html = generateUptimeCertificatePrintHtml({ certificate: currentCertificate, generatedDate });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } else if (typeof onToast === 'function') {
      onToast(t('upcert_popup_blocked'));
    }
  };

  if (closeBtn) closeBtn.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });
  if (monthInput) monthInput.addEventListener('change', render);
  if (printBtn) printBtn.addEventListener('click', print);

  return {
    open: (customerId, month) => {
      currentCustomerId = customerId ?? null;
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      if (monthInput) {
        monthInput.value = MONTH_RE.test(String(month || '')) ? String(month) : pakistanMonthNow();
        const earliest = monthsForHistory(new Date())[11] || '';
        if (earliest) monthInput.min = earliest;
      }
      render();
      if (month && monthInput && MONTH_RE.test(String(month))) {
        monthInput.value = String(month);
        render();
      }
    },
    close: () => { dialog.close?.() || (dialog.hidden = true); },
    refresh: render,
    getCertificate: () => currentCertificate
  };
}

export { escapeHtml };
