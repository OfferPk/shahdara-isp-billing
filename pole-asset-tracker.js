/**
 * pole-asset-tracker.js — SISP-122: Street Pole Asset & Drop Attachment
 * Registry ("کھمبا رجسٹر").
 *
 * Problem (spec): the SISP-32 directory records each customer's pole /
 * landmark as FREE TEXT on the customer record (poleNumber, e.g. "Pole
 * #14 near Masjid Bilal"), and splitter boxes (PR #432) exist only as
 * ids derived from customer optical fields. There was no register of the
 * POLES THEMSELVES: which physical pole stands where, what kind it is
 * (WAPDA / our own iron pole / a wall bracket), and what hangs on it.
 *
 * What this module adds — a standalone registry in localStorage under
 * POLES_REGISTRY_KEY (sisp_poles_registry_v1), one record per pole:
 *   { poleId (POLE-101+), label, zone, type ('wapda' | 'isp_iron' |
 *     'wall_bracket'), landmark, notes, inventoryItemId,
 *     dropCustomerIds: [], splitterBoxIds: [], createdAt }
 * The register starts EMPTY — no pole is seeded, guessed or imported
 * from the SISP-32 free text (that text is ambiguous: two customers can
 * describe the same pole differently, so auto-linking it would fabricate
 * associations; the owner attaches drops explicitly instead).
 *
 * ATTACHMENT MODEL (deliberate, stated so nobody has to guess):
 * - Attachments live ON THE POLE RECORD as id references
 *   (dropCustomerIds = customer ids, splitterBoxIds = the derived box
 *   ids from splitter-map.js buildSplitterBoxes). They are resolved
 *   LIVE at display time against the current customer list.
 * - This feature NEVER writes a customer record, a splitter record or
 *   an inventory record. Attaching / detaching edits only the registry
 *   array. A drop whose customer was archived resolves as 'archived'
 *   (labelled, never counted as an active drop); a drop or box id that
 *   no longer resolves renders as 'missing' instead of crashing or
 *   silently vanishing.
 * - ONE-POLE RULE: a customer drop or a splitter box can hang on only
 *   ONE pole. Attaching it to another pole MOVES it (it is removed from
 *   the previous pole in the same operation) — a box physically stands
 *   on one pole, and a duplicate would double-count field assets.
 *
 * ISP IRON POLE <-> SISP-18 STOCK LINK (deliberate decision):
 * - `inventoryItemId` is a REFERENCE ONLY, chosen by the owner from the
 *   shipped inventory catalogue (inventory-book.js INVENTORY_ITEMS,
 *   which includes the 'pole' item). It is never guessed from the pole
 *   label, and registering or deleting a pole NEVER writes an inventory
 *   movement — stock counts stay exactly as SISP-18 recorded them
 *   (pinned by test: availableFor('pole') is unchanged by this module).
 *   Issuing a pole out of stock remains the inventory book's own job.
 *
 * Zone is stored through phase3 canonicalMohalla, so zone variants
 * ("Bani", "MOHALLA BANI") merge onto the owner's canonical list,
 * exactly like customer zones.
 *
 * Backup: records travel in the JSON backup `settings.polesRegistry`
 * section (see core.js), under the same safe-merge rule as billing
 * groups / suspense payments: adopted only when this device has none
 * stored yet; a differing local register is kept and reported as a
 * conflict, never silently overwritten.
 *
 * Imports are all import-free or cycle-free modules (phase3,
 * splitter-map, inventory-book, pole-landmark-book, nav-language), and
 * app.js is the only importer of this module, so the bundle stays at
 * the house 25 dist files. Tests use synthetic data only.
 */

import { canonicalMohalla } from './phase3.js';
import { buildSplitterBoxes } from './splitter-map.js';
import { INVENTORY_ITEMS, inventoryItemById } from './inventory-book.js';
import { normalizePoleFields } from './pole-landmark-book.js';
import { t } from './nav-language.js';

export const POLES_REGISTRY_KEY = 'sisp_poles_registry_v1';

/** Stable pole-type enum keys; labels live in nav-language (polereg_type_*). */
export const POLE_TYPES = Object.freeze(['wapda', 'isp_iron', 'wall_bracket']);

const ID_RE = /^POLE-(\d+)$/;

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

function cleanIdList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    const id = cleanText(typeof entry === 'string' || typeof entry === 'number' ? String(entry) : '');
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Canonical stored zone for raw input ('' when blank). */
export function poleZoneStored(rawZone) {
  const text = cleanText(rawZone);
  if (!text) return '';
  return canonicalMohalla(text)?.stored ?? text;
}

/**
 * Validate + normalize a raw registry value. Unknown types fall back to
 * 'wapda' (the most common street pole; dropping the whole pole record
 * over a corrupt type would lose its attachments). Unknown inventory
 * item ids are dropped to '' — a reference must point at the shipped
 * catalogue. Records without a usable poleId or label are dropped.
 */
export function sanitizePolesRegistry(value) {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const poleId = cleanText(raw.poleId);
    const label = cleanText(raw.label);
    if (!ID_RE.test(poleId) || !label || seenIds.has(poleId)) continue;
    seenIds.add(poleId);
    const inventoryItemId = cleanText(raw.inventoryItemId);
    out.push({
      poleId,
      label,
      zone: poleZoneStored(raw.zone),
      type: POLE_TYPES.includes(raw.type) ? raw.type : 'wapda',
      landmark: cleanText(raw.landmark),
      notes: cleanText(raw.notes),
      inventoryItemId: inventoryItemById(inventoryItemId) ? inventoryItemId : '',
      dropCustomerIds: cleanIdList(raw.dropCustomerIds),
      splitterBoxIds: cleanIdList(raw.splitterBoxIds),
      createdAt: cleanText(raw.createdAt)
    });
  }
  return out;
}

export function loadPolesRegistry(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(POLES_REGISTRY_KEY);
    if (!raw) return [];
    return sanitizePolesRegistry(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function savePolesRegistry(poles, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(POLES_REGISTRY_KEY, JSON.stringify(sanitizePolesRegistry(poles)));
    return true;
  } catch {
    return false;
  }
}

export function nextPoleId(poles) {
  let max = 100;
  for (const pole of sanitizePolesRegistry(poles)) {
    const match = ID_RE.exec(pole.poleId);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `POLE-${max + 1}`;
}

/**
 * Register a new pole. Throws on an empty label — a pole the lineman
 * cannot name cannot be found again. Returns a NEW array; the input
 * registry is never mutated. No inventory record is touched: the
 * optional inventoryItemId is a reference only (see header).
 */
export function addPole(poles, input = {}, todayStr = '') {
  const label = cleanText(input.label);
  if (!label) throw new Error('Pole label is required');
  const current = sanitizePolesRegistry(poles);
  const inventoryItemId = cleanText(input.inventoryItemId);
  const record = {
    poleId: nextPoleId(current),
    label,
    zone: poleZoneStored(input.zone),
    type: POLE_TYPES.includes(input.type) ? input.type : 'wapda',
    landmark: cleanText(input.landmark),
    notes: cleanText(input.notes),
    inventoryItemId: inventoryItemById(inventoryItemId) ? inventoryItemId : '',
    dropCustomerIds: [],
    splitterBoxIds: [],
    createdAt: cleanText(todayStr)
  };
  return [...current, record];
}

/** Remove a pole record (its attachments are released, nothing else is touched). */
export function removePole(poles, poleId) {
  return sanitizePolesRegistry(poles).filter((pole) => pole.poleId !== poleId);
}

function moveAttachment(poles, poleId, listKey, refId) {
  const target = cleanText(poleId);
  const ref = cleanText(typeof refId === 'string' || typeof refId === 'number' ? String(refId) : '');
  if (!ref) return sanitizePolesRegistry(poles);
  return sanitizePolesRegistry(poles).map((pole) => {
    const without = pole[listKey].filter((id) => id !== ref);
    return pole.poleId === target
      ? { ...pole, [listKey]: [...without, ref] }
      : { ...pole, [listKey]: without };
  });
}

function dropAttachment(poles, poleId, listKey, refId) {
  const ref = cleanText(typeof refId === 'string' || typeof refId === 'number' ? String(refId) : '');
  return sanitizePolesRegistry(poles).map((pole) => (pole.poleId === poleId
    ? { ...pole, [listKey]: pole[listKey].filter((id) => id !== ref) }
    : pole));
}

/** Attach a customer drop to a pole, MOVING it off any other pole (one-pole rule). */
export function attachDrop(poles, poleId, customerId) {
  return moveAttachment(poles, poleId, 'dropCustomerIds', customerId);
}

export function detachDrop(poles, poleId, customerId) {
  return dropAttachment(poles, poleId, 'dropCustomerIds', customerId);
}

/** Attach a splitter box to a pole, MOVING it off any other pole (one-pole rule). */
export function attachSplitterBox(poles, poleId, boxId) {
  return moveAttachment(poles, poleId, 'splitterBoxIds', boxId);
}

export function detachSplitterBox(poles, poleId, boxId) {
  return dropAttachment(poles, poleId, 'splitterBoxIds', boxId);
}

/** The inventory catalogue item a pole references, or null. Reference only. */
export function poleInventoryItem(pole) {
  return pole && pole.inventoryItemId ? inventoryItemById(pole.inventoryItemId) : null;
}

/**
 * Resolve one pole's attachments LIVE against the customer list.
 * Drops: { customerId, name, customerNumber, status: 'active' |
 * 'archived' | 'missing', poleText } — poleText is the customer's own
 * SISP-32 free-text pole/landmark, shown as context (never used to
 * link). Boxes: { boxId, status: 'present' | 'missing', portCount,
 * occupiedCount } from the derived splitter boxes.
 */
export function resolvePoleAttachments(pole, customers) {
  const list = Array.isArray(customers) ? customers : [];
  const byId = new Map(list.map((c) => [String(c && c.id), c]));
  const boxesById = new Map(buildSplitterBoxes(list).map((box) => [box.boxId, box]));
  const drops = (pole?.dropCustomerIds ?? []).map((customerId) => {
    const customer = byId.get(String(customerId));
    if (!customer) return { customerId: String(customerId), name: '', customerNumber: null, status: 'missing', poleText: '' };
    return {
      customerId: String(customerId),
      name: cleanText(customer.name),
      customerNumber: customer.customerNumber ?? null,
      status: customer.archived ? 'archived' : 'active',
      poleText: normalizePoleFields(customer).poleNumber
    };
  });
  const boxes = (pole?.splitterBoxIds ?? []).map((boxId) => {
    const box = boxesById.get(boxId);
    if (!box) return { boxId, status: 'missing', portCount: null, occupiedCount: null };
    return { boxId, status: 'present', portCount: box.portCount, occupiedCount: box.occupiedCount };
  });
  return { drops, boxes };
}

/** One display-ready card per pole, attachments resolved, counts honest. */
export function buildPoleCards(poles, customers) {
  return sanitizePolesRegistry(poles).map((pole) => {
    const { drops, boxes } = resolvePoleAttachments(pole, customers);
    return {
      ...pole,
      drops,
      boxes,
      activeDropCount: drops.filter((d) => d.status === 'active').length,
      attachedCount: drops.length + boxes.length
    };
  });
}

/** Group pole cards by stored zone label; blank zones group under ''. */
export function groupPoleCardsByZone(cards) {
  const groups = new Map();
  for (const card of Array.isArray(cards) ? cards : []) {
    const zone = card.zone || '';
    if (!groups.has(zone)) groups.set(zone, []);
    groups.get(zone).push(card);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])))
    .map(([zone, groupCards]) => ({ zone, cards: groupCards }));
}

/** Dashboard headline: poles registered, live drops + boxes attached. */
export function poleRegistrySummary(poles, customers) {
  const cards = buildPoleCards(poles, customers);
  return {
    poleCount: cards.length,
    dropCount: cards.reduce((sum, card) => sum + card.activeDropCount, 0),
    boxCount: cards.reduce((sum, card) => sum + card.boxes.filter((b) => b.status === 'present').length, 0),
    byType: Object.fromEntries(POLE_TYPES.map((type) => [type, cards.filter((card) => card.type === type).length]))
  };
}

/** Splitter box ids that exist in the data (for the attach picker). */
export function knownSplitterBoxIds(customers) {
  return buildSplitterBoxes(Array.isArray(customers) ? customers : []).map((box) => box.boxId);
}

/**
 * Modal controller (DOM wiring; returns null without the dialog, like
 * the other modal controllers, so Node tests import this module safely).
 * getState() must return the app state ({ customers }). All edits go
 * through the pure helpers above and persist via savePolesRegistry.
 */
export function setupPoleRegistryModal(getState, { onPolesChanged, onToast, onConfirm } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('poleRegistryModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const closeBtn = $('poleRegistryCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());

  const getCustomers = () => {
    try {
      const state = typeof getState === 'function' ? getState() : null;
      return state && Array.isArray(state.customers) ? state.customers : [];
    } catch {
      return [];
    }
  };

  const persist = (poles) => {
    savePolesRegistry(poles);
    render();
    if (typeof onPolesChanged === 'function') onPolesChanged();
  };

  function render() {
    const customers = getCustomers();
    const poles = loadPolesRegistry();
    const cards = buildPoleCards(poles, customers);
    const summary = poleRegistrySummary(poles, customers);

    const zoneSelect = $('poleRegistryZoneSelect');
    const zoneFilter = zoneSelect ? zoneSelect.value : 'all';
    if (zoneSelect) {
      const zones = [...new Set(cards.map((card) => card.zone || ''))];
      const current = zoneSelect.value;
      zoneSelect.innerHTML = `<option value="all">${escapeHtml(t('polereg_all_zones'))}</option>`
        + zones.map((zone) => `<option value="${escapeHtml(zone)}">${escapeHtml(zone === '' ? t('polereg_zone_not_recorded') : zone)}</option>`).join('');
      zoneSelect.value = zones.includes(current) || current === 'all' ? current : 'all';
    }

    const summaryEl = $('poleRegistrySummaryLine');
    if (summaryEl) {
      summaryEl.textContent = summary.poleCount === 0
        ? t('polereg_empty')
        : t('polereg_summary', null, { poles: summary.poleCount, drops: summary.dropCount, boxes: summary.boxCount });
    }

    const itemSelect = $('poleRegistryInventorySelect');
    if (itemSelect && itemSelect.options.length === 0) {
      itemSelect.innerHTML = `<option value="">${escapeHtml(t('polereg_no_stock_link'))}</option>`
        + INVENTORY_ITEMS.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    }

    const attachableCustomers = customers
      .filter((c) => !c.archived)
      .sort((a, b) => (a.customerNumber ?? 0) - (b.customerNumber ?? 0));
    const boxIds = knownSplitterBoxIds(customers);
    const visibleGroups = groupPoleCardsByZone(cards)
      .filter((group) => zoneFilter === 'all' || (group.zone || '') === zoneFilter);

    const listEl = $('poleRegistryList');
    if (listEl) {
      listEl.innerHTML = cards.length === 0
        ? `<p class="pole-registry-empty">${escapeHtml(t('polereg_empty'))}</p>`
        : visibleGroups.map((group) => `
          <h3 class="pole-registry-zone">${escapeHtml(group.zone === '' ? t('polereg_zone_not_recorded') : group.zone)}</h3>
          ${group.cards.map((card) => `
          <article class="pole-registry-card">
            <p class="pole-registry-card-head"><strong>${escapeHtml(card.label)}</strong><span>${escapeHtml(t(`polereg_type_${card.type}`))}</span></p>
            ${card.landmark ? `<p><span>${escapeHtml(t('polereg_landmark'))}</span><span>${escapeHtml(card.landmark)}</span></p>` : ''}
            ${card.notes ? `<p><span>${escapeHtml(t('polereg_notes'))}</span><span>${escapeHtml(card.notes)}</span></p>` : ''}
            ${poleInventoryItem(card) ? `<p><span>${escapeHtml(t('polereg_stock_link'))}</span><span>${escapeHtml(poleInventoryItem(card).name)}</span></p>` : ''}
            <p><span>${escapeHtml(t('polereg_attached'))}</span><strong>${escapeHtml(String(card.attachedCount))}</strong></p>
            <ul class="pole-registry-assets">
              ${card.drops.map((drop) => `<li>🔌 ${drop.status === 'missing'
                ? escapeHtml(t('polereg_drop_missing'))
                : `${escapeHtml(drop.name)} (#${escapeHtml(String(drop.customerNumber ?? ''))})${drop.status === 'archived' ? ` · ${escapeHtml(t('polereg_archived'))}` : ''}${drop.poleText ? ` · ${escapeHtml(drop.poleText)}` : ''}`}
                <button type="button" class="secondary-button text-button" data-pole-detach-drop="${escapeHtml(card.poleId)}" data-customer-id="${escapeHtml(drop.customerId)}">${escapeHtml(t('polereg_detach'))}</button></li>`).join('')}
              ${card.boxes.map((box) => `<li>📦 ${escapeHtml(box.boxId)}${box.status === 'missing'
                ? ` · ${escapeHtml(t('polereg_box_missing'))}`
                : ` · ${escapeHtml(t('polereg_box_ports', null, { occupied: box.occupiedCount, total: box.portCount }))}`}
                <button type="button" class="secondary-button text-button" data-pole-detach-box="${escapeHtml(card.poleId)}" data-box-id="${escapeHtml(box.boxId)}">${escapeHtml(t('polereg_detach'))}</button></li>`).join('')}
            </ul>
            <div class="pole-registry-attach">
              <select class="form-input" data-pole-drop-select="${escapeHtml(card.poleId)}" aria-label="${escapeHtml(t('polereg_attach_drop'))}">
                <option value="">${escapeHtml(t('polereg_attach_drop'))}</option>
                ${attachableCustomers.map((c) => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.name)} (#${escapeHtml(String(c.customerNumber ?? ''))})</option>`).join('')}
              </select>
              <select class="form-input" data-pole-box-select="${escapeHtml(card.poleId)}" aria-label="${escapeHtml(t('polereg_attach_box'))}">
                <option value="">${escapeHtml(t('polereg_attach_box'))}</option>
                ${boxIds.map((boxId) => `<option value="${escapeHtml(boxId)}">${escapeHtml(boxId)}</option>`).join('')}
              </select>
            </div>
            <div class="pole-registry-card-actions">
              <button type="button" class="secondary-button text-button danger" data-pole-delete="${escapeHtml(card.poleId)}">${escapeHtml(t('polereg_delete_pole'))}</button>
            </div>
          </article>`).join('')}`).join('');
    }
  }

  const listEl = $('poleRegistryList');
  if (listEl) {
    listEl.addEventListener('change', (event) => {
      const dropSelect = event.target.closest('[data-pole-drop-select]');
      if (dropSelect && dropSelect.value) {
        persist(attachDrop(loadPolesRegistry(), dropSelect.dataset.poleDropSelect, dropSelect.value));
        if (typeof onToast === 'function') onToast(t('polereg_drop_attached'));
        return;
      }
      const boxSelect = event.target.closest('[data-pole-box-select]');
      if (boxSelect && boxSelect.value) {
        persist(attachSplitterBox(loadPolesRegistry(), boxSelect.dataset.poleBoxSelect, boxSelect.value));
        if (typeof onToast === 'function') onToast(t('polereg_box_attached'));
      }
    });
    listEl.addEventListener('click', async (event) => {
      const detachDropBtn = event.target.closest('[data-pole-detach-drop]');
      if (detachDropBtn) {
        persist(detachDrop(loadPolesRegistry(), detachDropBtn.dataset.poleDetachDrop, detachDropBtn.dataset.customerId));
        return;
      }
      const detachBoxBtn = event.target.closest('[data-pole-detach-box]');
      if (detachBoxBtn) {
        persist(detachSplitterBox(loadPolesRegistry(), detachBoxBtn.dataset.poleDetachBox, detachBoxBtn.dataset.boxId));
        return;
      }
      const deleteBtn = event.target.closest('[data-pole-delete]');
      if (deleteBtn) {
        const doDelete = () => persist(removePole(loadPolesRegistry(), deleteBtn.dataset.poleDelete));
        if (typeof onConfirm === 'function') {
          const confirmed = await onConfirm({ tone: 'danger', title: t('polereg_delete_pole'), message: t('polereg_delete_confirm'), confirmLabel: t('polereg_delete_pole') });
          if (confirmed) doDelete();
        } else {
          doDelete();
        }
      }
    });
  }

  const form = $('poleRegistryForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const updated = addPole(loadPolesRegistry(), {
          label: $('poleRegistryLabel')?.value,
          zone: $('poleRegistryZone')?.value,
          type: $('poleRegistryType')?.value,
          landmark: $('poleRegistryLandmark')?.value,
          notes: $('poleRegistryNotes')?.value,
          inventoryItemId: $('poleRegistryInventorySelect')?.value
        });
        persist(updated);
        form.reset();
        if (typeof onToast === 'function') onToast(t('polereg_pole_added'));
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || t('polereg_label_required'));
      }
    });
  }

  const zoneSelect = $('poleRegistryZoneSelect');
  if (zoneSelect) zoneSelect.addEventListener('change', render);

  const open = () => { render(); dialog.showModal(); };
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openPoleRegistryModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', open);
  return { open, refresh: render };
}
