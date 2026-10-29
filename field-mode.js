/**
 * field-mode.js — SISP-5: 1-Thumb Mobile "Field Collection Mode".
 *
 * Problem: collecting cash on a motorcycle or at a shop in Shahdara/Barrian
 * requires ultra-fast single-handed operation without scrolling past charts
 * and engineering tabs.
 *
 * What this module is:
 * - A full-screen, high-contrast, distraction-free overlay opened from the
 *   header 🏍️ toggle (and the #/field-mode deep link): live search over
 *   customers with dues, an Area / Zone filter with a live remaining-cash
 *   target, and large 1-tap action cards per customer (min-height 48px).
 *
 * REUSE, DO NOT FORK (the critical integration rule):
 * - Cash Full / shop buttons record through the EXISTING Quick Collect path
 *   (executeQuickCollection -> core addPayment). That keeps SISP-2 bill-cycle
 *   arrears/advance allocation, SISP-4 kist lines and the SISP-3 full-payment
 *   Waada auto-clear exactly as the Collect screen behaves. Shop methods
 *   ('Cash at Waseem Abbasi shop', 'Cash at Hassan shop') are picked up by
 *   the SISP-1 shop-settlement ledger automatically, because it derives
 *   collectors from recorded payment methods.
 * - Waada chips reuse the SISP-3 pure flow (computeWaadaChipDate +
 *   setCustomerWaada on the customer record, same fields, same auto-clear).
 * - The WA Receipt link reuses the Quick Collect Urdu/English WhatsApp draft
 *   (formatQuickCollectWhatsAppReceipt -> wa.me URL). It only OPENS the
 *   draft; nothing is sent automatically.
 *
 * The 2-tap workflow (spec criterion): tap 1 selects a customer card from
 * the (searched/filtered) list, tap 2 hits Cash Full — the receipt card with
 * the WA Receipt link appears immediately. No confirmation dialog sits in
 * between: that is what "1-tap" means here.
 *
 * SISP-31 (Field Collection Mode 2.0) adds, without touching the SISP-5
 * collection path above: (1) bilingual instant search — the pending list
 * is filtered locally by filterFieldModeEntries(), matching Roman fields
 * plus customer.nameUrdu and the urdu-names.js transliteration, so an Urdu
 * query and its Roman equivalent return the same card; (2) a 1-tap
 * 58mm Slip button on the receipt card that calls the host's onPrint58mm
 * callback (the app wires it to the EXISTING printPaymentReceipt
 * format 'thermal-58' path — no second printer); (3) a live
 * "Collected Today in <zone>" pill (houses + cash, derived from today's
 * recorded payments) rendered under the zone target line on every render,
 * so it updates immediately after a collection.
 *
 * SISP-41 adds, on the same receipt card and the same no-dead-button rule:
 * a 1-tap 🖼️ PNG Receipt button that calls the host's onPngReceipt
 * callback (the app wires it to the EXISTING downloadPngReceipt path —
 * the SISP-6 stamped PNG via generateReceiptPNG + shareOrDownloadPng).
 * The button renders only when the host supplies onPngReceipt.
 *
 * Pure helpers are DOM-free and unit-tested; setupFieldMode() is the DOM
 * controller (returns a no-op controller outside a browser, mirroring
 * setupQuickCollectModal's fallback).
 */

import {
  getPendingCollectionCustomers,
  executeQuickCollection,
  formatQuickCollectWhatsAppReceipt,
  getPakistanLocalDate
} from './nav-quick-collect.js';
import { PAYMENT_METHODS, formatPKR } from './core.js';
import { canonicalLocation } from './phase3.js';
import { transliterateRomanToUrdu } from './urdu-names.js';
import {
  computeWaadaChipDate,
  getWaadaTodayString,
  setCustomerWaada,
  clearCustomerWaada,
  waadaBadgeLabel
} from './waada-queue.js';

/** Deep link that opens field mode, mirroring #/bulk-collect. */
export const FIELD_MODE_HASH = '#/field-mode';
/** Zone-filter value meaning "every area/zone". */
export const FIELD_MODE_ALL_ZONES = 'all';

const SHOP_METHOD_PATTERN = /cash\s+at\s+(.+?)\s+shop/i;

/** True for the field-mode route: #/field-mode (also #field-mode). */
export function isFieldModeHash(hash = '') {
  const raw = String(hash ?? '').trim().toLowerCase().replace(/^#\/?/, '').replace(/\/$/, '');
  return raw === 'field-mode';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Location text that is NOT a real place (the pending-list entries carry
 * area: 'Unassigned' as a placeholder). Treated as empty so the mohalla
 * fallback below can apply.
 */
function realLocationText(value) {
  const text = String(value ?? '').trim();
  return text && text.toLowerCase() !== 'unassigned' ? text : '';
}

/**
 * Area / Zone label for one customer, following the app's own Area
 * Analytics rule: explicit area, else mohalla. Returns { key, label };
 * customers with neither fall back to 'Unassigned'.
 */
export function fieldModeZoneOf(customer) {
  const area = canonicalLocation(realLocationText(customer?.area))
    ?? canonicalLocation(realLocationText(customer?.mohalla));
  if (area) return { key: area.key, label: area.label };
  return { key: '__unassigned__', label: 'Unassigned' };
}

/**
 * Groups pending-collection entries by area/zone (derived from the live
 * customer records when available, else from the entry's own area/mohalla
 * fields — never from a hardcoded list, so new areas appear on their own).
 * Returns [{ key, label, count, totalDues, entries }], biggest target first.
 */
export function groupFieldModeZones(state, pendingEntries) {
  const customers = new Map((state?.customers ?? []).map(c => [c.id, c]));
  const groups = new Map();
  for (const entry of Array.isArray(pendingEntries) ? pendingEntries : []) {
    const zone = fieldModeZoneOf(customers.get(entry.id) ?? entry);
    let group = groups.get(zone.key);
    if (!group) {
      group = { key: zone.key, label: zone.label, count: 0, totalDues: 0, entries: [] };
      groups.set(zone.key, group);
    }
    group.count += 1;
    group.totalDues = Math.round((group.totalDues + Number(entry.totalDues ?? 0)) * 100) / 100;
    group.entries.push(entry);
  }
  return [...groups.values()].sort((a, b) => b.totalDues - a.totalDues || a.label.localeCompare(b.label));
}

/** Live remaining-cash target for a list of pending entries. */
export function fieldModeZoneSummary(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return {
    count: list.length,
    totalDues: Math.round(list.reduce((sum, e) => sum + Number(e.totalDues ?? 0), 0) * 100) / 100
  };
}

// ============================================================================
// SISP-31: bilingual search + zone "Collected Today" counter
// ============================================================================

/**
 * Normalizes Urdu-script text for substring matching: NFKC, then folds the
 * Arabic-script variants a phone keyboard may produce into the forms the
 * urdu-names.js transliterator emits (Arabic Yeh ي -> Urdu Yeh ی, Arabic
 * Kaf ك -> Urdu Kaf ک), and strips harakat, tatweel and zero-width joiners
 * so "راجہ" matches whether or not the user typed diacritics. Whitespace
 * is collapsed but kept: multi-word names still match word by word.
 */
export function normalizeUrduText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u064A\u06CC]/g, '\u06CC')
    .replace(/[\u0643\u06A9]/g, '\u06A9')
    .replace(/[\u064B-\u0652\u0670\u0640\u200C\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasUrduScript(text) {
  return /[\u0600-\u06FF]/.test(String(text ?? ''));
}

/**
 * SISP-31 bilingual match for one pending entry. The Roman path is EXACTLY
 * the Quick Collect matcher's fields (name, customer number with/without
 * '#', phone, area, mohalla, address) so no Roman search regresses. The
 * Urdu path additionally matches:
 *   - the customer's saved nameUrdu override, and
 *   - the urdu-names.js transliteration of the Roman name, area and
 *     mohalla — so typing علی finds a customer whose Roman name
 *     contains "Ali" even when no nameUrdu was ever saved, and typing
 *     بریاں finds a Barrian customer.
 * A Roman query can never match Urdu-only text (there is no Urdu->Roman
 * transliterator), but the Roman name field covers the same customer, so
 * typing "Raja" and typing "راجہ" return the same card.
 */
export function fieldModeSearchMatches(entry, customer, query) {
  const raw = String(query ?? '').trim();
  if (!raw) return true;
  const romanQuery = raw.normalize('NFKC').toLowerCase();
  const record = customer ?? entry ?? {};
  const romanFields = [
    entry?.name, record?.name,
    entry?.customerNumber, record?.customerNumber,
    entry?.phone, record?.phone,
    entry?.area, record?.area,
    entry?.mohalla, record?.mohalla,
    entry?.address, record?.address
  ];
  const numStr = String(entry?.customerNumber ?? record?.customerNumber ?? '');
  if (numStr && (`#${numStr}`.toLowerCase().includes(romanQuery))) return true;
  for (const field of romanFields) {
    if (field != null && String(field).toLowerCase().includes(romanQuery)) return true;
  }
  if (!hasUrduScript(raw)) return false;
  const urduQuery = normalizeUrduText(raw);
  if (!urduQuery) return false;
  const urduCandidates = [
    record?.nameUrdu,
    transliterateRomanToUrdu(record?.name ?? entry?.name),
    transliterateRomanToUrdu(record?.area ?? entry?.area),
    transliterateRomanToUrdu(record?.mohalla ?? entry?.mohalla)
  ];
  return urduCandidates.some(text => text && normalizeUrduText(text).includes(urduQuery));
}

/**
 * Applies the SISP-31 bilingual filter to a pending-entries list. `customers`
 * is the live customer array (or a Map keyed by id) used for nameUrdu and
 * transliteration lookups. An empty query returns the list unchanged.
 */
export function filterFieldModeEntries(entries, customers, query) {
  const list = Array.isArray(entries) ? entries : [];
  if (!String(query ?? '').trim()) return [...list];
  const byId = customers instanceof Map
    ? customers
    : new Map((Array.isArray(customers) ? customers : []).map(c => [c.id, c]));
  return list.filter(entry => fieldModeSearchMatches(entry, byId.get(entry.id) ?? entry, query));
}

/**
 * SISP-31 zone "Collected Today" counter, computed LIVE from recorded
 * payments (never from a stored summary, so it can never go stale): for
 * the given zone key ('all' = every zone), houses = distinct customers
 * with at least one payment dated todayStr (Pakistan-local YYYY-MM-DD),
 * cash = the sum of those payments in PKR. Archived customers are
 * included: a payment recorded today is collected today even if the
 * profile was archived afterwards.
 */
export function fieldModeCollectedToday(state, zoneKey, todayStr) {
  const houses = new Set();
  let cash = 0;
  for (const customer of state?.customers ?? []) {
    if (zoneKey !== FIELD_MODE_ALL_ZONES && fieldModeZoneOf(customer).key !== zoneKey) continue;
    let paidToday = false;
    for (const bill of customer?.bills ?? []) {
      for (const payment of bill?.payments ?? []) {
        if (payment?.date === todayStr) {
          paidToday = true;
          cash += Number(payment?.amount) || 0;
        }
      }
    }
    if (paidToday) houses.add(customer.id);
  }
  return { houses: houses.size, cash: Math.round(cash * 100) / 100 };
}

/**
 * Shop payment methods from the app's own PAYMENT_METHODS (Waseem + Hassan
 * today, any future "Cash at X shop" method automatically). Each entry is
 * { method, short } where short is the collector name for the button label.
 */
export function fieldModeShopMethods() {
  return PAYMENT_METHODS
    .filter(method => SHOP_METHOD_PATTERN.test(String(method)))
    .map(method => {
      const match = String(method).match(SHOP_METHOD_PATTERN);
      const short = (match?.[1] ?? '').trim();
      return { method, short: short || method };
    });
}

/**
 * Arguments for a full-pending collection through the existing Quick Collect
 * path: ONE payment of the customer's total dues on the earliest unpaid
 * month. The allocation engine forwards any excess month by month, so all
 * priced bills settle (same as paying each month in turn).
 */
export function fieldModeFullPaymentArgs(entry, method, todayStr) {
  return {
    customerId: entry.id,
    month: entry.targetMonth,
    amount: entry.totalDues,
    date: todayStr,
    method
  };
}

/**
 * Records a full-pending payment through executeQuickCollection and builds
 * the WhatsApp receipt draft. Returns { nextState, receipt, whatsapp }.
 * Throws when the entry has no pending balance or the method is invalid
 * (executeQuickCollection validates both).
 */
export function collectFieldModePayment(state, entry, method, referenceDate = new Date()) {
  if (!entry || !(Number(entry.totalDues) > 0)) {
    throw new Error('No pending balance for this customer.');
  }
  const today = getPakistanLocalDate(referenceDate);
  const { nextState, receipt } = executeQuickCollection(
    state,
    fieldModeFullPaymentArgs(entry, method, today),
    referenceDate
  );
  return { nextState, receipt, whatsapp: formatQuickCollectWhatsAppReceipt(receipt) };
}

/**
 * Applies one Waada chip to a customer record (pure, SISP-3 flow).
 * chip: 'plus2' | 'plus5' | 'tenth' | 'custom'. Throws on an invalid date.
 */
export function applyFieldModeWaadaChip(customer, chip, todayStr, customDate = null) {
  const date = computeWaadaChipDate(chip, todayStr, customDate);
  if (!date) throw new Error('Pick a valid date first.');
  return setCustomerWaada(customer, {
    promiseDate: date,
    promiseAmount: customer.promiseAmount ?? null,
    promiseNote: customer.promiseNote ?? ''
  });
}

/** Clears the Waada promise from a customer record (pure, SISP-3 flow). */
export function clearFieldModeWaada(customer) {
  return clearCustomerWaada(customer);
}

// ============================================================================
// DOM CONTROLLER
// ============================================================================

function nullFieldModeController() {
  return {
    open: () => {},
    close: () => {},
    toggle: () => {},
    isOpen: () => false,
    refresh: () => {}
  };
}

/**
 * Wires the field-mode overlay. Host contract (mirrors setupQuickCollectModal):
 *   getState() -> live app state object
 *   onSaveState(nextState) -> host persists + refreshes its views
 *   onToast(msg) -> optional toast
 *   onPrint58mm(receipt) -> optional: host prints the 58mm thermal slip for
 *     a just-collected receipt via the EXISTING thermal path
 *     (printPaymentReceipt with format 'thermal-58'). When absent, the
 *     58mm Slip button is not rendered at all (never a dead button).
 *   onPngReceipt(receipt) -> optional (SISP-41): host generates the stamped
 *     PNG receipt for a just-collected receipt via the EXISTING SISP-6
 *     path (downloadPngReceipt). When absent, the PNG Receipt button is
 *     not rendered at all (never a dead button).
 * Returns { open, close, toggle, isOpen, refresh }.
 */

/** SISP-41: receipt-card action buttons, in card order. Pure and DOM-free: a
 *  button renders only when its host callback exists, so neither button can
 *  ever be dead. Uses the existing field-mode-action-btn class (theme
 *  tokens only, dark-mode safe, <=480px safe) — no new CSS. */
export function fieldModeReceiptActionMarkup({ hasPrint58 = false, hasPngReceipt = false } = {}) {
  const print58Button = hasPrint58
    ? `<button type="button" class="field-mode-action-btn" data-field-action="print58">🖨️ 58mm Slip</button>`
    : '';
  const pngReceiptButton = hasPngReceipt
    ? `<button type="button" class="field-mode-action-btn" data-field-action="pngReceipt">🖼️ PNG Receipt</button>`
    : '';
  return `${print58Button}${pngReceiptButton}`;
}

export function setupFieldMode({ getState, onSaveState, onToast, onPrint58mm, onPngReceipt } = {}) {
  if (typeof document === 'undefined') return nullFieldModeController();
  const view = document.getElementById('fieldModeView');
  const toggleBtn = document.getElementById('fieldModeToggleBtn');
  if (!view || !toggleBtn) return nullFieldModeController();

  const closeBtn = document.getElementById('fieldModeCloseBtn');
  const searchInput = document.getElementById('fieldModeSearchInput');
  const searchClearBtn = document.getElementById('fieldModeSearchClearBtn');
  const zoneFiltersEl = document.getElementById('fieldModeZoneFilters');
  const zoneTargetEl = document.getElementById('fieldModeZoneTarget');
  const listEl = document.getElementById('fieldModeCustomerList');
  const panelEl = document.getElementById('fieldModeActionPanel');

  let isOpen = false;
  let openedViaHash = false;
  let query = '';
  let zoneKey = FIELD_MODE_ALL_ZONES;
  let selectedId = null;
  let lastReceipt = null;
  let busy = false;

  const toast = (msg) => { if (typeof onToast === 'function') onToast(msg); };
  const todayStr = () => getWaadaTodayString();

  const pendingEntries = () => {
    const state = typeof getState === 'function' ? getState() : null;
    if (!state) return [];
    // SISP-31: fetch unfiltered, then apply the bilingual filter locally so
    // Urdu queries (nameUrdu + transliteration) work without changing the
    // shared Quick Collect matcher used by other screens.
    return filterFieldModeEntries(
      getPendingCollectionCustomers(state, '', 'all-dues'),
      state.customers ?? [],
      query
    );
  };

  const liveCustomer = (id) => {
    const state = typeof getState === 'function' ? getState() : null;
    return (state?.customers ?? []).find(c => c.id === id) ?? null;
  };

  function renderZoneFilters(groups, visibleCount) {
    if (!zoneFiltersEl) return;
    const allSummary = fieldModeZoneSummary(pendingEntries());
    const chips = [
      `<button type="button" class="field-mode-zone-chip${zoneKey === FIELD_MODE_ALL_ZONES ? ' is-active' : ''}" data-field-zone="${FIELD_MODE_ALL_ZONES}" aria-pressed="${zoneKey === FIELD_MODE_ALL_ZONES}">All areas · ${allSummary.count}</button>`
    ];
    for (const group of groups) {
      const active = zoneKey === group.key;
      chips.push(`<button type="button" class="field-mode-zone-chip${active ? ' is-active' : ''}" data-field-zone="${escapeHtml(group.key)}" aria-pressed="${active}">${escapeHtml(group.label)} · ${group.count}</button>`);
    }
    zoneFiltersEl.innerHTML = chips.join('');
    if (zoneTargetEl) {
      const state = typeof getState === 'function' ? getState() : null;
      const collectedLabel = zoneKey !== FIELD_MODE_ALL_ZONES
        ? (groups.find(g => g.key === zoneKey)?.label ?? 'This area')
        : 'All areas';
      const collected = fieldModeCollectedToday(state, zoneKey, todayStr());
      const collectedLine = `<span class="field-mode-collected-pill">Collected Today in ${escapeHtml(collectedLabel)}: ${collected.houses} houses · ${escapeHtml(formatPKR(collected.cash))}</span>`;
      if (zoneKey !== FIELD_MODE_ALL_ZONES) {
        const group = groups.find(g => g.key === zoneKey);
        const summary = group ? fieldModeZoneSummary(group.entries) : { count: 0, totalDues: 0 };
        zoneTargetEl.innerHTML = group
          ? `${escapeHtml(group.label)}: ${summary.count} customers · ${escapeHtml(formatPKR(summary.totalDues))} remaining to collect${collectedLine}`
          : `No customers in this area.${collectedLine}`;
      } else {
        zoneTargetEl.innerHTML = `All areas: ${allSummary.count} customers · ${escapeHtml(formatPKR(allSummary.totalDues))} remaining to collect${collectedLine}`;
      }
    }
    if (visibleCount === 0 && listEl) {
      // Keep the empty state inside the list region, not the target line.
    }
  }

  function renderList(visible) {
    if (!listEl) return;
    if (!visible.length) {
      listEl.innerHTML = '<p class="field-mode-empty">No customers with dues here. Try another area or search.</p>';
      return;
    }
    listEl.innerHTML = visible.map(entry => {
      const badge = waadaBadgeLabel(liveCustomer(entry.id), todayStr());
      const zone = fieldModeZoneOf(liveCustomer(entry.id) ?? entry);
      return `<button type="button" class="field-mode-customer-btn${selectedId === entry.id ? ' is-selected' : ''}" data-field-customer-id="${escapeHtml(entry.id)}" aria-pressed="${selectedId === entry.id}">
        <span class="field-mode-customer-main">
          <strong>${escapeHtml(entry.name)}</strong>
          <small>#${escapeHtml(entry.customerNumber)} · ${escapeHtml(zone.label)}${entry.mohalla && zone.label.toLowerCase() !== String(entry.mohalla).trim().toLowerCase() ? ` · ${escapeHtml(entry.mohalla)}` : ''}${badge ? ` · ${escapeHtml(badge)}` : ''}</small>
        </span>
        <span class="field-mode-customer-due">${escapeHtml(formatPKR(entry.totalDues))}</span>
      </button>`;
    }).join('');
  }

  function renderPanel() {
    if (!panelEl) return;
    if (lastReceipt) {
      const { receipt, whatsapp } = lastReceipt;
      const settled = Number(receipt.newTotalDues) <= 0;
      const receiptActionButtons = fieldModeReceiptActionMarkup({
        hasPrint58: typeof onPrint58mm === 'function',
        hasPngReceipt: typeof onPngReceipt === 'function'
      });
      panelEl.innerHTML = `<section class="field-mode-receipt" aria-label="Collection receipt">
        <h3>✅ Collected — ${escapeHtml(receipt.customerName)}</h3>
        <p><strong>${escapeHtml(formatPKR(receipt.amount))}</strong> via ${escapeHtml(receipt.method)} · Receipt ${escapeHtml(receipt.receiptNumber)}</p>
        <p>Remaining balance: <strong>${escapeHtml(formatPKR(receipt.newTotalDues))}</strong> · ${settled ? 'PAID IN FULL' : 'PARTIAL'}</p>
        ${whatsapp.url
          ? `<a class="field-mode-action-btn field-mode-whatsapp-btn" href="${escapeHtml(whatsapp.url)}" target="_blank" rel="noopener noreferrer">📲 WA Receipt</a>`
          : '<p class="field-mode-note">Save the customer\'s full phone number (with country code) to enable the WhatsApp receipt.</p>'}
        ${receiptActionButtons}
        <button type="button" class="field-mode-action-btn" data-field-action="next">Next customer →</button>
      </section>`;
      return;
    }
    if (!selectedId) {
      panelEl.innerHTML = '<p class="field-mode-empty">Tap a customer above to collect in 1 tap.</p>';
      return;
    }
    const state = typeof getState === 'function' ? getState() : null;
    const pending = getPendingCollectionCustomers(state, '', 'all-dues');
    const entry = pending.find(e => e.id === selectedId);
    if (!entry) {
      panelEl.innerHTML = '<p class="field-mode-empty">This customer has no pending balance anymore.</p>';
      return;
    }
    const customer = liveCustomer(selectedId);
    const badge = waadaBadgeLabel(customer, todayStr());
    const shops = fieldModeShopMethods();
    const shopButtons = shops.map(shop =>
      `<button type="button" class="field-mode-action-btn" data-field-action="shop" data-field-method="${escapeHtml(shop.method)}" ${busy ? 'disabled' : ''}>🏪 ${escapeHtml(shop.short)} Full — ${escapeHtml(formatPKR(entry.totalDues))}</button>`
    ).join('');
    panelEl.innerHTML = `<section class="field-mode-actions" aria-label="Collection actions">
      <h3>${escapeHtml(entry.name)} <small>#${escapeHtml(entry.customerNumber)}</small></h3>
      <p class="field-mode-due-line">Full pending: <strong>${escapeHtml(formatPKR(entry.totalDues))}</strong>${entry.targetMonth ? ` · oldest unpaid: ${escapeHtml(entry.targetMonth)}` : ''}${badge ? ` · ${escapeHtml(badge)}` : ''}</p>
      <div class="field-mode-action-grid">
        <button type="button" class="field-mode-action-btn field-mode-cash-btn" data-field-action="cash" ${busy ? 'disabled' : ''}>💵 Cash Full — ${escapeHtml(formatPKR(entry.totalDues))}</button>
        ${shopButtons}
      </div>
      <div class="field-mode-waada">
        <p class="field-mode-waada-label">🤝 Waada (promise-to-pay)</p>
        <div class="field-mode-waada-chips">
          <button type="button" class="field-mode-waada-chip" data-field-waada="plus2" ${busy ? 'disabled' : ''}>+2 days</button>
          <button type="button" class="field-mode-waada-chip" data-field-waada="plus5" ${busy ? 'disabled' : ''}>+5 days</button>
          <button type="button" class="field-mode-waada-chip" data-field-waada="tenth" ${busy ? 'disabled' : ''}>10th</button>
          <input id="fieldModeWaadaCustomDate" class="field-mode-waada-date" type="date" aria-label="Custom promise date">
          <button type="button" class="field-mode-waada-chip" data-field-waada="custom" ${busy ? 'disabled' : ''}>Set date</button>
          <button type="button" class="field-mode-waada-chip" data-field-waada="clear" ${busy ? 'disabled' : ''}>Clear</button>
        </div>
        <p class="field-mode-note">${customer?.promiseDate ? `Current: ${escapeHtml(customer.promiseDate)}${customer.promiseAmount ? ` · ${escapeHtml(formatPKR(customer.promiseAmount))}` : ''}${customer.promiseNote ? ` · ${escapeHtml(customer.promiseNote)}` : ''}` : 'No promise set.'}</p>
      </div>
      <button type="button" class="field-mode-action-btn field-mode-back-btn" data-field-action="back">← Back to list</button>
    </section>`;
  }

  function render() {
    if (!isOpen) return;
    const state = typeof getState === 'function' ? getState() : null;
    const pending = pendingEntries();
    const groups = groupFieldModeZones(state, pending);
    const visible = zoneKey === FIELD_MODE_ALL_ZONES
      ? pending
      : (groups.find(g => g.key === zoneKey)?.entries ?? []);
    renderZoneFilters(groups, visible.length);
    renderList(visible);
    renderPanel();
  }

  function selectCustomer(id) {
    selectedId = id;
    lastReceipt = null;
    render();
  }

  function collect(method) {
    if (busy || !selectedId) return;
    const state = typeof getState === 'function' ? getState() : null;
    if (!state) return;
    const fresh = getPendingCollectionCustomers(state, '', 'all-dues').find(e => e.id === selectedId);
    if (!fresh) {
      toast('No pending balance for this customer.');
      selectedId = null;
      render();
      return;
    }
    busy = true;
    renderPanel();
    try {
      const { nextState, receipt, whatsapp } = collectFieldModePayment(state, fresh, method);
      if (typeof onSaveState === 'function') onSaveState(nextState);
      lastReceipt = { receipt, whatsapp };
      toast(`${formatPKR(receipt.amount)} collected from ${receipt.customerName}.`);
    } catch (err) {
      toast(err?.message || 'Could not record payment.');
    } finally {
      busy = false;
    }
    render();
  }

  function applyWaada(chip) {
    if (busy || !selectedId) return;
    const state = typeof getState === 'function' ? getState() : null;
    const customer = liveCustomer(selectedId);
    if (!state || !customer) return;
    try {
      const customInput = panelEl?.querySelector('#fieldModeWaadaCustomDate');
      const updated = chip === 'clear'
        ? clearFieldModeWaada(customer)
        : applyFieldModeWaadaChip(customer, chip, todayStr(), customInput ? customInput.value : null);
      const nextState = {
        ...state,
        customers: state.customers.map(c => (c.id === customer.id ? updated : c))
      };
      if (typeof onSaveState === 'function') onSaveState(nextState);
      toast(chip === 'clear' ? 'Waada promise cleared.' : `Waada set: ${updated.promiseDate}.`);
    } catch (err) {
      toast(err?.message || 'Could not set promise.');
    }
    render();
  }

  function open(fromHash = false) {
    if (isOpen) return;
    isOpen = true;
    openedViaHash = fromHash;
    view.hidden = false;
    document.body.classList.add('field-mode-open');
    toggleBtn.setAttribute('aria-pressed', 'true');
    toggleBtn.classList.add('is-active');
    render();
    if (searchInput) searchInput.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    view.hidden = true;
    document.body.classList.remove('field-mode-open');
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.classList.remove('is-active');
    if (openedViaHash && typeof window !== 'undefined' && isFieldModeHash(window.location.hash)) {
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch { /* ignore */ }
    }
    openedViaHash = false;
  }

  function toggle() {
    if (isOpen) close();
    else open(false);
  }

  toggleBtn.addEventListener('click', toggle);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      query = searchInput.value;
      selectedId = null;
      lastReceipt = null;
      render();
    });
  }
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      query = '';
      selectedId = null;
      lastReceipt = null;
      render();
      if (searchInput) searchInput.focus();
    });
  }
  if (zoneFiltersEl) {
    zoneFiltersEl.addEventListener('click', (event) => {
      const chip = event.target.closest?.('[data-field-zone]');
      if (!chip) return;
      zoneKey = chip.getAttribute('data-field-zone') || FIELD_MODE_ALL_ZONES;
      selectedId = null;
      lastReceipt = null;
      render();
    });
  }
  if (listEl) {
    listEl.addEventListener('click', (event) => {
      const card = event.target.closest?.('[data-field-customer-id]');
      if (!card) return;
      selectCustomer(card.getAttribute('data-field-customer-id'));
    });
  }
  if (panelEl) {
    panelEl.addEventListener('click', (event) => {
      const actionBtn = event.target.closest?.('[data-field-action]');
      if (actionBtn) {
        const action = actionBtn.getAttribute('data-field-action');
        if (action === 'cash') collect('Cash');
        else if (action === 'shop') collect(actionBtn.getAttribute('data-field-method') || 'Cash');
        else if (action === 'print58') {
          // SISP-31: 1-tap 58mm slip through the host's EXISTING thermal
          // path (same printPaymentReceipt format 'thermal-58' the profile
          // history buttons use). No second printer is built here.
          if (lastReceipt && typeof onPrint58mm === 'function') {
            try {
              onPrint58mm(lastReceipt.receipt);
            } catch (err) {
              toast(err?.message || 'Could not print the 58mm slip.');
            }
          }
        }
        else if (action === 'pngReceipt') {
          // SISP-41: 1-tap stamped PNG receipt through the host's EXISTING
          // SISP-6 path (same downloadPngReceipt the profile history
          // buttons use). No second generator is built here.
          if (lastReceipt && typeof onPngReceipt === 'function') {
            try {
              onPngReceipt(lastReceipt.receipt);
            } catch (err) {
              toast(err?.message || 'Could not generate the PNG receipt.');
            }
          }
        }
        else if (action === 'next' || action === 'back') {
          selectedId = null;
          lastReceipt = null;
          render();
        }
        return;
      }
      const waadaBtn = event.target.closest?.('[data-field-waada]');
      if (waadaBtn) applyWaada(waadaBtn.getAttribute('data-field-waada'));
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) close();
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
      if (isFieldModeHash(window.location.hash)) open(true);
      else if (isOpen && openedViaHash) close();
    });
    if (isFieldModeHash(window.location.hash)) open(true);
  }

  return { open, close, toggle, isOpen: () => isOpen, refresh: render };
}
