// SISP-113: 100% offline MAC OUI vendor lookup + randomized-MAC guard.
// Pure-module tests on synthetic MACs only. Pinned spec criteria:
// C8:3A:35:11:22:33 badges "Tenda"; 02:11:22:33:44:55 triggers the
// randomized mobile MAC warning. Display only — never blocks saving,
// never mutates the stored MAC, unknown OUIs show nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAC_OUI_VENDORS,
  isFullMacAddress,
  isRandomizedMac,
  macOuiLookup,
  macOuiPrefix,
  macOuiVendor,
  normalizeMacHex
} from '../mac-oui-lookup.js';
import { macAddressDisplaySuffix, macOuiHintHtml } from '../profile-ui.js';
import { buildCustomerMikrotikSnippet } from '../mikrotik-generator.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('spec pin: C8:3A:35:11:22:33 badges Tenda everywhere', () => {
  assert.equal(macOuiVendor('C8:3A:35:11:22:33'), 'Tenda');
  assert.equal(macOuiPrefix('C8:3A:35:11:22:33'), 'C83A35');
  assert.equal(isRandomizedMac('C8:3A:35:11:22:33'), false);
  assert.match(macOuiHintHtml('C8:3A:35:11:22:33'), /mac-oui-badge/);
  assert.match(macOuiHintHtml('C8:3A:35:11:22:33'), /Tenda/);
  assert.match(macAddressDisplaySuffix('C8:3A:35:11:22:33'), /Tenda/);
});

test('spec pin: 02:11:22:33:44:55 triggers the randomized mobile MAC warning', () => {
  assert.equal(isRandomizedMac('02:11:22:33:44:55'), true);
  assert.match(macOuiHintHtml('02:11:22:33:44:55'), /mac-oui-warning/);
  assert.match(macOuiHintHtml('02:11:22:33:44:55'), /randomized phone MAC/i);
  assert.match(macAddressDisplaySuffix('02:11:22:33:44:55'), /Randomized MAC/);
  // A randomized address has no meaningful OUI vendor.
  assert.equal(macOuiLookup('02:11:22:33:44:55').randomized, true);
});

test('randomized rule: second hex digit 2/6/A/E only', () => {
  for (const mac of ['02:00:00:00:00:01', '06:00:00:00:00:01', '0A:00:00:00:00:01', '0E:00:00:00:00:01', 'AA:BB:CC:DD:EE:FF']) {
    assert.equal(isRandomizedMac(mac), true, mac);
  }
  for (const mac of ['00:11:22:33:44:55', '4C:5E:0C:00:00:01', 'C8:3A:35:11:22:33', '01:00:5E:00:00:01']) {
    assert.equal(isRandomizedMac(mac), false, mac);
  }
  // First octet alone is enough to warn while typing.
  assert.equal(isRandomizedMac('02'), true);
});

test('all accepted input formats resolve the same', () => {
  for (const mac of ['C8:3A:35:11:22:33', 'c8:3a:35:11:22:33', 'C8-3A-35-11-22-33', 'c83a35112233', 'C83A.3511.2233', ' C8:3A:35:11:22:33 ']) {
    assert.equal(macOuiVendor(mac), 'Tenda', mac);
    assert.equal(normalizeMacHex(mac), 'C83A35112233', mac);
  }
  assert.equal(isFullMacAddress('C8:3A:35:11:22:33'), true);
  assert.equal(isFullMacAddress('C8:3A:35:11:22'), false);
});

test('every table vendor resolves from one of its prefixes', () => {
  assert.equal(macOuiVendor('14:CC:20:00:00:01'), 'TP-Link');
  assert.equal(macOuiVendor('00:E0:FC:00:00:01'), 'Huawei');
  assert.equal(macOuiVendor('D0:15:4A:00:00:01'), 'ZTE');
  assert.equal(macOuiVendor('D0:41:C9:00:00:01'), 'FiberHome');
  assert.equal(macOuiVendor('C8:E7:D8:00:00:01'), 'Mercusys');
  assert.equal(macOuiVendor('4C:5E:0C:00:00:01'), 'MikroTik');
});

test('unknown OUI shows nothing — no guessed vendor', () => {
  assert.equal(macOuiVendor('00:11:22:33:44:55'), null);
  assert.equal(macOuiHintHtml('00:11:22:33:44:55'), '');
  assert.equal(macAddressDisplaySuffix('00:11:22:33:44:55'), '');
});

test('malformed, partial or missing input: no badge, no warning, no throw', () => {
  for (const bad of ['', '   ', null, undefined, 'ZZ:ZZ:ZZ:ZZ:ZZ:ZZ', 'C8:3A:35', 'not-a-mac', 'C8:3A:35:11:22:33:44']) {
    assert.equal(macOuiVendor(bad), null, String(bad));
    assert.equal(macOuiHintHtml(bad), '', String(bad));
    assert.equal(macAddressDisplaySuffix(bad), '', String(bad));
  }
  assert.equal(isRandomizedMac(''), false);
  assert.equal(isRandomizedMac(null), false);
  assert.equal(isRandomizedMac('Z2'), false);
  assert.equal(normalizeMacHex(''), null);
});

test('lookup never mutates its input or a customer record', () => {
  const customer = { id: 'cust-1', macAddress: 'C8:3A:35:11:22:33' };
  const before = JSON.stringify(customer);
  macOuiLookup(customer.macAddress);
  macAddressDisplaySuffix(customer.macAddress);
  macOuiHintHtml(customer.macAddress);
  assert.equal(JSON.stringify(customer), before);
});

test('OUI table sanity: 6-hex prefixes, only the seven CPE vendors', () => {
  const vendors = new Set(['Tenda', 'TP-Link', 'Huawei', 'ZTE', 'FiberHome', 'Mercusys', 'MikroTik']);
  const seen = new Set();
  for (const [prefix, vendor] of Object.entries(MAC_OUI_VENDORS)) {
    assert.match(prefix, /^[0-9A-F]{6}$/, prefix);
    assert.ok(vendors.has(vendor), vendor);
    seen.add(vendor);
  }
  assert.deepEqual([...seen].sort(), [...vendors].sort());
});

test('mikrotik snippet: randomized MAC warns but the ARP line is still emitted', () => {
  const customer = { id: 'cust-7', customerNumber: 7, name: 'Synthetic Seven', packageSpeed: '5Mbps / 200GB', pppoeUsername: 'synth7', pppoePassword: 'pw', staticIp: '10.0.0.7', macAddress: '02:11:22:33:44:55' };
  const script = buildCustomerMikrotikSnippet(customer);
  assert.match(script, /# NOTE: this MAC looks like a randomized phone MAC/);
  assert.match(script, /\/ip arp add address=10\.0\.0\.7 mac-address=02:11:22:33:44:55/);
});

test('mikrotik snippet: ordinary router MAC gets no randomized warning', () => {
  const customer = { id: 'cust-8', customerNumber: 8, name: 'Synthetic Eight', packageSpeed: '5Mbps / 200GB', pppoeUsername: 'synth8', pppoePassword: 'pw', staticIp: '10.0.0.8', macAddress: 'C8:3A:35:11:22:33' };
  const script = buildCustomerMikrotikSnippet(customer);
  assert.ok(!script.includes('randomized phone MAC'));
  assert.match(script, /\/ip arp add address=10\.0\.0\.8 mac-address=C8:3A:35:11:22:33/);
});

test('i18n: every macoui_* key exists in en AND ur, params intact', () => {
  for (const key of ['macoui_vendor_label', 'macoui_vendor_suffix', 'macoui_random_short', 'macoui_random_warn']) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
  }
  assert.match(TRANSLATIONS.en.macoui_vendor_label, /\{vendor\}/);
  assert.match(TRANSLATIONS.ur.macoui_vendor_label, /\{vendor\}/);
  assert.match(TRANSLATIONS.en.macoui_vendor_suffix, /\{vendor\}/);
  assert.match(TRANSLATIONS.ur.macoui_vendor_suffix, /\{vendor\}/);
});

test('mechanical audit: every t() macoui key used in app surfaces exists in both dicts', () => {
  const used = new Set();
  for (const file of ['profile-ui.js', 'app.js']) {
    for (const m of read(file).matchAll(/t\('(macoui_[a-z_]+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size >= 4, [...used].join(','));
  for (const key of used) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
  }
});

test('wiring: module seams and hint element are in place', () => {
  assert.match(read('profile-ui.js'), /from '\.\/mac-oui-lookup\.js'/);
  assert.match(read('mikrotik-generator.js'), /from '\.\/mac-oui-lookup\.js'/);
  assert.match(read('app.js'), /macAddressDisplaySuffix/);
  assert.match(read('app.js'), /macOuiHintHtml/);
  assert.match(read('index.html'), /id="macOuiHint"/);
  assert.match(read('index.html'), /id="macAddressInput"/);
  // 100% offline: the lookup module must never reach for the network.
  assert.ok(!/fetch\(|XMLHttpRequest|https?:\/\//.test(read('mac-oui-lookup.js')));
  // Token-only CSS: no hex colours in the new badge/warning rules.
  const css = read('components.css');
  for (const m of css.matchAll(/\.mac-oui-[a-z]+ \{[^}]*\}/g)) {
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(m[0]), m[0]);
  }
});
