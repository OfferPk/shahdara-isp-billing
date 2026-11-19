// Plan 602 — profile contact-action links are full-size (44px) buttons.
//
// The spec (written 2026-11-08, before Sharafat 96) lists a whole inventory
// of "small" profile quick actions. Sharafat 96's global floor
// (`button:not([hidden]) { min-height: 44px !important; }`) already lifts
// every <button> on the profile to 44px, so almost the whole spec is stale.
// The ONE live residue: the profile contact shortcuts (Call, WhatsApp, SMS,
// Call Alternate, WhatsApp Alternate) are <a> elements, so the button floor
// never reaches them — their own rule set 38px, 2px under the spec's 40px
// standard and 6px under the 44px buttons in the same row (the disabled
// WhatsApp variant IS a <button> and renders 44px).
//
// The fix is one value in one rule: styles.css
// `.profile-contact-actions a { ... min-height: 38px ... }` -> 44px.
// 44px, not the spec's 40px: the row's other controls render 44px, so 40px
// would leave a visible 4px mismatch in the same row — the very complaint
// the spec makes. 44px satisfies the >=40px acceptance with margin and
// makes the row uniform.
//
// Pure CSS-source assertions, no names or numbers (Sharafat 96 / Plan 550
// pattern). styles.css is MINIFIED — rule text is cited, never line numbers.
//
// This file pins NO parity total and asserts NO parity: it must contain
// neither the current-total bare digits nor the previous-total bare digits
// (plan591 G5a sweep — see the G9 self-guard, which builds them from split
// literals so the file itself never carries them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROFILE_QUICK_ACTIONS,
  PROFILE_QUICK_ACTION_KEYS,
} from '../profile-quick-actions.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const styles = read('styles.css');
const appSrc = read('app.js');

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
const stylesNC = stripComments(styles);

// All rule bodies for a selector (any occurrence — a selector can appear in
// several rules and the first occurrence is not always the one carrying the
// property).
function ruleBodies(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}', 'g');
  return [...css.matchAll(re)].map((m) => m[1]);
}
// Rule bodies whose selector LIST contains `member` (multi-selector rules:
// `.receipt-finder-actions .receipt-whatsapp-action, .receipt-finder-actions
// .receipt-phone-help { ... }` — anchor on the member, allow the rest of the
// list before the `{`).
function ruleBodiesList(css, member) {
  const esc = member.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '[^{]*\\{([^}]*)\\}', 'g');
  return [...css.matchAll(re)].map((m) => m[1]);
}
function sizes(bodies) {
  const out = [];
  for (const b of bodies) {
    for (const m of b.matchAll(/(?:min-height|height|min-width|width)\s*:\s*([\d.]+)px/g)) {
      out.push(Number(m[1]));
    }
  }
  return out;
}
const allAtLeast = (bodies, n) => {
  const s = sizes(bodies);
  return s.length > 0 && s.every((v) => v >= n);
};
const hasProp = (bodies, re) => bodies.some((b) => re.test(b));

// --- G1: the fix ---
test('G1 profile contact-action links carry min-height >=44 in their own rule', () => {
  // An <a>, so the 44px button floor never reaches it — the own rule is the
  // guarantee (Sharafat 96 F5 pattern for .detail-identity-action).
  assert.ok(allAtLeast(ruleBodies(stylesNC, '.profile-contact-actions a'), 44),
    'styles.css .profile-contact-actions a still min-height:38px (renders 38px — under the 40px standard and 6px under the 44px buttons in the same row)');
});

// --- G2: the rule occurs exactly once ---
test('G2 the contact-action rule occurs exactly once (no phone-width duplicate)', () => {
  const count = (stylesNC.match(/\.profile-contact-actions a\{/g) || []).length;
  assert.equal(count, 1,
    'styles.css carries a second .profile-contact-actions a rule — fix it too, or the phones keep the old size');
});

// --- G3: the floor is intact ---
test('G3 the 44px button floor is still present verbatim', () => {
  assert.ok(/button:not\(\[hidden\]\)\s*\{\s*min-height:\s*44px\s*!important/.test(stylesNC),
    'the styles.css 44px button floor is gone or changed — every <button> on the profile depends on it');
});

// --- G4: the disabled WhatsApp button in the same row ---
test('G4 the disabled WhatsApp action in the same row is a <button> (44px via the floor)', () => {
  // app.js renders the contact shortcuts as <a class="secondary-button">
  // links inside <span class="profile-contact-actions">, except the
  // WhatsApp slot when the number cannot do WhatsApp — that one renders
  // as a disabled <button> in the SAME span, so the floor lifts it to
  // 44px. The fix makes the enabled links match it.
  assert.ok(appSrc.includes('class="profile-contact-actions"'),
    'app.js no longer renders the .profile-contact-actions span');
  assert.ok(appSrc.includes('<button type="button" class="secondary-button" disabled>'),
    'app.js no longer renders the disabled WhatsApp <button> in the contact row');
});

// --- G5: the card 36px carve-out is untouched (deliberate, user-requested) ---
test('G5 directory-card Call link stays 36px by user decision (out of scope)', () => {
  assert.ok(hasProp(ruleBodies(stylesNC, '.customer-card-action-btn'), /min-height\s*:\s*36px/),
    'styles.css .customer-card-action-btn is no longer min-height:36px');
  assert.ok(/button:not\(\[hidden\]\)\.customer-card-action-btn\s*\{[^}]*min-height\s*:\s*36px\s*!important/.test(stylesNC),
    'styles.css carries no 36px !important defeater for the card action buttons');
});

// --- G6: the receipt-finder 32px link is untouched (out of scope, own item) ---
test('G6 receipt-finder WhatsApp link stays 32px (Transactions view, out of scope)', () => {
  assert.ok(hasProp(ruleBodiesList(stylesNC, '.receipt-finder-actions .receipt-whatsapp-action'), /min-height\s*:\s*32px/),
    'styles.css .receipt-finder-actions .receipt-whatsapp-action is no longer min-height:32px — if it was fixed, that belongs to its own item');
});

// --- G7: the quick-actions row is unchanged ---
test('G7 the profile quick-actions row still holds exactly the four actions, in order', () => {
  assert.deepEqual(PROFILE_QUICK_ACTION_KEYS, ['payment', 'fault', 'message', 'balance']);
  assert.equal(PROFILE_QUICK_ACTIONS.length, 4);
  assert.deepEqual(PROFILE_QUICK_ACTIONS.map((action) => action.buttonId), [
    'pqaPaymentBtn',
    'pqaFaultBtn',
    'pqaMessageBtn',
    'pqaBalanceBtn',
  ]);
});

// --- G8: the shared button rule is untouched ---
test('G8 the shared .secondary-button rule still carries min-height:40px', () => {
  assert.ok(/\.secondary-button,\.primary-button\{[^}]*min-height:40px/.test(stylesNC),
    'styles.css .secondary-button,.primary-button no longer carries min-height:40px');
});

// --- G9: self-guard — this file pins no parity total ---
test('G9 this file carries neither the current nor the previous parity bare digits', () => {
  // The digits are built from split literals so this file itself never
  // contains them (plan591 G5a sweeps the whole tests/ tree for the bare
  // digits of the previous total). This file asserts no parity total.
  const selfSrc = read('tests/plan602-profile-contact-action-links-44px.test.js');
  assert.ok(!selfSrc.includes('51' + '38'), 'this file carries the current parity bare digits');
  assert.ok(!selfSrc.includes('49' + '06'), 'this file carries the previous parity bare digits');
  // The import path is built from split literals too: the assertion string
  // itself must never contain the path it forbids.
  assert.ok(!selfSrc.includes("from '../nav-" + "language.js'"), 'this file must not touch the language dicts');
});
