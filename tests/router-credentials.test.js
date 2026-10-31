// SISP-94: Customer Router Wi-Fi SSID / Password & Remote Admin Port
// Vault. Pure-function + core-storage tests on SYNTHETIC data only —
// every credential below is an invented fixture, never a real record.
// Spec test criteria (verbatim): "Saving wifiSsid and wifiPassword
// masks the password in UI by default, reveals/copies on toggle, and
// persists in JSON backups."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, addCustomer, updateCustomerProfile,
  createJsonBackup, previewJsonBackupMerge, persistState, readState
} from '../core.js';
import {
  ROUTER_CREDENTIAL_MASK, normalizeRouterAdminPort, routerCredentialsOf,
  maskSecret, routerCredentialsSectionHtml, buildWifiDetailsWhatsAppDraft,
  resolveWifiWhatsAppAction
} from '../router-credentials.js';
import { buildCustomerMikrotikSnippet } from '../mikrotik-generator.js';
import { TRANSLATIONS } from '../nav-language.js';
import { collectRuntimeFiles } from '../build.mjs';

const REF = new Date('2026-10-29T00:00:00Z');
const CREDS = Object.freeze({
  wifiSsid: 'TestHome-5G',
  wifiPassword: 'synthetic-wifi-pass-1',
  routerAdminPort: 8080,
  routerAdminPassword: 'synthetic-admin-pass-2'
});
const PHONE = '+92 300 1112233';

const withCustomer = (options = {}) => {
  const state = addCustomer(createInitialState([]), 'Vault Test Customer', REF, { phone: PHONE, ...options });
  return { state, customer: state.customers[0] };
};

test('core: addCustomer stores the four vault fields; defaults are empty / null', () => {
  const { customer } = withCustomer(CREDS);
  assert.equal(customer.wifiSsid, CREDS.wifiSsid);
  assert.equal(customer.wifiPassword, CREDS.wifiPassword);
  assert.equal(customer.routerAdminPort, 8080);
  assert.equal(customer.routerAdminPassword, CREDS.routerAdminPassword);

  const { customer: plain } = withCustomer();
  assert.equal(plain.wifiSsid, '');
  assert.equal(plain.wifiPassword, '');
  assert.equal(plain.routerAdminPort, null);
  assert.equal(plain.routerAdminPassword, '');
});

test('core: vault field validation — port range and text limits throw', () => {
  for (const bad of [0, 65536, 70000.5, 'abc', -1]) {
    assert.throws(() => withCustomer({ routerAdminPort: bad }), /Router admin port must be between 1 and 65535/, `port ${bad}`);
  }
  assert.throws(() => withCustomer({ wifiSsid: 'x'.repeat(65) }), /Wi-Fi SSID must be 64 characters or fewer/);
  assert.throws(() => withCustomer({ wifiPassword: 'x'.repeat(101) }), /Wi-Fi password must be 100 characters or fewer/);
  assert.throws(() => withCustomer({ routerAdminPassword: 'x'.repeat(101) }), /Router admin password must be 100 characters or fewer/);
  // Boundary ports are accepted.
  assert.equal(withCustomer({ routerAdminPort: 1 }).customer.routerAdminPort, 1);
  assert.equal(withCustomer({ routerAdminPort: 65535 }).customer.routerAdminPort, 65535);
  // A string port from a form field is coerced.
  assert.equal(withCustomer({ routerAdminPort: '8080' }).customer.routerAdminPort, 8080);
});

test('core: updateCustomerProfile edits, clears and preserves vault fields', () => {
  const { state, customer } = withCustomer();
  const updated = updateCustomerProfile(state, customer.id, { ...CREDS }, REF);
  const saved = updated.customers[0];
  assert.equal(saved.wifiSsid, CREDS.wifiSsid);
  assert.equal(saved.wifiPassword, CREDS.wifiPassword);
  assert.equal(saved.routerAdminPort, 8080);
  assert.equal(saved.routerAdminPassword, CREDS.routerAdminPassword);

  // Omitting the keys leaves the stored values untouched.
  const renamed = updateCustomerProfile(updated, customer.id, { zone: 'North' }, REF);
  assert.equal(renamed.customers[0].wifiPassword, CREDS.wifiPassword);
  assert.equal(renamed.customers[0].routerAdminPort, 8080);

  // Clearing works: empty string port returns to null.
  const cleared = updateCustomerProfile(updated, customer.id, { routerAdminPort: '', wifiPassword: '' }, REF);
  assert.equal(cleared.customers[0].routerAdminPort, null);
  assert.equal(cleared.customers[0].wifiPassword, '');

  assert.throws(() => updateCustomerProfile(state, customer.id, { routerAdminPort: 99999 }, REF), /Router admin port/);
});

test('backup: vault fields persist through a JSON backup round-trip', () => {
  const { state, customer } = withCustomer(CREDS);
  // localStorage persistence rides the state object wholesale.
  const data = new Map();
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  };
  persistState(state, storage);
  const restored = readState(storage);
  assert.equal(restored.customers[0].wifiPassword, CREDS.wifiPassword);
  assert.equal(restored.customers[0].routerAdminPort, 8080);

  // JSON backup: fields are in the document and merge back intact.
  const backupText = createJsonBackup(state, REF);
  const backupCustomer = JSON.parse(backupText).state.customers[0];
  assert.equal(backupCustomer.wifiSsid, CREDS.wifiSsid);
  assert.equal(backupCustomer.wifiPassword, CREDS.wifiPassword);
  assert.equal(backupCustomer.routerAdminPort, 8080);
  assert.equal(backupCustomer.routerAdminPassword, CREDS.routerAdminPassword);

  const merged = previewJsonBackupMerge(createInitialState([]), backupText);
  const mergedCustomer = (merged.state?.customers ?? []).find(c => c.id === customer.id);
  assert.ok(mergedCustomer, 'merged state carries the customer');
  assert.equal(mergedCustomer.wifiSsid, CREDS.wifiSsid);
  assert.equal(mergedCustomer.wifiPassword, CREDS.wifiPassword);
  assert.equal(mergedCustomer.routerAdminPort, 8080);
  assert.equal(mergedCustomer.routerAdminPassword, CREDS.routerAdminPassword);
});

test('backup: merge fills vault fields onto an existing profile that lacks them', () => {
  const { state, customer } = withCustomer(CREDS);
  const backupText = createJsonBackup(state, REF);
  const stripped = { ...customer, wifiSsid: '', wifiPassword: '', routerAdminPort: null, routerAdminPassword: '' };
  const local = { ...createInitialState([]), customers: [stripped], nextCustomerNumber: customer.customerNumber + 1 };
  const merged = previewJsonBackupMerge(local, backupText);
  const filled = (merged.state?.customers ?? []).find(c => c.id === customer.id);
  assert.equal(filled.wifiSsid, CREDS.wifiSsid);
  assert.equal(filled.wifiPassword, CREDS.wifiPassword);
  assert.equal(filled.routerAdminPort, 8080);
  assert.equal(filled.routerAdminPassword, CREDS.routerAdminPassword);
});

test('backup: a malformed admin port in a backup is rejected, not imported', () => {
  const { state } = withCustomer(CREDS);
  const doc = JSON.parse(createJsonBackup(state, REF));
  doc.state.customers[0].routerAdminPort = 70000;
  assert.throws(() => previewJsonBackupMerge(createInitialState([]), JSON.stringify(doc)), /invalid router admin port/);
  doc.state.customers[0].routerAdminPort = 8080;
  doc.state.customers[0].wifiPassword = 'x'.repeat(101);
  assert.throws(() => previewJsonBackupMerge(createInitialState([]), JSON.stringify(doc)), /invalid Wi-Fi password/);
});

test('module: routerCredentialsOf normalizes stored values defensively', () => {
  const creds = routerCredentialsOf({ wifiSsid: '  My Net  ', wifiPassword: ' pw ', routerAdminPort: '8080', routerAdminPassword: ' x ' });
  assert.equal(creds.wifiSsid, 'My Net');
  assert.equal(creds.wifiPassword, 'pw');
  assert.equal(creds.routerAdminPort, 8080);
  assert.equal(creds.hasAny, true);
  assert.equal(creds.hasWifiDetails, true);

  assert.equal(normalizeRouterAdminPort(80.5), null);
  assert.equal(normalizeRouterAdminPort(99999), null);
  assert.equal(normalizeRouterAdminPort(''), null);
  const empty = routerCredentialsOf({});
  assert.equal(empty.hasAny, false);
  assert.equal(empty.routerAdminPort, null);
  assert.equal(routerCredentialsOf(null).hasAny, false);
});

test('module: mask is fixed-length and never leaks the secret length', () => {
  assert.equal(maskSecret('a'), ROUTER_CREDENTIAL_MASK);
  assert.equal(maskSecret('a-much-longer-secret-value'), ROUTER_CREDENTIAL_MASK);
  assert.equal(maskSecret(''), '');
  assert.equal(maskSecret(null), '');
  assert.equal(maskSecret(undefined), '');
});

test('section: passwords are masked by default and appear NOWHERE in the markup', () => {
  const { customer } = withCustomer(CREDS);
  const html = routerCredentialsSectionHtml(customer);
  assert.ok(html.includes(CREDS.wifiSsid), 'SSID shown in plain text');
  assert.ok(html.includes('8080'), 'admin port shown');
  assert.ok(html.includes(ROUTER_CREDENTIAL_MASK), 'mask shown');
  assert.ok(!html.includes(CREDS.wifiPassword), 'Wi-Fi password must not appear in masked markup');
  assert.ok(!html.includes(CREDS.routerAdminPassword), 'admin password must not appear in masked markup');
  assert.ok(html.includes('data-rcred-toggle="wifi"'), 'Wi-Fi eye toggle present');
  assert.ok(html.includes('data-rcred-toggle="admin"'), 'admin eye toggle present');
  assert.ok(html.includes('data-rcred-copy="wifi"'), 'Wi-Fi copy button present');
  assert.ok(html.includes('data-rcred-copy="admin"'), 'admin copy button present');
  assert.ok(html.includes('aria-pressed="false"'), 'toggles start unpressed');
});

test('section: reveal flags reveal only their own secret (the eye toggle states)', () => {
  const { customer } = withCustomer(CREDS);
  const wifiShown = routerCredentialsSectionHtml(customer, { revealWifi: true });
  assert.ok(wifiShown.includes(CREDS.wifiPassword), 'revealed Wi-Fi password renders');
  assert.ok(!wifiShown.includes(CREDS.routerAdminPassword), 'admin password stays masked');

  const adminShown = routerCredentialsSectionHtml(customer, { revealAdmin: true });
  assert.ok(adminShown.includes(CREDS.routerAdminPassword), 'revealed admin password renders');
  assert.ok(!adminShown.includes(CREDS.wifiPassword), 'Wi-Fi password stays masked');

  const both = routerCredentialsSectionHtml(customer, { revealWifi: true, revealAdmin: true });
  assert.ok(both.includes(CREDS.wifiPassword) && both.includes(CREDS.routerAdminPassword));
});

test('section: empty vault shows Not set rows and no WhatsApp action', () => {
  const { customer } = withCustomer();
  const html = routerCredentialsSectionHtml(customer);
  assert.ok(!html.includes('profileWifiWhatsappBtn'), 'no send button without details');
  assert.ok(!html.includes('Add a mobile number'), 'no phone note without details');
  assert.ok(!html.includes('data-rcred-toggle'), 'no toggles without secrets');
});

test('section: details without a usable mobile show the explanatory note, not a dead button', () => {
  const { customer } = withCustomer({ ...CREDS, phone: '' });
  const html = routerCredentialsSectionHtml(customer);
  assert.ok(!html.includes('profileWifiWhatsappBtn'), 'button hidden without a mobile');
  assert.ok(html.includes('Add a mobile number on this profile'), 'note explains what to do');

  const action = resolveWifiWhatsAppAction(customer);
  assert.equal(action.type, 'phone-required');
  assert.equal(action.hasSavedPhone, false);
});

test('whatsapp: draft carries SSID + Wi-Fi password to the recorded mobile only on demand', () => {
  const { customer } = withCustomer(CREDS);
  const action = resolveWifiWhatsAppAction(customer);
  assert.equal(action.type, 'draft');
  const { draft } = action;
  assert.ok(draft.url.startsWith('https://wa.me/923001112233?text='), 'wa.me draft targets the recorded mobile');
  const text = decodeURIComponent(draft.url.slice(draft.url.indexOf('?text=') + 6));
  assert.equal(text, draft.message);
  assert.ok(draft.message.includes(CREDS.wifiSsid), 'draft includes the SSID');
  assert.ok(draft.message.includes(CREDS.wifiPassword), 'draft includes the Wi-Fi password');
  // The ADMIN password and port are the operator's, not the customer's —
  // they never ride the WhatsApp draft.
  assert.ok(!draft.message.includes(CREDS.routerAdminPassword), 'admin password never sent');
  assert.ok(!draft.message.includes('8080'), 'admin port never sent');

  assert.equal(buildWifiDetailsWhatsAppDraft({ ...customer, phone: '' }), null, 'no draft without a mobile');
  assert.equal(buildWifiDetailsWhatsAppDraft({ ...customer, wifiSsid: '', wifiPassword: '' }), null, 'no draft without details');
  assert.equal(resolveWifiWhatsAppAction({ ...customer, wifiSsid: '', wifiPassword: '' }).type, 'unavailable');
});

test('mikrotik: admin port rides the snippet as a note; the admin password never does', () => {
  const { customer } = withCustomer({ ...CREDS, packageSpeed: '5Mbps / 150GB' });
  const snippet = buildCustomerMikrotikSnippet(customer);
  assert.ok(snippet.includes('remote admin port 8080'), 'port note present');
  assert.ok(!snippet.includes(CREDS.routerAdminPassword), 'admin password must never enter the copyable script');

  const { customer: noPort } = withCustomer({ wifiSsid: CREDS.wifiSsid });
  assert.ok(!buildCustomerMikrotikSnippet(noPort).includes('remote admin port'), 'no note without a stored port');
});

test('i18n: every rcred_* key used in code and markup exists in both dictionaries', () => {
  const moduleSource = readFileSync(new URL('../router-credentials.js', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = new Set();
  for (const m of moduleSource.matchAll(/t\('(rcred_[a-z_]+)'/g)) used.add(m[1]);
  for (const m of appSource.matchAll(/t\('(rcred_[a-z_]+)'/g)) used.add(m[1]);
  for (const m of indexHtml.matchAll(/data-i18n(?:-placeholder)?="(rcred_[a-z_]+)"/g)) used.add(m[1]);
  assert.ok(used.size >= 20, `expected at least 20 rcred keys, found ${used.size}`);
  for (const key of used) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en missing ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en ${key} resolves to itself`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur ${key} resolves to itself`);
  }
});

test('wiring: app imports the module, form fields exist, CSS is token-only, runtime graph reaches the module', async () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');

  assert.ok(appSource.includes("from './router-credentials.js"), 'app.js imports router-credentials.js');
  assert.ok(appSource.includes('routerCredentialsSectionHtml(customer'), 'profile renders the vault section');
  assert.ok(appSource.includes('wireRouterCredSection'), 'profile wires the vault controls');
  for (const id of ['wifiSsidInput', 'wifiPasswordInput', 'routerAdminPortInput', 'routerAdminPasswordInput']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html has #${id}`);
    assert.ok(appSource.includes(`$('#${id}')`), `app.js fills/saves #${id}`);
  }
  assert.ok(indexHtml.includes('id="wifiPasswordInput" type="password"'), 'Wi-Fi password input is a password field');
  assert.ok(indexHtml.includes('id="routerAdminPasswordInput" type="password"'), 'admin password input is a password field');

  const cssBlock = css.slice(css.indexOf('/* SISP-94'), css.indexOf('/* SISP-20'));
  assert.ok(cssBlock.includes('.profile-router-cred-section'), 'vault CSS present');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(cssBlock), 'vault CSS uses theme tokens only, no hex');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('router-credentials.js'), 'module is reachable in the build runtime graph');
});
