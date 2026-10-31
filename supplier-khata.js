/**
 * supplier-khata.js — SISP-107: Wholesale Hardware Supplier Credit /
 * Payable Khata (ادھار خریداری کھاتہ).
 *
 * The owner buys routers, media converters and fiber in bulk from
 * wholesale suppliers, often part-paid: some cash now, the rest owed.
 * Before SISP-107 the owed half lived in memory or on paper — easy to
 * forget, easy to pay twice. This register tracks each credit purchase:
 *
 *   { purchaseId (SUP-101+), supplierName, itemId (SISP-18 catalog id),
 *     qty, totalBillPKR, date, note, stockMovementId,
 *     payments: [{ payoutId (SUP-101-P1+), kind ('upfront'|'payout'),
 *                  date, amountPKR, note, createdAt }],
 *     createdAt }
 *
 * The spec field `pendingSupplierPayablePKR` is always DERIVED —
 * totalBillPKR minus the sum of the recorded payments — never stored as
 * a free-typed figure, so the payable can never drift from the payment
 * records. The upfront amountPaidNowPKR is simply the first payment
 * entry (kind 'upfront').
 *
 * Stock: the purchased items enter the SISP-18 inventory book ONLY
 * through its own stock-in path (inventory-book.js addMovement ->
 * sisp_inventory_v1); the app stamps the resulting movement id onto the
 * purchase as `stockMovementId`. This module never writes inventory.
 *
 * Expenses: money leaves the business exactly when cash is paid — the
 * upfront payment and each later payout are each ONE Monthly Expenses
 * row (state.expenses), mirrored by syncSupplierKhataExpenses, a
 * convergent reconcile in the SISP-45/56 shape: every payment entry owns
 * exactly one expense row carrying supplierKhataId + supplierPayoutId
 * link fields and the deterministic id `supplier-khata-<payoutId>`.
 * Re-running the sync changes nothing; a corrected khata payment updates
 * its row in place; a vanished payment removes its row; manual expenses
 * are never touched. Over the life of a purchase the mirrored expenses
 * therefore total exactly totalBillPKR — never more: payouts beyond the
 * derived payable are refused.
 *
 * Expense category comes from the purchased item via
 * SUPPLIER_EXPENSE_CATEGORY_BY_ITEM — every value is an existing
 * EXPENSE_CATEGORIES entry, so dashboard-pnl.js buckets supplier spend
 * with no new category string.
 *
 * This is a BUSINESS payable register. It shares nothing with the
 * owner's personal Home Budget or the Loan ledger (different stores,
 * different surfaces).
 *
 * Storage: records live in localStorage under SUPPLIER_KHATA_KEY
 * (sisp_supplier_khata_v1), a flat array; the register starts empty —
 * nothing is seeded. Backup: records travel in the JSON backup
 * `settings.supplierKhata` section (see core.js), under the same
 * safe-merge rule as the SISP-37 suspense register: adopted only when
 * this device has none stored yet.
 *
 * The pure helpers stay testable without the app; the modal controller
 * at the bottom needs a DOM and is inspection-verified (no DOM harness
 * in node:test), like the other modal controllers. Cross-store writes
 * (stock-in, expense sync, state persist) are injected by app.js via the
 * onLogPurchase / onRecordPayout callbacks — this module never mutates
 * inventory, expenses or balances itself. Tests use synthetic data only.
 */

import { EXPENSE_CATEGORIES } from './phase3.js';
import { INVENTORY_ITEMS, inventoryItemById, isValidMovementQty } from './inventory-book.js';
import { t } from './nav-language.js';

export const SUPPLIER_KHATA_KEY = 'sisp_supplier_khata_v1';

const PURCHASE_ID_RE = /^SUP-(\d+)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Expense category per SISP-18 catalog item. Every value MUST stay a
 * member of EXPENSE_CATEGORIES (phase3.js) so the P&L category
 * breakdown buckets supplier spend without a new category string:
 * routers are bought under 'Routers', media converters are the ONU-side
 * device ('ONU'), cable-family stock under 'Cable', and small hardware
 * (connectors, poles) under 'Other expenses'.
 */
export const SUPPLIER_EXPENSE_CATEGORY_BY_ITEM = Object.freeze({
  'router': 'Routers',
  'media-converter': 'ONU',
  'fiber-2core': 'Cable',
  'patch-cord': 'Cable',
  'cat6': 'Cable',
  'rj45': 'Other expenses',
  'pole': 'Other expenses'
});

/** The EXPENSE_CATEGORIES value a purchase's cash-outs post under. */
export function supplierExpenseCategory(itemId) {
  const category = SUPPLIER_EXPENSE_CATEGORY_BY_ITEM[itemId];
  return EXPENSE_CATEGORIES.includes(category) ? category : 'Other expenses';
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&gt;')
    .replace(/>/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rupeesOf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Whole rupees grouped, e.g. 6500 -> "Rs. 6,500"; paise only when nonzero. */
export function formatSupplierPKR(rupees) {
  const value = Number(rupees) || 0;
  return `Rs. ${value.toLocaleString('en-PK', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

/** Next purchase id: one above the highest SUP-N already stored (starts at 101). */
export function nextSupplierPurchaseId(records) {
  let max = 100;
  for (const record of Array.isArray(records) ? records : []) {
    const match = PURCHASE_ID_RE.exec(String(record?.purchaseId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `SUP-${max + 1}`;
}

function sanitizePayments(value, purchaseId, totalBillPKR) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const used = new Set();
  let running = 0;
  let seq = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const amountPKR = rupeesOf(entry.amountPKR);
    if (!(amountPKR > 0)) continue;
    if (!isValidDateKey(entry.date)) continue;
    // A stored payment list can never exceed the bill: keep entries in
    // stored order only while the running total stays within the bill,
    // so the derived payable is never negative.
    if (running + amountPKR > totalBillPKR + 1e-9) continue;
    running = Math.round((running + amountPKR) * 100) / 100;
    seq += 1;
    let payoutId = cleanText(entry.payoutId);
    const ownId = new RegExp(`^${purchaseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-P\\d+$`);
    if (!ownId.test(payoutId) || used.has(payoutId)) payoutId = `${purchaseId}-P${seq}`;
    while (used.has(payoutId)) { seq += 1; payoutId = `${purchaseId}-P${seq}`; }
    used.add(payoutId);
    out.push({
      payoutId,
      kind: entry.kind === 'upfront' ? 'upfront' : 'payout',
      date: entry.date,
      amountPKR,
      note: cleanText(entry.note).slice(0, 200),
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Drops malformed rows; keeps clean purchase records in stored order. */
export function sanitizeSupplierKhata(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const supplierName = cleanText(entry.supplierName).slice(0, 100);
    if (!supplierName) continue;
    const itemId = cleanText(entry.itemId);
    if (!inventoryItemById(itemId)) continue;
    if (!isValidMovementQty(itemId, entry.qty)) continue;
    const totalBillPKR = rupeesOf(entry.totalBillPKR);
    if (!(totalBillPKR > 0)) continue;
    if (!isValidDateKey(entry.date)) continue;
    const purchaseId = PURCHASE_ID_RE.test(String(entry.purchaseId || '')) ? String(entry.purchaseId) : '';
    out.push({
      purchaseId,
      supplierName,
      itemId,
      qty: Number(entry.qty),
      totalBillPKR,
      date: entry.date,
      note: cleanText(entry.note).slice(0, 300),
      stockMovementId: cleanText(entry.stockMovementId),
      payments: [],
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
    const target = out[out.length - 1];
    target.payments = sanitizePayments(entry.payments, purchaseId || 'SUP-0', totalBillPKR);
  }
  // Fill in ids for rows that arrived without one, in stored order.
  let next = 101;
  const used = new Set(out.map((r) => r.purchaseId).filter(Boolean));
  for (const record of out) {
    if (!record.purchaseId) {
      while (used.has(`SUP-${next}`)) next++;
      record.purchaseId = `SUP-${next}`;
      used.add(record.purchaseId);
      next++;
      // Payment ids were derived against the placeholder id; re-derive.
      record.payments = sanitizePayments(record.payments, record.purchaseId, record.totalBillPKR);
    }
  }
  return out;
}

/** Total cash recorded against a purchase (upfront + payouts). */
export function supplierPaidTotal(record) {
  const payments = record && Array.isArray(record.payments) ? record.payments : [];
  return Math.round(payments.reduce((sum, p) => sum + (Number(p?.amountPKR) || 0), 0) * 100) / 100;
}

/**
 * pendingSupplierPayablePKR — always derived from the payment records:
 * totalBillPKR minus everything recorded as paid. Never negative.
 */
export function supplierPayable(record) {
  const total = rupeesOf(record?.totalBillPKR);
  return Math.max(0, Math.round((total - supplierPaidTotal(record)) * 100) / 100);
}

/** Register totals for the dashboard/modal header. */
export function supplierKhataSummary(records) {
  const clean = sanitizeSupplierKhata(records);
  let totalBilled = 0;
  let totalPaid = 0;
  let totalPayable = 0;
  let openCount = 0;
  for (const record of clean) {
    totalBilled += record.totalBillPKR;
    totalPaid += supplierPaidTotal(record);
    const payable = supplierPayable(record);
    totalPayable += payable;
    if (payable > 0) openCount += 1;
  }
  const round = (n) => Math.round(n * 100) / 100;
  return {
    purchaseCount: clean.length,
    openCount,
    totalBilledPKR: round(totalBilled),
    totalPaidPKR: round(totalPaid),
    totalPayablePKR: round(totalPayable)
  };
}

/** Validates a purchase form payload; throws with a plain message. */
export function buildSupplierPurchaseFields(input) {
  const supplierName = cleanText(input?.supplierName).slice(0, 100);
  if (!supplierName) throw new Error('Supplier name is required.');
  const itemId = cleanText(input?.itemId);
  if (!inventoryItemById(itemId)) throw new Error('Choose a stock item for this purchase.');
  if (!isValidMovementQty(itemId, input?.qty)) {
    throw new Error('Quantity must be positive (whole units for unit items).');
  }
  const totalBillPKR = rupeesOf(input?.totalBillPKR);
  if (!(totalBillPKR > 0)) throw new Error('Total bill is required — enter the full bill amount (Rs.).');
  const amountPaidNowPKR = input?.amountPaidNowPKR === undefined || input?.amountPaidNowPKR === null || input?.amountPaidNowPKR === ''
    ? 0
    : rupeesOf(input.amountPaidNowPKR);
  if (amountPaidNowPKR < 0) throw new Error('Amount paid now cannot be negative.');
  if (amountPaidNowPKR > totalBillPKR) throw new Error('Amount paid now cannot exceed the total bill.');
  const date = cleanText(input?.date);
  if (!isValidDateKey(date)) throw new Error('Purchase date is required.');
  return {
    supplierName,
    itemId,
    qty: Number(input.qty),
    totalBillPKR,
    amountPaidNowPKR,
    date,
    note: cleanText(input?.note).slice(0, 300)
  };
}

/**
 * Appends one credit purchase. The upfront payment (when > 0) becomes
 * the first payment entry, kind 'upfront', payoutId `<purchaseId>-P1`.
 * Stock-in is NOT done here — the caller runs the SISP-18 stock-in path
 * and stamps the movement id via stampStockMovement. Input untouched.
 */
export function addSupplierPurchase(records, input) {
  const fields = buildSupplierPurchaseFields(input);
  const clean = sanitizeSupplierKhata(records);
  const purchaseId = nextSupplierPurchaseId(clean);
  const createdAt = new Date().toISOString();
  const payments = fields.amountPaidNowPKR > 0
    ? [{ payoutId: `${purchaseId}-P1`, kind: 'upfront', date: fields.date, amountPKR: fields.amountPaidNowPKR, note: '', createdAt }]
    : [];
  const purchase = {
    purchaseId,
    supplierName: fields.supplierName,
    itemId: fields.itemId,
    qty: fields.qty,
    totalBillPKR: fields.totalBillPKR,
    date: fields.date,
    note: fields.note,
    stockMovementId: '',
    payments,
    createdAt
  };
  return { records: [...clean, purchase], purchase };
}

/** Stamps the SISP-18 stock-in movement id onto a purchase (link only). */
export function stampStockMovement(records, purchaseId, movementId) {
  const clean = sanitizeSupplierKhata(records);
  return clean.map((record) => (String(record.purchaseId) === String(purchaseId)
    ? { ...record, stockMovementId: cleanText(movementId) }
    : record));
}

/** Validates a payout payload against a purchase's derived payable. */
export function buildSupplierPayoutFields(record, input) {
  if (!record) throw new Error('Supplier purchase not found.');
  const payable = supplierPayable(record);
  if (!(payable > 0)) throw new Error('This purchase is fully paid — nothing is owed.');
  const amountPKR = input?.amountPKR === undefined || input?.amountPKR === null || input?.amountPKR === ''
    ? payable
    : rupeesOf(input.amountPKR);
  if (!(amountPKR > 0)) throw new Error('Payout amount must be greater than zero.');
  if (amountPKR > payable) {
    throw new Error(`Payout exceeds the balance owed (${formatSupplierPKR(payable)}). It was not recorded.`);
  }
  const date = cleanText(input?.date);
  if (!isValidDateKey(date)) throw new Error('Payout date is required.');
  return { amountPKR, date, note: cleanText(input?.note).slice(0, 200) };
}

/**
 * Records one payout against a purchase. Refuses overpayment beyond the
 * derived payable, so the khata can never go negative. Input untouched.
 */
export function addSupplierPayout(records, purchaseId, input) {
  const clean = sanitizeSupplierKhata(records);
  const target = clean.find((r) => String(r.purchaseId) === String(purchaseId));
  const fields = buildSupplierPayoutFields(target, input);
  const payout = {
    payoutId: `${target.purchaseId}-P${target.payments.length + 1}`,
    kind: 'payout',
    date: fields.date,
    amountPKR: fields.amountPKR,
    note: fields.note,
    createdAt: new Date().toISOString()
  };
  // payoutIds stay unique even if an earlier entry was hand-shaped.
  const used = new Set(target.payments.map((p) => p.payoutId));
  let seq = target.payments.length + 1;
  while (used.has(payout.payoutId)) { seq += 1; payout.payoutId = `${target.purchaseId}-P${seq}`; }
  const updated = { ...target, payments: [...target.payments, payout] };
  return {
    records: clean.map((r) => (String(r.purchaseId) === String(purchaseId) ? updated : r)),
    purchase: updated,
    payout
  };
}

/** Deterministic Monthly Expenses row id for one khata payment entry. */
export function supplierExpenseId(payoutId) {
  return `supplier-khata-${payoutId}`;
}

/** The expense note a khata payment mirrors under (deterministic). */
export function buildSupplierExpenseNote(purchase, payment) {
  const item = inventoryItemById(purchase?.itemId);
  const itemLabel = item ? `${item.name} ×${purchase.qty}` : String(purchase?.itemId || '');
  const kindLabel = payment?.kind === 'upfront' ? 'upfront payment' : 'balance payout';
  return `Supplier khata ${purchase?.purchaseId || ''} · ${purchase?.supplierName || ''} · ${itemLabel} · ${kindLabel}`;
}

/** One desired expense row for one khata payment entry. */
export function buildSupplierExpenseRow(purchase, payment) {
  return {
    id: supplierExpenseId(payment.payoutId),
    date: payment.date,
    amount: payment.amountPKR,
    category: supplierExpenseCategory(purchase.itemId),
    notes: buildSupplierExpenseNote(purchase, payment),
    area: '',
    supplierKhataId: purchase.purchaseId,
    supplierPayoutId: payment.payoutId,
    createdAt: payment.createdAt || ''
  };
}

function sameSupplierExpense(a, b) {
  return a && b
    && a.date === b.date
    && a.amount === b.amount
    && a.category === b.category
    && a.notes === b.notes
    && a.supplierKhataId === b.supplierKhataId
    && a.supplierPayoutId === b.supplierPayoutId;
}

/**
 * Convergent reconcile (SISP-45/56 shape): every recorded khata payment
 * owns exactly one expense row; the khata is the source of truth. Pure:
 * returns { expenses, changed, added, updated, removed }; `expenses` is
 * the SAME array reference when nothing changed, so callers can skip
 * persisting. Rows without a supplierPayoutId are never touched.
 */
export function syncSupplierKhataExpenses(expenses, records) {
  const clean = sanitizeSupplierKhata(records);
  const desired = new Map();
  for (const purchase of clean) {
    for (const payment of purchase.payments) {
      desired.set(payment.payoutId, buildSupplierExpenseRow(purchase, payment));
    }
  }
  const current = Array.isArray(expenses) ? expenses : [];
  const seen = new Set();
  let added = 0;
  let updated = 0;
  let removed = 0;
  const next = [];
  for (const row of current) {
    const payoutId = typeof row?.supplierPayoutId === 'string' && row.supplierPayoutId ? row.supplierPayoutId : null;
    if (!payoutId) { next.push(row); continue; }
    const want = desired.get(payoutId);
    if (!want || seen.has(payoutId)) { removed += 1; continue; }
    seen.add(payoutId);
    if (sameSupplierExpense(row, want)) { next.push(row); continue; }
    updated += 1;
    next.push({ ...row, ...want, createdAt: row.createdAt || want.createdAt });
  }
  for (const [payoutId, want] of desired) {
    if (seen.has(payoutId)) continue;
    seen.add(payoutId);
    next.push(want);
    added += 1;
  }
  const changed = added + updated + removed > 0;
  return { expenses: changed ? next : current, changed, added, updated, removed };
}

/** Reads khata records; [] on missing/corrupt storage. */
export function loadSupplierKhata(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(SUPPLIER_KHATA_KEY);
    if (!raw) return [];
    return sanitizeSupplierKhata(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists khata records; never throws. */
export function saveSupplierKhata(records, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(SUPPLIER_KHATA_KEY, JSON.stringify(sanitizeSupplierKhata(records)));
    return true;
  } catch {
    return false;
  }
}

function pakistanToday() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Modal controller, following the suspense-register pattern: open() /
 * refresh(), open button wired by id, close button, purchase form,
 * per-purchase payout bar. The cross-store effects are injected:
 * onLogPurchase(fields) must record the purchase + run the SISP-18
 * stock-in + expense sync and return the stored purchase (or throw);
 * onRecordPayout(purchaseId, { amountPKR, date, note }) must record the
 * payout + expense sync (or throw). getState is accepted for signature
 * parity (the khata keeps its own localStorage ledger).
 */
export function setupSupplierKhataModal(_getState, { onRecordsChanged, onToast, onLogPurchase, onRecordPayout } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('supplierKhataModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);

  function render() {
    const records = loadSupplierKhata();
    const summary = supplierKhataSummary(records);
    const summaryEl = $('supplierKhataSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = summary.purchaseCount === 0
        ? t('supkhata_empty')
        : t('supkhata_summary', null, {
          count: summary.purchaseCount,
          billed: formatSupplierPKR(summary.totalBilledPKR),
          paid: formatSupplierPKR(summary.totalPaidPKR),
          payable: formatSupplierPKR(summary.totalPayablePKR)
        });
    }
    const itemSelect = $('supplierKhataItem');
    if (itemSelect && itemSelect.options.length === 0) {
      itemSelect.innerHTML = INVENTORY_ITEMS.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (${escapeHtml(item.unit)})</option>`).join('');
    }
    const dateInput = $('supplierKhataDate');
    if (dateInput && !dateInput.value) dateInput.value = pakistanToday();
    const listEl = $('supplierKhataList');
    if (listEl) {
      listEl.innerHTML = records.length === 0
        ? `<p class="supplier-khata-empty">${escapeHtml(t('supkhata_no_purchases'))}</p>`
        : [...records].reverse().map((record) => {
          const item = inventoryItemById(record.itemId);
          const paid = supplierPaidTotal(record);
          const payable = supplierPayable(record);
          const itemLine = `${item ? item.name : record.itemId} ×${record.qty}`;
          const paymentsLine = record.payments.map((p) => `${p.kind === 'upfront' ? t('supkhata_kind_upfront') : t('supkhata_kind_payout')}: ${formatSupplierPKR(p.amountPKR)} · ${escapeHtml(p.date)}`).join(' · ');
          const payoutBar = payable > 0 ? `
            <div class="supplier-khata-pay-bar">
              <label for="supplierPayoutAmount-${escapeHtml(record.purchaseId)}">${escapeHtml(t('supkhata_payout_amount'))}</label>
              <input id="supplierPayoutAmount-${escapeHtml(record.purchaseId)}" class="form-input" type="number" min="1" step="any" value="${escapeHtml(String(payable))}" data-supplier-payout-amount="${escapeHtml(record.purchaseId)}" aria-label="${escapeHtml(t('supkhata_payout_amount'))}">
              <label for="supplierPayoutDate-${escapeHtml(record.purchaseId)}">${escapeHtml(t('supkhata_payout_date'))}</label>
              <input id="supplierPayoutDate-${escapeHtml(record.purchaseId)}" class="form-input" type="date" value="${escapeHtml(pakistanToday())}" data-supplier-payout-date="${escapeHtml(record.purchaseId)}" aria-label="${escapeHtml(t('supkhata_payout_date'))}">
              <button type="button" class="primary-button" data-supplier-payout="${escapeHtml(record.purchaseId)}">${escapeHtml(t('supkhata_pay_balance_btn'))}</button>
            </div>` : `<p class="supplier-khata-settled"><span>${escapeHtml(t('supkhata_settled'))}</span></p>`;
          return `
          <article class="supplier-khata-card${payable > 0 ? '' : ' supplier-khata-card-settled'}">
            <p><span>${escapeHtml(record.purchaseId)} · ${escapeHtml(record.supplierName)}</span><strong>${escapeHtml(formatSupplierPKR(record.totalBillPKR))}</strong></p>
            <p><span>${escapeHtml(itemLine)}</span><span>${escapeHtml(record.date)}</span></p>
            <p><span>${escapeHtml(t('supkhata_paid_label'))}</span><strong>${escapeHtml(formatSupplierPKR(paid))}</strong></p>
            <p><span>${escapeHtml(t('supkhata_payable_label'))}</span><strong>${escapeHtml(formatSupplierPKR(payable))}</strong></p>
            ${paymentsLine ? `<p><span>${escapeHtml(t('supkhata_payments_label'))}</span><span>${escapeHtml(paymentsLine)}</span></p>` : ''}
            ${record.note ? `<p><span>${escapeHtml(t('supkhata_note_label'))}</span><strong>${escapeHtml(record.note)}</strong></p>` : ''}
            ${payoutBar}
          </article>`;
        }).join('');
    }
  }

  const form = $('supplierKhataForm');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        if (typeof onLogPurchase !== 'function') throw new Error(t('supkhata_not_wired'));
        const purchase = await onLogPurchase({
          supplierName: $('supplierKhataSupplier')?.value,
          itemId: $('supplierKhataItem')?.value,
          qty: $('supplierKhataQty')?.value,
          totalBillPKR: $('supplierKhataTotalBill')?.value,
          amountPaidNowPKR: $('supplierKhataPaidNow')?.value,
          date: $('supplierKhataDate')?.value,
          note: $('supplierKhataNote')?.value
        });
        form.reset();
        const dateInput = $('supplierKhataDate');
        if (dateInput) dateInput.value = pakistanToday();
        render();
        if (typeof onRecordsChanged === 'function') onRecordsChanged();
        if (typeof onToast === 'function') {
          onToast(t('supkhata_purchase_saved', null, {
            id: purchase?.purchaseId || '',
            payable: formatSupplierPKR(purchase ? supplierPayable(purchase) : 0)
          }));
        }
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || t('supkhata_save_failed'));
      }
    });
  }

  const listEl = $('supplierKhataList');
  if (listEl) {
    listEl.addEventListener('click', async (event) => {
      const payoutBtn = event.target.closest('[data-supplier-payout]');
      if (!payoutBtn) return;
      const purchaseId = payoutBtn.dataset.supplierPayout;
      try {
        if (typeof onRecordPayout !== 'function') throw new Error(t('supkhata_not_wired'));
        const amountInput = dialog.querySelector(`[data-supplier-payout-amount="${purchaseId}"]`);
        const dateInput = dialog.querySelector(`[data-supplier-payout-date="${purchaseId}"]`);
        const result = await onRecordPayout(purchaseId, {
          amountPKR: amountInput?.value,
          date: dateInput?.value
        });
        render();
        if (typeof onRecordsChanged === 'function') onRecordsChanged();
        if (typeof onToast === 'function') {
          onToast(t('supkhata_payout_saved', null, {
            amount: formatSupplierPKR(result?.payout?.amountPKR ?? 0),
            payable: formatSupplierPKR(result?.purchase ? supplierPayable(result.purchase) : 0)
          }));
        }
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || t('supkhata_save_failed'));
      }
    });
  }

  const closeBtn = $('supplierKhataCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openSupplierKhataModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    render();
    dialog.showModal();
  });

  return {
    open() {
      render();
      dialog.showModal();
    },
    refresh: render
  };
}
