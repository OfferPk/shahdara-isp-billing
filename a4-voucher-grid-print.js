/**
 * a4-voucher-grid-print.js — SISP-115 [P2]: Printable A4 4-Up Tear-Off
 * Monthly Bill Vouchers by Zone ("ماہانہ بل واؤچر").
 *
 * Spec (read-latest.txt, SISP-115 block): "Render an A4 print layout
 * with 4 tear-off bill vouchers per page (@media print grid with
 * dashed cut lines) for any selected Zone, showing Bilingual Name
 * (Urdu + Roman), Connection ID, Arrears, Package, Kist, Total Due,
 * 3 Payment Shops (Waseem • Hassan • Balla), and SISP-14 QR Code."
 * Test criterion: "Generating the A4 4-Up view for 9 unpaid customers
 * in Barrian renders 3 pages (4 + 4 + 1 vouchers) with accurate
 * totals."
 *
 * This module is a builder + print renderer + dialog controller in
 * the lineman-sheet-print.js (SISP-55) mould. It writes nothing,
 * mutates nothing, adds no storage keys, and changes NO money logic.
 *
 * Who gets a voucher (inclusion rule, pinned by
 * tests/a4-voucher-grid-print.test.js):
 *   1. The customer is not archived and is not a FREE connection
 *      (owner rule: free connections never owe anything — the Top
 *      Defaulters / Zone Sheet precedent).
 *   2. The customer is not cancelled on or before the reference date
 *      (the Zone Sheet's subscription-exclusion rule): a cancelled
 *      line is not handed a fresh monthly bill voucher.
 *   3. The customer has a PRICED bill for the selected month
 *      (buildArrearsBreakdown non-null: dueAmount finite and > 0).
 *      An unpriced / "not set" bill is not an invoice (the Billing
 *      Register precedent), and a customer with old arrears but no
 *      bill this month belongs on the Zone Defaulter Sheet, not on
 *      this month's voucher run.
 *   4. The engine still shows money owed through that month:
 *      arrears (balances of earlier bills) + the selected month's
 *      balanceDue, from ONE calculatePaymentAllocations run, is
 *      above zero. A customer who paid this month in full and has no
 *      arrears gets no voucher; a voided receipt never counts as
 *      paid (SISP-34 — the engine already excludes voided payments).
 *   Waada promises do NOT exclude a row: a voucher is the customer's
 *   own bill, not a collection visit (the Zone Sheet's snooze
 *   exclusion is a field-visit rule and does not apply here).
 *
 * Figures — engine only, never a second balance computation:
 *   - Package / Kist are the selected bill's own composition from
 *     buildArrearsBreakdown (billing-cycle.js — the same breakdown
 *     WhatsApp + thermal receipts print: dueAmount split back into
 *     package + kist via billKistTotal).
 *   - Arrears is the sum of the allocation engine's balanceDueCents
 *     over the customer's earlier bills (identically the breakdown's
 *     previousArrears, which arrearsAndAdvance derives the same way).
 *   - Total Due = Arrears + the selected month's balanceDueCents, so
 *     the voucher always reconciles with the engine and with the
 *     figures the Billing Register and profile show.
 *
 * Shops line: qr-card.js KHATA_PAYMENT_SHOPS — the single shop list
 * the SISP-14 Khata card already prints. This base still carries it
 * as a literal export; SISP-86 (built locally) derives that same
 * export from PAYMENT_METHODS via resolveShopCollector, which
 * supersedes the literal at merge time — the vouchers keep reading
 * the one shared export either way and never hardcode a second list.
 *
 * QR: the SISP-14 payload, unchanged — buildKhataCardModel's deep
 * link (?customer=<id>&action=pay) encoded with qr-card.js's own
 * offline encoder and drawn as inline SVG for the print document.
 *
 * Print/screen split: the printed sheet is black-on-white paper by
 * design (house print pattern — Zone Sheet / Expense Voucher Book /
 * Khata card), with dashed cut lines and real @media print page
 * breaks (4 vouchers per A4 page). The on-screen dialog uses the
 * shared .billing-modal shell (var(--modal-surface)) and token-only
 * CSS in components.css, so it follows dark mode.
 */

import { calculatePaymentAllocations, formatPKR } from './core.js';
import { buildArrearsBreakdown } from './billing-cycle.js';
import { canonicalMohalla, pktMonth } from './phase3.js';
import { bilingualCustomerName } from './urdu-names.js';
import {
  KHATA_ISP_NAME,
  KHATA_PAYMENT_SHOPS,
  buildKhataCardModel,
  encodeQrMatrix,
  resolveQrBaseUrl
} from './qr-card.js';
import { formatDateYmd, escapeHtml } from './dashboard-top-defaulters.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-\d{2}$/;
export const VOUCHERS_PER_PAGE = 4;
export const VOUCHER_UNASSIGNED_KEY = 'unassigned';
export const VOUCHER_UNASSIGNED_LABEL = 'Unassigned';

const centsToAmount = (cents) => Number((cents / 100).toFixed(2));

/** Canonical zone identity for a raw mohalla/area value (Zone Sheet rule). */
function zoneIdentity(rawValue) {
  const canon = canonicalMohalla(rawValue || '');
  if (canon) return { key: canon.key, label: canon.label };
  return { key: VOUCHER_UNASSIGNED_KEY, label: VOUCHER_UNASSIGNED_LABEL };
}

/** Normalizes the caller's zone argument ('all', a label, or a key). */
function normalizeZoneFilter(zone) {
  const raw = String(zone ?? 'all').trim();
  if (!raw || raw.toLowerCase() === 'all') return 'all';
  const canon = canonicalMohalla(raw);
  return canon ? canon.key : raw;
}

/** Chunks a voucher list into printed pages of VOUCHERS_PER_PAGE. */
export function paginateVouchers(vouchers, perPage = VOUCHERS_PER_PAGE) {
  const list = Array.isArray(vouchers) ? vouchers : [];
  const size = Number.isSafeInteger(perPage) && perPage > 0 ? perPage : VOUCHERS_PER_PAGE;
  const pages = [];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages;
}

/**
 * Builds the bill-voucher model for one zone + bill month.
 *
 * @param {Object} state - Full application state
 * @param {Object} [options]
 * @param {string} [options.zone='all'] - Canonical mohalla label/key or 'all'.
 * @param {string} [options.month] - Bill month 'YYYY-MM'; defaults to the
 *   reference date's PKT month.
 * @param {Date} [options.referenceDate=new Date()]
 * @param {string} [options.baseUrl] - Deep-link base (defaults to the
 *   canonical app URL inside buildKhataCardModel).
 * @returns {Object} { month, zoneFilter, zoneLabel, vouchers, pages,
 *   totals: { count, arrears, totalDue }, shops }
 */
export function buildBillVouchers(state, {
  zone = 'all',
  month = null,
  referenceDate = new Date(),
  baseUrl = undefined
} = {}) {
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const billMonth = MONTH_RE.test(String(month || '')) ? String(month) : pktMonth(ref);
  const refYmd = formatDateYmd(ref);
  const zoneFilter = normalizeZoneFilter(zone);

  // Never-throw convention (collection-forecaster.js): a malformed
  // customers field is normalized before the engine sees the state.
  const safeState = {
    ...(state && typeof state === 'object' ? state : {}),
    customers: Array.isArray(state?.customers) ? state.customers : []
  };

  // ONE engine run for the whole build (the Billing Register pattern):
  // every balance below comes from this allocation pass.
  const allocations = calculatePaymentAllocations(safeState);

  const customers = [...safeState.customers]
    .filter((c) => c && typeof c === 'object')
    .sort((a, b) => (a.customerNumber ?? 0) - (b.customerNumber ?? 0));

  const vouchers = [];
  for (const customer of customers) {
    if (customer.archived) continue;
    if (customer.isFreeConnection) continue;
    if (customer.cancellationDate && String(customer.cancellationDate) <= refYmd) continue;

    const bill = (customer.bills ?? []).find((b) => b && b.month === billMonth);
    if (!bill) continue;
    const breakdown = buildArrearsBreakdown(customer, bill);
    if (!breakdown) continue; // unpriced / not-set bill — not an invoice

    const monthSummary = allocations.forMonth(customer.id, billMonth);
    if (!monthSummary || monthSummary.balanceDueCents === null || monthSummary.balanceDueCents === undefined) continue;

    let arrearsCents = 0;
    for (const earlier of customer.bills ?? []) {
      if (!earlier || typeof earlier.month !== 'string' || earlier.month >= billMonth) continue;
      const summary = allocations.forMonth(customer.id, earlier.month);
      if (summary && summary.balanceDueCents) arrearsCents += summary.balanceDueCents;
    }
    const totalDueCents = arrearsCents + monthSummary.balanceDueCents;
    if (!(totalDueCents > 0)) continue;

    const identity = zoneIdentity(customer.mohalla || customer.area || '');
    if (zoneFilter !== 'all' && identity.key !== zoneFilter) continue;

    const khata = buildKhataCardModel(customer, baseUrl ? { baseUrl } : {});
    vouchers.push({
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      name: String(customer.name ?? ''),
      bilingualName: bilingualCustomerName(customer),
      zoneKey: identity.key,
      zoneLabel: identity.label,
      month: billMonth,
      packageAmount: breakdown.packageAmount,
      kistAmount: breakdown.kistAmount,
      kistLines: breakdown.kistLines,
      arrears: centsToAmount(arrearsCents),
      monthBalance: centsToAmount(monthSummary.balanceDueCents),
      totalDue: centsToAmount(totalDueCents),
      shops: [...KHATA_PAYMENT_SHOPS],
      deepLink: khata ? khata.deepLink : null
    });
  }

  const totals = {
    count: vouchers.length,
    arrears: centsToAmount(vouchers.reduce((sum, v) => sum + Math.round(v.arrears * 100), 0)),
    totalDue: centsToAmount(vouchers.reduce((sum, v) => sum + Math.round(v.totalDue * 100), 0))
  };

  return {
    month: billMonth,
    referenceDateYmd: refYmd,
    zoneFilter,
    zoneLabel: zoneFilter === 'all'
      ? null
      : (vouchers[0]?.zoneLabel ?? (canonicalMohalla(zone)?.label ?? String(zone))),
    vouchers,
    pages: paginateVouchers(vouchers),
    totals,
    shops: [...KHATA_PAYMENT_SHOPS]
  };
}

/**
 * Zone picker options: every zone that currently has vouchers for the
 * month, with counts — used by the dialog's select so it can never
 * offer an empty zone.
 */
export function listBillVoucherZones(state, { month = null, referenceDate = new Date() } = {}) {
  const model = buildBillVouchers(state, { zone: 'all', month, referenceDate });
  const groups = new Map();
  for (const voucher of model.vouchers) {
    if (!groups.has(voucher.zoneKey)) {
      groups.set(voucher.zoneKey, { key: voucher.zoneKey, label: voucher.zoneLabel, count: 0, totalDue: 0 });
    }
    const group = groups.get(voucher.zoneKey);
    group.count += 1;
    group.totalDue = centsToAmount(Math.round(group.totalDue * 100) + Math.round(voucher.totalDue * 100));
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === VOUCHER_UNASSIGNED_KEY) return 1;
    if (b.key === VOUCHER_UNASSIGNED_KEY) return -1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'accent' });
  });
}

/**
 * Inline SVG for a deep link's QR matrix (qr-card.js encoder — the
 * SISP-14 payload, unchanged). Returns '' when the payload cannot be
 * encoded, so the voucher falls back to printing the link text,
 * exactly like the Khata card's no-QR fallback.
 */
export function qrSvgForDeepLink(deepLink, { modulePx = 3, margin = 4 } = {}) {
  if (!deepLink) return '';
  let matrix;
  try {
    matrix = encodeQrMatrix(deepLink);
  } catch {
    return '';
  }
  const size = matrix.size;
  const total = (size + margin * 2) * modulePx;
  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix.modules[y][x]) {
        path += `M${(x + margin) * modulePx} ${(y + margin) * modulePx}h${modulePx}v${modulePx}h-${modulePx}z`;
      }
    }
  }
  return `<svg class="bv-qr" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

function voucherHtml(voucher, lang) {
  const shopsLine = (voucher.shops || []).map(escapeHtml).join(' • ');
  const qrSvg = qrSvgForDeepLink(voucher.deepLink);
  const kistRow = voucher.kistAmount > 0 ? `
        <div class="bv-row"><span>${t('bvouch_col_kist', lang)}</span><span>${voucher.kistAmount.toLocaleString('en-PK')}</span></div>` : '';
  return `
    <div class="bv-voucher">
      <div class="bv-main">
        <div class="bv-brand">${escapeHtml(KHATA_ISP_NAME)} · ${escapeHtml(voucher.zoneLabel)}</div>
        <div class="bv-name">${escapeHtml(voucher.bilingualName)}</div>
        <div class="bv-conn">${t('bvouch_connection', lang)}: <strong>#${voucher.customerNumber}</strong> · ${escapeHtml(voucher.month)}</div>
        <div class="bv-row"><span>${t('bvouch_col_package', lang)}</span><span>${voucher.packageAmount.toLocaleString('en-PK')}</span></div>${kistRow}
        <div class="bv-row"><span>${t('bvouch_col_arrears', lang)}</span><span>${voucher.arrears.toLocaleString('en-PK')}</span></div>
        <div class="bv-row bv-total"><span>${t('bvouch_col_total', lang)}</span><span>PKR ${voucher.totalDue.toLocaleString('en-PK')}</span></div>
        <div class="bv-shops">${t('bvouch_pay_at', lang)}: ${shopsLine}</div>
      </div>
      <div class="bv-side">
        ${qrSvg || `<div class="bv-link">${escapeHtml(voucher.deepLink || '')}</div>`}
        <div class="bv-scan">${t('bvouch_scan_note', lang)}</div>
      </div>
    </div>`;
}

/**
 * Generates the printable A4 4-up voucher document. Paper output is
 * black-on-white by design (house print pattern); the page grid is a
 * real print layout — each .bv-page holds exactly 4 vouchers in a
 * 2×2 grid and forces a page break, on screen and in print alike.
 *
 * @param {Object} params
 * @param {Object} params.model - Output of buildBillVouchers
 * @param {string} [params.lang] - 'en' or 'ur' (defaults to app language)
 * @returns {string} HTML document string
 */
export function generateVoucherGridPrintHtml({ model, lang = null } = {}) {
  const pages = Array.isArray(model?.pages) ? model.pages : [];
  const totals = model?.totals || { count: 0, arrears: 0, totalDue: 0 };
  const month = model?.month || '';
  const dateStr = model?.referenceDateYmd || '';
  const zoneScope = model?.zoneFilter && model.zoneFilter !== 'all'
    ? (model.zoneLabel || '')
    : t('bvouch_all_zones', lang);

  const pageBlocks = pages.map((pageVouchers, index) => `
    <section class="bv-page">
      ${pageVouchers.map((voucher) => voucherHtml(voucher, lang)).join('')}
      <div class="bv-page-num">${t('bvouch_page_of', lang, { page: index + 1, pages: pages.length })}</div>
    </section>`).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Bill Vouchers — ${escapeHtml(month)}</title>
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; font-size: 12px; line-height: 1.35; }
        .bv-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
        .bv-brandname { font-size: 18px; font-weight: 800; }
        .bv-title { font-size: 14px; font-weight: 700; }
        .bv-meta { font-size: 11px; text-align: right; }
        .bv-page { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 6mm; height: 262mm; position: relative; margin-bottom: 10mm; }
        .bv-voucher { border: 1.8px dashed #000; border-radius: 4px; padding: 10px 12px; display: flex; gap: 10px; overflow: hidden; }
        .bv-main { flex: 1 1 auto; min-width: 0; }
        .bv-side { flex: 0 0 auto; text-align: center; }
        .bv-brand { font-size: 10px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: #333; }
        .bv-name { font-size: 17px; font-weight: 800; margin: 3px 0 2px; }
        .bv-conn { font-size: 11.5px; margin-bottom: 7px; }
        .bv-row { display: flex; justify-content: space-between; font-size: 12.5px; padding: 2.5px 0; border-bottom: 1px dotted #999; font-variant-numeric: tabular-nums; }
        .bv-total { font-size: 14.5px; font-weight: 800; border-bottom: 2px solid #000; }
        .bv-shops { font-size: 10.5px; margin-top: 7px; color: #222; }
        .bv-scan { font-size: 9px; color: #333; margin-top: 3px; max-width: 110px; }
        .bv-link { font-size: 8px; word-break: break-all; max-width: 110px; }
        .bv-page-num { position: absolute; bottom: -6mm; right: 0; font-size: 9px; color: #555; }
        .bv-grand { display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; border-top: 2px solid #000; padding-top: 6px; }
        .bv-empty { text-align: center; padding: 22px; font-size: 12px; }
        @media print {
          .bv-page { margin-bottom: 0; break-after: page; page-break-after: always; }
          .bv-page:last-of-type { break-after: auto; page-break-after: auto; }
          .bv-voucher { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="bv-header">
        <div>
          <div class="bv-brandname">SHAHDARA FIBER NET</div>
          <div class="bv-title">Monthly Bill Vouchers · ماہانہ بل واؤچر</div>
          <div>${escapeHtml(zoneScope)} · ${escapeHtml(month)}</div>
        </div>
        <div class="bv-meta">
          <div>${t('bvouch_generated_on', lang, { date: dateStr })}</div>
          <div>${totals.count} ${t('bvouch_col_vouchers', lang)}</div>
        </div>
      </div>
      ${pageBlocks || `<div class="bv-empty">${t('bvouch_empty', lang)}</div>`}
      <div class="bv-grand">
        <span>${t('bvouch_grand_total', lang)}</span>
        <span>${t('bvouch_col_arrears', lang)} PKR ${totals.arrears.toLocaleString('en-PK')} · ${t('bvouch_col_total', lang)} PKR ${totals.totalDue.toLocaleString('en-PK')}</span>
      </div>
    </body>
    </html>
  `;
}

/**
 * Controller for the Bill Vouchers dialog (opened from the Monthly
 * Billing actions bar). Mirrors setupZoneSheetDialog's wiring style:
 * returns null when there is no DOM or no dialog markup. Read-only —
 * printing never writes any record.
 *
 * @param {Object|Function} getState - State object or () => state
 * @param {Object} [options]
 * @param {Function} [options.onToast]
 * @returns {Object|null} Controller { open, close, refresh, getModel }
 */
export function setupBillVoucherDialog(getState, { onToast = null } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('billVoucherDialog');
  if (!dialog) return null;

  const readState = () => (typeof getState === 'function' ? getState() : getState);
  const openBtn = document.getElementById('billVouchersBtn');
  const closeBtn = document.getElementById('billVoucherCloseBtn');
  const closeSecondaryBtn = document.getElementById('billVoucherCloseBtn2');
  const zoneSelect = document.getElementById('billVoucherZoneSelect');
  const monthInput = document.getElementById('billVoucherMonthInput');
  const preview = document.getElementById('billVoucherPreview');
  const printBtn = document.getElementById('billVoucherPrintBtn');

  let currentModel = null;

  const render = () => {
    const month = monthInput && MONTH_RE.test(monthInput.value || '') ? monthInput.value : undefined;
    // Repopulate the picker from the zones that currently have
    // vouchers for the month so it can never offer an empty zone;
    // keep the operator's selection.
    if (zoneSelect) {
      const previous = zoneSelect.value || 'all';
      const zones = listBillVoucherZones(readState(), { month });
      zoneSelect.innerHTML = '';
      const allOpt = document.createElement('option');
      allOpt.value = 'all';
      allOpt.textContent = t('bvouch_all_zones');
      zoneSelect.appendChild(allOpt);
      zones.forEach((z) => {
        const opt = document.createElement('option');
        opt.value = z.key;
        opt.textContent = `${z.label} (${z.count})`;
        zoneSelect.appendChild(opt);
      });
      zoneSelect.value = [...zoneSelect.options].some((o) => o.value === previous) ? previous : 'all';
    }

    const baseUrl = typeof window !== 'undefined' && window.location?.href
      ? resolveQrBaseUrl(window.location.href)
      : undefined;
    currentModel = buildBillVouchers(readState(), {
      zone: zoneSelect ? zoneSelect.value : 'all',
      month,
      baseUrl
    });

    if (preview) {
      preview.textContent = currentModel.totals.count
        ? t('bvouch_preview', null, {
          count: currentModel.totals.count,
          pages: currentModel.pages.length,
          total: formatPKR(currentModel.totals.totalDue)
        })
        : t('bvouch_preview_empty');
    }
    return currentModel;
  };

  const print = () => {
    if (!currentModel) render();
    const html = generateVoucherGridPrintHtml({ model: currentModel });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } else if (typeof onToast === 'function') {
      onToast(t('bvouch_popup_blocked'));
    }
  };

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (monthInput && !monthInput.value) monthInput.value = currentModel?.month || pktMonth(new Date());
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      render();
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });
  if (zoneSelect) zoneSelect.addEventListener('change', render);
  if (monthInput) monthInput.addEventListener('change', render);
  if (printBtn) printBtn.addEventListener('click', print);

  return {
    open: () => {
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      render();
    },
    close: () => { dialog.close?.() || (dialog.hidden = true); },
    refresh: render,
    getModel: () => currentModel
  };
}
