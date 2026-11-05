// Plan 304 (Plan 203-350) — Equipment purchase approval note.
//
// Equipment is bought on a verbal yes, so later nobody can say
// who approved the spend, what it was for, or whether it was
// within the plan. This module adds only the missing piece: one
// purchase approval note per purchase — the item, the reason, the
// amount in whole rupees, the approver, the date, and the status
// in plain words — so approvals are listed for review with the
// approved total visible.
//
// What this module is NOT, stated plainly:
//   - It is not the stock register (Plan 51). That register is
//     the record of record for shop stock; it is neither read
//     nor rewritten here. An approval names an item in plain
//     words and never moves stock.
//   - It is not the spare-parts reorder flow (Plan 136). That
//     flow is the record of record for reordering parts; it is
//     neither read nor rewritten here. An approval never orders
//     anything by itself.
//   - It is not the replacement reserve tracker (Plan 197).
//     That tracker is the record of record for equipment
//     ageing and reserves; it is neither read nor rewritten
//     here. An approval never changes a reserve note.
//   - It is not a bill, payment, or stock change. Recording
//     an approval never changes any bill, payment, or stock
//     record by itself, and the purchase itself goes through
//     its own existing flow.
//   - It is not a live record. An approval note, once written,
//     is never silently edited: there is no edit function, only
//     record, find, and remove, so a wrong note is removed and
//     recorded again.
//   - It is not a purchase or a payment. A note records that a
//     purchase was approved; it never buys anything, never pays
//     anyone, and never sends anything.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     note, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - An approval with no id, no item, no reason, no
//     whole-rupee amount of at least one rupee, no approver,
//     or no strict date is refused outright. Unknown fields
//     are dropped, so an approval can never grow a bill,
//     payment, or stock field.
//   - A duplicate id is never rewritten: the first approval
//     stays.
//   - The status folds from plain spellings; a missing or
//     unclear status reads as pending, because an approval
//     nobody has decided yet is still only pending.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validPurchaseApprovalDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > limit) return false;
  return true;
}

/** Whole rupees: an integer number, or a digit string, or null. */
function wholeRupees(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * Status folds from plain spellings. A missing or unclear
 * status reads as pending, because an approval nobody has
 * decided yet is still only pending.
 */
export function foldPurchaseApprovalStatus(value) {
  const word = lower(value);
  if (['approved', 'approve', 'accepted', 'sanctioned', 'agreed', '1'].includes(word)) return 'approved';
  if (['declined', 'decline', 'rejected', 'reject', 'refused', 'denied', '2'].includes(word)) return 'declined';
  if (['requested', 'request', 'asked', 'proposed', 'submitted', '3'].includes(word)) return 'requested';
  if (['pending', 'waiting', 'awaiting', 'undecided', 'open', '4'].includes(word)) return 'pending';
  return 'pending';
}

/**
 * One equipment purchase approval note, or null when
 * half-formed. An approval needs an id, an item, a reason, a
 * whole-rupee amount of at least one rupee, an approver, and a
 * strict date. The status folds from plain spellings and reads
 * as pending when missing or unclear. Unknown fields are
 * dropped; the input is never mutated.
 */
export function normalizePurchaseApproval(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const item = text(raw.item);
  const reason = text(raw.reason);
  const amount = wholeRupees(raw.amount);
  const approver = text(raw.approver);
  const date = text(raw.date);
  const status = foldPurchaseApprovalStatus(raw.status);
  if (!id) return null;
  if (!item) return null;
  if (!reason) return null;
  if (amount === null || amount < 1) return null;
  if (!approver) return null;
  if (!validPurchaseApprovalDay(date)) return null;
  return {
    id,
    item,
    reason,
    amount,
    approver,
    date,
    status,
  };
}

/** Normalised approvals only. A duplicate id is never rewritten: the first approval stays. */
export function normalizePurchaseApprovalList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const approval = normalizePurchaseApproval(raw);
    if (!approval) continue;
    if (seenIds.has(approval.id)) continue;
    seenIds.add(approval.id);
    out.push(approval);
  }
  return out;
}

export function findPurchaseApproval(list, id) {
  const clean = normalizePurchaseApprovalList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((approval) => approval.id === wanted) ?? null;
}

/**
 * Record a purchase approval. Refused when half-formed or when
 * its id is already recorded — the first approval for an id
 * always stays.
 */
export function recordPurchaseApproval(list, raw) {
  const clean = normalizePurchaseApprovalList(list);
  const approval = normalizePurchaseApproval(raw);
  if (!approval) return clean;
  if (clean.some((item) => item.id === approval.id)) return clean;
  return [...clean, approval];
}

export function removePurchaseApproval(list, id) {
  const clean = normalizePurchaseApprovalList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((approval) => approval.id !== wanted);
}

/** Approvals by date, then item A-Z, then id, so the same list always reads the same way. */
export function purchaseApprovalsSorted(list) {
  const clean = normalizePurchaseApprovalList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (lower(a.item) !== lower(b.item)) return lower(a.item) < lower(b.item) ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Approvals for one item, in date order; the match is case-insensitive. */
export function purchaseApprovalsForItem(list, item) {
  const wanted = lower(item);
  if (!wanted) return [];
  return purchaseApprovalsSorted(list).filter((approval) => lower(approval.item) === wanted);
}

/** Items with an approval, first spelling kept, A-Z. */
export function purchaseApprovalItems(list) {
  const clean = normalizePurchaseApprovalList(list);
  const seen = new Map();
  for (const approval of clean) {
    const key = lower(approval.item);
    if (!seen.has(key)) seen.set(key, approval.item);
  }
  return [...seen.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0));
}

/** Approvals decided by one approver, in date order; the match is case-insensitive. */
export function purchaseApprovalsForApprover(list, approver) {
  const wanted = lower(approver);
  if (!wanted) return [];
  return purchaseApprovalsSorted(list).filter((approval) => lower(approval.approver) === wanted);
}

/** Approvers with an approval, first spelling kept, A-Z. */
export function purchaseApprovalApprovers(list) {
  const clean = normalizePurchaseApprovalList(list);
  const seen = new Map();
  for (const approval of clean) {
    const key = lower(approval.approver);
    if (!seen.has(key)) seen.set(key, approval.approver);
  }
  return [...seen.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0));
}

/** Total rupees approved across the list, by integer arithmetic only; only approved approvals count. */
export function purchaseApprovalTotalApproved(list) {
  return normalizePurchaseApprovalList(list).reduce(
    (sum, approval) => sum + (approval.status === 'approved' ? approval.amount : 0),
    0,
  );
}

/** Total rupees requested across the list, by integer arithmetic only. */
export function purchaseApprovalTotalAmount(list) {
  return normalizePurchaseApprovalList(list).reduce((sum, approval) => sum + approval.amount, 0);
}

export function purchaseApprovalSummaryText(list) {
  const clean = normalizePurchaseApprovalList(list);
  if (clean.length === 0) return 'No purchase approvals recorded.';
  const word = clean.length === 1 ? 'approval' : 'approvals';
  const sorted = purchaseApprovalsSorted(clean);
  const latest = sorted[sorted.length - 1];
  const approvedCount = clean.filter((approval) => approval.status === 'approved').length;
  return `${clean.length} purchase ${word} recorded, ${approvedCount} approved. Total requested Rs ${purchaseApprovalTotalAmount(clean)}, total approved Rs ${purchaseApprovalTotalApproved(clean)}. Latest: ${latest.item}, ${latest.date}, ${latest.status}.`;
}

/** Plain-words text for one approval: item, reason, amount, approver, date, and status. */
export function purchaseApprovalEntryText(approval) {
  const clean = normalizePurchaseApproval(approval);
  if (!clean) return 'No purchase approval recorded.';
  return `${clean.date} — ${clean.item}: ${clean.reason}. Amount: Rs ${clean.amount}. Approver: ${clean.approver}. Status: ${clean.status}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function purchaseApprovalEntryHtml(approval) {
  const clean = normalizePurchaseApproval(approval);
  if (!clean) return '<p>No purchase approval recorded.</p>';
  return `<p>${escapeHtml(purchaseApprovalEntryText(clean))}</p>`;
}

export function purchaseApprovalAllHtml(list) {
  const rows = purchaseApprovalsSorted(list);
  if (!rows.length) return '<p>No purchase approvals recorded.</p>';
  return `<ul>${rows.map((approval) => `<li>${escapeHtml(purchaseApprovalEntryText(approval))}</li>`).join('')}</ul>`;
}

export function purchaseApprovalsForItemHtml(list, item) {
  const rows = purchaseApprovalsForItem(list, item);
  if (!rows.length) return '<p>No purchase approvals recorded for this item.</p>';
  return `<ul>${rows.map((approval) => `<li>${escapeHtml(purchaseApprovalEntryText(approval))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function purchaseApprovalCsv(list) {
  const rows = purchaseApprovalsSorted(list);
  const lines = ['"id","item","reason","amount (Rs)","approver","date","status"'];
  for (const approval of rows) {
    lines.push([
      csvCell(approval.id),
      csvCell(approval.item),
      csvCell(approval.reason),
      csvCell(approval.amount),
      csvCell(approval.approver),
      csvCell(approval.date),
      csvCell(approval.status),
    ].join(','));
  }
  return lines.join('\n');
}

export function purchaseApprovalFilename() {
  return 'equipment-purchase-approvals.csv';
}
