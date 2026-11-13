import test from 'node:test';
import assert from 'node:assert/strict';
import { updateNavigationBadges } from '../nav.js';

test('updateNavigationBadges synchronizes collection and dues badge with pending ledger dues', () => {
  // Sharafat 10 (2026-11-13): the badge's overdue count comes from
  // the Quick Collect picker pool, which now SKIPS damaged records
  // (parent decision) — so these fixtures must be healthy records:
  // a customer without a number is damaged and no longer counts as
  // overdue. The numbers below only make the fixtures realistic; the
  // badge arithmetic the test pins is unchanged.
  const state = {
    settings: { currency: 'PKR', defaultPaymentDueDays: 10 },
    plans: [
      { id: 'p1', name: 'Standard 20M', speed: '20 Mbps', price: 1000 }
    ],
    customers: [
      {
        id: 'cust-1',
        name: 'Tariq Mehmood',
        customerNumber: 1,
        archived: false,
        status: 'active',
        planId: 'p1',
        bills: [
          { id: 'b1', month: '2026-10', amount: 1000, dueAmount: 1000, status: 'unpaid' }
        ]
      },
      {
        id: 'cust-2',
        name: 'Asim Raza',
        customerNumber: 2,
        archived: false,
        status: 'active',
        planId: 'p1',
        bills: [
          { id: 'b2', month: '2026-10', amount: 1000, dueAmount: 1000, status: 'unpaid' }
        ]
      },
      {
        id: 'cust-3',
        name: 'Zahid Khan',
        customerNumber: 3,
        archived: false,
        status: 'active',
        planId: 'p1',
        bills: [
          { id: 'b3', month: '2026-10', amount: 1000, dueAmount: 1000, status: 'unpaid' }
        ]
      }
    ],
    payments: []
  };

  // 1. Initial state: 3 customers with unpaid bills -> 3 pending
  const badgesBefore = updateNavigationBadges(state);
  assert.equal(badgesBefore.overdueCount, 3);
  assert.equal(badgesBefore.fieldRoutePendingCount, 3);

  // 2. Record payment on cust-1 bill (PKR 1000). Notice bill.status is NOT changed
  state.customers[0].bills[0].payments = [
    { id: 'pay-1', amount: 1000, date: '2026-10-18', method: 'cash' }
  ];

  // Badge should now accurately drop to 2
  const badgesAfterOnePay = updateNavigationBadges(state);
  assert.equal(badgesAfterOnePay.overdueCount, 2);

  // 3. Record payment for cust-2 and cust-3
  state.customers[1].bills[0].payments = [
    { id: 'pay-2', amount: 1000, date: '2026-10-18', method: 'cash' }
  ];
  state.customers[2].bills[0].payments = [
    { id: 'pay-3', amount: 1000, date: '2026-10-18', method: 'cash' }
  ];

  // Badge should now drop to 0
  const badgesAfterAllPaid = updateNavigationBadges(state);
  assert.equal(badgesAfterAllPaid.overdueCount, 0);
});

test('updateNavigationBadges falls back safely when state lacks ledger structure', () => {
  // Sharafat 10 (2026-11-13): same as the test above — the overdue
  // count comes from the picker pool, which now skips damaged
  // records, so the minimal mock still needs a name, a number and a
  // bill month; the fallback behaviour pinned below is unchanged.
  const minimalMockState = {
    customers: [
      { id: 'c1', name: 'Zahid', customerNumber: 1, archived: false, bills: [{ month: '2026-11', dueAmount: 500, status: 'pending' }] },
      { id: 'c2', name: 'Kashif', customerNumber: 2, archived: false, bills: [{ month: '2026-11', dueAmount: 0, status: 'paid' }] }
    ]
  };

  const result = updateNavigationBadges(minimalMockState);
  assert.equal(result.overdueCount, 1);
});
