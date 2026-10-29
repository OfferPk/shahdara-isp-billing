/**
 * expense-voucher-print.js — SISP-60 [P2]: Offline Printable Monthly
 * Expense & Partner Sign-Off Voucher Book
 * ("ماہانہ اخراجات اور پارٹنر واؤچر پرنٹ بک").
 *
 * Spec (read-latest.txt, SISP-60 block): "Assign sequential voucher
 * codes (EXP-YYYYMM-01+) to monthly expenses, Saad payouts, and partner
 * drawings, and provide a 1-click printable PDF/A4 Monthly Expense &
 * Partner Sign-Off Sheet with signature blocks for Nasir and Aqib."
 * Test criterion: "Generating the Expense Voucher Sheet for 2026-10
 * lists all October expenses and partner drawings with accurate
 * subtotals and dual signature blocks."
 *
 * Sources of truth ONLY — nothing is recomputed in parallel, nothing
 * is written, and no record is ever mutated by this module:
 *   - Monthly expenses = state.expenses for the chosen month. That
 *     ledger already contains the SISP-45 Roznamcha mirror rows and
 *     the SISP-56 Saad payout mirrors (category 'Salary — Saad'), so
 *     Saad payouts appear exactly once, as their real expense rows.
 *     Saad payments are NEVER read from the saad-visits store here —
 *     that would double-count them.
 *   - Partner drawings = the SISP-22 partner ledger
 *     (localStorage key sisp_partner_ledger_v1, partner-settlement.js),
 *     entries of type 'drawing' for the month, passed through that
 *     module's own sanitizer. Capital/out-of-pocket entries are NOT
 *     drawings and are not vouchers: they are money a partner paid
 *     INTO the business, so they never appear on an expense sheet.
 *
 * Voucher codes are DERIVED at render time, never stored: the month's
 * voucher rows (expenses + drawings together) are sorted by
 * (date, then stable record id, then kind/category/amount/note as
 * final tie-breakers) and numbered EXP-YYYYMM-01, -02, … in that
 * order. The same unchanged data therefore yields the same code for
 * the same row on every generation — no data-model change, no
 * migration, and backups are untouched by construction.
 *
 * Subtotals are plain sums of the printed rows (integer cents
 * internally): expenses subtotal, drawings subtotal, grand total.
 * The print sheet follows the house print conventions (SISP-55 zone
 * sheet, Daily Closing): a standalone HTML document, black on white,
 * printed via window.print ("Save as PDF" in the browser dialog).
 */

import { formatPKR, monthsForHistory } from './core.js';
import { pktMonth } from './phase3.js';
import {
  sanitizePartnerLedgerEntries,
  partnerMonthLabel
} from './partner-settlement.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const VOUCHER_CODE_PREFIX = 'EXP';

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
  return cents / 100;
}

/** The voucher code for the row at `index` (0-based) in `month`. */
export function voucherCodeFor(month, index) {
  const yyyymm = String(month || '').replace('-', '');
  return `${VOUCHER_CODE_PREFIX}-${yyyymm}-${String(index + 1).padStart(2, '0')}`;
}

/**
 * Deterministic row order: date first, then the stable record id,
 * then kind/category/amount/note so even two records sharing a date
 * and id shape can never swap places between generations.
 */
function compareVoucherRows(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  if (a.category !== b.category) return a.category < b.category ? -1 : 1;
  if (a.amountCents !== b.amountCents) return a.amountCents - b.amountCents;
  return String(a.note || '').localeCompare(String(b.note || ''));
}

/**
 * Builds the Expense Voucher Book model for one month. Pure and
 * read-only: state and partner entries are never mutated.
 *
 * @param {Object} state - Full application state (uses state.expenses)
 * @param {Array} partnerEntries - Raw SISP-22 partner ledger entries
 *   (sanitized here via partner-settlement.js); only type 'drawing'
 *   rows for the month become vouchers.
 * @param {Object} [options]
 * @param {string} [options.month] - 'YYYY-MM'; defaults to the
 *   reference date's PKT month.
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Object} Book model: rows[] (each with its derived voucher
 *   code), expenses/drawings subtotals and the grand total — all plain
 *   sums of the printed rows.
 */
export function buildExpenseVoucherBook(state, partnerEntries, {
  month = null,
  referenceDate = new Date()
} = {}) {
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const bookMonth = MONTH_RE.test(String(month || '')) ? String(month) : pktMonth(ref);

  const rows = [];

  // Expenses: state.expenses dated inside the chosen month. This one
  // ledger already carries the Roznamcha mirrors (SISP-45) and the
  // Saad payout mirrors (SISP-56) — a Saad payout is its expense row,
  // counted exactly once.
  const expenses = Array.isArray(state?.expenses) ? state.expenses : [];
  expenses.forEach((expense, index) => {
    if (!expense || typeof expense !== 'object') return;
    if (typeof expense.date !== 'string' || !DATE_RE.test(expense.date)) return;
    if (expense.date.slice(0, 7) !== bookMonth) return;
    const amountCents = centsOf(expense.amount);
    if (amountCents <= 0) return;
    const noteParts = [];
    if (typeof expense.notes === 'string' && expense.notes.trim()) noteParts.push(expense.notes.trim());
    const area = typeof expense.area === 'string' ? expense.area.trim()
      : (typeof expense.mohalla === 'string' ? expense.mohalla.trim() : '');
    rows.push({
      kind: 'expense',
      sourceId: typeof expense.id === 'string' && expense.id ? expense.id : `expense-row-${index}`,
      date: expense.date,
      category: typeof expense.category === 'string' && expense.category.trim() ? expense.category.trim() : '',
      partner: '',
      note: noteParts.join(' · '),
      area,
      amountCents
    });
  });

  // Partner drawings: SISP-22 ledger entries of type 'drawing' only.
  for (const entry of sanitizePartnerLedgerEntries(partnerEntries)) {
    if (entry.type !== 'drawing') continue;
    if (entry.month !== bookMonth) continue;
    rows.push({
      kind: 'drawing',
      sourceId: entry.id,
      date: entry.date,
      category: '',
      partner: entry.partner,
      note: typeof entry.note === 'string' ? entry.note.trim() : '',
      area: '',
      amountCents: centsOf(entry.amount)
    });
  }

  rows.sort(compareVoucherRows);

  let expensesCents = 0;
  let drawingsCents = 0;
  const codedRows = rows.map((row, index) => {
    if (row.kind === 'drawing') drawingsCents += row.amountCents;
    else expensesCents += row.amountCents;
    return { ...row, code: voucherCodeFor(bookMonth, index), amount: rupeesOf(row.amountCents) };
  });

  return {
    month: bookMonth,
    monthLabel: partnerMonthLabel(bookMonth),
    rows: codedRows,
    expenseCount: codedRows.filter(row => row.kind === 'expense').length,
    drawingCount: codedRows.filter(row => row.kind === 'drawing').length,
    expensesSubtotal: rupeesOf(expensesCents),
    drawingsSubtotal: rupeesOf(drawingsCents),
    grandTotal: rupeesOf(expensesCents + drawingsCents)
  };
}

function rowDescription(row, lang) {
  if (row.kind === 'drawing') return t('evouch_drawing_desc', lang, { partner: row.partner });
  return row.category || '';
}

function rowNotes(row) {
  const parts = [];
  if (row.kind === 'drawing' && row.partner) parts.push(row.partner);
  if (row.note) parts.push(row.note);
  if (row.area) parts.push(row.area);
  return parts.join(' · ');
}

/**
 * Generates the printable Monthly Expense & Partner Sign-Off Sheet
 * (A4). Paper output follows the app's print conventions: a standalone
 * HTML document, black on white. Labels follow the requested language
 * via t(); recorded data (categories, notes, partner names) prints as
 * stored. Signature blocks for BOTH partners (Nasir and Aqib) plus the
 * prepared-by/owner line always print, even for an empty month.
 *
 * @param {Object} params
 * @param {Object} params.book - Output of buildExpenseVoucherBook
 * @param {string} [params.lang] - 'en' or 'ur'
 * @param {string} [params.generatedDate] - YYYY-MM-DD stamp
 * @returns {string} HTML document string
 */
export function generateExpenseVoucherPrintHtml({ book, lang = null, generatedDate = '' } = {}) {
  const rows = Array.isArray(book?.rows) ? book.rows : [];
  const month = book?.month || '';
  const monthLabel = book?.monthLabel || month;

  const bodyRows = rows.map(row => `
      <tr>
        <td class="code">${escapeHtml(row.code)}</td>
        <td class="date">${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.kind === 'drawing' ? t('evouch_type_drawing', lang) : t('evouch_type_expense', lang))}</td>
        <td>${escapeHtml(rowDescription(row, lang))}</td>
        <td>${escapeHtml(rowNotes(row) || '—')}</td>
        <td class="amt">${formatPKR(row.amount)}</td>
      </tr>`).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Expense Voucher Sheet — ${escapeHtml(month)}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; font-size: 12px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
        .brand { font-size: 19px; font-weight: 800; }
        .title { font-size: 14px; font-weight: 700; }
        .meta { font-size: 11px; text-align: right; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #eee; font-size: 11px; }
        td.code { font-weight: 700; white-space: nowrap; }
        td.date { white-space: nowrap; }
        td.amt, th.amt { text-align: right; white-space: nowrap; }
        tr.subtotal td { background: #f3f3f3; font-weight: 700; }
        tr.grand td { border-top: 2px solid #000; font-weight: 800; font-size: 13px; }
        .empty { text-align: center; padding: 22px; font-size: 12px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 34px; font-size: 11px; gap: 18px; }
        .sig { flex: 1; text-align: center; }
        .sig .line { border-top: 1px solid #000; margin-bottom: 4px; height: 28px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">SHAHDARA FIBER NET</div>
          <div class="title">${escapeHtml(t('evouch_sheet_title', lang))}</div>
          <div>${escapeHtml(monthLabel)} · ${escapeHtml(month)}</div>
        </div>
        <div class="meta">
          <div>${escapeHtml(t('evouch_generated_on', lang, { date: generatedDate || '—' }))}</div>
          <div>${rows.length} ${escapeHtml(t('evouch_col_code', lang))}</div>
        </div>
      </div>
      ${rows.length ? `
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('evouch_col_code', lang))}</th>
            <th>${escapeHtml(t('evouch_col_date', lang))}</th>
            <th>${escapeHtml(t('evouch_col_type', lang))}</th>
            <th>${escapeHtml(t('evouch_col_description', lang))}</th>
            <th>${escapeHtml(t('evouch_col_notes', lang))}</th>
            <th class="amt">${escapeHtml(t('evouch_col_amount', lang))}</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
          <tr class="subtotal">
            <td colspan="5">${escapeHtml(t('evouch_expenses_subtotal', lang))}</td>
            <td class="amt">${formatPKR(book.expensesSubtotal || 0)}</td>
          </tr>
          <tr class="subtotal">
            <td colspan="5">${escapeHtml(t('evouch_drawings_subtotal', lang))}</td>
            <td class="amt">${formatPKR(book.drawingsSubtotal || 0)}</td>
          </tr>
          <tr class="grand">
            <td colspan="5">${escapeHtml(t('evouch_grand_total', lang))}</td>
            <td class="amt">${formatPKR(book.grandTotal || 0)}</td>
          </tr>
        </tbody>
      </table>` : `<div class="empty">${escapeHtml(t('evouch_empty', lang))}</div>`}
      <div class="signatures">
        <div class="sig"><div class="line"></div>${escapeHtml(t('evouch_sign_prepared', lang))}</div>
        <div class="sig"><div class="line"></div>${escapeHtml(t('evouch_sign_nasir', lang))}</div>
        <div class="sig"><div class="line"></div>${escapeHtml(t('evouch_sign_aqib', lang))}</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Controller for the Expense Voucher Book dialog (opened from the
 * Expenses ledger toolbar). Mirrors setupZoneSheetDialog's wiring
 * style: returns null when there is no DOM or no dialog markup.
 * Generating or printing the sheet never writes any record.
 *
 * @param {Object|Function} getState - State object or () => state
 * @param {Object} [options]
 * @param {Function} [options.getPartnerEntries] - () => raw SISP-22
 *   partner ledger entries (defaults to an empty list)
 * @param {Function} [options.onToast]
 * @returns {Object|null} Controller { open, close, refresh, getBook }
 */
export function setupExpenseVoucherDialog(getState, { getPartnerEntries = null, onToast = null } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('expenseVoucherDialog');
  if (!dialog) return null;

  const readState = () => (typeof getState === 'function' ? getState() : getState);
  const readEntries = () => {
    try {
      const value = typeof getPartnerEntries === 'function' ? getPartnerEntries() : getPartnerEntries;
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const openBtn = document.getElementById('expenseVoucherOpenBtn');
  const closeBtn = document.getElementById('expenseVoucherCloseBtn');
  const closeSecondaryBtn = document.getElementById('expenseVoucherCloseBtn2');
  const monthSelect = document.getElementById('expenseVoucherMonthSelect');
  const preview = document.getElementById('expenseVoucherPreview');
  const printBtn = document.getElementById('expenseVoucherPrintBtn');

  let currentBook = null;

  const render = () => {
    if (monthSelect && !monthSelect.options.length) {
      monthsForHistory(new Date()).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monthSelect.appendChild(opt);
      });
    }
    currentBook = buildExpenseVoucherBook(readState(), readEntries(), {
      month: monthSelect ? monthSelect.value : null
    });
    if (preview) {
      preview.textContent = currentBook.rows.length
        ? t('evouch_preview', null, {
          count: currentBook.rows.length,
          total: formatPKR(currentBook.grandTotal)
        })
        : t('evouch_preview_empty');
    }
    return currentBook;
  };

  const print = () => {
    if (!currentBook) render();
    const generatedDate = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const html = generateExpenseVoucherPrintHtml({ book: currentBook, generatedDate });
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } else if (typeof onToast === 'function') {
      onToast(t('evouch_popup_blocked'));
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
  if (monthSelect) monthSelect.addEventListener('change', render);
  if (printBtn) printBtn.addEventListener('click', print);

  return {
    open: (month) => {
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      render();
      if (month && monthSelect) {
        monthSelect.value = month;
        render();
      }
    },
    close: () => { dialog.close?.() || (dialog.hidden = true); },
    refresh: render,
    getBook: () => currentBook
  };
}

export { escapeHtml };
