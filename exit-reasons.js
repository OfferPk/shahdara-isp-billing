// Plan 57 (Plan 1-100) — Exit reason log and monthly churn-reason view.
//
// Customers leave and the reason — price, competitor offer, repeated
// faults, moving house, service quality — is never recorded in a
// countable form, so the same cause keeps costing customers month
// after month without ever being named. This module is the RECORD
// for that answer: one structured exit reason per departed customer
// plus an optional short note, and a read-only monthly view counting
// exits by reason and by mohalla.
//
// Scope fence, stated plainly against the neighbouring systems:
//   - SISP-108 (churn-winback.js) already stamps a disconnect reason
//     onto the customer record at archive time (four keys: shifted,
//     competitor, affordability, temporary-travel), runs a win-back
//     queue, and counts disconnects by reason with an all-time and
//     this-month total. This plan neither reads nor writes that
//     store and never touches a customer record at all. What it
//     adds, and only what it adds, is: (a) a monthly view broken
//     down by mohalla as well as by reason, which SISP-108 does
//     not have; (b) two reasons SISP-108 has no key for — repeated
//     faults and service quality; and (c) a standalone exit record
//     (one per customer, in its own store) so recording a reason
//     here can never reopen, bill, or alter the departed record,
//     and never changes the archive/disconnection rules
//     themselves (Plan U keeps the lifecycle timeline).
//   - This is a record, not a win-back campaign: it sends nothing,
//     offers nothing, and holds no bill, payment, or lifecycle
//     field, so there is nothing here that could rewrite one.
//
// How the fence is kept in this module:
//   - It is import-free: the caller supplies every record, every
//     departed customer, and the month, and the module never reads
//     storage, the clock, or the network, and never mutates an
//     input.
//   - A record without a customer id, or with a reason outside the
//     six in the plan, is not a record: normalisation returns null
//     instead of inventing a customer or a reason. An impossible
//     recorded date (2026-02-30) is refused outright, never stored
//     as a neighbouring date, because the month is derived from it.
//   - One record per customer, enforced by upsert: recording a
//     second reason for the same customer replaces the first, so a
//     departed customer can never carry two exit reasons at once.
//   - A departed customer with no record shows as "reason not
//     recorded" in the view, never as a guessed cause. A record
//     with no recorded date is counted in the all-records total
//     but belongs to no month, never to a guessed month. The
//     no-reason list is deliberately not month-scoped: a departed
//     record carries no exit month of its own, and the view says
//     so rather than guessing one.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export const EXIT_REASONS = [
  'price',
  'competitor',
  'repeated_faults',
  'moving_house',
  'service_quality',
  'other',
];

export const EXIT_REASON_LABELS = {
  price: 'Price too high',
  competitor: 'Competitor offer',
  repeated_faults: 'Repeated faults',
  moving_house: 'Moving house',
  service_quality: 'Service quality',
  other: 'Other',
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

export function validExitDate(value) {
  const clean = text(value);
  if (!DATE_RE.test(clean)) return null;
  const [year, month, day] = clean.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return clean;
}

export function validExitMonth(value) {
  const clean = text(value);
  if (!MONTH_RE.test(clean)) return null;
  const [year, month] = clean.split('-').map(Number);
  if (month < 1 || month > 12 || year < 1) return null;
  return clean;
}

// Canonical mohalla for grouping: leading "Mohalla" stripped,
// case-insensitive, aliases resolved. Unknown areas keep their own
// readable label and are grouped by their lower-cased name, never
// dropped into a guessed mohalla.
export function canonicalExitMohalla(value) {
  const raw = text(value);
  if (!raw) return { key: '__unassigned__', label: 'Unassigned' };
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return { key: '__unassigned__', label: 'Unassigned' };
  const lower = stripped.toLowerCase();
  const alias = MOHALLA_ALIASES[lower];
  if (alias) return { key: alias, label: alias };
  return { key: lower, label: stripped };
}

export function normalizeExitRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const customerId = text(raw.customerId);
  if (!customerId) return null;
  const reason = text(raw.reason);
  if (!EXIT_REASONS.includes(reason)) return null;
  let recordedDate = null;
  if (raw.recordedDate !== undefined && raw.recordedDate !== null && text(raw.recordedDate) !== '') {
    recordedDate = validExitDate(raw.recordedDate);
    if (!recordedDate) return null;
  }
  return {
    customerId,
    customerName: text(raw.customerName),
    mohalla: text(raw.mohalla),
    reason,
    note: text(raw.note),
    recordedDate,
  };
}

export function normalizeExitRecordList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const raw of list) {
    const record = normalizeExitRecord(raw);
    if (record) byId.set(record.customerId, record);
  }
  return [...byId.values()];
}

export function findExitRecord(list, customerId) {
  const id = text(customerId);
  if (!id) return null;
  return normalizeExitRecordList(list).find((record) => record.customerId === id) ?? null;
}

export function upsertExitRecord(list, raw) {
  const record = normalizeExitRecord(raw);
  if (!record) return normalizeExitRecordList(list);
  const clean = normalizeExitRecordList(list).filter((item) => item.customerId !== record.customerId);
  clean.push(record);
  return clean;
}

export function removeExitRecord(list, customerId) {
  const id = text(customerId);
  if (!id) return normalizeExitRecordList(list);
  return normalizeExitRecordList(list).filter((record) => record.customerId !== id);
}

function emptyReasonCounts() {
  const counts = { total: 0 };
  for (const reason of EXIT_REASONS) counts[reason] = 0;
  return counts;
}

function addReason(counts, reason) {
  counts.total += 1;
  if (EXIT_REASONS.includes(reason)) counts[reason] += 1;
}

export function buildMonthlyExitView(records, departedCustomers, month) {
  const cleanMonth = validExitMonth(month);
  if (!cleanMonth) return null;
  const cleanRecords = normalizeExitRecordList(records);
  const monthRecords = cleanRecords.filter(
    (record) => record.recordedDate && record.recordedDate.slice(0, 7) === cleanMonth,
  );
  const totals = emptyReasonCounts();
  const mohallaGroups = new Map();
  for (const record of monthRecords) {
    addReason(totals, record.reason);
    const mohalla = canonicalExitMohalla(record.mohalla);
    if (!mohallaGroups.has(mohalla.key)) {
      mohallaGroups.set(mohalla.key, { name: mohalla.label, ...emptyReasonCounts() });
    }
    addReason(mohallaGroups.get(mohalla.key), record.reason);
  }
  const byMohalla = [...mohallaGroups.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
  const byReason = EXIT_REASONS.map((reason) => ({
    reason,
    name: EXIT_REASON_LABELS[reason],
    count: totals[reason],
  }));
  // Departed customers with no exit record at all: "reason not
  // recorded", never a guessed cause. Not month-scoped, because a
  // departed record carries no exit month of its own.
  const recordedIds = new Set(cleanRecords.map((record) => record.customerId));
  const noReasonCustomers = (Array.isArray(departedCustomers) ? departedCustomers : [])
    .filter((customer) => customer && typeof customer === 'object')
    .filter((customer) => text(customer.id) && !recordedIds.has(text(customer.id)))
    .map((customer) => ({
      customerId: text(customer.id),
      customerName: text(customer.name),
      mohalla: canonicalExitMohalla(customer.mohalla || customer.area || '').label,
    }));
  return {
    month: cleanMonth,
    totals,
    byReason,
    byMohalla,
    monthRecords,
    undatedRecords: cleanRecords.filter((record) => !record.recordedDate).length,
    allRecords: cleanRecords.length,
    noReason: {
      total: noReasonCustomers.length,
      customers: noReasonCustomers,
    },
  };
}

export function exitSummaryText(view) {
  if (!view || typeof view !== 'object') return 'No exit view.';
  const t = view.totals || emptyReasonCounts();
  const top = view.byReason && view.byReason.length
    ? view.byReason.filter((row) => row.count > 0).map((row) => `${row.name} ${row.count}`).join(', ')
    : '';
  return `${view.month}: ${t.total} exit(s) recorded${top ? ` (${top})` : ''}; ${view.noReason ? view.noReason.total : 0} departed customer(s) with no reason recorded.`;
}

function reasonRowsHtml(rows) {
  if (!rows || rows.length === 0) return '<p style="font-size: 12px;">No exits recorded.</p>';
  const body = rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.count}</td></tr>`).join('');
  return `<table><thead><tr><th>Reason</th><th>Exits</th></tr></thead><tbody>${body}</tbody></table>`;
}

function mohallaRowsHtml(rows) {
  if (!rows || rows.length === 0) return '<p style="font-size: 12px;">No exits recorded.</p>';
  const head = `<th>Mohalla</th>${EXIT_REASONS.map((reason) => `<th>${escapeHtml(EXIT_REASON_LABELS[reason])}</th>`).join('')}<th>Total</th>`;
  const body = rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td>${EXIT_REASONS.map((reason) => `<td>${row[reason]}</td>`).join('')}<td>${row.total}</td></tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function exitHtml(view) {
  if (!view || typeof view !== 'object') return '<p style="font-size: 12px;">No exit view for this month.</p>';
  const t = view.totals || emptyReasonCounts();
  const records = Array.isArray(view.monthRecords) ? view.monthRecords : [];
  const recordsHtml = records.length === 0
    ? '<p style="font-size: 12px;">No exits recorded this month.</p>'
    : `<table><thead><tr><th>Customer</th><th>Mohalla</th><th>Reason</th><th>Recorded</th><th>Note</th></tr></thead><tbody>${records.map((record) => `<tr><td>${escapeHtml(record.customerName || record.customerId)}</td><td>${escapeHtml(canonicalExitMohalla(record.mohalla).label)}</td><td>${escapeHtml(EXIT_REASON_LABELS[record.reason] || record.reason)}</td><td>${escapeHtml(record.recordedDate || 'Not recorded')}</td><td>${escapeHtml(record.note || '—')}</td></tr>`).join('')}</tbody></table>`;
  const noReason = view.noReason || { total: 0, customers: [] };
  const noReasonHtml = noReason.total === 0
    ? '<p style="font-size: 12px;">Every departed customer has a recorded reason.</p>'
    : `<p style="font-size: 12px;">${noReason.total} departed customer(s) with no reason recorded (not month-scoped: a departed record carries no exit month of its own, so no month is guessed for them).</p>`;
  return `<p style="font-size: 12px;">${escapeHtml(view.month)}: ${t.total} exit(s) recorded. ${view.undatedRecords ? `${view.undatedRecords} record(s) with no recorded date belong to no month. ` : ''}${escapeHtml(exitSummaryText(view))}</p>`
    + `<h4 style="font-size: 13px; margin: 8px 0 4px;">By reason</h4>${reasonRowsHtml(view.byReason)}`
    + `<h4 style="font-size: 13px; margin: 8px 0 4px;">By mohalla</h4>${mohallaRowsHtml(view.byMohalla)}`
    + `<h4 style="font-size: 13px; margin: 8px 0 4px;">Exits this month</h4>${recordsHtml}`
    + `<h4 style="font-size: 13px; margin: 8px 0 4px;">Reason not recorded</h4>${noReasonHtml}`;
}

export function exitCsv(view) {
  if (!view || typeof view !== 'object') return '';
  const lines = ['section,name,reason,count'];
  for (const row of view.byReason || []) lines.push(['reason', row.name, row.reason, row.count].map(csvCell).join(','));
  for (const row of view.byMohalla || []) {
    lines.push(['mohalla', row.name, 'all', row.total].map(csvCell).join(','));
    for (const reason of EXIT_REASONS) {
      lines.push(['mohalla-reason', row.name, EXIT_REASON_LABELS[reason], row[reason]].map(csvCell).join(','));
    }
  }
  for (const record of view.monthRecords || []) {
    lines.push(['record', record.customerName || record.customerId, EXIT_REASON_LABELS[record.reason] || record.reason, record.recordedDate || ''].map(csvCell).join(','));
  }
  for (const customer of (view.noReason && view.noReason.customers) || []) {
    lines.push(['no-reason', customer.customerName || customer.customerId, 'reason not recorded', customer.mohalla].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function exitFilename(month) {
  const clean = validExitMonth(month) || 'all';
  return `exit-reasons-${clean}.csv`;
}
