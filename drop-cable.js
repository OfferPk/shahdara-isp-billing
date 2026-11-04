// Plan 150 (Plan 101-202) — Drop cable condition record.
//
// Drop cables sag, chafe, or get damaged, but there is no
// per-premises record of their condition over time. This module
// is that record: one drop cable record per premises observation,
// with a customer, a date, a condition (good/watch/poor), and a
// route note. A customer page then shows its drop cable condition
// history newest first, and premises whose latest condition is
// poor appear on a watch list, so the worst drop cables get
// replaced on a planned round instead of failing in bad weather.
//
// What this module is NOT, stated plainly:
//   - It is not a premises equipment check and not a second copy
//     of one. Plan 149's premises check (ONU, router, and adapter
//     condition per visit) is neither read nor written here: a
//     drop cable record observes the cable to the premises, never
//     the equipment inside it.
//   - It is not an installation record. No installation is
//     opened, changed, or closed here, and no installation record
//     is read or written.
//   - It is not a fault ticket. Recording a poor cable never
//     opens, closes, rewrites, or otherwise changes any fault
//     ticket, and it never changes any bill or payment.
//   - It is not a repair order. A "poor" record does not schedule
//     a fix, order a part, or change any service state; it only
//     puts the premises on the watch list.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a customer, and a real
//     calendar date. A record with no customer or no date is
//     refused, and so is one with an impossible date. Unknown
//     fields are dropped, so a record can never grow an
//     installation, ticket, bill, or payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal.
//   - Condition is one of good, watch, or poor; anything else
//     is recorded as watch, never stored as a fourth state.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - A customer's history lists newest first, and its latest
//     condition is simply the newest record's condition. The
//     watch list holds only premises whose latest condition is
//     poor: a cable recorded poor and later recorded good leaves
//     the watch list, because the latest observation is the one
//     that counts.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validDropCableDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

const CONDITIONS = ['good', 'watch', 'poor'];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Normalize a condition to good, watch, or poor (unknown becomes watch). */
export function cleanDropCableCondition(value) {
  const condition = cleanText(value);
  return CONDITIONS.includes(condition) ? condition : 'watch';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one drop cable record, or null when half-formed. */
export function normalizeDropCableRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const customer = cleanText(raw.customer);
  const date = validDropCableDate(raw.date);
  if (!id || !customer || !date) return null;
  return {
    id,
    customer,
    date,
    condition: cleanDropCableCondition(raw.condition),
    routeNote: cleanText(raw.routeNote),
  };
}

/** Normalize a list: drop half-formed records and duplicate ids (first wins). */
export function normalizeDropCableList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeDropCableRecord(raw);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

/** Find one record by id, or null. */
export function findDropCableRecord(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeDropCableList(list).find((item) => item.id === clean) || null;
}

/**
 * Save one record. Returns a new list, or the input unchanged when
 * the record is half-formed or repeats an id.
 */
export function upsertDropCableRecord(list, raw) {
  const clean = normalizeDropCableList(list);
  const record = normalizeDropCableRecord(raw);
  if (!record) return clean;
  if (clean.some((item) => item.id === record.id)) return clean;
  return [...clean, record];
}

/** Remove one record by id. Returns a new list. */
export function removeDropCableRecord(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeDropCableList(list);
  return normalizeDropCableList(list).filter((item) => item.id !== clean);
}

function matchesCustomer(item, customer) {
  const key = cleanText(customer).toLowerCase();
  if (!key) return false;
  return item.customer.toLowerCase() === key;
}

/** A customer's drop cable history, newest first (then id A-Z for a stable order). */
export function historyForDropCableCustomer(list, customer) {
  const clean = normalizeDropCableList(list);
  return clean
    .filter((item) => matchesCustomer(item, customer))
    .sort((a, b) => compareText(b.date, a.date) || compareText(a.id, b.id));
}

/** Latest drop cable condition for a customer, or null when they have no record. */
export function latestDropCableCondition(list, customer) {
  const rows = historyForDropCableCustomer(list, customer);
  return rows.length === 0 ? null : rows[0].condition;
}

/** Every customer with their latest drop cable condition, customer name A-Z. */
export function customerLatestDropCableConditions(list) {
  const clean = normalizeDropCableList(list);
  const byKey = new Map();
  for (const item of clean) {
    const key = item.customer.toLowerCase();
    if (!byKey.has(key) || item.date > byKey.get(key).date
      || (item.date === byKey.get(key).date && item.id < byKey.get(key).id)) {
      byKey.set(key, { customer: item.customer, date: item.date, condition: item.condition });
    }
  }
  return [...byKey.values()].sort((a, b) => compareText(a.customer.toLowerCase(), b.customer.toLowerCase()));
}

/**
 * The watch list: premises whose latest drop cable condition is
 * poor, customer name A-Z. A premises recorded poor and later
 * recorded good is not on it.
 */
export function poorDropCableWatchList(list) {
  return customerLatestDropCableConditions(list)
    .filter((row) => row.condition === 'poor');
}

/** One-line summary of all drop cable records. */
export function dropCableSummaryText(list) {
  const clean = normalizeDropCableList(list);
  if (clean.length === 0) return 'No drop cable record recorded yet.';
  const customers = customerLatestDropCableConditions(clean);
  const poor = customers.filter((row) => row.condition === 'poor').length;
  const watch = customers.filter((row) => row.condition === 'watch').length;
  return `${clean.length} drop cable record${clean.length === 1 ? '' : 's'} across ${customers.length} customer${customers.length === 1 ? '' : 's'}; ${poor} poor on the watch list, ${watch} watch.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function historyRowHtml(item) {
  return `<tr><td>${esc(item.date)}</td><td>${esc(item.condition)}</td>`
    + `<td>${esc(item.routeNote)}</td></tr>`;
}

/**
 * A customer page: its drop cable history newest first with the
 * latest condition prominent. A customer with no record says so
 * plainly, and an empty filter asks for a customer.
 */
export function dropCableCustomerHtml(list, customer) {
  if (!cleanText(customer)) return '<p>Pick a customer to see their drop cable history.</p>';
  const rows = historyForDropCableCustomer(list, customer);
  if (rows.length === 0) return `<p>No drop cable record recorded for ${esc(customer)} yet.</p>`;
  const heading = `<p><strong>Latest condition: ${esc(rows[0].condition)}</strong> `
    + `(as of ${esc(rows[0].date)}). ${rows.length} record${rows.length === 1 ? '' : 's'} recorded, newest first.</p>`;
  const body = rows.map(historyRowHtml).join('');
  return `${heading}<table><thead><tr><th>Date</th><th>Condition</th>`
    + '<th>Route note</th></tr></thead><tbody>' + body + '</tbody></table>';
}

/** The poor-condition watch list as HTML. */
export function dropCableWatchHtml(list) {
  const rows = poorDropCableWatchList(list);
  if (rows.length === 0) return '<p>No premises on the poor-condition watch list.</p>';
  const body = rows.map((row) => `<tr><td>${esc(row.customer)}</td>`
    + `<td>${esc(row.date)}</td><td>poor</td></tr>`).join('');
  return '<p>Premises whose latest drop cable condition is poor, newest observation shown.</p>'
    + '<table><thead><tr><th>Customer</th><th>Latest observation</th>'
    + '<th>Condition</th></tr></thead><tbody>' + body + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of drop cable records. */
export function dropCableCsv(list) {
  const rows = normalizeDropCableList(list);
  const lines = ['id,customer,date,condition,routeNote'];
  for (const item of rows) {
    lines.push([item.id, item.customer, item.date, item.condition, item.routeNote].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for drop cable records. */
export function dropCableFilename() {
  return 'drop-cable-records.csv';
}
