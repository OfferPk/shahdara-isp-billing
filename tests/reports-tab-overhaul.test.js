// Reports Tab overhaul: package normalisation, percent-change edges, the
// October close-vs-compare contradiction, and the Monthly Report
// "outstanding" filter + area field (Part 4A drill-down). Every fixture
// here is synthetic; no real customer names or phone numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalPackage } from '../phase3.js';
import {
  buildAreaBreakdowns,
  buildCustomerRankings,
  buildMohallaAnalytics,
  buildMonthToMonthComparison,
  describePercentChange,
} from '../owner-insights.js';
import { buildMonthlyReport, saveMonthlyClosing } from '../core.js';
import { formatReceiptMonthShort, pendingReceiptShortMonthLabel } from '../pending-receipt-month.js';

// 2026-11-15 12:00 PKT: current month 2026-11, previous 2026-10.
const REF = new Date(Date.UTC(2026, 10, 15, 7));
const bill = (overrides) => ({ payments: [], ...overrides });
const customer = (id, fields, bills) => ({ id, customerNumber: id, name: `Customer ${id}`, archived: false, ...fields, bills });

// --- Part 2(a): canonicalPackage folds case/spacing/slash variants --------
test('canonicalPackage folds bare speeds and Mbps/GB bundles to one label', () => {
  assert.equal(canonicalPackage('3Mbps / 100GB').label, '3 Mbps / 100GB');
  assert.equal(canonicalPackage('5Mbps / 150GB').label, '5 Mbps / 150GB');
  assert.equal(canonicalPackage('5Mbps / 200GB').label, '5 Mbps / 200GB');
  assert.equal(canonicalPackage('5Mbps/150GB').label, '5 Mbps / 150GB');
  assert.equal(canonicalPackage('5 Mbps / 150GB').label, '5 Mbps / 150GB');
  assert.equal(canonicalPackage('3Mbps').label, '3 Mbps');
  assert.equal(canonicalPackage('5mbps').label, '5 Mbps');
  assert.equal(canonicalPackage('15mbps').label, '15 Mbps');
  assert.equal(canonicalPackage('30mbps').label, '30 Mbps');
  assert.equal(canonicalPackage('10 Mbps').key, canonicalPackage('10mbps').key);
  assert.equal(canonicalPackage('5Mbps / 150GB').key, canonicalPackage('5 Mbps/150GB').key);
  assert.notEqual(canonicalPackage('3Mbps / 100GB').key, canonicalPackage('3 Mbps').key);
  // Existing pin: unrelated plan names keep distinct keys.
  assert.notEqual(canonicalPackage('Silver Plan').key, canonicalPackage('Silver-Plan').key);
});

test('compare package changes merge case/spacing variants into one row', () => {
  const state = {
    customers: [
      customer('c1', { packageSpeed: '5Mbps' }, [
        bill({ month: '2026-10', dueAmount: 1000, packageSnapshot: { label: '5Mbps' } }),
        bill({ month: '2026-11', dueAmount: 1000, packageSnapshot: { label: '5 Mbps' } }),
      ]),
      customer('c2', { packageSpeed: '5 Mbps' }, [
        bill({ month: '2026-10', dueAmount: 1000, packageSnapshot: { label: '5mbps' } }),
        bill({ month: '2026-11', dueAmount: 1000, packageSnapshot: { label: '5Mbps / 150GB' } }),
      ]),
      customer('c3', { packageSpeed: '5Mbps / 150GB' }, [
        bill({ month: '2026-11', dueAmount: 1000, packageSnapshot: { label: '5 Mbps / 150GB' } }),
      ]),
    ],
    expenses: [],
  };
  const comparison = buildMonthToMonthComparison(state, '2026-10', '2026-11', REF);
  const five = comparison.packageChanges.filter((row) => row.name === '5 Mbps');
  assert.equal(five.length, 1);
  assert.equal(five[0].from, 2);
  assert.equal(five[0].to, 1);
  const bundle = comparison.packageChanges.filter((row) => row.name === '5 Mbps / 150GB');
  assert.equal(bundle.length, 1);
  assert.equal(bundle[0].from, 0);
  assert.equal(bundle[0].to, 2);
  assert.ok(!comparison.packageChanges.some((row) => row.name === '5Mbps' || row.name === '5mbps'));
});

test('area breakdowns group package variants under one canonical label', () => {
  const state = {
    customers: [
      customer('c1', { area: 'Kishti' }, [
        bill({ month: '2026-10', dueAmount: 1000, packageSnapshot: { label: '10 Mbps' } }),
      ]),
      customer('c2', { area: 'Kishti' }, [
        bill({ month: '2026-10', dueAmount: 1000, packageSnapshot: { label: '10mbps' } }),
      ]),
    ],
    expenses: [],
  };
  const breakdowns = buildAreaBreakdowns(state, REF);
  const packages = breakdowns.packages.map((row) => row.name);
  assert.deepEqual(packages, ['10 Mbps']);
});

test('customer rankings match a package filter across case/spacing variants', () => {
  const state = {
    customers: [
      customer('c1', { packageSpeed: '5mbps' }, [
        bill({ month: '2026-10', dueAmount: 1000, payments: [{ date: '2026-10-06', amount: 1000, method: 'Cash' }] }),
      ]),
      customer('c2', { packageSpeed: '10 Mbps' }, [
        bill({ month: '2026-10', dueAmount: 1000, payments: [{ date: '2026-10-06', amount: 500, method: 'Cash' }] }),
      ]),
    ],
    expenses: [],
  };
  const ranked = buildCustomerRankings(state, { type: 'highest-paying', month: '2026-10', packageName: '5 Mbps' }, REF);
  assert.deepEqual(ranked.rows.map((row) => row.customerId), ['c1']);
});

// --- Part 2(b): percent-change edge cases ----------------------------------
test('describePercentChange: 0 to positive is New, extreme spikes show the absolute difference', () => {
  assert.equal(describePercentChange({ from: 0, to: 1, absoluteChange: 1, percentChange: null }, 'count'), 'New (+1)');
  assert.equal(describePercentChange({ from: 0, to: 31, absoluteChange: 31, percentChange: null }, 'count'), 'New (+31)');
  assert.equal(describePercentChange({ from: 0, to: 1000, absoluteChange: 1000, percentChange: null }, 'money'), 'New (+PKR 1,000)');
  assert.equal(describePercentChange({ from: 10, to: 60200, absoluteChange: 60190, percentChange: 601900 }, 'money'), '+PKR 60,190');
  assert.equal(describePercentChange({ from: 10, to: 60200, absoluteChange: 60190, percentChange: 601900 }, 'count'), '+60,190');
  assert.equal(describePercentChange({ from: 100, to: 101, absoluteChange: 1, percentChange: 1 }, 'count'), '+1%');
  assert.equal(describePercentChange({ from: 200, to: 100, absoluteChange: -100, percentChange: -50 }, 'count'), '-50%');
  assert.equal(describePercentChange({ from: 0, to: 61.6, absoluteChange: 61.6, percentChange: null }, 'rate'), 'New (+61.6%)');
  assert.equal(describePercentChange({ from: 0.1, to: 61.6, absoluteChange: 61.5, percentChange: 61500 }, 'rate'), '+61.5 pts');
  assert.equal(describePercentChange({ from: 5, to: 5, absoluteChange: 0, percentChange: 0 }, 'count'), '0%');
  assert.equal(describePercentChange({ from: null, to: 5, absoluteChange: null, percentChange: null }, 'count'), 'Not available');
});

// --- October contradiction: saved close vs live compare --------------------
// The October close froze billed 204,800 / collection 431,500 / pending
// 1,000 at 2026-11-01T00:36 PKT. After the close, one bill was repriced
// down by 13,000 and one 24,000 October receipt was voided, so the live
// ledger now says billed 191,800 / collection 407,500. Compare must show
// the frozen close for a closed month, never the drifted live figures.
function octoberFixture() {
  return {
    customers: [
      customer('a', {}, [
        bill({ month: '2026-10', dueAmount: 100000, payments: [{ date: '2026-10-05', amount: 100000, method: 'Cash' }] }),
      ]),
      customer('b', {}, [
        bill({ month: '2026-10', dueAmount: 50000, payments: [{ date: '2026-10-06', amount: 50000, method: 'Cash' }] }),
      ]),
      customer('c', {}, [
        bill({ month: '2026-10', dueAmount: 54800, payments: [{ date: '2026-10-07', amount: 53800, method: 'Easypaisa' }] }),
      ]),
      customer('d', {}, [
        bill({ month: '2026-09', dueAmount: 203700, payments: [{ date: '2026-10-08', amount: 203700, method: 'Cash' }] }),
      ]),
      customer('e', {}, [
        bill({ month: '2026-09', dueAmount: 24000, payments: [{ date: '2026-10-09', amount: 24000, method: 'Cash' }] }),
      ]),
      customer('f', {}, [
        bill({ month: '2026-11', dueAmount: 1000, payments: [{ date: '2026-11-06', amount: 500, method: 'Cash' }] }),
      ]),
    ],
    expenses: [{ date: '2026-10-10', amount: 15000 }],
  };
}

test('compare uses the saved close for a closed month, not the drifted live ledger', () => {
  const frozen = saveMonthlyClosing(octoberFixture(), '2026-10', new Date('2026-11-01T00:36:00+05:00'));
  const close = frozen.monthlyClosings.find((row) => row.month === '2026-10');
  assert.equal(close.billedAmount, 204800);
  assert.equal(close.collection, 431500);
  assert.equal(close.pending, 1000);
  // After the close: reprice one October bill down 13,000 and void one
  // 24,000 October receipt — the live ledger drifts, the close must not.
  const drifted = structuredClone(frozen);
  drifted.customers.find((c) => c.id === 'c').bills[0].dueAmount = 41800;
  drifted.customers.find((c) => c.id === 'e').bills[0].payments[0].voided = true;
  const comparison = buildMonthToMonthComparison(drifted, '2026-10', '2026-11', REF);
  assert.equal(comparison.monthA.source, 'saved-snapshot');
  assert.equal(comparison.monthA.billedAmount, 204800);
  assert.equal(comparison.monthA.collection, 431500);
  // The old code divided the snapshot's rupee pending by 100 and showed 10.
  assert.equal(comparison.monthA.outstanding, 1000);
  assert.equal(comparison.monthB.source, 'local-ledger');
  assert.equal(comparison.monthB.billedAmount, 1000);
  assert.equal(comparison.monthB.collection, 500);
});

test('live compare excludes voided payments, matching the close definition', () => {
  const state = octoberFixture();
  state.customers.find((c) => c.id === 'e').bills[0].payments[0].voided = true;
  const comparison = buildMonthToMonthComparison(state, '2026-10', '2026-11', REF);
  assert.equal(comparison.monthA.source, 'local-ledger');
  assert.equal(comparison.monthA.collection, 407500);
});

// --- Part 4B(2): the accordion section list -------------------------------
import { OPS_ACCORDION_SECTIONS } from '../ops-accordions.js';
import {
  customerNameOptions,
  collectorNameOptions,
  recordIdOptions,
  paymentIdOptions,
  billIdOptions,
  optionsHtml,
} from '../ops-id-selects.js';

test('ops accordions cover exactly the ten advanced tools', () => {
  assert.deepEqual(OPS_ACCORDION_SECTIONS.map((row) => row.heading), [
    'splitHeading', 'visitHeading', 'faultPartHeading', 'outageTypeHeading',
    'generatorFuelHeading', 'bankCreditHeading', 'guardHeading', 'settleHeading',
    'shiftHeading', 'balanceConfHeading',
  ]);
  assert.equal(new Set(OPS_ACCORDION_SECTIONS.map((row) => row.summary)).size, 10);
});

test('ops id selects build options from saved records', () => {
  assert.deepEqual(customerNameOptions([
    { id: 'c2', customerNumber: 2, name: 'Second Customer', mohalla: 'Barrian', archived: true },
    { id: 'c1', customerNumber: 1, name: 'First Customer', mohalla: 'Kishti' },
    { id: 'c3', customerNumber: 3, name: '  ', mohalla: 'Kishti' },
  ]).map((row) => row.value), ['First Customer', 'Second Customer']);
  assert.equal(customerNameOptions([{ id: 'c1', customerNumber: 1, name: 'First Customer', mohalla: 'Kishti' }])[0].label, '#1 First Customer (Kishti)');
  assert.deepEqual(collectorNameOptions(['Saad', 'saad', 'Saad', 'Nauman', ' ', null]).map((row) => row.value), ['Saad', 'Nauman', 'saad']);
  assert.deepEqual(recordIdOptions(
    [{ id: 'V-1', customer: 'First Customer', date: '2026-11-10', dayPart: 'morning' }, { id: '', customer: 'Nobody' }],
    (record) => `${record.id} — ${record.customer} · ${record.date}`,
  ), [{ value: 'V-1', label: 'V-1 — First Customer · 2026-11-10' }]);
  // The clearance mark box is looked up by payment id, not by the
  // clearance record's own id, so the option value is the payment id.
  assert.deepEqual(recordIdOptions(
    [{ id: 'PC-1', paymentId: 'P-9', customer: 'First Customer', dateRecorded: '2026-11-05' }],
    (item) => `${item.paymentId} — ${item.customer}`,
    (item) => item.paymentId,
  ), [{ value: 'P-9', label: 'P-9 — First Customer' }]);
  const payments = paymentIdOptions([
    { id: 'P-2', amount: 500, date: '2026-11-09', method: 'Cash', customerName: 'Second Customer' },
    { id: 'P-1', amount: 1000, date: '2026-11-10', method: 'Easypaisa', customerName: 'First Customer' },
  ]);
  assert.equal(payments[0].value, 'P-1');
  assert.match(payments[0].label, /First Customer/);
  assert.deepEqual(billIdOptions([
    { id: 'c1', name: 'First Customer', bills: [{ id: 'B-1', month: '2026-11', dueAmount: 1000 }] },
    { id: 'c2', name: 'Second Customer', bills: [{ month: '2026-11', dueAmount: 1000 }] },
  ]), [{ value: 'B-1', label: 'B-1 — First Customer · 2026-11 · Rs. 1,000' }]);
  assert.equal(optionsHtml([{ value: 'a', label: 'A & B' }], '— Choose —'), '<option value="">— Choose —</option><option value="a">A &amp; B</option>');
  assert.equal(optionsHtml([{ value: 'a', label: 'A' }], null), '<option value="a">A</option>');
});

test('ops forms use dropdowns and weekday pills (Part 4B(3) structure)', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['clearancePaymentId', 'clearanceCustomer', 'clearanceBillId', 'clearanceMarkPaymentId', 'clearanceBillLookup', 'bankCreditMatchId', 'bankCreditMatchPayment', 'bankCreditMatchCustomer', 'bankCreditExplainId', 'balanceConfCustomer', 'splitCustomer', 'visitCustomer', 'visitDoneId', 'visitMissedId', 'visitReschedId', 'visitRemoveId', 'faultPartRemoveId', 'outageTypeRemoveId', 'generatorFuelRemoveId', 'guardEntryCustomer', 'guardApproveId', 'receiptSeriesReturnId', 'receiptSeriesBreakdownSeries']) {
    assert.ok(index.includes(`<select id="${id}"`), `${id} is a select`);
  }
  for (const id of ['settleCollector', 'visitCollector', 'faultPartTicket', 'receiptSeriesReissueTo', 'receiptSeriesCollector']) {
    assert.ok(index.includes(`<input id="${id}" type="text" list="`), `${id} keeps a text input with a datalist`);
  }
  assert.ok(index.includes('id="shiftWeekdayPills"'), 'weekday pills exist');
  assert.ok(index.includes('<input id="shiftRuleWeekdays" type="hidden"'), 'weekdays stay in the hidden input the save handler reads');
  assert.equal((index.match(/data-weekday="/g) ?? []).length, 7, 'seven weekday pills Sun–Sat');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './ops-accordions.js"), 'app imports the accordion module');
  assert.ok(app.includes("from './ops-id-selects.js"), 'app imports the id-select module');
  assert.ok(app.includes('setupOpsAccordions();'), 'accordions are wired at boot');
  assert.ok(app.includes('fillOpsIdSelects();'), 'ops renders fill the dropdowns');
  assert.ok(app.includes('syncShiftWeekdayPills();'), 'pills sync with the hidden value');
});

test('ops panels are overflow-safe and collapsible (Part 4B(1)(2) CSS)', () => {
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.analytics-panel { max-width: 100%; box-sizing: border-box; overflow-x: hidden; }'), 'sections are capped and clipped');
  assert.ok(css.includes('#collectorPerformanceBody { overflow-x: auto; }'), 'the wide collector table scrolls inside its card');
  assert.ok(css.includes('#analyticsView .phase3-pane > * { min-width: 0;'), 'pane children cannot stretch the grid track');
  assert.ok(css.includes('grid-template-columns: 1fr;'), 'form rows stack to one column on mobile');
  assert.ok(css.includes('.ops-accordion[data-collapsed="true"] > :not(.table-heading) { display: none !important; }'), 'collapsed cards hide their body');
  assert.ok(css.includes('.shift-weekday-pill.is-on { background: var(--color-success);'), 'closed weekday pills use the app success token');
});

// --- Part 4A: Monthly Report rows carry area + "outstanding" filter --------
test('buildMohallaAnalytics groups spelling variants and reports money per area', () => {
  const state = {
    customers: [
      customer('c1', { mohalla: 'Kishti', serviceStatus: 'active' }, [
        bill({ month: '2026-11', dueAmount: 1000, packageSnapshot: { label: '10 Mbps' }, payments: [{ date: '2026-11-06', amount: 1000, method: 'Cash' }] }),
      ]),
      customer('c2', { mohalla: 'Kishtii', serviceStatus: 'offline' }, [
        bill({ month: '2026-11', dueAmount: 2000, packageSnapshot: { label: '10mbps' }, payments: [{ date: '2026-11-06', amount: 500, method: 'Cash' }] }),
      ]),
      customer('c3', { mohalla: 'Charyaa', serviceStatus: 'active' }, [
        bill({ month: '2026-11', dueAmount: 1000, packageSnapshot: { label: '5 Mbps' }, payments: [] }),
      ]),
      customer('c4', { mohalla: 'Chamyaa', serviceStatus: 'active' }, [
        bill({ month: '2026-11', dueAmount: 1000, packageSnapshot: { label: '5mbps' }, payments: [{ date: '2026-11-06', amount: 1000, method: 'Cash' }] }),
      ]),
      customer('c5', { serviceStatus: 'active' }, [
        bill({ month: '2026-11', dueAmount: 3000, packageSnapshot: { label: '15 Mbps' }, payments: [] }),
      ]),
      customer('c6', { mohalla: 'Barrian', serviceStatus: 'active' }, [
        bill({ month: '2026-11', dueAmount: '', payments: [] }),
      ]),
    ],
    expenses: [],
  };
  const result = buildMohallaAnalytics(state, '2026-11', REF);
  assert.deepEqual(result.areas.map((row) => row.key), ['unassigned', 'kishtii', 'chamyaaa']);
  const kishtii = result.areas.find((row) => row.key === 'kishtii');
  assert.equal(kishtii.label, 'Kishtii');
  assert.equal(kishtii.customers, 2);
  assert.equal(kishtii.activeCustomers, 1);
  assert.equal(kishtii.offlineCustomers, 1);
  assert.equal(kishtii.billed, 3000);
  assert.equal(kishtii.collected, 1500);
  assert.equal(kishtii.outstanding, 1500);
  assert.equal(kishtii.collectionRate, 50);
  assert.equal(kishtii.popularPackage, '10 Mbps');
  assert.equal(kishtii.popularPackageCustomers, 2);
  const chamyaaa = result.areas.find((row) => row.key === 'chamyaaa');
  assert.equal(chamyaaa.customers, 2);
  assert.equal(chamyaaa.popularPackage, '5 Mbps');
  const unassigned = result.areas.find((row) => row.key === 'unassigned');
  assert.equal(unassigned.label, 'Unassigned / Not set');
  assert.equal(unassigned.customers, 1);
  assert.equal(unassigned.billed, 3000);
  // The unpriced Barrian bill adds no area group.
  assert.ok(!result.areas.some((row) => row.key === 'barrian'));
});

test('buildMonthlyReport rows carry the customer area and outstanding means pending or partial', () => {
  const state = {
    customers: [
      customer('c1', { mohalla: 'Kishti' }, [
        bill({ month: '2026-11', dueAmount: 1000, dueDate: '2026-11-05', payments: [] }),
      ]),
      customer('c2', { mohalla: 'Kishti' }, [
        bill({ month: '2026-11', dueAmount: 1000, dueDate: '2026-11-05', payments: [{ date: '2026-11-06', amount: 400, method: 'Cash' }] }),
      ]),
      customer('c3', { mohalla: 'Barrian' }, [
        bill({ month: '2026-11', dueAmount: 1000, dueDate: '2026-11-05', payments: [{ date: '2026-11-06', amount: 1000, method: 'Cash' }] }),
      ]),
    ],
    expenses: [],
  };
  const all = buildMonthlyReport(state, { month: '2026-11', statusFilter: 'all' }, REF);
  assert.deepEqual(all.map((row) => row.area), ['Kishti', 'Kishti', 'Barrian']);
  const outstanding = buildMonthlyReport(state, { month: '2026-11', statusFilter: 'outstanding' }, REF);
  assert.deepEqual(outstanding.map((row) => row.customerId), ['c1', 'c2']);
  assert.deepEqual(outstanding.map((row) => row.status), ['pending', 'partial']);
});

test('pendingReceiptShortMonthLabel: short label from the same derivation as the long one', () => {
  assert.equal(formatReceiptMonthShort('2026-11'), 'Nov 2026');
  assert.equal(formatReceiptMonthShort('2026-01'), 'Jan 2026');
  assert.equal(formatReceiptMonthShort('2026-13'), '');
  assert.equal(formatReceiptMonthShort(''), '');
  // Bill month first, payment date second, nothing when neither is usable.
  assert.equal(pendingReceiptShortMonthLabel({ month: '2026-11', date: '2026-10-05' }), 'Nov 2026');
  assert.equal(pendingReceiptShortMonthLabel({ month: '', date: '2026-10-05' }), 'Oct 2026');
  assert.equal(pendingReceiptShortMonthLabel({ month: '', date: '' }), '');
});
