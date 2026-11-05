// Plan 254 (Plan 203-350) — Field expense note per visit.
//
// Small field expenses — a rickshaw fare, a meal on a long day, a
// minor purchase — are paid from pocket and forgotten, so the owner
// never sees the true cost of field days. This module adds only the
// missing piece: one expense note per visit — the visit reference,
// the expense in plain words, the amount as entered, the date, and
// who paid it.
//
// The fences, stated plainly:
//   - This is visit-linked only. It does not replace the petty cash
//     and field advance log (Plan 45), which tracks advances and
//     cash in hand. That log is neither read nor rewritten here,
//     and this module imports nothing.
//   - Expenses list by visit and sum to a total per visit and per
//     month that matches the notes listed: the totals are counted
//     from the same rows they report on, so a total can never
//     disagree with its notes.
//   - A note is never edited, only corrected by a dated follow-up
//     note. There is no edit function: only record, follow up,
//     and remove. A follow-up never rewrites the visit reference,
//     the expense, the amount, the date, or who paid it.
//   - Recording an expense never changes any bill, payment,
//     customer, visit, or petty cash total by itself: the module
//     takes no bill, payment, customer, visit, or petty cash
//     object in, edits none, and returns none. Visit references,
//     expenses, and people arrive as plain text.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const FIELD_EXPENSE_STORE = 'shahdara_field_expenses_v1';
export const FIELD_EXPENSE_FILENAME = 'field-expenses.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validFieldExpenseDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function validMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function amount(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validFieldExpenseDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const visitRef = text(raw.visitRef);
  const expense = text(raw.expense);
  const date = text(raw.date);
  const paidBy = text(raw.paidBy);
  const value = amount(raw.amount);
  if (!id || !visitRef || !expense || !paidBy) return null;
  if (!validFieldExpenseDate(date)) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, visitRef, expense, amount: value, date, paidBy, followups };
}

export function normalizeFieldExpenseList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordFieldExpense(list, raw) {
  const clean = normalizeFieldExpenseList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeFieldExpense(list, id) {
  const clean = normalizeFieldExpenseList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findFieldExpense(list, id) {
  const clean = normalizeFieldExpenseList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addFieldExpenseFollowup(list, id, date, note) {
  const clean = normalizeFieldExpenseList(list);
  const wanted = text(id);
  const followup = cleanFollowup({ date, note });
  if (!wanted || !followup) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, followups: [...item.followups, followup] };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.visitRef !== b.visitRef) return a.visitRef < b.visitRef ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function fieldExpenseSorted(list) {
  return normalizeFieldExpenseList(list).sort(compareEntries);
}

export function fieldExpensesForVisit(list, visitRef) {
  const wanted = text(visitRef).toLowerCase();
  if (!wanted) return [];
  return fieldExpenseSorted(list).filter((item) => item.visitRef.toLowerCase() === wanted);
}

export function fieldExpenseVisits(list) {
  const seen = new Set();
  const out = [];
  for (const item of fieldExpenseSorted(list)) {
    const key = item.visitRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.visitRef);
  }
  return out;
}

// The totals are counted from the same rows they report on, so a
// total can never disagree with the notes listed.
export function fieldExpenseTotalForVisit(list, visitRef) {
  return fieldExpensesForVisit(list, visitRef)
    .reduce((sum, item) => sum + item.amount, 0);
}

export function fieldExpensesForMonth(list, month) {
  if (!validMonth(month)) return [];
  return fieldExpenseSorted(list).filter((item) => item.date.slice(0, 7) === month);
}

export function fieldExpenseTotalForMonth(list, month) {
  return fieldExpensesForMonth(list, month)
    .reduce((sum, item) => sum + item.amount, 0);
}

export function fieldExpenseMonthTotals(list) {
  const totals = new Map();
  for (const item of fieldExpenseSorted(list)) {
    const month = item.date.slice(0, 7);
    totals.set(month, (totals.get(month) || 0) + item.amount);
  }
  return [...totals.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([month, total]) => ({ month, total }));
}

export function fieldExpenseSummaryText(list) {
  const clean = normalizeFieldExpenseList(list);
  const visits = fieldExpenseVisits(list).length;
  if (!clean.length) return 'No field expenses recorded.';
  const total = clean.reduce((sum, item) => sum + item.amount, 0);
  return `${clean.length} expense note${clean.length === 1 ? '' : 's'} across ${visits} visit${visits === 1 ? '' : 's'}, ${total} in total.`;
}

export function fieldExpenseText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No field expense recorded.';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Visit ${clean.visitRef}: ${clean.expense}, ${clean.amount} on ${clean.date}, paid by ${clean.paidBy}.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fieldExpenseHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No field expense recorded.</p>';
  const notes = clean.followups.length
    ? `<br>Follow-ups: ${escapeHtml(clean.followups.map((f) => `${f.date}: ${f.note}`).join('; '))}`
    : '';
  return `<p>Visit <strong>${escapeHtml(clean.visitRef)}</strong>: ${escapeHtml(clean.expense)}, ${escapeHtml(clean.amount)} on ${escapeHtml(clean.date)}, paid by ${escapeHtml(clean.paidBy)}.${notes}</p>`;
}

export function fieldExpenseAllHtml(list) {
  const sorted = fieldExpenseSorted(list);
  if (!sorted.length) return '<p>No field expenses recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(fieldExpenseText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function fieldExpenseCsv(list) {
  const sorted = fieldExpenseSorted(list);
  const header = ['id', 'visit reference', 'expense', 'amount', 'date', 'paid by', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.visitRef,
    item.expense,
    item.amount,
    item.date,
    item.paidBy,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function fieldExpenseFilename() {
  return 'field-expenses.csv';
}
