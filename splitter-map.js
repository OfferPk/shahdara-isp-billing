/**
 * splitter-map.js — SISP-24: Optical Splitter Box (1:8 / 1:16 PLC) Port Map
 * & Customer RX Signal (dBm) Tracker.
 *
 * Problem: when troubleshooting fiber cuts or high attenuation, technicians
 * need to know which street PLC splitter box and port feeds a customer, and
 * whether that customer's optical RX signal is healthy or degraded.
 *
 * Storage: the four optical fields live ON the customer record (validated in
 * core.js addCustomer / updateCustomerProfile, so old records without them
 * read back as empty — never a crash, never invented data):
 *   splitterBoxId (e.g. "SPL-Barrian-02"), splitterPort (1–16),
 *   oltPonPort (e.g. "PON 1/2/3"), lastRxDbm (e.g. -19.4).
 * This module invents no storage of its own; the port map is derived from
 * the customers array every render, so it can never go stale.
 *
 * Weak-signal rule (spec): lastRxDbm < -26.0 dBm flags a high-loss /
 * attenuation warning (red badge). Anything at or above -26.0 is healthy;
 * a missing reading is unknown, never healthy and never weak.
 *
 * All helpers are pure except the modal controller's DOM wiring. Tests use
 * synthetic data only.
 */

export const WEAK_RX_DBM_THRESHOLD = -26.0;

export const SPLITTER_PORT_COUNTS = Object.freeze([8, 16]);

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

/**
 * Normalize one customer's optical fields. Missing / malformed values fall
 * back to empty / null — backward-compatible with every record saved before
 * SISP-24 existed.
 */
export function normalizeOpticalFields(customer) {
  const rawPort = customer?.splitterPort;
  const portNumber = rawPort === '' || rawPort === null || rawPort === undefined
    ? null
    : Number(rawPort);
  const rawDbm = customer?.lastRxDbm;
  const dbmNumber = rawDbm === '' || rawDbm === null || rawDbm === undefined
    ? null
    : Number(rawDbm);
  return {
    splitterBoxId: cleanText(customer?.splitterBoxId),
    splitterPort: Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 16
      ? portNumber
      : null,
    oltPonPort: cleanText(customer?.oltPonPort),
    lastRxDbm: Number.isFinite(dbmNumber) ? Math.round(dbmNumber * 10) / 10 : null
  };
}

/** 'weak' | 'healthy' | 'unknown' for one RX reading. */
export function rxSignalStatus(lastRxDbm) {
  const n = lastRxDbm === '' || lastRxDbm === null || lastRxDbm === undefined
    ? null
    : Number(lastRxDbm);
  if (!Number.isFinite(n)) return 'unknown';
  return n < WEAK_RX_DBM_THRESHOLD ? 'weak' : 'healthy';
}

export function isWeakRx(lastRxDbm) {
  return rxSignalStatus(lastRxDbm) === 'weak';
}

export function formatRxDbm(lastRxDbm) {
  const status = rxSignalStatus(lastRxDbm);
  if (status === 'unknown') return 'Not recorded';
  const n = Math.round(Number(lastRxDbm) * 10) / 10;
  return `${n} dBm`;
}

/**
 * Port map for ONE splitter box. Ports are 1-based; a customer counts as
 * occupying a port only when their box id matches and their port falls
 * inside 1..portCount. Assignments outside that range are reported in
 * outOfRange instead of silently vanishing (e.g. port 12 saved against a
 * 1:8 box is a data-entry mistake worth seeing, not a free port).
 */
export function buildSplitterPortMap(customers, boxId, portCount = 8) {
  const cleanBoxId = cleanText(boxId);
  const count = SPLITTER_PORT_COUNTS.includes(portCount) ? portCount : 8;
  const ports = [];
  for (let port = 1; port <= count; port += 1) {
    ports.push({ port, status: 'spare', customerId: null, customerName: '', lastRxDbm: null, signalStatus: 'unknown' });
  }
  const outOfRange = [];
  for (const customer of Array.isArray(customers) ? customers : []) {
    const optical = normalizeOpticalFields(customer);
    if (!optical.splitterBoxId || optical.splitterBoxId !== cleanBoxId) continue;
    if (optical.splitterPort === null) continue;
    if (optical.splitterPort < 1 || optical.splitterPort > count) {
      outOfRange.push({
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? '',
        splitterPort: optical.splitterPort,
        lastRxDbm: optical.lastRxDbm,
        signalStatus: rxSignalStatus(optical.lastRxDbm)
      });
      continue;
    }
    const slot = ports[optical.splitterPort - 1];
    // First assignment wins; a double-booked port is surfaced via
    // outOfRange-style visibility in the weak/duplicate list below.
    if (slot.status === 'occupied') {
      outOfRange.push({
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? '',
        splitterPort: optical.splitterPort,
        lastRxDbm: optical.lastRxDbm,
        signalStatus: rxSignalStatus(optical.lastRxDbm),
        duplicatePort: true
      });
      continue;
    }
    slot.status = 'occupied';
    slot.customerId = customer?.id ?? null;
    slot.customerName = customer?.name ?? '';
    slot.lastRxDbm = optical.lastRxDbm;
    slot.signalStatus = rxSignalStatus(optical.lastRxDbm);
  }
  const occupied = ports.filter((slot) => slot.status === 'occupied');
  const weak = occupied.filter((slot) => slot.signalStatus === 'weak');
  return {
    boxId: cleanBoxId,
    portCount: count,
    ports,
    occupiedCount: occupied.length,
    freeCount: count - occupied.length,
    freePorts: ports.filter((slot) => slot.status === 'spare').map((slot) => slot.port),
    weakCount: weak.length,
    weakPorts: weak,
    outOfRange
  };
}

/**
 * Every splitter box referenced by at least one customer, with its port
 * count derived from the data itself: a box with any port above 8 is a
 * 1:16 box, otherwise 1:8. Boxes sort by id so the selector order is stable.
 */
export function buildSplitterBoxes(customers) {
  const list = Array.isArray(customers) ? customers : [];
  const boxIds = [...new Set(list.map((c) => normalizeOpticalFields(c).splitterBoxId).filter(Boolean))].sort();
  return boxIds.map((boxId) => {
    const maxPort = list.reduce((max, c) => {
      const optical = normalizeOpticalFields(c);
      return optical.splitterBoxId === boxId && optical.splitterPort !== null
        ? Math.max(max, optical.splitterPort)
        : max;
    }, 0);
    return buildSplitterPortMap(list, boxId, maxPort > 8 ? 16 : 8);
  });
}

/** Network-wide optical headline for the dashboard card. */
export function buildSplitterOverview(customers) {
  const boxes = buildSplitterBoxes(customers);
  const weakCustomers = [];
  for (const box of boxes) {
    for (const slot of box.weakPorts) {
      weakCustomers.push({ ...slot, boxId: box.boxId });
    }
    for (const entry of box.outOfRange) {
      if (entry.signalStatus === 'weak') weakCustomers.push({ ...entry, boxId: box.boxId });
    }
  }
  return {
    boxes,
    boxCount: boxes.length,
    occupiedPorts: boxes.reduce((sum, box) => sum + box.occupiedCount, 0),
    freePorts: boxes.reduce((sum, box) => sum + box.freeCount, 0),
    weakCount: weakCustomers.length,
    weakCustomers
  };
}

/** One port cell of the visual grid. Occupied ports name their customer. */
export function renderSplitterPortCell(slot) {
  if (slot.status === 'spare') {
    return `<div class="splitter-port splitter-port-spare"><span class="splitter-port-number">${slot.port}</span><span class="splitter-port-state">Spare</span></div>`;
  }
  const badge = slot.signalStatus === 'weak'
    ? '<span class="safety-badge badge-danger splitter-weak-badge">High-loss · weak signal</span>'
    : slot.signalStatus === 'healthy'
      ? '<span class="safety-badge badge-healthy splitter-weak-badge">Signal OK</span>'
      : '';
  return `<div class="splitter-port splitter-port-occupied${slot.signalStatus === 'weak' ? ' splitter-port-weak' : ''}"><span class="splitter-port-number">${slot.port}</span><span class="splitter-port-customer">${escapeHtml(slot.customerName || 'Unnamed')}</span><span class="splitter-port-rx">${escapeHtml(formatRxDbm(slot.lastRxDbm))}</span>${badge}</div>`;
}

export function renderSplitterPortGrid(box) {
  if (!box) return '<p class="splitter-map-empty">No splitter box selected.</p>';
  return `<div class="splitter-port-grid" aria-label="Splitter ${escapeHtml(box.boxId)} port map">${box.ports.map(renderSplitterPortCell).join('')}</div>`;
}

/**
 * Modal controller, mirroring setupDowntimeAnalyticsModal: a box selector,
 * the visual port grid, and the weak-signal list. getState supplies the
 * live app state ({ customers }); nothing is cached between renders.
 */
export function setupSplitterMapModal(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('splitterMapModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let selectedBoxId = '';

  function render() {
    const state = typeof getState === 'function' ? getState() : {};
    const customers = state?.customers ?? [];
    const boxes = buildSplitterBoxes(customers);
    const select = $('splitterMapBoxSelect');
    if (select) {
      const previous = selectedBoxId;
      select.innerHTML = boxes.length === 0
        ? '<option value="">No splitter boxes recorded yet</option>'
        : boxes.map((box) => `<option value="${escapeHtml(box.boxId)}">${escapeHtml(box.boxId)} · 1:${box.portCount} · ${box.occupiedCount} used · ${box.freeCount} spare${box.weakCount ? ` · ${box.weakCount} weak` : ''}</option>`).join('');
      selectedBoxId = boxes.some((box) => box.boxId === previous) ? previous : (boxes[0]?.boxId ?? '');
      select.value = selectedBoxId;
    }
    const box = boxes.find((item) => item.boxId === selectedBoxId) ?? null;
    const summaryEl = $('splitterMapSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = !box
        ? 'No splitter box recorded yet — add a splitter box id and port on a customer profile to start the map.'
        : `${box.boxId} · 1:${box.portCount} PLC · ${box.occupiedCount} occupied · ${box.freeCount} spare${box.weakCount ? ` · ${box.weakCount} weak signal${box.weakCount === 1 ? '' : 's'} (below ${WEAK_RX_DBM_THRESHOLD} dBm)` : ''}${box.outOfRange.length ? ` · ${box.outOfRange.length} assignment${box.outOfRange.length === 1 ? '' : 's'} need attention` : ''}`;
    }
    const gridEl = $('splitterMapGrid');
    if (gridEl) gridEl.innerHTML = renderSplitterPortGrid(box);
    const weakEl = $('splitterMapWeakList');
    if (weakEl) {
      const overview = buildSplitterOverview(customers);
      weakEl.innerHTML = overview.weakCustomers.length === 0
        ? '<p class="splitter-map-empty">No weak optical signals recorded.</p>'
        : overview.weakCustomers.map((entry) => `<article class="splitter-weak-card"><p><span>Customer</span><strong>${escapeHtml(entry.customerName || 'Unnamed')}</strong></p><p><span>Splitter</span><strong>${escapeHtml(entry.boxId)} · port ${escapeHtml(String(entry.splitterPort ?? entry.port ?? ''))}</strong></p><p><span>RX signal</span><strong>${escapeHtml(formatRxDbm(entry.lastRxDbm))}</strong></p><span class="safety-badge badge-danger">High-loss · check attenuation</span></article>`).join('');
    }
  }

  const select = $('splitterMapBoxSelect');
  if (select) {
    select.addEventListener('change', () => {
      selectedBoxId = select.value;
      render();
    });
  }
  const closeBtn = $('splitterMapCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openSplitterMapModalBtn') : null;
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      render();
      dialog.showModal();
    });
  }

  return {
    open(prefilter = {}) {
      if (typeof prefilter.boxId === 'string' && prefilter.boxId.trim()) selectedBoxId = prefilter.boxId.trim();
      render();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else if (onToast) onToast('Splitter map is not available in this view.');
    },
    refresh() {
      render();
    }
  };
}
