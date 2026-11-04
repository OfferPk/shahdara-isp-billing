// Plan 170 (Plan 101-202) — Referral Thank-You Draft.
//
// A customer who brings a new customer hears nothing for it, so the
// goodwill that brought the new connection fades and is rarely
// repeated. This module prepares ONE thank-you draft per referring
// customer per new customer: linked by the referring customer's id
// and the new customer's id only, with a short personal thank-you in
// the referrer's preferred draft language. The operator reviews and
// sends it by hand after the new connection is confirmed.
//
// What this module is NOT, stated plainly:
//   - It is not the referral record itself. Plan 28's referral
//     tracking stores who referred whom; this module only prepares
//     a thank-you draft where such a link is already stored, and it
//     neither reads nor writes that record. The caller supplies the
//     stored links, and a draft naming a pair with no stored link is
//     refused outright.
//   - It is not the SISP-40 hamsaya referral credit engine, and it
//     neither reads nor writes it. A thank-you draft states no
//     offer, discount, or credit, and grants no benefit by itself:
//     the draft carries no offer, discount, or credit field at all,
//     and unknown fields are dropped.
//   - It never changes any bill, payment, package, or referral
//     record. Preparing, marking, or removing a draft touches no
//     other record type.
//   - It never sends anything by itself. Marking a draft sent only
//     records that the operator sent it by hand; the sending itself
//     happened outside this module.
//   - It is not proof that the thanks are deserved or the wording
//     right. The draft shows exactly what the operator recorded;
//     the module verifies format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record
//     and every stored referral link, and the module never reads
//     storage, the clock, or the network, and never touches
//     another record.
//   - A draft with no id, no referring customer, no new customer,
//     or no thank-you message is refused outright. Unknown fields
//     are dropped, so a draft can never grow an offer, discount,
//     credit, bill, payment, package, status, or sending field.
//   - A draft can only be prepared where a referral link is already
//     stored for exactly that referrer and new customer. The link
//     itself is only matched, never created, changed, or removed.
//   - One draft per referrer and new customer (case-insensitive):
//     a second draft for the same pair with a different id is
//     refused outright. To change a draft the operator removes the
//     old one and records a new one.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures also leaves the list unchanged.
//   - The sent mark lives on that draft only, so marking one
//     draft sent never marks another draft sent.

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

function normalizeLanguage(value) {
  return cleanKey(value) === 'urdu' ? 'urdu' : 'roman';
}

function sameRecord(a, b) {
  return a.id === b.id
    && a.referrerId === b.referrerId
    && a.newCustomerId === b.newCustomerId
    && a.message === b.message
    && a.language === b.language
    && a.sent === b.sent
    && a.sentDate === b.sentDate;
}

export function normalizeReferralThanks(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const id = cleanText(draft.id);
  const referrerId = cleanText(draft.referrerId ?? draft.referrer);
  const newCustomerId = cleanText(draft.newCustomerId ?? draft.newCustomer);
  const message = cleanText(draft.message ?? draft.thankYou);
  if (!id || !referrerId || !newCustomerId) return null;
  if (cleanKey(referrerId) === cleanKey(newCustomerId)) return null;
  if (!message) return null;
  const language = normalizeLanguage(draft.language);
  const sent = draft.sent === true;
  let sentDate = '';
  if (draft.sentDate !== undefined && draft.sentDate !== null && draft.sentDate !== '') {
    if (!isStrictDate(draft.sentDate)) return null;
    sentDate = draft.sentDate;
  }
  return { id, referrerId, newCustomerId, message, language, sent, sentDate };
}

export function normalizeReferralThanksList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenIds = new Set();
  const seenPairs = new Set();
  for (const item of list) {
    const record = normalizeReferralThanks(item);
    if (!record) continue;
    if (seenIds.has(record.id)) continue;
    const pair = `${cleanKey(record.referrerId)}\n${cleanKey(record.newCustomerId)}`;
    if (seenPairs.has(pair)) continue;
    seenIds.add(record.id);
    seenPairs.add(pair);
    out.push(record);
  }
  return out;
}

export function findReferralThanks(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  for (const record of normalizeReferralThanksList(list)) {
    if (record.id === clean) return record;
  }
  return null;
}

// A stored referral link names a referrer and a referred customer
// under the field names Plan 28 uses (with its accepted aliases).
// The link is only matched here, never created or changed.
export function hasStoredReferralLink(links, referrerId, newCustomerId) {
  const referrer = cleanKey(referrerId);
  const referred = cleanKey(newCustomerId);
  if (!referrer || !referred) return false;
  if (!Array.isArray(links)) return false;
  return links.some((link) => {
    if (!link || typeof link !== 'object') return false;
    const linkReferrer = cleanKey(
      link.referrerCustomerId ?? link.referrerId ?? link.referredByCustomerId,
    );
    const linkReferred = cleanKey(
      link.referredCustomerId ?? link.referredId ?? link.customerId,
    );
    return linkReferrer === referrer && linkReferred === referred;
  });
}

export function upsertReferralThanks(list, draft, referralLinks) {
  const clean = normalizeReferralThanksList(list);
  const record = normalizeReferralThanks(draft);
  if (!record) return clean;
  if (!hasStoredReferralLink(referralLinks, record.referrerId, record.newCustomerId)) return clean;
  const existing = clean.find((item) => item.id === record.id);
  if (existing) return sameRecord(existing, record) ? clean : clean;
  const pairTaken = clean.some((item) =>
    cleanKey(item.referrerId) === cleanKey(record.referrerId)
    && cleanKey(item.newCustomerId) === cleanKey(record.newCustomerId));
  if (pairTaken) return clean;
  return [...clean, record];
}

export function removeReferralThanks(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeReferralThanksList(list);
  return normalizeReferralThanksList(list).filter((item) => item.id !== clean);
}

export function markReferralThanksSent(list, id, sentDate) {
  const clean = normalizeReferralThanksList(list);
  const target = cleanText(id);
  if (!target) return clean;
  let date = '';
  if (sentDate !== undefined && sentDate !== null && sentDate !== '') {
    if (!isStrictDate(sentDate)) return clean;
    date = sentDate;
  }
  return clean.map((item) => (item.id === target
    ? { ...item, sent: true, sentDate: date }
    : item));
}

export function markReferralThanksUnsent(list, id) {
  const clean = normalizeReferralThanksList(list);
  const target = cleanText(id);
  if (!target) return clean;
  return clean.map((item) => (item.id === target
    ? { ...item, sent: false, sentDate: '' }
    : item));
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function referralThanksForReferrer(list, referrerId) {
  const key = cleanKey(referrerId);
  if (!key) return [];
  return normalizeReferralThanksList(list)
    .filter((item) => cleanKey(item.referrerId) === key)
    .sort((a, b) => compareText(a.newCustomerId, b.newCustomerId) || compareText(a.id, b.id));
}

export function referralThanksForNewCustomer(list, newCustomerId) {
  const key = cleanKey(newCustomerId);
  if (!key) return [];
  return normalizeReferralThanksList(list)
    .filter((item) => cleanKey(item.newCustomerId) === key)
    .sort((a, b) => compareText(a.referrerId, b.referrerId) || compareText(a.id, b.id));
}

export function referralThanksReferrers(list) {
  const seen = new Map();
  for (const item of normalizeReferralThanksList(list)) {
    const key = cleanKey(item.referrerId);
    if (!seen.has(key)) seen.set(key, item.referrerId);
  }
  return [...seen.values()].sort(compareText);
}

export function referralThanksSentList(list) {
  return normalizeReferralThanksList(list)
    .filter((item) => item.sent)
    .sort((a, b) => compareText(a.referrerId, b.referrerId) || compareText(a.newCustomerId, b.newCustomerId));
}

export function referralThanksUnsentList(list) {
  return normalizeReferralThanksList(list)
    .filter((item) => !item.sent)
    .sort((a, b) => compareText(a.referrerId, b.referrerId) || compareText(a.newCustomerId, b.newCustomerId));
}

export function referralThanksText(draft) {
  const record = normalizeReferralThanks(draft);
  if (!record) return '';
  return record.message;
}

export function referralThanksSummaryText(list) {
  const clean = normalizeReferralThanksList(list);
  const sent = clean.filter((item) => item.sent).length;
  const referrers = referralThanksReferrers(clean).length;
  return `${clean.length} referral thank-you drafts · ${referrers} referrers · ${sent} sent`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function referralThanksHtml(draft) {
  const record = normalizeReferralThanks(draft);
  if (!record) return '';
  const sentLabel = record.sent
    ? `Sent${record.sentDate ? ` on ${escapeHtml(record.sentDate)}` : ''}`
    : 'Not sent';
  const languageLabel = record.language === 'urdu' ? 'Urdu script' : 'Roman Urdu';
  return `<div><strong>${escapeHtml(record.referrerId)}</strong> thanked for referring ${escapeHtml(record.newCustomerId)} — ${escapeHtml(languageLabel)} — ${escapeHtml(sentLabel)}<br>${escapeHtml(record.message)}</div>`;
}

export function referralThanksAllHtml(list) {
  const clean = normalizeReferralThanksList(list);
  if (clean.length === 0) return '<p>No referral thank-you drafts recorded yet.</p>';
  const sorted = [...clean].sort((a, b) =>
    compareText(a.referrerId, b.referrerId) || compareText(a.newCustomerId, b.newCustomerId));
  return sorted.map((item) => referralThanksHtml(item)).join('');
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function referralThanksCsv(list) {
  const rows = normalizeReferralThanksList(list);
  const lines = ['id,referrerId,newCustomerId,message,language,sent,sentDate'];
  for (const item of rows) {
    lines.push([
      csvCell(item.id),
      csvCell(item.referrerId),
      csvCell(item.newCustomerId),
      csvCell(item.message),
      csvCell(item.language),
      csvCell(item.sent ? 'yes' : 'no'),
      csvCell(item.sentDate),
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function referralThanksFilename() {
  return 'referral-thank-you-drafts.csv';
}
