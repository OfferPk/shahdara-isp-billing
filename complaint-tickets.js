/**
 * complaint-tickets.js — SISP-12: Lineman Complaint Worklist and Material
 * Consumed Tracker (Field Ticket System).
 *
 * Problem: common field faults (charger unplugged at an upstream house,
 * fiber splice breaks, bad CAT6 connectors, router resets) were logged only
 * as free-text notes — nobody tracked which lineman fixed what, how long it
 * took, or how much wire/hardware left the store.
 *
 * This module is that worklist: structured fault tickets linked to a
 * customer (and optionally to a SISP-15 register complaint), with a
 * technician, a priority, a resolution timestamp, materials consumed, and a
 * Free-Maintenance vs Billed-to-Customer charge.
 *
 * Storage: ticket records live in localStorage under TICKETS_KEY
 * (sisp_tickets_v1). Records additionally travel inside JSON backups via
 * the `settings.tickets` section (see core.js createJsonBackup), under the
 * same safe-merge rules as the SISP-15 complaint register.
 *
 * DESIGN DECISIONS (read before changing billing behavior):
 * - Billed charges are recorded ON THE TICKET and surfaced on the customer
 *   record (profile ticket section + pending ticket charges). They are
 *   NEVER injected into bills and NEVER touch the billing-cycle engine:
 *   the cycle stays the only writer of bill amounts. A ticket charge is
 *   "pending dues" in the sense that the profile shows it alongside the
 *   bill balance as money the customer still owes for field work, and it
 *   clears only when marked paid on the ticket.
 * - Since SISP-43 a billed charge can be settled by a real ledger
 *   payment: Quick Collect shows bill dues + pending charges as one
 *   payable, records ONE payment through core addPayment whose
 *   `ticketCharges` stamp names the settled tickets, and the settled
 *   tickets are marked paid here with chargePaymentId = that payment.
 *   The charge money itself never enters bill allocation (core keeps it
 *   out), and voiding/undoing the payment reopens exactly its charges.
 * - Stock deduction is staged, not duplicated: resolving a ticket records
 *   SISP-18-shaped stock-out movements on the ticket (see
 *   ticketStockDeductions) with stockDeducted=false. This module imports
 *   nothing from the inventory book and invents no stock math. Since
 *   SISP-42 the app runs applyTicketStockBridge (below) with the
 *   inventory module's addMovement — on every ticket change, at startup,
 *   and after stock-book edits — so staged deductions land in
 *   sisp_inventory_v1 live, and a deduction that the book refuses
 *   (over-draw) stays pending on the ticket, visible in the worklist,
 *   and retries automatically. Resolution is never blocked by stock.
 * - SISP-44 two-way sync (complaint-ticket-sync.js) keeps a linked
 *   register complaint and its ticket in step. When the sync resolves a
 *   ticket from its complaint it stamps resolvedViaComplaintId here, so
 *   a later complaint reopen can undo exactly that synced resolution; a
 *   direct resolveTicket is a human field decision and clears the stamp
 *   (the sync layer stamps it again after its own calls).
 * - SISP-56: a RESOLVED ticket assigned to Saad offers a 1-click
 *   "Log Saad Visit from Ticket (TKT-NNN)" action. It opens the Saad
 *   Visit Log (saad-visits.js) with the visit form pre-filled from
 *   facts the ticket actually records (buildVisitPrefillFromTicket) —
 *   the operator still enters hours worked, because created/resolved
 *   stamps are not work duration. The link is the visit's ticketId, so
 *   a ticket with a logged visit shows "Saad visit logged" instead of
 *   the button and can never be logged twice from here.
 * - SISP-163: an unresolved ticket whose customer still owes money
 *   (host-derived via fix-and-collect-bridge.js, passed in as the
 *   getFixCollect callback) shows a 🔧💰 Fix & Collect badge, and its
 *   resolve form gains a pre-checked "collect bill too" checkbox. On a
 *   successful resolve with the box checked, the host's
 *   onResolveAndCollect opens Quick Collect; skipping the payment can
 *   never un-resolve the ticket. All strings arrive via the callback,
 *   so this module still imports nothing.
 * - This module imports nothing: it is self-contained so the backup merge
 *   in core.js can sanitize tickets without a module cycle.
 * - This module imports only leaf modules (nav-language.js and
 *   commercial-sla.js, neither of which imports anything), so the
 *   backup merge in core.js can sanitize tickets without a module
 *   cycle.
 * - SISP-84: a ticket for a commercial_vip customer (commercial-sla.js)
 *   is born with 'Urgent' priority (the add form and the SISP-44 sync
 *   both pass priorityForNewQueueItem's / the complaint's verdict), and
 *   the worklist SLA-sorts on every render: open VIP tickets pin to
 *   the top with Urgent + "< 2 Hours SLA" badges, derived live — a
 *   resolved ticket is never pinned or reordered.
 * - OWNER-SIGNAL (owner feature, 2026-10-30): a ticket may carry the
 *   optical RX reading measured when the fault was reported
 *   (signalBeforeDbm, prefilled from the customer's current lastRxDbm)
 *   and the reading measured after the fix (signalAfterDbm, entered at
 *   resolution). Both are OPTIONAL — resolving without an after reading
 *   stays fully allowed — and both ride the ticket record through the
 *   settings.tickets backup section via sanitizeTickets. The setup
 *   controller reports each saved reading through the host's
 *   onTicketSignal hook so the app can journal it into the customer's
 *   signal history (signal-history.js); this module never touches the
 *   customer ledger itself.
 * - SISP-123: this module also imports root-cause-advisor.js
 *   for the repeat-fault banner — it imports only nav-language.js,
 *   so the no-cycle property holds.
 *
 * All helpers are pure except load/saveTickets and the modal setup.
 * Tests use synthetic data only. Amounts are PKR rupees (not cents).
 */

import { rootCauseBannerHtml, ticketFaultGroup } from './root-cause-advisor.js';
import { t as translate } from './nav-language.js';
import { effectiveQueuePriority, isSlaPinned, priorityForNewQueueItem, sortQueueBySla } from './commercial-sla.js';

export const TICKETS_KEY = 'sisp_tickets_v1';

/**
 * Sharafat 68 — quarantine for rows the loader dropped. The first save
 * after a load permanently deletes dropped rows from the ticket store
 * (saveTickets re-sanitizes), so the preserved copy lives in its own
 * key, written at load time: { corrupt, dropped: [{ raw, reason }] }.
 * It is the source of truth for the dropped-rows view and is cleared
 * only by an explicit operator action from that view — never by a load
 * or a save. Separate from the Sharafat 67 counter key; it never
 * touches the id counter.
 */
export const TICKETS_DROPPED_KEY = 'sisp_tickets_dropped_v1';

/**
 * Sharafat 67 — monotonic ticket-id counter. The next number to issue
 * lives in its own key so an id is never re-issued after its record
 * drops out of the sanitized lists (malformed-row drop) or an older
 * backup is restored. The value is the NEXT number to issue (101 when
 * nothing was ever issued). It is never rewound: reads self-heal to
 * max(stored, max-over-list) and writes keep max(stored, written).
 */
export const TICKETS_NEXT_ID_KEY = 'sisp_tickets_next_id_v1';

/** 1-tap fault presets (spec verbatim). */
export const TICKET_PRESETS = [
  'Media Converter Power/Charger',
  'Fiber Cut / Splice Loss',
  'Router / IP Conflict',
  'Slow Speed / High Attenuation',
  'CAT6 / RJ45 Fault'
];

export const TICKET_STATUSES = ['Open', 'In Progress', 'Resolved'];
export const TICKET_PRIORITIES = ['Urgent', 'Normal'];

/**
 * Materials a ticket can consume (spec list). inventoryItemId is the
 * SISP-18 catalog id the deduction maps to at merge time; unit items need
 * whole numbers, meter items allow decimals.
 */
export const TICKET_MATERIALS = [
  { key: 'fiber', name: '2-Core Fiber', unit: 'meters', inventoryItemId: 'fiber-2core', allowDecimal: true },
  { key: 'patch-cord', name: 'Patch Cord', unit: 'units', inventoryItemId: 'patch-cord', allowDecimal: false },
  { key: 'media-converter', name: 'Media Converter', unit: 'units', inventoryItemId: 'media-converter', allowDecimal: false },
  { key: 'router', name: 'Tenda Router', unit: 'units', inventoryItemId: 'router', allowDecimal: false },
  { key: 'rj45', name: 'RJ45 Connectors', unit: 'units', inventoryItemId: 'rj45', allowDecimal: false }
];

export const TICKET_MATERIAL_BY_KEY = Object.fromEntries(
  TICKET_MATERIALS.map((m) => [m.key, m])
);

/** SISP-15 register category -> closest ticket preset (for linked tickets). */
export const COMPLAINT_CATEGORY_TO_PRESET = {
  'Fiber Cut': 'Fiber Cut / Splice Loss',
  'Fiber Splice Loss': 'Fiber Cut / Splice Loss',
  'Media Converter / Charger Off': 'Media Converter Power/Charger',
  'Router / Wi-Fi Config': 'Router / IP Conflict',
  'CAT6 / Connector Fault': 'CAT6 / RJ45 Fault'
};

/** Recurring-fault warning: this many tickets for one customer in the window. */
export const RECURRING_TICKET_THRESHOLD = 3;
export const RECURRING_TICKET_WINDOW_DAYS = 60;

const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ID_RE = /^TKT-(\d+)$/;
const COMPLAINT_ID_RE = /^CMP-\d+$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * OWNER-SIGNAL: ticket before/after RX readings follow the exact SISP-24
 * rule (core.js checkRxDbm): '' / null / undefined means "not recorded"
 * (null — never a faked 0); a recorded value must be finite and inside
 * -60..+10 dBm, rounded to 1 decimal. This module imports nothing, so
 * the rule is mirrored here in throwing + sanitizing twins.
 */
function checkTicketSignalDbm(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < -60 || number > 10) throw new Error('Optical RX signal must be between -60 and 10 dBm.');
  return Math.round(number * 10) / 10;
}

function sanitizeTicketSignalDbm(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < -60 || number > 10) return null;
  return Math.round(number * 10) / 10;
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

function zonedParts(date) {
  const fmt = new Intl.DateTimeFormat('en-PK', {
    timeZone: PAKISTAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = {};
  for (const part of fmt.formatToParts(date)) parts[part.type] = part.value;
  if (parts.hour === '24') parts.hour = '00';
  return parts;
}

/** YYYY-MM-DDTHH:mm in Pakistan time. */
export function pakistanTicketDateTimeNow(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Next ticket id: one above the highest existing TKT-N, starting at TKT-101. */
export function nextTicketId(existing) {
  let max = 100;
  for (const entry of (Array.isArray(existing) ? existing : [])) {
    if (!entry || typeof entry !== 'object') continue;
    const match = String(entry.id || '').match(ID_RE);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `TKT-${max + 1}`;
}

function ticketNumberOf(value) {
  const match = String(value || '').match(ID_RE);
  return match ? Number(match[1]) : 0;
}

function maxTicketNumber(list) {
  let max = 0;
  for (const entry of (Array.isArray(list) ? list : [])) {
    if (!entry || typeof entry !== 'object') continue;
    max = Math.max(max, ticketNumberOf(entry.id));
  }
  return max;
}

function defaultTicketStorage(storage) {
  if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') return storage;
  if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  return null;
}

/** Stored next ticket number, or null when the key is absent/unreadable. Never throws. */
export function readTicketCounter(storage) {
  try {
    const store = defaultTicketStorage(storage);
    if (!store) return null;
    const n = Number(store.getItem(TICKETS_NEXT_ID_KEY));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Store the next ticket number, never rewinding: the stored value stays
 * max(stored, nextNumber). Returns the stored value, or null without
 * storage. Never throws.
 */
export function writeTicketCounter(storage, nextNumber) {
  try {
    const store = defaultTicketStorage(storage);
    if (!store) return null;
    const n = Math.floor(Number(nextNumber));
    if (!Number.isFinite(n) || n <= 0) return readTicketCounter(store);
    const kept = Math.max(readTicketCounter(store) ?? 0, n);
    store.setItem(TICKETS_NEXT_ID_KEY, String(kept));
    return kept;
  } catch {
    return null;
  }
}

/**
 * Next ticket number for a create: max(stored counter, max-over-list + 1, 101).
 * The list is the floor, so a lost counter save can never re-issue an id
 * that is still on a record (R11). Does not write.
 */
export function nextTicketNumber(storage, existing) {
  return Math.max(readTicketCounter(storage) ?? 0, maxTicketNumber(existing) + 1, 101);
}

/**
 * Sharafat 67 D5(b) — one-time seed from the ledgers AND the reference
 * stores: resolvedViaTicketId + the ticket part of syncReopenGuard on
 * complaints, and payment ticketCharges ticket ids. Reference values are
 * upper-cased before matching, so a hand-edited lowercase ref still
 * counts (the generator only ever issues uppercase ids). Pure: returns
 * the next number to issue, never below 101.
 */
export function computeTicketSeed(tickets, complaints, payments) {
  let max = Math.max(maxTicketNumber(tickets), 100);
  for (const complaint of (Array.isArray(complaints) ? complaints : [])) {
    if (!complaint || typeof complaint !== 'object') continue;
    max = Math.max(max, ticketNumberOf(String(complaint.resolvedViaTicketId || '').toUpperCase()));
    const guardTicket = String(complaint.syncReopenGuard || '').split('@')[0].toUpperCase();
    max = Math.max(max, ticketNumberOf(guardTicket));
  }
  for (const payment of (Array.isArray(payments) ? payments : [])) {
    if (!payment || typeof payment !== 'object') continue;
    for (const line of (Array.isArray(payment.ticketCharges) ? payment.ticketCharges : [])) {
      max = Math.max(max, ticketNumberOf(String(line?.ticketId || '').toUpperCase()));
    }
  }
  return max + 1;
}

/**
 * Seed the counter once, when the key is absent. Later calls are no-ops
 * (the counter only moves forward via creates/restores). Returns the
 * seeded (or already stored) next number, or the list-derived value
 * without storage. Never throws.
 */
export function seedTicketCounter(storage, tickets, complaints, payments) {
  const existing = readTicketCounter(storage);
  if (existing !== null) return existing;
  const next = computeTicketSeed(tickets, complaints, payments);
  writeTicketCounter(storage, next);
  return next;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Sanitize one material line. Amount is PKR rupees charged for the line
 * (0 when free or unpriced); qty is meters (decimals ok) or whole units.
 */
export function sanitizeTicketMaterial(value) {
  if (!value || typeof value !== 'object') return null;
  const material = TICKET_MATERIAL_BY_KEY[cleanText(value.key)];
  if (!material) return null;
  const qty = Number(value.qty);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  if (!material.allowDecimal && !Number.isInteger(qty)) return null;
  const amount = Number(value.amount);
  return {
    key: material.key,
    qty: round2(qty),
    amount: Number.isFinite(amount) && amount >= 0 ? round2(amount) : 0
  };
}

export function sanitizeTicketMaterials(value) {
  if (!Array.isArray(value)) return [];
  const lines = [];
  for (const entry of value) {
    const line = sanitizeTicketMaterial(entry);
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Drops malformed ticket entries; keeps only known fields with safe
 * defaults so old records (missing new fields) never break the worklist.
 * Sharafat 68: the reporting twin — `dropped` holds the RAW rows the
 * sanitizer skipped, each with the rule that dropped it, so the owner
 * can still see what was lost. Rows only: a ticket that loads with a
 * dropped material line is a nested repair, not a dropped record.
 */
export function sanitizeTicketsWithReport(value) {
  if (!Array.isArray(value)) return { list: [], dropped: [] };
  const list = [];
  const dropped = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') { dropped.push({ raw: entry === undefined ? null : entry, reason: 'not a record' }); continue; }
    const id = cleanText(entry.id);
    if (!ID_RE.test(id)) { dropped.push({ raw: entry, reason: 'invalid ticket id' }); continue; }
    const customerId = cleanText(entry.customerId);
    if (!customerId) { dropped.push({ raw: entry, reason: 'missing customer' }); continue; }
    const preset = cleanText(entry.faultPreset);
    const status = TICKET_STATUSES.includes(entry.status) ? entry.status : 'Open';
    const resolvedAt = status === 'Resolved' && DATE_TIME_RE.test(String(entry.resolvedAt || ''))
      ? String(entry.resolvedAt)
      : '';
    const materialsUsed = sanitizeTicketMaterials(entry.materialsUsed);
    const billingType = entry.billingType === 'billed' ? 'billed' : 'free';
    list.push({
      id,
      customerId,
      customerName: cleanText(entry.customerName),
      complaintId: COMPLAINT_ID_RE.test(String(entry.complaintId || '')) ? String(entry.complaintId) : '',
      faultPreset: TICKET_PRESETS.includes(preset) ? preset : '',
      customFault: cleanText(entry.customFault),
      technician: cleanText(entry.technician),
      priority: TICKET_PRIORITIES.includes(entry.priority) ? entry.priority : 'Normal',
      status,
      createdAt: DATE_TIME_RE.test(String(entry.createdAt || '')) ? String(entry.createdAt) : '',
      resolvedAt,
      note: cleanText(entry.note),
      materialsUsed,
      billingType,
      billedAmount: billingType === 'billed'
        ? round2(materialsUsed.reduce((sum, line) => sum + line.amount, 0))
        : 0,
      chargePaid: entry.chargePaid === true,
      chargePaidAt: entry.chargePaid === true && DATE_TIME_RE.test(String(entry.chargePaidAt || ''))
        ? String(entry.chargePaidAt)
        : '',
      // SISP-43: id of the ledger payment whose receipt settled this
      // charge ('' for the manual mark-paid toggle), so voiding or
      // undoing exactly that payment reopens exactly this charge.
      chargePaymentId: entry.chargePaid === true && typeof entry.chargePaymentId === 'string'
        ? entry.chargePaymentId.slice(0, 80)
        : '',
      // SISP-44: set only while this ticket's Resolved state was
      // produced by the complaint sync from that register complaint.
      resolvedViaComplaintId: COMPLAINT_ID_RE.test(String(entry.resolvedViaComplaintId || '')) ? String(entry.resolvedViaComplaintId) : '',
      // OWNER-SIGNAL: before/after RX readings (null = not recorded).
      signalBeforeDbm: sanitizeTicketSignalDbm(entry.signalBeforeDbm),
      signalAfterDbm: sanitizeTicketSignalDbm(entry.signalAfterDbm),
      stockDeductions: Array.isArray(entry.stockDeductions) ? clone(entry.stockDeductions) : [],
      stockDeducted: entry.stockDeducted === true,
      // SISP-127: present ONLY when the ticket's resolution stock was
      // sourced from the lineman's field bag; absent means the Main
      // Store (the SISP-42 default), so legacy tickets sanitize
      // byte-identically.
      ...(entry.stockSource === 'bag' ? { stockSource: 'bag' } : {})
    });
  }
  return { list, dropped };
}

export function sanitizeTickets(value) {
  return sanitizeTicketsWithReport(value).list;
}

export function loadTickets(storage) {
  try {
    const raw = (storage || (typeof localStorage !== 'undefined' ? localStorage : null))?.getItem(TICKETS_KEY);
    if (!raw) return [];
    return sanitizeTickets(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * Sharafat 68 — the reporting load: the sanitized list, the raw rows
 * the sanitizer skipped (with the rule that dropped each), and whether
 * the whole store failed to parse. An empty store and a corrupt store
 * are no longer indistinguishable: corrupt JSON and non-array JSON
 * both report corrupt: true instead of silently returning []. The
 * existing loadTickets keeps its signature and behaviour — only the
 * modal (and tests) use this variant.
 */
export function loadTicketsWithReport(storage) {
  try {
    const raw = (storage || (typeof localStorage !== 'undefined' ? localStorage : null))?.getItem(TICKETS_KEY);
    if (!raw) return { list: [], dropped: [], corrupt: false };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { list: [], dropped: [], corrupt: true };
    const { list, dropped } = sanitizeTicketsWithReport(parsed);
    return { list, dropped, corrupt: false };
  } catch {
    return { list: [], dropped: [], corrupt: true };
  }
}

/** The preserved copy of dropped ticket rows ({ corrupt, dropped } | null). Never throws. */
export function readTicketQuarantine(storage) {
  try {
    const store = defaultTicketStorage(storage);
    if (!store) return null;
    const raw = store.getItem(TICKETS_DROPPED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.dropped)) return null;
    return { corrupt: parsed.corrupt === true, dropped: parsed.dropped };
  } catch {
    return null;
  }
}

/**
 * Sharafat 68 — write the quarantine, but only when the preserved set
 * changed: renderList loads (and reports) several times per render, and
 * an unconditional write would rewrite the key on every open. A fresh
 * load that finds drops (or a corrupt store) OVERWRITES the quarantine
 * with the new set, so a second corruption never hides behind the
 * first. Returns the stored quarantine, or null without storage.
 * Never throws.
 */
export function writeTicketQuarantine(storage, report) {
  try {
    const store = defaultTicketStorage(storage);
    if (!store) return null;
    const next = { corrupt: report?.corrupt === true, dropped: Array.isArray(report?.dropped) ? report.dropped : [] };
    const serialized = JSON.stringify(next);
    if (store.getItem(TICKETS_DROPPED_KEY) === serialized) return readTicketQuarantine(store);
    store.setItem(TICKETS_DROPPED_KEY, serialized);
    return next;
  } catch {
    return null;
  }
}

/**
 * Sharafat 68 — clear the preserved copy. The ONLY way the quarantine
 * goes away: an explicit operator action from the dropped-rows view.
 * The rows are already gone from the live store, so clearing drops
 * only the preserved copy. Returns false without storage. Never throws.
 */
export function clearTicketQuarantine(storage) {
  try {
    const store = defaultTicketStorage(storage);
    if (!store) return false;
    if (typeof store.removeItem === 'function') store.removeItem(TICKETS_DROPPED_KEY);
    else store.setItem(TICKETS_DROPPED_KEY, '');
    return true;
  } catch {
    return false;
  }
}

export function saveTickets(tickets, storage) {
  const target = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!target) return;
  target.setItem(TICKETS_KEY, JSON.stringify(sanitizeTickets(tickets)));
}

/** Human label for a ticket's customer (stored name, else the id). */
export function ticketCustomerLabel(ticket) {
  return (ticket && ticket.customerName) ? ticket.customerName : (ticket ? String(ticket.customerId || '') : '');
}

/** Create a ticket. Technician is required; preset or a custom fault is required. */
export function createTicket(input, existing, referenceDate = new Date(), storage) {
  const list = Array.isArray(existing) ? existing : [];
  const customerId = cleanText(input?.customerId);
  if (!customerId) throw new Error('Select a customer first.');
  const technician = cleanText(input?.technician);
  if (!technician) throw new Error('Assign a lineman / technician first.');
  const preset = cleanText(input?.faultPreset);
  const customFault = cleanText(input?.customFault);
  if (!TICKET_PRESETS.includes(preset) && !customFault) {
    throw new Error('Pick a fault preset or describe the fault.');
  }
  const complaintId = cleanText(input?.complaintId);
  if (complaintId && !COMPLAINT_ID_RE.test(complaintId)) {
    throw new Error('Linked complaint id must look like CMP-101.');
  }
  // OWNER-SIGNAL: the "signal right now" reading is optional; when one
  // is supplied it must satisfy the SISP-24 range (throws otherwise).
  const signalBeforeDbm = checkTicketSignalDbm(input?.signalBeforeDbm);
  // Sharafat 67: the id comes from the monotonic counter, not from
  // max-over-list — so a deleted (or sanitize-dropped) max id is never
  // re-issued. The counter is bumped here, at create time, before the
  // caller persists the record: a lost record save only skips a number,
  // and a lost counter save is healed by the list floor on the next
  // create (R11). Without storage (pure/test use) this is exactly
  // nextTicketId(list) — the counter is invisible.
  const store = defaultTicketStorage(storage);
  const next = nextTicketNumber(store, list);
  if (store) writeTicketCounter(store, next + 1);
  return {
    id: `TKT-${next}`,
    customerId,
    customerName: cleanText(input?.customerName),
    complaintId,
    faultPreset: TICKET_PRESETS.includes(preset) ? preset : '',
    customFault: TICKET_PRESETS.includes(preset) ? '' : customFault,
    technician,
    priority: TICKET_PRIORITIES.includes(input?.priority) ? input.priority : 'Normal',
    status: 'Open',
    createdAt: pakistanTicketDateTimeNow(referenceDate),
    resolvedAt: '',
    note: cleanText(input?.note),
    materialsUsed: [],
    billingType: 'free',
    billedAmount: 0,
    chargePaid: false,
    chargePaidAt: '',
    chargePaymentId: '',
    resolvedViaComplaintId: '',
    signalBeforeDbm,
    signalAfterDbm: null,
    stockDeductions: [],
    stockDeducted: false
  };
}

/** Start / reopen a ticket. Resolving goes through resolveTicket (materials). */
export function setTicketStatus(list, id, status) {
  const clean = sanitizeTickets(list);
  const idx = clean.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error('Ticket not found.');
  if (status === 'Resolved') {
    throw new Error('Resolve a ticket with materials via resolveTicket.');
  }
  if (!['Open', 'In Progress'].includes(status)) throw new Error('Unknown ticket status.');
  const ticket = clean[idx];
  clean[idx] = {
    ...ticket,
    status,
    // Reopening clears the resolution stamp; materials + charges stay on
    // the record so nothing about the field visit is silently lost.
    // Sharafat 66: on ANY move out of Resolved — Open and In Progress
    // alike. The old code kept the stamp for In Progress, so a reopened
    // ticket carried a resolution time it no longer had.
    resolvedAt: ''
  };
  return clean;
}

/**
 * Sharafat 66 D2(b) — covered-only stock preserve: is every one of the
 * new staged deduction lines covered by the old staged lines? Coverage is
 * per itemId, summed over duplicate lines, old qty >= new qty; the
 * resolution date is excluded (the new lines carry the new resolution
 * date) and the stock source is ignored (R10 — the bag bridge keys on
 * its own record, not the staged list). An empty new list is covered by
 * definition: re-resolving with no materials keeps the old deduction
 * record, which the bridge still needs as its reversal record.
 */
function stockDeductionsCovered(oldLines, newLines) {
  const oldQtyByItem = new Map();
  for (const line of Array.isArray(oldLines) ? oldLines : []) {
    if (!line || typeof line.itemId !== 'string' || !line.itemId) continue;
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    oldQtyByItem.set(line.itemId, (oldQtyByItem.get(line.itemId) || 0) + qty);
  }
  const newQtyByItem = new Map();
  for (const line of Array.isArray(newLines) ? newLines : []) {
    if (!line || typeof line.itemId !== 'string' || !line.itemId) continue;
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    newQtyByItem.set(line.itemId, (newQtyByItem.get(line.itemId) || 0) + qty);
  }
  for (const [itemId, qty] of newQtyByItem) {
    if ((oldQtyByItem.get(itemId) || 0) < qty) return false;
  }
  return true;
}

/**
 * Resolve a ticket with its consumed materials. Free maintenance bills
 * nothing; Billed to Customer sums the material amounts into billedAmount
 * (the customer's pending ticket charges) and stamps resolvedAt.
 * Stock deductions are staged on the ticket for SISP-18 (see header).
 */
export function resolveTicket(list, id, options = {}) {
  const clean = sanitizeTickets(list);
  const idx = clean.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error('Ticket not found.');
  const ticket = clean[idx];
  if (ticket.status === 'Resolved') throw new Error('Ticket is already resolved.');
  const materialsUsed = sanitizeTicketMaterials(options.materialsUsed);
  const billingType = options.billingType === 'billed' ? 'billed' : 'free';
  const newBilledAmount = billingType === 'billed'
    ? round2(materialsUsed.reduce((sum, line) => sum + line.amount, 0))
    : 0;
  // Sharafat 66 D1(a): a settled charge survives a re-resolve when the
  // billed amount did not change — compared in cents, so round2 float
  // dust (0.1 + 0.2) never decides a preserve/reset. A changed amount,
  // including a billed→free flip to 0, resets the charge so the new
  // amount is billable again instead of reading paid for money never
  // collected. The old amount is the sanitized ticket's derived
  // billedAmount (from the old materials); the manual mark-paid toggle
  // (chargePaymentId '') is preserved exactly like a receipt
  // settlement — it is a paid charge either way.
  const amountUnchanged = Math.round(Number(ticket.billedAmount || 0) * 100)
    === Math.round(newBilledAmount * 100);
  // SISP-127: the resolver picks where the consumed materials come
  // from — the field bag ('bag') or the Main Store (anything else,
  // including absent: the SISP-42 behaviour). A re-resolve re-picks,
  // so any earlier pick is dropped first.
  const baseTicket = { ...ticket };
  delete baseTicket.stockSource;
  const resolved = {
    ...baseTicket,
    ...(options.stockSource === 'bag' ? { stockSource: 'bag' } : {}),
    status: 'Resolved',
    // SISP-44: a caller that already knows the resolution time (the
    // complaint sync, mirroring a register resolution) stamps it
    // verbatim; otherwise the resolution time is now in Pakistan time.
    resolvedAt: DATE_TIME_RE.test(String(options.resolvedAt || ''))
      ? String(options.resolvedAt)
      : pakistanTicketDateTimeNow(options.referenceDate),
    materialsUsed,
    billingType,
    billedAmount: newBilledAmount,
    chargePaid: amountUnchanged ? ticket.chargePaid : false,
    chargePaidAt: amountUnchanged ? ticket.chargePaidAt : '',
    chargePaymentId: amountUnchanged ? ticket.chargePaymentId : '',
    // A direct field resolution is a human decision, not a synced one:
    // clear the SISP-44 provenance stamp (the sync layer stamps it
    // again immediately after its own resolveTicket calls).
    resolvedViaComplaintId: '',
    // OWNER-SIGNAL: the after-fix reading is optional (resolving
    // without one stays fully allowed). A supplied value is validated
    // exactly like SISP-24; re-resolving after a reopen without a
    // fresh value keeps the previously recorded reading — the same
    // "nothing about the field visit is silently lost" rule the
    // materials and charges follow.
    signalAfterDbm: options.signalAfterDbm !== undefined && options.signalAfterDbm !== null && options.signalAfterDbm !== ''
      ? checkTicketSignalDbm(options.signalAfterDbm)
      : (ticket.signalAfterDbm ?? null)
  };
  // Sharafat 66 D2(b): covered-only stock preserve. When the new
  // materials are fully covered by the old staged lines, keep the old
  // staged lines and the deducted flag, so the bridge never deducts the
  // same materials twice in the no-bridge window (R2). Otherwise stage
  // the new materials fresh, exactly as today — the changed-materials
  // case is deducted, guarded in the live flow by the reopen reversal.
  const newStockDeductions = ticketStockDeductions(resolved);
  if (stockDeductionsCovered(ticket.stockDeductions, newStockDeductions)) {
    resolved.stockDeductions = ticket.stockDeductions;
    resolved.stockDeducted = ticket.stockDeducted;
  } else {
    resolved.stockDeductions = newStockDeductions;
    resolved.stockDeducted = false;
  }
  clean[idx] = resolved;
  return clean;
}

/** Edit note / technician / priority only — never status or materials. */
export function updateTicket(list, id, patch) {
  const clean = sanitizeTickets(list);
  const idx = clean.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error('Ticket not found.');
  const ticket = clean[idx];
  const technician = patch?.technician === undefined ? ticket.technician : cleanText(patch.technician);
  if (!technician) throw new Error('Assign a lineman / technician first.');
  clean[idx] = {
    ...ticket,
    technician,
    priority: TICKET_PRIORITIES.includes(patch?.priority) ? patch.priority : ticket.priority,
    note: patch?.note === undefined ? ticket.note : cleanText(patch.note)
  };
  return clean;
}

/** Mark a billed ticket's charge paid (or unpaid again). Only billed tickets. */
export function markTicketChargePaid(list, id, paid, referenceDate = new Date()) {
  const clean = sanitizeTickets(list);
  const idx = clean.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error('Ticket not found.');
  const ticket = clean[idx];
  if (ticket.billingType !== 'billed' || ticket.status !== 'Resolved') {
    throw new Error('Only a resolved billed ticket has a charge to settle.');
  }
  clean[idx] = {
    ...ticket,
    chargePaid: paid === true,
    chargePaidAt: paid === true ? pakistanTicketDateTimeNow(referenceDate) : '',
    // A manual toggle is not a receipt settlement — the SISP-43 payment
    // link never survives it in either direction.
    chargePaymentId: ''
  };
  return clean;
}

/**
 * SISP-56: is this ticket assigned to Saad? The technician field is
 * free text, so the match is by whole word: 'Saad', 'SAAD' and
 * 'Muhammad Saad' match; 'Saadullah' does not.
 */
export function isSaadTechnician(name) {
  return cleanText(name).toLowerCase().split(/[^a-z]+/).includes('saad');
}

/**
 * SISP-56: the Saad visit work type a ticket maps to. Splice work is
 * Saad's main job (see saad-visits.js), installs map to install, any
 * other fiber work to fiber-fix, and the rest to other.
 */
export function visitTypeForTicket(ticket) {
  const fault = `${cleanText(ticket?.faultPreset)} ${cleanText(ticket?.customFault)}`.toLowerCase();
  if (/install|new connection/.test(fault)) return 'install';
  if (/splice|splicing/.test(fault)) return 'splicing';
  if (/fiber|fibre/.test(fault)) return 'fiber-fix';
  return 'other';
}

/**
 * SISP-56: pre-fill for the Saad visit form from a resolved ticket.
 * Only facts the ticket itself records: the resolution date, the
 * mapped work type, the ticket's customer, the customer's area, the
 * fiber meters the resolve actually logged as consumed, and the
 * ticket link. Hours are deliberately absent — the operator enters
 * them in the visit form.
 */
export function buildVisitPrefillFromTicket(ticket, customers = []) {
  if (!ticket || typeof ticket !== 'object') return null;
  const customer = (Array.isArray(customers) ? customers : [])
    .find((c) => String(c.id) === String(ticket.customerId));
  const fiber = (Array.isArray(ticket.materialsUsed) ? ticket.materialsUsed : [])
    .find((m) => m && m.key === 'fiber');
  const fiberQty = fiber ? Number(fiber.qty) : NaN;
  const resolvedDate = /^\d{4}-\d{2}-\d{2}/.test(String(ticket.resolvedAt || ''))
    ? String(ticket.resolvedAt).slice(0, 10)
    : pakistanTicketDateTimeNow().slice(0, 10);
  return {
    date: resolvedDate,
    type: visitTypeForTicket(ticket),
    customerId: cleanText(ticket.customerId),
    area: customer ? (cleanText(customer.mohalla) || cleanText(customer.zone)) : '',
    fiberMeters: Number.isFinite(fiberQty) && fiberQty > 0 ? fiberQty : null,
    ticketId: cleanText(ticket.id),
    note: `Ticket ${cleanText(ticket.id)} · ${ticketFaultLabel(ticket)}`.slice(0, 200)
  };
}

/** Tickets for one customer, newest first. */
export function ticketsForCustomer(list, customerId) {
  return sanitizeTickets(list)
    .filter((t) => String(t.customerId) === String(customerId))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/** Unpaid billed ticket charges for one customer (PKR rupees). */
export function billedTicketChargesPending(list, customerId) {
  return round2(sanitizeTickets(list)
    .filter((t) => String(t.customerId) === String(customerId)
      && t.status === 'Resolved' && t.billingType === 'billed' && !t.chargePaid)
    .reduce((sum, t) => sum + t.billedAmount, 0));
}

/** Pending billed charge lines for one customer, oldest ticket first. */
export function pendingTicketChargeLines(list, customerId) {
  return sanitizeTickets(list)
    .filter((t) => String(t.customerId) === String(customerId)
      && t.status === 'Resolved' && t.billingType === 'billed' && !t.chargePaid && t.billedAmount > 0)
    .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
    .map((t) => ({ ticketId: t.id, amount: round2(t.billedAmount) }));
}

/**
 * SISP-43: plan which pending charges a collection remainder settles.
 * Whole charges only, oldest first — a ticket charge is never split
 * across receipts, so a charge is either settled in full by this
 * payment or stays fully pending (the leftover stays bill-side money:
 * applied to bills or advance credit, per the core allocation rules).
 */
export function planTicketChargeSettlement(list, customerId, availableCents) {
  const budget = Math.max(0, Math.floor(Number(availableCents) || 0));
  const lines = [];
  let totalCents = 0;
  for (const line of pendingTicketChargeLines(list, customerId)) {
    const lineCents = Math.round(line.amount * 100);
    if (totalCents + lineCents > budget) break;
    lines.push(line);
    totalCents += lineCents;
  }
  return { lines, totalCents };
}

/**
 * SISP-43: mark the planned charges paid by one recorded payment. The
 * payment id is stamped on each ticket (chargePaymentId) so a later
 * void/undo of exactly that payment reopens exactly these charges.
 * A ticket whose charge no longer matches the planned line, or that is
 * already paid, is skipped — a charge is never settled twice.
 */
export function settleTicketCharges(list, lines, paymentId, referenceDate = new Date()) {
  const clean = sanitizeTickets(list);
  const wanted = new Map((Array.isArray(lines) ? lines : [])
    .map((line) => [String(line?.ticketId || ''), line])
    .filter(([ticketId]) => ticketId));
  if (wanted.size === 0) return clean;
  return clean.map((ticket) => {
    const line = wanted.get(ticket.id);
    if (!line) return ticket;
    if (ticket.status !== 'Resolved' || ticket.billingType !== 'billed' || ticket.chargePaid) return ticket;
    if (Math.round(Number(line.amount) * 100) !== Math.round(ticket.billedAmount * 100)) return ticket;
    return {
      ...ticket,
      chargePaid: true,
      chargePaidAt: pakistanTicketDateTimeNow(referenceDate),
      chargePaymentId: typeof paymentId === 'string' ? paymentId : ''
    };
  });
}

/**
 * SISP-43: reopen the charges one payment settled (the void / undo
 * rollback). Only tickets whose settlement still belongs to that
 * payment are touched: a ticket re-settled by a different payment, or
 * manually toggled since, is left exactly as it is.
 */
export function unsettleTicketChargesForPayment(list, payment) {
  const lines = Array.isArray(payment?.ticketCharges) ? payment.ticketCharges : [];
  const ids = new Set(lines.map((line) => String(line?.ticketId || '')).filter(Boolean));
  const paymentId = typeof payment?.id === 'string' ? payment.id : '';
  const reopened = [];
  const next = sanitizeTickets(list).map((ticket) => {
    if (!ids.has(ticket.id) || !ticket.chargePaid) return ticket;
    if (paymentId && ticket.chargePaymentId && ticket.chargePaymentId !== paymentId) return ticket;
    reopened.push(ticket.id);
    return { ...ticket, chargePaid: false, chargePaidAt: '', chargePaymentId: '' };
  });
  return { tickets: next, reopened };
}

/** How many tickets this customer has inside the recurring-fault window. */
export function recurringTicketCount(list, customerId, referenceDate = new Date()) {
  const ref = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate.getTime()
    : Date.now();
  const windowStart = ref - RECURRING_TICKET_WINDOW_DAYS * 24 * 3600 * 1000;
  let count = 0;
  for (const ticket of sanitizeTickets(list)) {
    if (String(ticket.customerId) !== String(customerId)) continue;
    const created = Date.parse(ticket.createdAt || '');
    if (Number.isFinite(created) && created <= ref && created >= windowStart) count++;
  }
  return count;
}

/** True when the customer hits the recurring-fault warning (3+ in 60 days). */
export function hasRecurringFaultWarning(list, customerId, referenceDate = new Date()) {
  return recurringTicketCount(list, customerId, referenceDate) >= RECURRING_TICKET_THRESHOLD;
}

export function filterTickets(list, filters = {}) {
  return sanitizeTickets(list).filter((t) => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.customer && String(t.customerId) !== String(filters.customer)) return false;
    if (filters.technician && t.technician !== filters.technician) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    return true;
  });
}

export function buildTicketSummary(list) {
  const clean = sanitizeTickets(list);
  return {
    total: clean.length,
    open: clean.filter((t) => t.status === 'Open').length,
    inProgress: clean.filter((t) => t.status === 'In Progress').length,
    resolved: clean.filter((t) => t.status === 'Resolved').length,
    pendingCharges: round2(clean
      .filter((t) => t.status === 'Resolved' && t.billingType === 'billed' && !t.chargePaid)
      .reduce((sum, t) => sum + t.billedAmount, 0))
  };
}

/**
 * SISP-18 stock-out movements for a resolved ticket, in exactly the shape
 * SISP-18's addMovement accepts: { itemId, kind:'out', qty, date,
 * customerName, note }. Empty for unresolved tickets and for tickets with
 * no materials. The date is the resolution date (YYYY-MM-DD).
 */
export function ticketStockDeductions(ticket) {
  if (!ticket || ticket.status !== 'Resolved') return [];
  const date = String(ticket.resolvedAt || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const out = [];
  for (const line of sanitizeTicketMaterials(ticket.materialsUsed)) {
    const material = TICKET_MATERIAL_BY_KEY[line.key];
    if (!material) continue;
    out.push({
      itemId: material.inventoryItemId,
      kind: 'out',
      qty: line.qty,
      date,
      customerName: cleanText(ticket.customerName),
      note: `Ticket ${ticket.id} — ${ticket.faultPreset || ticket.customFault || 'field work'}`
    });
  }
  return out;
}

/**
 * WIRING CONTRACT (SISP-18, connected live by SISP-42): apply a ticket's
 * staged deductions to an inventory movement list using the inventory
 * module's addMovement function (passed in — this module never imports
 * the inventory book). Returns { movements, ticket } with the ticket
 * marked stockDeducted. Throws (leaving the ticket pending) when any
 * deduction is refused, e.g. SISP-18's over-draw refusal — the caller
 * surfaces the message and the deductions stay on the ticket for a
 * later retry.
 */
export function consumeTicketStockDeductions(ticket, movements, addMovementFn) {
  if (typeof addMovementFn !== 'function') throw new Error('Inventory addMovement is not available.');
  const clean = sanitizeTickets([ticket]);
  if (!clean.length) throw new Error('Ticket not found.');
  const entry = clean[0];
  if (entry.status !== 'Resolved') throw new Error('Only a resolved ticket deducts stock.');
  if (entry.stockDeducted) return { movements, ticket: entry };
  let next = Array.isArray(movements) ? movements : [];
  for (const deduction of ticketStockDeductions(entry)) {
    next = addMovementFn(next, deduction);
  }
  return { movements: next, ticket: { ...entry, stockDeducted: true } };
}

/**
 * SISP-42 LIVE BRIDGE PASS (pure): reconcile the whole ticket list with
 * the inventory book in one sweep, using the inventory module's
 * addMovement (passed in — this module never imports the inventory book).
 *
 * - A Resolved ticket whose staged deductions are still unconsumed is
 *   consumed via consumeTicketStockDeductions: all-or-nothing per ticket,
 *   because inventory addMovement refuses an over-draw by throwing, so a
 *   shortfall deducts NOTHING and the ticket stays pending for a later
 *   retry. Resolution itself is never blocked here — the field work
 *   already happened; only the bookkeeping waits for stock.
 * - A ticket that was deducted (stockDeducted) and later REOPENED (any
 *   non-Resolved status) gets exactly its deducted lines reversed as
 *   Stock In movements dated the reopen day, its staged deductions are
 *   cleared and its flag reset — so re-resolving it with fresh materials
 *   can never deduct the same stock twice. (resolveTicket re-stages from
 *   the new materialsUsed on the next resolve.)
 *
 * Returns { tickets, movements, deducted, reversed, failures }; inputs
 * are never mutated and failures carry { id, message } for the caller
 * to surface. Tickets needing no work pass through untouched.
 */
export function applyTicketStockBridge(tickets, movements, addMovementFn, options = {}) {
  if (typeof addMovementFn !== 'function') throw new Error('Inventory addMovement is not available.');
  const clean = sanitizeTickets(tickets);
  let nextMovements = Array.isArray(movements) ? movements : [];
  const deducted = [];
  const reversed = [];
  const failures = [];
  const reversalDate = pakistanTicketDateTimeNow(options.referenceDate).slice(0, 10);
  const nextTickets = clean.map((ticket) => {
    if (ticket.status === 'Resolved') {
      if (ticket.stockDeducted || ticket.stockDeductions.length === 0) return ticket;
      try {
        const applied = consumeTicketStockDeductions(ticket, nextMovements, addMovementFn);
        nextMovements = applied.movements;
        deducted.push(ticket.id);
        return applied.ticket;
      } catch (error) {
        failures.push({ id: ticket.id, message: error && error.message ? error.message : 'Stock deduction failed.' });
        return ticket;
      }
    }
    if (!ticket.stockDeducted) return ticket;
    // Reopened after its stock went out: reverse exactly what was
    // deducted — the staged lines, or (if that list was lost) the
    // material lines still recorded on the ticket.
    const lines = ticket.stockDeductions.length
      ? ticket.stockDeductions
      : sanitizeTicketMaterials(ticket.materialsUsed).flatMap((line) => {
        const material = TICKET_MATERIAL_BY_KEY[line.key];
        return material ? [{ itemId: material.inventoryItemId, qty: line.qty }] : [];
      });
    if (!lines.length) return { ...ticket, stockDeducted: false };
    try {
      for (const line of lines) {
        nextMovements = addMovementFn(nextMovements, {
          itemId: line.itemId,
          kind: 'in',
          qty: line.qty,
          date: reversalDate,
          customerName: cleanText(ticket.customerName),
          note: `Ticket ${ticket.id} reopened — stock returned`
        });
      }
      reversed.push(ticket.id);
      return { ...ticket, stockDeducted: false, stockDeductions: [] };
    } catch (error) {
      failures.push({ id: ticket.id, message: error && error.message ? error.message : 'Stock return failed.' });
      return ticket;
    }
  });
  return { tickets: nextTickets, movements: nextMovements, deducted, reversed, failures };
}

/**
 * OWNER-SIGNAL: the ticket's signal pair as one honest line —
 * "-24 → -19 dBm" when both sides were measured, the single recorded
 * side on its own otherwise, and '' when nothing was measured.
 */
export function ticketSignalLabel(ticket) {
  const before = sanitizeTicketSignalDbm(ticket?.signalBeforeDbm);
  const after = sanitizeTicketSignalDbm(ticket?.signalAfterDbm);
  if (before !== null && after !== null) return `${before} → ${after} dBm`;
  if (before !== null) return `Before fix: ${before} dBm`;
  if (after !== null) return `After fix: ${after} dBm`;
  return '';
}

/** Fault label: preset, else the custom fault text. */
export function ticketFaultLabel(ticket) {
  if (!ticket) return '';
  return ticket.faultPreset || ticket.customFault || 'Field fault';
}

/** One recorded material line as the ticket card shows it (exported for
 * the SISP-177 register material badge, which reuses the same lines). */
export function materialLineLabel(line) {
  const material = TICKET_MATERIAL_BY_KEY[line.key];
  if (!material) return '';
  const qty = material.unit === 'meters' ? `${line.qty} m` : `${line.qty}`;
  return `${material.name} · ${qty}${line.amount > 0 ? ` · PKR ${line.amount}` : ''}`;
}

/**
 * Dashboard + modal controller, following the SISP-15 register pattern:
 * open() / refresh(), dashboard open button wired by id, close button,
 * add form with 1-tap preset buttons, inline resolve form per ticket card.
 * getState is the app state accessor (customers list); tickets live in
 * their own localStorage ledger, like the complaint register.
 */
export function setupFieldTicketsModal(getState, { onTicketsChanged, onToast, onLogSaadVisit, listLoggedVisitTicketIds, converterSuggestionForTicket, onTicketSignal, getRootCauseAdvice, getOpticalBadge, getFixCollect, onResolveAndCollect } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('fieldTicketsModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const filters = { status: '', customer: '', technician: '', priority: '' };
  let addPreset = '';
  // Sharafat 68 — whether the dropped-rows view is expanded. Closure
  // state: renderList re-renders the banner on every call, so the open
  // state has to live here, not in the banner element.
  let droppedViewOpen = false;

  /** A raw dropped row as display text (capped — a hand-edited row can be huge). */
  function droppedRawText(raw) {
    let text;
    try {
      text = JSON.stringify(raw) ?? 'null';
    } catch {
      text = String(raw);
    }
    return text.length > 500 ? `${text.slice(0, 500)}…` : text;
  }

  /**
   * Sharafat 68 — the dropped-records banner element, built dynamically
   * (the 63 precedent) so index.html stays untouched. It lives OUTSIDE
   * the list element, before it, because renderList rewrites the list
   * innerHTML on every call. Created once; the click listener survives
   * the innerHTML rewrites below (delegation on the container).
   */
  function droppedBannerEl() {
    let el = $('fieldTicketsDroppedBanner');
    if (el) return el;
    const listEl = $('fieldTicketsList');
    if (!listEl || !listEl.parentNode || typeof document === 'undefined') return null;
    el = document.createElement('div');
    el.id = 'fieldTicketsDroppedBanner';
    listEl.parentNode.insertBefore(el, listEl);
    el.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-dropped-action]');
      if (!btn) return;
      if (btn.dataset.droppedAction === 'view') {
        droppedViewOpen = !droppedViewOpen;
        renderList();
      } else if (btn.dataset.droppedAction === 'clear') {
        // The ONLY way the quarantine goes away: the operator clears
        // the preserved copy from this view. The rows are already gone
        // from the live store — clearing drops only the saved copy.
        clearTicketQuarantine();
        droppedViewOpen = false;
        renderList();
      }
    });
    return el;
  }

  /**
   * Sharafat 68 — render the banner for a dropped-records report
   * ({ corrupt, dropped } | null). No report → the banner is hidden.
   * A corrupt store gets the whole-store failure banner (no rows to
   * show, nothing to clear — the store is still broken, so the banner
   * returns on the next load until the store itself is fixed). Per-row
   * drops get the count + the view path; the view lists the RAW rows
   * with the rule that dropped each, every field escaped.
   */
  function renderDroppedBanner(droppedReport) {
    const banner = droppedBannerEl();
    if (!banner) return;
    if (!droppedReport || (!droppedReport.corrupt && droppedReport.dropped.length === 0)) {
      banner.innerHTML = '';
      banner.style.display = 'none';
      return;
    }
    banner.style.display = '';
    if (droppedReport.corrupt) {
      banner.innerHTML = `<div class="complaint-upchain-banner complaint-upchain-banner-warn" role="alert">
        <div class="complaint-upchain-title">⚠️ The ticket store could not be read</div>
        <p class="complaint-upchain-body">The saved ticket data is damaged, so no tickets are shown. Restore a backup to recover them.</p>
      </div>`;
      return;
    }
    const count = droppedReport.dropped.length;
    const rowsHtml = droppedViewOpen
      ? `<ul class="complaint-chain-list">${droppedReport.dropped.map((entry) => `<li><strong>${escapeHtml(entry.reason || 'could not be read')}</strong><span>${escapeHtml(droppedRawText(entry.raw))}</span></li>`).join('')}</ul>
        <p class="complaint-upchain-body">These records are already gone from the ticket list — clearing removes only this saved copy.</p>
        <button type="button" class="secondary-button" data-dropped-action="clear">Clear saved copy</button>`
      : '';
    banner.innerHTML = `<div class="complaint-upchain-banner complaint-upchain-banner-warn" role="alert">
      <div class="complaint-upchain-title">⚠️ ${count} record${count === 1 ? '' : 's'} could not be read</div>
      <p class="complaint-upchain-body">Some saved tickets were damaged and are not shown in the list. The damaged rows are kept here so they can still be checked.</p>
      <button type="button" class="secondary-button" data-dropped-action="view">${droppedViewOpen ? 'Hide dropped rows' : 'View dropped rows'}</button>
      ${rowsHtml}
    </div>`;
  }

  function customerOptions() {
    const state = getState() || { customers: [] };
    return (Array.isArray(state.customers) ? state.customers : [])
      .filter((c) => c && !c.archived)
      .map((c) => ({ id: c.id, label: `#${c.customerNumber ?? ''} ${c.name || ''}`.trim() }));
  }

  function refreshFilterSelects() {
    const state = getState() || { customers: [] };
    const customerFilter = $('ticketFilterCustomer');
    if (customerFilter) {
      const prev = filters.customer;
      customerFilter.innerHTML = '<option value="">All customers</option>' + customerOptions().map((c) => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.label)}</option>`).join('');
      customerFilter.value = prev;
      filters.customer = customerFilter.value;
    }
    const technicianFilter = $('ticketFilterTechnician');
    if (technicianFilter) {
      const technicians = [...new Set(loadTickets().map((t) => t.technician).filter(Boolean))].sort();
      const prev = filters.technician;
      technicianFilter.innerHTML = '<option value="">All linemen</option>' + technicians.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
      technicianFilter.value = technicians.includes(prev) ? prev : '';
      filters.technician = technicianFilter.value;
    }
    const addCustomer = $('ticketAddCustomer');
    if (addCustomer) {
      const prev = addCustomer.value;
      addCustomer.innerHTML = '<option value="">Select customer…</option>' + customerOptions().map((c) => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.label)}</option>`).join('');
      if ([...addCustomer.options].some((o) => o.value === prev)) addCustomer.value = prev;
    }
  }

  function setAddPreset(preset) {
    addPreset = preset;
    dialog.querySelectorAll('.ticket-preset-btn').forEach((btn) => {
      btn.classList.toggle('ticket-preset-active', btn.dataset.ticketPreset === preset);
    });
    const customInput = $('ticketAddCustomFault');
    if (customInput) customInput.value = '';
  }

  function resolveFormHtml(ticket) {
    const rows = TICKET_MATERIALS.map((m) => `
      <label class="field-label" for="ticketResolve_${ticket.id}_${m.key}">${escapeHtml(m.name)} (${escapeHtml(m.unit)})</label>
      <div class="ticket-resolve-line">
        <input id="ticketResolve_${ticket.id}_${m.key}" class="form-input" type="number" min="0" step="${m.allowDecimal ? '0.01' : '1'}" inputmode="decimal" placeholder="Qty" data-resolve-material="${m.key}" data-resolve-field="qty">
        <input class="form-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Amount PKR" data-resolve-material="${m.key}" data-resolve-field="amount">
      </div>`).join('');
    // SISP-163: when the host reports this customer still owes money,
    // the resolve form offers the combined Fix & Collect step. The label
    // (amount included) arrives fully translated via the callback.
    const fixCollect = typeof getFixCollect === 'function' && typeof onResolveAndCollect === 'function'
      ? getFixCollect(ticket.customerId)
      : null;
    const collectRow = fixCollect && fixCollect.collectLabel
      ? `<label class="ticket-resolve-collect"><input type="checkbox" data-resolve-collect checked> ${escapeHtml(fixCollect.collectLabel)}</label>`
      : '';
    return `<form class="ticket-resolve-form" data-resolve-form="${escapeHtml(ticket.id)}">
      <p class="ticket-resolve-hint">Log what left the store. Billed to Customer adds the amounts to this customer's pending ticket charges; Free Maintenance bills nothing.</p>
      ${rows}
      <div class="ticket-resolve-billing">
        <label><input type="radio" name="ticketResolveBilling_${ticket.id}" value="free" checked> Free Maintenance</label>
        <label><input type="radio" name="ticketResolveBilling_${ticket.id}" value="billed"> Billed to Customer</label>
      </div>
      ${collectRow}
      <div class="ticket-resolve-billing">
        <span>Stock source:</span>
        <label><input type="radio" name="ticketResolveSource_${ticket.id}" value="main" checked> Main Store</label>
        <label><input type="radio" name="ticketResolveSource_${ticket.id}" value="bag"> Field Bag</label>
      </div>
      <label class="field-label" for="ticketResolveSignalAfter_${ticket.id}">Signal after fix (dBm) — optional</label>
      <input id="ticketResolveSignalAfter_${ticket.id}" class="form-input" type="number" min="-60" max="10" step="0.1" inputmode="decimal" placeholder="e.g. -19.0" data-resolve-signal-after>
      <button class="primary-button" type="submit">Mark resolved</button>
    </form>`;
  }

  function statusButtons(ticket) {
    if (ticket.status === 'Open') {
      return `<button type="button" class="secondary-button ticket-status-btn" data-ticket-action="start" data-ticket-id="${escapeHtml(ticket.id)}">Start work</button><button type="button" class="primary-button ticket-status-btn" data-ticket-action="show-resolve" data-ticket-id="${escapeHtml(ticket.id)}">Resolve…</button>`;
    }
    if (ticket.status === 'In Progress') {
      return `<button type="button" class="primary-button ticket-status-btn" data-ticket-action="show-resolve" data-ticket-id="${escapeHtml(ticket.id)}">Resolve…</button><button type="button" class="secondary-button ticket-status-btn" data-ticket-action="reopen" data-ticket-id="${escapeHtml(ticket.id)}">Reopen</button>`;
    }
    return '';
  }

  function renderList() {
    const listEl = $('fieldTicketsList');
    if (!listEl) return;
    // Sharafat 68 — the load report drives the dropped-records banner.
    // A fresh load that finds dropped rows (or a corrupt store) writes
    // the quarantine AT LOAD TIME, before any save inside the modal can
    // delete the evidence; the banner then shows the quarantine's count
    // when one exists, else the fresh-load count — so the evidence
    // survives the first save and the reload after it.
    const report = loadTicketsWithReport();
    if (report.dropped.length > 0 || report.corrupt) writeTicketQuarantine(undefined, report);
    const quarantine = readTicketQuarantine();
    const droppedReport = quarantine
      ?? (report.dropped.length > 0 || report.corrupt ? { corrupt: report.corrupt, dropped: report.dropped } : null);
    const rows = filterTickets(report.list, filters);
    const summaryEl = $('fieldTicketsSummaryLine');
    const summary = buildTicketSummary(report.list);
    if (summaryEl) {
      const droppedSuffix = droppedReport && droppedReport.dropped.length > 0
        ? ` · ${droppedReport.dropped.length} record${droppedReport.dropped.length === 1 ? '' : 's'} could not be read`
        : '';
      const corruptSuffix = droppedReport && droppedReport.corrupt ? ' · ticket store could not be read' : '';
      summaryEl.textContent = rows.length === 0
        ? `No tickets match these filters.${droppedSuffix}${corruptSuffix}`
        : `${rows.length} ticket${rows.length === 1 ? '' : 's'} · ${summary.open} open · ${summary.inProgress} in progress · ${summary.resolved} resolved · PKR ${summary.pendingCharges} pending ticket charges${droppedSuffix}${corruptSuffix}`;
    }
    renderDroppedBanner(droppedReport);
    if (rows.length === 0) {
      // Sharafat 68 — the empty state used to LIE: a corrupt store
      // showed "No field tickets recorded yet". The failure banner
      // REPLACES the empty state, and an all-dropped store says so.
      listEl.innerHTML = droppedReport && droppedReport.corrupt
        ? '<p class="ticket-empty">The ticket store could not be read. Restore a backup to recover the tickets.</p>'
        : droppedReport && droppedReport.dropped.length > 0
          ? '<p class="ticket-empty">No readable tickets. Some records could not be read — see the notice above.</p>'
          : '<p class="ticket-empty">No field tickets recorded yet. Add the first one above.</p>';
      return;
    }
    // SISP-56: ticket ids that already have a Saad visit logged, so a
    // resolved Saad ticket shows its logged state instead of the
    // 1-click log button (the visit's ticketId is the dedup key).
    const loggedVisitTicketIds = new Set(
      (typeof listLoggedVisitTicketIds === 'function' ? listLoggedVisitTicketIds() : [])
        .map((id) => String(id)).filter(Boolean)
    );
    const state = getState() || { customers: [] };
    const allCustomers = Array.isArray(state.customers) ? state.customers : [];
    // SISP-84: base order stays Open-first, newest first; the SLA pass
    // then pins open commercial_vip tickets to the very top (stable —
    // residential and resolved rows keep their relative order).
    const sorted = sortQueueBySla([...rows].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Open' ? -1 : b.status === 'Open' ? 1 : 0;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }), allCustomers);
    listEl.innerHTML = sorted.map((t) => {
      // SISP-84: effective priority + SLA badges, derived live — an
      // open VIP customer's ticket shows Urgent even when it was
      // logged before the customer was tagged VIP.
      const shownPriority = effectiveQueuePriority(t, allCustomers);
      const slaBadges = isSlaPinned(t, allCustomers)
        ? `<span class="sla-vip-badge">${escapeHtml(translate('sla_vip_badge'))}</span><span class="sla-badge">${escapeHtml(translate('sla_hours_badge'))}</span>`
        : '';
      const warning = hasRecurringFaultWarning(loadTickets(), t.customerId)
        ? '<span class="ticket-warning-badge">⚠️ Recurring fault</span>'
        : '';
      // SISP-163: Fix & Collect badge — host-derived outstanding for
      // this ticket's customer; only on unresolved tickets.
      const fixCollect = t.status !== 'Resolved' && typeof getFixCollect === 'function'
        ? getFixCollect(t.customerId)
        : null;
      const fixBadge = fixCollect && fixCollect.badgeHtml
        ? `<p class="ticket-fix-collect-row">${fixCollect.badgeHtml}</p>`
        : '';
      // SISP-132: live optical fault classification for attenuation
      // tickets (host callback from optical-anomaly-detector.js),
      // derived from recorded RX readings at render time — the ticket
      // record itself is never stamped or mutated.
      const opticalBadge = t.faultPreset === 'Slow Speed / High Attenuation' && typeof getOpticalBadge === 'function'
        ? getOpticalBadge(t.customerId)
        : '';
      // SISP-123: root-cause banner — when this ticket's fault group has
      // repeated for the customer within 60 days (register complaints +
      // standalone tickets, SISP-44 pairs counted once), prescribe the
      // permanent fix. Advice is derived by the host callback; without
      // it no banner renders. Read-only.
      const rcaBanner = typeof getRootCauseAdvice === 'function'
        ? rootCauseBannerHtml((getRootCauseAdvice(t.customerId) || []).filter((entry) => entry.group === ticketFaultGroup(t)))
        : '';
      const materials = t.materialsUsed.length
        ? `<p><span>Materials</span><span>${t.materialsUsed.map(materialLineLabel).map(escapeHtml).join('<br>')}</span></p>`
        : '';
      const charge = t.status === 'Resolved'
        ? `<p><span>Charge</span><strong>${t.billingType === 'billed' ? `Billed · PKR ${t.billedAmount}${t.chargePaid ? ' · Paid' : ' · Unpaid'}` : 'Free Maintenance'}</strong></p>`
        : '';
      const stock = t.status === 'Resolved' && t.stockDeductions.length
        ? `<p><span>Stock</span><span>${t.stockDeducted ? 'Deducted from stock book' : 'Deduction pending stock book'}</span></p>`
        : '';
      // SISP-162: WDM converter replacement suggestion — an injected,
      // display-only hint (app.js builds it from the customer's recorded
      // converter side + the side stock ledger). It never writes stock
      // or ticket state; absent injector / empty text renders nothing.
      const converterHintText = typeof converterSuggestionForTicket === 'function'
        ? String(converterSuggestionForTicket(t) || '')
        : '';
      const converterHint = converterHintText
        ? `<p><span>Converter</span><span>${escapeHtml(converterHintText)}</span></p>`
        : '';
      const chargeBtn = t.status === 'Resolved' && t.billingType === 'billed' && !t.chargePaid
        ? `<button type="button" class="secondary-button ticket-status-btn" data-ticket-action="charge-paid" data-ticket-id="${escapeHtml(t.id)}">Mark charge paid</button>`
        : '';
      const saadVisitBtn = t.status === 'Resolved' && isSaadTechnician(t.technician)
        ? (loggedVisitTicketIds.has(String(t.id))
          ? '<span class="ticket-status-badge ticket-status-resolved">✓ Saad visit logged</span>'
          : `<button type="button" class="secondary-button ticket-status-btn" data-ticket-action="log-saad-visit" data-ticket-id="${escapeHtml(t.id)}">🧰 Log Saad Visit from Ticket (${escapeHtml(t.id)})</button>`)
        : '';
      return `<article class="ticket-card" data-ticket-id="${escapeHtml(t.id)}">
        <header class="ticket-card-head">
          <strong>${escapeHtml(t.id)}</strong>
          <span class="ticket-status-badge ticket-status-${t.status === 'Resolved' ? 'resolved' : t.status === 'In Progress' ? 'progress' : 'open'}">${escapeHtml(t.status)}</span>
          <span class="ticket-priority-badge ticket-priority-${shownPriority === 'Urgent' ? 'urgent' : 'normal'}">${escapeHtml(shownPriority)}</span>
          ${slaBadges}
          ${warning}
        </header>
        <p><span>Customer</span><strong>${escapeHtml(ticketCustomerLabel(t))}</strong></p>
        <p><span>Fault</span><strong>${escapeHtml(ticketFaultLabel(t))}</strong></p>
        ${fixBadge}
        ${opticalBadge ? `<p><span>Optical</span><span>${opticalBadge}</span></p>` : ''}
        ${t.complaintId ? `<p><span>Complaint</span><strong>${escapeHtml(t.complaintId)}</strong></p>` : ''}
        ${t.resolvedViaComplaintId ? `<p><span>Resolved via</span><strong>${escapeHtml(t.resolvedViaComplaintId)} · complaint register</strong></p>` : ''}
        <p><span>Lineman</span><strong>${escapeHtml(t.technician || 'Not set')}</strong></p>
        <p><span>Created</span><span>${escapeHtml(t.createdAt || 'not recorded')}</span></p>
        ${t.resolvedAt ? `<p><span>Resolved</span><span>${escapeHtml(t.resolvedAt)}</span></p>` : ''}
        ${t.note ? `<p><span>Note</span><span>${escapeHtml(t.note)}</span></p>` : ''}
        ${ticketSignalLabel(t) ? `<p><span>Signal</span><strong>${escapeHtml(ticketSignalLabel(t))}</strong></p>` : ''}
        ${materials}${charge}${stock}${converterHint}
        ${rcaBanner}
        <div class="ticket-card-actions">${statusButtons(t)}${chargeBtn}${saadVisitBtn}</div>
        <div class="ticket-resolve-slot" data-resolve-slot="${escapeHtml(t.id)}"></div>
      </article>`;
    }).join('');
  }

  function persist(next) {
    saveTickets(next);
    if (onTicketsChanged) onTicketsChanged(next);
  }

  function renderAll() {
    refreshFilterSelects();
    renderList();
  }

  const filterIds = {
    status: 'ticketFilterStatus',
    customer: 'ticketFilterCustomer',
    technician: 'ticketFilterTechnician',
    priority: 'ticketFilterPriority'
  };
  for (const [key, id] of Object.entries(filterIds)) {
    const el = $(id);
    if (el) el.addEventListener('change', () => { filters[key] = el.value || ''; renderList(); });
  }
  const clearBtn = $('ticketFilterClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    Object.assign(filters, { status: '', customer: '', technician: '', priority: '' });
    for (const [key, id] of Object.entries(filterIds)) {
      const el = $(id);
      if (el) el.value = '';
    }
    renderList();
  });

  dialog.querySelectorAll('.ticket-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => setAddPreset(btn.dataset.ticketPreset || ''));
  });

  // OWNER-SIGNAL: picking the customer prefills the "signal now" field
  // with their current last RX reading (still editable — clearing the
  // field stores nothing, so an unmeasured visit records no reading).
  const addCustomerSelect = $('ticketAddCustomer');
  if (addCustomerSelect) addCustomerSelect.addEventListener('change', () => {
    const signalInput = $('ticketAddSignalBefore');
    if (!signalInput) return;
    const state = getState() || { customers: [] };
    const customer = (Array.isArray(state.customers) ? state.customers : []).find((c) => String(c.id) === String(addCustomerSelect.value));
    signalInput.value = customer && customer.lastRxDbm !== null && customer.lastRxDbm !== undefined ? String(customer.lastRxDbm) : '';
  });

  const addForm = $('ticketAddForm');
  if (addForm) addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = getState() || { customers: [] };
    const customerId = $('ticketAddCustomer')?.value || '';
    if (!customerId) { onToast && onToast('Select a customer first.'); return; }
    const customer = (Array.isArray(state.customers) ? state.customers : []).find((c) => String(c.id) === String(customerId));
    const customFault = $('ticketAddCustomFault')?.value || '';
    try {
      const ticket = createTicket({
        customerId,
        customerName: customer ? customer.name : '',
        complaintId: $('ticketAddComplaint')?.value || '',
        faultPreset: addPreset,
        customFault,
        technician: $('ticketAddTechnician')?.value || '',
        // SISP-84: a commercial_vip customer's ticket is born Urgent.
        priority: priorityForNewQueueItem(customer, $('ticketAddPriority')?.value || 'Normal'),
        note: $('ticketAddNote')?.value || '',
        signalBeforeDbm: $('ticketAddSignalBefore')?.value || ''
      }, loadTickets());
      const next = [...loadTickets(), ticket];
      persist(next);
      // OWNER-SIGNAL: a saved before reading is a fresh measurement —
      // the host journals it into the customer's signal history.
      if (ticket.signalBeforeDbm !== null && typeof onTicketSignal === 'function') onTicketSignal(ticket, 'before');
      onToast && onToast(`Ticket ${ticket.id} recorded.`);
      addForm.reset();
      setAddPreset('');
      renderAll();
    } catch (error) {
      onToast && onToast(error && error.message ? error.message : 'Ticket could not be recorded.');
    }
  });

  const listEl = $('fieldTicketsList');
  if (listEl) {
    listEl.addEventListener('click', (event) => {
      const btn = event.target.closest('.ticket-status-btn');
      if (!btn) return;
      const id = btn.dataset.ticketId;
      const action = btn.dataset.ticketAction;
      try {
        let next;
        if (action === 'start') {
          next = setTicketStatus(loadTickets(), id, 'In Progress');
          persist(next);
          onToast && onToast(`Ticket ${id} in progress.`);
        } else if (action === 'reopen') {
          next = setTicketStatus(loadTickets(), id, 'Open');
          persist(next);
          onToast && onToast(`Ticket ${id} reopened.`);
        } else if (action === 'charge-paid') {
          next = markTicketChargePaid(loadTickets(), id, true);
          persist(next);
          onToast && onToast(`Ticket ${id} charge marked paid.`);
        } else if (action === 'log-saad-visit') {
          // SISP-56: hand the ticket to the app, which opens the Saad
          // Visit Log pre-filled from it (see buildVisitPrefillFromTicket).
          const ticket = loadTickets().find((t) => t.id === id);
          if (ticket && typeof onLogSaadVisit === 'function') onLogSaadVisit(ticket);
          return;
        } else if (action === 'show-resolve') {
          const slot = listEl.querySelector(`[data-resolve-slot="${CSS.escape(id)}"]`);
          const ticket = loadTickets().find((t) => t.id === id);
          if (slot && ticket) {
            slot.innerHTML = slot.innerHTML ? '' : resolveFormHtml(ticket);
          }
          return;
        } else {
          return;
        }
        renderList();
      } catch (error) {
        onToast && onToast(error && error.message ? error.message : 'Ticket could not be updated.');
      }
    });
    listEl.addEventListener('submit', (event) => {
      const form = event.target.closest('[data-resolve-form]');
      if (!form) return;
      event.preventDefault();
      const id = form.dataset.resolveForm;
      const materialsUsed = [];
      for (const material of TICKET_MATERIALS) {
        const qtyInput = form.querySelector(`[data-resolve-material="${material.key}"][data-resolve-field="qty"]`);
        const amountInput = form.querySelector(`[data-resolve-material="${material.key}"][data-resolve-field="amount"]`);
        const qty = qtyInput ? Number(qtyInput.value) : 0;
        if (Number.isFinite(qty) && qty > 0) {
          materialsUsed.push({
            key: material.key,
            qty,
            amount: amountInput ? Number(amountInput.value) || 0 : 0
          });
        }
      }
      const billingInput = form.querySelector(`input[name="ticketResolveBilling_${CSS.escape(id)}"]:checked`);
      const billingType = billingInput ? billingInput.value : 'free';
      // SISP-163: read the Fix & Collect choice before the re-render
      // destroys the form.
      const collectChecked = Boolean(form.querySelector('[data-resolve-collect]')?.checked);
      const sourceInput = form.querySelector(`input[name="ticketResolveSource_${CSS.escape(id)}"]:checked`);
      const stockSource = sourceInput ? sourceInput.value : 'main';
      const signalAfterRaw = form.querySelector('[data-resolve-signal-after]')?.value ?? '';
      try {
        const next = resolveTicket(loadTickets(), id, { materialsUsed, billingType, stockSource, signalAfterDbm: signalAfterRaw });
        persist(next);
        const entry = next.find((t) => t.id === id);
        // OWNER-SIGNAL: a freshly entered after reading is journalled
        // into the customer's signal history by the host.
        if (signalAfterRaw !== '' && entry && entry.signalAfterDbm !== null && typeof onTicketSignal === 'function') onTicketSignal(entry, 'after');
        onToast && onToast(entry && entry.billingType === 'billed'
          ? `Ticket ${id} resolved — PKR ${entry.billedAmount} added to pending ticket charges.`
          : `Ticket ${id} resolved.`);
        renderList();
        // SISP-163: the ticket is resolved and persisted at this point;
        // opening Quick Collect is a separate, optional act — skipping
        // or cancelling it can never un-resolve the ticket.
        if (collectChecked && entry && typeof onResolveAndCollect === 'function') {
          onResolveAndCollect(entry);
        }
      } catch (error) {
        onToast && onToast(error && error.message ? error.message : 'Ticket could not be resolved.');
      }
    });
  }

  const closeBtn = $('fieldTicketsCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openFieldTicketsModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    Object.assign(filters, { status: '', customer: '', technician: '', priority: '' });
    for (const [key, id] of Object.entries(filterIds)) {
      const el = $(id);
      if (el) el.value = '';
    }
    renderAll();
    dialog.showModal();
  });

  return {
    open(prefilter = {}) {
      Object.assign(filters, { status: '', customer: '', technician: '', priority: '' }, prefilter);
      renderAll();
      for (const [key, id] of Object.entries(filterIds)) {
        const el = $(id);
        if (el && filters[key] !== undefined) el.value = filters[key];
      }
      renderList();
      dialog.showModal();
    },
    refresh: renderAll
  };
}
