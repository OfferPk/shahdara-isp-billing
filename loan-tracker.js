// Plan 78 (Plan 1-100) — Temporary loan equipment tracker.
//
// When a faulty ONU or router is taken away for repair, the loan
// unit left in its place is forgotten, so the loan becomes a
// permanent second device and the original repair is never
// chased. This module is that record: one loan per unit, with
// exactly one customer, one loan serial, and one status.
//
// The fences, stated plainly:
//   - A loan never changes the customer's package, bill, or
//     ticket status by itself, and it never creates a bill or
//     payment. The fault ticket (Plan 21) and the connection
//     register (Plan 17) are linked by id only (ticketId,
//     connectionId, where the operator supplies one). No ticket
//     or connection record is read or rewritten here.
//   - Stock counts (Plan 51) are updated only through the normal
//     issue/return movement, never here — this module holds no
//     stock count of its own.
//   - Returning a loan closes it and leaves the original
//     device's repair or warranty record (Plan 80) intact: this
//     module holds no repair or warranty field at all, so it
//     cannot touch one.
//   - Half-formed records are refused outright, never stored
//     half-formed. Dates are strict YYYY-MM-DD calendar dates
//     (2026-02-30 is not a date). Inputs are never mutated, and
//     the module never reads storage, the clock, or the network.
//     Overdue math always takes today as a caller-supplied date.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const LOAN_DEVICE_TYPES = ['onu', 'router', 'other'];

export const LOAN_DEVICE_TYPE_LABELS = {
  onu: 'ONU',
  router: 'Router',
  other: 'Other device',
};

export const LOAN_STATUSES = ['out', 'returned', 'converted'];

export const LOAN_STATUS_LABELS = {
  out: 'Out on loan',
  returned: 'Returned',
  converted: 'Converted to permanent',
};

const MOHALLA_ALIASES = {
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
};

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const raw = text(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function validLoanDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

function daysBetween(earlier, later) {
  const [y1, m1, d1] = earlier.split('-').map(Number);
  const [y2, m2, d2] = later.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

// Canonical mohalla key for filtering, mirroring the Plan T rule
// as the other pure modules do: a leading "Mohalla" is stripped,
// case and whitespace are folded, and the known aliases apply.
// Anything else keeps its own folded label, never rewritten.
export function loanMohallaKey(value) {
  const raw = text(value);
  if (!raw) return null;
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return null;
  const folded = stripped.toLowerCase().replace(/\s+/g, ' ');
  const aliased = MOHALLA_ALIASES[folded.replace(/\s+/g, '')] ?? MOHALLA_ALIASES[folded];
  if (aliased) return aliased;
  return stripped.toUpperCase();
}

function loanMohallaLabel(value) {
  const raw = text(value);
  if (!raw) return '';
  return raw.replace(/^mohalla\s+/i, '').trim();
}

export function normalizeLoan(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const deviceType = text(raw.deviceType);
  const loanSerial = text(raw.loanSerial);
  const dateIssued = validLoanDate(raw.dateIssued);
  const expectedReturnDate = validLoanDate(raw.expectedReturnDate);
  const status = text(raw.status);
  if (!id || !customerId) return null;
  if (!LOAN_DEVICE_TYPES.includes(deviceType)) return null;
  if (!loanSerial) return null;
  if (!dateIssued) return null;
  if (!expectedReturnDate) return null;
  if (!LOAN_STATUSES.includes(status)) return null;
  const note = text(raw.note);
  // A loan converted to permanent must carry the operator's
  // note saying so; anything else is half-formed and refused.
  if (status === 'converted' && !note) return null;
  const returnDate = validLoanDate(raw.returnDate);
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    ticketId: text(raw.ticketId),
    connectionId: text(raw.connectionId),
    deviceType,
    loanSerial,
    originalSerial: text(raw.originalSerial),
    dateIssued,
    expectedReturnDate,
    returnDate: status === 'returned' ? (returnDate ?? '') : '',
    status,
    note: status === 'converted' ? note : '',
    mohalla: loanMohallaLabel(raw.mohalla),
    mohallaKey: loanMohallaKey(raw.mohalla),
  };
}

export function normalizeLoanList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const row of list) {
    const entry = normalizeLoan(row);
    if (entry) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

export function findLoan(list, id) {
  const entries = normalizeLoanList(list);
  return entries.find((entry) => entry.id === text(id)) ?? null;
}

export function upsertLoan(list, record) {
  const entry = normalizeLoan(record);
  if (!entry) return Array.isArray(list) ? normalizeLoanList(list) : [];
  const entries = normalizeLoanList(list);
  const at = entries.findIndex((row) => row.id === entry.id);
  if (at >= 0) entries[at] = entry;
  else entries.push(entry);
  return entries;
}

export function removeLoan(list, id) {
  const entries = normalizeLoanList(list);
  return entries.filter((entry) => entry.id !== text(id));
}

function moveLoan(list, id, next) {
  const entries = normalizeLoanList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status !== 'out') return entries;
  const moved = normalizeLoan({ ...current, ...next });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

// Only a loan still out can be returned. Returning it closes
// it; the original device's repair or warranty record is not
// held here, so nothing about it can change.
export function markLoanReturned(list, id, returnDate) {
  return moveLoan(list, id, { status: 'returned', returnDate: returnDate ?? '', note: '' });
}

// Only a loan still out can be converted to permanent, and only
// with the operator's note saying so.
export function convertLoanPermanent(list, id, note) {
  if (!text(note)) return normalizeLoanList(list);
  return moveLoan(list, id, { status: 'converted', note: text(note), returnDate: '' });
}

// A returned or converted loan can be reopened to out when the
// operator recorded the wrong outcome; the note and return date
// are cleared with it, so a reopened loan carries no stale trail.
export function reopenLoan(list, id) {
  const entries = normalizeLoanList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status === 'out') return entries;
  const moved = normalizeLoan({ ...current, status: 'out', note: '', returnDate: '' });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

function byDateThenId(a, b) {
  if (a.dateIssued !== b.dateIssued) return a.dateIssued < b.dateIssued ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function loansFiltered(list, filters = {}) {
  const entries = normalizeLoanList(list);
  const status = text(filters.status);
  const deviceType = text(filters.deviceType);
  const mohalla = text(filters.mohalla);
  // Annual Owner Summary cleanup (2026-11-13): the filter
  // placeholder now reads "Filter by mohalla (or Unassigned)", so
  // the folded word must match the same no-mohalla rows as the
  // literal '__unassigned__' sentinel (kept for back-compat).
  const isUnassigned = mohalla === '__unassigned__' || loanMohallaKey(mohalla) === 'UNASSIGNED';
  const wantedKey = isUnassigned ? '__unassigned__' : loanMohallaKey(mohalla);
  return entries
    .filter((entry) => (status ? entry.status === status : true))
    .filter((entry) => (deviceType ? entry.deviceType === deviceType : true))
    .filter((entry) => {
      if (!mohalla) return true;
      if (wantedKey === '__unassigned__') return !entry.mohallaKey;
      return entry.mohallaKey === wantedKey;
    })
    .sort(byDateThenId);
}

export function outLoans(list, filters = {}) {
  return loansFiltered(list, { ...filters, status: 'out' });
}

// Overdue loans: still out, and the expected return date is
// before the caller-supplied today. Most overdue first, then
// earliest expected return, then id. A loan due today is not
// overdue; a returned or converted loan never appears here.
export function overdueLoans(list, today) {
  const todayDate = validLoanDate(today);
  if (!todayDate) return [];
  return normalizeLoanList(list)
    .filter((entry) => entry.status === 'out' && entry.expectedReturnDate < todayDate)
    .map((entry) => ({ ...entry, daysOverdue: daysBetween(entry.expectedReturnDate, todayDate) }))
    .sort((a, b) => {
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
      if (a.expectedReturnDate !== b.expectedReturnDate) return a.expectedReturnDate < b.expectedReturnDate ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

export function buildLoanSummary(list, today) {
  const entries = normalizeLoanList(list);
  const summary = {
    total: entries.length,
    out: 0,
    returned: 0,
    converted: 0,
    overdue: 0,
    byDeviceType: {},
  };
  for (const entry of entries) {
    summary[entry.status] += 1;
    summary.byDeviceType[entry.deviceType] = (summary.byDeviceType[entry.deviceType] ?? 0) + 1;
  }
  summary.overdue = overdueLoans(list, today).length;
  return summary;
}

export function loanSummaryText(summary) {
  if (!summary) return 'No loans recorded.';
  return `${summary.total} loan${summary.total === 1 ? '' : 's'} recorded — ${summary.out} out, ${summary.returned} returned, ${summary.converted} converted to permanent, ${summary.overdue} overdue.`;
}

export function loanHtml(rows) {
  const entries = normalizeLoanList(rows);
  if (entries.length === 0) return '<p class="empty-state">No loans recorded.</p>';
  const body = entries
    .sort(byDateThenId)
    .map((entry) => {
      const extra = entry.status === 'returned' && entry.returnDate
        ? ` · returned ${escapeHtml(entry.returnDate)}`
        : entry.status === 'converted'
          ? ` · ${escapeHtml(entry.note)}`
          : '';
      const original = entry.originalSerial ? ` · original ${escapeHtml(entry.originalSerial)}` : '';
      return `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.customerName || entry.customerId)}</td><td>${escapeHtml(LOAN_DEVICE_TYPE_LABELS[entry.deviceType])}</td><td>${escapeHtml(entry.loanSerial)}</td><td>${escapeHtml(entry.dateIssued)}</td><td>${escapeHtml(entry.expectedReturnDate)}</td><td>${escapeHtml(LOAN_STATUS_LABELS[entry.status])}${extra}${original}</td></tr>`;
    })
    .join('');
  // Owner 5-part fix: the seven-column table scrolls inside its own
  // card on a phone instead of clipping the right-side columns.
  return `<div class="table-scroll"><table><thead><tr><th>Loan</th><th>Customer</th><th>Device</th><th>Loan serial</th><th>Date issued</th><th>Return due</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export function loanCsv(rows) {
  const entries = normalizeLoanList(rows).sort(byDateThenId);
  const lines = ['Loan,Customer,Device,Loan serial,Original serial,Date issued,Return due,Return date,Status,Note,Ticket id,Connection id,Mohalla'];
  for (const entry of entries) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.customerName || entry.customerId),
      csvCell(LOAN_DEVICE_TYPE_LABELS[entry.deviceType]),
      csvCell(entry.loanSerial),
      csvCell(entry.originalSerial),
      csvCell(entry.dateIssued),
      csvCell(entry.expectedReturnDate),
      csvCell(entry.returnDate),
      csvCell(LOAN_STATUS_LABELS[entry.status]),
      csvCell(entry.note),
      csvCell(entry.ticketId),
      csvCell(entry.connectionId),
      csvCell(entry.mohalla),
    ].join(','));
  }
  return lines.join('\n');
}

export function loanFilename() {
  return 'loan-tracker.csv';
}
