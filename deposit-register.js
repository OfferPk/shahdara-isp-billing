// Plan 77 (Plan 1-100) — Customer equipment deposit register.
//
// An ONU or router supplied with a refundable deposit is tracked
// nowhere as a deposit, so at disconnection nobody can prove how
// much was held, for which device, or whether it was ever
// returned. This module is that record: one deposit per device,
// with exactly one device, one amount, one date, and one status.
//
// The fences, stated plainly:
//   - This register creates no bill, payment, or charge by
//     itself. Any money movement still goes through the existing
//     payment or concession path; a refunded deposit only stores
//     the id of the payment or concession that returned it — the
//     payment or concession row itself is never read or written
//     here, and the stored id is never a payment row.
//   - It does not duplicate the deposit handling that already
//     exists: the customer's single security-deposit amount, the
//     active deposit offset against bills (Plan P presentation,
//     deposit-to-bill-offset), and the disconnection clearance
//     settlement are money paths of their own. None of those
//     fields is read or written here — this register adds what
//     was missing, the per-device record (which device, which
//     serial, how much was held for it, and what happened to it).
//   - The connection register (Plan 17) is linked by id only
//     (connectionId, where the operator supplies one). No
//     connection record is read or rewritten here.
//   - A deposit amount is held money in integer cents. A
//     refunded deposit needs its returning payment/concession
//     id; an applied deposit needs the operator-recorded reason.
//     Half-formed records are refused outright, never stored
//     half-formed. Dates are strict YYYY-MM-DD calendar dates
//     (2026-02-30 is not a date). Inputs are never mutated, and
//     the module never reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DEPOSIT_DEVICE_TYPES = ['onu', 'router', 'other'];

export const DEPOSIT_DEVICE_TYPE_LABELS = {
  onu: 'ONU',
  router: 'Router',
  other: 'Other device',
};

export const DEPOSIT_STATUSES = ['held', 'refunded', 'applied'];

export const DEPOSIT_STATUS_LABELS = {
  held: 'Held',
  refunded: 'Refunded',
  applied: 'Applied',
};

const MOHALLA_ALIASES = {
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
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

export function validDepositDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

// A deposit amount must be a positive figure. Blank strings,
// booleans, non-finite values, zero, and negatives are all
// unusable — never silently treated as zero. A field named
// *Cents is already in cents and is used as-is; a plain amount
// field is rupees and converts at x100, so a stored record
// re-read through this normaliser never inflates a hundredfold.
function centsField(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) return null;
  return num;
}

function rupeesToCents(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  const cents = Math.round(num * 100);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return cents;
}

function toCents(raw) {
  if (raw.amountCents !== undefined && raw.amountCents !== null && text(raw.amountCents) !== '') {
    return centsField(raw.amountCents);
  }
  return rupeesToCents(raw.amount);
}

export function formatDepositAmount(cents) {
  if (!Number.isFinite(cents)) return 'not recorded';
  // Owner 5-part fix: whole rupees without decimals, with thousands
  // grouping (Rs. 6,000, not Rs. 6000.00).
  return `Rs. ${(cents / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Canonical mohalla key for filtering, mirroring the Plan T rule
// as the other pure modules do: a leading "Mohalla" is stripped,
// case and whitespace are folded, and the known aliases apply.
// Anything else keeps its own folded label, never rewritten.
export function depositMohallaKey(value) {
  const raw = text(value);
  if (!raw) return null;
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return null;
  const folded = stripped.toLowerCase().replace(/\s+/g, ' ');
  const aliased = MOHALLA_ALIASES[folded.replace(/\s+/g, '')] ?? MOHALLA_ALIASES[folded];
  if (aliased) return aliased;
  return stripped.toUpperCase();
}

function depositMohallaLabel(value) {
  const raw = text(value);
  if (!raw) return '';
  return raw.replace(/^mohalla\s+/i, '').trim();
}

export function normalizeDeposit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const deviceType = text(raw.deviceType);
  const serial = text(raw.serial);
  const amountCents = toCents(raw);
  const dateTaken = validDepositDate(raw.dateTaken);
  const status = text(raw.status);
  if (!id || !customerId) return null;
  if (!DEPOSIT_DEVICE_TYPES.includes(deviceType)) return null;
  if (!serial) return null;
  if (amountCents === null) return null;
  if (!dateTaken) return null;
  if (!DEPOSIT_STATUSES.includes(status)) return null;
  const linkedId = text(raw.linkedId);
  const reason = text(raw.reason);
  // A refunded deposit must name the payment or concession that
  // returned it; an applied deposit must carry the operator's
  // reason. Anything else is half-formed and refused.
  if (status === 'refunded' && !linkedId) return null;
  if (status === 'applied' && !reason) return null;
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    connectionId: text(raw.connectionId),
    deviceType,
    serial,
    amountCents,
    dateTaken,
    status,
    linkedId: status === 'refunded' ? linkedId : '',
    reason: status === 'applied' ? reason : '',
    mohalla: depositMohallaLabel(raw.mohalla),
    mohallaKey: depositMohallaKey(raw.mohalla),
  };
}

export function normalizeDepositList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const row of list) {
    const entry = normalizeDeposit(row);
    if (entry) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

export function findDeposit(list, id) {
  const entries = normalizeDepositList(list);
  return entries.find((entry) => entry.id === text(id)) ?? null;
}

export function upsertDeposit(list, record) {
  const entry = normalizeDeposit(record);
  if (!entry) return Array.isArray(list) ? normalizeDepositList(list) : [];
  const entries = normalizeDepositList(list);
  const at = entries.findIndex((row) => row.id === entry.id);
  if (at >= 0) entries[at] = entry;
  else entries.push(entry);
  return entries;
}

export function removeDeposit(list, id) {
  const entries = normalizeDepositList(list);
  return entries.filter((entry) => entry.id !== text(id));
}

function moveDeposit(list, id, next) {
  const entries = normalizeDepositList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status !== 'held') return entries;
  const moved = normalizeDeposit({ ...current, ...next });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

// Only a held deposit can be refunded, and only with the id of
// the payment or concession that returned it.
export function markDepositRefunded(list, id, linkedId) {
  if (!text(linkedId)) return normalizeDepositList(list);
  return moveDeposit(list, id, { status: 'refunded', linkedId: text(linkedId), reason: '' });
}

// Only a held deposit can be applied, and only with the
// operator-recorded reason for applying it.
export function markDepositApplied(list, id, reason) {
  if (!text(reason)) return normalizeDepositList(list);
  return moveDeposit(list, id, { status: 'applied', reason: text(reason), linkedId: '' });
}

// A refunded or applied deposit can be reopened to held when the
// operator recorded the wrong outcome; the link and reason are
// cleared with it, so a reopened deposit carries no stale trail.
export function reopenDeposit(list, id) {
  const entries = normalizeDepositList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status === 'held') return entries;
  const moved = normalizeDeposit({ ...current, status: 'held', linkedId: '', reason: '' });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

function byDateThenId(a, b) {
  if (a.dateTaken !== b.dateTaken) return a.dateTaken < b.dateTaken ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function depositsFiltered(list, filters = {}) {
  const entries = normalizeDepositList(list);
  const status = text(filters.status);
  const deviceType = text(filters.deviceType);
  const mohalla = text(filters.mohalla);
  const wantedKey = mohalla === '__unassigned__' ? '__unassigned__' : depositMohallaKey(mohalla);
  return entries
    .filter((entry) => (status ? entry.status === status : true))
    .filter((entry) => (deviceType ? entry.deviceType === deviceType : true))
    .filter((entry) => {
      if (!mohalla) return true;
      if (wantedKey === '__unassigned__') return !entry.mohallaKey;
      return entry.mohallaKey === wantedKey;
    })
    .sort(byDateThenId);
}

export function heldDeposits(list, filters = {}) {
  return depositsFiltered(list, { ...filters, status: 'held' });
}

export function buildDepositSummary(list) {
  const entries = normalizeDepositList(list);
  const summary = {
    total: entries.length,
    held: 0,
    refunded: 0,
    applied: 0,
    totalHeldCents: 0,
    totalRefundedCents: 0,
    totalAppliedCents: 0,
    byDeviceType: {},
  };
  for (const entry of entries) {
    summary[entry.status] += 1;
    if (entry.status === 'held') summary.totalHeldCents += entry.amountCents;
    if (entry.status === 'refunded') summary.totalRefundedCents += entry.amountCents;
    if (entry.status === 'applied') summary.totalAppliedCents += entry.amountCents;
    summary.byDeviceType[entry.deviceType] = (summary.byDeviceType[entry.deviceType] ?? 0) + 1;
  }
  return summary;
}

export function depositSummaryText(summary) {
  if (!summary) return 'No deposits recorded.';
  return `${summary.total} deposit${summary.total === 1 ? '' : 's'} recorded — ${summary.held} held (${formatDepositAmount(summary.totalHeldCents)}), ${summary.refunded} refunded, ${summary.applied} applied.`;
}

export function depositHtml(rows) {
  const entries = normalizeDepositList(rows);
  if (entries.length === 0) return '<p class="empty-state">No deposits recorded.</p>';
  const body = entries
    .sort(byDateThenId)
    .map((entry) => {
      const extra = entry.status === 'refunded'
        ? ` · returned via ${escapeHtml(entry.linkedId)}`
        : entry.status === 'applied'
          ? ` · applied: ${escapeHtml(entry.reason)}`
          : '';
      return `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.customerName || entry.customerId)}</td><td>${escapeHtml(DEPOSIT_DEVICE_TYPE_LABELS[entry.deviceType])}</td><td>${escapeHtml(entry.serial)}</td><td>${formatDepositAmount(entry.amountCents)}</td><td>${escapeHtml(entry.dateTaken)}</td><td>${escapeHtml(DEPOSIT_STATUS_LABELS[entry.status])}${extra}</td></tr>`;
    })
    .join('');
  // Owner 5-part fix: the seven-column table scrolls inside its own
  // card on a phone instead of clipping the right-side columns.
  return `<div class="table-scroll"><table><thead><tr><th>Deposit</th><th>Customer</th><th>Device</th><th>Serial</th><th>Amount held</th><th>Date taken</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export function depositCsv(rows) {
  const entries = normalizeDepositList(rows).sort(byDateThenId);
  const lines = ['Deposit,Customer,Device,Serial,Amount,Date taken,Status,Linked id,Reason,Mohalla'];
  for (const entry of entries) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.customerName || entry.customerId),
      csvCell(DEPOSIT_DEVICE_TYPE_LABELS[entry.deviceType]),
      csvCell(entry.serial),
      csvCell(formatDepositAmount(entry.amountCents)),
      csvCell(entry.dateTaken),
      csvCell(DEPOSIT_STATUS_LABELS[entry.status]),
      csvCell(entry.linkedId),
      csvCell(entry.reason),
      csvCell(entry.mohalla),
    ].join(','));
  }
  return lines.join('\n');
}

export function depositFilename() {
  return 'deposit-register.csv';
}
