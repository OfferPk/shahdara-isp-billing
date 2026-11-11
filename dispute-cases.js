// Plan 61 (Plan 1-100) — Billing dispute case log.
//
// A customer who says "this bill is wrong" has no case of their own,
// so the complaint is chased in chat history and its outcome is never
// recorded. This module is that case log: one case per disputed bill,
// with a disputed amount, one reason from a short list, one status,
// and an evidence note (a receipt or TID the customer showed).
//
// The fences, stated plainly:
//   - Fault tickets (Plan 21) stay for service faults. This log is
//     for money disputes only, and it never reads or writes a ticket.
//   - Any correction or concession still goes through its existing
//     path (Plan K), never through the case itself. Creating,
//     updating, or closing a case never changes any bill, payment,
//     or Waada record — the module holds no bill total, payment
//     row, or Waada field, only the disputed amount the customer
//     named and the case's own outcome text.
//   - A case cannot be marked resolved without a recorded outcome:
//     a resolved case with no outcome is refused outright, so a
//     "resolved" case can never hide an unwritten answer.
//
// Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is not a
// date). Amounts are summed in integer cents, so no float drift.
// Inputs are never mutated, and the module never reads storage,
// the clock, or the network. Mohalla filtering mirrors the Plan T
// canonical rule as the other pure modules do: a leading "Mohalla"
// is stripped, matching is case-insensitive, and the aliases
// bani -> BANII, kishti -> KISHTII, chamyaa -> CHAMYAAA apply;
// anything else keeps its own label, never rewritten.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DISPUTE_REASONS = [
  'wrong_amount',
  'double_charge',
  'payment_not_credited',
  'package_change_timing',
  'fee_not_agreed',
  'other',
];

export const DISPUTE_REASON_LABELS = {
  wrong_amount: 'Wrong amount',
  double_charge: 'Double charge',
  payment_not_credited: 'Payment not credited',
  package_change_timing: 'Package-change timing',
  fee_not_agreed: 'Fee not agreed',
  other: 'Other',
};

export const DISPUTE_STATUSES = [
  'open',
  'investigating',
  'resolved',
  'escalated',
];

export const DISPUTE_STATUS_LABELS = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
  escalated: 'Escalated to owner',
};

// Open cases are every case that is not resolved: open,
// investigating, and escalated. A resolved case is history.
export const DISPUTE_OPEN_STATUSES = ['open', 'investigating', 'escalated'];

const MOHALLA_ALIASES = {
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

function toCents(amount) {
  if (typeof amount === 'boolean' || amount === null || amount === undefined) return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function fromCents(cents) {
  return cents / 100;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validDisputeDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

// Canonical mohalla key for filtering: strip a leading "Mohalla",
// fold case and whitespace, apply the known aliases. Anything else
// keeps its own folded label, never rewritten.
export function disputeMohallaKey(value) {
  const raw = text(value);
  if (!raw) return null;
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return null;
  const folded = stripped.toLowerCase().replace(/\s+/g, ' ');
  const aliased = MOHALLA_ALIASES[folded.replace(/\s+/g, '')] ?? MOHALLA_ALIASES[folded];
  if (aliased) return aliased;
  return stripped.toUpperCase();
}

function disputeMohallaLabel(value) {
  const raw = text(value);
  if (!raw) return '';
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  return stripped;
}

// One normalised case, or null when the record is half-formed.
// A resolved case with no outcome is half-formed: it is refused,
// never stored as "resolved" with a blank answer.
export function normalizeDisputeCase(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const billId = text(raw.billId);
  if (!id || !customerId || !billId) return null;
  const amountCents = toCents(raw.disputedAmount ?? raw.amount);
  if (amountCents === null) return null;
  const reason = text(raw.reason).toLowerCase().replace(/[\s-]+/g, '_');
  if (!DISPUTE_REASONS.includes(reason)) return null;
  const status = text(raw.status).toLowerCase().replace(/[\s-]+/g, '_');
  if (!DISPUTE_STATUSES.includes(status)) return null;
  const outcome = text(raw.outcome);
  if (status === 'resolved' && !outcome) return null;
  const dateOpened = validDisputeDate(raw.dateOpened ?? raw.date);
  const mohalla = disputeMohallaLabel(raw.mohalla ?? raw.area);
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    billId,
    billMonth: text(raw.billMonth),
    disputedAmount: fromCents(amountCents),
    disputedAmountCents: amountCents,
    reason,
    status,
    evidenceNote: text(raw.evidenceNote ?? raw.evidence),
    outcome: outcome || null,
    dateOpened,
    mohalla,
    mohallaKey: disputeMohallaKey(mohalla),
  };
}

export function normalizeDisputeCaseList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const item = normalizeDisputeCase(raw);
    if (item) out.push(item);
  }
  return out;
}

// Upsert: a second case with the same id replaces the first, so a
// case id never carries two cases. A half-formed record leaves the
// list unchanged.
export function upsertDisputeCase(list, raw) {
  const item = normalizeDisputeCase(raw);
  const base = normalizeDisputeCaseList(list);
  if (!item) return base;
  const next = base.filter((entry) => entry.id !== item.id);
  next.push(item);
  return next;
}

export function removeDisputeCase(list, id) {
  const key = text(id);
  if (!key) return normalizeDisputeCaseList(list);
  return normalizeDisputeCaseList(list).filter((entry) => entry.id !== key);
}

export function findDisputeCase(list, id) {
  const key = text(id);
  if (!key) return null;
  return normalizeDisputeCaseList(list).find((entry) => entry.id === key) ?? null;
}

// Status machine. Resolved is terminal: a resolved case never moves
// back to open, investigating, or escalated. A move to resolved
// without an outcome is refused, and any illegal move leaves the
// list unchanged.
const DISPUTE_TRANSITIONS = {
  open: ['investigating', 'escalated', 'resolved'],
  investigating: ['open', 'escalated', 'resolved'],
  escalated: ['investigating', 'resolved'],
  resolved: [],
};

export function setDisputeStatus(list, id, status, outcome) {
  const base = normalizeDisputeCaseList(list);
  const target = text(status).toLowerCase().replace(/[\s-]+/g, '_');
  if (!DISPUTE_STATUSES.includes(target)) return base;
  const index = base.findIndex((entry) => entry.id === text(id));
  if (index === -1) return base;
  const current = base[index];
  if (!DISPUTE_TRANSITIONS[current.status].includes(target)) return base;
  const nextOutcome = text(outcome ?? current.outcome);
  if (target === 'resolved' && !nextOutcome) return base;
  const next = [...base];
  next[index] = {
    ...current,
    status: target,
    outcome: target === 'resolved' ? nextOutcome : current.outcome,
  };
  return next;
}

// Open cases only (open, investigating, escalated), filterable by
// status, reason, and mohalla. Mohalla filtering matches the
// canonical key when either side carries one, else the folded
// label; a customer with no mohalla is never dropped by a blank
// filter, and the "__unassigned__" filter matches exactly those.
export function openDisputeCases(list, filters = {}) {
  const base = normalizeDisputeCaseList(list);
  const statusFilter = text(filters.status).toLowerCase().replace(/[\s-]+/g, '_');
  const reasonFilter = text(filters.reason).toLowerCase().replace(/[\s-]+/g, '_');
  const mohallaFilterRaw = text(filters.mohalla);
  const mohallaFilterKey = mohallaFilterRaw === '__unassigned__' ? '__unassigned__' : disputeMohallaKey(mohallaFilterRaw);
  const rows = base.filter((entry) => {
    if (!DISPUTE_OPEN_STATUSES.includes(entry.status)) return false;
    if (statusFilter && entry.status !== statusFilter) return false;
    if (reasonFilter && entry.reason !== reasonFilter) return false;
    if (mohallaFilterKey) {
      if (mohallaFilterKey === '__unassigned__') {
        if (entry.mohallaKey) return false;
      } else if (entry.mohallaKey !== mohallaFilterKey) {
        return false;
      }
    }
    return true;
  });
  rows.sort((a, b) => {
    if (a.dateOpened && b.dateOpened && a.dateOpened !== b.dateOpened) return a.dateOpened < b.dateOpened ? -1 : 1;
    if (a.dateOpened && !b.dateOpened) return -1;
    if (!a.dateOpened && b.dateOpened) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return rows;
}

export function buildDisputeSummary(list) {
  const base = normalizeDisputeCaseList(list);
  const byStatus = {};
  const byReason = {};
  for (const status of DISPUTE_STATUSES) byStatus[status] = 0;
  for (const reason of DISPUTE_REASONS) byReason[reason] = 0;
  let openCount = 0;
  let resolvedCount = 0;
  let totalDisputedCents = 0;
  for (const entry of base) {
    byStatus[entry.status] += 1;
    byReason[entry.reason] += 1;
    totalDisputedCents += entry.disputedAmountCents;
    if (entry.status === 'resolved') resolvedCount += 1;
    else openCount += 1;
  }
  return {
    total: base.length,
    open: openCount,
    resolved: resolvedCount,
    byStatus,
    byReason,
    totalDisputed: fromCents(totalDisputedCents),
    totalDisputedCents,
  };
}

export function disputeSummaryText(summary) {
  if (!summary) return '';
  const parts = [`${summary.total} dispute case${summary.total === 1 ? '' : 's'}: ${summary.open} open, ${summary.resolved} resolved`];
  parts.push(`total disputed Rs. ${summary.totalDisputed}`);
  return parts.join('. ') + '.';
}

function disputeRowHtml(entry) {
  const name = entry.customerName ? `${escapeHtml(entry.customerName)} (${escapeHtml(entry.customerId)})` : escapeHtml(entry.customerId);
  return `<tr><td>${escapeHtml(entry.id)}</td><td>${name}</td><td>${escapeHtml(entry.billId)}</td><td>Rs. ${entry.disputedAmount}</td><td>${escapeHtml(DISPUTE_REASON_LABELS[entry.reason])}</td><td>${escapeHtml(DISPUTE_STATUS_LABELS[entry.status])}</td><td>${escapeHtml(entry.mohalla || 'Not recorded')}</td><td>${escapeHtml(entry.dateOpened || 'Not recorded')}</td><td>${escapeHtml(entry.evidenceNote || '')}</td><td>${escapeHtml(entry.outcome || '')}</td></tr>`;
}

export function disputeHtml(list) {
  const rows = normalizeDisputeCaseList(list);
  if (rows.length === 0) return '<p style="font-size: 12px;">No dispute cases recorded.</p>';
  return `<table class="data-table"><thead><tr><th>Case</th><th>Customer</th><th>Bill</th><th>Disputed</th><th>Reason</th><th>Status</th><th>Mohalla</th><th>Opened</th><th>Evidence</th><th>Outcome</th></tr></thead><tbody>${rows.map(disputeRowHtml).join('')}</tbody></table>`;
}

export function disputeCsv(list) {
  const rows = normalizeDisputeCaseList(list);
  const header = ['id', 'customerId', 'customerName', 'billId', 'billMonth', 'disputedAmount', 'reason', 'status', 'mohalla', 'dateOpened', 'evidenceNote', 'outcome'].map(csvCell).join(',');
  const lines = rows.map((entry) => [entry.id, entry.customerId, entry.customerName, entry.billId, entry.billMonth, entry.disputedAmount, entry.reason, entry.status, entry.mohalla, entry.dateOpened, entry.evidenceNote, entry.outcome].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function disputeFilename() {
  return 'dispute-cases.csv';
}
