// Plan 295 (Plan 203-350) — Expense approval note.
//
// Shop expenses are paid first and questioned later, because no
// written approval says who agreed the spend and under which
// category. This module adds only the missing piece: one dated
// approval note per spend — the expense in plain words, the
// amount in whole rupees, the expense category, the approver,
// the date, and the status in plain words — so every approval
// names its expense, category, amount, and approver, and the
// approvals are listed for review. Approvals name their
// category, so petty-expense categories accumulate as a view
// from these notes.
//
// What this module is NOT, stated plainly:
//   - It is not a bill, payment, or budget change. Recording
//     an approval never changes any bill, payment, or budget
//     record by itself, and the payment itself goes through
//     its own existing flow; this note only approves a spend.
//   - It is not the vendor bill schedule, the expense
//     budgets, or the discount approval limits. Each of those
//     records already exists and is neither read nor rewritten
//     here; this module only covers the approval note itself.
//   - It is not a live record. An approval note, once
//     written, is never silently edited: there is no edit
//     function, only record, find, and remove, so a wrong
//     note is removed and recorded again.
//   - It holds no price-change or payment function: an
//     approval is a note, not a payment.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     approval, and the module never reads storage, the clock,
//     or the network, and never mutates an input.
//   - An approval with no id, no expense, no category, no
//     whole-rupee amount, no approver, or no strict date is
//     refused outright. Unknown fields are dropped, so an
//     approval can never grow a bill, payment, or budget
//     field.
//   - A duplicate id is never rewritten: the first approval
//     stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validExpenseApprovalDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

/** Whole rupees only: a number that is an integer, or a string of digits, or null. */
function wholeRupees(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * Status folds from plain spellings. A missing or unclear
 * status reads as pending, because an approval nobody has
 * decided on yet is still waiting.
 */
export function foldExpenseApprovalStatus(value) {
  const word = text(value).toLowerCase();
  if (['approved', 'approve', 'yes', 'true', 'agreed'].includes(word)) return 'approved';
  if (['declined', 'decline', 'rejected', 'no', 'false', 'refused'].includes(word)) return 'declined';
  return 'pending';
}

/**
 * One expense approval note, or null when half-formed. An
 * approval needs an id, an expense in plain words, a category
 * in plain words, a whole-rupee amount of at least one rupee,
 * an approver, and a strict date. The status folds from plain
 * spellings and defaults to pending. Unknown fields are
 * dropped; the input is never mutated.
 */
export function normalizeExpenseApproval(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const expense = text(raw.expense);
  const category = text(raw.category);
  const amount = wholeRupees(raw.amount);
  const approver = text(raw.approver);
  const date = text(raw.date);
  if (!id) return null;
  if (!expense) return null;
  if (!category) return null;
  if (amount === null || amount < 1) return null;
  if (!approver) return null;
  if (!validExpenseApprovalDate(date)) return null;
  return {
    id,
    expense,
    category,
    amount,
    approver,
    date,
    status: foldExpenseApprovalStatus(raw.status),
  };
}

/** Normalised approvals only; a duplicate id is never rewritten, the first stays. */
export function normalizeExpenseApprovalList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const approval = normalizeExpenseApproval(raw);
    if (!approval || seen.has(approval.id)) continue;
    seen.add(approval.id);
    out.push(approval);
  }
  return out;
}

export function findExpenseApproval(list, id) {
  const clean = normalizeExpenseApprovalList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((approval) => approval.id === wanted) ?? null;
}

/**
 * Record an approval. Refused when half-formed or when its id
 * is already recorded — the first approval for an id always
 * stays.
 */
export function recordExpenseApproval(list, raw) {
  const clean = normalizeExpenseApprovalList(list);
  const approval = normalizeExpenseApproval(raw);
  if (!approval) return clean;
  if (clean.some((item) => item.id === approval.id)) return clean;
  return [...clean, approval];
}

export function removeExpenseApproval(list, id) {
  const clean = normalizeExpenseApprovalList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((approval) => approval.id !== wanted);
}

/** Approvals by date, then id, so the same list always reads the same way. */
export function expenseApprovalsSorted(list) {
  const clean = normalizeExpenseApprovalList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** The newest approval, or null when none is recorded. */
export function expenseApprovalLatest(list) {
  const sorted = expenseApprovalsSorted(list);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

/** Approvals in one category, in date order; the first spelling of the category wins. */
export function expenseApprovalsForCategory(list, category) {
  const wanted = text(category).toLowerCase();
  if (!wanted) return [];
  return expenseApprovalsSorted(list).filter(
    (approval) => approval.category.toLowerCase() === wanted,
  );
}

/** Category names in first-seen spelling, A-Z, so the category view stays tidy. */
export function expenseApprovalCategories(list) {
  const clean = normalizeExpenseApprovalList(list);
  const seen = new Map();
  for (const approval of clean) {
    const key = approval.category.toLowerCase();
    if (!seen.has(key)) seen.set(key, approval.category);
  }
  return [...seen.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

/**
 * One row per category: how many approvals it holds and their
 * total amount in whole rupees. Rows read by total, largest
 * first, then category A-Z, so the owner sees at a glance
 * where the money actually goes.
 */
export function expenseApprovalCategorySummary(list) {
  const clean = normalizeExpenseApprovalList(list);
  const byKey = new Map();
  for (const approval of clean) {
    const key = approval.category.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { category: approval.category, count: 0, totalAmount: 0 });
    const row = byKey.get(key);
    row.count += 1;
    row.totalAmount += approval.amount;
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.totalAmount !== b.totalAmount) return b.totalAmount - a.totalAmount;
    return a.category.toLowerCase() < b.category.toLowerCase() ? -1 : 1;
  });
}

export function expenseApprovalSummaryText(list) {
  const clean = normalizeExpenseApprovalList(list);
  if (clean.length === 0) return 'No expense approvals recorded.';
  const word = clean.length === 1 ? 'approval' : 'approvals';
  const approved = clean.filter((approval) => approval.status === 'approved').length;
  const pending = clean.filter((approval) => approval.status === 'pending').length;
  const declined = clean.filter((approval) => approval.status === 'declined').length;
  const latest = expenseApprovalLatest(clean);
  return `${clean.length} expense ${word} recorded: ${approved} approved, ${pending} pending, ${declined} declined. Latest approval on ${latest.date}: ${latest.expense}, Rs ${latest.amount}, ${latest.category}, approved by ${latest.approver}.`;
}

/** Plain-words text for one approval: expense, category, amount, approver, and status. */
export function expenseApprovalEntryText(approval) {
  const clean = normalizeExpenseApproval(approval);
  if (!clean) return 'No expense approval recorded.';
  return `${clean.date} — ${clean.expense}, Rs ${clean.amount}, ${clean.category}, approved by ${clean.approver}, ${clean.status}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function expenseApprovalEntryHtml(approval) {
  const clean = normalizeExpenseApproval(approval);
  if (!clean) return '<p>No expense approval recorded.</p>';
  return `<p>${escapeHtml(expenseApprovalEntryText(clean))}</p>`;
}

export function expenseApprovalAllHtml(list) {
  const rows = expenseApprovalsSorted(list);
  if (!rows.length) return '<p>No expense approvals recorded.</p>';
  return `<ul>${rows.map((approval) => `<li>${escapeHtml(expenseApprovalEntryText(approval))}</li>`).join('')}</ul>`;
}

export function expenseApprovalsForCategoryHtml(list, category) {
  const rows = expenseApprovalsForCategory(list, category);
  if (!rows.length) return '<p>No expense approvals in this category.</p>';
  return `<ul>${rows.map((approval) => `<li>${escapeHtml(expenseApprovalEntryText(approval))}</li>`).join('')}</ul>`;
}

export function expenseApprovalCategorySummaryHtml(list) {
  const rows = expenseApprovalCategorySummary(list);
  if (!rows.length) return '<p>No expense categories yet.</p>';
  return `<ul>${rows.map((row) => `<li>${escapeHtml(row.category)}: ${row.count} approval${row.count === 1 ? '' : 's'}, Rs ${row.totalAmount} in total</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function expenseApprovalCsv(list) {
  const rows = expenseApprovalsSorted(list);
  const lines = ['"id","date","expense","category","amount","approver","status"'];
  for (const approval of rows) {
    lines.push([
      csvCell(approval.id),
      csvCell(approval.date),
      csvCell(approval.expense),
      csvCell(approval.category),
      csvCell(approval.amount),
      csvCell(approval.approver),
      csvCell(approval.status),
    ].join(','));
  }
  return lines.join('\n');
}

export function expenseApprovalFilename() {
  return 'expense-approvals.csv';
}
