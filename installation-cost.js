// SISP-23: New Connection Installation Cost & First-Month Profitability
// Tracker. Pure module — no DOM, no state writes — so it is unit-testable
// in node and reusable from the profile view and the New Customers ledger.
//
// The problem: PR #398 records a connection fee, a router price and the
// fiber meters used, but the owner needs the FULL hardware/wire cost of
// each new installation versus the fee actually collected, so he can see
// whether an install made money or was subsidised by the ISP — and, for
// a subsidy, how many monthly bills it takes to break even on it.
//
// Cost model (all amounts PKR, all fields optional, never invented):
//   totalCost = routerPrice + mediaConverterCost
//             + (fiberMeters x fiberPerMeterRate) + linemanInstallFee
//   net       = connectionFee - totalCost
//   subsidy   = -net when net < 0, otherwise 0
//   breakEvenMonths = ceil(subsidy / monthlySellingAmount) when the
//     subsidy is positive and a monthly amount is known, else null.
//
// Unknown fiber rate: the per-meter rate has no stored field before this
// phase, so when fiber was used but no rate is recorded the fiber cost
// is UNKNOWN — the total is reported as partial and flagged, never
// silently computed with a 0 rate. A caller may pass an explicit
// perMeterRate override (options.perMeterRate) for what-if checks; the
// stored customer.fiberPerMeterRate is the fallback.
//
// Sanitisation mirrors core.js normalizeMoneyOrNull: blank, non-numeric
// or negative inputs become null (not recorded), never 0, never an
// error — a half-filled install record must still render.

const roundMoney = value => Math.round(value * 100) / 100;

function moneyOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return roundMoney(number);
}

function metersOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 10) / 10;
}

export function calculateInstallationCost(customer = {}, options = {}) {
  const source = customer ?? {};
  const connectionFee = moneyOrNull(source.connectionFee);
  const routerPrice = moneyOrNull(source.routerPrice);
  const mediaConverterCost = moneyOrNull(source.mediaConverterCost);
  const linemanInstallFee = moneyOrNull(source.linemanInstallFee);
  const fiberMeters = metersOrNull(source.fiberMeters);
  const fiberPerMeterRate = moneyOrNull(options.perMeterRate ?? source.fiberPerMeterRate);
  // Fiber cost is known only when both the length and the rate are known.
  // Zero meters cost nothing whatever the rate, so they never flag unknown.
  const fiberCost = fiberMeters !== null && fiberPerMeterRate !== null
    ? roundMoney(fiberMeters * fiberPerMeterRate)
    : null;
  const fiberCostUnknown = fiberMeters !== null && fiberMeters > 0 && fiberPerMeterRate === null;
  const knownParts = [routerPrice, mediaConverterCost, linemanInstallFee, fiberCost]
    .filter(part => part !== null);
  const hasAnyCost = knownParts.length > 0;
  const totalCost = roundMoney(knownParts.reduce((sum, part) => sum + part, 0));
  const net = connectionFee !== null ? roundMoney(connectionFee - totalCost) : null;
  const status = connectionFee === null && !hasAnyCost
    ? 'not-recorded'
    : connectionFee === null
      ? 'unknown'
      : net > 0
        ? 'surplus'
        : net < 0
          ? 'subsidy'
          : 'break-even';
  const subsidy = net !== null && net < 0 ? -net : 0;
  const monthlyAmount = moneyOrNull(options.monthlyAmount ?? source.monthlySellingAmount);
  const breakEvenMonths = subsidy > 0 && monthlyAmount !== null && monthlyAmount > 0
    ? Math.ceil(subsidy / monthlyAmount)
    : null;
  return {
    connectionFee,
    routerPrice,
    mediaConverterCost,
    linemanInstallFee,
    fiberMeters,
    fiberPerMeterRate,
    fiberCost,
    fiberCostUnknown,
    totalCost,
    totalIsPartial: fiberCostUnknown,
    hasAnyCost,
    net,
    netIsPartial: fiberCostUnknown,
    status,
    subsidy,
    breakEvenMonths
  };
}

// SISP-73: monthly aggregation over the SAME per-installation computation
// above — never a parallel cost formula. Partner Settlement (SISP-22) and
// Owner Khata (SISP-20) read the month's net installation surplus/subsidy
// from here so the 50/50 CapEx toggle has exactly one source of truth.
//
// The join month mirrors core.js customerJoinMonth's fallback order
// (addedOn, then connectionDate, then billingStartMonth, then the
// earliest bill month). The mirror is deliberate: this module stays
// dependency-free on purpose — core.js imports feature sanitizers, and
// the consumers of this summary (partner-settlement.js, owner-khata.js)
// must not grow a core import path (module-cycle rule).

const SUMMARY_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function summaryMonthOfDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}`;
}

/** The month a customer joined, mirroring core.js customerJoinMonth. */
export function installationJoinMonth(customer) {
  if (!customer) return null;
  const billMonths = (Array.isArray(customer.bills) ? customer.bills : [])
    .map(bill => bill?.month)
    .filter(month => typeof month === 'string' && SUMMARY_MONTH_RE.test(month));
  return summaryMonthOfDate(customer.addedOn)
    ?? summaryMonthOfDate(customer.connectionDate)
    ?? (typeof customer.billingStartMonth === 'string' && SUMMARY_MONTH_RE.test(customer.billingStartMonth)
      ? customer.billingStartMonth
      : null)
    ?? (billMonths.length ? billMonths.sort()[0] : null);
}

/**
 * Pure: the month's installation position. Only customers who joined in
 * `month` count, and only those with a recorded net (a connection fee on
 * record) enter the money sums — a joiner with nothing recorded is
 * counted in installCount but never invents a cost. `net` is the sum of
 * the per-installation nets; `subsidy` is the part of it the ISP bore
 * (net below zero), `surplus` the part above zero. `hasPartial` flags
 * that at least one counted net is a lower bound (fiber used with no
 * recorded per-meter rate, per calculateInstallationCost).
 */
export function buildMonthlyInstallationSummary(customers, month) {
  const validMonth = typeof month === 'string' && SUMMARY_MONTH_RE.test(month) ? month : '';
  const result = {
    month: validMonth,
    installCount: 0,
    recordedCount: 0,
    connectionFees: 0,
    totalCost: 0,
    net: 0,
    surplus: 0,
    subsidy: 0,
    hasPartial: false
  };
  if (!validMonth || !Array.isArray(customers)) return result;
  let fees = 0;
  let costs = 0;
  let net = 0;
  for (const customer of customers) {
    if (installationJoinMonth(customer) !== validMonth) continue;
    result.installCount += 1;
    const cost = calculateInstallationCost(customer);
    if (cost.net === null) continue;
    result.recordedCount += 1;
    fees += cost.connectionFee ?? 0;
    costs += cost.totalCost;
    net += cost.net;
    if (cost.netIsPartial) result.hasPartial = true;
  }
  result.connectionFees = roundMoney(fees);
  result.totalCost = roundMoney(costs);
  result.net = roundMoney(net);
  result.surplus = net > 0 ? roundMoney(net) : 0;
  result.subsidy = net < 0 ? roundMoney(-net) : 0;
  return result;
}
