/**
 * daily-method-matrix.js — SISP-154 [P2]: Day-by-Day Collection Method
 * Matrix (روزانہ وصولی جدول: 1 تا 31).
 *
 * Spec (read-latest.txt, SISP-154 block): "Render a day-by-day matrix
 * (1st through 31st) showing Direct Cash, Waseem Shop, Hassan Shop,
 * Balla Shop, JazzCash/Easypaisa/Bank, Receipt Count, and Day Total PKR
 * with CSV/print export."
 *
 * Read-only report: nothing here writes, stamps or mutates any record.
 * The matrix is derived fresh from the ledger state on every render, so
 * it can never disagree with the payments actually recorded.
 *
 * Sources of truth ONLY:
 *   - Payments = state.customers[].bills[].payments[] — the same rows
 *     Roznamcha and the P&L read. A payment counts on its recorded
 *     `date` (cash basis, exactly like Roznamcha / dashboard-pnl).
 *   - Voided payments (SISP-34, payment-void-audit.js isVoidedPayment)
 *     NEVER appear: voided money was reversed, it is not collected.
 *   - The counted amount is the payment's full recorded `amount` — the
 *     cash that actually arrived through that method. A payment's
 *     ticket-charge / add-on portions still arrived as cash through
 *     the same method, so they count in full (Roznamcha treats the
 *     drawer the same way); a payment's `discount` is a separate field,
 *     was never cash, and is never added.
 *
 * Method → bucket mapping (derived from core.js PAYMENT_METHODS —
 * ['Cash','JazzCash','Easypaisa','NayaPay','Bank Transfer','Raast',
 *  'Cash at Waseem Abbasi shop','Cash at Hassan shop',
 *  'Cash at Balla shop'] — never re-typed anywhere else):
 *   1. Shop: shop-settlement.js resolveShopCollector(method, paidBy)
 *      returns a shop → that shop's own column. This covers the three
 *      recorded shop methods AND any custom "Cash at <Name> shop"
 *      method ("<Name> Shop") — shop columns are ENUMERATED from the
 *      month's counted payments, never hardcoded, so a shop that is
 *      not in the spec's three names still gets its own column.
 *   2. Direct Cash: method exactly 'Cash' (Roznamcha's own rule for
 *      drawer cash, collectDirectCashPayments).
 *   3. Digital: everything else. For recorded data that is exactly the
 *      digital set JazzCash / Easypaisa / NayaPay / Bank Transfer /
 *      Raast (wallet-reconciliation.js DIGITAL_BREAKDOWN_METHODS). Any
 *      other recorded string (legacy free-form methods) also lands
 *      here, so every non-voided payment is counted exactly once and
 *      the matrix always reconciles with the month's total collections.
 *
 * Shop column order is deterministic for a given state: first
 * appearance in a chronological scan (payment date, then customer
 * number, then payment id) of the month's counted payments.
 *
 * All money is integer cents inside the builder; rupees only appear at
 * the render / CSV edge.
 */

import { formatPKR } from './core.js';
import { resolveShopCollector, pakistanMonth } from './shop-settlement.js';
import { isVoidedPayment } from './payment-void-audit.js';
import { generateCsvContent, downloadCsvFile } from './form-validation.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function centsOf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function rupeesOf(cents) {
  return Number((cents / 100).toFixed(2));
}

/** True for a real YYYY-MM month string. */
export function validDailyMatrixMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

/** Number of days in a YYYY-MM month (28–31); 0 for an invalid month. */
export function lastDayOfDailyMatrixMonth(month) {
  if (!validDailyMatrixMonth(month)) return 0;
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/**
 * The bucket one payment belongs to:
 *   { bucket: 'shop', shop: '<Shop Name>' }
 *   { bucket: 'direct' }  — plain Cash
 *   { bucket: 'digital' } — wallets / bank / any other recorded method
 */
export function classifyDailyMatrixPayment(payment) {
  if (!payment || typeof payment !== 'object') return { bucket: 'digital' };
  const shop = resolveShopCollector(payment.method, payment.paidBy);
  if (shop) return { bucket: 'shop', shop };
  if (payment.method === 'Cash') return { bucket: 'direct' };
  return { bucket: 'digital' };
}

function emptyDay(day, shopNames) {
  const shops = {};
  for (const name of shopNames) shops[name] = 0;
  return { day, directCashCents: 0, shops, digitalCents: 0, receiptCount: 0, totalCents: 0 };
}

/**
 * Build the day-by-day method matrix for one month.
 *
 * @param {Object} state - Ledger state ({ customers: [...] }).
 * @param {string} [month] - YYYY-MM; defaults to the current PKT month.
 * @returns {{ month: string, shopNames: string[],
 *   days: Array<{day:number, directCashCents:number, shops:Object,
 *     digitalCents:number, receiptCount:number, totalCents:number}>,
 *   totals: {directCashCents:number, shops:Object, digitalCents:number,
 *     receiptCount:number, totalCents:number},
 *   grandTotalCents: number }}
 *   One row per day 1..last day of the month, zero days included.
 */
export function buildDailyMethodMatrix(state, month) {
  const matrixMonth = validDailyMatrixMonth(month) ? month : pakistanMonth();
  const dayCount = lastDayOfDailyMatrixMonth(matrixMonth);

  // First pass: collect the month's counted payments in a deterministic
  // order so shop enumeration is stable for a given state.
  const counted = [];
  for (const customer of (state && Array.isArray(state.customers) ? state.customers : [])) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
        if (!payment || typeof payment !== 'object') continue;
        if (isVoidedPayment(payment)) continue;
        const date = typeof payment.date === 'string' ? payment.date : '';
        if (!DATE_RE.test(date) || date.slice(0, 7) !== matrixMonth) continue;
        counted.push({
          date,
          day: Number(date.slice(8, 10)),
          customerNumber: Number(customer.customerNumber) || 0,
          paymentId: String(payment.id ?? ''),
          amountCents: centsOf(payment.amount),
          bucket: classifyDailyMatrixPayment(payment)
        });
      }
    }
  }
  counted.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.customerNumber !== b.customerNumber) return a.customerNumber - b.customerNumber;
    return a.paymentId < b.paymentId ? -1 : a.paymentId > b.paymentId ? 1 : 0;
  });

  const shopNames = [];
  for (const row of counted) {
    if (row.bucket.bucket === 'shop' && !shopNames.includes(row.bucket.shop)) {
      shopNames.push(row.bucket.shop);
    }
  }

  const days = [];
  for (let day = 1; day <= dayCount; day += 1) days.push(emptyDay(day, shopNames));
  const totals = { directCashCents: 0, shops: {}, digitalCents: 0, receiptCount: 0, totalCents: 0 };
  for (const name of shopNames) totals.shops[name] = 0;

  for (const row of counted) {
    const target = days[row.day - 1];
    if (!target) continue;
    if (row.bucket.bucket === 'shop') {
      target.shops[row.bucket.shop] += row.amountCents;
      totals.shops[row.bucket.shop] += row.amountCents;
    } else if (row.bucket.bucket === 'direct') {
      target.directCashCents += row.amountCents;
      totals.directCashCents += row.amountCents;
    } else {
      target.digitalCents += row.amountCents;
      totals.digitalCents += row.amountCents;
    }
    target.receiptCount += 1;
    target.totalCents += row.amountCents;
    totals.receiptCount += 1;
    totals.totalCents += row.amountCents;
  }

  return { month: matrixMonth, shopNames, days, totals, grandTotalCents: totals.totalCents };
}

// ---------------------------------------------------------------------------
// Screen table (rendered inside the dialog; amounts via formatPKR).
// ---------------------------------------------------------------------------

function amountCell(cents) {
  return cents ? formatPKR(rupeesOf(cents)) : '—';
}

export function dailyMatrixTableHtml(matrix, lang = null) {
  const shops = Array.isArray(matrix?.shopNames) ? matrix.shopNames : [];
  const days = Array.isArray(matrix?.days) ? matrix.days : [];
  const totals = matrix?.totals ?? { directCashCents: 0, shops: {}, digitalCents: 0, receiptCount: 0, totalCents: 0 };
  const head = [
    `<th scope="col">${escapeHtml(t('dmm_col_day', lang))}</th>`,
    `<th scope="col" class="dmm-num">${escapeHtml(t('dmm_col_direct', lang))}</th>`,
    ...shops.map((name) => `<th scope="col" class="dmm-num">${escapeHtml(name)}</th>`),
    `<th scope="col" class="dmm-num">${escapeHtml(t('dmm_col_digital', lang))}</th>`,
    `<th scope="col" class="dmm-num">${escapeHtml(t('dmm_col_receipts', lang))}</th>`,
    `<th scope="col" class="dmm-num">${escapeHtml(t('dmm_col_total', lang))}</th>`
  ].join('');
  const body = days.map((row) => `<tr>
      <th scope="row">${escapeHtml(`${matrix.month}-${String(row.day).padStart(2, '0')}`)}</th>
      <td class="dmm-num">${escapeHtml(amountCell(row.directCashCents))}</td>
      ${shops.map((name) => `<td class="dmm-num">${escapeHtml(amountCell(row.shops?.[name] ?? 0))}</td>`).join('')}
      <td class="dmm-num">${escapeHtml(amountCell(row.digitalCents))}</td>
      <td class="dmm-num">${row.receiptCount || '—'}</td>
      <td class="dmm-num dmm-strong">${escapeHtml(amountCell(row.totalCents))}</td>
    </tr>`).join('');
  const foot = `<tr>
      <th scope="row">${escapeHtml(t('dmm_total_row', lang))}</th>
      <td class="dmm-num">${escapeHtml(amountCell(totals.directCashCents))}</td>
      ${shops.map((name) => `<td class="dmm-num">${escapeHtml(amountCell(totals.shops?.[name] ?? 0))}</td>`).join('')}
      <td class="dmm-num">${escapeHtml(amountCell(totals.digitalCents))}</td>
      <td class="dmm-num">${totals.receiptCount || '—'}</td>
      <td class="dmm-num dmm-strong">${escapeHtml(amountCell(totals.totalCents))}</td>
    </tr>`;
  return `<table class="daily-method-matrix-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`;
}

// ---------------------------------------------------------------------------
// CSV export — house filtered-export style (billing-register precedent):
// English columns, a NOTE row describing the view, `_filtered` filename.
// Serialized by the app's generateCsvContent helper.
// ---------------------------------------------------------------------------

// CSV columns stay English (house export style, billing-register
// precedent); only the column set is dynamic — one column per shop the
// month's data actually contains.
export function dailyMatrixCsvHeaders(matrix) {
  const shops = Array.isArray(matrix?.shopNames) ? matrix.shopNames : [];
  return [
    { key: 'day', label: 'Day' },
    { key: 'directCash', label: 'Direct Cash' },
    ...shops.map((name, index) => ({ key: `shop${index}`, label: name })),
    { key: 'digital', label: 'Digital (JazzCash/Easypaisa/Bank)' },
    { key: 'receipts', label: 'Receipts' },
    { key: 'total', label: 'Day Total' }
  ];
}

export function dailyMatrixCsvRows(matrix) {
  const shops = Array.isArray(matrix?.shopNames) ? matrix.shopNames : [];
  const toRow = (row, dayLabel) => {
    const out = {
      day: dayLabel,
      directCash: rupeesOf(row.directCashCents ?? 0),
      digital: rupeesOf(row.digitalCents ?? 0),
      receipts: row.receiptCount ?? 0,
      total: rupeesOf(row.totalCents ?? 0)
    };
    shops.forEach((name, index) => { out[`shop${index}`] = rupeesOf(row.shops?.[name] ?? 0); });
    return out;
  };
  const rows = (Array.isArray(matrix?.days) ? matrix.days : [])
    .map((row) => toRow(row, `${matrix.month}-${String(row.day).padStart(2, '0')}`));
  if (matrix?.totals) rows.push(toRow(matrix.totals, 'Total'));
  return rows;
}

export function dailyMatrixCsvNote(matrix) {
  const shops = Array.isArray(matrix?.shopNames) ? matrix.shopNames : [];
  const shopText = shops.length ? shops.join(', ') : 'no shop collections';
  return `Note: Filtered view: day-by-day collections for ${matrix?.month || ''} by payment method (Direct Cash; shops: ${shopText}; Digital) — non-voided payments only, counted on their recorded payment date; the CSV rows cover only this month's matrix.`;
}

export function dailyMatrixCsvFilename(matrix) {
  return `daily-method-matrix-${matrix?.month || 'month'}_filtered.csv`;
}

export function buildDailyMatrixCsv(matrix) {
  const headers = dailyMatrixCsvHeaders(matrix);
  const rows = dailyMatrixCsvRows(matrix);
  const note = dailyMatrixCsvNote(matrix);
  const noteRow = {};
  headers.forEach((header, index) => { noteRow[header.key] = index === 0 ? note : ''; });
  return generateCsvContent(headers, [noteRow, ...rows]);
}

// ---------------------------------------------------------------------------
// Print — house A4 pattern (expense-voucher-print precedent): standalone
// black-on-white document, printed via window.print ("Save as PDF").
// ---------------------------------------------------------------------------

export function generateDailyMethodMatrixPrintHtml({ matrix, lang = null, generatedDate = '' } = {}) {
  const shops = Array.isArray(matrix?.shopNames) ? matrix.shopNames : [];
  const days = Array.isArray(matrix?.days) ? matrix.days : [];
  const totals = matrix?.totals ?? { directCashCents: 0, shops: {}, digitalCents: 0, receiptCount: 0, totalCents: 0 };
  const printAmount = (cents) => (cents ? formatPKR(rupeesOf(cents)) : '—');
  const head = [
    `<th>${escapeHtml(t('dmm_col_day', lang))}</th>`,
    `<th class="amt">${escapeHtml(t('dmm_col_direct', lang))}</th>`,
    ...shops.map((name) => `<th class="amt">${escapeHtml(name)}</th>`),
    `<th class="amt">${escapeHtml(t('dmm_col_digital', lang))}</th>`,
    `<th class="amt">${escapeHtml(t('dmm_col_receipts', lang))}</th>`,
    `<th class="amt">${escapeHtml(t('dmm_col_total', lang))}</th>`
  ].join('');
  const bodyRows = days.map((row) => `
      <tr>
        <td class="date">${escapeHtml(`${matrix.month}-${String(row.day).padStart(2, '0')}`)}</td>
        <td class="amt">${escapeHtml(printAmount(row.directCashCents))}</td>
        ${shops.map((name) => `<td class="amt">${escapeHtml(printAmount(row.shops?.[name] ?? 0))}</td>`).join('')}
        <td class="amt">${escapeHtml(printAmount(row.digitalCents))}</td>
        <td class="amt">${row.receiptCount || '—'}</td>
        <td class="amt strong">${escapeHtml(printAmount(row.totalCents))}</td>
      </tr>`).join('');
  const footRow = `
      <tr class="grand">
        <td>${escapeHtml(t('dmm_total_row', lang))}</td>
        <td class="amt">${escapeHtml(printAmount(totals.directCashCents))}</td>
        ${shops.map((name) => `<td class="amt">${escapeHtml(printAmount(totals.shops?.[name] ?? 0))}</td>`).join('')}
        <td class="amt">${escapeHtml(printAmount(totals.digitalCents))}</td>
        <td class="amt">${totals.receiptCount || '—'}</td>
        <td class="amt strong">${escapeHtml(printAmount(totals.totalCents))}</td>
      </tr>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Daily Collection Method Matrix — ${escapeHtml(matrix?.month || '')}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; font-size: 11px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
        .brand { font-size: 19px; font-weight: 800; }
        .title { font-size: 14px; font-weight: 700; }
        .meta { font-size: 11px; text-align: right; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 4px 5px; text-align: left; vertical-align: top; }
        th { background: #eee; font-size: 10px; }
        td.date { white-space: nowrap; }
        td.amt, th.amt { text-align: right; white-space: nowrap; }
        td.strong { font-weight: 700; }
        tr.grand td { border-top: 2px solid #000; font-weight: 800; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">SHAHDARA FIBER NET</div>
          <div class="title">${escapeHtml(t('dmm_title', lang))}</div>
          <div>${escapeHtml(matrix?.month || '')}</div>
        </div>
        <div class="meta">
          <div>${escapeHtml(t('dmm_generated_on', lang, { date: generatedDate || '—' }))}</div>
          <div>${escapeHtml(t('dmm_summary', lang, { count: totals.receiptCount ?? 0, total: formatPKR(rupeesOf(totals.totalCents ?? 0)), month: matrix?.month || '' }))}</div>
        </div>
      </div>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>${footRow}</tfoot>
      </table>
    </body>
    </html>
  `;
}

// ---------------------------------------------------------------------------
// Dialog controller — mirrors setupExpenseVoucherDialog's wiring style:
// returns null when there is no DOM or no dialog markup. Rendering or
// exporting the matrix never writes any record.
// ---------------------------------------------------------------------------

export function setupDailyMethodMatrixDialog(getState, { onToast = null } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('dailyMethodMatrixDialog');
  if (!dialog) return null;

  const readState = () => (typeof getState === 'function' ? getState() : getState);
  const openBtn = document.getElementById('dailyMethodMatrixOpenBtn');
  const closeBtn = document.getElementById('dailyMethodMatrixCloseBtn');
  const closeSecondaryBtn = document.getElementById('dailyMethodMatrixCloseBtn2');
  const monthInput = document.getElementById('dailyMethodMatrixMonth');
  const summary = document.getElementById('dailyMethodMatrixSummary');
  const tableHost = document.getElementById('dailyMethodMatrixTableHost');
  const csvBtn = document.getElementById('dailyMethodMatrixCsvBtn');
  const printBtn = document.getElementById('dailyMethodMatrixPrintBtn');

  let currentMatrix = null;

  const render = () => {
    if (monthInput && !monthInput.value) monthInput.value = pakistanMonth();
    currentMatrix = buildDailyMethodMatrix(readState(), monthInput ? monthInput.value : undefined);
    if (summary) {
      summary.textContent = t('dmm_summary', null, {
        count: currentMatrix.totals.receiptCount,
        total: formatPKR(rupeesOf(currentMatrix.totals.totalCents)),
        month: currentMatrix.month
      });
    }
    if (tableHost) tableHost.innerHTML = dailyMatrixTableHtml(currentMatrix);
    return currentMatrix;
  };

  const openDialog = () => {
    if (dialog.showModal) dialog.showModal();
    else dialog.hidden = false;
    render();
  };
  const closeDialog = () => { if (dialog.close) dialog.close(); else dialog.hidden = true; };

  const print = () => {
    if (!currentMatrix) render();
    const generatedDate = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const html = generateDailyMethodMatrixPrintHtml({ matrix: currentMatrix, generatedDate });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } else if (typeof onToast === 'function') {
      onToast(t('dmm_popup_blocked'));
    }
  };

  const exportCsv = () => {
    if (!currentMatrix) render();
    downloadCsvFile(dailyMatrixCsvFilename(currentMatrix), buildDailyMatrixCsv(currentMatrix));
  };

  if (openBtn) openBtn.addEventListener('click', openDialog);
  if (closeBtn) closeBtn.addEventListener('click', closeDialog);
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', closeDialog);
  if (monthInput) monthInput.addEventListener('change', render);
  if (printBtn) printBtn.addEventListener('click', print);
  if (csvBtn) csvBtn.addEventListener('click', exportCsv);

  return {
    open: (month) => {
      if (monthInput && validDailyMatrixMonth(month)) monthInput.value = month;
      openDialog();
    },
    close: closeDialog,
    refresh: render,
    getMatrix: () => currentMatrix
  };
}

export { escapeHtml };
