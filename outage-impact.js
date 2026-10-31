/**
 * outage-impact.js — SISP-7: Daisy-Chain / Feeder Outage Impact & Bulk
 * WhatsApp Alert Tool.
 *
 * Problem: active Ethernet daisy-chains (media converters powered at
 * customer homes) and 2-core fiber drops mean a power outage or unplugged
 * adapter at one house cuts off every downstream home fed through it.
 * This module answers "who loses internet if THIS house goes down?" from
 * two optional fields on the existing customer record — upstreamCustomerId
 * (whose media converter/switch feeds this customer) and fiberZone
 * (Side 1 to Side 4c) — and builds a ready-to-send outage message list
 * for only the affected subscribers.
 *
 * Design rules (kept deliberately):
 * - Pure functions over plain customer arrays; zero imports, so the module
 *   is unit-testable in Node and cannot create an import cycle with
 *   core.js (which imports validateUpstreamLink for profile saves).
 * - No new storage: feeder links live on the customer record and travel
 *   with the existing JSON backup merge-field list.
 * - Cycle-safe by construction: every traversal carries a visited set, so
 *   a stored feeder cycle (or a self-link that slipped in before
 *   validation existed) can never infinite-loop.
 * - Archived customers are traversed THROUGH (a chain can pass through a
 *   cancelled house's converter) but never listed as impacted — a
 *   cancelled house has no internet left to lose.
 * - WhatsApp drafts open wa.me links only and never send. A local
 *   03xx-style number never gets a guessed country code: the draft link
 *   is null and the UI says to save the full international number.
 * - Tests use synthetic data only.
 *
 * SISP-71: when the operator has customized the Template Studio
 * "Outage Notice" template (whatsapp-templates.js), buildOutageQueue
 * renders it per subscriber ({name}, {package}, {zone} = feeder zone)
 * instead of the spec-verbatim text below. The templates module imports
 * nothing from core.js, so this cannot create an import cycle.
 */
import { getWaTemplates, renderCustomWaTemplate } from './whatsapp-templates.js';

/** Feeder zones from the spec: Side 1 to Side 4c (with a/b/c splits). */
export const FIBER_ZONES = Object.freeze([
  'Side 1', 'Side 1a', 'Side 1b', 'Side 1c',
  'Side 2', 'Side 2a', 'Side 2b', 'Side 2c',
  'Side 3', 'Side 3a', 'Side 3b', 'Side 3c',
  'Side 4', 'Side 4a', 'Side 4b', 'Side 4c'
]);

/** Spec-verbatim outage message (Roman Urdu). */
export const OUTAGE_MESSAGE_ROMAN =
  'Assalam-o-Alaikum, aap ki line par maintenance/power issue ki wajah se net aarzi band hai, jald bahal ho jayega';

/** Same message in Urdu script. */
export const OUTAGE_MESSAGE_URDU =
  'السلام علیکم، آپ کی لائن پر مینٹیننس/پاور مسئلے کی وجہ سے نیٹ عارضی بند ہے، جلد بحال ہو جائے گا';

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

/** Feeder zone as stored, or null when unset/invalid (never throws). */
export function normalizeFiberZone(value) {
  const zone = cleanText(value);
  return FIBER_ZONES.includes(zone) ? zone : null;
}

/** Feeder fields of one customer record, normalized (never throws). */
export function normalizeFeederFields(customer) {
  const upstream = cleanText(customer?.upstreamCustomerId);
  return {
    upstreamCustomerId: upstream === '' ? null : upstream,
    fiberZone: normalizeFiberZone(customer?.fiberZone)
  };
}

function customerById(customers, id) {
  return (customers ?? []).find((c) => String(c?.id) === String(id)) ?? null;
}

/**
 * Write-time validation for one feeder link. Returns null when the link
 * is fine, otherwise a human-readable error. Empty upstream (direct feed)
 * is always fine; a self-link, an unknown id, or a link that closes a
 * cycle back to this customer is rejected.
 */
export function validateUpstreamLink(customers, customerId, upstreamId) {
  const upstream = cleanText(upstreamId);
  if (upstream === '') return null;
  if (String(upstream) === String(customerId)) {
    return 'A customer cannot feed itself.';
  }
  if (!customerById(customers, upstream)) {
    return 'Upstream customer not found.';
  }
  // Walk the upstream chain from the proposed parent: if it reaches this
  // customer, the link would close a cycle.
  const visited = new Set([String(upstream)]);
  let current = customerById(customers, upstream);
  while (current) {
    const next = cleanText(current.upstreamCustomerId);
    if (next === '') return null;
    if (String(next) === String(customerId)) {
      return 'This link would create a feeder cycle.';
    }
    if (visited.has(String(next))) return null; // pre-existing cycle elsewhere; trace guards it
    visited.add(String(next));
    current = customerById(customers, next);
  }
  return null;
}

/**
 * Downstream adjacency: upstream customer id -> child customer records in
 * roster order. Built fresh on every call so edits are picked up.
 */
export function buildDownstreamMap(customers) {
  const map = new Map();
  for (const customer of customers ?? []) {
    const upstream = cleanText(customer?.upstreamCustomerId);
    if (upstream === '') continue;
    if (!map.has(upstream)) map.set(upstream, []);
    map.get(upstream).push(customer);
  }
  return map;
}

/**
 * Spec criterion (verbatim): linking House A -> House B -> House C and
 * simulating an outage at House A returns [House B, House C].
 * Breadth-first from the source, nearest first, each customer at most
 * once (cycle guard), source itself never listed, archived customers
 * traversed through but never listed as impacted.
 */
export function traceDownstreamImpact(customers, sourceId) {
  const source = customerById(customers, sourceId);
  if (!source) return [];
  const downstream = buildDownstreamMap(customers);
  const visited = new Set([String(source.id)]);
  const queue = [String(source.id)];
  const impacted = [];
  while (queue.length > 0) {
    const currentId = queue.shift();
    for (const child of downstream.get(currentId) ?? []) {
      const childId = String(child.id);
      if (visited.has(childId)) continue;
      visited.add(childId);
      queue.push(childId);
      if (!child.archived) impacted.push(child);
    }
  }
  return impacted;
}

/**
 * wa.me draft link for one phone number, or null when no safe link exists.
 * Local 03xx numbers (leading 0) get no guessed country code, and short
 * fragments get no link at all — the UI then asks for the full
 * international number instead.
 * SISP-118: the queue builders below try the customer's dedicated
 * WhatsApp number first and fall back to the primary phone, expressing
 * the whatsappPhoneFor preference through this module's own link rules
 * (core.js imports this module, so the core seam cannot be imported
 * here without a cycle).
 */
export function outageWhatsAppLink(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits === '' || digits.startsWith('0') || digits.length < 11) return null;
  return `https://wa.me/${digits}`;
}

/** Outage message text in the requested script (Roman default). */
export function buildOutageMessage({ urdu = false } = {}) {
  return urdu ? OUTAGE_MESSAGE_URDU : OUTAGE_MESSAGE_ROMAN;
}

/**
 * Full notification queue for an outage at one source: the source record
 * plus one entry per impacted subscriber (message + optional wa.me link).
 * Returns null when the source id is unknown.
 *
 * SISP-71: pass `templates` (a Template Studio list from getWaTemplates)
 * to let a customized Outage Notice template speak per subscriber; an
 * untouched template — or no templates at all — keeps the spec-verbatim
 * message for every subscriber, exactly as before.
 */
export function buildOutageQueue(customers, sourceId, { urdu = false, templates = null } = {}) {
  const source = customerById(customers, sourceId);
  if (!source) return null;
  const message = buildOutageMessage({ urdu });
  const variant = urdu ? 'urdu' : 'roman';
  return {
    source,
    impacted: traceDownstreamImpact(customers, sourceId).map((customer) => ({
      customer,
      message: (Array.isArray(templates)
        ? renderCustomWaTemplate(templates, 'outageNotice', customer, {}, variant)
        : null) ?? message,
      whatsappLink: outageWhatsAppLink(customer.whatsappPhone) ?? outageWhatsAppLink(customer.phone)
    }))
  };
}

/**
 * SISP-49: daisy-chain alert for ONE complaint source — the customer whose
 * media converter / feeder point a complaint is about, plus every
 * downstream home that loses internet with it. Returns null when the
 * source is unknown or feeds nobody downstream (no dependents, no
 * banner). Pure and read-only: it never mutates the customer list, so a
 * banner can never hide, merge or alter a complaint or a customer
 * record. Each impacted entry carries the same wa.me draft link the
 * outage queue uses, so what the banner lists is exactly what the bulk
 * notification launch will act on.
 */
export function buildDaisyChainAlert(customers, sourceId) {
  const source = customerById(customers, sourceId);
  if (!source) return null;
  const impacted = traceDownstreamImpact(customers, sourceId);
  if (impacted.length === 0) return null;
  return {
    source,
    impacted: impacted.map((customer) => ({
      customer,
      whatsappLink: outageWhatsAppLink(customer.whatsappPhone) ?? outageWhatsAppLink(customer.phone)
    })),
    count: impacted.length
  };
}

/** Copy-all text for a queue: one "Name — message" line per subscriber. */
export function buildOutageQueueText(queue, { urdu = false } = {}) {
  if (!queue) return '';
  const fallbackMessage = buildOutageMessage({ urdu });
  const header = queue.source
    ? `Outage alert — feeder: ${cleanText(queue.source.name) || 'Unknown'}`
    : 'Outage alert';
  if (queue.impacted.length === 0) return `${header}\nNo downstream subscribers affected.`;
  return [
    header,
    '',
    // SISP-71: each entry carries its own message (a customized Outage
    // Notice renders per subscriber); entries without one fall back to
    // the spec-verbatim text, so default queues read exactly as before.
    ...queue.impacted.map((entry) => `${cleanText(entry.customer.name) || 'Unknown'}: ${entry.message ?? fallbackMessage}`)
  ].join('\n');
}

/** Dashboard numbers: how many customers are feeder-linked, longest chain. */
export function summarizeFeederNetwork(customers) {
  const list = customers ?? [];
  let linkedCount = 0;
  let maxDownstream = 0;
  let maxSource = null;
  for (const customer of list) {
    if (cleanText(customer?.upstreamCustomerId) === '') continue;
    linkedCount++;
  }
  for (const customer of list) {
    const count = traceDownstreamImpact(list, customer.id).length;
    if (count > maxDownstream) {
      maxDownstream = count;
      maxSource = customer;
    }
  }
  return { linkedCount, maxDownstream, maxSource };
}

/**
 * Modal controller for the outage simulator, following the downtime
 * analytics modal pattern: a source select, a Trace button, an impacted
 * list with per-subscriber wa.me drafts, a Roman/Urdu toggle, and a
 * Copy-all button. Returns null when the dialog is absent (or when there
 * is no document, e.g. Node tests importing this module).
 */
export function setupOutageImpactModal(getState, { onToast } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('outageImpactModal');
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let sourceId = '';
  let urdu = false;

  function customers() {
    const state = typeof getState === 'function' ? getState() : getState;
    return state?.customers ?? [];
  }

  function renderSourceOptions() {
    const select = $('outageImpactSource');
    if (!select) return;
    const list = customers().filter((c) => !c.archived);
    const current = sourceId;
    select.innerHTML = '<option value="">Choose a customer</option>' + list.map((c) => {
      const label = `${cleanText(c.name) || 'Unknown'}${cleanText(c.mohalla) ? ` · ${cleanText(c.mohalla)}` : ''}`;
      return `<option value="${escapeHtml(String(c.id))}"${String(c.id) === String(current) ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
    if (current && !list.some((c) => String(c.id) === String(current))) sourceId = '';
  }

  function render() {
    const summaryEl = $('outageImpactSummaryLine');
    const listEl = $('outageImpactResultList');
    const copyBtn = $('outageImpactCopyAllBtn');
    if (!sourceId) {
      if (summaryEl) summaryEl.textContent = 'Choose a customer, then trace to see every downstream subscriber who would lose internet.';
      if (listEl) listEl.innerHTML = '';
      if (copyBtn) copyBtn.disabled = true;
      return;
    }
    const queue = buildOutageQueue(customers(), sourceId, { urdu, templates: getWaTemplates() });
    if (!queue) {
      if (summaryEl) summaryEl.textContent = 'Customer not found.';
      if (listEl) listEl.innerHTML = '';
      if (copyBtn) copyBtn.disabled = true;
      return;
    }
    const sourceName = cleanText(queue.source.name) || 'Unknown';
    if (summaryEl) {
      summaryEl.textContent = queue.impacted.length === 0
        ? `${sourceName} feeds nobody downstream — no subscriber loses internet.`
        : `If ${sourceName} goes down, ${queue.impacted.length} downstream subscriber${queue.impacted.length === 1 ? '' : 's'} lose${queue.impacted.length === 1 ? 's' : ''} internet.`;
    }
    if (listEl) {
      listEl.innerHTML = queue.impacted.length === 0
        ? '<p class="outage-impact-empty">No downstream subscribers.</p>'
        : queue.impacted.map((entry) => {
          const name = escapeHtml(cleanText(entry.customer.name) || 'Unknown');
          const meta = escapeHtml([cleanText(entry.customer.mohalla), cleanText(entry.customer.fiberZone)].filter(Boolean).join(' · ') || 'No area / zone');
          const draft = entry.whatsappLink
            ? `<a class="secondary-button" href="${escapeHtml(entry.whatsappLink)}" target="_blank" rel="noopener noreferrer">WhatsApp draft</a>`
            : '<span class="outage-impact-no-phone">Save a full international number to enable a WhatsApp draft.</span>';
          return `<article class="outage-impact-card"><p><span>Subscriber</span><strong>${name}</strong></p><p><span>Area / feeder zone</span><strong>${meta}</strong></p><p class="outage-impact-message">${escapeHtml(entry.message)}</p>${draft}</article>`;
        }).join('');
    }
    if (copyBtn) copyBtn.disabled = queue.impacted.length === 0;
  }

  const sourceSelect = $('outageImpactSource');
  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => {
      sourceId = sourceSelect.value || '';
      render();
    });
  }
  const traceBtn = $('outageImpactTraceBtn');
  if (traceBtn) traceBtn.addEventListener('click', () => {
    sourceId = sourceSelect ? (sourceSelect.value || '') : sourceId;
    render();
  });
  const scriptRadios = dialog.querySelectorAll('[name="outageImpactScript"]');
  scriptRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        urdu = radio.value === 'urdu';
        render();
      }
    });
  });
  const copyBtn = $('outageImpactCopyAllBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const queue = buildOutageQueue(customers(), sourceId, { urdu, templates: getWaTemplates() });
      const text = buildOutageQueueText(queue, { urdu });
      try {
        await navigator.clipboard.writeText(text);
        if (onToast) onToast('Outage message list copied.');
      } catch {
        if (onToast) onToast('Copy failed — select the list text manually.');
      }
    });
  }
  const closeBtn = $('outageImpactCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = document.getElementById('openOutageImpactModalBtn');
  if (openBtn) openBtn.addEventListener('click', () => {
    renderSourceOptions();
    render();
    dialog.showModal();
  });

  return {
    open(prefilter = {}) {
      if (prefilter.sourceId) sourceId = String(prefilter.sourceId);
      renderSourceOptions();
      render();
      dialog.showModal();
    },
    refresh() {
      renderSourceOptions();
      render();
    }
  };
}
