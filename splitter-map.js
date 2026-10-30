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
 *
 * SISP-66 extends this module with the Splitter Box Cut Simulator and the
 * Attenuation Ticket link: simulating a cut on one box lists every
 * subscriber it feeds — the customers assigned to its ports PLUS their
 * transitive SISP-7 downstream homes (upstreamCustomerId chain) — as a
 * ready-to-send WhatsApp maintenance alert queue (read-only: a simulation
 * never changes network state), and any port whose recorded RX is below
 * -27.0 dBm can raise a SISP-12 lineman ticket in one click through the
 * existing createTicket flow (no parallel store).
 */

import { t } from './nav-language.js';
import { buildOutageMessage, traceDownstreamImpact } from './outage-impact.js';
import { formatWhatsAppUrl } from './form-validation.js';
import { createTicket } from './complaint-tickets.js';

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
  const attBadge = isAttenuationTicketRx(slot.lastRxDbm)
    ? '<span class="safety-badge badge-danger splitter-weak-badge">Attenuation ticket advised</span>'
    : '';
  return `<div class="splitter-port splitter-port-occupied${slot.signalStatus === 'weak' ? ' splitter-port-weak' : ''}"><span class="splitter-port-number">${slot.port}</span><span class="splitter-port-customer">${escapeHtml(slot.customerName || 'Unnamed')}</span><span class="splitter-port-rx">${escapeHtml(formatRxDbm(slot.lastRxDbm))}</span>${badge}${attBadge}</div>`;
}

/* ------------------------------------------------------------------ */
/* SISP-66: Splitter Box Cut Simulator + Attenuation Ticket link       */
/* ------------------------------------------------------------------ */

/**
 * RX line for the 1-click attenuation ticket: strictly below -27.0 dBm
 * (one dB past the SISP-24 weak-signal warning line at -26.0, so a port
 * can warn without yet needing a ticket). Exactly -27.0 does not qualify;
 * a missing or malformed reading never qualifies.
 */
export const ATTENUATION_TICKET_DBM_THRESHOLD = -27.0;

/** True when a recorded RX reading is low enough to raise an attenuation ticket. */
export function isAttenuationTicketRx(lastRxDbm) {
  const n = lastRxDbm === '' || lastRxDbm === null || lastRxDbm === undefined
    ? null
    : Number(lastRxDbm);
  return Number.isFinite(n) && n < ATTENUATION_TICKET_DBM_THRESHOLD;
}

/**
 * Marker written into an attenuation ticket's note so a second click on
 * the same port recognises the still-open ticket instead of duplicating
 * it (the SISP-44 assign flow's dedupe precedent).
 */
function attenuationTicketMarker(boxId, port) {
  return `Splitter attenuation · ${cleanText(boxId)} port ${port}`;
}

/**
 * SISP-66 cut simulation for ONE splitter box. Returns null when the box
 * id is blank or no customer references it. Otherwise:
 *   direct     — customers assigned to the box's ports (port order;
 *                out-of-range / duplicate assignments are fed by the box
 *                too, so they follow in port-map order),
 *   downstream — every home fed through a direct customer via the SISP-7
 *                upstreamCustomerId chain (transitive, cycle-safe),
 *   affected   — direct + downstream deduplicated by customer id, each
 *                with the maintenance message and a wa.me draft URL
 *                (empty when the phone cannot form a valid WhatsApp
 *                number). Archived customers are never listed (a
 *                cancelled house has no internet left to lose) but the
 *                chain is traced THROUGH them, per the SISP-7 rule.
 * Pure and read-only: nothing here mutates the customer list or any
 * network state.
 */
export function buildSplitterCutSimulation(customers, boxId, { urdu = false } = {}) {
  const list = Array.isArray(customers) ? customers : [];
  const cleanBoxId = cleanText(boxId);
  if (!cleanBoxId) return null;
  const box = buildSplitterBoxes(list).find((item) => item.boxId === cleanBoxId) ?? null;
  if (!box) return null;
  const byId = new Map(list.map((c) => [String(c?.id), c]));
  const message = buildOutageMessage({ urdu });
  const seen = new Set();
  const affected = [];
  const pushAffected = (customer, entry) => {
    if (!customer || customer.archived) return;
    const key = String(customer.id);
    if (seen.has(key)) return;
    seen.add(key);
    const wa = formatWhatsAppUrl(customer.phone || '', message);
    affected.push({ customer, message, whatsappUrl: wa.validPhone ? wa.url : '', ...entry });
  };
  const direct = [];
  for (const slot of box.ports) {
    if (slot.status !== 'occupied' || slot.customerId === null) continue;
    direct.push({ customer: byId.get(String(slot.customerId)) ?? null, port: slot.port, lastRxDbm: slot.lastRxDbm });
  }
  for (const entry of box.outOfRange) {
    if (entry.customerId === null) continue;
    direct.push({ customer: byId.get(String(entry.customerId)) ?? null, port: entry.splitterPort, lastRxDbm: entry.lastRxDbm });
  }
  for (const item of direct) {
    if (!item.customer) continue;
    pushAffected(item.customer, { kind: 'direct', port: item.port, lastRxDbm: item.lastRxDbm });
  }
  for (const item of direct) {
    if (!item.customer) continue;
    for (const downstream of traceDownstreamImpact(list, item.customer.id)) {
      pushAffected(downstream, {
        kind: 'downstream',
        viaCustomerId: String(item.customer.id),
        viaCustomerName: cleanText(item.customer.name)
      });
    }
  }
  const directCount = affected.filter((entry) => entry.kind === 'direct').length;
  return {
    boxId: box.boxId,
    portCount: box.portCount,
    affected,
    count: affected.length,
    directCount,
    downstreamCount: affected.length - directCount
  };
}

/** Copy-all text for a cut simulation queue: one "Name: message" line per subscriber. */
export function buildSplitterCutQueueText(simulation, { urdu = false } = {}) {
  if (!simulation) return '';
  const message = buildOutageMessage({ urdu });
  const header = `Splitter cut alert — box ${simulation.boxId}`;
  if (simulation.affected.length === 0) return `${header}\nNo subscribers affected.`;
  return [
    header,
    '',
    ...simulation.affected.map((entry) => `${cleanText(entry.customer.name) || 'Unknown'}: ${message}`)
  ].join('\n');
}

/**
 * SISP-66: create the SISP-12 lineman ticket for one weak port in one
 * click. The ticket goes through complaint-tickets.js createTicket with
 * the 'Slow Speed / High Attenuation' preset and a note carrying the box,
 * port and recorded RX, so it lands in the normal field-ticket flow —
 * no parallel store. While an UNRESOLVED ticket for the same customer +
 * box + port exists, that ticket is returned with created:false instead
 * of duplicating it. Throws (mirroring createTicket) when the customer,
 * the lineman name or a qualifying RX reading is missing. Returns
 * { tickets, ticket, created } like assignTicketForComplaint; the input
 * list is never mutated.
 */
export function createAttenuationTicket(existingTickets, input, referenceDate = new Date()) {
  const list = Array.isArray(existingTickets) ? existingTickets : [];
  const customer = input?.customer ?? null;
  const customerId = cleanText(customer?.id ?? input?.customerId ?? '');
  if (!customerId) throw new Error('Select a customer first.');
  const technician = cleanText(input?.technician);
  if (!technician) throw new Error('Assign a lineman / technician first.');
  if (!isAttenuationTicketRx(input?.lastRxDbm)) {
    throw new Error(`Attenuation ticket needs an RX reading below ${ATTENUATION_TICKET_DBM_THRESHOLD} dBm.`);
  }
  const boxId = cleanText(input?.boxId);
  const portNumber = Number(input?.port);
  const port = Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 16 ? portNumber : null;
  const marker = attenuationTicketMarker(boxId, port ?? '?');
  const existing = list.find((ticket) => ticket
    && String(ticket.customerId) === customerId
    && ticket.status !== 'Resolved'
    && cleanText(ticket.note).includes(marker));
  if (existing) return { tickets: list, ticket: existing, created: false };
  const dbm = Math.round(Number(input.lastRxDbm) * 10) / 10;
  const ticket = createTicket({
    customerId,
    customerName: cleanText(customer?.name ?? input?.customerName ?? ''),
    faultPreset: 'Slow Speed / High Attenuation',
    technician,
    priority: 'Normal',
    note: `${marker} — RX ${dbm} dBm recorded (ticket line ${ATTENUATION_TICKET_DBM_THRESHOLD} dBm).`
  }, list, referenceDate);
  return { tickets: [...list, ticket], ticket, created: true };
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
export function setupSplitterMapModal(getState, { onToast, onCreateAttenuationTicket } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('splitterMapModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let selectedBoxId = '';
  let simulated = false;
  let simUrdu = false;

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
        : overview.weakCustomers.map((entry) => {
          const attBtn = typeof onCreateAttenuationTicket === 'function' && isAttenuationTicketRx(entry.lastRxDbm)
            ? `<button type="button" class="action-btn-sm splitter-att-btn" data-att-customer="${escapeHtml(String(entry.customerId ?? ''))}" data-att-box="${escapeHtml(entry.boxId)}" data-att-port="${escapeHtml(String(entry.port ?? entry.splitterPort ?? ''))}" data-att-dbm="${escapeHtml(String(entry.lastRxDbm ?? ''))}">${escapeHtml(t('split_att_btn'))}</button>`
            : '';
          return `<article class="splitter-weak-card"><p><span>Customer</span><strong>${escapeHtml(entry.customerName || 'Unnamed')}</strong></p><p><span>Splitter</span><strong>${escapeHtml(entry.boxId)} · port ${escapeHtml(String(entry.splitterPort ?? entry.port ?? ''))}</strong></p><p><span>RX signal</span><strong>${escapeHtml(formatRxDbm(entry.lastRxDbm))}</strong></p><span class="safety-badge badge-danger">High-loss · check attenuation</span>${attBtn}</article>`;
        }).join('');
    }
    renderSimulation();
  }

  // SISP-66: read-only cut simulation for the selected box — the affected
  // list plus one WhatsApp maintenance draft per subscriber.
  function renderSimulation() {
    const summaryEl = $('splitterMapSimSummary');
    const listEl = $('splitterMapSimList');
    const copyBtn = $('splitterMapSimCopyBtn');
    if (!summaryEl && !listEl) return;
    if (!simulated || !selectedBoxId) {
      if (summaryEl) summaryEl.textContent = '';
      if (listEl) listEl.innerHTML = '';
      if (copyBtn) copyBtn.disabled = true;
      return;
    }
    const state = typeof getState === 'function' ? getState() : {};
    const simulation = buildSplitterCutSimulation(state?.customers ?? [], selectedBoxId, { urdu: simUrdu });
    if (!simulation) {
      if (summaryEl) summaryEl.textContent = '';
      if (listEl) listEl.innerHTML = '';
      if (copyBtn) copyBtn.disabled = true;
      return;
    }
    if (summaryEl) {
      summaryEl.textContent = simulation.count === 0
        ? t('split_sim_none')
        : t('split_sim_summary', null, { box: simulation.boxId, count: simulation.count, direct: simulation.directCount, downstream: simulation.downstreamCount });
    }
    if (listEl) {
      listEl.innerHTML = simulation.affected.map((entry) => {
        const name = escapeHtml(cleanText(entry.customer.name) || 'Unknown');
        const meta = escapeHtml([cleanText(entry.customer.mohalla), cleanText(entry.customer.fiberZone)].filter(Boolean).join(' · ') || t('split_sim_no_area'));
        const kind = entry.kind === 'direct'
          ? escapeHtml(t('split_sim_direct', null, { port: entry.port ?? '' }))
          : escapeHtml(t('split_sim_downstream', null, { name: entry.viaCustomerName || 'Unknown' }));
        const draft = entry.whatsappUrl
          ? `<a class="secondary-button" href="${escapeHtml(entry.whatsappUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('split_sim_draft_btn'))}</a>`
          : `<span class="splitter-sim-no-phone">${escapeHtml(t('split_sim_no_phone'))}</span>`;
        return `<article class="splitter-sim-card"><p><span>${name}</span><strong>${kind}</strong></p><p><span>${meta}</span></p><p class="splitter-sim-message">${escapeHtml(entry.message)}</p>${draft}</article>`;
      }).join('');
    }
    if (copyBtn) copyBtn.disabled = simulation.count === 0;
  }

  const select = $('splitterMapBoxSelect');
  if (select) {
    select.addEventListener('change', () => {
      selectedBoxId = select.value;
      simulated = false;
      render();
    });
  }
  const simulateBtn = $('splitterMapSimulateBtn');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', () => {
      simulated = true;
      renderSimulation();
    });
  }
  const simRadios = dialog.querySelectorAll('[name="splitterMapSimScript"]');
  simRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        simUrdu = radio.value === 'urdu';
        if (simulated) renderSimulation();
      }
    });
  });
  const simCopyBtn = $('splitterMapSimCopyBtn');
  if (simCopyBtn) {
    simCopyBtn.addEventListener('click', async () => {
      const state = typeof getState === 'function' ? getState() : {};
      const simulation = buildSplitterCutSimulation(state?.customers ?? [], selectedBoxId, { urdu: simUrdu });
      const text = buildSplitterCutQueueText(simulation, { urdu: simUrdu });
      try {
        await navigator.clipboard.writeText(text);
        if (onToast) onToast(t('split_sim_copied_toast', null, { count: simulation ? simulation.count : 0 }));
      } catch {
        if (onToast) onToast(t('split_sim_copy_failed_toast'));
      }
    });
  }
  const weakListEl = $('splitterMapWeakList');
  if (weakListEl) {
    weakListEl.addEventListener('click', (event) => {
      const btn = event.target.closest('.splitter-att-btn');
      if (!btn) return;
      const technician = ($('splitterMapTechnicianInput')?.value || '').trim();
      if (!technician) {
        if (onToast) onToast(t('cmp_link_technician_required'));
        return;
      }
      const state = typeof getState === 'function' ? getState() : {};
      const customers = state?.customers ?? [];
      const customer = customers.find((c) => String(c.id) === String(btn.dataset.attCustomer)) ?? null;
      try {
        const result = typeof onCreateAttenuationTicket === 'function'
          ? onCreateAttenuationTicket({
            customer,
            customerId: btn.dataset.attCustomer,
            boxId: btn.dataset.attBox,
            port: Number(btn.dataset.attPort),
            lastRxDbm: Number(btn.dataset.attDbm),
            technician
          })
          : null;
        if (result && result.ticket && onToast) {
          onToast(result.created
            ? t('split_att_created_toast', null, { ticket: result.ticket.id })
            : t('split_att_exists_toast', null, { ticket: result.ticket.id }));
        }
      } catch (error) {
        if (onToast) onToast(error && error.message ? error.message : 'Ticket could not be created.');
      }
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
