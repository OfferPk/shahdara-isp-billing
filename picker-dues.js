/*
 * Plan 488 — dues beside each name on the Add payment customer
 * picker.
 *
 * The picker used to show names only on its two live lookup lists
 * (the name-prefix list of Plan 427 and the last-four-digits list
 * of Plan 441), so the operator had to open each customer to check
 * what they owe before choosing — and could pick the wrong
 * namesake. This module is the missing piece: one dues-and-status
 * line per lookup row, read from that customer's own records and
 * nothing else.
 *
 * The line carries two things, in plain words:
 *
 * - dues in PKR — the same figure the status filter of Plan 452
 *   computes and the search enrichment of Plan 463 shows: the
 *   allocation engine's positive bill balances summed over the
 *   customer's bills, in integer cents. A manual baqaya is a
 *   separate record the search sheet does not display, so it is
 *   never part of this figure; the picker row and the sheet agree
 *   exactly. A customer with no dues shows PKR 0, never a blank.
 * - the account status in plain words — the dues state first
 *   (Overdue, Due, or Paid up, from the app's own rules), then
 *   Suspended when the customer holds an open suspension record,
 *   then New when the customer was added in the current month.
 *
 * Scope, pinned: the two live lookup lists only. The picker's main
 * list and the recent-customers row already show dues (the picker's
 * own shared total, bills plus unpaid manual baqaya, with DUE and
 * SETTLED tags), so they are untouched — changing their figure
 * would rewrite the behaviour those plans pinned. The caller
 * passes the context the sheet already computes (the allocation
 * engine, the open suspension ids, the current month, and the
 * reference date); this module never reads storage, the clock, the
 * network, or the page, never changes any bill, payment, or
 * customer record, adds no new field, and keeps no store.
 */

import { searchResultEnrichment } from './search-result-enrichment.js';

/** Escapes HTML characters for safe template string interpolation. */
function escapePickerDuesHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

// PKR in the plan modules' own shape: min-0 decimals, never more
// than two (PKR 3,000 · PKR 1,500.5). A null/undefined/empty/boolean
// figure is "not a number", never zero — a missing dues figure must
// never be printed as PKR 0 by this helper; the enrichment below
// always carries a real figure, so a row never has to guess.
export function finitePickerDuesCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
}

export function formatPickerDuesAmount(cents) {
  const finite = finitePickerDuesCents(cents);
  if (finite === null) return null;
  const rupees = finite / 100;
  return `PKR ${rupees.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * The dues and status for one picker row: the dues in cents and the
 * account status labels in display order, straight from the search
 * enrichment — the same figure and the same labels the fast sheet
 * shows for this customer, so the two surfaces never disagree.
 */
export function pickerDuesEnrichment(customer, context = {}) {
  const enrichment = searchResultEnrichment(customer, context);
  return {
    duesCents: enrichment.duesCents,
    statusLabels: enrichment.statusLabels,
  };
}

/**
 * The one-line dues display for a picker row, in plain words: the
 * dues in PKR, then the status labels. A customer with no dues
 * shows PKR 0, never a blank; a row with no status labels at all
 * shows the amount on its own, never a half-empty line.
 */
export function pickerDuesText(enrichment) {
  const amount = formatPickerDuesAmount(enrichment?.duesCents);
  const shown = amount === null ? 'PKR 0' : amount;
  const labels = Array.isArray(enrichment?.statusLabels)
    ? enrichment.statusLabels.map((label) => String(label ?? '').trim()).filter(Boolean)
    : [];
  if (labels.length === 0) return shown;
  return `${shown} · ${labels.join(' · ')}`;
}

/**
 * The dues-and-status line for one picker row, as HTML: the amount
 * and the status in plain words, reusing the row's own meta styling,
 * so no new class is introduced. A row with no usable enrichment
 * renders nothing rather than a guessed figure.
 */
export function pickerDuesLineHtml(enrichment) {
  if (!enrichment || typeof enrichment !== 'object') return '';
  const text = pickerDuesText(enrichment);
  return `<span class="qc-cust-meta">${escapePickerDuesHtml(text)}</span>`;
}

/**
 * The dues-and-status text for each listed customer, keyed by
 * customer id: one entry per match that has a usable record, so the
 * lookup renderer can show the line beside the name and mohalla
 * without opening the profile. A match with no record on file gets
 * no entry — its row renders as before, never with a guessed
 * figure. The input lists are never mutated.
 */
export function pickerDuesTextForMatches(customers, matches, context = {}) {
  const byId = new Map();
  for (const customer of (Array.isArray(customers) ? customers : [])) {
    if (!customer || typeof customer !== 'object') continue;
    if (typeof customer.id !== 'string' || !customer.id) continue;
    if (!byId.has(customer.id)) byId.set(customer.id, customer);
  }
  const lines = new Map();
  for (const match of (Array.isArray(matches) ? matches : [])) {
    const id = String(match?.id ?? '').trim();
    if (!id || lines.has(id)) continue;
    const customer = byId.get(id);
    if (!customer) continue;
    lines.set(id, pickerDuesText(pickerDuesEnrichment(customer, context)));
  }
  return lines;
}
