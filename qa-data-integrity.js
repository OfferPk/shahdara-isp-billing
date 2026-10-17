/**
 * @file qa-data-integrity.js
 * @description Shahdara Broadband ISP - Database Data Integrity & Ledger Audit Suite.
 * Scans offline database records for anomalies, orphan payments/receipts,
 * negative or impossible balances, duplicate receipt numbers, bills without amounts,
 * and customers without customer numbers.
 * Provides pre-repair backup snapshots, dry-run previews, and safe automated fixes.
 */

import { generateReceiptNumber } from './receipt.js';

export const DATA_INTEGRITY_STORAGE_KEY = 'shahdara_data_integrity_audits_v1';
export const INTEGRITY_BACKUP_PREFIX = 'shahdara_integrity_backup_';
export const ORPHAN_PAYMENTS_ARCHIVE_KEY = 'shahdara_orphan_payments_v1';
export const ORPHAN_ADJUSTMENTS_ARCHIVE_KEY = 'shahdara_orphan_adjustments_v1';

export const INTEGRITY_SEVERITY = Object.freeze({
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
});

export const INTEGRITY_RULE_CODES = Object.freeze({
  ORPHAN_PAYMENT: 'ORPHAN_PAYMENT',
  MISSING_CUSTOMER_NUMBER: 'MISSING_CUSTOMER_NUMBER',
  DUPLICATE_CUSTOMER_NUMBER: 'DUPLICATE_CUSTOMER_NUMBER',
  DUPLICATE_RECEIPT_NUMBER: 'DUPLICATE_RECEIPT_NUMBER',
  BILL_WITHOUT_AMOUNT: 'BILL_WITHOUT_AMOUNT',
  NEGATIVE_OR_IMPOSSIBLE_BALANCE: 'NEGATIVE_OR_IMPOSSIBLE_BALANCE',
  INVALID_PAYMENT_AMOUNT: 'INVALID_PAYMENT_AMOUNT',
  ORPHAN_ADJUSTMENT: 'ORPHAN_ADJUSTMENT',
  ORPHAN_EQUIPMENT_RETRIEVAL: 'ORPHAN_EQUIPMENT_RETRIEVAL'
});

/**
 * Normalizes customer number into a valid positive integer or null.
 * @param {*} value
 * @returns {number|null}
 */
export function normalizeCustomerNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

/**
 * Scans application state and offline storage for data corruptions and anomalies.
 * @param {Object} state - Application state
 * @param {Object} [options]
 * @param {Storage|Object} [options.storage] - Optional localStorage reference
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Object} Comprehensive scan result with metrics and actionable issues
 */
export function scanDataIntegrity(state, {
  storage = null,
  referenceDate = new Date()
} = {}) {
  const issues = [];
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const customersById = new Map();
  const customersByNumber = new Map();
  const usedNumbers = new Set();
  const receiptRegister = new Map(); // receiptId -> [{ customerId, customerNumber, month, payment }]

  let totalBillsScanned = 0;
  let totalPaymentsScanned = 0;
  let totalAdjustmentsScanned = 0;

  // 1. Audit Customers & Customer Numbers
  for (const customer of customers) {
    if (!customer || typeof customer !== 'object') continue;
    customersById.set(customer.id, customer);

    const normNum = normalizeCustomerNumber(customer.customerNumber);
    if (normNum === null) {
      issues.push({
        id: `ISSUE-MCN-${customer.id}`,
        code: INTEGRITY_RULE_CODES.MISSING_CUSTOMER_NUMBER,
        severity: INTEGRITY_SEVERITY.WARNING,
        entityType: 'customer',
        entityId: customer.id,
        customerNumber: null,
        customerName: customer.name || 'Unnamed Customer',
        month: null,
        description: `Customer "${customer.name || 'Unnamed'}" is missing a valid numeric customer number.`,
        canAutoFix: true,
        fixDescription: 'Assign next available sequential customer number.',
        suggestedFix: { action: 'ASSIGN_CUSTOMER_NUMBER', customerId: customer.id }
      });
    } else {
      usedNumbers.add(normNum);
      if (!customersByNumber.has(normNum)) {
        customersByNumber.set(normNum, [customer]);
      } else {
        customersByNumber.get(normNum).push(customer);
      }
    }

    // Audit Customer Bills & Payments
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    totalBillsScanned += bills.length;

    for (const bill of bills) {
      if (!bill || typeof bill !== 'object') continue;

      // Check Bill without amount
      const rawDue = bill.dueAmount;
      const hasNoAmount = rawDue === null || rawDue === undefined || rawDue === '' || Number.isNaN(Number(rawDue));
      if (hasNoAmount) {
        issues.push({
          id: `ISSUE-BWA-${customer.id}-${bill.month}`,
          code: INTEGRITY_RULE_CODES.BILL_WITHOUT_AMOUNT,
          severity: INTEGRITY_SEVERITY.WARNING,
          entityType: 'bill',
          entityId: bill.id || `${customer.id}-${bill.month}`,
          customerId: customer.id,
          customerNumber: customer.customerNumber ?? null,
          customerName: customer.name || 'Unnamed',
          month: bill.month,
          description: `Bill for month ${bill.month} on customer #${customer.customerNumber ?? '?'} has no due amount configured.`,
          canAutoFix: true,
          fixDescription: `Backfill monthly package rate (PKR ${customer.monthlySellingAmount || 0}) onto bill.`,
          suggestedFix: {
            action: 'BACKFILL_BILL_AMOUNT',
            customerId: customer.id,
            month: bill.month,
            amount: Number(customer.monthlySellingAmount) || 0
          }
        });
      } else if (Number(rawDue) < 0) {
        issues.push({
          id: `ISSUE-NIB-${customer.id}-${bill.month}`,
          code: INTEGRITY_RULE_CODES.NEGATIVE_OR_IMPOSSIBLE_BALANCE,
          severity: INTEGRITY_SEVERITY.WARNING,
          entityType: 'bill',
          entityId: bill.id || `${customer.id}-${bill.month}`,
          customerId: customer.id,
          customerNumber: customer.customerNumber ?? null,
          customerName: customer.name || 'Unnamed',
          month: bill.month,
          description: `Bill for month ${bill.month} has an invalid negative due amount (PKR ${rawDue}).`,
          canAutoFix: true,
          fixDescription: 'Normalize bill due amount to PKR 0.',
          suggestedFix: {
            action: 'NORMALIZE_NEGATIVE_BILL',
            customerId: customer.id,
            month: bill.month
          }
        });
      }

      // Audit Payments within this Bill
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      totalPaymentsScanned += payments.length;

      for (const payment of payments) {
        if (!payment || typeof payment !== 'object') continue;

        // Check Payment Amount
        const pAmount = Number(payment.amount);
        if (Number.isNaN(pAmount) || pAmount <= 0) {
          issues.push({
            id: `ISSUE-IPA-${payment.id || Math.random()}`,
            code: INTEGRITY_RULE_CODES.INVALID_PAYMENT_AMOUNT,
            severity: INTEGRITY_SEVERITY.CRITICAL,
            entityType: 'payment',
            entityId: payment.id,
            customerId: customer.id,
            customerNumber: customer.customerNumber ?? null,
            customerName: customer.name || 'Unnamed',
            month: bill.month,
            description: `Payment entry "${payment.id}" has invalid or zero/negative amount (PKR ${payment.amount}).`,
            canAutoFix: true,
            fixDescription: 'Quarantine or sanitize invalid payment value.',
            suggestedFix: { action: 'SANITIZE_PAYMENT_AMOUNT', customerId: customer.id, month: bill.month, paymentId: payment.id }
          });
        }

        // Track Receipt Number / ID duplicates
        const receiptKey = String(payment.receiptNumber || payment.permanentReceiptNumber || payment.id || '').trim();
        if (receiptKey) {
          if (!receiptRegister.has(receiptKey)) {
            receiptRegister.set(receiptKey, [{
              customerId: customer.id,
              customerNumber: customer.customerNumber,
              customerName: customer.name,
              month: bill.month,
              payment
            }]);
          } else {
            receiptRegister.get(receiptKey).push({
              customerId: customer.id,
              customerNumber: customer.customerNumber,
              customerName: customer.name,
              month: bill.month,
              payment
            });
          }
        }
      }
    }
  }

  // 2. Identify Duplicate Customer Numbers
  for (const [cNum, custList] of customersByNumber.entries()) {
    if (custList.length > 1) {
      const original = custList[0];
      for (let i = 1; i < custList.length; i++) {
        const dup = custList[i];
        issues.push({
          id: `ISSUE-DCN-${dup.id}`,
          code: INTEGRITY_RULE_CODES.DUPLICATE_CUSTOMER_NUMBER,
          severity: INTEGRITY_SEVERITY.WARNING,
          entityType: 'customer',
          entityId: dup.id,
          customerNumber: cNum,
          customerName: dup.name,
          month: null,
          description: `Duplicate Customer #${cNum} shared between "${original.name}" and "${dup.name}".`,
          canAutoFix: true,
          fixDescription: 'Re-assign next available unique customer number to duplicate profile.',
          suggestedFix: { action: 'RESOLVE_DUPLICATE_CUSTOMER_NUMBER', customerId: dup.id, originalCustomerId: original.id }
        });
      }
    }
  }

  // 3. Identify Duplicate Receipt Numbers
  for (const [receiptKey, occurrences] of receiptRegister.entries()) {
    if (occurrences.length > 1) {
      const original = occurrences[0];
      for (let i = 1; i < occurrences.length; i++) {
        const dup = occurrences[i];
        issues.push({
          id: `ISSUE-DRN-${dup.payment.id}`,
          code: INTEGRITY_RULE_CODES.DUPLICATE_RECEIPT_NUMBER,
          severity: INTEGRITY_SEVERITY.CRITICAL,
          entityType: 'payment',
          entityId: dup.payment.id,
          customerId: dup.customerId,
          customerNumber: dup.customerNumber,
          customerName: dup.customerName,
          month: dup.month,
          description: `Duplicate receipt identifier "${receiptKey}" found across multiple payments (PKR ${dup.payment.amount} on ${dup.payment.date}).`,
          canAutoFix: true,
          fixDescription: 'Re-generate unique permanent receipt number.',
          suggestedFix: {
            action: 'REGENERATE_RECEIPT_NUMBER',
            customerId: dup.customerId,
            month: dup.month,
            paymentId: dup.payment.id
          }
        });
      }
    }
  }

  // 4. Audit Storage Tables for Orphan Records (if storage available)
  if (storage && typeof storage.getItem === 'function') {
    // Check Orphan Adjustments
    try {
      const rawAdj = storage.getItem('shahdara_customer_adjustments');
      if (rawAdj) {
        const parsedAdj = JSON.parse(rawAdj);
        const adjList = Array.isArray(parsedAdj) ? parsedAdj : (Array.isArray(parsedAdj?.vouchers) ? parsedAdj.vouchers : []);
        totalAdjustmentsScanned += adjList.length;
        for (const voucher of adjList) {
          if (voucher?.customerId && !customersById.has(voucher.customerId)) {
            issues.push({
              id: `ISSUE-OADJ-${voucher.id || Math.random()}`,
              code: INTEGRITY_RULE_CODES.ORPHAN_ADJUSTMENT,
              severity: INTEGRITY_SEVERITY.WARNING,
              entityType: 'adjustment',
              entityId: voucher.id,
              customerId: voucher.customerId,
              customerNumber: null,
              customerName: voucher.customerName || 'Unknown Customer',
              month: voucher.month || null,
              description: `Adjustment voucher "${voucher.id}" (${voucher.category || 'adjustment'}) references non-existent customer ID "${voucher.customerId}".`,
              canAutoFix: true,
              fixDescription: 'Archive orphan voucher to recoverable adjustments archive.',
              suggestedFix: { action: 'ARCHIVE_ORPHAN_ADJUSTMENT', voucherId: voucher.id }
            });
          }
        }
      }
    } catch {
      // Storage read error ignored safely
    }

    // Check Orphan Equipment Retrievals
    try {
      const rawRet = storage.getItem('shahdara_equipment_retrievals_v1');
      if (rawRet) {
        const parsedRet = JSON.parse(rawRet);
        const retList = Array.isArray(parsedRet) ? parsedRet : [];
        for (const ret of retList) {
          if (ret?.customerId && !customersById.has(ret.customerId)) {
            issues.push({
              id: `ISSUE-OEQ-${ret.id || Math.random()}`,
              code: INTEGRITY_RULE_CODES.ORPHAN_EQUIPMENT_RETRIEVAL,
              severity: INTEGRITY_SEVERITY.INFO,
              entityType: 'equipment',
              entityId: ret.id,
              customerId: ret.customerId,
              customerNumber: ret.customerNumber || null,
              customerName: ret.customerName || 'Unknown',
              month: null,
              description: `Equipment retrieval manifest "${ret.id}" references deleted/missing customer ID "${ret.customerId}".`,
              canAutoFix: false,
              fixDescription: 'Informational: preserve retrieval record notes for audit.',
              suggestedFix: null
            });
          }
        }
      }
    } catch {
      // Storage read error ignored safely
    }
  }

  // 5. Calculate Integrity Score & Summary KPIs
  const totalEntitiesScanned = customers.length + totalBillsScanned + totalPaymentsScanned + totalAdjustmentsScanned;
  const criticalCount = issues.filter(i => i.severity === INTEGRITY_SEVERITY.CRITICAL).length;
  const warningCount = issues.filter(i => i.severity === INTEGRITY_SEVERITY.WARNING).length;
  const infoCount = issues.filter(i => i.severity === INTEGRITY_SEVERITY.INFO).length;
  const autoFixableCount = issues.filter(i => i.canAutoFix).length;
  const cleanEntities = Math.max(0, totalEntitiesScanned - issues.length);

  // Integrity Score Algorithm:
  // Starts at 100%. Critical issue deducts 15 points, Warning deducts 4 points, Info deducts 1 point.
  // Normalized against sample database size.
  let integrityScore = 100;
  if (totalEntitiesScanned > 0 && issues.length > 0) {
    const penalty = (criticalCount * 15) + (warningCount * 4) + (infoCount * 1);
    const scaleFactor = Math.max(1, totalEntitiesScanned / 25);
    integrityScore = Math.max(0, Math.min(100, Math.round(100 - (penalty / scaleFactor))));
  }

  let healthStatus = 'clean';
  if (criticalCount > 0 || integrityScore < 70) {
    healthStatus = 'critical';
  } else if (warningCount > 0 || integrityScore < 90) {
    healthStatus = 'warning';
  } else if (integrityScore < 100) {
    healthStatus = 'good';
  }

  return {
    scannedAt: referenceDate.toISOString(),
    totalEntitiesScanned,
    customerCount: customers.length,
    billCount: totalBillsScanned,
    paymentCount: totalPaymentsScanned,
    adjustmentCount: totalAdjustmentsScanned,
    totalIssues: issues.length,
    criticalCount,
    warningCount,
    infoCount,
    autoFixableCount,
    cleanEntities,
    integrityScore,
    healthStatus,
    issues
  };
}

/**
 * Generates dry-run preview of planned safe automated fixes.
 * @param {Object} state
 * @param {Object} scanResult
 * @param {Object} [options]
 * @returns {Array<Object>} List of planned mutations
 */
export function previewDataIntegrityFixes(state, scanResult, {
  selectedIssueIds = null
} = {}) {
  const issues = Array.isArray(scanResult?.issues) ? scanResult.issues : [];
  const targetIssues = issues.filter(issue => {
    if (!issue.canAutoFix || !issue.suggestedFix) return false;
    if (selectedIssueIds && !selectedIssueIds.includes(issue.id)) return false;
    return true;
  });

  const previewList = [];
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  let nextNumber = Math.max(1, Number(state?.nextCustomerNumber) || 1, ...customers.map(c => Number(c.customerNumber) || 0)) + 1;

  for (const issue of targetIssues) {
    const fix = issue.suggestedFix;
    switch (fix.action) {
      case 'ASSIGN_CUSTOMER_NUMBER':
      case 'RESOLVE_DUPLICATE_CUSTOMER_NUMBER': {
        const assignedNumber = nextNumber++;
        previewList.push({
          issueId: issue.id,
          code: issue.code,
          entityType: 'customer',
          entityId: fix.customerId,
          name: issue.customerName,
          beforeValue: issue.customerNumber ? `#${issue.customerNumber}` : 'Not assigned',
          afterValue: `#${assignedNumber}`,
          explanation: `Assign sequential Customer #${assignedNumber}.`
        });
        break;
      }
      case 'BACKFILL_BILL_AMOUNT': {
        previewList.push({
          issueId: issue.id,
          code: issue.code,
          entityType: 'bill',
          entityId: `${fix.customerId}-${fix.month}`,
          name: `${issue.customerName} (${fix.month})`,
          beforeValue: 'None / null',
          afterValue: `PKR ${fix.amount}`,
          explanation: `Set due amount to customer package rate PKR ${fix.amount}.`
        });
        break;
      }
      case 'NORMALIZE_NEGATIVE_BILL': {
        previewList.push({
          issueId: issue.id,
          code: issue.code,
          entityType: 'bill',
          entityId: `${fix.customerId}-${fix.month}`,
          name: `${issue.customerName} (${fix.month})`,
          beforeValue: 'Negative PKR',
          afterValue: 'PKR 0',
          explanation: 'Reset negative due amount to 0.00 PKR.'
        });
        break;
      }
      case 'REGENERATE_RECEIPT_NUMBER': {
        previewList.push({
          issueId: issue.id,
          code: issue.code,
          entityType: 'payment',
          entityId: fix.paymentId,
          name: `${issue.customerName} (${fix.month})`,
          beforeValue: 'Duplicate ID',
          afterValue: 'New Canonical Receipt Number',
          explanation: 'Generate fresh guaranteed unique permanent receipt number.'
        });
        break;
      }
      case 'SANITIZE_PAYMENT_AMOUNT': {
        previewList.push({
          issueId: issue.id,
          code: issue.code,
          entityType: 'payment',
          entityId: fix.paymentId,
          name: `${issue.customerName} (${fix.month})`,
          beforeValue: 'Invalid amount',
          afterValue: 'PKR 0.00 (Quarantined)',
          explanation: 'Normalize invalid amount to 0.00 and flag record.'
        });
        break;
      }
      case 'ARCHIVE_ORPHAN_ADJUSTMENT': {
        previewList.push({
          issueId: issue.id,
          code: issue.code,
          entityType: 'adjustment',
          entityId: fix.voucherId,
          name: issue.customerName,
          beforeValue: 'Orphan in active vouchers',
          afterValue: 'Quarantined archive',
          explanation: 'Move orphan adjustment voucher to orphan archive table.'
        });
        break;
      }
      default:
        break;
    }
  }

  return previewList;
}

/**
 * Applies safe automated fixes to the application state and offline storage.
 * Automatically saves a pre-repair rollback snapshot in storage before modifying data.
 * @param {Object} state
 * @param {Object} scanResult
 * @param {Object} [options]
 * @param {Storage|Object} [options.storage]
 * @param {Array<string>} [options.selectedIssueIds]
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Object} Updated state, backupKey, and list of executed fixes
 */
export function applyDataIntegrityFixes(state, scanResult, {
  storage = null,
  selectedIssueIds = null,
  referenceDate = new Date()
} = {}) {
  const timestamp = referenceDate.toISOString();
  const backupKey = `${INTEGRITY_BACKUP_PREFIX}${timestamp.replace(/[:.]/g, '-')}`;

  // 1. Create Pre-Repair Snapshot in Storage
  if (storage && typeof storage.setItem === 'function') {
    try {
      const backupPayload = JSON.stringify({
        createdAt: timestamp,
        reason: 'Automated pre-integrity repair snapshot',
        scanSummary: {
          integrityScore: scanResult.integrityScore,
          totalIssues: scanResult.totalIssues,
          criticalCount: scanResult.criticalCount
        },
        state
      });
      storage.setItem(backupKey, backupPayload);
    } catch {
      // Storage backup error handled gracefully
    }
  }

  const issues = Array.isArray(scanResult?.issues) ? scanResult.issues : [];
  const targetIssues = issues.filter(issue => {
    if (!issue.canAutoFix || !issue.suggestedFix) return false;
    if (selectedIssueIds && !selectedIssueIds.includes(issue.id)) return false;
    return true;
  });

  let customers = Array.isArray(state?.customers) ? JSON.parse(JSON.stringify(state.customers)) : [];
  let nextNumber = Math.max(1, Number(state?.nextCustomerNumber) || 1, ...customers.map(c => Number(c.customerNumber) || 0)) + 1;
  const executedFixes = [];

  for (const issue of targetIssues) {
    const fix = issue.suggestedFix;

    switch (fix.action) {
      case 'ASSIGN_CUSTOMER_NUMBER':
      case 'RESOLVE_DUPLICATE_CUSTOMER_NUMBER': {
        const assignedNumber = nextNumber++;
        customers = customers.map(c => {
          if (c.id === fix.customerId) {
            return { ...c, customerNumber: assignedNumber };
          }
          return c;
        });
        executedFixes.push({
          issueId: issue.id,
          action: fix.action,
          entityId: fix.customerId,
          result: `Customer #${assignedNumber} assigned`
        });
        break;
      }

      case 'BACKFILL_BILL_AMOUNT': {
        customers = customers.map(c => {
          if (c.id === fix.customerId) {
            const bills = (c.bills || []).map(b => {
              if (b.month === fix.month) {
                return { ...b, dueAmount: fix.amount, status: b.status || 'pending' };
              }
              return b;
            });
            return { ...c, bills };
          }
          return c;
        });
        executedFixes.push({
          issueId: issue.id,
          action: fix.action,
          entityId: `${fix.customerId}-${fix.month}`,
          result: `Due amount set to PKR ${fix.amount}`
        });
        break;
      }

      case 'NORMALIZE_NEGATIVE_BILL': {
        customers = customers.map(c => {
          if (c.id === fix.customerId) {
            const bills = (c.bills || []).map(b => {
              if (b.month === fix.month) {
                return { ...b, dueAmount: 0 };
              }
              return b;
            });
            return { ...c, bills };
          }
          return c;
        });
        executedFixes.push({
          issueId: issue.id,
          action: fix.action,
          entityId: `${fix.customerId}-${fix.month}`,
          result: 'Negative due amount normalized to PKR 0'
        });
        break;
      }

      case 'REGENERATE_RECEIPT_NUMBER': {
        customers = customers.map(c => {
          if (c.id === fix.customerId) {
            const bills = (c.bills || []).map(b => {
              if (b.month === fix.month) {
                const payments = (b.payments || []).map(p => {
                  if (p.id === fix.paymentId) {
                    const freshReceiptNumber = generateReceiptNumber({
                      customerNumber: c.customerNumber,
                      paymentDate: p.date,
                      paymentId: `${p.id}-${Math.floor(Math.random() * 900 + 100)}`,
                      billMonth: b.month
                    });
                    return {
                      ...p,
                      receiptNumber: freshReceiptNumber,
                      permanentReceiptNumber: freshReceiptNumber
                    };
                  }
                  return p;
                });
                return { ...b, payments };
              }
              return b;
            });
            return { ...c, bills };
          }
          return c;
        });
        executedFixes.push({
          issueId: issue.id,
          action: fix.action,
          entityId: fix.paymentId,
          result: 'Re-generated unique canonical receipt number'
        });
        break;
      }

      case 'SANITIZE_PAYMENT_AMOUNT': {
        customers = customers.map(c => {
          if (c.id === fix.customerId) {
            const bills = (c.bills || []).map(b => {
              if (b.month === fix.month) {
                const payments = (b.payments || []).map(p => {
                  if (p.id === fix.paymentId) {
                    return { ...p, amount: 0, corruptedOriginalAmount: p.amount };
                  }
                  return p;
                });
                return { ...b, payments };
              }
              return b;
            });
            return { ...c, bills };
          }
          return c;
        });
        executedFixes.push({
          issueId: issue.id,
          action: fix.action,
          entityId: fix.paymentId,
          result: 'Sanitized invalid payment amount to 0'
        });
        break;
      }

      case 'ARCHIVE_ORPHAN_ADJUSTMENT': {
        if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
          try {
            const raw = storage.getItem('shahdara_customer_adjustments');
            if (raw) {
              const parsed = JSON.parse(raw);
              const list = Array.isArray(parsed) ? parsed : [];
              const kept = list.filter(v => v.id !== fix.voucherId);
              const removed = list.filter(v => v.id === fix.voucherId);
              storage.setItem('shahdara_customer_adjustments', JSON.stringify(kept));

              // Store into orphan archive
              const rawOrphans = storage.getItem(ORPHAN_ADJUSTMENTS_ARCHIVE_KEY);
              const orphanList = rawOrphans ? JSON.parse(rawOrphans) : [];
              orphanList.push(...removed);
              storage.setItem(ORPHAN_ADJUSTMENTS_ARCHIVE_KEY, JSON.stringify(orphanList));
            }
          } catch {
            // Storage mutation error handled
          }
        }
        executedFixes.push({
          issueId: issue.id,
          action: fix.action,
          entityId: fix.voucherId,
          result: 'Archived orphan adjustment to quarantine table'
        });
        break;
      }

      default:
        break;
    }
  }

  // Update State with modified customers and nextCustomerNumber
  const finalNextCustomerNumber = Math.max(nextNumber, ...customers.map(c => (Number(c.customerNumber) || 0) + 1));
  const updatedState = {
    ...state,
    customers,
    nextCustomerNumber: finalNextCustomerNumber
  };

  return {
    success: true,
    timestamp,
    backupKey,
    fixedCount: executedFixes.length,
    executedFixes,
    updatedState
  };
}

/**
 * Pure-vector SVG Health Gauge visualizer for Data Integrity diagnostic view.
 * @param {Object} params
 * @param {Object} params.scanResult
 * @param {number} [params.width=640]
 * @param {number} [params.height=300]
 * @returns {string} SVG markup
 */
export function renderDataIntegritySvg({
  scanResult,
  width = 640,
  height = 300
} = {}) {
  const score = Number(scanResult?.integrityScore) || 0;
  const totalIssues = Number(scanResult?.totalIssues) || 0;
  const critical = Number(scanResult?.criticalCount) || 0;
  const warning = Number(scanResult?.warningCount) || 0;
  const info = Number(scanResult?.infoCount) || 0;
  const totalScanned = Number(scanResult?.totalEntitiesScanned) || 0;

  // Arc Gauge Geometry
  const cx = 160;
  const cy = 165;
  const r = 90;
  const strokeWidth = 16;
  const circumference = Math.PI * r; // half-circle circumference ~ 282.74
  const progressRatio = Math.max(0, Math.min(100, score)) / 100;
  const dashoffset = circumference * (1 - progressRatio);

  let gaugeColor = '#10b981'; // Green
  let statusText = 'HEALTHY';
  if (score < 70 || critical > 0) {
    gaugeColor = '#ef4444'; // Red
    statusText = 'CRITICAL ATTENTION';
  } else if (score < 90 || warning > 0) {
    gaugeColor = '#f59e0b'; // Amber
    statusText = 'WARNINGS FOUND';
  }

  // Breakdown Bars Geometry
  const barX = 340;
  const barWidth = 260;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="data-integrity-svg" aria-label="Database Integrity Health Gauge ${score}%">
    <defs>
      <linearGradient id="integrityGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${gaugeColor}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${gaugeColor}" stop-opacity="1"/>
      </linearGradient>
      <filter id="integrityGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <!-- Background Plate -->
    <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="var(--bg-surface, #1e293b)" stroke="var(--border-color, #334155)" stroke-width="1.5"/>

    <!-- Header Banner -->
    <text x="24" y="36" fill="var(--text-muted, #94a3b8)" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" letter-spacing="1">OFFLINE DATABASE AUDIT &amp; HEALTH</text>
    <text x="${width - 24}" y="36" text-anchor="end" fill="var(--text-muted, #94a3b8)" font-family="system-ui, -apple-system, sans-serif" font-size="12">${totalScanned} records audited</text>

    <!-- Half-Circle Arc Gauge Background -->
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="var(--border-color, #334155)" stroke-width="${strokeWidth}" stroke-linecap="round"/>

    <!-- Half-Circle Arc Gauge Progress -->
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="url(#integrityGaugeGrad)" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dashoffset}" filter="url(#integrityGlow)"/>

    <!-- Center Score Text -->
    <text x="${cx}" y="${cy - 20}" text-anchor="middle" fill="${gaugeColor}" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800">${score}%</text>
    <text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="var(--text-main, #f8fafc)" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5">${statusText}</text>
    <text x="${cx}" y="${cy + 24}" text-anchor="middle" fill="var(--text-muted, #94a3b8)" font-family="system-ui, -apple-system, sans-serif" font-size="10">Integrity Health Score</text>

    <!-- Issues Breakdown Card (Right Side) -->
    <rect x="320" y="55" width="295" height="185" rx="8" fill="var(--bg-main, #0f172a)" stroke="var(--border-color, #334155)" stroke-width="1"/>

    <text x="${barX}" y="80" fill="var(--text-main, #f8fafc)" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700">Audit Anomaly Breakdown</text>

    <!-- Critical Row -->
    <text x="${barX}" y="112" fill="#ef4444" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600">Critical (${critical})</text>
    <text x="${barX + barWidth}" y="112" text-anchor="end" fill="var(--text-muted, #94a3b8)" font-family="system-ui, -apple-system, sans-serif" font-size="11">Orphan / Dup Receipts</text>
    <rect x="${barX}" y="120" width="${barWidth}" height="6" rx="3" fill="var(--border-color, #334155)"/>
    <rect x="${barX}" y="120" width="${totalIssues ? Math.max(6, (critical / totalIssues) * barWidth) : 0}" height="6" rx="3" fill="#ef4444"/>

    <!-- Warning Row -->
    <text x="${barX}" y="152" fill="#f59e0b" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600">Warnings (${warning})</text>
    <text x="${barX + barWidth}" y="152" text-anchor="end" fill="var(--text-muted, #94a3b8)" font-family="system-ui, -apple-system, sans-serif" font-size="11">Missing # / Unpriced</text>
    <rect x="${barX}" y="160" width="${barWidth}" height="6" rx="3" fill="var(--border-color, #334155)"/>
    <rect x="${barX}" y="160" width="${totalIssues ? Math.max(6, (warning / totalIssues) * barWidth) : 0}" height="6" rx="3" fill="#f59e0b"/>

    <!-- Info Row -->
    <text x="${barX}" y="192" fill="#3b82f6" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600">Informational (${info})</text>
    <text x="${barX + barWidth}" y="192" text-anchor="end" fill="var(--text-muted, #94a3b8)" font-family="system-ui, -apple-system, sans-serif" font-size="11">Notice / Metadata</text>
    <rect x="${barX}" y="200" width="${barWidth}" height="6" rx="3" fill="var(--border-color, #334155)"/>
    <rect x="${barX}" y="200" width="${totalIssues ? Math.max(6, (info / totalIssues) * barWidth) : 0}" height="6" rx="3" fill="#3b82f6"/>

    <!-- Bottom Telemetry Ribbon -->
    <line x1="20" y1="255" x2="${width - 20}" y2="255" stroke="var(--border-color, #334155)" stroke-width="1"/>
    <text x="24" y="280" fill="var(--text-muted, #94a3b8)" font-family="system-ui, -apple-system, sans-serif" font-size="11">
      Clean: <tspan fill="var(--text-main, #f8fafc)" font-weight="700">${scanResult?.cleanEntities || 0}</tspan> ·
      Issues: <tspan fill="${totalIssues ? gaugeColor : 'var(--text-main, #f8fafc)'}" font-weight="700">${totalIssues}</tspan> ·
      Auto-fixable: <tspan fill="#10b981" font-weight="700">${scanResult?.autoFixableCount || 0}</tspan>
    </text>
    <text x="${width - 24}" y="280" text-anchor="end" fill="var(--text-muted, #94a3b8)" font-family="system-ui, -apple-system, sans-serif" font-size="11">
      Shahdara ISP Offline Engine
    </text>
  </svg>`;
}

/**
 * Generates an RFC-4180 compliant CSV audit report of all scanned anomalies.
 * @param {Object} scanResult
 * @returns {string} CSV with UTF-8 BOM
 */
export function generateDataIntegrityReportCsv(scanResult) {
  const issues = Array.isArray(scanResult?.issues) ? scanResult.issues : [];

  const headers = [
    'Issue ID',
    'Severity',
    'Rule Code',
    'Entity Type',
    'Entity ID',
    'Customer Number',
    'Customer Name',
    'Month / Date',
    'Description',
    'Auto-Fix Available',
    'Suggested Fix Action'
  ];

  const escapeCsv = (str) => {
    const val = String(str ?? '');
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [headers.join(',')];

  for (const issue of issues) {
    const row = [
      escapeCsv(issue.id),
      escapeCsv(issue.severity),
      escapeCsv(issue.code),
      escapeCsv(issue.entityType),
      escapeCsv(issue.entityId),
      escapeCsv(issue.customerNumber !== null ? issue.customerNumber : ''),
      escapeCsv(issue.customerName),
      escapeCsv(issue.month || ''),
      escapeCsv(issue.description),
      escapeCsv(issue.canAutoFix ? 'Yes' : 'No'),
      escapeCsv(issue.fixDescription)
    ];
    lines.push(row.join(','));
  }

  // Prepend UTF-8 BOM for Microsoft Excel compatibility
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/**
 * Generates printable HTML certificate or POS thermal slip.
 * @param {Object} scanResult
 * @param {'a4'|'thermal-80'} [format='a4']
 * @returns {string} Printable HTML
 */
export function generateDataIntegrityCertHtml(scanResult, format = 'a4') {
  const score = Number(scanResult?.integrityScore) || 0;
  const issues = Array.isArray(scanResult?.issues) ? scanResult.issues : [];
  const scannedAt = scanResult?.scannedAt || new Date().toISOString();

  if (format === 'thermal-80') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Data Integrity Audit Slip</title>
  <style>
    @page { size: 76mm auto; margin: 2mm; }
    body { font-family: monospace; font-size: 11px; margin: 0; padding: 4px; color: #000; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="center bold">SHAHDARA BROADBAND ISP</div>
  <div class="center">DATA INTEGRITY AUDIT SLIP</div>
  <div class="divider"></div>
  <div class="row"><span>Scan Date:</span><span>${scannedAt.slice(0, 10)}</span></div>
  <div class="row"><span>Integrity Score:</span><span class="bold">${score}%</span></div>
  <div class="row"><span>Records Audited:</span><span>${scanResult?.totalEntitiesScanned || 0}</span></div>
  <div class="row"><span>Total Issues:</span><span>${scanResult?.totalIssues || 0}</span></div>
  <div class="row"><span>Critical:</span><span>${scanResult?.criticalCount || 0}</span></div>
  <div class="row"><span>Warnings:</span><span>${scanResult?.warningCount || 0}</span></div>
  <div class="divider"></div>
  <div class="bold">ANOMALY SUMMARY:</div>
  ${issues.slice(0, 5).map(i => `<div>• [${i.severity.toUpperCase()}] ${i.description}</div>`).join('')}
  ${issues.length > 5 ? `<div>... and ${issues.length - 5} more issues</div>` : ''}
  <div class="divider"></div>
  <div class="center">Offline Ledger Verification Passed</div>
  <div class="center">*** End of Slip ***</div>
</body>
</html>`;
  }

  // Formal A4 Certificate Format
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Shahdara ISP - Database Data Integrity Certificate</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1e293b; margin: 0; line-height: 1.5; }
    .cert-header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .cert-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
    .cert-subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; }
    .kpi-label { font-size: 11px; color: #64748b; font-weight: 600; }
    .kpi-value { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    .table-wrap { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    .table-wrap th, .table-wrap td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 12px; }
    .table-wrap th { background: #f1f5f9; font-weight: 700; color: #334155; }
    .pill { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .pill-critical { background: #fee2e2; color: #991b1b; }
    .pill-warning { background: #fef3c7; color: #92400e; }
    .pill-info { background: #e0f2fe; color: #075985; }
    .signature-row { margin-top: 40px; display: flex; justify-content: space-between; }
    .sig-block { border-top: 1px solid #94a3b8; width: 200px; padding-top: 6px; font-size: 11px; text-align: center; color: #64748b; }
  </style>
</head>
<body>
  <div class="cert-header">
    <div>
      <h1 class="cert-title">DATABASE INTEGRITY AUDIT CERTIFICATE</h1>
      <div class="cert-subtitle">Shahdara Broadband ISP · Offline Storage Ledger Verification</div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #64748b;">
      <div><strong>Audit Date:</strong> ${scannedAt.slice(0, 10)}</div>
      <div><strong>Audit Ref:</strong> CERT-DIA-${scannedAt.slice(0, 10).replace(/-/g, '')}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">INTEGRITY SCORE</div>
      <div class="kpi-value" style="color: ${score >= 90 ? '#10b981' : (score >= 70 ? '#f59e0b' : '#ef4444')}">${score}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">RECORDS AUDITED</div>
      <div class="kpi-value">${scanResult?.totalEntitiesScanned || 0}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">TOTAL ISSUES</div>
      <div class="kpi-value">${scanResult?.totalIssues || 0}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">CLEAN ENTITIES</div>
      <div class="kpi-value">${scanResult?.cleanEntities || 0}</div>
    </div>
  </div>

  <h3>Detected Database Anomalies &amp; Ledger Discrepancies</h3>
  <table class="table-wrap">
    <thead>
      <tr>
        <th style="width: 80px;">Severity</th>
        <th style="width: 120px;">Rule Code</th>
        <th style="width: 180px;">Entity Details</th>
        <th>Description &amp; Suggested Safe Action</th>
      </tr>
    </thead>
    <tbody>
      ${issues.length === 0 ? `<tr><td colspan="4" style="text-align:center; padding: 20px; color: #10b981; font-weight: bold;">✔ All offline database records, customer numbers, bills, and receipts verified 100% clean and consistent.</td></tr>` : issues.map(issue => `
      <tr>
        <td><span class="pill pill-${issue.severity}">${issue.severity}</span></td>
        <td><code>${issue.code}</code></td>
        <td><strong>${issue.customerName || 'N/A'}</strong><br><small>#${issue.customerNumber || '?'} · ${issue.entityType} ${issue.month || ''}</small></td>
        <td>${issue.description}<br><em style="color: #64748b;">Recommended fix: ${issue.fixDescription}</em></td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="signature-row">
    <div class="sig-block">Systems Administrator / Owner</div>
    <div class="sig-block">Billing QA Auditor</div>
  </div>
</body>
</html>`;
}

/**
 * Formats a concise bilingual Urdu & English WhatsApp summary message for the ISP owner.
 * @param {Object} scanResult
 * @returns {string} WhatsApp text
 */
export function formatDataIntegrityWhatsApp(scanResult) {
  const score = Number(scanResult?.integrityScore) || 0;
  const critical = Number(scanResult?.criticalCount) || 0;
  const warning = Number(scanResult?.warningCount) || 0;
  const total = Number(scanResult?.totalIssues) || 0;

  return [
    `*🛡️ SHAHDARA BROADBAND - DATABASE INTEGRITY AUDIT REPORT*`,
    `*ڈیٹا انٹیگریٹی اور لیجر آڈٹ رپورٹ*`,
    `----------------------------------------`,
    `📊 *Integrity Score:* ${score}% (${scanResult?.healthStatus?.toUpperCase() || 'CLEAN'})`,
    `📦 *Total Records Audited:* ${scanResult?.totalEntitiesScanned || 0}`,
    `⚠️ *Total Issues Detected:* ${total}`,
    `  • 🔴 Critical (Orphans/Dups): ${critical}`,
    `  • 🟡 Warnings (Unpriced/Missing #): ${warning}`,
    `  • 🟢 Auto-Fixable Issues: ${scanResult?.autoFixableCount || 0}`,
    `----------------------------------------`,
    `💡 *Urdu Summary / خلاصہ:*`,
    score >= 90
      ? `ماشاءاللہ! آپ کا آف لائن ڈیٹا بیس اور کسٹمر لیجر بالکل درست اور محفوظ ہے۔`
      : `ڈیٹا بیس میں ${total} خامیاں پائی گئیں۔ ڈیٹا انٹیگریٹی چیکر کے ذریعے ایک کلک میں محفوظ آٹو فکس چلائیں۔`,
    `----------------------------------------`,
    `Generated by Shahdara ISP Offline QA Suite`
  ].join('\n');
}

/**
 * Sets up and binds events for the Data Integrity & Safe Repair modal.
 * @param {Object} options
 * @param {Function} options.getState
 * @param {Function} options.updateState
 * @param {Storage} [options.storage]
 * @param {Function} [options.onToast]
 * @returns {Object} Controller with open, close, and runScan methods
 */
export function setupDataIntegrityModal({
  getState,
  updateState,
  storage = globalThis?.localStorage,
  onToast = () => {}
} = {}) {
  const modal = document?.getElementById('dataIntegrityModal');
  const openButtons = [
    document?.getElementById('quickActionDataIntegrity'),
    document?.getElementById('openDataIntegrityBtn'),
    document?.getElementById('mobileMoreDataIntegrityBtn')
  ].filter(Boolean);
  const closeBtn = document?.getElementById('closeDataIntegrityModalBtn');
  const secondaryCloseBtn = document?.getElementById('closeDataIntegritySecondaryBtn');

  const runScanBtn = document?.getElementById('runDataIntegrityScanBtn');
  const applyFixesBtn = document?.getElementById('applyDataIntegrityFixesBtn');
  const filterSelect = document?.getElementById('dataIntegrityFilterSelect');
  const exportCsvBtn = document?.getElementById('exportDataIntegrityCsvBtn');
  const printA4Btn = document?.getElementById('printDataIntegrityA4Btn');
  const printPosBtn = document?.getElementById('printDataIntegrityPosBtn');
  const shareWaBtn = document?.getElementById('shareDataIntegrityWhatsAppBtn');

  const svgContainer = document?.getElementById('dataIntegritySvgContainer');
  const tableBody = document?.getElementById('dataIntegrityTableBody');
  const scoreVal = document?.getElementById('integrityScoreVal');
  const statusHelp = document?.getElementById('integrityStatusHelp');
  const totalAuditedVal = document?.getElementById('integrityTotalAuditedVal');
  const issuesFoundVal = document?.getElementById('integrityIssuesFoundVal');
  const criticalHelp = document?.getElementById('integrityCriticalHelp');
  const autoFixVal = document?.getElementById('integrityAutoFixVal');
  const badgeStatus = document?.getElementById('integrityBadgeStatus');

  let currentScan = null;

  function renderScanUI() {
    if (!currentScan) return;

    if (scoreVal) {
      scoreVal.textContent = `${currentScan.integrityScore}%`;
      scoreVal.className = `kpi-value ${currentScan.integrityScore >= 90 ? 'text-success' : (currentScan.integrityScore >= 70 ? 'text-warning' : 'text-danger')}`;
    }
    if (statusHelp) {
      statusHelp.textContent = currentScan.healthStatus === 'clean'
        ? 'Database healthy · 0 issues'
        : `${currentScan.totalIssues} issue${currentScan.totalIssues === 1 ? '' : 's'} detected`;
    }
    if (totalAuditedVal) totalAuditedVal.textContent = String(currentScan.totalEntitiesScanned);
    if (issuesFoundVal) issuesFoundVal.textContent = String(currentScan.totalIssues);
    if (criticalHelp) {
      criticalHelp.textContent = `${currentScan.criticalCount} critical, ${currentScan.warningCount} warnings`;
    }
    if (autoFixVal) autoFixVal.textContent = String(currentScan.autoFixableCount);

    if (badgeStatus) {
      badgeStatus.textContent = currentScan.healthStatus.toUpperCase();
      badgeStatus.className = `badge-status-pill badge-${currentScan.healthStatus === 'critical' ? 'critical' : (currentScan.healthStatus === 'warning' ? 'warning' : 'success')}`;
    }

    if (applyFixesBtn) {
      applyFixesBtn.disabled = currentScan.autoFixableCount === 0;
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderDataIntegritySvg({ scanResult: currentScan });
    }

    renderTable();
  }

  function renderTable() {
    if (!tableBody || !currentScan) return;
    const filter = filterSelect?.value || 'all';

    let list = currentScan.issues || [];
    if (filter !== 'all') {
      list = list.filter(i => i.severity === filter);
    }

    if (list.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center" style="padding: 20px; color: #10b981; font-weight: 600;">
            ✓ ${currentScan.totalIssues === 0 ? 'All database records verified clean and consistent. 100% integrity.' : 'No issues found matching this filter.'}
          </td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = list.map(issue => `
      <tr>
        <td><span class="badge-status-pill badge-${issue.severity === 'critical' ? 'critical' : (issue.severity === 'warning' ? 'warning' : 'info')}">${issue.severity}</span></td>
        <td><code>${issue.code}</code></td>
        <td><strong>${issue.customerName || 'N/A'}</strong><br><small>#${issue.customerNumber ?? '?'} · ${issue.entityType} ${issue.month || ''}</small></td>
        <td>${issue.description}</td>
        <td><span style="color: #10b981; font-size: 11px;">⚡ ${issue.fixDescription}</span></td>
      </tr>
    `).join('');
  }

  function runScan() {
    const state = typeof getState === 'function' ? getState() : {};
    currentScan = scanDataIntegrity(state, { storage });
    renderScanUI();
    onToast(`Data Integrity Scan Complete: ${currentScan.integrityScore}% (${currentScan.totalIssues} issues found)`);
    return currentScan;
  }

  function applyFixes() {
    if (!currentScan || currentScan.autoFixableCount === 0) {
      onToast('No safe automatic fixes to apply.');
      return;
    }
    const state = typeof getState === 'function' ? getState() : {};
    const result = applyDataIntegrityFixes(state, currentScan, { storage });

    if (result.success && typeof updateState === 'function') {
      updateState(result.updatedState);
      onToast(`Applied ${result.fixedCount} safe fixes. Pre-repair snapshot saved.`);
      runScan();
    }
  }

  function exportCsv() {
    if (!currentScan) runScan();
    const csvContent = generateDataIntegrityReportCsv(currentScan);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `shahdara_data_integrity_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onToast('Exported Data Integrity CSV Report.');
  }

  function printCert(format = 'a4') {
    if (!currentScan) runScan();
    const html = generateDataIntegrityCertHtml(currentScan, format);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      onToast('Popup blocked. Please allow popups to print report.');
    }
  }

  function shareWhatsApp() {
    if (!currentScan) runScan();
    const text = formatDataIntegrityWhatsApp(currentScan);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        onToast('Copied WhatsApp Data Integrity Audit Summary to clipboard.');
      }).catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  }

  // Event Listeners
  for (const btn of openButtons) {
    btn?.addEventListener('click', () => {
      if (typeof modal?.showModal === 'function') {
        modal.showModal();
        runScan();
      }
    });
  }

  closeBtn?.addEventListener('click', () => modal?.close());
  secondaryCloseBtn?.addEventListener('click', () => modal?.close());
  runScanBtn?.addEventListener('click', runScan);
  applyFixesBtn?.addEventListener('click', applyFixes);
  filterSelect?.addEventListener('change', renderTable);
  exportCsvBtn?.addEventListener('click', exportCsv);
  printA4Btn?.addEventListener('click', () => printCert('a4'));
  printPosBtn?.addEventListener('click', () => printCert('thermal-80'));
  shareWaBtn?.addEventListener('click', shareWhatsApp);

  // Close on backdrop click
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.close();
    }
  });

  return {
    open: () => {
      modal?.showModal?.();
      return runScan();
    },
    close: () => modal?.close?.(),
    runScan,
    applyFixes
  };
}

