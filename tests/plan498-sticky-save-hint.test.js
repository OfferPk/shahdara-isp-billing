import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupProfileSaveState } from '../ui-feedback.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const feedback = read('ui-feedback.js');

// Plan 498 — Sticky save bar shows a real unsaved-changes hint.
//
// What the design file assumed was missing is already there at this
// head: setupProfileSaveState (ui-feedback.js) creates #profileSaveHint
// and drives it from a real dirty check against a baseline snapshot,
// and syncProfileStickySaveBar (app.js) copies it into the sticky bar.
// What was actually broken, against the plan's acceptance, was twofold:
// (1) the sync copied the hint verbatim, so a clean form showed
// "No changes yet" in the sticky bar instead of saying nothing; and
// (2) when the form closed, the hint kept the previous session's text,
// so on reopen the sticky bar could flash a stale "Unsaved changes"
// before the fresh snapshot landed. This plan fixes only those two
// seams — the element and the dirty tracking are untouched.

function makeClassList() {
  const set = new Set();
  return {
    add: (...names) => { names.forEach(n => set.add(n)); },
    remove: (...names) => { names.forEach(n => set.delete(n)); },
    toggle: (name, force) => {
      if (force === undefined) { if (set.has(name)) set.delete(name); else set.add(name); }
      else if (force) set.add(name); else set.delete(name);
    },
    contains: name => set.has(name),
  };
}

function makeEl(id) {
  const listeners = new Map();
  const attrs = new Map();
  return {
    id, className: '', dataset: {}, textContent: '',
    classList: makeClassList(),
    disabled: false,
    getAttribute: name => (attrs.has(name) ? attrs.get(name) : null),
    setAttribute: (name, value) => { attrs.set(name, String(value)); },
    removeAttribute: name => { attrs.delete(name); },
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    fire: (type, event = {}) => { (listeners.get(type) || []).forEach(fn => fn(event)); },
    insertAdjacentElement: function (position, el) { this.inserted = { position, el }; },
  };
}

function makeHarness() {
  const observers = [];
  class FakeMutationObserver {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() {}
    disconnect() {}
  }
  const win = {
    MutationObserver: FakeMutationObserver,
    setTimeout: fn => { fn(); return 0; },
  };
  const phone = { type: 'text', id: 'phoneInput', name: '', value: '03012345678', checked: false };
  const mohalla = { type: 'text', id: 'mohallaInput', name: '', value: 'Shahdara', checked: false };
  const sms = { type: 'checkbox', id: 'prefersSmsCheckbox', name: '', value: 'on', checked: false };
  const form = makeEl('customerProfileForm');
  form.hidden = false;
  form.querySelectorAll = () => [phone, mohalla, sms];
  const save = makeEl('saveMohallaButton');
  const created = [];
  const doc = {
    getElementById: id => (id === 'customerProfileForm' ? form : id === 'saveMohallaButton' ? save : undefined),
    createElement: tag => { const el = makeEl(''); el.tagName = tag.toUpperCase(); created.push(el); return el; },
  };
  setupProfileSaveState(doc, win);
  const hint = created[0];
  const fireObserver = () => { observers.forEach(o => o.cb()); };
  return { form, save, hint, phone, mohalla, sms, fireObserver };
}

test('Plan 498: a clean form says "No changes yet" in-form and the save stays disabled', () => {
  const { hint, save } = makeHarness();
  assert.equal(hint.id, 'profileSaveHint');
  assert.equal(hint.textContent, 'No changes yet');
  assert.equal(hint.dataset.state, 'clean');
  assert.equal(save.disabled, true);
});

test('Plan 498: editing a field shows "Unsaved changes" and enables the save', () => {
  const { form, hint, save, mohalla } = makeHarness();
  mohalla.value = 'Jia Musa';
  form.fire('input');
  assert.equal(hint.textContent, 'Unsaved changes');
  assert.equal(hint.dataset.state, 'dirty');
  assert.equal(save.disabled, false);
  assert.equal(save.classList.contains('is-dirty'), true);
});

test('Plan 498: reverting the edit clears the hint again', () => {
  const { form, hint, save, mohalla } = makeHarness();
  mohalla.value = 'Jia Musa';
  form.fire('input');
  assert.equal(hint.dataset.state, 'dirty');
  mohalla.value = 'Shahdara';
  form.fire('input');
  assert.equal(hint.textContent, 'No changes yet');
  assert.equal(hint.dataset.state, 'clean');
  assert.equal(save.disabled, true);
});

test('Plan 498: a checkbox toggle is a change too, and untoggling clears it', () => {
  const { form, hint, sms } = makeHarness();
  sms.checked = true;
  form.fire('change');
  assert.equal(hint.textContent, 'Unsaved changes');
  assert.equal(hint.dataset.state, 'dirty');
  sms.checked = false;
  form.fire('change');
  assert.equal(hint.textContent, 'No changes yet');
  assert.equal(hint.dataset.state, 'clean');
});

test('Plan 498: closing the form clears the hint text and state — no stale hint survives', () => {
  const { form, hint, mohalla, fireObserver } = makeHarness();
  mohalla.value = 'Jia Musa';
  form.fire('input');
  assert.equal(hint.textContent, 'Unsaved changes');
  form.hidden = true;
  fireObserver();
  assert.equal(hint.textContent, '');
  assert.equal(hint.dataset.state, 'clean');
});

test('Plan 498: reopening re-baselines on the loaded record, so the hint is clean', () => {
  const { form, hint, save, mohalla, fireObserver } = makeHarness();
  mohalla.value = 'Jia Musa';
  form.fire('input');
  form.hidden = true;
  fireObserver();
  // The record was saved while the form was closed; reopening loads it.
  form.hidden = false;
  fireObserver();
  assert.equal(hint.textContent, 'No changes yet');
  assert.equal(hint.dataset.state, 'clean');
  assert.equal(save.disabled, true);
});

test('Plan 498: the sticky bar copies the hint only while dirty, and says nothing when clean', () => {
  const sync = app.match(/function syncProfileStickySaveBar\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(sync, /barHint\.textContent = hint\.dataset\.state === 'dirty' \? hint\.textContent : ''/,
    'the sticky hint must be gated on the dirty state');
  assert.doesNotMatch(sync, /barHint\.textContent = hint\.textContent;/,
    'the old verbatim copy must be gone — a clean form showed "No changes yet" in the bar');
  assert.match(sync, /\$\('#profileSaveHint'\)/, 'the sync lines must stay — they read the hint they were written for');
  assert.match(sync, /\$\('#profileStickySaveHint'\)/, 'the sync lines must stay — they write the sticky hint');
});

test('Plan 498: closing the form clears the hint in the save-state source', () => {
  const fn = feedback.match(/export function setupProfileSaveState[\s\S]*?\n\}/)[0];
  assert.match(fn, /baseline = null;\s*\n\s*hint\.textContent = '';/,
    'hiding the form must clear the hint text alongside the baseline');
  assert.match(fn, /hint\.dataset\.state = 'clean'/,
    'hiding the form must reset the hint state so the sticky bar cannot flash a stale "Unsaved changes"');
});
