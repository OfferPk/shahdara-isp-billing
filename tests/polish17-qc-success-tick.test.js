// Polish 17 (Req 3) as amended by Polish 21 (Req 1 + Req 7) — Animated
// green tick: the tick on the Quick Collect success screen is an inline
// SVG check beside the heading that draws itself and pops in
// (Lottie-style), built with SVG + CSS keyframes — NOT Lottie (no new
// dependency, fully offline). Polish 21 moved it inline (28 px, in the
// heading row — no hero row) and gated BOTH animations behind the
// .qc-tick-play trigger class, which showStep re-adds on EVERY entry to
// the success screen, so it visibly plays on every showing and rests as
// a clear green ✓; prefers-reduced-motion shows a static ✓.
// The small ✓s ("✓ Saved on this device", "✓ Settle in Full") stay
// static text. On-screen only — the PNG/print/WhatsApp surfaces keep
// their static ✓.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const pageSrc = read('index.html');
const quickCollectSrc = read('nav-quick-collect.js');
const badgeSrc = read('offline-saved-badge.js');

function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function extractBalanced(css, marker) {
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `missing block ${marker}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  assert.fail(`unbalanced block at ${marker}`);
  return '';
}

test('tick markup: the inline tick is the SVG check beside the heading (not the text glyph), inside the heading row', () => {
  const row = pageSrc.indexOf('<div class="qc-success-heading-row">');
  assert.ok(row >= 0, 'heading row missing');
  const spanStart = pageSrc.indexOf('<span class="qc-success-check"', row);
  assert.ok(spanStart > row, 'tick span must sit inside the heading row');
  const heading = pageSrc.indexOf('id="quickCollectSuccessHeading"', row);
  // Tick-in-box fix: the tick follows the heading (was before it, so it
  // sat outside the heading's focus outline on the left).
  assert.ok(spanStart > heading, 'tick must sit after the heading in the row');
  const spanEnd = pageSrc.indexOf('</span>', spanStart);
  const span = pageSrc.slice(spanStart, spanEnd);
  assert.ok(span.includes('aria-hidden="true"'), 'tick stays aria-hidden (the heading announces success)');
  assert.ok(!span.includes('✓'), 'tick must not be the text glyph any more');
  // Tick-in-box fix: SVG 18 → 20px (with the 28 → 32px circle).
  assert.ok(span.includes('<svg viewBox="0 0 24 24" width="20" height="20" fill="none">'), 'tick must be the 20px SVG');
  assert.ok(span.includes('<path class="qc-check-draw" d="M5 12.5l4.5 4.5L19 7.5"'), 'tick path must be the design check');
  assert.ok(span.includes('stroke="#16a34a"'), 'tick stroke must reuse the existing check green');
  assert.ok(span.includes('stroke-width="3"'), 'tick stroke must be 3px');
  assert.ok(span.includes('stroke-linecap="round"'), 'tick must have round caps');
  assert.ok(span.includes('stroke-linejoin="round"'), 'tick must have round joins');
  assert.equal((pageSrc.match(/class="qc-success-check"/g) || []).length, 1, 'exactly one tick on the screen — the hero row is gone');
});

test('tick draw: the path starts fully hidden (dashoffset 24) and draws once in ~0.6s — only under the play trigger', () => {
  const draw = ruleBlock(stylesSrc, '.qc-check-draw {');
  assert.ok(draw.includes('stroke-dasharray: 24'), 'path length must be 24');
  assert.ok(draw.includes('stroke-dashoffset: 24'), 'path must start fully hidden');
  // Polish 21 (Req 7): the base rule carries NO animation — an animation
  // here would run once at page load while the step is hidden, so the
  // tick would look static on every showing.
  assert.ok(!draw.includes('animation'), 'base draw rule must carry no animation');
  const playDraw = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check.qc-tick-play .qc-check-draw {');
  assert.ok(playDraw.includes('animation: qc-check-draw .6s ease-out .1s forwards'), 'triggered path must draw in 0.6s after a 0.1s delay, once, forwards');
  assert.ok(!playDraw.includes('infinite'), 'path animation must not loop');
  assert.ok(!playDraw.includes('qc-check-pop'), 'the pop lives on the circle span only (no double-scaling the path)');
  const keyframes = extractBalanced(stylesSrc, '@keyframes qc-check-draw');
  assert.ok(keyframes.includes('stroke-dashoffset: 0'), 'draw keyframes must end at dashoffset 0 (fully drawn)');
});

test('tick pop: the circle pops once on arrival (scale .6 → 1.08 → 1) — only under the play trigger', () => {
  const check = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check {');
  // Tick-in-box fix: 28 → 32px — the tick looked lost beside the
  // two-line 18px heading. It costs 0px vertically (row height is
  // driven by the ~54px heading).
  assert.ok(check.includes('width: 32px') && check.includes('height: 32px'), 'inline tick must be 32px on success');
  assert.ok(!check.includes('animation:'), 'the pop must not live on the size rule any more (it is trigger-gated)');
  const playPop = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check.qc-tick-play {');
  assert.ok(playPop.includes('animation: qc-check-pop .45s cubic-bezier(.2,1.4,.4,1) forwards'), 'triggered circle must pop in 0.45s, once, forwards');
  assert.ok(!playPop.includes('infinite'), 'pop animation must not loop');
  const keyframes = extractBalanced(stylesSrc, '@keyframes qc-check-pop');
  assert.ok(keyframes.includes('transform: scale(.6)'), 'pop must start at scale .6');
  assert.ok(keyframes.includes('transform: scale(1.08)'), 'pop must overshoot to 1.08');
  assert.ok(keyframes.includes('transform: scale(1)'), 'pop must rest at scale 1');
});

test('tick replay: showStep re-triggers the animation on EVERY success entry (remove class, reflow, re-add)', () => {
  // Polish 21 (Req 7): un-hiding does NOT restart CSS animations on the
  // user's WebView (the polish #17 mechanism), so showStep must remove
  // the trigger class, force a reflow, and re-add it — a DOM change the
  // engine must honour on every entry.
  const start = quickCollectSrc.indexOf('function showStep(stepName)');
  assert.ok(start >= 0, 'showStep missing');
  const end = quickCollectSrc.indexOf('\n  function ', start + 1);
  const body = quickCollectSrc.slice(start, end === -1 ? undefined : end);
  assert.ok(body.includes("stepName === 'success'"), 're-trigger must run on the success entry');
  const removeAt = body.indexOf("classList.remove('qc-tick-play')");
  const reflowAt = body.indexOf('offsetWidth');
  const addAt = body.indexOf("classList.add('qc-tick-play')");
  assert.ok(removeAt > 0, 'showStep must remove the trigger class');
  assert.ok(reflowAt > removeAt, 'showStep must force a reflow after removing the class');
  assert.ok(addAt > reflowAt, 'showStep must re-add the trigger class after the reflow');
});

test('tick reduced motion: a static ✓ (drawn, unscaled, no animation)', () => {
  // The reduced-motion block lives inside the Polish 17 block (earlier
  // blocks in styles.css cover other animations).
  const polishStart = stylesSrc.indexOf('/* Polish 17');
  assert.ok(polishStart >= 0, 'Polish 17 CSS block missing');
  const polishCss = stylesSrc.slice(polishStart, stylesSrc.indexOf('/* End Polish 17', polishStart));
  const reduced = extractBalanced(polishCss, '@media (prefers-reduced-motion: reduce)');
  assert.ok(reduced.includes('.qc-check-draw'), 'reduced-motion block must cover the tick path');
  assert.ok(reduced.includes('.qc-success-check'), 'reduced-motion block must cover the tick circle');
  assert.ok(reduced.includes('animation: none'), 'reduced-motion must stop the tick animation');
  assert.ok(reduced.includes('stroke-dashoffset: 0'), 'reduced-motion must show the fully drawn check');
  assert.ok(reduced.includes('transform: none'), 'reduced-motion must not scale the circle');
});

test('tick colours: zero new hex — only the existing circle colours', () => {
  const draw = ruleBlock(stylesSrc, '.qc-check-draw {');
  const check = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check {');
  const playPop = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check.qc-tick-play {');
  const playDraw = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check.qc-tick-play .qc-check-draw {');
  const drawFrames = extractBalanced(stylesSrc, '@keyframes qc-check-draw');
  const popFrames = extractBalanced(stylesSrc, '@keyframes qc-check-pop');
  const tickCss = draw + check + playPop + playDraw + drawFrames + popFrames;
  const hex = tickCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex, [], `tick CSS must add zero hex literals, found ${hex.join(', ')}`);
  // The circle background + check stroke are the existing colours, reused
  // (background #dcfce7 in the base .qc-success-check rule, stroke #16a34a
  // in the SVG markup) — both already present in styles.css / index.html.
  assert.ok(stylesSrc.includes('background: #dcfce7'), 'circle background must stay the existing #dcfce7');
});

test('small ticks stay static text: the saved badge and the settled badge keep their ✓ text', () => {
  assert.ok(badgeSrc.includes('✓ Saved on this device'), 'saved badge must keep its static ✓ text');
  assert.ok(!badgeSrc.includes('<svg'), 'saved badge must not gain an SVG');
  assert.ok(quickCollectSrc.includes("'✓ Settle in Full'"), 'settled badge must keep its static ✓ text');
  assert.ok(!quickCollectSrc.includes('qc-check-draw'), 'nav-quick-collect.js must not draw the hero tick anywhere else');
});

test('tick boundary: the PNG / print / WhatsApp surfaces keep a static ✓', () => {
  assert.ok(quickCollectSrc.includes("'✓ Bill settled in full"), 'PNG receipt text must keep its static ✓');
  assert.ok(!quickCollectSrc.includes('qc-check-pop'), 'the pop animation must not leak into the receipt builders');
});
