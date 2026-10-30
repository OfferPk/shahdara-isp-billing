/**
 * hardware-speed-audit.js — SISP-69: Package Speed vs Optical RX (dBm)
 * Bottleneck Auditor.
 *
 * Cross-checks three REAL recorded data sources and flags subscribers
 * whose physical line almost certainly cannot deliver the package
 * speed they are on — "Hardware / Optical Bottleneck Suspected":
 *
 *   (a) Package speed >= 15 Mbps. Speed truth is the shipped catalogue
 *       model ONLY: customer.packageSpeed matched against BILL_PACKAGES
 *       via billPackageByLabel -> speedMbps (the SISP-59 precedent,
 *       reused here through currentPackageInfo). A customer whose
 *       label matches no catalogue entry has NO provable speed and is
 *       never flagged — speeds are never parsed out of free-text
 *       labels.
 *   (b) Optical RX signal < -26.0 dBm. The reading is the SISP-24
 *       field stored on the customer record, customer.lastRxDbm,
 *       normalized through splitter-map.js's normalizeOpticalFields
 *       and judged by its own rxSignalStatus / WEAK_RX_DBM_THRESHOLD
 *       (-26.0 dBm — the same weak-signal line the splitter map and
 *       the profile optical section use). The comparison is STRICT:
 *       exactly -26.0 is healthy. A customer with NO recorded RX
 *       reading is 'unknown' and is NEVER flagged — no reading, no
 *       verdict.
 *   (c) Recurring slow-speed complaints — CORROBORATING evidence, not
 *       a gate. Counted with the exact SISP-59 matcher
 *       (countSlowSpeedComplaints: SISP-12 'Slow Speed / High
 *       Attenuation' preset tickets, bilingual keyword matches across
 *       SISP-15 register complaints, tickets and profile incidents;
 *       all statuses count). The count rides on the audit row, drives
 *       the sort priority, and >= BOTTLENECK_RECURRING_COMPLAINTS is
 *       reported as `recurringComplaints`. It is deliberately NOT
 *       required for the flag: a silent customer on a 15 Mbps package
 *       whose light level is -30 dBm has the same physical bottleneck
 *       as one who complained five times — requiring a complaint
 *       would hide exactly the subscribers this audit exists to find.
 *
 * FLAG RULE (pinned in tests): an ACTIVE, non-archived customer is
 * flagged iff (a) AND (b) both hold. (c) never adds or removes a flag.
 *
 * STRICTLY READ-ONLY: this module never writes a record — it only
 * reads the ledger and returns rows for the dashboard panel and the
 * profile hint. Fixing a flagged line stays with the existing field
 * flows (tickets, splitter map, profile optical fields).
 *
 * Amounts are PKR rupees (the catalogue / monthlySellingAmount unit).
 * Tests use synthetic data only.
 */

import { currentPackageInfo, countSlowSpeedComplaints } from './upsell-optimizer.js';
import { normalizeOpticalFields, rxSignalStatus, WEAK_RX_DBM_THRESHOLD } from './splitter-map.js';

/** Minimum catalogue-provable package speed for the audit (Mbps). */
export const BOTTLENECK_MIN_SPEED_MBPS = 15;

/** Slow-speed complaint count at which complaints read as "recurring". */
export const BOTTLENECK_RECURRING_COMPLAINTS = 2;

/** The weak-signal line, re-exported from the SISP-24 source of truth. */
export const BOTTLENECK_WEAK_RX_DBM = WEAK_RX_DBM_THRESHOLD;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function evaluateCustomer(customer, { complaints, tickets }) {
  if (!customer || typeof customer !== 'object') return null;
  if (customer.archived === true) return null;
  if ((customer.serviceStatus ?? 'not-set') !== 'active') return null;
  // (a) catalogue-provable speed >= 15 Mbps — no catalogue match, no flag.
  const info = currentPackageInfo(customer);
  if (info.speedMbps === null || info.speedMbps < BOTTLENECK_MIN_SPEED_MBPS) return null;
  // (b) recorded RX strictly below the -26.0 dBm weak-signal line —
  // 'healthy' and 'unknown' (no reading) both stay unflagged.
  const optical = normalizeOpticalFields(customer);
  if (rxSignalStatus(optical.lastRxDbm) !== 'weak') return null;
  // (c) corroboration only — counted, reported, never gating.
  const complaintCounts = countSlowSpeedComplaints(customer, { complaints, tickets });
  return {
    customerId: customer.id,
    customerNumber: customer.customerNumber ?? null,
    customerName: text(customer.name),
    phone: text(customer.phone),
    mohalla: text(customer.mohalla),
    packageLabel: info.label,
    speedMbps: info.speedMbps,
    fee: info.fee,
    lastRxDbm: optical.lastRxDbm,
    splitterBoxId: optical.splitterBoxId,
    splitterPort: optical.splitterPort,
    oltPonPort: optical.oltPonPort,
    slowSpeedComplaints: complaintCounts.total,
    complaintBreakdown: complaintCounts,
    recurringComplaints: complaintCounts.total >= BOTTLENECK_RECURRING_COMPLAINTS
  };
}

/**
 * All bottleneck suspects in the ledger, weakest RX first (the worst
 * line is the first one to fix), then most slow-speed complaints, then
 * lowest customer number. Pure and read-only.
 */
export function buildBottleneckSuspects(state, { complaints = [], tickets = [] } = {}) {
  const customers = state && Array.isArray(state.customers) ? state.customers : [];
  const ledgers = {
    complaints: Array.isArray(complaints) ? complaints : [],
    tickets: Array.isArray(tickets) ? tickets : []
  };
  const out = [];
  for (const customer of customers) {
    const row = evaluateCustomer(customer, ledgers);
    if (row) out.push(row);
  }
  out.sort((a, b) => (a.lastRxDbm - b.lastRxDbm)
    || (b.slowSpeedComplaints - a.slowSpeedComplaints)
    || (Number(a.customerNumber ?? 0) - Number(b.customerNumber ?? 0)));
  return out;
}

/** One customer's suspect row, or null when they are not flagged. */
export function bottleneckForCustomer(customer, { complaints = [], tickets = [] } = {}) {
  return evaluateCustomer(customer, {
    complaints: Array.isArray(complaints) ? complaints : [],
    tickets: Array.isArray(tickets) ? tickets : []
  });
}

/** Headline figures for the dashboard panel header. */
export function buildBottleneckSummary(suspects) {
  const list = Array.isArray(suspects) ? suspects : [];
  return {
    count: list.length,
    recurringCount: list.filter((row) => row.recurringComplaints).length,
    weakestRxDbm: list.length ? Math.min(...list.map((row) => row.lastRxDbm)) : null
  };
}
