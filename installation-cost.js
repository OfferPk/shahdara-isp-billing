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
