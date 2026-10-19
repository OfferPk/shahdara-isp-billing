import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIELD_ROUTE_OUTCOMES_KEY,
  FIELD_ROUTE_ORDER_KEY,
  COLLECTION_PROMISES_STORAGE_KEY,
  FIELD_ROUTE_OUTCOMES,
  getFieldRouteOutcomes,
  saveFieldRouteOutcome,
  getFieldRouteCustomOrder,
  saveFieldRouteCustomOrder,
  moveRouteStop,
  calculateFieldCollectionRoutes,
  generateFieldRouteManifestText
} from '../nav-collection-rounds.js';

import {
  DAILY_CASH_HANDOVERS_KEY,
  getDailyCashHandovers,
  calculateCollectorCashExpected,
  recordCashHandover,
  generateHandoverSlipText,
  generateHandoverWhatsAppText,
  generateHandoverPrintHtml
} from '../dashboard-daily-closing.js';

import { STORAGE_KEYS_CATALOG } from '../qa-backup-csv-import.js';

test('Issue #221 - Nav & Field Collection: Visit Outcomes and Reordering', async (t) => {
  await t.test('constants and outcomes enum are well-defined', () => {
    assert.equal(FIELD_ROUTE_OUTCOMES_KEY, 'shahdara_field_route_outcomes');
    assert.equal(FIELD_ROUTE_ORDER_KEY, 'shahdara_field_route_order');
    assert.equal(COLLECTION_PROMISES_STORAGE_KEY, 'shahdara_collection_promises_v1');
    assert.equal(FIELD_ROUTE_OUTCOMES.PENDING, 'pending');
    assert.equal(FIELD_ROUTE_OUTCOMES.PAID, 'paid');
    assert.equal(FIELD_ROUTE_OUTCOMES.PARTIAL, 'partial');
    assert.equal(FIELD_ROUTE_OUTCOMES.PROMISED, 'promised');
    assert.equal(FIELD_ROUTE_OUTCOMES.NOT_HOME, 'not_home');
    assert.equal(FIELD_ROUTE_OUTCOMES.REFUSED, 'refused');
  });

  await t.test('getFieldRouteOutcomes returns empty or structured records', () => {
    const mockStorage = {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); }
    };

    const empty = getFieldRouteOutcomes(mockStorage, '2026-10-19');
    assert.deepEqual(empty, {});

    mockStorage.setItem(FIELD_ROUTE_OUTCOMES_KEY, JSON.stringify({
      '2026-10-19': {
        'cust-1': { outcome: 'paid', amount: 2000 }
      }
    }));
    const loaded = getFieldRouteOutcomes(mockStorage, '2026-10-19');
    assert.equal(loaded['cust-1'].outcome, 'paid');
    assert.equal(loaded['cust-1'].amount, 2000);
  });

  await t.test('saveFieldRouteOutcome records visit and syncs promises and collected stops', () => {
    const mockStorage = {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); }
    };

    // 1. Save "promised" outcome with promiseDate
    const res1 = saveFieldRouteOutcome('cust-101', {
      outcome: 'promised',
      promiseDate: '2026-10-25',
      promiseAmount: 1500,
      visitNote: 'Shopkeeper said owner arrives on Sunday',
      customerName: 'Tariq Mehmood',
      phone: '03001234567'
    }, mockStorage, '2026-10-19');

    assert.equal(res1.outcome, 'promised');
    assert.equal(res1.promiseDate, '2026-10-25');

    // Verify synced into COLLECTION_PROMISES_STORAGE_KEY
    const promisesRaw = mockStorage.getItem(COLLECTION_PROMISES_STORAGE_KEY);
    assert.ok(promisesRaw);
    const promises = JSON.parse(promisesRaw);
    const matched = promises.find(p => p.customerId === 'cust-101');
    assert.ok(matched);
    assert.equal(matched.promisedDate, '2026-10-25');
    assert.equal(matched.promisedAmount, 1500);

    // 2. Save "paid" outcome
    const res2 = saveFieldRouteOutcome('cust-102', {
      outcome: 'paid',
      amount: 2500,
      visitNote: 'Paid full cash at shop'
    }, mockStorage, '2026-10-19');

    assert.equal(res2.outcome, 'paid');
    const outcomes = getFieldRouteOutcomes(mockStorage, '2026-10-19');
    assert.equal(outcomes['cust-102'].outcome, 'paid');
    assert.equal(outcomes['cust-102'].visitNote, 'Paid full cash at shop');
  });

  await t.test('custom route order: get, save, and moveRouteStop', () => {
    const mockStorage = {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); }
    };

    assert.deepEqual(getFieldRouteCustomOrder('Main Bazaar', mockStorage), []);

    saveFieldRouteCustomOrder('Main Bazaar', ['cust-1', 'cust-2', 'cust-3'], mockStorage);
    assert.deepEqual(getFieldRouteCustomOrder('Main Bazaar', mockStorage), ['cust-1', 'cust-2', 'cust-3']);

    // Move cust-2 UP
    const movedUp = moveRouteStop('cust-2', 'up', 'Main Bazaar', ['cust-1', 'cust-2', 'cust-3'], mockStorage);
    assert.deepEqual(movedUp, ['cust-2', 'cust-1', 'cust-3']);

    // Move cust-2 DOWN
    const movedDown = moveRouteStop('cust-2', 'down', 'Main Bazaar', movedUp, mockStorage);
    assert.deepEqual(movedDown, ['cust-1', 'cust-2', 'cust-3']);
  });

  await t.test('calculateFieldCollectionRoutes attaches outcomes and supports outcome filtering & manual sort', () => {
    const state = {
      customers: [
        { id: 'c1', name: 'Zahid Khan', area: 'Bazaar', balance: 2000, phone: '03001111111' },
        { id: 'c2', name: 'Ali Raza', area: 'Bazaar', balance: 1500, phone: '03002222222' },
        { id: 'c3', name: 'Imran Shah', area: 'Bazaar', balance: 3000, phone: '03003333333' }
      ],
      packages: [{ id: 'p1', name: 'Standard 10M', price: 2000 }],
      billing: []
    };

    const mockStorage = {
      store: {
        [FIELD_ROUTE_OUTCOMES_KEY]: JSON.stringify({
          '2026-10-19': {
            'c1': { outcome: 'paid', amount: 2000 },
            'c2': { outcome: 'promised', promiseDate: '2026-10-22', promiseAmount: 1500, visitNote: 'Will pay Tuesday' },
            'c3': { outcome: 'not_home', visitNote: 'House locked' }
          }
        }),
        [FIELD_ROUTE_ORDER_KEY]: JSON.stringify({
          'Bazaar': ['c3', 'c1', 'c2']
        })
      },
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); }
    };

    // Calculate all stops with manual sort
    const result = calculateFieldCollectionRoutes(state, {
      sectorFilter: 'Bazaar',
      sortBy: 'manual',
      storage: mockStorage,
      dateStr: '2026-10-19'
    });

    assert.equal(result.totalStops, 3);
    assert.equal(result.outcomesCount.paid, 1);
    assert.equal(result.outcomesCount.promised, 1);
    assert.equal(result.outcomesCount.not_home, 1);
    assert.equal(result.outcomesCount.pending, 0);

    // Order should match manual sort: c3, c1, c2
    assert.equal(result.stops[0].id, 'c3');
    assert.equal(result.stops[0].outcome, 'not_home');
    assert.equal(result.stops[1].id, 'c1');
    assert.equal(result.stops[1].outcome, 'paid');
    assert.equal(result.stops[2].id, 'c2');
    assert.equal(result.stops[2].outcome, 'promised');

    // Filter by outcome = promised
    const promisedFilter = calculateFieldCollectionRoutes(state, {
      sector: 'Bazaar',
      filterTab: 'promised',
      storage: mockStorage,
      dateStr: '2026-10-19'
    });
    assert.equal(promisedFilter.totalStops, 1);
    assert.equal(promisedFilter.stops[0].id, 'c2');

    // Test text manifest formatting
    const manifest = generateFieldRouteManifestText(result, { urdu: true });
    assert.ok(manifest.includes('Zahid Khan'));
    assert.ok(manifest.includes('[PAID]'));
    assert.ok(manifest.includes('[PROMISED'));
    assert.ok(manifest.includes('[NOT HOME]'));
  });
});

test('Issue #221 - Dashboard: End-of-Day Collector Cash Handover with Variance & Anti-Tamper', async (t) => {
  await t.test('constants and storage format for cash handovers', () => {
    assert.equal(DAILY_CASH_HANDOVERS_KEY, 'shahdara_daily_cash_handovers_v1');
    const mockStorage = {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); }
    };
    assert.deepEqual(getDailyCashHandovers(mockStorage, '2026-10-19'), []);
  });

  await t.test('calculateCollectorCashExpected aggregates cash receipts for specific collector or overall', () => {
    const state = {
      billing: [
        {
          id: 'b1',
          date: '2026-10-19',
          paymentMethod: 'cash',
          collectorName: 'Hamza Field',
          payments: [
            { id: 'p1', date: '2026-10-19', amount: 2000, method: 'cash', collector: 'Hamza Field' },
            { id: 'p2', date: '2026-10-19', amount: 1500, method: 'cash', collector: 'Hamza Field' }
          ]
        },
        {
          id: 'b2',
          date: '2026-10-19',
          paymentMethod: 'cash',
          collectorName: 'Bilal Office',
          payments: [
            { id: 'p3', date: '2026-10-19', amount: 5000, method: 'cash', collector: 'Bilal Office' }
          ]
        },
        {
          id: 'b3',
          date: '2026-10-19',
          paymentMethod: 'jazzcash',
          collectorName: 'Hamza Field',
          payments: [
            { id: 'p4', date: '2026-10-19', amount: 1000, method: 'jazzcash', collector: 'Hamza Field' } // digital should be excluded from cash
          ]
        }
      ]
    };

    const hamzaExpected = calculateCollectorCashExpected(state, '2026-10-19', 'Hamza Field');
    assert.equal(hamzaExpected.expectedCash, 3500);
    assert.equal(hamzaExpected.receiptCount, 2);

    const bilalExpected = calculateCollectorCashExpected(state, '2026-10-19', 'Bilal Office');
    assert.equal(bilalExpected.expectedCash, 5000);
    assert.equal(bilalExpected.receiptCount, 1);

    const allExpected = calculateCollectorCashExpected(state, '2026-10-19', 'All Physical Cash / General Till');
    assert.equal(allExpected.expectedCash, 8500);
    assert.equal(allExpected.receiptCount, 3);
  });

  await t.test('recordCashHandover calculates variance and flags shortage, surplus, or balanced', () => {
    const mockStorage = {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); }
    };

    // 1. Shortage (counted 3200 vs expected 3500)
    const recShortage = recordCashHandover({
      date: '2026-10-19',
      collectorName: 'Hamza Field',
      expectedCash: 3500,
      countedCash: 3200,
      handedOverTo: 'Usman Owner',
      notes: 'Late evening handover'
    }, mockStorage);

    assert.equal(recShortage.success, true);
    assert.equal(recShortage.handover.variance, -300);
    assert.equal(recShortage.handover.status, 'shortage');
    assert.equal(recShortage.handover.countedCash, 3200);

    // 2. Prevent silent edit on signed-off handover without correctionReason
    const attemptSilentEdit = recordCashHandover({
      date: '2026-10-19',
      collectorName: 'Hamza Field',
      expectedCash: 3500,
      countedCash: 3500,
      isCorrection: true
    }, mockStorage);

    assert.equal(attemptSilentEdit.success, false);
    assert.ok(attemptSilentEdit.error.includes('Correction reason is mandatory'));

    // 3. Edit with correctionReason succeeds and records audited correction
    const recCorrection = recordCashHandover({
      date: '2026-10-19',
      collectorName: 'Hamza Field',
      expectedCash: 3500,
      countedCash: 3500,
      handedOverTo: 'Usman Owner',
      isCorrection: true,
      correctionReason: 'Found PKR 300 pocket note that was miscounted'
    }, mockStorage);

    assert.equal(recCorrection.success, true);
    assert.equal(recCorrection.isCorrection, true);
    assert.equal(recCorrection.handover.variance, 0);
    assert.equal(recCorrection.handover.status, 'balanced');
    assert.equal(recCorrection.handover.corrections.length, 1);
    assert.equal(recCorrection.handover.corrections[0].reason, 'Found PKR 300 pocket note that was miscounted');
    assert.equal(recCorrection.handover.corrections[0].previousCounted, 3200);
    assert.equal(recCorrection.handover.corrections[0].newCounted, 3500);
  });

  await t.test('generateHandoverSlipText, generateHandoverWhatsAppText, and generateHandoverPrintHtml format complete reports', () => {
    const handover = {
      id: 'handover-test-1',
      date: '2026-10-19',
      collectorName: 'Hamza Field',
      expectedCash: 3500,
      countedCash: 3400,
      variance: -100,
      status: 'shortage',
      handedOverTo: 'Usman Owner',
      notes: 'Pending 100 Rs from customer shop change',
      signedAt: '2026-10-19T18:30:00.000Z',
      corrections: []
    };

    const slip = generateHandoverSlipText(handover);
    assert.ok(slip.includes('SHAHDARA ISP'));
    assert.ok(slip.includes('Hamza Field'));
    assert.ok(slip.includes('Expected Cash: PKR 3,500'));
    assert.ok(slip.includes('Physical Counted: PKR 3,400'));
    assert.ok(slip.includes('[SHORTAGE]'));
    assert.ok(slip.includes('Handed Over To: Usman Owner'));

    const whatsapp = generateHandoverWhatsAppText(handover);
    assert.ok(whatsapp.includes('CASH HANDOVER AUDIT'));
    assert.ok(whatsapp.includes('Hamza Field'));
    assert.ok(whatsapp.includes('شارٹیج'));

    const html = generateHandoverPrintHtml(handover);
    assert.ok(html.includes('DAILY CASH HANDOVER SLIP'));
    assert.ok(html.includes('80mm thermal / A4'));
    assert.ok(html.includes('Collector Signature'));
    assert.ok(html.includes('Receiver Signature'));
  });

  await t.test('backup catalog includes new handover and field route storage keys', () => {
    const registeredKeys = STORAGE_KEYS_CATALOG.map(item => item.key);
    assert.ok(registeredKeys.includes('shahdara_field_route_outcomes'), 'catalog must include shahdara_field_route_outcomes');
    assert.ok(registeredKeys.includes('shahdara_field_route_order'), 'catalog must include shahdara_field_route_order');
    assert.ok(registeredKeys.includes('shahdara_daily_cash_handovers_v1'), 'catalog must include shahdara_daily_cash_handovers_v1');
  });
});
