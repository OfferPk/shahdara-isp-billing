// Plan 130 (Plan 101-202) — Split payment across methods on one receipt.
//
// A customer who pays part in cash and part by transfer used to get
// two receipts, or one receipt that hid the split, so a per-method
// reconciliation could never tie back to the receipt. This module
// is the one honest receipt for that one payment:
//
//   - One receipt, one receipt number, one total: a record carries
//     a single payment split across two or more methods, each part
//     naming its method and its amount. The parts sum exactly to
//     the receipt total in integer cents, and a caller-supplied
//     total that disagrees with its parts is refused outright,
//     never silently corrected.
//   - Splitting never creates a second payment record or a second
//     receipt number: a receipt number already on record is never
//     recorded again, and there is no edit or remove function —
//     a wrong split is corrected by the correction workflow, not
//     by rewriting this record.
//   - Each part appears in its method's reconciliation: parts are
//     grouped by method the same way the per-method reconciliation
//     groups them — cash (Cash and every "Cash at … shop" variant),
//     bank transfer (Bank Transfer, Raast), mobile wallet
//     (JazzCash, Easypaisa, NayaPay) — and any other recorded
//     method keeps its own label as its own group, never coerced.
//     This module imports nothing and reads no other record: the
//     grouping is mirrored here in plain code, and the
//     reconciliation itself is never opened or rewritten.
//   - This is a different split from allocating one payment across
//     bills: that allocation is never read or rewritten here. This
//     record only says how one payment's money arrived, method by
//     method, under one receipt number.
//   - Pure and import-free: the caller supplies every record, and
//     the module never reads storage, the clock, or the network,
//     never mutates an input, and never changes any payment total.
//     Amounts are integer cents: a plain rupees figure converts
//     exactly once, a `*Cents` figure passes through as-is.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validSplitReceiptDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

/**
 * One part amount to integer cents, without ever guessing the unit:
 * an integer `amountCents` is used as-is, while a plain `amount`
 * is always rupees and converts exactly once (×100). Anything else
 * — or a zero or negative part, which is not a part of a payment —
 * is null.
 */
export function splitPartAmountCents(part) {
  if (!part || typeof part !== 'object') return null;
  let cents = null;
  if (Number.isInteger(part.amountCents)) {
    cents = part.amountCents;
  } else if (typeof part.amount === 'number' && Number.isFinite(part.amount)) {
    cents = Math.round(part.amount * 100);
  } else if (typeof part.amount === 'string' && part.amount.trim() !== '') {
    const parsed = Number(part.amount.trim());
    if (Number.isFinite(parsed)) cents = Math.round(parsed * 100);
  }
  if (cents === null || cents <= 0) return null;
  return cents;
}

// Canonical method group, mirroring the per-method reconciliation
// grouping: cash variants group under cash, bank transfer and Raast
// under bank transfer, the three wallets under mobile wallet, and
// anything else keeps its own lower-cased label as its group.
const CASH_ALIASES = new Set(['cash']);
const BANK_ALIASES = new Set(['bank transfer', 'banktransfer', 'bank_transfer', 'raast']);
const WALLET_ALIASES = new Set(['jazzcash', 'easypaisa', 'nayapay', 'mobile wallet', 'mobilewallet', 'mobile_wallet', 'wallet']);

export function splitMethodGroup(method) {
  const raw = cleanText(method);
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[\s-]+/g, ' ').trim();
  if (CASH_ALIASES.has(key) || key.startsWith('cash at ')) return 'cash';
  if (BANK_ALIASES.has(key)) return 'bank_transfer';
  if (WALLET_ALIASES.has(key)) return 'mobile_wallet';
  return key;
}

export function splitMethodGroupLabel(group) {
  if (group === 'cash') return 'Cash';
  if (group === 'bank_transfer') return 'Bank transfer';
  if (group === 'mobile_wallet') return 'Mobile wallet';
  return group || 'Not recorded';
}

// Only these keys ever survive normalisation on a part.
const SPLIT_PART_KEYS = ['method', 'group', 'amountCents'];

export function normalizeSplitPart(part) {
  if (!part || typeof part !== 'object') return null;
  const method = cleanText(part.method);
  const amountCents = splitPartAmountCents(part);
  if (!method || amountCents === null) return null;
  const group = splitMethodGroup(method);
  if (!group) return null;
  const out = { method, group, amountCents };
  if (Object.keys(out).some((key) => !SPLIT_PART_KEYS.includes(key))) return null;
  return out;
}

// Only these keys ever survive normalisation on a receipt.
const SPLIT_RECEIPT_KEYS = ['id', 'receiptNumber', 'customer', 'customerName', 'date', 'parts', 'totalCents', 'note'];

export function normalizeSplitReceipt(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const receiptNumber = cleanText(record.receiptNumber);
  const customer = cleanText(record.customer);
  const date = validSplitReceiptDate(record.date);
  if (!id || !receiptNumber || !customer || !date) return null;
  if (!Array.isArray(record.parts) || record.parts.length < 2) return null;
  const parts = [];
  const seenMethods = new Set();
  for (const rawPart of record.parts) {
    const part = normalizeSplitPart(rawPart);
    if (!part) return null;
    // The same method twice is not a split across methods.
    const methodKey = part.method.toLowerCase();
    if (seenMethods.has(methodKey)) return null;
    seenMethods.add(methodKey);
    parts.push(part);
  }
  const totalCents = parts.reduce((sum, part) => sum + part.amountCents, 0);
  // A caller-supplied total that disagrees with its parts is
  // refused outright, never silently corrected to match.
  if (record.totalCents !== undefined && record.totalCents !== null && record.totalCents !== '') {
    if (!Number.isInteger(record.totalCents) || record.totalCents !== totalCents) return null;
  }
  if (record.total !== undefined && record.total !== null && record.total !== '') {
    const supplied = typeof record.total === 'number' && Number.isFinite(record.total)
      ? Math.round(record.total * 100)
      : (typeof record.total === 'string' && record.total.trim() !== '' && Number.isFinite(Number(record.total.trim()))
        ? Math.round(Number(record.total.trim()) * 100)
        : null);
    if (supplied === null || supplied !== totalCents) return null;
  }
  const out = {
    id,
    receiptNumber,
    customer,
    customerName: cleanText(record.customerName),
    date,
    parts,
    totalCents,
    note: cleanText(record.note),
  };
  if (Object.keys(out).some((key) => !SPLIT_RECEIPT_KEYS.includes(key))) return null;
  return out;
}

/**
 * Normalised list, first record wins: a later record reusing an id
 * or a receipt number is dropped, never rewritten over the first —
 * so one payment can never grow a second receipt number.
 */
export function normalizeSplitReceiptList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenNumbers = new Set();
  const out = [];
  for (const item of list) {
    const record = normalizeSplitReceipt(item);
    if (!record) continue;
    if (seenIds.has(record.id) || seenNumbers.has(record.receiptNumber)) continue;
    seenIds.add(record.id);
    seenNumbers.add(record.receiptNumber);
    out.push(record);
  }
  return out;
}

/** Append-only: a refused record leaves the list exactly as it was. */
export function upsertSplitReceipt(list, record) {
  const normalized = normalizeSplitReceipt(record);
  const base = normalizeSplitReceiptList(list);
  if (!normalized) return base;
  if (base.some((item) => item.id === normalized.id || item.receiptNumber === normalized.receiptNumber)) return base;
  return [...base, normalized];
}

export function findSplitReceipt(list, receiptNumber) {
  const wanted = cleanText(receiptNumber);
  if (!wanted) return null;
  return normalizeSplitReceiptList(list).find((item) => item.receiptNumber === wanted) || null;
}

/** One customer's split receipts, newest date first, then receipt number A–Z. */
export function splitReceiptsForCustomer(list, customer) {
  const wanted = cleanText(customer);
  if (!wanted) return [];
  return normalizeSplitReceiptList(list)
    .filter((item) => item.customer === wanted)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.receiptNumber < b.receiptNumber ? -1 : a.receiptNumber > b.receiptNumber ? 1 : 0)));
}

/** Per-method totals for one receipt: parts in one group sum into one row. */
export function methodTotalsForReceipt(receipt) {
  const record = normalizeSplitReceipt(receipt);
  if (!record) return [];
  const byGroup = new Map();
  for (const part of record.parts) {
    const row = byGroup.get(part.group) || { group: part.group, label: splitMethodGroupLabel(part.group), methods: [], amountCents: 0 };
    if (!row.methods.includes(part.method)) row.methods.push(part.method);
    row.amountCents += part.amountCents;
    byGroup.set(part.group, row);
  }
  return [...byGroup.values()];
}

/** Per-method totals across receipts: every part lands in its method's row. */
export function methodTotalsAcrossReceipts(list) {
  const byGroup = new Map();
  for (const receipt of normalizeSplitReceiptList(list)) {
    for (const row of methodTotalsForReceipt(receipt)) {
      const existing = byGroup.get(row.group) || { group: row.group, label: row.label, methods: [], amountCents: 0 };
      for (const method of row.methods) {
        if (!existing.methods.includes(method)) existing.methods.push(method);
      }
      existing.amountCents += row.amountCents;
      byGroup.set(row.group, existing);
    }
  }
  return [...byGroup.values()];
}

export function formatSplitCents(cents) {
  if (!Number.isInteger(cents)) return '—';
  return `Rs. ${(cents / 100).toFixed(2)}`;
}

export function splitReceiptSummaryText(list, receiptNumber) {
  const receipt = findSplitReceipt(list, receiptNumber);
  if (!receipt) return 'No split receipt recorded.';
  const parts = receipt.parts.map((part) => `${part.method} ${formatSplitCents(part.amountCents)}`).join(' + ');
  return `Receipt ${receipt.receiptNumber} (${receipt.date}): ${parts} = ${formatSplitCents(receipt.totalCents)}. One receipt, one total — split across ${receipt.parts.length} methods.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function splitReceiptHtml(receipt) {
  const record = normalizeSplitReceipt(receipt);
  if (!record) return '<p>No split receipt recorded.</p>';
  const rows = record.parts.map((part) => `<tr><td>${escapeHtml(part.method)}</td><td>${escapeHtml(splitMethodGroupLabel(part.group))}</td><td>${formatSplitCents(part.amountCents)}</td></tr>`).join('');
  return `<p><strong>Receipt ${escapeHtml(record.receiptNumber)}</strong> — ${escapeHtml(record.customerName || record.customer)} — ${escapeHtml(record.date)}</p><table><thead><tr><th>Method</th><th>Method group</th><th>Amount</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="2">Receipt total (one payment, one receipt)</th><th>${formatSplitCents(record.totalCents)}</th></tr></tfoot></table>${record.note ? `<p>${escapeHtml(record.note)}</p>` : ''}`;
}

export function splitReceiptListHtml(list, receiptNumber) {
  const rows = receiptNumber ? [findSplitReceipt(list, receiptNumber)].filter(Boolean) : normalizeSplitReceiptList(list);
  if (rows.length === 0) return '<p>No split receipt recorded.</p>';
  return rows.map((receipt) => splitReceiptHtml(receipt)).join('');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One CSV row per part, so each part ties to its method's reconciliation. */
export function splitReceiptCsv(list, receiptNumber) {
  const rows = receiptNumber ? [findSplitReceipt(list, receiptNumber)].filter(Boolean) : normalizeSplitReceiptList(list);
  const lines = [];
  for (const receipt of rows) {
    for (const part of receipt.parts) {
      lines.push([receipt.receiptNumber, receipt.customer, receipt.customerName, receipt.date, part.method, part.group, part.amountCents, receipt.totalCents, receipt.note].map(csvCell).join(','));
    }
  }
  return `receipt_number,customer,customer_name,date,method,method_group,part_cents,receipt_total_cents,note\n${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`;
}

export function splitReceiptFilename() {
  return 'split-receipts.csv';
}
