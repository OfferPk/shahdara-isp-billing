/**
 * partner-settlement.js — SISP-22: Nasir & Aqib 50/50 Partner Drawings,
 * Capital Outlay & Monthly Settlement Ledger.
 *
 * Problem: the PR #395 partner-share tabs show each partner's 50% share of
 * a month's profit, but nothing recorded what happened mid-month — cash a
 * partner drew from the business, or ISP purchases a partner paid for out
 * of personal funds. Without those, the share figure is not the amount
 * actually payable, and month-end settlement was done from memory.
 *
 * This module is the ledger for those two mid-month movements plus the
 * monthly settlement slip:
 *
 * - Partner Transactions Ledger (localStorage key sisp_partner_ledger_v1):
 *   one entry per movement — partner (Nasir/Aqib), type
 *   (drawing = cash taken by the partner, capital = out-of-pocket ISP
 *   purchase paid by the partner), amount, date, optional note.
 *   Entries are editable and deletable; they never touch bills, receipts
 *   or expenses, and they never seed or guess real data.
 * - Automated 50/50 reconciliation per selected month, REUSED from
 *   buildPartnerShareReport (phase3.js, PR #395): revenue is saved
 *   receipts grouped by payment date, profit = revenue − expenses,
 *   share = 50% of positive profit (PARTNER_SHARE_RATE = 0.5), else 0.
 *   Nothing about profit is recomputed here in parallel. For each
 *   partner: Net Payout = share + capital − drawings. A negative net
 *   payout is shown as a Receivable (the partner owes the business),
 *   never hidden and never silently clamped to zero.
 * - Partner Settlement Slip (localStorage key
 *   sisp_partner_settlements_v1): a saved, re-openable confirmation of
 *   one month's payout figures. Confirming a slip only saves the slip
 *   record — it never alters underlying bills, receipts or expenses,
 *   and re-opening it replaces the slip for that month, not the ledger.
 *
 * SISP-114: an OPTIONAL charity / sadqah & emergency reserve percentage
 * (charity-reserve.js, device setting, default 0 = off) may be passed
 * to buildPartnerSettlementReport (options.charityReservePct, or a
 * bare number as the fifth argument). When it is > 0 and the month is
 * in profit, round(distributableProfit * pct / 100) is set aside BEFORE
 * the 50/50 split — the base is the SISP-73 distributable profit, i.e.
 * profit minus the installation subsidy when the CapEx toggle is ON —
 * each partner's share becomes 50% of the remainder and the report
 * gains charityReservePct / charityReserve fields (its
 * distributableProfit then reads as the post-reserve remainder), which
 * a confirmed slip then records for audit. At 0% (or when the argument
 * is omitted) the report, the slips and the WhatsApp text are
 * byte-identical to the SISP-73 output. The reserve itself is a
 * derived figure — no money record is stored.
 *
 * - SISP-68: shop handovers a partner kept (SISP-1 settlements stamped
 *   receivedInto) are mirrored into this ledger as linked drawings by
 *   syncShopPickupDrawings — a convergent reconcile keyed by the
 *   settlement id, so a pickup is counted in the reconciliation exactly
 *   once no matter how often the sync runs.
 *
 * Backup: both record sets travel inside JSON backups via the
 * `settings.partnerLedger` / `settings.partnerSettlements` sections (see
 * core.js createJsonBackup / previewJsonBackupMerge, same safe-merge rule
 * as SISP-1 shop settlements: adopt the backup's records only when this
 * device has none stored yet; differing records on both sides are kept
 * as a conflict, never overwritten).
 *
 * SISP-73 adds the Installation CapEx toggle (settings key
 * sisp_partner_settings_v1, travelling as `settings.partnerSettings`):
 * the month's NET installation surplus/subsidy comes from SISP-23's
 * installation-cost accounting (buildMonthlyInstallationSummary in
 * installation-cost.js — the spec's connection-profitability.js never
 * existed on main; installation-cost.js is the real SISP-23 source).
 * With the toggle ON, the month's net subsidy is deducted from the
 * month's profit BEFORE the 50/50 split, so the distributable profit —
 * and each partner's share — falls by exactly the subsidy. With it OFF
 * (the default), the installation figures are still computed and shown,
 * tracked separately, and the split is byte-for-byte the PR #395 rule:
 * share = 50% of positive profit, 0 on a loss month.
 *
 * This module imports nothing from core.js on purpose: core.js imports
 * the sanitizers from here for backup restore, and a core import here
 * would create a module cycle. All helpers are pure except the
 * load/save functions. Tests use synthetic data only.
 */

import { buildPartnerShareReport, PARTNER_SHARE_RATE } from './phase3.js';
import { computeCharityReserve, sanitizeCharityReservePct } from './charity-reserve.js';
import { buildMonthlyInstallationSummary } from './installation-cost.js';

export const PARTNER_LEDGER_KEY = 'sisp_partner_ledger_v1';
export const PARTNER_SETTLEMENTS_KEY = 'sisp_partner_settlements_v1';
export const PARTNER_SETTINGS_KEY = 'sisp_partner_settings_v1';
export const PARTNERS = Object.freeze(['Nasir', 'Aqib']);
export const PARTNER_LEDGER_TYPES = Object.freeze(['drawing', 'capital']);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function wholeRupees(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function validDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function canonicalPartner(value) {
  const cleaned = String(value ?? '').trim();
  const match = PARTNERS.find((name) => name.toLowerCase() === cleaned.toLowerCase());
  return match ?? null;
}

function entryId() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return `partner-ledger-${globalThis.crypto.randomUUID()}`;
    }
  } catch { /* fall through */ }
  return `partner-ledger-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

export function formatPartnerPKR(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `Rs. ${formatter.format(amount)}`;
}

export function partnerMonthLabel(month) {
  if (!MONTH_RE.test(String(month || ''))) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${month}-01T00:00:00Z`));
  } catch {
    return String(month);
  }
}

/**
 * SISP-73: the partner settings object — today it carries only the
 * Installation CapEx split toggle. Default OFF: the PR #395 50/50 rule
 * applies untouched until the owner explicitly includes installation
 * CapEx in the split. Anything but a literal boolean true sanitizes to
 * false, so a corrupt or hand-edited store can never silently change
 * how profit is split.
 */
export function sanitizePartnerSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { includeInstallationCapexInSplit: source.includeInstallationCapexInSplit === true };
}

/** Reads partner settings; defaults (toggle OFF) on missing/corrupt storage. */
export function loadPartnerSettings(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return sanitizePartnerSettings(null);
    const raw = store.getItem(PARTNER_SETTINGS_KEY);
    if (!raw) return sanitizePartnerSettings(null);
    return sanitizePartnerSettings(JSON.parse(raw));
  } catch {
    return sanitizePartnerSettings(null);
  }
}

/** Persists partner settings (sanitized first); never throws. */
export function savePartnerSettings(settings, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(PARTNER_SETTINGS_KEY, JSON.stringify(sanitizePartnerSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

/** Drops malformed ledger entries; keeps only known fields. */
export function sanitizePartnerLedgerEntries(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const partner = canonicalPartner(entry.partner);
    const type = String(entry.type ?? '').trim().toLowerCase();
    const amount = Number(entry.amount);
    if (!partner) continue;
    if (type !== 'drawing' && type !== 'capital') continue;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (!validDate(entry.date)) continue;
    // SISP-68: shop-pickup mirror entries carry their link back to the
    // SISP-1 settlement record (source + settlementId) so the reconcile
    // below can own them. Manual entries never carry these fields.
    const linked = entry.source === SHOP_PICKUP_SOURCE
      && typeof entry.settlementId === 'string' && entry.settlementId
      ? { source: SHOP_PICKUP_SOURCE, settlementId: entry.settlementId }
      : {};
    out.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : entryId(),
      partner,
      type,
      amount: wholeRupees(amount),
      date: entry.date,
      month: entry.date.slice(0, 7),
      note: typeof entry.note === 'string' ? entry.note : '',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      ...linked
    });
  }
  return out;
}

/** Reads ledger entries; [] on missing/corrupt storage. */
export function loadPartnerLedgerEntries(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(PARTNER_LEDGER_KEY);
    if (!raw) return [];
    return sanitizePartnerLedgerEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists ledger entries; never throws. */
export function savePartnerLedgerEntries(entries, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(PARTNER_LEDGER_KEY, JSON.stringify(sanitizePartnerLedgerEntries(entries)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates one ledger entry's fields (throws on the first problem, so the
 * UI can show the message) and returns the cleaned entry. `existingId`
 * keeps an edit on the same id; a new entry gets a fresh id.
 */
export function cleanPartnerLedgerEntry(input, existingId = null) {
  const partner = canonicalPartner(input?.partner);
  if (!partner) throw new Error('Choose a partner: Nasir or Aqib.');
  const type = String(input?.type ?? '').trim().toLowerCase();
  if (type !== 'drawing' && type !== 'capital') throw new Error('Choose a type: drawing or capital outlay.');
  const amount = Number(input?.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.');
  if (!validDate(input?.date)) throw new Error('Choose a valid date.');
  return {
    id: typeof existingId === 'string' && existingId ? existingId : entryId(),
    partner,
    type,
    amount: wholeRupees(amount),
    date: input.date,
    month: input.date.slice(0, 7),
    note: typeof input?.note === 'string' ? input.note.trim().slice(0, 500) : '',
    createdAt: typeof input?.createdAt === 'string' && input.createdAt ? input.createdAt : new Date().toISOString()
  };
}

/** Pure: inserts or replaces one entry (by id), newest date first. */
export function upsertPartnerLedgerEntry(entries, entry) {
  const cleaned = sanitizePartnerLedgerEntries([entry]);
  if (!cleaned.length) throw new Error('That partner entry is not valid.');
  const rest = sanitizePartnerLedgerEntries(entries).filter((row) => row.id !== cleaned[0].id);
  return [...rest, cleaned[0]].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** Pure: removes one entry by id. */
export function deletePartnerLedgerEntry(entries, id) {
  return sanitizePartnerLedgerEntries(entries).filter((row) => row.id !== id);
}

/**
 * SISP-68: Shop Cash Handover → Partner Pickup Attribution.
 *
 * When a shop handover is recorded with "Received Into: Kept by Nasir /
 * Aqib" (shop-settlement.js stamps receivedInto on the settlement
 * record), the cash never reaches the Roznamcha drawer — the partner
 * holds it, which is exactly a mid-month drawing. This reconcile mirrors
 * every partner-kept settlement as exactly ONE ledger drawing:
 *
 * - deterministic id `partner-ledger-shop-<settlementId>` plus the
 *   source/settlementId link fields, so the mirror is keyed by the
 *   settlement record, never by amount or date;
 * - convergent, in the SISP-45/56 shape: a re-run with unchanged inputs
 *   reports changed:false, a corrected settlement updates its drawing in
 *   place, and a settlement that disappears (or returns to the drawer)
 *   removes its drawing. Manual ledger entries are never touched;
 * - the drawing is an ordinary type:'drawing' entry, so the monthly
 *   reconciliation above (and the SISP-60 voucher book) count it exactly
 *   once with no parallel computation.
 */
export const SHOP_PICKUP_SOURCE = 'shop-settlement';

export function shopPickupDrawingId(settlementId) {
  return `partner-ledger-shop-${settlementId}`;
}

/** True for ledger entries owned by the shop-pickup mirror. */
export function isShopPickupEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.source === SHOP_PICKUP_SOURCE && typeof entry.settlementId === 'string' && entry.settlementId) return true;
  return typeof entry.id === 'string' && entry.id.startsWith('partner-ledger-shop-');
}

function pickupForSettlement(record) {
  if (!record || typeof record !== 'object') return null;
  const into = String(record.receivedInto ?? '').trim().toLowerCase();
  const partner = into === 'nasir' ? 'Nasir' : into === 'aqib' ? 'Aqib' : null;
  if (!partner) return null;
  if (typeof record.id !== 'string' || !record.id) return null;
  const amount = wholeRupees(record.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!validDate(record.date)) return null;
  return {
    settlementId: record.id,
    partner,
    amount,
    date: record.date,
    shop: typeof record.shop === 'string' && record.shop ? record.shop : 'Shop',
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : ''
  };
}

function shopPickupEntry(pickup) {
  return {
    id: shopPickupDrawingId(pickup.settlementId),
    partner: pickup.partner,
    type: 'drawing',
    amount: pickup.amount,
    date: pickup.date,
    month: pickup.date.slice(0, 7),
    note: `Shop cash pickup — ${pickup.shop} handover (${pickup.settlementId})`,
    createdAt: pickup.createdAt,
    source: SHOP_PICKUP_SOURCE,
    settlementId: pickup.settlementId
  };
}

export function syncShopPickupDrawings(entries, settlements) {
  const current = sanitizePartnerLedgerEntries(entries);
  const desired = new Map();
  for (const record of (Array.isArray(settlements) ? settlements : [])) {
    const pickup = pickupForSettlement(record);
    if (pickup && !desired.has(pickup.settlementId)) desired.set(pickup.settlementId, pickup);
  }
  let added = 0;
  let updated = 0;
  let removed = 0;
  const seen = new Set();
  const next = [];
  for (const row of current) {
    if (!isShopPickupEntry(row)) { next.push(row); continue; }
    const linkedId = typeof row.settlementId === 'string' && row.settlementId
      ? row.settlementId
      : row.id.slice('partner-ledger-shop-'.length);
    const want = desired.get(linkedId);
    if (!want || seen.has(linkedId)) { removed += 1; continue; }
    seen.add(linkedId);
    const synced = shopPickupEntry(want);
    const identical = row.id === synced.id
      && row.partner === synced.partner
      && row.type === 'drawing'
      && row.amount === synced.amount
      && row.date === synced.date
      && row.note === synced.note
      && row.source === SHOP_PICKUP_SOURCE
      && row.settlementId === synced.settlementId;
    if (identical) next.push(row);
    else { updated += 1; next.push(synced); }
  }
  for (const [settlementId, want] of desired) {
    if (seen.has(settlementId)) continue;
    seen.add(settlementId);
    added += 1;
    next.push(shopPickupEntry(want));
  }
  next.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return { entries: next, changed: added + updated + removed > 0, added, updated, removed };
}

/** Entries whose date falls in `month` (YYYY-MM), newest first. */
export function entriesForMonth(entries, month) {
  if (!MONTH_RE.test(String(month || ''))) return [];
  return sanitizePartnerLedgerEntries(entries)
    .filter((row) => row.month === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** { drawings, capital } totals for one partner in one month. */
export function totalsForPartner(entries, month, partner) {
  const canonical = canonicalPartner(partner);
  if (!canonical) return { drawings: 0, capital: 0, drawingCount: 0, capitalCount: 0 };
  let drawings = 0;
  let capital = 0;
  let drawingCount = 0;
  let capitalCount = 0;
  for (const row of entriesForMonth(entries, month)) {
    if (row.partner !== canonical) continue;
    if (row.type === 'drawing') { drawings += row.amount; drawingCount += 1; }
    if (row.type === 'capital') { capital += row.amount; capitalCount += 1; }
  }
  return { drawings, capital, drawingCount, capitalCount };
}

/**
 * Pure: the monthly 50/50 reconciliation. Profit, revenue, expenses and
 * the per-partner share come verbatim from buildPartnerShareReport —
 * nothing is recomputed here. Net Payout = share + capital − drawings.
 * A negative net payout is reported as a Receivable (partner owes the
 * business) with its full amount; it is never clamped to zero.
 *
 * SISP-73: `options.includeInstallationCapexInSplit` (the persisted
 * partner-settings toggle, passed in by the caller) deducts the month's
 * net installation subsidy (buildMonthlyInstallationSummary, SISP-23
 * accounting) from the profit before the split: distributable profit =
 * profit − subsidy, share = 50% of positive distributable profit, else
 * 0 — the PR #395 rule applied to the adjusted figure, so a loss month
 * (or a subsidy that wipes the profit out) still pays 0. Without the
 * option the report is exactly the pre-SISP-73 one.
 *
 * SISP-114: `options.charityReservePct` (or a bare number passed as the
 * fifth argument, the original SISP-114 calling convention) sets aside
 * that percentage of the distributable profit above as a charity /
 * sadqah & emergency reserve before the split — see charity-reserve.js.
 * At 0% / omitted the report is exactly the SISP-73 one.
 */
export function buildPartnerSettlementReport(state, selectedMonth, entries, referenceDate = new Date(), options = {}) {
  const shareReport = buildPartnerShareReport(state, selectedMonth, referenceDate);
  const month = shareReport.month;
  const summary = shareReport.summary || {};
  const monthEntries = entriesForMonth(entries, month);
  const installation = buildMonthlyInstallationSummary(state?.customers, month);
  const installationCapex = {
    included: Boolean(options && typeof options === 'object' && options.includeInstallationCapexInSplit === true),
    installCount: installation.installCount,
    recordedCount: installation.recordedCount,
    connectionFees: wholeRupees(installation.connectionFees),
    totalCost: wholeRupees(installation.totalCost),
    net: wholeRupees(installation.net),
    surplus: wholeRupees(installation.surplus),
    subsidy: wholeRupees(installation.subsidy),
    hasPartial: installation.hasPartial === true
  };
  const profit = wholeRupees(summary.profit || 0);
  const distributableProfit = installationCapex.included ? profit - installationCapex.subsidy : profit;
  // SISP-114 (merge composition with SISP-73): optional charity /
  // sadqah reserve, set aside BEFORE the 50/50 split and computed on
  // the SISP-73 distributable profit above — the percentage applies to
  // profit minus any installation subsidy when the CapEx toggle is ON,
  // never to raw profit; at 0% any ordering is identical. pct 0 /
  // omitted -> charity stays null and every figure below is exactly
  // the SISP-73 one (no new report keys either).
  const pct = sanitizeCharityReservePct(typeof options === 'number' ? options : (options && typeof options === 'object' ? options.charityReservePct : 0));
  const charity = pct > 0 ? computeCharityReserve(distributableProfit, pct) : null;
  const share = charity
    ? charity.shareEach
    : installationCapex.included
      ? (distributableProfit > 0 ? Math.round(distributableProfit * PARTNER_SHARE_RATE) : 0)
      : wholeRupees(summary.share || 0);
  const perPartner = PARTNERS.map((partner) => {
    const totals = totalsForPartner(entries, month, partner);
    const netPayout = share + totals.capital - totals.drawings;
    return {
      partner,
      share,
      drawings: totals.drawings,
      capital: totals.capital,
      drawingCount: totals.drawingCount,
      capitalCount: totals.capitalCount,
      netPayout,
      isReceivable: netPayout < 0,
      receivableAmount: netPayout < 0 ? -netPayout : 0,
      payableAmount: netPayout >= 0 ? netPayout : 0
    };
  });
  const report = {
    month,
    months: shareReport.months || [],
    revenue: wholeRupees(summary.revenue || 0),
    expenses: wholeRupees(summary.expenses || 0),
    profit,
    isLoss: summary.isLoss === true,
    share,
    distributableProfit,
    installationCapex,
    receiptCount: summary.receiptCount || 0,
    expenseCount: summary.expenseCount || 0,
    entries: monthEntries,
    perPartner,
    totalDrawings: perPartner.reduce((sum, row) => sum + row.drawings, 0),
    totalCapital: perPartner.reduce((sum, row) => sum + row.capital, 0),
    totalNetPayout: perPartner.reduce((sum, row) => sum + row.netPayout, 0),
    basis: installationCapex.included
      ? 'Profit, revenue and expenses are reused from the partner-share report (saved receipts by payment date minus dated expenses). Installation CapEx is INCLUDED in the split: the month’s net installation subsidy (SISP-23 installation-cost accounting) is deducted first, and the share is 50% of the remaining distributable profit, else 0. Net payout = share + out-of-pocket purchases − mid-month drawings. A negative net payout is a receivable: the partner owes the business that amount.'
      : 'Profit, revenue and expenses are reused from the partner-share report (saved receipts by payment date minus dated expenses; share = 50% of positive profit, else 0). Net payout = share + out-of-pocket purchases − mid-month drawings. A negative net payout is a receivable: the partner owes the business that amount.'
  };
  // SISP-114: the reserve fields exist ONLY when a reserve was actually
  // set aside, so a 0% report stays byte-identical to the old shape.
  if (charity && charity.charityReserve > 0) {
    report.charityReservePct = charity.charityReservePct;
    report.charityReserve = charity.charityReserve;
    report.distributableProfit = charity.distributableProfit;
    report.basis += ` Charity / Sadqah & Emergency Reserve: ${charity.charityReservePct}% of the distributable profit (${formatPartnerPKR(charity.charityReserve)}) is set aside BEFORE the 50/50 split, so each share above is 50% of the remaining ${formatPartnerPKR(charity.distributableProfit)}. The reserve is a computed figure only — no money record is stored.`;
  }
  return report;
}

/** Drops malformed settlement slips; keeps only known fields. */
export function sanitizePartnerSettlements(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const record of value) {
    if (!record || typeof record !== 'object') continue;
    if (!MONTH_RE.test(String(record.month || ''))) continue;
    const rows = Array.isArray(record.perPartner) ? record.perPartner : [];
    const perPartner = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const partner = canonicalPartner(row.partner);
      if (!partner) continue;
      const share = Number(row.share);
      const drawings = Number(row.drawings);
      const capital = Number(row.capital);
      const netPayout = Number(row.netPayout);
      if (![share, drawings, capital, netPayout].every(Number.isFinite)) continue;
      perPartner.push({ partner, share: wholeRupees(share), drawings: wholeRupees(drawings), capital: wholeRupees(capital), netPayout: wholeRupees(netPayout) });
    }
    if (perPartner.length === 0) continue;
    const slip = {
      id: typeof record.id === 'string' && record.id ? record.id : `partner-settle-${record.month}`,
      month: record.month,
      revenue: wholeRupees(record.revenue),
      expenses: wholeRupees(record.expenses),
      profit: wholeRupees(record.profit),
      // SISP-73 audit fields: the subsidy the split was charged with and
      // whether the CapEx toggle was ON when the slip was confirmed.
      // Slips saved before SISP-73 sanitize to 0 / false.
      installationSubsidy: wholeRupees(record.installationSubsidy),
      installationCapexIncluded: record.installationCapexIncluded === true,
      perPartner,
      note: typeof record.note === 'string' ? record.note : '',
      status: record.status === 'reopened' ? 'reopened' : 'confirmed',
      confirmedAt: typeof record.confirmedAt === 'string' ? record.confirmedAt : '',
      reopenedAt: typeof record.reopenedAt === 'string' ? record.reopenedAt : '',
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : ''
    };
    // SISP-114: a slip keeps its charity reserve audit figures only
    // when a reserve was genuinely set aside for that month; legacy
    // slips sanitize byte-identically (no new keys appear).
    const slipCharityPct = Number(record.charityReservePct);
    const slipCharityAmount = Number(record.charityReserve);
    if (Number.isFinite(slipCharityPct) && slipCharityPct > 0 && Number.isFinite(slipCharityAmount) && slipCharityAmount > 0) {
      slip.charityReservePct = sanitizeCharityReservePct(slipCharityPct);
      slip.charityReserve = wholeRupees(slipCharityAmount);
    }
    out.push(slip);
  }
  return out;
}

/** Reads settlement slips; [] on missing/corrupt storage. */
export function loadPartnerSettlements(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(PARTNER_SETTLEMENTS_KEY);
    if (!raw) return [];
    return sanitizePartnerSettlements(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists settlement slips; never throws. */
export function savePartnerSettlements(settlements, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(PARTNER_SETTLEMENTS_KEY, JSON.stringify(sanitizePartnerSettlements(settlements)));
    return true;
  } catch {
    return false;
  }
}

/** The saved slip for `month`, or null. */
export function settlementForMonth(settlements, month) {
  if (!MONTH_RE.test(String(month || ''))) return null;
  return sanitizePartnerSettlements(settlements).find((row) => row.month === month) || null;
}

/**
 * Pure: builds the slip record for a report. Saving it (via
 * savePartnerSettlements) never alters bills, receipts or expenses.
 * Re-confirming a month replaces that month's slip only.
 */
export function createPartnerSettlement(report, { note = '', confirmedAt = null } = {}) {
  if (!report || !MONTH_RE.test(String(report.month || ''))) throw new Error('Choose a valid month to settle.');
  const now = confirmedAt || new Date().toISOString();
  const slip = {
    id: `partner-settle-${report.month}`,
    month: report.month,
    revenue: wholeRupees(report.revenue),
    expenses: wholeRupees(report.expenses),
    profit: wholeRupees(report.profit),
    installationSubsidy: wholeRupees(report.installationCapex?.subsidy || 0),
    installationCapexIncluded: report.installationCapex?.included === true,
    perPartner: (report.perPartner || []).map((row) => ({
      partner: row.partner,
      share: wholeRupees(row.share),
      drawings: wholeRupees(row.drawings),
      capital: wholeRupees(row.capital),
      netPayout: wholeRupees(row.netPayout)
    })),
    note: String(note || '').trim().slice(0, 500),
    status: 'confirmed',
    confirmedAt: now,
    reopenedAt: '',
    createdAt: now
  };
  // SISP-114: record the reserve on the slip only when one was set
  // aside, so the locked figures stay auditable later.
  if (Number(report.charityReserve) > 0 && Number(report.charityReservePct) > 0) {
    slip.charityReservePct = sanitizeCharityReservePct(report.charityReservePct);
    slip.charityReserve = wholeRupees(report.charityReserve);
  }
  return slip;
}

/** Pure: replaces (or adds) the slip for its month. */
export function upsertPartnerSettlement(settlements, settlement) {
  const cleaned = sanitizePartnerSettlements([settlement]);
  if (!cleaned.length) throw new Error('That settlement slip is not valid.');
  const rest = sanitizePartnerSettlements(settlements).filter((row) => row.month !== cleaned[0].month);
  return [...rest, cleaned[0]].sort((a, b) => b.month.localeCompare(a.month));
}

/** Pure: marks a month's slip as re-opened (figures stay on record). */
export function reopenPartnerSettlement(settlements, month, reopenedAt = null) {
  const cleaned = sanitizePartnerSettlements(settlements);
  const found = cleaned.find((row) => row.month === month);
  if (!found) throw new Error('No saved settlement slip for that month to re-open.');
  return cleaned.map((row) => (row.month === month
    ? { ...row, status: 'reopened', reopenedAt: reopenedAt || new Date().toISOString() }
    : row));
}

/**
 * Urdu + Roman-English WhatsApp summary for one month's settlement.
 * Every figure comes from the report; nothing is rounded beyond whole
 * rupees and nothing is hidden — receivables are named as such.
 */
export function generatePartnerSettlementWhatsAppText(report, settlement = null) {
  const lines = [];
  lines.push('Shahdara Fiber Net — Partner Settlement / پارٹنر سیٹلمنٹ');
  lines.push(`Month / مہینہ: ${partnerMonthLabel(report.month)} (${report.month})`);
  lines.push(`Total revenue / کل آمدنی: ${formatPartnerPKR(report.revenue)}`);
  lines.push(`Total expenses / کل اخراجات: ${formatPartnerPKR(report.expenses)}`);
  lines.push(report.profit >= 0
    ? `Net profit / خالص منافع: ${formatPartnerPKR(report.profit)}`
    : `Net loss / خالص نقصان: ${formatPartnerPKR(-report.profit)}`);
  // SISP-114: reserve lines appear only when a reserve was set aside;
  // at 0% this text stays byte-identical to the pre-SISP-114 summary.
  if (Number(report.charityReserve) > 0) {
    lines.push(`Charity / Sadqah & Emergency Reserve (${report.charityReservePct}%) / صدقہ و ایمرجنسی ریزرو: ${formatPartnerPKR(report.charityReserve)}`);
    lines.push(`Profit after reserve / ریزرو کے بعد منافع: ${formatPartnerPKR(report.profit - report.charityReserve)}`);
  }
  lines.push(`Each partner share (50%) / ہر پارٹنر کا حصہ: ${formatPartnerPKR(report.share)}`);
  // SISP-73: the month's installation position, and — only when the
  // CapEx toggle was ON for this report — the distributable profit the
  // shares were actually computed from.
  if (report.installationCapex && (report.installationCapex.subsidy > 0 || report.installationCapex.surplus > 0)) {
    lines.push(report.installationCapex.net >= 0
      ? `Installation surplus / انسٹالیشن سرپلس: ${formatPartnerPKR(report.installationCapex.surplus)}`
      : `Installation subsidy / انسٹالیشن سبسڈی: ${formatPartnerPKR(report.installationCapex.subsidy)}`);
    if (report.installationCapex.included) {
      lines.push(`Distributable profit (after installation subsidy) / قابلِ تقسیم منافع: ${formatPartnerPKR(report.distributableProfit)}`);
    }
  }
  lines.push('');
  for (const row of report.perPartner || []) {
    lines.push(`${row.partner}: share ${formatPartnerPKR(row.share)} + out-of-pocket ${formatPartnerPKR(row.capital)} − drawings ${formatPartnerPKR(row.drawings)} = ${row.isReceivable ? `Receivable (partner owes business) / وصولی: ${formatPartnerPKR(row.receivableAmount)}` : `Net payout / خالص ادائیگی: ${formatPartnerPKR(row.netPayout)}`}`);
  }
  lines.push('');
  lines.push(`Total drawings / کل ڈرائنگ: ${formatPartnerPKR(report.totalDrawings)} · Total out-of-pocket / کل ذاتی خرچ: ${formatPartnerPKR(report.totalCapital)}`);
  if (settlement) {
    lines.push(`Settlement status / سیٹلمنٹ: ${settlement.status === 'reopened' ? 'Re-opened / دوبارہ کھولا گیا' : 'Confirmed / تصدیق شدہ'}`);
    if (settlement.note) lines.push(`Note / نوٹ: ${settlement.note}`);
  }
  lines.push('Figures are from saved receipts and dated expenses; the slip changes no bill, receipt or expense.');
  return lines.join('\n');
}

export function partnerSettlementWhatsAppUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(String(text || ''))}`;
}

export { PARTNER_SHARE_RATE, escapeHtml };
