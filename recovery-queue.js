// Plan 81 (Plan 1-100) — End-of-service equipment recovery queue.
//
// When a customer leaves, their ISP-owned unit often stays in the
// house because no list tells the collector which departed
// households still hold equipment. This module is that list: it is
// built from departed customers (exit log, Plan 57) who still hold
// ISP-owned equipment per the connection register (Plan 17), one
// entry per device, ordered by time since service ended.
//
// The fences, stated plainly:
//   - The queue itself creates no charge, bill, or payment, and
//     queue actions never alter any bill, payment, or
//     departed-customer record. Plans 57 and 17 are read as
//     caller-supplied input and never rewritten; a recovery visit
//     is recorded through the field-visit flow (Plan 2) and only
//     its id is kept here, never the visit itself; any deposit
//     outcome is decided separately in the deposit register
//     (Plan 77), never here.
//   - Marking a device collected removes that household from the
//     queue and keeps the collection date and collector on the
//     record. A not-returned case keeps its reason visible and
//     never silently closes: it stays in the queue until the
//     device is collected or the record is reopened.
//   - Half-formed records are refused outright, never stored
//     half-formed. Dates are strict YYYY-MM-DD calendar dates
//     (2026-02-30 is not a date). Inputs are never mutated, and
//     the module never reads storage, the clock, or the network.
//     Days-since-ended math always takes today as a
//     caller-supplied date.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const RECOVERY_STATUSES = ['pending', 'collected', 'not_returned'];

export const RECOVERY_STATUS_LABELS = {
  pending: 'Pending collection',
  collected: 'Collected',
  not_returned: 'Not returned',
};

export const RECOVERY_DEVICE_TYPES = ['onu', 'router', 'other'];

export const RECOVERY_DEVICE_TYPE_LABELS = {
  onu: 'ONU',
  router: 'Router',
  other: 'Other device',
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

export function validRecoveryDate(value) {
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

export function canonicalRecoveryMohalla(value) {
  const raw = text(value);
  if (!raw) return { key: '__unassigned__', label: 'Unassigned' };
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return { key: '__unassigned__', label: 'Unassigned' };
  const lower = stripped.toLowerCase();
  const alias = MOHALLA_ALIASES[lower];
  if (alias) return { key: alias, label: alias };
  return { key: lower, label: stripped };
}

// Owner 5-part fix: the mohalla cell reads in consistent Title Case,
// so a stored 'CHARYAA' and a stored 'Charyaa' read the same; the
// folded JABBIYAAA spelling reads as its canonical 'Jabbiyaa'.
// (Stored values are untouched — only the display is normalised.)
function displayMohalla(value) {
  const raw = text(value);
  if (!raw) return '';
  if (canonicalRecoveryMohalla(value).key === 'JABBIYAA') return 'Jabbiyaa';
  return raw.split(/\s+/).map((word) => {
    const chars = Array.from(word);
    if (!chars.length) return word;
    // Same rule as phase3's readableLabel: a 2–3-letter all-caps
    // word (an acronym or a short label such as 'X<Y') keeps its
    // own casing instead of being forced to Title Case.
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  }).join(' ');
}

// One recovery record, or null when half-formed. The id defaults
// to customerId|serial when the caller supplies no id, so a queue
// entry and its status record are always the same record. A
// collected record must carry its collection date and collector;
// a not-returned record must carry its reason; anything else is
// refused outright rather than stored half-formed.
export function normalizeRecovery(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const customerId = text(raw.customerId);
  const serial = text(raw.serial);
  const deviceType = text(raw.deviceType);
  const status = text(raw.status);
  if (!customerId || !serial) return null;
  if (!RECOVERY_DEVICE_TYPES.includes(deviceType)) return null;
  if (!RECOVERY_STATUSES.includes(status)) return null;
  const id = text(raw.id) || `${customerId}|${serial}`;
  const dateEnded = raw.dateEnded === undefined || raw.dateEnded === null || raw.dateEnded === ''
    ? null
    : validRecoveryDate(raw.dateEnded);
  if (raw.dateEnded !== undefined && raw.dateEnded !== null && raw.dateEnded !== '' && !dateEnded) return null;
  const collectedDate = raw.collectedDate === undefined || raw.collectedDate === null || raw.collectedDate === ''
    ? null
    : validRecoveryDate(raw.collectedDate);
  if (raw.collectedDate !== undefined && raw.collectedDate !== null && raw.collectedDate !== '' && !collectedDate) return null;
  const collector = text(raw.collector);
  const reason = text(raw.reason);
  if (status === 'collected' && (!collectedDate || !collector)) return null;
  if (status === 'not_returned' && !reason) return null;
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    mohalla: text(raw.mohalla),
    serial,
    deviceType,
    dateEnded,
    status,
    collectedDate,
    collector: collector || null,
    reason: reason || null,
    visitId: text(raw.visitId) || null,
    exitReason: text(raw.exitReason) || null,
  };
}

export function normalizeRecoveryList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of rawList) {
    const entry = normalizeRecovery(raw);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

export function findRecovery(list, id) {
  const entries = normalizeRecoveryList(list);
  return entries.find((entry) => entry.id === text(id)) ?? null;
}

export function upsertRecovery(list, record) {
  const entries = normalizeRecoveryList(list);
  const entry = normalizeRecovery(record);
  if (!entry) return entries;
  const idx = entries.findIndex((row) => row.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  return entries;
}

export function removeRecovery(list, id) {
  return normalizeRecoveryList(list).filter((entry) => entry.id !== text(id));
}

function moveRecovery(list, id, patch) {
  const entries = normalizeRecoveryList(list);
  const entry = entries.find((row) => row.id === text(id));
  if (!entry) return entries;
  if (entry.status !== 'pending') return entries;
  const next = normalizeRecovery({ ...entry, ...patch });
  if (!next) return entries;
  return entries.map((row) => (row.id === entry.id ? next : row));
}

// Marking a device collected removes it from the queue and keeps
// the collection date and collector on the record. Only a pending
// entry can be collected; a visit id, where the operator supplies
// one, is kept as a link to the field-visit flow, never the visit.
export function markRecoveryCollected(list, id, collectedDate, collector, visitId) {
  return moveRecovery(list, id, {
    status: 'collected',
    collectedDate,
    collector: text(collector),
    visitId: text(visitId) || null,
  });
}

// A not-returned case keeps its reason visible and stays in the
// queue; it never silently closes.
export function markRecoveryNotReturned(list, id, reason) {
  return moveRecovery(list, id, { status: 'not_returned', reason: text(reason) });
}

// Reopen returns a collected or not-returned record to pending,
// clearing the collection date, collector, reason, and visit link,
// so the device can be chased again. The record itself — customer,
// serial, date ended — is never deleted.
export function reopenRecovery(list, id) {
  const entries = normalizeRecoveryList(list);
  const entry = entries.find((row) => row.id === text(id));
  if (!entry) return entries;
  if (entry.status === 'pending') return entries;
  return entries.map((row) => (row.id === entry.id
    ? { ...row, status: 'pending', collectedDate: null, collector: null, reason: null, visitId: null }
    : row));
}

// The queue: exactly the departed customers with unreturned
// ISP-owned equipment, one entry per device, ordered by time
// since service ended (oldest ended first, undated last, then
// name A–Z). A customer-owned device (ispOwned false) is never
// queued; a device with no serial is never queued, never guessed.
// Collected devices leave the queue; pending and not-returned
// devices stay, the latter with their reason visible.
export function buildRecoveryQueue(input = {}) {
  const departed = Array.isArray(input.departed) ? input.departed : [];
  const equipment = Array.isArray(input.equipment) ? input.equipment : [];
  const recoveries = normalizeRecoveryList(input.recoveries);
  const todayValid = validRecoveryDate(input.today);
  const byCustomer = new Map();
  for (const raw of departed) {
    if (!raw || typeof raw !== 'object') continue;
    const customerId = text(raw.customerId);
    if (!customerId || byCustomer.has(customerId)) continue;
    const dateEnded = raw.dateEnded === undefined || raw.dateEnded === null || raw.dateEnded === ''
      ? null
      : validRecoveryDate(raw.dateEnded);
    if (raw.dateEnded !== undefined && raw.dateEnded !== null && raw.dateEnded !== '' && !dateEnded) continue;
    byCustomer.set(customerId, {
      customerId,
      customerName: text(raw.customerName),
      mohalla: text(raw.mohalla),
      dateEnded,
      exitReason: text(raw.exitReason) || null,
    });
  }
  const recoveryByKey = new Map();
  for (const entry of recoveries) recoveryByKey.set(`${entry.customerId}|${entry.serial}`, entry);
  const queue = [];
  for (const raw of equipment) {
    if (!raw || typeof raw !== 'object') continue;
    const customerId = text(raw.customerId);
    const serial = text(raw.serial);
    if (!customerId || !serial) continue;
    if (raw.ispOwned === false) continue;
    const holder = byCustomer.get(customerId);
    if (!holder) continue;
    const recovery = recoveryByKey.get(`${customerId}|${serial}`);
    if (recovery && recovery.status === 'collected') continue;
    const deviceType = RECOVERY_DEVICE_TYPES.includes(text(raw.deviceType)) ? text(raw.deviceType) : 'other';
    queue.push({
      id: recovery ? recovery.id : `${customerId}|${serial}`,
      customerId,
      customerName: holder.customerName || text(raw.customerName),
      mohalla: holder.mohalla || text(raw.mohalla),
      serial,
      deviceType,
      dateEnded: holder.dateEnded,
      status: recovery ? recovery.status : 'pending',
      daysSinceEnded: holder.dateEnded && todayValid ? daysBetween(holder.dateEnded, todayValid) : null,
      collectedDate: recovery ? recovery.collectedDate : null,
      collector: recovery ? recovery.collector : null,
      reason: recovery ? recovery.reason : null,
      visitId: recovery ? recovery.visitId : null,
      exitReason: holder.exitReason,
    });
  }
  queue.sort((a, b) => {
    if (!a.dateEnded && !b.dateEnded) return (a.customerName || a.customerId).localeCompare(b.customerName || b.customerId) || a.serial.localeCompare(b.serial);
    if (!a.dateEnded) return 1;
    if (!b.dateEnded) return -1;
    if (a.dateEnded !== b.dateEnded) return a.dateEnded < b.dateEnded ? -1 : 1;
    return (a.customerName || a.customerId).localeCompare(b.customerName || b.customerId) || a.serial.localeCompare(b.serial);
  });
  return queue;
}

export function recoveryQueueFiltered(queue, filters = {}) {
  const entries = Array.isArray(queue) ? queue : [];
  const status = text(filters.status);
  const mohalla = text(filters.mohalla);
  return entries.filter((entry) => {
    if (status && entry.status !== status) return false;
    if (mohalla) {
      if (mohalla === '__unassigned__') {
        if (canonicalRecoveryMohalla(entry.mohalla).key !== '__unassigned__') return false;
      } else if (canonicalRecoveryMohalla(entry.mohalla).key !== canonicalRecoveryMohalla(mohalla).key) return false;
    }
    return true;
  });
}

export function buildRecoverySummary(queue, recoveries) {
  const queued = Array.isArray(queue) ? queue : [];
  const stored = normalizeRecoveryList(recoveries);
  return {
    queued: queued.length,
    pending: queued.filter((entry) => entry.status === 'pending').length,
    notReturned: queued.filter((entry) => entry.status === 'not_returned').length,
    collected: stored.filter((entry) => entry.status === 'collected').length,
    total: stored.length,
  };
}

export function recoverySummaryText(summary) {
  if (!summary || summary.total === 0) return 'No equipment recovery records yet.';
  if (summary.queued === 0) return 'No unreturned equipment in the queue — every recorded device is collected.';
  const parts = [];
  if (summary.pending > 0) parts.push(`${summary.pending} pending collection`);
  if (summary.notReturned > 0) parts.push(`${summary.notReturned} not returned, reason recorded`);
  return `${summary.queued} device${summary.queued === 1 ? '' : 's'} still to recover (${parts.join(', ')}).`;
}

export function recoveryHtml(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  if (rows.length === 0) return '<p>No unreturned equipment in the queue.</p>';
  const body = rows.map((entry) => {
    const extra = entry.status === 'not_returned' && entry.reason
      ? ` — ${escapeHtml(entry.reason)}`
      : entry.status === 'collected' && entry.collector
        ? ` — collected by ${escapeHtml(entry.collector)}${entry.collectedDate ? ` on ${escapeHtml(entry.collectedDate)}` : ''}`
        : '';
    return `<tr><td>${escapeHtml(entry.customerName || entry.customerId)}</td>`
      + `<td>${escapeHtml(displayMohalla(entry.mohalla) || 'Not recorded')}</td>`
      + `<td>${escapeHtml(entry.serial)}</td>`
      + `<td>${escapeHtml(RECOVERY_DEVICE_TYPE_LABELS[entry.deviceType] ?? entry.deviceType)}</td>`
      + `<td>${escapeHtml(entry.dateEnded ?? 'Not recorded')}</td>`
      + `<td>${entry.daysSinceEnded === null || entry.daysSinceEnded === undefined ? 'Not recorded' : `${entry.daysSinceEnded} days`}</td>`
      + `<td>${escapeHtml(RECOVERY_STATUS_LABELS[entry.status] ?? entry.status)}${extra}</td></tr>`;
  }).join('');
  // Owner 5-part fix: the seven-column table scrolls inside its own
  // card on a phone instead of clipping the right-side columns.
  return `<div class="table-scroll"><table><thead><tr><th>Customer</th><th>Mohalla</th><th>Serial</th><th>Device</th><th>Service ended</th><th>Days since ended</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export function recoveryCsv(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  const header = ['id', 'customer', 'mohalla', 'serial', 'device', 'service_ended', 'days_since_ended', 'status', 'collected_date', 'collector', 'reason', 'visit_id'];
  const lines = [header.join(',')];
  for (const entry of rows) {
    lines.push([
      entry.id, entry.customerName || entry.customerId, entry.mohalla,
      entry.serial, RECOVERY_DEVICE_TYPE_LABELS[entry.deviceType] ?? entry.deviceType,
      entry.dateEnded ?? '', entry.daysSinceEnded ?? '',
      RECOVERY_STATUS_LABELS[entry.status] ?? entry.status,
      entry.collectedDate ?? '', entry.collector ?? '', entry.reason ?? '', entry.visitId ?? '',
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function recoveryFilename() {
  return 'equipment-recovery-queue.csv';
}
