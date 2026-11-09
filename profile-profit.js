/* profile-profit.js — Polish #28 Phase D: profile calculations.
 *
 * Pure module — no DOM, no state writes — so it is unit-testable in
 * node and shared by the profile view and the form profit preview
 * (one implementation, so the two can never drift apart again).
 *
 * Formulas (all amounts PKR, all fields optional, never invented):
 *   gross = monthlySellingAmount − monthlyPurchaseCost
 *           (the existing customerPackageProfit cents formula — this
 *           module only adds the missing-data guard around it: an
 *           empty string is missing, NOT zero, so selling '' + cost
 *           1,000 no longer reads as a −1,000 loss)
 *   net   = gross − concession this month − payment discounts this
 *           month. Sales tax is a pass-through collected on top of
 *           the package price: it is shown on its own line and is
 *           NEVER subtracted from the net.
 *   concession this month = the current month bill's concessionAmount
 *           (PKR 0 when a bill exists with no concession). Payment
 *           discounts this month = the allocation engine's
 *           discountAppliedCents for this month's bill (the engine is
 *           the single source — a prepay discount converts to credit,
 *           it is never a discount on this bill).
 *   With no bill this month, concession / discounts / net are all
 *           null with 'bill' named as missing — never assumed zero,
 *           because advance payments or credits can exist without a
 *           bill.
 *
 * Investment breakdown (reuses calculateInstallationCost, never a
 * second formula): router + media converter + lineman labor + fiber
 * (meters × rate) + otherInstallCost. Every component whose value is
 * missing is named in `missing` — a partial total is never silent.
 * Fiber costs nothing when zero meters were used, whatever the rate.
 *
 * Recovery period: ceil(investment ÷ monthly gross profit), in whole
 * months, only when investment > 0 AND gross profit > 0. Otherwise
 * the honest kind: 'no-investment', 'nothing-to-recover',
 * 'gross-missing' or 'gross-not-positive' — never a guessed number.
 * 'recovered' when cumulative gross profit since the connection date
 * (gross × full calendar months since connectionDate) has covered the
 * investment; without a connection date the forward period stands and
 * connectionDateMissing is flagged. This is a DIFFERENT figure from
 * the existing install line's "break-even in N monthly bills", which
 * divides the subsidy by the SELLING amount — the new row divides the
 * whole investment by GROSS profit and is labelled so the two can
 * never be confused.
 */

import { customerPackageProfit, calculatePaymentAllocations } from './core.js';
import { customerSalesTaxCents } from './package-sales-tax.js';
import { calculateInstallationCost } from './installation-cost.js';

const VALID_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A money figure, or null when it is missing — never zero. An empty
 *  string, a boolean, null, undefined and anything non-numeric are all
 *  "not recorded", because Number('') is 0 and Number(true) is 1 and
 *  both would invent a figure out of nothing. */
function moneyFigureOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

/** Which gross-profit inputs are missing, as stable identifiers the
 *  view maps to translated labels: 'providerCost' (monthlyPurchaseCost)
 *  and 'sellingAmount' (monthlySellingAmount). */
function grossMissingIdentifiers(customer) {
  const missing = [];
  if (moneyFigureOrNull(customer?.monthlyPurchaseCost) === null) missing.push('providerCost');
  if (moneyFigureOrNull(customer?.monthlySellingAmount) === null) missing.push('sellingAmount');
  return missing;
}

/** Monthly gross profit in rupees, or null when either input is
 *  missing. The arithmetic is customerPackageProfit's (the single
 *  cents formula the view used before); this only guards its inputs. */
export function profileGrossProfit(customer = {}) {
  if (grossMissingIdentifiers(customer).length > 0) return null;
  return customerPackageProfit(customer);
}

/**
 * This month's profit picture for one customer:
 * { gross, tax, concession, discounts, net, missing, hasBill, month }.
 * `tax` is the 19.5% sales tax in rupees (null when there is no
 * package price to tax). `concession` / `discounts` are PKR 0 when a
 * bill exists with none, and null when no bill exists for `month`.
 * `net` is gross − concession − discounts, or null when the gross is
 * missing or there is no bill. `missing` names why: 'providerCost' /
 * 'sellingAmount' for the gross inputs, 'bill' when no bill exists
 * for the month.
 */
export function profileMonthlyProfit(customer = {}, state = {}, month) {
  const grossMissing = grossMissingIdentifiers(customer);
  const gross = grossMissing.length > 0 ? null : customerPackageProfit(customer);
  const taxCents = customerSalesTaxCents(customer);
  const tax = taxCents === null ? null : taxCents / 100;
  const validMonth = typeof month === 'string' && VALID_MONTH_RE.test(month) ? month : null;
  const bill = validMonth
    ? (Array.isArray(customer?.bills) ? customer.bills.find((entry) => entry?.month === validMonth) : undefined) ?? null
    : null;
  const hasBill = bill !== null;
  const concessionAmount = hasBill ? Number(bill.concessionAmount) : NaN;
  const concession = hasBill ? (Number.isFinite(concessionAmount) ? concessionAmount : 0) : null;
  let discounts = null;
  if (hasBill) {
    const summary = calculatePaymentAllocations(state)?.forMonth(customer?.id, validMonth);
    discounts = summary ? summary.discountAppliedCents / 100 : null;
  }
  const missing = [...grossMissing];
  if (!hasBill) missing.push('bill');
  const net = gross !== null && hasBill && discounts !== null ? gross - concession - discounts : null;
  return { gross, tax, concession, discounts, net, missing, hasBill, month: validMonth };
}

/**
 * The installation investment as an itemised breakdown:
 * { router, mediaConverter, lineman, fiber, fiberMeters,
 *   fiberPerMeterRate, other, total, hasAnyCost, missing }.
 * Each component is its recorded figure or null; `missing` names
 * every null component (routerPrice, mediaConverterCost,
 * linemanInstallFee, fiber, otherInstallCost) so a partial total is
 * never silent. `total` is the recorded part only, or null when
 * nothing at all is recorded. Fiber is PKR 0 — not missing — when
 * zero meters were used.
 */
export function profileInvestmentBreakdown(customer = {}) {
  const cost = calculateInstallationCost(customer);
  const missing = [];
  const router = cost.routerPrice;
  if (router === null) missing.push('routerPrice');
  const mediaConverter = cost.mediaConverterCost;
  if (mediaConverter === null) missing.push('mediaConverterCost');
  const lineman = cost.linemanInstallFee;
  if (lineman === null) missing.push('linemanInstallFee');
  // Fiber costs nothing when zero meters were used, whatever the
  // rate — calculateInstallationCost leaves fiberCost null there
  // because the rate is unknown, but a zero length is a known zero.
  let fiber = cost.fiberCost;
  if (fiber === null && cost.fiberMeters === 0) fiber = 0;
  if (fiber === null) missing.push('fiber');
  const other = cost.otherInstallCost;
  if (other === null) missing.push('otherInstallCost');
  const total = cost.hasAnyCost ? cost.totalCost : null;
  return {
    router,
    mediaConverter,
    lineman,
    fiber,
    fiberMeters: cost.fiberMeters,
    fiberPerMeterRate: cost.fiberPerMeterRate,
    other,
    total,
    hasAnyCost: cost.hasAnyCost,
    missing,
  };
}

/**
 * Completed calendar months between two 'YYYY-MM-DD' dates: the
 * calendar-month difference minus one when today's day-of-month is
 * before the connection day-of-month, clamped at zero. Null when
 * either date is missing or malformed.
 */
export function fullMonthsSinceConnection(connectionDate, today) {
  const parse = (value) => {
    if (typeof value !== 'string') return null;
    const match = DATE_RE.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
  };
  const from = parse(connectionDate);
  const to = parse(today);
  if (!from || !to) return null;
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (to.day < from.day) months -= 1;
  return Math.max(0, months);
}

/**
 * The investment recovery picture for one customer:
 * { kind, months, investment, gross, cumulativeGross,
 *   connectionDateMissing, missing }.
 * kind is one of:
 *  - 'no-investment' — nothing recorded at all;
 *  - 'nothing-to-recover' — the recorded investment is PKR 0;
 *  - 'gross-missing' — the gross profit cannot be computed;
 *  - 'gross-not-positive' — gross profit is zero or a loss;
 *  - 'recovered' — cumulative gross profit since the connection
 *    date (gross × full months) has covered the investment;
 *    `months` is the full months since connection;
 *  - 'forward' — months is ceil(investment ÷ gross profit), the
 *    whole months of gross profit still needed.
 * `cumulativeGross` is gross × full months since connection, or null
 * when the connection date is missing. `connectionDateMissing` flags
 * that the Recovered check could not run.
 */
export function profileInvestmentRecovery(customer = {}, options = {}) {
  const breakdown = profileInvestmentBreakdown(customer);
  const grossMissing = grossMissingIdentifiers(customer);
  const gross = grossMissing.length > 0 ? null : customerPackageProfit(customer);
  const investment = breakdown.total;
  const hasConnectionDate = typeof customer?.connectionDate === 'string' && customer.connectionDate !== '';
  const fullMonths = hasConnectionDate
    ? fullMonthsSinceConnection(customer.connectionDate, options?.today)
    : null;
  const cumulativeGross = fullMonths === null || gross === null ? null : fullMonths * gross;
  if (investment === null) {
    return { kind: 'no-investment', months: null, investment: null, gross, cumulativeGross, connectionDateMissing: !hasConnectionDate, missing: grossMissing };
  }
  if (investment === 0) {
    return { kind: 'nothing-to-recover', months: null, investment: 0, gross, cumulativeGross, connectionDateMissing: !hasConnectionDate, missing: grossMissing };
  }
  if (gross === null) {
    return { kind: 'gross-missing', months: null, investment, gross: null, cumulativeGross, connectionDateMissing: !hasConnectionDate, missing: grossMissing };
  }
  if (!(gross > 0)) {
    return { kind: 'gross-not-positive', months: null, investment, gross, cumulativeGross, connectionDateMissing: !hasConnectionDate, missing: [] };
  }
  if (cumulativeGross !== null && cumulativeGross >= investment) {
    return { kind: 'recovered', months: fullMonths, investment, gross, cumulativeGross, connectionDateMissing: false, missing: [] };
  }
  return { kind: 'forward', months: Math.ceil(investment / gross), investment, gross, cumulativeGross, connectionDateMissing: !hasConnectionDate, missing: [] };
}
