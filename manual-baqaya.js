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

/** Profile summary stat article ('' when no baqaya is unpaid). */
export function manualBaqayaStatMarkup(customer) {
  const outstandingCents = manualBaqayaOutstandingCents(customer);
  if (outstandingCents <= 0) return '';
  return `<article class="profile-summary-stat manual-baqaya-stat"><span>${escapeHtml(t('baqaya_stat_label'))}</span><strong>${escapeHtml(formatPKR(outstandingCents / 100))}</strong><small>${escapeHtml(t('baqaya_stat_sub'))}</small></article>`;
}

function entryStatus(entry) {
  if (entry.remainingCents <= 0) return { key: 'paid', label: t('baqaya_status_paid') };
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
    const actions = entry.settledCents > 0
      ? `<span class="manual-baqaya-locked">${escapeHtml(t('baqaya_locked_note'))}</span>`
      : (canEdit ? `<span class="manual-baqaya-actions"><button type="button" class="text-button" data-edit-baqaya="${escapeHtml(entry.id)}">${escapeHtml(t('baqaya_edit'))}</button><button type="button" class="text-button danger" data-remove-baqaya="${escapeHtml(entry.id)}">${escapeHtml(t('baqaya_remove'))}</button></span>` : '');
    return `<li class="manual-baqaya-row">
      <span class="manual-baqaya-main"><strong>${escapeHtml(formatPKR(entry.amount))}</strong><small>${escapeHtml(t('baqaya_entry_for', null, { date: formatEntryDate(entry.date) }))}</small>${entry.note ? `<small class="manual-baqaya-note" dir="auto">${escapeHtml(entry.note)}</small>` : ''}</span>
      <span class="manual-baqaya-side"><span class="manual-baqaya-status manual-baqaya-status-${status.key}">${escapeHtml(status.label)}</span><strong>${escapeHtml(t('baqaya_entry_remaining', null, { amount: formatPKR(entry.remainingCents / 100) }))}</strong>${settledLine}${actions}</span>
    </li>`;
  }).join('');
  return `<div class="manual-baqaya-heading"><h3>${escapeHtml(t('baqaya_title'))}</h3>${canEdit ? `<button type="button" class="secondary-button" data-add-baqaya>${escapeHtml(t('baqaya_add'))}</button>` : ''}</div>
  ${outstandingCents > 0 ? `<p class="manual-baqaya-total">${escapeHtml(t('baqaya_total_label', null, { amount: formatPKR(outstandingCents / 100) }))}</p>` : ''}
  ${rows ? `<ul class="manual-baqaya-list">${rows}</ul>` : `<p class="manual-baqaya-empty">${escapeHtml(t('baqaya_empty'))}</p>`}
  <p class="manual-baqaya-hint">${escapeHtml(t('baqaya_collect_hint'))}</p>`;
}
