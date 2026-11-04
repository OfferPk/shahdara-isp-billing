// Plan 117 (Plan 101-202) — Dispute follow-up and escalation queue.
//
// A dispute case (Plans 61-65) can be logged and then sit untouched,
// because nothing tracks its next follow-up date or escalates it when
// it goes stale. This module is that queue: one follow-up record per
// open case, carrying the next follow-up date, the owner, the
// escalation step, and the latest note. It is built on existing
// dispute cases only.
//
// The fences, stated plainly:
//   - This module never reads or writes a dispute case. It takes the
//     case list as a caller-supplied input when building the queue,
//     and recording a follow-up touches only the follow-up list:
//     never the case history, never an amount, never an outcome.
//     There is no case type here — a follow-up without an existing
//     case id is just a record waiting for its case, and a resolved
//     case never appears in the queue.
//   - It creates no new case type, changes no dispute outcome, and
//     sends no message automatically. A follow-up is a date and a
//     note for the operator to act on, nothing more.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is not
//     a date). Day counts use UTC dates, so timezones never shift
//     an overdue count by a day. Inputs are never mutated, and the
//     module never reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const FOLLOWUP_OPEN_STATUSES = ['open', 'investigating', 'escalated'];

export const ESCALATION_STEPS = [
  'none',
  'reminder',
  'owner_review',
  'final_notice',
];

export const ESCALATION_STEP_LABELS = {
  none: 'No escalation step set',
  reminder: 'Reminder to customer',
  owner_review: 'Owner review',
  final_notice: 'Final notice',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function validFollowUpDate(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function daysBetween(fromDate, toDate) {
  const a = validFollowUpDate(fromDate);
  const b = validFollowUpDate(toDate);
  if (!a || !b) return null;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

export function normalizeFollowUp(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const caseId = text(raw.caseId);
  const owner = text(raw.owner);
  if (!id || !caseId || !owner) return null;
  const nextDate = validFollowUpDate(raw.nextFollowUpDate ?? raw.nextDate);
  if (!nextDate) return null;
  const lastRaw = raw.lastFollowUpDate ?? raw.followUpDate ?? null;
  const lastDate = lastRaw === null || lastRaw === '' ? null : validFollowUpDate(lastRaw);
  if (lastRaw !== null && lastRaw !== '' && !lastDate) return null;
  const stepRaw = text(raw.escalationStep ?? raw.step).toLowerCase().replace(/[\s-]+/g, '_');
  const escalationStep = stepRaw === '' ? 'none' : stepRaw;
  if (!ESCALATION_STEPS.includes(escalationStep)) return null;
  return {
    id,
    caseId,
    customerId: text(raw.customerId),
    owner,
    nextFollowUpDate: nextDate,
    lastFollowUpDate: lastDate,
    escalationStep,
    note: text(raw.note),
  };
}

export function normalizeFollowUpList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const item = normalizeFollowUp(raw);
    if (item) out.push(item);
  }
  return out;
}

export function findFollowUp(list, caseId) {
  const key = text(caseId);
  if (!key) return null;
  return normalizeFollowUpList(list).find((entry) => entry.caseId === key) ?? null;
}

// Record a follow-up: one record per case, so each open case shows
// exactly one next follow-up date. A second record for the same case
// replaces the first — it updates only the follow-up date, owner,
// step, and note. The case list is never an argument here, so a
// follow-up can never rewrite a case, its history, its amounts, or
// its outcome. A half-formed record leaves the list unchanged.
export function recordFollowUp(list, raw) {
  const item = normalizeFollowUp(raw);
  const base = normalizeFollowUpList(list);
  if (!item) return base;
  const next = base.filter((entry) => entry.caseId !== item.caseId);
  next.push(item);
  return next;
}

export function removeFollowUp(list, caseId) {
  const key = text(caseId);
  if (!key) return normalizeFollowUpList(list);
  return normalizeFollowUpList(list).filter((entry) => entry.caseId !== key);
}

export function followUpsForOwner(list, owner) {
  const key = text(owner);
  const base = normalizeFollowUpList(list);
  if (!key) return base;
  return base.filter((entry) => entry.owner === key);
}

// Build the queue from caller-supplied open cases and follow-up
// records. Resolved cases never appear. A case with no follow-up
// record shows a null next date — "not set", never an invented
// date. Overdue means the next date is strictly before today;
// a case due today is not overdue. The input lists are never
// mutated, and no case field is ever changed.
export function buildFollowUpQueue(cases, followups, today) {
  const day = validFollowUpDate(today);
  if (!day) return [];
  const caseList = Array.isArray(cases) ? cases : [];
  const followList = normalizeFollowUpList(followups);
  const byCase = new Map();
  for (const f of followList) {
    if (!byCase.has(f.caseId)) byCase.set(f.caseId, f);
  }
  const queue = [];
  for (const c of caseList) {
    if (!c || typeof c !== 'object') continue;
    const status = text(c.status).toLowerCase().replace(/[\s-]+/g, '_');
    if (!FOLLOWUP_OPEN_STATUSES.includes(status)) continue;
    const caseId = text(c.id);
    if (!caseId) continue;
    const f = byCase.get(caseId) ?? null;
    const nextDate = f ? f.nextFollowUpDate : null;
    const overdueDays = nextDate ? daysBetween(nextDate, day) : null;
    queue.push({
      caseId,
      customerId: text(c.customerId),
      customerName: text(c.customerName),
      billId: text(c.billId),
      reason: text(c.reason),
      status,
      owner: f ? f.owner : '',
      nextFollowUpDate: nextDate,
      lastFollowUpDate: f ? f.lastFollowUpDate : null,
      escalationStep: f ? f.escalationStep : 'none',
      note: f ? f.note : '',
      overdue: overdueDays !== null && overdueDays > 0,
      daysOverdue: overdueDays !== null && overdueDays > 0 ? overdueDays : 0,
    });
  }
  queue.sort((a, b) => a.caseId.localeCompare(b.caseId));
  return queue;
}

// Overdue cases only, most overdue first; ties break by case id
// so the list is stable and the oldest unresolved case surfaces
// first. Never invents a date: a case with no next date is not
// overdue and never appears here.
export function escalationList(queue) {
  const list = (Array.isArray(queue) ? queue : []).filter((entry) => entry && entry.overdue);
  list.sort((a, b) => (b.daysOverdue - a.daysOverdue) || a.caseId.localeCompare(b.caseId));
  return list;
}

export function buildFollowUpSummary(queue) {
  const list = Array.isArray(queue) ? queue : [];
  const overdue = list.filter((entry) => entry.overdue);
  const unset = list.filter((entry) => !entry.nextFollowUpDate);
  return {
    openCases: list.length,
    overdueCases: overdue.length,
    mostOverdueDays: overdue.length ? Math.max(...overdue.map((entry) => entry.daysOverdue)) : 0,
    withoutNextDate: unset.length,
  };
}

export function followUpSummaryText(summary) {
  const s = summary ?? { openCases: 0, overdueCases: 0, mostOverdueDays: 0, withoutNextDate: 0 };
  return `${s.openCases} open case(s) in the follow-up queue, ${s.overdueCases} overdue`
    + (s.overdueCases ? ` (most overdue ${s.mostOverdueDays} day(s))` : '')
    + `, ${s.withoutNextDate} without a next follow-up date set.`;
}

function queueRowHtml(entry) {
  const next = entry.nextFollowUpDate ?? 'Not set';
  const overdue = entry.overdue ? ` — OVERDUE by ${entry.daysOverdue} day(s)` : '';
  const step = ESCALATION_STEP_LABELS[entry.escalationStep] ?? entry.escalationStep;
  return `<p><strong>${escapeHtml(entry.caseId)}</strong> — ${escapeHtml(entry.customerName || entry.customerId)}`
    + ` — next follow-up: ${escapeHtml(next)}${escapeHtml(overdue)} — owner: ${escapeHtml(entry.owner || 'Not set')}`
    + ` — step: ${escapeHtml(step)}${entry.note ? ` — note: ${escapeHtml(entry.note)}` : ''}</p>`;
}

export function followUpHtml(queue) {
  const list = Array.isArray(queue) ? queue : [];
  if (!list.length) return '<p>No open dispute cases in the follow-up queue.</p>';
  return list.map(queueRowHtml).join('');
}

export function followUpCsv(queue) {
  const list = Array.isArray(queue) ? queue : [];
  const head = 'case_id,customer_id,customer_name,bill_id,reason,status,owner,next_follow_up_date,last_follow_up_date,escalation_step,overdue,days_overdue,note';
  const rows = list.map((entry) => [
    entry.caseId,
    entry.customerId,
    entry.customerName,
    entry.billId,
    entry.reason,
    entry.status,
    entry.owner,
    entry.nextFollowUpDate ?? '',
    entry.lastFollowUpDate ?? '',
    entry.escalationStep,
    entry.overdue ? 'yes' : 'no',
    entry.daysOverdue,
    entry.note,
  ].map(csvCell).join(','));
  return [head, ...rows].join('\n');
}

export function followUpFilename() {
  return 'dispute-followups.csv';
}
