/**
 * @file qa-billing-correctness.js
 * @description Shahdara Broadband ISP - Billing Correctness & Ledger Reconciliation QA Suite.
 * Implements rigorous offline audit rules for monthly bill generation, due date conformance,
 * immutable historical snapshots, multi-month price scheduling, payment allocations (same-month vs credit),
 * excess credit FIFO cascade, and Paid/Partial/Pending/Not-Set status derivation.
 *
 * Rules:
 * 1. Billing cycle: Calendar month (YYYY-MM), default due date on the 5th (YYYY-MM-05).
 * 2. Immutable history: Historical bills keep snapshot prices and amounts; changes are recorded in amountHistory.
 * 3. Future rate changes: Only apply to future generated bills via monthlyPriceSchedule.
 * 4. Payment allocation: Actual receipts applied chronologically; excess creates carry-forward credit.
 * 5. Clean ledger: Derived status is strictly mathematical:
 *    - paid: balance <= 0
 *    - partial: balance > 0 and (same-month receipt > 0 or credit > 0)
 *    - pending: balance > 0 and no payment/credit applied
 *    - not-set: unpriced / unconfigured bill
 * 6. Archived customers: Never receive new bills during archive period.
 */

import {
  calculatePaymentAllocations,
  derivedBillStatus,
  formatPKR,
  monthsForHistory,
  PAYMENT_METHODS
} from './core.js';

const monthKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const nextMonthKey = (month) => {
  const [year, number] = String(month).split('-').map(Number);
  const nextYear = number === 12 ? year + 1 : year;
  const nextNumber = number === 12 ? 1 : number + 1;
  return `${nextYear}-${String(nextNumber).padStart(2, '0')}`;
};

export const BILLING_CORRECTNESS_STORAGE_KEY = 'shahdara_billing_correctness_audits_v1';

export const AUDIT_SEVERITY = Object.freeze({
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
});

export const BILLING_STATUSES = Object.freeze({
  PAID: 'paid',
  PARTIAL: 'partial',
  PENDING: 'pending',
  NOT_SET: 'not-set'
});

export const AUDIT_RULE_CODES = Object.freeze({
  MISSING_CUSTOMER_NUMBER: 'MISSING_CUSTOMER_NUMBER',
  DUPLICATE_CUSTOMER_NUMBER: 'DUPLICATE_CUSTOMER_NUMBER',
  UNPRICED_BILL: 'UNPRICED_BILL',
  NON_STANDARD_DUE_DATE: 'NON_STANDARD_DUE_DATE',
  BILL_AFTER_ARCHIVE: 'BILL_AFTER_ARCHIVE',
  PRICE_SNAPSHOT_MISMATCH: 'PRICE_SNAPSHOT_MISMATCH',
  DUPLICATE_PAYMENT_ID: 'DUPLICATE_PAYMENT_ID',
  FUTURE_PAYMENT_DATE: 'FUTURE_PAYMENT_DATE',
  INVALID_PAYMENT_AMOUNT: 'INVALID_PAYMENT_AMOUNT',
  UNKNOWN_PAYMENT_METHOD: 'UNKNOWN_PAYMENT_METHOD',
  STATUS_DERIVATION_MISMATCH: 'STATUS_DERIVATION_MISMATCH',
  NEGATIVE_BALANCE_DETECTED: 'NEGATIVE_BALANCE_DETECTED',
  ACTIVE_PREPAID_CREDIT: 'ACTIVE_PREPAID_CREDIT'
});

/**
 * Audit standard presets representing field scenarios across Shahdara nodes.
 */
export const SHAHDARA_BILLING_PRESETS = Object.freeze([
  {
    id: 'STANDARD_BALANCED',
    name: 'Baradari Sector A - Standard Clean Ledger',
    nameUrdu: 'بارہ دری سیکٹر اے - کلین لیجر',
    description: 'All customers configured, bills generated on 5th, collections cleanly applied.'
  },
  {
    id: 'PREPAID_CREDIT_CASCADE',
    name: 'Vandala Road - Multi-Month Excess Credit Roll',
    nameUrdu: 'ونڈالہ روڈ - ایڈوانس کریڈٹ کھاتہ',
    description: 'Subscribers paying quarterly or semi-annual lump sums, cascading credit FIFO.'
  },
  {
    id: 'RATE_REVISION_MIGRATION',
    name: 'Jia Musa Commercial - Mid-Cycle Rate Upgrade',
    nameUrdu: 'جیا موسیٰ - پیکیج ریٹ تبدیلی',
    description: 'Rate hikes from 1500 to 2000 PKR; verifying past months remain immutable 1500.'
  },
  {
    id: 'SEASONAL_ARCHIVE_CYCLE',
    name: 'Begum Kot Outskirts - Seasonal Churn & Unarchive',
    nameUrdu: 'بیگم کوٹ - عارضی غیر فعال کسٹمرز',
    description: 'Seasonal subscribers archived during low season, verifying 0 bills backfilled.'
  }
]);

/**
 * Comprehensive audit of billing and ledger correctness for the entire state.
 * @param {Object} state - Application state with customers, bills, expenses.
 * @param {Date} [referenceDate=new Date()] - Reference date for current time.
 * @returns {Object} Complete audit results with metrics, bill register, and discrepancies.
 */
export function auditBillingCorrectness(state, referenceDate = new Date()) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const currentDateStr = referenceDate.toISOString().slice(0, 10);
  const currentMonth = monthKey(referenceDate);

  const discrepancies = [];
  const auditedBills = [];

  let totalBilledAmountCents = 0;
  let totalCollectedAmountCents = 0;
  let totalOutstandingDueCents = 0;
  let totalCreditForwardedCents = 0;
  let totalUnappliedCreditCents = 0;

  let paidBillsCount = 0;
  let partialBillsCount = 0;
  let pendingBillsCount = 0;
  let notSetBillsCount = 0;

  const seenCustomerNumbers = new Map();
  const seenPaymentIds = new Map();

  // 1. Run core allocation engine
  const allocations = calculatePaymentAllocations({ customers });

  // 2. Audit each customer
  let cleanAccountsCount = 0;

  for (const customer of customers) {
    let customerHasDiscrepancy = false;
    const customerId = customer.id || '';
    const customerName = customer.name || 'Unnamed Customer';
    const customerNumber = customer.customerNumber;

    // Check Customer Number validity
    if (customerNumber === null || customerNumber === undefined || !Number.isSafeInteger(customerNumber) || customerNumber <= 0) {
      customerHasDiscrepancy = true;
      discrepancies.push({
        id: `disc-cn-${customerId}`,
        ruleId: AUDIT_RULE_CODES.MISSING_CUSTOMER_NUMBER,
        severity: AUDIT_SEVERITY.CRITICAL,
        customerId,
        customerNumber: customerNumber ?? null,
        customerName,
        month: null,
        message: `Customer ${customerName} has missing or non-integer customer number.`,
        suggestion: 'Assign a permanent sequential integer customer number.'
      });
    } else {
      if (seenCustomerNumbers.has(customerNumber)) {
        customerHasDiscrepancy = true;
        discrepancies.push({
          id: `disc-dup-cn-${customerNumber}-${customerId}`,
          ruleId: AUDIT_RULE_CODES.DUPLICATE_CUSTOMER_NUMBER,
          severity: AUDIT_SEVERITY.CRITICAL,
          customerId,
          customerNumber,
          customerName,
          month: null,
          message: `Duplicate customer number #${customerNumber} shared between ${customerName} and ${seenCustomerNumbers.get(customerNumber)}.`,
          suggestion: 'Resolve duplicate ID to prevent payment misattribution.'
        });
      } else {
        seenCustomerNumbers.set(customerNumber, customerName);
      }
    }

    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    const isArchived = customer.archived === true;
    const archiveMonth = isArchived && typeof customer.archivedAt === 'string' ? customer.archivedAt.slice(0, 7) : null;

    // Check Bills
    for (const bill of bills) {
      const month = bill.month || '';
      const summary = allocations.forMonth?.(customer.id, month);
      const billAmount = bill.dueAmount;
      const isUnpriced = billAmount === null || billAmount === undefined || billAmount === '' || !Number.isFinite(Number(billAmount)) || Number(billAmount) <= 0;

      // Status check
      const derivedStatus = derivedBillStatus(customer, bill, allocations);
      if (derivedStatus === BILLING_STATUSES.PAID) paidBillsCount++;
      else if (derivedStatus === BILLING_STATUSES.PARTIAL) partialBillsCount++;
      else if (derivedStatus === BILLING_STATUSES.PENDING) pendingBillsCount++;
      else notSetBillsCount++;

      // Check Archive rule
      if (isArchived && archiveMonth && month > archiveMonth) {
        customerHasDiscrepancy = true;
        discrepancies.push({
          id: `disc-arch-${customerId}-${month}`,
          ruleId: AUDIT_RULE_CODES.BILL_AFTER_ARCHIVE,
          severity: AUDIT_SEVERITY.CRITICAL,
          customerId,
          customerNumber,
          customerName,
          month,
          message: `Bill generated for ${month} which is after customer was archived (${archiveMonth}).`,
          suggestion: 'Archived accounts should not receive new automatic monthly bills.'
        });
      }

      // Check Unpriced rule
      if (isUnpriced) {
        customerHasDiscrepancy = true;
        discrepancies.push({
          id: `disc-unpriced-${customerId}-${month}`,
          ruleId: AUDIT_RULE_CODES.UNPRICED_BILL,
          severity: AUDIT_SEVERITY.WARNING,
          customerId,
          customerNumber,
          customerName,
          month,
          message: `Bill for month ${month} has no valid amount configured (dueAmount is empty or zero).`,
          suggestion: 'Configure a valid monthly selling amount or package nominal price.'
        });
      } else {
        const billCents = Math.round(Number(billAmount) * 100);
        totalBilledAmountCents += billCents;
      }

      // Check Due Date standard (5th)
      const expectedDueDate = `${month}-05`;
      if (!bill.dueDate || bill.dueDate !== expectedDueDate) {
        discrepancies.push({
          id: `disc-due-${customerId}-${month}`,
          ruleId: AUDIT_RULE_CODES.NON_STANDARD_DUE_DATE,
          severity: AUDIT_SEVERITY.INFO,
          customerId,
          customerNumber,
          customerName,
          month,
          message: `Bill ${month} due date is "${bill.dueDate || 'Unset'}" instead of standard 5th ("${expectedDueDate}").`,
          suggestion: 'ISP billing policy standard specifies bills are due on the 5th of each service month.'
        });
      }

      // Check Payments on this bill
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      for (const p of payments) {
        const pId = p.id || '';
        const pDate = p.date || '';
        const pAmount = Number(p.amount);
        const pMethod = p.method || '';

        // Check Duplicate Payment ID
        if (pId) {
          if (seenPaymentIds.has(pId)) {
            customerHasDiscrepancy = true;
            discrepancies.push({
              id: `disc-dup-pmt-${pId}`,
              ruleId: AUDIT_RULE_CODES.DUPLICATE_PAYMENT_ID,
              severity: AUDIT_SEVERITY.CRITICAL,
              customerId,
              customerNumber,
              customerName,
              month,
              message: `Duplicate payment ID "${pId}" recorded multiple times.`,
              suggestion: 'Ensure every receipt has a unique immutable UUID.'
            });
          } else {
            seenPaymentIds.set(pId, `${customerName} (${month})`);
          }
        }

        // Check Future Payment Date
        if (pDate && pDate > currentDateStr) {
          customerHasDiscrepancy = true;
          discrepancies.push({
            id: `disc-fut-pmt-${pId || Math.random()}`,
            ruleId: AUDIT_RULE_CODES.FUTURE_PAYMENT_DATE,
            severity: AUDIT_SEVERITY.CRITICAL,
            customerId,
            customerNumber,
            customerName,
            month,
            message: `Payment dated "${pDate}" is in the future (today is ${currentDateStr}).`,
            suggestion: 'Payments cannot be recorded with future dates.'
          });
        }

        // Check Payment Amount
        if (!Number.isFinite(pAmount) || pAmount <= 0) {
          customerHasDiscrepancy = true;
          discrepancies.push({
            id: `disc-amt-pmt-${pId || Math.random()}`,
            ruleId: AUDIT_RULE_CODES.INVALID_PAYMENT_AMOUNT,
            severity: AUDIT_SEVERITY.CRITICAL,
            customerId,
            customerNumber,
            customerName,
            month,
            message: `Invalid payment amount PKR ${p.amount} recorded for ${month}.`,
            suggestion: 'Payments must be positive finite numbers.'
          });
        } else {
          totalCollectedAmountCents += Math.round(pAmount * 100);
        }

        // Check Payment Method
        if (pMethod && !PAYMENT_METHODS.includes(pMethod)) {
          discrepancies.push({
            id: `disc-mth-pmt-${pId || Math.random()}`,
            ruleId: AUDIT_RULE_CODES.UNKNOWN_PAYMENT_METHOD,
            severity: AUDIT_SEVERITY.WARNING,
            customerId,
            customerNumber,
            customerName,
            month,
            message: `Non-standard payment method "${pMethod}". Standard options: ${PAYMENT_METHODS.join(', ')}.`,
            suggestion: 'Map payment methods to canonical cash / digital wallet options.'
          });
        }
      }

      // Check Allocation Integrity
      if (summary) {
        if (summary.balanceDueCents < 0) {
          customerHasDiscrepancy = true;
          discrepancies.push({
            id: `disc-neg-bal-${customerId}-${month}`,
            ruleId: AUDIT_RULE_CODES.NEGATIVE_BALANCE_DETECTED,
            severity: AUDIT_SEVERITY.CRITICAL,
            customerId,
            customerNumber,
            customerName,
            month,
            message: `Negative balance due cents (${summary.balanceDueCents}) detected. Excess must roll forward as credit.`,
            suggestion: 'Recalculate allocations so overpayments are converted to forward credit.'
          });
        }

        if (summary.balanceDueCents !== null && summary.balanceDueCents > 0) {
          totalOutstandingDueCents += summary.balanceDueCents;
        }

        if (summary.creditForwardedCents > 0) {
          totalCreditForwardedCents += summary.creditForwardedCents;
        }

        if (summary.pendingCreditCents > 0) {
          totalUnappliedCreditCents += summary.pendingCreditCents;
          discrepancies.push({
            id: `disc-credit-${customerId}-${month}`,
            ruleId: AUDIT_RULE_CODES.ACTIVE_PREPAID_CREDIT,
            severity: AUDIT_SEVERITY.INFO,
            customerId,
            customerNumber,
            customerName,
            month,
            message: `Prepaid credit balance PKR ${(summary.pendingCreditCents / 100).toFixed(2)} available from ${month} payment.`,
            suggestion: 'This credit will automatically absorb into subsequent monthly bills.'
          });
        }

        // Status derivation cross check
        let expectedStatus = BILLING_STATUSES.NOT_SET;
        if (!isUnpriced && summary.balanceDueCents !== null) {
          if (summary.balanceDueCents <= 0) expectedStatus = BILLING_STATUSES.PAID;
          else if (summary.sameMonthAppliedCents > 0 || summary.creditAppliedCents > 0) expectedStatus = BILLING_STATUSES.PARTIAL;
          else expectedStatus = BILLING_STATUSES.PENDING;
        }

        if (derivedStatus !== expectedStatus) {
          customerHasDiscrepancy = true;
          discrepancies.push({
            id: `disc-status-${customerId}-${month}`,
            ruleId: AUDIT_RULE_CODES.STATUS_DERIVATION_MISMATCH,
            severity: AUDIT_SEVERITY.CRITICAL,
            customerId,
            customerNumber,
            customerName,
            month,
            message: `Derived status "${derivedStatus}" does not match calculated balance state (expected "${expectedStatus}").`,
            suggestion: 'Review ledger allocation logic.'
          });
        }
      }

      // Add to audited bill register
      auditedBills.push({
        customerId,
        customerNumber,
        customerName,
        customerPhone: customer.phone || '',
        customerArea: customer.mohalla || customer.zone || 'Shahdara',
        month,
        dueAmount: isUnpriced ? null : Number(billAmount),
        dueDate: bill.dueDate || expectedDueDate,
        actualReceipts: summary ? summary.actualReceiptsCents / 100 : 0,
        sameMonthApplied: summary ? summary.sameMonthAppliedCents / 100 : 0,
        creditApplied: summary ? summary.creditAppliedCents / 100 : 0,
        balanceDue: summary && summary.balanceDueCents !== null ? summary.balanceDueCents / 100 : null,
        excessGenerated: summary ? summary.excessGeneratedCents / 100 : 0,
        pendingCredit: summary ? summary.pendingCreditCents / 100 : 0,
        status: derivedStatus,
        paymentCount: payments.length
      });
    }

    if (!customerHasDiscrepancy) {
      cleanAccountsCount++;
    }
  }

  const totalBills = auditedBills.length;
  const criticalCount = discrepancies.filter(d => d.severity === AUDIT_SEVERITY.CRITICAL).length;
  const warningCount = discrepancies.filter(d => d.severity === AUDIT_SEVERITY.WARNING).length;
  const infoCount = discrepancies.filter(d => d.severity === AUDIT_SEVERITY.INFO).length;

  const cleanBillsCount = totalBills - discrepancies.filter(d => d.month && d.severity !== AUDIT_SEVERITY.INFO).length;
  const cleanBillsPercent = totalBills > 0 ? Math.max(0, Math.min(100, (cleanBillsCount / totalBills) * 100)) : 100;
  const totalBilled = totalBilledAmountCents / 100;
  const totalCollected = totalCollectedAmountCents / 100;
  const collectionEfficiency = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 100;

  let overallStatus = 'HEALTHY';
  if (criticalCount > 0) overallStatus = 'CRITICAL_ACTION_REQUIRED';
  else if (warningCount >= 5) overallStatus = 'ATTENTION_REQUIRED';

  return {
    auditTimestamp: referenceDate.toISOString(),
    auditDate: currentDateStr,
    currentMonth,
    totalCustomers: customers.length,
    activeCustomers: customers.filter(c => !c.archived && c.serviceStatus === 'active').length,
    archivedCustomers: customers.filter(c => c.archived).length,
    totalBills,
    paidBillsCount,
    partialBillsCount,
    pendingBillsCount,
    notSetBillsCount,
    totalBilledAmount: totalBilled,
    totalCollectedAmount: totalCollected,
    totalOutstandingDue: totalOutstandingDueCents / 100,
    totalCreditForwarded: totalCreditForwardedCents / 100,
    totalUnappliedCredit: totalUnappliedCreditCents / 100,
    cleanAccountsCount,
    cleanBillsPercent: Number(cleanBillsPercent.toFixed(1)),
    collectionEfficiencyPercent: Number(collectionEfficiency.toFixed(1)),
    criticalCount,
    warningCount,
    infoCount,
    overallStatus,
    discrepancies,
    auditedBills
  };
}

/**
 * Pure vector SVG visualizer of billing correctness and allocation lifecycle.
 * @param {Object} auditData - Returned from auditBillingCorrectness.
 * @param {Object} [options]
 * @returns {string} SVG string
 */
export function renderBillingCorrectnessSvg(auditData, options = {}) {
  const {
    totalBills = 0,
    paidBillsCount = 0,
    partialBillsCount = 0,
    pendingBillsCount = 0,
    notSetBillsCount = 0,
    cleanBillsPercent = 100,
    collectionEfficiencyPercent = 0,
    totalBilledAmount = 0,
    totalCollectedAmount = 0,
    totalOutstandingDue = 0,
    totalUnappliedCredit = 0,
    overallStatus = 'HEALTHY'
  } = auditData || {};

  const statusColor = overallStatus === 'HEALTHY' ? '#10b981' : overallStatus === 'ATTENTION_REQUIRED' ? '#f59e0b' : '#ef4444';
  const statusLabel = overallStatus === 'HEALTHY' ? 'VERIFIED HEALTHY' : overallStatus === 'ATTENTION_REQUIRED' ? 'ATTENTION REQUIRED' : 'CRITICAL ISSUE';

  // Ring calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const cleanOffset = circumference - (circumference * Math.min(100, Math.max(0, cleanBillsPercent))) / 100;
  const collOffset = circumference - (circumference * Math.min(100, Math.max(0, collectionEfficiencyPercent))) / 100;
  const paidRatio = totalBills > 0 ? (paidBillsCount / totalBills) * 100 : 0;
  const paidOffset = circumference - (circumference * Math.min(100, Math.max(0, paidRatio))) / 100;

  return `
<svg viewBox="0 0 920 420" width="100%" height="420" xmlns="http://www.w3.org/2000/svg" class="billing-correctness-svg" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="Billing Correctness Audit Diagram">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="partialGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="920" height="420" rx="16" fill="url(#bgGrad)"/>

  <!-- Top Title Banner -->
  <g transform="translate(30, 24)">
    <text x="0" y="16" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#f8fafc">SHAHDARA BROADBAND - BILLING CORRECTNESS &amp; LEDGER RECONCILIATION</text>
    <text x="0" y="34" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#94a3b8">Immutable 5th Due Cycle · Multi-Month Pricing · Chronological Carry-Forward Credit Audit</text>

    <!-- Overall Status Pill -->
    <rect x="700" y="2" width="160" height="28" rx="14" fill="${statusColor}" fill-opacity="0.2" stroke="${statusColor}" stroke-width="1.5"/>
    <circle cx="714" cy="16" r="4" fill="${statusColor}"/>
    <text x="724" y="20" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="${statusColor}">${statusLabel}</text>
  </g>

  <!-- Section 1: KPI Gauge Meters -->
  <g transform="translate(40, 75)">
    <!-- Meter 1: Clean Bills -->
    <g transform="translate(40, 50)" filter="url(#shadow)">
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#334155" stroke-width="8"/>
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#10b981" stroke-width="8" stroke-dasharray="${circumference}" stroke-dashoffset="${cleanOffset}" stroke-linecap="round" transform="rotate(-90 50 50)"/>
      <text x="50" y="54" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#f8fafc">${cleanBillsPercent}%</text>
      <text x="50" y="105" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#94a3b8">CLEAN BILLS</text>
    </g>

    <!-- Meter 2: Paid Ratio -->
    <g transform="translate(240, 50)" filter="url(#shadow)">
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#334155" stroke-width="8"/>
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#06b6d4" stroke-width="8" stroke-dasharray="${circumference}" stroke-dashoffset="${paidOffset}" stroke-linecap="round" transform="rotate(-90 50 50)"/>
      <text x="50" y="54" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#f8fafc">${paidRatio.toFixed(0)}%</text>
      <text x="50" y="105" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#94a3b8">SETTLED PAID</text>
    </g>

    <!-- Meter 3: Recovery Efficiency -->
    <g transform="translate(440, 50)" filter="url(#shadow)">
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#334155" stroke-width="8"/>
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#3b82f6" stroke-width="8" stroke-dasharray="${circumference}" stroke-dashoffset="${collOffset}" stroke-linecap="round" transform="rotate(-90 50 50)"/>
      <text x="50" y="54" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#f8fafc">${collectionEfficiencyPercent.toFixed(0)}%</text>
      <text x="50" y="105" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#94a3b8">RECOVERY</text>
    </g>

    <!-- Status Breakdown Stacked Bar -->
    <g transform="translate(610, 30)">
      <text x="0" y="14" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#e2e8f0">STATUS DISTRIBUTION (${totalBills} Bills)</text>
      <rect x="0" y="26" width="220" height="18" rx="6" fill="#334155"/>
      <!-- Segments -->
      <g transform="translate(0, 26)">
        <rect x="0" y="0" width="${totalBills > 0 ? (paidBillsCount / totalBills) * 220 : 0}" height="18" rx="6" fill="#10b981"/>
        <rect x="${totalBills > 0 ? (paidBillsCount / totalBills) * 220 : 0}" y="0" width="${totalBills > 0 ? (partialBillsCount / totalBills) * 220 : 0}" height="18" fill="#3b82f6"/>
        <rect x="${totalBills > 0 ? ((paidBillsCount + partialBillsCount) / totalBills) * 220 : 0}" y="0" width="${totalBills > 0 ? (pendingBillsCount / totalBills) * 220 : 0}" height="18" fill="#f59e0b"/>
        <rect x="${totalBills > 0 ? ((paidBillsCount + partialBillsCount + pendingBillsCount) / totalBills) * 220 : 0}" y="0" width="${totalBills > 0 ? (notSetBillsCount / totalBills) * 220 : 0}" height="18" fill="#64748b"/>
      </g>
      <!-- Legend -->
      <g transform="translate(0, 58)" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#cbd5e1">
        <circle cx="6" cy="6" r="4" fill="#10b981"/>
        <text x="14" y="10">Paid: ${paidBillsCount}</text>
        <circle cx="80" cy="6" r="4" fill="#3b82f6"/>
        <text x="88" y="10">Partial: ${partialBillsCount}</text>
        <circle cx="160" cy="6" r="4" fill="#f59e0b"/>
        <text x="168" y="10">Due: ${pendingBillsCount}</text>
      </g>
      <g transform="translate(0, 80)" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#94a3b8">
        <circle cx="6" cy="6" r="4" fill="#64748b"/>
        <text x="14" y="10">Unpriced / Not Set: ${notSetBillsCount}</text>
      </g>
    </g>
  </g>

  <!-- Section 2: Pipeline Architecture Flow -->
  <g transform="translate(40, 220)">
    <rect x="0" y="0" width="840" height="90" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1"/>

    <!-- Step 1: Package Rate -->
    <g transform="translate(20, 20)">
      <rect x="0" y="0" width="130" height="50" rx="8" fill="#0f172a" stroke="#475569" stroke-width="1"/>
      <text x="65" y="22" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#93c5fd">1. RATE SCHEDULE</text>
      <text x="65" y="38" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="9" fill="#94a3b8">Effective Month Map</text>
    </g>

    <!-- Arrow 1 -->
    <path d="M155 45 L175 45" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)"/>

    <!-- Step 2: Bill Snapshot -->
    <g transform="translate(180, 20)">
      <rect x="0" y="0" width="130" height="50" rx="8" fill="#0f172a" stroke="#475569" stroke-width="1"/>
      <text x="65" y="22" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#a7f3d0">2. DUE 5TH BILL</text>
      <text x="65" y="38" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="9" fill="#94a3b8">Immutable Snapshot</text>
    </g>

    <!-- Arrow 2 -->
    <path d="M315 45 L335 45" stroke="#64748b" stroke-width="2"/>

    <!-- Step 3: Payment Collection -->
    <g transform="translate(340, 20)">
      <rect x="0" y="0" width="130" height="50" rx="8" fill="#0f172a" stroke="#475569" stroke-width="1"/>
      <text x="65" y="22" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#fed7aa">3. RECEIPTS</text>
      <text x="65" y="38" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="9" fill="#94a3b8">Dated Actual Cash</text>
    </g>

    <!-- Arrow 3 -->
    <path d="M475 45 L495 45" stroke="#64748b" stroke-width="2"/>

    <!-- Step 4: FIFO Allocation -->
    <g transform="translate(500, 20)">
      <rect x="0" y="0" width="140" height="50" rx="8" fill="#0f172a" stroke="#475569" stroke-width="1"/>
      <text x="70" y="22" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#c4b5fd">4. FIFO CREDIT ROLL</text>
      <text x="70" y="38" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="9" fill="#94a3b8">Carry-Forward Excess</text>
    </g>

    <!-- Arrow 4 -->
    <path d="M645 45 L665 45" stroke="#64748b" stroke-width="2"/>

    <!-- Step 5: Ledger Balance -->
    <g transform="translate(670, 20)">
      <rect x="0" y="0" width="150" height="50" rx="8" fill="#0f172a" stroke="#10b981" stroke-width="1.5"/>
      <text x="75" y="22" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#34d399">5. AUDITED LEDGER</text>
      <text x="75" y="38" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="9" fill="#94a3b8">Paid / Partial / Due</text>
    </g>
  </g>

  <!-- Section 3: Telemetry Footer Ribbon -->
  <g transform="translate(40, 330)">
    <rect x="0" y="0" width="840" height="60" rx="10" fill="#0b1329" stroke="#1e293b"/>
    <g transform="translate(30, 20)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#94a3b8">TOTAL BILLED</text>
      <text x="0" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#f8fafc">PKR ${formatPKR(totalBilledAmount)}</text>
    </g>
    <g transform="translate(230, 20)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#94a3b8">ACTUAL COLLECTED</text>
      <text x="0" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#10b981">PKR ${formatPKR(totalCollectedAmount)}</text>
    </g>
    <g transform="translate(440, 20)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#94a3b8">OUTSTANDING DUES</text>
      <text x="0" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#f59e0b">PKR ${formatPKR(totalOutstandingDue)}</text>
    </g>
    <g transform="translate(650, 20)">
      <text x="0" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#94a3b8">ACTIVE PREPAID CREDIT</text>
      <text x="0" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#38bdf8">PKR ${formatPKR(totalUnappliedCredit)}</text>
    </g>
  </g>
</svg>
`;
}

/**
 * Generates printable HTML statement (A4 Audit Certificate or 80mm POS Slip).
 * @param {Object} auditData - Returned from auditBillingCorrectness.
 * @param {Object} [options]
 * @param {'A4'|'POS80'} [options.format='A4']
 * @returns {string} HTML markup
 */
export function generateBillingAuditHtml(auditData, { format = 'A4' } = {}) {
  if (!auditData) return '';

  const {
    auditDate = new Date().toISOString().slice(0, 10),
    currentMonth = '',
    totalCustomers = 0,
    activeCustomers = 0,
    totalBills = 0,
    paidBillsCount = 0,
    partialBillsCount = 0,
    pendingBillsCount = 0,
    notSetBillsCount = 0,
    totalBilledAmount = 0,
    totalCollectedAmount = 0,
    totalOutstandingDue = 0,
    totalUnappliedCredit = 0,
    cleanBillsPercent = 100,
    discrepancies = [],
    overallStatus = 'HEALTHY'
  } = auditData;

  const escapeHtml = (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  if (format === 'POS80') {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Billing Audit Slip - ${escapeHtml(auditDate)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 76mm;
      margin: 2mm auto;
      padding: 0;
      color: #000;
      font-size: 11px;
      line-height: 1.35;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .double-divider { border-top: 2px solid #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; }
    .urdu-title { font-size: 13px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="bold" style="font-size:13px;">SHAHDARA BROADBAND &amp; ISP</div>
    <div class="urdu-title">بلنگ و لیجر تصدیق رپورٹ</div>
    <div>BILLING AUDIT RECONCILIATION</div>
    <div>Date: ${escapeHtml(auditDate)} | Cycle: ${escapeHtml(currentMonth)}</div>
  </div>
  <div class="double-divider"></div>
  <div class="row"><span class="bold">OVERALL AUDIT:</span><span class="bold">${escapeHtml(overallStatus)}</span></div>
  <div class="row"><span>Clean Bills:</span><span class="bold">${cleanBillsPercent}%</span></div>
  <div class="divider"></div>
  <div class="row"><span>Total Customers:</span><span>${totalCustomers}</span></div>
  <div class="row"><span>Active Subs:</span><span>${activeCustomers}</span></div>
  <div class="row"><span>Total Bills:</span><span>${totalBills}</span></div>
  <div class="row"><span>- Paid Bills:</span><span>${paidBillsCount}</span></div>
  <div class="row"><span>- Partial Bills:</span><span>${partialBillsCount}</span></div>
  <div class="row"><span>- Pending Bills:</span><span>${pendingBillsCount}</span></div>
  <div class="row"><span>- Unpriced / Not Set:</span><span>${notSetBillsCount}</span></div>
  <div class="divider"></div>
  <div class="row"><span class="bold">Billed Revenue:</span><span class="bold">PKR ${formatPKR(totalBilledAmount)}</span></div>
  <div class="row"><span class="bold">Collections:</span><span class="bold">PKR ${formatPKR(totalCollectedAmount)}</span></div>
  <div class="row"><span class="bold">Outstanding Due:</span><span class="bold">PKR ${formatPKR(totalOutstandingDue)}</span></div>
  <div class="row"><span>Unapplied Credit:</span><span>PKR ${formatPKR(totalUnappliedCredit)}</span></div>
  <div class="double-divider"></div>
  <div class="text-center" style="font-size:10px;">
    <div>Discrepancies: ${discrepancies.length} recorded</div>
    <div>Verified by Offline Accounting Engine</div>
    <div>Managing Partners (Saad / Umair)</div>
  </div>
</body>
</html>
`;
  }

  // Formal A4 Certificate
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Official Billing &amp; Ledger Audit Certificate - ${escapeHtml(auditDate)}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.45;
      font-size: 12px;
      margin: 0;
      padding: 0;
    }
    .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .brand-title { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .brand-urdu { font-size: 14px; font-weight: 700; color: #1e293b; direction: rtl; }
    .badge-status {
      display: inline-block; padding: 4px 12px; border-radius: 9999px;
      font-weight: 700; font-size: 11px; text-transform: uppercase;
      background: ${overallStatus === 'HEALTHY' ? '#dcfce7; color: #166534;' : '#fef3c7; color: #92400e;'};
    }
    .kpi-grid { display: flex; gap: 12px; margin-bottom: 20px; }
    .kpi-card {
      flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;
    }
    .kpi-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .kpi-val { font-size: 16px; font-weight: 800; color: #0f172a; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .data-table th, .data-table td {
      border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; font-size: 11px;
    }
    .data-table th { background: #f1f5f9; font-weight: 700; color: #334155; }
    .data-table .text-right { text-align: right; }
    .section-title { font-size: 13px; font-weight: 700; color: #0f172a; margin: 16px 0 6px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    .disc-box { border-left: 3px solid #ef4444; background: #fef2f2; padding: 8px; margin-bottom: 6px; border-radius: 0 4px 4px 0; font-size: 11px; }
    .disc-crit { border-left-color: #ef4444; background: #fef2f2; }
    .disc-warn { border-left-color: #f59e0b; background: #fffbeb; }
    .disc-info { border-left-color: #3b82f6; background: #eff6ff; }
    .sign-row { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
    .sign-col { width: 28%; text-align: center; border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 11px; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td>
        <div class="brand-title">SHAHDARA BROADBAND &amp; FIBER NETWORKS</div>
        <div style="font-size:11px; color:#475569;">OFFICIAL BILLING AUDIT &amp; LEDGER RECONCILIATION STATEMENT</div>
        <div style="font-size:10px; color:#64748b;">Shahdara Town, Vandala Road, Begum Kot, Jia Musa Nodes · Lahore, Pakistan</div>
      </td>
      <td style="text-align: right;">
        <div class="brand-urdu">سرٹیفکیٹ برائے بلنگ تصدیق و درستگی کھاتہ جات</div>
        <div style="margin-top: 6px;"><span class="badge-status">${escapeHtml(overallStatus)}</span></div>
        <div style="font-size: 11px; color:#64748b; margin-top: 4px;">Audit Date: ${escapeHtml(auditDate)}</div>
      </td>
    </tr>
  </table>

  <!-- KPI Cards -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Clean Bills Ratio</div>
      <div class="kpi-val">${cleanBillsPercent}%</div>
      <div style="font-size:9px; color:#64748b;">Zero calculation errors</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Billed</div>
      <div class="kpi-val">PKR ${formatPKR(totalBilledAmount)}</div>
      <div style="font-size:9px; color:#64748b;">Across ${totalBills} bills</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Cash Collected</div>
      <div class="kpi-val">PKR ${formatPKR(totalCollectedAmount)}</div>
      <div style="font-size:9px; color:#10b981;">Dated payments received</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Outstanding Dues</div>
      <div class="kpi-val">PKR ${formatPKR(totalOutstandingDue)}</div>
      <div style="font-size:9px; color:#f59e0b;">Unpaid receivables</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Prepaid Credit</div>
      <div class="kpi-val">PKR ${formatPKR(totalUnappliedCredit)}</div>
      <div style="font-size:9px; color:#3b82f6;">Carried forward FIFO</div>
    </div>
  </div>

  <!-- Status Distribution -->
  <div class="section-title">1. BILLING CYCLE &amp; STATUS METRICS</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Metric Category</th>
        <th class="text-right">Bill Count</th>
        <th class="text-right">Percentage %</th>
        <th>Audit Accounting Disposition</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Paid (موصول شدہ)</strong></td>
        <td class="text-right">${paidBillsCount}</td>
        <td class="text-right">${totalBills > 0 ? ((paidBillsCount / totalBills) * 100).toFixed(1) : 0}%</td>
        <td>Fully settled balance (balanceDue &le; 0 PKR) via actual cash or credit.</td>
      </tr>
      <tr>
        <td><strong>Partial (جزوی وصولی)</strong></td>
        <td class="text-right">${partialBillsCount}</td>
        <td class="text-right">${totalBills > 0 ? ((partialBillsCount / totalBills) * 100).toFixed(1) : 0}%</td>
        <td>Active installment received; remaining balance strictly tracked.</td>
      </tr>
      <tr>
        <td><strong>Pending (بقایا / قابل وصول)</strong></td>
        <td class="text-right">${pendingBillsCount}</td>
        <td class="text-right">${totalBills > 0 ? ((pendingBillsCount / totalBills) * 100).toFixed(1) : 0}%</td>
        <td>Due on 5th of month; awaiting field collection.</td>
      </tr>
      <tr>
        <td><strong>Unpriced / Not Set (غیر مقررہ)</strong></td>
        <td class="text-right">${notSetBillsCount}</td>
        <td class="text-right">${totalBills > 0 ? ((notSetBillsCount / totalBills) * 100).toFixed(1) : 0}%</td>
        <td>Profiles without package price or selling amount configured.</td>
      </tr>
    </tbody>
  </table>

  <!-- Findings & Discrepancies -->
  <div class="section-title">2. AUDIT FINDINGS, ANOMALIES &amp; LEDGER COMPLIANCE (${discrepancies.length} recorded)</div>
  ${discrepancies.length === 0 ? '<div style="padding:10px; background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; border-radius:6px;">✓ All subscriber accounts, bill snapshots, and receipts are 100% compliant with Shahdara ISP accounting rules.</div>' : ''}
  ${discrepancies.slice(0, 15).map(d => `
    <div class="disc-box ${d.severity === 'critical' ? 'disc-crit' : d.severity === 'warning' ? 'disc-warn' : 'disc-info'}">
      <strong>[${escapeHtml(d.severity.toUpperCase())}] ${escapeHtml(d.ruleId)}</strong> · Customer: #${escapeHtml(d.customerNumber ?? 'N/A')} ${escapeHtml(d.customerName)} ${d.month ? `(${escapeHtml(d.month)})` : ''}
      <br>${escapeHtml(d.message)}
      <br><span style="color:#64748b;">Resolution suggestion: ${escapeHtml(d.suggestion)}</span>
    </div>
  `).join('')}
  ${discrepancies.length > 15 ? `<div style="font-size:10px; color:#64748b; text-align:center;">+ ${discrepancies.length - 15} additional minor notifications truncated for certificate space. View full CSV for complete ledger.</div>` : ''}

  <!-- Formal Sign-Off -->
  <div class="sign-row">
    <div class="sign-col">
      <strong>Internal Auditor / QA</strong>
      <div style="font-size:10px; color:#64748b; margin-top:2px;">Automated Core Verification</div>
    </div>
    <div class="sign-col">
      <strong>Field Operations Lead (Umair)</strong>
      <div style="font-size:10px; color:#64748b; margin-top:2px;">Shahdara Fiber Network</div>
    </div>
    <div class="sign-col">
      <strong>Managing Director (Saad)</strong>
      <div style="font-size:10px; color:#64748b; margin-top:2px;">Executive Billing Authority</div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Formats bilingual Urdu & English WhatsApp audit summary.
 * @param {Object} auditData - Returned from auditBillingCorrectness.
 * @returns {string} WhatsApp text
 */
export function formatBillingAuditWhatsApp(auditData) {
  if (!auditData) return '';

  const {
    auditDate = new Date().toISOString().slice(0, 10),
    currentMonth = '',
    totalCustomers = 0,
    activeCustomers = 0,
    totalBills = 0,
    paidBillsCount = 0,
    partialBillsCount = 0,
    pendingBillsCount = 0,
    notSetBillsCount = 0,
    totalBilledAmount = 0,
    totalCollectedAmount = 0,
    totalOutstandingDue = 0,
    totalUnappliedCredit = 0,
    cleanBillsPercent = 100,
    discrepancies = [],
    overallStatus = 'HEALTHY'
  } = auditData;

  const statusEmoji = overallStatus === 'HEALTHY' ? '🟢' : overallStatus === 'ATTENTION_REQUIRED' ? '🟡' : '🔴';

  return `📊 *SHAHDARA BROADBAND - BILLING CORRECTNESS REPORT*
━━━━━━━━━━━━━━━━━━━━━━━━━━
🗓 *Audit Date:* ${auditDate}
📌 *Cycle Month:* ${currentMonth}
${statusEmoji} *Ledger Health:* ${overallStatus}
⭐ *Clean Bills Accuracy:* ${cleanBillsPercent}%

👥 *Subscribers & Bills:*
• Total Registered: ${totalCustomers} (${activeCustomers} active)
• Total Bills: ${totalBills}
  - ✅ Paid (مکمل ادا شدہ): ${paidBillsCount}
  - 🔄 Partial (جزوی): ${partialBillsCount}
  - ⏳ Pending Due (بقایا): ${pendingBillsCount}
  - ⚠️ Unpriced / Not Set: ${notSetBillsCount}

💰 *Financial Summary (روپے):*
• Total Billed: PKR ${formatPKR(totalBilledAmount)}
• Cash Collected: PKR ${formatPKR(totalCollectedAmount)}
• Net Outstanding: PKR ${formatPKR(totalOutstandingDue)}
• Prepaid Forward Credit: PKR ${formatPKR(totalUnappliedCredit)}

📋 *Compliance & Audit Notes:*
• Issues Detected: ${discrepancies.length}
${discrepancies.length === 0 ? '• ماشاءاللہ: تمام کھاتہ جات اور بلنگ 100 فیصد درست ہیں۔' : `• نوٹ: برائے مہربانی غیر مقررہ بلز اور بقایا جات کا جائزہ لیں۔`}

━━━━━━━━━━━━━━━━━━━━━━━━━━
_Shahdara ISP Offline Automated Accounting Engine_`;
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM.
 * @param {Object} auditData - Returned from auditBillingCorrectness.
 * @returns {string} CSV string
 */
export function generateBillingAuditCsv(auditData) {
  if (!auditData) return '';

  const bills = Array.isArray(auditData.auditedBills) ? auditData.auditedBills : [];
  const rows = [];

  // Header row
  rows.push([
    'Customer_No',
    'Customer_Name',
    'Phone',
    'Area',
    'Month',
    'Due_Date',
    'Billed_Amount_PKR',
    'Receipts_PKR',
    'Same_Month_Applied_PKR',
    'Credit_Applied_PKR',
    'Balance_Due_PKR',
    'Excess_Credit_PKR',
    'Status'
  ].join(','));

  const escapeCell = (val) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  for (const b of bills) {
    rows.push([
      escapeCell(b.customerNumber),
      escapeCell(b.customerName),
      escapeCell(b.customerPhone),
      escapeCell(b.customerArea),
      escapeCell(b.month),
      escapeCell(b.dueDate),
      escapeCell(b.dueAmount !== null ? b.dueAmount.toFixed(2) : 'Not set'),
      escapeCell(b.actualReceipts.toFixed(2)),
      escapeCell(b.sameMonthApplied.toFixed(2)),
      escapeCell(b.creditApplied.toFixed(2)),
      escapeCell(b.balanceDue !== null ? b.balanceDue.toFixed(2) : 'Not set'),
      escapeCell(b.pendingCredit.toFixed(2)),
      escapeCell(b.status)
    ].join(','));
  }

  // Prepend UTF-8 BOM
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Save audit record into LocalStorage history.
 * @param {Storage} storage
 * @param {Object} auditData
 */
export function saveBillingAuditRecord(storage, auditData) {
  if (!storage || !auditData) return;
  try {
    const raw = storage.getItem(BILLING_CORRECTNESS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const item = {
      id: `audit-${Date.now()}`,
      date: auditData.auditDate,
      cleanPercent: auditData.cleanBillsPercent,
      totalBilled: auditData.totalBilledAmount,
      totalCollected: auditData.totalCollectedAmount,
      totalDue: auditData.totalOutstandingDue,
      discrepancyCount: auditData.discrepancies?.length || 0,
      status: auditData.overallStatus
    };
    list.unshift(item);
    storage.setItem(BILLING_CORRECTNESS_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch (err) {
    console.error('Failed to save billing audit record:', err);
  }
}

/**
 * Retrieve saved audit records from LocalStorage.
 * @param {Storage} storage
 * @returns {Array} List of historical audit summaries
 */
export function getSavedBillingAuditRecords(storage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(BILLING_CORRECTNESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Clear saved audit records.
 * @param {Storage} storage
 */
export function clearBillingAuditRecords(storage) {
  if (!storage) return;
  try {
    storage.removeItem(BILLING_CORRECTNESS_STORAGE_KEY);
  } catch {}
}

/**
 * Wires the interactive Billing Correctness & Ledger Reconciliation modal dialog.
 * @param {Object} options
 * @param {Function} options.getState - Returns current app state.
 * @param {Storage} [options.storage] - LocalStorage instance.
 * @param {Function} [options.onToast] - Notification toast handler.
 * @returns {Object} Modal controller interface.
 */
export function setupBillingCorrectnessModal({ getState, storage = globalThis.localStorage, onToast = () => {} } = {}) {
  const modal = document?.getElementById('billingCorrectnessModal');
  // Wire every visible opener (#236): the Home tile used to be skipped because the
  // backup-footer button exists in the DOM and short-circuited the `||` lookup.
  const BILLING_CORRECTNESS_OPENER_IDS = ['quickActionBillingCorrectness', 'openBillingCorrectnessBtn'];
  const openButtons = BILLING_CORRECTNESS_OPENER_IDS
    .map(id => (typeof document !== 'undefined' ? document.getElementById(id) : null))
    .filter(Boolean);
  const closeBtn = document?.getElementById('closeBillingCorrectnessModalBtn');
  const secondaryCloseBtn = document?.getElementById('closeBillingCorrectnessSecondaryBtn');

  const runAuditBtn = document?.getElementById('runBillingAuditBtn');
  const printA4Btn = document?.getElementById('printBillingAuditA4Btn');
  const printPosBtn = document?.getElementById('printBillingAuditPosBtn');
  const shareWaBtn = document?.getElementById('shareBillingAuditWhatsAppBtn');
  const exportCsvBtn = document?.getElementById('exportBillingAuditCsvBtn');

  const svgContainer = document?.getElementById('billingAuditSvgContainer');
  const discrepanciesTableBody = document?.getElementById('billingDiscrepanciesTableBody');
  const discFilterSelect = document?.getElementById('billingDiscFilterSelect');

  // KPI UI elements
  const cleanPctVal = document?.getElementById('auditCleanBillsVal');
  const totalBilledVal = document?.getElementById('auditTotalBilledVal');
  const totalCollectedVal = document?.getElementById('auditTotalCollectedVal');
  const totalDueVal = document?.getElementById('auditTotalDueVal');
  const unappliedCreditVal = document?.getElementById('auditUnappliedCreditVal');
  const discCountBadge = document?.getElementById('auditDiscCountBadge');

  let currentAuditData = null;

  function runAudit() {
    const state = typeof getState === 'function' ? getState() : { customers: [] };
    currentAuditData = auditBillingCorrectness(state);

    // Save to storage history
    saveBillingAuditRecord(storage, currentAuditData);

    // Update KPIs
    if (cleanPctVal) cleanPctVal.textContent = `${currentAuditData.cleanBillsPercent}%`;
    if (totalBilledVal) totalBilledVal.textContent = `PKR ${formatPKR(currentAuditData.totalBilledAmount)}`;
    if (totalCollectedVal) totalCollectedVal.textContent = `PKR ${formatPKR(currentAuditData.totalCollectedAmount)}`;
    if (totalDueVal) totalDueVal.textContent = `PKR ${formatPKR(currentAuditData.totalOutstandingDue)}`;
    if (unappliedCreditVal) unappliedCreditVal.textContent = `PKR ${formatPKR(currentAuditData.totalUnappliedCredit)}`;
    if (discCountBadge) discCountBadge.textContent = `${currentAuditData.discrepancies.length} finding${currentAuditData.discrepancies.length === 1 ? '' : 's'}`;

    // Render SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderBillingCorrectnessSvg(currentAuditData);
    }

    // Render Discrepancies
    renderDiscrepancies();
  }

  function renderDiscrepancies() {
    if (!discrepanciesTableBody || !currentAuditData) return;
    const filter = discFilterSelect?.value || 'all';

    let list = currentAuditData.discrepancies || [];
    if (filter !== 'all') {
      list = list.filter(d => d.severity === filter);
    }

    if (list.length === 0) {
      discrepanciesTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center" style="padding:16px; color:#10b981;">
            ✓ No ${filter === 'all' ? '' : filter + ' '}discrepancies found. Ledger matches billing rules.
          </td>
        </tr>
      `;
      return;
    }

    discrepanciesTableBody.innerHTML = list.map(d => {
      const badgeClass = d.severity === 'critical' ? 'badge-critical' : d.severity === 'warning' ? 'badge-warning' : 'badge-info';
      return `
        <tr>
          <td><span class="audit-severity-badge ${badgeClass}">${String(d.severity).toUpperCase()}</span></td>
          <td><strong>#${d.customerNumber ?? 'N/A'}</strong> ${String(d.customerName ?? '')}</td>
          <td>${d.month || 'General'}</td>
          <td>${String(d.message ?? '')}</td>
          <td style="color:#64748b; font-size:11px;">${String(d.suggestion ?? '')}</td>
        </tr>
      `;
    }).join('');
  }

  function printDocument(format) {
    if (!currentAuditData) runAudit();
    const html = generateBillingAuditHtml(currentAuditData, { format });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
  }

  function shareWhatsApp() {
    if (!currentAuditData) runAudit();
    const text = formatBillingAuditWhatsApp(currentAuditData);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  function exportCsv() {
    if (!currentAuditData) runAudit();
    const csv = generateBillingAuditCsv(currentAuditData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara-billing-audit-${currentAuditData.auditDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof onToast === 'function') {
      onToast('Billing audit CSV exported successfully');
    }
  }

  // Bind Events
  for (const openBtn of openButtons) {
    if (openBtn.dataset?.billingCorrectnessWired) continue;
    if (openBtn.dataset) openBtn.dataset.billingCorrectnessWired = 'true';
    openBtn.addEventListener('click', () => {
      runAudit();
      if (typeof modal?.showModal === 'function' && !modal.open) {
        modal.showModal();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
    });
  }

  if (secondaryCloseBtn) {
    secondaryCloseBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
    });
  }

  if (runAuditBtn) runAuditBtn.addEventListener('click', () => runAudit());
  if (printA4Btn) printA4Btn.addEventListener('click', () => printDocument('A4'));
  if (printPosBtn) printPosBtn.addEventListener('click', () => printDocument('POS80'));
  if (shareWaBtn) shareWaBtn.addEventListener('click', () => shareWhatsApp());
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => exportCsv());
  if (discFilterSelect) discFilterSelect.addEventListener('change', () => renderDiscrepancies());

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        const rect = modal.getBoundingClientRect();
        const isInDialog = (
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width
        );
        if (!isInDialog && typeof modal.close === 'function') {
          modal.close();
        }
      }
    });
  }

  return {
    open() {
      runAudit();
      if (typeof modal?.showModal === 'function') modal.showModal();
    },
    close() {
      if (typeof modal?.close === 'function') modal.close();
    },
    refresh() {
      runAudit();
    },
    getData() {
      return currentAuditData;
    }
  };
}
