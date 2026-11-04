// Plan 157 (Plan 101-202) — Equipment Swap Pairing Record.
//
// When an ONU or router is swapped at the same premises, the old
// and new units are not paired, so the history of that premises
// splits: the old box's story ends and the new box's story starts
// with no link between them. This module is the pairing: one
// swap record per replacement with a customer, an old unit
// identifier, a new unit identifier, a date, and a reason. A
// customer page shows its swap pairs in date order, so a swapped
// unit's history stays traceable instead of vanishing with the
// old box.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of any neighbouring module.
//     No existing module records an old-to-new unit pairing
//     per customer: the splitter port swap (splitter-port-swap.js)
//     locks faulty splitter ports and guards port occupancy on
//     the port map, the equipment cycle (equipment-cycle.js)
//     tracks calibration and replacement cycles, and the
//     premises check (premises-check.js) records equipment
//     condition per visit — and none of them is read or
//     written here. A swap record names a customer and two
//     unit identifiers only.
//   - It is not an action on any other record. Recording a
//     pairing here never moves, retires, or rewrites any other
//     record anywhere else: the pairing only says that, on
//     this date, this customer's old unit was replaced by
//     this new unit, for this reason.
//   - It is not proof that a swap happened. The record says
//     what the operator recorded; the module verifies format
//     and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a customer, an old
//     unit identifier, a new unit identifier, and a real date.
//     A swap with no old or no new identifier is refused
//     outright, as is any impossible date. Unknown fields are
//     dropped, so a record can never grow a field from any
//     other record type.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal of the record itself.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
function strictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  if (day < 1 || day > limit) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one swap record, or null when half-formed. */
export function normalizeSwapPairing(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const oldUnit = cleanText(record.oldUnit);
  const newUnit = cleanText(record.newUnit);
  const date = strictDate(record.date);
  if (!id || !customer || !oldUnit || !newUnit || !date) return null;
  return { id, customer, oldUnit, newUnit, date, reason: cleanText(record.reason) };
}

/** Normalize a list: half-formed records dropped, order kept. */
export function normalizeSwapPairingList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const clean = normalizeSwapPairing(record);
    if (clean) out.push(clean);
  }
  return out;
}

/** Find one swap record by id, or null. */
export function findSwapPairing(list, id) {
  const clean = normalizeSwapPairingList(list);
  const want = cleanText(id);
  return clean.find((item) => item.id === want) || null;
}

/**
 * Add a swap record, or leave the list unchanged when the
 * record is half-formed or a duplicate id carrying different
 * figures. An identical re-save leaves the list unchanged.
 */
export function upsertSwapPairing(list, record) {
  const clean = normalizeSwapPairingList(list);
  const next = normalizeSwapPairing(record);
  if (!next) return clean;
  const existing = clean.find((item) => item.id === next.id);
  if (existing) {
    const same = existing.customer === next.customer
      && existing.oldUnit === next.oldUnit
      && existing.newUnit === next.newUnit
      && existing.date === next.date
      && existing.reason === next.reason;
    return same ? clean : clean;
  }
  return [...clean, next];
}

/** Remove a swap record by id; unknown ids leave the list unchanged. */
export function removeSwapPairing(list, id) {
  const clean = normalizeSwapPairingList(list);
  const want = cleanText(id);
  return clean.filter((item) => item.id !== want);
}

/** Swaps for one customer (case-insensitive), in date order, then id A-Z. */
export function customerSwaps(list, customer) {
  const want = cleanText(customer).toLowerCase();
  if (!want) return [];
  const clean = normalizeSwapPairingList(list).filter((item) => item.customer.toLowerCase() === want);
  clean.sort((a, b) => compareText(a.date, b.date) || compareText(a.id, b.id));
  return clean;
}

/** Every customer present, A-Z (case-insensitive, first spelling kept). */
export function swapPairingCustomers(list) {
  const clean = normalizeSwapPairingList(list);
  const seen = new Map();
  for (const item of clean) {
    const key = item.customer.toLowerCase();
    if (!seen.has(key)) seen.set(key, item.customer);
  }
  return [...seen.values()].sort((a, b) => compareText(a.toLowerCase(), b.toLowerCase()));
}

/** Summary text: records / customers counts. */
export function swapPairingSummaryText(list) {
  const clean = normalizeSwapPairingList(list);
  const customers = swapPairingCustomers(list).length;
  return `${clean.length} swap pair${clean.length === 1 ? '' : 's'} across ${customers} customer${customers === 1 ? '' : 's'}.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function swapRowHtml(item) {
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.customer)}</td>`
    + `<td>${esc(item.oldUnit)}</td><td>${esc(item.newUnit)}</td>`
    + `<td>${esc(item.date)}</td><td>${esc(item.reason || '—')}</td></tr>`;
}

function swapTableHtml(rows, intro) {
  const body = rows.map((item) => swapRowHtml(item)).join('');
  return `<p>${intro}</p>`
    + '<table><thead><tr><th>Id</th><th>Customer</th>'
    + '<th>Old unit</th><th>New unit</th><th>Date</th><th>Reason</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

/** All swap records as HTML, in date order (then id A-Z). */
export function swapPairingAllHtml(list) {
  const clean = normalizeSwapPairingList(list);
  if (clean.length === 0) return '<p>No equipment swaps recorded yet.</p>';
  clean.sort((a, b) => compareText(a.date, b.date) || compareText(a.id, b.id));
  return swapTableHtml(clean, 'All equipment swap pairings, in date order.');
}

/** One customer as HTML: its swap pairs in date order. */
export function swapPairingCustomerHtml(list, customer) {
  const records = customerSwaps(list, customer);
  if (records.length === 0) {
    const want = cleanText(customer);
    return want
      ? `<p>No equipment swap recorded for ${esc(want)}. This customer's unit history is unbroken so far.</p>`
      : '<p>Pick a customer to see its swap pairs.</p>';
  }
  const first = records[0];
  return `<p>Swap pairs for ${esc(first.customer)}, in date order — each old unit paired with the unit that replaced it.</p>`
    + swapTableHtml(records, 'Swap history for this customer.');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of swap records. */
export function swapPairingCsv(list) {
  const rows = normalizeSwapPairingList(list);
  const lines = ['id,customer,oldUnit,newUnit,date,reason'];
  for (const item of rows) {
    lines.push([item.id, item.customer, item.oldUnit, item.newUnit, item.date, item.reason].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the swap pairing log. */
export function swapPairingFilename() {
  return 'swap-pairings.csv';
}
