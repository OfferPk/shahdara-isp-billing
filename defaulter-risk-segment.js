/**
 * defaulter-risk-segment.js — SISP-159: First-Time Late vs. Chronic
 * Defaulter Risk Segmentation (ڈیفالٹر درجہ بندی).
 *
 * Classifies subscribers who owe money into three outreach segments so the
 * owner talks to each defaulter in the right tone:
 *
 *   🟢 'polite'   — Polite Reminder: first-time late AND a reliable waada
 *                   history (reliability >= 80).
 *   🟡 'standard' — Standard Follow-Up: owes money, but neither chronic
 *                   nor a clean first-timer.
 *   🔴 'chronic'  — High-Risk / Chronic: 2+ months of arrears OR at least
 *                   one broken waada. Chronic wins over polite, always.
 *
 * Everything here is a PURE DERIVATION over recorded data — the module
 * never writes to the ledger, never stores a segment, and never sends
 * anything. Segments are recomputed from the same allocation-engine
 * per-month summaries the reminder queue (reminder-queue.js
 * getCustomerOutstandingDues) and the Top Defaulters list
 * (dashboard-top-defaulters.js) already read, so a segment can never
 * disagree with the dues figure shown next to it.
 *
 * POPULATION: active (non-archived), non-FREE customers whose total
 * engine-derived outstanding is > 0. FREE connections never owe anything
 * (owner rule) and archived records are history, not outreach targets.
 *
 * WAADA OUTCOMES + RELIABILITY: the kept/broken counting comes from
 * SISP-98's canonical computeWaadaScore(customer, outstanding, todayStr)
 * in waada-queue.js. This phase was originally built with a deliberate
 * local mirror, `deriveWaadaOutcomes`, implementing SISP-98's derivation
 * EXACTLY as specified there:
 *   kept   — a non-voided payment carrying a SISP-34 `clearedWaada` stamp
 *            whose payment date is on/before the stamped promise date.
 *   broken — a stamped payment dated AFTER the stamped promise date,
 *            PLUS 1 when the customer's live promise tier
 *            (getWaadaTier) is 'broken' right now.
 *   total  — kept + broken.
 * At the SISP-159 merge (SISP-98 already on main) the mirror was deleted
 * and replaced by the canonical call, exactly as planned — the two were
 * verified behaviour-identical ({ kept, broken, total }) on the phase's
 * own fixtures before the swap, so nothing else here changed.
 *
 * RELIABILITY CONVERSION (this phase's own definition, stated openly):
 * SISP-98 returns counts only, so the percentage the segmentation rule
 * needs is defined here as
 *   reliability = total === 0 ? 100 : Math.round((kept / total) * 100)
 * A customer with no recorded waada resolution has no evidence of
 * unreliability, hence 100. Note the interplay with precedence: any
 * broken waada (broken >= 1) already forces 🔴 chronic, so in live data
 * the >= 80 test only ever decides between 🟢 and 🟡 for customers whose
 * record is all-kept resolutions (reliability 100) — the 79/80 boundary
 * is still pinned on the pure classifier, whose inputs are explicit.
 *
 * TEMPLATE AUTO-SELECTION: each segment maps to tones that already ship.
 * - Reminder-queue flow (form-validation.js template types):
 *     polite → 'due', standard → 'overdue', chronic → 'disconnection'.
 * - WhatsApp Template Studio (whatsapp-templates.js ids; the picker
 *   pre-selects by ID, so owner customizations saved in the studio ride
 *   along untouched):
 *     polite → 'politeReminder', standard → 'billGenerated',
 *     chronic → 'brokenWaada' when a broken waada exists, else
 *     'billGenerated' (the studio ships no generic firm/disconnection
 *     template — stated honestly rather than faked).
 * Selection only PRE-SELECTS in the existing pickers; the owner can
 * override, and sending stays the owner's wa.me tap, as always.
 */

import { calculatePaymentAllocations } from './core.js';
import {
  computeWaadaScore,
  getWaadaTodayString
} from './waada-queue.js';
import { t } from './nav-language.js';

export const DEFAULTER_SEGMENTS = Object.freeze({
  POLITE: 'polite',
  STANDARD: 'standard',
  CHRONIC: 'chronic'
});

const SEGMENT_EMOJI = Object.freeze({
  polite: '🟢',
  standard: '🟡',
  chronic: '🔴'
});

const SEGMENT_BADGE_CLASS = Object.freeze({
  polite: 'badge-healthy',
  standard: 'badge-warning',
  chronic: 'badge-danger'
});

/**
 * Reliability percentage for the segmentation rule (see header):
 * no recorded resolutions → 100 (no evidence of unreliability).
 */
export function waadaReliabilityScore(outcomes) {
  const kept = Number(outcomes?.kept ?? 0);
  const total = Number(outcomes?.total ?? 0);
  if (!(total > 0)) return 100;
  return Math.round((kept / total) * 100);
}

/**
 * First-time-late test: at least one unpaid month, NO unpaid month before
 * the current cycle month, and no broken waada ever. Pure.
 */
export function computeFirstLate(unpaidMonths, currentMonth, brokenWaada) {
  if (Number(brokenWaada ?? 0) > 0) return false;
  const months = Array.isArray(unpaidMonths) ? unpaidMonths : [];
  if (months.length === 0 || typeof currentMonth !== 'string') return false;
  return months.every(month => typeof month === 'string' && month >= currentMonth);
}

/**
 * Derives every classifier input for one customer from real records.
 * monthsWithArrears / outstanding come from the allocation engine's
 * per-month summaries (allocations.forMonth), the identical source the
 * reminder queue and Top Defaulters read; when a month has no summary
 * (unpriced bill) the recorded dueAmount is used, mirroring
 * calculateTopDefaulters so the two surfaces always agree.
 * `allocations` may be supplied by callers that already computed it.
 */
export function deriveDefaulterInputs(customer, state, todayStr = getWaadaTodayString(), allocations = null) {
  const empty = {
    outstanding: 0,
    monthsWithArrears: 0,
    unpaidMonths: [],
    keptWaada: 0,
    brokenWaada: 0,
    waadaTotal: 0,
    reliability: 100,
    firstLate: false
  };
  if (!customer || typeof customer !== 'object') return empty;
  const allocs = allocations || calculatePaymentAllocations(state || { customers: [] });
  let duesCents = 0;
  const unpaidMonths = [];
  for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
    if (!bill || typeof bill.month !== 'string') continue;
    const summary = allocs && typeof allocs.forMonth === 'function'
      ? allocs.forMonth(customer.id, bill.month)
      : null;
    const balanceDueCents = summary?.balanceDueCents !== null && summary?.balanceDueCents !== undefined
      ? summary.balanceDueCents
      : Math.round(Number(bill.dueAmount || bill.amount || 0) * 100);
    if (balanceDueCents > 0) {
      duesCents += balanceDueCents;
      unpaidMonths.push(bill.month);
    }
  }
  unpaidMonths.sort();
  const outstanding = Math.round(duesCents / 100);
  const outcomes = computeWaadaScore(customer, outstanding, todayStr);
  const currentMonth = typeof todayStr === 'string' ? todayStr.slice(0, 7) : '';
  return {
    outstanding,
    monthsWithArrears: unpaidMonths.length,
    unpaidMonths,
    keptWaada: outcomes.kept,
    brokenWaada: outcomes.broken,
    waadaTotal: outcomes.total,
    reliability: waadaReliabilityScore(outcomes),
    firstLate: computeFirstLate(unpaidMonths, currentMonth, outcomes.broken)
  };
}

/**
 * Pure classifier — the segmentation contract. `derived` carries
 * { monthsWithArrears, brokenWaada, reliability, firstLate }.
 * Precedence: 🔴 chronic (2+ months arrears OR any broken waada) beats
 * 🟢 polite (first-time late AND reliability >= 80, exactly 80 qualifies);
 * everything else is 🟡 standard. Reasons are stable machine keys the UI
 * maps to i18n labels.
 */
export function classifyDefaulter(customer, derived) {
  const monthsWithArrears = Number(derived?.monthsWithArrears ?? 0);
  const brokenWaada = Number(derived?.brokenWaada ?? 0);
  const reliability = Number(derived?.reliability ?? 100);
  const firstLate = derived?.firstLate === true;
  const reasons = [];
  if (monthsWithArrears >= 2) reasons.push('two_plus_months_arrears');
  if (brokenWaada >= 1) reasons.push('broken_waada');
  if (reasons.length > 0) {
    return { segment: DEFAULTER_SEGMENTS.CHRONIC, reasons };
  }
  if (firstLate && reliability >= 80) {
    return {
      segment: DEFAULTER_SEGMENTS.POLITE,
      reasons: ['first_time_late', 'reliable_history']
    };
  }
  if (firstLate) reasons.push('first_time_late');
  if (reliability < 80) reasons.push('low_reliability');
  reasons.push('standard_follow_up');
  return { segment: DEFAULTER_SEGMENTS.STANDARD, reasons };
}

/**
 * Population gate + classification in one call. Returns null when the
 * customer is outside the segmentation population (archived, FREE, or no
 * engine-derived dues); otherwise { segment, reasons, derived }.
 */
export function classifyCustomerDefaulter(customer, state, todayStr = getWaadaTodayString(), allocations = null) {
  if (!customer || typeof customer !== 'object') return null;
  if (customer.archived) return null;
  if (customer.isFreeConnection === true) return null;
  const derived = deriveDefaulterInputs(customer, state, todayStr, allocations);
  if (!(derived.outstanding > 0)) return null;
  const { segment, reasons } = classifyDefaulter(customer, derived);
  return { segment, reasons, derived };
}

/**
 * Classification for callers that already hold a customer's unpaid-month
 * list and total outstanding (the Top Defaulters row builder) — same
 * outcomes/first-late/classifier pipeline as classifyCustomerDefaulter,
 * without re-running the allocation engine.
 */
export function classifyDefaulterFromMonths(customer, { outstanding = 0, unpaidMonths = [], todayStr = getWaadaTodayString() } = {}) {
  const outcomes = computeWaadaScore(customer, outstanding, todayStr);
  const months = (Array.isArray(unpaidMonths) ? [...unpaidMonths] : []).sort();
  const derived = {
    outstanding,
    monthsWithArrears: months.length,
    unpaidMonths: months,
    keptWaada: outcomes.kept,
    brokenWaada: outcomes.broken,
    waadaTotal: outcomes.total,
    reliability: waadaReliabilityScore(outcomes),
    firstLate: computeFirstLate(months, typeof todayStr === 'string' ? todayStr.slice(0, 7) : '', outcomes.broken)
  };
  const { segment, reasons } = classifyDefaulter(customer, derived);
  return { segment, reasons, derived };
}

/** Reminder-queue template type (form-validation.js) per segment. */
export function segmentTemplateType(segment) {
  if (segment === DEFAULTER_SEGMENTS.POLITE) return 'due';
  if (segment === DEFAULTER_SEGMENTS.CHRONIC) return 'disconnection';
  return 'overdue';
}

/**
 * WhatsApp Template Studio template id (whatsapp-templates.js) per
 * segment. Chronic without a broken waada falls back to the neutral
 * 'bill_generated' — the studio ships no generic firm template (see
 * header). Selection is by ID, so owner-customized studio texts apply.
 */
export function segmentStudioTemplateId(segment, derived) {
  if (segment === DEFAULTER_SEGMENTS.POLITE) return 'politeReminder';
  if (segment === DEFAULTER_SEGMENTS.CHRONIC && Number(derived?.brokenWaada ?? 0) >= 1) {
    return 'brokenWaada';
  }
  return 'billGenerated';
}

/** i18n label key per segment (nav-language.js, prefix riskseg_). */
export function segmentLabelKey(segment) {
  if (segment === DEFAULTER_SEGMENTS.POLITE) return 'riskseg_polite';
  if (segment === DEFAULTER_SEGMENTS.CHRONIC) return 'riskseg_chronic';
  return 'riskseg_standard';
}

/**
 * Segment chip markup using the shared .safety-badge tones (theme-token
 * rgba pairs with dark-mode variants in styles.css) — no new colours, no
 * new CSS. `result` is a classifyCustomerDefaulter result.
 */
export function defaulterSegmentChipHtml(result, lang = null) {
  const segment = result?.segment;
  if (!segment || !SEGMENT_BADGE_CLASS[segment]) return '';
  const label = t(segmentLabelKey(segment), lang);
  return `<span class="safety-badge ${SEGMENT_BADGE_CLASS[segment]}">${SEGMENT_EMOJI[segment]} ${label}</span>`;
}

/** Plain-text segment label (emoji + i18n label), for text surfaces. */
export function defaulterSegmentLabel(result, lang = null) {
  const segment = result?.segment;
  if (!segment || !SEGMENT_BADGE_CLASS[segment]) return '';
  return `${SEGMENT_EMOJI[segment]} ${t(segmentLabelKey(segment), lang)}`;
}
