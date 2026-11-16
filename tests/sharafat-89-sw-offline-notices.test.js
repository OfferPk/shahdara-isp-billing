// Sharafat 89 — service-worker offline/failure notices are sent to nobody.
//
// sw.js posts three message types when it cannot serve a file offline
// (SW_PRECACHE_FAILED, SW_OFFLINE_FALLBACK, SW_ASSET_OFFLINE) and until
// this item nothing on the page listened for any of them. The fix wires a
// 'message' listener on navigator.serviceWorker inside setupSwUpdatePrompt
// (nav-pwa.js), beside the controllerchange listener, and shows each
// failure as a non-modal warning toast via the existing onToast channel.
//
// CAUTION — module-scope dedupe: nav-pwa.js dedupes asset-offline toasts
// by URL in a module-scope Set (one toast per distinct file per page
// load), so EVERY handler-level SW_ASSET_OFFLINE dispatch in this file
// must use a DISTINCT asset URL, or a later test is silently deduped.
// Formatter-level tests (swOfflineNoticeMessage) do not touch the Set
// and may reuse URLs freely.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  setupSwUpdatePrompt,
  swOfflineNoticeMessage,
  SW_OFFLINE_TOAST_DURATION_MS
} from '../nav-pwa.js';
import { TRANSLATIONS, t, URDU_SCRIPT_PATTERN } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));

const swSource = read('sw.js');
const navPwaSource = read('nav-pwa.js');

// Same mock shape as tests/plan-g-offline-reliability.test.js
// createPromptWindow: the fake ServiceWorkerContainer records every
// addEventListener call so a test can dispatch a synthetic 'message'.
function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
}

function createWindow() {
  const listeners = new Map();
  const serviceWorker = {
    controller: {},
    addEventListener: (type, cb) => listeners.set(type, (listeners.get(type) || []).concat(cb)),
    getRegistration: async () => null
  };
  const win = {
    navigator: { serviceWorker },
    location: { reloads: 0, reload() { this.reloads += 1; } },
    addEventListener: (type, cb) => listeners.set(type, (listeners.get(type) || []).concat(cb)),
    dispatchEvent: (evt) => { (listeners.get(evt.type) || []).forEach((cb) => cb(evt)); return true; },
    document: {
      querySelector: () => null,
      addEventListener: (type, cb) => listeners.set(type, (listeners.get(type) || []).concat(cb))
    }
  };
  return { win, serviceWorker, listeners };
}

function setupNotices({ isBusy = () => false, pending = undefined } = {}) {
  const { win, listeners } = createWindow();
  if (pending !== undefined) win.__swUpdatePending = pending;
  const toasts = [];
  setupSwUpdatePrompt({
    win,
    storage: createMockStorage(),
    onToast: (msg, opts) => toasts.push({ msg, opts }),
    isBusy
  });
  return { win, listeners, toasts };
}

function dispatchServiceWorkerMessage(listeners, data) {
  for (const cb of listeners.get('message') || []) cb({ data });
}

const OFFLINE_KEYS = ['sw_offline_asset', 'sw_offline_fallback', 'sw_offline_precache'];

/* ------------------------------- wiring ------------------------------- */

test('Sharafat 89 wiring: setupSwUpdatePrompt registers a message listener on navigator.serviceWorker', async () => {
  const { listeners } = setupNotices();
  await tick();
  assert.ok((listeners.get('message') || []).length >= 1, 'a message listener must be registered');
});

test('Sharafat 89 wiring: SW_ASSET_OFFLINE shows a notice naming the failed file', async () => {
  const { listeners, toasts } = setupNotices();
  await tick();
  dispatchServiceWorkerMessage(listeners, {
    type: 'SW_ASSET_OFFLINE',
    url: 'https://offerpk.github.io/shahdara-isp-billing/app.js?v=1.11.0',
    cache: 'shahdara-isp-billing-v37'
  });
  await tick();
  assert.equal(toasts.length, 1, 'exactly one notice');
  assert.equal(toasts[0].msg, t('sw_offline_asset', 'en', { file: 'app.js' }));
  assert.equal(toasts[0].opts.type, 'warning');
  assert.equal(toasts[0].opts.duration, SW_OFFLINE_TOAST_DURATION_MS);
});

test('Sharafat 89 wiring: SW_OFFLINE_FALLBACK shows a notice (cached shell)', async () => {
  const { listeners, toasts } = setupNotices();
  await tick();
  dispatchServiceWorkerMessage(listeners, {
    type: 'SW_OFFLINE_FALLBACK',
    url: 'https://offerpk.github.io/shahdara-isp-billing/',
    cache: 'shahdara-isp-billing-v37'
  });
  await tick();
  assert.equal(toasts.length, 1, 'exactly one notice');
  assert.equal(toasts[0].msg, t('sw_offline_fallback', 'en'));
  assert.equal(toasts[0].opts.type, 'warning');
  assert.equal(toasts[0].opts.duration, SW_OFFLINE_TOAST_DURATION_MS);
});

test('Sharafat 89 wiring: SW_PRECACHE_FAILED shows a notice', async () => {
  const { listeners, toasts } = setupNotices();
  await tick();
  dispatchServiceWorkerMessage(listeners, {
    type: 'SW_PRECACHE_FAILED',
    cache: 'shahdara-isp-billing-v37',
    error: 'TypeError: Failed to fetch'
  });
  await tick();
  assert.equal(toasts.length, 1, 'exactly one notice');
  assert.equal(toasts[0].msg, t('sw_offline_precache', 'en'));
  assert.equal(toasts[0].opts.type, 'warning');
  assert.equal(toasts[0].opts.duration, SW_OFFLINE_TOAST_DURATION_MS);
});

test('Sharafat 89 wiring: offline notices use an 8000 ms warning toast', () => {
  assert.equal(SW_OFFLINE_TOAST_DURATION_MS, 8000, 'warning-toast duration is the app.js:1866 precedent');
});

/* --------------------------- i18n: dict coverage --------------------------- */

test('Sharafat 89 i18n: all three sw_offline_* keys exist in both dicts and are non-empty', () => {
  for (const key of OFFLINE_KEYS) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `en missing ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en ${key} must not fall back to the raw key`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur ${key} must not fall back to the raw key`);
  }
});

test('Sharafat 89 i18n: English values are the prep §4.3 wording', () => {
  assert.equal(
    TRANSLATIONS.en.sw_offline_asset,
    'Offline — {file} could not be loaded. The app is running from its saved copy.'
  );
  assert.equal(
    TRANSLATIONS.en.sw_offline_fallback,
    'Offline — this page could not be loaded fresh. Showing the saved copy.'
  );
  assert.equal(
    TRANSLATIONS.en.sw_offline_precache,
    'Offline cache could not be built. The app is running from the last good copy.'
  );
});

test('Sharafat 89 i18n: Urdu values are the prep §4.3 proposals and carry Urdu script', () => {
  assert.equal(
    TRANSLATIONS.ur.sw_offline_asset,
    'آف لائن — {file} لوڈ نہیں ہو سکی۔ ایپ اپنی محفوظ کاپی سے چل رہی ہے۔'
  );
  assert.equal(
    TRANSLATIONS.ur.sw_offline_fallback,
    'آف لائن — یہ صفحہ تازہ لوڈ نہیں ہو سکا۔ محفوظ کاپی دکھائی جا رہی ہے۔'
  );
  assert.equal(
    TRANSLATIONS.ur.sw_offline_precache,
    'آف لائن کیش نہیں بن سکا۔ ایپ آخری درست کاپی سے چل رہی ہے۔'
  );
  for (const key of OFFLINE_KEYS) {
    assert.ok(URDU_SCRIPT_PATTERN.test(TRANSLATIONS.ur[key]), `${key}: ur value must carry Urdu script`);
  }
  // {file} param agreement: only the asset key takes a file, in both languages.
  const paramsOf = (value) => [...new Set(value.match(/\{[^}]+\}/g) || [])].sort();
  for (const key of OFFLINE_KEYS) {
    assert.deepEqual(paramsOf(TRANSLATIONS.ur[key]), paramsOf(TRANSLATIONS.en[key]), `${key}: en/ur params must agree`);
  }
});

/* ------------------------- formatter: naming + i18n ------------------------- */

test('Sharafat 89 formatter: Urdu mode renders Urdu script for all three types', () => {
  assert.equal(
    swOfflineNoticeMessage({ type: 'SW_ASSET_OFFLINE', url: 'https://offerpk.github.io/shahdara-isp-billing/app.js?v=1.11.0' }, 'ur'),
    t('sw_offline_asset', 'ur', { file: 'app.js' })
  );
  assert.equal(
    swOfflineNoticeMessage({ type: 'SW_OFFLINE_FALLBACK', url: 'https://offerpk.github.io/shahdara-isp-billing/' }, 'ur'),
    t('sw_offline_fallback', 'ur')
  );
  assert.equal(
    swOfflineNoticeMessage({ type: 'SW_PRECACHE_FAILED' }, 'ur'),
    t('sw_offline_precache', 'ur')
  );
  for (const type of ['SW_ASSET_OFFLINE', 'SW_OFFLINE_FALLBACK', 'SW_PRECACHE_FAILED']) {
    assert.ok(
      URDU_SCRIPT_PATTERN.test(swOfflineNoticeMessage({ type, url: 'https://billing.example/app.js' }, 'ur')),
      `${type}: ur rendering must carry Urdu script`
    );
  }
});

test('Sharafat 89 formatter: default language is English', () => {
  assert.equal(
    swOfflineNoticeMessage({ type: 'SW_ASSET_OFFLINE', url: 'https://offerpk.github.io/shahdara-isp-billing/app.js?v=1.11.0' }),
    t('sw_offline_asset', 'en', { file: 'app.js' })
  );
  assert.equal(
    swOfflineNoticeMessage({ type: 'SW_OFFLINE_FALLBACK', url: 'https://offerpk.github.io/shahdara-isp-billing/' }),
    t('sw_offline_fallback', 'en')
  );
});

test('Sharafat 89 formatter: the notice names the file by basename, never the raw URL', () => {
  const message = swOfflineNoticeMessage({
    type: 'SW_ASSET_OFFLINE',
    url: 'https://offerpk.github.io/shahdara-isp-billing/assets/chunk-abc.js?v=1.11.0'
  });
  assert.ok(message.includes('chunk-abc.js'), 'basename is named');
  assert.ok(!message.includes('offerpk.github.io'), 'origin must not leak into the toast');
  assert.ok(!message.includes('?v='), 'the ?v= stamp must not leak into the toast');
  assert.ok(!message.includes('https://'), 'no raw URL in the toast');
});

test('Sharafat 89 formatter: a navigation URL yields the fallback wording with no file name', () => {
  const message = swOfflineNoticeMessage({ type: 'SW_OFFLINE_FALLBACK', url: 'https://offerpk.github.io/shahdara-isp-billing/' });
  assert.equal(message, t('sw_offline_fallback', 'en'));
  assert.ok(!message.includes('offerpk.github.io'), 'the navigation URL must not leak into the toast');
});

test('Sharafat 89 formatter: an unparseable or missing URL falls back to the generic word, never the raw string', () => {
  const unparseable = swOfflineNoticeMessage({ type: 'SW_ASSET_OFFLINE', url: '::not-a-url::' });
  assert.equal(unparseable, t('sw_offline_asset', 'en', { file: 'file' }));
  assert.ok(!unparseable.includes('::not-a-url::'), 'the raw string must never be shown');
  const missing = swOfflineNoticeMessage({ type: 'SW_ASSET_OFFLINE' });
  assert.equal(missing, t('sw_offline_asset', 'en', { file: 'file' }));
});

test('Sharafat 89 formatter: an unknown message type returns empty (shows nothing)', () => {
  assert.equal(swOfflineNoticeMessage({ type: 'SW_SOMETHING_ELSE', url: 'https://billing.example/x.js' }), '');
  assert.equal(swOfflineNoticeMessage({}), '');
  assert.equal(swOfflineNoticeMessage(null), '');
});

/* ------------------------------- dedupe + busy ------------------------------- */

test('Sharafat 89 dedupe: the same failed file toasts once, a different file toasts again', async () => {
  const { listeners, toasts } = setupNotices();
  await tick();
  const first = { type: 'SW_ASSET_OFFLINE', url: 'https://billing.example/chunk-a.js?v=1.11.0', cache: 'shahdara-isp-billing-v37' };
  const second = { type: 'SW_ASSET_OFFLINE', url: 'https://billing.example/chunk-b.js?v=1.11.0', cache: 'shahdara-isp-billing-v37' };
  dispatchServiceWorkerMessage(listeners, first);
  dispatchServiceWorkerMessage(listeners, first);
  await tick();
  assert.equal(toasts.length, 1, 'the repeat of the same URL is deduped');
  dispatchServiceWorkerMessage(listeners, second);
  await tick();
  assert.equal(toasts.length, 2, 'a different file is a different failure and toasts again');
  assert.ok(toasts[1].msg.includes('chunk-b.js'));
});

test('Sharafat 89 busy: the notice still shows while the operator is mid-entry', async () => {
  // Deliberate non-application of the Plan G busy rule (D6): the rule
  // guards the update prompt because its Refresh action RELOADS the page
  // (destructive mid-entry). This notice is a non-modal informational
  // toast with no action — hiding it would hide a failure the operator
  // should know about (a file failing to load while a payment is being
  // recorded). Pinned so a reviewer cannot "fix" it into the busy check.
  const { listeners, toasts } = setupNotices({ isBusy: () => true });
  await tick();
  dispatchServiceWorkerMessage(listeners, {
    type: 'SW_ASSET_OFFLINE',
    url: 'https://offerpk.github.io/shahdara-isp-billing/nav-pwa.js',
    cache: 'shahdara-isp-billing-v37'
  });
  await tick();
  assert.equal(toasts.length, 1, 'the notice is not gated by the busy rule');
});

/* -------------------------------- guards -------------------------------- */

test('Sharafat 89 guard: sw.js still posts all three types and still returns the bare 503', () => {
  assert.ok(/SW_PRECACHE_FAILED/.test(swSource), 'sw.js still posts SW_PRECACHE_FAILED');
  assert.ok(/SW_ASSET_OFFLINE/.test(swSource), 'sw.js still posts SW_ASSET_OFFLINE');
  assert.ok(/SW_OFFLINE_FALLBACK/.test(swSource), 'sw.js still posts SW_OFFLINE_FALLBACK');
  assert.ok(
    /new Response\('Offline — file unavailable', \{ status: 503/.test(swSource),
    'the offline asset is still a bare 503, never the app shell'
  );
});

test('Sharafat 89 guard: an unknown message type shows no notice', async () => {
  const { listeners, toasts } = setupNotices();
  await tick();
  dispatchServiceWorkerMessage(listeners, { type: 'SW_SOMETHING_ELSE', url: 'https://billing.example/x.js' });
  await tick();
  assert.equal(toasts.length, 0, 'unknown types stay silent');
});

test('Sharafat 89 guard: the update prompt still works (pending V2 → exactly one toast)', async () => {
  const { toasts } = setupNotices({
    pending: { scriptURL: 'https://offerpk.github.io/shahdara-isp-billing/sw.js?v=2.0.0', hasController: true }
  });
  await tick();
  assert.equal(toasts.length, 1, 'the update prompt is untouched by the new listener');
});

test('Sharafat 89 guard: nav-pwa.js adds no 6-digit hex colour literal', () => {
  assert.ok(!/#[0-9a-fA-F]{6}\b/.test(navPwaSource), 'the notice reuses the app toast (theme tokens only)');
});
