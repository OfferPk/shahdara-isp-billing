/**
 * complaint-register.js — SISP-15: Centralized Monthly Complaint Register +
 * Resolution Timeline.
 *
 * Problem: complaints lived as scattered notes (or not at all) — no single
 * register of who reported what, when it was fixed, or how long the customer
 * was down. This module is that register: one ledger of complaints with a
 * resolution timeline (reported → in progress → resolved) and automatic
 * downtime math.
 *
 * Storage: complaint records live in localStorage under COMPLAINTS_KEY
 * (sisp_complaints_ledger_v1). Records additionally travel inside JSON
 * backups via the `settings.complaints` section (see core.js
 * createJsonBackup), under the same safe-merge rules as shop settlements.
 *
 * This module imports nothing from core.js on purpose: core.js imports
 * sanitizeComplaints from here for backup restore, and a core import here
 * would create a module cycle. PKT dates are small local helpers mirroring
 * core.js (Intl en-PK / Asia/Karachi).
 *
 * SISP-44: a complaint can be linked to a SISP-12 field ticket (the link
 * lives on the ticket as complaintId). complaint-ticket-sync.js keeps the
 * two ledgers in step: resolving the ticket resolves the complaint (and
 * stamps resolvedViaTicketId here so a later ticket reopen can undo
 * exactly that synced resolution), resolving the complaint resolves the
 * ticket, and a reopen on either side reopens the other only when the
 * resolution being undone was itself a synced one. A direct status
 * change through setComplaintStatus is a human decision: resolving here
 * clears resolvedViaTicketId (the sync layer stamps it again after its
 * own calls), so manual resolutions are never overwritten by the sync.
 *
 * SISP-173: a complaint with NO linked ticket can record who resolved
 * it directly (resolvedByLineman, free text, set at resolve time or via
 * the card's inline field) so the SISP-39 lineman scorecard can
 * attribute direct register work. A complaint WITH a linked ticket is
 * attributed only through the ticket's technician — this field is then
 * inert, so a SISP-44 synced pair is still one job, counted once.
 * Reopening clears the field, exactly like resolvedAt/downtime.
 *
 * SISP-123: a complaint whose category has repeated for the same
 * customer within 60 days (register + standalone field tickets, SISP-44
 * pairs counted once) renders a root-cause banner prescribing the
 * permanent engineering fix for that category. The advice is derived by
 * root-cause-advisor.js and supplied per customer through the host's
 * getRootCauseAdvice callback; strictly read-only.
 *
 * SISP-49: an unresolved complaint whose customer feeds downstream
 * homes (SISP-7 outage-impact.js) renders an inline daisy-chain alert
 * banner on its card listing every affected downstream home, with a
 * 1-tap button that launches their bulk WhatsApp outage notifications
 * (host callback opens the SISP-7 tool prefilled; standalone fallback
 * copies the message list). The banner is computed fresh from live
 * data on every render and is strictly read-only — it never mutates,
 * hides or auto-closes any complaint.
 *
 * SISP-163: an unresolved complaint whose customer still owes money
 * (host-derived via fix-and-collect-bridge.js, passed in as the
 * getFixCollect callback) renders a 🔧💰 Fix & Collect badge and a
 * "Resolve + Collect Bill" action. That action is delegated to the
 * host's onResolveAndCollect, which runs the normal resolve path (this
 * module's setComplaintStatus + the app's sync/stock bridges) and only
 * then opens Quick Collect; without host callbacks nothing renders.
 *
 * SISP-104: each record carries followUpSentAt (null until stamped) —
 * the post-repair satisfaction check-in stamp owned by
 * post-repair-checkin.js. The follow-up lives on the COMPLAINT (this
 * register is the customer-facing record of the fault; a SISP-12
 * ticket is the field work order that syncs into it). The stamp is
 * historical: reopening a complaint never clears it, so a complaint
 * that was already checked on never re-enters the check-in queue,
 * even if it is resolved a second time.
 *
 * SISP-84: a complaint carries a stored priority ('Urgent' | 'Normal').
 * A complaint logged for a commercial_vip customer (commercial-sla.js)
 * is born 'Urgent', and on every render the queue is SLA-sorted: open
 * complaints of VIP customers pin to the top with Urgent + "< 2 Hours
 * SLA" badges (effective priority is derived live, so upgrading a
 * customer re-prioritizes their open complaints; resolved complaints
 * are never pinned or reordered).
 *
 * All helpers are pure except load/saveComplaints and the modal setup.
 * Tests use synthetic data only.
 */

import { t } from './nav-language.js';
import { buildDaisyChainAlert, buildOutageQueueText, buildOutageQueue } from './outage-impact.js';
import { complaintFaultGroup, rootCauseBannerHtml } from './root-cause-advisor.js';
import { effectiveQueuePriority, isSlaPinned, priorityForNewQueueItem, sortQueueBySla } from './commercial-sla.js';
import { getWaTemplates } from './whatsapp-templates.js';

export const COMPLAINTS_KEY = 'sisp_complaints_ledger_v1';

/** Sentinel customer id for main-line / zone-wide faults (no single customer). */
export const AREA_OUTAGE_CUSTOMER_ID = 'AREA_OUTAGE';

export const COMPLAINT_CATEGORIES = [
  'Fiber Cut',
  'Media Converter / Charger Off',
  'Fiber Splice Loss',
  'Router / Wi-Fi Config',
  'CAT6 / Connector Fault',
  'WAPDA / Power Outage',
  'Main Uplink / NayaPay Down',
  'Other'
];

export const COMPLAINT_STATUSES = ['Open', 'In Progress', 'Resolved'];

const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const ID_RE = /^CMP-(\d+)$/;
const TICKET_ID_RE = /^TKT-\d+$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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

function zonedParts(date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PAKISTAN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
}

/** "YYYY-MM-DDTHH:MM" in Pakistan time — the datetime-local input format. */
export function pakistanDateTimeNow(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** YYYY-MM in Pakistan time. */
export function pakistanMonthNow(referenceDate = new Date()) {
  return pakistanDateTimeNow(referenceDate).slice(0, 7);
}

/**
 * Downtime in hours between reportedAt and resolvedAt, rounded to 2 decimals
 * (so 10:00 → 14:30 is exactly 4.5, never 4.499999). Returns null when either
 * endpoint is missing/invalid, 0 when resolved precedes reported.
 */
export function computeDowntimeHours(reportedAt, resolvedAt) {
  if (!DATE_TIME_RE.test(String(reportedAt || '')) || !DATE_TIME_RE.test(String(resolvedAt || ''))) return null;
  const start = new Date(String(reportedAt)).getTime();
  const end = new Date(String(resolvedAt)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round(((end - start) / 3600000) * 100) / 100);
}

export function formatDowntimeHours(hours) {
  if (hours === null || hours === undefined || hours === '') return 'Not resolved yet';
  const n = Number(hours);
  if (!Number.isFinite(n)) return 'Not resolved yet';
  return `${n} h`;
}

/** Next ticket id: one above the highest existing CMP-N, starting at CMP-101. */
export function nextComplaintId(existing) {
  let max = 100;
  for (const entry of (Array.isArray(existing) ? existing : [])) {
    if (!entry || typeof entry !== 'object') continue;
    const match = String(entry.id || '').match(ID_RE);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `CMP-${max + 1}`;
}

/**
 * Drops malformed complaint entries; keeps only known fields with safe
 * defaults so old records (missing new fields) never break the register.
 */
export function sanitizeComplaints(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const id = cleanText(entry.id);
    if (!id) continue;
    const status = COMPLAINT_STATUSES.includes(entry.status) ? entry.status : 'Open';
    const reportedAt = DATE_TIME_RE.test(String(entry.reportedAt || '')) ? String(entry.reportedAt) : '';
    const resolvedAt = DATE_TIME_RE.test(String(entry.resolvedAt || '')) ? String(entry.resolvedAt) : '';
    const downtime = Number(entry.downtimeHours);
    out.push({
      id,
      customerId: entry.customerId === AREA_OUTAGE_CUSTOMER_ID ? AREA_OUTAGE_CUSTOMER_ID : (entry.customerId ?? null),
      customerName: cleanText(entry.customerName),
      zone: cleanText(entry.zone),
      issueCategory: COMPLAINT_CATEGORIES.includes(entry.issueCategory) ? entry.issueCategory : 'Other',
      reportedAt,
      resolvedAt,
      downtimeHours: Number.isFinite(downtime) && downtime >= 0 ? downtime : null,
      downtimeManual: entry.downtimeManual === true,
      // SISP-84: stored priority — set to 'Urgent' at creation for
      // commercial_vip customers; legacy records load as 'Normal' (the
      // live SLA derivation can still raise an open VIP complaint).
      priority: entry.priority === 'Urgent' ? 'Urgent' : 'Normal',
      status,
      resolutionNote: cleanText(entry.resolutionNote),
      // SISP-173: who resolved a ticket-less complaint directly
      // (free text; empty = not recorded). Inert when a SISP-12 ticket
      // links to this complaint — attribution then flows via the ticket.
      resolvedByLineman: cleanText(entry.resolvedByLineman),
      // SISP-44: set only while this complaint's Resolved state was
      // produced by the ticket sync from that ticket (see header).
      resolvedViaTicketId: TICKET_ID_RE.test(String(entry.resolvedViaTicketId || '')) ? String(entry.resolvedViaTicketId) : '',
      // SISP-44: "TKT-NNN@<resolvedAt>" while this complaint stands
      // deliberately reopened against that exact ticket resolution —
      // the sync must not slam it shut again (see sync module header).
      syncReopenGuard: /^TKT-\d+@\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(entry.syncReopenGuard || '')) ? String(entry.syncReopenGuard) : '',
      // SISP-104: post-repair check-in stamp ("YYYY-MM-DDTHH:MM" PKT)
      // or null when no check-in has been sent yet. Never erased by
      // status changes — see the header note.
      followUpSentAt: DATE_TIME_RE.test(String(entry.followUpSentAt || '')) ? String(entry.followUpSentAt) : null,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Reads complaint records; [] on missing/corrupt storage. */
export function loadComplaints(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(COMPLAINTS_KEY);
    if (!raw) return [];
    return sanitizeComplaints(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists complaint records; never throws. */
export function saveComplaints(complaints, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(COMPLAINTS_KEY, JSON.stringify(Array.isArray(complaints) ? complaints : []));
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds a new complaint. Area outages pass customerId AREA_OUTAGE_CUSTOMER_ID
 * (customerName is stored as AREA_OUTAGE per spec; the UI renders it as
 * "Area outage"). reportedAt defaults to now and is editable afterwards.
 * Throws on a missing category or an area outage without a zone.
 */
export function createComplaint(input, existing, referenceDate = new Date()) {
  const category = COMPLAINT_CATEGORIES.includes(input?.issueCategory) ? input.issueCategory : null;
  if (!category) throw new Error('Pick an issue category for the complaint.');
  const isAreaOutage = input?.customerId === AREA_OUTAGE_CUSTOMER_ID || input?.areaOutage === true;
  const zone = cleanText(input?.zone);
  if (isAreaOutage && !zone) throw new Error('An area outage needs a zone.');
  const reportedAt = DATE_TIME_RE.test(String(input?.reportedAt || ''))
    ? String(input.reportedAt)
    : pakistanDateTimeNow(referenceDate);
  return {
    id: nextComplaintId(existing),
    customerId: isAreaOutage ? AREA_OUTAGE_CUSTOMER_ID : (input?.customerId ?? null),
    customerName: isAreaOutage ? AREA_OUTAGE_CUSTOMER_ID : cleanText(input?.customerName),
    zone,
    issueCategory: category,
    reportedAt,
    resolvedAt: '',
    downtimeHours: null,
    downtimeManual: false,
    // SISP-84: the register modal passes priorityForNewQueueItem's
    // verdict, so a commercial_vip customer's complaint is born
    // 'Urgent'; any other explicit 'Urgent' request is honoured too.
    priority: input?.priority === 'Urgent' ? 'Urgent' : 'Normal',
    status: 'Open',
    resolutionNote: cleanText(input?.resolutionNote),
    resolvedByLineman: '',
    resolvedViaTicketId: '',
    syncReopenGuard: '',
    followUpSentAt: null,
    createdAt: new Date().toISOString()
  };
}

/** Display label for a complaint's customer: "Area outage · <zone>" for zone-wide faults. */
export function complaintCustomerLabel(complaint) {
  if (!complaint || typeof complaint !== 'object') return '';
  if (complaint.customerId === AREA_OUTAGE_CUSTOMER_ID) {
    return complaint.zone ? `Area outage · ${complaint.zone}` : 'Area outage';
  }
  return complaint.customerName || 'Unknown customer';
}

/**
 * SISP-49: daisy-chain alert for one complaint, or null when no banner
 * should show. The banner exists to act on a LIVE fault, so it shows
 * only while the complaint is unresolved (Open / In Progress): a
 * resolved complaint's outage is over and there is nobody left to
 * notify. Area-outage records have no single feeder customer, and an
 * unknown customer id can have no traced dependents — both return null.
 * Read-only by construction (buildDaisyChainAlert never mutates), so
 * rendering a banner can never hide, merge, auto-close or otherwise
 * alter any complaint record.
 */
export function complaintDaisyChainAlert(customers, complaint) {
  if (!complaint || typeof complaint !== 'object') return null;
  if (complaint.status === 'Resolved') return null;
  if (!complaint.customerId || complaint.customerId === AREA_OUTAGE_CUSTOMER_ID) return null;
  return buildDaisyChainAlert(customers, complaint.customerId);
}

/**
 * Applies a status change. Resolving auto-fills resolvedAt (now, unless
 * given) and auto-computes downtime unless a manual override is on record.
 * Reopening clears resolvedAt/downtime so the timeline restarts cleanly;
 * the resolution note is kept as history. Returns a NEW list.
 */
export function setComplaintStatus(list, id, status, options = {}) {
  if (!COMPLAINT_STATUSES.includes(status)) throw new Error(`Unknown complaint status: ${status}.`);
  const next = clone(Array.isArray(list) ? list : []);
  const entry = next.find((c) => c && c.id === id);
  if (!entry) throw new Error(`Complaint not found: ${id}.`);
  entry.status = status;
  if (status === 'Resolved') {
    // A direct resolution is a human decision, not a synced one: clear
    // the SISP-44 provenance stamp. The sync layer stamps it again
    // immediately after its own setComplaintStatus calls.
    entry.resolvedViaTicketId = '';
    entry.syncReopenGuard = '';
    if (DATE_TIME_RE.test(String(options.resolvedAt || ''))) entry.resolvedAt = String(options.resolvedAt);
    else if (!entry.resolvedAt) entry.resolvedAt = pakistanDateTimeNow(options.referenceDate);
    if (typeof options.resolutionNote === 'string') entry.resolutionNote = cleanText(options.resolutionNote);
    // SISP-173: the resolver's name can ride the resolve call (the
    // register card passes its inline "Resolved by" input). Ticket-sync
    // resolutions never pass it — a linked complaint attributes via the
    // ticket, so this field stays whatever it was (inert either way).
    if (typeof options.resolvedByLineman === 'string') entry.resolvedByLineman = cleanText(options.resolvedByLineman);
    if (!entry.downtimeManual) {
      const computed = computeDowntimeHours(entry.reportedAt, entry.resolvedAt);
      if (computed !== null) entry.downtimeHours = computed;
    }
  } else if (status === 'Open') {
    entry.resolvedAt = '';
    entry.downtimeHours = null;
    entry.downtimeManual = false;
    // SISP-173: reopening undoes the resolution, so its resolver goes too.
    entry.resolvedByLineman = '';
    // SISP-104: followUpSentAt is deliberately NOT cleared — the
    // check-in was really sent, and the stamp keeps this complaint
    // out of the post-repair queue even after a later re-resolution.
  }
  return next;
}

/**
 * Inline edits for reportedAt, resolvedAt, downtimeHours, resolutionNote,
 * resolvedByLineman, zone and category. Editing downtimeHours directly marks it a manual
 * override (later time edits no longer recompute it); editing a time
 * recomputes downtime for resolved complaints unless manually overridden.
 * Returns a NEW list.
 */
export function updateComplaint(list, id, patch) {
  const next = clone(Array.isArray(list) ? list : []);
  const entry = next.find((c) => c && c.id === id);
  if (!entry) throw new Error(`Complaint not found: ${id}.`);
  if (typeof patch !== 'object' || patch === null) return next;
  if (typeof patch.reportedAt === 'string' && DATE_TIME_RE.test(patch.reportedAt)) entry.reportedAt = patch.reportedAt;
  if (typeof patch.resolvedAt === 'string' && DATE_TIME_RE.test(patch.resolvedAt)) entry.resolvedAt = patch.resolvedAt;
  if (typeof patch.resolutionNote === 'string') entry.resolutionNote = cleanText(patch.resolutionNote);
  if (typeof patch.resolvedByLineman === 'string') entry.resolvedByLineman = cleanText(patch.resolvedByLineman);
  if (typeof patch.zone === 'string') entry.zone = cleanText(patch.zone);
  if (COMPLAINT_CATEGORIES.includes(patch.issueCategory)) entry.issueCategory = patch.issueCategory;
  if (patch.downtimeHours !== undefined && patch.downtimeHours !== null && patch.downtimeHours !== '') {
    const n = Number(patch.downtimeHours);
    if (Number.isFinite(n) && n >= 0) {
      entry.downtimeHours = Math.round(n * 100) / 100;
      entry.downtimeManual = true;
    }
  }
  if (entry.status === 'Resolved' && !entry.downtimeManual) {
    const computed = computeDowntimeHours(entry.reportedAt, entry.resolvedAt);
    if (computed !== null) entry.downtimeHours = computed;
  }
  return next;
}

/**
 * Register filters. Month matches the reported month (YYYY-MM); customer
 * matches customer id or name substring; zone/category match exactly.
 * Empty filter values mean "no filter".
 */
export function filterComplaints(list, filters = {}) {
  const month = MONTH_RE.test(String(filters.month || '')) ? String(filters.month) : '';
  const status = COMPLAINT_STATUSES.includes(filters.status) ? filters.status : '';
  const customer = cleanText(filters.customer);
  const zone = cleanText(filters.zone);
  const category = COMPLAINT_CATEGORIES.includes(filters.category) ? filters.category : '';
  return (Array.isArray(list) ? list : []).filter((c) => {
    if (!c || typeof c !== 'object') return false;
    if (month && String(c.reportedAt || '').slice(0, 7) !== month) return false;
    if (status && c.status !== status) return false;
    if (customer && String(c.customerId ?? '') !== customer && !String(c.customerName || '').toLowerCase().includes(customer.toLowerCase())) return false;
    if (zone && c.zone !== zone) return false;
    if (category && c.issueCategory !== category) return false;
    return true;
  });
}

/** Dashboard summary: open/in-progress/resolved counts + downtime totals. */
export function buildComplaintSummary(list, referenceDate = new Date()) {
  const all = Array.isArray(list) ? list : [];
  const month = pakistanMonthNow(referenceDate);
  const thisMonth = all.filter((c) => String(c.reportedAt || '').slice(0, 7) === month);
  const sumDowntime = (rows) => rows.reduce((sum, c) => sum + (Number.isFinite(Number(c.downtimeHours)) ? Number(c.downtimeHours) : 0), 0);
  return {
    month,
    total: all.length,
    open: all.filter((c) => c.status === 'Open').length,
    inProgress: all.filter((c) => c.status === 'In Progress').length,
    resolved: all.filter((c) => c.status === 'Resolved').length,
    thisMonthCount: thisMonth.length,
    thisMonthDowntime: Math.round(sumDowntime(thisMonth) * 100) / 100,
    totalDowntime: Math.round(sumDowntime(all) * 100) / 100
  };
}

/** Zones for the register filters: customer zones + known Shahdara zones, deduped. */
export function collectComplaintZones(state) {
  const known = ['Shahdara Town', 'Barrian', 'Palaliya', 'Chandall', 'Banii'];
  const zones = new Set(known);
  for (const customer of (state && Array.isArray(state.customers) ? state.customers : [])) {
    const zone = cleanText(customer?.zone);
    if (zone) zones.add(zone);
  }
  return [...zones].sort((a, b) => a.localeCompare(b));
}

/**
 * Wires the complaint register modal (dialog in index.html). Pure logic
 * lives above; this controller only renders and persists via load/save
 * + the app's onComplaintsChanged callback (dashboard + profile refresh).
 */
export function setupComplaintRegisterModal(getState, { onComplaintsChanged, onToast, getTicketLink, onAssignTicket, onLaunchOutageAlerts, getRootCauseAdvice, getFixCollect, onResolveAndCollect } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('complaintRegisterModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const filters = { month: '', status: '', customer: '', zone: '', category: '' };

  function customerOptions() {
    const state = getState() || { customers: [] };
    return (Array.isArray(state.customers) ? state.customers : [])
      .filter((c) => c && !c.archived)
      .map((c) => ({ id: c.id, label: `#${c.customerNumber ?? ''} ${c.name || ''}`.trim() }));
  }

  function refreshFilterSelects() {
    const state = getState() || { customers: [] };
    const zones = collectComplaintZones(state);
    const zoneFilter = $('complaintFilterZone');
    if (zoneFilter) {
      const prev = filters.zone;
      zoneFilter.innerHTML = '<option value="">All zones</option>' + zones.map((z) => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`).join('');
      zoneFilter.value = zones.includes(prev) ? prev : '';
      filters.zone = zoneFilter.value;
    }
    const customerFilter = $('complaintFilterCustomer');
    if (customerFilter) {
      const prev = filters.customer;
      customerFilter.innerHTML = '<option value="">All customers</option><option value="' + AREA_OUTAGE_CUSTOMER_ID + '">Area outage (zone-wide)</option>' + customerOptions().map((c) => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.label)}</option>`).join('');
      customerFilter.value = prev;
      filters.customer = customerFilter.value;
    }
    const zoneList = $('complaintZoneOptions');
    if (zoneList) zoneList.innerHTML = zones.map((z) => `<option value="${escapeHtml(z)}">`).join('');
    const addCustomer = $('complaintAddCustomer');
    if (addCustomer) {
      const prev = addCustomer.value;
      addCustomer.innerHTML = '<option value="">Select customer…</option><option value="' + AREA_OUTAGE_CUSTOMER_ID + '">Area outage (zone-wide fault)</option>' + customerOptions().map((c) => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.label)}</option>`).join('');
      if ([...addCustomer.options].some((o) => o.value === prev)) addCustomer.value = prev;
    }
  }

  function statusButtons(complaint, fixCollect = null) {
    // SISP-163: when the host reports money still due for this customer,
    // offer the combined Fix & Collect action next to the plain resolve.
    // The host performs resolve → Quick Collect (see app.js); without a
    // host callback the button never renders.
    const collectBtn = fixCollect && typeof onResolveAndCollect === 'function'
      ? `<button type="button" class="primary-button complaint-status-btn" data-complaint-action="resolve-collect" data-complaint-id="${escapeHtml(complaint.id)}">${escapeHtml(t('fcx_resolve_collect_btn'))}</button>`
      : '';
    if (complaint.status === 'Open') {
      return `<button type="button" class="secondary-button complaint-status-btn" data-complaint-action="start" data-complaint-id="${escapeHtml(complaint.id)}">Start work</button><button type="button" class="primary-button complaint-status-btn" data-complaint-action="resolve" data-complaint-id="${escapeHtml(complaint.id)}">Mark resolved</button>${collectBtn}`;
    }
    if (complaint.status === 'In Progress') {
      return `<button type="button" class="primary-button complaint-status-btn" data-complaint-action="resolve" data-complaint-id="${escapeHtml(complaint.id)}">Mark resolved</button>${collectBtn}<button type="button" class="secondary-button complaint-status-btn" data-complaint-action="reopen" data-complaint-id="${escapeHtml(complaint.id)}">Reopen</button>`;
    }
    return `<button type="button" class="secondary-button complaint-status-btn" data-complaint-action="reopen" data-complaint-id="${escapeHtml(complaint.id)}">Reopen</button>`;
  }

  function renderList() {
    const listEl = $('complaintRegisterList');
    if (!listEl) return;
    const rows = filterComplaints(loadComplaints(), filters);
    const summaryEl = $('complaintRegisterSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = rows.length === 0
        ? 'No complaints match these filters.'
        : `${rows.length} complaint${rows.length === 1 ? '' : 's'} · ${rows.filter((c) => c.status === 'Open').length} open · ${rows.filter((c) => c.status === 'In Progress').length} in progress · ${rows.filter((c) => c.status === 'Resolved').length} resolved`;
    }
    if (rows.length === 0) {
      listEl.innerHTML = '<p class="complaint-register-empty">No complaints recorded yet. Add the first one above.</p>';
      return;
    }
    const state = getState() || { customers: [] };
    const allCustomers = Array.isArray(state.customers) ? state.customers : [];
    // SISP-84: base order stays newest-reported first; the SLA pass
    // then pins open commercial_vip complaints to the top (stable —
    // residential and resolved rows keep their relative order).
    const sorted = sortQueueBySla(
      [...rows].sort((a, b) => String(b.reportedAt || '').localeCompare(String(a.reportedAt || ''))),
      allCustomers
    );
    listEl.innerHTML = sorted.map((c) => {
      // SISP-84: SLA badges — only while the complaint is open and its
      // customer is commercial_vip (derived live on every render).
      const slaBadges = isSlaPinned(c, allCustomers)
        ? `<span class="ticket-priority-badge ticket-priority-urgent">${escapeHtml(effectiveQueuePriority(c, allCustomers))}</span><span class="sla-vip-badge">${escapeHtml(t('sla_vip_badge'))}</span><span class="sla-badge">${escapeHtml(t('sla_hours_badge'))}</span>`
        : '';
      // SISP-49: daisy-chain alert banner — when this complaint's
      // customer feeds downstream homes, list every affected home and
      // offer the 1-tap bulk WhatsApp outage launch. Purely additive:
      // it renders from live data and never touches the record.
      // SISP-123: root-cause banner — when this complaint's category has
      // repeated for the customer within 60 days (register + standalone
      // tickets, SISP-44 pairs counted once), show the permanent-fix
      // prescription. Advice is derived by the host callback; without it
      // (or for area-outage rows) no banner renders. Read-only.
      const rcaBanner = c.customerId !== AREA_OUTAGE_CUSTOMER_ID && typeof getRootCauseAdvice === 'function'
        ? rootCauseBannerHtml((getRootCauseAdvice(c.customerId) || []).filter((entry) => entry.group === complaintFaultGroup(c)))
        : '';
      const chainAlert = complaintDaisyChainAlert(allCustomers, c);
      const chainBanner = chainAlert ? `
        <div class="complaint-chain-banner" role="alert">
          <div class="complaint-chain-title">⚡ ${escapeHtml(t('cmp_chain_title'))}</div>
          <p class="complaint-chain-body">${escapeHtml(t('cmp_chain_body', null, { count: chainAlert.count }))}</p>
          <ul class="complaint-chain-list">
            ${chainAlert.impacted.map((entry) => {
              const home = entry.customer;
              const meta = [cleanText(home.mohalla), cleanText(home.fiberZone)].filter(Boolean).join(' · ') || t('cmp_chain_no_area');
              return `<li><strong>${escapeHtml(cleanText(home.name) || 'Unknown')}</strong><span>${escapeHtml(meta)}</span></li>`;
            }).join('')}
          </ul>
          <button type="button" class="primary-button complaint-status-btn" data-complaint-action="notify-chain" data-complaint-id="${escapeHtml(c.id)}">${escapeHtml(t('cmp_chain_notify_btn'))}</button>
        </div>` : '';
      // SISP-44: linked-ticket line, or the 1-click assign controls when
      // no ticket is linked yet (host callbacks supplied by app.js).
      const link = typeof getTicketLink === 'function' ? getTicketLink(c.id) : null;
      const ticketLine = link
        ? `<p><span>${escapeHtml(t('cmp_link_ticket_label'))}</span><strong>${escapeHtml(link.id)} · ${escapeHtml(link.status)}</strong></p>`
        : '';
      // Assign stays available when the only linked ticket is already
      // resolved: idempotency reuses open/in-progress tickets only, so
      // a resolved link must never block a fresh ticket for the same
      // complaint (assignTicketForComplaint creates a new one then).
      const assignControls = (!link || link.status === 'Resolved') && typeof onAssignTicket === 'function'
        ? `<input class="form-input complaint-assign-input" type="text" data-assign-technician="${escapeHtml(c.id)}" placeholder="${escapeHtml(t('cmp_link_technician_ph'))}" aria-label="${escapeHtml(t('cmp_link_technician_ph'))}"><button type="button" class="secondary-button complaint-status-btn" data-complaint-action="assign" data-complaint-id="${escapeHtml(c.id)}">${escapeHtml(t('cmp_link_assign_btn'))}</button>`
        : '';
      // SISP-163: Fix & Collect badge — the host derives the customer's
      // outstanding from the billing engine; the badge renders only for
      // an unresolved complaint whose customer still owes money.
      const fixCollect = c.status !== 'Resolved' && typeof getFixCollect === 'function'
        ? getFixCollect(c.customerId)
        : null;
      const fixBadge = fixCollect && fixCollect.badgeHtml
        ? `<p class="complaint-fix-collect-row">${fixCollect.badgeHtml}</p>`
        : '';
      return `
      <article class="complaint-register-card" data-complaint-id="${escapeHtml(c.id)}">
        <header class="complaint-register-head">
          <strong>${escapeHtml(c.id)}</strong>
          <span class="complaint-status-badge complaint-status-${c.status === 'Resolved' ? 'resolved' : c.status === 'In Progress' ? 'progress' : 'open'}">${escapeHtml(c.status)}</span>
          ${slaBadges}
        </header>
        <p><span>Customer</span><strong>${escapeHtml(complaintCustomerLabel(c))}</strong></p>
        <p><span>Zone</span><strong>${escapeHtml(c.zone || 'Not set')}</strong></p>
        <p><span>Issue</span><strong>${escapeHtml(c.issueCategory)}</strong></p>
        ${fixBadge}
        ${chainBanner}
        ${rcaBanner}
        ${ticketLine}
        <p><span>Reported</span><input class="form-input complaint-inline-input" type="datetime-local" data-complaint-field="reportedAt" data-complaint-id="${escapeHtml(c.id)}" value="${escapeHtml(c.reportedAt || '')}" aria-label="Reported at"></p>
        <p><span>Resolved</span><input class="form-input complaint-inline-input" type="datetime-local" data-complaint-field="resolvedAt" data-complaint-id="${escapeHtml(c.id)}" value="${escapeHtml(c.resolvedAt || '')}" aria-label="Resolved at" ${c.status !== 'Resolved' ? 'disabled' : ''}></p>
        <p><span>Downtime</span><span class="complaint-downtime-wrap"><input class="form-input complaint-inline-input complaint-downtime-input" type="number" min="0" step="0.25" data-complaint-field="downtimeHours" data-complaint-id="${escapeHtml(c.id)}" value="${c.downtimeHours === null || c.downtimeHours === undefined ? '' : escapeHtml(String(c.downtimeHours))}" placeholder="auto" aria-label="Downtime hours"><small>h${c.downtimeManual ? ' (manual)' : ''}</small></span></p>
        <p><span>Fix note</span><input class="form-input complaint-inline-input" type="text" data-complaint-field="resolutionNote" data-complaint-id="${escapeHtml(c.id)}" value="${escapeHtml(c.resolutionNote || '')}" placeholder="Permanent fix…" aria-label="Resolution note"></p>
        <p><span>${escapeHtml(t('cmp_resolved_by_label'))}</span><input class="form-input complaint-inline-input" type="text" data-complaint-field="resolvedByLineman" data-complaint-id="${escapeHtml(c.id)}" value="${escapeHtml(c.resolvedByLineman || '')}" placeholder="—" aria-label="${escapeHtml(t('cmp_resolved_by_label'))}"></p>
        <div class="complaint-register-actions">${statusButtons(c, fixCollect)}${assignControls}</div>
      </article>`;
    }).join('');
  }

  function persist(next) {
    saveComplaints(next);
    if (onComplaintsChanged) onComplaintsChanged(next);
  }

  function renderAll() {
    refreshFilterSelects();
    renderList();
  }

  const filterIds = {
    month: 'complaintFilterMonth',
    status: 'complaintFilterStatus',
    customer: 'complaintFilterCustomer',
    zone: 'complaintFilterZone',
    category: 'complaintFilterCategory'
  };
  for (const [key, id] of Object.entries(filterIds)) {
    const el = $(id);
    if (el) el.addEventListener('change', () => { filters[key] = el.value || ''; renderList(); });
  }
  const clearBtn = $('complaintFilterClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    Object.assign(filters, { month: '', status: '', customer: '', zone: '', category: '' });
    for (const [key, id] of Object.entries(filterIds)) {
      const el = $(id);
      if (el) el.value = '';
    }
    renderList();
  });

  const addForm = $('complaintAddForm');
  if (addForm) addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = getState() || { customers: [] };
    const customerId = $('complaintAddCustomer')?.value || '';
    if (!customerId) { onToast && onToast('Select a customer or area outage first.'); return; }
    const customer = (Array.isArray(state.customers) ? state.customers : []).find((c) => String(c.id) === String(customerId));
    try {
      const next = [...loadComplaints(), createComplaint({
        customerId,
        customerName: customer ? customer.name : '',
        zone: $('complaintAddZone')?.value || (customer ? customer.zone : ''),
        issueCategory: $('complaintAddCategory')?.value || '',
        reportedAt: $('complaintAddReportedAt')?.value || '',
        // SISP-84: a commercial_vip customer's complaint is born Urgent.
        priority: priorityForNewQueueItem(customer),
        resolutionNote: $('complaintAddNote')?.value || ''
      }, loadComplaints())];
      persist(next);
      onToast && onToast(`Complaint ${next[next.length - 1].id} recorded.`);
      addForm.reset();
      const reportedInput = $('complaintAddReportedAt');
      if (reportedInput) reportedInput.value = pakistanDateTimeNow();
      renderList();
    } catch (error) {
      onToast && onToast(error && error.message ? error.message : 'Complaint could not be recorded.');
    }
  });

  const listEl = $('complaintRegisterList');
  if (listEl) {
    listEl.addEventListener('click', (event) => {
      const btn = event.target.closest('.complaint-status-btn');
      if (!btn) return;
      const id = btn.dataset.complaintId;
      const action = btn.dataset.complaintAction;
      if (action === 'notify-chain') {
        // SISP-49: 1-tap launch of the bulk WhatsApp outage
        // notifications for this complaint's downstream homes. The host
        // opens the SISP-7 outage tool prefilled with the feeder
        // customer; without a host callback, fall back to copying the
        // ready-to-send message list so the button never dead-ends.
        const complaint = loadComplaints().find((c) => c.id === id);
        if (!complaint) return;
        if (typeof onLaunchOutageAlerts === 'function') {
          onLaunchOutageAlerts(complaint.customerId, id);
          return;
        }
        const st = getState() || { customers: [] };
        const queue = buildOutageQueue(Array.isArray(st.customers) ? st.customers : [], complaint.customerId, { templates: getWaTemplates() });
        const text = buildOutageQueueText(queue);
        (async () => {
          try {
            await navigator.clipboard.writeText(text);
            onToast && onToast(t('cmp_chain_copied_toast', null, { count: queue ? queue.impacted.length : 0 }));
          } catch {
            onToast && onToast(t('cmp_chain_copy_failed_toast'));
          }
        })();
        return;
      }
      if (action === 'assign') {
        // SISP-44: 1-click "Assign Lineman Ticket" — the host (app.js)
        // creates the linked ticket via complaint-ticket-sync.js.
        const input = listEl.querySelector(`[data-assign-technician="${CSS.escape(id)}"]`);
        const technician = input ? input.value.trim() : '';
        if (!technician) { onToast && onToast(t('cmp_link_technician_required')); return; }
        try {
          const result = typeof onAssignTicket === 'function' ? onAssignTicket(id, technician) : null;
          if (result && result.ticket) {
            onToast && onToast(result.created
              ? t('cmp_link_assigned_toast', null, { ticket: result.ticket.id, complaint: id })
              : t('cmp_link_exists_toast', null, { ticket: result.ticket.id, complaint: id }));
          }
          renderList();
        } catch (error) {
          onToast && onToast(error && error.message ? error.message : 'Ticket could not be assigned.');
        }
        return;
      }
      if (action === 'resolve-collect') {
        // SISP-163: the host runs the combined flow (resolve through the
        // normal status path incl. the complaint↔ticket sync + stock
        // bridges, then open Quick Collect). It returns a promise: a
        // rejection means the RESOLVE failed, so no collection was
        // opened and the complaint stays open. A skipped collection
        // never reaches here — it cannot un-resolve.
        const complaint = loadComplaints().find((c) => c.id === id);
        if (!complaint || typeof onResolveAndCollect !== 'function') return;
        Promise.resolve()
          .then(() => onResolveAndCollect(complaint))
          .then(() => renderList())
          .catch((error) => {
            onToast && onToast(error && error.message ? error.message : t('fcx_resolve_collect_failed'));
            renderList();
          });
        return;
      }
      try {
        let next;
        if (action === 'resolve') {
          // SISP-173: capture the card's "Resolved by" name with the
          // resolve itself, so attribution never needs a second save.
          const card = listEl.querySelector(`article[data-complaint-id="${CSS.escape(id)}"]`);
          const byInput = card ? card.querySelector('[data-complaint-field="resolvedByLineman"]') : null;
          next = setComplaintStatus(loadComplaints(), id, 'Resolved', byInput ? { resolvedByLineman: byInput.value } : {});
        }
        else if (action === 'start') next = setComplaintStatus(loadComplaints(), id, 'In Progress');
        else if (action === 'reopen') next = setComplaintStatus(loadComplaints(), id, 'Open');
        else return;
        persist(next);
        const entry = next.find((c) => c.id === id);
        onToast && onToast(action === 'resolve'
          ? `Complaint ${id} resolved — downtime ${formatDowntimeHours(entry ? entry.downtimeHours : null)}.`
          : action === 'start' ? `Complaint ${id} in progress.` : `Complaint ${id} reopened.`);
        renderList();
      } catch (error) {
        onToast && onToast(error && error.message ? error.message : 'Status could not be changed.');
      }
    });
    listEl.addEventListener('change', (event) => {
      const input = event.target.closest('.complaint-inline-input');
      if (!input) return;
      const id = input.dataset.complaintId;
      const field = input.dataset.complaintField;
      try {
        const patch = { [field]: input.value };
        const next = updateComplaint(loadComplaints(), id, patch);
        saveComplaints(next);
        if (onComplaintsChanged) onComplaintsChanged(next);
        // Refresh only the downtime display of this card so auto-recomputed
        // values show without losing the user's edit focus.
        const card = listEl.querySelector(`article[data-complaint-id="${CSS.escape(id)}"]`);
        const entry = next.find((c) => c.id === id);
        if (card && entry && field !== 'downtimeHours') {
          const downtimeInput = card.querySelector('.complaint-downtime-input');
          if (downtimeInput && document.activeElement !== downtimeInput) {
            downtimeInput.value = entry.downtimeHours === null || entry.downtimeHours === undefined ? '' : String(entry.downtimeHours);
          }
        }
      } catch (error) {
        onToast && onToast(error && error.message ? error.message : 'Edit could not be saved.');
      }
    });
  }

  const closeBtn = $('complaintRegisterCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openComplaintRegisterModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    Object.assign(filters, { month: '', status: '', customer: '', zone: '', category: '' });
    for (const [key, id] of Object.entries(filterIds)) {
      const el = $(id);
      if (el) el.value = '';
    }
    renderAll();
    dialog.showModal();
  });

  return {
    open(prefilter = {}) {
      Object.assign(filters, { month: '', status: '', customer: '', zone: '', category: '' }, prefilter);
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
