// Plan 180 (Plan 101-202) — Customer Communication History Timeline.
//
// Drafts and messages sent to a customer are scattered, so the
// operator cannot tell what a customer was already told and repeats
// or contradicts earlier messages. This module is a READ-ONLY view
// over the draft records the operator already marked as sent: one
// timeline entry per sent draft, with its type, date, and short
// title, listed in date order per customer.
//
// What this module is NOT, stated plainly:
//   - It is not a new message store. It keeps no records of its own;
//     every entry is built from a source record supplied by the
//     caller, and nothing is ever saved back through this module.
//   - It never edits or deletes a past entry. There is deliberately
//     no upsert, remove, or edit function here: a correction happens
//     in the source record's own panel, and the timeline simply
//     shows the corrected record next time it is built.
//   - It never changes any draft, bill, payment, or customer record,
//     and it never sends anything. It only reads what the caller
//     supplies and returns a sorted view of it.
//   - An unsent draft never appears. An entry is only built when the
//     source record says sent AND carries a strict sent date.
//   - It is not proof that the details are right. Titles and dates
//     come from the source records exactly as the operator entered
//     them; the module verifies format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record
//     and the module never reads storage, the clock, or the network,
//     and never touches another record.
//   - A half-formed entry is dropped outright: no customer, no type,
//     no strict sent date, or no title means no timeline row.
//   - Unknown fields are dropped, so no bill, payment, status, or
//     sending field can ever creep into a timeline entry.
//   - Inputs are never mutated: every function returns new objects.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function compareEntries(a, b) {
  if (a.sentDate !== b.sentDate) return a.sentDate < b.sentDate ? -1 : 1;
  if (a.type !== b.type) return a.type < b.type ? -1 : 1;
  if (a.title !== b.title) return a.title < b.title ? -1 : 1;
  return 0;
}

// Normalize one timeline entry. Returns null unless the entry says
// it was sent AND carries a strict sent date — an unsent draft, a
// draft with no sent date, and a draft with an impossible sent date
// all produce no timeline row, never a guessed one.
export function normalizeTimelineEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const customerId = cleanText(entry.customerId ?? entry.customer);
  const type = cleanText(entry.type);
  const title = cleanText(entry.title);
  if (!customerId || !type || !title) return null;
  if (entry.sent !== true) return null;
  if (!isStrictDate(entry.sentDate)) return null;
  // Only sent entries survive normalization, so the flag is carried
  // on the normalized row: downstream views re-normalize rows and
  // must not mistake a genuine sent row for an unsent draft.
  return { customerId, type, sent: true, sentDate: entry.sentDate, title };
}

export function normalizeTimelineEntryList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const clean = normalizeTimelineEntry(item);
    if (!clean) continue;
    const key = `${cleanKey(clean.customerId)}\n${clean.type}\n${clean.sentDate}\n${clean.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

// Build timeline entries from the source records the caller
// supplies. Only records the operator marked as sent become rows:
// service-change confirmations and referral thank-yous with a sent
// flag and sent date, education notes shared by hand (a share record
// is itself the sent mark, dated by its shared date), and greeting
// drafts with a sent date. Source records are only read, never
// changed, and a source record that fails its own shape simply
// contributes no row.
export function collectTimelineEntries(sources) {
  const out = [];
  const src = sources && typeof sources === 'object' ? sources : {};
  const confirmations = Array.isArray(src.changeConfirmations) ? src.changeConfirmations : [];
  for (const record of confirmations) {
    if (!record || typeof record !== 'object') continue;
    if (record.sent !== true) continue;
    out.push({
      customerId: cleanText(record.customerId),
      type: 'Service-change confirmation',
      sent: true,
      sentDate: cleanText(record.sentDate),
      title: cleanText(record.agreedChange),
    });
  }
  const thanks = Array.isArray(src.referralThanks) ? src.referralThanks : [];
  for (const record of thanks) {
    if (!record || typeof record !== 'object') continue;
    if (record.sent !== true) continue;
    const newCustomerId = cleanText(record.newCustomerId ?? record.newCustomer);
    out.push({
      customerId: cleanText(record.referrerId ?? record.referrer),
      type: 'Referral thank-you',
      sent: true,
      sentDate: cleanText(record.sentDate),
      title: newCustomerId ? `Thank-you for referring ${newCustomerId}` : 'Referral thank-you',
    });
  }
  const notes = Array.isArray(src.educationNotes) ? src.educationNotes : [];
  const noteTitles = new Map();
  for (const note of notes) {
    if (!note || typeof note !== 'object') continue;
    const id = cleanText(note.id);
    const title = cleanText(note.title);
    if (id && title && !noteTitles.has(cleanKey(id))) noteTitles.set(cleanKey(id), title);
  }
  const shares = Array.isArray(src.educationShares) ? src.educationShares : [];
  for (const share of shares) {
    if (!share || typeof share !== 'object') continue;
    out.push({
      customerId: cleanText(share.customerId),
      type: 'Education note shared',
      sent: true,
      sentDate: cleanText(share.sharedDate),
      title: noteTitles.get(cleanKey(share.noteId)) || 'Education note',
    });
  }
  const greetings = Array.isArray(src.greetingDates) ? src.greetingDates : [];
  for (const record of greetings) {
    if (!record || typeof record !== 'object') continue;
    const sentDate = cleanText(record.sentDate);
    if (!sentDate) continue;
    const kind = cleanText(record.kind).toLowerCase();
    const kindLabel = kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : 'Greeting';
    out.push({
      customerId: cleanText(record.customer),
      type: 'Greeting draft',
      sent: true,
      sentDate,
      title: `${kindLabel} greeting`,
    });
  }
  return normalizeTimelineEntryList(out).sort(compareEntries);
}

// The timeline for one customer, in date order. An unsent draft
// never appears: normalization already drops anything that does not
// say sent with a strict sent date.
export function timelineForCustomer(list, customerId) {
  const wanted = cleanKey(customerId);
  if (!wanted) return [];
  return normalizeTimelineEntryList(list)
    .filter((entry) => cleanKey(entry.customerId) === wanted)
    .sort(compareEntries);
}

// Customers who have at least one sent entry, first spelling kept,
// A-Z.
export function timelineCustomers(list) {
  const seen = new Map();
  for (const entry of normalizeTimelineEntryList(list)) {
    const key = cleanKey(entry.customerId);
    if (!seen.has(key)) seen.set(key, entry.customerId);
  }
  return [...seen.values()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function timelineSummaryText(list) {
  const entries = normalizeTimelineEntryList(list);
  const customers = timelineCustomers(list).length;
  return `${entries.length} sent message${entries.length === 1 ? '' : 's'} for ${customers} customer${customers === 1 ? '' : 's'} (read-only timeline; nothing here edits a past entry or sends anything).`;
}

export function timelineEntryText(entry) {
  const clean = normalizeTimelineEntry(entry);
  if (!clean) return '';
  return `${clean.sentDate} — ${clean.type}: ${clean.title}`;
}

export function timelineHtml(entry) {
  const clean = normalizeTimelineEntry(entry);
  if (!clean) return '';
  return `<p>${escapeHtml(clean.sentDate)} — <strong>${escapeHtml(clean.type)}</strong>: ${escapeHtml(clean.title)}</p>`;
}

export function timelineAllHtml(list) {
  const entries = normalizeTimelineEntryList(list).sort(compareEntries);
  if (!entries.length) return '<p>No sent messages on the timeline.</p>';
  return entries.map((entry) => timelineHtml(entry)).join('');
}

export function timelineCustomerHtml(list, customerId) {
  const entries = timelineForCustomer(list, customerId);
  if (!entries.length) return '<p>No sent messages for this customer.</p>';
  return entries.map((entry) => timelineHtml(entry)).join('');
}

export function timelineCsv(list) {
  const rows = [['customerId', 'type', 'sentDate', 'title']];
  for (const entry of normalizeTimelineEntryList(list).sort(compareEntries)) {
    rows.push([
      csvCell(entry.customerId),
      csvCell(entry.type),
      csvCell(entry.sentDate),
      csvCell(entry.title),
    ]);
  }
  return rows.map((row) => row.join(',')).join('\n');
}

export function timelineFilename() {
  return 'comms-timeline.csv';
}
