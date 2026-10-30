// Owner fix (2026-10-30): the "✓ Saved / Customer ledger updated" toast kept
// popping up again and again on the Customers screen during plain browsing,
// with no save in progress. Proven root cause: the ONLY emit site of that
// message was the pull-to-refresh onRefresh callback in app.js — a path that
// persists nothing (it only re-renders). Worse, setupPullToRefresh is wired
// to #customerPane, but the pane itself never scrolls (the inner
// .customer-list scrolls on desktop; the window scrolls on mobile), so the
// handler's `container.scrollTop > 0` guard never tripped and ordinary
// downward drags (scrolling back to the top, overscroll) armed the gesture
// and fired the toast on touch-end. The fix keeps the refresh silent: the
// re-renders stay, the toast call is gone, and the pull indicator text +
// haptic remain the gesture's feedback. Deliberate save actions elsewhere
// keep their own toasts (they call save() first, then toast).
// Synthetic/source pins only — no customer data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const nav = read('nav.js');

test('the false "Customer ledger updated" message is emitted nowhere in the runtime sources', () => {
  const root = new URL('../', import.meta.url);
  const runtimeFiles = readdirSync(root).filter(name => name.endsWith('.js'));
  assert.ok(runtimeFiles.length > 20, 'runtime source scan is non-trivial');
  for (const name of runtimeFiles) {
    assert.ok(!read(name).includes('Customer ledger updated'), `${name} must not emit the ambient refresh toast`);
  }
});

test('pull-to-refresh still re-renders customers + dashboard but shows no toast', () => {
  const start = app.indexOf('setupPullToRefresh({');
  assert.ok(start >= 0, 'pull-to-refresh is still wired in app.js');
  const block = app.slice(start, app.indexOf('});', start));
  assert.ok(block.includes('renderCustomers()'), 'refresh still re-renders the customer list');
  assert.ok(block.includes('renderDashboard()'), 'refresh still re-renders the dashboard');
  assert.ok(!block.includes('toast('), 'refresh must stay silent — it saves nothing');
});

test('the pull gesture keeps its own feedback (indicator text + threshold haptic)', () => {
  assert.ok(nav.includes('Updating ledger...'), 'indicator still shows progress text during refresh');
  assert.ok(nav.includes("triggerHaptic('success')"), 'threshold haptic feedback retained');
});

test('deliberate save actions keep their confirmation toasts (save first, then toast)', () => {
  assert.ok(app.includes('function toast('), 'the app toast helper itself is untouched');
  // Representative deliberate saves: the toast fires only after save().
  assert.ok(/save\(\);\s*renderDetail\(\);\s*toast\(`Late fee of PKR/.test(app), 'late-fee apply still confirms after saving');
  assert.ok(/save\(\);\s*renderDetail\(\);\s*toast\(`Late fee waived/.test(app), 'late-fee waive still confirms after saving');
});
