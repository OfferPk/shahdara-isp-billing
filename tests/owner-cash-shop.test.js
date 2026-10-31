/**
 * owner-cash-shop.test.js — OWNER-CASH-SHOP (2026-10-31).
 *
 * Owner request (with a screenshot of the Quick Collect Cash dialog):
 * when Cash is chosen in Quick Collect, shop choices must appear right
 * there so it is clear WHERE the cash was received — no more typing
 * "Balla shop" into the Paid By/Note field. His two final corrections:
 *  1. The person is Hassan and his famous shop is "Balla" — ONE shop,
 *     written "Hassan Balla Shop" (the app historically carried two
 *     methods, 'Cash at Hassan shop' + 'Cash at Balla shop', PR #452).
 *  2. The default chip is "Owner Office" (cash given at the office),
 *     NOT direct/apne-paas.
 *
 * Pins:
 *  - chip derivation: distinct canonical collectors from PAYMENT_METHODS
 *    via shop-settlement's shopCollectorMethods == [Waseem Abbasi Shop,
 *    Hassan Balla Shop] (Waseem first), each with its canonical method;
 *    a future "Cash at X shop" method surfaces automatically;
 *  - Quick Collect choices: Owner Office first (method 'Cash'), then the
 *    derived shops; the mock-DOM controller shows the sub-row only for
 *    cash methods, defaults to Owner Office, and a chip click writes the
 *    exact method string the submit records through
 *    executeQuickCollection;
 *  - unification: legacy 'Cash at Hassan shop' Rs 1,000 + legacy
 *    'Cash at Balla shop' Rs 2,000 + new 'Cash at Hassan Balla shop'
 *    Rs 500 produce ONE summary "Hassan Balla Shop" with unsettled
 *    Rs 3,500; settlement handover + Roznamcha + Owner Khata read the
 *    unified name; the stored payment objects are never modified;
 *  - Speed Entry letters H and B keep their legacy recorded strings and
 *    both settle onto the unified collector;
 *  - a commission rule stored under a legacy shop key keeps applying to
 *    the unified collector (sanitize canonicalizes shop rule identity);
 *  - i18n: the two new UI keys exist in BOTH dictionaries and appear
 *    exactly twice in nav-language.js (en + ur).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PAYMENT_METHODS, createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth, saveBillMonth } from '../core.js';
import {
  resolveShopCollector,
  canonicalShopName,
  shopCollectorMethods,
  buildShopSummaries,
  applySettlement,
  collectShopPayments
} from '../shop-settlement.js';
import { collectShopHandovers, buildRoznamchaDay } from '../roznamcha.js';
import { buildOwnerKhataReport } from '../owner-khata.js';
import { sanitizeCommissionRules, buildMonthlyCommission } from '../collector-commission.js';
import { submitSpeedEntryBatch } from '../speed-counter-entry.js';
import { executeQuickCollection, quickCollectShopChoices, getPakistanLocalDate, setupQuickCollectModal } from '../nav-quick-collect.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date(Date.UTC(2026, 9, 27, 7)); // 2026-10-27 PKT-ish

const customer = (id, number, name, bills) => ({ id, customerNumber: number, name, bills });
const bill = (month, payments) => ({ month, payments });
const payment = (id, overrides) => ({ id, date: '2026-10-06', amount: 0, method: 'Cash', ...overrides });

// ------------------------------------------------------------ derivation

test('derivation: distinct canonical collectors from PAYMENT_METHODS, Waseem first', () => {
  assert.deepEqual(shopCollectorMethods(PAYMENT_METHODS), [
    { shop: 'Waseem Abbasi Shop', method: 'Cash at Waseem Abbasi shop' },
    { shop: 'Hassan Balla Shop', method: 'Cash at Hassan Balla shop' }
  ]);
  // A future shop method surfaces automatically through the same seam.
  assert.deepEqual(shopCollectorMethods([...PAYMENT_METHODS, 'Cash at Rahim shop']).at(-1),
    { shop: 'Rahim Shop', method: 'Cash at Rahim shop' });
  // Non-shop methods derive nothing.
  assert.deepEqual(shopCollectorMethods(['Cash', 'JazzCash', 'Raast']), []);
});

test('derivation: canonicalShopName unifies only the one split shop identity', () => {
  assert.equal(canonicalShopName('Hassan Shop'), 'Hassan Balla Shop');
  assert.equal(canonicalShopName('Balla Shop'), 'Hassan Balla Shop');
  assert.equal(canonicalShopName('Hassan Balla Shop'), 'Hassan Balla Shop');
  assert.equal(canonicalShopName('hassan shop'), 'Hassan Balla Shop');
  assert.equal(canonicalShopName('Waseem Abbasi Shop'), 'Waseem Abbasi Shop');
  assert.equal(canonicalShopName('Waseem'), 'Waseem');
  assert.equal(canonicalShopName('Ahmed Shop'), 'Ahmed Shop');
  assert.equal(canonicalShopName(''), '');
  assert.equal(canonicalShopName(null), '');
});

test('choices: Owner Office default first, then the derived shops with exact methods', () => {
  const choices = quickCollectShopChoices();
  assert.equal(choices.length, 3);
  assert.deepEqual(choices[0], { key: 'office', shop: null, method: 'Cash', labelKey: 'cashshop_owner_office', label: null });
  assert.deepEqual(choices[1], { key: 'shop:Waseem Abbasi Shop', shop: 'Waseem Abbasi Shop', method: 'Cash at Waseem Abbasi shop', labelKey: null, label: 'Waseem Abbasi Shop' });
  assert.deepEqual(choices[2], { key: 'shop:Hassan Balla Shop', shop: 'Hassan Balla Shop', method: 'Cash at Hassan Balla shop', labelKey: null, label: 'Hassan Balla Shop' });
  for (const choice of choices) assert.ok(PAYMENT_METHODS.includes(choice.method), `${choice.method} is a real method`);
});

// ------------------------------------------------------------ unification

function unificationState() {
  return {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [
        payment('p-hassan', { date: '2026-10-05', amount: 1000, method: 'Cash at Hassan shop' }),
        payment('p-balla', { date: '2026-10-06', amount: 2000, method: 'Cash at Balla shop' }),
        payment('p-unified', { date: '2026-10-07', amount: 500, method: 'Cash at Hassan Balla shop' })
      ])
    ])],
    expenses: []
  };
}

test('unification: legacy Hassan + legacy Balla + new payments form ONE summary of Rs 3,500', () => {
  const state = unificationState();
  const storedBefore = JSON.stringify(state.customers[0].bills[0].payments);

  const summaries = buildShopSummaries(state, [], REF);
  assert.equal(summaries.length, 1, 'exactly one shop summary — no Hassan/Balla split');
  assert.equal(summaries[0].shop, 'Hassan Balla Shop');
  assert.equal(summaries[0].unsettled, 3500);
  assert.equal(summaries[0].totalCollected, 3500);
  assert.equal(summaries[0].receiptCount, 3);
  assert.deepEqual(collectShopPayments(state).map((p) => p.shop),
    ['Hassan Balla Shop', 'Hassan Balla Shop', 'Hassan Balla Shop']);

  // A settlement stored under a LEGACY name joins the same summary when
  // read (its last-handover date counts) — the record is not rewritten.
  const legacyRecord = { id: 's-old', shop: 'Balla Shop', amount: 400, date: '2026-10-08', note: '', allocations: [], createdAt: '' };
  const withLegacy = buildShopSummaries(state, [legacyRecord], REF);
  assert.equal(withLegacy.length, 1);
  assert.equal(withLegacy[0].shop, 'Hassan Balla Shop');
  assert.equal(withLegacy[0].lastHandoverDate, '2026-10-08');
  assert.equal(legacyRecord.shop, 'Balla Shop', 'stored settlement record untouched');

  // Stored payment objects are byte-identical after every derivation.
  assert.equal(JSON.stringify(state.customers[0].bills[0].payments), storedBefore);
});

test('unification: handover, Roznamcha and Owner Khata all read the unified name', () => {
  const state = unificationState();
  const { state: settledState, settlement, leftover } = applySettlement(state, 'Hassan Balla Shop', 3500, '2026-10-09', '');
  assert.equal(leftover, 0);
  assert.equal(settlement.shop, 'Hassan Balla Shop');
  assert.equal(settlement.amount, 3500);
  assert.equal(buildShopSummaries(settledState, [settlement], REF)[0].unsettled, 0);

  assert.deepEqual(collectShopHandovers([settlement], '2026-10-09'),
    [{ shop: 'Hassan Balla Shop', amount: 3500 }]);
  const day = buildRoznamchaDay(settledState, [], '2026-10-09', [settlement]);
  assert.equal(day.shopIn, 3500);
  assert.deepEqual(day.handovers, [{ shop: 'Hassan Balla Shop', amount: 3500 }]);

  const report = buildOwnerKhataReport(settledState, '2026-10', { settlements: [settlement], referenceDate: REF });
  assert.deepEqual(
    report.collectionChannels.find((row) => row.channel === 'Hassan Balla Shop'),
    { channel: 'Hassan Balla Shop', kind: 'shop', amount: 3500, count: 3 }
  );
  assert.deepEqual(report.shopSettledByShop, [{ shop: 'Hassan Balla Shop', amount: 3500, count: 1 }]);

  // The three stored payments still carry their original method strings.
  assert.deepEqual(
    settledState.customers[0].bills[0].payments.map((p) => p.method),
    ['Cash at Hassan shop', 'Cash at Balla shop', 'Cash at Hassan Balla shop']
  );
});

// ------------------------------------------------------------ speed entry

test('speed entry: H and B rows keep legacy strings and settle onto the unified collector', () => {
  const now = new Date();
  const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7); // PKT — the app derives the billing month in Asia/Karachi; plain toISOString() (UTC) is a month behind between 00:00–05:00 PKT on the 1st
  const today = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  let state = {
    customers: [
      { id: 'a', customerNumber: 1, name: 'Test Customer Alpha', phone: '03000000001', area: 'Shahdara', archived: false, bills: [] },
      { id: 'b', customerNumber: 2, name: 'Test Customer Bravo', phone: '03000000002', area: 'Shahdara', archived: false, bills: [] }
    ]
  };
  state = saveBillMonth(state, 'a', { month, dueAmount: 1000, status: 'pending' });
  state = saveBillMonth(state, 'b', { month, dueAmount: 2000, status: 'pending' });

  const row = (id, customerQuery, amount, methodKey) => ({ id, customerQuery, amount, methodKey, status: 'draft' });
  const { nextState, recordedCount } = submitSpeedEntryBatch(state, [
    row('row-h', '1', '1000', 'H'),
    row('row-b', '2', '2000', 'B')
  ], { execute: executeQuickCollection, month, date: today, referenceDate: now });
  assert.equal(recordedCount, 2);

  const methods = nextState.customers.flatMap((c) => c.bills.flatMap((b) => b.payments.map((p) => p.method)));
  assert.deepEqual(methods.sort(), ['Cash at Balla shop', 'Cash at Hassan shop'], 'recorded strings stay legacy (SISP-99)');

  const summaries = buildShopSummaries(nextState, []);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].shop, 'Hassan Balla Shop');
  assert.equal(summaries[0].unsettled, 3000);
});

// ------------------------------------------------------------ commission

test('commission: a rule stored under a legacy shop key applies to the unified collector', () => {
  const legacyRule = { collectorKey: 'shop:Balla Shop', kind: 'shop', label: 'Balla Shop', mode: 'perReceipt', perReceiptFixed: 25, percentageOfCollection: 0 };
  const cleaned = sanitizeCommissionRules([legacyRule]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].collectorKey, 'shop:Hassan Balla Shop');
  assert.equal(cleaned[0].label, 'Hassan Balla Shop');
  assert.equal(cleaned[0].perReceiptFixed, 25);

  // Both legacy spellings configured -> ONE unified rule (first wins).
  const both = sanitizeCommissionRules([
    { collectorKey: 'shop:Hassan Shop', kind: 'shop', label: 'Hassan Shop', mode: 'perReceipt', perReceiptFixed: 10, percentageOfCollection: 0 },
    legacyRule
  ]);
  assert.equal(both.length, 1);
  assert.equal(both[0].perReceiptFixed, 10);

  const state = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [payment('p1', { date: '2026-10-06', amount: 1000, method: 'Cash at Balla shop' })])
    ])],
    expenses: []
  };
  const report = buildMonthlyCommission(state, [legacyRule], '2026-10');
  const row = report.rows.find((r) => r.key === 'shop:Hassan Balla Shop');
  assert.ok(row, 'unified row exists');
  assert.equal(row.receipts, 1);
  assert.equal(row.commission, 25, 'the legacy-keyed rule still earns on the unified collector');
});

// ------------------------------------------------------------ i18n

test('i18n: sub-row prompt and Owner Office keys exist in both dictionaries, exactly 2x in source', () => {
  for (const key of ['cashshop_where_label', 'cashshop_owner_office']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0);
  }
  assert.equal(TRANSLATIONS.en.cashshop_owner_office, 'Owner Office');
  const source = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
  for (const key of ['cashshop_where_label', 'cashshop_owner_office']) {
    assert.equal(source.split(key).length - 1, 2, `${key} appears exactly twice (en + ur)`);
  }
});

// ------------------------------------------------------------ QC controller

function mockDom() {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', value: '',
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
    // innerHTML assignment replaces children, like the real DOM — the
    // chip renderer clears the host this way before re-rendering.
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v); if (html === '') el.children.length = 0; }
    });
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };
  getEl('quickCollectModal', 'dialog');
  const documentStub = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
  };
  return { getEl, documentStub };
}

function qcFixtureState() {
  const now = new Date();
  let state = createInitialState(['Cash Shop Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

async function withController(state, fn) {
  const { getEl, documentStub } = mockDom();
  const origDocument = globalThis.document;
  globalThis.document = documentStub;
  try {
    let current = state;
    const controller = setupQuickCollectModal({
      getState: () => current,
      onSaveState: (next) => { current = next; },
      onToast: () => {},
      onSelectCustomer: () => {},
      onEditCustomer: () => {}
    });
    await fn({ controller, getEl, getState: () => current });
  } finally {
    // The submit path schedules a ~60ms focus timer against `document`;
    // let it fire while the stub is still installed.
    await new Promise((resolve) => setTimeout(resolve, 130));
    globalThis.document = origDocument;
  }
}

const recordedMethods = (state) =>
  state.customers.flatMap((c) => c.bills.flatMap((b) => b.payments.map((p) => p.method)));

test('QC controller: sub-row shows for Cash with Owner Office default; Hassan Balla chip records the new method', async () => {
  await withController(qcFixtureState(), async ({ controller, getEl, getState }) => {
    controller.open('seed-001');
    const row = getEl('quickCollectShopRow');
    assert.equal(row.hidden, false, 'sub-row visible while Cash is selected');
    assert.equal(getEl('quickCollectShopLabel').textContent, 'Cash received at');

    const chips = getEl('quickCollectShopChips').children;
    assert.deepEqual(chips.map((c) => c.getAttribute('data-shop-method')),
      ['Cash', 'Cash at Waseem Abbasi shop', 'Cash at Hassan Balla shop']);
    assert.deepEqual(chips.map((c) => c.textContent),
      ['Owner Office', 'Waseem Abbasi Shop', 'Hassan Balla Shop']);
    assert.deepEqual(chips.map((c) => c.getAttribute('aria-checked')), ['true', 'false', 'false'],
      'Owner Office is the default selection');

    await chips[2].click();
    assert.equal(getEl('quickCollectMethodSelect').value, 'Cash at Hassan Balla shop');
    assert.deepEqual(chips.map((c) => c.getAttribute('aria-checked')), ['false', 'false', 'true']);

    await getEl('quickCollectPaymentForm').dispatch('submit');
    assert.deepEqual(recordedMethods(getState()), ['Cash at Hassan Balla shop'],
      'the save records the unified shop method through executeQuickCollection');
  });
});

test('QC controller: untouched chips record plain Cash (Owner Office); Waseem chip records its shop method', async () => {
  await withController(qcFixtureState(), async ({ controller, getEl, getState }) => {
    controller.open('seed-001');
    await getEl('quickCollectPaymentForm').dispatch('submit');
    assert.deepEqual(recordedMethods(getState()), ['Cash']);
  });

  await withController(qcFixtureState(), async ({ controller, getEl, getState }) => {
    controller.open('seed-001');
    const chips = getEl('quickCollectShopChips').children;
    await chips[1].click();
    assert.equal(getEl('quickCollectMethodSelect').value, 'Cash at Waseem Abbasi shop');
    await getEl('quickCollectPaymentForm').dispatch('submit');
    assert.deepEqual(recordedMethods(getState()), ['Cash at Waseem Abbasi shop']);
  });
});

test('QC controller: a non-Cash method hides the sub-row and records exactly as before', async () => {
  await withController(qcFixtureState(), async ({ controller, getEl, getState }) => {
    controller.open('seed-001');
    const methodSelect = getEl('quickCollectMethodSelect');
    methodSelect.value = 'JazzCash';
    await methodSelect.dispatch('change');
    assert.equal(getEl('quickCollectShopRow').hidden, true, 'sub-row hides for non-Cash methods');

    getEl('quickCollectTransactionIdInput').value = 'TID-SYNTH-001';
    await getEl('quickCollectPaymentForm').dispatch('submit');
    assert.deepEqual(recordedMethods(getState()), ['JazzCash'], 'non-Cash recording untouched');

    // Re-selecting Cash brings the row back with the Owner Office default.
    controller.open('seed-001');
    methodSelect.value = 'Cash';
    await methodSelect.dispatch('change');
    assert.equal(getEl('quickCollectShopRow').hidden, false);
    const chips = getEl('quickCollectShopChips').children;
    assert.deepEqual(chips.map((c) => c.getAttribute('aria-checked')), ['true', 'false', 'false']);
  });
});

// ------------------------------------------------------------ wiring

test('wiring: markup hosts, token-only CSS, and the module seams are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="quickCollectShopRow"'), 'sub-row host exists in the QC form');
  assert.ok(html.includes('id="quickCollectShopChips"'), 'chip host exists in the QC form');

  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qc.includes('export function quickCollectShopChoices'), 'choices helper exported');
  assert.ok(qc.includes("from './shop-settlement.js'"), 'derivation seam imported from shop-settlement');
  assert.ok(qc.includes('renderShopChips()'), 'form open renders the chips');

  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const rowRule = css.match(/\.qc-shop-row \{[^}]*\}/);
  assert.ok(rowRule, 'qc-shop-row rule exists');
  const chipRule = css.match(/\.qc-shop-chip \{[^}]*\}/);
  assert.ok(chipRule, 'qc-shop-chip rule exists');
  assert.ok(!/#[0-9a-fA-F]{3,8}|rgba?\(/.test(chipRule[0]), 'qc-shop-chip uses theme tokens only');
  const activeRule = css.match(/\.qc-shop-chip\.is-active \{[^}]*\}/);
  assert.ok(activeRule, 'qc-shop-chip active rule exists');
  assert.ok(!/#[0-9a-fA-F]{3,8}|rgba?\(/.test(activeRule[0]), 'qc-shop-chip active uses theme tokens only');

  // The resolver itself: both legacy mentions land on the one collector.
  assert.equal(resolveShopCollector('Cash', 'Balla shop'), 'Hassan Balla Shop');
  assert.equal(resolveShopCollector('Cash at Hassan Balla shop'), 'Hassan Balla Shop');
});
