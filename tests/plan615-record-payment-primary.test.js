// Plan 615 — "Record payment" is the primary action in the
// quick-actions row.
//
// The row (Plan 369 module profile-quick-actions.js) gave all four
// buttons the same secondary weight, while recording a payment is the
// action the operator opens the profile to do most often — and one
// screen over, #currentBillPaymentShortcut already carries primary
// weight for the same action. The payment button is now the row's
// only primary-button, same label, same handler (wiring is by button
// id, never by class).
//
// THE TRAP: a bare class swap is VISUALLY A NO-OP. .primary-button
// (styles.css line 1, minified) sets background var(--green), but
// .pqa-btn-payment (:1898) comes ~1900 lines later at the SAME
// specificity (one class), so it wins for background/color/
// border-color and the button would stay pale green. The fix keeps
// the colour class and adds a scoped override rule
// (.pqa-btn-payment.primary-button, tokens only, no new hex) plus its
// :hover variant. C3 below simulates the cascade and only passes
// when the WINNING background is the primary green — a test that
// only asserted the class string would pass a bare swap while the
// button looked identical on screen.
//
// This file asserts NO key-count total (class only, the count stays).
// It must contain NEITHER the current nor the previous count's bare
// digits, and no split-literal form of them either — the plan591 G5a
// sweep and the pnl count are the enforcement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TRANSLATIONS } from '../nav-language.js';
import {
  profileQuickActionsRowHtml,
  profileQuickActionTarget,
} from '../profile-quick-actions.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const styles = readFileSync(join(root, 'styles.css'), 'utf8');
const appJs = readFileSync(join(root, 'app.js'), 'utf8');

const html = profileQuickActionsRowHtml('CUST-1', {});
const urHtml = profileQuickActionsRowHtml('CUST-1', {
  heading: TRANSLATIONS.ur.prof_quick_action_heading,
  payment: TRANSLATIONS.ur.prof_quick_action_payment,
  fault: TRANSLATIONS.ur.prof_quick_action_fault,
  message: TRANSLATIONS.ur.prof_quick_action_message,
  balance: TRANSLATIONS.ur.prof_quick_action_balance,
});

// The class attribute of one button, by its id (class comes before id
// in the template, so match the whole tag then pull the class out).
function buttonClasses(markup, buttonId) {
  const tag = markup.match(new RegExp(`<button[^>]*id="${buttonId}"[^>]*>`));
  assert.ok(tag, `button #${buttonId} exists in the row`);
  const cls = tag[0].match(/class="([^"]+)"/);
  assert.ok(cls, `#${buttonId} carries a class attribute`);
  return cls[1].split(/\s+/).filter(Boolean);
}

const paymentClasses = buttonClasses(html, 'pqaPaymentBtn');
const otherIds = ['pqaFaultBtn', 'pqaMessageBtn', 'pqaBalanceBtn'];

// Small cascade simulation for one property on the payment button:
// collect every styles.css rule whose selector matches the button
// (base state only — :hover/:focus rules excluded), score by
// specificity then source order, return the winning declaration value.
function winningDeclaration(classList, property) {
  const elementClasses = new Set(classList);
  const ancestorClasses = new Set(['profile-quick-actions']);
  // Strip comments first: a comment before a rule would otherwise be
  // swallowed into its "selector" and inflate its specificity.
  const cleanStyles = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  let best = null; // {spec, order, value}
  let order = 0;
  for (const m of cleanStyles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    order += 1;
    const declarations = m[2];
    if (!new RegExp(`(^|;)\\s*${property}\\s*:`, 'i').test(declarations)) continue;
    for (const rawSel of m[1].split(',')) {
      const sel = rawSel.trim();
      // Base state only; pseudo-elements never match the button
      // itself, attribute selectors are not button attributes, and
      // :root is the document root — all would otherwise "match"
      // vacuously.
      if (!sel || sel.includes(':hover') || sel.includes(':focus') || sel.includes('::') || sel.includes('[') || sel.includes(':root')) continue;
      const compounds = sel.split(/[\s>+~]+/).filter(Boolean);
      let matches = true;
      let spec = 0;
      compounds.forEach((compound, idx) => {
        const last = idx === compounds.length - 1;
        const pool = last ? elementClasses : ancestorClasses;
        const classes = compound.match(/\.[A-Za-z0-9_-]+/g) || [];
        const ids = compound.match(/#[A-Za-z0-9_-]+/g) || [];
        const tag = compound.match(/^[A-Za-z][A-Za-z0-9-]*/);
        if (ids.length > 0) matches = false; // no id selector applies here
        for (const c of classes) {
          if (!pool.has(c.slice(1))) matches = false;
          spec += 10;
        }
        if (tag && tag[0] !== '*' && last && tag[0] !== 'button') matches = false;
        if (tag && tag[0] !== '*') spec += 1;
        if (compound.includes('[')) spec += 10;
      });
      if (!matches) continue;
      const value = declarations.match(new RegExp(`(^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i'))[2].trim();
      if (!best || spec > best.spec || (spec === best.spec)) best = { spec, order, value };
    }
  }
  return best ? best.value : null;
}

test('C1: the payment button carries primary-button', () => {
  assert.ok(paymentClasses.includes('primary-button'), `payment button classes are [${paymentClasses.join(' ')}], expected primary-button among them`);
  assert.ok(!paymentClasses.includes('secondary-button'), 'payment is no longer secondary');
  assert.ok(paymentClasses.includes('pqa-btn-payment'), 'payment keeps its colour class (the override does the visual work)');
});

test('C2: the payment button is the row\'s ONLY primary-button', () => {
  const primaryCount = (html.match(/primary-button/g) || []).length;
  assert.equal(primaryCount, 1, `expected exactly 1 primary-button in the row, found ${primaryCount}`);
  assert.ok(paymentClasses.includes('primary-button'), 'the one primary-button is the payment button');
});

test('C3: the payment button is VISUALLY primary — the cascade winner is the primary green, not the pale pqa green', () => {
  // The scoped override rule exists (route A) and carries the tokens.
  assert.ok(styles.includes('.pqa-btn-payment.primary-button{background:var(--green);color:#fff;border-color:var(--green)}'), 'the scoped override rule exists with the primary tokens');
  assert.ok(styles.includes('.pqa-btn-payment.primary-button:hover{background:var(--green-dark);color:#fff;border-color:var(--green-dark)}'), 'the :hover variant darkens instead of staying green');
  // The cascade simulation: the WINNING background for the payment
  // button's class set must be the primary green. A bare class swap
  // (no override rule) leaves .pqa-btn-payment winning with the pale
  // green — this is the check that catches it.
  const bg = winningDeclaration(paymentClasses, 'background');
  assert.ok(bg, 'some rule sets the payment button background');
  assert.equal(bg, 'var(--green)', `winning background is ${bg}, expected var(--green)`);
  const color = winningDeclaration(paymentClasses, 'color');
  assert.equal(color, '#fff', `winning color is ${color}, expected #fff`);
});

test('S1: the other three buttons stay secondary, keep their colour classes, and the order is unchanged', () => {
  for (const id of otherIds) {
    const cls = buttonClasses(html, id);
    assert.ok(cls.includes('secondary-button'), `${id} stays secondary`);
    assert.ok(!cls.includes('primary-button'), `${id} is not primary`);
  }
  assert.ok(html.includes('class="secondary-button pqa-btn pqa-btn-fault"'), 'fault keeps its colour class');
  assert.ok(html.includes('class="secondary-button pqa-btn pqa-btn-message"'), 'message keeps its colour class');
  assert.ok(html.includes('class="secondary-button pqa-btn pqa-btn-balance"'), 'balance keeps its colour class');
  const at = (k) => html.indexOf(`pqa-btn-${k}`);
  assert.ok(at('payment') < at('fault') && at('fault') < at('message') && at('message') < at('balance'), 'button order unchanged');
});

test('S2: tapping payment still opens Quick Collect with the customer selected (wiring by id, not by class)', () => {
  assert.equal(profileQuickActionTarget('payment').kind, 'quick-collect', 'payment target is still quick-collect');
  assert.ok(appJs.includes('for (const action of PROFILE_QUICK_ACTIONS)'), 'app.js still wires by the action list');
  assert.ok(appJs.includes('quickCollectModalController?.selectAndOpen'), 'payment still opens Quick Collect with the customer');
  assert.ok(!appJs.includes("querySelector('.primary-button')"), 'no wiring selects by the primary class');
});

test('B1: in Urdu mode the payment button is still the row\'s only primary button, with its Urdu label', () => {
  const urPaymentClasses = buttonClasses(urHtml, 'pqaPaymentBtn');
  assert.ok(urPaymentClasses.includes('primary-button'), 'UR payment button is primary');
  assert.equal((urHtml.match(/primary-button/g) || []).length, 1, 'exactly 1 primary-button in the UR row');
  assert.ok(urHtml.includes('ادائیگی درج کریں'), 'the UR label renders');
  assert.equal(TRANSLATIONS.en.prof_quick_action_payment, 'Record payment', 'EN label unchanged');
  assert.equal(TRANSLATIONS.ur.prof_quick_action_payment, 'ادائیگی درج کریں', 'UR label unchanged');
});
