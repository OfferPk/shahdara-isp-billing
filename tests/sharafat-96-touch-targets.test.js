// Sharafat 96 — sub-44px interactive controls outside the already-covered surfaces.
//
// Port of the implementer's repro (~/workspace/.sharafat96-scratch/repro.mjs):
// 29 checks — F1–F13 assert the fixed state, D1–D6 document the doc claims
// that were already true on base (the spec read the chip rules in isolation
// and missed the global floor), C1–C8 + S1–S2 are guards.
//
// RENDERED-SIZE MODEL (the Plan 550 correction): styles.css:923 carries a
// global `button:not([hidden]) { min-height: 44px !important; }` floor, so
// most <button> controls ALREADY render >=44px tall. The real defects are:
//  (a) non-button controls the floor never reaches (summary, a);
//  (b) rules that defeat the floor with a heavier !important (help-info-btn
//      28px, Pending Actions Copy 32px, wada-btn 28px, queue-nav-btn 30px);
//  (c) widths: the floor is height-only, so icon buttons with width:32px
//      render 32px wide x 44px tall.
//
// Disclosed follow-ups (not this item): the QC-modal floor-defeater cluster,
// ~25 width-only icon buttons, Plans 602/603/605/685 surfaces, the
// user-specified 32px Pending Actions close (excluded — reversing a user
// decision needs naming, not silence), the Sharafat 90 pill note (32 wide x
// 44 tall on phones, not 32x32). Fixture data: none — pure CSS-source
// assertions, no names or numbers.
//
// ROUND 2 (user request 2026-11-17 — Customers Cards ultra-compact,
// parent D1): the user's EXPLICIT request shrinks TWO controls BELOW
// the 44px floor, in this item's !important-defeater shape — recorded,
// not blessed. (1) the ＋ Additional micro-pill to 24px
// (components.css .additional-pending-btn + its defeater, pinned in
// tests/customers-cards-round2.test.js R1d/R6c); (2) the card action
// buttons to 36px (styles.css .customer-card-action-btn + its
// defeater — F10 below is rewritten to pin that, not to pass it).
// The global floor itself is untouched, and the two defeaters are
// the ONLY new ones (R6c counts them).
//
// MONTH-END CLOSE POLISH (2026-11-20, D5): the registry (i) buttons in
// the analytics panels shrink to 28px by a NAMED scoped exception
// (.analytics-panel .help-icon, F4 below) — the user asked for the
// oversized standalone (i) buttons to shrink. F4 now pins the base
// 40x40 rule AND the 28px exception, and fails any other sub-40px
// .help-icon rule. The More-tab item uses the same 28px exception
// for its own sections (markup moves only — no new CSS rule).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const styles = read('styles.css');
const nav = read('nav.css');
const components = read('components.css');

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
const stylesNC = stripComments(styles);
const navNC = stripComments(nav);
const compNC = stripComments(components);

// All rule bodies for a selector (any occurrence — the 95 lesson: some
// selectors appear in several rules and the first occurrence is not always
// the one carrying the property).
function ruleBodies(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}', 'g');
  return [...css.matchAll(re)].map((m) => m[1]);
}
// Rule bodies whose selector LIST contains `member` (multi-selector rules:
// `.close-button, .modal-close-btn, .billing-modal-close { ... }` — anchor
// on the member, allow the rest of the list before the `{`).
function ruleBodiesList(css, member) {
  const esc = member.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '[^{]*\\{([^}]*)\\}', 'g');
  return [...css.matchAll(re)].map((m) => m[1]);
}
// Every px size declared for height/min-height/width/min-width across all bodies.
function sizes(bodies) {
  const out = [];
  for (const b of bodies) {
    for (const m of b.matchAll(/(?:min-height|height|min-width|width)\s*:\s*([\d.]+)px/g)) {
      out.push(Number(m[1]));
    }
  }
  return out;
}
const allAtLeast = (bodies, n) => {
  const s = sizes(bodies);
  return s.length > 0 && s.every((v) => v >= n);
};
const hasProp = (bodies, re) => bodies.some((b) => re.test(b));

function hexCount(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(noComments.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).size;
}

// --- F: the bug (each FAILS on base) ---
test('F1 sidebar-rail-toggle is >=40px in its own rule (width is the gap)', () => {
  assert.ok(allAtLeast(ruleBodies(navNC, '.sidebar-rail-toggle'), 40),
    'nav.css .sidebar-rail-toggle still width/height 32px (renders 32 wide x 44 tall — the floor is height-only)');
});

test('F2 sheet-close-btn is >=40px in its own rule', () => {
  assert.ok(allAtLeast(ruleBodies(navNC, '.sheet-close-btn'), 40),
    'nav.css .sheet-close-btn still 32x32 (renders 32 wide x 44 tall)');
});

test('F3 Saad-visits / install-tracker secondary buttons carry min-height >=40 in their own rule', () => {
  assert.ok(allAtLeast(ruleBodies(compNC, '.saad-visits-card-actions .secondary-button, .install-tracker-card-actions .secondary-button, .saad-visits-payment-actions .secondary-button'), 40),
    'components.css:1593 still min-height: 32px (renders 44px tall via the floor — own-rule guarantee missing, Plan 550 pattern)');
});

test('F4 help-icon (summary) is 40x40 in its own rule', () => {
  // Month-end close polish (2026-11-20, D5): the registry (i) buttons
  // in the analytics panels shrink to 28px by a NAMED scoped
  // exception (.analytics-panel .help-icon) — the user asked for the
  // oversized standalone (i) buttons to shrink. The BASE .help-icon
  // rule stays 40x40 in its own rule (a <summary>, so the button
  // floor never reaches it), and the named 28px exceptions were
  // the only sub-40px .help-icon rules until the search toolbar
  // and the uptime toggle below (20px each). Any further shrink
  // must extend the exceptions by name, not pass silently.
  // Expenses 3-tab polish (2026-11-20): the Saad payroll card is one
  // compact metric card, so its (i) is a 28px informational trigger —
  // matched to the Month-end 28px standard after #1553 merged — as a
  // second NAMED scoped exception, pinned by name below.
  // Customers search toolbar (user, 2026-11-21): the search help is a
  // compact 20px (i) next to the label — a third NAMED scoped
  // exception (.customer-list-search .search-help .help-icon), pinned
  // by name below. The base stays 40x40; the two 28px exceptions are
  // untouched.
  // Reports Status polish (2026-11-22): the two Status-tab (i)
  // help-tips (dues recovery + collection by area) are 28px
  // informational triggers — matched to the Month-end 28px standard —
  // as a FOURTH NAMED scoped exception, pinned by name below.
  const base = /\.help-icon\{([^}]*)\}/.exec(stylesNC)?.[1];
  assert.ok(base, 'base .help-icon rule present');
  assert.ok(sizes([base]).length > 0 && sizes([base]).every((v) => v >= 40),
    'styles.css .help-icon still 32x32 — a <summary>, so the button floor never reaches it');
  const scoped = /\.analytics-panel\s+\.help-icon\s*\{([^}]*)\}/.exec(stylesNC)?.[1];
  assert.ok(scoped, 'scoped .analytics-panel .help-icon rule present');
  assert.deepEqual(sizes([scoped]).sort((a, b) => a - b), [28, 28, 28],
    'scoped registry (i) is exactly 28px (Month-end D5)');
  const saad = /\.saad-payroll-card\s+\.help-icon\s*\{([^}]*)\}/.exec(stylesNC)?.[1];
  assert.ok(saad, 'scoped .saad-payroll-card .help-icon rule present');
  assert.deepEqual(sizes([saad]).sort((a, b) => a - b), [28, 28, 28],
    'scoped Saad payroll (i) is exactly 28px (Expenses 3-tab polish, matched to Month-end D5)');
  const search = /\.customer-list-search\s+\.search-help\s+\.help-icon\s*\{([^}]*)\}/.exec(stylesNC)?.[1];
  assert.ok(search, 'scoped .customer-list-search .search-help .help-icon rule present');
  assert.deepEqual(sizes([search]).sort((a, b) => a - b), [20, 20, 20],
    'scoped search (i) is exactly 20px (Customers search toolbar, user 2026-11-21)');
  const reportsStatus = /\.reports-status-help\s+\.help-icon\s*\{([^}]*)\}/.exec(stylesNC)?.[1];
  assert.ok(reportsStatus, 'scoped .reports-status-help .help-icon rule present');
  assert.deepEqual(sizes([reportsStatus]).sort((a, b) => a - b), [28, 28, 28],
    'scoped Reports Status (i) is exactly 28px (Reports Status polish, matched to Month-end D5)');
  // Profile Uptime polish (2026-11-22): the uptime header (i) is a
  // small inline toggle, so its .help-icon is a 20px NAMED scoped
  // exception, pinned by name below — the fifth named exception.
  const uptime = /\.uptime-section\s+\.help-icon\s*\{([^}]*)\}/.exec(stylesNC)?.[1];
  assert.ok(uptime, 'scoped .uptime-section .help-icon rule present');
  assert.deepEqual(sizes([uptime]).sort((a, b) => a - b), [20, 20, 20],
    'scoped uptime (i) is exactly 20px (Profile Uptime polish, inline toggle)');
  const all = sizes(ruleBodies(stylesNC, '.help-icon'));
  assert.ok(all.every((v) => v >= 40 || v === 28 || v === 20),
    'a .help-icon rule other than the named 28px / 20px exceptions carries a sub-40px size');
});

test('F5 detail-identity-action (a) is 40x40 in its own rule', () => {
  assert.ok(allAtLeast(ruleBodies(stylesNC, '.detail-identity-action'), 40),
    'styles.css .detail-identity-action still 32x32 — an <a>, so the button floor never reaches it');
});

test('F6 profile help-info-btn carries no sub-40px size', () => {
  // The fix DELETES the four size declarations (the base 40px circle's
  // (0,2,1) selector beats the floor; raising them in place would render
  // 44 wide x 40 tall), so zero sizes in the rule is the passing state.
  const s = sizes(ruleBodies(stylesNC, '.profile-detail-section .help-info-btn'));
  assert.ok(s.length === 0 || s.every((v) => v >= 40),
    'styles.css:17422 still 32px sizes with min-height:32px!important (renders 32 wide x 28 tall)');
});

test('F7 base help-info-btn is a 40px circle in its own rule', () => {
  // Reports Register & audit polish: the four Compare-tab audit headers
  // carry a NAMED scoped 28px exception (matched to the Month-end D5 /
  // F4 .help-icon 28px standard) — the base rule stays a 40px circle.
  // The base rule is anchored to the start of its line so the override's
  // last selector member (which ends with the same text) does not match.
  const base = /(?:^|\n)button:not\(\[hidden\]\)\.help-info-btn\s*\{([^}]*)\}/.exec(compNC)?.[1];
  assert.ok(base, 'base button:not([hidden]).help-info-btn rule present');
  assert.ok(sizes([base]).length > 0 && sizes([base]).every((v) => v >= 40),
    'components.css base help-info-btn still 40px circle');
  const scoped = /\.upsell-header button:not\(\[hidden\]\)\.help-info-btn,\s*\.revleak-header button:not\(\[hidden\]\)\.help-info-btn,\s*\.winback-header button:not\(\[hidden\]\)\.help-info-btn,\s*\.hwaudit-header button:not\(\[hidden\]\)\.help-info-btn\s*\{([^}]*)\}/.exec(compNC)?.[1];
  assert.ok(scoped, 'scoped audit-header help-info-btn rule present');
  assert.deepEqual(sizes([scoped]).sort((a, b) => a - b), [28, 28, 28],
    'scoped audit-header (i) is exactly 28px (Reports Register & audit polish)');
  const all = sizes(ruleBodies(compNC, 'button:not([hidden]).help-info-btn'));
  assert.ok(all.length > 0 && all.every((v) => v >= 40 || v === 28),
    'a help-info-btn rule other than the named 28px exception carries a sub-40px size');
});

test('F8 QC help-info-btn rules carry no sub-40px size', () => {
  assert.ok(allAtLeast(ruleBodies(stylesNC, '#quickCollectModal .help-info-btn'), 40),
    'styles.css:9731 is 32px and :10516 is 36px (later wins — renders 36x36)');
});

test('F9 Pending Actions Copy button carries no 32px !important size', () => {
  assert.ok(allAtLeast(ruleBodies(compNC, '#pendingActionsModal .pending-header-icon-btn'), 40),
    'components.css:3992 still min-height:32px !important + height:32px !important (defeats the floor; the 48px header row still fits a 44px button)');
});

test('F10 customer-card-action-btn is 36px by USER DECISION (Round 2 D1) — defeater pins it, floor stays intact', () => {
  // ROUND 2 REWRITE (parent D1, user request 2026-11-17): the action
  // buttons shrink from 40px to 36px on the user's explicit request
  // for ultra-compact cards — recorded, not blessed. The 36px class
  // rule alone would LOSE to the 44px global floor, so the
  // 96-precedent !important defeater carries it, exactly like the
  // 24px ＋ Additional micro-pill. This test pins the DELIBERATE
  // exception (36px + defeater), it does not bless it — the floor
  // itself is untouched (R6c in tests/customers-cards-round2.test.js
  // pins the floor rule verbatim and counts the defeaters).
  assert.ok(hasProp(ruleBodies(stylesNC, '.customer-card-action-btn'), /min-height\s*:\s*36px/),
    'styles.css .customer-card-action-btn is no longer min-height:40px');
  assert.ok(/button:not\(\[hidden\]\)\.customer-card-action-btn\s*\{[^}]*min-height\s*:\s*36px\s*!important/.test(stylesNC),
    'styles.css carries the 36px !important defeater for the action buttons');
});

test('F11 bare .edit-payment carries its own min-height >=40 (Plan 550 pattern)', () => {
  assert.ok(/\.edit-payment\{[^}]*min-height\s*:\s*(4[0-9]|[5-9][0-9])px/.test(stylesNC),
    'styles.css:1 bare .edit-payment has padding 6px 8px and no min-height (renders 44px tall via the floor — own-rule guarantee missing)');
});

test('F12 wada-btn carries min-height >=40', () => {
  assert.ok(hasProp(ruleBodies(stylesNC, '.wada-btn'), /min-height\s*:\s*(4[0-9]|[5-9][0-9])px/),
    'styles.css:16510 still min-height:28px !important (promises-list action buttons)');
});

test('F13 queue-nav-btn carries min-height >=40', () => {
  assert.ok(hasProp(ruleBodies(stylesNC, '.queue-nav-btn'), /min-height\s*:\s*(4[0-9]|[5-9][0-9])px/),
    'styles.css:15893 still min-height:30px !important (reminder-queue Prev/Skip/Next)');
});

// --- D: doc claims already true on base (PASS by design — the doc is stale here) ---
test('D1 .close-button already carries >=44px in its own rules (doc says 33x33)', () => {
  assert.ok(hasProp(ruleBodies(stylesNC, '.close-button'), /width\s*:\s*44px/)
    && hasProp(ruleBodiesList(compNC, '.close-button'), /width\s*:\s*48px/),
    'close-button is 44x44 at styles.css:530/:928 and 48x48 in the universal rule — the line-1 33px rule is dead');
});

test('D2 .edit-payment already renders >=44px tall via the global floor', () => {
  assert.ok(/button:not\(\[hidden\]\)\s*\{\s*min-height:\s*44px\s*!important/.test(stylesNC),
    'the styles.css:923 floor exists');
});

test('D3 Saad/install-tracker buttons already render >=44px tall via the floor', () => {
  assert.ok(!ruleBodies(compNC, '.saad-visits-card-actions .secondary-button, .install-tracker-card-actions .secondary-button, .saad-visits-payment-actions .secondary-button').join(' ').includes('!important'),
    'the :1593 min-height:32px carries no !important, so the floor wins');
});

test('D4 .command-palette-trigger has no element (dead rule — deleted, not fixed)', () => {
  assert.ok(!read('index.html').includes('command-palette-trigger')
    && !read('nav.js').includes('command-palette-trigger')
    && !read('app.js').includes('command-palette-trigger'),
    'no markup or JS template carries the class — only nav.css rules reference it');
  assert.ok(!nav.includes('.command-palette-trigger') && !read('dark-contrast.css').includes('.command-palette-trigger'),
    'the dead trigger rule set is deleted from nav.css + dark-contrast.css (the palette dialog itself is live — Ctrl+K)');
});

test('D5 mohalla-card-collect--compact already renders >=44px tall via the floor', () => {
  assert.ok(!ruleBodies(compNC, '.mohalla-card-collect--compact').join(' ').includes('!important'),
    'the "compact 32px" comment is stale as rendered — the 32px min-height loses to the floor');
});

test('D6 .view-nav-button base already carries 44px', () => {
  assert.ok(hasProp(ruleBodies(stylesNC, '.view-nav-button'), /min-height\s*:\s*44px/),
    'styles.css:596 base rule is min-height:44px');
});

// --- C/S: guards and controls ---
// Plan 588 D5(b) re-pins nav.css 164 -> 163: .btn-primary:hover #094338
// (its only occurrence) is re-tokened to var(--color-brand-700).
// Title + assert move together (Plan 586 rule).
test('C1 hex pins hold (styles.css 610 / nav.css 163 / components.css 0, no new hex)', () => {
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  // 608 → 610 with the Customers List Cards polish (D2): exactly the
  // two spec-literal name colours #1E3A5F (navy) + #9f1239 (rose-800).
  assert.equal(hexCount(styles), 610, `styles.css hex count moved (${hexCount(styles)})`);
  assert.equal(hexCount(nav), 163, `nav.css hex count moved (${hexCount(nav)})`);
  assert.equal(hexCount(components), 0, `components.css hex count moved (${hexCount(components)})`);
});

test('C2 user-specified Pending Actions close stays 32px (EXCLUDED — do not touch)', () => {
  assert.ok(ruleBodies(navNC, '#pendingActionsModal #closePendingActionsModalBtn').join(' ').includes('width: 32px !important'),
    'the 32px neutral x close is user-specified (modal-close-audit:242) — raising it reverses a user decision');
});

test('C3 pagination-btn stays 36px (48px row arithmetic)', () => {
  assert.ok(hasProp(ruleBodies(stylesNC, '#transactionPagination .pagination-btn'), /width\s*:\s*36px/),
    '36px controls + 6px padding = the pinned 48px row');
});

test('C4 topbar 38px cluster stays (<=480px fit)', () => {
  assert.ok(hasProp(ruleBodies(stylesNC, '.topbar .backup-health-badge'), /width\s*:\s*38px/)
    && hasProp(ruleBodies(stylesNC, '.topbar #fieldModeToggleBtn'), /width\s*:\s*38px/),
    'the 38px topbar dots are pinned by topbar-mobile-fit');
});

test('C5 field-mode-head + customerPane help-info-btn stay 44x44', () => {
  assert.ok(hasProp(ruleBodies(compNC, '.field-mode-head .help-info-btn'), /width\s*:\s*44px/)
    && hasProp(ruleBodies(compNC, '#customerPane .pane-heading-actions .help-info-btn'), /width\s*:\s*44px/),
    'the two 44px help-info-btn variants are already correct');
});

test('C6 universal 48px red close rule untouched', () => {
  assert.ok(hasProp(ruleBodiesList(compNC, '.close-button'), /width\s*:\s*48px/)
    && hasProp(ruleBodiesList(compNC, '.close-button'), /background\s*:\s*var\(--color-overdue\)/),
    'the PR #453 universal close must stay 48px red');
});

test('C7 spec-d Pending Actions rows stay 34px / 38px (EXCLUDED)', () => {
  assert.ok(hasProp(ruleBodies(navNC, '#pendingActionsModal .btn-tool-secondary'), /min-height\s*:\s*34px !important/)
    && hasProp(ruleBodies(navNC, '.pending-card-receipt .pending-card-actions button'), /min-height\s*:\s*38px !important/),
    'the 34px bulk chips and the spec 38px row are deliberate compression, not this item');
});

test('C8 braces balanced in styles.css + nav.css + components.css', () => {
  assert.equal((styles.match(/\{/g) || []).length, (styles.match(/\}/g) || []).length,
    'styles.css brace mismatch');
  assert.equal((nav.match(/\{/g) || []).length, (nav.match(/\}/g) || []).length,
    'nav.css brace mismatch');
  assert.equal((components.match(/\{/g) || []).length, (components.match(/\}/g) || []).length,
    'components.css brace mismatch');
});

test('S1 EN/UR parity holds (4,669 / 4,669 — Round 2 D9 net −1, Quick Collect polish +4 keys, Plan 582 −6 orphan keys)', () => {
  // Round 2 (D9): 'cust_card_father_ref_short' and
  // 'cust_card_tenure_since_short' deleted, 'cust_card_ref_short'
  // added — net −1 key in each dict. Quick Collect polish
  // (2026-11-17): 4 new keys, EN + UR — qc3_collect_advance,
  // qc_head_payable, qc_head_bill_dues, qc_loose_keep_chip.
  // Parity is kept: 4,672 − 1 + 4 = 4,675. Plan 582 (D1(b)) deletes
  // the six orphan dash_tile_collect_*/dash_tile_closing_* keys:
  // 4,675 − 6 = 4,669.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  // Reports Closing polish: +1 key dash_khata_open ('Open Khata Closing ›')
  // — parity 5,223 → 5,229/5,229. If the Reports Register polish (+5 keys)
  // merges first, re-pin to 5,229.
  // Re-pin (Bill card rebase 2026-11-23): parity 5,229 → 5,231 — L adds 2 keys, prof_hist_snapshot_footnote + prof_hist_due_on, EN + UR.
  // Re-pin (Billing history rebase 2026-11-23): parity 5,231 → 5,234 — M adds 3 keys, prof_hist_empty_months + prof_hist_mark_paid + prof_hist_empty_custom, EN + UR.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5234, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5234, 'UR key count moved');
});

test('S2 global button floor intact', () => {
  assert.ok(/button:not\(\[hidden\]\)\s*\{\s*min-height:\s*44px\s*!important/.test(stylesNC),
    'the styles.css:923 floor is load-bearing for this whole item');
});
