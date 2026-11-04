// Plan 184 (Plan 101-202) — Owner Decision Log.
//
// Business decisions — a price change discussion, a new mohalla,
// a tool purchase — are remembered differently later, so the
// reason behind a change is lost. This module is the written
// log: one entry per decision with a date, the decision in
// plain words, the reason, the options considered, who decided,
// and a review date. Decisions are listed newest first and are
// searchable by topic.
//
// What this module is NOT, stated plainly:
//   - It is not an action on anything. Logging a decision never
//     applies the decision itself — a price change, a new
//     mohalla, or a tool purchase still goes through its own
//     existing flow — and never changes any bill, payment,
//     package price, or customer record by itself.
//   - It is not a silently editable history. There is no edit
//     function: a past entry is recorded or removed, never
//     quietly rewritten, so the reason a decision was made
//     stays exactly as it was written.
//   - It is not proof that a decision is wise or true. The
//     record says what the operator recorded; the module
//     verifies format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment,
//     package, customer, or sending field can ever creep into
//     a decision entry.
//   - A bad date is refused outright, never stored as a
//     neighbouring date.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1];
}

function parseStrictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isStrictDate(value) {
  return parseStrictDate(value) !== null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function normalizeOptions(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];
  const out = [];
  for (const item of raw) {
    const option = text(item);
    if (option) out.push(option);
  }
  return out;
}

export function normalizeDecision(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = text(value.id);
  const topic = text(value.topic);
  const decision = text(value.decision);
  const date = text(value.date);
  if (!id || !topic || !decision) return null;
  if (!parseStrictDate(date)) return null;
  const reviewDate = text(value.reviewDate);
  if (reviewDate && !parseStrictDate(reviewDate)) return null;
  return {
    id,
    topic,
    decision,
    date,
    reason: text(value.reason),
    options: normalizeOptions(value.options),
    decidedBy: text(value.decidedBy),
    reviewDate,
  };
}

export function normalizeDecisionList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const entry = normalizeDecision(item);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findDecision(list, id) {
  const entries = normalizeDecisionList(list);
  const wanted = text(id);
  return entries.find((entry) => entry.id === wanted) || null;
}

export function recordDecision(list, value) {
  const entries = normalizeDecisionList(list);
  const entry = normalizeDecision(value);
  if (!entry) return entries;
  const existing = entries.find((item) => item.id === entry.id);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(entry)) return entries;
    return entries;
  }
  return [...entries, entry];
}

export function removeDecision(list, id) {
  const entries = normalizeDecisionList(list);
  const wanted = text(id);
  return entries.filter((entry) => entry.id !== wanted);
}

function compareDateDesc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function decisionsSorted(list) {
  return normalizeDecisionList(list).sort(compareDateDesc);
}

export function decisionsForTopic(list, topic) {
  const wanted = lower(topic);
  if (!wanted) return [];
  return decisionsSorted(list).filter((entry) => lower(entry.topic).includes(wanted));
}

export function decisionsForDecider(list, decider) {
  const wanted = lower(decider);
  if (!wanted) return [];
  return decisionsSorted(list).filter((entry) => lower(entry.decidedBy) === wanted);
}

export function decisionDeciders(list) {
  const first = new Map();
  for (const entry of normalizeDecisionList(list)) {
    if (!entry.decidedBy) continue;
    const key = lower(entry.decidedBy);
    if (!first.has(key)) first.set(key, entry.decidedBy);
  }
  return [...first.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0));
}

export function decisionTopics(list) {
  const first = new Map();
  for (const entry of normalizeDecisionList(list)) {
    const key = lower(entry.topic);
    if (!first.has(key)) first.set(key, entry.topic);
  }
  return [...first.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0));
}

export function decisionText(entry) {
  const item = normalizeDecision(entry);
  if (!item) return '';
  const reason = item.reason ? ` Reason: ${item.reason}.` : '';
  const options = item.options.length ? ` Options considered: ${item.options.join('; ')}.` : '';
  const by = item.decidedBy ? ` Decided by ${item.decidedBy}.` : '';
  const review = item.reviewDate ? ` Review on ${item.reviewDate}.` : '';
  return `Decision on ${item.date} [${item.topic}]: ${item.decision}.${reason}${options}${by}${review}`;
}

export function decisionSummaryText(list) {
  const entries = normalizeDecisionList(list);
  return `${entries.length} owner decisions recorded`;
}

export function decisionHtml(entry) {
  const item = normalizeDecision(entry);
  if (!item) return '';
  return `<p>${escapeHtml(decisionText(item))}</p>`;
}

export function decisionAllHtml(list) {
  return decisionsSorted(list).map((entry) => decisionHtml(entry)).join('');
}

export function decisionCsv(list) {
  const header = ['id', 'topic', 'decision', 'date', 'reason', 'options', 'decided by', 'review date'];
  const rows = decisionsSorted(list).map((entry) => [
    entry.id,
    entry.topic,
    entry.decision,
    entry.date,
    entry.reason,
    entry.options.join('; '),
    entry.decidedBy,
    entry.reviewDate,
  ].map(escapeCsv).join(','));
  return [header.map(escapeCsv).join(','), ...rows].join('\n');
}

export function decisionFilename() {
  return 'owner-decisions.csv';
}
