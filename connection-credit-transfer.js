// Plan 210 (Plan 203-350) — Credit transfer between connections of the same customer.
//
// A customer with two connections (Plan 127) can hold credit on one
// connection while owing on the other, with no clean way to move that
// credit across. This module is that clean way, in writing: one
// credit-transfer record per transfer (customer, from-connection,
// to-connection, amount, date, operator), plus the computed view that
// shows each connection's credit after the recorded transfers are
// applied.
//
// Scope fence, stated plainly:
//   - This moves credit ONLY between connections of the SAME customer,
//     never between customers. It is NOT the cross-customer transfer
//     (credit-transfer.js, SISP-111): that module is neither read nor
//     written here, and its register, bill stamps, and reversal rules
//     are untouched by this plan.
//   - It is NOT the combined dues view itself (Plan 127,
//     combined-dues.js) and NOT the credit balance record (Plan 103,
//     credit-balance.js): those modules are neither read nor written
//     here. The connection ids and credit figures here are only what
//     the caller supplies — this module never follows a connection id
//     into a bill, payment, or credit record, and recording a transfer
//     never changes any bill, payment, customer, or staff record by
//     itself. The adjusted credits live only in the computed view
//     this module returns.
//   - It is import-free: the caller supplies every connection credit
//     and every transfer, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     refused, never mapped onto a neighbouring date).
//   - Amounts are integer cents, exactly: an `amountCents` integer is
//     used as-is, while a plain `amount` is always rupees and converts
//     exactly once (x100). A transfer of zero or less is refused, and
//     a transfer larger than the from-connection's running credit is
//     refused, never clamped and never allowed to drive a credit
//     negative — so the customer's total credit is unchanged by every
//     transfer that is applied.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validTransferDate(value) {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) limit = 29;
  return day <= limit;
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `amountCents` integer is used as-is, while a plain `amount` is
 * always rupees and converts exactly once (x100). Anything else is null.
 */
export function transferAmountCents(value) {
  if (!value || typeof value !== 'object') return null;
  if (Number.isInteger(value.amountCents)) return value.amountCents;
  if (typeof value.amount === 'number' && Number.isFinite(value.amount)) {
    return Math.round(value.amount * 100);
  }
  if (typeof value.amount === 'string' && value.amount.trim() !== '') {
    const parsed = Number(value.amount.trim());
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

function formatRs(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * One normalised connection-credit row, or null when it cannot be one:
 * a missing id or customer, or a negative or unusable credit, is
 * refused outright. A zero-credit connection is still a row — it holds
 * nothing, and dropping it would hide a connection. Unknown fields
 * are dropped, so a row can never grow a bill, payment, or total field.
 */
export function normalizeConnectionCredit(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const customer = cleanText(value.customer);
  if (!id || !customer) return null;
  const creditCents = Number.isInteger(value.creditCents)
    ? value.creditCents
    : transferAmountCents(value);
  if (creditCents === null || !Number.isInteger(creditCents) || creditCents < 0) return null;
  return { id, customer, label: cleanText(value.label), creditCents };
}

export function normalizeConnectionCreditList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of values) {
    const row = normalizeConnectionCredit(entry);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/**
 * One normalised credit-transfer record, or null when it cannot be one:
 * a missing id, customer, from-connection, to-connection, operator, or
 * real date is refused outright; a transfer from a connection to
 * itself is refused outright; a zero or negative amount is refused
 * outright. Unknown fields are dropped, so a record can never grow a
 * bill, payment, or cross-customer field.
 */
export function normalizeConnectionCreditTransfer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const customer = cleanText(raw.customer);
  const fromConnection = cleanText(raw.fromConnection);
  const toConnection = cleanText(raw.toConnection);
  const operator = cleanText(raw.operator);
  const date = cleanText(raw.date);
  if (!id || !customer || !fromConnection || !toConnection || !operator) return null;
  if (fromConnection === toConnection) return null;
  if (!validTransferDate(date)) return null;
  const amountCents = transferAmountCents(raw);
  if (amountCents === null || amountCents <= 0) return null;
  return {
    id,
    customer,
    fromConnection,
    toConnection,
    amountCents,
    date,
    operator,
    note: cleanText(raw.note),
  };
}

export function normalizeConnectionCreditTransferList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const transfer = normalizeConnectionCreditTransfer(raw);
    if (!transfer || seen.has(transfer.id)) continue;
    seen.add(transfer.id);
    out.push(transfer);
  }
  return out;
}

/** Appends a transfer when it normalises and its id is not already recorded. */
export function recordConnectionCreditTransfer(list, raw) {
  const clean = normalizeConnectionCreditTransferList(list);
  const transfer = normalizeConnectionCreditTransfer(raw);
  if (!transfer || clean.some((entry) => entry.id === transfer.id)) return clean;
  return [...clean, transfer];
}

/** Removes a transfer by id; an unknown id leaves the list exactly unchanged. */
export function removeConnectionCreditTransfer(list, id) {
  const clean = normalizeConnectionCreditTransferList(list);
  const wanted = cleanText(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

/** Transfers ordered by date, then id — the order they are applied in. */
export function connectionCreditTransfersSorted(list) {
  return normalizeConnectionCreditTransferList(list)
    .slice()
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
}

export function connectionCreditTransfersForCustomer(list, customer) {
  const wanted = cleanText(customer);
  if (!wanted) return [];
  return connectionCreditTransfersSorted(list).filter((entry) => entry.customer === wanted);
}

/**
 * The computed credit view: each connection's credit after the recorded
 * transfers are applied, in date then id order, on fresh objects —
 * inputs are never mutated and no bill, payment, or customer record is
 * touched.
 *
 * A transfer is APPLIED only when every guard holds: both connections
 * are known, both belong to the transfer's own customer (a transfer
 * naming two different customers is refused, as is one whose
 * connections belong to someone other than the named customer), and
 * the amount fits inside the from-connection's running credit.
 * Anything else lands in `refused` with a plain reason, and the
 * credits are left exactly as they were — refused transfers never
 * move a single paisa.
 *
 * Every applied transfer moves credit within one customer only, so the
 * customer's total credit is unchanged by construction: the
 * from-connection falls by exactly the transfer amount and the
 * to-connection rises by exactly the transfer amount.
 */
export function applyConnectionCreditTransfers(connections, transfers) {
  const rows = normalizeConnectionCreditList(connections).map((row) => ({ ...row }));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const applied = [];
  const refused = [];
  for (const transfer of connectionCreditTransfersSorted(transfers)) {
    const from = byId.get(transfer.fromConnection);
    const to = byId.get(transfer.toConnection);
    if (!from || !to) {
      refused.push({ transfer, reason: 'unknown-connection' });
      continue;
    }
    if (from.customer !== transfer.customer || to.customer !== transfer.customer) {
      refused.push({ transfer, reason: 'different-customers' });
      continue;
    }
    if (from.creditCents < transfer.amountCents) {
      refused.push({ transfer, reason: 'insufficient-credit' });
      continue;
    }
    from.creditCents -= transfer.amountCents;
    to.creditCents += transfer.amountCents;
    applied.push(transfer);
  }
  return { connections: rows, applied, refused };
}

/** Total credit held across a connection list, in integer cents. */
export function connectionCreditTotal(connections) {
  return normalizeConnectionCreditList(connections)
    .reduce((sum, row) => sum + row.creditCents, 0);
}

export function connectionCreditTransferSummary(list) {
  const clean = normalizeConnectionCreditTransferList(list);
  return {
    totalCount: clean.length,
    totalAmountCents: clean.reduce((sum, entry) => sum + entry.amountCents, 0),
  };
}

export function connectionCreditTransferSummaryText(list) {
  const summary = connectionCreditTransferSummary(list);
  if (!summary.totalCount) return 'No connection credit transfers recorded.';
  return `${summary.totalCount} transfer${summary.totalCount === 1 ? '' : 's'} recorded, ${formatRs(summary.totalAmountCents)} moved between connections.`;
}

export function connectionCreditTransferText(transfer) {
  const clean = normalizeConnectionCreditTransfer(transfer);
  if (!clean) return '';
  const note = clean.note ? ` — ${clean.note}` : '';
  return `${clean.id}: ${clean.customer} · ${clean.fromConnection} → ${clean.toConnection} · ${formatRs(clean.amountCents)} · ${clean.date} · ${clean.operator}${note}`;
}

export function connectionCreditTransfersHtml(list) {
  const clean = connectionCreditTransfersSorted(list);
  if (!clean.length) return '<p>No connection credit transfers recorded.</p>';
  return `<ul>${clean.map((entry) => `<li>${escapeHtml(connectionCreditTransferText(entry))}</li>`).join('')}</ul>`;
}

export function connectionCreditTransferCsv(list) {
  const clean = connectionCreditTransfersSorted(list);
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = ['id,customer,from_connection,to_connection,amount_rs,date,operator,note'];
  for (const entry of clean) {
    lines.push([
      cell(entry.id),
      cell(entry.customer),
      cell(entry.fromConnection),
      cell(entry.toConnection),
      cell((entry.amountCents / 100).toFixed(2)),
      cell(entry.date),
      cell(entry.operator),
      cell(entry.note),
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function connectionCreditTransferFilename() {
  return 'connection-credit-transfers.csv';
}
