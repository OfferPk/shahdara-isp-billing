// Plan 149 (Plan 101-202) — Customer premises equipment check.
//
// ONU, router, and power adapter condition at a premises is only
// checked when something breaks. This module is that routine check:
// one premises check per visit, with a customer, a date, the ONU
// condition, the router condition, the adapter condition, and a
// note. A customer page shows its checks newest first with any poor
// item flagged, so a failing adapter or an overheating ONU is caught
// on a routine visit, not on a complaint visit.
//
// What this module is NOT, stated plainly:
//   - It is not a device record. No device is registered, moved,
//     or retired here, and no device record is read or written.
//   - It is not a warranty record. The warranty-returns module is
//     neither read nor written here: a check never opens,
//     extends, or closes a warranty claim.
//   - It is not a signal reading. The hand-recorded ONU signal
//     trend module is neither read nor written here: a check
//     records a condition (good/watch/poor), never a dBm value.
//   - It is not a bill or a payment. Nothing here touches any
//     bill or payment, and a check by itself changes no device,
//     warranty, bill, or payment record of any kind.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed checks are refused outright, never stored
//     half-formed: a check needs an id, a customer, and a real
//     calendar date. A check with no customer or no date is
//     refused, and so is one with an impossible date. Unknown
//     fields are dropped, so a check can never grow a device,
//     warranty, bill, or payment field.
//   - Conditions are exactly good, watch, or poor. An unknown
//     condition is recorded as watch, never as a fourth state.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validPremisesCheckDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  if (day > limit) return null;
  return value;
}

/** Condition: good, watch, or poor; anything else becomes watch. */
export function cleanPremisesCondition(value) {
  if (value === 'good' || value === 'poor') return value;
  return 'watch';
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Normalize one raw check, or null when it is half-formed. */
export function normalizePremisesCheckRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const customer = cleanText(raw.customer);
  const date = validPremisesCheckDate(raw.date);
  if (!id || !customer || !date) return null;
  return {
    id,
    customer,
    date,
    onu: cleanPremisesCondition(raw.onu),
    router: cleanPremisesCondition(raw.router),
    adapter: cleanPremisesCondition(raw.adapter),
    note: cleanText(raw.note),
  };
}

/** Normalize a list: drop half-formed rows, keep first of each id. */
export function normalizePremisesCheckList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const row = normalizePremisesCheckRecord(raw);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/** Find one check by id, or null. */
export function findPremisesCheckRecord(list, id) {
  const clean = normalizePremisesCheckList(list);
  return clean.find((row) => row.id === id) ?? null;
}

/**
 * Upsert one check. An identical re-save leaves the list unchanged;
 * a re-save with different figures, or a half-formed check, is
 * refused and the list is returned unchanged.
 */
export function upsertPremisesCheckRecord(list, raw) {
  const clean = normalizePremisesCheckList(list);
  const row = normalizePremisesCheckRecord(raw);
  if (!row) return clean;
  const existing = clean.find((item) => item.id === row.id);
  if (existing) return clean; // identical re-save: unchanged; different figures: refused, also unchanged.
  return [...clean, row];
}

/** Remove one check by id. */
export function removePremisesCheckRecord(list, id) {
  return normalizePremisesCheckList(list).filter((row) => row.id !== id);
}

/** Checks for one customer, newest first, then id A-Z. */
export function checksForPremisesCustomer(list, customer) {
  const name = cleanText(customer);
  if (!name) return [];
  return normalizePremisesCheckList(list)
    .filter((row) => row.customer.toLowerCase() === name.toLowerCase())
    .sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
}

/** The item names ('ONU', 'Router', 'Adapter') flagged poor on a check. */
export function poorPremisesItems(check) {
  const row = normalizePremisesCheckRecord(check);
  if (!row) return [];
  const poor = [];
  if (row.onu === 'poor') poor.push('ONU');
  if (row.router === 'poor') poor.push('Router');
  if (row.adapter === 'poor') poor.push('Adapter');
  return poor;
}

/** One-line summary: checks, customers, and checks with a poor item. */
export function premisesCheckSummaryText(list) {
  const clean = normalizePremisesCheckList(list);
  if (clean.length === 0) return 'No premises check recorded yet.';
  const customers = new Set(clean.map((row) => row.customer.toLowerCase())).size;
  const poor = clean.filter((row) => poorPremisesItems(row).length > 0).length;
  return `${clean.length} premises check${clean.length === 1 ? '' : 's'} across `
    + `${customers} customer${customers === 1 ? '' : 's'}; `
    + `${poor} with a poor item flagged.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function checkRowHtml(row) {
  const poor = poorPremisesItems(row);
  const flag = poor.length === 0
    ? '—'
    : `<strong>⚠ Poor: ${esc(poor.join(', '))}</strong>`;
  return `<tr><td>${esc(row.date)}</td><td>${esc(row.onu)}</td>`
    + `<td>${esc(row.router)}</td><td>${esc(row.adapter)}</td>`
    + `<td>${flag}</td><td>${esc(row.note)}</td><td>${esc(row.id)}</td></tr>`;
}

function checkTableHtml(rows) {
  return '<table><thead><tr><th>Date</th><th>ONU</th><th>Router</th>'
    + '<th>Adapter</th><th>Flag</th><th>Note</th><th>Id</th></tr></thead><tbody>'
    + rows.map(checkRowHtml).join('') + '</tbody></table>';
}

/**
 * The customer page: that customer's checks newest first, with any
 * poor item flagged. A customer with no check says so plainly.
 */
export function premisesCustomerChecksHtml(list, customer) {
  const name = cleanText(customer);
  if (!name) return '<p>Pick a customer to see their premises checks.</p>';
  const rows = checksForPremisesCustomer(list, name);
  if (rows.length === 0) return `<p>No premises check recorded for ${esc(name)} yet.</p>`;
  return `<p><strong>${esc(name)} — ${rows.length} check${rows.length === 1 ? '' : 's'}, newest first.</strong></p>`
    + checkTableHtml(rows);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of checks. */
export function premisesCheckCsv(list) {
  const rows = normalizePremisesCheckList(list);
  const lines = ['id,customer,date,onu,router,adapter,note'];
  for (const row of rows) {
    lines.push([row.id, row.customer, row.date, row.onu, row.router, row.adapter, row.note].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the check list. */
export function premisesCheckFilename() {
  return 'premises-checks.csv';
}
