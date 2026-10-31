/**
 * olt-pon-capacity.js — SISP-103: OLT PON Port (PON-1..PON-8) Capacity &
 * Split Ratio Saturation Alert.
 *
 * Problem: a GPON port feeds at most 64 ONUs (1:64 split). As a street
 * fills up, the owner needs to see — per OLT PON port — how many active
 * ONUs are on it, how much speed has been sold against it, and a clear
 * warning BEFORE the port is full, not after a new install fails.
 *
 * Data model (derived, never stored): this module invents no storage.
 * The PON assignment lives ON the customer record as the free-text
 * `oltPonPort` field (SISP-24 optical fields, validated in core.js —
 * e.g. "PON 1/2/3", where 1 is the OLT PON port and the rest is the
 * splitter cascade path). Street splitter boxes are likewise derived
 * from customer records (splitter-map.js buildSplitterBoxes), so a box
 * is attributed to the port(s) its own customers record. Aggregation:
 *
 *   active (non-archived) customers
 *     -> parse the PON port number out of their recorded oltPonPort
 *     -> group per port; customers with no parseable port form ONE
 *        honest "Unassigned" bucket (never given an invented port,
 *        a default, or a capacity figure).
 *
 * Sold Mbps reuses the app's existing speed resolution
 * (mikrotik-generator.js resolvePackageSpeedMbps — package catalogue
 * label match, then a "<number> Mbps" parse of packageSpeed). A
 * customer whose speed cannot be resolved counts toward the ONU count,
 * contributes 0 sold Mbps, and is counted as `unpricedCount` so the
 * gap is visible instead of silently priced.
 *
 * Oversubscription ratio = total sold Mbps on the port / 2,488 Mbps,
 * the GPON downstream line rate (ITU-T G.984 — the same constant the
 * repo's dashboard-pon-dba.js carries for a GPON port). It states how
 * much of the port's downstream line rate has been sold; > 1.00 means
 * more speed is sold than the line can carry at once.
 *
 * Saturation thresholds (spec): capacity 64 ONUs per port; a port at
 * >= 56 ONUs (87.5%) is flagged amber ("saturation warning"); a port
 * at >= 64 ONUs is flagged red ("port full").
 *
 * READ-ONLY telemetry: every function here is pure — nothing is
 * written, stamped or mutated (pinned by test).
 */

import { normalizeOpticalFields } from './splitter-map.js';
import { resolvePackageSpeedMbps } from './mikrotik-generator.js';

export const PON_PORT_CAPACITY_ONUS = 64;
export const PON_SATURATION_ONUS = 56;
export const GPON_DOWNSTREAM_MBPS = 2488;

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

function roundTo(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Extract the OLT PON port number from a recorded oltPonPort value.
 * Accepts the shapes the profile form invites ("PON 1/2/3", "PON-1",
 * "PON 2") and a bare leading-number cascade ("1/2/3"). Returns null
 * when the record carries no readable port number — the caller groups
 * those customers as Unassigned instead of guessing a port.
 */
export function parsePonPortNumber(oltPonPort) {
  const text = cleanText(oltPonPort);
  if (!text) return null;
  const named = /pon\s*[-#]?\s*(\d+)/i.exec(text);
  if (named) {
    const n = Number.parseInt(named[1], 10);
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
  }
  const leading = /^(\d+)\s*(?:\/|$)/.exec(text);
  if (leading) {
    const n = Number.parseInt(leading[1], 10);
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
  }
  return null;
}

/** Display label for a PON port number: 1 -> "PON-1". */
export function ponPortLabel(portNumber) {
  return `PON-${portNumber}`;
}

/** 'ok' | 'amber' | 'red' for an active-ONU count, per spec thresholds. */
export function ponSaturationLevel(activeOnus) {
  const n = Number(activeOnus);
  if (!Number.isFinite(n)) return 'ok';
  if (n >= PON_PORT_CAPACITY_ONUS) return 'red';
  if (n >= PON_SATURATION_ONUS) return 'amber';
  return 'ok';
}

/**
 * Aggregate active customers into per-PON-port capacity rows plus one
 * Unassigned bucket. Pure: the input array and records are never
 * mutated.
 */
export function buildPonCapacityReport(customers) {
  const list = Array.isArray(customers) ? customers : [];
  const byPort = new Map();
  const unassigned = { activeOnus: 0, soldMbps: 0, unpricedCount: 0, unreadableLabels: [] };
  const unreadable = new Set();
  let activeOnus = 0;
  let soldMbpsTotal = 0;

  for (const customer of list) {
    if (!customer || customer.archived === true) continue;
    activeOnus += 1;
    const optical = normalizeOpticalFields(customer);
    const mbps = resolvePackageSpeedMbps(customer);
    const sold = mbps === null ? 0 : mbps;
    soldMbpsTotal += sold;
    const portNumber = parsePonPortNumber(optical.oltPonPort);
    if (portNumber === null) {
      unassigned.activeOnus += 1;
      unassigned.soldMbps += sold;
      if (mbps === null) unassigned.unpricedCount += 1;
      if (optical.oltPonPort) unreadable.add(optical.oltPonPort);
      continue;
    }
    let row = byPort.get(portNumber);
    if (!row) {
      row = {
        portNumber,
        label: ponPortLabel(portNumber),
        activeOnus: 0,
        soldMbps: 0,
        unpricedCount: 0,
        boxIds: new Set(),
        recordedLabels: new Set()
      };
      byPort.set(portNumber, row);
    }
    row.activeOnus += 1;
    row.soldMbps += sold;
    if (mbps === null) row.unpricedCount += 1;
    if (optical.splitterBoxId) row.boxIds.add(optical.splitterBoxId);
    if (optical.oltPonPort) row.recordedLabels.add(optical.oltPonPort);
  }

  const ports = [...byPort.values()]
    .sort((a, b) => a.portNumber - b.portNumber)
    .map((row) => {
      const soldMbps = roundTo(row.soldMbps, 1);
      return {
        portNumber: row.portNumber,
        label: row.label,
        activeOnus: row.activeOnus,
        capacityOnus: PON_PORT_CAPACITY_ONUS,
        freeOnus: PON_PORT_CAPACITY_ONUS - row.activeOnus,
        fillPercent: roundTo((row.activeOnus / PON_PORT_CAPACITY_ONUS) * 100, 1),
        soldMbps,
        unpricedCount: row.unpricedCount,
        oversubscriptionRatio: roundTo(soldMbps / GPON_DOWNSTREAM_MBPS, 2),
        level: ponSaturationLevel(row.activeOnus),
        boxes: [...row.boxIds].sort(),
        recordedLabels: [...row.recordedLabels].sort()
      };
    });

  unassigned.soldMbps = roundTo(unassigned.soldMbps, 1);
  unassigned.unreadableLabels = [...unreadable].sort();

  return {
    ports,
    unassigned,
    totals: {
      activeOnus,
      assignedOnus: ports.reduce((sum, row) => sum + row.activeOnus, 0),
      soldMbps: roundTo(soldMbpsTotal, 1),
      portCount: ports.length,
      saturatedPorts: ports.filter((row) => row.level !== 'ok').map((row) => row.label),
      fullPorts: ports.filter((row) => row.level === 'red').map((row) => row.label)
    }
  };
}

function formatRatio(ratio) {
  return Number(ratio).toFixed(2);
}

function formatMbps(mbps) {
  return Number.isInteger(mbps) ? String(mbps) : String(roundTo(mbps, 1));
}

/**
 * Render the per-port rows (plus the Unassigned row when it holds
 * anyone) for the dashboard PON capacity card. `tr` is the caller's
 * translator: tr(key, params) -> localized string. All dynamic figures
 * stay Latin; recorded labels and box ids render verbatim (escaped).
 */
export function renderPonCapacityRows(report, tr) {
  const rows = [];
  for (const row of report?.ports ?? []) {
    const detail = [
      tr('poncap_row_sold', { mbps: formatMbps(row.soldMbps) }),
      tr('poncap_row_ratio', { ratio: formatRatio(row.oversubscriptionRatio) }),
      row.freeOnus >= 0
        ? tr('poncap_row_free', { count: row.freeOnus })
        : tr('poncap_row_over', { count: Math.abs(row.freeOnus) }),
      row.unpricedCount > 0 ? tr('poncap_row_unpriced', { count: row.unpricedCount }) : ''
    ].filter(Boolean).join(' · ');
    const flag = row.level === 'red'
      ? `<p class="pon-cap-flag pon-cap-flag-red">${escapeHtml(tr('poncap_flag_red'))}</p>`
      : row.level === 'amber'
        ? `<p class="pon-cap-flag pon-cap-flag-amber">${escapeHtml(tr('poncap_flag_amber'))}</p>`
        : '';
    const boxes = row.boxes.length
      ? `<p><small>${row.boxes.map((boxId) => escapeHtml(boxId)).join(' · ')}</small></p>`
      : '';
    rows.push(`<div class="pon-cap-row pon-cap-row-${row.level}"><p><span class="pon-cap-label">${escapeHtml(row.label)}</span><strong>${escapeHtml(tr('poncap_row_onus', { onus: row.activeOnus, max: row.capacityOnus }))}</strong><small>${escapeHtml(detail)}</small></p>${flag}${boxes}</div>`);
  }
  const unassigned = report?.unassigned;
  if (unassigned && unassigned.activeOnus > 0) {
    const note = [
      tr('poncap_unassigned_note'),
      unassigned.unreadableLabels.length
        ? tr('poncap_unreadable', { labels: unassigned.unreadableLabels.join(', ') })
        : '',
      unassigned.unpricedCount > 0 ? tr('poncap_row_unpriced', { count: unassigned.unpricedCount }) : ''
    ].filter(Boolean).join(' · ');
    rows.push(`<div class="pon-cap-row pon-cap-row-unassigned"><p><span class="pon-cap-label">${escapeHtml(tr('poncap_unassigned'))}</span><strong>${escapeHtml(tr('poncap_unassigned_onus', { onus: unassigned.activeOnus }))}</strong><small>${escapeHtml(note)}</small></p></div>`);
  }
  return rows.join('');
}
