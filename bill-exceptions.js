// Plan 107 (Plan 101-202) — Pre-issue bill exception report.
//
// A read-only check run BEFORE bills are posted, so a wrong price or a
// duplicated bill is caught while it is still easy to correct, instead
// of becoming a dispute afterwards (Plans 61-65). This module posts
// nothing itself and changes no bill, payment, or customer record.
//
// Four reasons, and only four:
//   - zero_amount: the bill carries no amount (exactly zero, or no usable
//     amount recorded at all — the detail says which, never guessed).
//   - duplicate_bill: a second (or third) bill for the same customer
//     and the same month. The first bill for that customer-month is
//     never flagged; only the later copies are.
//   - outdated_price: the bill was priced at a package price that no
//     longer matches the price in force for it (caller supplies both
//     figures, e.g. from the Plan 34 price history — this module never
//     opens a price record itself).
//   - suspended_or_exited: the bill belongs to a customer with an open
//     suspension record or an exit record (caller supplies the id lists
//     — this module never opens a suspension or exit record itself).
//
// Clearing: an exception can be cleared only by recording that the
// underlying record was fixed, or by recording why the exception is
// acceptable — both need a non-blank note and a real date. A clearance
// is a separate record; it never touches, rewrites, or deletes any
// bill, posted or not. A cleared exception stays listed as cleared,
// never silently dropped.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Money is integer cents throughout; a plain rupees figure
// converts to cents exactly once on the way in.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Billing month key: YYYY-MM. */
export function validBillExceptionMonth(value) {
  if (typeof value !== 'string') return false;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validBillExceptionDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const built = new Date(Date.UTC(year, month - 1, day));
  return built.getUTCFullYear() === year && built.getUTCMonth() === month - 1 && built.getUTCDate() === day;
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `amountCents` integer is used as-is, while a plain `amount` (rupees,
 * number or numeric string) converts exactly once (x100). Anything else
 * is null — never zero-filled, because a missing amount is itself the
 * exception this report exists to flag.
 */
export function billExceptionAmountCents(value) {
  if (!value || typeof value !== 'object') return null;
  if (Number.isInteger(value.amountCents) && value.amountCents >= 0) return value.amountCents;
  if (typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount >= 0) {
    return Math.round(value.amount * 100);
  }
  if (typeof value.amount === 'string' && value.amount.trim() !== '') {
    const parsed = Number(value.amount.trim());
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed * 100);
  }
  return null;
}

function optionalCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const asObject = { amountCents: value.amountCents, amount: value.amount };
  if (Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value * 100);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed * 100);
  }
  if (value && typeof value === 'object') return billExceptionAmountCents(asObject);
  return null;
}

export const BILL_EXCEPTION_REASONS = ['zero_amount', 'duplicate_bill', 'outdated_price', 'suspended_or_exited'];

export const BILL_EXCEPTION_REASON_LABELS = {
  zero_amount: 'Zero-amount bill',
  duplicate_bill: 'Duplicate bill',
  outdated_price: 'Outdated package price',
  suspended_or_exited: 'Suspended or exited customer',
};

export const BILL_EXCEPTION_CLEAR_METHODS = ['fixed', 'accepted'];

export const BILL_EXCEPTION_CLEAR_METHOD_LABELS = {
  fixed: 'Underlying record fixed',
  accepted: 'Acceptable as recorded',
};

function formatRs(cents) {
  if (!Number.isInteger(cents)) return 'unrecorded';
  return `PKR ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * One bill the report can name, or null when it cannot be named: a
 * missing id, customer, or month is refused outright, never reported
 * half-formed. A bill with no usable amount still normalises (with
 * amountCents null) so the report can flag it instead of dropping it
 * silently — that is the zero-amount exception doing its job.
 * Unknown fields are dropped, so a bill input can never grow a
 * payment, price-history, or dispute field.
 */
export function normalizeExceptionBill(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id ?? value.billId);
  const customerId = cleanText(value.customerId ?? value.customer);
  const month = cleanText(value.month ?? value.billMonth);
  if (!id || !customerId || !validBillExceptionMonth(month)) return null;
  return {
    id,
    customerId,
    customerName: cleanText(value.customerName),
    month,
    amountCents: billExceptionAmountCents(value),
    pricedCents: optionalCents(value.pricedCents ?? value.pricedAmount ?? null),
    expectedCents: optionalCents(value.expectedCents ?? value.expectedAmount ?? null),
  };
}

export function normalizeExceptionBillList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  for (const entry of values) {
    const clean = normalizeExceptionBill(entry);
    if (clean) out.push(clean);
  }
  return out;
}

function idSet(values) {
  const set = new Set();
  if (!Array.isArray(values)) return set;
  for (const entry of values) {
    const id = cleanText(entry);
    if (id) set.add(id);
  }
  return set;
}

const REASON_ORDER = {
  zero_amount: 0,
  duplicate_bill: 1,
  outdated_price: 2,
  suspended_or_exited: 3,
};

function compareExceptions(a, b) {
  const nameA = a.customerName || a.customerId;
  const nameB = b.customerName || b.customerId;
  return nameA.localeCompare(nameB)
    || a.month.localeCompare(b.month)
    || a.billId.localeCompare(b.billId)
    || REASON_ORDER[a.reason] - REASON_ORDER[b.reason];
}

/**
 * The report itself: one exception per bill per reason, each naming the
 * customer, the bill, and the reason flagged. The inputs are never
 * mutated and no bill is changed, posted, or removed by this call.
 * Bills that cannot be named (no id, customer, or month) are skipped
 * by normalisation; callers that need the count can compare the input
 * length against normalizeExceptionBillList(input).length.
 */
export function buildBillExceptions(input) {
  const bills = normalizeExceptionBillList(input?.bills);
  const suspended = idSet(input?.suspendedCustomerIds);
  const exited = idSet(input?.exitedCustomerIds);
  const seenCustomerMonth = new Set();
  const exceptions = [];
  const push = (bill, reason, detail) => {
    exceptions.push({
      id: `${bill.customerId}::${bill.id}::${reason}`,
      customerId: bill.customerId,
      customerName: bill.customerName,
      billId: bill.id,
      month: bill.month,
      reason,
      reasonLabel: BILL_EXCEPTION_REASON_LABELS[reason],
      detail,
    });
  };
  for (const bill of bills) {
    if (bill.amountCents === null) {
      push(bill, 'zero_amount', 'No usable amount recorded for this bill.');
    } else if (bill.amountCents === 0) {
      push(bill, 'zero_amount', 'Bill amount is zero.');
    }
    const key = `${bill.customerId}::${bill.month}`;
    if (seenCustomerMonth.has(key)) {
      push(bill, 'duplicate_bill', `A bill already exists for this customer in ${bill.month}; this is an extra copy.`);
    } else {
      seenCustomerMonth.add(key);
    }
    if (bill.pricedCents !== null && bill.expectedCents !== null && bill.pricedCents !== bill.expectedCents) {
      push(bill, 'outdated_price', `Priced at ${formatRs(bill.pricedCents)} but the price in force is ${formatRs(bill.expectedCents)}.`);
    }
    const isSuspended = suspended.has(bill.customerId);
    const isExited = exited.has(bill.customerId);
    if (isSuspended || isExited) {
      const parts = [];
      if (isSuspended) parts.push('an open suspension record');
      if (isExited) parts.push('an exit record');
      push(bill, 'suspended_or_exited', `Customer has ${parts.join(' and ')}.`);
    }
  }
  exceptions.sort(compareExceptions);
  return exceptions;
}

/**
 * One clearance record, or null when it cannot be one: clearing needs
 * a method (fixed or accepted), a non-blank note saying what was fixed
 * or why it is acceptable, and a real date. Anything less is refused
 * outright — an exception is never cleared on a bare tap.
 * Unknown fields are dropped.
 */
export function normalizeExceptionClearance(value) {
  if (!value || typeof value !== 'object') return null;
  const exceptionId = cleanText(value.exceptionId);
  const customerId = cleanText(value.customerId);
  const billId = cleanText(value.billId);
  const reason = cleanText(value.reason);
  const method = cleanText(value.method);
  const note = cleanText(value.note ?? value.reasonNote);
  const date = cleanText(value.date ?? value.clearedDate);
  if (!exceptionId || !customerId || !billId) return null;
  if (!BILL_EXCEPTION_REASONS.includes(reason)) return null;
  if (!BILL_EXCEPTION_CLEAR_METHODS.includes(method)) return null;
  if (!note) return null;
  if (!validBillExceptionDate(date)) return null;
  return { exceptionId, customerId, billId, reason, method, note, date };
}

export function normalizeExceptionClearanceList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  for (const entry of values) {
    const clean = normalizeExceptionClearance(entry);
    if (clean) out.push(clean);
  }
  return out;
}

export function findExceptionClearance(clearances, exceptionId) {
  const list = normalizeExceptionClearanceList(clearances);
  return list.find((entry) => entry.exceptionId === exceptionId) ?? null;
}

/**
 * Clear one open exception. Returns the new clearance list, or null
 * when the clearance is refused: the exception must be in the current
 * report, the method must be fixed or accepted, and a note and a real
 * date are required. Clearing the same exception twice is refused.
 * The exception list and every bill are left exactly as they were.
 */
export function applyBillExceptionClearance(exceptions, clearances, clearance) {
  const clean = normalizeExceptionClearance(clearance);
  if (!clean) return null;
  const open = openBillExceptions(exceptions, clearances);
  if (!open.some((entry) => entry.id === clean.exceptionId)) return null;
  const list = normalizeExceptionClearanceList(clearances);
  if (list.some((entry) => entry.exceptionId === clean.exceptionId)) return null;
  return [...list, clean];
}

/** Exceptions not yet cleared, in report order. */
export function openBillExceptions(exceptions, clearances) {
  const cleared = new Set(normalizeExceptionClearanceList(clearances).map((entry) => entry.exceptionId));
  return (Array.isArray(exceptions) ? exceptions : []).filter((entry) => entry && !cleared.has(entry.id));
}

/** Exceptions already cleared, each paired with its clearance record. */
export function clearedBillExceptions(exceptions, clearances) {
  const list = normalizeExceptionClearanceList(clearances);
  const byId = new Map(list.map((entry) => [entry.exceptionId, entry]));
  return (Array.isArray(exceptions) ? exceptions : [])
    .filter((entry) => entry && byId.has(entry.id))
    .map((entry) => ({ exception: entry, clearance: byId.get(entry.id) }));
}

export function billExceptionSummaryText(exceptions, clearances = []) {
  const list = Array.isArray(exceptions) ? exceptions : [];
  const open = openBillExceptions(list, clearances);
  const counts = {};
  for (const entry of open) counts[entry.reason] = (counts[entry.reason] ?? 0) + 1;
  const parts = BILL_EXCEPTION_REASONS
    .filter((reason) => counts[reason])
    .map((reason) => `${counts[reason]} ${BILL_EXCEPTION_REASON_LABELS[reason].toLowerCase()}`);
  const clearedCount = list.length - open.length;
  const clearedPart = clearedCount ? `, ${clearedCount} cleared` : '';
  if (!list.length) return 'No bill exceptions.';
  if (!open.length) return `All ${list.length} exception${list.length === 1 ? '' : 's'} cleared — nothing open.`;
  return `${open.length} open exception${open.length === 1 ? '' : 's'} (${parts.join(', ')})${clearedPart}.`;
}

export function billExceptionHtml(exception, clearance = null) {
  if (!exception || typeof exception !== 'object') return '';
  const clearedLine = clearance
    ? `<br><span>Cleared (${BILL_EXCEPTION_CLEAR_METHOD_LABELS[clearance.method] ?? clearance.method}, ${escapeHtml(clearance.date)}): ${escapeHtml(clearance.note)}</span>`
    : '';
  return `<p><strong>${escapeHtml(exception.customerName || exception.customerId)}</strong> · bill ${escapeHtml(exception.billId)} · ${escapeHtml(exception.month)} · <strong>${escapeHtml(exception.reasonLabel || exception.reason)}</strong><br><span>${escapeHtml(exception.detail || '')}</span>${clearedLine}</p>`;
}

export function billExceptionCsv(exceptions, clearances = []) {
  const list = normalizeExceptionClearanceList(clearances);
  const byId = new Map(list.map((entry) => [entry.exceptionId, entry]));
  const rows = [['Customer', 'Bill', 'Month', 'Reason', 'Detail', 'Status', 'Clearance method', 'Clearance note', 'Clearance date']];
  for (const entry of (Array.isArray(exceptions) ? exceptions : [])) {
    if (!entry) continue;
    const clearance = byId.get(entry.id) ?? null;
    rows.push([
      entry.customerName || entry.customerId,
      entry.billId,
      entry.month,
      entry.reasonLabel || entry.reason,
      entry.detail || '',
      clearance ? 'cleared' : 'open',
      clearance ? (BILL_EXCEPTION_CLEAR_METHOD_LABELS[clearance.method] ?? clearance.method) : '',
      clearance ? clearance.note : '',
      clearance ? clearance.date : '',
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function billExceptionFilename() {
  return 'bill-exceptions.csv';
}
