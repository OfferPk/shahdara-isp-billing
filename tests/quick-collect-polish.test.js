// Quick Collect Cash polish (user spec 2026-11-17, parent decisions
// D1–D14): the list, the filter pills, the settled CTA, the × button,
// the date chips, the Step 2 header, the amount, the method/shop
// pills, the two removed optional fields, the direct-save CTA, and
// the merged quick-amounts row.
//
// Measured, not assumed (Chromium headless-shell, DM Sans, 0 page
// errors — see the PR body for the full M1–M4 table):
// - Filter pills fit one row at 360px (row 96px → 46px) but scroll
//   4px at 320px (scrollW 278 vs clientW 274) — D4 accepts the scroll.
// - Cards GREW: badged dues 143.5px → 178.3px, settled 110px →
//   124.7px at 360px (Row 2 + the 2-line name cost height) — the
//   3-cards gate gets worse, not better; recorded, not blessed.
// - The form does NOT reach one screen: stepScrollH 1,343px → 1,146px
//   at 360px, still 557px over the 589px card (D12, recorded).
// - Date chips are 38px, method/shop pills 40px — below the 44px
//   floor, recorded not blessed (D1); the defeaters below are what
//   make them render at those sizes.
// - Shop chips still render 74.5px (2-line text wrap), not 40px.
// - The footer charge line is one span but wraps to 2 visual lines.
// - Big method chips still render 54px at 320px (label wraps).
// - The pill-width shrink vs the prep prediction is measured, not
//   explained: Pending 101.5px → 85.4px, far more than the 2px/chip
//   padding saving — the cuts alone do not explain the fit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const styles = read('styles.css');
const components = read('components.css');
const bulk = read('bulk-collect.css');
const page = read('index.html');
const wiring = read('nav-quick-collect.js');
const lang = read('nav-language.js');

const flat = (s) => s.replace(/\s+/g, ' ');

// First top-level rule for a selector (same extraction as plan550).
function baseRule(css, selector) {
  const flatCss = flat(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = flatCss.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
  assert.ok(m, `expected a base rule for ${selector}`);
  return m[0];
}

function decl(rule, prop) {
  // Anchored on a declaration boundary (start, ';' or '{') so 'color'
  // never matches 'border-color' and 'height' never matches
  // 'min-height' — the first occurrence of the bare name is not
  // always the property itself.
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = rule.match(new RegExp(`(?:^|[;{]\\s*)${escaped}:\\s*([^;]+);`));
  assert.ok(m, `expected ${prop} in rule ${rule.slice(0, 60)}`);
  return m[1].trim();
}

// Balanced scan: the block of the element whose class is `cls`,
// from its opening tag to the matching close (nested divs counted).
function elementBlock(src, cls) {
  const at = src.indexOf(`class="${cls}"`);
  assert.ok(at > -1, `expected class ${cls}`);
  const open = src.lastIndexOf('<div', at);
  let depth = 0;
  let i = open;
  while (i < src.length) {
    if (src.startsWith('<div', i)) { depth++; i += 4; continue; }
    if (src.startsWith('</div>', i)) {
      depth--;
      if (depth === 0) return src.slice(open, i + 6);
      i += 6; continue;
    }
    i++;
  }
  throw new Error(`unclosed <div class="${cls}">`);
}

// ---- G1: list layout — Row 1 name + figures, Row 2 subtitle --------

test('G1 list: the subtitle sits after the figures inside the card main, not inside the narrow left column', () => {
  // D1/D8 (Row 2): the .qc-cust-meta span moved out of
  // .qc-card-left/.qc-cust-info into .qc3-card-main after .qc3-figures.
  // Anchored on the card button itself (the renderer function is long;
  // a slice from its head does not reach the template).
  const at = wiring.indexOf('class="qc3-card-main"', wiring.indexOf('function renderQuickCollectCustomerListHtml'));
  assert.ok(at > -1, 'card button found');
  const tpl = wiring.slice(at, at + 2500);
  const figuresAt = tpl.indexOf('qc3-figures');
  const metaAt = tpl.indexOf('qc-cust-meta');
  assert.ok(figuresAt > -1 && metaAt > -1, 'figures and meta both in the template');
  assert.ok(metaAt > figuresAt, 'meta comes after the figures (Row 2)');
  const leftAt = tpl.indexOf('qc-card-left');
  // The left column closes after the info div closes: two </div>s
  // past qc-cust-info (info, then the column itself).
  const infoClose = tpl.indexOf('</div>', tpl.indexOf('qc-cust-info'));
  const leftClose = tpl.indexOf('</div>', infoClose + 6);
  assert.ok(leftAt > -1 && leftClose > -1 && metaAt > leftClose,
    'meta is outside the narrow left column');
});

test('G1 list: the Row 2 subtitle spans the full card width', () => {
  // Precedent: the chips row at styles.css:9992 (.qc-card-chips flex
  // 1 1 100%). Scoped to the modal: Field Mode shares the classes.
  const rule = baseRule(styles, '#quickCollectModal .qc3-card-main > .qc-cust-meta');
  assert.equal(decl(rule, 'flex'), '1 1 100%');
});

test('G1 list: the name wraps to at most 2 lines on Row 1', () => {
  // D8: a 2-line clamp, scoped to the modal so Field Mode is untouched.
  const rule = baseRule(styles, '#quickCollectModal .qc-cust-name');
  assert.equal(decl(rule, '-webkit-line-clamp'), '2');
  assert.equal(decl(rule, 'display'), '-webkit-box');
  assert.equal(decl(rule, 'white-space'), 'normal');
});

test('G1 list: the base name rule still ellipsises (the clamp only adds a second line)', () => {
  assert.match(baseRule(styles, '.qc-cust-name'), /text-overflow:\s*ellipsis/);
});

test('G1 list: the DUE pill stays at the shipped 0.69rem / 1px 6px', () => {
  // D7: the user's 0.68rem is 0.16px smaller — invisible — so the
  // shipped size stays and no Sharafat 97 pin is rewritten.
  const rule = baseRule(styles, '.qc-due-tag');
  assert.equal(decl(rule, 'font-size'), '0.69rem');
  assert.equal(decl(rule, 'padding'), '1px 6px');
});

test('G1 list: the same-name badges stay beside the name on Row 1', () => {
  const at = wiring.indexOf('class="qc3-card-main"', wiring.indexOf('function renderQuickCollectCustomerListHtml'));
  const tpl = wiring.slice(at, at + 2500);
  const nameAt = tpl.indexOf('qc-cust-name');
  const badgesAt = tpl.indexOf('sameNameBadges');
  assert.ok(nameAt > -1 && badgesAt > -1, 'name and badges both in the template');
  assert.ok(badgesAt > nameAt, 'badges sit beside the name, not in the subtitle');
});

// ---- G2: filter pills — one row, scroll when it must ---------------

test('G2 pills: the ≤620px rule makes the pill row one scrolling row, never a wrap', () => {
  // D4: the ≤620px wrap rule is replaced by nowrap + overflow-x:auto.
  // Measured: the four pills fit at 360px (row 96px → 46px) and
  // scroll 4px at 320px — accepted, not hidden. There are several
  // ≤620px blocks, so the one carrying the filter-pills rule is found
  // by scanning them all.
  const needle = '@media (max-width: 620px)';
  let found = null;
  let at = styles.indexOf(needle);
  while (at >= 0) {
    const block = styles.slice(at, at + 3000);
    if (block.includes('.qc-filter-pills {')) { found = block; break; }
    at = styles.indexOf(needle, at + needle.length);
  }
  assert.ok(found, 'a ≤620px block carries the filter-pills rule');
  const pillsAt = found.indexOf('.qc-filter-pills {');
  const rule = found.slice(pillsAt, found.indexOf('}', pillsAt));
  assert.match(rule, /flex-wrap:\s*nowrap/);
  assert.match(rule, /overflow-x:\s*auto/);
});

test('G2 pills: the user cuts land — padding 5px 12px, font 0.78rem', () => {
  // QC picker overflow (2026-11-19, item 3): padding 5px 10px →
  // 5px 12px, and the chips gain flex-shrink: 0 — the count badges
  // keep their breathing room and the row scrolls instead of
  // squeezing them. Same pin as plan550:139 + overhaul:181.
  const rule = baseRule(styles, '.quick-collect-filter-chip');
  assert.equal(decl(rule, 'padding'), '5px 12px');
  assert.equal(decl(rule, 'font-size'), '0.78rem');
});

test('G2 pills: the pills keep their 44px tap target', () => {
  assert.equal(decl(baseRule(styles, '.quick-collect-filter-chip'), 'min-height'), '44px');
});

test('G2 pills: all four pills exist in the page, in order', () => {
  for (const filter of ['data-filter="all-dues"', 'data-filter="high-dues"', 'data-filter="all"', 'data-filter="paid"']) {
    assert.ok(page.includes(filter), `${filter} missing`);
  }
  const order = ['all-dues', 'high-dues', 'all', 'paid']
    .map((f) => page.indexOf(`data-filter="${f}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'pills in Pending, High, All, Paid order');
});

// ---- G3: settled cards — ➕ Advance, not Collect --------------------

test('G3 settled: the Advance label key exists in both language tables', () => {
  assert.ok(lang.includes("qc3_collect_advance: '➕ Advance'"), 'EN Advance label');
  assert.ok(lang.includes("qc3_collect_advance: '➕ پیشگی'"), 'UR Advance label');
});

test('G3 settled: settled cards show ➕ Advance, dues cards still show Collect', () => {
  const at = wiring.indexOf('function renderQuickCollectCustomerListHtml');
  const tpl = wiring.slice(at, at + 9000);
  assert.ok(tpl.includes("const collectLabel = hasDues ? t('qc3_collect') : t('qc3_collect_advance');"),
    'label branches on dues');
  assert.ok(tpl.includes("const collectClass = hasDues ? 'qc3-collect' : 'qc3-advance';"),
    'class branches on dues');
});

test('G3 settled: the Advance button is a distinct tonal pill, not a Collect restyle', () => {
  // D3: a new .qc3-advance class (settled-tag greens, already in the
  // token set — no new hex). A .qc-settled.qc3-collect override would
  // break the qc-modal-fix test (6) regex, so it is not used.
  const rule = baseRule(styles, '.qc3-advance');
  assert.equal(decl(rule, 'min-height'), '40px !important');
  assert.equal(decl(rule, 'background'), '#dcfce7');
  assert.equal(decl(rule, 'color'), '#166534');
});

test('G3 settled: the Advance button still posts through the collect action', () => {
  const at = wiring.indexOf('function renderQuickCollectCustomerListHtml');
  const tpl = wiring.slice(at, at + 9000);
  assert.ok(tpl.includes('class="qc3-action-btn ${collectClass}" data-qc3-action="collect"'),
    'settled button keeps data-qc3-action="collect"');
});

test('G3 settled: the Advance guard still refuses an untagged save against a paid bill', () => {
  // The guard is why the settled CTA must tick the tag: an untagged
  // save against a fully-paid bill is refused at the guard. The
  // auto-tick arms Advance (and the target month) for a settled bill,
  // so the tap posts through the same guard.
  assert.ok(wiring.includes("normalPaymentBlockReason(state, activeCustomerId, monthVal) === 'fully-paid'"),
    'guard refuses an untagged save against a fully-paid bill');
  assert.ok(wiring.includes('advanceCheckbox.checked = activeDefaults.totalDues <= 0'),
    'the auto-tick still arms Advance for a settled bill');
});

test('G3 settled: the modal Advance button is 38px, matching Collect', () => {
  const rule = baseRule(styles, '#quickCollectModal .qc3-advance');
  assert.equal(decl(rule, 'min-height'), '38px !important');
  assert.equal(decl(rule, 'height'), '38px');
});

// ---- G4: the × dismiss — 28px, and it really renders 28px ----------

test('G4 dismiss: the base rule is 28px on every side', () => {
  const rule = baseRule(styles, '.eds-panel-dismiss');
  assert.equal(decl(rule, 'width'), '28px');
  assert.equal(decl(rule, 'height'), '28px');
  assert.equal(decl(rule, 'min-width'), '28px !important');
  assert.equal(decl(rule, 'min-height'), '28px !important');
});

test('G4 dismiss: a heavier defeater beats the 44px floor', () => {
  // The floor is button:not([hidden]) (0,1,1); a plain
  // .eds-panel-dismiss rule (0,1,0) loses to it — the old 32px rule
  // rendered 32×44. The defeater is (0,2,1) and wins.
  assert.ok(styles.includes('button:not([hidden]).eds-panel-dismiss {'),
    'defeater selector present');
  const at = styles.indexOf('button:not([hidden]).eds-panel-dismiss {');
  const rule = styles.slice(at, styles.indexOf('}', at));
  assert.match(rule, /min-height:\s*28px\s*!important/);
  assert.match(rule, /min-width:\s*28px\s*!important/);
});

test('G4 dismiss: the floor itself is untouched (the defeater is the exception, not a floor change)', () => {
  assert.match(styles, /button:not\(\[hidden\]\)\s*\{\s*min-height:\s*44px\s*!important;\s*\}/);
});

// ---- G5: date chips — 38px, nowrap, "Prev Month" --------------------

test('G5 dates: the base rule is 38px with the user padding and font', () => {
  const rule = baseRule(styles, '.qc-date-chip');
  assert.equal(decl(rule, 'min-height'), '38px');
  assert.equal(decl(rule, 'padding'), '8px 6px');
  assert.equal(decl(rule, 'font-size'), '0.76rem');
});

test('G5 dates: the chips never wrap their label mid-word', () => {
  assert.match(baseRule(styles, '.qc-date-chip'), /white-space:\s*nowrap/);
});

test('G5 dates: a heavier defeater carries the same 38px', () => {
  assert.ok(styles.includes('button:not([hidden]).qc-date-chip {'), 'date defeater present');
  const at = styles.indexOf('button:not([hidden]).qc-date-chip {');
  const rule = styles.slice(at, styles.indexOf('}', at));
  assert.match(rule, /min-height:\s*38px\s*!important/);
});

test('G5 dates: "Prev Month End" shortens to "Prev Month"', () => {
  // D9: "Prev Month End" was ~97px in a 74px column even with nowrap.
  // Measured after the fix: "Prev Month" is one line at 360px and 320px.
  assert.ok(page.includes('>Prev Month</button>'), 'page carries Prev Month');
  assert.ok(!page.includes('Prev Month End'), 'no Prev Month End remains in the page');
  assert.ok(lang.includes("bdate_chip_prev_month_end: 'Prev Month'"), 'EN key shortened');
});

test('G5 dates: the four chips are still keyed by data attribute, not by label', () => {
  for (const chip of ['today', 'yesterday', 'prev-month-end', 'custom']) {
    assert.ok(page.includes(`data-qc-date-chip="${chip}"`), `${chip} chip present`);
  }
});

// ---- G6: Step 2 header — one line, Payable right, one footer line --

test('G6 header: the due-box label is the compact "Payable"', () => {
  // D11: 'Total Payable (incl. charges)' / 'Total Dues' become one
  // short 'Payable' — the footer line below explains the gap.
  assert.ok(lang.includes("qc_head_payable: 'Payable'"), 'EN Payable key');
  assert.ok(lang.includes("qc_head_payable: 'قابل ادا'"), 'UR Payable key');
  assert.ok(wiring.includes("t('qc_head_payable')"), 'header uses the Payable key');
  assert.ok(!wiring.includes("hasExtras ? 'Total Payable (incl. charges)' : 'Total Dues'"),
    'the old two-branch label is gone');
});

test('G6 header: the footer merges bill dues + charges + baqaya into one •-separated line', () => {
  assert.ok(wiring.includes("chargeParts.join(' • ')"), 'parts joined with •');
  assert.ok(wiring.includes("t('qc_head_bill_dues'"), 'bill-dues part is keyed');
  assert.ok(wiring.includes("t('baqaya_qc_line'"), 'baqaya part is keyed');
  assert.ok(lang.includes("qc_head_bill_dues: 'Bill dues: {amount}'"), 'EN bill-dues key');
});

test('G6 header: the identity truncates with an ellipsis, full name in the title', () => {
  const rule = baseRule(styles, '.qc-head-name');
  assert.match(rule, /white-space:\s*nowrap/);
  assert.match(rule, /text-overflow:\s*ellipsis/);
  assert.ok(wiring.includes('title="displayName"') || wiring.includes('title="${displayName}"') || wiring.includes("title=\"${escapeHtml(displayName)}\""),
    'full name carried in the title attribute');
});

test('G6 header: the charge line is inline, so the footer is one line', () => {
  // The rule lives in bulk-collect.css, not styles.css — a styles.css
  // scan reads nothing. D11 changes display: block → inline.
  assert.match(bulk, /\.qc-head-charge-line \{\s*display:\s*inline;\s*\}/);
});

// ---- G7: amount — whole numbers, words only for decimals ------------

test('G7 amount: whole numbers print without decimals, decimals keep two', () => {
  // D5/R8: only the three Step 2 prefill sites convert — the
  // one-screen, chip-fill and loose-tender sites keep .toFixed(2).
  assert.ok(wiring.includes('function wholeNumberAmountText(value) {'), 'helper exists');
  assert.ok(wiring.includes('return Number.isInteger(v) ? String(v) : v.toFixed(2);'), 'helper rule');
  // The helper is used at the 3 Step 2 prefill sites, the 4
  // chip-fill sites, and the concession net-due fill (Quick Collect
  // polish D5 — a chip tap fills the amount as a whole number too,
  // so the field reads '1000' whether the amount came from the
  // prefill, a tap, or a concession).
  const uses = wiring.match(/wholeNumberAmountText\(/g) || [];
  assert.equal(uses.length, 9, `helper + 3 prefill + 4 chip-fill + 1 concession uses, found ${uses.length}`);
});

test('G7 amount: the words line hides for whole numbers and stays for decimals', () => {
  // D5: the line is kept ONLY when the amount has a non-zero decimal
  // part (the Plan 377 extra-zero guard survives for odd amounts).
  assert.ok(wiring.includes("wordsLine.hidden = text === '' || Number.isInteger(amount);"),
    'words gate is the D5 shape');
  assert.ok(page.includes('id="quickCollectAmountWordsLine"'), 'words element stays in the page');
});

test('G7 amount: the words helper still returns text for a non-whole amount', () => {
  const at = wiring.indexOf('function renderAmountWordsLine()');
  assert.ok(at > -1, 'words renderer found');
  const block = wiring.slice(at, at + 1200);
  assert.ok(block.includes('amountInWordsLineText'), 'words text comes from the shared helper');
});

test('G7 amount: the direct-save label reuses the one-screen save label', () => {
  assert.ok(wiring.includes('quickCollectOneScreenSaveLabel(amountInput?.value ?? '),
    'label comes from the one-screen helper, not a new formatter');
  assert.ok(wiring.includes("import { quickCollectOneScreenSaveLabel } from './quick-collect-one-screen.js';")
    || wiring.includes('quickCollectOneScreenSaveLabel'), 'helper is imported');
});

test('G7 amount: the amount input keeps its 44px height', () => {
  // The .qc-amount-input rule carries no height of its own — the
  // 44px comes from the global input floor, which is the guarantee
  // (the harness measures the input at 44px at 360px and 320px).
  assert.match(styles, /button, input:not\(\[type="hidden"\]\), select, textarea\s*\{\s*min-height:\s*44px;\s*\}/);
});

// ---- G8: method + shop pills — 40px, text-only shops ----------------

test('G8 method: the base chip is 40px with a heavier defeater', () => {
  assert.equal(decl(baseRule(styles, '.quick-method-chip'), 'min-height'), '40px');
  assert.ok(styles.includes('button:not([hidden]).quick-method-chip {'), 'method defeater present');
  const at = styles.indexOf('button:not([hidden]).quick-method-chip {');
  assert.match(styles.slice(at, styles.indexOf('}', at)), /min-height:\s*40px\s*!important/);
});

test('G8 method: the big three are 40px pills now, same size as the small chips', () => {
  // D1: bwb-big drops 56px → 40px and 15px → 13px. The bwb-big
  // class stays as the isBigMethod marker (plan438 load-bearing).
  const rule = baseRule(styles, '.quick-method-chip.bwb-big');
  assert.equal(decl(rule, 'min-height'), '40px');
  assert.equal(decl(rule, 'font-size'), '13px');
  assert.equal(decl(rule, 'flex'), '1 1 30%');
  assert.ok(styles.includes('button:not([hidden]).quick-method-chip.bwb-big {'), 'big defeater present');
});

test('G8 method: the Other button is 40px and its single-rule pin still counts one rule', () => {
  // The defeater is written '.bwb-other:not([hidden])' (not
  // 'button:not([hidden]).bwb-other') so plan438's single
  // /\.bwb-other\s*\{/ count stays 1.
  const others = styles.match(/\.bwb-other\s*\{[^}]*\}/g) || [];
  assert.equal(others.length, 1, `one .bwb-other rule, found ${others.length}`);
  assert.match(others[0], /min-height:\s*40px/);
  assert.ok(styles.includes('.bwb-other:not([hidden]) {'), 'Other defeater present');
});

test('G8 shop: the shop chips are 40px pills with a heavier defeater', () => {
  // D14: shops stay text-only (no icons) — the 40px cut is size only.
  assert.equal(decl(baseRule(components, '.qc-shop-chip'), 'min-height'), '40px');
  assert.ok(components.includes('button:not([hidden]).qc-shop-chip {'), 'shop defeater present');
  const at = components.indexOf('button:not([hidden]).qc-shop-chip {');
  assert.match(components.slice(at, components.indexOf('}', at)), /min-height:\s*40px\s*!important/);
});

test('G8 method: all five method chips plus Other still exist in the page', () => {
  for (const method of ['Cash', 'JazzCash', 'Easypaisa', 'Bank Transfer', 'Raast']) {
    assert.ok(page.includes(`data-method="${method}"`), `${method} chip present`);
  }
  assert.ok(page.includes('id="bwbOtherMethodBtn"'), 'Other button present');
});

// ---- G9: the two removed optional fields -----------------------------

test('G9 fields: "Collected at" is gone from the entry form', () => {
  assert.ok(!page.includes('id="quickCollectCollectionPlaceSelect"'), 'place select gone from the page');
  assert.ok(!page.includes('Collected at (optional)'), 'place label gone from the page');
});

test('G9 fields: "Collected in mohalla" is gone from the entry form', () => {
  assert.ok(!page.includes('id="quickCollectCollectionMohallaInput"'), 'mohalla input gone from the page');
  assert.ok(!page.includes('Collected in mohalla (optional)'), 'mohalla label gone from the page');
});

test('G9 fields: "Collected by" stays — it is not one of the removed fields', () => {
  assert.ok(page.includes('Collected by'), 'Collected by still in the page');
});

test('G9 fields: the submit handler no longer reads the removed fields', () => {
  // D13: the reads and the post keys are deleted from the submit
  // handler's two post calls (passing undefined would be equivalent,
  // but deleting the keys is cleaner). The profile twin keeps the
  // fields, and executeQuickCollection's own signature still accepts
  // them for other callers — what must be gone is the entry form
  // reading them and posting them.
  assert.ok(!wiring.includes('collectionPlaceSelect'), 'no place select const');
  assert.ok(!wiring.includes('collectionMohallaInput'), 'no mohalla input const');
  for (const call of ['executeQuickCollection(state, {', 'executeSplitTenderCollection(state, {']) {
    const at = wiring.indexOf(call, wiring.indexOf("paymentForm?.addEventListener('submit'"));
    assert.ok(at > -1, `${call} call found in the submit handler`);
    const obj = wiring.slice(at, at + 2000);
    assert.ok(!obj.includes('collectionPlace'), `${call} posts no collectionPlace`);
    assert.ok(!obj.includes('collectionMohalla'), `${call} posts no collectionMohalla`);
  }
});

// ---- G10: direct save — standard only, Review kept -------------------

test('G10 direct: the button exists, is a plain button, and starts hidden', () => {
  assert.ok(page.includes('id="quickCollectDirectSaveBtn"'), 'direct button in the page');
  const at = page.indexOf('id="quickCollectDirectSaveBtn"');
  const tag = page.slice(page.lastIndexOf('<button', at), at + 120);
  assert.match(tag, /type="button"/);
  assert.match(tag, /hidden/);
  assert.match(tag, /qc-confirm-btn/);
});

test('G10 direct: standard means single leg, no Advance, no split, amount within dues, no duplicate TID', () => {
  const at = wiring.indexOf('function isDirectSaveStandard()');
  assert.ok(at > -1, 'standard gate found');
  const block = wiring.slice(at, at + 1200);
  assert.ok(block.includes('amountVal <= 0 || amountVal > dues'), 'amount must be positive and within dues');
  assert.ok(block.includes('advanceCheckbox?.checked'), 'Advance tag excludes direct save');
  assert.ok(block.includes('splitToggle?.checked'), 'split excludes direct save');
  assert.ok(block.includes('findDuplicatePaymentReference'), 'duplicate TID excludes direct save');
});

test('G10 direct: the button shows the one-screen label and hides when the collection is not standard', () => {
  const at = wiring.indexOf('function syncDirectSaveButton()');
  assert.ok(at > -1, 'sync found');
  const block = wiring.slice(at, at + 600);
  assert.ok(block.includes('quickCollectOneScreenSaveLabel(amountInput?.value ?? '), 'label from the helper');
  assert.ok(block.includes('directSaveBtn.hidden = !isDirectSaveStandard();'), 'hidden follows the gate');
});

test('G10 direct: the button is decided on form open, not only after a keystroke', () => {
  const at = wiring.indexOf('function openCustomerCollectionForm(');
  assert.ok(at > -1, 'open found');
  const block = wiring.slice(at, at + 9000);
  assert.ok(block.includes('syncDirectSaveButton();'), 'sync called on open');
});

test('G10 direct: the direct path skips the Plan 382 confirm step and posts through the same save', () => {
  // D2: the validations in the submit handler stay; the direct path
  // only skips the confirm step. The one-shot flag is consumed at
  // the top of the handler and cleared at once.
  assert.ok(wiring.includes('const skipConfirm = directSaveRequested && isDirectSaveStandard();'),
    'confirm skipped only for a standard direct save');
  assert.ok(wiring.includes('directSaveRequested'), 'one-shot flag exists');
});

test('G10 direct: Review stays as the CTA for everything non-standard', () => {
  assert.ok(page.includes('id="quickCollectConfirmBtn"'), 'Review button still in the page');
  assert.ok(wiring.includes("quickCollectConfirmBtn"), 'Review wiring still present');
  const at = wiring.indexOf('function isDirectSaveStandard()');
  const block = wiring.slice(at, at + 1200);
  assert.ok(block.includes('return false'), 'non-standard collections return false (Review only)');
});

// ---- G11: quick amounts — Full + Half + loose on one row -------------

test('G11 amounts: the loose host is nested inside the merged row after Half', () => {
  // D10: Full + Half + loose share ONE row; Package/2000/1000/500
  // move to a second compact row below (they keep working). The
  // nested host breaks the old first-</div> row slice — the row is
  // read with a balanced scan here.
  const row = elementBlock(page, 'qc-quick-amount-chips');
  const fullAt = row.indexOf('data-quick-amount="full"');
  const halfAt = row.indexOf('data-quick-amount="half"');
  const looseAt = row.indexOf('id="quickCollectLooseChangeChips"');
  const packageAt = row.indexOf('data-quick-amount="package"');
  assert.ok(fullAt > -1 && halfAt > -1 && looseAt > -1 && packageAt > -1, 'row carries all four');
  assert.ok(fullAt < halfAt && halfAt < looseAt && looseAt < packageAt,
    'order is Full, Half, loose host, Package');
});

test('G11 amounts: the loose label is the short "Keep {change}"', () => {
  // D10: the tendered figure is already the input value after a tap,
  // so the label drops it. The 🪙 comes from looseChangeChipsMarkup
  // itself — the key carries no emoji, or the chip would show two.
  assert.ok(lang.includes("qc_loose_keep_chip: 'Keep {change}'"), 'EN loose label');
  assert.ok(lang.includes("qc_loose_keep_chip: '{change} رکھیں'"), 'UR loose label');
  assert.ok(wiring.includes("t('qc_loose_keep_chip', null, {"), 'wiring uses the new key');
  assert.ok(!wiring.includes("t('khula_chip'"), 'the Field Mode khula_chip is not reused here');
});

test('G11 amounts: the second-row chips still exist and still work', () => {
  const row = elementBlock(page, 'qc-quick-amount-chips');
  for (const type of ['package', '2000', '1000', '500']) {
    assert.ok(row.includes(`data-quick-amount="${type}"`), `${type} chip in the row`);
  }
  assert.equal((row.match(/<button /g) || []).length, 6, 'six amount chips, no more, no fewer');
});

test('G11 amounts: the loose row still hides when there is no round-up or Advance is ticked', () => {
  // The hide rule is independent of the merge: Advance ticked means
  // owed is 0, and an empty markup hides the host.
  const at = wiring.indexOf('function renderLooseChangeChips()');
  assert.ok(at > -1, 'loose renderer found');
  const block = wiring.slice(at, at + 900);
  assert.ok(block.includes('advanceCheckbox?.checked ? 0 :'), 'Advance ticked zeroes the owed figure');
  assert.ok(block.includes("looseChangeBox.hidden = markup === '';"), 'empty markup hides the host');
  assert.ok(!block.includes('looseChangeLabel'), 'the deleted group label is no longer toggled');
});
