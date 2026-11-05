// Plan 248 (Plan 203-350) — Splitter port occupancy record.
//
// Nobody knows which splitter ports are actually in use, so a new
// connection is planned against a splitter that is already full, or
// a free port sits unused. This module adds only the missing piece:
// one occupancy record per splitter port — the splitter reference,
// the segment, the port number, the status free or occupied, the
// customer if occupied, and the date it was last updated.
//
// The fences, stated plainly:
//   - This records occupancy only. It does not replace the segment
//     fault history (Plan 133), which records faults per segment:
//     no fault record is read nor rewritten here, and this module
//     imports nothing.
//   - It is not the optical splitter map (SISP-24), which derives
//     a port map from the customer records, and it is not the
//     splitter port swap and dead-port lockout (SISP-152): neither
//     record is read nor rewritten here. The map shows which
//     customer a port feeds; this record says, port by port,
//     whether the port is free or occupied, with a dated history
//     of every occupancy change.
//   - Each splitter shows free versus occupied ports as counts
//     that sum to its total ports, and no port shows two customers
//     at once: one record per splitter and port number, an
//     occupied port names exactly one customer, and a free port
//     names none.
//   - Occupancy updates are kept as dated entries, never silent
//     overwrites: there is no edit function, only record, update,
//     and remove. An update appends a dated entry and moves the
//     current status forward; the earlier entries stay in the
//     record's history.
//   - Recording occupancy never changes any bill, payment,
//     customer, or fault record by itself: the module takes no
//     bill, payment, customer, or fault object in, edits none,
//     and returns none. It holds occupancy records only.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const SPLITTER_OCCUPANCY_STORE = 'shahdara_splitter_occupancy_v1';
export const SPLITTER_OCCUPANCY_FILENAME = 'splitter-occupancy.csv';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validSplitterOccupancyDate(value) {
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

function cleanStatus(value) {
  const status = text(value).toLowerCase();
  if (status === 'free' || status === 'occupied') return status;
  return '';
}

function cleanPort(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const num = Number(value.trim());
    if (Number.isInteger(num) && num > 0) return num;
  }
  return 0;
}

function cleanUpdates(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const status = cleanStatus(item.status);
    if (!validSplitterOccupancyDate(date) || !status) continue;
    const customer = status === 'occupied' ? text(item.customer) : '';
    if (status === 'occupied' && !customer) continue;
    out.push({ date, status, customer });
  }
  return out;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const splitter = text(entry.splitter);
  const segment = text(entry.segment);
  const port = cleanPort(entry.port);
  const status = cleanStatus(entry.status);
  const date = text(entry.date);
  if (!id || !splitter || !segment || !port || !status) return null;
  if (!validSplitterOccupancyDate(date)) return null;
  const customer = status === 'occupied' ? text(entry.customer) : '';
  if (status === 'occupied' && !customer) return null;
  return {
    id,
    splitter,
    segment,
    port,
    status,
    customer,
    date,
    updates: cleanUpdates(entry.updates),
  };
}

export function normalizeSplitterOccupancyList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenPorts = new Set();
  const out = [];
  for (const entry of list) {
    const clean = normalizeEntry(entry);
    if (!clean) continue;
    if (seenIds.has(clean.id)) continue;
    const portKey = `${clean.splitter.toLowerCase()}#${clean.port}`;
    if (seenPorts.has(portKey)) continue;
    seenIds.add(clean.id);
    seenPorts.add(portKey);
    out.push(clean);
  }
  return out;
}

// One record per splitter and port number: a second record for the
// same port is refused, so no port can ever show two customers.
export function recordSplitterPort(list, entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return null;
  const base = normalizeSplitterOccupancyList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  if (
    base.some(
      (item) =>
        item.splitter.toLowerCase() === clean.splitter.toLowerCase() &&
        item.port === clean.port,
    )
  ) {
    return base;
  }
  return [...base, clean];
}

export function removeSplitterPort(list, id) {
  const base = normalizeSplitterOccupancyList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findSplitterPort(list, id) {
  const base = normalizeSplitterOccupancyList(list);
  return base.find((item) => item.id === text(id)) || null;
}

// An occupancy change is a dated entry, never a silent overwrite:
// the update is appended to the record's history and the current
// status, customer, and date move forward with it.
export function updateSplitterPort(list, id, update) {
  const base = normalizeSplitterOccupancyList(list);
  const target = text(id);
  if (!update || typeof update !== 'object') return list;
  const date = text(update.date);
  const status = cleanStatus(update.status);
  if (!validSplitterOccupancyDate(date) || !status) return list;
  const customer = status === 'occupied' ? text(update.customer) : '';
  if (status === 'occupied' && !customer) return list;
  if (!base.some((item) => item.id === target)) return list;
  return base.map((item) =>
    item.id === target
      ? {
          ...item,
          status,
          customer,
          date,
          updates: [...item.updates, { date, status, customer }],
        }
      : item,
  );
}

export function splitterOccupancySorted(list) {
  const base = normalizeSplitterOccupancyList(list);
  return [...base].sort((a, b) => {
    const bySplitter = a.splitter
      .toLowerCase()
      .localeCompare(b.splitter.toLowerCase());
    if (bySplitter !== 0) return bySplitter;
    if (a.port !== b.port) return a.port - b.port;
    return a.id.localeCompare(b.id);
  });
}

export function splitterPortsForSplitter(list, splitter) {
  const wanted = text(splitter).toLowerCase();
  if (!wanted) return [];
  return splitterOccupancySorted(list).filter(
    (item) => item.splitter.toLowerCase() === wanted,
  );
}

export function splitterOccupancySplitters(list) {
  const base = normalizeSplitterOccupancyList(list);
  const found = new Map();
  for (const item of base) {
    const key = item.splitter.toLowerCase();
    if (!found.has(key)) found.set(key, item.splitter);
  }
  return [...found.values()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}

// Free versus occupied counts for one splitter: they always sum to
// the splitter's total recorded ports. Returns null when the
// splitter has no recorded ports.
export function splitterOccupancyCounts(list, splitter) {
  const ports = splitterPortsForSplitter(list, splitter);
  if (ports.length === 0) return null;
  const occupied = ports.filter((item) => item.status === 'occupied').length;
  return {
    splitter: ports[0].splitter,
    total: ports.length,
    free: ports.length - occupied,
    occupied,
  };
}

export function splitterOccupancySummaries(list) {
  return splitterOccupancySplitters(list)
    .map((splitter) => splitterOccupancyCounts(list, splitter))
    .filter((entry) => entry !== null);
}

export function fullyOccupiedSplitters(list) {
  return splitterOccupancySummaries(list).filter(
    (entry) => entry.total > 0 && entry.free === 0,
  );
}

export function splitterOccupancySummaryText(list) {
  const base = normalizeSplitterOccupancyList(list);
  const splitters = splitterOccupancySplitters(base);
  const occupied = base.filter((item) => item.status === 'occupied').length;
  const free = base.length - occupied;
  const portWord = base.length === 1 ? 'port' : 'ports';
  const splitterWord = splitters.length === 1 ? 'splitter' : 'splitters';
  const full = fullyOccupiedSplitters(base);
  const fullText =
    full.length === 0
      ? 'No splitter is full.'
      : `${full.length} splitter${full.length === 1 ? ' is' : 's are'} full: ${full
          .map((entry) => entry.splitter)
          .join(', ')}.`;
  return (
    `${base.length} ${portWord} across ${splitters.length} ${splitterWord}: ` +
    `${free} free, ${occupied} occupied. ` +
    fullText
  );
}

export function splitterOccupancyText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '';
  const state =
    clean.status === 'occupied'
      ? `occupied by ${clean.customer}`
      : 'free';
  const updates =
    clean.updates.length === 0
      ? 'No occupancy updates yet.'
      : `${clean.updates.length} dated occupancy update${clean.updates.length === 1 ? '' : 's'}, latest ${clean.updates[clean.updates.length - 1].date}.`;
  return (
    `Splitter ${clean.splitter} port ${clean.port} (${clean.segment}): ` +
    `${state} as of ${clean.date}. ${updates}`
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function splitterOccupancyHtml(list) {
  const rows = splitterOccupancySorted(list);
  if (rows.length === 0) return '<p>No splitter ports recorded.</p>';
  const items = rows
    .map((item) => `<li>${escapeHtml(splitterOccupancyText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function splitterOccupancyCsv(list) {
  const rows = splitterOccupancySorted(list);
  const header = [
    'id',
    'splitter',
    'segment',
    'port',
    'status',
    'customer',
    'date updated',
    'occupancy updates',
  ]
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.splitter,
      item.segment,
      item.port,
      item.status,
      item.customer,
      item.date,
      item.updates
        .map((u) => `${u.date}: ${u.status}${u.customer ? ` (${u.customer})` : ''}`)
        .join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function splitterOccupancyFilename() {
  return SPLITTER_OCCUPANCY_FILENAME;
}
