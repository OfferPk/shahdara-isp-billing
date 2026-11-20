// Plan 585 — global search is a working keyboard combobox, in both
// languages.
//
// The global input was a combobox in markup only: role="combobox" with
// a listbox, but no keydown listener at all — arrows, Enter and Escape
// did nothing; the 12-result slice had no way to reach the rest; and
// every string in renderGlobalSearch + the static region was hard-coded
// English, so Urdu mode left the whole search surface English.
//
// What this file owns:
//   G1 — module state + Show More: the two plain literal lets, the
//        slice by globalSearchShown, the Show More wiring (+12, wired
//        once), and the reset on query change.
//   G2 — the keyboard: the REAL keydown handler statement + the REAL
//        helper defs, extracted from app.js and driven over mock
//        option elements (the Sharafat 81 pattern). Arrows wrap and
//        set aria-selected + aria-activedescendant with focus staying
//        in the input; Enter mirrors FCS; Escape closes the list;
//        unclaimed keys fall through; a modal/detail open still wins.
//   G3 — the strings: every renderGlobalSearch fragment + the four
//        static-region strings go through t() with the 16 new keys;
//        EN byte-identical to the base strings; UR in the app's
//        plain-words register; parity 4,723/4,723.
//   G4 — guards: the document-level Escape fallback runs only after
//        the modal loop; aria-activedescendant is the only
//        announcement channel; options carry ids; the keydown
//        listener is a separate statement that adds no renders.
//   G5 — completeness: key sets equal, the dark highlight rule
//        exists and adds no new hex, no new import edge.
//
// Fixtures are generic: option ids are 'c1'/'c2'/'c3', the input
// value is 'test'; no customer names, no phone numbers anywhere in
// this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TRANSLATIONS, t } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const styles = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const lines = app.split('\n');

// ---------- extraction helpers (the Sharafat 81 shape) ----------

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

const inputAnchor = "$('#globalCustomerSearch').addEventListener('input',";
const keydownAnchor = "$('#globalCustomerSearch').addEventListener('keydown',";
const focusAnchor = "$('#globalCustomerSearch').addEventListener('focus',";
const showMoreAnchor = "$('#globalSearchShowMore')?.addEventListener('click',";
const docKeydownAnchor = "document.addEventListener('keydown', event => {";
const inputStart = app.indexOf(inputAnchor);
const keydownStart = app.indexOf(keydownAnchor);
const focusStart = app.indexOf(focusAnchor);
const showMoreStart = app.indexOf(showMoreAnchor);
const docKeydownStart = app.indexOf(docKeydownAnchor);
for (const [name, at] of [
  ['global input listener', inputStart],
  ['global keydown listener', keydownStart],
  ['global focus listener', focusStart],
  ['Show More wiring', showMoreStart],
  ['document keydown handler', docKeydownStart],
]) {
  assert.notEqual(at, -1, `${name} is missing from app.js`);
}
const inputStmt = extractStatement(app, inputStart);
const keydownStmt = extractStatement(app, keydownStart);
const showMoreStmt = extractStatement(app, showMoreStart);
const docKeydownStmt = extractStatement(app, docKeydownStart);
const helperNames = [
  'globalSearchOptionButtons',
  'applyGlobalSearchHighlight',
  'closeGlobalSearchList',
  'globalSearchEscapeHasPriority',
];
const helperDefs = helperNames.map((name) => {
  const def = extractFunctionDef(app, name);
  assert.ok(def, `${name} must exist in app.js`);
  return def;
});
const helpersSrc = helperDefs.join('\n');

// The render function runs from its definition to the next top-level
// function (switchView) — a bound for "not inside render" checks
// (the extractor cannot brace-match it: nested template literals).
const renderStart = app.indexOf('function renderGlobalSearch() {');
const renderEnd = app.indexOf('function switchView(', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'renderGlobalSearch bounds not found');
const renderSrc = app.slice(renderStart, renderEnd);

// ---------- fake DOM + keydown harness ----------

const MODAL_IDS = [
  'accountStatementModal',
  'paymentReminderModal',
  'batchReceiptModal',
  'customerLedgerAuditModal',
  'customerBillInvoiceModal',
  'wadaFollowupModal',
  'reminderStagesModal',
];

function makeOption(id, customerId) {
  const attrs = new Map([['aria-selected', 'false']]);
  return {
    id,
    dataset: { globalCustomer: customerId },
    scrollCalls: 0,
    setAttribute(k, v) { attrs.set(k, v); },
    getAttribute(k) { return attrs.get(k) ?? null; },
    removeAttribute(k) { attrs.delete(k); },
    scrollIntoView() { this.scrollCalls += 1; },
  };
}

function makeHarness({
  optionCount = 3,
  boxHidden = false,
  menuHidden = true,
  detailOpen = false,
  innerWidth = 1024,
  modalsOpen = [],
} = {}) {
  const inputAttrs = new Map([['aria-expanded', 'true']]);
  const input = {
    value: 'test',
    focusCalls: 0,
    listeners: {},
    setAttribute(k, v) { inputAttrs.set(k, v); },
    getAttribute(k) { return inputAttrs.get(k) ?? null; },
    removeAttribute(k) { inputAttrs.delete(k); },
    focus() { this.focusCalls += 1; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  };
  const box = { hidden: boxHidden };
  const options = Array.from(
    { length: optionCount },
    (_, i) => makeOption(`global-search-option-${i}`, `c${i + 1}`),
  );
  const optionList = { querySelectorAll: () => options };
  const menu = { hidden: menuHidden };
  const appShell = { classList: { contains: (cls) => cls === 'show-detail' && detailOpen } };
  const modalFakes = {};
  for (const id of MODAL_IDS) {
    modalFakes[id] = {
      open: modalsOpen.includes(id),
      hasAttribute: () => false,
      close() { this.open = false; },
    };
  }
  const selected = [];
  const selectCustomer = (id) => { selected.push(id); };
  const bySelector = {
    '#globalCustomerSearch': input,
    '#globalCustomerResults': box,
    '#globalCustomerOptionList': optionList,
    '#mobileMoreMenu': menu,
  };
  for (const id of MODAL_IDS) bySelector[`#${id}`] = modalFakes[id];
  const $ = (sel) => bySelector[sel] ?? null;
  const windowFake = { innerWidth };
  const runner = new Function('$', 'appShell', 'window', 'selectCustomer', `
    let globalSearchHighlightedIndex = -1;
    let globalSearchShown = 12;
    ${helpersSrc}
    ${keydownStmt}
    return {
      get highlighted() { return globalSearchHighlightedIndex; },
      set highlighted(v) { globalSearchHighlightedIndex = v; },
      get shown() { return globalSearchShown; },
      fire(key) {
        const handler = $('#globalCustomerSearch').listeners.keydown;
        if (!handler) return null;
        const event = {
          key,
          defaultPrevented: false,
          propagationStopped: false,
          preventDefault() { this.defaultPrevented = true; },
          stopPropagation() { this.propagationStopped = true; },
        };
        handler(event);
        return event;
      },
      apply: applyGlobalSearchHighlight,
      close: closeGlobalSearchList,
      escapePriority: globalSearchEscapeHasPriority,
    };
  `);
  const api = runner($, appShell, windowFake, selectCustomer);
  return { api, input, inputAttrs, box, options, selected };
}

// ---------- G1 — module state + Show More ----------

test('G1: the two combobox lets are plain literals in the wiring window', () => {
  const listAnchor = "$('#customerListSearch').addEventListener('input',";
  const windowStartLine = Math.max(
    0,
    lines.findIndex((l) => l.includes(listAnchor)) - 200,
  );
  const windowEndLine = lines.findIndex((l) => l.includes(inputAnchor));
  const windowSrc = lines.slice(windowStartLine, windowEndLine + 1).join('\n');
  assert.match(windowSrc, /^let globalSearchHighlightedIndex = -1;$/m, 'highlight index starts at -1');
  assert.match(windowSrc, /^let globalSearchShown = 12;$/m, 'shown count starts at 12');
});

test('G1: renderGlobalSearch slices by globalSearchShown and hides Show More when all are shown', () => {
  assert.ok(renderSrc.includes('matches.slice(0, globalSearchShown)'), 'slice uses the module state, not a hard-coded 12');
  assert.ok(renderSrc.includes('showMoreBtn.hidden = matches.length <= shown.length'), 'Show More hides once the whole list is shown');
  assert.ok(renderSrc.includes("$('#globalSearchShowMore')"), 'render controls the Show More button');
  // The button sits inside #globalCustomerResults but OUTSIDE the
  // listbox (T6): after the count <p>, never an option.
  assert.match(
    html,
    /<div id="globalCustomerOptionList"[^>]*><\/div><p id="globalSearchResultCount"[^>]*><\/p><button id="globalSearchShowMore"/,
    'Show More follows the count line, outside the listbox',
  );
});

test('G1: the input listener resets shown + highlight on query change', () => {
  assert.ok(inputStmt.includes('globalSearchShown = 12;'), 'query change restarts the shown page');
  assert.ok(inputStmt.includes('globalSearchHighlightedIndex = -1;'), 'query change clears the highlight');
  assert.ok(renderSrc.includes('globalSearchShown = 12;'), 'empty query restarts the shown page');
  assert.ok(renderSrc.includes('globalSearchHighlightedIndex = -1;'), 'empty query clears the highlight');
});

test('G1: Show More wiring adds 12 and re-renders, wired once outside renderGlobalSearch', () => {
  assert.ok(showMoreStmt.includes('globalSearchShown += 12;'), 'each tap reveals 12 more');
  assert.ok(showMoreStmt.includes('renderGlobalSearch();'), 'each tap re-renders');
  assert.ok(showMoreStart > renderEnd, 'the wiring lives outside renderGlobalSearch (no double-bind)');
  assert.equal(app.split(showMoreAnchor).length - 1, 1, 'Show More is wired exactly once');
});

test('G1: the count line names shown + total through t()', () => {
  assert.ok(
    renderSrc.includes("t('global_search_showing', null, { shown: shown.length, total: matches.length })"),
    'count line composes shown/total via the key',
  );
});

// ---------- G2 — the keyboard (real handler, mock options) ----------

test('G2: ArrowDown highlights the first option, sets aria-selected + aria-activedescendant, focus stays put', () => {
  const { api, input, options } = makeHarness();
  const event = api.fire('ArrowDown');
  assert.equal(api.highlighted, 0, 'first ArrowDown highlights option 0');
  assert.equal(options[0].getAttribute('aria-selected'), 'true');
  assert.equal(options[1].getAttribute('aria-selected'), 'false');
  assert.equal(options[2].getAttribute('aria-selected'), 'false');
  assert.equal(input.getAttribute('aria-activedescendant'), 'global-search-option-0');
  assert.equal(input.focusCalls, 0, 'focus never leaves the input');
  assert.equal(event.defaultPrevented, true, 'the arrow does not move the caret');
  assert.equal(options[0].scrollCalls, 1, 'the highlighted option scrolls into view');
});

test('G2: arrows wrap around both ends', () => {
  const { api, input, options } = makeHarness();
  api.highlighted = 2;
  api.apply();
  api.fire('ArrowDown');
  assert.equal(api.highlighted, 0, 'ArrowDown from the last wraps to the first');
  assert.equal(input.getAttribute('aria-activedescendant'), 'global-search-option-0');
  api.fire('ArrowUp');
  assert.equal(api.highlighted, 2, 'ArrowUp from the first wraps to the last');
  assert.equal(options[2].getAttribute('aria-selected'), 'true');
  assert.equal(options[0].getAttribute('aria-selected'), 'false');
});

test('G2: Enter on a highlighted option opens it and closes the list', () => {
  const { api, input, box, selected } = makeHarness();
  api.highlighted = 1;
  api.apply();
  api.fire('Enter');
  assert.deepEqual(selected, ['c2'], 'the highlighted customer opens');
  assert.equal(box.hidden, true, 'the list closes');
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.equal(input.getAttribute('aria-activedescendant'), null, 'activedescendant is removed');
  assert.equal(api.highlighted, -1, 'the highlight resets');
});

test('G2: Enter with no highlight opens a single result, but only highlights the first of many', () => {
  const single = makeHarness({ optionCount: 1 });
  single.api.fire('Enter');
  assert.deepEqual(single.selected, ['c1'], 'single result opens');
  assert.equal(single.box.hidden, true);

  const many = makeHarness({ optionCount: 3 });
  many.api.fire('Enter');
  assert.deepEqual(many.selected, [], 'multiple results open nothing on the first Enter');
  assert.equal(many.api.highlighted, 0, 'the first result is highlighted instead');
  assert.equal(many.box.hidden, false, 'the list stays open');
  many.api.fire('Enter');
  assert.deepEqual(many.selected, ['c1'], 'the second Enter opens the highlighted first result');
});

test('G2: Escape closes the list, resets the highlight, and returns focus to the input', () => {
  const { api, input, box } = makeHarness();
  api.highlighted = 1;
  api.apply();
  const event = api.fire('Escape');
  assert.equal(box.hidden, true);
  assert.equal(api.highlighted, -1);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.equal(input.getAttribute('aria-activedescendant'), null);
  assert.equal(input.focusCalls, 1, 'focus returns to the input');
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.propagationStopped, true, 'the document handler must not double-close');
});

test('G2: Escape does nothing when a modal or the detail view claims it first', () => {
  const modal = makeHarness({ modalsOpen: ['wadaFollowupModal'] });
  modal.api.highlighted = 1;
  modal.api.apply();
  modal.api.fire('Escape');
  assert.equal(modal.box.hidden, false, 'the list stays open when a modal is open');
  assert.equal(modal.api.highlighted, 1, 'the highlight survives');
  assert.equal(modal.input.focusCalls, 0);

  const detail = makeHarness({ detailOpen: true, innerWidth: 500 });
  detail.api.fire('Escape');
  assert.equal(detail.box.hidden, false, 'the list stays open when the detail view is open on a phone');

  const menu = makeHarness({ menuHidden: false });
  menu.api.fire('Escape');
  assert.equal(menu.box.hidden, false, 'the list stays open when the More menu is open');
});

test('G2: unclaimed keys fall through, and a hidden list ignores every key', () => {
  const { api, box, options } = makeHarness();
  const slash = api.fire('/');
  assert.equal(api.highlighted, -1, "'/' does not highlight");
  assert.equal(slash.defaultPrevented, false, "'/' is not claimed");
  assert.equal(box.hidden, false, 'the list stays open');
  const letter = api.fire('a');
  assert.equal(api.highlighted, -1);
  assert.equal(letter.defaultPrevented, false);

  const hidden = makeHarness({ boxHidden: true });
  hidden.api.fire('ArrowDown');
  assert.equal(hidden.api.highlighted, -1, 'arrows do nothing while the list is hidden');
  assert.equal(hidden.options[0].getAttribute('aria-selected'), 'false');
  assert.equal(options[0].scrollCalls, 0);
});

test('G2: the no-match row and the action buttons never join the arrow cycle', () => {
  const noMatchAt = renderSrc.indexOf('global-result-no-match');
  assert.ok(noMatchAt >= 0, 'the no-match row exists in the render function');
  const noMatchFragment = renderSrc.slice(noMatchAt, renderSrc.indexOf('</div>', noMatchAt));
  assert.ok(!noMatchFragment.includes('data-global-customer'), 'the no-match row carries no data-global-customer, so the cycle skips it');
  assert.ok(helperDefs[0].includes("querySelectorAll('[data-global-customer]')"), 'the cycle queries option buttons only');
  assert.ok(renderSrc.includes('data-global-add-payment'), 'action buttons exist');
  assert.ok(renderSrc.includes('data-global-add-wada'), 'action buttons exist');
  // The option button's own tag ends at the first '>' after
  // data-global-customer — the action buttons are sibling elements.
  const optionTagAt = renderSrc.indexOf('data-global-customer="${escapeHtml(customer.id)}"');
  assert.ok(optionTagAt >= 0, 'the option button carries data-global-customer');
  assert.ok(!renderSrc.slice(optionTagAt, renderSrc.indexOf('>', optionTagAt)).includes('data-global-add-payment'), 'the option button itself is not an action button');
});

// ---------- G3 — the strings, both languages ----------

const ALL_16_KEYS = [
  'global_search_recent_receipts',
  'global_search_more_saved',
  'global_search_no_receipts',
  'global_search_no_match',
  'global_search_showing',
  'global_search_hint',
  'global_search_found_one',
  'global_search_found_many',
  'global_search_ledger_line',
  'global_search_add_payment',
  'global_search_add_wada',
  'global_search_label',
  'global_search_help',
  'global_search_list_aria',
  'global_search_region_aria',
  'global_search_show_more',
];

test('G3: renderGlobalSearch calls t() for every user-facing string', () => {
  for (const key of ALL_16_KEYS) {
    if (['global_search_label', 'global_search_help', 'global_search_list_aria', 'global_search_region_aria', 'global_search_show_more'].includes(key)) continue;
    assert.ok(renderSrc.includes(`t('${key}'`), `render calls t('${key}')`);
  }
  assert.ok(renderSrc.includes("t('cust_card_archived')"), "' · Archived' reuses cust_card_archived");
  // No hard-coded English fragment survives in the render function.
  for (const fragment of [
    'Recent receipts: ',
    'No payment receipts saved.',
    'No customer, bill, or receipt matches.',
    'Showing ${shown.length} of',
    '>Add Payment<',
    '>Add Wada<',
    'more saved',
    'Bill ${escapeHtml',
  ]) {
    assert.ok(!renderSrc.includes(fragment), `hard-coded fragment gone: ${fragment}`);
  }
});

test('G3: all 16 keys exist in both dicts, non-empty', () => {
  for (const key of ALL_16_KEYS) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `EN ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `UR ${key}`);
  }
});

test('G3: the EN values are byte-identical to the base strings', () => {
  const en = TRANSLATIONS.en;
  assert.equal(en.global_search_recent_receipts, 'Recent receipts: {list}');
  assert.equal(en.global_search_more_saved, '{count} more saved');
  assert.equal(en.global_search_no_receipts, 'No payment receipts saved.');
  assert.equal(en.global_search_no_match, 'No customer, bill, or receipt matches.');
  assert.equal(en.global_search_showing, 'Showing {shown} of {total} customers with matching saved history. Service and billing filters affect the customer list only.');
  assert.equal(en.global_search_hint, 'Search includes saved customer details, bill status and amounts, and payment date, method, and amount.');
  assert.equal(en.global_search_found_one, '1 customer found with saved bill summaries and receipt history.');
  assert.equal(en.global_search_found_many, '{count} customers found with saved bill summaries and receipt history.');
  assert.equal(en.global_search_ledger_line, 'Bill {bill} · Received {received} · Balance {balance}');
  assert.equal(en.global_search_add_payment, 'Add Payment');
  assert.equal(en.global_search_add_wada, 'Add Wada');
  assert.equal(en.global_search_label, 'Search customers and ledger by name, phone, ID, status, amount, date or method');
  assert.equal(en.global_search_help, 'Search saved customers, bill status and amounts, and every actual receipt. Service/billing filters and the transaction-date filter remain active only on their own lists.');
  assert.equal(en.global_search_list_aria, 'Matching customers with billing and receipt detail');
  assert.equal(en.global_search_region_aria, 'Global customer and ledger search');
  assert.equal(en.global_search_show_more, 'Show more (12 per page)');
});

test('G3: the UR values are the app\'s plain-words Urdu, and Add Payment matches VISIBLE_TEXT_UR', () => {
  const ur = TRANSLATIONS.ur;
  assert.equal(ur.global_search_add_payment, 'ادائیگی شامل کریں', 'matches VISIBLE_TEXT_UR["Add Payment"]');
  assert.equal(ur.global_search_add_wada, 'وعدہ شامل کریں');
  assert.equal(ur.global_search_show_more, 'مزید دکھائیں (12 فی صفحہ)');
  assert.equal(ur.global_search_no_match, 'کوئی گاہک، بل، یا رسید مماثل نہیں ہے۔');
  assert.equal(ur.global_search_ledger_line, 'بل {bill} · وصول شدہ {received} · بقایا {balance}');
  for (const key of ALL_16_KEYS) {
    assert.ok(!/Add Payment|Add Wada|Show more/.test(ur[key]), `no English leftover in UR ${key}`);
  }
});

test('G3: t() interpolates the params, and the UR showing line reorders them', () => {
  assert.equal(
    t('global_search_ledger_line', 'en', { bill: 'PKR 1,000', received: 'PKR 500', balance: 'PKR 500' }),
    'Bill PKR 1,000 · Received PKR 500 · Balance PKR 500',
  );
  assert.equal(
    t('global_search_showing', 'en', { shown: 3, total: 9 }),
    'Showing 3 of 9 customers with matching saved history. Service and billing filters affect the customer list only.',
  );
  assert.ok(
    t('global_search_showing', 'ur', { shown: 3, total: 9 }).startsWith('9 میں سے 3 '),
    'UR puts the total first, the shown count second',
  );
  assert.equal(t('global_search_found_many', 'en', { count: 5 }), '5 customers found with saved bill summaries and receipt history.');
});

test('G3: the static region is wired, with fallbacks byte-identical to the EN dict values', () => {
  assert.match(html, /<label class="global-search-label" for="globalCustomerSearch" data-i18n="global_search_label">Search customers and ledger by name, phone, ID, status, amount, date or method<\/label>/);
  assert.match(html, /<p class="global-search-help" data-i18n="global_search_help">Search saved customers, bill status and amounts, and every actual receipt\. Service\/billing filters and the transaction-date filter remain active only on their own lists\.<\/p>/);
  assert.ok(html.includes('<div id="globalCustomerOptionList" role="listbox" aria-label="Matching customers with billing and receipt detail" data-i18n-aria-label="global_search_list_aria">'), 'listbox carries data-i18n-aria-label');
  assert.ok(html.includes('<section class="global-search-region" aria-label="Global customer and ledger search" data-i18n-aria-label="global_search_region_aria">'), 'section carries data-i18n-aria-label');
  assert.ok(html.includes('<button id="globalSearchShowMore" class="secondary-button global-search-show-more" type="button" data-i18n="global_search_show_more" hidden>Show more (12 per page)</button>'), 'Show More carries data-i18n');
});

// ---------- G4 — guards ----------

test('G4: the document-level Escape fallback runs only after the modal loop', () => {
  const modalLoopAt = docKeydownStmt.indexOf('for (const m of activeModals)');
  const fallbackAt = docKeydownStmt.indexOf('globalSearchEscapeHasPriority()');
  assert.ok(modalLoopAt >= 0, 'the modal loop is in the document handler');
  assert.ok(fallbackAt > modalLoopAt, 'the global-list fallback sits after the modal loop');
  assert.ok(docKeydownStmt.includes('closeGlobalSearchList();'), 'the fallback closes the list');
  assert.ok(keydownStmt.includes('event.stopPropagation();'), 'the input handler stops propagation so the document handler never double-fires');
});

test('G4: aria-activedescendant is the only announcement channel', () => {
  assert.ok(!keydownStmt.includes('globalSearchStatus'), 'arrow moves never touch the status line');
  assert.ok(!keydownStmt.includes('textContent'), 'the keydown handler writes no text anywhere');
  assert.ok(renderSrc.includes("matches.length === 1 ? t('global_search_found_one') : t('global_search_found_many', null, { count: matches.length })"), 'the status line changes only on a render, from the found keys');
});

test('G4: options carry ids, and the highlight helper points activedescendant at them', () => {
  assert.ok(renderSrc.includes('id="global-search-option-${index}"'), 'every option gets an index id');
  assert.ok(helperDefs[1].includes("input?.setAttribute('aria-activedescendant', buttons[globalSearchHighlightedIndex].id)"), 'activedescendant points at the highlighted option id');
  assert.ok(helperDefs[1].includes("input?.removeAttribute('aria-activedescendant')"), 'no highlight removes activedescendant');
});

test('G4: the keydown listener is a separate statement, between input and focus, and adds no renders', () => {
  assert.ok(inputStart < keydownStart && keydownStart < focusStart, 'keydown sits between the input and focus listeners');
  for (const render of ['renderGlobalSearch(', 'renderCustomers(', 'renderTransactions(', 'renderMonthlyReport(']) {
    assert.ok(!keydownStmt.includes(render), `keydown adds no ${render}`);
  }
  assert.ok(keydownStmt.includes("addEventListener('keydown'"), 'it is its own listener statement');
});

// ---------- G5 — completeness ----------

test('G5: parity holds at 4,722/4,722 with equal key sets', () => {
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  // (Test title re-pinned with the asserts by Plan 586 — titles and
  // asserts move together from here on.)
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5203, 'EN keys');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5203, 'UR keys');
  assert.deepEqual(Object.keys(TRANSLATIONS.en).sort(), Object.keys(TRANSLATIONS.ur).sort(), 'no key is missing from either dict');
});

test('G5: the dark selected rule exists and adds no new hex', () => {
  assert.ok(styles.includes('[data-theme="dark"] .global-result-option[aria-selected="true"]'), 'dark selected rule present');
  assert.ok(styles.includes('background: #1c322b;'), 'dark selected background reuses the hover hex');
  assert.ok(styles.includes('border-color: #2dd4bf;'), 'dark selected border reuses the FCS dark hex');
  assert.ok(styles.includes('box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.35);'), 'dark selected shadow reuses the FCS dark shadow');
  // The Polish A ratchet, same method: comment-stripped distinct hex.
  const stripped = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  assert.equal(distinct.size, 608, 'styles.css stays at 608 distinct hex (no new hard-coded colour)');
});

test('G5: no new import edge — the FCS module is never imported or called', () => {
  assert.ok(!app.includes("from './nav-customer-search"), 'no ESM import of the FCS module');
  assert.ok(!app.includes('from "./nav-customer-search'), 'no ESM import of the FCS module (double quotes)');
  // Comments name the module as the copied shape; strip them before
  // asserting the CODE never mentions it.
  const stripComments = (src) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!stripComments(keydownStmt).includes('nav-customer-search'), 'the keydown handler never mentions the FCS module in code');
  for (const def of helperDefs) {
    assert.ok(!stripComments(def).includes('nav-customer-search'), 'the helpers never mention the FCS module in code');
  }
});

test('G5: no real customer names or phone numbers in this test', () => {
  const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(testSrc), 'no phone-shaped string in this test');
});
