// SISP-97: Upstream Feeder / Switch Power-Host Electricity Credit
// (feederHostCreditPKR).
//
// Problem: in the SISP-7 daisy-chain topology, downstream homes are fed
// through a media converter / switch hosted at an upstream house, and
// that host's electricity runs the equipment around the clock. The owner
// compensates the host with a fixed monthly discount on the host's own
// bill (e.g. Rs. 200). This module owns that amount's rules:
//
// - The configured amount lives on the customer record as
//   feederHostCreditPKR (PKR/month, default 0 = feature inert).
// - Eligibility is DERIVED LIVE from the feeder topology, never stored:
//   a customer is a feeder host only while traceDownstreamImpact (the
//   SISP-7 walk, reused as-is — never a parallel topology walk) finds at
//   least one ACTIVE downstream home fed through it. Archived homes are
//   traversed through by that walk but never counted, matching its
//   shipped semantics.
// - At cycle time the billing cycle (billing-cycle.js) stamps the credit
//   onto the month's bill as audited bill fields — feederHostCreditAmount
//   + feederHostCreditReason + feederHostCreditAppliedAt, plus an
//   amountHistory entry — exactly the SISP-30 concession shape: the
//   bill's dueAmount itself is never rewritten, and the presentation
//   layers (receipt.js, png-receipt.js, thermal-printer.js) subtract the
//   stamp from the net due.
//
// The credit is clamped to the month's package fee at plan time (see
// clampFeederHostCredit), so it can never exceed the package part of the
// bill, drive a due below zero, or manufacture advance credit.
//
// Tests use synthetic data only.

import { traceDownstreamImpact } from './outage-impact.js';

/** Audit reason stored on the bill when a cycle applies the credit. */
export const FEEDER_HOST_CREDIT_REASON = 'Feeder Host Bijli Credit';

/**
 * Clean a stored / entered feeder-host credit amount: a finite,
 * non-negative, 2-decimal PKR number, or 0 for anything else (absent,
 * blank, negative, non-numeric). Mirrors the SISP-30 concession
 * sanitizer's shape.
 */
export function sanitizeFeederHostCreditPKR(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

/** The credit configured on one customer record (0 when unset/invalid). */
export function feederHostCreditOf(customer) {
  return sanitizeFeederHostCreditPKR(customer?.feederHostCreditPKR);
}

/**
 * How many ACTIVE downstream homes are fed through this customer, via
 * the existing SISP-7 topology walk (cycle-safe; archived homes are
 * traversed through but never counted; the customer itself never
 * counts).
 */
export function activeDownstreamCount(customers, customerId) {
  const list = Array.isArray(customers) ? customers : [];
  return traceDownstreamImpact(list, customerId).length;
}

/**
 * A genuine feeder host: a non-archived customer feeding at least one
 * active downstream home. Derived fresh on every call, so removing the
 * last downstream link (or archiving the last downstream home) ends the
 * eligibility immediately — no stored entitlement can go stale.
 */
export function isFeederHost(customers, customer) {
  if (!customer || customer.archived) return false;
  return activeDownstreamCount(customers, customer.id) >= 1;
}

/**
 * The credit that may actually be deducted for this customer right now:
 * the configured amount when the customer is currently a feeder host,
 * otherwise 0.
 */
export function eligibleFeederHostCredit(customers, customer) {
  return isFeederHost(customers, customer) ? feederHostCreditOf(customer) : 0;
}

/**
 * Clamp a credit to the month's package fee (house money-cent math):
 * the credit waives package fee only — never the kist part, never more
 * than the package part, never a negative amount.
 */
export function clampFeederHostCredit(amount, packageFee) {
  const creditCents = Math.round(sanitizeFeederHostCreditPKR(amount) * 100);
  const fee = Number(packageFee);
  const feeCents = Number.isFinite(fee) && fee > 0 ? Math.round(fee * 100) : 0;
  return Math.min(creditCents, feeCents) / 100;
}
