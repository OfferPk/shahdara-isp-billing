/**
 * Polish #23 — Due list: batch new-customer tag (first month free).
 *
 * Pure helpers + batch apply for the tag. A new connection's install
 * already includes the first month's bill, so the operator tags the
 * customer's earliest unpaid month and that month's whole gross
 * (dueAmount + lateFee, tax included) is waived as audited bill fields
 * (core.js applyFirstMonthWaiverToBill) — the bill itself is never
 * rewritten, so untagging restores it in full. The allocation engine
 * subtracts the field, so the customer drops out of the Pending due
 * list by the existing totalDues > 0 rule.
 *
 * Shape mirrors concession-helper.js (SISP-30): the field accessors
 * and the month resolution are pure; the state transforms live in
 * core.js. Tests use synthetic data only — never real customer names
 * or numbers.
 */
import {
  applyFirstMonthWaiverToBill,
  removeFirstMonthWaiverFromBill,
  generateMonthlyBillsThroughCurrentMonth,
  customerJoinMonth,
  calculatePaymentAllocations,
  monthsForHistory,
  FIRST_MONTH_WAIVER_REASON_DEFAULT,
  FIRST_MONTH_WAIVER_HISTORY_TYPE,
  FIRST_MONTH_TAG_REMOVED_HISTORY_TYPE,
} from './core.js';
import { getPendingCollectionCustomers } from './nav-quick-collect.js';

export {
  FIRST_MONTH_WAIVER_REASON_DEFAULT,
  FIRST_MONTH_WAIVER_HISTORY_TYPE,
  FIRST_MONTH_TAG_REMOVED_HISTORY_TYPE,
};

/** The waiver stamped on a bill, or null when the bill carries no tag. */
export function firstMonthWaiverOf(bill) {
  const amount = Number(bill?.firstMonthWaivedAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    amount: Math.round(amount * 100) / 100,
    reason: typeof bill.firstMonthWaivedReason === 'string' && bill.firstMonthWaivedReason.trim()
      ? bill.firstMonthWaivedReason
      : FIRST_MONTH_WAIVER_REASON_DEFAULT,
    at: bill.firstMonthWaivedAt ?? null,
  };
}

/** Does this bill carry a first-month tag? */
export function isFirstMonthWaived(bill) {
  return firstMonthWaiverOf(bill) !== null;
}

/** Every tagged month on a customer, newest first: { month, amount, reason }. */
export function taggedFirstMonths(customer) {
  const bills = Array.isArray(customer?.bills) ? customer.bills : [];
  return bills
    .map(bill => ({ month: bill?.month, waiver: firstMonthWaiverOf(bill) }))
    .filter(entry => entry.waiver && typeof entry.month === 'string')
    .sort((a, b) => b.month.localeCompare(a.month))
    .map(entry => ({ month: entry.month, amount: entry.waiver.amount, reason: entry.waiver.reason }));
}

/** "2026-11" -> "Nov 2026" (the profile's month label, same shape as formatReceiptMonth). Null for a malformed month. */
export function monthLabel(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month ?? ''))) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
}

function currentMonthOf(referenceDate) {
  return monthsForHistory(referenceDate)[0];
}

/** Earliest bill month on this customer with a positive engine balance, or null. */
function earliestUnpaidMonthOf(state, customerId) {
  const customer = (state?.customers ?? []).find(c => c.id === customerId);
  if (!customer) return null;
  const allocations = calculatePaymentAllocations(state);
  const months = [...(customer.bills ?? [])]
    .map(bill => bill?.month)
    .filter(month => typeof month === 'string')
    .sort();
  for (const month of months) {
    const balance = allocations.forMonth(customerId, month)?.balanceDueCents;
    if (typeof balance === 'number' && balance > 0) return month;
  }
  return null;
}

/**
 * Picker rows for the batch sheet: exactly the Pending-tab population
 * (getPendingCollectionCustomers, 'all-dues'), each with the target
 * month (the earliest unpaid month) and the gross that will become 0.
 * Join-this-month customers sort first (then highest dues, then
 * customer number). Nobody is ever pre-selected (selected: false).
 * A row whose target month already carries a payment, or has no bill
 * at all (baqaya-only dues), is flagged untaggable with the reason.
 */
export function tagPickerRows(state, query = '', referenceDate = new Date()) {
  const currentMonth = currentMonthOf(referenceDate);
  const pending = getPendingCollectionCustomers(state, query, 'all-dues', referenceDate);
  const rows = pending.map(entry => {
    const customer = (state?.customers ?? []).find(c => c.id === entry.id);
    const bill = (customer?.bills ?? []).find(b => b.month === entry.targetMonth);
    const gross = bill ? Number(bill.dueAmount) + Number(bill.lateFee || 0) : 0;
    let canTag = true;
    let cannotTagReason = '';
    if (!bill) {
      canTag = false;
      cannotTagReason = `No bill for ${monthLabel(entry.targetMonth) ?? entry.targetMonth} yet — only a manual baqaya is due`;
    } else if (Number(bill.firstMonthWaivedAmount) > 0) {
      canTag = false;
      cannotTagReason = 'Already tagged';
    } else if (!Number.isFinite(gross) || gross <= 0) {
      canTag = false;
      cannotTagReason = 'Bill has no amount — can\'t tag';
    } else if ((bill.payments ?? []).some(payment => payment?.voided !== true)) {
      canTag = false;
      cannotTagReason = 'Payment already recorded — can\'t tag';
    }
    return {
      customerId: entry.id,
      customerNumber: entry.customerNumber,
      name: entry.name,
      phone: entry.phone || '',
      area: entry.area || '',
      totalDues: entry.totalDues,
      targetMonth: entry.targetMonth,
      monthLabel: monthLabel(entry.targetMonth),
      waivedAmount: canTag ? Math.round(gross * 100) / 100 : 0,
      isNewThisMonth: customer ? customerJoinMonth(customer) === currentMonth : false,
      canTag,
      cannotTagReason,
      selected: false,
    };
  });
  rows.sort((a, b) => (Number(b.isNewThisMonth) - Number(a.isNewThisMonth))
    || (b.totalDues - a.totalDues)
    || (a.customerNumber - b.customerNumber));
  return rows;
}

/** Customers tagged for one month (the sheet's Tagged view), by customer number. */
export function taggedCustomersForMonth(state, month) {
  const list = Array.isArray(state?.customers) ? state.customers : [];
  const rows = [];
  for (const customer of list) {
    if (!customer || typeof customer !== 'object' || customer.archived === true) continue;
    const bill = (customer.bills ?? []).find(b => b.month === month);
    const waiver = firstMonthWaiverOf(bill);
    if (!waiver) continue;
    rows.push({
      customerId: customer.id,
      customerNumber: customer.customerNumber ?? null,
      name: customer.name || '',
      phone: customer.phone || '',
      area: customer.mohalla || customer.area || '',
      month,
      monthLabel: monthLabel(month),
      waivedAmount: waiver.amount,
      reason: waiver.reason,
    });
  }
  rows.sort((a, b) => (a.customerNumber ?? 0) - (b.customerNumber ?? 0));
  return rows;
}

/**
 * Tag every selected customer. All-or-nothing, on the Bulk Collect
 * commitBatch pattern: the applies run on a scratch copy, so if any
 * selected customer cannot be tagged the error names them and nothing
 * is applied at all. A missing target bill runs the normal monthly
 * generation first (the same call the app makes at startup) and then
 * stamps — generation is normally already done, so this is an edge
 * path, not the common one.
 * @returns {{ nextState, applied: Array<{ customerId, customerNumber, name, month, waivedAmount }> }}
 */
export function applyTagBatch(state, customerIds, { reason = '' } = {}, referenceDate = new Date()) {
  const ids = [...new Set(Array.isArray(customerIds) ? customerIds : [])];
  if (!ids.length) throw new Error('Select at least one customer to tag.');
  const cleanReason = String(reason || FIRST_MONTH_WAIVER_REASON_DEFAULT).trim() || FIRST_MONTH_WAIVER_REASON_DEFAULT;
  let next = state;
  let generated = false;
  const applied = [];
  for (const id of ids) {
    const customer = (next.customers ?? []).find(c => c.id === id);
    if (!customer) throw new Error(`Customer ${id} not found.`);
    if (customer.archived === true) throw new Error(`${customer.name} (#${customer.customerNumber}) is archived and cannot be tagged.`);
    let target = earliestUnpaidMonthOf(next, id);
    if (!target) {
      if (!generated) {
        next = generateMonthlyBillsThroughCurrentMonth(next, referenceDate);
        generated = true;
      }
      target = earliestUnpaidMonthOf(next, id);
    }
    if (!target) throw new Error(`${customer.name} (#${customer.customerNumber}) has no unpaid bill to tag.`);
    try {
      next = applyFirstMonthWaiverToBill(next, id, target, { reason: cleanReason }, referenceDate);
    } catch (err) {
      throw new Error(`${customer.name} (#${customer.customerNumber}): ${err.message} — nothing was tagged.`);
    }
    const bill = next.customers.find(c => c.id === id).bills.find(b => b.month === target);
    applied.push({
      customerId: id,
      customerNumber: customer.customerNumber ?? null,
      name: customer.name || '',
      month: target,
      waivedAmount: Number(bill?.firstMonthWaivedAmount) || 0,
    });
  }
  return { nextState: next, applied };
}

/** Remove one customer's tag for one month (the profile + Tagged-view untag path). */
export function untagTaggedMonth(state, customerId, month, { reason = 'Tag removed by owner' } = {}, referenceDate = new Date()) {
  return removeFirstMonthWaiverFromBill(state, customerId, month, { reason }, referenceDate);
}
