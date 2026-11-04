// Plan 102 (Plan 101-202) — Part-payment allocation rules.
//
// This module is the ALLOCATION RULE and the ALLOCATION VIEW only,
// and nothing else:
//
//   - It is pure and import-free: the caller supplies every payment,
//     every bill, and every arrears-plan instalment, and the module
//     never reads storage, the clock, or the network, and never
//     mutates an input. It never reads or rewrites Plan 101's advance
//     records or Plan 37's repayment plans — those are inputs only,
//     supplied by the caller in the shapes below.
//   - One written rule, applied at payment entry: a part-payment
//     settles outstanding bills oldest month first, then the current
//     bill, then any arrears-plan instalment (earliest due first).
//     The operator may record a different order, but only with a
//     recorded reason — a custom order without a reason is refused
//     outright, never silently applied.
//   - Every part-payment shows, bill by bill, how much of it settled
//     each bill or instalment and what remains on each. The allocated
//     amounts plus the unallocated remainder sum exactly to the
//     payment, in integer cents, with no rounding anywhere: rupees
//     convert to cents exactly once on the way in and cents are never
//     converted back.
//   - The allocation itself never changes any bill or payment total:
//     a bill allocated against still exists in full, and the allocated
//     and remaining figures live only in the view this module returns.
//     An overpayment beyond every outstanding target is shown plainly
//     as unallocated, never forced onto a bill — that remainder is a
//     later plan's credit question, not this rule's decision.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function isPositiveIntegerCents(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeIntegerCents(value) {
  return Number.isInteger(value) && value >= 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validPartPaymentDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Billing month key: YYYY-MM. */
export function validPartPaymentMonth(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  return true;
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `amountCents` integer is used as-is, while a plain `amount` is
 * always rupees and converts exactly once (×100). Anything else is null.
 */
export function partPaymentAmountCents(value) {
  if (!value || typeof value !== 'object') return null;
  if (Number.isInteger(value.amountCents)) return value.amountCents;
  if (typeof value.amount === 'number' && Number.isFinite(value.amount)) {
    return Math.round(value.amount * 100);
  }
  if (typeof value.amount === 'string' && value.amount.trim() !== '') {
    const parsed = Number(value.amount.trim());
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

function outstandingFrom(value, amountCents) {
  if (Number.isInteger(value.outstandingCents)) {
    return Math.min(amountCents, Math.max(0, value.outstandingCents));
  }
  if (typeof value.paidCents === 'number' && Number.isFinite(value.paidCents)) {
    return Math.min(amountCents, Math.max(0, amountCents - Math.round(value.paidCents)));
  }
  if (typeof value.paidAmount === 'number' && Number.isFinite(value.paidAmount)) {
    return Math.min(amountCents, Math.max(0, amountCents - Math.round(value.paidAmount * 100)));
  }
  return amountCents;
}

/**
 * One normalised bill target, or null when it cannot be one: a missing
 * id, a bad month, or a non-positive amount is refused outright, never
 * stored half-formed. A bill already fully paid normalises fine with
 * outstanding 0 — it simply receives nothing.
 */
export function normalizeAllocationBill(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const month = cleanText(value.month);
  if (!id || !validPartPaymentMonth(month)) return null;
  const amountCents = partPaymentAmountCents(value);
  if (amountCents === null || !isPositiveIntegerCents(amountCents)) return null;
  return { id, kind: 'bill', month, amountCents, outstandingCents: outstandingFrom(value, amountCents) };
}

/**
 * One normalised arrears-plan instalment target, or null when it cannot
 * be one: a missing id or a non-positive amount is refused outright.
 * An invalid due date becomes null (flagged, never guessed); an
 * undated instalment sorts last, never first.
 */
export function normalizeAllocationInstalment(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  if (!id) return null;
  const amountCents = partPaymentAmountCents(value);
  if (amountCents === null || !isPositiveIntegerCents(amountCents)) return null;
  const dueDate = validPartPaymentDate(cleanText(value.dueDate)) ? cleanText(value.dueDate) : null;
  return { id, kind: 'instalment', dueDate, amountCents, outstandingCents: outstandingFrom(value, amountCents) };
}

export function normalizeAllocationBillList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((entry) => {
    const clean = normalizeAllocationBill(entry);
    if (clean) out.push(clean);
  });
  return out;
}

export function normalizeAllocationInstalmentList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((entry) => {
    const clean = normalizeAllocationInstalment(entry);
    if (clean) out.push(clean);
  });
  return out;
}

/**
 * One normalised part-payment, or null when it cannot be one: a missing
 * id or customer, a bad date, or a non-positive amount is refused
 * outright, never stored half-formed. Unknown fields are dropped, so
 * the record carries exactly its own keys and can never grow a bill or
 * payment-total field.
 */
export function normalizePartPayment(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const customer = cleanText(value.customer);
  const date = cleanText(value.date);
  if (!id || !customer || !validPartPaymentDate(date)) return null;
  const amountCents = partPaymentAmountCents(value);
  if (amountCents === null || !isPositiveIntegerCents(amountCents)) return null;
  return {
    id,
    customer,
    customerName: cleanText(value.customerName),
    date,
    amountCents,
  };
}

export function normalizePartPaymentList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((entry) => {
    const clean = normalizePartPayment(entry);
    if (clean) out.push(clean);
  });
  return out;
}

function compareMonth(a, b) {
  if (a.month < b.month) return -1;
  if (a.month > b.month) return 1;
  return 0;
}

function compareDueDate(a, b) {
  if (a.dueDate === null && b.dueDate === null) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  if (a.dueDate < b.dueDate) return -1;
  if (a.dueDate > b.dueDate) return 1;
  return 0;
}

/**
 * The written default order over outstanding targets, as target ids:
 * outstanding bills older than the current bill, oldest month first,
 * then the current bill itself, then arrears-plan instalments earliest
 * due first, then any outstanding bill newer than the current bill, in
 * month order. When no current bill is named (or it is already settled),
 * every outstanding bill simply goes oldest month first, then the
 * instalments. Fully settled targets never enter the order — they
 * receive nothing and are shown as settled in the lines.
 */
export function defaultAllocationOrder(bills, instalments, currentBillId = '') {
  const cleanBills = normalizeAllocationBillList(bills);
  const cleanInstalments = normalizeAllocationInstalmentList(instalments);
  const current = cleanText(currentBillId);
  const outstandingBills = cleanBills.filter((bill) => bill.outstandingCents > 0);
  const currentBill = current ? outstandingBills.find((bill) => bill.id === current) : null;
  let orderedBills;
  let newerBills = [];
  if (currentBill) {
    const older = outstandingBills.filter((bill) => bill !== currentBill && bill.month < currentBill.month).sort(compareMonth);
    newerBills = outstandingBills.filter((bill) => bill !== currentBill && bill.month > currentBill.month).sort(compareMonth);
    orderedBills = [...older, currentBill];
  } else {
    orderedBills = [...outstandingBills].sort(compareMonth);
  }
  const order = orderedBills.map((bill) => bill.id);
  const outstandingInstalments = cleanInstalments
    .filter((entry) => entry.outstandingCents > 0)
    .sort(compareDueDate);
  outstandingInstalments.forEach((entry) => order.push(entry.id));
  // A bill newer than the current bill is not due yet, so it goes last,
  // after the arrears instalments — never ahead of an amount already due.
  newerBills.forEach((bill) => order.push(bill.id));
  return order;
}

function splitOrderInput(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(cleanText).filter(Boolean);
  return [];
}

/**
 * Allocate one part-payment across its targets, bill by bill, without
 * changing any bill or payment total. Returns null when the payment is
 * half-formed, or when a custom order is supplied without a recorded
 * reason — changing the order requires a reason, no exceptions.
 * Otherwise returns the allocation view: one line per target (settled
 * targets included, allocated 0, remaining 0), allocated amounts plus
 * the unallocated remainder summing exactly to the payment.
 */
export function allocatePartPayment(payment, bills, instalments, options = {}) {
  const cleanPayment = normalizePartPayment(payment);
  if (!cleanPayment) return null;
  const cleanBills = normalizeAllocationBillList(bills);
  const cleanInstalments = normalizeAllocationInstalmentList(instalments);
  const byId = new Map();
  cleanBills.forEach((bill) => byId.set(bill.id, bill));
  cleanInstalments.forEach((entry) => byId.set(entry.id, entry));

  const customOrder = splitOrderInput(options.order);
  const orderReason = cleanText(options.orderReason);
  let order;
  if (customOrder.length > 0) {
    if (!orderReason) return null;
    const seen = new Set();
    order = [];
    customOrder.forEach((id) => {
      const target = byId.get(id);
      if (target && target.outstandingCents > 0 && !seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    });
    // Targets the custom order did not name still follow, in default order.
    defaultAllocationOrder(cleanBills, cleanInstalments, options.currentBillId).forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    });
  } else {
    order = defaultAllocationOrder(cleanBills, cleanInstalments, options.currentBillId);
  }

  let remaining = cleanPayment.amountCents;
  const lines = [];
  const allocatedIds = new Set();
  order.forEach((id) => {
    const target = byId.get(id);
    if (!target) return;
    const allocated = Math.min(target.outstandingCents, remaining);
    remaining -= allocated;
    allocatedIds.add(id);
    lines.push({
      targetId: target.id,
      kind: target.kind,
      month: target.kind === 'bill' ? target.month : null,
      dueDate: target.kind === 'instalment' ? target.dueDate : null,
      amountCents: target.amountCents,
      allocatedCents: allocated,
      remainingCents: target.outstandingCents - allocated,
    });
  });
  // Settled targets show plainly as already settled, allocated nothing.
  [...cleanBills, ...cleanInstalments]
    .filter((target) => target.outstandingCents === 0 && !allocatedIds.has(target.id))
    .sort((a, b) => (a.kind === 'bill' && b.kind === 'bill' ? compareMonth(a, b) : 0))
    .forEach((target) => {
      lines.push({
        targetId: target.id,
        kind: target.kind,
        month: target.kind === 'bill' ? target.month : null,
        dueDate: target.kind === 'instalment' ? target.dueDate : null,
        amountCents: target.amountCents,
        allocatedCents: 0,
        remainingCents: 0,
      });
    });

  const allocatedTotalCents = lines.reduce((sum, line) => sum + line.allocatedCents, 0);
  return {
    paymentId: cleanPayment.id,
    customer: cleanPayment.customer,
    customerName: cleanPayment.customerName,
    date: cleanPayment.date,
    amountCents: cleanPayment.amountCents,
    orderUsed: order,
    orderReason: customOrder.length > 0 ? orderReason : '',
    lines,
    allocatedTotalCents,
    unallocatedCents: cleanPayment.amountCents - allocatedTotalCents,
  };
}

/**
 * One stored part-payment allocation record: the payment, the order
 * used, the reason when the order was changed, and the bill-by-bill
 * lines as recorded. Half-formed records are refused; a custom order
 * without a reason is refused; lines whose allocated amounts exceed
 * the payment are refused — the record can never claim more than was paid.
 */
export function normalizePartPaymentAllocation(value) {
  if (!value || typeof value !== 'object') return null;
  const payment = normalizePartPayment(value);
  if (!payment) return null;
  const order = splitOrderInput(value.order);
  const orderReason = cleanText(value.orderReason);
  if (order.length > 0 && !orderReason) return null;
  if (!Array.isArray(value.lines)) return null;
  const lines = [];
  let allocatedSum = 0;
  for (const entry of value.lines) {
    if (!entry || typeof entry !== 'object') return null;
    const targetId = cleanText(entry.targetId);
    const kind = entry.kind === 'instalment' ? 'instalment' : 'bill';
    const allocatedCents = entry.allocatedCents;
    const remainingCents = entry.remainingCents;
    const amountCents = entry.amountCents;
    if (!targetId || !isNonNegativeIntegerCents(allocatedCents) || !isNonNegativeIntegerCents(remainingCents)) return null;
    if (!Number.isInteger(amountCents) || amountCents <= 0) return null;
    if (allocatedCents > amountCents || remainingCents > amountCents) return null;
    allocatedSum += allocatedCents;
    lines.push({
      targetId,
      kind,
      month: kind === 'bill' && validPartPaymentMonth(cleanText(entry.month)) ? cleanText(entry.month) : null,
      dueDate: kind === 'instalment' && validPartPaymentDate(cleanText(entry.dueDate)) ? cleanText(entry.dueDate) : null,
      amountCents,
      allocatedCents,
      remainingCents,
    });
  }
  if (allocatedSum > payment.amountCents) return null;
  return { ...payment, order, orderReason, lines, allocatedTotalCents: allocatedSum, unallocatedCents: payment.amountCents - allocatedSum };
}

export function normalizePartPaymentAllocationList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((entry) => {
    const clean = normalizePartPaymentAllocation(entry);
    if (clean) out.push(clean);
  });
  return out;
}

export function upsertPartPaymentAllocation(list, value) {
  const clean = normalizePartPaymentAllocation(value);
  if (!clean) return normalizePartPaymentAllocationList(list);
  const base = normalizePartPaymentAllocationList(list);
  const index = base.findIndex((entry) => entry.id === clean.id);
  if (index >= 0) base[index] = clean;
  else base.push(clean);
  return base;
}

export function removePartPaymentAllocation(list, id) {
  const wanted = cleanText(id);
  return normalizePartPaymentAllocationList(list).filter((entry) => entry.id !== wanted);
}

export function findPartPaymentAllocation(list, id) {
  const wanted = cleanText(id);
  return normalizePartPaymentAllocationList(list).find((entry) => entry.id === wanted) ?? null;
}

export function partPaymentsForCustomer(list, customer) {
  const wanted = cleanText(customer);
  return normalizePartPaymentAllocationList(list).filter((entry) => entry.customer === wanted);
}

export function formatPartPaymentCents(cents) {
  const rupees = cents / 100;
  const text = Number.isInteger(rupees)
    ? rupees.toLocaleString('en-US')
    : rupees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `PKR ${text}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function partPaymentSummaryText(allocations) {
  const list = normalizePartPaymentAllocationList(allocations);
  if (list.length === 0) return 'No part-payments recorded yet.';
  const allocated = list.reduce((sum, entry) => sum + entry.allocatedTotalCents, 0);
  const unallocated = list.reduce((sum, entry) => sum + entry.unallocatedCents, 0);
  return `${list.length} part-payment${list.length === 1 ? '' : 's'}: ${formatPartPaymentCents(allocated)} allocated bill by bill, ${formatPartPaymentCents(unallocated)} left unallocated.`;
}

export function partPaymentHtml(allocations) {
  const list = normalizePartPaymentAllocationList(allocations);
  if (list.length === 0) return '<p style="font-size: 13px;">No part-payments recorded yet.</p>';
  return list.map((entry) => {
    const rows = entry.lines.map((line) => {
      const label = line.kind === 'bill' ? `Bill ${line.month ?? ''}` : `Arrears instalment ${line.dueDate ?? 'undated'}`;
      const state = line.remainingCents === 0 ? 'settled' : 'still open';
      return `<tr><td>${escapeHtml(label)}</td><td>${formatPartPaymentCents(line.amountCents)}</td><td>${formatPartPaymentCents(line.allocatedCents)}</td><td>${formatPartPaymentCents(line.remainingCents)}</td><td>${state}</td></tr>`;
    }).join('');
    const orderNote = entry.orderReason ? ` Order changed: ${escapeHtml(entry.orderReason)}.` : ' Default order: oldest bill first, then current bill, then arrears instalments.';
    return `<div style="margin: 10px 0;"><p style="font-size: 13px;"><strong>${escapeHtml(entry.customerName || entry.customer)}</strong> — ${escapeHtml(entry.date)} — paid ${formatPartPaymentCents(entry.amountCents)}, allocated ${formatPartPaymentCents(entry.allocatedTotalCents)}, unallocated ${formatPartPaymentCents(entry.unallocatedCents)}.${orderNote}</p><table class="data-table"><thead><tr><th>Bill / instalment</th><th>Amount</th><th>Settled by this payment</th><th>Still open</th><th>State</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function partPaymentCsv(allocations) {
  const rows = [['Payment id', 'Customer', 'Date', 'Paid (Rs.)', 'Target', 'Kind', 'Target amount (Rs.)', 'Settled by this payment (Rs.)', 'Still open (Rs.)', 'Order reason']];
  normalizePartPaymentAllocationList(allocations).forEach((entry) => {
    if (entry.lines.length === 0) {
      rows.push([entry.id, entry.customerName || entry.customer, entry.date, entry.amountCents / 100, '', '', '', '', '', entry.orderReason]);
      return;
    }
    entry.lines.forEach((line) => {
      rows.push([
        entry.id,
        entry.customerName || entry.customer,
        entry.date,
        entry.amountCents / 100,
        line.kind === 'bill' ? (line.month ?? '') : (line.dueDate ?? ''),
        line.kind,
        line.amountCents / 100,
        line.allocatedCents / 100,
        line.remainingCents / 100,
        entry.orderReason,
      ]);
    });
  });
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function partPaymentFilename() {
  return 'part-payment-allocations.csv';
}
