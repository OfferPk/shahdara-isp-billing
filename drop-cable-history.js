// Plan 246 (Plan 203-350) — Drop cable replacement history per customer.
//
// A customer's drop cable is replaced more than once, but each
// replacement is a separate memory, so nobody can tell whether
// the cable, the route, or the fitting is the real problem. This
// module adds only the missing piece: one history entry per drop
// cable replacement — the customer, the date, the reason in plain
// words, the cable length used if known, and who replaced it.
//
// One entry: the id, the customer, a strict calendar date, the
// reason, the cable length in metres if known, who replaced it,
// and dated follow-up notes.
//
// The fences, stated plainly:
//   - This records replacements only. It does not replace the
//     drop cable condition record (Plan 150), which records
//     condition at inspection: that record is neither read nor
//     rewritten here, and this module imports nothing.
//   - A customer's replacements list in date order with reasons,
//     and a customer with two or more replacements is flagged,
//     so a home needing its third drop cable is a signal to fix
//     the route or fitting, not to fit a fourth cable.
//   - An entry is never edited, only followed by a newer entry
//     or a dated follow-up note: there is no edit function,
//     only record, add a follow-up, and remove. A follow-up
//     never rewrites the customer, the date, the reason, the
//     cable length, or who replaced it.
//   - Recording a replacement never changes any bill, payment,
//     customer, or condition record by itself: the module takes
//     no bill, payment, customer, or condition object in, edits
//     none, and returns none. It holds replacement entries only.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const DROP_CABLE_HISTORY_STORE = 'shahdara_drop_cable_histories_v1';
export const DROP_CABLE_HISTORY_FILENAME = 'drop-cable-histories.csv';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDropCableHistoryDate(value) {
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

function cleanLength(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function cleanFollowUps(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const note = text(item.note);
    if (!validDropCableHistoryDate(date) || !note) continue;
    out.push({ date, note });
  }
  return out;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const customer = text(entry.customer);
  const date = text(entry.date);
  const reason = text(entry.reason);
  const replacedBy = text(entry.replacedBy);
  if (!id || !customer || !reason || !replacedBy) return null;
  if (!validDropCableHistoryDate(date)) return null;
  return {
    id,
    customer,
    date,
    reason,
    cableLengthM: cleanLength(entry.cableLengthM),
    replacedBy,
    followUps: cleanFollowUps(entry.followUps),
  };
}

export function normalizeDropCableHistoryList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const clean = normalizeEntry(entry);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

export function recordDropCableReplacement(list, entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return null;
  const base = normalizeDropCableHistoryList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  return [...base, clean];
}

export function removeDropCableReplacement(list, id) {
  const base = normalizeDropCableHistoryList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findDropCableReplacement(list, id) {
  const base = normalizeDropCableHistoryList(list);
  return base.find((item) => item.id === text(id)) || null;
}

// An entry is never edited, only followed by a newer entry or a
// dated follow-up note: the follow-up is appended and the
// original fields stay exactly as recorded.
export function addDropCableHistoryFollowUp(list, id, followUp) {
  const base = normalizeDropCableHistoryList(list);
  const target = text(id);
  if (!followUp || typeof followUp !== 'object') return list;
  const date = text(followUp.date);
  const note = text(followUp.note);
  if (!validDropCableHistoryDate(date) || !note) return list;
  if (!base.some((item) => item.id === target)) return list;
  return base.map((item) =>
    item.id === target
      ? { ...item, followUps: [...item.followUps, { date, note }] }
      : item,
  );
}

export function dropCableHistorySorted(list) {
  const base = normalizeDropCableHistoryList(list);
  return [...base].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const byCustomer = a.customer
      .toLowerCase()
      .localeCompare(b.customer.toLowerCase());
    if (byCustomer !== 0) return byCustomer;
    return a.id.localeCompare(b.id);
  });
}

export function dropCableReplacementsForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return dropCableHistorySorted(list).filter(
    (item) => item.customer.toLowerCase() === wanted,
  );
}

// A customer with two or more replacements is flagged, so a home
// needing its third drop cable is visible before a fourth is
// fitted. Most replacements first, then customer A-Z; the first
// recorded spelling of a customer name is kept.
export function flaggedDropCableCustomers(list) {
  const base = normalizeDropCableHistoryList(list);
  const counts = new Map();
  for (const item of base) {
    const key = item.customer.toLowerCase();
    const found = counts.get(key);
    if (found) found.count += 1;
    else counts.set(key, { customer: item.customer, count: 1 });
  }
  return [...counts.values()]
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.customer.toLowerCase().localeCompare(b.customer.toLowerCase());
    });
}

export function dropCableHistorySummaryText(list) {
  const base = normalizeDropCableHistoryList(list);
  const customers = new Set(
    base.map((item) => item.customer.toLowerCase()),
  ).size;
  const flagged = flaggedDropCableCustomers(base);
  const entryWord = base.length === 1 ? 'replacement' : 'replacements';
  const customerWord = customers === 1 ? 'customer' : 'customers';
  const flaggedText =
    flagged.length === 0
      ? 'No customer has two or more replacements.'
      : `${flagged.length} customer${flagged.length === 1 ? '' : 's'} flagged with two or more replacements: ${flagged
          .map((entry) => `${entry.customer} (${entry.count})`)
          .join(', ')}.`;
  return (
    `${base.length} drop cable ${entryWord} for ${customers} ${customerWord}. ` +
    flaggedText
  );
}

export function dropCableHistoryText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '';
  const length =
    clean.cableLengthM === null
      ? 'Cable length not recorded.'
      : `${clean.cableLengthM} m of cable used.`;
  const followUps =
    clean.followUps.length === 0
      ? 'No follow-up notes yet.'
      : `${clean.followUps.length} dated follow-up note${
          clean.followUps.length === 1 ? '' : 's'
        }, latest ${clean.followUps[clean.followUps.length - 1].date}.`;
  return (
    `${clean.customer} — drop cable replaced ${clean.date} by ${clean.replacedBy}: ` +
    `${clean.reason} ${length} ${followUps}`
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

export function dropCableHistoryHtml(list) {
  const rows = dropCableHistorySorted(list);
  if (rows.length === 0) return '<p>No drop cable replacements recorded.</p>';
  const items = rows
    .map((item) => `<li>${escapeHtml(dropCableHistoryText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function dropCableHistoryCsv(list) {
  const rows = dropCableHistorySorted(list);
  const header = [
    'id',
    'customer',
    'date',
    'reason',
    'cable length (m)',
    'replaced by',
    'follow-up notes',
  ]
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.customer,
      item.date,
      item.reason,
      item.cableLengthM === null ? '' : item.cableLengthM,
      item.replacedBy,
      item.followUps.map((u) => `${u.date}: ${u.note}`).join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function dropCableHistoryFilename() {
  return DROP_CABLE_HISTORY_FILENAME;
}
