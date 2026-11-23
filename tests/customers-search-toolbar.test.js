// Customers search toolbar (user, 2026-11-21): the search row squeezed
// the field select + input + Clear onto one 360px row, while Compact list
// / Filters & sort / How search works stacked vertically. The fix: a
// full-width pill input (icon element + inline ✕), the identifier select
// moved into the Filters panel, a 20px (i) next to the label, Compact +
// Filters side-by-side in one 2-column row, and 'Bulk tools' once.
//
// Source-level, in the polish26-customers-screen-cleanup.test.js style —
// the Customers wiring lives in app.js module scope (it cannot be
// imported) and the toolbar is built at runtime by setupCustomerSection
// (ui-feedback.js), so the contract is checked where the code lives.
// This file is NOT a pinning file: it carries no parity total.
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

const html = read('index.html');
const styles = read('styles.css');
const components = read('components.css');
const uiFeedbackCss = read('ui-feedback.css');
const uiFeedbackJs = read('ui-feedback.js');
const screenRouterJs = read('screen-router.js');
const app = read('app.js');
const language = read('nav-language.js');

const flat = (s) => s.replace(/\s+/g, ' ');

// First top-level rule for a selector (polish26 pattern).
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
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
function hexCount(css) {
  return new Set(stripComments(css).match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).size;
}

// The search control block as it stands in index.html.
function searchControlHtml() {
  const m = html.match(/<div class="customer-list-search-control">([\s\S]*?)<\/div>/);
  assert.ok(m, 'expected .customer-list-search-control in index.html');
  return m[1];
}
function filterPanelHtml() {
  const m = html.match(/<section class="customer-filter-panel"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(m, 'expected .customer-filter-panel in index.html');
  return m[1];
}
function bulkSummaryHtml() {
  const m = html.match(/<summary class="cust-bulk-tools-summary">([\s\S]*?)<\/summary>/);
  assert.ok(m, 'expected the BULK TOOLS summary in index.html');
  return m[1];
}

// ---- C1: the search input is a full-width pill -----------------------
test('C1: search input is a full-width pill with room for the icon + clear', () => {
  const control = searchControlHtml();
  // The field select is gone from the control (moved to the drawer) and
  // the external Clear button is gone (replaced by the inline ✕).
  assert.doesNotMatch(control, /id="customerSearchField"/, 'no field select in the search control');
  assert.doesNotMatch(control, />Clear<\/button>/, 'no external Clear button in the search control');
  // The input sits in a relative wrapper with the icon + the inline ✕.
  assert.match(control, /class="[^"]*customer-search-box[^"]*"/, 'input wrapper exists');
  assert.match(control, /id="customerListSearch"[^>]*type="search"/, 'input keeps id + type=search');
  // Placeholder is the new text (no emoji in it — the icon is an element).
  assert.match(language, /cust_search_placeholder: 'Search name, #ID, or phone\.\.\./,
    'placeholder is the new text');
  assert.doesNotMatch(control, /placeholder="[^"]*🔍/, 'no magnifier glyph inside the placeholder');
  // The pill: full width, on-scale radius (14px --radius-md or 18px
  // --radius-lg — 16px rounded-2xl is off the token scale), padding
  // that clears the 18px icon on the left and the ✕ on the right.
  const inputRule = baseRule(styles, '.customer-list-search-control input');
  assert.ok(/width:\s*100%/.test(inputRule), 'input is full-width');
  const radius = decl(inputRule, 'border-radius');
  assert.ok(
    radius === 'var(--radius-md)' || radius === 'var(--radius-lg)' || radius === '14px' || radius === '18px',
    `pill radius is on-scale (14/18px or token), got ${radius}`
  );
  assert.ok(/padding-inline-start:\s*(3[89]|[4-9][0-9])px/.test(inputRule), 'left padding clears the icon');
  assert.ok(/padding-inline-end:\s*(3[6-9]|[4-9][0-9])px/.test(inputRule), 'right padding clears the inline ✕');
});

// ---- C2: leading magnifier is a real icon element --------------------
test('C2: a real magnifier icon sits inside the search box', () => {
  const control = searchControlHtml();
  // The QC picker precedent (styles.css:8602): a real icon element, not
  // the placeholder's first character. dsIcon "Search" SVG, 18px.
  assert.match(control, /data-ds-icon="Search"/, 'Search icon element in the box');
  assert.ok(
    /\.customer-search-icon\s*\{[^}]*position:\s*absolute[^}]*inset-inline-start:\s*12px/.test(flat(styles)),
    'icon is absolutely positioned at the left edge'
  );
});

// ---- C3: inline ✕ clear, same handler, hidden when empty ------------
test('C3: the inline ✕ keeps the Clear id + handler and hides when empty', () => {
  const control = searchControlHtml();
  // The ✕ KEEPS id="clearCustomerListSearch" so the Sharafat 31/81/84
  // handler binding and the deployment pin survive the move.
  assert.match(control, /id="clearCustomerListSearch"[^>]*>/, '✕ keeps the Clear id');
  assert.match(control, /aria-label="Clear customer-list search"/, '✕ keeps the clear aria-label');
  assert.match(control, /class="[^"]*customer-search-clear[^"]*"/, '✕ carries its clear class');
  // It only renders when the query is non-empty: app.js toggles its
  // hidden state from the list input's value.
  assert.ok(
    /clearCustomerListSearch['"]?\)?\.?(hidden|classList)/.test(app) &&
    app.includes("$('#clearCustomerListSearch')"),
    'app.js toggles the ✕ visibility from the query'
  );
  // The handler itself is untouched: the Sharafat 31 gate, the 81
  // last-rendered-query bookkeeping and the 84 shown-counts reset.
  assert.ok(app.includes("$('#clearCustomerListSearch').addEventListener('click',"),
    'Clear click binding intact');
  assert.ok(app.includes('globalIsActiveFilter'), 'Sharafat 31 global gate intact');
});

// ---- C4: identifier selector lives in the Filters panel --------------
test('C4: the identifier select is inside the Filters panel, default any', () => {
  const panel = filterPanelHtml();
  assert.ok(panel.includes('id="customerSearchField"'), 'select is inside the filter panel');
  assert.ok(panel.includes('<option value="any" selected'), 'Any identifier is still the default');
  for (const value of ['name', 'mobile', 'userid', 'area', 'identity']) {
    assert.ok(panel.includes(`<option value="${value}"`), `select still offers ${value}`);
  }
  // The select keeps its localised label (reused as the panel label).
  assert.ok(panel.includes('data-i18n="cust_search_field_label"'), 'Search-by label travels with it');
});

// ---- C5: help is a 20px (i) icon next to the label -------------------
test('C5: help is a compact 20px (i) icon next to the label, content kept', () => {
  // The full-width "How search works" summary row is gone; the details
  // sits beside the label with an icon-only summary.
  assert.doesNotMatch(html, /<span data-i18n="cust_search_how_it_works">How search works<\/span>/,
    'no full-width "How search works" summary text left');
  const details = html.match(/<details class="help-tip search-help"[^>]*>([\s\S]*?)<\/details>/);
  assert.ok(details, 'search-help details still exists');
  assert.ok(details[1].includes('data-i18n="cust_search_help"'), 'first help sentence kept verbatim');
  assert.ok(details[1].includes('data-i18n="cust_search_field_help"'), 'second help sentence kept verbatim');
  assert.match(html, /aria-describedby="customerListSearchHelp"/, 'input still describes itself by the help');
  // 20px is a THIRD named F4 exception (the base .help-icon stays 40x40;
  // the 28px analytics + Saad exceptions are untouched). The F4 test
  // must be extended by name for this scoped rule.
  const scoped = /\.customer-list-search[^{]*\.help-icon\s*\{([^}]*)\}/.exec(stripComments(styles))?.[1]
    || /\.search-help[^{]*\.help-icon\s*\{([^}]*)\}/.exec(stripComments(styles))?.[1];
  assert.ok(scoped, 'scoped 20px search-help .help-icon rule exists');
  const sizes = [...scoped.matchAll(/(?:min-height|height|min-width|width)\s*:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 0 && sizes.every((v) => v === 20), `scoped search (i) is exactly 20px, got ${sizes}`);
  const base = /\.help-icon\{([^}]*)\}/.exec(stripComments(styles))?.[1];
  assert.ok(base && [...base.matchAll(/(?:min-height|height|min-width|width)\s*:\s*([\d.]+)px/g)]
    .every((m) => Number(m[1]) >= 40), 'base .help-icon still 40x40');
});

// ---- C6: toolbar is one 2-column row, no VIEW label ------------------
test('C6: Compact + Filters sit side-by-side in one 2-column row, no VIEW', () => {
  const rule = baseRule(uiFeedbackCss, '.cust-list-toolbar');
  assert.equal(decl(rule, 'display'), 'grid');
  assert.equal(decl(rule, 'grid-template-columns'), '1fr 1fr');
  assert.equal(decl(rule, 'gap'), '8px');
  // The VIEW eyebrow is gone: setupCustomerSection no longer creates it
  // (and no longer re-applies its label on language change).
  assert.doesNotMatch(uiFeedbackJs, /eyebrow\.className = 'eyebrow cust-toolbar-eyebrow'/,
    'no VIEW eyebrow creation in setupCustomerSection');
  assert.doesNotMatch(uiFeedbackJs, /querySelector\('\.cust-toolbar-eyebrow'\)/,
    'no VIEW eyebrow re-apply on language change');
  // Both buttons still land in the bar: the runtime jump (screen-router)
  // and the density toggle (setupCustomerSection).
  assert.ok(uiFeedbackJs.includes("bar.appendChild(jump)"), 'jump button still moves into the bar');
  assert.ok(uiFeedbackJs.includes('bar.appendChild(toggle)'), 'density toggle still lands in the bar');
});

// ---- C7: 'Bulk tools ▾' appears exactly once -------------------------
test('C7: the bulk header reads "Bulk tools" once, no BULK TOOLS eyebrow', () => {
  const summary = bulkSummaryHtml();
  assert.doesNotMatch(summary, /BULK TOOLS/, 'no BULK TOOLS eyebrow in the summary');
  assert.equal((summary.match(/Bulk tools/g) || []).length, 1, '"Bulk tools" appears exactly once');
  // The chevron still comes from the ::after rule (Plan 492 precedent).
  assert.match(baseRule(uiFeedbackCss, '.cust-bulk-tools-summary::after'), /content:\s*'▾'/);
  // All five tools are still inside the disclosure.
  const details = html.match(/<details class="cust-bulk-tools">([\s\S]*?)<\/details>/);
  assert.ok(details, 'BULK TOOLS disclosure still exists');
  for (const id of ['openEnrollmentWizardBtn', 'bulkImportOpenBtn', 'rosterImportOpenBtn', 'bulkSetupOpenBtn', 'speedEntryOpenBtn']) {
    assert.ok(details[1].includes(`id="${id}"`), `disclosure still holds ${id}`);
  }
});

// ---- S1: input identity untouched -------------------------------------
test('S1: search input keeps its id + type', () => {
  assert.match(html, /id="customerListSearch"[^>]*type="search"/);
});

// ---- S2: search wiring anchors intact ---------------------------------
test('S2: list query + field wiring anchors intact', () => {
  assert.ok(app.includes("function customerListQuery() { return $('#customerListSearch').value.trim() || searchQuery(); }"),
    'customerListQuery unchanged');
  assert.ok(app.includes("let customerSearchField = UNIFIED_IDENTIFIER_FIELD_ID"), 'field defaults to unified');
  assert.ok(app.includes("$('#customerSearchField')?.addEventListener('change',"), 'field change binding intact');
  assert.ok(app.includes('filterCustomersByUnifiedIdentifier'), 'unified filter still applied');
});

// ---- S3: EN/UR dict sizes equal (value change only, no new key) ------
test('S3: EN/UR dict sizes equal', async () => {
  const { TRANSLATIONS } = await import('../nav-language.js');
  assert.equal(Object.keys(TRANSLATIONS.en).length, Object.keys(TRANSLATIONS.ur).length,
    'no key added or removed');
});

// ---- S4: density toggle still toggles + persists ----------------------
test('S4: density toggle still toggles and persists', () => {
  assert.ok(uiFeedbackJs.includes('DENSITY_KEY'), 'density key present');
  assert.ok(uiFeedbackJs.includes("localStorage.getItem(DENSITY_KEY)"), 'density restores from storage');
  assert.ok(uiFeedbackJs.includes("localStorage.setItem(DENSITY_KEY, density)"), 'density persists');
  assert.ok(uiFeedbackJs.includes("list.classList.toggle('cust-compact', compact)"), 'compact class still toggles');
});

// ---- B1: no new hex in the touched rules ------------------------------
// 608 → 610 with the Customers List Cards polish (D2): exactly the two
// spec-literal name colours #1E3A5F (navy) + #9f1239 (rose-800).
test('B1: styles.css hex count is 610 (608 + the two Customers List Cards spec literals, no other new hex)', () => {
  assert.equal(hexCount(styles), 610, 'styles.css stays at 610 distinct hex');
});

// ---- B2: filter panel keeps its controls ------------------------------
test('B2: filter panel keeps month / area / sort / view controls', () => {
  const panel = filterPanelHtml();
  for (const id of ['customerFilterMonth', 'customerFilterArea', 'customerSortSelect', 'customerViewCardsBtn', 'customerViewTableBtn', 'exportCustomerRosterCsvBtn']) {
    assert.ok(panel.includes(`id="${id}"`), `panel still holds ${id}`);
  }
});
