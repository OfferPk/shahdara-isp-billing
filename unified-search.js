/*
 * Plan 468 — unified search across customers and ledger.
 *
 * The operator used to choose up front whether to search customers
 * or search the ledger, but the question at the counter is often
 * just "find everything about Ahmed" — his profile and his payments
 * together. This module is the missing piece: the payments side of
 * the fast search sheet, so one typed query answers the whole
 * question in two labelled groups — the matching customers above,
 * the matching ledger entries below — instead of two separate
 * searches on two screens.
 *
 * Nothing here is a new matcher. The payments side reads the ledger
 * exactly the way the ledger's own live search reads it: the same
 * three-character threshold, the same name, phone, amount, and
 * customer-number matching (with the same phonetic matcher for
 * Roman-Urdu spelling variants), the same order the ledger arrives
 * in. The date on each row reads the way the payments list reads
 * it, and the amount is PKR only, never converted. A voided entry
 * still lists as history, the way the ledger lists it — labelled
 * Voided, never counted as collected cash.
 *
 * The module is pure and reads only: it takes the app state and the
 * typed query and returns plain data or an HTML string. It never
 * changes any customer, bill, or payment record, adds no customer,
 * and keeps no store. The customer chips on the sheet do not narrow
 * the payments: the section follows the typed query only, exactly
 * as the ledger's own live search does.
 */

import { listTransactions } from './core.js';
import { searchLedgerLive, normalizeLiveLedgerSearch } from './ledger-live-search.js';
import { paymentDayLabel } from './payments-list.js';

/** The payments side goes live at three typed characters, the same threshold as the ledger's own live search. */
export const UNIFIED_SEARCH_MIN_CHARS = 3;

/** The total, formatted the way the ledger's summary bar shows it. */
function formatUnifiedSearchPkrAmount(amount) {
  return `PKR ${Math.round(Number(amount) || 0).toLocaleString('en-PK')}`;
}

/** Escapes HTML characters for safe template string interpolation. */
function escapeUnifiedSearchHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/**
 * The ledger entries matching the typed query, in ledger order.
 * An inactive query — blank, one or two characters, or a
 * non-string value — returns no entries at all, so the payments
 * section stays hidden until the search goes live; the full
 * ledger is never dumped into the sheet. The input state and its
 * entries are never mutated — the result is a new array.
 */
export function searchUnifiedPayments(state, query) {
  const search = normalizeLiveLedgerSearch(query);
  if (!search.active) return [];
  if (!state || !Array.isArray(state.customers)) return [];
  return searchLedgerLive(listTransactions(state), search.query);
}

/** The plain message for a typed query that matches no payment. */
export function unifiedPaymentsEmptyText(query) {
  const search = normalizeLiveLedgerSearch(query);
  if (!search.active) return '';
  return `No payments match "${search.query}".`;
}

/**
 * One payment row: the payer's name, the day label and method,
 * and the amount in PKR. The row reuses the search sheet's own
 * card shell for its look, but it carries no customer id and no
 * action buttons — it is a read-only display row, so the sheet's
 * keyboard navigation and click delegation never touch it. A
 * voided entry reads Voided on the amount label, never Paid.
 */
function unifiedPaymentRowHtml(entry, today) {
  const number = entry?.customerNumber ?? '';
  const name = String(entry?.customerName ?? entry?.paidBy ?? '').trim();
  const day = paymentDayLabel(entry?.date, today);
  const method = String(entry?.method ?? '').trim() || 'Other';
  const voided = entry?.voided === true;
  return `
    <article class="fcs-card">
      <div class="fcs-card-main">
        <div class="fcs-avatar">#${escapeUnifiedSearchHtml(String(number))}</div>
        <div class="fcs-info">
          <div class="fcs-name-row">
            <strong class="fcs-name">${escapeUnifiedSearchHtml(name)}</strong>
          </div>
          <div class="fcs-meta-row">
            <span>${escapeUnifiedSearchHtml(day)} · ${escapeUnifiedSearchHtml(method)}</span>
          </div>
        </div>
        <div class="fcs-dues-col">
          <span class="fcs-dues-label">${voided ? 'Voided' : 'Paid'}</span>
          <strong class="fcs-dues-val${voided ? '' : ' settled'}">${escapeUnifiedSearchHtml(formatUnifiedSearchPkrAmount(entry?.amount))}</strong>
        </div>
      </div>
    </article>`;
}

/**
 * The labelled Payments section HTML for the fast search sheet:
 * a "Payments" header with the count, then one row per matched
 * entry. An active search with no match says so plainly under
 * the header, so each group speaks for itself. An inactive
 * search returns '' — the section hides entirely until three
 * characters are typed.
 */
export function unifiedPaymentsSectionHtml(entries, query, today) {
  const search = normalizeLiveLedgerSearch(query);
  if (!search.active) return '';
  const list = Array.isArray(entries) ? entries : [];
  const countWord = list.length === 1 ? 'payment' : 'payments';
  const rows = list.map((entry) => unifiedPaymentRowHtml(entry, today)).join('');
  return `
    <div class="fcs-section-header">
      <h3 class="fcs-section-title">Payments</h3>
      <span class="fcs-count-badge">${list.length} ${countWord}</span>
    </div>
    ${rows || `<div class="fcs-meta-row"><span>${escapeUnifiedSearchHtml(unifiedPaymentsEmptyText(query))}</span></div>`}
  `;
}
