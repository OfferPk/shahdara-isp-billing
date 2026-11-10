// QC success tick in box — the green tick sits INSIDE the bordered
// heading row, on the right of the heading, instead of floating outside
// it to the left (user-reported 2026-11-10; the still-open polish #21
// phone-check feedback).
//
// Mechanism (proved by a Chromium repro at base fdf89ff0): there was NO
// bordered box in the markup — the "box" the user saw was the :focus
// outline drawn around the <h3> only (nav.css), and the tick was a flex
// sibling outside that element, so it was outside by construction. The
// fix gives the row itself a permanent 2px border, moves the tick after
// the heading, suppresses the heading's focus outline (the heading is
// focused programmatically for the screen-reader announcement only),
// and grows the tick 28 → 32px.
// Pattern-fake data only: no fixtures — source assertions only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const navSrc = read('nav.css');
const pageSrc = read('index.html');
const quickCollectSrc = read('nav-quick-collect.js');
const fitSrc = read('tests/polish17-qc-success-fit.test.js');

function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

// The suppression rule's selector spans two lines, so find the first
// selector and take the block that follows it.
function suppressionBlock() {
  const start = navSrc.indexOf('.qc-success-banner h3:focus');
  assert.ok(start >= 0, 'missing .qc-success-banner h3:focus suppression rule');
  const open = navSrc.indexOf('{', start);
  const close = navSrc.indexOf('}', open);
  return {
    selectorText: navSrc.slice(start, open),
    block: navSrc.slice(open + 1, close),
  };
}

test('tick in box: the tick sits AFTER the heading inside the heading row, 20px SVG, exactly one tick', () => {
  const row = pageSrc.indexOf('<div class="qc-success-heading-row">');
  assert.ok(row >= 0, 'heading row missing');
  const heading = pageSrc.indexOf('id="quickCollectSuccessHeading"', row);
  const tick = pageSrc.indexOf('<span class="qc-success-check"', row);
  const message = pageSrc.indexOf('id="quickCollectSuccessMessage"', row);
  assert.ok(heading > row, 'heading must sit inside the heading row');
  // Tick-in-box fix: the tick follows the heading (was before it, so it
  // sat outside the heading's focus outline on the left).
  assert.ok(tick > heading, 'tick must sit inside the heading row, AFTER the heading');
  assert.ok(message > tick, 'message must sit below the heading row');
  assert.equal((pageSrc.match(/class="qc-success-check"/g) || []).length, 1, 'exactly one tick on the screen — no hero row left');
  const spanEnd = pageSrc.indexOf('</span>', tick);
  const span = pageSrc.slice(tick, spanEnd);
  assert.ok(span.includes('aria-hidden="true"'), 'tick stays aria-hidden (the heading announces success)');
  assert.ok(!span.includes('✓'), 'tick must not be the text glyph');
  assert.ok(span.includes('<svg viewBox="0 0 24 24" width="20" height="20" fill="none">'), 'tick must be the 20px SVG');
  assert.ok(span.includes('<path class="qc-check-draw" d="M5 12.5l4.5 4.5L19 7.5"'), 'tick path must be the design check');
  assert.ok(span.includes('stroke="#16a34a"'), 'tick stroke must reuse the existing check green');
  assert.ok(span.includes('stroke-width="3"'), 'tick stroke must be 3px');
  assert.ok(span.includes('stroke-linecap="round"') && span.includes('stroke-linejoin="round"'), 'tick must have round caps and joins');
  const headingEnd = pageSrc.indexOf('</h3>', heading);
  const headingHtml = pageSrc.slice(heading, headingEnd);
  assert.ok(headingHtml.includes('tabindex="-1"'), 'heading keeps tabindex -1 (focus announcement)');
  assert.ok(headingHtml.includes('Payment Recorded Successfully'), 'heading wording unchanged');
});

test('tick in box: the heading row carries a permanent green border in both themes', () => {
  const row = ruleBlock(stylesSrc, '.qc-success-heading-row {');
  assert.ok(row.includes('display: flex'), 'heading row must be flex');
  assert.ok(row.includes('align-items: center'), 'row must centre the tick against the heading');
  assert.ok(row.includes('justify-content: center'), 'row must be centred like the banner');
  assert.ok(row.includes('gap: 8px'), 'row gap must be 8px');
  // The permanent border is the "box" — it replaces the focus outline
  // that used to be the only box, and it wraps heading + tick together.
  assert.ok(row.includes('border: 2px solid var(--green, #0e5b4d)'), 'row must carry the permanent 2px green border');
  assert.ok(row.includes('border-radius: 12px'), 'row border radius must be 12px');
  assert.ok(row.includes('padding: 4px 12px'), 'row must have 4px 12px padding inside the border');
  const dark = ruleBlock(stylesSrc, '[data-theme="dark"] .qc-success-heading-row {');
  assert.ok(dark.includes('border-color: #2dd4bf'), 'dark row border must reuse the dark focus teal');
  const tickInRow = ruleBlock(stylesSrc, '.qc-success-heading-row .qc-success-check {');
  assert.ok(tickInRow.includes('margin-bottom: 0'), 'the base 8px bottom margin must not apply inside the row');
  assert.ok(tickInRow.includes('flex-shrink: 0'), 'the tick must never squeeze');
});

test('tick in box: no focus outline is drawn around the heading in either theme', () => {
  const { selectorText, block } = suppressionBlock();
  assert.ok(selectorText.includes(':focus-visible'), 'the suppression must cover :focus-visible too (the Issue-229 baseline would otherwise draw a blue box)');
  // !important beats the Issue-229 :focus-visible baseline in styles.css.
  assert.ok(block.includes('outline: none !important'), 'the heading focus outline must be suppressed with !important');
  // The old rules that drew the outline around the h3 only are gone —
  // the row border is the only box now.
  assert.ok(!navSrc.includes('.qc-success-banner h3:focus {'), 'old light :focus outline rule must be gone');
  assert.ok(!navSrc.includes('[data-theme="dark"] .qc-success-banner h3:focus {'), 'old dark :focus outline rule must be gone');
  // The Issue-229 baseline itself is untouched — it still rings every
  // other interactive element; only this heading is suppressed.
  assert.ok(stylesSrc.includes('outline: 3px solid #2563eb !important;'), 'Issue-229 :focus-visible baseline must stay');
});

test('tick in box: the heading is still programmatically focused on every success entry', () => {
  // The focus() calls are untouched by the fix — the outline is
  // suppressed, not the announcement.
  const focusCalls = quickCollectSrc.match(/successHeading\?\.focus\(\)/g) || [];
  assert.equal(focusCalls.length, 2, 'both success paths (normal + split) must still focus the heading');
  const headingGets = quickCollectSrc.match(/getElementById\('quickCollectSuccessHeading'\)/g) || [];
  assert.ok(headingGets.length >= 2, 'both paths must resolve the heading by id');
});

test('tick in box: 32px circle on success', () => {
  const check = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check {');
  // 28 → 32px: the tick looked lost beside the two-line 18px heading.
  // It costs 0px vertically — the row height is driven by the ~54px
  // heading, so the 32px tick still fits inside it.
  assert.ok(check.includes('width: 32px') && check.includes('height: 32px'), 'inline tick must be 32px on success');
  assert.ok(!check.includes('animation:'), 'the pop must not live on the size rule any more (it is trigger-gated)');
});

test('tick in box: the +12px border/padding cost is booked in the fit budget', () => {
  // Border 2×2 + padding 4×2 = +12px → 693px, 7px slack, inside the
  // 700px gate. The fit test itself enforces the total ≤ 700.
  assert.ok(fitSrc.includes("savings.push(['TICK-BOX row border + padding', -12])"), 'fit test must book the tick-in-box cost as a -12 saving row');
});
