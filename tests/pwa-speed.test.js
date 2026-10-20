import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PWA_INSTALLED_STORAGE_KEY,
  PWA_BANNER_DISMISSED_KEY,
  CACHE_NAME_VERSION,
  isStandaloneMode,
  isPwaInstalled,
  getPwaInstallState,
  isIosDevice,
  parsePwaActionFromUrl,
  executePwaAction,
  deferLowPriorityInit,
  createLazyModalController,
  measurePwaPerformance,
  setupPwaInstallPrompt,
  setupPwaStatusModal,
  setupPwaShortcuts
} from '../nav-pwa.js';

import { t, TRANSLATIONS } from '../nav-language.js';

// --- Helper Mocks ---
function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    has: (key) => store.has(key)
  };
}

function createMockElement(id = '', tag = 'div') {
  const listeners = new Map();
  return {
    id,
    tagName: tag.toUpperCase(),
    hidden: false,
    className: '',
    textContent: '',
    attributes: new Map(),
    setAttribute(name, val) { this.attributes.set(name, String(val)); },
    getAttribute(name) { return this.attributes.get(name) ?? null },
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
    },
    removeEventListener(type, cb) {
      if (!listeners.has(type)) return;
      listeners.set(type, listeners.get(type).filter(fn => fn !== cb));
    },
    click() {
      const cbs = listeners.get('click') || [];
      cbs.forEach(cb => cb({ type: 'click', target: this, preventDefault: () => {} }));
    },
    showModal() { this.hidden = false; },
    close() { this.hidden = true; },
    dispatchEvent(evt) {
      const cbs = listeners.get(evt.type) || [];
      cbs.forEach(cb => cb(evt));
      return true;
    }
  };
}

function createMockDocument() {
  const elements = new Map();
  return {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, createMockElement(id));
      }
      return elements.get(id);
    },
    querySelector(sel) {
      if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
      return createMockElement('', 'button');
    },
    body: createMockElement('body')
  };
}

test('Web App Manifest shortcuts configuration is valid and conforms to spec', () => {
  const manifestRaw = readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8');
  const manifest = JSON.parse(manifestRaw);

  assert.equal(manifest.name, 'Shahdara ISP Billing');
  assert.equal(manifest.short_name, 'ISP Billing');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.shortcuts), 'Manifest has shortcuts array');
  assert.equal(manifest.shortcuts.length, 4, 'Manifest defines 4 shortcuts');

  const [qcShortcut, addCustShortcut, duesShortcut, inboxShortcut] = manifest.shortcuts;
  assert.equal(qcShortcut.short_name, 'Quick Collect');
  assert.equal(qcShortcut.url, './#quick-collect');
  assert.ok(qcShortcut.icons && qcShortcut.icons.length > 0);

  assert.equal(addCustShortcut.short_name, 'New Customer');
  assert.equal(addCustShortcut.url, './#add-customer');
  assert.ok(addCustShortcut.icons && addCustShortcut.icons.length > 0);

  assert.equal(duesShortcut.short_name, "Today's Dues");
  assert.equal(duesShortcut.url, './#today-dues');
  assert.ok(duesShortcut.icons && duesShortcut.icons.length > 0);

  assert.equal(inboxShortcut.short_name, 'Inbox');
  assert.equal(inboxShortcut.url, './#/easypaisa');
  assert.ok(inboxShortcut.icons && inboxShortcut.icons.length > 0);
});


test('parsePwaActionFromUrl extracts action intents from hash and query parameters', () => {
  assert.equal(parsePwaActionFromUrl('#quick-collect'), 'quick-collect');
  assert.equal(parsePwaActionFromUrl('https://billing.shahdara.app/#quick-collect'), 'quick-collect');
  assert.equal(parsePwaActionFromUrl('#add-customer'), 'add-customer');
  assert.equal(parsePwaActionFromUrl('#today-dues'), 'today-dues');
  assert.equal(parsePwaActionFromUrl('#dues'), 'today-dues');
  assert.equal(parsePwaActionFromUrl('#collection-rounds'), 'collection-rounds');
  assert.equal(parsePwaActionFromUrl('#pending-actions'), 'pending-actions');
  assert.equal(parsePwaActionFromUrl('#fast-search'), 'fast-search');
  assert.equal(parsePwaActionFromUrl('#pwa-status'), 'pwa-status');

  // Query parameter extraction
  assert.equal(parsePwaActionFromUrl('?action=quick-collect'), 'quick-collect');
  assert.equal(parsePwaActionFromUrl('https://example.com/app?action=add-customer&mode=offline'), 'add-customer');
  assert.equal(parsePwaActionFromUrl('?action=dues'), 'today-dues');

  // Invalid / unrelated URLs
  assert.equal(parsePwaActionFromUrl('#unknown-view'), null);
  assert.equal(parsePwaActionFromUrl(''), null);
});

test('executePwaAction invokes corresponding action handlers', () => {
  let qcCalled = false;
  let addCalled = false;
  let duesCalled = false;
  let roundsCalled = false;
  let pendingCalled = false;
  let searchCalled = false;
  let statusCalled = false;

  const context = {
    onQuickCollect: () => { qcCalled = true; },
    onAddCustomer: () => { addCalled = true; },
    onTodayDues: () => { duesCalled = true; },
    onCollectionRounds: () => { roundsCalled = true; },
    onPendingActions: () => { pendingCalled = true; },
    onFastSearch: () => { searchCalled = true; },
    onPwaStatus: () => { statusCalled = true; }
  };

  assert.equal(executePwaAction('quick-collect', context), true);
  assert.equal(qcCalled, true);

  assert.equal(executePwaAction('add-customer', context), true);
  assert.equal(addCalled, true);

  assert.equal(executePwaAction('today-dues', context), true);
  assert.equal(duesCalled, true);

  assert.equal(executePwaAction('collection-rounds', context), true);
  assert.equal(roundsCalled, true);

  assert.equal(executePwaAction('pending-actions', context), true);
  assert.equal(pendingCalled, true);

  assert.equal(executePwaAction('fast-search', context), true);
  assert.equal(searchCalled, true);

  assert.equal(executePwaAction('pwa-status', context), true);
  assert.equal(statusCalled, true);

  assert.equal(executePwaAction('invalid-action', context), false);
});

test('isStandaloneMode and isPwaInstalled evaluate display mode and storage persistence', () => {
  const mockWinNormal = {
    matchMedia: () => ({ matches: false }),
    navigator: { standalone: false },
    document: { referrer: '' }
  };
  const mockWinStandalone = {
    matchMedia: (query) => ({ matches: query.includes('standalone') }),
    navigator: { standalone: false },
    document: { referrer: '' }
  };

  assert.equal(isStandaloneMode(mockWinNormal), false);
  assert.equal(isStandaloneMode(mockWinStandalone), true);

  const emptyStorage = createMockStorage();
  assert.equal(isPwaInstalled(emptyStorage, mockWinNormal), false);

  const installedStorage = createMockStorage({ [PWA_INSTALLED_STORAGE_KEY]: 'true' });
  assert.equal(isPwaInstalled(installedStorage, mockWinNormal), true);
  assert.equal(isPwaInstalled(emptyStorage, mockWinStandalone), true);

  const installState = getPwaInstallState();
  assert.ok(typeof installState === 'object');
  assert.ok('isStandalone' in installState);
  assert.ok('isInstalled' in installState);
  assert.ok('canInstall' in installState);
});

test('createLazyModalController defers factory execution until first open or property access', () => {
  let factoryExecutedCount = 0;
  let openedCount = 0;
  let closedCount = 0;

  function heavyModalFactory() {
    factoryExecutedCount++;
    return {
      open: () => { openedCount++; },
      close: () => { closedCount++; },
      customMetric: 42
    };
  }

  const lazyController = createLazyModalController(heavyModalFactory);

  // Before any access, factory has not run yet (or only scheduled on idle)
  assert.equal(openedCount, 0);

  // Calling .open() initializes on-demand immediately
  lazyController.open();
  assert.equal(factoryExecutedCount, 1);
  assert.equal(openedCount, 1);

  // Subsequent method calls reuse the same instance without re-running factory
  lazyController.close();
  assert.equal(factoryExecutedCount, 1);
  assert.equal(closedCount, 1);
  assert.equal(lazyController.customMetric, 42);
});

test('deferLowPriorityInit schedules callbacks gracefully', (t, done) => {
  let executed = false;
  deferLowPriorityInit(() => {
    executed = true;
    assert.equal(executed, true);
    done();
  }, { delay: 10, timeout: 50 });
});

test('measurePwaPerformance returns structured device and cache indicators', async () => {
  const metrics = await measurePwaPerformance();
  assert.ok(typeof metrics === 'object');
  assert.ok(typeof metrics.timestamp === 'number');
  assert.ok(typeof metrics.hardwareConcurrency === 'number');
  assert.ok(typeof metrics.deviceMemory === 'number');
  assert.ok(typeof metrics.isLowEndDevice === 'boolean');
});

test('setupPwaInstallPrompt manages install banner and trigger buttons', () => {
  const mockDoc = createMockDocument();
  const mockStorage = createMockStorage();
  let toastMsg = '';

  const controller = setupPwaInstallPrompt({
    doc: mockDoc,
    storage: mockStorage,
    onToast: (msg) => { toastMsg = msg; }
  });

  const banner = mockDoc.getElementById('pwaInstallBanner');
  const bannerInstallBtn = mockDoc.getElementById('pwaBannerInstallBtn');
  const bannerDismissBtn = mockDoc.getElementById('pwaBannerDismissBtn');

  // Dismissing banner saves persistence key
  bannerDismissBtn.click();
  assert.equal(mockStorage.getItem(PWA_BANNER_DISMISSED_KEY), 'true');
  assert.equal(banner.hidden, true);

  // Clicking install without deferred prompt provides instructions toast
  bannerInstallBtn.click();
  assert.ok(toastMsg.includes('To install:'));
});

test('setupPwaStatusModal controls dialog lifecycle and metrics display', () => {
  const mockDoc = createMockDocument();
  let toastMsg = '';
  let qcCalled = false;

  const controller = setupPwaStatusModal({
    doc: mockDoc,
    onToast: (msg) => { toastMsg = msg; },
    onQuickCollect: () => { qcCalled = true; }
  });

  const modal = mockDoc.getElementById('pwaStatusModal');
  const closeBtn = mockDoc.getElementById('closePwaStatusModalBtn');
  const shortcutCollectBtn = mockDoc.getElementById('pwaShortcutCollectBtn');

  controller.open();
  assert.equal(modal.hidden, false);

  shortcutCollectBtn.click();
  assert.equal(qcCalled, true);
  assert.equal(modal.hidden, true);

  controller.open();
  closeBtn.click();
  assert.equal(modal.hidden, true);
});

test('Bilingual English and Urdu dictionaries contain PWA translation keys', () => {
  assert.ok(TRANSLATIONS.en.pwa_install_btn);
  assert.ok(TRANSLATIONS.en.pwa_install_banner_title);
  assert.ok(TRANSLATIONS.en.pwa_status_title);
  assert.ok(TRANSLATIONS.en.pwa_shortcuts_heading);

  assert.ok(TRANSLATIONS.ur.pwa_install_btn);
  assert.ok(TRANSLATIONS.ur.pwa_install_banner_title);
  assert.ok(TRANSLATIONS.ur.pwa_status_title);
  assert.ok(TRANSLATIONS.ur.pwa_shortcuts_heading);

  assert.equal(t('pwa_install_btn', 'en'), 'Install App');
  assert.equal(t('pwa_install_btn', 'ur'), 'ایپ انسٹال کریں');
});

test('HTML and CSS integrity: PWA elements, modal, and responsive styles exist', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../nav.css', import.meta.url), 'utf8');

  // Verify markup
  assert.ok(html.includes('id="pwaInstallBanner"'), 'index.html has pwaInstallBanner');
  assert.ok(html.includes('id="pwaBannerInstallBtn"'), 'index.html has pwaBannerInstallBtn');
  assert.ok(html.includes('id="pwaBannerDismissBtn"'), 'index.html has pwaBannerDismissBtn');
  assert.ok(html.includes('id="pwaStatusModal"'), 'index.html has pwaStatusModal');
  assert.ok(html.includes('id="pwaShortcutCollectBtn"'), 'index.html has pwaShortcutCollectBtn');
  assert.ok(html.includes('id="drawerInstallAppBtn"'), 'index.html has drawerInstallAppBtn');
  assert.ok(html.includes('id="mobileMorePwaStatusBtn"'), 'index.html has mobileMorePwaStatusBtn');
  assert.ok(html.includes('id="mobileMoreInstallPwaBtn"'), 'index.html has mobileMoreInstallPwaBtn');

  // Verify CSS
  assert.ok(css.includes('.pwa-install-banner'), 'nav.css has .pwa-install-banner');
  assert.ok(css.includes('.pwa-status-dialog'), 'nav.css has .pwa-status-dialog');
  assert.ok(css.includes('.pwa-banner-install-btn'), 'nav.css has .pwa-banner-install-btn');
  assert.ok(css.includes('min-height: 44px'), 'nav.css enforces 44px min touch target');
});
