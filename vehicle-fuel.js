// Plan 235 (Plan 203-350) — Vehicle and fuel log for field visits.
//
// Field travel across 11 mohallas is a real running cost, but it is
// remembered loosely, so the owner cannot tell what a month of field
// visits actually cost in fuel or which vehicle did the most work.
// This module adds only the missing piece: one log entry per vehicle
// per refuelling or trip — the vehicle, the date, the fuel amount and
// cost as entered, the odometer reading if known, and the visits the
// entry covered.
//
// One log entry: the id, the vehicle, a strict calendar date, the
// fuel amount in litres as entered, the cost as entered, the odometer
// reading if known, and the visits covered.
//
// The fences, stated plainly:
//   - This records vehicle and fuel only. It is not the field visit
//     time and travel log (Plan 155), which records visit time, and
//     it is not the generator fuel log (Plan 135), which records fuel
//     for a generator: those modules are neither read nor rewritten
//     here, and this module imports nothing.
//   - An entry is never edited, only corrected by a dated follow-up
//     note. There is no edit function: only record, follow up, and
//     remove. A follow-up note never rewrites the vehicle, the date,
//     the fuel amount, the cost, the odometer, or the visits.
//   - Fuel entries per vehicle sum to a monthly total that matches
//     the entries listed for that month, and each entry names the
//     visits it covered.
//   - Recording fuel never changes any bill, payment, customer,
//     visit, or expense total by itself: the module takes no bill,
//     payment, customer, visit, or expense object in, edits none,
//     and returns none. It holds vehicle fuel entries only.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validVehicleFuelDate(value) {
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

function validMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function cleanVisits(value) {
  const raw = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const visit = text(item);
    if (visit && !seen.has(visit)) {
      seen.add(visit);
      out.push(visit);
    }
  }
  return out;
}

function cleanFollowUps(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const note = text(item.note);
    if (validVehicleFuelDate(date) && note) out.push({ date, note });
  }
  return out;
}

function cleanCostCents(entry) {
  if (Number.isInteger(entry.costCents) && entry.costCents >= 0) return entry.costCents;
  const cost = Number(entry.cost);
  if (Number.isFinite(cost) && cost >= 0) return Math.round(cost * 100);
  return null;
}

function cleanEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const vehicle = text(entry.vehicle);
  const date = text(entry.date);
  const fuel = Number(entry.fuelLitres);
  if (!id || !vehicle || !validVehicleFuelDate(date)) return null;
  if (!Number.isFinite(fuel) || fuel <= 0) return null;
  const costCents = cleanCostCents(entry);
  if (costCents === null) return null;
  const visits = cleanVisits(entry.visits);
  if (!visits.length) return null;
  let odometer = null;
  if (entry.odometer !== undefined && entry.odometer !== null && entry.odometer !== '') {
    const reading = Number(entry.odometer);
    if (!Number.isFinite(reading) || reading < 0) return null;
    odometer = reading;
  }
  return {
    id,
    vehicle,
    date,
    fuelLitres: fuel,
    costCents,
    odometer,
    visits,
    followUps: cleanFollowUps(entry.followUps),
  };
}

export function normalizeVehicleFuelList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const clean = cleanEntry(entry);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

export function recordVehicleFuel(list, entry) {
  const clean = cleanEntry(entry);
  const base = normalizeVehicleFuelList(list);
  if (!clean) return base;
  if (base.some((item) => item.id === clean.id)) return base;
  return [...base, clean];
}

export function removeVehicleFuel(list, id) {
  const target = text(id);
  return normalizeVehicleFuelList(list).filter((entry) => entry.id !== target);
}

export function findVehicleFuel(list, id) {
  const target = text(id);
  return normalizeVehicleFuelList(list).find((entry) => entry.id === target) || null;
}

export function vehicleFuelSorted(list) {
  return normalizeVehicleFuelList(list).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const va = a.vehicle.toLowerCase();
    const vb = b.vehicle.toLowerCase();
    if (va !== vb) return va < vb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function vehicleFuelForVehicle(list, vehicle) {
  const needle = text(vehicle).toLowerCase();
  if (!needle) return vehicleFuelSorted(list);
  return vehicleFuelSorted(list).filter((entry) => entry.vehicle.toLowerCase().includes(needle));
}

export function vehicleFuelVehicles(list) {
  const seen = new Map();
  for (const entry of normalizeVehicleFuelList(list)) {
    const key = entry.vehicle.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.vehicle);
  }
  return [...seen.values()].sort((a, b) => {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    return la < lb ? -1 : la > lb ? 1 : 0;
  });
}

export function vehicleFuelMonthlyEntries(list, vehicle, month) {
  if (!validMonth(month)) return [];
  const target = text(vehicle).toLowerCase();
  return vehicleFuelSorted(list).filter((entry) => {
    return entry.date.slice(0, 7) === month && (!target || entry.vehicle.toLowerCase() === target);
  });
}

export function vehicleFuelMonthlyTotal(list, vehicle, month) {
  if (!validMonth(month)) return null;
  const entries = vehicleFuelMonthlyEntries(list, vehicle, month);
  let fuelLitres = 0;
  let costCents = 0;
  for (const entry of entries) {
    fuelLitres += entry.fuelLitres;
    costCents += entry.costCents;
  }
  return { count: entries.length, fuelLitres, costCents };
}

export function addVehicleFuelFollowUp(list, id, date, note) {
  const base = normalizeVehicleFuelList(list);
  const target = text(id);
  const followDate = text(date);
  const followNote = text(note);
  if (!validVehicleFuelDate(followDate) || !followNote) return base;
  return base.map((entry) => {
    if (entry.id !== target) return entry;
    return { ...entry, visits: [...entry.visits], followUps: [...entry.followUps, { date: followDate, note: followNote }] };
  });
}

function moneyRs(costCents) {
  return (costCents / 100).toFixed(2);
}

export function vehicleFuelSummaryText(list) {
  const clean = normalizeVehicleFuelList(list);
  const vehicles = vehicleFuelVehicles(clean);
  let costCents = 0;
  let fuelLitres = 0;
  for (const entry of clean) {
    costCents += entry.costCents;
    fuelLitres += entry.fuelLitres;
  }
  return `${clean.length} fuel entries across ${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}: ${fuelLitres} litres, Rs. ${moneyRs(costCents)} in total.`;
}

export function vehicleFuelMonthlySummaryText(list, vehicle, month) {
  const total = vehicleFuelMonthlyTotal(list, vehicle, month);
  if (!total) return 'No monthly total: the month must be YYYY-MM.';
  const name = text(vehicle) || 'all vehicles';
  return `${name}, ${month}: ${total.count} entries, ${total.fuelLitres} litres, Rs. ${moneyRs(total.costCents)}.`;
}

export function vehicleFuelText(entry) {
  const clean = cleanEntry(entry);
  if (!clean) return '';
  const odometer = clean.odometer === null ? 'Odometer not noted.' : `Odometer ${clean.odometer}.`;
  const visits = `Visits covered: ${clean.visits.join(', ')}.`;
  const followUps = clean.followUps.length
    ? ` Follow-ups: ${clean.followUps.map((item) => `${item.date}: ${item.note}`).join('; ')}.`
    : '';
  return `${clean.vehicle} on ${clean.date}: ${clean.fuelLitres} litres, Rs. ${moneyRs(clean.costCents)}. ${odometer} ${visits}${followUps}`;
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function vehicleFuelHtml(entry) {
  const clean = cleanEntry(entry);
  if (!clean) return '';
  return `<p>${esc(vehicleFuelText(clean))}</p>`;
}

export function vehicleFuelCsv(list) {
  const rows = [['id', 'vehicle', 'date', 'fuel litres', 'cost Rs', 'odometer', 'visits covered', 'follow-ups']];
  for (const entry of vehicleFuelSorted(list)) {
    rows.push([
      entry.id,
      entry.vehicle,
      entry.date,
      String(entry.fuelLitres),
      moneyRs(entry.costCents),
      entry.odometer === null ? '' : String(entry.odometer),
      entry.visits.join('; '),
      entry.followUps.map((item) => `${item.date}: ${item.note}`).join('; '),
    ]);
  }
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function vehicleFuelFilename() {
  return 'vehicle-fuel-log.csv';
}
