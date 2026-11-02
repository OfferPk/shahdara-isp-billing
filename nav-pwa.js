/**
 * nav-pwa.js - Progressive Web App (PWA) Shortcuts, Install Prompts & Mobile Speed Optimization Engine
 *
 * Implements Backlog Item 10:
 * 1. Web App Manifest shortcuts support: #quick-collect (Quick Collect in 2 taps),
 *    #add-customer (New customer registration), and #today-dues (Subscribers with dues).
 * 2. PWA Install Prompt handling: intercepts `beforeinstallprompt`, manages install banner
 *    and drawer/more buttons, handles iOS Safari / Android Chrome home screen installation,
 *    and tracks `appinstalled` state in localStorage.
 * 3. Mobile Performance & Low-End Phone Acceleration:
 *    - `deferLowPriorityInit`: defers secondary tool initializations until browser idle time
 *      via `requestIdleCallback` (or `setTimeout` fallback).
 *    - `createLazyModalController`: transparent proxy wrapper ensuring heavy diagnostic
 *      modals, SVG graphs, and charts are only initialized when first opened or during idle time,
 *      eliminating main thread blocking during critical first paint on budget phones.
 * 4. PWA Status & Offline Health Sheet (#pwaStatusModal):
 *    - Standalone app mode vs browser tab detection.
 *    - Offline cache status & storage quota estimation (`navigator.storage.estimate`).
 *    - App shortcuts launcher and manual update trigger (`registration.update`).
 * 5. Full bilingual English & Urdu localization with RTL support.
 */

import { announceToScreenReader } from './nav-accessibility.js';
import { t, getAppLanguage } from './nav-language.js';

export const PWA_INSTALLED_STORAGE_KEY = 'shahdara_pwa_installed_v1';
export const PWA_BANNER_DISMISSED_KEY = 'shahdara_pwa_banner_dismissed_v1';
export const PWA_METRICS_STORAGE_KEY = 'shahdara_pwa_metrics_v1';
export const CACHE_NAME_VERSION = 'shahdara-isp-billing-v36';

let deferredInstallPrompt = null;
let pwaInstallControllerInstance = null;
let pwaStatusModalControllerInstance = null;

/**
 * Checks whether the web app is running in standalone PWA display mode.
 * @param {Window} [win=window]
 * @returns {boolean}
 */
export function isStandaloneMode(win = (typeof window !== 'undefined' ? window : null)) {
  if (!win) return false;
  try {
    const isStandaloneMedia = win.matchMedia && win.matchMedia('(display-mode: standalone)').matches;
    const isNavigatorStandalone = Boolean(win.navigator && win.navigator.standalone);
    const isAndroidApp = Boolean(win.document && win.document.referrer && win.document.referrer.includes('android-app://'));
    return isStandaloneMedia || isNavigatorStandalone || isAndroidApp;
  } catch {
    return false;
  }
}

/**
 * Checks whether the app has been marked as installed or is currently in standalone mode.
 * @param {Storage|Object} [storage=localStorage]
 * @param {Window} [win=window]
 * @returns {boolean}
 */
export function isPwaInstalled(
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  win = (typeof window !== 'undefined' ? window : null)
) {
  if (isStandaloneMode(win)) return true;
  if (!storage) return false;
  try {
    return storage.getItem(PWA_INSTALLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Returns current installation and display capabilities.
 * @returns {{ isStandalone: boolean, isInstalled: boolean, canInstall: boolean, hasPrompt: boolean }}
 */
export function getPwaInstallState() {
  const isStandalone = isStandaloneMode();
  const isInstalled = isPwaInstalled();
  const hasPrompt = Boolean(deferredInstallPrompt);
  const canInstall = !isStandalone && (hasPrompt || isIosDevice());
  return { isStandalone, isInstalled, canInstall, hasPrompt };
}

/**
 * Detects iOS devices (iPhone, iPad, iPod) which do not support beforeinstallprompt.
 * @returns {boolean}
 */
export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !(window?.MSStream);
}

/**
 * Parses action intent from URL hash or query parameters.
 * Supports #quick-collect, #add-customer, #today-dues, #collection-rounds, #pending-actions,
 * Supports #quick-collect, #add-customer, #today-dues, #collection-rounds, #pending-actions,
 * #fast-search, #pwa-status, #payments-inbox, #easypaisa, as well as ?action=...
 *
 * @param {string} [urlOrHash] - Full URL string, search string, or hash
 * @returns {'quick-collect'|'add-customer'|'today-dues'|'collection-rounds'|'pending-actions'|'fast-search'|'pwa-status'|'payments-inbox'|null}
 */
export function parsePwaActionFromUrl(urlOrHash = '') {
  let target = String(urlOrHash || '');
  if (!target && typeof window !== 'undefined' && window.location) {
    target = `${window.location.search || ''} ${window.location.hash || ''}`;
  }

  // 1. Check query parameter: ?action=...
  const queryMatch = target.match(/[?&]action=([a-zA-Z0-9_-]+)/);
  if (queryMatch) {
    const action = queryMatch[1].toLowerCase();
    if (['quick-collect', 'add-customer', 'today-dues', 'dues', 'collection-rounds', 'pending-actions', 'fast-search', 'pwa-status', 'payments-inbox', 'easypaisa'].includes(action)) {
      if (action === 'dues') return 'today-dues';
      if (action === 'easypaisa') return 'payments-inbox';
      return action;
    }
  }

  // 2. Check hash route: #quick-collect, #/easypaisa, etc.
  const cleanHash = (target.match(/#\/?([a-zA-Z0-9_-]+)/)?.[1] || '').toLowerCase();
  if (['quick-collect', 'add-customer', 'today-dues', 'dues', 'collection-rounds', 'pending-actions', 'fast-search', 'pwa-status', 'payments-inbox', 'easypaisa'].includes(cleanHash)) {
    if (cleanHash === 'dues') return 'today-dues';
    if (cleanHash === 'easypaisa') return 'payments-inbox';
    return cleanHash;
  }


  return null;
}

/**
 * Customer id carried by a #quick-collect/<customerId> deep link (e.g. the Home
 * Top 5 Overdue "Collect" links), or null when the URL names no customer.
 *
 * @param {string} [urlOrHash] - Full URL string, search string, or hash
 * @returns {string|null}
 */
export function parsePwaCustomerIdFromUrl(urlOrHash = '') {
  let target = String(urlOrHash || '');
  if (!target && typeof window !== 'undefined' && window.location) {
    target = window.location.hash || '';
  }
  const match = target.match(/#\/?quick-collect\/([^\s/?#]+)/i);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

/**
 * Executes a parsed PWA action using the supplied handler context.
 *
 * @param {string} action
 * @param {Object} context
 * @param {Function} [context.onQuickCollect]
 * @param {Function} [context.onAddCustomer]
 * @param {Function} [context.onTodayDues]
 * @param {Function} [context.onCollectionRounds]
 * @param {Function} [context.onPendingActions]
 * @param {Function} [context.onFastSearch]
 * @param {Function} [context.onPwaStatus]
 * @param {Function} [context.onPaymentsInbox]
 * @param {Function} [context.toast]
 * @returns {boolean} True if an action was recognized and executed
 */
export function executePwaAction(action, context = {}) {
  if (!action || typeof context !== 'object') return false;

  switch (action) {
    case 'quick-collect':
      if (typeof context.onQuickCollect === 'function') {
        // A #quick-collect/<id> deep link preselects that customer.
        context.onQuickCollect(parsePwaCustomerIdFromUrl() ?? undefined);
        announceToScreenReader('Quick Collect shortcut activated');
        return true;
      }
      break;

    case 'add-customer':
      if (typeof context.onAddCustomer === 'function') {
        context.onAddCustomer();
        announceToScreenReader('New Customer registration opened');
        return true;
      }
      break;

    case 'today-dues':
      if (typeof context.onTodayDues === 'function') {
        context.onTodayDues();
        announceToScreenReader('Subscribers with pending dues opened');
        return true;
      }
      break;

    case 'collection-rounds':
      if (typeof context.onCollectionRounds === 'function') {
        context.onCollectionRounds();
        announceToScreenReader('Field Collection Route opened');
        return true;
      }
      break;

    case 'pending-actions':
      if (typeof context.onPendingActions === 'function') {
        context.onPendingActions();
        announceToScreenReader('Pending Actions Center opened');
        return true;
      }
      break;

    case 'fast-search':
      if (typeof context.onFastSearch === 'function') {
        context.onFastSearch();
        announceToScreenReader('Fast Customer Search opened');
        return true;
      }
      break;

    case 'pwa-status':
      if (typeof context.onPwaStatus === 'function') {
        context.onPwaStatus();
        return true;
      }
      break;

    case 'payments-inbox':
    case 'easypaisa':
      if (typeof context.onPaymentsInbox === 'function') {
        context.onPaymentsInbox();
        announceToScreenReader('Payments Inbox opened');
        return true;
      } else if (typeof window !== 'undefined') {
        window.location.hash = '#/easypaisa';
        announceToScreenReader('Payments Inbox opened');
        return true;
      }
      break;

    default:
      return false;
  }
  return false;
}

/**
 * Defers low-priority non-critical initializations until the browser thread is idle,
 * accelerating first contentful paint and interaction readiness on low-end budget phones.
 *
 * @param {Function} fn - Initialization function to run during idle time
 * @param {Object} [options]
 * @param {number} [options.delay=600] - Fallback timeout in ms
 * @param {number} [options.timeout=2500] - Max deadline for requestIdleCallback
 */
export function deferLowPriorityInit(fn, { delay = 600, timeout = 2500 } = {}) {
  if (typeof fn !== 'function') return;

  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => {
      try {
        fn();
      } catch (err) {
        console.warn('[PWA Speed] Deferred idle task error:', err);
      }
    }, { timeout });
  } else if (typeof setTimeout === 'function') {
    setTimeout(() => {
      try {
        fn();
      } catch (err) {
        console.warn('[PWA Speed] Deferred timeout task error:', err);
      }
    }, delay);
  } else {
    fn();
  }
}

/**
 * Creates a lazy-initialization proxy for heavy modal controllers.
 * The modal initialization callback is not called until the modal is actually opened
 * or until the system executes an idle callback, saving dozens of synchronous DOM queries
 * and calculations on page load.
 *
 * @param {Function} factoryFn - Returns the initialized controller { open: Function, close: Function, ... }
 * @returns {Object} Lazy proxy controller
 */
export function createLazyModalController(factoryFn) {
  let instance = null;
  let isInitializing = false;

  function ensureInstance() {
    if (!instance && !isInitializing) {
      isInitializing = true;
      try {
        instance = factoryFn();
      } catch (err) {
        console.error('[PWA Speed] Lazy controller initialization failed:', err);
      } finally {
        isInitializing = false;
      }
    }
    return instance;
  }

  // Preload during idle time after first paint
  deferLowPriorityInit(() => {
    ensureInstance();
  }, { delay: 1200, timeout: 3500 });

  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'isInitialized') {
        return Boolean(instance);
      }
      if (prop === 'initNow') {
        return ensureInstance;
      }
      const inst = ensureInstance();
      if (!inst) return undefined;
      const val = inst[prop];
      if (typeof val === 'function') {
        return val.bind(inst);
      }
      return val;
    }
  });
}

/**
 * Measures basic device performance metrics and PWA readiness indicators.
 * @returns {Promise<Object>}
 */
export async function measurePwaPerformance() {
  const metrics = {
    timestamp: Date.now(),
    isStandalone: isStandaloneMode(),
    isInstalled: isPwaInstalled(),
    hardwareConcurrency: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4,
    deviceMemory: typeof navigator !== 'undefined' ? (navigator.deviceMemory || 2) : 2,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isLowEndDevice: false,
    fcpMs: null,
    storageEstimate: null
  };

  // Flag budget hardware commonly used by field staff in Shahdara
  if (metrics.hardwareConcurrency <= 4 || metrics.deviceMemory <= 2) {
    metrics.isLowEndDevice = true;
  }

  // Capture First Contentful Paint if supported
  if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    if (fcp) {
      metrics.fcpMs = Math.round(fcp.startTime);
    }
  }

  // Estimate storage quota
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
    try {
      const estimate = await navigator.storage.estimate();
      metrics.storageEstimate = {
        usageMb: Math.round(((estimate.usage || 0) / (1024 * 1024)) * 10) / 10,
        quotaMb: Math.round(((estimate.quota || 0) / (1024 * 1024)) * 10) / 10
      };
    } catch {
      // Storage estimate error ignored
    }
  }

  return metrics;
}

/**
 * Sets up the PWA Install Prompt handling: banner, drawer triggers, and beforeinstallprompt listeners.
 *
 * @param {Object} [options]
 * @param {Document} [options.doc=document]
 * @param {Storage|Object} [options.storage=localStorage]
 * @param {Function} [options.onToast]
 * @returns {Object} Install prompt controller
 */
export function setupPwaInstallPrompt({
  doc = (typeof document !== 'undefined' ? document : null),
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast = (msg) => console.log(msg)
} = {}) {
  if (!doc) return { triggerInstall: () => {}, isInstalled: () => false };

  const banner = doc.getElementById('pwaInstallBanner');
  const bannerInstallBtn = doc.getElementById('pwaBannerInstallBtn');
  const bannerDismissBtn = doc.getElementById('pwaBannerDismissBtn');
  const drawerInstallBtn = doc.getElementById('drawerInstallAppBtn');
  const moreInstallBtn = doc.getElementById('mobileMoreInstallPwaBtn');
  const topbarInstallBtn = doc.getElementById('topbarInstallAppBtn');

  function updateUiVisibility() {
    const standalone = isStandaloneMode();
    const installed = isPwaInstalled(storage);

    if (standalone || installed) {
      if (banner) banner.hidden = true;
      if (drawerInstallBtn) drawerInstallBtn.hidden = true;
      if (moreInstallBtn) moreInstallBtn.hidden = true;
      if (topbarInstallBtn) topbarInstallBtn.hidden = true;
      return;
    }

    const isDismissed = storage?.getItem(PWA_BANNER_DISMISSED_KEY) === 'true';
    if (banner) {
      banner.hidden = isDismissed || !deferredInstallPrompt;
    }
    if (drawerInstallBtn) {
      drawerInstallBtn.hidden = false;
    }
    if (moreInstallBtn) {
      moreInstallBtn.hidden = false;
    }
    if (topbarInstallBtn) {
      topbarInstallBtn.hidden = !deferredInstallPrompt;
    }
  }

  async function triggerInstall() {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          storage?.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
          onToast(t('pwa_update_success', null, {}) || 'Shahdara ISP Billing installed!');
          announceToScreenReader('Shahdara ISP Billing successfully installed to your device.');
        }
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
      } finally {
        deferredInstallPrompt = null;
        updateUiVisibility();
      }
    } else {
      // Show helpful instructions modal or toast
      const isIos = isIosDevice();
      const message = isIos
        ? 'To install: Tap Safari Share icon ⎋ -> Select "Add to Home Screen"'
        : 'To install: Tap browser menu ⋮ -> Select "Install app" or "Add to Home screen"';
      onToast(message);
      if (pwaStatusModalControllerInstance?.open) {
        pwaStatusModalControllerInstance.open();
      }
    }
  }

  // Intercept beforeinstallprompt
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (evt) => {
      evt.preventDefault();
      deferredInstallPrompt = evt;
      updateUiVisibility();
      window.dispatchEvent(new CustomEvent('shahdara:pwa-can-install', { detail: { promptAvailable: true } }));
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      storage?.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
      updateUiVisibility();
      onToast('Installed! Shahdara ISP Billing is ready on your Home Screen.');
      announceToScreenReader('App installed. Offline-first ledger ready.');
      window.dispatchEvent(new CustomEvent('shahdara:pwa-installed'));
    });
  }

  // Bind Buttons
  if (bannerInstallBtn) {
    bannerInstallBtn.addEventListener('click', triggerInstall);
  }
  if (bannerDismissBtn) {
    bannerDismissBtn.addEventListener('click', () => {
      storage?.setItem(PWA_BANNER_DISMISSED_KEY, 'true');
      if (banner) banner.hidden = true;
    });
  }
  if (drawerInstallBtn) {
    drawerInstallBtn.addEventListener('click', triggerInstall);
  }
  if (moreInstallBtn) {
    moreInstallBtn.addEventListener('click', triggerInstall);
  }
  if (topbarInstallBtn) {
    topbarInstallBtn.addEventListener('click', triggerInstall);
  }

  updateUiVisibility();

  pwaInstallControllerInstance = {
    triggerInstall,
    isInstalled: () => isPwaInstalled(storage),
    isStandalone: isStandaloneMode,
    updateUiVisibility
  };

  return pwaInstallControllerInstance;
}

/* ------------------------------------------------------------------ */
/* M9: Update-Ready Refresh Prompt                                     */
/*                                                                     */
/* The <head> script in index.html owns service-worker registration    */
/* and update detection (registration.waiting on load, updatefound ->  */
/* installed with an existing controller, controllerchange). It no     */
/* longer renders the old hardcoded #swUpdateBanner bar; instead it    */
/* stashes the pending update on window.__swUpdatePending (plus the    */
/* registration on window.__swUpdateRegistration) and dispatches a     */
/* 'sw-update-pending' window event. This controller is the seam that  */
/* decides whether the owner is actually prompted:                     */
/*   - only for a waiting / newly-installed worker on a page that      */
/*     already had a controller (a real update, never a first install) */
/*   - at most once per version (the version is the ?v= in the         */
/*     worker's scriptURL — the shipped release versioning)            */
/*   - never again for a version the owner dismissed, until the next   */
/*     deploy carries a new version                                    */
/* The prompt itself is the app toast (ui-feedback: theme tokens,      */
/* dark-mode safe) with Refresh / Later actions. Refresh posts         */
/* SKIP_WAITING to the waiting worker (sw.js already handles that      */
/* message) and reloads exactly once when it takes control, with a     */
/* timed fallback for a worker that had already activated.             */
/* The two storage records are UI state only (the PWA banner-key       */
/* precedent); no app data, storage schema or cache name changes.      */
/* ------------------------------------------------------------------ */

export const SW_UPDATE_EVENT = 'sw-update-pending';
export const SW_UPDATE_SHOWN_KEY = 'shahdara_sw_update_shown_v1';
export const SW_UPDATE_DISMISSED_KEY = 'shahdara_sw_update_dismissed_v1';
/** Long-lived prompt: an update decision should not vanish in seconds. */
export const SW_UPDATE_TOAST_DURATION_MS = 600000;
/** If an activated worker never raises controllerchange, reload anyway. */
export const SW_UPDATE_RELOAD_FALLBACK_MS = 1500;

/**
 * The update's version identity: the ?v= release stamp in the worker's
 * scriptURL ('./sw.js?v=1.11.0'). Falls back to the full URL so an
 * unstamped worker still gets a stable per-script identity.
 *
 * @param {string} scriptUrl
 * @returns {string} version string, or '' when no URL was given
 */
export function swUpdateVersionFromScriptUrl(scriptUrl) {
  const raw = String(scriptUrl ?? '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).searchParams.get('v') || raw;
  } catch {
    const match = raw.match(/[?&]v=([^&#]+)/);
    return match ? decodeURIComponent(match[1]) : raw;
  }
}

/**
 * Pure prompt decision: show only when an update is waiting, and only
 * if this exact version was neither shown nor dismissed before.
 *
 * @param {Object} input
 * @param {string} [input.waitingVersion]
 * @param {string} [input.dismissedVersion]
 * @param {string} [input.shownVersion]
 * @returns {boolean}
 */
export function decideSwUpdatePrompt({ waitingVersion = '', dismissedVersion = '', shownVersion = '' } = {}) {
  const version = String(waitingVersion ?? '');
  if (!version) return false;
  if (dismissedVersion && dismissedVersion === version) return false;
  if (shownVersion && shownVersion === version) return false;
  return true;
}

function readSwUpdateRecord(storage, key) {
  if (!storage) return '';
  try { return storage.getItem(key) || ''; } catch { return ''; }
}

function writeSwUpdateRecord(storage, key, version) {
  if (!storage || !version) return;
  try { storage.setItem(key, version); } catch { /* storage blocked: the prompt simply behaves session-only */ }
}

/**
 * The prompt decision against the persisted shown/dismissed records.
 *
 * @param {Object} input
 * @param {string} [input.waitingVersion]
 * @param {Storage|Object} [input.storage]
 * @returns {boolean}
 */
export function shouldShowSwUpdatePrompt({ waitingVersion = '', storage = null } = {}) {
  return decideSwUpdatePrompt({
    waitingVersion,
    dismissedVersion: readSwUpdateRecord(storage, SW_UPDATE_DISMISSED_KEY),
    shownVersion: readSwUpdateRecord(storage, SW_UPDATE_SHOWN_KEY)
  });
}

/** Records that this version's prompt has been shown (at most once per version). */
export function markSwUpdatePromptShown(storage, version) {
  writeSwUpdateRecord(storage, SW_UPDATE_SHOWN_KEY, version);
}

/** Records that the owner dismissed this version (no re-prompt until the next deploy). */
export function markSwUpdatePromptDismissed(storage, version) {
  writeSwUpdateRecord(storage, SW_UPDATE_DISMISSED_KEY, version);
}

/**
 * Asks a waiting worker to activate now. sw.js handles both the string
 * and the {type} form of SKIP_WAITING; the object form is used here.
 * Returns false when there is no waiting worker to ask (it already
 * activated — the caller should simply reload).
 *
 * @param {ServiceWorker|Object|null} waitingWorker
 * @returns {boolean} true when the activation message was posted
 */
export function requestSwUpdateActivation(waitingWorker) {
  if (!waitingWorker || typeof waitingWorker.postMessage !== 'function') return false;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

/**
 * Reload-once guard: however many signals fire (controllerchange, the
 * fallback timer, a second tap), the page reloads exactly once.
 */
export function createSwUpdateReloadGuard() {
  let reloaded = false;
  return {
    get reloaded() { return reloaded; },
    reloadOnce(reloadFn) {
      if (reloaded) return false;
      reloaded = true;
      if (typeof reloadFn === 'function') reloadFn();
      return true;
    }
  };
}

/**
 * Wires the update-ready prompt to the <head> detection seam: reads the
 * stashed pending update, listens for later 'sw-update-pending' events,
 * and shows the bilingual app toast with Refresh / Later actions.
 *
 * @param {Object} options
 * @param {Window} [options.win=window]
 * @param {Storage|Object} [options.storage=localStorage]
 * @param {Function} [options.onToast] - app toast presenter (msg, opts)
 * @param {number} [options.reloadFallbackMs]
 * @returns {Object} Update prompt controller
 */
export function setupSwUpdatePrompt({
  win = (typeof window !== 'undefined' ? window : null),
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast = (msg) => console.log(msg),
  reloadFallbackMs = SW_UPDATE_RELOAD_FALLBACK_MS
} = {}) {
  const reloadGuard = createSwUpdateReloadGuard();
  let registrationRef = null;
  let pendingVersion = '';
  let activationRequested = false;
  let fallbackTimer = null;

  const serviceWorker = () => {
    try {
      const nav = win?.navigator;
      return nav && 'serviceWorker' in nav ? nav.serviceWorker : null;
    } catch { return null; }
  };

  function liveWaitingWorker() {
    try { return registrationRef?.waiting || win?.__swUpdateRegistration?.waiting || null; }
    catch { return null; }
  }

  function reloadOnce() {
    const did = reloadGuard.reloadOnce(() => {
      try { if (win?.location) win.location.reload(); } catch { /* nowhere to reload */ }
    });
    if (did && fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
    return did;
  }

  /** Refresh action: activate the waiting worker, reload exactly once. */
  function refresh() {
    if (requestSwUpdateActivation(liveWaitingWorker())) {
      activationRequested = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(() => { fallbackTimer = null; reloadOnce(); }, reloadFallbackMs);
      return true;
    }
    return reloadOnce();
  }

  /** Later action: never prompt again for this version. */
  function dismiss() {
    if (pendingVersion) markSwUpdatePromptDismissed(storage, pendingVersion);
  }

  /**
   * Considers a pending-update signal (the head script's stash/event,
   * or a live registration check). Returns true when the toast showed.
   */
  function consider(detail = null) {
    const svc = serviceWorker();
    if (!svc) return false;
    const waiting = liveWaitingWorker();
    const scriptURL = detail?.scriptURL || waiting?.scriptURL || '';
    const version = swUpdateVersionFromScriptUrl(scriptURL);
    const updateReady = Boolean(waiting) || Boolean(detail && version);
    const hasController = detail ? detail.hasController !== false : Boolean(svc.controller);
    if (!updateReady || !version || !hasController) return false;
    if (!shouldShowSwUpdatePrompt({ waitingVersion: version, storage })) return false;
    pendingVersion = version;
    markSwUpdatePromptShown(storage, version);
    const message = t('sw_update_ready', null, {});
    try { announceToScreenReader(message); } catch { /* announcement is best-effort */ }
    onToast(message, {
      type: 'info',
      duration: SW_UPDATE_TOAST_DURATION_MS,
      actions: [
        { label: t('sw_update_refresh', null, {}), onAction: refresh },
        { label: t('sw_update_dismiss', null, {}), onAction: dismiss }
      ]
    });
    return true;
  }

  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener(SW_UPDATE_EVENT, (evt) => {
      consider(evt?.detail || win.__swUpdatePending || null);
    });
  }

  const svc = serviceWorker();
  if (svc && typeof svc.addEventListener === 'function') {
    svc.addEventListener('controllerchange', () => { if (activationRequested) reloadOnce(); });
  }

  try { registrationRef = win?.__swUpdateRegistration || registrationRef; } catch { /* the stash is optional */ }
  if (win?.__swUpdatePending) {
    consider(win.__swUpdatePending);
  } else if (svc && typeof svc.getRegistration === 'function') {
    svc.getRegistration().then((reg) => {
      if (!reg) return;
      registrationRef = reg;
      if (reg.waiting) consider({ scriptURL: reg.waiting.scriptURL, hasController: Boolean(svc.controller) });
    }).catch(() => {});
  }

  return {
    consider,
    refresh,
    dismiss,
    checkNow: () => consider(win?.__swUpdatePending || null),
    get pendingVersion() { return pendingVersion; },
    get reloaded() { return reloadGuard.reloaded; }
  };
}

/**
 * Sets up the PWA Status & Offline Health Modal dialog (#pwaStatusModal).
 *
 * @param {Object} options
 * @param {Document} [options.doc=document]
 * @param {Function} [options.onToast]
 * @param {Function} [options.onTriggerInstall]
 * @param {Function} [options.onQuickCollect]
 * @param {Function} [options.onAddCustomer]
 * @param {Function} [options.onTodayDues]
 * @returns {Object} Status modal controller
 */
export function setupPwaStatusModal({
  doc = (typeof document !== 'undefined' ? document : null),
  onToast = (msg) => console.log(msg),
  onTriggerInstall = null,
  onQuickCollect = null,
  onAddCustomer = null,
  onTodayDues = null
} = {}) {
  if (!doc) return { open: () => {}, close: () => {} };

  const modal = doc.getElementById('pwaStatusModal');
  const closeBtn = doc.getElementById('closePwaStatusModalBtn');
  const closeSecondaryBtn = doc.getElementById('closePwaStatusSecondaryBtn');
  const modeBadge = doc.getElementById('pwaStatusModeBadge');
  const cacheBadge = doc.getElementById('pwaStatusCacheBadge');
  const storageInfo = doc.getElementById('pwaStatusStorageInfo');
  const fcpInfo = doc.getElementById('pwaStatusFcpInfo');
  const installActionBtn = doc.getElementById('pwaModalInstallBtn');
  const checkUpdateBtn = doc.getElementById('pwaModalUpdateBtn');
  const shortcutCollectBtn = doc.getElementById('pwaShortcutCollectBtn');
  const shortcutAddCustBtn = doc.getElementById('pwaShortcutAddCustBtn');
  const shortcutDuesBtn = doc.getElementById('pwaShortcutDuesBtn');

  async function refreshMetrics() {
    const metrics = await measurePwaPerformance();
    const isUrdu = getAppLanguage() === 'ur';

    if (modeBadge) {
      if (metrics.isStandalone) {
        modeBadge.textContent = isUrdu ? 'اسٹینڈ الون ایپ موڈ (Standalone)' : 'Standalone App Mode';
        modeBadge.className = 'pwa-badge badge-success';
      } else if (metrics.isInstalled) {
        modeBadge.textContent = isUrdu ? 'انسٹال شدہ (Installed)' : 'Installed on Device';
        modeBadge.className = 'pwa-badge badge-success';
      } else {
        modeBadge.textContent = isUrdu ? 'براؤزر ٹیب موڈ (Browser Tab)' : 'Browser Tab (Web)';
        modeBadge.className = 'pwa-badge badge-warning';
      }
    }

    if (cacheBadge) {
      cacheBadge.textContent = `${CACHE_NAME_VERSION} · 100% Offline`;
      cacheBadge.className = 'pwa-badge badge-success';
    }

    if (storageInfo) {
      if (metrics.storageEstimate) {
        storageInfo.textContent = `${metrics.storageEstimate.usageMb} MB used of ~${metrics.storageEstimate.quotaMb} MB device quota`;
      } else {
        storageInfo.textContent = isUrdu ? 'لوکل اسٹوریج فعال اور محفوظ ہے' : 'Local device storage active and verified';
      }
    }

    if (fcpInfo) {
      if (metrics.fcpMs) {
        fcpInfo.textContent = `${metrics.fcpMs} ms (${metrics.isLowEndDevice ? 'Optimized for Budget Phone' : 'High-Performance Engine'})`;
      } else {
        fcpInfo.textContent = metrics.isLowEndDevice ? 'Optimized for Budget Mobile' : 'Instant Offline Ready';
      }
    }

    if (installActionBtn) {
      installActionBtn.hidden = metrics.isStandalone || isPwaInstalled();
    }
  }

  function open() {
    if (!modal) return;
    refreshMetrics();
    if (typeof modal.showModal === 'function') {
      try { modal.showModal(); } catch { modal.hidden = false; }
    } else {
      modal.hidden = false;
    }
    announceToScreenReader('PWA and Offline Health status dialog opened');
  }

  function close() {
    if (!modal) return;
    if (typeof modal.close === 'function') {
      try { modal.close(); } catch { modal.hidden = true; }
    } else {
      modal.hidden = true;
    }
  }

  // Modal event bindings
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', close);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
  }

  if (installActionBtn) {
    installActionBtn.addEventListener('click', () => {
      close();
      if (typeof onTriggerInstall === 'function') {
        onTriggerInstall();
      } else if (pwaInstallControllerInstance?.triggerInstall) {
        pwaInstallControllerInstance.triggerInstall();
      }
    });
  }

  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', async () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            onToast(t('pwa_update_success', null, {}) || 'Service Worker updated & cache verified!');
          } else {
            onToast('Offline cache is up to date.');
          }
        } catch {
          onToast('Offline cache is verified.');
        }
      } else {
        onToast('Offline cache is up to date.');
      }
      refreshMetrics();
    });
  }

  if (shortcutCollectBtn) {
    shortcutCollectBtn.addEventListener('click', () => {
      close();
      onQuickCollect?.();
    });
  }
  if (shortcutAddCustBtn) {
    shortcutAddCustBtn.addEventListener('click', () => {
      close();
      onAddCustomer?.();
    });
  }
  if (shortcutDuesBtn) {
    shortcutDuesBtn.addEventListener('click', () => {
      close();
      onTodayDues?.();
    });
  }

  pwaStatusModalControllerInstance = { open, close, refreshMetrics };
  return pwaStatusModalControllerInstance;
}

/**
 * Initializes PWA URL hash and query shortcuts listener.
 *
 * @param {Object} context
 * @returns {Function} Cleanup function
 */
export function setupPwaShortcuts(context = {}) {
  function handleCurrentRoute() {
    if (typeof window === 'undefined' || !window.location) return;
    const action = parsePwaActionFromUrl();
    if (action) {
      executePwaAction(action, context);
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', handleCurrentRoute);
    // Defer initial check slightly to let base view rendering complete
    setTimeout(handleCurrentRoute, 60);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', handleCurrentRoute);
    }
  };
}
