// Sharafat 84 — page size "all" caps the rendered roster at 100 rows,
// with a Show More (+100 per click) for the rest, per panel.
//
// The bug: with page size 'all', one renderCustomers() built the whole
// roster (250 card markups or 250 <tr> rows, one click listener per row)
// in a single .map pass — and the archived panel did the same. The fix
// caps at the RENDER layer only: `paginateRows` and `archivedRosterPage`
// keep their 'all'-means-everything contract (the forms-qa and Plan Y
// pins survive verbatim), and the two .map passes run over
// `paged.items.slice(0, customerRosterShown)` /
// `archivedPaged.items.slice(0, archivedRosterShown)` — only when the
// page size is 'all'. Numeric sizes (15/30/60) keep their exact paging.
//
// Method (Sharafat 81's pattern): the REAL slice statements and the REAL
// Show More / page-size handlers are extracted from app.js source and
// evaluated in a harness driving the REAL `paginateRows` /
// `archivedRosterPage` helpers. Fixtures are generic placeholders
// ("Customer 001"…); no phone numbers anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { paginateRows } from '../form-validation.js';
import { archivedRosterPage } from '../roster-scale.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const CAP = 100;
const TOTAL = 250;

// Generic fixture: N active customers, no phones, placeholder names.
function fixture(n, archived = false) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i + 1).padStart(3, '0')}`,
    customerNumber: i + 1,
    name: `Customer ${String(i + 1).padStart(3, '0')}`,
    mohalla: 'Charyaa',
    packageSpeed: '15 Mbps',
    serviceStatus: 'active',
    monthlySellingAmount: 3000,
    archived,
    bills: [{ month: '2026-11', dueAmount: 3000, payments: [{ id: `p${i + 1}`, amount: 3000 }] }],
  }));
}

// ---------- extraction helpers (Sharafat 81's, verbatim shape) ----------

// Scan a statement starting at `start`, tracking paren/brace/bracket
// depth and string/comment state, and return up to the terminating `;`.
function extractStatement(source, start) {
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1] ?? '';
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depthParen += 1;
    else if (ch === ')') depthParen -= 1;
    else if (ch === '{') depthBrace += 1;
    else if (ch === '}') depthBrace -= 1;
    else if (ch === '[') depthBracket += 1;
    else if (ch === ']') depthBracket -= 1;
    else if (
      ch === ';' &&
      depthParen === 0 &&
      depthBrace === 0 &&
      depthBracket === 0
    ) {
      return source.slice(start, i + 1);
    }
  }
  throw new Error('statement has no terminator');
}

// Brace-match a `function name(...) { ... }` definition.
function extractFunctionDef(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return null;
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`function ${name} has no closing brace`);
}

// ---------- the REAL render-layer slice statements ----------

const shownActiveStmt = extractStatement(app, app.indexOf('const shownActive = '));
const shownArchivedStmt = extractStatement(app, app.indexOf('const shownArchived = '));
assert.ok(shownActiveStmt.includes('.slice(0, customerRosterShown)'), 'active slice statement must slice by the shown count');
assert.ok(shownArchivedStmt.includes('.slice(0, archivedRosterShown)'), 'archived slice statement must slice by the shown count');

// Evaluate the REAL slice statement: `paged` is the paginateRows result,
// `customerPageSize` the select value, `customerRosterShown` the cap state.
const activeSlice = new Function(
  'paged', 'customerPageSize', 'customerRosterShown',
  `${shownActiveStmt}\nreturn shownActive;`,
);
const archivedSlice = new Function(
  'archivedPaged', 'customerPageSize', 'archivedRosterShown',
  `${shownArchivedStmt}\nreturn shownArchived;`,
);

// The Show More button's hidden state derives from shown >= total on
// every render, never from a stored flag (R4) — the render's own
// expression, evaluated here against the sliced rows.
function showMoreHidden(pageSize, shownCount, total) {
  return !(pageSize === 'all' && shownCount < total);
}

// ---------- the REAL Show More handlers ----------

function makeShowMoreHarness() {
  const els = {};
  const $ = (selector) => {
    if (!els[selector]) {
      els[selector] = {
        handlers: {},
        addEventListener(type, fn) { this.handlers[type] = fn; },
      };
    }
    return els[selector];
  };
  let renders = 0;
  const activeStmt = extractStatement(app, app.indexOf("$('#customerRosterShowMore')?.addEventListener('click',"));
  const archivedStmt = extractStatement(app, app.indexOf("$('#archivedRosterShowMore')?.addEventListener('click',"));
  const wire = new Function(
    '$', 'renderCustomers', 'els',
    `let customerRosterShown = ${CAP};\nlet archivedRosterShown = ${CAP};\n${activeStmt}\n${archivedStmt}\nreturn {\n  get shown() { return customerRosterShown; },\n  get archivedShown() { return archivedRosterShown; },\n  clickActive() { els['#customerRosterShowMore'].handlers.click(); },\n  clickArchived() { els['#archivedRosterShowMore'].handlers.click(); },\n};`,
  );
  const exposed = wire($, () => { renders += 1; }, els);
  // NOTE: do NOT spread `exposed` — spreading invokes its getters once
  // and freezes `shown` / `state` at the initial values. Attach the
  // renders counter as a live getter and return the object as-is.
  Object.defineProperty(exposed, 'renders', { get() { return renders; } });
  return exposed;
}

// ---------- the REAL page-size change handler ----------

function makePageSizeHarness() {
  const els = {};
  const $ = (selector) => {
    if (!els[selector]) {
      els[selector] = {
        value: 'all',
        handlers: {},
        addEventListener(type, fn) { this.handlers[type] = fn; },
      };
    }
    return els[selector];
  };
  let renders = 0;
  const stmt = extractStatement(app, app.indexOf("$('#customerPageSize')?.addEventListener('change',"));
  const wire = new Function(
    '$', 'renderCustomers', 'els',
    `let customerPageSize = 'all';\nlet customerCurrentPage = 3;\nlet archivedCurrentPage = 2;\nlet customerRosterShown = 200;\nlet archivedRosterShown = 200;\n${stmt}\nreturn {\n  fire(value) { els['#customerPageSize'].handlers.change({ currentTarget: { value } }); },\n  get state() { return { customerPageSize, customerCurrentPage, archivedCurrentPage, customerRosterShown, archivedRosterShown }; },\n};`,
  );
  const exposed = wire($, () => { renders += 1; }, els);
  // NOTE: do NOT spread `exposed` — spreading invokes its getters once
  // and freezes `state` at the initial values. Attach the renders
  // counter as a live getter and return the object as-is.
  Object.defineProperty(exposed, 'renders', { get() { return renders; } });
  return exposed;
}

// ---------- behaviour: the cap ----------

test('Sharafat 84: all + 250 customers renders exactly 100 rows initially', () => {
  const roster = fixture(TOTAL);
  const paged = paginateRows(roster, 1, 'all');
  assert.equal(paged.items.length, TOTAL, 'the helper still hands the render everything (its contract is untouched)');
  const shown = activeSlice(paged, 'all', CAP);
  assert.equal(shown.length, 100);
  assert.deepEqual(shown.map((c) => c.id), roster.slice(0, 100).map((c) => c.id), 'the first 100, in order');
});

test('Sharafat 84: all + 250 archived customers renders exactly 100 archived rows initially', () => {
  const archived = fixture(TOTAL, true);
  const paged = archivedRosterPage(archived, 1, 'all');
  assert.equal(paged.items.length, TOTAL, 'the archived helper still hands the render everything');
  const shown = archivedSlice(paged, 'all', CAP);
  assert.equal(shown.length, 100);
  assert.deepEqual(shown.map((c) => c.id), archived.slice(0, 100).map((c) => c.id), 'the first 100, in order');
});

test('Sharafat 84: Show More adds 100 per click — 100, 200, 250 — then hides', () => {
  const roster = fixture(TOTAL);
  const harness = makeShowMoreHarness();
  assert.equal(harness.shown, 100);
  assert.equal(showMoreHidden('all', harness.shown, TOTAL), false, 'button visible at 100 of 250');
  harness.clickActive();
  assert.equal(harness.shown, 200);
  assert.equal(harness.renders, 1, 'each click re-renders once');
  let shown = activeSlice(paginateRows(roster, 1, 'all'), 'all', harness.shown);
  assert.equal(shown.length, 200);
  harness.clickActive();
  assert.equal(harness.shown, 300, 'second click adds another 100 — the state is unclamped; the SLICE clamps the rendered rows to the 250-row roster');
  shown = activeSlice(paginateRows(roster, 1, 'all'), 'all', harness.shown);
  assert.equal(shown.length, 250, 'the slice clamps to the 250-row roster');
  assert.equal(showMoreHidden('all', shown.length, TOTAL), true, 'button hides once shown reaches the total');
  assert.equal(harness.renders, 2);
});

test('Sharafat 84: archived Show More is independent of the active one (R9)', () => {
  const harness = makeShowMoreHarness();
  harness.clickArchived();
  harness.clickArchived();
  assert.equal(harness.archivedShown, 300, 'two archived clicks add 100 each (the slice clamps the rendered rows)');
  assert.equal(harness.shown, 100, 'opening archived Show More never moves the active shown count');
  harness.clickActive();
  assert.equal(harness.shown, 200);
  assert.equal(harness.archivedShown, 300, 'the active click never moves the archived shown count');
});

test('Sharafat 84: all with 40 customers renders all 40, no Show More button', () => {
  const roster = fixture(40);
  const shown = activeSlice(paginateRows(roster, 1, 'all'), 'all', CAP);
  assert.equal(shown.length, 40);
  assert.equal(showMoreHidden('all', shown.length, 40), true, 'button hidden when the roster is under the cap');
  const archived = fixture(40, true);
  const shownArchived = archivedSlice(archivedRosterPage(archived, 1, 'all'), 'all', CAP);
  assert.equal(shownArchived.length, 40);
  assert.equal(showMoreHidden('all', shownArchived.length, 40), true);
});

test('Sharafat 84: filtered all with 5 matches renders 5, no Show More button (G1)', () => {
  const matches = fixture(5);
  const shown = activeSlice(paginateRows(matches, 1, 'all'), 'all', CAP);
  assert.equal(shown.length, 5);
  assert.equal(showMoreHidden('all', shown.length, 5), true);
});

test('Sharafat 84: numeric page sizes keep their exact paging (R7)', () => {
  const roster = fixture(TOTAL);
  const page15 = paginateRows(roster, 1, 15);
  assert.equal(page15.items.length, 15);
  assert.equal(page15.totalPages, 17);
  // The slice statement passes numeric pages through untouched — it
  // never re-pages the 60-size view at 100.
  assert.deepEqual(activeSlice(page15, 15, CAP), page15.items);
  const page60 = paginateRows(roster, 1, 60);
  assert.equal(page60.items.length, 60);
  assert.equal(page60.totalPages, 5);
  assert.deepEqual(activeSlice(page60, 60, CAP), page60.items);
  const archivedPage15 = archivedRosterPage(fixture(TOTAL, true), 1, 15);
  assert.deepEqual(archivedSlice(archivedPage15, 15, CAP), archivedPage15.items);
});

test('Sharafat 84: capped rows are identical to the first 100 of the uncapped pass, same order', () => {
  const roster = fixture(TOTAL);
  const uncapped = paginateRows(roster, 1, 'all').items;
  const capped = activeSlice(paginateRows(roster, 1, 'all'), 'all', CAP);
  assert.deepEqual(capped, uncapped.slice(0, CAP));
  const archived = fixture(TOTAL, true);
  const uncappedArchived = archivedRosterPage(archived, 1, 'all').items;
  const cappedArchived = archivedSlice(archivedRosterPage(archived, 1, 'all'), 'all', CAP);
  assert.deepEqual(cappedArchived, uncappedArchived.slice(0, CAP));
});

// ---------- the shown line + the badge ----------

test('Sharafat 84: shown line reads "Showing 100 of 250 customers." (D5)', () => {
  assert.equal(
    t('cust_roster_showing', 'en', { shown: 100, total: 250 }),
    'Showing 100 of 250 customers.',
  );
  assert.equal(
    t('cust_roster_showing', 'ur', { shown: 100, total: 250 }),
    '{total} میں سے {shown} گاہک دکھائے جا رہے ہیں۔'.replace('{total}', '250').replace('{shown}', '100'),
  );
  assert.ok(TRANSLATIONS.en.cust_roster_showing.includes('{shown}'), 'EN key carries a {shown} param');
  assert.ok(TRANSLATIONS.en.cust_roster_showing.includes('{total}'), 'EN key carries a {total} param');
  assert.ok(TRANSLATIONS.ur.cust_roster_showing.includes('{shown}'), 'UR key carries a {shown} param');
  assert.ok(TRANSLATIONS.ur.cust_roster_showing.includes('{total}'), 'UR key carries a {total} param');
});

test('Sharafat 84: Show More button label exists in EN and UR', () => {
  assert.equal(TRANSLATIONS.en.cust_roster_show_more, 'Show More (100 per page)');
  assert.equal(TRANSLATIONS.ur.cust_roster_show_more, 'مزید دکھائیں (100 فی صفحہ)');
  assert.equal(t('cust_roster_show_more', 'en'), 'Show More (100 per page)');
});

test('Sharafat 84: count badge still reads the full roster total, never the paged slice (C1)', () => {
  assert.match(app, /#customerCount'\)\.textContent = [^;]*activeTotal/, 'badge line reads activeTotal');
  assert.doesNotMatch(app, /#customerCount'\)\.textContent = [^;]*paged\.items\.length/, 'badge never reads the paged slice length');
  assert.doesNotMatch(app, /#customerCount'\)\.textContent = [^;]*shownActive\.length/, 'badge never reads the shown slice length');
});

test('Sharafat 84: page info still reads the full filtered total (the shown line carries the cap)', () => {
  assert.match(
    app,
    /pageInfo\.textContent = t\('cust_page_info', null, \{ page: paged\.page, totalPages: paged\.totalPages, total: active\.length \}\)/,
    'active page info total is the full filtered count',
  );
  assert.match(
    app,
    /archivedPageInfo\.textContent = t\('cust_page_info', null, \{ page: archivedPaged\.page, totalPages: archivedPaged\.totalPages, total: archived\.length \}\)/,
    'archived page info total is the full archived count',
  );
});

// ---------- helpers untouched ----------

test('Sharafat 84: paginateRows "all" still returns everything (forms-qa pin survives)', () => {
  const all = paginateRows([1, 2, 3, 4, 5, 6, 7], 1, 'all');
  assert.equal(all.items.length, 7);
  assert.equal(all.totalPages, 1);
});

test('Sharafat 84: archivedRosterPage still agrees with paginateRows on the same inputs (Plan Y pin survives)', () => {
  const list = fixture(40);
  const a = paginateRows(list, 1, 'all');
  const b = archivedRosterPage(list, 1, 'all');
  assert.deepEqual(b.items, a.items);
  assert.equal(b.totalPages, a.totalPages);
  const c = paginateRows(list, 2, 15);
  const d = archivedRosterPage(list, 2, 15);
  assert.deepEqual(d.items, c.items);
  assert.equal(d.totalPages, c.totalPages);
});

test('Sharafat 84: Prev/Next stay disabled under "all" (R8)', () => {
  const paged = paginateRows(fixture(TOTAL), 1, 'all');
  assert.equal(paged.totalPages, 1, 'one page under all, so Prev/Next are already disabled');
  assert.match(app, /nextBtn\.disabled = paged\.page >= paged\.totalPages;/, 'next disabled at the last page');
  assert.match(app, /prevBtn\.disabled = paged\.page <= 1;/, 'prev disabled on the first page');
});

// ---------- source pins: the cap wiring ----------

test('Sharafat 84: both .map passes run over the capped slices, in both view modes', () => {
  assert.match(app, /tableBody\.innerHTML = shownActive\.map\(customer => renderCustomerTableRowMarkup/, 'active table rows map over the capped slice');
  assert.match(app, /customerList\.innerHTML = shownActive\.map\(customer => customerCardMarkup\(customer, false, healthAllocations\)\)/, 'active cards map over the capped slice');
  assert.match(app, /archivedTableBody\.innerHTML = shownArchived\.map\(customer => renderCustomerTableRowMarkup/, 'archived table rows map over the capped slice');
  assert.match(app, /archivedList\.innerHTML = shownArchived\.map\(customer => customerCardMarkup\(customer, true, healthAllocations\)\)/, 'archived cards map over the capped slice');
});

test('Sharafat 84: shown state starts at 100 per panel, independent (D1/D3)', () => {
  assert.match(app, /let customerRosterShown = 100;/, 'active shown count starts at 100');
  assert.match(app, /let archivedRosterShown = 100;/, 'archived shown count starts at 100');
});

test('Sharafat 84: button hidden state derives from shown >= total on every render (R4)', () => {
  assert.match(
    app,
    /rosterShowMoreBtn\.hidden = !\(customerPageSize === 'all' && shownActive\.length < active\.length\);/,
    'active button hidden state derives from the live counts',
  );
  assert.match(
    app,
    /archivedShowMoreBtn\.hidden = !\(customerPageSize === 'all' && shownArchived\.length < archived\.length\);/,
    'archived button hidden state derives from the live counts',
  );
  assert.match(
    app,
    /rosterShowingEl\.hidden = !\(customerPageSize === 'all' && shownActive\.length < active\.length\);/,
    'active shown line hidden state derives from the live counts',
  );
  assert.match(
    app,
    /archivedShowingEl\.hidden = !\(customerPageSize === 'all' && shownArchived\.length < archived\.length\);/,
    'archived shown line hidden state derives from the live counts',
  );
});

test('Sharafat 84: Show More buttons reuse .secondary-button in the markup (receipt-finder precedent)', () => {
  assert.ok(html.includes('<button id="customerRosterShowMore" class="secondary-button receipt-finder-show-more"'), 'active button reuses the receipt-finder classes');
  assert.ok(html.includes('<button id="archivedRosterShowMore" class="secondary-button receipt-finder-show-more"'), 'archived button reuses the receipt-finder classes');
  assert.ok(html.includes('<span id="customerRosterShowing" class="pagination-page-info" aria-live="polite" hidden></span>'), 'active shown line exists, hidden until capped');
  assert.ok(html.includes('<span id="archivedRosterShowing" class="pagination-page-info" aria-live="polite" hidden></span>'), 'archived shown line exists, hidden until capped');
  assert.ok(html.includes('data-i18n="cust_roster_show_more"'), 'buttons carry the new i18n key');
});

// ---------- reset discipline (D4 / R5) ----------

test('Sharafat 84: page-size change resets both shown counts to 100 (behaviour, REAL handler)', () => {
  const harness = makePageSizeHarness();
  harness.fire('all');
  assert.deepEqual(harness.state, {
    customerPageSize: 'all',
    customerCurrentPage: 1,
    archivedCurrentPage: 1,
    customerRosterShown: 100,
    archivedRosterShown: 100,
  }, 'a stale shown count of 200 restarts at 100 on page-size change');
  assert.equal(harness.renders, 1);
  harness.fire('15');
  assert.equal(harness.state.customerPageSize, 15);
  assert.equal(harness.state.customerRosterShown, 100);
});

test('Sharafat 84: every path that can change the filtered list resets both shown counts (source pins)', () => {
  const sites = [
    ['list search input', "$('#customerListSearch').addEventListener('input',"],
    ['global search input', "$('#globalCustomerSearch').addEventListener('input',"],
    ['clear list search', "$('#clearCustomerListSearch').addEventListener('click',"],
    ['clear global search', "$('#clearGlobalSearch').addEventListener('click',"],
    ['clear global chip', "$('#clearGlobalSearchChip')?.addEventListener('click',"],
    ['search-field change', "$('#customerSearchField')?.addEventListener('change',"],
    ['area change', "$('#customerFilterArea')?.addEventListener('change',"],
    ['sort select change', "$('#customerSortSelect')?.addEventListener('change',"],
    ['table-header sort click', "document.querySelectorAll('[data-sort-cust]')"],
    ['service-filter buttons', "document.querySelectorAll('[data-customer-service-filter]').forEach(button => button.addEventListener('click'"],
    ['billing-filter buttons', "document.querySelectorAll('[data-customer-billing-filter]').forEach(button => button.addEventListener('click'"],
    ['mohalla card click-through', "mohallaCardsEl.querySelectorAll('[data-mohalla-card]')"],
  ];
  for (const [label, anchor] of sites) {
    const at = app.indexOf(anchor);
    assert.notEqual(at, -1, `${label} handler is missing from app.js`);
    const stmt = extractStatement(app, at);
    assert.ok(stmt.includes('customerRosterShown = 100;'), `${label} must reset the active shown count`);
    assert.ok(stmt.includes('archivedRosterShown = 100;'), `${label} must reset the archived shown count`);
  }
  const resetFn = extractFunctionDef(app, 'resetCustomerRosterFilters');
  assert.ok(resetFn, 'resetCustomerRosterFilters must exist');
  assert.ok(resetFn.includes('customerRosterShown = 100;'), 'reset-filters resets the active shown count');
  assert.ok(resetFn.includes('archivedRosterShown = 100;'), 'reset-filters resets the archived shown count');
  const setMonthFn = extractFunctionDef(app, 'setBillingMonth');
  assert.ok(setMonthFn, 'setBillingMonth must exist');
  assert.ok(setMonthFn.includes('customerRosterShown = 100;'), 'month change resets the active shown count');
  assert.ok(setMonthFn.includes('archivedRosterShown = 100;'), 'month change resets the archived shown count');
  const activeResets = (app.match(/customerRosterShown = 100;/g) || []).length;
  const archivedResets = (app.match(/archivedRosterShown = 100;/g) || []).length;
  assert.ok(activeResets >= 16, `at least 16 active reset sites (got ${activeResets})`);
  assert.ok(archivedResets >= 16, `at least 16 archived reset sites (got ${archivedResets})`);
});

test('Sharafat 84: view-mode switch does NOT reset the shown counts (D4)', () => {
  const cardsStmt = extractStatement(app, app.indexOf("$('#customerViewCardsBtn')?.addEventListener('click',"));
  const tableStmt = extractStatement(app, app.indexOf("$('#customerViewTableBtn')?.addEventListener('click',"));
  assert.ok(!cardsStmt.includes('customerRosterShown'), 'cards-mode switch keeps the shown count');
  assert.ok(!cardsStmt.includes('archivedRosterShown'), 'cards-mode switch keeps the archived shown count');
  assert.ok(!tableStmt.includes('customerRosterShown'), 'table-mode switch keeps the shown count');
  assert.ok(!tableStmt.includes('archivedRosterShown'), 'table-mode switch keeps the archived shown count');
});

// ---------- controls / guards ----------

test('Sharafat 84: card markup still computes per-row health (the cap reduces rows, not per-row work)', () => {
  assert.match(
    app,
    /function customerCardMarkup[\s\S]{0,4000}buildCustomerHealthScore\(state, customer/,
    'health-score call still present in customerCardMarkup',
  );
});

test('Sharafat 84: the "All" select option stays labelled All (D7)', () => {
  assert.ok(html.includes('<option value="all" data-i18n="all">All</option>'), 'All option label unchanged');
});
