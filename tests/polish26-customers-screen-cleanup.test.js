// Polish #26: Customers screen — clean placement, style and design for the
// ledger, search and new-customers panel.
//
// The header actions were one undifferentiated inline flow (four ragged
// rows on 360px): the daily add action was hidden in screen mode so Bulk
// add posed as the primary, the five bulk/import tools sat beside it in a
// different style, the toolbar row floated unlabelled, the search help was
// a permanent 9px grey wall, and the month panel's "Month" label was
// stranded mid-row by margin-left:auto. This polish groups the screen:
// ADD group (labelled primary add + Bulk add + help), BULK TOOLS behind a
// closed disclosure, VIEW group (Filters & sort + Compact list), search
// help behind a closed "How search works" affordance, and the month panel
// as a 2x2 chip grid with the Month row on its own full-width row. No
// action, filter, search behaviour, sort, view toggle, export, bulk tool
// or month control is removed or reworded; the customer list cards and
// the roster pill bar are untouched; the bottom nav is untouched
// (polish #25). All money shown in PKR only (no money touched here).
//
// DESIGN CORRECTIONS (verified against the 603d0b07 base before changing
// anything):
// - RC1 said ".pane-heading-actions has NO display:flex rule anywhere".
//   That missed the runtime-added class: setupCustomerSection
//   (ui-feedback.js) adds .cust-add-actions, which sets display:flex
//   (ui-feedback.css:178) — with flex-wrap overridden to wrap by the
//   later #customerPane rule (:192). So the container was already flex;
//   the ragged rows came from inline flow of unlike buttons, not from a
//   missing flex. This polish keeps that mechanism and adds the real
//   fix: two labelled group rows with an 8px gap.
// - The "+" hiding rule the design cited at screen-router.css:129 lives
//   at ui-feedback.css:177 instead ("body.sr-screen-mode
//   #addCustomerButton { display: none !important; }"). D2 removes that
//   rule (not the screen-router one): the screen header keeps its own
//   "+ Add Customer" action (srPrimaryAction), and the pane gets its own
//   labelled primary in the ADD group — the header scrolls away on
//   phones, so the in-ledger add entry is the one the operator sees.
// - D7 needs no renderer change: the month panel renderer
//   (app.js:3545-3551) already emits .new-customers-controls and
//   .new-customers-month; the grid is a CSS-only change on those hooks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

const html = read('index.html');
const styles = read('styles.css');
const components = read('components.css');
const dashboard = read('dashboard.css');
const uiFeedbackCss = read('ui-feedback.css');
const uiFeedbackJs = read('ui-feedback.js');
const customerImportJs = read('customer-import.js');

const flat = (s) => s.replace(/\s+/g, ' ');

// First top-level rule for a selector: the base rule, not a :hover /
// .is-active / [data-theme] variant and not a rule inside a media
// block. The next non-space char after the selector must be "{" (so
// ".cust-action-group" never matches ".cust-action-group-foo").
function baseRule(css, selector) {
  const flatCss = flat(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = flatCss.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
  assert.ok(m, `expected a base rule for ${selector}`);
  return m[0];
}

function decl(rule, prop) {
  const m = rule.match(new RegExp(`${prop}:\\s*([^;]+);`));
  assert.ok(m, `expected ${prop} in rule ${rule.slice(0, 80)}`);
  return m[1].trim();
}

// ---- D1: the header actions are two labelled groups ------------------

test('header actions: container is a real flex layout with an 8px gap', () => {
  const rule = baseRule(uiFeedbackCss, '#customerPane .pane-heading-actions');
  assert.equal(decl(rule, 'display'), 'flex');
  assert.equal(decl(rule, 'flex-wrap'), 'wrap');
  assert.equal(decl(rule, 'gap'), '8px');
  assert.equal(decl(rule, 'align-items'), 'center');
});

test('ADD group: labelled primary add, then help; Bulk add lands between them at runtime', () => {
  // Static markup: the ADD group holds the labelled primary and the help
  // button, in that order. Bulk add is runtime-created and inserted right
  // after #addCustomerButton (customer-import.js), so it lands between
  // the primary and the help button — the design's ADD order.
  const addGroup = html.match(/<div class="cust-action-group cust-add-group">([\s\S]*?)<\/div>\s*<\/div>\s*<details/);
  assert.ok(addGroup, 'expected the ADD group wrapper before the BULK TOOLS disclosure');
  const inner = addGroup[1];
  assert.match(inner, /<p class="eyebrow" data-i18n="cust_group_add">ADD<\/p>/, 'ADD eyebrow');
  const addIdx = inner.indexOf('id="addCustomerButton"');
  const helpIdx = inner.indexOf('class="help-info-btn"');
  assert.ok(addIdx >= 0 && helpIdx > addIdx, 'primary add first, help button after it');
  assert.match(
    customerImportJs,
    /addBtn\.insertAdjacentElement\('afterend', b\)/,
    'Bulk add is inserted right after #addCustomerButton, inside the ADD group'
  );
  // setupCustomerSection keeps runtime buttons in their groups instead of
  // yanking them back into the bare actions container.
  assert.match(uiFeedbackJs, /cust-add-group \.cust-action-row/, 'setup moves Bulk add into the ADD group row');
  assert.match(uiFeedbackJs, /cust-bulk-tools \.cust-action-row/, 'setup moves Wizard into the BULK TOOLS row');
  assert.doesNotMatch(
    uiFeedbackJs,
    /actions\.insertBefore\(b, doc\.getElementById\('addCustomerButton'\)\)/,
    'the old yank-into-actions move is gone'
  );
});

test('BULK TOOLS disclosure: closed by default, holds all five tools', () => {
  const details = html.match(/<details class="cust-bulk-tools">([\s\S]*?)<\/details>/);
  assert.ok(details, 'expected the BULK TOOLS <details>');
  const inner = details[1];
  assert.doesNotMatch(details[0].slice(0, details[0].indexOf('>') + 1), /\bopen\b/, 'disclosure is closed by default');
  assert.match(inner, /<span class="eyebrow" data-i18n="cust_group_bulk_tools">BULK TOOLS<\/span>/, 'BULK TOOLS eyebrow on the summary');
  assert.match(inner, /<span data-i18n="cust_bulk_tools">Bulk tools<\/span>/, 'summary reads "Bulk tools"');
  for (const id of [
    'openEnrollmentWizardBtn',
    'bulkImportOpenBtn',
    'rosterImportOpenBtn',
    'bulkSetupOpenBtn',
    'speedEntryOpenBtn',
  ]) {
    assert.ok(inner.includes(`id="${id}"`), `disclosure holds ${id}`);
  }
  // The summary follows the Plan 492 More actions precedent: flex row,
  // 44px, chevron that rotates open.
  const summary = baseRule(uiFeedbackCss, '.cust-bulk-tools-summary');
  assert.equal(decl(summary, 'display'), 'flex');
  assert.equal(decl(summary, 'min-height'), '44px');
  assert.match(baseRule(uiFeedbackCss, '.cust-bulk-tools-summary::after'), /content:\s*'▾'/);
  assert.match(baseRule(uiFeedbackCss, '.cust-bulk-tools[open] .cust-bulk-tools-summary::after'), /transform:\s*rotate\(180deg\)/);
});

// ---- D2: the labelled Add customer primary ---------------------------

test('Add customer primary: visible in screen mode, labelled, 44px by its own rule', () => {
  // The old hiding rule is gone: the pane's add button is the labelled
  // primary in the ADD group (the screen header keeps its own action).
  assert.doesNotMatch(
    uiFeedbackCss,
    /body\.sr-screen-mode #addCustomerButton\s*\{\s*display:\s*none/,
    'no rule hides #addCustomerButton in screen mode any more'
  );
  const btn = html.match(/<button id="addCustomerButton"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(btn, 'expected #addCustomerButton');
  assert.match(btn[1], /<span aria-hidden="true">＋<\/span>/, 'full-width plus glyph kept');
  assert.match(btn[1], /<span data-i18n="cust_add_customer">Add customer<\/span>/, 'visible label reuses cust_add_customer');
  const rule = baseRule(uiFeedbackCss, '#customerPane #addCustomerButton');
  assert.equal(decl(rule, 'min-height'), '44px');
  assert.equal(decl(rule, 'width'), 'auto');
  assert.equal(decl(rule, 'display'), 'inline-flex');
});

// ---- D3: one shared button size in the header ------------------------

test('.action-btn-sm carries its own min-height 44px', () => {
  const rule = baseRule(dashboard, '.action-btn-sm');
  assert.equal(decl(rule, 'min-height'), '44px');
  // Nothing else about the small action buttons changed: same 11px
  // Manrope, same green tint, same padding.
  assert.match(rule, /font:\s*700 11px\/1\.2 Manrope/);
  assert.match(rule, /padding:\s*var\(--space-1\) var\(--space-2\)/);
});

test('header help button is 44px in the header context only', () => {
  const rule = baseRule(components, '#customerPane .pane-heading-actions .help-info-btn');
  assert.equal(decl(rule, 'width'), '44px');
  assert.equal(decl(rule, 'height'), '44px');
  // The base 28px circle is untouched everywhere else.
  assert.equal(decl(baseRule(components, '.help-info-btn'), 'width'), '28px');
  assert.equal(decl(baseRule(components, '.help-info-btn'), 'height'), '28px');
  // The field-mode 44px precedent is untouched.
  assert.match(components, /\.field-mode-head \.help-info-btn \{ width: 44px; height: 44px; \}/);
});

// ---- D4: the toolbar row is the VIEW group ---------------------------

test('toolbar: VIEW eyebrow created with the bar; jump button unchanged', () => {
  assert.match(uiFeedbackJs, /cust_group_view/, 'setup creates the VIEW eyebrow from cust_group_view');
  assert.match(
    uiFeedbackJs,
    /eyebrow\.className = 'eyebrow cust-toolbar-eyebrow'/,
    'eyebrow carries the toolbar class'
  );
  const rule = baseRule(uiFeedbackCss, '.cust-list-toolbar .eyebrow');
  assert.equal(decl(rule, 'flex'), '1 1 100%');
  assert.equal(decl(rule, 'margin'), '0');
  // The toolbar itself is untouched: same gap, same padding.
  assert.equal(decl(baseRule(uiFeedbackCss, '.cust-list-toolbar'), 'gap'), '8px');
  assert.equal(decl(baseRule(uiFeedbackCss, '.cust-list-toolbar'), 'padding'), '0 22px 10px');
});

// ---- D5: the filter panel gains a heading, stays put -----------------

test('filter panel: FILTERS & SORT heading inside, panel still below the list', () => {
  const panel = html.match(/<section class="customer-filter-panel"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(panel, 'expected the filter panel');
  assert.match(
    panel[1],
    /<p class="eyebrow" data-i18n="cust_filters_sort_heading">FILTERS &amp; SORT<\/p>/,
    'heading is the first thing in the panel'
  );
  // No DOM move: the screen-router rule that puts the panel below the
  // list is untouched.
  assert.match(
    read('screen-router.css'),
    /body\.sr-screen-mode\[data-screen="customers"\] #customerPane > \.sr-moved-filters \{ order: 1; margin-top: 14px; \}/
  );
});

// ---- D6: the search help collapses -----------------------------------

test('search help: one closed details holding both sentences verbatim', () => {
  const details = html.match(/<details class="help-tip search-help"[^>]*>([\s\S]*?)<\/details>/);
  assert.ok(details, 'expected the search-help <details>');
  assert.doesNotMatch(details[0].slice(0, details[0].indexOf('>') + 1), /\bopen\b/, 'closed by default');
  assert.match(details[1], /<span data-i18n="cust_search_how_it_works">How search works<\/span>/, 'summary reads "How search works"');
  assert.match(details[1], /<span class="help-icon" aria-hidden="true">i<\/span>/, 'the i affordance is kept');
  assert.ok(details[1].includes('data-i18n="cust_search_help"'), 'first sentence kept verbatim');
  assert.ok(details[1].includes('data-i18n="cust_search_field_help"'), 'second sentence kept verbatim');
  // The two permanent <p> walls are gone from outside the details.
  assert.doesNotMatch(html, /<p id="customerListSearchHelp" class="customer-list-search-help"/);
  // The input still describes itself by the help (id moved to the details).
  assert.match(html, /aria-describedby="customerListSearchHelp"/);
  assert.match(details[0], /id="customerListSearchHelp"/, 'id moved onto the details');
  // When open, the help renders at the 11px floor, not 9px.
  assert.equal(decl(baseRule(uiFeedbackCss, '.search-help .customer-list-search-help'), 'font-size'), '11px');
  assert.match(baseRule(uiFeedbackCss, '.search-help:not([open]) .search-help-body'), /display:\s*none/);
});

test('search control row: field select capped, input keeps its room', () => {
  assert.equal(decl(baseRule(components, '.customer-search-field-select'), 'max-width'), '132px');
  assert.match(baseRule(styles, '.customer-list-search-control input'), /flex:\s*1 1 0/);
  assert.match(baseRule(styles, '.customer-list-search-control input'), /min-width:\s*0/);
  // The placeholder key is unchanged, so the full text still resolves.
  assert.match(html, /data-i18n-placeholder="cust_search_placeholder"/);
});

// ---- D7: the month panel is a grid -----------------------------------

test('month panel controls: two-column grid, Month row full-width', () => {
  const controls = baseRule(styles, '.new-customers-controls');
  assert.equal(decl(controls, 'display'), 'grid');
  assert.equal(decl(controls, 'grid-template-columns'), '1fr 1fr');
  assert.equal(decl(controls, 'gap'), '6px');
  const month = baseRule(styles, '.new-customers-month');
  assert.equal(decl(month, 'grid-column'), '1/-1');
  assert.equal(decl(month, 'margin-left'), '0');
  assert.doesNotMatch(month, /margin-left:\s*auto/, 'no margin-left:auto left to strand the label');
  const select = baseRule(styles, '.new-customers-month select');
  assert.equal(decl(select, 'flex'), '1');
  // The rest of the panel is untouched: same margin, same list height.
  assert.match(baseRule(styles, '.new-customers-panel'), /margin:\s*0 10px 14px/);
  assert.match(baseRule(styles, '.new-customers-list'), /max-height:\s*220px/);
});

// ---- New i18n keys ship in EN + UR -----------------------------------

test('new group labels ship in EN + UR together', async () => {
  const { TRANSLATIONS } = await import('../nav-language.js');
  const expected = {
    cust_group_add: ['ADD', 'شامل کریں'],
    cust_group_bulk_tools: ['BULK TOOLS', 'بلک ٹولز'],
    cust_bulk_tools: ['Bulk tools', 'بلک ٹولز'],
    cust_group_view: ['VIEW', 'منظر'],
    cust_search_how_it_works: ['How search works', 'تلاش کیسے کام کرتی ہے'],
    cust_filters_sort_heading: ['FILTERS & SORT', 'فلٹر اور ترتیب'],
  };
  for (const [key, [en, ur]] of Object.entries(expected)) {
    assert.equal(TRANSLATIONS.en[key], en, `en ${key}`);
    assert.equal(TRANSLATIONS.ur[key], ur, `ur ${key}`);
  }
});

// ---- No new hex; nothing else moved ----------------------------------

test('no new hex in any changed rule', () => {
  // Every rule this polish adds or touches is token-only (or reuses a
  // hex already in its file, which the design-tokens ratchet caps).
  for (const [css, selector] of [
    [uiFeedbackCss, '#customerPane .pane-heading-actions'],
    [uiFeedbackCss, '.cust-action-group'],
    [uiFeedbackCss, '.cust-action-row'],
    [uiFeedbackCss, '.cust-bulk-tools-summary'],
    [uiFeedbackCss, '#customerPane #addCustomerButton'],
    [uiFeedbackCss, '.cust-list-toolbar .eyebrow'],
    [uiFeedbackCss, '.search-help > summary'],
    [uiFeedbackCss, '.search-help .customer-list-search-help'],
    [styles, '.new-customers-controls'],
    [components, '#customerPane .pane-heading-actions .help-info-btn'],
    [components, '.customer-search-field-select'],
  ]) {
    assert.doesNotMatch(baseRule(css, selector), /#[0-9a-fA-F]{3,8}\b/, `${selector} adds no hex`);
  }
  // .action-btn-sm keeps its one pre-existing hex (#0e5b4d, the
  // var(--green) fallback from before this polish) and gains no other.
  assert.deepEqual(
    [...new Set(baseRule(dashboard, '.action-btn-sm').match(/#[0-9a-fA-F]{3,8}\b/g) || [])].sort(),
    ['#0e5b4d'],
    '.action-btn-sm hex set unchanged'
  );
  // .new-customers-month keeps its one pre-existing hex (#4b6259, the
  // label colour from before this polish) and gains no other.
  assert.deepEqual(
    [...new Set(baseRule(styles, '.new-customers-month').match(/#[0-9a-fA-F]{3,8}\b/g) || [])].sort(),
    ['#4b6259'],
    '.new-customers-month hex set unchanged'
  );
});

test('the 17px side inset and the list-first order are untouched', () => {
  assert.match(uiFeedbackCss, /padding-left: 17px; padding-right: 17px;/, 'phone inset kept');
  // The roster pill bar and the customer list are untouched by this polish.
  assert.ok(html.includes('id="rosterPillBar"'), 'pill bar still present');
  assert.ok(html.includes('id="customerList"'), 'customer list still present');
  // The bottom nav is untouched (polish #25 owns it).
  assert.doesNotMatch(uiFeedbackCss, /\.mobile-bottom-nav/, 'no bottom-nav rule here');
});
