/*
 * Dashboard customers with no payment this month yet — the quiet
 * customers, named in rupees before the month ends, so a reminder
 * goes out while there is still time to pay: every customer with
 * no payment recorded this month, with their mohalla and the
 * amount they still owe in PKR, plus the count and the total
 * outstanding.
 *
 * The view is composed from the records the app already keeps —
 * nothing here edits a bill, a payment, or a customer. A payment
 * counts when it is a non-voided payment with a positive amount
 * dated in the reference month, the same way the area
 * collections view counts a month's cash, so a voided receipt
 * is history and never counts as paid, and a payment dated
 * last month never rescues this month. The list is exactly the
 * customers with no such payment and no other: a customer who
 * owes nothing still appears, with PKR 0, so the operator reads
 * the dues figure before sending any reminder. Archived
 * customers never appear. The dues shown are the positive
 * remaining balances of every priced bill, read through the
 * allocation engine, so a bill paid in full counts for nothing
 * and a partly paid bill counts only its remainder; a free
 * connection never owes anything, so it reads PKR 0, and a bill
 * with no usable month never contributes — no month is ever
 * invented. Rows are ordered largest dues first, then name
 * A–Z, so the biggest outstanding amount is named first. A
 * month in which everyone has paid reads zero with a plain
 * empty state, never a blank. All money is PKR only, never
 * converted to any other currency.
 */

import { calculatePaymentAllocations, formatPKR } from './core.js?v=1.11.0';
import { escapeHtml } from './dashboard-daily-closing.js?v=1.11.0';
import { t } from './nav-language.js?v=1.11.0';
import { pktMonth, canonicalMohalla } from './phase3.js?v=1.11.0';

const MONTH_RE = /^\d{4}-\d{2}$/;
const UNASSIGNED_LABEL = 'Unassigned';

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
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
 * Says whether the customer has a payment recorded in the
 * reference month: a non-voided payment with a positive amount
 * dated in that month. A voided receipt is history, never a
 * payment, and a zero-amount record pays nothing.
 *
 * @param {Object} customer - The customer record
 * @param {string} month - The reference month, YYYY-MM
 * @returns {boolean} True when a payment is recorded this month
 */
function hasPaymentInMonth(customer, month) {
  const bills = Array.isArray(customer?.bills) ? customer.bills : [];
  for (const bill of bills) {
    const payments = Array.isArray(bill?.payments) ? bill.payments : [];
    for (const payment of payments) {
      if (payment?.voided === true) continue;
      if (typeof payment?.date !== 'string' || !payment.date.startsWith(month)) continue;
      if (toCents(payment.amount) <= 0) continue;
      return true;
    }
  }
  return false;
}

/**
 * Reads one customer's outstanding dues in integer cents: the
 * positive remaining balance of every priced bill, read through
 * the allocation engine. A free connection never owes anything,
 * so it reads PKR 0; a bill with no usable month never
 * contributes.
 *
 * @param {Object} customer - The customer record
 * @param {Object} allocations - Output of calculatePaymentAllocations
 * @returns {number} The outstanding dues in cents, never negative
 */
function outstandingDuesCents(customer, allocations) {
  if (customer?.isFreeConnection === true) return 0;
  let total = 0;
  const bills = Array.isArray(customer?.bills) ? customer.bills : [];
  for (const bill of bills) {
    if (typeof bill?.month !== 'string' || !MONTH_RE.test(bill.month)) continue;
    const amount = bill.dueAmount;
    if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount))) continue;
    const allocation = allocations.forMonth(customer.id, bill.month);
    const balanceCents = allocation?.balanceDueCents ?? toCents(amount);
    if (balanceCents > 0) total += balanceCents;
  }
  return total;
}

/**
 * Lists the customers with no payment recorded in the reference
 * month, largest dues first, then name A–Z.
 *
 * @param {Object} state - The app state
 * @param {Date} referenceDate - The dashboard's own day; the
 *   month is read from it in Pakistan time
 * @returns {Object} The month, the quiet customers in order,
 *   the count, and the total outstanding in integer cents
 */
export function calculateNoPaymentCustomers(state, referenceDate) {
  const month = pktMonth(referenceDate);
  const allocations = calculatePaymentAllocations(state ?? {});
  const customers = [];
  for (const customer of state?.customers ?? []) {
    if (customer?.archived) continue;
    if (hasPaymentInMonth(customer, month)) continue;
    customers.push({
      name: customer.name ?? '',
      mohalla: customerMohallaLabel(customer),
      duesCents: outstandingDuesCents(customer, allocations)
    });
  }
  customers.sort((a, b) => {
    if (a.duesCents !== b.duesCents) return b.duesCents - a.duesCents;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return 0;
  });
  return {
    month,
    customers,
    customerCount: customers.length,
    totalDueCents: customers.reduce((sum, row) => sum + row.duesCents, 0)
  };
}

/**
 * Builds the quiet-customers rows HTML: one row per customer,
 * with the name, the amount still due in PKR, and the mohalla.
 *
 * @param {Object} summary - Output of calculateNoPaymentCustomers
 * @returns {string} The row items HTML
 */
export function noPaymentSectionHtml(summary) {
  const customers = Array.isArray(summary?.customers) ? summary.customers : [];
  return customers.map((customer) => {
    const dues = formatPKR((customer.duesCents ?? 0) / 100);
    return `<li><span class="provider-breakdown-name">${escapeHtml(customer.name)}</span><strong>${escapeHtml(dues)}</strong><span class="provider-breakdown-meta">${escapeHtml(customer.mohalla)}</span></li>`;
  }).join('');
}

/**
 * Renders the quiet-customers view into the billing dashboard.
 *
 * @param {Document} doc - The host page for the view
 * @param {Object} summary - Output of calculateNoPaymentCustomers
 */
export function renderNoPayment(doc, summary) {
  if (!doc || !summary) return;
  const count = summary.customerCount ?? 0;
  const totalEl = doc.getElementById('nqpNoPaymentTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.totalDueCents ?? 0) / 100);
  const lineEl = doc.getElementById('nqpNoPaymentLine');
  if (lineEl) {
    lineEl.textContent = t(count === 1 ? 'dash_nopayment_count_sing' : 'dash_nopayment_count_plur', null, { count });
  }
  const rowsEl = doc.getElementById('nqpNoPaymentRows');
  if (rowsEl) rowsEl.innerHTML = noPaymentSectionHtml(summary);
  const emptyEl = doc.getElementById('nqpNoPaymentEmpty');
  if (emptyEl) emptyEl.hidden = count > 0;
}
