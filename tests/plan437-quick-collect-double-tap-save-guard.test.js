// Plan 437 — Quick Collect double-tap save guard: one double-tap guard
// on the Quick Collect save button (the button disables while a save is
// in progress and ignores a second tap for the same payment). It guards
// only and it blocks no legitimate second payment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createDoubleTapSaveGuard,
  doubleTapSaveGuardKey,
  doubleTapSaveGuardTryStart,
  doubleTapSaveGuardFinish,
  doubleTapSaveGuardIsSaving,
  doubleTapSaveGuardSetDisabled,
} from '../double-tap-save-guard.js';

const moduleSrc = readFileSync(new URL('../double-tap-save-guard.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// The one save the operator taps twice: customer CUST-1, PKR 3,000 cash,
// November 2026, 2026-11-07.
const SAVE = {
  customerId: 'CUST-1',
  amount: 3000,
  method: 'Cash',
  month: '2026-11',
  date: '2026-11-07',
};

test('key: the same save figures build the same key', () => {
  assert.equal(
    doubleTapSaveGuardKey(SAVE),
    doubleTapSaveGuardKey({ ...SAVE })
  );
  assert.equal(
    doubleTapSaveGuardKey(SAVE),
    doubleTapSaveGuardKey({ ...SAVE, amount: '3000' })
  );
});

test('key: any changed figure builds a different key', () => {
  const base = doubleTapSaveGuardKey(SAVE);
  assert.notEqual(doubleTapSaveGuardKey({ ...SAVE, customerId: 'CUST-2' }), base);
  assert.notEqual(doubleTapSaveGuardKey({ ...SAVE, amount: 1500 }), base);
  assert.notEqual(doubleTapSaveGuardKey({ ...SAVE, amount: 3000.5 }), base);
  assert.notEqual(doubleTapSaveGuardKey({ ...SAVE, method: 'JazzCash' }), base);
  assert.notEqual(doubleTapSaveGuardKey({ ...SAVE, month: '2026-10' }), base);
  assert.notEqual(doubleTapSaveGuardKey({ ...SAVE, date: '2026-11-06' }), base);
});

test('key: a non-number amount reads as none, never zero — yet stays one key', () => {
  for (const bad of [null, undefined, '', true, 'abc']) {
    const key = doubleTapSaveGuardKey({ ...SAVE, amount: bad });
    assert.match(key, /\|none\|/, `expected a none amount part for ${String(bad)}`);
    assert.equal(key, doubleTapSaveGuardKey({ ...SAVE, amount: bad }));
  }
  assert.notEqual(
    doubleTapSaveGuardKey({ ...SAVE, amount: null }),
    doubleTapSaveGuardKey(SAVE)
  );
});

test('key: missing figures still build a deterministic key', () => {
  assert.equal(doubleTapSaveGuardKey({}), doubleTapSaveGuardKey({}));
  assert.equal(doubleTapSaveGuardKey(null), doubleTapSaveGuardKey(undefined));
  assert.equal(doubleTapSaveGuardKey({ customerId: 'CUST-1' }), doubleTapSaveGuardKey({ customerId: 'CUST-1' }));
});

test('guard: a fresh guard is not saving', () => {
  const guard = createDoubleTapSaveGuard();
  assert.equal(guard.saving, false);
  assert.equal(guard.key, null);
  assert.equal(doubleTapSaveGuardIsSaving(guard), false);
});

test('guard: the first start arms the guard with the save key', () => {
  const guard = createDoubleTapSaveGuard();
  const key = doubleTapSaveGuardKey(SAVE);
  assert.equal(doubleTapSaveGuardTryStart(guard, key), true);
  assert.equal(doubleTapSaveGuardIsSaving(guard), true);
  assert.equal(guard.key, key);
});

test('guard: a second start for the same payment while saving is refused', () => {
  const guard = createDoubleTapSaveGuard();
  const key = doubleTapSaveGuardKey(SAVE);
  assert.equal(doubleTapSaveGuardTryStart(guard, key), true);
  assert.equal(doubleTapSaveGuardTryStart(guard, key), false);
  assert.equal(doubleTapSaveGuardTryStart(guard, doubleTapSaveGuardKey(SAVE)), false);
  assert.equal(doubleTapSaveGuardIsSaving(guard), true);
  assert.equal(guard.key, key);
});

test('guard: a second start for a different payment while saving is refused too', () => {
  const guard = createDoubleTapSaveGuard();
  assert.equal(doubleTapSaveGuardTryStart(guard, doubleTapSaveGuardKey(SAVE)), true);
  assert.equal(doubleTapSaveGuardTryStart(guard, doubleTapSaveGuardKey({ ...SAVE, amount: 1500 })), false);
  assert.equal(guard.key, doubleTapSaveGuardKey(SAVE));
});

test('guard: finishing clears the guard, so a separate payment starts normally', () => {
  const guard = createDoubleTapSaveGuard();
  const first = doubleTapSaveGuardKey(SAVE);
  assert.equal(doubleTapSaveGuardTryStart(guard, first), true);
  doubleTapSaveGuardFinish(guard);
  assert.equal(doubleTapSaveGuardIsSaving(guard), false);
  assert.equal(guard.key, null);
  const second = doubleTapSaveGuardKey({ ...SAVE, amount: 1500, date: '2026-11-08' });
  assert.equal(doubleTapSaveGuardTryStart(guard, second), true);
  assert.equal(guard.key, second);
});

test('guard: finishing twice is a no-op, and the same payment may start again', () => {
  const guard = createDoubleTapSaveGuard();
  const key = doubleTapSaveGuardKey(SAVE);
  assert.equal(doubleTapSaveGuardTryStart(guard, key), true);
  doubleTapSaveGuardFinish(guard);
  doubleTapSaveGuardFinish(guard);
  assert.equal(doubleTapSaveGuardTryStart(guard, key), true);
});

test('acceptance: two rapid taps record exactly one payment', () => {
  const guard = createDoubleTapSaveGuard();
  const key = doubleTapSaveGuardKey(SAVE);
  let recorded = 0;
  const tapSave = () => {
    if (!doubleTapSaveGuardTryStart(guard, key)) return;
    recorded += 1;
    doubleTapSaveGuardFinish(guard);
  };
  tapSave();
  assert.equal(recorded, 1);
  // A second tap that lands before the first save settles is ignored.
  const guard2 = createDoubleTapSaveGuard();
  let recorded2 = 0;
  const tapSave2 = () => {
    if (!doubleTapSaveGuardTryStart(guard2, key)) return;
    recorded2 += 1;
  };
  tapSave2();
  tapSave2();
  assert.equal(recorded2, 1, 'the second rapid tap must not record again');
  doubleTapSaveGuardFinish(guard2);
  tapSave2();
  assert.equal(recorded2, 2, 'a separate payment after the first completes still works');
});

test('guard: null and non-object guards never start and never throw', () => {
  for (const bad of [null, undefined, 0, 'x', true]) {
    assert.equal(doubleTapSaveGuardTryStart(bad, 'k'), false);
    assert.equal(doubleTapSaveGuardIsSaving(bad), false);
    assert.doesNotThrow(() => doubleTapSaveGuardFinish(bad));
  }
});

test('buttons: setDisabled flips the button and is null-safe', () => {
  const button = { disabled: false };
  doubleTapSaveGuardSetDisabled(button, true);
  assert.equal(button.disabled, true);
  doubleTapSaveGuardSetDisabled(button, false);
  assert.equal(button.disabled, false);
  assert.doesNotThrow(() => doubleTapSaveGuardSetDisabled(null, true));
  assert.doesNotThrow(() => doubleTapSaveGuardSetDisabled(undefined, true));
  assert.doesNotThrow(() => doubleTapSaveGuardSetDisabled('button', true));
});

test('purity: the module never reads the clock or the page', () => {
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('sessionStorage'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
  assert.equal(moduleSrc.includes('XMLHttpRequest'), false);
});

test('guards: the module header never names a fenced module file', () => {
  const header = moduleSrc.slice(0, moduleSrc.indexOf('function guardCents'));
  assert.ok(header.length > 0, 'header found');
  const fenced = [
    'offline-' + 'saved-badge.js',
    'quick-' + 'collect-reversal-undo.js',
    'reversal-' + 'link.js',
    'success-' + 'next-steps.js',
    'save-' + 'confirmation-summary.js',
    'receipt-' + 'preview.js',
    'cash-' + 'change-calculator.js',
    'remembered-' + 'method.js',
    'dues-' + 'amount-default.js',
    'quick-' + 'collect-one-screen.js',
    'name-' + 'prefix-lookup.js',
    'recent-' + 'quick-pick.js',
    'one-' + 'screen-quick-amounts.js',
    'full-' + 'history-list.js',
    'balance-' + 'rollforward.js',
  ];
  for (const name of fenced) {
    assert.equal(header.includes(name), false, `header must not name ${name}`);
  }
});

test('guards: no new styles rule and no new element id for the guard', () => {
  assert.equal(stylesSrc.includes('dtg-'), false);
  assert.equal(stylesSrc.includes('doubleTapSaveGuard'), false);
  assert.equal(pageSrc.includes('dtg-'), false);
});

test('wiring: the controller imports the guard module', () => {
  assert.match(wiringSrc, /from '\.\/double-tap-save-guard\.js'/);
  assert.ok(wiringSrc.includes('doubleTapSaveGuardTryStart'));
  assert.ok(wiringSrc.includes('createDoubleTapSaveGuard'));
});

test('wiring: the guard state is created in the controller', () => {
  const at = wiringSrc.indexOf('const saveGuard = createDoubleTapSaveGuard();');
  assert.ok(at > 0, 'guard created in the controller closure');
  assert.ok(wiringSrc.includes('let saveGuardHeldForDialog = false;'));
});

test('wiring: the form save button is grabbed for disabling', () => {
  assert.match(wiringSrc, /document\.getElementById\('quickCollectConfirmBtn'\)/);
  assert.ok(pageSrc.includes('id="quickCollectConfirmBtn"'));
  assert.ok(pageSrc.includes('id="quickCollectConfirmSaveBtn"'));
});

test('wiring: the submit handler tries the guard before anything posts', () => {
  const submitAt = wiringSrc.indexOf("paymentForm?.addEventListener('submit'");
  assert.ok(submitAt > 0, 'submit handler found');
  const guardAt = wiringSrc.indexOf('doubleTapSaveGuardTryStart(saveGuard, saveGuardKey)', submitAt);
  assert.ok(guardAt > submitAt, 'guard tried inside the submit handler');
  const postAt = wiringSrc.indexOf('executeQuickCollection(state, {', submitAt);
  assert.ok(postAt > guardAt, 'guard tried before the save posts');
  const splitAt = wiringSrc.indexOf('executeSplitTenderCollection(state, {', submitAt);
  assert.ok(splitAt > guardAt, 'guard tried before the split save posts');
});

test('wiring: the arming disables both save buttons', () => {
  const armAt = wiringSrc.indexOf('doubleTapSaveGuardTryStart(saveGuard, saveGuardKey)');
  const region = wiringSrc.slice(armAt, armAt + 700);
  assert.ok(region.includes('doubleTapSaveGuardSetDisabled(quickCollectConfirmBtn, true)'));
  assert.ok(region.includes('doubleTapSaveGuardSetDisabled(confirmSaveBtn, true)'));
});

test('wiring: the submit try has a finally that settles the guard', () => {
  const submitAt = wiringSrc.indexOf("paymentForm?.addEventListener('submit'");
  const finallyAt = wiringSrc.indexOf('} finally {', submitAt);
  assert.ok(finallyAt > submitAt, 'finally on the submit try found');
  const region = wiringSrc.slice(finallyAt, finallyAt + 600);
  assert.ok(region.includes('doubleTapSaveGuardFinish(saveGuard)'));
  assert.ok(region.includes('doubleTapSaveGuardSetDisabled(quickCollectConfirmBtn, false)'));
  assert.ok(region.includes('doubleTapSaveGuardSetDisabled(confirmSaveBtn, false)'));
  assert.ok(region.includes('if (!saveGuardHeldForDialog)'));
});

test('wiring: the duplicate prompts hold the guard and clear it on answer', () => {
  const tidAt = wiringSrc.indexOf('ask.then(ok => {');
  assert.ok(tidAt > 0, 'duplicate-TID prompt branch found');
  const tidRegion = wiringSrc.slice(tidAt, tidAt + 900);
  assert.ok(tidRegion.includes('saveGuardHeldForDialog = false;'));
  assert.ok(tidRegion.includes('doubleTapSaveGuardFinish(saveGuard)'));
  assert.ok(tidRegion.includes("if (typeof paymentForm?.requestSubmit === 'function') paymentForm.requestSubmit();"));
  assert.ok(wiringSrc.slice(tidAt, tidAt + 1200).includes('saveGuardHeldForDialog = true;'));

  const dupAt = wiringSrc.indexOf('askDuplicatePayment(recentDuplicate, formatPKR).then(');
  assert.ok(dupAt > 0, 'duplicate-payment prompt branch found');
  const dupRegion = wiringSrc.slice(dupAt, dupAt + 900);
  assert.ok(dupRegion.includes('saveGuardHeldForDialog = false;'));
  assert.ok(dupRegion.includes('doubleTapSaveGuardFinish(saveGuard)'));
  assert.ok(wiringSrc.slice(dupAt, dupAt + 1200).includes('saveGuardHeldForDialog = true;'));
});

test('wiring: closing the sheet can never leave the guard armed', () => {
  const closeAt = wiringSrc.indexOf('function handleDialogClosed()');
  assert.ok(closeAt > 0, 'close cleanup found');
  const region = wiringSrc.slice(closeAt, closeAt + 2200);
  assert.ok(region.includes('doubleTapSaveGuardFinish(saveGuard)'));
  assert.ok(region.includes('saveGuardHeldForDialog = false;'));
});

test('wiring: a second tap on Confirm while saving is ignored', () => {
  const clickAt = wiringSrc.indexOf("confirmSaveBtn?.addEventListener('click'");
  assert.ok(clickAt > 0, 'confirm click handler found');
  const region = wiringSrc.slice(clickAt, clickAt + 500);
  assert.ok(region.includes('if (doubleTapSaveGuardIsSaving(saveGuard)) return;'));
  assert.ok(region.indexOf('if (doubleTapSaveGuardIsSaving(saveGuard)) return;') < region.indexOf('buildSaveConfirmationSummary()'));
});
