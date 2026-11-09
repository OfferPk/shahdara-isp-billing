/**
 * plan542-picker-guidance-tells-truth.test.js — Plan 542 of the
 * Plans 491–600 polish programme (record-payment batch, 521–550).
 *
 * The operator's case: the name-prefix list renders nothing until
 * 2+ letters are typed and the last-four list renders nothing
 * until exactly 4 digits, so typing one letter or three digits
 * shows a blank area — the operator cannot tell whether there are
 * no customers or the lookup simply has not started. And the
 * picker list's empty state says "Try searching by customer name,
 * 3-digit phone, or clear filters" — there is NO 3-digit phone
 * search. When a mohalla filter yields zero customers the same
 * generic message appears and never names the mohalla or offers
 * to clear it.
 *
 * Pins:
 *  - a short hint line under the search box while the query is too
 *    short for a lookup ("Type 2+ letters to match names" /
 *    "Type 4 digits to match phone endings"), hidden once a lookup
 *    runs — and never shown for an empty query, when the
 *    recent-customers list owns the picker;
 *  - the empty state names the real search rules (name, phone,
 *    #ID, area) and never says "3-digit phone";
 *  - a mohalla filter with zero results names the mohalla and
 *    offers a one-tap "Clear mohalla filter" that clears ONLY the
 *    mohalla filter (not the search query, not the recent list)
 *    and returns the full list.
 *
 * No matching rule or filter changes: the name-prefix 2+ letter
 * rule and the last-four exactly-4-digit rule stay exactly as
 * they are — the hint is guidance only.
 *
 * Harness: the polish #13 / Plan 538 controller harness (mock DOM
 * + mock localStorage), with two synthetic customers. Synthetic
 * data only — no real customer names, no realistic phone numbers
 * (pattern-fake digits only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations,
  saveBillMonth,
} from '../core.js';
import {
  getPakistanLocalDate, setupQuickCollectModal,
  quickCollectSearchHintText, quickCollectSearchHintHtml,
  QUICK_COLLECT_SEARCH_HINT_LETTERS, QUICK_COLLECT_SEARCH_HINT_DIGITS,
  renderQuickCollectPickerHtml, renderQuickCollectCustomerListHtml,
} from '../nav-quick-collect.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

const now = new Date();
const month = getPakistanLocalDate(now).slice(0, 7);

/** Two synthetic customers on the PKR 1,000 package, billed this month. */
function plan542State() {
  let state = createInitialState(['Ahmed Tester', 'Bilal Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000,
    phone: '03000001234', mohalla: 'BANII',
  }, now);
  state = updateCustomerProfile(state, 'seed-002', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000,
    phone: '03000005678', mohalla: 'BANII',
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due for seed-001');
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-002', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due for seed-002');
  return state;
}

/** A billed state with customers in BANII and GANGALL (Plan 446 fixture). */
function billedState() {
  const customer = (id, n, name, extra = {}) => ({
    id, customerNumber: n, name, phone: `0301234567${n}`, archived: false, bills: [], ...extra,
  });
  let s = {
    customers: [
      customer('a', 9, 'Zara Nine', { mohalla: 'BANII' }),
      customer('b', 1, 'Ali One', { mohalla: 'BANII' }),
      customer('c', 2, 'Bilal Two', { mohalla: 'GANGALL' }),
      customer('d', 3, 'Chanda Three', { mohalla: 'BANII' }),
      customer('e', 4, 'Danish Four', { area: 'GANGALL' }),
    ],
  };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 3000, status: 'pending' });
  s = saveBillMonth(s, 'c', { month, dueAmount: 1500, status: 'pending' });
  s = saveBillMonth(s, 'd', { month, dueAmount: 1000, status: 'pending' });
  s = saveBillMonth(s, 'e', { month, dueAmount: 1000, status: 'pending' });
  return s;
}

/** Plan 542 controller harness: the polish #13 mock DOM, two customers. */
function plan542Controller(initialState) {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', innerHTML: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      focus: () => {},
      select: () => {},
      showModal: () => { el.opened = true; el.open = true; },
      close: () => { el.open = false; },
      opened: false,
      open: false
    };
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };

  // The real DOM resets a select's value when its options are rebuilt
  // via innerHTML (the `selected` option wins). The mock must do the
  // same, or a fresh open would keep the previous opening's month.
  const monthSelectEl = getEl('quickCollectMonthSelect');
  let monthHtml = '';
  Object.defineProperty(monthSelectEl, 'innerHTML', {
    get: () => monthHtml,
    set: (v) => {
      monthHtml = String(v ?? '');
      const m = monthHtml.match(/value="([^"]+)"\s+selected/);
      if (m) monthSelectEl.value = m[1];
    }
  });

  const origLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };

  const origDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
  };

  let state = initialState;
  const toasts = [];
  const controller = setupQuickCollectModal({
    getState: () => state,
    onSaveState: (next) => { state = next; },
    onToast: (msg, opts) => toasts.push({ msg, opts }),
    onSelectCustomer: () => {},
    onEditCustomer: () => {}
  });
  return {
    getEl, toasts, controller,
    get state() { return state; },
    restore() {
      globalThis.document = origDocument;
      globalThis.localStorage = origLocalStorage;
    }
  };
}

/** Type a query into the picker search box (fires the input handler). */
async function typeQuery(h, value) {
  h.getEl('quickCollectSearchInput').value = value;
  await h.getEl('quickCollectSearchInput').dispatch('input');
}

// --- Hint text: the pure rule ---

test('hint text: one letter asks for a second, two letters run the lookup', () => {
  assert.equal(QUICK_COLLECT_SEARCH_HINT_LETTERS, 'Type 2+ letters to match names.');
  assert.equal(quickCollectSearchHintText('A'), QUICK_COLLECT_SEARCH_HINT_LETTERS);
  assert.equal(quickCollectSearchHintText('a'), QUICK_COLLECT_SEARCH_HINT_LETTERS);
  assert.equal(quickCollectSearchHintText('A '), QUICK_COLLECT_SEARCH_HINT_LETTERS);
  assert.equal(quickCollectSearchHintText('Ah'), '');
  assert.equal(quickCollectSearchHintText('ah'), '');
  assert.equal(quickCollectSearchHintText('A1'), '', 'two characters run the name lookup, even with a digit in them');
});

test('hint text: one to three digits ask for the fourth, four digits run the lookup', () => {
  assert.equal(QUICK_COLLECT_SEARCH_HINT_DIGITS, 'Type 4 digits to match phone endings.');
  assert.equal(quickCollectSearchHintText('1'), QUICK_COLLECT_SEARCH_HINT_DIGITS);
  assert.equal(quickCollectSearchHintText('12'), QUICK_COLLECT_SEARCH_HINT_DIGITS);
  assert.equal(quickCollectSearchHintText('123'), QUICK_COLLECT_SEARCH_HINT_DIGITS);
  assert.equal(quickCollectSearchHintText('1234'), '');
  assert.equal(quickCollectSearchHintText('12345'), '', 'five digits are not "too short" — the phone-substring search owns them');
  assert.equal(quickCollectSearchHintText('03-1'), QUICK_COLLECT_SEARCH_HINT_DIGITS, 'separators do not count as digits');
  assert.equal(quickCollectSearchHintText('0301'), '');
});

test('hint text: Arabic-Indic digits fold to ASCII before the count', () => {
  assert.equal(quickCollectSearchHintText('۱۲۳'), QUICK_COLLECT_SEARCH_HINT_DIGITS);
  assert.equal(quickCollectSearchHintText('۱۲۳۴'), '');
});

test('hint text: nothing typed yet means no hint at all', () => {
  for (const empty of ['', '   ', null, undefined]) {
    assert.equal(quickCollectSearchHintText(empty), '', `expected no hint for ${String(empty)}`);
  }
  assert.equal(quickCollectSearchHintHtml(''), '');
  assert.equal(quickCollectSearchHintHtml('Ah'), '');
});

test('hint markup: one muted status line carrying the hint text', () => {
  const html = quickCollectSearchHintHtml('A');
  assert.match(html, /Type 2\+ letters to match names\./);
  assert.match(html, /qc-lookup-hint/);
  assert.match(html, /role="status"/);
  assert.match(quickCollectSearchHintHtml('123'), /Type 4 digits to match phone endings\./);
});

// --- Empty state: the real search rules ---

test('empty state: guidance names name, phone, #ID and area — never "3-digit phone"', () => {
  const html = renderQuickCollectCustomerListHtml([]);
  assert.match(html, /No matching accounts found/);
  assert.match(html, /customer name/);
  assert.match(html, /#ID/);
  assert.match(html, /phone number/);
  assert.match(html, /area/);
  assert.doesNotMatch(html, /3-digit/);
});

test('empty state: a list with customers renders rows, never the empty state', () => {
  const customers = [
    { id: 'cust-a', customerNumber: 42, name: 'Ahmed Raza', phone: '03001112233', area: 'Begum Kot', totalDues: 2400 },
  ];
  const html = renderQuickCollectCustomerListHtml(customers, 'cust-a');
  assert.match(html, /Ahmed Raza/);
  assert.doesNotMatch(html, /No matching accounts found/);
});

// --- Mohalla zero-results: name it, offer to clear it ---

test('mohalla empty state: a filter with zero customers names the mohalla and offers to clear it', () => {
  const view = renderQuickCollectPickerHtml(billedState(), '', 'all-dues', null, 'Kishtii');
  assert.equal(view.customers.length, 0, 'no Kishtii customers in the fixture');
  assert.match(view.html, /No customers in Kishtii/);
  assert.match(view.html, /Clear mohalla filter/);
  assert.match(view.html, /data-qc-clear-mohalla/);
  assert.doesNotMatch(view.html, /No matching accounts found/, 'the mohalla state replaces the generic one');
});

test('mohalla empty state: a filter WITH customers renders rows, never the clear button', () => {
  const view = renderQuickCollectPickerHtml(billedState(), '', 'all-dues', null, 'BANII');
  assert.ok(view.customers.length > 0);
  assert.match(view.html, /Ali One/);
  assert.doesNotMatch(view.html, /data-qc-clear-mohalla/);
});

test('mohalla empty state: a query with no match and no mohalla filter keeps the generic guidance', () => {
  const view = renderQuickCollectPickerHtml(billedState(), 'zzz', 'all-dues', null, '');
  assert.equal(view.customers.length, 0);
  assert.match(view.html, /No matching accounts found/);
  assert.doesNotMatch(view.html, /data-qc-clear-mohalla/);
});

test('mohalla empty state: a query with no match under a mohalla filter still names the mohalla', () => {
  const view = renderQuickCollectPickerHtml(billedState(), 'zzz', 'all-dues', null, 'Kishtii');
  assert.equal(view.customers.length, 0);
  assert.match(view.html, /No customers in Kishtii/);
  assert.match(view.html, /data-qc-clear-mohalla/);
});

// --- Wiring: the controller renders the hint and clears only the mohalla ---

test('wiring: the picker renders the hint under the search box and hides it once a lookup runs', async () => {
  const h = plan542Controller(plan542State());
  try {
    h.controller.open();
    // Empty query: no hint — the recent-customers list owns the picker.
    assert.doesNotMatch(h.getEl('nplNamePrefixList').innerHTML, /Type 2\+ letters/);
    assert.doesNotMatch(h.getEl('lfdLastFourList').innerHTML, /Type 4 digits/);

    await typeQuery(h, 'A');
    assert.match(h.getEl('nplNamePrefixList').innerHTML, /Type 2\+ letters to match names\./);
    assert.doesNotMatch(h.getEl('nplNamePrefixList').innerHTML, /npl-row/);
    assert.equal(h.getEl('lfdLastFourList').innerHTML, '');

    await typeQuery(h, 'Ah');
    assert.doesNotMatch(h.getEl('nplNamePrefixList').innerHTML, /Type 2\+ letters/);
    assert.match(h.getEl('nplNamePrefixList').innerHTML, /Ahmed Tester/);

    await typeQuery(h, '123');
    assert.match(h.getEl('nplNamePrefixList').innerHTML, /Type 4 digits to match phone endings\./);
    assert.equal(h.getEl('lfdLastFourList').innerHTML, '');

    await typeQuery(h, '1234');
    assert.doesNotMatch(h.getEl('nplNamePrefixList').innerHTML, /Type 4 digits/);
    assert.match(h.getEl('lfdLastFourList').innerHTML, /Ahmed Tester/, 'the 1234 phone-ending lookup finds the customer');
  } finally {
    h.restore();
  }
});

test('wiring: clearing the mohalla filter returns the full list and leaves the search query alone', async () => {
  const h = plan542Controller(plan542State());
  try {
    h.controller.open();
    await typeQuery(h, 'Ah');
    assert.match(h.getEl('nplNamePrefixList').innerHTML, /Ahmed Tester/, 'precondition: the query matches Ahmed');

    h.getEl('mhfMohallaFilter').value = 'Kishtii';
    await h.getEl('mhfMohallaFilter').dispatch('change');
    const emptied = h.getEl('quickCollectCustomerList').innerHTML;
    assert.match(emptied, /No customers in KISHTII/);
    assert.match(emptied, /data-qc-clear-mohalla/);

    // The rendered button is a string in the mock DOM, so the click
    // is simulated with a target whose closest() finds the button —
    // exactly what the delegated handler reads.
    const clearTarget = {
      closest: (selector) => (selector === '[data-qc-clear-mohalla]' ? { getAttribute: () => '' } : null),
    };
    await h.getEl('quickCollectCustomerList').dispatch('click', { target: clearTarget });

    assert.equal(h.getEl('mhfMohallaFilter').value, '', 'only the mohalla select is cleared');
    assert.equal(h.getEl('quickCollectSearchInput').value, 'Ah', 'the search query survives the clear');
    const restored = h.getEl('quickCollectCustomerList').innerHTML;
    assert.match(restored, /Ahmed Tester/, 'the full (query-filtered) list returns');
    assert.doesNotMatch(restored, /No customers in KISHTII/);
  } finally {
    h.restore();
  }
});

test('wiring: the list container clears the mohalla filter and nothing else changes', () => {
  assert.match(wiringSrc, /data-qc-clear-mohalla/, 'the clear button is rendered');
  assert.match(wiringSrc, /closest\('\[data-qc-clear-mohalla\]'\)/, 'the list click handler owns the clear action');
  assert.match(wiringSrc, /quickCollectSearchHintHtml\(query\)/, 'the name-prefix render uses the hint');
  // The clear touches the mohalla select and the filter only — the
  // search input is never assigned inside that branch.
  const handler = wiringSrc.slice(wiringSrc.indexOf('[data-qc-clear-mohalla]'));
  const branch = handler.slice(0, handler.indexOf("if (e.target.closest('[data-qc-show-all]'))"));
  assert.doesNotMatch(branch, /searchInput\.value\s*=/);
});
