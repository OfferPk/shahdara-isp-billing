import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('index.html');
const feedback = read('ui-feedback.js');

// Plan 498 — Sticky save bar shows a real unsaved-changes hint.
//
// What the design file assumed was missing is already there at this
// head: #profileSaveHint is driven from a real dirty check, and
// syncProfileStickySaveBar (app.js) copies it into the sticky bar.
// What was actually broken, against the plan's acceptance, was twofold:
// (1) the sync copied the hint verbatim, so a clean form showed
// "No changes yet" in the sticky bar instead of saying nothing; and
// (2) when the form closed, the hint kept the previous session's text,
// so on reopen the sticky bar could flash a stale "Unsaved changes"
// before the fresh snapshot landed. This plan fixes only those two
// seams — the element and the dirty tracking are untouched.
//
// Polish #28 Phase C (2026-11-10) moved the dirty tracking: the
// ui-feedback.js second dirty system (setupProfileSaveState, with its
// own baseline snapshot) is RETIRED, and Plan 499 is the single dirty
// source of truth. The hint is static markup in index.html now, and
// app.js syncProfileSaveHint drives it from
// profileCancelHasUnsavedEdits — the same check that drives the
// per-field Save buttons and the Cancel label. The harness tests that
// used to drive setupProfileSaveState are gone with it: app.js is not
// importable in node, so this file pins the source, and the live
// behaviour (clean form says "No changes yet", an edit says "Unsaved
// changes") is pinned by the e2e save-state spec
// (tests/e2e/customer-payment-polish.spec.mjs).

test('Plan 498: the sticky bar copies the hint only while dirty, and says nothing when clean', () => {
  const sync = app.match(/function syncProfileStickySaveBar\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(sync, /barHint\.textContent = hint\.dataset\.state === 'dirty' \? hint\.textContent : ''/,
    'the sticky hint must be gated on the dirty state');
  assert.doesNotMatch(sync, /barHint\.textContent = hint\.textContent;/,
    'the old verbatim copy must be gone — a clean form showed "No changes yet" in the bar');
  assert.match(sync, /\$\('#profileSaveHint'\)/, 'the sync lines must stay — they read the hint they were written for');
  assert.match(sync, /\$\('#profileStickySaveHint'\)/, 'the sync lines must stay — they write the sticky hint');
});

test('Plan 498: the hint is static markup — no runtime creation can race the first open', () => {
  const save = html.indexOf('id="saveMohallaButton"');
  assert.notEqual(save, -1, 'the save button must exist');
  const hint = html.indexOf('id="profileSaveHint"', save);
  assert.notEqual(hint, -1, '#profileSaveHint must be static markup after the save button');
  const hintTag = html.slice(hint - 10, html.indexOf('>', hint) + 1);
  assert.ok(hintTag.includes('class="profile-save-hint"'), 'the static hint keeps its class');
  assert.ok(hintTag.includes('aria-live="polite"'), 'the static hint keeps its live region');
});

test('Plan 498: the single dirty source drives the hint — the retired ui-feedback path is gone', () => {
  // Strip comments first: the retirement note in ui-feedback.js names
  // the removed function, so a raw substring search would trip on it.
  const code = feedback
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
  assert.ok(!code.includes('setupProfileSaveState'), 'the second dirty system must be retired — Plan 499 is the single source');
  assert.ok(!code.includes('profileSaveHint'), 'ui-feedback must no longer create or touch the hint element');
  const fn = app.match(/function syncProfileSaveHint\(\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'syncProfileSaveHint must exist in app.js');
  assert.match(fn[0], /profileCancelHasUnsavedEdits\(\)/, 'the hint must read the Plan 499 dirty check, not a second baseline');
  assert.match(fn[0], /hint\.textContent = dirty \? 'Unsaved changes' : 'No changes yet'/, 'the hint text keeps the Plan 498 strings');
  assert.match(fn[0], /hint\.dataset\.state = dirty \? 'dirty' : 'clean'/, 'the hint state keeps the Plan 498 values');
});

test('Plan 498: closing the form clears the hint in the save-state source', () => {
  const fn = app.match(/function syncProfileSaveHint\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(fn, /hint\.textContent = '';/,
    'hiding the form must clear the hint text alongside the state');
  assert.match(fn, /hint\.dataset\.state = 'clean'/,
    'hiding the form must reset the hint state so the sticky bar cannot flash a stale "Unsaved changes"');
});

test('Plan 498: the e2e spec still pins the live hint behaviour', () => {
  const spec = read('tests/e2e/customer-payment-polish.spec.mjs');
  assert.ok(spec.includes("await expect(page.locator('#profileSaveHint')).toHaveText('No changes yet')"),
    'the e2e spec must still pin the clean-form hint text');
  assert.ok(spec.includes("await expect(page.locator('#profileSaveHint')).toHaveText('Unsaved changes')"),
    'the e2e spec must still pin the dirty-form hint text');
});
