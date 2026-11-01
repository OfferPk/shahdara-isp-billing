/**
 * installation-completion-gate.js — SISP-137: 5-Point New Installation
 * Handover & Initial Signal (dBm) Quality Gate.
 *
 * Before an installation request is converted to "Installed — Active
 * Subscriber" (the SISP-57 completion pipeline in install-tracker.js),
 * five checks are verified from RECORDED data only:
 *   1. splitter   — splitter box & port assigned on the customer record
 *                   (SISP-24 optical fields, via splitter-map.js).
 *   2. signal     — initial optical signal lastRxDbm recorded; a reading
 *                   strictly below -25.0 dBm is a WARN (weak install),
 *                   a missing reading is a FAIL.
 *   3. custody    — hardware custody logged (SISP-19: at least one of
 *                   router / media-converter ownership recorded on the
 *                   customer record, either ownership kind counts — the
 *                   log existing is the check, not who owns the device).
 *   4. dropCable  — drop cable actually deducted from the SISP-18 stock
 *                   book. Evidence, strongest first: the SISP-57
 *                   completion stamp's stockDeductions fiber line; a
 *                   stock-out movement carrying the installation's note;
 *                   (pre-completion) a deduction the completion plan is
 *                   about to apply. A fiberMeters figure merely TYPED on
 *                   a record is never treated as a deduction — when it
 *                   is the only signal, the check FAILs and says so.
 *   5. feeKist    — connection fee recorded on the customer record
 *                   (core stores null when never entered, so a stored
 *                   number — including an explicit 0 — is a recording)
 *                   OR a SISP-4 kist plan exists on the record OR (pre-
 *                   completion) the fee the completion form is about
 *                   to write.
 *
 * The builder is PURE and is the single logic for both moments: the
 * pre-completion review (the caller passes the prospective customer —
 * the linked record merged with the fields completion is about to
 * write, or the new-customer draft — plus the plan's staged deductions
 * as sources.pendingDeductions) and the read-only after-install view
 * (the real customer + its completed request). It writes nothing.
 *
 * Gate semantics at the conversion seam (install-tracker mark-installed
 * submit): the dialog always shows the 5 states before completion runs.
 * A FAIL never passes silently — the operator either goes back and
 * fixes the record, or explicitly taps the override button, and that
 * override (which checks failed / were warned, and when) is stamped
 * into the request's completion record via plan.gateReview →
 * sanitizeInstallCompletion. WARN items proceed only through the same
 * explicit acknowledgement. A hard block was rejected deliberately: a
 * create-mode customer structurally cannot carry optical or custody
 * data before the completion creates the record, so blocking would
 * deadlock the SISP-57 pipeline; the recorded override keeps the gate
 * honest instead. All-pass reviews stamp nothing.
 *
 * The dialog is a nested sub-dialog (data-nested-dialog, the #215
 * pattern from ui-feedback.js) so it can open over the Installation
 * Tracker dialog without the Universal Dialog Controller closing it.
 *
 * Tests use synthetic data only.
 */
import { t } from './nav-language.js';
import { normalizeOpticalFields } from './splitter-map.js';
import { custodyItems } from './hardware-custody.js';
import { sanitizeInstallmentPlans } from './installment-plan.js';

/** Readings strictly below this are a weak-install WARN (spec: -25.0). */
export const INSTALL_GATE_SIGNAL_WARN_DBM = -25.0;

export const INSTALL_GATE_CHECK_KEYS = ['splitter', 'signal', 'custody', 'dropCable', 'feeKist'];

export const INSTALL_GATE_CHECK_LABEL_KEYS = {
  splitter: 'instgate_check_splitter',
  signal: 'instgate_check_signal',
  custody: 'instgate_check_custody',
  dropCable: 'instgate_check_drop',
  feeKist: 'instgate_check_fee'
};

const FIBER_ITEM_ID = 'fiber-2core';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function moneyText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toLocaleString('en-US') : rounded.toFixed(2);
}

function metersText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function dbmText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 10) / 10);
}

function result(key, status, detail) {
  return { key, label: t(INSTALL_GATE_CHECK_LABEL_KEYS[key]), status, detail };
}

function checkSplitter(optical) {
  if (optical.splitterBoxId && optical.splitterPort !== null) {
    return result('splitter', 'pass', t('instgate_splitter_pass', null, { box: optical.splitterBoxId, port: optical.splitterPort }));
  }
  return result('splitter', 'fail', t('instgate_splitter_fail'));
}

function checkSignal(optical) {
  if (optical.lastRxDbm === null) {
    return result('signal', 'fail', t('instgate_signal_fail'));
  }
  if (optical.lastRxDbm < INSTALL_GATE_SIGNAL_WARN_DBM) {
    return result('signal', 'warn', t('instgate_signal_warn', null, { dbm: dbmText(optical.lastRxDbm) }));
  }
  return result('signal', 'pass', t('instgate_signal_pass', null, { dbm: dbmText(optical.lastRxDbm) }));
}

function checkCustody(customer) {
  const logged = custodyItems(customer).filter((item) => item.ownership !== '');
  if (logged.length > 0) {
    const items = logged.map((item) => `${item.label} (${item.ownershipLabel})`).join(' · ');
    return result('custody', 'pass', t('instgate_custody_pass', null, { items }));
  }
  return result('custody', 'fail', t('instgate_custody_fail'));
}

function fiberLineQty(lines) {
  let total = 0;
  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line || line.itemId !== FIBER_ITEM_ID) continue;
    const qty = Number(line.qty);
    if (Number.isFinite(qty) && qty > 0) total += qty;
  }
  return Math.round(total * 10) / 10;
}

/**
 * Fiber stock-out evidence in the movement book. With an install
 * request, the movement must carry that installation's own note (the
 * SISP-57 plan writes `Installation <IR-id> — 2-Core Fiber Cable`).
 * Without one, a movement counts only when its note marks it an
 * installation stock-out AND its customer name matches the record —
 * never a looser guess.
 */
function fiberMovementQty(movements, request, customerName) {
  let total = 0;
  for (const movement of Array.isArray(movements) ? movements : []) {
    if (!movement || movement.itemId !== FIBER_ITEM_ID || movement.kind !== 'out') continue;
    const qty = Number(movement.qty);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const note = typeof movement.note === 'string' ? movement.note : '';
    if (request && typeof request.id === 'string' && request.id) {
      if (note.includes(`Installation ${request.id}`)) total += qty;
    } else if (customerName && note.startsWith('Installation ') && movement.customerName === customerName) {
      total += qty;
    }
  }
  return Math.round(total * 10) / 10;
}

function checkDropCable(customer, sources) {
  const request = sources.installRequest && typeof sources.installRequest === 'object'
    ? sources.installRequest
    : null;
  const completion = request && request.completion && typeof request.completion === 'object'
    ? request.completion
    : null;

  // 1. The completion stamp's own record of what was deducted.
  const stampedQty = completion ? fiberLineQty(completion.stockDeductions) : 0;
  if (stampedQty > 0) {
    return result('dropCable', 'pass', t('instgate_drop_pass_deducted', null, { qty: metersText(stampedQty) }));
  }
  // 2. A stock-out movement carrying this installation's note.
  const movedQty = fiberMovementQty(sources.movements, request, typeof customer.name === 'string' ? customer.name : '');
  if (movedQty > 0) {
    return result('dropCable', 'pass', t('instgate_drop_pass_movement', null, { qty: metersText(movedQty) }));
  }
  // 3. Pre-completion: the plan is about to deduct it.
  const stagedQty = fiberLineQty(sources.pendingDeductions);
  if (stagedQty > 0) {
    return result('dropCable', 'pass', t('instgate_drop_pass_staged', null, { qty: metersText(stagedQty) }));
  }
  // 4. The deduction was staged but skipped (stock short) — at
  // completion time or in the plan about to run. That is a real,
  // recorded non-deduction and the gate must surface it.
  const skippedQty = Math.max(
    completion ? fiberLineQty(completion.stockWarnings) : 0,
    fiberLineQty(sources.pendingStockWarnings)
  );
  if (skippedQty > 0) {
    return result('dropCable', 'fail', t('instgate_drop_fail_skipped', null, { qty: metersText(skippedQty) }));
  }
  // 5. Meters typed somewhere but no deduction anywhere: NOT a pass.
  const typedMeters = Math.max(
    Number.isFinite(Number(customer.fiberMeters)) && Number(customer.fiberMeters) > 0 ? Number(customer.fiberMeters) : 0,
    completion && Number.isFinite(Number(completion.fiberMeters)) && Number(completion.fiberMeters) > 0 ? Number(completion.fiberMeters) : 0
  );
  if (typedMeters > 0) {
    return result('dropCable', 'fail', t('instgate_drop_fail_meters_only', null, { qty: metersText(typedMeters) }));
  }
  return result('dropCable', 'fail', t('instgate_drop_fail_none'));
}

function recordedFee(customer) {
  const fee = customer.connectionFee;
  if (fee === null || fee === undefined || fee === '') return null;
  const n = Number(fee);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function checkFeeKist(customer, sources) {
  const fee = recordedFee(customer);
  if (fee !== null) {
    return result('feeKist', 'pass', t('instgate_fee_pass', null, { amount: moneyText(fee) }));
  }
  const plans = sanitizeInstallmentPlans(customer.installmentPlans);
  if (plans.length > 0) {
    return result('feeKist', 'pass', t('instgate_kist_pass', null, { item: plans[0].itemTitle, amount: moneyText(plans[0].totalAmount) }));
  }
  const pending = sources.pendingConnectionFee;
  if (pending !== null && pending !== undefined && pending !== '') {
    const n = Number(pending);
    if (Number.isFinite(n) && n >= 0) {
      return result('feeKist', 'pass', t('instgate_fee_pass_pending', null, { amount: moneyText(n) }));
    }
  }
  return result('feeKist', 'fail', t('instgate_fee_fail'));
}

/**
 * The 5-point gate. `customer` is the record the checks read (at
 * conversion time: the prospective record — linked customer merged
 * with the completion's fields, or the new-customer draft). `sources`
 * carries the evidence that does not live on the record:
 *   installRequest        the SISP-57 request (its completion stamp is
 *                         the after-install evidence for check 4)
 *   movements             the SISP-18 movement book (array)
 *   pendingDeductions     plan deductions about to be applied
 *   pendingStockWarnings  plan warnings about to be recorded
 *   pendingConnectionFee  fee the completion form is about to write
 * Pure: inputs are never mutated.
 */
export function buildInstallationGate(customer, sources = {}) {
  const record = customer && typeof customer === 'object' ? customer : {};
  const src = sources && typeof sources === 'object' ? sources : {};
  const optical = normalizeOpticalFields(record);
  const checks = [
    checkSplitter(optical),
    checkSignal(optical),
    checkCustody(record),
    checkDropCable(record, src),
    checkFeeKist(record, src)
  ];
  const passCount = checks.filter((check) => check.status === 'pass').length;
  const warnCount = checks.filter((check) => check.status === 'warn').length;
  const failCount = checks.filter((check) => check.status === 'fail').length;
  return { checks, passCount, warnCount, failCount, total: checks.length, ok: failCount === 0 };
}

/**
 * The audit record stamped into a completion when the operator
 * proceeded past warnings or failures. Null when the gate was clean —
 * a clean install carries no extra stamp.
 */
export function buildGateReviewRecord(gate, at) {
  if (!gate || !Array.isArray(gate.checks)) return null;
  const failedChecks = gate.checks.filter((check) => check.status === 'fail').map((check) => check.key);
  const warnedChecks = gate.checks.filter((check) => check.status === 'warn').map((check) => check.key);
  if (failedChecks.length === 0 && warnedChecks.length === 0) return null;
  return { at: typeof at === 'string' && at ? at : new Date().toISOString(), failedChecks, warnedChecks };
}

const STATUS_BADGE_CLASS = { pass: 'badge-healthy', warn: 'badge-warning', fail: 'badge-danger' };
const STATUS_ICON = { pass: '✅', warn: '⚠️', fail: '❌' };

/** The 5 check rows as HTML (dialog body). Pure string builder. */
export function renderInstallGateRows(gate) {
  const checks = gate && Array.isArray(gate.checks) ? gate.checks : [];
  return checks.map((check) => `
    <div class="install-gate-row install-gate-row-${escapeHtml(check.status)}">
      <div class="install-gate-row-main">
        <span class="install-gate-row-label">${STATUS_ICON[check.status] || ''} ${escapeHtml(check.label)}</span>
        <span class="install-gate-row-detail">${escapeHtml(check.detail)}</span>
      </div>
      <span class="safety-badge ${STATUS_BADGE_CLASS[check.status] || 'badge-neutral'}">${escapeHtml(t(`instgate_status_${check.status}`))}</span>
    </div>`).join('');
}

/**
 * Dialog controller for #installGateModal. review() is the conversion-
 * time gate: it resolves { proceed, gateReview } — proceed:false on
 * Back / close / Esc (nothing is written anywhere by the dialog; the
 * caller stamps gateReview through the completion pipeline only when
 * the completion itself succeeds). show() is the read-only after-
 * install view. Returns null when the dialog is absent.
 */
export function setupInstallGateDialog({ onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('installGateModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let settleReview = null;
  let currentGate = null;

  function render(gate, { customerLabel = '', readOnly = false } = {}) {
    currentGate = gate;
    const customerEl = $('installGateCustomer');
    if (customerEl) customerEl.textContent = customerLabel || '';
    const introEl = $('installGateIntro');
    if (introEl) introEl.textContent = t(readOnly ? 'instgate_intro_view' : 'instgate_intro');
    const summaryEl = $('installGateSummary');
    if (summaryEl) summaryEl.textContent = t('instgate_summary', null, { passed: gate ? gate.passCount : 0 });
    const rowsEl = $('installGateRows');
    if (rowsEl) rowsEl.innerHTML = renderInstallGateRows(gate);
    const noteEl = $('installGateNote');
    if (noteEl) {
      noteEl.textContent = readOnly
        ? ''
        : !gate || gate.failCount > 0
          ? t('instgate_note_fail')
          : gate.warnCount > 0
            ? t('instgate_note_warn')
            : t('instgate_note_pass');
    }
    const proceedBtn = $('installGateProceedBtn');
    if (proceedBtn) {
      proceedBtn.hidden = readOnly;
      proceedBtn.textContent = !gate || gate.failCount > 0
        ? t('instgate_btn_override')
        : gate.warnCount > 0
          ? t('instgate_btn_proceed_warn')
          : t('instgate_btn_complete');
    }
    const backBtn = $('installGateBackBtn');
    if (backBtn) backBtn.textContent = t(readOnly ? 'instgate_btn_close' : 'instgate_btn_back');
  }

  function settle(result) {
    const resolve = settleReview;
    settleReview = null;
    if (dialog.open) dialog.close();
    if (resolve) resolve(result);
  }

  const proceedBtn = $('installGateProceedBtn');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      settle({ proceed: true, gateReview: buildGateReviewRecord(currentGate, new Date().toISOString()) });
    });
  }
  const backBtn = $('installGateBackBtn');
  if (backBtn) backBtn.addEventListener('click', () => settle({ proceed: false, gateReview: null }));
  const closeBtn = $('installGateCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => settle({ proceed: false, gateReview: null }));
  // Esc / backdrop dismissal resolves as "go back" — never a proceed.
  dialog.addEventListener('close', () => {
    if (settleReview) {
      const resolve = settleReview;
      settleReview = null;
      resolve({ proceed: false, gateReview: null });
    }
  });

  return {
    review(gate, options = {}) {
      return new Promise((resolve) => {
        settleReview = resolve;
        render(gate, { ...options, readOnly: false });
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else {
          settleReview = null;
          if (typeof onToast === 'function') onToast('Installation gate is not available in this view.');
          resolve({ proceed: false, gateReview: null });
        }
      });
    },
    show(gate, options = {}) {
      render(gate, { ...options, readOnly: true });
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else if (typeof onToast === 'function') onToast('Installation gate is not available in this view.');
    }
  };
}
