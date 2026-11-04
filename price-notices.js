// Plan 94 (Plan 1-100) — Advance price-change notice draft: a price
// rise told in advance with its date is a business decision customers
// can accept, while the same rise discovered on a bill feels like a
// trick. This module composes the notice; it never sends anything
// and never changes a price or a bill by itself.
//
// This module is the DRAFT only, and nothing else:
//
//   - It is pure and import-free: the caller supplies every price
//     revision and every baseline price, and the module never reads
//     storage, the clock, or the network, and never mutates an
//     input. It holds no bill, payment, or customer field of its
//     own; a notice names a package, an old price, a new price, an
//     effective date, and one operator-written reason line.
//   - A draft is built from the recorded price history (Plan 34):
//     for each revision, the old price is the previous revision's
//     amount for the same package, or the catalogue baseline when
//     the revision is the first for that package. A revision whose
//     amount equals the price it replaces is not a change, so it
//     gets no draft — there is nothing to announce. A revision
//     with no previous price and no baseline gets a draft whose
//     old price is unrecorded, never guessed.
//   - The draft is bilingual: one Roman Urdu variant and one Urdu
//     script variant, both carrying the same figures. The reason
//     is carried verbatim from the operator's one line; with no
//     reason supplied the draft says so plainly instead of
//     inventing one.
//   - Sending is operator-only: the operator sends through the
//     existing WhatsApp route or the mohalla announcement route
//     (Plan 14) and records the send here. Sending is logged and
//     never alters any price, bill, or customer record, and a
//     sent draft stays available to re-send.
//   - Amounts are integer cents. A field named *Cents is used
//     as-is; a plain amount in rupees converts once (x100,
//     rounded), so a stored record re-read through the normaliser
//     never inflates a hundredfold. Dates are real YYYY-MM-DD
//     calendar dates (2026-02-30 is rejected, never guessed).
//
// Fence, checked first: the price history (Plan 34) is a
// per-package, effective-dated record, and the mohalla broadcast
// drafts (Plan 14) are the announcement route. Neither is read
// or rewritten here — the caller supplies the history rows, and
// this module only composes drafts from them and logs sends.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validNoticeDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 30, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeNoticePackageKey(value) {
  const text = cleanText(value);
  if (!text) return '';
  return text.replace(/\s+/g, ' ').toLowerCase();
}

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }
  return null;
}

// A *Cents field is used as-is (integer cents); a plain amount in
// rupees converts once. Negative or non-finite amounts are never
// stored as zero — the record is refused outright.
function toCents(centsValue, rupeeValue) {
  const cents = finiteNumber(centsValue);
  if (cents !== null) {
    if (!Number.isInteger(cents) || cents < 0) return null;
    return cents;
  }
  const rupees = finiteNumber(rupeeValue);
  if (rupees === null || rupees < 0) return null;
  return Math.round(rupees * 100);
}

export function formatNoticeCents(cents) {
  if (!Number.isInteger(cents) || cents < 0) return '';
  const rupees = Math.floor(cents / 100);
  const paise = String(cents % 100).padStart(2, '0');
  return `Rs. ${rupees.toLocaleString('en-US')}.${paise}`;
}

export const PRICE_NOTICE_CHANNELS = Object.freeze(['whatsapp', 'announcement']);

export const PRICE_NOTICE_CHANNEL_LABELS = Object.freeze({
  whatsapp: 'WhatsApp',
  announcement: 'Mohalla announcement',
});

// A stored notice: one operator-written reason line is required,
// because a notice without its reason is a surprise with a date
// but no explanation. Drafts built from history (see below) are
// a separate shape and may carry an empty reason.
export function normalizePriceNotice(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const id = cleanText(input.id);
  if (!id) return null;
  const packageKey = normalizeNoticePackageKey(input.packageKey ?? input.packageId ?? input.package);
  if (!packageKey) return null;
  const effectiveDate = validNoticeDate(input.effectiveDate ?? input.date);
  if (!effectiveDate) return null;
  const oldCents = toCents(input.oldCents, input.oldAmount ?? input.oldPrice);
  const newCents = toCents(input.newCents, input.newAmount ?? input.newPrice);
  if (oldCents === null || newCents === null) return null;
  if (oldCents === newCents) return null;
  const reason = cleanText(input.reason);
  if (!reason) return null;
  const status = input.status === 'sent' ? 'sent' : 'draft';
  return {
    id,
    packageKey,
    packageLabel: cleanText(input.packageLabel ?? input.label ?? input.packageKey ?? input.packageId),
    oldCents,
    newCents,
    effectiveDate,
    reason,
    status,
  };
}

export function normalizePriceNoticeList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const notice = normalizePriceNotice(item);
    if (notice) out.push(notice);
  }
  out.sort((a, b) => (
    a.effectiveDate.localeCompare(b.effectiveDate)
    || a.packageKey.localeCompare(b.packageKey)
    || a.id.localeCompare(b.id)
  ));
  return out;
}

export function upsertPriceNotice(list, notice) {
  const clean = normalizePriceNoticeList(list);
  const next = normalizePriceNotice(notice);
  if (!next) return clean;
  return normalizePriceNoticeList([...clean.filter((item) => item.id !== next.id), next]);
}

export function removePriceNotice(list, id) {
  return normalizePriceNoticeList(list).filter((item) => item.id !== cleanText(id));
}

export function filterPriceNotices(list, filters = {}) {
  const clean = normalizePriceNoticeList(list);
  const packageKey = normalizeNoticePackageKey(filters.packageKey ?? '');
  const status = cleanText(filters.status ?? '');
  return clean.filter((item) => (
    (!packageKey || item.packageKey === packageKey)
    && (!status || item.status === status)
  ));
}

// One draft per recorded price change, built from caller-supplied
// history rows ({ packageKey, packageLabel, amount, effectiveDate })
// in rupees and baseline rows ({ packageKey, amount }) in rupees.
// The old price is the previous revision for the same package, or
// the baseline when the revision is the first. Revisions are read
// in effective-date order per package, so the "previous" price is
// always the price in force just before the change.
export function buildNoticeDrafts(history, baselines = [], reasons = {}) {
  if (!Array.isArray(history)) return [];
  const baselineByKey = new Map();
  for (const row of Array.isArray(baselines) ? baselines : []) {
    if (!row || typeof row !== 'object') continue;
    const key = normalizeNoticePackageKey(row.packageKey ?? row.packageId ?? row.id);
    if (!key || baselineByKey.has(key)) continue;
    const cents = toCents(row.amountCents, row.amount ?? row.price);
    if (cents !== null) baselineByKey.set(key, cents);
  }
  const rows = [];
  for (const row of history) {
    if (!row || typeof row !== 'object') continue;
    const key = normalizeNoticePackageKey(row.packageKey ?? row.packageId ?? row.package);
    const effectiveDate = validNoticeDate(row.effectiveDate ?? row.date);
    const newCents = toCents(row.newCents, row.amount ?? row.newAmount ?? row.price);
    if (!key || !effectiveDate || newCents === null) continue;
    rows.push({
      packageKey: key,
      packageLabel: cleanText(row.packageLabel ?? row.label ?? row.packageKey ?? row.packageId),
      effectiveDate,
      newCents,
    });
  }
  rows.sort((a, b) => (
    a.effectiveDate.localeCompare(b.effectiveDate)
    || a.packageKey.localeCompare(b.packageKey)
    || a.newCents - b.newCents
  ));
  const lastByKey = new Map();
  const drafts = [];
  for (const row of rows) {
    const previous = lastByKey.has(row.packageKey) ? lastByKey.get(row.packageKey) : (baselineByKey.get(row.packageKey) ?? null);
    lastByKey.set(row.packageKey, row.newCents);
    if (previous !== null && previous === row.newCents) continue;
    const reasonKey = `${row.packageKey}|${row.effectiveDate}`;
    const reason = cleanText(reasons[reasonKey] ?? reasons[row.packageKey] ?? '');
    drafts.push({
      id: `${row.packageKey}@${row.effectiveDate}`,
      packageKey: row.packageKey,
      packageLabel: row.packageLabel,
      oldCents: previous,
      newCents: row.newCents,
      effectiveDate: row.effectiveDate,
      reason,
      direction: previous === null ? 'unknown' : (row.newCents > previous ? 'increase' : 'decrease'),
      complete: previous !== null && reason !== '',
    });
  }
  return drafts;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Both variants carry the same figures: package, old price, new
// price, effective date, and the operator's reason line verbatim.
// Nothing is ever invented: an unrecorded old price or reason is
// said plainly in both variants.
export function buildNoticeText(draft, variant = 'roman') {
  if (!draft || typeof draft !== 'object') return '';
  const label = draft.packageLabel || draft.packageKey || '';
  const oldText = draft.oldCents === null || draft.oldCents === undefined ? null : formatNoticeCents(draft.oldCents);
  const newText = formatNoticeCents(draft.newCents);
  const reason = cleanText(draft.reason);
  if (variant === 'urdu') {
    const lines = [
      'السلام علیکم!',
      label ? `آپ کا پیکج ${label} ہے۔` : 'آپ کا پیکج ہے۔',
      oldText
        ? `اس کی قیمت ${oldText} سے بدل کر ${newText} ہو جائے گی۔`
        : `اس کی نئی قیمت ${newText} ہو گی۔`,
      `یہ نئی قیمت ${draft.effectiveDate} سے لاگو ہو گی۔`,
      reason ? `وجہ: ${reason}` : 'وجہ درج نہیں ہے۔',
      oldText ? '' : 'پرانی قیمت درج نہیں ہے، اس لیے صرف نئی قیمت بتائی جا رہی ہے۔',
      'شکریہ — شاہدرہ فائبر نیٹ',
    ];
    return lines.filter(Boolean).join('\n');
  }
  const lines = [
    'Assalam-o-Alaikum!',
    label ? `Aap ka package ${label} hai.` : 'Aap ka package hai.',
    oldText
      ? `Iski qeemat ${oldText} se badal kar ${newText} ho jayegi.`
      : `Iski nayi qeemat ${newText} hogi.`,
    `Yeh nayi qeemat ${draft.effectiveDate} se laagu hogi.`,
    reason ? `Wajah: ${reason}` : 'Wajah darj nahi hai.',
    oldText ? '' : 'Purani qeemat darj nahi hai, is liye sirf nayi qeemat batayi ja rahi hai.',
    'Shukriya — Shahdara Fiber Net',
  ];
  return lines.filter(Boolean).join('\n');
}

export function priceNoticeSummaryText(notices) {
  const clean = normalizePriceNoticeList(notices);
  const sent = clean.filter((item) => item.status === 'sent').length;
  return `${clean.length} notice${clean.length === 1 ? '' : 's'} (${sent} sent, ${clean.length - sent} draft${clean.length - sent === 1 ? '' : 's'})`;
}

export function priceNoticeHtml(notices) {
  const clean = normalizePriceNoticeList(notices);
  if (clean.length === 0) return '<p class="chart-caption">No price-change notices yet.</p>';
  const rows = clean.map((item) => (
    `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.packageLabel || item.packageKey)}</td>`
    + `<td>${escapeHtml(formatNoticeCents(item.oldCents))}</td><td>${escapeHtml(formatNoticeCents(item.newCents))}</td>`
    + `<td>${escapeHtml(item.effectiveDate)}</td><td>${escapeHtml(item.reason)}</td><td>${escapeHtml(item.status)}</td></tr>`
  )).join('');
  return '<table class="data-table"><thead><tr><th>Notice</th><th>Package</th><th>Old price</th><th>New price</th><th>Effective</th><th>Reason</th><th>Status</th></tr></thead>'
    + `<tbody>${rows}</tbody></table>`;
}

export function priceNoticeDraftHtml(drafts) {
  if (!Array.isArray(drafts) || drafts.length === 0) return '<p class="chart-caption">No recorded price changes to announce yet.</p>';
  const rows = drafts.map((item) => (
    `<tr><td>${escapeHtml(item.packageLabel || item.packageKey)}</td>`
    + `<td>${item.oldCents === null ? 'Not recorded' : escapeHtml(formatNoticeCents(item.oldCents))}</td>`
    + `<td>${escapeHtml(formatNoticeCents(item.newCents))}</td><td>${escapeHtml(item.effectiveDate)}</td>`
    + `<td>${escapeHtml(item.reason || 'Reason not recorded yet')}</td></tr>`
  )).join('');
  return '<table class="data-table"><thead><tr><th>Package</th><th>Old price</th><th>New price</th><th>Effective</th><th>Reason</th></tr></thead>'
    + `<tbody>${rows}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function priceNoticeCsv(notices) {
  const clean = normalizePriceNoticeList(notices);
  const lines = ['Notice,Package,Old price (Rs.),New price (Rs.),Effective date,Reason,Status'];
  for (const item of clean) {
    lines.push([
      item.id, item.packageLabel || item.packageKey,
      (item.oldCents / 100).toFixed(2), (item.newCents / 100).toFixed(2),
      item.effectiveDate, item.reason, item.status,
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function priceNoticeFilename(date = '') {
  const stamp = validNoticeDate(date) ? date : 'undated';
  return `price-change-notices-${stamp}.csv`;
}

// Send log: one entry per send, so a draft can be re-sent and every
// send stays visible. Recording a send never alters the notice, a
// price, a bill, or a customer record.
export function normalizePriceNoticeSend(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const noticeId = cleanText(input.noticeId ?? input.id);
  if (!noticeId) return null;
  const date = validNoticeDate(input.date ?? input.sentDate);
  if (!date) return null;
  const channel = PRICE_NOTICE_CHANNELS.includes(input.channel) ? input.channel : null;
  if (!channel) return null;
  return { noticeId, date, channel, sentBy: cleanText(input.sentBy ?? input.by) };
}

export function normalizePriceNoticeSendList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const send = normalizePriceNoticeSend(item);
    if (send) out.push(send);
  }
  out.sort((a, b) => (a.date.localeCompare(b.date) || a.noticeId.localeCompare(b.noticeId)));
  return out;
}

export function logPriceNoticeSent(list, entry) {
  const clean = normalizePriceNoticeSendList(list);
  const next = normalizePriceNoticeSend(entry);
  if (!next) return clean;
  return normalizePriceNoticeSendList([...clean, next]);
}

export function findPriceNoticeSends(list, noticeId) {
  return normalizePriceNoticeSendList(list).filter((item) => item.noticeId === cleanText(noticeId));
}
