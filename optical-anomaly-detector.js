/**
 * optical-anomaly-detector.js — SISP-132: Splitter-Wide vs. Single-Port
 * Optical Loss (dBm) Classifier.
 *
 * Problem: a weak RX reading (< -26.0 dBm) on one customer can mean two
 * very different faults — a damaged drop fibre/connector for that one
 * house, or a feeder-side problem (upstream core / coupler) degrading
 * EVERY port on the splitter box. Sending the lineman out with the
 * wrong assumption wastes the visit. This module compares a customer's
 * recorded lastRxDbm against the sibling ports on the same
 * splitterBoxId and classifies the fault before anyone leaves.
 *
 * Facts are REUSED, never re-derived: the optical fields and the weak
 * line come from splitter-map.js (SISP-24) — normalizeOpticalFields,
 * rxSignalStatus and WEAK_RX_DBM_THRESHOLD (-26.0 dBm, weak = strictly
 * below). This module owns no storage and invents no plant model: the
 * sibling set is the active (non-archived) customers sharing the box.
 *
 * Classification rule (for a customer whose own reading is weak):
 *   - degradedCount = active customers on the same box whose recorded
 *     reading is weak (including this customer).
 *   - degradedCount >= 2  -> 'splitter-wide' (Splitter-Wide Feeder
 *     Fault — check the upstream core / coupler first).
 *   - degradedCount == 1  -> 'isolated' (Isolated Drop Fault — only
 *     this port is weak; the fault is in this drop/connector).
 * A customer with no reading, a healthy reading, no splitter box, or an
 * archived record is NEVER classified (null). A box whose only active
 * port has a weak reading can only classify 'isolated' — there is no
 * sibling evidence for anything wider.
 *
 * Everything here is a pure derivation from recorded readings:
 * rendering a classification mutates no state and never edits a
 * lastRxDbm or any other plant record.
 *
 * Surfaces (wired in app.js / splitter-map.js / complaint-tickets.js):
 * the customer profile optical section, the splitter port map modal
 * (per weak-signal card + per selected box, via host callbacks), and
 * the field-ticket card for 'Slow Speed / High Attenuation' tickets
 * (via a host callback). On tickets the classification is derived LIVE
 * at view time — never stamped onto the ticket at creation — so it can
 * never go stale as readings are updated.
 */

import { WEAK_RX_DBM_THRESHOLD, normalizeOpticalFields, rxSignalStatus } from './splitter-map.js';
import { t } from './nav-language.js';

/** The house weak-signal line (SISP-24): weak = strictly below this. */
export const OPTICAL_DEGRADED_THRESHOLD_DBM = WEAK_RX_DBM_THRESHOLD;

export const ISOLATED_DROP_FAULT = 'isolated';
export const SPLITTER_WIDE_FAULT = 'splitter-wide';

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
 * Active (non-archived) customers recorded on one splitter box, with
 * their normalized optical fields. Archived customers are excluded:
 * their stale readings are not sibling evidence.
 */
export function activeBoxMembers(customers, boxId) {
  const cleanBoxId = cleanText(boxId);
  if (!cleanBoxId) return [];
  const members = [];
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object' || customer.archived) continue;
    const optical = normalizeOpticalFields(customer);
    if (!optical.splitterBoxId || optical.splitterBoxId !== cleanBoxId) continue;
    members.push({
      customerId: customer.id ?? null,
      customerName: customer.name ?? '',
      splitterPort: optical.splitterPort,
      lastRxDbm: optical.lastRxDbm,
      signalStatus: rxSignalStatus(optical.lastRxDbm)
    });
  }
  return members;
}

function kindForDegradedCount(degradedCount) {
  if (degradedCount >= 2) return SPLITTER_WIDE_FAULT;
  if (degradedCount === 1) return ISOLATED_DROP_FAULT;
  return null;
}

/**
 * Optical summary for ONE splitter box over its active members.
 * kind is null while no active port on the box is weak.
 */
export function classifySplitterBoxFault(customers, boxId) {
  const cleanBoxId = cleanText(boxId);
  const members = activeBoxMembers(customers, cleanBoxId);
  const degradedMembers = members.filter((m) => m.signalStatus === 'weak');
  return {
    kind: kindForDegradedCount(degradedMembers.length),
    boxId: cleanBoxId,
    memberCount: members.length,
    readingsCount: members.filter((m) => m.signalStatus !== 'unknown').length,
    degradedCount: degradedMembers.length,
    degradedMembers
  };
}

/**
 * Classify ONE customer's weak reading against their box siblings.
 * Returns null when the customer is unknown, archived, has no splitter
 * box, or their own recorded reading is not weak (healthy / missing).
 */
export function classifyCustomerOpticalFault(customers, customerId) {
  const list = Array.isArray(customers) ? customers : [];
  const customer = list.find((c) => c && String(c.id) === String(customerId));
  if (!customer || customer.archived) return null;
  const optical = normalizeOpticalFields(customer);
  if (!optical.splitterBoxId) return null;
  if (rxSignalStatus(optical.lastRxDbm) !== 'weak') return null;
  const box = classifySplitterBoxFault(list, optical.splitterBoxId);
  return {
    kind: box.kind,
    boxId: optical.splitterBoxId,
    customerId: customer.id ?? null,
    splitterPort: optical.splitterPort,
    lastRxDbm: optical.lastRxDbm,
    memberCount: box.memberCount,
    readingsCount: box.readingsCount,
    degradedCount: box.degradedCount,
    degradedPeers: box.degradedMembers.filter((m) => String(m.customerId) !== String(customer.id))
  };
}

/** Short translated badge label for a classification ('' when null). */
export function opticalFaultLabel(classification) {
  if (!classification || !classification.kind) return '';
  return classification.kind === SPLITTER_WIDE_FAULT
    ? t('optcls_wide_badge')
    : t('optcls_isolated_badge');
}

/** Translated guidance line for a classification ('' when null). */
export function opticalFaultHintText(classification) {
  if (!classification || !classification.kind) return '';
  const params = { box: classification.boxId || '', count: classification.degradedCount ?? 0 };
  return classification.kind === SPLITTER_WIDE_FAULT
    ? t('optcls_wide_hint', null, params)
    : t('optcls_isolated_hint', null, params);
}

/**
 * Badge HTML for a classification: amber for an isolated drop fault,
 * red for a splitter-wide feeder fault. Reuses the theme-aware
 * .safety-badge classes (light + dark variants ship in styles.css), so
 * no new CSS and no new colours. '' when there is no classification.
 */
export function opticalFaultBadgeHtml(classification) {
  const label = opticalFaultLabel(classification);
  if (!label) return '';
  const tone = classification.kind === SPLITTER_WIDE_FAULT ? 'badge-danger' : 'badge-warning';
  return `<span class="safety-badge ${tone} optical-fault-badge">${escapeHtml(label)}</span>`;
}

/** Badge + guidance line together, for profile / ticket rows. */
export function opticalFaultLineHtml(classification) {
  const badge = opticalFaultBadgeHtml(classification);
  if (!badge) return '';
  const hint = opticalFaultHintText(classification);
  return hint ? `${badge} <span class="optical-fault-hint">${escapeHtml(hint)}</span>` : badge;
}
