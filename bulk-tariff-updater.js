/**
 * bulk-tariff-updater.js — SISP-81: Bulk Package Tariff Updater &
 * Rate-Lock Protection Wizard.
 *
 * Lets the owner change the monthly fee for EVERY active customer on
 * one catalogue package in a single confirmed pass — e.g. moving all
 * Rs. 2,000 customers to Rs. 2,200 when the upstream tariff rises —
 * and then send each of them a WhatsApp rate-revision notice.
 *
 * RATE LOCK (the whole point of the phase): the update goes through
 * core updateCustomerProfile — the same audited plan path as the
 * profile Edit form and applyCustomerPlan — and NEVER calls
 * saveBillMonth, generateMonthlyBillsThroughCurrentMonth or any bill
 * writer. updateCustomerProfile itself enforces the lock: a price
 * change appends the packageHistory audit entry and records the new
 * rate in monthlyPriceSchedule effective the NEXT month when the
 * current month's bill already exists (the current month only when
 * no bill exists for it yet — an unissued bill is not rate-locked).
 * Every already-priced bill therefore keeps its amount byte for byte;
 * the new rate prices only future cycles, via the schedule rule the
 * billing engine already uses (applicableScheduleAmount).
 *
 * Deliberate contrast with Quick Collect's changeCustomerPackage
 * (PR #507): that single-customer flow REPRICES the current month's
 * bill on purpose. A bulk tariff revision must not — a hundred
 * already-issued bills changing silently is exactly the accident
 * this wizard exists to prevent.
 *
 * Filter honesty:
 *   - Package truth is the catalogue: a customer matches a package
 *     only when billPackageByLabel(customer.packageSpeed) resolves
 *     to it (house precedent — currentPackageInfo in
 *     upsell-optimizer.js, reused here). Free-text labels that match
 *     no catalogue entry never match; speeds are never invented.
 *   - The current fee is monthlySellingAmount when positive, else
 *     the catalogue price (currentPackageInfo's rule). The operator
 *     may pin the filter to one current fee, or leave it open to
 *     catch custom-fee customers on the same package label.
 *   - Only ACTIVE customers (serviceStatus === 'active', not
 *     archived) are updated. FREE connections (isFreeConnection) are
 *     EXCLUDED and counted separately in the preview: a FREE
 *     connection is never billed, so moving its "fee" would be a
 *     fiction (documented choice).
 *
 * Data safety: synthetic data only in tests; the wizard writes
 * nothing but the plan fields above, one customer at a time, and
 * collects per-customer failures instead of aborting the batch.
 */

import { BILL_PACKAGES, billPackageById } from './package-catalog.js';
import { updateCustomerProfile } from './core.js';
import { currentPackageInfo } from './upsell-optimizer.js';
import { formatWhatsAppUrl } from './form-validation.js';
import { pakistanMonthKey } from './billing-cycle.js';
import { t } from './nav-language.js';

/** Staff name stamped on every packageHistory entry this wizard writes. */
export const TARIFF_STAFF_NAME = 'Bulk tariff update';

const cents = (value) => Math.round(Number(value) * 100);
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const pkr = (n) => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** 'YYYY-MM' one month later (pure string math — no Date/timezone drift). */
export function nextTariffMonth(month) {
  const [year, mon] = String(month).split('-').map(Number);
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`;
  return next;
}

/** 'November 2026' for a 'YYYY-MM' key (notice + preview display). */
export function tariffMonthLabel(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month ?? ''));
  if (!match) return String(month ?? '');
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

/**
 * The month the new rate first prices for this customer — the exact
 * rule updateCustomerProfile applies to its price-schedule entry:
 * the next month when the current month's bill already exists (that
 * bill is rate-locked), otherwise the current (still unissued) month.
 */
export function tariffEffectiveMonth(customer, referenceDate = new Date()) {
  const currentMonth = pakistanMonthKey(referenceDate);
  const currentBillExists = (customer?.bills ?? []).some(bill => bill.month === currentMonth);
  return currentBillExists ? nextTariffMonth(currentMonth) : currentMonth;
}

/**
 * Normalize a rate filter value: a positive finite number, or null
 * when the operator left the current-fee field open (match any fee).
 */
function normalizeRate(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Validate the requested new rate; returns it as a clean number. */
export function validateTariffNewRate(newRate, currentRate = null) {
  const next = normalizeRate(newRate);
  if (next === null) throw new Error('Enter a new monthly fee greater than zero.');
  const current = normalizeRate(currentRate);
  if (current !== null && cents(next) === cents(current)) {
    throw new Error('The new fee is the same as the current fee.');
  }
  return next;
}

/**
 * The customers a tariff pass would touch: active, non-archived,
 * catalogue-matched to the package, optionally pinned to one current
 * fee. FREE connections that otherwise match are counted in
 * freeSkipped, never returned as rows.
 *
 * @returns {{ rows: Array, freeSkipped: number, plan: Object|null }}
 */
export function listTariffMatches(state, { packageId = '', currentRate = null } = {}) {
  const plan = billPackageById(packageId);
  if (!plan) return { rows: [], freeSkipped: 0, plan: null };
  const rate = normalizeRate(currentRate);
  const rows = [];
  let freeSkipped = 0;
  for (const customer of state?.customers ?? []) {
    if (!customer || customer.archived === true) continue;
    if (customer.serviceStatus !== 'active') continue;
    const info = currentPackageInfo(customer);
    if (info.packageId !== plan.id || info.fee === null) continue;
    if (rate !== null && cents(info.fee) !== cents(rate)) continue;
    if (customer.isFreeConnection === true) { freeSkipped++; continue; }
    rows.push({
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name ?? '',
      phone: customer.phone ?? '',
      mohalla: customer.mohalla ?? '',
      packageId: plan.id,
      packageLabel: info.label || plan.label,
      speedMbps: info.speedMbps,
      oldRate: info.fee
    });
  }
  rows.sort((a, b) => (a.customerNumber ?? 0) - (b.customerNumber ?? 0));
  return { rows, freeSkipped, plan };
}

/**
 * Preview of a tariff pass: matched rows with the new rate, the
 * per-customer delta and the month each customer's new rate starts,
 * plus the batch monthly delta. Pure — writes nothing.
 */
export function buildTariffPreview(state, { packageId = '', currentRate = null, newRate = null } = {}, referenceDate = new Date()) {
  const plan = billPackageById(packageId);
  if (!plan) throw new Error('Choose one of the available packages.');
  const next = validateTariffNewRate(newRate, currentRate);
  const { rows, freeSkipped } = listTariffMatches(state, { packageId, currentRate });
  const byId = new Map((state?.customers ?? []).map(c => [c.id, c]));
  const previewRows = rows
    .filter(row => cents(row.oldRate) !== cents(next))
    .map(row => ({
      ...row,
      newRate: next,
      delta: Number((next - row.oldRate).toFixed(2)),
      effectiveMonth: tariffEffectiveMonth(byId.get(row.customerId), referenceDate)
    }));
  return {
    packageId: plan.id,
    packageLabel: plan.label,
    currentRate: normalizeRate(currentRate),
    newRate: next,
    rows: previewRows,
    freeSkipped,
    totalDelta: Number(previewRows.reduce((sum, row) => sum + row.delta, 0).toFixed(2))
  };
}

/**
 * Apply a tariff pass. Matches are re-derived from the passed state
 * (a stale preview can never write), then each customer goes through
 * updateCustomerProfile with only the new monthlySellingAmount — no
 * bill writer is ever called, so issued bills cannot move. A
 * per-customer failure is collected, never fatal to the batch.
 *
 * @returns {{ nextState: Object, applied: Array, failed: Array,
 *   freeSkipped: number, preview: Object }}
 */
export function applyBulkTariffUpdate(state, { packageId = '', currentRate = null, newRate = null } = {}, referenceDate = new Date()) {
  const preview = buildTariffPreview(state, { packageId, currentRate, newRate }, referenceDate);
  let nextState = state;
  const applied = [];
  const failed = [];
  for (const row of preview.rows) {
    try {
      nextState = updateCustomerProfile(nextState, row.customerId, {
        monthlySellingAmount: preview.newRate,
        packageChangeStaffName: TARIFF_STAFF_NAME
      }, referenceDate);
      applied.push({ ...row });
    } catch (error) {
      failed.push({ customerId: row.customerId, customerNumber: row.customerNumber, name: row.name, error: String(error?.message ?? error) });
    }
  }
  return { nextState, applied, failed, freeSkipped: preview.freeSkipped, preview };
}

/**
 * Roman Urdu rate-revision notice for one updated customer. Kept
 * factual: old fee, new fee, the month the new fee starts, and the
 * rate-lock promise (issued bills unchanged).
 */
export function buildTariffNoticeText({ name = '', packageLabel = '', oldRate = 0, newRate = 0, effectiveMonth = '' } = {}) {
  const firstName = String(name ?? '').trim();
  const greeting = firstName ? `Assalam o Alaikum ${firstName}! ` : 'Assalam o Alaikum! ';
  return `${greeting}Shahdara Fiber Net ki taraf se ittila hai ke aap ke package (${packageLabel}) ki monthly fee ${pkr(oldRate)} se ${pkr(newRate)} ho gayi hai. Nayi fee ${tariffMonthLabel(effectiveMonth)} ke bill se lagu hogi. Aap ke pehle se jaari bills mein koi tabdeeli nahi hui. Shukriya!`;
}

/**
 * The bulk WhatsApp notice queue for an applied pass: one entry per
 * updated customer with a wa.me URL via the house formatWhatsAppUrl;
 * an invalid phone yields whatsappUrl null — never a fabricated link.
 */
export function buildTariffNoticeQueue(appliedRows = []) {
  return (appliedRows ?? []).map(row => {
    const text = buildTariffNoticeText(row);
    const result = formatWhatsAppUrl(row.phone || '', text);
    return {
      customerId: row.customerId,
      customerNumber: row.customerNumber,
      name: row.name,
      phone: row.phone ?? '',
      text,
      whatsappUrl: result.validPhone ? result.url : null
    };
  });
}

/** Copy-all text for the notice queue (one block per customer). */
export function tariffNoticeCopyText(queue = []) {
  return (queue ?? [])
    .map(entry => `#${entry.customerNumber} ${entry.name}: ${entry.text}`)
    .join('\n\n');
}

/**
 * Controller for the Bulk Tariff Update wizard dialog (opened from
 * the Monthly Billing actions bar). Mirrors setupExpenseVoucherDialog's
 * wiring style: returns null when there is no DOM or no dialog markup.
 * The host owns persistence via onUpdateState.
 *
 * @param {Object|Function} getState - State object or () => state
 * @param {Object} [options]
 * @param {Function} [options.onUpdateState] - (nextState) => void
 * @param {Function} [options.onToast]
 * @returns {Object|null} Controller { open, close, refresh }
 */
export function setupBulkTariffDialog(getState, { onUpdateState = null, onToast = null } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('bulkTariffDialog');
  if (!dialog) return null;

  const readState = () => (typeof getState === 'function' ? getState() : getState);
  const $ = (id) => document.getElementById(id);
  const openBtn = $('bulkTariffOpenBtn');
  const closeBtn = $('bulkTariffCloseBtn');
  const doneBtn = $('bulkTariffDoneBtn');
  const packageSelect = $('tariffPackageSelect');
  const currentRateInput = $('tariffCurrentRateInput');
  const newRateInput = $('tariffNewRateInput');
  const previewBtn = $('tariffPreviewBtn');
  const errorEl = $('tariffError');
  const summaryEl = $('tariffPreviewSummary');
  const listEl = $('tariffPreviewList');
  const freeNoteEl = $('tariffFreeSkippedNote');
  const applyBtn = $('tariffApplyBtn');
  const resultSection = $('tariffResultSection');
  const resultSummaryEl = $('tariffResultSummary');
  const noticeListEl = $('tariffNoticeList');
  const copyBtn = $('tariffCopyNoticesBtn');

  let currentPreview = null;
  let currentQueue = [];

  const showError = (message) => {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  };

  const fillPackages = () => {
    if (!packageSelect || packageSelect.options.length) return;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('tariff_package_placeholder');
    packageSelect.appendChild(placeholder);
    for (const plan of BILL_PACKAGES) {
      const opt = document.createElement('option');
      opt.value = plan.id;
      opt.textContent = `${plan.label} · ${pkr(plan.price)}`;
      packageSelect.appendChild(opt);
    }
  };

  const invalidatePreview = () => {
    currentPreview = null;
    if (applyBtn) applyBtn.disabled = true;
    if (summaryEl) summaryEl.textContent = '';
    if (listEl) listEl.innerHTML = '';
    if (freeNoteEl) { freeNoteEl.textContent = ''; freeNoteEl.hidden = true; }
  };

  const renderPreview = () => {
    showError('');
    if (resultSection) resultSection.hidden = true;
    try {
      currentPreview = buildTariffPreview(readState(), {
        packageId: packageSelect?.value ?? '',
        currentRate: currentRateInput?.value ?? '',
        newRate: newRateInput?.value ?? ''
      }, new Date());
    } catch (error) {
      invalidatePreview();
      showError(String(error?.message ?? error));
      return null;
    }
    const preview = currentPreview;
    if (summaryEl) {
      summaryEl.textContent = preview.rows.length === 0
        ? t('tariff_preview_empty')
        : preview.currentRate !== null
          ? t('tariff_preview_summary', null, { count: preview.rows.length, old: pkr(preview.currentRate), new: pkr(preview.newRate), delta: pkr(preview.totalDelta) })
          : t('tariff_preview_summary_all', null, { count: preview.rows.length, new: pkr(preview.newRate), delta: pkr(preview.totalDelta) });
    }
    if (listEl) {
      listEl.innerHTML = preview.rows.map(row => `<li class="bulk-tariff-row"><span class="bulk-tariff-main"><strong dir="auto">${escapeHtml(row.name)}</strong> <span class="bulk-tariff-meta">#${escapeHtml(row.customerNumber)}${row.mohalla ? ` · ${escapeHtml(row.mohalla)}` : ''}</span><span class="bulk-tariff-effective">${escapeHtml(t('tariff_effective_note', null, { month: tariffMonthLabel(row.effectiveMonth) }))}</span></span><strong class="bulk-tariff-rates">${escapeHtml(pkr(row.oldRate))} → ${escapeHtml(pkr(row.newRate))}</strong></li>`).join('');
    }
    if (freeNoteEl) {
      freeNoteEl.hidden = preview.freeSkipped === 0;
      freeNoteEl.textContent = preview.freeSkipped > 0 ? t('tariff_free_skipped', null, { count: preview.freeSkipped }) : '';
    }
    if (applyBtn) {
      applyBtn.disabled = preview.rows.length === 0;
      applyBtn.textContent = t('tariff_apply_btn', null, { count: preview.rows.length });
    }
    return preview;
  };

  const renderResult = (result) => {
    currentQueue = buildTariffNoticeQueue(result.applied);
    if (resultSummaryEl) {
      const parts = [t('tariff_applied_summary', null, { count: result.applied.length, new: pkr(result.preview.newRate) })];
      if (result.failed.length) parts.push(t('tariff_failed_summary', null, { count: result.failed.length }));
      resultSummaryEl.textContent = parts.join(' ');
    }
    if (noticeListEl) {
      noticeListEl.innerHTML = currentQueue.map(entry => `<li class="bulk-tariff-row"><span class="bulk-tariff-main"><strong dir="auto">${escapeHtml(entry.name)}</strong> <span class="bulk-tariff-meta">#${escapeHtml(entry.customerNumber)}</span></span>${entry.whatsappUrl ? `<a class="bulk-tariff-notice-btn" href="${escapeHtml(entry.whatsappUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('tariff_notice_btn'))}</a>` : ''}</li>`).join('');
    }
    if (resultSection) resultSection.hidden = result.applied.length === 0;
    if (copyBtn) copyBtn.disabled = currentQueue.length === 0;
  };

  const apply = () => {
    if (!currentPreview) return;
    const result = applyBulkTariffUpdate(readState(), {
      packageId: currentPreview.packageId,
      currentRate: currentPreview.currentRate,
      newRate: currentPreview.newRate
    }, new Date());
    if (typeof onUpdateState === 'function' && result.applied.length) onUpdateState(result.nextState);
    renderResult(result);
    invalidatePreview();
    if (typeof onToast === 'function') {
      onToast(t('tariff_applied_summary', null, { count: result.applied.length, new: pkr(result.preview.newRate) }));
    }
  };

  const copyNotices = async () => {
    const text = tariffNoticeCopyText(currentQueue);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (typeof onToast === 'function') onToast(t('tariff_copied'));
    } catch {
      if (typeof onToast === 'function') onToast(text);
    }
  };

  const open = () => {
    fillPackages();
    invalidatePreview();
    showError('');
    currentQueue = [];
    if (copyBtn) copyBtn.disabled = true;
    if (noticeListEl) noticeListEl.innerHTML = '';
    if (resultSummaryEl) resultSummaryEl.textContent = '';
    if (resultSection) resultSection.hidden = true;
    if (dialog.showModal) dialog.showModal();
    else dialog.hidden = false;
  };
  const close = () => { dialog.close?.() || (dialog.hidden = true); };

  if (openBtn) openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (doneBtn) doneBtn.addEventListener('click', close);
  if (packageSelect) packageSelect.addEventListener('change', () => {
    const plan = billPackageById(packageSelect.value);
    if (plan && currentRateInput) currentRateInput.value = String(plan.price);
    invalidatePreview();
  });
  if (currentRateInput) currentRateInput.addEventListener('input', invalidatePreview);
  if (newRateInput) newRateInput.addEventListener('input', invalidatePreview);
  if (previewBtn) previewBtn.addEventListener('click', renderPreview);
  if (applyBtn) applyBtn.addEventListener('click', apply);
  if (copyBtn) copyBtn.addEventListener('click', copyNotices);

  return { open, close, refresh: renderPreview };
}
