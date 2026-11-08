// Polish 17 (Req 3) — Animated green tick: the hero tick on the Quick
// Collect success screen is an inline SVG check that draws itself and
// pops in (Lottie-style), built with SVG + CSS keyframes — NOT Lottie
// (no new dependency, fully offline). It plays once per showing, then
// rests as a clear green ✓; prefers-reduced-motion shows a static ✓.
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

test('tick markup: the hero tick is the inline SVG check (not the text glyph), inside the same circle', () => {
  const spanStart = pageSrc.indexOf('<span class="qc-success-check"');
  assert.ok(spanStart >= 0, 'hero tick span missing');
  const spanEnd = pageSrc.indexOf('</span>', spanStart);
  const span = pageSrc.slice(spanStart, spanEnd);
  assert.ok(span.includes('aria-hidden="true"'), 'tick stays aria-hidden (the heading announces success)');
  assert.ok(!span.includes('✓'), 'hero tick must not be the text glyph any more');
  assert.ok(span.includes('<svg viewBox="0 0 24 24" width="26" height="26" fill="none">'), 'tick must be the 26px SVG');
  assert.ok(span.includes('<path class="qc-check-draw" d="M5 12.5l4.5 4.5L19 7.5"'), 'tick path must be the design check');
  assert.ok(span.includes('stroke="#16a34a"'), 'tick stroke must reuse the existing check green');
  assert.ok(span.includes('stroke-width="3"'), 'tick stroke must be 3px');
  assert.ok(span.includes('stroke-linecap="round"'), 'tick must have round caps');
  assert.ok(span.includes('stroke-linejoin="round"'), 'tick must have round joins');
});

test('tick draw: the path starts fully hidden (dashoffset 24) and draws once in ~0.6s', () => {
  const draw = ruleBlock(stylesSrc, '.qc-check-draw {');
  assert.ok(draw.includes('stroke-dasharray: 24'), 'path length must be 24');
  assert.ok(draw.includes('stroke-dashoffset: 24'), 'path must start fully hidden');
  assert.ok(draw.includes('animation: qc-check-draw .6s ease-out .1s forwards'), 'path must draw in 0.6s after a 0.1s delay, once, forwards');
  assert.ok(!draw.includes('infinite'), 'path animation must not loop');
  assert.ok(!draw.includes('qc-check-pop'), 'the pop lives on the circle span only (no double-scaling the path)');
  const keyframes = extractBalanced(stylesSrc, '@keyframes qc-check-draw');
  assert.ok(keyframes.includes('stroke-dashoffset: 0'), 'draw keyframes must end at dashoffset 0 (fully drawn)');
});

test('tick pop: the circle pops once on arrival (scale .6 → 1.08 → 1)', () => {
  const check = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check {');
  assert.ok(check.includes('animation: qc-check-pop .45s cubic-bezier(.2,1.4,.4,1) forwards'), 'circle must pop in 0.45s, once, forwards');
  assert.ok(!check.includes('infinite'), 'pop animation must not loop');
  const keyframes = extractBalanced(stylesSrc, '@keyframes qc-check-pop');
  assert.ok(keyframes.includes('transform: scale(.6)'), 'pop must start at scale .6');
  assert.ok(keyframes.includes('transform: scale(1.08)'), 'pop must overshoot to 1.08');
  assert.ok(keyframes.includes('transform: scale(1)'), 'pop must rest at scale 1');
});

test('tick replay: un-hiding the success step restarts the animation (showStep toggles hidden)', () => {
  assert.ok(quickCollectSrc.includes("if (stepSuccess) stepSuccess.hidden = (stepName !== 'success');"), 'showStep must toggle the success step hidden flag (the replay mechanism)');
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
  const drawFrames = extractBalanced(stylesSrc, '@keyframes qc-check-draw');
  const popFrames = extractBalanced(stylesSrc, '@keyframes qc-check-pop');
  const tickCss = draw + check + drawFrames + popFrames;
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
