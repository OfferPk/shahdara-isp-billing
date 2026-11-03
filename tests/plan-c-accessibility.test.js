// Plan C — Accessibility foundations: keyboard, focus, dialogs.
// The dialog contract, tested as real logic against a small mock DOM:
// every dialog traps focus, closes on Escape, and returns focus to its
// opener; every form control has an associated label. Static markup
// (index.html) is checked by string contract at the end of this file.
// No visual redesign is tested or changed here (that was Plan A).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  trapModalFocus,
  getFocusableElements,
  humaniseControlToken,
  ensureDialogAccessibleName,
  isLabelledControl,
  labelFormControls,
  initUniversalDialogController,
} from '../nav-accessibility.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// ---- Minimal mock DOM -------------------------------------------------
// Only the surface nav-accessibility.js touches: tagName, id, type,
// name, href, tabindex, hidden, disabled, style, textContent,
// get/set/hasAttribute, add/removeEventListener, focus, closest,
// querySelector(All), contains. Selector matching emulates the CSS
// parts nav-accessibility.js actually uses (:not([disabled]),
// :not([hidden]), [href], [tabindex], [type="hidden"], plain tags).

function matchesPart(el, part) {
  const tagMatch = part.match(/^([a-z][a-z0-9]*)/i);
  if (tagMatch) {
    if (el.tagName.toLowerCase() !== tagMatch[1].toLowerCase()) return false;
  } else if (part.startsWith('[tabindex]')) {
    if (el.tabindex === undefined || el.tabindex === null) return false;
  } else {
    return false;
  }
  if (part.includes('[href]') && !el.href) return false;
  if (part.includes(':not([disabled])') && el.disabled) return false;
  if (part.includes(':not([hidden])') && el.hidden) return false;
  if (part.includes(':not([tabindex="-1"])') && String(el.tabindex) === '-1') return false;
  if (part.includes(':not([type="hidden"])') && el.type === 'hidden') return false;
  return true;
}

function mockQuery(elements, selector) {
  const parts = selector.split(',').map(s => s.trim());
  return elements.filter(el => parts.some(part => matchesPart(el, part)));
}

function stubEl(doc, opts = {}) {
  const el = {
    tagName: (opts.tag || 'div').toUpperCase(),
    id: opts.id || '',
    type: opts.type || '',
    name: opts.name || '',
    href: opts.href,
    tabindex: opts.tabindex,
    htmlFor: opts.htmlFor,
    hidden: !!opts.hidden,
    disabled: !!opts.disabled,
    style: opts.style || {},
    textContent: opts.text || '',
    focused: false,
    open: !!opts.open,
    _attrs: { ...(opts.attrs || {}) },
    _listeners: {},
    _labelParent: opts.labelParent || null,
    getAttribute(n) { return this._attrs[n] ?? null; },
    setAttribute(n, v) { this._attrs[n] = String(v); },
    hasAttribute(n) { return n in this._attrs; },
    removeAttribute(n) { delete this._attrs[n]; },
    addEventListener(evt, fn) { (this._listeners[evt] ||= []).push(fn); },
    removeEventListener(evt, fn) { this._listeners[evt] = (this._listeners[evt] || []).filter(f => f !== fn); },
    dispatch(evt, e = {}) {
      const ev = { ...e, target: this, preventDefault() { this.defaultPrevented = true; } };
      for (const fn of (this._listeners[evt] || [])) fn(ev);
      return ev;
    },
    focus() { this.focused = true; if (doc) doc.activeElement = this; },
    closest(sel) {
      if (sel === 'label') return this._labelParent;
      return null;
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    contains(other) { return other === this; },
  };
  if (opts.placeholder !== undefined) el._attrs.placeholder = opts.placeholder;
  if (opts.title !== undefined) el._attrs.title = opts.title;
  return el;
}

function containerEl(doc, opts, descendants) {
  const c = stubEl(doc, opts);
  c.children = descendants;
  c.contains = other => other === c || descendants.includes(other);
  c.querySelectorAll = selector => mockQuery(descendants, selector);
  c.querySelector = selector => mockQuery(descendants, selector)[0] || null;
  return c;
}

function makeTrapFixture(doc) {
  const opener = stubEl(doc, { tag: 'button', id: 'openerBtn' });
  doc.activeElement = opener;
  const first = stubEl(doc, { tag: 'button', id: 'firstBtn' });
  const middle = stubEl(doc, { tag: 'input', id: 'middleInput', type: 'text' });
  const last = stubEl(doc, { tag: 'button', id: 'lastBtn' });
  const modal = containerEl(doc, { tag: 'dialog', id: 'testDialog' }, [first, middle, last]);
  return { opener, first, middle, last, modal };
}

// ---- trapModalFocus ----------------------------------------------------

test('Plan C trap: Tab on the last element wraps to the first', () => {
  const doc = { activeElement: null };
  const { last, first, modal } = makeTrapFixture(doc);
  trapModalFocus(modal, { doc, focusDelay: 0 });
  doc.activeElement = last;
  const ev = modal.dispatch('keydown', { key: 'Tab', shiftKey: false });
  assert.equal(ev.defaultPrevented, true);
  assert.equal(first.focused, true);
});

test('Plan C trap: Shift+Tab on the first element wraps to the last', () => {
  const doc = { activeElement: null };
  const { first, last, modal } = makeTrapFixture(doc);
  trapModalFocus(modal, { doc, focusDelay: 0 });
  doc.activeElement = first;
  const ev = modal.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(ev.defaultPrevented, true);
  assert.equal(last.focused, true);
});

test('Plan C trap: Tab in the middle does not wrap or prevent default', () => {
  const doc = { activeElement: null };
  const { middle, first, last, modal } = makeTrapFixture(doc);
  trapModalFocus(modal, { doc, focusDelay: 0 });
  doc.activeElement = middle;
  const ev = modal.dispatch('keydown', { key: 'Tab', shiftKey: false });
  assert.equal(ev.defaultPrevented, undefined);
  assert.equal(first.focused, false);
  assert.equal(last.focused, false);
});

test('Plan C trap: Tab from outside the dialog wraps to the first element', () => {
  const doc = { activeElement: null };
  const { opener, first, modal } = makeTrapFixture(doc);
  trapModalFocus(modal, { doc, focusDelay: 0 });
  doc.activeElement = opener;
  modal.dispatch('keydown', { key: 'Tab', shiftKey: false });
  assert.equal(first.focused, true);
});

test('Plan C trap: Escape calls onEscape and prevents default', () => {
  const doc = { activeElement: null };
  const { modal } = makeTrapFixture(doc);
  let escaped = 0;
  trapModalFocus(modal, { doc, focusDelay: 0, onEscape: () => { escaped++; } });
  const ev = modal.dispatch('keydown', { key: 'Escape' });
  assert.equal(escaped, 1);
  assert.equal(ev.defaultPrevented, true);
});

test('Plan C trap: Escape without onEscape does nothing', () => {
  const doc = { activeElement: null };
  const { modal } = makeTrapFixture(doc);
  trapModalFocus(modal, { doc, focusDelay: 0 });
  const ev = modal.dispatch('keydown', { key: 'Escape' });
  assert.equal(ev.defaultPrevented, undefined);
});

test('Plan C trap: release returns focus to the opener and removes the listener', () => {
  const doc = { activeElement: null };
  const { opener, modal } = makeTrapFixture(doc);
  const release = trapModalFocus(modal, { doc, focusDelay: 0 });
  opener.focused = false;
  release();
  assert.equal(opener.focused, true);
  assert.equal((modal._listeners.keydown || []).length, 0);
});

test('Plan C trap: initial focus goes to the first focusable element', async () => {
  const doc = { activeElement: null };
  const { first, modal } = makeTrapFixture(doc);
  trapModalFocus(modal, { doc, focusDelay: 0 });
  await sleep(10);
  assert.equal(first.focused, true);
});

test('Plan C trap: an explicit initialFocus element is honoured', async () => {
  const doc = { activeElement: null };
  const { middle, modal } = makeTrapFixture(doc);
  trapModalFocus(modal, { doc, focusDelay: 0, initialFocus: middle });
  await sleep(10);
  assert.equal(middle.focused, true);
});

test('Plan C trap: initial focus is not set synchronously (default delay)', () => {
  const doc = { activeElement: null };
  const { first, modal } = makeTrapFixture(doc);
  trapModalFocus(modal, { doc });
  assert.equal(first.focused, false);
});

test('Plan C trap: a dialog with no focusable element gets tabindex -1 and focus', async () => {
  const doc = { activeElement: null };
  const modal = containerEl(doc, { tag: 'dialog', id: 'emptyDialog' }, []);
  trapModalFocus(modal, { doc, focusDelay: 0 });
  await sleep(10);
  assert.equal(modal._attrs.tabindex, '-1');
  assert.equal(modal.focused, true);
});

test('Plan C trap: a null modal returns a harmless release function', () => {
  const release = trapModalFocus(null, {});
  assert.equal(typeof release, 'function');
  release();
});

// ---- getFocusableElements ----------------------------------------------

test('Plan C focusables: order is DOM order, disabled and hidden are excluded', () => {
  const doc = { activeElement: null };
  const ok1 = stubEl(doc, { tag: 'button', id: 'ok1' });
  const disabled = stubEl(doc, { tag: 'button', id: 'off', disabled: true });
  const hidden = stubEl(doc, { tag: 'input', id: 'hid', type: 'text', hidden: true });
  const displayNone = stubEl(doc, { tag: 'input', id: 'dn', type: 'text', style: { display: 'none' } });
  const hiddenType = stubEl(doc, { tag: 'input', id: 'ht', type: 'hidden' });
  const ok2 = stubEl(doc, { tag: 'select', id: 'ok2' });
  const modal = containerEl(doc, { tag: 'dialog', id: 'd' }, [ok1, disabled, hidden, displayNone, hiddenType, ok2]);
  assert.deepEqual(getFocusableElements(modal).map(el => el.id), ['ok1', 'ok2']);
});

test('Plan C focusables: a null container returns an empty list', () => {
  assert.deepEqual(getFocusableElements(null), []);
});

test('Plan C focusables: tabindex -1 elements are excluded', () => {
  const doc = { activeElement: null };
  const skip = stubEl(doc, { tag: 'div', id: 'skip', tabindex: '-1' });
  const keep = stubEl(doc, { tag: 'div', id: 'keep', tabindex: '0' });
  const modal = containerEl(doc, { tag: 'dialog', id: 'd' }, [skip, keep]);
  assert.deepEqual(getFocusableElements(modal).map(el => el.id), ['keep']);
});

// ---- humaniseControlToken ----------------------------------------------

test('Plan C humanise: camelCase, kebab-case and snake_case tokens', () => {
  assert.equal(humaniseControlToken('voidPaymentReasonInput'), 'Void Payment Reason Input');
  assert.equal(humaniseControlToken('quick-collect-amount'), 'Quick collect amount');
  assert.equal(humaniseControlToken('sender_digits'), 'Sender digits');
});

test('Plan C humanise: empty and blank tokens give an empty label', () => {
  assert.equal(humaniseControlToken(''), '');
  assert.equal(humaniseControlToken('   '), '');
});

// ---- ensureDialogAccessibleName -----------------------------------------

test('Plan C dialog name: first heading becomes the aria-label', () => {
  const doc = { activeElement: null };
  const heading = stubEl(doc, { tag: 'h2', text: 'Void / Reverse Payment' });
  const dialog = containerEl(doc, { tag: 'dialog', id: 'voidPaymentDialog' }, [heading]);
  assert.equal(ensureDialogAccessibleName(dialog), true);
  assert.equal(dialog._attrs['aria-label'], 'Void / Reverse Payment');
});

test('Plan C dialog name: an existing aria-label is never overwritten', () => {
  const doc = { activeElement: null };
  const dialog = containerEl(doc, { tag: 'dialog', id: 'd', attrs: { 'aria-label': 'Kept' } }, []);
  assert.equal(ensureDialogAccessibleName(dialog), false);
  assert.equal(dialog._attrs['aria-label'], 'Kept');
});

test('Plan C dialog name: an existing aria-labelledby is never overwritten', () => {
  const doc = { activeElement: null };
  const dialog = containerEl(doc, { tag: 'dialog', id: 'd', attrs: { 'aria-labelledby': 'someTitle' } }, []);
  assert.equal(ensureDialogAccessibleName(dialog), false);
  assert.equal(dialog._attrs['aria-label'], undefined);
});

test('Plan C dialog name: no heading falls back to the humanised id', () => {
  const doc = { activeElement: null };
  const dialog = containerEl(doc, { tag: 'dialog', id: 'addCustomerDialog' }, []);
  assert.equal(ensureDialogAccessibleName(dialog), true);
  assert.equal(dialog._attrs['aria-label'], 'Add Customer Dialog');
});

test('Plan C dialog name: a null dialog returns false', () => {
  assert.equal(ensureDialogAccessibleName(null), false);
});

// ---- isLabelledControl / labelFormControls ------------------------------

test('Plan C labelling: a real placeholder becomes the aria-label', () => {
  const doc = { activeElement: null };
  const input = stubEl(doc, { tag: 'input', id: 'noteInput', type: 'text', placeholder: 'Enter a note' });
  const form = containerEl(doc, { tag: 'div', id: 'f' }, [input]);
  assert.equal(labelFormControls(form), 1);
  assert.equal(input._attrs['aria-label'], 'Enter a note');
});

test('Plan C labelling: an "e.g." placeholder is not used as a label', () => {
  const doc = { activeElement: null };
  const input = stubEl(doc, { tag: 'input', id: 'senderDigitsInput', type: 'text', placeholder: 'e.g. 3310' });
  const form = containerEl(doc, { tag: 'div', id: 'f' }, [input]);
  assert.equal(labelFormControls(form), 1);
  assert.equal(input._attrs['aria-label'], 'Sender Digits Input');
});

test('Plan C labelling: title is used when there is no placeholder', () => {
  const doc = { activeElement: null };
  const input = stubEl(doc, { tag: 'input', id: 'x1', type: 'text', title: 'Amount in PKR' });
  const form = containerEl(doc, { tag: 'div', id: 'f' }, [input]);
  assert.equal(labelFormControls(form), 1);
  assert.equal(input._attrs['aria-label'], 'Amount in PKR');
});

test('Plan C labelling: name is used when there is no placeholder or title', () => {
  const doc = { activeElement: null };
  const input = stubEl(doc, { tag: 'input', id: 'x2', type: 'text', name: 'paymentDate' });
  const form = containerEl(doc, { tag: 'div', id: 'f' }, [input]);
  assert.equal(labelFormControls(form), 1);
  assert.equal(input._attrs['aria-label'], 'Payment Date');
});

test('Plan C labelling: an existing aria-label is never overwritten', () => {
  const doc = { activeElement: null };
  const input = stubEl(doc, { tag: 'input', id: 'x3', type: 'text', placeholder: 'Changed', attrs: { 'aria-label': 'Original' } });
  const form = containerEl(doc, { tag: 'div', id: 'f' }, [input]);
  assert.equal(labelFormControls(form), 0);
  assert.equal(input._attrs['aria-label'], 'Original');
});

test('Plan C labelling: a <label for> counts as labelled', () => {
  const doc = { activeElement: null };
  const input = stubEl(doc, { tag: 'input', id: 'x4', type: 'text', placeholder: 'Ignored' });
  const label = stubEl(doc, { tag: 'label', htmlFor: 'x4' });
  const form = containerEl(doc, { tag: 'div', id: 'f' }, [input, label]);
  assert.equal(isLabelledControl(input, form), true);
  assert.equal(labelFormControls(form), 0);
});

test('Plan C labelling: a wrapping <label> counts as labelled', () => {
  const doc = { activeElement: null };
  const label = stubEl(doc, { tag: 'label' });
  const input = stubEl(doc, { tag: 'input', id: 'x5', type: 'checkbox', labelParent: label });
  const form = containerEl(doc, { tag: 'div', id: 'f' }, [input]);
  assert.equal(isLabelledControl(input, form), true);
  assert.equal(labelFormControls(form), 0);
});

test('Plan C labelling: hidden inputs are skipped', () => {
  const doc = { activeElement: null };
  const input = stubEl(doc, { tag: 'input', id: 'x6', type: 'hidden', placeholder: 'Secret' });
  const form = containerEl(doc, { tag: 'div', id: 'f' }, [input]);
  assert.equal(labelFormControls(form), 0);
  assert.equal(input._attrs['aria-label'], undefined);
});

test('Plan C labelling: a control with no name source is left alone', () => {
  const doc = { activeElement: null };
  const input = stubEl(doc, { tag: 'input', type: 'text' });
  const form = containerEl(doc, { tag: 'div', id: 'f' }, [input]);
  assert.equal(labelFormControls(form), 0);
});

test('Plan C labelling: a null container labels nothing', () => {
  assert.equal(labelFormControls(null), 0);
});

// ---- Primary-flow dialog contract (mock dialogs) ------------------------
// One contract per primary flow: add customer, collect payment (Quick
// Collect), void payment, correct payment. Each flow's dialog must trap
// Tab, close on Escape, and return focus to its opener.

const PRIMARY_FLOWS = ['addCustomer', 'quickCollect', 'voidPayment', 'correctPayment'];

for (const flow of PRIMARY_FLOWS) {
  test(`Plan C primary flow (${flow}): Tab wraps inside the dialog`, () => {
    const doc = { activeElement: null };
    const { last, first, modal } = makeTrapFixture(doc);
    modal.id = `${flow}Dialog`;
    trapModalFocus(modal, { doc, focusDelay: 0 });
    doc.activeElement = last;
    modal.dispatch('keydown', { key: 'Tab', shiftKey: false });
    assert.equal(first.focused, true);
  });

  test(`Plan C primary flow (${flow}): Escape closes and focus returns to the opener`, () => {
    const doc = { activeElement: null };
    const { opener, modal } = makeTrapFixture(doc);
    modal.id = `${flow}Dialog`;
    let closed = 0;
    const release = trapModalFocus(modal, {
      doc,
      focusDelay: 0,
      onEscape: () => { closed++; release(); },
    });
    modal.dispatch('keydown', { key: 'Escape' });
    assert.equal(closed, 1);
    assert.equal(opener.focused, true);
  });
}

// ---- Universal controller: fallback-visible dialogs ---------------------

function makeUniversalFixture({ role = null, hidden = false } = {}) {
  const doc = { activeElement: null };
  const dialog = stubEl(doc, {
    tag: 'dialog',
    id: 'fallbackDialog',
    hidden,
    attrs: role ? { role } : {},
  });
  dialog.open = false;
  const mockDoc = {
    activeElement: doc.activeElement,
    querySelectorAll: selector => (selector === 'dialog' ? [dialog] : []),
  };
  const mockWin = {
    addEventListener() {},
    removeEventListener() {},
  };
  return { dialog, mockDoc, mockWin };
}

test('Plan C universal controller: Escape hides a fallback-visible dialog', () => {
  const { dialog, mockDoc, mockWin } = makeUniversalFixture({ hidden: false });
  const controller = initUniversalDialogController({ doc: mockDoc, win: mockWin });
  assert.equal(dialog._attrs['aria-label'], 'Fallback Dialog');
  dialog.dispatch('keydown', { key: 'Escape' });
  assert.equal(dialog.hidden, true);
  controller.destroy();
});

test('Plan C universal controller: Escape never closes an alertdialog', () => {
  const { dialog, mockDoc, mockWin } = makeUniversalFixture({ role: 'alertdialog', hidden: false });
  const controller = initUniversalDialogController({ doc: mockDoc, win: mockWin });
  dialog.dispatch('keydown', { key: 'Escape' });
  assert.equal(dialog.hidden, false);
  controller.destroy();
});

// ---- Static markup contract (index.html) ---------------------------------

function dialogAttrs(id) {
  const m = indexHtml.match(new RegExp(`<dialog\\b[^>]*id="${id}"[^>]*>`));
  assert.ok(m, `Dialog #${id} must exist in index.html`);
  return m[0];
}

test('Plan C static: every dialog in index.html has an accessible name', () => {
  const tags = [...indexHtml.matchAll(/<dialog\b([^>]*)>/g)];
  assert.ok(tags.length >= 250, `Expected at least 250 dialogs, found ${tags.length}`);
  const unnamed = tags.filter(m => !/aria-label=/.test(m[1]) && !/aria-labelledby=/.test(m[1]));
  assert.deepEqual(unnamed, [], 'Every <dialog> must carry aria-label or aria-labelledby');
});

test('Plan C static: the 11 previously unnamed dialogs are now named', () => {
  const formerlyUnnamed = [
    'jsonBackupDialog', 'deltaMergeDialog', 'storageRecoveryDialog',
    'encryptedBackupDialog', 'csvImportDialog', 'manualBaqayaDialog',
    'additionalPendingDialog', 'addCustomerDialog', 'billingCorrectnessModal',
    'dataIntegrityModal', 'collectionTargetModal',
  ];
  for (const id of formerlyUnnamed) {
    const attrs = dialogAttrs(id);
    assert.ok(/aria-label=/.test(attrs) || /aria-labelledby=/.test(attrs), `Dialog #${id} must now have an accessible name`);
  }
});

test('Plan C static: all primary-flow dialogs have an accessible name', () => {
  const primary = [
    'addCustomerDialog', 'quickCollectModal', 'voidPaymentDialog',
    'paymentMethodReassignDialog', 'advancePaymentDialog', 'paymentReminderModal',
  ];
  for (const id of primary) {
    const attrs = dialogAttrs(id);
    assert.ok(/aria-label=/.test(attrs) || /aria-labelledby=/.test(attrs), `Primary dialog #${id} must have an accessible name`);
  }
});

test('Plan C static: the Quick Collect override-reason control is labelled', () => {
  const m = indexHtml.match(/<input\b[^>]*id="quickCollectOverrideReasonInput"[^>]*>/);
  assert.ok(m, 'quickCollectOverrideReasonInput must exist');
  assert.ok(/aria-label=/.test(m[0]), 'quickCollectOverrideReasonInput must carry aria-label');
});

test('Plan C static: the void reason control keeps its <label for>', () => {
  assert.ok(/<label\b[^>]*for="voidPaymentReasonInput"/.test(indexHtml), 'voidPaymentReasonInput must keep its <label for>');
  assert.ok(/<label\b[^>]*for="voidPaymentReasonInput"/.test(indexHtml), 'void reason label must exist');
});

test('Plan C static: the add-customer dialog keeps its close button', () => {
  const block = indexHtml.match(/<dialog\b[^>]*id="addCustomerDialog"[^>]*>([\s\S]*?)<\/dialog>/);
  assert.ok(block, 'addCustomerDialog must exist');
  assert.ok(/aria-label="Close"/.test(block[1]), 'addCustomerDialog must keep a labelled close button');
});
