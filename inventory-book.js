/**
 * inventory-book.js — SISP-18: Offline Hardware and Fiber Stock Inventory Book.
 *
 * Problem: the owner buys routers, media converters, patch cords, and
 * 2-core fiber rolls in bulk and needs an offline register to manually
 * update stock in/out and view remaining inventory at any time.
 *
 * Storage: stock movements live in localStorage under INVENTORY_KEY
 * (sisp_inventory_v1) as a flat array of movement records. Available stock
 * is always DERIVED (total in minus total out per item) — never stored
 * twice — so the book can never drift from its own log. The 7 stock items
 * are the fixed spec catalog (INVENTORY_ITEMS); customer records such as
 * SISP-4 installment item titles or new-customer router fields are NOT
 * stock and are never counted here.
 *
 * Low stock: an item is low when its available quantity is at or below its
 * lowThreshold (meters for cable items, units for the rest). Stock out is
 * refused when it would drive an item below zero — you cannot use what the
 * store does not have.
 *
 * Backup: movements travel in the JSON backup `settings.inventory`
 * section (see core.js), under the same safe-merge rule as the SISP-15
 * complaint register: adopted only when this device has none stored yet.
 *
 * All helpers are pure except loadInventory/saveInventory and the modal
 * controller. Tests use synthetic data only.
 */

export const INVENTORY_KEY = 'sisp_inventory_v1';

/** Fixed spec catalog: id, display name, unit, low-stock threshold. */
export const INVENTORY_ITEMS = [
  { id: 'fiber-2core', name: '2-Core Fiber Cable', unit: 'meters', lowThreshold: 100 },
  { id: 'router', name: 'Tenda / TP-Link Router', unit: 'units', lowThreshold: 2 },
  { id: 'media-converter', name: 'Media Converter Pair', unit: 'units', lowThreshold: 2 },
  { id: 'patch-cord', name: 'Fiber Patch Cord', unit: 'units', lowThreshold: 5 },
  { id: 'cat6', name: 'CAT6 Cable', unit: 'meters', lowThreshold: 100 },
  { id: 'rj45', name: 'RJ45 Connector', unit: 'units', lowThreshold: 20 },
  { id: 'pole', name: 'Pole', unit: 'units', lowThreshold: 2 }
];

export const INVENTORY_ITEM_IDS = INVENTORY_ITEMS.map((item) => item.id);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MOVEMENT_ID_RE = /^STK-(\d+)$/;

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

export function inventoryItemById(id) {
  return INVENTORY_ITEMS.find((item) => item.id === id) || null;
}

function isMeterItem(itemId) {
  const item = inventoryItemById(itemId);
  return item !== null && item.unit === 'meters';
}

/** Quantity rule: positive; unit items must be whole, meter items may be fractional. */
export function isValidMovementQty(itemId, qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (!isMeterItem(itemId) && !Number.isInteger(n)) return false;
  return true;
}

/** Drops malformed rows; keeps clean movements in stored order. */
export function sanitizeInventory(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const itemId = cleanText(entry.itemId);
    if (!INVENTORY_ITEM_IDS.includes(itemId)) continue;
    const kind = entry.kind === 'in' || entry.kind === 'out' ? entry.kind : null;
    if (!kind) continue;
    if (!isValidMovementQty(itemId, entry.qty)) continue;
    const date = DATE_RE.test(String(entry.date || '')) ? String(entry.date) : '';
    if (!date) continue;
    out.push({
      id: cleanText(entry.id),
      itemId,
      kind,
      qty: Number(entry.qty),
      date,
      customerName: cleanText(entry.customerName),
      note: cleanText(entry.note),
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Reads movement records; [] on missing/corrupt storage. */
export function loadInventory(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(INVENTORY_KEY);
    if (!raw) return [];
    return sanitizeInventory(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists movement records; never throws. */
export function saveInventory(movements, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(INVENTORY_KEY, JSON.stringify(sanitizeInventory(movements)));
    return true;
  } catch {
    return false;
  }
}

function nextMovementId(movements) {
  let max = 0;
  for (const m of movements) {
    const match = MOVEMENT_ID_RE.exec(String(m.id || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `STK-${max + 1}`;
}

/**
 * Pure stock derivation: one row per catalog item with total in, total out
 * and available (in minus out), plus the low-stock flag.
 */
export function computeStock(movements) {
  const clean = sanitizeInventory(movements);
  return INVENTORY_ITEMS.map((item) => {
    let totalIn = 0;
    let totalOut = 0;
    for (const m of clean) {
      if (m.itemId !== item.id) continue;
      if (m.kind === 'in') totalIn += m.qty;
      else totalOut += m.qty;
    }
    const available = Math.round((totalIn - totalOut) * 100) / 100;
    return {
      ...item,
      totalIn: Math.round(totalIn * 100) / 100,
      totalOut: Math.round(totalOut * 100) / 100,
      available,
      isLow: available <= item.lowThreshold
    };
  });
}

/** Available quantity for one item (0 when nothing recorded). */
export function availableFor(movements, itemId) {
  const row = computeStock(movements).find((r) => r.id === itemId);
  return row ? row.available : 0;
}

/**
 * Appends one movement. Throws on an unknown item, a bad quantity, a bad
 * date, or a stock-out that would drive the item below zero. Returns the
 * new movement list (input untouched).
 */
export function addMovement(movements, movement) {
  const clean = sanitizeInventory(movements);
  const itemId = cleanText(movement.itemId);
  if (!INVENTORY_ITEM_IDS.includes(itemId)) throw new Error('Unknown stock item.');
  if (!isValidMovementQty(itemId, movement.qty)) throw new Error('Quantity must be positive (whole units for unit items).');
  const date = DATE_RE.test(String(movement.date || '')) ? String(movement.date) : '';
  if (!date) throw new Error('A valid date is required.');
  const qty = Number(movement.qty);
  if (movement.kind === 'out' && qty > availableFor(clean, itemId)) {
    throw new Error('Stock out exceeds available stock.');
  }
  if (movement.kind !== 'in' && movement.kind !== 'out') throw new Error('Movement must be stock in or stock out.');
  const record = {
    id: nextMovementId(clean),
    itemId,
    kind: movement.kind,
    qty,
    date,
    customerName: cleanText(movement.customerName),
    note: cleanText(movement.note),
    createdAt: new Date().toISOString()
  };
  return [...clean, record];
}

/** Movement log, latest first (date desc, then created order desc). */
export function sortedMovementLog(movements) {
  const clean = sanitizeInventory(movements);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

function formatQty(qty, unit) {
  const n = Math.round(qty * 100) / 100;
  return unit === 'meters' ? `${n} m` : `${n}`;
}

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Dashboard + modal controller, following the downtime-analytics pattern:
 * open() / refresh(), open button wired by id, close button, form submit.
 * getState is accepted for signature parity with the other controllers
 * (the book keeps its own localStorage ledger and needs no ledger state).
 */
export function setupInventoryBookModal(_getState, { onInventoryChanged, onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('inventoryBookModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);

  function render() {
    const movements = loadInventory();
    const stock = computeStock(movements);
    const lowItems = stock.filter((row) => row.isLow);
    const summaryEl = $('inventoryBookSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = movements.length === 0
        ? 'No stock recorded yet. Record your first purchase below.'
        : lowItems.length === 0
          ? `${movements.length} movement${movements.length === 1 ? '' : 's'} recorded · no low-stock items.`
          : `${movements.length} movement${movements.length === 1 ? '' : 's'} recorded · low stock: ${lowItems.map((r) => r.name).join(', ')}.`;
    }
    const stockEl = $('inventoryBookStockList');
    if (stockEl) {
      stockEl.innerHTML = stock.map((row) => `
        <article class="inventory-stock-card${row.isLow ? ' inventory-low' : ''}">
          <p><span>Item</span><strong>${escapeHtml(row.name)}</strong></p>
          <p><span>Available</span><strong>${escapeHtml(formatQty(row.available, row.unit))}</strong></p>
          <p><span>In / Out</span><strong>${escapeHtml(formatQty(row.totalIn, row.unit))} / ${escapeHtml(formatQty(row.totalOut, row.unit))}</strong></p>
          ${row.isLow ? '<p class="inventory-low-note"><span>⚠️ Low stock</span></p>' : ''}
        </article>`).join('');
    }
    const logEl = $('inventoryBookLogList');
    if (logEl) {
      const log = sortedMovementLog(movements);
      logEl.innerHTML = log.length === 0
        ? '<p class="inventory-book-empty">No movements yet.</p>'
        : log.map((m) => {
          const item = inventoryItemById(m.itemId);
          return `<article class="inventory-log-card">
            <p><span>${m.kind === 'in' ? '⬆️ Stock in' : '⬇️ Stock out'}</span><strong>${escapeHtml(item ? item.name : m.itemId)} · ${escapeHtml(formatQty(m.qty, item ? item.unit : 'units'))}</strong></p>
            <p><span>${escapeHtml(m.date)}</span><strong>${escapeHtml(m.customerName || '—')}</strong></p>
            ${m.note ? `<p><span>Note</span><strong>${escapeHtml(m.note)}</strong></p>` : ''}
          </article>`;
        }).join('');
    }
    const itemSelect = $('inventoryBookItem');
    if (itemSelect && itemSelect.options.length === 0) {
      itemSelect.innerHTML = INVENTORY_ITEMS.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (${escapeHtml(item.unit)})</option>`).join('');
    }
    const dateInput = $('inventoryBookDate');
    if (dateInput && !dateInput.value) dateInput.value = todayLocal();
  }

  const form = $('inventoryBookForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const updated = addMovement(loadInventory(), {
          itemId: $('inventoryBookItem')?.value,
          kind: $('inventoryBookKind')?.value,
          qty: $('inventoryBookQty')?.value,
          date: $('inventoryBookDate')?.value,
          customerName: $('inventoryBookCustomer')?.value,
          note: $('inventoryBookNote')?.value
        });
        saveInventory(updated);
        form.reset();
        const dateInput = $('inventoryBookDate');
        if (dateInput) dateInput.value = todayLocal();
        render();
        if (typeof onInventoryChanged === 'function') onInventoryChanged();
        if (typeof onToast === 'function') onToast('Stock movement recorded.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not record movement.');
      }
    });
  }
  const closeBtn = $('inventoryBookCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openInventoryBookModalBtn') : null;
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
