// Plan 217 (Plan 203-350) — Customer Payment Behaviour Note (early/late
// pattern summary).
//
// Whether a customer usually pays early, on time, or late used to be
// known only as a feeling, so reminders and visits were not matched to
// how each customer actually pays. This module turns that feeling into
// a plain summary: per customer, how many bills were counted, and how
// many of them were paid early, on time, or late, plus how many are
// still unpaid. The summary is read-only: it summarises dates that are
// supplied to it, it scores nobody, and it sets no penalty.
//
// What this module is NOT, stated plainly:
//   - It is not a bill, a payment, or a reminder. Recording a
//     behaviour note creates no bill, settles nothing, and sends
//     nothing.
//   - It is not a judgement or a score. There is no number grade,
//     no percentage, and no "good" or "bad" label anywhere: only
//     plain bands — usually early, usually on time, usually late,
//     mixed pattern, or too few bills to judge.
//   - It is not the collection-promise record (Plan 214). That
//     record tracks promises against actual payments; this module
//     summarises due dates against paid dates only, and never reads
//     or writes any promise record.
//   - It is not the payment-reminder log (Plan 206). That log
//     records reminders sent; this module records no reminder and
//     never reads or writes any reminder record.
//   - It is not the pattern watch (Plan 89) or the seasonal
//     pattern note (Plan 159). Those watch voids, corrections, and
//     seasonal collection shapes; this module watches one
//     customer's payment timing only, and never reads or writes
//     either of those records.
//   - It is not any SISP/MD module. The corresponding SISP/MD
//     material was checked first: no per-customer early/on-time/
//     late summary exists there, so this module adds only the
//     missing piece and never reads or rewrites an SISP/MD record.
//   - Recording a behaviour note never changes any bill, payment,
//     customer, or staff record by itself.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input. Dates compare as
//     YYYY-MM-DD strings, so no Date object is ever used.
//   - A note with no id, no customer, or no strict due date is
//     refused outright; a paid date that is present but not a
//     strict date is refused too. A note with no paid date is
//     counted as unpaid, never guessed. Unknown fields are
//     dropped, so a note can never grow a bill, payment,
//     penalty, or customer-status field.
//   - A duplicate id is never rewritten: a re-save with
//     different figures also leaves the list unchanged. There is
//     no edit function; only recording a note and removal.
//   - The counts always sum exactly: paid early + paid on time +
//     paid late + unpaid always equals the bills counted for
//     that customer on the same list.
//   - A customer with fewer than 3 bills counted says so
//     plainly ("Too few bills to judge") instead of being given
//     a band on thin evidence. A customer with no payments
//     recorded yet says that plainly too.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const BEHAVIOUR_MIN_BILLS_TO_JUDGE = 3;

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function validBehaviourDate(value) {
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

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeBehaviourBill(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const customer = cleanText(raw.customer);
  const dueDate = cleanText(raw.dueDate);
  if (!id || !customer || !validBehaviourDate(dueDate)) return null;
  const paidDate = cleanText(raw.paidDate);
  if (paidDate && !validBehaviourDate(paidDate)) return null;
  return { id, customer, dueDate, paidDate };
}

export function normalizeBehaviourBillList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const clean = normalizeBehaviourBill(raw);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

export function findBehaviourBill(list, id) {
  const clean = normalizeBehaviourBillList(list);
  const wanted = cleanText(id);
  return clean.find((bill) => bill.id === wanted) ?? null;
}

export function recordBehaviourBill(list, record) {
  const clean = normalizeBehaviourBillList(list);
  const next = normalizeBehaviourBill(record);
  if (!next) return clean;
  if (clean.some((bill) => bill.id === next.id)) return clean;
  return [...clean, next];
}

export function removeBehaviourBill(list, id) {
  const wanted = cleanText(id);
  return normalizeBehaviourBillList(list).filter((bill) => bill.id !== wanted);
}

export function behaviourBillsSorted(list) {
  return normalizeBehaviourBillList(list).sort((a, b) => {
    const byCustomer = a.customer.localeCompare(b.customer);
    if (byCustomer !== 0) return byCustomer;
    const byDue = a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    if (byDue !== 0) return byDue;
    return a.id.localeCompare(b.id);
  });
}

export function behaviourBillsForCustomer(list, customer) {
  const query = cleanText(customer).toLowerCase();
  if (!query) return [];
  return behaviourBillsSorted(list).filter((bill) =>
    bill.customer.toLowerCase().includes(query),
  );
}

function bandForCounts(paidEarly, paidOnTime, paidLate, paidCount) {
  if (paidEarly * 2 > paidCount) return 'usually-early';
  if (paidOnTime * 2 > paidCount) return 'usually-on-time';
  if (paidLate * 2 > paidCount) return 'usually-late';
  return 'mixed';
}

export function behaviourBandLabel(band) {
  switch (band) {
    case 'usually-early': return 'Usually early';
    case 'usually-on-time': return 'Usually on time';
    case 'usually-late': return 'Usually late';
    case 'mixed': return 'Mixed pattern';
    case 'no-payments': return 'No payments recorded yet';
    default: return 'Too few bills to judge';
  }
}

export function behaviourSummaryForCustomer(list, customer) {
  const query = cleanText(customer).toLowerCase();
  const bills = query
    ? normalizeBehaviourBillList(list).filter((bill) => bill.customer.toLowerCase().includes(query))
    : [];
  const display = bills.length ? bills[0].customer : cleanText(customer);
  let paidEarly = 0;
  let paidOnTime = 0;
  let paidLate = 0;
  let unpaid = 0;
  for (const bill of bills) {
    if (!bill.paidDate) { unpaid += 1; continue; }
    if (bill.paidDate < bill.dueDate) paidEarly += 1;
    else if (bill.paidDate === bill.dueDate) paidOnTime += 1;
    else paidLate += 1;
  }
  const billsCounted = bills.length;
  const paidCount = paidEarly + paidOnTime + paidLate;
  let band = 'too-few';
  if (billsCounted >= BEHAVIOUR_MIN_BILLS_TO_JUDGE) {
    band = paidCount === 0 ? 'no-payments' : bandForCounts(paidEarly, paidOnTime, paidLate, paidCount);
  }
  return { customer: display, billsCounted, paidEarly, paidOnTime, paidLate, unpaid, paidCount, band };
}

export function behaviourSummaries(list) {
  const bills = normalizeBehaviourBillList(list);
  const seen = new Map();
  for (const bill of bills) {
    const key = bill.customer.toLowerCase();
    if (!seen.has(key)) seen.set(key, bill.customer);
  }
  return [...seen.values()].map((customer) => behaviourSummaryForCustomer(list, customer));
}

export function behaviourSummaryText(summary) {
  if (!summary) return 'No behaviour summary.';
  const counts = `${summary.billsCounted} bills counted — ${summary.paidEarly} early, ${summary.paidOnTime} on time, ${summary.paidLate} late, ${summary.unpaid} unpaid.`;
  return `${summary.customer}: ${counts} ${behaviourBandLabel(summary.band)}.`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function behaviourSummaryHtml(summary) {
  if (!summary) return '<p>No behaviour summary.</p>';
  return `<p>${escapeHtml(behaviourSummaryText(summary))}</p>`;
}

export function behaviourAllHtml(summaries) {
  const clean = Array.isArray(summaries) ? summaries : [];
  if (!clean.length) return '<p>No payment behaviour summaries yet.</p>';
  const rows = clean.map((summary) =>
    `<tr><td>${escapeHtml(summary.customer)}</td><td>${summary.billsCounted}</td><td>${summary.paidEarly}</td><td>${summary.paidOnTime}</td><td>${summary.paidLate}</td><td>${summary.unpaid}</td><td>${escapeHtml(behaviourBandLabel(summary.band))}</td></tr>`,
  ).join('');
  return `<table><thead><tr><th>Customer</th><th>Bills counted</th><th>Early</th><th>On time</th><th>Late</th><th>Unpaid</th><th>Pattern</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function behaviourCsv(summaries) {
  const clean = Array.isArray(summaries) ? summaries : [];
  const header = 'Customer,Bills counted,Early,On time,Late,Unpaid,Pattern';
  const rows = clean.map((summary) => [
    summary.customer, summary.billsCounted, summary.paidEarly,
    summary.paidOnTime, summary.paidLate, summary.unpaid,
    behaviourBandLabel(summary.band),
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function behaviourFilename() {
  return 'payment-behaviour.csv';
}
