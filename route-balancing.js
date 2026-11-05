// Plan 208 (Plan 203-350) — Collector route balancing record.
//
// One collector can end up with all the far mohallas and another with
// the near ones, because route load is never measured per collector
// per day. This module is that measurement in writing: one route-load
// record per collector per day (collector, mohallas assigned, stops
// planned, estimated visits, note).
//
// Scope fence, stated plainly:
//   - This measures and records load only. It does NOT re-sequence
//     routes (route-sequencing.js, Plan 1) and it does NOT reassign
//     mohallas (collector-assignments.js, Plan 99): those modules are
//     neither read nor written here, and recording load never changes
//     any route, visit, or payment by itself.
//   - It is import-free: the caller supplies every record and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     refused, never mapped onto a neighbouring date).
//   - One record per collector per day: a second record for the same
//     collector (case-insensitive) on the same date is refused, so a
//     day view can never double-count one collector.
//   - Imbalance is flagged, never silently resolved: a day where one
//     collector carries more than twice another collector's stops is
//     flagged for the owner to explain or fix.
//   - There is no edit function: only record and remove. A wrong
//     record is removed and re-recorded, so history is never quietly
//     rewritten.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function validRouteLoadDate(value) {
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

function wholeStops(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function cleanMohallas(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    const name = cleanText(entry);
    if (name) out.push(name);
  }
  return out;
}

export function normalizeRouteLoadRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const id = cleanText(record.id);
  const collector = cleanText(record.collector);
  const date = typeof record.date === 'string' ? record.date : '';
  const mohallas = cleanMohallas(record.mohallas);
  const stopsPlanned = wholeStops(record.stopsPlanned);
  if (!id || !collector || !validRouteLoadDate(date) || mohallas.length === 0 || stopsPlanned === null) return null;
  const normalized = {
    id,
    date,
    collector,
    mohallas,
    stopsPlanned,
    estimatedVisits: null,
    note: cleanText(record.note),
  };
  if (record.estimatedVisits !== undefined && record.estimatedVisits !== null && record.estimatedVisits !== '') {
    const visits = wholeStops(record.estimatedVisits);
    if (visits !== null) normalized.estimatedVisits = visits;
  }
  return normalized;
}

export function normalizeRouteLoadList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenIds = new Set();
  const seenCollectorDays = new Set();
  for (const entry of list) {
    const record = normalizeRouteLoadRecord(entry);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    const key = `${record.date}|${record.collector.toLowerCase()}`;
    if (seenCollectorDays.has(key)) continue;
    seenIds.add(record.id);
    seenCollectorDays.add(key);
    out.push(record);
  }
  return out;
}

export function findRouteLoadRecord(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return null;
  for (const record of normalizeRouteLoadList(list)) {
    if (record.id === wanted) return record;
  }
  return null;
}

export function recordRouteLoad(list, record) {
  const normalized = normalizeRouteLoadRecord(record);
  const base = normalizeRouteLoadList(list);
  if (!normalized) return base;
  if (base.some((entry) => entry.id === normalized.id)) return base;
  if (base.some((entry) => entry.date === normalized.date && entry.collector.toLowerCase() === normalized.collector.toLowerCase())) return base;
  return [...base, normalized];
}

export function removeRouteLoad(list, id) {
  const wanted = cleanText(id);
  return normalizeRouteLoadList(list).filter((record) => record.id !== wanted);
}

export function routeLoadsSorted(list) {
  return normalizeRouteLoadList(list).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ca = a.collector.toLowerCase();
    const cb = b.collector.toLowerCase();
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function routeLoadsForDate(list, date) {
  if (!validRouteLoadDate(date)) return [];
  return routeLoadsSorted(list).filter((record) => record.date === date);
}

export function routeLoadsForCollector(list, collector) {
  const query = cleanText(collector).toLowerCase();
  if (!query) return routeLoadsSorted(list);
  return routeLoadsSorted(list).filter((record) => record.collector.toLowerCase().includes(query));
}

// The day view: one row per collector for the chosen date, collectors
// A-Z, so the owner can compare planned stops side by side.
export function routeDayView(list, date) {
  if (!validRouteLoadDate(date)) return [];
  return routeLoadsForDate(list, date).map((record) => ({
    id: record.id,
    collector: record.collector,
    mohallas: [...record.mohallas],
    stopsPlanned: record.stopsPlanned,
    estimatedVisits: record.estimatedVisits,
  }));
}

// The day total is the plain sum of the day view's planned stops, so
// the view and its total can never disagree.
export function routeDayTotal(list, date) {
  return routeDayView(list, date).reduce((sum, row) => sum + row.stopsPlanned, 0);
}

// Flagged when one collector carries more than twice another
// collector's stops on the same day. A day with fewer than two
// collectors has nothing to compare, and a day where every collector
// planned zero stops is not flagged.
export function routeDayImbalance(list, date) {
  const view = routeDayView(list, date);
  if (view.length < 2) return null;
  let maxRow = view[0];
  let minRow = view[0];
  for (const row of view) {
    if (row.stopsPlanned > maxRow.stopsPlanned) maxRow = row;
    if (row.stopsPlanned < minRow.stopsPlanned) minRow = row;
  }
  if (maxRow.stopsPlanned <= 2 * minRow.stopsPlanned) return null;
  return {
    flagged: true,
    maxCollector: maxRow.collector,
    maxStops: maxRow.stopsPlanned,
    minCollector: minRow.collector,
    minStops: minRow.stopsPlanned,
  };
}

export function routeDayImbalanceText(list, date) {
  const imbalance = routeDayImbalance(list, date);
  if (!imbalance) return '';
  return `Imbalance flagged: ${imbalance.maxCollector} carries ${imbalance.maxStops} stops, more than twice ${imbalance.minCollector}'s ${imbalance.minStops} stops.`;
}

export function routeDaySummaryText(list, date) {
  if (!validRouteLoadDate(date)) return 'Give a real date to view a day\'s route load.';
  const view = routeDayView(list, date);
  if (view.length === 0) return `No route load recorded for ${date}.`;
  const collectors = view.length === 1 ? 'collector' : 'collectors';
  return `${date}: ${view.length} ${collectors}, ${routeDayTotal(list, date)} planned stops.`;
}

export function routeLoadRecordText(record) {
  const normalized = normalizeRouteLoadRecord(record);
  if (!normalized) return '';
  const visits = normalized.estimatedVisits === null ? '' : `, ${normalized.estimatedVisits} estimated visits`;
  const note = normalized.note ? ` — ${normalized.note}` : '';
  return `${normalized.date}: ${normalized.collector} — ${normalized.mohallas.join(', ')} — ${normalized.stopsPlanned} planned stops${visits}${note}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function routeLoadRecordHtml(record) {
  const normalized = normalizeRouteLoadRecord(record);
  if (!normalized) return '';
  return `<p>${escapeHtml(routeLoadRecordText(normalized))} <span style="color: #666;">(${escapeHtml(normalized.id)})</span></p>`;
}

export function routeLoadAllHtml(list) {
  return routeLoadsSorted(list).map((record) => routeLoadRecordHtml(record)).join('');
}

export function routeLoadDayHtml(list, date) {
  return routeDayView(list, date).map((row) => {
    const visits = row.estimatedVisits === null ? '' : `, ${row.estimatedVisits} estimated visits`;
    return `<p>${escapeHtml(row.collector)} — ${escapeHtml(row.mohallas.join(', '))} — ${row.stopsPlanned} planned stops${visits}</p>`;
  }).join('');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function routeLoadCsv(list) {
  const lines = ['id,date,collector,mohallas,stopsPlanned,estimatedVisits,note'];
  for (const record of routeLoadsSorted(list)) {
    lines.push([
      record.id,
      record.date,
      record.collector,
      record.mohallas.join('; '),
      record.stopsPlanned,
      record.estimatedVisits === null ? '' : record.estimatedVisits,
      record.note,
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function routeLoadFilename() {
  return 'route-load.csv';
}
