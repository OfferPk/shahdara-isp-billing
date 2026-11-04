// Plan 137 (Plan 101-202) — Hand-recorded ONU signal (dBm) trend alerts.
//
// An ONU signal degrades slowly and only gets noticed when the
// customer disconnects completely. This module is the visit-based
// answer: one signal reading per customer visit with a customer, a
// date, a dBm value entered by hand, and a note — plus a simple
// threshold rule that flags a falling trend over the last three
// readings, so a weak signal gets a planned visit before it
// becomes a dead connection.
//
// What this module is NOT, stated plainly:
//   - It is not the SISP signal history (signal-history.js), which
//     journals optical RX readings into the customer record
//     (customer.signalReadings) and re-derives the profile's
//     current signal (lastRxDbm), with a per-mohalla average
//     view. That history is neither read nor written here: a
//     reading recorded here never becomes a profile reading, never
//     changes lastRxDbm, and never enters the area report. The
//     SISP profile reading and this visit trend log are two
//     different records on purpose — one says what the signal is
//     now, the other watches whether it keeps falling visit
//     after visit.
//   - It is not a live device read. No device is queried,
//     polled, or connected to: every dBm value here is
//     typed in by hand from a field reading, and a non-numeric
//     value is refused outright, never guessed.
//   - It is not a service-status change. A falling trend is a
//     flag for a planned visit only: it never disconnects,
//     suspends, or otherwise changes any customer's service
//     status, and it never changes any bill or payment.
//   - It is not a second copy of any ticket, vendor, or supplier
//     record. A reading names a customer only; no ticket, bill,
//     or payment is linked, read, or written here.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     reading, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed readings are refused outright, never stored
//     half-formed: a reading needs an id, a customer, and a real
//     calendar date, plus a numeric dBm value in the optical
//     range -60..+10 dBm. A reading with no customer, no date,
//     an impossible date, or a non-numeric dBm is refused.
//     Unknown fields are dropped, so a reading can never grow
//     a status, bill, or payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - The falling-trend rule is one fixed rule, stated here so
//     it can never drift silently: over a customer's last three
//     readings in date order, the flag fires only when each
//     reading is strictly lower (more negative) than the one
//     before it AND the total fall from the first to the third
//     is at least 3.0 dB. A flat step, a rise, fewer than three
//     readings, or a total fall under 3.0 dB never flags.
//   - A customer page shows that customer's readings in date
//     order with the trend flag where the rule fires. A customer
//     with no readings says so plainly, never pretends a signal.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validOnuSignalDate(value) {
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

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * Clean a hand-entered dBm value: a finite number, or a string that
 * parses to one, inside the optical range -60..+10 dBm, rounded to
 * one decimal like the SISP signal convention. Anything else —
 * blank, non-numeric text, NaN, Infinity, out of range — is null,
 * never guessed.
 */
export function cleanOnuDbm(value) {
  let parsed = null;
  if (typeof value === 'number' && Number.isFinite(value)) parsed = value;
  else if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    if (Number.isFinite(num)) parsed = num;
  }
  if (parsed === null || parsed < -60 || parsed > 10) return null;
  return Math.round(parsed * 10) / 10;
}

/** The fixed falling-trend threshold: total fall in dB over three readings. */
export const ONU_TREND_MIN_FALL_DB = 3.0;

/** Normalise one reading, or null when it is half-formed. */
export function normalizeOnuSignalReading(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const date = validOnuSignalDate(record.date);
  const dbm = cleanOnuDbm(record.dbm);
  if (!id || !customer || !date) return null;
  if (dbm === null) return null;
  return {
    id,
    customer,
    date,
    dbm,
    note: cleanText(record.note),
  };
}

/** Normalise a list, dropping half-formed readings. */
export function normalizeOnuSignalReadingList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const item = normalizeOnuSignalReading(record);
    if (item && !out.some((row) => row.id === item.id)) out.push(item);
  }
  return out;
}

/** Find one reading by id, or null. */
export function findOnuSignalReading(list, id) {
  const base = normalizeOnuSignalReadingList(list);
  return base.find((item) => item.id === cleanText(id)) ?? null;
}

/**
 * Save one reading. An identical re-save leaves the list unchanged;
 * a re-save of the same id with different figures is refused.
 * A half-formed reading is refused. Returns a new list.
 */
export function upsertOnuSignalReading(list, record) {
  const base = normalizeOnuSignalReadingList(list);
  const item = normalizeOnuSignalReading(record);
  if (!item) return base;
  const at = base.findIndex((row) => row.id === item.id);
  if (at === -1) return [...base, item];
  const existing = base[at];
  const same = existing.customer === item.customer
    && existing.date === item.date
    && existing.dbm === item.dbm
    && existing.note === item.note;
  if (same) return base;
  return base;
}

/** Remove one reading by id. Returns a new list. */
export function removeOnuSignalReading(list, id) {
  const base = normalizeOnuSignalReadingList(list);
  const key = cleanText(id);
  return base.filter((item) => item.id !== key);
}

function sortDateOrder(rows) {
  return [...rows].sort((a, b) => compareText(a.date, b.date) || compareText(a.id, b.id));
}

/** One customer's readings in date order (customer match is case-insensitive). */
export function onuSignalsForCustomer(list, customer) {
  const base = normalizeOnuSignalReadingList(list);
  const key = cleanText(customer).toLowerCase();
  if (!key) return [];
  return sortDateOrder(base.filter((item) => item.customer.toLowerCase() === key));
}

/**
 * The falling-trend rule over one customer's readings (any order;
 * date order is applied inside). Returns { flagged, readings, totalDrop }:
 * readings are the last three in date order (fewer when the customer
 * has fewer), totalDrop is the fall from the first to the third in dB
 * when three exist, else null. Flagged is true only when the last
 * three are strictly falling and the total fall is >= 3.0 dB.
 */
export function onuSignalTrend(readings) {
  const rows = sortDateOrder(normalizeOnuSignalReadingList(readings));
  const lastThree = rows.slice(-3);
  if (lastThree.length < 3) return { flagged: false, readings: lastThree, totalDrop: null };
  const [first, second, third] = lastThree;
  const strictlyFalling = second.dbm < first.dbm && third.dbm < second.dbm;
  const totalDrop = Math.round((first.dbm - third.dbm) * 10) / 10;
  const flagged = strictlyFalling && totalDrop >= ONU_TREND_MIN_FALL_DB;
  return { flagged, readings: lastThree, totalDrop };
}

/** The trend result for one customer in a list, or null when the customer has no readings. */
export function onuSignalTrendForCustomer(list, customer) {
  const rows = onuSignalsForCustomer(list, customer);
  if (rows.length === 0) return null;
  const trend = onuSignalTrend(rows);
  return { customer: rows[0].customer, ...trend };
}

/** One trend row per customer: flagged customers first, then customer A-Z. */
export function onuSignalTrendFlags(list) {
  const base = normalizeOnuSignalReadingList(list);
  const byCustomer = new Map();
  for (const item of base) {
    const key = item.customer.toLowerCase();
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key).push(item);
  }
  const rows = [];
  for (const readings of byCustomer.values()) {
    const trend = onuSignalTrend(readings);
    rows.push({ customer: readings[0].customer, ...trend });
  }
  return rows.sort((a, b) => (b.flagged - a.flagged) || compareText(a.customer.toLowerCase(), b.customer.toLowerCase()));
}

/** Counts: readings and distinct customers. */
export function onuSignalCounts(list) {
  const base = normalizeOnuSignalReadingList(list);
  const customers = new Set(base.map((item) => item.customer.toLowerCase()));
  return { readings: base.length, customers: customers.size };
}

/** One-line summary of the whole log. */
export function onuSignalSummaryText(list) {
  const base = normalizeOnuSignalReadingList(list);
  if (base.length === 0) return 'No signal reading recorded yet.';
  const counts = onuSignalCounts(base);
  const flagged = onuSignalTrendFlags(base).filter((row) => row.flagged).length;
  return `${counts.readings} signal reading${counts.readings === 1 ? '' : 's'} across ${counts.customers} customer${counts.customers === 1 ? '' : 's'}; ${flagged} customer${flagged === 1 ? '' : 's'} showing a falling trend.`;
}

function formatDbm(dbm) {
  return `${dbm.toFixed(1)} dBm`;
}

/** A customer page: readings in date order with the trend flag where the rule fires. */
export function onuSignalHtml(list, customer) {
  const key = cleanText(customer);
  if (!key) return '<p>Pick a customer to see their signal readings.</p>';
  const rows = onuSignalsForCustomer(list, key);
  if (rows.length === 0) return `<p>No signal reading recorded yet for ${escapeHtml(key)}.</p>`;
  const trend = onuSignalTrend(rows);
  const flag = trend.flagged
    ? `<p>⚠️ Falling trend: ${trend.readings.map((item) => formatDbm(item.dbm)).join(' → ')} (fall of ${trend.totalDrop.toFixed(1)} dB over the last three readings) — plan a visit before this becomes a dead connection.</p>`
    : '<p>No falling trend over the last three readings.</p>';
  const body = rows
    .map((item) => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.date)}</td><td>${formatDbm(item.dbm)}</td><td>${escapeHtml(item.note)}</td></tr>`)
    .join('');
  return `${flag}<table><thead><tr><th>Id</th><th>Date</th><th>Signal (dBm)</th><th>Note</th></tr></thead><tbody>${body}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value);
  return /[\",\n]/.test(text) ? `"${text.replace(/\"/g, '""')}"` : text;
}

/** CSV for a list of readings. */
export function onuSignalCsv(list) {
  const base = normalizeOnuSignalReadingList(list);
  const header = 'id,customer,date,dbm,note';
  const rows = base.map((item) => [item.id, item.customer, item.date, item.dbm, item.note].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

/** CSV filename for the log. */
export function onuSignalFilename() {
  return 'onu-signal-trend.csv';
}
