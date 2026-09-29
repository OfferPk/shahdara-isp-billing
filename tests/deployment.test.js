import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const version = JSON.parse(read('package.json')).version;
const index = read('index.html');
const app = read('app.js');
const worker = read('sw.js');

test('web shell assets share the package version and worker updates before app startup', () => {
  assert.match(index, new RegExp(`href="\\./styles\\.css\\?v=${version.replaceAll('.', '\\.') }"`));
  assert.match(index, new RegExp(`src="\\./app\\.js\\?v=${version.replaceAll('.', '\\.') }"`));
  assert.match(app, new RegExp(`from '\\./core\\.js\\?v=${version.replaceAll('.', '\\.') }'`));
  const register = index.indexOf(`navigator.serviceWorker.register('./sw.js?v=${version}'`);
  const appModule = index.indexOf(`type="module" src="./app.js?v=${version}"`);
  assert.ok(register >= 0 && register < index.indexOf('<body>'), 'service worker registration belongs in the HTML head');
  assert.ok(appModule > index.indexOf('<body>'), 'app module loads after worker registration markup');
  assert.match(worker, /CACHE_NAME\s*=\s*'shahdara-isp-billing-v4'/);
  assert.match(worker, /caches\.match\(event\.request\s*,\s*\{\s*ignoreSearch\s*:\s*true\s*\}\)/);
  for (const asset of ['./','./index.html','./styles.css','./app.js','./core.js','./manifest.webmanifest','./icon.svg']) assert.ok(worker.includes(`'${asset}'`), `offline cache includes ${asset}`);
});

test('customer-list empty-state renderer tolerates mismatched cached markup without aborting the app', () => {
  assert.match(app, /const emptySearch\s*=\s*\$\('#noSearchResults'\);\s*if \(emptySearch\) emptySearch\.hidden\s*=/);
});
