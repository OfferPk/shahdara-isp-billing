// Plan 199 (Plan 101-202) — Export custody log.
//
// Copies of app data taken out of the app (for an accountant, a print,
// or a backup) leave no trace of who took what, when, and for what
// purpose. This module is that trace: one log entry per copy taken
// out, with its date, export kind, who took it, its purpose, and a
// return-or-delete confirmation.
//
// Scope fence, stated plainly:
//   - This is a log only. It stores no exported data itself — no bill,
//     payment, or customer record content ever lives here, only the
//     custody facts (date, kind, taken-by, purpose, confirmation).
//   - It never changes, sends, or deletes any bill, payment, or
//     customer record, and it never performs an export itself.
//   - It is NOT Plan 31's operator audit log (audit-log.js): that log
//     records operator actions inside the app, while this log records
//     custody of copies taken out of the app. audit-log.js is neither
//     read nor written here.
//   - It is import-free: the caller supplies every entry and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     refused, never mapped onto a neighbouring date).
//   - Confirmation is fail-safe: any value other than exactly
//     "confirmed" is stored as "unconfirmed", so an export can never
//     look accounted for on bad input.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function validCustodyDate(value) {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) limit = 29;
  return day <= limit;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeCustodyConfirmation(value) {
  return value === 'confirmed' ? 'confirmed' : 'unconfirmed';
}

export function normalizeCustodyEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const date = cleanText(raw.date);
  const exportKind = cleanText(raw.exportKind);
  const takenBy = cleanText(raw.takenBy);
  const purpose = cleanText(raw.purpose);
  if (!id || !validCustodyDate(date) || !exportKind || !takenBy || !purpose) return null;
  return {
    id,
    date,
    exportKind,
    takenBy,
    purpose,
    confirmation: normalizeCustodyConfirmation(raw.confirmation),
    note: cleanText(raw.note),
  };
}

export function normalizeCustodyList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeCustodyEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findCustodyExport(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeCustodyList(list).find((entry) => entry.id === clean) ?? null;
}

export function recordCustodyExport(list, entry) {
  const clean = normalizeCustodyList(list);
  const next = normalizeCustodyEntry(entry);
  if (!next) return clean;
  if (clean.some((entry) => entry.id === next.id)) return clean;
  return [...clean, next];
}

export function removeCustodyExport(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeCustodyList(list);
  return normalizeCustodyList(list).filter((entry) => entry.id !== clean);
}

export function confirmCustodyExport(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeCustodyList(list);
  return normalizeCustodyList(list).map((entry) =>
    entry.id === clean ? { ...entry, confirmation: 'confirmed' } : entry,
  );
}

export function custodyExportsSorted(list) {
  return normalizeCustodyList(list).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.id.localeCompare(b.id);
  });
}

export function custodyUnconfirmed(list) {
  return custodyExportsSorted(list).filter((entry) => entry.confirmation !== 'confirmed');
}

export function custodyByKind(list, kind) {
  const want = cleanText(kind).toLowerCase();
  if (!want) return custodyExportsSorted(list);
  return custodyExportsSorted(list).filter((entry) => entry.exportKind.toLowerCase() === want);
}

export function custodySummaryText(list) {
  const clean = normalizeCustodyList(list);
  const unconfirmed = clean.filter((entry) => entry.confirmation !== 'confirmed').length;
  if (!clean.length) return 'No exports logged.';
  if (!unconfirmed) return `${clean.length} export${clean.length === 1 ? '' : 's'} logged, all confirmed.`;
  return `${clean.length} export${clean.length === 1 ? '' : 's'} logged, ${unconfirmed} unconfirmed.`;
}

export function custodyText(entry) {
  const clean = normalizeCustodyEntry(entry);
  if (!clean) return '';
  const status = clean.confirmation === 'confirmed'
    ? 'Confirmed (returned or deleted)'
    : 'UNCONFIRMED';
  const note = clean.note ? ` — ${clean.note}` : '';
  return `${clean.date} · ${clean.exportKind} · taken by ${clean.takenBy} · ${clean.purpose} · ${status}${note}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function custodyHtml(entry) {
  const clean = normalizeCustodyEntry(entry);
  if (!clean) return '';
  const status = clean.confirmation === 'confirmed'
    ? 'Confirmed (returned or deleted)'
    : 'UNCONFIRMED';
  const note = clean.note ? ` — ${escapeHtml(clean.note)}` : '';
  return `<p>${escapeHtml(clean.date)} · ${escapeHtml(clean.exportKind)} · taken by ${escapeHtml(clean.takenBy)} · ${escapeHtml(clean.purpose)} · ${status}${note}</p>`;
}

export function custodyAllHtml(list) {
  return custodyExportsSorted(list).map(custodyHtml).join('');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function custodyCsv(list) {
  const rows = [['id', 'date', 'export_kind', 'taken_by', 'purpose', 'confirmation', 'note']];
  for (const entry of custodyExportsSorted(list)) {
    rows.push([entry.id, entry.date, entry.exportKind, entry.takenBy, entry.purpose, entry.confirmation, entry.note]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function custodyFilename() {
  return 'export-custody.csv';
}
