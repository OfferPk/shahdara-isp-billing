// Pending Actions Center Modal Compression — fit test: the header, the
// toolbar and the per-card actions are measured by the Chromium harness
// (~/workspace/shahdara-pending-actions-harness/, gen.mjs + run.mjs),
// NOT by a static model. The harness is the authority for the true
// heights; this file pins the structure, the CSS values, and the list
// math that produce them, and RECORDS the measured totals.
//
// Measured (harness, 0 pageerrors, chromium-headless-shell):
//   360x640 NEW: header 49px (48px row + 1px border — one row, title
//     one line, badge "29" one line, Copy 32px, close 32px neutral);
//     toolbar 197px (tabs 2 wrapped rows, no scroll, over 0; bulk 2
//     rows x 34px); chrome above list 258px (BASE 344px, -86px); list
//     viewport 305px (BASE 219px, +86px); receipt card 168.4px (BASE
//     220.4px, -52px — the user's ~50px); actions one 38px row,
//     Send WhatsApp rgb(15,83,56) = #0F5338; phone span one 16px line;
//     header stays put on list scroll (moved 0). Visible ~1.7 cards
//     (1 full + ~0.67 partial; BASE ~0.9, 0 full). The literal 2.5–3
//     target is NOT met at 360px — see the D4 note below.
//   360x640 BASE (for comparison): header 111px (title 3 lines +
//     badge row); toolbar 221px (tabs 1 SCROLLING row, over 184 — the
//     §2 clip DOES reproduce at 360px on base, contrary to the prep:
//     the <=480px wrap fix is dead because components.css
//     .pending-actions-tabs { flex-wrap: nowrap; } loads later and
//     overrides it — this item fixes it in both files); bulk 3 rows
//     x 44px; card 220.4px (actions 2 rows, 96px).
//   390x844 NEW: header 49px; toolbar 197px; chrome 258px (BASE 270px,
//     -12px — the base tabs already fit one scrolling row here, so the
//     wrap ADDS a tab row); list viewport 485px; card 168.4px (same as
//     base — the buttons already fit one row at this width); visible
//     ~2.7 cards (2 full + 0.74; BASE ~2.66). The 2.5–3 target IS met.
//   540px NEW: header 49px; toolbar 157px (all three bulk buttons on
//     ONE row); chrome 218px; list viewport 486px; card 148.2px (meta
//     one line at this width); visible ~3.1 cards; tabs over 0.
//   320px NEW: header 49px, one row, no overlap (Copy is icon-only at
//     <=380px); actions one 38px row (Send WhatsApp 116.8px — the
//     prep's marginal case resolves WITHOUT the 12px fallback);
//     toolbar 287px (tabs 3 rows, bulk 3 rows); visible ~1.0 card.
//   D4 (parent decision): the literal 2.5–3 target at 360px is ACCEPTED
//     as recorded-not-blessed at ~1.7 cards (PR #1337 precedent).
//     The prep's ~2.2 estimate was optimistic: it assumed 36px tabs
//     (the app-wide button floor makes them 44px), a 342px modal
//     (the app-wide dialog padding leaves 314px), and a 32px meta line
//     (real line-height makes it 40px). Reaching 2.5 at 360px would
//     need stub bulk labels ("Schedule" / "Share All" / "Clear") or
//     forcing the tabs below the 44px touch-target floor — neither is
//     done here; the parent directs any deeper cuts.
//   The harness shells use representative (not real-rendered) card
//   content and static-filled tabs; the numbers are the shells'
//   measurements, not a live-app trace.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const pageSrc = read('index.html');
const navSrc = read('nav.css');
const compSrc = read('components.css');
const pendingSrc = read('nav-pending-actions.js');
const langSrc = read('nav-language.js');
const stylesSrc = read('styles.css');

function rule(src, selector) {
  const at = src.indexOf(selector);
  assert.ok(at !== -1, `rule ${selector} must exist`);
  const close = src.indexOf('}', at);
  assert.ok(close !== -1, `rule ${selector} must close`);
  return src.slice(at, close + 1);
}

// --- §1: one 48px header row ---

test('header: the title row never wraps and the title is 16px nowrap', () => {
  const row = rule(navSrc, '.pending-actions-title-row {');
  assert.ok(row.includes('flex-wrap: nowrap'), 'title row must not wrap');
  const h2 = rule(navSrc, '.pending-actions-title-row h2 {');
  assert.ok(h2.includes('font-size: 16px'), 'title is 16px on the 48px row');
  assert.ok(h2.includes('white-space: nowrap'), 'title never wraps to a second line');
});

test('header: 8px/12px padding + flex-shrink 0 in BOTH files (components.css wins the cascade)', () => {
  // nav.css loads before components.css, so the components.css rule is
  // the one that actually renders — the two must agree, or the header
  // silently grows back to 16px/20px padding.
  const navHeader = rule(navSrc, '.pending-actions-header {');
  assert.ok(navHeader.includes('padding: 8px 12px'), 'nav.css header padding is 8px 12px');
  assert.ok(navHeader.includes('align-items: center'), 'nav.css header is vertically centred');
  assert.ok(navHeader.includes('flex-shrink: 0'), 'nav.css header never gives up height to the list');
  assert.ok(compSrc.includes('.pending-actions-header { padding: 8px 12px; align-items: center; flex-shrink: 0; }'),
    'components.css header rule (the winning one) matches');
  // The app-wide `dialog header` rule (styles.css, <=640px) forces
  // 4px/8px padding + flex-start with !important on every <header>
  // inside a <dialog> — the 48px row needs this modal-scoped
  // !important override to win it. Without it the harness measures
  // 57px, not 48px.
  const scoped = rule(navSrc, '#pendingActionsModal .pending-actions-header {');
  assert.ok(scoped.includes('padding: 8px 12px !important'), 'scoped header padding beats the global !important');
  assert.ok(scoped.includes('align-items: center !important'), 'scoped header centring beats the global !important');
});

test('header: the badge is a bare count [29] — "29 Pending" wraps to two lines and breaks the 48px row', () => {
  assert.ok(pendingSrc.includes('countBadge.textContent = String(summary.counts.total);'),
    'badge shows the bare count (the spec writes the badge as [29])');
  assert.ok(!pendingSrc.includes("`${summary.counts.total} Pending`"), 'no "N Pending" badge text left');
  assert.ok(!pendingSrc.includes("'All Clear'"), 'no "All Clear" badge text left');
  const badge = rule(navSrc, '.pending-total-badge {');
  assert.ok(badge.includes('white-space: nowrap'), 'badge never wraps');
  assert.ok(badge.includes('flex-shrink: 0'), 'badge never shrinks');
});

test('header: the close is a modal-scoped 32px neutral [x] — the universal 48px red rule is untouched', () => {
  const close = rule(navSrc, '#pendingActionsModal #closePendingActionsModalBtn {');
  assert.ok(close.includes('width: 32px !important'), 'close is 32px wide');
  assert.ok(close.includes('height: 32px !important'), 'close is 32px tall');
  assert.ok(close.includes('min-width: 32px !important'), 'close min-width is 32px');
  assert.ok(close.includes('min-height: 32px !important'), 'close min-height is 32px');
  assert.ok(close.includes('background: var(--color-neutral-100, #f0f4f2) !important'), 'close is neutral, not red');
  assert.ok(close.includes('color: var(--ink) !important'), 'close glyph uses ink');
  assert.ok(close.includes('font-size: 16px !important'), 'close glyph is 16px');
  // The universal rule stays 48px red for every other modal.
  const global = rule(compSrc, '.close-button,');
  assert.ok(global.includes('width: 48px'), 'universal close stays 48px');
  assert.ok(global.includes('background: var(--color-overdue)'), 'universal close stays overdue-red');
  // Markup: same id + class + wiring, glyph is now x (U+2715, matching QC).
  assert.ok(pageSrc.includes('id="closePendingActionsModalBtn" class="modal-close-btn"'),
    'close keeps its id and class (wiring is by id)');
  assert.ok(pageSrc.includes('>✕</button>'), 'close glyph is ✕, not the 48px red ↩');
});

test('header: the Copy button is 32px with a Copy SVG sibling — never inside [data-i18n]', () => {
  assert.ok(compSrc.includes('#pendingActionsModal .pending-header-icon-btn { min-height: 32px !important; height: 32px !important; padding: 0 10px;'),
    'Copy button is 32px on the header row (the !important beats the app-wide button:not([hidden]) 44px !important floor in styles.css)');
  assert.ok(pageSrc.includes('id="pendingActionsCopyDigestBtn" class="pending-header-icon-btn"'),
    'Copy button keeps its id and class');
  assert.ok(pageSrc.includes('<span data-ds-icon="Copy" aria-hidden="true"></span><span data-i18n="pending_copy_list">'),
    'Copy icon is a sibling span; the [data-i18n] key lives on the inner text span only (the apply function wipes children of [data-i18n] elements)');
  assert.ok(!pageSrc.includes('id="pendingActionsCopyDigestBtn" class="pending-header-icon-btn" type="button" data-i18n='),
    'the button itself carries no data-i18n (an icon inside one would land after the label)');
  const copyIcon = rule(navSrc, '#pendingActionsModal .pending-header-icon-btn [data-ds-icon] svg {');
  assert.ok(copyIcon.includes('width: 16px'), 'Copy icon renders at 16px, not the 20px wireDsIcons default');
  // Below ~373px viewport the header components total ~326px but the
  // modal content is only 314px at 360px — the "Copy List" label
  // overlaps the count badge by ~12px. On small phones the button
  // degrades to its icon alone (aria-label intact); above 380px the
  // full label shows.
  assert.ok(navSrc.includes('@media (max-width: 380px)'), 'small-phone breakpoint exists');
  const mqAt = navSrc.indexOf('@media (max-width: 380px)');
  const mqBlock = navSrc.slice(mqAt, navSrc.indexOf('}', navSrc.indexOf('[data-i18n]', mqAt)) + 1);
  assert.ok(mqBlock.includes('#pendingActionsModal .pending-header-icon-btn [data-i18n]'), 'the breakpoint targets the Copy text span');
  assert.ok(mqBlock.includes('display: none'), 'the Copy text span is hidden (not removed) on small phones');
});

test('header: the title shortens to "Pending Actions" (EN + UR) or it cannot fit the 48px row', () => {
  assert.ok(langSrc.includes("pending_actions_title: 'Pending Actions',"), 'EN title is "Pending Actions"');
  assert.ok(langSrc.includes("pending_actions_title: 'زیر التواء کام',"), 'UR title is the shortened form');
  assert.ok(!langSrc.includes("pending_actions_title: 'Pending Actions Center'"), 'long EN title is gone');
});

// --- §2: filter strip + bulk buttons ---

test('tabs: the strip wraps at ALL widths in both files (D2 — the scroll option is rejected)', () => {
  const navTabs = rule(navSrc, '.pending-actions-tabs {');
  assert.ok(navTabs.includes('flex-wrap: wrap'), 'nav.css base tabs wrap at all widths');
  assert.ok(compSrc.includes('.pending-actions-tabs { flex-wrap: wrap; }'),
    'components.css tabs wrap too — it used to say nowrap and overrode the nav.css base, recreating the scroll clip');
  // The e2e pills pin, restated as a source pin: a pill never shrinks,
  // so no label can clip mid-word ("All Pend" / "WhatsAp").
  const tab = rule(navSrc, '.pending-actions-tab {');
  assert.ok(tab.includes('flex-shrink: 0'), 'pills never shrink');
  // Receipts tab icon is a sibling span (the label span keeps data-i18n).
  assert.ok(pageSrc.includes('<span data-ds-icon="MessageCircle" aria-hidden="true"></span><span data-i18n="pending_tab_receipts">'),
    'receipts tab has a MessageCircle SVG sibling before the label');
  const tabIcon = rule(navSrc, '.pending-actions-tab [data-ds-icon] svg {');
  assert.ok(tabIcon.includes('width: 14px'), 'tab icon renders at 14px');
  assert.ok(langSrc.includes("pending_tab_receipts: 'WhatsApp Receipts',"), 'EN receipts label has no 📱 (the SVG replaces it)');
  assert.ok(langSrc.includes("pending_tab_receipts: 'واٹس ایپ رسیدیں',"), 'UR receipts label has no 📱');
});

test('bulk: three compact 34px/12px chips on one wrapping row (honest saving ~50px at 360px, not ~100px)', () => {
  const tools = rule(navSrc, '.pending-actions-quick-tools {');
  assert.ok(tools.includes('gap: 6px'), 'bulk row gap is 6px');
  assert.ok(tools.includes('flex-wrap: wrap'), 'bulk row wraps');
  const chip = rule(navSrc, '.btn-tool-secondary {');
  assert.ok(chip.includes('min-height: 34px'), 'bulk chips are 34px tall');
  assert.ok(chip.includes('height: 34px'), 'bulk chips are 34px tall (height, not just min-height)');
  assert.ok(chip.includes('padding: 0 10px'), 'bulk chips use compact padding');
  assert.ok(chip.includes('font-size: 12px'), 'bulk chips use 12px labels');
  assert.ok(chip.includes('white-space: nowrap'), 'bulk chip labels never wrap mid-label');
  const scopedChip = rule(navSrc, '#pendingActionsModal .btn-tool-secondary {');
  assert.ok(scopedChip.includes('min-height: 34px !important'), 'scoped bulk chips beat the app-wide 44px !important floor');
  assert.ok(scopedChip.includes('height: 34px !important'), 'scoped bulk chips beat the app-wide 44px !important floor (height too)');
  // The three compact buttons total ~438px at 360px vs 318px of content
  // width — they land on TWO rows. That is the honest shape; the labels
  // are NOT cut to stubs to force one row.
  assert.ok(pageSrc.includes('<span data-ds-icon="Trash2" aria-hidden="true"></span><span data-i18n="pending_clear_nophone">'),
    'Clear button uses a Trash2 SVG sibling (FilterX does not exist in ds-icons.js and is NOT added)');
  const clearIcon = rule(navSrc, '.pending-actions-quick-tools [data-ds-icon] svg {');
  assert.ok(clearIcon.includes('width: 14px'), 'Clear icon renders at 14px');
  assert.ok(langSrc.includes("pending_clear_nophone: 'Clear No-Phone Receipts',"), 'EN Clear label has no 🧹');
  assert.ok(langSrc.includes("pending_clear_nophone: 'بغیر فون والی رسیدیں صاف کریں',"), 'UR Clear label has no 🧹');
  assert.ok(langSrc.includes("pending_copy_list: 'Copy List',"), 'EN Copy label has no 📋');
});

// --- §3: one-row card actions ---

test('card actions: [Mark Shared] left, [Send WhatsApp] right, on ONE nowrap row (receipt cards only)', () => {
  // Template order is the spec order — wiring is by class, so the swap
  // is safe, and no test asserts template order.
  assert.ok(pendingSrc.indexOf('pending-mark-shared-btn') < pendingSrc.indexOf('pending-wa-btn'),
    'Mark Shared comes before Send WhatsApp in the receipt template');
  const actions = rule(navSrc, '.pending-card-receipt .pending-card-actions {');
  assert.ok(actions.includes('flex-wrap: nowrap'), 'receipt actions never wrap to a second row');
  assert.ok(actions.includes('margin-top: 8px'), 'receipt actions sit 8px below the meta line');
  const shared = rule(navSrc, '.pending-card-receipt .pending-mark-shared-btn {');
  assert.ok(shared.includes('flex: 1 1 0'), 'Mark Shared takes flex 1');
  assert.ok(shared.includes('white-space: nowrap'), 'Mark Shared label never wraps');
  const wa = rule(navSrc, '.pending-card-receipt .pending-wa-btn {');
  assert.ok(wa.includes('flex: 1.4 1 0'), 'Send WhatsApp takes flex 1.4');
  assert.ok(wa.includes('background: var(--ds-brand, #0F5338)'), 'Send WhatsApp uses the brand fill (scoped — the promise Collect Cash button keeps its teal)');
  assert.ok(wa.includes('white-space: nowrap'), 'Send WhatsApp label never wraps');
  const rowBtn = rule(navSrc, '.pending-card-receipt .pending-card-actions button {');
  assert.ok(rowBtn.includes('min-height: 38px !important'), 'receipt action buttons are 38px (components.css pins 36px and loads later, so this must be restated — and the !important beats the app-wide 44px button floor)');
  // Promise cards keep wrap — the nowrap rule is receipt-scoped only.
  assert.ok(!navSrc.includes('.pending-card-promise .pending-card-actions'), 'no promise-card actions override exists');
  assert.ok(pendingSrc.includes("${dsIcon('MessageCircle', 14)} Send WhatsApp"),
    'Send WhatsApp uses the inline MessageCircle SVG (Send does not exist in ds-icons.js and is NOT added)');
  assert.ok(!pendingSrc.includes('<span>📱 Send WhatsApp</span>'), 'no 📱 emoji left on the WhatsApp button (the header doc comment still names it — that is prose, not markup)');
});

// --- §4: phone line + badge ---

test('meta line: the phone icon + number sit in one nowrap span', () => {
  assert.ok(pendingSrc.includes('<span class="pending-phone-nowrap">📞 ${escapeHtml(phoneFormatted)}</span>'),
    'phone icon + number are wrapped so they never split across lines');
  const nowrap = rule(navSrc, '.pending-actions-modal .pending-phone-nowrap {');
  assert.ok(nowrap.includes('white-space: nowrap'), 'the phone span never wraps');
});

test('badge: the [UNSHARED RECEIPT] badge uses a 12px Receipt SVG, not 📱', () => {
  assert.ok(pendingSrc.includes("${dsIcon('Receipt', 12)} Unshared Receipt"),
    'badge uses the inline Receipt SVG');
  assert.ok(!pendingSrc.includes('📱 Unshared Receipt'), 'no 📱 emoji left in the badge');
  const badgeSvg = rule(navSrc, '.pending-card-badge svg {');
  assert.ok(badgeSvg.includes('width: 12px'), 'badge icon renders at 12px');
  assert.ok(badgeSvg.includes('vertical-align: -2px'), 'badge icon sits on the text baseline');
});

// --- ratchets ---

test('ratchet: styles.css still 613 distinct hex; nav.css 162 -> 164 is ONLY the two spec-mandated fallbacks', () => {
  const hexCount = (src) => {
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '');
    return new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).size;
  };
  // 614 → 613 with Customers Cards Compact (item B): deleting the
  // card's health-reasons rule removed its unique hex #62766d.
  assert.equal(hexCount(stylesSrc), 613, 'styles.css must stay at 613 distinct hex (this item does not touch it)');
  // nav.css 162 -> 164: the two new hex are the fallbacks the spec
  // itself mandates — var(--ds-brand, #0F5338) on .pending-wa-btn and
  // var(--color-neutral-100, #f0f4f2) on the close override. Both values
  // already exist as token values in tokens.css (--ds-brand #0f5338,
  // and #f0f4f2 is the QC close precedent's fallback); no other hex
  // was added. Recorded here, not hidden.
  assert.equal(hexCount(navSrc), 164, 'nav.css is 164 distinct hex (162 + the two spec-mandated fallbacks)');
  assert.ok(navSrc.includes('var(--ds-brand, #0F5338)'), '#0F5338 appears only as the --ds-brand fallback');
  assert.ok(navSrc.includes('var(--color-neutral-100, #f0f4f2)'), '#f0f4f2 appears only as the --color-neutral-100 fallback');
  assert.equal(hexCount(compSrc), 0, 'components.css stays hex-free');
});

test('ratchet: no new icons from THIS item — Send/FilterX are NOT added (Smartphone belongs to #1397 Area Analytics §5)', () => {
  assert.ok(!pendingSrc.includes("dsIcon('Send'"), 'Send icon is not used (it does not exist)');
  assert.ok(!pendingSrc.includes("dsIcon('FilterX'"), 'FilterX icon is not used (it does not exist)');
  assert.ok(!pageSrc.includes('data-ds-icon="Send"'), 'no Send hook in the markup');
  assert.ok(!pageSrc.includes('data-ds-icon="FilterX"'), 'no FilterX hook in the markup');
  // Why the Smartphone line changed (rebase onto main f9ad16c2, Nov 2026):
  // this ratchet used to forbid ANY Smartphone hook, because at #1400
  // time the icon did not exist. PR #1397 (Area Analytics, Month-End
  // Close & Sidebar Drawer Polish) legitimately adds Smartphone +
  // Keyboard via the Lucide map for the sidebar drawer footer (§5) —
  // the ds0 exact-set pin is 93 (91 + 2). This ratchet's intent is
  // that #1400 itself added no icons, so Send/FilterX stay forbidden
  // and Smartphone is pinned to its one #1397 home instead of banned.
  const phoneHooks = pageSrc.match(/data-ds-icon="Smartphone"/g) || [];
  assert.equal(phoneHooks.length, 1, 'Smartphone hook appears exactly once (drawer footer, #1397 §5)');
  const footer = pageSrc.slice(pageSrc.indexOf('nav-drawer-footer'), pageSrc.indexOf('nav-drawer-footer') + 4000);
  assert.ok(footer.includes('data-ds-icon="Smartphone"'), 'the one Smartphone hook lives in the nav drawer footer');
});

test('no real customer names or phone numbers in this test', () => {
  const testSrc = read('tests/pending-actions-center-fit.test.js');
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(testSrc), 'test must not contain a realistic phone number');
});
