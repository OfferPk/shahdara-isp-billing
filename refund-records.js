// Plan 116 (Plan 101-202) — Refund record.
//
// Refunds for overpayment, or for a customer who leaves, used to
// be handled as informal cash hand-backs, with no record of what
// was refunded, why, or by which method. This module is the
// record: one refund per refund, naming the customer, the amount,
// the reason, the method, the date, and exactly one source it
// settles — a credit balance (Plan 103) or an identified
// overpayment. Money going back to a customer is recorded as
// carefully as money coming in, which is what keeps refunds from
// becoming disputes.
//
// What already existed, checked first:
//   - The customer credit balance (Plan 103) is where overpayment
//     sits as the customer's money, and the approval limits
//     record (Plan 110) is where owner approval lives. A refund
//     names both by id text only; this module never opens either
//     record and never changes it. The source amount a refund
//     settles against is carried on the refund record itself, as
//     entered by the operator from the source record, so the
//     amounts can be checked without opening any other store.
//   - The original payment, the bill, and the credit history stay
//     exactly where they are. This module only records the refund
//     and proves the refund against its source; it settles
//     nothing by itself.
//
// The fences, stated plainly:
//   - A refund is refused outright when it is half-formed: no id,
//     no customer, no source kind, no source id, no usable source
//     amount, no positive refund amount, a blank reason, an
//     unknown method, or an impossible date. Unknown fields are
//     dropped, so a refund can never grow a payment, bill, or
//     price field.
//   - Each refund links to exactly one source: one kind (credit
//     or overpayment) and one source id. A refund naming a source
//     with a different source amount than an earlier refund for
//     the same source is refused, because the two records would
//     disagree about what the source was worth.
//   - Amounts match: a refund above its source amount is refused,
//     and refunds against one source can never total more than
//     that source — a fully refunded source takes no further
//     refund. What is left of a source is always visible.
//   - A refund above the operator tier requires owner approval:
//     when the caller supplies a tier limit and the refund amount
//     exceeds it, an approval id is mandatory. With no tier limit
//     supplied there is no tier to exceed, so no approval id is
//     demanded. The approval id is a reference only; this module
//     never checks or changes the approval record itself.
//   - A refund is never edited and never removed: an id already
//     recorded is never rewritten — an identical re-save leaves
//     the list unchanged, and different figures under the same id
//     are refused. There is deliberately no edit function and no
//     remove function; a refund is ledger evidence, not a draft.
//   - Money is integer cents. A `*Cents` integer is used as-is;
//     a plain amount is rupees and converts exactly once (x100),
//     so a stored record re-read through the normaliser never
//     inflates a hundredfold.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is
//     not a date). The module never reads storage, the DOM, the
//     clock, or the network, and it imports nothing.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validRefundDate(value) {
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
export function refundAmountCents(record, centsKey, plainKey) {
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

export const REFUND_METHODS = ['cash', 'bank_transfer', 'mobile_wallet', 'cheque', 'other'];
export const REFUND_SOURCE_KINDS = ['credit', 'overpayment'];

export function normalizeRefund(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customerId = cleanText(record.customerId);
  const sourceKind = cleanText(record.sourceKind);
  const sourceId = cleanText(record.sourceId);
  const reason = cleanText(record.reason);
  const method = cleanText(record.method);
  if (!id || !customerId || !sourceKind || !sourceId || !reason || !method) return null;
  if (!REFUND_SOURCE_KINDS.includes(sourceKind)) return null;
  if (!REFUND_METHODS.includes(method)) return null;
  const refundDate = cleanText(record.refundDate);
  if (!validRefundDate(refundDate)) return null;
  const amountCents = refundAmountCents(record, 'amountCents', 'amount');
  if (amountCents === null || amountCents <= 0) return null;
  const sourceAmountCents = refundAmountCents(record, 'sourceAmountCents', 'sourceAmount');
  if (sourceAmountCents === null || sourceAmountCents <= 0) return null;
  if (amountCents > sourceAmountCents) return null;
  return {
    id,
    customerId,
    customerName: cleanText(record.customerName),
    sourceKind,
    sourceId,
    sourceAmountCents,
    amountCents,
    reason,
    method,
    approvalId: cleanText(record.approvalId),
    refundDate,
  };
}

export function normalizeRefundList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const normalized = normalizeRefund(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

export function findRefund(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeRefundList(list).find((r) => r.id === clean) ?? null;
}

export function refundsForCustomer(list, customerId) {
  const clean = cleanText(customerId);
  if (!clean) return [];
  return normalizeRefundList(list).filter((r) => r.customerId === clean);
}

export function refundsForSource(list, sourceKind, sourceId) {
  const kind = cleanText(sourceKind);
  const sid = cleanText(sourceId);
  if (!kind || !sid) return [];
  return normalizeRefundList(list).filter((r) => r.sourceKind === kind && r.sourceId === sid);
}

export function totalRefundedForSource(list, sourceKind, sourceId) {
  return refundsForSource(list, sourceKind, sourceId).reduce((sum, r) => sum + r.amountCents, 0);
}

/**
 * What is left of a source: the source amount, as first recorded
 * against it, minus every refund already made against it. A
 * source with no refund yet returns its full recorded amount;
 * an unknown source returns null, never a zero-filled figure.
 */
export function sourceRemaining(list, sourceKind, sourceId) {
  const prior = refundsForSource(list, sourceKind, sourceId);
  if (prior.length === 0) return null;
  const sourceAmountCents = prior[0].sourceAmountCents;
  return sourceAmountCents - prior.reduce((sum, r) => sum + r.amountCents, 0);
}

/**
 * The tier gate, answering only: with no tier limit supplied
 * there is no tier to exceed, so any refund passes the gate; a
 * refund at or below the limit passes; a refund above the limit
 * passes only with a recorded approval id. The gate writes
 * nothing and never opens the approval record itself.
 */
export function checkRefundApproval(amountCents, tierLimitCents, approvalId) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { allowed: false, reason: 'Refund amount is not a positive figure.' };
  }
  if (tierLimitCents === null || tierLimitCents === undefined || !Number.isInteger(tierLimitCents) || tierLimitCents <= 0) {
    return { allowed: true, reason: 'No operator tier limit set.' };
  }
  if (amountCents <= tierLimitCents) {
    return { allowed: true, reason: 'Within the operator tier.' };
  }
  if (cleanText(approvalId)) {
    return { allowed: true, reason: 'Above the operator tier, owner approval recorded.' };
  }
  return { allowed: false, reason: 'Above the operator tier: an owner approval id is required.' };
}

export function upsertRefund(list, record, tierLimitCents = null) {
  const current = normalizeRefundList(list);
  const normalized = normalizeRefund(record);
  if (!normalized) return current;
  const existing = current.find((r) => r.id === normalized.id);
  if (existing) {
    // An id already recorded is never rewritten: an identical
    // re-save leaves the list unchanged, and different figures
    // under the same id are refused, never silently applied.
    return current;
  }
  // One source, one worth: an earlier refund for the same source
  // fixes what that source was worth; a new refund disagreeing
  // about it is refused, so the source is never double-counted.
  const prior = refundsForSource(current, normalized.sourceKind, normalized.sourceId);
  if (prior.length > 0 && prior[0].sourceAmountCents !== normalized.sourceAmountCents) return current;
  const alreadyRefunded = prior.reduce((sum, r) => sum + r.amountCents, 0);
  if (alreadyRefunded + normalized.amountCents > normalized.sourceAmountCents) return current;
  // Above the operator tier without an owner approval id, the
  // refund does not go on the record at all.
  const gate = checkRefundApproval(normalized.amountCents, tierLimitCents, normalized.approvalId);
  if (!gate.allowed) return current;
  return [...current, normalized];
}

function formatRs(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

export function refundSummaryText(list) {
  const records = normalizeRefundList(list);
  if (records.length === 0) return 'No refunds recorded yet.';
  const total = records.reduce((sum, r) => sum + r.amountCents, 0);
  return `${records.length} refund${records.length === 1 ? '' : 's'}; ${formatRs(total)} returned to customers, each naming its source. The original payments, bills, and credit history stay intact.`;
}

export function refundSourceText(list, sourceKind, sourceId) {
  const prior = refundsForSource(list, sourceKind, sourceId);
  if (prior.length === 0) return 'No refund recorded against this source yet.';
  const sourceAmountCents = prior[0].sourceAmountCents;
  const refunded = prior.reduce((sum, r) => sum + r.amountCents, 0);
  const remaining = sourceAmountCents - refunded;
  return `Source ${sourceKind} ${sourceId}: ${formatRs(sourceAmountCents)} in total, ${formatRs(refunded)} refunded, ${formatRs(remaining)} remaining.`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function refundHtml(record) {
  const normalized = normalizeRefund(record);
  if (!normalized) return '<p>Refund not recorded: its inputs are incomplete.</p>';
  const who = normalized.customerName || normalized.customerId;
  const approvalPart = normalized.approvalId ? ` · owner approval ${escapeHtml(normalized.approvalId)}` : '';
  return `<div>${escapeHtml(who)} · ${escapeHtml(formatRs(normalized.amountCents))} refunded by ${escapeHtml(normalized.method)} · settles ${escapeHtml(normalized.sourceKind)} ${escapeHtml(normalized.sourceId)} (source ${escapeHtml(formatRs(normalized.sourceAmountCents))}) · reason: ${escapeHtml(normalized.reason)}${approvalPart} · ${escapeHtml(normalized.refundDate)} · original payment, bill, and credit history untouched</div>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function refundCsv(list) {
  const records = normalizeRefundList(list);
  const header = 'id,customer,source kind,source id,source amount (Rs),refund amount (Rs),reason,method,owner approval id,date';
  const rows = records.map((r) => [
    r.id,
    r.customerName || r.customerId,
    r.sourceKind,
    r.sourceId,
    (r.sourceAmountCents / 100).toFixed(2),
    (r.amountCents / 100).toFixed(2),
    r.reason,
    r.method,
    r.approvalId,
    r.refundDate,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function refundFilename() {
  return 'refund-records.csv';
}
