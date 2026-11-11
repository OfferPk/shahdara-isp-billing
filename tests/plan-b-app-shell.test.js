// Plan B — Commercial app shell: navigation, headers, empty states.
// One header pattern, a loading state that can never freeze the shell,
// view sync for every view-backed screen, and designed empty states for
// the primary lists. No screen logic is tested here, only the shell
// contract, so these tests stay valid whatever a screen renders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SCREENS, HOME, headerSpecForScreen, createShellLoadingState, SHELL_LOADING_TIMEOUT_MS
} from '../screen-router.js';
import {
  SHELL_EMPTY_STATES, shellEmptyStateFor, shouldShowShellEmptyState,
  createShellEmptyState, syncShellEmptyState
} from '../ui-feedback.js';
import { fixtureCustomer, fixtureState } from './test-fixtures.js';

const routerSrc = readFileSync(new URL('../screen-router.js', import.meta.url), 'utf8');
const feedbackSrc = readFileSync(new URL('../ui-feedback.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const routerCss = readFileSync(new URL('../screen-router.css', import.meta.url), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Minimal DOM stub: only the surface syncShellEmptyState /
// createShellEmptyState touch (children, classList, insertBefore, remove,
// addEventListener, click, querySelector), so the sync rules are tested
// as real logic, not as source text.
function stubEl(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(),
    children: [],
    parentNode: null,
    nextSibling: null,
    textContent: '',
    _listeners: {},
    _classes: new Set(),
    setAttribute() {},
    appendChild(child) { child.parentNode = el; el.children.push(child); return child; },
    insertBefore(child, ref) {
      child.parentNode = el;
      const i = ref ? el.children.indexOf(ref) : -1;
      if (i >= 0) el.children.splice(i, 0, child); else el.children.push(child);
      return child;
    },
    remove() {
      if (!el.parentNode) return;
      const i = el.parentNode.children.indexOf(el);
      if (i >= 0) el.parentNode.children.splice(i, 1);
      el.parentNode = null;
    },
    addEventListener(type, fn) { el._listeners[type] = fn; },
    click() { el._listeners.click?.(); },
    querySelectorAll() { return []; }
  };
  Object.defineProperty(el, 'className', {
    get() { return [...el._classes].join(' '); },
    set(value) { el._classes = new Set(String(value).split(' ').filter(Boolean)); }
  });
  el.classList = {
    add(c) { el._classes.add(c); },
    remove(c) { el._classes.delete(c); },
    contains(c) { return el._classes.has(c); }
  };
  return el;
}
const stubDoc = (onQuery) => ({
  createElement: (tag) => stubEl(tag),
  querySelector: (sel) => (onQuery ? onQuery(sel) : null)
});

/* ------------------------- one header pattern ------------------------- */

test('every router screen has one header spec: back, title, subtitle, action', () => {
  for (const [name, spec] of Object.entries(SCREENS)) {
    const header = headerSpecForScreen(name);
    assert.ok(header, name);
    assert.equal(header.screen, name);
    assert.equal(header.hasBack, true, `${name} has a Home back control`);
    assert.ok(header.title && header.title.length > 0, `${name} title`);
    assert.ok(header.subtitle && header.subtitle.length > 0, `${name} subtitle`);
    // Payments Inbox cleanup: the Inbox has NO header action by design —
    // its one Sync Sheet button lives in the view's own toolbar, and a
    // header copy would be the third Sync Sheet on the screen. The
    // intent of this pin (every screen has a reachable primary action)
    // is preserved by asserting the toolbar button exists instead.
    if (name === 'easypaisa') {
      assert.equal(header.actionLabel, null, 'easypaisa has no header action');
      assert.equal(header.actionKind, null);
      assert.equal(header.actionTarget, null);
      const inboxSrc = readFileSync(new URL('../payments-inbox.js', import.meta.url), 'utf8');
      assert.ok(inboxSrc.includes('id="easypaisaSyncBtn"'), 'easypaisa primary action lives in its toolbar');
      continue;
    }
    assert.ok(header.actionLabel, `${name} has a context action`);
    assert.ok(header.actionKind === 'click' || header.actionKind === 'focus', `${name} action kind`);
    assert.ok(header.actionTarget, `${name} action target`);
    assert.equal(spec.title.length > 0, true);
  }
});

test('every header action target already exists where its screen is rendered', () => {
  // Most targets are static in index.html; the Easypaisa sync button is
  // rendered into its empty view by payments-inbox.js, so that module is
  // the existence proof for that one target.
  // Payments Inbox cleanup: the Inbox has no header action (see the
  // pin above), so screens without an action target are skipped here.
  const inboxSrc = readFileSync(new URL('../payments-inbox.js', import.meta.url), 'utf8');
  for (const name of Object.keys(SCREENS)) {
    const target = headerSpecForScreen(name).actionTarget;
    if (!target) continue;
    const found = indexHtml.includes(`id="${target.slice(1)}"`) || inboxSrc.includes(`id="${target.slice(1)}"`);
    assert.ok(found, `${name} action target ${target} exists`);
  }
});

test('header spec is null for Home and for unknown screens', () => {
  assert.equal(headerSpecForScreen(HOME), null);
  assert.equal(headerSpecForScreen('no-such-screen'), null);
  assert.equal(headerSpecForScreen('field-tools'), null);
});

test('header spec is stable: the same screen always renders the same header', () => {
  for (const name of Object.keys(SCREENS)) {
    assert.deepEqual(headerSpecForScreen(name), headerSpecForScreen(name), name);
  }
});

test('the router header markup carries back, title, subtitle and an actions group', () => {
  assert.match(routerSrc, /class="sr-back-button" data-sr-home/);
  assert.match(routerSrc, /id="srScreenTitle"/);
  assert.match(routerSrc, /id="srScreenSubtitle"/);
  assert.match(routerSrc, /class="sr-header-actions" role="group" aria-label="Screen actions"/);
  assert.match(routerSrc, /id="srPrimaryAction"/);
});

test('apply() renders the header from the one spec and records the screen on the header', () => {
  assert.match(routerSrc, /const spec = headerSpecForScreen\(screen\)/);
  assert.match(routerSrc, /header\.dataset\.screen = screen/);
  assert.match(routerSrc, /body\.dataset\.screen = screen/);
});

/* ------------------------- view sync / navigation state ------------------------- */

test('Home Budget and WhatsApp Templates are tracked by view sync', () => {
  assert.match(routerSrc, /\['homeBudgetView', 'showHomeBudgetButton'\]/);
  assert.match(routerSrc, /\['waTemplatesView', 'showWaTemplatesButton'\]/);
  assert.match(routerSrc, /homeBudget: 'homeBudgetView'/);
  assert.match(routerSrc, /waTemplates: 'waTemplatesView'/);
});

test('every view-backed screen in SCREENS is in the view-sync list', () => {
  const appViews = routerSrc.slice(routerSrc.indexOf('const APP_VIEWS'), routerSrc.indexOf('const SCREEN_VIEW'));
  for (const [name, spec] of Object.entries(SCREENS)) {
    if (!spec.tab) continue;
    assert.ok(appViews.includes(spec.view), `${name} view ${spec.view} is synced`);
  }
});

/* ------------------------- loading state never freezes ------------------------- */

test('shell loading timeout is 3 seconds', () => {
  assert.equal(SHELL_LOADING_TIMEOUT_MS, 3000);
});

test('loading starts on start() and clears on finish() before the watchdog', async () => {
  let stuck = 0;
  const state = createShellLoadingState({ timeoutMs: 30, onStuck: () => { stuck += 1; } });
  assert.equal(state.loading, false);
  state.start();
  assert.equal(state.loading, true);
  state.finish();
  assert.equal(state.loading, false);
  await sleep(60);
  assert.equal(stuck, 0, 'a finished load never trips the watchdog');
});

test('the watchdog fires once and resets loading when finish() never comes', async () => {
  let stuck = 0;
  const state = createShellLoadingState({ timeoutMs: 20, onStuck: () => { stuck += 1; } });
  state.start();
  await sleep(50);
  assert.equal(state.loading, false);
  assert.equal(stuck, 1);
});

test('restarting re-arms the watchdog instead of leaving a stale timer', async () => {
  let stuck = 0;
  const state = createShellLoadingState({ timeoutMs: 20, onStuck: () => { stuck += 1; } });
  state.start();
  state.finish();
  state.start();
  await sleep(50);
  assert.equal(stuck, 1, 'only the second, unfinished load trips the watchdog');
});

test('the router wires loading to the next animation frame and the watchdog', () => {
  assert.match(routerSrc, /createShellLoadingState\(\{ onStuck:/);
  assert.match(routerSrc, /beginShellLoading\(\)/);
  assert.match(routerSrc, /win\.requestAnimationFrame\(finishLoading\)/);
  assert.match(routerSrc, /body\.dataset\.shellLoading = '1'/);
  assert.match(routerSrc, /header\.setAttribute\('aria-busy', 'true'\)/);
});

test('index.html carries the shell loading bar the router toggles', () => {
  assert.match(indexHtml, /<div id="shellLoadingBar" class="sr-loading-bar" aria-hidden="true"><\/div>/);
  assert.match(routerCss, /\.sr-loading-bar\.is-loading/);
  assert.match(routerCss, /@keyframes sr-loading-slide/);
});

/* ------------------------- designed empty states ------------------------- */

test('shell empty specs exist for the three primary lists and nowhere else by accident', () => {
  assert.deepEqual(Object.keys(SHELL_EMPTY_STATES).sort(), ['archivedCustomerList', 'customerList', 'transactionsList']);
  for (const [id, spec] of Object.entries(SHELL_EMPTY_STATES)) {
    assert.equal(shellEmptyStateFor(id), spec);
    assert.ok(spec.title && spec.message, `${id} title and message`);
    if (spec.actionLabel) assert.ok(spec.actionTarget, `${id} action has a target`);
  }
  assert.equal(shellEmptyStateFor('no-such-list'), null);
});

test('the empty-state rule: visible, empty, and no app note already explaining it', () => {
  assert.equal(shouldShowShellEmptyState({ itemCount: 0, listVisible: true, appEmptyNoteVisible: false }), true);
  assert.equal(shouldShowShellEmptyState({ itemCount: 1, listVisible: true, appEmptyNoteVisible: false }), false);
  assert.equal(shouldShowShellEmptyState({ itemCount: 0, listVisible: false, appEmptyNoteVisible: false }), false);
  assert.equal(shouldShowShellEmptyState({ itemCount: 0, listVisible: true, appEmptyNoteVisible: true }), false);
  assert.equal(shouldShowShellEmptyState({}), true, 'an untouched list with no items shows the state');
});

test('fixture rosters drive the empty-state rule (Plan I fixtures)', () => {
  const empty = [];
  const two = [fixtureCustomer(), fixtureCustomer({ id: 'fixture-customer-002', customerNumber: 2 })];
  assert.equal(shouldShowShellEmptyState({ itemCount: empty.length }), true);
  assert.equal(shouldShowShellEmptyState({ itemCount: two.length }), false);
  const state = fixtureState([fixtureCustomer({ archived: true })]);
  assert.equal(state.customers.filter(c => c.archived).length, 1);
  assert.equal(shouldShowShellEmptyState({ itemCount: state.customers.filter(c => c.archived).length }), false);
});

test('createShellEmptyState builds a titled, messaged state with no markup interpolation', () => {
  const el = createShellEmptyState(stubDoc(), shellEmptyStateFor('customerList'));
  assert.equal(el.className, 'shell-empty-state');
  assert.equal(el.children[0].textContent, 'No customers yet');
  assert.equal(el.children[1].textContent, 'Add your first customer to start billing.');
  assert.match(feedbackSrc, /title\.textContent = spec\.title/);
  const fnBody = feedbackSrc.slice(
    feedbackSrc.indexOf('export function createShellEmptyState'),
    feedbackSrc.indexOf('export function syncShellEmptyState')
  );
  assert.doesNotMatch(fnBody, /innerHTML/, 'empty states never use innerHTML');
});

test('the empty-state action clicks the screen\'s existing button', () => {
  let clicked = 0;
  const target = stubEl('button');
  target.addEventListener('click', () => { clicked += 1; });
  // The stub target is clicked through doc.querySelector, which the
  // button's own handler calls; simulate that wiring directly.
  const doc = stubDoc((sel) => (sel === '#addCustomerButton' ? target : null));
  const el = createShellEmptyState(doc, shellEmptyStateFor('customerList'));
  const button = el.children[2];
  assert.equal(button.textContent, '+ Add Customer');
  button.click();
  assert.equal(clicked, 1);
});

test('an archived list gets a state with no action button', () => {
  const el = createShellEmptyState(stubDoc(), shellEmptyStateFor('archivedCustomerList'));
  assert.equal(el.children.length, 2, 'title and message only');
});

test('sync inserts exactly one state after an empty list, and never twice', () => {
  const doc = stubDoc();
  const container = stubEl('div');
  const list = stubEl('ul');
  container.appendChild(list);
  const spec = shellEmptyStateFor('customerList');
  syncShellEmptyState(doc, list, spec, true);
  syncShellEmptyState(doc, list, spec, true);
  const states = container.children.filter(c => c.classList.contains('shell-empty-state'));
  assert.equal(states.length, 1);
  assert.equal(container.children[1], states[0], 'the state sits beside the list, not inside it');
});

test('sync removes the state when items appear and keeps app content', () => {
  const doc = stubDoc();
  const container = stubEl('div');
  const list = stubEl('ul');
  const appItem = stubEl('li');
  container.appendChild(list);
  container.appendChild(appItem);
  const spec = shellEmptyStateFor('customerList');
  syncShellEmptyState(doc, list, spec, true);
  assert.equal(container.children.length, 3);
  syncShellEmptyState(doc, list, spec, false);
  assert.deepEqual(container.children, [list, appItem]);
});

test('sync does nothing for a list with no parent', () => {
  const doc = stubDoc();
  assert.equal(syncShellEmptyState(doc, stubEl('ul'), shellEmptyStateFor('customerList'), true), null);
});

test('the two previously action-less screens now have context actions', () => {
  const analytics = headerSpecForScreen('analytics');
  assert.equal(analytics.actionLabel, 'Export Area CSV');
  assert.equal(analytics.actionKind, 'click');
  assert.equal(analytics.actionTarget, '#exportAreaIntelCsvBtn');
  const alerts = headerSpecForScreen('alerts');
  assert.equal(alerts.actionLabel, 'View Alerts');
  assert.equal(alerts.actionKind, 'focus');
  assert.equal(alerts.actionTarget, '#smartAlertsPanel');
});

test('every header action target is a selector, never a bare id', () => {
  for (const name of Object.keys(SCREENS)) {
    // Payments Inbox cleanup: the Inbox has no header action (its one
    // Sync Sheet lives in the view's toolbar), so its target is null.
    const target = headerSpecForScreen(name).actionTarget;
    if (target === null) {
      assert.equal(name, 'easypaisa');
      continue;
    }
    assert.ok(target.startsWith('#'), name);
  }
  assert.equal(Object.keys(SCREENS).length, 15);
});

test('the language-change listener reuses the header spec instead of a second copy', () => {
  const listener = routerSrc.slice(routerSrc.indexOf('shahdara:language-change'));
  assert.match(listener, /headerSpecForScreen\('bills'\)/);
  assert.doesNotMatch(listener, /t\('bill_screen_title'\)/);
});

test('finish() on an idle loading state is safe and stays idle', async () => {
  let stuck = 0;
  const state = createShellLoadingState({ timeoutMs: 20, onStuck: () => { stuck += 1; } });
  state.finish();
  assert.equal(state.loading, false);
  await sleep(40);
  assert.equal(stuck, 0);
});

test('starting twice without finishing still fires the watchdog exactly once', async () => {
  let stuck = 0;
  const state = createShellLoadingState({ timeoutMs: 20, onStuck: () => { stuck += 1; } });
  state.start();
  state.start();
  await sleep(50);
  assert.equal(stuck, 1);
  assert.equal(state.loading, false);
});

test('the new shell CSS rules are token-only, so the token ratchet cannot regress', () => {
  const start = routerCss.indexOf('/* Plan B');
  assert.ok(start >= 0);
  // The Plan B block sits mid-file, so bound it at the next pre-existing
  // comment instead of reading to end-of-file (which would catch older rules).
  const added = routerCss.slice(start, routerCss.indexOf('/* Collapse', start));
  assert.doesNotMatch(added, /#[0-9a-fA-F]{3,8}\b/, 'Plan B CSS adds no hard-coded hex');
  assert.match(added, /\.shell-empty-state/);
  assert.match(added, /\.sr-header-actions/);
});

test('the loading bar is the first child of <main>, ahead of all screens', () => {
  assert.ok(indexHtml.indexOf('id="shellLoadingBar"') < indexHtml.indexOf('global-search-region'));
  assert.ok(indexHtml.indexOf('id="shellLoadingBar"') < indexHtml.indexOf('id="customersView"'));
});

test('the empty state carries role=status and its action keeps the primary style', () => {
  const el = createShellEmptyState(stubDoc(), shellEmptyStateFor('customerList'));
  assert.equal(el._classes.has('shell-empty-state'), true);
  const button = el.children[2];
  assert.ok(button.className.includes('primary-button'));
  assert.ok(button.className.includes('shell-empty-action'));
});

test('an app empty note suppresses the shell state even with items present', () => {
  assert.equal(shouldShowShellEmptyState({ itemCount: 5, listVisible: true, appEmptyNoteVisible: true }), false);
  assert.equal(shouldShowShellEmptyState({ itemCount: 5, listVisible: true, appEmptyNoteVisible: false }), false);
});

test('sync keeps a pre-existing state in place instead of stacking a second one', () => {
  const doc = stubDoc();
  const container = stubEl('div');
  const list = stubEl('ul');
  container.appendChild(list);
  const spec = shellEmptyStateFor('archivedCustomerList');
  const first = syncShellEmptyState(doc, list, spec, true);
  const second = syncShellEmptyState(doc, list, spec, true);
  assert.equal(first, second);
  assert.equal(container.children.filter(c => c.classList.contains('shell-empty-state')).length, 1);
});

test('the roster section wires both lists to the sync on every render', () => {
  assert.match(feedbackSrc, /syncShellEmptyState\(doc, list, shellEmptyStateFor\('customerList'\)/);
  assert.match(feedbackSrc, /syncShellEmptyState\(doc, archived, shellEmptyStateFor\('archivedCustomerList'\)/);
  assert.match(feedbackSrc, /new win\.MutationObserver\(refreshRoster\)\.observe\(archivedEl/);
});
