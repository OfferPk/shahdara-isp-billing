// tests/neon-glass-buttons.test.js
// Neon Glassy buttons — user-told task (prep: neon-glass-buttons-prep.md).
// D1(b): ADDITIVE opt-in classes, NEVER a global redefine of the shared
// .primary-button / .secondary-button rules. The glassy classes ride
// ALONGSIDE the base class on the named surfaces only:
//   - the 9 Quick Collect buttons in index.html,
//   - the 26 primary + 50 secondary buttons inside the <div
//     class="modal-actions"> blocks in index.html,
//   - the 2 inline-bill buttons in customer-plan.js and the 3
//     Easypaisa-settings/import buttons in payments-inbox.js,
//   - the Collect Cash + Send WhatsApp CTAs in nav-pending-actions.js
//     (the Fulfill button stays .btn-success — its contrast is its own
//     item, prep §10).
// D2(a): classes in components.css (token-only, 0 hex), 5 glass tokens in
// tokens.css, dark variant in dark-contrast.css. D6(a): transition lists
// named properties only, never `all`. D7(a): this file asserts NO parity
// total and must carry NEITHER the current NOR the previous parity total
// as a bare literal anywhere, including comments (see the self-guard at
// the bottom — it uses split literals, the chain's approved form).
// The gradient stops are the CORRECTED darker stops: the spec's
// rgba(16,185,129,0.85) stop composites to #34c494 in light and white
// text on it reads 2.22:1 — the corrected stops read 6.82:1 / 9.79:1 in
// light and 8.00:1 / 11.51:1 in dark (all >= 4.5:1). The secondary tint
// reads 7.41:1 light / 12.48:1 dark. Dark dk-ink text on the two stops
// reads 7.05:1 / 10.13:1. No browser sample exists for this task (local
// headless Chrome is LNA-blocked); the 360px + on-phone contrast check is
// owed after deploy, as the PR body discloses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (n) => readFileSync(join(root, n), 'utf8');
const selfSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
const componentsCss = read('components.css');
const darkCss = read('dark-contrast.css');
const tokensCss = read('tokens.css');
const stylesCss = read('styles.css');
const navCss = read('nav.css');
const indexHtml = read('index.html');
const customerPlanJs = read('customer-plan.js');
const paymentsInboxJs = read('payments-inbox.js');
const pendingActionsJs = read('nav-pending-actions.js');

// ---- WCAG contrast helpers (same math as the prep repro) ----
const lum = (rgb) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};
const cr = (a, b) => {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const comp = (fg, bg, al) => fg.map((v, i) => Math.round(v * al + bg[i] * (1 - al)));
const WHITE = [255, 255, 255];
const LIGHT_BG = [255, 255, 255];
const DARK_MODAL = [20, 36, 31]; // [data-theme="dark"] .modal background #14241f
const DK_INK = [232, 243, 238]; // --dk-ink #e8f3ee
const SECONDARY_TEXT_LIGHT = [54, 87, 75]; // #36574b
const STOP_TOP = [6, 95, 70]; const STOP_TOP_A = 0.95; // rgba(6,95,70,0.95)
const STOP_BOTTOM = [9, 67, 56]; const STOP_BOTTOM_A = 0.95; // rgba(9,67,56,0.95)
const TINT = [16, 185, 129]; const TINT_A = 0.08; // rgba(16,185,129,0.08)

const ruleBody = (css, selector) => {
  const m = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}').exec(css);
  return m ? m[1] : null;
};
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('neon glassy: the two classes exist in components.css and the gradient rides the tokens', () => {
  const neon = ruleBody(componentsCss, '.btn-neon-glass');
  const glass = ruleBody(componentsCss, '.btn-glass-secondary');
  assert.ok(neon, '.btn-neon-glass rule missing from components.css');
  assert.ok(glass, '.btn-glass-secondary rule missing from components.css');
  assert.match(neon, /background:\s*linear-gradient\(135deg,\s*var\(--btn-glass-primary-top\),\s*var\(--btn-glass-primary-bottom\)\)/,
    'primary gradient must spell the two token vars, not literals');
  assert.match(glass, /background:\s*var\(--btn-glass-secondary-bg\)/,
    'secondary background must spell the tint token');
  assert.match(neon, /border:\s*1px solid var\(--btn-glass-primary-border\)/);
  assert.match(glass, /border:\s*1px solid var\(--btn-glass-secondary-border\)/);
  // The spec's failing stops must be nowhere in the new CSS.
  assert.ok(!((componentsCss + tokensCss).includes('rgba(16, 185, 129, 0.85)')),
    'spec gradient stop rgba(16,185,129,0.85) still present — it fails contrast');
});

test('neon glassy: the 13 glass tokens exist in tokens.css with the sim values, rgba only', () => {
  for (const [name, value] of [
    ['--btn-glass-primary-top', 'rgba(6, 95, 70, 0.95)'],
    ['--btn-glass-primary-bottom', 'rgba(9, 67, 56, 0.95)'],
    ['--btn-glass-secondary-bg', 'rgba(16, 185, 129, 0.08)'],
    ['--btn-glass-primary-border', 'rgba(110, 231, 183, 0.65)'],
    ['--btn-glass-secondary-border', 'rgba(16, 185, 129, 0.3)'],
    ['--btn-glass-glow', 'rgba(16, 185, 129, 0.45)'],
    ['--btn-glass-glow-hover', 'rgba(16, 185, 129, 0.65)'],
    ['--btn-glass-glow-soft', 'rgba(16, 185, 129, 0.25)'],
    ['--btn-glass-shadow', 'rgba(16, 185, 129, 0.12)'],
    ['--btn-glass-border-hover', 'rgba(16, 185, 129, 0.7)'],
    ['--btn-glass-highlight', 'rgba(255, 255, 255, 0.45)'],
    ['--btn-glass-highlight-strong', 'rgba(255, 255, 255, 0.8)'],
    ['--btn-glass-text-shadow', 'rgba(0, 0, 0, 0.25)'],
  ]) {
    assert.ok(tokensCss.includes(`${name}: ${value};`), `token ${name}: ${value} missing from tokens.css`);
  }
  // The five gradient/border tokens are the prep's; the eight glow /
  // shadow / highlight tokens exist because receipt-footer-studio.test.js
  // slices components.css from its SISP-96 marker to EOF and its regex
  // bans `rgba(` there — so the glassy rules must spell every colour as
  // a var(), never a literal (see the no-literals test below).
  const tokenBlock = tokensCss.slice(tokensCss.indexOf('--btn-glass-primary-top'), tokensCss.indexOf('--btn-glass-text-shadow: rgba(0, 0, 0, 0.25);') + 60);
  assert.ok(!tokenBlock.includes('#'), 'glass token values must be rgba — no hex (ratchet)');
});

test('neon glassy: contrast table recomputed in-test — every surface >= 4.5:1', () => {
  const lightTop = comp(STOP_TOP, LIGHT_BG, STOP_TOP_A);
  const lightBottom = comp(STOP_BOTTOM, LIGHT_BG, STOP_BOTTOM_A);
  const darkTop = comp(STOP_TOP, DARK_MODAL, STOP_TOP_A);
  const darkBottom = comp(STOP_BOTTOM, DARK_MODAL, STOP_BOTTOM_A);
  const ratios = {
    'white on top stop, light': cr(WHITE, lightTop),
    'white on bottom stop, light': cr(WHITE, lightBottom),
    'white on top stop, dark': cr(WHITE, darkTop),
    'white on bottom stop, dark': cr(WHITE, darkBottom),
    'dk-ink on top stop, dark': cr(DK_INK, darkTop),
    'dk-ink on bottom stop, dark': cr(DK_INK, darkBottom),
    'secondary text on tint, light': cr(SECONDARY_TEXT_LIGHT, comp(TINT, LIGHT_BG, TINT_A)),
    'dk-ink on tint, dark': cr(DK_INK, comp(TINT, DARK_MODAL, TINT_A)),
  };
  for (const [label, v] of Object.entries(ratios)) {
    assert.ok(v >= 4.5, `${label} reads ${v.toFixed(2)}:1, below 4.5:1`);
  }
});

test('neon glassy: dark override sets dk-ink text AFTER the :is(.primary-button) dark-text rule', () => {
  const isRuleIdx = darkCss.indexOf(':is(.primary-button');
  const neonDarkIdx = darkCss.indexOf('.btn-neon-glass');
  assert.ok(isRuleIdx >= 0, 'dark-contrast.css lost the :is(.primary-button) rule');
  assert.ok(neonDarkIdx > isRuleIdx, 'dark .btn-neon-glass override must sit AFTER the :is(.primary-button) rule');
  assert.match(darkCss, /\[data-theme="dark"\]\s*\.btn-neon-glass\s*\{[^}]*color:\s*var\(--dk-ink\)\s*!important[^}]*\}/,
    'dark .btn-neon-glass must set color: var(--dk-ink) !important');
  assert.match(darkCss, /\[data-theme="dark"\]\s*\.btn-glass-secondary\s*\{[^}]*background:\s*var\(--btn-glass-secondary-bg\)\s*!important[^}]*color:\s*var\(--dk-ink\)\s*!important[^}]*\}/,
    'dark .btn-glass-secondary must keep the tinted glass + dk-ink text');
  // The white slab (spec draft) must NOT be the dark secondary background.
  const darkSecondary = darkCss.slice(darkCss.indexOf('.btn-glass-secondary'), darkCss.indexOf('.btn-glass-secondary') + 600);
  assert.ok(!darkSecondary.includes('rgba(255, 255, 255, 0.65)'), 'white slab in dark secondary — it reads 1.89:1');
});

test('neon glassy: no new :focus-visible rule, no outline, no min-height/height, floor intact', () => {
  assert.ok(!/\.btn-neon-glass:focus-visible|\.btn-glass-secondary:focus-visible/.test(componentsCss + darkCss),
    'new classes must add no :focus-visible rule (589 tally)');
  const neon = ruleBody(componentsCss, '.btn-neon-glass');
  const glass = ruleBody(componentsCss, '.btn-glass-secondary');
  assert.ok(!neon.includes('outline') && !glass.includes('outline'), 'new classes must set no outline');
  assert.ok(!/min-height|[^a-z-]height\s*:/.test(neon + glass), 'new classes must set no min-height/height');
  assert.match(stylesCss, /button:not\(\[hidden\]\)\s*\{\s*min-height:\s*44px\s*!important;?\s*\}/,
    '44px button floor must stay intact');
  // D6(a): transition lists named properties only — never `all`.
  assert.ok(!/transition:[^;]*\ball\b/.test(neon + glass), 'new classes must never transition `all`');
  assert.match(neon, /transition:\s*transform 0\.2s ease, box-shadow 0\.2s ease, border-color 0\.2s ease, background-color 0\.2s ease/);
});

test('neon glassy: hover glow + lift exist; hover sets no background (base :hover colour governs — measured, disclosed)', () => {
  const neonHover = ruleBody(componentsCss, '.btn-neon-glass:hover');
  const glassHover = ruleBody(componentsCss, '.btn-glass-secondary:hover');
  assert.ok(neonHover, '.btn-neon-glass:hover missing');
  assert.ok(glassHover, '.btn-glass-secondary:hover missing');
  assert.match(neonHover, /transform:\s*translateY\(-1px\)/);
  assert.match(neonHover, /box-shadow:\s*0 0 24px var\(--btn-glass-glow-hover\)/);
  assert.match(glassHover, /border-color:\s*var\(--btn-glass-border-hover\)/);
  // The base-class :hover rules (.primary-button:hover, .secondary-button:hover,
  // .btn-primary:hover — all (0,2,0)) still set the background on hover; the
  // glassy hover rules deliberately declare none, so the button shows the
  // base hover colour + the glassy glow and lift. That is the sim's accepted
  // behaviour; pin it so a later "fix" is a deliberate decision, not drift.
  assert.ok(!/background\s*:/.test(neonHover + glassHover), 'glassy hover rules must declare no background');
  assert.match(ruleBody(componentsCss, '.btn-neon-glass:active'), /transform:\s*scale\(0\.97\)/);
  assert.match(ruleBody(componentsCss, '.btn-glass-secondary:active'), /transform:\s*scale\(0\.97\)/);
});

test('neon glassy: the new rules spell every colour as a var() — no colour literals', () => {
  // The SISP token-only tests slice components.css from their marker to
  // EOF, and receipt-footer-studio's regex also bans `rgba(` — so the
  // glassy rules must contain no colour literal at all: no rgba(, no
  // rgb(, no hex. The values live in tokens.css (13 glass tokens).
  const tail = componentsCss.slice(componentsCss.indexOf('/* Neon Glassy buttons'));
  assert.ok(tail.length > 0, 'glassy block missing from components.css');
  assert.ok(!/rgba?\s*\(/.test(tail), 'a colour literal (rgba/rgb) slipped into the glassy rules');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(tail), 'a hex literal slipped into the glassy rules');
});

test('neon glassy: the 9 QC buttons carry the glassy classes additively', () => {
  const qcOk = (id, extra, base) => {
    const m = new RegExp(`<button[^>]*id="${id}"[^>]*>`).exec(indexHtml);
    return !!m && m[0].includes(extra) && m[0].includes(base);
  };
  for (const id of ['quickCollectDirectSaveBtn', 'quickCollectConfirmSaveBtn', 'quickCollectWhatsAppBtn']) {
    assert.ok(qcOk(id, 'btn-neon-glass', 'primary-button'), `${id} must carry btn-neon-glass alongside primary-button`);
  }
  for (const id of ['quickCollectShareImageBtn', 'quickCollectPrintReceiptBtn', 'quickCollectBluetoothPrintBtn']) {
    assert.ok(qcOk(id, 'btn-glass-secondary', 'secondary-button'), `${id} must carry btn-glass-secondary alongside secondary-button`);
  }
  assert.equal((indexHtml.match(/class="secondary-button qc-next-btn btn-glass-secondary"/g) || []).length, 2,
    'both .qc-next-btn buttons must carry btn-glass-secondary');
  assert.match(indexHtml, /id="quickCollectDoneCloseBtn"[^>]*class="secondary-button qc-done-btn btn-glass-secondary"/,
    'quickCollectDoneCloseBtn must carry btn-glass-secondary');
});

test('neon glassy: every modal-actions button in index.html is glassy (26 primary + 50 secondary)', () => {
  const opens = [...indexHtml.matchAll(/<div class="modal-actions[^"]*"/g)].map((m) => m.index);
  assert.equal(opens.length, 26, `modal-actions blocks: ${opens.length}, expected 26`);
  let primary = 0, secondary = 0, bare = 0;
  for (const o of opens) {
    let i = o, depth = 0, end = -1;
    while (true) {
      const m = /<(\/?)div\b[^>]*>/.exec(indexHtml.slice(i));
      assert.ok(m, 'unbalanced div inside a modal-actions block');
      if (m[1] === '') depth += 1;
      else {
        depth -= 1;
        if (depth === 0) { end = i + m.index + m[0].length; break; }
      }
      i += m.index + m[0].length;
    }
    const block = indexHtml.slice(o, end);
    for (const tag of block.match(/<button\b[^>]*>/g) || []) {
      const cls = (/class="([^"]*)"/.exec(tag) || [])[1]?.split(/\s+/) || [];
      if (cls.includes('primary-button') && cls.includes('btn-neon-glass')) primary += 1;
      else if (cls.includes('secondary-button') && cls.includes('btn-glass-secondary')) secondary += 1;
      else if (cls.includes('primary-button') || cls.includes('secondary-button')) bare += 1;
    }
  }
  assert.equal(bare, 0, `${bare} modal-actions button(s) left without a glassy class`);
  assert.equal(primary, 26, `glassy primary buttons in modal-actions: ${primary}, expected 26`);
  assert.equal(secondary, 50, `glassy secondary buttons in modal-actions: ${secondary}, expected 50`);
});

test('neon glassy: JS-template buttons are glassy (customer-plan 2, payments-inbox 3, pending CTAs 2)', () => {
  assert.match(customerPlanJs, /id="inlineBillCancelBtn" class="secondary-button btn-glass-secondary"/);
  assert.match(customerPlanJs, /id="inlineBillSaveBtn" class="primary-button btn-neon-glass"/);
  assert.match(paymentsInboxJs, /<button type="submit" class="primary-button btn-neon-glass">Save Settings<\/button>/);
  assert.match(paymentsInboxJs, /<button type="button" class="secondary-button btn-glass-secondary" data-close-settings>Cancel<\/button>/);
  assert.match(paymentsInboxJs, /<button type="button" class="secondary-button btn-glass-secondary" data-close-import>Close<\/button>/);
  assert.match(pendingActionsJs, /class="btn-primary pending-collect-btn btn-neon-glass"/);
  assert.match(pendingActionsJs, /class="btn-primary pending-wa-btn btn-neon-glass"/);
  // Scope pin: the Fulfill button stays .btn-success — its contrast is its
  // own item (prep §10); Mark Shared / Call / Postpone are likewise unnamed.
  assert.ok(!pendingActionsJs.includes('pending-fulfill-btn btn-neon-glass'),
    'Fulfill must NOT carry the glassy class (own item)');
});

test('neon glassy: the .pending-wa-btn scoped override is measured and beaten (0,3,0 > 0,2,0)', () => {
  // nav.css still carries the (0,2,0) scoped rule that beats plain .btn-neon-glass.
  assert.match(navCss, /\.pending-card-receipt\s+\.pending-wa-btn\s*\{[^}]*background:\s*var\(--ds-brand, #0F5338\);/);
  // components.css re-asserts the gradient on that element only, at (0,3,0).
  const m = /\.pending-card-receipt\s+\.pending-wa-btn\.btn-neon-glass\s*\{([^}]*)\}/.exec(componentsCss);
  assert.ok(m, 'scoped .pending-card-receipt .pending-wa-btn.btn-neon-glass rule missing');
  assert.match(m[1], /background:\s*linear-gradient\(135deg,\s*var\(--btn-glass-primary-top\),\s*var\(--btn-glass-primary-bottom\)\)/);
  const classes = ('.pending-card-receipt .pending-wa-btn.btn-neon-glass'.match(/\.[a-z-]+/g) || []).length;
  assert.equal(classes, 3, 're-assertion selector must carry 3 classes (specificity 0,3,0)');
});

test('neon glassy: shared rules, token values and hex ratchets unchanged', () => {
  // plan493/497 pin: the shared .primary-button rule text, verbatim.
  assert.match(stylesCss, /\.primary-button\{border:1px solid var\(--green\);background:var\(--green\);color:white\}/);
  // 588: .btn-primary still rides the brand token; the danger variant untouched.
  assert.match(navCss, /^\.btn-primary\s*\{[^}]*background:\s*var\(--color-brand-600, #0e5b4d\);/m);
  assert.match(read('bulk-collect.css'), /\.primary-button\.qc-duplicate-proceed\s*\{[^}]*background:\s*var\(--color-danger\)/);
  // 587: .btn-sm standalone class-token count in index.html still 1314.
  const btnSmCount = [...indexHtml.matchAll(/class="([^"]*)"/g)]
    .flatMap((m) => m[1].split(/\s+/)).filter((t) => t === 'btn-sm').length;
  assert.equal(btnSmCount, 1314, `.btn-sm count: ${btnSmCount}, expected 1314`);
  // Hex ratchets: styles 608 / nav 163 / dark 19 / components 0 / tokens 117.
  const distinctHex = (s) => new Set(stripComments(s).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).size;
  assert.deepEqual(
    { styles: distinctHex(stylesCss), nav: distinctHex(navCss), dark: distinctHex(darkCss), comp: distinctHex(componentsCss), tokens: distinctHex(tokensCss) },
    { styles: 608, nav: 163, dark: 19, comp: 0, tokens: 117 },
    'a hex ratchet moved — the glassy change must be token-only (rgba)');
});

test('neon glassy: this file asserts no parity total and carries neither parity literal', () => {
  // G5a discipline: a new test file must never contain the bare digits of
  // the current or the previous parity total, anywhere — including
  // comments. Split literals keep the guard itself clean.
  assert.ok(!selfSrc.includes('51' + '62'), 'file contains the current parity total as a bare literal');
  assert.ok(!selfSrc.includes('51' + '61'), 'file contains the previous parity total as a bare literal');
  assert.ok(!selfSrc.includes('nav-' + 'language.js'), 'this file must not assert a parity total');
});
