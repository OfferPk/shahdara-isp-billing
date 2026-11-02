import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const version = JSON.parse(read('package.json')).version;
const index = read('index.html');
const head = index.slice(0, index.indexOf('<body>'));
const navPwa = read('nav-pwa.js');
const navLanguage = read('nav-language.js');

test('update detection: head script checks registration.waiting on load', () => {
  // The old script only listened for controllerchange, so an update that
  // downloaded while the app was closed never surfaced on next open.
  // M9: the head script still detects, but it stashes the pending update
  // for the nav-pwa prompt controller instead of rendering a bar itself.
  assert.ok(head.includes('registration.waiting'), 'index.html must check registration.waiting');
  assert.ok(head.includes('__swUpdatePending'), 'the pending update must be stashed for the prompt controller');
});

test('update detection: an update found during this session is stashed', () => {
  assert.ok(head.includes("addEventListener('updatefound'"), 'index.html must listen for updatefound');
  assert.ok(head.includes("state==='installed'"), 'detection must wait for the new worker to reach installed');
  assert.ok(
    head.includes('navigator.serviceWorker.controller'),
    'updatefound path must require an existing controller (an update, not a first install)'
  );
});

test('update detection: controllerchange re-notifies the prompt controller', () => {
  assert.ok(head.includes("addEventListener('controllerchange'"), 'controllerchange path must remain');
  assert.ok(head.includes('sw-update-pending'), 'controllerchange must re-dispatch the pending-update event');
  assert.ok(!head.includes('swUpdateBanner'), 'the hardcoded #swUpdateBanner bar is gone (M9)');
});

test('update prompt: nav-pwa owns the bilingual toast, activation and reload (M9)', () => {
  assert.ok(navPwa.includes('setupSwUpdatePrompt'), 'nav-pwa.js must own the update prompt controller');
  assert.ok(navPwa.includes("t('sw_update_ready'"), 'prompt text must come from the language dictionary');
  assert.ok(navLanguage.includes('Naya version tayyar hai'), 'the friendly banner phrase lives on in the en dictionary value');
  assert.ok(navPwa.includes('SKIP_WAITING'), 'Refresh must ask the waiting worker to activate');
  assert.ok(navPwa.includes('location.reload()'), 'Refresh must reload the page');
});

test('footer version label matches package.json version', () => {
  assert.ok(index.includes('id="appVersionLabel"'), 'footer must carry the version label');
  assert.ok(
    index.includes(`Version ${version}`),
    `footer version must equal package.json version (${version}) so drift fails loudly`
  );
});
