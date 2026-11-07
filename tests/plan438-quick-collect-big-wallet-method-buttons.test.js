// Plan 438 — Quick Collect big wallet method buttons: one row of big
// method buttons on the Quick Collect screen (Cash, JazzCash,
// Easypaisa) plus the full method list for anything else. A big button
// selects exactly that method; other methods stay reachable from the
// full list; the buttons post nothing and change no record by
// themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BIG_WALLET_METHODS,
  bigWalletMethodIsBigMethod,
  bigWalletMethodOtherMethods,
  bigWalletMethodIsOtherMethod,
} from '../big-wallet-method-buttons.js';

const moduleSrc = readFileSync(new URL('../big-wallet-method-buttons.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// The offered methods the app already carries: the three big-button
// methods, the two smaller chips, NayaPay, and the cash-at-shop
// methods — exactly the list the hidden select is populated from.
const OFFERED = [
  'Cash',
  'JazzCash',
  'Easypaisa',
  'NayaPay',
  'Bank Transfer',
  'Raast',
  'Cash at Waseem Abbasi shop',
  'Cash at Naveed Abbasi shop',
  'Cash at Saad Abbasi shop',
  'Cash at Shahdara Net office',
];

test('big three: exactly Cash, JazzCash, Easypaisa, in that order, frozen', () => {
  assert.deepEqual([...BIG_WALLET_METHODS], ['Cash', 'JazzCash', 'Easypaisa']);
  assert.ok(Object.isFrozen(BIG_WALLET_METHODS), 'the big-three list must not be mutable');
});

test('isBigMethod: true for exactly the three counter methods', () => {
  for (const method of ['Cash', 'JazzCash', 'Easypaisa']) {
    assert.equal(bigWalletMethodIsBigMethod(method), true, method);
  }
});

test('isBigMethod: false for every other method, blanks and non-strings — never a guess', () => {
  for (const method of ['Bank Transfer', 'Raast', 'NayaPay', 'Cash at Waseem Abbasi shop', '', 'cash', 'jazzcash', null, undefined, 123, true]) {
    assert.equal(bigWalletMethodIsBigMethod(method), false, String(method));
  }
});

test('otherMethods: the offered methods that are not big-button methods, in order', () => {
  assert.deepEqual(bigWalletMethodOtherMethods(OFFERED), [
    'NayaPay',
    'Bank Transfer',
    'Raast',
    'Cash at Waseem Abbasi shop',
    'Cash at Naveed Abbasi shop',
    'Cash at Saad Abbasi shop',
    'Cash at Shahdara Net office',
  ]);
});

test('otherMethods: a non-array offers nothing, never a guessed list', () => {
  for (const bad of [null, undefined, 'Cash', 123, {}]) {
    assert.deepEqual(bigWalletMethodOtherMethods(bad), [], String(bad));
  }
});

test('isOtherMethod: true for a valid non-big, non-cash method — Bank, Raast and NayaPay stay reachable', () => {
  for (const method of ['Bank Transfer', 'Raast', 'NayaPay']) {
    assert.equal(bigWalletMethodIsOtherMethod(method, OFFERED, false), true, method);
  }
});

test('isOtherMethod: false for the big three — they have their own buttons', () => {
  for (const method of ['Cash', 'JazzCash', 'Easypaisa']) {
    assert.equal(bigWalletMethodIsOtherMethod(method, OFFERED, false), false, method);
  }
});

test('isOtherMethod: false for a cash-family method — cash keeps Cash lit, never Other', () => {
  assert.equal(bigWalletMethodIsOtherMethod('Cash at Waseem Abbasi shop', OFFERED, true), false);
  assert.equal(bigWalletMethodIsOtherMethod('Cash', OFFERED, true), false);
});

test('isOtherMethod: false for a damaged value — not offered, blank, or not a string', () => {
  for (const method of ['Unknown Method', '', null, undefined, 123]) {
    assert.equal(bigWalletMethodIsOtherMethod(method, OFFERED, false), false, String(method));
  }
  assert.equal(bigWalletMethodIsOtherMethod('Bank Transfer', null, false), false);
  assert.equal(bigWalletMethodIsOtherMethod('Bank Transfer', [], false), false);
});

test('module is pure: no clock, no storage, no document, no network, no import', () => {
  assert.ok(!moduleSrc.includes('new Date('), 'no new Date(');
  assert.ok(!moduleSrc.includes('Date.now('), 'no Date.now(');
  assert.ok(!moduleSrc.includes('localStorage'), 'no localStorage');
  assert.ok(!moduleSrc.includes('sessionStorage'), 'no sessionStorage');
  assert.ok(!moduleSrc.includes('document.'), 'no document access');
  assert.ok(!moduleSrc.includes('fetch('), 'no fetch');
  assert.ok(!/^import /m.test(moduleSrc), 'no import');
});

test('module header never names a fenced module file literally', () => {
  assert.ok(!moduleSrc.includes('.js'), 'no .js filename in the module at all');
});

test('page: the three big buttons exist, big, in order — Cash, JazzCash, Easypaisa', () => {
  const bigButtons = [...pageSrc.matchAll(/<button[^>]*class="quick-method-chip is-active bwb-big"[^>]*data-method="Cash"[^>]*>|<button[^>]*class="quick-method-chip bwb-big"[^>]*data-method="([^"]+)"[^>]*>/g)];
  assert.equal(bigButtons.length, 3, `expected 3 big buttons, found ${bigButtons.length}`);
  const methods = bigButtons.map((m) => m[1] || 'Cash');
  assert.deepEqual(methods, ['Cash', 'JazzCash', 'Easypaisa']);
  const cashIdx = pageSrc.indexOf('data-method="Cash"');
  const jazzIdx = pageSrc.indexOf('data-method="JazzCash"');
  const easyIdx = pageSrc.indexOf('data-method="Easypaisa"');
  assert.ok(cashIdx < jazzIdx && jazzIdx < easyIdx, 'big buttons in Cash, JazzCash, Easypaisa order');
});

test('page: Bank and Raast keep their small chips — no method loses a way in', () => {
  assert.ok(pageSrc.includes('data-method="Bank Transfer"'), 'Bank Transfer chip still there');
  assert.ok(pageSrc.includes('data-method="Raast"'), 'Raast chip still there');
  const bankLine = pageSrc.split('\n').find((line) => line.includes('data-method="Bank Transfer"'));
  const raastLine = pageSrc.split('\n').find((line) => line.includes('data-method="Raast"'));
  assert.ok(!bankLine.includes('bwb-big'), 'Bank chip stays small');
  assert.ok(!raastLine.includes('bwb-big'), 'Raast chip stays small');
  const chips = pageSrc.match(/data-method="[^"]+"/g) || [];
  assert.equal(chips.length, 5, `expected exactly 5 method chips, found ${chips.length}`);
});

test('page: the Other button and the hidden full list sit in the same row', () => {
  assert.ok(pageSrc.includes('id="bwbOtherMethodBtn"'), 'Other button id');
  assert.ok(pageSrc.includes('data-bwb-other="1"'), 'Other button marker');
  assert.ok(pageSrc.includes('id="quickCollectMethodSelect"'), 'full method select still there');
  assert.ok(pageSrc.includes('quickCollectMethodSelect" required class="qc-input" style="display:none;"'), 'select still hidden until Other reveals it');
  const row = pageSrc.split('\n').find((line) => line.includes('qc-method-chips'));
  assert.ok(row, 'method row present');
  const cashIdx = pageSrc.indexOf('data-method="Cash"');
  const otherIdx = pageSrc.indexOf('id="bwbOtherMethodBtn"');
  assert.ok(otherIdx > cashIdx, 'Other button comes after the big buttons in the same row');
});

test('wiring: the Other rule is imported from the new module', () => {
  assert.ok(
    wiringSrc.includes("import { bigWalletMethodIsOtherMethod } from './big-wallet-method-buttons.js';"),
    'expected the big-wallet import'
  );
});

test('wiring: syncMethodChips lights Other and shows the list exactly for a non-big method', () => {
  const sync = wiringSrc.slice(wiringSrc.indexOf('function syncMethodChips(val)'), wiringSrc.indexOf('function syncMethodChips(val)') + 1200);
  assert.ok(sync.includes("bigWalletMethodIsOtherMethod(val, PAYMENT_METHODS, isCashPaymentMethod(val))"), 'Other decided by the module rule');
  assert.ok(sync.includes("bigWalletOtherBtn?.classList.toggle('is-active', isOther)"), 'Other lights while a non-big method holds');
  assert.ok(sync.includes("methodSelect.style.display = isOther ? '' : 'none'"), 'full list shows exactly while Other is lit');
});

test('wiring: the Other button reveals the list and focuses it — it selects nothing by itself', () => {
  const handler = wiringSrc.slice(wiringSrc.indexOf("bigWalletOtherBtn?.addEventListener('click'"), wiringSrc.indexOf("bigWalletOtherBtn?.addEventListener('click'") + 700);
  assert.ok(handler.includes("methodSelect.style.display = '';"), 'Other reveals the select');
  assert.ok(handler.includes('methodSelect.focus();'), 'Other focuses the select');
  assert.ok(handler.includes('methodSelect.showPicker?.();'), 'Other opens the native picker when supported');
  assert.ok(!handler.includes('methodSelect.value ='), 'Other never writes a method');
});

test('wiring: a big button tap writes exactly that method into the select', () => {
  const wiring = wiringSrc.slice(wiringSrc.indexOf('// Wire 1-tap method chips'), wiringSrc.indexOf('// Wire 1-tap method chips') + 500);
  assert.ok(wiring.includes("const chosenMethod = chip.getAttribute('data-method');"), 'tap reads the button method');
  assert.ok(wiring.includes('methodSelect.value = chosenMethod;'), 'tap writes exactly that method');
  assert.ok(wiring.includes('syncMethodChips(chosenMethod);'), 'tap syncs the row');
});

test('wiring: a shop pick routes through syncMethodChips, so Other and the list stay consistent', () => {
  const shop = wiringSrc.slice(wiringSrc.indexOf('// OWNER-CASH-SHOP: render'), wiringSrc.indexOf('// OWNER-CASH-SHOP: render') + 1600);
  assert.ok(shop.includes('syncMethodChips(choice.method);'), 'shop pick syncs the method row');
});

test('wiring: the full list is still populated from every offered method', () => {
  const populate = wiringSrc.slice(wiringSrc.indexOf('// Populate payment methods select once'), wiringSrc.indexOf('// Populate payment methods select once') + 400);
  assert.ok(populate.includes('PAYMENT_METHODS.map(m =>'), 'select populated from PAYMENT_METHODS');
  assert.ok(populate.includes('`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`'), 'every offered method is an option');
});

test('styles: the big buttons are taller and larger than the small chips', () => {
  const rules = stylesSrc.match(/\.quick-method-chip\.bwb-big\s*\{[^}]*\}/g) || [];
  assert.equal(rules.length, 1, `expected one big-button rule, found ${rules.length}`);
  assert.ok(rules[0].includes('min-height: 56px'), 'big buttons 56px tall');
  assert.ok(rules[0].includes('font-size: 15px'), 'big buttons 15px text');
  assert.ok(rules[0].includes('flex: 1 1 30%'), 'big buttons three across');
});

test('styles: the Other button is chip-sized, and the base chip rule is untouched', () => {
  const other = stylesSrc.match(/\.bwb-other\s*\{[^}]*\}/g) || [];
  assert.equal(other.length, 1, `expected one Other rule, found ${other.length}`);
  assert.ok(other[0].includes('min-height: 44px'), 'Other button 44px like a small chip');
  const base = stylesSrc.match(/^\.quick-method-chip\s*\{[^}]*\}/gm) || [];
  assert.equal(base.length, 1, `expected one base chip rule, found ${base.length}`);
  assert.ok(base[0].includes('min-height: 44px'), 'base chip stays 44px');
  assert.ok(base[0].includes('font: 600 13px'), 'base chip stays 13px');
});

test('styles: no hex colour new to the file in the big-button and Other rules', () => {
  const rules = stylesSrc.match(/\.quick-method-chip\.bwb-big\s*\{[^}]*\}|\.bwb-other[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 4, `expected the new rules, found ${rules.length}`);
  const baseline = stylesSrc.replace(/\.quick-method-chip\.bwb-big\s*\{[^}]*\}|\.bwb-other[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
