// Plan 105: mid-cycle pro-rata bill sheet — the calculation record behind
// a part-month bill, so the figure can be recomputed from the sheet itself.
//
// One sheet per mid-cycle event (a customer joining, leaving, or changing
// package mid-month): event date, bill month, monthly price, days charged,
// daily rate, and amount. The sheet shows its inputs and its arithmetic in
// plain words; it applies nothing and it rewrites no bill. Once the bill is
// issued the sheet is locked: it can no longer be edited or removed here,
// and any correction goes through the correction workflow, never through a
// silent recalculation of a past bill.
//
// Pure and import-free: no storage, no DOM, no network, no other module.
// Money is integer cents throughout; a plain rupees figure converts to
// cents exactly once on the way in.

export const PRORATA_EVENT_TYPES = ['join', 'leave', 'package-change'];

export const PRORATA_EVENT_LABELS = {
  join: 'Joined mid-month',
  leave: 'Left mid-month',
  'package-change': 'Package changed mid-month',
};

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonthFor(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) return 29;
  return DAYS_IN_MONTH[month - 1];
}

export function validProrataMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function validProrataDate(value) {
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

function toCents(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  return null;
}

// A plain rupees figure converts to cents exactly once; an explicit
// integer-cents figure is used as-is. The two paths never mix: a rupees
// figure is never mistaken for cents.
export function prorataPriceCents(raw) {
  if (raw == null) return null;
  if (typeof raw.monthlyPriceCents === 'number') return toCents(raw.monthlyPriceCents);
  if (typeof raw.monthlyPrice === 'number' && Number.isFinite(raw.monthlyPrice) && raw.monthlyPrice > 0) {
    return Math.round(raw.monthlyPrice * 100);
  }
  return null;
}

export function prorataAmountCents(monthlyPriceCents, daysCharged, daysInMonth) {
  if (!Number.isInteger(monthlyPriceCents) || monthlyPriceCents <= 0) return null;
  if (!Number.isInteger(daysCharged) || daysCharged < 1 || daysCharged > daysInMonth) return null;
  if (!Number.isInteger(daysInMonth) || daysInMonth < 28 || daysInMonth > 31) return null;
  return Math.round((monthlyPriceCents * daysCharged) / daysInMonth);
}

// Days charged derived from the event date inside the bill month:
// joining or changing package charges from the event day to month-end
// inclusive; leaving charges from month-start to the event day inclusive.
// A package change's old-price leg is a second sheet of its own.
export function deriveDaysCharged(eventType, eventDate, billMonth) {
  if (!PRORATA_EVENT_TYPES.includes(eventType)) return null;
  if (!validProrataDate(eventDate) || !validProrataMonth(billMonth)) return null;
  if (eventDate.slice(0, 7) !== billMonth) return null;
  const year = Number(billMonth.slice(0, 4));
  const month = Number(billMonth.slice(5, 7));
  const dim = daysInMonthFor(year, month);
  const day = Number(eventDate.slice(8, 10));
  if (eventType === 'leave') return day;
  return dim - day + 1;
}

export function formatProrataRs(cents) {
  if (!Number.isInteger(cents)) return 'unrecorded';
  return `Rs. ${(cents / 100).toFixed(2)}`;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Normalisation keeps exactly the sheet's own keys and nothing else, so a
// sheet can never grow a bill, payment, or price-history field. A stored
// amount is kept as recorded (so a mismatch against the inputs stays
// visible through prorataSheetCheck); a missing amount is computed.
export function normalizeProrataSheet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const customerId = cleanText(raw.customerId);
  const eventType = cleanText(raw.eventType);
  const eventDate = cleanText(raw.eventDate);
  const billMonth = cleanText(raw.billMonth);
  if (!id || !customerId) return null;
  if (!PRORATA_EVENT_TYPES.includes(eventType)) return null;
  if (!validProrataDate(eventDate) || !validProrataMonth(billMonth)) return null;
  if (eventDate.slice(0, 7) !== billMonth) return null;
  const monthlyPriceCents = prorataPriceCents(raw);
  if (monthlyPriceCents === null || monthlyPriceCents <= 0) return null;
  const year = Number(billMonth.slice(0, 4));
  const month = Number(billMonth.slice(5, 7));
  const daysInMonth = daysInMonthFor(year, month);
  let daysCharged = null;
  if (raw.daysCharged !== '' && raw.daysCharged !== null && raw.daysCharged !== undefined) {
    const n = typeof raw.daysCharged === 'number' ? raw.daysCharged : Number(raw.daysCharged);
    if (Number.isInteger(n)) daysCharged = n;
  }
  if (daysCharged === null) daysCharged = deriveDaysCharged(eventType, eventDate, billMonth);
  if (daysCharged === null || daysCharged < 1 || daysCharged > daysInMonth) return null;
  let amountCents = null;
  if (typeof raw.amountCents === 'number' && Number.isInteger(raw.amountCents) && raw.amountCents >= 0) {
    amountCents = raw.amountCents;
  } else {
    amountCents = prorataAmountCents(monthlyPriceCents, daysCharged, daysInMonth);
  }
  return {
    id,
    customerId,
    customerName: cleanText(raw.customerName),
    eventType,
    eventDate,
    billMonth,
    monthlyPriceCents,
    daysInMonth,
    daysCharged,
    amountCents,
    note: cleanText(raw.note),
    locked: raw.locked === true,
    billId: raw.locked === true ? cleanText(raw.billId) : '',
  };
}

export function normalizeProrataSheetList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const sheet = normalizeProrataSheet(item);
    if (sheet && !seen.has(sheet.id)) {
      seen.add(sheet.id);
      out.push(sheet);
    }
  }
  return out;
}

// Recompute the figure from the sheet's own inputs. The stored amount
// must equal this, or the sheet is flagged — never silently corrected.
export function prorataSheetCheck(sheet) {
  const expected = sheet ? prorataAmountCents(sheet.monthlyPriceCents, sheet.daysCharged, sheet.daysInMonth) : null;
  return { expectedCents: expected, matches: expected !== null && sheet.amountCents === expected };
}

export function upsertProrataSheet(list, raw) {
  const sheet = normalizeProrataSheet(raw);
  if (!sheet) return null;
  const current = normalizeProrataSheetList(list);
  const existing = current.find((item) => item.id === sheet.id);
  // A locked sheet (bill issued) can never be edited here.
  if (existing && existing.locked) return null;
  const next = current.filter((item) => item.id !== sheet.id);
  next.push(sheet);
  return next;
}

// Locking is the only way a sheet closes: it records the issued bill and
// freezes the sheet. Locking an unknown or already-locked sheet refuses.
export function lockProrataSheet(list, id, billId) {
  const cleanId = cleanText(id);
  const cleanBill = cleanText(billId);
  if (!cleanId || !cleanBill) return null;
  const current = normalizeProrataSheetList(list);
  const found = current.find((item) => item.id === cleanId);
  if (!found || found.locked) return null;
  return current.map((item) => (item.id === cleanId ? { ...item, locked: true, billId: cleanBill } : item));
}

// A locked sheet cannot be removed either — its history stays put.
export function removeProrataSheet(list, id) {
  const cleanId = cleanText(id);
  if (!cleanId) return null;
  const current = normalizeProrataSheetList(list);
  const found = current.find((item) => item.id === cleanId);
  if (!found || found.locked) return null;
  return current.filter((item) => item.id !== cleanId);
}

export function findProrataSheet(list, id) {
  return normalizeProrataSheetList(list).find((item) => item.id === cleanText(id)) || null;
}

export function prorataSheetsForCustomer(list, customerId) {
  const cleanId = cleanText(customerId);
  if (!cleanId) return [];
  return normalizeProrataSheetList(list)
    .filter((item) => item.customerId === cleanId)
    .sort((a, b) => (a.billMonth < b.billMonth ? -1 : a.billMonth > b.billMonth ? 1 : a.eventDate < b.eventDate ? -1 : 1));
}

export function prorataSheetSummaryText(list) {
  const sheets = normalizeProrataSheetList(list);
  const locked = sheets.filter((item) => item.locked).length;
  const total = sheets.reduce((sum, item) => sum + item.amountCents, 0);
  return `${sheets.length} pro-rata sheet${sheets.length === 1 ? '' : 's'} · ${locked} locked · total ${formatProrataRs(total)}.`;
}

function escapeProrata(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function prorataSheetArithmeticText(sheet) {
  if (!sheet) return '';
  const daily = (sheet.monthlyPriceCents / sheet.daysInMonth / 100).toFixed(2);
  return `${formatProrataRs(sheet.monthlyPriceCents)} ÷ ${sheet.daysInMonth} days = Rs. ${daily} per day × ${sheet.daysCharged} days = ${formatProrataRs(sheet.amountCents)}`;
}

export function prorataSheetHtml(sheet) {
  if (!sheet) return '';
  const check = prorataSheetCheck(sheet);
  const label = PRORATA_EVENT_LABELS[sheet.eventType] || sheet.eventType;
  return `<div><strong>${escapeProrata(sheet.customerName || sheet.customerId)}</strong> · ${escapeProrata(label)} · ${escapeProrata(sheet.eventDate)} · bill month ${escapeProrata(sheet.billMonth)}${sheet.locked ? ' · 🔒 locked' : ''}<br>${escapeProrata(prorataSheetArithmeticText(sheet))}${sheet.note ? `<br>Note: ${escapeProrata(sheet.note)}` : ''}${sheet.locked && sheet.billId ? `<br>Issued bill: ${escapeProrata(sheet.billId)}` : ''}${check.matches ? '' : '<br>⚠ Stored amount does not match its inputs — correct through the correction workflow, never by editing this sheet.'}</div>`;
}

export function prorataSheetCsv(list) {
  const sheets = normalizeProrataSheetList(list);
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = ['id,customerId,customerName,eventType,eventDate,billMonth,monthlyPriceCents,daysInMonth,daysCharged,amountCents,locked,billId,note'];
  for (const sheet of sheets) {
    lines.push([sheet.id, sheet.customerId, sheet.customerName, sheet.eventType, sheet.eventDate, sheet.billMonth, sheet.monthlyPriceCents, sheet.daysInMonth, sheet.daysCharged, sheet.amountCents, sheet.locked ? 'yes' : 'no', sheet.billId, sheet.note].map(cell).join(','));
  }
  return lines.join('\n');
}

export function prorataSheetFilename() {
  return 'prorata-sheets.csv';
}
