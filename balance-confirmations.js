// Plan 128 (Plan 101-202) — Balance confirmation acknowledgement record:
// a dated "you confirmed this balance on this date" ends the most
// common version of the "I never agreed to that balance" dispute,
// without settling, reducing, or increasing anything.
//
// This module is the RECORD only, and nothing else:
//
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     never imports another module, and never mutates an input.
//     Recording a confirmation changes no balance at all — a later
//     balance change leaves every earlier confirmation exactly as
//     recorded, and confirming a balance never settles, reduces, or
//     increases it. The record is only evidence of what was agreed.
//   - One balance-confirmation record per customer per date: saving
//     a second record for the same customer and date replaces the
//     first, so a customer can never carry two answers for one date.
//     A later confirmation is a new record for its own date; it
//     never rewrites an earlier one.
//   - A record names a customer, the exact balance confirmed, a
//     date, and how it was confirmed (in person, by message, or on
//     paper kept at the shop). It is not a payment, and it is not
//     the Plan 95 acknowledgement record — that record is neither
//     read nor written here, and this record carries no version
//     field of its own.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). Half-formed records are refused
//     outright, never stored half-formed. Amounts are integer cents:
//     a plain rupees figure converts exactly once, a `*Cents`
//     figure passes through as-is, and anything else is refused.
//     A confirmed balance of zero is a real record (nothing due);
//     a negative figure is a credit balance, shown plainly as one.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validBalanceConfirmationDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  // Plan 130 fix: this table previously had 13 entries, shifting every
  // month from August onward by one and wrongly rejecting Aug 31,
  // Oct 31, and Dec 31 (while wrongly accepting Sep 31 and Nov 31).
  // The correct calendar has exactly 12 entries.
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

export const BALANCE_CONFIRMATION_METHODS = {
  IN_PERSON: 'in-person',
  MESSAGE: 'message',
  PAPER: 'paper',
};

export const BALANCE_CONFIRMATION_METHOD_LABELS = {
  'in-person': 'In person',
  message: 'By message',
  paper: 'On paper kept at the shop',
};

export function balanceConfirmationMethodLabel(method) {
  return BALANCE_CONFIRMATION_METHOD_LABELS[method] || 'Not recorded';
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * integer `balanceCents` is used as-is, while a plain `balance` is
 * always rupees and converts exactly once (×100). Anything else is
 * null. Zero is allowed (nothing due); a negative figure is a
 * credit balance, not an error.
 */
export function balanceConfirmationAmountCents(value) {
  if (!value || typeof value !== 'object') return null;
  if (Number.isInteger(value.balanceCents)) return value.balanceCents;
  if (typeof value.balance === 'number' && Number.isFinite(value.balance)) {
    return Math.round(value.balance * 100);
  }
  if (typeof value.balance === 'string' && value.balance.trim() !== '') {
    const parsed = Number(value.balance.trim());
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

// Only these keys ever survive normalisation. Anything else on the
// input — including any payment, bill, or version field — is dropped,
// so a confirmation can never grow into a payment or a version record.
const BALANCE_CONFIRMATION_KEYS = ['id', 'customer', 'customerName', 'balanceCents', 'date', 'method', 'recordedBy', 'note'];

export function normalizeBalanceConfirmation(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const balanceCents = balanceConfirmationAmountCents(record);
  const date = validBalanceConfirmationDate(record.date);
  const method = cleanText(record.method);
  if (!id || !customer || balanceCents === null || !date) return null;
  if (!Object.values(BALANCE_CONFIRMATION_METHODS).includes(method)) return null;
  const out = {
    id,
    customer,
    customerName: cleanText(record.customerName),
    balanceCents,
    date,
    method,
    recordedBy: cleanText(record.recordedBy),
    note: cleanText(record.note),
  };
  // Prove the fence: the normalised record carries exactly the
  // allowed keys, nothing more.
  if (Object.keys(out).some((key) => !BALANCE_CONFIRMATION_KEYS.includes(key))) return null;
  return out;
}

export function normalizeBalanceConfirmationList(list) {
  if (!Array.isArray(list)) return [];
  const byKey = new Map();
  for (const item of list) {
    const record = normalizeBalanceConfirmation(item);
    if (!record) continue;
    // Last record wins for one customer + one date, and for one id.
    byKey.set(`${record.customer}::${record.date}`, record);
  }
  const byId = new Map();
  for (const record of byKey.values()) {
    byId.set(record.id, record);
  }
  // When two records share an id but different customer/date keys,
  // the later one wins and the earlier key is dropped with it.
  const kept = [...byKey.values()].filter((record) => byId.get(record.id) === record);
  return kept;
}

export function upsertBalanceConfirmation(list, record) {
  const normalized = normalizeBalanceConfirmation(record);
  if (!normalized) return Array.isArray(list) ? normalizeBalanceConfirmationList(list) : [];
  const kept = normalizeBalanceConfirmationList(list).filter(
    (item) => item.id !== normalized.id
      && !(item.customer === normalized.customer && item.date === normalized.date),
  );
  return [...kept, normalized];
}

export function removeBalanceConfirmation(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return Array.isArray(list) ? normalizeBalanceConfirmationList(list) : [];
  return normalizeBalanceConfirmationList(list).filter((item) => item.id !== wanted);
}

export function findBalanceConfirmation(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return null;
  return normalizeBalanceConfirmationList(list).find((item) => item.id === wanted) || null;
}

/** One customer's confirmations, newest date first, then id A–Z. */
export function confirmationsForCustomer(list, customer) {
  const wanted = cleanText(customer);
  if (!wanted) return [];
  return normalizeBalanceConfirmationList(list)
    .filter((item) => item.customer === wanted)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
}

export function latestConfirmationForCustomer(list, customer) {
  const rows = confirmationsForCustomer(list, customer);
  return rows.length > 0 ? rows[0] : null;
}

export function formatBalanceConfirmationCents(cents) {
  if (!Number.isInteger(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

export function balanceConfirmationSummaryText(list, customer) {
  const rows = confirmationsForCustomer(list, customer);
  if (rows.length === 0) return 'No balance confirmation recorded.';
  const latest = rows[0];
  return `${rows.length} confirmation${rows.length === 1 ? '' : 's'}; latest ${latest.date}: ${formatBalanceConfirmationCents(latest.balanceCents)} (${balanceConfirmationMethodLabel(latest.method)}).`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function balanceConfirmationHtml(list, customer) {
  const rows = customer ? confirmationsForCustomer(list, customer) : normalizeBalanceConfirmationList(list).sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  if (rows.length === 0) return '<p>No balance confirmation recorded.</p>';
  const body = rows.map((row) => {
    const balance = row.balanceCents < 0
      ? `${formatBalanceConfirmationCents(row.balanceCents)} (credit)`
      : formatBalanceConfirmationCents(row.balanceCents);
    return `<tr><td>${escapeHtml(row.customerName || row.customer)}</td><td>${escapeHtml(row.date)}</td><td>${balance}</td><td>${escapeHtml(balanceConfirmationMethodLabel(row.method))}</td><td>${escapeHtml(row.recordedBy || '—')}</td><td>${escapeHtml(row.note || '—')}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>Customer</th><th>Date</th><th>Balance confirmed</th><th>Method</th><th>Recorded by</th><th>Note</th></tr></thead><tbody>${body}</tbody></table><p>Confirming a balance never settles, reduces, or increases it — this is only the dated record of what the customer agreed.</p>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function balanceConfirmationCsv(list, customer) {
  const rows = customer ? confirmationsForCustomer(list, customer) : normalizeBalanceConfirmationList(list);
  const lines = rows.map((row) => [row.id, row.customer, row.customerName, row.balanceCents, row.date, row.method, row.recordedBy, row.note].map(csvCell).join(','));
  return `id,customer,customer_name,balance_cents,date,method,recorded_by,note\n${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`;
}

export function balanceConfirmationFilename() {
  return 'balance-confirmations.csv';
}
