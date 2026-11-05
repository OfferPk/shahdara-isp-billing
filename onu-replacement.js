// Plan 247 (Plan 203-350) — ONU replacement reason log.
//
// ONUs are swapped, but the reason for each swap is not recorded,
// so a batch of faulty units or a repeated customer-side cause
// stays invisible. This module adds only the missing piece: one
// log entry per ONU replacement — the customer, the old unit
// reference, the new unit reference, the reason in plain words,
// the date, and who replaced it.
//
// One entry: the id, the customer, the old unit reference, the
// new unit reference, the reason, a strict calendar date, who
// replaced it, and dated follow-up notes. Each entry names both
// units, so a swap is never a mystery about which unit went out
// and which one went in.
//
// The fences, stated plainly:
//   - This logs reasons only. It does not replace the customer
//     premises equipment check (Plan 149), which checks the
//     equipment at the premises, or the equipment swap pairing
//     record (Plan 157), which pairs the swap itself: neither
//     record is read nor rewritten here, and this module imports
//     nothing.
//   - Replacements list by reason and by customer, and reasons
//     that repeat are counted, so a repeated reason — power
//     damage, for example — points to a fixable cause.
//   - An entry is never edited, only corrected by a dated
//     follow-up note: there is no edit function, only record,
//     add a follow-up, and remove. A follow-up never rewrites
//     the customer, the old unit, the new unit, the reason,
//     the date, or who replaced it.
//   - Recording a reason never changes any bill, payment,
//     customer, or equipment record by itself: the module takes
//     no bill, payment, customer, or equipment object in, edits
//     none, and returns none. It holds replacement entries only.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const ONU_REPLACEMENT_STORE = 'shahdara_onu_replacements_v1';
export const ONU_REPLACEMENT_FILENAME = 'onu-replacements.csv';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validOnuReplacementDate(value) {
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

function cleanFollowUps(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const note = text(item.note);
    if (!validOnuReplacementDate(date) || !note) continue;
    out.push({ date, note });
  }
  return out;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const customer = text(entry.customer);
  const oldUnit = text(entry.oldUnit);
  const newUnit = text(entry.newUnit);
  const reason = text(entry.reason);
  const date = text(entry.date);
  const replacedBy = text(entry.replacedBy);
  if (!id || !customer || !oldUnit || !newUnit || !reason || !replacedBy) {
    return null;
  }
  if (!validOnuReplacementDate(date)) return null;
  return {
    id,
    customer,
    oldUnit,
    newUnit,
    reason,
    date,
    replacedBy,
    followUps: cleanFollowUps(entry.followUps),
  };
}

export function normalizeOnuReplacementList(list) {
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

export function recordOnuReplacement(list, entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return null;
  const base = normalizeOnuReplacementList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  return [...base, clean];
}

export function removeOnuReplacement(list, id) {
  const base = normalizeOnuReplacementList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findOnuReplacement(list, id) {
  const base = normalizeOnuReplacementList(list);
  return base.find((item) => item.id === text(id)) || null;
}

// An entry is never edited, only corrected by a dated follow-up
// note: the follow-up is appended and the original fields stay
// exactly as recorded.
export function addOnuReplacementFollowUp(list, id, followUp) {
  const base = normalizeOnuReplacementList(list);
  const target = text(id);
  if (!followUp || typeof followUp !== 'object') return list;
  const date = text(followUp.date);
  const note = text(followUp.note);
  if (!validOnuReplacementDate(date) || !note) return list;
  if (!base.some((item) => item.id === target)) return list;
  return base.map((item) =>
    item.id === target
      ? { ...item, followUps: [...item.followUps, { date, note }] }
      : item,
  );
}

export function onuReplacementSorted(list) {
  const base = normalizeOnuReplacementList(list);
  return [...base].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const byCustomer = a.customer
      .toLowerCase()
      .localeCompare(b.customer.toLowerCase());
    if (byCustomer !== 0) return byCustomer;
    return a.id.localeCompare(b.id);
  });
}

export function onuReplacementsForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return onuReplacementSorted(list).filter(
    (item) => item.customer.toLowerCase() === wanted,
  );
}

export function onuReplacementsForReason(list, reason) {
  const wanted = text(reason).toLowerCase();
  if (!wanted) return [];
  return onuReplacementSorted(list).filter(
    (item) => item.reason.toLowerCase() === wanted,
  );
}

export function onuReplacementReasonCounts(list) {
  const base = normalizeOnuReplacementList(list);
  const counts = new Map();
  for (const item of base) {
    const key = item.reason.toLowerCase();
    const found = counts.get(key);
    if (found) found.count += 1;
    else counts.set(key, { reason: item.reason, count: 1 });
  }
  return [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.reason.toLowerCase().localeCompare(b.reason.toLowerCase());
  });
}

// A repeated reason — power damage, for example — points to a
// fixable cause, so reasons with two or more replacements are
// listed, most first, then reason A-Z; the first recorded
// spelling of a reason is kept.
export function repeatedOnuReplacementReasons(list) {
  return onuReplacementReasonCounts(list).filter(
    (entry) => entry.count >= 2,
  );
}

export function onuReplacementSummaryText(list) {
  const base = normalizeOnuReplacementList(list);
  const customers = new Set(
    base.map((item) => item.customer.toLowerCase()),
  ).size;
  const repeated = repeatedOnuReplacementReasons(base);
  const entryWord = base.length === 1 ? 'replacement' : 'replacements';
  const customerWord = customers === 1 ? 'customer' : 'customers';
  const repeatedText =
    repeated.length === 0
      ? 'No reason repeats.'
      : `${repeated.length} reason${repeated.length === 1 ? '' : 's'} repeat${repeated.length === 1 ? 's' : ''}: ${repeated
          .map((entry) => `${entry.reason} (${entry.count})`)
          .join(', ')}.`;
  return (
    `${base.length} ONU ${entryWord} for ${customers} ${customerWord}. ` +
    repeatedText
  );
}

export function onuReplacementText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '';
  const followUps =
    clean.followUps.length === 0
      ? 'No follow-up notes yet.'
      : `${clean.followUps.length} dated follow-up note${
          clean.followUps.length === 1 ? '' : 's'
        }, latest ${clean.followUps[clean.followUps.length - 1].date}.`;
  return (
    `${clean.customer} — ONU ${clean.oldUnit} replaced by ${clean.newUnit} ` +
    `on ${clean.date} by ${clean.replacedBy}: ${clean.reason} ${followUps}`
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

export function onuReplacementHtml(list) {
  const rows = onuReplacementSorted(list);
  if (rows.length === 0) return '<p>No ONU replacements recorded.</p>';
  const items = rows
    .map((item) => `<li>${escapeHtml(onuReplacementText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function onuReplacementCsv(list) {
  const rows = onuReplacementSorted(list);
  const header = [
    'id',
    'customer',
    'old unit',
    'new unit',
    'reason',
    'date',
    'replaced by',
    'follow-up notes',
  ]
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.customer,
      item.oldUnit,
      item.newUnit,
      item.reason,
      item.date,
      item.replacedBy,
      item.followUps.map((u) => `${u.date}: ${u.note}`).join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function onuReplacementFilename() {
  return ONU_REPLACEMENT_FILENAME;
}
