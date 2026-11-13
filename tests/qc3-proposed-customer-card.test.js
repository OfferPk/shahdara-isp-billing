// QC-3 — Proposed customer card (audit MISSING #9, user-specified
// Image 2). The Quick Collect picker card becomes: #ID + NAME, DUE
// badge, Mohalla · phone, Outstanding vs Monthly package, and Call /
// Location / Collect buttons. Call reuses the profile contact shortcut
// action (tel: from the recorded phone); Location reuses
// gps-pin-helper.js googleMapsUrl and is honestly disabled when the
// customer has no pin — never an invented location; Collect is the
// existing tap-to-collect behaviour as an explicit button — no new
// flow, no new screen. Field Mode cards get the same three buttons
// where the layout allows (same actions, no new flow). The monthly
// package figure comes from the customer's priced package
// (packagePriceForCustomer: monthlySellingAmount, else the catalogue
// price for the packageSpeed label) — no new data; an unpriced
// customer shows the em dash, never a guessed amount.
//
// Stylesheet-value approach (polish #17/#21/#25/#27, QC-2 pattern):
// read the HTML/CSS/JS as text and assert the values; no browser
// needed. Fixture data only — pattern-fake phones (0301234567n
// family), no real customer data of any kind in this file. The
// reference image's example name/number/figures are never copied
// here — layout intent only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth } from '../core.js';
import {
  getPendingCollectionCustomers,
  renderQuickCollectPickerHtml,
  renderQuickCollectCustomerListHtml,
} from '../nav-quick-collect.js';
import { BILL_PACKAGES } from '../package-catalog.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const qcSrc = read('nav-quick-collect.js');
const fieldSrc = read('field-mode.js');
const stylesSrc = read('styles.css');
const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;

const URDU = /[\u0600-\u06FF]/;

// The new pure module under test — dynamic import so the pins below
// pass on the pristine base (pre-fix) while the QC-3 tests fail with
// "Cannot find module" until the module lands.
let qc3Cache = null;
const qc3 = async () => {
  if (!qc3Cache) qc3Cache = await import('../qc3-customer-card.js');
  return qc3Cache;
};

// --- Fixture ------------------------------------------------------------
// Five customers, all with a November bill pending (so all five are in
// the picker pool), differing only in the card inputs:
// 1. Priced Pinned — priced 3000, phone, GPS pin: the full card.
// 2. Priced No Pin — priced 1500, phone, no pin: Location disabled.
// 3. Priced No Phone — priced 2000, no phone, GPS pin: Call disabled.
// 4. Catalogue Priced — no monthlySellingAmount, packageSpeed matches
//    the catalogue ('5Mbps / 200GB' -> 2000): figure from the catalogue.
// 5. Unpriced — no monthlySellingAmount, no matching packageSpeed:
//    the monthly figure is the em dash, never a guessed amount.
const NOW = new Date();
const M = new Date(NOW.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7);
function cardState() {
  let state = createInitialState(['Priced Pinned', 'Priced No Pin', 'Priced No Phone', 'Catalogue Priced', 'Unpriced']);
  const [a, b, c, d, e] = state.customers.map((cust) => cust.id);
  state.customers[0].monthlySellingAmount = 3000;
  state.customers[0].phone = '03012345678';
  state.customers[0].gpsLat = 33.7;
  state.customers[0].gpsLng = 73.1;
  state.customers[1].monthlySellingAmount = 1500;
  state.customers[1].phone = '03012345679';
  state.customers[2].monthlySellingAmount = 2000;
  state.customers[2].phone = '';
  state.customers[2].gpsLat = 33.7;
  state.customers[2].gpsLng = 73.1;
  state.customers[3].monthlySellingAmount = null;
  state.customers[3].packageSpeed = '5Mbps / 200GB';
  state.customers[3].phone = '03012345671';
  state.customers[4].monthlySellingAmount = null;
  state.customers[4].packageSpeed = '';
  state.customers[4].phone = '03012345672';
  const bill = (id, amount) => {
    state = saveBillMonth(state, id, { month: M, dueAmount: String(amount), status: 'pending', dueDate: `${M}-05` }, NOW);
  };
  bill(a, 3000);
  bill(b, 1500);
  bill(c, 2000);
  bill(d, 2000);
  bill(e, 1000);
  return state;
}

// Card segments of the picker HTML, in render order — split on the
// class attribute itself, not on the card tag (QC-2 pattern).
function cardSegments(pickerHtml) {
  return pickerHtml
    .split('class="qc-customer-card')
    .slice(1)
    .map((seg) => {
      const name = (seg.match(/<span class="qc-cust-name">([^<]+)<\/span>/) || [])[1];
      return { name, html: seg };
    });
}

// --- Pins: the pure QC-3 module ----------------------------------------

test('qc3 monthly package: priced selling amount first, catalogue by packageSpeed, null when unpriced', async () => {
  const mod = await qc3();
  assert.equal(mod.qc3MonthlyPackage({ monthlySellingAmount: 3000, packageSpeed: '5Mbps / 200GB' }, BILL_PACKAGES), 3000);
  assert.equal(mod.qc3MonthlyPackage({ monthlySellingAmount: null, packageSpeed: '5Mbps / 200GB' }, BILL_PACKAGES), 2000);
  assert.equal(mod.qc3MonthlyPackage({ monthlySellingAmount: null, packageSpeed: '15Mbps Unlimited' }, BILL_PACKAGES), 3000);
  assert.equal(mod.qc3MonthlyPackage({ monthlySellingAmount: null, packageSpeed: '' }, BILL_PACKAGES), null);
  assert.equal(mod.qc3MonthlyPackage({ monthlySellingAmount: null, packageSpeed: 'No Such Plan' }, BILL_PACKAGES), null);
  assert.equal(mod.qc3MonthlyPackage({ monthlySellingAmount: null, packageSpeed: '' }, null), null);
  assert.equal(mod.qc3MonthlyPackage(null, BILL_PACKAGES), null);
  assert.equal(mod.qc3MonthlyPackage(undefined, BILL_PACKAGES), null);
});

test('qc3 card actions: call is the profile tel: link, null when the phone cannot be dialled', async () => {
  const mod = await qc3();
  assert.equal(mod.qc3CardActions({ phone: '03012345678' }).callHref, 'tel:03012345678');
  assert.equal(mod.qc3CardActions({ phone: '0300 1234567' }).callHref, 'tel:03001234567');
  assert.equal(mod.qc3CardActions({ phone: '' }).callHref, null);
  assert.equal(mod.qc3CardActions({ phone: null }).callHref, null);
  assert.equal(mod.qc3CardActions({}).callHref, null);
  assert.equal(mod.qc3CardActions({ phone: 'abc' }).callHref, null);
});

test('qc3 card actions: location is the pin URL, null without a pin — never an invented location', async () => {
  const mod = await qc3();
  assert.equal(
    mod.qc3CardActions({ gpsLat: 33.7, gpsLng: 73.1 }).mapsUrl,
    'https://www.google.com/maps?q=33.7,73.1',
  );
  assert.equal(mod.qc3CardActions({ gpsLat: null, gpsLng: null }).mapsUrl, null);
  assert.equal(mod.qc3CardActions({}).mapsUrl, null);
  assert.equal(mod.qc3CardActions({ gpsLat: 33.7 }).mapsUrl, null, 'a lone latitude is not a pin');
  assert.equal(mod.qc3CardActions({ gpsLat: 999, gpsLng: 73.1 }).mapsUrl, null, 'an out-of-range latitude is not a pin');
});

test('qc3 card actions: one object per customer, monthly figure + call + location together', async () => {
  const mod = await qc3();
  const full = mod.qc3CardActions({ monthlySellingAmount: 3000, phone: '03012345678', gpsLat: 33.7, gpsLng: 73.1 }, BILL_PACKAGES);
  // QC Modal Fix item 3: the card also carries the package name
  // (its display label) for the "Mohalla • Package Name" subtitle.
  assert.deepEqual(full, {
    monthlyPackage: 3000,
    packageName: '',
    callHref: 'tel:03012345678',
    mapsUrl: 'https://www.google.com/maps?q=33.7,73.1',
  });
  const bare = mod.qc3CardActions({ monthlySellingAmount: null, packageSpeed: '', phone: '' }, BILL_PACKAGES);
  assert.deepEqual(bare, { monthlyPackage: null, packageName: '', callHref: null, mapsUrl: null });
});

// --- Pins: the pool carries the card data --------------------------------

test('pool entries carry monthlyPackage, callHref and mapsUrl from the customer record', () => {
  const pool = getPendingCollectionCustomers(cardState(), '', 'all-dues');
  const byName = {};
  for (const e of pool) byName[e.name] = e;
  assert.equal(byName['Priced Pinned'].monthlyPackage, 3000);
  assert.equal(byName['Priced Pinned'].callHref, 'tel:03012345678');
  assert.equal(byName['Priced Pinned'].mapsUrl, 'https://www.google.com/maps?q=33.7,73.1');
  assert.equal(byName['Priced No Pin'].monthlyPackage, 1500);
  assert.equal(byName['Priced No Pin'].callHref, 'tel:03012345679');
  assert.equal(byName['Priced No Pin'].mapsUrl, null);
  assert.equal(byName['Priced No Phone'].monthlyPackage, 2000);
  assert.equal(byName['Priced No Phone'].callHref, null);
  assert.equal(byName['Priced No Phone'].mapsUrl, 'https://www.google.com/maps?q=33.7,73.1');
  assert.equal(byName['Catalogue Priced'].monthlyPackage, 2000, 'catalogue price when no selling amount is recorded');
  assert.equal(byName['Unpriced'].monthlyPackage, null, 'no priced package means no figure, never a guess');
});

// --- Pins: the QC picker cards -------------------------------------------

test('picker cards show Outstanding once, from the customer figures', () => {
  const cards = cardSegments(renderQuickCollectPickerHtml(cardState(), '', 'all-dues').html);
  const byName = {};
  for (const c of cards) byName[c.name] = c;
  assert.equal(cards.length, 5);
  // QC Modal Overhaul 2: the Monthly package column is GONE from the
  // modal card — the dues badge is the one place the figure appears,
  // and the column cost a full KPI row per card. The dues figure
  // stays, fully labelled; no second figure, no guessed amount for
  // an unpriced customer. Field Mode keeps its monthly figure.
  assert.ok(!byName['Priced Pinned'].html.includes('Monthly package'), 'the monthly figure must be gone from the modal card');
  assert.ok(!byName['Priced Pinned'].html.includes('qc3-package-val'), 'the monthly figure cell must be gone from the modal card');
  assert.ok(byName['Priced Pinned'].html.includes('PKR 3,000'), 'the dues figure must stay, in the badge');
  assert.ok(byName['Priced No Pin'].html.includes('PKR 1,500'), 'the dues figure must stay for the no-pin card');
  assert.ok(byName['Catalogue Priced'].html.includes('PKR 2,000'), 'the dues figure must stay for the catalogue card');
  assert.ok(byName['Unpriced'].html.includes('Outstanding'), 'the outstanding column must be labelled on every card');
  assert.ok(byName['Priced Pinned'].html.includes('Outstanding'), 'the outstanding column must be labelled too');
});

test('picker cards carry Call / Location / Collect — real links when the data exists', () => {
  const cards = cardSegments(renderQuickCollectPickerHtml(cardState(), '', 'all-dues').html);
  const byName = {};
  for (const c of cards) byName[c.name] = c;
  const pinned = byName['Priced Pinned'].html;
  assert.ok(pinned.includes('href="tel:03012345678"'), 'Call must dial the recorded phone');
  assert.ok(pinned.includes('data-qc3-action="call"'), 'Call must be marked as a card action');
  assert.ok(pinned.includes('href="https://www.google.com/maps?q=33.7,73.1"'), 'Location must open the recorded pin');
  assert.ok(pinned.includes('data-qc3-action="location"'), 'Location must be marked as a card action');
  assert.ok(pinned.includes('data-qc3-action="collect"'), 'Collect must be an explicit button');
  // QC Modal Overhaul 2: Collect is plain "Collect" — the dues badge
  // above it ("PKR 3,000 DUE") already names the figure, so naming
  // it again on the button was the second copy.
  assert.ok(!pinned.includes('Collect PKR 3,000</button>'), 'Collect must not repeat the amount the dues badge already names');
  assert.ok(pinned.includes('Collect</button>'), 'Collect must stay a plain label');
});

test('picker cards honestly disable Call without a phone and Location without a pin', () => {
  const cards = cardSegments(renderQuickCollectPickerHtml(cardState(), '', 'all-dues').html);
  const byName = {};
  for (const c of cards) byName[c.name] = c;
  const noPin = byName['Priced No Pin'].html;
  assert.ok(!noPin.includes('google.com/maps'), 'no pin means no maps link anywhere on the card');
  assert.ok(noPin.includes('data-qc3-action="location"'), 'the Location control must still render');
  assert.ok(/data-qc3-action="location"[^>]*disabled/.test(noPin) || /disabled[^>]*data-qc3-action="location"/.test(noPin), 'Location without a pin must be disabled');
  const noPhone = byName['Priced No Phone'].html;
  assert.ok(!noPhone.includes('href="tel:'), 'no phone means no dial link anywhere on the card');
  assert.ok(noPhone.includes('data-qc3-action="call"'), 'the Call control must still render');
  assert.ok(/data-qc3-action="call"[^>]*disabled/.test(noPhone) || /disabled[^>]*data-qc3-action="call"/.test(noPhone), 'Call without a phone must be disabled');
  assert.ok(byName['Priced No Phone'].html.includes('href="https://www.google.com/maps?q=33.7,73.1"'), 'a pinned customer without a phone still gets Location');
});

test('picker card tap-to-collect is unchanged: the card still opens collection, Collect shares its path', () => {
  assert.ok(qcSrc.includes("closest('[data-qc3-action]')"), 'the picker click handler must see the card actions first');
  assert.ok(qcSrc.includes('openCustomerCollectionForm'), 'tapping the card must still open the collection form');
  const handler = qcSrc.slice(qcSrc.indexOf("closest('[data-qc3-action]')"));
  assert.ok(handler.indexOf('openCustomerCollectionForm') > handler.indexOf("data-qc3-action"), 'the action check must come before the card tap');
  assert.ok(handler.includes("dataset.qc3Action !== 'collect'") || handler.includes('qc3Action === \'collect\''), 'only Collect falls through to the card path; Call/Location are plain links');
  const html2 = renderQuickCollectCustomerListHtml([{ id: 'c-1', customerNumber: 1, name: 'Plain Fixture', area: 'BARRIAN', phone: '', totalDues: 1000 }], null);
  assert.ok(html2.includes('data-customer-id="c-1"'), 'a plain fixture still renders its card id');
  // QC Modal Overhaul 2: the monthly figure cell is gone from the
  // modal card, so a plain fixture with no package fields simply
  // renders its dues badge — no dash cell, never a crash.
  assert.ok(!html2.includes('qc3-package-val'), 'a plain fixture carries no monthly figure cell');
  assert.ok(html2.includes('PKR 1,000'), 'a plain fixture still shows its dues in the badge');
  assert.ok(html2.includes('data-qc3-action="collect"'), 'a plain fixture still gets the Collect button');
});

test('the action row appears only on collection cards — not on lookup rows or the empty state', () => {
  const picked = renderQuickCollectPickerHtml(cardState(), '', 'all-dues');
  const collectCount = (picked.html.match(/data-qc3-action="collect"/g) ?? []).length;
  assert.equal(collectCount, 5, 'exactly one Collect button per list card, none on recent cards');
  assert.ok(!renderQuickCollectCustomerListHtml([]).includes('data-qc3-action'), 'the empty state carries no action row');
});

// --- Pins: Field Mode cards ------------------------------------------------

test('field mode cards carry the same three buttons, from the same pool fields', () => {
  assert.ok(fieldSrc.includes('qc3CardActions') || fieldSrc.includes('callHref'), 'field mode must read the card actions');
  assert.ok(fieldSrc.includes('data-qc3-action="call"') || fieldSrc.includes("data-qc3-action='call'"), 'field mode cards must render Call');
  assert.ok(fieldSrc.includes('data-qc3-action="location"') || fieldSrc.includes("data-qc3-action='location'"), 'field mode cards must render Location');
  assert.ok(fieldSrc.includes('data-qc3-action="collect"') || fieldSrc.includes("data-qc3-action='collect'"), 'field mode cards must render Collect');
  assert.ok(fieldSrc.includes('mapsUrl'), 'field mode Location must come from the recorded pin URL');
  assert.ok(fieldSrc.includes("closest?.('[data-qc3-action]')") || fieldSrc.includes("closest('[data-qc3-action]')"), 'the field mode list handler must see the card actions first');
  const handler = fieldSrc.slice(fieldSrc.indexOf('data-field-customer-id'));
  assert.ok(handler.includes('selectCustomer'), 'field mode Collect must open the same sheet as tapping the card');
});

// --- Pins: i18n -----------------------------------------------------------

test('qc3_ keys exist in EN and UR, with Urdu script in the Urdu values', () => {
  assert.equal(en.qc3_call, 'Call');
  assert.equal(en.qc3_location, 'Location');
  assert.equal(en.qc3_collect, 'Collect');
  assert.equal(en.qc3_monthly_package, 'Monthly package');
  assert.equal(en.qc3_outstanding, 'Outstanding');
  assert.equal(en.qc3_no_phone, 'No phone number recorded');
  assert.equal(en.qc3_no_location, 'No location recorded');
  assert.equal(en.qc3_card_actions, 'Customer actions');
  for (const key of ['qc3_call', 'qc3_location', 'qc3_collect', 'qc3_monthly_package', 'qc3_outstanding', 'qc3_no_phone', 'qc3_no_location', 'qc3_card_actions']) {
    assert.ok(typeof ur[key] === 'string' && ur[key].length > 0, `missing UR value for ${key}`);
    assert.ok(URDU.test(ur[key]), `UR value for ${key} must carry Urdu script`);
  }
});

// --- Pins: CSS -------------------------------------------------------------

test('qc3 card rules are token-only, action buttons are 44px tappable', () => {
  const start = stylesSrc.indexOf('.qc3-card-actions {');
  assert.ok(start >= 0, 'missing .qc3-card-actions rule');
  const block = stylesSrc.slice(start, stylesSrc.indexOf('}', start));
  assert.ok(block.includes('display: flex'), 'the action row must be flex (three buttons side by side)');
  // The QC-3 rules are one contiguous block ending with the Collect
  // accent rule — scope the hex check to exactly that block, and
  // check the ratchet the way it is defined: no NEW hex. A hex that
  // already appears elsewhere in the sheet adds no distinct hex.
  const accentStart = stylesSrc.indexOf('.qc3-collect', start);
  assert.ok(accentStart >= 0, 'missing Collect accent rule');
  const added = stylesSrc.slice(start, stylesSrc.indexOf('}', accentStart) + 1);
  const addedHex = [...new Set(added.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])];
  const rest = stylesSrc.slice(0, start) + stylesSrc.slice(stylesSrc.indexOf('}', accentStart) + 1);
  for (const hex of addedHex) {
    assert.ok(rest.includes(hex), `QC-3 CSS introduces new hex ${hex} — reuse tokens`);
  }
  assert.ok(added.includes('min-height: 44px'), 'action buttons must be 44px tappable');
  // QC Modal Fix item 6: Collect is the user's emerald gradient
  // now (--qc-collect-from → --ds-success, white text, weight 600)
  // instead of the solid DS-0 --ds-brand — the gradient is the one
  // primary action against the outline Call / Location buttons.
  assert.ok(added.includes('var(--qc-collect-from)'), 'the Collect button must use the collect token');
  assert.ok(added.includes('var(--ds-success)'), 'the Collect button must end on the DS-0 success token');
  assert.ok(added.includes('background: linear-gradient'), 'the Collect button must be the emerald gradient, not an outline');
  const wrapStart = stylesSrc.indexOf('.qc-customer-card.qc3-card');
  assert.ok(wrapStart >= 0, 'missing card wrapper rule (column layout)');
  const wrapBlock = stylesSrc.slice(wrapStart, stylesSrc.indexOf('}', wrapStart));
  assert.ok(wrapBlock.includes('flex-direction: column'), 'the wrapper must stack the tap target over the action row');
});

// --- Pins: no new store key, no new element id -----------------------------

test('qc3 adds no store key and no new element id', () => {
  assert.ok(!/shahdara_[a-z_]*qc3/.test(qcSrc + fieldSrc), 'no new store key for QC-3');
  assert.ok(!/id="qc3/.test(html), 'no new element id for QC-3');
});
