// Plan 262 (Plan 203-350) — Customer anniversary milestone record.
//
// Years of service are only visible as a recognition list or a
// greeting draft, so there is no per-customer dated record of which
// milestones were actually reached. This module adds only the
// missing piece: one dated milestone entry per customer per
// anniversary reached — customer, years reached, date reached,
// acknowledged yes or no, plus dated follow-up notes.
//
// What this module is NOT, stated plainly:
//   - It is not the long-standing recognition list. That list names
//     loyal customers by tenure and drafts a thank-you for full
//     years of service — it is neither read nor rewritten here.
//     This module is a dated ledger of milestones actually
//     reached, one entry per customer per anniversary year.
//   - It is not the greeting draft. The greeting draft stores one
//     optional birthday or anniversary date per customer plus a
//     short draft to send by hand — it is neither read nor
//     rewritten here. This module records that a milestone was
//     reached, and whether it was acknowledged.
//   - It never changes any customer record, any bill, or any
//     payment. Recording a milestone never changes any of those,
//     and this module holds no customer, bill, or payment field
//     beyond the customer name on the entry itself, so there is
//     nothing here that could rewrite one.
//   - A customer page lists milestone entries in date order with
//     no duplicate entry for the same year: a second entry for the
//     same customer in the same anniversary year is refused.
//   - A milestone entry is never edited, only annotated. There
//     is no edit function: only record, annotate, and remove. A
//     dated follow-up never rewrites the customer, the years
//     reached, the date reached, the acknowledgement, or the note.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A record with no id, no customer, no years reached, no
//     strict date reached, or no clear acknowledgement is refused
//     outright. Years reached must be a whole number of at least
//     one. Unknown fields are dropped, so a record can never grow
//     a customer, bill, or payment field.
//   - A duplicate id is never rewritten, and a second entry for
//     the same customer in the same anniversary year is refused.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validAnniversaryMilestoneDate(value) {
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

function cleanAcknowledged(raw) {
  if (raw === true) return true;
  if (raw === false) return false;
  const value = text(raw).toLowerCase();
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validAnniversaryMilestoneDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const dateReached = text(raw.dateReached);
  if (!id || !customer) return null;
  if (!validAnniversaryMilestoneDate(dateReached)) return null;
  const yearsReached = raw.yearsReached;
  if (typeof yearsReached !== 'number' || !Number.isInteger(yearsReached) || yearsReached < 1) return null;
  const acknowledged = cleanAcknowledged(raw.acknowledged);
  if (acknowledged === null) return null;
  const note = text(raw.note);
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, customer, yearsReached, dateReached, acknowledged, note, followups };
}

export function normalizeAnniversaryMilestoneList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomerYears = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    const key = `${entry.customer.toLowerCase()}|${entry.yearsReached}`;
    if (seenCustomerYears.has(key)) continue;
    seenIds.add(entry.id);
    seenCustomerYears.add(key);
    out.push(entry);
  }
  return out;
}

export function recordAnniversaryMilestone(list, raw) {
  const clean = normalizeAnniversaryMilestoneList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.customer.toLowerCase() === entry.customer.toLowerCase() && item.yearsReached === entry.yearsReached)) return clean;
  return [...clean, entry];
}

export function removeAnniversaryMilestone(list, id) {
  const clean = normalizeAnniversaryMilestoneList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findAnniversaryMilestone(list, id) {
  const clean = normalizeAnniversaryMilestoneList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addAnniversaryMilestoneNote(list, id, date, note) {
  const clean = normalizeAnniversaryMilestoneList(list);
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
  if (a.dateReached !== b.dateReached) return a.dateReached < b.dateReached ? -1 : 1;
  if (a.yearsReached !== b.yearsReached) return a.yearsReached - b.yearsReached;
  if (a.customer.toLowerCase() !== b.customer.toLowerCase()) return a.customer.toLowerCase() < b.customer.toLowerCase() ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function anniversaryMilestoneSorted(list) {
  return normalizeAnniversaryMilestoneList(list).sort(compareEntries);
}

export function milestonesForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return anniversaryMilestoneSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function anniversaryMilestoneCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of anniversaryMilestoneSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

export function anniversaryMilestoneSummaryText(list) {
  const clean = normalizeAnniversaryMilestoneList(list);
  if (!clean.length) return 'No anniversary milestones recorded.';
  const acknowledged = clean.filter((item) => item.acknowledged).length;
  const unacknowledged = clean.length - acknowledged;
  return `${clean.length} anniversary milestone${clean.length === 1 ? '' : 's'}: ${acknowledged} acknowledged, ${unacknowledged} not yet acknowledged.`;
}

function yearsWord(years) {
  return years === 1 ? '1 year' : `${years} years`;
}

export function anniversaryMilestoneText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No anniversary milestone recorded.';
  const ack = clean.acknowledged ? 'acknowledged' : 'not yet acknowledged';
  const note = clean.note ? ` Note: ${clean.note.replace(/\.+$/, '')}.` : '';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `${clean.customer} — ${yearsWord(clean.yearsReached)} reached ${clean.dateReached}, ${ack}.${note}${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function anniversaryMilestoneHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No anniversary milestone recorded.</p>';
  return `<p>${escapeHtml(anniversaryMilestoneText(clean))}</p>`;
}

export function anniversaryMilestoneAllHtml(list) {
  const sorted = anniversaryMilestoneSorted(list);
  if (!sorted.length) return '<p>No anniversary milestones recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(anniversaryMilestoneText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function anniversaryMilestoneCsv(list) {
  const sorted = anniversaryMilestoneSorted(list);
  const header = ['id', 'customer', 'years reached', 'date reached', 'acknowledged', 'note', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.yearsReached,
    item.dateReached,
    item.acknowledged ? 'yes' : 'no',
    item.note,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function anniversaryMilestoneFilename() {
  return 'anniversary-milestones.csv';
}
