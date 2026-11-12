// Plan 536 — Split problems are found before the confirm step.
//
// Problem: in the submit handler the confirm-summary check ran
// first (show confirm step, return), and only after the operator
// confirmed did the split validations run (split + Advance
// conflict, leg-2 TID required, leg-2 duplicate, fully-paid split
// guard). The operator reviewed figures, tapped "Confirm & Save
// Payment", and was then bounced back with a toast for a problem
// that was knowable before the review. The large-cash approval
// check, by contrast, already ran before the confirm step.
//
// Pins:
//  - split + Advance ticked: the error appears on the form step
//    after ONE submit — the confirm step is never shown (REPRO:
//    fails on the pristine head, which shows the confirm step
//    first and only rejects after confirming);
//  - leg-2 TID required: same — one submit, error toast, no
//    confirm screen, nothing recorded;
//  - fully-paid split guard: same — one submit, the
//    already-paid error, no confirm screen, nothing new recorded
//    (the fixture has nothing pending at all — no tickets, no
//    addon, no baqaya. Sharafat 5 gave the split guard the same
//    three exemptions as the single guard, so a pending baqaya
//    or boost charge exempts the split instead of refusing it;
//    the refusal case needs nothing pending, and the shared
//    fully-paid refusal fires with the same message);
//  - Sharafat 5: a split to a fully-paid bill with a pending
//    boost charge only, or a manual baqaya only, proceeds —
//    form → confirm → save, both legs recorded;
//  - leg-2 duplicate: the card is visible after ONE submit, with
//    the confirm step never shown (the check moved with the rest);
//  - a valid split still flows form → confirm → save exactly as
//    before, and a plain single payment is unchanged;
//  - the wiring: every split validation sits before the confirm
//    check in the submit handler, the recording still sits after
//    it, the large-cash check stays before it, and the Plan 534
//    showStep('form') guard and the polish #19 undo capture
//    still stand.
// Synthetic data only: one pattern-fake customer, PKR 3,000 dues.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  calculatePaymentAllocations,
  createInitialState,
  generateMonthlyBillsThroughCurrentMonth,
  manualBaqayaOutstandingCents,
  updateCustomerProfile
} from '../core.js';
import { addonChargesPending, addSpeedBoost } from '../speed-addon.js';
import { getPakistanLocalDate, setupQuickCollectModal } from '../nav-quick-collect.js';

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const TODAY = getPakistanLocalDate(new Date());
// The month after the current bill month — a valid advance
// target, so the confirm summary is non-null (without one the
// summary builder returns null and the confirm step is skipped
// even on the pristine head, which would hide the bug).
const NEXT_MONTH = (() => {
  const [y, m] = MONTH.split('-').map(Number);
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  return `${next[0]}-${String(next[1]).padStart(2, '0')}`;
})();
const DUP_TID = 'DUP-TID-536';
const FRESH_TID = 'FRESH-TID-536';

function plan536FixtureState() {
  const now = new Date();
  let state = createInitialState(['Plan536 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

const paymentsOf = (state, month) =>
  state.customers[0].bills.find((b) => b.month === month)?.payments ?? [];

const balanceDueCents = (state, month) =>
  calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents;

/** The owner-cash-shop test's mock DOM + controller harness, with the
 *  Plan 534 additions: a real querySelector over descendants (so the
 *  class-found leg-2 card is reachable), scrollIntoView, and a
 *  dispatchEvent on the form (the card's Proceed fallback path). */
function mockDom() {
  const registry = new Map();
  const createMockElement = (id, tag = 'div', className = '') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), className, textContent: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: (sel) => {
        if (typeof sel !== 'string' || !sel.startsWith('.')) return null;
        const wanted = sel.slice(1);
        const walk = (node) => {
          for (const child of (node.children || [])) {
            if (String(child.className || '').split(' ').includes(wanted)) return child;
            const found = walk(child);
            if (found) return found;
          }
          return null;
        };
        return walk(el);
      },
      querySelectorAll: () => [],
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      focus: () => {},
      select: () => {},
      scrollIntoView: () => { el.scrolledIntoView = true; },
      showModal: () => { el.opened = true; el.open = true; },
      close: () => { el.open = false; },
      opened: false,
      open: false,
      scrolledIntoView: false
    };
    // innerHTML assignment replaces children, like the real DOM — the
    // list renderer clears its host this way before re-rendering.
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v); if (html === '') el.children.length = 0; }
    });
    return el;
  };
  const getEl = (id, tag, className) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag, className));
    return registry.get(id);
  };
  getEl('quickCollectModal', 'dialog');
  // The leg-1 card starts hidden in the real markup; the mock must
  // match, or "leg-1 card stays hidden" would assert nothing.
  getEl('quickCollectDuplicateWarning').hidden = true;
  // The Plan 534 leg-2 card, as it sits in the real page: inside the
  // split fields block, hidden, with its message, reason input and
  // buttons found by class — no ids anywhere on it.
  const splitFields = getEl('quickCollectSplitFields');
  const leg2Card = createMockElement('', 'div', 'qc-duplicate-card qc-split-duplicate-card');
  leg2Card.hidden = true;
  const leg2Msg = createMockElement('', 'p', 'qc-duplicate-msg qc-split-duplicate-msg');
  const leg2Reason = createMockElement('', 'input', 'qc-input qc-split-duplicate-reason');
  const leg2Proceed = createMockElement('', 'button', 'primary-button qc-split-duplicate-proceed');
  const leg2Cancel = createMockElement('', 'button', 'secondary-button qc-split-duplicate-cancel');
  leg2Card.appendChild(leg2Msg);
  leg2Card.appendChild(leg2Reason);
  leg2Card.appendChild(leg2Proceed);
  leg2Card.appendChild(leg2Cancel);
  splitFields.appendChild(leg2Card);
  // The form's Proceed fallback calls dispatchEvent (no requestSubmit
  // in this harness, exactly like the polish #19 mock).
  const form = getEl('quickCollectPaymentForm', 'form');
  form.dispatchEvent = (evt) => form.dispatch(evt.type, evt);
  const documentStub = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
  };
  return { getEl, documentStub, leg2Card, leg2Msg, leg2Reason, leg2Proceed, leg2Cancel };
}

async function withController(state, fn) {
  const { getEl, documentStub, ...card } = mockDom();
  const origDocument = globalThis.document;
  globalThis.document = documentStub;
  try {
    let current = state;
    const toasts = [];
    const controller = setupQuickCollectModal({
      getState: () => current,
      onSaveState: (next) => { current = next; },
      onToast: (msg, opts) => toasts.push({ msg, opts }),
      onSelectCustomer: () => {},
      onEditCustomer: () => {}
    });
    await fn({ controller, getEl, toasts, getState: () => current, ...card });
  } finally {
    // The submit path schedules a ~60ms focus timer against `document`;
    // let it fire while the stub is still installed.
    await new Promise((resolve) => setTimeout(resolve, 130));
    globalThis.document = origDocument;
  }
}

// Plan 382: the save confirmation summary is shown before the payment
// posts — a submit alone records nothing; the operator confirms the
// same figures, then the form posts. The mock form has no native
// requestSubmit, so the test resubmits after confirming, exactly as
// the real form's requestSubmit re-entry would.
async function submitAndConfirm(getEl, getState) {
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.deepEqual(paymentsOf(getState(), MONTH), [],
    'Plan 382: the first submit shows the summary — nothing posts yet');
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

// Like submitAndConfirm, but the month already carries an earlier
// payment (the full payment that paid the bill) — the first submit
// must add nothing to it, and the confirm + resubmit must add
// exactly the two split legs.
async function submitSplitAndConfirm(getEl, getState) {
  const before = paymentsOf(getState(), MONTH).length;
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.equal(paymentsOf(getState(), MONTH).length, before,
    'Plan 382: the first submit shows the summary — nothing posts yet');
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.equal(paymentsOf(getState(), MONTH).length, before + 2,
    'both split legs recorded on the confirm + resubmit');
}

// Arm a split: leg 1 Cash Rs 600, leg 2 Easypaisa Rs 400 with the
// given TID (or no TID when tid is ''). Returns after arming only —
// the caller decides how many submits to drive.
async function armSplit(getEl, tid) {
  getEl('quickCollectAmountInput').value = '600';
  getEl('quickCollectMethodSelect').value = 'Cash';
  await getEl('quickCollectMethodSelect').dispatch('change');
  const splitToggle = getEl('quickCollectSplitToggle');
  splitToggle.checked = true;
  await splitToggle.dispatch('change');
  getEl('quickCollectSplitAmountInput').value = '400';
  getEl('quickCollectSplitMethodSelect').value = 'Easypaisa';
  getEl('quickCollectSplitTransactionIdInput').value = tid;
}

// Record one Easypaisa payment carrying the given TID, so a later
// leg-2 entry can duplicate it. Dues are Rs 3,000; this pays
// Rs 1,000 of them, leaving the sheet usable afterwards.
async function recordFirstPayment(getEl, getState, tid) {
  getEl('quickCollectAmountInput').value = '1000';
  getEl('quickCollectMethodSelect').value = 'Easypaisa';
  await getEl('quickCollectMethodSelect').dispatch('change');
  getEl('quickCollectTransactionIdInput').value = tid;
  await submitAndConfirm(getEl, getState);
  assert.equal(paymentsOf(getState(), MONTH).length, 1, 'precondition: first payment recorded');
  assert.equal(paymentsOf(getState(), MONTH)[0].transactionId, tid, 'precondition: first payment carries the TID');
  assert.equal(balanceDueCents(getState(), MONTH), 200000, 'precondition: Rs 2,000 still due');
}

const errorToast = (toasts) => toasts.find((t) => t.opts?.type === 'error');

test('REPRO (Plan 536): split + Advance ticked — the error appears on the form step, before any confirm screen', async () => {
  await withController(plan536FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await armSplit(getEl, FRESH_TID);
    // The Advance box is ticked after the split is armed, so no
    // open-path or toggle reset can clear it before the submit —
    // and a valid advance target month is picked, so the confirm
    // summary is non-null: without it the summary builder returns
    // null and the confirm step is skipped even on the pristine
    // head, which would hide the bug this test reproduces.
    getEl('quickCollectAdvanceCheckbox').checked = true;
    getEl('quickCollectAdvanceTargetMonth').value = NEXT_MONTH;

    // One submit only: the split validations now run before the
    // confirm-summary check, so the conflict is refused here.
    await getEl('quickCollectPaymentForm').dispatch('submit');

    // The bug: on the pristine head the first submit shows the
    // confirm step instead, and the conflict only surfaces after
    // the operator confirms figures that cannot post.
    const err = errorToast(toasts);
    assert.ok(err, 'an error toast appears on the first submit');
    assert.match(err.msg, /cannot also be an Advance payment/, 'the toast names the split + Advance conflict');
    assert.equal(getEl('quickCollectStepConfirm').hidden, true, 'the confirm step is never shown');
    assert.equal(getEl('quickCollectStepForm').hidden, false, 'the operator stays on the form step');
    assert.equal(paymentsOf(getState(), MONTH).length, 0, 'nothing recorded');
  });
});

test('leg-2 TID required: a digital leg 2 with no TID is refused on the form step, before confirm', async () => {
  await withController(plan536FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await armSplit(getEl, '');

    await getEl('quickCollectPaymentForm').dispatch('submit');

    const err = errorToast(toasts);
    assert.ok(err, 'an error toast appears on the first submit');
    assert.match(err.msg, /Leg 2 is a digital payment/, 'the toast names the missing leg-2 Transaction ID');
    assert.equal(getEl('quickCollectStepConfirm').hidden, true, 'the confirm step is never shown');
    assert.equal(getEl('quickCollectStepForm').hidden, false, 'the operator stays on the form step');
    assert.equal(paymentsOf(getState(), MONTH).length, 0, 'nothing recorded');
  });
});

test('fully-paid split guard: a split against a paid bill is refused on the form step, before confirm', async () => {
  // Sharafat 5: the split guard carries the same three exemptions
  // as the single-payment guard, so the refusal case needs nothing
  // pending at all — no tickets, no addon, no baqaya. (The old
  // fixture kept a Rs 500 manual baqaya so the top-level guard
  // was skipped and the split guard fired; that baqaya now
  // exempts the split, so it belongs in the proceeds test below.)
  // With nothing pending the shared fully-paid refusal fires —
  // the top-level guard first, the split guard carrying the same
  // exemptions behind it — with the same advance message.
  const state = plan536FixtureState();
  await withController(state, async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    // Pay the month in full first: Rs 3,000 Cash.
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState);
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'precondition: the month is paid in full');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'precondition: no bill dues left');
    assert.equal(addonChargesPending(getState().customers[0]), 0, 'precondition: no addon charges pending');
    assert.equal(manualBaqayaOutstandingCents(getState().customers[0]), 0,
      'precondition: no manual baqaya outstanding, so no exemption applies');

    controller.open('seed-001');
    await armSplit(getEl, FRESH_TID);
    // The open path pre-ticks Advance when nothing is due at all
    // (no bill balance, no ticket/addon/baqaya) — with nothing
    // pending the box is ticked on the second open, and a split
    // with Advance ticked is refused as a conflict instead. The
    // operator path under test unticks Advance before submitting,
    // so the fully-paid refusal is the one that must fire.
    getEl('quickCollectAdvanceCheckbox').checked = false;

    await getEl('quickCollectPaymentForm').dispatch('submit');

    const err = errorToast(toasts);
    assert.ok(err, 'an error toast appears on the first submit');
    assert.match(err.msg, /already fully paid/, 'the toast names the paid bill');
    assert.equal(getEl('quickCollectStepConfirm').hidden, true, 'the confirm step is never shown');
    assert.equal(getEl('quickCollectStepForm').hidden, false, 'the operator stays on the form step');
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'nothing new recorded');
  });
});

test('Sharafat 5: split to a fully-paid bill with a pending boost charge only proceeds — the addon exemption', async () => {
  // A Rs 500 boost charge stays pending: the single-payment guard
  // exempts it, and the split guard must too — the split that was
  // refused before this item now flows form → confirm → save.
  let state = plan536FixtureState();
  state = addSpeedBoost(state, 'seed-001',
    { boostMbps: 15, durationDays: 10, addonFeePKR: 500, startDate: TODAY }, new Date()).state;
  await withController(state, async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    // Pay the month in full first: Rs 3,000 Cash — exactly the
    // dues, so the remainder is zero and the boost stays pending.
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState);
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'precondition: the month is paid in full');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'precondition: no bill dues left');
    assert.equal(addonChargesPending(getState().customers[0]), 500,
      'precondition: the Rs 500 boost charge is still pending, so the split guard is exempt');
    assert.equal(manualBaqayaOutstandingCents(getState().customers[0]), 0, 'precondition: no baqaya — addon only');

    controller.open('seed-001');
    await armSplit(getEl, FRESH_TID);
    await submitSplitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.deepEqual(recorded.slice(1).map((p) => p.amount).sort((a, b) => a - b), [400, 600], 'leg amounts 600 + 400');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('Sharafat 5: split to a fully-paid bill with a manual baqaya only proceeds — the baqaya exemption', async () => {
  // A Rs 500 manual baqaya stays outstanding: the single-payment
  // guard exempts it, and the split guard must too.
  const state = plan536FixtureState();
  state.customers[0].manualBaqaya = [{ id: 'MBQ-5362', amount: 500, date: '2026-09-15' }];
  await withController(state, async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    // Pay the month in full first: Rs 3,000 Cash — exactly the
    // dues, so the baqaya stays outstanding.
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState);
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'precondition: the month is paid in full');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'precondition: no bill dues left');
    assert.equal(manualBaqayaOutstandingCents(getState().customers[0]), 50000,
      'precondition: the Rs 500 manual baqaya is still outstanding, so the split guard is exempt');
    assert.equal(addonChargesPending(getState().customers[0]), 0, 'precondition: no addon — baqaya only');

    controller.open('seed-001');
    await armSplit(getEl, FRESH_TID);
    await submitSplitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.deepEqual(recorded.slice(1).map((p) => p.amount).sort((a, b) => a - b), [400, 600], 'leg amounts 600 + 400');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('leg-2 duplicate: the card is visible after ONE submit — the check moved before confirm', async () => {
  await withController(plan536FixtureState(), async ({ controller, getEl, toasts, getState, leg2Card, leg2Msg }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, DUP_TID);

    controller.open('seed-001');
    await armSplit(getEl, DUP_TID);

    // One submit only: on the pristine head this only shows the
    // confirm step — the card appeared only after confirming.
    await getEl('quickCollectPaymentForm').dispatch('submit');

    assert.equal(leg2Card.hidden, false, 'the leg-2 duplicate card is visible after one submit');
    assert.match(leg2Msg.textContent, new RegExp(DUP_TID), 'the card names the duplicated TID');
    assert.match(leg2Msg.textContent, /Plan536 Tester/, 'the card names the earlier payment customer');
    assert.match(leg2Msg.textContent, /PKR 1,000/, 'the card names the earlier payment amount');
    assert.equal(getEl('quickCollectStepConfirm').hidden, true, 'the confirm step is never shown');
    assert.equal(getEl('quickCollectStepForm').hidden, false, 'back on the form step so the card is seen');
    assert.equal(leg2Card.scrolledIntoView, true, 'the card scrolls into view');
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'nothing recorded yet');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('valid split still flows form → confirm → save exactly as before', async () => {
  await withController(plan536FixtureState(), async ({ controller, getEl, toasts, getState, leg2Card }) => {
    controller.open('seed-001');
    await armSplit(getEl, FRESH_TID);
    await submitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 2, 'both split legs recorded');
    assert.deepEqual(recorded.map((p) => p.amount).sort((a, b) => a - b), [400, 600], 'leg amounts 600 + 400');
    assert.equal(leg2Card.hidden, true, 'the leg-2 card never shows for a fresh TID');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('single payment unchanged: a plain payment still flows form → confirm → save', async () => {
  await withController(plan536FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '1000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 1, 'the single payment recorded');
    assert.equal(recorded[0].amount, 1000, 'the recorded amount is Rs 1,000');
    assert.equal(balanceDueCents(getState(), MONTH), 200000, 'ledger: Rs 2,000 still due');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('wiring: every split validation sits before the confirm check; the recording still sits after it', () => {
  const src = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

  // The one confirm step in the submit handler is the anchor.
  const confirmAt = src.indexOf("showStep('confirm')");
  assert.ok(confirmAt > 0, 'the confirm step is shown in the submit handler');
  // The large-cash check was already before confirm — it stays there.
  const largeCashAt = src.indexOf('const largeCashThresholdCents =');
  assert.ok(largeCashAt > 0 && largeCashAt < confirmAt, 'the large-cash check is still before the confirm step');
  // Each moved validation is before the confirm check now.
  const advanceConflictAt = src.indexOf("t('split_advance_conflict')");
  assert.ok(advanceConflictAt > 0 && advanceConflictAt < confirmAt, 'the split + Advance conflict is checked before confirm');
  assert.ok(advanceConflictAt > largeCashAt, 'the split validations sit beside the large-cash check');
  const tidRequiredAt = src.indexOf("t('split_leg2_tid_required')");
  assert.ok(tidRequiredAt > 0 && tidRequiredAt < confirmAt, 'the leg-2 TID check is before confirm');
  const dup2At = src.indexOf('if (dup2 && duplicateBypassedForLeg2Txn !== leg2Txn) {');
  assert.ok(dup2At > 0 && dup2At < confirmAt, 'the leg-2 duplicate check is before confirm');
  // The fully-paid split guard moved too — pin it by its own
  // comment, which lives only in the split block (the top-level
  // guard uses the same fully-paid read, so the bare read cannot
  // tell them apart).
  const splitFullyPaidAt = src.indexOf('// The fully-paid guard applies to a split exactly as to a normal');
  assert.ok(splitFullyPaidAt > 0 && splitFullyPaidAt < confirmAt, 'the fully-paid split guard is before confirm');
  // Sharafat 5: the split guard carries the same three exemptions as
  // the single-payment guard — billed tickets, addon charges and
  // manual baqaya. Pin the two added reads inside the split block
  // (between the split-guard comment and the confirm check): the
  // top-level guard sits before the comment, so these reads can
  // only be the split guard's.
  const splitGuardBlock = src.slice(splitFullyPaidAt, confirmAt);
  assert.match(splitGuardBlock, /addonChargesPending\(state\.customers\.find\(c => c\.id === activeCustomerId\)\) <= 0/,
    'the split guard exempts pending addon charges');
  assert.match(splitGuardBlock, /manualBaqayaOutstandingCents\(state\.customers\.find\(c => c\.id === activeCustomerId\)\) <= 0/,
    'the split guard exempts outstanding manual baqaya');
  // The recording stays after the confirm check: a split posts only
  // once the operator has confirmed the figures.
  const recordAt = src.indexOf('executeSplitTenderCollection(state, {');
  assert.ok(recordAt > confirmAt, 'the split recording still runs after the confirm step');
  // Plan 534's guard stays: the duplicate card is shown on the
  // form step even though the check now runs there already.
  assert.match(src, /showStep\('form'\);\s*\n\s*leg2DupCard\.hidden = false;/,
    'the card shows on the form step, so it is visible');
  // Polish #19 still stands: the undo captures the legs before
  // nulling the context.
  assert.match(src, /splitLegs: undoSplitLegs/, 'the polish #19 undo capture still stands');
  // The moved block adds no element lookups: everything it reads
  // was captured at setup, so no new element-id prefix is consumed.
  const movedBlock = src.slice(largeCashAt, confirmAt);
  assert.doesNotMatch(movedBlock, /getElementById/, 'no id lookup in the moved validations');
  assert.doesNotMatch(movedBlock, /document\./, 'no bare-document read in the moved validations');
  assert.doesNotMatch(movedBlock, /localStorage|new Date\(|Date\.now\(/, 'no storage or clock in the moved validations');
});
