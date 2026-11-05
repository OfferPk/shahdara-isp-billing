// Plan 283 (Plan 203-350) — Service trial note.
//
// A customer tries a package before committing, but the trial has
// no record, so its start, end, and outcome are all argued from
// memory. This module adds only the missing piece: one trial record
// per trial — the customer, the package trialled, the start date,
// the end date, the outcome kept or declined, and a note.
//
// What this module is NOT, stated plainly:
//   - It is not the package-change preview. That preview shows
//     what a package change would cost before it happens; this
//     module only records a trial that was actually tried, and the
//     preview is neither read nor rewritten here. The caller
//     supplies the customer, the package, and the dates, and this
//     module never touches any preview record.
//   - It is not the plan-change queue. That queue holds requested
//     package changes waiting to happen; this module only records
//     a trial that already happened, and the queue is neither read
//     nor rewritten here.
//   - It is not the first-bill preview either. That preview shows
//     what a first bill would look like; this module only records
//     a trial, and the first-bill preview is neither read nor
//     rewritten here.
//   - It never changes any package, bill, or payment record.
//     Recording a trial creates no bill and changes no package;
//     this module holds no bill or payment field beyond the names
//     on the trial itself, so there is nothing here that could
//     rewrite one. A wrong trial is removed and recorded again;
//     there is no edit function.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every trial,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A trial with no id, no customer, no package, no strict
//     start date, or no strict end date is refused outright, and
//     a trial whose end date falls before its start date is
//     refused too. Unknown fields are dropped, so a trial can
//     never grow a package, bill, or payment field.
//   - A duplicate id is never rewritten.
//   - The outcome folds to kept, declined, or in progress; a
//     trial with no outcome yet reads as in progress, because a
//     trial still running has nothing to keep or decline yet.
//   - Overlapping trials for the same customer are flagged: two
//     trials for one customer whose date ranges share even one
//     day overlap, and the flag names both trials.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validServiceTrialDate(value) {
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

const OUTCOME_KEPT = new Set(['kept', 'keep', 'stayed', 'yes', 'true', '1']);
const OUTCOME_DECLINED = new Set(['declined', 'decline', 'no', 'false', '0']);

export function foldTrialOutcome(value) {
  if (value === true) return 'kept';
  if (value === false) return 'declined';
  const folded = text(value).toLowerCase();
  if (OUTCOME_KEPT.has(folded)) return 'kept';
  if (OUTCOME_DECLINED.has(folded)) return 'declined';
  return 'in progress';
}

export function normalizeServiceTrial(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const packageTrialled = text(raw.package);
  const startDate = text(raw.startDate);
  const endDate = text(raw.endDate);
  const note = text(raw.note);
  if (!id || !customer || !packageTrialled) return null;
  if (!validServiceTrialDate(startDate)) return null;
  if (!validServiceTrialDate(endDate)) return null;
  if (endDate < startDate) return null;
  return {
    id,
    customer,
    package: packageTrialled,
    startDate,
    endDate,
    outcome: foldTrialOutcome(raw.outcome),
    note,
  };
}

export function normalizeServiceTrialList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeServiceTrial(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findServiceTrial(list, id) {
  const clean = normalizeServiceTrialList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordServiceTrial(list, raw) {
  const clean = normalizeServiceTrialList(list);
  const entry = normalizeServiceTrial(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeServiceTrial(list, id) {
  const clean = normalizeServiceTrialList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

export function serviceTrialSorted(list) {
  const clean = normalizeServiceTrialList(list);
  return [...clean].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    const aCustomer = a.customer.toLowerCase();
    const bCustomer = b.customer.toLowerCase();
    if (aCustomer !== bCustomer) return aCustomer < bCustomer ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function serviceTrialsForCustomer(list, customer) {
  const clean = normalizeServiceTrialList(list);
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return serviceTrialSorted(clean.filter((entry) => entry.customer.toLowerCase() === wanted));
}

export function serviceTrialCustomers(list) {
  const clean = normalizeServiceTrialList(list);
  const seen = new Map();
  for (const entry of clean) {
    const key = entry.customer.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.customer);
  }
  return [...seen.values()];
}

function trialsOverlap(a, b) {
  if (a.customer.toLowerCase() !== b.customer.toLowerCase()) return false;
  if (a.id === b.id) return false;
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function overlappingServiceTrials(list) {
  const clean = normalizeServiceTrialList(list);
  const flagged = new Map();
  for (let i = 0; i < clean.length; i += 1) {
    for (let j = i + 1; j < clean.length; j += 1) {
      if (trialsOverlap(clean[i], clean[j])) {
        flagged.set(clean[i].id, clean[i]);
        flagged.set(clean[j].id, clean[j]);
      }
    }
  }
  return serviceTrialSorted([...flagged.values()]);
}

export function serviceTrialHasOverlap(list, raw) {
  const clean = normalizeServiceTrialList(list);
  const candidate = normalizeServiceTrial(raw);
  if (!candidate) return false;
  return clean.some((entry) => trialsOverlap(entry, candidate));
}

export function serviceTrialSummaryText(list) {
  const clean = normalizeServiceTrialList(list);
  if (clean.length === 0) return 'No service trials recorded.';
  const kept = clean.filter((entry) => entry.outcome === 'kept').length;
  const declined = clean.filter((entry) => entry.outcome === 'declined').length;
  const inProgress = clean.length - kept - declined;
  const word = clean.length === 1 ? 'trial' : 'trials';
  return `${clean.length} service ${word} recorded, ${kept} kept, ${declined} declined, ${inProgress} in progress.`;
}

export function serviceTrialText(entry) {
  const clean = normalizeServiceTrial(entry);
  if (!clean) return 'No service trial recorded.';
  const base = `${clean.customer} — ${clean.package} — ${clean.startDate} to ${clean.endDate} — ${clean.outcome}`;
  return clean.note ? `${base} — ${clean.note}` : base;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function serviceTrialHtml(entry) {
  const clean = normalizeServiceTrial(entry);
  if (!clean) return '<p>No service trial recorded.</p>';
  return `<p>${escapeHtml(serviceTrialText(clean))}</p>`;
}

export function serviceTrialAllHtml(list) {
  const rows = serviceTrialSorted(list);
  if (!rows.length) return '<p>No service trials recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(serviceTrialText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function serviceTrialCsv(list) {
  const rows = serviceTrialSorted(list);
  const lines = ['"id","customer","package","start date","end date","outcome","note"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.customer),
      csvCell(entry.package),
      csvCell(entry.startDate),
      csvCell(entry.endDate),
      csvCell(entry.outcome),
      csvCell(entry.note),
    ].join(','));
  }
  return lines.join('\n');
}

export function serviceTrialFilename() {
  return 'service-trials.csv';
}
