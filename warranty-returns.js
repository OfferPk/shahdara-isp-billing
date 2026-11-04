// Plan 80 (Plan 1-100) — Equipment warranty and supplier return (RMA) log.
//
// A faulty ONU sent back to the supplier disappears into an
// untracked wait, so nobody knows its return reference, how long
// it has been away, or whether a replacement ever arrived. This
// module is that record: one return per faulty unit, with exactly
// one serial, one supplier, one reference field, and one status.
//
// The fences, stated plainly:
//   - The log itself creates no purchase, bill, or stock purchase
//     record, and it never changes any bill, payment, or customer
//     record. The stock register (Plan 51) and the connection
//     register (Plan 17) are linked by id only (connectionId,
//     where the operator supplies one). No stock or connection
//     record is read or rewritten here, and no stock count of any
//     kind is held here.
//   - Recording a replacement links the new serial on the same
//     record without deleting the faulty unit's history: the
//     original serial, fault note, supplier, and reference stay
//     on the record, and the record itself is never removed by
//     a status move.
//   - Half-formed records are refused outright, never stored
//     half-formed. Dates are strict YYYY-MM-DD calendar dates
//     (2026-02-30 is not a date). Inputs are never mutated, and
//     the module never reads storage, the clock, or the network.
//     Days-away math always takes today as a caller-supplied date.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const RMA_DEVICE_TYPES = ['onu', 'router', 'other'];

export const RMA_DEVICE_TYPE_LABELS = {
  onu: 'ONU',
  router: 'Router',
  other: 'Other device',
};

export const RMA_STATUSES = ['sent', 'awaiting', 'replaced', 'repaired', 'rejected'];

export const RMA_STATUS_LABELS = {
  sent: 'Sent to supplier',
  awaiting: 'Awaiting decision',
  replaced: 'Replaced',
  repaired: 'Returned repaired',
  rejected: 'Rejected',
};

// Statuses that still have a unit sitting with the supplier.
export const RMA_AWAITING_STATUSES = ['sent', 'awaiting'];

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

export function validRmaDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

function daysBetween(earlier, later) {
  const [y1, m1, d1] = earlier.split('-').map(Number);
  const [y2, m2, d2] = later.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

// One return record, or null when half-formed. The supplier return
// reference (RMA number) is kept where given and null otherwise —
// never guessed. A rejected return must carry its reason, and a
// replaced return must carry its replacement serial; anything else
// is refused outright rather than stored half-formed.
export function normalizeRma(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const serial = text(raw.serial);
  const supplier = text(raw.supplier);
  const deviceType = text(raw.deviceType);
  const status = text(raw.status);
  if (!id || !serial || !supplier) return null;
  if (!RMA_DEVICE_TYPES.includes(deviceType)) return null;
  if (!RMA_STATUSES.includes(status)) return null;
  const dateSent = raw.dateSent === undefined || raw.dateSent === null || raw.dateSent === ''
    ? null
    : validRmaDate(raw.dateSent);
  if (raw.dateSent !== undefined && raw.dateSent !== null && raw.dateSent !== '' && !dateSent) return null;
  const dateReturned = raw.dateReturned === undefined || raw.dateReturned === null || raw.dateReturned === ''
    ? null
    : validRmaDate(raw.dateReturned);
  if (raw.dateReturned !== undefined && raw.dateReturned !== null && raw.dateReturned !== '' && !dateReturned) return null;
  const replacementSerial = text(raw.replacementSerial);
  const rejectionReason = text(raw.rejectionReason);
  if (status === 'replaced' && !replacementSerial) return null;
  if (status === 'rejected' && !rejectionReason) return null;
  return {
    id,
    serial,
    deviceType,
    supplier,
    faultNote: text(raw.faultNote),
    rmaReference: text(raw.rmaReference) || null,
    dateSent,
    status,
    replacementSerial: replacementSerial || null,
    connectionId: text(raw.connectionId) || null,
    rejectionReason: rejectionReason || null,
    dateReturned,
  };
}

export function normalizeRmaList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const raw of rawList) {
    const entry = normalizeRma(raw);
    if (entry) out.push(entry);
  }
  return out;
}

export function findRma(list, id) {
  const entries = normalizeRmaList(list);
  return entries.find((entry) => entry.id === text(id)) ?? null;
}

export function upsertRma(list, record) {
  const entries = normalizeRmaList(list);
  const entry = normalizeRma(record);
  if (!entry) return entries;
  const idx = entries.findIndex((row) => row.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  return entries;
}

export function removeRma(list, id) {
  return normalizeRmaList(list).filter((entry) => entry.id !== text(id));
}

function moveRma(list, id, patch) {
  const entries = normalizeRmaList(list);
  const entry = entries.find((row) => row.id === text(id));
  if (!entry) return entries;
  if (!RMA_AWAITING_STATUSES.includes(entry.status)) return entries;
  const next = normalizeRma({ ...entry, ...patch });
  if (!next) return entries;
  return entries.map((row) => (row.id === entry.id ? next : row));
}

// sent -> awaiting decision. Only a unit still with the supplier
// can move; terminal records stay put.
export function advanceRmaToAwaiting(list, id) {
  const entries = normalizeRmaList(list);
  const entry = entries.find((row) => row.id === text(id));
  if (!entry || entry.status !== 'sent') return entries;
  return entries.map((row) => (row.id === entry.id ? { ...row, status: 'awaiting' } : row));
}

// A replacement links the new serial on the same record; the
// faulty unit's serial, fault note, supplier, and reference stay.
export function markRmaReplaced(list, id, replacementSerial, connectionId, dateReturned) {
  return moveRma(list, id, {
    status: 'replaced',
    replacementSerial: text(replacementSerial),
    connectionId: text(connectionId) || null,
    dateReturned,
  });
}

export function markRmaRepaired(list, id, dateReturned) {
  return moveRma(list, id, {
    status: 'repaired',
    dateReturned,
  });
}

// A rejection must carry its reason, or the move is refused.
export function markRmaRejected(list, id, reason) {
  return moveRma(list, id, { status: 'rejected', rejectionReason: text(reason) });
}

// Reopen returns a terminal record to awaiting decision, clearing
// the replacement serial, rejection reason, and return date, so a
// corrected outcome can be recorded fresh. The record itself —
// serial, fault note, supplier, reference — is never deleted.
export function reopenRma(list, id) {
  const entries = normalizeRmaList(list);
  const entry = entries.find((row) => row.id === text(id));
  if (!entry) return entries;
  if (RMA_AWAITING_STATUSES.includes(entry.status)) return entries;
  return entries.map((row) => (row.id === entry.id
    ? { ...row, status: 'awaiting', replacementSerial: null, rejectionReason: null, dateReturned: null }
    : row));
}

export function rmasFiltered(list, filters = {}) {
  const entries = normalizeRmaList(list);
  const status = text(filters.status);
  const supplier = text(filters.supplier).toLowerCase();
  const deviceType = text(filters.deviceType);
  return entries.filter((entry) => {
    if (status && entry.status !== status) return false;
    if (supplier && !entry.supplier.toLowerCase().includes(supplier)) return false;
    if (deviceType && entry.deviceType !== deviceType) return false;
    return true;
  });
}

// The awaiting list: exactly the units still with the supplier,
// oldest sent first, undated last, each with days away from its
// sent date to the caller-supplied today (null when undated).
export function awaitingRmas(list, today) {
  const todayValid = validRmaDate(today);
  const entries = normalizeRmaList(list)
    .filter((entry) => RMA_AWAITING_STATUSES.includes(entry.status));
  entries.sort((a, b) => {
    if (!a.dateSent && !b.dateSent) return a.id.localeCompare(b.id);
    if (!a.dateSent) return 1;
    if (!b.dateSent) return -1;
    if (a.dateSent !== b.dateSent) return a.dateSent < b.dateSent ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return entries.map((entry) => ({
    ...entry,
    daysAway: entry.dateSent && todayValid ? daysBetween(entry.dateSent, todayValid) : null,
  }));
}

export function buildRmaSummary(list) {
  const entries = normalizeRmaList(list);
  const byStatus = {};
  for (const status of RMA_STATUSES) byStatus[status] = 0;
  for (const entry of entries) byStatus[entry.status] += 1;
  return {
    total: entries.length,
    awaiting: entries.filter((entry) => RMA_AWAITING_STATUSES.includes(entry.status)).length,
    byStatus,
  };
}

export function rmaSummaryText(summary) {
  if (!summary || summary.total === 0) return 'No warranty returns recorded yet.';
  const parts = RMA_STATUSES.filter((status) => summary.byStatus[status] > 0)
    .map((status) => `${summary.byStatus[status]} ${RMA_STATUS_LABELS[status].toLowerCase()}`);
  return `${summary.total} warranty return${summary.total === 1 ? '' : 's'} — ${summary.awaiting} still with the supplier (${parts.join(', ')}).`;
}

export function rmaHtml(entries) {
  const rows = normalizeRmaList(entries);
  if (rows.length === 0) return '<p>No warranty returns recorded yet.</p>';
  const body = rows.map((entry) => {
    const extra = entry.status === 'replaced' && entry.replacementSerial
      ? ` — replacement ${escapeHtml(entry.replacementSerial)}`
      : entry.status === 'rejected' && entry.rejectionReason
        ? ` — ${escapeHtml(entry.rejectionReason)}`
        : '';
    return `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.serial)}</td>`
      + `<td>${escapeHtml(RMA_DEVICE_TYPE_LABELS[entry.deviceType])}</td>`
      + `<td>${escapeHtml(entry.supplier)}</td>`
      + `<td>${escapeHtml(entry.rmaReference ?? 'No reference given')}</td>`
      + `<td>${escapeHtml(entry.dateSent ?? 'Not recorded')}</td>`
      + `<td>${escapeHtml(RMA_STATUS_LABELS[entry.status])}${extra}</td>`
      + `<td>${escapeHtml(entry.faultNote || '')}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>Return</th><th>Serial</th><th>Device</th><th>Supplier</th><th>Reference</th><th>Date sent</th><th>Status</th><th>Fault note</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function rmaCsv(entries) {
  const rows = normalizeRmaList(entries);
  const header = ['id', 'serial', 'device', 'supplier', 'reference', 'date_sent', 'status', 'replacement_serial', 'connection_id', 'rejection_reason', 'date_returned', 'fault_note'];
  const lines = [header.join(',')];
  for (const entry of rows) {
    lines.push([
      entry.id, entry.serial, RMA_DEVICE_TYPE_LABELS[entry.deviceType], entry.supplier,
      entry.rmaReference ?? '', entry.dateSent ?? '', RMA_STATUS_LABELS[entry.status],
      entry.replacementSerial ?? '', entry.connectionId ?? '', entry.rejectionReason ?? '',
      entry.dateReturned ?? '', entry.faultNote,
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function rmaFilename() {
  return 'warranty-returns.csv';
}
