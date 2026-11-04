// Plan 187 (Plan 101-202) — Data Retention and Archive Policy.
//
// Old records pile up with no written rule for how long each kind is
// kept, when it is archived, and when it may be removed, so decisions
// are made ad hoc. This module stores the policy only: one rule per
// record kind, with the keep period entered by the owner, the archive
// action, and a review date.
//
// What this module is NOT, stated plainly:
//   - It is not a deletion. Writing a rule never deletes any record.
//   - It is not an archive. Writing a rule never archives anything.
//   - It is not an edit of any record. Writing a rule never changes
//     any existing record, bill, or payment; it only records the
//     policy the owner wrote.
//   - It is not a second copy of any record type. No bill, payment,
//     or other record is read or rewritten here; the policy stands
//     on its own and any actual deletion or archiving, when the
//     owner decides it, happens through its own flow, never here.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment, customer, or
//     sending field can ever creep into a rule.
//   - Every record kind has at most one current rule: a second rule
//     for the same kind (case-insensitive) is refused outright, so a
//     kind can never quietly carry two conflicting policies.
//   - There is no edit function and no delete/archive function at
//     all: a rule is recorded or removed, never silently rewritten,
//     and nothing is ever deleted or archived by this module.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
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

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= maxDay;
}

function normalizeRetentionRule(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const kind = text(raw.kind);
  const keepPeriod = text(raw.keepPeriod);
  const archiveAction = text(raw.archiveAction);
  const reviewDate = text(raw.reviewDate);
  if (!id || !kind || !keepPeriod || !archiveAction) return null;
  if (!isStrictDate(reviewDate)) return null;
  return { id, kind, keepPeriod, archiveAction, reviewDate, note: text(raw.note) };
}

function normalizeRetentionRuleList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seenIds = new Set();
  const seenKinds = new Set();
  for (const item of raw) {
    const rule = normalizeRetentionRule(item);
    if (!rule) continue;
    if (seenIds.has(rule.id)) continue;
    if (seenKinds.has(lower(rule.kind))) continue;
    seenIds.add(rule.id);
    seenKinds.add(lower(rule.kind));
    out.push(rule);
  }
  return out;
}

function findRetentionRule(list, id) {
  const rules = normalizeRetentionRuleList(list);
  return rules.find((rule) => rule.id === text(id)) || null;
}

function findRuleForKind(list, kind) {
  const rules = normalizeRetentionRuleList(list);
  return rules.find((rule) => lower(rule.kind) === lower(kind)) || null;
}

function recordRetentionRule(list, raw) {
  const rules = normalizeRetentionRuleList(list);
  const rule = normalizeRetentionRule(raw);
  if (!rule) return rules;
  if (rules.some((item) => item.id === rule.id)) return rules;
  if (rules.some((item) => lower(item.kind) === lower(rule.kind))) return rules;
  return [...rules, rule];
}

function removeRetentionRule(list, id) {
  return normalizeRetentionRuleList(list).filter((rule) => rule.id !== text(id));
}

function retentionRulesSorted(list) {
  return normalizeRetentionRuleList(list).sort((a, b) =>
    lower(a.kind) < lower(b.kind) ? -1 : lower(a.kind) > lower(b.kind) ? 1 : a.id < b.id ? -1 : 1,
  );
}

function retentionKinds(list) {
  const seen = new Map();
  for (const rule of normalizeRetentionRuleList(list)) {
    const key = lower(rule.kind);
    if (!seen.has(key)) seen.set(key, rule.kind);
  }
  return [...seen.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : 1));
}

function overdueRetentionRules(list, today) {
  if (!isStrictDate(text(today))) return [];
  return retentionRulesSorted(list).filter((rule) => rule.reviewDate < text(today));
}

function retentionRuleText(rule) {
  const entry = normalizeRetentionRule(rule);
  if (!entry) return '';
  const note = entry.note ? ` Note: ${entry.note}.` : '';
  return `Keep ${entry.kind} for ${entry.keepPeriod}. Archive action: ${entry.archiveAction}. Review by ${entry.reviewDate}.${note}`;
}

function retentionRuleSummaryText(list, today) {
  const rules = normalizeRetentionRuleList(list);
  const overdue = isStrictDate(text(today)) ? overdueRetentionRules(rules, text(today)) : [];
  if (!rules.length) return 'No retention rules recorded';
  if (!overdue.length) return `${rules.length} retention rule${rules.length === 1 ? '' : 's'} recorded, none overdue for review`;
  return `${rules.length} retention rule${rules.length === 1 ? '' : 's'} recorded, ${overdue.length} overdue for review`;
}

function retentionRuleHtml(rule) {
  const entry = normalizeRetentionRule(rule);
  if (!entry) return '';
  return `<p><strong>${escapeHtml(entry.kind)}</strong> — keep ${escapeHtml(entry.keepPeriod)}; archive action: ${escapeHtml(entry.archiveAction)}; review by ${escapeHtml(entry.reviewDate)}.${entry.note ? ` ${escapeHtml(entry.note)}` : ''}</p>`;
}

function retentionRuleAllHtml(list) {
  return retentionRulesSorted(list).map((rule) => retentionRuleHtml(rule)).join('');
}

function retentionRuleCsv(list) {
  const rows = [['id', 'kind', 'keepPeriod', 'archiveAction', 'reviewDate', 'note']];
  for (const rule of retentionRulesSorted(list)) {
    rows.push([rule.id, rule.kind, rule.keepPeriod, rule.archiveAction, rule.reviewDate, rule.note]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function retentionRuleFilename() {
  return 'retention-rules.csv';
}

export {
  isStrictDate,
  normalizeRetentionRule,
  normalizeRetentionRuleList,
  findRetentionRule,
  findRuleForKind,
  recordRetentionRule,
  removeRetentionRule,
  retentionRulesSorted,
  retentionKinds,
  overdueRetentionRules,
  retentionRuleText,
  retentionRuleSummaryText,
  retentionRuleHtml,
  retentionRuleAllHtml,
  retentionRuleCsv,
  retentionRuleFilename,
};
