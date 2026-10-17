import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTEGRITY_RULE_CODES,
  INTEGRITY_SEVERITY,
  normalizeCustomerNumber,
  scanDataIntegrity,
  previewDataIntegrityFixes,
  applyDataIntegrityFixes,
  renderDataIntegritySvg,
  generateDataIntegrityReportCsv,
  generateDataIntegrityCertHtml,
  formatDataIntegrityWhatsApp
} from '../qa-data-integrity.js';

test('normalizeCustomerNumber handles positive safe integers and rejects invalid values', () => {
  assert.equal(normalizeCustomerNumber(1), 1);
  assert.equal(normalizeCustomerNumber('42'), 42);
  assert.equal(normalizeCustomerNumber(999), 999);
  assert.equal(normalizeCustomerNumber(0), null);
  assert.equal(normalizeCustomerNumber(-5), null);
  assert.equal(normalizeCustomerNumber('abc'), null);
  assert.equal(normalizeCustomerNumber(null), null);
  assert.equal(normalizeCustomerNumber(undefined), null);
  assert.equal(normalizeCustomerNumber(''), null);
});

test('scanDataIntegrity audits clean state with 100% integrity score and zero issues', () => {
  const cleanState = {
    version: 1,
    nextCustomerNumber: 3,
    customers: [
      {
        id: 'cust-1',
        customerNumber: 1,
        name: 'Tariq Mahmood',
        monthlySellingAmount: 1500,
        bills: [
          {
            id: 'bill-1',
            month: '2026-01',
            dueAmount: 1500,
            status: 'paid',
            payments: [
              { id: 'pay-1', date: '2026-01-05', amount: 1500, receiptNumber: 'REC-2601-0001-1001' }
            ]
          }
        ]
      },
      {
        id: 'cust-2',
        customerNumber: 2,
        name: 'Usman Ali',
        monthlySellingAmount: 2000,
        bills: [
          {
            id: 'bill-2',
            month: '2026-01',
            dueAmount: 2000,
            status: 'pending',
            payments: []
          }
        ]
      }
    ]
  };

  const result = scanDataIntegrity(cleanState);
  assert.equal(result.totalIssues, 0);
  assert.equal(result.integrityScore, 100);
  assert.equal(result.healthStatus, 'clean');
  assert.equal(result.customerCount, 2);
  assert.equal(result.billCount, 2);
  assert.equal(result.paymentCount, 1);
  assert.equal(result.cleanEntities, 5);
});

test('scanDataIntegrity detects missing customer numbers, duplicate customer numbers, and unpriced bills', () => {
  const dirtyState = {
    version: 1,
    nextCustomerNumber: 10,
    customers: [
      {
        id: 'c1',
        customerNumber: null, // MISSING
        name: 'Aslam Khan',
        monthlySellingAmount: 1800,
        bills: []
      },
      {
        id: 'c2',
        customerNumber: 5,
        name: 'Bilal Ahmad',
        monthlySellingAmount: 2000,
        bills: [
          { id: 'b2', month: '2026-01', dueAmount: null, payments: [] } // UNPRICED BILL
        ]
      },
      {
        id: 'c3',
        customerNumber: 5, // DUPLICATE with c2
        name: 'Hamza Sheikh',
        monthlySellingAmount: 2500,
        bills: []
      }
    ]
  };

  const result = scanDataIntegrity(dirtyState);
  assert.ok(result.totalIssues >= 3);
  assert.ok(result.integrityScore < 100);

  const missingNumIssue = result.issues.find(i => i.code === INTEGRITY_RULE_CODES.MISSING_CUSTOMER_NUMBER);
  assert.ok(missingNumIssue);
  assert.equal(missingNumIssue.entityId, 'c1');

  const dupNumIssue = result.issues.find(i => i.code === INTEGRITY_RULE_CODES.DUPLICATE_CUSTOMER_NUMBER);
  assert.ok(dupNumIssue);
  assert.equal(dupNumIssue.entityId, 'c3');

  const unpricedBillIssue = result.issues.find(i => i.code === INTEGRITY_RULE_CODES.BILL_WITHOUT_AMOUNT);
  assert.ok(unpricedBillIssue);
  assert.equal(unpricedBillIssue.month, '2026-01');
});

test('scanDataIntegrity detects duplicate receipt numbers across multiple payments', () => {
  const state = {
    version: 1,
    customers: [
      {
        id: 'c1',
        customerNumber: 10,
        name: 'Client Alpha',
        bills: [
          {
            id: 'b1',
            month: '2026-01',
            dueAmount: 1500,
            payments: [
              { id: 'pay-same', date: '2026-01-04', amount: 1500, receiptNumber: 'REC-DUP-999' }
            ]
          }
        ]
      },
      {
        id: 'c2',
        customerNumber: 11,
        name: 'Client Beta',
        bills: [
          {
            id: 'b2',
            month: '2026-01',
            dueAmount: 1500,
            payments: [
              { id: 'pay-same', date: '2026-01-05', amount: 1500, receiptNumber: 'REC-DUP-999' } // DUPLICATE RECEIPT
            ]
          }
        ]
      }
    ]
  };

  const result = scanDataIntegrity(state);
  const dupReceipt = result.issues.find(i => i.code === INTEGRITY_RULE_CODES.DUPLICATE_RECEIPT_NUMBER);
  assert.ok(dupReceipt);
  assert.equal(dupReceipt.severity, INTEGRITY_SEVERITY.CRITICAL);
});

test('previewDataIntegrityFixes returns detailed planned mutations without modifying state', () => {
  const state = {
    version: 1,
    nextCustomerNumber: 20,
    customers: [
      {
        id: 'c1',
        customerNumber: null,
        name: 'Imran Ashraf',
        monthlySellingAmount: 1500,
        bills: [{ id: 'b1', month: '2026-02', dueAmount: null, payments: [] }]
      }
    ]
  };

  const scan = scanDataIntegrity(state);
  const previews = previewDataIntegrityFixes(state, scan);
  assert.equal(previews.length, 2);

  const numPreview = previews.find(p => p.code === INTEGRITY_RULE_CODES.MISSING_CUSTOMER_NUMBER);
  assert.ok(numPreview);
  assert.ok(numPreview.afterValue.startsWith('#'));

  const billPreview = previews.find(p => p.code === INTEGRITY_RULE_CODES.BILL_WITHOUT_AMOUNT);
  assert.ok(billPreview);
  assert.equal(billPreview.afterValue, 'PKR 1500');

  // Verify state was not mutated
  assert.equal(state.customers[0].customerNumber, null);
  assert.equal(state.customers[0].bills[0].dueAmount, null);
});

test('applyDataIntegrityFixes saves pre-repair snapshot and corrects data anomalies safely', () => {
  const store = new Map();
  const mockStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, val) { store.set(key, String(val)); },
    removeItem(key) { store.delete(key); }
  };

  const dirtyState = {
    version: 1,
    nextCustomerNumber: 50,
    customers: [
      {
        id: 'c1',
        customerNumber: null, // Needs assignment
        name: 'Zahid Javed',
        monthlySellingAmount: 2200,
        bills: [
          { id: 'b1', month: '2026-01', dueAmount: null, payments: [] } // Needs backfill
        ]
      },
      {
        id: 'c2',
        customerNumber: 15,
        name: 'Naveed Akhtar',
        monthlySellingAmount: 1800,
        bills: [
          {
            id: 'b2',
            month: '2026-01',
            dueAmount: -500, // Invalid negative due amount
            payments: [
              { id: 'pay-d1', date: '2026-01-05', amount: 1800, receiptNumber: 'REC-SHARED-1' }
            ]
          }
        ]
      },
      {
        id: 'c3',
        customerNumber: 15, // Duplicate customer number with c2
        name: 'Farhan Butt',
        monthlySellingAmount: 1800,
        bills: [
          {
            id: 'b3',
            month: '2026-01',
            dueAmount: 1800,
            payments: [
              { id: 'pay-d2', date: '2026-01-05', amount: 1800, receiptNumber: 'REC-SHARED-1' } // Duplicate receipt
            ]
          }
        ]
      }
    ]
  };

  const initialScan = scanDataIntegrity(dirtyState, { storage: mockStorage });
  assert.ok(initialScan.totalIssues >= 4);

  const fixResult = applyDataIntegrityFixes(dirtyState, initialScan, { storage: mockStorage });
  assert.equal(fixResult.success, true);
  assert.ok(fixResult.fixedCount >= 4);
  assert.ok(store.has(fixResult.backupKey)); // Pre-repair snapshot verified in storage

  const fixedState = fixResult.updatedState;

  // 1. Customer 1 has assigned number and positive bill dueAmount
  const fixedC1 = fixedState.customers.find(c => c.id === 'c1');
  assert.ok(Number.isSafeInteger(fixedC1.customerNumber));
  assert.equal(fixedC1.bills[0].dueAmount, 2200);

  // 2. Customer 2 negative due amount normalized to 0
  const fixedC2 = fixedState.customers.find(c => c.id === 'c2');
  assert.equal(fixedC2.bills[0].dueAmount, 0);

  // 3. Customer 3 duplicate number was resolved
  const fixedC3 = fixedState.customers.find(c => c.id === 'c3');
  assert.notEqual(fixedC3.customerNumber, fixedC2.customerNumber);

  // 4. Duplicate receipt was regenerated
  const fixedPayment = fixedC3.bills[0].payments[0];
  assert.notEqual(fixedPayment.receiptNumber, 'REC-SHARED-1');
  assert.ok(fixedPayment.receiptNumber.startsWith('REC-'));

  // 5. Subsequent scan on fixed state reports clean
  const secondScan = scanDataIntegrity(fixedState, { storage: mockStorage });
  assert.equal(secondScan.totalIssues, 0);
  assert.equal(secondScan.integrityScore, 100);
});

test('renderDataIntegritySvg generates pure-vector SVG markup with gauge and breakdown', () => {
  const scanResult = {
    integrityScore: 92,
    totalEntitiesScanned: 85,
    totalIssues: 2,
    criticalCount: 0,
    warningCount: 2,
    infoCount: 0,
    cleanEntities: 83,
    autoFixableCount: 2
  };

  const svg = renderDataIntegritySvg({ scanResult });
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('92%'));
  assert.ok(svg.includes('WARNINGS FOUND'));
  assert.ok(svg.includes('Warnings (2)'));
  assert.ok(svg.includes('</svg>'));
});

test('generateDataIntegrityReportCsv produces valid RFC-4180 CSV with UTF-8 BOM', () => {
  const scanResult = {
    issues: [
      {
        id: 'ISSUE-1',
        severity: 'critical',
        code: 'DUPLICATE_RECEIPT_NUMBER',
        entityType: 'payment',
        entityId: 'pay-123',
        customerNumber: 44,
        customerName: 'Shahid Mehmood',
        month: '2026-01',
        description: 'Duplicate receipt found',
        canAutoFix: true,
        fixDescription: 'Regenerate receipt number'
      }
    ]
  };

  const csv = generateDataIntegrityReportCsv(scanResult);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Issue ID,Severity,Rule Code'));
  assert.ok(csv.includes('DUPLICATE_RECEIPT_NUMBER'));
  assert.ok(csv.includes('Shahid Mehmood'));
});

test('generateDataIntegrityCertHtml generates A4 and 80mm printable templates', () => {
  const scanResult = {
    integrityScore: 98,
    scannedAt: '2026-10-18T03:30:00.000Z',
    totalEntitiesScanned: 120,
    totalIssues: 1,
    criticalCount: 0,
    warningCount: 1,
    cleanEntities: 119,
    issues: [
      {
        id: 'ISSUE-BWA-1',
        severity: 'warning',
        code: 'BILL_WITHOUT_AMOUNT',
        customerNumber: 12,
        customerName: 'Rashid Khan',
        entityType: 'bill',
        month: '2026-01',
        description: 'Unpriced bill',
        fixDescription: 'Backfill package rate'
      }
    ]
  };

  const a4Html = generateDataIntegrityCertHtml(scanResult, 'a4');
  assert.ok(a4Html.includes('DATABASE INTEGRITY AUDIT CERTIFICATE'));
  assert.ok(a4Html.includes('98%'));
  assert.ok(a4Html.includes('Rashid Khan'));

  const thermalHtml = generateDataIntegrityCertHtml(scanResult, 'thermal-80');
  assert.ok(thermalHtml.includes('DATA INTEGRITY AUDIT SLIP'));
  assert.ok(thermalHtml.includes('76mm'));
  assert.ok(thermalHtml.includes('98%'));
});

test('formatDataIntegrityWhatsApp produces bilingual message with key stats', () => {
  const scanResult = {
    integrityScore: 95,
    healthStatus: 'good',
    totalEntitiesScanned: 60,
    totalIssues: 1,
    criticalCount: 0,
    warningCount: 1,
    autoFixableCount: 1
  };

  const text = formatDataIntegrityWhatsApp(scanResult);
  assert.ok(text.includes('SHAHDARA BROADBAND - DATABASE INTEGRITY AUDIT REPORT'));
  assert.ok(text.includes('ڈیٹا انٹیگریٹی اور لیجر آڈٹ رپورٹ'));
  assert.ok(text.includes('95%'));
  assert.ok(text.includes('*Total Records Audited:* 60'));
});
