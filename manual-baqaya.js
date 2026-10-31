// Owner feature (2026-10-29, voice note): Manual Loan / Baqaya — the
// presentation + shared-figures layer. The DATA lives in core.js
// (entries on the customer record, settlements stamped on payments,
// remaining amounts derived there); this module is the ONE place that
// joins the engine's bill dues with the manual baqaya into the total a
// surface shows next to the customer's name, plus the profile section
// markup. Every surface (profile, Customers card, Quick Collect, Field
// Mode) reads its outstanding figure through totalOutstandingFigures
// so the baqaya is added exactly once, in exactly the same way,
// everywhere — never as per-surface ad-hoc additions.
import { calculatePaymentAllocations, formatPKR, manualBaqayaEntriesWithRemaining, manualBaqayaOutstandingCents } from './core.js';
import { t } from './nav-language.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const formatEntryDate = (date) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? String(date ?? '') : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed);
};

/**
 * THE shared outstanding helper: the engine's bill dues for a customer
 * plus their unpaid manual baqaya. `allocations` may be passed to share
 * one engine pass across a rendered list; without it, a single-customer
 * engine pass runs (the engine is per-customer independent, so the
 * figures are identical either way). Amounts in cents + rupees.
 */
export function totalOutstandingFigures(customer, allocations = null) {
  const allocs = allocations ?? calculatePaymentAllocations({ customers: [customer] });
  let billDuesCents = 0;
  for (const bill of customer?.bills ?? []) {
    const summary = allocs.forMonth(customer.id, bill.month);
    if (summary?.balanceDueCents > 0) billDuesCents += summary.balanceDueCents;
  }
  const manualBaqayaCents = manualBaqayaOutstandingCents(customer);
  const totalCents = billDuesCents + manualBaqayaCents;
  return {
    billDuesCents,
    manualBaqayaCents,
    totalCents,
    billDues: billDuesCents / 100,
    manualBaqaya: manualBaqayaCents / 100,
    total: totalCents / 100
  };
}

/** Customers-card badge shown next to the name ('' when no baqaya is unpaid). */
export function manualBaqayaCardBadgeMarkup(customer) {
  const outstandingCents = manualBaqayaOutstandingCents(customer);
  if (outstandingCents <= 0) return '';
  return `<span class="manual-baqaya-badge">${escapeHtml(t('baqaya_card_badge', null, { amount: formatPKR(outstandingCents / 100) }))}</span>`;
}

/**
 * OWNER-ADDPEND (2026-11-01): the quick-edit controls rendered next to
 * the Pending badge (Customers card controls row + profile summary).
 * The additional amount IS the outstanding manual baqaya — this markup
 * only DISPLAYS the shared derived figures (totalOutstandingFigures)
 * and offers the editor; it never stores a second number.
 *  - No baqaya outstanding: only the subtle "＋ Additional" affordance.
 *  - Baqaya outstanding: the TOTAL pending (bill + additional) with a
 *    breakdown line and an ✎ edit button on the additional chip.
 * FREE connections and archived customers get '' (the core refuses
 * them; there is nothing to offer).
 */
export function additionalPendingControlsMarkup(customer, allocations = null) {
  if (!customer || customer.archived || customer.isFreeConnection === true) return '';
  const figures = totalOutstandingFigures(customer, allocations);
  const button = `<button type="button" class="additional-pending-btn" data-additional-pending="${escapeHtml(customer.id)}" aria-label="${escapeHtml(t('addpend_edit'))}">`;
  if (figures.manualBaqayaCents <= 0) {
    return `<span class="additional-pending-controls">${button}${escapeHtml(t('addpend_add'))}</button></span>`;
  }
  return `<span class="additional-pending-controls"><span class="additional-pending-total">${escapeHtml(t('addpend_total_label', null, { amount: formatPKR(figures.totalCents / 100) }))}</span><span class="additional-pending-breakdown">${escapeHtml(t('addpend_breakdown', null, { bill: formatPKR(figures.billDuesCents / 100), additional: formatPKR(figures.manualBaqayaCents / 100) }))}</span>${button}✎</button></span>`;
}

/** Profile summary stat article ('' when no baqaya is unpaid). */
export function manualBaqayaStatMarkup(customer) {
  const outstandingCents = manualBaqayaOutstandingCents(customer);
  if (outstandingCents <= 0) return '';
  return `<article class="profile-summary-stat manual-baqaya-stat"><span>${escapeHtml(t('baqaya_stat_label'))}</span><strong>${escapeHtml(formatPKR(outstandingCents / 100))}</strong><small>${escapeHtml(t('baqaya_stat_sub'))}</small></article>`;
}

function entryStatus(entry) {
  if (entry.remainingCents <= 0) {
    // OWNER-ADDPEND: an entry closed purely by an owner adjustment was
    // not paid — say so instead of claiming a payment settled it.
    if (entry.settledCents <= 0 && (entry.adjustedCents ?? 0) > 0) return { key: 'adjusted', label: t('baqaya_status_adjusted') };
    return { key: 'paid', label: t('baqaya_status_paid') };
  }
  if (entry.settledCents > 0) return { key: 'partial', label: t('baqaya_status_partial') };
  return { key: 'pending', label: t('baqaya_status_pending') };
}

/**
 * The profile's Manual Baqaya section: every entry with the amount it
 * still carries, oldest first. Edit/Remove buttons render only for
 * fully unsettled entries (the core audit rule) and only when the
 * profile is editable (not archived); a settled entry shows why it is
 * locked instead. The Add button renders under the same editability
 * rule and never for a FREE connection (free connections never owe).
 */
export function manualBaqayaSectionMarkup(customer, { archived = false } = {}) {
  const entries = manualBaqayaEntriesWithRemaining(customer);
  const outstandingCents = entries.reduce((sum, entry) => sum + entry.remainingCents, 0);
  const canEdit = !archived && customer?.isFreeConnection !== true;
  const rows = entries.map((entry) => {
    const status = entryStatus(entry);
    const settledLine = entry.settledCents > 0
      ? `<small class="manual-baqaya-settled">${escapeHtml(t('baqaya_entry_settled_part', null, { amount: formatPKR(entry.settledCents / 100) }))}</small>`
      : '';
    const adjustedLine = (entry.adjustedCents ?? 0) > 0
      ? `<small class="manual-baqaya-settled">${escapeHtml(t('baqaya_entry_adjusted_part', null, { amount: formatPKR(entry.adjustedCents / 100) }))}</small>`
      : '';
    const actions = entry.settledCents > 0
      ? `<span class="manual-baqaya-locked">${escapeHtml(t('baqaya_locked_note'))}</span>`
      : (canEdit ? `<span class="manual-baqaya-actions"><button type="button" class="text-button" data-edit-baqaya="${escapeHtml(entry.id)}">${escapeHtml(t('baqaya_edit'))}</button><button type="button" class="text-button danger" data-remove-baqaya="${escapeHtml(entry.id)}">${escapeHtml(t('baqaya_remove'))}</button></span>` : '');
    return `<li class="manual-baqaya-row">
      <span class="manual-baqaya-main"><strong>${escapeHtml(formatPKR(entry.amount))}</strong><small>${escapeHtml(t('baqaya_entry_for', null, { date: formatEntryDate(entry.date) }))}</small>${entry.note ? `<small class="manual-baqaya-note" dir="auto">${escapeHtml(entry.note)}</small>` : ''}</span>
      <span class="manual-baqaya-side"><span class="manual-baqaya-status manual-baqaya-status-${status.key}">${escapeHtml(status.label)}</span><strong>${escapeHtml(t('baqaya_entry_remaining', null, { amount: formatPKR(entry.remainingCents / 100) }))}</strong>${settledLine}${adjustedLine}${actions}</span>
    </li>`;
  }).join('');
  return `<div class="manual-baqaya-heading"><h3>${escapeHtml(t('baqaya_title'))}</h3>${canEdit ? `<button type="button" class="secondary-button" data-add-baqaya>${escapeHtml(t('baqaya_add'))}</button>` : ''}</div>
  ${outstandingCents > 0 ? `<p class="manual-baqaya-total">${escapeHtml(t('baqaya_total_label', null, { amount: formatPKR(outstandingCents / 100) }))}</p>` : ''}
  ${rows ? `<ul class="manual-baqaya-list">${rows}</ul>` : `<p class="manual-baqaya-empty">${escapeHtml(t('baqaya_empty'))}</p>`}
  <p class="manual-baqaya-hint">${escapeHtml(t('baqaya_collect_hint'))}</p>`;
}
