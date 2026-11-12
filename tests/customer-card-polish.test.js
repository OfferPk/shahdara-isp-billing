// Customer Card Polish (user request 2026-11-12, Roman Urdu):
// (1) the DP/avatar tile is removed from the Customers list cards AND
// the full profile header, "abhi k lye" (for now, not permanent);
// (2) the customer name is a pill in the same style as the
// "Customer N" pill, slightly larger; (3) the pill is FLEXIBLE —
// short name small, long name bigger, full name always visible, never
// clipped or ellipsised; (4) "Open full profile and monthly billing
// history" + the arrow merge into ONE pill-style button; (5) tapping
// "Health reasons" opens the reasons as pills, the 5 reasons in 5
// DIFFERENT pill colours.
//
// Fixtures are generic placeholders only — no real customer data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  customerHealthReasonPillClass,
  CUSTOMER_HEALTH_REASON_PILL_CLASS_COUNT
} from '../customer-card-style.js';

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

// ---------- (2) name as a pill, same style as the Customer N pill ----------

test('card polish: name is a pill sharing the Customer N rotation colour', () => {
  assert.match(
    card,
    /<span class="customer-name-pill\$\{idPillClass \? ` \$\{idPillClass\}` : ''\}" dir="auto">\$\{escapeHtml\(displayCustomerName\(customer, currentAppLanguage\(\)\)\)\}<\/span>/,
    'name wrapped in a pill span carrying the same idPillClass as the Customer N pill'
  );
  assert.match(
    styles,
    /\.customer-card-heading \.customer-name-pill \{[^}]*border: 1px solid var\(--ds-line\);[^}]*border-radius: var\(--radius-pill\);[^}]*background: var\(--ds-nested\);/s,
    'name pill shares the ID pill box (border token, pill radius, nested background)'
  );
});

// ---------- (3) the name pill is flexible, never clipped ----------

test('card polish: name pill is slightly larger than the Customer N pill', () => {
  // ID pill text is 9px (the .customer-number-line size) with 1px 6px
  // padding; the name pill keeps the 18px --text-card-name size with
  // 3px 10px padding — same style, slightly larger.
  const idRule = styles.match(/\.customer-id-pill \{[^}]*\}/s);
  assert.ok(idRule, 'ID pill rule exists');
  assert.match(idRule[0], /padding: 1px 6px;/, 'ID pill padding is 1px 6px');
  assert.match(styles, /\.customer-card-heading \.customer-number-line \{[^}]*font-size: 9px;/s, 'ID pill text is 9px');
  const nameRule = styles.match(/\.customer-card-heading \.customer-name-pill \{[^}]*\}/s);
  assert.ok(nameRule, 'name pill rule exists');
  assert.match(nameRule[0], /padding: 3px 10px;/, 'name pill padding is slightly larger');
  assert.match(nameRule[0], /font-size: var\(--text-card-name\);/, 'name pill text is the 18px token');
});

test('card polish: name pill grows with the name, never clips', () => {
  const rule = styles.match(/\.customer-card-heading \.customer-name-pill \{[^}]*\}/s);
  assert.ok(rule, 'name pill rule exists');
  assert.match(rule[0], /font-size: var\(--text-card-name\);/, 'name stays 18px via the token');
  assert.match(rule[0], /padding: 3px 10px;/, 'padding slightly larger than the ID pill 1px 6px');
  assert.match(rule[0], /white-space: normal;/, 'long names wrap inside the pill');
  assert.match(rule[0], /overflow-wrap: anywhere;/, 'long words break inside the pill');
  assert.match(rule[0], /max-width: 100%;/, 'pill never overflows the card');
  assert.doesNotMatch(rule[0], /text-overflow: ellipsis/, 'no ellipsis — the full name stays visible');
  assert.doesNotMatch(rule[0], /overflow: hidden/, 'no clipping');
});

// ---------- (4) open hint + arrow as ONE pill-style button ----------

test('card polish: open hint and arrow are one pill-style button', () => {
  assert.match(
    card,
    /<button type="button" class="customer-card-open-hint">\$\{t\('cust_card_open_hint'\)\} <span aria-hidden="true">\$\{cardIsUr \? '←' : '→'\}<\/span><\/button>/,
    'hint text and arrow together inside one button'
  );
  assert.ok(!card.includes('<span class="customer-card-open-hint">'), 'the old hint span is gone');
  const rule = styles.match(/\.customer-card-open-hint \{[^}]*\}/s);
  assert.ok(rule, 'open-hint rule exists');
  assert.match(rule[0], /border-radius: var\(--radius-pill\);/, 'hint is a pill');
  assert.match(rule[0], /border: 1px solid #9acbad;/, 'hint has a pill border');
  assert.match(rule[0], /background: #e7f2ec;/, 'hint has a pill background');
  assert.match(rule[0], /cursor: pointer;/, 'hint reads as a button');
});

// ---------- (5) health reasons as 5 different pill colours ----------

test('card polish: health-reason pill helper gives 5 distinct classes and wraps', () => {
  assert.equal(CUSTOMER_HEALTH_REASON_PILL_CLASS_COUNT, 5, 'five reason colours');
  const classes = [0, 1, 2, 3, 4].map(customerHealthReasonPillClass);
  assert.equal(new Set(classes).size, 5, 'positions 0-4 are all different');
  assert.deepEqual(classes, [
    'customer-health-reason-pill-0',
    'customer-health-reason-pill-1',
    'customer-health-reason-pill-2',
    'customer-health-reason-pill-3',
    'customer-health-reason-pill-4'
  ]);
  assert.equal(customerHealthReasonPillClass(5), 'customer-health-reason-pill-0', 'a sixth reason wraps to 0');
  assert.equal(customerHealthReasonPillClass(-1), '', 'negative position gets no class');
  assert.equal(customerHealthReasonPillClass('x'), '', 'non-numeric position gets no class');
});

test('card polish: the five reasons arrive in the fixed order the colours assume', () => {
  // scoreCustomer in owner-insights.js builds the reasons array in
  // this order; the pill colour is by position, so the order is the
  // mapping. Pin it here, not in the card.
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

test('card polish: card renders each reason as its position-coloured pill', () => {
  assert.ok(
    card.includes('`<li class="customer-health-reason-pill ${customerHealthReasonPillClass(index)}">${escapeHtml(reason)}</li>`'),
    'reasons map to pill <li> items by position'
  );
  // The "no reasons" fallback stays a plain list item — it is not one
  // of the five reasons, so it gets no pill colour.
  assert.ok(card.includes("`<li>${t('cust_card_health_none')}</li>`"), 'no-reasons fallback stays plain');
  assert.ok(card.includes('<details class="customer-health-reasons">'), 'reasons still open from the Health reasons tap');
});

test('card polish: the five reason pills use five distinct colours, all reused', () => {
  const backgrounds = [];
  for (let n = 0; n < 5; n++) {
    const rule = styles.match(new RegExp(`\\.customer-health-reason-pill-${n}\\s*\\{[^}]*\\}`, 's'));
    assert.ok(rule, `reason pill ${n} rule exists`);
    const bg = rule[0].match(/background:\s*(#[0-9a-f]{6});/);
    assert.ok(bg, `reason pill ${n} has a background`);
    backgrounds.push(bg[1]);
    // Every reason-pill colour is an ID-pill slot already in the
    // sheet — no new hex (the §8.9 ratchet pins styles.css at 614).
    assert.match(styles, new RegExp(`\\.customer-id-pill-\\d \\{[^}]*background: ${bg[1]};`), `reason pill ${n} background ${bg[1]} is an ID-pill colour`);
  }
  assert.equal(new Set(backgrounds).size, 5, 'all five reason pills differ');
});

test('card polish: reason pills flow as a wrapping row, not a bulleted list', () => {
  const rule = styles.match(/\.customer-health-reasons ul\{[^}]*\}/s);
  assert.ok(rule, 'health-reasons list rule exists');
  assert.match(rule[0], /display:flex;/, 'reasons lay out as a row');
  assert.match(rule[0], /flex-wrap:wrap;/, 'reasons wrap');
  assert.match(rule[0], /padding-left:0;/, 'no bullet indent');
  assert.match(rule[0], /list-style:none/, 'no bullets');
});
