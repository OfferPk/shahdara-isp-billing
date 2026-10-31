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
 *   ('Cash at Waseem Abbasi shop', 'Cash at Hassan shop', 'Cash at Balla
 *   shop' — SISP-86 full parity) are picked up by the SISP-1 shop-settlement
 *   ledger automatically, because it derives collectors from recorded
 *   payment methods.
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
 * SISP-79 adds a 🎯 "Likely to Pay Today" toggle chip beside the zone
 * chips: payment-day-advisor.js derives each customer's habitual pay
 * window (median payment day-of-month ± 1, from non-voided receipts
 * only) and, while the toggle is on, the list shows only customers
 * whose window contains today's day-of-month — the collector's round
 * starts with the people most likely to hand over money today. Cards
 * whose window contains today carry a 🎯 marker even when the toggle
 * is off, and the collect sheet prints the customer's usual window.
 * Read-only: the advisor never writes to any record, and a customer
 * with fewer than 2 qualifying payments has no habit and is never
 * surfaced by the filter.
 *
 * SISP-65 adds a 1-tap [🔊 Speak Due] button on the collection sheet
 * (dues + advance): it speaks the customer's name and net due aloud
 * through the device's OFFLINE window.speechSynthesis — no network, no
 * service. The spoken string is a pure formatter (formatSpeakDueText)
 * fed by fieldModeCustomerStatus, i.e. the SAME allocation-engine
 * figures the cards print — never a second balance computation. The
 * speaker (speakTextAloud) is a safe no-op when speech is unavailable:
 * it returns false and never throws, and the sheet then toasts the
 * exact text instead, so the button is never a dead end. The profile
 * heading carries the same button (profile-ui.js speakDueButtonMarkup,
 * bound in app.js to speakCustomerDue).
 *
 * SEARCH FIX (owner report 2026-10-29, "name search kro tu ni ataa"):
 * the list used to be built ONLY from the 'all-dues' pending list, so a
 * fully-paid customer could never be found by search — when the whole
 * ledger was paid up, Field Mode showed "0 customers" for any name. The
 * SISP-31 matcher itself was never the problem (on the full list it
 * finds the same customer). Locked behaviour now: with NO query the
 * default view stays dues-only exactly as designed; WITH a query,
 * searchFieldModeEntries() matches against ALL unarchived customers, so
 * a paid customer shows up (green/paid card), and his sheet offers the
 * Advance path in this same flow (collectFieldModeAdvance — the PR #488
 * machinery: executeQuickCollection with kind 'advance', the exact call
 * the Quick Collect sheet's Advance checkbox makes, so the stored
 * record, receipt card and advance balance are identical). Result cards
 * are colour-coded from the engine's real figures
 * (fieldModeCustomerStatus): RED strip = dues pending, YELLOW = unused
 * advance credit waiting, GREEN = fully paid; precedence dues >
 * advance > paid, because a customer can genuinely hold both (a later
 * month overpaid while an earlier month is unpaid — the allocation
 * engine never flows credit backward), and money owed is the truth the
 * collector must act on; the waiting credit still prints on the card.
 *
 * SISP-92 adds, on the same list and the same no-dead-button rule: a
 * "📍 Nearest first" toggle that captures the rider's live position
 * (gps-pin-helper.js captureCurrentPosition — fail-safe: denial or an
 * unsupported device just toasts and keeps the normal order) and sorts
 * the visible entries by their customer's stored GPS pin via
 * sortEntriesByNearest (Haversine meters). Customers without a pin sort
 * last with NO distance label — a distance prints only when it was
 * really computed. The sort layers on top of the existing search + zone
 * filter; it never changes which customers are visible.
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
import { PAYMENT_METHODS, formatPKR, calculatePaymentAllocations, manualBaqayaOutstandingCents } from './core.js';
import { receiptChannelPreference, receiptLangPreference } from './receipt-preferences.js';
import { t } from './nav-language.js';
import { advanceBalanceCents, advanceTargetMonthOptions, defaultAdvanceTargetMonth, advancePaymentTargetMonth } from './advance-payment.js';
import { canonicalLocation } from './phase3.js';
import { paymentDayHabit, habitCoversDay, filterLikelyToPayEntries } from './payment-day-advisor.js';
import { buildSameNameIndex, sameNameBadgeHtml } from './name-disambiguator.js';
import { transliterateRomanToUrdu } from './urdu-names.js';
import {
  computeWaadaChipDate,
  getWaadaTodayString,
  setCustomerWaada,
  clearCustomerWaada,
  waadaBadgeLabel
} from './waada-queue.js';
import { captureCurrentPosition, formatGpsDistance, sortEntriesByNearest } from './gps-pin-helper.js';
import { shopCollectorMethods } from './shop-settlement.js';

/** Deep link that opens field mode, mirroring #/bulk-collect. */
export const FIELD_MODE_HASH = '#/field-mode';
/** Zone-filter value meaning "every area/zone". */
export const FIELD_MODE_ALL_ZONES = 'all';

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
 * Shop payment methods from the app's own PAYMENT_METHODS, one entry per
 * DISTINCT canonical shop collector via shop-settlement's
 * shopCollectorMethods (Waseem Abbasi and Hassan Balla today — the old
 * Hassan/Balla split is ONE shop since OWNER-CASH-SHOP — and any future
 * "Cash at X shop" method automatically). Each entry is { method, short }
 * where short is the collector name for the button label and method is
 * the canonical method string recorded for that shop.
 */
export function fieldModeShopMethods() {
  return shopCollectorMethods(PAYMENT_METHODS)
    .map(({ shop, method }) => ({ method, short: shop.replace(/\s+Shop$/, '') || method }));
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
  // SISP-91: the WhatsApp draft renders in the customer's saved receipt
  // language when one is set (the preference wins over the default).
  const customer = nextState.customers.find(c => c.id === entry.id);
  return { nextState, receipt, whatsapp: formatQuickCollectWhatsAppReceipt(receipt, { lang: receiptLangPreference(customer) }) };
}

/**
 * SEARCH FIX: name search across ALL unarchived customers (the 'all'
 * pending-list shape, which carries zero-dues customers too), filtered
 * by the SAME SISP-31 bilingual matcher the dues list uses — no second
 * matcher is forked. An empty/blank query returns [] on purpose: the
 * no-query default view is the dues list, never this one.
 */
export function searchFieldModeEntries(state, query, referenceDate = new Date()) {
  if (!state || !String(query ?? '').trim()) return [];
  return filterFieldModeEntries(
    getPendingCollectionCustomers(state, '', 'all', referenceDate),
    state.customers ?? [],
    query
  );
}

/**
 * SEARCH FIX: the money truth for one customer, from the allocation
 * engine's real figures — total dues (sum of positive per-month
 * balances, the same math the pending list uses) and unused advance
 * credit (advanceBalanceCents: unapplied credit waiting for a future
 * bill). Colour precedence for the result cards:
 *   totalDues > 0      -> 'due'     (RED: money is owed)
 *   advanceCredit > 0  -> 'advance' (YELLOW: credit waiting)
 *   otherwise          -> 'paid'    (GREEN: fully paid)
 * Both figures are always returned: dues and waiting credit CAN coexist
 * (a later month overpaid while an earlier month is unpaid — credit
 * never flows backward), and the card prints the credit even when the
 * strip is red. `allocations` may be passed to share one engine pass
 * across a whole rendered list.
 */
export function fieldModeCustomerStatus(state, customerId, allocations = null) {
  const customer = (state?.customers ?? []).find(c => c.id === customerId);
  const allocs = allocations ?? calculatePaymentAllocations(state);
  let duesCents = 0;
  for (const bill of customer?.bills ?? []) {
    const summary = allocs.forMonth(customerId, bill.month);
    if (summary?.balanceDueCents > 0) duesCents += summary.balanceDueCents;
  }
  // Owner feature (2026-10-29): unpaid manual baqaya is part of what
  // the round still has to collect — a customer whose bills are paid
  // but who carries hand-written dues shows the RED due strip, not
  // the GREEN paid one.
  duesCents += manualBaqayaOutstandingCents(customer);
  const totalDues = Math.round(Math.max(0, duesCents)) / 100;
  const advanceCredit = Math.round(advanceBalanceCents(state, customerId, allocs)) / 100;
  const key = totalDues > 0 ? 'due' : advanceCredit > 0 ? 'advance' : 'paid';
  return { key, totalDues, advanceCredit };
}

/**
 * SISP-65: the spoken form of a due figure — grouped digits with NO
 * currency symbol or "PKR" prefix, so a speech engine reads "6,000"
 * as "six thousand" (the speak_due_text template itself supplies the
 * word "Rupees" / "rupay"). Non-finite or negative input reads as 0.
 */
function speakableAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  const rounded = Math.round(amount * 100) / 100;
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(rounded);
}

/**
 * SISP-65: the EXACT string the [🔊 Speak Due] button speaks for one
 * customer — pure and exported so the wording is unit-pinned. The
 * template follows the app language setting via t() (the house
 * pattern). The Urdu template is deliberately Roman Urdu with Latin
 * digits — the same register as the WhatsApp receipts — because the
 * device's default speech voice reads Latin script reliably, while an
 * Urdu-script sentence would be spelled out letter by letter. A zero
 * (or invalid) due speaks the "fully paid" line instead of "Rupees 0".
 */
export function formatSpeakDueText(name, netDue, lang = null) {
  const who = String(name ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
  const due = Number(netDue);
  if (!Number.isFinite(due) || due <= 0) {
    return t('speak_due_paid_text', lang, { name: who });
  }
  return t('speak_due_text', lang, { name: who, amount: speakableAmount(due) });
}

/**
 * SISP-65: builds the spoken string for a customer from the SAME
 * allocation-engine figures Field Mode's cards already show
 * (fieldModeCustomerStatus — one shared engine pass, never a second
 * balance computation). Returns '' for an unknown customer id.
 */
export function speakDueTextForCustomer(state, customerId, allocations = null, lang = null) {
  const customer = (state?.customers ?? []).find(c => c.id === customerId);
  if (!customer) return '';
  const status = fieldModeCustomerStatus(state, customerId, allocations);
  return formatSpeakDueText(customer.name, status.totalDues, lang);
}

/**
 * SISP-65: speaks a string through the device's OFFLINE speech
 * synthesis (window.speechSynthesis — on-device, no network, no
 * service). Safe no-op by contract: returns false and NEVER throws
 * when the API is missing (headless tests, unsupported browsers) or
 * fails mid-call. `synth` is injectable for tests; a real
 * SpeechSynthesisUtterance is constructed when the platform provides
 * one, otherwise a plain { text } object is passed through.
 */
export function speakTextAloud(text, synth = null) {
  try {
    const api = synth ?? (typeof globalThis !== 'undefined' ? globalThis.speechSynthesis : undefined);
    if (!api || typeof api.speak !== 'function') return false;
    const spoken = String(text ?? '').trim();
    if (!spoken) return false;
    const utterance = typeof SpeechSynthesisUtterance !== 'undefined'
      ? new SpeechSynthesisUtterance(spoken)
      : { text: spoken };
    if (typeof api.cancel === 'function') api.cancel();
    api.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/**
 * SISP-65: the [🔊 Speak Due] click seam — builds the customer's
 * spoken string from the engine figures and speaks it. Returns
 * { text, spoken } so the caller can fall back to showing the text
 * (a toast) when no speech engine exists. Never throws.
 */
export function speakCustomerDue(state, customerId, { allocations = null, lang = null, synth = null } = {}) {
  const text = speakDueTextForCustomer(state, customerId, allocations, lang);
  if (!text) return { text: '', spoken: false };
  return { text, spoken: speakTextAloud(text, synth) };
}

/**
 * SEARCH FIX: records an ADVANCE collection for a customer found by
 * search (typically zero-dues) through Field Mode's own existing path —
 * executeQuickCollection with kind 'advance', the exact call the Quick
 * Collect sheet makes when its Advance checkbox is ticked (PR #488), so
 * the payment lands tagged kind:'advance', the receipt card / WhatsApp
 * draft / 58mm / PNG flow works unchanged, and the amount first settles
 * any balance on the target month with the remainder held as advance
 * credit (the engine's real FIFO semantics). Throws on a bad amount or
 * an invalid method (executeQuickCollection validates both).
 */
export function collectFieldModeAdvance(state, entry, { amount, method, targetMonth } = {}, referenceDate = new Date()) {
  const numAmount = Number(amount);
  if (!entry || !Number.isFinite(numAmount) || numAmount <= 0) {
    throw new Error('Enter a valid advance amount greater than zero.');
  }
  const today = getPakistanLocalDate(referenceDate);
  const { nextState, receipt } = executeQuickCollection(
    state,
    {
      customerId: entry.id,
      month: entry.targetMonth,
      amount: numAmount,
      date: today,
      method: method || 'Cash',
      kind: 'advance',
      // Month targeting: the month this money is FOR (the sheet's
      // picker; next month by default). Sanitized by core on record.
      advanceTargetMonth: targetMonth
    },
    referenceDate
  );
  // SISP-91: same saved-language rule as the full-payment path above.
  const customer = nextState.customers.find(c => c.id === entry.id);
  return { nextState, receipt, whatsapp: formatQuickCollectWhatsAppReceipt(receipt, { lang: receiptLangPreference(customer) }) };
}

/** 'November 2026'-style label for a 'YYYY-MM' key (sheet convention). */
const fieldModeMonthLabel = month => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

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
export function fieldModeReceiptActionMarkup({ hasPrint58 = false, hasPngReceipt = false, preferredChannel = null } = {}) {
  const print58Button = hasPrint58
    ? `<button type="button" class="field-mode-action-btn" data-field-action="print58">🖨️ 58mm Slip</button>`
    : '';
  const pngReceiptButton = hasPngReceipt
    ? `<button type="button" class="field-mode-action-btn" data-field-action="pngReceipt">🖼️ PNG Receipt</button>`
    : '';
  // SISP-91: the customer's saved channel leads the card — 'wa_png'
  // puts the PNG receipt first; 'thermal_58' (and every other case)
  // keeps the 58mm slip first, the pre-SISP-91 order.
  return preferredChannel === 'wa_png'
    ? `${pngReceiptButton}${print58Button}`
    : `${print58Button}${pngReceiptButton}`;
}

export function setupFieldMode({ getState, onSaveState, onToast, onPrint58mm, onPngReceipt, onSmsSlipUrl } = {}) {
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
  const nearestBtn = document.getElementById('fieldModeNearestBtn');
  const nearestStatusEl = document.getElementById('fieldModeNearestStatus');

  let isOpen = false;
  let openedViaHash = false;
  let query = '';
  let zoneKey = FIELD_MODE_ALL_ZONES;
  // SISP-92: the rider's captured position while "Nearest first" is on
  // (null = normal order). Held only in memory — never persisted.
  let nearestOrigin = null;
  let nearestBusy = false;
  let likelyOnly = false;
  let selectedId = null;
  let lastReceipt = null;
  let lastReceiptAdvance = false;
  let lastReceiptAdvanceTarget = null;
  let panelMode = 'collect';
  let busy = false;

  const toast = (msg) => { if (typeof onToast === 'function') onToast(msg); };
  // SISP-65: the [🔊 Speak Due] button shared by both collection
  // sheets (existing field-mode-action-btn class — theme tokens only).
  const speakDueBtn = () =>
    `<button type="button" class="field-mode-action-btn" data-field-action="speakDue" ${busy ? 'disabled' : ''}>${escapeHtml(t('speak_due_btn'))}</button>`;
  const todayStr = () => getWaadaTodayString();
  const searching = () => String(query ?? '').trim().length > 0;

  // The dues-only pending list — the DEFAULT view, unchanged by design:
  // a customer with nothing due stays hidden until he is searched for.
  const duesEntries = () => {
    const state = typeof getState === 'function' ? getState() : null;
    if (!state) return [];
    return getPendingCollectionCustomers(state, '', 'all-dues');
  };

  // SEARCH FIX: with a query active, the list base switches to the
  // search results across ALL customers (paid ones included); with no
  // query it is exactly the dues list above.
  const activeEntries = () => {
    const state = typeof getState === 'function' ? getState() : null;
    if (!state) return [];
    return searching() ? searchFieldModeEntries(state, query) : duesEntries();
  };

  const liveCustomer = (id) => {
    const state = typeof getState === 'function' ? getState() : null;
    return (state?.customers ?? []).find(c => c.id === id) ?? null;
  };

  function renderZoneFilters(groups, baseEntries) {
    if (!zoneFiltersEl) return;
    // Counts describe the ACTIVE list base: dues-only by default, the
    // search matches while searching — so the chips/target line never
    // claim "0 customers" when a search has in fact found the customer.
    const allSummary = fieldModeZoneSummary(baseEntries);
    const chips = [
      `<button type="button" class="field-mode-zone-chip${zoneKey === FIELD_MODE_ALL_ZONES ? ' is-active' : ''}" data-field-zone="${FIELD_MODE_ALL_ZONES}" aria-pressed="${zoneKey === FIELD_MODE_ALL_ZONES}">All areas · ${allSummary.count}</button>`
    ];
    for (const group of groups) {
      const active = zoneKey === group.key;
      chips.push(`<button type="button" class="field-mode-zone-chip${active ? ' is-active' : ''}" data-field-zone="${escapeHtml(group.key)}" aria-pressed="${active}">${escapeHtml(group.label)} · ${group.count}</button>`);
    }
    // SISP-79: the 🎯 Likely-to-Pay-Today toggle — a view filter, not a
    // zone, so it rides the same chip row (same token CSS) with its own
    // data attribute and handler branch.
    chips.push(`<button type="button" class="field-mode-zone-chip${likelyOnly ? ' is-active' : ''}" data-field-likely="toggle" aria-pressed="${likelyOnly}">🎯 Likely to Pay Today</button>`);
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
  }

  function renderList(visible, statusById) {
    if (!listEl) return;
    if (!visible.length) {
      listEl.innerHTML = likelyOnly
        ? '<p class="field-mode-empty">No customer is in their usual pay window today. Turn off 🎯 Likely to Pay Today to see everyone.</p>'
        : searching()
          ? '<p class="field-mode-empty">No customer matches your search. Try another name, phone or area.</p>'
          : '<p class="field-mode-empty">No customers with dues here. Try another area or search.</p>';
      return;
    }
    const todayDay = Number(todayStr().slice(8, 10));
    const nameState = typeof getState === 'function' ? getState() : null;
    const nameIndex = buildSameNameIndex(nameState?.customers);
    listEl.innerHTML = visible.map(entry => {
      const badge = waadaBadgeLabel(liveCustomer(entry.id), todayStr());
      const sameNameBadge = sameNameBadgeHtml(nameState, liveCustomer(entry.id), new Date(), nameIndex);
      // SISP-79: 🎯 marker when the customer's usual pay window
      // contains today (derived from his receipts; no habit, no marker).
      const habit = paymentDayHabit(liveCustomer(entry.id));
      const likelyChip = habitCoversDay(habit, todayDay)
        ? '<span class="ds-chip ds-chip--paid">🎯 Likely today</span>'
        : '';
      const zone = fieldModeZoneOf(liveCustomer(entry.id) ?? entry);
      // SEARCH FIX colour coding: strip + word chip from the engine
      // figures — RED due, YELLOW advance credit waiting, GREEN paid.
      const status = statusById?.get(entry.id)
        ?? { key: entry.totalDues > 0 ? 'due' : 'paid', totalDues: entry.totalDues, advanceCredit: 0 };
      const chip = status.key === 'due'
        ? '<span class="ds-chip ds-chip--overdue">🔴 Due</span>'
        : status.key === 'advance'
          ? '<span class="ds-chip ds-chip--pending">🟡 Advance</span>'
          : '<span class="ds-chip ds-chip--paid">🟢 Paid</span>';
      const figure = status.key === 'advance'
        ? formatPKR(status.advanceCredit)
        : formatPKR(entry.totalDues);
      const creditNote = status.key === 'due' && status.advanceCredit > 0
        ? ` · Advance ${formatPKR(status.advanceCredit)}`
        : '';
      // SISP-92: a distance label prints ONLY when the nearest sort
      // computed a real Haversine distance for this card — customers
      // without a pin (distanceMeters null) never show one.
      const distanceNote = Number.isFinite(entry.distanceMeters)
        ? ` · 📍 ${escapeHtml(t('gpspin_distance_away', null, { distance: formatGpsDistance(entry.distanceMeters) }))}`
        : '';
      return `<button type="button" class="field-mode-customer-btn field-mode-status--${status.key}${selectedId === entry.id ? ' is-selected' : ''}" data-field-customer-id="${escapeHtml(entry.id)}" aria-pressed="${selectedId === entry.id}">
        <span class="field-mode-status-strip" aria-hidden="true"></span>
        <span class="field-mode-customer-main">
          <strong>${escapeHtml(entry.name)}</strong>
          <small>#${escapeHtml(entry.customerNumber)} · ${escapeHtml(zone.label)}${entry.mohalla && zone.label.toLowerCase() !== String(entry.mohalla).trim().toLowerCase() ? ` · ${escapeHtml(entry.mohalla)}` : ''}${badge ? ` · ${escapeHtml(badge)}` : ''}${creditNote}${distanceNote}</small>
          ${sameNameBadge}
          ${chip}
          ${likelyChip}
        </span>
        <span class="field-mode-customer-due">${escapeHtml(figure)}</span>
      </button>`;
    }).join('');
  }

  function renderPanel() {
    if (!panelEl) return;
    if (lastReceipt) {
      const { receipt, whatsapp } = lastReceipt;
      const settled = Number(receipt.newTotalDues) <= 0;
      // SISP-76: native SMS slip for keypad / non-WhatsApp customers.
      // The host supplies the sms: URL ('' when the phone cannot take
      // an SMS), so the button never renders as a dead link.
      const smsSlipUrl = typeof onSmsSlipUrl === 'function' ? (onSmsSlipUrl(receipt) || '') : '';
      // SISP-91: the customer's saved channel leads the receipt card —
      // 'sms' offers the SMS slip before the WhatsApp draft, and the
      // saved channel orders the slip/PNG buttons (see the markup fn).
      const receiptChannel = receiptChannelPreference(liveCustomer(receipt.customerId));
      const receiptActionButtons = fieldModeReceiptActionMarkup({
        hasPrint58: typeof onPrint58mm === 'function',
        hasPngReceipt: typeof onPngReceipt === 'function',
        preferredChannel: receiptChannel
      });
      const waReceiptMarkup = whatsapp.url
        ? `<a class="field-mode-action-btn field-mode-whatsapp-btn" href="${escapeHtml(whatsapp.url)}" target="_blank" rel="noopener noreferrer">📲 WA Receipt</a>`
        : '<p class="field-mode-note">Save the customer\'s full phone number (with country code) to enable the WhatsApp receipt.</p>';
      const smsSlipMarkup = smsSlipUrl
        ? `<a class="field-mode-action-btn field-mode-sms-btn" href="${escapeHtml(smsSlipUrl)}">💬 SMS Slip</a>`
        : '';
      panelEl.innerHTML = `<section class="field-mode-receipt" aria-label="Collection receipt">
        <h3>✅ Collected — ${escapeHtml(receipt.customerName)}</h3>
        ${lastReceiptAdvance ? `<p><span class="ds-chip ds-chip--pending">🟡 Advance</span> Tagged as advance credit${lastReceiptAdvanceTarget ? ` for ${escapeHtml(fieldModeMonthLabel(lastReceiptAdvanceTarget))}` : ' for the next bill'}.</p>` : ''}
        <p><strong>${escapeHtml(formatPKR(receipt.amount))}</strong> via ${escapeHtml(receipt.method)} · Receipt ${escapeHtml(receipt.receiptNumber)}</p>
        <p>Remaining balance: <strong>${escapeHtml(formatPKR(receipt.newTotalDues))}</strong> · ${settled ? 'PAID IN FULL' : 'PARTIAL'}</p>
        ${receiptChannel === 'sms' ? `${smsSlipMarkup}${waReceiptMarkup}` : `${waReceiptMarkup}${smsSlipMarkup}`}
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
    // SEARCH FIX: the sheet resolves the customer on the FULL list, so a
    // zero-dues customer found by search opens his sheet too (previously
    // the dues-only lookup dead-ended him). Zero dues — or the operator
    // choosing Advance — routes to the advance sheet below.
    const entry = getPendingCollectionCustomers(state, '', 'all').find(e => e.id === selectedId);
    if (!entry) {
      panelEl.innerHTML = '<p class="field-mode-empty">This customer is not available for collection.</p>';
      return;
    }
    if (panelMode === 'advance' || entry.totalDues <= 0) {
      renderAdvancePanel(entry, state);
      return;
    }
    const customer = liveCustomer(selectedId);
    const badge = waadaBadgeLabel(customer, todayStr());
    // SISP-79: the customer's usual pay window, when he has a proven
    // habit — printed on the dues line so the collector knows whether
    // today is this customer's normal paying day.
    const habit = paymentDayHabit(customer);
    const habitNote = habit ? ` · Usually pays around ${habit.windowStart}–${habit.windowEnd} of the month` : '';
    const shops = fieldModeShopMethods();
    const shopButtons = shops.map(shop =>
      `<button type="button" class="field-mode-action-btn" data-field-action="shop" data-field-method="${escapeHtml(shop.method)}" ${busy ? 'disabled' : ''}>🏪 ${escapeHtml(shop.short)} Full — ${escapeHtml(formatPKR(entry.totalDues))}</button>`
    ).join('');
    panelEl.innerHTML = `<section class="field-mode-actions" aria-label="Collection actions">
      <h3>${escapeHtml(entry.name)} <small>#${escapeHtml(entry.customerNumber)}</small></h3>
      <p class="field-mode-due-line">Full pending: <strong>${escapeHtml(formatPKR(entry.totalDues))}</strong>${entry.targetMonth ? ` · oldest unpaid: ${escapeHtml(entry.targetMonth)}` : ''}${badge ? ` · ${escapeHtml(badge)}` : ''}${escapeHtml(habitNote)}</p>
      <div class="field-mode-action-grid">
        <button type="button" class="field-mode-action-btn field-mode-cash-btn" data-field-action="cash" ${busy ? 'disabled' : ''}>💵 Cash Full — ${escapeHtml(formatPKR(entry.totalDues))}</button>
        ${shopButtons}
        ${speakDueBtn()}
        <button type="button" class="field-mode-action-btn field-mode-back-btn" data-field-action="advance" ${busy ? 'disabled' : ''}>💰 Advance payment</button>
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

  /**
   * SEARCH FIX: the Advance sheet — shown for a zero-dues customer found
   * by search (the owner's November flow: he is standing with the
   * customer, the bill is paid, the money is for the NEXT bill) and for
   * any customer when the operator taps "Advance payment" on the dues
   * sheet. The Advance checkbox is pre-ticked (the PR #488 pattern);
   * with zero dues it cannot be unticked — an untagged payment against
   * a fully-paid bill is exactly what the owner ruled out — while with
   * dues present, unticking returns to the normal collect sheet.
   */
  function renderAdvancePanel(entry, state) {
    const status = fieldModeCustomerStatus(state, entry.id);
    const zeroDues = entry.totalDues <= 0;
    const shops = fieldModeShopMethods();
    const methodButtons = [
      `<button type="button" class="field-mode-action-btn field-mode-cash-btn" data-field-advance-method="Cash" ${busy ? 'disabled' : ''}>💵 Cash Advance</button>`,
      ...shops.map(shop =>
        `<button type="button" class="field-mode-action-btn" data-field-advance-method="${escapeHtml(shop.method)}" ${busy ? 'disabled' : ''}>🏪 ${escapeHtml(shop.short)} Advance</button>`)
    ].join('');
    panelEl.innerHTML = `<section class="field-mode-actions" aria-label="Advance payment">
      <h3>${escapeHtml(entry.name)} <small>#${escapeHtml(entry.customerNumber)}</small></h3>
      <p class="field-mode-due-line">${zeroDues
        ? `✅ <strong>Paid in full — no dues.</strong>`
        : `Full pending: <strong>${escapeHtml(formatPKR(entry.totalDues))}</strong> · advance settles this first, the rest stays as credit.`}${status.advanceCredit > 0 ? ` Advance credit waiting: <strong>${escapeHtml(formatPKR(status.advanceCredit))}</strong>.` : ''}</p>
      <label class="field-mode-advance-toggle">
        <input type="checkbox" id="fieldModeAdvanceCheckbox" checked>
        <span>Advance payment (next bill credit)</span>
      </label>
      <input id="fieldModeAdvanceAmount" class="field-mode-advance-amount" type="number" inputmode="decimal" min="1" step="any" placeholder="Advance amount (PKR)" aria-label="Advance amount (PKR)">
      <label class="field-mode-advance-target-label" for="fieldModeAdvanceTargetMonth">Advance for month</label>
      <select id="fieldModeAdvanceTargetMonth" class="field-mode-advance-target" aria-label="Advance for month">
        ${advanceTargetMonthOptions().map(m => `<option value="${escapeHtml(m)}" ${m === defaultAdvanceTargetMonth() ? 'selected' : ''}>${escapeHtml(fieldModeMonthLabel(m))}</option>`).join('')}
      </select>
      <div class="field-mode-action-grid">
        ${methodButtons}
      </div>
      ${speakDueBtn()}
      <p class="field-mode-note">Money received before its bill — it stays tagged as advance for the selected month and adjusts against that month's bill automatically.</p>
      ${zeroDues ? '' : '<button type="button" class="field-mode-action-btn field-mode-back-btn" data-field-action="advance-back">← Back to collection</button>'}
      <button type="button" class="field-mode-action-btn field-mode-back-btn" data-field-action="back">← Back to list</button>
    </section>`;
  }

  function syncNearestButton() {
    if (!nearestBtn) return;
    nearestBtn.textContent = t('gpspin_nearest');
    nearestBtn.classList.toggle('is-active', Boolean(nearestOrigin));
    nearestBtn.setAttribute('aria-pressed', nearestOrigin ? 'true' : 'false');
    if (nearestStatusEl && !nearestBusy) nearestStatusEl.textContent = '';
  }

  /**
   * SISP-92: toggles the nearest-first sort. Turning it on captures ONE
   * live fix; any failure (denied / unsupported / timeout) toasts and
   * leaves the normal order untouched — never a dead end. Turning it
   * off simply restores the normal order.
   */
  async function toggleNearest() {
    if (nearestBusy) return;
    if (nearestOrigin) {
      nearestOrigin = null;
      render();
      return;
    }
    nearestBusy = true;
    if (nearestStatusEl) nearestStatusEl.textContent = t('gpspin_locating');
    const result = await captureCurrentPosition();
    nearestBusy = false;
    if (result.ok) {
      nearestOrigin = { lat: result.lat, lng: result.lng };
    } else {
      toast(t('gpspin_location_failed'));
    }
    render();
  }

  function render() {
    if (!isOpen) return;
    const state = typeof getState === 'function' ? getState() : null;
    const base = activeEntries();
    const groups = groupFieldModeZones(state, base);
    const zoneVisible = zoneKey === FIELD_MODE_ALL_ZONES
      ? base
      : (groups.find(g => g.key === zoneKey)?.entries ?? []);
    // SISP-79: with the 🎯 toggle on, only customers whose habitual
    // pay window contains today stay in the list (zone filter first,
    // then the habit filter — the two compose).
    const habitFiltered = likelyOnly
      ? filterLikelyToPayEntries(zoneVisible, state?.customers ?? [], Number(todayStr().slice(8, 10)))
      : zoneVisible;
    // SISP-92: nearest-first layers on top of search + zone filtering —
    // it reorders the SAME visible set, it never adds or hides anyone.
    const visible = nearestOrigin
      ? sortEntriesByNearest(habitFiltered, state?.customers ?? [], nearestOrigin)
      : habitFiltered;
    syncNearestButton();
    // One engine pass shared by every card's colour status.
    const allocations = state ? calculatePaymentAllocations(state) : null;
    const statusById = new Map(visible.map(entry => [
      entry.id,
      state ? fieldModeCustomerStatus(state, entry.id, allocations) : null
    ]));
    renderZoneFilters(groups, base);
    renderList(visible, statusById);
    renderPanel();
  }

  function selectCustomer(id) {
    selectedId = id;
    lastReceipt = null;
    lastReceiptAdvance = false;
    lastReceiptAdvanceTarget = null;
    panelMode = 'collect';
    render();
  }

  // SISP-65: speaks the selected customer's name + net due through
  // speakCustomerDue (the engine figures, never a second computation).
  // With no speech engine on the device the exact text is toasted
  // instead — the operator still gets the figures, never a dead end.
  function speakDue() {
    if (!selectedId) return;
    const state = typeof getState === 'function' ? getState() : null;
    if (!state) return;
    const { text, spoken } = speakCustomerDue(state, selectedId);
    if (!spoken && text) toast(text);
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
      lastReceiptAdvance = false;
      lastReceiptAdvanceTarget = null;
      toast(`${formatPKR(receipt.amount)} collected from ${receipt.customerName}.`);
    } catch (err) {
      toast(err?.message || 'Could not record payment.');
    } finally {
      busy = false;
    }
    render();
  }

  /**
   * SEARCH FIX: records an Advance from the advance sheet. The amount is
   * read from the sheet's input at tap time (the Waada custom-date
   * pattern); the record goes through collectFieldModeAdvance so it is
   * stored tagged kind 'advance' and the receipt card (WA / 58mm / PNG)
   * renders exactly like a normal collection.
   */
  function collectAdvance(method) {
    if (busy || !selectedId) return;
    const state = typeof getState === 'function' ? getState() : null;
    if (!state) return;
    const entry = getPendingCollectionCustomers(state, '', 'all').find(e => e.id === selectedId);
    if (!entry) {
      toast('This customer is not available for collection.');
      selectedId = null;
      render();
      return;
    }
    const amountInput = panelEl?.querySelector('#fieldModeAdvanceAmount');
    const amount = amountInput ? Number(amountInput.value) : NaN;
    const targetInput = panelEl?.querySelector('#fieldModeAdvanceTargetMonth');
    const targetMonth = targetInput ? targetInput.value : undefined;
    busy = true;
    renderPanel();
    try {
      const { nextState, receipt, whatsapp } = collectFieldModeAdvance(state, entry, { amount, method, targetMonth });
      if (typeof onSaveState === 'function') onSaveState(nextState);
      lastReceipt = { receipt, whatsapp };
      lastReceiptAdvance = true;
      // The receipt card names the month from the RECORDED payment
      // (sanitized by core), never from the raw select value.
      const recordedCustomer = nextState.customers.find(c => c.id === entry.id);
      const recordedPayment = (recordedCustomer?.bills ?? []).flatMap(b => b.payments ?? []).find(p => p.id === receipt.paymentId);
      lastReceiptAdvanceTarget = advancePaymentTargetMonth(recordedPayment);
      panelMode = 'collect';
      toast(`Advance ${formatPKR(receipt.amount)} recorded for ${receipt.customerName}.`);
    } catch (err) {
      toast(err?.message || 'Could not record advance payment.');
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
  const resetSelection = () => {
    selectedId = null;
    lastReceipt = null;
    lastReceiptAdvance = false;
    lastReceiptAdvanceTarget = null;
    panelMode = 'collect';
  };
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      query = searchInput.value;
      resetSelection();
      render();
    });
  }
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      query = '';
      resetSelection();
      render();
      if (searchInput) searchInput.focus();
    });
  }
  if (nearestBtn) {
    nearestBtn.addEventListener('click', () => { void toggleNearest(); });
  }
  if (zoneFiltersEl) {
    zoneFiltersEl.addEventListener('click', (event) => {
      // SISP-79: the 🎯 toggle is a view filter, not a zone — handle it
      // before the zone branch so it never touches zoneKey.
      const likelyChipBtn = event.target.closest?.('[data-field-likely]');
      if (likelyChipBtn) {
        likelyOnly = !likelyOnly;
        resetSelection();
        render();
        return;
      }
      const chip = event.target.closest?.('[data-field-zone]');
      if (!chip) return;
      zoneKey = chip.getAttribute('data-field-zone') || FIELD_MODE_ALL_ZONES;
      resetSelection();
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
    // SEARCH FIX: the Advance checkbox lives on the advance sheet. With
    // dues present, unticking returns to the normal collect sheet; with
    // zero dues it stays ticked (an untagged payment on a paid bill is
    // the owner's ruled-out double-record) and explains itself.
    panelEl.addEventListener('change', (event) => {
      if (event.target?.id !== 'fieldModeAdvanceCheckbox') return;
      const state = typeof getState === 'function' ? getState() : null;
      const entry = state
        ? getPendingCollectionCustomers(state, '', 'all').find(e => e.id === selectedId)
        : null;
      if (!entry || entry.totalDues > 0) {
        panelMode = 'collect';
        render();
      } else {
        event.target.checked = true;
        toast('This bill is already fully paid. Record money received early as an Advance payment instead — it stays tagged as advance credit for the next bill.');
      }
    });
    panelEl.addEventListener('click', (event) => {
      const advanceBtn = event.target.closest?.('[data-field-advance-method]');
      if (advanceBtn) {
        collectAdvance(advanceBtn.getAttribute('data-field-advance-method') || 'Cash');
        return;
      }
      const actionBtn = event.target.closest?.('[data-field-action]');
      if (actionBtn) {
        const action = actionBtn.getAttribute('data-field-action');
        if (action === 'cash') collect('Cash');
        else if (action === 'shop') collect(actionBtn.getAttribute('data-field-method') || 'Cash');
        else if (action === 'advance') {
          panelMode = 'advance';
          render();
        }
        else if (action === 'advance-back') {
          panelMode = 'collect';
          render();
        }
        else if (action === 'speakDue') speakDue();
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
          resetSelection();
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
