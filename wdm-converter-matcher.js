/**
 * wdm-converter-matcher.js — SISP-162: Single-Fiber WDM Media Converter
 * A-Side (1310nm) vs B-Side (1550nm) Stock Matcher.
 *
 * A single-fiber WDM link needs ONE A-side converter (1310nm TX) at one
 * end and ONE B-side converter (1550nm TX) at the other — the two sides
 * are NOT interchangeable, so a shelf full of A-side units cannot serve
 * a B-side replacement. The owner therefore needs the two sides counted
 * separately, plus the only number that matters in the field: how many
 * COMPLETE deployable pairs are on the shelf.
 *
 * STOCK ROUTE (audited choice): SISP-18's catalogue is a fixed spec
 * contract — tests/inventory-book.test.js pins "catalog covers exactly
 * the 7 spec items" and computeStock() returning exactly 7 rows, the
 * SISP-42 ticket bridge maps the ticket material 'media-converter' to
 * the legacy item id, and SISP-19 custody recovery is pinned to the
 * same legacy id. Adding 'media-converter-a' / 'media-converter-b'
 * catalogue items would break those pins, so side stock lives in a
 * DERIVED SUB-LEDGER instead: a small sibling store under
 * CONVERTER_SIDES_KEY (sisp_converter_sides_v1) holding its own
 * append-only in/out movement log (starts EMPTY). Side counts derive
 * ONLY from this log — it is the single source of truth for sides —
 * while the main stock book is never written by this feature, so its
 * totals can never double-count a converter. The legacy unsided
 * 'media-converter' availability is reported separately as
 * "side unknown" and is NEVER counted into pairs.
 *
 * Pairs math (pure): pairs = min(A, B); unpaired excess = |A - B| with
 * the excess side named. A replacement suggestion on a converter-fault
 * ticket names the customer's recorded side (customerConverterSide on
 * the profile, 'A' | 'B') and that side's real availability; an A-side
 * unit can only ever be replaced by another A-side unit.
 *
 * Backup: side movements travel in the JSON backup
 * `settings.converterSides` section (see core.js), under the same
 * safe-merge rule as the stock book: adopted only when this device has
 * none stored yet.
 *
 * All helpers are pure except load/saveConverterSides and the panel
 * controller. Tests use synthetic data only.
 */

import { availableFor } from './inventory-book.js';
import { t } from './nav-language.js';

export const CONVERTER_SIDES_KEY = 'sisp_converter_sides_v1';

/** The two physical sides of a single-fiber WDM converter pair. */
export const CONVERTER_SIDES = Object.freeze(['A', 'B']);

/**
 * Technical labels — kept identical in both UI languages on purpose:
 * the wavelength is the identity of the side, not prose.
 */
export const CONVERTER_SIDE_LABELS = Object.freeze({
  A: 'A-Side (1310nm)',
  B: 'B-Side (1550nm)'
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MOVEMENT_ID_RE = /^WDM-(\d+)$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&gt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 'A' | 'B' for a recorded side; '' for anything else (never guessed). */
export function normalizeConverterSide(value) {
  return value === 'A' || value === 'B' ? value : '';
}

/** Technical side label ('A-Side (1310nm)'); '' when no side recorded. */
export function converterSideLabel(side) {
  return CONVERTER_SIDE_LABELS[normalizeConverterSide(side)] || '';
}

/** Drops malformed rows; keeps clean side movements in stored order. */
export function sanitizeConverterSideMovements(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const side = normalizeConverterSide(entry.side);
    if (!side) continue;
    const kind = entry.kind === 'in' || entry.kind === 'out' ? entry.kind : null;
    if (!kind) continue;
    const qty = Number(entry.qty);
    if (!Number.isInteger(qty) || qty <= 0) continue;
    const date = DATE_RE.test(String(entry.date || '')) ? String(entry.date) : '';
    if (!date) continue;
    out.push({
      id: cleanText(entry.id),
      side,
      kind,
      qty,
      date,
      note: cleanText(entry.note),
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Reads side movement records; [] on missing/corrupt storage. */
export function loadConverterSides(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(CONVERTER_SIDES_KEY);
    if (!raw) return [];
    return sanitizeConverterSideMovements(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists side movement records; never throws. */
export function saveConverterSides(movements, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(CONVERTER_SIDES_KEY, JSON.stringify(sanitizeConverterSideMovements(movements)));
    return true;
  } catch {
    return false;
  }
}

function nextSideMovementId(movements) {
  let max = 100;
  for (const m of movements) {
    const match = MOVEMENT_ID_RE.exec(String(m.id || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `WDM-${max + 1}`;
}

/**
 * Pure per-side stock derivation from the side log: one row per side
 * with total in, total out and available (in minus out).
 */
export function computeConverterSideStock(movements) {
  const clean = sanitizeConverterSideMovements(movements);
  const stock = {};
  for (const side of CONVERTER_SIDES) {
    let totalIn = 0;
    let totalOut = 0;
    for (const m of clean) {
      if (m.side !== side) continue;
      if (m.kind === 'in') totalIn += m.qty;
      else totalOut += m.qty;
    }
    stock[side] = { totalIn, totalOut, available: totalIn - totalOut };
  }
  return stock;
}

/** Available units of one side (0 when nothing recorded / bad side). */
export function converterSideAvailable(movements, side) {
  const clean = normalizeConverterSide(side);
  if (!clean) return 0;
  return computeConverterSideStock(movements)[clean].available;
}

/**
 * Appends one side movement. Throws on an unknown side, a bad quantity,
 * a bad date, or a stock-out beyond that side's own availability (one
 * side's surplus can never cover the other side's issue). Returns the
 * new movement list (input untouched).
 */
export function addConverterSideMovement(movements, movement) {
  const clean = sanitizeConverterSideMovements(movements);
  const side = normalizeConverterSide(movement?.side);
  if (!side) throw new Error('Converter side must be A or B.');
  if (movement.kind !== 'in' && movement.kind !== 'out') throw new Error('Movement must be stock in or stock out.');
  const qty = Number(movement.qty);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Quantity must be a positive whole number.');
  const date = DATE_RE.test(String(movement.date || '')) ? String(movement.date) : '';
  if (!date) throw new Error('A valid date is required.');
  if (movement.kind === 'out' && qty > converterSideAvailable(clean, side)) {
    throw new Error('Stock out exceeds available stock for this side.');
  }
  const record = {
    id: nextSideMovementId(clean),
    side,
    kind: movement.kind,
    qty,
    date,
    note: cleanText(movement.note),
    createdAt: new Date().toISOString()
  };
  return [...clean, record];
}

/**
 * The pairing summary the owner reads at a glance:
 *   pairs      = complete deployable pairs = min(A, B)
 *   excess     = unpaired units = |A - B|, excessSide names the side
 *                holding them (null when balanced)
 *   unknownSide = the main stock book's legacy unsided
 *                'media-converter' availability, reported separately
 *                and NEVER counted into pairs.
 */
export function buildConverterPairing(sideMovements, inventoryMovements) {
  const stock = computeConverterSideStock(sideMovements);
  const sideA = stock.A.available;
  const sideB = stock.B.available;
  const excess = Math.abs(sideA - sideB);
  return {
    sideA,
    sideB,
    pairs: Math.min(sideA, sideB),
    excess,
    excessSide: excess === 0 ? null : (sideA > sideB ? 'A' : 'B'),
    unknownSide: availableFor(Array.isArray(inventoryMovements) ? inventoryMovements : [], 'media-converter')
  };
}

/**
 * Converter/hardware fault family: the shipped ticket preset
 * 'Media Converter Power/Charger' (the register category
 * 'Media Converter / Charger Off' maps to it) or a custom fault text
 * that names a converter. Anything else is not a converter fault.
 */
export function isConverterFaultTicket(ticket) {
  if (!ticket || typeof ticket !== 'object') return false;
  if (ticket.faultPreset === 'Media Converter Power/Charger') return true;
  const fault = `${cleanText(ticket.faultPreset)} ${cleanText(ticket.customFault)}`.toLowerCase();
  return fault.includes('converter');
}

/**
 * Pure replacement suggestion for a converter-fault ticket:
 *   null          — not a converter-fault ticket (nothing to suggest)
 *   'no-side'     — the customer has no recorded side; never guessed
 *   'available'   — that side has stock; names the side + count
 *   'out-of-stock'— that side is 0; the other side can NOT substitute
 * Display only: it writes nothing, anywhere.
 */
export function buildConverterReplacementSuggestion(ticket, customer, sideMovements) {
  if (!isConverterFaultTicket(ticket)) return null;
  const side = normalizeConverterSide(customer?.customerConverterSide);
  if (!side) return { kind: 'no-side', side: '', available: 0 };
  const available = converterSideAvailable(sideMovements, side);
  return available > 0
    ? { kind: 'available', side, available }
    : { kind: 'out-of-stock', side, available: 0 };
}

/** Localized one-line suggestion text for a built suggestion ('' for null). */
export function converterSuggestionText(suggestion) {
  if (!suggestion || typeof suggestion !== 'object') return '';
  if (suggestion.kind === 'no-side') return t('wdmc_suggest_no_side');
  const label = converterSideLabel(suggestion.side);
  if (suggestion.kind === 'available') {
    return t('wdmc_suggest_available', null, { side: label, count: suggestion.available });
  }
  if (suggestion.kind === 'out-of-stock') {
    return t('wdmc_suggest_out', null, { side: label });
  }
  return '';
}

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Panel controller for the matcher section inside the Stock Book modal
 * (index.html #wdmMatcherPanel + #wdmMatcherForm). Follows the
 * inventory-book controller pattern: render() refreshes the cards and
 * the side log; the form records side in/out movements into the side
 * ledger only — the main stock book is never touched here.
 * getInventoryMovements supplies the main book's movements so the
 * legacy unsided count can be shown next to the sides.
 */
export function setupWdmConverterMatcher({ onToast, getInventoryMovements } = {}) {
  const panel = typeof document !== 'undefined' ? document.getElementById('wdmMatcherPanel') : null;
  if (!panel) return null;
  const dialog = document.getElementById('inventoryBookModal');
  const $ = (id) => (dialog ? dialog.querySelector(`#${id}`) : document.getElementById(id));

  function render() {
    const sideMovements = loadConverterSides();
    const inventoryMovements = typeof getInventoryMovements === 'function' ? getInventoryMovements() : [];
    const pairing = buildConverterPairing(sideMovements, inventoryMovements);
    const excessHtml = pairing.excess > 0
      ? `<p class="wdm-matcher-warning"><span>⚠️ ${escapeHtml(t('wdmc_excess', null, { count: pairing.excess, side: converterSideLabel(pairing.excessSide) }))}</span></p>`
      : '';
    const unknownHtml = pairing.unknownSide > 0
      ? `<p><span>${escapeHtml(t('wdmc_unknown_label'))}</span><strong>${escapeHtml(String(pairing.unknownSide))}</strong></p>`
      : '';
    panel.innerHTML = `
      <article class="inventory-stock-card wdm-matcher-card">
        <p><span>${escapeHtml(t('wdmc_side_stock', null, { side: CONVERTER_SIDE_LABELS.A }))}</span><strong>${escapeHtml(String(pairing.sideA))}</strong></p>
        <p><span>${escapeHtml(t('wdmc_side_stock', null, { side: CONVERTER_SIDE_LABELS.B }))}</span><strong>${escapeHtml(String(pairing.sideB))}</strong></p>
        <p><span>${escapeHtml(t('wdmc_pairs_label'))}</span><strong class="wdm-matcher-pairs">${escapeHtml(String(pairing.pairs))}</strong></p>
        ${unknownHtml}${excessHtml}
        ${sideMovements.length === 0 ? `<p class="inventory-book-empty">${escapeHtml(t('wdmc_empty'))}</p>` : ''}
      </article>`;
    const logEl = $('wdmMatcherLogList');
    if (logEl) {
      const log = [...sideMovements].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
      });
      logEl.innerHTML = log.length === 0
        ? `<p class="inventory-book-empty">${escapeHtml(t('wdmc_log_empty'))}</p>`
        : log.map((m) => `<article class="inventory-log-card">
            <p><span>${m.kind === 'in' ? `⬆️ ${escapeHtml(t('wdmc_kind_in'))}` : `⬇️ ${escapeHtml(t('wdmc_kind_out'))}`}</span><strong>${escapeHtml(converterSideLabel(m.side))} · ${escapeHtml(String(m.qty))}</strong></p>
            <p><span>${escapeHtml(m.date)}</span><strong>${escapeHtml(m.note || '—')}</strong></p>
          </article>`).join('');
    }
    const dateInput = $('wdmMatcherDate');
    if (dateInput && !dateInput.value) dateInput.value = todayLocal();
  }

  const form = $('wdmMatcherForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const updated = addConverterSideMovement(loadConverterSides(), {
          side: $('wdmMatcherSide')?.value,
          kind: $('wdmMatcherKind')?.value,
          qty: $('wdmMatcherQty')?.value,
          date: $('wdmMatcherDate')?.value,
          note: $('wdmMatcherNote')?.value
        });
        saveConverterSides(updated);
        form.reset();
        const dateInput = $('wdmMatcherDate');
        if (dateInput) dateInput.value = todayLocal();
        render();
        if (typeof onToast === 'function') onToast(t('wdmc_recorded'));
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || t('wdmc_record_failed'));
      }
    });
  }
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openInventoryBookModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', render);
  render();

  return { refresh: render };
}
