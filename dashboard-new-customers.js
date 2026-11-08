/*
 * Dashboard new-customers strip — the customers who joined this
 * month, in one glance on the billing dashboard, so the owner sees
 * growth while it happens: every new name with its mohalla, its
 * package, and its monthly dues in PKR, plus the count.
 *
 * The strip is composed from the records the app already keeps —
 * nothing here edits a bill, a payment, or a customer. Who counts
 * as new this month follows the dashboard's own new-connections
 * rule verbatim: an explicit connection date first, then the date
 * the customer was added when there is no connection date, so the
 * strip count always agrees with the dashboard's new-connections
 * figure. Archived customers never appear. The dues shown are each
 * customer's own package price — the monthly selling amount on
 * their record — in PKR only, never converted; a free connection
 * owes PKR 0, and a customer with no usable selling amount reads
 * "Dues not recorded", never a guessed zero. Rows are ordered by
 * the date they joined, earliest first, then name A–Z. A month
 * with no new customers reads zero with a plain empty state,
 * never a blank.
 */

import { formatPKR } from './core.js?v=1.11.0';
import { escapeHtml } from './dashboard-daily-closing.js?v=1.11.0';
import { t } from './nav-language.js?v=1.11.0';
import { pktMonth, canonicalMohalla } from './phase3.js?v=1.11.0';

const UNASSIGNED_LABEL = 'Unassigned';

/**
 * Reads one customer's monthly dues in integer cents from their
 * own package price. A free connection owes nothing, so it reads
 * PKR 0. A customer with no usable selling amount has no dues
 * figure to show, so it reads null — never a guessed zero.
 *
 * @param {Object} customer - The customer record
 * @returns {number|null} The monthly dues in cents, or null
 */
function monthlyDuesCents(customer) {
  if (customer?.isFreeConnection === true) return 0;
  const amount = customer?.monthlySellingAmount;
  if (amount === null || amount === undefined || amount === '') return null;
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/**
 * Reads the mohalla label for one customer: the canonical label
 * for the stored mohalla (or area), the stored text itself when
 * it is not a known mohalla, and Unassigned when nothing is
 * recorded.
 *
 * @param {Object} customer - The customer record
 * @returns {string} The mohalla label to show
 */
function customerMohallaLabel(customer) {
  const raw = customer?.mohalla || customer?.area;
  const canonical = canonicalMohalla(raw);
  if (canonical?.label) return canonical.label;
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text || UNASSIGNED_LABEL;
}

/**
 * Lists the customers who joined in the reference month.
 *
 * @param {Object} state - The app state
 * @param {Date} referenceDate - The dashboard's own day; the
 *   month is read from it in Pakistan time
 * @returns {Object} The month, the new customers in join order,
 *   and the count
 */
export function calculateNewCustomers(state, referenceDate) {
  const month = pktMonth(referenceDate);
  const customers = [];
  for (const customer of state?.customers ?? []) {
    if (customer?.archived) continue;
    // The dashboard's own new-connections rule, verbatim: an
    // explicit connection date first, then the added date when
    // there is no connection date.
    const connMonth = typeof customer.connectionDate === 'string' ? customer.connectionDate.slice(0, 7) : null;
    const addedMonth = typeof customer.addedOn === 'string' ? customer.addedOn.slice(0, 7) : null;
    if (!(connMonth === month || (!connMonth && addedMonth === month))) continue;
    const joinedDate = typeof customer.connectionDate === 'string' ? customer.connectionDate : customer.addedOn;
    customers.push({
      name: customer.name ?? '',
      mohalla: customerMohallaLabel(customer),
      package: typeof customer.packageSpeed === 'string' ? customer.packageSpeed.trim() : '',
      duesCents: monthlyDuesCents(customer),
      joinedDate: typeof joinedDate === 'string' ? joinedDate : ''
    });
  }
  customers.sort((a, b) => {
    if (a.joinedDate !== b.joinedDate) return a.joinedDate < b.joinedDate ? -1 : 1;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return 0;
  });
  return { month, customers, customerCount: customers.length };
}

/**
 * Builds the strip rows HTML: one row per new customer, with the
 * name, the monthly dues in PKR, and the mohalla and package.
 * A customer with no package reads "No package", and a customer
 * with no usable selling amount reads "Dues not recorded" —
 * never a guessed figure.
 *
 * @param {Object} summary - Output of calculateNewCustomers
 * @returns {string} The row items HTML
 */
export function newCustomersSectionHtml(summary) {
  const customers = Array.isArray(summary?.customers) ? summary.customers : [];
  return customers.map((customer) => {
    const dues = customer.duesCents === null || customer.duesCents === undefined
      ? t('dash_newcustomers_dues_not_recorded')
      : formatPKR((customer.duesCents ?? 0) / 100);
    const packageLabel = customer.package ? customer.package : t('dash_newcustomers_no_package');
    const meta = `${customer.mohalla} · ${packageLabel}`;
    return `<li><span class="provider-breakdown-name">${escapeHtml(customer.name)}</span><strong>${escapeHtml(dues)}</strong><span class="provider-breakdown-meta">${escapeHtml(meta)}</span></li>`;
  }).join('');
}

/**
 * Renders the new-customers strip into the billing dashboard.
 *
 * @param {Document} doc - The host page for the strip
 * @param {Object} summary - Output of calculateNewCustomers
 */
export function renderNewCustomers(doc, summary) {
  if (!doc || !summary) return;
  const count = summary.customerCount ?? 0;
  const totalEl = doc.getElementById('ncmNewTotal');
  if (totalEl) totalEl.textContent = String(count);
  const lineEl = doc.getElementById('ncmNewLine');
  if (lineEl) {
    lineEl.textContent = t(count === 1 ? 'dash_newcustomers_count_sing' : 'dash_newcustomers_count_plur', null, { count });
  }
  const rowsEl = doc.getElementById('ncmNewRows');
  if (rowsEl) rowsEl.innerHTML = newCustomersSectionHtml(summary);
  const emptyEl = doc.getElementById('ncmNewEmpty');
  if (emptyEl) emptyEl.hidden = count > 0;
}
