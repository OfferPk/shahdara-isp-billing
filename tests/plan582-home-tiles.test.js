// Plan 582 — Home Collect tile reads in full.
//
// The spec's central premise is dead: "Payment lo" rendered nowhere —
// the Home Dashboard overhaul deleted the Receive Payment and Daily
// Closing tiles, and the live grid is exactly 4 tiles: Quick Collect,
// Customer add, Dues list, Installation. The live defects this file
// pins are the noun-first "Customer add" tile (now 'Add customer') and
// the More-menu "Daily Closing" button, which had no Urdu path. The
// orphan keys (dash_tile_collect_* / dash_tile_closing_*) are deleted
// from both dictionaries (D1(b)) — dead keys are dead code — so this
// file asserts their ABSENCE (the qc-cash-modal-overhaul
// !('old key' in …) shape), not merely the presence of new values.
//
// Fixture data only: UI labels, no customer names, no phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS, VISIBLE_TEXT_UR, translateVisibleText } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;

// --- G1 — The orphan keys are gone (D1(b)) ---

test('G1 collect triple absent from TRANSLATIONS.en', () => {
  // Plan 582 (D1(b)): the Receive Payment tile was deleted by the Home
  // Dashboard overhaul, so its keys render nowhere and are deleted.
  assert.ok(!('dash_tile_collect_aria' in en));
  assert.ok(!('dash_tile_collect_title' in en));
  assert.ok(!('dash_tile_collect_sub' in en));
});

test('G1 collect triple absent from TRANSLATIONS.ur', () => {
  assert.ok(!('dash_tile_collect_aria' in ur));
  assert.ok(!('dash_tile_collect_title' in ur));
  assert.ok(!('dash_tile_collect_sub' in ur));
});

test('G1 closing triple absent from TRANSLATIONS.en', () => {
  // Plan 582 (D1(b)): the Daily Closing tile was deleted by the Home
  // Dashboard overhaul, so its keys render nowhere and are deleted.
  assert.ok(!('dash_tile_closing_aria' in en));
  assert.ok(!('dash_tile_closing_title' in en));
  assert.ok(!('dash_tile_closing_sub' in en));
});

test('G1 closing triple absent from TRANSLATIONS.ur', () => {
  assert.ok(!('dash_tile_closing_aria' in ur));
  assert.ok(!('dash_tile_closing_title' in ur));
  assert.ok(!('dash_tile_closing_sub' in ur));
});

test('G1 dead dict entries gone and no EN value carries the dead strings', () => {
  // Plan 582 (D5(a)): the dictionary is keyed only off strings something
  // actually renders — 'Payment lo' and 'Aaj ka hisaab' render nowhere.
  assert.ok(!('Payment lo' in VISIBLE_TEXT_UR));
  assert.ok(!('Aaj ka hisaab' in VISIBLE_TEXT_UR));
  assert.ok(!Object.values(en).includes('Payment lo'));
  assert.ok(!Object.values(en).includes('Aaj ka hisaab'));
});

// --- G2 — The live tile reads 'Add customer' (D2(a)) ---

test('G2 live tile EN is verb-first: Add customer', () => {
  // Plan 582 (D2(a)): the only user-visible tile fix — 'Customer add'
  // was noun-first while its siblings read verb-first / clean.
  assert.equal(en.dash_tile_customer_title, 'Add customer');
  assert.equal(en.dash_tile_customer_aria, 'Add customer - New connection profile');
  assert.equal(en.dash_tile_customer_sub, 'New connection profile');
});

test('G2 live tile UR is unchanged (already verb-first)', () => {
  assert.equal(ur.dash_tile_customer_title, 'گاہک شامل کریں');
  assert.equal(ur.dash_tile_customer_aria, 'گاہک شامل کریں — نئے کنکشن کا پروفائل');
  assert.equal(ur.dash_tile_customer_sub, 'نئے کنکشن کا پروفائل');
});

test('G2 index.html fallbacks match the new values exactly', () => {
  // Plan 582 (D2(a), polish20 precedent): the static fallback must match
  // the key value, or the first paint disagrees with the i18n pass.
  assert.ok(
    html.includes('id="quickActionAddCustomer"') &&
    html.includes('aria-label="Add customer - New connection profile"'),
    'customer tile aria fallback must read Add customer',
  );
  assert.ok(
    html.includes('data-i18n="dash_tile_customer_title">Add customer</span>'),
    'customer tile title fallback must read Add customer',
  );
});

test("G2 'Customer add' is gone from the dictionaries", () => {
  // Plan 582 (D2(a)/D5(a)): the old noun-first string must not survive as
  // a key or a value anywhere the tiles read from.
  assert.ok(!Object.values(en).includes('Customer add'));
  assert.ok(!('Customer add' in VISIBLE_TEXT_UR));
});

// --- G3 — The More-menu Daily Closing button translates (D3(b)) ---

test("G3 'Daily Closing' translates via the visible-text dictionary", () => {
  // Plan 582 (D3(b)): the button is a bare text node, exactly the shape
  // translateVisibleText handles. The key must match the button's exact
  // text (capital C) or the exact-match lookup never fires.
  assert.ok('Daily Closing' in VISIBLE_TEXT_UR);
  assert.equal(translateVisibleText('Daily Closing'), 'آج کا حساب');
});

test('G3 More-menu button reads Daily Closing with no data-i18n', () => {
  // Plan 582 (D3(b)): the Urdu path is the dictionary, not a key — the
  // button carries no data-i18n and the key is the button's own text.
  assert.ok(html.includes('id="mobileMoreDailyClosingBtn">Daily Closing</button>'));
  const buttonLine = html.split('\n').find((line) => line.includes('mobileMoreDailyClosingBtn'));
  assert.ok(buttonLine && !buttonLine.includes('data-i18n'), 'button must not be data-i18n wired');
});

// --- G4 — Guards ---

test('G4 parity holds at 4,722 / 4,722 after deleting the six orphan keys', () => {
  // Plan 582 (D1(b)): six keys deleted from each dict, 4,675 − 6 = 4,669.
  // Plan 584: re-pinned 4,669 → 4,707 — this matches the count in the other 16 parity-pin files.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  // (Test title re-pinned with the asserts by Plan 586 — the 585 merge had
  // left the 582-era number in the title with disclosure; titles and
  // asserts move together from here on.)
  assert.equal(Object.keys(en).length, 5187, 'EN key count moved');
  assert.equal(Object.keys(ur).length, 5187, 'UR key count moved');
});

test('G4 dues, installation and Quick Collect values are byte-identical to base', () => {
  // Plan 582 touches only the customer tile and the orphan keys; the
  // other three live tiles are pinned here so a stray edit cannot hide.
  assert.equal(en.dash_tile_dues_title, 'Dues list');
  assert.equal(en.dash_tile_dues_aria, 'Dues list — Top defaulters (who owes how much)');
  assert.equal(en.dash_tile_dues_sub, 'Top defaulters');
  assert.equal(ur.dash_tile_dues_title, 'واجبات کی فہرست');
  assert.equal(en.dash_tile_installation_title, 'Installation');
  assert.equal(en.dash_tile_installation_aria, 'Installation — Fees collected & pending (Open the installation dashboard)');
  assert.equal(en.dash_tile_installation_sub, 'Fees collected & pending');
  assert.equal(ur.dash_tile_installation_title, 'انسٹالیشن');
  assert.equal(en.qc11_quick_collect, 'Quick Collect');
  assert.equal(ur.qc11_quick_collect, 'فوری وصولی');
});

test('G4 dash_card_closing is untouched', () => {
  // Plan 582 (D8(a)): the merged card is a different surface, its label
  // is deliberate and already translates — it is not part of this plan.
  assert.equal(en.dash_card_closing, 'Daily Roznamcha & Closing');
  assert.equal(ur.dash_card_closing, 'روزنامچہ اور بندش');
});
