// Plan 26 — capacity forecast with a second-unit readiness signal.
//
// A read-only view built from the Plan 17 connection register only.
// It counts, per unit, the ports used, the ports free, and the
// customers per splitter segment, and it raises a visible readiness
// signal when a unit's used share reaches the operator-set threshold
// (default 80%). It never polls live hardware, never changes a
// customer, port or billing record, and never orders or provisions
// anything: the signal is information for the owner to budget and
// order in time, not an action.
//
// Honesty rules, mirroring Plan 17: a unit's free ports and used
// share are unknown (null), never guessed, unless the caller states
// that unit's total port count; a non-numeric used port also makes
// free unknown, because the free list cannot be enumerated. A record
// without a port still counts toward its unit's customer and splitter
// counts, but toward no used port. Changing the threshold changes
// only which units are signalled — never any record.

export const CAPACITY_FORECAST_DEFAULT_THRESHOLD = 80;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function upper(value) {
  return text(value).toUpperCase();
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

function compareNames(a, b) {
  const nameA = (a.customerName || a.customerId).toLowerCase();
  const nameB = (b.customerName || b.customerId).toLowerCase();
  if (nameA < nameB) return -1;
  if (nameA > nameB) return 1;
  return a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0;
}

function isNumericPort(port) {
  return /^\d+$/.test(port);
}

function comparePorts(a, b) {
  const numericA = isNumericPort(a);
  const numericB = isNumericPort(b);
  if (numericA && numericB) return Number(a) - Number(b);
  if (numericA) return -1;
  if (numericB) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

// The readiness threshold is a percent in (0, 100]. Anything else —
// zero, negative, over 100, non-numeric — falls back to the default
// as a whole, so an invalid setting can never signal everything or
// signal nothing.
export function normalizeCapacityThreshold(value) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0 && n <= 100) return n;
  return CAPACITY_FORECAST_DEFAULT_THRESHOLD;
}

export function normalizeCapacityRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const customerId = text(raw.customerId ?? raw.id);
  if (!customerId) return null;
  return {
    customerId,
    customerName: text(raw.customerName ?? raw.name),
    unitId: text(raw.unitId ?? raw.oltId ?? raw.olt ?? raw.oltName),
    ponPort: upper(raw.ponPort ?? raw.pon ?? raw.port),
    splitter: text(raw.splitter ?? raw.splitterId ?? raw.splitterBoxId ?? raw.box),
  };
}

// Records normalised, de-duplicated (last row per customer wins),
// sorted by customer name A–Z. Inputs are never mutated.
export function normalizeCapacityRecords(records) {
  const byCustomer = new Map();
  for (const raw of Array.isArray(records) ? records : []) {
    const normalised = normalizeCapacityRecord(raw);
    if (normalised) byCustomer.set(normalised.customerId, normalised);
  }
  return [...byCustomer.values()].sort(compareNames);
}

function normalizePortTotals(portTotals) {
  const totals = {};
  if (portTotals && typeof portTotals === 'object' && !Array.isArray(portTotals)) {
    for (const [unitId, total] of Object.entries(portTotals)) {
      const n = Number(total);
      if (text(unitId) && Number.isInteger(n) && n > 0) totals[text(unitId)] = n;
    }
  }
  return totals;
}

// The forecast. `records` are Plan 17 connection-register rows;
// `portTotals` maps a unit id to its caller-stated total port count;
// `options.threshold` is the readiness threshold percent.
export function buildCapacityForecast(records, portTotals, options = {}) {
  const normalised = normalizeCapacityRecords(records);
  const totals = normalizePortTotals(portTotals);
  const threshold = normalizeCapacityThreshold(options.threshold ?? options.readinessThreshold);
  const byUnit = new Map();
  const ensure = (unitId) => {
    if (!byUnit.has(unitId)) byUnit.set(unitId, { unitId, rows: [] });
    return byUnit.get(unitId);
  };
  for (const record of normalised) ensure(record.unitId).rows.push(record);
  for (const unitId of Object.keys(totals)) ensure(unitId);
  const units = [...byUnit.values()].map((group) => {
    const holders = group.rows.filter((r) => r.ponPort);
    const usedPorts = [...new Set(holders.map((r) => r.ponPort))].sort(comparePorts);
    const totalPorts = totals[group.unitId] ?? null;
    const allNumeric = usedPorts.every(isNumericPort);
    let freePorts = null;
    if (totalPorts !== null && allNumeric) {
      const usedNumbers = new Set(usedPorts.map(Number));
      freePorts = [];
      for (let port = 1; port <= totalPorts; port += 1) {
        if (!usedNumbers.has(port)) freePorts.push(String(port));
      }
    }
    const usedPercent = totalPorts === null ? null : round1((usedPorts.length / totalPorts) * 100);
    const signal = usedPercent !== null && usedPercent >= threshold;
    const splitterCounts = new Map();
    for (const row of group.rows) {
      const key = row.splitter || '';
      splitterCounts.set(key, (splitterCounts.get(key) ?? 0) + 1);
    }
    const splitters = [...splitterCounts.entries()].map(([splitter, customerCount]) => ({
      splitter,
      label: splitter || 'No splitter recorded',
      customerCount,
    })).sort((a, b) => b.customerCount - a.customerCount || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
    return {
      unitId: group.unitId,
      label: group.unitId || 'Unassigned',
      usedPorts,
      usedCount: usedPorts.length,
      totalPorts,
      freePorts,
      freeCount: freePorts === null ? null : freePorts.length,
      usedPercent,
      signal,
      trigger: signal
        ? { usedCount: usedPorts.length, totalPorts, usedPercent, threshold }
        : null,
      customerCount: group.rows.length,
      customersWithoutPort: group.rows.length - holders.length,
      splitters,
    };
  }).sort((a, b) => (a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0));
  const signalled = units.filter((u) => u.signal);
  return {
    units,
    threshold,
    totalRecords: normalised.length,
    totalUsed: new Set(normalised.filter((r) => r.ponPort).map((r) => `${r.unitId}\n${r.ponPort}`)).size,
    signalledUnits: signalled.map((u) => u.unitId),
    signalCount: signalled.length,
    overallSignal: signalled.length ? signalled[0].trigger : null,
    overallSignalUnit: signalled.length ? signalled[0].label : null,
  };
}

export function capacityForecastSummaryText(forecast) {
  const units = forecast?.units ?? [];
  const signalCount = forecast?.signalCount ?? 0;
  const signalNote = signalCount
    ? ` · ${signalCount} readiness signal${signalCount === 1 ? '' : 's'} at ${forecast.threshold}%`
    : ` · no unit at the ${forecast?.threshold ?? CAPACITY_FORECAST_DEFAULT_THRESHOLD}% threshold`;
  return `${units.length} unit${units.length === 1 ? '' : 's'} · ${forecast?.totalUsed ?? 0} port${(forecast?.totalUsed ?? 0) === 1 ? '' : 's'} used${signalNote}`;
}

export function capacityForecastHtml(forecast) {
  const units = forecast?.units ?? [];
  const banner = forecast?.overallSignal
    ? `<p class="capacity-signal">⚠️ Readiness signal: ${escapeHtml(forecast.overallSignalUnit)} is at ${forecast.overallSignal.usedCount} of ${forecast.overallSignal.totalPorts} ports used (${forecast.overallSignal.usedPercent}%, threshold ${forecast.overallSignal.threshold}%) — start planning the second unit now, before new connections cannot be placed.</p>`
    : '<p>No unit has reached the readiness threshold yet.</p>';
  const unitRows = units.map((u) => `<tr><td>${escapeHtml(u.label)}</td><td>${u.usedCount}</td><td>${u.freeCount === null ? 'Unknown (set total ports)' : u.freeCount}</td><td>${u.totalPorts === null ? '—' : u.totalPorts}</td><td>${u.usedPercent === null ? '—' : `${u.usedPercent}%`}</td><td>${u.customerCount}</td><td>${u.signal ? '⚠️ At threshold' : '—'}</td></tr>`).join('');
  const splitterRows = units.flatMap((u) => u.splitters.map((s) => `<tr><td>${escapeHtml(u.label)}</td><td>${escapeHtml(s.label)}</td><td>${s.customerCount}</td></tr>`)).join('');
  // Owner 5-part fix: the seven-column ports table scrolls inside its
  // own card on a phone instead of clipping the right-side columns.
  // (The narrow three-column splitter table fits and keeps no wrapper.)
  return `<div class="capacity-forecast">${banner}<h4>Ports per unit — used versus free</h4><div class="table-scroll"><table><thead><tr><th>Unit</th><th>Used ports</th><th>Free ports</th><th>Total ports</th><th>Used</th><th>Customers</th><th>Signal</th></tr></thead><tbody>${unitRows || '<tr><td colspan="7">No connection records yet</td></tr>'}</tbody></table></div><h4>Customers per splitter segment</h4><table><thead><tr><th>Unit</th><th>Splitter</th><th>Customers</th></tr></thead><tbody>${splitterRows || '<tr><td colspan="3">No connection records yet</td></tr>'}</tbody></table></div>`;
}

export function capacityForecastCsv(forecast) {
  const header = 'Unit,Used ports,Free ports,Total ports,Used %,Customers,Splitters,Signal';
  const rows = (forecast?.units ?? []).map((u) => [
    u.label,
    u.usedCount,
    u.freeCount === null ? 'Unknown' : u.freeCount,
    u.totalPorts === null ? '' : u.totalPorts,
    u.usedPercent === null ? '' : `${u.usedPercent}%`,
    u.customerCount,
    u.splitters.map((s) => `${s.label}: ${s.customerCount}`).join('; '),
    u.signal ? 'At threshold' : '',
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function capacityForecastFilename() {
  return 'capacity-forecast.csv';
}
