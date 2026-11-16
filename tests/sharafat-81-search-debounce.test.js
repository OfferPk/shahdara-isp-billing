// Sharafat 81 — the global + list search boxes debounce (trailing
// edge, 150 ms) and skip re-renders when the normalised query did
// not change.
//
// The live failure was 8 full-ledger allocation passes per global
// keystroke (10 keystrokes = 80 passes). The fix is two debounced
// wirings + an unchanged-query guard, with every direct path that
// renders (Clear, reset, mohalla card, stored-filter restore,
// field change, transaction-filters Clear, add-customer submit)
// updating the stored last-rendered query, so clear-then-retype is
// never wrongly skipped (R5).
//
// Method (the repro's template: Sharafat 78's handler extraction +
// Sharafat 31's listenerSlice): the REAL wiring statements are
// extracted from app.js source and evaluated in a harness with a
// manual fake timer clock, fake inputs, and counting render stubs.
// The guard runs at KEYSTROKE time — when the normalised query is
// already the last-rendered one, the handler returns WITHOUT
// clearing a pending timer, so a burst that ends back on an
// already-rendered query still fires once for the query the timer
// was armed for (the repro's G1 case pins this shape); the timer
// callback reads the CURRENT query at fire time and records it
// before rendering.
//
// The direct paths that CHANGE THE FIELD (field-change handler,
// mohalla-card setter, stored-filter restore) INVALIDATE the stored
// list query (null) instead of recording it: the field is part of
// what the roster shows, so the stored query alone no longer
// describes the rendered state, and the next same-text keystroke
// re-renders once. Paths that change only the query record the new
// effective query. The guard key is the query alone — it cannot
// include the field, because the harness that extracts these
// wirings has no customerSearchField in scope (the prep's
// alternative, record-at-every-direct-render, is used everywhere
// else).
//
// Fixtures are generic: the query strings are 'ahmedshah1' (the
// prep's generic fixture) and single-word placeholders; the mohalla
// value is 'Charyaa' (an area name, not a customer); no phone
// numbers anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { searchCustomers } from '../core.js';

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const lines = app.split('\n');

// ---------- extraction helpers (the repro's, verbatim shape) ----------

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

const listAnchor = "$('#customerListSearch').addEventListener('input',";
const globalAnchor = "$('#globalCustomerSearch').addEventListener('input',";
const clearGlobalAnchor = "$('#clearGlobalSearch').addEventListener('click',";
const clearListAnchor = "$('#clearCustomerListSearch').addEventListener('click',";
const fieldChangeAnchor = "$('#customerSearchField')?.addEventListener('change',";
const mohallaAnchor = "mohallaCardsEl.querySelectorAll('[data-mohalla-card]')";
const storedRestoreAnchor = 'customersBtn.onclick = () => {';
const listStart = app.indexOf(listAnchor);
const globalStart = app.indexOf(globalAnchor);
const clearGlobalStart = app.indexOf(clearGlobalAnchor);
const clearListStart = app.indexOf(clearListAnchor);
const fieldChangeStart = app.indexOf(fieldChangeAnchor);
const mohallaStart = app.indexOf(mohallaAnchor);
const storedRestoreStart = app.indexOf(storedRestoreAnchor);
for (const [name, at] of [
  ['list listener', listStart],
  ['global listener', globalStart],
  ['clear-global handler', clearGlobalStart],
  ['clear-list handler', clearListStart],
  ['field-change handler', fieldChangeStart],
  ['mohalla setter', mohallaStart],
  ['stored-filter restore', storedRestoreStart],
]) {
  assert.notEqual(at, -1, `${name} is missing from app.js`);
}
const listStmt = extractStatement(app, listStart);
const globalStmt = extractStatement(app, globalStart);
const clearGlobalStmt = extractStatement(app, clearGlobalStart);
const clearListStmt = extractStatement(app, clearListStart);
const fieldChangeStmt = extractStatement(app, fieldChangeStart);
const mohallaStmt = extractStatement(app, mohallaStart);
const storedRestoreStmt = extractStatement(app, storedRestoreStart);
const resetFn = extractFunctionDef(app, 'resetCustomerRosterFilters');
assert.ok(resetFn, 'resetCustomerRosterFilters must exist in app.js');

// Prelude: module-scope `let` state declared in the wiring region
// (200 lines before the list listener through the global listener).
const windowStartLine = Math.max(
  0,
  lines.findIndex((l) => l.includes(listAnchor)) - 200,
);
const windowEndLine = lines.findIndex((l) => l.includes(globalAnchor));
const windowSrc = lines.slice(windowStartLine, windowEndLine + 1).join('\n');
const preludeLets = [...windowSrc.matchAll(/^let ([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/gm)]
  .map((m) => `let ${m[1]} = ${m[2]};`)
  .join('\n');
// On the fixed code the prelude carries the four `let`s. On base
// (negative probe) it is empty — fall back to the same declarations
// so the harness still evaluates and the behaviour tests can run
// (they fail on their counts instead of at load time); the source
// pins below assert the lets really exist in app.js.
const prelude = preludeLets || `let listSearchDebounceTimer = null;
let lastRenderedListQuery = null;
let globalSearchDebounceTimer = null;
let lastRenderedGlobalQuery = null;`;

// ---------- fake clock + fake DOM + render counters ----------

let now = 0;
let nextTimerId = 0;
const timers = new Map();
function fakeSetTimeout(fn, ms) {
  const id = ++nextTimerId;
  timers.set(id, { fn, due: now + (ms ?? 0) });
  return id;
}
function fakeClearTimeout(id) {
  timers.delete(id);
}
function advance(ms) {
  const target = now + ms;
  for (;;) {
    let earliest = null;
    for (const [id, t] of timers) {
      if (t.due <= target && (earliest === null || t.due < earliest[1].due)) {
        earliest = [id, t];
      }
    }
    if (!earliest) break;
    now = earliest[1].due;
    timers.delete(earliest[0]);
    earliest[1].fn();
  }
  now = target;
}

const counts = {
  renderGlobalSearch: 0,
  renderCustomers: 0,
  renderTransactions: 0,
  renderMonthlyReport: 0,
  switchView: 0,
};
function makeInput(initialValue) {
  return {
    value: initialValue,
    handlers: {},
    addEventListener(type, fn) {
      this.handlers[type] = fn;
    },
    focus() {},
  };
}
const globalInput = makeInput('');
const listInput = makeInput('');
const clearGlobalBtn = makeInput('');
const clearListBtn = makeInput('');
const fieldInput = makeInput('name');
const areaInput = makeInput('all');
const mohallaButton = {
  dataset: { mohallaCard: 'Charyaa' },
  handlers: {},
  addEventListener(type, fn) {
    this.handlers[type] = fn;
  },
};
function $(selector) {
  if (selector === '#globalCustomerSearch') return globalInput;
  if (selector === '#customerListSearch') return listInput;
  if (selector === '#clearGlobalSearch') return clearGlobalBtn;
  if (selector === '#clearCustomerListSearch') return clearListBtn;
  if (selector === '#customerSearchField') return fieldInput;
  if (selector === '#customerFilterArea') return areaInput;
  return null;
}
function searchQuery() {
  return globalInput.value;
}
function customerListQuery() {
  return listInput.value.trim() || searchQuery();
}

// Evaluate the REAL statements in the harness scope. The returned
// object exposes what the tests drive directly (reset + the mohalla
// / stored-restore handlers + the stored state, for assertions).
const wire = new Function(
  '$',
  'renderGlobalSearch',
  'renderCustomers',
  'renderTransactions',
  'renderMonthlyReport',
  'searchQuery',
  'customerListQuery',
  'setTimeout',
  'clearTimeout',
  'switchView',
  'mohallaButton',
  `${prelude}
let customerSearchField = 'name';
let customerAreaFilter = 'all';
let customerRosterPill = 'all';
let selectedServiceFilter = 'all';
let selectedBillingFilter = 'all';
let customerCurrentPage = 1;
const UNIFIED_IDENTIFIER_FIELD_ID = 'any';
const stored = 'Charyaa';
const dialog = { open: true, close() {}, showModal() {} };
const customersBtn = {};
const mohallaCardsEl = { querySelectorAll: () => [mohallaButton] };
function normalizeCustomerSearchField(v) { return v; }
${resetFn}
${listStmt}
${globalStmt}
${clearGlobalStmt}
${clearListStmt}
${fieldChangeStmt}
${mohallaStmt}
${storedRestoreStmt}
return {
  resetCustomerRosterFilters,
  customersBtn,
  getLastRendered: () => [lastRenderedListQuery, lastRenderedGlobalQuery],
  getField: () => customerSearchField,
};`,
);
const exposed = wire(
  $,
  () => {
    counts.renderGlobalSearch += 1;
  },
  () => {
    counts.renderCustomers += 1;
  },
  () => {
    counts.renderTransactions += 1;
  },
  () => {
    counts.renderMonthlyReport += 1;
  },
  searchQuery,
  customerListQuery,
  fakeSetTimeout,
  fakeClearTimeout,
  () => {
    counts.switchView += 1;
  },
  mohallaButton,
);
const globalHandler = globalInput.handlers.input;
const listHandler = listInput.handlers.input;
const clearGlobalHandler = clearGlobalBtn.handlers.click;
const clearListHandler = clearListBtn.handlers.click;
const fieldChangeHandler = fieldInput.handlers.change;
const mohallaClickHandler = mohallaButton.handlers.click;
const storedRestoreHandler = exposed.customersBtn.onclick;
for (const [name, fn] of [
  ['global input handler', globalHandler],
  ['list input handler', listHandler],
  ['clear-global handler', clearGlobalHandler],
  ['clear-list handler', clearListHandler],
  ['field-change handler', fieldChangeHandler],
  ['mohalla click handler', mohallaClickHandler],
  ['stored-restore handler', storedRestoreHandler],
]) {
  assert.equal(typeof fn, 'function', `${name} was not recorded by the fake $`);
}

function typeInto(box, handler, text) {
  // One keystroke at a time, 30 ms apart — faster than the debounce.
  for (const ch of text) {
    box.value += ch;
    handler();
    advance(30);
  }
}
function resetCounts() {
  counts.renderGlobalSearch = 0;
  counts.renderCustomers = 0;
  counts.renderTransactions = 0;
  counts.renderMonthlyReport = 0;
  counts.switchView = 0;
}
// Drive the harness to a known state: clear both boxes through the
// real clear handlers (which also reset the stored state), so each
// test starts from the empty query.
function clearBoth() {
  globalInput.value = '';
  listInput.value = '';
  clearGlobalHandler();
  advance(10);
  resetCounts();
}

// ---------- F: behaviour (fake-clock harness) ----------

test('Sharafat 81: 10 global keystrokes trigger exactly 1 full render pass', () => {
  clearBoth();
  globalInput.value = '';
  typeInto(globalInput, globalHandler, 'ahmedshah1');
  advance(500);
  assert.equal(counts.renderGlobalSearch, 1);
  assert.equal(counts.renderCustomers, 1);
  assert.equal(counts.renderTransactions, 1);
  assert.equal(counts.renderMonthlyReport, 1);
});

test('Sharafat 81: 10 list keystrokes trigger exactly 1 renderCustomers call', () => {
  clearBoth();
  listInput.value = '';
  typeInto(listInput, listHandler, 'ahmedshah1');
  advance(500);
  assert.equal(counts.renderCustomers, 1);
  assert.equal(counts.renderGlobalSearch, 0);
});

test('Sharafat 81: trailing space after a rendered query adds no render pass', () => {
  clearBoth();
  globalInput.value = '';
  typeInto(globalInput, globalHandler, 'ahmed');
  advance(500);
  const afterFirst = counts.renderGlobalSearch;
  assert.equal(afterFirst, 1);
  globalInput.value = 'ahmed ';
  globalHandler();
  advance(500);
  assert.equal(counts.renderGlobalSearch, afterFirst);
});

test('Sharafat 81: burst with a frozen clock fires 0 render passes', () => {
  clearBoth();
  globalInput.value = '';
  for (const ch of 'ahmedshah1') {
    globalInput.value += ch;
    globalHandler();
    // No clock advance at all between keystrokes.
  }
  assert.equal(counts.renderGlobalSearch, 0);
});

test('Sharafat 81: a case-only change after a rendered query adds no render pass', () => {
  clearBoth();
  globalInput.value = '';
  typeInto(globalInput, globalHandler, 'beta');
  advance(500);
  assert.equal(counts.renderGlobalSearch, 1);
  globalInput.value = 'Beta';
  globalHandler();
  advance(500);
  assert.equal(counts.renderGlobalSearch, 1);
});

test('Sharafat 81: a genuinely changed query renders once more', () => {
  clearBoth();
  globalInput.value = '';
  typeInto(globalInput, globalHandler, 'gamma');
  advance(500);
  assert.equal(counts.renderGlobalSearch, 1);
  globalInput.value = 'gammax';
  globalHandler();
  advance(500);
  assert.equal(counts.renderGlobalSearch, 2);
});

test('Sharafat 81: deleting back to an already-rendered query fires once (surviving timer)', () => {
  clearBoth();
  globalInput.value = '';
  typeInto(globalInput, globalHandler, 'delta');
  advance(500);
  assert.equal(counts.renderGlobalSearch, 1);
  // Type one more character, then delete it before the timer fires:
  // the guard returns early on the deletion without clearing the
  // pending timer, so the pass still fires exactly once.
  globalInput.value = 'deltax';
  globalHandler();
  advance(30);
  globalInput.value = 'delta';
  globalHandler();
  advance(500);
  assert.equal(counts.renderGlobalSearch, 2);
});

// ---------- G: guards against the naive fix (R5) ----------

test('Sharafat 81: clear-then-retype re-renders (clear resets the last-rendered query)', () => {
  clearBoth();
  globalInput.value = '';
  typeInto(globalInput, globalHandler, 'epsilon');
  advance(500);
  const rendered = counts.renderGlobalSearch;
  assert.equal(rendered, 1);
  clearGlobalHandler(); // synchronous four-call clear, value -> ''
  const afterClear = counts.renderGlobalSearch;
  assert.equal(afterClear, 2);
  assert.deepEqual(exposed.getLastRendered(), ['', '']);
  globalInput.value = '';
  typeInto(globalInput, globalHandler, 'epsilon');
  advance(500);
  assert.equal(counts.renderGlobalSearch, 3);
});

test('Sharafat 81: clear-list-then-retype re-renders (clear-list resets the stored list query)', () => {
  clearBoth();
  listInput.value = '';
  typeInto(listInput, listHandler, 'zeta');
  advance(500);
  assert.equal(counts.renderCustomers, 1);
  clearListHandler(); // list box -> '', roster re-rendered
  const afterClear = counts.renderCustomers;
  assert.equal(afterClear, 2);
  assert.equal(exposed.getLastRendered()[0], '');
  listInput.value = '';
  typeInto(listInput, listHandler, 'zeta');
  advance(500);
  assert.equal(counts.renderCustomers, 3);
});

test('Sharafat 81: field change with the same query text re-renders once (state invalidated)', () => {
  clearBoth();
  listInput.value = '';
  typeInto(listInput, listHandler, 'eta');
  advance(500);
  assert.equal(counts.renderCustomers, 1);
  fieldChangeHandler({ currentTarget: { value: 'area' } });
  assert.equal(exposed.getField(), 'area');
  assert.equal(counts.renderCustomers, 2);
  assert.equal(exposed.getLastRendered()[0], null);
  // The same text, fired as one input event, re-renders: the field
  // moved, so the stored query alone no longer describes the screen.
  listInput.value = 'eta';
  listHandler();
  advance(500);
  assert.equal(counts.renderCustomers, 3);
  assert.equal(exposed.getLastRendered()[0], 'eta');
  // Back to the original field: the same text renders once more.
  fieldChangeHandler({ currentTarget: { value: 'name' } });
  assert.equal(counts.renderCustomers, 4);
  listInput.value = 'eta';
  listHandler();
  advance(500);
  assert.equal(counts.renderCustomers, 5);
  assert.equal(exposed.getLastRendered()[0], 'eta');
});

test('Sharafat 81: mohalla-card set + direct render, then the same query typed in the list box re-renders', () => {
  clearBoth();
  mohallaClickHandler();
  assert.equal(counts.renderCustomers, 1);
  assert.equal(exposed.getField(), 'area');
  assert.equal(listInput.value, 'Charyaa');
  assert.equal(exposed.getLastRendered()[0], null);
  listInput.value = 'Charyaa';
  listHandler();
  advance(500);
  assert.equal(counts.renderCustomers, 2);
  assert.equal(exposed.getLastRendered()[0], 'charyaa');
});

test('Sharafat 81: stored-filter restore + direct render, then the same query typed re-renders', () => {
  clearBoth();
  storedRestoreHandler();
  assert.equal(counts.renderCustomers, 1);
  assert.equal(exposed.getField(), 'area');
  assert.equal(listInput.value, 'Charyaa');
  assert.equal(exposed.getLastRendered()[0], null);
  listInput.value = 'Charyaa';
  listHandler();
  advance(500);
  assert.equal(counts.renderCustomers, 2);
  assert.equal(exposed.getLastRendered()[0], 'charyaa');
});

test('Sharafat 81: reset + retype of the previous query re-renders', () => {
  clearBoth();
  listInput.value = '';
  typeInto(listInput, listHandler, 'iota');
  advance(500);
  assert.equal(counts.renderCustomers, 1);
  exposed.resetCustomerRosterFilters();
  assert.equal(counts.renderCustomers, 2);
  assert.deepEqual(exposed.getLastRendered(), ['', '']);
  assert.equal(exposed.getField(), 'any');
  listInput.value = '';
  typeInto(listInput, listHandler, 'iota');
  advance(500);
  assert.equal(counts.renderCustomers, 3);
});

test('Sharafat 81: a global render records the effective list query, so the same text in the list box adds no pass', () => {
  clearBoth();
  globalInput.value = '';
  typeInto(globalInput, globalHandler, 'kappa');
  advance(500);
  assert.equal(counts.renderGlobalSearch, 1);
  assert.equal(counts.renderCustomers, 1);
  assert.equal(exposed.getLastRendered()[0], 'kappa');
  // One input event with the identical effective query: the roster
  // already shows it (the global pass rendered it), so no new pass.
  listInput.value = 'kappa';
  listHandler();
  advance(500);
  assert.equal(counts.renderCustomers, 1);
});

test('Sharafat 81: one input event with an already-rendered query adds no pass', () => {
  clearBoth();
  listInput.value = '';
  typeInto(listInput, listHandler, 'lambda');
  advance(500);
  assert.equal(counts.renderCustomers, 1);
  listInput.value = 'lambda';
  listHandler();
  advance(500);
  assert.equal(counts.renderCustomers, 1);
});

// ---------- S: source pins ----------

test('Sharafat 81: both wirings schedule through a timer at 150 ms', () => {
  assert.match(globalStmt, /setTimeout|clearTimeout/);
  assert.match(listStmt, /setTimeout|clearTimeout/);
  const delays = [...`${listStmt}\n${globalStmt}`.matchAll(/,\s*(\d{2,4})\s*\)/g)]
    .map((m) => Number(m[1]));
  assert.ok(delays.includes(150), `no 150 ms delay in the wirings, found ${delays}`);
  assert.ok(delays.every((n) => n >= 150 && n <= 200));
});

test('Sharafat 81: an unchanged-query guard exists (a stored last-rendered query per input)', () => {
  assert.match(preludeLets, /lastRenderedGlobalQuery/);
  assert.match(preludeLets, /lastRenderedListQuery/);
  assert.match(`${preludeLets}\n${listStmt}\n${globalStmt}`, /last\w*[Qq]uery/);
  assert.match(listStmt, /lastRenderedListQuery/);
  assert.match(globalStmt, /lastRenderedGlobalQuery/);
});

test('Sharafat 81: the list listener is wrapped, not the bare renderCustomers reference', () => {
  assert.notEqual(
    listStmt.trim(),
    "$('#customerListSearch').addEventListener('input', renderCustomers);",
  );
});

test('Sharafat 81: the global handler still calls all four renders in order', () => {
  const order = [
    'renderGlobalSearch();',
    'renderCustomers();',
    'renderTransactions();',
    'renderMonthlyReport();',
  ];
  let at = -1;
  for (const call of order) {
    const i = globalStmt.indexOf(call, at + 1);
    assert.ok(i > at, `global handler lost ${call} in order`);
    at = i;
  }
});

test('Sharafat 81: clear buttons still render synchronously (four-call mirror)', () => {
  const order = [
    'renderGlobalSearch();',
    'renderCustomers();',
    'renderTransactions();',
    'renderMonthlyReport();',
  ];
  for (const anchor of ["$('#clearGlobalSearchChip')", "$('#clearGlobalSearch')"]) {
    const line = lines.find((l) => l.includes(anchor));
    assert.ok(line, `${anchor} wiring is missing`);
    let at = -1;
    for (const call of order) {
      const i = line.indexOf(call, at + 1);
      assert.ok(i > at, `${anchor} lost ${call} in order`);
      at = i;
    }
  }
});

test('Sharafat 81: the focus listener still renders on focus when a query is typed', () => {
  assert.ok(app.includes("$('#globalCustomerSearch').addEventListener('focus'"));
});

test('Sharafat 81: every direct path updates the stored state (exact counts)', () => {
  // lastRenderedGlobalQuery = '' — six paths that empty the global
  // box and render: clear-list (global branch), chip, clear-global,
  // reset, transaction-filters Clear, add-customer submit.
  assert.equal((app.match(/lastRenderedGlobalQuery = '';/g) || []).length, 6);
  // lastRenderedListQuery = '' — two paths that empty both boxes and
  // render: clear-list (global branch), reset.
  assert.equal((app.match(/lastRenderedListQuery = '';/g) || []).length, 2);
  // lastRenderedListQuery = null — three paths that move the FIELD
  // with the query: field change, mohalla-card setter, stored-filter
  // restore. The stored query alone no longer describes the screen.
  // (Indented only: the `let ... = null;` declaration is not counted.)
  assert.equal((app.match(/^ +lastRenderedListQuery = null;/gm) || []).length, 3);
  // lastRenderedListQuery = <normalised effective query> — seven
  // paths that render the roster for a query: list callback, global
  // callback, clear-list (list-only branch), chip, clear-global,
  // transaction-filters Clear, add-customer submit.
  assert.equal(
    (app.match(/lastRenderedListQuery = String\(customerListQuery\(\)/g) || []).length,
    7,
  );
  // The global callback records the effective global query once.
  assert.equal(
    (app.match(/lastRenderedGlobalQuery = String\(searchQuery\(\)/g) || []).length,
    1,
  );
  // Each extracted direct path carries its state update in its own text.
  assert.match(clearListStmt, /lastRenderedListQuery/);
  assert.match(fieldChangeStmt, /lastRenderedListQuery = null;/);
  assert.match(resetFn, /lastRenderedGlobalQuery = '';/);
  assert.match(mohallaStmt, /lastRenderedListQuery = null;/);
  assert.match(storedRestoreStmt, /lastRenderedListQuery = null;/);
});

test('Sharafat 81: other search boxes are untouched (still per-keystroke)', () => {
  assert.ok(app.includes("$('#transactionLiveSearch').addEventListener('input'"));
  assert.ok(app.includes("$('#reportCustomerSearch').addEventListener('input'"));
  assert.ok(app.includes("$('#transactionBillMonth').addEventListener('input'") ||
    app.includes("$('#transactionRefineSearch').addEventListener('input'"));
});

// ---------- Guards: results identical, neighbours survive ----------

test('Sharafat 81: searchCustomers still returns the same matches for the same query', () => {
  const state = {
    customers: [
      { id: 'c1', name: 'Test One', bills: [] },
      { id: 'c2', name: 'Test Two', bills: [] },
    ],
  };
  const one = searchCustomers(state, 'test one');
  assert.equal(one.length, 1);
  assert.equal(one[0].id, 'c1');
  assert.deepEqual(searchCustomers(state, 'zzz-no-match'), []);
  // The normaliser the guard copies: case + trailing space do not
  // change what the search itself matches.
  assert.equal(searchCustomers(state, 'Test One ').length, 1);
  assert.equal(searchCustomers(state, 'TEST ONE').length, 1);
});

test('Sharafat 81: renderGlobalSearch still calls buildGlobalLedgerSearch; renderCustomers still calls calculatePaymentAllocations', () => {
  assert.ok(app.includes('buildGlobalLedgerSearch(state, query, selectedBillingMonth)'));
  assert.ok(app.includes('const healthAllocations = calculatePaymentAllocations(state);'));
});
