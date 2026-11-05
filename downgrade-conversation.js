// Plan 277 (Plan 203-350) — Service downgrade conversation note.
//
// A downgrade is previewed and credited elsewhere, but the
// conversation behind it — why the customer is downgrading — was
// never recorded. This module adds only the missing piece: one
// conversation note per downgrade discussion — the customer, the
// date, the reason in plain words, the outcome (downgraded or kept
// package), and an optional note.
//
// What this module is NOT, stated plainly:
//   - It is not the package-change preview from Plan 46. That
//     preview works out what a change would cost; it is neither
//     read nor rewritten here, and this module imports nothing.
//   - It is not the plan-change queue from Plan 50. That queue
//     tracks change requests; it is neither read nor rewritten
//     here. A conversation note only records what was said.
//   - It is not the unused-days credit record from Plan 113.
//     That record holds the credit for unused days; it is neither
//     read nor rewritten here, and this module holds no amount,
//     credit, bill, or payment field at all.
//   - Recording a note never changes any package, bill, payment,
//     or credit record. A note only says what the customer said
//     and what the outcome of the talk was.
//   - A conversation note is never edited: only record, find,
//     and remove. A wrong note is removed and recorded again.
//   - A missing outcome is read as kept package, because the
//     package only changes when the preview and credit records
//     say so — this note alone can never claim a downgrade
//     happened.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const DOWNGRADE_CONVERSATION_STORE = 'shahdara_downgrade_conversations_v1';
export const DOWNGRADE_CONVERSATION_FILENAME = 'downgrade-conversations.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const OUTCOME_WORDS = {
  downgraded: 'downgraded',
  downgrade: 'downgraded',
  'moved down': 'downgraded',
  'switched down': 'downgraded',
  'kept package': 'kept package',
  kept: 'kept package',
  stayed: 'kept package',
  'no change': 'kept package',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDowngradeConversationDate(value) {
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

function foldOutcome(value) {
  const key = text(value).toLowerCase();
  if (!key) return 'kept package';
  return OUTCOME_WORDS[key] || 'kept package';
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const date = text(raw.date);
  const reason = text(raw.reason);
  const note = text(raw.note);
  if (!id || !customer || !reason) return null;
  if (!validDowngradeConversationDate(date)) return null;
  return { id, customer, date, reason, outcome: foldOutcome(raw.outcome), note };
}

export function normalizeDowngradeConversationList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordDowngradeConversation(list, raw) {
  const clean = normalizeDowngradeConversationList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeDowngradeConversation(list, id) {
  const clean = normalizeDowngradeConversationList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findDowngradeConversation(list, id) {
  const clean = normalizeDowngradeConversationList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.customer !== b.customer) return a.customer < b.customer ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function downgradeConversationSorted(list) {
  return normalizeDowngradeConversationList(list).sort(compareEntries);
}

// A customer page: that customer's downgrade conversations in date
// order, so the reason behind each talk is read in the order it
// happened.
export function downgradeConversationsForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return downgradeConversationSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

// Conversations that ended in a downgrade, in date order — the ones
// whose reasons are worth reading together.
export function downgradedConversations(list) {
  return downgradeConversationSorted(list).filter((item) => item.outcome === 'downgraded');
}

// Conversations where the customer kept the package, in date order.
export function keptPackageConversations(list) {
  return downgradeConversationSorted(list).filter((item) => item.outcome === 'kept package');
}

export function downgradeConversationCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of downgradeConversationSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

export function downgradeConversationSummaryText(list) {
  const clean = normalizeDowngradeConversationList(list);
  if (!clean.length) return 'No downgrade conversations recorded.';
  const downgraded = clean.filter((item) => item.outcome === 'downgraded').length;
  const kept = clean.length - downgraded;
  return `${clean.length} downgrade conversation${clean.length === 1 ? '' : 's'} recorded, ${downgraded} downgraded, ${kept} kept package.`;
}

export function downgradeConversationText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No downgrade conversation recorded.';
  const base = `${clean.customer} on ${clean.date} (${clean.outcome}): ${clean.reason.replace(/\.+$/, '')}.`;
  return clean.note ? `${base} Note: ${clean.note}` : base;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function downgradeConversationHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No downgrade conversation recorded.</p>';
  return `<p>${escapeHtml(downgradeConversationText(entry))}</p>`;
}

export function downgradeConversationAllHtml(list) {
  const sorted = downgradeConversationSorted(list);
  if (!sorted.length) return '<p>No downgrade conversations recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(downgradeConversationText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function downgradeConversationCsv(list) {
  const sorted = downgradeConversationSorted(list);
  const header = ['id', 'customer', 'date', 'reason', 'outcome', 'note'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.date,
    item.reason,
    item.outcome,
    item.note,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function downgradeConversationFilename() {
  return DOWNGRADE_CONVERSATION_FILENAME;
}
