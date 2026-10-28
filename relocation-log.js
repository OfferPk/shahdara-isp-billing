/**
 * relocation-log.js — SISP-28: Customer House Shift / Relocation &
 * Package Change Audit Log.
 *
 * Problem (spec): subscribers occasionally move house/street or change
 * speed tiers, and the owner needs a clean audit log of the previous
 * address/zone, extra drop wire used, shifting fee charged, and package
 * history — without touching historical bills.
 *
 * Storage: relocation entries live ON the customer record
 * (`customer.relocationLog`, a flat array), next to `packageHistory`.
 * They travel in the JSON backup through the normal customer path
 * (see core.js: backup reconstruction + merge-by-id), so no separate
 * settings section is needed. Tests use synthetic data only.
 *
 * Rules, stated exactly:
 * - Recording a shift updates the customer's ACTIVE zone and address
 *   to the new values. Mohalla is NOT touched (zone/address only).
 * - The customer's installed fiber drop length (`fiberMeters`) is NOT
 *   changed — extra meters are LOGGED on the entry only.
 * - A shifting fee is added to the CURRENT month's bill ONLY when the
 *   owner ticks "add to current bill" AND a current-month bill exists.
 *   When no current-month bill exists, the fee stays logged on the
 *   entry (feeAppliedToBill: false) and NO bill is invented.
 * - Historical bills (any month before the current month) are NEVER
 *   modified by a relocation.
 * - The fee follows the late-fee precedent: a dedicated `shiftingFee`
 *   field on the bill, included in the bill amount by
 *   calculatePaymentAllocations in core.js (so SISP-2 netDue picks it
 *   up with no billing-cycle.js change).
 * - The profile timeline merges relocation entries with the existing
 *   packageHistory, newest first. Both lists stay readable when either
 *   is empty.
 *
 * Translation import only (phase 3): the timeline section renders on
 * the customer profile, so its sentences go through t(). nav-language.js
 * itself imports nothing, so no import cycle is possible. State mutation
 * still lives in core.js (recordCustomerRelocation), so the pure helpers
 * and the modal controller stay testable without the app.
 */
import { t } from './nav-language.js';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function pkr(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  return `PKR ${amount.toLocaleString('en-PK')}`;
}

const ID_RE = /^REL-(\d+)$/;

/** Drops malformed rows; keeps clean entries in stored order. */
export function sanitizeRelocationEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const toAddress = cleanText(entry.toAddress);
  const toZone = cleanText(entry.toZone);
  if (!toAddress || !toZone) return null;
  const shiftedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(entry.shiftedAt ?? '')) ? String(entry.shiftedAt) : '';
  if (!shiftedAt) return null;
  let extraFiberMeters = null;
  if (entry.extraFiberMeters !== null && entry.extraFiberMeters !== undefined && entry.extraFiberMeters !== '') {
    const n = Number(entry.extraFiberMeters);
    if (Number.isFinite(n) && n >= 0) extraFiberMeters = n;
  }
  let shiftingFee = 0;
  if (entry.shiftingFee !== null && entry.shiftingFee !== undefined && entry.shiftingFee !== '') {
    const n = Number(entry.shiftingFee);
    if (Number.isFinite(n) && n >= 0) shiftingFee = Math.round(n * 100) / 100;
  }
  return {
    id: cleanText(entry.id),
    fromAddress: cleanText(entry.fromAddress),
    toAddress,
    fromZone: cleanText(entry.fromZone),
    toZone,
    extraFiberMeters,
    shiftingFee,
    feeAppliedToBill: entry.feeAppliedToBill === true,
    feeBillMonth: /^\d{4}-\d{2}$/.test(String(entry.feeBillMonth ?? '')) ? String(entry.feeBillMonth) : null,
    shiftedAt,
    recordedAt: typeof entry.recordedAt === 'string' ? entry.recordedAt : ''
  };
}

/** Sanitizes a whole relocation log; [] on missing/corrupt input. */
export function sanitizeRelocationLog(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    const clean = sanitizeRelocationEntry(entry);
    if (clean) out.push(clean);
  }
  return out;
}

/** Next per-customer entry id (REL-1, REL-2, …). */
export function nextRelocationId(entries) {
  let max = 0;
  for (const entry of sanitizeRelocationLog(entries)) {
    const match = ID_RE.exec(String(entry.id || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `REL-${max + 1}`;
}

/**
 * Merged timeline of house shifts + package changes, newest first.
 * Each row: { kind: 'relocation' | 'package', date, title, detail }.
 * Package rows reuse the existing packageHistory shape
 * (date, oldPackage, newPackage, oldMonthlyRate, newMonthlyRate).
 */
export function buildRelocationTimeline(customer) {
  if (!customer || typeof customer !== 'object') return [];
  const rows = [];
  for (const entry of sanitizeRelocationLog(customer.relocationLog)) {
    const feePart = entry.shiftingFee > 0
      ? t('prof_reloc_fee', null, { amount: pkr(entry.shiftingFee) }) + (entry.feeAppliedToBill ? t('prof_reloc_fee_bill', null, { month: entry.feeBillMonth }) : t('prof_reloc_fee_logged'))
      : '';
    const fiberPart = entry.extraFiberMeters !== null && entry.extraFiberMeters !== undefined
      ? t('prof_reloc_fiber', null, { meters: entry.extraFiberMeters })
      : '';
    rows.push({
      kind: 'relocation',
      date: entry.shiftedAt,
      sortKey: `${entry.shiftedAt}|${entry.recordedAt || ''}`,
      title: `🏠 ${t('prof_reloc_shift', null, { from: entry.fromZone || t('prof_reloc_zone_norec'), to: entry.toZone })}`,
      detail: `${entry.fromAddress || t('prof_reloc_addr_norec')} → ${entry.toAddress}${fiberPart}${feePart}`
    });
  }
  for (const change of Array.isArray(customer.packageHistory) ? customer.packageHistory : []) {
    if (!change || typeof change !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(change.date ?? ''))) continue;
    const ratePart = (change.oldMonthlyRate !== null && change.oldMonthlyRate !== undefined) || (change.newMonthlyRate !== null && change.newMonthlyRate !== undefined)
      ? t('prof_reloc_rate', null, { old: change.oldMonthlyRate ?? t('prof_reloc_not_set'), new: change.newMonthlyRate ?? t('prof_reloc_not_set') })
      : '';
    rows.push({
      kind: 'package',
      date: change.date,
      sortKey: `${change.date}|${change.recordedAt || ''}`,
      title: `📦 ${t('prof_reloc_pkg', null, { old: change.oldPackage || t('prof_reloc_not_set'), new: change.newPackage || t('prof_reloc_not_set') })}`,
      detail: `${t('prof_reloc_changed', null, { date: change.date })}${ratePart}`
    });
  }
  return rows.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? 1 : -1;
    if (a.kind !== b.kind) return a.kind === 'relocation' ? -1 : 1;
    return 0;
  });
}

/** Full profile-section HTML for the timeline (theme tokens only, via CSS classes). */
export function renderRelocationTimeline(customer) {
  const rows = buildRelocationTimeline(customer);
  const list = rows.length === 0
    ? `<p class="relocation-timeline-empty">${t('prof_reloc_empty')}</p>`
    : `<ul class="relocation-timeline-list">${rows.map((row) => `
      <li class="relocation-timeline-row relocation-timeline-${escapeHtml(row.kind)}">
        <span class="relocation-timeline-date">${escapeHtml(row.date)}</span>
        <span class="relocation-timeline-body"><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(row.detail)}</span></span>
      </li>`).join('')}</ul>`;
  return `<section class="profile-relocation-section" aria-label="${t('prof_reloc_aria')}"><h4>${t('prof_reloc_heading')}</h4><p class="relocation-timeline-note">${t('prof_reloc_note')}</p>${list}<button type="button" class="secondary-button" id="profileRecordRelocationBtn">🏠 ${t('prof_reloc_record')}</button></section>`;
}

/**
 * 1-click "Record House Shift / Relocation" modal controller, following
 * the pending-works pattern: open(customerId, customer, opts) prefills
 * the from-fields from the live record; submit calls onSubmit, which
 * the app wires to core.recordCustomerRelocation + persist + re-render.
 * opts: { today: 'YYYY-MM-DD', hasCurrentBill: boolean }.
 */
export function setupRelocationModal({ onSubmit, onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('relocationModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let currentCustomerId = null;

  function resetForm() {
    const form = $('relocationForm');
    if (form) form.reset();
  }

  const form = $('relocationForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!currentCustomerId) return;
      try {
        if (typeof onSubmit !== 'function') throw new Error('Relocation submit is not wired.');
        onSubmit(currentCustomerId, {
          fromAddress: $('relocationFromAddress')?.value,
          toAddress: $('relocationToAddress')?.value,
          fromZone: $('relocationFromZone')?.value,
          toZone: $('relocationToZone')?.value,
          extraFiberMeters: $('relocationExtraFiber')?.value,
          shiftingFee: $('relocationFee')?.value,
          addFeeToBill: $('relocationAddFee')?.checked === true,
          shiftedAt: $('relocationDate')?.value
        });
        resetForm();
        dialog.close();
        if (typeof onToast === 'function') onToast('House shift recorded.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not record this shift.');
      }
    });
  }
  const closeBtn = $('relocationCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());

  return {
    open(customerId, customer, opts = {}) {
      currentCustomerId = customerId;
      resetForm();
      const nameEl = $('relocationCustomerName');
      if (nameEl) nameEl.textContent = customer?.name ? `${customer.name} (#${customer.customerNumber ?? ''})` : '';
      const fromAddress = $('relocationFromAddress');
      if (fromAddress) fromAddress.value = customer?.address || '';
      const fromZone = $('relocationFromZone');
      if (fromZone) fromZone.value = customer?.zone || '';
      const dateInput = $('relocationDate');
      if (dateInput) dateInput.value = opts.today || '';
      const noBillNote = $('relocationNoBillNote');
      if (noBillNote) noBillNote.hidden = opts.hasCurrentBill !== false;
      const addFee = $('relocationAddFee');
      if (addFee) addFee.disabled = opts.hasCurrentBill === false;
      dialog.showModal();
    },
    close() {
      dialog.close();
    }
  };
}
