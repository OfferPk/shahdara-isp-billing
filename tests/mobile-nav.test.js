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
  assert.match(app, /import\s*\{[^}]*setupSwipeNavigation[^}]*\}\s*from\s*'\.\/nav\.js\?v=1\.11\.0'/);
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
    nameInput.value = 'Test Customer 115 Ahmad';
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
    assert.ok(summaryCard.innerHTML.includes('Test Customer 115 Ahmad'));

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
    assert.equal(completedData.name, 'Test Customer 115 Ahmad');
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
      customerName: 'Muhammad Test Customer 52',
      balance: 1500,
      phone: '0301-9876543'
    });

    assert.equal(contextBanner.hidden, false);
    assert.equal(contextName.textContent, 'Muhammad Test Customer 52');
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
    assert.equal(handledContext.customerName, 'Muhammad Test Customer 52');

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

test('updateNavigationBadges computes active customer counts, overdue alert badges, and offline queue badges', async () => {
  const { updateNavigationBadges } = await import('../nav.js');

  const state = {
    customers: [
      { id: 'c1', name: 'Zahid', archived: false, status: 'active', bills: [{ dueAmount: '2000', status: 'pending' }] },
      { id: 'c2', name: 'Kashif', archived: false, status: 'offline', bills: [{ dueAmount: '0', status: 'paid' }] },
      { id: 'c3', name: 'Noman', archived: false, status: 'active', bills: [] },
      { id: 'c4', name: 'Archived User', archived: true, status: 'active', bills: [{ dueAmount: '5000', status: 'pending' }] }
    ],
    expenses: [{ id: 'e1', amount: 500 }],
    inventoryItems: [{ id: 'i1', name: 'Patch Cord' }, { id: 'i2', name: 'ONU' }]
  };

  const badgeEls = new Map();
  function makeBadge() {
    const classes = new Set();
    const attrs = new Map();
    return {
      textContent: '',
      hidden: true,
      classList: {
        toggle(cls, val) { if (val) classes.add(cls); else classes.delete(cls); },
        contains(cls) { return classes.has(cls); }
      },
      setAttribute(k, v) { attrs.set(k, v); },
      getAttribute(k) { return attrs.get(k); }
    };
  }

  const custBadge = makeBadge();
  const collBadge = makeBadge();
  const moreBadge = makeBadge();
  const expBadge = makeBadge();
  const invBadge = makeBadge();

  badgeEls.set('customers', [custBadge]);
  badgeEls.set('collection', [collBadge]);
  badgeEls.set('more', [moreBadge]);
  badgeEls.set('expenses', [expBadge]);
  badgeEls.set('inventory', [invBadge]);

  const origDoc = globalThis.document;
  globalThis.document = {
    querySelectorAll(sel) {
      const match = sel.match(/\[data-nav-badge="([^"]+)"\]/);
      if (match && badgeEls.has(match[1])) return badgeEls.get(match[1]);
      return [];
    }
  };

  try {
    const res = updateNavigationBadges(state, { offlineQueueCount: 3 });

    assert.equal(res.totalCustomers, 3);
    assert.equal(res.overdueCount, 1);
    assert.equal(res.offlineCount, 1);
    assert.equal(res.expensesCount, 1);
    assert.equal(res.inventoryCount, 2);
    assert.equal(res.queueCount, 3);

    assert.equal(custBadge.textContent, '3');
    assert.equal(custBadge.hidden, false);
    assert.equal(collBadge.textContent, '1');
    assert.equal(collBadge.hidden, false);
    assert.equal(collBadge.classList.contains('badge-alert'), true);
    assert.equal(moreBadge.textContent, '3');
    assert.equal(moreBadge.hidden, false);
    assert.equal(moreBadge.classList.contains('badge-alert'), true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('calculateOpticalLinkBudget calculates link loss, Rx power, and diagnostic tiers correctly', async () => {
  const { calculateOpticalLinkBudget } = await import('../nav.js');

  // Baseline standard GPON drop (2.0 km, 1:8 splitter, 4 connectors)
  const base = calculateOpticalLinkBudget({ distanceKm: 2.0, splitterRatio: '1:8' });
  assert.equal(base.distanceKm, 2.0);
  assert.equal(base.splitterRatio, '1:8');
  assert.equal(base.splitterLossDb, 10.5);
  assert.equal(base.fiberLossDb, 0.7);
  assert.equal(base.connectorsLossDb, 1.6);
  assert.equal(base.estRxPowerDbm, -8.3);
  assert.ok(base.linkMarginDb > 0);
  assert.equal(base.diagnosisTier, 'Excellent Optical Signal');
  assert.equal(base.badgeClass, 'status-good');

  // High attenuation link with long distance (8 km) and high-density 1:32 splitter
  const highLoss = calculateOpticalLinkBudget({
    distanceKm: 8.0,
    splitterRatio: '1:32',
    oltTxPowerDbm: 3.0,
    connectorsCount: 6,
    spliceLossDb: 0.5
  });
  assert.equal(highLoss.splitterLossDb, 17.1);
  assert.equal(highLoss.fiberLossDb, 2.8);
  assert.equal(highLoss.connectorsLossDb, 3.0);
  assert.equal(highLoss.estRxPowerDbm, -19.9);
  assert.equal(highLoss.diagnosisTier, 'Excellent Optical Signal');

  // Critical fault condition exceeding ONU sensitivity
  const fault = calculateOpticalLinkBudget({
    distanceKm: 25.0,
    splitterRatio: '1:64',
    oltTxPowerDbm: 2.0,
    connectorsCount: 8,
    spliceLossDb: 0.6
  });
  assert.ok(fault.estRxPowerDbm < -28.0);
  assert.equal(fault.diagnosisTier, 'Critical Attenuation / Link Fault');
  assert.equal(fault.badgeClass, 'status-danger');
});

test('calculateBandwidthThrottle computes CIR floor, throughput and latency ratings', async () => {
  const { calculateBandwidthThrottle } = await import('../nav.js');

  const res15 = calculateBandwidthThrottle({ speedMbps: 15, contentionRatio: 8, simulatedLatencyMs: 12 });
  assert.equal(res15.speedMbps, 15);
  assert.equal(res15.downloadRateKBps, 1920);
  assert.equal(res15.downloadRateMBps, 1.88);
  assert.equal(res15.peakCirMbps, 1.88);
  assert.equal(res15.streams1080p, 3);
  assert.equal(res15.simulatedLatencyMs, 12);
  assert.equal(res15.latencyRating, 'Ultra-Low Latency (Local GPON Gateway)');
  assert.equal(res15.latencyBadge, 'status-good');

  const res50 = calculateBandwidthThrottle({ speedMbps: 50, contentionRatio: 4, simulatedLatencyMs: 42 });
  assert.equal(res50.speedMbps, 50);
  assert.equal(res50.peakCirMbps, 12.5);
  assert.equal(res50.streams4k, 2);
  assert.equal(res50.latencyBadge, 'status-warn');
});

test('generateFieldDiagnosticReportText generates formatted technician report', async () => {
  const { calculateOpticalLinkBudget, calculateBandwidthThrottle, generateFieldDiagnosticReportText } = await import('../nav.js');

  const opt = calculateOpticalLinkBudget({ distanceKm: 2.5, splitterRatio: '1:8' });
  const bw = calculateBandwidthThrottle({ speedMbps: 25, contentionRatio: 8 });
  const text = generateFieldDiagnosticReportText(opt, bw, {
    customerName: 'Sample Technician',
    area: 'Saeed Park Hub'
  });

  assert.ok(text.includes('SHAHDARA ISP - FIELD CONNECTIVITY DIAGNOSTIC REPORT'));
  assert.ok(text.includes('Target: Sample Technician'));
  assert.ok(text.includes('Location: Saeed Park Hub'));
  assert.ok(text.includes('Distance from OLT: 2.5 km'));
  assert.ok(text.includes('Splitter Ratio: 1:8'));
  assert.ok(text.includes('Subscribed Package Speed: 25 Mbps'));
  assert.ok(text.includes('Technician Signature:'));
});

test('setupFieldDiagnosticsModal wires inputs, recalculates on change, handles ping test and clipboard', async () => {
  const { setupFieldDiagnosticsModal } = await import('../nav.js');

  let modalOpened = false;
  let closeCalled = false;
  const inputListeners = new Map();
  const clickListeners = new Map();

  function makeEl(id, val = '') {
    return {
      id,
      value: val,
      textContent: '',
      className: '',
      dataset: {},
      addEventListener: (ev, fn) => { inputListeners.set(`${id}:${ev}`, fn); }
    };
  }

  const modal = {
    id: 'fieldDiagnosticsModal',
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; closeCalled = true; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; closeCalled = true; },
    addEventListener: () => {}
  };

  const openBtn = {
    dataset: { openFieldDiagnostics: 'true' },
    addEventListener: (ev, fn) => { clickListeners.set('open', fn); }
  };
  const closeBtn = {
    id: 'fieldDiagnosticsCloseBtn',
    dataset: {},
    addEventListener: (ev, fn) => { clickListeners.set('close', fn); }
  };
  const copyBtn = {
    id: 'copyFieldDiagnosticReportBtn',
    dataset: {},
    addEventListener: (ev, fn) => { clickListeners.set('copy', fn); }
  };
  const pingBtn = {
    id: 'runPingTestBtn',
    dataset: {},
    addEventListener: (ev, fn) => { clickListeners.set('ping', fn); }
  };

  const distInput = makeEl('diagDistanceInput', '3.5');
  const splitterSelect = makeEl('diagSplitterSelect', '1:8');
  const speedSelect = makeEl('diagSpeedSelect', '25');
  const contentionSelect = makeEl('diagContentionSelect', '8');

  const rxPowerVal = makeEl('diagRxPowerVal');
  const linkMarginVal = makeEl('diagLinkMarginVal');
  const diagStatusBadge = makeEl('diagStatusBadge');
  const diagAdviceText = makeEl('diagAdviceText');
  const maxSpeedVal = makeEl('diagMaxSpeedVal');
  const cirFloorVal = makeEl('diagCirFloorVal');
  const pingVal = makeEl('diagPingVal');
  const pingBadge = makeEl('diagPingBadge');

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'fieldDiagnosticsModal') return modal;
      if (id === 'fieldDiagnosticsCloseBtn') return closeBtn;
      if (id === 'copyFieldDiagnosticReportBtn') return copyBtn;
      if (id === 'runPingTestBtn') return pingBtn;
      if (id === 'diagDistanceInput') return distInput;
      if (id === 'diagSplitterSelect') return splitterSelect;
      if (id === 'diagSpeedSelect') return speedSelect;
      if (id === 'diagContentionSelect') return contentionSelect;
      if (id === 'diagRxPowerVal') return rxPowerVal;
      if (id === 'diagLinkMarginVal') return linkMarginVal;
      if (id === 'diagStatusBadge') return diagStatusBadge;
      if (id === 'diagAdviceText') return diagAdviceText;
      if (id === 'diagMaxSpeedVal') return maxSpeedVal;
      if (id === 'diagCirFloorVal') return cirFloorVal;
      if (id === 'diagPingVal') return pingVal;
      if (id === 'diagPingBadge') return pingBadge;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '[data-open-field-diagnostics]') return [openBtn];
      return [];
    }
  };

  let toasted = null;
  let copied = null;
  const mockClipboard = { writeText: async (t) => { copied = t; } };

  try {
    const diag = setupFieldDiagnosticsModal({
      onToast: (msg) => { toasted = msg; },
      clipboard: mockClipboard
    });

    assert.ok(clickListeners.has('open'));
    clickListeners.get('open')();
    assert.equal(modalOpened, true);

    assert.ok(rxPowerVal.textContent.includes('dBm'));
    assert.ok(linkMarginVal.textContent.includes('dB'));
    assert.ok(maxSpeedVal.textContent.includes('MB/s'));

    // Trigger ping
    clickListeners.get('ping')();
    assert.ok(toasted.includes('Gateway ping test complete'));

    // Trigger copy
    await clickListeners.get('copy')();
    assert.ok(copied.includes('SHAHDARA ISP - FIELD CONNECTIVITY DIAGNOSTIC REPORT'));
    assert.equal(toasted, 'Diagnostic report copied to clipboard!');

    // Close
    clickListeners.get('close')();
    assert.equal(closeCalled, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('updateNavigationBadges calculates overdue and queue metrics with alert styles', async () => {
  const { updateNavigationBadges } = await import('../nav.js');
  const classListSet = () => {
    const s = new Set();
    return {
      add: (c) => s.add(c),
      remove: (c) => s.delete(c),
      toggle: (c, v) => (v ?? !s.has(c)) ? s.add(c) : s.delete(c),
      contains: (c) => s.has(c)
    };
  };

  const createBadgeEl = () => ({
    textContent: '0',
    hidden: true,
    classList: classListSet(),
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    getAttribute(k) { return this.attributes.get(k); }
  });

  const collBadge = createBadgeEl();
  const moreBadge = createBadgeEl();
  const custBadge = createBadgeEl();

  const origDoc = globalThis.document;
  globalThis.document = {
    querySelectorAll(sel) {
      if (sel === '[data-nav-badge="collection"]') return [collBadge];
      if (sel === '[data-nav-badge="more"]') return [moreBadge];
      if (sel === '[data-nav-badge="customers"]') return [custBadge];
      return [];
    }
  };

  try {
    const state = {
      customers: [
        { id: 'c1', status: 'active', bills: [{ dueAmount: 1500, status: 'unpaid' }] },
        { id: 'c2', status: 'offline', bills: [{ dueAmount: 0, status: 'paid' }] },
        { id: 'c3', archived: true, bills: [{ dueAmount: 3000, status: 'unpaid' }] }
      ],
      expenses: [],
      inventoryItems: []
    };

    const res = updateNavigationBadges(state, { offlineQueueCount: 3 });

    assert.equal(res.totalCustomers, 2);
    assert.equal(res.overdueCount, 1);
    assert.equal(res.offlineCount, 1);
    assert.equal(res.queueCount, 3);

    assert.equal(collBadge.textContent, '1');
    assert.equal(collBadge.hidden, false);
    assert.equal(collBadge.classList.contains('badge-alert'), true);

    assert.equal(moreBadge.textContent, '3');
    assert.equal(moreBadge.hidden, false);
    assert.equal(moreBadge.classList.contains('badge-alert'), true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('calculateFieldCollectionRoutes aggregates dues, ranks stops by smart priority, and filters by sector', async () => {
  const { calculateFieldCollectionRoutes } = await import('../nav.js');

  const memoryStore = new Map();
  const mockStorage = {
    getItem: (k) => memoryStore.get(k) || null,
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k)
  };

  const sampleState = {
    customers: [
      {
        id: 'cust-1',
        name: 'Ali Raza',
        username: 'aliraza',
        phone: '03001234567',
        address: 'House 12, Street 3',
        area: 'Main Bazar',
        status: 'active',
        bills: [{ dueAmount: 2000, status: 'unpaid' }]
      },
      {
        id: 'cust-2',
        name: 'Bilal Khan',
        username: 'bilalk',
        phone: '03217654321',
        address: 'Chowk Stop 4',
        area: 'Chowk',
        status: 'offline',
        bills: [{ dueAmount: 1500, status: 'unpaid' }]
      },
      {
        id: 'cust-3',
        name: 'Hamza Tariq',
        username: 'hamzat',
        phone: '03339998877',
        address: 'Main Bazar Block B',
        area: 'Main Bazar',
        status: 'active',
        bills: [{ dueAmount: 4500, status: 'unpaid' }]
      },
      {
        id: 'cust-4',
        name: 'Zero Balance Customer',
        username: 'zerob',
        phone: '03000000000',
        area: 'Main Bazar',
        status: 'active',
        bills: [{ dueAmount: 0, status: 'paid' }]
      },
      {
        id: 'cust-5',
        name: 'Archived Customer',
        username: 'archived',
        archived: true,
        bills: [{ dueAmount: 9000, status: 'unpaid' }]
      }
    ]
  };

  const route = calculateFieldCollectionRoutes(sampleState, { storage: mockStorage, dateStr: '2026-10-16' });
  assert.equal(route.totalStops, 3);
  assert.equal(route.totalDue, 8000);
  assert.equal(route.collectedStops, 0);
  assert.equal(route.collectedAmount, 0);
  assert.equal(route.pendingStops, 3);
  assert.equal(route.pendingAmount, 8000);
  assert.equal(route.completionRate, 0);
  assert.deepEqual(route.allSectors, ['All', 'Chowk', 'Main Bazar']);

  // cust-3 (4500) > cust-2 (1500+2500=4000) > cust-1 (2000)
  assert.equal(route.stops[0].id, 'cust-3');
  assert.equal(route.stops[1].id, 'cust-2');
  assert.equal(route.stops[2].id, 'cust-1');

  assert.equal(route.stops[0].whatsappPhone, '923339998877');
  assert.equal(route.stops[0].phoneUrl, 'tel:03339998877');
  assert.match(route.stops[0].mapsQueryUrl, /google\.com\/maps/);

  const sectorRoute = calculateFieldCollectionRoutes(sampleState, { sector: 'Main Bazar', storage: mockStorage, dateStr: '2026-10-16' });
  assert.equal(sectorRoute.totalStops, 2);
  assert.equal(sectorRoute.totalDue, 6500);

  const searched = calculateFieldCollectionRoutes(sampleState, { query: 'bilal', storage: mockStorage, dateStr: '2026-10-16' });
  assert.equal(searched.totalStops, 1);
  assert.equal(searched.stops[0].id, 'cust-2');
});

test('markRouteStopCollected, getFieldRouteProgress, and clearFieldRouteProgress persist progress and calculate completion metrics', async () => {
  const { calculateFieldCollectionRoutes, markRouteStopCollected, getFieldRouteProgress, clearFieldRouteProgress } = await import('../nav.js');

  const memoryStore = new Map();
  const mockStorage = {
    getItem: (k) => memoryStore.get(k) || null,
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k)
  };

  const sampleState = {
    customers: [
      { id: 'c1', name: 'User 1', bills: [{ dueAmount: 1000, status: 'unpaid' }] },
      { id: 'c2', name: 'User 2', bills: [{ dueAmount: 2000, status: 'unpaid' }] }
    ]
  };

  markRouteStopCollected('c1', true, mockStorage, '2026-10-16');
  const prog = getFieldRouteProgress(mockStorage, '2026-10-16');
  assert.deepEqual(prog.collectedIds, ['c1']);

  const route = calculateFieldCollectionRoutes(sampleState, { storage: mockStorage, dateStr: '2026-10-16' });
  assert.equal(route.totalStops, 2);
  assert.equal(route.collectedStops, 1);
  assert.equal(route.collectedAmount, 1000);
  assert.equal(route.pendingStops, 1);
  assert.equal(route.pendingAmount, 2000);
  assert.equal(route.completionRate, 50);

  markRouteStopCollected('c2', true, mockStorage, '2026-10-16');
  const routeAllDone = calculateFieldCollectionRoutes(sampleState, { storage: mockStorage, dateStr: '2026-10-16' });
  assert.equal(routeAllDone.collectedStops, 2);
  assert.equal(routeAllDone.collectedAmount, 3000);
  assert.equal(routeAllDone.completionRate, 100);

  markRouteStopCollected('c1', false, mockStorage, '2026-10-16');
  const progUnmarked = getFieldRouteProgress(mockStorage, '2026-10-16');
  assert.deepEqual(progUnmarked.collectedIds, ['c2']);

  clearFieldRouteProgress(mockStorage, '2026-10-16');
  const progCleared = getFieldRouteProgress(mockStorage, '2026-10-16');
  assert.deepEqual(progCleared.collectedIds, []);
});

test('generateFieldRouteManifestText formats comprehensive dispatch text for field technicians', async () => {
  const { generateFieldRouteManifestText } = await import('../nav.js');

  const mockRouteData = {
    date: '2026-10-16',
    selectedSector: 'Main Bazar',
    totalDue: 5500,
    totalStops: 2,
    collectedAmount: 2000,
    collectedStops: 1,
    pendingAmount: 3500,
    pendingStops: 1,
    completionRate: 50,
    stops: [
      {
        stopNumber: 1,
        isCollected: true,
        name: 'Zahid Hussain',
        username: 'zahidh',
        totalDue: 2000,
        phone: '03001112233',
        address: 'House 5, Street 2',
        sector: 'Main Bazar'
      },
      {
        stopNumber: 2,
        isCollected: false,
        isOffline: true,
        name: 'Usman Ghani',
        username: 'usmang',
        totalDue: 3500,
        phone: '03214445566',
        address: 'Near Water Tank',
        sector: 'Main Bazar'
      }
    ]
  };

  const text = generateFieldRouteManifestText(mockRouteData);
  assert.match(text, /SHAHDARA FIBER NET - FIELD COLLECTION DISPATCH/);
  assert.match(text, /Date: 2026-10-16 \| 📍 Sector: Main Bazar/);
  assert.match(text, /Target Dues: Rs\. 5,500 \(2 stops\)/);
  assert.match(text, /Recovered: Rs\. 2,000 \(1\/2 stops - 50%\)/);
  assert.match(text, /Pending: Rs\. 3,500 \(1 stops remaining\)/);
  assert.match(text, /1\. ✅ \[COLLECTED\] Zahid Hussain/);
  assert.match(text, /2\. 🔴 \[OFFLINE\] Usman Ghani/);
  assert.match(text, /Due: Rs\. 3,500 \| 📞 03214445566/);
});

test('index.html, nav.css, and app.js wire Technician Field Route Sheet modal and navigation triggers', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  assert.match(indexHtml, /<dialog id="fieldRouteModal" class="modal route-modal"/);
  assert.match(indexHtml, /id="fieldRouteCloseBtn"/);
  assert.match(indexHtml, /id="routeSectorFilter"/);
  assert.match(indexHtml, /id="routeSortFilter"/);
  assert.match(indexHtml, /id="routeSearchInput"/);
  assert.match(indexHtml, /id="fieldRouteStopsList"/);
  assert.match(indexHtml, /id="routeMetricTarget"/);
  assert.match(indexHtml, /id="routeMetricCollected"/);
  assert.match(indexHtml, /id="shareRouteWhatsappBtn"/);
  assert.match(indexHtml, /data-open-field-route/);
  assert.match(indexHtml, /data-mobile-more="field-route"/);
  assert.match(indexHtml, /data-sheet-action="field-route"/);
  assert.match(indexHtml, /data-speed-action="field-route"/);

  assert.match(navCss, /\.route-modal-card/);
  assert.match(navCss, /\.route-metrics-bar/);
  assert.match(navCss, /\.route-metric-pill/);
  assert.match(navCss, /\.route-progress-track/);
  assert.match(navCss, /\.route-card/);
  assert.match(navCss, /\.route-card\.is-collected/);
  assert.match(navCss, /\[data-theme="dark"\] \.route-card/);

  assert.match(appJs, /setupFieldRouteSheet/);
  assert.match(appJs, /fieldRouteSheetController/);
  assert.match(appJs, /onFieldRouteSheet/);
});

test('WORK_ORDER_CATEGORIES and WORK_ORDER_PRIORITIES provide structured metadata for field ops', async () => {
  const { WORK_ORDER_CATEGORIES, WORK_ORDER_PRIORITIES } = await import('../nav.js');

  assert.ok(WORK_ORDER_CATEGORIES.fiber_cut);
  assert.equal(WORK_ORDER_CATEGORIES.fiber_cut.label, 'Red LOS / Fiber Break');
  assert.equal(WORK_ORDER_CATEGORIES.fiber_cut.defaultPriority, 'urgent');

  assert.ok(WORK_ORDER_CATEGORIES.low_signal);
  assert.ok(WORK_ORDER_CATEGORIES.ont_fault);
  assert.ok(WORK_ORDER_CATEGORIES.wifi_config);
  assert.ok(WORK_ORDER_CATEGORIES.new_install);

  assert.equal(WORK_ORDER_PRIORITIES.urgent.weight, 4);
  assert.equal(WORK_ORDER_PRIORITIES.high.weight, 3);
  assert.equal(WORK_ORDER_PRIORITIES.normal.weight, 2);
  assert.equal(WORK_ORDER_PRIORITIES.low.weight, 1);
});

test('getFieldWorkOrders, saveFieldWorkOrders, and clearFieldWorkOrders manage localStorage persistence', async () => {
  const { getFieldWorkOrders, saveFieldWorkOrders, clearFieldWorkOrders } = await import('../nav.js');

  const store = new Map();
  const mockStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  assert.deepEqual(getFieldWorkOrders(mockStorage), []);

  const sample = [{ id: 'WO-1234', customerName: 'Ali Khan', status: 'open' }];
  saveFieldWorkOrders(sample, mockStorage);
  assert.deepEqual(getFieldWorkOrders(mockStorage), sample);

  store.set('shahdara_field_work_orders_v1', 'invalid-json');
  assert.deepEqual(getFieldWorkOrders(mockStorage), []);

  saveFieldWorkOrders(sample, mockStorage);
  clearFieldWorkOrders(mockStorage);
  assert.deepEqual(getFieldWorkOrders(mockStorage), []);
});

test('createFieldWorkOrder and updateFieldWorkOrderStatus create, track, and resolve tickets', async () => {
  const { createFieldWorkOrder, updateFieldWorkOrderStatus, getFieldWorkOrders } = await import('../nav.js');

  const store = new Map();
  const mockStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  const created = createFieldWorkOrder({
    customerId: 'c101',
    customerName: 'Muhammad Tariq',
    username: 'tariqm',
    phone: '03001234567',
    area: 'Main Bazar',
    address: 'Near Jamia Masjid',
    category: 'fiber_cut',
    priority: 'urgent',
    assignedTech: 'Naveed Splicer',
    notes: 'Fiber cut by municipal road excavation'
  }, mockStorage, '2026-10-16T08:30:00Z');

  assert.ok(created.id.startsWith('WO-261016-'));
  assert.equal(created.customerName, 'Muhammad Tariq');
  assert.equal(created.category, 'fiber_cut');
  assert.equal(created.priority, 'urgent');
  assert.equal(created.status, 'open');
  assert.equal(created.history.length, 1);

  const updated = updateFieldWorkOrderStatus(created.id, 'in_progress', 'Technician arrived on site with OTDR meter', mockStorage, '2026-10-16T08:45:00Z');
  assert.equal(updated.status, 'in_progress');
  assert.equal(updated.history.length, 2);

  const resolved = updateFieldWorkOrderStatus(created.id, 'resolved', 'Fusion splice done. Power -18.5 dBm.', mockStorage, '2026-10-16T09:15:00Z');
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.resolvedAt, '2026-10-16T09:15:00Z');
  assert.equal(resolved.resolutionNotes, 'Fusion splice done. Power -18.5 dBm.');

  const stored = getFieldWorkOrders(mockStorage);
  assert.equal(stored[0].status, 'resolved');
});

test('calculateFieldWorkOrders synthesizes auto tickets for offline subscribers and calculates metrics', async () => {
  const { calculateFieldWorkOrders } = await import('../nav.js');

  const mockState = {
    customers: [
      { id: 'c1', name: 'Zahid Iqbal', username: 'zahid_iq', phone: '03009991122', area: 'Chowk Shahdara', status: 'active', archived: false },
      { id: 'c2', name: 'Sample Engineer', username: 'Test Customer 52_a', phone: '03218882233', area: 'Main Bazar', address: 'Street 4', status: 'offline', archived: false },
      { id: 'c3', name: 'Old User', username: 'old_u', phone: '03337773344', area: 'Main Bazar', status: 'offline', archived: true }
    ]
  };

  const store = new Map();
  const mockStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  const result = calculateFieldWorkOrders(mockState, { storage: mockStorage, nowStr: '2026-10-16' });
  assert.equal(result.totalOrders, 1);
  assert.equal(result.openOrders, 1);
  assert.equal(result.urgentCount, 1);
  assert.equal(result.orders.length, 1);

  const autoOrder = result.orders[0];
  assert.equal(autoOrder.customerId, 'c2');
  assert.equal(autoOrder.customerName, 'Sample Engineer');
  assert.equal(autoOrder.isAutoGenerated, true);
  assert.equal(autoOrder.priority, 'urgent');
  assert.ok(autoOrder.phoneUrl.includes('03218882233') || autoOrder.phoneUrl.includes('923218882233'));
  assert.ok(autoOrder.whatsappUrl.includes('wa.me/923218882233'));
  assert.ok(autoOrder.mapsQueryUrl.includes('google.com/maps'));

  const chowkResult = calculateFieldWorkOrders(mockState, { sector: 'Chowk Shahdara', storage: mockStorage });
  assert.equal(chowkResult.orders.length, 0);

  const mainBazarResult = calculateFieldWorkOrders(mockState, { sector: 'Main Bazar', storage: mockStorage });
  assert.equal(mainBazarResult.orders.length, 1);
});

test('generateWorkOrderManifestText formats clean dispatch manifest for field staff', async () => {
  const { generateWorkOrderManifestText } = await import('../nav.js');

  const mockWoData = {
    date: '2026-10-16',
    selectedSector: 'Main Bazar',
    openOrders: 2,
    inProgressOrders: 1,
    urgentCount: 1,
    resolvedCount: 1,
    resolutionRate: 25,
    orders: [
      {
        id: 'WO-261016-1234',
        customerName: 'Khurram Shehzad',
        username: 'khurrams',
        area: 'Main Bazar',
        address: 'Shop 12, Main Road',
        phone: '03001234567',
        categoryLabel: 'Red LOS / Fiber Break',
        priority: 'urgent',
        status: 'open',
        assignedTech: 'Naveed Splicer',
        notes: 'Red LOS blinking on Huawei ONT'
      }
    ]
  };

  const text = generateWorkOrderManifestText(mockWoData);
  assert.match(text, /SHAHDARA FIBER NET — FIELD WORK ORDER MANIFEST/);
  assert.match(text, /Date: 2026-10-16 \| 📍 Sector: Main Bazar/);
  assert.match(text, /Summary: 2 Open, 1 In Progress, 1 Urgent, 1 Resolved/);
  assert.match(text, /1\. 🔴 \[URGENT\] \*#WO-261016-1234\* — Red LOS \/ Fiber Break/);
  assert.match(text, /Khurram Shehzad \(@khurrams\)/);
  assert.match(text, /📞 03001234567/);
  assert.match(text, /Assigned: Naveed Splicer/);
  assert.match(text, /Confirm fiber fusion splice optical power/);
});

test('index.html, nav.css, and app.js wire Field Work Orders modal and navigation triggers', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  assert.match(indexHtml, /<dialog id="fieldWorkOrderModal" class="modal work-order-modal"/);
  assert.match(indexHtml, /id="fieldWorkOrderCloseBtn"/);
  assert.match(indexHtml, /id="woSectorFilter"/);
  assert.match(indexHtml, /id="woStatusFilter"/);
  assert.match(indexHtml, /id="woPriorityFilter"/);
  assert.match(indexHtml, /id="woSearchInput"/);
  assert.match(indexHtml, /id="fieldWorkOrderList"/);
  assert.match(indexHtml, /id="woNewTicketPanel"/);
  assert.match(indexHtml, /id="woSubmitTicketBtn"/);
  assert.match(indexHtml, /id="copyWorkOrderManifestBtn"/);
  assert.match(indexHtml, /id="shareWorkOrderWhatsappBtn"/);

  assert.match(indexHtml, /data-open-work-orders/);
  assert.match(indexHtml, /data-mobile-more="work-orders"/);
  assert.match(indexHtml, /data-sheet-action="work-orders"/);
  assert.match(indexHtml, /data-speed-action="work-orders"/);
  assert.match(indexHtml, /data-nav-badge="work-orders"/);

  assert.match(navCss, /\.work-order-modal-card/);
  assert.match(navCss, /\.work-order-metrics-bar/);
  assert.match(navCss, /\.work-order-metric-pill/);
  assert.match(navCss, /\.work-order-card/);
  assert.match(navCss, /\.work-order-card\.is-urgent/);
  assert.match(navCss, /\.work-order-new-panel/);
  assert.match(navCss, /\[data-theme="dark"\] \.work-order-card/);

  assert.match(appJs, /setupFieldWorkOrderSheet/);
  assert.match(appJs, /fieldWorkOrderSheetController/);
});

test('Mobile offline sync conflict storage and lifecycle management', async () => {
  const {
    getSyncConflicts,
    saveSyncConflicts,
    recordSyncConflict,
    resolveSyncConflict,
    clearSyncConflicts
  } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  // Initially empty
  assert.deepEqual(getSyncConflicts(mockStorage), []);

  // Record a conflict
  const c1 = recordSyncConflict({
    type: 'payment_duplicate',
    customerId: 'seed-001',
    customerName: 'Muhammad Ali',
    title: 'Duplicate Payment Offline Submission',
    disputedPkr: 1500,
    severity: 'critical'
  }, mockStorage);

  assert.ok(c1.id);
  assert.equal(c1.status, 'pending');
  assert.equal(getSyncConflicts(mockStorage).length, 1);

  // Update existing conflict
  const c1Updated = recordSyncConflict({
    id: c1.id,
    notes: 'Investigated by owner'
  }, mockStorage);
  assert.equal(c1Updated.notes, 'Investigated by owner');
  assert.equal(getSyncConflicts(mockStorage).length, 1);

  // Resolve conflict
  const resolved = resolveSyncConflict(c1.id, 'smart_merge', mockStorage, {
    resolvedBy: 'Hafiz',
    resolutionNote: 'Merged partial offline credit'
  });
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.resolutionStrategy, 'smart_merge');
  assert.equal(resolved.resolvedBy, 'Hafiz');

  // Clear conflicts
  clearSyncConflicts(mockStorage);
  assert.deepEqual(getSyncConflicts(mockStorage), []);
});

test('detectSyncConflicts identifies ledger payment clashes, overpayments, and profile drift', async () => {
  const { detectSyncConflicts } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const sampleState = {
    customers: [
      {
        id: 'cust-101',
        customerNumber: 101,
        name: 'Usman Farooq',
        mohalla: 'Main Bazar',
        phone: '03001234567',
        bills: [
          { month: '2026-10', dueAmount: 1800, paidAmount: 1800, status: 'paid' }
        ]
      },
      {
        id: 'cust-102',
        customerNumber: 102,
        name: 'Zahid Mehmood',
        mohalla: 'Chowk Shahdara',
        phone: '03219876543',
        bills: [
          { month: '2026-10', dueAmount: 1500, paidAmount: 0, status: 'unpaid' }
        ]
      }
    ]
  };

  // Add offline queue items creating conflicts:
  // 1. Payment submission on already paid bill
  // 2. Overpayment of 3500 on 1500 bill
  // 3. Profile edit with different phone and mohalla
  const offlineQueue = [
    {
      id: 'q-1',
      action: 'record_payment',
      customerId: 'cust-101',
      month: '2026-10',
      amount: 1800,
      timestamp: '2026-10-16T08:30:00Z'
    },
    {
      id: 'q-2',
      action: 'record_payment',
      customerId: 'cust-102',
      month: '2026-10',
      amount: 3500,
      timestamp: '2026-10-16T08:45:00Z'
    },
    {
      id: 'q-3',
      action: 'update_customer',
      customerId: 'cust-101',
      phone: '03009998877',
      mohalla: 'New Ravi Bridge',
      timestamp: '2026-10-16T09:00:00Z'
    }
  ];
  mockStorage.setItem('shahdara_offline_payment_queue', JSON.stringify(offlineQueue));

  const result = detectSyncConflicts(sampleState, { storage: mockStorage });
  assert.ok(result.conflicts.length >= 3);
  assert.ok(result.summary.totalCount >= 3);
  assert.ok(result.summary.totalDisputedPkr >= 3800);
  assert.ok(result.summary.criticalCount >= 1);

  // Test filter by critical
  const criticalOnly = detectSyncConflicts(sampleState, { storage: mockStorage, filter: 'critical' });
  assert.ok(criticalOnly.conflicts.every(c => c.severity === 'critical'));

  // Test filter by query
  const queryFiltered = detectSyncConflicts(sampleState, { storage: mockStorage, query: 'Zahid' });
  assert.equal(queryFiltered.conflicts.length, 1);
  assert.equal(queryFiltered.conflicts[0].customerName, 'Zahid Mehmood');
});

test('autoResolveSafeConflicts safely resolves low-risk profile update sync items', async () => {
  const { autoResolveSafeConflicts, getSyncConflicts } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const sampleState = {
    customers: [
      {
        id: 'cust-safe-1',
        customerNumber: 201,
        name: 'Tariq Butt',
        phone: '', // Empty local phone -> safe to merge incoming
        mohalla: 'Saeed Park',
        bills: []
      }
    ]
  };

  const offlineQueue = [
    {
      id: 'q-safe-1',
      action: 'update_customer',
      customerId: 'cust-safe-1',
      phone: '03125556677'
    }
  ];
  mockStorage.setItem('shahdara_offline_payment_queue', JSON.stringify(offlineQueue));

  const count = autoResolveSafeConflicts(sampleState, mockStorage);
  assert.equal(count, 1);

  const stored = getSyncConflicts(mockStorage);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, 'resolved');
  assert.equal(stored[0].resolutionStrategy, 'accept_incoming');
});

test('generateSyncConflictReport creates structured audit text for Shahdara ledger', async () => {
  const { generateSyncConflictReport } = await import('../nav.js');

  const mockConflictData = {
    summary: {
      totalCount: 2,
      criticalCount: 1,
      warningCount: 1,
      totalDisputedPkr: 4500,
      resolvedCount: 0,
      resolutionRate: 0
    },
    conflicts: [
      {
        id: 'CONF-01',
        customerName: 'Khurram Shehzad',
        area: 'Main Bazar',
        title: 'Duplicate Payment Collection',
        severity: 'critical',
        disputedPkr: 2000,
        suggestedAction: 'Keep local settled record',
        diff: {
          local: { status: 'paid', paidPkr: 2000 },
          incoming: { status: 'offline_submission', amountPkr: 2000 }
        }
      }
    ]
  };

  const report = generateSyncConflictReport(mockConflictData);
  assert.match(report, /SHAHDARA ISP — OFFLINE SYNC CONFLICT & RECONCILIATION AUDIT/);
  assert.match(report, /Pending Conflicts: 2 \(1 Critical Duplicates\)/);
  assert.match(report, /#CONF-01/);
  assert.match(report, /Khurram Shehzad/);
  assert.match(report, /CRITICAL/);
  assert.match(report, /Suggested Action: Keep local settled record/);
});

test('setupSyncConflictModal wires interactive modal controls, filters, and resolution triggers', async () => {
  const { setupSyncConflictModal } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  let modalOpened = false;
  let modalClosed = false;
  const modalEl = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  };

  const countPill = { textContent: '' };
  const disputedPill = { textContent: '' };
  const criticalPill = { textContent: '' };
  const ratePill = { textContent: '' };
  const listContainer = { innerHTML: '', querySelectorAll: () => [] };
  const searchInput = { value: '', addEventListener: () => {}, dataset: {} };
  const autoResolveBtn = { addEventListener: () => {}, dataset: {} };
  const copyReportBtn = { addEventListener: () => {}, dataset: {} };
  const closeBtn = { addEventListener: () => {}, dataset: {} };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'syncConflictModal') return modalEl;
      if (id === 'syncConflictCloseBtn') return closeBtn;
      if (id === 'conflictSearchInput') return searchInput;
      if (id === 'syncConflictList') return listContainer;
      if (id === 'conflictTotalCountVal') return countPill;
      if (id === 'conflictDisputedPkrVal') return disputedPill;
      if (id === 'conflictCriticalCountVal') return criticalPill;
      if (id === 'conflictResolutionRateVal') return ratePill;
      if (id === 'autoResolveSafeConflictsBtn') return autoResolveBtn;
      if (id === 'copySyncConflictReportBtn') return copyReportBtn;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '[data-open-sync-conflicts]') return [];
      if (sel === '[data-conflict-filter]') return [];
      if (sel.includes('[data-nav-badge=')) return [];
      return [];
    }
  };

  try {
    const controller = setupSyncConflictModal({
      getState: () => ({ customers: [] }),
      storage: mockStorage
    });

    assert.ok(controller);
    assert.equal(typeof controller.recalculate, 'function');
    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');

    controller.open();
    assert.equal(modalOpened, true);

    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html, nav.css, and app.js wire Mobile Offline Sync Conflict Resolver completely', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  // index.html checks
  assert.match(indexHtml, /<dialog id="syncConflictModal" class="modal sync-conflict-modal"/);
  assert.match(indexHtml, /id="syncConflictCloseBtn"/);
  assert.match(indexHtml, /id="conflictTotalCountVal"/);
  assert.match(indexHtml, /id="conflictDisputedPkrVal"/);
  assert.match(indexHtml, /id="conflictCriticalCountVal"/);
  assert.match(indexHtml, /id="conflictResolutionRateVal"/);
  assert.match(indexHtml, /id="conflictSearchInput"/);
  assert.match(indexHtml, /id="syncConflictList"/);
  assert.match(indexHtml, /id="autoResolveSafeConflictsBtn"/);
  assert.match(indexHtml, /id="copySyncConflictReportBtn"/);

  assert.match(indexHtml, /data-open-sync-conflicts/);
  assert.match(indexHtml, /data-mobile-more="sync-conflicts"/);
  assert.match(indexHtml, /data-sheet-action="sync-conflicts"/);
  assert.match(indexHtml, /data-speed-action="sync-conflicts"/);
  assert.match(indexHtml, /data-nav-badge="sync-conflicts"/);

  // nav.css checks
  assert.match(navCss, /\.sync-conflict-modal-card/);
  assert.match(navCss, /\.conflict-metrics-bar/);
  assert.match(navCss, /\.conflict-metric-pill/);
  assert.match(navCss, /\.conflict-card/);
  assert.match(navCss, /\.conflict-card\.is-critical/);
  assert.match(navCss, /\.conflict-diff-grid/);
  assert.match(navCss, /\.btn-conflict-action/);
  assert.match(navCss, /\[data-theme="dark"\] \.conflict-card/);

  // app.js checks
  assert.match(appJs, /setupSyncConflictModal/);
  assert.match(appJs, /syncConflictModalController/);
});

test('calculateOpticalSignalMapMetrics calculates optical attenuation, power levels, and classifies node status', async () => {
  const { calculateOpticalSignalMapMetrics, SHAHDARA_OPTICAL_NODES } = await import('../nav.js');

  const mockState = {
    customers: [
      { id: 'c1', name: 'Zahid', area: 'Vandala Road', serviceStatus: 'active', monthlyRate: 2000 },
      { id: 'c2', name: 'Farhan', area: 'Saeed Park', serviceStatus: 'active', monthlyRate: 1500 },
      { id: 'c3', name: 'Tariq', area: 'Jia Musa', serviceStatus: 'offline', monthlyRate: 1800 },
      { id: 'c4', name: 'Bilal', area: 'Shahdara Town', serviceStatus: 'active', monthlyRate: 2500 }
    ]
  };

  const metrics = calculateOpticalSignalMapMetrics(mockState);
  assert.ok(metrics);
  assert.equal(metrics.totalNodes, SHAHDARA_OPTICAL_NODES.length);
  assert.equal(metrics.nodes.length, 6);
  assert.ok(metrics.averageLossDb > 0);
  assert.ok(metrics.averageRxDbm < 0);

  const wandalaNode = metrics.nodes.find(n => n.id === 'fdh-wandala-01');
  assert.ok(wandalaNode);
  assert.equal(wandalaNode.code, 'FDH-WND-01');
  assert.equal(wandalaNode.totalConnectedCustomers, 1);
  assert.equal(wandalaNode.activeSubscribers, 1);
  assert.ok(wandalaNode.measuredLossDb > 0);
  assert.ok(wandalaNode.measuredRxDbm < 0);
  assert.ok(['optimal', 'warning', 'critical'].includes(wandalaNode.statusTier));

  // Verify status counts match
  const sumCounts = metrics.optimalNodesCount + metrics.warningNodesCount + metrics.criticalNodesCount;
  assert.equal(sumCounts, metrics.totalNodes);
});

test('recordOpticalMeasurement stores and retrieves measurements in storage', async () => {
  const { recordOpticalMeasurement, getOpticalMeasurements, clearOpticalMeasurements } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  clearOpticalMeasurements(mockStorage);
  assert.deepEqual(getOpticalMeasurements(mockStorage), {});

  recordOpticalMeasurement('fdh-wandala-01', -21.4, mockStorage);
  let saved = getOpticalMeasurements(mockStorage);
  assert.ok(saved['fdh-wandala-01']);
  assert.equal(saved['fdh-wandala-01'].rxDbm, -21.4);

  recordOpticalMeasurement('fdh-saeedpark-02', -25.8, mockStorage);
  saved = getOpticalMeasurements(mockStorage);
  assert.equal(saved['fdh-saeedpark-02'].rxDbm, -25.8);

  clearOpticalMeasurements(mockStorage);
  assert.deepEqual(getOpticalMeasurements(mockStorage), {});
});

test('renderOpticalSignalMapSvg produces valid SVG topology diagram with nodes and links', async () => {
  const { calculateOpticalSignalMapMetrics, renderOpticalSignalMapSvg } = await import('../nav.js');

  const mockState = { customers: [] };
  const metrics = calculateOpticalSignalMapMetrics(mockState);

  const svg = renderOpticalSignalMapSvg(metrics, 'fdh-wandala-01');
  assert.match(svg, /<svg viewBox="0 0 660 320"/);
  assert.match(svg, /Central OLT/);
  assert.match(svg, /fdh-wandala-01/);
  assert.match(svg, /FDH-WND-01/);
  assert.match(svg, /FAT-BK-06/);
});

test('generateOpticalSignalMapReport generates markdown WhatsApp dispatch report', async () => {
  const { calculateOpticalSignalMapMetrics, generateOpticalSignalMapReport } = await import('../nav.js');

  const mockState = {
    customers: [
      { id: 'c1', name: 'Zahid', area: 'Vandala Road', serviceStatus: 'active', monthlyRate: 2000 }
    ]
  };
  const metrics = calculateOpticalSignalMapMetrics(mockState);
  const report = generateOpticalSignalMapReport(metrics);

  assert.match(report, /SHAHDARA ISP OSP FIELD BRIEFING: OPTICAL SIGNAL LOSS MAP & SPLITTER HEALTH/);
  assert.match(report, /FDH-01 Wandala Chowk Optical Hub/);
  assert.match(report, /dBm/);
  assert.match(report, /PRIORITY FIELD DISPATCH ACTIONS/);
});

test('setupOpticalSignalMapModal wires interactive modal controls and reading logging', async () => {
  const { setupOpticalSignalMapModal } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  let modalOpened = false;
  let modalClosed = false;
  const modalEl = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  };

  const kpiTotalNodes = { textContent: '' };
  const kpiAvgLoss = { textContent: '' };
  const kpiCriticalNodes = { textContent: '' };
  const kpiRevenueRisk = { textContent: '' };
  const svgContainer = { innerHTML: '', addEventListener: () => {}, querySelectorAll: () => [] };
  const inspectorPanel = {};
  const inspectorTitle = { textContent: '' };
  const inspectorSpecs = { textContent: '' };
  const inspectorRx = { textContent: '' };
  const inspectorLoss = { textContent: '' };
  const inspectorStatusBadge = { textContent: '', className: '' };
  const inspectorCustomersList = { innerHTML: '', querySelectorAll: () => [] };
  const simReadingInput = { value: '', dataset: {} };
  const simReadingBtn = { addEventListener: () => {}, dataset: {} };
  const resetReadingsBtn = { addEventListener: () => {}, dataset: {} };
  const searchInput = { value: '', addEventListener: () => {}, dataset: {} };
  const copyReportBtn = { addEventListener: () => {}, dataset: {} };
  const closeBtn = { addEventListener: () => {}, dataset: {} };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'opticalSignalMapModal') return modalEl;
      if (id === 'opticalSignalMapCloseBtn') return closeBtn;
      if (id === 'opticalSignalMapCopyReportBtn') return copyReportBtn;
      if (id === 'opticalSignalMapSearchInput') return searchInput;
      if (id === 'opticalSignalMapSvgContainer') return svgContainer;
      if (id === 'opticalKpiTotalNodes') return kpiTotalNodes;
      if (id === 'opticalKpiAvgLoss') return kpiAvgLoss;
      if (id === 'opticalKpiCriticalNodes') return kpiCriticalNodes;
      if (id === 'opticalKpiRevenueRisk') return kpiRevenueRisk;
      if (id === 'opticalNodeInspectorPanel') return inspectorPanel;
      if (id === 'opticalInspectorTitle') return inspectorTitle;
      if (id === 'opticalInspectorSpecs') return inspectorSpecs;
      if (id === 'opticalInspectorRx') return inspectorRx;
      if (id === 'opticalInspectorLoss') return inspectorLoss;
      if (id === 'opticalInspectorStatusBadge') return inspectorStatusBadge;
      if (id === 'opticalInspectorCustomersList') return inspectorCustomersList;
      if (id === 'opticalSimReadingInput') return simReadingInput;
      if (id === 'opticalSimReadingBtn') return simReadingBtn;
      if (id === 'opticalResetReadingsBtn') return resetReadingsBtn;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel.includes('[data-open-optical-map]')) return [];
      if (sel === '[data-optical-filter]') return [];
      if (sel.includes('[data-nav-badge=')) return [];
      return [];
    }
  };

  try {
    const controller = setupOpticalSignalMapModal({
      getState: () => ({ customers: [] }),
      storage: mockStorage
    });

    assert.ok(controller);
    assert.equal(typeof controller.recalculate, 'function');
    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');
    assert.equal(typeof controller.setState, 'function');

    controller.open();
    assert.equal(modalOpened, true);

    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html, nav.css, and app.js wire Optical Signal Map completely', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  // index.html checks
  assert.match(indexHtml, /<dialog id="opticalSignalMapModal" class="modal optical-map-modal"/);
  assert.match(indexHtml, /id="opticalSignalMapCloseBtn"/);
  assert.match(indexHtml, /id="opticalKpiTotalNodes"/);
  assert.match(indexHtml, /id="opticalKpiAvgLoss"/);
  assert.match(indexHtml, /id="opticalKpiCriticalNodes"/);
  assert.match(indexHtml, /id="opticalKpiRevenueRisk"/);
  assert.match(indexHtml, /id="opticalSignalMapSearchInput"/);
  assert.match(indexHtml, /id="opticalSignalMapSvgContainer"/);
  assert.match(indexHtml, /id="opticalNodeInspectorPanel"/);
  assert.match(indexHtml, /id="opticalSimReadingInput"/);
  assert.match(indexHtml, /id="opticalSimReadingBtn"/);
  assert.match(indexHtml, /id="opticalResetReadingsBtn"/);
  assert.match(indexHtml, /id="opticalInspectorCustomersList"/);
  assert.match(indexHtml, /id="opticalSignalMapCopyReportBtn"/);

  assert.match(indexHtml, /data-open-optical-map/);
  assert.match(indexHtml, /data-mobile-more="optical-map"/);
  assert.match(indexHtml, /data-sheet-action="optical-map"/);
  assert.match(indexHtml, /data-speed-action="optical-map"/);

  // nav.css checks
  assert.match(navCss, /\.optical-map-modal-card/);
  assert.match(navCss, /\.optical-map-canvas-wrap/);
  assert.match(navCss, /\.optical-map-svg/);
  assert.match(navCss, /\.optical-inspector-panel/);
  assert.match(navCss, /\.optical-inspector-stat-pill/);
  assert.match(navCss, /\.optical-inspector-sim-box/);
  assert.match(navCss, /\.optical-customers-roster/);

  // app.js checks
  assert.match(appJs, /setupOpticalSignalMapModal/);
  assert.match(appJs, /opticalSignalMapModalController/);
});

test('getVehicleInventoryStore and saveVehicleInventoryStore handle local storage persistence', async () => {
  const { getVehicleInventoryStore, saveVehicleInventoryStore } = await import('../nav.js');
  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); }
  };

  const initial = getVehicleInventoryStore(mockStorage);
  assert.deepEqual(initial.transfers, []);
  assert.deepEqual(initial.vehicleStockOverrides, {});

  const updated = {
    transfers: [{ id: 'tx-1', itemId: 'onu-gpon', quantity: 2 }],
    vehicleStockOverrides: { 'van-01_onu-gpon': 8 }
  };
  const saved = saveVehicleInventoryStore(updated, mockStorage);
  assert.equal(saved, true);

  const reloaded = getVehicleInventoryStore(mockStorage);
  assert.equal(reloaded.transfers.length, 1);
  assert.equal(reloaded.vehicleStockOverrides['van-01_onu-gpon'], 8);
});

test('recordVehicleTransfer correctly modifies inventory balances and audit log', async () => {
  const { recordVehicleTransfer, calculateVehicleStock } = await import('../nav.js');
  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); }
  };

  // Base quantity for van-01 for onu-gpon is 6
  const stockBefore = calculateVehicleStock({}, 'van-01', mockStorage);
  const gponBefore = stockBefore.stockRows.find(r => r.hardware.id === 'onu-gpon').onHand;
  assert.equal(gponBefore, 6);

  // Transfer 2 units from van-01 to van-02
  const transfer = recordVehicleTransfer({
    sourceVehicleId: 'van-01',
    destVehicleId: 'van-02',
    itemId: 'onu-gpon',
    quantity: 2,
    transferNote: 'Emergency replacement',
    authorizedBy: 'Lead Tech Ali'
  }, mockStorage);

  assert.ok(transfer.id.startsWith('txf-'));
  assert.equal(transfer.quantity, 2);
  assert.equal(transfer.transferNote, 'Emergency replacement');

  const van1After = calculateVehicleStock({}, 'van-01', mockStorage);
  const van2After = calculateVehicleStock({}, 'van-02', mockStorage);

  const gponVan1 = van1After.stockRows.find(r => r.hardware.id === 'onu-gpon').onHand;
  const gponVan2 = van2After.stockRows.find(r => r.hardware.id === 'onu-gpon').onHand;

  assert.equal(gponVan1, 4);
  assert.equal(gponVan2, 8);
});

test('calculateVehicleStock flags depleted and low-stock items correctly', async () => {
  const { calculateVehicleStock, recordVehicleTransfer } = await import('../nav.js');
  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); }
  };

  // Transfer all 10 GPON ONUs away from van-01
  recordVehicleTransfer({
    sourceVehicleId: 'van-01',
    destVehicleId: 'van-04',
    itemId: 'onu-gpon',
    quantity: 10
  }, mockStorage);

  const stock = calculateVehicleStock({}, 'van-01', mockStorage);
  assert.equal(stock.vehicleStatus, 'depleted');
  assert.equal(stock.badgeClass, 'badge-danger');
  assert.ok(stock.depletedCount >= 1);

  const depletedRow = stock.stockRows.find(r => r.hardware.id === 'onu-gpon');
  assert.equal(depletedRow.onHand, 0);
  assert.equal(depletedRow.itemStatus, 'depleted');
});

test('renderVehicleInventorySvg renders SVG cargo rack visualization', async () => {
  const { renderVehicleInventorySvg, calculateVehicleStock } = await import('../nav.js');
  const summary = calculateVehicleStock({}, 'van-01');
  const svg = renderVehicleInventorySvg(summary);

  assert.match(svg, /<svg class="chart-svg van-inventory-svg"/);
  assert.match(svg, /Technician Vehicle Cargo Bay Inventory Rack Visualizer/);
  assert.match(svg, /Van 1 - Tariq Fiber Splicing Unit/);
  assert.match(svg, /van-shelf-bin/);
});

test('generateVehicleTransferReceipt formats WhatsApp receipt text', async () => {
  const { generateVehicleTransferReceipt } = await import('../nav.js');
  const transfer = {
    id: 'txf-test1234',
    timestamp: '2026-10-16T12:00:00Z',
    sourceVehicleId: 'warehouse',
    destVehicleId: 'van-01',
    itemId: 'drop-cable-roll',
    quantity: 2,
    transferNote: 'Morning sector dispatch',
    authorizedBy: 'Shahdara Dispatch Hub'
  };

  const receipt = generateVehicleTransferReceipt(transfer);
  assert.match(receipt, /SHAHDARA ISP FIELD STOCK TRANSFER RECEIPT & CUSTODY SLIP/);
  assert.match(receipt, /\[txf-test1234\]/);
  assert.match(receipt, /Central Shahdara Base Depot/);
  assert.match(receipt, /Van 1 - Tariq Fiber Splicing Unit/);
  assert.match(receipt, /1-Core FTTH Drop Cable/);
  assert.match(receipt, /2 meters/);
  assert.match(receipt, /Morning sector dispatch/);
  assert.match(receipt, /Shahdara Dispatch Hub/);
});

test('setupVehicleTransferModal wires controls, quick qty, submit, and copy slip', async () => {
  const { setupVehicleTransferModal } = await import('../nav.js');

  const listeners = new Map();
  const createMockElement = (id) => ({
    id,
    dataset: {},
    children: [],
    value: '1',
    textContent: '',
    className: '',
    appendChild(child) { this.children.push(child); },
    addEventListener(evt, fn) { listeners.set(`${id}:${evt}`, fn); },
    showModal: () => {},
    close: () => {},
    setAttribute: () => {},
    removeAttribute: () => {}
  });

  const modal = createMockElement('vehicleTransferModal');
  const closeBtn = createMockElement('vehicleTransferModalClose');
  const currentVehicleSelect = createMockElement('vanCurrentVehicleSelect');
  const sourceSelect = createMockElement('transferSourceSelect');
  const destSelect = createMockElement('transferDestSelect');
  const itemSelect = createMockElement('transferItemSelect');
  const qtyInput = createMockElement('transferQtyInput');
  const noteInput = createMockElement('transferNoteInput');
  const submitBtn = createMockElement('vehicleTransferSubmitBtn');
  const copySlipBtn = createMockElement('vehicleTransferCopySlipBtn');
  const chartWrap = createMockElement('vanInventoryChartWrap');
  const tableBody = createMockElement('vanInventoryTableBody');
  const transfersLogList = createMockElement('vanRecentTransfersList');
  const qtyPlus1 = createMockElement('transferQtyPlus1');
  const qtyPlus5 = createMockElement('transferQtyPlus5');
  const qtyPlus10 = createMockElement('transferQtyPlus10');
  const kpiVehicleName = createMockElement('vanKpiVehicleName');
  const kpiTotalItems = createMockElement('vanKpiTotalItems');
  const kpiInventoryValue = createMockElement('vanKpiInventoryValue');
  const kpiStatusBadge = createMockElement('vanKpiStatusBadge');

  const openTrigger = {
    dataset: {},
    addEventListener(evt, fn) { listeners.set(`openTrigger:${evt}`, fn); }
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      const map = {
        vehicleTransferModal: modal,
        vehicleTransferModalClose: closeBtn,
        vanCurrentVehicleSelect: currentVehicleSelect,
        transferSourceSelect: sourceSelect,
        transferDestSelect: destSelect,
        transferItemSelect: itemSelect,
        transferQtyInput: qtyInput,
        transferNoteInput: noteInput,
        vehicleTransferSubmitBtn: submitBtn,
        vehicleTransferCopySlipBtn: copySlipBtn,
        vanInventoryChartWrap: chartWrap,
        vanInventoryTableBody: tableBody,
        vanRecentTransfersList: transfersLogList,
        transferQtyPlus1: qtyPlus1,
        transferQtyPlus5: qtyPlus5,
        transferQtyPlus10: qtyPlus10,
        vanKpiVehicleName: kpiVehicleName,
        vanKpiTotalItems: kpiTotalItems,
        vanKpiInventoryValue: kpiInventoryValue,
        vanKpiStatusBadge: kpiStatusBadge
      };
      return map[id] || null;
    },
    querySelectorAll(sel) {
      if (sel.includes('data-open-van-transfer')) return [openTrigger];
      if (sel.includes('data-nav-badge="van-transfer"')) return [];
      return [];
    },
    createElement(tag) {
      return { tag, value: '', textContent: '', selected: false };
    }
  };

  let toasted = null;
  let copiedText = null;
  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); }
  };

  try {
    const controller = setupVehicleTransferModal({
      storage: mockStorage,
      onToast: (msg) => { toasted = msg; },
      clipboard: { writeText: async (t) => { copiedText = t; } }
    });

    assert.ok(controller);
    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');
    assert.equal(typeof controller.refresh, 'function');

    // Test quick qty buttons
    qtyInput.value = '2';
    listeners.get('transferQtyPlus1:click')();
    assert.equal(qtyInput.value, 3);
    listeners.get('transferQtyPlus5:click')();
    assert.equal(qtyInput.value, 8);
    listeners.get('transferQtyPlus10:click')();
    assert.equal(qtyInput.value, 18);

    // Test submit transfer
    sourceSelect.value = 'warehouse';
    destSelect.value = 'van-01';
    itemSelect.value = 'onu-gpon';
    qtyInput.value = '5';
    listeners.get('vehicleTransferSubmitBtn:click')();
    assert.ok(toasted.includes('Transferred 5x'));

    // Test copy slip
    await listeners.get('vehicleTransferCopySlipBtn:click')();
    assert.ok(copiedText.includes('SHAHDARA ISP FIELD STOCK TRANSFER RECEIPT'));
    assert.equal(toasted, 'Transfer custody receipt copied to clipboard!');
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html, nav.css, and app.js wire Technician Vehicle Inventory completely', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  // index.html checks
  assert.match(indexHtml, /<dialog id="vehicleTransferModal" class="modal van-inventory-modal"/);
  assert.match(indexHtml, /id="vehicleTransferModalClose"/);
  assert.match(indexHtml, /id="vanCurrentVehicleSelect"/);
  assert.match(indexHtml, /id="vanKpiVehicleName"/);
  assert.match(indexHtml, /id="vanKpiTotalItems"/);
  assert.match(indexHtml, /id="vanKpiInventoryValue"/);
  assert.match(indexHtml, /id="vanKpiStatusBadge"/);
  assert.match(indexHtml, /id="vanInventoryChartWrap"/);
  assert.match(indexHtml, /id="transferSourceSelect"/);
  assert.match(indexHtml, /id="transferDestSelect"/);
  assert.match(indexHtml, /id="transferItemSelect"/);
  assert.match(indexHtml, /id="transferQtyInput"/);
  assert.match(indexHtml, /id="transferQtyPlus1"/);
  assert.match(indexHtml, /id="transferQtyPlus5"/);
  assert.match(indexHtml, /id="transferQtyPlus10"/);
  assert.match(indexHtml, /id="transferNoteInput"/);
  assert.match(indexHtml, /id="vehicleTransferSubmitBtn"/);
  assert.match(indexHtml, /id="vehicleTransferCopySlipBtn"/);
  assert.match(indexHtml, /id="vanInventoryTableBody"/);
  assert.match(indexHtml, /id="vanRecentTransfersList"/);

  assert.match(indexHtml, /data-open-van-transfer/);
  assert.match(indexHtml, /data-mobile-more="van-transfer"/);
  assert.match(indexHtml, /data-sheet-action="van-transfer"/);
  assert.match(indexHtml, /data-speed-action="van-transfer"/);

  // nav.css checks
  assert.match(navCss, /\.van-inventory-modal/);
  assert.match(navCss, /\.van-inventory-modal-card/);
  assert.match(navCss, /\.van-inventory-top-controls/);
  assert.match(navCss, /\.van-rack-visualizer-container/);
  assert.match(navCss, /\.van-transfer-form-card/);
  assert.match(navCss, /\.van-stock-table-card/);
  assert.match(navCss, /\.van-transfers-log-card/);

  // app.js checks
  assert.match(appJs, /setupVehicleTransferModal/);
  assert.match(appJs, /vehicleTransferModalController/);
});

test('aerial alerts catenary sag physics models thermal elongation and wind loads accurately', async () => {
  const { SHAHDARA_AERIAL_SECTORS, calculateCatenarySag } = await import('../nav.js');
  
  assert.ok(Array.isArray(SHAHDARA_AERIAL_SECTORS) && SHAHDARA_AERIAL_SECTORS.length >= 6);
  const sector = SHAHDARA_AERIAL_SECTORS.find(s => s.id === 'aer-gt-01');
  assert.ok(sector);

  // Standard conditions: 25°C, 15 km/h
  const standard = calculateCatenarySag(sector, { temperatureC: 25, windSpeedKmh: 15 });
  assert.equal(typeof standard.effectiveSagM, 'number');
  assert.equal(typeof standard.netClearanceM, 'number');
  assert.equal(typeof standard.clearanceMarginM, 'number');
  assert.equal(typeof standard.tensionN, 'number');
  assert.ok(standard.effectiveSagM > 0);
  assert.ok(standard.netClearanceM > 0);

  // High temperature test (46°C): Sag must increase due to thermal expansion
  const heatWave = calculateCatenarySag(sector, { temperatureC: 46, windSpeedKmh: 15 });
  assert.ok(heatWave.effectiveSagM > standard.effectiveSagM, 'Heat wave must increase effective sag');
  assert.ok(heatWave.netClearanceM < standard.netClearanceM, 'Heat wave must reduce road clearance');

  // Severe storm test (75 km/h wind): Transverse wind load increases effective sag and pole tension
  const storm = calculateCatenarySag(sector, { temperatureC: 25, windSpeedKmh: 75 });
  assert.ok(storm.effectiveSagM > standard.effectiveSagM, 'Severe wind must increase effective sag');
  assert.ok(storm.tensionN > standard.tensionN, 'Severe wind must increase anchor tension');

  // Extreme combined heat and storm triggers CRITICAL status
  const extreme = calculateCatenarySag(sector, { temperatureC: 50, windSpeedKmh: 85 });
  assert.equal(extreme.status, 'CRITICAL');
  assert.equal(extreme.badgeClass, 'badge-danger');
});

test('aerial alerts inspection persistence records and retrieves field actions', async () => {
  const { getAerialInspectionsStore, recordAerialInspection, clearAerialInspectionsStore } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const initial = getAerialInspectionsStore(mockStorage);
  assert.deepEqual(initial.inspections, {});

  const updated = recordAerialInspection('aer-gt-01', {
    inspector: 'Rashid Ali',
    actionTaken: 'Tightened turnbuckle by 4 turns'
  }, mockStorage);

  assert.ok(updated);
  assert.equal(updated.inspector, 'Rashid Ali');
  assert.equal(updated.actionTaken, 'Tightened turnbuckle by 4 turns');
  assert.ok(updated.resolvedAt);

  // Verify retrieval
  const retrieved = getAerialInspectionsStore(mockStorage);
  assert.equal(retrieved.inspections['aer-gt-01'].inspector, 'Rashid Ali');

  // Clear store
  clearAerialInspectionsStore(mockStorage);
  const cleared = getAerialInspectionsStore(mockStorage);
  assert.deepEqual(cleared.inspections, {});
});

test('calculateAerialAlertsSummary aggregates sectors and accounts for resolved inspections', async () => {
  const { calculateAerialAlertsSummary, recordAerialInspection, SHAHDARA_AERIAL_SECTORS } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const summary = calculateAerialAlertsSummary({}, {
    storage: mockStorage,
    temperatureC: 48,
    windSpeedKmh: 40
  });

  assert.equal(summary.evaluations.length, SHAHDARA_AERIAL_SECTORS.length);
  assert.equal(typeof summary.totalSectors, 'number');
  assert.equal(typeof summary.criticalCount, 'number');
  assert.equal(typeof summary.elevatedCount, 'number');
  assert.equal(typeof summary.optimalCount, 'number');
  assert.ok(summary.criticalCount > 0, 'Severe heat should cause critical sectors');
  const initialBadge = summary.activeHazardBadgeCount;

  // Resolving one sector should reduce active hazard badge count
  const criticalSector = summary.evaluations.find(e => e.status === 'CRITICAL');
  assert.ok(criticalSector);
  recordAerialInspection(criticalSector.sector.id, { inspector: 'Crew 1', actionTaken: 'Re-tensioned' }, mockStorage);

  const updatedSummary = calculateAerialAlertsSummary({}, {
    storage: mockStorage,
    temperatureC: 48,
    windSpeedKmh: 40
  });
  assert.equal(updatedSummary.activeHazardBadgeCount, initialBadge - 1);
});

test('renderAerialCatenarySvg renders valid SVG with catenary curve and clearance line', async () => {
  const { SHAHDARA_AERIAL_SECTORS, calculateCatenarySag, renderAerialCatenarySvg } = await import('../nav.js');

  const sector = SHAHDARA_AERIAL_SECTORS[0];
  const evalData = calculateCatenarySag(sector, { temperatureC: 30, windSpeedKmh: 20 });
  const svg = renderAerialCatenarySvg(evalData);

  assert.match(svg, /<svg class="aerial-catenary-svg"/);
  assert.match(svg, /viewBox="0 0 720 260"/);
  assert.match(svg, /<path d="M 110/);
  assert.match(svg, /Min Clearance Limit/);
  assert.match(svg, /Road Surface/);
});

test('generateAerialHazardWorkOrder formats WhatsApp dispatch message with emergency details', async () => {
  const { SHAHDARA_AERIAL_SECTORS, calculateCatenarySag, generateAerialHazardWorkOrder } = await import('../nav.js');

  const sector = SHAHDARA_AERIAL_SECTORS[0];
  const evalData = calculateCatenarySag(sector, { temperatureC: 45, windSpeedKmh: 60 });
  const text = generateAerialHazardWorkOrder(sector, evalData);

  assert.match(text, /SHAHDARA FTTH AERIAL FIBER POLE/);
  assert.match(text, new RegExp(sector.code));
  assert.match(text, new RegExp(sector.name));
  assert.match(text, /Mid-Span Catenary Sag:/);
  assert.match(text, /Net Road Clearance:/);
  assert.match(text, /Hazard Status:/);
  assert.match(text, /Assigned Lineman Team:/);
});

test('aerial alerts UI components and controllers are properly wired across index.html, nav.css, and app.js', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  // Modal dialog and form elements in index.html
  assert.match(indexHtml, /<dialog id="aerialAlertsModal" class="modal aerial-alerts-modal"/);
  assert.match(indexHtml, /id="aerialAlertsModalClose"/);
  assert.match(indexHtml, /id="aerialSectorSelect"/);
  assert.match(indexHtml, /id="aerialPresetStandard"/);
  assert.match(indexHtml, /id="aerialPresetHeat"/);
  assert.match(indexHtml, /id="aerialPresetStorm"/);
  assert.match(indexHtml, /id="aerialTempSlider"/);
  assert.match(indexHtml, /id="aerialWindSlider"/);
  assert.match(indexHtml, /id="aerialCatenaryChartWrap"/);
  assert.match(indexHtml, /id="aerialSectorsTableBody"/);
  assert.match(indexHtml, /id="aerialResolveHazardBtn"/);
  assert.match(indexHtml, /id="aerialCopyDispatchBtn"/);
  assert.match(indexHtml, /id="aerialFilterAreaBtn"/);

  // Trigger elements in drawer, more menu, action sheet, speed dial
  assert.match(indexHtml, /data-nav-badge="aerial-alerts"/);
  assert.match(indexHtml, /id="mobileMoreAerialAlertsBtn"/);
  assert.match(indexHtml, /id="actionSheetAerialAlertsBtn"/);
  assert.match(indexHtml, /id="speedDialAerialAlertsBtn"/);

  // CSS rules in nav.css
  assert.match(navCss, /\.aerial-alerts-modal/);
  assert.match(navCss, /\.aerial-alerts-modal-card/);
  assert.match(navCss, /\.aerial-catenary-chart-card/);
  assert.match(navCss, /\.aerial-sectors-table-card/);
  assert.match(navCss, /\.weather-preset-btn/);

  // app.js controller initialization
  assert.match(appJs, /setupAerialAlertsModal/);
  assert.match(appJs, /aerialAlertsModalController/);
});

import {
  SHAHDARA_OTDR_CORRIDORS,
  OTDR_THRESHOLDS,
  getOtdrSelectedCorridor,
  setOtdrSelectedCorridor,
  getOtdrSelectedWavelength,
  setOtdrSelectedWavelength,
  getOtdrSelectedPulseWidth,
  setOtdrSelectedPulseWidth,
  resetOtdrMobileState,
  getOtdrMobileTracesStore,
  saveOtdrMobileTracesStore,
  recordOtdrEventResolution,
  clearOtdrMobileTracesStore,
  calculateOtdrTracePhysics,
  calculateOtdrMobileSummary,
  renderMobileOtdrTraceSvg,
  generateOtdrDispatchOrder,
  setupMobileOtdrTraceModal
} from '../nav.js';

test('calculateOtdrTracePhysics correctly computes cumulative fiber loss, event markers, and break geolocation', () => {
  const corridor = SHAHDARA_OTDR_CORRIDORS[0]; // Central Ring
  clearOtdrMobileTracesStore();

  const eval1310 = calculateOtdrTracePhysics(corridor, { wavelength: 1310 });
  assert.equal(eval1310.wavelength, 1310);
  assert.equal(eval1310.alphaDbPerKm, OTDR_THRESHOLDS.ATTENUATION_COEFF_1310_DB_PER_KM);
  assert.equal(eval1310.hasCriticalBreak, true);
  assert.equal(eval1310.criticalBreakDistance, 4150);
  assert.ok(eval1310.criticalBreakLandmark.includes('Railway Phatak'));
  assert.equal(eval1310.corridorHealth, 'Critical Break');
  assert.equal(eval1310.corridorClass, 'badge-danger');

  // Verify events list
  assert.equal(eval1310.events.length, 5);
  assert.equal(eval1310.events[0].type, 'Launch');
  assert.equal(eval1310.events[4].status, 'Fiber Break');

  // Test 1550nm wavelength has lower Rayleigh attenuation coefficient
  const eval1550 = calculateOtdrTracePhysics(corridor, { wavelength: 1550 });
  assert.equal(eval1550.alphaDbPerKm, OTDR_THRESHOLDS.ATTENUATION_COEFF_1550_DB_PER_KM);
  assert.ok(eval1550.cumulativeLossDb < eval1310.cumulativeLossDb);

  // Test corridor without breaks (Baradari)
  const baradari = SHAHDARA_OTDR_CORRIDORS[1];
  const evalBaradari = calculateOtdrTracePhysics(baradari, { wavelength: 1550 });
  assert.equal(evalBaradari.hasCriticalBreak, false);
  assert.equal(evalBaradari.criticalBreakDistance, null);
});

test('OTDR mobile trace storage records technician resolution and clears breaks', () => {
  const mockStorage = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = String(v); },
    removeItem(k) { delete this.data[k]; }
  };
  clearOtdrMobileTracesStore(mockStorage);
  const corridor = SHAHDARA_OTDR_CORRIDORS[0];

  // Verify initial state has critical break
  const initialEval = calculateOtdrTracePhysics(corridor, { storage: mockStorage });
  assert.equal(initialEval.hasCriticalBreak, true);

  // Record resolution for event 5 (the break)
  const res = recordOtdrEventResolution(corridor.id, 'ev-5', 'Ali Raza Lineman', 0.05, 'Re-spliced on site', mockStorage);
  assert.equal(res.corridorId, corridor.id);
  assert.equal(res.eventId, 'ev-5');
  assert.equal(res.resolvedLossDb, 0.05);

  // Store verification
  const store = getOtdrMobileTracesStore(mockStorage);
  assert.ok(store[`${corridor.id}_ev-5`]);

  // Physics calculation should now reflect resolved event and no critical break
  const resolvedEval = calculateOtdrTracePhysics(corridor, { storage: mockStorage });
  assert.equal(resolvedEval.hasCriticalBreak, false);
  const ev5 = resolvedEval.events.find(e => e.id === 'ev-5');
  assert.equal(ev5.status, 'Resolved');
  assert.equal(ev5.effectiveLoss, 0.05);

  clearOtdrMobileTracesStore(mockStorage);
  assert.deepEqual(getOtdrMobileTracesStore(mockStorage), {});
});

test('calculateOtdrMobileSummary computes totals, dues at risk, and badge counter', () => {
  clearOtdrMobileTracesStore();
  resetOtdrMobileState();

  const state = {
    customers: [
      { id: 'c1', area: 'Shahdara Town', isArchived: false },
      { id: 'c2', area: 'Baradari Road', isArchived: false }
    ],
    bills: [
      { customerId: 'c1', balance: 3500 },
      { customerId: 'c2', balance: 1500 }
    ]
  };

  const summary = calculateOtdrMobileSummary(state);
  assert.equal(summary.totalCorridors, SHAHDARA_OTDR_CORRIDORS.length);
  assert.ok(summary.activeBreaksCount >= 1);
  assert.ok(summary.badgeCount >= summary.activeBreaksCount);
  assert.ok(summary.totalDuesAtRisk >= 3500);

  // Simulation state getters & setters
  setOtdrSelectedCorridor('otdr-br-02');
  assert.equal(getOtdrSelectedCorridor(), 'otdr-br-02');

  setOtdrSelectedWavelength(1625);
  assert.equal(getOtdrSelectedWavelength(), 1625);

  setOtdrSelectedPulseWidth(50);
  assert.equal(getOtdrSelectedPulseWidth(), 50);

  resetOtdrMobileState();
  assert.equal(getOtdrSelectedCorridor(), SHAHDARA_OTDR_CORRIDORS[0].id);
});

test('renderMobileOtdrTraceSvg produces responsive SVG vector chart', () => {
  const corridor = SHAHDARA_OTDR_CORRIDORS[0];
  const evalData = calculateOtdrTracePhysics(corridor);

  const svg = renderMobileOtdrTraceSvg(evalData);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('otdr-trace-svg'));
  assert.ok(svg.includes('OTDR-CR01'));
  assert.ok(svg.includes('E1'));
  assert.ok(svg.includes('BREAK AT 4150m'));
  assert.ok(svg.includes('</svg>'));
});

test('generateOtdrDispatchOrder creates WhatsApp formatted field dispatch text', () => {
  const corridor = SHAHDARA_OTDR_CORRIDORS[0];
  const evalData = calculateOtdrTracePhysics(corridor);

  const order = generateOtdrDispatchOrder(corridor, evalData);
  assert.ok(order.includes('SHAHDARA FTTH OTDR FIELD SPLICING DISPATCH WORK ORDER'));
  assert.ok(order.includes('OTDR-CR01'));
  assert.ok(order.includes('CRITICAL BREAK DETECTED:'));
  assert.ok(order.includes('4150 meters'));
  assert.ok(order.includes('Usman Ghani & Bilal Team'));
});

test('setupMobileOtdrTraceModal wires controls, buttons, triggers, and callbacks', async () => {
  clearOtdrMobileTracesStore();
  resetOtdrMobileState();

  let modalOpened = false;
  let openHandler = null;
  let closeHandler = null;
  let corridorChangeHandler = null;
  let wlChangeHandler = null;
  let pulseChangeHandler = null;
  let resetHandler = null;
  let dispatchHandler = null;
  let resolveHandler = null;
  let filterAreaHandler = null;

  let filteredArea = null;
  let toastMsg = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };

  const mockCorridorSelect = {
    options: [],
    value: '',
    appendChild: function(opt) { this.options.push(opt); },
    onchange: null
  };

  const mockWlSelect = { value: '1310', onchange: null };
  const mockPulseSelect = { value: '30', onchange: null };
  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };
  const mockKpiCode = { textContent: '' };
  const mockKpiLoss = { textContent: '' };
  const mockKpiBreak = { textContent: '' };
  const mockKpiStatus = { textContent: '', className: '' };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'mobileOtdrTraceModal': return mockModal;
        case 'mobileOtdrTraceModalCloseBtn': return { set onclick(fn) { closeHandler = fn; } };
        case 'otdrCorridorSelect': return mockCorridorSelect;
        case 'otdrWlSelect': return mockWlSelect;
        case 'otdrPulseSelect': return mockPulseSelect;
        case 'otdrResetBtn': return { set onclick(fn) { resetHandler = fn; } };
        case 'otdrTraceChartWrap': return mockChartWrap;
        case 'otdrEventsTableBody': return mockTableBody;
        case 'otdrDispatchBtn': return { set onclick(fn) { dispatchHandler = fn; } };
        case 'otdrResolveBtn': return { set onclick(fn) { resolveHandler = fn; } };
        case 'otdrFilterAreaBtn': return { set onclick(fn) { filterAreaHandler = fn; } };
        case 'otdrKpiCorridorCode': return mockKpiCode;
        case 'otdrKpiTotalLoss': return mockKpiLoss;
        case 'otdrKpiBreakDistance': return mockKpiBreak;
        case 'otdrStatusBadge': return mockKpiStatus;
        default: return null;
      }
    },
    querySelectorAll: (sel) => {
      if (sel === '[data-open-otdr-trace]') {
        return [{ set onclick(fn) { openHandler = fn; } }];
      }
      return [];
    },
    createElement: (tag) => ({ tag, value: '', textContent: '' })
  };

  try {
    setupMobileOtdrTraceModal({
      state: {},
      onFilterArea: (a) => { filteredArea = a; },
      onToast: (m) => { toastMsg = m; },
      clipboard: { writeText: async (t) => { copiedText = t; } }
    });

    assert.equal(mockCorridorSelect.options.length, SHAHDARA_OTDR_CORRIDORS.length);

    // Open
    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);
    assert.equal(mockKpiCode.textContent, 'OTDR-CR01');
    assert.ok(mockChartWrap.innerHTML.includes('otdr-trace-svg'));

    // Wavelength change
    assert.ok(mockWlSelect.onchange !== null);
    mockWlSelect.value = '1550';
    mockWlSelect.onchange();
    assert.equal(getOtdrSelectedWavelength(), 1550);

    // Pulse width change
    assert.ok(mockPulseSelect.onchange !== null);
    mockPulseSelect.value = '100';
    mockPulseSelect.onchange();
    assert.equal(getOtdrSelectedPulseWidth(), 100);

    // Reset
    assert.ok(resetHandler !== null);
    resetHandler();
    assert.equal(getOtdrSelectedWavelength(), SHAHDARA_OTDR_CORRIDORS[0].baseWavelength);

    // Resolve event
    assert.ok(resolveHandler !== null);
    resolveHandler();
    assert.ok(toastMsg.includes('marked resolved'));

    // Copy dispatch order
    assert.ok(dispatchHandler !== null);
    await dispatchHandler();
    assert.ok(copiedText.includes('SHAHDARA FTTH OTDR FIELD SPLICING DISPATCH WORK ORDER'));

    // Filter area
    assert.ok(filterAreaHandler !== null);
    filterAreaHandler();
    assert.equal(filteredArea, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Close
    assert.ok(closeHandler !== null);
    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = origDoc;
  }
});

test('mobile OTDR trace UI elements are wired in index.html, nav.css, and app.js', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  // Trigger buttons
  assert.match(indexHtml, /id="navOtdrTraceBtn"/);
  assert.match(indexHtml, /data-nav-badge="otdr-trace"/);
  assert.match(indexHtml, /id="mobileMoreOtdrTraceBtn"/);
  assert.match(indexHtml, /id="actionSheetOtdrTraceBtn"/);
  assert.match(indexHtml, /id="speedDialOtdrTraceBtn"/);

  // Modal dialog
  assert.match(indexHtml, /<dialog id="mobileOtdrTraceModal"/);
  assert.match(indexHtml, /id="otdrCorridorSelect"/);
  assert.match(indexHtml, /id="otdrTraceChartWrap"/);
  assert.match(indexHtml, /id="otdrDispatchBtn"/);

  // Styles
  assert.match(navCss, /\.otdr-trace-modal/);
  assert.match(navCss, /\.otdr-trace-svg/);

  // App.js
  assert.match(appJs, /setupMobileOtdrTraceModal/);
  assert.match(appJs, /mobileOtdrTraceModalController/);
});

/* ==========================================================================
   FIELD TECHNICIAN GPS BREADCRUMBS & GEOFENCING SUITE TESTS
   ========================================================================== */

test('nav-gps-tracking haversineDistanceMeters and calculateBearingDegrees calculate geometry correctly', async () => {
  const {
    haversineDistanceMeters,
    calculateBearingDegrees,
    SHAHDARA_FIELD_NODES
  } = await import('../nav-gps-tracking.js');

  // Verify node structure
  assert.ok(SHAHDARA_FIELD_NODES.length >= 5);
  const odf = SHAHDARA_FIELD_NODES.find(n => n.id === 'node-central-odf');
  const baradari = SHAHDARA_FIELD_NODES.find(n => n.id === 'node-baradari-splice');
  assert.ok(odf);
  assert.ok(baradari);

  // Distance between ODF and Baradari (approx 1.5 - 1.6 km)
  const dist = haversineDistanceMeters(odf.lat, odf.lng, baradari.lat, baradari.lng);
  assert.ok(dist > 1400 && dist < 1700, `Expected ~1550m, got ${dist}m`);

  // Same coordinates yield zero distance
  assert.equal(haversineDistanceMeters(odf.lat, odf.lng, odf.lat, odf.lng), 0);

  // Bearing calculation
  const bearing = calculateBearingDegrees(odf.lat, odf.lng, baradari.lat, baradari.lng);
  assert.ok(bearing >= 0 && bearing <= 360);

  // Invalid coordinates fail safe
  assert.equal(haversineDistanceMeters(null, 74.2, 31.6, 74.2), 0);
  assert.equal(calculateBearingDegrees('invalid', 74.2, 31.6, 74.2), 0);
});

test('nav-gps-tracking evaluateNodeGeofence and findNearestFieldNode detect proximity and perimeter', async () => {
  const {
    evaluateNodeGeofence,
    findNearestFieldNode,
    SHAHDARA_FIELD_NODES
  } = await import('../nav-gps-tracking.js');

  const odf = SHAHDARA_FIELD_NODES.find(n => n.id === 'node-central-odf');

  // Fix right at ODF (0m distance)
  const fenceInside = evaluateNodeGeofence(odf.lat, odf.lng, odf);
  assert.equal(fenceInside.isInside, true);
  assert.equal(fenceInside.distanceMeters, 0);

  // Fix 500m away
  const fenceFar = evaluateNodeGeofence(odf.lat + 0.005, odf.lng, odf);
  assert.equal(fenceFar.isInside, false);
  assert.ok(fenceFar.distanceMeters > 400);

  // Find nearest node
  const nearest = findNearestFieldNode(odf.lat + 0.0001, odf.lng + 0.0001);
  assert.equal(nearest.node.id, 'node-central-odf');
  assert.equal(nearest.isWithinGeofence, true);
  assert.ok(nearest.distanceMeters < 30);
});

test('nav-gps-tracking storage persistence and recordGpsBreadcrumb filter accuracy', async () => {
  const {
    getGpsBreadcrumbsStore,
    saveGpsBreadcrumbsStore,
    recordGpsBreadcrumb,
    clearGpsBreadcrumbsStore
  } = await import('../nav-gps-tracking.js');

  const fakeStorageData = {};
  const mockStorage = {
    getItem(key) { return fakeStorageData[key] || null; },
    setItem(key, val) { fakeStorageData[key] = String(val); },
    removeItem(key) { delete fakeStorageData[key]; }
  };

  // Initially empty
  assert.deepEqual(getGpsBreadcrumbsStore(mockStorage), []);

  // Record valid breadcrumb
  const rec1 = recordGpsBreadcrumb({
    lat: 31.6215,
    lng: 74.2820,
    accuracy: 15,
    speed: 22,
    batteryLevel: 80,
    technicianId: 'TECH-RAZA-01',
    activeOrderId: 'WO-FIBER-101'
  }, mockStorage);

  assert.equal(rec1.success, true);
  assert.ok(rec1.point.id);
  assert.equal(rec1.point.isInsideGeofence, true);

  const list = getGpsBreadcrumbsStore(mockStorage);
  assert.equal(list.length, 1);
  assert.equal(list[0].technicianId, 'TECH-RAZA-01');

  // Record fix with excessive inaccuracy (> 75m)
  const recBad = recordGpsBreadcrumb({
    lat: 31.625,
    lng: 74.285,
    accuracy: 120
  }, mockStorage);
  assert.equal(recBad.success, false);
  assert.ok(recBad.reason.includes('exceeds threshold'));
  assert.equal(getGpsBreadcrumbsStore(mockStorage).length, 1);

  // Clear storage
  clearGpsBreadcrumbsStore(mockStorage);
  assert.equal(getGpsBreadcrumbsStore(mockStorage).length, 0);
});

test('nav-gps-tracking calculateBreadcrumbMetrics computes telemetry stats and battery drain', async () => {
  const { calculateBreadcrumbMetrics } = await import('../nav-gps-tracking.js');

  const samplePoints = [
    {
      id: 'fix-1',
      lat: 31.6215,
      lng: 74.2820,
      speed: 15,
      batteryLevel: 90,
      timestamp: '2026-10-16T10:00:00.000Z',
      isInsideGeofence: true
    },
    {
      id: 'fix-2',
      lat: 31.6240,
      lng: 74.2850,
      speed: 25,
      batteryLevel: 88,
      timestamp: '2026-10-16T10:10:00.000Z',
      isInsideGeofence: false
    },
    {
      id: 'fix-3',
      lat: 31.6292,
      lng: 74.2745,
      speed: 20,
      batteryLevel: 85,
      timestamp: '2026-10-16T10:25:00.000Z',
      isInsideGeofence: true
    }
  ];

  const metrics = calculateBreadcrumbMetrics(samplePoints);
  assert.equal(metrics.totalFixes, 3);
  assert.ok(metrics.totalDistanceMeters > 500);
  assert.equal(metrics.averageSpeedKmh, 20);
  assert.equal(metrics.durationMinutes, 25);
  assert.equal(metrics.batteryDrainPercent, 5); // 90 - 85
  assert.equal(metrics.geofenceEncounters, 2);

  // Empty list returns defaults
  const emptyMetrics = calculateBreadcrumbMetrics([]);
  assert.equal(emptyMetrics.totalFixes, 0);
  assert.equal(emptyMetrics.totalDistanceMeters, 0);
});

test('nav-gps-tracking generateTechnicianLocationShare and renderMobileGpsBreadcrumbsSvg produce expected outputs', async () => {
  const {
    generateTechnicianLocationShare,
    renderMobileGpsBreadcrumbsSvg,
    SHAHDARA_FIELD_NODES
  } = await import('../nav-gps-tracking.js');

  const odf = SHAHDARA_FIELD_NODES[0];
  const fix = {
    lat: 31.6215,
    lng: 74.2820,
    technicianId: 'TECH-ASIF-02',
    activeOrderId: 'WO-FIBER-884',
    batteryLevel: 78,
    accuracy: 8,
    timestamp: '2026-10-16T11:30:00.000Z'
  };

  const shareText = generateTechnicianLocationShare(fix, odf, 'WO-FIBER-884');
  assert.ok(shareText.includes('TECH-ASIF-02'));
  assert.ok(shareText.includes('WO-FIBER-884'));
  assert.ok(shareText.includes('Shahdara Central ODF'));
  assert.ok(shareText.includes('https://maps.google.com/?q=31.6215,74.282'));

  // SVG rendering
  const svg = renderMobileGpsBreadcrumbsSvg([fix]);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('SHAHDARA OSP FIELD RADAR'));
  assert.ok(svg.includes('LIVE TECH'));
  assert.ok(svg.includes('SHAH-ODF-01'));
});

test('mobile GPS breadcrumbs UI elements are wired in index.html, nav.css, and app.js', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  // Trigger buttons
  assert.match(indexHtml, /id="navGpsBreadcrumbsBtn"/);
  assert.match(indexHtml, /data-nav-badge="gps-breadcrumbs"/);
  assert.match(indexHtml, /id="mobileMoreGpsBreadcrumbsBtn"/);
  assert.match(indexHtml, /id="actionSheetGpsBreadcrumbsBtn"/);
  assert.match(indexHtml, /id="speedDialGpsBreadcrumbsBtn"/);

  // Modal dialog
  assert.match(indexHtml, /<dialog id="mobileGpsBreadcrumbsModal"/);
  assert.match(indexHtml, /id="gpsStatFixes"/);
  assert.match(indexHtml, /id="gpsModalSvgContainer"/);
  assert.match(indexHtml, /id="btnGpsMockPing"/);
  assert.match(indexHtml, /id="btnGpsShareLocation"/);

  // Styles
  assert.match(navCss, /\.gps-breadcrumbs-modal/);
  assert.match(navCss, /\.gps-breadcrumbs-svg/);
  assert.match(navCss, /\.gps-badge-in/);

  // App.js
  assert.match(appJs, /setupMobileGpsBreadcrumbsModal/);
  assert.match(appJs, /mobileGpsBreadcrumbsModalController/);
});

test('nav-opm-testing dBm and milliwatt conversions and insertion loss calculations', async () => {
  const {
    dBmToMilliwatts,
    milliwattsToDbm,
    calculateInsertionLoss,
    calculateLinkLossBudget,
    CONNECTOR_POLISH_TYPES,
    CONTAMINATION_LEVELS
  } = await import('../nav-opm-testing.js');

  // dBm to mW
  assert.equal(dBmToMilliwatts(0), 1.0);
  assert.equal(dBmToMilliwatts(-10), 0.1);
  assert.equal(dBmToMilliwatts(-20), 0.01);
  assert.equal(dBmToMilliwatts(10), 10.0);

  // mW to dBm
  assert.equal(milliwattsToDbm(1.0), 0);
  assert.equal(milliwattsToDbm(0.1), -10);
  assert.equal(milliwattsToDbm(0), -70);
  assert.equal(milliwattsToDbm(-5), -70);

  // Insertion loss
  assert.equal(calculateInsertionLoss(5, -20), 25);
  assert.equal(calculateInsertionLoss(2.5, -18.5), 21);

  // Link loss budget
  const budgetClean = calculateLinkLossBudget(18.5, 'sc-apc', 'clean');
  assert.equal(budgetClean.baseLossDb, 18.5);
  assert.equal(budgetClean.connectorLossDb, 0.25);
  assert.equal(budgetClean.contaminationPenaltyDb, 0.0);
  assert.equal(budgetClean.totalLossDb, 18.75);

  const budgetDirty = calculateLinkLossBudget(18.5, 'sc-upc', 'smudge');
  assert.equal(budgetDirty.connectorLossDb, 0.35);
  assert.equal(budgetDirty.contaminationPenaltyDb, 2.2);
  assert.equal(budgetDirty.totalLossDb, 21.05);
});

test('nav-opm-testing evaluateOpmSignalGrade classifies GPON power thresholds correctly', async () => {
  const {
    evaluateOpmSignalGrade,
    OPM_TEST_POINTS
  } = await import('../nav-opm-testing.js');

  // Grade classification
  assert.equal(evaluateOpmSignalGrade(0).grade, 'OVERLOAD');
  assert.equal(evaluateOpmSignalGrade(-19.5).grade, 'EXCELLENT');
  assert.equal(evaluateOpmSignalGrade(-25.0).grade, 'ACCEPTABLE');
  assert.equal(evaluateOpmSignalGrade(-27.5).grade, 'CRITICAL_LOW');
  assert.equal(evaluateOpmSignalGrade(-35.0).grade, 'NO_LIGHT');
  assert.equal(evaluateOpmSignalGrade(-55.0).grade, 'NO_LIGHT');

  // OLT SFP port grade check
  assert.equal(evaluateOpmSignalGrade(4.5, 'point-olt-sfp').grade, 'EXCELLENT');
  assert.equal(evaluateOpmSignalGrade(0.5, 'point-olt-sfp').grade, 'CRITICAL_LOW');
});

test('nav-opm-testing offline localStorage test logs CRUD', async () => {
  const {
    getOpmTestLogsStore,
    saveOpmTestLogsStore,
    recordOpmTestLog,
    clearOpmTestLogsStore,
    OPM_TEST_LOGS_STORAGE_KEY
  } = await import('../nav-opm-testing.js');

  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  assert.deepEqual(getOpmTestLogsStore(mockStorage), { logs: [] });

  const reading1 = {
    wavelengthNm: 1490,
    testPointId: 'point-rosette-onu',
    measuredPowerDbm: -18.2,
    connectorType: 'sc-apc',
    contamination: 'clean',
    notes: 'ONT tested okay'
  };

  const logged1 = recordOpmTestLog(reading1, mockStorage);
  assert.ok(logged1.id);
  assert.equal(logged1.signalGrade, 'EXCELLENT');
  assert.equal(logged1.pass, true);

  const logs = getOpmTestLogsStore(mockStorage).logs;
  assert.equal(logs.length, 1);
  assert.equal(logs[0].measuredPowerDbm, -18.2);

  clearOpmTestLogsStore(mockStorage);
  assert.deepEqual(getOpmTestLogsStore(mockStorage), { logs: [] });
});

test('nav-opm-testing generateOpmFieldReport and renderMobileOpmGaugeSvg produce valid field outputs', async () => {
  const {
    generateOpmFieldReport,
    renderMobileOpmGaugeSvg,
    OPM_TEST_POINTS
  } = await import('../nav-opm-testing.js');

  const testReading = {
    wavelengthNm: 1490,
    testPointId: 'point-rosette-onu',
    measuredPowerDbm: -19.5,
    connectorType: 'sc-apc',
    contamination: 'clean',
    notes: 'Subscriber drop verified'
  };

  const report = generateOpmFieldReport(testReading);
  assert.ok(report.includes('SHAHDARA ISP - OPTICAL POWER METER (OPM) REPORT'));
  assert.ok(report.includes('1490 nm'));
  assert.ok(report.includes('-19.50 dBm'));
  assert.ok(report.includes('Subscriber drop verified'));

  const svg = renderMobileOpmGaugeSvg(testReading);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('SHD-OPM PRO'));
  assert.ok(svg.includes('-19.50 dBm'));
  assert.ok(svg.includes('1490 nm'));
});

test('mobile OPM testing UI elements are wired in index.html, nav.css, and app.js', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  // Trigger buttons
  assert.match(indexHtml, /id="navOpmTesterBtn"/);
  assert.match(indexHtml, /data-nav-badge="opm-tester"/);
  assert.match(indexHtml, /id="mobileMoreOpmTesterBtn"/);
  assert.match(indexHtml, /id="actionSheetOpmTesterBtn"/);
  assert.match(indexHtml, /id="speedDialOpmTesterBtn"/);

  // Modal dialog & inputs
  assert.match(indexHtml, /<dialog id="mobileOpmTestingModal"/);
  assert.match(indexHtml, /id="opmWavelengthSelect"/);
  assert.match(indexHtml, /id="opmTestPointSelect"/);
  assert.match(indexHtml, /id="opmMeasuredPowerSlider"/);
  assert.match(indexHtml, /id="opmMeasuredPowerInput"/);
  assert.match(indexHtml, /id="opmConnectorSelect"/);
  assert.match(indexHtml, /id="opmContaminationSelect"/);
  assert.match(indexHtml, /id="opmGaugeSvgContainer"/);
  assert.match(indexHtml, /id="opmRecordLogBtn"/);
  assert.match(indexHtml, /id="opmCopyReportBtn"/);
  assert.match(indexHtml, /id="opmFilterAreaBtn"/);
  assert.match(indexHtml, /id="opmClearLogsBtn"/);

  // Styles
  assert.match(navCss, /\.opm-testing-modal/);
  assert.match(navCss, /\.opm-gauge-svg/);
  assert.match(navCss, /\.opm-log-item/);

  // App.js
  assert.match(appJs, /setupMobileOpmTestingModal/);
  assert.match(appJs, /mobileOpmTestingModalController/);
  assert.match(appJs, /action === 'opm-tester'/);
});

test('nav-opm-testing fiber attenuation, allowable drop distance, and return loss safety', async () => {
  const {
    calculateFiberAttenuation,
    estimateMaxAllowableDropDistanceKm,
    evaluateReturnLossSafety
  } = await import('../nav-opm-testing.js');

  // Attenuation: 1490 nm @ 0.22 dB/km
  const atten1490 = calculateFiberAttenuation(1490, 5.0);
  assert.equal(atten1490.wavelengthNm, 1490);
  assert.equal(atten1490.standardLossDbPerKm, 0.22);
  assert.equal(atten1490.lengthKm, 5.0);
  assert.equal(atten1490.fiberLossDb, 1.1);

  // Attenuation: 1310 nm @ 0.35 dB/km
  const atten1310 = calculateFiberAttenuation(1310, 2.0);
  assert.equal(atten1310.fiberLossDb, 0.7);

  // Drop distance estimation
  const distanceEst = estimateMaxAllowableDropDistanceKm({
    launchPowerDbm: 3.0,
    minReceiverSensitivityDbm: -27.0,
    splitterLossDb: 24.7,
    connectorLossDb: 2.0,
    wavelengthNm: 1490
  });

  assert.equal(distanceEst.totalPowerBudgetDb, 30.0);
  assert.equal(distanceEst.availableFiberLossDb, 3.3);
  assert.equal(distanceEst.maxDistanceKm, 15.0);
  assert.equal(distanceEst.maxDistanceMeters, 15000);

  // Return loss safety evaluation
  const safeApc = evaluateReturnLossSafety('sc-apc', 4.5);
  assert.equal(safeApc.isHighRisk, false);
  assert.equal(safeApc.returnLossDb, 65);
  assert.ok(safeApc.statusText.includes('OPTIMAL'));

  const riskyUpc = evaluateReturnLossSafety('sc-upc', 4.5);
  assert.equal(riskyUpc.isHighRisk, true);
  assert.equal(riskyUpc.returnLossDb, 52);
  assert.ok(riskyUpc.statusText.includes('WARNING'));
});

test('setupMobileOpmTestingModal wires modal triggers, selects, inputs, and action buttons', async () => {
  const { setupMobileOpmTestingModal } = await import('../nav-opm-testing.js');

  let modalOpened = false;
  let closeHandler = null;
  let openHandler = null;
  let waveChangeHandler = null;
  let pointChangeHandler = null;
  let sliderInputHandler = null;
  let logClickHandler = null;
  let clearClickHandler = null;
  let copyClickHandler = null;
  let filterClickHandler = null;

  let toastMsg = null;
  let filteredArea = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };

  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  const mockTriggerBtn = {
    set onclick(fn) { openHandler = fn; }
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'mobileOpmTestingModal': return mockModal;
        case 'closeMobileOpmTestingModal': return { set onclick(fn) { closeHandler = fn; } };
        case 'opmWavelengthSelect': return { value: '1490', set onchange(fn) { waveChangeHandler = fn; } };
        case 'opmTestPointSelect': return { value: 'point-rosette-onu', set onchange(fn) { pointChangeHandler = fn; } };
        case 'opmMeasuredPowerSlider': return { value: '-20.5', set oninput(fn) { sliderInputHandler = fn; } };
        case 'opmMeasuredPowerInput': return { value: '-20.5', oninput: null };
        case 'opmConnectorSelect': return { value: 'sc-apc', onchange: null };
        case 'opmContaminationSelect': return { value: 'clean', onchange: null };
        case 'opmTestNotesInput': return { value: 'Customer testing' };
        case 'opmGaugeSvgContainer': return { innerHTML: '' };
        case 'opmKpiSignalGrade': return { textContent: '', className: '', style: {} };
        case 'opmKpiLinearMicroWatts': return { textContent: '' };
        case 'opmKpiTotalLoss': return { textContent: '' };
        case 'opmKpiCompliance': return { textContent: '', style: {} };
        case 'opmRecordLogBtn': return { set onclick(fn) { logClickHandler = fn; } };
        case 'opmClearLogsBtn': return { set onclick(fn) { clearClickHandler = fn; } };
        case 'opmCopyReportBtn': return { set onclick(fn) { copyClickHandler = fn; } };
        case 'opmFilterAreaBtn': return { set onclick(fn) { filterClickHandler = fn; } };
        case 'opmLogsList': return { innerHTML: '' };
        default: return null;
      }
    },
    querySelectorAll: (selector) => {
      if (selector === '[data-open-opm-tester]') {
        return [mockTriggerBtn];
      }
      return [];
    }
  };

  try {
    const controller = setupMobileOpmTestingModal({
      storage: mockStorage,
      onToast: (msg) => { toastMsg = msg; },
      onFilterArea: (area) => { filteredArea = area; },
      clipboard: {
        writeText: async (text) => { copiedText = text; }
      }
    });

    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');
    assert.equal(typeof controller.getCurrentReading, 'function');

    // Trigger button opens modal
    assert.equal(typeof openHandler, 'function');
    openHandler();
    assert.equal(modalOpened, true);

    // Close button closes modal
    assert.equal(typeof closeHandler, 'function');
    closeHandler();
    assert.equal(modalOpened, false);

    // Slider input changes reading
    assert.equal(typeof sliderInputHandler, 'function');
    sliderInputHandler({ target: { value: '-19.2' } });
    assert.equal(controller.getCurrentReading().measuredPowerDbm, -19.2);

    // Logging test reading
    assert.equal(typeof logClickHandler, 'function');
    logClickHandler();
    assert.ok(toastMsg.includes('Logged -19.20 dBm reading'));

    // Copying report
    assert.equal(typeof copyClickHandler, 'function');
    await copyClickHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - OPTICAL POWER METER (OPM) REPORT'));

    // Filter area
    assert.equal(typeof filterClickHandler, 'function');
    filterClickHandler();
    assert.equal(filteredArea, 'Jia Musa');

    // Clear logs
    assert.equal(typeof clearClickHandler, 'function');
    clearClickHandler();
    assert.equal(toastMsg, 'Cleared optical power test logs');
  } finally {
    globalThis.document = origDoc;
  }
});

test('nav-vfl-tracer TIA-598-D color code resolution, cable sizes, and fault modes', async () => {
  const {
    TIA_598_COLOR_CODES,
    VFL_CABLE_TYPES,
    VFL_LASER_MODES,
    VFL_POWER_LEVELS,
    VFL_FAULT_CONDITIONS,
    SHAHDARA_OSP_CABINETS,
    resolveFiberCoreFromNumber,
    resolveCoreNumberFromTubeAndFiber
  } = await import('../nav-vfl-tracer.js');

  // Verify 12 color codes
  assert.equal(TIA_598_COLOR_CODES.length, 12);
  assert.equal(TIA_598_COLOR_CODES[0].name, 'Blue');
  assert.equal(TIA_598_COLOR_CODES[1].name, 'Orange');
  assert.equal(TIA_598_COLOR_CODES[2].name, 'Green');
  assert.equal(TIA_598_COLOR_CODES[3].name, 'Brown');
  assert.equal(TIA_598_COLOR_CODES[4].name, 'Slate');
  assert.equal(TIA_598_COLOR_CODES[5].name, 'White');
  assert.equal(TIA_598_COLOR_CODES[6].name, 'Red');
  assert.equal(TIA_598_COLOR_CODES[7].name, 'Black');
  assert.equal(TIA_598_COLOR_CODES[8].name, 'Yellow');
  assert.equal(TIA_598_COLOR_CODES[9].name, 'Violet');
  assert.equal(TIA_598_COLOR_CODES[10].name, 'Rose');
  assert.equal(TIA_598_COLOR_CODES[11].name, 'Aqua');

  // Resolve Core #1 (48-Core cable) -> Tube 1 (Blue), Fiber 1 (Blue)
  const core1 = resolveFiberCoreFromNumber(1, 48);
  assert.equal(core1.coreNumber, 1);
  assert.equal(core1.tubeNumber, 1);
  assert.equal(core1.tubeColor.name, 'Blue');
  assert.equal(core1.fiberNumberInTube, 1);
  assert.equal(core1.fiberColor.name, 'Blue');

  // Resolve Core #12 -> Tube 1 (Blue), Fiber 12 (Aqua)
  const core12 = resolveFiberCoreFromNumber(12, 48);
  assert.equal(core12.tubeNumber, 1);
  assert.equal(core12.tubeColor.name, 'Blue');
  assert.equal(core12.fiberNumberInTube, 12);
  assert.equal(core12.fiberColor.name, 'Aqua');

  // Resolve Core #13 -> Tube 2 (Orange), Fiber 1 (Blue)
  const core13 = resolveFiberCoreFromNumber(13, 48);
  assert.equal(core13.tubeNumber, 2);
  assert.equal(core13.tubeColor.name, 'Orange');
  assert.equal(core13.fiberNumberInTube, 1);
  assert.equal(core13.fiberColor.name, 'Blue');

  // Resolve Core #27 -> Tube 3 (Green), Fiber 3 (Green)
  const core27 = resolveFiberCoreFromNumber(27, 48);
  assert.equal(core27.tubeNumber, 3);
  assert.equal(core27.tubeColor.name, 'Green');
  assert.equal(core27.fiberNumberInTube, 3);
  assert.equal(core27.fiberColor.name, 'Green');

  // Reverse resolution: Tube 3, Fiber 3 -> Core 27
  assert.equal(resolveCoreNumberFromTubeAndFiber(3, 3), 27);
  assert.equal(resolveCoreNumberFromTubeAndFiber(1, 1), 1);
  assert.equal(resolveCoreNumberFromTubeAndFiber(4, 12), 48);

  // Boundary clamping
  const clampedLow = resolveFiberCoreFromNumber(0, 48);
  assert.equal(clampedLow.coreNumber, 1);
  const clampedHigh = resolveFiberCoreFromNumber(100, 48);
  assert.equal(clampedHigh.coreNumber, 48);

  // Cable types and cabinets
  assert.equal(VFL_CABLE_TYPES.length, 5);
  assert.equal(SHAHDARA_OSP_CABINETS.length, 6);
  assert.equal(VFL_FAULT_CONDITIONS.CONTINUITY_OK.id, 'CONTINUITY_OK');
  assert.equal(VFL_FAULT_CONDITIONS.FIBER_BREAK.id, 'FIBER_BREAK');
  assert.equal(VFL_FAULT_CONDITIONS.MACROBEND.id, 'MACROBEND');
});

test('nav-vfl-tracer storage, report generation, and laser SVG visualizer', async () => {
  const {
    getVflTestLogsStore,
    saveVflTestLogsStore,
    recordVflTestLog,
    clearVflTestLogsStore,
    generateVflFieldReport,
    renderMobileVflLaserSvg,
    VFL_FAULT_CONDITIONS
  } = await import('../nav-vfl-tracer.js');

  const testStore = { _data: {} };
  const mockStorage = {
    getItem(k) { return testStore._data[k] || null; },
    setItem(k, v) { testStore._data[k] = String(v); },
    removeItem(k) { delete testStore._data[k]; }
  };

  // Initially empty
  assert.deepEqual(getVflTestLogsStore(mockStorage), []);

  // Record a test log
  const log = recordVflTestLog({
    coreNumber: 5,
    totalCores: 48,
    tubeNumber: 1,
    tubeColorName: 'Blue',
    fiberNumberInTube: 5,
    fiberColorName: 'Slate',
    laserMode: 'CW',
    powerMw: 10,
    faultCondition: 'CONTINUITY_OK',
    cabinetId: 'cab-sh-01',
    cabinetName: 'FDH-01 (Shahdara Chowk Main Hub)',
    linemanNotes: 'Core verified to subscriber ONT'
  }, mockStorage);

  assert.equal(log.coreNumber, 5);
  assert.equal(log.fiberColorName, 'Slate');
  const storedLogs = getVflTestLogsStore(mockStorage);
  assert.equal(storedLogs.length, 1);
  assert.equal(storedLogs[0].coreNumber, 5);

  // Generate WhatsApp field report
  const testReading = {
    coreNumber: 5,
    totalCores: 48,
    tubeNumber: 1,
    tubeColor: { name: 'Blue', urduName: 'نیلا' },
    fiberNumberInTube: 5,
    fiberColor: { name: 'Slate', urduName: 'سلیٹی' },
    laserMode: 'CW',
    powerMw: 10,
    faultCondition: VFL_FAULT_CONDITIONS.CONTINUITY_OK,
    cabinetName: 'FDH-01 (Shahdara Chowk Main Hub)',
    linemanNotes: 'Pristine red beam at drop terminal'
  };

  const report = generateVflFieldReport(testReading);
  assert.ok(report.includes('SHAHDARA ISP - VFL'));
  assert.ok(report.includes('Core #5'));
  assert.ok(report.includes('48-core cable'));
  assert.ok(report.includes('Blue'));
  assert.ok(report.includes('Slate'));
  assert.ok(report.includes('Pristine red beam'));

  // SVG rendering
  const svg = renderMobileVflLaserSvg(testReading, { compact: false });
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('650nm VISIBLE RED LASER EMISSION'));
  assert.ok(svg.includes('CORE #5'));
  assert.ok(svg.includes('TUBE #1'));

  // Clear logs
  clearVflTestLogsStore(mockStorage);
  assert.deepEqual(getVflTestLogsStore(mockStorage), []);
});

test('mobile VFL tracer UI elements are wired in index.html, nav.css, and app.js', () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');
  const appJs = read('app.js');

  // Trigger buttons
  assert.match(indexHtml, /id="navVflTracerBtn"/);
  assert.match(indexHtml, /data-nav-badge="vfl-tracer"/);
  assert.match(indexHtml, /id="mobileMoreVflTracerBtn"/);
  assert.match(indexHtml, /id="actionSheetVflTracerBtn"/);
  assert.match(indexHtml, /id="speedDialVflTracerBtn"/);

  // Modal dialog & inputs
  assert.match(indexHtml, /<dialog id="mobileVflModal"/);
  assert.match(indexHtml, /id="vflCableTypeSelect"/);
  assert.match(indexHtml, /id="vflCabinetSelect"/);
  assert.match(indexHtml, /id="vflTubeSelect"/);
  assert.match(indexHtml, /id="vflFiberSelect"/);
  assert.match(indexHtml, /id="vflCoreNumberSlider"/);
  assert.match(indexHtml, /id="vflCoreNumberInput"/);
  assert.match(indexHtml, /id="vflLaserModeSelect"/);
  assert.match(indexHtml, /id="vflPowerLevelSelect"/);
  assert.match(indexHtml, /id="vflFaultConditionSelect"/);
  assert.match(indexHtml, /id="vflLaserSvgContainer"/);
  assert.match(indexHtml, /id="vflRecordLogBtn"/);
  assert.match(indexHtml, /id="vflCopyReportBtn"/);
  assert.match(indexHtml, /id="vflFilterAreaBtn"/);
  assert.match(indexHtml, /id="vflClearLogsBtn"/);

  // Styles
  assert.match(navCss, /\.vfl-modal/);
  assert.match(navCss, /\.vfl-laser-svg/);
  assert.match(navCss, /\.vfl-log-item/);

  // App.js
  assert.match(appJs, /setupMobileVflModal/);
  assert.match(appJs, /mobileVflModalController/);
  assert.match(appJs, /action === 'vfl-tracer'/);
});

test('setupMobileVflModal wires modal triggers, selects, inputs, and action buttons', async () => {
  const { setupMobileVflModal } = await import('../nav-vfl-tracer.js');

  let modalOpened = false;
  let closeHandler = null;
  let openHandler = null;
  let cableChangeHandler = null;
  let tubeChangeHandler = null;
  let fiberChangeHandler = null;
  let sliderInputHandler = null;
  let modeChangeHandler = null;
  let powerChangeHandler = null;
  let faultChangeHandler = null;
  let logClickHandler = null;
  let clearClickHandler = null;
  let copyClickHandler = null;
  let filterClickHandler = null;

  let toastMsg = null;
  let filteredArea = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };

  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  const mockTriggerBtn = {
    set onclick(fn) { openHandler = fn; }
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'mobileVflModal': return mockModal;
        case 'mobileVflModalCloseBtn': return { set onclick(fn) { closeHandler = fn; } };
        case 'vflCableTypeSelect': return { value: '48-core', set onchange(fn) { cableChangeHandler = fn; } };
        case 'vflCabinetSelect': return { value: 'cab-sh-01', set onchange(fn) {} };
        case 'vflTubeSelect': return { value: '1', set onchange(fn) { tubeChangeHandler = fn; } };
        case 'vflFiberSelect': return { value: '1', set onchange(fn) { fiberChangeHandler = fn; } };
        case 'vflCoreNumberSlider': return { value: '1', set oninput(fn) { sliderInputHandler = fn; } };
        case 'vflCoreNumberInput': return { value: '1', oninput: null };
        case 'vflLaserModeSelect': return { value: 'CW', set onchange(fn) { modeChangeHandler = fn; } };
        case 'vflPowerLevelSelect': return { value: '10', set onchange(fn) { powerChangeHandler = fn; } };
        case 'vflFaultConditionSelect': return { value: 'CONTINUITY_OK', set onchange(fn) { faultChangeHandler = fn; } };
        case 'vflNotesInput': return { value: 'Splice tray inspection' };
        case 'vflLaserSvgContainer': return { innerHTML: '' };
        case 'vflKpiCorePill': return { textContent: '' };
        case 'vflKpiTubeBadge': return { textContent: '', style: {} };
        case 'vflKpiFiberBadge': return { textContent: '', style: {} };
        case 'vflKpiFaultBadge': return { textContent: '', className: '' };
        case 'vflRecordLogBtn': return { set onclick(fn) { logClickHandler = fn; } };
        case 'vflClearLogsBtn': return { set onclick(fn) { clearClickHandler = fn; } };
        case 'vflCopyReportBtn': return { set onclick(fn) { copyClickHandler = fn; } };
        case 'vflFilterAreaBtn': return { set onclick(fn) { filterClickHandler = fn; } };
        case 'vflLogsList': return { innerHTML: '' };
        default: return null;
      }
    },
    querySelectorAll: (selector) => {
      if (selector === '[data-open-vfl-tracer]') {
        return [mockTriggerBtn];
      }
      return [];
    }
  };

  try {
    const controller = setupMobileVflModal({
      storage: mockStorage,
      onToast: (msg) => { toastMsg = msg; },
      onFilterArea: (area) => { filteredArea = area; },
      clipboard: {
        writeText: async (text) => { copiedText = text; }
      }
    });

    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');
    assert.equal(typeof controller.getCurrentReading, 'function');

    // Trigger button opens modal
    assert.equal(typeof openHandler, 'function');
    openHandler();
    assert.equal(modalOpened, true);

    // Close button closes modal
    assert.equal(typeof closeHandler, 'function');
    closeHandler();
    assert.equal(modalOpened, false);

    // Slider input changes reading
    assert.equal(typeof sliderInputHandler, 'function');
    sliderInputHandler({ target: { value: '7' } });
    assert.equal(controller.getCurrentReading().coreNumber, 7);
    assert.equal(controller.getCurrentReading().fiberColor.name, 'Red');

    // Logging test reading
    assert.equal(typeof logClickHandler, 'function');
    logClickHandler();
    assert.ok(toastMsg.includes('Core #7'));

    // Copying report
    assert.equal(typeof copyClickHandler, 'function');
    await copyClickHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - VFL'));

    // Filter area
    assert.equal(typeof filterClickHandler, 'function');
    filterClickHandler();
    assert.equal(filteredArea, 'Shahdara Town');

    // Clear logs
    assert.equal(typeof clearClickHandler, 'function');
    clearClickHandler();
    assert.equal(toastMsg, 'Cleared VFL test logs');
  } finally {
    globalThis.document = origDoc;
  }
});

test('nav-fusion-splice.js catalogs and constants are properly defined', async () => {
  const {
    FUSION_SPLICE_STORAGE_KEY,
    FUSION_FIBER_TYPES,
    FUSION_ALIGN_MODES,
    FUSION_SLEEVE_TYPES,
    FUSION_SLEEVE_STATUSES,
    SPLICE_QUALITY_GRADES,
    SHAHDARA_SPLICE_CLOSURES
  } = await import('../nav-fusion-splice.js');

  assert.equal(FUSION_SPLICE_STORAGE_KEY, 'shahdara_fusion_splice_records_v1');
  assert.ok(Array.isArray(FUSION_FIBER_TYPES));
  assert.ok(FUSION_FIBER_TYPES.length >= 4);
  assert.ok(FUSION_FIBER_TYPES.some(f => f.id === 'SM_G652D'));

  assert.ok(Array.isArray(FUSION_ALIGN_MODES));
  assert.ok(FUSION_ALIGN_MODES.some(a => a.id === 'PAS_CORE'));
  assert.ok(FUSION_ALIGN_MODES.some(a => a.id === 'CLAD_FIXED'));

  assert.ok(Array.isArray(FUSION_SLEEVE_TYPES));
  assert.ok(FUSION_SLEEVE_TYPES.some(s => s.id === 'SLEEVE_60MM'));

  assert.ok(FUSION_SLEEVE_STATUSES.CURED_SOLID.pass);
  assert.ok(!FUSION_SLEEVE_STATUSES.BUBBLE_INCLUSION.pass);

  assert.equal(SPLICE_QUALITY_GRADES.EXCELLENT.maxLoss, 0.02);
  assert.equal(SPLICE_QUALITY_GRADES.GOOD.maxLoss, 0.05);
  assert.ok(!SPLICE_QUALITY_GRADES.RE_SPLICE.pass);

  assert.ok(Array.isArray(SHAHDARA_SPLICE_CLOSURES));
  assert.ok(SHAHDARA_SPLICE_CLOSURES.length >= 8);
  assert.ok(SHAHDARA_SPLICE_CLOSURES.some(c => c.area === 'Shahdara Town'));
});

test('nav-fusion-splice.js calculateEstimatedSpliceLoss models physics loss accurately', async () => {
  const { calculateEstimatedSpliceLoss } = await import('../nav-fusion-splice.js');

  // Baseline ideal alignment with 0 offset and 0 cleave
  const idealLoss = calculateEstimatedSpliceLoss({
    leftCleaveDeg: 0,
    rightCleaveDeg: 0,
    coreOffsetUm: 0,
    fiberTypeId: 'SM_G652D',
    alignModeId: 'PAS_CORE'
  });
  assert.ok(idealLoss <= 0.015);
  assert.ok(idealLoss >= 0.005);

  // Lateral core offset increases loss quadratically
  const slightOffsetLoss = calculateEstimatedSpliceLoss({
    leftCleaveDeg: 0.3,
    rightCleaveDeg: 0.3,
    coreOffsetUm: 0.2,
    fiberTypeId: 'SM_G652D',
    alignModeId: 'PAS_CORE'
  });
  const highOffsetLoss = calculateEstimatedSpliceLoss({
    leftCleaveDeg: 0.3,
    rightCleaveDeg: 0.3,
    coreOffsetUm: 0.8,
    fiberTypeId: 'SM_G652D',
    alignModeId: 'PAS_CORE'
  });
  assert.ok(highOffsetLoss > slightOffsetLoss);

  // Angular cleave mismatch increases loss
  const matchedCleaveLoss = calculateEstimatedSpliceLoss({
    leftCleaveDeg: 0.5,
    rightCleaveDeg: 0.5,
    coreOffsetUm: 0.1,
    fiberTypeId: 'SM_G652D',
    alignModeId: 'PAS_CORE'
  });
  const mismatchedCleaveLoss = calculateEstimatedSpliceLoss({
    leftCleaveDeg: 0.2,
    rightCleaveDeg: 1.8,
    coreOffsetUm: 0.1,
    fiberTypeId: 'SM_G652D',
    alignModeId: 'PAS_CORE'
  });
  assert.ok(mismatchedCleaveLoss > matchedCleaveLoss);

  // Fixed V-groove clad alignment has higher penalty than active PAS core alignment
  const pasLoss = calculateEstimatedSpliceLoss({
    leftCleaveDeg: 0.5,
    rightCleaveDeg: 0.6,
    coreOffsetUm: 0.2,
    fiberTypeId: 'SM_G652D',
    alignModeId: 'PAS_CORE'
  });
  const cladLoss = calculateEstimatedSpliceLoss({
    leftCleaveDeg: 0.5,
    rightCleaveDeg: 0.6,
    coreOffsetUm: 0.2,
    fiberTypeId: 'SM_G652D',
    alignModeId: 'CLAD_FIXED'
  });
  assert.ok(cladLoss > pasLoss);

  // Clamped boundaries
  const clampedMax = calculateEstimatedSpliceLoss({
    leftCleaveDeg: 5.0,
    rightCleaveDeg: 5.0,
    coreOffsetUm: 2.5,
    fiberTypeId: 'SM_G652D',
    alignModeId: 'CLAD_FIXED'
  });
  assert.ok(clampedMax <= 1.5);
});

test('nav-fusion-splice.js evaluateSpliceQuality grades splices and handles defects', async () => {
  const { evaluateSpliceQuality, SPLICE_QUALITY_GRADES } = await import('../nav-fusion-splice.js');

  // Excellent splice
  const excellent = evaluateSpliceQuality(0.015, 0.4, 0.5, true, 'CURED_SOLID');
  assert.equal(excellent.grade.id, SPLICE_QUALITY_GRADES.EXCELLENT.id);
  assert.equal(excellent.overallPass, true);
  assert.equal(excellent.warnings.length, 0);

  // Good splice
  const good = evaluateSpliceQuality(0.035, 0.6, 0.7, true, 'CURED_SOLID');
  assert.equal(good.grade.id, SPLICE_QUALITY_GRADES.GOOD.id);
  assert.equal(good.overallPass, true);

  // Acceptable splice with advisory
  const acceptable = evaluateSpliceQuality(0.065, 0.8, 0.9, true, 'CURED_SOLID');
  assert.equal(acceptable.grade.id, SPLICE_QUALITY_GRADES.ACCEPTABLE.id);
  assert.equal(acceptable.overallPass, true);
  assert.ok(acceptable.warnings.some(w => w.includes('above optimum')));

  // Marginal splice
  const marginal = evaluateSpliceQuality(0.12, 1.0, 1.1, true, 'CURED_SOLID');
  assert.equal(marginal.grade.id, SPLICE_QUALITY_GRADES.MARGINAL.id);
  assert.equal(marginal.overallPass, false);

  // High loss re-splice
  const failLoss = evaluateSpliceQuality(0.25, 0.9, 0.9, true, 'CURED_SOLID');
  assert.equal(failLoss.grade.id, SPLICE_QUALITY_GRADES.RE_SPLICE.id);
  assert.equal(failLoss.overallPass, false);

  // 200g proof tension test failure
  const proofFail = evaluateSpliceQuality(0.018, 0.4, 0.4, false, 'CURED_SOLID');
  assert.equal(proofFail.grade.id, SPLICE_QUALITY_GRADES.RE_SPLICE.id);
  assert.equal(proofFail.overallPass, false);
  assert.ok(proofFail.warnings.some(w => w.includes('200g mechanical proof')));

  // Excessive cleave angle warning
  const highCleave = evaluateSpliceQuality(0.03, 1.8, 0.5, true, 'CURED_SOLID');
  assert.ok(highCleave.warnings.some(w => w.includes('High cleave angle detected')));
  assert.ok(highCleave.recommendations.some(r => r.includes('cleaver')));

  // Sleeve bubble inclusion defect
  const bubbleDefect = evaluateSpliceQuality(0.02, 0.5, 0.5, true, 'BUBBLE_INCLUSION');
  assert.equal(bubbleDefect.overallPass, false);
  assert.ok(bubbleDefect.warnings.some(w => w.includes('Air Bubble')));
});

test('nav-fusion-splice.js localStorage audit store operations', async () => {
  const {
    FUSION_SPLICE_STORAGE_KEY,
    getSpliceAuditStore,
    saveSpliceAuditStore,
    recordSpliceAudit,
    clearSpliceAuditStore
  } = await import('../nav-fusion-splice.js');

  const memory = new Map();
  const mockStorage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, val) => memory.set(key, String(val)),
    removeItem: (key) => memory.delete(key)
  };

  // Initially empty
  assert.deepEqual(getSpliceAuditStore(mockStorage), []);

  // Record a splice audit entry
  const record1 = recordSpliceAudit({
    closureId: 'clos-sh-01',
    trayNumber: 1,
    inboundCoreNumber: 3,
    outboundCoreNumber: 3,
    fiberTypeId: 'SM_G652D',
    alignModeId: 'PAS_CORE',
    sleeveTypeId: 'SLEEVE_60MM',
    sleeveStatusId: 'CURED_SOLID',
    leftCleaveDeg: 0.4,
    rightCleaveDeg: 0.5,
    coreOffsetUm: 0.1,
    spliceLossDb: 0.019,
    proofTestPassed: true,
    linemanNotes: 'Pole SH-P-04 drop splice'
  }, mockStorage);

  assert.ok(record1.id.startsWith('splice-'));
  assert.equal(record1.inboundCoreNumber, 3);
  assert.equal(record1.inboundFiberName, 'Green');
  assert.equal(record1.overallPass, true);

  const stored = getSpliceAuditStore(mockStorage);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, record1.id);

  // Clear store
  clearSpliceAuditStore(mockStorage);
  assert.deepEqual(getSpliceAuditStore(mockStorage), []);
});

test('nav-fusion-splice.js renderMobileSpliceSvg produces comprehensive vector diagram', async () => {
  const { renderMobileSpliceSvg } = await import('../nav-fusion-splice.js');

  const svg = renderMobileSpliceSvg({
    inboundCoreNumber: 1,
    outboundCoreNumber: 2,
    spliceLossDb: 0.024,
    leftCleaveDeg: 0.5,
    rightCleaveDeg: 0.6,
    coreOffsetUm: 0.12,
    proofTestPassed: true,
    sleeveStatusId: 'CURED_SOLID'
  });

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('fusion-splice-svg'));
  assert.ok(svg.includes('V-GROOVE LEFT'));
  assert.ok(svg.includes('V-GROOVE RIGHT'));
  assert.ok(svg.includes('ESTIMATED ARC LOSS'));
  assert.ok(svg.includes('0.024'));
  assert.ok(svg.includes('200g PULL TENSION'));
  assert.ok(svg.includes('PASS'));
});

test('nav-fusion-splice.js generateSpliceWhatsAppReport formats NOC dispatch report', async () => {
  const { generateSpliceWhatsAppReport } = await import('../nav-fusion-splice.js');

  const report = generateSpliceWhatsAppReport({
    closureId: 'clos-bk-03',
    trayNumber: 2,
    inboundCoreNumber: 5,
    outboundCoreNumber: 5,
    fiberTypeId: 'BIF_G657A1',
    alignModeId: 'PAS_CORE',
    sleeveTypeId: 'SLEEVE_60MM',
    sleeveStatusId: 'CURED_SOLID',
    leftCleaveDeg: 0.4,
    rightCleaveDeg: 0.5,
    coreOffsetUm: 0.08,
    spliceLossDb: 0.016,
    proofTestPassed: true,
    linemanNotes: 'Begum Kot crossing railway crossing fiber joint'
  });

  assert.ok(report.includes('SHAHDARA ISP - OPTICAL FIBER FUSION SPLICE AUDIT'));
  assert.ok(report.includes('Begum Kot'));
  assert.ok(report.includes('Tray: 2'));
  assert.ok(report.includes('Slate'));
  assert.ok(report.includes('0.016 dB'));
  assert.ok(report.includes('APPROVED FOR SERVICE'));
  assert.ok(report.includes('Begum Kot crossing railway crossing'));
});

test('nav-fusion-splice.js setupMobileFusionSpliceModal wires modal events and controls', async () => {
  const { setupMobileFusionSpliceModal } = await import('../nav-fusion-splice.js');

  let modalOpened = false;
  let toastMsg = '';
  let filteredArea = '';
  let copiedText = '';

  const memory = new Map();
  const mockStorage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, val) => memory.set(key, String(val)),
    removeItem: (key) => memory.delete(key)
  };

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: (name, val) => { if (name === 'open') modalOpened = true; },
    removeAttribute: (name) => { if (name === 'open') modalOpened = false; }
  };

  let openHandler = null;
  const mockTriggerBtn = {
    set onclick(fn) { openHandler = fn; },
    get onclick() { return openHandler; }
  };

  let closeHandler = null;
  const mockCloseBtn = {
    set onclick(fn) { closeHandler = fn; },
    get onclick() { return closeHandler; }
  };

  let inboundSliderHandler = null;
  const mockInboundSlider = {
    value: '1',
    set oninput(fn) { inboundSliderHandler = fn; },
    get oninput() { return inboundSliderHandler; }
  };

  const mockInboundInput = { value: '1' };
  const mockSvgContainer = { innerHTML: '' };
  const mockLossDisplay = { textContent: '' };
  const mockGradeBadge = { className: '', textContent: '' };
  const mockWarningsContainer = { innerHTML: '' };
  const mockHistoryTable = { innerHTML: '' };

  let logClickHandler = null;
  const mockRecordBtn = {
    set onclick(fn) { logClickHandler = fn; },
    get onclick() { return logClickHandler; }
  };

  let copyClickHandler = null;
  const mockCopyBtn = {
    set onclick(fn) { copyClickHandler = fn; },
    get onclick() { return copyClickHandler; }
  };

  let filterClickHandler = null;
  const mockFilterBtn = {
    set onclick(fn) { filterClickHandler = fn; },
    get onclick() { return filterClickHandler; }
  };

  let clearClickHandler = null;
  const mockClearBtn = {
    set onclick(fn) { clearClickHandler = fn; },
    get onclick() { return clearClickHandler; }
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'mobileFusionSpliceModal': return mockModal;
        case 'mobileFusionSpliceModalCloseBtn': return mockCloseBtn;
        case 'spliceInboundCoreSlider': return mockInboundSlider;
        case 'spliceInboundCoreInput': return mockInboundInput;
        case 'spliceSvgContainer': return mockSvgContainer;
        case 'spliceLossDisplay': return mockLossDisplay;
        case 'spliceGradeBadge': return mockGradeBadge;
        case 'spliceWarningsContainer': return mockWarningsContainer;
        case 'spliceHistoryTableBody': return mockHistoryTable;
        case 'spliceRecordLogBtn': return mockRecordBtn;
        case 'spliceCopyReportBtn': return mockCopyBtn;
        case 'spliceFilterAreaBtn': return mockFilterBtn;
        case 'spliceClearHistoryBtn': return mockClearBtn;
        default: return null;
      }
    },
    querySelectorAll: (selector) => {
      if (selector === '[data-open-fusion-splice]') {
        return [mockTriggerBtn];
      }
      return [];
    }
  };

  try {
    const controller = setupMobileFusionSpliceModal({
      storage: mockStorage,
      onToast: (msg) => { toastMsg = msg; },
      onFilterArea: (area) => { filteredArea = area; },
      clipboard: {
        writeText: async (text) => { copiedText = text; }
      }
    });

    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');
    assert.equal(typeof controller.getCurrentReading, 'function');

    // Trigger button opens modal
    assert.equal(typeof openHandler, 'function');
    openHandler();
    assert.equal(modalOpened, true);

    // Close button closes modal
    assert.equal(typeof closeHandler, 'function');
    closeHandler();
    assert.equal(modalOpened, false);

    // Inbound slider changes reading
    assert.equal(typeof inboundSliderHandler, 'function');
    inboundSliderHandler({ target: { value: '6' } });
    assert.equal(controller.getCurrentReading().inboundCoreNumber, 6);

    // Logging test reading
    assert.equal(typeof logClickHandler, 'function');
    logClickHandler();
    assert.ok(toastMsg.includes('Logged Fusion Splice Joint'));

    // Copying report
    assert.equal(typeof copyClickHandler, 'function');
    await copyClickHandler();
    assert.ok(copiedText.includes('FUSION SPLICE AUDIT'));

    // Filter area
    assert.equal(typeof filterClickHandler, 'function');
    filterClickHandler();
    assert.equal(filteredArea, 'Shahdara Town');

    // Clear logs
    assert.equal(typeof clearClickHandler, 'function');
    clearClickHandler();
    assert.equal(toastMsg, 'Cleared fusion splice audit log');
  } finally {
    globalThis.document = origDoc;
  }
});

test('nav-wifi-survey.js catalogs and constants are properly defined', async () => {
  const {
    WIFI_SURVEY_STORAGE_KEY,
    WIFI_FREQUENCY_BANDS,
    WIFI_SIGNAL_GRADES,
    OBSTACLE_TYPES,
    SHAHDARA_ROOM_ZONES
  } = await import('../nav-wifi-survey.js');

  assert.equal(WIFI_SURVEY_STORAGE_KEY, 'shahdara_wifi_survey_logs_v1');
  assert.ok(Array.isArray(WIFI_FREQUENCY_BANDS));
  assert.equal(WIFI_FREQUENCY_BANDS.length, 2);
  assert.ok(WIFI_FREQUENCY_BANDS.some(b => b.id === 'BAND_2_4GHZ'));
  assert.ok(WIFI_FREQUENCY_BANDS.some(b => b.id === 'BAND_5GHZ'));

  assert.ok(WIFI_SIGNAL_GRADES.EXCELLENT.pass);
  assert.ok(WIFI_SIGNAL_GRADES.GOOD.pass);
  assert.ok(!WIFI_SIGNAL_GRADES.WEAK.pass);
  assert.ok(!WIFI_SIGNAL_GRADES.DEAD_ZONE.pass);

  assert.ok(Array.isArray(OBSTACLE_TYPES));
  assert.ok(OBSTACLE_TYPES.length >= 6);
  assert.ok(OBSTACLE_TYPES.some(o => o.id === 'BRICK_SINGLE'));

  assert.ok(Array.isArray(SHAHDARA_ROOM_ZONES));
  assert.ok(SHAHDARA_ROOM_ZONES.length >= 5);
  assert.ok(SHAHDARA_ROOM_ZONES.some(r => r.id === 'LIVING_ROOM'));
});

test('nav-wifi-survey.js calculateEstimatedRssi models FSPL and obstacle attenuation', async () => {
  const { calculateEstimatedRssi } = await import('../nav-wifi-survey.js');

  // Short line of sight distance (2m)
  const closeRssi = calculateEstimatedRssi({
    txPowerDbm: 20,
    distanceMeters: 2,
    frequencyGhz: 2.437,
    obstacleLossDb: 0
  });
  assert.ok(closeRssi >= -50);

  // Far distance (15m)
  const farRssi = calculateEstimatedRssi({
    txPowerDbm: 20,
    distanceMeters: 15,
    frequencyGhz: 2.437,
    obstacleLossDb: 0
  });
  assert.ok(farRssi < closeRssi);

  // Brick wall adds attenuation
  const wallRssi = calculateEstimatedRssi({
    txPowerDbm: 20,
    distanceMeters: 5,
    frequencyGhz: 2.437,
    obstacleLossDb: 14 // Double brick
  });
  const openRssi = calculateEstimatedRssi({
    txPowerDbm: 20,
    distanceMeters: 5,
    frequencyGhz: 2.437,
    obstacleLossDb: 0
  });
  assert.ok(wallRssi < openRssi);

  // 5 GHz experiences higher free space attenuation than 2.4 GHz
  const rssi24 = calculateEstimatedRssi({ distanceMeters: 10, frequencyGhz: 2.437 });
  const rssi5 = calculateEstimatedRssi({ distanceMeters: 10, frequencyGhz: 5.240 });
  assert.ok(rssi5 < rssi24);
});

test('nav-wifi-survey.js calculateChannelInterferencePenalty handles overlapping channels', async () => {
  const { calculateChannelInterferencePenalty } = await import('../nav-wifi-survey.js');

  // Standard non-overlapping channel (Ch 6)
  const ch6 = calculateChannelInterferencePenalty(6, 'BAND_2_4GHZ', 1);
  assert.equal(ch6.isRecommended, true);

  // Non-standard overlapping channel (Ch 3)
  const ch3 = calculateChannelInterferencePenalty(3, 'BAND_2_4GHZ', 1);
  assert.equal(ch3.isRecommended, false);
  assert.ok(ch3.interferenceScore > ch6.interferenceScore);
  assert.ok(ch3.penaltyDb > ch6.penaltyDb);

  // More neighbor APs increase interference score
  const crowded = calculateChannelInterferencePenalty(6, 'BAND_2_4GHZ', 5);
  assert.ok(crowded.interferenceScore > ch6.interferenceScore);
});

test('nav-wifi-survey.js evaluateWifiSignalQuality grades signal and estimates PHY throughput', async () => {
  const { evaluateWifiSignalQuality, WIFI_SIGNAL_GRADES } = await import('../nav-wifi-survey.js');

  // Excellent signal
  const excellent = evaluateWifiSignalQuality(-42, -95, 'BAND_5GHZ', 36, 1);
  assert.equal(excellent.grade.id, WIFI_SIGNAL_GRADES.EXCELLENT.id);
  assert.ok(excellent.estimatedThroughputMbps > 300);
  assert.equal(excellent.warnings.length, 0);

  // Fair signal
  const fair = evaluateWifiSignalQuality(-72, -95, 'BAND_2_4GHZ', 6, 2);
  assert.equal(fair.grade.id, WIFI_SIGNAL_GRADES.FAIR.id);

  // Dead zone
  const deadZone = evaluateWifiSignalQuality(-90, -95, 'BAND_2_4GHZ', 6, 4);
  assert.equal(deadZone.grade.id, WIFI_SIGNAL_GRADES.DEAD_ZONE.id);
  assert.equal(deadZone.grade.pass, false);
  assert.ok(deadZone.warnings.some(w => w.includes('Severe signal attenuation')));
  assert.ok(deadZone.recommendations.some(r => r.includes('Access Point')));
});

test('nav-wifi-survey.js localStorage audit store operations', async () => {
  const {
    WIFI_SURVEY_STORAGE_KEY,
    getWifiSurveyStore,
    saveWifiSurveyStore,
    recordWifiSurvey,
    clearWifiSurveyStore
  } = await import('../nav-wifi-survey.js');

  const memory = new Map();
  const mockStorage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, val) => memory.set(key, String(val)),
    removeItem: (key) => memory.delete(key)
  };

  assert.deepEqual(getWifiSurveyStore(mockStorage), []);

  const saved = recordWifiSurvey({
    customerName: 'Tariq Mehmood',
    area: 'Baradari Road',
    roomId: 'GUEST_BAITHAK',
    distanceMeters: 6,
    obstacleId: 'BRICK_SINGLE',
    bandId: 'BAND_2_4GHZ',
    channelNumber: 1,
    neighborApCount: 1,
    rssiDbm: -58,
    linemanNotes: 'Signal solid on 2.4GHz'
  }, mockStorage);

  assert.ok(saved.id.startsWith('wifi-'));
  assert.equal(saved.customerName, 'Tariq Mehmood');
  assert.equal(saved.channelNumber, 1);
  assert.equal(saved.pass, true);

  const list = getWifiSurveyStore(mockStorage);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, saved.id);

  clearWifiSurveyStore(mockStorage);
  assert.deepEqual(getWifiSurveyStore(mockStorage), []);
});

test('nav-wifi-survey.js renderMobileWifiSurveySvg outputs vector graphics with RSSI gauge', async () => {
  const { renderMobileWifiSurveySvg } = await import('../nav-wifi-survey.js');

  const svg = renderMobileWifiSurveySvg({
    rssiDbm: -55,
    bandId: 'BAND_2_4GHZ',
    channelNumber: 6,
    neighborApCount: 2,
    estimatedThroughputMbps: 95
  });

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('wifi-survey-svg'));
  assert.ok(svg.includes('IN-ROOM SIGNAL RSSI'));
  assert.ok(svg.includes('-55 dBm'));
  assert.ok(svg.includes('RADIO SPECTRUM: 2.4 GHz'));
  assert.ok(svg.includes('Ch 6'));
  assert.ok(svg.includes('PHY LINK SPEED'));
});

test('nav-wifi-survey.js generateWifiSurveyReport formats WhatsApp dispatch message', async () => {
  const { generateWifiSurveyReport } = await import('../nav-wifi-survey.js');

  const report = generateWifiSurveyReport({
    customerName: 'Zahid Khan',
    area: 'Begum Kot',
    roomId: 'BEDROOM_2',
    distanceMeters: 12,
    obstacleId: 'CONCRETE_SLAB',
    bandId: 'BAND_5GHZ',
    channelNumber: 36,
    neighborApCount: 1,
    rssiDbm: -68,
    linemanNotes: 'Customer requested 5GHz gaming setup'
  });

  assert.ok(report.includes('SHAHDARA ISP - IN-HOME WI-FI COVERAGE AUDIT'));
  assert.ok(report.includes('Zahid Khan'));
  assert.ok(report.includes('Begum Kot'));
  assert.ok(report.includes('First Floor Upper Bedroom'));
  assert.ok(report.includes('-68 dBm'));
  assert.ok(report.includes('Customer requested 5GHz gaming setup'));
});

test('nav-wifi-survey.js setupMobileWifiSurveyModal wires modal dialog and interactions', async () => {
  const { setupMobileWifiSurveyModal } = await import('../nav-wifi-survey.js');

  let modalOpened = false;
  let toastMsg = '';
  let filteredArea = '';
  let copiedText = '';

  const memory = new Map();
  const mockStorage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, val) => memory.set(key, String(val)),
    removeItem: (key) => memory.delete(key)
  };

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: (name, val) => { if (name === 'open') modalOpened = true; },
    removeAttribute: (name) => { if (name === 'open') modalOpened = false; }
  };

  let openHandler = null;
  const mockTriggerBtn = {
    set onclick(fn) { openHandler = fn; },
    get onclick() { return openHandler; }
  };

  let closeHandler = null;
  const mockCloseBtn = {
    set onclick(fn) { closeHandler = fn; },
    get onclick() { return closeHandler; }
  };

  let distanceSliderHandler = null;
  const mockDistSlider = {
    value: '2',
    set oninput(fn) { distanceSliderHandler = fn; },
    get oninput() { return distanceSliderHandler; }
  };

  const mockDistVal = { textContent: '' };
  const mockSvgContainer = { innerHTML: '' };
  const mockRssiDisplay = { textContent: '' };
  const mockGradeBadge = { className: '', textContent: '' };
  const mockWarningsContainer = { innerHTML: '' };
  const mockHistoryTable = { innerHTML: '' };
  const mockChannelSelect = { innerHTML: '', value: '6' };

  let logClickHandler = null;
  const mockRecordBtn = {
    set onclick(fn) { logClickHandler = fn; },
    get onclick() { return logClickHandler; }
  };

  let copyClickHandler = null;
  const mockCopyBtn = {
    set onclick(fn) { copyClickHandler = fn; },
    get onclick() { return copyClickHandler; }
  };

  let filterClickHandler = null;
  const mockFilterBtn = {
    set onclick(fn) { filterClickHandler = fn; },
    get onclick() { return filterClickHandler; }
  };

  let clearClickHandler = null;
  const mockClearBtn = {
    set onclick(fn) { clearClickHandler = fn; },
    get onclick() { return clearClickHandler; }
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'mobileWifiSurveyModal': return mockModal;
        case 'mobileWifiSurveyModalCloseBtn': return mockCloseBtn;
        case 'wifiDistanceSlider': return mockDistSlider;
        case 'wifiDistanceVal': return mockDistVal;
        case 'wifiChannelSelect': return mockChannelSelect;
        case 'wifiSvgContainer': return mockSvgContainer;
        case 'wifiRssiDisplay': return mockRssiDisplay;
        case 'wifiGradeBadge': return mockGradeBadge;
        case 'wifiWarningsContainer': return mockWarningsContainer;
        case 'wifiHistoryTableBody': return mockHistoryTable;
        case 'wifiRecordLogBtn': return mockRecordBtn;
        case 'wifiCopyReportBtn': return mockCopyBtn;
        case 'wifiFilterAreaBtn': return mockFilterBtn;
        case 'wifiClearHistoryBtn': return mockClearBtn;
        default: return null;
      }
    },
    querySelectorAll: (selector) => {
      if (selector === '[data-open-wifi-survey]') {
        return [mockTriggerBtn];
      }
      return [];
    }
  };

  try {
    const controller = setupMobileWifiSurveyModal({
      storage: mockStorage,
      onToast: (msg) => { toastMsg = msg; },
      onFilterArea: (area) => { filteredArea = area; },
      clipboard: {
        writeText: async (text) => { copiedText = text; }
      }
    });

    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');
    assert.equal(typeof controller.getCurrentReading, 'function');

    // Trigger button opens modal
    assert.equal(typeof openHandler, 'function');
    openHandler();
    assert.equal(modalOpened, true);

    // Close button closes modal
    assert.equal(typeof closeHandler, 'function');
    closeHandler();
    assert.equal(modalOpened, false);

    // Distance slider change
    assert.equal(typeof distanceSliderHandler, 'function');
    distanceSliderHandler({ target: { value: '8' } });
    assert.equal(controller.getCurrentReading().distanceMeters, 8);

    // Logging test reading
    assert.equal(typeof logClickHandler, 'function');
    logClickHandler();
    assert.ok(toastMsg.includes('Logged Wi-Fi Survey'));

    // Copying report
    assert.equal(typeof copyClickHandler, 'function');
    await copyClickHandler();
    assert.ok(copiedText.includes('WI-FI COVERAGE AUDIT'));

    // Filter area
    assert.equal(typeof filterClickHandler, 'function');
    filterClickHandler();
    assert.equal(filteredArea, 'Shahdara Town');

    // Clear logs
    assert.equal(typeof clearClickHandler, 'function');
    clearClickHandler();
    assert.equal(toastMsg, 'Cleared Wi-Fi survey logs');
  } finally {
    globalThis.document = origDoc;
  }
});

// ============================================================================
// FIELD TECHNICIAN OPTICAL LINK LOSS BUDGET ASSISTANT TESTS
// ============================================================================

test('nav-optical-budget.js calculates ITU-T G.984 GPON Class C+ attenuation accurately', async () => {
  const { calculateOpticalLinkBudget, evaluateOpticalBudgetQuality } = await import('../nav-optical-budget.js');

  const budget = calculateOpticalLinkBudget({
    ponStandardId: 'GPON_CLASS_C_PLUS',
    wavelengthNm: '1490',
    distanceMeters: 3500,
    primarySplitter: '1:8',
    secondarySplitter: '1:8',
    fusionSplices: 4,
    mechanicalSplices: 0,
    connectorPairs: 4
  });

  assert.equal(budget.fiberLossDb, 0.98); // 3500m * 0.28 dB/km
  assert.equal(budget.totalSplitterLossDb, 21.0); // 10.5 + 10.5
  assert.equal(budget.jointLoss.totalJointLossDb, 1.72); // 4 * 0.08 + 4 * 0.35
  assert.equal(budget.totalAttenuationDb, 23.7); // 0.98 + 21.0 + 1.72
  assert.equal(budget.expectedRxPowerDbm, -18.7); // 5.0 - 23.7
  assert.equal(budget.headroomMarginDb, 11.3); // -18.7 - (-30.0)
  assert.equal(budget.evaluation.pass, true);
  assert.equal(budget.evaluation.id, 'OPTIMAL_PASS');

  const assessmentPass = evaluateOpticalBudgetQuality(-18.3, -30.0);
  assert.equal(assessmentPass.id, 'OPTIMAL_PASS');
  assert.equal(assessmentPass.pass, true);

  const assessmentFail = evaluateOpticalBudgetQuality(-31.5, -30.0);
  assert.equal(assessmentFail.id, 'CRITICAL_FAIL');
  assert.equal(assessmentFail.pass, false);
});

test('nav-optical-budget.js handles XGS-PON and long-distance attenuation calculation', async () => {
  const { calculateOpticalLinkBudget } = await import('../nav-optical-budget.js');

  const xgsBudget = calculateOpticalLinkBudget({
    ponStandardId: 'XGS_PON_CLASS_N1',
    wavelengthNm: '1577',
    distanceMeters: 12000,
    primarySplitter: '1:4',
    secondarySplitter: '1:16',
    fusionSplices: 8,
    mechanicalSplices: 0,
    connectorPairs: 4
  });

  assert.equal(xgsBudget.fiberLossDb, 2.4); // 12000m * 0.20 dB/km
  assert.equal(xgsBudget.primarySplitterLossDb, 7.2);
  assert.equal(xgsBudget.secondarySplitterLossDb, 13.8);
  assert.equal(xgsBudget.totalSplitterLossDb, 21.0);
  assert.equal(xgsBudget.totalSubscribersPerPort, 64);
  assert.ok(xgsBudget.totalAttenuationDb > 24.0);
});

test('nav-optical-budget.js generates valid waterfall SVG and WhatsApp lineworker report', async () => {
  const { calculateOpticalLinkBudget, renderMobileOpticalBudgetSvg, generateOpticalBudgetWhatsAppReport } = await import('../nav-optical-budget.js');

  const budget = calculateOpticalLinkBudget({
    ponStandardId: 'GPON_CLASS_C_PLUS',
    distanceMeters: 2800,
    primarySplitter: '1:8',
    secondarySplitter: '1:8'
  });

  const svg = renderMobileOpticalBudgetSvg(budget);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('viewBox="0 0 760 320"'));
  assert.ok(svg.includes('Optical Power (dBm)'));
  assert.ok(svg.includes('Fiber Span'));
  assert.ok(svg.includes('Splitter 1'));

  const report = generateOpticalBudgetWhatsAppReport(budget, {
    customerName: 'Muhammad Tariq',
    poleLocation: 'Saeed Park Pole 12'
  });

  assert.ok(report.includes('OPTICAL LINK BUDGET REPORT'));
  assert.ok(report.includes('Muhammad Tariq'));
  assert.ok(report.includes('Saeed Park Pole 12'));
  assert.ok(report.includes('Total Link Attenuation:'));
  assert.ok(report.includes('Expected Rx Power:'));
});

test('nav-optical-budget.js persists and retrieves audit records from local storage', async () => {
  const { getOpticalBudgetStore, saveOpticalBudgetStore, recordOpticalBudgetCalculation, clearOpticalBudgetStore, OPTICAL_BUDGET_STORAGE_KEY } = await import('../nav-optical-budget.js');

  const memoryStore = new Map();
  const mockStorage = {
    getItem: (k) => memoryStore.get(k) || null,
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k)
  };

  assert.deepEqual(getOpticalBudgetStore(mockStorage), []);

  const testEntry = {
    distanceMeters: 2800,
    expectedRxPowerDbm: -18.5,
    headroomMarginDb: 8.5,
    totalAttenuationDb: 23.5,
    evaluation: { pass: true, id: 'OPTIMAL_PASS', badgeClass: 'badge-success' }
  };

  const saved = recordOpticalBudgetCalculation(testEntry, mockStorage);
  assert.ok(saved.id.startsWith('opt-budget-'));
  assert.ok(memoryStore.has(OPTICAL_BUDGET_STORAGE_KEY));

  const loaded = getOpticalBudgetStore(mockStorage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].distanceMeters, 2800);

  clearOpticalBudgetStore(mockStorage);
  assert.deepEqual(getOpticalBudgetStore(mockStorage), []);
});

test('index.html and nav.css contain all optical budget assistant triggers and modal elements', () => {
  // Navigation trigger hooks
  assert.match(index, /id="navOpticalBudgetBtn"/);
  assert.match(index, /data-open-optical-budget/);
  assert.match(index, /id="mobileMoreOpticalBudgetBtn"/);
  assert.match(index, /id="actionSheetOpticalBudgetBtn"/);
  assert.match(index, /id="speedDialOpticalBudgetBtn"/);

  // Dialog and control IDs
  assert.match(index, /<dialog id="mobileOpticalBudgetModal"/);
  assert.match(index, /id="mobileOpticalBudgetModalCloseBtn"/);
  assert.match(index, /id="opticalBudgetPresetSelect"/);
  assert.match(index, /id="opticalBudgetStandardSelect"/);
  assert.match(index, /id="opticalBudgetWavelengthSelect"/);
  assert.match(index, /id="opticalBudgetDistanceInput"/);
  assert.match(index, /id="opticalBudgetPrimarySplitterSelect"/);
  assert.match(index, /id="opticalBudgetSecondarySplitterSelect"/);
  assert.match(index, /id="opticalBudgetFusionSpliceInput"/);
  assert.match(index, /id="opticalBudgetMechSpliceInput"/);
  assert.match(index, /id="opticalBudgetConnPairsInput"/);
  assert.match(index, /id="opticalBudgetTxPowerInput"/);
  assert.match(index, /id="opticalBudgetChartWrap"/);
  assert.match(index, /id="opticalBudgetKpiRxPower"/);
  assert.match(index, /id="opticalBudgetKpiMargin"/);
  assert.match(index, /id="opticalBudgetKpiTotalLoss"/);
  assert.match(index, /id="opticalBudgetKpiStatus"/);
  assert.match(index, /id="opticalBudgetSaveRecordBtn"/);
  assert.match(index, /id="opticalBudgetWhatsAppReportBtn"/);
  assert.match(index, /id="opticalBudgetResetBtn"/);
  assert.match(index, /id="opticalBudgetClearHistoryBtn"/);
  assert.match(index, /id="opticalBudgetHistoryList"/);

  // nav.css checks
  const navCss = read('nav.css');
  assert.match(navCss, /\.optical-budget-modal/);
  assert.match(navCss, /\.optical-budget-kpis/);
  assert.match(navCss, /\.optical-budget-svg/);
  assert.match(navCss, /\.optical-budget-chart-wrap/);
  assert.match(navCss, /\[data-theme="dark"\]\s*\.optical-budget-modal/);
});

test('setupMobileOpticalBudgetModal interacts cleanly with DOM events and modal actions', async () => {
  const { setupMobileOpticalBudgetModal } = await import('../nav-optical-budget.js');

  const listeners = new Map();
  const createElement = (tag) => ({
    tagName: tag.toUpperCase(),
    value: '',
    textContent: '',
    innerHTML: '',
    className: '',
    hidden: false,
    style: {},
    addEventListener: (evt, fn) => {
      listeners.set(evt, fn);
    },
    dispatchEvent: (e) => {
      const fn = listeners.get(e.type);
      if (fn) fn(e);
    },
    focus: () => {},
    showModal() { this.open = true; },
    close() { this.open = false; },
    querySelectorAll: () => [],
    appendChild: () => {}
  });

  const elements = {
    mobileOpticalBudgetModal: { ...createElement('dialog'), open: false },
    mobileOpticalBudgetModalCloseBtn: createElement('button'),
    opticalBudgetPresetSelect: { ...createElement('select'), value: 'PRESET_SHAHDARA_TOWN' },
    opticalBudgetStandardSelect: { ...createElement('select'), value: 'GPON_CLASS_B_PLUS' },
    opticalBudgetWavelengthSelect: { ...createElement('select'), value: '1490' },
    opticalBudgetDistanceInput: { ...createElement('input'), value: '2800' },
    opticalBudgetPrimarySplitterSelect: { ...createElement('select'), value: '1:8' },
    opticalBudgetSecondarySplitterSelect: { ...createElement('select'), value: '1:8' },
    opticalBudgetFusionSpliceInput: { ...createElement('input'), value: '4' },
    opticalBudgetMechSpliceInput: { ...createElement('input'), value: '0' },
    opticalBudgetConnPairsInput: { ...createElement('input'), value: '2' },
    opticalBudgetTxPowerInput: { ...createElement('input'), value: '' },
    opticalBudgetChartWrap: createElement('div'),
    opticalBudgetKpiRxPower: createElement('span'),
    opticalBudgetKpiMargin: createElement('span'),
    opticalBudgetKpiTotalLoss: createElement('span'),
    opticalBudgetKpiStatus: createElement('span'),
    opticalBudgetHistoryList: createElement('ul'),
    opticalBudgetSaveRecordBtn: createElement('button'),
    opticalBudgetWhatsAppReportBtn: createElement('button'),
    opticalBudgetResetBtn: createElement('button'),
    opticalBudgetClearHistoryBtn: createElement('button')
  };

  const triggerBtn = createElement('button');
  let toastMessage = '';

  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '[data-open-optical-budget]') return [triggerBtn];
      return [];
    },
    createElement: (tag) => createElement(tag)
  };

  try {
    const controller = setupMobileOpticalBudgetModal({
      storage: mockStorage,
      onToast: (msg) => { toastMessage = msg; }
    });

    assert.ok(controller);
    assert.equal(typeof controller.updateView, 'function');
    assert.equal(typeof controller.renderHistory, 'function');
    assert.equal(typeof controller.calculate, 'function');

    // Trigger button should open modal
    const calc = controller.calculate({ distanceMeters: 3000 });
    assert.equal(calc.distanceMeters, 3000);
    assert.ok(calc.totalAttenuationDb > 0);
  } finally {
    globalThis.document = origDoc;
  }
});

/* ========================================================================= */
/* Field Technician FAT / FDT Port Allocation Matrix Suite Tests             */
/* ========================================================================= */

test('DEFAULT_SHAHDARA_FAT_ENCLOSURES contains canonical Shahdara OSP nodes', async () => {
  const { DEFAULT_SHAHDARA_FAT_ENCLOSURES } = await import('../nav.js');

  assert.ok(Array.isArray(DEFAULT_SHAHDARA_FAT_ENCLOSURES));
  assert.equal(DEFAULT_SHAHDARA_FAT_ENCLOSURES.length, 5);

  const baradari = DEFAULT_SHAHDARA_FAT_ENCLOSURES.find(e => e.id === 'FAT-BAR-01');
  assert.ok(baradari);
  assert.equal(baradari.totalPorts, 16);
  assert.equal(baradari.ports.length, 16);
  assert.equal(baradari.area, 'Baradari Road');
  assert.ok(baradari.feederCore.includes('Green'));

  const vandala = DEFAULT_SHAHDARA_FAT_ENCLOSURES.find(e => e.id === 'FAT-VAN-04');
  assert.ok(vandala);
  assert.equal(vandala.totalPorts, 8);
  assert.equal(vandala.ports.length, 8);
});

test('calculateFatCapacitySummary computes correct port counts and saturation labels', async () => {
  const { calculateFatCapacitySummary } = await import('../nav.js');

  // Test with standard 16-port FAT
  const testEnc = {
    id: 'FAT-TEST-01',
    totalPorts: 16,
    ports: [
      { portNumber: 1, status: 'ACTIVE' },
      { portNumber: 2, status: 'ACTIVE' },
      { portNumber: 3, status: 'ACTIVE' },
      { portNumber: 4, status: 'ACTIVE' },
      { portNumber: 5, status: 'ACTIVE' },
      { portNumber: 6, status: 'ACTIVE' },
      { portNumber: 7, status: 'ACTIVE' },
      { portNumber: 8, status: 'ACTIVE' },
      { portNumber: 9, status: 'ACTIVE' },
      { portNumber: 10, status: 'ACTIVE' },
      { portNumber: 11, status: 'RESERVED' },
      { portNumber: 12, status: 'FAULTY' },
      { portNumber: 13, status: 'SPARE' },
      { portNumber: 14, status: 'SPARE' },
      { portNumber: 15, status: 'SPARE' },
      { portNumber: 16, status: 'SPARE' }
    ]
  };

  const cap = calculateFatCapacitySummary(testEnc);
  assert.equal(cap.totalPorts, 16);
  assert.equal(cap.activePorts, 10);
  assert.equal(cap.reservedPorts, 1);
  assert.equal(cap.faultyPorts, 1);
  assert.equal(cap.sparePorts, 4);
  assert.equal(cap.occupiedPorts, 11);
  assert.equal(cap.utilizationPercent, 68.8);
  assert.equal(cap.saturationStatus, 'NORMAL');

  // Test with high saturation (>= 70% and < 90%)
  testEnc.ports[12].status = 'ACTIVE';
  const capHigh = calculateFatCapacitySummary(testEnc);
  assert.equal(capHigh.occupiedPorts, 12);
  assert.equal(capHigh.utilizationPercent, 75);
  assert.equal(capHigh.saturationStatus, 'HIGH');

  // Test with critical full (>= 90%)
  testEnc.ports[13].status = 'ACTIVE';
  testEnc.ports[14].status = 'ACTIVE';
  testEnc.ports[15].status = 'RESERVED';
  const capCrit = calculateFatCapacitySummary(testEnc);
  assert.equal(capCrit.occupiedPorts, 15);
  assert.equal(capCrit.utilizationPercent, 93.8);
  assert.equal(capCrit.saturationStatus, 'CRITICAL_FULL');

  // Test empty/invalid
  const capEmpty = calculateFatCapacitySummary(null);
  assert.equal(capEmpty.totalPorts, 0);
  assert.equal(capEmpty.utilizationPercent, 0);
});

test('evaluatePortOpticalHealth classifies signal levels according to ITU-T standards', async () => {
  const { evaluatePortOpticalHealth } = await import('../nav.js');

  assert.equal(evaluatePortOpticalHealth(0).id, 'NO_LIGHT');
  assert.equal(evaluatePortOpticalHealth(NaN).id, 'NO_LIGHT');
  assert.equal(evaluatePortOpticalHealth(-5.0).id, 'OVERLOAD');
  assert.equal(evaluatePortOpticalHealth(-18.5).id, 'OPTIMAL');
  assert.equal(evaluatePortOpticalHealth(-24.0).id, 'OPTIMAL');
  assert.equal(evaluatePortOpticalHealth(-14.0).id, 'OPTIMAL');
  assert.equal(evaluatePortOpticalHealth(-10.0).id, 'ACCEPTABLE');
  assert.equal(evaluatePortOpticalHealth(-26.5).id, 'ACCEPTABLE');
  assert.equal(evaluatePortOpticalHealth(-27.5).id, 'MARGINAL');
  assert.equal(evaluatePortOpticalHealth(-28.4).id, 'MARGINAL');
  assert.equal(evaluatePortOpticalHealth(-29.0).id, 'CRITICAL_LOW');
  assert.equal(evaluatePortOpticalHealth(-34.5).id, 'CRITICAL_LOW');
});

test('evaluateDropCableSpan assesses FTTH pole-to-home distance safely', async () => {
  const { evaluateDropCableSpan } = await import('../nav.js');

  const spanShort = evaluateDropCableSpan(80);
  assert.equal(spanShort.label, 'Optimal Drop Span (≤ 150m)');

  const spanStd = evaluateDropCableSpan(200);
  assert.equal(spanStd.label, 'Standard Pole Span (151 - 250m)');

  const spanLong = evaluateDropCableSpan(320);
  assert.equal(spanLong.label, 'Extended Span Warning (> 250m)');
});

test('getFatAllocationsStore and saveFatAllocationsStore manage local persistence', async () => {
  const { getFatAllocationsStore, saveFatAllocationsStore, FDT_ALLOCATIONS_STORAGE_KEY } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  // Initially empty - should seed defaults
  const initial = getFatAllocationsStore(mockStorage);
  assert.ok(Array.isArray(initial));
  assert.equal(initial.length, 5);
  assert.ok(store[FDT_ALLOCATIONS_STORAGE_KEY]);

  // Modify and save
  initial[0].area = 'Updated Baradari Sector A';
  saveFatAllocationsStore(initial, mockStorage);

  const reloaded = getFatAllocationsStore(mockStorage);
  assert.equal(reloaded[0].area, 'Updated Baradari Sector A');
});

test('updatePortAllocation modifies port fields and sets timestamp', async () => {
  const { updatePortAllocation, getFatAllocationsStore } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  // Seed store
  getFatAllocationsStore(mockStorage);

  const updatedEnc = updatePortAllocation('FAT-BAR-01', 9, {
    status: 'ACTIVE',
    customerName: 'Khurram Shehzad',
    subscriberId: 'CUST-2099',
    address: 'House 77, Baradari Main',
    dropLengthMeters: 110,
    rxPowerDbm: -18.7,
    connectorPolish: 'SC_APC',
    notes: 'Newly spliced drop'
  }, mockStorage);

  assert.ok(updatedEnc);
  const p9 = updatedEnc.ports.find(p => p.portNumber === 9);
  assert.equal(p9.status, 'ACTIVE');
  assert.equal(p9.customerName, 'Khurram Shehzad');
  assert.equal(p9.subscriberId, 'CUST-2099');
  assert.equal(p9.dropLengthMeters, 110);
  assert.equal(p9.rxPowerDbm, -18.7);
  assert.ok(p9.updatedAt);

  // Non-existent enclosure returns null
  assert.equal(updatePortAllocation('NON_EXISTENT', 1, {}, mockStorage), null);
  // Non-existent port returns null
  assert.equal(updatePortAllocation('FAT-BAR-01', 999, {}, mockStorage), null);
});

test('resetPortToSpare clears customer allocation back to spare', async () => {
  const { resetPortToSpare, getFatAllocationsStore } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  getFatAllocationsStore(mockStorage);

  const enc = resetPortToSpare('FAT-BAR-01', 1, mockStorage);
  const p1 = enc.ports.find(p => p.portNumber === 1);
  assert.equal(p1.status, 'SPARE');
  assert.equal(p1.customerName, '');
  assert.equal(p1.subscriberId, '');
  assert.equal(p1.dropLengthMeters, 0);
  assert.equal(p1.rxPowerDbm, 0);
});

test('resetFatStoreToDefault resets all enclosures back to factory seeds', async () => {
  const { resetFatStoreToDefault, updatePortAllocation, getFatAllocationsStore } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  getFatAllocationsStore(mockStorage);
  updatePortAllocation('FAT-BAR-01', 1, { customerName: 'Custom Edited Customer' }, mockStorage);

  const resetList = resetFatStoreToDefault(mockStorage);
  const p1 = resetList.find(e => e.id === 'FAT-BAR-01').ports.find(p => p.portNumber === 1);
  assert.equal(p1.customerName, 'Sample Customer One');
});

test('renderMobileFdtMatrixSvg outputs valid vector elements and port nodes', async () => {
  const { renderMobileFdtMatrixSvg, DEFAULT_SHAHDARA_FAT_ENCLOSURES } = await import('../nav.js');

  const baradari = DEFAULT_SHAHDARA_FAT_ENCLOSURES[0];
  const svg = renderMobileFdtMatrixSvg(baradari, 2);

  assert.ok(svg.includes('<svg viewBox="0 0 720 380"'));
  assert.ok(svg.includes('FAT-BAR-01'));
  assert.ok(svg.includes('INBOUND FEEDER'));
  assert.ok(svg.includes('1:16 PLC Cassette'));
  assert.ok(svg.includes('data-port="1"'));
  assert.ok(svg.includes('data-port="2"'));
  assert.ok(svg.includes('data-port="16"'));
  assert.ok(svg.includes('is-selected')); // Port 2 is selected

  // Check 8-port enclosure
  const vandala = DEFAULT_SHAHDARA_FAT_ENCLOSURES[1];
  const svg8 = renderMobileFdtMatrixSvg(vandala, 1);
  assert.ok(svg8.includes('FAT-VAN-04'));
  assert.ok(svg8.includes('1:8 PLC Cassette'));

  // Null enclosure test
  const emptySvg = renderMobileFdtMatrixSvg(null);
  assert.ok(emptySvg.includes('No Enclosure Selected'));
});

test('generateFdtAllocationWhatsAppReport formats field lineman dispatch message', async () => {
  const { generateFdtAllocationWhatsAppReport, DEFAULT_SHAHDARA_FAT_ENCLOSURES } = await import('../nav.js');

  const baradari = DEFAULT_SHAHDARA_FAT_ENCLOSURES[0];
  const report = generateFdtAllocationWhatsAppReport(baradari, 1);

  assert.ok(report.includes('SHAHDARA FIBER NET - FAT PORT DISPATCH REPORT'));
  assert.ok(report.includes('FAT-BAR-01'));
  assert.ok(report.includes('Port #1'));
  assert.ok(report.includes('Sample Customer One'));
  assert.ok(report.includes('CUST-1042'));
  assert.ok(report.includes('85 meters'));
  assert.ok(report.includes('-18.6 dBm'));
  assert.ok(report.includes('ENCLOSURE CAPACITY STATUS'));

  // Faulty port test
  const faultyReport = generateFdtAllocationWhatsAppReport(baradari, 8);
  assert.ok(faultyReport.includes('INSPECT CONNECTOR FERRULE'));
});

test('setupMobileFdtAllocationModal wires DOM controls and handles interactions', async () => {
  const { setupMobileFdtAllocationModal } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const listeners = new Map();
  function makeMockElement(id) {
    const el = {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      children: [],
      dataset: {},
      selected: false,
      appendChild(c) { this.children.push(c); },
      addEventListener(ev, fn) { listeners.set(`${id}:${ev}`, fn); },
      dispatchEvent(e) {
        const fn = listeners.get(`${id}:${e.type}`);
        if (fn) fn(e);
      },
      querySelectorAll: (sel) => []
    };
    return el;
  }

  const modal = makeMockElement('mobileFdtAllocationModal');
  modal.showModal = () => { modal.open = true; };
  modal.close = () => { modal.open = false; };
  modal.setAttribute = (k, v) => { modal[k] = v; };
  modal.removeAttribute = (k) => { delete modal[k]; };

  const closeBtn = makeMockElement('mobileFdtAllocationCloseBtn');
  const encSelect = makeMockElement('fdtEnclosureSelect');
  const svgContainer = makeMockElement('fdtEnclosureSvgContainer');
  const metricsBar = makeMockElement('fdtMetricsBar');
  const formSection = makeMockElement('fdtPortEditForm');
  const portNumSpan = makeMockElement('fdtEditPortNumber');
  const portStatusSelect = makeMockElement('fdtEditStatus');
  const custNameInput = makeMockElement('fdtEditCustomerName');
  const custIdInput = makeMockElement('fdtEditSubscriberId');
  const custAddressInput = makeMockElement('fdtEditAddress');
  const dropLengthInput = makeMockElement('fdtEditDropLength');
  const rxPowerInput = makeMockElement('fdtEditRxPower');
  const polishSelect = makeMockElement('fdtEditPolish');
  const notesInput = makeMockElement('fdtEditNotes');
  const savePortBtn = makeMockElement('fdtSavePortBtn');
  const resetSpareBtn = makeMockElement('fdtResetSpareBtn');
  const whatsappBtn = makeMockElement('fdtWhatsappReportBtn');
  const resetStoreBtn = makeMockElement('fdtResetDefaultStoreBtn');
  const triggerBtn = makeMockElement('triggerBtn');

  const elements = {
    mobileFdtAllocationModal: modal,
    mobileFdtAllocationCloseBtn: closeBtn,
    fdtEnclosureSelect: encSelect,
    fdtEnclosureSvgContainer: svgContainer,
    fdtMetricsBar: metricsBar,
    fdtPortEditForm: formSection,
    fdtEditPortNumber: portNumSpan,
    fdtEditStatus: portStatusSelect,
    fdtEditCustomerName: custNameInput,
    fdtEditSubscriberId: custIdInput,
    fdtEditAddress: custAddressInput,
    fdtEditDropLength: dropLengthInput,
    fdtEditRxPower: rxPowerInput,
    fdtEditPolish: polishSelect,
    fdtEditNotes: notesInput,
    fdtSavePortBtn: savePortBtn,
    fdtResetSpareBtn: resetSpareBtn,
    fdtWhatsappReportBtn: whatsappBtn,
    fdtResetDefaultStoreBtn: resetStoreBtn
  };

  let toastMessage = '';
  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '[data-open-fdt-allocation]') return [triggerBtn];
      return [];
    },
    createElement: (tag) => makeMockElement(tag)
  };

  try {
    const controller = setupMobileFdtAllocationModal({
      storage: mockStorage,
      onToast: (msg) => { toastMessage = msg; }
    });

    assert.ok(controller);
    assert.equal(typeof controller.updateView, 'function');
    assert.equal(typeof controller.selectPort, 'function');
    assert.equal(typeof controller.getEnclosures, 'function');

    // Trigger button opens modal
    const triggerFn = listeners.get('triggerBtn:click');
    if (triggerFn) triggerFn();
    assert.ok(modal.open);

    // Close button closes modal
    const closeFn = listeners.get('mobileFdtAllocationCloseBtn:click');
    if (closeFn) closeFn();
    assert.equal(modal.open, false);

    // Select port 3
    controller.selectPort(3);
    assert.equal(portNumSpan.textContent, 'Port #3');
    assert.equal(custNameInput.value, 'Usman Ghani');

    // Save modified port
    custNameInput.value = 'Usman Ghani (Fiber Upgraded)';
    const saveFn = listeners.get('fdtSavePortBtn:click');
    if (saveFn) saveFn();
    assert.ok(toastMessage.includes('Port #3 allocation saved'));

    // Reset port to spare
    const resetSpareFn = listeners.get('fdtResetSpareBtn:click');
    if (resetSpareFn) resetSpareFn();
    assert.ok(toastMessage.includes('reset to SPARE'));
    assert.equal(portStatusSelect.value, 'SPARE');

    // Reset all to default
    const resetDefaultFn = listeners.get('fdtResetDefaultStoreBtn:click');
    if (resetDefaultFn) resetDefaultFn();
    assert.ok(toastMessage.includes('reset to default'));
  } finally {
    globalThis.document = origDoc;
  }
});

/* ========================================================================= */
/* Field Technician GPON ONU / ONT Optical BOSA Diagnostics Suite Tests     */
/* ========================================================================= */

test('ONT_MODELS and ONT_PRESETS contain expected GPON terminal configurations', async () => {
  const { ONT_MODELS, ONT_PRESETS } = await import('../nav.js');

  assert.ok(Array.isArray(ONT_MODELS));
  assert.ok(ONT_MODELS.length >= 4);
  assert.ok(ONT_MODELS.some(m => m.id === 'HUAWEI_HG8245H'));
  assert.ok(ONT_MODELS.some(m => m.id === 'ZTE_F660'));

  assert.ok(Array.isArray(ONT_PRESETS));
  assert.equal(ONT_PRESETS.length, 5);
  const healthy = ONT_PRESETS.find(p => p.id === 'PRESET_HEALTHY');
  assert.ok(healthy);
  assert.equal(healthy.rxPowerDbm, -18.5);
  assert.equal(healthy.laserBiasMa, 14.5);
});

test('evaluateOntRxPower, Tx, Bias, Temp, and Voltage evaluate thresholds accurately', async () => {
  const {
    evaluateOntRxPower,
    evaluateOntTxPower,
    evaluateOntLaserBias,
    evaluateOntTemperature,
    evaluateOntVoltage
  } = await import('../nav.js');

  // Rx tests
  assert.equal(evaluateOntRxPower(0).id, 'LOS');
  assert.equal(evaluateOntRxPower(-38).id, 'LOS');
  assert.equal(evaluateOntRxPower(-5.0).id, 'OVERLOAD');
  assert.equal(evaluateOntRxPower(-18.5).id, 'OPTIMAL');
  assert.equal(evaluateOntRxPower(-25.5).id, 'ACCEPTABLE');
  assert.equal(evaluateOntRxPower(-27.8).id, 'MARGINAL');
  assert.equal(evaluateOntRxPower(-30.0).id, 'CRITICAL_LOW');

  // Tx tests
  assert.equal(evaluateOntTxPower(2.5).id, 'OPTIMAL');
  assert.equal(evaluateOntTxPower(4.2).id, 'ACCEPTABLE');
  assert.equal(evaluateOntTxPower(0.2).id, 'WEAK_TX');
  assert.equal(evaluateOntTxPower(6.5).id, 'HIGH_TX');

  // Bias tests
  assert.equal(evaluateOntLaserBias(15).id, 'OPTIMAL');
  assert.equal(evaluateOntLaserBias(29).id, 'ACCEPTABLE');
  assert.equal(evaluateOntLaserBias(38).id, 'AGING_WARNING');
  assert.equal(evaluateOntLaserBias(52).id, 'CRITICAL_BURNOUT');

  // Temperature tests
  assert.equal(evaluateOntTemperature(35).id, 'OPTIMAL');
  assert.equal(evaluateOntTemperature(55).id, 'ACCEPTABLE');
  assert.equal(evaluateOntTemperature(65).id, 'WARM_WARNING');
  assert.equal(evaluateOntTemperature(78).id, 'THERMAL_SHUTDOWN');

  // Voltage tests
  assert.equal(evaluateOntVoltage(3.3).id, 'OPTIMAL');
  assert.equal(evaluateOntVoltage(3.15).id, 'ACCEPTABLE');
  assert.equal(evaluateOntVoltage(2.9).id, 'UNDERVOLTAGE');
  assert.equal(evaluateOntVoltage(3.6).id, 'OVERVOLTAGE');
});

test('diagnoseOntHealth computes score and classifies root cause', async () => {
  const { diagnoseOntHealth } = await import('../nav.js');

  // Healthy scenario
  const healthy = diagnoseOntHealth({
    rxPowerDbm: -18.5,
    txPowerDbm: 2.4,
    laserBiasMa: 15.0,
    temperatureC: 38.0,
    supplyVoltageV: 3.3
  });
  assert.ok(healthy.compositeScore >= 95);
  assert.equal(healthy.statusGrade, 'EXCELLENT');
  assert.equal(healthy.diagnosisCategory, 'HEALTHY_NORMAL');
  assert.equal(healthy.faultCount, 0);

  // Weak Rx scenario
  const weakRx = diagnoseOntHealth({
    rxPowerDbm: -29.5,
    txPowerDbm: 2.4,
    laserBiasMa: 15.0,
    temperatureC: 38.0,
    supplyVoltageV: 3.3
  });
  assert.equal(weakRx.diagnosisCategory, 'WEAK_RX_SIGNAL');
  assert.ok(weakRx.recommendation.includes('Inspect drop cable'));

  // Laser aging scenario
  const laserAging = diagnoseOntHealth({
    rxPowerDbm: -18.5,
    txPowerDbm: 2.4,
    laserBiasMa: 48.0,
    temperatureC: 38.0,
    supplyVoltageV: 3.3
  });
  assert.equal(laserAging.diagnosisCategory, 'LASER_AGING_BURNOUT');
  assert.ok(laserAging.recommendation.includes('laser diode is aging'));

  // Overheating scenario
  const overheating = diagnoseOntHealth({
    rxPowerDbm: -18.5,
    txPowerDbm: 2.4,
    laserBiasMa: 15.0,
    temperatureC: 72.0,
    supplyVoltageV: 3.3
  });
  assert.equal(overheating.diagnosisCategory, 'THERMAL_THROTTLING');

  // Undervoltage scenario
  const badAdapter = diagnoseOntHealth({
    rxPowerDbm: -18.5,
    txPowerDbm: 2.4,
    laserBiasMa: 15.0,
    temperatureC: 38.0,
    supplyVoltageV: 2.9
  });
  assert.equal(badAdapter.diagnosisCategory, 'POWER_SUPPLY_FAULT');

  // Multiple faults scenario
  const multiFault = diagnoseOntHealth({
    rxPowerDbm: -32.0,
    txPowerDbm: 0.1,
    laserBiasMa: 50.0,
    temperatureC: 75.0,
    supplyVoltageV: 2.8
  });
  assert.equal(multiFault.diagnosisCategory, 'MULTIPLE_FAULTS');
  assert.ok(multiFault.compositeScore < 50);
});

test('ONT diagnostic storage operations persist and clear logs', async () => {
  const {
    getOntDiagnosticsStore,
    saveOntDiagnosticsStore,
    recordOntDiagnosticLog,
    clearOntDiagnosticsStore,
    ONT_DIAGNOSTICS_STORAGE_KEY
  } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  assert.deepEqual(getOntDiagnosticsStore(mockStorage), []);

  const saved = recordOntDiagnosticLog({
    customerName: 'Sample Technician',
    ontModel: 'Huawei HG8245H',
    serialNumber: 'HWTC-48590210',
    rxPowerDbm: -18.5,
    txPowerDbm: 2.4,
    laserBiasMa: 14.5,
    temperatureC: 38.0,
    supplyVoltageV: 3.31,
    compositeScore: 98,
    statusGrade: 'EXCELLENT',
    diagnosisCategory: 'HEALTHY_NORMAL',
    primaryFault: 'None'
  }, mockStorage);

  assert.ok(saved.id.startsWith('ONT-DIAG-'));
  assert.equal(saved.customerName, 'Sample Technician');

  const retrieved = getOntDiagnosticsStore(mockStorage);
  assert.equal(retrieved.length, 1);
  assert.equal(retrieved[0].serialNumber, 'HWTC-48590210');

  clearOntDiagnosticsStore(mockStorage);
  assert.deepEqual(getOntDiagnosticsStore(mockStorage), []);
});

test('renderMobileOntDiagnosticsSvg renders SVG with dials and LEDs', async () => {
  const { renderMobileOntDiagnosticsSvg } = await import('../nav.js');

  const svg = renderMobileOntDiagnosticsSvg({
    rxPowerDbm: -19.2,
    txPowerDbm: 2.1,
    laserBiasMa: 16.0,
    temperatureC: 40.0,
    supplyVoltageV: 3.32
  });

  assert.ok(svg.includes('<svg viewBox="0 0 720 360"'));
  assert.ok(svg.includes('POWER'));
  assert.ok(svg.includes('PON'));
  assert.ok(svg.includes('LOS'));
  assert.ok(svg.includes('Rx 1490nm'));
  assert.ok(svg.includes('Tx 1310nm'));
  assert.ok(svg.includes('Laser Bias'));
  assert.ok(svg.includes('-19.2 dBm'));
});

test('generateOntDiagnosticsWhatsAppReport formats field lineman report', async () => {
  const { generateOntDiagnosticsWhatsAppReport } = await import('../nav.js');

  const report = generateOntDiagnosticsWhatsAppReport({
    rxPowerDbm: -18.5,
    txPowerDbm: 2.4,
    laserBiasMa: 14.5,
    temperatureC: 38.0,
    supplyVoltageV: 3.31
  }, {
    customerName: 'Tariq Mehmood',
    ontModel: 'Huawei HG8245H',
    serialNumber: 'HWTC-12345678'
  });

  assert.ok(report.includes('SHAHDARA FIBER NET - ONT BOSA DIAGNOSTICS REPORT'));
  assert.ok(report.includes('*Customer:* Tariq Mehmood'));
  assert.ok(report.includes('Huawei HG8245H'));
  assert.ok(report.includes('*Laser Bias Current:* 14.5 mA'));
  assert.ok(report.includes('LINEMAN FIELD ACTION'));
});

test('setupMobileOntDiagnosticsModal wires DOM controls and manages preset switching', async () => {
  const { setupMobileOntDiagnosticsModal } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const listeners = new Map();
  function makeMockElement(id) {
    const el = {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      children: [],
      dataset: {},
      appendChild(c) { this.children.push(c); },
      addEventListener(ev, fn) { listeners.set(`${id}:${ev}`, fn); },
      dispatchEvent(e) {
        const fn = listeners.get(`${id}:${e.type}`);
        if (fn) fn(e);
      }
    };
    return el;
  }

  const modal = makeMockElement('mobileOntDiagnosticsModal');
  modal.showModal = () => { modal.open = true; };
  modal.close = () => { modal.open = false; };
  modal.setAttribute = (k, v) => { modal[k] = v; };
  modal.removeAttribute = (k) => { delete modal[k]; };

  const closeBtn = makeMockElement('mobileOntDiagnosticsCloseBtn');
  const presetSelect = makeMockElement('ontDiagPresetSelect');
  const svgContainer = makeMockElement('ontDiagSvgContainer');
  const historyList = makeMockElement('ontDiagHistoryList');
  const custNameInput = makeMockElement('ontDiagCustName');
  const ontModelSelect = makeMockElement('ontDiagModelSelect');
  const ontSerialInput = makeMockElement('ontDiagSerialInput');
  const rxPowerInput = makeMockElement('ontDiagRxPower');
  const txPowerInput = makeMockElement('ontDiagTxPower');
  const laserBiasInput = makeMockElement('ontDiagLaserBias');
  const tempInput = makeMockElement('ontDiagTemp');
  const voltInput = makeMockElement('ontDiagVoltage');
  const saveRecordBtn = makeMockElement('ontDiagSaveBtn');
  const whatsappBtn = makeMockElement('ontDiagWhatsappBtn');
  const clearHistoryBtn = makeMockElement('ontDiagClearHistoryBtn');
  const triggerBtn = makeMockElement('triggerBtn');

  const elements = {
    mobileOntDiagnosticsModal: modal,
    mobileOntDiagnosticsCloseBtn: closeBtn,
    ontDiagPresetSelect: presetSelect,
    ontDiagSvgContainer: svgContainer,
    ontDiagHistoryList: historyList,
    ontDiagCustName: custNameInput,
    ontDiagModelSelect: ontModelSelect,
    ontDiagSerialInput: ontSerialInput,
    ontDiagRxPower: rxPowerInput,
    ontDiagTxPower: txPowerInput,
    ontDiagLaserBias: laserBiasInput,
    ontDiagTemp: tempInput,
    ontDiagVoltage: voltInput,
    ontDiagSaveBtn: saveRecordBtn,
    ontDiagWhatsappBtn: whatsappBtn,
    ontDiagClearHistoryBtn: clearHistoryBtn
  };

  let toastMessage = '';
  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '[data-open-ont-diagnostics]') return [triggerBtn];
      return [];
    },
    createElement: (tag) => makeMockElement(tag)
  };

  try {
    const controller = setupMobileOntDiagnosticsModal({
      storage: mockStorage,
      onToast: (msg) => { toastMessage = msg; }
    });

    assert.ok(controller);
    assert.equal(typeof controller.updateView, 'function');
    assert.equal(typeof controller.applyPreset, 'function');

    // Trigger opens modal
    const triggerFn = listeners.get('triggerBtn:click');
    if (triggerFn) triggerFn();
    assert.ok(modal.open);

    // Close button closes modal
    const closeFn = listeners.get('mobileOntDiagnosticsCloseBtn:click');
    if (closeFn) closeFn();
    assert.equal(modal.open, false);

    // Apply preset
    controller.applyPreset('PRESET_WEAK_RX');
    assert.equal(rxPowerInput.value, -28.2);

    // Save diagnostic log
    custNameInput.value = 'Shahid Mehmood';
    ontSerialInput.value = 'ZTE-9812401';
    const saveFn = listeners.get('ontDiagSaveBtn:click');
    if (saveFn) saveFn();
    assert.ok(toastMessage.includes('ONT diagnostic log saved'));

    const history = controller.getHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].customerName, 'Shahid Mehmood');

    // Clear history
    const clearFn = listeners.get('ontDiagClearHistoryBtn:click');
    if (clearFn) clearFn();
    assert.ok(toastMessage.includes('cleared'));
  } finally {
    globalThis.document = origDoc;
  }
});

test('nav-fiber-probe: evaluateDefectZone correctly classifies radial distances into IEC zones', async () => {
  const { evaluateDefectZone } = await import('../nav-fiber-probe.js');

  // Core is 0 - 12.5µm radius
  assert.equal(evaluateDefectZone(0, 0), 'ZONE_A');
  assert.equal(evaluateDefectZone(5, 5), 'ZONE_A'); // sqrt(50) = 7.07µm <= 12.5
  assert.equal(evaluateDefectZone(12, 0), 'ZONE_A');

  // Cladding is 12.5 - 57.5µm radius
  assert.equal(evaluateDefectZone(20, 20), 'ZONE_B'); // sqrt(800) = 28.28µm
  assert.equal(evaluateDefectZone(50, 0), 'ZONE_B');

  // Adhesive is 57.5 - 67.5µm radius
  assert.equal(evaluateDefectZone(60, 0), 'ZONE_C');

  // Ferrule is 67.5 - 125µm radius
  assert.equal(evaluateDefectZone(100, 0), 'ZONE_D');

  // Outside ferrule inspection boundary
  assert.equal(evaluateDefectZone(150, 0), 'OUTSIDE');
});

test('nav-fiber-probe: evaluateIec61300Criteria evaluates pass/fail and penalty accurately', async () => {
  const { evaluateIec61300Criteria, CONNECTOR_TYPES } = await import('../nav-fiber-probe.js');

  // Pristine endface passes
  const cleanEval = evaluateIec61300Criteria([], CONNECTOR_TYPES.SC_APC);
  assert.equal(cleanEval.overallPass, true);
  assert.equal(cleanEval.totalViolations, 0);
  assert.equal(cleanEval.penaltyDb, 0);
  assert.equal(cleanEval.estInsertionLossDb, 0.15);
  assert.equal(cleanEval.estReturnLossDb, 65.0);

  // Core scratch is critical fail
  const coreDefects = [
    { type: 'scratch', xUm: 3, yUm: 2, sizeUm: 2.0, lengthUm: 8.0, desc: 'Hairline core gouge' }
  ];
  const coreEval = evaluateIec61300Criteria(coreDefects, CONNECTOR_TYPES.SC_APC);
  assert.equal(coreEval.overallPass, false);
  assert.equal(coreEval.zones.ZONE_A.pass, false);
  assert.ok(coreEval.totalViolations >= 1);
  assert.ok(coreEval.penaltyDb > 0.5);
  assert.ok(coreEval.estReturnLossDb < 45.0);

  // Loose dust in cladding > 5µm fails
  const cladDefects = [
    { type: 'dust', xUm: 30, yUm: 0, sizeUm: 8.0, desc: 'Large silica dust speck' }
  ];
  const cladEval = evaluateIec61300Criteria(cladDefects, CONNECTOR_TYPES.SC_APC);
  assert.equal(cladEval.overallPass, false);
  assert.equal(cladEval.zones.ZONE_B.pass, false);

  // Acceptable minor cladding blemishes pass
  const minorClad = [
    { type: 'scratch', xUm: 35, yUm: 10, sizeUm: 1.5, lengthUm: 10.0, desc: 'Faint cladding scratch' }
  ];
  const minorEval = evaluateIec61300Criteria(minorClad, CONNECTOR_TYPES.SC_APC);
  assert.equal(minorEval.overallPass, true);
});

test('nav-fiber-probe: remediateConnectorCleaning cleans dust and oil but preserves physical scratches', async () => {
  const { remediateConnectorCleaning } = await import('../nav-fiber-probe.js');

  const mixedDefects = [
    { id: 'd1', type: 'dust', xUm: 3, yUm: 3, sizeUm: 4.0, desc: 'Core dust particle' },
    { id: 'd2', type: 'scratch', xUm: 40, yUm: 10, sizeUm: 2.0, desc: 'Cladding scratch gouge' },
    { id: 'd3', type: 'oil', xUm: 80, yUm: 0, sizeUm: 15.0, desc: 'Lineman fingerprint oil' }
  ];

  const cleaned = remediateConnectorCleaning(mixedDefects, 'WET_DRY_IPA');
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].type, 'scratch');
});

test('nav-fiber-probe: storage methods save, retrieve, record, and clear audit logs', async () => {
  const {
    getFiberProbeStore,
    clearFiberProbeStore,
    recordFiberProbeAudit
  } = await import('../nav-fiber-probe.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  // Initially loads default audits
  const initial = getFiberProbeStore(mockStorage);
  assert.ok(Array.isArray(initial));
  assert.ok(initial.length > 0);

  // Clear store
  clearFiberProbeStore(mockStorage);
  assert.deepEqual(getFiberProbeStore(mockStorage), []);

  // Record audit
  const newAudit = {
    locationArea: 'Baghbanpura',
    nodeTag: 'FAT-BAGH-02 Drop 1',
    connectorType: 'SC_APC',
    magnification: '400X',
    grade: 'PASS',
    totalViolations: 0,
    insertionLossDb: 0.16,
    returnLossDb: 64.5,
    cleaned: true,
    technician: 'Noman Field Tech'
  };
  const recorded = recordFiberProbeAudit(newAudit, mockStorage);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].locationArea, 'Baghbanpura');
  assert.ok(recorded[0].id.startsWith('PROBE-'));
});

test('nav-fiber-probe: renderMobileFiberProbeSvg produces valid SVG microscope view', async () => {
  const { renderMobileFiberProbeSvg, evaluateIec61300Criteria, CONNECTOR_TYPES } = await import('../nav-fiber-probe.js');

  const ev = evaluateIec61300Criteria([], CONNECTOR_TYPES.SC_APC);
  const svg = renderMobileFiberProbeSvg(ev, {
    connector: CONNECTOR_TYPES.SC_APC,
    magnification: '400X'
  });

  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('IEC 61300-3-35 MICROSCOPE'));
  assert.ok(svg.includes('Zone A: Core'));
  assert.ok(svg.includes('PASS'));
});

test('nav-fiber-probe: generateFiberProbeWhatsAppReport generates detailed field dispatch message', async () => {
  const { generateFiberProbeWhatsAppReport } = await import('../nav-fiber-probe.js');

  const report = generateFiberProbeWhatsAppReport({
    id: 'PROBE-20261016-01',
    displayDate: 'Oct 16, 2026',
    displayTime: '04:15 PM',
    locationArea: 'Baradari Road',
    nodeTag: 'FAT-BAR-01 Drop 4',
    connectorType: 'SC_APC',
    magnification: '400X',
    grade: 'PASS',
    totalViolations: 0,
    insertionLossDb: 0.14,
    returnLossDb: 66.2,
    cleaned: true,
    technician: 'Tariq Lineman'
  });

  assert.ok(report.includes('FIBER CONNECTOR PROBE REPORT'));
  assert.ok(report.includes('Baradari Road'));
  assert.ok(report.includes('FAT-BAR-01 Drop 4'));
  assert.ok(report.includes('SC/APC'));
  assert.ok(report.includes('GRADE: PASS'));
  assert.ok(report.includes('0.14 dB'));
});

test('nav-fiber-probe: setupMobileFiberProbeModal lifecycle and UI interactions', async () => {
  const { setupMobileFiberProbeModal } = await import('../nav-fiber-probe.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const listeners = new Map();
  function makeMockElement(id, tag = 'div') {
    return {
      id,
      tagName: tag.toUpperCase(),
      innerHTML: '',
      textContent: '',
      value: '',
      open: false,
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      },
      showModal: function() { this.open = true; },
      close: function() { this.open = false; },
      setAttribute: function(k, v) { if (k === 'open') this.open = true; },
      removeAttribute: function(k) { if (k === 'open') this.open = false; },
      addEventListener: function(event, fn) {
        listeners.set(`${id}:${event}`, fn);
      },
      set onclick(fn) {
        listeners.set(`${id}:click`, fn);
      },
      querySelectorAll: () => [],
      querySelector: () => null
    };
  }

  const modal = makeMockElement('mobileFiberProbeModal', 'dialog');
  const closeBtn = makeMockElement('mobileFiberProbeCloseBtn', 'button');
  const presetSelect = makeMockElement('fiberProbePresetSelect', 'select');
  presetSelect.value = 'CORE_SCRATCH';
  const magSelect = makeMockElement('fiberProbeMagSelect', 'select');
  magSelect.value = '400X';
  const cleanMethodSelect = makeMockElement('fiberProbeCleanMethodSelect', 'select');
  cleanMethodSelect.value = 'WET_DRY_IPA';
  const cleanBtn = makeMockElement('fiberProbeCleanBtn', 'button');
  const reinspectBtn = makeMockElement('fiberProbeReinspectBtn', 'button');
  const whatsappBtn = makeMockElement('fiberProbeWhatsappBtn', 'button');
  const clearHistoryBtn = makeMockElement('fiberProbeClearHistoryBtn', 'button');
  const svgContainer = makeMockElement('fiberProbeSvgContainer');
  const coreStatus = makeMockElement('fiberProbeCoreStatus');
  const cladStatus = makeMockElement('fiberProbeCladStatus');
  const adhrStatus = makeMockElement('fiberProbeAdhrStatus');
  const ferrStatus = makeMockElement('fiberProbeFerrStatus');
  const overallBadge = makeMockElement('fiberProbeOverallBadge');
  const ilPenalty = makeMockElement('fiberProbeIlPenalty');
  const rlEst = makeMockElement('fiberProbeRlEst');
  const remediationTip = makeMockElement('fiberProbeRemediationTip');
  const locationInput = makeMockElement('fiberProbeLocationInput', 'input');
  locationInput.value = 'Shahdara Town';
  const nodeTagInput = makeMockElement('fiberProbeNodeTagInput', 'input');
  nodeTagInput.value = 'FAT-SHA-01';
  const techInput = makeMockElement('fiberProbeTechInput', 'input');
  techInput.value = 'Ali Lineman';
  const historyList = makeMockElement('fiberProbeHistoryList', 'ul');
  const triggerBtn = makeMockElement('triggerBtn', 'button');

  const elements = {
    mobileFiberProbeModal: modal,
    mobileFiberProbeCloseBtn: closeBtn,
    fiberProbePresetSelect: presetSelect,
    fiberProbeMagSelect: magSelect,
    fiberProbeCleanMethodSelect: cleanMethodSelect,
    fiberProbeCleanBtn: cleanBtn,
    fiberProbeReinspectBtn: reinspectBtn,
    fiberProbeWhatsappBtn: whatsappBtn,
    fiberProbeClearHistoryBtn: clearHistoryBtn,
    fiberProbeSvgContainer: svgContainer,
    fiberProbeCoreStatus: coreStatus,
    fiberProbeCladStatus: cladStatus,
    fiberProbeAdhrStatus: adhrStatus,
    fiberProbeFerrStatus: ferrStatus,
    fiberProbeOverallBadge: overallBadge,
    fiberProbeIlPenalty: ilPenalty,
    fiberProbeRlEst: rlEst,
    fiberProbeRemediationTip: remediationTip,
    fiberProbeLocationInput: locationInput,
    fiberProbeNodeTagInput: nodeTagInput,
    fiberProbeTechInput: techInput,
    fiberProbeHistoryList: historyList
  };

  let toastMessage = '';
  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '[data-open-fiber-probe]') return [triggerBtn];
      return [];
    },
    createElement: (tag) => makeMockElement('created', tag)
  };

  try {
    const controller = setupMobileFiberProbeModal({
      storage: mockStorage,
      onToast: (msg) => { toastMessage = msg; }
    });

    assert.ok(controller);
    assert.equal(typeof controller.openModal, 'function');
    assert.equal(typeof controller.closeModal, 'function');
    assert.equal(typeof controller.renderView, 'function');

    // Trigger button opens modal
    const triggerFn = listeners.get('triggerBtn:click');
    if (triggerFn) triggerFn();
    assert.ok(modal.open);

    // Close button closes modal
    const closeFn = listeners.get('mobileFiberProbeCloseBtn:click');
    if (closeFn) closeFn();
    assert.equal(modal.open, false);

    // Open with preset
    controller.openModal('PRISTINE_CLEAN');
    assert.equal(overallBadge.textContent, 'PASS');

    // Clean action
    const cleanFn = listeners.get('fiberProbeCleanBtn:click');
    if (cleanFn) cleanFn();
    assert.ok(toastMessage.includes('cleaning'));

    // Re-inspect action
    const reinspectFn = listeners.get('fiberProbeReinspectBtn:click');
    if (reinspectFn) reinspectFn();

    // Clear history
    const clearFn = listeners.get('fiberProbeClearHistoryBtn:click');
    if (clearFn) clearFn();
    assert.ok(toastMessage.includes('Cleared fiber probe'));
  } finally {
    globalThis.document = origDoc;
  }
});

test('nav-splitter-tree: calculateSplitterLoss calculates balanced and tap splitter attenuation', async () => {
  const { calculateSplitterLoss } = await import('../nav-splitter-tree.js');

  // Balanced splitters
  assert.equal(calculateSplitterLoss('1:2'), 3.5);
  assert.equal(calculateSplitterLoss('1:4'), 7.2);
  assert.equal(calculateSplitterLoss('1:8'), 10.5);
  assert.equal(calculateSplitterLoss('1:16'), 13.8);
  assert.equal(calculateSplitterLoss('1:32'), 17.0);
  assert.equal(calculateSplitterLoss('1:64'), 20.5);

  // Optical Tap Splitters
  assert.equal(calculateSplitterLoss('TAP_90_10', 'through'), 0.8);
  assert.equal(calculateSplitterLoss('TAP_90_10', 'tap'), 10.6);
  assert.equal(calculateSplitterLoss('TAP_80_20', 'through'), 1.4);
  assert.equal(calculateSplitterLoss('TAP_80_20', 'tap'), 7.4);
});

test('nav-splitter-tree: calculateCascadedBranchBudget computes link budget and margin', async () => {
  const { calculateCascadedBranchBudget, SHAHDARA_CASCADE_PRESETS } = await import('../nav-splitter-tree.js');

  // Baradari preset (healthy 2-stage cascade)
  const baradari = calculateCascadedBranchBudget(SHAHDARA_CASCADE_PRESETS[0]);
  assert.equal(baradari.isPass, true);
  assert.equal(baradari.overallPass, true);
  assert.equal(baradari.healthStatus, 'OPTIMAL');
  assert.ok(baradari.opticalMarginDb > 5.0);
  assert.ok(baradari.receivedPowerDbm > -25.0);

  // Overextended / macrobend preset (fail)
  const macrobend = calculateCascadedBranchBudget(SHAHDARA_CASCADE_PRESETS[3]);
  assert.equal(macrobend.isPass, false);
  assert.equal(macrobend.healthStatus, 'OUT_OF_SERVICE_FAIL');
  assert.ok(macrobend.opticalMarginDb <= 0);
});

test('nav-splitter-tree: storage methods save, retrieve, record, and clear audit records', async () => {
  const {
    getSplitterTreeStore,
    saveSplitterTreeStore,
    recordSplitterTreeAudit,
    clearSplitterTreeStore
  } = await import('../nav-splitter-tree.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  // Initially loads default audits
  const initial = getSplitterTreeStore(mockStorage);
  assert.ok(Array.isArray(initial));
  assert.ok(initial.length > 0);

  // Clear store
  clearSplitterTreeStore(mockStorage);
  assert.deepEqual(getSplitterTreeStore(mockStorage), []);

  // Record audit
  const newAudit = {
    locationArea: 'Baghbanpura Feed',
    feederCableTag: 'FDR-BAGH-01',
    primarySplitter: '1:4',
    secondarySplitter: '1:8',
    totalFiberKm: 3.2,
    totalLossDb: 21.5,
    receivedPowerDbm: -18.0,
    status: 'PASS',
    healthStatus: 'OPTIMAL',
    technician: 'Noman Field Tech'
  };
  const recorded = recordSplitterTreeAudit(newAudit, mockStorage);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].locationArea, 'Baghbanpura Feed');
  assert.ok(recorded[0].id.startsWith('TREE-'));
});

test('nav-splitter-tree: renderMobileSplitterTreeSvg produces valid SVG topology diagram', async () => {
  const { renderMobileSplitterTreeSvg, calculateCascadedBranchBudget, SHAHDARA_CASCADE_PRESETS } = await import('../nav-splitter-tree.js');

  const budget = calculateCascadedBranchBudget(SHAHDARA_CASCADE_PRESETS[0]);
  const svg = renderMobileSplitterTreeSvg(budget);

  assert.ok(svg.includes('<svg class="splitter-tree-svg"'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('ODN CASCADED SPLITTER TREE'));
  assert.ok(svg.includes('OLT PORT'));
  assert.ok(svg.includes('STAGE 1'));
  assert.ok(svg.includes('STAGE 2'));
});

test('nav-splitter-tree: generateSplitterTreeWhatsAppReport formats dispatch report', async () => {
  const { generateSplitterTreeWhatsAppReport } = await import('../nav-splitter-tree.js');

  const report = generateSplitterTreeWhatsAppReport({
    id: 'TREE-20261016-01',
    displayDate: 'Oct 16, 2026',
    displayTime: '04:30 PM',
    locationArea: 'Baradari Road',
    feederCableTag: 'FDR-BAR-01',
    primarySplitter: '1:4',
    secondarySplitter: '1:8',
    totalFiberKm: 3.35,
    totalLossDb: 22.1,
    receivedPowerDbm: -18.6,
    status: 'PASS',
    healthStatus: 'OPTIMAL',
    technician: 'Tariq Lineman'
  });

  assert.ok(report.includes('CASCADED SPLITTER TREE REPORT'));
  assert.ok(report.includes('Baradari Road'));
  assert.ok(report.includes('FDR-BAR-01'));
  assert.ok(report.includes('1:4'));
  assert.ok(report.includes('1:8'));
  assert.ok(report.includes('-18.6 dBm'));
  assert.ok(report.includes('PASS'));
});

test('nav-splitter-tree: setupMobileSplitterTreeModal lifecycle and UI interactions', async () => {
  const { setupMobileSplitterTreeModal } = await import('../nav-splitter-tree.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const listeners = new Map();
  function makeMockElement(id, tag = 'div') {
    return {
      id,
      tagName: tag.toUpperCase(),
      innerHTML: '',
      textContent: '',
      value: '',
      open: false,
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      },
      showModal: function() { this.open = true; },
      close: function() { this.open = false; },
      setAttribute: function(k, v) { if (k === 'open') this.open = true; },
      removeAttribute: function(k) { if (k === 'open') this.open = false; },
      addEventListener: function(event, fn) {
        listeners.set(`${id}:${event}`, fn);
      },
      set onclick(fn) {
        listeners.set(`${id}:click`, fn);
      },
      set oninput(fn) {
        listeners.set(`${id}:input`, fn);
      },
      set onchange(fn) {
        listeners.set(`${id}:change`, fn);
      },
      querySelectorAll: () => [],
      querySelector: () => null
    };
  }

  const modal = makeMockElement('mobileSplitterTreeModal', 'dialog');
  const closeBtn = makeMockElement('mobileSplitterTreeCloseBtn', 'button');
  const presetSelect = makeMockElement('splitterTreePresetSelect', 'select');
  presetSelect.value = 'PRESET_BARADARI_CASCADE';
  const primarySelect = makeMockElement('splitterTreePrimarySelect', 'select');
  primarySelect.value = '1:4';
  const secondarySelect = makeMockElement('splitterTreeSecondarySelect', 'select');
  secondarySelect.value = '1:8';
  const odnClassSelect = makeMockElement('splitterTreeOdnClassSelect', 'select');
  odnClassSelect.value = 'CLASS_B_PLUS';
  const feederKm = makeMockElement('splitterTreeFeederKm', 'input');
  feederKm.value = '2.4';
  const distKm = makeMockElement('splitterTreeDistKm', 'input');
  distKm.value = '0.8';
  const dropKm = makeMockElement('splitterTreeDropKm', 'input');
  dropKm.value = '0.15';
  const splices = makeMockElement('splitterTreeSplices', 'input');
  splices.value = '4';
  const connectors = makeMockElement('splitterTreeConnectors', 'input');
  connectors.value = '3';
  const oltTx = makeMockElement('splitterTreeOltTx', 'input');
  oltTx.value = '3.5';
  const svgWrap = makeMockElement('splitterTreeSvgContainer');
  const historyList = makeMockElement('splitterTreeHistoryList', 'ul');
  const lossBadge = makeMockElement('splitterTreeTotalLossBadge');
  const rxBadge = makeMockElement('splitterTreeRxPowerBadge');
  const marginBadge = makeMockElement('splitterTreeMarginBadge');
  const statusBadge = makeMockElement('splitterTreeStatusBadge');
  const saveBtn = makeMockElement('splitterTreeSaveBtn', 'button');
  const whatsappBtn = makeMockElement('splitterTreeWhatsappBtn', 'button');
  const clearHistoryBtn = makeMockElement('splitterTreeClearHistoryBtn', 'button');
  const locationInput = makeMockElement('splitterTreeLocationInput', 'input');
  locationInput.value = 'Baradari Road';
  const feederTagInput = makeMockElement('splitterTreeFeederTagInput', 'input');
  feederTagInput.value = 'FDR-BAR-01';
  const techInput = makeMockElement('splitterTreeTechInput', 'input');
  techInput.value = 'Tariq Lineman';
  const triggerBtn = makeMockElement('triggerBtn', 'button');

  const elements = {
    mobileSplitterTreeModal: modal,
    mobileSplitterTreeCloseBtn: closeBtn,
    splitterTreePresetSelect: presetSelect,
    splitterTreePrimarySelect: primarySelect,
    splitterTreeSecondarySelect: secondarySelect,
    splitterTreeOdnClassSelect: odnClassSelect,
    splitterTreeFeederKm: feederKm,
    splitterTreeDistKm: distKm,
    splitterTreeDropKm: dropKm,
    splitterTreeSplices: splices,
    splitterTreeConnectors: connectors,
    splitterTreeOltTx: oltTx,
    splitterTreeSvgContainer: svgWrap,
    splitterTreeHistoryList: historyList,
    splitterTreeTotalLossBadge: lossBadge,
    splitterTreeRxPowerBadge: rxBadge,
    splitterTreeMarginBadge: marginBadge,
    splitterTreeStatusBadge: statusBadge,
    splitterTreeSaveBtn: saveBtn,
    splitterTreeWhatsappBtn: whatsappBtn,
    splitterTreeClearHistoryBtn: clearHistoryBtn,
    splitterTreeLocationInput: locationInput,
    splitterTreeFeederTagInput: feederTagInput,
    splitterTreeTechInput: techInput
  };

  let toastMessage = '';
  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '[data-open-splitter-tree]') return [triggerBtn];
      return [];
    },
    createElement: (tag) => makeMockElement('created', tag)
  };

  try {
    const controller = setupMobileSplitterTreeModal({
      storage: mockStorage,
      onToast: (msg) => { toastMessage = msg; }
    });

    assert.ok(controller);
    assert.equal(typeof controller.openModal, 'function');
    assert.equal(typeof controller.closeModal, 'function');
    assert.equal(typeof controller.applyPreset, 'function');

    // Trigger button opens modal
    const triggerFn = listeners.get('triggerBtn:click');
    if (triggerFn) triggerFn();
    assert.ok(modal.open);

    // Close button closes modal
    const closeFn = listeners.get('mobileSplitterTreeCloseBtn:click');
    if (closeFn) closeFn();
    assert.equal(modal.open, false);

    // Apply preset
    controller.applyPreset('PRESET_VANDALA_HIGH_DENSITY');
    assert.equal(primarySelect.value, '1:2');
    assert.equal(secondarySelect.value, '1:16');

    // Save audit
    const saveFn = listeners.get('splitterTreeSaveBtn:click');
    if (saveFn) saveFn();
    assert.ok(toastMessage.includes('audit saved'));

    // Clear history
    const clearFn = listeners.get('splitterTreeClearHistoryBtn:click');
    if (clearFn) clearFn();
    assert.ok(toastMessage.includes('Cleared splitter tree'));
  } finally {
    globalThis.document = origDoc;
  }
});

test('FIBER_STANDARDS, WAVELENGTH_BEND_FACTORS and SHAHDARA_MACRO_BEND_PRESETS definitions are valid', async () => {
  const { FIBER_STANDARDS, WAVELENGTH_BEND_FACTORS, CABLE_CONSTRUCTIONS, SHAHDARA_MACRO_BEND_PRESETS } = await import('../nav.js');

  assert.ok(FIBER_STANDARDS.G652D);
  assert.equal(FIBER_STANDARDS.G652D.minSafeRadiusMm, 30.0);
  assert.ok(FIBER_STANDARDS.G657A1);
  assert.equal(FIBER_STANDARDS.G657A1.minSafeRadiusMm, 10.0);
  assert.ok(FIBER_STANDARDS.G657A2);
  assert.equal(FIBER_STANDARDS.G657A2.minSafeRadiusMm, 7.5);
  assert.ok(FIBER_STANDARDS.G657B3);
  assert.equal(FIBER_STANDARDS.G657B3.minSafeRadiusMm, 5.0);

  assert.ok(WAVELENGTH_BEND_FACTORS[1310]);
  assert.equal(WAVELENGTH_BEND_FACTORS[1310].factor, 1.0);
  assert.ok(WAVELENGTH_BEND_FACTORS[1550].factor > WAVELENGTH_BEND_FACTORS[1490].factor);
  assert.ok(WAVELENGTH_BEND_FACTORS[1577].factor > WAVELENGTH_BEND_FACTORS[1550].factor);

  assert.ok(CABLE_CONSTRUCTIONS.ROUND_DROP_3MM);
  assert.ok(CABLE_CONSTRUCTIONS.FLAT_BUTTERFLY_2X3);

  assert.equal(SHAHDARA_MACRO_BEND_PRESETS.length, 4);
  assert.ok(SHAHDARA_MACRO_BEND_PRESETS.some(p => p.id === 'PRESET_WINDOW_STAPLE'));
  assert.ok(SHAHDARA_MACRO_BEND_PRESETS.some(p => p.id === 'PRESET_ROOFTOP_DRIP_LOOP'));
});

test('calculateMacroBendLoss accurately computes compliant vs severe macro-bend attenuation', async () => {
  const { calculateMacroBendLoss } = await import('../nav.js');

  // Compliant loop: R=35mm, G.657.A1, 1490nm
  const safe = calculateMacroBendLoss({
    fiberStandard: 'G657A1',
    bendRadiusMm: 35.0,
    turnCount: 1,
    bendAngleDeg: 360,
    wavelengthNm: 1490,
    inputPowerDbm: -19.0
  });

  assert.equal(safe.status, 'COMPLIANT');
  assert.equal(safe.mechanicalFractureRisk, false);
  assert.ok(safe.totalMacroBendLossDb < 0.1);
  assert.ok(safe.powerMarginDb > 8.0); // -19.0 - (-28.0) ~ 9dB margin

  // Severe staple pinch: R=4mm, G.652.D SSMF (min 30mm)
  const severe = calculateMacroBendLoss({
    fiberStandard: 'G652D',
    bendRadiusMm: 4.0,
    turnCount: 1,
    bendAngleDeg: 90,
    wavelengthNm: 1490,
    inputPowerDbm: -19.5
  });

  assert.equal(severe.status, 'CRITICAL_FAULT');
  assert.equal(severe.mechanicalFractureRisk, true);
  assert.ok(severe.totalMacroBendLossDb > 1.5);
  assert.ok(severe.remediation.includes('URGENT'));

  // Multi-turn cumulative loss
  const twoTurns = calculateMacroBendLoss({
    fiberStandard: 'G652D',
    bendRadiusMm: 8.0,
    turnCount: 2,
    bendAngleDeg: 180,
    wavelengthNm: 1490
  });
  const oneTurn = calculateMacroBendLoss({
    fiberStandard: 'G652D',
    bendRadiusMm: 8.0,
    turnCount: 1,
    bendAngleDeg: 180,
    wavelengthNm: 1490
  });
  assert.equal(twoTurns.totalMacroBendLossDb, Number((oneTurn.totalMacroBendLossDb * 2).toFixed(2)));
});

test('calculateMacroBendLoss correctly identifies dual-wavelength differential macro-bend signature', async () => {
  const { calculateMacroBendLoss } = await import('../nav.js');

  const bend = calculateMacroBendLoss({
    fiberStandard: 'G652D',
    bendRadiusMm: 8.0,
    turnCount: 1,
    bendAngleDeg: 90
  });

  assert.ok(bend.multiWavelengthLosses[1550] > bend.multiWavelengthLosses[1310]);
  assert.ok(bend.multiWavelengthLosses[1577] > bend.multiWavelengthLosses[1550]);
  assert.ok(bend.hasMacroBendSignature);
  assert.ok(bend.differential1550vs1310Db >= 0.5);
});

test('getMacroBendStore, saveMacroBendStore, recordMacroBendAudit and clearMacroBendStore manage audit history', async () => {
  const { getMacroBendStore, recordMacroBendAudit, clearMacroBendStore, MACRO_BEND_STORAGE_KEY } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const initial = getMacroBendStore(mockStorage);
  assert.ok(Array.isArray(initial));
  assert.equal(initial.length, 2);

  const newAudit = recordMacroBendAudit({
    location: 'Shahdara Town - House #45',
    technician: 'Imran Lineman',
    fiberStandard: 'G657A1',
    bendRadiusMm: 25.0,
    totalMacroBendLossDb: 0.05,
    differential1550vs1310Db: 0.08,
    outputPowerDbm: -19.05,
    status: 'COMPLIANT'
  }, mockStorage);

  assert.ok(newAudit.id.startsWith('mb-audit-'));
  const updated = getMacroBendStore(mockStorage);
  assert.equal(updated.length, 3);
  assert.equal(updated[0].location, 'Shahdara Town - House #45');

  clearMacroBendStore(mockStorage);
  const cleared = getMacroBendStore(mockStorage);
  assert.equal(cleared.length, 0);
});

test('renderMobileMacroBendSvg outputs valid SVG with visual bend mandrel and wavelength bars', async () => {
  const { renderMobileMacroBendSvg, calculateMacroBendLoss } = await import('../nav.js');

  const data = calculateMacroBendLoss({
    fiberStandard: 'G652D',
    bendRadiusMm: 4.0,
    wavelengthNm: 1490
  });

  const svg = renderMobileMacroBendSvg(data);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('macro-bend-svg'));
  assert.ok(svg.includes('R = 4 mm'));
  assert.ok(svg.includes('G652D'));
  assert.ok(svg.includes('CRITICAL FAULT'));
  assert.ok(svg.includes('CORNER'));
  assert.ok(svg.includes('WAVELENGTH LOSS'));
  assert.ok(svg.includes('1310'));
  assert.ok(svg.includes('1550'));
  assert.ok(svg.includes('1577'));
});

test('generateMacroBendWhatsAppReport formats clear lineman field dispatch message', async () => {
  const { generateMacroBendWhatsAppReport } = await import('../nav.js');

  const report = generateMacroBendWhatsAppReport({
    location: 'Main Bazaar Shahdara - Shop #14 Window Frame',
    technician: 'Imran Lineman',
    timestamp: '2026-10-16T18:30:00.000Z',
    fiberStandard: 'G652D',
    cableConstruction: 'ROUND_DROP_3MM',
    bendRadiusMm: 4.0,
    turnCount: 1,
    bendAngleDeg: 90,
    wavelengthNm: 1490,
    totalMacroBendLossDb: 3.85,
    differential1550vs1310Db: 3.25,
    outputPowerDbm: -23.35,
    status: 'CRITICAL_FAULT',
    notes: 'Staple pinch relieved; patch cord replaced'
  });

  assert.ok(report.includes('SHAHDARA ISP - OPTICAL FIBER MACRO-BEND AUDIT'));
  assert.ok(report.includes('MACRO-BEND OPTICAL LEAK DETECTED'));
  assert.ok(report.includes('Main Bazaar Shahdara'));
  assert.ok(report.includes('Imran Lineman'));
  assert.ok(report.includes('4 mm'));
  assert.ok(report.includes('3.85 dB'));
  assert.ok(report.includes('3.25 dB'));
  assert.ok(report.includes('Field Action Required:'));
});

test('setupMobileMacroBendModal binds DOM controls, updates real-time calculations, and handles events', async () => {
  const { setupMobileMacroBendModal } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  let modalOpened = false;
  let modalClosed = false;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    setAttribute: () => {},
    removeAttribute: () => {},
    onclick: null
  };

  const mockCloseBtn = { onclick: null };
  const mockDrawerBtn = { onclick: null };
  const mockSpeedDialBtn = { onclick: null };
  const mockActionSheetBtn = { onclick: null };

  const mockPresetSelect = { value: '', options: [{ value: '' }], innerHTML: '', onchange: null };
  const mockStandardSelect = { value: 'G652D', onchange: null };
  const mockCableSelect = { value: 'ROUND_DROP_3MM', onchange: null };
  const mockWavelengthSelect = { value: '1490', onchange: null };
  const mockRadiusSlider = { value: '30', oninput: null };
  const mockRadiusValLabel = { textContent: '' };
  const mockTurnSelect = { value: '1', onchange: null };
  const mockAngleSelect = { value: '90', onchange: null };
  const mockInputPowerInput = { value: '-19.0', oninput: null };
  const mockLocationInput = { value: 'Shahdara Town - House #45' };
  const mockTechInput = { value: 'Imran Lineman' };
  const mockNotesInput = { value: 'Inspected' };

  const mockSvgWrap = { innerHTML: '' };
  const mockKpiLoss = { textContent: '' };
  const mockKpiRx = { textContent: '' };
  const mockKpiDiff = { textContent: '', style: {} };
  const mockKpiStatus = { textContent: '', className: '' };
  const mockRemediationText = { textContent: '', style: {} };
  const mockHistoryList = { innerHTML: '' };

  const mockSaveBtn = { onclick: null };
  const mockWhatsappBtn = { onclick: null };
  const mockClearHistoryBtn = { onclick: null };

  const elements = {
    mobileMacroBendModal: mockModal,
    mobileMacroBendCloseBtn: mockCloseBtn,
    navMacroBendBtn: mockDrawerBtn,
    speedDialMacroBendBtn: mockSpeedDialBtn,
    actionSheetMacroBendBtn: mockActionSheetBtn,
    macroBendPresetSelect: mockPresetSelect,
    macroBendStandardSelect: mockStandardSelect,
    macroBendCableSelect: mockCableSelect,
    macroBendWavelengthSelect: mockWavelengthSelect,
    macroBendRadiusSlider: mockRadiusSlider,
    macroBendRadiusVal: mockRadiusValLabel,
    macroBendTurnSelect: mockTurnSelect,
    macroBendAngleSelect: mockAngleSelect,
    macroBendInputPower: mockInputPowerInput,
    macroBendLocationInput: mockLocationInput,
    macroBendTechInput: mockTechInput,
    macroBendNotesInput: mockNotesInput,
    macroBendSvgWrap: mockSvgWrap,
    macroBendKpiLoss: mockKpiLoss,
    macroBendKpiRx: mockKpiRx,
    macroBendKpiDiff: mockKpiDiff,
    macroBendKpiStatus: mockKpiStatus,
    macroBendRemediationText: mockRemediationText,
    macroBendHistoryList: mockHistoryList,
    macroBendSaveBtn: mockSaveBtn,
    macroBendWhatsappBtn: mockWhatsappBtn,
    macroBendClearHistoryBtn: mockClearHistoryBtn
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements[id] || null
  };

  let toastMessage = '';
  let copiedText = '';

  try {
    const controller = setupMobileMacroBendModal({
      storage: mockStorage,
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (txt) => { copiedText = txt; }
      }
    });

    assert.ok(controller);
    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');
    assert.equal(typeof controller.render, 'function');

    // Initial render verification
    assert.ok(mockSvgWrap.innerHTML.includes('macro-bend-svg'));
    assert.ok(mockKpiLoss.textContent.includes('dB'));
    assert.ok(mockHistoryList.innerHTML.includes('Shop #14'));

    // Open and close
    controller.open();
    assert.equal(modalOpened, true);
    controller.close();
    assert.equal(modalClosed, true);

    // Preset select test
    mockPresetSelect.value = 'PRESET_WINDOW_STAPLE';
    mockPresetSelect.onchange({ target: { value: 'PRESET_WINDOW_STAPLE' } });
    assert.equal(mockRadiusSlider.value, 4.0);
    assert.ok(mockKpiStatus.textContent.includes('CRITICAL'));

    // Slider test
    mockRadiusSlider.value = '15';
    mockRadiusSlider.oninput();
    assert.equal(mockRadiusValLabel.textContent, '15 mm');

    // Save button test
    mockSaveBtn.onclick();
    assert.ok(toastMessage.includes('Macro-bend audit successfully saved'));

    // WhatsApp button test
    await mockWhatsappBtn.onclick();
    assert.ok(copiedText.includes('SHAHDARA ISP - OPTICAL FIBER MACRO-BEND AUDIT'));
    assert.ok(toastMessage.includes('WhatsApp dispatch report copied'));

    // Clear history button test
    mockClearHistoryBtn.onclick();
    assert.ok(toastMessage.includes('Macro-bend audit history cleared'));
    assert.ok(mockHistoryList.innerHTML.includes('No macro-bend audits recorded'));

  } finally {
    globalThis.document = origDoc;
  }
});

/* ==========================================================================
   Field Optical Attenuator & Overload Protection Assistant Tests
   ========================================================================== */

test('calculateAttenuationLoss accurately computes direct patch power and identifies overload risk', async () => {
  const { calculateAttenuationLoss } = await import('../nav.js');

  // Direct connection (-15 dBm on GPON Class B+) -> Optimal
  const optimal = calculateAttenuationLoss(-15.0, 'GPON_CLASS_B_PLUS', 'NONE_DIRECT', 0.0);
  assert.equal(optimal.appliedAttenuationDb, 0);
  assert.equal(optimal.rxPowerDbm, -15.0);
  assert.equal(optimal.status, 'OPTIMAL');
  assert.ok(optimal.overloadMarginDb > 0);
  assert.ok(optimal.sensitivityMarginDb > 0);
  assert.equal(optimal.recommendedAttDb, 3.0);

  // High input power (-4 dBm on GPON Class B+ where overload is -5 dBm and nominal max is -8 dBm)
  const overloaded = calculateAttenuationLoss(-4.0, 'GPON_CLASS_B_PLUS', 'NONE_DIRECT', 0.0);
  assert.equal(overloaded.status, 'OVERDRIVE_CRITICAL');
  assert.ok(overloaded.overloadMarginDb < 0);
  assert.ok(overloaded.recommendedAttDb > 0);
  assert.ok(overloaded.message.includes('exceeds overload'));

  // Near overload (-9.5 dBm on GPON Class B+ where overload is -8.0 dBm)
  const nearOverload = calculateAttenuationLoss(-9.5, 'GPON_CLASS_B_PLUS', 'NONE_DIRECT', 0.0);
  assert.equal(nearOverload.status, 'NEAR_OVERLOAD');
});

test('calculateAttenuationLoss recommends optimal fixed attenuator pads and restores linear dynamic range', async () => {
  const { calculateAttenuationLoss } = await import('../nav.js');

  // Input +2 dBm on GPON Class B+ (e.g. short bypass feeder)
  const highInput = calculateAttenuationLoss(2.0, 'GPON_CLASS_B_PLUS', 'NONE_DIRECT', 0.0);
  assert.equal(highInput.status, 'OVERDRIVE_CRITICAL');
  // Optimal target is -18.0 dBm, so recommended attenuation is ~20 dB -> best pad 20 dB
  assert.equal(highInput.bestPadRecommendation.id, 'FIXED_FOA_20DB');

  // Now apply the recommended 20 dB pad:
  const withPad = calculateAttenuationLoss(2.0, 'GPON_CLASS_B_PLUS', 'FIXED_FOA_20DB', 0.0);
  assert.equal(withPad.appliedAttenuationDb, 20.0);
  assert.equal(withPad.rxPowerDbm, -18.0);
  assert.equal(withPad.status, 'OPTIMAL');
  assert.ok(withPad.overloadMarginDb > 0);
  assert.ok(withPad.sensitivityMarginDb > 0);
});

test('calculateAttenuationLoss supports continuous mechanical VOA precision tuning and multiple ONU classes', async () => {
  const { calculateAttenuationLoss } = await import('../nav.js');

  // 10G XGS-PON Class N1 with VOA tuned to 8.5 dB
  const xgs = calculateAttenuationLoss(-2.0, 'XGSPON_CLASS_N1', 'VARIABLE_VOA_CONTINUOUS', 8.5);
  assert.equal(xgs.appliedAttenuationDb, 8.5);
  assert.equal(xgs.rxPowerDbm, -10.5);
  assert.equal(xgs.status, 'OPTIMAL');
  assert.equal(xgs.onuClass.id, 'XGSPON_CLASS_N1');

  // EPON with excessive attenuation causing sensitivity deficit
  const deficit = calculateAttenuationLoss(-22.0, 'EPON_1000BASE_PX20', 'FIXED_FOA_10DB', 0.0);
  assert.equal(deficit.appliedAttenuationDb, 10.0);
  assert.equal(deficit.rxPowerDbm, -32.0);
  assert.equal(deficit.status, 'UNDER_SENSITIVITY');
  assert.ok(deficit.sensitivityMarginDb < 0);
  assert.ok(deficit.message.includes('sensitivity limit'));
});

test('getAttenuatorStore, saveAttenuatorStore, recordAttenuatorAudit and clearAttenuatorStore manage optical attenuator audit records', async () => {
  const { getAttenuatorStore, recordAttenuatorAudit, clearAttenuatorStore } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const initial = getAttenuatorStore(mockStorage);
  assert.ok(Array.isArray(initial));
  assert.ok(initial.length >= 2);

  const updated = recordAttenuatorAudit({
    location: 'Shahdara Town - FAT-04 Port 7',
    technician: 'Tariq Field Engineer',
    onuClass: 'GPON_CLASS_B_PLUS',
    onuClassName: 'GPON Class B+',
    inputPowerDbm: -4.5,
    attenuatorId: 'FIXED_FOA_10DB',
    attenuatorName: 'Fixed FOA Pad - 10 dB',
    appliedAttenuationDb: 10.0,
    rxPowerDbm: -14.5,
    status: 'OPTIMAL',
    notes: 'Installed 10 dB pad. Overload cleared.'
  }, mockStorage);

  assert.ok(Array.isArray(updated));
  assert.equal(updated[0].location, 'Shahdara Town - FAT-04 Port 7');
  assert.equal(updated[0].appliedAttenuationDb, 10.0);

  clearAttenuatorStore(mockStorage);
  const cleared = getAttenuatorStore(mockStorage);
  assert.equal(cleared.length, 0);
  assert.equal(store['shahdara_attenuator_audits_v1'], '[]');
});

test('renderMobileAttenuatorSvg generates valid vector visualization with power drop, attenuator element, and optical status indicators', async () => {
  const { renderMobileAttenuatorSvg, calculateAttenuationLoss } = await import('../nav.js');

  const calc = calculateAttenuationLoss(-4.5, 'GPON_CLASS_B_PLUS', 'FIXED_FOA_10DB', 0.0);
  const svg = renderMobileAttenuatorSvg(calc);

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('attenuator-svg'));
  assert.ok(svg.includes('-4.5 dBm'));
  assert.ok(svg.includes('-14.5 dBm'));
  assert.ok(svg.includes('-10.0 dB Pad'));
  assert.ok(svg.includes('GPON Class B+'));
  assert.ok(svg.includes('OPTIMAL'));
});

test('generateAttenuatorWhatsAppReport formats comprehensive WhatsApp field report', async () => {
  const { generateAttenuatorWhatsAppReport } = await import('../nav.js');

  const report = generateAttenuatorWhatsAppReport({
    location: 'Kot Abdul Malik - Factory Node',
    technician: 'Imran Lineman',
    timestamp: '2026-10-17T01:00:00.000Z',
    inputPowerDbm: -3.0,
    appliedAttenuationDb: 10.0,
    attenuatorName: 'Fixed FOA 10 dB Pad',
    rxPowerDbm: -13.0,
    onuClassName: 'GPON Class B+',
    status: 'OPTIMAL',
    notes: '10 dB pad inserted before ONU input port. Clean frame sync.'
  });

  assert.ok(report.includes('SHAHDARA ISP - OPTICAL ATTENUATION FIELD AUDIT'));
  assert.ok(report.includes('Kot Abdul Malik - Factory Node'));
  assert.ok(report.includes('Imran Lineman'));
  assert.ok(report.includes('-3.0 dBm'));
  assert.ok(report.includes('10.0 dB'));
  assert.ok(report.includes('-13.0 dBm'));
  assert.ok(report.includes('PASS - OPTIMAL'));
});

test('setupMobileAttenuatorModal binds modal controls, updates calculations in real time, and handles user interactions', async () => {
  const { setupMobileAttenuatorModal } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  let modalOpened = false;
  let modalClosed = false;
  let toastMessage = '';
  let copiedText = '';

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    setAttribute: () => {},
    removeAttribute: () => {},
    onclick: null
  };

  const mockCloseBtn = { onclick: null };
  const mockDrawerBtn = { onclick: null };
  const mockSpeedDialBtn = { onclick: null };
  const mockActionSheetBtn = { onclick: null };

  const mockPresetSelect = { value: '', options: [{ value: '' }], onchange: null };
  const mockOnuClassSelect = { value: 'GPON_CLASS_B_PLUS', onchange: null };
  const mockInputPowerField = { value: '-15.0', oninput: null };
  const mockPadSelect = { value: 'NONE_DIRECT', onchange: null };
  const mockVoaGroup = { style: { display: 'none' } };
  const mockVoaSlider = { value: '0', oninput: null };
  const mockVoaVal = { textContent: '' };

  const mockKpiRx = { textContent: '', style: {} };
  const mockKpiOverloadMargin = { textContent: '', style: {} };
  const mockKpiSensitivityMargin = { textContent: '', style: {} };
  const mockKpiRecommended = { textContent: '', style: {} };
  const mockKpiStatus = { textContent: '', style: {} };

  const mockSvgWrap = { innerHTML: '' };
  const mockRemediationText = { textContent: '', style: {} };

  const mockLocationInput = { value: 'Shahdara Town - FAT-04' };
  const mockTechInput = { value: 'Tariq Field Engineer' };
  const mockNotesInput = { value: 'Inspected' };

  const mockSaveBtn = { onclick: null };
  const mockWhatsappBtn = { onclick: null };
  const mockClearHistoryBtn = { onclick: null };
  const mockHistoryList = { innerHTML: '' };

  const elements = {
    mobileAttenuatorModal: mockModal,
    mobileAttenuatorCloseBtn: mockCloseBtn,
    navAttenuatorBtn: mockDrawerBtn,
    attenuatorPresetSelect: mockPresetSelect,
    attenuatorOnuClassSelect: mockOnuClassSelect,
    attenuatorInputPower: mockInputPowerField,
    attenuatorPadSelect: mockPadSelect,
    attenuatorVoaGroup: mockVoaGroup,
    attenuatorVoaSlider: mockVoaSlider,
    attenuatorVoaVal: mockVoaVal,
    attenuatorKpiRx: mockKpiRx,
    attenuatorKpiOverloadMargin: mockKpiOverloadMargin,
    attenuatorKpiSensitivityMargin: mockKpiSensitivityMargin,
    attenuatorKpiRecommended: mockKpiRecommended,
    attenuatorKpiStatus: mockKpiStatus,
    attenuatorSvgWrap: mockSvgWrap,
    attenuatorRemediationText: mockRemediationText,
    attenuatorLocationInput: mockLocationInput,
    attenuatorTechInput: mockTechInput,
    attenuatorNotesInput: mockNotesInput,
    attenuatorSaveBtn: mockSaveBtn,
    attenuatorWhatsappBtn: mockWhatsappBtn,
    attenuatorClearHistoryBtn: mockClearHistoryBtn,
    attenuatorHistoryList: mockHistoryList
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => {
      if (sel === '[data-open-attenuator]') return mockSpeedDialBtn;
      if (sel === '[data-action-attenuator]') return mockActionSheetBtn;
      return null;
    },
    addEventListener: () => {}
  };

  try {
    const controller = setupMobileAttenuatorModal({
      storage: mockStorage,
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    assert.ok(controller);
    assert.ok(mockSvgWrap.innerHTML.includes('attenuator-svg'));
    assert.ok(mockKpiRx.textContent.includes('-15.0 dBm'));
    assert.ok(mockHistoryList.innerHTML.includes('Shahdara Town'));

    // Open & close modal
    controller.open();
    assert.equal(modalOpened, true);
    controller.close();
    assert.equal(modalClosed, true);

    // Test Preset Selection
    mockPresetSelect.value = 'PRESET_CLOSE_CENTRAL_OLT';
    mockPresetSelect.onchange();
    assert.equal(mockInputPowerField.value, -4.5);
    assert.ok(toastMessage.includes('Loaded preset'));

    // Test VOA selection
    mockPadSelect.value = 'VARIABLE_VOA_CONTINUOUS';
    mockPadSelect.onchange();
    assert.equal(mockVoaGroup.style.display, 'block');

    mockVoaSlider.value = '7.5';
    mockVoaSlider.oninput();
    assert.equal(mockVoaVal.textContent, '7.5 dB');

    // Test Save Audit
    mockSaveBtn.onclick();
    assert.ok(toastMessage.includes('audit saved'));

    // Test WhatsApp Report
    await mockWhatsappBtn.onclick();
    assert.ok(copiedText.includes('SHAHDARA ISP - OPTICAL ATTENUATION FIELD AUDIT'));
    assert.ok(toastMessage.includes('WhatsApp audit report copied'));

    // Test Clear History
    mockClearHistoryBtn.onclick();
    assert.ok(toastMessage.includes('audit history cleared'));
    assert.ok(mockHistoryList.innerHTML.includes('No optical attenuation audits recorded'));
  } finally {
    globalThis.document = origDoc;
  }
});

/* ==========================================================================
   Field Optical Return Loss (ORL) & Back-Reflection Assistant Tests
   ========================================================================== */

test('calculateOpticalReturnLoss accurately computes total ORL for clean all-APC ODN networks', async () => {
  const { calculateOpticalReturnLoss } = await import('../nav.js');

  const clean = calculateOpticalReturnLoss({
    standardId: 'GPON_ITU_G984',
    fiberLengthKm: 2.8,
    fiberAttenuationPerKm: 0.35,
    connectorIds: ['SC_APC_CLEAN', 'SC_APC_CLEAN', 'SC_APC_CLEAN']
  });

  assert.equal(clean.events.length, 3);
  assert.ok(clean.totalOrlDb >= 32.0);
  assert.equal(clean.status, 'OPTIMAL');
  assert.ok(clean.orlMarginDb >= 0);
  assert.equal(clean.hasMismatch, false);
  assert.equal(clean.hasOpenEnd, false);
});

test('calculateOpticalReturnLoss detects catastrophic APC-UPC connector mismatch and open uncapped fiber', async () => {
  const { calculateOpticalReturnLoss } = await import('../nav.js');

  // Accidental APC in UPC mismatch
  const mismatch = calculateOpticalReturnLoss({
    standardId: 'GPON_ITU_G984',
    fiberLengthKm: 1.2,
    connectorIds: ['SC_APC_CLEAN', 'APC_UPC_MISMATCH', 'SC_APC_CLEAN']
  });

  assert.equal(mismatch.hasMismatch, true);
  assert.equal(mismatch.status, 'CRITICAL_REFLECTANCE');
  assert.equal(mismatch.worstEvent.connector.id, 'APC_UPC_MISMATCH');
  assert.ok(mismatch.totalOrlDb < 25.0);
  assert.ok(mismatch.message.includes('connector mismatch'));

  // Uncapped open cleaved fiber end (Fresnel reflection)
  const openEnd = calculateOpticalReturnLoss({
    standardId: 'XGSPON_ITU_G9807',
    fiberLengthKm: 0.8,
    connectorIds: ['SC_APC_CLEAN', 'OPEN_CLEAVED_FIBER']
  });

  assert.equal(openEnd.hasOpenEnd, true);
  assert.equal(openEnd.status, 'CRITICAL_REFLECTANCE');
  assert.ok(openEnd.message.includes('Fresnel'));
});

test('calculateOpticalReturnLoss verifies standard thresholds across GPON, XGS-PON, and RF Video Overlay', async () => {
  const { calculateOpticalReturnLoss, OPTICAL_NETWORK_STANDARDS } = await import('../nav.js');

  assert.equal(OPTICAL_NETWORK_STANDARDS.GPON_ITU_G984.minOrlDb, 32.0);
  assert.equal(OPTICAL_NETWORK_STANDARDS.XGSPON_ITU_G9807.minOrlDb, 32.0);
  assert.equal(OPTICAL_NETWORK_STANDARDS.RF_VIDEO_OVERLAY.minOrlDb, 40.0);

  // Test RF video overlay with UPC connector (should fail 40 dB standard)
  const rf = calculateOpticalReturnLoss({
    standardId: 'RF_VIDEO_OVERLAY',
    fiberLengthKm: 3.0,
    connectorIds: ['SC_APC_CLEAN', 'SC_UPC_CLEAN']
  });

  assert.ok(rf.totalOrlDb < 40.0);
  assert.ok(rf.status === 'NON_COMPLIANT' || rf.status === 'CRITICAL_REFLECTANCE');
});

test('getOrlStore, saveOrlStore, recordOrlAudit, and clearOrlStore manage local audit records', async () => {
  const { getOrlStore, recordOrlAudit, clearOrlStore } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const initial = getOrlStore(mockStorage);
  assert.ok(Array.isArray(initial));
  assert.ok(initial.length >= 2);

  const updated = recordOrlAudit({
    location: 'Shahdara Town - Main Bazaar',
    technician: 'Imran Lineman',
    standardId: 'GPON_ITU_G984',
    standardName: 'ITU-T G.984.2 GPON',
    fiberLengthKm: 2.8,
    totalOrlDb: 36.2,
    orlMarginDb: 4.2,
    status: 'OPTIMAL',
    notes: 'Pristine all-APC network.'
  }, mockStorage);

  assert.ok(Array.isArray(updated));
  assert.equal(updated[0].location, 'Shahdara Town - Main Bazaar');
  assert.equal(updated[0].totalOrlDb, 36.2);

  clearOrlStore(mockStorage);
  const cleared = getOrlStore(mockStorage);
  assert.equal(cleared.length, 0);
  assert.equal(store['shahdara_orl_audits_v1'], '[]');
});

test('renderMobileOrlSvg generates valid vector visualization with transmitter, back-reflection waves, and ORL gauge', async () => {
  const { renderMobileOrlSvg, calculateOpticalReturnLoss } = await import('../nav.js');

  const calc = calculateOpticalReturnLoss({
    standardId: 'GPON_ITU_G984',
    fiberLengthKm: 2.5,
    connectorIds: ['SC_APC_CLEAN', 'SC_APC_CLEAN']
  });

  const svg = renderMobileOrlSvg(calc);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('orl-svg'));
  assert.ok(svg.includes('OLT LASER'));
  assert.ok(svg.includes('Back-Reflection'));
  assert.ok(svg.includes('Cumulative ORL'));
  assert.ok(svg.includes('MIN: 32 dB'));
});

test('generateOrlWhatsAppReport formats clean lineman field dispatch', async () => {
  const { generateOrlWhatsAppReport } = await import('../nav.js');

  const report = generateOrlWhatsAppReport({
    location: 'Shahdara Town - Main Bazaar Commercial Feeder',
    technician: 'Imran Lineman',
    timestamp: '2026-10-17T01:15:00.000Z',
    standardName: 'ITU-T G.984 GPON',
    fiberLengthKm: 2.8,
    totalOrlDb: 36.2,
    status: 'OPTIMAL',
    notes: 'All-APC clean network verified.'
  });

  assert.ok(report.includes('SHAHDARA ISP - OPTICAL RETURN LOSS (ORL) AUDIT'));
  assert.ok(report.includes('Shahdara Town - Main Bazaar Commercial Feeder'));
  assert.ok(report.includes('Imran Lineman'));
  assert.ok(report.includes('36.2 dB'));
  assert.ok(report.includes('PASS - OPTIMAL'));
});

test('setupMobileOrlModal binds modal controls, updates calculations in real time, and handles user interactions', async () => {
  const { setupMobileOrlModal } = await import('../nav.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  let modalOpened = false;
  let modalClosed = false;
  let toastMessage = '';
  let copiedText = '';

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    setAttribute: () => {},
    removeAttribute: () => {},
    onclick: null
  };

  const mockCloseBtn = { onclick: null };
  const mockDrawerBtn = { onclick: null };
  const mockSpeedDialBtn = { onclick: null };
  const mockActionSheetBtn = { onclick: null };

  const mockPresetSelect = { value: '', options: [{ value: '' }], onchange: null };
  const mockStandardSelect = { value: 'GPON_ITU_G984', onchange: null };
  const mockLengthSlider = { value: '2.0', oninput: null };
  const mockLengthVal = { textContent: '' };
  const mockConn1Select = { value: 'SC_APC_CLEAN', onchange: null };
  const mockConn2Select = { value: 'SC_APC_CLEAN', onchange: null };
  const mockConn3Select = { value: 'SC_APC_CLEAN', onchange: null };

  const mockKpiOrl = { textContent: '', style: {} };
  const mockKpiMargin = { textContent: '', style: {} };
  const mockKpiWorst = { textContent: '', style: {} };
  const mockKpiStatus = { textContent: '', style: {} };

  const mockSvgWrap = { innerHTML: '' };
  const mockRemediationText = { textContent: '', style: {} };

  const mockLocationInput = { value: 'Shahdara Town - Main Bazaar' };
  const mockTechInput = { value: 'Imran Lineman' };
  const mockNotesInput = { value: 'Inspected' };

  const mockSaveBtn = { onclick: null };
  const mockWhatsappBtn = { onclick: null };
  const mockClearHistoryBtn = { onclick: null };
  const mockHistoryList = { innerHTML: '' };

  const elements = {
    mobileOrlModal: mockModal,
    mobileOrlCloseBtn: mockCloseBtn,
    navOrlBtn: mockDrawerBtn,
    orlPresetSelect: mockPresetSelect,
    orlStandardSelect: mockStandardSelect,
    orlLengthSlider: mockLengthSlider,
    orlLengthVal: mockLengthVal,
    orlConn1Select: mockConn1Select,
    orlConn2Select: mockConn2Select,
    orlConn3Select: mockConn3Select,
    orlKpiTotal: mockKpiOrl,
    orlKpiMargin: mockKpiMargin,
    orlKpiWorst: mockKpiWorst,
    orlKpiStatus: mockKpiStatus,
    orlSvgWrap: mockSvgWrap,
    orlRemediationText: mockRemediationText,
    orlLocationInput: mockLocationInput,
    orlTechInput: mockTechInput,
    orlNotesInput: mockNotesInput,
    orlSaveBtn: mockSaveBtn,
    orlWhatsappBtn: mockWhatsappBtn,
    orlClearHistoryBtn: mockClearHistoryBtn,
    orlHistoryList: mockHistoryList
  };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => {
      if (sel === '[data-open-orl]') return mockSpeedDialBtn;
      if (sel === '[data-action-orl]') return mockActionSheetBtn;
      return null;
    },
    addEventListener: () => {}
  };

  try {
    const controller = setupMobileOrlModal({
      storage: mockStorage,
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    assert.ok(controller);
    assert.ok(mockSvgWrap.innerHTML.includes('orl-svg'));
    assert.ok(mockKpiOrl.textContent.includes('dB'));
    assert.ok(mockHistoryList.innerHTML.includes('Shahdara Town'));

    // Open & close modal
    controller.open();
    assert.equal(modalOpened, true);
    controller.close();
    assert.equal(modalClosed, true);

    // Test Preset Selection
    mockPresetSelect.value = 'PRESET_FAT_CONNECTOR_MISMATCH';
    mockPresetSelect.onchange();
    assert.equal(mockConn2Select.value, 'APC_UPC_MISMATCH');
    assert.ok(toastMessage.includes('Loaded preset'));

    // Test Slider
    mockLengthSlider.value = '5.0';
    mockLengthSlider.oninput();
    assert.equal(mockLengthVal.textContent, '5.0 km');

    // Test Save Audit
    mockSaveBtn.onclick();
    assert.ok(toastMessage.includes('audit saved'));

    // Test WhatsApp Report
    await mockWhatsappBtn.onclick();
    assert.ok(copiedText.includes('SHAHDARA ISP - OPTICAL RETURN LOSS'));
    assert.ok(toastMessage.includes('WhatsApp audit report copied'));

    // Test Clear History
    mockClearHistoryBtn.onclick();
    assert.ok(toastMessage.includes('audit history cleared'));
    assert.ok(mockHistoryList.innerHTML.includes('No optical return loss audits recorded'));
  } finally {
    globalThis.document = origDoc;
  }
});

test('Issue #283: setupMobileAttenuatorModal and setupMobileOrlModal wire all matches across querySelectorAll', async () => {
  const { setupMobileAttenuatorModal, setupMobileOrlModal } = await import('../nav.js');

  let attOpened = false;
  let orlOpened = false;

  const mockAttModal = {
    showModal: () => { attOpened = true; },
    close: () => {},
    setAttribute: () => {},
    removeAttribute: () => {}
  };
  const mockOrlModal = {
    showModal: () => { orlOpened = true; },
    close: () => {},
    setAttribute: () => {},
    removeAttribute: () => {}
  };

  const attTrigger1 = { onclick: null };
  const attTrigger2 = { onclick: null };
  const attTrigger3 = { onclick: null };

  const orlTrigger1 = { onclick: null };
  const orlTrigger2 = { onclick: null };
  const orlTrigger3 = { onclick: null };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'mobileAttenuatorModal') return mockAttModal;
      if (id === 'mobileOrlModal') return mockOrlModal;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel.includes('attenuator')) return [attTrigger1, attTrigger2, attTrigger3];
      if (sel.includes('orl')) return [orlTrigger1, orlTrigger2, orlTrigger3];
      return [];
    },
    addEventListener: () => {}
  };

  try {
    setupMobileAttenuatorModal();
    assert.strictEqual(typeof attTrigger1.onclick, 'function');
    assert.strictEqual(typeof attTrigger2.onclick, 'function');
    assert.strictEqual(typeof attTrigger3.onclick, 'function');

    attTrigger2.onclick();
    assert.strictEqual(attOpened, true);

    setupMobileOrlModal();
    assert.strictEqual(typeof orlTrigger1.onclick, 'function');
    assert.strictEqual(typeof orlTrigger2.onclick, 'function');
    assert.strictEqual(typeof orlTrigger3.onclick, 'function');

    orlTrigger2.onclick();
    assert.strictEqual(orlOpened, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('CLEAVER_MODELS, CLEAVE_DEFECT_TYPES and CLEAVE_ANGLE_SPEC define standard cleaver parameters', async () => {
  const { CLEAVER_MODELS, CLEAVE_DEFECT_TYPES, CLEAVE_ANGLE_SPEC } = await import('../nav.js');

  assert.ok(CLEAVER_MODELS.FUJIKURA_CT50);
  assert.equal(CLEAVER_MODELS.FUJIKURA_CT50.totalPositions, 16);
  assert.equal(CLEAVER_MODELS.FUJIKURA_CT50.heightLevels, 3);
  assert.equal(CLEAVER_MODELS.FUJIKURA_CT50.cleavesPerPosition, 1250);

  assert.ok(CLEAVER_MODELS.SUMITOMO_FC6S);
  assert.equal(CLEAVER_MODELS.SUMITOMO_FC6S.totalPositions, 24);
  assert.equal(CLEAVER_MODELS.SUMITOMO_FC6S.cleavesPerPosition, 2000);

  assert.ok(CLEAVE_DEFECT_TYPES.PRISTINE);
  assert.equal(CLEAVE_DEFECT_TYPES.PRISTINE.severity, 'PASS');
  assert.ok(CLEAVE_DEFECT_TYPES.HACKLE_CHIP);
  assert.equal(CLEAVE_DEFECT_TYPES.HACKLE_CHIP.severity, 'FAIL');
  assert.ok(CLEAVE_DEFECT_TYPES.CORE_SHATTER);
  assert.equal(CLEAVE_DEFECT_TYPES.CORE_SHATTER.severity, 'CRITICAL');

  assert.equal(CLEAVE_ANGLE_SPEC.EXCELLENT_MAX_DEG, 0.5);
  assert.equal(CLEAVE_ANGLE_SPEC.ACCEPTABLE_MAX_DEG, 1.0);
});

test('calculateCleaverPositionDynamics computes wear rate, remaining cleaves, and splice penalty', async () => {
  const { calculateCleaverPositionDynamics } = await import('../nav.js');

  // Case 1: Fresh Position 1, Pristine cleave
  const fresh = calculateCleaverPositionDynamics({
    modelId: 'FUJIKURA_CT50',
    currentPosition: 1,
    positionCleaves: 250,
    measuredCleaveAngle: 0.3,
    observedDefect: 'PRISTINE'
  });

  assert.equal(fresh.positionWearPct, 20.0);
  assert.equal(fresh.positionRemainingCleaves, 1000);
  assert.equal(fresh.cleaveQuality, 'PRISTINE_OPTIMAL');
  assert.equal(fresh.spliceViability, 'PREMIUM_LOW_LOSS_SPLICE');
  assert.equal(fresh.badgeColor, '#10b981');
  assert.equal(fresh.nextPosition, 2);
  assert.ok(fresh.estimatedSpliceLossDb < 0.15);

  // Case 2: Worn Position, Hackle defect
  const worn = calculateCleaverPositionDynamics({
    modelId: 'FUJIKURA_CT50',
    currentPosition: 5,
    positionCleaves: 1200,
    measuredCleaveAngle: 1.4,
    observedDefect: 'HACKLE_CHIP'
  });

  assert.equal(worn.positionWearPct, 96.0);
  assert.equal(worn.positionRemainingCleaves, 50);
  assert.equal(worn.cleaveQuality, 'DEFECTIVE_OUT_OF_SPEC');
  assert.equal(worn.spliceViability, 'REJECT_RECLEAVE_REQUIRED');
  assert.equal(worn.badgeColor, '#ef4444');
  assert.equal(worn.isPositionExhausted, true);
  assert.ok(worn.recommendation.includes('ROTATE BLADE'));

  // Case 3: Last Position Height Exhaustion
  const heightExhausted = calculateCleaverPositionDynamics({
    modelId: 'FUJIKURA_CT50',
    currentPosition: 16,
    currentHeight: 1,
    positionCleaves: 1240,
    measuredCleaveAngle: 1.5
  });

  assert.ok(heightExhausted.recommendation.includes('ADJUST HEIGHT'));
  assert.ok(heightExhausted.recommendation.includes('Height Level 2'));
});

test('renderCleaverDialSvg outputs complete vector rotary dial with slots and angle bar', async () => {
  const { calculateCleaverPositionDynamics, renderCleaverDialSvg } = await import('../nav.js');

  const metrics = calculateCleaverPositionDynamics({
    modelId: 'FUJIKURA_CT50',
    currentPosition: 3,
    positionCleaves: 500,
    measuredCleaveAngle: 0.4
  });

  const fullSvg = renderCleaverDialSvg(metrics, { compact: false });
  assert.ok(fullSvg.includes('<svg class="cleaver-dial-svg"'));
  assert.ok(fullSvg.includes('FIBER CLEAVER ROTARY BLADE WEAR'));
  assert.ok(fullSvg.includes('#3')); // Current position #3
  assert.ok(fullSvg.includes('40% Wear'));
  assert.ok(fullSvg.includes('CLEAVE ANGLE TOLERANCE'));
  assert.ok(fullSvg.includes('VERDICT: PRISTINE_OPTIMAL'));

  const compactSvg = renderCleaverDialSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="cleaver-dial-svg"'));
  assert.ok(compactSvg.includes('viewBox="0 0 500 260"'));
});

test('generateCleaverAuditReport and generateCleaverWhatsAppDispatch produce structured summaries', async () => {
  const { calculateCleaverAuditMetrics, generateCleaverAuditReport, generateCleaverWhatsAppDispatch } = await import('../nav.js');

  const metrics = calculateCleaverAuditMetrics({}, {
    modelId: 'SUMITOMO_FC6S',
    currentPosition: 7,
    positionCleaves: 1800,
    measuredCleaveAngle: 0.5,
    technicianName: 'Tariq Lineman',
    cleaverSerial: 'SMT-FC6S-9912',
    targetArea: 'Baradari'
  });

  const report = generateCleaverAuditReport(metrics, { referenceDate: '2026-10-17' });
  assert.ok(report.includes('SHAHDARA ISP - OPTICAL FIBER CLEAVER BLADE WEAR'));
  assert.ok(report.includes('Sumitomo FC-6S'));
  assert.ok(report.includes('Tariq Lineman'));
  assert.ok(report.includes('Position #7 of 24'));
  assert.ok(report.includes('0.5°'));

  const waText = generateCleaverWhatsAppDispatch(metrics);
  assert.ok(waText.includes('*SHAHDARA ISP - FIBER CLEAVER AUDIT*'));
  assert.ok(waText.includes('Tariq Lineman'));
  assert.ok(waText.includes('*#7* / 24'));
  assert.ok(waText.includes('Baradari'));
});

test('loadCleaverAuditLog, saveCleaverAuditLog and clearCleaverAuditLog manage persistent storage', async () => {
  const { loadCleaverAuditLog, saveCleaverAuditLog, clearCleaverAuditLog } = await import('../nav.js');

  const testKey = 'shahdara_cleaver_test_key';
  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const origLocal = globalThis.localStorage;
  globalThis.localStorage = mockStorage;

  try {
    assert.deepEqual(loadCleaverAuditLog(testKey), []);

    const record1 = { id: 1, position: 2, angle: 0.4 };
    const saved1 = saveCleaverAuditLog(record1, testKey);
    assert.equal(saved1.length, 1);
    assert.equal(saved1[0].position, 2);

    const record2 = { id: 2, position: 3, angle: 0.6 };
    const saved2 = saveCleaverAuditLog(record2, testKey);
    assert.equal(saved2.length, 2);
    assert.equal(saved2[0].position, 3); // Prepends most recent

    const { exportCleaverAuditsCsv } = await import('../nav.js');
    const csv = exportCleaverAuditsCsv(saved2);
    assert.ok(csv.includes('Timestamp,Model,Serial_Number'));
    assert.ok(csv.includes('3,'));

    clearCleaverAuditLog(testKey);
    assert.deepEqual(loadCleaverAuditLog(testKey), []);
  } finally {
    globalThis.localStorage = origLocal;
  }
});

test('setupMobileCleaverModal binds DOM controls, executes rotations, resets and exports', async () => {
  const { setupMobileCleaverModal } = await import('../nav.js');

  function createMockEl(id) {
    const listeners = {};
    return {
      id,
      value: '',
      textContent: '',
      open: false,
      style: {},
      addEventListener(event, fn) {
        listeners[event] = fn;
      },
      click() {
        if (listeners['click']) listeners['click']();
      },
      input() {
        if (listeners['input']) listeners['input']();
      },
      change() {
        if (listeners['change']) listeners['change']();
      },
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      }
    };
  }

  const elements = {
    mobileCleaverModal: createMockEl('mobileCleaverModal'),
    mobileCleaverModalCloseBtn: createMockEl('mobileCleaverModalCloseBtn'),
    cleaverModelSelect: createMockEl('cleaverModelSelect'),
    cleaverPositionSlider: createMockEl('cleaverPositionSlider'),
    cleaverPositionLabel: createMockEl('cleaverPositionLabel'),
    cleaverHeightSelect: createMockEl('cleaverHeightSelect'),
    cleaverCountInput: createMockEl('cleaverCountInput'),
    cleaverAngleInput: createMockEl('cleaverAngleInput'),
    cleaverDefectSelect: createMockEl('cleaverDefectSelect'),
    cleaverTechNameInput: createMockEl('cleaverTechNameInput'),
    cleaverSerialInput: createMockEl('cleaverSerialInput'),
    cleaverAreaSelect: createMockEl('cleaverAreaSelect'),
    cleaverStatPosition: createMockEl('cleaverStatPosition'),
    cleaverStatWear: createMockEl('cleaverStatWear'),
    cleaverStatAngle: createMockEl('cleaverStatAngle'),
    cleaverStatPenalty: createMockEl('cleaverStatPenalty'),
    cleaverStatVerdict: createMockEl('cleaverStatVerdict'),
    cleaverModalDiagramContainer: createMockEl('cleaverModalDiagramContainer'),
    cleaverRotateNextBtn: createMockEl('cleaverRotateNextBtn'),
    cleaverResetPositionBtn: createMockEl('cleaverResetPositionBtn'),
    cleaverSaveAuditBtn: createMockEl('cleaverSaveAuditBtn'),
    cleaverCopyReportBtn: createMockEl('cleaverCopyReportBtn'),
    cleaverExportCsvBtn: createMockEl('cleaverExportCsvBtn'),
    cleaverShareWhatsAppBtn: createMockEl('cleaverShareWhatsAppBtn'),
    cleaverClearHistoryBtn: createMockEl('cleaverClearHistoryBtn'),
    cleaverHistoryList: createMockEl('cleaverHistoryList')
  };

  elements.cleaverModelSelect.value = 'FUJIKURA_CT50';
  elements.cleaverPositionSlider.value = '1';
  elements.cleaverCountInput.value = '100';
  elements.cleaverAngleInput.value = '0.4';

  const mockDoc = {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll() {
      return [];
    }
  };

  let toastMsg = null;
  const controller = setupMobileCleaverModal({}, {
    document: mockDoc,
    onToast: msg => { toastMsg = msg; }
  });

  assert.ok(controller);
  controller.open();
  assert.equal(elements.mobileCleaverModal.open, true);
  assert.ok(elements.cleaverModalDiagramContainer.innerHTML.includes('<svg'));

  // Test position rotation
  elements.cleaverRotateNextBtn.click();
  assert.equal(elements.cleaverPositionSlider.value, 2);
  assert.ok(toastMsg.includes('Rotated cleaver wheel to Position #2'));

  // Test reset position
  elements.cleaverResetPositionBtn.click();
  assert.equal(elements.cleaverCountInput.value, 0);
  assert.ok(toastMsg.includes('reset to baseline'));

  // Test save audit
  elements.cleaverSaveAuditBtn.click();
  assert.ok(toastMsg.includes('Saved cleaver audit'));

  // Test export CSV button
  elements.cleaverExportCsvBtn.click();
  assert.ok(toastMsg.includes('CSV') || toastMsg.includes('copied') || toastMsg.includes('Clipboard'));

  // Test clear history button
  elements.cleaverClearHistoryBtn.click();
  assert.ok(toastMsg.includes('cleared'));

  controller.close();
  assert.equal(elements.mobileCleaverModal.open, false);
});

test('index.html contains mobile cleaver button and modal markup', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreCleaverBtn"'));
  assert.ok(html.includes('id="mobileCleaverModal"'));
  assert.ok(html.includes('id="cleaverModelSelect"'));
  assert.ok(html.includes('id="cleaverPositionSlider"'));
  assert.ok(html.includes('id="cleaverRotateNextBtn"'));
  assert.ok(html.includes('id="cleaverModalDiagramContainer"'));
  assert.ok(html.includes('id="cleaverExportCsvBtn"'));
  assert.ok(html.includes('id="cleaverClearHistoryBtn"'));
  assert.ok(html.includes('id="cleaverHistoryList"'));

  const css = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(css.includes('.mobile-cleaver-modal'));
  assert.ok(css.includes('.cleaver-card'));
  assert.ok(css.includes('.cleaver-svg-wrap'));
});

test('nav-olts-cert constants and specifications adhere to TIA-568.3-D and ITU-T standards', async () => {
  const {
    OLTS_CERT_STORAGE_KEY,
    OLTS_WAVELENGTHS,
    REFERENCE_METHODS,
    OLTS_CONNECTOR_TYPES,
    OLTS_SPLICE_TYPES,
    OLTS_PRESETS
  } = await import('../nav-olts-cert.js');

  assert.equal(OLTS_CERT_STORAGE_KEY, 'shahdara_olts_cert_audits_v1');

  // Wavelengths
  assert.ok(OLTS_WAVELENGTHS.SM_1310);
  assert.equal(OLTS_WAVELENGTHS.SM_1310.wavelengthNm, 1310);
  assert.equal(OLTS_WAVELENGTHS.SM_1310.defaultLossPerKm, 0.35);
  assert.ok(OLTS_WAVELENGTHS.SM_1490);
  assert.equal(OLTS_WAVELENGTHS.SM_1490.wavelengthNm, 1490);
  assert.ok(OLTS_WAVELENGTHS.SM_1550);
  assert.equal(OLTS_WAVELENGTHS.SM_1550.defaultLossPerKm, 0.20);
  assert.ok(OLTS_WAVELENGTHS.SM_1577);
  assert.ok(OLTS_WAVELENGTHS.SM_1625);

  // Reference Methods
  assert.ok(REFERENCE_METHODS.METHOD_1_CORD);
  assert.equal(REFERENCE_METHODS.METHOD_1_CORD.cords, 1);
  assert.ok(REFERENCE_METHODS.METHOD_2_CORD);
  assert.equal(REFERENCE_METHODS.METHOD_2_CORD.cords, 2);
  assert.ok(REFERENCE_METHODS.METHOD_3_CORD);
  assert.equal(REFERENCE_METHODS.METHOD_3_CORD.cords, 3);

  // Connectors & Splices
  assert.ok(OLTS_CONNECTOR_TYPES.SC_APC);
  assert.equal(OLTS_CONNECTOR_TYPES.SC_APC.typicalLossDb, 0.25);
  assert.equal(OLTS_CONNECTOR_TYPES.SC_APC.returnLossDb, 65);
  assert.ok(OLTS_CONNECTOR_TYPES.SC_UPC);
  assert.equal(OLTS_CONNECTOR_TYPES.SC_UPC.typicalLossDb, 0.30);
  assert.ok(OLTS_SPLICE_TYPES.FUSION);
  assert.equal(OLTS_SPLICE_TYPES.FUSION.typicalLossDb, 0.05);
  assert.ok(OLTS_SPLICE_TYPES.MECHANICAL);
  assert.equal(OLTS_SPLICE_TYPES.MECHANICAL.typicalLossDb, 0.15);

  // Presets
  assert.ok(OLTS_PRESETS.SHAHDARA_FEEDER);
  assert.equal(OLTS_PRESETS.SHAHDARA_FEEDER.lengthKm, 3.8);
  assert.ok(OLTS_PRESETS.FDT_DISTRIBUTION);
  assert.ok(OLTS_PRESETS.FAT_DROP_SUBSCRIBER);
  assert.ok(OLTS_PRESETS.METRO_INTER_POP);
  assert.ok(OLTS_PRESETS.DC_CROSS_CONNECT);
});

test('calculateTier1LossBudget calculates correct fiber, splice, and connector loss budgets', async () => {
  const { calculateTier1LossBudget } = await import('../nav-olts-cert.js');

  // Standard Feeder link: 3.8 km at 1310nm (0.35 dB/km), 4 splices (0.05 dB), 2 connectors (0.25 dB)
  // fiber: 3.8 * 0.35 = 1.33 dB
  // splices: 4 * 0.05 = 0.20 dB
  // connectors: 2 * 0.25 = 0.50 dB
  // total = 1.33 + 0.20 + 0.50 = 2.03 dB
  const budget = calculateTier1LossBudget({
    lengthKm: 3.8,
    wavelengthId: 'SM_1310',
    splicesCount: 4,
    spliceType: 'FUSION',
    connectorsCount: 2,
    connectorType: 'SC_APC'
  });

  assert.equal(budget.lengthKm, 3.8);
  assert.equal(budget.fiberLossDb, 1.33);
  assert.equal(budget.spliceLossDb, 0.2);
  assert.equal(budget.connectorLossDb, 0.5);
  assert.equal(budget.totalBudgetDb, 2.03);
  assert.ok(budget.standardCeilingBudgetDb > budget.totalBudgetDb);

  // Zero-length / datacenter patch jumper test
  const dcPatch = calculateTier1LossBudget({
    lengthKm: 0,
    splicesCount: 0,
    connectorsCount: 2,
    connectorType: 'LC_UPC'
  });
  assert.equal(dcPatch.fiberLossDb, 0);
  assert.equal(dcPatch.spliceLossDb, 0);
  assert.equal(dcPatch.connectorLossDb, 0.6);
  assert.equal(dcPatch.totalBudgetDb, 0.6);

  // Custom component loss override
  const customBudget = calculateTier1LossBudget({
    lengthKm: 2.0,
    customFiberLossPerKm: 0.22,
    splicesCount: 1,
    customSpliceLoss: 0.10,
    connectorsCount: 2,
    customConnectorLoss: 0.20
  });
  assert.equal(customBudget.totalBudgetDb, 0.94);
});

test('calculateBidirectionalCertification correctly computes bi-dir average, delta, gainer detection, and Pass/Marginal/Fail', async () => {
  const { calculateBidirectionalCertification } = await import('../nav-olts-cert.js');

  // Case 1: Healthy Pass with >= 1.0 dB margin headroom
  const passRes = calculateBidirectionalCertification({
    lossAtoB: 0.82,
    lossBtoA: 0.86,
    budgetDb: 2.40,
    lengthKm: 2.0
  });
  assert.equal(passRes.avgLossDb, 0.84);
  assert.equal(passRes.deltaDb, 0.04);
  assert.equal(passRes.marginDb, 1.56);
  assert.equal(passRes.status, 'PASS');
  assert.equal(passRes.hasGainer, false);
  assert.equal(passRes.hasDirectionalBias, false);
  assert.equal(passRes.attenuationPerKm, 0.42);
  assert.ok(passRes.statusText.includes('CERTIFIED PASS'));

  // Case 2: Marginal Pass with < 1.0 dB headroom
  const marginalRes = calculateBidirectionalCertification({
    lossAtoB: 1.85,
    lossBtoA: 1.91,
    budgetDb: 2.10,
    lengthKm: 3.8
  });
  assert.equal(marginalRes.avgLossDb, 1.88);
  assert.equal(marginalRes.marginDb, 0.22);
  assert.equal(marginalRes.status, 'MARGINAL');
  assert.ok(marginalRes.statusText.includes('MARGINAL PASS'));

  // Case 3: Failed Certification (exceeds budget)
  const failRes = calculateBidirectionalCertification({
    lossAtoB: 3.10,
    lossBtoA: 3.30,
    budgetDb: 2.00,
    lengthKm: 1.5
  });
  assert.equal(failRes.avgLossDb, 3.20);
  assert.equal(failRes.marginDb, -1.20);
  assert.equal(failRes.status, 'FAIL');
  assert.ok(failRes.statusText.includes('CERTIFICATION FAILED'));
  assert.ok(failRes.advisoryUrdu.includes('خطرہ'));

  // Case 4: Apparent Gainer (negative loss in one direction due to MFD mismatch)
  const gainerRes = calculateBidirectionalCertification({
    lossAtoB: -0.15,
    lossBtoA: 1.45,
    budgetDb: 1.80
  });
  assert.equal(gainerRes.avgLossDb, 0.65);
  assert.equal(gainerRes.hasGainer, true);
  assert.ok(gainerRes.diagnostics.some(d => d.includes('gainer')));

  // Case 5: Directional Asymmetry (> 0.25 dB delta)
  const biasRes = calculateBidirectionalCertification({
    lossAtoB: 0.60,
    lossBtoA: 1.10,
    budgetDb: 1.50
  });
  assert.equal(biasRes.deltaDb, 0.50);
  assert.equal(biasRes.hasDirectionalBias, true);
  assert.ok(biasRes.diagnostics.some(d => d.includes('asymmetry')));
});

test('renderOltsCertificationSvg and renderOltsReferenceDiagramSvg produce valid vector graphics', async () => {
  const { renderOltsCertificationSvg, renderOltsReferenceDiagramSvg } = await import('../nav-olts-cert.js');

  const svgPass = renderOltsCertificationSvg({
    lossAtoB: 1.85,
    lossBtoA: 1.91,
    avgLossDb: 1.88,
    budgetDb: 2.45,
    marginDb: 0.57,
    status: 'PASS',
    wavelengthNm: 1310,
    linkName: 'Shahdara Feeder 01'
  });
  assert.ok(svgPass.includes('<svg'));
  assert.ok(svgPass.includes('viewBox="0 0 760 320"'));
  assert.ok(svgPass.includes('END A'));
  assert.ok(svgPass.includes('END B'));
  assert.ok(svgPass.includes('1.88 dB'));
  assert.ok(svgPass.includes('PASS'));
  assert.ok(svgPass.includes('Shahdara Feeder 01'));

  const svgFail = renderOltsCertificationSvg({
    lossAtoB: 3.5,
    lossBtoA: 3.7,
    avgLossDb: 3.6,
    budgetDb: 2.0,
    marginDb: -1.6,
    status: 'FAIL'
  });
  assert.ok(svgFail.includes('FAIL'));

  // Reference Diagram
  const ref1 = renderOltsReferenceDiagramSvg({ methodId: 'METHOD_1_CORD' });
  assert.ok(ref1.includes('1-Cord Reference'));
  assert.ok(ref1.includes('Launch Cord'));
  assert.ok(ref1.includes('SET ZERO'));

  const ref2 = renderOltsReferenceDiagramSvg({ methodId: 'METHOD_2_CORD' });
  assert.ok(ref2.includes('Receive Cord'));

  const ref3 = renderOltsReferenceDiagramSvg({ methodId: 'METHOD_3_CORD' });
  assert.ok(ref3.includes('3-Cord Reference'));
});

test('generateOltsAuditReport and generateOltsWhatsAppDispatch create formatted field records', async () => {
  const { generateOltsAuditReport, generateOltsWhatsAppDispatch } = await import('../nav-olts-cert.js');

  const sampleData = {
    linkName: 'Shahdara Central OLT -> Ravi FDT',
    technician: 'Kamran Akram',
    location: 'Begum Kot, Lahore',
    lengthKm: 3.8,
    wavelengthNm: 1310,
    connectorsCount: 2,
    connectorType: 'SC/APC',
    splicesCount: 4,
    spliceType: 'Fusion Splice',
    lossAtoB: 1.85,
    lossBtoA: 1.91,
    avgLossDb: 1.88,
    budgetDb: 2.03,
    marginDb: 0.15,
    status: 'PASS',
    advisoryUrdu: 'مبارک! آپٹیکل فائبر لنک ٹیسٹ کامیابی سے پاس ہو گیا ہے۔',
    diagnostics: ['Headroom compliant with TIA-568.3-D']
  };

  const report = generateOltsAuditReport(sampleData);
  assert.ok(report.includes('SHAHDARA ISP - TIER-1 OPTICAL LOSS TEST SET (OLTS) CERTIFICATION'));
  assert.ok(report.includes('TIA-568.3-D / ISO/IEC 14763-3'));
  assert.ok(report.includes('Kamran Akram'));
  assert.ok(report.includes('1.88 dB'));
  assert.ok(report.includes('1.85 dB'));
  assert.ok(report.includes('1.91 dB'));
  assert.ok(report.includes('PASS'));

  const whatsapp = generateOltsWhatsAppDispatch(sampleData);
  assert.ok(whatsapp.includes('SHAHDARA ISP - OPTICAL LOSS (OLTS) TIER-1 CERTIFICATION'));
  assert.ok(whatsapp.includes('Kamran Akram'));
  assert.ok(whatsapp.includes('*1.88 dB*'));
  assert.ok(whatsapp.includes('*PASS*'));
});

test('OLTS audit log persistence and CSV export operate reliably', async () => {
  const {
    loadOltsAuditLog,
    saveOltsAuditLog,
    clearOltsAuditLog,
    exportOltsAuditsCsv
  } = await import('../nav-olts-cert.js');

  const mockStore = new Map();
  const mockStorage = {
    getItem: k => mockStore.get(k) || null,
    setItem: (k, v) => mockStore.set(k, String(v)),
    removeItem: k => mockStore.delete(k)
  };

  // Initially empty
  assert.deepEqual(loadOltsAuditLog(mockStorage), []);

  // Save 1 record
  const savedList = saveOltsAuditLog({
    linkName: 'Span-Alpha',
    lengthKm: 1.5,
    wavelengthNm: 1310,
    avgLossDb: 0.95,
    budgetDb: 1.50,
    marginDb: 0.55,
    status: 'PASS'
  }, mockStorage);

  assert.equal(savedList.length, 1);
  assert.equal(savedList[0].linkName, 'Span-Alpha');
  assert.ok(savedList[0].id.startsWith('OLTS_'));

  // CSV export
  const csv = exportOltsAuditsCsv(savedList);
  assert.ok(csv.includes('Record ID,Timestamp,Link Name'));
  assert.ok(csv.includes('"Span-Alpha"'));
  assert.ok(csv.includes('0.95'));

  // Clear history
  clearOltsAuditLog(mockStorage);
  assert.deepEqual(loadOltsAuditLog(mockStorage), []);
});

test('index.html and nav.css contain mobile OLTS certification markup and styles', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreOltsBtn"'));
  assert.ok(html.includes('id="mobileOltsModal"'));
  assert.ok(html.includes('id="oltsPresetSelect"'));
  assert.ok(html.includes('id="oltsLengthKm"'));
  assert.ok(html.includes('id="oltsWavelength"'));
  assert.ok(html.includes('id="oltsLossAtoB"'));
  assert.ok(html.includes('id="oltsLossBtoA"'));
  assert.ok(html.includes('id="oltsSvgContainer"'));
  assert.ok(html.includes('id="oltsRefSvgContainer"'));
  assert.ok(html.includes('id="oltsAvgLossDisplay"'));
  assert.ok(html.includes('id="oltsBudgetDisplay"'));
  assert.ok(html.includes('id="oltsMarginDisplay"'));
  assert.ok(html.includes('id="oltsStatusBadge"'));
  assert.ok(html.includes('id="oltsSaveAuditBtn"'));
  assert.ok(html.includes('id="oltsWhatsappBtn"'));
  assert.ok(html.includes('id="oltsExportCsvBtn"'));
  assert.ok(html.includes('id="oltsHistoryTbody"'));

  const css = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(css.includes('.mobile-olts-modal'));
  assert.ok(css.includes('.olts-card'));
  assert.ok(css.includes('.olts-svg-wrap'));
  assert.ok(css.includes('.olts-ref-wrap'));
  assert.ok(css.includes('.olts-metrics-grid'));
  assert.ok(css.includes('.olts-metric-card'));
});

test('nav-fiber-identifier constants and models adhere to ITU-T L.40 standards', async () => {
  const {
    FIBER_IDENTIFIER_STORAGE_KEY,
    CLAMP_ADAPTER_HEADS,
    DETECTED_SIGNAL_MODES,
    TRAFFIC_DIRECTIONS,
    IDENTIFIER_PRESETS
  } = await import('../nav-fiber-identifier.js');

  assert.equal(FIBER_IDENTIFIER_STORAGE_KEY, 'shahdara_fiber_identifier_audits_v1');

  // Clamp Heads
  assert.ok(CLAMP_ADAPTER_HEADS.HEAD_250UM);
  assert.equal(CLAMP_ADAPTER_HEADS.HEAD_250UM.diameterUm, 250);
  assert.equal(CLAMP_ADAPTER_HEADS.HEAD_250UM.maxInsertionLossDb, 0.3);
  assert.ok(CLAMP_ADAPTER_HEADS.HEAD_900UM);
  assert.equal(CLAMP_ADAPTER_HEADS.HEAD_900UM.diameterUm, 900);
  assert.ok(CLAMP_ADAPTER_HEADS.HEAD_2000UM);
  assert.ok(CLAMP_ADAPTER_HEADS.HEAD_3000UM);

  // Signal Modes
  assert.ok(DETECTED_SIGNAL_MODES.DARK);
  assert.equal(DETECTED_SIGNAL_MODES.DARK.safeToCut, true);
  assert.ok(DETECTED_SIGNAL_MODES.CW_TRAFFIC);
  assert.equal(DETECTED_SIGNAL_MODES.CW_TRAFFIC.safeToCut, false);
  assert.ok(DETECTED_SIGNAL_MODES.TONE_270HZ);
  assert.equal(DETECTED_SIGNAL_MODES.TONE_270HZ.toneFreqHz, 270);
  assert.ok(DETECTED_SIGNAL_MODES.TONE_1KHZ);
  assert.equal(DETECTED_SIGNAL_MODES.TONE_1KHZ.toneFreqHz, 1000);
  assert.ok(DETECTED_SIGNAL_MODES.TONE_2KHZ);
  assert.equal(DETECTED_SIGNAL_MODES.TONE_2KHZ.toneFreqHz, 2000);

  // Directions
  assert.ok(TRAFFIC_DIRECTIONS.LEFT_TO_RIGHT);
  assert.ok(TRAFFIC_DIRECTIONS.RIGHT_TO_LEFT);
  assert.ok(TRAFFIC_DIRECTIONS.NONE);

  // Presets
  assert.ok(IDENTIFIER_PRESETS.ACTIVE_GPON_DOWNSTREAM);
  assert.ok(IDENTIFIER_PRESETS.TEST_TONE_1KHZ_FDT);
  assert.ok(IDENTIFIER_PRESETS.DARK_SPARE_CORE);
  assert.ok(IDENTIFIER_PRESETS.HIGH_POWER_FEEDER);
  assert.ok(IDENTIFIER_PRESETS.REVERSE_UPSTREAM_BURST);
});

test('evaluateLiveFiberDetection correctly enforces safety interlock between live traffic and dark fiber', async () => {
  const { evaluateLiveFiberDetection } = await import('../nav-fiber-identifier.js');

  // Case 1: Active CW Traffic (-18.5 dBm) - MUST NOT CUT
  const liveRes = evaluateLiveFiberDetection({
    opticalPowerDbm: -18.5,
    signalModeId: 'CW_TRAFFIC',
    directionId: 'LEFT_TO_RIGHT',
    headId: 'HEAD_900UM',
    wavelengthNm: 1490
  });
  assert.equal(liveRes.safeToCut, false);
  assert.equal(liveRes.statusText, 'ACTIVE TRAFFIC DETECTED');
  assert.equal(liveRes.statusColor, '#ef4444');
  assert.equal(liveRes.direction.id, 'LEFT_TO_RIGHT');
  assert.ok(liveRes.advisoryUrdu.includes('خبردار'));

  // Case 2: Dark Fiber (-55 dBm) - SAFE TO CUT
  const darkRes = evaluateLiveFiberDetection({
    opticalPowerDbm: -55.0,
    signalModeId: 'DARK',
    directionId: 'NONE',
    headId: 'HEAD_250UM',
    wavelengthNm: 1550
  });
  assert.equal(darkRes.safeToCut, true);
  assert.equal(darkRes.statusText, 'DARK FIBER (SAFE TO CUT)');
  assert.equal(darkRes.statusColor, '#10b981');
  assert.equal(darkRes.direction.id, 'NONE');
  assert.ok(darkRes.advisoryUrdu.includes('تسلی بخش'));

  // Case 3: Modulated 1 kHz Test Tone
  const toneRes = evaluateLiveFiberDetection({
    opticalPowerDbm: -12.0,
    signalModeId: 'TONE_1KHZ',
    directionId: 'LEFT_TO_RIGHT',
    headId: 'HEAD_250UM'
  });
  assert.equal(toneRes.safeToCut, false);
  assert.ok(toneRes.statusText.includes('1000 Hz'));
  assert.equal(toneRes.statusColor, '#f59e0b');
  assert.ok(toneRes.audioBeepCadence.includes('1000 Hz'));

  // Case 4: Reverse Upstream Traffic
  const revRes = evaluateLiveFiberDetection({
    opticalPowerDbm: -22.4,
    signalModeId: 'CW_TRAFFIC',
    directionId: 'RIGHT_TO_LEFT',
    headId: 'HEAD_900UM'
  });
  assert.equal(revRes.safeToCut, false);
  assert.equal(revRes.direction.id, 'RIGHT_TO_LEFT');
  assert.ok(revRes.direction.arrowText.includes('REVERSE'));
});

test('renderFiberIdentifierSvg produces valid vector visualization across all signal modes', async () => {
  const { renderFiberIdentifierSvg } = await import('../nav-fiber-identifier.js');

  const liveSvg = renderFiberIdentifierSvg({
    opticalPowerDbm: -18.5,
    signalModeId: 'CW_TRAFFIC',
    directionId: 'LEFT_TO_RIGHT',
    headName: '900 µm Tight Buffer',
    safeToCut: false,
    statusColor: '#ef4444',
    coreName: 'FAT-12 Drop Core #4'
  });
  assert.ok(liveSvg.includes('<svg'));
  assert.ok(liveSvg.includes('viewBox="0 0 760 300"'));
  assert.ok(liveSvg.includes('PD-L'));
  assert.ok(liveSvg.includes('PD-R'));
  assert.ok(liveSvg.includes('-18.5 dBm'));
  assert.ok(liveSvg.includes('TRAFFIC'));
  assert.ok(liveSvg.includes('DO NOT CUT'));
  assert.ok(liveSvg.includes('FAT-12 Drop Core #4'));

  const darkSvg = renderFiberIdentifierSvg({
    opticalPowerDbm: -55.0,
    signalModeId: 'DARK',
    directionId: 'NONE',
    headName: '250 µm Bare Fiber',
    safeToCut: true,
    statusColor: '#10b981',
    coreName: 'Spare Trunk Core #12'
  });
  assert.ok(darkSvg.includes('LO (DARK)'));
  assert.ok(darkSvg.includes('SAFE TO CUT'));

  const toneSvg = renderFiberIdentifierSvg({
    opticalPowerDbm: -12.0,
    signalModeId: 'TONE_1KHZ',
    directionId: 'LEFT_TO_RIGHT',
    headName: '250 µm Bare Fiber',
    safeToCut: false,
    statusColor: '#f59e0b',
    coreName: 'Tracer Core #01'
  });
  assert.ok(toneSvg.includes('TONE_1KHZ'));
});

test('generateFiberIdentifierReport and generateFiberIdentifierWhatsAppDispatch create accurate field logs', async () => {
  const { generateFiberIdentifierReport, generateFiberIdentifierWhatsAppDispatch } = await import('../nav-fiber-identifier.js');

  const auditData = {
    coreName: 'Shahdara Main Trunk Core #3',
    technician: 'Noman Bashir',
    location: 'Ravi Road FDT-01',
    headName: '900 µm Tight Buffer',
    opticalPowerDbm: -18.5,
    signalMode: 'CW Traffic',
    direction: 'L ➔ R',
    wavelengthNm: 1490,
    safeToCut: false,
    statusText: 'ACTIVE TRAFFIC DETECTED',
    advisoryUrdu: '⚠️ خبردار: فائبر پر لائیو ٹریفک موجود ہے۔',
    diagnostics: ['Live customer payload present']
  };

  const report = generateFiberIdentifierReport(auditData);
  assert.ok(report.includes('SHAHDARA ISP - OPTICAL LIVE FIBER IDENTIFIER AUDIT'));
  assert.ok(report.includes('Noman Bashir'));
  assert.ok(report.includes('-18.5 dBm'));
  assert.ok(report.includes('ACTIVE TRAFFIC DETECTED'));

  const wa = generateFiberIdentifierWhatsAppDispatch(auditData);
  assert.ok(wa.includes('LIVE FIBER IDENTIFIER AUDIT'));
  assert.ok(wa.includes('*-18.5 dBm*'));
  assert.ok(wa.includes('NO - ACTIVE TRAFFIC'));
});

test('Fiber identifier audit persistence and CSV export operate reliably', async () => {
  const {
    loadFiberIdentifierAuditLog,
    saveFiberIdentifierAuditLog,
    clearFiberIdentifierAuditLog,
    exportFiberIdentifierAuditsCsv
  } = await import('../nav-fiber-identifier.js');

  const mockStore = new Map();
  const mockStorage = {
    getItem: k => mockStore.get(k) || null,
    setItem: (k, v) => mockStore.set(k, String(v)),
    removeItem: k => mockStore.delete(k)
  };

  assert.deepEqual(loadFiberIdentifierAuditLog(mockStorage), []);

  const list = saveFiberIdentifierAuditLog({
    coreName: 'Core-Beta',
    opticalPowerDbm: -19.2,
    signalMode: 'CW Traffic',
    direction: 'L ➔ R',
    safeToCut: false,
    statusText: 'ACTIVE TRAFFIC'
  }, mockStorage);

  assert.equal(list.length, 1);
  assert.ok(list[0].id.startsWith('IDENT_'));
  assert.equal(list[0].coreName, 'Core-Beta');

  const csv = exportFiberIdentifierAuditsCsv(list);
  assert.ok(csv.includes('Record ID,Timestamp,Core Name'));
  assert.ok(csv.includes('"Core-Beta"'));
  assert.ok(csv.includes('-19.2'));

  clearFiberIdentifierAuditLog(mockStorage);
  assert.deepEqual(loadFiberIdentifierAuditLog(mockStorage), []);
});

test('index.html and nav.css contain mobile fiber identifier markup and styles', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreFiberIdentifierBtn"'));
  assert.ok(html.includes('id="mobileFiberIdentifierModal"'));
  assert.ok(html.includes('id="identPresetSelect"'));
  assert.ok(html.includes('id="identHeadSelect"'));
  assert.ok(html.includes('id="identPowerDbm"'));
  assert.ok(html.includes('id="identModeSelect"'));
  assert.ok(html.includes('id="identDirSelect"'));
  assert.ok(html.includes('id="identSvgContainer"'));
  assert.ok(html.includes('id="identPowerDisplay"'));
  assert.ok(html.includes('id="identStatusBadge"'));
  assert.ok(html.includes('id="identSaveAuditBtn"'));
  assert.ok(html.includes('id="identWhatsappBtn"'));
  assert.ok(html.includes('id="identExportCsvBtn"'));
  assert.ok(html.includes('id="identHistoryTbody"'));

  const css = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(css.includes('.mobile-identifier-modal'));
  assert.ok(css.includes('.identifier-card'));
  assert.ok(css.includes('.identifier-svg-wrap'));
  assert.ok(css.includes('.identifier-metrics-grid'));
  assert.ok(css.includes('.identifier-metric-card'));
});

test('nav-mpo-polarity constants and specifications adhere to TIA-568.3-D standards', async () => {
  const {
    MPO_POLARITY_STORAGE_KEY,
    TIA598_COLOR_CODES,
    POLARITY_METHODS,
    CONNECTOR_GENDERS,
    MPO_PRESETS
  } = await import('../nav-mpo-polarity.js');

  assert.equal(MPO_POLARITY_STORAGE_KEY, 'shahdara_mpo_polarity_audits_v1');

  // Color Codes
  assert.equal(TIA598_COLOR_CODES.length, 12);
  assert.equal(TIA598_COLOR_CODES[0].name, 'Blue');
  assert.equal(TIA598_COLOR_CODES[1].name, 'Orange');
  assert.equal(TIA598_COLOR_CODES[11].name, 'Aqua');

  // Polarity Methods
  assert.ok(POLARITY_METHODS.METHOD_A);
  assert.equal(POLARITY_METHODS.METHOD_A.keyOrientation, 'Key-Up to Key-Down');
  assert.ok(POLARITY_METHODS.METHOD_B);
  assert.equal(POLARITY_METHODS.METHOD_B.keyOrientation, 'Key-Up to Key-Up');
  assert.ok(POLARITY_METHODS.METHOD_C);
  assert.equal(POLARITY_METHODS.METHOD_C.keyOrientation, 'Key-Up to Key-Down');

  // Genders
  assert.ok(CONNECTOR_GENDERS.MALE_PINNED);
  assert.equal(CONNECTOR_GENDERS.MALE_PINNED.hasPins, true);
  assert.ok(CONNECTOR_GENDERS.FEMALE_UNPINNED);
  assert.equal(CONNECTOR_GENDERS.FEMALE_UNPINNED.hasPins, false);

  // Presets
  assert.ok(MPO_PRESETS.PARALLEL_40G_SR4);
  assert.ok(MPO_PRESETS.DUPLEX_BREAKOUT_CASSETTE);
  assert.ok(MPO_PRESETS.PAIR_FLIPPED_TRUNK);
  assert.ok(MPO_PRESETS.HIGH_DENSITY_24F);
});

test('calculateMpoChannelMapping correctly maps Method A, Method B, and Method C with gender safety', async () => {
  const { calculateMpoChannelMapping } = await import('../nav-mpo-polarity.js');

  // Method B (Inverted): Fiber 1 -> 12, 2 -> 11, 12 -> 1
  const bMap = calculateMpoChannelMapping({
    methodId: 'METHOD_B',
    fiberCount: 12,
    genderA: 'MALE_PINNED',
    genderB: 'FEMALE_UNPINNED',
    directMating: true
  });
  assert.equal(bMap.channels.length, 12);
  assert.equal(bMap.channels[0].endAPort, 1);
  assert.equal(bMap.channels[0].endBPort, 12);
  assert.equal(bMap.channels[0].sr4Role, 'Tx 1');
  assert.equal(bMap.channels[11].endAPort, 12);
  assert.equal(bMap.channels[11].endBPort, 1);
  assert.equal(bMap.channels[11].sr4Role, 'Rx 1');
  assert.equal(bMap.matingSafety, 'SAFE');

  // Method A (Straight-Through): Fiber 1 -> 1, 12 -> 12
  const aMap = calculateMpoChannelMapping({
    methodId: 'METHOD_A',
    fiberCount: 12
  });
  assert.equal(aMap.channels[0].endAPort, 1);
  assert.equal(aMap.channels[0].endBPort, 1);
  assert.equal(aMap.channels[11].endAPort, 12);
  assert.equal(aMap.channels[11].endBPort, 12);

  // Method C (Pair-Flipped): 1->2, 2->1, 3->4, 4->3
  const cMap = calculateMpoChannelMapping({
    methodId: 'METHOD_C',
    fiberCount: 12
  });
  assert.equal(cMap.channels[0].endAPort, 1);
  assert.equal(cMap.channels[0].endBPort, 2);
  assert.equal(cMap.channels[1].endAPort, 2);
  assert.equal(cMap.channels[1].endBPort, 1);
  assert.equal(cMap.channels[2].endAPort, 3);
  assert.equal(cMap.channels[2].endBPort, 4);

  // 24-Fiber Ribbon Count
  const map24 = calculateMpoChannelMapping({
    methodId: 'METHOD_B',
    fiberCount: 24
  });
  assert.equal(map24.channels.length, 24);
  assert.equal(map24.channels[0].endBPort, 24);

  // Gender Mating Hazard: Male + Male Direct Mating
  const pinClash = calculateMpoChannelMapping({
    genderA: 'MALE_PINNED',
    genderB: 'MALE_PINNED',
    directMating: true
  });
  assert.equal(pinClash.matingSafety, 'DANGER_PIN_COLLISION');
  assert.ok(pinClash.advisoryUrdu.includes('ٹوٹ جائیں گی'));

  // Gender Mating Warning: Female + Female Direct Mating
  const unpinned = calculateMpoChannelMapping({
    genderA: 'FEMALE_UNPINNED',
    genderB: 'FEMALE_UNPINNED',
    directMating: true
  });
  assert.equal(unpinned.matingSafety, 'WARNING_UNPINNED');
});

test('renderMpoPolaritySvg produces valid vector visualization of ferrule and ribbon traces', async () => {
  const { calculateMpoChannelMapping, renderMpoPolaritySvg } = await import('../nav-mpo-polarity.js');

  const calc = calculateMpoChannelMapping({
    methodId: 'METHOD_B',
    fiberCount: 12,
    genderA: 'FEMALE_UNPINNED',
    genderB: 'MALE_PINNED',
    directMating: true
  });

  const svg = renderMpoPolaritySvg({
    mapping: calc.channels,
    methodId: 'METHOD_B',
    fiberCount: 12,
    genderA: 'FEMALE_UNPINNED',
    genderB: 'MALE_PINNED',
    matingSafety: calc.matingSafety,
    trunkName: 'Test Trunk 40G'
  });

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('viewBox="0 0 760 320"'));
  assert.ok(svg.includes('CONNECTOR END A'));
  assert.ok(svg.includes('CONNECTOR END B'));
  assert.ok(svg.includes('KEY-UP'));
  assert.ok(svg.includes('PINNING: COMPLIANT'));
  assert.ok(svg.includes('Test Trunk 40G'));
});

test('generateMpoPolarityReport and generateMpoPolarityWhatsAppDispatch format accurate field records', async () => {
  const { generateMpoPolarityReport, generateMpoPolarityWhatsAppDispatch } = await import('../nav-mpo-polarity.js');

  const sampleData = {
    trunkName: 'Core-POP-Rack-A04 MPO-12',
    technician: 'Usman Ghani',
    location: 'POP Server Room',
    methodName: 'Method B (Inverted)',
    fiberCount: 12,
    genderAName: 'Female (Unpinned)',
    genderBName: 'Male (Pinned)',
    directMating: true,
    matingSafety: 'SAFE',
    advisoryUrdu: 'تسلی بخش: پننگ اور پولرٹی معیاری ہے۔',
    channels: [
      { endAPort: 1, endBPort: 12, colorName: 'Blue', sr4Role: 'Tx 1' }
    ]
  };

  const report = generateMpoPolarityReport(sampleData);
  assert.ok(report.includes('SHAHDARA ISP - MPO/MTP RIBBON TRUNK POLARITY & PINNING AUDIT'));
  assert.ok(report.includes('Usman Ghani'));
  assert.ok(report.includes('Method B'));
  assert.ok(report.includes('Port  1 [Blue  ] ➔ Port 12 (Tx 1)'));

  const wa = generateMpoPolarityWhatsAppDispatch(sampleData);
  assert.ok(wa.includes('MPO TRUNK POLARITY AUDIT'));
  assert.ok(wa.includes('Usman Ghani'));
  assert.ok(wa.includes('PASSED'));
});

test('MPO polarity audit persistence and CSV export operate reliably', async () => {
  const {
    loadMpoPolarityAuditLog,
    saveMpoPolarityAuditLog,
    clearMpoPolarityAuditLog,
    exportMpoPolarityAuditsCsv
  } = await import('../nav-mpo-polarity.js');

  const mockStore = new Map();
  const mockStorage = {
    getItem: k => mockStore.get(k) || null,
    setItem: (k, v) => mockStore.set(k, String(v)),
    removeItem: k => mockStore.delete(k)
  };

  assert.deepEqual(loadMpoPolarityAuditLog(mockStorage), []);

  const list = saveMpoPolarityAuditLog({
    trunkName: 'Backbone-Ribbon-01',
    methodName: 'Method B',
    fiberCount: 12,
    genderAName: 'Female',
    genderBName: 'Male',
    matingSafety: 'SAFE'
  }, mockStorage);

  assert.equal(list.length, 1);
  assert.ok(list[0].id.startsWith('MPO_'));
  assert.equal(list[0].trunkName, 'Backbone-Ribbon-01');

  const csv = exportMpoPolarityAuditsCsv(list);
  assert.ok(csv.includes('Record ID,Timestamp,Trunk Name'));
  assert.ok(csv.includes('"Backbone-Ribbon-01"'));
  assert.ok(csv.includes('Method B'));

  clearMpoPolarityAuditLog(mockStorage);
  assert.deepEqual(loadMpoPolarityAuditLog(mockStorage), []);
});

test('index.html and nav.css contain mobile MPO polarity markup and styles', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreMpoBtn"'));
  assert.ok(html.includes('id="mobileMpoModal"'));
  assert.ok(html.includes('id="mpoPresetSelect"'));
  assert.ok(html.includes('id="mpoMethodSelect"'));
  assert.ok(html.includes('id="mpoCountSelect"'));
  assert.ok(html.includes('id="mpoGenderASelect"'));
  assert.ok(html.includes('id="mpoGenderBSelect"'));
  assert.ok(html.includes('id="mpoDirectMatingCheck"'));
  assert.ok(html.includes('id="mpoSvgContainer"'));
  assert.ok(html.includes('id="mpoChannelsTbody"'));
  assert.ok(html.includes('id="mpoSaveAuditBtn"'));
  assert.ok(html.includes('id="mpoWhatsappBtn"'));
  assert.ok(html.includes('id="mpoExportCsvBtn"'));
  assert.ok(html.includes('id="mpoHistoryTbody"'));

  const css = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(css.includes('.mobile-mpo-modal'));
  assert.ok(css.includes('.mpo-card'));
  assert.ok(css.includes('.mpo-svg-wrap'));
  assert.ok(css.includes('.mpo-metrics-grid'));
  assert.ok(css.includes('.mpo-metric-card'));
});

test('nav.js correctly re-exports Fast Connector assistant constants and functions', async () => {
  const nav = await import('../nav.js');
  assert.equal(typeof nav.FAST_CONNECTOR_STORAGE_KEY, 'string');
  assert.ok(nav.FAST_CONNECTOR_TYPES.SC_APC);
  assert.ok(nav.FAST_CONNECTOR_TYPES.SC_UPC);
  assert.ok(nav.GEL_CONDITIONS.FRESH);
  assert.ok(nav.GEL_CONDITIONS.DEGRADED);
  assert.ok(nav.GEL_CONDITIONS.DRY_WIPED);
  assert.ok(Array.isArray(nav.FAST_CONNECTOR_PRESETS));
  assert.equal(typeof nav.calculateFastConnectorMetrics, 'function');
  assert.equal(typeof nav.renderFastConnectorDiagramSvg, 'function');
  assert.equal(typeof nav.formatFastConnectorWhatsApp, 'function');
  assert.equal(typeof nav.generateFastConnectorCsv, 'function');
  assert.equal(typeof nav.setupMobileFastConnectorModal, 'function');
});

test('calculateFastConnectorMetrics correctly evaluates optimal termination and defect scenarios', async () => {
  const { calculateFastConnectorMetrics } = await import('../nav-fast-connector.js');

  // 1. Optimal SC/APC termination
  const optimal = calculateFastConnectorMetrics({
    connectorType: 'SC_APC',
    gelCondition: 'FRESH',
    actualCleaveMm: 10.0,
    deflectionBowMm: 1.5,
    cleaveAngleDeg: 0.5,
    clampingForceN: 55
  });

  assert.equal(optimal.isOverallPass, true);
  assert.equal(optimal.isIlPass, true);
  assert.equal(optimal.isRlPass, true);
  assert.equal(optimal.isTensileProofPass, true);
  assert.equal(optimal.airGapUm, 0);
  assert.equal(optimal.bowStatus, 'OPTIMAL');
  assert.equal(optimal.qualityRating, 'EXCELLENT');
  assert.ok(optimal.calculatedIlDb <= 0.30);
  assert.ok(optimal.calculatedRlDb >= 50.0);

  // 2. Short Cleave Length (Air Gap Defect)
  const shortCleave = calculateFastConnectorMetrics({
    connectorType: 'SC_APC',
    gelCondition: 'FRESH',
    actualCleaveMm: 9.0,
    deflectionBowMm: 1.5,
    cleaveAngleDeg: 0.5,
    clampingForceN: 55
  });

  assert.equal(shortCleave.isCleaveShort, true);
  assert.equal(shortCleave.airGapUm, 1000);
  assert.equal(shortCleave.isOverallPass, false);
  assert.ok(shortCleave.qualityRating.includes('FAIL'));

  // 3. Insufficient Deflection Micro-Bow (< 0.5mm)
  const lowBow = calculateFastConnectorMetrics({
    connectorType: 'SC_APC',
    gelCondition: 'FRESH',
    actualCleaveMm: 10.0,
    deflectionBowMm: 0.2,
    cleaveAngleDeg: 0.5,
    clampingForceN: 55
  });
  assert.ok(lowBow.bowStatus.includes('INSUFFICIENT'));
  assert.equal(lowBow.isOverallPass, false);

  // 4. Excessive Deflection Micro-Bow (> 2.5mm)
  const highBow = calculateFastConnectorMetrics({
    connectorType: 'SC_APC',
    gelCondition: 'FRESH',
    actualCleaveMm: 10.0,
    deflectionBowMm: 3.5,
    cleaveAngleDeg: 0.5,
    clampingForceN: 55
  });
  assert.ok(highBow.bowStatus.includes('EXCESSIVE'));

  // 5. Reused Dry Gel Void (severe Fresnel reflection)
  const dryGel = calculateFastConnectorMetrics({
    connectorType: 'SC_UPC',
    gelCondition: 'DRY_WIPED',
    actualCleaveMm: 10.0,
    deflectionBowMm: 1.5,
    cleaveAngleDeg: 0.5,
    clampingForceN: 55
  });
  assert.equal(dryGel.isOverallPass, false);
  assert.ok(dryGel.calculatedIlDb > 0.6);
  assert.ok(dryGel.calculatedRlDb <= 26.0);

  // 6. Loose Drop Clamping (< 50N tensile proof)
  const looseClamp = calculateFastConnectorMetrics({
    connectorType: 'SC_APC',
    gelCondition: 'FRESH',
    actualCleaveMm: 10.0,
    deflectionBowMm: 1.5,
    cleaveAngleDeg: 0.5,
    clampingForceN: 35
  });
  assert.equal(looseClamp.isTensileProofPass, false);
  assert.equal(looseClamp.isOverallPass, false);
});

test('renderFastConnectorDiagramSvg produces comprehensive cutaway SVG', async () => {
  const { calculateFastConnectorMetrics, renderFastConnectorDiagramSvg } = await import('../nav-fast-connector.js');

  const dyn = calculateFastConnectorMetrics({
    connectorType: 'SC_APC',
    gelCondition: 'FRESH',
    actualCleaveMm: 10.0,
    deflectionBowMm: 1.5,
    cleaveAngleDeg: 0.5,
    clampingForceN: 55
  });

  const svg = renderFastConnectorDiagramSvg(dyn);
  assert.ok(svg.includes('<svg class="fast-connector-svg"'));
  assert.ok(svg.includes('FERRULE'));
  assert.ok(svg.includes('V-GROOVE BED'));
  assert.ok(svg.includes('GEL'));
  assert.ok(svg.includes('DROP CABLE'));
  assert.ok(svg.includes('BUFFER'));
  assert.ok(svg.includes('BOW: 1.5mm'));
  assert.ok(svg.includes('INSERTION LOSS (IL)'));
  assert.ok(svg.includes('RETURN LOSS (RL)'));
  assert.ok(svg.includes('CLEAVE GAUGE (10mm)'));
  assert.ok(svg.includes('CLAMPING PROOF (≥50N)'));
});

test('formatFastConnectorWhatsApp formats bilingual Urdu-English report', async () => {
  const { calculateFastConnectorMetrics, formatFastConnectorWhatsApp } = await import('../nav-fast-connector.js');

  const dynPass = calculateFastConnectorMetrics({
    connectorType: 'SC_APC',
    actualCleaveMm: 10.0,
    deflectionBowMm: 1.5
  });

  const textPass = formatFastConnectorWhatsApp(dynPass, { area: 'Shahdara Town', technicianName: 'Arshad Ali' });
  assert.ok(textPass.includes('SHAHDARA ISP · FTTH MECHANICAL FAST CONNECTOR AUDIT'));
  assert.ok(textPass.includes('شاہدہرا آپٹیکل فاسٹ کنیکٹر فیلڈ رپورٹ'));
  assert.ok(textPass.includes('Shahdara Town'));
  assert.ok(textPass.includes('Arshad Ali'));
  assert.ok(textPass.includes('PASSED'));

  const dynFail = calculateFastConnectorMetrics({
    connectorType: 'SC_APC',
    actualCleaveMm: 9.0,
    deflectionBowMm: 0.2
  });
  const textFail = formatFastConnectorWhatsApp(dynFail, { area: 'Ravi Road', technicianName: 'Usman' });
  assert.ok(textFail.includes('FAILED'));
  assert.ok(textFail.includes('Air Gap Detected'));
});

test('generateFastConnectorCsv produces compliant RFC-4180 CSV', async () => {
  const { generateFastConnectorCsv } = await import('../nav-fast-connector.js');

  const records = [
    {
      timestamp: '2026-10-17T06:00:00Z',
      area: 'Begum Kot',
      technicianName: 'Sample Engineer',
      connectorType: 'SC_APC',
      actualCleaveMm: 10.0,
      deflectionBowMm: 1.5,
      cleaveAngleDeg: 0.4,
      gelCondition: 'FRESH',
      clampingForceN: 60,
      calculatedIlDb: 0.22,
      calculatedRlDb: 54.0,
      qualityRating: 'EXCELLENT',
      isOverallPass: true
    }
  ];

  const csv = generateFastConnectorCsv(records);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Timestamp,Area,Technician,Connector Type'));
  assert.ok(csv.includes('"Begum Kot"'));
  assert.ok(csv.includes('"Sample Engineer"'));
  assert.ok(csv.includes('PASS'));
});

test('setupMobileFastConnectorModal binds DOM events and controls lifecycle', async () => {
  const { setupMobileFastConnectorModal } = await import('../nav-fast-connector.js');

  let modalShown = false;
  let modalClosed = false;

  function makeMockElement(id, initialVal = '') {
    const elListeners = {};
    return {
      id,
      value: initialVal,
      textContent: '',
      innerHTML: '',
      dataset: {},
      addEventListener: (evt, handler) => {
        elListeners[evt] = handler;
      },
      trigger: (evt) => {
        if (elListeners[evt]) elListeners[evt]({ target: { value: initialVal } });
      },
      showModal: () => { modalShown = true; },
      close: () => { modalClosed = true; },
      setAttribute: () => {},
      removeAttribute: () => {}
    };
  }

  const elements = {
    mobileFastConnectorModal: makeMockElement('mobileFastConnectorModal'),
    mobileMoreFastConnectorBtn: makeMockElement('mobileMoreFastConnectorBtn'),
    mobileFastConnectorModalCloseBtn: makeMockElement('mobileFastConnectorModalCloseBtn'),
    fcPresetSelect: makeMockElement('fcPresetSelect', 'shahdara-town-drop-apc'),
    fcTypeSelect: makeMockElement('fcTypeSelect', 'SC_APC'),
    fcGelSelect: makeMockElement('fcGelSelect', 'FRESH'),
    fcCleaveSlider: makeMockElement('fcCleaveSlider', '10.0'),
    fcCleaveLabel: makeMockElement('fcCleaveLabel'),
    fcBowSlider: makeMockElement('fcBowSlider', '1.5'),
    fcBowLabel: makeMockElement('fcBowLabel'),
    fcAngleSlider: makeMockElement('fcAngleSlider', '0.5'),
    fcAngleLabel: makeMockElement('fcAngleLabel'),
    fcForceSlider: makeMockElement('fcForceSlider', '55'),
    fcForceLabel: makeMockElement('fcForceLabel'),
    fcAreaSelect: makeMockElement('fcAreaSelect', 'Shahdara Town'),
    fcTechInput: makeMockElement('fcTechInput', 'Arshad Ali'),
    fcDiagramContainer: makeMockElement('fcDiagramContainer'),
    fcResetBtn: makeMockElement('fcResetBtn'),
    fcSaveBtn: makeMockElement('fcSaveBtn'),
    fcWhatsAppBtn: makeMockElement('fcWhatsAppBtn'),
    fcExportCsvBtn: makeMockElement('fcExportCsvBtn')
  };

  const mockDoc = {
    getElementById: (id) => elements[id] || null
  };

  const mockStore = new Map();
  const mockStorage = {
    getItem: (k) => mockStore.get(k) || null,
    setItem: (k, v) => mockStore.set(k, String(v))
  };

  let lastToast = null;
  const controller = setupMobileFastConnectorModal({}, {
    document: mockDoc,
    storage: mockStorage,
    onToast: (msg) => { lastToast = msg; }
  });

  assert.ok(controller);
  assert.equal(typeof controller.open, 'function');
  assert.equal(typeof controller.close, 'function');
  assert.equal(typeof controller.update, 'function');
  assert.equal(typeof controller.getMetrics, 'function');

  // Verify open and close
  controller.open();
  assert.equal(modalShown, true);

  controller.close();
  assert.equal(modalClosed, true);

  // Trigger Save
  elements.fcSaveBtn.trigger('click');
  assert.ok(lastToast && lastToast.includes('audit saved'));
  const audits = controller.getSavedAudits();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].connectorType, 'SC_APC');

  // Trigger Reset
  elements.fcResetBtn.trigger('click');
  assert.ok(lastToast && lastToast.includes('baseline'));
});

test('index.html, nav.css, and app.js correctly integrate Mobile Fast Connector Assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreFastConnectorBtn"'));
  assert.ok(html.includes('id="mobileFastConnectorModal"'));
  assert.ok(html.includes('id="mobileFastConnectorModalCloseBtn"'));
  assert.ok(html.includes('id="fcPresetSelect"'));
  assert.ok(html.includes('id="fcAreaSelect"'));
  assert.ok(html.includes('id="fcTechInput"'));
  assert.ok(html.includes('id="fcTypeSelect"'));
  assert.ok(html.includes('id="fcGelSelect"'));
  assert.ok(html.includes('id="fcCleaveSlider"'));
  assert.ok(html.includes('id="fcBowSlider"'));
  assert.ok(html.includes('id="fcAngleSlider"'));
  assert.ok(html.includes('id="fcForceSlider"'));
  assert.ok(html.includes('id="fcDiagramContainer"'));
  assert.ok(html.includes('id="fcSaveBtn"'));
  assert.ok(html.includes('id="fcWhatsAppBtn"'));
  assert.ok(html.includes('id="fcExportCsvBtn"'));
  assert.ok(html.includes('id="fcResetBtn"'));

  const css = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(css.includes('.fast-connector-card'));
  assert.ok(css.includes('.fast-connector-svg-wrap'));
  assert.ok(css.includes('.mobile-fast-connector-modal'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileFastConnectorModal'));
  assert.ok(app.includes('mobileFastConnectorModalController'));
});

test('nav.js correctly re-exports OTDR Launch Cable assistant constants and functions', async () => {
  const nav = await import('../nav.js');
  assert.equal(typeof nav.OTDR_LAUNCH_STORAGE_KEY, 'string');
  assert.ok(nav.OTDR_PULSE_WIDTHS.PULSE_5NS);
  assert.ok(nav.OTDR_PULSE_WIDTHS.PULSE_30NS);
  assert.ok(nav.OTDR_PULSE_WIDTHS.PULSE_100NS);
  assert.ok(nav.OTDR_LAUNCH_FIBER_TYPES.G652D);
  assert.ok(Array.isArray(nav.OTDR_LAUNCH_WAVELENGTHS));
  assert.ok(Array.isArray(nav.OTDR_LAUNCH_PRESETS));
  assert.equal(typeof nav.calculateOtdrLaunchMetrics, 'function');
  assert.equal(typeof nav.renderOtdrLaunchDiagramSvg, 'function');
  assert.equal(typeof nav.formatOtdrLaunchWhatsApp, 'function');
  assert.equal(typeof nav.generateOtdrLaunchCsv, 'function');
  assert.equal(typeof nav.setupMobileOtdrLaunchModal, 'function');
});

test('calculateOtdrLaunchMetrics accurately handles optimal setup, blind zone, and ghost reflection', async () => {
  const { calculateOtdrLaunchMetrics } = await import('../nav-otdr-launch-cable.js');

  // 1. Optimal setup: 500m launch + 300m tail, 30ns pulse
  const optimal = calculateOtdrLaunchMetrics({
    pulseWidthKey: 'PULSE_30NS',
    fiberTypeKey: 'G652D',
    wavelength: 1310,
    launchCableLengthM: 500,
    futLengthM: 2400,
    tailCableLengthM: 300,
    nearEndReflectanceDb: -52.0,
    nearEndLossDb: 0.25,
    farEndLossDb: 0.28
  });

  assert.equal(optimal.isOverallPass, true);
  assert.equal(optimal.hasLaunchCable, true);
  assert.equal(optimal.isNearEndMeasurable, true);
  assert.equal(optimal.hasTailCable, true);
  assert.equal(optimal.isFarEndMeasurable, true);
  assert.equal(optimal.isHighReflectance, false);
  assert.equal(optimal.ghostEchoDetected, false);
  assert.equal(optimal.launchVerdict, 'OPTIMAL');
  assert.equal(optimal.tailVerdict, 'OPTIMAL');
  assert.equal(optimal.qualityRating, 'EXCELLENT');
  assert.ok(optimal.totalLinkLossDb > 0);

  // 2. Direct connection without launch spool (Blind Zone)
  const blind = calculateOtdrLaunchMetrics({
    pulseWidthKey: 'PULSE_100NS',
    launchCableLengthM: 0,
    futLengthM: 2000,
    tailCableLengthM: 0
  });

  assert.equal(blind.hasLaunchCable, false);
  assert.equal(blind.isNearEndMeasurable, false);
  assert.equal(blind.isOverallPass, false);
  assert.ok(blind.launchVerdict.includes('BLIND ZONE'));
  assert.ok(blind.qualityRating.includes('FAIL'));

  // 3. Ghost reflection detected from poor reflectance
  const ghost = calculateOtdrLaunchMetrics({
    pulseWidthKey: 'PULSE_30NS',
    launchCableLengthM: 500,
    futLengthM: 3000,
    tailCableLengthM: 300,
    nearEndReflectanceDb: -26.0 // High reflectance!
  });

  assert.equal(ghost.isHighReflectance, true);
  assert.equal(ghost.ghostEchoDetected, true);
  assert.equal(ghost.ghostDistanceM, 1000); // 2 * 500m
  assert.equal(ghost.isOverallPass, false);
  assert.ok(ghost.ghostDescription.includes('GHOST ECHO'));

  // 4. Underlength launch spool (< ADZ * 2.5)
  const shortLaunch = calculateOtdrLaunchMetrics({
    pulseWidthKey: 'PULSE_100NS', // ADZ = 40m, needs >= 100m
    launchCableLengthM: 50,
    futLengthM: 2000,
    tailCableLengthM: 100
  });
  assert.equal(shortLaunch.isLaunchAdequate, false);
  assert.ok(shortLaunch.launchVerdict.includes('UNDERLENGTH'));
});

test('renderOtdrLaunchDiagramSvg outputs complete vector waveform and telemetry', async () => {
  const { calculateOtdrLaunchMetrics, renderOtdrLaunchDiagramSvg } = await import('../nav-otdr-launch-cable.js');

  const dyn = calculateOtdrLaunchMetrics({
    pulseWidthKey: 'PULSE_30NS',
    launchCableLengthM: 500,
    futLengthM: 2400,
    tailCableLengthM: 300,
    nearEndReflectanceDb: -52.0
  });

  const svg = renderOtdrLaunchDiagramSvg(dyn);
  assert.ok(svg.includes('<svg class="otdr-launch-svg"'));
  assert.ok(svg.includes('OTDR'));
  assert.ok(svg.includes('LAUNCH: 500m'));
  assert.ok(svg.includes('ODF BULKHEAD'));
  assert.ok(svg.includes('FIBER UNDER TEST (FUT): 2400m'));
  assert.ok(svg.includes('DROP TERM'));
  assert.ok(svg.includes('TAIL: 300m'));
  assert.ok(svg.includes('NEAR-END ODF BULKHEAD'));
  assert.ok(svg.includes('TOTAL LINK LOSS BUDGET'));
});

test('formatOtdrLaunchWhatsApp and generateOtdrLaunchCsv output structured field logs', async () => {
  const { calculateOtdrLaunchMetrics, formatOtdrLaunchWhatsApp, generateOtdrLaunchCsv } = await import('../nav-otdr-launch-cable.js');

  const dyn = calculateOtdrLaunchMetrics({
    pulseWidthKey: 'PULSE_30NS',
    launchCableLengthM: 500,
    futLengthM: 2400,
    tailCableLengthM: 300
  });

  const wa = formatOtdrLaunchWhatsApp(dyn, { area: 'Shahdara Town', technicianName: 'Sajjad Malik' });
  assert.ok(wa.includes('SHAHDARA ISP · FTTH OTDR LAUNCH CABLE AUDIT'));
  assert.ok(wa.includes('شاہدہرا آپٹیکل ٹائم ڈومین ریفلیکٹومیٹر لانچ رپورٹ'));
  assert.ok(wa.includes('Shahdara Town'));
  assert.ok(wa.includes('Sajjad Malik'));
  assert.ok(wa.includes('PASSED'));

  const records = [
    {
      timestamp: '2026-10-17T06:20:00Z',
      area: 'Shahdara Town',
      technicianName: 'Sajjad Malik',
      wavelength: 1310,
      pulseWidth: '30 ns',
      launchLenM: 500,
      futLenM: 2400,
      tailLenM: 300,
      nearEndLossDb: 0.25,
      nearEndReflectanceDb: -52.0,
      farEndLossDb: 0.28,
      totalLinkLossDb: 1.65,
      ghostEchoDetected: false,
      qualityRating: 'EXCELLENT',
      isOverallPass: true
    }
  ];

  const csv = generateOtdrLaunchCsv(records);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Timestamp,Area,Technician,Wavelength (nm)'));
  assert.ok(csv.includes('"Shahdara Town"'));
  assert.ok(csv.includes('PASS'));
});

test('setupMobileOtdrLaunchModal binds DOM events and executes controller actions', async () => {
  const { setupMobileOtdrLaunchModal } = await import('../nav-otdr-launch-cable.js');

  let modalShown = false;
  let modalClosed = false;

  function makeMockElement(id, initialVal = '') {
    const elListeners = {};
    return {
      id,
      value: initialVal,
      textContent: '',
      innerHTML: '',
      dataset: {},
      addEventListener: (evt, handler) => {
        elListeners[evt] = handler;
      },
      trigger: (evt) => {
        if (elListeners[evt]) elListeners[evt]({ target: { value: initialVal } });
      },
      showModal: () => { modalShown = true; },
      close: () => { modalClosed = true; },
      setAttribute: () => {},
      removeAttribute: () => {}
    };
  }

  const elements = {
    mobileOtdrLaunchModal: makeMockElement('mobileOtdrLaunchModal'),
    mobileMoreOtdrLaunchBtn: makeMockElement('mobileMoreOtdrLaunchBtn'),
    mobileOtdrLaunchModalCloseBtn: makeMockElement('mobileOtdrLaunchModalCloseBtn'),
    otdrLaunchPresetSelect: makeMockElement('otdrLaunchPresetSelect', 'shahdara-town-feeder-optimal'),
    otdrLaunchPulseSelect: makeMockElement('otdrLaunchPulseSelect', 'PULSE_30NS'),
    otdrLaunchFiberSelect: makeMockElement('otdrLaunchFiberSelect', 'G652D'),
    otdrLaunchWaveSelect: makeMockElement('otdrLaunchWaveSelect', '1310'),
    otdrLaunchCableSlider: makeMockElement('otdrLaunchCableSlider', '500'),
    otdrLaunchCableLabel: makeMockElement('otdrLaunchCableLabel'),
    otdrLaunchFutSlider: makeMockElement('otdrLaunchFutSlider', '2400'),
    otdrLaunchFutLabel: makeMockElement('otdrLaunchFutLabel'),
    otdrLaunchTailSlider: makeMockElement('otdrLaunchTailSlider', '300'),
    otdrLaunchTailLabel: makeMockElement('otdrLaunchTailLabel'),
    otdrLaunchNearLossSlider: makeMockElement('otdrLaunchNearLossSlider', '0.25'),
    otdrLaunchNearLossLabel: makeMockElement('otdrLaunchNearLossLabel'),
    otdrLaunchReflSlider: makeMockElement('otdrLaunchReflSlider', '-52.0'),
    otdrLaunchReflLabel: makeMockElement('otdrLaunchReflLabel'),
    otdrLaunchAreaSelect: makeMockElement('otdrLaunchAreaSelect', 'Shahdara Town'),
    otdrLaunchTechInput: makeMockElement('otdrLaunchTechInput', 'Sajjad Malik'),
    otdrLaunchDiagramContainer: makeMockElement('otdrLaunchDiagramContainer'),
    otdrLaunchResetBtn: makeMockElement('otdrLaunchResetBtn'),
    otdrLaunchSaveBtn: makeMockElement('otdrLaunchSaveBtn'),
    otdrLaunchWhatsAppBtn: makeMockElement('otdrLaunchWhatsAppBtn'),
    otdrLaunchExportCsvBtn: makeMockElement('otdrLaunchExportCsvBtn')
  };

  const mockDoc = {
    getElementById: (id) => elements[id] || null
  };

  const mockStore = new Map();
  const mockStorage = {
    getItem: (k) => mockStore.get(k) || null,
    setItem: (k, v) => mockStore.set(k, String(v))
  };

  let lastToast = null;
  const controller = setupMobileOtdrLaunchModal({}, {
    document: mockDoc,
    storage: mockStorage,
    onToast: (msg) => { lastToast = msg; }
  });

  assert.ok(controller);
  assert.equal(typeof controller.open, 'function');
  assert.equal(typeof controller.close, 'function');
  assert.equal(typeof controller.update, 'function');
  assert.equal(typeof controller.getMetrics, 'function');

  controller.open();
  assert.equal(modalShown, true);

  controller.close();
  assert.equal(modalClosed, true);

  elements.otdrLaunchSaveBtn.trigger('click');
  assert.ok(lastToast && lastToast.includes('audit saved'));
  const audits = controller.getSavedAudits();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].launchLenM, 500);

  elements.otdrLaunchResetBtn.trigger('click');
  assert.ok(lastToast && lastToast.includes('baseline'));
});

test('index.html, nav.css, and app.js correctly integrate Mobile OTDR Launch Cable Assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreOtdrLaunchBtn"'));
  assert.ok(html.includes('id="mobileOtdrLaunchModal"'));
  assert.ok(html.includes('id="mobileOtdrLaunchModalCloseBtn"'));
  assert.ok(html.includes('id="otdrLaunchPresetSelect"'));
  assert.ok(html.includes('id="otdrLaunchAreaSelect"'));
  assert.ok(html.includes('id="otdrLaunchTechInput"'));
  assert.ok(html.includes('id="otdrLaunchPulseSelect"'));
  assert.ok(html.includes('id="otdrLaunchFiberSelect"'));
  assert.ok(html.includes('id="otdrLaunchWaveSelect"'));
  assert.ok(html.includes('id="otdrLaunchCableSlider"'));
  assert.ok(html.includes('id="otdrLaunchFutSlider"'));
  assert.ok(html.includes('id="otdrLaunchTailSlider"'));
  assert.ok(html.includes('id="otdrLaunchNearLossSlider"'));
  assert.ok(html.includes('id="otdrLaunchReflSlider"'));
  assert.ok(html.includes('id="otdrLaunchDiagramContainer"'));
  assert.ok(html.includes('id="otdrLaunchSaveBtn"'));
  assert.ok(html.includes('id="otdrLaunchWhatsAppBtn"'));
  assert.ok(html.includes('id="otdrLaunchExportCsvBtn"'));
  assert.ok(html.includes('id="otdrLaunchResetBtn"'));

  const css = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(css.includes('.otdr-launch-card'));
  assert.ok(css.includes('.otdr-launch-svg-wrap'));
  assert.ok(css.includes('.mobile-otdr-launch-modal'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileOtdrLaunchModal'));
  assert.ok(app.includes('mobileOtdrLaunchModalController'));
});

// ==========================================================================
// Tests for Bare Fiber Adapter (BFA) & Temporary Splice Assistant (agent2)
// ==========================================================================

test('calculateBareFiberAdapterMetrics calculates correct metrics for optimal SC/APC coupling', async () => {
  const { calculateBareFiberAdapterMetrics, BFA_CONNECTOR_TYPES } = await import('../nav.js');

  const result = calculateBareFiberAdapterMetrics({
    connectorType: 'SC_APC',
    indexMatching: 'FRESH_IMF',
    vgrooveCondition: 'PRISTINE',
    bareGlassStripMm: 12.0,
    clampRetentionN: 3.5,
    cleaveQuality: 'OPTIMAL'
  });

  assert.ok(result);
  assert.equal(result.connectorType, 'SC_APC');
  assert.equal(result.isStripPass, true);
  assert.equal(result.isClampSufficient, true);
  assert.equal(result.isIlPass, true);
  assert.equal(result.isRlPass, true);
  assert.equal(result.verdict, 'PASS');
  assert.ok(result.estimatedIlDb <= 0.40);
  assert.ok(result.estimatedRlDb >= 50.0);
  assert.equal(result.gapWarning, null);
});

test('calculateBareFiberAdapterMetrics detects under-inserted air gap and loose clamp failures', async () => {
  const { calculateBareFiberAdapterMetrics } = await import('../nav.js');

  const underResult = calculateBareFiberAdapterMetrics({
    connectorType: 'SC_UPC',
    indexMatching: 'AIR_GAP_DRY',
    vgrooveCondition: 'PRISTINE',
    bareGlassStripMm: 10.0, // Under-inserted < 10.8mm
    clampRetentionN: 1.5, // Loose clamp < 2.0N
    cleaveQuality: 'ACCEPTABLE'
  });

  assert.ok(underResult);
  assert.equal(underResult.isStripPass, false);
  assert.equal(underResult.isClampSufficient, false);
  assert.ok(underResult.gapWarning && underResult.gapWarning.includes('under-inserted'));
  assert.equal(underResult.verdict, 'FAIL');
});

test('calculateBareFiberAdapterMetrics detects chipped cleave and damaged V-groove caution/fail', async () => {
  const { calculateBareFiberAdapterMetrics } = await import('../nav.js');

  const chippedResult = calculateBareFiberAdapterMetrics({
    connectorType: 'FC_UPC',
    indexMatching: 'FRESH_IMF',
    vgrooveCondition: 'DAMAGED',
    bareGlassStripMm: 15.5, // Over-stripped > 14.0mm
    clampRetentionN: 3.0,
    cleaveQuality: 'CHIPPED'
  });

  assert.ok(chippedResult);
  assert.equal(chippedResult.isStripPass, false);
  assert.ok(chippedResult.gapWarning && chippedResult.gapWarning.includes('Excess bare glass'));
  assert.ok(chippedResult.estimatedIlDb > 0.35); // Exceeds FC_UPC limit
  assert.equal(chippedResult.verdict, 'FAIL');
});

test('renderBareFiberAdapterSvg returns valid SVG with elements and labels', async () => {
  const { calculateBareFiberAdapterMetrics, renderBareFiberAdapterSvg } = await import('../nav.js');

  const dynamics = calculateBareFiberAdapterMetrics({
    connectorType: 'SC_APC',
    indexMatching: 'FRESH_IMF',
    vgrooveCondition: 'PRISTINE',
    bareGlassStripMm: 12.0,
    clampRetentionN: 3.5
  });

  const svg = renderBareFiberAdapterSvg(dynamics, {
    connectorType: 'SC_APC',
    bareGlassStripMm: 12.0,
    clampRetentionN: 3.5
  });

  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('class="bfa-svg"'));
  assert.ok(svg.includes('Zirconia Ferrule Body'));
  assert.ok(svg.includes('Ceramic Alignment V-Groove Channel'));
  assert.ok(svg.includes('Magnetic Fiber Clamp'));
  assert.ok(svg.includes('INSERTION LOSS (IL)'));
  assert.ok(svg.includes('RETURN LOSS (RL)'));
});

test('formatBareFiberAdapterWhatsApp and generateBareFiberAdapterCsv output properly formatted data', async () => {
  const { calculateBareFiberAdapterMetrics, formatBareFiberAdapterWhatsApp, generateBareFiberAdapterCsv } = await import('../nav.js');

  const dynamics = calculateBareFiberAdapterMetrics({
    connectorType: 'SC_APC',
    indexMatching: 'FRESH_IMF',
    vgrooveCondition: 'PRISTINE',
    bareGlassStripMm: 12.0,
    clampRetentionN: 3.5
  });

  const waMsg = formatBareFiberAdapterWhatsApp(dynamics, {
    technicianName: 'Arshad Ali',
    area: 'Shahdara Town',
    notes: 'Emergency cable cut verification'
  });

  assert.ok(waMsg.includes('SHAHDARA ISP - BARE FIBER ADAPTER'));
  assert.ok(waMsg.includes('Arshad Ali'));
  assert.ok(waMsg.includes('Shahdara Town'));
  assert.ok(waMsg.includes('IEC 60793-1-40'));

  const csv = generateBareFiberAdapterCsv([
    {
      id: 'bfa-101',
      timestamp: '2026-10-17T07:30:00Z',
      technicianName: 'Arshad Ali',
      area: 'Shahdara Town',
      connectorType: 'SC_APC',
      indexMatching: 'FRESH_IMF',
      vgrooveCondition: 'PRISTINE',
      actualStripMm: 12.0,
      clampRetentionN: 3.5,
      estimatedIlDb: 0.23,
      estimatedRlDb: 56.0,
      verdict: 'PASS',
      notes: 'Optimal coupling'
    }
  ]);

  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Audit_ID,Timestamp,Technician,Area,Connector_Type'));
  assert.ok(csv.includes('bfa-101'));
  assert.ok(csv.includes('Arshad Ali'));
});

test('setupMobileBareFiberAdapterModal initializes, handles UI events and manages audit logs', async () => {
  const { setupMobileBareFiberAdapterModal, loadBareFiberAdapterAuditLog } = await import('../nav.js');

  let modalShown = false;
  let modalClosed = false;

  function createMockElem(tag = 'div') {
    const listeners = {};
    return {
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      addEventListener: (evt, handler) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(handler);
      },
      trigger: (evt) => {
        (listeners[evt] || []).forEach(fn => fn({ preventDefault: () => {} }));
      },
      querySelectorAll: () => [],
      setAttribute: () => {},
      removeAttribute: () => {}
    };
  }

  const elements = {
    mobileBareFiberAdapterModal: {
      showModal: () => { modalShown = true; },
      close: () => { modalClosed = true; },
      setAttribute: () => {},
      removeAttribute: () => {}
    },
    mobileBareFiberAdapterModalCloseBtn: createMockElem('button'),
    mobileMoreBareFiberAdapterBtn: createMockElem('button'),
    bfaPresetSelect: createMockElem('select'),
    bfaAreaSelect: createMockElem('select'),
    bfaTechInput: createMockElem('input'),
    bfaConnectorTypeSelect: createMockElem('select'),
    bfaImfSelect: createMockElem('select'),
    bfaVgrooveSelect: createMockElem('select'),
    bfaStripSlider: createMockElem('input'),
    bfaStripLabel: createMockElem('span'),
    bfaClampSlider: createMockElem('input'),
    bfaClampLabel: createMockElem('span'),
    bfaCleaveSelect: createMockElem('select'),
    bfaNotesInput: createMockElem('input'),
    bfaResetBtn: createMockElem('button'),
    bfaSaveBtn: createMockElem('button'),
    bfaWhatsAppBtn: createMockElem('button'),
    bfaExportCsvBtn: createMockElem('button'),
    bfaDiagramContainer: createMockElem('div'),
    bfaHistoryTbody: createMockElem('tbody'),
    bfaHistorySearch: createMockElem('input'),
    bfaHistoryVerdictFilter: createMockElem('select')
  };

  const mockDoc = {
    getElementById: (id) => elements[id] || null
  };

  const mockStore = new Map();
  const mockStorage = {
    getItem: (k) => mockStore.get(k) || null,
    setItem: (k, v) => mockStore.set(k, String(v)),
    removeItem: (k) => mockStore.delete(k)
  };

  let lastToast = null;
  const controller = setupMobileBareFiberAdapterModal({}, {
    document: mockDoc,
    storage: mockStorage,
    onToast: (msg) => { lastToast = msg; }
  });

  assert.ok(controller);
  assert.equal(typeof controller.open, 'function');
  assert.equal(typeof controller.close, 'function');
  assert.equal(typeof controller.update, 'function');
  assert.equal(typeof controller.getMetrics, 'function');

  controller.open();
  assert.equal(modalShown, true);

  controller.close();
  assert.equal(modalClosed, true);

  elements.bfaSaveBtn.trigger('click');
  assert.ok(lastToast && lastToast.includes('audit saved'));
  const audits = controller.getSavedAudits();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].connectorType, 'SC_APC');

  elements.bfaResetBtn.trigger('click');
  assert.ok(lastToast && lastToast.includes('baseline'));
});

test('index.html, nav.css, and app.js correctly integrate Mobile Bare Fiber Adapter Assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreBareFiberAdapterBtn"'));
  assert.ok(html.includes('id="mobileBareFiberAdapterModal"'));
  assert.ok(html.includes('id="mobileBareFiberAdapterModalCloseBtn"'));
  assert.ok(html.includes('id="bfaPresetSelect"'));
  assert.ok(html.includes('id="bfaAreaSelect"'));
  assert.ok(html.includes('id="bfaTechInput"'));
  assert.ok(html.includes('id="bfaConnectorTypeSelect"'));
  assert.ok(html.includes('id="bfaImfSelect"'));
  assert.ok(html.includes('id="bfaVgrooveSelect"'));
  assert.ok(html.includes('id="bfaCleaveSelect"'));
  assert.ok(html.includes('id="bfaNotesInput"'));
  assert.ok(html.includes('id="bfaStripSlider"'));
  assert.ok(html.includes('id="bfaClampSlider"'));
  assert.ok(html.includes('id="bfaDiagramContainer"'));
  assert.ok(html.includes('id="bfaSaveBtn"'));
  assert.ok(html.includes('id="bfaWhatsAppBtn"'));
  assert.ok(html.includes('id="bfaExportCsvBtn"'));
  assert.ok(html.includes('id="bfaResetBtn"'));
  assert.ok(html.includes('id="bfaHistoryTbody"'));

  const css = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(css.includes('.bfa-card'));
  assert.ok(css.includes('.bfa-svg-wrap'));
  assert.ok(css.includes('.mobile-bfa-modal'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileBareFiberAdapterModal'));
  assert.ok(app.includes('mobileBareFiberAdapterModalController'));
});

// ==========================================================================
// Tests for Stabilized Light Source (SLS) & Tone Generator Assistant (agent2)
// ==========================================================================

test('dbmToMilliwatts converts dBm to optical power in milliwatts', async () => {
  const { dbmToMilliwatts } = await import('../nav.js');

  assert.equal(dbmToMilliwatts(0.0), 1.0);
  assert.equal(dbmToMilliwatts(3.0), 1.995);
  assert.equal(dbmToMilliwatts(-3.0), 0.501);
  assert.equal(dbmToMilliwatts(10.0), 10.0);
});

test('calculateSlsMetrics calculates calibrated baseline and thermal drift for reference standard', async () => {
  const { calculateSlsMetrics } = await import('../nav.js');

  const result = calculateSlsMetrics({
    wavelength: 'WAVE_1310',
    modulation: 'CW',
    connectorType: 'SC_APC',
    outputPowerDbm: 0.0,
    warmUpMinutes: 15,
    ambientTempC: 25.0
  });

  assert.ok(result);
  assert.equal(result.wavelengthNm, 1310);
  assert.equal(result.frequencyHz, 0);
  assert.equal(result.isWarmedUp, true);
  assert.equal(result.warmUpAlert, null);
  assert.equal(result.isTempSafe, true);
  assert.equal(result.isShortTermCompliant, true);
  assert.equal(result.isLongTermCompliant, true);
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.statusBadge, 'CALIBRATED & STABLE');
  assert.ok(result.totalShortTermDriftDb <= 0.05);
  assert.ok(result.effectivePowerDbm < 0.0); // -0.15 dB bulkhead loss
  assert.ok(result.estimatedBatteryLifeHours > 20);
});

test('calculateSlsMetrics detects cold-start warm-up penalty and excessive heat drift', async () => {
  const { calculateSlsMetrics } = await import('../nav.js');

  const uncalibrated = calculateSlsMetrics({
    wavelength: 'WAVE_1550',
    modulation: 'TONE_1KHZ',
    connectorType: 'SC_APC',
    outputPowerDbm: -5.0,
    warmUpMinutes: 3, // < 10 mins
    ambientTempC: 42.0 // > 35°C
  });

  assert.ok(uncalibrated);
  assert.equal(uncalibrated.isWarmedUp, false);
  assert.ok(uncalibrated.warmUpAlert && uncalibrated.warmUpAlert.includes('Insufficient laser warm-up'));
  assert.ok(uncalibrated.totalShortTermDriftDb > 0.05); // Thermal drift exceeds Class 1 limit
  assert.equal(uncalibrated.verdict, 'FAIL');
  assert.equal(uncalibrated.statusBadge, 'EXCESSIVE THERMAL DRIFT');
});

test('calculateSlsMetrics correctly configures 2kHz high-penetration tone for splitter', async () => {
  const { calculateSlsMetrics } = await import('../nav.js');

  const toneResult = calculateSlsMetrics({
    wavelength: 'WAVE_1490',
    modulation: 'TONE_2KHZ',
    connectorType: 'SC_UPC',
    outputPowerDbm: 3.0,
    warmUpMinutes: 12,
    ambientTempC: 26.0
  });

  assert.ok(toneResult);
  assert.equal(toneResult.frequencyHz, 2000);
  assert.equal(toneResult.dutyCyclePercent, 50);
  assert.equal(toneResult.isWarmedUp, true);
  assert.equal(toneResult.verdict, 'PASS');
});

test('renderSlsDiagramSvg generates comprehensive SVG schematic with LCD and waveform', async () => {
  const { calculateSlsMetrics, renderSlsDiagramSvg } = await import('../nav.js');

  const dynamics = calculateSlsMetrics({
    wavelength: 'WAVE_1310',
    modulation: 'TONE_1KHZ',
    outputPowerDbm: 0.0,
    warmUpMinutes: 15
  });

  const svg = renderSlsDiagramSvg(dynamics, {
    wavelength: 'WAVE_1310',
    modulation: 'TONE_1KHZ'
  });

  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('class="sls-svg"'));
  assert.ok(svg.includes('SHAHDARA SLS-800 OPTICAL XMTR'));
  assert.ok(svg.includes('1310'));
  assert.ok(svg.includes('1000 Hz'));
  assert.ok(svg.includes('CARRIER / MODULATED TONE WAVEFORM'));
  assert.ok(svg.includes('THERMAL DRIFT (15m)'));
});

test('formatSlsToneWhatsApp and generateSlsToneCsv output bilingual dispatches and RFC-4180 CSV', async () => {
  const { calculateSlsMetrics, formatSlsToneWhatsApp, generateSlsToneCsv } = await import('../nav.js');

  const dynamics = calculateSlsMetrics({
    wavelength: 'WAVE_1310',
    modulation: 'CW',
    outputPowerDbm: 0.0,
    warmUpMinutes: 15
  });

  const waMsg = formatSlsToneWhatsApp(dynamics, {
    technicianName: 'Arshad Ali',
    area: 'Shahdara Town',
    notes: 'Reference calibration'
  });

  assert.ok(waMsg.includes('SHAHDARA ISP - STABILIZED LIGHT SOURCE'));
  assert.ok(waMsg.includes('Arshad Ali'));
  assert.ok(waMsg.includes('Shahdara Town'));
  assert.ok(waMsg.includes('ITU-T G.652.D'));

  const csv = generateSlsToneCsv([
    {
      id: 'sls-201',
      timestamp: '2026-10-17T07:35:00Z',
      technicianName: 'Arshad Ali',
      area: 'Shahdara Town',
      wavelengthNm: 1310,
      modulationId: 'CW',
      connectorId: 'SC_APC',
      targetPowerDbm: 0.0,
      effectivePowerDbm: -0.15,
      warmUpMinutes: 15,
      ambientTempC: 25,
      totalShortTermDriftDb: 0.03,
      verdict: 'PASS',
      notes: 'Reference set'
    }
  ]);

  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Audit_ID,Timestamp,Technician,Area,Wavelength_nm'));
  assert.ok(csv.includes('sls-201'));
  assert.ok(csv.includes('Arshad Ali'));
});

test('setupMobileSlsToneModal initializes, handles UI events and manages audit logs', async () => {
  const { setupMobileSlsToneModal } = await import('../nav.js');

  let modalShown = false;
  let modalClosed = false;

  function createMockElem(tag = 'div') {
    const listeners = {};
    return {
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      addEventListener: (evt, handler) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(handler);
      },
      trigger: (evt) => {
        (listeners[evt] || []).forEach(fn => fn({ preventDefault: () => {} }));
      },
      querySelectorAll: () => [],
      setAttribute: () => {},
      removeAttribute: () => {}
    };
  }

  const elements = {
    mobileSlsToneModal: {
      showModal: () => { modalShown = true; },
      close: () => { modalClosed = true; },
      setAttribute: () => {},
      removeAttribute: () => {}
    },
    mobileSlsToneModalCloseBtn: createMockElem('button'),
    mobileMoreSlsToneBtn: createMockElem('button'),
    slsPresetSelect: createMockElem('select'),
    slsAreaSelect: createMockElem('select'),
    slsTechInput: createMockElem('input'),
    slsWaveSelect: createMockElem('select'),
    slsModSelect: createMockElem('select'),
    slsConnSelect: createMockElem('select'),
    slsPowerSlider: createMockElem('input'),
    slsPowerLabel: createMockElem('span'),
    slsWarmUpSlider: createMockElem('input'),
    slsWarmUpLabel: createMockElem('span'),
    slsTempSlider: createMockElem('input'),
    slsTempLabel: createMockElem('span'),
    slsNotesInput: createMockElem('input'),
    slsResetBtn: createMockElem('button'),
    slsSaveBtn: createMockElem('button'),
    slsWhatsAppBtn: createMockElem('button'),
    slsExportCsvBtn: createMockElem('button'),
    slsDiagramContainer: createMockElem('div'),
    slsHistoryTbody: createMockElem('tbody'),
    slsHistorySearch: createMockElem('input'),
    slsHistoryVerdictFilter: createMockElem('select')
  };

  const mockDoc = {
    getElementById: (id) => elements[id] || null
  };

  const mockStore = new Map();
  const mockStorage = {
    getItem: (k) => mockStore.get(k) || null,
    setItem: (k, v) => mockStore.set(k, String(v)),
    removeItem: (k) => mockStore.delete(k)
  };

  let lastToast = null;
  const controller = setupMobileSlsToneModal({}, {
    document: mockDoc,
    storage: mockStorage,
    onToast: (msg) => { lastToast = msg; }
  });

  assert.ok(controller);
  assert.equal(typeof controller.open, 'function');
  assert.equal(typeof controller.close, 'function');
  assert.equal(typeof controller.update, 'function');
  assert.equal(typeof controller.getMetrics, 'function');

  controller.open();
  assert.equal(modalShown, true);

  controller.close();
  assert.equal(modalClosed, true);

  elements.slsSaveBtn.trigger('click');
  assert.ok(lastToast && lastToast.includes('audit saved'));
  const audits = controller.getSavedAudits();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].wavelengthNm, 1310);

  elements.slsResetBtn.trigger('click');
  assert.ok(lastToast && lastToast.includes('baseline'));
});

test('index.html, nav.css, and app.js correctly integrate Mobile Stabilized Light Source Assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreSlsToneBtn"'));
  assert.ok(html.includes('id="mobileSlsToneModal"'));
  assert.ok(html.includes('id="mobileSlsToneModalCloseBtn"'));
  assert.ok(html.includes('id="slsPresetSelect"'));
  assert.ok(html.includes('id="slsAreaSelect"'));
  assert.ok(html.includes('id="slsTechInput"'));
  assert.ok(html.includes('id="slsWaveSelect"'));
  assert.ok(html.includes('id="slsModSelect"'));
  assert.ok(html.includes('id="slsConnSelect"'));
  assert.ok(html.includes('id="slsPowerSlider"'));
  assert.ok(html.includes('id="slsWarmUpSlider"'));
  assert.ok(html.includes('id="slsTempSlider"'));
  assert.ok(html.includes('id="slsNotesInput"'));
  assert.ok(html.includes('id="slsDiagramContainer"'));
  assert.ok(html.includes('id="slsSaveBtn"'));
  assert.ok(html.includes('id="slsWhatsAppBtn"'));
  assert.ok(html.includes('id="slsExportCsvBtn"'));
  assert.ok(html.includes('id="slsResetBtn"'));
  assert.ok(html.includes('id="slsHistoryTbody"'));

  const css = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(css.includes('.sls-card'));
  assert.ok(css.includes('.sls-svg-wrap'));
  assert.ok(css.includes('.mobile-sls-modal'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileSlsToneModal'));
  assert.ok(app.includes('mobileSlsToneModalController'));
});

// ==========================================================================
// Tests for Optical Fiber Talk Set (FOTS) Assistant (agent2)
// ==========================================================================

test('calculateFiberTalksetMetrics calculates link loss and pristine voice MOS for direct feeder', async () => {
  const { calculateFiberTalksetMetrics } = await import('../nav.js');

  const result = calculateFiberTalksetMetrics({
    fiberLengthKm: 12.5,
    spliceCount: 4,
    connectorCount: 2,
    splitterType: 'NONE',
    headsetVolumePercent: 75
  });

  assert.ok(result);
  assert.equal(result.fiberLengthKm, 12.5);
  assert.equal(result.spliceCount, 4);
  assert.equal(result.isLinkConnected, true);
  assert.equal(result.verdict, 'PASS');
  assert.ok(result.totalLinkLossDb < 10.0);
  assert.ok(result.opticalMarginDb > 35.0);
  assert.equal(result.voiceQualityScore, 4.5);
  assert.ok(result.voiceQualityRating.includes('HD Studio'));
});

test('calculateFiberTalksetMetrics detects optical link drop when loss exceeds 45dB budget', async () => {
  const { calculateFiberTalksetMetrics } = await import('../nav.js');

  const dropResult = calculateFiberTalksetMetrics({
    fiberLengthKm: 110.0, // 38.5 dB fiber loss
    spliceCount: 20, // 1.0 dB splice loss
    connectorCount: 4, // 1.0 dB connector loss
    splitterType: 'SPLIT_1_8' // 10.6 dB splitter loss -> total > 50 dB
  });

  assert.ok(dropResult);
  assert.equal(dropResult.isLinkConnected, false);
  assert.equal(dropResult.verdict, 'FAIL');
  assert.equal(dropResult.voiceQualityScore, 1.0);
  assert.ok(dropResult.voiceQualityRating.includes('LINK DROP'));
  assert.ok(dropResult.opticalMarginDb < 0);
});

test('renderFiberTalksetSvg returns valid SVG with Unit A, Unit B, and full-duplex light rays', async () => {
  const { calculateFiberTalksetMetrics, renderFiberTalksetSvg } = await import('../nav.js');

  const dynamics = calculateFiberTalksetMetrics({
    fiberLengthKm: 12.5,
    spliceCount: 4
  });

  const svg = renderFiberTalksetSvg(dynamics, {
    fiberLengthKm: 12.5
  });

  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('class="talkset-svg"'));
  assert.ok(svg.includes('MASTER UNIT A'));
  assert.ok(svg.includes('SLAVE UNIT B'));
  assert.ok(svg.includes('1310 nm Voice Carrier'));
  assert.ok(svg.includes('1550 nm Voice Carrier'));
  assert.ok(svg.includes('TOTAL FIBER LOSS'));
  assert.ok(svg.includes('OPTICAL LINK MARGIN'));
});

test('formatFiberTalksetWhatsApp and generateFiberTalksetCsv output bilingual text and CSV', async () => {
  const { calculateFiberTalksetMetrics, formatFiberTalksetWhatsApp, generateFiberTalksetCsv } = await import('../nav.js');

  const dynamics = calculateFiberTalksetMetrics({
    fiberLengthKm: 12.5,
    spliceCount: 4
  });

  const waMsg = formatFiberTalksetWhatsApp(dynamics, {
    technicianA: 'Arshad Ali',
    technicianB: 'Sajjad Malik',
    area: 'Shahdara Town',
    notes: 'Coordination clean'
  });

  assert.ok(waMsg.includes('SHAHDARA ISP - FIBER OPTIC TALK SET'));
  assert.ok(waMsg.includes('Arshad Ali'));
  assert.ok(waMsg.includes('Sajjad Malik'));
  assert.ok(waMsg.includes('ITU-T G.652'));

  const csv = generateFiberTalksetCsv([
    {
      id: 'fots-301',
      timestamp: '2026-10-17T07:40:00Z',
      technicianA: 'Arshad Ali',
      technicianB: 'Sajjad Malik',
      area: 'Shahdara Town',
      fiberLengthKm: 12.5,
      spliceCount: 4,
      connectorCount: 2,
      splitterId: 'NONE',
      totalLinkLossDb: 5.08,
      opticalMarginDb: 39.92,
      receivedPowerDbm: -10.08,
      voiceQualityScore: 4.5,
      verdict: 'PASS',
      notes: 'Clear line'
    }
  ]);

  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Audit_ID,Timestamp,Technician_CO,Technician_Field,Area'));
  assert.ok(csv.includes('fots-301'));
  assert.ok(csv.includes('Arshad Ali'));
});

test('setupMobileFiberTalksetModal initializes, handles UI events and manages audit logs', async () => {
  const { setupMobileFiberTalksetModal } = await import('../nav.js');

  let modalShown = false;
  let modalClosed = false;

  function createMockElem(tag = 'div') {
    const listeners = {};
    return {
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      addEventListener: (evt, handler) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(handler);
      },
      trigger: (evt) => {
        (listeners[evt] || []).forEach(fn => fn({ preventDefault: () => {} }));
      },
      querySelectorAll: () => [],
      setAttribute: () => {},
      removeAttribute: () => {}
    };
  }

  const elements = {
    mobileFiberTalksetModal: {
      showModal: () => { modalShown = true; },
      close: () => { modalClosed = true; },
      setAttribute: () => {},
      removeAttribute: () => {}
    },
    mobileFiberTalksetModalCloseBtn: createMockElem('button'),
    mobileMoreFiberTalksetBtn: createMockElem('button'),
    talksetPresetSelect: createMockElem('select'),
    talksetAreaSelect: createMockElem('select'),
    talksetTechAInput: createMockElem('input'),
    talksetTechBInput: createMockElem('input'),
    talksetDistSlider: createMockElem('input'),
    talksetDistLabel: createMockElem('span'),
    talksetSpliceSlider: createMockElem('input'),
    talksetSpliceLabel: createMockElem('span'),
    talksetConnSlider: createMockElem('input'),
    talksetConnLabel: createMockElem('span'),
    talksetSplitterSelect: createMockElem('select'),
    talksetVolumeSlider: createMockElem('input'),
    talksetVolumeLabel: createMockElem('span'),
    talksetNotesInput: createMockElem('input'),
    talksetResetBtn: createMockElem('button'),
    talksetSaveBtn: createMockElem('button'),
    talksetWhatsAppBtn: createMockElem('button'),
    talksetExportCsvBtn: createMockElem('button'),
    talksetDiagramContainer: createMockElem('div'),
    talksetHistoryTbody: createMockElem('tbody'),
    talksetHistorySearch: createMockElem('input'),
    talksetHistoryVerdictFilter: createMockElem('select')
  };

  const mockDoc = {
    getElementById: (id) => elements[id] || null
  };

  const mockStore = new Map();
  const mockStorage = {
    getItem: (k) => mockStore.get(k) || null,
    setItem: (k, v) => mockStore.set(k, String(v)),
    removeItem: (k) => mockStore.delete(k)
  };

  let lastToast = null;
  const controller = setupMobileFiberTalksetModal({}, {
    document: mockDoc,
    storage: mockStorage,
    onToast: (msg) => { lastToast = msg; }
  });

  assert.ok(controller);
  assert.equal(typeof controller.open, 'function');
  assert.equal(typeof controller.close, 'function');
  assert.equal(typeof controller.update, 'function');
  assert.equal(typeof controller.getMetrics, 'function');

  controller.open();
  assert.equal(modalShown, true);

  controller.close();
  assert.equal(modalClosed, true);

  elements.talksetSaveBtn.trigger('click');
  assert.ok(lastToast && lastToast.includes('audit saved'));
  const audits = controller.getSavedAudits();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].fiberLengthKm, 12.5);

  elements.talksetResetBtn.trigger('click');
  assert.ok(lastToast && lastToast.includes('baseline'));
});

test('index.html, nav.css, and app.js correctly integrate Mobile Fiber Optic Talk Set Assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreFiberTalksetBtn"'));
  assert.ok(html.includes('id="mobileFiberTalksetModal"'));
  assert.ok(html.includes('id="mobileFiberTalksetModalCloseBtn"'));
  assert.ok(html.includes('id="talksetPresetSelect"'));
  assert.ok(html.includes('id="talksetAreaSelect"'));
  assert.ok(html.includes('id="talksetTechAInput"'));
  assert.ok(html.includes('id="talksetTechBInput"'));
  assert.ok(html.includes('id="talksetDistSlider"'));
  assert.ok(html.includes('id="talksetSpliceSlider"'));
  assert.ok(html.includes('id="talksetConnSlider"'));
  assert.ok(html.includes('id="talksetSplitterSelect"'));
  assert.ok(html.includes('id="talksetVolumeSlider"'));
  assert.ok(html.includes('id="talksetNotesInput"'));
  assert.ok(html.includes('id="talksetDiagramContainer"'));
  assert.ok(html.includes('id="talksetSaveBtn"'));
  assert.ok(html.includes('id="talksetWhatsAppBtn"'));
  assert.ok(html.includes('id="talksetExportCsvBtn"'));
  assert.ok(html.includes('id="talksetResetBtn"'));
  assert.ok(html.includes('id="talksetHistoryTbody"'));

  const css = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(css.includes('.talkset-card'));
  assert.ok(css.includes('.talkset-svg-wrap'));
  assert.ok(css.includes('.mobile-talkset-modal'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileFiberTalksetModal'));
  assert.ok(app.includes('mobileFiberTalksetModalController'));
});

test('calculateChromaticDispersion computes SMF-28 G.652.D dispersion accurately', async () => {
  const { calculateChromaticDispersion } = await import('../nav.js');

  const d1310 = calculateChromaticDispersion(1310);
  assert.ok(Math.abs(d1310) < 1.0, `Expected near zero dispersion at 1310nm, got ${d1310}`);

  const d1490 = calculateChromaticDispersion(1490);
  assert.ok(d1490 > 10.0 && d1490 < 15.0, `Expected ~12-14 ps/(nm*km) at 1490nm, got ${d1490}`);

  const d1550 = calculateChromaticDispersion(1550);
  assert.ok(d1550 > 15.0 && d1550 < 19.0, `Expected ~17 ps/(nm*km) at 1550nm, got ${d1550}`);

  const d1610 = calculateChromaticDispersion(1610);
  assert.ok(d1610 > 19.0 && d1610 < 23.0, `Expected ~20-22 ps/(nm*km) at 1610nm, got ${d1610}`);
});

test('calculateWdmSpectrumMetrics evaluates CWDM & DWDM channel powers, ripple, OSNR, and compliance', async () => {
  const { calculateWdmSpectrumMetrics } = await import('../nav.js');

  // Test empty channels
  const empty = calculateWdmSpectrumMetrics({ channels: [] });
  assert.equal(empty.status, 'FAIL');
  assert.equal(empty.channelCount, 0);

  // Test optimal CWDM 8-channel ring
  const cwdm = calculateWdmSpectrumMetrics({
    gridType: 'CWDM_18CH',
    noiseFloorDbm: -45.0,
    resolutionBwNm: 0.1,
    channels: [
      { channelId: '1470', measuredWavelengthNm: 1470.1, powerDbm: -3.0 },
      { channelId: '1490', measuredWavelengthNm: 1490.0, powerDbm: -3.2 },
      { channelId: '1510', measuredWavelengthNm: 1510.2, powerDbm: -3.5 },
      { channelId: '1530', measuredWavelengthNm: 1530.1, powerDbm: -3.4 },
      { channelId: '1550', measuredWavelengthNm: 1550.0, powerDbm: -3.0 },
      { channelId: '1570', measuredWavelengthNm: 1570.2, powerDbm: -3.3 },
      { channelId: '1590', measuredWavelengthNm: 1589.9, powerDbm: -3.6 },
      { channelId: '1610', measuredWavelengthNm: 1610.1, powerDbm: -4.0 }
    ]
  });

  assert.equal(cwdm.status, 'PASS');
  assert.equal(cwdm.channelCount, 8);
  assert.equal(cwdm.powerRippleDb, 1.0);
  assert.ok(cwdm.avgOsnrDb > 40.0);
  assert.ok(cwdm.totalPowerDbm > 5.0 && cwdm.totalPowerDbm < 7.0);
  assert.equal(cwdm.maxDriftNm, 0.2);

  // Test DWDM with severe tilt hazard
  const tiltHazard = calculateWdmSpectrumMetrics({
    gridType: 'DWDM_100GHZ',
    noiseFloorDbm: -35.0,
    resolutionBwNm: 0.1,
    channels: [
      { channelId: 'C21', measuredWavelengthNm: 1560.60, powerDbm: +2.0 },
      { channelId: 'C28', measuredWavelengthNm: 1554.94, powerDbm: -1.0 },
      { channelId: 'C36', measuredWavelengthNm: 1548.51, powerDbm: -4.0 },
      { channelId: 'C44', measuredWavelengthNm: 1542.14, powerDbm: -8.5 }
    ]
  });

  assert.equal(tiltHazard.status, 'FAIL');
  assert.equal(tiltHazard.powerRippleDb, 10.5); // +2.0 - (-8.5) = 10.5 dB ripple > 4.5 dB
});

test('renderWdmSpectrumSvg generates accessible SVG with bars, labels, and noise floor', async () => {
  const { calculateWdmSpectrumMetrics, renderWdmSpectrumSvg } = await import('../nav.js');

  const metrics = calculateWdmSpectrumMetrics({
    gridType: 'CWDM_18CH',
    noiseFloorDbm: -45.0,
    channels: [
      { channelId: '1310', measuredWavelengthNm: 1310.0, powerDbm: 0.0 },
      { channelId: '1550', measuredWavelengthNm: 1550.0, powerDbm: -2.0 }
    ]
  });

  const svg = renderWdmSpectrumSvg(metrics, { width: 700, height: 260 });
  assert.ok(svg.includes('<svg viewBox="0 0 700 260"'));
  assert.ok(svg.includes('Noise Floor: -45 dBm'));
  assert.ok(svg.includes('data-channel-id="1310"'));
  assert.ok(svg.includes('data-channel-id="1550"'));
  assert.ok(svg.includes('1310nm'));
  assert.ok(svg.includes('1550nm'));
});

test('formatWdmSpectrumWhatsApp, generateWdmSpectrumCsv, and audit log manage storage', async () => {
  const {
    calculateWdmSpectrumMetrics,
    formatWdmSpectrumWhatsApp,
    generateWdmSpectrumCsv,
    loadWdmSpectrumAuditLog,
    saveWdmSpectrumAuditLog,
    clearWdmSpectrumAuditLog
  } = await import('../nav.js');

  const metrics = calculateWdmSpectrumMetrics({
    gridType: 'CWDM_18CH',
    channels: [{ channelId: '1550', measuredWavelengthNm: 1550.1, powerDbm: -3.5 }]
  });

  const record = {
    id: 'WDM-TEST-1',
    timestamp: '2026-10-17T08:45:00.000Z',
    area: 'Shahdara Town',
    gridType: 'CWDM_18CH',
    technician: 'Noman Tariq',
    notes: 'Routine test',
    metrics
  };

  const text = formatWdmSpectrumWhatsApp(record);
  assert.ok(text.includes('SHAHDARA ISP - OPTICAL WDM SPECTRUM REPORT'));
  assert.ok(text.includes('Shahdara Town'));
  assert.ok(text.includes('Noman Tariq'));

  const csv = generateWdmSpectrumCsv([record]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('WDM-TEST-1'));
  assert.ok(csv.includes('Shahdara Town'));

  const mockStore = {};
  const mockStorage = {
    getItem: (k) => mockStore[k] || null,
    setItem: (k, v) => { mockStore[k] = String(v); },
    removeItem: (k) => { delete mockStore[k]; }
  };

  saveWdmSpectrumAuditLog([record], mockStorage);
  const loaded = loadWdmSpectrumAuditLog(mockStorage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'WDM-TEST-1');

  clearWdmSpectrumAuditLog(mockStorage);
  assert.equal(loadWdmSpectrumAuditLog(mockStorage).length, 0);
});

test('setupMobileWdmSpectrumModal wires interactions, presets, and calculations', async () => {
  const { setupMobileWdmSpectrumModal } = await import('../nav.js');

  let modalOpened = false;
  let modalClosed = false;

  const makeEl = (id) => ({
    id,
    value: '',
    textContent: '',
    className: '',
    dataset: {},
    innerHTML: '',
    style: {},
    appendChild: function(c) { this.children = this.children || []; this.children.push(c); },
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  });

  const mockDoc = {
    getElementById: (id) => makeEl(id),
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      innerHTML: '',
      style: {},
      appendChild: () => {}
    })
  };

  const origDoc = globalThis.document;
  globalThis.document = mockDoc;
  try {
    const controller = setupMobileWdmSpectrumModal({}, { storage: null, onToast: () => {} });
    assert.ok(controller);
    controller.open();
    assert.equal(modalOpened, true);
    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('calculateMidspanAccessMetrics computes optimal blade depth, clearance, and macro-bend penalties', async () => {
  const { calculateMidspanAccessMetrics } = await import('../nav.js');

  // Optimal mid-span shave
  const safe = calculateMidspanAccessMetrics({
    cableType: 'STRANDED_LOOSE_TUBE',
    slitterTool: 'ROTARY_MICROMETER',
    totalCores: 48,
    bufferTubeCount: 4,
    tappedTubeIndex: 1,
    tappedCoreCount: 12,
    tubeOuterDiameterMm: 2.2,
    tubeWallThicknessMm: 0.40,
    bladeDepthMm: 0.34,
    slackLoopRadiusMm: 38.0
  });

  assert.equal(safe.status, 'PASS');
  assert.equal(safe.coresPerTube, 12);
  assert.equal(safe.expressCoreCount, 36);
  assert.equal(safe.expressTubeCount, 3);
  assert.equal(safe.optimalBladeDepthMm, 0.34);
  assert.equal(safe.clearanceMicrons, 60);
  assert.equal(safe.isBladeTooDeep, false);
  assert.equal(safe.macroBendPenaltyDb, 0.0);

  // Over-depth blade hazard
  const hazard = calculateMidspanAccessMetrics({
    cableType: 'STRANDED_LOOSE_TUBE',
    tubeWallThicknessMm: 0.40,
    bladeDepthMm: 0.42, // deeper than wall thickness!
    slackLoopRadiusMm: 20.0 // violated bend radius!
  });

  assert.equal(hazard.status, 'FAIL');
  assert.equal(hazard.isBladeTooDeep, true);
  assert.equal(hazard.isBendRadiusViolated, true);
  assert.ok(hazard.macroBendPenaltyDb > 0.0);
});

test('renderMidspanAccessSvg generates cutaway diagram with sheath, express loop, and blade callout', async () => {
  const { calculateMidspanAccessMetrics, renderMidspanAccessSvg } = await import('../nav.js');

  const metrics = calculateMidspanAccessMetrics({
    cableType: 'STRANDED_LOOSE_TUBE',
    totalCores: 48,
    tappedCoreCount: 12,
    slackLoopRadiusMm: 38.0
  });

  const svg = renderMidspanAccessSvg(metrics, { width: 700, height: 260 });
  assert.ok(svg.includes('<svg viewBox="0 0 700 260"'));
  assert.ok(svg.includes('CABLE INLET'));
  assert.ok(svg.includes('EXPRESS OUTLET'));
  assert.ok(svg.includes('CENTRAL FRP/STEEL STRENGTH MEMBER'));
  assert.ok(svg.includes('Express Uncut Tubes'));
  assert.ok(svg.includes('Tapped 12 Fibers'));
});

test('formatMidspanAccessWhatsApp, generateMidspanAccessCsv, and audit log manage storage', async () => {
  const {
    calculateMidspanAccessMetrics,
    formatMidspanAccessWhatsApp,
    generateMidspanAccessCsv,
    loadMidspanAccessAuditLog,
    saveMidspanAccessAuditLog,
    clearMidspanAccessAuditLog
  } = await import('../nav.js');

  const metrics = calculateMidspanAccessMetrics({
    cableType: 'STRANDED_LOOSE_TUBE',
    totalCores: 48,
    tappedCoreCount: 12
  });

  const record = {
    id: 'MID-TEST-1',
    timestamp: '2026-10-17T08:46:00.000Z',
    area: 'Shahdara Town',
    cableType: 'STRANDED_LOOSE_TUBE',
    slitterTool: 'ROTARY_MICROMETER',
    technician: 'Rashid Mahmood',
    notes: 'Mid-span splice',
    metrics
  };

  const text = formatMidspanAccessWhatsApp(record);
  assert.ok(text.includes('SHAHDARA ISP - MID-SPAN BUFFER TUBE ACCESS REPORT'));
  assert.ok(text.includes('Shahdara Town'));
  assert.ok(text.includes('Rashid Mahmood'));

  const csv = generateMidspanAccessCsv([record]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('MID-TEST-1'));

  const mockStore = {};
  const mockStorage = {
    getItem: (k) => mockStore[k] || null,
    setItem: (k, v) => { mockStore[k] = String(v); },
    removeItem: (k) => { delete mockStore[k]; }
  };

  saveMidspanAccessAuditLog([record], mockStorage);
  const loaded = loadMidspanAccessAuditLog(mockStorage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'MID-TEST-1');

  clearMidspanAccessAuditLog(mockStorage);
  assert.equal(loadMidspanAccessAuditLog(mockStorage).length, 0);
});

test('setupMobileMidspanAccessModal wires interactions, presets, and calculations', async () => {
  const { setupMobileMidspanAccessModal } = await import('../nav.js');

  let modalOpened = false;
  let modalClosed = false;

  const makeEl = (id) => ({
    id,
    value: '',
    textContent: '',
    className: '',
    dataset: {},
    innerHTML: '',
    style: {},
    appendChild: function(c) { this.children = this.children || []; this.children.push(c); },
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  });

  const mockDoc = {
    getElementById: (id) => makeEl(id),
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      innerHTML: '',
      style: {},
      appendChild: () => {}
    })
  };

  const origDoc = globalThis.document;
  globalThis.document = mockDoc;
  try {
    const controller = setupMobileMidspanAccessModal({}, { storage: null, onToast: () => {} });
    assert.ok(controller);
    controller.open();
    assert.equal(modalOpened, true);
    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('calculatePowerLoggerMetrics computes power stability, ripple, sigma, and flapping transients', async () => {
  const { calculatePowerLoggerMetrics } = await import('../nav.js');

  // Empty telemetry
  const empty = calculatePowerLoggerMetrics({ samplesDbm: [] });
  assert.equal(empty.status, 'FAIL');
  assert.equal(empty.sampleCount, 0);

  // Stable GPON link
  const stable = calculatePowerLoggerMetrics({
    samplesDbm: [-19.2, -19.1, -19.3, -19.2, -19.2, -19.1, -19.3, -19.2],
    samplingIntervalSec: 1.0,
    receiverSensitivityDbm: -27.0
  });

  assert.equal(stable.status, 'PASS');
  assert.equal(stable.sampleCount, 8);
  assert.equal(stable.durationSec, 7.0);
  assert.equal(stable.avgPowerDbm, -19.2);
  assert.equal(stable.powerRippleDb, 0.2);
  assert.ok(stable.stdDevDb < 0.1);
  assert.equal(stable.flappingEventsCount, 0);
  assert.equal(stable.dropoutsCount, 0);

  // Severe flapping & sensitivity dropouts
  const flapping = calculatePowerLoggerMetrics({
    samplesDbm: [-18.0, -18.2, -28.5, -28.9, -18.1, -29.0], // Jumps >= 1.5dB and drops < -27.0dBm
    samplingIntervalSec: 1.0,
    receiverSensitivityDbm: -27.0
  });

  assert.equal(flapping.status, 'FAIL');
  assert.ok(flapping.flappingEventsCount >= 3);
  assert.ok(flapping.dropoutsCount >= 3);
  assert.equal(flapping.powerRippleDb, 11.0);
});

test('renderPowerLoggerSvg generates oscilloscope strip-chart with sensitivity lines and markers', async () => {
  const { calculatePowerLoggerMetrics, renderPowerLoggerSvg } = await import('../nav.js');

  const metrics = calculatePowerLoggerMetrics({
    samplesDbm: [-19.0, -19.2, -28.0, -19.1],
    samplingIntervalSec: 1.0,
    receiverSensitivityDbm: -27.0
  });

  const svg = renderPowerLoggerSvg(metrics, { width: 700, height: 260 });
  assert.ok(svg.includes('<svg viewBox="0 0 700 260"'));
  assert.ok(svg.includes('ONT Sensitivity Limit: -27 dBm'));
  assert.ok(svg.includes('Avg:'));
  assert.ok(svg.includes('DROP'));
  assert.ok(svg.includes('FLAP'));
});

test('formatPowerLoggerWhatsApp, generatePowerLoggerCsv, and audit log manage storage', async () => {
  const {
    calculatePowerLoggerMetrics,
    formatPowerLoggerWhatsApp,
    generatePowerLoggerCsv,
    loadPowerLoggerAuditLog,
    savePowerLoggerAuditLog,
    clearPowerLoggerAuditLog
  } = await import('../nav.js');

  const metrics = calculatePowerLoggerMetrics({
    samplesDbm: [-19.2, -19.1, -19.3]
  });

  const record = {
    id: 'PWR-TEST-1',
    timestamp: '2026-10-17T08:47:00.000Z',
    area: 'Shahdara Town',
    wavelengthNm: 1490,
    technician: 'Noman Tariq',
    notes: 'Power telemetry test',
    metrics
  };

  const text = formatPowerLoggerWhatsApp(record);
  assert.ok(text.includes('SHAHDARA ISP - OPTICAL POWER LOG & FLAPPING REPORT'));
  assert.ok(text.includes('Shahdara Town'));
  assert.ok(text.includes('Noman Tariq'));

  const csv = generatePowerLoggerCsv([record]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('PWR-TEST-1'));

  const mockStore = {};
  const mockStorage = {
    getItem: (k) => mockStore[k] || null,
    setItem: (k, v) => { mockStore[k] = String(v); },
    removeItem: (k) => { delete mockStore[k]; }
  };

  savePowerLoggerAuditLog([record], mockStorage);
  const loaded = loadPowerLoggerAuditLog(mockStorage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'PWR-TEST-1');

  clearPowerLoggerAuditLog(mockStorage);
  assert.equal(loadPowerLoggerAuditLog(mockStorage).length, 0);
});

test('setupMobilePowerLoggerModal wires interactions, presets, and calculations', async () => {
  const { setupMobilePowerLoggerModal } = await import('../nav.js');

  let modalOpened = false;
  let modalClosed = false;

  const makeEl = (id) => ({
    id,
    value: '',
    textContent: '',
    className: '',
    dataset: {},
    innerHTML: '',
    style: {},
    appendChild: function(c) { this.children = this.children || []; this.children.push(c); },
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  });

  const mockDoc = {
    getElementById: (id) => makeEl(id),
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      innerHTML: '',
      style: {},
      appendChild: () => {}
    })
  };

  const origDoc = globalThis.document;
  globalThis.document = mockDoc;
  try {
    const controller = setupMobilePowerLoggerModal({}, { storage: null, onToast: () => {} });
    assert.ok(controller);
    controller.open();
    assert.equal(modalOpened, true);
    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html, styles.css, nav.css, and app.js correctly integrate WDM spectrum, midspan access, and power logger assistants', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreWdmSpectrumBtn"'));
  assert.ok(html.includes('id="mobileWdmSpectrumModal"'));
  assert.ok(html.includes('id="wdmPresetSelect"'));
  assert.ok(html.includes('id="wdmSvgContainer"'));

  assert.ok(html.includes('id="mobileMoreMidspanAccessBtn"'));
  assert.ok(html.includes('id="mobileMidspanAccessModal"'));
  assert.ok(html.includes('id="midspanPresetSelect"'));
  assert.ok(html.includes('id="midspanSvgContainer"'));

  assert.ok(html.includes('id="mobileMorePowerLoggerBtn"'));
  assert.ok(html.includes('id="mobilePowerLoggerModal"'));
  assert.ok(html.includes('id="powerLoggerPresetSelect"'));
  assert.ok(html.includes('id="powerLoggerSvgContainer"'));

  const navCss = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(navCss.includes('.mobile-wdm-spectrum-modal'));
  assert.ok(navCss.includes('.mobile-midspan-access-modal'));
  assert.ok(navCss.includes('.mobile-power-logger-modal'));

  const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(stylesCss.includes('#wdmSvgContainer'));
  assert.ok(stylesCss.includes('#midspanSvgContainer'));
  assert.ok(stylesCss.includes('#powerLoggerSvgContainer'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileWdmSpectrumModal'));
  assert.ok(app.includes('mobileWdmSpectrumModalController'));
  assert.ok(app.includes('setupMobileMidspanAccessModal'));
  assert.ok(app.includes('mobileMidspanAccessModalController'));
  assert.ok(app.includes('setupMobilePowerLoggerModal'));
  assert.ok(app.includes('mobilePowerLoggerModalController'));
});

test('calculateDropRetentionMetrics calculates catenary tension, wind load, strain, and safety factors', async () => {
  const { calculateDropRetentionMetrics } = await import('../nav.js');

  // Standard safe span
  const safe = calculateDropRetentionMetrics({
    cableType: 'FLAT_DROP_2X5',
    clampType: 'WEDGE_DROP_CLAMP',
    spanLengthM: 45.0,
    midspanSagM: 0.65,
    windSpeedKmh: 40.0
  });

  assert.equal(safe.status, 'PASS');
  assert.ok(safe.totalTensionN > 80 && safe.totalTensionN < 160);
  assert.ok(safe.strainPercent < 0.33);
  assert.ok(safe.clampHoldingFactor > 1.4);
  assert.ok(safe.clampSlipFactor > 2.0);

  // Severe over-tension hazard (flat drop over 90m span with tight 0.3m sag)
  const hazard = calculateDropRetentionMetrics({
    cableType: 'FLAT_DROP_2X5',
    clampType: 'WEDGE_DROP_CLAMP',
    spanLengthM: 90.0,
    midspanSagM: 0.30,
    windSpeedKmh: 60.0
  });

  assert.equal(hazard.status, 'FAIL');
  assert.ok(hazard.totalTensionN > 300); // Exceeds 200N limit
});

test('renderDropRetentionSvg generates pure vector SVG with pole, clamp, and catenary curve', async () => {
  const { calculateDropRetentionMetrics, renderDropRetentionSvg } = await import('../nav.js');

  const metrics = calculateDropRetentionMetrics({
    cableType: 'FLAT_DROP_2X5',
    spanLengthM: 45.0,
    midspanSagM: 0.65
  });

  const svg = renderDropRetentionSvg(metrics, { width: 700, height: 260 });
  assert.ok(svg.includes('<svg viewBox="0 0 700 260"'));
  assert.ok(svg.includes('UTILITY POLE'));
  assert.ok(svg.includes('FAR POLE'));
  assert.ok(svg.includes('Tension:'));
  assert.ok(svg.includes('Fiber Elastic Strain:'));
});

test('formatDropRetentionWhatsApp, generateDropRetentionCsv, and audit log manage storage', async () => {
  const {
    calculateDropRetentionMetrics,
    formatDropRetentionWhatsApp,
    generateDropRetentionCsv,
    loadDropRetentionAuditLog,
    saveDropRetentionAuditLog,
    clearDropRetentionAuditLog
  } = await import('../nav.js');

  const metrics = calculateDropRetentionMetrics({
    cableType: 'FLAT_DROP_2X5',
    spanLengthM: 45.0
  });

  const record = {
    id: 'RET-TEST-1',
    timestamp: '2026-10-17T08:52:00.000Z',
    area: 'Shahdara Town',
    cableType: 'FLAT_DROP_2X5',
    clampType: 'WEDGE_DROP_CLAMP',
    technician: 'Rashid Mahmood',
    notes: 'Pole span test',
    metrics
  };

  const text = formatDropRetentionWhatsApp(record);
  assert.ok(text.includes('SHAHDARA ISP - DROP CABLE RETENTION & TENSION REPORT'));
  assert.ok(text.includes('Shahdara Town'));
  assert.ok(text.includes('Rashid Mahmood'));

  const csv = generateDropRetentionCsv([record]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('RET-TEST-1'));

  const mockStore = {};
  const mockStorage = {
    getItem: (k) => mockStore[k] || null,
    setItem: (k, v) => { mockStore[k] = String(v); },
    removeItem: (k) => { delete mockStore[k]; }
  };

  saveDropRetentionAuditLog([record], mockStorage);
  const loaded = loadDropRetentionAuditLog(mockStorage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'RET-TEST-1');

  clearDropRetentionAuditLog(mockStorage);
  assert.equal(loadDropRetentionAuditLog(mockStorage).length, 0);
});

test('setupMobileDropRetentionModal wires interactions, presets, and calculations', async () => {
  const { setupMobileDropRetentionModal } = await import('../nav.js');

  let modalOpened = false;
  let modalClosed = false;

  const makeEl = (id) => ({
    id,
    value: '',
    textContent: '',
    className: '',
    dataset: {},
    innerHTML: '',
    style: {},
    appendChild: function(c) { this.children = this.children || []; this.children.push(c); },
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  });

  const mockDoc = {
    getElementById: (id) => makeEl(id),
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      innerHTML: '',
      style: {},
      appendChild: () => {}
    })
  };

  const origDoc = globalThis.document;
  globalThis.document = mockDoc;
  try {
    const controller = setupMobileDropRetentionModal({}, { storage: null, onToast: () => {} });
    assert.ok(controller);
    controller.open();
    assert.equal(modalOpened, true);
    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html, styles.css, nav.css, and app.js correctly integrate Drop Retention Assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreDropRetentionBtn"'));
  assert.ok(html.includes('id="mobileDropRetentionModal"'));
  assert.ok(html.includes('id="dropRetentionPresetSelect"'));
  assert.ok(html.includes('id="dropRetentionSvgContainer"'));

  const navCss = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(navCss.includes('.mobile-drop-retention-modal'));

  const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(stylesCss.includes('#dropRetentionSvgContainer'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileDropRetentionModal'));
  assert.ok(app.includes('mobileDropRetentionModalController'));
});

test('nav.js correctly re-exports Reference Jumpers assistant constants and functions', async () => {
  const nav = await import('../nav.js');
  assert.equal(typeof nav.REF_JUMPERS_STORAGE_KEY, 'string');
  assert.ok(nav.REFERENCING_METHODS.METHOD_A_1_JUMPER);
  assert.ok(nav.REFERENCING_METHODS.METHOD_B_2_JUMPER);
  assert.ok(nav.REFERENCING_METHODS.METHOD_C_3_JUMPER);
  assert.ok(nav.JUMPER_GRADES.SC_APC_REF);
  assert.ok(nav.JUMPER_GRADES.SC_UPC_REF);
  assert.ok(nav.JUMPER_GRADES.LC_APC_REF);
  assert.ok(nav.JUMPER_GRADES.STANDARD_PATCH_CORD);
  assert.ok(Array.isArray(nav.REF_JUMPERS_PRESETS));
  assert.equal(typeof nav.calculateReferenceJumpersMetrics, 'function');
  assert.equal(typeof nav.renderReferenceJumpersSvg, 'function');
  assert.equal(typeof nav.formatReferenceJumpersWhatsAppText, 'function');
  assert.equal(typeof nav.generateReferenceJumpersCsv, 'function');
  assert.equal(typeof nav.loadReferenceJumpersAuditLog, 'function');
  assert.equal(typeof nav.saveReferenceJumpersAuditLog, 'function');
  assert.equal(typeof nav.clearReferenceJumpersAuditLog, 'function');
  assert.equal(typeof nav.setupMobileRefJumpersModal, 'function');
});

test('calculateReferenceJumpersMetrics correctly calculates Method A, B, and C with TRC qualification', async () => {
  const { calculateReferenceJumpersMetrics } = await import('../nav-reference-jumpers.js');

  // 1. Method A: 1-Jumper with Grade-A TRC PASS
  const resA = calculateReferenceJumpersMetrics({
    method: 'METHOD_A_1_JUMPER',
    launchJumper: 'SC_APC_REF',
    tailJumper: 'SC_APC_REF',
    wavelengthNm: 1310,
    referencePowerDbm: -3.00,
    trcVerificationLossDb: 0.08,
    measuredLinkPowerDbm: -18.45
  });

  assert.equal(resA.calculatedLinkLossDb, 15.45);
  assert.equal(resA.trcVerificationLossDb, 0.08);
  assert.equal(resA.trcVerificationPass, true);
  assert.equal(resA.launchJumper.isReferenceGrade, true);
  assert.equal(resA.tailJumper.isReferenceGrade, true);
  assert.ok(resA.trcQualityRating.includes('Grade-A'));
  assert.equal(resA.measurementUncertaintyDb, 0.15);

  // 2. Method B: 2-Jumper
  const resB = calculateReferenceJumpersMetrics({
    method: 'METHOD_B_2_JUMPER',
    launchJumper: 'SC_UPC_REF',
    tailJumper: 'SC_APC_REF',
    wavelengthNm: 1550,
    referencePowerDbm: -4.50,
    trcVerificationLossDb: 0.12,
    measuredLinkPowerDbm: -16.20
  });

  assert.equal(resB.calculatedLinkLossDb, 11.70);
  assert.equal(resB.trcVerificationPass, true);

  // 3. Method C: 3-Jumper with standard commercial cord (TRC qualification fail)
  const resC = calculateReferenceJumpersMetrics({
    method: 'METHOD_C_3_JUMPER',
    launchJumper: 'STANDARD_PATCH_CORD',
    tailJumper: 'STANDARD_PATCH_CORD',
    wavelengthNm: 1550,
    referencePowerDbm: -5.00,
    trcVerificationLossDb: 0.35,
    measuredLinkPowerDbm: -20.00
  });

  assert.equal(resC.calculatedLinkLossDb, 15.00);
  assert.equal(resC.trcVerificationPass, false); // exceeds 0.20 dB limit
  assert.equal(resC.launchJumper.isReferenceGrade, false);
  assert.ok(resC.trcQualityRating.includes('REJECTED'));
});

test('renderReferenceJumpersSvg renders valid SVG markup with TRC jumpers and power levels', async () => {
  const { calculateReferenceJumpersMetrics, renderReferenceJumpersSvg } = await import('../nav-reference-jumpers.js');
  const metrics = calculateReferenceJumpersMetrics({
    method: 'METHOD_A_1_JUMPER',
    launchJumper: 'SC_APC_REF',
    tailJumper: 'SC_APC_REF',
    wavelengthNm: 1310,
    referencePowerDbm: -3.00,
    trcVerificationLossDb: 0.08,
    measuredLinkPowerDbm: -18.45
  });

  const svg = renderReferenceJumpersSvg(metrics, { isDark: true });
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('15.45 dB'));
  assert.ok(svg.includes('-3.00 dBm'));
  assert.ok(svg.includes('Launch TRC (Grade-A)'));
});

test('formatReferenceJumpersWhatsAppText and generateReferenceJumpersCsv generate correct reports', async () => {
  const { calculateReferenceJumpersMetrics, formatReferenceJumpersWhatsAppText, generateReferenceJumpersCsv } = await import('../nav-reference-jumpers.js');
  const metrics = calculateReferenceJumpersMetrics({
    method: 'METHOD_A_1_JUMPER',
    launchJumper: 'SC_APC_REF',
    tailJumper: 'SC_APC_REF',
    wavelengthNm: 1310,
    referencePowerDbm: -3.00,
    trcVerificationLossDb: 0.08,
    measuredLinkPowerDbm: -18.45
  });

  const record = {
    id: 'TRC-TEST-001',
    date: '2026-10-17 10:00:00',
    area: 'Shahdara Town',
    technician: 'Rashid Mahmood',
    notes: 'Reference calibration test',
    params: {},
    metrics
  };

  const whatsapp = formatReferenceJumpersWhatsAppText(record);
  assert.ok(whatsapp.includes('TRC-TEST-001'));
  assert.ok(whatsapp.includes('Shahdara Town'));
  assert.ok(whatsapp.includes('15.45 dB'));

  const csv = generateReferenceJumpersCsv([record]);
  assert.ok(csv.includes('TestId,Date,Area,Technician'));
  assert.ok(csv.includes('TRC-TEST-001'));
  assert.ok(csv.includes('15.45'));
});

test('loadReferenceJumpersAuditLog, saveReferenceJumpersAuditLog, and clearReferenceJumpersAuditLog work with storage', async () => {
  const { loadReferenceJumpersAuditLog, saveReferenceJumpersAuditLog, clearReferenceJumpersAuditLog, REF_JUMPERS_STORAGE_KEY } = await import('../nav-reference-jumpers.js');

  const store = {};
  const mockStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; }
  };

  assert.deepEqual(loadReferenceJumpersAuditLog(mockStorage), []);

  const sample = [{ id: 'TRC-1', area: 'Shahdara', metrics: { calculatedLinkLossDb: 10 } }];
  saveReferenceJumpersAuditLog(sample, mockStorage);
  assert.equal(loadReferenceJumpersAuditLog(mockStorage).length, 1);

  clearReferenceJumpersAuditLog(mockStorage);
  assert.deepEqual(loadReferenceJumpersAuditLog(mockStorage), []);
});

test('setupMobileRefJumpersModal handles open, close, and preset change events', async () => {
  const { setupMobileRefJumpersModal } = await import('../nav-reference-jumpers.js');

  let modalOpened = false;
  let modalClosed = false;

  const makeEl = (id) => ({
    id,
    value: '',
    textContent: '',
    className: '',
    dataset: {},
    innerHTML: '',
    style: {},
    appendChild: function(c) { this.children = this.children || []; this.children.push(c); },
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  });

  const mockDoc = {
    getElementById: (id) => makeEl(id),
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      innerHTML: '',
      style: {},
      appendChild: () => {}
    })
  };

  const origDoc = globalThis.document;
  globalThis.document = mockDoc;
  try {
    const controller = setupMobileRefJumpersModal({}, { storage: null, onToast: () => {} });
    assert.ok(controller);
    controller.open();
    assert.equal(modalOpened, true);
    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html, styles.css, nav.css, and app.js correctly integrate Reference Jumpers Assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreRefJumpersBtn"'));
  assert.ok(html.includes('id="mobileRefJumpersModal"'));
  assert.ok(html.includes('id="refJumpersPresetSelect"'));
  assert.ok(html.includes('id="refJumpersSvgContainer"'));

  const navCss = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(navCss.includes('.mobile-ref-jumpers-modal'));

  const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(stylesCss.includes('#refJumpersSvgContainer'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileRefJumpersModal'));
  assert.ok(app.includes('mobileRefJumpersModalController'));
});

test('nav.js correctly re-exports Ribbon Separator assistant constants and functions', async () => {
  const nav = await import('../nav.js');
  assert.equal(typeof nav.RIBBON_SEPARATOR_STORAGE_KEY, 'string');
  assert.equal(nav.RIBBON_COLOR_CODES.length, 12);
  assert.ok(nav.DE_RIBBON_METHODS.MECHANICAL_COMB);
  assert.ok(nav.DE_RIBBON_METHODS.THERMAL_STRIPPER);
  assert.ok(nav.DE_RIBBON_METHODS.SOLVENT_ASSISTED);
  assert.ok(Array.isArray(nav.RIBBON_PRESETS));
  assert.equal(typeof nav.calculateRibbonSeparatorMetrics, 'function');
  assert.equal(typeof nav.renderRibbonSeparatorSvg, 'function');
  assert.equal(typeof nav.loadRibbonSeparatorAuditLog, 'function');
  assert.equal(typeof nav.saveRibbonSeparatorAuditLog, 'function');
  assert.equal(typeof nav.clearRibbonSeparatorAuditLog, 'function');
  assert.equal(typeof nav.formatRibbonSeparatorWhatsAppText, 'function');
  assert.equal(typeof nav.generateRibbonSeparatorCsv, 'function');
  assert.equal(typeof nav.setupMobileRibbonSeparatorModal, 'function');
});

test('calculateRibbonSeparatorMetrics correctly evaluates mechanical comb, thermal stripper, and solvent methods', async () => {
  const { calculateRibbonSeparatorMetrics } = await import('../nav-ribbon-separator.js');

  // 1. Optimal mechanical separation
  const opt = calculateRibbonSeparatorMetrics({
    deRibbonMethod: 'MECHANICAL_COMB',
    ribbonNumber: 3,
    cableFiberCount: 144,
    peelLengthMm: 75,
    measuredPeelForceN: 1.8,
    matrixResidueUm: 12,
    targetCore: 'ALL_12_CORES'
  });

  assert.equal(opt.isOverallPass, true);
  assert.equal(opt.isForcePass, true);
  assert.equal(opt.isResiduePass, true);
  assert.equal(opt.integrityScore, 100);
  assert.equal(opt.verdict, 'OPTIMAL_SEPARATION');

  // 2. High peel force warning
  const highForce = calculateRibbonSeparatorMetrics({
    deRibbonMethod: 'THERMAL_STRIPPER',
    ribbonNumber: 1,
    cableFiberCount: 72,
    peelLengthMm: 40,
    measuredPeelForceN: 2.8, // exceeds 1.2 N limit
    matrixResidueUm: 6,
    targetCore: 'ALL_12_CORES'
  });

  assert.equal(highForce.isForcePass, false);
  assert.equal(highForce.isResiduePass, true);
  assert.equal(highForce.isOverallPass, false);
  assert.ok(highForce.integrityScore < 100);

  // 3. Single core selection
  const singleCore = calculateRibbonSeparatorMetrics({
    deRibbonMethod: 'SOLVENT_ASSISTED',
    ribbonNumber: 2,
    cableFiberCount: 24,
    targetCore: '5_SLATE'
  });
  assert.ok(singleCore.targetCoreLabel.includes('Slate'));
});

test('renderRibbonSeparatorSvg generates valid SVG markup with 12 colored fibers and separator comb', async () => {
  const { calculateRibbonSeparatorMetrics, renderRibbonSeparatorSvg } = await import('../nav-ribbon-separator.js');
  const metrics = calculateRibbonSeparatorMetrics();

  const svg = renderRibbonSeparatorSvg(metrics, { isDark: true });
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('SEPARATOR'));
  assert.ok(svg.includes('Intact 12-Fiber Ribbon'));
  assert.ok(svg.includes('#1 Blue'));
  assert.ok(svg.includes('#12 Aqua'));
});

test('formatRibbonSeparatorWhatsAppText and generateRibbonSeparatorCsv generate correct reports', async () => {
  const { calculateRibbonSeparatorMetrics, formatRibbonSeparatorWhatsAppText, generateRibbonSeparatorCsv } = await import('../nav-ribbon-separator.js');
  const metrics = calculateRibbonSeparatorMetrics({
    deRibbonMethod: 'MECHANICAL_COMB',
    ribbonNumber: 3,
    cableFiberCount: 144
  });

  const record = {
    id: 'RBN-TEST-001',
    date: '2026-10-17 10:00:00',
    area: 'Shahdara Feeder',
    technician: 'Rashid Mahmood',
    notes: 'Test notes',
    params: { fanOutKitType: '900um Spider Furcation Fan-out Kit' },
    metrics
  };

  const text = formatRibbonSeparatorWhatsAppText(record);
  assert.ok(text.includes('RBN-TEST-001'));
  assert.ok(text.includes('Shahdara Feeder'));
  assert.ok(text.includes('Ribbon #3'));

  const csv = generateRibbonSeparatorCsv([record]);
  assert.ok(csv.includes('TestId,Date,Area,Technician'));
  assert.ok(csv.includes('RBN-TEST-001'));
  assert.ok(csv.includes('144'));
});

test('loadRibbonSeparatorAuditLog, saveRibbonSeparatorAuditLog, and clearRibbonSeparatorAuditLog handle storage', async () => {
  const { loadRibbonSeparatorAuditLog, saveRibbonSeparatorAuditLog, clearRibbonSeparatorAuditLog } = await import('../nav-ribbon-separator.js');

  const store = {};
  const mockStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; }
  };

  assert.deepEqual(loadRibbonSeparatorAuditLog(mockStorage), []);
  saveRibbonSeparatorAuditLog([{ id: 'RBN-1', area: 'Shahdara', metrics: { integrityScore: 90 } }], mockStorage);
  assert.equal(loadRibbonSeparatorAuditLog(mockStorage).length, 1);

  clearRibbonSeparatorAuditLog(mockStorage);
  assert.deepEqual(loadRibbonSeparatorAuditLog(mockStorage), []);
});

test('setupMobileRibbonSeparatorModal handles open, close, and preset change events', async () => {
  const { setupMobileRibbonSeparatorModal } = await import('../nav-ribbon-separator.js');

  let modalOpened = false;
  let modalClosed = false;

  const makeEl = (id) => ({
    id,
    value: '',
    textContent: '',
    className: '',
    dataset: {},
    innerHTML: '',
    style: {},
    appendChild: function(c) { this.children = this.children || []; this.children.push(c); },
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  });

  const mockDoc = {
    getElementById: (id) => makeEl(id),
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      innerHTML: '',
      style: {},
      appendChild: () => {}
    })
  };

  const origDoc = globalThis.document;
  globalThis.document = mockDoc;
  try {
    const controller = setupMobileRibbonSeparatorModal({}, { storage: null, onToast: () => {} });
    assert.ok(controller);
    controller.open();
    assert.equal(modalOpened, true);
    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html, styles.css, nav.css, and app.js correctly integrate Ribbon Separator Assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreRibbonSeparatorBtn"'));
  assert.ok(html.includes('id="mobileRibbonSeparatorModal"'));
  assert.ok(html.includes('id="ribbonSeparatorPresetSelect"'));
  assert.ok(html.includes('id="ribbonSeparatorSvgContainer"'));

  const navCss = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(navCss.includes('.mobile-ribbon-separator-modal'));

  const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(stylesCss.includes('#ribbonSeparatorSvgContainer'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileRibbonSeparatorModal'));
  assert.ok(app.includes('mobileRibbonSeparatorModalController'));
});

test('nav.js correctly re-exports Mechanical Splice assistant constants and functions', async () => {
  const nav = await import('../nav.js');
  assert.equal(typeof nav.MECHANICAL_SPLICE_STORAGE_KEY, 'string');
  assert.ok(nav.SPLICE_ELEMENT_TYPES.FIBRLOK_UNIVERSAL_2529);
  assert.ok(nav.SPLICE_ELEMENT_TYPES.CAMSPLICE_CORNING);
  assert.ok(nav.SPLICE_ELEMENT_TYPES.MICRO_DROP_SPLICE);
  assert.ok(nav.GEL_STATES.OPTIMAL);
  assert.ok(nav.GEL_STATES.DRIED_AGED);
  assert.ok(nav.GEL_STATES.AIR_VOID_CONTAMINATED);
  assert.ok(Array.isArray(nav.MECHANICAL_SPLICE_PRESETS));
  assert.equal(typeof nav.calculateMechanicalSpliceMetrics, 'function');
  assert.equal(typeof nav.renderMechanicalSpliceSvg, 'function');
  assert.equal(typeof nav.loadMechanicalSpliceAuditLog, 'function');
  assert.equal(typeof nav.saveMechanicalSpliceAuditLog, 'function');
  assert.equal(typeof nav.clearMechanicalSpliceAuditLog, 'function');
  assert.equal(typeof nav.formatMechanicalSpliceWhatsAppText, 'function');
  assert.equal(typeof nav.generateMechanicalSpliceCsv, 'function');
  assert.equal(typeof nav.setupMobileMechanicalSpliceModal, 'function');
});

test('calculateMechanicalSpliceMetrics correctly computes insertion loss, return loss, and pull resistance', async () => {
  const { calculateMechanicalSpliceMetrics } = await import('../nav-mechanical-splice.js');

  // 1. Optimal Fibrlok splice
  const opt = calculateMechanicalSpliceMetrics({
    spliceType: 'FIBRLOK_UNIVERSAL_2529',
    gelState: 'OPTIMAL',
    fiber1CleaveAngleDeg: 0.6,
    fiber2CleaveAngleDeg: 0.8,
    buttGapMicrons: 4,
    tensilePullN: 8.5
  });

  assert.equal(opt.isOverallPass, true);
  assert.equal(opt.isLossPass, true);
  assert.equal(opt.isOrlPass, true);
  assert.equal(opt.isTensilePass, true);
  assert.ok(opt.calculatedLossDb <= 0.25);
  assert.ok(opt.orlDb >= 40);
  assert.ok(opt.qualityRating.includes('EXCELLENT'));

  // 2. Air void contaminated gel defect
  const voidSplice = calculateMechanicalSpliceMetrics({
    spliceType: 'FIBRLOK_UNIVERSAL_2529',
    gelState: 'AIR_VOID_CONTAMINATED',
    fiber1CleaveAngleDeg: 2.2,
    fiber2CleaveAngleDeg: 2.4,
    buttGapMicrons: 25,
    tensilePullN: 3.2
  });

  assert.equal(voidSplice.isLossPass, false);
  assert.equal(voidSplice.isTensilePass, false);
  assert.equal(voidSplice.isOverallPass, false);
  assert.ok(voidSplice.qualityRating.includes('FAIL'));
});

test('renderMechanicalSpliceSvg generates valid SVG schematic with V-groove and index gel', async () => {
  const { calculateMechanicalSpliceMetrics, renderMechanicalSpliceSvg } = await import('../nav-mechanical-splice.js');
  const metrics = calculateMechanicalSpliceMetrics();

  const svg = renderMechanicalSpliceSvg(metrics, { isDark: true });
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('INDEX MATCHING GEL'));
  assert.ok(svg.includes('Fiber 1 (250µm)'));
  assert.ok(svg.includes('Fiber 2 (250µm)'));
  assert.ok(svg.includes('Insertion Loss:'));
});

test('formatMechanicalSpliceWhatsAppText and generateMechanicalSpliceCsv generate valid dispatches', async () => {
  const { calculateMechanicalSpliceMetrics, formatMechanicalSpliceWhatsAppText, generateMechanicalSpliceCsv } = await import('../nav-mechanical-splice.js');
  const metrics = calculateMechanicalSpliceMetrics();

  const record = {
    id: 'MEC-TEST-001',
    date: '2026-10-17 10:00:00',
    area: 'Shahdara Town Feeder',
    technician: 'Rashid Mahmood',
    notes: 'Emergency restoration test',
    params: {},
    metrics
  };

  const text = formatMechanicalSpliceWhatsAppText(record);
  assert.ok(text.includes('MEC-TEST-001'));
  assert.ok(text.includes('Shahdara Town Feeder'));
  assert.ok(text.includes('Calculated Insertion Loss'));

  const csv = generateMechanicalSpliceCsv([record]);
  assert.ok(csv.includes('TestId,Date,Area,Technician'));
  assert.ok(csv.includes('MEC-TEST-001'));
});

test('loadMechanicalSpliceAuditLog, saveMechanicalSpliceAuditLog, and clearMechanicalSpliceAuditLog operate on storage', async () => {
  const { loadMechanicalSpliceAuditLog, saveMechanicalSpliceAuditLog, clearMechanicalSpliceAuditLog } = await import('../nav-mechanical-splice.js');

  const store = {};
  const mockStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; }
  };

  assert.deepEqual(loadMechanicalSpliceAuditLog(mockStorage), []);
  saveMechanicalSpliceAuditLog([{ id: 'MEC-1', area: 'Shahdara', metrics: { calculatedLossDb: 0.12 } }], mockStorage);
  assert.equal(loadMechanicalSpliceAuditLog(mockStorage).length, 1);

  clearMechanicalSpliceAuditLog(mockStorage);
  assert.deepEqual(loadMechanicalSpliceAuditLog(mockStorage), []);
});

test('setupMobileMechanicalSpliceModal handles open, close, and preset selection', async () => {
  const { setupMobileMechanicalSpliceModal } = await import('../nav-mechanical-splice.js');

  let modalOpened = false;
  let modalClosed = false;

  const makeEl = (id) => ({
    id,
    value: '',
    textContent: '',
    className: '',
    dataset: {},
    innerHTML: '',
    style: {},
    appendChild: function(c) { this.children = this.children || []; this.children.push(c); },
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  });

  const mockDoc = {
    getElementById: (id) => makeEl(id),
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      innerHTML: '',
      style: {},
      appendChild: () => {}
    })
  };

  const origDoc = globalThis.document;
  globalThis.document = mockDoc;
  try {
    const controller = setupMobileMechanicalSpliceModal({}, { storage: null, onToast: () => {} });
    assert.ok(controller);
    controller.open();
    assert.equal(modalOpened, true);
    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('index.html, styles.css, nav.css, and app.js correctly integrate Mechanical Splice Assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreMechanicalSpliceBtn"'));
  assert.ok(html.includes('id="mobileMechanicalSpliceModal"'));
  assert.ok(html.includes('id="mechanicalSplicePresetSelect"'));
  assert.ok(html.includes('id="mechanicalSpliceSvgContainer"'));

  const navCss = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(navCss.includes('.mobile-mechanical-splice-modal'));

  const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(stylesCss.includes('#mechanicalSpliceSvgContainer'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileMechanicalSpliceModal'));
  assert.ok(app.includes('mobileMechanicalSpliceModalController'));
});

// ==========================================
// Field Optical Fiber VIP Microscope Tests
// ==========================================
test('Fiber Microscope VIP: evaluates pristine connector as pass with zero penalty', async () => {
  const { evaluateConnectorSurface } = await import('../nav-fiber-microscope.js');
  const res = evaluateConnectorSurface({
    coreScratches: 0,
    coreDefects: 0,
    claddingScratches: 0,
    claddingDefects: 0,
    epoxyDefects: 0,
    contactDefects: 0
  });

  assert.equal(res.overallPassed, true);
  assert.equal(res.estimatedInsertionLossDb, 0.05);
  assert.equal(res.estimatedReturnLossDb, 65.0);
  assert.equal(res.zones.ZONE_A_CORE.passed, true);
  assert.equal(res.zones.ZONE_B_CLADDING.passed, true);
  assert.equal(res.zones.ZONE_C_EPOXY.passed, true);
  assert.equal(res.zones.ZONE_D_CONTACT.passed, true);
});

test('Fiber Microscope VIP: fails connector with core defects and calculates loss penalty', async () => {
  const { evaluateConnectorSurface } = await import('../nav-fiber-microscope.js');
  const res = evaluateConnectorSurface({
    coreScratches: 2,
    coreDefects: 1,
    claddingScratches: 1,
    claddingDefects: 2,
    epoxyDefects: 0,
    contactDefects: 0
  });

  assert.equal(res.overallPassed, false);
  assert.equal(res.zones.ZONE_A_CORE.passed, false);
  assert.ok(res.estimatedInsertionLossDb > 0.5);
  assert.ok(res.estimatedReturnLossDb < 50);
});

test('Fiber Microscope VIP: renders SVG, saves/loads records, and exports CSV and WhatsApp text', async () => {
  const {
    renderMicroscopeSvg,
    evaluateConnectorSurface,
    saveMicroscopeAuditRecord,
    loadMicroscopeAuditRecords,
    clearMicroscopeAuditRecords,
    exportMicroscopeCsv,
    formatMicroscopeWhatsAppText
  } = await import('../nav-fiber-microscope.js');

  const evalRes = evaluateConnectorSurface({ coreScratches: 0, coreDefects: 0, claddingScratches: 1, claddingDefects: 0 });
  const svg = renderMicroscopeSvg(evalRes);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('IEC 61300-3-35'));

  const mockStorage = new Map();
  const origLocal = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k)
  };

  try {
    const list = saveMicroscopeAuditRecord({
      location: 'FAT-04 Baradari Splitter 02',
      connectorType: 'SC/APC',
      isCorePassed: true,
      isCladdingPassed: true,
      isOverallPassed: true,
      verdictLabel: 'PASS',
      technicianName: 'Tariq Mehmood'
    });
    assert.equal(list.length, 1);
    const loaded = loadMicroscopeAuditRecords();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].location, 'FAT-04 Baradari Splitter 02');

    const csv = exportMicroscopeCsv(loaded);
    assert.ok(csv.includes('Timestamp'));
    assert.ok(csv.includes('FAT-04 Baradari Splitter 02'));

    const wa = formatMicroscopeWhatsAppText(loaded[0]);
    assert.ok(wa.includes('SHAHDARA ISP'));
    assert.ok(wa.includes('PASS'));

    clearMicroscopeAuditRecords();
    assert.equal(loadMicroscopeAuditRecords().length, 0);
  } finally {
    globalThis.localStorage = origLocal;
  }
});

// ==========================================
// Field VFL Red Laser & Core Resolver Tests
// ==========================================
test('VFL Tracer: resolves 12-color TIA-598-D core and buffer tube mapping', async () => {
  const { resolveFiberCoreFromNumber, resolveCoreNumberFromTubeAndFiber } = await import('../nav-vfl-tracer.js');
  
  const core1 = resolveFiberCoreFromNumber(1, 24);
  assert.equal(core1.fiberColor.name, 'Blue');
  assert.equal(core1.tubeColor.name, 'Blue');

  const core14 = resolveFiberCoreFromNumber(14, 24);
  assert.equal(core14.fiberColor.name, 'Orange');
  assert.equal(core14.tubeColor.name, 'Orange');

  const resolvedNum = resolveCoreNumberFromTubeAndFiber(2, 2, '24-core');
  assert.equal(resolvedNum, 14);
});

test('VFL Tracer: renders laser SVG and generates field report', async () => {
  const { renderMobileVflLaserSvg, generateVflFieldReport } = await import('../nav-vfl-tracer.js');
  const reading = {
    coreNumber: 5,
    tubeNumber: 1,
    fiberNumberInTube: 5,
    totalCores: 24,
    fiberColor: { name: 'Slate', hex: '#64748b', urduName: 'سلیٹی' },
    tubeColor: { name: 'Blue', hex: '#0284c7', urduName: 'نیلا' },
    laserMode: 'PULSE_2HZ',
    powerMw: 10,
    faultCondition: { id: 'CONTINUITY_OK', label: 'Continuous Core (Clean Red Glow)', color: '#10b981' },
    cabinetId: 'cab-sh-01',
    cabinetName: 'FAT-01 Baradari Chungi',
    linemanNotes: 'Testing drop core'
  };

  const svg = renderMobileVflLaserSvg(reading);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('650nm'));
  assert.ok(svg.includes('RED LASER'));

  const report = generateVflFieldReport(reading);
  assert.ok(report.includes('VFL LASER & CORE IDENTIFICATION REPORT'));
  assert.ok(report.includes('Slate'));
});

// ==========================================
// Optical Connector Cleaning Tests
// ==========================================
test('Connector Cleaning: recommends 1-click dry clean for airborne dust', async () => {
  const { evaluateCleaningProtocol } = await import('../nav-connector-cleaning.js');
  const res = evaluateCleaningProtocol({
    toolId: 'CLICK_PEN_25',
    contaminationId: 'DUST_AIRBORNE',
    ambientHumidityPercent: 45,
    clicksAttempted: 1
  });

  assert.equal(res.protocolName, '1-Click Dry Clean');
  assert.equal(res.recommendedSolvent, false);
  assert.ok(res.estimatedSuccessRatePercent >= 90);
  assert.equal(res.staticRiskLevel, 'LOW');
});

test('Connector Cleaning: recommends wet-to-dry solvent wipe for fingerprint oil and flags high static at low humidity', async () => {
  const { evaluateCleaningProtocol } = await import('../nav-connector-cleaning.js');
  const res = evaluateCleaningProtocol({
    toolId: 'WET_TO_DRY_WIPE',
    contaminationId: 'SKIN_OIL',
    ambientHumidityPercent: 20,
    clicksAttempted: 4
  });

  assert.ok(res.protocolName.includes('Wet-to-Dry'));
  assert.equal(res.recommendedSolvent, true);
  assert.ok(res.staticChargeKv >= 1.0);
});

test('Connector Cleaning: click lifetime tracking, SVG rendering, and audit persistence', async () => {
  const {
    evaluateCleaningProtocol,
    renderCleaningSvg,
    loadToolCounters,
    decrementToolCounter,
    resetToolCounter,
    saveCleaningRecord,
    loadCleaningRecords,
    clearCleaningRecords,
    exportCleaningCsv,
    formatCleaningWhatsAppText
  } = await import('../nav-connector-cleaning.js');

  const evalRes = evaluateCleaningProtocol({ toolId: 'CLICK_PEN_25', contaminationId: 'DUST_AIRBORNE', ambientHumidityPercent: 40, clicksAttempted: 1 });
  const svg = renderCleaningSvg(evalRes);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('GR-2923 / IEC 62627-01'));

  const mockStorage = new Map();
  const origLocal = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k)
  };

  try {
    const initial = decrementToolCounter('CLICK_PEN_25', 2);
    assert.equal(initial, 798);
    const resetVal = resetToolCounter('CLICK_PEN_25');
    assert.equal(resetVal, 800);

    const list = saveCleaningRecord({
      location: 'FAT-03 Baradari Port 06',
      connectorType: 'SC/APC',
      toolName: '2.5mm Push Click Pen',
      protocolName: '1-Click Dry Clean',
      estimatedSuccessRatePercent: 95
    });
    assert.equal(list.length, 1);
    const loaded = loadCleaningRecords();
    assert.equal(loaded[0].location, 'FAT-03 Baradari Port 06');

    const csv = exportCleaningCsv(loaded);
    assert.ok(csv.includes('Record ID'));
    assert.ok(csv.includes('FAT-03 Baradari Port 06'));

    const wa = formatCleaningWhatsAppText(loaded[0]);
    assert.ok(wa.includes('CONNECTOR SANITATION AUDIT'));

    clearCleaningRecords();
    assert.equal(loadCleaningRecords().length, 0);
  } finally {
    globalThis.localStorage = origLocal;
  }
});

// ==========================================
// Cross-File Full Integration Test
// ==========================================
test('index.html, styles.css, nav.css, and app.js correctly integrate Fiber VIP Microscope and Connector Cleaning Assistants', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreFiberMicroscopeBtn"'));
  assert.ok(html.includes('id="mobileFiberMicroscopeModal"'));
  assert.ok(html.includes('id="microscopeDiagramContainer"'));

  assert.ok(html.includes('id="mobileMoreVflTracerBtn"'));
  assert.ok(html.includes('id="mobileVflModal"'));

  assert.ok(html.includes('id="mobileMoreConnectorCleaningBtn"'));
  assert.ok(html.includes('id="mobileConnectorCleaningModal"'));
  assert.ok(html.includes('id="cleanDiagramContainer"'));

  const navCss = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(navCss.includes('.mobile-microscope-modal'));
  assert.ok(navCss.includes('.mobile-cleaning-modal'));

  const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(stylesCss.includes('#microscopeDiagramContainer'));
  assert.ok(stylesCss.includes('#cleanDiagramContainer'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileFiberMicroscopeModal'));
  assert.ok(app.includes('mobileFiberMicroscopeModalController'));
  assert.ok(app.includes('setupMobileConnectorCleaningModal'));
  assert.ok(app.includes('mobileConnectorCleaningModalController'));

  const nav = await import('../nav.js');
  assert.ok(typeof nav.evaluateConnectorSurface === 'function');
  assert.ok(typeof nav.evaluateCleaningProtocol === 'function');
  assert.ok(typeof nav.resolveFiberCoreFromNumber === 'function');
});

test('nav-otdr-deadzone constants and presets are complete and valid', async () => {
  const {
    OTDR_DEADZONE_STORAGE_KEY,
    PULSE_WIDTH_SPECS,
    DEADZONE_PRESETS
  } = await import('../nav-otdr-deadzone.js');

  assert.equal(OTDR_DEADZONE_STORAGE_KEY, 'shahdara_otdr_deadzone_audits_v1');
  assert.ok(PULSE_WIDTH_SPECS.PULSE_3NS);
  assert.ok(PULSE_WIDTH_SPECS.PULSE_100NS);
  assert.ok(PULSE_WIDTH_SPECS.PULSE_1US);

  assert.equal(PULSE_WIDTH_SPECS.PULSE_3NS.edzMeters, 0.8);
  assert.equal(PULSE_WIDTH_SPECS.PULSE_3NS.adzMeters, 2.8);
  assert.equal(PULSE_WIDTH_SPECS.PULSE_3NS.dynamicRangeDb, 14.5);

  assert.ok(Array.isArray(DEADZONE_PRESETS));
  assert.ok(DEADZONE_PRESETS.length >= 5);
  const dropPreset = DEADZONE_PRESETS.find(p => p.id === 'preset-ftth-drop');
  assert.ok(dropPreset);
  assert.equal(dropPreset.pulseId, 'PULSE_3NS');
  assert.equal(dropPreset.launchLengthMeters, 100);
});

test('calculateDeadZoneMetrics correctly assesses EDZ, ADZ, and launch fiber adequacy', async () => {
  const { calculateDeadZoneMetrics } = await import('../nav-otdr-deadzone.js');

  // 1. Direct trace without launch cable
  const noLaunch = calculateDeadZoneMetrics({
    pulseId: 'PULSE_3NS',
    fiberLengthMeters: 100,
    hasLaunchCable: false
  });

  assert.equal(noLaunch.pulseWidthNs, 3);
  assert.equal(noLaunch.edzMeters, 0.8);
  assert.equal(noLaunch.adzMeters, 2.8);
  assert.equal(noLaunch.launchAdequacyVerdict, 'NO_LAUNCH_CABLE');
  assert.equal(noLaunch.firstConnectorTestable, false);
  assert.equal(noLaunch.unmeasurableBlindZoneMeters, 2.8);

  // 2. Undersized launch cable (e.g. 10m launch cable for 100ns pulse where ADZ is 38m)
  const undersized = calculateDeadZoneMetrics({
    pulseId: 'PULSE_100NS',
    fiberLengthMeters: 1000,
    hasLaunchCable: true,
    launchLengthMeters: 10
  });

  assert.equal(undersized.edzMeters, 11.5);
  assert.equal(undersized.adzMeters, 38.0);
  assert.equal(undersized.launchAdequacyVerdict, 'UNDERSIZED');
  assert.equal(undersized.firstConnectorTestable, false);
  assert.equal(undersized.unmeasurableBlindZoneMeters, 28); // 38 - 10

  // 3. Adequate launch cable (e.g. 100m launch cable for 3ns pulse where ADZ is 2.8m)
  const adequate = calculateDeadZoneMetrics({
    pulseId: 'PULSE_3NS',
    fiberLengthMeters: 100,
    hasLaunchCable: true,
    launchLengthMeters: 100
  });

  assert.equal(adequate.launchAdequacyVerdict, 'ADEQUATE');
  assert.equal(adequate.firstConnectorTestable, true);
  assert.equal(adequate.unmeasurableBlindZoneMeters, 0);
  assert.ok(adequate.recommendation.includes('OPTIMAL'));
});

test('saveDeadZoneAudit, getSavedDeadZoneAudits, and clearDeadZoneAudits persist correctly', async () => {
  const {
    saveDeadZoneAudit,
    getSavedDeadZoneAudits,
    clearDeadZoneAudits
  } = await import('../nav-otdr-deadzone.js');

  clearDeadZoneAudits();
  assert.equal(getSavedDeadZoneAudits().length, 0);

  const audit1 = saveDeadZoneAudit({
    location: 'Shahdara Town Customer Drop',
    pulseWidthNs: 3,
    edzMeters: 0.8,
    adzMeters: 2.8,
    fiberLengthMeters: 75,
    launchLengthMeters: 100,
    hasLaunchCable: true,
    launchAdequacyVerdict: 'ADEQUATE',
    firstConnectorTestable: true
  });

  assert.ok(audit1.id);
  assert.ok(audit1.timestamp);
  const loaded = getSavedDeadZoneAudits();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].location, 'Shahdara Town Customer Drop');

  clearDeadZoneAudits();
  assert.equal(getSavedDeadZoneAudits().length, 0);
});

test('renderOtdrDeadzoneTraceSvg renders valid SVG markup in dark and light themes', async () => {
  const { calculateDeadZoneMetrics, renderOtdrDeadzoneTraceSvg } = await import('../nav-otdr-deadzone.js');

  const metrics = calculateDeadZoneMetrics({
    pulseId: 'PULSE_3NS',
    fiberLengthMeters: 120,
    hasLaunchCable: true,
    launchLengthMeters: 100
  });

  const darkSvg = renderOtdrDeadzoneTraceSvg(metrics, { isDark: true });
  assert.ok(darkSvg.includes('<svg class="otdr-deadzone-svg"'));
  assert.ok(darkSvg.includes('viewBox="0 0 720 300"'));
  assert.ok(darkSvg.includes('EDZ: 0.8m'));
  assert.ok(darkSvg.includes('ADZ: 2.8m'));
  assert.ok(darkSvg.includes('1st Connector (ODF/FAT): 100m'));

  const lightSvg = renderOtdrDeadzoneTraceSvg(metrics, { isDark: false });
  assert.ok(lightSvg.includes('#f8fafc')); // light gradient stop

  const emptySvg = renderOtdrDeadzoneTraceSvg(null);
  assert.ok(emptySvg.includes('No OTDR dead zone metrics available'));
});

test('generateDeadzoneWhatsAppReport formats comprehensive English and Urdu text', async () => {
  const { calculateDeadZoneMetrics, generateDeadzoneWhatsAppReport } = await import('../nav-otdr-deadzone.js');

  const metrics = calculateDeadZoneMetrics({
    pulseId: 'PULSE_30NS',
    fiberLengthMeters: 1500,
    hasLaunchCable: true,
    launchLengthMeters: 150
  });

  const report = generateDeadzoneWhatsAppReport(metrics, { location: 'Baradari Feeder' });
  assert.ok(report.includes('SHAHDARA ISP - OTDR DEAD ZONE & PULSE WIDTH AUDIT'));
  assert.ok(report.includes('Location:* Baradari Feeder'));
  assert.ok(report.includes('Pulse Width: *30 ns*'));
  assert.ok(report.includes('Event Dead Zone (EDZ): *3.5 m*'));
  assert.ok(report.includes('Attenuation Dead Zone (ADZ): *12 m*'));
  assert.ok(report.includes('URDU SUMMARY:'));
  assert.ok(report.includes('Launch cable ki lambai ADZ se zyada hai'));
});

test('index.html, styles.css, app.js, and nav.js contain all OTDR Dead Zone bindings', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreOtdrDeadzoneBtn"'));
  assert.ok(html.includes('id="mobileOtdrDeadzoneModal"'));
  assert.ok(html.includes('id="mobileOtdrDeadzoneModalCloseBtn"'));
  assert.ok(html.includes('id="otdrDzPresetSelect"'));
  assert.ok(html.includes('id="otdrDzPulseSelect"'));
  assert.ok(html.includes('id="otdrDzLengthRange"'));
  assert.ok(html.includes('id="otdrDzLaunchToggle"'));
  assert.ok(html.includes('id="otdrDzLaunchLengthSelect"'));
  assert.ok(html.includes('id="otdrDzWavelengthSelect"'));
  assert.ok(html.includes('id="otdrDzTailToggle"'));
  assert.ok(html.includes('id="otdrDzStatEdz"'));
  assert.ok(html.includes('id="otdrDzStatAdz"'));
  assert.ok(html.includes('id="otdrDzStatFirstConnector"'));
  assert.ok(html.includes('id="otdrDzStatDynamicRange"'));
  assert.ok(html.includes('id="otdrDzStatVerdictBadge"'));
  assert.ok(html.includes('id="mobileOtdrDeadzoneModalSvgContainer"'));
  assert.ok(html.includes('id="otdrDzSaveAuditBtn"'));
  assert.ok(html.includes('id="otdrDzWhatsappBtn"'));
  assert.ok(html.includes('id="otdrDzExportCsvBtn"'));

  const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(stylesCss.includes('.otdr-deadzone-svg'));
  assert.ok(stylesCss.includes('.otdr-dz-recommendation-box'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileOtdrDeadzoneModal'));
  assert.ok(app.includes('mobileOtdrDeadzoneModalController'));

  const nav = await import('../nav.js');
  assert.ok(typeof nav.calculateDeadZoneMetrics === 'function');
  assert.ok(typeof nav.renderOtdrDeadzoneTraceSvg === 'function');
  assert.ok(typeof nav.setupMobileOtdrDeadzoneModal === 'function');
});

test('Tube Shaving: parameter calculations for standard sizes and materials', async () => {
  const {
    calculateTubeShavingParameters,
    TUBE_SPECS,
    TUBE_MATERIALS
  } = await import('../nav-tube-shaving.js');

  assert.ok(TUBE_SPECS['2.0']);
  assert.strictEqual(TUBE_SPECS['2.0'].wallThickness, 0.35);

  const res20 = calculateTubeShavingParameters({
    tubeSize: '2.0',
    material: 'PBT',
    ambientTemp: 22,
    bladeCycles: 10,
    measuredMinor: 2.0,
    measuredMajor: 2.0
  });

  assert.strictEqual(res20.nominalDiameterMm, 2.0);
  assert.strictEqual(res20.wallThicknessMm, 0.35);
  assert.strictEqual(res20.ovalityPercent, 0);
  assert.strictEqual(res20.ovalityRisk, 'low');
  assert.strictEqual(res20.thermalRisk, 'low');
  assert.strictEqual(res20.bladeRisk, 'low');
  assert.ok(res20.maxBladeDepthMm > 0.25 && res20.maxBladeDepthMm < 0.35);
  assert.strictEqual(res20.bladePenetrationPercent, 80);

  const res28 = calculateTubeShavingParameters({
    tubeSize: '2.8',
    material: 'PBT',
    ambientTemp: 25,
    bladeCycles: 15,
    measuredMinor: 2.8,
    measuredMajor: 2.8
  });
  assert.strictEqual(res28.nominalDiameterMm, 2.8);
  assert.strictEqual(res28.wallThicknessMm, 0.45);
  assert.strictEqual(res28.fiberCount, 24);
  assert.ok(res28.maxBladeDepthMm > 0.30);
});

test('Tube Shaving: ovality detection and crushing margin risk', async () => {
  const { calculateTubeShavingParameters } = await import('../nav-tube-shaving.js');

  // Minor ovality (5%)
  const minorOval = calculateTubeShavingParameters({
    tubeSize: '2.0',
    measuredMinor: 1.95,
    measuredMajor: 2.05
  });
  assert.strictEqual(minorOval.ovalityPercent, 5.0);
  assert.strictEqual(minorOval.ovalityRating, 'Minor Ovality');
  assert.strictEqual(minorOval.ovalityRisk, 'medium');

  // Severe crushing / flattening (12%)
  const severeOval = calculateTubeShavingParameters({
    tubeSize: '2.0',
    measuredMinor: 1.86,
    measuredMajor: 2.10
  });
  assert.strictEqual(severeOval.ovalityPercent, 12.0);
  assert.strictEqual(severeOval.ovalityRisk, 'critical');
  assert.ok(severeOval.ovalityRecommendation.includes('High risk of blade pinching'));
  assert.ok(severeOval.riskScore >= 45);
});

test('Tube Shaving: thermal brittleness and blade wear degradation', async () => {
  const { calculateTubeShavingParameters } = await import('../nav-tube-shaving.js');

  // Freezing winter conditions (7°C for PBT)
  const coldTest = calculateTubeShavingParameters({
    tubeSize: '2.0',
    material: 'PBT',
    ambientTemp: 7,
    bladeCycles: 10
  });
  assert.strictEqual(coldTest.thermalRisk, 'critical');
  assert.ok(coldTest.thermalStatus.includes('Severely Brittle'));
  assert.ok(coldTest.thermalAlert.includes('Pre-warm tube'));
  assert.ok(coldTest.effectiveMarginMm > 0.07); // Extra margin penalty applied

  // Excessive blade wear (> 70 cuts)
  const dullBlade = calculateTubeShavingParameters({
    tubeSize: '2.0',
    bladeCycles: 85
  });
  assert.strictEqual(dullBlade.bladeRisk, 'critical');
  assert.ok(dullBlade.bladeStatus.includes('Dull / Worn Out'));
  assert.ok(dullBlade.riskScore >= 40);
});

test('Tube Shaving: SVG cross-section rendering and TIA-598-D colors', async () => {
  const { calculateTubeShavingParameters, renderTubeCrossSectionSvg } = await import('../nav-tube-shaving.js');

  const calc = calculateTubeShavingParameters({
    tubeSize: '2.0',
    fiberCount: 12,
    material: 'PBT'
  });

  const svg = renderTubeCrossSectionSvg(calc);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('id="tubeWallGrad"'));
  assert.ok(svg.includes('id="innerCoreGrad"'));
  assert.ok(svg.includes('Fiber #1 (Blue)'));
  assert.ok(svg.includes('Fiber #12 (Aqua)'));
  assert.ok(svg.includes('Parameters'));
  assert.ok(svg.includes('Dia: 2.0 mm'));
  assert.ok(svg.includes('Cut: 80%'));
});

test('Tube Shaving: history logging, summary metrics, and CSV export', async () => {
  const {
    saveTubeShavingRecord,
    getTubeShavingHistory,
    clearTubeShavingHistory,
    generateTubeShavingSummary,
    exportTubeShavingReportCsv
  } = await import('../nav-tube-shaving.js');

  clearTubeShavingHistory();
  assert.strictEqual(getTubeShavingHistory().length, 0);

  saveTubeShavingRecord({
    location: 'Kot Abdul Malik Splice Closure #4',
    tubeSize: '2.0',
    wallThicknessMm: 0.35,
    material: 'PBT',
    fiberCount: 12,
    maxBladeDepthMm: 0.28,
    effectiveMarginMm: 0.07,
    ovalityPercent: 2.5,
    riskScore: 20,
    overallRating: 'Low Risk',
    ambientTempC: 22,
    bladeCycles: 15,
    windowLengthCm: 60,
    technicianNote: 'Mid-span expressed loop bypass'
  });

  saveTubeShavingRecord({
    location: 'Shahdara Chowk ODF Main',
    tubeSize: '2.8',
    wallThicknessMm: 0.45,
    material: 'PBT',
    fiberCount: 24,
    maxBladeDepthMm: 0.37,
    effectiveMarginMm: 0.08,
    ovalityPercent: 8.5,
    riskScore: 65,
    overallRating: 'Elevated Risk',
    ambientTempC: 8,
    bladeCycles: 75,
    windowLengthCm: 80,
    technicianNote: 'Pre-warmed with heat pack'
  });

  const history = getTubeShavingHistory();
  assert.strictEqual(history.length, 2);

  const summary = generateTubeShavingSummary(history);
  assert.strictEqual(summary.totalShaves, 2);
  assert.strictEqual(summary.highRiskCount, 1);
  assert.strictEqual(summary.bladeWearAlerts, 1);

  const csv = exportTubeShavingReportCsv(history);
  assert.ok(csv.includes('Timestamp,Location,Tube Size (mm),Wall (mm)'));
  assert.ok(csv.includes('Kot Abdul Malik Splice Closure #4'));
  assert.ok(csv.includes('Shahdara Chowk ODF Main'));

  clearTubeShavingHistory();
  assert.strictEqual(getTubeShavingHistory().length, 0);
});

test('Tube Shaving: markup and integration presence in index.html, styles.css, app.js and nav.js', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileMoreTubeShavingBtn"'));
  assert.ok(html.includes('id="mobileTubeShavingModal"'));
  assert.ok(html.includes('id="closeMobileTubeShavingModalBtn"'));
  assert.ok(html.includes('id="shaveTubeSize"'));
  assert.ok(html.includes('id="shaveMaterial"'));
  assert.ok(html.includes('id="shaveFiberCount"'));
  assert.ok(html.includes('id="shaveMinorDia"'));
  assert.ok(html.includes('id="shaveMajorDia"'));
  assert.ok(html.includes('id="shaveAmbientTemp"'));
  assert.ok(html.includes('id="shaveBladeCycles"'));
  assert.ok(html.includes('id="shaveWindowLength"'));
  assert.ok(html.includes('id="shaveSvgContainer"'));
  assert.ok(html.includes('id="shaveOutMaxBladeDepth"'));
  assert.ok(html.includes('id="shaveOutMargin"'));
  assert.ok(html.includes('id="shaveOutCutPercent"'));
  assert.ok(html.includes('id="shaveOutOvality"'));
  assert.ok(html.includes('id="shaveOutThermal"'));
  assert.ok(html.includes('id="shaveOutBlade"'));
  assert.ok(html.includes('id="shaveOutRiskBadge"'));
  assert.ok(html.includes('id="shaveSaveRecordBtn"'));
  assert.ok(html.includes('id="shaveExportCsvBtn"'));
  assert.ok(html.includes('id="shaveClearHistoryBtn"'));

  const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(stylesCss.includes('#mobileTubeShavingModal'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupMobileTubeShavingModal'));

  const nav = await import('../nav.js');
  assert.ok(typeof nav.calculateTubeShavingParameters === 'function');
  assert.ok(typeof nav.renderTubeCrossSectionSvg === 'function');
  assert.ok(typeof nav.setupMobileTubeShavingModal === 'function');
});










/* -------------------------------------------------------------------------- */
/* 2-Tap Quick Collect Mobile Field Flow Test Suite (agent2 - shahdara-mobile-nav) */
/* -------------------------------------------------------------------------- */

test('Quick Collect: getPakistanLocalDate returns valid YYYY-MM-DD for Pakistan timezone', async () => {
  const { getPakistanLocalDate } = await import('../nav-quick-collect.js');

  const todayStr = getPakistanLocalDate();
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/);

  // UTC evening should be next day morning in Pakistan (+05:00)
  const utcEvening = new Date('2026-10-17T20:30:00Z');
  const pktDate = getPakistanLocalDate(utcEvening);
  assert.equal(pktDate, '2026-10-18');
});

test('Quick Collect: getPendingCollectionCustomers filters and sorts debtors correctly', async () => {
  const { getPendingCollectionCustomers } = await import('../nav-quick-collect.js');

  const mockState = {
    customers: [
      {
        id: 'cust-1',
        customerNumber: 101,
        name: 'Tariq Butt',
        phone: '03001234567',
        area: 'Baradari Road',
        mohalla: 'Street 4',
        address: 'House 12',
        serviceStatus: 'active',
        archived: false,
        bills: [
          {
            id: 'b-101-1',
            month: '2026-09',
            dueAmount: 3000,
            status: 'partial',
            payments: [
              { id: 'p-1', date: '2026-09-10', amount: 1000, method: 'Cash' }
            ]
          }
        ]
      },
      {
        id: 'cust-2',
        customerNumber: 102,
        name: 'Usman Ali',
        phone: '03219876543',
        area: 'Begum Kot',
        mohalla: 'Main Chowk',
        address: 'Shop 5',
        serviceStatus: 'active',
        archived: false,
        bills: [
          {
            id: 'b-102-1',
            month: '2026-09',
            dueAmount: 1500,
            status: 'pending',
            payments: []
          }
        ]
      },
      {
        id: 'cust-3',
        customerNumber: 103,
        name: 'Zahid Mehmood',
        phone: '03335551122',
        area: 'Jia Musa',
        mohalla: 'Near Masjid',
        address: 'House 9',
        serviceStatus: 'active',
        archived: false,
        bills: [
          {
            id: 'b-103-1',
            month: '2026-09',
            dueAmount: 2000,
            status: 'paid',
            payments: [
              { id: 'p-2', date: '2026-09-05', amount: 2000, method: 'JazzCash' }
            ]
          }
        ]
      },
      {
        id: 'cust-4',
        customerNumber: 104,
        name: 'Archived Customer',
        phone: '03450000000',
        area: 'Shahdara Town',
        serviceStatus: 'offline',
        archived: true,
        bills: [
          { id: 'b-104-1', month: '2026-09', dueAmount: 5000, status: 'pending', payments: [] }
        ]
      }
    ]
  };

  const refDate = new Date('2026-09-15T10:00:00Z');

  // 1. 'all-dues' filter
  const debtors = getPendingCollectionCustomers(mockState, '', 'all-dues', refDate);
  assert.equal(debtors.length, 2);
  // Largest dues first: Tariq (2000 due) then Usman (1500 due)
  assert.equal(debtors[0].name, 'Tariq Butt');
  assert.equal(debtors[0].totalDues, 2000);
  assert.equal(debtors[1].name, 'Usman Ali');
  assert.equal(debtors[1].totalDues, 1500);

  // 2. 'high-dues' filter (>= 2000)
  const highDebtors = getPendingCollectionCustomers(mockState, '', 'high-dues', refDate);
  assert.equal(highDebtors.length, 1);
  assert.equal(highDebtors[0].name, 'Tariq Butt');

  // 3. 'all' filter
  const allList = getPendingCollectionCustomers(mockState, '', 'all', refDate);
  assert.equal(allList.length, 3); // excludes archived
  assert.equal(allList[2].name, 'Zahid Mehmood');
  assert.equal(allList[2].totalDues, 0);

  // 4. Search query matching
  const searchByName = getPendingCollectionCustomers(mockState, 'usman', 'all', refDate);
  assert.equal(searchByName.length, 1);
  assert.equal(searchByName[0].name, 'Usman Ali');

  const searchByArea = getPendingCollectionCustomers(mockState, 'Begum Kot', 'all', refDate);
  assert.equal(searchByArea.length, 1);
  assert.equal(searchByArea[0].name, 'Usman Ali');

  const searchByNumber = getPendingCollectionCustomers(mockState, '#103', 'all', refDate);
  assert.equal(searchByNumber.length, 1);
  assert.equal(searchByNumber[0].name, 'Zahid Mehmood');
});

test('Quick Collect: getCustomerPaymentDefaults preselects balance, date, and last method', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');

  const mockState = {
    customers: [
      {
        id: 'cust-jazz',
        customerNumber: 201,
        name: 'Kamran Akmal',
        phone: '03017778899',
        area: 'Ravi Siphon Road',
        archived: false,
        monthlySellingAmount: 2500,
        bills: [
          {
            id: 'b-201-1',
            month: '2026-08',
            dueAmount: 2500,
            status: 'paid',
            payments: [
              { id: 'p-1', date: '2026-08-05', amount: 2500, method: 'EasyPaisa', paidBy: 'Self' }
            ]
          },
          {
            id: 'b-201-2',
            month: '2026-09',
            dueAmount: 2500,
            status: 'partial',
            payments: [
              { id: 'p-2', date: '2026-09-07', amount: 1000, method: 'JazzCash', paidBy: 'Shop Cashier' }
            ]
          }
        ]
      },
      {
        id: 'cust-archived',
        customerNumber: 202,
        name: 'Old User',
        archived: true,
        bills: []
      }
    ]
  };

  const refDate = new Date('2026-09-20T12:00:00Z');
  const defaults = getCustomerPaymentDefaults(mockState, 'cust-jazz', refDate);

  assert.equal(defaults.name, 'Kamran Akmal');
  assert.equal(defaults.customerNumber, 201);
  assert.equal(defaults.targetMonth, '2026-09');
  assert.equal(defaults.balanceDue, 1500); // 2500 - 1000
  assert.equal(defaults.suggestedAmount, 1500);
  assert.equal(defaults.defaultMethod, 'JazzCash'); // Last used method
  assert.equal(defaults.lastPaidBy, 'Shop Cashier');
  assert.equal(defaults.todayDate, '2026-09-20');

  // Archived customer throw check
  assert.throws(() => {
    getCustomerPaymentDefaults(mockState, 'cust-archived', refDate);
  }, /Archived customers cannot receive payments/);
});

test('Quick Collect: executeQuickCollection creates immutable payment and returns valid receipt', async () => {
  const { executeQuickCollection } = await import('../nav-quick-collect.js');

  const mockState = {
    customers: [
      {
        id: 'cust-exec',
        customerNumber: 301,
        name: 'Bilal Khan',
        phone: '03124443322',
        area: 'Chah Miran',
        archived: false,
        bills: [
          {
            id: 'b-301-1',
            month: '2026-09',
            dueAmount: 2000,
            status: 'pending',
            payments: []
          }
        ]
      }
    ]
  };

  const refDate = new Date('2026-09-12T08:00:00Z');

  // Step 1: Partial collection of PKR 800
  const step1 = executeQuickCollection(mockState, {
    customerId: 'cust-exec',
    month: '2026-09',
    amount: 800,
    date: '2026-09-12',
    method: 'Cash',
    paidBy: 'Brother'
  }, refDate);

  assert.equal(step1.receipt.success, true);
  assert.equal(step1.receipt.amount, 800);
  assert.equal(step1.receipt.newBalanceDue, 1200); // 2000 - 800
  assert.equal(step1.receipt.newTotalDues, 1200);
  assert.equal(step1.receipt.isSettled, false);
  assert.equal(step1.receipt.paidBy, 'Brother');
  assert.match(step1.receipt.receiptNumber, /^RCPT-301-202609-01$/);

  // Verify nextState has payment recorded
  const billAfterStep1 = step1.nextState.customers[0].bills[0];
  assert.equal(billAfterStep1.payments.length, 1);
  assert.equal(billAfterStep1.payments[0].amount, 800);

  // Step 2: Final settlement collection of PKR 1,200
  const step2 = executeQuickCollection(step1.nextState, {
    customerId: 'cust-exec',
    month: '2026-09',
    amount: 1200,
    date: '2026-09-12',
    method: 'JazzCash'
  }, refDate);

  assert.equal(step2.receipt.amount, 1200);
  assert.equal(step2.receipt.newBalanceDue, 0);
  assert.equal(step2.receipt.newTotalDues, 0);
  assert.equal(step2.receipt.isSettled, true);
  assert.match(step2.receipt.receiptNumber, /^RCPT-301-202609-02$/);

  // Validation checks: negative amount
  assert.throws(() => {
    executeQuickCollection(mockState, {
      customerId: 'cust-exec',
      month: '2026-09',
      amount: -500
    }, refDate);
  }, /greater than zero/);

  // Validation checks: invalid payment method
  assert.throws(() => {
    executeQuickCollection(mockState, {
      customerId: 'cust-exec',
      month: '2026-09',
      amount: 500,
      method: 'BitCoinCrypto'
    }, refDate);
  }, /valid payment method/);
});

test('Quick Collect: formatQuickCollectWhatsAppReceipt generates bilingual message and wa.me link', async () => {
  const { formatQuickCollectWhatsAppReceipt } = await import('../nav-quick-collect.js');

  const receipt = {
    receiptNumber: 'RCPT-505-202610-01',
    customerNumber: 505,
    customerName: 'Muhammad Salman',
    phone: '03009876543',
    area: 'Baradari Sector B',
    month: '2026-10',
    date: '2026-10-17',
    amount: 2500,
    method: 'Cash',
    paidBy: 'Self',
    newBalanceDue: 0,
    newTotalDues: 0
  };

  const { text, url } = formatQuickCollectWhatsAppReceipt(receipt);

  assert.ok(text.includes('SHAHDARA FIBER NETWORK'));
  assert.ok(text.includes('RCPT-505-202610-01'));
  assert.ok(text.includes('Muhammad Salman'));
  assert.ok(text.includes('2,500'));
  assert.ok(text.includes('مکمل ادا شدہ'));
  assert.ok(text.includes('PAID IN FULL'));

  assert.ok(url.startsWith('https://wa.me/923009876543'));
  assert.ok(url.includes(encodeURIComponent('RCPT-505-202610-01')));
});

test('Quick Collect: HTML renderers produce valid accessible markup', async () => {
  const { renderQuickCollectCustomerListHtml, renderQuickCollectReceiptCardHtml } = await import('../nav-quick-collect.js');

  const customers = [
    {
      id: 'cust-a',
      customerNumber: 42,
      name: 'Ahmed Raza',
      phone: '03001112233',
      area: 'Begum Kot',
      totalDues: 2400
    },
    {
      id: 'cust-b',
      customerNumber: 43,
      name: 'Hamza Tariq',
      phone: '03224445566',
      area: 'Jia Musa',
      totalDues: 0
    }
  ];

  const html = renderQuickCollectCustomerListHtml(customers, 'cust-a');
  assert.ok(html.includes('data-customer-id="cust-a"'));
  assert.ok(html.includes('#42'));
  assert.ok(html.includes('Ahmed Raza'));
  assert.ok(html.includes('2,400'));
  assert.ok(html.includes('is-selected'));
  assert.ok(html.includes('SETTLED'));

  const emptyHtml = renderQuickCollectCustomerListHtml([]);
  assert.ok(emptyHtml.includes('No matching accounts found'));

  const receiptCardHtml = renderQuickCollectReceiptCardHtml({
    receiptNumber: 'RCPT-42-202610-01',
    customerName: 'Ahmed Raza',
    customerNumber: 42,
    amount: 2400,
    date: '2026-10-17',
    method: 'Cash',
    area: 'Begum Kot',
    newTotalDues: 0,
    paidBy: 'Self'
  });

  assert.ok(receiptCardHtml.includes('RCPT-42-202610-01'));
  assert.ok(receiptCardHtml.includes('Ahmed Raza'));
  assert.ok(receiptCardHtml.includes('2,400'));
  assert.ok(receiptCardHtml.includes('Settle in Full'));
});

test('Quick Collect: DOM integration and markup in index.html, styles.css, app.js, owner-ui.js, and nav.js', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="quickCollectModal"'));
  assert.ok(html.includes('id="closeQuickCollectModalBtn"'));
  assert.ok(html.includes('id="quickCollectSearchInput"'));
  assert.ok(html.includes('id="quickCollectCustomerList"'));
  assert.ok(html.includes('id="quickCollectStepPick"'));
  assert.ok(html.includes('id="quickCollectStepForm"'));
  assert.ok(html.includes('id="quickCollectPaymentForm"'));
  assert.ok(html.includes('id="quickCollectAmountInput"'));
  assert.ok(html.includes('id="quickCollectDateInput"'));
  assert.ok(html.includes('id="quickCollectMethodSelect"'));
  assert.ok(html.includes('id="quickCollectConfirmBtn"'));
  assert.ok(html.includes('id="quickCollectStepSuccess"'));
  assert.ok(html.includes('id="quickCollectReceiptCard"'));
  assert.ok(html.includes('id="quickCollectWhatsAppBtn"'));

  const styles = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(styles.includes('#quickCollectModal'));
  assert.ok(styles.includes('.qc-customer-card'));
  assert.ok(styles.includes('[data-theme="dark"] #quickCollectModal'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupQuickCollectModal'));
  assert.ok(app.includes('window.quickCollectModalController'));

  const ownerUi = fs.readFileSync(path.resolve('./owner-ui.js'), 'utf-8');
  assert.ok(ownerUi.includes('quickCollectModalController'));

  const nav = await import('../nav.js');
  assert.ok(typeof nav.getPendingCollectionCustomers === 'function');
  assert.ok(typeof nav.getCustomerPaymentDefaults === 'function');
  assert.ok(typeof nav.executeQuickCollection === 'function');
  assert.ok(typeof nav.formatQuickCollectWhatsAppReceipt === 'function');
  assert.ok(typeof nav.setupQuickCollectModal === 'function');
});

/* -------------------------------------------------------------------------- */
/* Fast Customer Search Sheet & Recent Accounts Test Suite (agent2)           */
/* -------------------------------------------------------------------------- */

test('Fast Customer Search: recordRecentCustomer, getRecentCustomers, and clearRecentCustomers manage cache', async () => {
  const { recordRecentCustomer, getRecentCustomers, clearRecentCustomers, RECENT_CUSTOMERS_STORAGE_KEY } = await import('../nav-customer-search.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const mockState = {
    customers: [
      { id: 'c-1', customerNumber: 10, name: 'Nasir Jamshed', phone: '03001234567', area: 'Baradari', archived: false },
      { id: 'c-2', customerNumber: 11, name: 'Imran Nazir', phone: '03217654321', area: 'Begum Kot', archived: false },
      { id: 'c-arch', customerNumber: 12, name: 'Old Account', phone: '03330000000', area: 'Jia Musa', archived: true }
    ]
  };

  // 1. Record customer 1
  recordRecentCustomer(mockState.customers[0], mockStorage);
  let recents = getRecentCustomers(mockState, mockStorage);
  assert.equal(recents.length, 1);
  assert.equal(recents[0].name, 'Nasir Jamshed');

  // 2. Record customer 2
  recordRecentCustomer(mockState.customers[1], mockStorage);
  recents = getRecentCustomers(mockState, mockStorage);
  assert.equal(recents.length, 2);
  assert.equal(recents[0].name, 'Imran Nazir'); // Newest first
  assert.equal(recents[1].name, 'Nasir Jamshed');

  // 3. Re-record customer 1 (should move to front, no duplicate)
  recordRecentCustomer(mockState.customers[0], mockStorage);
  recents = getRecentCustomers(mockState, mockStorage);
  assert.equal(recents.length, 2);
  assert.equal(recents[0].name, 'Nasir Jamshed');
  assert.equal(recents[1].name, 'Imran Nazir');

  // 4. Record archived customer (should not be returned in getRecentCustomers)
  recordRecentCustomer(mockState.customers[2], mockStorage);
  recents = getRecentCustomers(mockState, mockStorage);
  assert.equal(recents.length, 2); // archived filtered out

  // 5. Clear recent cache
  clearRecentCustomers(mockStorage);
  recents = getRecentCustomers(mockState, mockStorage);
  assert.equal(recents.length, 0);
});

test('Fast Customer Search: searchFastCustomers filters by status chip and matches queries', async () => {
  const { searchFastCustomers } = await import('../nav-customer-search.js');

  const mockState = {
    customers: [
      {
        id: 'cust-pending',
        customerNumber: 50,
        name: 'Shoaib Akhtar',
        phone: '03009998877',
        area: 'Ravi Siphon',
        mohalla: 'Bridge End',
        archived: false,
        bills: [
          { month: '2026-10', dueAmount: 3000, payments: [] }
        ]
      },
      {
        id: 'cust-partial',
        customerNumber: 51,
        name: 'Wasim Akram',
        phone: '03215554433',
        area: 'Baradari Sector A',
        mohalla: 'Lane 2',
        archived: false,
        bills: [
          { month: '2026-10', dueAmount: 2500, payments: [{ id: 'p-1', amount: 1000, date: '2026-10-05', method: 'Cash' }] }
        ]
      },
      {
        id: 'cust-paid',
        customerNumber: 52,
        name: 'Waqar Younis',
        phone: '03331112233',
        area: 'Shahdara Town',
        mohalla: 'Main Road',
        archived: false,
        bills: [
          { month: '2026-10', dueAmount: 2000, payments: [{ id: 'p-2', amount: 2000, date: '2026-10-02', method: 'JazzCash' }] }
        ]
      }
    ]
  };

  const refDate = new Date('2026-10-15T10:00:00Z');

  // 1. Status Filter: 'pending'
  const pendingResults = searchFastCustomers(mockState, { statusFilter: 'pending' }, refDate);
  assert.equal(pendingResults.length, 1);
  assert.equal(pendingResults[0].name, 'Shoaib Akhtar');
  assert.equal(pendingResults[0].totalDues, 3000);

  // 2. Status Filter: 'partial'
  const partialResults = searchFastCustomers(mockState, { statusFilter: 'partial' }, refDate);
  assert.equal(partialResults.length, 1);
  assert.equal(partialResults[0].name, 'Wasim Akram');
  assert.equal(partialResults[0].totalDues, 1500);

  // 3. Status Filter: 'paid'
  const paidResults = searchFastCustomers(mockState, { statusFilter: 'paid' }, refDate);
  assert.equal(paidResults.length, 1);
  assert.equal(paidResults[0].name, 'Waqar Younis');
  assert.equal(paidResults[0].totalDues, 0);

  // 4. Query search by name
  const nameSearch = searchFastCustomers(mockState, { query: 'wasim' }, refDate);
  assert.equal(nameSearch.length, 1);
  assert.equal(nameSearch[0].name, 'Wasim Akram');

  // 5. Query search by phone
  const phoneSearch = searchFastCustomers(mockState, { query: '9998877' }, refDate);
  assert.equal(phoneSearch.length, 1);
  assert.equal(phoneSearch[0].name, 'Shoaib Akhtar');

  // 6. Query search by customer number #52
  const numSearch = searchFastCustomers(mockState, { query: '#52' }, refDate);
  assert.equal(numSearch.length, 1);
  assert.equal(numSearch[0].name, 'Waqar Younis');
});

test('Fast Customer Search: renderFastCustomerSearchResultsHtml produces accessible cards with action buttons', async () => {
  const { renderFastCustomerSearchResultsHtml } = await import('../nav-customer-search.js');

  const customers = [
    {
      id: 'cust-test',
      customerNumber: 77,
      name: 'Sample Engineer',
      phone: '03005556677',
      area: 'Begum Kot Main',
      billingStatus: 'pending',
      totalDues: 2000
    }
  ];

  const html = renderFastCustomerSearchResultsHtml(customers);
  assert.ok(html.includes('#77'));
  assert.ok(html.includes('Sample Engineer'));
  assert.ok(html.includes('03005556677'));
  assert.ok(html.includes('Begum Kot Main'));
  assert.ok(html.includes('2,000'));
  assert.ok(html.includes('PENDING'));
  assert.ok(html.includes('data-fcs-action="collect"'));
  assert.ok(html.includes('data-fcs-action="profile"'));
  assert.ok(html.includes('data-fcs-action="whatsapp"'));

  const emptyHtml = renderFastCustomerSearchResultsHtml([], { isRecent: true });
  assert.ok(emptyHtml.includes('No recent customers'));
});

test('Fast Customer Search: DOM integration and markup in index.html, styles.css, app.js, and nav.js', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileCustomerSearchModal"'));
  assert.ok(html.includes('id="closeMobileCustomerSearchModalBtn"'));
  assert.ok(html.includes('id="fastCustomerSearchInput"'));
  assert.ok(html.includes('id="fastCustomerSearchResults"'));
  assert.ok(html.includes('id="fastCustomerSearchCountBadge"'));
  assert.ok(html.includes('id="mobileCustomerSearchTrigger"'));

  const styles = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(styles.includes('#mobileCustomerSearchModal'));
  assert.ok(styles.includes('.fcs-card'));
  assert.ok(styles.includes('[data-theme="dark"] #mobileCustomerSearchModal'));

  const app = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(app.includes('setupFastCustomerSearchModal'));
  assert.ok(app.includes('window.fastCustomerSearchController'));

  const nav = await import('../nav.js');
  assert.ok(typeof nav.recordRecentCustomer === 'function');
  assert.ok(typeof nav.getRecentCustomers === 'function');
  assert.ok(typeof nav.clearRecentCustomers === 'function');
  assert.ok(typeof nav.searchFastCustomers === 'function');
  assert.ok(typeof nav.renderFastCustomerSearchResultsHtml === 'function');
  assert.ok(typeof nav.setupFastCustomerSearchModal === 'function');
});

test('Mobile Customer Quick Profile & WhatsApp Receipt Delivery Suite: state, actions, badges, and DOM integration', async () => {
  const {
    RECEIPT_SHARED_STORAGE_KEY,
    markReceiptShared,
    isReceiptShared,
    getSharedReceipts,
    clearSharedReceipts,
    formatPakistaniPhone,
    executeReceiptWhatsAppShare,
    calculateCustomerQuickProfile,
    renderReceiptSharedBadgeHtml,
    renderQuickProfileCardHtml,
    setupMobileQuickProfileModal
  } = await import('../nav-quick-profile.js');

  const { createInitialState, addCustomer, addPayment, saveBillMonth } = await import('../core.js');

  const mockStorage = {
    store: {},
    getItem(k) { return this.store[k] ?? null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  };

  // 1. Phone Formatter
  assert.equal(formatPakistaniPhone('03001234567'), '0300-1234567');
  assert.equal(formatPakistaniPhone('923001234567'), '0300-1234567');
  assert.equal(formatPakistaniPhone('3001234567'), '0300-1234567');
  assert.equal(formatPakistaniPhone(''), 'No phone saved');

  // 2. Receipt Shared Storage API
  clearSharedReceipts(mockStorage);
  assert.deepEqual(getSharedReceipts(mockStorage), {});
  assert.equal(isReceiptShared('rec-101', mockStorage), null);

  const savedRecord = markReceiptShared('rec-101', {
    method: 'whatsapp',
    phone: '03001234567',
    customerId: 'cust-1',
    customerNumber: 10,
    amount: 2000
  }, mockStorage);

  assert.equal(savedRecord.shared, true);
  assert.equal(savedRecord.method, 'whatsapp');
  assert.equal(savedRecord.recipientPhone, '03001234567');

  const retrieved = isReceiptShared('rec-101', mockStorage);
  assert.ok(retrieved);
  assert.equal(retrieved.shared, true);
  assert.equal(retrieved.method, 'whatsapp');

  // 3. Receipt Shared Badge Generator
  const sharedBadge = renderReceiptSharedBadgeHtml(true, retrieved);
  assert.ok(sharedBadge.includes('badge-receipt-shared'));
  assert.ok(sharedBadge.includes('WhatsApp Sent'));

  const unsharedBadge = renderReceiptSharedBadgeHtml(false);
  assert.ok(unsharedBadge.includes('badge-receipt-unshared'));
  assert.ok(unsharedBadge.includes('WhatsApp Pending'));

  // 4. executeReceiptWhatsAppShare with mock clipboard and window
  let openedUrl = null;
  const mockWindow = {
    open(u) { openedUrl = u; }
  };
  let clipboardText = null;
  const mockClipboard = {
    async writeText(t) { clipboardText = t; }
  };

  const sampleCustomer = {
    id: 'cust-1',
    customerNumber: 15,
    name: 'Haris Rauf',
    phone: '03001234567',
    area: 'Jia Musa',
    bills: []
  };

  const sampleReceipt = {
    id: 'pay-202',
    customerId: 'cust-1',
    customerNumber: 15,
    customerName: 'Haris Rauf',
    amount: 1500,
    date: '2026-10-10',
    method: 'Cash',
    month: '2026-10',
    billAmount: 2000,
    balanceDueCents: 50000,
    billStatus: 'partial'
  };

  // Valid WhatsApp share
  const waResult = await executeReceiptWhatsAppShare(sampleCustomer, sampleReceipt, {
    storage: mockStorage,
    windowObj: mockWindow,
    clipboardObj: mockClipboard
  });
  assert.equal(waResult.success, true);
  assert.equal(waResult.method, 'whatsapp');
  assert.ok(waResult.url.includes('wa.me/923001234567'));
  assert.ok(openedUrl.includes('wa.me/923001234567'));
  assert.equal(isReceiptShared('pay-202', mockStorage)?.shared, true);

  // Fallback clipboard share when customer has no phone
  const noPhoneCustomer = { ...sampleCustomer, phone: '' };
  const clipResult = await executeReceiptWhatsAppShare(noPhoneCustomer, { ...sampleReceipt, id: 'pay-303' }, {
    storage: mockStorage,
    windowObj: mockWindow,
    clipboardObj: mockClipboard
  });
  assert.equal(clipResult.success, true);
  assert.equal(clipResult.method, 'clipboard');
  assert.equal(clipResult.wasCopied, true);
  assert.ok(clipboardText.includes('SHAHDARA ISP'));
  assert.equal(isReceiptShared('pay-303', mockStorage)?.method, 'clipboard');

  // 5. Customer Quick Profile Calculation
  const refDate = new Date('2026-10-17T12:00:00+05:00');
  let state = createInitialState([]);
  state = addCustomer(state, 'Naseem Shah', refDate, {
    monthlySellingAmount: 2500,
    phone: '03009876543',
    zone: 'Ravi Siphon Road',
    mohalla: 'Street 4'
  });
  state.customers[0].area = 'Ravi Siphon Road';
  const customer = state.customers[0];

  // Create bill and record a partial payment
  state = saveBillMonth(state, customer.id, { month: '2026-10', dueAmount: '2500', status: 'pending' }, refDate);
  state = addPayment(state, customer.id, '2026-10', {
    amount: 1000,
    date: '2026-10-06',
    method: 'JazzCash',
    paidBy: 'Brother'
  }, refDate);

  const profile = calculateCustomerQuickProfile(state.customers[0], state, {
    referenceDate: refDate,
    storage: mockStorage
  });

  assert.equal(profile.name, 'Naseem Shah');
  assert.equal(profile.customerNumber, 1);
  assert.equal(profile.formattedPhone, '0300-9876543');
  assert.equal(profile.area, 'Ravi Siphon Road');
  assert.equal(profile.mohalla, 'Street 4');
  assert.equal(profile.totalOutstandingPkr, 1500); // 2500 - 1000
  assert.equal(profile.currentMonthStatus, 'PARTIAL');
  assert.ok(profile.lastPayment);
  assert.equal(profile.lastPayment.amount, 1000);
  assert.equal(profile.lastPayment.method, 'JazzCash');
  assert.equal(profile.lastPayment.paidBy, 'Brother');
  assert.equal(profile.lastPayment.isShared, false);
  assert.ok(profile.whatsappReminderUrl);

  // Mark last payment as shared and re-verify profile
  markReceiptShared(profile.lastPayment.id, { method: 'whatsapp' }, mockStorage);
  const updatedProfile = calculateCustomerQuickProfile(state.customers[0], state, {
    referenceDate: refDate,
    storage: mockStorage
  });
  assert.equal(updatedProfile.lastPayment.isShared, true);

  // 6. Quick Profile Card HTML Generator
  const cardHtml = renderQuickProfileCardHtml(updatedProfile);
  assert.ok(cardHtml.includes('#1'));
  assert.ok(cardHtml.includes('Naseem Shah'));
  assert.ok(cardHtml.includes('Ravi Siphon Road'));
  assert.ok(cardHtml.includes('1,500'));
  assert.ok(cardHtml.includes('PARTIAL'));
  assert.ok(cardHtml.includes('data-mqp-action="collect"'));
  assert.ok(cardHtml.includes('data-mqp-action="whatsapp"'));
  assert.ok(cardHtml.includes('data-mqp-action="call"'));
  assert.ok(cardHtml.includes('data-mqp-action="profile"'));
  assert.ok(cardHtml.includes('badge-receipt-shared'));

  // 7. Markup and Bindings Verification
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="mobileQuickProfileModal"'));
  assert.ok(html.includes('id="mobileQuickProfileCloseBtn"'));
  assert.ok(html.includes('id="mobileQuickProfileBody"'));

  const styles = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(styles.includes('.mobile-quick-profile-modal'));
  assert.ok(styles.includes('.mqp-card'));
  assert.ok(styles.includes('.mqp-balance-hero'));
  assert.ok(styles.includes('.mqp-actions-grid'));
  assert.ok(styles.includes('.badge-receipt-shared'));
  assert.ok(styles.includes('.badge-receipt-unshared'));
  assert.ok(styles.includes('[data-theme="dark"] .mobile-quick-profile-modal'));

  const appCode = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(appCode.includes('setupMobileQuickProfileModal'));
  assert.ok(appCode.includes('window.mobileQuickProfileController'));

  const nav = await import('../nav.js');
  assert.ok(typeof nav.markReceiptShared === 'function');
  assert.ok(typeof nav.isReceiptShared === 'function');
  assert.ok(typeof nav.getSharedReceipts === 'function');
  assert.ok(typeof nav.clearSharedReceipts === 'function');
  assert.ok(typeof nav.formatPakistaniPhone === 'function');
  assert.ok(typeof nav.executeReceiptWhatsAppShare === 'function');
  assert.ok(typeof nav.calculateCustomerQuickProfile === 'function');
  assert.ok(typeof nav.renderReceiptSharedBadgeHtml === 'function');
  assert.ok(typeof nav.renderQuickProfileCardHtml === 'function');
  assert.ok(typeof nav.setupMobileQuickProfileModal === 'function');
});

test('Mobile Field Collection Rounds, Door-to-Door Dues Recovery & Dispatch Suite (agent2 - shahdara-mobile-nav)', async () => {
  const {
    FIELD_ROUTE_PROGRESS_KEY,
    FIELD_ROUTE_NOTES_KEY,
    getTodayDateString,
    getFieldRouteProgress,
    markRouteStopCollected,
    clearFieldRouteProgress,
    getFieldRouteNotes,
    saveFieldRouteNote,
    calculateFieldCollectionRoutes,
    generateFieldRouteManifestText,
    generateFieldRouteSlipHtml,
    setupFieldRouteSheet
  } = await import('../nav.js');

  const fs = await import('node:fs');
  const path = await import('node:path');

  // 1. Storage and Date Utilities
  const memoryStore = new Map();
  const mockStorage = {
    getItem: (k) => memoryStore.get(k) || null,
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k)
  };

  const today = getTodayDateString();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);

  // 2. Sample ISP State with Multi-Area/Mohalla Outstanding Dues
  const sampleState = {
    customers: [
      {
        id: 'cust-saeed-1',
        customerNumber: 101,
        name: 'Malik Arshad',
        username: 'malikarshad',
        phone: '03001112233',
        address: 'House 45, Street 2',
        area: 'Saeed Park',
        mohalla: 'Main Bazaar',
        status: 'active',
        bills: [
          { month: '2026-09', dueAmount: 2500, status: 'unpaid' },
          { month: '2026-10', dueAmount: 2500, status: 'unpaid' }
        ]
      },
      {
        id: 'cust-saeed-2',
        customerNumber: 102,
        name: 'Sheikh Waqas',
        username: 'swaqas',
        phone: '03214445566',
        address: 'Plot 12, Block A',
        area: 'Saeed Park',
        mohalla: 'Gulshan Colony',
        status: 'offline',
        bills: [
          { month: '2026-10', dueAmount: 3500, status: 'unpaid' }
        ]
      },
      {
        id: 'cust-wandala-1',
        customerNumber: 201,
        name: 'Chaudhry Nadeem',
        username: 'nadeemc',
        phone: '', // No phone on file
        address: 'Railway Crossing Corner',
        area: 'Wandala Road',
        mohalla: 'Railway Gate',
        status: 'suspended',
        bills: [
          { month: '2026-08', dueAmount: 4000, status: 'unpaid' }
        ]
      },
      {
        id: 'cust-settled',
        customerNumber: 301,
        name: 'Zahid Mehmood',
        username: 'zahidm',
        phone: '03457778899',
        area: 'Saeed Park',
        mohalla: 'Main Bazaar',
        status: 'active',
        bills: [
          { month: '2026-10', dueAmount: 0, status: 'paid' }
        ]
      },
      {
        id: 'cust-archived',
        name: 'Old Subscriber',
        archived: true,
        bills: [{ dueAmount: 5000, status: 'unpaid' }]
      }
    ]
  };

  // 3. Comprehensive Route Calculation & Sorting
  // Default sorting by priority
  const priorityRoute = calculateFieldCollectionRoutes(sampleState, {
    storage: mockStorage,
    dateStr: '2026-10-17'
  });

  assert.equal(priorityRoute.totalStops, 3);
  assert.equal(priorityRoute.totalDue, 12500); // 5000 + 3500 + 4000
  assert.equal(priorityRoute.collectedStops, 0);
  assert.equal(priorityRoute.collectedAmount, 0);
  assert.equal(priorityRoute.pendingStops, 3);
  assert.equal(priorityRoute.pendingAmount, 12500);
  assert.equal(priorityRoute.completionRate, 0);
  assert.equal(priorityRoute.roundStatus, 'NOT_STARTED');

  // Verify Areas & Sectors breakdowns
  assert.ok(priorityRoute.allSectors.includes('All'));
  assert.ok(priorityRoute.allSectors.includes('Saeed Park - Main Bazaar'));
  assert.ok(priorityRoute.allSectors.includes('Saeed Park - Gulshan Colony'));
  assert.ok(priorityRoute.allSectors.includes('Wandala Road - Railway Gate'));

  assert.ok(priorityRoute.allAreas.includes('All'));
  assert.ok(priorityRoute.allAreas.includes('Saeed Park'));
  assert.ok(priorityRoute.allAreas.includes('Wandala Road'));

  // Test Sort: due-high (Highest Balance First)
  const dueHighRoute = calculateFieldCollectionRoutes(sampleState, {
    sortBy: 'due-high',
    storage: mockStorage,
    dateStr: '2026-10-17'
  });
  assert.equal(dueHighRoute.stops[0].id, 'cust-saeed-1'); // 5000 due
  assert.equal(dueHighRoute.stops[1].id, 'cust-wandala-1'); // 4000 due
  assert.equal(dueHighRoute.stops[2].id, 'cust-saeed-2'); // 3500 due

  // 4. Contact & WhatsApp Reminder Draft Verification
  const stop1 = dueHighRoute.stops[0];
  assert.equal(stop1.customerNumber, 101);
  assert.equal(stop1.whatsappPhone, '923001112233');
  assert.equal(stop1.phoneUrl, 'tel:03001112233');
  assert.ok(stop1.whatsappReminderUrl);
  assert.ok(stop1.whatsappReminderUrl.includes('923001112233'));
  assert.ok(stop1.whatsappReminderUrl.includes(encodeURIComponent('SHAHDARA ISP - FIELD COLLECTION REMINDER')));
  assert.ok(stop1.whatsappReminderText.includes('Malik Arshad'));
  assert.ok(stop1.whatsappReminderText.includes('PKR 5,000'));
  assert.ok(stop1.whatsappReminderText.includes('#101'));

  // Stop without phone
  const stopNoPhone = dueHighRoute.stops[1];
  assert.equal(stopNoPhone.phone, '');
  assert.equal(stopNoPhone.whatsappPhone, '');
  assert.equal(stopNoPhone.phoneUrl, null);
  assert.equal(stopNoPhone.whatsappReminderUrl, null);
  assert.ok(stopNoPhone.whatsappReminderText.includes('Chaudhry Nadeem'));
  assert.ok(stopNoPhone.whatsappReminderText.includes('PKR 4,000'));

  // 5. Area / Sector Filtering
  const saeedRoute = calculateFieldCollectionRoutes(sampleState, {
    sector: 'Saeed Park - Main Bazaar',
    storage: mockStorage,
    dateStr: '2026-10-17'
  });
  assert.equal(saeedRoute.totalStops, 1);
  assert.equal(saeedRoute.stops[0].id, 'cust-saeed-1');
  assert.equal(saeedRoute.totalDue, 5000);

  // 6. Search Query Filtering
  const queryRoute = calculateFieldCollectionRoutes(sampleState, {
    query: '102',
    storage: mockStorage,
    dateStr: '2026-10-17'
  });
  assert.equal(queryRoute.totalStops, 1);
  assert.equal(queryRoute.stops[0].id, 'cust-saeed-2');

  // 7. Route Progress Persistence & Tab Filtering
  markRouteStopCollected('cust-saeed-1', true, mockStorage, '2026-10-17');
  const prog1 = getFieldRouteProgress(mockStorage, '2026-10-17');
  assert.deepEqual(prog1.collectedIds, ['cust-saeed-1']);

  const progressRoute = calculateFieldCollectionRoutes(sampleState, {
    sortBy: 'due-high',
    storage: mockStorage,
    dateStr: '2026-10-17'
  });
  assert.equal(progressRoute.totalStops, 3);
  assert.equal(progressRoute.collectedStops, 1);
  assert.equal(progressRoute.collectedAmount, 5000);
  assert.equal(progressRoute.pendingStops, 2);
  assert.equal(progressRoute.pendingAmount, 7500);
  assert.equal(progressRoute.completionRate, 33);
  assert.equal(progressRoute.roundStatus, 'IN_PROGRESS');

  // Test filterTab: 'pending' vs 'collected'
  const pendingOnlyRoute = calculateFieldCollectionRoutes(sampleState, {
    filterTab: 'pending',
    storage: mockStorage,
    dateStr: '2026-10-17'
  });
  assert.equal(pendingOnlyRoute.stops.length, 2);
  assert.ok(!pendingOnlyRoute.stops.some(s => s.id === 'cust-saeed-1'));

  const collectedOnlyRoute = calculateFieldCollectionRoutes(sampleState, {
    filterTab: 'collected',
    storage: mockStorage,
    dateStr: '2026-10-17'
  });
  assert.equal(collectedOnlyRoute.stops.length, 1);
  assert.equal(collectedOnlyRoute.stops[0].id, 'cust-saeed-1');

  // Mark all collected
  markRouteStopCollected('cust-saeed-2', true, mockStorage, '2026-10-17');
  markRouteStopCollected('cust-wandala-1', true, mockStorage, '2026-10-17');
  const allCollectedRoute = calculateFieldCollectionRoutes(sampleState, {
    storage: mockStorage,
    dateStr: '2026-10-17'
  });
  assert.equal(allCollectedRoute.completionRate, 100);
  assert.equal(allCollectedRoute.roundStatus, 'COMPLETED');

  // Clear progress
  clearFieldRouteProgress(mockStorage, '2026-10-17');
  const clearedProg = getFieldRouteProgress(mockStorage, '2026-10-17');
  assert.deepEqual(clearedProg.collectedIds, []);

  // 7b. Field Route Notes Persistence
  saveFieldRouteNote('cust-saeed-1', 'Promised to pay on 20th after salary', mockStorage, '2026-10-17');
  const notesAfterSave = getFieldRouteNotes(mockStorage, '2026-10-17');
  assert.equal(notesAfterSave['cust-saeed-1'], 'Promised to pay on 20th after salary');
  const routeWithNotes = calculateFieldCollectionRoutes(sampleState, { storage: mockStorage, dateStr: '2026-10-17' });
  const stopWithNote = routeWithNotes.stops.find(s => s.id === 'cust-saeed-1');
  assert.equal(stopWithNote.fieldNote, 'Promised to pay on 20th after salary');

  // 8. Text Manifest Generation
  const manifest = generateFieldRouteManifestText(progressRoute);
  assert.ok(manifest.includes('*SHAHDARA FIBER NET - FIELD COLLECTION DISPATCH*'));
  assert.ok(manifest.includes('Target Dues: Rs. 12,500'));
  assert.ok(manifest.includes('Malik Arshad'));
  assert.ok(manifest.includes('Sheikh Waqas'));

  // 9. Printable Route Slip HTML Generation
  const slipHtml = generateFieldRouteSlipHtml(dueHighRoute);
  assert.ok(slipHtml.includes('Door-to-Door Field Collection Manifest'));
  assert.ok(slipHtml.includes('SHAHDARA FIBER NET'));
  assert.ok(slipHtml.includes('Malik Arshad'));
  assert.ok(slipHtml.includes('Rs. 5,000'));
  assert.ok(slipHtml.includes('Rs. 4,000'));
  assert.ok(slipHtml.includes('Rs. 3,500'));
  assert.ok(slipHtml.includes('Collected by:'));

  // 10. DOM Setup and Interactive Controller Verification
  const mockElements = {
    fieldRouteModal: {
      showModal: () => { mockElements.fieldRouteModal.open = true; },
      close: () => { mockElements.fieldRouteModal.open = false; },
      addEventListener: (evt, cb) => { mockElements.fieldRouteModal[`on_${evt}`] = cb; },
      open: false
    },
    fieldRouteCloseBtn: { addEventListener: (evt, cb) => { mockElements.fieldRouteCloseBtn.onClick = cb; } },
    routeSectorFilter: {
      value: 'All',
      options: [{ value: 'All', textContent: 'All Sectors' }],
      appendChild: () => {},
      addEventListener: (evt, cb) => { mockElements.routeSectorFilter.onChange = cb; }
    },
    routeSortFilter: { value: 'due-high', addEventListener: (evt, cb) => { mockElements.routeSortFilter.onChange = cb; } },
    routeSearchInput: { value: '', addEventListener: (evt, cb) => { mockElements.routeSearchInput.onInput = cb; } },
    fieldRouteStopsList: {
      innerHTML: '',
      children: [],
      appendChild: (child) => { mockElements.fieldRouteStopsList.children.push(child); },
      addEventListener: (evt, cb) => { mockElements.fieldRouteStopsList.onClick = cb; }
    },
    routeEmptyState: { hidden: true },
    routeMetricTarget: { textContent: '' },
    routeMetricCollected: { textContent: '' },
    routeMetricPending: { textContent: '' },
    routeMetricStops: { textContent: '' },
    routeProgressText: { textContent: '' },
    routeProgressBarFill: { style: {} },
    resetRouteProgressBtn: { addEventListener: (evt, cb) => { mockElements.resetRouteProgressBtn.onClick = cb; } },
    copyRouteManifestBtn: { addEventListener: (evt, cb) => { mockElements.copyRouteManifestBtn.onClick = cb; } },
    shareRouteWhatsappBtn: { addEventListener: (evt, cb) => { mockElements.shareRouteWhatsappBtn.onClick = cb; } },
    printRouteSlipBtn: { addEventListener: (evt, cb) => { mockElements.printRouteSlipBtn.onClick = cb; } }
  };

  const origDocument = globalThis.document;
  try {
    globalThis.document = {
      getElementById: (id) => mockElements[id] || null,
      querySelectorAll: (sel) => [],
      createElement: (tag) => ({
        tagName: String(tag).toUpperCase(),
        setAttribute: () => {},
        querySelector: () => null,
        innerHTML: '',
        classList: { add: () => {} },
        style: {}
      })
    };

    let collectedCustId = null;
    let quickProfileCustId = null;
    let toastedMsg = null;

    const controller = setupFieldRouteSheet({
      state: sampleState,
      onCollectPayment: (cid) => { collectedCustId = cid; },
      onQuickProfile: (cid) => { quickProfileCustId = cid; },
      onToast: (msg) => { toastedMsg = msg; },
      storage: mockStorage
    });

    controller.open();
    assert.equal(mockElements.fieldRouteModal.open, true);
    assert.equal(mockElements.routeMetricTarget.textContent, 'Rs. 12,500');
    assert.equal(mockElements.fieldRouteStopsList.children.length, 3);

    // Simulate clicking "Receive Cash" on stop 1
    const mockCollectEvent = {
      target: {
        closest: (selector) => selector === '[data-stop-collect]' ? {
          getAttribute: (attr) => attr === 'data-stop-collect' ? 'cust-saeed-1' : null
        } : null
      }
    };
    mockElements.fieldRouteStopsList.onClick(mockCollectEvent);
    assert.equal(collectedCustId, 'cust-saeed-1');

    // Simulate clicking "ℹ️ Profile" on stop 2
    const mockProfileEvent = {
      target: {
        closest: (selector) => selector === '[data-stop-quick-profile]' ? {
          getAttribute: (attr) => attr === 'data-stop-quick-profile' ? 'cust-saeed-2' : null
        } : null
      }
    };
    mockElements.fieldRouteStopsList.onClick(mockProfileEvent);
    assert.equal(quickProfileCustId, 'cust-saeed-2');

    // Test tab filtering via controller
    controller.setFilterTab('pending');
    assert.equal(controller.getRouteData().stops.length, 3); // all currently pending

    controller.close();
    assert.equal(mockElements.fieldRouteModal.open, false);
  } finally {
    globalThis.document = origDocument;
  }

  // 11. HTML & CSS Markups Verification
  const indexHtml = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(indexHtml.includes('id="fieldRouteModal"'));
  assert.ok(indexHtml.includes('id="routeSectorFilter"'));
  assert.ok(indexHtml.includes('id="routeSortFilter"'));
  assert.ok(indexHtml.includes('id="fieldRouteStopsList"'));
  assert.ok(indexHtml.includes('class="route-filter-tabs"'));
  assert.ok(indexHtml.includes('id="printRouteSlipBtn"'));

  const navCss = fs.readFileSync(path.resolve('./nav.css'), 'utf-8');
  assert.ok(navCss.includes('.route-card'));
  assert.ok(navCss.includes('.route-filter-tabs'));
  assert.ok(navCss.includes('.route-filter-tab'));
  assert.ok(navCss.includes('.field-route-stops-list'));

  const appCode = fs.readFileSync(path.resolve('./app.js'), 'utf-8');
  assert.ok(appCode.includes('fieldRouteSheetController'));
  assert.ok(appCode.includes('quickCollectModalController'));
});


test('bilingual English / Urdu UI localization engine and RTL layout support (agent2 - Item 6)', async () => {
  const {
    LANGUAGE_STORAGE_KEY,
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    TRANSLATIONS,
    getAppLanguage,
    t,
    applyLanguageDirection,
    updateDocumentTranslations,
    setAppLanguage,
    toggleAppLanguage,
    formatBilingualCurrency,
    formatBilingualStatus,
    renderLanguageToggleBtnHtml,
    setupLanguageToggle
  } = await import('../nav.js');

  // 1. Storage & Fallback tests
  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  assert.equal(getAppLanguage(mockStorage), 'en');
  assert.equal(getAppLanguage(null), 'en');
  mockStorage.setItem(LANGUAGE_STORAGE_KEY, 'invalid');
  assert.equal(getAppLanguage(mockStorage), 'en');
  mockStorage.setItem(LANGUAGE_STORAGE_KEY, 'ur');
  assert.equal(getAppLanguage(mockStorage), 'ur');

  // 2. Translation & Interpolation
  assert.equal(t('lang_name', 'en'), 'English');
  assert.equal(t('lang_name', 'ur'), 'اردو');
  assert.equal(t('nav_collection', 'en'), 'Collect');
  assert.equal(t('nav_collection', 'ur'), 'وصولی');
  assert.equal(t('status_paid', 'en'), 'Paid');
  assert.equal(t('status_paid', 'ur'), 'مکمل ادا شدہ');
  assert.equal(t('qc_title', 'ur'), '⚡ فوری نقد وصولی (2-Tap)');
  assert.equal(t('search_title', 'ur'), '🔍 فوری صارف تلاش');
  assert.equal(t('rounds_title', 'ur'), '📋 فیلڈ وصولی روٹ لسٹ');
  assert.equal(t('nonexistent_key', 'en'), 'nonexistent_key');

  // 3. Direction & Class Manipulation
  const docRootAttrs = {};
  const classList = new Set();
  const mockDocRoot = {
    setAttribute: (attr, val) => { docRootAttrs[attr] = val; },
    classList: {
      add: (cls) => classList.add(cls),
      remove: (cls) => classList.delete(cls),
      contains: (cls) => classList.has(cls)
    }
  };

  applyLanguageDirection('ur', mockDocRoot);
  assert.equal(docRootAttrs['dir'], 'rtl');
  assert.equal(docRootAttrs['lang'], 'ur');
  assert.equal(classList.has('lang-ur'), true);

  applyLanguageDirection('en', mockDocRoot);
  assert.equal(docRootAttrs['dir'], 'ltr');
  assert.equal(docRootAttrs['lang'], 'en');
  assert.equal(classList.has('lang-ur'), false);

  // 4. toggleAppLanguage & setAppLanguage
  mockStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
  const toggled1 = toggleAppLanguage(mockStorage, mockDocRoot);
  assert.equal(toggled1, 'ur');
  assert.equal(mockStorage.getItem(LANGUAGE_STORAGE_KEY), 'ur');
  assert.equal(docRootAttrs['dir'], 'rtl');

  const toggled2 = toggleAppLanguage(mockStorage, mockDocRoot);
  assert.equal(toggled2, 'en');
  assert.equal(mockStorage.getItem(LANGUAGE_STORAGE_KEY), 'en');
  assert.equal(docRootAttrs['dir'], 'ltr');

  // 5. Bilingual Currency & Status formatting
  assert.equal(formatBilingualCurrency(2500, 'en'), 'PKR 2,500');
  assert.equal(formatBilingualCurrency(2500, 'ur'), 'روپے 2,500');
  assert.equal(formatBilingualStatus('paid', 'en'), 'Paid');
  assert.equal(formatBilingualStatus('paid', 'ur'), 'مکمل ادا شدہ');
  assert.equal(formatBilingualStatus('pending', 'ur'), 'واجب الادا بقایا');

  // 6. renderLanguageToggleBtnHtml
  const btnHtmlEn = renderLanguageToggleBtnHtml('en', 'myToggleBtn');
  assert.ok(btnHtmlEn.includes('id="myToggleBtn"'));
  assert.ok(btnHtmlEn.includes('اردو'));
  const btnHtmlUr = renderLanguageToggleBtnHtml('ur', 'myToggleBtn');
  assert.ok(btnHtmlUr.includes('English'));

  // 7. HTML and CSS Markups Verification
  const indexHtml = read('index.html');
  assert.ok(indexHtml.includes('id="languageToggleBtn"'));
  assert.ok(indexHtml.includes('id="drawerLanguageToggleBtn"'));

  const navCss = read('nav.css');
  assert.ok(navCss.includes('.language-toggle-btn'));
  assert.ok(navCss.includes('[dir="rtl"]'));
  assert.ok(navCss.includes('.lang-ur'));

  const appJs = read('app.js');
  assert.ok(appJs.includes('setupLanguageToggle'));
  assert.ok(appJs.includes('languageController'));
});

test('Pending Actions Center & Collection Promises Suite (agent2 - Backlog Item 7)', async () => {
  const {
    COLLECTION_PROMISES_STORAGE_KEY,
    getPendingActionsDateString,
    getCollectionPromises,
    saveCollectionPromise,
    fulfillCollectionPromise,
    cancelCollectionPromise,
    rescheduleCollectionPromise,
    clearCollectionPromises,
    getPendingActionsSummary,
    markAllReceiptsSharedInQueue,
    generatePendingActionsDigest,
    updatePendingActionsBadges,
    setupPendingActionsModal
  } = await import('../nav-pending-actions.js');
  const { markReceiptShared, clearSharedReceipts } = await import('../nav-quick-profile.js');
  const { updateNavigationBadges } = await import('../nav.js');

  const store = new Map();
  const mockStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  // 1. Date string helper
  const today = getPendingActionsDateString();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);

  // 2. Collection Promises CRUD
  clearCollectionPromises(mockStorage);
  assert.deepEqual(getCollectionPromises(mockStorage), []);

  const p1 = saveCollectionPromise({
    customerId: 'cust-101',
    customerNumber: 101,
    customerName: 'Muhammad Arshad',
    phone: '03001234567',
    area: 'Kot Mohibbu',
    promisedDate: '2026-10-18',
    promisedAmount: 2500,
    note: 'Will pay tomorrow after 6pm'
  }, mockStorage);

  assert.ok(p1.id.startsWith('prom-'));
  assert.equal(p1.customerName, 'Muhammad Arshad');
  assert.equal(p1.status, 'pending');

  const p2 = saveCollectionPromise({
    customerId: 'cust-102',
    customerNumber: 102,
    customerName: 'Tariq Butt',
    phone: '03217654321',
    area: 'Chowk Shahdara',
    promisedDate: '2026-10-16', // overdue
    promisedAmount: 1800,
    note: 'Shop closed yesterday'
  }, mockStorage);

  const list = getCollectionPromises(mockStorage);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, p2.id); // sorted ascending by date (2026-10-16 before 2026-10-18)

  // Reschedule p2
  const rescheduled = rescheduleCollectionPromise(p2.id, '2026-10-19', mockStorage);
  assert.equal(rescheduled.promisedDate, '2026-10-19');
  assert.equal(rescheduled.previousPromisedDate, '2026-10-16');

  // Cancel p1 with reason
  const cancelled = cancelCollectionPromise(p1.id, 'Customer moved out', mockStorage);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancelledReason, 'Customer moved out');

  // Fulfill rescheduled p2
  const fulfilled = fulfillCollectionPromise(p2.id, 'pay-rec-999', mockStorage);
  assert.equal(fulfilled.status, 'fulfilled');
  assert.equal(fulfilled.fulfilledPaymentId, 'pay-rec-999');

  // 3. getPendingActionsSummary with mock billing state
  clearCollectionPromises(mockStorage);
  clearSharedReceipts(mockStorage);

  const mockState = {
    customers: [
      {
        id: 'cust-1',
        customerNumber: 1,
        name: 'Usman Ali',
        phone: '03001112233',
        area: 'Main Bazaar',
        bills: [
          {
            id: 'bill-1',
            month: '2026-10',
            dueAmount: 2000,
            dueDate: '2026-10-05',
            status: 'paid',
            payments: [
              {
                id: 'pay-001',
                date: '2026-10-17',
                amount: 2000,
                method: 'cash',
                paidBy: 'Self'
              }
            ]
          }
        ]
      },
      {
        id: 'cust-2',
        customerNumber: 2,
        name: 'Zahid Khan',
        phone: '03334445566',
        area: 'Rehman Park',
        bills: [
          {
            id: 'bill-2',
            month: '2026-10',
            dueAmount: 3000,
            dueDate: '2026-10-05',
            status: 'partial',
            payments: [
              {
                id: 'pay-002',
                date: '2026-10-16',
                amount: 1500,
                method: 'easypaisa',
                paidBy: 'Brother'
              }
            ]
          }
        ]
      }
    ]
  };

  // Add a promise due today
  saveCollectionPromise({
    customerId: 'cust-2',
    customerNumber: 2,
    customerName: 'Zahid Khan',
    phone: '03334445566',
    area: 'Rehman Park',
    promisedDate: '2026-10-17', // today in reference
    promisedAmount: 1500,
    note: 'Remaining balance promise'
  }, mockStorage);

  // Set offline payment queue
  mockStorage.setItem('shahdara_offline_payment_queue', JSON.stringify([
    { id: 'off-1', action: 'record_payment', summary: 'Offline Rs. 1,000 for #3', status: 'pending' }
  ]));

  const summary = getPendingActionsSummary(mockState, {
    storage: mockStorage,
    todayString: '2026-10-17'
  });

  // Both payments are unshared initially
  assert.equal(summary.counts.unsharedReceipts, 2);
  assert.equal(summary.counts.promisesDue, 1);
  assert.equal(summary.counts.offlineQueue, 1);
  assert.equal(summary.counts.total, 4);

  // 4. Mark one receipt shared and verify count decreases
  markReceiptShared('pay-001', { method: 'whatsapp' }, mockStorage);
  const summaryAfterOneShared = getPendingActionsSummary(mockState, {
    storage: mockStorage,
    todayString: '2026-10-17'
  });
  assert.equal(summaryAfterOneShared.counts.unsharedReceipts, 1);
  assert.equal(summaryAfterOneShared.unsharedReceipts[0].paymentId, 'pay-002');

  // 5. Bulk mark all remaining receipts shared
  const bulkMarked = markAllReceiptsSharedInQueue(summaryAfterOneShared.unsharedReceipts, mockStorage);
  assert.equal(bulkMarked, 1);

  const summaryAfterAllShared = getPendingActionsSummary(mockState, {
    storage: mockStorage,
    todayString: '2026-10-17'
  });
  assert.equal(summaryAfterAllShared.counts.unsharedReceipts, 0);

  // 6. Plain-text digests (English & Urdu)
  const digestEn = generatePendingActionsDigest(summary, { language: 'en' });
  assert.ok(digestEn.includes('SHAHDARA FIBER NET - PENDING ACTIONS CENTER'));
  assert.ok(digestEn.includes('UNSHARED WHATSAPP RECEIPTS (2)'));
  assert.ok(digestEn.includes('COLLECTION PROMISES DUE (1)'));
  assert.ok(digestEn.includes('Zahid Khan'));

  const digestUr = generatePendingActionsDigest(summary, { language: 'ur' });
  assert.ok(digestUr.includes('ایکشن سینٹر سمری'));
  assert.ok(digestUr.includes('غیر ارسال شدہ واٹس ایپ رسیدیں (2)'));
  assert.ok(digestUr.includes('ادائیگی کے وعدے / فالو اپ (1)'));

  // 7. Navigation badges integration
  const navBadgeRes = updateNavigationBadges(mockState, {
    pendingActionsCount: summary.counts.total
  });
  assert.equal(navBadgeRes.pendingActionsCount, 4);

  // 8. HTML and CSS markups verification
  const indexHtml = read('index.html');
  assert.ok(indexHtml.includes('id="topbarPendingActionsBtn"'));
  assert.ok(indexHtml.includes('id="topbarPendingBadge"'));
  assert.ok(indexHtml.includes('id="navPendingActionsBtn"'));
  assert.ok(indexHtml.includes('id="navBadgePendingActions"'));
  assert.ok(indexHtml.includes('id="pendingActionsModal"'));
  assert.ok(indexHtml.includes('id="pendingActionsListContainer"'));
  assert.ok(indexHtml.includes('id="toggleSchedulePromiseFormBtn"'));
  assert.ok(indexHtml.includes('id="pendingPromiseForm"'));

  const navCss = read('nav.css');
  assert.ok(navCss.includes('.topbar-pending-btn'));
  assert.ok(navCss.includes('.topbar-pending-badge'));
  assert.ok(navCss.includes('.pending-actions-modal'));
  assert.ok(navCss.includes('.pending-actions-card'));
  assert.ok(navCss.includes('.pending-actions-tab'));
  assert.ok(navCss.includes('.pending-action-card'));

  const appJs = read('app.js');
  assert.ok(appJs.includes('setupPendingActionsModal'));
  assert.ok(appJs.includes('pendingActionsController'));
  assert.ok(appJs.includes('topbarPendingActionsBtn'));
  assert.ok(appJs.includes('navPendingActionsBtn'));
});

test('nav-accessibility.js - screen reader announcements, focus traps, payment feedback, and shortcuts', async () => {
  const {
    A11Y_LIVE_REGION_ID,
    A11Y_ALERT_REGION_ID,
    ensureLiveRegions,
    announceToScreenReader,
    trapModalFocus,
    announcePaymentSuccess,
    setupAccessibleKeyboardShortcuts,
    A11Y_AUDIT_CHECKLIST,
    verifyAccessibilityStandards
  } = await import('../nav-accessibility.js');

  // 1. ensureLiveRegions and announceToScreenReader
  const mockElements = new Map();
  const mockDoc = {
    body: {
      appendChild: (el) => { mockElements.set(el.id, el); }
    },
    createElement: (tag) => {
      const attrs = new Map();
      return {
        tagName: tag.toUpperCase(),
        id: '',
        className: '',
        textContent: '',
        setAttribute: (k, v) => attrs.set(k, String(v)),
        getAttribute: (k) => attrs.get(k) || null
      };
    },
    getElementById: (id) => mockElements.get(id) || null,
    querySelectorAll: () => []
  };

  const { politeRegion, alertRegion } = ensureLiveRegions(mockDoc);
  assert.equal(politeRegion.id, A11Y_LIVE_REGION_ID);
  assert.equal(politeRegion.getAttribute('aria-live'), 'polite');
  assert.equal(alertRegion.id, A11Y_ALERT_REGION_ID);
  assert.equal(alertRegion.getAttribute('aria-live'), 'assertive');

  const announced = announceToScreenReader('Test announcement', { priority: 'polite', timeout: 0, doc: mockDoc });
  assert.equal(announced, 'Test announcement');
  assert.equal(politeRegion.textContent, 'Test announcement');

  // 2. announcePaymentSuccess formats bilingual announcements
  const mockReceipt = {
    id: 'pay_123',
    receiptNumber: 'RCP-202610-001',
    customerName: 'Zahid Khan',
    amount: 2500
  };

  const msgEn = announcePaymentSuccess(mockReceipt, { language: 'en', doc: mockDoc });
  assert.ok(msgEn.includes('Payment of PKR 2,500 for Zahid Khan recorded successfully'));
  assert.ok(msgEn.includes('RCP-202610-001'));

  const msgUr = announcePaymentSuccess(mockReceipt, { language: 'ur', doc: mockDoc });
  assert.ok(msgUr.includes('گاہک Zahid Khan کی رقم PKR 2,500 کامیابی سے وصول ہو گئی'));
  assert.ok(msgUr.includes('RCP-202610-001'));

  // 3. trapModalFocus traps Tab/Shift+Tab and releases cleanly
  let focusedElement = null;
  const btn1 = {
    focus: () => { focusedElement = btn1; },
    getAttribute: () => null,
    hidden: false
  };
  const btn2 = {
    focus: () => { focusedElement = btn2; },
    getAttribute: () => null,
    hidden: false
  };

  let keydownHandler = null;
  const mockModal = {
    querySelectorAll: () => [btn1, btn2],
    addEventListener: (evt, fn) => { if (evt === 'keydown') keydownHandler = fn; },
    removeEventListener: (evt, fn) => { if (evt === 'keydown') keydownHandler = null; },
    contains: (el) => [btn1, btn2].includes(el),
    setAttribute: () => {}
  };

  let escaped = false;
  const release = trapModalFocus(mockModal, {
    initialFocus: btn1,
    onEscape: () => { escaped = true; }
  });

  assert.equal(typeof release, 'function');
  assert.ok(keydownHandler);

  // Test Escape
  keydownHandler({ key: 'Escape', preventDefault: () => {} });
  assert.equal(escaped, true);

  // Test release
  release();
  assert.equal(keydownHandler, null);

  // 4. A11Y_AUDIT_CHECKLIST and verifyAccessibilityStandards
  assert.ok(Array.isArray(A11Y_AUDIT_CHECKLIST.criteria));
  assert.ok(A11Y_AUDIT_CHECKLIST.criteria.some(c => c.id === '1.4.3'));
  assert.ok(A11Y_AUDIT_CHECKLIST.criteria.some(c => c.id === '2.4.7'));
  assert.ok(A11Y_AUDIT_CHECKLIST.criteria.some(c => c.id === '2.5.5'));

  // 5. HTML and CSS markup accessibility
  const indexHtml = read('index.html');
  assert.ok(indexHtml.includes('id="navA11yLiveRegion"'));
  assert.ok(indexHtml.includes('id="navA11yAlertRegion"'));
  assert.ok(indexHtml.includes('id="quickCollectSuccessHeading"'));
  assert.ok(indexHtml.includes('id="keyboardShortcutsModal"'));
  assert.ok(indexHtml.includes('id="mobileMoreShortcutsBtn"'));

  const navCss = read('nav.css');
  assert.ok(navCss.includes(':focus-visible'));
  assert.ok(navCss.includes('.shortcuts-modal'));
  assert.ok(navCss.includes('min-height: 44px'));
});

test('Issue #285: getMobileNavTabForScreen maps all screens and hashes to correct bottom nav tab', async () => {
  const { getMobileNavTabForScreen } = await import('../nav.js');

  // Backup, Settings, Assistant, Field-tools, More screens map to 'more'
  assert.equal(getMobileNavTabForScreen('backup'), 'more');
  assert.equal(getMobileNavTabForScreen('settings'), 'more');
  assert.equal(getMobileNavTabForScreen('assistant'), 'more');
  assert.equal(getMobileNavTabForScreen('field-tools'), 'more');
  assert.equal(getMobileNavTabForScreen('tools'), 'more');
  assert.equal(getMobileNavTabForScreen('inventory'), 'more');
  assert.equal(getMobileNavTabForScreen('expenses'), 'more');
  assert.equal(getMobileNavTabForScreen('analytics'), 'more');

  // Quick Collect and transactions map to 'collection'
  assert.equal(getMobileNavTabForScreen('transactions'), 'collection');
  assert.equal(getMobileNavTabForScreen('payments'), 'collection');
  assert.equal(getMobileNavTabForScreen('collect'), 'collection');
  assert.equal(getMobileNavTabForScreen('recovery'), 'collection');
  assert.equal(getMobileNavTabForScreen(null, '#/collect'), 'collection');
  assert.equal(getMobileNavTabForScreen(null, '#quick-collect'), 'collection');

  // Customers and Reports
  assert.equal(getMobileNavTabForScreen('customers'), 'customers');
  assert.equal(getMobileNavTabForScreen('reports'), 'reports');
  assert.equal(getMobileNavTabForScreen('bills'), 'reports');
  assert.equal(getMobileNavTabForScreen('alerts'), 'reports');

  // Home
  assert.equal(getMobileNavTabForScreen('home'), 'home');
  assert.equal(getMobileNavTabForScreen(''), 'home');
  assert.equal(getMobileNavTabForScreen(null), 'home');
});

test('Issue #285: nav.css suppresses speed dial when More menu or dialogs are open', () => {
  const css = read('nav.css');

  assert.ok(css.includes('#mobileMoreMenu:not([hidden]) ~ #mobileSpeedDial'));
  assert.ok(css.includes('body:has(#mobileMoreMenu:not([hidden])) #mobileSpeedDial'));
  assert.ok(css.includes('body:has(dialog[open]) #mobileSpeedDial'));
  assert.ok(css.includes('#mobileSpeedDial.is-suppressed'));
});

test('Issue #312: Fast Customer Search keyboard navigation, enterkeyhint=go, and ArrowDown/Enter Quick Collect', async () => {
  const html = read('index.html');
  assert.ok(html.includes('id="fastCustomerSearchInput"'));
  assert.ok(html.includes('enterkeyhint="go"'));
  assert.ok(html.includes('aria-autocomplete="list"'));
  assert.ok(html.includes('aria-controls="fastCustomerSearchResults"'));

  const navCss = read('nav.css');
  assert.ok(navCss.includes('.fcs-card.is-highlighted'));
  assert.ok(navCss.includes('[data-theme="dark"] .fcs-card.is-highlighted'));

  const nav = await import('../nav.js');
  const sampleCustomers = [
    {
      id: 'cust-1',
      customerNumber: 1,
      name: 'Test Customer 01 Ahmed',
      phone: '03001234567',
      area: 'Begum Kot',
      totalDues: 1500,
      billingStatus: 'pending'
    },
    {
      id: 'cust-2',
      customerNumber: 2,
      name: 'Ali Raza',
      phone: '03009876543',
      area: 'Saeed Park',
      totalDues: 0,
      billingStatus: 'paid'
    }
  ];

  const rendered = nav.renderFastCustomerSearchResultsHtml(sampleCustomers);
  assert.ok(rendered.includes('id="fcs-card-cust-1"'));
  assert.ok(rendered.includes('id="fcs-card-cust-2"'));
  assert.ok(rendered.includes('role="option"'));
  assert.ok(rendered.includes('aria-selected="false"'));
  assert.ok(rendered.includes('data-index="0"'));
  assert.ok(rendered.includes('data-index="1"'));
});

test('Payments Inbox & PWA Integration: More menu button, bottom nav sync, PWA actions, manifest shortcut and Fast Search set-fee button', async () => {
  const indexHtml = read('index.html');
  const manifestJson = JSON.parse(read('manifest.webmanifest'));
  const navCss = read('nav.css');

  // 1. More menu markup and CSS
  assert.match(indexHtml, /id="mobileMoreEasypaisaBtn"/);
  assert.match(indexHtml, /data-mobile-more="easypaisa"/);
  assert.ok(navCss.includes('.mobile-more-menu button[data-mobile-more="easypaisa"]::before'));


  // 2. manifest.webmanifest shortcut
  const inboxShortcut = manifestJson.shortcuts?.find(s => s.url === './#/easypaisa' || s.name === 'Payments Inbox');
  assert.ok(inboxShortcut, 'Payments Inbox shortcut must be present in manifest.webmanifest');
  assert.equal(inboxShortcut.short_name, 'Inbox');

  // 3. nav.js bottom nav tab mapping
  const { getMobileNavTabForScreen } = await import('../nav.js');
  assert.equal(getMobileNavTabForScreen('easypaisa'), 'more');
  assert.equal(getMobileNavTabForScreen('payments-inbox'), 'more');

  // 4. nav-pwa.js action parsing and execution
  const { parsePwaActionFromUrl, executePwaAction } = await import('../nav-pwa.js');
  assert.equal(parsePwaActionFromUrl('https://example.com/#/easypaisa'), 'payments-inbox');
  assert.equal(parsePwaActionFromUrl('https://example.com/?action=easypaisa'), 'payments-inbox');
  assert.equal(parsePwaActionFromUrl('https://example.com/?action=payments-inbox'), 'payments-inbox');

  let inboxCalled = false;
  const executed = executePwaAction('payments-inbox', {
    onPaymentsInbox: () => { inboxCalled = true; }
  });
  assert.ok(executed);
  assert.ok(inboxCalled);

  // 5. Fast Customer Search set-fee button label for not-set customers
  const { renderFastCustomerSearchResultsHtml } = await import('../nav-customer-search.js');
  const notSetCustomer = [{
    id: 'cust-not-set',
    customerNumber: 99,
    name: 'Unbilled Customer',
    phone: '03001112233',
    area: 'Jia Musa',
    totalDues: 0,
    billingStatus: ''
  }];
  const renderedNotSet = renderFastCustomerSearchResultsHtml(notSetCustomer);
  assert.ok(renderedNotSet.includes('⚡ Collect / Set Fee'), 'Button must show Collect / Set Fee for customers with no bill set');
  assert.ok(renderedNotSet.includes('title="Set monthly fee or collect from Unbilled Customer"'));
});

test('Issue #340: breadcrumb bar hides on Home, resets trail, and normalizes route hashes', async () => {
  const { setupMobileBreadcrumbs } = await import('../nav.js');
  const navCss = read('nav.css');
  const appCode = read('app.js');

  // Verify CSS rule hiding breadcrumbs on Home
  assert.match(navCss, /body\[data-screen="home"\]\s*\.mobile-breadcrumb-bar\s*\{\s*display:\s*none\s*!important;\s*\}/);

  // Verify app.js hash history normalization
  assert.match(appCode, /const\s+targetHash\s*=\s*'#\/'\s*\+\s*view;/);
  assert.match(appCode, /if\s*\(!raw\s*\|\|\s*raw\s*===\s*'home'\)\s*\{\s*mobileBreadcrumbs\?\.resetBreadcrumbs\(\);/);

  // Verify setupMobileBreadcrumbs behavior when on Home
  const container = { hidden: false, id: 'mobileBreadcrumbBar' };
  const list = { innerHTML: '', children: [], appendChild() {}, id: 'breadcrumbList', addEventListener() {}, removeEventListener() {} };
  const backBtn = { hidden: false, id: 'breadcrumbBackBtn', attributes: new Map(), setAttribute(k, v) { this.attributes.set(k, v); }, addEventListener() {}, removeEventListener() {} };

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;

  globalThis.document = {
    body: {
      dataset: { screen: 'home' },
      classList: { contains: () => false }
    },
    getElementById: id => (id === 'mobileBreadcrumbBar' ? container : id === 'breadcrumbList' ? list : id === 'breadcrumbBackBtn' ? backBtn : null),
    createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {} })
  };
  globalThis.window = {
    location: { hash: '#/home' },
    addEventListener() {},
    removeEventListener() {}
  };

  try {
    const breadcrumbs = setupMobileBreadcrumbs({
      containerId: 'mobileBreadcrumbBar',
      listId: 'breadcrumbList',
      backBtnId: 'breadcrumbBackBtn',
      initialCrumbs: [
        { id: 'home', label: 'Home' },
        { id: 'customers', label: 'Customers' }
      ]
    });

    // Even with multiple initial crumbs, being on Home must force container & backBtn hidden
    assert.equal(container.hidden, true);
    assert.equal(backBtn.hidden, true);
    assert.equal(breadcrumbs.getBreadcrumbTrail().length, 1);
    assert.equal(breadcrumbs.getBreadcrumbTrail()[0].id, 'home');

    // Trying to push crumbs while on Home keeps container and backBtn hidden
    breadcrumbs.pushCrumb({ id: 'customers', label: 'Customers' });
    assert.equal(container.hidden, true);
    assert.equal(backBtn.hidden, true);
    assert.equal(breadcrumbs.getBreadcrumbTrail().length, 1);

    breadcrumbs.destroy();
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});

test('Backlog Item 8: bottom nav includes dues badge on Collection and More menu prioritizes billing items first', async () => {
  const indexHtml = read('index.html');
  const navCss = read('nav.css');

  // Verify bottom nav Collection button has .has-badge and #bottomNavBadgeCollection with dues badge alert
  assert.match(indexHtml, /id="bottomNavBadgeCollection"[^>]*class="[^"]*badge-alert[^"]*"/);
  assert.match(indexHtml, /id="bottomNavBadgeCollection"[^>]*data-nav-badge="collection"/);
  assert.match(indexHtml, /id="bottomNavBadgeCollection"[^>]*data-nav-badge-alias="dues"/);
  assert.match(indexHtml, /id="mobileMoreButton"[^>]*data-mobile-nav="more"/);

  // Verify More menu section labels and billing items order
  assert.match(indexHtml, /class="more-menu-section-label"[^>]*>.*?Billing &amp; Business: Core Ledger/);

  // Verify billing items are placed at the top of the More menu in prioritized order
  const moreMenuIdx = indexHtml.indexOf('id="mobileMoreMenu"');
  assert.ok(moreMenuIdx !== -1, 'mobileMoreMenu must exist');
  const moreSub = indexHtml.slice(moreMenuIdx, moreMenuIdx + 4000);

  const posCustomers = moreSub.indexOf('data-mobile-more="customers"');
  const posCollection = moreSub.indexOf('data-mobile-more="collection"');
  const posBills = moreSub.indexOf('data-mobile-more="bills"');
  const posExpenses = moreSub.indexOf('data-mobile-more="expenses"');
  const posReports = moreSub.indexOf('data-mobile-more="reports"');
  const posBackup = moreSub.indexOf('data-mobile-more="backup"');

  assert.ok(posCustomers !== -1, 'customers must be in more menu');
  assert.ok(posCollection !== -1, 'collection must be in more menu');
  assert.ok(posBills !== -1, 'bills must be in more menu');
  assert.ok(posExpenses !== -1, 'expenses must be in more menu');
  assert.ok(posReports !== -1, 'reports must be in more menu');
  assert.ok(posBackup !== -1, 'backup must be in more menu');

  // Assert order: customers < collection < bills < expenses < reports < backup
  assert.ok(posCustomers < posCollection, 'Customers before Collection');
  assert.ok(posCollection < posBills, 'Collection before Bills');
  assert.ok(posBills < posExpenses, 'Bills before Expenses');
  assert.ok(posExpenses < posReports, 'Expenses before Reports');
  assert.ok(posReports < posBackup, 'Reports before Backup');

  // Verify more-menu-badge styling and presence in HTML
  assert.match(indexHtml, /class="more-menu-badge"[^>]*data-nav-badge="customers"/);
  assert.match(indexHtml, /class="more-menu-badge"[^>]*data-nav-badge="expenses"/);
  assert.match(indexHtml, /class="more-menu-badge badge-alert"[^>]*data-nav-badge="recovery"/);

  // Verify nav.css styles for more-menu-badge and active states
  assert.match(navCss, /\.more-menu-badge\b/);
  assert.match(navCss, /\.more-menu-badge\.badge-alert\b/);
  assert.match(navCss, /\.mobile-more-menu button\[aria-current="page"\]/);
  assert.match(navCss, /\[data-theme="dark"\] \.more-menu-badge/);
  assert.match(navCss, /\[dir="rtl"\] \.more-menu-badge/);
});

test('Backlog Item 8: getMobileNavTabForScreen and syncMobileBottomNav handle collection and route aliases', async () => {
  const { getMobileNavTabForScreen, syncMobileBottomNav, setupSidebarRail } = await import('../nav.js');

  // getMobileNavTabForScreen handles direct and alias inputs
  assert.equal(getMobileNavTabForScreen('home'), 'home');
  assert.equal(getMobileNavTabForScreen('customers'), 'customers');
  assert.equal(getMobileNavTabForScreen('collection'), 'collection');
  assert.equal(getMobileNavTabForScreen('transactions'), 'collection');
  assert.equal(getMobileNavTabForScreen('payments'), 'collection');
  assert.equal(getMobileNavTabForScreen('collect'), 'collection');
  assert.equal(getMobileNavTabForScreen('reports'), 'reports');
  assert.equal(getMobileNavTabForScreen('bills'), 'reports');
  assert.equal(getMobileNavTabForScreen('alerts'), 'reports');
  assert.equal(getMobileNavTabForScreen('recovery'), 'collection');
  assert.equal(getMobileNavTabForScreen('dues'), 'collection');
  assert.equal(getMobileNavTabForScreen('backup'), 'more');
  assert.equal(getMobileNavTabForScreen('settings'), 'more');

  // Test syncMobileBottomNav alias activation on More menu buttons
  const createMockBtn = (action) => ({
    attributes: new Map([['data-mobile-more', action], ['aria-current', 'false']]),
    getAttribute(k) { return this.attributes.get(k); },
    setAttribute(k, v) { this.attributes.set(k, v); }
  });

  const moreCollectionBtn = createMockBtn('collection');
  const moreRecoveryBtn = createMockBtn('recovery');
  const moreBackupBtn = createMockBtn('backup');
  const moreEasypaisaBtn = createMockBtn('easypaisa');

  const prevDoc = globalThis.document;
  globalThis.document = {
    querySelector: sel => (sel === '.mobile-bottom-nav' ? { querySelectorAll: () => [] } : null),
    getElementById: id => {
      if (id === 'mobileMoreMenu') {
        return {
          hidden: false,
          querySelectorAll: sel => (sel === '[data-mobile-more]' ? [moreCollectionBtn, moreRecoveryBtn, moreBackupBtn, moreEasypaisaBtn] : [])
        };
      }
      return null;
    }
  };

  try {
    // When screen is 'transactions', moreAction 'collection' must become active page
    syncMobileBottomNav('transactions');
    assert.equal(moreCollectionBtn.getAttribute('aria-current'), 'page');
    assert.equal(moreRecoveryBtn.getAttribute('aria-current'), 'false');

    // When screen is 'dues', moreAction 'recovery' must become active page
    syncMobileBottomNav('dues');
    assert.equal(moreCollectionBtn.getAttribute('aria-current'), 'false');
    assert.equal(moreRecoveryBtn.getAttribute('aria-current'), 'page');

    // When screen is 'settings', moreAction 'backup' must become active page
    syncMobileBottomNav('settings');
    assert.equal(moreBackupBtn.getAttribute('aria-current'), 'page');
    assert.equal(moreRecoveryBtn.getAttribute('aria-current'), 'false');

    // When screen is 'payments-inbox', moreAction 'easypaisa' must become active page
    syncMobileBottomNav('payments-inbox');
    assert.equal(moreEasypaisaBtn.getAttribute('aria-current'), 'page');
  } finally {
    globalThis.document = prevDoc;
  }
});

