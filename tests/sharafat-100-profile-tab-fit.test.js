// Sharafat 100 — profile tabs fit at 360px with counts (re-scope B).
//
// The spec as written asked for wrap/ellipsis on the VIEW-NAV buttons at
// ≤620px — but the view-nav is display:none there (styles.css:1941–1942),
// its 9 labels are EN-only, and its buttons render 13px and never clip
// where they render. The spec's defect does not exist. The real measured
// defect in the area is the PROFILE-tab row overflowing at 360px with
// counts — EN +95px, UR +45px nested in the real container, Baqaya
// off-screen until the tab row is swiped — and this item fixes that
// (parent decision D1-B; see ~/workspace/sharafat-100-prep.md).
//
// Fix (parent D3/D4/D6): at ≤620px the label span truncates with an
// ellipsis (min-width:0 lets the equal flex shares shrink below content
// width) and the count lives in its own span that never shrinks; the
// count keys hold only the "(N)" suffix now — "Complaints (2 open)" →
// "Complaints (2)", UR "شکایات (2 کھلی)" → "شکایات (2)".
//
// Measured (Chromium headless-shell, real markup + real CSS inlined,
// 0 pageerrors — measure-100-fixed.mjs, ~/workspace/.sharafat100-scratch/):
//   base 18b185dd:  360px EN +95px / UR +45px overflow (Baqaya off-screen)
//   fixed:          360px EN 0px / UR 0px overflow — all 4 tabs 70px each,
//                   13px, 44px tall; 320px EN 0px / UR 0px — all 4 tabs 60px.
// Honest limit (D3-a, decided): "Complaints" (~74px of text) still
// truncates to an ellipsis inside its ~70px equal share at 360px —
// that is the decided shape, not a failure: the tab row no longer
// overflows, the count "(2)" stays fully visible (16.3px), and the
// label's title carries the full text. No font shrink (D5: tabs stay
// 13px), no two-line wrap (would fight the 44px pin).
//
// On-phone 360px check stays open (D9): Nastaliq is wider than the
// shell's fallback font, so real-phone UR overflow may exceed the
// measured +45px the fix removes.
//
// Test shape (repo convention for fit items): source-shape pins +
// recorded harness numbers. The live Chromium check is the repro
// (~/workspace/.sharafat100-scratch/repro-100.mjs): on base it fails
// exactly V4 EN + V4 UR (+ the V1/V2/V3 guards, which must never flip);
// on the fixed tree V4 EN + V4 UR pass and the guards stay as they are.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const styles = read('styles.css');
const navCss = read('nav.css');
const components = read('components.css');
const html = read('index.html');
const app = read('app.js');
const lang = read('nav-language.js');
const test97 = read('tests/sharafat-97-text-floor.test.js');

// First matching rule block for a selector (ds0 ruleBlock semantics).
function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

// The Sharafat 100 ≤620px fit rule block (comment-anchored, after the
// :1765 ≤620px block): from the marker comment to the media block's close.
function fitRuleBlock() {
  const marker = styles.indexOf('Sharafat 100 (D3/D6)');
  assert.ok(marker >= 0, 'the Sharafat 100 fit rule must be present');
  const media = styles.indexOf('@media (max-width: 620px) {', marker);
  assert.ok(media >= 0, 'the fit rule must live in its own ≤620px media block');
  let depth = 0;
  let i = styles.indexOf('{', media);
  for (; i < styles.length; i += 1) {
    if (styles[i] === '{') depth += 1;
    else if (styles[i] === '}') { depth -= 1; if (depth === 0) break; }
  }
  return styles.slice(media, i + 1);
}

function hexCount(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(noComments.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).size;
}

function updateCountsBody() {
  const start = app.indexOf('function updateProfileTabCounts(customer)');
  assert.notEqual(start, -1, 'updateProfileTabCounts must exist');
  return app.slice(start, app.indexOf('\nmountCustomerProfileContent();', start));
}

// --- R — repro port (11): V1/V2/V3 are guards that must never flip;
// V4 EN/UR are the fix; V5–V9 stay green. -----------------------------

test('R1 V1 guard: the view-nav stays display:none at ≤620px — the spec premise is void, never "fix" it', () => {
  const at = styles.indexOf('.view-nav{display:none}');
  assert.ok(at >= 0, 'the ≤620px hide rule must still exist');
  assert.ok(styles.slice(Math.max(0, at - 80), at).includes('max-width:620px'), 'the hide rule must sit in the ≤620px media block');
  assert.ok(!styles.includes('.view-nav{display:block') && !styles.includes('.view-nav{display:flex'), 'nothing re-displays the view-nav at ≤620px');
});

test('R2 V2 non-target: no view-nav-button rule sets wrap/ellipsis — there is nothing to wrap', () => {
  const bodies = [...styles.matchAll(/\.view-nav-button[^{]*\{[^}]*\}/g)].map((m) => m[0]);
  assert.ok(bodies.length >= 9, `expected the view-nav-button rules to still exist (found ${bodies.length})`);
  for (const body of bodies) {
    assert.ok(!/white-space|overflow|text-overflow/.test(body), `a view-nav-button rule must not gain wrap/ellipsis handling: ${body.slice(0, 80)}`);
  }
});

test('R3 V3 non-target: the 9 view-nav buttons carry no title — titles were not the fix (D7)', () => {
  const nav = html.slice(html.indexOf('<nav class="view-nav"'), html.indexOf('</nav>', html.indexOf('<nav class="view-nav"')));
  const buttons = nav.match(/<button[^>]*class="view-nav-button"[^>]*>/g) || [];
  assert.equal(buttons.length, 9, 'the view-nav must still carry exactly 9 buttons');
  assert.ok(!buttons.some((b) => b.includes('title=')), 'no view-nav button gains a title attribute');
});

test('R4 V4 EN: the ≤620px profile-tab fit rule exists and the EN count keys are the short suffix form', () => {
  const fit = fitRuleBlock();
  assert.ok(fit.includes('.profile-tabs .profile-tab-button{display:flex;align-items:center;justify-content:center;min-width:0}'), 'buttons become flex at ≤620px with min-width:0 so the equal shares can shrink');
  assert.ok(fit.includes('.profile-tabs .profile-tab-button .profile-tab-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}'), 'the label span truncates with an ellipsis');
  assert.ok(fit.includes('.profile-tabs .profile-tab-button .profile-tab-count{flex:none;margin-inline-start:4px}'), 'the count span never shrinks');
  assert.equal(TRANSLATIONS.en.prof_tab_complaints_count, '({count})', 'EN complaints count key is the short suffix form');
  assert.equal(TRANSLATIONS.en.prof_tab_baqaya_count, '({count})', 'EN baqaya count key is the short suffix form');
  assert.ok(html.includes('<span class="profile-tab-count" hidden></span>'), 'the count spans exist in the markup, hidden at zero');
});

test('R5 V4 UR: the UR count keys are the short suffix form and the fit rule is RTL-safe', () => {
  const fit = fitRuleBlock();
  assert.equal(TRANSLATIONS.ur.prof_tab_complaints_count, '({count})', 'UR complaints count key is the short suffix form');
  assert.equal(TRANSLATIONS.ur.prof_tab_baqaya_count, '({count})', 'UR baqaya count key is the short suffix form');
  assert.ok(fit.includes('margin-inline-start'), 'the count gap uses a logical property, so it stays on the label side in RTL');
  assert.ok(!/margin-left|margin-right/.test(fit), 'the fit rule must not use physical margins (RTL would flip the gap)');
});

test('R6 V5: profile-tab buttons still render 13px — the :1531 11px rule stays dead (D5)', () => {
  const override = ruleBlock(styles, '.profile-tabs .profile-tab-button{');
  assert.ok(override.includes('font-size:var(--text-tab)'), 'tab buttons must stay 13px via --text-tab');
  assert.ok(!fitRuleBlock().includes('font-size'), 'the ≤620px fit rule must not shrink the font (D5: no 11px-live rule)');
});

test('R7 V6 EN: the bottom nav still fits all 5 labels on one line', () => {
  assert.ok(styles.includes('grid-template-columns:repeat(5,minmax(0,1fr))'), 'the bottom nav keeps its 5 equal columns');
  for (const label of ['Home', 'Customers', 'Collect', 'Bills', 'Reports', 'More']) {
    assert.ok(Object.values(TRANSLATIONS.en).includes(label), `EN bottom-nav label ${label} must exist`);
  }
});

test('R8 V6 UR: the UR bottom-nav labels still exist', () => {
  for (const label of ['ڈیش بورڈ', 'صارفین', 'وصولی', 'بلز', 'رپورٹس', 'مزید']) {
    assert.ok(Object.values(TRANSLATIONS.ur).includes(label), `UR bottom-nav label ${label} must exist`);
  }
});

test('R9 V7: the view-nav never clips where it renders — it scrolls by design', () => {
  assert.ok(styles.includes('overflow-x:auto'), 'the view-nav row scrolls by design');
  assert.ok(ruleBlock(styles, '.view-nav-button{').includes('flex:0 0 auto') || styles.includes('.view-nav-button{flex:0 0 auto'), 'view-nav buttons stay content-sized, so no width constraint can clip them');
});

test('R10 V8: the 97 test still pins the :21 10px rule as DEAD — it must not be made live', () => {
  assert.ok(test97.includes('"selector":".view-nav-button","disp":"DEAD"'), 'the 97 DATA must still record the :21 rule as DEAD');
});

test('R11 V9: the view-nav labels have no UR translations — they are EN-only', () => {
  for (const key of ['nav_transactions', 'nav_analytics', 'nav_inventory', 'nav_expenses', 'nav_home_budget', 'nav_loans', 'nav_wa_templates']) {
    assert.ok(!(key in TRANSLATIONS.en) && !(key in TRANSLATIONS.ur), `${key} must not exist — the view-nav labels are EN-only`);
  }
});

// --- F — profile-tab fit rule (6) ---------------------------------------

test('F1: all 4 tabs fit at 360px EN with counts — recorded harness: overflow 0px, 4×70px', () => {
  // Recorded (measure-100-fixed.mjs): 360px nested EN worst-case —
  // tabsClientW 298, tabsScrollW 298, overflow 0 (base: +95px).
  // The fit is structural: flex:1 1 0 (ds0) + min-width:0 forces each
  // tab to its equal share, so the row cannot overflow.
  const fit = fitRuleBlock();
  assert.ok(fit.includes('min-width:0'), 'min-width:0 lets the equal shares shrink below content width');
  assert.ok(ruleBlock(styles, '.profile-tabs .profile-tab-button{').includes('flex:1 1 0'), 'the tabs still share the row equally');
  assert.ok(html.includes('id="profileTabComplaints"') && html.includes('id="profileTabBaqaya"'), 'all four tabs still exist');
});

test('F2: all 4 tabs fit at 360px UR with counts — recorded harness: overflow 0px', () => {
  // Recorded (measure-100-fixed.mjs): 360px nested UR worst-case —
  // tabsClientW 298, tabsScrollW 298, overflow 0 (base: +45px).
  // RTL overflow is measured as scrollWidth − clientWidth (T6).
  const fit = fitRuleBlock();
  assert.ok(fit.includes('margin-inline-start'), 'the count gap is logical, so the RTL layout mirrors correctly');
  assert.equal(TRANSLATIONS.ur.prof_tab_complaints, 'شکایات', 'UR complaints label still exists');
  assert.equal(TRANSLATIONS.ur.prof_tab_baqaya, 'بقایا', 'UR baqaya label still exists');
});

test('F3: plain labels fit too — the count spans hide at zero', () => {
  const body = updateCountsBody();
  assert.ok(body.includes('complaintsCount.hidden = counts.openComplaints <= 0'), 'the complaints count hides at zero');
  assert.ok(body.includes('baqayaCount.hidden = counts.unpaidBaqaya <= 0'), 'the baqaya count hides at zero');
  assert.ok(body.includes("complaintsLabel.textContent = t('prof_tab_complaints')"), 'the complaints label stays bare at zero');
  assert.ok(body.includes("baqayaLabel.textContent = t('prof_tab_baqaya')"), 'the baqaya label stays bare at zero');
});

test('F4: truncation is graceful — the label ellipsises, the count never shrinks, the title carries the full text', () => {
  // Recorded: at 360px EN the "Complaints" label truncates (scrollW 74
  // vs clientW 22) by design — its ~74px cannot fit a ~70px equal share
  // under the 13px/ds0 constraints — while the count "(2)" stays fully
  // visible (16.3px). The title is the escape hatch.
  const fit = fitRuleBlock();
  assert.ok(fit.includes('text-overflow:ellipsis'), 'the label truncates with an ellipsis, never a mid-word clip');
  assert.ok(fit.includes('.profile-tab-count{flex:none'), 'the count span never shrinks');
  const body = updateCountsBody();
  assert.ok(body.includes('complaintsLabel.title ='), 'the complaints label title carries the full text');
  assert.ok(body.includes('baqayaLabel.title ='), 'the baqaya label title carries the full text');
  assert.ok(body.includes("`${t('prof_tab_complaints')} ${t('prof_tab_complaints_count'"), 'the complaints title is label + count');
  assert.ok(body.includes("`${t('prof_tab_baqaya')} ${t('prof_tab_baqaya_count'"), 'the baqaya title is label + count');
});

test('F5: tab height stays ≥44px — the fit rule touches no height', () => {
  assert.ok(styles.includes('.profile-tab-button{min-height:44px;padding:7px 6px}'), 'the ≤620px tab rule keeps min-height 44px');
  assert.ok(!/min-height|height/.test(fitRuleBlock()), 'the fit rule must not change any height');
});

test('F6: tab font stays ≥11px and the sticky tops are unchanged', () => {
  assert.ok(ruleBlock(styles, '.profile-tabs .profile-tab-button{').includes('font-size:var(--text-tab)'), '13px via --text-tab is above the 11px floor');
  assert.ok(styles.includes('.profile-tabs{margin:14px 0 10px;padding:3px;top:58px}'), 'tabs must stick at 58px on phones');
  assert.ok(styles.includes('.profile-tabs.profile-tabs { top: 56px; }'), 'tabs must stick at 56px at 360px');
});

// --- D — profile no-regress (4) ------------------------------------------

test('D1: tab ids, roles and aria-selected state are unchanged', () => {
  for (const [tabId, panelId] of [['profileTabBilling', 'profilePanelBilling'], ['profileTabInfo', 'profilePanelInfo'], ['profileTabComplaints', 'profilePanelComplaints'], ['profileTabBaqaya', 'profilePanelBaqaya']]) {
    assert.ok(html.includes(`id="${tabId}"`), `${tabId} must keep its id`);
    assert.match(html, new RegExp(`id="${tabId}"[^>]*role="tab"[^>]*aria-controls="${panelId}"`), `${tabId} must keep its tab role and panel link`);
  }
  assert.ok(html.includes('role="tablist"'), 'the tablist role must stay');
});

test('D2: arrow-key navigation is intact (Sharafat 78)', () => {
  assert.ok(app.includes("event.key === 'ArrowRight'"), 'ArrowRight must still move between tabs');
  assert.ok(app.includes("event.key === 'ArrowLeft'"), 'ArrowLeft must still move between tabs');
  assert.ok(app.includes("$('.profile-tabs').addEventListener('keydown'"), 'the tabs must keep their keyboard handler');
});

test('D3: the counts still show the right numbers, in the D4 short form', () => {
  assert.equal(TRANSLATIONS.en.prof_tab_complaints_count, '({count})', 'EN complaints count is the (N) suffix');
  assert.equal(TRANSLATIONS.en.prof_tab_baqaya_count, '({count})', 'EN baqaya count is the (N) suffix');
  const body = updateCountsBody();
  assert.ok(body.includes("t('prof_tab_complaints_count', null, { count: counts.openComplaints })"), 'the complaints count still uses its key with the count param');
  assert.ok(body.includes("t('prof_tab_baqaya_count', null, { count: counts.unpaidBaqaya })"), 'the baqaya count still uses its key with the count param');
  assert.ok(body.includes("$('#profileTabComplaints .profile-tab-count')"), 'the complaints count targets its own span');
  assert.ok(body.includes("$('#profileTabBaqaya .profile-tab-count')"), 'the baqaya count targets its own span');
  assert.ok(!body.includes('profileTabInfo'), 'the Info tab still carries no count');
});

test('D4: the selected tab is still solid brand', () => {
  const selected = ruleBlock(styles, '.profile-tab-button[aria-selected=true]{');
  assert.ok(selected.includes('background:var(--ds-brand)'), 'the selected tab must be solid brand');
  assert.ok(selected.includes('border-color:var(--ds-brand)'), 'the selected tab border must be solid brand');
});

// --- G — guards (3) -------------------------------------------------------

test('G1: EN/UR parity stays 4,669/4,669 — the count keys changed values, not count', () => {
  // Rebase (2026-11-17): the pin moves 4,672 → 4,675 — Sharafat 100
  // itself adds no keys. Round 2 (net −1: two keys deleted, one
  // added) moved it 4,672 → 4,671, then the Quick Collect polish
  // (+4 keys: qc3_collect_advance, qc_head_payable, qc_head_bill_dues,
  // qc_loose_keep_chip) moved it 4,671 → 4,675. 4,672 − 1 + 4 = 4,675.
  // Plan 582 (D1(b)) deletes the six orphan
  // dash_tile_collect_*/dash_tile_closing_* keys: 4,675 − 6 = 4,669.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5210, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5210, 'UR key count moved');
  const enKeys = new Set(Object.keys(TRANSLATIONS.en));
  const urKeys = new Set(Object.keys(TRANSLATIONS.ur));
  assert.deepEqual([...enKeys].filter((k) => !urKeys.has(k)), [], 'no EN-only keys');
  assert.deepEqual([...urKeys].filter((k) => !enKeys.has(k)), [], 'no UR-only keys');
});

// Plan 588 D5(b) re-pins nav.css 164 -> 163: .btn-primary:hover #094338
// (its only occurrence) is re-tokened to var(--color-brand-700).
// Title + assert move together (Plan 586 rule).
test('G2: hex pins hold (styles.css 608 / nav.css 163 / components.css 0, no new hex)', () => {
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  assert.equal(hexCount(styles), 608, `styles.css hex count moved (${hexCount(styles)})`);
  assert.equal(hexCount(navCss), 163, `nav.css hex count moved (${hexCount(navCss)})`);
  assert.equal(hexCount(components), 0, `components.css hex count moved (${hexCount(components)})`);
});

test('G3: braces stay balanced and the count keys still exist', () => {
  assert.equal((styles.match(/\{/g) || []).length, (styles.match(/\}/g) || []).length, 'styles.css braces balanced');
  assert.equal((lang.match(/\{/g) || []).length, (lang.match(/\}/g) || []).length, 'nav-language.js braces balanced');
  assert.ok(lang.includes('prof_tab_complaints_count:'), 'the complaints count key must not be deleted');
  assert.ok(lang.includes('prof_tab_baqaya_count:'), 'the baqaya count key must not be deleted');
});
