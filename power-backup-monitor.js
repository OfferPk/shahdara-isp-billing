/**
 * power-backup-monitor.js — SISP-62: OLT / Feeder UPS Battery Runtime &
 * WAPDA Outage Timer.
 *
 * When WAPDA power goes, the whole network runs on UPS batteries: the
 * main OLT and the active street switches each have a rated backup time,
 * and when a battery dies the areas it feeds go dark. Before SISP-62 the
 * operator tracked "bijli kab gayi, battery kitni bachi" in his head —
 * no timer, no record, and the area outage only reached the SISP-15
 * Complaint Register if somebody remembered to log it.
 *
 * This module is the registry + timer:
 *   { nodeId (UPS-101+), name, kind ('OLT' | 'Switch' | 'Other'),
 *     ratedBatteryHours, fedZones[], outage, history[], createdAt }
 *   outage: null | { startedAt (ISO), batteryDepletedLogged,
 *                    complaintId }
 *   history entry: { startedAt, restoredAt, durationMinutes,
 *                    batteryDepleted, complaintId }
 *
 * The registry starts EMPTY — the operator registers his own nodes.
 * Nothing is seeded and no customer, area or staff data is invented.
 *
 * Timer model: an outage is just a persisted `startedAt` timestamp, so
 * it survives reloads and app restarts (offline PWA). Estimated Battery
 * Remaining is derived, never stored: ratedBatteryHours − elapsed,
 * clamped at 0. All clock reads go through an injectable `now`
 * (Date / epoch ms / ISO string) so tests can pin exact times.
 *
 * Battery depletion: when elapsed ≥ ratedBatteryHours while the outage
 * is still open, the outage must appear in the SISP-15 Complaint
 * Register exactly once as an AREA_OUTAGE (category
 * 'WAPDA / Power Outage'). The register write itself is INJECTED by the
 * caller (`logAreaOutage(node, depletedAtMs) -> complaintId`) — this
 * module never imports the register, so there is no module cycle and
 * the pure logic stays testable. The durable `batteryDepletedLogged`
 * flag on the outage is set only after the logger returns a complaint
 * id, so a depletion that happens while the app is closed is still
 * logged on the next launch/tick, and never logged twice.
 *
 * Storage: nodes live in localStorage under UPS_NODES_KEY
 * (sisp_ups_nodes_v1), a flat array. Backup: nodes travel in the JSON
 * backup `settings.upsNodes` section (see core.js), under the same
 * safe-merge rule as suspense payments: adopted only when this device
 * has none stored yet.
 *
 * Imported ONLY by app.js (plus core.js for the backup sanitizer), so
 * the dist bundle stays at the #219 budget of 25 files. The modal
 * controller at the bottom needs a DOM and is inspection-verified
 * (no DOM harness in node:test), like the other modal controllers.
 */

import { t } from './nav-language.js';

export const UPS_NODES_KEY = 'sisp_ups_nodes_v1';

/** Node kinds (canonical labels; display text goes through i18n). */
export const UPS_NODE_KINDS = Object.freeze(['OLT', 'Switch', 'Other']);

/** Longest rated backup the form accepts (a week of battery is a typo). */
export const MAX_RATED_BATTERY_HOURS = 168;

/** History kept per node (oldest dropped first) so storage stays small. */
export const MAX_OUTAGE_HISTORY = 100;

const ID_RE = /^UPS-(\d+)$/;
const PAKISTAN_TIME_ZONE = 'Asia/Karachi';

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

/** Accepts a Date, epoch ms or ISO string; returns epoch ms or NaN. */
function toMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return NaN;
}

function nowMs(now) {
  const ms = toMs(now === undefined ? new Date() : now);
  return Number.isFinite(ms) ? ms : Date.now();
}

function validHours(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= MAX_RATED_BATTERY_HOURS ? Math.round(n * 100) / 100 : null;
}

function validKind(value) {
  return UPS_NODE_KINDS.includes(value) ? value : 'Other';
}

/**
 * Zone list cleanup: accepts an array or a comma-separated string,
 * trims, drops blanks, dedupes case-insensitively (first casing wins).
 */
export function cleanFedZones(input) {
  const raw = Array.isArray(input)
    ? input
    : (typeof input === 'string' ? input.split(',') : []);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const zone = cleanText(item).slice(0, 60);
    if (!zone) continue;
    const key = zone.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(zone);
    if (out.length >= 40) break;
  }
  return out;
}

function sanitizeOutage(value) {
  if (!value || typeof value !== 'object') return null;
  const startedMs = toMs(value.startedAt);
  if (!Number.isFinite(startedMs)) return null;
  return {
    startedAt: new Date(startedMs).toISOString(),
    batteryDepletedLogged: value.batteryDepletedLogged === true,
    complaintId: cleanText(value.complaintId).slice(0, 32)
  };
}

function sanitizeHistoryEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const startedMs = toMs(value.startedAt);
  const restoredMs = toMs(value.restoredAt);
  if (!Number.isFinite(startedMs) || !Number.isFinite(restoredMs)) return null;
  const duration = Number(value.durationMinutes);
  return {
    startedAt: new Date(startedMs).toISOString(),
    restoredAt: new Date(restoredMs).toISOString(),
    durationMinutes: Number.isFinite(duration) && duration >= 0
      ? Math.round(duration)
      : Math.max(0, Math.round((restoredMs - startedMs) / 60000)),
    batteryDepleted: value.batteryDepleted === true,
    complaintId: cleanText(value.complaintId).slice(0, 32)
  };
}

/**
 * Drops malformed nodes; keeps only known fields with safe defaults so
 * a hand-edited or older backup can never break the monitor.
 */
export function sanitizeUpsNodes(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const nodeId = cleanText(entry.nodeId);
    const name = cleanText(entry.name).slice(0, 80);
    const ratedBatteryHours = validHours(entry.ratedBatteryHours);
    if (!nodeId || !name || ratedBatteryHours === null) continue;
    const history = (Array.isArray(entry.history) ? entry.history : [])
      .map(sanitizeHistoryEntry)
      .filter(Boolean)
      .slice(-MAX_OUTAGE_HISTORY);
    out.push({
      nodeId,
      name,
      kind: validKind(entry.kind),
      ratedBatteryHours,
      fedZones: cleanFedZones(entry.fedZones),
      outage: sanitizeOutage(entry.outage),
      history,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Reads the node registry; [] on missing/corrupt storage. */
export function loadUpsNodes(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(UPS_NODES_KEY);
    if (!raw) return [];
    return sanitizeUpsNodes(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists the node registry; never throws. */
export function saveUpsNodes(nodes, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(UPS_NODES_KEY, JSON.stringify(sanitizeUpsNodes(nodes)));
    return true;
  } catch {
    return false;
  }
}

/** Next node id: one above the highest UPS-N already stored (starts at 101). */
export function nextUpsNodeId(nodes) {
  let max = 100;
  for (const node of (Array.isArray(nodes) ? nodes : [])) {
    const match = ID_RE.exec(String(node?.nodeId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `UPS-${max + 1}`;
}

function validateNodeFields(input) {
  const name = cleanText(input?.name).slice(0, 80);
  if (!name) throw new Error('Give the power node a name first.');
  const ratedBatteryHours = validHours(input?.ratedBatteryHours);
  if (ratedBatteryHours === null) {
    throw new Error(`Battery backup must be more than 0 and at most ${MAX_RATED_BATTERY_HOURS} hours (e.g. 4).`);
  }
  return {
    name,
    kind: validKind(input?.kind),
    ratedBatteryHours,
    fedZones: cleanFedZones(input?.fedZones)
  };
}

/** Builds one node record from operator input. Throws on bad input. */
export function createUpsNode(input, existing, now = new Date()) {
  const fields = validateNodeFields(input);
  return {
    nodeId: nextUpsNodeId(existing),
    ...fields,
    outage: null,
    history: [],
    createdAt: new Date(nowMs(now)).toISOString()
  };
}

/** Returns a NEW list with the node appended. */
export function addUpsNode(nodes, input, now = new Date()) {
  const list = sanitizeUpsNodes(nodes);
  return [...list, createUpsNode(input, list, now)];
}

/**
 * Returns a NEW list with the node's operator fields replaced. The
 * outage, history and id are never touched by an edit — a battery
 * rating change mid-outage simply re-derives the remaining time.
 */
export function updateUpsNode(nodes, nodeId, patch) {
  const list = sanitizeUpsNodes(nodes);
  const index = list.findIndex((node) => node.nodeId === String(nodeId));
  if (index === -1) throw new Error('Power node not found.');
  const fields = validateNodeFields({ ...list[index], ...(patch || {}) });
  const next = [...list];
  next[index] = { ...list[index], ...fields };
  return next;
}

/**
 * Returns a NEW list without the node. Refused while an outage is
 * running on it — restore power first, so no live timer (or pending
 * depletion log) is ever silently discarded.
 */
export function deleteUpsNode(nodes, nodeId) {
  const list = sanitizeUpsNodes(nodes);
  const node = list.find((entry) => entry.nodeId === String(nodeId));
  if (!node) throw new Error('Power node not found.');
  if (node.outage) throw new Error('WAPDA is still off for this node — tap "WAPDA Restored" before deleting it.');
  return list.filter((entry) => entry.nodeId !== node.nodeId);
}

/** Starts an outage timer on a node. Returns a NEW list. */
export function startOutage(nodes, nodeId, now = new Date()) {
  const list = sanitizeUpsNodes(nodes);
  const index = list.findIndex((node) => node.nodeId === String(nodeId));
  if (index === -1) throw new Error('Power node not found.');
  if (list[index].outage) throw new Error('A WAPDA outage is already running for this node.');
  const next = [...list];
  next[index] = {
    ...list[index],
    outage: {
      startedAt: new Date(nowMs(now)).toISOString(),
      batteryDepletedLogged: false,
      complaintId: ''
    }
  };
  return next;
}

/**
 * '1h 30m' / '45m' / '3h 0m' — the one duration format used by the
 * dashboard, the modal and the restore toast, so every surface agrees.
 */
export function formatBatteryDuration(totalMinutes) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

/** '10:00' style clock time in Pakistan time, for "WAPDA off since …". */
export function formatClockTime(value) {
  const ms = toMs(value);
  if (!Number.isFinite(ms)) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: PAKISTAN_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(11, 16);
  }
}

/** Rated-hours label without trailing zeros: 4 -> '4', 4.5 -> '4.5'. */
export function formatRatedHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * Live battery status for one node, or null when no outage is running.
 * remainingMinutes is clamped at 0; `depleted` is true once the elapsed
 * time reaches the rated backup.
 */
export function batteryStatus(node, now = new Date()) {
  if (!node || typeof node !== 'object' || !node.outage) return null;
  const startedMs = toMs(node.outage.startedAt);
  const rated = validHours(node.ratedBatteryHours);
  if (!Number.isFinite(startedMs) || rated === null) return null;
  const atMs = nowMs(now);
  const elapsedMs = Math.max(0, atMs - startedMs);
  const ratedMs = rated * 3600000;
  const remainingMs = Math.max(0, ratedMs - elapsedMs);
  return {
    nodeId: node.nodeId,
    startedAt: node.outage.startedAt,
    startedMs,
    elapsedMinutes: Math.floor(elapsedMs / 60000),
    remainingMinutes: Math.round(remainingMs / 60000),
    remainingLabel: formatBatteryDuration(remainingMs / 60000),
    depleted: elapsedMs >= ratedMs,
    percentUsed: Math.min(100, Math.round((elapsedMs / ratedMs) * 100)),
    batteryDepletedLogged: node.outage.batteryDepletedLogged === true,
    complaintId: node.outage.complaintId || ''
  };
}

/** Every node with a running outage, paired with its live status. */
export function activeOutages(nodes, now = new Date()) {
  const at = nowMs(now);
  const out = [];
  for (const node of sanitizeUpsNodes(nodes)) {
    const status = batteryStatus(node, at);
    if (status) out.push({ node, status });
  }
  return out;
}

/**
 * Ends an outage: clears the timer and appends the auditable history
 * record (total duration included). Returns { nodes, record }.
 */
export function endOutage(nodes, nodeId, now = new Date()) {
  const list = sanitizeUpsNodes(nodes);
  const index = list.findIndex((node) => node.nodeId === String(nodeId));
  if (index === -1) throw new Error('Power node not found.');
  const node = list[index];
  if (!node.outage) throw new Error('No WAPDA outage is running for this node.');
  const endedMs = nowMs(now);
  const startedMs = toMs(node.outage.startedAt);
  const ratedMs = (validHours(node.ratedBatteryHours) || 0) * 3600000;
  const record = {
    startedAt: node.outage.startedAt,
    restoredAt: new Date(endedMs).toISOString(),
    durationMinutes: Math.max(0, Math.round((endedMs - startedMs) / 60000)),
    batteryDepleted: (endedMs - startedMs) >= ratedMs,
    complaintId: node.outage.complaintId || ''
  };
  const next = [...list];
  next[index] = {
    ...node,
    outage: null,
    history: [...node.history, record].slice(-MAX_OUTAGE_HISTORY)
  };
  return { nodes: next, record, node: next[index] };
}

/**
 * The depletion sweep: for every running outage whose battery has run
 * out and whose AREA_OUTAGE is not yet in the register, call the
 * injected logger once. The flag is stamped only when the logger
 * returns a complaint id — a failed/absent logger leaves the outage
 * unlogged so the next tick (or the next app launch) retries. Returns
 * { nodes, logged: [{ nodeId, name, complaintId, depletedAtMs }] };
 * `nodes` is a new array only when something was logged.
 */
export function checkUpsNodeDepletions(nodes, now = new Date(), logAreaOutage) {
  const list = sanitizeUpsNodes(nodes);
  const atMs = nowMs(now);
  const logged = [];
  let changed = false;
  const next = list.map((node) => {
    if (!node.outage || node.outage.batteryDepletedLogged) return node;
    const status = batteryStatus(node, atMs);
    if (!status || !status.depleted) return node;
    if (typeof logAreaOutage !== 'function') return node;
    const depletedAtMs = status.startedMs + (validHours(node.ratedBatteryHours) || 0) * 3600000;
    let complaintId = '';
    try {
      complaintId = cleanText(logAreaOutage(clone(node), depletedAtMs));
    } catch {
      complaintId = '';
    }
    if (!complaintId) return node;
    changed = true;
    logged.push({ nodeId: node.nodeId, name: node.name, complaintId, depletedAtMs });
    return {
      ...node,
      outage: { ...node.outage, batteryDepletedLogged: true, complaintId }
    };
  });
  return { nodes: changed ? next : list, logged };
}

/** Small summary for the dashboard card. */
export function powerBackupSummary(nodes, now = new Date()) {
  const list = sanitizeUpsNodes(nodes);
  const active = activeOutages(list, now);
  const worst = active.length
    ? active.reduce((a, b) => (a.status.remainingMinutes <= b.status.remainingMinutes ? a : b))
    : null;
  return {
    nodeCount: list.length,
    activeCount: active.length,
    depletedCount: active.filter((entry) => entry.status.depleted).length,
    worst
  };
}

/**
 * Modal controller (dialog lives in index.html). Renders the node
 * registry with per-node WAPDA Off / Restored buttons, the add/edit
 * form, and each node's recent outage history. A 30-second tick keeps
 * remaining times live while the dialog is open; the app runs its own
 * tick for the dashboard + depletion sweep. `logAreaOutage` is the
 * app's SISP-15 register writer, also used here so restoring power
 * after the battery already died still files the register entry first.
 */
export function setupPowerBackupModal(getState, {
  onNodesChanged, onToast, onConfirm, getZones, logAreaOutage, now
} = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('powerBackupModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const currentNow = () => {
    try {
      const value = typeof now === 'function' ? now() : now;
      return value === undefined ? new Date() : value;
    } catch {
      return new Date();
    }
  };
  let editingNodeId = null;
  let tickTimer = null;

  const zoneSuggestions = () => {
    let zones = [];
    try {
      zones = typeof getZones === 'function' ? getZones() : [];
    } catch {
      zones = [];
    }
    const merged = cleanFedZones(Array.isArray(zones) ? zones : []);
    for (const node of loadUpsNodes()) {
      for (const zone of node.fedZones) {
        if (!merged.some((item) => item.toLowerCase() === zone.toLowerCase())) merged.push(zone);
      }
    }
    return merged;
  };

  function renderZonePicker(selected = []) {
    const box = $('powerNodeZones');
    if (!box) return;
    const selectedKeys = new Set((Array.isArray(selected) ? selected : []).map((zone) => String(zone).toLowerCase()));
    const zones = zoneSuggestions();
    for (const zone of (Array.isArray(selected) ? selected : [])) {
      if (!zones.some((item) => item.toLowerCase() === String(zone).toLowerCase())) zones.push(zone);
    }
    box.innerHTML = zones.length === 0
      ? `<span class="power-zones-empty">${escapeHtml(t('pwr_zones_none'))}</span>`
      : zones.map((zone) => `
        <label class="power-zone">
          <input type="checkbox" data-pwr-zone value="${escapeHtml(zone)}" ${selectedKeys.has(zone.toLowerCase()) ? 'checked' : ''}>
          <span>${escapeHtml(zone)}</span>
        </label>`).join('');
  }

  function selectedZones() {
    const box = $('powerNodeZones');
    if (!box) return [];
    return [...box.querySelectorAll('[data-pwr-zone]:checked')].map((input) => input.value);
  }

  function kindLabel(kind) {
    if (kind === 'OLT') return t('pwr_kind_olt');
    if (kind === 'Switch') return t('pwr_kind_switch');
    return t('pwr_kind_other');
  }

  function renderList() {
    const listEl = $('powerNodesList');
    if (!listEl) return;
    const nodes = loadUpsNodes();
    const at = currentNow();
    listEl.innerHTML = nodes.length === 0
      ? `<p class="power-empty">${escapeHtml(t('pwr_empty'))}</p>`
      : nodes.map((node) => {
        const status = batteryStatus(node, at);
        const meta = t('pwr_meta', null, { kind: kindLabel(node.kind), hours: formatRatedHours(node.ratedBatteryHours) });
        const zonesLine = node.fedZones.length
          ? `<p><span>${escapeHtml(t('pwr_zones_line', null, { zones: node.fedZones.join(', ') }))}</span></p>`
          : '';
        let statusBlock = '';
        let actionBtn = '';
        if (status && status.depleted) {
          statusBlock = `<p><strong class="power-status-depleted">${escapeHtml(t(status.batteryDepletedLogged ? 'pwr_depleted' : 'pwr_depleted_unlogged'))}</strong></p>
            <p><span>${escapeHtml(t('pwr_status_since', null, { time: formatClockTime(status.startedAt) }))}</span></p>`;
          actionBtn = `<button type="button" class="primary-button" data-pwr-restored="${escapeHtml(node.nodeId)}">${escapeHtml(t('pwr_btn_restored'))}</button>`;
        } else if (status) {
          statusBlock = `<p><strong class="power-status-outage">${escapeHtml(t('pwr_remaining', null, { label: status.remainingLabel }))}</strong></p>
            <p><span>${escapeHtml(t('pwr_status_since', null, { time: formatClockTime(status.startedAt) }))}</span></p>`;
          actionBtn = `<button type="button" class="primary-button" data-pwr-restored="${escapeHtml(node.nodeId)}">${escapeHtml(t('pwr_btn_restored'))}</button>`;
        } else {
          statusBlock = `<p><strong class="power-status-ok">${escapeHtml(t('pwr_status_ok'))}</strong></p>`;
          actionBtn = `<button type="button" class="primary-button" data-pwr-off="${escapeHtml(node.nodeId)}">${escapeHtml(t('pwr_btn_wapda_off'))}</button>`;
        }
        const history = [...node.history].slice(-3).reverse();
        const historyBlock = history.length
          ? `<div class="power-history"><span class="power-history-title">${escapeHtml(t('pwr_history_title'))}</span>${history.map((entry) => `
              <p><span>${escapeHtml(entry.restoredAt.slice(0, 10))} · ${escapeHtml(formatBatteryDuration(entry.durationMinutes))}${entry.batteryDepleted ? ` · ${escapeHtml(t('pwr_history_depleted'))}` : ''}</span></p>`).join('')}
            </div>`
          : '';
        return `
        <article class="power-card${status ? (status.depleted ? ' power-card-depleted' : ' power-card-outage') : ''}">
          <p><span><strong dir="auto">${escapeHtml(node.name)}</strong></span><strong>${escapeHtml(meta)}</strong></p>
          ${zonesLine}
          ${statusBlock}
          <div class="power-actions">
            ${actionBtn}
            <button type="button" class="secondary-button" data-pwr-edit="${escapeHtml(node.nodeId)}">${escapeHtml(t('pwr_btn_edit'))}</button>
            <button type="button" class="secondary-button text-button danger" data-pwr-delete="${escapeHtml(node.nodeId)}">${escapeHtml(t('pwr_btn_delete'))}</button>
          </div>
          ${historyBlock}
        </article>`;
      }).join('');
  }

  function resetForm() {
    editingNodeId = null;
    const form = $('powerNodeForm');
    if (form) form.reset();
    const title = $('powerNodeFormTitle');
    if (title) title.textContent = t('pwr_add_title');
    const submit = $('powerNodeSubmitBtn');
    if (submit) submit.textContent = t('pwr_save_node');
    const cancel = $('powerNodeCancelEditBtn');
    if (cancel) cancel.hidden = true;
    renderZonePicker([]);
  }

  function startEdit(node) {
    editingNodeId = node.nodeId;
    const nameInput = $('powerNodeName');
    if (nameInput) nameInput.value = node.name;
    const kindInput = $('powerNodeKind');
    if (kindInput) kindInput.value = node.kind;
    const hoursInput = $('powerNodeHours');
    if (hoursInput) hoursInput.value = node.ratedBatteryHours;
    renderZonePicker(node.fedZones);
    const title = $('powerNodeFormTitle');
    if (title) title.textContent = t('pwr_edit_title');
    const submit = $('powerNodeSubmitBtn');
    if (submit) submit.textContent = t('pwr_save_node');
    const cancel = $('powerNodeCancelEditBtn');
    if (cancel) cancel.hidden = false;
    const form = $('powerNodeForm');
    if (form) form.scrollIntoView({ block: 'nearest' });
  }

  const form = $('powerNodeForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const input = {
          name: $('powerNodeName')?.value,
          kind: $('powerNodeKind')?.value,
          ratedBatteryHours: $('powerNodeHours')?.value,
          fedZones: selectedZones()
        };
        if (!cleanText(input.name)) throw new Error(t('pwr_error_name'));
        if (validHours(input.ratedBatteryHours) === null) throw new Error(t('pwr_error_hours'));
        const nodes = loadUpsNodes();
        const updated = editingNodeId
          ? updateUpsNode(nodes, editingNodeId, input)
          : addUpsNode(nodes, input, currentNow());
        saveUpsNodes(updated);
        resetForm();
        renderList();
        if (typeof onNodesChanged === 'function') onNodesChanged();
        if (typeof onToast === 'function') onToast(t('pwr_toast_saved'));
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || t('pwr_error_generic'), { type: 'error' });
      }
    });
  }

  const cancelBtn = $('powerNodeCancelEditBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { resetForm(); renderList(); });

  const listEl = $('powerNodesList');
  if (listEl) {
    listEl.addEventListener('click', async (event) => {
      const offBtn = event.target.closest('[data-pwr-off]');
      const restoredBtn = event.target.closest('[data-pwr-restored]');
      const editBtn = event.target.closest('[data-pwr-edit]');
      const deleteBtn = event.target.closest('[data-pwr-delete]');
      try {
        if (offBtn) {
          const nodes = startOutage(loadUpsNodes(), offBtn.dataset.pwrOff, currentNow());
          saveUpsNodes(nodes);
          renderList();
          if (typeof onNodesChanged === 'function') onNodesChanged();
          const node = nodes.find((entry) => entry.nodeId === offBtn.dataset.pwrOff);
          if (typeof onToast === 'function') onToast(t('pwr_toast_outage_started', null, { name: node?.name || '' }));
          return;
        }
        if (restoredBtn) {
          // File the register entry first if the battery already died —
          // the depletion sweep may not have ticked yet.
          let nodes = loadUpsNodes();
          const sweep = checkUpsNodeDepletions(nodes, currentNow(), logAreaOutage);
          if (sweep.logged.length) {
            saveUpsNodes(sweep.nodes);
            nodes = sweep.nodes;
          }
          const result = endOutage(nodes, restoredBtn.dataset.pwrRestored, currentNow());
          saveUpsNodes(result.nodes);
          renderList();
          if (typeof onNodesChanged === 'function') onNodesChanged();
          if (typeof onToast === 'function') {
            onToast(t('pwr_toast_restored', null, {
              name: result.node.name,
              duration: formatBatteryDuration(result.record.durationMinutes)
            }));
          }
          return;
        }
        if (editBtn) {
          const node = loadUpsNodes().find((entry) => entry.nodeId === editBtn.dataset.pwrEdit);
          if (node) startEdit(node);
          return;
        }
        if (deleteBtn) {
          const node = loadUpsNodes().find((entry) => entry.nodeId === deleteBtn.dataset.pwrDelete);
          if (!node) return;
          if (typeof onConfirm === 'function') {
            const confirmed = await onConfirm({
              tone: 'danger',
              title: t('pwr_confirm_delete_title'),
              subject: node.name,
              message: t('pwr_confirm_delete_msg'),
              confirmLabel: t('pwr_btn_delete')
            });
            if (confirmed !== 'confirm') return;
          }
          saveUpsNodes(deleteUpsNode(loadUpsNodes(), node.nodeId));
          if (editingNodeId === node.nodeId) resetForm();
          renderList();
          if (typeof onNodesChanged === 'function') onNodesChanged();
          if (typeof onToast === 'function') onToast(t('pwr_toast_deleted'));
        }
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || t('pwr_error_generic'), { type: 'error' });
      }
    });
  }

  function startTick() {
    stopTick();
    tickTimer = setInterval(() => { renderList(); }, 30000);
  }
  function stopTick() {
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function open() {
    resetForm();
    renderList();
    if (!dialog.open) dialog.showModal();
    startTick();
  }

  const closeBtn = $('powerBackupCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', stopTick);
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openPowerBackupModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', open);
  const manageBtn = typeof document !== 'undefined' ? document.getElementById('powerOutageManageBtn') : null;
  if (manageBtn) manageBtn.addEventListener('click', open);

  return { open, refresh: renderList };
}
