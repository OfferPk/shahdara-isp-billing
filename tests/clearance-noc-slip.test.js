// SISP-140: Disconnected Customer Final Account & Hardware Clearance
// Slip (Clearance NOC / بے باق سرٹیفکیٹ). Pure-builder + wiring tests on
// synthetic data only.
// Spec criteria (verbatim): enable the Print Clearance NOC action when
// "archived === true, pendingBalance === 0, and all ISP-owned hardware
// is returned"; unit tests "verifying blocker rules when balance > 0 or
// ISP router is unreturned".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assessClearanceNoc,
  buildClearanceNocSlip,
  clearanceNocFigures,
  clearanceNocPresentation,
  generateClearanceNocSlipHtml
} from '../clearance-noc-slip.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const ISSUE_DATE = '2026-10-30';

// Fully cleared synthetic customer: archived, two priced bills both
// paid in full, both ISP-owned items recovered.
const clearedCustomer = (overrides = {}) => ({
  id: 'cust-noc-1',
  customerNumber: 51,
  name: 'Test Customer 51',
  mohalla: 'Test Mohalla',
  connectionDate: '2025-03-01',
  archived: true,
  archivedAt: '2026-10-05T10:00',
  routerOwnership: 'isp-owned',
  mediaConverterOwnership: 'isp-owned',
  hardwareRecovered: { router: '2026-10-06', mediaConverter: '2026-10-07' },
  securityDeposit: null,
  bills: [
    { id: 'bill-aug', month: '2026-08', dueAmount: 3000, status: 'paid', payments: [{ id: 'p-aug', date: '2026-08-04', amount: 3000, method: 'Cash' }] },
    { id: 'bill-sep', month: '2026-09', dueAmount: 3000, status: 'paid', payments: [{ id: 'p-sep', date: '2026-09-03', amount: 3000, method: 'Cash' }] }
  ],
  ...overrides
});

const billedTicket = (overrides = {}) => ({
  id: 'TKT-101',
  customerId: 'cust-noc-1',
  status: 'Resolved',
  resolvedAt: '2026-09-10T12:00',
  billingType: 'billed',
  chargePaid: false,
  materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 700 }],
  ...overrides
});

test('eligible case: archived + zero balance + all ISP hardware returned', () => {
  const customer = clearedCustomer();
  const assessment = assessClearanceNoc(customer);
  assert.equal(assessment.visible, true);
  assert.equal(assessment.eligible, true);
  assert.deepEqual(assessment.blockers, []);
  assert.equal(assessment.figures.outstanding, 0);
  assert.equal(assessment.figures.totalBilled, 6000);
  assert.equal(assessment.figures.totalReceived, 6000);
  assert.equal(assessment.figures.billCount, 2);
  assert.equal(assessment.figures.lastBillMonth, '2026-09');
  assert.equal(assessment.returnedItems.length, 2);
  const pres = clearanceNocPresentation(customer);
  assert.equal(pres.visible, true);
  assert.equal(pres.eligible, true);
  assert.ok(pres.readyLabel.length > 0);
  assert.ok(pres.printLabel.length > 0);
});

test('slip model carries the real figures and dates', () => {
  const slip = buildClearanceNocSlip(clearedCustomer(), { issueDate: ISSUE_DATE });
  assert.ok(slip);
  assert.equal(slip.customerNumber, '51');
  assert.equal(slip.mohalla, 'Test Mohalla');
  assert.equal(slip.connectionDate, '2025-03-01');
  assert.equal(slip.disconnectedDate, '2026-10-05');
  assert.equal(slip.issueDate, ISSUE_DATE);
  assert.equal(slip.totalBilled, 6000);
  assert.equal(slip.totalReceived, 6000);
  assert.equal(slip.balanceDue, 0);
  assert.equal(slip.creditBalance, 0);
  assert.equal(slip.status, 'CLEARED');
  assert.deepEqual(slip.returnedItems.map((item) => item.key), ['router', 'mediaConverter']);
  assert.equal(slip.returnedItems[0].recoveredAt, '2026-10-06');
  const html = generateClearanceNocSlipHtml(slip, { businessName: 'Shahdara Fiber Net', businessPhone: '0300-0000000' });
  assert.match(html, /data-receipt-format="clearance-noc"/);
  assert.match(html, /Customer Name/);
  assert.match(html, /صارف کا نام/);
  assert.match(html, /Test Customer 51/);
  assert.match(html, /#51/);
  assert.match(html, /PKR 6,000/);
  assert.match(html, /2026-10-06/);
  assert.match(html, /Shahdara Fiber Net/);
  assert.match(html, /CLEARED/);
});

test('blocker: balance > 0 blocks with the exact outstanding figure', () => {
  const customer = clearedCustomer({
    bills: [
      { id: 'bill-sep', month: '2026-09', dueAmount: 3000, status: 'paid', payments: [{ id: 'p-sep', date: '2026-09-03', amount: 3000, method: 'Cash' }] },
      { id: 'bill-oct', month: '2026-10', dueAmount: 1500, status: 'pending', payments: [] }
    ]
  });
  const assessment = assessClearanceNoc(customer);
  assert.equal(assessment.eligible, false);
  assert.deepEqual(assessment.blockers, [{ kind: 'balance', amount: 1500 }]);
  const pres = clearanceNocPresentation(customer);
  assert.equal(pres.eligible, false);
  assert.equal(pres.blockerLabels.length, 1);
  assert.match(pres.blockerLabels[0], /1,500/);
  assert.equal(buildClearanceNocSlip(customer, { issueDate: ISSUE_DATE }), null);
});

test('blocker: unreturned ISP router blocks and names the item', () => {
  const customer = clearedCustomer({ hardwareRecovered: { router: null, mediaConverter: '2026-10-07' } });
  const assessment = assessClearanceNoc(customer);
  assert.equal(assessment.eligible, false);
  assert.equal(assessment.blockers.length, 1);
  assert.equal(assessment.blockers[0].kind, 'hardware');
  assert.deepEqual(assessment.blockers[0].items, [{ key: 'router', label: 'Router' }]);
  const pres = clearanceNocPresentation(customer);
  assert.match(pres.blockerLabels[0], /Router/);
  assert.equal(buildClearanceNocSlip(customer, { issueDate: ISSUE_DATE }), null);
});

test('not archived: the action is not offered at all', () => {
  const customer = clearedCustomer({ archived: false, archivedAt: null });
  const assessment = assessClearanceNoc(customer);
  assert.equal(assessment.visible, false);
  assert.equal(assessment.eligible, false);
  const pres = clearanceNocPresentation(customer);
  assert.equal(pres.visible, false);
  assert.equal(buildClearanceNocSlip(customer, { issueDate: ISSUE_DATE }), null);
});

test('customer-owned hardware never blocks and never prints as returnable', () => {
  const customer = clearedCustomer({
    routerOwnership: 'customer-owned',
    mediaConverterOwnership: 'customer-owned',
    hardwareRecovered: { router: null, mediaConverter: null }
  });
  const assessment = assessClearanceNoc(customer);
  assert.equal(assessment.eligible, true);
  assert.equal(assessment.noIspHardware, true);
  const slip = buildClearanceNocSlip(customer, { issueDate: ISSUE_DATE });
  assert.ok(slip);
  assert.deepEqual(slip.returnedItems, []);
  const html = generateClearanceNocSlipHtml(slip, {});
  assert.match(html, /No ISP-owned hardware was issued/);
});

test('leftover advance credit is disclosed, never silently zeroed, and does not block', () => {
  const customer = clearedCustomer({
    bills: [
      { id: 'bill-sep', month: '2026-09', dueAmount: 3000, status: 'paid', payments: [{ id: 'p-sep', date: '2026-09-03', amount: 3500, method: 'Cash' }] }
    ]
  });
  const figures = clearanceNocFigures(customer);
  assert.equal(figures.outstanding, 0);
  assert.equal(figures.creditBalance, 500);
  const assessment = assessClearanceNoc(customer);
  assert.equal(assessment.eligible, true);
  const pres = clearanceNocPresentation(customer);
  assert.match(pres.creditLabel, /500/);
  const slip = buildClearanceNocSlip(customer, { issueDate: ISSUE_DATE });
  assert.equal(slip.creditBalance, 500);
  const html = generateClearanceNocSlipHtml(slip, {});
  assert.match(html, /Advance Credit Held/);
  assert.match(html, /PKR 500/);
});

test('pending billed ticket charges gate the NOC as their own named blocker', () => {
  const customer = clearedCustomer();
  const assessment = assessClearanceNoc(customer, { tickets: [billedTicket()] });
  assert.equal(assessment.eligible, false);
  assert.deepEqual(assessment.blockers, [{ kind: 'ticket-charges', amount: 700 }]);
  const paid = assessClearanceNoc(customer, { tickets: [billedTicket({ chargePaid: true })] });
  assert.equal(paid.eligible, true);
  const otherCustomer = assessClearanceNoc(customer, { tickets: [billedTicket({ customerId: 'cust-other' })] });
  assert.equal(otherCustomer.eligible, true);
});

test('voided payments never count as received (SISP-34)', () => {
  const customer = clearedCustomer({
    bills: [
      { id: 'bill-sep', month: '2026-09', dueAmount: 3000, status: 'pending', payments: [{ id: 'p-sep', date: '2026-09-03', amount: 3000, method: 'Cash', voided: true }] }
    ]
  });
  const figures = clearanceNocFigures(customer);
  assert.equal(figures.totalReceived, 0);
  assert.equal(figures.outstanding, 3000);
  assert.equal(assessClearanceNoc(customer).eligible, false);
});

test('security deposit is disclosed on the slip, unsettled or settled', () => {
  const held = buildClearanceNocSlip(clearedCustomer({ securityDeposit: 2000 }), { issueDate: ISSUE_DATE });
  assert.equal(held.depositHeld, 2000);
  assert.match(generateClearanceNocSlipHtml(held, {}), /Security Deposit Held/);
  const settled = buildClearanceNocSlip(clearedCustomer({
    securityDeposit: 0,
    depositSettlement: {
      settledAt: '2026-10-08', securityDeposit: 2000, arrearsOffset: 0,
      unrecoveredHardwareCharge: 0, hardwareCovered: 0, refundAmount: 2000,
      arrearsRemaining: 0, hardwareOutstanding: 0, receiptNumber: '', offsets: [], hardwareCharges: []
    }
  }), { issueDate: ISSUE_DATE });
  assert.equal(settled.depositHeld, 0);
  assert.deepEqual(settled.depositSettlement, { settledAt: '2026-10-08', refundAmount: 2000 });
  assert.match(generateClearanceNocSlipHtml(settled, {}), /Security Deposit Settled/);
});

test('read-only: assessment, slip build and HTML generation mutate nothing', () => {
  const customer = clearedCustomer({ securityDeposit: 2000 });
  const before = JSON.stringify(customer);
  assessClearanceNoc(customer, { tickets: [billedTicket()] });
  const slip = buildClearanceNocSlip(customer, { issueDate: ISSUE_DATE });
  generateClearanceNocSlipHtml(slip, {});
  clearanceNocPresentation(customer);
  assert.equal(JSON.stringify(customer), before);
});

test('i18n: every noc_* key exists in en + ur with matching placeholders; zero raw keys', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((key) => key.startsWith('noc_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((key) => key.startsWith('noc_')).sort();
  assert.ok(enKeys.length >= 25, `expected the SISP-140 keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys, enKeys);
  const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of enKeys) {
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);
    assert.notEqual(t(key, 'en'), key, `${key} resolves raw in en`);
    assert.notEqual(t(key, 'ur'), key, `${key} resolves raw in ur`);
  }
  // Mechanical audit: every t('...') call in the new module resolves.
  const source = readFileSync(new URL('../clearance-noc-slip.js', import.meta.url), 'utf8');
  const used = [...source.matchAll(/\bt\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  for (const key of new Set(used)) {
    assert.ok(key in TRANSLATIONS.en, `${key} missing in en`);
    assert.ok(key in TRANSLATIONS.ur, `${key} missing in ur`);
  }
});

test('blocker: unpaid manual baqaya blocks even with zero bill arrears (OWNER-LOAN gate)', () => {
  const customer = clearedCustomer({
    manualBaqaya: [{ id: 'MBQ-101', amount: 1500, date: '2026-09-15', note: 'Old dues', createdAt: '2026-09-15' }]
  });
  const figures = clearanceNocFigures(customer);
  assert.equal(figures.outstanding, 0);
  assert.equal(figures.manualBaqayaOutstanding, 1500);
  const assessment = assessClearanceNoc(customer);
  assert.equal(assessment.visible, true);
  assert.equal(assessment.eligible, false);
  assert.deepEqual(assessment.blockers, [{ kind: 'baqaya', amount: 1500 }]);
  const pres = clearanceNocPresentation(customer);
  assert.equal(pres.eligible, false);
  assert.equal(pres.blockerLabels.length, 1);
  assert.match(pres.blockerLabels[0], /1,500/);
  assert.equal(buildClearanceNocSlip(customer, { issueDate: ISSUE_DATE }), null);
});

test('manual baqaya settled by a stamped receipt clears the gate; voiding that receipt re-blocks', () => {
  const baqayaEntry = { id: 'MBQ-101', amount: 1500, date: '2026-09-15', note: 'Old dues', createdAt: '2026-09-15' };
  const settledCustomer = (paymentOverrides = {}) => clearedCustomer({
    manualBaqaya: [baqayaEntry],
    bills: [
      { id: 'bill-aug', month: '2026-08', dueAmount: 3000, status: 'paid', payments: [{ id: 'p-aug', date: '2026-08-04', amount: 3000, method: 'Cash' }] },
      { id: 'bill-sep', month: '2026-09', dueAmount: 3000, status: 'paid', payments: [{ id: 'p-sep', date: '2026-09-03', amount: 4500, method: 'Cash', manualBaqayaSettlements: [{ entryId: 'MBQ-101', amount: 1500 }], ...paymentOverrides }] }
    ]
  });
  const settled = settledCustomer();
  assert.equal(clearanceNocFigures(settled).outstanding, 0);
  assert.equal(clearanceNocFigures(settled).manualBaqayaOutstanding, 0);
  assert.equal(assessClearanceNoc(settled).eligible, true);
  assert.ok(buildClearanceNocSlip(settled, { issueDate: ISSUE_DATE }));
  const voided = settledCustomer({ voided: true });
  const voidedAssessment = assessClearanceNoc(voided);
  assert.equal(voidedAssessment.eligible, false);
  assert.ok(voidedAssessment.blockers.some((blocker) => blocker.kind === 'baqaya' && blocker.amount === 1500));
  assert.equal(buildClearanceNocSlip(voided, { issueDate: ISSUE_DATE }), null);
});

test('wiring: app.js imports the module, renders the section and wires the print button; module is not a build entry', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /from '\.\/clearance-noc-slip\.js'/);
  assert.match(appSource, /clearanceNocPresentation\(customer, \{ tickets: loadTickets\(\) \}\)/);
  assert.match(appSource, /profile-clearance-noc/);
  assert.match(appSource, /profileNocPrintBtn/);
  assert.match(appSource, /buildClearanceNocSlip\(customer, \{ tickets: loadTickets\(\), issueDate: getTodayDateString\(\) \}\)/);
  const buildSource = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.ok(!/ENTRY_FILES = \[[^\]]*clearance-noc-slip/.test(buildSource), 'module must not be a build entry (dist budget)');
});
