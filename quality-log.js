// Plan 47 (Plan 1-100) — Per-customer speed and service-quality log.
//
// "My internet is slow" is argued from memory on both sides, because no
// record exists of what speed was actually measured at that house and
// when. This module is that record: one operator-entered entry per
// measurement — date, measured download/upload, where it was measured
// (near the router or in a far room), and a short note.
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every entry, and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - It is a record only. It is NOT a live speed test, NOT a billing
//     or package input, and it never changes any charge, bill,
//     payment, or ticket. A ticket may link to a log entry (the entry
//     carries an optional linked ticket id); linking never writes
//     into the ticket, and logging never touches a ticket.
//   - It is NOT the optical signal history (signal-history.js): that
//     log records dBm readings from the fibre plant. This log records
//     Mbps measurements at the house. Neither system reads or writes
//     the other, and this module holds no dBm, bill, payment, or
//     ticket-status field.
//   - An entry with no customer, an impossible date (2026-02-30),
//     a missing or non-finite speed, a negative speed, or a blank
//     location is refused outright, never stored half-formed. A
//     blank note or blank ticket link stays null ("not recorded"),
//     never guessed. Speeds are in Mbps, rounded to 2 decimals.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isRealDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidQualityDate(value) {
  return isRealDate(value);
}

function toSpeed(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

// Where the measurement was taken. The two plan-named spots get a
// canonical label; anything else is kept verbatim as the location
// note, so an operator's own wording is never rewritten.
export function normalizeQualityLocation(value) {
  const raw = text(value);
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[\s_-]+/g, ' ');
  if (key === 'near router' || key === 'near the router' || key === 'router') return 'Near router';
  if (key === 'far room' || key === 'far' || key === 'far end') return 'Far room';
  return raw;
}

export function normalizeQualityEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const customerId = text(entry.customerId);
  const date = text(entry.date);
  const downloadMbps = toSpeed(entry.downloadMbps);
  const uploadMbps = toSpeed(entry.uploadMbps);
  const location = normalizeQualityLocation(entry.location);
  if (!customerId || !isRealDate(date) || downloadMbps === null || uploadMbps === null || !location) return null;
  const note = text(entry.note);
  const linkedTicketId = text(entry.linkedTicketId);
  return {
    id: text(entry.id) || null,
    customerId,
    date,
    downloadMbps,
    uploadMbps,
    location,
    note: note || null,
    linkedTicketId: linkedTicketId || null,
  };
}

function normalizeQualityEntries(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const normalized = normalizeQualityEntry(entry);
    if (normalized) out.push(normalized);
  }
  return out;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

// Records one measurement. An invalid entry leaves the list
// unchanged (same reference, so the caller can tell nothing was
// stored); a valid one returns a new list, never a mutated input.
// A duplicate id replaces the earlier entry, so re-saving a
// corrected measurement never creates a second row for it.
export function recordQualityEntry(list, entry) {
  const normalized = normalizeQualityEntry(entry);
  if (!normalized) return list;
  const current = normalizeQualityEntries(list);
  if (normalized.id) {
    const existing = current.findIndex((item) => item.id === normalized.id);
    if (existing >= 0) {
      const next = current.slice();
      next[existing] = normalized;
      return next;
    }
  }
  return [...current, normalized];
}

export function entriesForCustomer(list, customerId) {
  const id = text(customerId);
  if (!id) return [];
  return normalizeQualityEntries(list)
    .filter((entry) => entry.customerId === id)
    .sort(compareEntries);
}

export function entriesForTicket(list, ticketId) {
  const id = text(ticketId);
  if (!id) return [];
  return normalizeQualityEntries(list)
    .filter((entry) => entry.linkedTicketId === id)
    .sort(compareEntries);
}

// The package speed alongside each entry, for comparison. The caller
// supplies the package speed (Mbps) — the module never reads a
// package record, so it can never re-price or re-derive one.
export function qualityEntriesWithComparison(entries, packageSpeedMbps) {
  const target = toSpeed(packageSpeedMbps);
  return normalizeQualityEntries(entries).sort(compareEntries).map((entry) => {
    let comparison = 'unknown';
    if (target !== null) {
      if (entry.downloadMbps > target) comparison = 'above';
      else if (entry.downloadMbps === target) comparison = 'at';
      else comparison = 'below';
    }
    return { ...entry, packageSpeedMbps: target, comparison };
  });
}

function average(values) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export function qualityLogSummary(entries, packageSpeedMbps) {
  const rows = qualityEntriesWithComparison(entries, packageSpeedMbps);
  if (rows.length === 0) {
    return { count: 0, latestDate: null, averageDownloadMbps: null, averageUploadMbps: null, belowPackageCount: 0, packageSpeedMbps: null };
  }
  return {
    count: rows.length,
    latestDate: rows[rows.length - 1].date,
    averageDownloadMbps: average(rows.map((row) => row.downloadMbps)),
    averageUploadMbps: average(rows.map((row) => row.uploadMbps)),
    belowPackageCount: rows.filter((row) => row.comparison === 'below').length,
    packageSpeedMbps: rows[0].packageSpeedMbps,
  };
}

export function qualityLogSummaryText(entries, packageSpeedMbps) {
  const summary = qualityLogSummary(entries, packageSpeedMbps);
  if (summary.count === 0) return 'No speed measurements recorded yet.';
  const packagePart = summary.packageSpeedMbps === null
    ? 'package speed not set'
    : `package ${summary.packageSpeedMbps} Mbps`;
  const belowPart = summary.packageSpeedMbps === null
    ? ''
    : `, ${summary.belowPackageCount} below the package speed`;
  return `${summary.count} measurement${summary.count === 1 ? '' : 's'}, latest ${summary.latestDate}, average ${summary.averageDownloadMbps} Mbps down / ${summary.averageUploadMbps} Mbps up (${packagePart}${belowPart}).`;
}

export function qualityLogHtml(entries, packageSpeedMbps) {
  const rows = qualityEntriesWithComparison(entries, packageSpeedMbps);
  if (rows.length === 0) return '<p class="empty-state">No speed measurements recorded yet.</p>';
  const comparisonLabel = { above: 'Above package', at: 'At package', below: 'Below package', unknown: 'No package speed' };
  return `<table class="quality-log-table"><thead><tr><th>Date</th><th>Download</th><th>Upload</th><th>Where measured</th><th>Package</th><th>Comparison</th><th>Note</th><th>Ticket</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(String(row.downloadMbps))} Mbps</td><td>${escapeHtml(String(row.uploadMbps))} Mbps</td><td>${escapeHtml(row.location)}</td><td>${row.packageSpeedMbps === null ? 'Not set' : `${escapeHtml(String(row.packageSpeedMbps))} Mbps`}</td><td>${escapeHtml(comparisonLabel[row.comparison])}</td><td>${row.note === null ? 'Not recorded' : escapeHtml(row.note)}</td><td>${row.linkedTicketId === null ? '—' : escapeHtml(row.linkedTicketId)}</td></tr>`).join('')}</tbody></table>`;
}

export function qualityLogCsv(entries, packageSpeedMbps) {
  const rows = qualityEntriesWithComparison(entries, packageSpeedMbps);
  const header = 'date,download_mbps,upload_mbps,location,package_mbps,comparison,note,ticket_id';
  const lines = rows.map((row) => [row.date, row.downloadMbps, row.uploadMbps, row.location, row.packageSpeedMbps ?? '', row.comparison, row.note ?? '', row.linkedTicketId ?? ''].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function qualityLogFilename(customerId) {
  const safe = text(customerId).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'customer';
  return `quality-log-${safe}.csv`;
}
