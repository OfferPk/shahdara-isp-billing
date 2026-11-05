// Plan 231 (Plan 203-350) — Fibre route map as a record.
//
// The physical fibre route — which streets, poles, and cabinets a
// cable follows — lives only in the field team's memory, so a new
// technician cannot trace a fault path without asking someone who
// already knows it. This module adds only the missing piece: one
// typed route record per route segment, with no live map and no
// drawing. A written route lets any helper trace a fault path
// without depending on one person's memory.
//
// One fibre-route record: the segment id, the start point and end
// point as typed place names, the poles and cabinets passed, the
// mohalla it serves, and a note.
//
// The fences, stated plainly:
//   - This is a typed record only. It does not replace field route
//     sequencing (Plan 1), route completion proof (Plan 139), or
//     the segment health diary (Plan 142): those modules are
//     neither read nor rewritten here, and this module imports
//     nothing.
//   - A route record can be corrected only by a dated follow-up
//     note, never by silent edit. There is no edit function: only
//     record, add a dated follow-up note, and remove. A follow-up
//     note never rewrites the segment's start point, end point,
//     poles, cabinets, mohalla, or note.
//   - One record per route segment: a second record for the same
//     segment id is refused, never overwriting the first. Duplicate
//     ids are never rewritten.
//   - Recording a route never changes any bill, payment, customer,
//     fault, or staff record by itself: the module takes no bill,
//     payment, customer, fault, or staff object in, edits none,
//     and returns none. It holds route records only.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validFibreRouteDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  const cell = String(value);
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function normalizeNameList(value) {
  const raw = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
  const out = [];
  for (const item of raw) {
    const name = text(item);
    if (name) out.push(name);
  }
  return out;
}

function normalizeFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validFibreRouteDate(date) || !note) return null;
  return { date, note };
}

export function normalizeFibreRoute(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const segmentId = text(raw.segmentId);
  const startPoint = text(raw.startPoint);
  const endPoint = text(raw.endPoint);
  const mohalla = text(raw.mohalla);
  if (!id || !segmentId || !startPoint || !endPoint || !mohalla) return null;
  const followups = [];
  if (Array.isArray(raw.followups)) {
    for (const item of raw.followups) {
      const followup = normalizeFollowup(item);
      if (followup) followups.push(followup);
    }
  }
  return {
    id,
    segmentId,
    startPoint,
    endPoint,
    poles: normalizeNameList(raw.poles),
    cabinets: normalizeNameList(raw.cabinets),
    mohalla,
    note: text(raw.note),
    followups,
  };
}

export function normalizeFibreRouteList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenSegments = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeFibreRoute(raw);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    if (seenSegments.has(record.segmentId)) continue;
    seenIds.add(record.id);
    seenSegments.add(record.segmentId);
    out.push(record);
  }
  return out;
}

export function recordFibreRoute(list, raw) {
  const clean = normalizeFibreRouteList(list);
  const record = normalizeFibreRoute(raw);
  if (!record) return null;
  if (clean.some((item) => item.id === record.id)) return null;
  if (clean.some((item) => item.segmentId === record.segmentId)) return null;
  return [...clean, record];
}

export function removeFibreRoute(list, id) {
  const clean = normalizeFibreRouteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findFibreRoute(list, id) {
  const clean = normalizeFibreRouteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addFibreRouteFollowup(list, id, date, note) {
  const clean = normalizeFibreRouteList(list);
  const wanted = text(id);
  const followup = normalizeFollowup({ date, note });
  if (!wanted || !followup) return null;
  const target = clean.find((item) => item.id === wanted);
  if (!target) return null;
  return clean.map((item) => (item.id === wanted
    ? { ...item, followups: [...item.followups, followup] }
    : item));
}

export function fibreRoutesSorted(list) {
  const clean = normalizeFibreRouteList(list);
  return [...clean].sort((a, b) => {
    const byMohalla = a.mohalla.toLowerCase().localeCompare(b.mohalla.toLowerCase());
    if (byMohalla) return byMohalla;
    const bySegment = a.segmentId.localeCompare(b.segmentId);
    if (bySegment) return bySegment;
    return a.id.localeCompare(b.id);
  });
}

export function fibreRoutesForMohalla(list, mohalla) {
  const needle = text(mohalla).toLowerCase();
  if (!needle) return fibreRoutesSorted(list);
  return fibreRoutesSorted(list).filter((item) => item.mohalla.toLowerCase().includes(needle));
}

export function fibreRouteSummaryText(list) {
  const clean = normalizeFibreRouteList(list);
  const mohallas = new Set(clean.map((item) => item.mohalla.toLowerCase())).size;
  const followups = clean.reduce((sum, item) => sum + item.followups.length, 0);
  return `${clean.length} route segment${clean.length === 1 ? '' : 's'} across ${mohallas} mohalla${mohallas === 1 ? '' : 's'}, ${followups} dated follow-up note${followups === 1 ? '' : 's'}.`;
}

export function fibreRouteText(record) {
  const clean = normalizeFibreRoute(record);
  if (!clean) return '';
  const poles = clean.poles.length ? clean.poles.join(', ') : 'No poles listed.';
  const cabinets = clean.cabinets.length ? clean.cabinets.join(', ') : 'No cabinets listed.';
  const note = clean.note || 'No note.';
  let line = `Segment ${clean.segmentId}: ${clean.startPoint} to ${clean.endPoint}, mohalla ${clean.mohalla}. Poles: ${poles} Cabinets: ${cabinets} ${note}`;
  for (const followup of clean.followups) {
    line += ` Follow-up ${followup.date}: ${followup.note}`;
  }
  return line;
}

export function fibreRouteHtml(record) {
  const clean = normalizeFibreRoute(record);
  if (!clean) return '';
  const followupHtml = clean.followups.length
    ? `<br>Follow-ups: ${clean.followups.map((item) => `${escapeHtml(item.date)}: ${escapeHtml(item.note)}`).join('; ')}`
    : '';
  return `<p><strong>Segment ${escapeHtml(clean.segmentId)}</strong>: ${escapeHtml(clean.startPoint)} to ${escapeHtml(clean.endPoint)}, mohalla ${escapeHtml(clean.mohalla)}.<br>Poles: ${escapeHtml(clean.poles.length ? clean.poles.join(', ') : 'No poles listed.')} Cabinets: ${escapeHtml(clean.cabinets.length ? clean.cabinets.join(', ') : 'No cabinets listed.')} ${escapeHtml(clean.note || 'No note.')}${followupHtml}</p>`;
}

export function fibreRouteCsv(list) {
  const rows = fibreRoutesSorted(list);
  const header = 'segment_id,start_point,end_point,mohalla,poles,cabinets,note,followups';
  const lines = rows.map((item) => [
    item.segmentId,
    item.startPoint,
    item.endPoint,
    item.mohalla,
    item.poles.join('; '),
    item.cabinets.join('; '),
    item.note,
    item.followups.map((followup) => `${followup.date}: ${followup.note}`).join('; '),
  ].map(escapeCsv).join(','));
  return [header, ...lines].join('\n');
}

export function fibreRouteFilename() {
  return 'fibre-routes.csv';
}
