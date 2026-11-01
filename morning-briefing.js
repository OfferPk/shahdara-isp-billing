/**
 * morning-briefing.js — SISP-145: Morning Operational Briefing Card
 * (آج کا خلاصہ / صبح کی بریفنگ).
 *
 * A compact 4-pill strip at the top of Home plus a bilingual
 * [📋 Copy Morning Briefing for WhatsApp] text. ONE pure aggregator,
 * `buildMorningBriefing(state, today, extras)`, derives every figure from
 * the app's real engines — nothing is computed twice and nothing is stored:
 *
 *   1. Today's Expiring Waadas — SISP-3 promises (waada-queue.js semantics:
 *      the promise lives on the customer record and is live only while the
 *      customer still owes money). "Expiring today" = a valid promiseDate
 *      equal to today (PKT) with an outstanding balance > 0 per the core
 *      allocation engine (the exact per-customer outstanding rule
 *      dashboard-top-defaulters.js uses). Promises already settled are dead
 *      by that outstanding rule — a full payment auto-clears the promise in
 *      the app, and any stale promiseDate left behind has no balance, so it
 *      is never counted.
 *   2. Open Complaints & Installs — SISP-15 register summary
 *      (buildComplaintSummary: Open + In Progress = not Resolved) plus the
 *      Installation Tracker's pending requests (install-tracker.js
 *      requestStatus: no recorded install date = 'Pending').
 *   3. Unsettled Shop Cash — buildShopSummaries (shop-settlement.js) over
 *      recorded payments. Shop names are DERIVED from the data; no shop
 *      name is hardcoded anywhere in this module.
 *   4. Backup Health — the exact derivation app.js's top-bar badge uses:
 *      the SISP-10 health record (read by the host and passed in as
 *      extras.backupRecord, because the record lives in localStorage, not
 *      in app state) fed through assessBackupHealth with the same
 *      payments-since-export math (count-based when the record carries a
 *      count, date-based fallback for legacy records).
 *
 * The side stores (complaints / shop settlements / install requests) do not
 * live on app state, so the host passes them in via `extras` — the same
 * enriched-extras pattern the dashboard already uses (app.js line ~1077).
 *
 * Rendering + text are read-only: building or copying a briefing mutates
 * nothing. The copy text NEVER includes phone numbers; it does list today's
 * waada customer names because the waada derivation already walks those
 * customers (name + connection number + promised amount when recorded).
 */

import { calculatePaymentAllocations, formatPKR } from './core.js';
import { getWaadaTodayString, isValidWaadaDate } from './waada-queue.js';
import { buildComplaintSummary } from './complaint-register.js';
import { buildShopSummaries } from './shop-settlement.js';
import { requestStatus } from './install-tracker.js';
import { assessBackupHealth, countAllPayments, countPaymentsAfterDate } from './backup-health.js';
import { displayCustomerName } from './urdu-names.js';
import { t } from './nav-language.js';

/** Accepts a Date, a YYYY-MM-DD string, or nothing (→ PKT today). */
export function morningBriefingDateStr(today) {
  if (typeof today === 'string' && isValidWaadaDate(today.trim())) return today.trim();
  if (today instanceof Date && !Number.isNaN(today.getTime())) return getWaadaTodayString(today);
  return getWaadaTodayString(new Date());
}

// Per-customer outstanding in cents — mirrors dashboard-top-defaulters.js:
// allocation-engine balance per bill month, falling back to the bill's due
// amount when the engine has no priced balance for that month.
function customerOutstandingCents(allocations, customer) {
  let cents = 0;
  for (const bill of Array.isArray(customer?.bills) ? customer.bills : []) {
    const summary = allocations?.forMonth?.(customer.id, bill.month);
    const balance = summary?.balanceDueCents !== null && summary?.balanceDueCents !== undefined
      ? summary.balanceDueCents
      : Math.round(Number(bill.dueAmount || bill.amount || 0) * 100);
    if (balance > 0) cents += balance;
  }
  return cents;
}

/**
 * Pure aggregator. `today` = Date | 'YYYY-MM-DD' (PKT). `extras`:
 * { complaints, settlements, installRequests, backupRecord, now } — the
 * side-store rows + SISP-10 health record the host loaded; `now` is the
 * reference instant for the backup-age math (defaults to `today`/now).
 */
export function buildMorningBriefing(state = {}, today = new Date(), extras = {}) {
  const safeState = state && typeof state === 'object' ? state : {};
  const dateStr = morningBriefingDateStr(today);
  const now = extras?.now instanceof Date && !Number.isNaN(extras.now.getTime())
    ? extras.now
    : (today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date());

  // --- 1. Waadas expiring today -------------------------------------------
  const allocations = calculatePaymentAllocations({ customers: Array.isArray(safeState.customers) ? safeState.customers : [] });
  const waadaEntries = [];
  for (const customer of Array.isArray(safeState.customers) ? safeState.customers : []) {
    if (!customer || customer.archived) continue;
    const promiseDate = typeof customer.promiseDate === 'string' ? customer.promiseDate.trim() : '';
    if (!promiseDate || !isValidWaadaDate(promiseDate) || promiseDate !== dateStr) continue;
    if (customerOutstandingCents(allocations, customer) <= 0) continue;
    const amount = Number(customer.promiseAmount);
    waadaEntries.push({
      customerId: customer.id,
      customerNumber: customer.customerNumber ?? null,
      name: String(customer.name ?? ''),
      nameUrdu: String(customer.nameUrdu ?? ''),
      promiseAmount: Number.isFinite(amount) && amount > 0 ? amount : null
    });
  }
  waadaEntries.sort((a, b) => Number(a.customerNumber ?? 0) - Number(b.customerNumber ?? 0));
  const waadas = {
    count: waadaEntries.length,
    totalPromised: waadaEntries.reduce((sum, entry) => sum + (entry.promiseAmount ?? 0), 0),
    entries: waadaEntries
  };

  // --- 2. Open complaints & pending installs -------------------------------
  const complaintSummary = buildComplaintSummary(Array.isArray(extras?.complaints) ? extras.complaints : [], now);
  const pendingInstalls = (Array.isArray(extras?.installRequests) ? extras.installRequests : [])
    .filter((request) => requestStatus(request) === 'Pending').length;
  const work = {
    openComplaints: complaintSummary.open,
    inProgressComplaints: complaintSummary.inProgress,
    openTotal: complaintSummary.open + complaintSummary.inProgress,
    pendingInstalls
  };

  // --- 3. Unsettled shop cash (shops derived from recorded payments) -------
  const shopSummaries = buildShopSummaries(safeState, Array.isArray(extras?.settlements) ? extras.settlements : [], now);
  const shopLines = shopSummaries
    .filter((summary) => Number(summary.unsettled) > 0)
    .map((summary) => ({ shop: summary.shop, unsettled: Math.round(Number(summary.unsettled) * 100) / 100 }));
  const shops = {
    totalUnsettled: Math.round(shopLines.reduce((sum, line) => sum + line.unsettled, 0) * 100) / 100,
    lines: shopLines
  };

  // --- 4. Backup health (app.js top-bar badge derivation, unchanged) -------
  const record = extras?.backupRecord && typeof extras.backupRecord === 'object'
    ? extras.backupRecord
    : { lastExportAt: null, paymentCountAtExport: null };
  let paymentsSinceExport = null;
  if (Number.isSafeInteger(record.paymentCountAtExport)) {
    paymentsSinceExport = Math.max(0, countAllPayments(safeState) - record.paymentCountAtExport);
  } else if (record.lastExportAt) {
    paymentsSinceExport = countPaymentsAfterDate(safeState, String(record.lastExportAt).slice(0, 10));
  }
  const health = assessBackupHealth({ lastExportAt: record.lastExportAt ?? null, paymentsSinceExport, now });
  const backup = {
    status: health.status,
    stateKey: record.lastExportAt ? health.status : 'never',
    emoji: health.emoji,
    lastExportAt: record.lastExportAt ?? null,
    paymentsSinceExport
  };

  return { dateStr, waadas, work, shops, backup };
}

/** Localized short label for the backup state key (pill + copy text). */
export function morningBriefingBackupLabel(briefing, lang = null) {
  const key = {
    never: 'brief_backup_never',
    safe: 'brief_backup_safe',
    due: 'brief_backup_due',
    critical: 'brief_backup_critical'
  }[briefing?.backup?.stateKey] || 'brief_backup_never';
  return t(key, lang);
}

/**
 * Bilingual WhatsApp copy text: a full English block, then a full Urdu
 * block (the house bilingual-artifact precedent), figures identical in
 * both. Contains names + connection numbers for today's waadas and the
 * per-shop unsettled lines — never any phone number.
 */
export function buildMorningBriefingText(briefing) {
  if (!briefing) return '';
  const block = (lang) => {
    const lines = [t('brief_text_title', lang, { date: briefing.dateStr })];
    if (briefing.waadas.count > 0) {
      lines.push(t('brief_text_waada', lang, { count: briefing.waadas.count }));
      for (const entry of briefing.waadas.entries) {
        const name = displayCustomerName(entry, lang);
        lines.push(entry.promiseAmount !== null
          ? t('brief_text_waada_line', lang, { number: entry.customerNumber ?? '', name, amount: formatPKR(entry.promiseAmount) })
          : t('brief_text_waada_line_no_amount', lang, { number: entry.customerNumber ?? '', name }));
      }
    } else {
      lines.push(t('brief_text_waada_none', lang));
    }
    lines.push(t('brief_text_work', lang, { complaints: briefing.work.openTotal, installs: briefing.work.pendingInstalls }));
    if (briefing.shops.lines.length > 0) {
      lines.push(t('brief_text_shops', lang, { total: formatPKR(briefing.shops.totalUnsettled) }));
      for (const line of briefing.shops.lines) {
        lines.push(t('brief_text_shop_line', lang, { shop: line.shop, amount: formatPKR(line.unsettled) }));
      }
    } else {
      lines.push(t('brief_text_shops_none', lang));
    }
    const backupLine = t('brief_text_backup', lang, { state: morningBriefingBackupLabel(briefing, lang) });
    lines.push(briefing.backup.lastExportAt
      ? `${backupLine} · ${t('brief_text_backup_last', lang, { date: String(briefing.backup.lastExportAt).slice(0, 10) })}`
      : backupLine);
    return lines.join('\n');
  };
  return `${block('en')}\n\n${block('ur')}`;
}

/**
 * Fills the strip's value elements by id (markup lives in index.html, the
 * renderHomeTodaySummary pattern). Returns false when the strip is absent.
 */
export function renderMorningBriefing(doc = document, briefing) {
  if (!doc || !briefing) return false;
  const root = doc.getElementById('morningBriefingSection');
  if (!root) return false;

  const setText = (id, value) => {
    const el = doc.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('briefWaadaValue', String(briefing.waadas.count));
  setText('briefWaadaSub', briefing.waadas.count === 0
    ? t('brief_waada_none')
    : (briefing.waadas.totalPromised > 0
      ? t('brief_waada_promised', null, { amount: formatPKR(briefing.waadas.totalPromised) })
      : t('brief_waada_today')));

  setText('briefWorkValue', String(briefing.work.openTotal + briefing.work.pendingInstalls));
  setText('briefWorkSub', t('brief_work_sub', null, {
    complaints: briefing.work.openTotal,
    installs: briefing.work.pendingInstalls
  }));

  setText('briefShopValue', formatPKR(briefing.shops.totalUnsettled));
  setText('briefShopSub', briefing.shops.lines.length > 0
    ? t('brief_shop_pending', null, { count: briefing.shops.lines.length })
    : t('brief_shop_none'));

  setText('briefBackupValue', `${briefing.backup.emoji} ${morningBriefingBackupLabel(briefing)}`);
  setText('briefBackupSub', briefing.backup.lastExportAt
    ? t('brief_backup_last', null, { date: String(briefing.backup.lastExportAt).slice(0, 10) })
    : t('brief_backup_never_sub'));

  const backupPill = doc.getElementById('briefPillBackup');
  if (backupPill) {
    backupPill.classList.remove('pill-safe', 'pill-due', 'pill-critical', 'pill-never');
    backupPill.classList.add(`pill-${briefing.backup.stateKey}`);
  }
  return true;
}
