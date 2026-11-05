// Plan 221 (Plan 203-350) — Deposit top-up note.
//
// When a customer's security deposit is increased — for example on
// a package change or a second connection — the increase has no
// record of its own, even though the deposit register (Plan 77)
// holds the balance and the interest notes (Plan 114) cover
// adjustments. This module is that record only: one top-up record
// per deposit increase (deposit reference, amount added, date,
// reason, payment or credit source), so that when a customer
// leaves, the deposit owed back is a complete history — original,
// top-ups, and notes — not a disputed single figure.
//
// What this module is NOT, stated plainly:
//   - It is not the deposit register (Plan 77). It never reads or
//     rewrites the register itself; it only records the increase.
//     The caller supplies the original deposit amount when a
//     balance is stated, and the register balance is a plain sum
//     of original + top-ups + notes on the same fixture.
//   - It is not the interest/adjustment notes (Plan 114). Those
//     notes are never read or rewritten here; a note total is
//     supplied by the caller when a balance is stated, never
//     fetched from another module.
//   - It is not any SISP/MD module. The corresponding SISP/MD
//     material was checked first: no deposit top-up record exists
//     there, so this module adds only the missing piece and never
//     reads or rewrites an SISP/MD record.
//   - Recording a top-up never changes any bill, payment, or
//     customer record by itself.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A top-up with no id, no deposit reference, no strict date,
//     no positive amount added, no reason, or no source is
//     refused outright. Unknown fields are dropped, so a top-up
//     can never grow a bill, payment, or price field.
//   - A duplicate id is never rewritten. There is no edit
//     function; only recording a top-up and removal.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDepositTopUpDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= limit;
}

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// An amount added is held money in integer cents. A field named
// *Cents is already in cents and is used as-is; a plain amount
// field is rupees and converts at x100, so a stored record
// re-read through this normaliser never inflates a hundredfold.
function toCents(raw) {
  if (raw.amountAddedCents !== undefined && raw.amountAddedCents !== null && text(raw.amountAddedCents) !== '') {
    if (typeof raw.amountAddedCents === 'boolean') return null;
    const num = Number(raw.amountAddedCents);
    if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) return null;
    return num;
  }
  if (raw.amountAdded === undefined || raw.amountAdded === null || typeof raw.amountAdded === 'boolean') return null;
  if (typeof raw.amountAdded === 'string' && raw.amountAdded.trim() === '') return null;
  const num = Number(raw.amountAdded);
  if (!Number.isFinite(num) || num <= 0) return null;
  const cents = Math.round(num * 100);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return cents;
}

export function normalizeDepositTopUp(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const depositRef = text(raw.depositRef);
  const amountAddedCents = toCents(raw);
  const date = text(raw.date);
  const reason = text(raw.reason);
  const source = text(raw.source);
  if (!id || !depositRef) return null;
  if (amountAddedCents === null) return null;
  if (!validDepositTopUpDate(date)) return null;
  if (!reason || !source) return null;
  return {
    id,
    depositRef,
    customer: text(raw.customer),
    amountAddedCents,
    date,
    reason,
    source,
  };
}

export function normalizeDepositTopUpList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const row of list) {
    const entry = normalizeDepositTopUp(row);
    if (entry && !byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

export function findDepositTopUp(list, id) {
  const entries = normalizeDepositTopUpList(list);
  return entries.find((entry) => entry.id === text(id)) ?? null;
}

export function recordDepositTopUp(list, record) {
  const entries = normalizeDepositTopUpList(list);
  const entry = normalizeDepositTopUp(record);
  if (!entry) return entries;
  if (entries.some((row) => row.id === entry.id)) return entries;
  return [...entries, entry];
}

export function removeDepositTopUp(list, id) {
  const entries = normalizeDepositTopUpList(list);
  return entries.filter((entry) => entry.id !== text(id));
}

function byDateThenDepositThenId(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.depositRef !== b.depositRef) return a.depositRef < b.depositRef ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function depositTopUpsSorted(list) {
  return normalizeDepositTopUpList(list).sort(byDateThenDepositThenId);
}

export function depositTopUpsForDeposit(list, depositRef) {
  const ref = text(depositRef);
  if (!ref) return [];
  return depositTopUpsSorted(list).filter((entry) => entry.depositRef === ref);
}

export function depositTopUpsForCustomer(list, customer) {
  const query = text(customer).toLowerCase();
  if (!query) return depositTopUpsSorted(list);
  return depositTopUpsSorted(list).filter((entry) => entry.customer.toLowerCase().includes(query));
}

// The total added to one deposit by its top-ups, in cents.
export function depositTopUpTotalCents(list, depositRef) {
  return depositTopUpsForDeposit(list, depositRef)
    .reduce((sum, entry) => sum + entry.amountAddedCents, 0);
}

// The register balance for one deposit on a single fixture: the
// original deposit held, plus its top-ups, plus its notes (the
// caller supplies the note total, in cents, from the Plan 114
// notes — this module never reads that module). Returns null
// when any figure is unusable, never a zero-filled balance.
export function depositRegisterBalance(originalCents, topUpCents, notesCents) {
  if (!Number.isInteger(originalCents) || !Number.isInteger(topUpCents) || !Number.isInteger(notesCents)) return null;
  return {
    originalCents,
    topUpCents,
    notesCents,
    balanceCents: originalCents + topUpCents + notesCents,
  };
}

export function depositWithTopUpsBalance(list, depositRef, originalCents, notesCents) {
  const topUpCents = depositTopUpTotalCents(list, depositRef);
  const balance = depositRegisterBalance(originalCents, topUpCents, notesCents);
  if (!balance) return null;
  return {
    depositRef: text(depositRef),
    topUpCount: depositTopUpsForDeposit(list, depositRef).length,
    ...balance,
  };
}

export function formatDepositTopUpAmount(cents) {
  if (!Number.isFinite(cents)) return 'not recorded';
  return `Rs. ${(cents / 100).toFixed(2)}`;
}

export function depositTopUpSummaryText(list) {
  const entries = normalizeDepositTopUpList(list);
  if (entries.length === 0) return 'No deposit top-ups recorded.';
  const total = entries.reduce((sum, entry) => sum + entry.amountAddedCents, 0);
  return `${entries.length} deposit top-up${entries.length === 1 ? '' : 's'} recorded, ${formatDepositTopUpAmount(total)} added in total.`;
}

export function depositTopUpText(entry) {
  const normalized = normalizeDepositTopUp(entry);
  if (!normalized) return 'Deposit top-up not recorded: its inputs are incomplete.';
  const who = normalized.customer ? ` for ${normalized.customer}` : '';
  return `Top-up ${normalized.id} to deposit ${normalized.depositRef}${who}: ${formatDepositTopUpAmount(normalized.amountAddedCents)} added on ${normalized.date} — ${normalized.reason} (source: ${normalized.source}).`;
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function depositTopUpHtml(entry) {
  const normalized = normalizeDepositTopUp(entry);
  if (!normalized) return '<p>Deposit top-up not recorded: its inputs are incomplete.</p>';
  return `<div>${escapeHtml(normalized.id)} · deposit ${escapeHtml(normalized.depositRef)}${normalized.customer ? ` · ${escapeHtml(normalized.customer)}` : ''} · ${escapeHtml(formatDepositTopUpAmount(normalized.amountAddedCents))} · ${escapeHtml(normalized.date)} · ${escapeHtml(normalized.reason)} · source: ${escapeHtml(normalized.source)}</div>`;
}

export function depositTopUpAllHtml(rows) {
  const entries = depositTopUpsSorted(rows);
  if (entries.length === 0) return '<p class="empty-state">No deposit top-ups recorded.</p>';
  const body = entries.map((entry) => `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.depositRef)}</td><td>${escapeHtml(entry.customer)}</td><td>${escapeHtml(formatDepositTopUpAmount(entry.amountAddedCents))}</td><td>${escapeHtml(entry.date)}</td><td>${escapeHtml(entry.reason)}</td><td>${escapeHtml(entry.source)}</td></tr>`).join('');
  return `<table><thead><tr><th>Top-up</th><th>Deposit</th><th>Customer</th><th>Amount added</th><th>Date</th><th>Reason</th><th>Source</th></tr></thead><tbody>${body}</tbody></table>`;
}

function csvCell(value) {
  const raw = text(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function depositTopUpCsv(rows) {
  const entries = depositTopUpsSorted(rows);
  const lines = ['Top-up,Deposit,Customer,Amount added,Date,Reason,Source'];
  for (const entry of entries) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.depositRef),
      csvCell(entry.customer),
      csvCell(formatDepositTopUpAmount(entry.amountAddedCents)),
      csvCell(entry.date),
      csvCell(entry.reason),
      csvCell(entry.source),
    ].join(','));
  }
  return lines.join('\n');
}

export function depositTopUpFilename() {
  return 'deposit-topups.csv';
}
