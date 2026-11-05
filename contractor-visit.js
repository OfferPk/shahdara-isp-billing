// Plan 237 (Plan 203-350) — Contractor visit record.
//
// Outside technicians are called in for specialist work, but their
// visits leave no record, so nobody can later say who came, what
// they did, or what they were paid to do. This module adds only
// the missing piece: one record per contractor visit — the
// contractor name, the date, the job, the customer or segment,
// the work done in plain words, and the charge if any.
//
// The fences, stated plainly:
//   - This covers outside technicians only. It does not replace
//     the field safety note (Plan 153), the on-call rota
//     (Plan 154), or the field handover note (Plan 160): those
//     modules are neither read nor rewritten here, and this
//     module imports nothing.
//   - A record is never edited, only followed by a dated
//     correction note. There is no edit function: only record,
//     correct, and remove. A correction never rewrites the
//     contractor, the date, the job, the customer or segment,
//     the work done, or the charge.
//   - Contractor visits list by contractor and by date, and
//     each visit names its job and its segment or customer:
//     a visit with no job, or with neither a customer nor a
//     segment, is refused.
//   - Recording a visit never changes any bill, payment,
//     customer, fault, or staff record by itself: the module
//     takes no bill, payment, customer, fault, or staff object
//     in, edits none, and returns none. Customers, segments,
//     and jobs arrive as plain text, and a charge is only a
//     recorded figure, never a posted payment.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validContractorVisitDate(value) {
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

function chargeCentsOf(raw) {
  if (Number.isInteger(raw.chargeCents) && raw.chargeCents >= 0) return raw.chargeCents;
  if (typeof raw.charge === 'number' && Number.isFinite(raw.charge) && raw.charge >= 0) {
    return Math.round(raw.charge * 100);
  }
  if (typeof raw.charge === 'string' && raw.charge.trim() !== '') {
    const value = Number(raw.charge);
    if (Number.isFinite(value) && value >= 0) return Math.round(value * 100);
  }
  return null;
}

function cleanCorrection(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validContractorVisitDate(date) || !note) return null;
  return { date, note };
}

function normalizeVisit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const contractor = text(raw.contractor);
  const date = text(raw.date);
  const job = text(raw.job);
  const customer = text(raw.customer);
  const segment = text(raw.segment);
  const workDone = text(raw.workDone);
  if (!id || !contractor || !validContractorVisitDate(date)) return null;
  if (!job || (!customer && !segment) || !workDone) return null;
  const corrections = Array.isArray(raw.corrections)
    ? raw.corrections.map(cleanCorrection).filter(Boolean)
    : [];
  return { id, contractor, date, job, customer, segment, workDone, chargeCents: chargeCentsOf(raw), corrections };
}

export function normalizeContractorVisitList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const visit = normalizeVisit(raw);
    if (visit && !seen.has(visit.id)) {
      seen.add(visit.id);
      out.push(visit);
    }
  }
  return out;
}

export function recordContractorVisit(list, raw) {
  const clean = normalizeContractorVisitList(list);
  const visit = normalizeVisit(raw);
  if (!visit) return clean;
  if (clean.some((item) => item.id === visit.id)) return clean;
  return [...clean, visit];
}

export function removeContractorVisit(list, id) {
  const clean = normalizeContractorVisitList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findContractorVisit(list, id) {
  const clean = normalizeContractorVisitList(list);
  const wanted = text(id);
  return clean.find((item) => item.id === wanted) || null;
}

export function contractorVisitsSorted(list) {
  const clean = normalizeContractorVisitList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ca = a.contractor.toLowerCase();
    const cb = b.contractor.toLowerCase();
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function contractorVisitsForContractor(list, contractor) {
  const wanted = text(contractor).toLowerCase();
  if (!wanted) return contractorVisitsSorted(list);
  return contractorVisitsSorted(list).filter((item) => item.contractor.toLowerCase().includes(wanted));
}

export function contractorVisitsOnDate(list, date) {
  const wanted = text(date);
  if (!validContractorVisitDate(wanted)) return [];
  return contractorVisitsSorted(list).filter((item) => item.date === wanted);
}

export function contractorVisitContractors(list) {
  const clean = normalizeContractorVisitList(list);
  const seen = new Map();
  for (const item of clean) {
    const key = item.contractor.toLowerCase();
    if (!seen.has(key)) seen.set(key, item.contractor);
  }
  return [...seen.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

export function addContractorVisitCorrection(list, id, date, note) {
  const base = normalizeContractorVisitList(list);
  const target = text(id);
  const correctionDate = text(date);
  const correctionNote = text(note);
  if (!validContractorVisitDate(correctionDate) || !correctionNote) return base;
  return base.map((item) => {
    if (item.id !== target) return item;
    return { ...item, corrections: [...item.corrections, { date: correctionDate, note: correctionNote }] };
  });
}

function moneyRs(chargeCents) {
  return (chargeCents / 100).toFixed(2);
}

export function contractorVisitSummaryText(list) {
  const clean = normalizeContractorVisitList(list);
  const contractors = contractorVisitContractors(clean);
  return `${clean.length} contractor visit${clean.length === 1 ? '' : 's'} from ${contractors.length} contractor${contractors.length === 1 ? '' : 's'}.`;
}

export function contractorVisitText(visit) {
  const clean = normalizeVisit(visit);
  if (!clean) return '';
  const target = clean.customer && clean.segment
    ? `customer ${clean.customer}, segment ${clean.segment}`
    : clean.customer
      ? `customer ${clean.customer}`
      : `segment ${clean.segment}`;
  const charge = clean.chargeCents === null ? 'No charge noted.' : `Charge Rs. ${moneyRs(clean.chargeCents)}.`;
  const corrections = clean.corrections.length
    ? ` Corrections: ${clean.corrections.map((item) => `${item.date}: ${item.note}`).join('; ')}`
    : '';
  return `${clean.contractor} on ${clean.date}: job ${clean.job} for ${target}. Work done: ${clean.workDone} ${charge}${corrections}`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function contractorVisitHtml(visit) {
  const clean = normalizeVisit(visit);
  if (!clean) return '';
  return `<p>${esc(contractorVisitText(clean))}</p>`;
}

export function contractorVisitCsv(list) {
  const rows = [['id', 'contractor', 'date', 'job', 'customer', 'segment', 'work done', 'charge Rs', 'corrections']];
  for (const visit of contractorVisitsSorted(list)) {
    rows.push([
      visit.id,
      visit.contractor,
      visit.date,
      visit.job,
      visit.customer,
      visit.segment,
      visit.workDone,
      visit.chargeCents === null ? '' : moneyRs(visit.chargeCents),
      visit.corrections.map((item) => `${item.date}: ${item.note}`).join('; '),
    ]);
  }
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function contractorVisitFilename() {
  return 'contractor-visits.csv';
}
