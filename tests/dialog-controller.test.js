import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initUniversalDialogController } from '../nav-accessibility.js';

test('Universal Dialog Controller (#215) - enforces only one dialog open at a time', () => {
  const listeners = {};
  const openDialogs = new Set();

  function MockHTMLDialogElement() {}
  MockHTMLDialogElement.prototype = {
    showModal() {
      this.open = true;
      openDialogs.add(this);
    },
    close() {
      this.open = false;
      openDialogs.delete(this);
      (this.listeners['close'] || []).forEach(cb => cb());
    }
  };

  function createMockDialog(id) {
    const dialog = Object.create(MockHTMLDialogElement.prototype);
    dialog.id = id;
    dialog.open = false;
    dialog.listeners = {};
    dialog.addEventListener = function(evt, fn) {
      this.listeners[evt] = this.listeners[evt] || [];
      this.listeners[evt].push(fn);
    };
    dialog.querySelectorAll = function() { return []; };
    dialog.getAttribute = function(attr) { return null; };
    return dialog;
  }

  const d1 = createMockDialog('dialog1');
  const d2 = createMockDialog('dialog2');
  const allDialogs = [d1, d2];

  const mockDoc = {
    activeElement: { id: 'openerBtn', focus() { this.focused = true; } },
    querySelectorAll(selector) {
      if (selector === 'dialog') return allDialogs;
      if (selector === 'dialog[open]') return allDialogs.filter(d => d.open);
      return [];
    }
  };

  const mockWin = {
    HTMLDialogElement: MockHTMLDialogElement,
    addEventListener(evt, fn) { listeners[evt] = fn; },
    removeEventListener() {},
    history: {
      state: null,
      pushState(state) { this.state = state; },
      back() { this.state = null; }
    }
  };

  const controller = initUniversalDialogController({ doc: mockDoc, win: mockWin });
  assert.ok(controller, 'Controller initialized');

  // Open dialog 1
  d1.showModal();
  assert.equal(d1.open, true, 'dialog 1 is open');
  assert.equal(d2.open, false, 'dialog 2 is closed');

  // Open dialog 2 -> dialog 1 must be closed ("Only one dialog open at a time")
  d2.showModal();
  assert.equal(d1.open, false, 'dialog 1 was automatically closed');
  assert.equal(d2.open, true, 'dialog 2 is now open');

  // Close dialog 2 -> focus returned to opener
  d2.close();
  assert.equal(d2.open, false, 'dialog 2 is closed');
  assert.equal(mockDoc.activeElement.focused, true, 'Focus was returned to opener button');

  controller.destroy();
});

test('Universal Dialog Controller (#215) - HTML & CSS integrity tests', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('styles.css', 'utf8');

  // All dialogs in index.html must have accessible close buttons
  const dialogMatches = [...html.matchAll(/<dialog\s+id=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/dialog>/g)];
  assert.ok(dialogMatches.length >= 167, `Expected at least 167 dialogs, found ${dialogMatches.length}`);

  dialogMatches.forEach(m => {
    const id = m[1];
    const content = m[3];
    const hasClose = /class=["'][^"']*(?:close-button|modal-close-btn|billing-modal-close)[^"']*["']|id=["'][^"']*close[^"']*["']|aria-label=["'][^"']*close[^"']*["']/i.test(content);
    assert.ok(hasClose, `Dialog #${id} must contain a close button`);
  });

  // Verify responsive CSS rules in styles.css
  assert.ok(css.includes('STANDARDIZED RESPONSIVE DIALOGS & BOTTOM-SHEET COMPONENT'), 'styles.css must have dialog section');
  assert.ok(css.includes('max-width: min(560px, calc(100vw - 16px))'), 'styles.css must enforce 560px / 100vw-16px max width');
  assert.ok(css.includes('min-width: 48px !important;'), 'styles.css must enforce 48px min-width');
  assert.ok(css.includes('min-height: 48px !important;'), 'styles.css must enforce 48px min-height');
  assert.ok(css.includes('.qc-customer-list'), 'styles.css must style quick collect customer list responsively');
});
