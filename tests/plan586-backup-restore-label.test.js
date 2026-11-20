// Plan 586 — "App Settings" is renamed to what it opens: Backup & Restore.
//
// The rename already happened on this base: the drawer item at
// index.html:105 and the more-menu item at index.html:6344 both read
// "Backup & Restore" already, and drawer_settings was a dead key (0
// references) orphaned by that earlier rename. This file owns the
// residue the rename left behind:
//
//   G1 — Labels: the drawer item reads t('drawer_backup') (never the
//        dead key); the more-menu button is wired to t('more_backup');
//        drawer_settings is gone from both dicts, more_backup is kept.
//   G2 — Heading match: headerSpecForScreen('backup').title equals the
//        tapped label in EN and in UR (driven over the real module,
//        with a fake localStorage for the UR half — t() reads the
//        active language from storage on every call).
//   G3 — Routes kept: #/settings still resolves to backup, and the
//        legacy settings shims still map to backup; no rendered
//        element carries a settings nav target.
//   G4 — Guards unchanged: RESTRICTED_ACTIONS is exactly the four
//        PIN-gated actions; the collector-mode settings entry and the
//        backup-action blocks are untouched; no requireOwnerPin call
//        exists for settings or backup navigation.
//   G5 — Guards + completeness: parity 4,722/4,722 with equal key
//        sets; every drawer_*/more_* key the UI references exists in
//        both dicts; no $/€ in the touched values; the #/settings deep
//        link still works after the key deletion.
//
// No customer data, no phone numbers, no synthetic matches — the
// assertions are over the real shipped strings, keys, routes, and
// guard lists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TRANSLATIONS, t } from '../nav-language.js';
import {
  SCREENS, HOME, headerSpecForScreen, parseRoute, intentForElement
} from '../screen-router.js';
import { RESTRICTED_ACTIONS } from '../owner-pin-guard.js';
import { OWNER_ONLY_ACTIONS } from '../operator-modes.js';

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const navSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const routerSrc = readFileSync(join(dir, '..', 'screen-router.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');

// A fake element for intentForElement: closest() answers only the
// selector for the attribute this element carries.
function fakeEl(attr, value) {
  const el = {
    getAttribute: (k) => (k === attr ? value : null),
    closest: (sel) => (sel === `[${attr}]` ? el : null),
  };
  return el;
}

// Drive t() through the real active-language path: getAppLanguage()
// reads globalThis.localStorage on every call, so a fake store flips
// the language for the real headerSpecForScreen below.
function withLanguage(lang, fn) {
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => lang, setItem: () => {} };
  try {
    return fn();
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

// ---------- G1 — Labels ----------

test('G1: the drawer item reads Backup & Restore from drawer_backup, never the dead key', () => {
  assert.match(
    html,
    /<button type="button" data-nav-target="backup" id="drawerNavBackupBtn">/,
    'the drawer backup button exists',
  );
  assert.ok(html.includes('<span>Backup &amp; Restore</span>'), 'its static text is Backup & Restore');
  assert.ok(!html.includes('data-i18n="drawer_settings"'), 'no element is wired to drawer_settings');
  // The drawerNavMap is the live consumer: backup maps to drawer_backup
  // and the map has no settings entry.
  const mapStart = navSrc.indexOf('const drawerNavMap = {');
  assert.ok(mapStart >= 0, 'the drawerNavMap exists');
  const mapSrc = navSrc.slice(mapStart, navSrc.indexOf('};', mapStart));
  assert.ok(mapSrc.includes("backup: 'drawer_backup'"), 'drawer backup maps to drawer_backup');
  assert.ok(!mapSrc.includes('settings'), 'the drawerNavMap has no settings entry');
});

test('G1: the more-menu backup button is wired to more_backup (D2(a))', () => {
  assert.ok(
    html.includes('<button type="button" data-mobile-more="backup" data-i18n="more_backup">Backup &amp; Restore</button>'),
    'the more-menu button carries data-i18n="more_backup" with the EN fallback',
  );
  assert.equal(t('more_backup', 'en'), 'Backup & Restore');
  assert.equal(t('more_backup', 'ur'), 'بیک اپ اور بحالی');
});

test('G1: drawer_settings is gone from both dicts (D1(a)); more_backup is kept (D2(a))', () => {
  assert.ok(!('drawer_settings' in TRANSLATIONS.en), 'EN drawer_settings deleted');
  assert.ok(!('drawer_settings' in TRANSLATIONS.ur), 'UR drawer_settings deleted');
  assert.equal(TRANSLATIONS.en.more_backup, 'Backup & Restore');
  assert.equal(TRANSLATIONS.ur.more_backup, 'بیک اپ اور بحالی');
  assert.equal(TRANSLATIONS.en.drawer_backup, 'Backup & Restore');
  assert.equal(TRANSLATIONS.ur.drawer_backup, 'بیک اپ اور بحالی');
});

// ---------- G2 — Heading match ----------

test('G2: the backup heading equals the tapped drawer label in EN and in UR (D3(a))', () => {
  assert.equal(
    headerSpecForScreen('backup').title,
    t('drawer_backup', 'en'),
    'EN heading matches the EN drawer label',
  );
  const urTitle = withLanguage('ur', () => headerSpecForScreen('backup').title);
  assert.equal(urTitle, 'بیک اپ اور بحالی', 'UR heading matches the UR drawer label');
  assert.equal(
    urTitle,
    t('drawer_backup', 'ur'),
    'the UR heading is the drawer_backup value, not a hardcoded string',
  );
  // The heading comes from the key, not from the SCREENS literal: the
  // source resolves backup through t('drawer_backup').
  assert.ok(routerSrc.includes("screen === 'backup' ? t('drawer_backup')"), 'backup title resolves through t(drawer_backup)');
});

test('G2: the Bills exception still holds and every other screen title is unchanged', () => {
  assert.equal(
    headerSpecForScreen('bills').title,
    t('bill_screen_title'),
    'Bills still resolves through its own key',
  );
  for (const [name, spec] of Object.entries(SCREENS)) {
    if (name === 'backup' || name === 'bills') continue;
    assert.equal(headerSpecForScreen(name).title, spec.title, `${name} title is still its hardcoded spec title`);
  }
  assert.equal(headerSpecForScreen(HOME), null, 'Home still has no header spec');
});

test('G2: the document title carries the same resolved heading', () => {
  // apply() renders the heading from the one contract: the title it
  // writes into the header is the same spec.title it writes into
  // doc.title, so the UR heading reaches the document title too.
  assert.ok(routerSrc.includes('titleEl.textContent = spec.title;'), 'apply() writes spec.title into the header');
  assert.ok(routerSrc.includes('doc.title = `${spec.title} · Shahdara ISP Billing`'), 'apply() writes the same spec.title into doc.title');
});

// ---------- G3 — Routes kept ----------

test('G3: #/settings still resolves to backup (D4(a) — shims kept)', () => {
  assert.deepEqual(parseRoute('#/settings'), { screen: 'backup' });
  assert.deepEqual(parseRoute('#settings'), { screen: 'backup' });
  assert.deepEqual(parseRoute('#/backup'), { screen: 'backup' });
});

test('G3: the legacy settings shims still map to backup, and no rendered element uses them', () => {
  assert.deepEqual(
    intentForElement(fakeEl('data-nav-target', 'settings')),
    { screen: 'backup' },
    'a drawer element with a settings target still lands on backup',
  );
  assert.deepEqual(
    intentForElement(fakeEl('data-mobile-more', 'settings')),
    { screen: 'backup' },
    'a more-menu element with a settings action still lands on backup',
  );
  assert.ok(!html.includes('data-nav-target="settings"'), 'no rendered drawer element carries a settings target');
  assert.ok(!html.includes('data-mobile-more="settings"'), 'no rendered more-menu element carries a settings action');
});

// ---------- G4 — Guards unchanged ----------

test('G4: the owner PIN guard still gates exactly the four actions — no settings, no backup', () => {
  assert.deepEqual(
    [...RESTRICTED_ACTIONS],
    ['partner-settlement', 'partner-shares', 'expense-delete', 'payment-void'],
    'RESTRICTED_ACTIONS is unchanged',
  );
  assert.ok(!appSrc.includes("requireOwnerPin('settings')"), 'no PIN gate added for settings navigation');
  assert.ok(!appSrc.includes("requireOwnerPin('backup')"), 'no PIN gate added for backup navigation');
  assert.ok(!appSrc.includes('requireOwnerPin("settings")'), 'no PIN gate added for settings navigation (double quotes)');
  assert.ok(!appSrc.includes('requireOwnerPin("backup")'), 'no PIN gate added for backup navigation (double quotes)');
});

test('G4: the collector-mode settings entry and the backup-action blocks are untouched', () => {
  assert.ok(
    OWNER_ONLY_ACTIONS.some((a) => a.value === 'settings' && a.label === 'Settings'),
    'the collector-mode settings entry still exists',
  );
  for (const action of ['backup-download', 'backup-share', 'backup-restore']) {
    assert.ok(
      OWNER_ONLY_ACTIONS.some((a) => a.value === action),
      `the collector-mode ${action} entry still exists`,
    );
    assert.ok(appSrc.includes(`collectorBlocked('${action}')`), `app.js still collector-blocks ${action}`);
  }
  assert.ok(appSrc.includes("collectorBlocked('settings')"), 'app.js still collector-blocks settings (the digital-payments dialog)');
});

// ---------- G5 — Guards + completeness ----------

test('G5: parity holds at 4,722/4,722 with equal key sets', () => {
  // Plan 586 (D1(a)): one dead key deleted from both dicts, 4,723 − 1.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5213, 'EN keys');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5213, 'UR keys');
  assert.deepEqual(
    Object.keys(TRANSLATIONS.en).sort(),
    Object.keys(TRANSLATIONS.ur).sort(),
    'no key is missing from either dict',
  );
});

test('G5: every drawer_*/more_* key the UI references exists in both dicts; the deep link survives the deletion', () => {
  // data-i18n keys in index.html + drawerNavMap values in nav-language.js.
  const referenced = new Set();
  for (const match of html.matchAll(/data-i18n="(drawer_[a-z_]+|more_[a-z_]+)"/g)) referenced.add(match[1]);
  const mapStart = navSrc.indexOf('const drawerNavMap = {');
  const mapSrc = navSrc.slice(mapStart, navSrc.indexOf('};', mapStart));
  for (const match of mapSrc.matchAll(/:\s*'(drawer_[a-z_]+|more_[a-z_]+)'/g)) referenced.add(match[1]);
  assert.ok(referenced.size > 0, 'the scan found referenced keys');
  for (const key of referenced) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `EN ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `UR ${key}`);
  }
  // No $/€ in the touched values (PKR-only — trivially true, no money
  // is touched, but the plan's completeness check asserts it).
  for (const key of ['drawer_backup', 'more_backup']) {
    assert.ok(!/[$€£]/.test(TRANSLATIONS.en[key]), `no currency symbol in EN ${key}`);
    assert.ok(!/[$€£]/.test(TRANSLATIONS.ur[key]), `no currency symbol in UR ${key}`);
  }
  // The deletion did not break the deep link.
  assert.deepEqual(parseRoute('#/settings'), { screen: 'backup' });
  assert.ok(!('drawer_settings' in TRANSLATIONS.en) && !('drawer_settings' in TRANSLATIONS.ur), 'the deleted key stays deleted');
});

test('G5: no real customer names or phone numbers in this test', () => {
  const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(testSrc), 'no phone-shaped string in this test');
});
