// Plan 106: bill amount rounding and paisa remainder rule — the visible
// rule for the last few paisa on a bill total, so dues never drift by a
// few rupees with no record of why.
//
// One rule, applied at bill issue only: a bill total is rounded to the
// nearest whole rupee, and the difference is carried as a named remainder
// line on that bill's record. Every record shows its unrounded total, its
// rounding adjustment, and its final total, and the three always reconcile
// in integer cents.
//
// This is NOT the earlier credit-note rounding helper: that helper rounds
// computed credits to clean note figures behind a toggle. This module
// rounds bill totals to whole rupees, always, at issue, and keeps the
// remainder visible per customer instead of absorbing it. Neither module
// reads or rewrites the other.
//
// A remainder is never written off silently: a record can only move from
// open to written-off with an operator-recorded reason and date, and a
// written-off remainder stays listed and stays in the reconciliation
// totals. An issued record's figures are never edited in place — a
// correction goes through the correction workflow, never through a silent
// recalculation of a past bill.
//
// Pure and import-free: no storage, no DOM, no network, no other module.
// Money is integer cents throughout; a plain rupees figure converts to
// cents exactly once on the way in. This module changes no catalogue
// price and no collected figure — it only records how a total was rounded.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonthFor(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) return 29;
  return DAYS_IN_MONTH[month - 1];
}

export function validRoundingMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function validRoundingDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dim = daysInMonthFor(year, month);
  if (dim === null || day < 1 || day > dim) return false;
  const built = new Date(Date.UTC(year, month - 1, day));
  return built.getUTCFullYear() === year && built.getUTCMonth() === month - 1 && built.getUTCDate() === day;
}

export function formatRoundingRs(cents) {
  if (!Number.isInteger(cents)) return 'unrecorded';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

// A plain rupees figure converts to cents exactly once; an explicit
// integer-cents figure is used as-is. The two paths never mix.
export function roundingCents(raw) {
  if (raw == null) return null;
  if (typeof raw.unroundedCents === 'number' && Number.isInteger(raw.unroundedCents) && raw.unroundedCents >= 0) {
    return raw.unroundedCents;
  }
  if (typeof raw.unrounded === 'number' && Number.isFinite(raw.unrounded) && raw.unrounded >= 0) {
    return Math.round(raw.unrounded * 100);
  }
  return null;
}

// The single rule: nearest whole rupee (nearest 100 cents). An exact
// half-rupee (50 cents) rounds up, in the customer's favour on a bill
// they still owe — stated here so the rule is checkable, not a habit.
export function roundBillTotalCents(unroundedCents) {
  if (!Number.isInteger(unroundedCents) || unroundedCents < 0) return null;
  const finalCents = Math.round(unroundedCents / 100) * 100;
  return { unroundedCents, adjustmentCents: finalCents - unroundedCents, finalCents };
}

export function roundingRecordCheck(record) {
  if (!record) return { matches: false, expected: null };
  const expected = roundBillTotalCents(record.unroundedCents);
  if (!expected) return { matches: false, expected: null };
  return {
    matches: expected.adjustmentCents === record.adjustmentCents && expected.finalCents === record.finalCents,
    expected,
  };
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeRoundingRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const customerId = cleanText(raw.customerId);
  if (!id || !customerId) return null;
  if (!validRoundingMonth(raw.billMonth)) return null;
  if (!validRoundingDate(raw.issueDate)) return null;
  const unroundedCents = roundingCents(raw);
  if (unroundedCents === null) return null;
  const expected = roundBillTotalCents(unroundedCents);
  if (!expected) return null;
  // The trio must already reconcile: a stored record whose adjustment or
  // final does not match its unrounded total is refused, never repaired.
  if (raw.adjustmentCents !== undefined && raw.adjustmentCents !== expected.adjustmentCents) return null;
  if (raw.finalCents !== undefined && raw.finalCents !== expected.finalCents) return null;
  const status = raw.status === 'written-off' ? 'written-off' : 'open';
  const reason = cleanText(raw.writtenOffReason);
  const writtenOffDate = cleanText(raw.writtenOffDate);
  if (status === 'written-off') {
    if (!reason || !validRoundingDate(writtenOffDate)) return null;
  }
  return {
    id,
    customerId,
    customerName: cleanText(raw.customerName),
    billMonth: raw.billMonth,
    issueDate: raw.issueDate,
    unroundedCents,
    adjustmentCents: expected.adjustmentCents,
    finalCents: expected.finalCents,
    status,
    writtenOffReason: status === 'written-off' ? reason : '',
    writtenOffDate: status === 'written-off' ? writtenOffDate : '',
    note: cleanText(raw.note),
  };
}

export function normalizeRoundingRecordList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const record = normalizeRoundingRecord(item);
    if (record && !seen.has(record.id)) {
      seen.add(record.id);
      out.push(record);
    }
  }
  return out;
}

export function findRoundingRecord(list, id) {
  const records = normalizeRoundingRecordList(list);
  return records.find((item) => item.id === id) || null;
}

// Recording is append-only in effect: a new id is added, an identical
// re-save leaves the list unchanged, and an existing id with different
// figures is refused outright — an issued record is never edited in place.
export function upsertRoundingRecord(list, raw) {
  const record = normalizeRoundingRecord(raw);
  if (!record) return null;
  const records = normalizeRoundingRecordList(list);
  const existing = records.find((item) => item.id === record.id);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(record)) return records;
    return null;
  }
  return [...records, record];
}

// The only way a remainder leaves the open list: with a recorded reason
// and date. The record stays listed and stays in the reconciliation.
export function writeOffRoundingRecord(list, id, reason, date) {
  const records = normalizeRoundingRecordList(list);
  const target = records.find((item) => item.id === id);
  if (!target || target.status !== 'open') return null;
  if (!cleanText(reason) || !validRoundingDate(date)) return null;
  return records.map((item) => (item.id === id
    ? { ...item, status: 'written-off', writtenOffReason: cleanText(reason), writtenOffDate: date }
    : item));
}

export function roundingRecordsForCustomer(list, customerId) {
  return normalizeRoundingRecordList(list).filter((item) => item.customerId === customerId);
}

export function roundingRemainderTotals(list, customerId) {
  const records = roundingRecordsForCustomer(list, customerId);
  const open = records.filter((item) => item.status === 'open');
  const writtenOff = records.filter((item) => item.status === 'written-off');
  return {
    count: records.length,
    openCount: open.length,
    writtenOffCount: writtenOff.length,
    unroundedCents: records.reduce((sum, item) => sum + item.unroundedCents, 0),
    adjustmentCents: records.reduce((sum, item) => sum + item.adjustmentCents, 0),
    finalCents: records.reduce((sum, item) => sum + item.finalCents, 0),
    openRemainderCents: open.reduce((sum, item) => sum + item.adjustmentCents, 0),
  };
}

// The reconciliation fixture: the sum of all bills plus the sum of all
// remainders must equal the sum of all final totals, on the same list.
export function reconcileRounding(list) {
  const records = normalizeRoundingRecordList(list);
  const unroundedCents = records.reduce((sum, item) => sum + item.unroundedCents, 0);
  const adjustmentCents = records.reduce((sum, item) => sum + item.adjustmentCents, 0);
  const finalCents = records.reduce((sum, item) => sum + item.finalCents, 0);
  const everyRecordReconciles = records.every((item) => roundingRecordCheck(item).matches);
  return {
    recordCount: records.length,
    unroundedCents,
    adjustmentCents,
    finalCents,
    reconciles: everyRecordReconciles && unroundedCents + adjustmentCents === finalCents,
  };
}

export function roundingRecordLineText(record) {
  if (!record) return '';
  const sign = record.adjustmentCents >= 0 ? '+' : '';
  return `Unrounded ${formatRoundingRs(record.unroundedCents)} · rounding ${sign}${formatRoundingRs(record.adjustmentCents)} · final ${formatRoundingRs(record.finalCents)}`;
}

export function roundingSummaryText(list) {
  const records = normalizeRoundingRecordList(list);
  const check = reconcileRounding(records);
  const open = records.filter((item) => item.status === 'open').length;
  return `${records.length} rounding record${records.length === 1 ? '' : 's'} · ${open} open remainder${open === 1 ? '' : 's'} · unrounded ${formatRoundingRs(check.unroundedCents)} + adjustments ${formatRoundingRs(check.adjustmentCents)} = final ${formatRoundingRs(check.finalCents)}${check.reconciles ? '' : ' · ⚠ does not reconcile — correct through the correction workflow.'}`;
}

function escapeRounding(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function roundingRecordHtml(record) {
  if (!record) return '';
  const check = roundingRecordCheck(record);
  return `<div><strong>${escapeRounding(record.customerName || record.customerId)}</strong> · bill month ${escapeRounding(record.billMonth)} · issued ${escapeRounding(record.issueDate)}<br>${escapeRounding(roundingRecordLineText(record))}<br>Remainder: ${escapeRounding(formatRoundingRs(record.adjustmentCents))} · ${record.status === 'written-off' ? `written off ${escapeRounding(record.writtenOffDate)} — ${escapeRounding(record.writtenOffReason)}` : 'open, carried as a remainder line'}${record.note ? `<br>Note: ${escapeRounding(record.note)}` : ''}${check.matches ? '' : '<br>⚠ Stored figures do not reconcile — correct through the correction workflow, never by editing this record.'}</div>`;
}

export function roundingRecordCsv(list) {
  const records = normalizeRoundingRecordList(list);
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = ['id,customerId,customerName,billMonth,issueDate,unroundedCents,adjustmentCents,finalCents,status,writtenOffReason,writtenOffDate,note'];
  for (const record of records) {
    lines.push([record.id, record.customerId, record.customerName, record.billMonth, record.issueDate, record.unroundedCents, record.adjustmentCents, record.finalCents, record.status, record.writtenOffReason, record.writtenOffDate, record.note].map(cell).join(','));
  }
  return lines.join('\n');
}

export function roundingRecordFilename() {
  return 'bill-rounding-records.csv';
}
