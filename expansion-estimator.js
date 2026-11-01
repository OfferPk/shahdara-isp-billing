/**
 * expansion-estimator.js — SISP-135 [P2]: New Street / Mohalla Fiber
 * Expansion ROI & Break-Even Calculator ("نئی گلی فائبر تخمینہ").
 *
 * Spec (read-latest.txt, SISP-135 block): "Calculate Total Capex PKR
 * (drop/feeder cable, splitter box, poles/clamps, splicing labor), Net
 * Upfront Investment after connection fees, Break-Even Months, and
 * 50/50 Partner Capital Contribution (Rs. X each)."
 *
 * A PURE planning calculator with ZERO ledger contact, in the
 * collection-forecaster.js mould:
 *   - computeExpansionEstimate(inputs) takes a plain inputs object and
 *     returns the full estimate. It reads no state, writes nothing,
 *     adds no storage key, creates no expense / inventory movement /
 *     customer / partner-ledger entry. A scenario lives only in the
 *     dialog while it is open — there is deliberately no save button.
 *   - expansionDefaultsFromState(state) is a READ-ONLY prefill helper:
 *     it derives editable defaults from figures the ledger itself has
 *     recorded (see below) and reports which fields it could fill, so
 *     the UI can label their source honestly. It never mutates state.
 *
 * Recorded-data defaults (most frequent recorded value, ties broken by
 * the smaller value; only positive figures from non-archived customers
 * count — an archived customer's old fee is not today's price):
 *   - connectionFee  ← customer.connectionFee (recorded at install)
 *   - monthlyFee     ← customer.monthlySellingAmount (recorded rate)
 *   - drop/feeder cable price per meter ← customer.fiberPerMeterRate
 *     (the recorded per-meter fiber rate of real installs; the same
 *     2-core drop cable is what a feeder run uses, so both fields
 *     prefill from it — each stays independently editable).
 * NO recorded source exists for the splitter-box price, the pole/clamp
 * price or the splicing per-job price: the inventory catalogue
 * (inventory-book.js INVENTORY_ITEMS) carries no purchase prices at
 * all and has no splitter-box item, so those three fields start at 0
 * as plain manual inputs. No market price is ever invented here.
 * BILL_PACKAGES catalogue prices are list prices for existing plans,
 * not a recorded figure for the new street's expected fee, so the
 * monthly fee deliberately comes from recorded selling amounts instead.
 *
 * Math (whole PKR, pinned by tests/expansion-estimator.test.js):
 *   dropCableCost     = dropMeters × dropPricePerMeter
 *   feederCableCost   = feederMeters × feederPricePerMeter
 *   splitterBoxesCost = splitterBoxes × splitterBoxPrice
 *   polesClampsCost   = polesClamps × poleClampPrice
 *   splicingCost      = splicingJobs × splicingPricePerJob
 *   totalCapex        = the five line costs summed (each line rounded
 *                       to whole rupees before summing)
 *   connectionFeeIncome = subscribers × connectionFeePerSubscriber
 *   netUpfront        = max(0, totalCapex − connectionFeeIncome)
 *   feeSurplus        = max(0, connectionFeeIncome − totalCapex) —
 *                       when fees more than cover the plant, the dialog
 *                       says "covered by connection fees" and shows the
 *                       surplus; a negative "investment" is never shown.
 *   monthlyRevenue    = subscribers × monthlyFeePerSubscriber
 *   monthlyNet        = monthlyRevenue − monthlyOpex (may be negative)
 *   breakEvenMonths   = 0 when netUpfront is 0 (nothing to recover);
 *                       ceil(netUpfront / monthlyNet) when monthlyNet
 *                       > 0; otherwise null — rendered as "—" with the
 *                       honest note that the street's monthly income
 *                       does not cover its running cost, never Infinity.
 *   partnerEach       = Math.round(netUpfront × PARTNER_SHARE_RATE)
 *                       when netUpfront > 0, else 0 — the same rate and
 *                       rounding the settlement engine itself uses
 *                       (phase3.js). A planning figure only: it is
 *                       displayed per recorded partner label
 *                       (partner-settlement.js PARTNERS) and never
 *                       written to the partner ledger.
 *
 * Validation: every input is normalized before any math — non-numeric,
 * non-finite or negative values clamp to 0; counts (subscribers,
 * boxes, poles, jobs) and money round to whole units; cable meters
 * keep two decimals (fiber is sold by the meter and recorded rates are
 * per meter). The caller's inputs object is never mutated.
 */

import { formatPKR } from './core.js';
import { PARTNERS, PARTNER_SHARE_RATE } from './partner-settlement.js';
import { t } from './nav-language.js';

function cleanWhole(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

function cleanMeters(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

/** Normalizes a raw inputs object; never mutates the argument. */
export function normalizeExpansionInputs(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    subscribers: cleanWhole(src.subscribers),
    dropMeters: cleanMeters(src.dropMeters),
    feederMeters: cleanMeters(src.feederMeters),
    splitterBoxes: cleanWhole(src.splitterBoxes),
    polesClamps: cleanWhole(src.polesClamps),
    splicingJobs: cleanWhole(src.splicingJobs),
    dropPricePerMeter: cleanWhole(src.dropPricePerMeter),
    feederPricePerMeter: cleanWhole(src.feederPricePerMeter),
    splitterBoxPrice: cleanWhole(src.splitterBoxPrice),
    poleClampPrice: cleanWhole(src.poleClampPrice),
    splicingPricePerJob: cleanWhole(src.splicingPricePerJob),
    monthlyFeePerSubscriber: cleanWhole(src.monthlyFeePerSubscriber),
    connectionFeePerSubscriber: cleanWhole(src.connectionFeePerSubscriber),
    monthlyOpex: cleanWhole(src.monthlyOpex)
  };
}

/**
 * The full expansion estimate for one scenario. Pure: the same inputs
 * always return the same figures and nothing outside the return value
 * is touched.
 */
export function computeExpansionEstimate(rawInputs = {}) {
  const inputs = normalizeExpansionInputs(rawInputs);
  const dropCableCost = Math.round(inputs.dropMeters * inputs.dropPricePerMeter);
  const feederCableCost = Math.round(inputs.feederMeters * inputs.feederPricePerMeter);
  const splitterBoxesCost = inputs.splitterBoxes * inputs.splitterBoxPrice;
  const polesClampsCost = inputs.polesClamps * inputs.poleClampPrice;
  const splicingCost = inputs.splicingJobs * inputs.splicingPricePerJob;
  const totalCapex = dropCableCost + feederCableCost + splitterBoxesCost + polesClampsCost + splicingCost;

  const connectionFeeIncome = inputs.subscribers * inputs.connectionFeePerSubscriber;
  const netUpfront = Math.max(0, totalCapex - connectionFeeIncome);
  const feeSurplus = Math.max(0, connectionFeeIncome - totalCapex);
  const coveredByFees = netUpfront === 0 && feeSurplus > 0;

  const monthlyRevenue = inputs.subscribers * inputs.monthlyFeePerSubscriber;
  const monthlyNet = monthlyRevenue - inputs.monthlyOpex;

  let breakEvenMonths;
  if (netUpfront <= 0) breakEvenMonths = 0;
  else if (monthlyNet > 0) breakEvenMonths = Math.ceil(netUpfront / monthlyNet);
  else breakEvenMonths = null;

  const partnerEach = netUpfront > 0 ? Math.round(netUpfront * PARTNER_SHARE_RATE) : 0;

  return {
    inputs,
    dropCableCost,
    feederCableCost,
    splitterBoxesCost,
    polesClampsCost,
    splicingCost,
    totalCapex,
    connectionFeeIncome,
    netUpfront,
    feeSurplus,
    coveredByFees,
    monthlyRevenue,
    monthlyNet,
    breakEvenMonths,
    partnerEach,
    partners: PARTNERS.map(name => ({ name, amount: partnerEach }))
  };
}

/** Most frequent positive finite value; ties go to the smaller value. */
function modalRecordedValue(values) {
  const counts = new Map();
  for (const value of values) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) continue;
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && (best === null || value < best))) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Read-only prefill defaults from the ledger's own recorded figures.
 * Returns the default per field plus which fields a recorded source
 * actually filled (`sources`), so the UI never labels a manual 0 as
 * recorded data. Archived customers are skipped. Never mutates state.
 */
export function expansionDefaultsFromState(state) {
  const customers = Array.isArray(state?.customers) ? state.customers.filter(c => c && !c.archived) : [];
  const connectionFee = modalRecordedValue(customers.map(c => c.connectionFee));
  const monthlyFee = modalRecordedValue(customers.map(c => c.monthlySellingAmount));
  const cablePrice = modalRecordedValue(customers.map(c => c.fiberPerMeterRate));
  return {
    defaults: {
      connectionFeePerSubscriber: connectionFee ?? 0,
      monthlyFeePerSubscriber: monthlyFee ?? 0,
      dropPricePerMeter: cablePrice ?? 0,
      feederPricePerMeter: cablePrice ?? 0
    },
    sources: {
      connectionFeePerSubscriber: connectionFee !== null,
      monthlyFeePerSubscriber: monthlyFee !== null,
      dropPricePerMeter: cablePrice !== null,
      feederPricePerMeter: cablePrice !== null
    }
  };
}

const FIELD_IDS = [
  ['subscribers', 'xestSubscribersInput'],
  ['dropMeters', 'xestDropMetersInput'],
  ['feederMeters', 'xestFeederMetersInput'],
  ['splitterBoxes', 'xestBoxesInput'],
  ['polesClamps', 'xestPolesInput'],
  ['splicingJobs', 'xestSplicingJobsInput'],
  ['dropPricePerMeter', 'xestDropPriceInput'],
  ['feederPricePerMeter', 'xestFeederPriceInput'],
  ['splitterBoxPrice', 'xestBoxPriceInput'],
  ['poleClampPrice', 'xestPolePriceInput'],
  ['splicingPricePerJob', 'xestSplicingPriceInput'],
  ['monthlyFeePerSubscriber', 'xestMonthlyFeeInput'],
  ['connectionFeePerSubscriber', 'xestConnectionFeeInput'],
  ['monthlyOpex', 'xestMonthlyOpexInput']
];

const SOURCE_HINT_IDS = {
  dropPricePerMeter: 'xestDropPriceSource',
  feederPricePerMeter: 'xestFeederPriceSource',
  monthlyFeePerSubscriber: 'xestMonthlyFeeSource',
  connectionFeePerSubscriber: 'xestConnectionFeeSource'
};

/**
 * Dashboard dialog controller. Opening prefills the four recordable
 * price/fee fields from the ledger's recorded figures (labelled with a
 * "from your recorded data" hint); everything else starts at 0. Typing
 * recomputes live. Closing discards the scenario — nothing is stored.
 */
export function setupExpansionEstimatorModal(getState) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('expansionEstimatorModal');
  const openBtn = document.getElementById('expansionEstimatorOpenBtn');
  if (!dialog || !openBtn) return null;
  const closeBtn = document.getElementById('expansionEstimatorCloseBtn');
  const fields = new Map();
  for (const [key, id] of FIELD_IDS) {
    const el = document.getElementById(id);
    if (el) fields.set(key, el);
  }
  const out = id => document.getElementById(id);

  function readInputs() {
    const raw = {};
    for (const [key, el] of fields) raw[key] = el.value;
    return raw;
  }

  function render() {
    const est = computeExpansionEstimate(readInputs());
    const set = (id, text) => { const el = out(id); if (el) el.textContent = text; };
    set('xestResCapex', formatPKR(est.totalCapex));
    set('xestResFees', formatPKR(est.connectionFeeIncome));
    set('xestResNetUpfront', formatPKR(est.netUpfront));
    set('xestResMonthlyRevenue', formatPKR(est.monthlyRevenue));
    set('xestResMonthlyNet', formatPKR(est.monthlyNet));
    set('xestResBreakEven', est.breakEvenMonths === null ? '—' : String(est.breakEvenMonths));
    est.partners.forEach((partner, idx) => {
      set(`xestPartnerName${idx}`, t('xest_res_partner_each', null, { partner: partner.name }));
      set(`xestPartnerAmount${idx}`, formatPKR(partner.amount));
    });
    const coveredEl = out('xestCoveredNote');
    if (coveredEl) {
      coveredEl.hidden = !est.coveredByFees;
      if (est.coveredByFees) coveredEl.textContent = t('xest_covered_by_fees', null, { amount: formatPKR(est.feeSurplus) });
    }
    const neverEl = out('xestBreakEvenNote');
    if (neverEl) neverEl.hidden = est.breakEvenMonths !== null;
  }

  function prefill() {
    const { defaults, sources } = expansionDefaultsFromState(typeof getState === 'function' ? getState() : null);
    for (const [key, el] of fields) {
      el.value = Object.prototype.hasOwnProperty.call(defaults, key) ? String(defaults[key]) : '0';
    }
    for (const [key, id] of Object.entries(SOURCE_HINT_IDS)) {
      const hint = out(id);
      if (hint) hint.hidden = !sources[key];
    }
    render();
  }

  for (const el of fields.values()) el.addEventListener('input', render);
  openBtn.addEventListener('click', () => {
    prefill();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });
  closeBtn?.addEventListener('click', () => dialog.close());
  return { open: () => openBtn.click(), render };
}
