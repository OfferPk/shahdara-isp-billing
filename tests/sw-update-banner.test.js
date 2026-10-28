import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const version = JSON.parse(read('package.json')).version;
const index = read('index.html');

test('update banner: shows when a new worker is already waiting on load', () => {
  // The old script only listened for controllerchange, so an update that
  // downloaded while the app was closed never produced a banner on next open.
  assert.ok(index.includes('registration.waiting'), 'index.html must check registration.waiting');
  assert.ok(index.includes('swUpdateBanner'), 'banner element id must exist');
});

test('update banner: shows when an update is found during this session', () => {
  assert.ok(index.includes("addEventListener('updatefound'"), 'index.html must listen for updatefound');
  assert.ok(index.includes("state==='installed'"), 'banner must wait for the new worker to reach installed');
  assert.ok(
    index.includes('navigator.serviceWorker.controller'),
    'updatefound path must require an existing controller (an update, not a first install)'
  );
});

test('update banner: keeps the original banner and controllerchange path', () => {
  assert.ok(index.includes("addEventListener('controllerchange'"), 'controllerchange path must remain');
  assert.ok(index.includes('Naya version tayyar hai'), 'banner text must stay the same');
  assert.ok(index.includes('swUpdateReloadBtn'), 'Reload button id must stay the same');
  assert.ok(index.includes('location.reload()'), 'Reload must reload the page');
});

test('footer version label matches package.json version', () => {
  assert.ok(index.includes('id="appVersionLabel"'), 'footer must carry the version label');
  assert.ok(
    index.includes(`Version ${version}`),
    `footer version must equal package.json version (${version}) so drift fails loudly`
  );
});
