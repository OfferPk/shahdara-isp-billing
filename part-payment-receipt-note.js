// Plan 212 (Plan 203-350) — Part-payment receipt note (remaining balance shown).
//
// Plan 102's allocation rule says how a part-payment settles bills, and
// Plan 130's split payment says how one receipt splits across methods.
// What neither gives the customer is a written note ON the receipt
// itself: what was paid, which bills were settled in part or in full,
// and what still remains on each bill, in plain words. This module is
// that missing piece, and nothing more.
//
// What this module is NOT:
//   - It does not allocate anything. Plan 102's allocation records are
//     never opened, read, or rewritten here; the operator supplies the
//     per-bill paid figures, and this module only annotates them.
//   - It does not split across methods. Plan 130's split records are
//     never opened, read, or rewritten here.
//   - It never creates a payment, never changes a total, and never
//     issues a receipt number. A receipt number here is text only:
//     the receipt itself is never opened or rewritten, and recording
//     a note changes no bill, payment, customer, or staff record.
//   - It is not a receipt printer. It renders the note text, HTML, and
//     CSV that the operator hands to the customer with the receipt.
//
// One note per part-payment receipt:
//   id, receiptNo, customer, date, bills, unallocatedCents.
// One bill line per bill the receipt touches:
//   billRef, month (empty when not given), dueCents, paidCents,
//   remainingCents (derived: due minus paid, never stored by hand).
// A bill line is settled in full when its remaining balance is zero,
// settled in part otherwise. The payment's unallocated remainder (Plan
// 102's overpayment remainder) is carried separately and never forced
// onto a bill.
//
// Acceptance, in the module's own terms:
//   - A note's paid and remaining figures reconcile to the customer's
//     dues on the same fixture: reconcileReceiptNote() checks every
//     bill line against the supplied dues list and reports each
//     mismatch plainly, instead of silently passing.
//   - A receipt with no remaining balance shown is flagged:
//     receiptsMissingReceiptNotes() lists every receipt number that
//     has no note at all, so the operator sees the gap before the
//     customer leaves without the remaining figure in writing.
//   - Adding a note never creates a payment, changes a total, or
//     issues a new receipt number: there is no payment, total, or
//     receipt-number function here at all, only record and remove.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Money is integer cents throughout; a plain rupees figure
// converts to cents exactly once on the way in. Dates are strict
// civil dates checked against a days-in-month table, so no clock and
// no timezone can move a date.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validReceiptNoteDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= limit;
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `amountCents` integer is used as-is, while a plain rupees figure
 * always converts exactly once (x100). Anything else is null.
 */
function centsValue(value) {
  if (value === null || value === undefined) return null;
  if (Number.isInteger(value)) return value;
  return null;
}

function rupeesValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

function centsField(record, centsKey, rupeesKey) {
  if (record === null || record === undefined || typeof record !== 'object') return null;
  if (centsKey in record) return centsValue(record[centsKey]);
  if (rupeesKey in record) return rupeesValue(record[rupeesKey]);
  return null;
}

/** One bill line of a receipt note, or null when half-formed. */
export function normalizeReceiptNoteBill(value) {
  if (!value || typeof value !== 'object') return null;
  const billRef = cleanText(value.billRef);
  if (billRef === '') return null;
  const dueCents = centsField(value, 'dueCents', 'due');
  const paidCents = centsField(value, 'paidCents', 'paid');
  if (!Number.isInteger(dueCents) || dueCents < 0) return null;
  if (!Number.isInteger(paidCents) || paidCents < 0) return null;
  if (paidCents > dueCents) return null;
  return {
    billRef,
    month: cleanText(value.month),
    dueCents,
    paidCents,
    remainingCents: dueCents - paidCents,
  };
}

export function normalizeReceiptNoteBillList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const bill = normalizeReceiptNoteBill(value);
    if (bill === null) continue;
    if (seen.has(bill.billRef)) continue;
    seen.add(bill.billRef);
    out.push(bill);
  }
  return out;
}

/** One part-payment receipt note, or null when half-formed. */
export function normalizePartPaymentReceiptNote(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const receiptNo = cleanText(value.receiptNo);
  const customer = cleanText(value.customer);
  const date = cleanText(value.date);
  if (id === '' || receiptNo === '' || customer === '') return null;
  if (!validReceiptNoteDate(date)) return null;
  if (!Array.isArray(value.bills) || value.bills.length === 0) return null;
  // A note with any half-formed bill line, or with a duplicate bill
  // reference, is refused outright: silently dropping a line the
  // customer was shown, or showing two lines for one bill, would hide
  // which figure the customer actually received.
  if (value.bills.some((bill) => normalizeReceiptNoteBill(bill) === null)) return null;
  const rawRefs = value.bills.map((bill) => cleanText(bill.billRef));
  if (new Set(rawRefs).size !== rawRefs.length) return null;
  const bills = normalizeReceiptNoteBillList(value.bills);
  if (bills.length === 0) return null;
  let unallocatedCents = 0;
  if (value.unallocatedCents !== undefined && value.unallocatedCents !== null) {
    const parsed = centsValue(value.unallocatedCents);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    unallocatedCents = parsed;
  }
  return { id, receiptNo, customer, date, bills, unallocatedCents };
}

export function normalizePartPaymentReceiptNoteList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  for (const value of values) {
    const note = normalizePartPaymentReceiptNote(value);
    if (note !== null) out.push(note);
  }
  return out;
}

export function recordPartPaymentReceiptNote(list, value) {
  const clean = normalizePartPaymentReceiptNoteList(list);
  const note = normalizePartPaymentReceiptNote(value);
  if (note === null) return null;
  if (clean.some((entry) => entry.id === note.id)) return clean;
  return [...clean, note];
}

export function removePartPaymentReceiptNote(list, id) {
  return normalizePartPaymentReceiptNoteList(list).filter((entry) => entry.id !== cleanText(id));
}

export function findPartPaymentReceiptNote(list, id) {
  return normalizePartPaymentReceiptNoteList(list).find((entry) => entry.id === cleanText(id)) || null;
}

export function receiptNotesForCustomer(list, customer) {
  const wanted = cleanText(customer).toLowerCase();
  if (wanted === '') return [];
  return normalizePartPaymentReceiptNoteList(list).filter(
    (entry) => entry.customer.toLowerCase() === wanted,
  );
}

export function receiptNotesForReceipt(list, receiptNo) {
  const wanted = cleanText(receiptNo).toLowerCase();
  if (wanted === '') return [];
  return normalizePartPaymentReceiptNoteList(list).filter(
    (entry) => entry.receiptNo.toLowerCase() === wanted,
  );
}

export function receiptNotesSorted(list) {
  return normalizePartPaymentReceiptNoteList(list).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.receiptNo !== b.receiptNo) return a.receiptNo < b.receiptNo ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Total the customer paid on this receipt: bill lines plus unallocated remainder. */
export function receiptNoteTotalPaidCents(note) {
  const clean = normalizePartPaymentReceiptNote(note);
  if (clean === null) return 0;
  return clean.bills.reduce((sum, bill) => sum + bill.paidCents, 0) + clean.unallocatedCents;
}

/** Total still remaining across every bill line on this receipt. */
export function receiptNoteTotalRemainingCents(note) {
  const clean = normalizePartPaymentReceiptNote(note);
  if (clean === null) return 0;
  return clean.bills.reduce((sum, bill) => sum + bill.remainingCents, 0);
}

export function formatReceiptNoteCents(cents) {
  const rupees = cents / 100;
  const text = Number.isInteger(rupees)
    ? rupees.toLocaleString('en-US')
    : rupees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `PKR ${text}`;
}

/** The plain-words note itself: paid, per-bill remaining, total remaining. */
export function receiptNoteText(note) {
  const clean = normalizePartPaymentReceiptNote(note);
  if (clean === null) return '';
  const lines = clean.bills.map((bill) => {
    const monthPart = bill.month === '' ? '' : ` (${bill.month})`;
    const state = bill.remainingCents === 0 ? 'settled in full' : 'settled in part';
    return `Bill ${bill.billRef}${monthPart}: paid ${formatReceiptNoteCents(bill.paidCents)}, remaining ${formatReceiptNoteCents(bill.remainingCents)} (${state}).`;
  });
  const unallocatedPart = clean.unallocatedCents > 0
    ? ` Unallocated: ${formatReceiptNoteCents(clean.unallocatedCents)}.`
    : '';
  const remaining = receiptNoteTotalRemainingCents(clean);
  const remainingPart = remaining === 0
    ? ' No balance remains.'
    : ` Total remaining balance: ${formatReceiptNoteCents(remaining)}.`;
  return `Receipt ${clean.receiptNo} for ${clean.customer}, ${clean.date}: paid ${formatReceiptNoteCents(receiptNoteTotalPaidCents(clean))}. ${lines.join(' ')}${unallocatedPart}${remainingPart}`;
}

export function receiptNoteSummaryText(notes) {
  const list = normalizePartPaymentReceiptNoteList(notes);
  if (list.length === 0) return 'No part-payment receipt notes recorded yet.';
  const paid = list.reduce((sum, note) => sum + receiptNoteTotalPaidCents(note), 0);
  const remaining = list.reduce((sum, note) => sum + receiptNoteTotalRemainingCents(note), 0);
  return `${list.length} part-payment receipt note${list.length === 1 ? '' : 's'}: ${formatReceiptNoteCents(paid)} paid, ${formatReceiptNoteCents(remaining)} still remaining.`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function receiptNoteHtml(note) {
  const clean = normalizePartPaymentReceiptNote(note);
  if (clean === null) return '';
  const rows = clean.bills.map((bill) => {
    const state = bill.remainingCents === 0 ? 'settled in full' : 'settled in part';
    return `<tr><td>${escapeHtml(bill.billRef)}</td><td>${escapeHtml(bill.month === '' ? '—' : bill.month)}</td><td>${formatReceiptNoteCents(bill.dueCents)}</td><td>${formatReceiptNoteCents(bill.paidCents)}</td><td>${formatReceiptNoteCents(bill.remainingCents)}</td><td>${state}</td></tr>`;
  }).join('');
  return `<div style="margin: 10px 0;"><p style="font-size: 13px;"><strong>Receipt ${escapeHtml(clean.receiptNo)}</strong> — ${escapeHtml(clean.customer)} — ${escapeHtml(clean.date)} — paid ${formatReceiptNoteCents(receiptNoteTotalPaidCents(clean))}, total remaining ${formatReceiptNoteCents(receiptNoteTotalRemainingCents(clean))}.</p><table class="data-table"><thead><tr><th>Bill</th><th>Month</th><th>Due</th><th>Paid</th><th>Remaining</th><th>State</th></tr></thead><tbody>${rows}</tbody></table><p style="font-size: 13px;">${escapeHtml(receiptNoteText(clean))}</p></div>`;
}

export function receiptNoteAllHtml(notes) {
  const list = receiptNotesSorted(notes);
  if (list.length === 0) return '<p style="font-size: 13px;">No part-payment receipt notes recorded yet.</p>';
  return list.map((note) => receiptNoteHtml(note)).join('');
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function receiptNoteCsv(notes) {
  const rows = [['Note id', 'Receipt no', 'Customer', 'Date', 'Bill', 'Month', 'Due (Rs.)', 'Paid (Rs.)', 'Remaining (Rs.)', 'Unallocated (Rs.)']];
  receiptNotesSorted(notes).forEach((note) => {
    note.bills.forEach((bill) => {
      rows.push([
        note.id,
        note.receiptNo,
        note.customer,
        note.date,
        bill.billRef,
        bill.month,
        bill.dueCents / 100,
        bill.paidCents / 100,
        bill.remainingCents / 100,
        note.unallocatedCents / 100,
      ]);
    });
  });
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function receiptNoteFilename() {
  return 'part-payment-receipt-notes.csv';
}

/**
 * Flag every receipt number that has no note at all: a part-payment
 * receipt without a note shows the customer no remaining balance, so
 * it is listed here before the customer leaves. Receipt numbers are
 * matched case-insensitively; duplicates and blanks are ignored.
 */
export function receiptsMissingReceiptNotes(receiptNos, notes) {
  const clean = normalizePartPaymentReceiptNoteList(notes);
  const covered = new Set(clean.map((note) => note.receiptNo.toLowerCase()));
  const missing = [];
  const seen = new Set();
  for (const raw of Array.isArray(receiptNos) ? receiptNos : []) {
    const receiptNo = cleanText(raw);
    if (receiptNo === '') continue;
    const key = receiptNo.toLowerCase();
    if (seen.has(key) || covered.has(key)) continue;
    seen.add(key);
    missing.push(receiptNo);
  }
  return missing;
}

/**
 * Reconcile one note against the customer's dues on the same fixture.
 * `dues` is a list of { billRef, dueCents } (a plain `due` rupees
 * figure is accepted the same way). Returns { ok, problems }: ok is
 * true only when every note bill matches a dues bill with the same due
 * figure, every dues bill appears on the note, and paid plus remaining
 * equals due on every line. Nothing here is changed; mismatches are
 * reported, never silently fixed.
 */
export function reconcileReceiptNote(note, dues) {
  const clean = normalizePartPaymentReceiptNote(note);
  const problems = [];
  if (clean === null) return { ok: false, problems: ['Note is not a valid part-payment receipt note.'] };
  const duesMap = new Map();
  for (const entry of Array.isArray(dues) ? dues : []) {
    if (!entry || typeof entry !== 'object') continue;
    const billRef = cleanText(entry.billRef);
    if (billRef === '') continue;
    const dueCents = centsField(entry, 'dueCents', 'due');
    if (!Number.isInteger(dueCents) || dueCents < 0) continue;
    duesMap.set(billRef, dueCents);
  }
  for (const bill of clean.bills) {
    if (!duesMap.has(bill.billRef)) {
      problems.push(`Bill ${bill.billRef} is on the note but not in the customer's dues.`);
      continue;
    }
    if (duesMap.get(bill.billRef) !== bill.dueCents) {
      problems.push(`Bill ${bill.billRef} due figure on the note (${formatReceiptNoteCents(bill.dueCents)}) does not match the customer's dues (${formatReceiptNoteCents(duesMap.get(bill.billRef))}).`);
    }
    if (bill.paidCents + bill.remainingCents !== bill.dueCents) {
      problems.push(`Bill ${bill.billRef} paid plus remaining does not equal its due figure.`);
    }
  }
  for (const billRef of duesMap.keys()) {
    if (!clean.bills.some((bill) => bill.billRef === billRef)) {
      problems.push(`Bill ${billRef} is in the customer's dues but missing from the note.`);
    }
  }
  return { ok: problems.length === 0, problems };
}
