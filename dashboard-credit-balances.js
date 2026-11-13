/*
 * Dashboard credit balances total — one plain total on the
 * billing dashboard, so the owner sees at a glance, in rupees,
 * how much credit customers hold with the shop in total, and
 * how many customers hold it. Customers who overpaid hold
 * credit with the shop, and without this line that money is
 * forgotten until a customer asks for it, so it is never
 * honoured on the next bill.
 *
 * The total is composed from the credit records the app already
 * keeps — nothing here edits a bill, a payment, or a customer.
 * One credit-balance record per customer, built from entries
 * created only from an identified overpayment or an approved
 * adjustment, read the way Plan 103 reads them: credit in
 * minus credit applied, in integer cents, so the total is the
 * sum of the individual customer credit balances. Only a
 * customer whose remaining credit is positive holds credit,
 * so only they count towards the total and the count; a fully
 * applied credit reads zero and never appears. Archived
 * customers never appear, and a credit entry naming no
 * customer on record contributes nothing, never a guessed
 * amount. The total has no month scope: credit stays
 * outstanding until it is applied to a bill, whenever that
 * is. A business with no credit outstanding shows zero,
 * never a blank. All money is PKR only, never converted to
 * any other currency. The caller passes the credit entries
 * and applications in, so this module reads no store, clock,
 * or page itself.
 */

import { creditBalanceForCustomer, normalizeCreditEntryList, normalizeCreditApplicationList } from './credit-balance.js';
import { formatPKR } from './core.js';
import { t } from './nav-language.js';

/**
 * Reads the credit-balances total, in integer cents: the sum of
 * the remaining credit of every customer who still holds
 * credit, plus the count of customers behind it.
 *
 * @param {Object} state - The app state
 * @param {Array} entries - The credit entries, read the way the
 *   credit screen reads them
 * @param {Array} applications - The credit applications, read
 *   the way the credit screen reads them
 * @returns {Object} { amountCents, count } — money in integer
 *   cents; count is the number of customers holding credit
 */
export function calculateCreditBalances(state, entries, applications) {
  const summary = { amountCents: 0, count: 0 };
  const safeEntries = normalizeCreditEntryList(entries);
  const safeApplications = normalizeCreditApplicationList(applications);
  const customers = new Map();
  for (const customer of state?.customers ?? []) {
    const id = typeof customer?.id === 'string' ? customer.id.trim() : '';
    if (!id || customers.has(id)) continue;
    customers.set(id, customer);
  }
  const seen = new Set();
  for (const entry of safeEntries) {
    const customerId = entry.customerId;
    if (seen.has(customerId)) continue;
    seen.add(customerId);
    const customer = customers.get(customerId);
    if (!customer || customer.archived) continue;
    const remaining = creditBalanceForCustomer(safeEntries, safeApplications, customerId).remainingCents;
    if (remaining <= 0) continue;
    summary.amountCents += remaining;
    summary.count += 1;
  }
  return summary;
}

/**
 * Reads the count line in plain words: how many customers hold
 * credit with the shop.
 *
 * @param {Object} summary - Output of calculateCreditBalances
 * @returns {string} The plain-word count line
 */
export function creditBalancesCountText(summary) {
  const count = summary?.count ?? 0;
  return t(count === 1 ? 'dash_creditbal_count_sing' : 'dash_creditbal_count_plur', null, { count });
}

/**
 * Renders the credit-balances total into the billing dashboard.
 *
 * @param {Document} doc - The host page for the view
 * @param {Object} summary - Output of calculateCreditBalances
 */
export function renderDashboardCreditBalances(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('crbCreditTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.amountCents ?? 0) / 100);
  const lineEl = doc.getElementById('crbCreditLine');
  if (lineEl) lineEl.textContent = creditBalancesCountText(summary);
  const emptyEl = doc.getElementById('crbCreditEmpty');
  if (emptyEl) emptyEl.hidden = (summary.count ?? 0) > 0;
  // Collect Tab polish: no credit outstanding collapses the card to
  // one compact row (same class as the upcoming-dues card above).
  const card = totalEl?.closest?.('.collection-forecast-card');
  if (card?.classList) card.classList.toggle('collection-forecast-card--compact-zero', (summary.count ?? 0) === 0);
}
