// Plan 84 (Plan 1-100) — Hold expiry and resume queue
// (returning customers, worked in order).
//
// Holds end on dates nobody watches, so a returned household
// waits days for service while its account still shows as
// paused, and the owner discovers the return only when the
// customer complains. This module is the dated list that was
// missing: holds (Plan 82) ending inside an operator-set
// window, earliest return first, each with the customer, the
// mohalla, and the billing treatment that applies on return.
//
// The fences, stated plainly:
//   - The queue is read-only and derived fresh every time: it
//     holds no copy of its own, so closing a hold on its own
//     screen removes it from the next queue. It never resumes,
//     bills, or messages anyone by itself — confirming a
//     resumption is an operator action that closes the hold
//     through Plan 82's own endHold, which records the resume
//     date on the hold; this module only lists what is due.
//   - A hold past its return date without confirmation stays
//     visible as overdue-resume, never silently extended or
//     closed, and never dropped by the window: the window
//     limits only the due-soon entries, never the overdue ones.
//   - Relocations (Plan 85) are not implemented yet, so they
//     arrive here as a caller-supplied list in the same shape
//     — Plan 85 plugs in later without rewriting this module.
//     Until then the panel builds the queue from Plan 82
//     holds alone, and says so.
//   - Queue actions never alter any bill or payment: this
//     module holds no bill, payment, or package field, and it
//     never touches a bill, payment, or customer record.
//   - Dates are strict YYYY-MM-DD calendar dates
//     (2026-02-30 is not a date). Inputs are never mutated,
//     and the module never reads storage, the clock, or the
//     network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const RESUME_KINDS = ['hold', 'relocation'];

export const RESUME_KIND_LABELS = {
  hold: 'Vacation hold',
  relocation: 'Relocation return',
};

export const RESUME_STATUSES = ['due_soon', 'overdue'];

export const RESUME_STATUS_LABELS = {
  due_soon: 'Due soon',
  overdue: 'Overdue resume',
};

// Billing treatments a hold can carry (Plan 82). On return,
// ordinary billing resumes in every case; the treatment shown
// is what applied during the hold, so the operator knows what
// the returning household was on.
export const RESUME_TREATMENTS = ['no_bill', 'retention', 'relocation'];

export const RESUME_TREATMENT_LABELS = {
  no_bill: 'No bill raised (hold)',
  retention: 'Retention charge only (hold)',
  relocation: 'Relocation return',
};

export const RESUME_ON_RETURN = 'Ordinary billing resumes';

// Plan T canonical aliases, mirrored here so this module stays
// import-free: "Mohalla Bani", "bani" and "BANII" are one mohalla.
const MOHALLA_ALIASES = {
  bani: 'BANII',
  banii: 'BANII',
  kishti: 'KISHTII',
  kishtii: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  chamyaaa: 'CHAMYAAA',
};

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const raw = text(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function validResumeDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

export function resumeMohallaKey(value) {
  const raw = text(value);
  if (!raw) return '__unassigned__';
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return '__unassigned__';
  const folded = stripped.toLowerCase().replace(/\s+/g, '');
  return MOHALLA_ALIASES[folded] ?? stripped.toUpperCase();
}

export function resumeMohallaLabel(value) {
  const raw = text(value);
  if (!raw) return '';
  return raw.replace(/^mohalla\s+/i, '').trim();
}

function daysBetween(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  return Math.round((to - from) / 86400000);
}

function addDays(dateStr, days) {
  const built = new Date(`${dateStr}T00:00:00Z`);
  built.setUTCDate(built.getUTCDate() + days);
  const pad = (value) => String(value).padStart(2, '0');
  return `${built.getUTCFullYear()}-${pad(built.getUTCMonth() + 1)}-${pad(built.getUTCDate())}`;
}

// One Plan 82 hold, reduced to what the queue needs. An ended
// hold is already resumed and never queues; a hold without a
// usable expected return date cannot be placed and is dropped,
// never given a guessed date.
export function normalizeResumeHold(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const returnDate = validResumeDate(raw.expectedReturnDate ?? raw.returnDate);
  const status = text(raw.status);
  const treatment = text(raw.treatment);
  if (!id || !customerId || !returnDate) return null;
  if (status !== 'active') return null;
  if (!RESUME_TREATMENTS.includes(treatment)) return null;
  return {
    kind: 'hold',
    id,
    customerId,
    customerName: text(raw.customerName),
    returnDate,
    treatment,
    mohalla: resumeMohallaLabel(raw.mohalla),
    mohallaKey: resumeMohallaKey(raw.mohalla),
  };
}

// One caller-supplied relocation return (Plan 85 input shape).
// A relocation already marked resumed never queues; one
// without a usable return date is dropped, never guessed.
export function normalizeResumeRelocation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const returnDate = validResumeDate(raw.returnDate ?? raw.expectedReturnDate);
  const status = text(raw.status);
  if (!id || !customerId || !returnDate) return null;
  if (status && status !== 'pending') return null;
  return {
    kind: 'relocation',
    id,
    customerId,
    customerName: text(raw.customerName),
    returnDate,
    treatment: 'relocation',
    mohalla: resumeMohallaLabel(raw.mohalla),
    mohallaKey: resumeMohallaKey(raw.mohalla),
  };
}

// The queue itself: holds ending inside the window (default 7
// days, inclusive at both ends) plus every overdue resume,
// earliest return first, then customer name A–Z, then id.
// An invalid today yields no queue at all, never a queue built
// on a guessed date; an invalid window falls back to 7 days.
export function buildResumeQueue(holds, relocations, options = {}) {
  const today = validResumeDate(options.today);
  if (!today) return [];
  const windowDays = Number.isInteger(options.windowDays) && options.windowDays >= 0
    ? options.windowDays
    : 7;
  const windowEnd = addDays(today, windowDays);
  const sources = [];
  if (Array.isArray(holds)) {
    for (const row of holds) {
      const entry = normalizeResumeHold(row);
      if (entry) sources.push(entry);
    }
  }
  if (Array.isArray(relocations)) {
    for (const row of relocations) {
      const entry = normalizeResumeRelocation(row);
      if (entry) sources.push(entry);
    }
  }
  const queue = [];
  for (const entry of sources) {
    const diff = daysBetween(today, entry.returnDate);
    let status = null;
    if (diff < 0) status = 'overdue';
    else if (entry.returnDate <= windowEnd) status = 'due_soon';
    else continue;
    queue.push({
      ...entry,
      status,
      daysUntilReturn: diff >= 0 ? diff : null,
      daysOverdue: diff < 0 ? -diff : null,
      treatmentLabel: RESUME_TREATMENT_LABELS[entry.treatment],
      onReturn: RESUME_ON_RETURN,
    });
  }
  queue.sort((a, b) => {
    if (a.returnDate !== b.returnDate) return a.returnDate < b.returnDate ? -1 : 1;
    const nameA = (a.customerName || a.customerId).toLowerCase();
    const nameB = (b.customerName || b.customerId).toLowerCase();
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return queue;
}

// Overdue resumes only: the list that must never be silently
// extended or closed.
export function overdueResumeQueue(holds, relocations, options = {}) {
  return buildResumeQueue(holds, relocations, options).filter((row) => row.status === 'overdue');
}

export function resumeQueueFiltered(queue, filters = {}) {
  const list = Array.isArray(queue) ? queue : [];
  const status = text(filters.status);
  const kind = text(filters.kind);
  const mohallaKey = filters.mohalla ? resumeMohallaKey(filters.mohalla) : '';
  return list.filter((row) => {
    if (status && row.status !== status) return false;
    if (kind && row.kind !== kind) return false;
    if (mohallaKey && row.mohallaKey !== mohallaKey) return false;
    return true;
  });
}

export function buildResumeSummary(queue) {
  const list = Array.isArray(queue) ? queue : [];
  return {
    total: list.length,
    dueSoon: list.filter((row) => row.status === 'due_soon').length,
    overdue: list.filter((row) => row.status === 'overdue').length,
    holds: list.filter((row) => row.kind === 'hold').length,
    relocations: list.filter((row) => row.kind === 'relocation').length,
  };
}

export function resumeSummaryText(summary) {
  if (!summary || summary.total === 0) return 'No resumes in the window and none overdue.';
  const parts = [`${summary.total} resume${summary.total === 1 ? '' : 's'}`];
  if (summary.dueSoon) parts.push(`${summary.dueSoon} due soon`);
  if (summary.overdue) parts.push(`${summary.overdue} overdue`);
  return parts.join(' — ');
}

export function resumeHtml(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return '<p class="chart-note">No resumes in the window and none overdue.</p>';
  const body = list.map((row) => {
    const when = row.status === 'overdue'
      ? `${escapeHtml(row.returnDate)} (${row.daysOverdue} day${row.daysOverdue === 1 ? '' : 's'} overdue)`
      : `${escapeHtml(row.returnDate)} (in ${row.daysUntilReturn} day${row.daysUntilReturn === 1 ? '' : 's'})`;
    return `<tr><td>${escapeHtml(row.customerName || row.customerId)}</td><td>${escapeHtml(RESUME_KIND_LABELS[row.kind] ?? row.kind)}</td><td>${escapeHtml(row.mohalla || '—')}</td><td>${when}</td><td>${escapeHtml(row.treatmentLabel)}</td><td>${escapeHtml(RESUME_STATUS_LABELS[row.status])}</td></tr>`;
  }).join('');
  return `<table class="data-table"><thead><tr><th>Customer</th><th>Source</th><th>Mohalla</th><th>Return</th><th>Treatment during hold</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function resumeCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const lines = ['Customer,Source,Mohalla,Return date,Status,Treatment during hold,On return'];
  for (const row of list) {
    lines.push([
      csvCell(row.customerName || row.customerId),
      csvCell(RESUME_KIND_LABELS[row.kind] ?? row.kind),
      csvCell(row.mohalla),
      csvCell(row.returnDate),
      csvCell(RESUME_STATUS_LABELS[row.status] ?? row.status),
      csvCell(row.treatmentLabel),
      csvCell(row.onReturn),
    ].join(','));
  }
  return lines.join('\n');
}

export function resumeFilename() {
  return 'resume-queue.csv';
}
