// Plan 127 (Plan 101-202) — Multi-connection customer combined dues view.
//
// This module is a READ-ONLY VIEW and nothing else:
//
//   - It is pure and import-free: the caller supplies every connection
//     and every payment, and the module never reads storage, the clock,
//     or the network, never imports another module, and never mutates
//     an input. It merges no customer records and changes no bill,
//     payment, or connection — every figure it returns lives only in
//     the view.
//   - One customer, many connections (for example a house and a shop):
//     the view lists each connection's dues separately and one combined
//     total, and the combined total equals the sum of the per-connection
//     dues on the same fixture, in integer cents, exactly.
//   - A payment recorded against the combined view is allocated to
//     connections by the part-payment allocation rule: oldest
//     outstanding first. Connections are ordered by their oldest
//     outstanding month, oldest first, undated last, ties by connection
//     id; a custom order is honoured only with a recorded reason, and
//     any connection the custom order did not name still follows in
//     default order. Allocated amounts plus the unallocated remainder
//     sum exactly to the payment, and an overpayment beyond every
//     outstanding connection is shown plainly as unallocated, never
//     forced onto a connection.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function isNonNegativeIntegerCents(value) {
  return Number.isInteger(value) && value >= 0;
}

/** Billing month key: YYYY-MM. */
export function validCombinedMonth(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  return true;
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validCombinedDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `amountCents` integer is used as-is, while a plain `amount` is
 * always rupees and converts exactly once (×100). Anything else is null.
 */
export function combinedDuesAmountCents(value) {
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
  if (Number.isInteger(value.duesCents)) {
    return Math.min(amountCents, Math.max(0, value.duesCents));
  }
  return amountCents;
}

/**
 * One normalised connection-dues row, or null when it cannot be one:
 * a missing id or customer, or a negative or unusable amount, is
 * refused outright. A zero-dues connection is still a row — it owes
 * nothing, and dropping it would hide a connection. The month is the
 * connection's oldest outstanding month; an unusable month becomes
 * '', so the connection sorts last, never first. Unknown fields are
 * dropped, so a row can never grow a bill, payment, or total field.
 */
export function normalizeConnectionDues(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const customer = cleanText(value.customer);
  if (!id || !customer) return null;
  const amountCents = combinedDuesAmountCents(value);
  if (amountCents === null || !isNonNegativeIntegerCents(amountCents)) return null;
  const month = validCombinedMonth(cleanText(value.month)) ? cleanText(value.month) : '';
  return {
    id,
    customer,
    label: cleanText(value.label),
    month,
    amountCents,
    outstandingCents: outstandingFrom(value, amountCents),
  };
}

export function normalizeConnectionDuesList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((entry) => {
    const clean = normalizeConnectionDues(entry);
    if (clean) out.push(clean);
  });
  return out;
}

export function connectionsForCustomer(list, customer) {
  const wanted = cleanText(customer);
  if (!wanted) return [];
  return normalizeConnectionDuesList(list).filter((row) => row.customer === wanted);
}

function compareConnectionOrder(a, b) {
  if (a.month === '' && b.month === '') return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  if (a.month === '') return 1;
  if (b.month === '') return -1;
  if (a.month !== b.month) return a.month < b.month ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The default allocation order over a customer's connections, as
 * connection ids: oldest outstanding month first, undated last, ties
 * by connection id. Fully settled connections never enter the order.
 */
export function defaultConnectionOrder(connections) {
  return normalizeConnectionDuesList(connections)
    .filter((row) => row.outstandingCents > 0)
    .sort(compareConnectionOrder)
    .map((row) => row.id);
}

/**
 * The read-only combined view for one customer, or null when there is
 * no customer or no usable connection row. The combined total is the
 * sum of the per-connection outstanding dues, in integer cents, and
 * nothing else — no record is merged, deleted, or changed.
 */
export function buildCombinedDuesView(customer, connections) {
  const wanted = cleanText(customer);
  if (!wanted) return null;
  const rows = connectionsForCustomer(connections, wanted).sort(compareConnectionOrder);
  if (rows.length === 0) return null;
  return {
    customer: wanted,
    connections: rows.map((row) => ({
      connectionId: row.id,
      label: row.label,
      month: row.month,
      amountCents: row.amountCents,
      outstandingCents: row.outstandingCents,
    })),
    connectionCount: rows.length,
    totalAmountCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
    totalOutstandingCents: rows.reduce((sum, row) => sum + row.outstandingCents, 0),
  };
}

function splitOrderInput(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(cleanText).filter(Boolean);
  return [];
}

/**
 * Allocate one payment recorded against the combined view across the
 * customer's connections, oldest outstanding first, without changing
 * any connection, bill, or payment total. Returns null when the
 * payment is half-formed (no customer, or a non-positive amount), or
 * when a custom order is supplied without a recorded reason. Otherwise
 * returns the allocation view: one line per connection (settled
 * connections included, allocated 0, remaining 0), allocated amounts
 * plus the unallocated remainder summing exactly to the payment.
 */
export function allocateCombinedPayment(payment, connections, options = {}) {
  if (!payment || typeof payment !== 'object') return null;
  const customer = cleanText(payment.customer);
  const amountCents = combinedDuesAmountCents(payment);
  if (!customer || amountCents === null || amountCents <= 0) return null;
  const rows = connectionsForCustomer(connections, customer);
  const byId = new Map();
  rows.forEach((row) => byId.set(row.id, row));

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
    // Connections the custom order did not name still follow, in default order.
    defaultConnectionOrder(rows).forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    });
  } else {
    order = defaultConnectionOrder(rows);
  }

  let remaining = amountCents;
  const lines = [];
  const allocatedIds = new Set();
  order.forEach((id) => {
    const target = byId.get(id);
    if (!target) return;
    const allocated = Math.min(target.outstandingCents, remaining);
    remaining -= allocated;
    allocatedIds.add(id);
    lines.push({
      connectionId: target.id,
      label: target.label,
      month: target.month,
      amountCents: target.amountCents,
      outstandingCents: target.outstandingCents,
      allocatedCents: allocated,
      remainingCents: target.outstandingCents - allocated,
    });
  });
  // Settled connections show plainly as already settled, allocated nothing.
  rows
    .filter((row) => row.outstandingCents === 0 && !allocatedIds.has(row.id))
    .sort(compareConnectionOrder)
    .forEach((row) => {
      lines.push({
        connectionId: row.id,
        label: row.label,
        month: row.month,
        amountCents: row.amountCents,
        outstandingCents: 0,
        allocatedCents: 0,
        remainingCents: 0,
      });
    });

  const allocatedTotalCents = lines.reduce((sum, line) => sum + line.allocatedCents, 0);
  return {
    paymentId: cleanText(payment.id),
    customer,
    amountCents,
    orderUsed: order,
    orderReason: customOrder.length > 0 ? orderReason : '',
    lines,
    allocatedTotalCents,
    unallocatedCents: amountCents - allocatedTotalCents,
  };
}

export function formatCombinedCents(cents) {
  if (!Number.isInteger(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

export function combinedDuesSummaryText(view) {
  if (!view) return 'No combined dues view.';
  return `${view.customer}: ${view.connectionCount} connection${view.connectionCount === 1 ? '' : 's'}, combined dues ${formatCombinedCents(view.totalOutstandingCents)} (of ${formatCombinedCents(view.totalAmountCents)} billed).`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function combinedDuesHtml(view, allocation = null) {
  if (!view) return '<p>No combined dues view.</p>';
  const rows = view.connections.map((row) => {
    const line = allocation ? allocation.lines.find((item) => item.connectionId === row.connectionId) : null;
    const alloc = line
      ? `<td>${formatCombinedCents(line.allocatedCents)}</td><td>${formatCombinedCents(line.remainingCents)}</td>`
      : '<td>—</td><td>—</td>';
    return `<tr><td>${escapeHtml(row.label || row.connectionId)}</td><td>${escapeHtml(row.month || 'No month recorded')}</td><td>${formatCombinedCents(row.amountCents)}</td><td>${formatCombinedCents(row.outstandingCents)}</td>${alloc}</tr>`;
  }).join('');
  const foot = allocation
    ? `<p>Payment ${formatCombinedCents(allocation.amountCents)}: allocated ${formatCombinedCents(allocation.allocatedTotalCents)}, unallocated ${formatCombinedCents(allocation.unallocatedCents)}.</p>`
    : '';
  return `<table><thead><tr><th>Connection</th><th>Oldest month</th><th>Billed</th><th>Dues</th><th>Allocated</th><th>Remaining</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">Combined total</th><th>${formatCombinedCents(view.totalOutstandingCents)}</th><th colspan="2"></th></tr></tfoot></table>${foot}`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function combinedDuesCsv(view, allocation = null) {
  if (!view) return 'customer,connection,month,billed_cents,dues_cents,allocated_cents,remaining_cents\n';
  const lines = view.connections.map((row) => {
    const line = allocation ? allocation.lines.find((item) => item.connectionId === row.connectionId) : null;
    return [view.customer, row.label || row.connectionId, row.month, row.amountCents, row.outstandingCents, line ? line.allocatedCents : '', line ? line.remainingCents : ''].map(csvCell).join(',');
  });
  lines.push([view.customer, 'COMBINED TOTAL', '', view.totalAmountCents, view.totalOutstandingCents, allocation ? allocation.allocatedTotalCents : '', allocation ? allocation.unallocatedCents : ''].map(csvCell).join(','));
  return `customer,connection,month,billed_cents,dues_cents,allocated_cents,remaining_cents\n${lines.join('\n')}\n`;
}

export function combinedDuesFilename() {
  return 'combined-dues.csv';
}
