// Plan 82 (Plan 1-100) — Customer-requested vacation and seasonal
// hold (dated, with billing treatment).
//
// A household going away for a month or a season has only two
// choices — pay full price for unused service, or disconnect and
// lose the account — so it often simply stops paying instead.
// This module is the hold record that was missing: one record per
// hold, linked to the customer profile, with a start date, an
// expected return date, a reason, and the operator-set billing
// treatment for the hold (no bill raised, or a small operator-set
// retention charge). The request itself may arrive through the
// request queue (Plan 50); this plan owns the hold and its
// billing treatment, and only the request id is kept here.
//
// What already existed, checked first (dedup audit, Plans 82/83
// vs Plan U): the SISP-8 vacation hold is flat fields on the
// customer record (paused / pauseStartDate / autoResumeDate /
// pauseSkippedMonths), wired into the billing paths so a paused
// month is skipped. It has no reason, no billing-treatment
// choice, and no standalone record or history — one hold at a
// time, on the customer itself. The SISP-153 seasonal keep-alive
// rate is a price on the customer record, not a hold record.
// Plan U is lifecycle presentation only. None of those fields is
// read or written here: this module adds only the dated hold
// record with its reason and treatment, plus the month-treatment
// calculator that answers, for one month, what the hold means.
//
// The fences, stated plainly:
//   - A hold creates no bill by itself and past bills are never
//     rewritten. This module holds no bill, payment, or package
//     field, and it never touches a bill, payment, or customer
//     record — the month treatment it computes is a view of the
//     hold, for the billing path to apply, not a bill raised here.
//   - A month fully inside a no-bill hold raises no full monthly
//     bill for that month; a month fully inside a retention hold
//     shows that retention charge and nothing else. A month only
//     partly inside a hold is an ordinary month — the module
//     never invents a pro-rata split for it.
//   - Ending a hold early shortens the covered span: the month
//     containing the actual return date is ordinary unless the
//     return date is that month's last day, and months after it
//     are ordinary. Months already given hold treatment are
//     never rewritten — ending early is never retroactive.
//   - Half-formed records are refused outright, never stored
//     half-formed. Dates are strict YYYY-MM-DD calendar dates
//     (2026-02-30 is not a date). Money is integer cents: a
//     *Cents field is already in cents and is used as-is; a
//     plain amount field is rupees and converts at x100 once,
//     so a stored record re-read through the normaliser never
//     inflates a hundredfold. Inputs are never mutated, and the
//     module never reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const HOLD_REASONS = ['away', 'seasonal_residence', 'other'];

export const HOLD_REASON_LABELS = {
  away: 'Away',
  seasonal_residence: 'Seasonal residence',
  other: 'Other',
};

export const HOLD_TREATMENTS = ['no_bill', 'retention'];

export const HOLD_TREATMENT_LABELS = {
  no_bill: 'No bill raised',
  retention: 'Retention charge only',
};

export const HOLD_STATUSES = ['active', 'ended'];

export const HOLD_STATUS_LABELS = {
  active: 'Active',
  ended: 'Ended',
};

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

export function validHoldDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

// First and last day of a 'YYYY-MM' month, or null for a month
// that is not one.
function monthBounds(month) {
  const match = MONTH_RE.exec(text(month));
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return [`${year}-${pad(monthNumber)}-01`, `${year}-${pad(monthNumber)}-${pad(lastDay)}`];
}

export function holdMohallaKey(value) {
  const raw = text(value);
  if (!raw) return null;
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return null;
  const folded = stripped.toLowerCase().replace(/\s+/g, ' ');
  const aliased = MOHALLA_ALIASES[folded.replace(/\s+/g, '')] ?? MOHALLA_ALIASES[folded];
  if (aliased) return aliased;
  return stripped.toUpperCase();
}

function holdMohallaLabel(value) {
  const raw = text(value);
  if (!raw) return '';
  return raw.replace(/^mohalla\s+/i, '').trim();
}

function centsField(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) return null;
  return number;
}

function rupeesToCents(value) {
  if (value === null || value === undefined || text(value) === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100);
}

function toCents(raw) {
  if (raw.retentionCents !== undefined && raw.retentionCents !== null && text(raw.retentionCents) !== '') {
    return centsField(raw.retentionCents);
  }
  return rupeesToCents(raw.retentionAmount);
}

export function normalizeHold(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const startDate = validHoldDate(raw.startDate);
  const expectedReturnDate = validHoldDate(raw.expectedReturnDate);
  const reason = text(raw.reason);
  const treatment = text(raw.treatment);
  const status = text(raw.status);
  if (!id || !customerId) return null;
  if (!startDate || !expectedReturnDate) return null;
  // A hold must span at least into a later day: the expected
  // return date is after the start date, never on it or before.
  if (expectedReturnDate <= startDate) return null;
  if (!HOLD_REASONS.includes(reason)) return null;
  if (!HOLD_TREATMENTS.includes(treatment)) return null;
  if (!HOLD_STATUSES.includes(status)) return null;
  // A retention hold without a positive charge is half-formed:
  // the charge is the whole point of the treatment. A no-bill
  // hold carries no charge at all, so any supplied amount is
  // dropped rather than kept as a stray figure.
  let retentionCents = null;
  if (treatment === 'retention') {
    retentionCents = toCents(raw);
    if (retentionCents === null || retentionCents <= 0) return null;
  }
  // An ended hold needs a real return date on or after the start;
  // an active hold carries no return date at all.
  let actualReturnDate = '';
  if (status === 'ended') {
    actualReturnDate = validHoldDate(raw.actualReturnDate);
    if (!actualReturnDate || actualReturnDate < startDate) return null;
  }
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    requestId: text(raw.requestId),
    startDate,
    expectedReturnDate,
    actualReturnDate,
    reason,
    treatment,
    retentionCents,
    status,
    mohalla: holdMohallaLabel(raw.mohalla),
    mohallaKey: holdMohallaKey(raw.mohalla),
  };
}

export function normalizeHoldList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const row of list) {
    const entry = normalizeHold(row);
    if (entry) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

export function findHold(list, id) {
  const entries = normalizeHoldList(list);
  return entries.find((entry) => entry.id === text(id)) ?? null;
}

export function upsertHold(list, record) {
  const entry = normalizeHold(record);
  if (!entry) return Array.isArray(list) ? normalizeHoldList(list) : [];
  const entries = normalizeHoldList(list);
  const at = entries.findIndex((row) => row.id === entry.id);
  if (at >= 0) entries[at] = entry;
  else entries.push(entry);
  return entries;
}

export function removeHold(list, id) {
  const entries = normalizeHoldList(list);
  return entries.filter((entry) => entry.id !== text(id));
}

// The date a hold stops covering: the actual return date once
// ended (early or late), otherwise the expected return date.
function effectiveEndDate(entry) {
  return entry.status === 'ended' ? entry.actualReturnDate : entry.expectedReturnDate;
}

// What one month means for one hold. Returns null for a hold or
// month that is not well-formed. Otherwise:
//   - a month fully inside the hold: the hold's own treatment —
//     no_bill with a zero charge, or retention with exactly the
//     operator-set retention charge and nothing else;
//   - any other month: ordinary, with no charge figure from this
//     module (ordinary months are priced by the billing path,
//     never here).
export function holdMonthTreatment(hold, month) {
  const entry = normalizeHold(hold);
  if (!entry) return null;
  const bounds = monthBounds(month);
  if (!bounds) return null;
  const [first, last] = bounds;
  const end = effectiveEndDate(entry);
  const fullyInside = entry.startDate <= first && last <= end;
  if (!fullyInside) return { month: text(month), treatment: 'ordinary', chargeCents: null, fullyInside: false };
  if (entry.treatment === 'retention') {
    return { month: text(month), treatment: 'retention', chargeCents: entry.retentionCents, fullyInside: true };
  }
  return { month: text(month), treatment: 'no_bill', chargeCents: 0, fullyInside: true };
}

export function holdMonthTreatmentText(result) {
  if (!result) return 'No treatment: the hold or the month is not well-formed.';
  if (!result.fullyInside) return `${result.month}: ordinary billing — the month is not fully inside the hold.`;
  if (result.treatment === 'retention') {
    return `${result.month}: retention charge only — Rs. ${(result.chargeCents / 100).toFixed(2)}, and nothing else.`;
  }
  return `${result.month}: no bill raised for this month.`;
}

// Only an active hold can end, and only with a real return date
// on or after the start date. Ending never rewrites a month
// already given hold treatment: it only shortens the span the
// calculator covers from here on.
export function endHold(list, id, actualReturnDate) {
  const entries = normalizeHoldList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status !== 'active') return entries;
  const moved = normalizeHold({ ...current, status: 'ended', actualReturnDate: actualReturnDate ?? '' });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

// An ended hold can be reopened when the operator recorded the
// wrong outcome; the return date is cleared with it, so a
// reopened hold carries no stale trail.
export function reopenHold(list, id) {
  const entries = normalizeHoldList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status !== 'active') {
    const moved = normalizeHold({ ...current, status: 'active', actualReturnDate: '' });
    if (!moved) return entries;
    entries[at] = moved;
  }
  return entries;
}

function byStartThenId(a, b) {
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function holdsFiltered(list, filters = {}) {
  const entries = normalizeHoldList(list);
  const status = text(filters.status);
  const reason = text(filters.reason);
  const treatment = text(filters.treatment);
  const mohalla = text(filters.mohalla);
  const wantedKey = mohalla === '__unassigned__' ? '__unassigned__' : holdMohallaKey(mohalla);
  return entries
    .filter((entry) => (status ? entry.status === status : true))
    .filter((entry) => (reason ? entry.reason === reason : true))
    .filter((entry) => (treatment ? entry.treatment === treatment : true))
    .filter((entry) => {
      if (!mohalla) return true;
      if (wantedKey === '__unassigned__') return !entry.mohallaKey;
      return entry.mohallaKey === wantedKey;
    })
    .sort(byStartThenId);
}

export function activeHolds(list) {
  return holdsFiltered(list, { status: 'active' });
}

export function buildHoldSummary(list) {
  const entries = normalizeHoldList(list);
  const summary = {
    total: entries.length,
    active: 0,
    ended: 0,
    byReason: {},
    byTreatment: {},
    retentionTotalCents: 0,
  };
  for (const entry of entries) {
    summary[entry.status] += 1;
    summary.byReason[entry.reason] = (summary.byReason[entry.reason] ?? 0) + 1;
    summary.byTreatment[entry.treatment] = (summary.byTreatment[entry.treatment] ?? 0) + 1;
    if (entry.treatment === 'retention') summary.retentionTotalCents += entry.retentionCents;
  }
  return summary;
}

function formatHoldAmount(cents) {
  if (cents === null || cents === undefined) return '—';
  return `Rs. ${(cents / 100).toFixed(2)}`;
}

export function holdSummaryText(summary) {
  if (!summary) return 'No holds recorded.';
  return `${summary.total} hold${summary.total === 1 ? '' : 's'} recorded — ${summary.active} active, ${summary.ended} ended; retention charges set total ${formatHoldAmount(summary.retentionTotalCents)}.`;
}

export function holdHtml(rows) {
  const entries = normalizeHoldList(rows);
  if (entries.length === 0) return '<p class="empty-state">No holds recorded.</p>';
  const body = entries
    .sort(byStartThenId)
    .map((entry) => {
      const charge = entry.treatment === 'retention' ? formatHoldAmount(entry.retentionCents) : 'No bill';
      const returned = entry.status === 'ended' ? ` · returned ${escapeHtml(entry.actualReturnDate)}` : '';
      const request = entry.requestId ? ` · request ${escapeHtml(entry.requestId)}` : '';
      return `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.customerName || entry.customerId)}</td><td>${escapeHtml(entry.startDate)}</td><td>${escapeHtml(entry.expectedReturnDate)}</td><td>${escapeHtml(HOLD_REASON_LABELS[entry.reason])}</td><td>${escapeHtml(HOLD_TREATMENT_LABELS[entry.treatment])} (${escapeHtml(charge)})</td><td>${escapeHtml(HOLD_STATUS_LABELS[entry.status])}${returned}${request}</td></tr>`;
    })
    .join('');
  return `<table><thead><tr><th>Hold</th><th>Customer</th><th>Start</th><th>Expected return</th><th>Reason</th><th>Billing treatment</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function holdCsv(rows) {
  const entries = normalizeHoldList(rows).sort(byStartThenId);
  const lines = ['Hold,Customer,Start,Expected return,Actual return,Reason,Billing treatment,Retention charge,Status,Request id,Mohalla'];
  for (const entry of entries) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.customerName || entry.customerId),
      csvCell(entry.startDate),
      csvCell(entry.expectedReturnDate),
      csvCell(entry.actualReturnDate),
      csvCell(HOLD_REASON_LABELS[entry.reason]),
      csvCell(HOLD_TREATMENT_LABELS[entry.treatment]),
      csvCell(entry.treatment === 'retention' ? formatHoldAmount(entry.retentionCents) : ''),
      csvCell(HOLD_STATUS_LABELS[entry.status]),
      csvCell(entry.requestId),
      csvCell(entry.mohalla),
    ]);
  }
  return lines.join('\n');
}

export function holdFilename() {
  return 'vacation-holds.csv';
}
