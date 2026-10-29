/**
 * lineman-sheet-print.js — SISP-55 [P2]: Printable Monthly Zone
 * Defaulter Sheet for Field Linemen
 * ("فیلڈ لائن مین بقایا فہرست پرنٹ").
 *
 * Spec (read-latest.txt, SISP-55 block): "1-Click compact A4 / Thermal
 * printable 'Zone Collection Sheet' grouped by Mohalla/Zone with
 * checkboxes, Bilingual Name (Urdu + Roman), Phone, Pole/Landmark
 * (SISP-32), Package, Arrears, Total Due, and blank signature/
 * cash-received column for offline paper tick-marking on the bike."
 * Test criterion: "Generating the Zone Collection Sheet for 'Barrian'
 * lists only unpaid active Barrian subscribers (excluding active
 * future Waada snoozed customers by default) with accurate totals."
 *
 * This module is a builder + print renderer + dialog controller in the
 * dashboard-top-defaulters.js mould. It writes nothing, mutates
 * nothing, adds no storage keys, and changes NO money logic.
 *
 * Who lands on the sheet (definitions, pinned by
 * tests/lineman-sheet-print.test.js):
 *   1. The defaulter set is exactly calculateTopDefaulters' set
 *      (dashboard-top-defaulters.js): non-archived customers whose
 *      allocation-engine balance (calculatePaymentAllocations — a
 *      voided receipt never counts, SISP-34) is above zero. FREE
 *      connections are excluded there by the owner's rule (they never
 *      owe anything).
 *   2. A customer with a recorded cancellationDate on or before the
 *      reference date is NOT an active subscriber anymore (phase3.js
 *      subscription-exclusion rule) and is excluded.
 *   3. Waada-snoozed customers (SISP-3 tier 'promised': a valid
 *      promiseDate today or in the future) are excluded BY DEFAULT —
 *      the spec's test criterion — and join the sheet only when the
 *      operator ticks "include Waada-snoozed"; their promise date is
 *      then printed on their row. Broken promises (tier 'broken')
 *      stay on the sheet either way.
 *   4. Customers on an active Vacation Hold (SISP-47) stay listed for
 *      their real pre-hold arrears — the Top Defaulters precedent —
 *      badged "On Hold" so the lineman knows the current month is
 *      paused (paused months bill Rs. 0, so no paused amount can
 *      appear in the figures).
 *   5. serviceStatus ('offline' / 'not-set') does NOT exclude a row:
 *      the Field Collection precedent (getPendingCollectionCustomers)
 *      collects from every non-archived debtor, and an offline line
 *      still owes its bill. The status is printed on the row instead.
 *
 * Figures: each row splits the engine's per-month balances into
 * Arrears (unpaid months before the sheet month) and This Month
 * (the sheet month and any later billed month); Total Due is the
 * engine's totalOutstanding. Zone subtotals and the grand total are
 * plain sums of the printed rows, so the paper always adds up.
 *
 * Grouping: canonicalMohalla (phase3.js) — spelling variants and a
 * leading "Mohalla" fold into one zone, exactly like the Mohalla
 * Dashboard and the SISP-54 area bars. Rows inside a zone walk in
 * pole order (numeric-aware, SISP-32's street order), then by name,
 * so the sheet reads like the lineman's route. Zones sort by label,
 * the unassigned group last.
 *
 * Names print bilingual via urdu-names.js bilingualCustomerName
 * (SISP-26: stored Urdu override, else transliteration, Roman always
 * kept). Pole/Landmark prints SISP-32's poleLandmarkDisplay.
 * Grace state prints SISP-38's escalationBadgeLabel (🟢 Grace /
 * 🟠 Final Notice / 🔴 Lock Due; blank before the 5th, when no
 * escalation exists) next to the oldest overdue day count.
 */

import {
  calculateTopDefaulters,
  formatDateYmd,
  escapeHtml
} from './dashboard-top-defaulters.js';
import { canonicalMohalla, pktMonth } from './phase3.js';
import { bilingualCustomerName } from './urdu-names.js';
import { normalizePoleFields, poleLandmarkDisplay } from './pole-landmark-book.js';
import { escalationBadgeLabel } from './reminder-queue.js';
import { WAADA_TIERS } from './waada-queue.js';
import { formatPKR } from './core.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-\d{2}$/;
export const ZONE_SHEET_UNASSIGNED_KEY = 'unassigned';
export const ZONE_SHEET_UNASSIGNED_LABEL = 'Unassigned';

/** Canonical zone identity for a raw mohalla/area value. */
function zoneIdentity(rawValue) {
  const canon = canonicalMohalla(rawValue || '');
  if (canon) return { key: canon.key, label: canon.label };
  return { key: ZONE_SHEET_UNASSIGNED_KEY, label: ZONE_SHEET_UNASSIGNED_LABEL };
}

/** Normalizes the caller's zone argument ('all', a label, or a key). */
function normalizeZoneFilter(zone) {
  const raw = String(zone ?? 'all').trim();
  if (!raw || raw.toLowerCase() === 'all') return 'all';
  const canon = canonicalMohalla(raw);
  return canon ? canon.key : raw;
}

/** Street order inside a zone: pole number (numeric-aware), then name —
 *  the SISP-32 cheat-sheet order, so the sheet follows the route. */
function compareSheetRows(a, b) {
  const poleA = a.poleNumber || '';
  const poleB = b.poleNumber || '';
  if (poleA && !poleB) return -1;
  if (!poleA && poleB) return 1;
  if (poleA && poleB) {
    const byPole = poleA.localeCompare(poleB, undefined, { numeric: true, sensitivity: 'accent' });
    if (byPole !== 0) return byPole;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'accent' });
}

function emptyTotals() {
  return { count: 0, arrears: 0, currentMonthDue: 0, totalDue: 0 };
}

function addToTotals(totals, row) {
  totals.count += 1;
  totals.arrears += row.arrears;
  totals.currentMonthDue += row.currentMonthDue;
  totals.totalDue += row.totalDue;
}

/**
 * Builds the Zone Collection Sheet model.
 *
 * @param {Object} state - Full application state
 * @param {Object} [options]
 * @param {string} [options.zone='all'] - Canonical mohalla label/key
 *   (e.g. 'Barrian') or 'all' for every zone.
 * @param {string} [options.month] - Sheet month 'YYYY-MM'; defaults to
 *   the reference date's PKT month. Splits Arrears vs This Month.
 * @param {Date} [options.referenceDate=new Date()]
 * @param {boolean} [options.includeWaadaSnoozed=false] - Include
 *   customers with an active future Waada promise (excluded by default).
 * @returns {Object} Sheet model: zones[] with rows + totals, grand
 *   totals, and the exclusion counts for transparency.
 */
export function buildZoneDefaulterSheet(state, {
  zone = 'all',
  month = null,
  referenceDate = new Date(),
  includeWaadaSnoozed = false
} = {}) {
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const sheetMonth = MONTH_RE.test(String(month || '')) ? String(month) : pktMonth(ref);
  const refYmd = formatDateYmd(ref);
  const zoneFilter = normalizeZoneFilter(zone);

  // Never-throw convention (collection-forecaster.js): a malformed
  // customers field is normalized before the engine sees the state.
  const safeState = {
    ...(state && typeof state === 'object' ? state : {}),
    customers: Array.isArray(state?.customers) ? state.customers : []
  };
  const data = calculateTopDefaulters(safeState, {
    referenceDate: ref,
    limit: 0,
    minOutstanding: 1
  });
  const customersById = new Map(safeState.customers.map(c => [c.id, c]));

  let excludedWaadaCount = 0;
  let excludedCancelledCount = 0;
  const groups = new Map();

  for (const row of data.accounts) {
    const customer = customersById.get(row.id);
    if (!customer) continue;

    // Definition 2: a cancelled subscription is no longer active.
    if (customer.cancellationDate && String(customer.cancellationDate) <= refYmd) {
      excludedCancelledCount += 1;
      continue;
    }
    // Definition 3: future-Waada (snoozed) customers rest by default.
    if (!includeWaadaSnoozed && row.waadaTier === WAADA_TIERS.PROMISED) {
      excludedWaadaCount += 1;
      continue;
    }

    const identity = zoneIdentity(customer.mohalla || customer.area || '');
    if (zoneFilter !== 'all' && identity.key !== zoneFilter) continue;

    let arrears = 0;
    let currentMonthDue = 0;
    for (const unpaid of row.unpaidMonths) {
      if (unpaid.month < sheetMonth) arrears += unpaid.balanceDue;
      else currentMonthDue += unpaid.balanceDue;
    }

    const pole = normalizePoleFields(customer);
    const sheetRow = {
      id: row.id,
      customerNumber: row.customerNumber,
      name: row.name,
      bilingualName: bilingualCustomerName(customer),
      phone: row.phone || '',
      poleNumber: pole.poleNumber,
      poleLandmark: poleLandmarkDisplay(customer),
      packageName: row.package,
      arrears,
      currentMonthDue,
      totalDue: row.totalOutstanding,
      unpaidMonths: row.unpaidMonths.map(m => m.month),
      oldestOverdueDays: row.oldestOverdueDays,
      escalationStage: row.escalationStage,
      escalationLabel: escalationBadgeLabel(row.escalationStage),
      waadaTier: row.waadaTier,
      promiseDate: row.promiseDate,
      vacationHold: row.vacationHold,
      serviceStatus: row.serviceStatus
    };

    if (!groups.has(identity.key)) {
      groups.set(identity.key, { key: identity.key, label: identity.label, rows: [], totals: emptyTotals() });
    }
    const group = groups.get(identity.key);
    group.rows.push(sheetRow);
    addToTotals(group.totals, sheetRow);
  }

  const zones = [...groups.values()]
    .map(group => ({ ...group, rows: [...group.rows].sort(compareSheetRows) }))
    .sort((a, b) => {
      if (a.key === ZONE_SHEET_UNASSIGNED_KEY) return 1;
      if (b.key === ZONE_SHEET_UNASSIGNED_KEY) return -1;
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'accent' });
    });

  const totals = emptyTotals();
  for (const group of zones) {
    totals.count += group.totals.count;
    totals.arrears += group.totals.arrears;
    totals.currentMonthDue += group.totals.currentMonthDue;
    totals.totalDue += group.totals.totalDue;
  }

  return {
    month: sheetMonth,
    referenceDateYmd: refYmd,
    zoneFilter,
    includeWaadaSnoozed: Boolean(includeWaadaSnoozed),
    zones,
    totals,
    excludedWaadaCount,
    excludedCancelledCount
  };
}

/**
 * Zone picker options: every zone that currently has sheet rows under
 * the same exclusion rules, with counts — used by the dialog's select.
 */
export function listZoneSheetZones(state, {
  referenceDate = new Date(),
  includeWaadaSnoozed = false
} = {}) {
  const sheet = buildZoneDefaulterSheet(state, {
    zone: 'all',
    referenceDate,
    includeWaadaSnoozed
  });
  return sheet.zones.map(group => ({
    key: group.key,
    label: group.label,
    count: group.totals.count,
    totalDue: group.totals.totalDue
  }));
}

function statusCellText(row, lang) {
  const parts = [];
  if (row.escalationLabel) parts.push(row.escalationLabel);
  if (row.oldestOverdueDays > 0) {
    parts.push(t('zsheet_days_overdue', lang, { days: row.oldestOverdueDays }));
  }
  if (row.waadaTier === WAADA_TIERS.PROMISED && row.promiseDate) {
    parts.push(t('zsheet_waada_on', lang, { date: row.promiseDate }));
  }
  if (row.vacationHold === 'active') parts.push(t('zsheet_on_hold', lang));
  return parts.join(' · ');
}

/**
 * Generates the printable Zone Collection Sheet document (A4 or 80mm
 * thermal). Paper output follows the app's print conventions (the
 * Top Defaulters print): a standalone HTML document, black on white.
 * Labels follow the requested language via t(); customer names always
 * print bilingual (Urdu + Roman) per the spec.
 *
 * @param {Object} params
 * @param {Object} params.sheet - Output of buildZoneDefaulterSheet
 * @param {string} [params.format='a4'] - 'a4' or 'thermal'
 * @param {string} [params.lang] - 'en' or 'ur' (defaults to app language)
 * @returns {string} HTML document string
 */
export function generateZoneSheetPrintHtml({ sheet, format = 'a4', lang = null } = {}) {
  const zones = Array.isArray(sheet?.zones) ? sheet.zones : [];
  const totals = sheet?.totals || emptyTotals();
  const month = sheet?.month || '';
  const dateStr = sheet?.referenceDateYmd || '';
  const zoneScope = sheet?.zoneFilter && sheet.zoneFilter !== 'all'
    ? (zones[0]?.label || '')
    : t('zsheet_all_zones', lang);

  if (format === 'thermal') {
    const zoneBlocks = zones.map(group => {
      const items = group.rows.map(row => `
      <div style="border-bottom:1px dashed #444; padding:4px 0; font-size:11px;">
        <div style="font-weight:bold;">☐ #${row.customerNumber} ${escapeHtml(row.bilingualName)}</div>
        <div style="font-size:10px;">${escapeHtml(row.phone || '—')} · ${escapeHtml(row.poleLandmark)}</div>
        <div style="font-size:10px;">${t('zsheet_col_arrears', lang)} ${row.arrears.toLocaleString()} · ${t('zsheet_col_this_month', lang)} ${row.currentMonthDue.toLocaleString()}</div>
        <div style="display:flex; justify-content:space-between; font-weight:bold;">
          <span>${t('zsheet_col_total', lang)}</span><span>PKR ${row.totalDue.toLocaleString()}</span>
        </div>
        ${statusCellText(row, lang) ? `<div style="font-size:9px; color:#333;">${escapeHtml(statusCellText(row, lang))}</div>` : ''}
        <div style="font-size:10px; margin-top:2px;">${t('zsheet_col_cash', lang)}: ____________ ${t('zsheet_col_sign', lang)}: ________</div>
      </div>`).join('');
      return `
      <div style="border-top:2px solid #000; margin-top:6px; padding-top:4px;">
        <div style="font-weight:bold; font-size:12px;">${escapeHtml(group.label)} (${group.totals.count})</div>
        ${items}
        <div class="kpi"><span>${t('zsheet_zone_total', lang)}:</span><span>PKR ${group.totals.totalDue.toLocaleString()}</span></div>
      </div>`;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Zone Collection Sheet — Thermal</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: monospace; width: 80mm; margin: 0; padding: 6px; font-size: 11px; color:#000; }
          .head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
          .kpi { display: flex; justify-content: space-between; font-weight: bold; margin: 2px 0; }
        </style>
      </head>
      <body>
        <div class="head">
          <h3 style="margin:0;">SHAHDARA FIBER NET</h3>
          <div style="font-weight:bold;">ZONE COLLECTION SHEET · زون کلیکشن شیٹ</div>
          <div>${escapeHtml(zoneScope)} · ${escapeHtml(month)}</div>
          <div>${t('zsheet_generated_on', lang, { date: dateStr })}</div>
        </div>
        <div class="kpi"><span>${t('zsheet_col_customer', lang)}:</span><span>${totals.count}</span></div>
        <div class="kpi"><span>${t('zsheet_grand_total', lang)}:</span><span>PKR ${totals.totalDue.toLocaleString()}</span></div>
        ${zoneBlocks || `<div style="text-align:center; padding:8px;">${t('zsheet_empty', lang)}</div>`}
        <div style="text-align:center; margin-top:8px; font-size:9px; border-top:1px solid #000; padding-top:4px;">
          *** FIELD COLLECTION SHEET · ${escapeHtml(month)} ***
        </div>
      </body>
      </html>
    `;
  }

  // A4 — one section per zone, compact rows with big names/amounts and
  // blank cash-received + signature columns for paper tick-marking.
  const zoneSections = zones.map(group => {
    const rows = group.rows.map((row, index) => `
      <tr>
        <td class="cb"><span class="box"></span></td>
        <td class="num">${index + 1}</td>
        <td class="cust"><strong>#${row.customerNumber} ${escapeHtml(row.bilingualName)}</strong><br><small>${escapeHtml(row.packageName)}</small></td>
        <td>${escapeHtml(row.phone || '—')}</td>
        <td>${escapeHtml(row.poleLandmark)}</td>
        <td class="amt">${row.arrears ? row.arrears.toLocaleString() : '—'}</td>
        <td class="amt">${row.currentMonthDue ? row.currentMonthDue.toLocaleString() : '—'}</td>
        <td class="amt total">PKR ${row.totalDue.toLocaleString()}</td>
        <td class="status">${escapeHtml(statusCellText(row, lang))}</td>
        <td class="blank"></td>
        <td class="blank"></td>
      </tr>`).join('');
    return `
    <section class="zone">
      <h2>${escapeHtml(group.label)} <span class="zone-meta">· ${group.totals.count} ${t('zsheet_col_customer', lang)} · ${t('zsheet_zone_total', lang)}: PKR ${group.totals.totalDue.toLocaleString()}</span></h2>
      <table>
        <thead>
          <tr>
            <th class="cb">✓</th>
            <th class="num">#</th>
            <th>${t('zsheet_col_customer', lang)}</th>
            <th>${t('zsheet_col_phone', lang)}</th>
            <th>${t('zsheet_col_pole', lang)}</th>
            <th class="amt">${t('zsheet_col_arrears', lang)}</th>
            <th class="amt">${t('zsheet_col_this_month', lang)}</th>
            <th class="amt">${t('zsheet_col_total', lang)}</th>
            <th>${t('zsheet_col_status', lang)}</th>
            <th>${t('zsheet_col_cash', lang)}</th>
            <th>${t('zsheet_col_sign', lang)}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="subtotal">
            <td colspan="5">${t('zsheet_zone_total', lang)} — ${escapeHtml(group.label)}</td>
            <td class="amt">${group.totals.arrears.toLocaleString()}</td>
            <td class="amt">${group.totals.currentMonthDue.toLocaleString()}</td>
            <td class="amt total">PKR ${group.totals.totalDue.toLocaleString()}</td>
            <td colspan="3"></td>
          </tr>
        </tbody>
      </table>
    </section>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Zone Collection Sheet — ${escapeHtml(month)}</title>
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; font-size: 11px; line-height: 1.35; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
        .brand { font-size: 18px; font-weight: 800; }
        .title { font-size: 14px; font-weight: 700; }
        .meta { font-size: 11px; text-align: right; }
        .zone { margin-bottom: 14px; }
        .zone h2 { font-size: 14px; margin: 0 0 4px; border-bottom: 1px solid #000; padding-bottom: 2px; }
        .zone-meta { font-weight: 600; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 4px 5px; text-align: left; vertical-align: top; }
        th { background: #eee; font-size: 10px; }
        td.cust strong { font-size: 12.5px; }
        td.amt, th.amt { text-align: right; white-space: nowrap; }
        td.total { font-weight: 800; font-size: 12px; }
        td.status { font-size: 10px; }
        td.cb, th.cb { text-align: center; width: 18px; }
        td.num, th.num { text-align: center; width: 20px; }
        td.blank { min-width: 62px; }
        .box { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #000; border-radius: 2px; }
        tr.subtotal td { background: #f3f3f3; font-weight: 700; }
        .grand { display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; border-top: 2px solid #000; padding-top: 6px; margin-top: 4px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 26px; font-size: 11px; gap: 18px; }
        .empty { text-align: center; padding: 22px; font-size: 12px; }
        @media print { .zone { break-inside: avoid-page; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">SHAHDARA FIBER NET</div>
          <div class="title">Zone Collection Sheet · زون کلیکشن شیٹ · فیلڈ لائن مین بقایا فہرست</div>
          <div>${escapeHtml(zoneScope)} · ${escapeHtml(month)}</div>
        </div>
        <div class="meta">
          <div>${t('zsheet_generated_on', lang, { date: dateStr })}</div>
          <div>${totals.count} ${t('zsheet_col_customer', lang)}</div>
        </div>
      </div>
      ${zoneSections || `<div class="empty">${t('zsheet_empty', lang)}</div>`}
      <div class="grand">
        <span>${t('zsheet_grand_total', lang)}</span>
        <span>${t('zsheet_col_arrears', lang)} PKR ${totals.arrears.toLocaleString()} · ${t('zsheet_col_this_month', lang)} PKR ${totals.currentMonthDue.toLocaleString()} · ${t('zsheet_col_total', lang)} PKR ${totals.totalDue.toLocaleString()}</span>
      </div>
      <div class="signatures">
        <div>${t('zsheet_sign_lineman', lang)}: _______________________</div>
        <div>${t('zsheet_sign_cash', lang)}: _______________________</div>
        <div>${t('zsheet_sign_owner', lang)}: _______________________</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Controller for the Zone Collection Sheet dialog (opened from the
 * Top Defaulters modal). Mirrors setupTopDefaultersModal's wiring
 * style: returns null when there is no DOM or no dialog markup.
 *
 * @param {Object|Function} getState - State object or () => state
 * @param {Object} [options]
 * @param {Function} [options.onToast]
 * @returns {Object|null} Controller { open, close, refresh, getSheet }
 */
export function setupZoneSheetDialog(getState, { onToast = null } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('zoneSheetDialog');
  if (!dialog) return null;

  const readState = () => (typeof getState === 'function' ? getState() : getState);
  const openBtn = document.getElementById('topDefaultersZoneSheetBtn');
  const closeBtn = document.getElementById('zoneSheetCloseBtn');
  const closeSecondaryBtn = document.getElementById('zoneSheetCloseBtn2');
  const zoneSelect = document.getElementById('zoneSheetZoneSelect');
  const waadaToggle = document.getElementById('zoneSheetWaadaToggle');
  const monthText = document.getElementById('zoneSheetMonthText');
  const preview = document.getElementById('zoneSheetPreview');
  const printA4Btn = document.getElementById('zoneSheetPrintA4Btn');
  const printThermalBtn = document.getElementById('zoneSheetPrintThermalBtn');

  let currentSheet = null;

  const render = () => {
    const includeWaadaSnoozed = Boolean(waadaToggle?.checked);
    // Repopulate the picker from the zones that currently have rows so
    // it can never offer an empty zone; keep the operator's selection.
    if (zoneSelect) {
      const previous = zoneSelect.value || 'all';
      const zones = listZoneSheetZones(readState(), { includeWaadaSnoozed });
      zoneSelect.innerHTML = '';
      const allOpt = document.createElement('option');
      allOpt.value = 'all';
      allOpt.textContent = t('zsheet_all_zones');
      zoneSelect.appendChild(allOpt);
      zones.forEach(z => {
        const opt = document.createElement('option');
        opt.value = z.key;
        opt.textContent = `${z.label} (${z.count})`;
        zoneSelect.appendChild(opt);
      });
      zoneSelect.value = [...zoneSelect.options].some(o => o.value === previous) ? previous : 'all';
    }

    currentSheet = buildZoneDefaulterSheet(readState(), {
      zone: zoneSelect ? zoneSelect.value : 'all',
      includeWaadaSnoozed
    });

    if (monthText) monthText.textContent = currentSheet.month;
    if (preview) {
      preview.textContent = currentSheet.totals.count
        ? t('zsheet_preview', null, {
          count: currentSheet.totals.count,
          total: formatPKR(currentSheet.totals.totalDue)
        })
        : t('zsheet_preview_empty');
    }
    return currentSheet;
  };

  const print = (format) => {
    if (!currentSheet) render();
    const html = generateZoneSheetPrintHtml({ sheet: currentSheet, format });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } else if (typeof onToast === 'function') {
      onToast(t('zsheet_popup_blocked'));
    }
  };

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      render();
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });
  if (zoneSelect) zoneSelect.addEventListener('change', render);
  if (waadaToggle) waadaToggle.addEventListener('change', render);
  if (printA4Btn) printA4Btn.addEventListener('click', () => print('a4'));
  if (printThermalBtn) printThermalBtn.addEventListener('click', () => print('thermal'));

  return {
    open: () => {
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      render();
    },
    close: () => { dialog.close?.() || (dialog.hidden = true); },
    refresh: render,
    getSheet: () => currentSheet
  };
}
