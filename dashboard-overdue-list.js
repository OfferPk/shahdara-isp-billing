/*
 * Dashboard overdue list — the customers who have waited longest,
 * oldest due date first, with the days each one is overdue and the
 * amount still owed in PKR, plus the total overdue in PKR.
 *
 * The view is composed from the bills the app already keeps —
 * nothing here edits a bill, a payment, or a customer, and nobody
 * is suspended or disconnected from this list. Each customer
 * contributes the positive remaining balances of the bills whose
 * due date is already past, read through the allocation engine, so
 * a bill paid in full counts for nothing and a partly paid bill
 * counts only its remainder. Archived customers never appear, and
 * neither do free connections, which never owe anything. A bill
 * with no usable due date never appears — no due date is ever
 * invented — and a bill with no usable amount never appears. The
 * oldest due date decides the order: the longest-waiting dues sit
 * at the top, so the owner deals with the oldest money first
 * instead of the loudest customer first. All money is PKR only,
 * never converted to any other currency, and a list with no
 * overdue dues reads zero, never a blank.
 */

import { calculatePaymentAllocations, formatPKR } from './core.js';
import { formatDateYmd, escapeHtml } from './dashboard-daily-closing.js';
import { formatDayLabel } from './dashboard-upcoming-dues.js';
import { diffCalendarDays } from './dashboard-top-defaulters.js';
import { t } from './nav-language.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Calculates the overdue list for the reference day: one row per
 * customer with a positive remaining balance on a bill whose due
 * date is already past, oldest due date first.
 *
 * @param {Object} state - Application state
 * @param {Date} referenceDate - The day "today" is (required; the
 *   caller owns the clock, this module never reads it)
 * @returns {Object} { referenceDate, rows, totalCents, totalCount }
 *   — money in integer cents; rows carry customerId, customerName,
 *   mohalla, oldestDueDate, oldestDueLabel, daysOverdue,
 *   amountCents, and billCount, in oldest-first order
 */
export function calculateOverdueList(state, referenceDate) {
  const today = formatDateYmd(referenceDate);
  const summary = {
    referenceDate: today,
    rows: [],
    totalCents: 0,
    totalCount: 0
  };
  if (!today) return summary;

  const allocations = calculatePaymentAllocations(state ?? {});
  const rows = [];
  for (const customer of (state?.customers ?? [])) {
    if (customer.archived) continue;
    // Owner rule: free connections never owe anything — they are
    // excluded from defaulter lists, and this list is one.
    if (customer.isFreeConnection) continue;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    let amountCents = 0;
    let billCount = 0;
    let oldestDueDate = '';
    for (const bill of bills) {
      const dueDate = bill.dueDate;
      // A strict calendar day only, already past — a bill due today
      // is not yet late, and a bill with no usable due date is never
      // given an invented one.
      if (typeof dueDate !== 'string' || !DATE_RE.test(dueDate) || !formatDayLabel(dueDate)) continue;
      if (dueDate >= today) continue;
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount))) continue;
      const allocation = allocations.forMonth(customer.id, bill.month);
      const balanceCents = allocation?.balanceDueCents ?? toCents(amount);
      if (balanceCents <= 0) continue;
      amountCents += balanceCents;
      billCount += 1;
      if (!oldestDueDate || dueDate < oldestDueDate) oldestDueDate = dueDate;
    }
    if (amountCents <= 0 || !oldestDueDate) continue;
    rows.push({
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      customerName: customer.name,
      mohalla: customer.mohalla || customer.area || '',
      oldestDueDate,
      oldestDueLabel: formatDayLabel(oldestDueDate),
      daysOverdue: diffCalendarDays(today, oldestDueDate),
      amountCents,
      billCount
    });
  }
  // Oldest due date first; a tie on the oldest date is broken by
  // the larger amount, then by the customer number.
  rows.sort((a, b) =>
    a.oldestDueDate.localeCompare(b.oldestDueDate) ||
    b.amountCents - a.amountCents ||
    (a.customerNumber ?? 0) - (b.customerNumber ?? 0)
  );
  summary.rows = rows;
  summary.totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  summary.totalCount = rows.length;
  return summary;
}

/**
 * Builds the list rows HTML for the overdue view: one row per
 * customer, in oldest-first order, with name, PKR amount, mohalla,
 * days overdue, and the oldest due date.
 *
 * @param {Object} summary - Output of calculateOverdueList
 * @returns {string} The row items HTML (empty when the summary
 *   carries no rows)
 */
export function overdueListSectionHtml(summary) {
  const rows = Array.isArray(summary?.rows) ? summary.rows : [];
  return rows.map((row) => {
    const daysText = t(row.daysOverdue === 1 ? 'dash_overdue_days_sing' : 'dash_overdue_days_plur', null, { count: row.daysOverdue });
    const meta = [row.mohalla, daysText, row.oldestDueLabel].filter(Boolean).join(' · ');
    return `<li><span class="provider-breakdown-name">${escapeHtml(row.customerName)}</span><strong>${escapeHtml(formatPKR(row.amountCents / 100))}</strong>${meta ? `<span class="provider-breakdown-meta">${escapeHtml(meta)}</span>` : ''}</li>`;
  }).join('');
}

/**
 * Renders the overdue list into the billing dashboard.
 *
 * @param {Document} doc - The host page for the view
 * @param {Object} summary - Output of calculateOverdueList
 */
export function renderOverdueList(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('dolOverdueTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.totalCents ?? 0) / 100);
  const lineEl = doc.getElementById('dolOverdueLine');
  if (lineEl) {
    const count = summary.totalCount ?? 0;
    lineEl.textContent = t(count === 1 ? 'dash_overdue_customers_sing' : 'dash_overdue_customers_plur', null, { count });
  }
  const hasRows = (summary.totalCount ?? 0) > 0;
  const rowsEl = doc.getElementById('dolOverdueRows');
  if (rowsEl) rowsEl.innerHTML = hasRows ? overdueListSectionHtml(summary) : '';
  const emptyEl = doc.getElementById('dolOverdueEmpty');
  if (emptyEl) emptyEl.hidden = hasRows;
}
