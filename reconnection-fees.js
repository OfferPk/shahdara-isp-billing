// Plan 112 (Plan 101-202) — Reconnection fee record.
//
// After a suspension (Plan 83), a reconnection charge was added
// informally or forgotten, with no consistent record of what was
// charged and why. This module is that record only: one
// reconnection-fee record per reconnection, naming the customer,
// the suspension it belongs to, the fee amount, the date charged,
// and the bill line it appears on. It charges nothing itself and
// it never rewrites a bill or a suspension record — the fee lands
// on a bill only through the existing billing path, and this
// record is only ever linked to that bill by id.
//
// What already existed, checked first:
//   - Plan 83 keeps the suspension record and its reconnection
//     checklist. One checklist item is "reconnection fee recorded
//     through its existing path", but it keeps only a reference
//     id, never a money figure, and this module holds no
//     checklist field at all. Plan 83 is linked by suspension id
//     only, never read or rewritten here.
//   - Plan 110 keeps the discount and waiver approval limits.
//     Waiving a reconnection fee goes through those limits, so a
//     waiver here stores only the Plan 110 approval id and the
//     reason — Plan 110 is never read or rewritten here, and a
//     waiver here grants nothing by itself.
//   - Plan 111 keeps late-fee policies and their waivers. A
//     reconnection fee is not a late fee, so neither Plan 111
//     list is read or written here.
//
// The fences, stated plainly:
//   - Each fee links to exactly one suspension record (by
//     suspension id) and one bill line (by bill id plus the line
//     label). A fee with no suspension id or no bill id is
//     refused outright, never stored half-formed.
//   - A second fee for the same reconnection cannot be posted
//     without a recorded reason: when a fee already exists for
//     the same suspension id, a new fee for that suspension is
//     refused unless it carries a non-blank reason. The reason
//     is stored on the second fee itself, in plain words.
//   - Waiving a fee needs a Plan 110 approval id and a reason,
//     both recorded on the waiver. A waiver for an unknown fee,
//     a duplicate waiver for the same fee, or a waiver missing
//     its approval id, reason, or real date is refused.
//   - No past bill or suspension record is ever rewritten: this
//     module keeps only its own fee and waiver lists, and every
//     function returns new arrays and objects, never mutating
//     its inputs.
//   - Money is integer cents: a *Cents field is already in
//     cents and is used as-is; a plain amount field is rupees
//     and converts at x100 once, so a stored record re-read
//     through the normaliser never inflates a hundredfold.
//     Dates are strict YYYY-MM-DD calendar dates
//     (2026-02-30 is not a date). The module never reads
//     storage, the DOM, the clock, or the network, and it
//     imports nothing.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validReconnectionFeeDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const maxDay = month === 2 && leap ? 29 : daysInMonth;
  return day <= maxDay;
}

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

function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  return `${sign}PKR ${Math.abs(cents / 100).toLocaleString('en-US')}`;
}

function toCents(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100);
  }
  const text = cleanText(value);
  if (text === '') return null;
  const num = Number(text);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

// A *Cents field wins when present; otherwise a plain rupees
// amount converts exactly once. Either way the stored figure is
// integer cents, so re-normalising never inflates it.
function moneyCents(record) {
  if (record.feeCents !== null && record.feeCents !== undefined && record.feeCents !== '') {
    const cents = Number(record.feeCents);
    if (!Number.isFinite(cents)) return null;
    return Math.round(cents);
  }
  return toCents(record.feeAmount);
}

export function normalizeReconnectionFee(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customerId = cleanText(record.customerId);
  const suspensionId = cleanText(record.suspensionId);
  const billId = cleanText(record.billId);
  if (!id || !customerId || !suspensionId || !billId) return null;
  const feeCents = moneyCents(record);
  if (feeCents === null || feeCents <= 0) return null;
  const dateCharged = cleanText(record.dateCharged);
  if (dateCharged && !validReconnectionFeeDate(dateCharged)) return null;
  return {
    id,
    customerId,
    customerName: cleanText(record.customerName),
    suspensionId,
    billId,
    billLine: cleanText(record.billLine),
    feeCents,
    dateCharged,
    reason: cleanText(record.reason),
  };
}

export function normalizeReconnectionFeeList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const fee = normalizeReconnectionFee(entry);
    if (!fee || seen.has(fee.id)) continue;
    seen.add(fee.id);
    out.push(fee);
  }
  return out;
}

export function findReconnectionFee(list, id) {
  return normalizeReconnectionFeeList(list).find((fee) => fee.id === cleanText(id)) || null;
}

export function feesForSuspension(list, suspensionId) {
  const wanted = cleanText(suspensionId);
  if (!wanted) return [];
  return normalizeReconnectionFeeList(list).filter((fee) => fee.suspensionId === wanted);
}

export function feesForCustomer(list, customerId) {
  const wanted = cleanText(customerId);
  if (!wanted) return [];
  return normalizeReconnectionFeeList(list).filter((fee) => fee.customerId === wanted);
}

// Upsert by id (a re-recorded fee replaces its own earlier row),
// but a second fee for the same suspension is refused unless it
// carries a recorded reason. A refused upsert returns the list
// exactly unchanged.
export function upsertReconnectionFee(list, record) {
  const clean = normalizeReconnectionFeeList(list);
  const fee = normalizeReconnectionFee(record);
  if (!fee) return clean;
  const sameSuspension = clean.filter(
    (entry) => entry.suspensionId === fee.suspensionId && entry.id !== fee.id,
  );
  if (sameSuspension.length > 0 && !fee.reason) return clean;
  const next = clean.filter((entry) => entry.id !== fee.id);
  next.push(fee);
  return next;
}

export function removeReconnectionFee(list, id) {
  const wanted = cleanText(id);
  return normalizeReconnectionFeeList(list).filter((fee) => fee.id !== wanted);
}

export function totalReconnectionFeesCents(list) {
  return normalizeReconnectionFeeList(list).reduce((sum, fee) => sum + fee.feeCents, 0);
}

export function normalizeReconnectionFeeWaiver(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const feeId = cleanText(record.feeId);
  const approvalId = cleanText(record.approvalId);
  const reason = cleanText(record.reason);
  if (!id || !feeId || !approvalId || !reason) return null;
  const date = cleanText(record.date);
  if (date && !validReconnectionFeeDate(date)) return null;
  return { id, feeId, approvalId, reason, date };
}

export function normalizeReconnectionFeeWaiverList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const waiver = normalizeReconnectionFeeWaiver(entry);
    if (!waiver || seen.has(waiver.id)) continue;
    seen.add(waiver.id);
    out.push(waiver);
  }
  return out;
}

// A waiver needs an existing fee, a Plan 110 approval id, and a
// reason. One fee can be waived only once; a duplicate waiver is
// refused with the list exactly unchanged.
export function addReconnectionFeeWaiver(fees, waivers, record) {
  const cleanFees = normalizeReconnectionFeeList(fees);
  const cleanWaivers = normalizeReconnectionFeeWaiverList(waivers);
  const waiver = normalizeReconnectionFeeWaiver(record);
  if (!waiver) return cleanWaivers;
  if (!cleanFees.some((fee) => fee.id === waiver.feeId)) return cleanWaivers;
  if (cleanWaivers.some((entry) => entry.feeId === waiver.feeId)) return cleanWaivers;
  return [...cleanWaivers, waiver];
}

export function removeReconnectionFeeWaiver(list, id) {
  const wanted = cleanText(id);
  return normalizeReconnectionFeeWaiverList(list).filter((waiver) => waiver.id !== wanted);
}

export function waiversForFee(list, feeId) {
  const wanted = cleanText(feeId);
  if (!wanted) return [];
  return normalizeReconnectionFeeWaiverList(list).filter((waiver) => waiver.feeId === wanted);
}

export function waivedFeeIds(waivers) {
  return new Set(normalizeReconnectionFeeWaiverList(waivers).map((waiver) => waiver.feeId));
}

export function reconnectionFeeSummaryText(fees, waivers) {
  const cleanFees = normalizeReconnectionFeeList(fees);
  const waived = waivedFeeIds(waivers);
  const charged = totalReconnectionFeesCents(cleanFees);
  const waivedCents = cleanFees
    .filter((fee) => waived.has(fee.id))
    .reduce((sum, fee) => sum + fee.feeCents, 0);
  const count = cleanFees.length;
  const waivedCount = cleanFees.filter((fee) => waived.has(fee.id)).length;
  if (count === 0) return 'No reconnection fees recorded yet.';
  return `${count} reconnection fee${count === 1 ? '' : 's'} · ${formatMoney(charged)} charged · ${waivedCount} waived (${formatMoney(waivedCents)}).`;
}

export function reconnectionFeeHtml(fee, waived = false) {
  const clean = normalizeReconnectionFee(fee);
  if (!clean) return '';
  const when = clean.dateCharged ? ` · charged ${escapeHtml(clean.dateCharged)}` : '';
  const reason = clean.reason ? ` · reason: ${escapeHtml(clean.reason)}` : '';
  const line = clean.billLine ? ` · bill line: ${escapeHtml(clean.billLine)}` : '';
  const waivedMark = waived ? ' · <strong>WAIVED</strong>' : '';
  return `<div>${escapeHtml(clean.customerName || clean.customerId)} · suspension ${escapeHtml(clean.suspensionId)} · bill ${escapeHtml(clean.billId)}${line} · ${formatMoney(clean.feeCents)}${when}${reason}${waivedMark}</div>`;
}

export function reconnectionFeeCsv(fees, waivers) {
  const waived = waivedFeeIds(waivers);
  const rows = [['id', 'customerId', 'suspensionId', 'billId', 'billLine', 'feeCents', 'dateCharged', 'reason', 'waived']];
  for (const fee of normalizeReconnectionFeeList(fees)) {
    rows.push([
      fee.id,
      fee.customerId,
      fee.suspensionId,
      fee.billId,
      fee.billLine,
      String(fee.feeCents),
      fee.dateCharged,
      fee.reason,
      waived.has(fee.id) ? 'yes' : 'no',
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function reconnectionFeeFilename() {
  return 'reconnection-fees.csv';
}
