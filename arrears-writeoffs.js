// Plan 115 (Plan 101-202) — Arrears write-off record (not deletion).
//
// Arrears that will never be collected linger as live dues forever,
// distorting the dues picture, while deleting them would falsify
// the books. This module is the honest middle: a write-off is a
// separate ledger entry that names the bills written off, the
// amount, the reason, the approver, and the date. The bills stay
// in history, marked as written off, and no bill, payment, or past
// total is ever deleted or edited.
//
// What already existed, checked first:
//   - The owner-approval record (Plan 110) is the approval path.
//     A write-off carries its approval id as text only; this
//     module never opens that record and never changes it.
//   - Collection lists, dues views, and bills themselves live
//     elsewhere. This module only answers which bills are written
//     off and what the live figure is once they are set aside, so
//     the live-dues total can be reconciled with and without the
//     write-offs on the same fixture.
//
// The fences, stated plainly:
//   - A write-off is refused outright when it is half-formed: no
//     id, no customer, no bills, a bill line without an id or a
//     positive amount, a blank reason, no approver, no approval
//     id, or an impossible date. Unknown fields are dropped, so a
//     write-off can never grow a payment, bill, or price field.
//   - A write-off requires owner approval and a reason: the
//     approval id and the approver are both mandatory, and the
//     reason is mandatory. A record without any of them is not a
//     write-off, it is a note, and it is refused.
//   - One bill is written off once: a second write-off naming a
//     bill already named by an earlier write-off is refused with
//     the list exactly unchanged, so no amount is ever counted
//     twice.
//   - A write-off is never edited and never removed: an id already
//     recorded is never rewritten — an identical re-save leaves
//     the list unchanged, and different figures under the same id
//     are refused. There is deliberately no edit function and no
//     remove function; a write-off is ledger evidence, not a draft.
//   - Written-off amounts are shown separately from live dues:
//     `reconcileDues` proves, on caller-supplied bills, that live
//     dues plus written-off amounts equal the bills' total, and
//     names plainly anything that does not reconcile — a write-off
//     for a bill not in the list (unmatched), or a write-off
//     larger than its bill (excess). Nothing is silently corrected.
//   - Money is integer cents. A `*Cents` integer is used as-is;
//     a plain amount is rupees and converts exactly once (x100),
//     so a stored record re-read through the normaliser never
//     inflates a hundredfold.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is
//     not a date). The module never reads storage, the DOM, the
//     clock, or the network, and it imports nothing.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validWriteOffDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `*Cents` integer is used as-is, while a plain amount is always
 * rupees and converts exactly once (x100). Anything else is null.
 */
export function writeOffAmountCents(record, centsKey, plainKey) {
  if (!record || typeof record !== 'object') return null;
  if (Number.isInteger(record[centsKey])) return record[centsKey];
  const plain = record[plainKey];
  if (typeof plain === 'number' && Number.isFinite(plain)) return Math.round(plain * 100);
  if (typeof plain === 'string' && plain.trim() !== '') {
    const parsed = Number(plain.trim());
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

function normalizeWriteOffBill(line) {
  if (!line || typeof line !== 'object') return null;
  const billId = cleanText(line.billId);
  if (!billId) return null;
  const amountCents = writeOffAmountCents(line, 'amountCents', 'amount');
  if (amountCents === null || amountCents <= 0) return null;
  return { billId, amountCents };
}

export function normalizeWriteOff(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customerId = cleanText(record.customerId);
  const reason = cleanText(record.reason);
  const approver = cleanText(record.approver);
  const approvalId = cleanText(record.approvalId);
  if (!id || !customerId || !reason || !approver || !approvalId) return null;
  const writeOffDate = cleanText(record.writeOffDate);
  if (!validWriteOffDate(writeOffDate)) return null;
  if (!Array.isArray(record.bills) || record.bills.length === 0) return null;
  const bills = [];
  const seen = new Set();
  for (const line of record.bills) {
    const normalized = normalizeWriteOffBill(line);
    if (!normalized) return null;
    if (seen.has(normalized.billId)) return null;
    seen.add(normalized.billId);
    bills.push(normalized);
  }
  return {
    id,
    customerId,
    customerName: cleanText(record.customerName),
    bills,
    amountCents: bills.reduce((sum, b) => sum + b.amountCents, 0),
    reason,
    approver,
    approvalId,
    writeOffDate,
  };
}

export function normalizeWriteOffList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const normalized = normalizeWriteOff(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

export function findWriteOff(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeWriteOffList(list).find((w) => w.id === clean) ?? null;
}

export function writeOffsForCustomer(list, customerId) {
  const clean = cleanText(customerId);
  if (!clean) return [];
  return normalizeWriteOffList(list).filter((w) => w.customerId === clean);
}

export function writtenOffBillIds(list) {
  const ids = [];
  for (const w of normalizeWriteOffList(list)) {
    for (const b of w.bills) {
      if (!ids.includes(b.billId)) ids.push(b.billId);
    }
  }
  return ids;
}

export function isBillWrittenOff(list, billId) {
  const clean = cleanText(billId);
  if (!clean) return false;
  return writtenOffBillIds(list).includes(clean);
}

export function writeOffAmountForBill(list, billId) {
  const clean = cleanText(billId);
  if (!clean) return 0;
  let total = 0;
  for (const w of normalizeWriteOffList(list)) {
    for (const b of w.bills) {
      if (b.billId === clean) total += b.amountCents;
    }
  }
  return total;
}

export function upsertWriteOff(list, record) {
  const current = normalizeWriteOffList(list);
  const normalized = normalizeWriteOff(record);
  if (!normalized) return current;
  const existing = current.find((w) => w.id === normalized.id);
  if (existing) {
    // An id already recorded is never rewritten: an identical
    // re-save leaves the list unchanged, and different figures
    // under the same id are refused, never silently applied.
    return current;
  }
  // One bill is written off once: naming a bill an earlier
  // write-off already covers would count its amount twice.
  const taken = new Set(writtenOffBillIds(current));
  if (normalized.bills.some((b) => taken.has(b.billId))) return current;
  return [...current, normalized];
}

function normalizeDueBill(bill) {
  if (!bill || typeof bill !== 'object') return null;
  const id = cleanText(bill.id);
  if (!id) return null;
  const amountCents = writeOffAmountCents(bill, 'amountCents', 'amount');
  if (amountCents === null || amountCents < 0) return null;
  return { id, customerId: cleanText(bill.customerId), amountCents };
}

/**
 * Live dues, proven against the bills themselves. On
 * caller-supplied bills: total = live + written-off, exactly,
 * when every write-off names a bill in the list and no write-off
 * exceeds its bill. Anything else is reported plainly instead of
 * forced to agree: `unmatched` (write-offs for bills not in the
 * list) and `excess` (write-off above its bill) are listed with
 * their amounts, and the live figure never goes negative.
 */
export function reconcileDues(bills, writeOffs) {
  const dueBills = [];
  if (Array.isArray(bills)) {
    for (const bill of bills) {
      const normalized = normalizeDueBill(bill);
      if (normalized) dueBills.push(normalized);
    }
  }
  const records = normalizeWriteOffList(writeOffs);
  const billById = new Map(dueBills.map((b) => [b.id, b]));
  const writtenByBill = new Map();
  const unmatched = [];
  for (const record of records) {
    for (const line of record.bills) {
      if (!billById.has(line.billId)) {
        unmatched.push({ billId: line.billId, amountCents: line.amountCents, writeOffId: record.id });
      } else {
        writtenByBill.set(line.billId, (writtenByBill.get(line.billId) ?? 0) + line.amountCents);
      }
    }
  }
  const perBill = dueBills.map((bill) => {
    const written = Math.min(writtenByBill.get(bill.id) ?? 0, bill.amountCents);
    const excess = (writtenByBill.get(bill.id) ?? 0) - written;
    return {
      billId: bill.id,
      customerId: bill.customerId,
      totalCents: bill.amountCents,
      writtenOffCents: written,
      liveCents: bill.amountCents - written,
      excessCents: excess,
    };
  });
  const totalCents = perBill.reduce((sum, b) => sum + b.totalCents, 0);
  const writtenOffCents = perBill.reduce((sum, b) => sum + b.writtenOffCents, 0);
  const liveCents = perBill.reduce((sum, b) => sum + b.liveCents, 0);
  const excessCents = perBill.reduce((sum, b) => sum + b.excessCents, 0);
  const unmatchedCents = unmatched.reduce((sum, u) => sum + u.amountCents, 0);
  const recordedCents = records.reduce((sum, r) => sum + r.amountCents, 0);
  return {
    totalCents,
    writtenOffCents,
    liveCents,
    excessCents,
    unmatchedCents,
    recordedCents,
    reconciles: totalCents === liveCents + writtenOffCents && excessCents === 0 && unmatchedCents === 0,
    perBill,
    unmatched,
  };
}

/**
 * The collection view of the same fixture: bills with a live
 * remainder, oldest first by id order as supplied. A fully
 * written-off bill never appears here; a partly written-off bill
 * appears with only its live remainder.
 */
export function liveCollectionList(bills, writeOffs) {
  const reconciled = reconcileDues(bills, writeOffs);
  return reconciled.perBill
    .filter((b) => b.liveCents > 0)
    .map((b) => ({ billId: b.billId, customerId: b.customerId, liveCents: b.liveCents, writtenOffCents: b.writtenOffCents }));
}

function formatRs(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

export function writeOffSummaryText(list) {
  const records = normalizeWriteOffList(list);
  if (records.length === 0) return 'No arrears written off yet.';
  const total = records.reduce((sum, r) => sum + r.amountCents, 0);
  const billCount = records.reduce((sum, r) => sum + r.bills.length, 0);
  return `${records.length} write-off${records.length === 1 ? '' : 's'} covering ${billCount} bill${billCount === 1 ? '' : 's'}; ${formatRs(total)} written off and shown separately from live dues.`;
}

export function reconcileDuesText(reconciled) {
  if (!reconciled) return 'Dues not reconciled: no bills supplied.';
  const base = `Bills ${formatRs(reconciled.totalCents)} = live ${formatRs(reconciled.liveCents)} + written off ${formatRs(reconciled.writtenOffCents)}.`;
  if (reconciled.reconciles) return `${base} Reconciles exactly.`;
  const parts = [];
  if (reconciled.unmatchedCents > 0) parts.push(`unmatched write-offs ${formatRs(reconciled.unmatchedCents)} (bills not in this list)`);
  if (reconciled.excessCents > 0) parts.push(`excess above bills ${formatRs(reconciled.excessCents)}`);
  return `${base} Does not reconcile: ${parts.join('; ')}.`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function writeOffHtml(record) {
  const normalized = normalizeWriteOff(record);
  if (!normalized) return '<p>Write-off not recorded: its inputs are incomplete.</p>';
  const who = normalized.customerName || normalized.customerId;
  const billsPart = normalized.bills.map((b) => `${escapeHtml(b.billId)} ${escapeHtml(formatRs(b.amountCents))}`).join(', ');
  return `<div>${escapeHtml(who)} · bills written off: ${billsPart} · total ${escapeHtml(formatRs(normalized.amountCents))} · reason: ${escapeHtml(normalized.reason)} · approved by ${escapeHtml(normalized.approver)} (approval ${escapeHtml(normalized.approvalId)}) · ${escapeHtml(normalized.writeOffDate)} · bills stay in history, marked written off</div>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function writeOffCsv(list) {
  const records = normalizeWriteOffList(list);
  const header = 'id,customer,bills written off,total written off (Rs),reason,approver,approval id,date';
  const rows = records.map((r) => [
    r.id,
    r.customerName || r.customerId,
    r.bills.map((b) => `${b.billId} ${formatRs(b.amountCents)}`).join('; '),
    (r.amountCents / 100).toFixed(2),
    r.reason,
    r.approver,
    r.approvalId,
    r.writeOffDate,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function writeOffFilename() {
  return 'arrears-writeoffs.csv';
}
