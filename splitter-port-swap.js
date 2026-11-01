/**
 * splitter-port-swap.js — SISP-152: Splitter Box Port Swap & "🔴 Faulty /
 * Dead Port" Lockout.
 *
 * Problem: a splitter port that goes bad (damaged pigtail, dirty
 * connector, crushed drop) keeps looking "spare" on the port map, so the
 * next install gets assigned to it again. And moving a subscriber off a
 * faulty port meant editing the profile form by hand with no guard
 * against picking an occupied or out-of-range port.
 *
 * Model: a customer's port lives ON the customer record (splitter-map.js
 * SISP-24: splitterBoxId + splitterPort, written only through core.js
 * updateCustomerProfile). Boxes and port occupancy are DERIVED from the
 * customers array, so this module stores exactly one new thing — the
 * dead-port lockout list, in its own localStorage key
 * (sisp_dead_ports_v1), a flat array of { boxId, port, lockedAt, note }.
 * It starts EMPTY: no port is locked until the owner locks one. The list
 * travels in JSON backups as the optional `settings.deadPorts` section
 * (core.js createJsonBackup / previewJsonBackupMerge, sibling safe-merge
 * pattern — adopt only onto a device with none, conflict otherwise).
 *
 * Occupancy rule (single source of truth): the swap validator reads
 * occupancy from splitter-map.js buildSplitterPortMap itself, so a port
 * the map renders as occupied can never be a swap target. That map
 * counts EVERY recorded assignment — including an archived customer's —
 * as occupying the port (their record still claims it on the map), so
 * an archived occupant blocks a swap too; freeing that port is done by
 * clearing it on the archived customer's profile first.
 *
 * Capacity rule: a box's port count is the map's own derivation
 * (buildSplitterBoxes: any port above 8 makes it a 1:16 box, otherwise
 * 1:8), and a port is only ever valid inside 1..16
 * (normalizeOpticalFields). A swap target must be a port the map
 * actually shows for that box.
 *
 * Enforcement: ONE shared pure check — isPortDead(boxId, port,
 * deadPorts) — consulted by (a) the swap validator here, (b) the
 * profile form save in app.js, and (c) the new-customer form save in
 * app.js. The SISP-57 install-completion path never assigns a splitter
 * port (buildInstallCompletionPlan carries no optical fields), so the
 * first port assignment after an install happens through the profile
 * form, which is guarded by (b).
 *
 * All helpers are pure except load/save (localStorage) and the swap
 * dialog controller's DOM wiring. Tests use synthetic data only.
 */

import { t } from './nav-language.js';
import {
  buildSplitterBoxes,
  buildSplitterPortMap,
  normalizeOpticalFields
} from './splitter-map.js';

export const DEAD_PORTS_KEY = 'sisp_dead_ports_v1';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validPort(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 16 ? n : null;
}

/**
 * Drops malformed rows; keeps clean entries in (boxId, port) order.
 * An entry needs a real box id and a port inside 1..16; duplicates of
 * the same (boxId, port) collapse to the first recorded lock.
 */
export function sanitizeDeadPorts(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const boxId = cleanText(entry.boxId).slice(0, 100);
    const port = validPort(entry.port);
    if (!boxId || port === null) continue;
    const key = `${boxId}|${port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      boxId,
      port,
      lockedAt: typeof entry.lockedAt === 'string' ? entry.lockedAt : '',
      note: cleanText(entry.note).slice(0, 200)
    });
  }
  out.sort((a, b) => a.boxId.localeCompare(b.boxId) || a.port - b.port);
  return out;
}

export function loadDeadPorts(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(DEAD_PORTS_KEY);
    if (!raw) return [];
    return sanitizeDeadPorts(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveDeadPorts(entries, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(DEAD_PORTS_KEY, JSON.stringify(sanitizeDeadPorts(entries)));
    return true;
  } catch {
    return false;
  }
}

/** The lock entry for one (boxId, port), or null when the port is live. */
export function findDeadPort(boxId, port, deadPorts) {
  const cleanBoxId = cleanText(boxId);
  const portNumber = validPort(port);
  if (!cleanBoxId || portNumber === null) return null;
  return sanitizeDeadPorts(deadPorts).find((entry) => entry.boxId === cleanBoxId && entry.port === portNumber) ?? null;
}

/**
 * THE shared dead-port check: true when (boxId, port) is locked out.
 * Consulted by the swap validator and by every form save that assigns
 * a splitter port (profile + new customer, wired in app.js).
 */
export function isPortDead(boxId, port, deadPorts) {
  return findDeadPort(boxId, port, deadPorts) !== null;
}

/** All lock entries for one box, in port order. */
export function deadPortsForBox(boxId, deadPorts) {
  const cleanBoxId = cleanText(boxId);
  return sanitizeDeadPorts(deadPorts).filter((entry) => entry.boxId === cleanBoxId);
}

/**
 * Locks one port. Pure: returns the new list. Locking an already-locked
 * port is a no-op (the original lock entry — and its timestamp — is
 * kept). Throws on a malformed box/port so a caller bug never writes a
 * phantom lock.
 */
export function lockDeadPort(entries, { boxId, port, note = '' } = {}, now = new Date()) {
  const cleanBoxId = cleanText(boxId).slice(0, 100);
  const portNumber = validPort(port);
  if (!cleanBoxId) throw new Error('A splitter box is required to lock a port.');
  if (portNumber === null) throw new Error('Port must be between 1 and 16.');
  const clean = sanitizeDeadPorts(entries);
  if (clean.some((entry) => entry.boxId === cleanBoxId && entry.port === portNumber)) return clean;
  return sanitizeDeadPorts([...clean, {
    boxId: cleanBoxId,
    port: portNumber,
    lockedAt: now instanceof Date && !Number.isNaN(now.getTime()) ? now.toISOString() : '',
    note: cleanText(note).slice(0, 200)
  }]);
}

/** Unlocks one port. Pure: returns the new list (unchanged when it was not locked). */
export function unlockDeadPort(entries, boxId, port) {
  const cleanBoxId = cleanText(boxId);
  const portNumber = validPort(port);
  const clean = sanitizeDeadPorts(entries);
  if (!cleanBoxId || portNumber === null) return clean;
  return clean.filter((entry) => !(entry.boxId === cleanBoxId && entry.port === portNumber));
}

/**
 * Ports on the customer's box that the swap dialog may offer: inside
 * the box's derived port count, not the customer's current port, not
 * occupied on the port map, and not dead-locked.
 */
export function swapTargetPorts(customers, customer, deadPorts) {
  const optical = normalizeOpticalFields(customer ?? {});
  if (!optical.splitterBoxId || optical.splitterPort === null) return [];
  const boxes = buildSplitterBoxes(Array.isArray(customers) ? customers : []);
  const box = boxes.find((item) => item.boxId === optical.splitterBoxId);
  if (!box) return [];
  return box.ports
    .filter((slot) => slot.status === 'spare' && slot.port !== optical.splitterPort && !isPortDead(box.boxId, slot.port, deadPorts))
    .map((slot) => slot.port);
}

/**
 * Pure swap validation. Returns { ok: true, customerId, customerName,
 * boxId, oldPort, newPort, portCount } or { ok: false, code } where
 * code is one of: customer-not-found | no-assignment | invalid-port |
 * same-port | out-of-range | dead-port | occupied (with occupantName).
 * Checks run in that order so the most basic problem is reported first.
 */
export function validatePortSwap(customers, customerId, newPort, deadPorts) {
  const list = Array.isArray(customers) ? customers : [];
  const customer = list.find((row) => row && String(row.id) === String(customerId));
  if (!customer) return { ok: false, code: 'customer-not-found' };
  const optical = normalizeOpticalFields(customer);
  if (!optical.splitterBoxId || optical.splitterPort === null) return { ok: false, code: 'no-assignment' };
  const target = validPort(newPort);
  if (target === null) return { ok: false, code: 'invalid-port', boxId: optical.splitterBoxId, oldPort: optical.splitterPort };
  if (target === optical.splitterPort) return { ok: false, code: 'same-port', boxId: optical.splitterBoxId, oldPort: optical.splitterPort, newPort: target };
  const boxes = buildSplitterBoxes(list);
  const box = boxes.find((item) => item.boxId === optical.splitterBoxId);
  const portCount = box?.portCount ?? 8;
  if (target > portCount) return { ok: false, code: 'out-of-range', boxId: optical.splitterBoxId, oldPort: optical.splitterPort, newPort: target, portCount };
  if (isPortDead(optical.splitterBoxId, target, deadPorts)) {
    return { ok: false, code: 'dead-port', boxId: optical.splitterBoxId, oldPort: optical.splitterPort, newPort: target, portCount };
  }
  const map = buildSplitterPortMap(list, optical.splitterBoxId, portCount);
  const slot = map.ports[target - 1];
  if (slot && slot.status === 'occupied') {
    return { ok: false, code: 'occupied', boxId: optical.splitterBoxId, oldPort: optical.splitterPort, newPort: target, portCount, occupantId: slot.customerId, occupantName: slot.customerName };
  }
  return {
    ok: true,
    customerId: String(customer.id),
    customerName: customer.name ?? '',
    boxId: optical.splitterBoxId,
    oldPort: optical.splitterPort,
    newPort: target,
    portCount
  };
}

const SWAP_ERROR_MESSAGES = {
  'customer-not-found': () => 'Customer not found.',
  'no-assignment': () => 'This customer has no splitter port to swap.',
  'invalid-port': () => 'Splitter port must be between 1 and 16.',
  'same-port': (r) => `Port ${r.newPort} is already this customer's port.`,
  'out-of-range': (r) => `Port ${r.newPort} is outside this box's ${r.portCount} ports.`,
  'dead-port': (r) => `Port ${r.newPort} on ${r.boxId} is locked as faulty / dead — unlock it before assigning anyone there.`,
  occupied: (r) => `Port ${r.newPort} is already used by ${r.occupantName || 'another customer'}.`
};

/**
 * Executes a validated swap through the caller's profile writer
 * (app.js passes core.js updateCustomerProfile — the one real seam
 * that writes splitterPort). Validation runs BEFORE the writer is
 * invoked, so any refusal leaves the state — and the customer record —
 * completely untouched. Returns { state, customerId, customerName,
 * boxId, oldPort, newPort } on success; throws a plain Error on refusal.
 */
export function executePortSwap(state, customerId, newPort, deadPorts, updateCustomerProfile) {
  const result = validatePortSwap(state?.customers ?? [], customerId, newPort, deadPorts);
  if (!result.ok) {
    const make = SWAP_ERROR_MESSAGES[result.code] ?? (() => 'That port cannot be used.');
    throw new Error(make(result));
  }
  if (typeof updateCustomerProfile !== 'function') throw new Error('A profile writer is required to swap a port.');
  const nextState = updateCustomerProfile(state, result.customerId, { splitterPort: result.newPort });
  return { state: nextState, ...result };
}

/** i18n key for a validatePortSwap refusal code (dialog + form toasts). */
export function portSwapErrorKey(code) {
  return {
    'customer-not-found': 'pswap_err_not_found',
    'no-assignment': 'pswap_err_no_assignment',
    'invalid-port': 'pswap_err_invalid',
    'same-port': 'pswap_err_same',
    'out-of-range': 'pswap_err_range',
    'dead-port': 'pswap_err_dead',
    occupied: 'pswap_err_occupied'
  }[code] ?? 'pswap_err_invalid';
}

/**
 * Swap dialog controller, mirroring setupSuspensePaymentsModal: the
 * host (app.js) supplies the live state, the dead-port list, and the
 * commit callback that runs executePortSwap through core's
 * updateCustomerProfile and persists. The dialog itself writes nothing.
 */
export function setupPortSwapModal(getState, { getDeadPorts, onCommitSwap, onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('splitterPortSwapModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let customerId = '';

  function currentCustomer() {
    const state = typeof getState === 'function' ? getState() : {};
    return (state?.customers ?? []).find((row) => row && String(row.id) === String(customerId)) ?? null;
  }

  function render() {
    const customer = currentCustomer();
    const deadPorts = typeof getDeadPorts === 'function' ? getDeadPorts() : [];
    const nameEl = $('portSwapCustomerLine');
    const currentEl = $('portSwapCurrentLine');
    const select = $('portSwapTargetSelect');
    const errorEl = $('portSwapError');
    const confirmBtn = $('portSwapConfirmBtn');
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    if (!customer) {
      if (nameEl) nameEl.textContent = '';
      if (currentEl) currentEl.textContent = '';
      if (select) select.innerHTML = '';
      if (confirmBtn) confirmBtn.disabled = true;
      return;
    }
    const optical = normalizeOpticalFields(customer);
    if (nameEl) nameEl.textContent = t('pswap_customer_line', null, { name: customer.name || '', box: optical.splitterBoxId });
    if (currentEl) currentEl.textContent = t('pswap_current', null, { box: optical.splitterBoxId, port: optical.splitterPort ?? '' });
    const state = typeof getState === 'function' ? getState() : {};
    const targets = swapTargetPorts(state?.customers ?? [], customer, deadPorts);
    if (select) {
      select.innerHTML = targets.map((port) => `<option value="${port}">${escapeHtml(t('pswap_target_option', null, { port }))}</option>`).join('');
    }
    if (confirmBtn) confirmBtn.disabled = targets.length === 0;
    if (targets.length === 0 && errorEl) {
      errorEl.textContent = t('pswap_no_targets', null, { box: optical.splitterBoxId });
      errorEl.hidden = false;
    }
  }

  function showError(message) {
    const errorEl = $('portSwapError');
    if (errorEl) { errorEl.textContent = message; errorEl.hidden = false; }
    else if (onToast) onToast(message);
  }

  const closeBtn = $('portSwapCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const confirmBtn = $('portSwapConfirmBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const customer = currentCustomer();
      if (!customer) return;
      const select = $('portSwapTargetSelect');
      const newPort = Number(select?.value);
      const deadPorts = typeof getDeadPorts === 'function' ? getDeadPorts() : [];
      const state = typeof getState === 'function' ? getState() : {};
      const check = validatePortSwap(state?.customers ?? [], customer.id, newPort, deadPorts);
      if (!check.ok) {
        showError(t(portSwapErrorKey(check.code), null, {
          box: check.boxId ?? '', port: check.newPort ?? newPort, count: check.portCount ?? '', name: check.occupantName ?? ''
        }));
        return;
      }
      const lockOld = $('portSwapLockOld')?.checked === true;
      const note = $('portSwapLockNote')?.value ?? '';
      try {
        const result = typeof onCommitSwap === 'function'
          ? onCommitSwap(customer.id, newPort, lockOld, note)
          : null;
        dialog.close();
        if (onToast) {
          onToast(t('pswap_done', null, { name: result?.customerName ?? customer.name ?? '', port: newPort }));
          if (lockOld && result) onToast(t('pswap_locked_toast', null, { box: result.boxId, port: result.oldPort }));
        }
      } catch (error) {
        showError(error?.message || t('pswap_err_invalid'));
      }
    });
  }

  return {
    open({ customerId: id } = {}) {
      customerId = id ?? '';
      const lockOld = $('portSwapLockOld');
      if (lockOld) lockOld.checked = false;
      const noteEl = $('portSwapLockNote');
      if (noteEl) noteEl.value = '';
      render();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else if (onToast) onToast('Port swap is not available in this view.');
    },
    refresh() {
      render();
    }
  };
}
