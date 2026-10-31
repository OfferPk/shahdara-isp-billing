/**
 * storm-inspection.js — SISP-109: Post-Storm / Heavy Rain Feeder & Upstream
 * Node Inspection Checklist.
 *
 * After a storm or a night of heavy rain the owner walks the plant and
 * checks the points whose failure hurts the most homes: the main feeder
 * nodes (heads of the Ethernet daisy chains), the street splitter boxes,
 * and the upstream homes that feed several neighbours through their media
 * converter. This module generates that walk as a zone-by-zone checklist
 * from the topology the app already records — nothing here invents plant.
 *
 * Sources (all pre-existing, all read-only for the checklist):
 * - Feeder / upstream topology: the PR #413 daisy-chain fields on the
 *   customer record (upstreamCustomerId), traversed with outage-impact.js
 *   (normalizeFeederFields + traceDownstreamImpact — the same BFS the
 *   outage simulator uses, so the counts can never drift between tools).
 *   A "feeder node" is an active customer with NO upstream of its own
 *   feeding at least 1 downstream home; a critical "upstream home" is an
 *   active customer WITH an upstream feeding at least 2 downstream homes
 *   (transitive, archived homes traversed through but never counted —
 *   exactly traceDownstreamImpact's impacted list).
 * - Splitter boxes: splitter-map.js buildSplitterBoxes, derived from the
 *   splitterBoxId / splitterPort fields on customer records (the spec's
 *   "DB-01+" boxes are whatever ids the operator recorded there — this
 *   module hardcodes no box id). A box joins the checklist only when at
 *   least one ACTIVE customer is assigned to it; its zone and its ticket
 *   anchor come from its first active assigned customer in roster order.
 * - Zones: canonicalMohalla (phase3.js) of the customer / anchor, so
 *   "MOHALLA BANI", "Bani" and "BANII" land in one zone. Items with no
 *   recorded mohalla fall into one trailing "Area not set" zone.
 *
 * Ranking inside a zone (spec pin first): customer-homed nodes by
 * descending downstream customer count (ties: feeder nodes before
 * upstream homes, then name, then id), then splitter boxes by box id.
 * Zones sort by label; the unset zone is always last.
 *
 * Check state: one inspection RUN per calendar date (Pakistan time),
 * stored under STORM_INSPECTIONS_KEY as { runs: [{ date, startedAt,
 * checks: { [itemKey]: { status: 'ok' | 'ticket', ticketId, at } } }] }.
 * Ticks persist across app restarts (field work outlives a browser
 * session), travel in JSON backups as settings.stormInspections under
 * the SISP-37 safe-merge rule (see core.js), and a NEW date always
 * starts from an empty checks map — yesterday's ticks are never
 * inherited silently; they stay readable in their own dated run (the
 * newest STORM_RUNS_KEPT runs are retained). The checklist itself writes
 * nothing else: the only other write is the owner's explicit ticket.
 *
 * Tickets: 🔴 Create Ticket converts an item into a REAL SISP-12 field
 * ticket through complaint-tickets.js createTicket. The ticket's note
 * carries a stable marker, [storm:<itemKey>]; while an unresolved ticket
 * with that marker exists, re-tapping returns it instead of duplicating
 * (the SISP-66 attenuation-ticket dedupe rule). Tickets are customer-
 * bound by design, so a splitter box anchors on its first active
 * assigned customer and the note names the box. Priority: 'Urgent' for
 * splitter boxes and for nodes feeding 2+ homes (shared plant), else
 * 'Normal'. 🟢 Checked OK records no ticket and touches no record
 * besides the run's own check entry.
 *
 * Resolved spec ambiguities (stated, not hidden):
 * - The spec's file guide names fiber-splitter-map.js; on main the
 *   splitter module is splitter-map.js, used here.
 * - The spec names feeder nodes without a registry on main (the SISP-62
 *   UPS node registry is not part of this base), so feeder nodes are the
 *   daisy-chain roots described above — the only feeder-node concept the
 *   shipped data supports. Nothing is read from storage keys this base
 *   never writes.
 * - No fault is presumed: tickets use a custom fault text ("Post-storm
 *   inspection — needs repair"), never a preset diagnosis.
 *
 * Tests use synthetic data only.
 */

import { normalizeFeederFields, traceDownstreamImpact } from './outage-impact.js';
import { buildSplitterBoxes } from './splitter-map.js';
import { canonicalMohalla } from './phase3.js';
import {
  createTicket, loadTickets, pakistanTicketDateTimeNow, saveTickets, sanitizeTickets
} from './complaint-tickets.js';
import { t } from './nav-language.js';

export const STORM_INSPECTIONS_KEY = 'sisp_storm_inspections_v1';

/** Only the newest this many dated runs are kept in storage / backups. */
export const STORM_RUNS_KEPT = 7;

/** An upstream home is "critical" at this many downstream homes or more. */
export const STORM_MIN_UPSTREAM_DOWNSTREAM = 2;

/** Zone key for items whose mohalla was never recorded. */
export const STORM_UNSET_ZONE_KEY = '__unset__';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TICKET_ID_RE = /^TKT-\d+$/;
const ITEM_KEY_RE = /^(feeder|home|splitter):.+$/;

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

function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/* ------------------------------------------------------------------ */
/* Checklist generation (pure, read-only)                              */
/* ------------------------------------------------------------------ */

function zoneOfMohalla(mohallaRaw) {
  const canon = canonicalMohalla(mohallaRaw);
  return canon
    ? { key: canon.key, label: canon.label }
    : { key: STORM_UNSET_ZONE_KEY, label: '' };
}

function nodeCompare(a, b) {
  return (b.downstreamCount - a.downstreamCount)
    || (a.kind === b.kind ? 0 : a.kind === 'feeder' ? -1 : 1)
    || a.label.localeCompare(b.label)
    || String(a.customerId).localeCompare(String(b.customerId));
}

function zoneCompare(a, b) {
  if (a.key === STORM_UNSET_ZONE_KEY) return 1;
  if (b.key === STORM_UNSET_ZONE_KEY) return -1;
  return a.label.localeCompare(b.label) || a.key.localeCompare(b.key);
}

/** Stable dedupe marker carried in a storm ticket's note. */
export function stormTicketMarker(itemKey) {
  return `[storm:${itemKey}]`;
}

/** The unresolved storm ticket already raised for one item, if any. */
export function findOpenStormTicket(tickets, itemKey) {
  const marker = stormTicketMarker(itemKey);
  return sanitizeTickets(tickets)
    .find((ticket) => ticket.status !== 'Resolved' && String(ticket.note || '').includes(marker)) ?? null;
}

/**
 * Build the zone-by-zone post-storm checklist from recorded topology.
 * Pure and read-only: no record is created, stamped or mutated; the
 * optional tickets array is only read to annotate items that already
 * have an unresolved storm ticket (openTicketId).
 */
export function buildStormChecklist(customers, { tickets = [] } = {}) {
  const list = Array.isArray(customers) ? customers : [];
  const byId = new Map();
  for (const customer of list) {
    if (customer && customer.id !== null && customer.id !== undefined) byId.set(String(customer.id), customer);
  }
  const items = [];

  for (const customer of list) {
    if (!customer || customer.archived) continue;
    const feeder = normalizeFeederFields(customer);
    const downstreamCount = traceDownstreamImpact(list, customer.id).length;
    let kind = null;
    if (!feeder.upstreamCustomerId && downstreamCount >= 1) kind = 'feeder';
    else if (feeder.upstreamCustomerId && downstreamCount >= STORM_MIN_UPSTREAM_DOWNSTREAM) kind = 'home';
    if (!kind) continue;
    const zone = zoneOfMohalla(customer.mohalla);
    items.push({
      key: `${kind}:${String(customer.id)}`,
      kind,
      customerId: String(customer.id),
      customerName: cleanText(customer.name),
      customerNumber: Number.isSafeInteger(customer.customerNumber) ? customer.customerNumber : null,
      label: cleanText(customer.name) || String(customer.id),
      fiberZone: feeder.fiberZone || '',
      downstreamCount,
      boxId: '',
      portCount: null,
      occupiedCount: null,
      activeAssignedCount: null,
      zoneKey: zone.key,
      zoneLabel: zone.label,
      openTicketId: ''
    });
  }

  for (const box of buildSplitterBoxes(list)) {
    const assignedIds = [];
    for (const slot of box.ports) {
      if (slot.status === 'occupied' && slot.customerId !== null && slot.customerId !== undefined) {
        assignedIds.push(String(slot.customerId));
      }
    }
    for (const entry of box.outOfRange) {
      if (entry.customerId !== null && entry.customerId !== undefined) assignedIds.push(String(entry.customerId));
    }
    const activeAssigned = assignedIds
      .map((id) => byId.get(id))
      .filter((customer) => customer && !customer.archived);
    if (!activeAssigned.length) continue;
    const anchor = activeAssigned[0];
    const zone = zoneOfMohalla(anchor.mohalla);
    items.push({
      key: `splitter:${box.boxId}`,
      kind: 'splitter',
      customerId: String(anchor.id),
      customerName: cleanText(anchor.name),
      customerNumber: Number.isSafeInteger(anchor.customerNumber) ? anchor.customerNumber : null,
      label: box.boxId,
      fiberZone: '',
      downstreamCount: null,
      boxId: box.boxId,
      portCount: box.portCount,
      occupiedCount: box.occupiedCount,
      activeAssignedCount: activeAssigned.length,
      zoneKey: zone.key,
      zoneLabel: zone.label,
      openTicketId: ''
    });
  }

  const cleanTickets = sanitizeTickets(tickets);
  for (const item of items) {
    const open = findOpenStormTicket(cleanTickets, item.key);
    item.openTicketId = open ? open.id : '';
  }

  const zoneMap = new Map();
  for (const item of items) {
    if (!zoneMap.has(item.zoneKey)) zoneMap.set(item.zoneKey, { key: item.zoneKey, label: item.zoneLabel, items: [] });
    zoneMap.get(item.zoneKey).items.push(item);
  }
  const zones = [...zoneMap.values()].map((zone) => {
    const nodes = zone.items.filter((item) => item.kind !== 'splitter').sort(nodeCompare);
    const boxes = zone.items
      .filter((item) => item.kind === 'splitter')
      .sort((a, b) => a.boxId.localeCompare(b.boxId, undefined, { numeric: true }));
    return { key: zone.key, label: zone.label, items: [...nodes, ...boxes] };
  }).sort(zoneCompare);

  return {
    zones,
    totalItems: items.length,
    nodeCount: items.filter((item) => item.kind !== 'splitter').length,
    boxCount: items.filter((item) => item.kind === 'splitter').length
  };
}

/* ------------------------------------------------------------------ */
/* Ticket conversion (the only outward write, owner-triggered)         */
/* ------------------------------------------------------------------ */

/** Shared plant (boxes, multi-home nodes) is urgent; a 1-home feeder is not. */
export function stormTicketPriority(item) {
  if (!item) return 'Normal';
  if (item.kind === 'splitter') return 'Urgent';
  return (item.downstreamCount ?? 0) >= STORM_MIN_UPSTREAM_DOWNSTREAM ? 'Urgent' : 'Normal';
}

function stormTicketNote(item, dateStr) {
  const who = item.customerNumber !== null && item.customerNumber !== undefined
    ? `${item.customerName || item.customerId} (#${item.customerNumber})`
    : (item.customerName || item.customerId);
  const detail = item.kind === 'splitter'
    ? `splitter box ${item.boxId} (ticket anchored on ${who})`
    : item.kind === 'feeder'
      ? `feeder node ${who} — feeds ${item.downstreamCount} home${item.downstreamCount === 1 ? '' : 's'} downstream`
      : `upstream home ${who} — feeds ${item.downstreamCount} homes downstream`;
  return `Post-storm inspection ${dateStr}: ${detail} ${stormTicketMarker(item.key)}`;
}

/**
 * Convert one checklist item into a real field ticket. Returns
 * { tickets, ticket, created } — created is false (and tickets is the
 * unchanged sanitized list) when an unresolved storm ticket for this
 * item already exists, so a repeat tap can never duplicate the repair.
 * Technician is required by createTicket and enforced there.
 */
export function createStormRepairTicket(tickets, item, { technician, referenceDate = new Date() } = {}) {
  const clean = sanitizeTickets(tickets);
  if (!item || typeof item.key !== 'string' || !ITEM_KEY_RE.test(item.key)) {
    throw new Error('Checklist item not found.');
  }
  const existing = findOpenStormTicket(clean, item.key);
  if (existing) return { tickets: clean, ticket: existing, created: false };
  const dateStr = pakistanTicketDateTimeNow(referenceDate).slice(0, 10);
  const ticket = createTicket({
    customerId: item.customerId,
    customerName: item.customerName || '',
    customFault: 'Post-storm inspection — needs repair',
    technician,
    priority: stormTicketPriority(item),
    note: stormTicketNote(item, dateStr)
  }, clean, referenceDate);
  return { tickets: [...clean, ticket], ticket, created: true };
}

/* ------------------------------------------------------------------ */
/* Inspection run state (one run per date, persisted, backup-wired)    */
/* ------------------------------------------------------------------ */

/**
 * Drops malformed runs/checks; keeps at most the newest
 * STORM_RUNS_KEPT dated runs. A 'ticket' check survives only with a
 * well-formed ticket id; an 'ok' check never carries one.
 */
export function sanitizeStormInspections(value) {
  const runsIn = (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.runs))
    ? value.runs
    : [];
  const byDate = new Map();
  for (const run of runsIn) {
    if (!run || typeof run !== 'object' || !isValidDateKey(run.date)) continue;
    const checks = {};
    const rawChecks = (run.checks && typeof run.checks === 'object' && !Array.isArray(run.checks)) ? run.checks : {};
    for (const [itemKey, check] of Object.entries(rawChecks)) {
      if (!ITEM_KEY_RE.test(itemKey) || !check || typeof check !== 'object') continue;
      const at = typeof check.at === 'string' ? check.at : '';
      if (check.status === 'ok') {
        checks[itemKey] = { status: 'ok', ticketId: '', at };
      } else if (check.status === 'ticket' && TICKET_ID_RE.test(String(check.ticketId || ''))) {
        checks[itemKey] = { status: 'ticket', ticketId: String(check.ticketId), at };
      }
    }
    byDate.set(run.date, {
      date: run.date,
      startedAt: typeof run.startedAt === 'string' ? run.startedAt : '',
      checks
    });
  }
  const runs = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-STORM_RUNS_KEPT);
  return { runs };
}

export function loadStormInspections(storage) {
  try {
    const raw = (storage || (typeof localStorage !== 'undefined' ? localStorage : null))?.getItem(STORM_INSPECTIONS_KEY);
    if (!raw) return { runs: [] };
    return sanitizeStormInspections(JSON.parse(raw));
  } catch {
    return { runs: [] };
  }
}

export function saveStormInspections(data, storage) {
  const target = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!target) return;
  target.setItem(STORM_INSPECTIONS_KEY, JSON.stringify(sanitizeStormInspections(data)));
}

/** The run stored for one date, or null when that date has no run yet. */
export function stormRunForDate(data, dateStr) {
  if (!isValidDateKey(dateStr)) return null;
  return sanitizeStormInspections(data).runs.find((run) => run.date === dateStr) ?? null;
}

/**
 * Returns sanitized data guaranteed to hold a run for dateStr. A brand
 * new run starts with an EMPTY checks map — a previous date's ticks are
 * never carried into it.
 */
export function ensureStormRun(data, dateStr, nowIso = '') {
  const clean = sanitizeStormInspections(data);
  if (!isValidDateKey(dateStr)) return clean;
  if (clean.runs.some((run) => run.date === dateStr)) return clean;
  const runs = [...clean.runs, { date: dateStr, startedAt: typeof nowIso === 'string' ? nowIso : '', checks: {} }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-STORM_RUNS_KEPT);
  return { runs };
}

/** Record (or replace) one item's check inside a date's run. Pure. */
export function recordStormCheck(data, dateStr, itemKey, check, nowIso = '') {
  if (!ITEM_KEY_RE.test(String(itemKey || ''))) return sanitizeStormInspections(data);
  const withRun = ensureStormRun(data, dateStr, nowIso);
  const at = (check && typeof check.at === 'string' && check.at) ? check.at : (typeof nowIso === 'string' ? nowIso : '');
  const entry = check && check.status === 'ticket' && TICKET_ID_RE.test(String(check.ticketId || ''))
    ? { status: 'ticket', ticketId: String(check.ticketId), at }
    : { status: 'ok', ticketId: '', at };
  return {
    runs: withRun.runs.map((run) => (run.date === dateStr
      ? { ...run, checks: { ...run.checks, [itemKey]: entry } }
      : run))
  };
}

/** Remove one item's check from a date's run (undo). Pure. */
export function clearStormCheck(data, dateStr, itemKey) {
  const clean = sanitizeStormInspections(data);
  return {
    runs: clean.runs.map((run) => {
      if (run.date !== dateStr) return run;
      const checks = { ...run.checks };
      delete checks[itemKey];
      return { ...run, checks };
    })
  };
}

/** One item's recorded check in a date's run, or null. */
export function stormCheckForItem(data, dateStr, itemKey) {
  const run = stormRunForDate(data, dateStr);
  return run?.checks?.[itemKey] ?? null;
}

/* ------------------------------------------------------------------ */
/* Modal controller                                                    */
/* ------------------------------------------------------------------ */

/**
 * Modal controller following the outage-impact pattern: open (or the
 * Generate button) rebuilds the checklist from live state, each row
 * carries its run state, and the two 1-tap actions write only what the
 * owner tapped — a check into today's run, or a real ticket through
 * createStormRepairTicket + saveTickets. Returns null when the dialog
 * is absent (or in Node, where there is no document).
 */
export function setupStormInspectionModal(getState, { onToast } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('stormInspectionModal');
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let itemsByKey = new Map();

  function todayStr() {
    return pakistanTicketDateTimeNow(new Date()).slice(0, 10);
  }

  function customers() {
    const state = typeof getState === 'function' ? getState() : getState;
    return state?.customers ?? [];
  }

  function kindLabel(item) {
    return t(item.kind === 'feeder'
      ? 'storm_kind_feeder'
      : item.kind === 'home'
        ? 'storm_kind_home'
        : 'storm_kind_splitter');
  }

  function renderCard(item, run) {
    const check = run?.checks?.[item.key] ?? null;
    const rows = [`<p><span>${escapeHtml(t('storm_label_type'))}</span><strong>${escapeHtml(kindLabel(item))}</strong></p>`];
    if (item.kind === 'splitter') {
      rows.push(`<p><span>${escapeHtml(t('storm_label_box'))}</span><strong>${escapeHtml(item.boxId)}</strong></p>`);
      rows.push(`<p><span>${escapeHtml(t('storm_label_ports'))}</span><strong>${escapeHtml(t('storm_ports_value', null, { used: item.occupiedCount, total: item.portCount }))}</strong></p>`);
    } else {
      const house = item.customerNumber !== null
        ? `${item.customerName || item.customerId} (#${item.customerNumber})`
        : (item.customerName || item.customerId);
      rows.push(`<p><span>${escapeHtml(t('storm_label_house'))}</span><strong>${escapeHtml(house)}</strong></p>`);
      rows.push(`<p><span>${escapeHtml(t('storm_label_downstream'))}</span><strong>${item.downstreamCount}</strong></p>`);
      if (item.fiberZone) {
        rows.push(`<p><span>${escapeHtml(t('storm_label_feeder_zone'))}</span><strong>${escapeHtml(item.fiberZone)}</strong></p>`);
      }
    }
    let stateHtml = '';
    if (check?.status === 'ok') {
      stateHtml = `<span class="safety-badge badge-healthy">${escapeHtml(t('storm_state_ok'))}</span>`
        + `<button type="button" class="secondary-button" data-storm-action="undo" data-storm-key="${escapeHtml(item.key)}">${escapeHtml(t('storm_undo'))}</button>`;
    } else if (check?.status === 'ticket') {
      stateHtml = `<span class="safety-badge badge-danger">${escapeHtml(t('storm_state_ticket', null, { ticketId: check.ticketId }))}</span>`;
    } else if (item.openTicketId) {
      stateHtml = `<span class="safety-badge badge-danger">${escapeHtml(t('storm_state_ticket_open', null, { ticketId: item.openTicketId }))}</span>`;
    } else {
      stateHtml = `<button type="button" class="secondary-button" data-storm-action="ok" data-storm-key="${escapeHtml(item.key)}">${escapeHtml(t('storm_btn_ok'))}</button>`
        + `<button type="button" class="secondary-button" data-storm-action="ticket" data-storm-key="${escapeHtml(item.key)}">${escapeHtml(t('storm_btn_ticket'))}</button>`;
    }
    return `<article class="storm-inspection-card">${rows.join('')}<div class="storm-inspection-actions">${stateHtml}</div></article>`;
  }

  function render() {
    const dateStr = todayStr();
    let data = loadStormInspections();
    if (!stormRunForDate(data, dateStr)) {
      data = ensureStormRun(data, dateStr, new Date().toISOString());
      saveStormInspections(data);
    }
    const run = stormRunForDate(data, dateStr);
    const checklist = buildStormChecklist(customers(), { tickets: loadTickets() });
    itemsByKey = new Map();
    for (const zone of checklist.zones) for (const item of zone.items) itemsByKey.set(item.key, item);

    const handled = checklist.zones.reduce((sum, zone) => sum + zone.items.filter((item) => {
      const check = run?.checks?.[item.key];
      return check || item.openTicketId;
    }).length, 0);
    const metaEl = $('stormRunMeta');
    if (metaEl) {
      metaEl.textContent = t('storm_run_meta', null, { date: dateStr, done: handled, total: checklist.totalItems });
    }
    const summaryEl = $('stormSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = checklist.totalItems === 0
        ? ''
        : handled === checklist.totalItems
          ? t('storm_all_done')
          : t('storm_summary_line', null, { total: checklist.totalItems, zones: checklist.zones.length });
    }
    const listEl = $('stormChecklist');
    if (listEl) {
      listEl.innerHTML = checklist.totalItems === 0
        ? `<p class="storm-inspection-empty">${escapeHtml(t('storm_empty'))}</p>`
        : checklist.zones.map((zone) => {
          const heading = zone.key === STORM_UNSET_ZONE_KEY
            ? t('storm_zone_unset')
            : (zone.label || t('storm_zone_unset'));
          return `<section class="storm-inspection-zone"><h3>${escapeHtml(heading)} · ${zone.items.length}</h3>`
            + `<div class="storm-inspection-cards">${zone.items.map((item) => renderCard(item, run)).join('')}</div></section>`;
        }).join('');
    }
  }

  const listEl = $('stormChecklist');
  if (listEl) {
    listEl.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-storm-action]');
      if (!button) return;
      const item = itemsByKey.get(button.getAttribute('data-storm-key'));
      if (!item) return;
      const dateStr = todayStr();
      const action = button.getAttribute('data-storm-action');
      if (action === 'ok') {
        const next = recordStormCheck(loadStormInspections(), dateStr, item.key, { status: 'ok' }, new Date().toISOString());
        saveStormInspections(next);
        if (onToast) onToast(t('storm_toast_ok', null, { label: item.label }));
        render();
        return;
      }
      if (action === 'undo') {
        saveStormInspections(clearStormCheck(loadStormInspections(), dateStr, item.key));
        render();
        return;
      }
      if (action === 'ticket') {
        const technicianInput = $('stormTechnician');
        const technician = technicianInput ? technicianInput.value.trim() : '';
        if (!technician) {
          if (onToast) onToast(t('storm_technician_required'));
          if (technicianInput) technicianInput.focus();
          return;
        }
        try {
          const result = createStormRepairTicket(loadTickets(), item, { technician, referenceDate: new Date() });
          if (result.created) saveTickets(result.tickets);
          const next = recordStormCheck(
            loadStormInspections(), dateStr, item.key,
            { status: 'ticket', ticketId: result.ticket.id }, new Date().toISOString()
          );
          saveStormInspections(next);
          if (onToast) {
            onToast(result.created
              ? t('storm_toast_ticket_created', null, { ticketId: result.ticket.id, label: item.label })
              : t('storm_toast_ticket_exists', null, { ticketId: result.ticket.id, label: item.label }));
          }
        } catch (error) {
          if (onToast) onToast(error?.message || t('storm_technician_required'));
        }
        render();
      }
    });
  }
  const generateBtn = $('stormGenerateBtn');
  if (generateBtn) generateBtn.addEventListener('click', () => render());
  const closeBtn = $('stormInspectionCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = document.getElementById('openStormInspectionModalBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      render();
      dialog.showModal();
    });
  }

  return {
    open() {
      render();
      dialog.showModal();
    },
    refresh() {
      render();
    }
  };
}
