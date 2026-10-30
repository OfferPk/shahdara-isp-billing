/**
 * fiber-splice-closure.js — SISP-78 [P1]: TIA-598 12-Core Fiber Joint
 * Closure (JC Box) Color Splice Map ("فائبر جوائنٹ بکس اور کور کلر
 * سپلائس میپنگ").
 *
 * A street joint closure takes one 12-core feeder cable and splices its
 * cores out to splitter boxes, an upstream PON, media converters, or
 * leaves them spare. Before SISP-78 that mapping lived in the splicer's
 * memory — when a core was cut or a splitter moved, nobody could say
 * which color went where without opening the box.
 *
 * One closure record:
 *   { closureId ("JC-01", "JC-02", …), name (operator label, e.g.
 *     "JC-Barrian-01"), landmark, cores: [12 × { core (1–12),
 *     targetType ('splitter' | 'pon' | 'media-converter' | 'spare'),
 *     targetRef }], createdAt, updatedAt }
 * The 12 core colors are the TIA-598 standard sequence (1 Blue …
 * 12 Aqua) — a fixed industry constant, never stored per record; only
 * the assignment per core is stored. Splitter targets reference the
 * SISP-24 splitter map data (splitter box ids recorded on customer
 * profiles, e.g. "SPL-Barrian-02" / "DB-01"); the picker offers those
 * ids and also accepts a typed id, because a box may be spliced before
 * its first customer is connected.
 *
 * The Splicer Field Card is the 1-click printable sheet (house print
 * pattern: standalone black-on-white HTML, window.print) plus a
 * WhatsApp share of the same card as text. The share uses the app's
 * recipient-less wa.me/?text= pattern (Daily Closing / collection
 * target precedent): a field card has no fixed recipient — the
 * operator picks the splicer in WhatsApp. formatWhatsAppUrl is not
 * imported here because form-validation.js imports core.js and this
 * module is imported BY core.js (its sanitizer) — that would cycle.
 *
 * Color swatches: the TIA fiber colors are DATA, not theme chrome, so
 * the swatch fill is the literal standard color (with a fixed neutral
 * outline so White / Yellow / Black stay visible on any background).
 * All surrounding UI uses theme tokens like every other module.
 *
 * Storage: closures live in localStorage under SPLICE_CLOSURES_KEY
 * (sisp_splice_closures_v1), a flat array. Backup: records travel in
 * the JSON backup `settings.spliceClosures` section (see core.js),
 * under the same safe-merge rule as billing groups / suspense
 * payments: adopted only when this device has none stored yet.
 * No closures are seeded — an untouched install shows an empty map.
 *
 * Pure helpers are testable without the app; the modal controller at
 * the bottom needs a DOM and is inspection-verified (no DOM harness
 * in node:test), like the other modal controllers.
 */

import { t } from './nav-language.js';
import { buildSplitterBoxes } from './splitter-map.js';

export const SPLICE_CLOSURES_KEY = 'sisp_splice_closures_v1';

/**
 * TIA-598-C standard 12-color fiber sequence. `hex` values are the
 * commonly published screen approximations of the standard jacket
 * colors — they are the data being recorded, not UI theme colors.
 */
export const TIA598_CORES = Object.freeze([
  { core: 1, colorName: 'Blue', hex: '#0072CE' },
  { core: 2, colorName: 'Orange', hex: '#FF6712' },
  { core: 3, colorName: 'Green', hex: '#43B02A' },
  { core: 4, colorName: 'Brown', hex: '#8A5A2B' },
  { core: 5, colorName: 'Slate', hex: '#757B85' },
  { core: 6, colorName: 'White', hex: '#FFFFFF' },
  { core: 7, colorName: 'Red', hex: '#DA291C' },
  { core: 8, colorName: 'Black', hex: '#101010' },
  { core: 9, colorName: 'Yellow', hex: '#FFD100' },
  { core: 10, colorName: 'Violet', hex: '#87189D' },
  { core: 11, colorName: 'Rose', hex: '#F04E98' },
  { core: 12, colorName: 'Aqua', hex: '#00A9CE' }
]);

/** Where a core can be spliced to. 'spare' = not connected. */
export const CORE_TARGET_TYPES = Object.freeze(['splitter', 'pon', 'media-converter', 'spare']);

const ID_RE = /^JC-(\d+)$/;
const MAX_NAME_LEN = 100;
const MAX_LANDMARK_LEN = 200;
const MAX_REF_LEN = 100;

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

function idNumber(closureId) {
  const match = ID_RE.exec(String(closureId || ''));
  return match ? Number(match[1]) : 0;
}

/** Formatted closure id: 1 -> "JC-01", 12 -> "JC-12", 130 -> "JC-130". */
export function formatClosureId(n) {
  const num = Number.isInteger(Number(n)) && Number(n) > 0 ? Number(n) : 1;
  return `JC-${String(num).padStart(2, '0')}`;
}

/** The TIA-598 entry for a core number (1–12), or null. */
export function tiaCore(coreNumber) {
  const n = Number(coreNumber);
  return TIA598_CORES.find((entry) => entry.core === n) ?? null;
}

/** A fresh 12-core map with every core spare. */
export function emptyCoreMap() {
  return TIA598_CORES.map((entry) => ({ core: entry.core, targetType: 'spare', targetRef: '' }));
}

function sanitizeCore(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const n = Number(raw.core);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  const targetType = CORE_TARGET_TYPES.includes(raw.targetType) ? raw.targetType : 'spare';
  return {
    core: n,
    targetType,
    targetRef: targetType === 'spare' ? '' : cleanText(raw.targetRef).slice(0, MAX_REF_LEN)
  };
}

/** Drops malformed rows; every kept closure carries exactly 12 cores in TIA order. */
export function sanitizeSpliceClosures(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const closureId = cleanText(raw.closureId);
    if (!ID_RE.test(closureId) || seen.has(closureId)) continue;
    seen.add(closureId);
    const byCore = new Map();
    if (Array.isArray(raw.cores)) {
      for (const rawCore of raw.cores) {
        const core = sanitizeCore(rawCore);
        if (core) byCore.set(core.core, core);
      }
    }
    out.push({
      closureId,
      name: cleanText(raw.name).slice(0, MAX_NAME_LEN),
      landmark: cleanText(raw.landmark).slice(0, MAX_LANDMARK_LEN),
      cores: TIA598_CORES.map((entry) => byCore.get(entry.core) ?? { core: entry.core, targetType: 'spare', targetRef: '' }),
      createdAt: cleanText(raw.createdAt).slice(0, 40),
      updatedAt: cleanText(raw.updatedAt).slice(0, 40)
    });
  }
  return out;
}

/** Next closure id: one above the highest JC-N already stored (starts at JC-01). */
export function nextClosureId(entries) {
  let max = 0;
  for (const entry of Array.isArray(entries) ? entries : []) {
    max = Math.max(max, idNumber(entry?.closureId));
  }
  return formatClosureId(max + 1);
}

/** Display label for a closure: operator name when set, else its id. */
export function closureDisplayName(closure) {
  return cleanText(closure?.name) || cleanText(closure?.closureId) || '';
}

/**
 * Append a new closure (all cores spare). Returns a NEW sanitized
 * array; the input is never mutated. `nowIso` is injectable for tests.
 */
export function addSpliceClosure(entries, { name = '', landmark = '' } = {}, nowIso = '') {
  const current = sanitizeSpliceClosures(entries);
  const stamp = cleanText(nowIso).slice(0, 40);
  current.push({
    closureId: nextClosureId(current),
    name: cleanText(name).slice(0, MAX_NAME_LEN),
    landmark: cleanText(landmark).slice(0, MAX_LANDMARK_LEN),
    cores: emptyCoreMap(),
    createdAt: stamp,
    updatedAt: stamp
  });
  return current;
}

/**
 * Set one core's assignment. Returns a NEW sanitized array; unknown
 * closure / core numbers leave the (sanitized) input unchanged in
 * content. Assigning 'spare' clears the ref.
 */
export function assignCore(entries, closureId, coreNumber, targetType, targetRef, nowIso = '') {
  const current = sanitizeSpliceClosures(entries);
  const n = Number(coreNumber);
  if (!Number.isInteger(n) || n < 1 || n > 12) return current;
  const type = CORE_TARGET_TYPES.includes(targetType) ? targetType : 'spare';
  const ref = type === 'spare' ? '' : cleanText(targetRef).slice(0, MAX_REF_LEN);
  return current.map((closure) => {
    if (closure.closureId !== closureId) return closure;
    return {
      ...closure,
      cores: closure.cores.map((core) => (core.core === n ? { core: n, targetType: type, targetRef: ref } : core)),
      updatedAt: cleanText(nowIso).slice(0, 40) || closure.updatedAt
    };
  });
}

/** Remove one closure by id. Returns a NEW sanitized array. */
export function deleteSpliceClosure(entries, closureId) {
  return sanitizeSpliceClosures(entries).filter((closure) => closure.closureId !== closureId);
}

/** { assigned, spares } counts for one closure's 12 cores. */
export function closureCoreSummary(closure) {
  const cores = sanitizeSpliceClosures([closure])[0]?.cores ?? emptyCoreMap();
  const assigned = cores.filter((core) => core.targetType !== 'spare').length;
  return { assigned, spares: cores.length - assigned, total: cores.length };
}

/** Distinct splitter box ids from the SISP-24 map data (customer records), sorted. */
export function knownSplitterBoxIds(customers) {
  try {
    return buildSplitterBoxes(Array.isArray(customers) ? customers : []).map((box) => box.boxId);
  } catch {
    return [];
  }
}

/** One core's human-readable assignment, e.g. "Splitter DB-01" / "Spare". */
export function coreAssignmentLabel(core, lang = null) {
  const type = core?.targetType;
  const ref = cleanText(core?.targetRef);
  if (type === 'splitter') return `${t('jcmap_type_splitter', lang)}${ref ? ` ${ref}` : ''}`;
  if (type === 'pon') return `${t('jcmap_type_pon', lang)}${ref ? ` ${ref}` : ''}`;
  if (type === 'media-converter') return `${t('jcmap_type_mc', lang)}${ref ? ` ${ref}` : ''}`;
  return t('jcmap_type_spare', lang);
}

export function loadSpliceClosures(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(SPLICE_CLOSURES_KEY);
    if (!raw) return [];
    return sanitizeSpliceClosures(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveSpliceClosures(entries, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(SPLICE_CLOSURES_KEY, JSON.stringify(sanitizeSpliceClosures(entries)));
    return true;
  } catch {
    return false;
  }
}

/** Plain-text Splicer Field Card (WhatsApp share body). */
export function buildSplicerFieldCardText(closure, { lang = null } = {}) {
  const clean = sanitizeSpliceClosures([closure])[0];
  if (!clean) return '';
  const lines = [
    `🧵 ${t('jcmap_card_title', lang)} — Shahdara Fiber Net`,
    `${closureDisplayName(clean)} (${clean.closureId})`
  ];
  if (clean.landmark) lines.push(`${t('jcmap_landmark_short', lang)}: ${clean.landmark}`);
  lines.push('— TIA-598 —');
  for (const core of clean.cores) {
    const tia = tiaCore(core.core);
    lines.push(`${core.core}. ${tia ? tia.colorName : ''} → ${coreAssignmentLabel(core, lang)}`);
  }
  return lines.join('\n');
}

/** Recipient-less WhatsApp share URL for the field card text. */
export function splicerCardWhatsAppUrl(closure, { lang = null } = {}) {
  const text = buildSplicerFieldCardText(closure, { lang });
  return text ? `https://wa.me/?text=${encodeURIComponent(text)}` : '';
}

/**
 * In-app core-map rows for one closure: one row per TIA core with its
 * literal color swatch, a target-type select and a ref input. The
 * controller wires change events via the data-core attributes.
 */
export function renderSpliceCoreRowsHtml(closure, { lang = null } = {}) {
  const clean = sanitizeSpliceClosures([closure])[0];
  if (!clean) return '';
  return clean.cores.map((core) => {
    const tia = tiaCore(core.core);
    const options = CORE_TARGET_TYPES.map((type) => {
      const labelKey = type === 'splitter' ? 'jcmap_type_splitter' : type === 'pon' ? 'jcmap_type_pon' : type === 'media-converter' ? 'jcmap_type_mc' : 'jcmap_type_spare';
      return `<option value="${type}"${core.targetType === type ? ' selected' : ''}>${escapeHtml(t(labelKey, lang))}</option>`;
    }).join('');
    const refPlaceholder = core.targetType === 'splitter'
      ? t('jcmap_ref_splitter_ph', lang)
      : core.targetType === 'pon'
        ? t('jcmap_ref_pon_ph', lang)
        : core.targetType === 'media-converter'
          ? t('jcmap_ref_mc_ph', lang)
          : '';
    return `<div class="jc-core-row" data-core-row="${core.core}">
      <span class="jc-swatch" style="background:${tia ? tia.hex : 'transparent'}" aria-hidden="true"></span>
      <span class="jc-core-name"><strong>${escapeHtml(t('jcmap_core', lang, { n: core.core }))}</strong> · ${escapeHtml(tia ? tia.colorName : '')}</span>
      <select class="form-input jc-core-type" data-core-type="${core.core}" aria-label="${escapeHtml(t('jcmap_core', lang, { n: core.core }))}">${options}</select>
      <input class="form-input jc-core-ref" data-core-ref="${core.core}" type="text" maxlength="${MAX_REF_LEN}" autocomplete="off" value="${escapeHtml(core.targetRef)}" placeholder="${escapeHtml(refPlaceholder)}"${core.targetType === 'spare' ? ' disabled' : ''} list="jcSplitterOptions">
    </div>`;
  }).join('');
}

/** Standalone black-on-white printable Splicer Field Card (house print pattern). */
export function generateSplicerFieldCardHtml(closure, { lang = null, generatedDate = '' } = {}) {
  const clean = sanitizeSpliceClosures([closure])[0];
  if (!clean) return '';
  const rows = clean.cores.map((core) => {
    const tia = tiaCore(core.core);
    return `<tr>
      <td><span class="sw" style="background:${tia ? tia.hex : 'transparent'}"></span></td>
      <td>${core.core}</td>
      <td>${escapeHtml(tia ? tia.colorName : '')}</td>
      <td>${escapeHtml(coreAssignmentLabel(core, lang))}</td>
    </tr>`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(t('jcmap_card_title', lang))} — ${escapeHtml(closureDisplayName(clean))}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 16px; margin: 0 0 12px; font-weight: normal; }
  p.meta { margin: 2px 0; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  th, td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; text-align: left; }
  .sw { display: inline-block; width: 18px; height: 18px; border: 1px solid #000; vertical-align: middle; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td span.sw { }
  @media print { body { margin: 8px; } }
</style>
</head>
<body>
<h1>Shahdara Fiber Net — ${escapeHtml(t('jcmap_card_title', lang))}</h1>
<h2>${escapeHtml(closureDisplayName(clean))} (${escapeHtml(clean.closureId)})</h2>
${clean.landmark ? `<p class="meta">${escapeHtml(t('jcmap_landmark_short', lang))}: ${escapeHtml(clean.landmark)}</p>` : ''}
${generatedDate ? `<p class="meta">${escapeHtml(generatedDate)}</p>` : ''}
<table>
  <thead><tr><th></th><th>${escapeHtml(t('jcmap_col_core', lang))}</th><th>TIA-598</th><th>${escapeHtml(t('jcmap_assignment', lang))}</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
</body>
</html>`;
}

/**
 * Modal controller for the JC splice map dialog (#spliceClosureModal
 * in index.html). DOM-only; inspection-verified like the other modal
 * controllers. Saves on every change through load/saveSpliceClosures.
 */
export function setupSpliceClosureModal(getState, { onToast = null, onConfirm = null } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('spliceClosureModal');
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let selectedId = '';

  const toast = (msg) => { if (typeof onToast === 'function') onToast(msg); };
  const readCustomers = () => {
    try {
      const state = typeof getState === 'function' ? getState() : getState;
      return Array.isArray(state?.customers) ? state.customers : [];
    } catch {
      return [];
    }
  };

  function render() {
    const closures = loadSpliceClosures();
    const select = $('jcClosureSelect');
    if (select) {
      select.innerHTML = closures.length === 0
        ? `<option value="">${escapeHtml(t('jcmap_empty'))}</option>`
        : closures.map((closure) => `<option value="${escapeHtml(closure.closureId)}">${escapeHtml(closureDisplayName(closure))}</option>`).join('');
      if (!closures.some((closure) => closure.closureId === selectedId)) {
        selectedId = closures[0]?.closureId ?? '';
      }
      select.value = selectedId;
    }
    const closure = closures.find((item) => item.closureId === selectedId) ?? null;
    const summaryEl = $('jcSummaryLine');
    if (summaryEl) {
      if (!closure) {
        summaryEl.textContent = t('jcmap_empty');
      } else {
        const summary = closureCoreSummary(closure);
        summaryEl.textContent = `${closureDisplayName(closure)}${closure.landmark ? ` · ${closure.landmark}` : ''} · ${t('jcmap_summary', null, { assigned: summary.assigned, spares: summary.spares })}`;
      }
    }
    const datalist = $('jcSplitterOptions');
    if (datalist) {
      datalist.innerHTML = knownSplitterBoxIds(readCustomers())
        .map((boxId) => `<option value="${escapeHtml(boxId)}"></option>`).join('');
    }
    const listEl = $('jcCoreList');
    if (listEl) listEl.innerHTML = closure ? renderSpliceCoreRowsHtml(closure) : '';
    const printBtn = $('jcPrintCardBtn');
    if (printBtn) printBtn.disabled = !closure;
    const waBtn = $('jcWhatsAppCardBtn');
    if (waBtn) {
      if (closure) {
        waBtn.href = splicerCardWhatsAppUrl(closure);
        waBtn.removeAttribute('aria-disabled');
      } else {
        waBtn.href = '#';
        waBtn.setAttribute('aria-disabled', 'true');
      }
    }
    const deleteBtn = $('jcDeleteBtn');
    if (deleteBtn) deleteBtn.disabled = !closure;
    return closure;
  }

  const select = $('jcClosureSelect');
  if (select) select.addEventListener('change', () => { selectedId = select.value; render(); });

  const addForm = $('jcAddForm');
  if (addForm) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const nameInput = $('jcNameInput');
      const landmarkInput = $('jcLandmarkInput');
      const next = addSpliceClosure(loadSpliceClosures(), {
        name: nameInput ? nameInput.value : '',
        landmark: landmarkInput ? landmarkInput.value : ''
      }, new Date().toISOString());
      if (saveSpliceClosures(next)) {
        selectedId = next[next.length - 1]?.closureId ?? selectedId;
        if (nameInput) nameInput.value = '';
        if (landmarkInput) landmarkInput.value = '';
        toast(t('jcmap_added'));
      }
      render();
    });
  }

  const listEl = $('jcCoreList');
  if (listEl) {
    const applyRow = (coreNumber, typeEl, refEl) => {
      const next = assignCore(
        loadSpliceClosures(),
        selectedId,
        coreNumber,
        typeEl ? typeEl.value : 'spare',
        refEl ? refEl.value : '',
        new Date().toISOString()
      );
      if (saveSpliceClosures(next)) toast(t('jcmap_saved'));
    };
    listEl.addEventListener('change', (event) => {
      const target = event.target;
      const typeAttr = target?.dataset?.coreType;
      const refAttr = target?.dataset?.coreRef;
      if (typeAttr) {
        applyRow(Number(typeAttr), target, listEl.querySelector(`[data-core-ref="${typeAttr}"]`));
        render();
      } else if (refAttr) {
        applyRow(Number(refAttr), listEl.querySelector(`[data-core-type="${refAttr}"]`), target);
      }
    });
  }

  const printBtn = $('jcPrintCardBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const closure = loadSpliceClosures().find((item) => item.closureId === selectedId) ?? null;
      if (!closure) return;
      const generatedDate = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
      const html = generateSplicerFieldCardHtml(closure, { generatedDate });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      } else {
        toast(t('jcmap_popup_blocked'));
      }
    });
  }

  const deleteBtn = $('jcDeleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const closures = loadSpliceClosures();
      const closure = closures.find((item) => item.closureId === selectedId) ?? null;
      if (!closure) return;
      const message = t('jcmap_delete_confirm', null, { name: closureDisplayName(closure) });
      let confirmed = true;
      if (typeof onConfirm === 'function') {
        confirmed = await onConfirm({ message });
      } else if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        confirmed = window.confirm(message);
      }
      if (!confirmed) return;
      const next = deleteSpliceClosure(closures, selectedId);
      if (saveSpliceClosures(next)) {
        selectedId = next[0]?.closureId ?? '';
        toast(t('jcmap_deleted'));
      }
      render();
    });
  }

  const openBtn = document.getElementById('openSpliceClosureModalBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      render();
    });
  }
  const closeBtn = $('spliceClosureCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });

  return {
    open: () => {
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      render();
    },
    close: () => { dialog.close?.() || (dialog.hidden = true); },
    refresh: render
  };
}

export { escapeHtml };
