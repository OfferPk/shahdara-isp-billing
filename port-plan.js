// Plan 233 (Plan 203-350) — OLT port planning record.
//
// Future connections are promised against ports nobody has reserved
// on paper, so two promised connections can collide on the same port
// when installation day arrives. This module adds only the missing
// piece: one planning record per port of one unit — the unit, the
// port number, the status planned or used, the customer or mohalla
// it is planned for, and the date planned.
//
// One planning record: the id, the unit, the port number, the status,
// the customer or mohalla it is planned for, the date planned, and,
// once converted, the customer connected.
//
// The fences, stated plainly:
//   - This plans only and never assigns equipment. It does not
//     replace the port and ONU assignment register (Plan 17), the
//     capacity forecast (Plan 26), or the second-unit migration log
//     (Plan 181): those are neither read nor rewritten here, and
//     this module imports nothing.
//   - Planned ports and used ports are listed separately per unit
//     and never double-count the same port: one record per unit and
//     port, and converting a planned port to used names the customer
//     connected.
//   - A record is never edited: only record, convert to used, and
//     remove. Converting changes only the status and the connected
//     customer; the unit, port, planned-for, and date planned stay
//     exactly as recorded.
//   - Recording a plan never changes any bill, payment, customer,
//     or assignment record by itself: the module takes no bill,
//     payment, customer, or assignment object in, edits none, and
//     returns none. It holds port plans only.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validOltPortPlanDate(value) {
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
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanPlan(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const unit = text(raw.unit);
  const port = text(raw.port);
  const datePlanned = text(raw.datePlanned);
  if (!id || !unit || !port || !validOltPortPlanDate(datePlanned)) return null;
  return {
    id,
    unit,
    port,
    status: raw.status === 'used' ? 'used' : 'planned',
    plannedFor: text(raw.plannedFor),
    datePlanned,
    customerConnected: text(raw.customerConnected),
  };
}

function samePort(a, b) {
  return a.unit.toLowerCase() === b.unit.toLowerCase() && a.port.toLowerCase() === b.port.toLowerCase();
}

export function normalizeOltPortPlanList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenPorts = [];
  const out = [];
  for (const raw of list) {
    const plan = cleanPlan(raw);
    if (!plan) continue;
    if (seenIds.has(plan.id)) continue;
    if (seenPorts.some((kept) => samePort(kept, plan))) continue;
    seenIds.add(plan.id);
    seenPorts.push(plan);
    out.push(plan);
  }
  return out;
}

export function recordOltPortPlan(list, raw) {
  const base = normalizeOltPortPlanList(list);
  const plan = cleanPlan(raw);
  if (!plan) return null;
  if (base.some((item) => item.id === plan.id)) return null;
  if (base.some((item) => samePort(item, plan))) return null;
  return [...base, plan];
}

export function removeOltPortPlan(list, id) {
  const base = normalizeOltPortPlanList(list);
  const wanted = text(id);
  if (!wanted) return base;
  return base.filter((item) => item.id !== wanted);
}

export function findOltPortPlan(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeOltPortPlanList(list).find((item) => item.id === wanted) ?? null;
}

export function convertOltPortPlanToUsed(list, id, customerConnected) {
  const base = normalizeOltPortPlanList(list);
  const customer = text(customerConnected);
  const wanted = text(id);
  if (!wanted || !customer) return null;
  const target = base.find((item) => item.id === wanted);
  if (!target || target.status === 'used') return null;
  return base.map((item) =>
    item.id === wanted ? { ...item, status: 'used', customerConnected: customer } : item,
  );
}

function comparePort(a, b) {
  const aNum = /^\d+$/.test(a) ? Number(a) : null;
  const bNum = /^\d+$/.test(b) ? Number(b) : null;
  if (aNum !== null && bNum !== null) return aNum - bNum;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function byUnitThenPort(a, b) {
  if (a.unit < b.unit) return -1;
  if (a.unit > b.unit) return 1;
  const portOrder = comparePort(a.port, b.port);
  if (portOrder !== 0) return portOrder;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function oltPortPlansSorted(list) {
  return normalizeOltPortPlanList(list).slice().sort(byUnitThenPort);
}

export function oltPortPlansForUnit(list, unit) {
  const wanted = text(unit);
  if (!wanted) return [];
  return oltPortPlansSorted(list).filter((item) => item.unit.toLowerCase() === wanted.toLowerCase());
}

export function plannedOltPortPlans(list, unit) {
  const scoped = unit === undefined ? oltPortPlansSorted(list) : oltPortPlansForUnit(list, unit);
  return scoped.filter((item) => item.status === 'planned');
}

export function usedOltPortPlans(list, unit) {
  const scoped = unit === undefined ? oltPortPlansSorted(list) : oltPortPlansForUnit(list, unit);
  return scoped.filter((item) => item.status === 'used');
}

export function oltPortPlanUnits(list) {
  const units = [];
  for (const plan of normalizeOltPortPlanList(list)) {
    if (!units.includes(plan.unit)) units.push(plan.unit);
  }
  return units.sort();
}

export function oltPortPlanSummaryText(list) {
  const plans = normalizeOltPortPlanList(list);
  const units = oltPortPlanUnits(list);
  if (!plans.length) return 'No port plans recorded.';
  const planned = plans.filter((item) => item.status === 'planned').length;
  const used = plans.length - planned;
  return `${plans.length} port plan${plans.length === 1 ? '' : 's'} across ${units.length} unit${units.length === 1 ? '' : 's'}: ${planned} planned, ${used} used.`;
}

export function oltPortPlanText(plan) {
  if (!plan) return '';
  const clean = cleanPlan(plan);
  if (!clean) return '';
  const plannedFor = clean.plannedFor || 'No one noted';
  if (clean.status === 'used') {
    const connected = clean.customerConnected || 'No customer named';
    return `${clean.unit} port ${clean.port} — used, connected to ${connected} (planned for ${plannedFor} on ${clean.datePlanned}).`;
  }
  return `${clean.unit} port ${clean.port} — planned for ${plannedFor} on ${clean.datePlanned}.`;
}

export function oltPortPlanHtml(plan) {
  const clean = cleanPlan(plan);
  if (!clean) return '';
  return `<p>${escapeHtml(oltPortPlanText(clean))}</p>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

export function oltPortPlanCsv(list) {
  const rows = [['id', 'unit', 'port', 'status', 'plannedFor', 'datePlanned', 'customerConnected']];
  for (const plan of oltPortPlansSorted(list)) {
    rows.push([plan.id, plan.unit, plan.port, plan.status, plan.plannedFor, plan.datePlanned, plan.customerConnected]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function oltPortPlanFilename() {
  return 'olt-port-plans.csv';
}
