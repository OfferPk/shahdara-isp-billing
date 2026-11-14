// Sharafat 31 — Global search silently filters the roster and its Clear
// doesn't clear it.
//
// The roster has TWO query sources: the list box (#customerListSearch) and
// the always-visible global box (#globalCustomerSearch). customerListQuery()
// returns the list-box value OR the global value, so a typed global query
// filters the Customers list while the list box shows empty — and the list
// Clear used to clear only the list box, leaving the roster filtered by
// the invisible global query with no indication why. Parent decision:
// shape (a) — show the active global query as a removable chip on the
// Customers view (shape (b), syncing the value into the list box, is
// rejected: it creates a diverge-on-edit case and still needs the Clear
// fix). The chip shows only when the global query is the roster-effective
// filter (list box blank, global non-empty); Clear also clears the global
// query exactly then.
//
// Tests are source-scan tests in the established pattern
// (plan-f-runtime-performance.test.js `extractFunction`, Sharafat 29/30
// precedents): renderCustomers is unexported inside the app.js bundle
// and there is no jsdom anywhere in the repo, so the chip toggle and the
// Clear gate are asserted over the extracted source. No customer
// fixtures — no numbers here are customer data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const index = read('index.html');
const nav = read('nav-language.js');
const components = read('components.css');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found in app.js`);
  const next = source.indexOf('\nfunction ', start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

const renderCustomers = extractFunction(app, 'renderCustomers');

function listenerSlice(source, id) {
  const start = source.indexOf(`$('#${id}')`);
  assert.ok(start >= 0, `#${id} listener not found in app.js`);
  // A one-line handler ends on its own line; a multi-line handler ends
  // at the first `});` on its own line. Without the one-line branch the
  // slice would run on into the NEXT listener (on the pristine tree the
  // Clear handler is a one-liner, and the slice would swallow the
  // #clearGlobalSearch handler — which itself clears the global box —
  // making the over-fix pin pass vacuously).
  const lineEnd = source.indexOf('\n', start);
  const line = source.slice(start, lineEnd);
  if (line.includes('});')) return line;
  const end = source.indexOf('\n});', start);
  assert.ok(end > start, `#${id} listener has no closing`);
  return source.slice(start, end);
}

function listenerLine(source, id) {
  const line = source.split('\n').find(l => l.includes(`$('#${id}')`));
  assert.ok(line, `#${id} listener not found in app.js`);
  return line;
}

// ---- the chip host ---------------------------------------------------

test('Sharafat 31: chip host exists in the list search block, hidden by default, before the help details', () => {
  const searchBlock = index.indexOf('<div class="customer-list-search">');
  const chip = index.indexOf('id="globalSearchChip"');
  const help = index.indexOf('id="customerListSearchHelp"');
  const pillBar = index.indexOf('id="rosterPillBar"');
  assert.ok(searchBlock >= 0, '.customer-list-search block not found in index.html');
  assert.ok(chip > searchBlock, 'chip host must sit inside .customer-list-search');
  assert.ok(chip < help, 'chip host must sit before the help <details> (polish26 pins that structure)');
  assert.ok(chip < pillBar, 'chip host must NOT live in #rosterPillBar — that bar re-renders its toggle pills');
  const chipLine = index.split('\n').find(l => l.includes('id="globalSearchChip"'));
  assert.ok(chipLine.includes(' hidden'), 'chip host must be hidden by default');
  assert.ok(chipLine.includes('id="globalSearchChipQuery"'), 'chip must carry a query span');
  assert.ok(chipLine.includes('id="clearGlobalSearchChip"'), 'chip must carry a remove button');
  assert.ok(
    chipLine.includes('data-i18n-aria-label="cust_search_clear_global"'),
    'chip remove button must label itself with the new i18n key'
  );
});

// ---- the toggle ------------------------------------------------------

test('Sharafat 31: chip shows only when the list box is blank AND the global query is non-empty', () => {
  // A toggle on global-non-empty alone FAILS the list-box-wins case: with
  // text in the list box the global query is NOT the roster filter.
  const start = renderCustomers.indexOf('const globalSearchChip = ');
  assert.ok(start >= 0, 'chip toggle not found in renderCustomers');
  const toggle = renderCustomers.slice(start, renderCustomers.indexOf('\n  }\n', start));
  assert.ok(
    toggle.includes("$('#customerListSearch').value.trim() === ''"),
    'toggle must require the list box to be blank'
  );
  assert.ok(toggle.includes('searchQuery()'), 'toggle must read the global query');
  assert.ok(
    toggle.includes('globalSearchChip.hidden = !(listQueryBlank && globalQuery !== \'\');'),
    'toggle must hide the chip unless BOTH conditions hold (list blank AND global non-empty)'
  );
});

test('Sharafat 31: chip text is written via textContent, never innerHTML', () => {
  const start = renderCustomers.indexOf('const globalSearchChip = ');
  const toggle = renderCustomers.slice(start, renderCustomers.indexOf('\n  }\n', start));
  assert.ok(
    toggle.includes("$('#globalSearchChipQuery').textContent = globalQuery"),
    'chip query must be written through textContent'
  );
  assert.ok(
    !toggle.includes('innerHTML'),
    'user-typed query text must never go through innerHTML on the chip'
  );
});

// ---- the chip remove -------------------------------------------------

test('Sharafat 31: chip remove clears the global query with the full four-call mirror', () => {
  // Clearing the box alone leaves the global results dropdown open with
  // stale matches and leaves Transactions + the monthly report filtered —
  // the same class of mistake as the original bug. The remove handler
  // must mirror #clearGlobalSearch exactly.
  const remove = listenerLine(app, 'clearGlobalSearchChip');
  assert.ok(
    remove.includes("$('#globalCustomerSearch').value = '';"),
    'chip remove must clear the global box'
  );
  const order = ['renderGlobalSearch();', 'renderCustomers();', 'renderTransactions();', 'renderMonthlyReport();'];
  let at = -1;
  for (const call of order) {
    const i = remove.indexOf(call, at + 1);
    assert.ok(i > at, `chip remove must call ${call} after the previous call`);
    at = i;
  }
  assert.ok(
    remove.includes("$('#customerListSearch').focus();"),
    'chip remove returns focus to the list box, not the global box'
  );
});

// ---- the list Clear gate ----------------------------------------------

test('Sharafat 31: list Clear clears the global query only when it is the active roster filter', () => {
  const clear = listenerSlice(app, 'clearCustomerListSearch');
  assert.ok(
    clear.includes("const globalIsActiveFilter = $('#customerListSearch').value.trim() === '' && searchQuery().trim() !== '';"),
    'Clear must compute the gate BEFORE clearing: list box blank AND global non-empty'
  );
  assert.ok(
    clear.includes('if (globalIsActiveFilter) {'),
    'the global clear must sit inside the gated branch'
  );
  assert.ok(
    clear.includes("$('#globalCustomerSearch').value = '';"),
    'gated branch must clear the global box'
  );
  const order = ['renderGlobalSearch();', 'renderCustomers();', 'renderTransactions();', 'renderMonthlyReport();'];
  let at = clear.indexOf('if (globalIsActiveFilter) {');
  for (const call of order) {
    const i = clear.indexOf(call, at + 1);
    assert.ok(i > at, `gated Clear must call ${call} after the previous call`);
    at = i;
  }
  assert.ok(
    clear.includes("$('#customerListSearch').focus();"),
    'Clear keeps focus on the list box'
  );
});

test('Sharafat 31: Clear never clears the global query unconditionally (the over-fix pin)', () => {
  // An unconditional "Clear always clears global" passes the acceptance
  // but breaks a real workflow: the operator types a global query to
  // filter Transactions / the monthly report, opens Customers, clears
  // the list box — and silently loses the global filter on the other
  // two lists. The global clear must exist exactly once, inside the gate.
  const clear = listenerSlice(app, 'clearCustomerListSearch');
  const hits = clear.split("$('#globalCustomerSearch').value = '';").length - 1;
  assert.equal(hits, 1, 'the global clear must appear exactly once in the Clear handler');
  const gateAt = clear.indexOf('if (globalIsActiveFilter) {');
  const clearAt = clear.indexOf("$('#globalCustomerSearch').value = '';")
  assert.ok(clearAt > gateAt, 'the single global clear must sit inside the gated branch');
});

// ---- the cascade ------------------------------------------------------

test('Sharafat 31: after list-Clear with a global query typed, the roster falls back to the global query (chip visible)', () => {
  // With text in the list box, Clear clears the list box only — the
  // gate is false, so the global query survives, customerListQuery()
  // falls back to it, and the toggle (list blank + global non-empty)
  // shows the chip. Assert the pair, not a live DOM: the gate reads
  // the list box BEFORE clearing it, and the toggle shows the chip
  // exactly when the list box is blank and the global query is non-empty.
  const clear = listenerSlice(app, 'clearCustomerListSearch');
  const gateAt = clear.indexOf('const globalIsActiveFilter');
  const listClearAt = clear.indexOf("$('#customerListSearch').value = '';")
  assert.ok(gateAt >= 0 && gateAt < listClearAt, 'the gate must be computed before the list box is cleared');
  const toggle = renderCustomers.slice(
    renderCustomers.indexOf('const globalSearchChip = '),
    renderCustomers.indexOf('\n  }\n', renderCustomers.indexOf('const globalSearchChip = '))
  );
  assert.ok(
    toggle.includes('globalSearchChip.hidden = !(listQueryBlank && globalQuery !== \'\');'),
    'after the fallback the chip must be visible (list blank, global non-empty)'
  );
});

// ---- the i18n key pair ------------------------------------------------

test('Sharafat 31: cust_search_clear_global exists in both dicts with a genuine Urdu value', () => {
  assert.ok(
    nav.includes("cust_search_clear_global: 'Clear global search'"),
    'EN dict must carry cust_search_clear_global'
  );
  const ur = nav.match(/cust_search_clear_global: '([^']+)'/g);
  assert.ok(ur && ur.length >= 2, 'UR dict must carry cust_search_clear_global too');
  const urValue = nav.split("cust_search_clear_global: '")[2].split("'")[0];
  assert.match(urValue, /[\u0600-\u06FF]/, 'UR value must be genuine Urdu script (phase-1 parity pin)');
});

// ---- what must NOT change ---------------------------------------------

test('Sharafat 31: customerListQuery() stays byte-identical (deployment pin :118)', () => {
  assert.ok(
    app.includes("function customerListQuery() { return $('#customerListSearch').value.trim() || searchQuery(); }"),
    'shape (a) needs no change to the one-liner — any edit here forces a why-comment update at deployment.test.js:118'
  );
});

test('Sharafat 31: chip CSS reuses tokens, adds zero new hex', () => {
  const start = components.indexOf('.global-search-chip {');
  assert.ok(start >= 0, 'chip CSS not found in components.css');
  const rules = components.slice(start, components.indexOf('.global-search-chip-remove:focus-visible', start) + 100);
  assert.ok(rules.includes('var(--line)'), 'chip must reuse the roster-pill border token');
  assert.ok(rules.includes('var(--radius-pill)'), 'chip must reuse the pill radius token');
  assert.ok(rules.includes('var(--surface)'), 'chip must reuse the surface token');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(rules), 'chip CSS must add zero new hex (design-tokens ratchet)');
});
