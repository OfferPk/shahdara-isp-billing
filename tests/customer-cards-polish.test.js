// Customer Cards Polish (sequence step 3, user request 2026-11-10):
// the final sizing/token pass on the PR #1334 compact cards — 44px
// avatar, 18px name via the --text-card-name token, an ID pill around
// CUSTOMER #N, and the two metrics boxes converted to design-system
// tokens (background/border/radius/label/value colours). Geometry the
// polish must NOT move: stat boxes keep their 56px min-height and
// 7px 9px padding; the card gains NO toggle, button or control — the
// service badge stays a read-only pill and service control stays in
// the Profile Form (user-locked, D6).
//
// Fixtures are generic placeholders only — no real customer data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('app.js');
const styles = read('styles.css');
const tokens = read('tokens.css');

const cardStart = app.indexOf('function customerCardMarkup(');
assert.ok(cardStart > -1, 'customerCardMarkup exists');
const cardEnd = app.indexOf('\n}\n', cardStart);
const card = app.slice(cardStart, cardEnd);

test('polish: card avatar is 44px (was 40px)', () => {
  assert.match(
    styles,
    /\.customer-card-heading \.avatar \{[^}]*width: 44px;[^}]*height: 44px;/s,
    'card avatar 44x44'
  );
});

test('polish: card name is 18px via the --text-card-name token', () => {
  assert.match(tokens, /--text-card-name: 18px;/, 'token is 18px');
  assert.match(
    styles,
    /\.customer-card-heading \.customer-name \{[^}]*font-size: var\(--text-card-name\);/s,
    'card name uses the token, not a literal size'
  );
});

test('polish: CUSTOMER #N is wrapped in an ID pill (badges stay outside it)', () => {
  assert.match(
    card,
    /<span class="customer-id-pill">\$\{escapeHtml\(t\('cust_card_customer_number', null, \{ number: customer\.customerNumber \}\)\)\}<\/span>/,
    'number text wrapped in the pill span'
  );
  assert.match(styles, /\.customer-id-pill \{[^}]*border: 1px solid var\(--ds-line\);/s, 'pill border token');
  assert.match(styles, /\.customer-id-pill \{[^}]*background: var\(--ds-nested\);/s, 'pill background token');
  assert.match(styles, /\.customer-id-pill \{[^}]*border-radius: var\(--radius-pill\);/s, 'pill is round');
});

test('polish: metrics boxes use design-system tokens, geometry unchanged', () => {
  assert.match(styles, /\.customer-card-stat \{[^}]*background: var\(--ds-nested\);/s, 'stat box background token');
  assert.match(styles, /\.customer-card-stat \{[^}]*border: 1px solid var\(--ds-line\);/s, 'stat box border token');
  assert.match(styles, /\.customer-card-stat \{[^}]*border-radius: var\(--radius-sm\);/s, 'stat box radius token');
  assert.match(styles, /\.customer-card-stat \{[^}]*min-height: 56px;/s, 'stat box 56px min-height kept');
  assert.match(
    styles,
    /\.customer-card-stat > span \{[^}]*color: var\(--muted\);/s,
    'stat label uses the muted token'
  );
  assert.match(
    styles,
    /\.customer-card-stat strong \{[^}]*color: var\(--ink\);/s,
    'stat value uses the ink token (same as .ds-stat-box__value)'
  );
  assert.match(
    styles,
    /\.customer-card-stat small \{[^}]*color: var\(--muted\);/s,
    'stat caption uses the muted token'
  );
});

test('polish: no toggle or new control added to the card', () => {
  // Pre-existing buttons only: the whole card is one open button (PR
  // #1334 design), the outstanding row keeps its ＋ Add amount button,
  // archived cards keep their unarchive button. No service toggle.
  const buttonClasses = [...card.matchAll(/<button[^>]*class="([^"]*)"/g)].map(m => m[1]);
  assert.ok(buttonClasses.length > 0, 'card buttons found');
  for (const cls of buttonClasses) {
    assert.ok(
      cls.includes('customer-select') || cls.includes('additional-pending-btn') || cls.includes('archived-unarchive-button'),
      `no new button class on the card: ${cls}`
    );
  }
  assert.doesNotMatch(card, /<input|<select|<a /i, 'no input/select/link in the card');
  assert.doesNotMatch(card, /customer-service-toggle|toggleService|onchange|onclick/i, 'no toggle wiring in the card');
  assert.match(card, /customer-service-badge/, 'read-only service badge still present');
});
