// Plan 59 (Plan 1-100) — Former-customer winback queue with re-contact
// drafts.
//
// Households that left months ago sit in the archive and are never
// approached again, even though the fault that drove them away may
// long since be fixed. This module is the QUEUE for revisiting them
// deliberately: former customers ordered by time since leaving, each
// with the exit reason recorded by Plan 57 and the earlier save
// outcome recorded by Plan 58, plus one bilingual re-contact draft
// per entry that the operator sends by hand through the existing
// WhatsApp route. Nothing here sends in bulk, and nothing here
// reactivates anyone: reactivation still goes through the normal
// onboarding flow (Plan 16), and this queue creates no bill by
// itself.
//
// Scope fence, stated plainly against the neighbouring systems:
//   - SISP-108 (churn-winback.js) already runs a Win-Back Queue on
//     the dashboard: archived customers the owner marked
//     win-back eligible get a 1-tap WhatsApp free-reconnection
//     offer. This plan neither reads nor writes that store and
//     never touches a customer record. What it adds, and only what
//     it adds, is: (a) a queue of ALL former customers, not only
//     the win-back-eligible ones, ordered by time since leaving;
//     (b) each entry's Plan 57 exit reason and Plan 58 save outcome
//     shown together, so the operator knows what was already tried;
//     (c) a bilingual re-contact draft whose "what has changed"
//     line is operator-typed text carried verbatim — the module
//     never invents an improvement claim, and when the operator
//     types nothing, the draft carries no improvement sentence at
//     all; (d) a send log and a do-not-re-contact flag that removes
//     an entry from the queue without deleting its history.
//   - Plan 57's exit records and Plan 58's save conversations are
//     read as caller-supplied input and never rewritten here; the
//     module holds no bill, payment, package, or lifecycle field,
//     so recording, flagging, or sending from this queue can never
//     alter one.
//
// How the fence is kept in this module:
//   - It is import-free: the caller supplies every former customer,
//     every exit record, every save conversation, the flag list,
//     and today's date, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - A former customer without an id is not an entry: it is
//     dropped, never guessed. A leaving date that is not a real
//     calendar date (2026-02-30), or that lies in the future, gives
//     a null time-since-leaving, never a guessed date, and such
//     entries sort last.
//   - The leaving date is the archived date when the caller
//     supplies a valid one, else the Plan 57 record's recorded
//     date, else null. An exit reason outside Plan 57's six, or no
//     exit record at all, shows as "not recorded", never as a
//     guessed cause. A save outcome outside Plan 58's three is
//     ignored; the latest dated conversation wins, undated ones
//     count as the oldest.
//   - The draft promises nothing it cannot keep: no discount, no
//     instant reconnection, no "service fixed" claim unless the
//     operator typed that exact change. Sending only ever opens
//     the operator's WhatsApp draft and appends to the send log.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const WINBACK_EXIT_REASONS = [
  'price',
  'competitor',
  'repeated_faults',
  'moving_house',
  'service_quality',
  'other',
];

export const WINBACK_EXIT_REASON_LABELS = {
  price: 'Price too high',
  competitor: 'Competitor offer',
  repeated_faults: 'Repeated faults',
  moving_house: 'Moving house',
  service_quality: 'Service quality',
  other: 'Other',
};

export const WINBACK_SAVE_OUTCOMES = [
  'accepted_stayed',
  'declined_left',
  'still_deciding',
];

export const WINBACK_SAVE_OUTCOME_LABELS = {
  accepted_stayed: 'Accepted offer and stayed',
  declined_left: 'Declined offer and left',
  still_deciding: 'Still deciding',
};

export const WINBACK_NOT_RECORDED = 'Not recorded';

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

export function validWinbackDate(value) {
  const clean = text(value);
  if (!DATE_RE.test(clean)) return null;
  const [year, month, day] = clean.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return clean;
}

// A datetime ("YYYY-MM-DDTHH:MM") or a plain date, reduced to its
// date part when that part is a real calendar date.
export function winbackDatePart(value) {
  const raw = text(value);
  if (!raw) return null;
  return validWinbackDate(raw.slice(0, 10));
}

// Whole days between the leaving date and today, or null when
// either date is invalid or the leaving date lies in the future.
export function daysSinceLeaving(leftDate, today) {
  const left = validWinbackDate(leftDate);
  const now = validWinbackDate(today);
  if (!left || !now) return null;
  const toUtc = (date) => {
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const diff = toUtc(now) - toUtc(left);
  if (diff < 0) return null;
  return Math.floor(diff / 86400000);
}

function cleanExitRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const customerId = text(raw.customerId);
  if (!customerId) return null;
  const reason = text(raw.reason);
  if (!WINBACK_EXIT_REASONS.includes(reason)) return null;
  let recordedDate = null;
  if (raw.recordedDate !== undefined && raw.recordedDate !== null && text(raw.recordedDate) !== '') {
    recordedDate = validWinbackDate(raw.recordedDate);
    if (!recordedDate) return null;
  }
  return { customerId, reason, recordedDate };
}

function cleanSaveConversation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const customerId = text(raw.customerId);
  if (!customerId) return null;
  const outcome = text(raw.outcome);
  if (!WINBACK_SAVE_OUTCOMES.includes(outcome)) return null;
  let conversationDate = null;
  if (raw.conversationDate !== undefined && raw.conversationDate !== null && text(raw.conversationDate) !== '') {
    conversationDate = validWinbackDate(raw.conversationDate);
    if (!conversationDate) return null;
  }
  return { customerId, outcome, conversationDate };
}

// One queue entry per former customer. The caller supplies the
// former customers (archived or disconnected); this function never
// decides who counts as former, it only orders and annotates them.
export function buildWinbackQueue({ formerCustomers, exitRecords, saveConversations, doNotRecontactIds, today } = {}) {
  const exits = new Map();
  for (const raw of Array.isArray(exitRecords) ? exitRecords : []) {
    const record = cleanExitRecord(raw);
    if (record) exits.set(record.customerId, record);
  }
  const saves = new Map();
  for (const raw of Array.isArray(saveConversations) ? saveConversations : []) {
    const record = cleanSaveConversation(raw);
    if (!record) continue;
    const current = saves.get(record.customerId);
    if (!current) { saves.set(record.customerId, record); continue; }
    if (record.conversationDate && (!current.conversationDate || record.conversationDate >= current.conversationDate)) {
      saves.set(record.customerId, record);
    }
  }
  const flagged = new Set((Array.isArray(doNotRecontactIds) ? doNotRecontactIds : []).map((id) => text(id)).filter(Boolean));
  const entries = [];
  for (const customer of Array.isArray(formerCustomers) ? formerCustomers : []) {
    if (!customer || typeof customer !== 'object') continue;
    const customerId = text(customer.id);
    if (!customerId) continue;
    if (flagged.has(customerId)) continue;
    const exit = exits.get(customerId) ?? null;
    const leftDate = winbackDatePart(customer.archivedAt) ?? winbackDatePart(customer.leftDate) ?? (exit ? exit.recordedDate : null);
    const save = saves.get(customerId) ?? null;
    entries.push({
      customerId,
      customerName: text(customer.name || customer.customerName),
      mohalla: text(customer.mohalla || customer.area),
      leftDate,
      daysSinceLeaving: daysSinceLeaving(leftDate, today),
      exitReason: exit ? exit.reason : null,
      exitReasonLabel: exit ? WINBACK_EXIT_REASON_LABELS[exit.reason] : WINBACK_NOT_RECORDED,
      saveOutcome: save ? save.outcome : null,
      saveOutcomeLabel: save ? WINBACK_SAVE_OUTCOME_LABELS[save.outcome] : WINBACK_NOT_RECORDED,
    });
  }
  entries.sort((a, b) => {
    if (a.daysSinceLeaving === null && b.daysSinceLeaving !== null) return 1;
    if (a.daysSinceLeaving !== null && b.daysSinceLeaving === null) return -1;
    if (a.daysSinceLeaving !== null && b.daysSinceLeaving !== null && a.daysSinceLeaving !== b.daysSinceLeaving) {
      return b.daysSinceLeaving - a.daysSinceLeaving;
    }
    return (a.customerName || a.customerId).localeCompare(b.customerName || b.customerId) || a.customerId.localeCompare(b.customerId);
  });
  return entries;
}

// Former customers kept out of the queue by the do-not-re-contact
// flag, listed so the operator can allow one back. Flagging never
// deletes the exit record, the save conversation, or the customer.
export function winbackDoNotRecontactList({ formerCustomers, doNotRecontactIds } = {}) {
  const flagged = new Set((Array.isArray(doNotRecontactIds) ? doNotRecontactIds : []).map((id) => text(id)).filter(Boolean));
  const entries = [];
  for (const customer of Array.isArray(formerCustomers) ? formerCustomers : []) {
    if (!customer || typeof customer !== 'object') continue;
    const customerId = text(customer.id);
    if (!customerId || !flagged.has(customerId)) continue;
    entries.push({
      customerId,
      customerName: text(customer.name || customer.customerName),
      mohalla: text(customer.mohalla || customer.area),
    });
  }
  entries.sort((a, b) => (a.customerName || a.customerId).localeCompare(b.customerName || b.customerId) || a.customerId.localeCompare(b.customerId));
  return entries;
}

export function markDoNotRecontact(ids, customerId) {
  const clean = (Array.isArray(ids) ? ids : []).map((id) => text(id)).filter(Boolean);
  const id = text(customerId);
  if (!id || clean.includes(id)) return clean;
  return [...clean, id];
}

export function unmarkDoNotRecontact(ids, customerId) {
  const id = text(customerId);
  const clean = (Array.isArray(ids) ? ids : []).map((item) => text(item)).filter(Boolean);
  if (!id) return clean;
  return clean.filter((item) => item !== id);
}

export function winbackDraftVariants() {
  return ['roman', 'urdu'];
}

// One re-contact draft for one queue entry. The whatChanged line is
// carried verbatim only when the operator supplies it; with nothing
// supplied the draft carries no improvement sentence at all, so it
// can never invent a fix, a discount, or a reconnection promise.
export function buildRecontactDraft(entry, { whatChanged, variant } = {}) {
  if (!entry || typeof entry !== 'object' || !text(entry.customerId)) return null;
  const name = text(entry.customerName) || 'customer';
  const change = text(whatChanged);
  const useVariant = variant === 'urdu' ? 'urdu' : 'roman';
  if (useVariant === 'urdu') {
    const lines = [
      `السلام علیکم ${name}،`,
      'آپ کچھ عرصہ پہلے شاہدرہ فائبر نیٹ کے گاہک تھے۔ ہم آپ سے دوبارہ رابطہ کر رہے ہیں اور واپسی کی دعوت دیتے ہیں۔',
    ];
    if (change) lines.push(change);
    lines.push('اگر آپ دوبارہ سروس لینا چاہیں تو جواب دیں — بحالی معمول کے آن بورڈنگ عمل سے ہوگی، اس پیغام سے کوئی بل نہیں بنے گا۔');
    return { customerId: text(entry.customerId), variant: 'urdu', text: lines.join('\n') };
  }
  const lines = [
    `Assalam-o-Alaikum ${name},`,
    'Aap kuch arsa pehle Shahdara Fiber Net ke customer the. Hum aap se dobara rabta kar rahe hain aur wapsi ki dawat dete hain.',
  ];
  if (change) lines.push(change);
  lines.push('Agar aap dobara service lena chahein to jawab dein — bahali normal onboarding process se hogi, is message se koi bill nahi banega.');
  return { customerId: text(entry.customerId), variant: 'roman', text: lines.join('\n') };
}

export function logWinbackSend(log, { customerId, sentAt, variant, channel } = {}) {
  const clean = Array.isArray(log) ? log.filter((item) => item && typeof item === 'object') : [];
  const id = text(customerId);
  if (!id) return clean;
  return [...clean, {
    customerId: id,
    sentAt: text(sentAt),
    variant: variant === 'urdu' ? 'urdu' : 'roman',
    channel: text(channel) || 'whatsapp',
  }];
}

export function findWinbackSends(log, customerId) {
  const id = text(customerId);
  if (!id) return [];
  return (Array.isArray(log) ? log : []).filter((item) => item && text(item.customerId) === id);
}

export function winbackSentText(sends) {
  const count = Array.isArray(sends) ? sends.length : 0;
  if (count === 0) return 'Not sent yet';
  return count === 1 ? 'Sent once' : `Sent ${count} times`;
}

export function buildWinbackSummary(queue) {
  const entries = Array.isArray(queue) ? queue : [];
  const withReason = entries.filter((entry) => entry.exitReason).length;
  const withSave = entries.filter((entry) => entry.saveOutcome).length;
  return { total: entries.length, withExitReason: withReason, withoutExitReason: entries.length - withReason, withSaveOutcome: withSave };
}

export function winbackSummaryText(summary) {
  if (!summary) return '';
  return `${summary.total} former customer${summary.total === 1 ? '' : 's'} in the winback queue · ${summary.withExitReason} with a recorded exit reason · ${summary.withSaveOutcome} with an earlier save outcome`;
}

export function winbackHtml(queue, sendsByCustomer = {}) {
  const entries = Array.isArray(queue) ? queue : [];
  if (entries.length === 0) return '<p style="font-size: 12px;">No former customers in the winback queue.</p>';
  const rows = entries.map((entry) => {
    const sends = Array.isArray(sendsByCustomer[entry.customerId]) ? sendsByCustomer[entry.customerId].length : 0;
    return `<tr><td>${escapeHtml(entry.customerName || entry.customerId)}</td><td>${escapeHtml(entry.mohalla || 'Not recorded')}</td><td>${escapeHtml(entry.leftDate || 'Not recorded')}</td><td>${entry.daysSinceLeaving === null ? 'Not recorded' : `${entry.daysSinceLeaving} days ago`}</td><td>${escapeHtml(entry.exitReasonLabel)}</td><td>${escapeHtml(entry.saveOutcomeLabel)}</td><td>${sends === 0 ? 'Not sent' : `Sent ${sends}x`}</td></tr>`;
  }).join('');
  return `<table class="data-table"><thead><tr><th>Customer</th><th>Mohalla</th><th>Left</th><th>Time since leaving</th><th>Exit reason</th><th>Earlier save outcome</th><th>Re-contact sent</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function winbackCsv(queue) {
  const entries = Array.isArray(queue) ? queue : [];
  const header = ['customerId', 'customerName', 'mohalla', 'leftDate', 'daysSinceLeaving', 'exitReason', 'saveOutcome'].map(csvCell).join(',');
  const rows = entries.map((entry) => [
    entry.customerId,
    entry.customerName,
    entry.mohalla,
    entry.leftDate ?? '',
    entry.daysSinceLeaving === null ? '' : entry.daysSinceLeaving,
    entry.exitReason ?? '',
    entry.saveOutcome ?? '',
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function winbackFilename() {
  return 'winback-queue.csv';
}
