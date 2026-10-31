/**
 * loose-change-credit.js — SISP-116: "Khula Paisa / Loose Change"
 * Next-Month Advance Credit Chip.
 *
 * The street reality: a customer owes an odd amount (Rs 2,870) and hands
 * over round notes (Rs 3,000). The collector should not hunt for change —
 * one tap tenders the round amount and the Rs 130 difference stays with
 * the house as the customer's advance credit for next month.
 *
 * MONEY DESIGN (the critical rule): this module invents NO balance and
 * NO recorder. The chip only ever FILLS / TENDERS a round amount through
 * the EXISTING Quick Collect recorder (executeQuickCollection, SISP-33
 * FIFO and all). The allocation engine already derives the overpayment
 * as credit: the payment ledger's `unappliedCreditCents` — the same
 * figure advance-payment.js advanceBalanceCents() sums and Field Mode
 * shows as "advance credit waiting". The spec's "advanceCredit: 150" IS
 * that derived figure (Rs 150 = 15000 unapplied cents). Nothing is
 * stamped on the payment, so a manually typed overpayment behaves
 * byte-identically, the Khata Doctor (which mirrors the engine) agrees
 * by construction, and voiding the payment (SISP-34) removes the credit
 * exactly — a voided payment never reaches the engine, so no orphan
 * credit can survive.
 *
 * ROUND-UP RULE (stated): suggestions are the owed amount rounded UP to
 * the next multiple of Rs 100, Rs 500 and Rs 1,000 — the round-note
 * steps a customer actually tenders (all three are real PKR note
 * denominations, see PKR_DENOMINATIONS in pkr-notes.js). A step whose
 * multiple equals the amount owed is not a suggestion (no change), and
 * duplicates (e.g. owing 2,850: the 500 and 1,000 steps both land on
 * 3,000) collapse into one chip. Chips are ordered smallest tender
 * first. A suggestion only exists when 0 < change < tendered.
 *
 * Pure + DOM-free; the two DOM surfaces (Quick Collect modal, Field
 * Mode) own their own wiring and pass a translated label builder in.
 */

import { PKR_DENOMINATIONS } from './pkr-notes.js';

/** Round-up steps (PKR) offered by the chip — all real note values. */
export const LOOSE_CHANGE_STEPS = [100, 500, 1000];

function centsOf(amount) {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}

/**
 * Round-note tender suggestions for an amount owed (PKR).
 * Returns [{ tendered, change }] in PKR, smallest tender first; [] when
 * nothing is owed or the amount is already an exact multiple of every
 * step (no change would be kept).
 */
export function looseChangeSuggestions(owedAmount) {
  const owedCents = centsOf(owedAmount);
  if (!Number.isFinite(owedCents) || owedCents <= 0) return [];
  const byTendered = new Map();
  for (const step of LOOSE_CHANGE_STEPS) {
    const stepCents = step * 100;
    const tenderedCents = Math.ceil(owedCents / stepCents) * stepCents;
    if (tenderedCents <= owedCents) continue;
    const changeCents = tenderedCents - owedCents;
    if (changeCents <= 0 || changeCents >= tenderedCents) continue;
    if (!byTendered.has(tenderedCents)) {
      byTendered.set(tenderedCents, { tendered: tenderedCents / 100, change: changeCents / 100 });
    }
  }
  return [...byTendered.values()].sort((a, b) => a.tendered - b.tendered);
}

/** True when `tendered` is one of the chip's own suggestions for `owed`. */
export function isLooseChangeTender(owedAmount, tenderedAmount) {
  const tenderedCents = centsOf(tenderedAmount);
  if (!Number.isFinite(tenderedCents)) return false;
  return looseChangeSuggestions(owedAmount).some(s => Math.round(s.tendered * 100) === tenderedCents);
}

/**
 * The derived advance credit ONE payment generated, in cents, read from
 * its allocation-engine ledger row (byPaymentId). This is the figure
 * that "carries" the kept change — derived on every pass, never stored.
 * 0 when the ledger row is absent (e.g. a voided payment, which the
 * engine excludes) or the payment settled everything it generated.
 */
export function looseChangeCreditCents(ledger) {
  const value = Number(ledger?.unappliedCreditCents);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Chip-row markup for the Quick Collect modal. `labelFor(tendered,
 * change)` supplies the translated chip text (the caller owns i18n via
 * nav-language t()); amounts stay Latin digits per house rule. Returns
 * '' when there is nothing to suggest, so the row simply disappears.
 */
export function looseChangeChipsMarkup(owedAmount, labelFor) {
  const suggestions = looseChangeSuggestions(owedAmount);
  if (!suggestions.length || typeof labelFor !== 'function') return '';
  return suggestions.map(s => `<button type="button" class="loose-change-chip" data-loose-tender="${s.tendered}">🪙 ${escapeHtml(labelFor(s.tendered, s.change))}</button>`).join('');
}

// The round-up steps must stay real circulating note denominations —
// guarded here so a future pkr-notes edit cannot silently break the
// chip's promise that every suggestion is tenderable in actual notes.
for (const step of LOOSE_CHANGE_STEPS) {
  if (!PKR_DENOMINATIONS.includes(step)) {
    throw new Error(`Loose-change step Rs ${step} is not a PKR denomination.`);
  }
}
