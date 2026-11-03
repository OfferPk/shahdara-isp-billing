// Plan 20 (Plan 1-100) — Pending installations queue.
//
// Customers who have signed up but are not yet connected sit in no
// list, so an installation promised last week can quietly slip past
// its date. This module is the QUEUE VIEW of that pipeline: it shows,
// at a glance, who is still waiting, for how long, and which
// onboarding step they have reached.
//
// Scope fence, stated plainly: this is a VIEW ONLY. It is not a
// second pending list. Membership comes from Plan 16's
// pendingOnboardingList — the caller passes that list in, and this
// module only re-sorts it by enquiry date and drops the customers
// whose service is already activated. There is never a second list
// to drift from Plan 16's: ticking the activation step in the Plan 16
// panel removes a customer from this queue, because the queue is
// rebuilt from the same checklist ticks. Marking a customer activated
// here ticks that same Plan 16 step through the caller; this module
// itself writes nothing.
//
// What is new here, stated plainly against the neighbouring lists:
//   - Plan 16's pending list is sorted by customer name A–Z and
//     covers every incomplete checklist, including a customer whose
//     service is activated but whose first bill is still unraised.
//     This queue covers only the NOT-YET-ACTIVATED: a customer with
//     the activation step ticked is out, even if later steps are
//     still open. Ordering is by enquiry date, oldest first, not
//     by name.
//   - The SISP installation tracker (install-tracker.js) is a
//     different record: payment-first requests, which may not even
//     be customer records yet, with a delay reason and a completion
//     pipeline. This queue is for signed-up customers with an
//     onboarding checklist; it never reads or writes tracker
//     requests, and it never changes a bill, a payment, a lifecycle
//     record, or a field-visit outcome (Plan 2 covers visits).
//   - Waiting time is SHOWN ONLY. It is never used to change a
//     bill, a fee, or a due date, and no SLA or grace period is
//     invented: there is no "late" threshold here, only the
//     promised date itself, flagged when it has passed.
//
// How the fence is kept in this module:
//   - It is import-free (like onboarding-checklist.js): the caller
//     supplies every entry, every date, and today, and the module
//     never reads storage, the clock, or the network, and never
//     mutates an input.
//   - Enquiry date resolution, in order: an explicit enquiryDate
//     on the entry, if it is a real calendar date; otherwise the
//     date of the entry's enquiry step tick in the checklist; else
//     null — shown as "Not recorded", never guessed. An entry
//     without an enquiry date is still in the queue, sorted last.
//   - A promised install date is caller-supplied (the caller keeps
//     it in its own list, like Plan 18's preview-shown tracking):
//     a real calendar date, or null — shown as "Not set", never
//     guessed. A promised date in the past is flagged
//     promisedOverdue, for display only; it changes nothing.
//   - Days waiting is whole days from enquiry date to today,
//     clamped at 0 for a future enquiry date (mirroring
//     install-tracker.js daysSoFar), and null when either date is
//     missing or invalid. Today is always caller-supplied, so a
//     waiting figure always comes from a real "today".

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// A real calendar date in YYYY-MM-DD form, or null. 2026-02-30 is
// rejected: the Date round-trip must reproduce the same string.
export function validPendingDate(value) {
  const str = text(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === str ? str : null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Whole days from dateA to dateB (UTC calendar days), or null when
// either date is not a real calendar date.
export function wholeDaysBetweenPending(dateA, dateB) {
  const a = validPendingDate(dateA);
  const b = validPendingDate(dateB);
  if (!a || !b) return null;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

// Days waiting: enquiry date to today, clamped at 0 for a future
// enquiry date, null when either date is missing or invalid.
export function daysWaiting(enquiryDate, today) {
  const days = wholeDaysBetweenPending(enquiryDate, today);
  if (days === null) return null;
  return days < 0 ? 0 : days;
}

// True when the activation step of the checklist is ticked. An entry
// with no checklist cannot be shown as not-yet-activated, so it is
// not activated — but buildPendingInstallationQueue skips entries
// without a checklist entirely (see below), so this helper is only
// ever asked about real checklist entries.
export function isActivationCompleted(entry) {
  const steps = entry?.checklist?.steps;
  if (!Array.isArray(steps)) return false;
  const activation = steps.find((step) => step.stepId === 'activation');
  return activation?.completed === true;
}

// The enquiry step's tick date, or null when the enquiry step was
// never ticked with a real date.
export function enquiryStepDate(entry) {
  const steps = entry?.checklist?.steps;
  if (!Array.isArray(steps)) return null;
  const enquiry = steps.find((step) => step.stepId === 'enquiry');
  return validPendingDate(enquiry?.date);
}

// One queue row: the Plan 16 entry, re-presented for the queue.
// Enquiry date: explicit entry date first, then the enquiry step's
// tick date, else null. Promised date: the entry's caller-supplied
// promisedInstallDate, validated, else null. The current step is
// Plan 16's own next-step derivation, carried verbatim.
export function buildPendingInstallationRow(entry, today) {
  const checklist = entry?.checklist ?? null;
  const enquiryDate = validPendingDate(entry?.enquiryDate)
    ?? enquiryStepDate(entry);
  const promisedInstallDate = validPendingDate(entry?.promisedInstallDate);
  const todayValid = validPendingDate(today);
  return {
    customerId: text(entry?.customerId ?? entry?.id),
    customerName: text(entry?.customerName ?? entry?.name) || text(entry?.customerId ?? entry?.id),
    mohalla: text(entry?.mohalla ?? entry?.area),
    enquiryDate,
    daysWaiting: daysWaiting(enquiryDate, today),
    currentStepId: checklist?.nextStepId ?? null,
    currentStepLabel: checklist?.nextStepLabel ?? null,
    stepsDone: checklist?.done ?? null,
    stepsTotal: checklist?.total ?? null,
    progressPercent: checklist?.progressPercent ?? null,
    promisedInstallDate,
    promisedOverdue: Boolean(
      promisedInstallDate && todayValid && promisedInstallDate < todayValid,
    ),
  };
}

// The queue itself: Plan 16 pending entries, minus every customer
// whose activation step is ticked, ordered by enquiry date (oldest
// first, undated last), ties by name A–Z (case-insensitive) then
// customer id. Entries without a checklist are skipped: without a
// checklist there is no activation state to test, so they are never
// invented into the queue. Inputs are never mutated.
export function buildPendingInstallationQueue(entries, options = {}) {
  const today = options?.today ?? null;
  const rows = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry?.checklist) continue;
    if (isActivationCompleted(entry)) continue;
    rows.push(buildPendingInstallationRow(entry, today));
  }
  rows.sort((a, b) => {
    if (a.enquiryDate && b.enquiryDate && a.enquiryDate !== b.enquiryDate) {
      return a.enquiryDate < b.enquiryDate ? -1 : 1;
    }
    if (a.enquiryDate && !b.enquiryDate) return -1;
    if (!a.enquiryDate && b.enquiryDate) return 1;
    const byName = (a.customerName || '').localeCompare(b.customerName || '', undefined, { sensitivity: 'base' });
    return byName !== 0 ? byName : (a.customerId || '').localeCompare(b.customerId || '');
  });
  return rows;
}

// Caller-owned promised-date list: one { customerId,
// promisedInstallDate } row per customer. A blank or invalid date
// clears the row (the promise is unrecorded, not stored as a bad
// date). Returns a NEW list; the input is never mutated.
export function findPromisedInstallDate(list, customerId) {
  const id = text(customerId);
  if (!id) return null;
  const row = (Array.isArray(list) ? list : [])
    .find((entry) => text(entry?.customerId ?? entry?.id) === id);
  return validPendingDate(row?.promisedInstallDate);
}

export function upsertPromisedInstallDate(list, customerId, promisedInstallDate) {
  const id = text(customerId);
  const date = validPendingDate(promisedInstallDate);
  const rest = (Array.isArray(list) ? list : [])
    .filter((entry) => text(entry?.customerId ?? entry?.id) !== id);
  if (!id || !date) return rest;
  rest.push({ customerId: id, promisedInstallDate: date });
  return rest;
}

export function removePromisedInstallDate(list, customerId) {
  const id = text(customerId);
  return (Array.isArray(list) ? list : [])
    .filter((entry) => text(entry?.customerId ?? entry?.id) !== id);
}

export function pendingInstallationSummaryText(queue) {
  const rows = Array.isArray(queue) ? queue : [];
  if (rows.length === 0) return 'No pending installations';
  const overdue = rows.filter((row) => row.promisedOverdue).length;
  const waiting = rows.filter((row) => row.daysWaiting !== null);
  const longest = waiting.length
    ? Math.max(...waiting.map((row) => row.daysWaiting))
    : null;
  let summary = `${rows.length} pending installation${rows.length === 1 ? '' : 's'}`;
  if (overdue > 0) summary += ` · ${overdue} promised date${overdue === 1 ? '' : 's'} passed`;
  if (longest !== null) summary += ` · longest wait ${longest} day${longest === 1 ? '' : 's'}`;
  return summary;
}

export function pendingInstallationHtml(queue) {
  const rows = Array.isArray(queue) ? queue : [];
  if (rows.length === 0) return '<p class="empty-state">No pending installations</p>';
  const items = rows.map((row) => {
    const mohalla = row.mohalla ? ` (${escapeHtml(row.mohalla)})` : '';
    const enquiry = row.enquiryDate ? escapeHtml(row.enquiryDate) : 'Not recorded';
    const waiting = row.daysWaiting === null
      ? 'waiting time unknown'
      : `${row.daysWaiting} day${row.daysWaiting === 1 ? '' : 's'} waiting`;
    const step = row.currentStepLabel
      ? `next: ${escapeHtml(row.currentStepLabel)}`
      : 'no step recorded';
    const steps = row.stepsDone !== null && row.stepsTotal !== null
      ? ` (${row.stepsDone} of ${row.stepsTotal} steps done)`
      : '';
    const promised = row.promisedInstallDate
      ? `promised ${escapeHtml(row.promisedInstallDate)}${row.promisedOverdue ? ' — promised date passed' : ''}`
      : 'no promised date set';
    return `<li><strong>${escapeHtml(row.customerName)}</strong>${mohalla} — `
      + `enquired ${enquiry} · ${waiting} · ${step}${steps} · ${promised} `
      + `<button type="button" class="secondary-button btn-sm pending-install-activate-btn" data-pending-install-customer-id="${escapeHtml(row.customerId)}">Mark activated</button></li>`;
  }).join('');
  return `<ul>${items}</ul>`
    + '<p>Waiting time is shown only — it never changes a bill, a fee, or a due date. '
    + 'Marking a customer activated ticks the activation step on their Plan 16 checklist, which removes them from this queue.</p>';
}

export function pendingInstallationCsv(queue) {
  const header = 'customerId,customerName,mohalla,enquiryDate,daysWaiting,currentStep,promisedInstallDate,promisedOverdue';
  const rows = (Array.isArray(queue) ? queue : []).map((row) => [
    csvCell(row.customerId),
    csvCell(row.customerName),
    csvCell(row.mohalla),
    csvCell(row.enquiryDate),
    row.daysWaiting === null ? '' : String(row.daysWaiting),
    csvCell(row.currentStepLabel),
    csvCell(row.promisedInstallDate),
    row.promisedOverdue ? 'yes' : 'no',
  ].join(','));
  return [header, ...rows].join('\n');
}

export function pendingInstallationFilename() {
  return 'pending-installations.csv';
}
