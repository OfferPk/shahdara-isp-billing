/**
 * system-health-center.js — SISP-100: Master System Health & All-Ledger
 * Telemetry Center.
 *
 * One read-only screen that answers "what does this device actually
 * hold?" for every business ledger in the app: live record counts, the
 * storage footprint (KB) of each store, and a last-modified stamp ONLY
 * where the store itself records one (a store that records no stamp
 * shows the house empty marker '—' — a timestamp is never invented).
 *
 * The registry below enumerates the stores AS THEY EXIST on main:
 *   - the main ledger file (core STORAGE_KEY) with its state-resident
 *     slices (customers, bills, receipts/payments, expenses, inventory
 *     items + movements, monthly closings, payroll day lists) counted
 *     from the live state object;
 *   - every sisp_* sibling store, read as raw localStorage text through
 *     the SAME key constants the owning modules export (no key string
 *     is re-typed here, so the registry cannot drift from reality);
 *   - splitter boxes, which have NO store of their own on main — they
 *     are derived from customer records (splitter-map.js), so the row
 *     is marked derived and carries no footprint of its own.
 *
 * Deliberately NOT listed (not business ledgers): the backup-health
 * status object (sisp_backup_health_v1, already surfaced in the Backup
 * section), the Khata Doctor's derived cache (sisp_khata_doctor_v1),
 * the branch-guard lineage stamp (sisp_branch_guard_v1), settings keys
 * (digital payments, language) and the shahdara_* diagnostic/QA module
 * keys.
 *
 * Rules (pinned by tests/system-health-center.test.js):
 *   1. READ-ONLY: building the report and running the Master Integrity
 *      Check never write to state or storage — pinned byte-for-byte.
 *   2. Counts come from the recorded data only. An absent store counts
 *      0; an unparseable store reports count null + status
 *      'unreadable' (never a guessed 0) and raises an integrity
 *      finding.
 *   3. Footprint = UTF-8 byte length of the serialized store (the raw
 *      localStorage text for sibling stores; JSON.stringify of the
 *      slice for state-resident ledgers).
 *   4. The Integrity Check only REPORTS — it never repairs, deletes or
 *      rewrites anything (repair is the Khata Doctor's job, behind its
 *      own safety snapshot). Findings carry counts only, never a
 *      customer name or any personal data.
 *   5. Archive Export is NOT implemented here: the dialog's button
 *      calls back into app.js, which reuses the shipped JSON backup
 *      download (createJsonBackup + backupExtras) unchanged.
 *
 * This module is imported ONLY by app.js (issue #219 budget): it is
 * bundled into the app entry, never a first-load entry of its own.
 * Tests use synthetic data only.
 */

import { STORAGE_KEY } from './core.js';
import { SHOP_SETTLEMENTS_KEY } from './shop-settlement.js';
import { COMPLAINTS_KEY } from './complaint-register.js';
import { TICKETS_KEY } from './complaint-tickets.js';
import { ROZNAMCHA_KEY } from './roznamcha.js';
import { INVENTORY_KEY } from './inventory-book.js';
import { GROUP_BILLING_KEY } from './group-billing.js';
import { SUSPENSE_PAYMENTS_KEY } from './suspense-payments.js';
import { REFERRAL_CREDITS_KEY } from './referral-credits.js';
import { PARTNER_LEDGER_KEY, PARTNER_SETTLEMENTS_KEY } from './partner-settlement.js';
import { VOIDED_PAYMENTS_KEY } from './payment-void-audit.js';
import { HOME_BUDGET_KEY } from './home-budget.js';
import { LOAN_KEY } from './loan-ledger.js';
import { SAAD_VISITS_KEY, SAAD_PAYMENTS_KEY } from './saad-visits.js';
import { INSTALL_REQUESTS_KEY } from './install-tracker.js';
import { PENDING_WORKS_KEY } from './pending-works.js';
import { MONTHLY_CLOSING_NOTES_KEY } from './monthly-closing-notes.js';
import { OVERHEAD_KEY } from './fixed-overheads.js';
import { WA_TEMPLATES_STORAGE_KEY } from './whatsapp-templates.js';
import { BILLING_CYCLES_KEY } from './billing-cycle.js';
import { formatBytes } from './backup-store.js';
import { getAppLanguage, t } from './nav-language.js';

export { formatBytes };

const textEncoder = new TextEncoder();

/** UTF-8 byte length of a serialized value — the storage footprint unit. */
export function utf8ByteLength(text) {
  return textEncoder.encode(String(text ?? '')).byteLength;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function allBills(state) {
  return arrayOf(state?.customers).flatMap((customer) => arrayOf(customer?.bills));
}

function allPayments(state) {
  return allBills(state).flatMap((bill) => arrayOf(bill?.payments));
}

/** Distinct splitter box ids assigned on customer records (SISP-24). */
export function countSplitterBoxes(state) {
  const boxes = new Set();
  for (const customer of arrayOf(state?.customers)) {
    const boxId = typeof customer?.splitterBoxId === 'string' ? customer.splitterBoxId.trim() : '';
    if (boxId) boxes.add(boxId);
  }
  return boxes.size;
}

/**
 * Per-shop settlement counts from the RECORDED shop values. Shop names
 * are owner data and are never hardcoded: a shop appears here only
 * when a settlement record actually names it.
 */
function shopBreakdown(entries) {
  const counts = new Map();
  for (const entry of arrayOf(entries)) {
    const shop = typeof entry?.shop === 'string' ? entry.shop.trim() : '';
    if (!shop) continue;
    counts.set(shop, (counts.get(shop) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** State-resident ledgers: counted from the live state object. */
export const SYSTEM_HEALTH_STATE_LEDGERS = Object.freeze([
  { id: 'customers', nameKey: 'syshealth_ledger_customers', slice: (state) => state?.customers },
  { id: 'bills', nameKey: 'syshealth_ledger_bills', slice: (state) => allBills(state) },
  { id: 'receipts', nameKey: 'syshealth_ledger_receipts', slice: (state) => allPayments(state) },
  { id: 'expenses', nameKey: 'syshealth_ledger_expenses', slice: (state) => state?.expenses },
  { id: 'inventory-items', nameKey: 'syshealth_ledger_inventory_items', slice: (state) => state?.inventoryItems },
  { id: 'inventory-movements', nameKey: 'syshealth_ledger_inventory_movements', slice: (state) => state?.inventoryMovements },
  { id: 'monthly-closings', nameKey: 'syshealth_ledger_monthly_closings', slice: (state) => state?.monthlyClosings },
  { id: 'saad-attendance', nameKey: 'syshealth_ledger_saad_attendance', slice: (state) => state?.saadAttendanceDays },
  { id: 'umair-workdays', nameKey: 'syshealth_ledger_umair_workdays', slice: (state) => state?.umairWorkdays }
]);

/** Sibling localStorage stores: counted from the raw stored text. */
export const SYSTEM_HEALTH_STORAGE_LEDGERS = Object.freeze([
  { id: 'shop-settlements', nameKey: 'syshealth_ledger_shop_settlements', key: SHOP_SETTLEMENTS_KEY, shape: 'array', breakdown: shopBreakdown },
  { id: 'complaints', nameKey: 'syshealth_ledger_complaints', key: COMPLAINTS_KEY, shape: 'array' },
  { id: 'tickets', nameKey: 'syshealth_ledger_tickets', key: TICKETS_KEY, shape: 'array' },
  { id: 'roznamcha', nameKey: 'syshealth_ledger_roznamcha', key: ROZNAMCHA_KEY, shape: 'array' },
  { id: 'stock-book', nameKey: 'syshealth_ledger_stock_book', key: INVENTORY_KEY, shape: 'array' },
  { id: 'billing-groups', nameKey: 'syshealth_ledger_billing_groups', key: GROUP_BILLING_KEY, shape: 'array' },
  { id: 'suspense-payments', nameKey: 'syshealth_ledger_suspense', key: SUSPENSE_PAYMENTS_KEY, shape: 'array' },
  { id: 'referral-credits', nameKey: 'syshealth_ledger_referral_credits', key: REFERRAL_CREDITS_KEY, shape: 'array' },
  { id: 'partner-ledger', nameKey: 'syshealth_ledger_partner_ledger', key: PARTNER_LEDGER_KEY, shape: 'array' },
  { id: 'partner-settlements', nameKey: 'syshealth_ledger_partner_settlements', key: PARTNER_SETTLEMENTS_KEY, shape: 'array' },
  { id: 'voided-payments', nameKey: 'syshealth_ledger_voided_payments', key: VOIDED_PAYMENTS_KEY, shape: 'array' },
  { id: 'install-requests', nameKey: 'syshealth_ledger_install_requests', key: INSTALL_REQUESTS_KEY, shape: 'array' },
  { id: 'pending-works', nameKey: 'syshealth_ledger_pending_works', key: PENDING_WORKS_KEY, shape: 'array' },
  { id: 'billing-cycles', nameKey: 'syshealth_ledger_billing_cycles', key: BILLING_CYCLES_KEY, shape: 'array' },
  { id: 'saad-visits', nameKey: 'syshealth_ledger_saad_visits', key: SAAD_VISITS_KEY, shape: 'array' },
  { id: 'saad-payments', nameKey: 'syshealth_ledger_saad_payments', key: SAAD_PAYMENTS_KEY, shape: 'array' },
  { id: 'home-budget', nameKey: 'syshealth_ledger_home_budget', key: HOME_BUDGET_KEY, shape: 'array' },
  { id: 'loans', nameKey: 'syshealth_ledger_loans', key: LOAN_KEY, shape: 'array' },
  { id: 'wa-templates', nameKey: 'syshealth_ledger_wa_templates', key: WA_TEMPLATES_STORAGE_KEY, shape: 'array' },
  { id: 'closing-notes', nameKey: 'syshealth_ledger_closing_notes', key: MONTHLY_CLOSING_NOTES_KEY, shape: 'object' },
  { id: 'overheads', nameKey: 'syshealth_ledger_overheads', key: OVERHEAD_KEY, shape: 'object', countValue: (value) => arrayOf(value?.templates).length + arrayOf(value?.postings).length }
]);

/**
 * A store-level last-modified stamp exists ONLY when the stored value
 * itself is an object carrying a date-like updatedAt/lastModified/
 * savedAt string. Arrays and stamp-less objects honestly return null.
 */
export function storeRecordedTimestamp(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  for (const field of ['updatedAt', 'lastModified', 'savedAt']) {
    const value = parsed[field];
    if (typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value))) return value;
  }
  return null;
}

function readRaw(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    return typeof raw === 'string' ? raw : null;
  } catch {
    return null;
  }
}

function storageRow(descriptor, storage) {
  const base = { id: descriptor.id, nameKey: descriptor.nameKey, source: 'storage', storageKey: descriptor.key, breakdown: null, noteKey: null };
  const raw = readRaw(storage, descriptor.key);
  if (raw === null || raw === '') return { ...base, count: 0, bytes: 0, lastModified: null, status: 'empty' };
  const bytes = utf8ByteLength(raw);
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { ...base, count: null, bytes, lastModified: null, status: 'unreadable' }; }
  const shapeOk = descriptor.shape === 'array'
    ? Array.isArray(parsed)
    : Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
  if (!shapeOk) return { ...base, count: null, bytes, lastModified: null, status: 'invalid-shape' };
  const count = typeof descriptor.countValue === 'function'
    ? descriptor.countValue(parsed)
    : descriptor.shape === 'array' ? parsed.length : Object.keys(parsed).length;
  return {
    ...base,
    count,
    bytes,
    lastModified: storeRecordedTimestamp(parsed),
    status: count > 0 ? 'ok' : 'empty',
    breakdown: typeof descriptor.breakdown === 'function' ? descriptor.breakdown(parsed) : null
  };
}

function stateRow(descriptor, state) {
  const base = { id: descriptor.id, nameKey: descriptor.nameKey, source: 'state', storageKey: STORAGE_KEY, breakdown: null, noteKey: null };
  if (!state || typeof state !== 'object') return { ...base, count: null, bytes: null, lastModified: null, status: 'unavailable' };
  const slice = descriptor.slice(state);
  const list = arrayOf(slice);
  return {
    ...base,
    count: list.length,
    bytes: utf8ByteLength(JSON.stringify(slice ?? null)),
    lastModified: null,
    status: list.length > 0 ? 'ok' : 'empty'
  };
}

/**
 * Build the full telemetry report. Pure and read-only: it reads state
 * and raw storage text, and writes nothing.
 *
 * @param {{ state?: object|null, storage?: object|null }} input
 * @returns {{ rows: Array, totals: { ledgerCount: number, totalRecords: number, totalBytes: number, unreadableCount: number } }}
 */
export function buildSystemHealthReport({ state = null, storage = null } = {}) {
  const rows = [];

  // The main ledger container itself: its true on-disk footprint. Its
  // records are the state slices below, so its count stays null (the
  // container is not a record set of its own).
  const mainRaw = readRaw(storage, STORAGE_KEY);
  let mainStatus = 'empty';
  if (mainRaw) {
    try { JSON.parse(mainRaw); mainStatus = 'ok'; }
    catch { mainStatus = 'unreadable'; }
  }
  rows.push({
    id: 'main-ledger', nameKey: 'syshealth_ledger_main', source: 'storage', storageKey: STORAGE_KEY,
    count: null, bytes: mainRaw ? utf8ByteLength(mainRaw) : 0, lastModified: null,
    status: mainStatus, breakdown: null, noteKey: 'syshealth_note_main'
  });

  for (const descriptor of SYSTEM_HEALTH_STATE_LEDGERS) rows.push(stateRow(descriptor, state));

  // Splitters: no store exists on main — derived from customer records.
  rows.push({
    id: 'splitters', nameKey: 'syshealth_ledger_splitters', source: 'derived', storageKey: null,
    count: state && typeof state === 'object' ? countSplitterBoxes(state) : null,
    bytes: null, lastModified: null,
    status: state && typeof state === 'object' ? (countSplitterBoxes(state) > 0 ? 'ok' : 'empty') : 'unavailable',
    breakdown: null, noteKey: 'syshealth_note_derived'
  });

  for (const descriptor of SYSTEM_HEALTH_STORAGE_LEDGERS) rows.push(storageRow(descriptor, storage));

  const totals = {
    ledgerCount: rows.length,
    totalRecords: rows.reduce((sum, row) => sum + (Number.isFinite(row.count) ? row.count : 0), 0),
    totalBytes: rows.reduce((sum, row) => sum + (Number.isFinite(row.bytes) ? row.bytes : 0), 0),
    unreadableCount: rows.filter((row) => row.status === 'unreadable' || row.status === 'invalid-shape').length
  };
  return { rows, totals };
}

/** Compact summary for the dashboard card. */
export function summarizeSystemHealth(report) {
  const totals = report?.totals ?? { ledgerCount: 0, totalRecords: 0, totalBytes: 0, unreadableCount: 0 };
  return {
    ledgerCount: totals.ledgerCount,
    totalRecords: totals.totalRecords,
    totalBytes: totals.totalBytes,
    sizeLabel: formatBytes(totals.totalBytes),
    unreadableCount: totals.unreadableCount
  };
}

// ------------------------------------------------------------ integrity --
// The Master Integrity Check. Every check is grounded in a rule the
// app itself already enforces somewhere (core's duplicate-number
// handling, phase3's movement→item reference rule, group-billing's
// member resolution, referral-credits' party references, splitter
// one-customer-per-port semantics) — the check only surfaces drift,
// it never repairs it.

function parseStore(storage, key) {
  const raw = readRaw(storage, key);
  if (raw === null || raw === '') return { present: false, parsed: null, error: null };
  try { return { present: true, parsed: JSON.parse(raw), error: null }; }
  catch (error) { return { present: true, parsed: null, error }; }
}

export function runMasterIntegrityCheck({ state = null, storage = null } = {}) {
  const findings = [];
  const add = (severity, code, ledgerId, count) => findings.push({ severity, code, messageKey: `syshealth_finding_${code}`, ledgerId, count });

  // 1) Every registered store (and the main ledger file) must parse and
  //    hold the shape its owner module writes.
  const mainStore = parseStore(storage, STORAGE_KEY);
  if (mainStore.error) add('error', 'store_unparseable', 'main-ledger', 1);
  const parsedStores = new Map();
  for (const descriptor of SYSTEM_HEALTH_STORAGE_LEDGERS) {
    const result = parseStore(storage, descriptor.key);
    parsedStores.set(descriptor.id, result);
    if (result.error) { add('error', 'store_unparseable', descriptor.id, 1); continue; }
    if (!result.present) continue;
    const shapeOk = descriptor.shape === 'array'
      ? Array.isArray(result.parsed)
      : Boolean(result.parsed) && typeof result.parsed === 'object' && !Array.isArray(result.parsed);
    if (!shapeOk) add('error', 'store_wrong_shape', descriptor.id, 1);
  }

  // 2) State-resident checks.
  const customers = arrayOf(state?.customers);
  if (!state || typeof state !== 'object' || !Array.isArray(state.customers)) {
    add('error', 'state_shape', 'main-ledger', 1);
  } else {
    const numberCounts = new Map();
    for (const customer of customers) {
      if (Number.isSafeInteger(customer?.customerNumber)) {
        numberCounts.set(customer.customerNumber, (numberCounts.get(customer.customerNumber) ?? 0) + 1);
      }
    }
    const duplicateNumbers = [...numberCounts.values()].filter((count) => count > 1).length;
    if (duplicateNumbers > 0) add('error', 'duplicate_customer_number', 'customers', duplicateNumbers);

    let duplicateBillMonthCustomers = 0;
    for (const customer of customers) {
      const months = arrayOf(customer?.bills).map((bill) => bill?.month).filter((month) => typeof month === 'string' && month);
      if (new Set(months).size !== months.length) duplicateBillMonthCustomers++;
    }
    if (duplicateBillMonthCustomers > 0) add('warning', 'duplicate_bill_month', 'bills', duplicateBillMonthCustomers);

    const itemIds = new Set(arrayOf(state.inventoryItems).map((item) => String(item?.id ?? '')).filter(Boolean));
    const orphanMovements = arrayOf(state.inventoryMovements)
      .filter((movement) => !itemIds.has(String(movement?.itemId ?? ''))).length;
    if (orphanMovements > 0) add('error', 'orphan_inventory_movement', 'inventory-movements', orphanMovements);

    // Splitter one-customer-per-port: assignments beyond the first on
    // the same box + port are conflicts.
    const portOwners = new Map();
    let portConflicts = 0;
    for (const customer of customers) {
      const boxId = typeof customer?.splitterBoxId === 'string' ? customer.splitterBoxId.trim() : '';
      const port = Number(customer?.splitterPort);
      if (!boxId || !Number.isInteger(port) || port < 1 || port > 16) continue;
      const slot = `${boxId}#${port}`;
      if (portOwners.has(slot)) portConflicts++;
      else portOwners.set(slot, true);
    }
    if (portConflicts > 0) add('warning', 'splitter_port_conflict', 'splitters', portConflicts);
  }

  // 3) Cross-store reference checks (counts only — no names, no ids in
  //    the findings themselves).
  const customerIds = new Set(customers.map((customer) => String(customer?.id ?? '')).filter(Boolean));
  if (customerIds.size || parsedStores.get('billing-groups')?.present) {
    const groups = parsedStores.get('billing-groups');
    if (groups && !groups.error && Array.isArray(groups.parsed)) {
      let orphans = 0;
      for (const group of groups.parsed) {
        for (const memberId of arrayOf(group?.memberIds)) {
          if (!customerIds.has(String(memberId))) orphans++;
        }
      }
      if (orphans > 0) add('warning', 'orphan_group_member', 'billing-groups', orphans);
    }
    const referrals = parsedStores.get('referral-credits');
    if (referrals && !referrals.error && Array.isArray(referrals.parsed)) {
      let orphans = 0;
      for (const entry of referrals.parsed) {
        const referrer = String(entry?.referrerCustomerId ?? '');
        const referred = String(entry?.referredCustomerId ?? '');
        if ((referrer && !customerIds.has(referrer)) || (referred && !customerIds.has(referred))) orphans++;
      }
      if (orphans > 0) add('warning', 'orphan_referral_party', 'referral-credits', orphans);
    }
  }

  const errors = findings.filter((finding) => finding.severity === 'error').length;
  const warnings = findings.length - errors;
  return { findings, errors, warnings, healthy: errors === 0, checksRun: true };
}

// ---------------------------------------------------------------- markup --

function statusLabel(row, lang) {
  if (row.status === 'unreadable') return t('syshealth_status_unreadable', lang);
  if (row.status === 'invalid-shape') return t('syshealth_status_invalid', lang);
  if (row.status === 'unavailable') return t('syshealth_status_unavailable', lang);
  return '';
}

function rowMarkup(row, lang) {
  const name = t(row.nameKey, lang);
  const countText = Number.isFinite(row.count)
    ? t(row.count === 1 ? 'syshealth_record_sing' : 'syshealth_record_plur', lang, { count: row.count })
    : '—';
  const sizeText = Number.isFinite(row.bytes) ? formatBytes(row.bytes) : '—';
  const modifiedText = row.lastModified ? escapeHtml(row.lastModified) : '—';
  const status = statusLabel(row, lang);
  const breakdown = Array.isArray(row.breakdown) && row.breakdown.length
    ? row.breakdown.map((entry) => `<p><span>${escapeHtml(entry.label)}</span><strong>${escapeHtml(t(entry.count === 1 ? 'syshealth_record_sing' : 'syshealth_record_plur', lang, { count: entry.count }))}</strong></p>`).join('')
    : '';
  return `<article class="system-health-card${row.status === 'unreadable' || row.status === 'invalid-shape' ? ' system-health-card-alert' : ''}">
    <p><span>${escapeHtml(name)}</span><strong>${escapeHtml(countText)}</strong></p>
    <p><span>${escapeHtml(t('syshealth_size', lang))}</span><strong>${escapeHtml(sizeText)}</strong></p>
    <p><span>${escapeHtml(t('syshealth_modified', lang))}</span><strong>${modifiedText}</strong></p>
    ${status ? `<p><span>${escapeHtml(t('syshealth_status', lang))}</span><strong class="system-health-status-alert">${escapeHtml(status)}</strong></p>` : ''}
    ${row.noteKey ? `<p class="system-health-note">${escapeHtml(t(row.noteKey, lang))}</p>` : ''}
    ${breakdown}
  </article>`;
}

function integrityMarkup(integrity, report, lang) {
  if (!integrity) {
    return `<p class="system-health-note">${escapeHtml(t('syshealth_integrity_not_run', lang))}</p>`;
  }
  const nameByLedger = new Map((report?.rows ?? []).map((row) => [row.id, t(row.nameKey, lang)]));
  const summary = integrity.healthy && integrity.warnings === 0
    ? t('syshealth_integrity_healthy', lang)
    : t('syshealth_integrity_summary', lang, { errors: integrity.errors, warnings: integrity.warnings });
  const items = integrity.findings.map((finding) => {
    const ledgerName = nameByLedger.get(finding.ledgerId) ?? finding.ledgerId;
    const message = t(finding.messageKey, lang, { ledger: ledgerName, count: finding.count });
    return `<li>${finding.severity === 'error' ? '🔴' : '🟡'} ${escapeHtml(message)}</li>`;
  }).join('');
  return `<p class="system-health-integrity-summary" role="status">${escapeHtml(summary)}</p>${items ? `<ul class="system-health-findings">${items}</ul>` : ''}`;
}

/**
 * Full dialog body markup: totals line, integrity section, ledger
 * cards. All strings go through t(); owner data (shop names in the
 * breakdown) is rendered verbatim and escaped.
 */
export function buildSystemHealthMarkup(report, integrity = null, { lang = null } = {}) {
  const language = lang ?? getAppLanguage();
  const totals = report?.totals ?? { ledgerCount: 0, totalRecords: 0, totalBytes: 0, unreadableCount: 0 };
  const totalsText = t('syshealth_totals', language, {
    ledgers: totals.ledgerCount,
    records: totals.totalRecords,
    size: formatBytes(totals.totalBytes)
  });
  return `<p class="system-health-totals" role="status">${escapeHtml(totalsText)}</p>
    <h3 class="system-health-heading">${escapeHtml(t('syshealth_integrity_title', language))}</h3>
    ${integrityMarkup(integrity, report, language)}
    <h3 class="system-health-heading">${escapeHtml(t('syshealth_ledgers_title', language))}</h3>
    <div class="system-health-list">${(report?.rows ?? []).map((row) => rowMarkup(row, language)).join('')}</div>`;
}

// ------------------------------------------------------------- controller --

/**
 * Wires the System Health dialog (markup lives in index.html). The
 * controller re-reads live state + storage on every open, so counts
 * are always current. Archive Export delegates to app.js, which
 * reuses the shipped JSON backup download path unchanged.
 */
export function setupSystemHealthCenter({ getState, getStorage, onArchiveExport, onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('systemHealthModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let lastIntegrity = null;

  const storage = () => {
    try { return typeof getStorage === 'function' ? getStorage() : (typeof localStorage !== 'undefined' ? localStorage : null); }
    catch { return null; }
  };
  const state = () => {
    try { return typeof getState === 'function' ? getState() : null; } catch { return null; }
  };

  function render() {
    const body = $('systemHealthBody');
    if (!body) return;
    const report = buildSystemHealthReport({ state: state(), storage: storage() });
    body.innerHTML = buildSystemHealthMarkup(report, lastIntegrity, { lang: getAppLanguage() });
  }

  const checkBtn = $('systemHealthRunCheckBtn');
  if (checkBtn) checkBtn.addEventListener('click', () => {
    lastIntegrity = runMasterIntegrityCheck({ state: state(), storage: storage() });
    render();
    if (typeof onToast === 'function') {
      onToast(
        lastIntegrity.healthy && lastIntegrity.warnings === 0
          ? t('syshealth_integrity_healthy')
          : t('syshealth_integrity_summary', null, { errors: lastIntegrity.errors, warnings: lastIntegrity.warnings }),
        { type: lastIntegrity.healthy ? 'success' : 'warning', title: t('syshealth_title') }
      );
    }
  });

  const archiveBtn = $('systemHealthArchiveBtn');
  if (archiveBtn) archiveBtn.addEventListener('click', () => {
    if (typeof onArchiveExport === 'function') onArchiveExport();
  });

  const closeBtn = $('systemHealthCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openSystemHealthModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    lastIntegrity = null;
    render();
    dialog.showModal();
  });

  return {
    open() {
      lastIntegrity = null;
      render();
      dialog.showModal();
    },
    refresh: render
  };
}
