// Plan 182 (Plan 101-202) — Shop inventory audit cycle.
//
// A stock register alone does not prove the shop shelf matches the
// record, so shortages and surpluses surface only when something is
// needed and missing. This module adds only the audit cycle: an
// audit (date, auditor, open/completed state) plus counted lines
// (item, recorded quantity, counted quantity, variance note) that
// show recorded versus counted side by side.
//
// Scope fence, stated plainly:
//   - The existing stock register (stock-register.js, Plan 51) is
//     neither read nor written here. The recorded quantity on each
//     line is supplied by the caller — normally copied from the
//     register at count time — and this module never changes a
//     stock quantity itself. Any correction goes through the
//     existing stock flow only, never through an audit.
//   - Starting or completing an audit never changes any bill,
//     payment, or stock total by itself: audits hold no money and
//     no stock field beyond the counted comparison.
//   - Past audits are read-only: once an audit is completed, no
//     line can be added or removed and the audit itself cannot be
//     removed. A completed audit can only be read back.
//   - It is import-free: the caller supplies every record, and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - Counts are whole units only. A negative, fractional, or
//     non-finite count is refused outright, never stored as zero.
//   - An impossible date (2026-02-30) is refused outright, never
//     stored as a neighbouring date.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1];
}

function parseStrictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isStrictDate(value) {
  return parseStrictDate(value) !== null;
}

function wholeUnits(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value.trim());
    if (Number.isInteger(num) && num >= 0) return num;
  }
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function normalizeAuditCycle(input) {
  if (!input || typeof input !== 'object') return null;
  const id = text(input.id);
  const auditor = text(input.auditor);
  if (!id || !auditor) return null;
  if (!isStrictDate(input.auditDate)) return null;
  const status = input.status === 'completed' ? 'completed' : 'open';
  const completedDate = status === 'completed' && isStrictDate(input.completedDate)
    ? text(input.completedDate)
    : '';
  if (status === 'completed' && !completedDate) return null;
  return {
    id,
    auditDate: text(input.auditDate),
    auditor,
    status,
    completedDate,
  };
}

export function normalizeAuditCycleList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const audit = normalizeAuditCycle(item);
    if (audit && !out.some((entry) => entry.id === audit.id)) out.push(audit);
  }
  return out;
}

export function findAuditCycle(cycles, id) {
  const list = normalizeAuditCycleList(cycles);
  return list.find((audit) => audit.id === text(id)) || null;
}

export function createAuditCycle(cycles, input) {
  const list = normalizeAuditCycleList(cycles);
  const audit = normalizeAuditCycle({ ...input, status: 'open', completedDate: '' });
  if (!audit) return list;
  if (list.some((entry) => entry.id === audit.id)) return list;
  return [...list, audit];
}

export function completeAuditCycle(cycles, id, completedDate) {
  const list = normalizeAuditCycleList(cycles);
  if (!isStrictDate(completedDate)) return list;
  return list.map((audit) => {
    if (audit.id !== text(id) || audit.status === 'completed') return audit;
    return { ...audit, status: 'completed', completedDate: text(completedDate) };
  });
}

export function removeAuditCycle(cycles, id) {
  const list = normalizeAuditCycleList(cycles);
  return list.filter((audit) => !(audit.id === text(id) && audit.status === 'open'));
}

export function normalizeAuditLine(input) {
  if (!input || typeof input !== 'object') return null;
  const id = text(input.id);
  const auditId = text(input.auditId);
  const item = text(input.item);
  if (!id || !auditId || !item) return null;
  const recordedQty = wholeUnits(input.recordedQty);
  const countedQty = wholeUnits(input.countedQty);
  if (recordedQty === null || countedQty === null) return null;
  return {
    id,
    auditId,
    item,
    recordedQty,
    countedQty,
    varianceNote: text(input.varianceNote),
  };
}

export function normalizeAuditLineList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const line = normalizeAuditLine(item);
    if (line && !out.some((entry) => entry.id === line.id)) out.push(line);
  }
  return out;
}

export function findAuditLine(lines, id) {
  const list = normalizeAuditLineList(lines);
  return list.find((line) => line.id === text(id)) || null;
}

export function addAuditLine(cycles, lines, input) {
  const audits = normalizeAuditCycleList(cycles);
  const list = normalizeAuditLineList(lines);
  const line = normalizeAuditLine(input);
  if (!line) return list;
  const audit = audits.find((entry) => entry.id === line.auditId);
  if (!audit || audit.status === 'completed') return list;
  if (list.some((entry) => entry.id === line.id)) return list;
  return [...list, line];
}

export function removeAuditLine(cycles, lines, auditId, lineId) {
  const audits = normalizeAuditCycleList(cycles);
  const audit = audits.find((entry) => entry.id === text(auditId));
  if (!audit || audit.status === 'completed') return normalizeAuditLineList(lines);
  return normalizeAuditLineList(lines).filter(
    (line) => !(line.id === text(lineId) && line.auditId === audit.id),
  );
}

export function auditLineVariance(line) {
  const clean = normalizeAuditLine(line);
  if (!clean) return null;
  const difference = clean.countedQty - clean.recordedQty;
  const label = difference === 0 ? 'Balanced' : difference < 0 ? 'Shortage' : 'Surplus';
  return { difference, label };
}

export function auditCycleLines(lines, auditId) {
  const list = normalizeAuditLineList(lines).filter((line) => line.auditId === text(auditId));
  list.sort((a, b) => lower(a.item).localeCompare(lower(b.item)) || a.id.localeCompare(b.id));
  return list;
}

export function auditCycleTotals(lines, auditId) {
  const counted = auditCycleLines(lines, auditId);
  let recorded = 0;
  let countedQty = 0;
  for (const line of counted) {
    recorded += line.recordedQty;
    countedQty += line.countedQty;
  }
  const difference = countedQty - recorded;
  return {
    items: counted.length,
    recorded,
    counted: countedQty,
    difference,
    label: difference === 0 ? 'Balanced' : difference < 0 ? 'Shortage' : 'Surplus',
  };
}

export function auditsSorted(cycles) {
  const list = normalizeAuditCycleList(cycles);
  list.sort((a, b) => b.auditDate.localeCompare(a.auditDate) || a.id.localeCompare(b.id));
  return list;
}

export function auditsOpen(cycles) {
  return auditsSorted(cycles).filter((audit) => audit.status === 'open');
}

export function auditsCompleted(cycles) {
  return auditsSorted(cycles).filter((audit) => audit.status === 'completed');
}

export function auditsByAuditor(cycles, auditor) {
  const wanted = lower(auditor);
  if (!wanted) return auditsSorted(cycles);
  return auditsSorted(cycles).filter((audit) => lower(audit.auditor) === wanted);
}

export function auditAuditors(cycles) {
  const seen = new Map();
  for (const audit of normalizeAuditCycleList(cycles)) {
    const key = lower(audit.auditor);
    if (key && !seen.has(key)) seen.set(key, audit.auditor);
  }
  return [...seen.values()].sort((a, b) => lower(a).localeCompare(lower(b)));
}

export function auditCycleSummaryText(cycles, lines) {
  const audits = normalizeAuditCycleList(cycles);
  const open = audits.filter((audit) => audit.status === 'open').length;
  const completed = audits.filter((audit) => audit.status === 'completed').length;
  const totalLines = normalizeAuditLineList(lines).length;
  return `${audits.length} audits (${open} open, ${completed} completed), ${totalLines} items counted`;
}

export function auditLineText(line) {
  const clean = normalizeAuditLine(line);
  if (!clean) return '';
  const variance = auditLineVariance(clean);
  const note = clean.varianceNote ? ` — ${clean.varianceNote}` : '';
  return `${clean.item}: recorded ${clean.recordedQty}, counted ${clean.countedQty} (${variance.label} ${variance.difference >= 0 ? '+' : ''}${variance.difference})${note}`;
}

export function auditCycleText(audit, lines) {
  const clean = normalizeAuditCycle(audit);
  if (!clean) return '';
  const totals = auditCycleTotals(lines, clean.id);
  const state = clean.status === 'completed'
    ? `completed ${clean.completedDate}`
    : 'open';
  return `Audit ${clean.id} (${clean.auditDate}, ${clean.auditor}, ${state}): ${totals.items} items, recorded ${totals.recorded}, counted ${totals.counted} (${totals.label} ${totals.difference >= 0 ? '+' : ''}${totals.difference})`;
}

export function auditLineHtml(line) {
  const clean = normalizeAuditLine(line);
  if (!clean) return '';
  const variance = auditLineVariance(clean);
  return `<li>${escapeHtml(clean.item)}: recorded ${clean.recordedQty}, counted ${clean.countedQty} — ${variance.label} ${variance.difference >= 0 ? '+' : ''}${variance.difference}${clean.varianceNote ? ` (${escapeHtml(clean.varianceNote)})` : ''}</li>`;
}

export function auditCycleHtml(audit, lines) {
  const clean = normalizeAuditCycle(audit);
  if (!clean) return '';
  const counted = auditCycleLines(lines, clean.id);
  const state = clean.status === 'completed'
    ? `Completed ${escapeHtml(clean.completedDate)}`
    : 'Open';
  const items = counted.length
    ? `<ul>${counted.map((line) => auditLineHtml(line)).join('')}</ul>`
    : '<p>No items counted yet.</p>';
  return `<div><p><strong>Audit ${escapeHtml(clean.id)}</strong> — ${escapeHtml(clean.auditDate)}, ${escapeHtml(clean.auditor)}, ${state}</p>${items}<p>${escapeHtml(auditCycleText(clean, lines))}</p></div>`;
}

export function auditCycleAllHtml(cycles, lines) {
  return auditsSorted(cycles).map((audit) => auditCycleHtml(audit, lines)).join('');
}

export function auditCycleCsv(cycles, lines) {
  const rows = [[
    'audit_id', 'audit_date', 'auditor', 'audit_status', 'completed_date',
    'line_id', 'item', 'recorded_qty', 'counted_qty', 'variance', 'variance_label', 'variance_note',
  ].join(',')];
  for (const audit of auditsSorted(cycles)) {
    const counted = auditCycleLines(lines, audit.id);
    if (!counted.length) {
      rows.push([
        csvCell(audit.id), csvCell(audit.auditDate), csvCell(audit.auditor),
        csvCell(audit.status), csvCell(audit.completedDate),
        csvCell(''), csvCell(''), csvCell(''), csvCell(''), csvCell(''), csvCell(''), csvCell(''),
      ].join(','));
      continue;
    }
    for (const line of counted) {
      const variance = auditLineVariance(line);
      rows.push([
        csvCell(audit.id), csvCell(audit.auditDate), csvCell(audit.auditor),
        csvCell(audit.status), csvCell(audit.completedDate),
        csvCell(line.id), csvCell(line.item), csvCell(line.recordedQty),
        csvCell(line.countedQty), csvCell(variance.difference), csvCell(variance.label),
        csvCell(line.varianceNote),
      ].join(','));
    }
  }
  return rows.join('\n');
}

export function auditCycleFilename() {
  return 'inventory-audits.csv';
}
