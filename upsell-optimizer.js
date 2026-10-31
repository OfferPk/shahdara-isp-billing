/**
 * upsell-optimizer.js — SISP-59: Customer Speed Upgrade Upsell & ARPU
 * Optimizer.
 *
 * Finds active customers on lower-tier packages (<= 5 Mbps) who either
 * logged slow-speed complaints or paid on time for 3+ consecutive
 * months, and prepares a 1-tap WhatsApp upgrade offer toward the next
 * catalogue tier. STRICTLY READ-ONLY: this module never changes a
 * package, a bill or a payment — it only reads the ledger and builds a
 * wa.me link the operator may tap. Package changes stay with the
 * existing operator flows (profile plan change / Quick Collect).
 *
 * Data honesty — every figure comes from real recorded fields:
 *   - Package truth is the shipped model: customer.packageSpeed (the
 *     catalogue label) + customer.monthlySellingAmount. Speed is read
 *     ONLY from the matched BILL_PACKAGES catalogue entry
 *     (billPackageByLabel -> speedMbps). A customer whose label matches
 *     no catalogue entry has NO provable speed and is never flagged by
 *     the speed rule (documented choice — speeds are never invented
 *     from a free-text label). The current fee is monthlySellingAmount
 *     when it is a positive number, else the matched catalogue price;
 *     with neither, the customer is not a candidate (no fee to lift).
 *   - Target tier: among BILL_PACKAGES entries with speed ABOVE the
 *     current speed AND price ABOVE the current fee, the cheapest
 *     (ties: catalogue order). Spec pin: the Rs. 2,000 5 Mbps customer
 *     targets the Rs. 3,000 tier — in the shipped catalogue that tier
 *     is "15Mbps Unlimited" (there is no 10 Mbps catalogue entry), so
 *     the +Rs. 1,000/month ARPU lift matches the spec exactly and the
 *     target label/speed are the catalogue's own, never invented.
 *   - Slow-speed complaints (no speed category exists in the SISP-15
 *     register's fixed category list, so the matcher is):
 *       * SISP-12 field tickets for this customer whose faultPreset is
 *         exactly 'Slow Speed / High Attenuation' (the shipped speed
 *         preset), OR whose customFault / note text matches a keyword;
 *       * SISP-15 register complaints for this customer whose
 *         issueCategory + resolutionNote text matches a keyword;
 *       * profile incident records (customer.incidents) whose note
 *         text matches a keyword.
 *     Keywords (case-insensitive substring on NFKC-normalized text):
 *     slow, speed, buffer, latency, ping, سست, اسپیڈ, رفتار, بفر.
 *     Open, in-progress and resolved records ALL count — the spec says
 *     "have logged" complaints; a resolved slow-speed complaint is
 *     still a logged one.
 *   - On-time streak: from the allocation engine's own truth
 *     (derivedBillStatus, which already excludes voided SISP-34
 *     payments). A billed month counts when its status is 'paid'.
 *     The streak is the run of consecutive calendar months, all paid,
 *     ending at the newest billed month — except that a newest bill in
 *     the reference (current) month that is not paid yet does not
 *     break the streak (that month is still being collected); the run
 *     then ends at the previous month. Any older unpaid / partial /
 *     unpriced month, or a missing calendar month, breaks the run.
 *     "On time" is defined as fully paid with no arrears carried —
 *     payment dates are not re-judged here because the engine's live
 *     status already proves settlement.
 *   - Eligibility: not archived, isFreeConnection !== true (FREE
 *     connections have no fee to upgrade), serviceStatus === 'active'
 *     (the app's own definition of an active subscriber), provable
 *     speed <= 5 Mbps, a target tier exists, AND (slow-speed
 *     complaints >= 1 OR on-time streak >= 3).
 *
 * Amounts are PKR rupees (the catalogue / monthlySellingAmount unit).
 * Tests use synthetic data only.
 */

import { BILL_PACKAGES, billPackageByLabel } from './package-catalog.js';
import { calculatePaymentAllocations, derivedBillStatus, whatsappPhoneFor } from './core.js';
import { formatWhatsAppUrl } from './form-validation.js';

/** The shipped SISP-12 fault preset that means "slow speed". */
export const SLOW_SPEED_TICKET_PRESET = 'Slow Speed / High Attenuation';

/** Keyword matcher vocabulary for free-text complaint fields. */
export const SLOW_SPEED_KEYWORDS = Object.freeze([
  'slow', 'speed', 'buffer', 'latency', 'ping',
  'سست', 'اسپیڈ', 'رفتار', 'بفر'
]);

export const UPSELL_MAX_SPEED_MBPS = 5;
export const UPSELL_MIN_ON_TIME_STREAK = 3;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** True when the free text reads as a slow-speed complaint. */
export function isSlowSpeedText(value) {
  const normalized = String(value ?? '').normalize('NFKC').toLocaleLowerCase();
  if (!normalized.trim()) return false;
  return SLOW_SPEED_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/**
 * Count one customer's logged slow-speed complaints across the three
 * real ledgers (register complaints, field tickets, profile incidents).
 * Returns the total plus the per-source breakdown.
 */
export function countSlowSpeedComplaints(customer, { complaints = [], tickets = [] } = {}) {
  if (!customer || typeof customer !== 'object') return { total: 0, register: 0, tickets: 0, incidents: 0 };
  const id = String(customer.id ?? '');
  let register = 0;
  for (const complaint of (Array.isArray(complaints) ? complaints : [])) {
    if (!complaint || String(complaint.customerId ?? '') !== id) continue;
    if (isSlowSpeedText(`${complaint.issueCategory ?? ''} ${complaint.resolutionNote ?? ''}`)) register += 1;
  }
  let ticketCount = 0;
  for (const ticket of (Array.isArray(tickets) ? tickets : [])) {
    if (!ticket || String(ticket.customerId ?? '') !== id) continue;
    if (ticket.faultPreset === SLOW_SPEED_TICKET_PRESET
      || isSlowSpeedText(ticket.customFault)
      || isSlowSpeedText(ticket.note)) ticketCount += 1;
  }
  let incidents = 0;
  for (const incident of (Array.isArray(customer.incidents) ? customer.incidents : [])) {
    if (incident && isSlowSpeedText(incident.note)) incidents += 1;
  }
  return { total: register + ticketCount + incidents, register, tickets: ticketCount, incidents };
}

/**
 * The customer's current package truth: catalogue speed (or null when
 * the label proves none), the fee actually charged, and the label.
 */
export function currentPackageInfo(customer) {
  if (!customer || typeof customer !== 'object') return { label: '', speedMbps: null, fee: null, packageId: null };
  const plan = billPackageByLabel(customer.packageSpeed);
  const feeAmount = Number(customer.monthlySellingAmount);
  const fee = Number.isFinite(feeAmount) && feeAmount > 0 ? feeAmount : (plan ? plan.price : null);
  return {
    label: text(customer.packageSpeed) || (plan ? plan.label : ''),
    speedMbps: plan ? plan.speedMbps : null,
    fee,
    packageId: plan ? plan.id : null
  };
}

/**
 * The next catalogue tier above the current speed whose price exceeds
 * the current fee — the cheapest such tier (ties: catalogue order).
 * Returns the catalogue entry or null when no upgrade exists.
 */
export function nextUpgradeTier(speedMbps, fee) {
  if (!Number.isFinite(speedMbps) || !Number.isFinite(fee)) return null;
  let best = null;
  for (const plan of BILL_PACKAGES) {
    if (plan.speedMbps <= speedMbps || plan.price <= fee) continue;
    if (!best || plan.price < best.price) best = plan;
  }
  return best;
}

function previousMonth(month) {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, mon - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** YYYY-MM of a Date in Pakistan time (matches the app's month keys). */
export function pakistanMonthOf(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit'
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}`;
}

/**
 * Consecutive fully-paid billed months (see the header for the exact
 * rule). `allocations` is a calculatePaymentAllocations(state) result.
 */
export function onTimePaidStreak(customer, allocations, referenceMonth = '') {
  if (!customer || typeof customer !== 'object') return 0;
  const bills = (Array.isArray(customer.bills) ? customer.bills : [])
    .filter((bill) => bill && MONTH_RE.test(String(bill.month ?? ''))
      && bill.dueAmount !== null && bill.dueAmount !== undefined && bill.dueAmount !== ''
      && Number.isFinite(Number(bill.dueAmount)) && Number(bill.dueAmount) > 0)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (bills.length === 0) return 0;
  let index = bills.length - 1;
  if (String(bills[index].month) === referenceMonth
    && derivedBillStatus(customer, bills[index], allocations) !== 'paid') {
    index -= 1; // the current month is still being collected
  }
  if (index < 0) return 0;
  let streak = 0;
  let expected = String(bills[index].month);
  for (; index >= 0; index -= 1) {
    if (String(bills[index].month) !== expected) break;
    if (derivedBillStatus(customer, bills[index], allocations) !== 'paid') break;
    streak += 1;
    expected = previousMonth(expected);
  }
  return streak;
}

const rs = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-US')}`;

/**
 * The prefilled WhatsApp upgrade offer (Roman Urdu — the language the
 * operator's customers read). Names the customer, the current package,
 * the target package + price and the monthly difference.
 */
export function buildUpgradeOfferText({ customerName = '', currentLabel = '', currentFee = 0, targetLabel = '', targetPrice = 0, gainPerMonth = 0 } = {}) {
  const name = text(customerName) || 'Customer';
  return `Assalam-o-Alaikum ${name}! Shahdara Fiber Net ki taraf se khaas offer: aap ka maujooda package ${currentLabel} (${rs(currentFee)}/month) hai. Sirf ${rs(gainPerMonth)} zyada mein aap ko ${targetLabel} (${rs(targetPrice)}/month) mil sakta hai — zyada speed, behtar streaming aur gaming! Upgrade karwana ho to is message ka jawab de dein. Shukriya! — Shahdara Fiber Net`;
}

function evaluateCustomer(customer, { complaints, tickets, allocations, referenceMonth }) {
  if (!customer || typeof customer !== 'object') return null;
  if (customer.archived === true) return null;
  if (customer.isFreeConnection === true) return null;
  if ((customer.serviceStatus ?? 'not-set') !== 'active') return null;
  const info = currentPackageInfo(customer);
  if (info.speedMbps === null || info.speedMbps > UPSELL_MAX_SPEED_MBPS) return null;
  if (info.fee === null) return null;
  const target = nextUpgradeTier(info.speedMbps, info.fee);
  if (!target) return null;
  const complaintCounts = countSlowSpeedComplaints(customer, { complaints, tickets });
  const streak = onTimePaidStreak(customer, allocations, referenceMonth);
  const reasons = [];
  if (complaintCounts.total >= 1) reasons.push('complaints');
  if (streak >= UPSELL_MIN_ON_TIME_STREAK) reasons.push('on-time');
  if (reasons.length === 0) return null;
  const gainPerMonth = target.price - info.fee;
  const offerText = buildUpgradeOfferText({
    customerName: customer.name,
    currentLabel: info.label,
    currentFee: info.fee,
    targetLabel: target.label,
    targetPrice: target.price,
    gainPerMonth
  });
  const wa = formatWhatsAppUrl(text(whatsappPhoneFor(customer)), offerText);
  return {
    customerId: customer.id,
    customerNumber: customer.customerNumber ?? null,
    customerName: text(customer.name),
    phone: text(customer.phone),
    mohalla: text(customer.mohalla),
    currentLabel: info.label,
    currentSpeedMbps: info.speedMbps,
    currentFee: info.fee,
    targetId: target.id,
    targetLabel: target.label,
    targetSpeedMbps: target.speedMbps,
    targetPrice: target.price,
    gainPerMonth,
    slowSpeedComplaints: complaintCounts.total,
    complaintBreakdown: complaintCounts,
    onTimeStreak: streak,
    reasons,
    offerText,
    whatsappUrl: wa.validPhone ? wa.url : ''
  };
}

/**
 * All upgrade candidates in the ledger, best ARPU lift first (ties:
 * most slow-speed complaints, longest on-time streak, lowest customer
 * number). Pure and read-only.
 */
export function buildUpsellCandidates(state, { complaints = [], tickets = [] } = {}, referenceDate = new Date()) {
  const customers = state && Array.isArray(state.customers) ? state.customers : [];
  if (customers.length === 0) return [];
  const allocations = calculatePaymentAllocations(state);
  const referenceMonth = pakistanMonthOf(referenceDate);
  const ledgers = {
    complaints: Array.isArray(complaints) ? complaints : [],
    tickets: Array.isArray(tickets) ? tickets : []
  };
  const out = [];
  for (const customer of customers) {
    const candidate = evaluateCustomer(customer, { ...ledgers, allocations, referenceMonth });
    if (candidate) out.push(candidate);
  }
  out.sort((a, b) => (b.gainPerMonth - a.gainPerMonth)
    || (b.slowSpeedComplaints - a.slowSpeedComplaints)
    || (b.onTimeStreak - a.onTimeStreak)
    || (Number(a.customerNumber ?? 0) - Number(b.customerNumber ?? 0)));
  return out;
}

/** One customer's candidate, or null when they are not one. */
export function upsellCandidateForCustomer(state, customer, { complaints = [], tickets = [] } = {}, referenceDate = new Date()) {
  if (!state || !customer) return null;
  const allocations = calculatePaymentAllocations(state);
  return evaluateCustomer(customer, {
    complaints: Array.isArray(complaints) ? complaints : [],
    tickets: Array.isArray(tickets) ? tickets : [],
    allocations,
    referenceMonth: pakistanMonthOf(referenceDate)
  });
}

/** Headline figures for the dashboard card header. */
export function buildUpsellSummary(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  return {
    count: list.length,
    totalGainPerMonth: list.reduce((sum, candidate) => sum + (Number(candidate.gainPerMonth) || 0), 0)
  };
}
