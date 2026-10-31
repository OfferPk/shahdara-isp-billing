/**
 * fiber-drum-tracker.js — SISP-119: Fiber Drum Jacket Meter-Mark
 * (0001m–2000m) Cut Calculator.
 *
 * A fiber drum is not a number in a stock book: it is one physical roll
 * whose jacket is printed with a running meter mark. When the lineman
 * pulls cable off the drum, the honest record is the pair of jacket
 * marks — where the cut started and where it ended — and the length
 * used is simply metersUsed = Math.abs(endJacketMark - startJacketMark).
 *
 * Storage: drums live in localStorage under FIBER_DRUMS_KEY
 * (sisp_fiber_drums_v1) as a flat array of drum records:
 *   { drumId (DRUM-101+), label, inventoryItemId, initialLength,
 *     startJacketMark, cuts: [ { cutId, date, startMark, endMark,
 *     metersUsed, note, inventoryMovementId } ], createdAt }
 * The registry starts EMPTY — no drum is ever seeded.
 *
 * Remaining length is always DERIVED (initialLength minus the sum of
 * recorded cuts) — never stored — so a drum can never drift from its
 * own cut history, exactly like the SISP-18 stock book derives
 * available stock from its movement log.
 *
 * Inventory deduction goes through the SHIPPED SISP-18 path only:
 * a drum may carry an explicit inventoryItemId link, chosen when the
 * drum is added, pointing at a meter-unit catalog item (normally
 * 'fiber-2core'). Recording a cut on a linked drum appends a stock-out
 * movement through inventory-book's addMovement — this module never
 * writes sisp_inventory_v1 itself. A drum with no link still records
 * its cuts; the inventory step is reported as skipped, never faked.
 *
 * Atomicity: recordCut is pure and validates EVERYTHING (drum exists,
 * marks valid, cut non-zero, cut fits the drum's remaining length, and
 * — for linked drums — the inventory stock-out itself) before the
 * caller persists anything. addMovement throws on insufficient stock,
 * so a refused cut leaves drums AND inventory byte-identical. One cut
 * is one history entry with a unique cutId; re-rendering or reloading
 * can never deduct twice.
 *
 * Backup: drums travel in the JSON backup `settings.fiberDrums`
 * section (see core.js), under the same safe-merge rule as the
 * SISP-18 stock book: adopted only when this device has none stored
 * yet; differing records on both sides surface as a conflict.
 *
 * All helpers are pure except loadFiberDrums/saveFiberDrums and the
 * modal controller. Tests use synthetic data only.
 */

import {
  INVENTORY_ITEMS,
  inventoryItemById,
  addMovement,
  loadInventory,
  saveInventory
} from './inventory-book.js';
import { t } from './nav-language.js';

export const FIBER_DRUMS_KEY = 'sisp_fiber_drums_v1';

const DRUM_ID_RE = /^DRUM-(\d+)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function markOf(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? round2(n) : null;
}

/** True when `itemId` names a meter-unit catalog item (cable that can come off a drum). */
export function isMeterInventoryItem(itemId) {
  const item = inventoryItemById(itemId);
  return item !== null && item.unit === 'meters';
}

/** Next drum id: one above the highest DRUM-N already stored (starts at 101). */
export function nextDrumId(drums) {
  let max = 100;
  for (const drum of Array.isArray(drums) ? drums : []) {
    const match = DRUM_ID_RE.exec(String(drum?.drumId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `DRUM-${max + 1}`;
}

function sanitizeCuts(value, drumId, initialLength) {
  if (!Array.isArray(value)) return [];
  const out = [];
  let usedSoFar = 0;
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    if (!isValidDateKey(entry.date)) return;
    const startMark = markOf(entry.startMark);
    const endMark = markOf(entry.endMark);
    if (startMark === null || endMark === null) return;
    // metersUsed is always recomputed from the marks — a stored figure
    // is never trusted, so history can never disagree with itself.
    const metersUsed = round2(Math.abs(endMark - startMark));
    if (!(metersUsed > 0)) return;
    if (round2(usedSoFar + metersUsed) > initialLength) return;
    usedSoFar = round2(usedSoFar + metersUsed);
    out.push({
      cutId: cleanText(entry.cutId) || `${drumId}-C${index + 1}`,
      date: entry.date,
      startMark,
      endMark,
      metersUsed,
      note: cleanText(entry.note).slice(0, 200),
      inventoryMovementId: cleanText(entry.inventoryMovementId)
    });
  });
  // Guarantee cut ids are unique within the drum even after cleanup.
  const seen = new Set();
  for (const cut of out) {
    if (seen.has(cut.cutId)) cut.cutId = `${cut.cutId}-${seen.size + 1}`;
    seen.add(cut.cutId);
  }
  return out;
}

/** Drops malformed drums; keeps clean drums in stored order. */
export function sanitizeFiberDrums(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const label = cleanText(entry.label).slice(0, 100);
    if (!label) continue;
    const initialLength = markOf(entry.initialLength);
    if (initialLength === null || !(initialLength > 0)) continue;
    const drumId = DRUM_ID_RE.test(String(entry.drumId || '')) ? String(entry.drumId) : '';
    const inventoryItemId = isMeterInventoryItem(entry.inventoryItemId) ? String(entry.inventoryItemId) : '';
    const startMark = markOf(entry.startJacketMark);
    out.push({
      drumId,
      label,
      inventoryItemId,
      initialLength,
      startJacketMark: startMark === null ? 0 : startMark,
      cuts: [],
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      _rawCuts: entry.cuts
    });
  }
  // Fill in ids for drums that arrived without one, in stored order.
  let next = 101;
  const used = new Set(out.map((d) => d.drumId).filter(Boolean));
  for (const drum of out) {
    if (!drum.drumId) {
      while (used.has(`DRUM-${next}`)) next++;
      drum.drumId = `DRUM-${next}`;
      used.add(drum.drumId);
      next++;
    }
    drum.cuts = sanitizeCuts(drum._rawCuts, drum.drumId, drum.initialLength);
    delete drum._rawCuts;
  }
  return out;
}

/** Reads drum records; [] on missing/corrupt storage. */
export function loadFiberDrums(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(FIBER_DRUMS_KEY);
    if (!raw) return [];
    return sanitizeFiberDrums(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists drum records; never throws. */
export function saveFiberDrums(drums, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(FIBER_DRUMS_KEY, JSON.stringify(sanitizeFiberDrums(drums)));
    return true;
  } catch {
    return false;
  }
}

/** Meters used by one drum: the sum of its recorded cuts. */
export function drumUsedMeters(drum) {
  const cuts = drum && Array.isArray(drum.cuts) ? drum.cuts : [];
  return round2(cuts.reduce((sum, cut) => sum + (Number(cut.metersUsed) || 0), 0));
}

/** Meters remaining on one drum: initial length minus recorded cuts. Derived, never stored. */
export function drumRemainingMeters(drum) {
  const initial = drum ? Number(drum.initialLength) || 0 : 0;
  return round2(initial - drumUsedMeters(drum));
}

/** Registry totals for the dashboard card + modal header. */
export function fiberDrumSummary(drums) {
  const clean = sanitizeFiberDrums(drums);
  let totalInitial = 0;
  let totalUsed = 0;
  for (const drum of clean) {
    totalInitial += drum.initialLength;
    totalUsed += drumUsedMeters(drum);
  }
  return {
    drumCount: clean.length,
    totalInitial: round2(totalInitial),
    totalUsed: round2(totalUsed),
    totalRemaining: round2(totalInitial - totalUsed)
  };
}

/**
 * Adds one drum. Validates the label, a positive drum length, a
 * non-negative starting jacket mark, and — when given — a link to a
 * real meter-unit inventory item. Returns the new drum list (input
 * untouched). Throws with a plain message on invalid input.
 */
export function addDrum(drums, input) {
  const clean = sanitizeFiberDrums(drums);
  const label = cleanText(input?.label).slice(0, 100);
  if (!label) throw new Error('Drum label is required.');
  const initialLength = markOf(input?.initialLength);
  if (initialLength === null || !(initialLength > 0)) throw new Error('Drum length must be a positive number of meters.');
  const startMark = input?.startJacketMark === undefined || input?.startJacketMark === ''
    ? 0
    : markOf(input.startJacketMark);
  if (startMark === null) throw new Error('Starting jacket mark must be zero or more.');
  const inventoryItemId = cleanText(input?.inventoryItemId);
  if (inventoryItemId && !isMeterInventoryItem(inventoryItemId)) {
    throw new Error('Linked stock item must be a meter-unit cable item.');
  }
  const drum = {
    drumId: nextDrumId(clean),
    label,
    inventoryItemId,
    initialLength,
    startJacketMark: startMark,
    cuts: [],
    createdAt: new Date().toISOString()
  };
  return [...clean, drum];
}

/**
 * Records one cut on one drum. Pure: returns
 * { drums, movements, cut, inventoryDeducted } with NEW arrays; the
 * inputs are never mutated, so a caller persists both results or —
 * when this throws — neither.
 *
 * Refusals (nothing changes): unknown drum, invalid date, invalid
 * marks, a zero-length cut (start mark == end mark), a cut longer
 * than the drum's remaining length, and — for a linked drum — the
 * inventory system's own refusal when stock is insufficient.
 *
 * For a linked drum the stock-out goes through inventory-book's
 * addMovement (the shipped SISP-18 path) and the cut records the
 * movement id it created. For an unlinked drum the movements list is
 * returned untouched and inventoryDeducted is false.
 */
export function recordCut(drums, movements, input) {
  const clean = sanitizeFiberDrums(drums);
  const drum = clean.find((d) => String(d.drumId) === String(input?.drumId || ''));
  if (!drum) throw new Error('Drum not found.');
  if (!isValidDateKey(input?.date)) throw new Error('A valid date is required.');
  const startMark = markOf(input?.startMark);
  const endMark = markOf(input?.endMark);
  if (startMark === null || endMark === null) throw new Error('Jacket marks must be zero or more.');
  const metersUsed = round2(Math.abs(endMark - startMark));
  if (!(metersUsed > 0)) throw new Error('Start and end jacket marks are the same — nothing was cut.');
  const remaining = drumRemainingMeters(drum);
  if (metersUsed > remaining) {
    throw new Error(`Cut of ${metersUsed} m exceeds the ${remaining} m remaining on this drum.`);
  }

  let nextMovements = movements;
  let movementId = '';
  let inventoryDeducted = false;
  if (drum.inventoryItemId) {
    // The shipped SISP-18 stock-out: throws when stock is insufficient,
    // which aborts the whole cut before anything is persisted.
    nextMovements = addMovement(movements, {
      itemId: drum.inventoryItemId,
      kind: 'out',
      qty: metersUsed,
      date: input.date,
      customerName: '',
      note: `Fiber drum ${drum.label} (${drum.drumId}) cut ${startMark} m → ${endMark} m`
    });
    movementId = String(nextMovements[nextMovements.length - 1]?.id || '');
    inventoryDeducted = true;
  }

  const cut = {
    cutId: `${drum.drumId}-C${drum.cuts.length + 1}`,
    date: input.date,
    startMark,
    endMark,
    metersUsed,
    note: cleanText(input?.note).slice(0, 200),
    inventoryMovementId: movementId
  };
  const nextDrums = clean.map((d) => (d.drumId === drum.drumId ? { ...d, cuts: [...d.cuts, cut] } : d));
  return { drums: nextDrums, movements: nextMovements, cut, inventoryDeducted };
}

function formatMeters(n) {
  return `${round2(Number(n) || 0)} m`;
}

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Dashboard + modal controller, following the inventory-book pattern:
 * open() / refresh(), open button wired by id, close button, forms.
 * The registry keeps its own localStorage ledger, so getState is
 * accepted only for signature parity with the other controllers.
 * A recorded cut persists the drums and — only when a stock-out was
 * actually computed — the inventory movements, together.
 */
export function setupFiberDrumModal(_getState, { onDrumsChanged, onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('fiberDrumModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);

  function render() {
    const drums = loadFiberDrums();
    const summary = fiberDrumSummary(drums);
    const summaryEl = $('fiberDrumSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = summary.drumCount === 0
        ? t('drum_summary_none')
        : `${t(summary.drumCount === 1 ? 'drum_count_sing' : 'drum_count_plur', null, { count: summary.drumCount })} · ${t('drum_remaining_total', null, { meters: round2(summary.totalRemaining) })}`;
    }
    const listEl = $('fiberDrumList');
    if (listEl) {
      listEl.innerHTML = drums.length === 0
        ? `<p class="fiber-drum-empty">${escapeHtml(t('drum_none'))}</p>`
        : drums.map((drum) => {
          const item = drum.inventoryItemId ? inventoryItemById(drum.inventoryItemId) : null;
          const cutsHtml = drum.cuts.length === 0
            ? `<p><span>${escapeHtml(t('drum_cuts_heading'))}</span><strong>${escapeHtml(t('drum_no_cuts'))}</strong></p>`
            : [...drum.cuts].reverse().map((cut) => `
              <p><span>${escapeHtml(t('drum_cut_line', null, { date: cut.date, start: cut.startMark, end: cut.endMark, used: cut.metersUsed }))}</span><strong>${escapeHtml(cut.inventoryMovementId ? t('drum_deducted') : t('drum_not_deducted'))}</strong></p>
              ${cut.note ? `<p><span>${escapeHtml(t('drum_note'))}</span><strong>${escapeHtml(cut.note)}</strong></p>` : ''}`).join('');
          return `<article class="fiber-drum-card">
            <p><span>${escapeHtml(drum.drumId)}</span><strong>${escapeHtml(drum.label)}</strong></p>
            <p><span>${escapeHtml(t('drum_total'))}</span><strong>${escapeHtml(formatMeters(drum.initialLength))}</strong></p>
            <p><span>${escapeHtml(t('drum_used'))}</span><strong>${escapeHtml(formatMeters(drumUsedMeters(drum)))}</strong></p>
            <p><span>${escapeHtml(t('drum_remaining'))}</span><strong>${escapeHtml(formatMeters(drumRemainingMeters(drum)))}</strong></p>
            <p><span>${escapeHtml(t('drum_linked'))}</span><strong>${escapeHtml(item ? item.name : t('drum_unlinked'))}</strong></p>
            ${cutsHtml}
          </article>`;
        }).join('');
    }
    const itemSelect = $('fiberDrumItem');
    if (itemSelect && itemSelect.options.length === 0) {
      const meterItems = INVENTORY_ITEMS.filter((item) => item.unit === 'meters');
      itemSelect.innerHTML = `<option value="">${escapeHtml(t('drum_no_link'))}</option>`
        + meterItems.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    }
    const drumSelect = $('fiberDrumPick');
    if (drumSelect) {
      const previous = drumSelect.value;
      drumSelect.innerHTML = drums.map((drum) => `<option value="${escapeHtml(drum.drumId)}">${escapeHtml(drum.label)} (${escapeHtml(drum.drumId)}) — ${escapeHtml(formatMeters(drumRemainingMeters(drum)))} ${escapeHtml(t('drum_remaining'))}</option>`).join('');
      if (previous && drums.some((d) => d.drumId === previous)) drumSelect.value = previous;
    }
    const dateInput = $('fiberDrumCutDate');
    if (dateInput && !dateInput.value) dateInput.value = todayLocal();
  }

  const addForm = $('fiberDrumAddForm');
  if (addForm) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const updated = addDrum(loadFiberDrums(), {
          label: $('fiberDrumLabel')?.value,
          inventoryItemId: $('fiberDrumItem')?.value,
          initialLength: $('fiberDrumInitial')?.value,
          startJacketMark: $('fiberDrumStartMark')?.value
        });
        saveFiberDrums(updated);
        addForm.reset();
        render();
        if (typeof onDrumsChanged === 'function') onDrumsChanged();
        if (typeof onToast === 'function') onToast(t('drum_added_toast'));
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not add this drum.');
      }
    });
  }

  const cutForm = $('fiberDrumCutForm');
  if (cutForm) {
    cutForm.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const result = recordCut(loadFiberDrums(), loadInventory(), {
          drumId: $('fiberDrumPick')?.value,
          date: $('fiberDrumCutDate')?.value,
          startMark: $('fiberDrumCutStart')?.value,
          endMark: $('fiberDrumCutEnd')?.value,
          note: $('fiberDrumCutNote')?.value
        });
        saveFiberDrums(result.drums);
        if (result.inventoryDeducted) saveInventory(result.movements);
        cutForm.reset();
        const dateInput = $('fiberDrumCutDate');
        if (dateInput) dateInput.value = todayLocal();
        render();
        if (typeof onDrumsChanged === 'function') onDrumsChanged();
        if (typeof onToast === 'function') {
          onToast(t(result.inventoryDeducted ? 'drum_cut_toast_deducted' : 'drum_cut_toast', null, { used: result.cut.metersUsed }));
        }
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not record this cut.');
      }
    });
  }

  const closeBtn = $('fiberDrumCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openFiberDrumModalBtn') : null;
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
