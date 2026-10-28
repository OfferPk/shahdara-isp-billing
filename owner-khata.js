/**
 * owner-khata.js — SISP-20
 * Monthly Owner Khata Closing Report (Income + Expenses + Outages Archive).
 *
 * One permanent monthly archive view combining financials and network
 * reliability for any selected YYYY-MM month. Every figure is REUSED from
 * an existing computation — nothing is recomputed in a parallel path:
 *
 * - Total Bills Collected, Expenses, Net Profit, Partner Shares:
 *   buildPartnerShareReport (phase3.js). Revenue is actual saved receipts
 *   grouped by payment date; share = 50% of positive monthly profit, else 0
 *   (PARTNER_SHARE_RATE = 0.5, one share each for Nasir and Aqib).
 * - Pending Arrears: outstandingAtMonthEnd (phase3.js) — FIFO from the FULL
 *   bill list, payments counted only through the month-end cutoff.
 * - Shop Cash Settled: SISP-1 settlement records (shop-settlement.js),
 *   summed by settlement date within the month.
 * - Complaints + Offline Hours: buildMonthlyDowntimeAnalytics
 *   (downtime-analytics.js) over the SISP-15 complaint register.
 * - Saved monthly closing snapshot (core.js saveMonthlyClosing): shown when
 *   one exists for the month; the report never creates or alters it.
 *
 * The report is READ-ONLY: buildOwnerKhataReport is a pure function of
 * (state, month, inputs). Same inputs always yield the same numbers, and
 * building a report never writes bills, payments, expenses, customers, or
 * snapshots. The only write in this feature is the owner's explicit Save
 * Note action, which stores plain text under
 * monthly-closing-notes.js — never ledger data.
 *
 * "NayaPay Bandwidth + Field Expenses" is a keyword-matched subtotal over
 * the partner report's own category breakdown (category names containing
 * nayapay, bandwidth, upstream, or field, case-insensitive). It is labeled
 * as such wherever shown; no category list is hardcoded into the totals.
 * The full category breakdown is always shown alongside it, so nothing is
 * hidden behind the keyword match.
 */

import { buildPartnerShareReport, outstandingAtMonthEnd } from './phase3.js';
import { buildMonthlyDowntimeAnalytics } from './downtime-analytics.js';
import { loadComplaints, pakistanMonthNow } from './complaint-register.js';
import { loadShopSettlements } from './shop-settlement.js';
import {
  getMonthlyClosingNote,
  loadMonthlyClosingNotes,
  saveMonthlyClosingNotes,
  setMonthlyClosingNote
} from './monthly-closing-notes.js';

const MONTH_RE = /^\d{4}-\d{2}$/;
const BANDWIDTH_FIELD_RE = /nayapay|bandwidth|upstream|field/i;

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPKR(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 'Rs. 0';
  return `Rs. ${Math.round(n).toLocaleString('en-PK')}`;
}

function wholeRupees(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function monthLabel(month) {
  if (!MONTH_RE.test(String(month || ''))) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${month}-01T00:00:00Z`));
  } catch {
    return String(month);
  }
}

/**
 * Pure: builds the closing report for `month` from ledger state + side
 * inputs. An invalid month yields a zeroed report for '' (same convention
 * as buildMonthlyDowntimeAnalytics). Never mutates its inputs.
 */
export function buildOwnerKhataReport(state, month, inputs = {}) {
  const validMonth = MONTH_RE.test(String(month || '')) ? String(month) : '';
  const complaints = Array.isArray(inputs.complaints) ? inputs.complaints : [];
  const settlements = Array.isArray(inputs.settlements) ? inputs.settlements : [];
  const notes = inputs.notes && typeof inputs.notes === 'object' ? inputs.notes : {};
  const savedSnapshot = inputs.savedSnapshot && typeof inputs.savedSnapshot === 'object'
    ? inputs.savedSnapshot
    : null;
  const referenceDate = inputs.referenceDate instanceof Date ? inputs.referenceDate : new Date();

  if (!validMonth) {
    return {
      month: '', validMonth: false, collected: 0, receiptCount: 0,
      pendingArrears: 0, arrearsBillCount: 0, arrearsCutoff: '', arrearsPartial: false,
      shopSettled: 0, shopSettledCount: 0, shopSettledByShop: [],
      expenses: 0, expenseCount: 0, expenseCategories: [], bandwidthFieldExpenses: 0,
      profit: 0, isLoss: false, nasirShare: 0, aqibShare: 0,
      totalComplaints: 0, totalDowntime: 0, areaOutageComplaints: 0, areaOutageDowntime: 0,
      topCauses: [], savedSnapshot: null, note: ''
    };
  }

  // Financials — reused verbatim from the partner share report.
  const partner = buildPartnerShareReport(state, validMonth, referenceDate);
  const summary = partner.summary || {};
  const expenseCategories = Array.isArray(summary.categoryBreakdown) ? summary.categoryBreakdown : [];
  const bandwidthFieldExpenses = expenseCategories
    .filter((row) => BANDWIDTH_FIELD_RE.test(String(row.category || '')))
    .reduce((sum, row) => sum + wholeRupees(row.amount), 0);

  // Arrears — reused verbatim from the month-end outstanding computation.
  const arrears = outstandingAtMonthEnd(state, validMonth, referenceDate);

  // Shop cash settled in this month — SISP-1 settlement records by date.
  const monthSettlements = settlements.filter((record) =>
    record && typeof record === 'object' &&
    typeof record.date === 'string' && record.date.slice(0, 7) === validMonth &&
    Number.isFinite(Number(record.amount)) && Number(record.amount) > 0);
  const shopMap = new Map();
  for (const record of monthSettlements) {
    const shop = String(record.shop || 'Unknown shop');
    const entry = shopMap.get(shop) ?? { shop, amount: 0, count: 0 };
    entry.amount += wholeRupees(record.amount);
    entry.count += 1;
    shopMap.set(shop, entry);
  }
  const shopSettledByShop = [...shopMap.values()].sort((a, b) => b.amount - a.amount);

  // Network reliability — reused verbatim from the downtime analytics.
  const network = buildMonthlyDowntimeAnalytics(complaints, validMonth);

  return {
    month: validMonth,
    validMonth: true,
    collected: wholeRupees(summary.revenue),
    receiptCount: Number(summary.receiptCount || 0),
    pendingArrears: wholeRupees(arrears.total),
    arrearsBillCount: Number(arrears.billCount || 0),
    arrearsCutoff: String(arrears.cutoff || ''),
    arrearsPartial: arrears.partial === true,
    shopSettled: monthSettlements.reduce((sum, record) => sum + wholeRupees(record.amount), 0),
    shopSettledCount: monthSettlements.length,
    shopSettledByShop,
    expenses: wholeRupees(summary.expenses),
    expenseCount: Number(summary.expenseCount || 0),
    expenseCategories,
    bandwidthFieldExpenses,
    profit: wholeRupees(summary.profit),
    isLoss: summary.isLoss === true,
    nasirShare: wholeRupees(summary.share),
    aqibShare: wholeRupees(summary.share),
    totalComplaints: Number(network.totalComplaints || 0),
    totalDowntime: Number(network.totalDowntime || 0),
    areaOutageComplaints: Number(network.areaOutageComplaints || 0),
    areaOutageDowntime: Number(network.areaOutageDowntime || 0),
    topCauses: (Array.isArray(network.byCause) ? network.byCause : [])
      .filter((row) => Number(row.incidents || 0) > 0)
      .map((row) => ({ category: row.category, incidents: row.incidents, totalDowntime: row.totalDowntime })),
    savedSnapshot: savedSnapshot && savedSnapshot.month === validMonth
      ? {
          savedAt: String(savedSnapshot.savedAt || ''),
          collection: wholeRupees(savedSnapshot.collection),
          pending: wholeRupees(savedSnapshot.pending),
          profit: wholeRupees(savedSnapshot.profit)
        }
      : null,
    note: getMonthlyClosingNote(notes, validMonth)
  };
}

/** Roman Urdu one-page summary for WhatsApp copy. Pure. */
export function buildOwnerKhataWhatsAppText(report) {
  if (!report || !report.validMonth) return 'Owner Khata Closing: koi mahina muntakhib nahi.';
  const lines = [
    `📕 Owner Khata Closing — ${monthLabel(report.month)}`,
    `Total Bills Collected: ${formatPKR(report.collected)} (${report.receiptCount} receipts)`,
    `Pending Arrears: ${formatPKR(report.pendingArrears)}`,
    `Shop Cash Settled: ${formatPKR(report.shopSettled)} (${report.shopSettledCount} handovers)`,
    `Expenses: ${formatPKR(report.expenses)} (${report.expenseCount} entries)`,
    `NayaPay Bandwidth + Field Expenses: ${formatPKR(report.bandwidthFieldExpenses)}`,
    `Net Profit: ${formatPKR(report.profit)}${report.isLoss ? ' (loss)' : ''}`,
    `Nasir share (50%): ${formatPKR(report.nasirShare)} · Aqib share (50%): ${formatPKR(report.aqibShare)}`,
    `Complaints: ${report.totalComplaints} · Network Offline: ${report.totalDowntime} h (zone-wide: ${report.areaOutageComplaints} faults, ${report.areaOutageDowntime} h)`,
  ];
  if (report.note) lines.push(`Owner note: ${report.note}`);
  lines.push('Ye report sirf khulasa hai — is se koi bill, payment ya khata tabdeel nahi hota.');
  return lines.join('\n');
}

/** Standalone single-page printable report HTML. Pure. */
export function buildOwnerKhataPrintHtml(report) {
  if (!report || !report.validMonth) {
    return '<!doctype html><html><body><p>No month selected.</p></body></html>';
  }
  const categoryRows = report.expenseCategories.map((row) =>
    `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(String(row.count))}</td><td>${escapeHtml(formatPKR(row.amount))}</td></tr>`).join('');
  const shopRows = report.shopSettledByShop.map((row) =>
    `<tr><td>${escapeHtml(row.shop)}</td><td>${escapeHtml(String(row.count))}</td><td>${escapeHtml(formatPKR(row.amount))}</td></tr>`).join('');
  const causeRows = report.topCauses.map((row) =>
    `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(String(row.incidents))}</td><td>${escapeHtml(String(row.totalDowntime))} h</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Owner Khata Closing — ${escapeHtml(monthLabel(report.month))}</title><style>
    body{font-family:system-ui,Arial,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}
    h1{font-size:20px}h2{font-size:16px;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}
    table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 4px;border-bottom:1px solid #eee}td:last-child,th:last-child{text-align:right}
    .pair{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}.note{background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap}
    .foot{color:#555;font-size:12px;margin-top:24px}
  </style></head><body>
  <h1>📕 Monthly Business &amp; Network Health Report</h1>
  <p><strong>Shahdara ISP</strong> · ${escapeHtml(monthLabel(report.month))}</p>
  <h2>Financials</h2>
  <div class="pair"><span>Total Bills Collected (${escapeHtml(String(report.receiptCount))} receipts)</span><strong>${escapeHtml(formatPKR(report.collected))}</strong></div>
  <div class="pair"><span>Pending Arrears${report.arrearsPartial ? ' (month still open)' : ''}</span><strong>${escapeHtml(formatPKR(report.pendingArrears))}</strong></div>
  <div class="pair"><span>Shop Cash Settled (${escapeHtml(String(report.shopSettledCount))} handovers)</span><strong>${escapeHtml(formatPKR(report.shopSettled))}</strong></div>
  <div class="pair"><span>Expenses (${escapeHtml(String(report.expenseCount))} entries)</span><strong>${escapeHtml(formatPKR(report.expenses))}</strong></div>
  <div class="pair"><span>NayaPay Bandwidth + Field Expenses (keyword-matched)</span><strong>${escapeHtml(formatPKR(report.bandwidthFieldExpenses))}</strong></div>
  <div class="pair"><span>Net Profit${report.isLoss ? ' (loss)' : ''}</span><strong>${escapeHtml(formatPKR(report.profit))}</strong></div>
  <div class="pair"><span>Nasir share (50% of positive profit)</span><strong>${escapeHtml(formatPKR(report.nasirShare))}</strong></div>
  <div class="pair"><span>Aqib share (50% of positive profit)</span><strong>${escapeHtml(formatPKR(report.aqibShare))}</strong></div>
  ${shopRows ? `<h2>Shop cash settled by shop</h2><table><tr><th>Shop</th><th>Handovers</th><th>Amount</th></tr>${shopRows}</table>` : ''}
  ${categoryRows ? `<h2>Expenses by category</h2><table><tr><th>Category</th><th>Entries</th><th>Amount</th></tr>${categoryRows}</table>` : ''}
  <h2>Network reliability</h2>
  <div class="pair"><span>Total Complaints</span><strong>${escapeHtml(String(report.totalComplaints))}</strong></div>
  <div class="pair"><span>Total Network Offline Hours</span><strong>${escapeHtml(String(report.totalDowntime))} h</strong></div>
  <div class="pair"><span>Zone-wide faults</span><strong>${escapeHtml(String(report.areaOutageComplaints))} faults · ${escapeHtml(String(report.areaOutageDowntime))} h</strong></div>
  ${causeRows ? `<h2>Outages by cause</h2><table><tr><th>Cause</th><th>Incidents</th><th>Hours</th></tr>${causeRows}</table>` : ''}
  ${report.savedSnapshot ? `<h2>Saved monthly closing</h2><div class="pair"><span>Saved at</span><strong>${escapeHtml(report.savedSnapshot.savedAt)}</strong></div><div class="pair"><span>Saved collection / profit</span><strong>${escapeHtml(formatPKR(report.savedSnapshot.collection))} / ${escapeHtml(formatPKR(report.savedSnapshot.profit))}</strong></div>` : '<h2>Saved monthly closing</h2><p>No saved monthly closing snapshot for this month.</p>'}
  ${report.note ? `<h2>Owner closing note</h2><div class="note">${escapeHtml(report.note)}</div>` : ''}
  <p class="foot">This report only summarizes the ledger — it never changes bills, payments, expenses, or customers. Pending Arrears counts unpaid balances on bills through this month, with payments counted through ${escapeHtml(report.arrearsCutoff || 'month end')}.</p>
  </body></html>`;
}

/**
 * Dashboard-card + modal controller, following the SISP-16 downtime
 * analytics modal pattern. Returns { open, refresh } or null when the
 * dialog is absent (e.g. unit-test DOM).
 */
export function setupOwnerKhataModal(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('ownerKhataModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let month = pakistanMonthNow();

  function currentReport() {
    const state = getState();
    const savedSnapshot = (state.monthlyClosings ?? []).find((row) => row.month === month) ?? null;
    return buildOwnerKhataReport(state, month, {
      complaints: loadComplaints(),
      settlements: loadShopSettlements(),
      notes: loadMonthlyClosingNotes(),
      savedSnapshot
    });
  }

  function render() {
    const report = currentReport();
    const lineEl = $('ownerKhataSummaryLine');
    if (lineEl) {
      lineEl.textContent = !report.validMonth
        ? 'Choose a month to see its closing report.'
        : `Collected ${formatPKR(report.collected)} · Arrears ${formatPKR(report.pendingArrears)} · Expenses ${formatPKR(report.expenses)} · Net profit ${formatPKR(report.profit)} · ${report.totalComplaints} complaints · ${report.totalDowntime} h offline`;
    }
    const bodyEl = $('ownerKhataBody');
    if (bodyEl) {
      const shopLines = report.shopSettledByShop.map((row) =>
        `<p><span>${escapeHtml(row.shop)}</span><strong>${escapeHtml(formatPKR(row.amount))}</strong><small> · ${escapeHtml(String(row.count))} handovers</small></p>`).join('');
      const categoryLines = report.expenseCategories.map((row) =>
        `<p><span>${escapeHtml(row.category)}</span><strong>${escapeHtml(formatPKR(row.amount))}</strong><small> · ${escapeHtml(String(row.count))} entries</small></p>`).join('');
      const causeLines = report.topCauses.map((row) =>
        `<p><span>${escapeHtml(row.category)}</span><strong>${escapeHtml(String(row.incidents))} faults · ${escapeHtml(String(row.totalDowntime))} h</strong></p>`).join('');
      bodyEl.innerHTML = `
        <article class="owner-khata-section"><h3>Financials</h3>
          <p><span>Total Bills Collected</span><strong>${escapeHtml(formatPKR(report.collected))}</strong><small> · ${escapeHtml(String(report.receiptCount))} receipts</small></p>
          <p><span>Pending Arrears</span><strong>${escapeHtml(formatPKR(report.pendingArrears))}</strong><small> · ${escapeHtml(String(report.arrearsBillCount))} bills · through ${escapeHtml(report.arrearsCutoff || 'month end')}${report.arrearsPartial ? ' (month still open)' : ''}</small></p>
          <p><span>Shop Cash Settled</span><strong>${escapeHtml(formatPKR(report.shopSettled))}</strong><small> · ${escapeHtml(String(report.shopSettledCount))} handovers</small></p>
          ${shopLines}
          <p><span>Expenses</span><strong>${escapeHtml(formatPKR(report.expenses))}</strong><small> · ${escapeHtml(String(report.expenseCount))} entries</small></p>
          <p><span>NayaPay Bandwidth + Field Expenses</span><strong>${escapeHtml(formatPKR(report.bandwidthFieldExpenses))}</strong><small> · keyword-matched categories</small></p>
          ${categoryLines}
          <p><span>Net Profit${report.isLoss ? ' (loss)' : ''}</span><strong>${escapeHtml(formatPKR(report.profit))}</strong></p>
          <p><span>Nasir share (50%)</span><strong>${escapeHtml(formatPKR(report.nasirShare))}</strong></p>
          <p><span>Aqib share (50%)</span><strong>${escapeHtml(formatPKR(report.aqibShare))}</strong></p>
        </article>
        <article class="owner-khata-section"><h3>Network reliability</h3>
          <p><span>Total Complaints</span><strong>${escapeHtml(String(report.totalComplaints))}</strong></p>
          <p><span>Total Network Offline Hours</span><strong>${escapeHtml(String(report.totalDowntime))} h</strong></p>
          <p><span>Zone-wide faults</span><strong>${escapeHtml(String(report.areaOutageComplaints))} faults · ${escapeHtml(String(report.areaOutageDowntime))} h</strong></p>
          ${causeLines}
        </article>
        <article class="owner-khata-section"><h3>Saved monthly closing</h3>
          ${report.savedSnapshot
            ? `<p><span>Saved at</span><strong>${escapeHtml(report.savedSnapshot.savedAt)}</strong></p><p><span>Saved collection / profit</span><strong>${escapeHtml(formatPKR(report.savedSnapshot.collection))} / ${escapeHtml(formatPKR(report.savedSnapshot.profit))}</strong></p>`
            : '<p>No saved monthly closing snapshot for this month.</p>'}
        </article>
        <p class="owner-khata-footnote">This report only summarizes the ledger — it never changes bills, payments, expenses, or customers. Same month, same ledger → same numbers.</p>`;
    }
    const noteEl = $('ownerKhataNote');
    if (noteEl) noteEl.value = report.note;
  }

  const monthInput = $('ownerKhataMonth');
  if (monthInput) {
    monthInput.value = month;
    monthInput.addEventListener('change', () => {
      month = monthInput.value || pakistanMonthNow();
      render();
    });
  }
  const saveNoteBtn = $('ownerKhataSaveNoteBtn');
  if (saveNoteBtn) saveNoteBtn.addEventListener('click', () => {
    const noteEl = $('ownerKhataNote');
    const next = setMonthlyClosingNote(loadMonthlyClosingNotes(), month, noteEl ? noteEl.value : '');
    if (saveMonthlyClosingNotes(next)) {
      if (onToast) onToast('Closing note saved for this month.');
      render();
    } else if (onToast) {
      onToast('Closing note could not be saved on this device.');
    }
  });
  const printBtn = $('ownerKhataPrintBtn');
  if (printBtn) printBtn.addEventListener('click', () => {
    const html = buildOwnerKhataPrintHtml(currentReport());
    const printWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!printWindow) {
      if (onToast) onToast('Pop-up blocked — allow pop-ups, then tap Print again.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  });
  const copyBtn = $('ownerKhataCopyBtn');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const text = buildOwnerKhataWhatsAppText(currentReport());
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        if (onToast) onToast('Closing summary copied — paste it into WhatsApp.');
      } else if (onToast) {
        onToast('Copy is not available on this device.');
      }
    } catch {
      if (onToast) onToast('Copy failed — try again.');
    }
  });
  const closeBtn = $('ownerKhataCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openOwnerKhataModalBtn') : null;
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
    refresh() {
      render();
    }
  };
}
