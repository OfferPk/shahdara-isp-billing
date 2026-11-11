// Plan 83 (Plan 1-100) — Non-payment suspension record and
// reconnection checklist.
//
// A service stopped for non-payment was remembered as a status
// word, with no record of when it was suspended, how much was
// owed then, or what must happen before it comes back, so
// reconnection was negotiated from scratch each time. This
// module is the suspension record that was missing: one record
// per suspension, linked to the customer profile, with a
// suspension date, a reason (non-payment), the arrears figure at
// suspension, and a reconnection checklist (arrears settled, any
// operator-set reconnection fee recorded through the existing
// payment or fee path, connection checked).
//
// What already existed, checked first (dedup audit, Plans 82/83
// vs Plan U): the SISP suspension shield is flat fields on the
// customer record that protect a customer FROM suspension —
// the opposite of this
// record, and it keeps no suspension date, arrears figure, or
// checklist. The customer service status is only active /
// offline / not-set, and Plan U is lifecycle presentation only:
// it keeps the status story, it never owned a suspension
// record. None of those fields is read or written here: this
// module adds only the dated suspension record and its
// reconnection checklist.
//
// The fences, stated plainly:
//   - The record itself disconnects nothing automatically and
//     creates no charge. Any reconnection fee still goes
//     through its existing payment or fee path; only its
//     reference id is kept here, never a money figure, and
//     this module holds no bill or payment field at all.
//   - Recording or closing a suspension never changes any past
//     bill or payment and never rewrites a customer record —
//     the lifecycle timeline (Plan U) keeps the status story,
//     and this record is only ever linked to it by customer.
//   - The checklist cannot be marked complete while an
//     unchecked item remains, and a customer cannot be
//     reconnected (suspension closed) while the checklist is
//     incomplete: reconnecting needs the checklist complete
//     plus a real reconnection date on or after the
//     suspension date. Closing keeps the full history —
//     date, arrears, checklist, and reconnection date all
//     stay on the record.
//   - Half-formed records are refused outright, never stored
//     half-formed. Dates are strict YYYY-MM-DD calendar dates
//     (2026-02-30 is not a date). Money is integer cents: a
//     *Cents field is already in cents and is used as-is; a
//     plain amount field is rupees and converts at x100 once,
//     so a stored record re-read through the normaliser never
//     inflates a hundredfold. Inputs are never mutated, and
//     the module never reads storage, the clock, or the
//     network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const SUSPENSION_REASONS = ['non_payment'];

export const SUSPENSION_REASON_LABELS = {
  non_payment: 'Non-payment',
};

export const SUSPENSION_STATUSES = ['open', 'closed'];

export const SUSPENSION_STATUS_LABELS = {
  open: 'Open',
  closed: 'Closed',
};

export const CHECKLIST_ITEMS = ['arrears_settled', 'fee_recorded', 'connection_checked'];

export const CHECKLIST_ITEM_LABELS = {
  arrears_settled: 'Arrears settled',
  fee_recorded: 'Reconnection fee recorded through its existing path',
  connection_checked: 'Connection checked',
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
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
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

export function validSuspensionDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

export function suspensionMohallaKey(value) {
  const raw = text(value);
  if (!raw) return null;
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return null;
  const folded = stripped.toLowerCase().replace(/\s+/g, ' ');
  const aliased = MOHALLA_ALIASES[folded.replace(/\s+/g, '')] ?? MOHALLA_ALIASES[folded];
  if (aliased) return aliased;
  return stripped.toUpperCase();
}

function suspensionMohallaLabel(value) {
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
  if (raw.arrearsCents !== undefined && raw.arrearsCents !== null && text(raw.arrearsCents) !== '') {
    return centsField(raw.arrearsCents);
  }
  return rupeesToCents(raw.arrearsAmount);
}

function normalizeChecklist(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const checklist = {};
  for (const item of CHECKLIST_ITEMS) {
    checklist[item] = source[item] === true;
  }
  return checklist;
}

function checklistIsComplete(checklist) {
  return CHECKLIST_ITEMS.every((item) => checklist[item] === true);
}

export function normalizeSuspension(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const suspensionDate = validSuspensionDate(raw.suspensionDate);
  const reason = text(raw.reason);
  const status = text(raw.status);
  if (!id || !customerId) return null;
  if (!suspensionDate) return null;
  if (!SUSPENSION_REASONS.includes(reason)) return null;
  if (!SUSPENSION_STATUSES.includes(status)) return null;
  // The arrears figure at suspension is part of the record:
  // a suspension without a usable figure is half-formed. Zero
  // is a figure (nothing owed at suspension); a missing or
  // non-integer figure is not.
  const arrearsCents = toCents(raw);
  if (arrearsCents === null || arrearsCents < 0) return null;
  const checklist = normalizeChecklist(raw.checklist);
  const checklistComplete = raw.checklistComplete === true && checklistIsComplete(checklist);
  // A closed suspension needs a real reconnection date on or
  // after the suspension date, and a complete checklist: the
  // checklist is what must happen before the service comes
  // back. An open suspension carries no reconnection date.
  let reconnectionDate = '';
  if (status === 'closed') {
    reconnectionDate = validSuspensionDate(raw.reconnectionDate);
    if (!reconnectionDate || reconnectionDate < suspensionDate) return null;
    if (!checklistComplete) return null;
  }
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    suspensionDate,
    reason,
    arrearsCents,
    checklist,
    checklistComplete,
    reconnectionDate,
    feeReference: text(raw.feeReference),
    note: text(raw.note),
    status,
    mohalla: suspensionMohallaLabel(raw.mohalla),
    mohallaKey: suspensionMohallaKey(raw.mohalla),
  };
}

export function normalizeSuspensionList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const row of list) {
    const entry = normalizeSuspension(row);
    if (entry) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

export function findSuspension(list, id) {
  const entries = normalizeSuspensionList(list);
  return entries.find((entry) => entry.id === text(id)) ?? null;
}

export function upsertSuspension(list, record) {
  const entry = normalizeSuspension(record);
  if (!entry) return Array.isArray(list) ? normalizeSuspensionList(list) : [];
  const entries = normalizeSuspensionList(list);
  const at = entries.findIndex((row) => row.id === entry.id);
  if (at >= 0) entries[at] = entry;
  else entries.push(entry);
  return entries;
}

export function removeSuspension(list, id) {
  const entries = normalizeSuspensionList(list);
  return entries.filter((entry) => entry.id !== text(id));
}

// Tick or untick one checklist item on an open suspension.
// Ticking never marks the checklist complete by itself: the
// operator completes it explicitly with completeChecklist, so
// a half-ticked list can never slip through as complete.
export function setChecklistItem(list, id, item, value) {
  const entries = normalizeSuspensionList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status !== 'open') return entries;
  if (!CHECKLIST_ITEMS.includes(text(item))) return entries;
  const moved = normalizeSuspension({
    ...current,
    checklist: { ...current.checklist, [text(item)]: value === true },
    checklistComplete: false,
  });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

// The checklist cannot be marked complete while an unchecked
// item remains: an incomplete list comes back unchanged.
export function completeChecklist(list, id) {
  const entries = normalizeSuspensionList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status !== 'open') return entries;
  if (!checklistIsComplete(current.checklist)) return entries;
  const moved = normalizeSuspension({ ...current, checklistComplete: true });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

// Reconnecting closes the suspension with a date and keeps the
// full history. It needs a complete checklist plus a real
// reconnection date on or after the suspension date; anything
// less leaves the suspension open, never half-closed.
export function reconnectSuspension(list, id, reconnectionDate) {
  const entries = normalizeSuspensionList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status !== 'open') return entries;
  if (!current.checklistComplete) return entries;
  const moved = normalizeSuspension({ ...current, status: 'closed', reconnectionDate: reconnectionDate ?? '' });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

// A closed suspension can be reopened when the operator
// recorded the wrong outcome; the reconnection date and the
// checklist-complete flag clear with it, so a reopened record
// carries no stale trail — but the suspension itself, its
// arrears figure, and its checklist ticks stay.
export function reopenSuspension(list, id) {
  const entries = normalizeSuspensionList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status !== 'open') {
    const moved = normalizeSuspension({ ...current, status: 'open', reconnectionDate: '', checklistComplete: false });
    if (!moved) return entries;
    entries[at] = moved;
  }
  return entries;
}

// Days from suspension to the reconnection date, or to the
// caller-supplied today while still open; null when either
// date is not well-formed. A plain day count, never a claim
// about billing for those days.
export function daysSuspended(entry, today) {
  const record = normalizeSuspension(entry);
  if (!record) return null;
  const end = record.status === 'closed' ? record.reconnectionDate : validSuspensionDate(today);
  if (!end) return null;
  const startMs = Date.UTC(...record.suspensionDate.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)));
  const endMs = Date.UTC(...end.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)));
  const days = Math.round((endMs - startMs) / 86400000);
  return days < 0 ? null : days;
}

function byDateThenId(a, b) {
  if (a.suspensionDate !== b.suspensionDate) return a.suspensionDate < b.suspensionDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function suspensionsFiltered(list, filters = {}) {
  const entries = normalizeSuspensionList(list);
  const status = text(filters.status);
  const reason = text(filters.reason);
  const mohalla = text(filters.mohalla);
  const wantedKey = mohalla === '__unassigned__' ? '__unassigned__' : suspensionMohallaKey(mohalla);
  return entries
    .filter((entry) => (status ? entry.status === status : true))
    .filter((entry) => (reason ? entry.reason === reason : true))
    .filter((entry) => {
      if (!mohalla) return true;
      if (wantedKey === '__unassigned__') return !entry.mohallaKey;
      return entry.mohallaKey === wantedKey;
    })
    .sort(byDateThenId);
}

export function openSuspensions(list) {
  return suspensionsFiltered(list, { status: 'open' });
}

export function buildSuspensionSummary(list) {
  const entries = normalizeSuspensionList(list);
  const summary = {
    total: entries.length,
    open: 0,
    closed: 0,
    checklistComplete: 0,
    arrearsTotalCents: 0,
    openArrearsTotalCents: 0,
  };
  for (const entry of entries) {
    summary[entry.status] += 1;
    if (entry.checklistComplete) summary.checklistComplete += 1;
    summary.arrearsTotalCents += entry.arrearsCents;
    if (entry.status === 'open') summary.openArrearsTotalCents += entry.arrearsCents;
  }
  return summary;
}

function formatSuspensionAmount(cents) {
  if (cents === null || cents === undefined) return '—';
  return `Rs. ${(cents / 100).toFixed(2)}`;
}

export function suspensionSummaryText(summary) {
  if (!summary) return 'No suspensions recorded.';
  return `${summary.total} suspension${summary.total === 1 ? '' : 's'} recorded — ${summary.open} open, ${summary.closed} closed; open arrears at suspension total ${formatSuspensionAmount(summary.openArrearsTotalCents)}.`;
}

function checklistText(entry) {
  return CHECKLIST_ITEMS.map((item) => `${CHECKLIST_ITEM_LABELS[item]}: ${entry.checklist[item] ? 'done' : 'pending'}`).join('; ');
}

export function suspensionHtml(rows) {
  const entries = normalizeSuspensionList(rows);
  if (entries.length === 0) return '<p class="empty-state">No suspensions recorded.</p>';
  const body = entries
    .sort(byDateThenId)
    .map((entry) => {
      const reconnected = entry.status === 'closed' ? ` · reconnected ${escapeHtml(entry.reconnectionDate)}` : '';
      const fee = entry.feeReference ? ` · fee ref ${escapeHtml(entry.feeReference)}` : '';
      return `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.customerName || entry.customerId)}</td><td>${escapeHtml(entry.suspensionDate)}</td><td>${escapeHtml(SUSPENSION_REASON_LABELS[entry.reason])}</td><td>${escapeHtml(formatSuspensionAmount(entry.arrearsCents))}</td><td>${escapeHtml(checklistText(entry))}</td><td>${escapeHtml(SUSPENSION_STATUS_LABELS[entry.status])}${reconnected}${fee}</td></tr>`;
    })
    .join('');
  return `<table><thead><tr><th>Suspension</th><th>Customer</th><th>Suspended</th><th>Reason</th><th>Arrears at suspension</th><th>Reconnection checklist</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function suspensionCsv(rows) {
  const entries = normalizeSuspensionList(rows).sort(byDateThenId);
  const lines = ['Suspension,Customer,Suspended,Reason,Arrears at suspension,Checklist complete,Reconnection date,Fee reference,Status,Mohalla'];
  for (const entry of entries) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.customerName || entry.customerId),
      csvCell(entry.suspensionDate),
      csvCell(SUSPENSION_REASON_LABELS[entry.reason]),
      csvCell(formatSuspensionAmount(entry.arrearsCents)),
      csvCell(entry.checklistComplete ? 'Yes' : 'No'),
      csvCell(entry.reconnectionDate),
      csvCell(entry.feeReference),
      csvCell(SUSPENSION_STATUS_LABELS[entry.status]),
      csvCell(entry.mohalla),
    ]);
  }
  return lines.join('\n');
}

export function suspensionFilename() {
  return 'suspension-records.csv';
}
