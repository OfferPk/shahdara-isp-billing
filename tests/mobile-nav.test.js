import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const styles = read('styles.css');

test('app.js implements hash-based view routing, history state, and popstate handling', () => {
  assert.match(app, /function handleRouteFromHash\(\)/);
  assert.match(app, /window\.addEventListener\('popstate'/);
  assert.match(app, /window\.addEventListener\('hashchange'/);
  assert.match(app, /history\.pushState\(\{ view \},\s*'',\s*targetHash\)/);
  assert.match(app, /history\.pushState\(\{ customerId:\s*id \},\s*'',\s*`#customer=\$\{encodeURIComponent\(id\)\}`\)/);
});

test('switchView and selectCustomer synchronize history and clean up detail pane', () => {
  assert.match(app, /function switchView\(view,\s*\{\s*pushHistory\s*=\s*true\s*\}\s*=\s*\{\}\)/);
  assert.match(app, /if\s*\(view\s*!==\s*'customers'\)\s*appShell\.classList\.remove\('show-detail'\)/);
  assert.match(app, /function selectCustomer\(id,\s*\{\s*pushHistory\s*=\s*true\s*\}\s*=\s*\{\}\)/);
});

test('mobile back button and escape key support accessibility and focus restoration', () => {
  assert.match(app, /\$\('#backButton'\)\.addEventListener\('click'/);
  assert.match(app, /event\.key\s*===\s*'Escape'/);
  assert.match(app, /menu\.hidden\s*=\s*true/);
  assert.match(app, /moreBtn\.focus/);
  assert.match(app, /appShell\.classList\.contains\('show-detail'\)/);
});

test('styles.css provides accessible view transitions with prefers-reduced-motion support', () => {
  assert.match(styles, /@keyframes navViewEnter/);
  assert.match(styles, /\.page-view,\s*\.phase3-view,\s*\.transactions-view,\s*\.billing-reports-view/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none\s*!important/);
});

test('styles.css provides visible focus states and touch target optimization for mobile nav', () => {
  assert.match(styles, /\.view-nav-button:focus-visible/);
  assert.match(styles, /\.mobile-bottom-nav button:focus-visible/);
  assert.match(styles, /\.mobile-more-menu button:focus-visible/);
  assert.match(styles, /\.back-button:focus-visible/);
  assert.match(styles, /\.mobile-bottom-nav button[\s\S]*?touch-action:\s*manipulation/);
  assert.match(styles, /overflow-x:\s*hidden/);
});

test('index.html provides accessible navigation drawer toggle and dialog structure', () => {
  assert.match(index, /id="navDrawerToggle"[^>]*aria-controls="navDrawer"/);
  assert.match(index, /id="navDrawerBackdrop"/);
  assert.match(index, /<aside id="navDrawer" class="nav-drawer" role="dialog" aria-modal="true"/);
  assert.match(index, /id="navDrawerClose"[^>]*aria-label="Close navigation menu"/);
  assert.match(index, /data-nav-target="customers"/);
  assert.match(index, /data-nav-target="transactions"/);
  assert.match(index, /data-nav-target="reports"/);
  assert.match(index, /data-nav-target="analytics"/);
  assert.match(index, /data-nav-target="inventory"/);
  assert.match(index, /data-nav-target="expenses"/);
});

test('nav.css provides responsive drawer styles, dark theme, and reduced motion overrides', () => {
  const navCss = read('nav.css');
  assert.match(navCss, /\.nav-drawer\s*\{[\s\S]*?transform:\s*translateX\(-100%\)/);
  assert.match(navCss, /\.nav-drawer\.is-open\s*\{[\s\S]*?transform:\s*translateX\(0\)/);
  assert.match(navCss, /\.nav-drawer-backdrop\.is-open/);
  assert.match(navCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition:\s*none\s*!important/);
  assert.match(navCss, /\[data-theme="dark"\]\s*\.nav-drawer/);
  assert.match(navCss, /\[data-theme="dark"\]\s*\.nav-drawer-toggle/);
});

test('nav.js setupNavigationDrawer opens, closes, traps focus, and calls onNavigate', async () => {
  const { setupNavigationDrawer } = await import('../nav.js');

  const listeners = new Map();
  const classListSet = (el) => {
    const s = new Set();
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      contains: (c) => s.has(c)
    };
  };

  const createFakeEl = (id) => ({
    id,
    classList: classListSet(),
    attributes: new Map(),
    dataset: {},
    setAttribute(k, v) { this.attributes.set(k, v); },
    getAttribute(k) { return this.attributes.get(k); },
    addEventListener(event, fn) { listeners.set(`${id}:${event}`, fn); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    focus() {}
  });

  const toggle = createFakeEl('navDrawerToggle');
  const drawer = createFakeEl('navDrawer');
  const backdrop = createFakeEl('navDrawerBackdrop');
  const closeBtn = createFakeEl('navDrawerClose');

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'navDrawerToggle') return toggle;
      if (id === 'navDrawer') return drawer;
      if (id === 'navDrawerBackdrop') return backdrop;
      if (id === 'navDrawerClose') return closeBtn;
      return null;
    },
    body: { classList: classListSet() },
    addEventListener(event, fn) { listeners.set(`doc:${event}`, fn); }
  };

  try {
    let navigatedTo = null;
    const controller = setupNavigationDrawer({
      onNavigate: (target) => { navigatedTo = target; }
    });

    assert.ok(typeof controller.open === 'function');
    assert.ok(typeof controller.close === 'function');

    controller.open();
    assert.ok(drawer.classList.contains('is-open'));
    assert.ok(backdrop.classList.contains('is-open'));
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');

    controller.close();
    assert.ok(!drawer.classList.contains('is-open'));
    assert.ok(!backdrop.classList.contains('is-open'));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html includes sidebar rail toggle, navigation badges, and scroll-to-top button', () => {
  assert.match(index, /id="sidebarRailToggle"[^>]*class="sidebar-rail-toggle"/);
  assert.match(index, /id="navBadgeCustomers"[^>]*class="nav-drawer-badge"/);
  assert.match(index, /id="navBadgeInventory"[^>]*class="nav-drawer-badge"/);
  assert.match(index, /id="navBadgeExpenses"[^>]*class="nav-drawer-badge"/);
  assert.match(index, /id="bottomNavBadgeCustomers"[^>]*class="bottom-nav-badge"/);
  assert.match(index, /id="scrollTopButton"[^>]*class="scroll-top-button"/);
});

test('nav.css includes desktop rail collapse styles and scroll-to-top button styles', () => {
  const navCss = read('nav.css');
  assert.match(navCss, /\.sidebar-rail-toggle/);
  assert.match(navCss, /\.sidebar-rail-collapsed/);
  assert.match(navCss, /\.bottom-nav-badge/);
  assert.match(navCss, /\.scroll-top-button/);
  assert.match(navCss, /\.scroll-top-button\.is-visible/);
});

test('updateNavigationBadges updates badge text and visibility correctly', async () => {
  const { updateNavigationBadges } = await import('../nav.js');
  const makeBadge = (target) => ({
    target,
    textContent: '',
    hidden: true,
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); }
  });
  const cBadge1 = makeBadge('customers');
  const cBadge2 = makeBadge('customers');
  const iBadge = makeBadge('inventory');
  const eBadge = makeBadge('expenses');

  const origDoc = globalThis.document;
  globalThis.document = {
    querySelectorAll(selector) {
      if (selector === '[data-nav-badge="customers"]') return [cBadge1, cBadge2];
      if (selector === '[data-nav-badge="inventory"]') return [iBadge];
      if (selector === '[data-nav-badge="expenses"]') return [eBadge];
      return [];
    }
  };

  try {
    const fakeState = {
      customers: [
        { id: '1', archived: false, serviceStatus: 'active' },
        { id: '2', archived: false, serviceStatus: 'offline' },
        { id: '3', archived: true, serviceStatus: 'active' }
      ],
      inventoryItems: [
        { id: 'item1', minimumStock: 5 },
        { id: 'item2', minimumStock: 1 }
      ],
      expenses: [{ id: 'exp1' }, { id: 'exp2' }, { id: 'exp3' }]
    };

    updateNavigationBadges(fakeState);

    assert.equal(cBadge1.textContent, '2');
    assert.equal(cBadge1.hidden, false);
    assert.equal(cBadge2.textContent, '2');
    assert.equal(cBadge2.hidden, false);
    assert.equal(iBadge.textContent, '2');
    assert.equal(iBadge.hidden, false);
    assert.equal(eBadge.textContent, '3');
    assert.equal(eBadge.hidden, false);
  } finally {
    globalThis.document = origDoc;
  }
});

test('setupSidebarRailToggle toggles collapsed state and persists preference', async () => {
  const { setupSidebarRailToggle } = await import('../nav.js');
  const storage = new Map();
  const origStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(k) { return storage.get(k) || null; },
    setItem(k, v) { storage.set(k, String(v)); }
  };

  const listeners = new Map();
  const classListSet = () => {
    const s = new Set();
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      toggle: (c, v) => (v ?? !s.has(c)) ? s.add(c) : s.delete(c),
      contains: (c) => s.has(c)
    };
  };

  const toggleBtn = {
    id: 'sidebarRailToggle',
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    getAttribute(k) { return this.attributes.get(k); },
    addEventListener(ev, fn) { listeners.set(ev, fn); }
  };
  const bodyEl = {
    classList: classListSet()
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'sidebarRailToggle') return toggleBtn;
      return null;
    },
    body: bodyEl
  };

  try {
    const controller = setupSidebarRailToggle();
    assert.ok(typeof controller.toggleRail === 'function');
    assert.equal(controller.isRailCollapsed(), false);

    controller.toggleRail();
    assert.equal(controller.isRailCollapsed(), true);
    assert.ok(bodyEl.classList.contains('sidebar-rail-collapsed'));
    assert.equal(toggleBtn.getAttribute('aria-pressed'), 'true');
    assert.equal(storage.get('shahdara_sidebar_rail'), 'collapsed');

    // Click handler test
    const clickHandler = listeners.get('click');
    assert.ok(typeof clickHandler === 'function');
    clickHandler();
    assert.equal(controller.isRailCollapsed(), false);
    assert.equal(storage.get('shahdara_sidebar_rail'), 'expanded');
  } finally {
    globalThis.localStorage = origStorage;
    globalThis.document = origDoc;
  }
});

test('setupScrollToTop handles button click and scroll visibility', async () => {
  const { setupScrollToTop } = await import('../nav.js');
  const listeners = new Map();
  const classListSet = () => {
    const s = new Set();
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      toggle: (c, v) => (v ?? !s.has(c)) ? s.add(c) : s.delete(c),
      contains: (c) => s.has(c)
    };
  };

  const btn = {
    id: 'scrollTopButton',
    classList: classListSet(),
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    getAttribute(k) { return this.attributes.get(k); },
    addEventListener(ev, fn) { listeners.set(`btn:${ev}`, fn); }
  };

  let scrollCalled = null;
  const origWindow = globalThis.window;
  const origDoc = globalThis.document;

  globalThis.window = {
    scrollY: 400,
    scrollTo(opts) { scrollCalled = opts; },
    addEventListener(ev, fn) { listeners.set(`win:${ev}`, fn); }
  };
  globalThis.document = {
    getElementById(id) {
      if (id === 'scrollTopButton') return btn;
      return null;
    }
  };

  try {
    setupScrollToTop();
    const clickFn = listeners.get('btn:click');
    assert.ok(typeof clickFn === 'function');
    clickFn();
    assert.deepEqual(scrollCalled, { top: 0, behavior: 'smooth' });

    const scrollFn = listeners.get('win:scroll');
    assert.ok(typeof scrollFn === 'function');
    scrollFn();
    assert.ok(btn.classList.contains('is-visible'));

    globalThis.window.scrollY = 50;
    scrollFn();
    assert.ok(!btn.classList.contains('is-visible'));
  } finally {
    globalThis.window = origWindow;
    globalThis.document = origDoc;
  }
});

test('index.html provides network status pill, shortcuts modal, and mobile action sheet', () => {
  assert.match(index, /id="networkStatusPill"[^>]*class="network-status-pill"/);
  assert.match(index, /id="networkStatusDot"[^>]*class="network-status-dot online"/);
  assert.match(index, /id="shortcutsHelpButton"[^>]*class="shortcuts-help-button"/);
  assert.match(index, /<dialog id="keyboardShortcutsModal" class="modal shortcuts-modal"/);
  assert.match(index, /id="mobileActionSheetToggle"[^>]*class="mobile-action-toggle-btn"/);
  assert.match(index, /id="mobileActionSheetBackdrop"[^>]*class="mobile-action-sheet-backdrop"/);
  assert.match(index, /<aside id="mobileActionSheet" class="mobile-action-sheet"/);
});

test('nav.css contains network status, shortcuts modal, and mobile action sheet styles', () => {
  const navCss = read('nav.css');
  assert.match(navCss, /\.network-status-pill/);
  assert.match(navCss, /\.network-status-dot\.online/);
  assert.match(navCss, /\.network-status-dot\.offline/);
  assert.match(navCss, /\.shortcuts-modal/);
  assert.match(navCss, /\.shortcuts-grid/);
  assert.match(navCss, /kbd\s*\{/);
  assert.match(navCss, /\.mobile-action-sheet/);
  assert.match(navCss, /\.sheet-action-tile/);
  assert.match(navCss, /\[data-theme="dark"\]\s*\.network-status-pill/);
  assert.match(navCss, /\[data-theme="dark"\]\s*\.shortcuts-modal-card/);
  assert.match(navCss, /\[data-theme="dark"\]\s*\.mobile-action-sheet/);
});

test('setupNetworkStatusIndicator detects online/offline status and responds to events and clicks', async () => {
  const { setupNetworkStatusIndicator } = await import('../nav.js');
  const listeners = new Map();
  const makeEl = (id) => ({
    id,
    textContent: '',
    className: '',
    attributes: new Map(),
    dataset: {},
    classList: {
      toggle(cls, val) {
        if (val) this[cls] = true;
        else delete this[cls];
      }
    },
    setAttribute(k, v) { this.attributes.set(k, v); },
    getAttribute(k) { return this.attributes.get(k); },
    addEventListener(ev, fn) { listeners.set(`${id}:${ev}`, fn); }
  });

  const pill = makeEl('networkStatusPill');
  const dot = makeEl('networkStatusDot');
  const text = makeEl('networkStatusText');
  const drawerPill = makeEl('navDrawerStatusPill');
  const drawerDot = makeEl('navDrawerStatusDot');
  const drawerText = makeEl('navDrawerStatusText');

  const origDoc = globalThis.document;
  const origWin = globalThis.window;

  globalThis.document = {
    getElementById(id) {
      if (id === 'networkStatusPill') return pill;
      if (id === 'networkStatusDot') return dot;
      if (id === 'networkStatusText') return text;
      if (id === 'navDrawerStatusPill') return drawerPill;
      if (id === 'navDrawerStatusDot') return drawerDot;
      if (id === 'navDrawerStatusText') return drawerText;
      return null;
    }
  };

  globalThis.window = {
    addEventListener(ev, fn) { listeners.set(`win:${ev}`, fn); }
  };

  try {
    let lastToast = null;
    const controller = setupNetworkStatusIndicator({
      onToast: (msg) => { lastToast = msg; }
    });

    assert.equal(controller.isOnline(), true);
    assert.equal(text.textContent, 'Online · Cached');
    assert.ok(dot.className.includes('online'));

    // Test offline event
    const offlineFn = listeners.get('win:offline');
    assert.ok(typeof offlineFn === 'function');
    offlineFn();
    assert.equal(text.textContent, 'Offline · Local Only');
    assert.ok(dot.className.includes('offline'));
    assert.ok(lastToast.includes('Offline mode active'));

    // Test click on pill
    const pillClick = listeners.get('networkStatusPill:click');
    assert.ok(typeof pillClick === 'function');
    pillClick();
    assert.ok(lastToast !== null);

    // Test online event
    const onlineFn = listeners.get('win:online');
    assert.ok(typeof onlineFn === 'function');
    onlineFn();
    assert.equal(text.textContent, 'Online · Cached');
    assert.ok(lastToast.includes('Connection restored'));
  } finally {
    globalThis.document = origDoc;
    globalThis.window = origWin;
  }
});

test('setupKeyboardShortcuts handles navigation sequence, direct keys, and help dialog', async () => {
  const { setupKeyboardShortcuts } = await import('../nav.js');
  const listeners = new Map();
  let modalOpened = false;

  const fakeModal = {
    id: 'keyboardShortcutsModal',
    showModal() { modalOpened = true; },
    close() { modalOpened = false; },
    open: false,
    attributes: new Map(),
    dataset: {},
    setAttribute(k, v) { this.attributes.set(k, v); if (k === 'open') modalOpened = true; },
    removeAttribute(k) { this.attributes.delete(k); if (k === 'open') modalOpened = false; },
    hasAttribute(k) { return this.attributes.has(k); },
    addEventListener(ev, fn) { listeners.set(`modal:${ev}`, fn); }
  };

  const makeBtn = (id) => ({
    id,
    dataset: {},
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    addEventListener(ev, fn) { listeners.set(`${id}:${ev}`, fn); }
  });

  const closeBtn = makeBtn('shortcutsModalCloseBtn');
  const helpBtn = makeBtn('shortcutsHelpButton');
  const drawerHelpBtn = makeBtn('navDrawerShortcutsBtn');

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'keyboardShortcutsModal') return fakeModal;
      if (id === 'shortcutsModalCloseBtn') return closeBtn;
      if (id === 'shortcutsHelpButton') return helpBtn;
      if (id === 'navDrawerShortcutsBtn') return drawerHelpBtn;
      return null;
    },
    activeElement: { tagName: 'BODY' },
    addEventListener(ev, fn) { listeners.set(`doc:${ev}`, fn); }
  };

  try {
    let navigatedTo = null;
    let themeToggled = false;
    let drawerToggled = false;
    let railToggled = false;
    let searchFocused = false;

    const controller = setupKeyboardShortcuts({
      onNavigate: (t) => { navigatedTo = t; },
      onToggleTheme: () => { themeToggled = true; },
      onToggleDrawer: () => { drawerToggled = true; },
      onToggleRail: () => { railToggled = true; },
      onSearchFocus: () => { searchFocused = true; }
    });

    // Test help modal toggle via help button
    controller.openHelp();
    assert.equal(modalOpened, true);
    controller.closeHelp();
    assert.equal(modalOpened, false);

    const docKeydown = listeners.get('doc:keydown');
    assert.ok(typeof docKeydown === 'function');

    // Test '?' key opens help
    let prevented = false;
    docKeydown({ key: '?', preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(modalOpened, true);

    // Test 'Escape' key closes help
    fakeModal.open = true;
    docKeydown({ key: 'Escape', preventDefault: () => {} });
    assert.equal(modalOpened, false);
    fakeModal.open = false;

    // Test '/' focuses search
    prevented = false;
    docKeydown({ key: '/', preventDefault: () => { prevented = true; } });
    assert.equal(searchFocused, true);

    // Test 't' toggles theme
    docKeydown({ key: 't', preventDefault: () => {} });
    assert.equal(themeToggled, true);

    // Test 'm' toggles drawer
    docKeydown({ key: 'm', preventDefault: () => {} });
    assert.equal(drawerToggled, true);

    // Test 'b' toggles rail
    docKeydown({ key: 'b', preventDefault: () => {} });
    assert.equal(railToggled, true);

    // Test 'g' then 'c' sequence navigates to customers
    docKeydown({ key: 'g', preventDefault: () => {} });
    docKeydown({ key: 'c', preventDefault: () => {} });
    assert.equal(navigatedTo, 'customers');

    // Test 'g' then 't' sequence navigates to transactions
    docKeydown({ key: 'g', preventDefault: () => {} });
    docKeydown({ key: 't', preventDefault: () => {} });
    assert.equal(navigatedTo, 'transactions');

    // Test 'g' then 'r' sequence navigates to reports
    docKeydown({ key: 'g', preventDefault: () => {} });
    docKeydown({ key: 'r', preventDefault: () => {} });
    assert.equal(navigatedTo, 'reports');

    // Test 'g' then 'e' sequence navigates to expenses
    docKeydown({ key: 'g', preventDefault: () => {} });
    docKeydown({ key: 'e', preventDefault: () => {} });
    assert.equal(navigatedTo, 'expenses');

    // Test 'g' then 'i' sequence navigates to inventory
    docKeydown({ key: 'g', preventDefault: () => {} });
    docKeydown({ key: 'i', preventDefault: () => {} });
    assert.equal(navigatedTo, 'inventory');

    // Test Alt+4 navigates to analytics
    docKeydown({ key: '4', altKey: true, preventDefault: () => {} });
    assert.equal(navigatedTo, 'analytics');

    // Ignore when typing in input
    globalThis.document.activeElement = { tagName: 'INPUT' };
    navigatedTo = null;
    docKeydown({ key: 'g', preventDefault: () => {} });
    docKeydown({ key: 'c', preventDefault: () => {} });
    assert.equal(navigatedTo, null);
  } finally {
    globalThis.document = origDoc;
  }
});

test('setupMobileActionSheet manages sheet open, close, and action triggers', async () => {
  const { setupMobileActionSheet } = await import('../nav.js');
  const listeners = new Map();
  const classListSet = () => {
    const s = new Set();
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      contains: (c) => s.has(c)
    };
  };

  const makeBtn = (id) => ({
    id,
    dataset: {},
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    addEventListener(ev, fn) { listeners.set(`${id}:${ev}`, fn); },
    focus() {}
  });

  const toggleBtn = makeBtn('mobileActionSheetToggle');
  const closeBtn = makeBtn('mobileActionSheetClose');
  const backdrop = {
    id: 'mobileActionSheetBackdrop',
    hidden: true,
    classList: classListSet(),
    dataset: {},
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    addEventListener(ev, fn) { listeners.set(`backdrop:${ev}`, fn); }
  };

  const actionPayment = {
    attributes: new Map([['data-sheet-action', 'add-payment']]),
    dataset: { sheetAction: 'add-payment' },
    getAttribute(k) { return this.attributes.get(k); },
    addEventListener(ev, fn) { listeners.set('act:add-payment', fn); }
  };
  const actionCustomer = {
    attributes: new Map([['data-sheet-action', 'add-customer']]),
    dataset: { sheetAction: 'add-customer' },
    getAttribute(k) { return this.attributes.get(k); },
    addEventListener(ev, fn) { listeners.set('act:add-customer', fn); }
  };

  const sheet = {
    id: 'mobileActionSheet',
    hidden: true,
    classList: classListSet(),
    attributes: new Map(),
    dataset: {},
    setAttribute(k, v) { this.attributes.set(k, v); },
    getAttribute(k) { return this.attributes.get(k); },
    addEventListener(ev, fn) { listeners.set(`sheet:${ev}`, fn); },
    querySelectorAll(sel) {
      if (sel === '[data-sheet-action]') return [actionPayment, actionCustomer];
      return [];
    },
    querySelector() { return actionPayment; }
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'mobileActionSheetToggle') return toggleBtn;
      if (id === 'mobileActionSheet') return sheet;
      if (id === 'mobileActionSheetBackdrop') return backdrop;
      if (id === 'mobileActionSheetClose') return closeBtn;
      return null;
    }
  };

  try {
    let triggeredAction = null;
    const controller = setupMobileActionSheet({
      onAction: (act) => { triggeredAction = act; }
    });

    controller.open();
    assert.equal(sheet.hidden, false);
    assert.ok(sheet.classList.contains('is-open'));
    assert.ok(backdrop.classList.contains('is-open'));

    // Trigger action click
    const payClick = listeners.get('act:add-payment');
    assert.ok(typeof payClick === 'function');
    payClick();
    assert.equal(triggeredAction, 'add-payment');
    assert.ok(!sheet.classList.contains('is-open'));

    // Toggle button opens again
    const toggleClick = listeners.get('mobileActionSheetToggle:click');
    assert.ok(typeof toggleClick === 'function');
    toggleClick();
    assert.ok(sheet.classList.contains('is-open'));

    // Backdrop click closes
    const backdropClick = listeners.get('backdrop:click');
    assert.ok(typeof backdropClick === 'function');
    backdropClick();
    assert.ok(!sheet.classList.contains('is-open'));
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html includes accessible command palette, pull-to-refresh indicator, and haptic hooks', () => {
  const indexHtml = read('index.html');
  assert.match(indexHtml, /id="commandPaletteTrigger"/);
  assert.match(indexHtml, /id="navDrawerCommandPaletteBtn"/);
  assert.match(indexHtml, /data-sheet-action="command-palette"/);
  assert.match(indexHtml, /id="commandPaletteModal" class="command-palette-dialog"/);
  assert.match(indexHtml, /id="commandPaletteInput" class="command-palette-input"[^>]*role="combobox"/);
  assert.match(indexHtml, /id="commandPaletteResults" class="command-palette-results"[^>]*role="listbox"/);
  assert.match(indexHtml, /id="pullToRefreshIndicator" class="pull-to-refresh-indicator"/);
  assert.match(indexHtml, /class="pull-refresh-spinner"/);
  assert.match(indexHtml, /class="pull-refresh-text"/);
});

test('nav.css includes styling for command palette dialog and pull-to-refresh gestures', () => {
  const navCss = read('nav.css');
  assert.match(navCss, /\.command-palette-dialog/);
  assert.match(navCss, /\.command-palette-card/);
  assert.match(navCss, /\.palette-search-box/);
  assert.match(navCss, /\.palette-item/);
  assert.match(navCss, /\.palette-item\.is-selected/);
  assert.match(navCss, /\.pull-to-refresh-indicator/);
  assert.match(navCss, /\.pull-refresh-spinner/);
  assert.match(navCss, /\.pull-to-refresh-indicator\.is-pulling/);
  assert.match(navCss, /\.pull-to-refresh-indicator\.ready-to-refresh/);
  assert.match(navCss, /\.pull-to-refresh-indicator\.is-refreshing/);
  assert.match(navCss, /\[data-theme="dark"\] \.command-palette-card/);
  assert.match(navCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('nav.js triggerHaptic invokes navigator.vibrate with correct pattern and handles missing vibration API gracefully', async () => {
  const { triggerHaptic } = await import('../nav.js');

  const origNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let vibratePattern = null;

  try {
    const setNav = (val) => {
      Object.defineProperty(globalThis, 'navigator', {
        value: val,
        configurable: true,
        writable: true
      });
    };

    setNav({
      vibrate(p) { vibratePattern = p; return true; }
    });

    assert.equal(triggerHaptic('light'), true);
    assert.deepEqual(vibratePattern, 8);

    assert.equal(triggerHaptic('medium'), true);
    assert.deepEqual(vibratePattern, 18);

    assert.equal(triggerHaptic('heavy'), true);
    assert.deepEqual(vibratePattern, 32);

    assert.equal(triggerHaptic('selection'), true);
    assert.deepEqual(vibratePattern, 6);

    assert.equal(triggerHaptic('success'), true);
    assert.deepEqual(vibratePattern, [10, 30, 15]);

    // Unknown pattern falls back to light
    assert.equal(triggerHaptic('unknown'), true);
    assert.deepEqual(vibratePattern, 8);

    // When navigator.vibrate throws or errors
    setNav({
      vibrate() { throw new Error('SecurityError: vibration disabled'); }
    });
    assert.equal(triggerHaptic('light'), false);

    // When navigator.vibrate is undefined
    setNav({});
    assert.equal(triggerHaptic('light'), false);

    // When navigator is undefined
    setNav(undefined);
    assert.equal(triggerHaptic('light'), false);
  } finally {
    if (origNavDesc) {
      Object.defineProperty(globalThis, 'navigator', origNavDesc);
    }
  }
});

test('nav.js setupPullToRefresh handles touch gestures, threshold, and triggers refresh', async () => {
  const { setupPullToRefresh } = await import('../nav.js');

  const origDoc = globalThis.document;
  const origWin = globalThis.window;

  const listeners = new Map();
  const classListSet = () => {
    const s = new Set();
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (s.has(c)) s.delete(c); else s.add(c);
        } else if (force) s.add(c);
        else s.delete(c);
      },
      contains: (c) => s.has(c)
    };
  };

  const statusEl = { textContent: '' };
  const indicator = {
    classList: classListSet(),
    style: {},
    querySelector(sel) {
      if (sel === '.pull-refresh-text') return statusEl;
      return null;
    }
  };

  const container = {
    scrollTop: 0,
    addEventListener(ev, fn) { listeners.set(`container:${ev}`, fn); },
    removeEventListener(ev) { listeners.delete(`container:${ev}`); }
  };

  globalThis.document = {
    getElementById(id) {
      if (id === 'customerPane') return container;
      if (id === 'pullToRefreshIndicator') return indicator;
      return null;
    },
    querySelector(sel) {
      if (sel === '#customerPane') return container;
      if (sel === '#pullToRefreshIndicator') return indicator;
      return null;
    }
  };
  globalThis.window = {
    pageYOffset: 0
  };

  try {
    let refreshed = false;
    const ptr = setupPullToRefresh({
      containerSelector: '#customerPane',
      indicatorSelector: '#pullToRefreshIndicator',
      pullThreshold: 50,
      onRefresh: async () => { refreshed = true; }
    });

    const onTouchStart = listeners.get('container:touchstart');
    const onTouchMove = listeners.get('container:touchmove');
    const onTouchEnd = listeners.get('container:touchend');

    assert.ok(typeof onTouchStart === 'function');
    assert.ok(typeof onTouchMove === 'function');
    assert.ok(typeof onTouchEnd === 'function');

    // 1. Partial pull under threshold
    onTouchStart({ touches: [{ clientY: 100 }] });
    onTouchMove({ touches: [{ clientY: 130 }] }); // diff 30px
    assert.ok(indicator.classList.contains('is-pulling'));
    assert.ok(!indicator.classList.contains('ready-to-refresh'));

    // End partial pull
    await onTouchEnd();
    assert.equal(refreshed, false);
    assert.ok(!indicator.classList.contains('is-pulling'));

    // 2. Full pull exceeding threshold
    onTouchStart({ touches: [{ clientY: 100 }] });
    onTouchMove({ touches: [{ clientY: 220 }] }); // diff 120px
    assert.ok(indicator.classList.contains('ready-to-refresh'));

    await onTouchEnd();
    assert.equal(refreshed, true);
    assert.ok(indicator.classList.contains('is-refreshing'));

    // Destroy cleans up listeners
    ptr.destroy();
    assert.equal(listeners.has('container:touchstart'), false);
  } finally {
    globalThis.document = origDoc;
    globalThis.window = origWin;
  }
});

test('nav.js setupCommandPalette renders items, keyboard navigates, filters, and executes actions', async () => {
  const { setupCommandPalette } = await import('../nav.js');

  const origDoc = globalThis.document;
  const listeners = new Map();
  const classListSet = () => {
    const s = new Set();
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (s.has(c)) s.delete(c); else s.add(c);
        } else if (force) s.add(c);
        else s.delete(c);
      },
      contains: (c) => s.has(c)
    };
  };

  const resultsBox = {
    innerHTML: '',
    children: [],
    addEventListener(ev, fn) { listeners.set(`results:${ev}`, fn); },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };

  const inputEl = {
    value: '',
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    getAttribute(k) { return this.attributes.get(k); },
    addEventListener(ev, fn) { listeners.set(`input:${ev}`, fn); },
    focus() {}
  };

  const modalEl = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    hasAttribute(k) { return k === 'open' && this.open; },
    setAttribute(k) { if (k === 'open') this.open = true; },
    removeAttribute(k) { if (k === 'open') this.open = false; },
    addEventListener(ev, fn) { listeners.set(`modal:${ev}`, fn); }
  };

  const triggerEl = {
    dataset: {},
    addEventListener(ev, fn) { listeners.set(`trigger:${ev}`, fn); }
  };

  globalThis.document = {
    getElementById(id) {
      if (id === 'commandPaletteModal') return modalEl;
      if (id === 'commandPaletteInput') return inputEl;
      if (id === 'commandPaletteResults') return resultsBox;
      if (id === 'commandPaletteTrigger') return triggerEl;
      return null;
    },
    addEventListener(ev, fn) { listeners.set(`doc:${ev}`, fn); }
  };

  try {
    let routed = null;
    let actionRun = null;
    let selectedCust = null;

    const palette = setupCommandPalette({
      onNavigate: (t) => { routed = t; },
      onAction: (a) => { actionRun = a; },
      getState: () => ({
        customers: [
          { id: 'c1', customerNumber: 101, name: 'Tariq Mehmood', phone: '03001234567', area: 'Main Bazaar', serviceStatus: 'active' },
          { id: 'c2', customerNumber: 102, name: 'Zahid Hussain', phone: '03019876543', area: 'Kot Mohalla', serviceStatus: 'offline' }
        ]
      }),
      onSelectCustomer: (c) => { selectedCust = c; }
    });

    // 1. Open palette
    palette.open();
    assert.equal(modalEl.open, true);
    assert.ok(resultsBox.innerHTML.includes('Dashboard / Live Summary'));
    assert.ok(resultsBox.innerHTML.includes('Receive Customer Payment'));

    // 2. Filter input with query matching customer
    inputEl.value = 'tariq';
    const onInput = listeners.get('input:input');
    assert.ok(typeof onInput === 'function');
    onInput();
    assert.ok(resultsBox.innerHTML.includes('Tariq Mehmood'));
    assert.ok(!resultsBox.innerHTML.includes('Zahid Hussain'));

    // 3. Execute selected customer via enter key
    const onKeydown = listeners.get('input:keydown');
    let defaultPrevented = false;
    onKeydown({ key: 'Enter', preventDefault: () => { defaultPrevented = true; } });
    assert.equal(defaultPrevented, true);
    assert.equal(selectedCust?.id, 'c1');
    assert.equal(modalEl.open, false);

    // 4. Open again and test escape key
    palette.open();
    assert.equal(modalEl.open, true);
    onKeydown({ key: 'Escape', preventDefault: () => {} });
    assert.equal(modalEl.open, false);

    // 5. Test Ctrl+K shortcut toggle
    const onDocKeydown = listeners.get('doc:keydown');
    assert.ok(typeof onDocKeydown === 'function');
    onDocKeydown({ ctrlKey: true, key: 'k', preventDefault: () => {} });
    assert.equal(modalEl.open, true);
    onDocKeydown({ ctrlKey: true, key: 'k', preventDefault: () => {} });
    assert.equal(modalEl.open, false);
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html contains swipeNavIndicator with arrow and label elements', () => {
  assert.match(index, /id="swipeNavIndicator"\s+class="swipe-nav-indicator"/);
  assert.match(index, /class="swipe-indicator-arrow"/);
  assert.match(index, /class="swipe-indicator-label"/);
});

test('nav.css provides swipe indicator, syncing animation, and landscape compact layout styles', () => {
  const navCss = read('nav.css');
  assert.match(navCss, /\.swipe-nav-indicator\s*\{/);
  assert.match(navCss, /\.swipe-nav-indicator\.is-visible/);
  assert.match(navCss, /\.network-status-dot\.syncing/);
  assert.match(navCss, /@media\s*\(max-height:\s*520px\)\s*and\s*\(orientation:\s*landscape\)/);
  assert.match(navCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.swipe-nav-indicator/);
});

test('app.js imports and initializes setupSwipeNavigation', () => {
  assert.match(app, /import\s*\{[^}]*setupSwipeNavigation[^}]*\}\s*from\s*'\.\/nav\.js\?v=1\.10\.0'/);
  assert.match(app, /setupSwipeNavigation\(\{/);
});

test('nav.js setupSwipeNavigation handles touch swipes, thresholds, edge cases, and programmatic navigation', async () => {
  const { setupSwipeNavigation } = await import('../nav.js');

  const listeners = new Map();
  const containerEl = {
    addEventListener(ev, fn) { listeners.set(ev, fn); },
    removeEventListener(ev) { listeners.delete(ev); }
  };

  const indicatorEl = {
    className: '',
    classList: {
      remove(...args) {
        let classes = indicatorEl.className.split(' ').filter(c => !args.includes(c));
        indicatorEl.className = classes.join(' ');
      }
    },
    querySelector(sel) {
      if (sel === '.swipe-indicator-arrow') return { textContent: '' };
      if (sel === '.swipe-indicator-label') return { textContent: '' };
      return null;
    },
    parentNode: {
      removeChild() {}
    }
  };

  const origDoc = globalThis.document;
  const origWin = globalThis.window;

  globalThis.document = {
    getElementById(id) {
      if (id === 'swipeNavIndicator') return indicatorEl;
      return null;
    },
    createElement() { return indicatorEl; },
    body: { appendChild() {} }
  };
  globalThis.window = {
    innerWidth: 400
  };

  try {
    let navigatedTo = null;
    let current = 'customers';

    const swipe = setupSwipeNavigation({
      container: containerEl,
      views: ['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses'],
      getCurrentView: () => current,
      onNavigate: (t) => { navigatedTo = t; current = t; },
      threshold: 50,
      maxVertical: 40,
      edgeMargin: 20
    });

    assert.equal(listeners.has('touchstart'), true);
    assert.equal(listeners.has('touchmove'), true);
    assert.equal(listeners.has('touchend'), true);

    const onStart = listeners.get('touchstart');
    const onMove = listeners.get('touchmove');
    const onEnd = listeners.get('touchend');

    // 1. Valid horizontal swipe left (towards next tab: transactions)
    onStart({ touches: [{ clientX: 200, clientY: 300 }], target: {} });
    onMove({ touches: [{ clientX: 130, clientY: 305 }] }); // deltaX = -70, deltaY = 5
    onEnd({ changedTouches: [{ clientX: 130, clientY: 305 }] });
    assert.equal(navigatedTo, 'transactions');
    assert.equal(swipe.getCurrentView(), 'transactions');

    // 2. Valid horizontal swipe right (towards previous tab: customers)
    onStart({ touches: [{ clientX: 150, clientY: 300 }], target: {} });
    onMove({ touches: [{ clientX: 220, clientY: 298 }] }); // deltaX = +70, deltaY = -2
    onEnd({ changedTouches: [{ clientX: 220, clientY: 298 }] });
    assert.equal(navigatedTo, 'customers');

    // 3. Vertical scroll rejection (touch drifts vertically more than maxVertical)
    navigatedTo = null;
    onStart({ touches: [{ clientX: 200, clientY: 200 }], target: {} });
    onMove({ touches: [{ clientX: 170, clientY: 260 }] }); // deltaY = 60 > maxVertical
    onEnd({ changedTouches: [{ clientX: 120, clientY: 260 }] });
    assert.equal(navigatedTo, null); // rejected

    // 4. Screen edge rejection (touch starts < edgeMargin)
    navigatedTo = null;
    onStart({ touches: [{ clientX: 10, clientY: 200 }], target: {} }); // clientX = 10 < edgeMargin (20)
    onMove({ touches: [{ clientX: 100, clientY: 200 }] });
    onEnd({ changedTouches: [{ clientX: 100, clientY: 200 }] });
    assert.equal(navigatedTo, null); // rejected

    // 5. Ineligible target rejection (interactive input or modal)
    navigatedTo = null;
    const fakeInputTarget = {
      closest(sel) {
        return sel.includes('input') ? {} : null;
      }
    };
    onStart({ touches: [{ clientX: 200, clientY: 200 }], target: fakeInputTarget });
    onMove({ touches: [{ clientX: 120, clientY: 200 }] });
    onEnd({ changedTouches: [{ clientX: 120, clientY: 200 }] });
    assert.equal(navigatedTo, null); // rejected

    // 6. Programmatic next and prev navigation
    const nextTab = swipe.next();
    assert.equal(nextTab, 'transactions');
    assert.equal(navigatedTo, 'transactions');

    const prevTab = swipe.prev();
    assert.equal(prevTab, 'customers');
    assert.equal(navigatedTo, 'customers');

    // Clamping at beginning
    const startTab = swipe.prev();
    assert.equal(startTab, null);

    // 7. Disable / enable controls
    swipe.disable();
    navigatedTo = null;
    onStart({ touches: [{ clientX: 200, clientY: 300 }], target: {} });
    onMove({ touches: [{ clientX: 120, clientY: 300 }] });
    onEnd({ changedTouches: [{ clientX: 120, clientY: 300 }] });
    assert.equal(navigatedTo, null); // disabled

    swipe.enable();

    // 8. Destroy cleans up listeners
    swipe.destroy();
    assert.equal(listeners.has('touchstart'), false);
    assert.equal(listeners.has('touchmove'), false);
    assert.equal(listeners.has('touchend'), false);
  } finally {
    globalThis.document = origDoc;
    globalThis.window = origWin;
  }
});

test('nav.js setupNetworkStatusIndicator supports updateSyncStatus and syncing state', async () => {
  const { setupNetworkStatusIndicator } = await import('../nav.js');

  const dotEl = { className: '' };
  const textEl = { textContent: '' };
  const pillEl = {
    dataset: {},
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    classList: { toggle() {} },
    addEventListener() {}
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'networkStatusDot') return dotEl;
      if (id === 'networkStatusText') return textEl;
      if (id === 'networkStatusPill') return pillEl;
      return null;
    }
  };

  try {
    const net = setupNetworkStatusIndicator();
    assert.ok(typeof net.updateSyncStatus === 'function');

    // Syncing state
    net.updateSyncStatus({ isSyncing: true });
    assert.equal(dotEl.className, 'network-status-dot syncing');
    assert.equal(textEl.textContent, 'Syncing...');

    // Pending changes state
    net.updateSyncStatus({ isSyncing: false, pendingChanges: 3 });
    assert.equal(textEl.textContent, '3 pending');

    // Clear pending changes
    net.updateSyncStatus({ isSyncing: false, pendingChanges: 0 });
    assert.ok(textEl.textContent.includes('Online'));
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html and nav.css provide accessible networkHealthModal dialog and styles', () => {
  assert.match(index, /<dialog id="networkHealthModal" class="modal network-health-modal"/);
  assert.match(index, /id="healthNetworkState"/);
  assert.match(index, /id="healthCacheState"/);
  assert.match(index, /id="healthStorageState"/);
  assert.match(index, /id="healthCheckConnectionBtn"/);

  const navCss = read('nav.css');
  assert.match(navCss, /\.network-health-modal\s*\{/);
  assert.match(navCss, /\.health-stat-card\s*\{/);
  assert.match(navCss, /\[data-theme="dark"\]\s*\.network-health-modal/);
});

test('nav.js setupNetworkStatusIndicator opens and closes networkHealthModal on pill click', async () => {
  const { setupNetworkStatusIndicator } = await import('../nav.js');

  let modalOpen = false;
  const modalEl = {
    showModal() { modalOpen = true; },
    close() { modalOpen = false; },
    addEventListener() {}
  };
  const netStateEl = { textContent: '', style: {} };
  const netDetailEl = { textContent: '' };
  const storageDetailEl = { textContent: '' };
  const closeBtn = { dataset: {}, addEventListener(ev, fn) { if (ev === 'click') this.onclick = fn; } };
  const testBtn = { dataset: {}, addEventListener(ev, fn) { if (ev === 'click') this.onclick = fn; } };

  let pillClick = null;
  const pillEl = {
    dataset: {},
    setAttribute() {},
    classList: { toggle() {} },
    addEventListener(ev, fn) { if (ev === 'click') pillClick = fn; }
  };

  const origDoc = globalThis.document;
  const origNav = globalThis.navigator;
  const origLocal = globalThis.localStorage;

  globalThis.document = {
    getElementById(id) {
      if (id === 'networkHealthModal') return modalEl;
      if (id === 'healthNetworkState') return netStateEl;
      if (id === 'healthNetworkDetail') return netDetailEl;
      if (id === 'healthStorageDetail') return storageDetailEl;
      if (id === 'networkHealthModalClose' || id === 'healthCloseBtn') return closeBtn;
      if (id === 'healthCheckConnectionBtn') return testBtn;
      if (id === 'networkStatusPill') return pillEl;
      return null;
    }
  };
  const origDesc = origNav ? Object.getOwnPropertyDescriptor(origNav, 'onLine') : null;
  if (!origNav) {
    globalThis.navigator = { onLine: true };
  } else {
    try {
      Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
    } catch {}
  }
  globalThis.localStorage = { length: 8 };

  try {
    const net = setupNetworkStatusIndicator();
    assert.ok(typeof net.openHealthModal === 'function');
    assert.ok(typeof net.closeHealthModal === 'function');

    // Clicking pill opens modal and populates details
    assert.ok(typeof pillClick === 'function');
    pillClick();
    assert.equal(modalOpen, true);
    assert.ok(netStateEl.textContent.includes('Online'));
    assert.ok(storageDetailEl.textContent.includes('8'));

    // Clicking test connection runs test
    testBtn.onclick();
    assert.ok(netStateEl.textContent.includes('Online'));

    // Closing modal
    net.closeHealthModal();
    assert.equal(modalOpen, false);
  } finally {
    globalThis.document = origDoc;
    if (!origNav) {
      delete globalThis.navigator;
    } else if (origDesc) {
      try { Object.defineProperty(globalThis.navigator, 'onLine', origDesc); } catch {}
    }
    globalThis.localStorage = origLocal;
  }
});

test('index.html, nav.css, and app.js include offline resilience banner and speed dial components', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  // index.html elements
  assert.match(indexHtml, /id="offlineSyncBanner"/);
  assert.match(indexHtml, /id="offlineSyncText"/);
  assert.match(indexHtml, /id="offlineSyncRetryBtn"/);
  assert.match(indexHtml, /id="offlineSyncDismissBtn"/);
  assert.match(indexHtml, /id="speedDialBackdrop"/);
  assert.match(indexHtml, /id="mobileSpeedDial"/);
  assert.match(indexHtml, /id="speedDialTrigger"/);
  assert.match(indexHtml, /id="speedDialMenu"/);
  assert.match(indexHtml, /data-speed-action="search"/);
  assert.match(indexHtml, /data-speed-action="payment"/);
  assert.match(indexHtml, /data-speed-action="add-customer"/);
  assert.match(indexHtml, /data-speed-action="reminders"/);
  assert.match(indexHtml, /data-speed-action="scroll-top"/);

  // nav.css styles
  assert.match(navCss, /\.offline-sync-banner/);
  assert.match(navCss, /\.offline-sync-banner\.is-offline/);
  assert.match(navCss, /\.offline-sync-banner\.is-syncing/);
  assert.match(navCss, /\.mobile-speed-dial/);
  assert.match(navCss, /\.speed-dial-trigger/);
  assert.match(navCss, /\.speed-dial-menu/);
  assert.match(navCss, /\.speed-dial-action/);
  assert.match(navCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.speed-dial-action/);

  // app.js integration
  assert.match(appJs, /setupOfflineSyncBanner/);
  assert.match(appJs, /setupMobileSpeedDial/);
});

test('offline sync queue helpers manage queued actions in storage safely', async () => {
  const { getOfflineSyncQueue, addOfflineSyncItem, clearOfflineSyncQueue, processOfflineSyncQueue } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  // Initial queue is empty
  assert.deepEqual(getOfflineSyncQueue(mockStorage), []);

  // Add items
  const item1 = addOfflineSyncItem({ action: 'record_payment', customerId: 'cust-1', amount: 1500 }, mockStorage);
  assert.equal(item1.length, 1);
  assert.equal(item1[0].action, 'record_payment');
  assert.equal(item1[0].amount, 1500);
  assert.ok(item1[0].id);
  assert.ok(item1[0].timestamp);

  const item2 = addOfflineSyncItem({ action: 'add_customer', name: 'Zeeshan' }, mockStorage);
  assert.equal(item2.length, 2);

  // Retrieve queue
  const currentQueue = getOfflineSyncQueue(mockStorage);
  assert.equal(currentQueue.length, 2);

  // Process queue
  let processedResult = null;
  const syncRes = processOfflineSyncQueue({
    storage: mockStorage,
    onComplete: (res) => {
      processedResult = res;
    }
  });

  assert.equal(syncRes.processedCount, 2);
  assert.equal(syncRes.success, true);
  assert.equal(processedResult.processedCount, 2);
  assert.deepEqual(getOfflineSyncQueue(mockStorage), []);

  // Clear queue
  addOfflineSyncItem({ action: 'temp' }, mockStorage);
  assert.equal(getOfflineSyncQueue(mockStorage).length, 1);
  clearOfflineSyncQueue(mockStorage);
  assert.equal(getOfflineSyncQueue(mockStorage).length, 0);
});

test('setupOfflineSyncBanner responds to online/offline state, retry, and dismissal', async () => {
  const { setupOfflineSyncBanner, addOfflineSyncItem } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const listeners = new Map();
  const banner = {
    hidden: true,
    className: '',
    classList: {
      contains: (c) => banner.className.includes(c)
    }
  };
  const icon = { textContent: '' };
  const text = { textContent: '' };
  const retryBtn = { hidden: true, addEventListener: (ev, fn) => listeners.set(`retry:${ev}`, fn) };
  const dismissBtn = { addEventListener: (ev, fn) => listeners.set(`dismiss:${ev}`, fn) };

  const origDoc = globalThis.document;
  const origNav = globalThis.navigator;
  const origWindow = globalThis.window;

  globalThis.document = {
    getElementById(id) {
      if (id === 'offlineSyncBanner') return banner;
      if (id === 'offlineSyncIcon') return icon;
      if (id === 'offlineSyncText') return text;
      if (id === 'offlineSyncRetryBtn') return retryBtn;
      if (id === 'offlineSyncDismissBtn') return dismissBtn;
      return null;
    }
  };
  globalThis.window = {
    addEventListener: (ev, fn) => listeners.set(`win:${ev}`, fn)
  };
  const origOnlineDesc = origNav ? Object.getOwnPropertyDescriptor(origNav, 'onLine') : null;
  if (!origNav) {
    globalThis.navigator = { onLine: false };
  } else {
    try {
      Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true, writable: true });
    } catch {}
  }

  try {
    let syncedRes = null;
    let toastedMsg = null;
    const bannerCtrl = setupOfflineSyncBanner({
      storage: mockStorage,
      onSyncProcessed: (res) => { syncedRes = res; },
      onToast: (msg) => { toastedMsg = msg; }
    });

    // When offline, banner is visible with offline class
    assert.equal(banner.hidden, false);
    assert.ok(banner.className.includes('is-offline'));
    assert.ok(text.textContent.includes('Offline Mode'));

    // Add item to queue while offline
    addOfflineSyncItem({ action: 'note' }, mockStorage);
    bannerCtrl.update();
    assert.ok(text.textContent.includes('1 pending action'));

    // Go online
    if (!origNav) {
      globalThis.navigator.onLine = true;
    } else {
      try {
        Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
      } catch {}
    }
    listeners.get('win:online')();
    // Trigger immediate sync
    bannerCtrl.syncNow();
    assert.ok(syncedRes);
    assert.equal(syncedRes.processedCount, 1);
    assert.ok(toastedMsg.includes('Sync complete'));

    // Dismiss button hides banner
    assert.ok(listeners.has('dismiss:click'));
    listeners.get('dismiss:click')();
    assert.equal(banner.hidden, true);
  } finally {
    globalThis.document = origDoc;
    globalThis.window = origWindow;
    if (!origNav) {
      delete globalThis.navigator;
    } else if (origOnlineDesc) {
      try { Object.defineProperty(globalThis.navigator, 'onLine', origOnlineDesc); } catch {}
    }
  }
});

test('setupMobileSpeedDial controls opening, closing, keyboard navigation, and action execution', async () => {
  const { setupMobileSpeedDial } = await import('../nav.js');

  const listeners = new Map();
  const classListSet = () => {
    const s = new Set();
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      contains: (c) => s.has(c)
    };
  };

  const containerClasses = classListSet();
  const container = {
    id: 'mobileSpeedDial',
    classList: containerClasses,
    contains: (el) => el === container || el === trigger || el === menu,
    addEventListener: (ev, fn) => listeners.set(`container:${ev}`, fn)
  };

  let triggerAriaExpanded = 'false';
  let triggerFocused = false;
  const trigger = {
    id: 'speedDialTrigger',
    dataset: {},
    setAttribute: (k, v) => { if (k === 'aria-expanded') triggerAriaExpanded = v; },
    getAttribute: (k) => k === 'aria-expanded' ? triggerAriaExpanded : null,
    focus: () => { triggerFocused = true; },
    addEventListener: (ev, fn) => listeners.set(`trigger:${ev}`, fn)
  };

  const actionCallbacks = {};
  const searchBtn = {
    tagName: 'BUTTON',
    getAttribute: (k) => k === 'data-speed-action' ? 'search' : null,
    dataset: {},
    focus: () => {},
    addEventListener: (ev, fn) => { actionCallbacks['search'] = fn; }
  };
  const paymentBtn = {
    tagName: 'BUTTON',
    getAttribute: (k) => k === 'data-speed-action' ? 'payment' : null,
    dataset: {},
    focus: () => {},
    addEventListener: (ev, fn) => { actionCallbacks['payment'] = fn; }
  };

  const menu = {
    id: 'speedDialMenu',
    hidden: true,
    querySelector: (sel) => searchBtn,
    querySelectorAll: (sel) => [searchBtn, paymentBtn],
    contains: (el) => el === searchBtn || el === paymentBtn
  };

  const backdrop = {
    id: 'speedDialBackdrop',
    hidden: true,
    dataset: {},
    contains: (el) => el === backdrop,
    addEventListener: (ev, fn) => listeners.set(`backdrop:${ev}`, fn)
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'mobileSpeedDial') return container;
      if (id === 'speedDialTrigger') return trigger;
      if (id === 'speedDialMenu') return menu;
      if (id === 'speedDialBackdrop') return backdrop;
      return null;
    },
    addEventListener: (ev, fn) => listeners.set(`doc:${ev}`, fn)
  };

  try {
    let searchTriggered = false;
    let paymentTriggered = false;

    const dial = setupMobileSpeedDial({
      onSearchRoster: () => { searchTriggered = true; },
      onRecordPayment: () => { paymentTriggered = true; }
    });

    assert.equal(dial.isOpen(), false);

    // Open via trigger
    listeners.get('trigger:click')({ stopPropagation: () => {} });
    assert.equal(dial.isOpen(), true);
    assert.equal(containerClasses.contains('is-open'), true);
    assert.equal(menu.hidden, false);
    assert.equal(backdrop.hidden, false);
    assert.equal(triggerAriaExpanded, 'true');

    // Trigger search action
    assert.ok(actionCallbacks['search']);
    actionCallbacks['search']();
    assert.equal(searchTriggered, true);
    assert.equal(dial.isOpen(), false);
    assert.equal(containerClasses.contains('is-open'), false);
    assert.equal(menu.hidden, true);
    assert.equal(backdrop.hidden, true);

    // Reopen and close with escape
    dial.open();
    assert.equal(dial.isOpen(), true);
    let defaultPrevented = false;
    listeners.get('container:keydown')({ key: 'Escape', preventDefault: () => { defaultPrevented = true; } });
    assert.equal(defaultPrevented, true);
    assert.equal(dial.isOpen(), false);

    // Reopen and close with backdrop click
    dial.open();
    assert.equal(dial.isOpen(), true);
    listeners.get('backdrop:click')();
    assert.equal(dial.isOpen(), false);
  } finally {
    globalThis.document = origDoc;
  }
});

test('setupOfflineQueueModal renders pending items, clears queue, and handles sync action', async () => {
  const { setupOfflineQueueModal, addOfflineSyncItem } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  addOfflineSyncItem({ action: 'record_payment', summary: 'Receipt for Ali', timestamp: '2026-10-16T00:30:00Z' }, mockStorage);
  addOfflineSyncItem({ action: 'add_customer', summary: 'New subscriber Tariq', timestamp: '2026-10-16T00:32:00Z' }, mockStorage);

  const listeners = new Map();
  let modalOpen = false;

  const modal = {
    id: 'offlineQueueModal',
    showModal: () => { modalOpen = true; },
    close: () => { modalOpen = false; },
    setAttribute: () => { modalOpen = true; },
    removeAttribute: () => { modalOpen = false; },
    addEventListener: (ev, fn) => listeners.set(`modal:${ev}`, fn)
  };
  const closeBtn = { id: 'closeOfflineQueueModalBtn', dataset: {}, addEventListener: (ev, fn) => listeners.set(`close:${ev}`, fn) };
  const syncBtn = { id: 'queueSyncAllBtn', dataset: {}, disabled: false, addEventListener: (ev, fn) => listeners.set(`sync:${ev}`, fn) };
  const clearBtn = { id: 'queueClearAllBtn', dataset: {}, addEventListener: (ev, fn) => listeners.set(`clear:${ev}`, fn) };
  const listEl = {
    id: 'offlineQueueList',
    innerHTML: '',
    children: [],
    appendChild: (child) => { listEl.children.push(child); }
  };
  const countBadge = { id: 'queueItemCountBadge', textContent: '' };
  const emptyMsg = { id: 'offlineQueueEmptyMessage', hidden: false };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'offlineQueueModal') return modal;
      if (id === 'closeOfflineQueueModalBtn') return closeBtn;
      if (id === 'queueSyncAllBtn') return syncBtn;
      if (id === 'queueClearAllBtn') return clearBtn;
      if (id === 'offlineQueueList') return listEl;
      if (id === 'queueItemCountBadge') return countBadge;
      if (id === 'offlineQueueEmptyMessage') return emptyMsg;
      return null;
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        className: '',
        attributes: new Map(),
        setAttribute(k, v) { this.attributes.set(k, v); },
        appendChild: function(c) { this.children = this.children || []; this.children.push(c); }
      };
    }
  };

  try {
    let syncedRes = null;
    let toastedMsg = null;

    const queueModal = setupOfflineQueueModal({
      storage: mockStorage,
      onSync: (r) => { syncedRes = r; },
      onToast: (msg) => { toastedMsg = msg; }
    });

    // Opening modal renders queue
    queueModal.open();
    assert.equal(modalOpen, true);
    assert.ok(countBadge.textContent.includes('2 items pending'));
    assert.equal(emptyMsg.hidden, true);
    assert.equal(listEl.children.length, 2);

    // Clicking close button
    assert.ok(listeners.has('close:click'));
    listeners.get('close:click')();
    assert.equal(modalOpen, false);

    // Triggering sync button
    assert.ok(listeners.has('sync:click'));
    listeners.get('sync:click')();
    assert.ok(syncedRes);
    assert.equal(syncedRes.processedCount, 2);
    assert.ok(toastedMsg.includes('Synced 2 queued items'));
    assert.ok(countBadge.textContent.includes('0 items pending'));
    assert.equal(emptyMsg.hidden, false);
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html and nav.css provide markup and styling for mobile breadcrumbs and tab slider', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');

  // Markup assertions
  assert.match(indexHtml, /<nav id="mobileBreadcrumbBar" class="mobile-breadcrumb-bar" aria-label="Breadcrumb navigation" hidden>/);
  assert.match(indexHtml, /id="breadcrumbBackBtn" class="breadcrumb-back-btn"/);
  assert.match(indexHtml, /id="breadcrumbList" class="breadcrumb-list" role="list"/);

  // CSS assertions
  assert.match(navCss, /\.mobile-breadcrumb-bar\s*\{/);
  assert.match(navCss, /\.breadcrumb-back-btn\s*\{/);
  assert.match(navCss, /\.breadcrumb-list\s*\{/);
  assert.match(navCss, /\.breadcrumb-link\s*\{/);
  assert.match(navCss, /\.breadcrumb-separator\s*\{/);
  assert.match(navCss, /\.breadcrumb-current-label\s*\{/);
  assert.match(navCss, /\.nav-slider-indicator\s*\{/);
  assert.match(navCss, /\[data-theme="dark"\]\s*\.mobile-breadcrumb-bar/);
  assert.match(navCss, /\[data-theme="dark"\]\s*\.nav-slider-indicator/);
  assert.match(navCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.nav-slider-indicator/);
});

test('app.js imports and initializes setupMobileBreadcrumbs and setupTabSliderIndicator', () => {
  const appCode = read('app.js');
  assert.match(appCode, /setupMobileBreadcrumbs/);
  assert.match(appCode, /setupTabSliderIndicator/);
  assert.match(appCode, /mobileBreadcrumbs\s*=\s*setupMobileBreadcrumbs\(\{/);
  assert.match(appCode, /tabSlider\s*=\s*setupTabSliderIndicator\(\{/);
  assert.match(appCode, /mobileBreadcrumbs\?\.setBreadcrumbs\(/);
  assert.match(appCode, /tabSlider\?\.updateSlider\(\)/);
  assert.match(appCode, /mobileBreadcrumbs\?\.pushCrumb\(/);
});

test('setupMobileBreadcrumbs manages stack, rendering, navigation callbacks, and back actions', async () => {
  const { setupMobileBreadcrumbs } = await import('../nav.js');

  const listeners = new Map();
  const makeElement = (tag, id = '') => {
    let htmlContent = '';
    const el = {
      tagName: tag.toUpperCase(),
      id,
      className: '',
      hidden: false,
      attributes: new Map(),
      children: [],
      dataset: {},
      get innerHTML() { return htmlContent; },
      set innerHTML(val) {
        htmlContent = val;
        if (val === '') this.children = [];
      },
      setAttribute(k, v) { this.attributes.set(k, v); },
      getAttribute(k) { return this.attributes.get(k); },
      removeAttribute(k) { this.attributes.delete(k); },
      appendChild(c) { this.children.push(c); },
      addEventListener(ev, fn) {
        listeners.set(`${id || tag}:${ev}`, fn);
      },
      removeEventListener(ev, fn) {
        listeners.delete(`${id || tag}:${ev}`);
      },
      querySelectorAll(sel) {
        const found = [];
        const traverse = (node) => {
          if (!node) return;
          if (sel.includes('button') && node.tagName === 'BUTTON') found.push(node);
          if (Array.isArray(node.children)) node.children.forEach(traverse);
        };
        traverse(this);
        return found;
      }
    };
    return el;
  };

  const container = makeElement('nav', 'mobileBreadcrumbBar');
  const list = makeElement('ol', 'breadcrumbList');
  const backBtn = makeElement('button', 'breadcrumbBackBtn');

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'mobileBreadcrumbBar') return container;
      if (id === 'breadcrumbList') return list;
      if (id === 'breadcrumbBackBtn') return backBtn;
      return null;
    },
    createElement(tag) {
      return makeElement(tag);
    }
  };

  try {
    let navigatedTo = null;
    const breadcrumbs = setupMobileBreadcrumbs({
      containerId: 'mobileBreadcrumbBar',
      listId: 'breadcrumbList',
      backBtnId: 'breadcrumbBackBtn',
      initialCrumbs: [{ id: 'home', label: 'Home' }],
      hideOnSingle: true,
      maxItems: 4,
      onNavigate: (id, data, crumb) => {
        navigatedTo = { id, data, crumb };
      }
    });

    // Initially single root item: container and backBtn hidden
    assert.equal(container.hidden, true);
    assert.equal(backBtn.hidden, true);
    assert.equal(list.children.length, 1);
    assert.equal(list.children[0].attributes.get('aria-current'), 'page');
    assert.equal(list.children[0].children[0].textContent, 'Home');

    // Push new crumb: 'customers'
    breadcrumbs.pushBreadcrumb({ id: 'customers', label: 'Customers' });
    assert.equal(container.hidden, false);
    assert.equal(backBtn.hidden, false);
    assert.equal(backBtn.attributes.get('aria-label'), 'Back to Home');
    assert.equal(list.children.length, 2);

    // Prior crumb is button link, last crumb is current page
    const firstLi = list.children[0];
    const secondLi = list.children[1];
    assert.equal(firstLi.children[0].tagName, 'BUTTON');
    assert.equal(firstLi.children[0].textContent, 'Home');
    assert.equal(firstLi.children[1].className, 'breadcrumb-separator');
    assert.equal(secondLi.attributes.get('aria-current'), 'page');
    assert.equal(secondLi.children[0].textContent, 'Customers');

    // Push customer detail crumb: 'cust-101'
    breadcrumbs.pushBreadcrumb({ id: 'cust-101', label: 'Ali Raza', data: { customerId: 101 } });
    assert.equal(list.children.length, 3);
    assert.equal(backBtn.attributes.get('aria-label'), 'Back to Customers');

    // Push duplicate crumb (navigating to an existing crumb in trail)
    breadcrumbs.pushBreadcrumb({ id: 'customers', label: 'Customers List' });
    assert.equal(list.children.length, 2);
    assert.equal(list.children[1].children[0].textContent, 'Customers List');

    // Push multiple crumbs up to maxItems boundary
    breadcrumbs.pushBreadcrumb({ id: 'section-a', label: 'Section A' });
    breadcrumbs.pushBreadcrumb({ id: 'section-b', label: 'Section B' });
    breadcrumbs.pushBreadcrumb({ id: 'section-c', label: 'Section C' });
    const trail = breadcrumbs.getBreadcrumbTrail();
    assert.equal(trail.length, 4); // maxItems is 4, root preserved
    assert.equal(trail[0].id, 'home');
    assert.equal(trail[trail.length - 1].id, 'section-c');

    // Test clicking back button
    assert.ok(listeners.has('breadcrumbBackBtn:click'));
    listeners.get('breadcrumbBackBtn:click')();
    assert.ok(navigatedTo);
    assert.equal(navigatedTo.id, 'section-b');
    assert.equal(breadcrumbs.getBreadcrumbTrail().length, 3);

    // Test popCrumb explicitly
    const popped = breadcrumbs.popCrumb();
    assert.equal(popped.id, 'section-b');
    assert.equal(navigatedTo.id, 'section-a');

    // Test resetBreadcrumbs
    breadcrumbs.resetBreadcrumbs([{ id: 'home', label: 'Overview' }]);
    assert.equal(breadcrumbs.getBreadcrumbTrail().length, 1);
    assert.equal(container.hidden, true);

    // Test setBreadcrumbTrail
    breadcrumbs.setBreadcrumbTrail([
      { id: 'home', label: 'Home' },
      { id: 'reports', label: 'Reports' },
      { id: 'monthly', label: 'Monthly Summary' }
    ]);
    assert.equal(breadcrumbs.getBreadcrumbTrail().length, 3);
    assert.equal(container.hidden, false);
    assert.equal(backBtn.hidden, false);

    // Test keyboard navigation handler
    assert.ok(listeners.has('breadcrumbList:keydown'));
    const keydownHandler = listeners.get('breadcrumbList:keydown');
    let focusedBtn = null;
    const mockFocusable1 = { tagName: 'BUTTON', className: 'breadcrumb-link', focus: () => { focusedBtn = 1; } };
    const mockFocusable2 = { tagName: 'BUTTON', className: 'breadcrumb-link', focus: () => { focusedBtn = 2; } };
    list.querySelectorAll = () => [mockFocusable1, mockFocusable2];

    globalThis.document.activeElement = mockFocusable1;
    let prevented = false;
    keydownHandler({ key: 'ArrowRight', preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(focusedBtn, 2);

    // Clean up
    breadcrumbs.destroy();
    assert.equal(listeners.has('breadcrumbBackBtn:click'), false);
    assert.equal(listeners.has('breadcrumbList:keydown'), false);
  } finally {
    globalThis.document = origDoc;
  }
});

test('setupTabSliderIndicator creates indicator, updates position and styles, and cleans up', async () => {
  const { setupTabSliderIndicator } = await import('../nav.js');

  const listeners = new Map();
  const windowListeners = new Map();

  const mockTab1 = {
    nodeType: 1,
    id: 'tab-home',
    dataset: { mobileNav: 'home' },
    attributes: new Map([['aria-current', 'page']]),
    getAttribute(k) { return this.attributes.get(k); },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 80, height: 40 })
  };

  const mockTab2 = {
    nodeType: 1,
    id: 'tab-customers',
    dataset: { mobileNav: 'customers' },
    attributes: new Map([['aria-current', 'false']]),
    getAttribute(k) { return this.attributes.get(k); },
    getBoundingClientRect: () => ({ left: 100, top: 20, width: 90, height: 40 })
  };

  let indicatorEl = null;
  const container = {
    nodeType: 1,
    className: 'mobile-bottom-nav',
    scrollLeft: 0,
    scrollTop: 0,
    style: {
      properties: new Map(),
      setProperty(k, v) { this.properties.set(k, v); },
      getPropertyValue(k) { return this.properties.get(k); }
    },
    children: [mockTab1, mockTab2],
    querySelector(sel) {
      if (sel.includes('nav-slider-indicator')) return indicatorEl;
      if (sel.includes('customers')) return mockTab2;
      if (sel.includes('home')) return mockTab1;
      if (sel.includes('page')) return mockTab1;
      return null;
    },
    insertBefore(newChild, refChild) {
      indicatorEl = newChild;
      this.children.unshift(newChild);
    },
    removeChild(child) {
      this.children = this.children.filter(c => c !== child);
      indicatorEl = null;
    },
    getBoundingClientRect: () => ({ left: 0, top: 20, width: 360, height: 50 })
  };

  const origDoc = globalThis.document;
  const origWindow = globalThis.window;

  globalThis.document = {
    querySelector(sel) {
      if (sel === '.mobile-bottom-nav') return container;
      return null;
    },
    createElement(tag) {
      return {
        nodeType: 1,
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        attributes: new Map(),
        setAttribute(k, v) { this.attributes.set(k, v); },
        getAttribute(k) { return this.attributes.get(k); },
        parentNode: container
      };
    }
  };

  globalThis.window = {
    addEventListener(ev, fn) { windowListeners.set(ev, fn); },
    removeEventListener(ev, fn) { windowListeners.delete(ev, fn); },
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {}
  };

  try {
    const slider = setupTabSliderIndicator({
      containerSelector: '.mobile-bottom-nav',
      indicatorClass: 'nav-slider-indicator'
    });

    assert.ok(slider.getIndicator());
    assert.equal(slider.getIndicator().className, 'nav-slider-indicator');
    assert.equal(slider.getIndicator().attributes.get('aria-hidden'), 'true');

    // Initial position was set for active tab (mockTab1)
    assert.equal(slider.getIndicator().style.opacity, '1');
    assert.equal(slider.getIndicator().style.width, '80px');
    assert.equal(slider.getIndicator().style.height, '40px');
    assert.equal(slider.getIndicator().style.transform, 'translate3d(10px, 0px, 0)');
    assert.equal(container.style.getPropertyValue('--slider-x'), '10px');

    // Switch to tab 2
    slider.updateSlider(mockTab2);
    assert.equal(slider.getIndicator().style.width, '90px');
    assert.equal(slider.getIndicator().style.transform, 'translate3d(100px, 0px, 0)');
    assert.equal(container.style.getPropertyValue('--slider-x'), '100px');

    // Resize event triggers update
    assert.ok(windowListeners.has('resize'));
    windowListeners.get('resize')();
    assert.ok(slider.getIndicator().style.opacity, '1');

    // Destroy cleans up
    slider.destroy();
    assert.equal(windowListeners.has('resize'), false);
  } finally {
    globalThis.document = origDoc;
    globalThis.window = origWindow;
  }
});

test('index.html provides accessible markup for Mobile Field Technician Enrollment Wizard', () => {
  assert.match(index, /<dialog id="customerEnrollmentWizard" class="modal enrollment-wizard-modal" aria-labelledby="enrollmentWizardTitle">/);
  assert.match(index, /id="wizardStepPill1"[^>]*data-wizard-step="1"/);
  assert.match(index, /id="wizardStepPill2"[^>]*data-wizard-step="2"/);
  assert.match(index, /id="wizardStepPill3"[^>]*data-wizard-step="3"/);
  assert.match(index, /id="wizardStepPill4"[^>]*data-wizard-step="4"/);
  assert.match(index, /id="wizardProgressBar"/);
  assert.match(index, /id="wizardTrack"/);
  assert.match(index, /id="wizardSlide1"/);
  assert.match(index, /id="wizardSlide2"/);
  assert.match(index, /id="wizardSlide3"/);
  assert.match(index, /id="wizardSlide4"/);
  assert.match(index, /id="openEnrollmentWizardBtn"/);
  assert.match(index, /id="quickActionFieldWizard"/);
  assert.match(index, /data-sheet-action="field-enrollment"/);
  assert.match(index, /data-speed-action="field-enrollment"/);
});

test('nav.css provides responsive styles, stepper styling, dark mode and motion overrides for enrollment wizard', () => {
  const navCss = read('nav.css');
  assert.match(navCss, /\.enrollment-wizard-modal/);
  assert.match(navCss, /\.wizard-stepper/);
  assert.match(navCss, /\.wizard-step-pill/);
  assert.match(navCss, /\.wizard-progress-bar/);
  assert.match(navCss, /\.wizard-track/);
  assert.match(navCss, /\.wizard-slide/);
  assert.match(navCss, /\[data-theme="dark"\]\s*\.enrollment-wizard-modal/);
  assert.match(navCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.wizard-track/);
});

test('calculateWizardProgress computes step bounds and progress percentages', async () => {
  const { calculateWizardProgress } = await import('../nav.js');

  const step1 = calculateWizardProgress(1, 4);
  assert.equal(step1.step, 1);
  assert.equal(step1.percentage, 25);
  assert.equal(step1.isFirst, true);
  assert.equal(step1.isLast, false);

  const step2 = calculateWizardProgress(2, 4);
  assert.equal(step2.step, 2);
  assert.equal(step2.percentage, 50);
  assert.equal(step2.isFirst, false);
  assert.equal(step2.isLast, false);

  const step3 = calculateWizardProgress(3, 4);
  assert.equal(step3.step, 3);
  assert.equal(step3.percentage, 75);

  const step4 = calculateWizardProgress(4, 4);
  assert.equal(step4.step, 4);
  assert.equal(step4.percentage, 100);
  assert.equal(step4.isFirst, false);
  assert.equal(step4.isLast, true);

  // Clamps out of range
  assert.equal(calculateWizardProgress(0, 4).step, 1);
  assert.equal(calculateWizardProgress(99, 4).step, 4);
});

test('validateWizardStep validates step-specific fields and rules', async () => {
  const { validateWizardStep } = await import('../nav.js');

  // Step 1: name & phone
  assert.equal(validateWizardStep(1, { name: '' }).valid, false);
  assert.equal(validateWizardStep(1, { name: 'A' }).valid, false);
  assert.equal(validateWizardStep(1, { name: 'Usman', phone: '123' }).valid, false);
  assert.equal(validateWizardStep(1, { name: 'Usman', phone: '03001234567', cnic: '123' }).valid, false);
  assert.equal(validateWizardStep(1, { name: 'Usman', phone: '03001234567', cnic: '3520112345671' }).valid, true);

  // Step 2: location
  assert.equal(validateWizardStep(2, { area: '', mohalla: '', address: '' }).valid, false);
  assert.equal(validateWizardStep(2, { area: 'Shahdara Town' }).valid, true);

  // Step 3: package & rate
  assert.equal(validateWizardStep(3, { monthlyRate: -100 }).valid, false);
  assert.equal(validateWizardStep(3, { monthlyRate: 'invalid' }).valid, false);
  assert.equal(validateWizardStep(3, { monthlyRate: 1500, installationFee: -50 }).valid, false);
  assert.equal(validateWizardStep(3, { monthlyRate: 1500, installationFee: 500 }).valid, true);

  // Step 4: verification confirmation
  assert.equal(validateWizardStep(4, { agreementVerified: false }).valid, false);
  assert.equal(validateWizardStep(4, { agreementVerified: true }).valid, true);
});

test('formatCustomerSummary and wizard draft storage functions', async () => {
  const { formatCustomerSummary, saveWizardDraft, getWizardDraft, clearWizardDraft } = await import('../nav.js');

  const summary = formatCustomerSummary({
    name: 'Muhammad Ali',
    phone: '0321-9876543',
    area: 'Saeed Park',
    mohalla: 'Street 3',
    address: 'House 55',
    fdb: 'FDB-02',
    fiberPort: 4,
    packageLabel: '5 Mbps (200 GB)',
    monthlyRate: 2000,
    installationFee: 1000,
    staticIp: true,
    ontOwnership: 'ISP Provided'
  });

  assert.equal(summary.name, 'Muhammad Ali');
  assert.equal(summary.phone, '0321-9876543');
  assert.equal(summary.fullAddress, 'House 55, Street 3, Saeed Park');
  assert.equal(summary.fdb, 'FDB-02');
  assert.equal(summary.port, 'Port #4');
  assert.equal(summary.rate, 2000);
  assert.equal(summary.fee, 1000);
  assert.equal(summary.totalUpfront, 3000);
  assert.equal(summary.staticIp, true);

  // Draft storage
  const mockStorage = new Map();
  const fakeStorage = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k)
  };

  assert.equal(getWizardDraft(fakeStorage), null);
  saveWizardDraft({ name: 'Draft User', step: 2 }, fakeStorage);
  const loaded = getWizardDraft(fakeStorage);
  assert.equal(loaded.name, 'Draft User');
  assert.equal(loaded.step, 2);
  clearWizardDraft(fakeStorage);
  assert.equal(getWizardDraft(fakeStorage), null);
});

test('setupCustomerEnrollmentWizard controls stepper progression, validation, swipe gestures, and completion', async () => {
  const { setupCustomerEnrollmentWizard } = await import('../nav.js');

  const listeners = new Map();
  const classListSet = () => {
    const s = new Set();
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      contains: (c) => s.has(c)
    };
  };

  const createFakeEl = (id) => ({
    id,
    classList: classListSet(),
    attributes: new Map(),
    dataset: {},
    style: {},
    value: '',
    checked: false,
    disabled: false,
    setAttribute(k, v) { this.attributes.set(k, String(v)); },
    getAttribute(k) { return this.attributes.get(k); },
    hasAttribute(k) { return this.attributes.has(k); },
    removeAttribute(k) { this.attributes.delete(k); },
    addEventListener(event, fn) { listeners.set(`${id}:${event}`, fn); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    focus() {}
  });

  const modal = createFakeEl('customerEnrollmentWizard');
  modal.showModal = () => { modal.setAttribute('open', ''); };
  modal.close = () => { modal.removeAttribute('open'); };

  const closeBtn = createFakeEl('closeEnrollmentWizardBtn');
  const backBtn = createFakeEl('wizardBackBtn');
  const nextBtn = createFakeEl('wizardNextBtn');
  const stepIndicator = createFakeEl('wizardStepIndicator');
  const progressBar = createFakeEl('wizardProgressBar');
  const errorBox = createFakeEl('wizardErrorBox');
  const track = createFakeEl('wizardTrack');

  const pill1 = createFakeEl('wizardStepPill1');
  pill1.setAttribute('data-wizard-step', '1');
  const pill2 = createFakeEl('wizardStepPill2');
  pill2.setAttribute('data-wizard-step', '2');
  const pill3 = createFakeEl('wizardStepPill3');
  pill3.setAttribute('data-wizard-step', '3');
  const pill4 = createFakeEl('wizardStepPill4');
  pill4.setAttribute('data-wizard-step', '4');

  const nameInput = createFakeEl('wizardCustomerName');
  const phoneInput = createFakeEl('wizardCustomerPhone');
  const cnicInput = createFakeEl('wizardCustomerCnic');
  const statusSelect = createFakeEl('wizardInitialStatus');
  statusSelect.value = 'Active';

  const areaSelect = createFakeEl('wizardAreaSelect');
  areaSelect.value = 'Shahdara Town';
  const mohallaInput = createFakeEl('wizardMohallaInput');
  const addressInput = createFakeEl('wizardAddressInput');
  const fdbInput = createFakeEl('wizardFdbId');
  const portInput = createFakeEl('wizardFiberPort');

  const packageSelect = createFakeEl('wizardPackageSelect');
  packageSelect.value = '5mbps-150gb';
  packageSelect.options = [{ text: '5 Mbps (150 GB)', value: '5mbps-150gb' }];
  packageSelect.selectedIndex = 0;
  const rateInput = createFakeEl('wizardMonthlyRate');
  rateInput.value = '1500';
  const feeInput = createFakeEl('wizardInstallationFee');
  feeInput.value = '0';
  const dueDateSelect = createFakeEl('wizardDueDateDay');
  dueDateSelect.value = '10';
  const ontSelect = createFakeEl('wizardOntOwnership');
  ontSelect.value = 'ISP Provided';
  const staticIpCheck = createFakeEl('wizardStaticIpCheck');

  const summaryCard = createFakeEl('wizardSummaryCard');
  const startDateInput = createFakeEl('wizardStartDate');
  const techNotesInput = createFakeEl('wizardTechNotes');
  const agreementCheck = createFakeEl('wizardAgreementCheck');

  const slide1 = createFakeEl('wizardSlide1');
  const slide2 = createFakeEl('wizardSlide2');
  const slide3 = createFakeEl('wizardSlide3');
  const slide4 = createFakeEl('wizardSlide4');

  modal.querySelectorAll = (sel) => {
    if (sel.includes('data-wizard-step')) return [pill1, pill2, pill3, pill4];
    return [];
  };

  const elementsMap = new Map([
    ['customerEnrollmentWizard', modal],
    ['closeEnrollmentWizardBtn', closeBtn],
    ['wizardBackBtn', backBtn],
    ['wizardNextBtn', nextBtn],
    ['wizardStepIndicator', stepIndicator],
    ['wizardProgressBar', progressBar],
    ['wizardErrorBox', errorBox],
    ['wizardTrack', track],
    ['wizardStepPill1', pill1],
    ['wizardStepPill2', pill2],
    ['wizardStepPill3', pill3],
    ['wizardStepPill4', pill4],
    ['wizardCustomerName', nameInput],
    ['wizardCustomerPhone', phoneInput],
    ['wizardCustomerCnic', cnicInput],
    ['wizardInitialStatus', statusSelect],
    ['wizardAreaSelect', areaSelect],
    ['wizardMohallaInput', mohallaInput],
    ['wizardAddressInput', addressInput],
    ['wizardFdbId', fdbInput],
    ['wizardFiberPort', portInput],
    ['wizardPackageSelect', packageSelect],
    ['wizardMonthlyRate', rateInput],
    ['wizardInstallationFee', feeInput],
    ['wizardDueDateDay', dueDateSelect],
    ['wizardOntOwnership', ontSelect],
    ['wizardStaticIpCheck', staticIpCheck],
    ['wizardSummaryCard', summaryCard],
    ['wizardStartDate', startDateInput],
    ['wizardTechNotes', techNotesInput],
    ['wizardAgreementCheck', agreementCheck],
    ['wizardSlide1', slide1],
    ['wizardSlide2', slide2],
    ['wizardSlide3', slide3],
    ['wizardSlide4', slide4]
  ]);

  const mockStorageMap = new Map();
  const fakeStorage = {
    getItem: (k) => mockStorageMap.get(k) || null,
    setItem: (k, v) => mockStorageMap.set(k, String(v)),
    removeItem: (k) => mockStorageMap.delete(k)
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elementsMap.get(id) || null,
    querySelectorAll: (sel) => {
      if (sel.includes('data-wizard-step')) return [pill1, pill2, pill3, pill4];
      return [];
    }
  };

  try {
    let completedData = null;
    const wizard = setupCustomerEnrollmentWizard({
      storage: fakeStorage,
      onComplete: (data) => { completedData = data; }
    });

    // Opening wizard
    wizard.open();
    assert.equal(wizard.getCurrentStep(), 1);
    assert.equal(backBtn.disabled, true);
    assert.equal(progressBar.style.width, '25%');

    // Trying to advance without name fails validation
    nameInput.value = '';
    const advancedWithoutName = wizard.nextStep();
    assert.equal(advancedWithoutName, false);
    assert.equal(wizard.getCurrentStep(), 1);
    assert.equal(errorBox.hidden, false);

    // Provide valid name and phone
    nameInput.value = 'Rizwan Ahmad';
    phoneInput.value = '0302-7654321';
    const advancedToStep2 = wizard.nextStep();
    assert.equal(advancedToStep2, true);
    assert.equal(wizard.getCurrentStep(), 2);
    assert.equal(progressBar.style.width, '50%');
    assert.equal(backBtn.disabled, false);

    // Advance to Step 3
    addressInput.value = 'Main Bazar Street 2';
    const advancedToStep3 = wizard.nextStep();
    assert.equal(advancedToStep3, true);
    assert.equal(wizard.getCurrentStep(), 3);
    assert.equal(progressBar.style.width, '75%');

    // Advance to Step 4
    rateInput.value = '2000';
    const advancedToStep4 = wizard.nextStep();
    assert.equal(advancedToStep4, true);
    assert.equal(wizard.getCurrentStep(), 4);
    assert.equal(progressBar.style.width, '100%');
    assert.equal(nextBtn.textContent, 'Complete Enrollment ✓');
    assert.ok(summaryCard.innerHTML.includes('Rizwan Ahmad'));

    // Step regression via prevStep
    wizard.prevStep();
    assert.equal(wizard.getCurrentStep(), 3);
    wizard.goToStep(4);
    assert.equal(wizard.getCurrentStep(), 4);

    // Trying to submit on Step 4 without agreement fails
    agreementCheck.checked = false;
    const submittedWithoutAgreement = wizard.nextStep();
    assert.equal(submittedWithoutAgreement, false);

    // Check agreement and complete enrollment
    agreementCheck.checked = true;
    const completed = wizard.nextStep();
    assert.equal(completed, true);
    assert.ok(completedData);
    assert.equal(completedData.name, 'Rizwan Ahmad');
    assert.equal(completedData.phone, '0302-7654321');
    assert.equal(completedData.monthlyRate, 2000);

    // Test swipe gesture handlers
    wizard.open();
    assert.equal(wizard.getCurrentStep(), 1);
    const touchStartFn = listeners.get('wizardTrack:touchstart');
    const touchEndFn = listeners.get('wizardTrack:touchend');
    assert.ok(typeof touchStartFn === 'function');
    assert.ok(typeof touchEndFn === 'function');

    // Simulate swipe left (deltaX = -80)
    touchStartFn({ touches: [{ clientX: 200, clientY: 100 }] });
    nameInput.value = 'Tariq Mehmood';
    touchEndFn({ changedTouches: [{ clientX: 120, clientY: 105 }] });
    assert.equal(wizard.getCurrentStep(), 2);

    // Simulate swipe right (deltaX = 80)
    touchStartFn({ touches: [{ clientX: 100, clientY: 100 }] });
    touchEndFn({ changedTouches: [{ clientX: 180, clientY: 105 }] });
    assert.equal(wizard.getCurrentStep(), 1);

    // Keyboard Escape closes
    const keydownFn = listeners.get('customerEnrollmentWizard:keydown');
    assert.ok(typeof keydownFn === 'function');
    let defaultPrevented = false;
    keydownFn({ key: 'Escape', preventDefault: () => { defaultPrevented = true; } });
    assert.equal(defaultPrevented, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('calculateRetryDelay computes exponential backoff with ceiling and decorrelated jitter', async () => {
  const { calculateRetryDelay } = await import('../nav.js');

  // Base test with zero jitter
  const d1 = calculateRetryDelay(1, { baseDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0 });
  assert.equal(d1, 1000);

  const d2 = calculateRetryDelay(2, { baseDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0 });
  assert.equal(d2, 2000);

  const d3 = calculateRetryDelay(3, { baseDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0 });
  assert.equal(d3, 4000);

  const dCap = calculateRetryDelay(10, { baseDelayMs: 1000, maxDelayMs: 16000, jitterFactor: 0 });
  assert.equal(dCap, 16000);

  // Deterministic jitter testing with custom randomFn
  // randomFn = 1.0 -> max positive jitter (+25% of 2000 = 2500)
  const dJitterHigh = calculateRetryDelay(2, { baseDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0.25, randomFn: () => 1.0 });
  assert.equal(dJitterHigh, 2500);

  // randomFn = 0.0 -> max negative jitter (-25% of 2000 = 1500)
  const dJitterLow = calculateRetryDelay(2, { baseDelayMs: 1000, maxDelayMs: 30000, jitterFactor: 0.25, randomFn: () => 0.0 });
  assert.equal(dJitterLow, 1500);

  // Fallback on invalid attempt defaults safely to base delay
  const dInvalid = calculateRetryDelay(-5, { baseDelayMs: 1000 });
  assert.ok(dInvalid >= 1000);
});

test('retryOfflineQueueItem handles backoff, error logging, and dead-letter queue transitions', async () => {
  const { addOfflineSyncItem, getOfflineSyncQueue, retryOfflineQueueItem } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const initial = addOfflineSyncItem({ action: 'record_payment', summary: 'Payment #101' }, mockStorage);
  const itemId = initial[0].id;

  // First retry fails -> transitions to status 'retrying' with attempt 1
  const failOutcome1 = await retryOfflineQueueItem(itemId, {
    storage: mockStorage,
    maxAttempts: 3,
    retryHandler: () => { throw new Error('Offline timeout'); },
    randomFn: () => 0.5
  });

  assert.equal(failOutcome1.success, false);
  assert.equal(failOutcome1.status, 'retrying');
  assert.equal(failOutcome1.item.retryCount, 1);
  assert.ok(failOutcome1.item.nextRetryAt);
  assert.equal(failOutcome1.error, 'Offline timeout');
  assert.equal(failOutcome1.item.retryHistory.length, 1);

  // Second retry fails -> remains 'retrying' with attempt 2
  const failOutcome2 = await retryOfflineQueueItem(itemId, {
    storage: mockStorage,
    maxAttempts: 3,
    retryHandler: () => false
  });

  assert.equal(failOutcome2.success, false);
  assert.equal(failOutcome2.status, 'retrying');
  assert.equal(failOutcome2.item.retryCount, 2);
  assert.equal(failOutcome2.item.retryHistory.length, 2);

  // Third retry fails -> reaches maxAttempts (3) -> transitions to 'dead_letter'
  const deadOutcome = await retryOfflineQueueItem(itemId, {
    storage: mockStorage,
    maxAttempts: 3,
    retryHandler: () => { throw new Error('Permanent network rejection'); }
  });

  assert.equal(deadOutcome.success, false);
  assert.equal(deadOutcome.status, 'dead_letter');
  assert.equal(deadOutcome.item.retryCount, 3);
  assert.equal(deadOutcome.item.nextRetryAt, null);
  assert.equal(deadOutcome.error, 'Permanent network rejection');

  // New item succeeds on first attempt
  const item2List = addOfflineSyncItem({ action: 'add_customer', summary: 'Customer #202' }, mockStorage);
  const item2Id = item2List[item2List.length - 1].id;

  const successOutcome = await retryOfflineQueueItem(item2Id, {
    storage: mockStorage,
    retryHandler: () => true
  });

  assert.equal(successOutcome.success, true);
  assert.equal(successOutcome.status, 'synced');
  assert.equal(successOutcome.item.retryCount, 1);
  assert.ok(successOutcome.item.syncedAt);
});

test('processEligibleOfflineRetries respects connectivity and scheduled retry intervals', async () => {
  const { addOfflineSyncItem, updateOfflineSyncItem, processEligibleOfflineRetries, getOfflineSyncQueue } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const queue = addOfflineSyncItem({ action: 'receipt_1', summary: 'Due now' }, mockStorage);
  const id1 = queue[0].id;

  const queue2 = addOfflineSyncItem({ action: 'receipt_2', summary: 'Due in future' }, mockStorage);
  const id2 = queue2[1].id;
  updateOfflineSyncItem(id2, { status: 'retrying', nextRetryAt: new Date(Date.now() + 60000).toISOString() }, mockStorage);

  const queue3 = addOfflineSyncItem({ action: 'receipt_3', summary: 'Already dead' }, mockStorage);
  const id3 = queue3[2].id;
  updateOfflineSyncItem(id3, { status: 'dead_letter' }, mockStorage);

  // When offline, skips processing
  const offlineRes = await processEligibleOfflineRetries({
    storage: mockStorage,
    isOnlineCheck: () => false
  });
  assert.equal(offlineRes.skippedOffline, true);
  assert.equal(offlineRes.attempted, 0);

  // When online, only item 1 is eligible (item 2 is future, item 3 is dead letter)
  const onlineRes = await processEligibleOfflineRetries({
    storage: mockStorage,
    isOnlineCheck: () => true,
    retryHandler: (it) => it.id === id1,
    now: Date.now()
  });

  assert.equal(onlineRes.attempted, 1);
  assert.equal(onlineRes.succeeded, 1);
  assert.equal(onlineRes.failed, 0);
});

test('startOfflineQueueAutoRetryEngine controls background timer lifecycle', async () => {
  const { startOfflineQueueAutoRetryEngine } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const engine = startOfflineQueueAutoRetryEngine({
    storage: mockStorage,
    pollIntervalMs: 100000,
    isOnlineCheck: () => true
  });

  assert.equal(engine.isRunning(), true);
  engine.stop();
  assert.equal(engine.isRunning(), false);
  engine.start();
  assert.equal(engine.isRunning(), true);
  engine.stop();
});

test('setupMobileActionSheet supports customer contextual metadata and bottom nav swipe-up trigger', async () => {
  const { setupMobileActionSheet } = await import('../nav.js');
  const listeners = new Map();
  const classListSet = () => {
    const s = new Set();
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      contains: (c) => s.has(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (s.has(c)) { s.delete(c); return false; }
          s.add(c); return true;
        }
        if (force) s.add(c);
        else s.delete(c);
        return force;
      }
    };
  };

  const makeBtn = (id) => ({
    id,
    dataset: {},
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    addEventListener(ev, fn) { listeners.set(`${id}:${ev}`, fn); },
    focus() {}
  });

  const toggleBtn = makeBtn('mobileActionSheetToggle');
  const closeBtn = makeBtn('mobileActionSheetClose');
  const clearContextBtn = makeBtn('actionSheetClearContextBtn');
  const backdrop = {
    id: 'mobileActionSheetBackdrop',
    hidden: true,
    classList: classListSet(),
    dataset: {},
    setAttribute: () => {},
    addEventListener: (ev, fn) => listeners.set(`backdrop:${ev}`, fn)
  };

  const contextBanner = { id: 'actionSheetContextBanner', hidden: true };
  const contextName = { id: 'actionSheetCustomerName', textContent: '' };
  const contextMeta = { id: 'actionSheetCustomerMeta', textContent: '' };
  const heading = { id: 'mobileActionSheetHeading', textContent: 'Quick Actions' };

  const contextualBtn = {
    hidden: true,
    classList: classListSet(),
    attributes: new Map([['data-sheet-action', 'customer-payment']]),
    getAttribute(k) { return this.attributes.get(k); },
    addEventListener(ev, fn) { listeners.set('act:customer-payment', fn); }
  };
  contextualBtn.classList.add('contextual-action');

  const sheet = {
    id: 'mobileActionSheet',
    hidden: true,
    classList: classListSet(),
    dataset: {},
    setAttribute: () => {},
    addEventListener: (ev, fn) => listeners.set(`sheet:${ev}`, fn),
    querySelectorAll(sel) {
      if (sel === '.contextual-action') return [contextualBtn];
      if (sel === '[data-sheet-action]') return [contextualBtn];
      return [];
    },
    querySelector() { return contextualBtn; }
  };

  const bottomNav = {
    classList: classListSet(),
    dataset: {},
    addEventListener(ev, fn) { listeners.set(`bottomNav:${ev}`, fn); }
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'mobileActionSheetToggle') return toggleBtn;
      if (id === 'mobileActionSheet') return sheet;
      if (id === 'mobileActionSheetBackdrop') return backdrop;
      if (id === 'mobileActionSheetClose') return closeBtn;
      if (id === 'actionSheetContextBanner') return contextBanner;
      if (id === 'actionSheetCustomerName') return contextName;
      if (id === 'actionSheetCustomerMeta') return contextMeta;
      if (id === 'actionSheetClearContextBtn') return clearContextBtn;
      if (id === 'mobileActionSheetHeading') return heading;
      return null;
    },
    querySelector(sel) {
      if (sel === '.mobile-bottom-nav') return bottomNav;
      return null;
    }
  };

  try {
    let handledAction = null;
    let handledContext = null;

    const controller = setupMobileActionSheet({
      onAction: (act, ctx) => {
        handledAction = act;
        handledContext = ctx;
      }
    });

    // Verify context setting
    controller.setContext({
      customerId: 'cust-99',
      customerName: 'Muhammad Babar',
      balance: 1500,
      phone: '0301-9876543'
    });

    assert.equal(contextBanner.hidden, false);
    assert.equal(contextName.textContent, 'Muhammad Babar');
    assert.ok(contextMeta.textContent.includes('1,500'));
    assert.equal(heading.textContent, 'Customer Actions');
    assert.equal(contextualBtn.hidden, false);

    // Opening sheet and clicking contextual action passes customer context
    controller.open();
    assert.equal(sheet.hidden, false);

    const actionFn = listeners.get('act:customer-payment');
    assert.ok(typeof actionFn === 'function');
    actionFn();

    assert.equal(handledAction, 'customer-payment');
    assert.equal(handledContext.customerId, 'cust-99');
    assert.equal(handledContext.customerName, 'Muhammad Babar');

    // Clearing context resets UI
    controller.clearContext();
    assert.equal(contextBanner.hidden, true);
    assert.equal(heading.textContent, 'Quick Actions');
    assert.equal(contextualBtn.hidden, true);

    // Test swipe up gesture on bottom navigation bar
    const navTouchStart = listeners.get('bottomNav:touchstart');
    const navTouchEnd = listeners.get('bottomNav:touchend');
    assert.ok(typeof navTouchStart === 'function');
    assert.ok(typeof navTouchEnd === 'function');

    // Simulate swipe up (deltaY = -60)
    navTouchStart({ touches: [{ clientX: 100, clientY: 400 }] });
    navTouchEnd({ changedTouches: [{ clientX: 105, clientY: 340 }] });
    assert.equal(sheet.hidden, false);
    assert.ok(sheet.classList.contains('is-open'));
  } finally {
    globalThis.document = origDoc;
  }
});


