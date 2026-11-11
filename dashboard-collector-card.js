/*
 * Dashboard per-collector today card — one row on the billing
 * dashboard for every collector: what they brought in today in
 * PKR, how many payments they made, and the dues still open on
 * their round, so the owner sees in one glance who collected
 * what and whose round still owes money.
 *
 * The card is composed from the records the app already keeps —
 * nothing here edits a bill, a payment, or a customer. The day
 * total and payment count come from the daily closing summary
 * for the dashboard's own day, so the card total always agrees
 * with the today card. Each collector's own figures are read
 * straight from the customers' payment records: the collector
 * is the collectedBy name already on the payment, matched
 * exact-name case-insensitive, and a payment with no collector
 * recorded belongs to no collector — it counts in the day total
 * and under an explicit "No collector recorded" row, so the rows
 * always reconcile to the header total. The roster is every
 * collector who ever collected a payment, plus every collector
 * who holds a round, so a collector with no payment today still
 * shows, at zero, never a blank. A collector's round is their
 * assigned mohallas, and the dues still open on it are the
 * positive remaining balances of the unarchived customers'
 * priced bills in those mohallas, read through the allocation
 * engine, so a bill paid in full counts for nothing and a partly
 * paid bill counts only its remainder; a free connection never
 * owes anything, and a bill with no usable month never
 * contributes — no month is ever invented. A collector with no
 * assigned mohallas has no round, so their open dues read PKR 0.
 * Rows are ordered by today's collections, most first, then name
 * A–Z. All money is PKR only, never converted to any other
 * currency.
 */

import { calculateDailyClosingSummary, formatDateYmd, escapeHtml } from './dashboard-daily-closing.js';
import { calculatePaymentAllocations, formatPKR } from './core.js';
import { assignedMohallasForCollector, collectorsList, canonicalCollectorMohalla } from './collector-assignments.js';
import { ledgerCollectors } from './ledger-collector.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-\d{2}$/;

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Calculates the per-collector today card for one day: one row
 * per collector with today's collections in integer cents, the
 * count of payments, and the dues still open on their round in
 * integer cents, plus the day total and payment count from the
 * daily closing summary.
 *
 * @param {Object} state - Application state
 * @param {Date} referenceDate - The day to report on (required;
 *   the caller owns the clock, this module never reads it)
 * @param {Array} assignments - Collector assignment records;
 *   a collector's round is their assigned mohallas
 * @returns {Object} { today, collectors, totalCents, totalCount,
 *   collectorCount, unassignedCents, unassignedCount } — money in
 *   integer cents; each collector row carries name, collectedCents,
 *   paymentCount, openDuesCents, openDuesCount, and roundMohallas,
 *   ordered by today's collections most first, then name A–Z.
 *   unassignedCents/unassignedCount are the day-total remainder no
 *   collector row claims (payments with no collector recorded, plus
 *   any legacy-ledger receipts the closing summary counts): the rows
 *   plus the unassigned remainder always reconcile to the header.
 */
export function calculateCollectorCard(state, referenceDate, assignments) {
  const today = formatDateYmd(referenceDate);
  const summary = {
    today,
    collectors: [],
    totalCents: 0,
    totalCount: 0,
    collectorCount: 0
  };
  if (!today) return summary;

  // The daily closing summary is asked for the dashboard's own
  // day, so the card total and count always agree with the today
  // card on which day is "today". Its receipts carry the exact
  // amounts, so the total keeps paisa precision.
  const daily = calculateDailyClosingSummary(state ?? {}, referenceDate, { selectedDate: today });
  const receipts = Array.isArray(daily.receipts) ? daily.receipts : [];
  summary.totalCents = receipts.reduce((sum, receipt) => sum + toCents(receipt?.amount), 0);
  summary.totalCount = Number(daily.todayCount) || 0;

  // Each collector's own today figures, read straight from the
  // customers' payment records. Voided receipts are history,
  // never collected cash; a payment dated any other day is not
  // today's; a payment with no collector recorded belongs to no
  // collector and counts under no row.
  const byKey = new Map();
  const allPayments = [];
  for (const customer of (state?.customers ?? [])) {
    if (customer.archived) continue;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      for (const payment of payments) {
        allPayments.push(payment);
        if (payment?.voided === true) continue;
        if (payment?.date !== today) continue;
        const cents = toCents(payment?.amount);
        if (cents <= 0) continue;
        const name = typeof payment?.collectedBy === 'string' ? payment.collectedBy.trim() : '';
        if (!name) continue;
        const key = name.toLocaleLowerCase();
        if (!byKey.has(key)) byKey.set(key, { collectedCents: 0, paymentCount: 0 });
        const row = byKey.get(key);
        row.collectedCents += cents;
        row.paymentCount += 1;
      }
    }
  }

  // The roster is every collector who ever collected a payment,
  // plus every collector who holds a round — so a collector with
  // no payment today still shows, at zero. Payment spellings
  // win where the same collector is named in both lists.
  const rosterByKey = new Map();
  for (const name of ledgerCollectors(allPayments)) {
    rosterByKey.set(name.toLocaleLowerCase(), name);
  }
  for (const name of collectorsList(assignments)) {
    const key = name.toLocaleLowerCase();
    if (!rosterByKey.has(key)) rosterByKey.set(key, name);
  }

  const allocations = calculatePaymentAllocations(state ?? {});
  const collectors = [...rosterByKey.values()].map((name) => {
    const figures = byKey.get(name.toLocaleLowerCase()) ?? { collectedCents: 0, paymentCount: 0 };
    const roundMohallas = assignedMohallasForCollector(assignments, name);
    const roundKeys = new Set(
      roundMohallas.map((mohalla) => canonicalCollectorMohalla(mohalla)).filter(Boolean)
    );
    let openDuesCents = 0;
    let openDuesCount = 0;
    if (roundKeys.size > 0) {
      for (const customer of (state?.customers ?? [])) {
        if (customer.archived) continue;
        if (customer.isFreeConnection) continue;
        const customerKey = canonicalCollectorMohalla(customer?.mohalla ?? customer?.area);
        if (!customerKey || !roundKeys.has(customerKey)) continue;
        const bills = Array.isArray(customer.bills) ? customer.bills : [];
        for (const bill of bills) {
          // A bill with no usable month never contributes — no
          // month is ever invented — and an unpriced bill has
          // no usable amount, so it never counts as due.
          if (typeof bill.month !== 'string' || !MONTH_RE.test(bill.month)) continue;
          const amount = bill.dueAmount;
          if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount))) continue;
          const allocation = allocations.forMonth(customer.id, bill.month);
          const balanceCents = allocation?.balanceDueCents ?? toCents(amount);
          if (balanceCents > 0) {
            openDuesCents += balanceCents;
            openDuesCount += 1;
          }
        }
      }
    }
    return {
      name,
      collectedCents: figures.collectedCents,
      paymentCount: figures.paymentCount,
      openDuesCents,
      openDuesCount,
      roundMohallas
    };
  });
  // Most collected today first, then name A–Z, the way the daily
  // closing summary orders its own collector split.
  collectors.sort((a, b) => (b.collectedCents - a.collectedCents) || a.name.localeCompare(b.name));
  summary.collectors = collectors;
  summary.collectorCount = collectors.length;
  // The unassigned remainder: the day total minus what the rows
  // claim. A payment with no collector recorded lands here, so the
  // rows plus this remainder always reconcile to the header total
  // (the 1,500-today / 0-on-every-row contradiction). Clamped at
  // zero: the two sources should agree exactly, and a negative
  // remainder would be a counting bug, never a negative row.
  const assignedCents = collectors.reduce((sum, collector) => sum + (collector.collectedCents || 0), 0);
  const assignedCount = collectors.reduce((sum, collector) => sum + (collector.paymentCount || 0), 0);
  summary.unassignedCents = Math.max(0, summary.totalCents - assignedCents);
  summary.unassignedCount = Math.max(0, summary.totalCount - assignedCount);
  return summary;
}

/**
 * Builds the collector rows HTML: one row per collector, with
 * the name, today's collections in PKR, the payment count, the
 * dues still open on their round in PKR, and the round's
 * mohallas. A collector with no payment today still reads
 * PKR 0, never a blank. When the day total holds payments no
 * collector row claims, an explicit "No collector recorded" row
 * carries that remainder, so the rows reconcile to the header.
 *
 * @param {Object} summary - Output of calculateCollectorCard
 * @returns {string} The row items HTML
 */
export function collectorCardSectionHtml(summary) {
  const collectors = Array.isArray(summary?.collectors) ? summary.collectors : [];
  const rows = collectors.map((collector) => {
    const countText = t(collector.paymentCount === 1 ? 'dash_collectorcard_payments_sing' : 'dash_collectorcard_payments_plur', null, { count: collector.paymentCount ?? 0 });
    const roundText = (Array.isArray(collector.roundMohallas) && collector.roundMohallas.length > 0)
      ? collector.roundMohallas.join(', ')
      : t('dash_collectorcard_no_round');
    const meta = `${countText} · ${t('dash_collectorcard_due_label')} ${formatPKR((collector.openDuesCents ?? 0) / 100)} · ${roundText}`;
    return `<li><span class="provider-breakdown-name">${escapeHtml(collector.name)}</span><strong>${escapeHtml(formatPKR((collector.collectedCents ?? 0) / 100))}</strong><span class="provider-breakdown-meta">${escapeHtml(meta)}</span></li>`;
  });
  const unassignedCount = summary?.unassignedCount ?? 0;
  if (unassignedCount > 0) {
    const countText = t(unassignedCount === 1 ? 'dash_collectorcard_payments_sing' : 'dash_collectorcard_payments_plur', null, { count: unassignedCount });
    const meta = `${countText} · ${t('dash_collectorcard_due_label')} ${formatPKR(0)} · ${t('dash_collectorcard_no_round')}`;
    rows.push(`<li><span class="provider-breakdown-name">${escapeHtml(t('dash_collectorcard_unassigned'))}</span><strong>${escapeHtml(formatPKR((summary.unassignedCents ?? 0) / 100))}</strong><span class="provider-breakdown-meta">${escapeHtml(meta)}</span></li>`);
  }
  return rows.join('');
}

/**
 * Renders the per-collector today card into the billing
 * dashboard.
 *
 * @param {Document} doc - The host page for the card
 * @param {Object} summary - Output of calculateCollectorCard
 */
export function renderCollectorCard(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('clcCollectorTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.totalCents ?? 0) / 100);
  const lineEl = doc.getElementById('clcCollectorLine');
  if (lineEl) {
    const count = summary.totalCount ?? 0;
    lineEl.textContent = t(count === 1 ? 'dash_collectorcard_count_sing' : 'dash_collectorcard_count_plur', null, { count });
  }
  const rowsEl = doc.getElementById('clcCollectorRows');
  if (rowsEl) rowsEl.innerHTML = collectorCardSectionHtml(summary);
  const emptyEl = doc.getElementById('clcCollectorEmpty');
  if (emptyEl) emptyEl.hidden = (summary.collectorCount ?? 0) > 0;
}
