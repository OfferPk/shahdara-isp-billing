/**
 * loyalty-retention.js — SISP-90: Customer Tenure (12+ Months) Loyalty
 * Badge & At-Risk Churn Alert.
 *
 * Two read-only views over the recorded ledger:
 *   1. A loyalty badge ("👑 1+ Yr Loyal") for every customer whose
 *      tenure reaches 12 whole months — shown on the profile heading
 *      and the customer card (via profile-ui.js's loyaltyBadgeHtml).
 *   2. An "At-Risk Loyal Customer" dashboard panel: a loyal (12+
 *      month) subscriber who is having a bad month — 2+ complaints
 *      logged this month, or 12+ hours of downtime this month — is
 *      exactly the long-term customer a personal check-in can save.
 *
 * STRICTLY READ-ONLY: nothing here writes a record, changes a status
 * or sends a message; the panel rows only open the profile.
 *
 * Data honesty — every figure comes from real recorded fields:
 *   - Tenure: whole calendar months from the recorded connectionDate,
 *     computed by uptime-tracking.js's summarizeProfileAge (the PR
 *     #480 precedent). When no connection date is recorded, the
 *     profile-added date (addedOn) is used and the basis is reported
 *     honestly as 'profile' — a start date is never invented, and a
 *     customer with neither date has NO tenure (never badged, never
 *     flagged). A connection that has ended reports the months it
 *     actually ran (status 'ended').
 *   - Complaints this month: records in the two real ledgers whose
 *     customerId matches — SISP-15 register complaints (month from
 *     reportedAt, the operator-entered Pakistan wall-clock datetime;
 *     falling back to the createdAt instant read in Pakistan time)
 *     and SISP-12 field tickets (createdAt, Pakistan wall clock).
 *     ALL statuses count: the spec says "has >= 2 complaints in the
 *     current month" — a complaint resolved yesterday was still
 *     logged this month. Area-outage register entries carry the
 *     AREA_OUTAGE sentinel id and never match a customer.
 *   - Downtime this month: uptime-tracking.js's buildMonthlyUptime
 *     offline minutes for the current Pakistan month — the union of
 *     the customer's recorded profile incidents and service-status
 *     history (the same stored sources the profile uptime summary
 *     uses), clamped to the connection's lifetime and to "now". The
 *     threshold is 12 hours = 720 unioned minutes.
 *   - Eligibility for the panel: not archived, and serviceStatus
 *     'active' or 'offline' (a manually-offline loyal customer is
 *     precisely a churn risk; 'not-set' customers never really
 *     connected). FREE connections are NOT excluded: loyalty here is
 *     tenure, not fees (unlike SISP-59's ARPU rule) — a free 2-year
 *     connection is still a loyal relationship worth saving.
 *
 * Months are Pakistan calendar months ('YYYY-MM'), matching the app's
 * own month keys. Tests use synthetic data only.
 */

import { summarizeProfileAge, buildMonthlyUptime } from './uptime-tracking.js';
import { pakistanMonthOf } from './upsell-optimizer.js';

export const LOYALTY_MIN_TENURE_MONTHS = 12;
export const AT_RISK_MIN_COMPLAINTS_THIS_MONTH = 2;
export const AT_RISK_MIN_DOWNTIME_MINUTES = 12 * 60;

const DATETIME_MONTH_RE = /^(\d{4}-(?:0[1-9]|1[0-2]))-/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The customer's tenure: whole calendar months + remaining days from
 * the recorded start (connectionDate, else the profile-added date —
 * the basis is always reported). Returns months: null when no honest
 * start exists or the start lies in the future.
 */
export function customerTenure(customer, referenceDate = new Date()) {
  if (!customer || typeof customer !== 'object') {
    return { months: null, days: null, totalDays: null, basis: null, startDate: null, status: 'not-recorded' };
  }
  const age = summarizeProfileAge(customer, referenceDate);
  if (!age || age.months === null || age.months === undefined) {
    return { months: null, days: null, totalDays: null, basis: age?.basis ?? null, startDate: age?.startDate ?? null, status: age?.status ?? 'not-recorded' };
  }
  return { months: age.months, days: age.days, totalDays: age.totalDays, basis: age.basis, startDate: age.startDate, status: age.status };
}

/** Tenure + the loyalty verdict for one customer (no ledgers needed). */
export function loyaltyInfoForCustomer(customer, referenceDate = new Date()) {
  const tenure = customerTenure(customer, referenceDate);
  return {
    tenureMonths: tenure.months,
    tenureDays: tenure.days,
    tenureBasis: tenure.basis,
    tenureStartDate: tenure.startDate,
    isLoyal: tenure.months !== null && tenure.months >= LOYALTY_MIN_TENURE_MONTHS
  };
}

/** 'YYYY-MM' a register complaint belongs to (see the header rule). */
export function complaintMonthOf(complaint) {
  if (!complaint || typeof complaint !== 'object') return null;
  const reported = DATETIME_MONTH_RE.exec(String(complaint.reportedAt ?? ''));
  if (reported) return reported[1];
  const created = Date.parse(String(complaint.createdAt ?? ''));
  if (Number.isFinite(created)) return pakistanMonthOf(new Date(created));
  return null;
}

/** 'YYYY-MM' a field ticket belongs to (createdAt is PKT wall clock). */
export function ticketMonthOf(ticket) {
  if (!ticket || typeof ticket !== 'object') return null;
  const created = DATETIME_MONTH_RE.exec(String(ticket.createdAt ?? ''));
  return created ? created[1] : null;
}

/**
 * One customer's complaints logged inside one Pakistan month, across
 * the SISP-15 register and the SISP-12 ticket ledger, with the
 * per-source breakdown.
 */
export function countComplaintsInMonth(customer, { complaints = [], tickets = [] } = {}, month = '') {
  const empty = { total: 0, register: 0, tickets: 0 };
  if (!customer || typeof customer !== 'object' || !month) return empty;
  const id = String(customer.id ?? '');
  if (!id) return empty;
  let register = 0;
  for (const complaint of (Array.isArray(complaints) ? complaints : [])) {
    if (!complaint || String(complaint.customerId ?? '') !== id) continue;
    if (complaintMonthOf(complaint) === month) register += 1;
  }
  let ticketCount = 0;
  for (const ticket of (Array.isArray(tickets) ? tickets : [])) {
    if (!ticket || String(ticket.customerId ?? '') !== id) continue;
    if (ticketMonthOf(ticket) === month) ticketCount += 1;
  }
  return { total: register + ticketCount, register, tickets: ticketCount };
}

/**
 * One customer's downtime in one Pakistan month, in whole unioned
 * minutes, from the recorded incidents + service-status history via
 * uptime-tracking's month summary. 0 when the month is malformed.
 */
export function downtimeMinutesInMonth(customer, month, referenceDate = new Date()) {
  if (!customer || typeof customer !== 'object' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month ?? ''))) return 0;
  try {
    return buildMonthlyUptime(customer, month, referenceDate).offlineMinutes;
  } catch {
    return 0;
  }
}

function evaluateCustomer(customer, { complaints, tickets, month, referenceDate }) {
  if (!customer || typeof customer !== 'object') return null;
  if (customer.archived === true) return null;
  const status = customer.serviceStatus ?? 'not-set';
  if (status !== 'active' && status !== 'offline') return null;
  const info = loyaltyInfoForCustomer(customer, referenceDate);
  if (!info.isLoyal) return null;
  const complaintCounts = countComplaintsInMonth(customer, { complaints, tickets }, month);
  const downtimeMinutes = downtimeMinutesInMonth(customer, month, referenceDate);
  const reasons = [];
  if (complaintCounts.total >= AT_RISK_MIN_COMPLAINTS_THIS_MONTH) reasons.push('complaints');
  if (downtimeMinutes >= AT_RISK_MIN_DOWNTIME_MINUTES) reasons.push('downtime');
  if (reasons.length === 0) return null;
  return {
    customerId: customer.id,
    customerNumber: customer.customerNumber ?? null,
    customerName: text(customer.name),
    mohalla: text(customer.mohalla),
    tenureMonths: info.tenureMonths,
    tenureBasis: info.tenureBasis,
    complaintsThisMonth: complaintCounts.total,
    complaintBreakdown: complaintCounts,
    downtimeMinutes,
    downtimeHours: Math.round((downtimeMinutes / 60) * 10) / 10,
    reasons
  };
}

/**
 * All at-risk loyal customers in the ledger for the reference month,
 * worst month first: most complaints, then most downtime, then the
 * longest tenure, then the lowest customer number. Pure, read-only.
 */
export function buildAtRiskLoyalCustomers(state, { complaints = [], tickets = [] } = {}, referenceDate = new Date()) {
  const customers = state && Array.isArray(state.customers) ? state.customers : [];
  if (customers.length === 0) return [];
  const month = pakistanMonthOf(referenceDate);
  const ledgers = {
    complaints: Array.isArray(complaints) ? complaints : [],
    tickets: Array.isArray(tickets) ? tickets : [],
    month,
    referenceDate
  };
  const out = [];
  for (const customer of customers) {
    const row = evaluateCustomer(customer, ledgers);
    if (row) out.push(row);
  }
  out.sort((a, b) => (b.complaintsThisMonth - a.complaintsThisMonth)
    || (b.downtimeMinutes - a.downtimeMinutes)
    || (b.tenureMonths - a.tenureMonths)
    || (Number(a.customerNumber ?? 0) - Number(b.customerNumber ?? 0)));
  return out;
}

/** One customer's at-risk row, or null when they are not at risk. */
export function atRiskRowForCustomer(state, customer, { complaints = [], tickets = [] } = {}, referenceDate = new Date()) {
  if (!customer) return null;
  return evaluateCustomer(customer, {
    complaints: Array.isArray(complaints) ? complaints : [],
    tickets: Array.isArray(tickets) ? tickets : [],
    month: pakistanMonthOf(referenceDate),
    referenceDate
  });
}

/** Headline figures for the dashboard panel header. */
export function buildLoyaltySummary(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return { count: list.length };
}
