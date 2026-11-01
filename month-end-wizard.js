/**
 * month-end-wizard.js — SISP-130: 4-Step Month-End Pre-Flight Closing Wizard.
 *
 * Before the owner runs a new monthly billing cycle, this wizard checks the
 * month being closed (the last completed PKT month) on four gates:
 *   1. Shop cash   — every shop's unsettled cash handed over
 *                    (shop-settlement.js buildShopSummaries, verbatim).
 *   2. Overheads   — every configured SISP-27 fixed overhead posted for the
 *                    month (fixed-overheads.js resolveOverheadTemplates +
 *                    overheadPostingFor, verbatim).
 *   3. Partners    — the live 50/50 settlement snapshot for the month
 *                    (partner-settlement.js buildPartnerSettlementReport,
 *                    verbatim) + whether a confirmed slip already exists.
 *   4. Backup      — an off-device backup was actually exported AFTER the
 *                    closing month ended, proven by the backup-health
 *                    record (backup-health.js sisp_backup_health_v1
 *                    lastExportAt, the same record the Backup Health badge
 *                    reads — including the app's legacy-timestamp fallback,
 *                    which the host passes in via getBackupRecord).
 *
 * Semantics, deliberately conservative:
 *   - The wizard WARNS; it never blocks the billing cycle and never changes
 *     cycle semantics. A Proceed/close path always exists.
 *   - The wizard itself writes NOTHING. Its only actions jump to the real
 *     surfaces (Shop Settlement, Fixed Overheads) or trigger the shipped
 *     backup-export path — all supplied by the host (app.js).
 *   - Gate 2 "configured" = a built-in template whose default amount the
 *     owner actually set. Templates never configured are reported as such
 *     and never counted as missing — the gate cannot warn forever about a
 *     cost the business does not have. If NO template is configured, the
 *     gate passes with the explicit "none configured" note.
 *   - Gate 4 pass rule is strict on purpose: an export dated DURING the
 *     closing month cannot contain that whole month, so it only warns.
 *     Pass requires the export's PKT date to fall after the closing
 *     month's last day. No record → warn "never", never a claimed backup.
 *
 * The module is imported ONLY by app.js (bundled inline; dist stays 25).
 * All builders are pure over injected data; tests use synthetic data only.
 */

import { t } from './nav-language.js';
import { formatPKR } from './core.js';
import { pakistanMonthKey } from './billing-cycle.js';
import { buildShopSummaries, loadShopSettlements } from './shop-settlement.js';
import { loadOverheads, resolveOverheadTemplates, overheadPostingFor } from './fixed-overheads.js';
import {
  buildPartnerSettlementReport,
  loadPartnerLedgerEntries,
  loadPartnerSettlements,
  settlementForMonth,
  partnerMonthLabel
} from './partner-settlement.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** 'YYYY-MM' → the month before it (invalid input → ''). */
export function previousMonthKey(month) {
  if (!MONTH_RE.test(String(month || ''))) return '';
  const [year, mon] = String(month).split('-').map(Number);
  const date = new Date(Date.UTC(year, mon - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * The month being closed before the next cycle runs: the last completed
 * PKT month — the previous month of the billing cycle's own current-month
 * key (billing-cycle.js pakistanMonthKey). Injectable via referenceDate.
 */
export function closingMonthFor(referenceDate = new Date()) {
  return previousMonthKey(pakistanMonthKey(referenceDate));
}

/** Last calendar day of a 'YYYY-MM' month as 'YYYY-MM-DD' ('' if invalid). */
export function monthLastDayKey(month) {
  if (!MONTH_RE.test(String(month || ''))) return '';
  const [year, mon] = String(month).split('-').map(Number);
  const last = new Date(Date.UTC(year, mon, 0));
  return `${month}-${String(last.getUTCDate()).padStart(2, '0')}`;
}

/** PKT calendar date ('YYYY-MM-DD') of an ISO instant; null when invalid. */
export function pktDateKeyOfInstant(iso) {
  if (typeof iso !== 'string' || !iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Pure pre-flight report for one closing month. Every figure comes from
 * the owning engine — this function only arranges their verdicts.
 */
export function buildMonthEndPreflight({
  state,
  settlements = [],
  overheads = null,
  partnerEntries = [],
  partnerSettlements = [],
  backupRecord = null,
  month,
  referenceDate = new Date()
} = {}) {
  const closingMonth = MONTH_RE.test(String(month || '')) ? String(month) : closingMonthFor(referenceDate);

  // Gate 1 — shop cash: buildShopSummaries already treats SISP-68 partner
  // pickups as handed over; a shop exists here only because recorded
  // payments/settlements name it (never a hardcoded shop list).
  const summaries = buildShopSummaries(state, settlements, referenceDate);
  const unsettledShops = summaries
    .filter((row) => Number(row.unsettled) > 0)
    .map((row) => ({
      shop: row.shop,
      unsettled: Number(row.unsettled) || 0,
      unsettledReceiptCount: Number(row.unsettledReceiptCount) || 0
    }));
  const shopsGate = {
    id: 'shops',
    status: unsettledShops.length ? 'warn' : 'pass',
    unsettledShops,
    totalUnsettled: unsettledShops.reduce((sum, row) => sum + row.unsettled, 0),
    shopCount: summaries.length
  };

  // Gate 2 — fixed overheads: only templates the owner configured with a
  // default amount are expected monthly. overheadPostingFor already
  // refuses stale postings (expense deleted → not posted).
  const templates = resolveOverheadTemplates(overheads);
  const configured = templates.filter((tpl) => tpl.defaultAmount !== null && tpl.defaultAmount !== undefined && Number(tpl.defaultAmount) > 0);
  let overheadsGate;
  if (!configured.length) {
    overheadsGate = { id: 'overheads', status: 'pass', configuredCount: 0, postedCount: 0, missing: [], noneConfigured: true };
  } else {
    const missing = configured
      .filter((tpl) => !overheadPostingFor(overheads, state, tpl.id, closingMonth))
      .map((tpl) => ({ id: tpl.id, label: tpl.label }));
    overheadsGate = {
      id: 'overheads',
      status: missing.length ? 'warn' : 'pass',
      configuredCount: configured.length,
      postedCount: configured.length - missing.length,
      missing,
      noneConfigured: false
    };
  }

  // Gate 3 — partner snapshot: the settlement engine's own report, plus
  // whether a confirmed slip for the month is already on record. Display
  // only — the wizard stores no snapshot of its own.
  let partnersGate;
  try {
    const report = buildPartnerSettlementReport(state, closingMonth, partnerEntries, referenceDate);
    const slip = settlementForMonth(partnerSettlements, closingMonth);
    partnersGate = {
      id: 'partners',
      status: 'pass',
      revenue: report.revenue,
      expenses: report.expenses,
      profit: report.profit,
      isLoss: report.isLoss === true,
      share: report.share,
      perPartner: (report.perPartner || []).map((row) => ({
        partner: row.partner,
        share: row.share,
        drawings: row.drawings,
        capital: row.capital,
        netPayout: row.netPayout,
        isReceivable: row.isReceivable === true
      })),
      slipExists: Boolean(slip),
      slipConfirmedAt: slip && typeof slip.confirmedAt === 'string' ? slip.confirmedAt : null
    };
  } catch {
    partnersGate = { id: 'partners', status: 'warn', unavailable: true, perPartner: [], slipExists: false, slipConfirmedAt: null };
  }

  // Gate 4 — backup evidence: the backup-health record's lastExportAt.
  const lastExportAt = backupRecord && typeof backupRecord.lastExportAt === 'string' ? backupRecord.lastExportAt : null;
  const exportDate = lastExportAt ? pktDateKeyOfInstant(lastExportAt) : null;
  const monthEnd = monthLastDayKey(closingMonth);
  let backupGate;
  if (!exportDate) {
    backupGate = { id: 'backup', status: 'warn', reason: 'never', exportDate: null, monthEnd };
  } else if (exportDate > monthEnd) {
    backupGate = { id: 'backup', status: 'pass', reason: 'after-close', exportDate, monthEnd };
  } else if (exportDate.slice(0, 7) === closingMonth) {
    backupGate = { id: 'backup', status: 'warn', reason: 'during-month', exportDate, monthEnd };
  } else {
    backupGate = { id: 'backup', status: 'warn', reason: 'stale', exportDate, monthEnd };
  }

  const steps = [shopsGate, overheadsGate, partnersGate, backupGate];
  return {
    month: closingMonth,
    steps,
    warnCount: steps.filter((step) => step.status === 'warn').length,
    allPass: steps.every((step) => step.status === 'pass')
  };
}

function stepShell(step, titleKey, bodyHtml, actionHtml) {
  const statusLabel = step.status === 'pass' ? t('mew_status_pass') : t('mew_status_warn');
  return `<section class="month-end-wizard-step month-end-wizard-step--${step.status}">
    <header class="month-end-wizard-step-head">
      <strong>${escapeHtml(t(titleKey))}</strong>
      <span class="month-end-wizard-status month-end-wizard-status--${step.status}">${escapeHtml(statusLabel)}</span>
    </header>
    <div class="month-end-wizard-step-body">${bodyHtml}</div>
    ${actionHtml || ''}
  </section>`;
}

/** Pure HTML for the wizard's four steps (all strings via t()). */
export function monthEndWizardStepsHtml(report) {
  const byId = Object.fromEntries((report?.steps || []).map((step) => [step.id, step]));
  const monthLabel = partnerMonthLabel(report?.month);
  const parts = [];

  const shops = byId.shops || { status: 'warn', unsettledShops: [], totalUnsettled: 0 };
  if (shops.status === 'pass') {
    parts.push(stepShell(shops, 'mew_step_shops',
      `<p>${escapeHtml(t('mew_shops_pass'))}</p>`,
      ''));
  } else {
    const rows = (shops.unsettledShops || []).map((row) =>
      `<p><span>${escapeHtml(row.shop)}</span><strong>${escapeHtml(formatPKR(row.unsettled))}</strong></p>`).join('');
    parts.push(stepShell(shops, 'mew_step_shops',
      `<p>${escapeHtml(t('mew_shops_warn', null, { count: (shops.unsettledShops || []).length }))}</p>
       <div class="month-end-wizard-rows">${rows}
       <p><span>${escapeHtml(t('mew_shops_total'))}</span><strong>${escapeHtml(formatPKR(shops.totalUnsettled))}</strong></p></div>`,
      `<button type="button" class="secondary-button" data-mew-action="shops">${escapeHtml(t('mew_btn_shops'))}</button>`));
  }

  const overheads = byId.overheads || { status: 'warn', missing: [], configuredCount: 0, postedCount: 0 };
  if (overheads.noneConfigured) {
    parts.push(stepShell(overheads, 'mew_step_overheads',
      `<p>${escapeHtml(t('mew_overheads_none'))}</p>`, ''));
  } else if (overheads.status === 'pass') {
    parts.push(stepShell(overheads, 'mew_step_overheads',
      `<p>${escapeHtml(t('mew_overheads_pass', null, { count: overheads.configuredCount, month: monthLabel }))}</p>`, ''));
  } else {
    const names = (overheads.missing || []).map((row) => escapeHtml(row.label)).join(' · ');
    parts.push(stepShell(overheads, 'mew_step_overheads',
      `<p>${escapeHtml(t('mew_overheads_warn', null, { posted: overheads.postedCount, count: overheads.configuredCount }))}</p>
       <p><span>${escapeHtml(t('mew_overheads_missing'))}</span> <strong>${names}</strong></p>`,
      `<button type="button" class="secondary-button" data-mew-action="overheads">${escapeHtml(t('mew_btn_overheads'))}</button>`));
  }

  const partners = byId.partners || { status: 'warn', unavailable: true, perPartner: [] };
  if (partners.unavailable) {
    parts.push(stepShell(partners, 'mew_step_partners',
      `<p>${escapeHtml(t('mew_partners_unavailable'))}</p>`, ''));
  } else {
    const rows = (partners.perPartner || []).map((row) =>
      `<p><span>${escapeHtml(row.partner)}</span><strong>${escapeHtml(t('mew_partners_net', null, { amount: formatPKR(row.netPayout) }))}</strong></p>
       <p class="month-end-wizard-sub"><span>${escapeHtml(t('mew_partners_share'))} ${escapeHtml(formatPKR(row.share))} · ${escapeHtml(t('mew_partners_drawings'))} ${escapeHtml(formatPKR(row.drawings))}</span></p>`).join('');
    const slipLine = partners.slipExists
      ? t('mew_partners_slip_saved')
      : t('mew_partners_slip_open');
    parts.push(stepShell(partners, 'mew_step_partners',
      `<div class="month-end-wizard-rows">
         <p><span>${escapeHtml(t('mew_partners_profit'))}</span><strong>${escapeHtml(formatPKR(partners.profit))}</strong></p>
         ${partners.isLoss ? `<p><span>${escapeHtml(t('mew_partners_loss'))}</span></p>` : ''}
         ${rows}
       </div>
       <p>${escapeHtml(slipLine)}</p>`, ''));
  }

  const backup = byId.backup || { status: 'warn', reason: 'never', exportDate: null };
  let backupBody;
  if (backup.status === 'pass') {
    backupBody = `<p>${escapeHtml(t('mew_backup_pass', null, { date: backup.exportDate, month: monthLabel }))}</p>`;
  } else if (backup.reason === 'during-month') {
    backupBody = `<p>${escapeHtml(t('mew_backup_during', null, { date: backup.exportDate, month: monthLabel }))}</p>`;
  } else if (backup.reason === 'stale') {
    backupBody = `<p>${escapeHtml(t('mew_backup_stale', null, { date: backup.exportDate, month: monthLabel }))}</p>`;
  } else {
    backupBody = `<p>${escapeHtml(t('mew_backup_never'))}</p>`;
  }
  parts.push(stepShell(backup, 'mew_step_backup', backupBody,
    backup.status === 'pass' ? '' : `<button type="button" class="secondary-button" data-mew-action="backup">${escapeHtml(t('mew_btn_backup'))}</button>`));

  return parts.join('');
}

/**
 * Wires the wizard dialog (in index.html). Pure logic lives above; this
 * controller only loads the real stores, renders, and routes the jump
 * actions the host supplies. It writes nothing itself.
 */
export function setupMonthEndWizard(getState, { onToast, getBackupRecord, onExportBackup, onOpenShops, onOpenOverheads } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('monthEndWizardModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const bodyEl = $('monthEndWizardBody');
  const monthEl = $('monthEndWizardMonth');
  const titleEl = $('monthEndWizardTitle');
  const noteEl = $('monthEndWizardNote');
  const proceedBtn = $('monthEndWizardProceedBtn');
  const closeBtn = $('monthEndWizardCloseBtn');
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openMonthEndWizardBtn') : null;

  function render() {
    const state = typeof getState === 'function' ? getState() : {};
    const referenceDate = new Date();
    const month = closingMonthFor(referenceDate);
    const report = buildMonthEndPreflight({
      state,
      settlements: loadShopSettlements(),
      overheads: loadOverheads(),
      partnerEntries: loadPartnerLedgerEntries(),
      partnerSettlements: loadPartnerSettlements(),
      backupRecord: typeof getBackupRecord === 'function' ? getBackupRecord() : null,
      month,
      referenceDate
    });
    if (titleEl) titleEl.textContent = t('mew_title');
    if (monthEl) monthEl.textContent = `${t('mew_intro_label')} ${partnerMonthLabel(month)}`;
    if (noteEl) noteEl.textContent = t('mew_note');
    if (proceedBtn) proceedBtn.textContent = t('mew_btn_proceed');
    if (bodyEl) bodyEl.innerHTML = monthEndWizardStepsHtml(report);
    return report;
  }

  function open() {
    render();
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  if (openBtn) openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  if (proceedBtn) proceedBtn.addEventListener('click', () => dialog.close());
  if (bodyEl) bodyEl.addEventListener('click', (event) => {
    const btn = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-mew-action]')
      : null;
    if (!btn) return;
    const action = btn.dataset.mewAction;
    if (action === 'shops') {
      dialog.close();
      if (typeof onOpenShops === 'function') onOpenShops();
    } else if (action === 'overheads') {
      dialog.close();
      if (typeof onOpenOverheads === 'function') onOpenOverheads();
    } else if (action === 'backup') {
      if (typeof onExportBackup === 'function') onExportBackup();
      // The export path records the new health record synchronously, so a
      // re-render immediately shows gate 4's fresh verdict.
      render();
      if (typeof onToast === 'function') onToast(t('mew_backup_exported_toast'));
    }
  });

  return { open, refresh: render };
}
