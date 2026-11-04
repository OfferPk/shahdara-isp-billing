// Plan 123 (Plan 101-202) — Pending clearance for cheque and bank
// transfer payments.
//
// A cheque or a bank transfer used to count as paid the moment it
// was recorded, so a payment that later bounced had already cleared
// the customer's dues. This module gives every such payment one
// clearance status — pending, cleared, or bounced — and nothing
// else. A pending payment does not settle its bill. A bounced
// payment returns its bill to outstanding, with a dated note
// saying so. Marking a payment cleared or bounced records a date
// on the clearance record; it never edits the original payment
// entry, and it never touches any past total.
//
// The fences, stated plainly:
//   - Only cheque and bank-transfer payments are tracked here.
//     Cash, wallet, and every other method are refused outright,
//     because they do not wait for clearance.
//   - A clearance record is its own record. The payment it names
//     is never opened, edited, or rewritten here, and no bill or
//     total is ever recalculated by this module: the bill view
//     below is a reading of the clearance records, not a rewrite.
//   - Cleared and bounced are terminal. A payment marked cleared
//     or bounced can never be marked again, and there is no edit
//     or remove function for a clearance record at all.
//   - A bounce needs a note as well as a date, because a bill
//     returning to outstanding without a reason is exactly the
//     confusion this plan removes.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Strict YYYY-MM-DD calendar date, or null (2026-02-30 is not a date). */
export function validClearanceDate(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  const max = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > max) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export const CLEARANCE_METHODS = ['cheque', 'bank_transfer'];
export const CLEARANCE_STATUSES = ['pending', 'cleared', 'bounced'];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Normalise one clearance record, or null when half-formed.
// Unknown fields are dropped, so a clearance record can never
// grow a payment, bill, or total field. A cleared or bounced
// record must carry its decision date; a pending record carries
// only its recorded date. A bounced record must also carry a
// note, because a bill returning to outstanding needs a reason.
export function normalizeClearance(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const paymentId = text(raw.paymentId);
  const customer = text(raw.customer);
  const method = text(raw.method);
  const status = text(raw.status);
  const dateRecorded = validClearanceDate(raw.dateRecorded ?? raw.recordedDate);
  if (!id || !paymentId || !customer) return null;
  if (!CLEARANCE_METHODS.includes(method)) return null;
  if (!CLEARANCE_STATUSES.includes(status)) return null;
  if (!dateRecorded) return null;
  const billId = text(raw.billId);
  let decisionDate = null;
  if (raw.decisionDate !== undefined && raw.decisionDate !== null && text(raw.decisionDate) !== '') {
    decisionDate = validClearanceDate(raw.decisionDate);
    if (!decisionDate) return null;
  }
  if (status !== 'pending' && !decisionDate) return null;
  if (status === 'pending' && decisionDate) return null;
  const note = text(raw.note);
  if (status === 'bounced' && !note) return null;
  return Object.freeze({
    id,
    paymentId,
    customer,
    billId: billId || null,
    method,
    status,
    dateRecorded,
    decisionDate,
    note: note || null,
  });
}

export function normalizeClearanceList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const record = normalizeClearance(raw);
    if (record && !seen.has(record.id)) {
      seen.add(record.id);
      out.push(record);
    }
  }
  return out;
}

export function findClearance(list, id) {
  const clean = normalizeClearanceList(list);
  return clean.find((item) => item.id === id) ?? null;
}

export function clearanceForPayment(list, paymentId) {
  const id = text(paymentId);
  if (!id) return null;
  return normalizeClearanceList(list).find((item) => item.paymentId === id) ?? null;
}

// Record a clearance status for a payment, or return the list
// unchanged when refused: a half-formed record, a duplicate id,
// or a payment that already has a clearance record. One payment
// has exactly one clearance record; its status moves only through
// markCleared and markBounced below.
export function recordClearance(list, raw) {
  const clean = normalizeClearanceList(list);
  const record = normalizeClearance(raw);
  if (!record) return clean;
  if (clean.some((item) => item.id === record.id)) return clean;
  if (clean.some((item) => item.paymentId === record.paymentId)) return clean;
  return [...clean, record];
}

// Mark a pending payment cleared, or return the list unchanged
// when refused: unknown payment, not pending, or a bad decision
// date. The decision date is recorded on the clearance record;
// the payment entry itself is never touched.
export function markCleared(list, paymentId, decisionDate) {
  const clean = normalizeClearanceList(list);
  const date = validClearanceDate(decisionDate);
  if (!date) return clean;
  const index = clean.findIndex((item) => item.paymentId === text(paymentId));
  if (index < 0) return clean;
  const record = clean[index];
  if (record.status !== 'pending') return clean;
  const next = [...clean];
  next[index] = Object.freeze({ ...record, status: 'cleared', decisionDate: date });
  return next;
}

// Mark a pending payment bounced, or return the list unchanged
// when refused: unknown payment, not pending, a bad decision
// date, or a missing note. A bounced payment returns its bill to
// outstanding, and the note says why — dated, on the record.
export function markBounced(list, paymentId, decisionDate, note) {
  const clean = normalizeClearanceList(list);
  const date = validClearanceDate(decisionDate);
  const noteText = text(note);
  if (!date || !noteText) return clean;
  const index = clean.findIndex((item) => item.paymentId === text(paymentId));
  if (index < 0) return clean;
  const record = clean[index];
  if (record.status !== 'pending') return clean;
  const next = [...clean];
  next[index] = Object.freeze({ ...record, status: 'bounced', decisionDate: date, note: noteText });
  return next;
}

// Pending payments, listed separately from cleared collections:
// these are the payments that have not settled anything yet.
export function pendingClearances(list) {
  return normalizeClearanceList(list).filter((item) => item.status === 'pending');
}

// Cleared collections: only payments whose clearance actually
// landed. Pending and bounced payments never appear here.
export function clearedClearances(list) {
  return normalizeClearanceList(list).filter((item) => item.status === 'cleared');
}

export function bouncedClearances(list) {
  return normalizeClearanceList(list).filter((item) => item.status === 'bounced');
}

// The clearance status a bill shows, from its clearance records
// only: a bounced payment puts the bill back to outstanding, so
// bounced beats pending, and pending beats cleared. A bill with
// no clearance-tracked payment has no clearance status at all —
// null, never a guessed status.
export function billClearanceStatus(list, billId) {
  const id = text(billId);
  if (!id) return null;
  const rows = normalizeClearanceList(list).filter((item) => item.billId === id);
  if (rows.length === 0) return null;
  if (rows.some((item) => item.status === 'bounced')) return 'bounced';
  if (rows.some((item) => item.status === 'pending')) return 'pending';
  return 'cleared';
}

// True only when a bill's tracked payments are all cleared: at
// least one clearance record, and none pending or bounced. A
// pending payment does not settle its bill, and a bounced payment
// un-settles it.
export function billSettledByClearance(list, billId) {
  const id = text(billId);
  if (!id) return false;
  const rows = normalizeClearanceList(list).filter((item) => item.billId === id);
  if (rows.length === 0) return false;
  return rows.every((item) => item.status === 'cleared');
}

export function clearanceCount(list) {
  return normalizeClearanceList(list).length;
}

export function clearanceSummaryText(list) {
  const clean = normalizeClearanceList(list);
  const pending = clean.filter((item) => item.status === 'pending').length;
  const cleared = clean.filter((item) => item.status === 'cleared').length;
  const bounced = clean.filter((item) => item.status === 'bounced').length;
  return `${clean.length} payments tracked, ${pending} pending, ${cleared} cleared, ${bounced} bounced.`;
}

export function clearanceHtml(item) {
  const method = item.method === 'cheque' ? 'Cheque' : 'Bank transfer';
  const decided = item.decisionDate ? ` — decided ${escapeHtml(item.decisionDate)}` : '';
  const note = item.note ? ` — ${escapeHtml(item.note)}` : '';
  const bill = item.billId ? ` — bill ${escapeHtml(item.billId)}` : '';
  return `<div class="clearance-row"><strong>${escapeHtml(item.customer)}</strong> — ${method} — payment ${escapeHtml(item.paymentId)}${bill} — ${escapeHtml(item.status)} — recorded ${escapeHtml(item.dateRecorded)}${decided}${note}</div>`;
}

export function clearanceCsv(list) {
  const rows = [['id', 'payment_id', 'customer', 'bill_id', 'method', 'status', 'date_recorded', 'decision_date', 'note']];
  for (const item of normalizeClearanceList(list)) {
    rows.push([item.id, item.paymentId, item.customer, item.billId ?? '', item.method, item.status, item.dateRecorded, item.decisionDate ?? '', item.note ?? '']);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function clearanceFilename() {
  return 'payment-clearance.csv';
}
