/**
 * owner-report-pack.js — Plan R: Owner reporting pack.
 *
 * COMPOSITION ONLY. This module computes NOTHING new. It assembles one
 * dated, exportable monthly pack from the existing analytics builders,
 * each section carried verbatim from its source builder so every figure
 * in the pack traces to its source screen's figure on the same fixture:
 *
 * - Month (collections, billed, outstanding, expenses, cash profit):
 *   buildMonthToMonthComparison(state, previousMonth, month).monthB
 * - Area performance: buildAreaBreakdowns(state, referenceDate) — the
 *   whole object, areas/zones/packages and totals as the source returns
 *   them. Area totals are cumulative priced bills through the source's
 *   own current month, and the pack says so wherever it shows them;
 *   it never re-labels them as pack-month-only figures.
 * - Health: buildBusinessHealthScore(state, referenceDate) — the whole
 *   object, including the PR #688 coverage wording (coverage counts
 *   and openingBasis) carried unchanged.
 * - Insights: buildIspInsights(state, referenceDate) — the whole
 *   object; its lastMonth IS the pack month when the reference date
 *   falls in the following month (the default).
 *
 * Reference date: by default the 5th of the month AFTER the pack
 * month, so the health window (three complete months) ends at the
 * pack month and the insights' last month is the pack month. A caller
 * may pass its own referenceDate; each section then carries its
 * source's own as-of/window, and the pack never rewrites those.
 *
 * The pack is READ-ONLY: buildOwnerReportPack is a pure function of
 * (state, month, options). It writes nothing, stores nothing and
 * mutates no state. The only side effects in this module are the
 * print window and the CSV download the owner explicitly opens from
 * the dialog controller — the same pattern as the Month-End Owner
 * Report (owner-month-report.js).
 */

import { calculatePaymentAllocations } from './core.js';
import {
  buildMonthToMonthComparison,
  buildAreaBreakdowns,
  buildBusinessHealthScore,
  buildIspInsights
} from './owner-insights.js';
import { brandHeaderContentHtml } from './document-branding.js';
import { pakistanMonthNow } from './complaint-register.js';

const MONTH_RE = /^\d{4}-\d{2}$/;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function shiftMonth(month, delta) {
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const index = year * 12 + mon - 1 + delta;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`;
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

function lastDayOfMonth(month) {
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
}

/** Default reference date for a pack month: the 5th of the next month. */
export function packReferenceDate(month) {
  const next = shiftMonth(month, 1);
  const year = Number(next.slice(0, 4));
  const mon = Number(next.slice(5, 7));
  return new Date(Date.UTC(year, mon - 1, 5, 12, 0, 0));
}

/**
 * Pure: builds the monthly owner pack for `month` from the existing
 * analytics builders. An invalid month yields { validMonth: false }
 * (same convention as buildOwnerMonthReport). A month outside the
 * retained 24-month comparison history leaves only the comparison
 * section unavailable — the other sections are still built, and the
 * reason is recorded on the pack instead of throwing.
 * Never mutates its inputs.
 */
export function buildOwnerReportPack(state, month, options = {}) {
  const validMonth = MONTH_RE.test(String(month || '')) ? String(month) : '';
  if (!validMonth) {
    return {
      validMonth: false, month: String(month || ''), previousMonth: '',
      generatedOn: '', dateRange: null, monthFacts: null, areas: null,
      health: null, insights: null, comparisonAvailable: false,
      comparisonUnavailableReason: 'No month selected.',
      sources: []
    };
  }
  const referenceDate = options.referenceDate instanceof Date
    ? options.referenceDate
    : packReferenceDate(validMonth);
  const allocations = options.allocations ?? calculatePaymentAllocations(state);
  const previousMonth = shiftMonth(validMonth, -1);

  let comparison = null;
  let comparisonUnavailableReason = '';
  try {
    comparison = buildMonthToMonthComparison(state, previousMonth, validMonth, referenceDate, allocations);
  } catch (error) {
    comparisonUnavailableReason = error?.message ?? 'Comparison unavailable.';
  }

  const areas = buildAreaBreakdowns(state, referenceDate, allocations);
  const health = buildBusinessHealthScore(state, referenceDate, allocations);
  const insights = buildIspInsights(state, referenceDate, allocations);

  return {
    validMonth: true,
    month: validMonth,
    previousMonth,
    generatedOn: referenceDate.toISOString().slice(0, 10),
    dateRange: { start: `${validMonth}-01`, end: `${validMonth}-${String(lastDayOfMonth(validMonth)).padStart(2, '0')}` },
    monthFacts: comparison ? comparison.monthB : null,
    previousMonthFacts: comparison ? comparison.monthA : null,
    changes: comparison ? comparison.changes : null,
    comparisonAvailable: comparison !== null,
    comparisonUnavailableReason,
    areas,
    health,
    insights,
    sources: [
      { section: 'month', builder: 'buildMonthToMonthComparison', note: 'Pack-month facts are comparison.monthB, verbatim.' },
      { section: 'areas', builder: 'buildAreaBreakdowns', note: `Cumulative priced bills through ${areas.currentMonth}; totals are the source totals.` },
      { section: 'health', builder: 'buildBusinessHealthScore', note: `Window ${health.window.startMonth}–${health.window.endMonth}; coverage wording carried unchanged.` },
      { section: 'insights', builder: 'buildIspInsights', note: `Collection last month is the pack month (${insights.lastMonth}); trend months are the source months.` }
    ]
  };
}

const money = (value) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Not available';
  return `PKR ${new Intl.NumberFormat('en-PK').format(Number(value))}`;
};
const num = (value) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? 'Not available' : String(value));
const pct = (value) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? 'Not available' : `${value}%`);
const pair = (label, value) => `<div class="pair"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
const row = (cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`;

/** Printable A4 HTML for a pack. One header, one date range, all sections. */
export function buildOwnerReportPackPrintHtml(pack, { brand = {} } = {}) {
  if (!pack || !pack.validMonth) {
    return '<!doctype html><html><body><p>No month selected.</p></body></html>';
  }
  const facts = pack.monthFacts;
  const areaRows = (pack.areas?.areas ?? []).map((area) => row([
    area.name, area.customers, money(area.billed), money(area.collected),
    money(area.outstanding), pct(area.collectionRate), area.overdueBills
  ])).join('');
  const factorRows = (pack.health?.factors ?? []).map((factor) => row([
    factor.label, pct(factor.value), pct(factor.quality), factor.available ? 'Available' : 'Not available'
  ])).join('');
  const trendRows = (pack.insights?.overdueTrend ?? []).map((trend) => row([
    trend.month, money(trend.outstanding)
  ])).join('');
  const coverage = pack.health?.coverage;
  const coverageLine = coverage
    ? `${coverage.pricedBillCount} priced bill(s) and ${coverage.receiptCount} receipt(s) in the health window; ${coverage.datedProfiles} of ${coverage.totalProfiles} profile(s) dated${coverage.datedSubsetUsed ? `; dated subset used, ${coverage.undatedProfiles} undated profile(s) excluded from the dated factors, not counted as zero and not counted as added` : '.'}`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Owner Report Pack — ${escapeHtml(monthLabel(pack.month))}</title><style>
    body{font-family:system-ui,Arial,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}
    h1{font-size:20px}h2{font-size:16px;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}
    table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 4px;border-bottom:1px solid #eee}td:last-child,th:last-child{text-align:right}
    .pair{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}
    .foot{color:#555;font-size:12px;margin-top:24px}
  </style></head><body>
  ${brandHeaderContentHtml(brand, { variant: 'a4', titleEn: 'Owner Report Pack', titleUr: 'مالک رپورٹ پیک', documentNumber: pack.month, documentNumberLabel: 'Month:' })}
  <p><strong>${escapeHtml(monthLabel(pack.month))}</strong> · ${escapeHtml(pack.dateRange.start)} to ${escapeHtml(pack.dateRange.end)} · Generated ${escapeHtml(pack.generatedOn)}</p>
  <h2>Month — collections</h2>
  ${facts ? `${pair('Billed', money(facts.billedAmount))}${pair('Collected', money(facts.collection))}${pair('Collection rate', pct(facts.collectionRate))}${pair('Outstanding', money(facts.outstanding))}${pair('Expenses', money(facts.expenses))}${pair('Cash profit', money(facts.cashProfit))}${pair('Priced bills', num(facts.pricedBillCount))}${pair('Receipts', num(facts.collectionReceiptCount))}<p class="foot">Source: month comparison, ${escapeHtml(facts.source ?? '')}.</p>` : `<p>Comparison unavailable: ${escapeHtml(pack.comparisonUnavailableReason)}</p>`}
  <h2>Area performance</h2>
  <p class="foot">Cumulative priced bills through ${escapeHtml(pack.areas?.currentMonth ?? '')}; totals are the area screen's totals.</p>
  ${areaRows ? `<table><tr><th>Area</th><th>Customers</th><th>Billed</th><th>Collected</th><th>Outstanding</th><th>Rate</th><th>Overdue bills</th></tr>${areaRows}</table>` : '<p>No priced bills are recorded yet.</p>'}
  ${pair('Area totals — billed', money(pack.areas?.totals?.billed))}${pair('Area totals — collected', money(pack.areas?.totals?.collected))}${pair('Area totals — outstanding', money(pack.areas?.totals?.outstanding))}${pair('Area totals — overdue bills', num(pack.areas?.totals?.overdueBills))}
  <h2>Business health</h2>
  ${pair('Health score', pack.health?.score === null || pack.health?.score === undefined ? 'Not available' : String(pack.health.score))}${pair('Category', pack.health?.category ?? 'Not available')}
  ${factorRows ? `<table><tr><th>Factor</th><th>Value</th><th>Quality</th><th>Status</th></tr>${factorRows}</table>` : ''}
  ${pack.health?.openingBasis ? `<p class="foot">${escapeHtml(pack.health.openingBasis)}</p>` : ''}
  ${coverageLine ? `<p class="foot">${escapeHtml(coverageLine)}</p>` : ''}
  <h2>Insights — collection trend</h2>
  ${pair('Collection, pack month', pack.insights?.collection?.lastMonth ? `${money(pack.insights.collection.lastMonth.collected ?? pack.insights.collection.lastMonth.billed)} · rate ${pct(pack.insights.collection.lastMonth.rate)}` : 'Not available')}
  ${pair('Collection, following month', pack.insights?.collection?.thisMonth ? `${money(pack.insights.collection.thisMonth.collected ?? pack.insights.collection.thisMonth.billed)} · rate ${pct(pack.insights.collection.thisMonth.rate)}` : 'Not available')}
  ${pair('Change (points)', pack.insights?.collection?.deltaPoints === null || pack.insights?.collection?.deltaPoints === undefined ? 'Not available' : String(pack.insights.collection.deltaPoints))}
  ${trendRows ? `<table><tr><th>Month</th><th>Outstanding</th></tr>${trendRows}</table>` : ''}
  <p class="foot">This pack only assembles existing reports; it changes no record. Sources: month comparison, area breakdowns, business health score, ISP insights.</p>
  </body></html>`;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function csvRow(section, metric, value, source) {
  return [section, metric, value, source].map(csvCell).join(',');
}

/**
 * CSV export for a pack: one row per figure, nulls kept blank (never
 * written as zero), every row naming its source builder.
 */
export function buildOwnerReportPackCsv(pack) {
  if (!pack || !pack.validMonth) return 'section,metric,value,source\n';
  const lines = ['section,metric,value,source'];
  const facts = pack.monthFacts;
  if (facts) {
    lines.push(csvRow('month', 'billed_amount', facts.billedAmount, 'buildMonthToMonthComparison'));
    lines.push(csvRow('month', 'collection', facts.collection, 'buildMonthToMonthComparison'));
    lines.push(csvRow('month', 'collection_rate_pct', facts.collectionRate, 'buildMonthToMonthComparison'));
    lines.push(csvRow('month', 'outstanding', facts.outstanding, 'buildMonthToMonthComparison'));
    lines.push(csvRow('month', 'expenses', facts.expenses, 'buildMonthToMonthComparison'));
    lines.push(csvRow('month', 'cash_profit', facts.cashProfit, 'buildMonthToMonthComparison'));
    lines.push(csvRow('month', 'priced_bill_count', facts.pricedBillCount, 'buildMonthToMonthComparison'));
    lines.push(csvRow('month', 'collection_receipt_count', facts.collectionReceiptCount, 'buildMonthToMonthComparison'));
  }
  if (pack.areas?.totals) {
    lines.push(csvRow('areas', 'total_billed', pack.areas.totals.billed, 'buildAreaBreakdowns'));
    lines.push(csvRow('areas', 'total_collected', pack.areas.totals.collected, 'buildAreaBreakdowns'));
    lines.push(csvRow('areas', 'total_outstanding', pack.areas.totals.outstanding, 'buildAreaBreakdowns'));
    lines.push(csvRow('areas', 'total_overdue_bills', pack.areas.totals.overdueBills, 'buildAreaBreakdowns'));
  }
  for (const area of pack.areas?.areas ?? []) {
    lines.push(csvRow(`area:${area.name}`, 'billed', area.billed, 'buildAreaBreakdowns'));
    lines.push(csvRow(`area:${area.name}`, 'collected', area.collected, 'buildAreaBreakdowns'));
    lines.push(csvRow(`area:${area.name}`, 'outstanding', area.outstanding, 'buildAreaBreakdowns'));
    lines.push(csvRow(`area:${area.name}`, 'customers', area.customers, 'buildAreaBreakdowns'));
    lines.push(csvRow(`area:${area.name}`, 'collection_rate_pct', area.collectionRate, 'buildAreaBreakdowns'));
    lines.push(csvRow(`area:${area.name}`, 'overdue_bills', area.overdueBills, 'buildAreaBreakdowns'));
  }
  if (pack.health) {
    lines.push(csvRow('health', 'score', pack.health.score, 'buildBusinessHealthScore'));
    lines.push(csvRow('health', 'category', pack.health.category, 'buildBusinessHealthScore'));
    lines.push(csvRow('health', 'available_factor_count', pack.health.availableFactorCount, 'buildBusinessHealthScore'));
    lines.push(csvRow('health', 'total_factor_count', pack.health.totalFactorCount, 'buildBusinessHealthScore'));
    for (const factor of pack.health.factors ?? []) {
      lines.push(csvRow(`health_factor:${factor.id}`, 'value', factor.value, 'buildBusinessHealthScore'));
      lines.push(csvRow(`health_factor:${factor.id}`, 'quality', factor.quality, 'buildBusinessHealthScore'));
    }
  }
  if (pack.insights?.collection) {
    lines.push(csvRow('insights', 'collection_last_month_rate_pct', pack.insights.collection.lastMonth?.rate ?? null, 'buildIspInsights'));
    lines.push(csvRow('insights', 'collection_this_month_rate_pct', pack.insights.collection.thisMonth?.rate ?? null, 'buildIspInsights'));
    lines.push(csvRow('insights', 'collection_delta_points', pack.insights.collection.deltaPoints, 'buildIspInsights'));
  }
  for (const trend of pack.insights?.overdueTrend ?? []) {
    lines.push(csvRow(`overdue_trend:${trend.month}`, 'outstanding', trend.outstanding, 'buildIspInsights'));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Dialog controller for the Owner Report Pack. The entry button lives
 * in the Analytics view heading (index.html); the pack opens in its
 * own dialog for the month selected there. Returns
 * { open, refresh, close, getPack } or null when the dialog is
 * absent (e.g. unit-test DOM). Following the Month-End Owner Report
 * controller pattern.
 */
export function setupOwnerReportPack(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('ownerReportPackModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const openBtn = typeof document !== 'undefined' ? document.getElementById('ownerReportPackBtn') : null;
  let month = shiftMonth(pakistanMonthNow(), -1);
  let lastPack = null;

  function currentPack() {
    return buildOwnerReportPack(getState(), month);
  }

  function render() {
    const pack = currentPack();
    lastPack = pack;
    const summaryEl = $('ownerReportPackSummary');
    if (summaryEl) {
      summaryEl.textContent = !pack.validMonth
        ? ''
        : pack.monthFacts
          ? `${monthLabel(pack.month)} · Billed ${money(pack.monthFacts.billedAmount)} · Collected ${money(pack.monthFacts.collection)} · Outstanding ${money(pack.monthFacts.outstanding)} · Health ${pack.health?.score ?? 'not available'}`
          : `${monthLabel(pack.month)} · ${pack.comparisonUnavailableReason}`;
    }
    const bodyEl = $('ownerReportPackBody');
    if (bodyEl) {
      const facts = pack.monthFacts;
      const areaLines = (pack.areas?.areas ?? []).map((area) =>
        `<p><span>${escapeHtml(area.name)}</span><strong>${escapeHtml(money(area.outstanding))} outstanding</strong><small> · billed ${escapeHtml(money(area.billed))} · collected ${escapeHtml(money(area.collected))}</small></p>`).join('');
      const factorLines = (pack.health?.factors ?? []).map((factor) =>
        `<p><span>${escapeHtml(factor.label)}</span><strong>${escapeHtml(pct(factor.quality))}</strong></p>`).join('');
      bodyEl.innerHTML = `
        <article class="owner-month-report-section"><h3>Month — collections</h3>
          ${facts ? `<p><span>Billed</span><strong>${escapeHtml(money(facts.billedAmount))}</strong></p><p><span>Collected</span><strong>${escapeHtml(money(facts.collection))}</strong></p><p><span>Outstanding</span><strong>${escapeHtml(money(facts.outstanding))}</strong></p><p><span>Cash profit</span><strong>${escapeHtml(money(facts.cashProfit))}</strong></p>` : `<p><span>${escapeHtml(pack.comparisonUnavailableReason)}</span></p>`}
        </article>
        <article class="owner-month-report-section"><h3>Area performance</h3>
          ${areaLines || '<p><span>No priced bills are recorded yet.</span></p>'}
        </article>
        <article class="owner-month-report-section"><h3>Business health</h3>
          <p><span>Score</span><strong>${escapeHtml(pack.health?.score ?? 'Not available')}</strong></p>
          <p><span>Category</span><strong>${escapeHtml(pack.health?.category ?? 'Not available')}</strong></p>
          ${factorLines}
          ${pack.health?.openingBasis ? `<p class="owner-month-report-footnote">${escapeHtml(pack.health.openingBasis)}</p>` : ''}
        </article>
        <p class="owner-month-report-footnote">This pack only assembles existing reports; it changes no record. Sources: month comparison, area breakdowns, business health score, ISP insights.</p>`;
    }
    return pack;
  }

  function open() {
    const monthInput = $('ownerReportPackMonth');
    if (monthInput) monthInput.value = month;
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.hidden = false;
    render();
  }

  const monthInput = $('ownerReportPackMonth');
  if (monthInput) {
    monthInput.value = month;
    monthInput.addEventListener('change', () => {
      month = monthInput.value || shiftMonth(pakistanMonthNow(), -1);
      render();
    });
  }
  if (openBtn) openBtn.addEventListener('click', open);
  const printBtn = $('ownerReportPackPrintBtn');
  if (printBtn) printBtn.addEventListener('click', () => {
    const pack = lastPack ?? render();
    if (!pack || !pack.validMonth) return;
    const html = buildOwnerReportPackPrintHtml(pack);
    const printWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!printWindow) {
      if (onToast) onToast('Print window was blocked by the browser.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  });
  const csvBtn = $('ownerReportPackCsvBtn');
  if (csvBtn) csvBtn.addEventListener('click', () => {
    const pack = lastPack ?? render();
    if (!pack || !pack.validMonth) return;
    const csv = buildOwnerReportPackCsv(pack);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `owner-report-pack-${pack.month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
  const close = () => { if (typeof dialog.close === 'function' && dialog.open) dialog.close(); else dialog.hidden = true; };
  const closeBtn = $('ownerReportPackCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', close);
  const closeBtn2 = $('ownerReportPackCloseBtn2');
  if (closeBtn2) closeBtn2.addEventListener('click', close);

  return { open, refresh: render, close, getPack: () => lastPack };
}
