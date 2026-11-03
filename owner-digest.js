// Plan 6 (Plan 1-100) — Owner daily and weekly collection digest.
//
// COMPOSITION ONLY. This module computes NOTHING new and changes no
// calculation, no record, and no metric. It assembles one short,
// read-only digest from figures the app already produces, so the owner
// sees today's / this week's picture without waiting for the monthly
// owner pack (Plan R):
//
//   - collections in the digest period (receipt-date cash, as the
//     Analytics cash-collection figures use it),
//   - total dues outstanding (the Analytics outstanding figure),
//   - Waada broken (customers with an outstanding balance whose
//     promise date has passed — the Waada-queue tier rule),
//   - suspense unclaimed (the suspense register's unclaimed items).
//
// The module is import-free by design (like day-target.js,
// route-sequencing.js and field-day-flow.js), so it can be used
// without pulling in the app graph. The caller supplies every figure
// together with the name of the screen it came from
// (`sourceScreen`); the digest carries each figure verbatim and
// labels it with that source, so every figure traces to its home
// screen on the same fixture. It never recounts payments, dues,
// promises, or suspense entries itself.
//
// Two consistency rules, stated plainly rather than hidden:
//   - When a Waada or suspense item list is supplied alongside a
//     stated total, the digest reports both the stated total and
//     the sum of the listed items, and `consistent` says whether
//     they agree. It never silently "fixes" a source that disagrees
//     with itself.
//   - When no item list is supplied, the stated figure stands alone
//     and `consistent` is true (there is nothing to check against).
//
// The digest is READ-ONLY: buildOwnerDigest is a pure function of
// its input. It writes nothing, stores nothing, and mutates no
// input. Printable / exportable forms are digestHtml (a section the
// caller can print) and digestCsv (headline figures plus item rows).

export const DIGEST_PERIODS = Object.freeze({
  DAILY: 'daily',
  WEEKLY: 'weekly',
});

export const DIGEST_PERIOD_LABELS = Object.freeze({
  daily: 'Daily digest',
  weekly: 'Weekly digest',
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function count(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function str(value) {
  return value == null ? '' : String(value);
}

function escapeHtml(value) {
  return str(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAmount(value) {
  return `Rs. ${num(value).toLocaleString('en-US')}`;
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isValidDigestDate(value) {
  if (!DATE_RE.test(str(value))) return false;
  const [y, m, d] = str(value).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtcDate(value) {
  const [y, m, d] = str(value).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(value, delta) {
  const date = toUtcDate(value);
  date.setUTCDate(date.getUTCDate() + delta);
  return fromUtcDate(date);
}

/** The one-day range for a daily digest: the date itself. */
export function dailyDigestRange(dateStr) {
  if (!isValidDigestDate(dateStr)) return { valid: false, startDate: '', endDate: '' };
  return { valid: true, startDate: str(dateStr), endDate: str(dateStr) };
}

/**
 * The Monday-to-Sunday week containing `dateStr` (UTC calendar days,
 * matching the app's date-string convention). Returns { valid: false }
 * for an invalid date.
 */
export function weeklyDigestRange(dateStr) {
  if (!isValidDigestDate(dateStr)) return { valid: false, startDate: '', endDate: '' };
  const day = toUtcDate(dateStr).getUTCDay(); // 0 = Sunday
  const backToMonday = (day + 6) % 7;
  const startDate = shiftDays(dateStr, -backToMonday);
  return { valid: true, startDate, endDate: shiftDays(startDate, 6) };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({ ...(item ?? {}) }));
}

function itemsTotal(items) {
  return items.reduce((sum, item) => sum + num(item?.amount), 0);
}

function normalizeSection(section, defaults) {
  const s = section && typeof section === 'object' ? section : {};
  return { ...defaults, ...s };
}

/**
 * Pure: builds one digest from caller-supplied source figures.
 *
 * Input shape:
 *   {
 *     period: 'daily' | 'weekly',
 *     startDate, endDate,               // YYYY-MM-DD, one date range
 *     collections: { amount, count, sourceScreen },
 *     dues: { amount, customerCount, sourceScreen },
 *     waadaBroken: { count, amount, items, sourceScreen },
 *     suspenseUnclaimed: { count, amount, items, sourceScreen },
 *   }
 *
 * An invalid period, an invalid date, or a start after the end yields
 * { valid: false } (same convention as the owner pack). A daily
 * digest whose range spans more than one day is likewise invalid:
 * a daily digest covers one day, never a week smuggled in as a day.
 */
export function buildOwnerDigest(input = {}) {
  const period = str(input.period);
  const startDate = str(input.startDate);
  const endDate = str(input.endDate);
  const invalid = {
    valid: false, period, periodLabel: DIGEST_PERIOD_LABELS[period] ?? '',
    startDate, endDate, dateRangeLabel: '',
    collections: null, dues: null, waadaBroken: null, suspenseUnclaimed: null,
    sources: [], summary: '',
  };
  if (period !== DIGEST_PERIODS.DAILY && period !== DIGEST_PERIODS.WEEKLY) return invalid;
  if (!isValidDigestDate(startDate) || !isValidDigestDate(endDate)) return invalid;
  if (startDate > endDate) return invalid;
  if (period === DIGEST_PERIODS.DAILY && startDate !== endDate) return invalid;

  const collectionsIn = normalizeSection(input.collections, {});
  const duesIn = normalizeSection(input.dues, {});
  const waadaIn = normalizeSection(input.waadaBroken, {});
  const suspenseIn = normalizeSection(input.suspenseUnclaimed, {});

  const waadaItems = normalizeItems(waadaIn.items);
  const suspenseItems = normalizeItems(suspenseIn.items);
  const waadaItemsTotal = itemsTotal(waadaItems);
  const suspenseItemsTotal = itemsTotal(suspenseItems);

  const collections = {
    amount: num(collectionsIn.amount),
    count: count(collectionsIn.count),
    sourceScreen: str(collectionsIn.sourceScreen) || 'Analytics',
  };
  const dues = {
    amount: num(duesIn.amount),
    customerCount: count(duesIn.customerCount),
    sourceScreen: str(duesIn.sourceScreen) || 'Analytics',
  };
  const waadaBroken = {
    count: count(waadaIn.count),
    amount: num(waadaIn.amount),
    items: waadaItems,
    itemsTotal: waadaItemsTotal,
    // No list supplied means nothing to check against; a list that
    // disagrees is reported, never corrected.
    consistent: waadaItems.length === 0 || waadaItemsTotal === num(waadaIn.amount),
    sourceScreen: str(waadaIn.sourceScreen) || 'Waada queue',
  };
  const suspenseUnclaimed = {
    count: count(suspenseIn.count),
    amount: num(suspenseIn.amount),
    items: suspenseItems,
    itemsTotal: suspenseItemsTotal,
    consistent: suspenseItems.length === 0 || suspenseItemsTotal === num(suspenseIn.amount),
    sourceScreen: str(suspenseIn.sourceScreen) || 'Suspense register',
  };

  const sources = [...new Set([
    collections.sourceScreen, dues.sourceScreen,
    waadaBroken.sourceScreen, suspenseUnclaimed.sourceScreen,
  ].filter(Boolean))];

  const digest = {
    valid: true,
    period,
    periodLabel: DIGEST_PERIOD_LABELS[period],
    startDate,
    endDate,
    dateRangeLabel: startDate === endDate ? startDate : `${startDate} to ${endDate}`,
    collections,
    dues,
    waadaBroken,
    suspenseUnclaimed,
    sources,
    summary: '',
  };
  digest.summary = digestSummary(digest);
  return digest;
}

/** One-line plain-text summary of a valid digest ('' when invalid). */
export function digestSummary(digest) {
  if (!digest || !digest.valid) return '';
  return `${digest.periodLabel} ${digest.dateRangeLabel}: collected ${formatAmount(digest.collections.amount)} (${digest.collections.count} payments) · dues ${formatAmount(digest.dues.amount)} · Waada broken ${digest.waadaBroken.count} · suspense unclaimed ${formatAmount(digest.suspenseUnclaimed.amount)} (${digest.suspenseUnclaimed.count} items).`;
}

/** File name for a digest export, e.g. owner-digest-daily-2026-11-03.csv. */
export function digestFilename(digest) {
  if (!digest || !digest.valid) return 'owner-digest.csv';
  return `owner-digest-${digest.period}-${digest.startDate}.csv`;
}

const MAX_HTML_ITEMS = 10;

function itemRowsHtml(items, detailKey, detailLabel) {
  if (items.length === 0) return '<p><span>No items listed.</span></p>';
  const shown = items.slice(0, MAX_HTML_ITEMS);
  const rows = shown.map((item) => `<p><span>${escapeHtml(str(item.customerName ?? item.suspenseId ?? '—'))}${item[detailKey] != null ? ` · ${escapeHtml(detailLabel)} ${escapeHtml(str(item[detailKey]))}` : ''}</span><strong>${escapeHtml(formatAmount(item.amount))}</strong></p>`).join('');
  const more = items.length > shown.length
    ? `<p class="owner-digest-footnote">Plus ${items.length - shown.length} more item(s) — see the CSV export for the full list.</p>`
    : '';
  return rows + more;
}

/**
 * Printable HTML section for a valid digest ('' when invalid).
 * Every figure carries its source screen label, so the printed page
 * traces back to the same screens the figures came from. Item lists
 * are capped at 10 rows in print; the CSV export carries the full list.
 */
export function digestHtml(digest) {
  if (!digest || !digest.valid) return '';
  const { collections, dues, waadaBroken, suspenseUnclaimed } = digest;
  return `<article class="owner-digest" role="region" aria-label="${escapeHtml(digest.periodLabel)}">
  <h3>${escapeHtml(digest.periodLabel)} · ${escapeHtml(digest.dateRangeLabel)}</h3>
  <p><span>Collected in period</span><strong>${escapeHtml(formatAmount(collections.amount))}</strong><small> · ${collections.count} payments · Source: ${escapeHtml(collections.sourceScreen)}</small></p>
  <p><span>Total dues outstanding</span><strong>${escapeHtml(formatAmount(dues.amount))}</strong><small> · ${dues.customerCount} customers with dues · Source: ${escapeHtml(dues.sourceScreen)}</small></p>
  <p><span>Waada broken</span><strong>${waadaBroken.count}</strong><small> · ${escapeHtml(formatAmount(waadaBroken.amount))} promised · Source: ${escapeHtml(waadaBroken.sourceScreen)}${waadaBroken.consistent ? '' : ' · Note: listed items do not sum to the stated total.'}</small></p>
  ${itemRowsHtml(waadaBroken.items, 'promiseDate', 'promised')}
  <p><span>Suspense unclaimed</span><strong>${escapeHtml(formatAmount(suspenseUnclaimed.amount))}</strong><small> · ${suspenseUnclaimed.count} items · Source: ${escapeHtml(suspenseUnclaimed.sourceScreen)}${suspenseUnclaimed.consistent ? '' : ' · Note: listed items do not sum to the stated total.'}</small></p>
  ${itemRowsHtml(suspenseUnclaimed.items, 'ageDays', 'age')}
  <p class="owner-digest-footnote">Read-only digest: it assembles existing figures and changes no record. Sources: ${escapeHtml(digest.sources.join(', '))}.</p>
</article>`;
}

function csvCell(value) {
  const text = str(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(...cells) {
  return cells.map(csvCell).join(',');
}

/**
 * CSV export for a valid digest ('' when invalid): headline figures
 * first, then one row per Waada-broken and suspense item, so the
 * export traces every figure to its source screen and every listed
 * item to its amount.
 */
export function digestCsv(digest) {
  if (!digest || !digest.valid) return '';
  const lines = [
    csvRow('Owner digest', digest.periodLabel, digest.dateRangeLabel),
    csvRow('Section', 'Figure', 'Value', 'Source'),
    csvRow('Collections', 'Amount', digest.collections.amount, digest.collections.sourceScreen),
    csvRow('Collections', 'Payment count', digest.collections.count, digest.collections.sourceScreen),
    csvRow('Dues', 'Outstanding amount', digest.dues.amount, digest.dues.sourceScreen),
    csvRow('Dues', 'Customers with dues', digest.dues.customerCount, digest.dues.sourceScreen),
    csvRow('Waada broken', 'Count', digest.waadaBroken.count, digest.waadaBroken.sourceScreen),
    csvRow('Waada broken', 'Promised amount', digest.waadaBroken.amount, digest.waadaBroken.sourceScreen),
    ...digest.waadaBroken.items.map((item) => csvRow('Waada broken item', item.customerName ?? '', item.amount, waadaItemDetail(item))),
    csvRow('Suspense unclaimed', 'Count', digest.suspenseUnclaimed.count, digest.suspenseUnclaimed.sourceScreen),
    csvRow('Suspense unclaimed', 'Amount', digest.suspenseUnclaimed.amount, digest.suspenseUnclaimed.sourceScreen),
    ...digest.suspenseUnclaimed.items.map((item) => csvRow('Suspense unclaimed item', item.suspenseId ?? '', item.amount, suspenseItemDetail(item))),
  ];
  return `${lines.join('\n')}\n`;
}

function waadaItemDetail(item) {
  return item?.promiseDate != null ? `promised ${item.promiseDate}` : '';
}

function suspenseItemDetail(item) {
  return item?.ageDays != null ? `age ${item.ageDays} days` : '';
}
