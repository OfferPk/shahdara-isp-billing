/**
 * shop-settlement.js — SISP-1: Shop Collector Cash Handover & Settlement Ledger.
 *
 * Problem: customers pay "Cash at Waseem Abbasi shop", "Cash at Hassan shop"
 * or "Cash at Balla shop".
 * The bill is marked paid, but nothing tracked how much unsettled cash sat at
 * each shop waiting to be handed over to the owner. This module is the ledger:
 * it derives shop collectors from recorded payment methods, aggregates unsettled
 * cash per shop, and records full or partial handovers.
 *
 * Storage: settlement records live in localStorage under SHOP_SETTLEMENTS_KEY
 * (sisp_shop_settlements_v1). The per-payment settled state lives on the payment
 * objects themselves (shopSettledAmount / shopSettled / settlementIds), so it
 * travels inside the normal ledger state and its JSON backup automatically.
 * Settlement records additionally travel inside JSON backups via the
 * `settings.shopSettlements` section (see core.js createJsonBackup).
 *
 * This module imports nothing from core.js on purpose: core.js imports
 * sanitizeShopSettlements from here for backup restore, and a core import
 * here would create a module cycle. PKR formatting and PKT dates are small
 * local helpers mirroring core.js (Intl en-PK / Asia/Karachi).
 *
 * SISP-68 adds the "Received Into" choice on the handover form: cash kept
 * by Nasir or Aqib is stamped on the settlement record (receivedInto) and
 * mirrored into the SISP-22 partner ledger as a linked drawing by
 * partner-settlement.js syncShopPickupDrawings (convergent reconcile —
 * re-running it never double-records). Drawer handovers behave exactly
 * as SISP-1 shipped them.
 *
 * OWNER-CASH-SHOP (2026-10-31): the person is Hassan and his famous shop
 * is "Balla" — ONE shop, written "Hassan Balla Shop". The historical
 * split ('Cash at Hassan shop' / 'Cash at Balla shop', PR #452) is
 * unified at derivation/display level ONLY: resolveShopCollector maps
 * both legacy methods (and the new 'Cash at Hassan Balla shop') to the
 * single canonical collector "Hassan Balla Shop", and settlement records
 * stored under a legacy shop name join that same summary when read.
 * Stored payment and settlement records are NEVER rewritten.
 *
 * SISP-105 adds the Monthly Shop Collector Passbook Statement at the end
 * of this module: a read-only, derived monthly statement per shop built
 * from the SAME records (collectShopPayments + settlement records) — no
 * second arithmetic, no writes, no stamps.
 *
 * SISP-149: a handover may split the settled gross into the net physical
 * cash the owner actually received plus a shop deduction (the shop's
 * cut / an expense the shop already spent). The invariant
 * netCash + deduction === settled gross is enforced inside
 * applySettlement; the split rides the settlement record (netCash /
 * deduction fields, kept by the sanitizer only as a consistent pair).
 * When deduction > 0 exactly ONE expense is appended to the returned
 * state's Expenses ledger in the same pure call — deterministic id
 * `shopded-<settlement id>` plus a shopSettlementId provenance field,
 * the SISP-45/SISP-56 mirror shape — so a settlement can never post its
 * deduction twice, and monthly P&L (dashboard-pnl.js) plus Daily
 * Closing deduct it through the ordinary expense path. The Roznamcha
 * drawer receives only the NET cash (roznamcha.js collectShopHandovers
 * reads settlementNetCash), because the deduction never physically
 * reaches the drawer. There is NO settlement-reversal path in the app:
 * the auto-expense is an ordinary Expenses-ledger row the owner can
 * delete by hand if a handover is ever undone manually.
 *
 * All helpers are pure except load/saveShopSettlements and the modal setup.
 * Tests use synthetic data only.
 *
 * SISP-124: unsettled-cash aging. A pure derivation over buildShopSummaries
 * + pendingShopReceipts — nothing is stored and no settlement state ever
 * changes. A shop alerts when its unsettled cash reaches
 * SHOP_AGING_AMOUNT_THRESHOLD or the cash has waited
 * SHOP_AGING_DAYS_THRESHOLD days. "Days waiting" is measured from the
 * shop's last recorded handover; a shop with unsettled cash but NO handover
 * on record is aged from its OLDEST unsettled receipt instead (that cash
 * has been sitting there since that receipt). One condition = amber, both
 * = red. The WhatsApp reminder is recipient-less (wa.me/?text=, the same
 * pattern as shopSettlementWhatsAppUrl): no shopkeeper phone number is
 * recorded anywhere in the app, so the owner picks the contact — a number
 * is never invented here.
 */

import { EXPENSE_CATEGORIES } from './phase3.js';
import {
  loadPartnerLedgerEntries,
  savePartnerLedgerEntries,
  syncShopPickupDrawings
} from './partner-settlement.js';
import { t } from './nav-language.js';

export const SHOP_SETTLEMENTS_KEY = 'sisp_shop_settlements_v1';

export const SHOP_AGING_AMOUNT_THRESHOLD = 15000;
export const SHOP_AGING_DAYS_THRESHOLD = 5;
/**
 * SISP-68: where a handover's cash actually went. 'drawer' is the
 * historical behaviour (cash enters the ISP Roznamcha drawer; records
 * written before SISP-68 carry no field and mean 'drawer'). 'nasir' /
 * 'aqib' mean that partner kept the cash, which partner-settlement.js
 * mirrors as a linked Partner Cash Drawing (type 'drawing') in the
 * SISP-22 ledger. The field is only persisted for partner pickups, so
 * legacy drawer records stay byte-identical.
 */
export const RECEIVED_INTO_VALUES = Object.freeze(['drawer', 'nasir', 'aqib']);

export function normalizeReceivedInto(value) {
  const cleaned = String(value ?? '').trim().toLowerCase();
  return RECEIVED_INTO_VALUES.includes(cleaned) ? cleaned : 'drawer';
}

/** 'Nasir' / 'Aqib' when that partner kept the cash, else null (drawer). */
export function partnerForReceivedInto(value) {
  const into = normalizeReceivedInto(value);
  if (into === 'nasir') return 'Nasir';
  if (into === 'aqib') return 'Aqib';
  return null;
}

/** Display label for receipts and summaries. */
export function receivedIntoLabel(value) {
  const partner = partnerForReceivedInto(value);
  return partner ? `Kept by ${partner} (Partner Drawing)` : 'ISP Roznamcha Drawer';
}

const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * SISP-149: the Expenses-ledger category a shop deduction posts under.
 * EXPENSE_CATEGORIES (phase3.js) is a frozen list with no shop-commission
 * entry, so the honest existing fit is 'Other expenses' — the same bucket
 * the roznamcha mirror maps non-material petty cash to (SISP-45).
 */
export const SHOP_DEDUCTION_EXPENSE_CATEGORY = EXPENSE_CATEGORIES.includes('Other expenses')
  ? 'Other expenses'
  : EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

/**
 * SISP-149: the deduction recorded on a settlement, or 0. The split only
 * counts when it is internally consistent (netCash + deduction equals
 * the settled gross, deduction > 0) — a partial or inconsistent pair
 * reads as a legacy no-split record, so readers never guess.
 */
export function settlementDeduction(settlement) {
  if (!settlement || typeof settlement !== 'object') return 0;
  const deduction = Number(settlement.deduction);
  const netCash = Number(settlement.netCash);
  if (!Number.isFinite(deduction) || !Number.isFinite(netCash)) return 0;
  if (deduction <= 0 || netCash < 0) return 0;
  if (round2(netCash + deduction) !== round2(moneyValue(settlement.amount))) return 0;
  return round2(deduction);
}

/**
 * SISP-149: the physical cash a handover actually delivered — the gross
 * settled amount minus any shop deduction. Legacy settlements (no
 * split) hand over their full amount, exactly as before.
 */
export function settlementNetCash(settlement) {
  if (!settlement || typeof settlement !== 'object') return 0;
  return round2(moneyValue(settlement.amount) - settlementDeduction(settlement));
}

/** SISP-149: deterministic Expenses-ledger id for a settlement's deduction. */
export function shopDeductionExpenseId(settlementId) {
  return `shopded-${settlementId}`;
}

/**
 * SISP-149: the ONE expense row a split settlement posts, or null when
 * the settlement carries no deduction. Built from the settlement alone
 * (the SISP-45/SISP-56 mirror shape: deterministic id + provenance), so
 * re-deriving it for the same settlement always yields the same row and
 * can never double-post. The row satisfies the Expenses ledger's own
 * validation (phase3.js): real category, handover date, notes naming
 * the shop and the settlement.
 */
export function buildShopDeductionExpense(settlement) {
  const deduction = settlementDeduction(settlement);
  if (deduction <= 0 || !settlement || typeof settlement.id !== 'string' || !settlement.id) return null;
  return {
    id: shopDeductionExpenseId(settlement.id),
    date: settlement.date,
    amount: deduction,
    category: SHOP_DEDUCTION_EXPENSE_CATEGORY,
    notes: `Shop deduction · ${settlement.shop} · Settlement ${settlement.id}`.slice(0, 1000),
    area: '',
    shopSettlementId: settlement.id,
    source: 'shop-settlement',
    createdAt: typeof settlement.createdAt === 'string' ? settlement.createdAt : ''
  };
}

export function formatShopPKR(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `PKR ${formatter.format(amount)}`;
}

function zonedParts(date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PAKISTAN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
}

/** YYYY-MM-DD in Pakistan time. */
export function pakistanToday(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** YYYY-MM in Pakistan time. */
export function pakistanMonth(referenceDate = new Date()) {
  return pakistanToday(referenceDate).slice(0, 7);
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

/**
 * Resolves the shop collector for a payment from its method / paidBy strings.
 * Known shops first (Waseem Abbasi, Hassan Balla — the app's PAYMENT_METHODS
 * values), then any custom shop collector derived from the data itself: a
 * method like "Cash at <Name> shop" yields "<Name> Shop". Returns null for
 * non-shop payments (plain Cash, digital wallets, bank transfers, ...).
 *
 * OWNER-CASH-SHOP unification: 'hassan' and 'balla' are the SAME shop —
 * Hassan's famous "Balla" shop — so either mention (in the method or the
 * paidBy note) resolves to the one canonical collector "Hassan Balla
 * Shop". Legacy method strings on stored payments stay untouched; only
 * this derivation changed.
 *
 * Mirrors dashboard-daily-closing.js resolveShopLocation for the known
 * shops, extended with the generic "Cash at X shop" pattern so custom shop
 * collectors are never silently dropped.
 *
 * @param {string} method
 * @param {string} [paidBy='']
 * @returns {string|null}
 */
export function resolveShopCollector(method, paidBy = '') {
  const m = String(method || '').toLowerCase();
  const p = String(paidBy || '').toLowerCase();
  if (m.includes('waseem') || p.includes('waseem')) return 'Waseem Abbasi Shop';
  if (m.includes('hassan') || p.includes('hassan') || m.includes('balla') || p.includes('balla')) {
    return 'Hassan Balla Shop';
  }
  const custom = String(method || '').match(/cash\s+at\s+(.+?)\s+shop/i);
  if (custom) {
    const name = custom[1].trim();
    if (name) return `${name} Shop`;
  }
  return null;
}

/**
 * OWNER-CASH-SHOP: canonical display name for a shop name as STORED on a
 * settlement record (or any other stored shop label). Only the three
 * spellings of the one shop's name unify — 'Hassan Shop' and 'Balla
 * Shop' (the legacy split) and 'Hassan Balla Shop' itself all read as
 * "Hassan Balla Shop" — while every other stored label (other shops,
 * short names, custom shops) passes through byte-identical, exactly as
 * summaries grouped stored records before. Deliberately narrower than
 * resolveShopCollector: payment derivation substring-matches free text
 * (methods, paidBy notes), but a stored shop label is an identity, and
 * only this one identity was ever split. Read-time only: the stored
 * record itself is never modified.
 */
export function canonicalShopName(name) {
  const raw = String(name || '').trim();
  if (!raw) return raw;
  return /^(?:hassan shop|balla shop|hassan balla shop)$/i.test(raw) ? 'Hassan Balla Shop' : raw;
}

/**
 * OWNER-CASH-SHOP: the distinct canonical shop collectors behind a
 * payment-method list (core.js PAYMENT_METHODS), in first-appearance
 * order, each paired with the method string that RECORDS a payment at
 * that shop. The canonical method is the exact "Cash at <Collector>"
 * spelling when the list carries one ('Cash at Hassan Balla shop' for
 * the unified shop); otherwise the first method resolving to that
 * collector. This is the derivation seam behind the Quick Collect cash
 * shop chips: a future "Cash at X shop" method surfaces automatically.
 * The list is a parameter (not an import) because this module must not
 * import core.js (module-cycle rule, see header).
 */
export function shopCollectorMethods(methods) {
  const byShop = new Map();
  for (const method of (Array.isArray(methods) ? methods : [])) {
    const shop = resolveShopCollector(method);
    if (!shop) continue;
    const text = String(method);
    const isCanonicalSpelling = text.toLowerCase() === `cash at ${shop.toLowerCase()}`;
    const existing = byShop.get(shop);
    if (!existing) byShop.set(shop, { shop, method: text });
    else if (isCanonicalSpelling) existing.method = text;
  }
  return [...byShop.values()];
}

export function isShopPayment(payment) {
  if (!payment || typeof payment !== 'object') return false;
  return resolveShopCollector(payment.method, payment.paidBy) !== null;
}

function settledAmountOf(payment) {
  if (!payment || typeof payment !== 'object') return 0;
  const explicit = Number(payment.shopSettledAmount);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, moneyValue(payment.amount));
  if (payment.shopSettled) return moneyValue(payment.amount);
  return 0;
}

/**
 * Flattens every shop-collected payment in the ledger state, oldest first.
 * Safe defaults everywhere (|| [], || {}, || null) so old records without
 * shop fields never break.
 */
export function collectShopPayments(state) {
  const out = [];
  for (const customer of (state && Array.isArray(state.customers) ? state.customers : [])) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
        if (!payment || typeof payment !== 'object') continue;
        // SISP-34: voided receipts are history, not shop cash — a voided
        // shop receipt drops out of unsettled cash entirely.
        if (payment.voided === true) continue;
        const shop = resolveShopCollector(payment.method, payment.paidBy);
        if (!shop) continue;
        const amount = moneyValue(payment.amount);
        const settled = settledAmountOf(payment);
        out.push({
          shop,
          customerId: customer.id ?? null,
          customerNumber: customer.customerNumber ?? null,
          customerName: customer.name ?? '',
          billMonth: bill.month ?? '',
          paymentId: payment.id ?? null,
          date: payment.date ?? '',
          amount,
          method: payment.method ?? '',
          paidBy: payment.paidBy ?? '',
          settledAmount: settled,
          remaining: Math.max(0, amount - settled),
          shopSettled: settled >= amount && amount > 0,
          settlementIds: Array.isArray(payment.settlementIds) ? [...payment.settlementIds] : []
        });
      }
    }
  }
  out.sort((a, b) => {
    const da = DATE_RE.test(a.date) ? a.date : '9999-99-99';
    const db = DATE_RE.test(b.date) ? b.date : '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    const na = Number(a.customerNumber) || 0;
    const nb = Number(b.customerNumber) || 0;
    if (na !== nb) return na - nb;
    return String(a.paymentId ?? '') < String(b.paymentId ?? '') ? -1 : 1;
  });
  return out;
}

/**
 * Per-shop summary for the dashboard panel. Sorted by unsettled cash,
 * highest first. `settlements` is the sisp_shop_settlements_v1 array.
 */
export function buildShopSummaries(state, settlements, referenceDate = new Date()) {
  const list = Array.isArray(settlements) ? settlements : [];
  const month = pakistanMonth(referenceDate);
  const byShop = new Map();
  const ensure = (shop) => {
    if (!byShop.has(shop)) {
      byShop.set(shop, {
        shop,
        totalCollected: 0,
        collectedThisMonth: 0,
        unsettled: 0,
        settledTotal: 0,
        receiptCount: 0,
        unsettledReceiptCount: 0,
        lastHandoverDate: null,
        receiptsSinceLastSettlement: 0
      });
    }
    return byShop.get(shop);
  };
  for (const payment of collectShopPayments(state)) {
    const s = ensure(payment.shop);
    s.totalCollected += payment.amount;
    s.settledTotal += payment.settledAmount;
    s.unsettled += payment.remaining;
    s.receiptCount += 1;
    if (payment.remaining > 0) s.unsettledReceiptCount += 1;
    if (typeof payment.date === 'string' && payment.date.slice(0, 7) === month) {
      s.collectedThisMonth += payment.amount;
    }
  }
  for (const record of list) {
    if (!record || typeof record !== 'object' || !record.shop) continue;
    // OWNER-CASH-SHOP: a settlement stored under a legacy shop name
    // ('Hassan Shop' / 'Balla Shop') joins the ONE unified summary when
    // read; the stored record keeps its original name byte-identically.
    const s = ensure(canonicalShopName(record.shop));
    if (typeof record.date === 'string' && DATE_RE.test(record.date)) {
      if (!s.lastHandoverDate || record.date > s.lastHandoverDate) s.lastHandoverDate = record.date;
    }
  }
  for (const payment of collectShopPayments(state)) {
    const s = byShop.get(payment.shop);
    if (!s) continue;
    if (!s.lastHandoverDate) {
      s.receiptsSinceLastSettlement = s.receiptCount;
    } else if (typeof payment.date !== 'string' || !DATE_RE.test(payment.date) || payment.date > s.lastHandoverDate) {
      s.receiptsSinceLastSettlement += 1;
    }
  }
  return [...byShop.values()].sort((a, b) => b.unsettled - a.unsettled);
}

/** Pending (partly or fully unsettled) receipts for one shop, oldest first. */
export function pendingShopReceipts(state, shop) {
  const canonical = canonicalShopName(shop);
  return collectShopPayments(state).filter((p) => p.shop === canonical && p.remaining > 0);
}

/** Whole days between two YYYY-MM-DD dates (date-only math, >= 0; null on bad input). */
function daysBetweenDates(fromDate, toDate) {
  if (!DATE_RE.test(String(fromDate || '')) || !DATE_RE.test(String(toDate || ''))) return null;
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, Math.round((to - from) / 86400000));
}

/**
 * SISP-124: aging for ONE shop summary (from buildShopSummaries). Pure —
 * reads pending receipts only for the oldest-unsettled date / count.
 * Returns level null when the shop should render exactly as before:
 * zero unsettled cash never alerts, and below both thresholds never alerts.
 */
export function shopAgingForSummary(state, summary, referenceDate = new Date()) {
  const shop = summary && typeof summary.shop === 'string' ? summary.shop : '';
  const unsettled = summary ? moneyValue(summary.unsettled) : 0;
  const pending = shop ? pendingShopReceipts(state, shop) : [];
  const datedPending = pending.filter((p) => DATE_RE.test(String(p.date || '')));
  const oldestUnsettledDate = datedPending.length > 0 ? datedPending[0].date : null;
  const lastHandoverDate = summary && DATE_RE.test(String(summary.lastHandoverDate || ''))
    ? String(summary.lastHandoverDate)
    : null;
  const today = pakistanToday(referenceDate);
  let daysWaiting = null;
  let waitingBasis = null;
  if (unsettled > 0) {
    if (lastHandoverDate) {
      daysWaiting = daysBetweenDates(lastHandoverDate, today);
      waitingBasis = 'handover';
    } else if (oldestUnsettledDate) {
      daysWaiting = daysBetweenDates(oldestUnsettledDate, today);
      waitingBasis = 'oldest-receipt';
    }
  }
  const amountAlert = unsettled >= SHOP_AGING_AMOUNT_THRESHOLD;
  const daysAlert = daysWaiting !== null && daysWaiting >= SHOP_AGING_DAYS_THRESHOLD;
  const level = unsettled > 0 && (amountAlert || daysAlert)
    ? (amountAlert && daysAlert ? 'red' : 'amber')
    : null;
  return {
    shop,
    unsettled,
    pendingCount: pending.length,
    oldestUnsettledDate,
    lastHandoverDate,
    daysWaiting,
    waitingBasis,
    amountAlert,
    daysAlert,
    level
  };
}

/** SISP-124: aging entries for every shop summary, same order as buildShopSummaries. */
export function buildShopAging(state, settlements, referenceDate = new Date()) {
  return buildShopSummaries(state, settlements, referenceDate)
    .map((summary) => shopAgingForSummary(state, summary, referenceDate));
}

/** SISP-124: badge label for an aging entry (empty string when not alerting or days unknown for the amount-only case handled by the nodays key). */
export function shopAgingBadgeText(aging, lang = null) {
  if (!aging || !aging.level) return '';
  const params = { amount: formatShopPKR(aging.unsettled), days: aging.daysWaiting ?? '' };
  return aging.daysWaiting === null
    ? t('shopage_badge_nodays', lang, params)
    : t('shopage_badge', lang, params);
}

/**
 * SISP-124: itemized WhatsApp handover reminder for one shop's aging
 * entry. Lines list each pending receipt's REMAINING cash (date, customer,
 * amount) — the money still sitting at the shop — plus the total, which is
 * the summary's unsettled figure from the existing settlement math.
 */
export function buildShopAgingReminderText(state, aging, lang = null) {
  if (!aging || !aging.shop) return '';
  const pending = pendingShopReceipts(state, aging.shop);
  const lines = [];
  lines.push(t('shopage_r_title', lang));
  lines.push(t('shopage_r_shop', lang, { shop: aging.shop }));
  const unsettledParams = { amount: formatShopPKR(aging.unsettled), count: pending.length };
  lines.push(pending.length === 1
    ? t('shopage_r_unsettled_sing', lang, unsettledParams)
    : t('shopage_r_unsettled_plur', lang, unsettledParams));
  if (aging.waitingBasis === 'handover' && aging.lastHandoverDate) {
    lines.push(t('shopage_r_waiting_handover', lang, { days: aging.daysWaiting ?? '', date: aging.lastHandoverDate }));
  } else if (aging.waitingBasis === 'oldest-receipt' && aging.oldestUnsettledDate) {
    lines.push(t('shopage_r_waiting_first', lang, { days: aging.daysWaiting ?? '', date: aging.oldestUnsettledDate }));
  }
  lines.push('');
  lines.push(t('shopage_r_pending', lang));
  if (pending.length === 0) {
    lines.push('- (none)');
  } else {
    for (const p of pending) {
      lines.push(t('shopage_r_line', lang, {
        number: p.customerNumber ?? '',
        name: p.customerName || '',
        date: p.date || '',
        amount: formatShopPKR(p.remaining)
      }));
    }
  }
  lines.push('');
  lines.push(t('shopage_r_total', lang, { amount: formatShopPKR(aging.unsettled) }));
  return lines.join('\n');
}

/** Reads settlement records; [] on missing/corrupt storage. */
export function loadShopSettlements(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(SHOP_SETTLEMENTS_KEY);
    if (!raw) return [];
    return sanitizeShopSettlements(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists settlement records; never throws. */
export function saveShopSettlements(settlements, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(SHOP_SETTLEMENTS_KEY, JSON.stringify(Array.isArray(settlements) ? settlements : []));
    return true;
  } catch {
    return false;
  }
}

/** Drops malformed settlement entries; keeps only known fields. */
export function sanitizeShopSettlements(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const amount = Number(entry.amount);
    if (typeof entry.shop !== 'string' || !entry.shop.trim()) continue;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (typeof entry.date !== 'string' || !DATE_RE.test(entry.date)) continue;
    const receivedInto = normalizeReceivedInto(entry.receivedInto);
    const record = {
      id: typeof entry.id === 'string' && entry.id ? entry.id : `shop-settle-${Date.now()}`,
      shop: entry.shop,
      amount,
      date: entry.date,
      note: typeof entry.note === 'string' ? entry.note : '',
      // SISP-68: persisted only for partner pickups; absence means the
      // cash went into the Roznamcha drawer (legacy records unchanged).
      // The SISP-105 passbook reads this enum via receivedIntoLabel.
      ...(receivedInto !== 'drawer' ? { receivedInto } : {}),
      allocations: Array.isArray(entry.allocations)
        ? entry.allocations.filter((a) => a && typeof a === 'object' && Number.isFinite(Number(a.amount)) && Number(a.amount) > 0).map((a) => ({
            customerId: a.customerId ?? null,
            customerNumber: a.customerNumber ?? null,
            customerName: typeof a.customerName === 'string' ? a.customerName : '',
            billMonth: typeof a.billMonth === 'string' ? a.billMonth : '',
            paymentId: a.paymentId ?? null,
            date: typeof a.date === 'string' ? a.date : '',
            amount: Number(a.amount)
          }))
        : [],
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    };
    // SISP-149: keep the handover split only as a consistent pair
    // (netCash + deduction === amount, deduction > 0). Anything else
    // reads as a legacy no-split record — the fields are dropped, never
    // half-kept, so no reader ever has to guess at a broken split.
    const splitDeduction = Number(entry.deduction);
    const splitNetCash = Number(entry.netCash);
    if (Number.isFinite(splitDeduction) && Number.isFinite(splitNetCash)
      && splitDeduction > 0 && splitNetCash >= 0
      && round2(splitNetCash + splitDeduction) === round2(amount)) {
      record.netCash = round2(splitNetCash);
      record.deduction = round2(splitDeduction);
    }
    out.push(record);
  }
  return out;
}

function settlementId() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return `shop-settle-${globalThis.crypto.randomUUID()}`;
    }
  } catch { /* fall through */ }
  return `shop-settle-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * FIFO allocation of a handover amount over a shop's pending receipts
 * (oldest first). Returns the covered allocations, the covered total, and
 * any leftover that exceeds the shop's unsettled balance (never recorded).
 */
export function allocateSettlement(shopPayments, amount) {
  const total = moneyValue(amount);
  const allocations = [];
  let remaining = total;
  for (const payment of (Array.isArray(shopPayments) ? shopPayments : [])) {
    if (remaining <= 0) break;
    if (!payment || payment.remaining <= 0) continue;
    const take = Math.min(payment.remaining, remaining);
    allocations.push({
      customerId: payment.customerId ?? null,
      customerNumber: payment.customerNumber ?? null,
      customerName: payment.customerName ?? '',
      billMonth: payment.billMonth ?? '',
      paymentId: payment.paymentId ?? null,
      date: payment.date ?? '',
      amount: take
    });
    remaining -= take;
  }
  return { allocations, covered: total - remaining, leftover: remaining };
}

/**
 * Records a cash handover from one shop. Returns a NEW state (input untouched)
 * with the covered receipts marked (shopSettledAmount / shopSettled /
 * settlementIds) plus the settlement record to persist via
 * saveShopSettlements. Throws on a non-positive amount or an unknown shop.
 *
 * SISP-149: pass `options.netCash` / `options.deduction` (alongside
 * SISP-68's `options.receivedInto`) to record that the
 * shop kept a deduction out of the settled gross. The invariant
 * netCash + deduction === covered is enforced here: a broken split, a
 * negative figure, or a handover amount beyond the unsettled total
 * (leftover) throws and records NOTHING (this function is pure — a
 * throw means no state and no settlement escape). A zero deduction
 * (or no split at all) takes the legacy path exactly: the settlement
 * record carries no split fields and no expense is posted.
 */
export function applySettlement(state, shop, amount, date, note = '', options = {}) {
  const total = moneyValue(amount);
  if (!Number.isFinite(total) || total <= 0) throw new Error('Settlement amount must be greater than zero.');
  // OWNER-CASH-SHOP: the handover is recorded under the canonical shop
  // name even when a caller still passes a legacy one ('Hassan Shop' /
  // 'Balla Shop') — one shop, one ledger name, from now on.
  const canonicalShop = canonicalShopName(shop);
  const pending = pendingShopReceipts(state, canonicalShop);
  if (pending.length === 0) throw new Error(`No unsettled cash found for ${canonicalShop}.`);
  const { allocations, covered, leftover } = allocateSettlement(pending, total);
  if (covered <= 0) throw new Error(`No unsettled cash found for ${canonicalShop}.`);
  let splitNetCash = null;
  let splitDeduction = 0;
  if (options && (options.netCash !== undefined || options.deduction !== undefined)) {
    const netCash = Number(options.netCash);
    const deduction = Number(options.deduction);
    if (!Number.isFinite(netCash) || !Number.isFinite(deduction) || netCash < 0 || deduction < 0) {
      throw new Error('Net cash and shop deduction cannot be negative.');
    }
    if (leftover > 0) {
      throw new Error('With a shop deduction, the handover amount must exactly equal the receipts being settled — lower the amount or clear the deduction.');
    }
    if (round2(netCash + deduction) !== round2(covered)) {
      throw new Error(`Net cash plus shop deduction must equal the settled total (${formatShopPKR(covered)}).`);
    }
    splitNetCash = round2(netCash);
    splitDeduction = round2(deduction);
  }
  const id = settlementId();
  const handoverDate = typeof date === 'string' && DATE_RE.test(date) ? date : pakistanToday();
  const receivedInto = normalizeReceivedInto(options?.receivedInto);
  const settlement = {
    id,
    shop: canonicalShop,
    amount: covered,
    date: handoverDate,
    note: typeof note === 'string' ? note : '',
    // SISP-68: partner pickups are stamped so the partner-ledger mirror
    // and the Roznamcha drawer can each follow the cash. Drawer (the
    // default) adds no field, keeping legacy-shaped records identical.
    ...(receivedInto !== 'drawer' ? { receivedInto } : {}),
    allocations,
    createdAt: new Date().toISOString()
  };
  if (splitDeduction > 0) {
    settlement.netCash = splitNetCash;
    settlement.deduction = splitDeduction;
  }
  const next = clone(state || { customers: [] });
  const byKey = new Map();
  for (const a of allocations) {
    byKey.set(`${String(a.customerId)}|${a.billMonth}|${String(a.paymentId)}`, a.amount);
  }
  for (const customer of (Array.isArray(next.customers) ? next.customers : [])) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
        if (!payment || typeof payment !== 'object') continue;
        const key = `${String(customer.id)}|${bill.month}|${String(payment.id)}`;
        if (!byKey.has(key)) continue;
        const prev = settledAmountOf(payment);
        const now = Math.min(moneyValue(payment.amount), prev + byKey.get(key));
        payment.shopSettledAmount = now;
        if (now >= moneyValue(payment.amount) && moneyValue(payment.amount) > 0) payment.shopSettled = true;
        const ids = Array.isArray(payment.settlementIds) ? [...payment.settlementIds] : [];
        if (!ids.includes(id)) ids.push(id);
        payment.settlementIds = ids;
      }
    }
  }
  // SISP-149: the deduction is an expense, posted exactly once — inside
  // this same pure call, so the settlement and its expense persist (or
  // fail) together with the returned state. The deterministic id makes
  // a duplicate impossible even if the row were ever re-derived.
  if (splitDeduction > 0) {
    const expense = buildShopDeductionExpense(settlement);
    const expenses = Array.isArray(next.expenses) ? next.expenses : [];
    if (expense && !expenses.some((row) => row && row.id === expense.id)) {
      next.expenses = [...expenses, expense];
    }
  }
  return { state: next, settlement, leftover };
}

/** Plain-text settlement receipt (printable + WhatsApp), PKR formatted. */
export function generateShopSettlementReceiptText({ shop, settlement, remainingUnsettled = 0 } = {}) {
  const lines = [];
  lines.push('Shahdara ISP Billing — Shop Settlement Receipt');
  lines.push(`Shop: ${shop}`);
  lines.push(`Handover date: ${settlement?.date || ''}`);
  // SISP-149: a split handover prints all three figures; a legacy
  // handover (no deduction) prints the original single line unchanged.
  const receiptDeduction = settlementDeduction(settlement);
  if (receiptDeduction > 0) {
    lines.push(`Gross receipts settled: ${formatShopPKR(settlement?.amount)}`);
    lines.push(`Shop deduction / expense: -${formatShopPKR(receiptDeduction)}`);
    lines.push(`Net cash received: ${formatShopPKR(settlementNetCash(settlement))}`);
  } else {
    lines.push(`Amount received: ${formatShopPKR(settlement?.amount)}`);
  }
  // SISP-68: partner pickups say so on the receipt; drawer receipts are
  // unchanged from the SISP-1 text.
  if (partnerForReceivedInto(settlement?.receivedInto)) {
    lines.push(`Received into: ${receivedIntoLabel(settlement.receivedInto)}`);
  }
  if (settlement?.note) lines.push(`Note: ${settlement.note}`);
  lines.push('');
  lines.push('Settled receipts:');
  const allocations = Array.isArray(settlement?.allocations) ? settlement.allocations : [];
  if (allocations.length === 0) {
    lines.push('- (none)');
  } else {
    for (const a of allocations) {
      lines.push(`- #${a.customerNumber ?? ''} ${a.customerName || ''} (${a.date || ''}): ${formatShopPKR(a.amount)}`);
    }
  }
  lines.push('');
  lines.push(`Remaining unsettled at shop: ${formatShopPKR(remainingUnsettled)}`);
  if (settlement?.id) lines.push(`Settlement ID: ${settlement.id}`);
  return lines.join('\n');
}

export function shopSettlementWhatsAppUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(String(text || ''))}`;
}

// ---------------------------------------------------------------------------
// SISP-105: Monthly Shop Collector Passbook Statement.
//
// A read-only monthly statement for ONE shop, derived entirely from the
// records this module already owns: collections come from
// collectShopPayments (voided receipts already excluded) and handovers
// from the sisp_shop_settlements_v1 records. Nothing is written, stamped
// or renumbered — a statement is a report, not a receipt.
//
//   Opening unsettled = (collections dated before the month)
//                     − (handovers dated before the month)
//   Closing unsettled = Opening + month collections − month handovers
//
// Only records with a valid YYYY-MM-DD date can be placed in a month, so
// undated records never enter any statement (they cannot be ordered
// chronologically). All money is accumulated in integer cents so the
// printed opening/closing figures are exact.
// ---------------------------------------------------------------------------

const PASSBOOK_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
// 58mm thermal rolls fit 32 Font-A chars per line — mirrors
// THERMAL_WIDTH_CHARS in thermal-printer.js (kept local, like the other
// small helpers in this module).
const PASSBOOK_THERMAL_WIDTH = 32;

function centsOf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function passbookMonthLabel(month) {
  if (!PASSBOOK_MONTH_RE.test(String(month || ''))) return String(month || '');
  const [year, mon] = String(month).split('-').map(Number);
  return new Intl.DateTimeFormat('en-PK', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, mon - 1, 1)));
}

/**
 * Every shop that actually exists in the recorded data on this device:
 * shops seen on collected payments plus shops with settlement records.
 * Sorted by name. The spec's Waseem / Hassan / Balla shops are examples —
 * the list always comes from the data, never from a hardcoded list.
 */
export function listShopPassbookShops(state, settlements) {
  const names = new Set();
  for (const payment of collectShopPayments(state)) names.add(payment.shop);
  // OWNER-CASH-SHOP: legacy settlement records stored under a split name
  // ('Hassan Shop' / 'Balla Shop') join the unified shop at read time —
  // the same canonicalShopName seam buildShopSummaries uses.
  for (const record of sanitizeShopSettlements(settlements)) names.add(canonicalShopName(record.shop));
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Stored receipt refs (payment.receiptNumber) keyed like the ledger walk. */
function receiptRefByPaymentKey(state) {
  const map = new Map();
  for (const customer of (state && Array.isArray(state.customers) ? state.customers : [])) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
        if (!payment || typeof payment !== 'object') continue;
        const ref = typeof payment.receiptNumber === 'string' ? payment.receiptNumber.trim() : '';
        if (ref) map.set(`${String(customer.id)}|${bill.month}|${String(payment.id)}`, ref);
      }
    }
  }
  return map;
}

/**
 * Builds the passbook model for one shop + month ('YYYY-MM'; an invalid
 * month falls back to the current PKT month). Pure and read-only.
 *
 * Rows are chronological; on the same date collections list before
 * handovers (cash is collected, then handed over). Each row carries its
 * running unsettled balance after the row applies. A handover row keeps
 * its settlementId and, for SISP-68 partner pickups, its receivedInto
 * attribution. A collection row's receiptRef is the payment's stored
 * receiptNumber when one exists, else the payment's ledger id — a real
 * reference either way, never an invented one.
 */
export function buildShopPassbook(state, settlements, shop, month) {
  const targetShop = canonicalShopName(typeof shop === 'string' ? shop : '');
  const targetMonth = PASSBOOK_MONTH_RE.test(String(month || '')) ? String(month) : pakistanMonth();
  const refs = receiptRefByPaymentKey(state);
  const payments = collectShopPayments(state)
    .filter((p) => p.shop === targetShop && DATE_RE.test(p.date));
  const handovers = sanitizeShopSettlements(settlements)
    .filter((record) => canonicalShopName(record.shop) === targetShop)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const ca = String(a.createdAt || '');
      const cb = String(b.createdAt || '');
      if (ca !== cb) return ca < cb ? -1 : 1;
      return String(a.id) < String(b.id) ? -1 : 1;
    });

  let openingCents = 0;
  for (const p of payments) {
    if (p.date.slice(0, 7) < targetMonth) openingCents += centsOf(p.amount);
  }
  for (const h of handovers) {
    if (h.date.slice(0, 7) < targetMonth) openingCents -= centsOf(h.amount);
  }

  const merged = [];
  for (const p of payments) {
    if (p.date.slice(0, 7) === targetMonth) merged.push({ kind: 0, date: p.date, payment: p });
  }
  for (const h of handovers) {
    if (h.date.slice(0, 7) === targetMonth) merged.push({ kind: 1, date: h.date, handover: h });
  }
  // Stable sort: same date → collections before handovers; within a kind
  // the underlying order (collectShopPayments order / handover order) is
  // preserved.
  merged.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.kind - b.kind;
  });

  let balanceCents = openingCents;
  let collectedCents = 0;
  let handedCents = 0;
  const rows = [];
  for (const item of merged) {
    if (item.kind === 0) {
      const p = item.payment;
      balanceCents += centsOf(p.amount);
      collectedCents += centsOf(p.amount);
      rows.push({
        type: 'collection',
        date: p.date,
        customerId: p.customerId,
        customerNumber: p.customerNumber,
        customerName: p.customerName,
        billMonth: p.billMonth,
        paymentId: p.paymentId,
        receiptRef: refs.get(`${String(p.customerId)}|${p.billMonth}|${String(p.paymentId)}`)
          || (p.paymentId !== null && p.paymentId !== undefined ? String(p.paymentId) : ''),
        amount: centsOf(p.amount) / 100,
        balance: balanceCents / 100
      });
    } else {
      const h = item.handover;
      balanceCents -= centsOf(h.amount);
      handedCents += centsOf(h.amount);
      rows.push({
        type: 'handover',
        date: h.date,
        settlementId: h.id,
        amount: centsOf(h.amount) / 100,
        note: h.note || '',
        // SISP-68 stores receivedInto as an enum ('nasir' / 'aqib'; drawer
        // handovers carry no field). Resolve partner pickups to the shipped
        // display label — the same seam generateShopSettlementReceiptText
        // uses — so the statement prints "Kept by Nasir (Partner Drawing)"
        // instead of the raw stored value.
        receivedInto: partnerForReceivedInto(h.receivedInto) ? receivedIntoLabel(h.receivedInto) : '',
        allocationCount: Array.isArray(h.allocations) ? h.allocations.length : 0,
        balance: balanceCents / 100
      });
    }
  }

  return {
    shop: targetShop,
    month: targetMonth,
    monthLabel: passbookMonthLabel(targetMonth),
    openingUnsettled: openingCents / 100,
    rows,
    totalCollected: collectedCents / 100,
    totalHandedOver: handedCents / 100,
    closingUnsettled: balanceCents / 100
  };
}

function passbookRowDetailLines(row, lang) {
  if (row.type === 'collection') {
    const head = `${t('shop_passbook_receipt', lang)} ${row.receiptRef || ''}`.trim();
    const who = `#${row.customerNumber ?? ''} ${row.customerName || ''}`.trim();
    const bill = row.billMonth ? t('shop_passbook_bill', lang, { month: row.billMonth }) : '';
    return { head, sub: [who, bill].filter(Boolean).join(' · ') };
  }
  const head = `${t('shop_passbook_handover', lang)} ${row.settlementId || ''}`.trim();
  const sub = [];
  if (row.receivedInto) sub.push(t('shop_passbook_received_into', lang, { target: row.receivedInto }));
  if (row.note) sub.push(row.note);
  return { head, sub: sub.join(' · ') };
}

/** Plain-text passbook statement (copy + WhatsApp share). */
export function generateShopPassbookText(passbook, { lang = null } = {}) {
  const book = passbook || {};
  const rows = Array.isArray(book.rows) ? book.rows : [];
  const lines = [];
  lines.push(`Shahdara ISP Billing — ${t('shop_passbook_title', lang)}`);
  lines.push(`${t('shop_passbook_shop', lang)}: ${book.shop || ''}`);
  lines.push(`${book.monthLabel || ''} (${book.month || ''})`);
  lines.push(`${t('shop_passbook_opening', lang)}: ${formatShopPKR(book.openingUnsettled)}`);
  lines.push('----------------------------------------');
  if (rows.length === 0) {
    lines.push(t('shop_passbook_empty', lang));
  } else {
    for (const row of rows) {
      const { head, sub } = passbookRowDetailLines(row, lang);
      lines.push(`${row.date} · ${head}`);
      if (sub) lines.push(`  ${sub}`);
      const label = row.type === 'collection'
        ? t('shop_passbook_col_collected', lang)
        : t('shop_passbook_col_handed', lang);
      lines.push(`  ${label} ${formatShopPKR(row.amount)} · ${t('shop_passbook_col_balance', lang)} ${formatShopPKR(row.balance)}`);
    }
  }
  lines.push('----------------------------------------');
  lines.push(`${t('shop_passbook_collected_month', lang)}: ${formatShopPKR(book.totalCollected)}`);
  lines.push(`${t('shop_passbook_handed_month', lang)}: ${formatShopPKR(book.totalHandedOver)}`);
  lines.push(`${t('shop_passbook_closing', lang)}: ${formatShopPKR(book.closingUnsettled)}`);
  return lines.join('\n');
}

function wrapPassbookText(text, width) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (word.length > width) {
      if (line) { lines.push(line); line = ''; }
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
      continue;
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function centerPassbookText(text, width) {
  const value = String(text ?? '').slice(0, width);
  const pad = Math.max(0, Math.floor((width - value.length) / 2));
  return ' '.repeat(pad) + value;
}

/**
 * 58mm thermal rendering of the passbook: the same figures and rows,
 * wrapped to the thermal line width (32 chars by default). This is the
 * statement's thermal format — the app's ESC/POS byte builder is shaped
 * for single payment receipts, so the statement's thermal output is this
 * width-disciplined plain text (preview / copy / share).
 */
export function generateShopPassbookThermalText(passbook, { lang = null, widthChars = PASSBOOK_THERMAL_WIDTH } = {}) {
  const book = passbook || {};
  const rows = Array.isArray(book.rows) ? book.rows : [];
  const width = Math.max(16, Math.floor(widthChars) || PASSBOOK_THERMAL_WIDTH);
  const divider = '-'.repeat(width);
  const lines = [];
  const pushWrapped = (text) => { for (const l of wrapPassbookText(text, width)) lines.push(l); };
  lines.push(centerPassbookText('SHAHDARA ISP BILLING', width));
  lines.push(centerPassbookText(t('shop_passbook_title', lang), width));
  pushWrapped(`${t('shop_passbook_shop', lang)}: ${book.shop || ''}`);
  pushWrapped(`${book.monthLabel || ''} (${book.month || ''})`);
  lines.push(divider);
  pushWrapped(`${t('shop_passbook_opening', lang)}: ${formatShopPKR(book.openingUnsettled)}`);
  lines.push(divider);
  if (rows.length === 0) {
    pushWrapped(t('shop_passbook_empty', lang));
  } else {
    for (const row of rows) {
      const { head, sub } = passbookRowDetailLines(row, lang);
      pushWrapped(`${row.date} ${head}`);
      if (sub) pushWrapped(sub);
      const sign = row.type === 'collection' ? '+' : '-';
      pushWrapped(`${sign}${formatShopPKR(row.amount)} · ${t('shop_passbook_col_balance', lang)} ${formatShopPKR(row.balance)}`);
    }
  }
  lines.push(divider);
  pushWrapped(`${t('shop_passbook_collected_month', lang)}: ${formatShopPKR(book.totalCollected)}`);
  pushWrapped(`${t('shop_passbook_handed_month', lang)}: ${formatShopPKR(book.totalHandedOver)}`);
  pushWrapped(`${t('shop_passbook_closing', lang)}: ${formatShopPKR(book.closingUnsettled)}`);
  return lines.join('\n');
}

/**
 * Printable A4 passbook statement: a standalone HTML document, black on
 * white, following the house print conventions (SISP-60 voucher book).
 * Recorded data (shop name, customer names, refs, notes) prints as
 * stored; labels follow the requested language via t().
 */
export function generateShopPassbookPrintHtml({ passbook, lang = null, generatedDate = '' } = {}) {
  const book = passbook || {};
  const rows = Array.isArray(book.rows) ? book.rows : [];
  const bodyRows = rows.map((row) => {
    const { head, sub } = passbookRowDetailLines(row, lang);
    const detail = sub ? `${escapeHtml(head)}<br><small>${escapeHtml(sub)}</small>` : escapeHtml(head);
    const collected = row.type === 'collection' ? escapeHtml(formatShopPKR(row.amount)) : '';
    const handed = row.type === 'handover' ? escapeHtml(formatShopPKR(row.amount)) : '';
    return `
      <tr>
        <td class="date">${escapeHtml(row.date)}</td>
        <td>${detail}</td>
        <td class="amt">${collected}</td>
        <td class="amt">${handed}</td>
        <td class="amt">${escapeHtml(formatShopPKR(row.balance))}</td>
      </tr>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(t('shop_passbook_title', lang))} — ${escapeHtml(book.shop || '')} — ${escapeHtml(book.month || '')}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; font-size: 12px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
        .brand { font-size: 19px; font-weight: 800; }
        .title { font-size: 14px; font-weight: 700; }
        .meta { font-size: 11px; text-align: right; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #eee; font-size: 11px; }
        td.date { white-space: nowrap; }
        td.amt, th.amt { text-align: right; white-space: nowrap; }
        tr.subtotal td { background: #f3f3f3; font-weight: 700; }
        tr.grand td { border-top: 2px solid #000; font-weight: 800; font-size: 13px; }
        .empty { text-align: center; padding: 22px; font-size: 12px; }
        small { color: #444; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">SHAHDARA FIBER NET</div>
          <div class="title">${escapeHtml(t('shop_passbook_title', lang))}</div>
          <div>${escapeHtml(t('shop_passbook_shop', lang))}: ${escapeHtml(book.shop || '')} · ${escapeHtml(book.monthLabel || '')} (${escapeHtml(book.month || '')})</div>
        </div>
        <div class="meta">
          <div>${escapeHtml(t('shop_passbook_generated_on', lang, { date: generatedDate || '—' }))}</div>
          <div>${escapeHtml(t('shop_passbook_opening', lang))}: ${escapeHtml(formatShopPKR(book.openingUnsettled))}</div>
        </div>
      </div>
      ${rows.length ? `
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('shop_passbook_col_date', lang))}</th>
            <th>${escapeHtml(t('shop_passbook_col_details', lang))}</th>
            <th class="amt">${escapeHtml(t('shop_passbook_col_collected', lang))}</th>
            <th class="amt">${escapeHtml(t('shop_passbook_col_handed', lang))}</th>
            <th class="amt">${escapeHtml(t('shop_passbook_col_balance', lang))}</th>
          </tr>
        </thead>
        <tbody>
          <tr class="subtotal">
            <td colspan="4">${escapeHtml(t('shop_passbook_opening', lang))}</td>
            <td class="amt">${escapeHtml(formatShopPKR(book.openingUnsettled))}</td>
          </tr>
          ${bodyRows}
          <tr class="subtotal">
            <td colspan="2">${escapeHtml(t('shop_passbook_collected_month', lang))}</td>
            <td class="amt">${escapeHtml(formatShopPKR(book.totalCollected))}</td>
            <td></td>
            <td></td>
          </tr>
          <tr class="subtotal">
            <td colspan="2">${escapeHtml(t('shop_passbook_handed_month', lang))}</td>
            <td></td>
            <td class="amt">${escapeHtml(formatShopPKR(book.totalHandedOver))}</td>
            <td></td>
          </tr>
          <tr class="grand">
            <td colspan="4">${escapeHtml(t('shop_passbook_closing', lang))}</td>
            <td class="amt">${escapeHtml(formatShopPKR(book.closingUnsettled))}</td>
          </tr>
        </tbody>
      </table>` : `<div class="empty">${escapeHtml(t('shop_passbook_empty', lang))}</div>
      <p><strong>${escapeHtml(t('shop_passbook_opening', lang))}: ${escapeHtml(formatShopPKR(book.openingUnsettled))} · ${escapeHtml(t('shop_passbook_closing', lang))}: ${escapeHtml(formatShopPKR(book.closingUnsettled))}</strong></p>`}
    </body>
    </html>
  `;
}

/**
 * Wires the shop settlement modal (dialog in index.html). Pure logic lives
 * above; this controller only renders and delegates persistence to the app
 * via onUpdateState (new ledger state) and onSettlementsSaved.
 */
export function setupShopSettlementModal(getState, { onUpdateState, onSettlementsSaved, onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('shopSettlementModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const shopSelect = $('shopSettlementShopSelect');
  const receiptList = $('shopSettlementReceiptList');
  const amountInput = $('shopSettlementAmountInput');
  const grossValue = $('shopSettlementGrossValue');
  const netInput = $('shopSettlementNetInput');
  const deductionInput = $('shopSettlementDeductionInput');
  const splitHint = $('shopSettlementSplitHint');
  const dateInput = $('shopSettlementDateInput');
  const noteInput = $('shopSettlementNoteInput');
  const receivedIntoSelect = $('shopSettlementReceivedIntoSelect');
  const receiptBox = $('shopSettlementReceiptText');
  const receiptActions = $('shopSettlementReceiptActions');
  let currentShop = null;

  function renderShops() {
    const state = getState() || { customers: [] };
    const settlements = loadShopSettlements();
    const summaries = buildShopSummaries(state, settlements);
    const cards = $('shopSettlementCards');
    if (cards) {
      cards.innerHTML = summaries.length === 0
        ? '<p class="shop-settlement-empty">No shop collections recorded yet.</p>'
        : summaries.map((s) => {
          // SISP-124: aging highlight + 1-tap WhatsApp handover reminder.
          // Below both thresholds the card renders exactly as before.
          const aging = shopAgingForSummary(state, s);
          const agingBlock = aging.level ? `
            <p class="shop-aging-line"><span class="shop-aging-badge shop-aging-badge--${aging.level}">${escapeHtml(shopAgingBadgeText(aging))}</span></p>
            <button type="button" class="secondary-button shop-aging-remind-btn" data-shop-aging-remind="${escapeHtml(s.shop)}">📲 ${escapeHtml(t('shopage_remind_btn'))}</button>` : '';
          return `
          <article class="shop-settlement-card${aging.level ? ` shop-settlement-card--aging-${aging.level}` : ''}" data-shop="${escapeHtml(s.shop)}">
            <h3>${escapeHtml(s.shop)}</h3>
            <p><span>Unsettled cash in hand</span><strong>${escapeHtml(formatShopPKR(s.unsettled))}</strong></p>
            <p><span>Collected this month</span><strong>${escapeHtml(formatShopPKR(s.collectedThisMonth))}</strong></p>
            <p><span>Last handover</span><strong>${escapeHtml(s.lastHandoverDate || 'Never')}</strong></p>
            <p><span>Receipts since last settlement</span><strong>${escapeHtml(String(s.receiptsSinceLastSettlement))}</strong></p>${agingBlock}
            <button type="button" class="secondary-button shop-settlement-view-btn" data-shop="${escapeHtml(s.shop)}">View pending receipts</button>
          </article>`;
        }).join('');
    }
    if (shopSelect) {
      const previous = currentShop;
      shopSelect.innerHTML = summaries.map((s) => `<option value="${escapeHtml(s.shop)}">${escapeHtml(s.shop)} — unsettled ${escapeHtml(formatShopPKR(s.unsettled))}</option>`).join('');
      if (previous && summaries.some((s) => s.shop === previous)) shopSelect.value = previous;
      currentShop = shopSelect.value || null;
    }
    renderReceipts();
  }

  // SISP-149: split helpers. The gross is the handover amount; editing
  // the amount or the deduction re-derives the net cash, editing the
  // net re-derives the deduction, and the hint always shows whether
  // net + deduction adds back up to the gross.
  function splitValues() {
    return {
      gross: Number(amountInput ? amountInput.value : 0) || 0,
      net: Number(netInput ? netInput.value : 0) || 0,
      deduction: Number(deductionInput ? deductionInput.value : 0) || 0
    };
  }

  function splitIsValid({ gross, net, deduction }) {
    return gross > 0 && net >= 0 && deduction >= 0 && round2(net + deduction) === round2(gross);
  }

  function syncSplit(changed) {
    if (!netInput || !deductionInput) return;
    const values = splitValues();
    if (changed === 'net') {
      deductionInput.value = String(round2(values.gross - values.net));
    } else {
      netInput.value = String(round2(values.gross - values.deduction));
    }
    const next = splitValues();
    if (splitHint) {
      const valid = splitIsValid(next);
      splitHint.textContent = valid
        ? t('shopded_split_hint_ok', null, { net: formatShopPKR(next.net), deduction: formatShopPKR(next.deduction), total: formatShopPKR(next.gross) })
        : t('shopded_split_hint_bad', null, { total: formatShopPKR(next.gross) });
      splitHint.classList.toggle('is-invalid', !valid);
    }
  }

  function updateGrossLine() {
    if (!grossValue) return;
    const state = getState() || { customers: [] };
    const pendingTotal = currentShop
      ? pendingShopReceipts(state, currentShop).reduce((sum, p) => sum + p.remaining, 0)
      : 0;
    grossValue.textContent = currentShop ? formatShopPKR(pendingTotal) : '—';
  }

  function renderReceipts() {
    if (!receiptList) return;
    updateGrossLine();
    const state = getState() || { customers: [] };
    if (!currentShop) {
      receiptList.innerHTML = '<p class="shop-settlement-empty">Select a shop to see its pending receipts.</p>';
      return;
    }
    const pending = pendingShopReceipts(state, currentShop);
    receiptList.innerHTML = pending.length === 0
      ? `<p class="shop-settlement-empty">No pending receipts at ${escapeHtml(currentShop)} — all cash handed over.</p>`
      : `<ul class="shop-settlement-receipt-list">${pending.map((p) => `
        <li><span><strong>#${escapeHtml(String(p.customerNumber ?? ''))} ${escapeHtml(p.customerName)}</strong><br><small>${escapeHtml(p.date || '')} · ${escapeHtml(p.method)}</small></span><span>${escapeHtml(formatShopPKR(p.amount))}${p.settledAmount > 0 ? `<br><small>Settled ${escapeHtml(formatShopPKR(p.settledAmount))} · left ${escapeHtml(formatShopPKR(p.remaining))}</small>` : ''}</span></li>`).join('')}</ul>`;
  }

  function showReceipt(settlement, remainingUnsettled) {
    if (!receiptBox) return;
    const text = generateShopSettlementReceiptText({ shop: settlement.shop, settlement, remainingUnsettled });
    receiptBox.textContent = text;
    if (receiptActions) receiptActions.hidden = false;
    const copyBtn = $('shopSettlementCopyBtn');
    const waBtn = $('shopSettlementWhatsAppBtn');
    const printBtn = $('shopSettlementPrintBtn');
    if (copyBtn) copyBtn.onclick = async () => {
      try { await navigator.clipboard.writeText(text); onToast && onToast('Settlement receipt copied.'); }
      catch { onToast && onToast('Copy failed — select the receipt text manually.'); }
    };
    if (waBtn) waBtn.onclick = () => window.open(shopSettlementWhatsAppUrl(text), '_blank');
    if (printBtn) printBtn.onclick = () => window.print();
  }

  // SISP-105: Monthly Shop Passbook Statement controls. The section's
  // markup is rendered here so every label goes through t(); the static
  // index.html only carries the empty #shopPassbookSection container.
  // Generating, copying, sharing or printing a statement writes nothing.
  const passbookSection = typeof document !== 'undefined' ? document.getElementById('shopPassbookSection') : null;
  let passbookModel = null;
  let passbookThermalView = false;
  if (passbookSection) {
    passbookSection.innerHTML = `
      <h3>${escapeHtml(t('shop_passbook_title'))}</h3>
      <div class="shop-passbook-controls">
        <label for="shopPassbookMonthInput">${escapeHtml(t('shop_passbook_month'))}
          <input id="shopPassbookMonthInput" class="form-input" type="month">
        </label>
        <button id="shopPassbookGenerateBtn" class="secondary-button" type="button">${escapeHtml(t('shop_passbook_generate'))}</button>
      </div>
      <div id="shopPassbookOutput"></div>
      <pre id="shopPassbookText" class="shop-settlement-receipt-text" hidden></pre>
      <div id="shopPassbookActions" class="shop-passbook-actions" hidden>
        <button id="shopPassbookCopyBtn" class="secondary-button" type="button">${escapeHtml(t('shop_passbook_copy'))}</button>
        <button id="shopPassbookWhatsAppBtn" class="secondary-button" type="button">${escapeHtml(t('shop_passbook_whatsapp'))}</button>
        <button id="shopPassbookPrintBtn" class="secondary-button" type="button">${escapeHtml(t('shop_passbook_print'))}</button>
        <button id="shopPassbookThermalBtn" class="secondary-button" type="button">${escapeHtml(t('shop_passbook_thermal'))}</button>
      </div>`;
    const monthInput = passbookSection.querySelector('#shopPassbookMonthInput');
    const outputBox = passbookSection.querySelector('#shopPassbookOutput');
    const textBox = passbookSection.querySelector('#shopPassbookText');
    const actionsBox = passbookSection.querySelector('#shopPassbookActions');
    if (monthInput && !monthInput.value) monthInput.value = pakistanMonth();

    const currentPassbookText = () => (passbookThermalView
      ? generateShopPassbookThermalText(passbookModel)
      : generateShopPassbookText(passbookModel));

    const renderPassbook = () => {
      if (!passbookModel) return;
      const book = passbookModel;
      if (outputBox) {
        const rowsHtml = book.rows.length === 0
          ? `<p class="shop-settlement-empty">${escapeHtml(t('shop_passbook_empty'))}</p>`
          : `<ul class="shop-passbook-rows">${book.rows.map((row) => {
            const { head, sub } = passbookRowDetailLines(row, null);
            const signed = `${row.type === 'collection' ? '+' : '−'}${escapeHtml(formatShopPKR(row.amount))}`;
            return `<li><span><strong>${escapeHtml(row.date)} · ${escapeHtml(head)}</strong>${sub ? `<br><small>${escapeHtml(sub)}</small>` : ''}</span><span>${signed}<br><small>${escapeHtml(t('shop_passbook_col_balance'))} ${escapeHtml(formatShopPKR(row.balance))}</small></span></li>`;
          }).join('')}</ul>`;
        outputBox.innerHTML = `
          <div class="shop-settlement-summary">
            <p><span>${escapeHtml(t('shop_passbook_shop'))}</span><strong>${escapeHtml(book.shop)}</strong><small>${escapeHtml(book.monthLabel)} (${escapeHtml(book.month)})</small></p>
            <p><span>${escapeHtml(t('shop_passbook_opening'))}</span><strong>${escapeHtml(formatShopPKR(book.openingUnsettled))}</strong></p>
            <p><span>${escapeHtml(t('shop_passbook_collected_month'))}</span><strong>${escapeHtml(formatShopPKR(book.totalCollected))}</strong></p>
            <p><span>${escapeHtml(t('shop_passbook_handed_month'))}</span><strong>${escapeHtml(formatShopPKR(book.totalHandedOver))}</strong></p>
            <p><span>${escapeHtml(t('shop_passbook_closing'))}</span><strong>${escapeHtml(formatShopPKR(book.closingUnsettled))}</strong></p>
          </div>
          ${rowsHtml}`;
      }
      if (textBox) {
        textBox.textContent = currentPassbookText();
        textBox.hidden = false;
      }
      if (actionsBox) actionsBox.hidden = false;
      const thermalBtn = passbookSection.querySelector('#shopPassbookThermalBtn');
      if (thermalBtn) thermalBtn.textContent = passbookThermalView ? t('shop_passbook_standard') : t('shop_passbook_thermal');
    };

    const generateBtn = passbookSection.querySelector('#shopPassbookGenerateBtn');
    if (generateBtn) generateBtn.addEventListener('click', () => {
      if (!currentShop) {
        onToast && onToast(t('shop_passbook_pick_shop'));
        return;
      }
      const month = monthInput && PASSBOOK_MONTH_RE.test(monthInput.value || '') ? monthInput.value : pakistanMonth();
      passbookModel = buildShopPassbook(getState() || { customers: [] }, loadShopSettlements(), currentShop, month);
      passbookThermalView = false;
      renderPassbook();
    });
    const copyBtn = passbookSection.querySelector('#shopPassbookCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      if (!passbookModel) return;
      try { await navigator.clipboard.writeText(currentPassbookText()); onToast && onToast(t('shop_passbook_copied')); }
      catch { onToast && onToast(t('shop_passbook_copy_failed')); }
    });
    const waBtn = passbookSection.querySelector('#shopPassbookWhatsAppBtn');
    if (waBtn) waBtn.addEventListener('click', () => {
      if (!passbookModel) return;
      window.open(shopSettlementWhatsAppUrl(currentPassbookText()), '_blank');
    });
    const printBtn = passbookSection.querySelector('#shopPassbookPrintBtn');
    if (printBtn) printBtn.addEventListener('click', () => {
      if (!passbookModel) return;
      const html = generateShopPassbookPrintHtml({ passbook: passbookModel, generatedDate: pakistanToday() });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      } else if (onToast) {
        onToast(t('shop_passbook_popup_blocked'));
      }
    });
    const thermalBtn = passbookSection.querySelector('#shopPassbookThermalBtn');
    if (thermalBtn) thermalBtn.addEventListener('click', () => {
      if (!passbookModel) return;
      passbookThermalView = !passbookThermalView;
      renderPassbook();
    });
  }

  if (shopSelect) shopSelect.addEventListener('change', () => { currentShop = shopSelect.value || null; renderReceipts(); });
  if (amountInput) amountInput.addEventListener('input', () => syncSplit('amount'));
  if (deductionInput) deductionInput.addEventListener('input', () => syncSplit('deduction'));
  if (netInput) netInput.addEventListener('input', () => syncSplit('net'));
  const cards = $('shopSettlementCards');
  if (cards) cards.addEventListener('click', (event) => {
    // SISP-124: itemized WhatsApp handover reminder (recipient-less draft —
    // no shopkeeper phone is recorded in the app, the owner picks it).
    const remindBtn = event.target.closest('.shop-aging-remind-btn');
    if (remindBtn) {
      const state = getState() || { customers: [] };
      const settlements = loadShopSettlements();
      const summary = buildShopSummaries(state, settlements).find((s) => s.shop === remindBtn.dataset.shopAgingRemind);
      if (!summary) return;
      const aging = shopAgingForSummary(state, summary);
      const text = buildShopAgingReminderText(state, aging);
      if (text) window.open(shopSettlementWhatsAppUrl(text), '_blank');
      return;
    }
    const btn = event.target.closest('.shop-settlement-view-btn');
    if (!btn || !shopSelect) return;
    currentShop = btn.dataset.shop;
    shopSelect.value = currentShop;
    renderReceipts();
    receiptList && receiptList.scrollIntoView({ block: 'nearest' });
  });
  const form = $('shopSettlementForm');
  if (form) form.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = getState() || { customers: [] };
    const shop = shopSelect ? shopSelect.value : currentShop;
    const amount = Number(amountInput ? amountInput.value : 0);
    // SISP-149: a deduction above zero takes the split path (validated
    // live by the hint and again inside applySettlement); zero keeps
    // the legacy call byte-identical.
    const split = splitValues();
    if (split.deduction > 0 && !splitIsValid(split)) {
      onToast && onToast(t('shopded_split_invalid_toast'));
      return;
    }
    const receivedInto = normalizeReceivedInto(receivedIntoSelect ? receivedIntoSelect.value : 'drawer');
    try {
      const { state: next, settlement, leftover } = split.deduction > 0
        ? applySettlement(state, shop, amount, dateInput ? dateInput.value : '', noteInput ? noteInput.value : '', { receivedInto, netCash: split.net, deduction: split.deduction })
        : applySettlement(state, shop, amount, dateInput ? dateInput.value : '', noteInput ? noteInput.value : '', { receivedInto });
      const settlements = [...loadShopSettlements(), settlement];
      saveShopSettlements(settlements);
      onSettlementsSaved && onSettlementsSaved(settlements);
      // SISP-68: a partner pickup lands in the SISP-22 partner ledger as
      // a linked drawing. The reconcile is convergent (keyed by the
      // settlement id), so running it here — and again at startup or
      // after a backup restore — records the drawing exactly once.
      const pickupPartner = partnerForReceivedInto(receivedInto);
      if (pickupPartner) {
        const mirror = syncShopPickupDrawings(loadPartnerLedgerEntries(), settlements);
        if (mirror.changed) savePartnerLedgerEntries(mirror.entries);
      }
      onUpdateState && onUpdateState(next);
      const remaining = buildShopSummaries(next, settlements).find((s) => s.shop === shop)?.unsettled ?? 0;
      showReceipt(settlement, remaining);
      if (split.deduction > 0) {
        onToast && onToast(t('shopded_recorded_toast', null, { net: formatShopPKR(settlement.netCash), deduction: formatShopPKR(settlement.deduction), shop }));
        if (deductionInput) deductionInput.value = '0';
        if (netInput) netInput.value = '';
        if (splitHint) splitHint.textContent = '';
      } else if (leftover > 0) onToast && onToast(`Only ${formatShopPKR(settlement.amount)} was unsettled; ${formatShopPKR(leftover)} was not recorded.`);
      else if (pickupPartner) onToast && onToast(`Received ${formatShopPKR(settlement.amount)} from ${shop} — kept by ${pickupPartner}; partner drawing recorded.`);
      else onToast && onToast(`Received ${formatShopPKR(settlement.amount)} from ${shop}.`);
      renderShops();
    } catch (error) {
      onToast && onToast(error && error.message ? error.message : 'Settlement could not be recorded.');
    }
  });
  const closeBtn = $('shopSettlementCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  // Dashboard summary-card trigger, wired here like setupDailyClosingModal
  // wires openDailyClosingModalBtn inside its own module.
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openShopSettlementModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    renderShops();
    if (dateInput && !dateInput.value) dateInput.value = pakistanToday();
    dialog.showModal();
  });

  return {
    open(shop) {
      if (shop) currentShop = shop;
      renderShops();
      if (dateInput && !dateInput.value) dateInput.value = pakistanToday();
      dialog.showModal();
    },
    refresh: renderShops
  };
}
