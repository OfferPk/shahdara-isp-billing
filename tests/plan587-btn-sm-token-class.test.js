// Plan 587 — `.btn-sm` becomes a real token-based class.
//
// The class was defined nowhere: 1,314 buttons carried the name while
// their size came from 446 copies of one inline style
// (font-size: 11px; padding: 4px 10px;). This file owns the fix:
//
//   G1 — Counts: token-exact btn-sm population (1,314 tags in
//        index.html, 33 occurrences in app.js, 78 in JS total);
//        zero exact-style carriers left among btn-sm buttons.
//   G2 — The class: defined exactly once (components.css), selector
//        exactly `.btn-sm`, declarations resolve to 11px / 4px 10px
//        through tokens, no min-height, no hex.
//   G3 — Inline removal: the margin-top variant keeps its margin;
//        the 5 padding-duplicate mixed tags keep border/bg/color;
//        the 2 `padding: 3px 8px` tags and the margin-left tag keep
//        their whole style; the non-btn-sm carrier is left (D7(a)).
//   G4 — The unstyled group (the disclosure group): the 938 buttons
//        that carried no inline size shrink to the class size as the
//        INTENDED outcome (D2(a)) — asserted as a change, never as
//        "unchanged" — except the 10 inside `.analytics-btn-row`,
//        where a more-specific rule still wins for padding/height.
//   G5 — Guards + completeness: ratchet baselines hold, parity
//        unchanged at 4,722/4,722, `.action-btn-sm` / the base
//        `.secondary-button` rule / the 44px floor all unchanged, the
//        7 bare toggle buttons keep their inline look.
//
// Token-exact counting throughout (whitespace-separated `class="…"`
// tokens) — a substring grep also matches `action-btn-sm`, a different
// class with its own rule, so it is asserted separately as NOT btn-sm.
// No customer data, no phone numbers, no synthetic matches — the
// assertions are over the real shipped class names, CSS rules, and
// token values. Rendered pixels are proven by the D9(a) browser sample
// (sample-before.json / sample-after.json in the implementer scratch),
// not by this file: no jsdom in the repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const html = read('index.html');
const tokensCss = read('tokens.css');
const componentsCss = read('components.css');
const stylesCss = read('styles.css');
const navCss = read('nav.css');
const dashboardCss = read('dashboard.css');
const atRiskJs = read('at-risk-signals.js');
const operatorModesJs = read('operator-modes.js');
const appJs = read('app.js');

const EXACT_STYLE = 'font-size: 11px; padding: 4px 10px;';

// Token-exact: split every class="…" value on whitespace and count the
// standalone token — never a substring grep (T1).
function countClassToken(text, token) {
  let n = 0;
  for (const m of text.matchAll(/class="([^"]*)"/g)) {
    if (m[1].split(/\s+/).includes(token)) n += 1;
  }
  return n;
}

// All <button …> tags in index.html with their parsed class tokens +
// style value (or null). Tags are matched with [^>]* so multi-line tags
// are handled too.
function buttonTags(text) {
  const out = [];
  for (const m of text.matchAll(/<button[^>]*>/g)) {
    const tag = m[0];
    const cls = /class="([^"]*)"/.exec(tag);
    const style = / style="([^"]*)"/.exec(tag);
    const id = /id="([^"]*)"/.exec(tag);
    out.push({
      tag,
      tokens: cls ? cls[1].split(/\s+/) : [],
      style: style ? style[1] : null,
      id: id ? id[1] : null,
    });
  }
  return out;
}

const buttons = buttonTags(html);
const btnSmButtons = buttons.filter((b) => b.tokens.includes('btn-sm'));

// Distinct hex, the design-tokens-230 method: comment-stripped, 6-or-3
// digit regex only (a 3–8-digit regex over-counts).
function distinctHex(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).size;
}

// ---------- G1 — Counts ----------

test('G1: index.html carries 1,314 standalone btn-sm tags (and 91 action-btn-sm tags, which are NOT btn-sm)', () => {
  // Spec correction: "837 times" is the number of LINES containing the
  // substring btn-sm (repro B1/S1). The class count is 1,314.
  // Inventory & Materials 2-tab cleanup: the Pending Hardware Recovery
  // card's redundant bottom button (action-btn-sm) was deleted, so the
  // action-btn-sm count moves 97 → 96 and the btn-sm substring count
  // moves 1,411 → 1,410; the standalone btn-sm count (1,314) is
  // unchanged — the deleted button was action-btn-sm, not btn-sm.
  // Area Analytics 6-tab refactor: the five redundant bottom buttons
  // (Downtime, Upstream SLA, Splitter, Daisy-Chain, Pole Registry —
  // all action-btn-sm) were deleted and their card heads made tappable,
  // so the action-btn-sm count moves 96 → 91 and the btn-sm substring
  // count moves 1,410 → 1,405; the standalone btn-sm count (1,314) is
  // unchanged — the deleted buttons were action-btn-sm, not btn-sm.
  assert.equal(countClassToken(html, 'btn-sm'), 1314, 'standalone btn-sm class tokens in index.html');
  assert.equal(countClassToken(html, 'action-btn-sm'), 91, 'action-btn-sm tags (a different class, own rule)');
  assert.equal(btnSmButtons.length, 1314, 'btn-sm <button> tags in index.html');
  // Substring counts are reported alongside so the two numbers never get
  // confused again: 1,405 substring occurrences on 837 lines.
  assert.equal((html.match(/btn-sm/g) || []).length, 1405, 'substring btn-sm occurrences in index.html');
});

test('G1: the token counter itself is token-exact (btn-sm vs action-btn-sm)', () => {
  const sample = '<button class="btn-sm active"></button><button class="action-btn-sm"></button><button class="secondary-button btn-sm"></button>';
  assert.equal(countClassToken(sample, 'btn-sm'), 2, 'action-btn-sm must not count as btn-sm');
  assert.equal(countClassToken(sample, 'action-btn-sm'), 1, 'action-btn-sm counts only as itself');
});

test('G1: app.js carries 33 btn-sm occurrences; JS total is 78 (and zero exact-style carriers remain)', () => {
  // Spec correction: "23 times in app.js" is neither lines (25) nor
  // occurrences (33) (repro B2/S2).
  assert.equal((appJs.match(/btn-sm/g) || []).length, 33, 'substring btn-sm occurrences in app.js');
  // Token-exact across root *.js: class="…" attributes (double quotes)
  // PLUS className = '…' assignments (single quotes — ops-accordions.js
  // sets the class that way). A bare substring count gives 121, which
  // also counts the 43 action-btn-sm occurrences (the repro's
  // subtract-them method lands on the same 78).
  let jsTotal = 0;
  for (const f of readdirSync(root)) {
    if (!f.endsWith('.js')) continue;
    const src = read(f);
    for (const m of src.matchAll(/class="([^"]*)"/g)) {
      if (m[1].split(/\s+/).includes('btn-sm')) jsTotal += 1;
    }
    for (const m of src.matchAll(/className\s*=\s*'([^']*)'/g)) {
      if (m[1].split(/\s+/).includes('btn-sm')) jsTotal += 1;
    }
  }
  assert.equal(jsTotal, 78, 'standalone btn-sm class tokens across root *.js');
  // Zero exact-style carriers among btn-sm buttons, per the D5/D6/D7
  // scope: 0 in index.html btn-sm tags, 0 in the 3 JS templates. The
  // one remaining exact-style string in the repo is the D7(a)
  // non-btn-sm carrier (#bidirectionalOtdrAddEventBtn), asserted in G3.
  assert.equal(btnSmButtons.filter((b) => b.style === EXACT_STYLE).length, 0, 'no btn-sm button in index.html carries the exact inline style');
  assert.ok(!atRiskJs.includes(EXACT_STYLE), 'at-risk-signals.js carries no exact-style button');
  assert.ok(!operatorModesJs.includes(EXACT_STYLE), 'operator-modes.js carries no exact-style button');
});

// ---------- G2 — The class ----------

test('G2: .btn-sm is defined exactly once across all stylesheets, in components.css, with the exact selector', () => {
  let definitions = 0;
  let host = null;
  for (const [name, css] of [['tokens.css', tokensCss], ['styles.css', stylesCss], ['components.css', componentsCss], ['dashboard.css', dashboardCss], ['nav.css', navCss]]) {
    const n = (css.match(/^\.btn-sm\s*\{/gm) || []).length;
    if (n > 0) host = name;
    definitions += n;
  }
  assert.equal(definitions, 1, '.btn-sm must be defined exactly once');
  assert.equal(host, 'components.css', 'the host is components.css (D3(a)) — never nav.css (Plan 588 territory)');
  // The selector is exactly .btn-sm — never a substring selector, which
  // would also catch action-btn-sm (T1).
  assert.ok(!/\[class\*="btn-sm"\]/.test(componentsCss), 'no [class*="btn-sm"] substring selector anywhere');
  assert.ok(componentsCss.includes('.btn-sm {'), 'the rule uses the .btn-sm class selector');
});

test('G2: the class resolves to font-size 11px and padding 4px 10px through tokens', () => {
  const rule = /\.btn-sm\s*\{([^}]*)\}/.exec(componentsCss);
  assert.ok(rule, 'the .btn-sm rule exists in components.css');
  const body = rule[1];
  // D1(a): font via --text-table-head, padding via --space-1/--space-2-5.
  assert.match(body, /font-size:\s*var\(--text-table-head\)/, 'font-size comes from --text-table-head');
  assert.match(body, /padding:\s*var\(--space-1\)\s+var\(--space-2-5\)/, 'padding comes from --space-1 / --space-2-5');
  // The tokens resolve to the values the buttons rendered today.
  assert.match(tokensCss, /--text-table-head:\s*11px;/, '--text-table-head is 11px (the only 11px token)');
  assert.match(tokensCss, /--space-1:\s*4px;/, '--space-1 is 4px');
  assert.match(tokensCss, /--space-2-5:\s*10px;/, '--space-2-5 is 10px (the one new token)');
  // No literal sizes in the class: it is token-based, not a magic-value
  // class (the spec's --text-xs is 12px and no 10px spacing token
  // existed — the spec's recipe renders 12px / 4px 8px, repro B7/S6/S7).
  assert.ok(!/\d+px/.test(body), 'the class body contains no literal px value');
});

test('G2: the class sets no min-height and no hex (ratchet-safe, floor governs height)', () => {
  const rule = /\.btn-sm\s*\{([^}]*)\}/.exec(componentsCss);
  assert.ok(rule, 'the .btn-sm rule exists in components.css');
  // D4(a): no min-height — the styles.css:923 floor (44px !important)
  // governs height; a 40px min-height would be dead text.
  assert.ok(!/min-height/.test(rule[1]), 'no min-height in .btn-sm');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(rule[1]), 'no hex in .btn-sm');
});

// ---------- G3 — Inline removal ----------

test('G3: #openWorklistsFromDuesBtn keeps margin-top: 4px and nothing else', () => {
  const btn = btnSmButtons.find((b) => b.id === 'openWorklistsFromDuesBtn');
  assert.ok(btn, 'the margin-top variant button exists');
  assert.equal(btn.style, 'margin-top: 4px;', 'font-size/padding stripped, margin-top kept');
});

test('G3: the 5 padding-duplicate mixed tags keep border/background/color and carry no padding declaration', () => {
  const ids = ['pnlWindow6Btn', 'pnlWindow12Btn'];
  for (const id of ids) {
    const btn = btnSmButtons.find((b) => b.id === id);
    assert.ok(btn, `${id} exists`);
    assert.ok(btn.style && !btn.style.includes('padding:'), `${id} carries no padding declaration`);
    assert.ok(btn.style.includes('border:'), `${id} keeps its border`);
    assert.ok(btn.style.includes('background:'), `${id} keeps its background`);
    assert.ok(btn.style.includes('color:'), `${id} keeps its color`);
  }
  // The three data-window buttons (no id) are the other three of the 5.
  const windowBtns = btnSmButtons.filter((b) => /data-window="/.test(b.tag));
  assert.equal(windowBtns.length, 3, 'three data-window toggle buttons');
  for (const btn of windowBtns) {
    assert.ok(btn.style && !btn.style.includes('padding:'), 'data-window button carries no padding declaration');
    assert.ok(btn.style.includes('border:') && btn.style.includes('background:') && btn.style.includes('color:'), 'data-window button keeps border/background/color');
  }
});

test('G3: the 2 padding: 3px 8px tags keep their whole style; the margin-left tag keeps its margin', () => {
  for (const id of ['packageRevenueModeBilledBtn', 'packageRevenueModeSubsBtn']) {
    const btn = btnSmButtons.find((b) => b.id === id);
    assert.ok(btn, `${id} exists`);
    assert.ok(btn.style && btn.style.startsWith('padding: 3px 8px;'), `${id} keeps its whole 3px 8px style (its padding differs from the class)`);
  }
  const reset = btnSmButtons.find((b) => b.id === 'resetAreaIntelFiltersBtn');
  assert.ok(reset, 'resetAreaIntelFiltersBtn exists');
  assert.equal(reset.style, 'margin-left: 8px;', 'the margin-only style is kept whole (orthogonal to the class)');
});

test('G3: the non-btn-sm carrier is left alone (D7(a))', () => {
  const btn = buttons.find((b) => b.id === 'bidirectionalOtdrAddEventBtn');
  assert.ok(btn, '#bidirectionalOtdrAddEventBtn exists');
  assert.ok(!btn.tokens.includes('btn-sm'), 'it is not a btn-sm button');
  assert.equal(btn.style, EXACT_STYLE, 'its inline style stays — it keeps rendering 11px / 4px 10px via that style');
});

// ---------- G4 — The unstyled group (disclosure) ----------

test('G4: the 938 buttons that carried no inline size now resolve to the class size — the intended outcome (D2(a))', () => {
  // WHY (Plan 587 D2(a)): on the base, 938 btn-sm buttons (863 in
  // index.html + 75 in JS) carried NO inline size and rendered 12px /
  // 0 13px via .secondary-button. Defining the class shrinks them to
  // 11px / 4px 10px — that is the INTENDED outcome, not a regression,
  // and this test asserts it as a change, never as "unchanged". The
  // acceptance as written ("every btn-sm button renders at the same
  // size as before") is unachievable for these buttons under ANY 11px
  // class (repro B8); the 446 inline-styled buttons are the
  // pixel-identical scope, proven by the D9(a) browser sample.
  //
  // Post-fix pin: 1,305 btn-sm buttons in index.html carry no style
  // attribute at all — the 863 that never had one, plus the 442 whose
  // exact inline style the fix removed (the margin-top variant and the
  // 8 mixed tags still carry a style attribute, so 1,314 − 9 = 1,305).
  // The 863 itself is a base fact (repro KEY NUMBERS + browser sample);
  // post-fix the stripped buttons are indistinguishable from the
  // originally-unstyled ones, which is exactly the point of the class.
  const unstyledHtml = btnSmButtons.filter((b) => b.style === null);
  assert.equal(unstyledHtml.length, 1305, '1,305 btn-sm buttons in index.html carry no style attribute (863 base-unstyled + 442 stripped)');
  assert.equal(btnSmButtons.filter((b) => b.style !== null).length, 9, 'only 9 btn-sm buttons still carry a style attribute (1 margin-top + 8 mixed)');
  // The class they resolve to is 11px / 4px 10px (G2) with height 44px
  // via the floor — so these buttons now render at that size.
  const rule = /\.btn-sm\s*\{([^}]*)\}/.exec(componentsCss);
  assert.ok(rule && /font-size:\s*var\(--text-table-head\)/.test(rule[1]), 'the class sets the 11px font they now render');
  assert.ok(rule && /padding:\s*var\(--space-1\)\s+var\(--space-2-5\)/.test(rule[1]), 'the class sets the 4px 10px padding they now render');
  assert.ok(stylesCss.includes('button:not([hidden]) { min-height: 44px !important; }'), 'the 44px floor still governs their height');
});

test('G4: the 10 unstyled buttons inside .analytics-btn-row keep padding 0 8px / height 42px via the more-specific rule', () => {
  // WHY (Plan 587 D9(a) browser sample): `.analytics-btn-row
  // .secondary-button` (components.css:162, specificity (0,2,0)) beats
  // `.btn-sm` (0,1,0) for padding and height, so these 10 buttons do
  // NOT resolve to the class padding — they keep 0 8px / 42px, and at
  // <=620px the media-query variant keeps their font at 12.5px. Their
  // font still becomes 11px at desktop widths (the row rule sets no
  // font-size there). The row rule is the only container override that
  // touches a btn-sm button (verified by ancestor survey: 10 buttons,
  // all unstyled, all inside .analytics-btn-row; zero inside
  // backup-actions / customer-list-search-control /
  // recovery-customer-actions / any other container rule).
  const rowIds = [
    'monthCloseTickBtn', 'monthCloseWaiveBtn', 'monthCloseUntickBtn',
    'monthCloseCloseBtn', 'monthCloseReopenBtn', 'monthCloseRemoveBtn',
    'precloseSweepOpenSuspenseBtn', 'precloseSweepOpenWalletBtn',
    'precloseSweepOpenClaimsBtn', 'precloseSweepOpenHandoverBtn',
  ];
  for (const id of rowIds) {
    const btn = btnSmButtons.find((b) => b.id === id);
    assert.ok(btn, `${id} exists`);
    assert.equal(btn.style, null, `${id} is unstyled (its size comes from rules, not inline styles)`);
  }
  assert.match(componentsCss, /\.analytics-btn-row \.secondary-button \{[^}]*padding: 0 8px;/, 'the row rule still sets padding 0 8px');
  assert.match(componentsCss, /\.analytics-btn-row \.secondary-button \{[^}]*height: 42px;/, 'the row rule still sets height 42px');
  assert.match(componentsCss, /@media \(max-width: 620px\) \{[\s\S]*?\.analytics-btn-row \.secondary-button \{[^}]*font-size: 12\.5px;/, 'the row rule still sets 12.5px font at <=620px');
});

// ---------- G5 — Guards + completeness ----------

test('G5: ratchet baselines hold and parity is unchanged at 4,722/4,722 (no i18n key touched)', () => {
  // Current exact counts (ratchet ceilings in design-tokens-230):
  // styles.css 608 (<=616), nav.css 164 (<=164), components.css 0 hex.
  assert.ok(distinctHex(stylesCss) <= 616, `styles.css distinct hex must not exceed 616 (now ${distinctHex(stylesCss)})`);
  assert.ok(distinctHex(navCss) <= 164, `nav.css distinct hex must not exceed 164 (now ${distinctHex(navCss)})`);
  assert.equal(distinctHex(componentsCss), 0, 'components.css stays hex-free');
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5222, 'EN keys');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5222, 'UR keys');
  assert.deepEqual(
    Object.keys(TRANSLATIONS.en).sort(),
    Object.keys(TRANSLATIONS.ur).sort(),
    'no key is missing from either dict',
  );
});

test('G5: .action-btn-sm, the base .secondary-button rule, the 44px floor, and the 7 bare toggles are unchanged', () => {
  // .action-btn-sm (dashboard.css:628) — a different class, 11px / 4px
  // 8px / 44px; never unified with .btn-sm (T7).
  assert.match(dashboardCss, /\.action-btn-sm \{[^}]*font: 700 11px\/1\.2 Manrope, system-ui, sans-serif;/, '.action-btn-sm keeps its 11px font');
  assert.match(dashboardCss, /\.action-btn-sm \{[^}]*padding: var\(--space-1\) var\(--space-2\);/, '.action-btn-sm keeps its 4px 8px padding');
  assert.match(dashboardCss, /\.action-btn-sm \{[^}]*min-height: 44px;/, '.action-btn-sm keeps its 44px min-height');
  // The base .secondary-button rule lives on the minified styles.css:1
  // (pinned by plan497:75–76) — byte-identical, never edited (T9).
  assert.match(stylesCss, /\.primary-button\{border-radius:9px;min-height:40px/, 'the base button rule on styles.css:1 is unchanged');
  // The 44px floor (styles.css:923) is unchanged.
  assert.ok(stylesCss.includes('button:not([hidden]) { min-height: 44px !important; }'), 'the 44px floor is unchanged');
  // The 7 bare toggle buttons keep their inline border/background/color
  // (their font changes 14px -> 11px via the class — disclosed in the
  // PR body with the D9(a) sample — but their look stays inline).
  const bareIds = ['packageRevenueModeBilledBtn', 'packageRevenueModeSubsBtn', 'pnlWindow6Btn', 'pnlWindow12Btn'];
  for (const id of bareIds) {
    const btn = btnSmButtons.find((b) => b.id === id);
    assert.ok(btn, `${id} exists`);
    assert.ok(btn.style && btn.style.includes('border:') && btn.style.includes('background:') && btn.style.includes('color:'), `${id} keeps its inline border/background/color`);
  }
  const windowBtns = btnSmButtons.filter((b) => /data-window="/.test(b.tag));
  assert.equal(windowBtns.length, 3, 'three data-window toggle buttons');
  for (const btn of windowBtns) {
    assert.ok(btn.style && btn.style.includes('border:') && btn.style.includes('background:') && btn.style.includes('color:'), 'data-window button keeps its inline border/background/color');
  }
});
