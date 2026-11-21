// Plan 619 — Split-tender submit failure shows a plain message, not a
// raw error.
//
// The split-tender branch of the Quick Collect `paymentForm` submit
// listener builds both legs with `executeSplitTenderCollection`,
// persists them at `onSaveState(splitResult.nextState)`, and then runs
// post-save rendering (receipt card, success step, …) still inside the
// same inner try. A TypeError thrown in any post-save step landed in
// the split catch, which toasted `splitErr.message` verbatim — so the
// operator was told the split failed even though BOTH legs WERE saved
// (the 2026-11-08 incident shape on the split path). The fix mirrors
// Polish #16 Req 1b: route the catch through
// `paymentSaveErrorMessage`, keeping the existing
// `split_not_saved_toast` fallback. No title: the 619 acceptance names
// only "the generic message", the split error toast is untitled by
// convention, and a hardcoded English title would newly appear on the
// precise translated leg-2 / link-stamp messages the guard passes
// through verbatim.
//
// THE SPEC IS WRONG ABOUT THE ANCHORS: nav-quick-collect.js:5503 is
// method-pills sync, not the split catch. The real catch is
// :7888-7896 (now :7888-7901 with the why-comment), the ONLY
// `catch (splitErr)` inside the submit handler span. The spec's key
// `split_not_saved` does not exist; the real key is
// `split_not_saved_toast`. The Plan 618 outer catch (:8064-8068, now
// :8069-8073 after the comment shift) never sees split errors — the
// inner catch wins for every split-path throw.
//
// WHAT CANNOT CHANGE: the Plan 618 outer catch (guard + title), the
// other err.message passthroughs (concession, package, reopen, area,
// second-connection), the interpolated-message toasts, the split
// record path, or the success step. A TypeError thrown BEFORE the
// save also gets the generic "may already be recorded" message — the
// exact trade-off Polish #16 already accepted in the profile form and
// Plan 618 inherited for the single path; a pre/post-save distinction
// is out of scope.
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

// The split-tender catch: `catch (splitErr)` inside the submit handler,
// nested inside the outer handler try, so it wins for every split-path
// throw and the Plan 618 outer catch never sees them.
const splitCatchAt = qc.indexOf('} catch (splitErr) {');
assert.ok(splitCatchAt >= 0, 'split-tender catch exists');
const splitCatchBody = qc.slice(splitCatchAt, qc.indexOf('return;', splitCatchAt));
assert.ok(splitCatchBody.length > 0, 'split catch body extracted');

// The Plan 618 outer catch, for stability: it must keep its guard + title.
const handlerStart = qc.indexOf("paymentForm?.addEventListener('submit'");
assert.ok(handlerStart >= 0, 'QC submit listener exists');
const outerCatchAt = qc.indexOf('} catch (err) {', handlerStart);
assert.ok(outerCatchAt >= 0, 'submit handler outer catch exists');
const outerCatchBody = qc.slice(outerCatchAt, qc.indexOf('} finally {', outerCatchAt));
assert.ok(outerCatchBody.length > 0, 'outer catch body extracted');

const generic = t('prof_hist_save_error_generic');

test('C1: the split catch routes through paymentSaveErrorMessage (Polish #16 Req 1b)', () => {
  assert.ok(splitCatchBody.includes('paymentSaveErrorMessage(splitErr)'),
    `split catch body is: ${splitCatchBody.trim()} — expected the Polish #16 guard, not splitErr.message`);
});

test('C2: the split catch never toasts the raw engine error', () => {
  assert.ok(!splitCatchBody.includes('onToast(splitErr.message'),
    `split catch still toasts splitErr.message verbatim: ${splitCatchBody.trim()}`);
});

test('S1: the split fallback is kept (non-TypeError errors still get it)', () => {
  assert.ok(splitCatchBody.includes("t('split_not_saved_toast')"),
    'split catch must keep the split_not_saved_toast fallback');
  // Guard-only, no title: the split error toast stays untitled, as before.
  assert.ok(!splitCatchBody.includes('title:'),
    'the split error toast must carry no title');
});

test('S2: the Plan 618 outer catch is untouched (guard + title intact)', () => {
  assert.ok(outerCatchBody.includes('paymentSaveErrorMessage(err)'),
    'outer catch must keep routing through the guard');
  assert.ok(outerCatchBody.includes("title: 'Payment not saved'"),
    'outer catch must keep the Payment not saved title');
});

test('S3: the split record and receipt behaviour are unchanged', () => {
  assert.ok(qc.includes('executeSplitTenderCollection(state, {'),
    'the split build call must stay');
  assert.ok(qc.includes('onSaveState(splitResult.nextState)'),
    'the split persistence point must stay');
  assert.equal((qc.match(/showStep\('success'\)/g) || []).length, 2,
    'both success paths (split + single) must still show the success step');
  assert.ok(qc.includes("onToast(t('split_saved_msg'"),
    'the split success toast is untouched');
});

test('S4: paymentSaveErrorMessage itself is unchanged', () => {
  assert.equal(
    paymentSaveErrorMessage(new TypeError("Cannot read properties of null (reading 'length')")),
    generic, 'a TypeError becomes the generic message');
  assert.ok(!generic.includes('Cannot read properties'),
    'the generic message carries no engine text');
  assert.equal(paymentSaveErrorMessage(new Error('Split payment was NOT saved: leg 2 (Cash 1000) failed — boom. Nothing was recorded; no part of the split reached the ledger.')),
    'Split payment was NOT saved: leg 2 (Cash 1000) failed — boom. Nothing was recorded; no part of the split reached the ledger.',
    'a precise split failure message keeps its text verbatim');
  assert.equal(paymentSaveErrorMessage(null), '', 'null becomes empty, not a crash');
});

test('S5: both keys exist in both dictionaries (no new key needed)', () => {
  assert.equal((nav.match(/prof_hist_save_error_generic:/g) || []).length, 2,
    'prof_hist_save_error_generic must be defined once per dict (en + ur)');
  assert.equal((nav.match(/split_not_saved_toast:/g) || []).length, 2,
    'split_not_saved_toast must be defined once per dict (en + ur)');
  assert.ok(generic.length > 0, 'the generic message resolves');
  assert.ok(t('split_not_saved_toast').length > 0, 'the split fallback resolves');
});

test('B1: no new import edge — paymentSaveErrorMessage is already imported (Plan 618)', () => {
  assert.equal((qc.match(/from '\.\/form-validation\.js'/g) || []).length, 1,
    'exactly one import from form-validation.js');
  assert.ok(qc.includes('paymentSaveErrorMessage'),
    'paymentSaveErrorMessage must already be in that import');
});
