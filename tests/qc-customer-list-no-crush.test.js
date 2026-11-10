// QC card-overlap fix — Quick Collect customer cards crush and overlap
// (user-reported 2026-11-10, two phone screenshots). In the "⚡ Quick
// Collect Cash" modal the Call / Location action row sat on top of the
// name + mohalla text, the PKR due line at the bottom of each card was
// half-hidden behind the next card, and successive cards overlapped
// vertically; the first card was clean.
//
// Root cause (proven by a read-only investigation in a real Chromium
// render): `.qc-customer-list` is a `max-height: 380px` column flex
// container holding all 100 cards, and every card shrank to its
// explicit `min-height: 54px` instead of its ~170px natural height
// (flex-shrink defaults to 1; the explicit min-height replaces the
// content-based minimum per the flexbox automatic-minimum-size rule).
// The overflow then painted over the next card — disabled Call /
// Location buttons stayed visible over the next card because their
// `opacity: 0.55` creates a stacking context, while the enabled
// Collect button was hidden behind it.
//
// Fix (styles.css only): `flex-shrink: 0` on the card wrapper rule so
// a card can never be crushed below its content height; `flex-wrap:
// wrap` on the action row so at very narrow widths the third button
// drops to a second row instead of clipping; `white-space: nowrap` on
// the action buttons so "📍 Location" stays on one line. The list's
// `max-height: 380px` / `overflow-y: auto` scrolling is intended and
// stays; the base card `min-height: 54px` stays (with `flex-shrink:
// 0` it never binds as a crush floor).
//
// Stylesheet-value approach (polish #17/#21/#25/#27, QC-2/QC-3
// pattern): read the CSS as text and assert the values; no browser
// needed. Fixture data only — generic fixture names, pattern-fake
// phone (03012345678 family), no real customer data of any kind in
// this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderQuickCollectCustomerListHtml } from '../nav-quick-collect.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');

// The rule block starting at the given selector text, up to its
// closing brace — scoped the same way the QC-3 test scopes its pins.
function ruleBlock(selector) {
  const start = stylesSrc.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector} rule`);
  return stylesSrc.slice(start, stylesSrc.indexOf('}', start));
}

// --- Pins: the fix ---------------------------------------------------------

test('qc card wrapper never shrinks below its content height', () => {
  const block = ruleBlock('.qc-customer-card.qc3-card,');
  assert.ok(block.includes('flex-direction: column'), 'the wrapper must still stack the tap target over the action row');
  assert.ok(block.includes('flex-shrink: 0'), 'the card wrapper must not shrink — without this the 100-card column flex container crushes every card to its 54px min-height and the cards overlap');
});

test('qc action row wraps and action buttons stay on one line', () => {
  const actions = ruleBlock('.qc3-card-actions {');
  assert.ok(actions.includes('display: flex'), 'the action row must stay flex (three buttons side by side)');
  assert.ok(actions.includes('flex-wrap: wrap'), 'the action row must wrap — at very narrow widths the third button drops to a second row instead of clipping');
  const btn = ruleBlock('.qc3-action-btn {');
  assert.ok(btn.includes('flex: 1 1 0'), 'the action buttons must still share the row evenly');
  assert.ok(btn.includes('white-space: nowrap'), 'an action button label such as "📍 Location" must stay on one line');
});

// --- Pins: what the fix must NOT change ------------------------------------

test('qc list still scrolls at 380px and the base card min-height stays', () => {
  const list = ruleBlock('.qc-customer-list {');
  assert.ok(list.includes('max-height: 380px'), 'the list must still cap at 380px and scroll — the fix is the card shrink, not the list height');
  assert.ok(list.includes('overflow-y: auto'), 'the list must still scroll vertically');
  const base = ruleBlock('.qc-customer-card {');
  assert.ok(base.includes('min-height: 54px'), 'the base card min-height stays — with flex-shrink: 0 it never binds as a crush floor');
});

test('qc overlap fix adds no new hex', () => {
  // Same pattern as the QC-3 hex check: a hex that already appears
  // elsewhere in the sheet adds no distinct hex. The three changed
  // blocks are not contiguous, so exclude each block's exact range.
  const selectors = ['.qc-customer-card.qc3-card,', '.qc3-card-actions {', '.qc3-action-btn {'];
  const ranges = selectors.map((sel) => {
    const start = stylesSrc.indexOf(sel);
    assert.ok(start >= 0, `missing ${sel} rule`);
    return [start, stylesSrc.indexOf('}', start)];
  });
  const changed = ranges.map(([s, e]) => stylesSrc.slice(s, e)).join('\n');
  // Remove highest-start ranges first so earlier indices stay valid.
  const rest = ranges
    .sort((a, b) => b[0] - a[0])
    .reduce((src, [s, e]) => src.slice(0, s) + src.slice(e), stylesSrc);
  const addedHex = [...new Set(changed.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])];
  for (const hex of addedHex) {
    assert.ok(rest.includes(hex), `QC overlap fix introduces new hex ${hex} — reuse tokens`);
  }
});

// --- Pins: the card markup order (the crush needs this DOM order) ----------

// Card segments of the list HTML, in render order — split on the class
// attribute itself, not on the card tag (QC-3 pattern).
function cardSegments(listHtml) {
  return listHtml
    .split('class="qc-customer-card')
    .slice(1)
    .map((seg) => {
      const name = (seg.match(/<span class="qc-cust-name">([^<]+)<\/span>/) || [])[1];
      return { name, html: seg };
    });
}

test('all 100 cards render the tap target before the action row, in DOM order', () => {
  const fixtures = Array.from({ length: 100 }, (_, i) => ({
    id: `c-${i + 1}`,
    customerNumber: i + 1,
    name: `Fixture ${i + 1}`,
    area: 'BARRIAN',
    phone: '03012345678',
    totalDues: 1000,
  }));
  const html = renderQuickCollectCustomerListHtml(fixtures, null);
  const segments = cardSegments(html);
  assert.equal(segments.length, 100, 'all 100 fixture customers must render a card');
  for (const seg of segments) {
    assert.ok(seg.html.includes('qc3-card-main'), `${seg.name} must render its tap-target button`);
    assert.ok(seg.html.includes('data-qc3-action="call"'), `${seg.name} must render its Call button`);
    assert.ok(seg.html.includes('data-qc3-action="location"'), `${seg.name} must render its Location button`);
    assert.ok(seg.html.includes('data-qc3-action="collect"'), `${seg.name} must render its Collect button`);
    // The actions row must come AFTER the tap target in DOM order —
    // the row the fix keeps below the name/figures, never on top of them.
    assert.ok(
      seg.html.indexOf('qc3-card-main') < seg.html.indexOf('data-qc3-action'),
      `${seg.name}: the action row must follow the tap target in DOM order`,
    );
  }
});
