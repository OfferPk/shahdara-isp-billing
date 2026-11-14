import test from 'node:test';
import assert from 'node:assert/strict';

// Sharafat 42 — ageing silently drops bills older than 24 months, and its
// fallback reads the wrong amount field. The fix (parent decisions
// 2026-11-15 ~01:14 PKT): (D1) (a) EXCLUDE + LIST — old bills stay out of
// totals/buckets, the line names count + PKR; (D2) (a) HOUSE PATTERN
// bill.dueAmount || bill.amount || 0 at the fallback; (D3) (a) COUNT +
// AMOUNT — excludedBillsCount + excludedAmountPkr; (D4) (a) NEW index.html
// element + populateModal wiring, hidden when the count is 0; (D5) (a)
// ENGLISH-ONLY plain string, no new i18n key; (D6) (a) COUNT + PKR ONLY.
//
// Why literal bills, not saveBillMonth: checkMonth rejects any month outside
// the 24-month window, so an old bill cannot be saved through the producer
// at all — and the legacy amount-only bill has no producer (bills are created
// with dueAmount today). Literals bypass the producer, which is the point:
// they are the bills the live ledger already holds. Precedent: the Sharafat
// 37 tests push month-only bills the same way.

const refDate = new Date('2026-10-07T12:00:00+05:00');

async function buildState(specs) {
  const { calculateDuesAgingBreakdown, generateDuesAgingCsv, generateDuesAgingBriefing } =
    await import('../dashboard-dues-aging.js');
  const { createInitialState, addCustomer } = await import('../core.js');
  let state = createInitialState([]);
  for (const [index, spec] of specs.entries()) {
    state = addCustomer(state, spec.name, new Date('2026-06-01T10:00:00+05:00'), {
      monthlySellingAmount: 3000,
      phone: `0300111224${index}`,
      area: 'Saeed Park',
      mohalla: 'Main Bazaar'
    });
    const customer = state.customers[state.customers.length - 1];
    for (const bill of spec.bills) customer.bills.push(bill);
  }
  const agingData = calculateDuesAgingBreakdown(state, refDate);
  return {
    state,
    agingData,
    csv: generateDuesAgingCsv(agingData, refDate),
    briefing: generateDuesAgingBriefing(agingData, refDate)
  };
}

function bill(month, fields = {}) {
  return { month, status: 'pending', payments: [], ...fields };
}

test('Sharafat 42: a 30-month-old unpaid bill is excluded from totals and listed with its amount', async () => {
  const { agingData, csv, briefing } = await buildState([
    { name: 'Retention Test One', bills: [bill('2024-04', { dueAmount: 5000 })] }
  ]);
  // The old bill never reaches any total or bucket…
  assert.equal(agingData.totalOutstanding, 0);
  assert.equal(agingData.totalAccounts, 0);
  assert.equal(agingData.customers.length, 0);
  // …but it is named, with count + PKR, on every surface.
  assert.equal(agingData.excludedBillsCount, 1);
  assert.equal(agingData.excludedAmountPkr, 5000);
  assert.ok(csv.includes('Excluded: 1 bill outside the 24-month window (PKR 5,000)'));
  assert.ok(briefing.includes('Excluded: 1 bill outside the 24-month window (PKR 5,000)'));
});

test('Sharafat 42: the retention boundary is [current-23, current] — 24 months back is out, 23 back is in', async () => {
  const { agingData } = await buildState([
    { name: 'Retention Test One', bills: [bill('2024-10', { dueAmount: 4000 })] },
    { name: 'Retention Test Two', bills: [bill('2024-11', { dueAmount: 2000 })] }
  ]);
  assert.equal(agingData.excludedBillsCount, 1);
  assert.equal(agingData.excludedAmountPkr, 4000);
  assert.equal(agingData.totalOutstanding, 2000);
  assert.equal(agingData.customers.length, 1);
  assert.equal(agingData.customers[0].name, 'Retention Test Two');
  assert.equal(agingData.customers[0].totalDue, 2000);
});

test('Sharafat 42: a dueAmount-only bill ages at its dueAmount (regression guard)', async () => {
  const { agingData } = await buildState([
    { name: 'Retention Test One', bills: [bill('2026-09', { dueAmount: 3000 })] }
  ]);
  assert.equal(agingData.totalOutstanding, 3000);
  assert.equal(agingData.customers[0].totalDue, 3000);
  assert.equal(agingData.excludedBillsCount, 0);
});

test('Sharafat 42: a legacy amount-only bill ages at its amount, not 0', async () => {
  // The doc's bare bill.dueAmount swap would make this bill age at 0: the
  // fallback is the only path that reads bill.amount, and no bill producer
  // sets amount today — it survives only on legacy bills. The house pattern
  // keeps it. This test fails (0) under the bare swap.
  const { agingData } = await buildState([
    { name: 'Retention Test One', bills: [bill('2026-09', { amount: 3000 })] }
  ]);
  assert.equal(agingData.totalOutstanding, 3000);
  assert.equal(agingData.customers[0].totalDue, 3000);
  assert.equal(agingData.excludedBillsCount, 0);
});

test('Sharafat 42: a partially-paid old bill excludes its remaining balance; a fully-paid old bill is not counted', async () => {
  const { agingData } = await buildState([
    {
      name: 'Retention Test One',
      bills: [bill('2024-04', {
        dueAmount: 5000,
        payments: [{ id: 'pay-partial-1', amount: 2000, date: '2024-05-01', method: 'Cash' }]
      })]
    },
    {
      name: 'Retention Test Two',
      bills: [bill('2024-04', {
        dueAmount: 5000,
        payments: [{ id: 'pay-full-1', amount: 5000, date: '2024-05-01', method: 'Cash' }]
      })]
    }
  ]);
  assert.equal(agingData.totalOutstanding, 0);
  assert.equal(agingData.excludedBillsCount, 1);
  // Remaining balance (5000 − 2000), not the full dueAmount.
  assert.equal(agingData.excludedAmountPkr, 3000);
});

test('Sharafat 42: no old bills means no exclusion line anywhere', async () => {
  const { agingData, csv, briefing } = await buildState([
    { name: 'Retention Test One', bills: [bill('2026-09', { dueAmount: 3000 })] }
  ]);
  assert.equal(agingData.excludedBillsCount, 0);
  assert.equal(agingData.excludedAmountPkr, 0);
  assert.ok(!csv.includes('Excluded:'));
  assert.ok(!briefing.includes('Excluded:'));
});

test('Sharafat 42: the modal note shows count + PKR when bills are excluded and hides when none are', async () => {
  const { setupDuesAgingModal } = await import('../dashboard-dues-aging.js');
  const fs = await import('node:fs');
  const path = await import('node:path');

  // The new host element exists in the modal markup.
  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="duesAgingExcludedNote"'));

  // Mock document, mirroring the ageing suite's modal test.
  function openModalWith(specs) {
    return buildState(specs).then(({ state }) => {
      const mockElements = {
        duesAgingModal: {
          showModal: () => { mockElements.duesAgingModal.open = true; },
          close: () => { mockElements.duesAgingModal.open = false; },
          addEventListener: () => {},
          open: false
        },
        duesAgingSvgChart: { innerHTML: '' },
        duesAgingTableBody: { innerHTML: '', querySelectorAll: () => [] },
        duesAgingTotalOutstandingVal: { textContent: '' },
        duesAgingTotalAccountsVal: { textContent: '' },
        duesAgingCriticalDuesVal: { textContent: '' },
        duesAgingWeightedDaysVal: { textContent: '' },
        duesAgingRiskStatusBadge: { textContent: '', className: '' },
        duesAgingExcludedNote: { textContent: '', hidden: true },
        duesAgingSearchInput: { value: '', addEventListener: () => {} },
        duesAgingAreaSelect: { value: 'all', options: [{ value: 'all' }], appendChild: () => {}, addEventListener: () => {} },
        duesAgingBucketFilters: { querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {} },
        closeDuesAgingModalBtn: { addEventListener: () => {} },
        closeDuesAgingSecondaryBtn: { addEventListener: () => {} },
        duesAgingExportCsvBtn: { addEventListener: () => {} },
        duesAgingCopyBriefingBtn: { addEventListener: () => {} },
        duesAgingPrintBtn: { addEventListener: () => {} }
      };
      const originalDocument = globalThis.document;
      try {
        globalThis.document = {
          getElementById: (id) => mockElements[id] || null,
          querySelectorAll: () => []
        };
        const controller = setupDuesAgingModal(state, { referenceDate: refDate });
        controller.open();
        return mockElements.duesAgingExcludedNote;
      } finally {
        globalThis.document = originalDocument;
      }
    });
  }

  const excluded = await openModalWith([
    { name: 'Retention Test One', bills: [bill('2024-04', { dueAmount: 5000 })] }
  ]);
  assert.equal(excluded.hidden, false);
  assert.equal(excluded.textContent, 'Excluded: 1 bill outside the 24-month window (PKR 5,000)');

  const none = await openModalWith([
    { name: 'Retention Test One', bills: [bill('2026-09', { dueAmount: 3000 })] }
  ]);
  assert.equal(none.hidden, true);
  assert.equal(none.textContent, '');
});
