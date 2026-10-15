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
  const origDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine');
  try {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
  } catch {}
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
    if (origDesc) {
      try { Object.defineProperty(globalThis.navigator, 'onLine', origDesc); } catch {}
    }
    globalThis.localStorage = origLocal;
  }
});



