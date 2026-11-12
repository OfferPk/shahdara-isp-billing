/*
 * Dashboard per-mohalla compact dues bars — one short bar row on
 * the billing dashboard for every mohalla: what was collected
 * there this month and what is still due there, both in PKR, so
 * the lagging mohalla is visible in one glance instead of hiding
 * inside the healthy total.
 *
 * The row is composed from the records the app already keeps —
 * nothing here edits a bill, a payment, or a customer. Collected
 * is the non-voided payments dated in the current month for the
 * mohalla's customers, the way the area collections view counts
 * a month's cash; still due is the positive remaining balance of
 * every priced bill for the mohalla's customers, read through the
 * allocation engine, so a bill paid in full counts for nothing
 * and a partly paid bill counts only its remainder. Archived
 * customers never appear, and a free connection never owes
 * anything, so its bills never count as due. A bill with no
 * usable month never contributes — no month is ever invented —
 * and a mohalla with nothing collected or due reads zero, never
 * a blank. The bar is the collected share of the mohalla's two
 * figures together: a full bar means everything is in, an empty
 * bar means nothing is. The rows follow the app's own canonical
 * mohalla list in its own order, with an unassigned row last
 * only when a customer maps to no mohalla on that list. All
 * money is PKR only, never converted to any other currency.
 */

import { calculatePaymentAllocations, formatPKR } from './core.js';
import { DEFAULT_MOHALLAS, canonicalMohalla, pktMonth } from './phase3.js';
import { sortMohallaNamesByNumberedOrder } from './owner-insights.js';
import { escapeHtml } from './dashboard-daily-closing.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-\d{2}$/;
const UNASSIGNED_LABEL = 'Unassigned';

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

// The canonical key for each name on the app's own mohalla list, so
// a customer whose mohalla matches one of them — by spelling or by
// alias — lands in that mohalla's row, and anyone else lands in the
// unassigned row.
function canonicalMohallaKeys() {
  return new Set(DEFAULT_MOHALLAS.map((name) => canonicalMohalla(name)?.key).filter(Boolean));
}

function resolveMohallaRowKey(customer, canonicalKeys) {
  const resolved = canonicalMohalla(customer?.mohalla || customer?.area);
  if (resolved && canonicalKeys.has(resolved.key)) return resolved.key;
  return null;
}

/**
 * Calculates the per-mohalla bars for the reference month: one row
 * per mohalla on the app's canonical list, in that list's order,
 * plus an unassigned row last when a customer maps to no mohalla
 * on the list. Each row carries the collected and still-due
 * amounts in integer cents and the collected share in percent.
 *
 * @param {Object} state - Application state
 * @param {Date} referenceDate - The month "this month" is
 *   (required; the caller owns the clock, this module never
 *   reads it)
 * @returns {Object} { month, rows, totalCollectedCents,
 *   totalDueCents, mohallaCount } — money in integer cents;
 *   rows carry key, label, collectedCents, dueCents, and
 *   collectedPercent, in list order with unassigned last
 */
export function calculateMohallaBars(state, referenceDate) {
  const month = pktMonth(referenceDate);
  const canonicalKeys = canonicalMohallaKeys();
  const rowsByKey = new Map();
  // Mohalla Numbering: the bars read in the numbered order (1 CHARYAA …
  // 12 HAWELI OR END POINT), then the mohallas outside the list
  // (KISHTII, PULL SIDE, CHUDRIYAA, "end side farm house") in their
  // existing relative order; unassigned stays last.
  for (const name of sortMohallaNamesByNumberedOrder(DEFAULT_MOHALLAS)) {
    const resolved = canonicalMohalla(name);
    rowsByKey.set(resolved.key, {
      key: resolved.key,
      label: resolved.label,
      collectedCents: 0,
      dueCents: 0,
      collectedPercent: 0
    });
  }
  let unassigned = null;
  const allocations = calculatePaymentAllocations(state ?? {});
  for (const customer of (state?.customers ?? [])) {
    if (customer.archived) continue;
    const key = resolveMohallaRowKey(customer, canonicalKeys);
    let row;
    if (key) {
      row = rowsByKey.get(key);
    } else {
      if (!unassigned) {
        unassigned = {
          key: '__unassigned__',
          label: UNASSIGNED_LABEL,
          collectedCents: 0,
          dueCents: 0,
          collectedPercent: 0
        };
      }
      row = unassigned;
    }
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      for (const payment of payments) {
        if (payment?.voided === true) continue;
        if (typeof payment?.date !== 'string' || !payment.date.startsWith(month)) continue;
        const cents = toCents(payment.amount);
        if (cents > 0) row.collectedCents += cents;
      }
      // A free connection never owes anything, so its bills never
      // count as due; a bill with no usable month never
      // contributes either — no month is ever invented.
      if (customer.isFreeConnection) continue;
      if (typeof bill.month !== 'string' || !MONTH_RE.test(bill.month)) continue;
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount))) continue;
      const allocation = allocations.forMonth(customer.id, bill.month);
      const balanceCents = allocation?.balanceDueCents ?? toCents(amount);
      if (balanceCents > 0) row.dueCents += balanceCents;
    }
  }
  const rows = [...rowsByKey.values()];
  if (unassigned) rows.push(unassigned);
  for (const row of rows) {
    const total = row.collectedCents + row.dueCents;
    row.collectedPercent = total > 0 ? Math.round((row.collectedCents * 100) / total) : 0;
  }
  return {
    month,
    rows,
    totalCollectedCents: rows.reduce((sum, row) => sum + row.collectedCents, 0),
    totalDueCents: rows.reduce((sum, row) => sum + row.dueCents, 0),
    mohallaCount: rows.length
  };
}

/**
 * Builds the bar rows HTML: one compact row per mohalla, in list
 * order, with the mohalla name, the collected and still-due
 * figures in PKR, and a short bar showing the collected share.
 * A mohalla with nothing collected or due still reads PKR 0,
 * never a blank.
 *
 * @param {Object} summary - Output of calculateMohallaBars
 * @returns {string} The row items HTML
 */
export function mohallaBarsSectionHtml(summary) {
  const rows = Array.isArray(summary?.rows) ? summary.rows : [];
  return rows.map((row) => {
    const pct = Math.min(100, Math.max(0, row.collectedPercent ?? 0));
    const figures = `${t('dash_mohallabars_collected_label')} ${formatPKR((row.collectedCents ?? 0) / 100)} · ${t('dash_mohallabars_due_label')} ${formatPKR((row.dueCents ?? 0) / 100)}`;
    return `<div class="fcst-area-row">
      <div class="fcst-area-head"><span class="fcst-area-label">${escapeHtml(row.label)}</span><span class="fcst-area-figures">${escapeHtml(figures)}</span></div>
      <div class="fcst-area-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${escapeHtml(row.label)}"><div class="fcst-area-fill" style="width: ${pct}%"></div></div>
    </div>`;
  }).join('');
}

/**
 * Renders the per-mohalla bars into the billing dashboard.
 *
 * @param {Document} doc - The host page for the bars
 * @param {Object} summary - Output of calculateMohallaBars
 */
export function renderMohallaBars(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('mdbMohallaTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.totalDueCents ?? 0) / 100);
  const lineEl = doc.getElementById('mdbMohallaLine');
  if (lineEl) {
    lineEl.textContent = t('dash_mohallabars_line', null, {
      collected: formatPKR((summary.totalCollectedCents ?? 0) / 100),
      count: summary.mohallaCount ?? 0
    });
  }
  const rowsEl = doc.getElementById('mdbMohallaRows');
  if (rowsEl) rowsEl.innerHTML = mohallaBarsSectionHtml(summary);
}
