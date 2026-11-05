// Plan 205 (Plan 203-350) — Bill delivery confirmation log.
//
// Problem: a bill can be printed or sent and nobody can later prove it
// reached the customer, so "I never got my bill" cannot be answered
// from a record. This module is the delivery record for bills: one
// record per bill, stating how it was delivered, by whom, and on
// which date — so Saad can answer a missed-bill claim in seconds,
// and bills still undelivered before their due date can be chased
// before they become overdue.
//
// Scope fence, stated plainly:
//   - This is the BILL-delivery record only. It is not receipt
//     delivery (Plan 5, receipt-delivery.js) and not a statement
//     draft (Plan 39, statement-draft.js): neither module is read
//     or written here, and no receipt or statement record is ever
//     created, changed, or derived from a bill delivery.
//   - It records delivery only and never changes any bill, payment,
//     or customer record by itself: a delivery record carries its
//     own bill reference as plain text, and no bill, payment, or
//     customer object is ever taken in, edited, or returned.
//   - It is import-free (like applied-price.js): the caller supplies
//     every record and every bill list, and the module never reads
//     storage, the clock, or the network, and never mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). Delivery methods are exactly the
//     plan's catalogue: handed in person, by message, or on paper
//     left at the premises — anything else is refused, never stored
//     as a guess.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDeliveryDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

// A bill's due date may be a full date or a bill month (YYYY-MM,
// counting as its first day); anything else is null, never guessed.
export function dueDateForDelivery(value) {
  if (validDeliveryDate(value)) return value;
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (match) {
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) return `${match[1]}-${match[2]}-01`;
    }
  }
  return null;
}

export const BILL_DELIVERY_METHODS = Object.freeze([
  'in-person',
  'message',
  'paper',
]);

export const BILL_DELIVERY_METHOD_LABELS = Object.freeze({
  'in-person': 'Handed in person',
  message: 'By message',
  paper: 'Paper left at premises',
});

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Bill references match case-insensitively with collapsed whitespace,
// so a typed bill month and a stored bill label that differ only in
// case or spacing still resolve to the same bill.
export function normalizeBillDeliveryBillKey(value) {
  const text = cleanText(value);
  if (!text) return '';
  return text.replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeBillDelivery(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = cleanText(entry.id);
  const billId = cleanText(entry.billId);
  const customerId = cleanText(entry.customerId);
  const method = cleanText(entry.method);
  const deliveredBy = cleanText(entry.deliveredBy);
  const date = cleanText(entry.date);
  if (!id || !billId || !customerId) return null;
  if (!BILL_DELIVERY_METHODS.includes(method)) return null;
  if (!deliveredBy || !validDeliveryDate(date)) return null;
  // Unknown fields are dropped, never carried forward.
  return { id, billId, customerId, method, deliveredBy, date };
}

export function normalizeBillDeliveryList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenBills = new Set();
  const out = [];
  for (const entry of list) {
    const record = normalizeBillDelivery(entry);
    if (!record) continue;
    // One record per bill: a second record for the same bill never
    // rewrites the first, and a duplicate id is never stored twice.
    if (seenIds.has(record.id)) continue;
    if (seenBills.has(normalizeBillDeliveryBillKey(record.billId))) continue;
    seenIds.add(record.id);
    seenBills.add(normalizeBillDeliveryBillKey(record.billId));
    out.push(record);
  }
  return out;
}

export function findBillDelivery(list, billId) {
  const key = normalizeBillDeliveryBillKey(billId);
  if (!key) return null;
  const records = normalizeBillDeliveryList(list);
  return records.find((record) => normalizeBillDeliveryBillKey(record.billId) === key) || null;
}

export function recordBillDelivery(list, entry) {
  const records = normalizeBillDeliveryList(list);
  const record = normalizeBillDelivery(entry);
  if (!record) return records;
  if (records.some((item) => item.id === record.id)) return records;
  if (records.some((item) => normalizeBillDeliveryBillKey(item.billId) === normalizeBillDeliveryBillKey(record.billId))) return records;
  return [...records, record];
}

export function removeBillDelivery(list, id) {
  const target = cleanText(id);
  if (!target) return normalizeBillDeliveryList(list);
  return normalizeBillDeliveryList(list).filter((record) => record.id !== target);
}

// Listed by delivery date, then bill, then deliverer A-Z, then id.
export function billDeliveriesSorted(list) {
  return normalizeBillDeliveryList(list).sort((a, b) =>
    a.date.localeCompare(b.date)
    || a.billId.localeCompare(b.billId)
    || a.deliveredBy.localeCompare(b.deliveredBy)
    || a.id.localeCompare(b.id));
}

export function billDeliveriesForCustomer(list, customerId) {
  const query = cleanText(customerId).toLowerCase();
  if (!query) return billDeliveriesSorted(list);
  return billDeliveriesSorted(list).filter((record) => record.customerId.toLowerCase().includes(query));
}

export function billDeliveriesForBill(list, billId) {
  const query = normalizeBillDeliveryBillKey(billId);
  if (!query) return billDeliveriesSorted(list);
  return billDeliveriesSorted(list).filter((record) => normalizeBillDeliveryBillKey(record.billId).includes(query));
}

// One line per bill: its method, deliverer, and date — or plainly
// "Undelivered" when no delivery record exists for it.
export function billDeliveryText(record) {
  if (!record) return 'Undelivered';
  const clean = normalizeBillDelivery(record);
  if (!clean) return 'Undelivered';
  return `${BILL_DELIVERY_METHOD_LABELS[clean.method]} by ${clean.deliveredBy} on ${clean.date}`;
}

export function billDeliverySummaryText(list) {
  const records = normalizeBillDeliveryList(list);
  if (!records.length) return 'No bill deliveries recorded.';
  const byMethod = {};
  for (const record of records) byMethod[record.method] = (byMethod[record.method] || 0) + 1;
  const parts = BILL_DELIVERY_METHODS.filter((method) => byMethod[method]).map(
    (method) => `${byMethod[method]} ${BILL_DELIVERY_METHOD_LABELS[method].toLowerCase()}`);
  return `${records.length} bill ${records.length === 1 ? 'delivery' : 'deliveries'} recorded (${parts.join(', ')}).`;
}

// Bills with no delivery record at all. Each bill is a plain object
// the caller supplies ({ billId, dueDate }); nothing here reads a
// bill, payment, or customer record, and none is changed.
export function undeliveredBills(deliveries, bills) {
  if (!Array.isArray(bills)) return [];
  const delivered = new Set(normalizeBillDeliveryList(deliveries).map(
    (record) => normalizeBillDeliveryBillKey(record.billId)));
  return bills
    .filter((bill) => bill && typeof bill === 'object' && cleanText(bill.billId))
    .filter((bill) => !delivered.has(normalizeBillDeliveryBillKey(bill.billId)))
    .map((bill) => ({ billId: cleanText(bill.billId), dueDate: dueDateForDelivery(bill.dueDate) || '' }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.billId.localeCompare(b.billId));
}

// The chase list: undelivered bills whose due date is still ahead of
// the reference date — the bills to chase before they become overdue.
// A bill with no usable due date is never silently dropped from the
// full undelivered list, but it cannot be placed "before its due
// date", so it stays out of this chase list.
export function undeliveredBillsBeforeDue(deliveries, bills, referenceDate) {
  if (!validDeliveryDate(referenceDate)) return [];
  return undeliveredBills(deliveries, bills).filter(
    (bill) => bill.dueDate && bill.dueDate > referenceDate);
}

export function undeliveredBillsText(deliveries, bills, referenceDate) {
  const chase = undeliveredBillsBeforeDue(deliveries, bills, referenceDate);
  if (!chase.length) return 'No undelivered bills before their due date.';
  return chase.map((bill) => `${bill.billId} (due ${bill.dueDate || 'date not given'})`).join('; ');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function billDeliveryHtml(list) {
  const records = billDeliveriesSorted(list);
  if (!records.length) return '';
  const rows = records.map((record) => `<tr><td>${escapeHtml(record.billId)}</td><td>${escapeHtml(record.customerId)}</td><td>${escapeHtml(BILL_DELIVERY_METHOD_LABELS[record.method])}</td><td>${escapeHtml(record.deliveredBy)}</td><td>${escapeHtml(record.date)}</td><td>${escapeHtml(record.id)}</td></tr>`).join('');
  return `<table><thead><tr><th>Bill</th><th>Customer</th><th>Method</th><th>Delivered by</th><th>Date</th><th>Record id</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function billDeliveryCsv(list) {
  const records = billDeliveriesSorted(list);
  const esc = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = ['bill,customer,method,delivered by,date,record id'];
  for (const record of records) {
    lines.push([record.billId, record.customerId, BILL_DELIVERY_METHOD_LABELS[record.method], record.deliveredBy, record.date, record.id].map(esc).join(','));
  }
  return lines.join('\n');
}

export function billDeliveryFilename() {
  return 'bill-deliveries.csv';
}
