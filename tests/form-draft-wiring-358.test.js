// Issue #358 (found in the Expenses deep test): app.js wires the
// expense and add-customer draft controllers as
// wireFormDraftAutosave(el, 'formId', { onRestore, onClear, storage }),
// but the implementation only accepted (el, { formId, ... }) — the
// string second argument was destructured as the options object, so
// onRestore/onClear were always undefined and the "draft restored"
// notices never appeared even though drafts saved and refilled.
// The implementation now accepts both call shapes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wireFormDraftAutosave, saveFormDraft } from '../form-validation.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k)
  };
}

function fakeForm() {
  const amount = { name: 'amount', type: 'number', value: '' };
  return {
    id: 'expenseForm',
    elements: [amount],
    addEventListener: () => {},
    amountEl: amount
  };
}

test('358: string-formId call shape fires onRestore and restores values', () => {
  const storage = fakeStorage();
  saveFormDraft('expenseForm', { amount: '999' }, storage);
  const form = fakeForm();
  let restored = 0;
  const ctl = wireFormDraftAutosave(form, 'expenseForm', {
    storage,
    onRestore: () => { restored++; },
    onClear: () => {}
  });
  assert.equal(ctl.restore(), true);
  assert.equal(form.amountEl.value, '999');
  assert.equal(restored, 1, 'onRestore must fire so the notice can show');
});

test('358: options-object call shape still works', () => {
  const storage = fakeStorage();
  saveFormDraft('expenseForm', { amount: '42' }, storage);
  const form = fakeForm();
  let restored = 0;
  const ctl = wireFormDraftAutosave(form, {
    formId: 'expenseForm',
    storage,
    onRestore: () => { restored++; }
  });
  assert.equal(ctl.restore(), true);
  assert.equal(form.amountEl.value, '42');
  assert.equal(restored, 1);
});

test('358: clear() fires onClear in the string call shape', () => {
  const storage = fakeStorage();
  saveFormDraft('expenseForm', { amount: '7' }, storage);
  const form = fakeForm();
  let cleared = 0;
  const ctl = wireFormDraftAutosave(form, 'expenseForm', {
    storage,
    onClear: () => { cleared++; }
  });
  ctl.clear();
  assert.equal(cleared, 1);
  assert.equal(ctl.getDraft(), null);
});
