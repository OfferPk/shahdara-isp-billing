// Plan 101 (Plan 101-202) — Advance payment allocation across future bills.
//
// This module is the ALLOCATION RECORD and the ALLOCATION VIEW only,
// and nothing else:
//
//   - It is pure and import-free: the caller supplies every record and
//     every bill, and the module never reads storage, the clock, or
//     the network, and never mutates an input. It names no record
//     field of its own beyond id, customer, date, amount, and months
//     covered, and it never reads or rewrites any bill, payment, or
//     total anywhere else. A bill covered by an advance still exists
//     in full: the covered mark lives only in the view this module
//     returns, never on the bill itself.
//   - One advance-payment record: customer, amount, date, and the
//     months it covers, in the operator's order. The money is
//     consumed oldest covered month first as each bill is issued:
//     bills are taken in months-covered order, never in any other
//     order, and an advance is never applied to a bill that is
//     already paid — paid bills are skipped outright, and a bill
//     outside the covered months is never touched.
//   - Every advance shows amount paid, amount consumed, and amount
//     remaining, and those three figures always sum exactly to the
//     original in integer cents: consumed + remaining === paid, with
//     no rounding anywhere, because rupees convert to cents exactly
//     once on the way in and cents are never converted back.
//   - This record is not a repayment schedule and it grants no price
//     reduction of any kind: it only says which future months money
//     already paid covers. It never replaces, reads, or rewrites the
//     arrears repayment arrangement, and it never changes a bill,
//     a payment, or a total.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function isIntegerCents(value) {
  return Number.isInteger(value) && value > 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validAdvanceDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Billing month key: YYYY-MM. */
export function validAdvanceMonth(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `amountCents` integer is used as-is, while a plain `amount` is
 * always rupees and converts exactly once (×100). A rupees figure
 * must never be mistaken for cents, so the two paths stay separate.
 */
function toCents(record) {
  if (record.amountCents !== undefined && record.amountCents !== null) {
    return isIntegerCents(record.amountCents) ? record.amountCents : null;
  }
  if (typeof record.amount === 'number' && Number.isFinite(record.amount) && record.amount > 0) {
    return Math.round(record.amount * 100);
  }
  return null;
}

function normaliseMonths(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const out = [];
  for (const entry of raw) {
    const month = cleanText(entry);
    if (!validAdvanceMonth(month)) return null;
    if (!out.includes(month)) out.push(month);
  }
  return out.length > 0 ? out : null;
}

/**
 * Normalise one advance record, or null when it is half-formed:
 * no id, a blank customer, no usable positive amount, an impossible
 * date, or no covered months. Unknown fields are dropped, so the
 * returned record carries exactly id, customer, customerName, date,
 * amountCents, and monthsCovered. A `amount` in rupees converts to
 * cents exactly once; an `amountCents` integer is used as-is.
 */
export function normalizeAdvanceAllocation(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  if (!id || !customer) return null;
  const amountCents = toCents(record);
  if (!isIntegerCents(amountCents)) return null;
  const date = cleanText(record.date);
  if (!validAdvanceDate(date)) return null;
  const monthsCovered = normaliseMonths(record.monthsCovered ?? record.months);
  if (!monthsCovered) return null;
  return {
    id,
    customer,
    customerName: cleanText(record.customerName),
    date,
    amountCents,
    monthsCovered,
  };
}

/** Normalise a list, dropping every half-formed record. */
export function normalizeAdvanceAllocationList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const row = normalizeAdvanceAllocation(record);
    if (row) out.push(row);
  }
  return out;
}

/** Insert or replace by id; a half-formed record leaves the list unchanged. */
export function upsertAdvanceAllocation(list, record) {
  const row = normalizeAdvanceAllocation(record);
  if (!row) return normalizeAdvanceAllocationList(list);
  const base = normalizeAdvanceAllocationList(list).filter((item) => item.id !== row.id);
  return [...base, row];
}

/** Remove one advance by id. */
export function removeAdvanceAllocation(list, id) {
  return normalizeAdvanceAllocationList(list).filter((item) => item.id !== cleanText(id));
}

/** Find one advance by id, or null. */
export function findAdvanceAllocation(list, id) {
  return normalizeAdvanceAllocationList(list).find((item) => item.id === cleanText(id)) ?? null;
}

/**
 * Normalise one caller-supplied bill for allocation, or null when it
 * cannot take part: no month, no usable positive amount, or already
 * paid. A bill with `paid: true` (or status 'paid') is already paid
 * and is never allocated to, whatever its amount.
 */
export function normalizeAllocationBill(bill) {
  if (!bill || typeof bill !== 'object') return null;
  const month = cleanText(bill.month);
  if (!validAdvanceMonth(month)) return null;
  const amountCents = toCents(bill);
  if (!isIntegerCents(amountCents)) return null;
  const paid = bill.paid === true || cleanText(bill.status).toLowerCase() === 'paid';
  if (paid) return null;
  return { id: cleanText(bill.id) || month, month, amountCents };
}

/**
 * Allocate one advance across caller-supplied bills, oldest covered
 * month first: bills are taken in the advance's months-covered order
 * (input order breaks ties inside one month), already-paid bills and
 * bills outside the covered months never receive anything, and a
 * bill is covered only up to its own amount. The advance, the bills,
 * and every input are left untouched; the result is a fresh view.
 * consumedCents + remainingCents always equals amountCents exactly.
 */
export function allocateAdvance(advance, bills) {
  const row = normalizeAdvanceAllocation(advance);
  const empty = { advanceId: row?.id ?? '', allocations: [], consumedCents: 0, remainingCents: row?.amountCents ?? 0 };
  if (!row) return empty;
  const order = new Map(row.monthsCovered.map((month, index) => [month, index]));
  const usable = [];
  for (const bill of Array.isArray(bills) ? bills : []) {
    const clean = normalizeAllocationBill(bill);
    if (clean && order.has(clean.month)) usable.push(clean);
  }
  usable.sort((a, b) => (order.get(a.month) - order.get(b.month)) || 0);
  let remaining = row.amountCents;
  const allocations = [];
  for (const bill of usable) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, bill.amountCents);
    allocations.push({ billId: bill.id, month: bill.month, amountCents: taken, fullyCovered: taken === bill.amountCents });
    remaining -= taken;
  }
  return {
    advanceId: row.id,
    allocations,
    consumedCents: row.amountCents - remaining,
    remainingCents: remaining,
  };
}

/** One advance with its allocation attached — a fresh view object. */
export function advanceWithAllocation(advance, bills) {
  const row = normalizeAdvanceAllocation(advance);
  if (!row) return null;
  const allocation = allocateAdvance(row, bills);
  return { ...row, ...allocation };
}

/** Advances for one customer, in the order recorded. */
export function advancesForCustomer(list, customer) {
  const key = cleanText(customer);
  if (!key) return [];
  return normalizeAdvanceAllocationList(list).filter((item) => item.customer === key);
}

/**
 * Caller-supplied bills with their advance cover marked on fresh view
 * objects: a bill fully covered by the advance reads covered, a bill
 * partly covered reads partial, any other bill reads open, and an
 * already-paid bill reads paid. The original bills are never changed,
 * and a bill covered by an advance still carries its full amount.
 */
export function billsMarkedCovered(advance, bills) {
  const allocation = allocateAdvance(advance, bills);
  const covered = new Map(allocation.allocations.map((row) => [row.billId, row]));
  const out = [];
  for (const bill of Array.isArray(bills) ? bills : []) {
    const view = { ...(typeof bill === 'object' && bill !== null ? bill : {}), coveredByAdvance: false, coveredAmountCents: 0, coverStatus: 'open' };
    if (bill && typeof bill === 'object' && (bill.paid === true || cleanText(bill.status).toLowerCase() === 'paid')) {
      view.coverStatus = 'paid';
      out.push(view);
      continue;
    }
    const row = covered.get(cleanText(bill?.id) || cleanText(bill?.month));
    if (row) {
      view.coveredByAdvance = true;
      view.coveredAmountCents = row.amountCents;
      view.coverStatus = row.fullyCovered ? 'covered' : 'partial';
    }
    out.push(view);
  }
  return out;
}

function formatCents(cents) {
  return `PKR ${(cents / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** Summary line over advances already paired with their allocations. */
export function advanceSummaryText(views) {
  const rows = (Array.isArray(views) ? views : []).filter((view) => view && Number.isInteger(view.amountCents));
  const paid = rows.reduce((sum, view) => sum + view.amountCents, 0);
  const consumed = rows.reduce((sum, view) => sum + (view.consumedCents ?? 0), 0);
  const remaining = rows.reduce((sum, view) => sum + (view.remainingCents ?? 0), 0);
  return `${rows.length} advance${rows.length === 1 ? '' : 's'} — paid ${formatCents(paid)}, consumed ${formatCents(consumed)}, remaining ${formatCents(remaining)}.`;
}

/** HTML table of advances with their paid / consumed / remaining figures. */
export function advanceHtml(views) {
  const rows = (Array.isArray(views) ? views : []).filter((view) => view && Number.isInteger(view.amountCents));
  if (rows.length === 0) return '<p style="font-size: 13px;">No advances recorded yet.</p>';
  const body = rows.map((view) => {
    const months = (view.monthsCovered ?? []).join(', ');
    const covered = (view.allocations ?? []).map((row) => `${escapeHtml(row.month)} (${formatCents(row.amountCents)}${row.fullyCovered ? '' : ', partial'})`).join(', ') || 'Not yet allocated';
    return `<tr><td>${escapeHtml(view.customerName || view.customer)}</td><td>${escapeHtml(view.date)}</td><td>${escapeHtml(months)}</td><td>${formatCents(view.amountCents)}</td><td>${formatCents(view.consumedCents ?? 0)}</td><td>${formatCents(view.remainingCents ?? 0)}</td><td>${covered}</td></tr>`;
  }).join('');
  return `<table class="data-table"><thead><tr><th>Customer</th><th>Date paid</th><th>Months covered</th><th>Paid</th><th>Consumed</th><th>Remaining</th><th>Allocated to</th></tr></thead><tbody>${body}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV export of advances with their paid / consumed / remaining figures. */
export function advanceCsv(views) {
  const rows = (Array.isArray(views) ? views : []).filter((view) => view && Number.isInteger(view.amountCents));
  const lines = ['Customer,Date paid,Months covered,Paid (PKR),Consumed (PKR),Remaining (PKR),Allocated to'];
  for (const view of rows) {
    const covered = (view.allocations ?? []).map((row) => `${row.month} (${(row.amountCents / 100).toFixed(2)}${row.fullyCovered ? '' : ', partial'})`).join('; ');
    lines.push([
      csvCell(view.customerName || view.customer),
      csvCell(view.date),
      csvCell((view.monthsCovered ?? []).join('; ')),
      csvCell((view.amountCents / 100).toFixed(2)),
      csvCell(((view.consumedCents ?? 0) / 100).toFixed(2)),
      csvCell(((view.remainingCents ?? 0) / 100).toFixed(2)),
      csvCell(covered),
    ].join(','));
  }
  return lines.join('\n');
}

/** CSV filename for an advance export. */
export function advanceFilename() {
  return 'advance-allocations.csv';
}
