// Customer Card Polish (user request 2026-11-12, Roman Urdu) as revised
// by Customers Cards Compact (user request 2026-11-14, item B):
// (1) the DP/avatar tile is removed from the Customers list cards AND
// the full profile header, "abhi k lye" (for now, not permanent) —
// STAYS. (2) the customer name was a pill in the same style as the
// "Customer N" pill, slightly larger — RETIRED: the name is bold plain
// text now (the Customer N pill is gone too, replaced by the [#N]
// badge). (3) the pill was FLEXIBLE — short name small, long name
// bigger, full name always visible, never clipped — REVERSED: the
// compact header shares one row with [#N] + status + billing pills,
// so a long name truncates with an ellipsis; the full name is one tap
// away in the profile (and in the whole-card button's title).
// (4) "Open full profile and monthly billing history" + the arrow
// merged into ONE pill-style button — RETIRED: the hint is gone, Full
// Profile is an action-row button. (5) tapping "Health reasons"
// opened the reasons as pills, the 5 reasons in 5 DIFFERENT pill
// colours — RETIRED: the reasons <details> is deleted from the card
// entirely (B2); the reasons live in the profile's Billing tab only,
// and the card's health is ONE band-coloured pill. The fixed reasons
// ORDER in owner-insights.js is still pinned here (the profile
// renders the same list).
//
// Fixtures are generic placeholders only — no real customer data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as cardStyle from '../customer-card-style.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('app.js');
const index = read('index.html');
const styles = read('styles.css');
const insights = read('owner-insights.js');

const cardStart = app.indexOf('function customerCardMarkup(');
assert.ok(cardStart > -1, 'customerCardMarkup exists');
const cardEnd = app.indexOf('\n}\n', cardStart);
const card = app.slice(cardStart, cardEnd);

// ---------- (1) no DP anywhere on the card or the profile header ----------

test('card polish: no avatar tile on the customer card', () => {
  assert.ok(!card.includes('<span class="avatar"'), 'no avatar tile in the card template');
  assert.ok(!card.includes('initials(customer.name)'), 'no initials rendered on the card');
});

test('card polish: no avatar in the full profile header', () => {
  assert.ok(!index.includes('id="profileAvatar"'), 'no profileAvatar element in the page');
  assert.ok(!app.includes("$('#profileAvatar')"), 'renderDetail no longer touches profileAvatar');
});

// ---------- (2) name as bold plain text, not a pill ----------

test('card polish: name is bold plain text next to the [#N] badge', () => {
  // Customers Cards Compact retired the name pill with the Customer N
  // pill: the name is a plain bold element (flex:1) beside the [#N]
  // badge — the wide grey input-box look came from the deleted
  // .customer-copy column, not from the name itself.
  assert.ok(
    card.includes('<span class="customer-card-name" dir="auto">${escapeHtml(displayCustomerName(customer, currentAppLanguage()))}</span>'),
    'name is a plain span, not a pill'
  );
  assert.ok(!card.includes('customer-name-pill'), 'no name pill in the card');
  assert.ok(!styles.includes('.customer-name-pill'), 'no name-pill rule in styles.css');
  const rule = styles.match(/\.customer-card-name \{[^}]*\}/s);
  assert.ok(rule, 'name rule exists');
  assert.match(rule[0], /font-size: var\(--text-card-name\);/, 'name stays 18px via the token');
  assert.match(rule[0], /font-weight: 700;/, 'name is bold');
  assert.match(rule[0], /flex: 1 1 auto;/, 'name takes the free header width');
});

// ---------- (3) the name truncates in the shared header row (reversal) ----------

test('card polish: long names truncate with an ellipsis in the header row', () => {
  // REVERSAL of the old "never clipped" rule, with why: the compact
  // header is ONE row — [#N] badge + name + status pill + billing
  // pill — so a long name must yield instead of growing the card. The
  // full name stays one tap away in the profile, and in the whole-card
  // button's title (openLabel carries the name).
  const rule = styles.match(/\.customer-card-name \{[^}]*\}/s);
  assert.ok(rule, 'name rule exists');
  assert.match(rule[0], /overflow: hidden;/, 'name clips instead of wrapping');
  assert.match(rule[0], /text-overflow: ellipsis;/, 'clipped name shows an ellipsis');
  assert.match(rule[0], /white-space: nowrap;/, 'name stays on one line');
  assert.match(rule[0], /min-width: 0;/, 'name shrinks inside the flex row');
  assert.ok(card.includes('title="${escapeHtml(openLabel)}"'), 'whole-card button title carries the full name');
});

// ---------- (4) open hint is gone — Full Profile is an action button ----------

test('card polish: open hint is gone, Full Profile is an action-row button', () => {
  // Customers Cards Compact retired the one-pill hint button: the card
  // ends at the action row, and Full Profile is its third button. The
  // cust_card_open_hint key stays in the dicts (the Urdu pins test
  // guards its English string) — only the card element is gone.
  assert.ok(!card.includes('customer-card-open-hint'), 'no open-hint button in the card');
  assert.ok(!styles.includes('.customer-card-open-hint'), 'no open-hint rule in styles.css');
  assert.ok(card.includes('customer-card-action-profile'), 'Full Profile action exists');
  assert.ok(card.includes("t('cust_card_open_profile')"), 'Full Profile label exists');
});

// ---------- (5) health reasons deleted from the card ----------

test('card polish: health-reason pill helper is deleted — reasons live in the profile only', () => {
  // Customers Cards Compact (B2) deleted the card's health-reasons
  // <details> entirely — the helper, its constant, the import, the CSS
  // and the dark rule — because the same five reasons already render
  // in the profile's Billing tab. Do not re-add a card-side reasons
  // pill: the old helper test (5 positions, 5 colours, wrap) is
  // deleted with the helper, not kept.
  assert.equal(cardStyle.customerHealthReasonPillClass, undefined, 'helper export is gone');
  assert.equal(cardStyle.CUSTOMER_HEALTH_REASON_PILL_CLASS_COUNT, undefined, 'helper constant is gone');
  assert.ok(!card.includes('customer-health-reason-pill'), 'no reason pills in the card');
  assert.ok(!styles.includes('.customer-health-reason-pill'), 'no reason-pill rules in styles.css');
  assert.ok(!card.includes('<details class="customer-health-reasons">'), 'no reasons expandable in the card');
  assert.ok(app.includes('(health?.reasons ?? []).map'), 'the profile still renders the health reasons (Billing tab)');
});

test('card polish: the five reasons arrive in the fixed order the profile renders', () => {
  // scoreCustomer in owner-insights.js builds the reasons array in
  // this order; the profile renders the same list. Pin it here, not
  // in the card.
  const order = [
    'Payment regularity:',
    'Due-date history:',
    'Outstanding:',
    'Partial installments:',
    'Average settlement delay:'
  ];
  let at = -1;
  for (const prefix of order) {
    const found = insights.indexOf(prefix, at + 1);
    assert.ok(found > at, `reason in place: ${prefix}`);
    at = found;
  }
});

test('card polish: the health pill takes the score-band colours', () => {
  // The band colours moved from the old health value + reason pills
  // onto the single health pill (D-B2): 70+ green, 40–70 yellow,
  // below 40 red — the same palettes, no new hex.
  assert.match(styles, /\.customer-card-health-pill\.health-score-high \{[^}]*background: #e8f5ed;[^}]*color: #19704e;/s, 'high band is the health-good green');
  assert.match(styles, /\.customer-card-health-pill\.health-score-mid \{[^}]*background: #fff5df;[^}]*color: #9a5e06;/s, 'mid band is the health-risk yellow');
  assert.match(styles, /\.customer-card-health-pill\.health-score-low \{[^}]*background: #ffebea;[^}]*color: #a3342d;/s, 'low band is the health-critical red');
});
