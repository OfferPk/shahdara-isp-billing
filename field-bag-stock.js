/**
 * field-bag-stock.js — SISP-127: Lineman Field Bag / Bike Box
 * Mini-Inventory (Field Stock).
 *
 * Problem: the lineman carries spare parts on the bike (connectors,
 * couplers, patch cords, media converters, a router) but the only stock
 * book (SISP-18, sisp_inventory_v1) knows the Main Store. Parts issued
 * to the bag vanished from view, and parts actually used from the bag
 * on a repair were still deducted from the Main Store by the SISP-42
 * ticket bridge — the store the parts never left.
 *
 * Model: the bag is a second movement log, localStorage key
 * sisp_field_bag_v1, a flat array of append-only movements:
 *   { id (BAG-101+), date (YYYY-MM-DD), itemId, kind, qty,
 *     ticketId ('' except usage kinds), note, createdAt }
 *   kind 'in'           — issued Main Store -> Field Bag
 *   kind 'return-out'   — handed back Field Bag -> Main Store
 *   kind 'usage'        — consumed on a resolved ticket from the bag
 *   kind 'usage-return' — a bag ticket reopened: its usage returns
 * Quantities are ALWAYS derived (in + usage-return − usage −
 * return-out per item) — there is no editable count field, so the bag
 * can never drift from its own log, exactly like SISP-18.
 *
 * Items are the shipped SISP-18 catalog items (INVENTORY_ITEMS in
 * inventory-book.js) — the recorded catalogue the owner stocks; this
 * module seeds nothing and invents no item list.
 *
 * Transfers ride the SHIPPED inventory path only: issuing or returning
 * calls inventory-book's addMovement (passed in by the caller, the
 * SISP-42 bridge style — this module never imports a writer for
 * sisp_inventory_v1 and never writes that key). addMovement is pure
 * and throws on an over-draw, and every transfer builds BOTH new lists
 * before anything is persisted, so a refused transfer changes neither
 * store (atomic at the persistence layer: both saves or neither).
 *
 * Ticket usage: SISP-12's resolveTicket gained an opt-in stockSource.
 * A ticket resolved with stockSource 'bag' (the field-tickets resolve
 * form's source choice; absent/'main' keeps the exact SISP-42
 * behaviour) is settled by applyFieldBagStockBridge below instead of
 * the Main Store bridge:
 *  - Resolved + bag + not yet deducted: the ticket's materialsUsed
 *    lines (mapped through TICKET_MATERIAL_BY_KEY, the same mapping
 *    ticketStockDeductions uses) are validated against the bag as a
 *    whole — any shortfall deducts NOTHING, the ticket stays pending
 *    and the failure is surfaced (the SISP-42 discipline: resolution
 *    itself is never blocked, only the bookkeeping waits). On success
 *    one 'usage' movement per line is appended and the ticket is
 *    stamped stockDeducted (the flag both bridges respect), so the
 *    Main Store bridge skips it. Idempotency key: the ticket's own
 *    stockDeducted flag plus the outstanding-usage check — a second
 *    pass is a no-op.
 *  - Reopened after a bag deduction (any non-Resolved status with
 *    stockDeducted): exactly the outstanding usage lines come back as
 *    'usage-return' movements and the flag resets, so re-resolving can
 *    never deduct the same parts twice. This pass must run BEFORE the
 *    Main Store bridge in the host (app.js does), so a bag ticket
 *    never looks "deducted" to the wrong bridge.
 * The SISP-44 complaint sync resolves tickets without a stockSource,
 * so synced resolutions keep the Main Store path untouched.
 *
 * Backup: movements travel in the JSON backup
 * `settings.fieldBagMovements` section (see core.js), under the same
 * safe-merge rule as the SISP-37 suspense register: adopted only when
 * this device has none stored yet.
 *
 * The modal controller at the bottom needs a DOM and is
 * inspection-verified (no DOM harness in node:test), like the other
 * modal controllers. Tests use synthetic data only.
 */

import {
  INVENTORY_ITEMS,
  INVENTORY_ITEM_IDS,
  isValidMovementQty,
  loadInventory,
  saveInventory,
  addMovement,
  computeStock
} from './inventory-book.js';
import {
  TICKET_MATERIAL_BY_KEY,
  sanitizeTicketMaterials,
  sanitizeTickets
} from './complaint-tickets.js';
import { t } from './nav-language.js';

export const FIELD_BAG_KEY = 'sisp_field_bag_v1';

export const FIELD_BAG_KINDS = ['in', 'return-out', 'usage', 'usage-return'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BAG_ID_RE = /^BAG-(\d+)$/;
const TICKET_ID_RE = /^TKT-\d+$/;

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

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Drops malformed rows; keeps clean bag movements in stored order.
 * Usage movements are audit records for one ticket: a usage (or
 * usage-return) row without a valid ticket id can never be reconciled
 * or reversed, so it is dropped rather than kept unauditable.
 */
export function sanitizeFieldBagMovements(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const itemId = cleanText(entry.itemId);
    if (!INVENTORY_ITEM_IDS.includes(itemId)) continue;
    if (!FIELD_BAG_KINDS.includes(entry.kind)) continue;
    if (!isValidMovementQty(itemId, entry.qty)) continue;
    const date = DATE_RE.test(String(entry.date || '')) ? String(entry.date) : '';
    if (!date) continue;
    const isUsage = entry.kind === 'usage' || entry.kind === 'usage-return';
    const ticketId = TICKET_ID_RE.test(String(entry.ticketId || '')) ? String(entry.ticketId) : '';
    if (isUsage && !ticketId) continue;
    out.push({
      id: cleanText(entry.id),
      itemId,
      kind: entry.kind,
      qty: Number(entry.qty),
      date,
      ticketId: isUsage ? ticketId : '',
      note: cleanText(entry.note),
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Reads bag movements; [] on missing/corrupt storage. */
export function loadFieldBagMovements(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(FIELD_BAG_KEY);
    if (!raw) return [];
    return sanitizeFieldBagMovements(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists bag movements; never throws. */
export function saveFieldBagMovements(movements, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(FIELD_BAG_KEY, JSON.stringify(sanitizeFieldBagMovements(movements)));
    return true;
  } catch {
    return false;
  }
}

function nextBagMovementId(movements) {
  let max = 100;
  for (const m of movements) {
    const match = BAG_ID_RE.exec(String(m.id || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `BAG-${max + 1}`;
}

function buildBagMovement(movements, movement) {
  return {
    id: nextBagMovementId(movements),
    itemId: movement.itemId,
    kind: movement.kind,
    qty: Number(movement.qty),
    date: movement.date,
    ticketId: movement.ticketId || '',
    note: cleanText(movement.note),
    createdAt: new Date().toISOString()
  };
}

function validateBagTransferInput(input) {
  const itemId = cleanText(input && input.itemId);
  if (!INVENTORY_ITEM_IDS.includes(itemId)) throw new Error('Unknown stock item.');
  if (!isValidMovementQty(itemId, input.qty)) throw new Error('Quantity must be positive (whole units for unit items).');
  const date = DATE_RE.test(String(input && input.date || '')) ? String(input.date) : '';
  if (!date) throw new Error('A valid date is required.');
  return { itemId, qty: Number(input.qty), date, note: cleanText(input.note) };
}

/**
 * Pure derived bag stock: one row per catalog item with issued-in,
 * used-out, returned-out, reopen-returned and the in-bag quantity.
 */
export function computeBagStock(movements) {
  const clean = sanitizeFieldBagMovements(movements);
  return INVENTORY_ITEMS.map((item) => {
    let issuedIn = 0;
    let usedOut = 0;
    let returnedOut = 0;
    let usageReturned = 0;
    for (const m of clean) {
      if (m.itemId !== item.id) continue;
      if (m.kind === 'in') issuedIn += m.qty;
      else if (m.kind === 'usage') usedOut += m.qty;
      else if (m.kind === 'return-out') returnedOut += m.qty;
      else if (m.kind === 'usage-return') usageReturned += m.qty;
    }
    return {
      ...item,
      issuedIn: round2(issuedIn),
      usedOut: round2(usedOut),
      returnedOut: round2(returnedOut),
      usageReturned: round2(usageReturned),
      inBag: round2(issuedIn + usageReturned - usedOut - returnedOut)
    };
  });
}

/** Quantity of one item currently in the bag (0 when nothing recorded). */
export function bagAvailableFor(movements, itemId) {
  const row = computeBagStock(movements).find((r) => r.id === itemId);
  return row ? row.inBag : 0;
}

/**
 * Issue stock Main Store -> Field Bag. The Main Store side goes through
 * the shipped inventory path (addMovementFn — inventory-book's
 * addMovement, passed in): it throws on an over-draw BEFORE the bag
 * movement is built, and both returned lists are new arrays, so a
 * refused issue changes neither store. Returns
 * { inventoryMovements, bagMovements } for the caller to persist.
 */
export function transferToFieldBag(inventoryMovements, bagMovements, input, addMovementFn) {
  if (typeof addMovementFn !== 'function') throw new Error('Inventory addMovement is not available.');
  const { itemId, qty, date, note } = validateBagTransferInput(input);
  const cleanBag = sanitizeFieldBagMovements(bagMovements);
  const nextInventory = addMovementFn(inventoryMovements, {
    itemId,
    kind: 'out',
    qty,
    date,
    note: note ? `Field bag issue — ${note}` : 'Field bag issue'
  });
  const record = buildBagMovement(cleanBag, { itemId, kind: 'in', qty, date, note });
  return { inventoryMovements: nextInventory, bagMovements: [...cleanBag, record] };
}

/**
 * Hand stock back Field Bag -> Main Store. The bag side is validated
 * first (the bag cannot return what it does not hold); the Main Store
 * side rides the same shipped addMovement path as a Stock In. Returns
 * { inventoryMovements, bagMovements } for the caller to persist.
 */
export function returnFieldBagToStore(inventoryMovements, bagMovements, input, addMovementFn) {
  if (typeof addMovementFn !== 'function') throw new Error('Inventory addMovement is not available.');
  const { itemId, qty, date, note } = validateBagTransferInput(input);
  const cleanBag = sanitizeFieldBagMovements(bagMovements);
  if (qty > bagAvailableFor(cleanBag, itemId)) {
    throw new Error('Field bag does not hold that much of this item.');
  }
  const nextInventory = addMovementFn(inventoryMovements, {
    itemId,
    kind: 'in',
    qty,
    date,
    note: note ? `Field bag return — ${note}` : 'Field bag return'
  });
  const record = buildBagMovement(cleanBag, { itemId, kind: 'return-out', qty, date, note });
  return { inventoryMovements: nextInventory, bagMovements: [...cleanBag, record] };
}

/**
 * The bag deduction lines for a ticket: its recorded materialsUsed,
 * mapped to SISP-18 catalog ids through TICKET_MATERIAL_BY_KEY — the
 * exact mapping ticketStockDeductions uses for the Main Store.
 */
export function fieldBagLinesForTicket(ticket) {
  const out = [];
  for (const line of sanitizeTicketMaterials(ticket && ticket.materialsUsed)) {
    const material = TICKET_MATERIAL_BY_KEY[line.key];
    if (!material) continue;
    out.push({ itemId: material.inventoryItemId, qty: line.qty });
  }
  return out;
}

/**
 * Net outstanding bag usage for one ticket: usage minus usage-return
 * per item, positive lines only. Empty when the ticket's bag usage is
 * fully reversed (or was never recorded) — this is the idempotency
 * ledger for consume/reverse below.
 */
export function outstandingBagUsage(bagMovements, ticketId) {
  const clean = sanitizeFieldBagMovements(bagMovements);
  const net = new Map();
  for (const m of clean) {
    if (m.ticketId !== ticketId) continue;
    if (m.kind === 'usage') net.set(m.itemId, round2((net.get(m.itemId) || 0) + m.qty));
    else if (m.kind === 'usage-return') net.set(m.itemId, round2((net.get(m.itemId) || 0) - m.qty));
  }
  return [...net.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([itemId, qty]) => ({ itemId, qty }));
}

/**
 * Consume one resolved bag-source ticket from the bag. All-or-nothing:
 * every line is validated against the bag first, so a shortfall throws
 * and appends NOTHING (the caller surfaces the message; the ticket
 * stays pending for a later retry — the resolution itself already
 * happened and is never undone here). On success the ticket comes back
 * stamped stockDeducted, the flag the Main Store bridge respects.
 * Already-deducted tickets return untouched (idempotent).
 */
export function consumeTicketFromFieldBag(ticket, bagMovements) {
  const clean = sanitizeTickets([ticket]);
  if (!clean.length) throw new Error('Ticket not found.');
  const entry = clean[0];
  if (entry.status !== 'Resolved') throw new Error('Only a resolved ticket deducts stock.');
  if (entry.stockDeducted) return { bagMovements, ticket: entry };
  if (outstandingBagUsage(bagMovements, entry.id).length) {
    // Usage already in the log but the flag was lost (e.g. an old
    // backup): trust the log, just re-stamp the flag.
    return { bagMovements, ticket: { ...entry, stockDeducted: true } };
  }
  const lines = fieldBagLinesForTicket(entry);
  const cleanBag = sanitizeFieldBagMovements(bagMovements);
  for (const line of lines) {
    if (line.qty > bagAvailableFor(cleanBag, line.itemId)) {
      const item = INVENTORY_ITEMS.find((i) => i.id === line.itemId);
      throw new Error(`Field bag does not hold enough ${item ? item.name : line.itemId} for ticket ${entry.id}.`);
    }
  }
  const date = String(entry.resolvedAt || '').slice(0, 10);
  if (!DATE_RE.test(date)) throw new Error('Ticket has no resolution date.');
  let next = cleanBag;
  for (const line of lines) {
    const record = buildBagMovement(next, {
      itemId: line.itemId,
      kind: 'usage',
      qty: line.qty,
      date,
      ticketId: entry.id,
      note: `Ticket ${entry.id} — ${entry.faultPreset || entry.customFault || 'field work'}`
    });
    next = [...next, record];
  }
  return { bagMovements: next, ticket: { ...entry, stockDeducted: true } };
}

function pakistanBagDateNow(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * SISP-127 LIVE BRIDGE PASS (pure): settle the bag side of the ticket
 * list in one sweep. Only tickets carrying stockSource 'bag' are
 * touched; every other ticket passes through byte-identical, so the
 * Main Store bridge (SISP-42) keeps full ownership of them.
 *
 * - Resolved + bag + not deducted: consumed via
 *   consumeTicketFromFieldBag (all-or-nothing per ticket; a shortfall
 *   deducts nothing and lands in failures for the caller to surface).
 * - Non-Resolved + bag + deducted: the ticket was reopened — exactly
 *   its outstanding usage returns to the bag as 'usage-return'
 *   movements dated the reopen day and the flag resets, so a later
 *   re-resolve starts clean and can never double-deduct.
 *
 * Returns { tickets, bagMovements, deducted, reversed, failures };
 * inputs are never mutated. MUST run before the Main Store bridge in
 * the host so a bag ticket's flag is always settled by its own bridge
 * first.
 */
export function applyFieldBagStockBridge(tickets, bagMovements, options = {}) {
  const clean = sanitizeTickets(tickets);
  let nextBag = sanitizeFieldBagMovements(bagMovements);
  const deducted = [];
  const reversed = [];
  const failures = [];
  const reversalDate = pakistanBagDateNow(options.referenceDate);
  const nextTickets = clean.map((ticket) => {
    if (ticket.stockSource !== 'bag') return ticket;
    if (ticket.status === 'Resolved') {
      if (ticket.stockDeducted || fieldBagLinesForTicket(ticket).length === 0) return ticket;
      try {
        const applied = consumeTicketFromFieldBag(ticket, nextBag);
        nextBag = applied.bagMovements;
        deducted.push(ticket.id);
        return applied.ticket;
      } catch (error) {
        failures.push({ id: ticket.id, message: error && error.message ? error.message : 'Field bag deduction failed.' });
        return ticket;
      }
    }
    if (!ticket.stockDeducted) return ticket;
    const lines = outstandingBagUsage(nextBag, ticket.id);
    if (!lines.length) return { ...ticket, stockDeducted: false };
    let next = nextBag;
    for (const line of lines) {
      const record = buildBagMovement(next, {
        itemId: line.itemId,
        kind: 'usage-return',
        qty: line.qty,
        date: reversalDate,
        ticketId: ticket.id,
        note: `Ticket ${ticket.id} reopened — parts returned to field bag`
      });
      next = [...next, record];
    }
    nextBag = next;
    reversed.push(ticket.id);
    return { ...ticket, stockDeducted: false };
  });
  return { tickets: nextTickets, bagMovements: nextBag, deducted, reversed, failures };
}

/**
 * Read-only reconciliation: one row per catalog item — Main Store
 * available (from the shipped computeStock rows the caller passes),
 * in-bag quantity, and the combined total. Pure derivation from the
 * two systems' own logs; nothing is written.
 */
export function buildFieldBagReconciliation(mainStockRows, bagMovements) {
  const bagRows = computeBagStock(bagMovements);
  return INVENTORY_ITEMS.map((item) => {
    const main = (Array.isArray(mainStockRows) ? mainStockRows : []).find((r) => r && r.id === item.id);
    const bag = bagRows.find((r) => r.id === item.id);
    const mainQty = main ? round2(main.available) : 0;
    const bagQty = bag ? bag.inBag : 0;
    return { ...item, mainStore: mainQty, inBag: bagQty, total: round2(mainQty + bagQty) };
  });
}

/** Bag movement log, latest first (date desc, then created order desc). */
export function sortedFieldBagLog(movements) {
  const clean = sanitizeFieldBagMovements(movements);
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
  return pakistanBagDateNow();
}

/**
 * Dashboard + modal controller. The dialog (index.html) offers the
 * reconciliation table (Main Store / In Bag / Total per item), an
 * issue form (Main Store -> bag) and a return form (bag -> Main
 * Store), both persisted through the shipped inventory path — the
 * inventory save happens first and the bag save only on success, so a
 * failed save can never credit the bag with stock the store still
 * holds (a failed bag save is surfaced loudly instead). onChanged
 * lets the host re-run the ticket bridges + dashboard.
 */
export function setupFieldBagModal(_getState, { onChanged, onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('fieldBagModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);

  function persistTransfer(result) {
    let saved = true;
    try { saved = saveInventory(result.inventoryMovements) !== false; } catch { saved = false; }
    if (!saved) {
      onToast && onToast(t('fbag_save_failed'));
      return false;
    }
    let bagSaved = true;
    try { bagSaved = saveFieldBagMovements(result.bagMovements) !== false; } catch { bagSaved = false; }
    if (!bagSaved) {
      onToast && onToast(t('fbag_save_failed'));
      return false;
    }
    return true;
  }

  function renderLists(bagMovements) {
    const reconEl = $('fieldBagReconList');
    if (reconEl) {
      // Main Store figures come from the shipped inventory book's own
      // derivation (computeStock over the recorded movement log).
      const recon = buildFieldBagReconciliation(computeStock(loadInventory()), bagMovements);
      reconEl.innerHTML = recon
        .filter((row) => row.mainStore !== 0 || row.inBag !== 0)
        .map((row) => `
        <article class="field-bag-card">
          <strong>${escapeHtml(row.name)}</strong>
          <p><span>${escapeHtml(t('fbag_col_main'))}</span><strong>${escapeHtml(formatQty(row.mainStore, row.unit))}</strong></p>
          <p><span>${escapeHtml(t('fbag_col_bag'))}</span><strong>${escapeHtml(formatQty(row.inBag, row.unit))}</strong></p>
          <p><span>${escapeHtml(t('fbag_col_total'))}</span><strong>${escapeHtml(formatQty(row.total, row.unit))}</strong></p>
        </article>`).join('') || `<p class="field-bag-empty">${escapeHtml(t('fbag_empty'))}</p>`;
    }
    const logEl = $('fieldBagLogList');
    if (logEl) {
      const rows = sortedFieldBagLog(bagMovements);
      logEl.innerHTML = rows.length === 0
        ? `<p class="field-bag-empty">${escapeHtml(t('fbag_log_empty'))}</p>`
        : rows.map((m) => {
          const item = INVENTORY_ITEMS.find((i) => i.id === m.itemId);
          const kindLabel = t(`fbag_kind_${m.kind.replace('-', '_')}`);
          const ticketLine = m.ticketId ? ` · ${escapeHtml(m.ticketId)}` : '';
          return `<article class="field-bag-card">
            <strong>${escapeHtml(item ? item.name : m.itemId)} · ${escapeHtml(formatQty(m.qty, item ? item.unit : 'units'))}</strong>
            <p><span>${escapeHtml(kindLabel)}</span><strong>${escapeHtml(m.date)}${ticketLine}</strong></p>
            ${m.note ? `<p><span>${escapeHtml(t('fbag_note'))}</span><strong>${escapeHtml(m.note)}</strong></p>` : ''}
          </article>`;
        }).join('');
    }
    for (const selectId of ['fieldBagIssueItem', 'fieldBagReturnItem']) {
      const select = $(selectId);
      if (select && select.options.length === 0) {
        select.innerHTML = INVENTORY_ITEMS.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
      }
    }
    const summaryEl = $('fieldBagSummaryLine');
    if (summaryEl) {
      const stock = computeBagStock(bagMovements);
      const kinds = stock.filter((row) => row.inBag > 0).length;
      const units = stock.reduce((sum, row) => sum + row.inBag, 0);
      summaryEl.textContent = bagMovements.length === 0
        ? t('fbag_summary_empty')
        : t('fbag_summary', null, { kinds, units: Math.round(units * 100) / 100 });
    }
  }

  const issueForm = $('fieldBagIssueForm');
  if (issueForm) issueForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const result = transferToFieldBag(loadInventory(), loadFieldBagMovements(), {
        itemId: $('fieldBagIssueItem')?.value || '',
        qty: Number($('fieldBagIssueQty')?.value),
        date: $('fieldBagIssueDate')?.value || '',
        note: $('fieldBagIssueNote')?.value || ''
      }, addMovement);
      if (!persistTransfer(result)) return;
      onToast && onToast(t('fbag_issued_toast'));
      issueForm.reset();
      const dateInput = $('fieldBagIssueDate');
      if (dateInput) dateInput.value = todayLocal();
      if (typeof onChanged === 'function') onChanged();
      renderLists(loadFieldBagMovements());
    } catch (error) {
      onToast && onToast(error && error.message ? error.message : t('fbag_action_failed'));
    }
  });

  const returnForm = $('fieldBagReturnForm');
  if (returnForm) returnForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const result = returnFieldBagToStore(loadInventory(), loadFieldBagMovements(), {
        itemId: $('fieldBagReturnItem')?.value || '',
        qty: Number($('fieldBagReturnQty')?.value),
        date: $('fieldBagReturnDate')?.value || ''
      }, addMovement);
      if (!persistTransfer(result)) return;
      onToast && onToast(t('fbag_returned_toast'));
      returnForm.reset();
      const dateInput = $('fieldBagReturnDate');
      if (dateInput) dateInput.value = todayLocal();
      if (typeof onChanged === 'function') onChanged();
      renderLists(loadFieldBagMovements());
    } catch (error) {
      onToast && onToast(error && error.message ? error.message : t('fbag_action_failed'));
    }
  });

  const closeBtn = $('fieldBagCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openFieldBagModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    const issueDate = $('fieldBagIssueDate');
    if (issueDate && !issueDate.value) issueDate.value = todayLocal();
    const returnDate = $('fieldBagReturnDate');
    if (returnDate && !returnDate.value) returnDate.value = todayLocal();
    renderLists(loadFieldBagMovements());
    dialog.showModal();
  });

  return {
    open() {
      renderLists(loadFieldBagMovements());
      dialog.showModal();
    },
    refresh() {
      renderLists(loadFieldBagMovements());
    }
  };
}
