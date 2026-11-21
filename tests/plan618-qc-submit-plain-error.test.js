// Plan 618 — Quick Collect submit failure shows a plain message, not a
// raw error.
//
// The Quick Collect `paymentForm` submit listener persists the payment at
// `onSaveState(nextState)` and then runs post-save rendering (receipt
// card, success step, …) still inside the same try. A TypeError thrown
// in any post-save step landed in the outer catch, which toasted
// `err.message` verbatim with no title — so the operator was told the
// payment failed even though it WAS saved (the 2026-11-08 incident:
// "Couldn't do that — Cannot read properties of null (reading
// 'length')"). The fix mirrors Polish #16 Req 1b: route the catch
// through `paymentSaveErrorMessage` and title the toast 'Payment not
// saved', exactly as the profile payment form does (app.js:13836/:13956).
//
// THE SPEC IS WRONG ABOUT THE ANCHORS: nav-quick-collect.js:5700-5703
// is one-screen keypad code, not the submit catch. The real catch is
// :8064-8068, the ONLY `catch (err)` inside the submit handler span
// (:7320-8079). The spec's split-tender :5503 is method-pills sync; the
// real split catch is :7888-7896 and is Plan 619 — out of scope here.
//
// WHAT CANNOT CHANGE: the split-tender catch, the other err.message
// passthroughs (concession, package, reopen, area, second-connection),
// the interpolated-message toasts, the save path, or the success step.
// A TypeError thrown BEFORE the save also gets the generic "may already
// be recorded" message — the exact trade-off Polish #16 already accepted
// in the profile form; a pre/post-save distinction is out of scope.
//
// This file asserts NO key-count total (guard reuse, the count stays).
// It must contain NEITHER the current nor the previous count's bare
// digits, and no split-literal form of them either — the plan591 G5a
// sweep and the pnl count are the enforcement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paymentSaveErrorMessage } from '../form-validation.js';
import { t } from '../nav-language.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const qc = read('nav-quick-collect.js');
const nav = read('nav-language.js');

// The QC submit handler: paymentForm submit listener at :7320; its outer
// try starts :7346 and its outer catch is the ONLY `catch (err)` inside
// the handler span (:8064-8068). The split-tender catch inside the same
// handler is `catch (splitErr)` (:7888) — a different variable.
const handlerStart = qc.indexOf("paymentForm?.addEventListener('submit'");
assert.ok(handlerStart >= 0, 'QC submit listener exists');
const catchAt = qc.indexOf('} catch (err) {', handlerStart);
assert.ok(catchAt >= 0, 'submit handler outer catch exists');
const catchBody = qc.slice(catchAt, qc.indexOf('} finally {', catchAt));
assert.ok(catchBody.length > 0, 'catch body extracted');

const generic = t('prof_hist_save_error_generic');

test('C1: the submit catch routes through paymentSaveErrorMessage (Polish #16 Req 1b)', () => {
  assert.ok(catchBody.includes('paymentSaveErrorMessage(err)'),
    `submit catch body is: ${catchBody.trim()} — expected the Polish #16 guard, not err.message`);
});

test('C2: the submit catch never toasts the raw engine error', () => {
  assert.ok(!catchBody.includes('onToast(err.message'),
    `submit catch still toasts err.message verbatim: ${catchBody.trim()}`);
});

test('C3: the submit catch carries the "Payment not saved" title (as in app.js:13836/:13956)', () => {
  assert.ok(catchBody.includes("title: 'Payment not saved'"),
    `submit catch body is: ${catchBody.trim()} — expected the profile-form title`);
});

test('S1: the split-tender catch is untouched (Plan 619, out of scope)', () => {
  assert.ok(qc.includes("onToast(splitErr.message || t('split_not_saved_toast'), { type: 'error' })"),
    'split-tender catch must keep its current shape');
});

test('S2: the other err.message passthroughs are untouched', () => {
  // Bare passthroughs: concession apply/remove + form reopen (3 sites).
  assert.equal((qc.match(/onToast\(err\.message\);/g) || []).length, 3,
    'the three bare onToast(err.message) sites must stay');
  // Area-change passthroughs keep their keyed fallback (2 sites).
  assert.equal((qc.match(/onToast\(err\.message \|\| t\('qc_toast_area_update_failed'\)/g) || []).length, 2,
    'the two area-change passthroughs must stay');
  // Package-change site keeps its raw passthrough (checked by context).
  const pkgStart = qc.indexOf('function renderPackageBox');
  const pkgBlock = qc.slice(pkgStart, qc.indexOf('} catch {', pkgStart));
  assert.ok(pkgBlock.includes("onToast(err.message, { type: 'error' })"),
    'package-change catch must keep its raw passthrough');
});

test('S3: the success step still shows on a clean save', () => {
  assert.equal((qc.match(/showStep\('success'\)/g) || []).length, 2,
    'both success paths (split + single) must still show the success step');
  assert.ok(qc.includes("onToast(t('qc_toast_payment_recorded'"),
    'the recorded-payment toast is untouched');
});

test('S4: paymentSaveErrorMessage itself is unchanged', () => {
  assert.equal(
    paymentSaveErrorMessage(new TypeError("Cannot read properties of null (reading 'length')")),
    generic, 'a TypeError becomes the generic message');
  assert.ok(!generic.includes('Cannot read properties'),
    'the generic message carries no engine text');
  assert.equal(paymentSaveErrorMessage(new Error('Enter a valid payment date.')),
    'Enter a valid payment date.', 'a validation error keeps its clean message verbatim');
  assert.equal(paymentSaveErrorMessage('Custom failure text'), 'Custom failure text',
    'a string error passes through');
  assert.equal(paymentSaveErrorMessage(null), '', 'null becomes empty, not a crash');
});

test('S5: the generic key exists in both dictionaries (no new key needed)', () => {
  assert.equal((nav.match(/prof_hist_save_error_generic:/g) || []).length, 2,
    'prof_hist_save_error_generic must be defined once per dict (en + ur)');
  assert.ok(generic.length > 0, 'the generic message resolves');
});

test('B1: no new import edge — nav-quick-collect.js already imports from form-validation.js', () => {
  assert.equal((qc.match(/from '\.\/form-validation\.js'/g) || []).length, 1,
    'exactly one import from form-validation.js (the fix extends it, no new module edge)');
});
