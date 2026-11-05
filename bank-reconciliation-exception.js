// Plan 223 (Plan 203-350) — Bank reconciliation exception note.
//
// When bank and ledger disagree, the difference used to be chased
// informally. Method reconciliation (Plan 118) covers one method in
// one period, deposit slips (Plan 120) cover slips, and the matching
// queue (Plan 124) covers unmatched bank credits — each covers only
// its own corner. This module is the missing piece, and nothing more:
// one dated, explainable exception note per unexplained bank
// difference.
//
// What this module is NOT:
//   - It explains differences only. It never edits any payment, bank
//     record, deposit slip, or bank credit. A linked slip or credit
//     here is text only: the Plan 120 slip record and the Plan 124
//     credit record are never opened, read, or rewritten, and no
//     bill, payment, or deposit record changes because a note was
//     recorded. Recording a note never moves money.
//   - It is not a reconciliation engine. It does not compute the
//     bank difference itself; the caller supplies the period's bank
//     difference, and this module only checks that the open plus
//     explained exceptions sum to it on the same fixture.
//   - It invents nothing: an exception with no usable date, amount,
//     or method is refused, and a bad figure returns null, never a
//     zero-filled balance.
//
// One record per unexplained bank difference:
//   id, date (strict YYYY-MM-DD), amountCents (signed: positive
//   means the bank figure is higher than the ledger figure, negative
//   means the ledger figure is higher), method, linkedSlip (text,
//   optional), linkedCredit (text, optional), status ('open' or
//   'explained'), explanation (once found), explainedDate (once
//   found). Open exceptions list oldest first, so the oldest gap is
//   chased first; an explained exception keeps its explanation and
//   its date, and is never re-explained.
//
// Pure and import-free: no storage, no DOM, no network, no other
// module. Money is integer cents throughout; a plain rupees figure
// converts to cents exactly once on the way in. Dates are strict
// civil dates checked against a days-in-month table, so no clock
// and no timezone can move a date.

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

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validBankReconExceptionDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= limit;
}

/** Civil date to a day count (Howard Hinnant's algorithm, pure arithmetic). */
function daysFromCivil(value) {
  const [year, month, day] = value.split('-').map(Number);
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = month > 2 ? month - 3 : month + 9;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe;
}

/** Amount to cents: an amountCents field passes through as-is, a plain amount converts rupees exactly once. */
function toCents(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.amountCents !== undefined && raw.amountCents !== null && raw.amountCents !== '') {
    const cents = Number(raw.amountCents);
    return Number.isFinite(cents) ? Math.trunc(cents) : null;
  }
  if (raw.amount !== undefined && raw.amount !== null && raw.amount !== '') {
    const num = Number(raw.amount);
    return Number.isFinite(num) ? Math.round(num * 100) : null;
  }
  return null;
}

/** A period difference supplied as integer cents, or null when unusable. */
function toPeriodCents(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && value !== null && 'amountCents' in value) {
    const cents = Number(value.amountCents);
    return Number.isFinite(cents) ? Math.trunc(cents) : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

/** Normalize one exception, or null when it cannot be used. */
export function normalizeBankReconException(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const date = cleanText(raw.date);
  const method = cleanText(raw.method);
  if (!id || !validBankReconExceptionDate(date) || !method) return null;
  const amountCents = toCents(raw);
  if (amountCents === null || amountCents === 0) return null;
  const status = raw.status === 'explained' ? 'explained' : 'open';
  const explanation = cleanText(raw.explanation);
  const explainedDate = cleanText(raw.explainedDate);
  // An explained exception without an explanation or a real date is
  // not an explained exception at all: it stays open, unexplained.
  if (status === 'explained' && (!explanation || !validBankReconExceptionDate(explainedDate))) {
    return {
      id,
      date,
      amountCents,
      method,
      linkedSlip: cleanText(raw.linkedSlip),
      linkedCredit: cleanText(raw.linkedCredit),
      status: 'open',
      explanation: '',
      explainedDate: '',
    };
  }
  return {
    id,
    date,
    amountCents,
    method,
    linkedSlip: cleanText(raw.linkedSlip),
    linkedCredit: cleanText(raw.linkedCredit),
    status,
    explanation: status === 'explained' ? explanation : '',
    explainedDate: status === 'explained' ? explainedDate : '',
  };
}

/** Normalize a list: drop unusable rows, drop later duplicates by id. */
export function normalizeBankReconExceptionList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of rawList) {
    const row = normalizeBankReconException(raw);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/** Record one exception. Returns null when the record is unusable or the id is taken. */
export function recordBankReconException(list, raw) {
  const base = normalizeBankReconExceptionList(list);
  const row = normalizeBankReconException(raw);
  if (!row) return null;
  if (base.some((item) => item.id === row.id)) return null;
  return [...base, row];
}

/** Remove one exception by id. Always returns a new list. */
export function removeBankReconException(list, id) {
  const base = normalizeBankReconExceptionList(list);
  const wanted = cleanText(id);
  return base.filter((item) => item.id !== wanted);
}

/** Find one exception by id, or null. */
export function findBankReconException(list, id) {
  const wanted = cleanText(id);
  return normalizeBankReconExceptionList(list).find((item) => item.id === wanted) ?? null;
}

/** All exceptions sorted by date, then id. */
export function exceptionsSorted(list) {
  return normalizeBankReconExceptionList(list).sort((a, b) =>
    a.date === b.date ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : (a.date < b.date ? -1 : 1));
}

/** Open exceptions only, oldest first — the age-ordered chase list. */
export function exceptionsOpen(list) {
  return exceptionsSorted(list).filter((item) => item.status === 'open');
}

/** Explained exceptions only, oldest first. */
export function exceptionsExplained(list) {
  return exceptionsSorted(list).filter((item) => item.status === 'explained');
}

/** Age of one exception in whole days against a caller-supplied as-of date, or null. */
export function exceptionAgeDays(exception, asOfDate) {
  const row = normalizeBankReconException(exception);
  const asOf = cleanText(asOfDate);
  if (!row || !validBankReconExceptionDate(asOf)) return null;
  return daysFromCivil(asOf) - daysFromCivil(row.date);
}

/** Exceptions in a period, inclusive at both ends; a bad range yields nothing. */
export function exceptionsForPeriod(list, period) {
  const from = cleanText(period?.from);
  const to = cleanText(period?.to);
  if ((from && !validBankReconExceptionDate(from)) || (to && !validBankReconExceptionDate(to))) return [];
  if (from && to && from > to) return [];
  return exceptionsSorted(list).filter((item) =>
    (!from || item.date >= from) && (!to || item.date <= to));
}

/** Exceptions for one method, case-insensitive. */
export function exceptionsForMethod(list, method) {
  const wanted = cleanText(method).toLowerCase();
  if (!wanted) return [];
  return exceptionsSorted(list).filter((item) => item.method.toLowerCase() === wanted);
}

function sumCents(rows) {
  return rows.reduce((total, item) => total + item.amountCents, 0);
}

/** Sum of open exceptions. */
export function sumOpenExceptions(list) {
  return sumCents(exceptionsOpen(list));
}

/** Sum of explained exceptions. */
export function sumExplainedExceptions(list) {
  return sumCents(exceptionsExplained(list));
}

/**
 * Reconcile the exception list against the period's bank difference
 * supplied by the caller. The list reconciles exactly when open plus
 * explained equals that difference. A bad figure returns null, never
 * a zero-filled answer.
 */
export function reconcileToPeriodDifference(list, periodDifferenceCents) {
  const diff = toPeriodCents(periodDifferenceCents);
  if (diff === null) return null;
  const openCents = sumOpenExceptions(list);
  const explainedCents = sumExplainedExceptions(list);
  const totalCents = openCents + explainedCents;
  return {
    openCents,
    explainedCents,
    totalCents,
    periodDifferenceCents: diff,
    matches: totalCents === diff,
    remainingCents: diff - totalCents,
  };
}

/**
 * Explain one open exception. The explanation and its date are kept
 * exactly; an explained exception is never re-explained, and a bad
 * explanation or date leaves the list unchanged.
 */
export function explainBankReconException(list, id, explanation, explainedDate) {
  const base = normalizeBankReconExceptionList(list);
  const text = cleanText(explanation);
  const date = cleanText(explainedDate);
  if (!text || !validBankReconExceptionDate(date)) return base;
  const wanted = cleanText(id);
  let changed = false;
  const next = base.map((item) => {
    if (item.id !== wanted || item.status !== 'open') return item;
    changed = true;
    return { ...item, status: 'explained', explanation: text, explainedDate: date };
  });
  return changed ? next : base;
}

/** One exception as a plain line of text. */
export function bankReconExceptionText(item) {
  const row = normalizeBankReconException(item);
  if (!row) return '';
  const link = [row.linkedSlip ? `slip ${row.linkedSlip}` : '', row.linkedCredit ? `credit ${row.linkedCredit}` : '']
    .filter(Boolean).join(', ');
  const base = `${row.date} — ${row.method} — ${formatMoney(row.amountCents)}${link ? ` (${link})` : ''} — ${row.status}`;
  return row.status === 'explained'
    ? `${base} — explained ${row.explainedDate}: ${row.explanation}`
    : `${base} — no explanation yet.`;
}

/** One exception as an escaped HTML row. */
export function bankReconExceptionHtml(item) {
  const row = normalizeBankReconException(item);
  if (!row) return '';
  return `<p>${escapeHtml(bankReconExceptionText(row))}</p>`;
}

/** A whole list as escaped HTML. */
export function bankReconExceptionAllHtml(list) {
  const rows = exceptionsSorted(list);
  if (!rows.length) return '<p>No bank reconciliation exceptions recorded.</p>';
  return rows.map((row) => bankReconExceptionHtml(row)).join('');
}

/** Summary line: counts and sums, open and explained. */
export function bankReconExceptionSummaryText(list) {
  const rows = normalizeBankReconExceptionList(list);
  const open = rows.filter((item) => item.status === 'open');
  const explained = rows.filter((item) => item.status === 'explained');
  return `${rows.length} bank reconciliation exception(s): ${open.length} open (${formatMoney(sumCents(open))}), ${explained.length} explained (${formatMoney(sumCents(explained))}).`;
}

/** CSV export of a list, sorted by date. */
export function bankReconExceptionCsv(list) {
  const header = 'id,date,amount_cents,method,linked_slip,linked_credit,status,explanation,explained_date';
  const rows = exceptionsSorted(list).map((row) => [
    row.id, row.date, row.amountCents, row.method, row.linkedSlip,
    row.linkedCredit, row.status, row.explanation, row.explainedDate,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function bankReconExceptionFilename() {
  return 'bank-reconciliation-exceptions.csv';
}
