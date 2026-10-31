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
 * All helpers are pure except load/saveShopSettlements and the modal setup.
 * Tests use synthetic data only.
 */

import {
  loadPartnerLedgerEntries,
  savePartnerLedgerEntries,
  syncShopPickupDrawings
} from './partner-settlement.js';

export const SHOP_SETTLEMENTS_KEY = 'sisp_shop_settlements_v1';

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
    out.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `shop-settle-${Date.now()}`,
      shop: entry.shop,
      amount,
      date: entry.date,
      note: typeof entry.note === 'string' ? entry.note : '',
      // SISP-68: persisted only for partner pickups; absence means the
      // cash went into the Roznamcha drawer (legacy records unchanged).
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
    });
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
  return { state: next, settlement, leftover };
}

/** Plain-text settlement receipt (printable + WhatsApp), PKR formatted. */
export function generateShopSettlementReceiptText({ shop, settlement, remainingUnsettled = 0 } = {}) {
  const lines = [];
  lines.push('Shahdara ISP Billing — Shop Settlement Receipt');
  lines.push(`Shop: ${shop}`);
  lines.push(`Handover date: ${settlement?.date || ''}`);
  lines.push(`Amount received: ${formatShopPKR(settlement?.amount)}`);
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
        : summaries.map((s) => `
          <article class="shop-settlement-card" data-shop="${escapeHtml(s.shop)}">
            <h3>${escapeHtml(s.shop)}</h3>
            <p><span>Unsettled cash in hand</span><strong>${escapeHtml(formatShopPKR(s.unsettled))}</strong></p>
            <p><span>Collected this month</span><strong>${escapeHtml(formatShopPKR(s.collectedThisMonth))}</strong></p>
            <p><span>Last handover</span><strong>${escapeHtml(s.lastHandoverDate || 'Never')}</strong></p>
            <p><span>Receipts since last settlement</span><strong>${escapeHtml(String(s.receiptsSinceLastSettlement))}</strong></p>
            <button type="button" class="secondary-button shop-settlement-view-btn" data-shop="${escapeHtml(s.shop)}">View pending receipts</button>
          </article>`).join('');
    }
    if (shopSelect) {
      const previous = currentShop;
      shopSelect.innerHTML = summaries.map((s) => `<option value="${escapeHtml(s.shop)}">${escapeHtml(s.shop)} — unsettled ${escapeHtml(formatShopPKR(s.unsettled))}</option>`).join('');
      if (previous && summaries.some((s) => s.shop === previous)) shopSelect.value = previous;
      currentShop = shopSelect.value || null;
    }
    renderReceipts();
  }

  function renderReceipts() {
    if (!receiptList) return;
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

  if (shopSelect) shopSelect.addEventListener('change', () => { currentShop = shopSelect.value || null; renderReceipts(); });
  const cards = $('shopSettlementCards');
  if (cards) cards.addEventListener('click', (event) => {
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
    const receivedInto = normalizeReceivedInto(receivedIntoSelect ? receivedIntoSelect.value : 'drawer');
    try {
      const { state: next, settlement, leftover } = applySettlement(
        state, shop, amount, dateInput ? dateInput.value : '', noteInput ? noteInput.value : '',
        { receivedInto }
      );
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
      if (leftover > 0) onToast && onToast(`Only ${formatShopPKR(settlement.amount)} was unsettled; ${formatShopPKR(leftover)} was not recorded.`);
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
