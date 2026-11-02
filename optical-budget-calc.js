/**
 * optical-budget-calc.js — SISP-142: Passive Optical Link Budget &
 * Excess Bend-Loss Calculator.
 *
 * Problem: a weak RX reading (splitter-map.js flags anything below
 * −26.0 dBm) says a port is in trouble but not WHY. This calculator
 * works out the RX a port SHOULD receive from first principles — OLT
 * TX power minus the splitter split loss, splice / connector losses
 * and the fiber-run loss — and compares it with the measured reading.
 * A port measuring far below its budget has loss that the passive
 * plant cannot explain: a bent fiber or a dirty connector.
 *
 *   expectedRxDbm = txPowerDbm − splitterLoss(ratio)
 *                 − spliceCount × SPLICE_LOSS_DB
 *                 − couplerCount × CONNECTOR_LOSS_DB
 *                 − distanceKm × FIBER_LOSS_DB_PER_KM
 *                 − safetyMarginDb            (optional, default 0)
 *   excessLossDb  = expectedRxDbm − lastRxDbm
 *   flagged when excessLossDb > 3.0 dB (strictly; exactly 3.0 is not
 *   flagged, and a reading BETTER than budget is never flagged).
 *
 * The loss figures below are standard passive-optics ENGINEERING
 * REFERENCE values (theoretical split 10·log10(N) plus typical excess
 * loss) — planning constants labelled as such in the UI, never
 * recorded network data. Recorded facts come only from splitter-map.js
 * (a customer's splitterBoxId / splitterPort / lastRxDbm, and a box's
 * derived 1:8 / 1:16 size).
 *
 * PASSIVE by design: this module reads state and computes. It writes
 * nothing anywhere — no storage key, no record field, no history.
 *
 * All helpers are pure except the modal controller's DOM wiring.
 * Tests use synthetic data only.
 */

import { buildSplitterBoxes, formatRxDbm, normalizeOpticalFields } from './splitter-map.js';
import { t } from './nav-language.js';

/** Splitter insertion loss (dB) per ratio: theoretical split + typical excess. */
export const SPLITTER_LOSS_DB = Object.freeze({
  '1:2': 3.8,
  '1:4': 7.2,
  '1:8': 10.5,
  '1:16': 13.8
});

export const SPLITTER_RATIOS = Object.freeze(Object.keys(SPLITTER_LOSS_DB));

/** Fiber attenuation, G.652 single-mode @ 1310 nm (dB per km). */
export const FIBER_LOSS_DB_PER_KM = 0.35;

/** One fusion splice (dB). */
export const SPLICE_LOSS_DB = 0.1;

/** One coupler / connector pair (dB). */
export const CONNECTOR_LOSS_DB = 0.5;

/** Excess loss above this many dB flags a bend / dirty-connector suspect. */
export const EXCESS_LOSS_THRESHOLD_DB = 3.0;

/** Typical OLT PON port launch power (dBm) — an editable default, not data. */
export const DEFAULT_TX_POWER_DBM = 5;

const round1 = (value) => Math.round(value * 10) / 10;

function finiteOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Counts (splices / couplers): non-finite or negative clamps to 0; fractions floor. */
function cleanCount(value) {
  const n = finiteOrNull(value);
  if (n === null || n < 0) return 0;
  return Math.floor(n);
}

/** Distances / margins (km / dB): non-finite or negative clamps to 0. */
function cleanNonNegative(value) {
  const n = finiteOrNull(value);
  if (n === null || n < 0) return 0;
  return n;
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
 * The link budget for one set of planning inputs.
 *
 * inputs: { txPowerDbm, ratio, spliceCount, couplerCount, distanceKm,
 *           safetyMarginDb }
 * - ratio must be one of SPLITTER_RATIOS; anything else is not a
 *   budget at all ({ valid: false, reason: 'unknown-ratio' }) — the
 *   calculator never guesses a split loss.
 * - txPowerDbm may be any finite number (a PON port can launch below
 *   0 dBm); a missing / non-finite TX falls back to the labelled
 *   DEFAULT_TX_POWER_DBM so the surface always shows a budget.
 * - counts, distance and margin clamp at 0 (see cleaners above).
 * Results round to 1 decimal — the house dBm style of recorded readings.
 */
export function computeOpticalBudget(inputs = {}) {
  const ratio = typeof inputs?.ratio === 'string' ? inputs.ratio.trim() : '';
  if (!Object.prototype.hasOwnProperty.call(SPLITTER_LOSS_DB, ratio)) {
    return {
      valid: false,
      reason: 'unknown-ratio',
      ratio: null,
      txPowerDbm: null,
      splitterLossDb: null,
      spliceLossDb: null,
      couplerLossDb: null,
      fiberLossDb: null,
      safetyMarginDb: null,
      totalLossDb: null,
      expectedRxDbm: null
    };
  }
  const txInput = finiteOrNull(inputs?.txPowerDbm);
  const txPowerDbm = txInput === null ? DEFAULT_TX_POWER_DBM : txInput;
  const splitterLossDb = SPLITTER_LOSS_DB[ratio];
  const spliceLossDb = cleanCount(inputs?.spliceCount) * SPLICE_LOSS_DB;
  const couplerLossDb = cleanCount(inputs?.couplerCount) * CONNECTOR_LOSS_DB;
  const fiberLossDb = cleanNonNegative(inputs?.distanceKm) * FIBER_LOSS_DB_PER_KM;
  const safetyMarginDb = cleanNonNegative(inputs?.safetyMarginDb);
  const totalLossRaw = splitterLossDb + spliceLossDb + couplerLossDb + fiberLossDb + safetyMarginDb;
  return {
    valid: true,
    reason: '',
    ratio,
    txPowerDbm: round1(txPowerDbm),
    splitterLossDb: round1(splitterLossDb),
    spliceLossDb: round1(spliceLossDb),
    couplerLossDb: round1(couplerLossDb),
    fiberLossDb: round1(fiberLossDb),
    safetyMarginDb: round1(safetyMarginDb),
    totalLossDb: round1(totalLossRaw),
    expectedRxDbm: round1(txPowerDbm - totalLossRaw)
  };
}

/**
 * Compare a measured RX reading against the budget's expected RX.
 * excessLossDb = expected − measured (positive = weaker than budget).
 * The comparison rounds to 1 decimal BEFORE the threshold check, so a
 * true 3.0 dB excess never flags on float dust; strictly above 3.0
 * flags. A missing / non-finite reading is not comparable — never an
 * error, never flagged.
 */
export function evaluateExcessLoss(expectedRxDbm, measuredRxDbm) {
  const expected = finiteOrNull(expectedRxDbm);
  const measured = finiteOrNull(measuredRxDbm);
  if (expected === null || measured === null) {
    return { comparable: false, excessLossDb: null, flagged: false };
  }
  const excessLossDb = round1(expected - measured);
  return {
    comparable: true,
    excessLossDb,
    flagged: excessLossDb > EXCESS_LOSS_THRESHOLD_DB
  };
}

/**
 * Every recorded splitter port, flattened from buildSplitterBoxes so
 * the picker and the port map can never disagree about who sits where.
 * boxRatio is the box's OWN derived size ('1:8' / '1:16' from its
 * recorded ports — splitter-map's derivation, not a label guess);
 * ports without a reading keep lastRxDbm: null (never invented).
 */
export function listRecordedOpticalPorts(customers) {
  const entries = [];
  for (const box of buildSplitterBoxes(customers)) {
    for (const slot of box.ports) {
      if (slot.status !== 'occupied') continue;
      entries.push({
        customerId: slot.customerId,
        customerName: slot.customerName,
        boxId: box.boxId,
        port: slot.port,
        boxRatio: `1:${box.portCount}`,
        lastRxDbm: slot.lastRxDbm
      });
    }
  }
  return entries;
}

/** One recorded port by customer id (null when the id is not on any box). */
export function recordedPortForCustomer(customers, customerId) {
  if (!customerId) return null;
  return listRecordedOpticalPorts(customers).find((entry) => entry.customerId === customerId) ?? null;
}

const formatDb = (value) => `${round1(Number(value)).toFixed(1)} dB`;
const formatDbm = (value) => `${round1(Number(value)).toFixed(1)} dBm`;

/**
 * The result panel: expected RX, the loss breakdown, and — when a
 * measured reading was supplied — the excess verdict. Pure string
 * builder; the flag wording is the spec's "⚠️ Excess Bend / Dirty
 * Connector Loss" via obcalc_excess_flag.
 */
export function buildOpticalBudgetResultHtml(budget, evaluation = null, measuredRxDbm = null) {
  if (!budget || budget.valid !== true) {
    return `<p class="optical-budget-empty">${escapeHtml(t('obcalc_no_budget'))}</p>`;
  }
  const rows = [
    [t('obcalc_expected_label'), formatDbm(budget.expectedRxDbm)],
    [t('obcalc_splitter_loss_label'), `−${formatDb(budget.splitterLossDb)}`],
    [t('obcalc_splice_loss_label'), `−${formatDb(budget.spliceLossDb)}`],
    [t('obcalc_coupler_loss_label'), `−${formatDb(budget.couplerLossDb)}`],
    [t('obcalc_fiber_loss_label'), `−${formatDb(budget.fiberLossDb)}`]
  ];
  if (budget.safetyMarginDb > 0) rows.push([t('obcalc_margin_loss_label'), `−${formatDb(budget.safetyMarginDb)}`]);
  rows.push([t('obcalc_total_loss_label'), formatDb(budget.totalLossDb)]);
  let verdict = '';
  if (evaluation && evaluation.comparable) {
    rows.push([t('obcalc_measured_rx_label'), formatDbm(measuredRxDbm)]);
    rows.push([t('obcalc_excess_label'), formatDb(evaluation.excessLossDb)]);
    verdict = evaluation.flagged
      ? `<p class="optical-budget-verdict"><span class="safety-badge badge-warning">${escapeHtml(t('obcalc_excess_flag'))}</span></p>`
      : `<p class="optical-budget-verdict"><span class="safety-badge badge-healthy">${escapeHtml(t('obcalc_within_budget'))}</span></p>`;
  } else {
    verdict = `<p class="optical-budget-note">${escapeHtml(t('obcalc_no_measured'))}</p>`;
  }
  return `<div class="optical-budget-rows">${rows.map(([label, value]) => `<p><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></p>`).join('')}</div>${verdict}`;
}

/**
 * Modal controller, mirroring setupSplitterMapModal: live inputs, a
 * recorded-port picker fed by splitter-map data, and the result panel.
 * getState supplies the live app state ({ customers }); nothing is
 * cached between renders and nothing is ever written back.
 */
export function setupOpticalBudgetModal(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('opticalBudgetModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let selectedCustomerId = '';

  const readNumber = (id) => {
    const el = $(id);
    if (!el) return null;
    return finiteOrNull(el.value);
  };

  function currentInputs() {
    return {
      txPowerDbm: readNumber('obcalcTxInput'),
      ratio: $('obcalcRatioSelect')?.value ?? '1:8',
      spliceCount: readNumber('obcalcSplicesInput'),
      couplerCount: readNumber('obcalcCouplersInput'),
      distanceKm: readNumber('obcalcDistanceInput'),
      safetyMarginDb: readNumber('obcalcMarginInput')
    };
  }

  function renderResults() {
    const resultEl = $('obcalcResult');
    if (!resultEl) return;
    const budget = computeOpticalBudget(currentInputs());
    const measured = readNumber('obcalcMeasuredInput');
    const evaluation = measured === null ? null : evaluateExcessLoss(budget.expectedRxDbm, measured);
    let html = buildOpticalBudgetResultHtml(budget, evaluation, measured);
    const state = typeof getState === 'function' ? getState() : {};
    const picked = recordedPortForCustomer(state?.customers ?? [], selectedCustomerId);
    if (picked && picked.lastRxDbm === null) {
      html += `<p class="optical-budget-note">${escapeHtml(t('obcalc_no_recorded_rx'))}</p>`;
    }
    resultEl.innerHTML = html;
  }

  function renderCustomerOptions() {
    const select = $('obcalcCustomerSelect');
    if (!select) return;
    const state = typeof getState === 'function' ? getState() : {};
    const ports = listRecordedOpticalPorts(state?.customers ?? []);
    const previous = selectedCustomerId;
    const noneLabel = ports.length === 0 ? t('obcalc_no_ports') : t('obcalc_customer_none');
    select.innerHTML = `<option value="">${escapeHtml(noneLabel)}</option>` + ports.map((entry) => {
      const optical = normalizeOpticalFields({ lastRxDbm: entry.lastRxDbm });
      const rxText = optical.lastRxDbm === null ? '' : ` · ${formatRxDbm(optical.lastRxDbm)}`;
      return `<option value="${escapeHtml(String(entry.customerId ?? ''))}">${escapeHtml(entry.customerName || 'Unnamed')} · ${escapeHtml(entry.boxId)} · port ${entry.port}${rxText}</option>`;
    }).join('');
    selectedCustomerId = ports.some((entry) => entry.customerId === previous) ? previous : '';
    select.value = selectedCustomerId;
  }

  function applyPickedCustomer() {
    const state = typeof getState === 'function' ? getState() : {};
    const picked = recordedPortForCustomer(state?.customers ?? [], selectedCustomerId);
    if (!picked) return;
    // The box's derived size is recorded fact, so it honestly presets
    // the ratio; the reading fills the measured field. Both stay
    // editable — the operator may be budgeting a different drop.
    const ratioSelect = $('obcalcRatioSelect');
    if (ratioSelect) ratioSelect.value = picked.boxRatio;
    const measuredInput = $('obcalcMeasuredInput');
    if (measuredInput) measuredInput.value = picked.lastRxDbm === null ? '' : String(picked.lastRxDbm);
  }

  function render() {
    renderCustomerOptions();
    renderResults();
  }

  for (const id of ['obcalcTxInput', 'obcalcRatioSelect', 'obcalcSplicesInput', 'obcalcCouplersInput', 'obcalcDistanceInput', 'obcalcMarginInput', 'obcalcMeasuredInput']) {
    const el = $(id);
    if (el) el.addEventListener('input', renderResults);
    if (el) el.addEventListener('change', renderResults);
  }
  const customerSelect = $('obcalcCustomerSelect');
  if (customerSelect) {
    customerSelect.addEventListener('change', () => {
      selectedCustomerId = customerSelect.value;
      applyPickedCustomer();
      renderResults();
    });
  }
  const closeBtn = $('opticalBudgetCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openOpticalBudgetCalcBtn') : null;
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      render();
      dialog.showModal();
    });
  }

  return {
    open() {
      render();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else if (onToast) onToast('Optical link budget is not available in this view.');
    },
    refresh() {
      render();
    }
  };
}
