// Customer Cards Compact (item B, user request 2026-11-14): this
// file's pins moved with the card. The Customer N pill and the two
// metrics boxes are GONE — the header is a [#N] badge + bold name,
// the figures live in condensed pills (Lifetime / tenure / health),
// and the card gains ONE new control set, the §3 action row
// [Call | Collect | Full Profile]. The geometry the polish must
// NOT move now lives in the pill rules (shared padding/radius,
// flex-start rows, no dead middle). The avatar removal below and
// the no-service-toggle rule are unchanged.
//
// Customer Card Polish (user request 2026-11-12): the 44px avatar is
// REMOVED from the card — the user asked for no DP, "abhi k lye" (for
// now). The avatar CSS rule stays only because its #245e4c is counted
// in the §8.9 613-hex pin; the markup must carry no avatar at all.
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

test('polish: card avatar is removed — no DP tile in the card markup', () => {
  // Customer Card Polish (user decision 2026-11-12): no DP on the
  // Customers list cards (and none in the profile header either).
  assert.ok(!card.includes('<span class="avatar"'), 'no avatar tile in the card template');
  assert.ok(!card.includes('initials(customer.name)'), 'no initials rendered on the card');
});

test('polish: card name is 18px via the --text-card-name token', () => {
  assert.match(tokens, /--text-card-name: 18px;/, 'token is 18px');
  // Customers Cards Compact retired the name PILL with the Customer N
  // pill: the name is a plain bold span (flex:1) — same 18px token,
  // same bold weight, no input-box look.
  assert.match(
    styles,
    /\.customer-card-name \{[^}]*font-size: var\(--text-card-name\);/s,
    'card name uses the token, not a literal size'
  );
  assert.ok(!styles.includes('.customer-name-pill'), 'no name-pill rule left');
});

test('polish: [#N] badge keeps the ID-pill rotation (Customer N pill removed)', () => {
  // Customers Cards Compact (B §1): the `Customer N` pill is gone —
  // the header carries a compact [#N] badge in the SAME .customer-id-pill
  // span (same rotation class from customerIdPillClass, '' when the
  // record has no number). The cust_card_customer_number key is deleted.
  assert.ok(!card.includes("t('cust_card_customer_number'"), 'Customer N key is gone from the card');
  assert.match(
    card,
    /<span class="customer-id-pill(\$\{idPillClass \? ` \$\{idPillClass\}` : ''\})?">#\$\{escapeHtml\(String\(customer\.customerNumber\)\)\}<\/span>/,
    'number text wrapped in the [#N] badge span'
  );
  assert.match(styles, /\.customer-id-pill \{[^}]*border: 1px solid var\(--ds-line\);/s, 'pill border token');
  assert.match(styles, /\.customer-id-pill \{[^}]*background: var\(--ds-nested\);/s, 'pill background token');
  assert.match(styles, /\.customer-id-pill \{[^}]*border-radius: var\(--radius-pill\);/s, 'pill is round');
});

test('polish: condensed pills replace the metrics boxes (same figures, pill geometry)', () => {
  // Customers Cards Compact (B1) deleted the two stat boxes with the
  // whole .customer-card-stat rule set. Lifetime + tenure + health now
  // live in condensed pills in one flex-start row (B2 — no dead
  // middle). The pills reuse the palette already in the file: the
  // neutral meta/health pills take the ds tokens, the coloured pills
  // take the health/status hex already present (no new hex — the 613
  // ratchet is the backstop).
  assert.ok(!styles.includes('.customer-card-stat'), 'stat-box rules are gone with the boxes');
  assert.match(styles, /\.customer-card-pill-row \{[^}]*justify-content: flex-start;/s, 'pill rows are adjacent, never space-between');
  assert.match(styles, /\.customer-card-meta-pill \{[^}]*border: 1px solid var\(--ds-line\);/s, 'meta pill border token');
  assert.match(styles, /\.customer-card-meta-pill \{[^}]*border-radius: var\(--radius-pill\);/s, 'meta pill is round');
  assert.match(styles, /\.customer-card-meta-pill \{[^}]*background: var\(--ds-nested\);/s, 'meta pill background token');
  assert.match(styles, /\.customer-card-lifetime-pill \{[^}]*background: #e8f5ed;/s, 'lifetime pill reuses the received green');
  assert.match(styles, /\.customer-card-tenure-pill \{[^}]*background: #e5efff;/s, 'tenure pill reuses the status blue');
  assert.match(
    styles,
    /\.customer-card-health-pill\.health-score-high \{[^}]*background: #e8f5ed;/s,
    'health pill takes the score-band colours'
  );
});

test('polish: the action row is the only new control — no service toggle', () => {
  // REVERSAL (Customers Cards Compact §3): the old "no new control"
  // rule is retired on purpose — the card now ends in an action row
  // [Call | Collect | Full Profile]. The allowlist below is the WHOLE
  // control set: the whole-card open button, the outstanding row's
  // ＋ Add amount button, the archived unarchive button, the Clear-dues
  // seat (now a span with role=button in the header, not a button),
  // and the three action-row controls. No service toggle ever.
  // Pre-existing buttons only: the whole card is one open button (PR
  // #1334 design), the outstanding row keeps its ＋ Add amount button,
  // archived cards keep their unarchive button. Unpaid Cards adds the
  // green Clear dues seat in the header pill's seat (D-B1).
  const buttonClasses = [...card.matchAll(/<button[^>]*class="([^"]*)"/g)].map(m => m[1]);
  assert.ok(buttonClasses.length > 0, 'card buttons found');
  for (const cls of buttonClasses) {
    assert.ok(
      cls.includes('customer-select') || cls.includes('additional-pending-btn') || cls.includes('archived-unarchive-button') || cls.includes('customer-card-action-call') || cls.includes('customer-card-action-collect') || cls.includes('customer-card-action-profile'),
      `no new button class on the card: ${cls}`
    );
  }
  // The Call action is the card's ONLY link, and its href is the
  // escaped callHref — which is contactActionTargets(phone)?.tel, so
  // the link is a tel: link by construction (the tel: scheme lives in
  // the runtime value, not in the template text). Clear dues is a span
  // now, not a button, so it is not in the allowlist above.
  assert.ok(!card.includes('customer-card-open-hint'), 'open hint is gone (Full Profile is the action)');
  assert.ok(card.includes("const callHref = contactActionTargets(customer.phone)?.tel ?? null;"), 'Call href comes from the tel: contact target');
  for (const anchor of card.matchAll(/<a [^>]*>/g)) {
    assert.ok(anchor[0].includes('href="${escapeHtml(callHref)}"'), `card links use the tel: callHref: ${anchor[0]}`);
  }
  assert.doesNotMatch(card, /<input|<select/i, 'no input/select in the card');
  assert.doesNotMatch(card, /customer-service-toggle|toggleService|onchange|onclick/i, 'no toggle wiring in the card');
  assert.match(card, /customer-service-badge/, 'read-only service badge still present');
});
