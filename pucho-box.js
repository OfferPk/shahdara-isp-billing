// Plan 66 (Plan 1-100) — Co-pilot "Pucho" box: plain-language
// questions over existing data, plus a morning action queue.
//
// The owner and collector must browse dashboards, reports, and lists
// to answer simple daily questions ("who expires this week?",
// "which mohalla owes most?", "what do I deal with first this
// morning?"), so the real priority is found late or by memory.
// This module is the offline-first answer to that idea: one question
// box, answered entirely by pure, offline rules over data the app
// already holds. There is no internet call, no AI model, no live
// router feed, and no new calculation — every figure comes from a
// caller-supplied source list, and asking a question changes nothing.
//
// The fences, stated plainly:
//   - The module holds no bill, payment, Waada, ticket, or customer
//     record of its own. It reads caller-supplied rows and returns
//     answers; it never writes anything back anywhere.
//   - Questions are matched against a FIXED, VISIBLE keyword
//     catalogue (PUCHO_QUESTIONS), case-insensitively, in Roman
//     Urdu and simple English forms. If two patterns match, both
//     answers are shown, most specific first. If none matches, the
//     answer is the plain "cannot answer" message plus the whole
//     catalogue — nothing is guessed and no figure is invented
//     for an unmatched question.
//   - An empty source answers "koi record nahi", never zero
//     presented as a fact about a missing source.
//   - The mohalla-attention answer (question 11) shows each
//     mohalla's dues, overdue Waada count, and open ticket count
//     SEPARATELY, ordered by total dues highest first. No blended
//     score is ever computed: there is no score field anywhere.
//   - The morning queue follows one FIXED priority, printed above
//     the queue so the owner can audit it, capped at 10 items.
//     No queue item is ever auto-resolved, auto-messaged, or
//     auto-changed; every action goes through the existing flow
//     only after the operator confirms it.
//   - No live router data is used or claimed, and no diagnosis is
//     invented: a cause is stated only when a ticket or outage
//     record supplied by the caller actually says so (this module
//     never states causes at all).
//
// Caller-supplied data shape (all rows are plain objects; every
// list is optional and defaults to empty):
//   {
//     today: 'YYYY-MM-DD',
//     dues: [{ customerId, customerName, mohalla, outstandingCents }],
//     expiries: [{ customerId, customerName, mohalla, expiryDate }],
//     waada: [{ customerId, customerName, mohalla, promiseDate, promiseAmountCents }],
//     suspense: [{ id, amountCents, date, claimed, customerId, customerName }],
//     tickets: [{ id, customerId, customerName, mohalla, category, priority, status, reportedDate }],
//     repeatFlags: [{ customerId, customerName, mohalla, category, count, ticketIds }],
//     atRisk: [{ customerId, customerName, mohalla, signals: [string] }],
//     disputes: [{ caseId, customerId, customerName, mohalla, billId, billMonth, totalCents, disputedCents, status }],
//     payments: [{ date, amountCents, voided, customerName }],
//   }
//
// Money is integer cents throughout, so list amounts sum exactly to
// each headline total on the same fixture. Dates are strict
// YYYY-MM-DD calendar dates; an impossible date (2026-02-30) is
// never treated as a date, and rows with unusable dates or amounts
// are counted in the answer's ignored count, never zero-filled.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const PUCHO_UNMATCHED_MESSAGE =
  'Ye sawaal main abhi nahi samajh saka — neeche diye gaye sawaalon mein se aik poochein';

export const MORNING_QUEUE_ORDER_TEXT =
  '1. Overdue Waada (band 15+, phir 8–14, phir 4–7, phir 1–3; har band mein sab se bara amount pehle) · '
  + '2. High-priority open tickets (no-connection pehle, phir sab se purana) · '
  + '3. Sab se baray baqaya · 4. Sab se purana unclaimed suspense · '
  + '5. Agle 3 din mein khatam honay walay — cap 10';

const MOHALLA_ALIASES = {
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
};

const TICKET_OPEN_STATUSES = ['open', 'assigned', 'in_progress'];
const DISPUTE_OPEN_STATUSES = ['open', 'investigating', 'escalated'];
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
const WAADA_BAND_ORDER = ['15+', '8-14', '4-7', '1-3'];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
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

// Strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validPuchoDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

function daysBetween(earlier, later) {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

function addDays(dateStr, days) {
  const built = new Date(Date.parse(`${dateStr}T00:00:00Z`));
  built.setUTCDate(built.getUTCDate() + days);
  return built.toISOString().slice(0, 10);
}

// Integer cents, or null when the amount is missing or unusable.
// A `*Cents` field is already cents and is used as-is; only a
// plain fallback field (PKR) is converted by ×100. Booleans, null,
// blank, non-finite, and (for dues/payments) non-positive amounts
// are never zero-filled.
function moneyCents(centsValue, pkrValue, { allowZero = false } = {}) {
  const check = (num, alreadyCents) => {
    if (!Number.isFinite(num)) return null;
    const rounded = Math.round(alreadyCents ? num : num * 100);
    if (allowZero ? rounded < 0 : rounded <= 0) return null;
    return rounded;
  };
  if (centsValue !== null && centsValue !== undefined && !(typeof centsValue === 'string' && centsValue.trim() === '')) {
    if (typeof centsValue === 'boolean') return null;
    return check(Number(centsValue), true);
  }
  if (pkrValue === null || pkrValue === undefined || (typeof pkrValue === 'string' && pkrValue.trim() === '')) return null;
  if (typeof pkrValue === 'boolean') return null;
  return check(Number(pkrValue), false);
}

function fromCents(cents) {
  return (cents / 100).toFixed(2);
}

// Canonical mohalla key, mirroring the Plan T rule as the other
// pure modules do: a leading "Mohalla" is stripped, matching is
// case-insensitive, and the aliases bani -> BANII, kishti ->
// KISHTII, chamyaa -> CHAMYAAA apply. Anything else keeps its own
// folded label, never rewritten.
export function puchoMohallaKey(value) {
  const raw = text(value);
  if (!raw) return null;
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return null;
  const folded = stripped.toLowerCase().replace(/\s+/g, ' ');
  const aliased = MOHALLA_ALIASES[folded.replace(/\s+/g, '')] ?? MOHALLA_ALIASES[folded];
  if (aliased) return aliased;
  return stripped.toUpperCase();
}

function puchoMohallaLabel(value) {
  const raw = text(value);
  if (!raw) return '';
  return raw.replace(/^mohalla\s+/i, '').trim();
}

function waadaBand(overdueDays) {
  if (overdueDays >= 15) return '15+';
  if (overdueDays >= 8) return '8-14';
  if (overdueDays >= 4) return '4-7';
  if (overdueDays >= 1) return '1-3';
  return null;
}

function nameCompare(a, b) {
  const an = (a || '').toLowerCase();
  const bn = (b || '').toLowerCase();
  if (an !== bn) return an < bn ? -1 : 1;
  return 0;
}

// The fixed, visible catalogue. Each entry maps to one existing
// data source. Keywords are matched case-insensitively as
// substrings of the normalised question, in Roman Urdu and
// English forms.
export const PUCHO_QUESTIONS = [
  { id: 'expiry_week', title: 'Expiry this week — is haftay khatam honay walay', sourceScreen: 'Customer profiles (expiry date)', keywords: ['expiry', 'expire', 'expires', 'expiring', 'khatam', 'khatm', 'is haftay', 'this week'] },
  { id: 'total_dues', title: 'Who owes money / total dues — kul baqaya', sourceScreen: 'Dues list', keywords: ['total dues', 'kitna baqaya', 'baqaya', 'bakaya', 'dues', 'owes', 'owe', 'udhaar'] },
  { id: 'dues_by_mohalla', title: 'Dues by mohalla — mohalla-wise baqaya', sourceScreen: 'Area view', keywords: ['mohalla dues', 'mohalla baqaya', 'mohalla bakaya', 'area dues', 'area baqaya', 'mohalla wise', 'mohalla-wise', 'kis mohalla', 'mohalla'] },
  { id: 'overdue_waada', title: 'Overdue Waada — waqt guzar chuka Waada', sourceScreen: 'Waada list', keywords: ['overdue waada', 'overdue wada', 'waada', 'wada', 'promise'] },
  { id: 'suspense_unclaimed', title: 'Suspense unclaimed — na-maloom raqam', sourceScreen: 'Suspense list', keywords: ['suspense', 'unclaimed', 'na maloom', 'na-maloom', 'unidentified'] },
  { id: 'open_tickets', title: 'Open tickets — khuli shikayatain', sourceScreen: 'Ticket list', keywords: ['ticket', 'tickets', 'shikayat', 'shikayet', 'complaint', 'fault'] },
  { id: 'repeat_faults', title: 'Repeat faults — baar baar kharabiyan', sourceScreen: 'Repeat-fault flags', keywords: ['repeat fault', 'repeat faults', 'repeat', 'baar baar', 'dobara'] },
  { id: 'at_risk', title: 'At-risk customers — khatre mein gahak', sourceScreen: 'At-risk list', keywords: ['at-risk', 'at risk', 'khatre', 'khatra', 'risk'] },
  { id: 'disputed_bills', title: 'Disputed bills — ikhtilaf wale bills', sourceScreen: 'Dispute case log', keywords: ['disputed', 'dispute', 'ikhtilaf', 'ghalat bill', 'wrong bill'] },
  { id: 'collections', title: "Today's collections / this month so far — aaj aur is mahine ki jama", sourceScreen: 'Payment ledger', keywords: ['collections', 'collection', 'jama', 'is mahine', 'this month', 'month so far', 'aaj', 'today'] },
  { id: 'mohalla_attention', title: 'Which mohalla needs attention first — pehle kis mohalla par tawajjo', sourceScreen: 'Area view', keywords: ['needs attention', 'pehle tawajjo', 'sab se pehle', 'which mohalla needs', 'which mohalla first', 'konsa mohalla'] },
  { id: 'morning_queue', title: 'What do I deal with first this morning? — subah ki action queue', sourceScreen: 'Morning action queue', keywords: ['morning queue', 'action queue', 'deal with first', 'first this morning', 'subah', 'morning', 'aaj kya karoon', 'kya karoon', 'kya karna', 'queue'] },
];

function normaliseQuestion(question) {
  return text(question).toLowerCase().replace(/\s+/g, ' ');
}

export function matchPuchoQuestions(question) {
  const q = normaliseQuestion(question);
  if (!q) return [];
  const matches = [];
  for (let i = 0; i < PUCHO_QUESTIONS.length; i += 1) {
    const entry = PUCHO_QUESTIONS[i];
    let best = 0;
    for (const keyword of entry.keywords) {
      if (q.includes(keyword) && keyword.length > best) best = keyword.length;
    }
    if (best > 0) matches.push({ entry, score: best, order: i });
  }
  matches.sort((a, b) => (b.score - a.score) || (a.order - b.order));
  return matches.map((m) => m.entry);
}

function emptyAnswer(entry, sourceNote) {
  return {
    id: entry.id,
    title: entry.title,
    sourceScreen: entry.sourceScreen,
    empty: true,
    headline: 'koi record nahi',
    headlineCents: null,
    insights: [sourceNote],
    columns: [],
    rows: [],
    actions: [],
  };
}

function baseAnswer(entry, headline, headlineCents, insights, columns, rows, actions = []) {
  return {
    id: entry.id,
    title: entry.title,
    sourceScreen: entry.sourceScreen,
    empty: false,
    headline,
    headlineCents,
    insights,
    columns,
    rows,
    actions,
  };
}

function ignoredInsight(ignored, what) {
  return ignored > 0 ? [`${ignored} ${what} unusable date ya amount ki wajah se shamil nahi hue — kuch guess nahi kiya gaya.`] : [];
}

function normList(value) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : [];
}

function buildExpiryWeek(data, entry) {
  const today = data.today;
  const rows = [];
  let ignored = 0;
  for (const row of normList(data.expiries)) {
    const expiry = validPuchoDate(row.expiryDate);
    if (!expiry || !today) { ignored += 1; continue; }
    const diff = daysBetween(today, expiry);
    if (diff === null || diff < 0 || diff > 7) continue;
    rows.push({ customerId: text(row.customerId), customerName: text(row.customerName) || text(row.customerId), mohalla: puchoMohallaLabel(row.mohalla), expiryDate: expiry, inDays: diff });
  }
  rows.sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : nameCompare(a.customerName, b.customerName)));
  if (rows.length === 0) return emptyAnswer(entry, 'Expiry list mein agle 7 din mein khatam honay wala koi record nahi.');
  const first = rows[0];
  return baseAnswer(entry,
    `${rows.length} customer${rows.length === 1 ? '' : 's'} expire within 7 days`,
    null,
    [`Earliest expiry: ${first.expiryDate} (${first.customerName}).`, ...ignoredInsight(ignored, 'expiry rows')],
    ['Customer', 'Mohalla', 'Expiry date', 'In days'],
    rows.map((r) => [r.customerName, r.mohalla, r.expiryDate, String(r.inDays)]),
    [{ label: 'Profile kholein', target: '' }]);
}

function buildTotalDues(data, entry) {
  const rows = [];
  let ignored = 0;
  for (const row of normList(data.dues)) {
    const cents = moneyCents(row.outstandingCents, row.outstanding);
    if (cents === null) { ignored += 1; continue; }
    rows.push({ customerId: text(row.customerId), customerName: text(row.customerName) || text(row.customerId), mohalla: puchoMohallaLabel(row.mohalla), cents });
  }
  rows.sort((a, b) => (b.cents - a.cents) || nameCompare(a.customerName, b.customerName));
  if (rows.length === 0) return emptyAnswer(entry, 'Dues list mein koi baqaya record nahi.');
  const total = rows.reduce((sum, r) => sum + r.cents, 0);
  return baseAnswer(entry,
    `Total dues: ${fromCents(total)} PKR (${rows.length} customer${rows.length === 1 ? '' : 's'})`,
    total,
    [`Largest single outstanding: ${fromCents(rows[0].cents)} PKR (${rows[0].customerName}).`, ...ignoredInsight(ignored, 'dues rows')],
    ['Customer', 'Mohalla', 'Outstanding (PKR)'],
    rows.map((r) => [r.customerName, r.mohalla, fromCents(r.cents)]),
    [{ label: 'Reminder draft', target: '' }]);
}

function groupDuesByMohalla(dues) {
  const groups = new Map();
  let ignored = 0;
  for (const row of normList(dues)) {
    const cents = moneyCents(row.outstandingCents, row.outstanding);
    if (cents === null) { ignored += 1; continue; }
    const key = puchoMohallaKey(row.mohalla);
    const label = key === null ? 'No mohalla recorded' : (puchoMohallaLabel(row.mohalla) || key);
    const groupKey = key === null ? '__unassigned__' : key;
    if (!groups.has(groupKey)) groups.set(groupKey, { key: groupKey, label, totalCents: 0, count: 0 });
    const group = groups.get(groupKey);
    group.totalCents += cents;
    group.count += 1;
  }
  const list = [...groups.values()];
  list.sort((a, b) => (b.totalCents - a.totalCents) || nameCompare(a.label, b.label));
  return { list, ignored };
}

function buildDuesByMohalla(data, entry) {
  const { list, ignored } = groupDuesByMohalla(data.dues);
  if (list.length === 0) return emptyAnswer(entry, 'Dues list mein mohalla-wise koi baqaya record nahi.');
  const total = list.reduce((sum, g) => sum + g.totalCents, 0);
  return baseAnswer(entry,
    `Total dues: ${fromCents(total)} PKR across ${list.length} mohalla${list.length === 1 ? '' : 's'}`,
    total,
    [`Highest mohalla: ${list[0].label} — ${fromCents(list[0].totalCents)} PKR (${list[0].count} customer${list[0].count === 1 ? '' : 's'}).`, ...ignoredInsight(ignored, 'dues rows')],
    ['Mohalla', 'Customers', 'Total dues (PKR)'],
    list.map((g) => [g.label, String(g.count), fromCents(g.totalCents)]),
    [{ label: 'Area view', target: '' }]);
}

function normWaada(data) {
  const today = data.today;
  const rows = [];
  let ignored = 0;
  for (const row of normList(data.waada)) {
    const promiseDate = validPuchoDate(row.promiseDate);
    if (!promiseDate || !today) { ignored += 1; continue; }
    const overdueDays = daysBetween(promiseDate, today);
    if (overdueDays === null) { ignored += 1; continue; }
    const band = waadaBand(overdueDays);
    if (!band) continue;
    const cents = moneyCents(row.promiseAmountCents, row.promiseAmount, { allowZero: true });
    rows.push({ customerId: text(row.customerId), customerName: text(row.customerName) || text(row.customerId), mohalla: puchoMohallaLabel(row.mohalla), promiseDate, overdueDays, band, cents });
  }
  return { rows, ignored };
}

function buildOverdueWaada(data, entry) {
  const { rows, ignored } = normWaada(data);
  rows.sort((a, b) => (WAADA_BAND_ORDER.indexOf(a.band) - WAADA_BAND_ORDER.indexOf(b.band))
    || (a.promiseDate < b.promiseDate ? -1 : a.promiseDate > b.promiseDate ? 1 : nameCompare(a.customerName, b.customerName)));
  if (rows.length === 0) return emptyAnswer(entry, 'Waada list mein koi overdue Waada record nahi.');
  const withAmount = rows.filter((r) => r.cents !== null);
  const total = withAmount.reduce((sum, r) => sum + r.cents, 0);
  const bandCounts = WAADA_BAND_ORDER.map((band) => `${band}: ${rows.filter((r) => r.band === band).length}`).join(', ');
  return baseAnswer(entry,
    `${rows.length} overdue Waada`,
    withAmount.length === rows.length ? total : null,
    [`Bands (oldest first): ${bandCounts}.`, withAmount.length === rows.length ? `Total promised: ${fromCents(total)} PKR.` : 'Kuch Waada amounts record nahi — total is liye nahi dikhaya gaya.', ...ignoredInsight(ignored, 'Waada rows')],
    ['Customer', 'Mohalla', 'Promise date', 'Days overdue', 'Band', 'Amount (PKR)'],
    rows.map((r) => [r.customerName, r.mohalla, r.promiseDate, String(r.overdueDays), r.band, r.cents === null ? '—' : fromCents(r.cents)]),
    [{ label: 'Waada follow-up', target: '' }]);
}

function normSuspense(data) {
  const today = data.today;
  const rows = [];
  let ignored = 0;
  for (const row of normList(data.suspense)) {
    if (row.claimed === true) continue;
    const date = validPuchoDate(row.date);
    if (!date || !today) { ignored += 1; continue; }
    const ageDays = Math.max(0, daysBetween(date, today) ?? 0);
    const cents = moneyCents(row.amountCents, row.amount);
    if (cents === null) { ignored += 1; continue; }
    rows.push({ id: text(row.id), customerId: text(row.customerId), customerName: text(row.customerName), date, ageDays, cents });
  }
  rows.sort((a, b) => (b.ageDays - a.ageDays) || (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1)));
  return { rows, ignored };
}

function buildSuspenseUnclaimed(data, entry) {
  const { rows, ignored } = normSuspense(data);
  if (rows.length === 0) return emptyAnswer(entry, 'Suspense list mein koi unclaimed record nahi.');
  const total = rows.reduce((sum, r) => sum + r.cents, 0);
  return baseAnswer(entry,
    `${rows.length} unclaimed suspense item${rows.length === 1 ? '' : 's'} — ${fromCents(total)} PKR`,
    total,
    [`Oldest unclaimed: ${rows[0].id || 'no id'} — ${fromCents(rows[0].cents)} PKR, ${rows[0].ageDays} days old (${rows[0].date}).`, ...ignoredInsight(ignored, 'suspense rows')],
    ['Suspense id', 'Date', 'Age (days)', 'Amount (PKR)'],
    rows.map((r) => [r.id || '—', r.date, String(r.ageDays), fromCents(r.cents)]),
    [{ label: 'Profile kholein', target: '' }]);
}

function normOpenTickets(data) {
  const rows = [];
  let ignored = 0;
  for (const row of normList(data.tickets)) {
    const status = text(row.status).toLowerCase();
    if (!TICKET_OPEN_STATUSES.includes(status)) continue;
    const priority = text(row.priority).toLowerCase();
    const rank = PRIORITY_RANK[priority] ?? 2;
    const reported = validPuchoDate(row.reportedDate);
    if (row.reportedDate && !reported) ignored += 1;
    rows.push({ id: text(row.id), customerId: text(row.customerId), customerName: text(row.customerName) || text(row.customerId), mohalla: puchoMohallaLabel(row.mohalla), category: text(row.category), priority: PRIORITY_RANK[priority] !== undefined ? priority : 'medium', rank, status, reportedDate: reported });
  }
  rows.sort((a, b) => (a.rank - b.rank)
    || ((a.reportedDate ?? '9999') < (b.reportedDate ?? '9999') ? -1 : (a.reportedDate ?? '9999') > (b.reportedDate ?? '9999') ? 1 : 0)
    || (a.id < b.id ? -1 : 1));
  return { rows, ignored };
}

function ticketWaitingDays(ticket, today) {
  if (!ticket.reportedDate || !today) return null;
  const diff = daysBetween(ticket.reportedDate, today);
  return diff === null ? null : Math.max(0, diff);
}

function buildOpenTickets(data, entry) {
  const { rows, ignored } = normOpenTickets(data);
  if (rows.length === 0) return emptyAnswer(entry, 'Ticket list mein koi open ticket record nahi.');
  const today = data.today;
  return baseAnswer(entry,
    `${rows.length} open ticket${rows.length === 1 ? '' : 's'}`,
    null,
    [`Highest priority first, phir sab se purana.`, ...ignoredInsight(ignored, 'ticket rows')],
    ['Customer', 'Mohalla', 'Category', 'Priority', 'Status', 'Reported', 'Waiting (days)'],
    rows.map((r) => {
      const waiting = ticketWaitingDays(r, today);
      return [r.customerName, r.mohalla, r.category || '—', r.priority, r.status, r.reportedDate || '—', waiting === null ? '—' : String(waiting)];
    }),
    [{ label: 'Ticket dekhein', target: '' }]);
}

function buildRepeatFaults(data, entry) {
  const rows = normList(data.repeatFlags).map((row) => ({
    customerId: text(row.customerId),
    customerName: text(row.customerName) || text(row.customerId),
    mohalla: puchoMohallaLabel(row.mohalla),
    category: text(row.category),
    count: Number(row.count) || 0,
    ticketIds: Array.isArray(row.ticketIds) ? row.ticketIds.map(String) : (Array.isArray(row.tickets) ? row.tickets.map((t) => String(t.id || t)) : []),
  })).filter((r) => r.count > 0);
  rows.sort((a, b) => (b.count - a.count) || nameCompare(a.customerName, b.customerName));
  if (rows.length === 0) return emptyAnswer(entry, 'Repeat-fault flags mein koi flagged customer nahi.');
  return baseAnswer(entry,
    `${rows.length} repeat-fault flagged customer${rows.length === 1 ? '' : 's'}`,
    null,
    ['Flags repeat-fault rule (Plan 24) se aaye hain — ye list khud koi flag nahi banati.'],
    ['Customer', 'Mohalla', 'Category', 'Tickets', 'Ticket ids'],
    rows.map((r) => [r.customerName, r.mohalla, r.category || '—', String(r.count), r.ticketIds.join(', ')]),
    [{ label: 'Ticket dekhein', target: '' }]);
}

function buildAtRisk(data, entry) {
  const rows = normList(data.atRisk).map((row) => ({
    customerId: text(row.customerId),
    customerName: text(row.customerName) || text(row.customerId),
    mohalla: puchoMohallaLabel(row.mohalla),
    signals: Array.isArray(row.signals) ? row.signals.map((s) => (typeof s === 'string' ? s : (s.label || s.text || ''))).filter(Boolean) : [],
  })).filter((r) => r.signals.length > 0);
  rows.sort((a, b) => (b.signals.length - a.signals.length) || nameCompare(a.customerName, b.customerName));
  if (rows.length === 0) return emptyAnswer(entry, 'At-risk list mein koi flagged customer nahi.');
  return baseAnswer(entry,
    `${rows.length} at-risk customer${rows.length === 1 ? '' : 's'}`,
    null,
    ['Har row ke saath woh signal dikhaya gaya hai jis ne flag trigger kiya.'],
    ['Customer', 'Mohalla', 'Triggering signals'],
    rows.map((r) => [r.customerName, r.mohalla, r.signals.join('; ')]),
    [{ label: 'Profile kholein', target: '' }]);
}

function buildDisputedBills(data, entry) {
  const rows = [];
  let ignored = 0;
  for (const row of normList(data.disputes)) {
    const status = text(row.status).toLowerCase();
    if (!DISPUTE_OPEN_STATUSES.includes(status)) continue;
    const total = moneyCents(row.totalCents, row.total, { allowZero: true });
    const disputed = moneyCents(row.disputedCents, row.disputed, { allowZero: true });
    if (total === null || disputed === null) { ignored += 1; continue; }
    const undisputed = Math.max(0, total - disputed);
    const excess = Math.max(0, disputed - total);
    rows.push({ caseId: text(row.caseId), customerId: text(row.customerId), customerName: text(row.customerName) || text(row.customerId), mohalla: puchoMohallaLabel(row.mohalla), billId: text(row.billId), billMonth: text(row.billMonth), total, disputed, undisputed, excess, status });
  }
  rows.sort((a, b) => nameCompare(a.customerName, b.customerName) || (a.billMonth < b.billMonth ? -1 : a.billMonth > b.billMonth ? 1 : 0));
  if (rows.length === 0) return emptyAnswer(entry, 'Dispute case log mein koi open case nahi.');
  const totalDisputed = rows.reduce((sum, r) => sum + r.disputed, 0);
  const totalUndisputed = rows.reduce((sum, r) => sum + r.undisputed, 0);
  const totalExcess = rows.reduce((sum, r) => sum + r.excess, 0);
  return baseAnswer(entry,
    `${rows.length} open dispute case${rows.length === 1 ? '' : 's'} — disputed ${fromCents(totalDisputed)} PKR, undisputed still due ${fromCents(totalUndisputed)} PKR`,
    totalDisputed,
    ['Undisputed hissa abhi bhi due hai; disputed hissa case ke faislay tak held hai.',
      ...(totalExcess > 0 ? [`${rows.filter((r) => r.excess > 0).length} case${rows.filter((r) => r.excess > 0).length === 1 ? '' : 's'} mein disputed amount total se zyada hai — excess ${fromCents(totalExcess)} PKR, undisputed 0.`] : []),
      ...ignoredInsight(ignored, 'dispute rows')],
    ['Customer', 'Bill', 'Total (PKR)', 'Disputed (PKR)', 'Undisputed due (PKR)', 'Status'],
    rows.map((r) => [r.customerName, r.billId || r.billMonth || '—', fromCents(r.total), fromCents(r.disputed), fromCents(r.undisputed), r.status]),
    [{ label: 'Profile kholein', target: '' }]);
}

function buildCollections(data, entry) {
  const today = data.today;
  const month = today ? today.slice(0, 7) : null;
  const todayRows = [];
  const monthRows = [];
  let ignored = 0;
  for (const row of normList(data.payments)) {
    if (row.voided === true) continue;
    const date = validPuchoDate(row.date);
    const cents = moneyCents(row.amountCents, row.amount);
    if (!date || cents === null) { ignored += 1; continue; }
    if (date === today) todayRows.push({ customerName: text(row.customerName) || '—', date, cents });
    if (month && date.slice(0, 7) === month) monthRows.push({ customerName: text(row.customerName) || '—', date, cents });
  }
  if (todayRows.length === 0 && monthRows.length === 0) return emptyAnswer(entry, 'Payment ledger mein aaj ya is mahine koi collection record nahi.');
  const todayTotal = todayRows.reduce((sum, r) => sum + r.cents, 0);
  const monthTotal = monthRows.reduce((sum, r) => sum + r.cents, 0);
  todayRows.sort((a, b) => (b.cents - a.cents) || nameCompare(a.customerName, b.customerName));
  const insights = [];
  if (todayRows.length === 0) insights.push('Aaj koi collection record nahi.');
  insights.push(`Is mahine ab tak: ${fromCents(monthTotal)} PKR (${monthRows.length} payment${monthRows.length === 1 ? '' : 's'}).`);
  insights.push(...ignoredInsight(ignored, 'payment rows'));
  return baseAnswer(entry,
    todayRows.length === 0
      ? `Aaj: koi collection record nahi · Is mahine: ${fromCents(monthTotal)} PKR`
      : `Aaj: ${fromCents(todayTotal)} PKR (${todayRows.length} payment${todayRows.length === 1 ? '' : 's'}) · Is mahine: ${fromCents(monthTotal)} PKR`,
    monthTotal,
    insights,
    ['Customer', 'Date', 'Amount (PKR)'],
    todayRows.map((r) => [r.customerName, r.date, fromCents(r.cents)]),
    [{ label: 'Profile kholein', target: '' }]);
}

function buildMohallaAttention(data, entry) {
  const { list: duesGroups } = groupDuesByMohalla(data.dues);
  const keys = new Map();
  const ensure = (key, label) => {
    if (!keys.has(key)) keys.set(key, { key, label, duesCents: 0, duesCount: 0, waadaCount: 0, ticketCount: 0 });
    return keys.get(key);
  };
  for (const group of duesGroups) ensure(group.key, group.label).duesCents = group.totalCents;
  for (const group of duesGroups) ensure(group.key, group.label).duesCount = group.count;
  // Waada and ticket rows carry only the display label, so regroup
  // them by the same canonical key here.
  for (const row of normList(data.waada)) {
    const promiseDate = validPuchoDate(row.promiseDate);
    if (!promiseDate || !data.today) continue;
    if (waadaBand(daysBetween(promiseDate, data.today) ?? 0) === null) continue;
    const key = puchoMohallaKey(row.mohalla);
    const groupKey = key === null ? '__unassigned__' : key;
    ensure(groupKey, key === null ? 'No mohalla recorded' : (puchoMohallaLabel(row.mohalla) || key)).waadaCount += 1;
  }
  for (const row of normList(data.tickets)) {
    const status = text(row.status).toLowerCase();
    if (!TICKET_OPEN_STATUSES.includes(status)) continue;
    const key = puchoMohallaKey(row.mohalla);
    const groupKey = key === null ? '__unassigned__' : key;
    ensure(groupKey, key === null ? 'No mohalla recorded' : (puchoMohallaLabel(row.mohalla) || key)).ticketCount += 1;
  }
  const list = [...keys.values()];
  // Ordered by total dues, highest first — stated plainly. Dues,
  // Waada counts, and ticket counts are shown separately and are
  // never blended into one score; there is no score field.
  list.sort((a, b) => (b.duesCents - a.duesCents) || nameCompare(a.label, b.label));
  if (list.length === 0) return emptyAnswer(entry, 'Kisi mohalla ka koi dues, overdue Waada, ya open ticket record nahi.');
  const first = list[0];
  return baseAnswer(entry,
    `Pehle tawajjo: ${first.label} — dues ${fromCents(first.duesCents)} PKR, ${first.waadaCount} overdue Waada, ${first.ticketCount} open ticket${first.ticketCount === 1 ? '' : 's'}`,
    first.duesCents,
    ['Order sirf total dues se hai, highest first. Dues, overdue Waada, aur open tickets alag alag dikhaye gaye hain — koi blended score nahi banaya gaya.'],
    ['Mohalla', 'Total dues (PKR)', 'Dues customers', 'Overdue Waada', 'Open tickets'],
    list.map((g) => [g.label, fromCents(g.duesCents), String(g.duesCount), String(g.waadaCount), String(g.ticketCount)]),
    [{ label: 'Area view', target: '' }]);
}

// The morning action queue, in the one fixed priority. Sections
// are appended in order and the whole queue is capped at 10;
// hasMore says whether a "baqi dekhein" link is needed.
export function buildMorningQueue(data = {}) {
  const today = data.today;
  const items = [];
  const push = (section, item) => { items.push({ section, ...item }); };

  // 1. Overdue Waada: band 15+ first, then 8-14, 4-7, 1-3;
  //    largest amount first inside each band.
  const { rows: waadaRows } = normWaada(data);
  waadaRows.sort((a, b) => (WAADA_BAND_ORDER.indexOf(a.band) - WAADA_BAND_ORDER.indexOf(b.band))
    || ((b.cents ?? 0) - (a.cents ?? 0))
    || nameCompare(a.customerName, b.customerName));
  for (const row of waadaRows) {
    push('Overdue Waada', {
      kind: 'waada',
      customerId: row.customerId,
      customerName: row.customerName,
      mohalla: row.mohalla,
      detail: `Waada ${row.promiseDate} — ${row.overdueDays} days overdue (band ${row.band})`,
      amountCents: row.cents,
      action: 'Waada follow-up',
    });
  }

  // 2. High-priority open tickets: no-connection first, oldest first.
  const { rows: ticketRows } = normOpenTickets(data);
  const high = ticketRows.filter((r) => r.priority === 'high' || r.priority === 'urgent');
  high.sort((a, b) => ((a.category === 'no_connection' ? 0 : 1) - (b.category === 'no_connection' ? 0 : 1))
    || ((a.reportedDate ?? '9999') < (b.reportedDate ?? '9999') ? -1 : (a.reportedDate ?? '9999') > (b.reportedDate ?? '9999') ? 1 : 0));
  for (const row of high) {
    push('Open ticket', {
      kind: 'ticket',
      customerId: row.customerId,
      customerName: row.customerName,
      mohalla: row.mohalla,
      detail: `${row.category || 'ticket'} — ${row.priority} priority, reported ${row.reportedDate || 'date not recorded'}`,
      amountCents: null,
      action: 'Ticket dekhein',
    });
  }

  // 3. Largest single outstanding balances.
  const duesRows = [];
  for (const row of normList(data.dues)) {
    const cents = moneyCents(row.outstandingCents, row.outstanding);
    if (cents === null) continue;
    duesRows.push({ customerId: text(row.customerId), customerName: text(row.customerName) || text(row.customerId), mohalla: puchoMohallaLabel(row.mohalla), cents });
  }
  duesRows.sort((a, b) => (b.cents - a.cents) || nameCompare(a.customerName, b.customerName));
  for (const row of duesRows) {
    push('Largest dues', {
      kind: 'dues',
      customerId: row.customerId,
      customerName: row.customerName,
      mohalla: row.mohalla,
      detail: `Outstanding ${fromCents(row.cents)} PKR`,
      amountCents: row.cents,
      action: 'Reminder draft',
    });
  }

  // 4. Suspense unclaimed longest, oldest first.
  const { rows: suspenseRows } = normSuspense(data);
  for (const row of suspenseRows) {
    push('Suspense unclaimed', {
      kind: 'suspense',
      customerId: row.customerId,
      customerName: row.customerName || 'Payer not identified',
      mohalla: '',
      detail: `${row.id || 'no id'} — ${fromCents(row.cents)} PKR, ${row.ageDays} days old (${row.date})`,
      amountCents: row.cents,
      action: 'Profile kholein',
    });
  }

  // 5. Expiring in the next 3 days, earliest first.
  const expiring = [];
  for (const row of normList(data.expiries)) {
    const expiry = validPuchoDate(row.expiryDate);
    if (!expiry || !today) continue;
    const diff = daysBetween(today, expiry);
    if (diff === null || diff < 0 || diff > 3) continue;
    expiring.push({ customerId: text(row.customerId), customerName: text(row.customerName) || text(row.customerId), mohalla: puchoMohallaLabel(row.mohalla), expiryDate: expiry, inDays: diff });
  }
  expiring.sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : nameCompare(a.customerName, b.customerName)));
  for (const row of expiring) {
    push('Expiring soon', {
      kind: 'expiry',
      customerId: row.customerId,
      customerName: row.customerName,
      mohalla: row.mohalla,
      detail: `Expires ${row.expiryDate} (in ${row.inDays} day${row.inDays === 1 ? '' : 's'})`,
      amountCents: null,
      action: 'Reminder draft',
    });
  }

  const totalCount = items.length;
  const shown = items.slice(0, 10);
  return {
    orderText: MORNING_QUEUE_ORDER_TEXT,
    items: shown,
    totalCount,
    shownCount: shown.length,
    hasMore: totalCount > 10,
    empty: totalCount === 0,
  };
}

const BUILDERS = {
  expiry_week: buildExpiryWeek,
  total_dues: buildTotalDues,
  dues_by_mohalla: buildDuesByMohalla,
  overdue_waada: buildOverdueWaada,
  suspense_unclaimed: buildSuspenseUnclaimed,
  open_tickets: buildOpenTickets,
  repeat_faults: buildRepeatFaults,
  at_risk: buildAtRisk,
  disputed_bills: buildDisputedBills,
  collections: buildCollections,
  mohalla_attention: buildMohallaAttention,
  morning_queue: (data, entry) => {
    const queue = buildMorningQueue(data);
    if (queue.empty) return emptyAnswer(entry, 'Morning queue ke liye koi record nahi — na overdue Waada, na high-priority ticket, na baqaya, na unclaimed suspense, na qareebi expiry.');
    return baseAnswer(entry,
      `Morning queue: ${queue.shownCount} of ${queue.totalCount} item${queue.totalCount === 1 ? '' : 's'} (cap 10)`,
      null,
      [queue.orderText, ...(queue.hasMore ? ['Baqi dekhein — queue mein aur items hain, jo full source lists mein milenge.'] : [])],
      ['#', 'What', 'Customer / mohalla', 'Detail', 'Action'],
      queue.items.map((item, i) => [String(i + 1), item.section, item.customerName + (item.mohalla ? ` · ${item.mohalla}` : ''), item.detail, item.action]),
      [{ label: 'Baqi dekhein', target: '' }]);
  },
};

// Ask one question. Returns every matched answer (most specific
// first) or, when nothing matches, the plain cannot-answer message
// plus the whole catalogue. Asking never changes any record: this
// function only reads the caller-supplied data.
export function answerPucho(question, data = {}) {
  const matched = matchPuchoQuestions(question);
  if (matched.length === 0) {
    return {
      question: text(question),
      matched: [],
      unmatched: true,
      unmatchedMessage: PUCHO_UNMATCHED_MESSAGE,
      catalogue: PUCHO_QUESTIONS.map((q) => ({ id: q.id, title: q.title })),
    };
  }
  const answers = matched.map((entry) => BUILDERS[entry.id](data, entry));
  return {
    question: text(question),
    matched: answers,
    unmatched: false,
    unmatchedMessage: '',
    catalogue: PUCHO_QUESTIONS.map((q) => ({ id: q.id, title: q.title })),
  };
}

export function puchoAnswerHtml(answer) {
  if (!answer) return '<p class="empty-state">Koi jawab nahi.</p>';
  let html = `<article class="pucho-answer"><h4>${escapeHtml(answer.title)}</h4>`;
  html += `<p><strong>${escapeHtml(answer.headline)}</strong></p>`;
  if (answer.insights.length) {
    html += `<p>Key insights</p><ul>${answer.insights.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
  }
  if (!answer.empty && answer.rows.length) {
    html += `<table class="pucho-answer-table"><thead><tr>${answer.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>`;
    html += answer.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
    html += '</tbody></table>';
  }
  html += `<p><small>Source: ${escapeHtml(answer.sourceScreen)}</small></p>`;
  if (answer.actions.length) {
    html += `<p>${answer.actions.map((a) => `<button class="secondary-button btn-sm pucho-action-btn" type="button" data-pucho-action="${escapeHtml(a.label)}" data-pucho-source="${escapeHtml(answer.sourceScreen)}">${escapeHtml(a.label)}</button>`).join(' ')}</p>`;
  }
  html += '</article>';
  return html;
}

export function puchoHtml(result) {
  if (!result) return '<p class="empty-state">Koi sawaal nahi poocha gaya.</p>';
  if (result.unmatched) {
    return `<p>${escapeHtml(result.unmatchedMessage)}</p>`
      + `<p>Supported questions:</p><ul>${result.catalogue.map((q) => `<li>${escapeHtml(q.title)}</li>`).join('')}</ul>`;
  }
  return result.matched.map(puchoAnswerHtml).join('');
}

export function puchoCatalogueHtml() {
  return `<p>Supported questions — in mein se aik poochein (Roman Urdu ya simple English):</p><ul>${PUCHO_QUESTIONS.map((q) => `<li>${escapeHtml(q.title)}</li>`).join('')}</ul>`;
}

export function morningQueueCsv(queue) {
  const lines = ['#, Section, Customer, Mohalla, Detail, Amount (PKR), Action'];
  for (let i = 0; i < (queue?.items ?? []).length; i += 1) {
    const item = queue.items[i];
    lines.push([i + 1, item.section, item.customerName, item.mohalla, item.detail, item.amountCents === null ? '' : fromCents(item.amountCents), item.action].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function morningQueueFilename() {
  return 'morning-action-queue.csv';
}
