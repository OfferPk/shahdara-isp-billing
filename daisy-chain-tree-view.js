/**
 * daisy-chain-tree-view.js — SISP-157: Zone Daisy-Chain Topology Tree &
 * Hop 3+ Deep-Chain Warning.
 *
 * The feeder chain already lives on the customer record as
 * upstreamCustomerId (SISP-7's model — outage-impact.js walks it for
 * outage tracing). This module renders that SAME chain as an indented
 * topology tree, grouped Zone (canonicalMohalla) → Splitter Box → root
 * homes and their descendants, so a technician can see at a glance which
 * houses hang off which box and how deep each chain runs. Homes at
 * Hop 3 or deeper are flagged "⚠️ Deep Chain (Hop 3+) — Recommend
 * Direct Drop": every extra converter hop is another house whose power
 * cut kills everything below it.
 *
 * Design rules (kept deliberately):
 * - Pure builder over the customers array; the module invents no
 *   storage and mutates nothing — the tree is re-derived every render.
 * - Import graph: phase3.js (canonicalMohalla), splitter-map.js
 *   (normalizeOpticalFields), outage-impact.js (normalizeFeederFields)
 *   and nav-language.js (t) are all import-free leaves, so this module
 *   cannot create a cycle. It is imported ONLY by app.js, so it inlines
 *   into the existing bundle graph (dist stays at the #219 budget).
 * - Cycle-safe by construction (the outage-impact.js visited-set
 *   rule): every descent carries its ancestor set, so a stored feeder
 *   cycle can never hang the render. A link that points back to an
 *   ancestor renders ONCE as a terminal circular node and the chain
 *   stops there.
 * - Rootless cycle components (A feeds B, B feeds A, neither is a
 *   root) still surface: after every natural root is placed, each
 *   leftover component is rooted at its lowest customerNumber member
 *   with a cycleRoot flag, so no recorded house silently vanishes.
 * - Archived customers render in place (muted, marked) and the chain
 *   is traversed THROUGH them — the same semantics as
 *   traceDownstreamImpact: a cancelled house's converter can still
 *   physically feed the houses below it, and those houses must never
 *   be orphaned by the render.
 * - A customer whose upstreamCustomerId points at a record that no
 *   longer exists (dangling link) becomes a root with a marker —
 *   never a crash, never dropped.
 * - Tests use synthetic data only.
 */

import { canonicalMohalla, DEFAULT_MOHALLAS } from './phase3.js';
import { normalizeOpticalFields } from './splitter-map.js';
import { normalizeFeederFields } from './outage-impact.js';
import { t } from './nav-language.js';

/** Deep-chain flag starts at this hop (spec: Hop >= 3). */
export const DEEP_CHAIN_MIN_HOP = 3;

/** Indentation stops growing past this hop so 390px stays readable. */
export const DAISY_INDENT_CAP_HOP = 6;

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

function customerNumberOf(customer) {
  const n = Number(customer?.customerNumber);
  return Number.isFinite(n) ? n : 0;
}

function byNumberThenName(a, b) {
  return customerNumberOf(a) - customerNumberOf(b)
    || cleanText(a?.name).localeCompare(cleanText(b?.name))
    || String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}

/** Zone identity for one customer (Area Intelligence grouping rule). */
function zoneOf(customer) {
  const canon = canonicalMohalla(customer?.mohalla || customer?.area || '');
  if (!canon) return { zoneKey: '', zoneLabel: '' };
  return { zoneKey: canon.key, zoneLabel: canon.label };
}

const CANONICAL_ZONE_ORDER = new Map(
  DEFAULT_MOHALLAS.map((name, index) => [canonicalMohalla(name)?.key, index])
);

function zoneSortRank(zoneKey) {
  if (zoneKey === '') return Number.MAX_SAFE_INTEGER; // unrecorded area last
  const rank = CANONICAL_ZONE_ORDER.get(zoneKey);
  return rank === undefined ? DEFAULT_MOHALLAS.length : rank;
}

/**
 * Build the full topology tree.
 *
 * @param {Object|Array} state - app state ({ customers }) or a bare
 *   customers array.
 * @returns {{ zones: Array, totals: Object }} zones in canonical order;
 *   each zone: { zoneKey, zoneLabel, boxes: [{ boxId, roots: [node] }] };
 *   each node: { id, customerId, name, customerNumber, hop, deepChain,
 *   archived, cycle, cycleRoot, danglingUpstream, children: [node] }.
 *   A node with cycle: true is the terminal back-link reference to an
 *   ancestor that already appears in the tree — it is not a second
 *   placement of that customer.
 */
export function buildDaisyChainTree(state, options = {}) {
  void options;
  const customers = Array.isArray(state) ? state : (state?.customers ?? []);
  const list = Array.isArray(customers) ? customers : [];

  const byId = new Map();
  for (const customer of list) {
    if (customer?.id === null || customer?.id === undefined || String(customer.id) === '') continue;
    const key = String(customer.id);
    if (!byId.has(key)) byId.set(key, customer);
  }

  // Downstream adjacency (parent id -> child records, roster order),
  // the same adjacency buildDownstreamMap builds for outage tracing.
  const childrenOf = new Map();
  for (const customer of list) {
    const upstream = normalizeFeederFields(customer).upstreamCustomerId;
    if (upstream === null) continue;
    const key = String(upstream);
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(customer);
  }
  for (const children of childrenOf.values()) children.sort(byNumberThenName);

  const totals = {
    placed: 0,
    roots: 0,
    deepChain: 0,
    cycleLinks: 0,
    cycleRoots: 0,
    archived: 0,
    maxHop: 0
  };
  const placed = new Set();
  const zoneMap = new Map(); // zoneKey -> { zoneKey, zoneLabel, boxes: Map }

  function zoneGroup(customer) {
    const { zoneKey, zoneLabel } = zoneOf(customer);
    if (!zoneMap.has(zoneKey)) zoneMap.set(zoneKey, { zoneKey, zoneLabel, boxes: new Map() });
    return zoneMap.get(zoneKey);
  }

  function boxGroup(zone, boxId) {
    if (!zone.boxes.has(boxId)) zone.boxes.set(boxId, { boxId, roots: [] });
    return zone.boxes.get(boxId);
  }

  function baseNode(customer, hop) {
    return {
      id: String(customer.id),
      customerId: customer.id,
      name: cleanText(customer.name),
      customerNumber: customerNumberOf(customer),
      hop,
      deepChain: hop >= DEEP_CHAIN_MIN_HOP,
      archived: customer?.archived === true,
      cycle: false,
      cycleRoot: false,
      danglingUpstream: false,
      children: []
    };
  }

  function buildNode(customer, hop, ancestors) {
    const node = baseNode(customer, hop);
    placed.add(String(customer.id));
    totals.placed += 1;
    if (node.deepChain) totals.deepChain += 1;
    if (node.archived) totals.archived += 1;
    if (hop > totals.maxHop) totals.maxHop = hop;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(String(customer.id));
    for (const child of childrenOf.get(String(customer.id)) ?? []) {
      const childId = String(child.id);
      if (nextAncestors.has(childId)) {
        // Back-link to an ancestor (or a self-loop): render the
        // reference once, flagged circular, and stop the descent.
        const terminal = baseNode(child, hop + 1);
        terminal.cycle = true;
        totals.cycleLinks += 1;
        node.children.push(terminal);
        continue;
      }
      node.children.push(buildNode(child, hop + 1, nextAncestors));
    }
    return node;
  }

  function placeRoot(customer, { cycleRoot = false } = {}) {
    const zone = zoneGroup(customer);
    const boxId = normalizeOpticalFields(customer).splitterBoxId;
    const box = boxGroup(zone, boxId);
    const node = buildNode(customer, 1, new Set());
    node.cycleRoot = cycleRoot;
    if (cycleRoot) totals.cycleRoots += 1;
    const upstream = normalizeFeederFields(customer).upstreamCustomerId;
    if (upstream !== null && !byId.has(String(upstream))) node.danglingUpstream = true;
    box.roots.push(node);
    totals.roots += 1;
    return node;
  }

  // Phase 1: natural roots — no upstream, or an upstream id that no
  // longer resolves (dangling). Sorted so root order is stable.
  const naturalRoots = list
    .filter((customer) => {
      if (customer?.id === null || customer?.id === undefined || String(customer.id) === '') return false;
      const upstream = normalizeFeederFields(customer).upstreamCustomerId;
      return upstream === null || !byId.has(String(upstream));
    })
    .sort(byNumberThenName);
  for (const root of naturalRoots) {
    if (!placed.has(String(root.id))) placeRoot(root);
  }

  // Phase 2: rootless cycle components. Every leftover customer feeds
  // into (or sits on) a cycle with no natural root; root each leftover
  // component at its lowest customerNumber member. The descent from
  // that member reaches the whole component (cycle members + every
  // in-feeding tree), so one synthetic root per component suffices.
  const leftovers = list
    .filter((customer) => customer?.id !== null && customer?.id !== undefined
      && String(customer.id) !== '' && !placed.has(String(customer.id)))
    .sort(byNumberThenName);
  for (const customer of leftovers) {
    if (!placed.has(String(customer.id))) placeRoot(customer, { cycleRoot: true });
  }

  const zones = [...zoneMap.values()]
    .sort((a, b) => zoneSortRank(a.zoneKey) - zoneSortRank(b.zoneKey)
      || a.zoneKey.localeCompare(b.zoneKey))
    .map((zone) => ({
      zoneKey: zone.zoneKey,
      zoneLabel: zone.zoneLabel,
      boxes: [...zone.boxes.values()]
        .sort((a, b) => (a.boxId === '' ? 1 : 0) - (b.boxId === '' ? 1 : 0)
          || a.boxId.localeCompare(b.boxId))
        .map((box) => ({
          boxId: box.boxId,
          roots: box.roots.sort((a, b) => a.customerNumber - b.customerNumber
            || a.name.localeCompare(b.name))
        }))
    }));

  return { zones, totals };
}

function nodeChipsHtml(node, lang) {
  const chips = [];
  if (node.deepChain) {
    chips.push(`<span class="daisy-chip daisy-chip-deep">${escapeHtml(t('daisychain_deep_warning', lang))}</span>`);
  }
  if (node.cycle) {
    chips.push(`<span class="daisy-chip daisy-chip-cycle">${escapeHtml(t('daisychain_cycle', lang))}</span>`);
  }
  if (node.cycleRoot) {
    chips.push(`<span class="daisy-chip daisy-chip-cycle">${escapeHtml(t('daisychain_cycle_root', lang))}</span>`);
  }
  if (node.danglingUpstream) {
    chips.push(`<span class="daisy-chip">${escapeHtml(t('daisychain_dangling', lang))}</span>`);
  }
  if (node.archived) {
    chips.push(`<span class="daisy-chip">${escapeHtml(t('daisychain_archived', lang))}</span>`);
  }
  return chips.join('');
}

function nodeRowsHtml(node, lang, rows) {
  const indentHop = Math.min(node.hop, DAISY_INDENT_CAP_HOP);
  const name = escapeHtml(node.name || t('dash_fallback_unknown', lang));
  rows.push(
    `<button type="button" class="daisy-node${node.archived ? ' daisy-node-archived' : ''}" data-daisy-customer="${escapeHtml(node.id)}" style="--hop:${indentHop}">`
    + `<span class="daisy-node-name">${name}</span>`
    + `<span class="daisy-node-num">#${escapeHtml(String(node.customerNumber))}</span>`
    + `<span class="daisy-hop-badge">${escapeHtml(t('daisychain_hop', lang, { hop: node.hop }))}</span>`
    + nodeChipsHtml(node, lang)
    + '</button>'
  );
  for (const child of node.children) nodeRowsHtml(child, lang, rows);
  return rows;
}

/**
 * Render the tree as HTML (pure — the same markup the modal shows, so
 * Node tests assert against exactly what the owner sees).
 */
export function renderDaisyChainTreeHtml(tree, lang = null) {
  const totals = tree?.totals ?? { placed: 0, roots: 0, deepChain: 0, cycleLinks: 0, cycleRoots: 0 };
  const parts = [];
  parts.push(`<p class="daisy-tree-intro">${escapeHtml(t('daisychain_intro', lang))}</p>`);
  parts.push(`<p class="daisy-tree-summary">${escapeHtml(t('daisychain_summary', lang, {
    roots: totals.roots,
    deep: totals.deepChain,
    cycles: (totals.cycleLinks ?? 0) + (totals.cycleRoots ?? 0)
  }))}</p>`);
  if (!tree || totals.placed === 0) {
    parts.push(`<p class="daisy-tree-empty">${escapeHtml(t('daisychain_empty', lang))}</p>`);
    return parts.join('');
  }
  for (const zone of tree.zones) {
    const zoneLabel = zone.zoneKey === '' ? t('daisychain_zone_none', lang) : zone.zoneLabel;
    parts.push(`<section class="daisy-zone"><h3>📍 ${escapeHtml(zoneLabel)}</h3>`);
    for (const box of zone.boxes) {
      const boxLabel = box.boxId === ''
        ? t('daisychain_no_box', lang)
        : t('daisychain_box', lang, { box: box.boxId });
      parts.push(`<div class="daisy-box"><h4>🔌 ${escapeHtml(boxLabel)}</h4>`);
      const rows = [];
      for (const root of box.roots) nodeRowsHtml(root, lang, rows);
      parts.push(rows.join(''));
      parts.push('</div>');
    }
    parts.push('</section>');
  }
  return parts.join('');
}

/**
 * Modal controller for the topology tree, following the outage impact
 * modal pattern: an open button, a close button, and a read-only
 * rendered tree. Tapping a home hands its id to onOpenCustomer (app.js
 * closes over selectCustomer). Returns null when the dialog is absent
 * (or when there is no document, e.g. Node tests importing this module).
 */
export function setupDaisyChainTreeModal(getState, { onToast, onOpenCustomer } = {}) {
  void onToast;
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('daisyChainTreeModal');
  if (!dialog) return null;
  const content = dialog.querySelector('#daisyChainTreeContent');

  function customers() {
    const state = typeof getState === 'function' ? getState() : getState;
    return state?.customers ?? [];
  }

  function render() {
    if (!content) return;
    const state = typeof getState === 'function' ? getState() : getState;
    const tree = buildDaisyChainTree(state ?? { customers: customers() });
    content.innerHTML = renderDaisyChainTreeHtml(tree);
  }

  if (content) {
    content.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-daisy-customer]');
      if (!button || typeof onOpenCustomer !== 'function') return;
      const id = button.getAttribute('data-daisy-customer');
      if (!id) return;
      dialog.close();
      onOpenCustomer(id);
    });
  }
  const closeBtn = dialog.querySelector('#daisyChainTreeCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = document.getElementById('openDaisyChainTreeModalBtn');
  if (openBtn) openBtn.addEventListener('click', () => {
    render();
    dialog.showModal();
  });

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
