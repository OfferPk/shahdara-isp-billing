import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPERATOR_MODES,
  operatorModeLabel,
  normalizeOperatorMode,
  OWNER_ONLY_ACTIONS,
  operatorActionLabel,
  canPerformAction,
  COLLECTOR_VISIBLE_VIEWS,
  viewAccess,
  requestModeSwitch,
  applyModeSwitch,
  operatorModeSummaryText,
  operatorModeHtml,
  operatorModeToggleLabel,
} from '../operator-modes.js';

test('plan33: two modes, owner and collector', () => {
  assert.deepEqual(OPERATOR_MODES.map((m) => m.value), ['owner', 'collector']);
  assert.equal(operatorModeLabel('owner'), 'Owner');
  assert.equal(operatorModeLabel('collector'), 'Collector');
  assert.equal(operatorModeLabel('admin'), null);
});

test('plan33: normalize defaults everything unknown to owner', () => {
  assert.equal(normalizeOperatorMode('collector'), 'collector');
  assert.equal(normalizeOperatorMode('owner'), 'owner');
  for (const bad of ['', 'Collector', 'COLLECTOR', null, undefined, 0, {}]) {
    assert.equal(normalizeOperatorMode(bad), 'owner');
  }
});

test('plan33: owner-only catalogue names backup, restore, settings and destructive actions', () => {
  const values = OWNER_ONLY_ACTIONS.map((a) => a.value);
  for (const expected of ['backup-download', 'backup-share', 'backup-restore', 'settings', 'payment-void', 'expense-delete', 'customer-delete', 'customer-archive', 'partner-settlement', 'partner-shares']) {
    assert.ok(values.includes(expected), expected);
  }
  assert.equal(operatorActionLabel('payment-void'), 'Void payment');
  assert.equal(operatorActionLabel('collect-payment'), null);
});

test('plan33: owner may perform every action, including unknown ones', () => {
  for (const action of [...OWNER_ONLY_ACTIONS.map((a) => a.value), 'collect-payment', 'something-new']) {
    assert.equal(canPerformAction('owner', action), true, action);
  }
});

test('plan33: collector is blocked from every owner-only action', () => {
  for (const action of OWNER_ONLY_ACTIONS.map((a) => a.value)) {
    assert.equal(canPerformAction('collector', action), false, action);
  }
});

test('plan33: collector may still collect, look up customers and do field work', () => {
  for (const action of ['collect-payment', 'customer-lookup', 'field-visit', 'receipt-view', 'ticket-create', 'quick-collect']) {
    assert.equal(canPerformAction('collector', action), true, action);
  }
});

test('plan33: collector views are customers and transactions only', () => {
  assert.deepEqual([...COLLECTOR_VISIBLE_VIEWS], ['customers', 'transactions']);
  assert.equal(viewAccess('owner', 'analytics'), 'full');
  assert.equal(viewAccess('owner', 'expenses'), 'full');
  assert.equal(viewAccess('owner', 'unknown-view'), 'full');
  assert.equal(viewAccess('collector', 'customers'), 'full');
  assert.equal(viewAccess('collector', 'transactions'), 'full');
  for (const view of ['reports', 'analytics', 'inventory', 'expenses', 'homeBudget', 'loans', 'waTemplates']) {
    assert.equal(viewAccess('collector', view), 'blocked', view);
  }
  assert.equal(viewAccess('collector', 'unknown-view'), 'blocked');
  assert.equal(viewAccess('collector', ''), 'blocked');
});

test('plan33: switching to collector needs no extra step', () => {
  assert.deepEqual(requestModeSwitch('owner', 'collector'), { from: 'owner', to: 'collector', changed: true, needsOwnerStep: false });
  assert.equal(applyModeSwitch('owner', 'collector'), 'collector');
  assert.equal(applyModeSwitch('owner', 'collector', { ownerConfirmed: false }), 'collector');
});

test('plan33: switching back to owner needs the owner step', () => {
  assert.deepEqual(requestModeSwitch('collector', 'owner'), { from: 'collector', to: 'owner', changed: true, needsOwnerStep: true });
  assert.equal(applyModeSwitch('collector', 'owner'), 'collector');
  assert.equal(applyModeSwitch('collector', 'owner', { ownerConfirmed: false }), 'collector');
  assert.equal(applyModeSwitch('collector', 'owner', { ownerConfirmed: true }), 'owner');
});

test('plan33: same mode or unknown target changes nothing', () => {
  assert.deepEqual(requestModeSwitch('owner', 'owner'), { from: 'owner', to: 'owner', changed: false, needsOwnerStep: false });
  assert.deepEqual(requestModeSwitch('collector', 'collector'), { from: 'collector', to: 'collector', changed: false, needsOwnerStep: false });
  assert.deepEqual(requestModeSwitch('collector', 'admin'), { from: 'collector', to: 'collector', changed: false, needsOwnerStep: false });
  assert.equal(applyModeSwitch('collector', 'admin'), 'collector');
  assert.equal(applyModeSwitch('owner', ''), 'owner');
});

test('plan33: unknown current mode is treated as owner', () => {
  assert.equal(applyModeSwitch(null, 'collector'), 'collector');
  assert.equal(applyModeSwitch('bogus', 'owner'), 'owner');
});

test('plan33: summary texts name the mode and the block', () => {
  assert.match(operatorModeSummaryText('owner'), /Current mode: Owner/);
  assert.match(operatorModeSummaryText('collector'), /Current mode: Collector/);
  assert.match(operatorModeSummaryText('collector'), /blocked/);
  assert.match(operatorModeSummaryText('collector'), /audit log/);
});

test('plan33: panel html shows current mode, both buttons, and disables the current one', () => {
  const ownerHtml = operatorModeHtml('owner');
  assert.match(ownerHtml, /Current mode: <strong>Owner<\/strong>/);
  assert.match(ownerHtml, /data-operator-mode-target="owner"[^>]*disabled/);
  assert.match(ownerHtml, /data-operator-mode-target="collector"(?! [^>]*disabled)/);
  const collectorHtml = operatorModeHtml('collector');
  assert.match(collectorHtml, /Current mode: <strong>Collector<\/strong>/);
  assert.match(collectorHtml, /data-operator-mode-target="collector"[^>]*disabled/);
  assert.match(collectorHtml, /Void payment/);
  assert.match(collectorHtml, /audit log/);
});

test('plan33: panel html never renders a raw mode string as markup', () => {
  const html = operatorModeHtml('<script>alert(1)</script>');
  assert.match(html, /Current mode: <strong>Owner<\/strong>/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('plan33: header toggle label follows the mode', () => {
  assert.equal(operatorModeToggleLabel('owner'), 'Mode: Owner');
  assert.equal(operatorModeToggleLabel('collector'), 'Mode: Collector');
  assert.equal(operatorModeToggleLabel('bogus'), 'Mode: Owner');
});

test('plan33: catalogues are frozen and never mutated by the helpers', () => {
  assert.ok(Object.isFrozen(OPERATOR_MODES));
  assert.ok(Object.isFrozen(OWNER_ONLY_ACTIONS));
  assert.ok(Object.isFrozen(COLLECTOR_VISIBLE_VIEWS));
  const before = OWNER_ONLY_ACTIONS.map((a) => a.value).join(',');
  canPerformAction('collector', 'payment-void');
  viewAccess('collector', 'analytics');
  applyModeSwitch('collector', 'owner');
  assert.equal(OWNER_ONLY_ACTIONS.map((a) => a.value).join(','), before);
});
