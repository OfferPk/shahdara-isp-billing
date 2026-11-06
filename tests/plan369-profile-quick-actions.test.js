import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROFILE_QUICK_ACTIONS,
  PROFILE_QUICK_ACTION_KEYS,
  isProfileQuickActionKey,
  profileQuickActionTarget,
  profileQuickActionsRowHtml,
} from '../profile-quick-actions.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'profile-quick-actions.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan369-profile-quick-actions.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const stripSrc = readFileSync(join(dir, '..', 'profile-header-strip.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
const LABELS = {
  heading: 'Quick actions',
  payment: 'Record payment',
  fault: 'New fault note',
  message: 'Message draft',
  balance: 'Balance view',
};

test('Plan 369: the row holds exactly the four everyday actions, in order', () => {
  assert.deepEqual(PROFILE_QUICK_ACTION_KEYS, ['payment', 'fault', 'message', 'balance']);
  assert.equal(PROFILE_QUICK_ACTIONS.length, 4);
  assert.deepEqual(PROFILE_QUICK_ACTIONS.map(action => action.buttonId), [
    'pqaPaymentBtn',
    'pqaFaultBtn',
    'pqaMessageBtn',
    'pqaBalanceBtn',
  ]);
  assert.deepEqual(PROFILE_QUICK_ACTIONS.map(action => action.labelKey), [
    'prof_quick_action_payment',
    'prof_quick_action_fault',
    'prof_quick_action_message',
    'prof_quick_action_balance',
  ]);
  const buttonIds = new Set(PROFILE_QUICK_ACTIONS.map(action => action.buttonId));
  assert.equal(buttonIds.size, 4);
});

test('Plan 369: key check accepts only the four action keys', () => {
  for (const key of PROFILE_QUICK_ACTION_KEYS) assert.equal(isProfileQuickActionKey(key), true);
  assert.equal(isProfileQuickActionKey('edit'), false);
  assert.equal(isProfileQuickActionKey('print'), false);
  assert.equal(isProfileQuickActionKey(''), false);
  assert.equal(isProfileQuickActionKey(null), false);
  assert.equal(isProfileQuickActionKey(42), false);
});

test('Plan 369: every action maps to a real opener — no tap opens nothing', () => {
  assert.deepEqual(profileQuickActionTarget('payment'), { kind: 'quick-collect', selector: null });
  assert.deepEqual(profileQuickActionTarget('fault'), { kind: 'complaint-register', selector: null });
  assert.deepEqual(profileQuickActionTarget('message'), { kind: 'balance-reply', selector: '#balanceReplyShowBtn' });
  assert.deepEqual(profileQuickActionTarget('balance'), { kind: 'header-strip', selector: '#phsStrip' });
  for (const key of PROFILE_QUICK_ACTION_KEYS) {
    const target = profileQuickActionTarget(key);
    assert.ok(target !== null, `${key} has no target`);
    assert.ok(typeof target.kind === 'string' && target.kind.length > 0);
  }
  assert.equal(profileQuickActionTarget('edit'), null);
  assert.equal(profileQuickActionTarget(''), null);
  assert.equal(profileQuickActionTarget(null), null);
});

test('Plan 369: row carries the four buttons with the customer already selected', () => {
  const html = profileQuickActionsRowHtml('CUST-1', LABELS);
  assert.ok(html.includes('id="pqaRow"'));
  assert.ok(html.includes('role="group"'));
  assert.ok(html.includes('data-customer-id="CUST-1"'));
  assert.ok(html.includes('id="pqaPaymentBtn"'));
  assert.ok(html.includes('id="pqaFaultBtn"'));
  assert.ok(html.includes('id="pqaMessageBtn"'));
  assert.ok(html.includes('id="pqaBalanceBtn"'));
  assert.ok(html.includes('data-quick-action="payment"'));
  assert.ok(html.includes('data-quick-action="fault"'));
  assert.ok(html.includes('data-quick-action="message"'));
  assert.ok(html.includes('data-quick-action="balance"'));
  assert.ok(html.includes('Record payment'));
  assert.ok(html.includes('New fault note'));
  assert.ok(html.includes('Message draft'));
  assert.ok(html.includes('Balance view'));
  const paymentAt = html.indexOf('pqaPaymentBtn');
  const faultAt = html.indexOf('pqaFaultBtn');
  const messageAt = html.indexOf('pqaMessageBtn');
  const balanceAt = html.indexOf('pqaBalanceBtn');
  assert.ok(paymentAt < faultAt && faultAt < messageAt && messageAt < balanceAt);
});

test('Plan 369: row honours caller labels and falls back to plain defaults', () => {
  const html = profileQuickActionsRowHtml('CUST-1', {
    heading: 'Fast actions',
    payment: 'Take payment',
    fault: 'Log a fault',
    message: 'Write a message',
    balance: 'See balance',
  });
  assert.ok(html.includes('aria-label="Fast actions"'));
  assert.ok(html.includes('Take payment'));
  assert.ok(html.includes('Log a fault'));
  assert.ok(html.includes('Write a message'));
  assert.ok(html.includes('See balance'));
  const defaults = profileQuickActionsRowHtml('CUST-1', {});
  assert.ok(defaults.includes('aria-label="Quick actions"'));
  assert.ok(defaults.includes('Record payment'));
  assert.ok(defaults.includes('New fault note'));
  assert.ok(defaults.includes('Message draft'));
  assert.ok(defaults.includes('Balance view'));
});

test('Plan 369: row escapes labels and the customer id', () => {
  const html = profileQuickActionsRowHtml('CUST-<1>', { payment: '<b>Pay</b> & go' });
  assert.ok(!html.includes('<b>Pay</b>'));
  assert.ok(html.includes('&lt;b&gt;Pay&lt;/b&gt; &amp; go'));
  assert.ok(!html.includes('CUST-<1>'));
  assert.ok(html.includes('CUST-&lt;1&gt;'));
});

test('Plan 369: no customer id means no row — a row that opens nothing is a defect', () => {
  assert.equal(profileQuickActionsRowHtml('', LABELS), '');
  assert.equal(profileQuickActionsRowHtml('   ', LABELS), '');
  assert.equal(profileQuickActionsRowHtml(null, LABELS), '');
  assert.equal(profileQuickActionsRowHtml(undefined, LABELS), '');
  assert.equal(profileQuickActionsRowHtml(42, LABELS), '');
});

test('Plan 369: module is pure — no page, storage, clock, network, or import', () => {
  assert.ok(!moduleSrc.includes('document.'));
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!/new Date\(/.test(moduleSrc));
  assert.ok(!/Date\.now\(/.test(moduleSrc));
  assert.ok(!moduleSrc.includes('fetch('));
  assert.ok(!moduleSrc.includes('window.'));
  assert.ok(!moduleSrc.includes('import '));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
});

test('Plan 369: module and tests never name the fenced neighbour literally', () => {
  // The mobile quick sheet is a different surface (a one-tap sheet on
  // the phone), not the profile row — checked by filename only.
  const fenced = [
    ['nav', 'quick', 'profile'].join('-') + '.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module names fenced file ${name}`);
    assert.ok(!testSrc.includes(name), `tests name fenced file ${name}`);
  }
});

test('Plan 369: wiring — import, row after the emergency contact, bindings', () => {
  assert.ok(appSrc.includes("from './profile-quick-actions.js'"));
  assert.ok(appSrc.includes('profileQuickActionsRowHtml'));
  assert.ok(appSrc.includes('profileQuickActionTarget'));
  assert.ok(appSrc.includes('profileQuickActionsRowMarkup'));
  // Order, not adjacency: the row sits between the emergency contact
  // section and the header strip, so the Plan 351 banner → strip →
  // groups order still holds.
  const emergencyAt = appSrc.indexOf('${customerEmergencyContactSectionMarkup}');
  const rowAt = appSrc.indexOf('${profileQuickActionsRowMarkup}');
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  assert.ok(emergencyAt !== -1 && rowAt !== -1 && stripAt !== -1);
  assert.ok(
    emergencyAt < rowAt && rowAt < stripAt,
    'quick actions row sits at the top of the profile, after the emergency contact and before the header strip',
  );
  assert.ok(appSrc.includes('pqaRow'));
  assert.ok(appSrc.includes('PROFILE_QUICK_ACTIONS'));
  assert.ok(appSrc.includes('profileQuickActionTarget'));
  // Each tap reuses its existing opener with this customer: the row's
  // own target map decides, and a missing opener shows a toast.
  assert.ok(appSrc.includes('quickCollectModalController'));
  assert.ok(appSrc.includes('complaintRegisterModalController.open({ customer: String(customer.id) })'));
  assert.ok(appSrc.includes('target.selector'));
  assert.ok(appSrc.includes("scrollIntoView({ block: 'center' })"));
});

test('Plan 369: the message and balance targets exist on the profile', () => {
  assert.ok(appSrc.includes('id="balanceReplyShowBtn"'));
  assert.ok(appSrc.includes('id="balanceReplySendBtn"'));
  assert.ok(stripSrc.includes('id="phsStrip"'));
  assert.ok(stripSrc.includes('class="profile-header-strip"'));
});

test('Plan 369: quick action keys exist in both language tables', () => {
  assert.ok(langSrc.includes('prof_quick_action_heading'));
  assert.ok(langSrc.includes('prof_quick_action_payment'));
  assert.ok(langSrc.includes('prof_quick_action_fault'));
  assert.ok(langSrc.includes('prof_quick_action_message'));
  assert.ok(langSrc.includes('prof_quick_action_balance'));
});

test('Plan 369: styles reuse existing colours only — no new hex in quick action rules', () => {
  assert.ok(stylesSrc.includes('.profile-quick-actions'));
  assert.ok(stylesSrc.includes('.pqa-btn'));
  const rules = stylesSrc.match(/\.pqa-[^{]+\{[^}]*\}|\.profile-quick-actions[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0);
  const baseline = stylesSrc.replace(/\.pqa-[^{]+\{[^}]*\}|\.profile-quick-actions[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map(hex => hex.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
