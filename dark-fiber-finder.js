/**
 * dark-fiber-finder.js — SISP-147: Spare Dark-Fiber Core Finder & 1-Click
 * Faulty Core Swap.
 *
 * Problem: a feeder cable carries 6, 12 or 24 fiber cores. Some are lit
 * (feeding a street splitter box), some get damaged/cut, and the rest sit
 * dark as spares. When a core feeding a box is damaged, the lineman needs
 * to see at a glance which cores on that cable are still spare and move
 * the box onto one — with an audit trail of what moved where, and when.
 *
 * Storage: feeder cables are NOT part of the billing ledger, so they live
 * in a device-local sibling store (localStorage key
 * sisp_feeder_cables_v1), following the SISP-37 suspense-payments pattern.
 * The registry starts EMPTY — no cable is seeded or invented; the owner
 * registers each real cable. Backups: cables travel in the JSON backup
 * `settings.feederCables` section (see core.js) under the same safe-merge
 * rule as the other sibling registers — a restore adopts them only onto
 * a device that has none yet, and a differing local register is a
 * conflict, never silently overwritten.
 *
 * Core model: cores are numbered 1..coreCount and follow the TIA-598
 * colour order (FIBER_CORE_COLORS below — defined here once because no
 * splice-closure module exists in this build to export it; SISP-78's
 * closure map is not part of main). Core 13–24 repeat the same 12 colours
 * on the second cycle (tracer), as in a real 24-core cable.
 *
 * A core carries at most ONE splitter box id, and a box hangs on at most
 * ONE core across the whole registry (assigning it elsewhere MOVES it —
 * the SISP-122 one-pole rule). Box ids are references only: boxes are
 * derived live from customers by splitter-map.js buildSplitterBoxes and
 * are never written by this module; a box id that no longer resolves
 * renders as "missing" and never crashes the view.
 *
 * The swap is pure and atomic: swapBoxToSpareCore validates everything
 * first and either returns a brand-new cables array (source core stays
 * 'damaged' and loses the box, first spare core goes 'lit' with the box,
 * exactly one audit entry appended) or returns the ORIGINAL array
 * reference untouched with a refusal reason. The controller persists the
 * result with a single saveFeederCables call, so a failed swap can never
 * half-apply. Cross-cable swaps are a physical re-route and deliberately
 * out of scope: a swap only ever picks a spare on the SAME cable.
 *
 * All helpers are pure except load/save and the modal controller's DOM
 * wiring. Tests use synthetic data only.
 */

import { buildSplitterBoxes } from './splitter-map.js';
import { t } from './nav-language.js';

export const FEEDER_CABLES_KEY = 'sisp_feeder_cables_v1';

/** Cable sizes the registry accepts (cores per feeder cable). */
export const FEEDER_CORE_COUNTS = Object.freeze([6, 12, 24]);

export const CORE_STATUSES = Object.freeze(['lit', 'damaged', 'spare']);

/** TIA-598 fibre colour order, cores 1–12 (13–24 repeat with a tracer). */
export const FIBER_CORE_COLORS = Object.freeze([
  'Blue', 'Orange', 'Green', 'Brown', 'Slate', 'White',
  'Red', 'Black', 'Yellow', 'Violet', 'Rose', 'Aqua'
]);

const ID_RE = /^FC-(\d+)$/;
const MAX_LABEL_LENGTH = 100;
const MAX_BOX_ID_LENGTH = 64;
const MAX_HISTORY_ENTRIES = 200;

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

/** TIA-598 colour for a 1-based core number; cycle 2 for cores 13–24. */
export function fiberCoreColor(n) {
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1) return { name: '', cycle: 1 };
  return {
    name: FIBER_CORE_COLORS[(num - 1) % FIBER_CORE_COLORS.length],
    cycle: Math.floor((num - 1) / FIBER_CORE_COLORS.length) + 1
  };
}

/** Next cable id: one above the highest FC-N already stored (starts at 101). */
export function nextFeederCableId(cables) {
  let max = 100;
  for (const cable of Array.isArray(cables) ? cables : []) {
    const match = ID_RE.exec(String(cable?.cableId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `FC-${max + 1}`;
}

function sanitizeCore(rawCore, n) {
  const status = CORE_STATUSES.includes(rawCore?.status) ? rawCore.status : 'spare';
  // A spare core carries no box by definition; lit and damaged cores may.
  const boxId = status === 'spare' ? '' : cleanText(rawCore?.boxId).slice(0, MAX_BOX_ID_LENGTH);
  return { n, status, boxId };
}

function sanitizeHistoryEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const at = cleanText(raw.at);
  if (!at || Number.isNaN(Date.parse(at))) return null;
  const fromCore = Number(raw.fromCore);
  const toCore = Number(raw.toCore);
  if (!Number.isInteger(fromCore) || fromCore < 1 || fromCore > 24) return null;
  if (!Number.isInteger(toCore) || toCore < 1 || toCore > 24) return null;
  const boxId = cleanText(raw.boxId).slice(0, MAX_BOX_ID_LENGTH);
  if (!boxId) return null;
  return { at, boxId, fromCore, toCore };
}

/**
 * Drops malformed cables; rebuilds each cable's core list to exactly
 * coreCount cores numbered 1..N. Enforces the one-core rule registry-wide:
 * a box id found on a second core is stripped (first occurrence wins).
 */
export function sanitizeFeederCables(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seenIds = new Set();
  const seenBoxes = new Set();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const cableId = String(raw.cableId || '');
    if (!ID_RE.test(cableId) || seenIds.has(cableId)) continue;
    const coreCount = FEEDER_CORE_COUNTS.includes(Number(raw.coreCount)) ? Number(raw.coreCount) : null;
    if (!coreCount) continue;
    seenIds.add(cableId);
    const rawCores = Array.isArray(raw.cores) ? raw.cores : [];
    const byNumber = new Map();
    for (const rawCore of rawCores) {
      const n = Number(rawCore?.n);
      if (Number.isInteger(n) && n >= 1 && n <= coreCount && !byNumber.has(n)) byNumber.set(n, rawCore);
    }
    const cores = [];
    for (let n = 1; n <= coreCount; n++) {
      const core = sanitizeCore(byNumber.get(n) ?? {}, n);
      if (core.boxId) {
        if (seenBoxes.has(core.boxId)) core.boxId = '';
        else seenBoxes.add(core.boxId);
      }
      cores.push(core);
    }
    const history = (Array.isArray(raw.history) ? raw.history : [])
      .map(sanitizeHistoryEntry)
      .filter(Boolean)
      .slice(-MAX_HISTORY_ENTRIES);
    out.push({
      cableId,
      label: cleanText(raw.label).slice(0, MAX_LABEL_LENGTH),
      coreCount,
      cores,
      history
    });
  }
  return out;
}

export function loadFeederCables(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(FEEDER_CABLES_KEY);
    if (!raw) return [];
    return sanitizeFeederCables(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveFeederCables(cables, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(FEEDER_CABLES_KEY, JSON.stringify(sanitizeFeederCables(cables)));
    return true;
  } catch {
    return false;
  }
}

/** A fresh cable with every core spare. Returns null on invalid input. */
export function createFeederCable(cables, { label, coreCount } = {}) {
  const count = Number(coreCount);
  if (!FEEDER_CORE_COUNTS.includes(count)) return null;
  const cores = [];
  for (let n = 1; n <= count; n++) cores.push({ n, status: 'spare', boxId: '' });
  return {
    cableId: nextFeederCableId(cables),
    label: cleanText(label).slice(0, MAX_LABEL_LENGTH),
    coreCount: count,
    cores,
    history: []
  };
}

/** Pure: returns a new cables array with the cable appended (input untouched). */
export function addFeederCable(cables, draft) {
  const cable = createFeederCable(cables, draft);
  if (!cable) return null;
  return [...sanitizeFeederCables(cables), cable];
}

/** First (lowest-numbered) spare core on a cable, or null. */
export function findSpareCore(cable) {
  if (!cable || !Array.isArray(cable.cores)) return null;
  return cable.cores.find((core) => core.status === 'spare') ?? null;
}

/** All spare cores on a cable, in core order. */
export function spareCoresOf(cable) {
  if (!cable || !Array.isArray(cable.cores)) return [];
  return cable.cores.filter((core) => core.status === 'spare');
}

function cloneCable(cable) {
  return {
    ...cable,
    cores: cable.cores.map((core) => ({ ...core })),
    history: cable.history.map((entry) => ({ ...entry }))
  };
}

/**
 * Pure: set one core's status. Marking a core 'spare' clears its box.
 * Returns { ok: true, cables } or { ok: false, reason, cables: <original> }.
 */
export function setCoreStatus(cables, cableId, coreN, status) {
  const list = sanitizeFeederCables(cables);
  const fail = (reason) => ({ ok: false, reason, cables });
  if (!CORE_STATUSES.includes(status)) return fail('invalid-status');
  const cable = list.find((item) => item.cableId === cableId);
  if (!cable) return fail('cable-not-found');
  const core = cable.cores.find((item) => item.n === Number(coreN));
  if (!core) return fail('core-not-found');
  const next = list.map((item) => {
    if (item.cableId !== cableId) return item;
    const copy = cloneCable(item);
    const target = copy.cores.find((item2) => item2.n === core.n);
    target.status = status;
    if (status === 'spare') target.boxId = '';
    return copy;
  });
  return { ok: true, cables: next };
}

/**
 * Pure: assign a box to a core (the core goes 'lit'). One-core rule: if
 * the box already hangs on another core anywhere in the registry it is
 * MOVED (stripped from the old core, whose status is left as-is minus
 * the box — a lit core that loses its box drops to 'spare'; a damaged
 * core stays 'damaged'). Passing boxId '' clears the target core's box.
 */
export function assignBoxToCore(cables, cableId, coreN, boxId) {
  const list = sanitizeFeederCables(cables);
  const fail = (reason) => ({ ok: false, reason, cables });
  const cable = list.find((item) => item.cableId === cableId);
  if (!cable) return fail('cable-not-found');
  const core = cable.cores.find((item) => item.n === Number(coreN));
  if (!core) return fail('core-not-found');
  const box = cleanText(boxId).slice(0, MAX_BOX_ID_LENGTH);
  const next = list.map((item) => {
    const copy = cloneCable(item);
    for (const itemCore of copy.cores) {
      if (box && itemCore.boxId === box && !(item.cableId === cableId && itemCore.n === core.n)) {
        itemCore.boxId = '';
        if (itemCore.status === 'lit') itemCore.status = 'spare';
      }
    }
    if (item.cableId === cableId) {
      const target = copy.cores.find((itemCore) => itemCore.n === core.n);
      target.boxId = box;
      target.status = box ? 'lit' : (target.status === 'lit' ? 'spare' : target.status);
    }
    return copy;
  });
  return { ok: true, cables: next };
}

/**
 * Pure + atomic 1-click swap: move `boxId` from the DAMAGED core it sits
 * on (on cable `cableId`) to the first spare core of the SAME cable.
 * On success the source core stays 'damaged' and loses the box, the
 * target core goes 'lit' with the box, and exactly one audit entry
 * { at, boxId, fromCore, toCore } is appended to the cable's history.
 * On any refusal the returned `cables` is the original array reference —
 * byte-identical, nothing half-applied.
 */
export function swapBoxToSpareCore(cables, cableId, boxId, now = new Date()) {
  const fail = (reason) => ({ ok: false, reason, cables });
  const list = Array.isArray(cables) ? cables : [];
  const cable = list.find((item) => item?.cableId === cableId);
  if (!cable) return fail('cable-not-found');
  const box = cleanText(boxId);
  if (!box) return fail('box-not-found');
  const source = (Array.isArray(cable.cores) ? cable.cores : []).find((core) => core?.boxId === box);
  if (!source) return fail('box-not-found');
  if (source.status !== 'damaged') return fail('not-damaged');
  const target = findSpareCore(cable);
  if (!target) return fail('no-spare');
  const at = (now instanceof Date ? now : new Date(now)).toISOString();
  const entry = { at, boxId: box, fromCore: source.n, toCore: target.n };
  const next = list.map((item) => {
    if (item.cableId !== cableId) return item;
    const copy = cloneCable(item);
    const src = copy.cores.find((core) => core.n === source.n);
    src.boxId = '';
    src.status = 'damaged';
    const dst = copy.cores.find((core) => core.n === target.n);
    dst.status = 'lit';
    dst.boxId = box;
    copy.history = [...copy.history, entry].slice(-MAX_HISTORY_ENTRIES);
    return copy;
  });
  return { ok: true, cables: next, entry };
}

/**
 * Read-only view model for one cable: every core with its TIA-598 colour,
 * status and resolved box (a box id with no matching derived box resolves
 * to boxExists:false — rendered "missing", never a crash), plus counts
 * and the swap audit history, latest first. `boxes` is the derived list
 * from splitter-map.js buildSplitterBoxes(customers).
 */
export function buildCableCoreView(cable, boxes) {
  if (!cable) return null;
  const boxList = Array.isArray(boxes) ? boxes : [];
  const cores = (Array.isArray(cable.cores) ? cable.cores : []).map((core) => {
    const box = core.boxId ? boxList.find((item) => item.boxId === core.boxId) ?? null : null;
    return {
      n: core.n,
      color: fiberCoreColor(core.n),
      status: core.status,
      boxId: core.boxId || '',
      boxExists: core.boxId ? Boolean(box) : false,
      box: box ? { boxId: box.boxId, portCount: box.portCount, occupiedCount: box.occupiedCount } : null,
      canSwap: core.status === 'damaged' && Boolean(core.boxId)
    };
  });
  return {
    cableId: cable.cableId,
    label: cable.label || '',
    coreCount: cable.coreCount,
    cores,
    litCount: cores.filter((core) => core.status === 'lit').length,
    damagedCount: cores.filter((core) => core.status === 'damaged').length,
    spareCount: cores.filter((core) => core.status === 'spare').length,
    spares: cores.filter((core) => core.status === 'spare').map((core) => core.n),
    history: [...(Array.isArray(cable.history) ? cable.history : [])].reverse()
  };
}

/** History timestamp, house style: medium date + time in Pakistan time. */
export function formatHistoryWhen(iso) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi'
    }).format(parsed);
  } catch {
    return parsed.toISOString();
  }
}

const STATUS_EMOJI = Object.freeze({ lit: '🟢', damaged: '🔴', spare: '⚪' });

function statusLabel(status, lang = null) {
  if (status === 'lit') return t('dfib_status_lit', lang);
  if (status === 'damaged') return t('dfib_status_damaged', lang);
  return t('dfib_status_spare', lang);
}

export function renderCoreCell(view, core, lang = null) {
  const colorName = core.color.cycle > 1
    ? `${core.color.name} · ${t('dfib_color_cycle', lang, { cycle: core.color.cycle })}`
    : core.color.name;
  const boxLine = core.boxId
    ? core.boxExists
      ? `<span class="dfib-core-box">${escapeHtml(core.boxId)} · 1:${core.box?.portCount ?? ''}</span>`
      : `<span class="dfib-core-box dfib-core-missing">${escapeHtml(core.boxId)} · ${escapeHtml(t('dfib_box_missing', lang))}</span>`
    : '';
  const swapBtn = core.canSwap
    ? `<button type="button" class="action-btn-sm dfib-swap-btn" data-dfib-swap="${escapeHtml(view.cableId)}" data-dfib-box="${escapeHtml(core.boxId)}">${escapeHtml(t('dfib_swap_btn', lang))}</button>`
    : '';
  return `<div class="dfib-core dfib-core-${core.status}">
    <span class="dfib-core-number">${escapeHtml(t('dfib_core_label', lang, { n: core.n }))}</span>
    <span class="dfib-core-color">${escapeHtml(colorName)}</span>
    <span class="dfib-core-status">${STATUS_EMOJI[core.status] ?? ''} ${escapeHtml(statusLabel(core.status, lang))}</span>
    ${boxLine}
    <label class="dfib-core-set">${escapeHtml(t('dfib_set_status', lang))}
      <select class="form-input dfib-status-select" data-dfib-cable="${escapeHtml(view.cableId)}" data-dfib-core="${core.n}" aria-label="${escapeHtml(t('dfib_set_status', lang))}">
        ${CORE_STATUSES.map((status) => `<option value="${status}"${status === core.status ? ' selected' : ''}>${STATUS_EMOJI[status]} ${escapeHtml(statusLabel(status, lang))}</option>`).join('')}
      </select>
    </label>
    ${swapBtn}
  </div>`;
}

export function renderCableCard(view, { sparesOnly = false, lang = null } = {}) {
  if (!view) return '';
  const cores = sparesOnly ? view.cores.filter((core) => core.status === 'spare') : view.cores;
  const history = view.history.length
    ? `<div class="dfib-history"><h4>${escapeHtml(t('dfib_history_title', lang))}</h4><ul>${view.history.map((entry) => `<li>${escapeHtml(formatHistoryWhen(entry.at))} · ${escapeHtml(t('dfib_history_entry', lang, { box: entry.boxId, from: entry.fromCore, to: entry.toCore }))}</li>`).join('')}</ul></div>`
    : '';
  return `<article class="dfib-cable-card" data-dfib-cable-card="${escapeHtml(view.cableId)}">
    <header class="dfib-cable-head">
      <strong>${escapeHtml(view.label || view.cableId)}</strong>
      <span class="dfib-cable-meta">${escapeHtml(view.cableId)} · ${view.coreCount} ${escapeHtml(t('dfib_cores_word', lang))} · 🟢 ${view.litCount} · 🔴 ${view.damagedCount} · ⚪ ${view.spareCount} ${escapeHtml(t('dfib_status_spare', lang))}</span>
    </header>
    <div class="dfib-core-grid">${cores.map((core) => renderCoreCell(view, core, lang)).join('') || `<p class="dfib-empty">${escapeHtml(t('dfib_no_spares', lang))}</p>`}</div>
    ${history}
  </article>`;
}

/**
 * Modal controller, mirroring setupSplitterMapModal: the controller wires
 * its own open button (openDarkFiberModalBtn), close button, add-cable
 * form, spares-only filter, per-core status selects, box assignment row
 * and the 1-click swap buttons. getState supplies the live app state
 * ({ customers }); cables are read fresh from the sibling store on every
 * render and every mutation is one saveFeederCables write.
 */
export function setupDarkFiberModal(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('darkFiberModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let sparesOnly = false;

  const toast = (msg) => { if (onToast) onToast(msg); };
  const customers = () => {
    const state = typeof getState === 'function' ? getState() : {};
    return state?.customers ?? [];
  };

  function render() {
    const cables = loadFeederCables();
    const boxes = buildSplitterBoxes(customers());
    const listEl = $('darkFiberCableList');
    if (listEl) {
      listEl.innerHTML = cables.length === 0
        ? `<p class="dfib-empty">${escapeHtml(t('dfib_empty'))}</p>`
        : cables.map((cable) => renderCableCard(buildCableCoreView(cable, boxes), { sparesOnly })).join('');
    }
    const assignCable = $('darkFiberAssignCable');
    const assignCore = $('darkFiberAssignCore');
    const assignBox = $('darkFiberAssignBox');
    if (assignCable) {
      const previous = assignCable.value;
      assignCable.innerHTML = cables.map((cable) => `<option value="${escapeHtml(cable.cableId)}">${escapeHtml(cable.label || cable.cableId)} (${escapeHtml(cable.cableId)})</option>`).join('');
      if (cables.some((cable) => cable.cableId === previous)) assignCable.value = previous;
    }
    if (assignCore && assignCable) {
      const cable = cables.find((item) => item.cableId === assignCable.value) ?? cables[0];
      assignCore.innerHTML = cable
        ? cable.cores.map((core) => `<option value="${core.n}">${escapeHtml(t('dfib_core_label', null, { n: core.n }))} — ${STATUS_EMOJI[core.status]} ${escapeHtml(statusLabel(core.status))}${core.boxId ? ` · ${escapeHtml(core.boxId)}` : ''}</option>`).join('')
        : '';
    }
    if (assignBox) {
      const previousBox = assignBox.value;
      assignBox.innerHTML = `<option value="">${escapeHtml(t('dfib_assign_none'))}</option>`
        + boxes.map((box) => `<option value="${escapeHtml(box.boxId)}">${escapeHtml(box.boxId)} · 1:${box.portCount}</option>`).join('');
      if (boxes.some((box) => box.boxId === previousBox)) assignBox.value = previousBox;
    }
    const assignRow = $('darkFiberAssignRow');
    if (assignRow) assignRow.style.display = cables.length === 0 ? 'none' : '';
  }

  function mutate(result, successMsg) {
    if (!result || !result.ok) {
      toast(t('dfib_action_refused'));
      return;
    }
    saveFeederCables(result.cables);
    if (successMsg) toast(successMsg);
    render();
  }

  const addBtn = $('darkFiberAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const labelEl = $('darkFiberLabelInput');
      const countEl = $('darkFiberCoreCountSelect');
      const next = addFeederCable(loadFeederCables(), {
        label: labelEl ? labelEl.value : '',
        coreCount: countEl ? countEl.value : ''
      });
      if (!next) { toast(t('dfib_action_refused')); return; }
      saveFeederCables(next);
      if (labelEl) labelEl.value = '';
      toast(t('dfib_cable_added'));
      render();
    });
  }

  const sparesToggle = $('darkFiberSparesOnly');
  if (sparesToggle) {
    sparesToggle.addEventListener('change', () => {
      sparesOnly = sparesToggle.checked === true;
      render();
    });
  }

  const assignBtn = $('darkFiberAssignBtn');
  if (assignBtn) {
    assignBtn.addEventListener('click', () => {
      const cableId = $('darkFiberAssignCable')?.value ?? '';
      const coreN = $('darkFiberAssignCore')?.value ?? '';
      const boxId = $('darkFiberAssignBox')?.value ?? '';
      mutate(assignBoxToCore(loadFeederCables(), cableId, Number(coreN), boxId), t('dfib_box_assigned'));
    });
  }

  const assignCableEl = $('darkFiberAssignCable');
  if (assignCableEl) assignCableEl.addEventListener('change', render);

  const listEl = $('darkFiberCableList');
  if (listEl) {
    listEl.addEventListener('click', (event) => {
      const btn = event.target?.closest?.('[data-dfib-swap]');
      if (!btn) return;
      const cables = loadFeederCables();
      const result = swapBoxToSpareCore(cables, btn.dataset.dfibSwap, btn.dataset.dfibBox, new Date());
      if (!result.ok) {
        toast(result.reason === 'no-spare' ? t('dfib_no_spare_toast') : t('dfib_action_refused'));
        return;
      }
      saveFeederCables(result.cables);
      toast(t('dfib_swap_done', null, { box: result.entry.boxId, from: result.entry.fromCore, to: result.entry.toCore }));
      render();
    });
    listEl.addEventListener('change', (event) => {
      const select = event.target?.closest?.('.dfib-status-select');
      if (!select) return;
      mutate(setCoreStatus(loadFeederCables(), select.dataset.dfibCable, Number(select.dataset.dfibCore), select.value), null);
    });
  }

  const closeBtn = $('darkFiberCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openDarkFiberModalBtn') : null;
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      render();
      dialog.showModal();
    });
  }

  return {
    open() {
      render();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else if (onToast) onToast(t('dfib_action_refused'));
    },
    refresh() {
      render();
    }
  };
}
