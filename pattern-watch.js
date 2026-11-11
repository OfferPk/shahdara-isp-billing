// Plan 89 (Plan 1-100) — Void and correction pattern watch (review list, not a block).
//
// Individual voids and corrections are audited (Plan K, Plan 31), but a
// pattern — many voids in one day, many corrections by one operator,
// repeated voids for the same customer — is invisible when each event
// is viewed alone. This module is a read-only pattern view over
// caller-supplied events: it groups them by day, by operator, and by
// customer, and surfaces a concentration above an operator-set
// threshold as a review item.
//
// Scope fence, stated plainly:
//   - This is a view only. It never blocks, accuses, or changes any
//     void, correction, or payment record, and it never reads or
//     writes the audit log or any payment record itself: the caller
//     supplies every event, and the module only validates, groups,
//     and filters them.
//   - It is import-free: it never reads storage, the clock, or the
//     network, and never mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). An event with an unknown kind, a
//     missing customer, or an invalid date is dropped, never
//     counted on a guessed figure.
//   - A concentration appears only when its count is strictly above
//     the operator-set threshold, so normal single voids and
//     corrections never appear as patterns. A threshold that is
//     unset, zero, negative, or non-numeric falls back to the
//     default, never to zero (zero would flag every single event).
//   - Reviewing an item records who reviewed it and the outcome in
//     this plan's own review log; the underlying records are never
//     touched, and a reviewed item can be restored to the open list.

export const PATTERN_DIMENSIONS = Object.freeze([
  { value: 'day', label: 'One day' },
  { value: 'operator', label: 'One operator' },
  { value: 'customer', label: 'One customer' },
]);

export const PATTERN_KINDS = Object.freeze([
  { value: 'void', label: 'Void' },
  { value: 'correction', label: 'Correction' },
]);

export const PATTERN_DEFAULTS = Object.freeze({
  dayThreshold: 2,
  operatorThreshold: 2,
  customerThreshold: 2,
});

const DIMENSION_LABELS = new Map(PATTERN_DIMENSIONS.map((d) => [d.value, d.label]));
const KIND_LABELS = new Map(PATTERN_KINDS.map((k) => [k.value, k.label]));

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validPatternDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= days;
}

// Plan T canonical mohalla key: lowercased, leading "Mohalla "/"Area "
// prefix stripped, so "Mohalla Bani" and "bani" group together. The
// blank key is the unassigned group and is never dropped.
// Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
// JABBIYAA, so it folds to the same key. Charyaa is its own mohalla
// and never folds to Chamyaa.
export function patternMohallaKey(value) {
  const text = cleanText(value).replace(/^(?:mohalla|area)\s+/i, '').trim().toLowerCase();
  if (text === '') return '__unassigned__';
  return text === 'jabbiyaaa' ? 'jabbiyaa' : text;
}

export function normalizePatternEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = cleanText(raw.kind).toLowerCase();
  if (!KIND_LABELS.has(kind)) return null;
  const date = cleanText(raw.date);
  if (!validPatternDate(date)) return null;
  const customerId = cleanText(raw.customerId);
  if (!customerId) return null;
  return {
    date,
    kind,
    customerId,
    customerName: cleanText(raw.customerName) || customerId,
    mohalla: cleanText(raw.mohalla),
    by: cleanText(raw.by),
  };
}

export function normalizePatternEvents(list) {
  if (!Array.isArray(list)) return [];
  return list.map((row) => normalizePatternEvent(row)).filter(Boolean);
}

function groupKey(dimension, event) {
  if (dimension === 'day') return event.date;
  if (dimension === 'operator') return event.by === '' ? 'Not recorded' : event.by;
  return event.customerId;
}

function groupLabel(dimension, event, key) {
  if (dimension === 'day') return key;
  if (dimension === 'operator') return key;
  return event.customerName || key;
}

// Counts grouped by day, by operator, and by customer. Day groups sort
// by date ascending; operator and customer groups sort by total
// descending, then key ascending, so the heaviest concentration is
// first. Every group carries its void/correction split, so the totals
// can be checked against the source events on the same fixture.
export function groupPatternCounts(events) {
  const rows = normalizePatternEvents(events);
  const out = {};
  for (const dimension of ['day', 'operator', 'customer']) {
    const groups = new Map();
    for (const event of rows) {
      const key = groupKey(dimension, event);
      let group = groups.get(key);
      if (!group) {
        group = {
          dimension,
          key,
          label: groupLabel(dimension, event, key),
          customerId: dimension === 'customer' ? event.customerId : '',
          customerName: dimension === 'customer' ? event.customerName : '',
          mohalla: dimension === 'customer' ? event.mohalla : '',
          voids: 0,
          corrections: 0,
          total: 0,
        };
        groups.set(key, group);
      }
      if (event.kind === 'void') group.voids += 1;
      else group.corrections += 1;
      group.total += 1;
    }
    const list = [...groups.values()];
    if (dimension === 'day') list.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    else list.sort((a, b) => b.total - a.total || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    out[`by${dimension[0].toUpperCase()}${dimension.slice(1)}`] = list;
  }
  return out;
}

export function normalizePatternSettings(raw) {
  const settings = { ...PATTERN_DEFAULTS };
  if (raw && typeof raw === 'object') {
    for (const key of ['dayThreshold', 'operatorThreshold', 'customerThreshold']) {
      const value = Number(raw[key]);
      if (Number.isFinite(value) && Number.isInteger(value) && value > 0) settings[key] = value;
    }
  }
  return settings;
}

function thresholdFor(dimension, settings) {
  if (dimension === 'day') return settings.dayThreshold;
  if (dimension === 'operator') return settings.operatorThreshold;
  return settings.customerThreshold;
}

// Review items: one per group whose total is strictly above its
// threshold. Reviewed items (by key) are excluded from the open list;
// they live in the review log instead. A group at exactly the
// threshold is not a pattern and never appears.
export function buildReviewItems({ events, settings, reviewedKeys = [] } = {}) {
  const cleanSettings = normalizePatternSettings(settings);
  const reviewed = new Set(Array.isArray(reviewedKeys) ? reviewedKeys.map((k) => cleanText(k)).filter(Boolean) : []);
  const groups = groupPatternCounts(events);
  const items = [];
  for (const dimension of ['day', 'operator', 'customer']) {
    const list = groups[`by${dimension[0].toUpperCase()}${dimension.slice(1)}`];
    const threshold = thresholdFor(dimension, cleanSettings);
    for (const group of list) {
      if (group.total <= threshold) continue;
      const key = `${dimension}:${group.key}`;
      if (reviewed.has(key)) continue;
      items.push({
        key,
        dimension,
        dimensionLabel: DIMENSION_LABELS.get(dimension),
        label: group.label,
        customerId: group.customerId,
        customerName: group.customerName,
        mohalla: group.mohalla,
        voids: group.voids,
        corrections: group.corrections,
        total: group.total,
        threshold,
      });
    }
  }
  items.sort((a, b) => b.total - a.total || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return items;
}

export function filterReviewItems(items, { dimension = '', mohalla = '' } = {}) {
  const list = Array.isArray(items) ? items : [];
  const wantedDimension = cleanText(dimension);
  const wantedMohalla = patternMohallaKey(mohalla);
  const filterMohalla = cleanText(mohalla) !== '';
  return list.filter((item) => {
    if (wantedDimension && item.dimension !== wantedDimension) return false;
    if (filterMohalla && patternMohallaKey(item.mohalla) !== wantedMohalla) return false;
    return true;
  });
}

export function buildPatternSummary(events) {
  const rows = normalizePatternEvents(events);
  const groups = groupPatternCounts(rows);
  return {
    events: rows.length,
    voids: rows.filter((e) => e.kind === 'void').length,
    corrections: rows.filter((e) => e.kind === 'correction').length,
    dayGroups: groups.byDay.length,
    operatorGroups: groups.byOperator.length,
    customerGroups: groups.byCustomer.length,
  };
}

export function patternSummaryText(summary) {
  if (!summary) return 'No void or correction events recorded.';
  return `${summary.events} event${summary.events === 1 ? '' : 's'} (${summary.voids} void${summary.voids === 1 ? '' : 's'}, ${summary.corrections} correction${summary.corrections === 1 ? '' : 's'}) across ${summary.dayGroups} day${summary.dayGroups === 1 ? '' : 's'}, ${summary.operatorGroups} operator${summary.operatorGroups === 1 ? '' : 's'}, ${summary.customerGroups} customer${summary.customerGroups === 1 ? '' : 's'}.`;
}

export function normalizeReviewList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const key = cleanText(raw.key);
    const reviewedBy = cleanText(raw.reviewedBy);
    const outcome = cleanText(raw.outcome);
    if (!key || !outcome) continue;
    out.push({
      key,
      dimension: cleanText(raw.dimension),
      label: cleanText(raw.label),
      customerId: cleanText(raw.customerId),
      customerName: cleanText(raw.customerName),
      mohalla: cleanText(raw.mohalla),
      voids: Number.isFinite(Number(raw.voids)) ? Number(raw.voids) : 0,
      corrections: Number.isFinite(Number(raw.corrections)) ? Number(raw.corrections) : 0,
      total: Number.isFinite(Number(raw.total)) ? Number(raw.total) : 0,
      threshold: Number.isFinite(Number(raw.threshold)) ? Number(raw.threshold) : 0,
      reviewedBy: reviewedBy === '' ? 'Owner' : reviewedBy,
      outcome,
      reviewedAt: cleanText(raw.reviewedAt),
    });
  }
  return out;
}

// Reviewing records the outcome only; the underlying void, correction,
// and payment records are never touched. A review without an outcome
// is refused (the list comes back unchanged).
export function markReviewed(list, item, { reviewedBy = '', outcome = '', reviewedAt = '' } = {}) {
  const base = normalizeReviewList(list);
  if (!item || typeof item !== 'object') return base;
  const key = cleanText(item.key);
  const cleanOutcome = cleanText(outcome);
  if (!key || !cleanOutcome) return base;
  const entry = {
    key,
    dimension: cleanText(item.dimension),
    label: cleanText(item.label),
    customerId: cleanText(item.customerId),
    customerName: cleanText(item.customerName),
    mohalla: cleanText(item.mohalla),
    voids: Number.isFinite(Number(item.voids)) ? Number(item.voids) : 0,
    corrections: Number.isFinite(Number(item.corrections)) ? Number(item.corrections) : 0,
    total: Number.isFinite(Number(item.total)) ? Number(item.total) : 0,
    threshold: Number.isFinite(Number(item.threshold)) ? Number(item.threshold) : 0,
    reviewedBy: cleanText(reviewedBy) === '' ? 'Owner' : cleanText(reviewedBy),
    outcome: cleanOutcome,
    reviewedAt: cleanText(reviewedAt),
  };
  return [...base.filter((e) => e.key !== key), entry];
}

export function removeReviewed(list, key) {
  const base = normalizeReviewList(list);
  const wanted = cleanText(key);
  if (!wanted) return base;
  return base.filter((e) => e.key !== wanted);
}

function escapeHtmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function reviewHtml(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return '<p class="empty-state">No unusual concentration found — single voids and corrections never appear here.</p>';
  return `<ul>${list.map((item) => `<li class="pattern-item"><span><strong>${escapeHtmlText(item.dimensionLabel)}: ${escapeHtmlText(item.label)}</strong> — ${escapeHtmlText(item.total)} events (${escapeHtmlText(item.voids)} voids, ${escapeHtmlText(item.corrections)} corrections), threshold ${escapeHtmlText(item.threshold)}${item.mohalla ? ` · ${escapeHtmlText(item.mohalla)}` : ''}</span> <button type="button" class="secondary-button btn-sm pattern-review-btn" data-pattern-key="${escapeHtmlText(item.key)}">Mark reviewed</button></li>`).join('')}</ul>`;
}

export function reviewedHtml(list) {
  const rows = normalizeReviewList(list);
  if (rows.length === 0) return '';
  return `<p class="chart-caption">Reviewed patterns (the underlying records were not changed):</p><ul>${rows.map((e) => `<li class="pattern-reviewed"><span><strong>${escapeHtmlText(e.label)}</strong> — ${escapeHtmlText(e.total)} events, reviewed by ${escapeHtmlText(e.reviewedBy)}: ${escapeHtmlText(e.outcome)}${e.reviewedAt ? ` (${escapeHtmlText(e.reviewedAt)})` : ''}</span> <button type="button" class="secondary-button btn-sm pattern-unreview-btn" data-pattern-key="${escapeHtmlText(e.key)}">Restore</button></li>`).join('')}</ul>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function patternCsv(items) {
  const list = Array.isArray(items) ? items : [];
  const lines = ['dimension,label,total,voids,corrections,threshold,mohalla'];
  for (const item of list) {
    lines.push([item.dimension, item.label, item.total, item.voids, item.corrections, item.threshold, item.mohalla].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function patternFilename() {
  return 'pattern-watch.csv';
}
