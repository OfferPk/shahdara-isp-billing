/**
 * shop-performance-analytics.js — SISP-169: Shop Settlement Lag & Volume
 * Scorecard (دکان کارکردگی موازنہ).
 *
 * A read-only, side-by-side scorecard for the shop collectors: for one
 * selected month, each shop shows Monthly Collected PKR, its Share % of
 * all shop collections, Currently Unsettled PKR, the age of its Oldest
 * Unsettled receipt, and its Avg Settlement Lag Days.
 *
 * Shops are DERIVED, never hardcoded (the SISP-86/105/124 house rule):
 * the shop set is whatever SISP-1's resolver + summaries find in the
 * recorded data — payments carrying shop methods (resolveShopCollector)
 * plus shops named by settlement records. This module names no shop.
 *
 * Every figure reuses an existing derivation — no parallel shop math:
 * - Monthly Collected: collectShopPayments (shop-settlement.js), which
 *   already resolves the shop per payment and excludes voided receipts
 *   (SISP-34), summed over payments whose DATE falls in the month (the
 *   SISP-154 daily-matrix column discipline).
 * - Currently Unsettled: buildShopSummaries' `unsettled` figure, taken
 *   verbatim. It is an as-of-now figure (not month-end) and the UI
 *   labels it "currently", exactly as the spec does.
 * - Oldest Unsettled Days: the oldest pending receipt (remaining > 0)
 *   in collectShopPayments, aged in whole PKT calendar days to today —
 *   the same oldest-unsettled-receipt derivation SISP-124's aging
 *   alert reads from the same source rows.
 * - Avg Settlement Lag Days: settlement records carry REAL per-payment
 *   links — each record's `allocations[]` lists every covered payment
 *   with its payment `date` and covered amount, and the record's own
 *   `date` is the handover date. So lag is honestly per covered
 *   payment: handover date − payment date (whole days, clamped ≥ 0),
 *   averaged over the allocations of settlements COMPLETED in the
 *   selected month. A payment covered in parts by two handovers
 *   contributes one sample per allocation (each portion of cash waited
 *   its own lag). Settlements with no recorded allocations contribute
 *   no samples — the average is null ("—"), never fabricated.
 *
 * The scorecard is PURE: building or rendering it mutates nothing.
 * Imported only by owner-khata.js (an existing bundle entry), so the
 * dist budget stays at exactly 25 bundled files.
 */

import {
  collectShopPayments,
  buildShopSummaries,
  sanitizeShopSettlements,
  pakistanToday,
  formatShopPKR
} from './shop-settlement.js';
import { t } from './nav-language.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_MS = 86400000;

/** Whole calendar days from earlierDate to laterDate (YYYY-MM-DD), or null. */
function dayDiff(laterDate, earlierDate) {
  if (!DATE_RE.test(String(laterDate || '')) || !DATE_RE.test(String(earlierDate || ''))) return null;
  const a = Date.parse(`${laterDate}T00:00:00Z`);
  const b = Date.parse(`${earlierDate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / DAY_MS);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Pure: builds the scorecard rows for `month` (YYYY-MM; an invalid month
 * falls back to the reference month). `settlements` is the
 * sisp_shop_settlements_v1 array (sanitized here, so raw stored records
 * are safe to pass). `referenceDate` anchors "today" for the unsettled
 * age (PKT). Never mutates state or settlements.
 */
export function buildShopScorecard(state, settlements, month, referenceDate = new Date()) {
  const ref = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const today = pakistanToday(ref);
  const validMonth = MONTH_RE.test(String(month || '')) ? String(month) : today.slice(0, 7);
  const records = sanitizeShopSettlements(Array.isArray(settlements) ? settlements : []);

  // Currently-unsettled per shop — buildShopSummaries verbatim. Its shop
  // set (payments ∪ settlement records) is the scorecard's base set.
  const summaries = buildShopSummaries(state, records, ref);
  const unsettledByShop = new Map(summaries.map((s) => [s.shop, moneyValue(s.unsettled)]));

  const rows = new Map();
  const ensure = (shop) => {
    if (!rows.has(shop)) {
      rows.set(shop, {
        shop,
        collected: 0,
        sharePct: null,
        unsettled: unsettledByShop.get(shop) ?? 0,
        oldestUnsettledDate: null,
        oldestUnsettledDays: null,
        unsettledWarning: false,
        avgSettlementLagDays: null,
        settlementsInMonth: 0,
        lagSamples: 0
      });
    }
    return rows.get(shop);
  };
  for (const summary of summaries) ensure(summary.shop);

  // Monthly collected + oldest unsettled, from the one flattened
  // shop-payment enumeration (voided receipts already excluded there).
  for (const payment of collectShopPayments(state)) {
    const row = ensure(payment.shop);
    if (typeof payment.date === 'string' && payment.date.slice(0, 7) === validMonth) {
      row.collected += payment.amount;
    }
    if (payment.remaining > 0 && DATE_RE.test(String(payment.date || ''))) {
      if (!row.oldestUnsettledDate || payment.date < row.oldestUnsettledDate) {
        row.oldestUnsettledDate = payment.date;
      }
    }
  }

  // Settlement lag — real per-allocation links on the records completed
  // in the selected month (see the header for the exact definition).
  for (const record of records) {
    if (!record || typeof record.shop !== 'string' || !record.shop) continue;
    if (typeof record.date !== 'string' || record.date.slice(0, 7) !== validMonth) continue;
    if (!DATE_RE.test(record.date)) continue;
    const row = ensure(record.shop);
    row.settlementsInMonth += 1;
    let lagSum = row._lagSum || 0;
    let lagCount = row.lagSamples;
    for (const allocation of (Array.isArray(record.allocations) ? record.allocations : [])) {
      const lag = dayDiff(record.date, allocation && allocation.date);
      if (lag === null) continue;
      lagSum += Math.max(0, lag);
      lagCount += 1;
    }
    row._lagSum = lagSum;
    row.lagSamples = lagCount;
  }

  const shops = [...rows.values()];
  const totalCollected = shops.reduce((sum, row) => sum + row.collected, 0);
  for (const row of shops) {
    row.sharePct = totalCollected > 0 ? round1((row.collected / totalCollected) * 100) : null;
    if (row.oldestUnsettledDate) {
      const age = dayDiff(today, row.oldestUnsettledDate);
      row.oldestUnsettledDays = age === null ? null : Math.max(0, age);
    }
    // Spec threshold: strictly more than 7 days warns; exactly 7 does not.
    row.unsettledWarning = row.oldestUnsettledDays !== null && row.oldestUnsettledDays > 7;
    row.avgSettlementLagDays = row.lagSamples > 0 ? round1((row._lagSum || 0) / row.lagSamples) : null;
    delete row._lagSum;
  }
  shops.sort((a, b) => (b.collected - a.collected) || String(a.shop).localeCompare(String(b.shop)));

  return { month: validMonth, today, totalCollected, shops };
}

/**
 * Pure: renders the scorecard as an Owner Khata section (per-shop cards —
 * side by side on desktop, stacked on phone via components.css). Shop
 * names are recorded data and render verbatim; amounts use the shop
 * ledger's formatShopPKR ("PKR …", the same output as core formatPKR).
 */
export function renderShopScorecardHtml(scorecard, lang = null) {
  const title = escapeHtml(t('shopscore_title', lang));
  const shops = scorecard && Array.isArray(scorecard.shops) ? scorecard.shops : [];
  if (shops.length === 0) {
    return `<article class="owner-khata-section shop-scorecard-section"><h3>${title}</h3><p>${escapeHtml(t('shopscore_empty', lang))}</p></article>`;
  }
  const cards = shops.map((row) => {
    const daysText = (value) => (value === null || value === undefined
      ? '—'
      : escapeHtml(t('shopscore_days', lang, { count: value })));
    return `
      <article class="shop-scorecard-card${row.unsettledWarning ? ' shop-scorecard-card-warn' : ''}">
        <h4>${escapeHtml(row.shop)}</h4>
        <p><span>${escapeHtml(t('shopscore_collected', lang))}</span><strong>${escapeHtml(formatShopPKR(row.collected))}</strong></p>
        <p><span>${escapeHtml(t('shopscore_share', lang))}</span><strong>${row.sharePct === null || row.sharePct === undefined ? '—' : `${escapeHtml(String(row.sharePct))}%`}</strong></p>
        <p><span>${escapeHtml(t('shopscore_unsettled', lang))}</span><strong>${escapeHtml(formatShopPKR(row.unsettled))}</strong></p>
        <p><span>${escapeHtml(t('shopscore_oldest', lang))}</span><strong>${daysText(row.oldestUnsettledDays)}</strong></p>
        <p><span>${escapeHtml(t('shopscore_lag', lang))}</span><strong>${daysText(row.avgSettlementLagDays)}</strong></p>
        ${row.unsettledWarning ? `<p class="shop-scorecard-warn">⚠️ ${escapeHtml(t('shopscore_warn', lang))}</p>` : ''}
      </article>`;
  }).join('');
  return `<article class="owner-khata-section shop-scorecard-section"><h3>${title}</h3><div class="shop-scorecard-cards">${cards}</div><p class="shop-scorecard-note">${escapeHtml(t('shopscore_note', lang))}</p></article>`;
}
