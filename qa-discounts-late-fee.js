/**
 * @file qa-discounts-late-fee.js
 * @description Shahdara Broadband ISP - Owner Discounts & Late Fee Policy Management Suite.
 * Provides per-receipt discount tracking, owner-configured late fee policies (OFF by default,
 * applied only by explicit owner action, never automatic), correct balance math, overdue
 * eligibility auditing, dual printable formats (A4 & 80mm POS slip), WhatsApp dispatch notices,
 * RFC-4180 CSV export, and pure-vector SVG visualization.
 *
 * Rules:
 * 1. Scope: Offline billing/business app for small Pakistani ISP.
 * 2. Late Fee: OFF by default. Applied ONLY by explicit owner action. Never automatic.
 * 3. Discounts: Per-receipt discount field. Waives remaining bill balance without creating cash credit.
 * 4. Balance Math: Gross Payable = Bill Due + Late Fee. Net Balance = Gross Payable - Credits - Payments - Discounts.
 * 5. Transparency: Late fees and discounts are recorded in amountHistory and displayed on receipts and reports.
 */

import {
  calculatePaymentAllocations,
  derivedBillStatus,
  formatPKR,
  monthsForHistory,
  applyLateFeeToBill,
  waiveLateFeeFromBill
} from './core.js';

export const LATE_FEE_CONFIG_KEY = 'shahdara_late_fee_config_v1';

export const DEFAULT_LATE_FEE_CONFIG = Object.freeze({
  enabled: false,           // OFF by default
  defaultAmount: 100,       // Default late fee PKR 100
  dueDay: 5,                // Standard 5th of month due date
  graceDays: 0,             // Extra grace days before flagging overdue
  reason: 'Late payment surcharge / جرمانہ تاخیر ادائیگی',
  currency: 'PKR'
});

/**
 * Retrieve owner-configured late fee policy from storage.
 * @param {Storage} [storage=localStorage]
 * @returns {typeof DEFAULT_LATE_FEE_CONFIG}
 */
export function getLateFeeConfig(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return { ...DEFAULT_LATE_FEE_CONFIG };
  try {
    const raw = storage.getItem(LATE_FEE_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_LATE_FEE_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      defaultAmount: Number.isFinite(Number(parsed.defaultAmount)) && Number(parsed.defaultAmount) > 0
        ? Math.round(Number(parsed.defaultAmount) * 100) / 100
        : DEFAULT_LATE_FEE_CONFIG.defaultAmount,
      dueDay: Number.isInteger(Number(parsed.dueDay)) && Number(parsed.dueDay) >= 1 && Number(parsed.dueDay) <= 28
        ? Number(parsed.dueDay)
        : DEFAULT_LATE_FEE_CONFIG.dueDay,
      graceDays: Number.isInteger(Number(parsed.graceDays)) && Number(parsed.graceDays) >= 0
        ? Number(parsed.graceDays)
        : DEFAULT_LATE_FEE_CONFIG.graceDays,
      reason: typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason.trim()
        : DEFAULT_LATE_FEE_CONFIG.reason,
      currency: 'PKR'
    };
  } catch {
    return { ...DEFAULT_LATE_FEE_CONFIG };
  }
}

/**
 * Save owner-configured late fee policy to storage.
 * @param {Partial<typeof DEFAULT_LATE_FEE_CONFIG>} config
 * @param {Storage} [storage=localStorage]
 * @returns {boolean}
 */
export function saveLateFeeConfig(config, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !config || typeof config !== 'object') return false;
  try {
    const current = getLateFeeConfig(storage);
    const updated = {
      enabled: config.enabled !== undefined ? Boolean(config.enabled) : current.enabled,
      defaultAmount: Number.isFinite(Number(config.defaultAmount)) && Number(config.defaultAmount) > 0
        ? Math.round(Number(config.defaultAmount) * 100) / 100
        : current.defaultAmount,
      dueDay: Number.isInteger(Number(config.dueDay)) && Number(config.dueDay) >= 1 && Number(config.dueDay) <= 28
        ? Number(config.dueDay)
        : current.dueDay,
      graceDays: Number.isInteger(Number(config.graceDays)) && Number(config.graceDays) >= 0
        ? Number(config.graceDays)
        : current.graceDays,
      reason: typeof config.reason === 'string' && config.reason.trim()
        ? config.reason.trim()
        : current.reason,
      currency: 'PKR'
    };
    storage.setItem(LATE_FEE_CONFIG_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a per-receipt discount amount and optional reason.
 * @param {number|string} discount
 * @param {number} [maxAllowed]
 * @returns {{ valid: boolean, amount: number, message: string }}
 */
export function validatePaymentDiscount(discount, maxAllowed = Infinity) {
  if (discount === undefined || discount === null || discount === '') {
    return { valid: true, amount: 0, message: '' };
  }
  const num = Number(discount);
  if (!Number.isFinite(num)) {
    return { valid: false, amount: 0, message: 'Discount must be a valid number.' };
  }
  if (num < 0) {
    return { valid: false, amount: 0, message: 'Discount cannot be negative.' };
  }
  if (num > maxAllowed) {
    return { valid: false, amount: num, message: `Discount cannot exceed remaining payable amount (${formatPKR(maxAllowed)}).` };
  }
  return { valid: true, amount: Math.round(num * 100) / 100, message: '' };
}

/**
 * Calculates net bill settlement parameters with discounts and late fee.
 * @param {Object} params
 * @param {number} params.billDue
 * @param {number} [params.lateFee=0]
 * @param {number} [params.carryInCredit=0]
 * @param {number} [params.paymentAmount=0]
 * @param {number} [params.discount=0]
 * @returns {Object} Settlement breakdown
 */
export function calculateNetBillSettlement({
  billDue = 0,
  lateFee = 0,
  carryInCredit = 0,
  paymentAmount = 0,
  discount = 0
}) {
  const baseDue = Math.max(0, Number(billDue) || 0);
  const fee = Math.max(0, Number(lateFee) || 0);
  const credit = Math.max(0, Number(carryInCredit) || 0);
  const cash = Math.max(0, Number(paymentAmount) || 0);
  const disc = Math.max(0, Number(discount) || 0);

  const grossPayable = baseDue + fee;
  const netBeforePayment = Math.max(0, grossPayable - credit);

  const appliedDiscount = Math.min(disc, netBeforePayment);
  const netAfterDiscount = netBeforePayment - appliedDiscount;

  const appliedCash = Math.min(cash, netAfterDiscount);
  const balanceDue = Math.max(0, netAfterDiscount - appliedCash);
  const excessCash = Math.max(0, cash - appliedCash);

  let status = 'pending';
  if (grossPayable <= 0) {
    status = 'not-set';
  } else if (balanceDue === 0) {
    status = 'paid';
  } else if (appliedCash > 0 || appliedDiscount > 0 || credit > 0) {
    status = 'partial';
  }

  return {
    baseDue,
    lateFee: fee,
    grossPayable,
    carryInCredit: credit,
    netBeforePayment,
    discountRequested: disc,
    discountApplied: appliedDiscount,
    cashReceived: cash,
    cashApplied: appliedCash,
    excessCashCredit: excessCash,
    balanceDue,
    status
  };
}

/**
 * Checks if a bill is currently overdue relative to a reference date.
 * @param {Object} bill
 * @param {Object} [options]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {number} [options.graceDays=0]
 * @returns {{ isOverdue: boolean, dueDate: string, daysOverdue: number }}
 */
export function isBillOverdue(bill, { referenceDate = new Date(), graceDays = 0 } = {}) {
  if (!bill || !bill.dueDate) return { isOverdue: false, dueDate: '', daysOverdue: 0 };
  const dStr = String(bill.dueDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return { isOverdue: false, dueDate: '', daysOverdue: 0 };

  const ref = new Date(referenceDate);
  const todayStr = ref.toISOString().slice(0, 10);

  const due = new Date(`${dStr}T00:00:00.000Z`);
  const current = new Date(`${todayStr}T00:00:00.000Z`);

  const diffTime = current.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const grace = Math.max(0, Number(graceDays) || 0);
  const isOverdue = diffDays > grace;

  return {
    isOverdue,
    dueDate: dStr,
    daysOverdue: Math.max(0, diffDays)
  };
}

/**
 * Evaluates whether a customer bill is eligible for an explicit owner late fee.
 * @param {Object} customer
 * @param {Object} bill
 * @param {Object} [options]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {Object} [options.config]
 * @param {Object} [options.allocations]
 * @returns {Object}
 */
export function evaluateBillLateFeeEligibility(customer, bill, {
  referenceDate = new Date(),
  config = null,
  allocations = null
} = {}) {
  const policy = config || getLateFeeConfig();
  const alloc = allocations || calculatePaymentAllocations({ customers: [customer] });
  const summary = alloc.forMonth(customer.id, bill.month);

  const balanceDue = summary?.balanceDueCents !== null && summary?.balanceDueCents !== undefined
    ? summary.balanceDueCents / 100
    : Number(bill.dueAmount) || 0;

  const overdueCheck = isBillOverdue(bill, {
    referenceDate,
    graceDays: policy.graceDays
  });

  const hasLateFee = Boolean(bill.lateFee && Number(bill.lateFee) > 0);
  const currentLateFee = hasLateFee ? Number(bill.lateFee) : 0;

  // Eligible for new late fee if:
  // - Bill is overdue past dueDate + graceDays
  // - Has remaining unpaid balance (> 0)
  // - Customer is not archived
  // - Late fee is NOT already applied
  // - Late fee policy is enabled by owner
  const eligible = Boolean(policy.enabled) && overdueCheck.isOverdue && balanceDue > 0 && !customer.archived && !hasLateFee;

  return {
    eligible,
    isOverdue: overdueCheck.isOverdue,
    daysOverdue: overdueCheck.daysOverdue,
    dueDate: overdueCheck.dueDate,
    balanceDue,
    hasLateFee,
    currentLateFee,
    suggestedLateFee: policy.defaultAmount,
    suggestedReason: policy.reason,
    lateFeeAppliedAt: bill.lateFeeAppliedAt || null,
    lateFeeReason: bill.lateFeeReason || '',
    policyEnabled: policy.enabled
  };
}

/**
 * Audits all active customer bills in the state to compile a full Late Fee & Discount roster.
 * @param {Object} state
 * @param {Object} [options]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {Object} [options.config]
 * @returns {Object} Complete audit dataset and summary KPIs
 */
export function findOverdueBillsWithLateFeeStatus(state, {
  referenceDate = new Date(),
  config = null
} = {}) {
  const policy = config || getLateFeeConfig();
  const allocations = calculatePaymentAllocations(state);

  const rows = [];
  let totalOverdueCount = 0;
  let eligibleCount = 0;
  let appliedCount = 0;
  let totalLateFeeAppliedPkr = 0;
  let totalDiscountsGivenPkr = 0;
  let totalOverdueBalancePkr = 0;

  for (const customer of state.customers) {
    if (customer.archived) continue;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];

    for (const bill of bills) {
      if (!bill.dueAmount || Number(bill.dueAmount) <= 0) continue;

      const evalResult = evaluateBillLateFeeEligibility(customer, bill, {
        referenceDate,
        config: policy,
        allocations
      });

      // Calculate total discounts recorded on this bill
      const billDiscounts = (bill.payments ?? []).reduce((sum, p) => sum + (Number(p.discount) || 0), 0);
      totalDiscountsGivenPkr += billDiscounts;

      if (evalResult.hasLateFee) {
        appliedCount++;
        totalLateFeeAppliedPkr += evalResult.currentLateFee;
      }

      if (evalResult.isOverdue && evalResult.balanceDue > 0) {
        totalOverdueCount++;
        totalOverdueBalancePkr += evalResult.balanceDue;
        if (evalResult.eligible) {
          eligibleCount++;
        }

        rows.push({
          customerId: customer.id,
          customerNumber: customer.customerNumber,
          customerName: customer.name,
          phone: customer.phone || '',
          mohalla: customer.mohalla || '',
          month: bill.month,
          dueDate: evalResult.dueDate,
          daysOverdue: evalResult.daysOverdue,
          dueAmount: Number(bill.dueAmount),
          balanceDue: evalResult.balanceDue,
          hasLateFee: evalResult.hasLateFee,
          lateFee: evalResult.currentLateFee,
          lateFeeAppliedAt: evalResult.lateFeeAppliedAt,
          lateFeeReason: evalResult.lateFeeReason,
          discounts: billDiscounts,
          eligibleForLateFee: evalResult.eligible,
          status: derivedBillStatus(customer, bill, allocations)
        });
      }
    }
  }

  // Sort rows: first eligible without late fee (highest balance), then applied
  rows.sort((a, b) => {
    if (a.eligibleForLateFee !== b.eligibleForLateFee) {
      return a.eligibleForLateFee ? -1 : 1;
    }
    return b.daysOverdue - a.daysOverdue;
  });

  return {
    rows,
    metrics: {
      totalOverdueCount,
      eligibleCount,
      appliedCount,
      totalLateFeeAppliedPkr,
      totalDiscountsGivenPkr,
      totalOverdueBalancePkr,
      policyEnabled: policy.enabled,
      defaultFeeAmount: policy.defaultAmount,
      currency: policy.currency
    }
  };
}

/**
 * Batch apply late fee to selected customer bills upon explicit owner action.
 * @param {Object} state
 * @param {Array<{ customerId: string, month: string }>} billKeys
 * @param {Object} [options]
 * @param {number} [options.amount]
 * @param {string} [options.reason]
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Object} Updated state
 */
export function applyLateFeeToEligibleBills(state, billKeys, {
  amount = 100,
  reason = 'Late payment surcharge / جرمانہ تاخیر ادائیگی',
  referenceDate = new Date()
} = {}) {
  if (!Array.isArray(billKeys) || !billKeys.length) return state;
  let currentState = state;
  for (const item of billKeys) {
    if (!item?.customerId || !item?.month) continue;
    try {
      currentState = applyLateFeeToBill(currentState, item.customerId, item.month, {
        amount,
        reason
      }, referenceDate);
    } catch {
      // Continue applying to other valid items
    }
  }
  return currentState;
}

/**
 * Batch waive late fee from selected customer bills upon explicit owner action.
 * @param {Object} state
 * @param {Array<{ customerId: string, month: string }>} billKeys
 * @param {Object} [options]
 * @param {string} [options.reason]
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Object} Updated state
 */
export function waiveLateFeeFromBills(state, billKeys, {
  reason = 'Late fee waived by owner / مالک کی جانب سے جرمانہ معاف',
  referenceDate = new Date()
} = {}) {
  if (!Array.isArray(billKeys) || !billKeys.length) return state;
  let currentState = state;
  for (const item of billKeys) {
    if (!item?.customerId || !item?.month) continue;
    try {
      currentState = waiveLateFeeFromBill(currentState, item.customerId, item.month, {
        reason
      }, referenceDate);
    } catch {
      // Continue
    }
  }
  return currentState;
}

/**
 * Formats bilingual Urdu & English WhatsApp reminder for overdue bill including late fee status.
 * @param {Object} params
 * @param {Object} params.customer
 * @param {Object} params.row
 * @param {Object} [params.config]
 * @returns {string} WhatsApp message text
 */
export function formatLateFeeNoticeWhatsApp({ customer, row, config = null }) {
  const policy = config || getLateFeeConfig();
  const feeText = row.hasLateFee
    ? `⚠️ Late fee of PKR ${row.lateFee} has been applied (${row.lateFeeReason || 'Overdue'}).`
    : `⚠️ Late fee of PKR ${policy.defaultAmount} will apply if not settled promptly.`;
  const feeTextUrdu = row.hasLateFee
    ? `⚠️ تاخیر کی وجہ سے PKR ${row.lateFee} لیٹ فیس لاگو کی جا چکی ہے۔`
    : `⚠️ براہ کرم فوری ادائیگی کریں تاکہ لیٹ فیس لاگو نہ ہو۔`;

  return [
    `*SHAH DARA BROADBAND - OVERDUE BILL NOTICE / بل ادائیگی نوٹس*`,
    `----------------------------------------`,
    `محترم صارف: *${customer.name}* (ID: #${customer.customerNumber})`,
    `علاقہ / محلہ: ${customer.mohalla || 'Shahdara'}`,
    `بل کا مہینہ: *${row.month}*`,
    `آخری تاریخ: *${row.dueDate || '5th of month'}* (${row.daysOverdue} days overdue)`,
    ``,
    `اصل بل / Monthly Bill: *PKR ${row.dueAmount}*`,
    row.hasLateFee ? `لیٹ فیس / Late Surcharge: *+PKR ${row.lateFee}*` : null,
    row.discounts > 0 ? `رعایت / Concession: *-PKR ${row.discounts}*` : null,
    `*کل واجب الادا رقم / Net Due Amount: PKR ${row.balanceDue}*`,
    ``,
    feeTextUrdu,
    feeText,
    ``,
    `ادائیگی کے ذرائع / Payment Options:`,
    `• JazzCash / Easypaisa: 0300-1234567`,
    `• فیلڈ کلکٹر کو نقد ادائیگی کی رسید طلب کریں۔`,
    `شکریہ · شاہدرہ براڈبینڈ نیٹ ورک`
  ].filter(line => line !== null).join('\n');
}

/**
 * Formats bilingual Urdu & English WhatsApp receipt draft showing discounts and late fee.
 * @param {Object} customer
 * @param {Object} receipt
 * @returns {string} WhatsApp receipt draft
 */
export function formatReceiptWithDiscountAndFeeWhatsApp(customer, receipt) {
  const balanceStr = receipt.balanceDueCents === null || receipt.balanceDueCents === undefined
    ? '0'
    : String(receipt.balanceDueCents / 100);

  return [
    `*SHAH DARA BROADBAND - PAYMENT RECEIPT / ادائیگی رسید*`,
    `----------------------------------------`,
    `کسٹمر: *${customer.name}* (ID: #${customer.customerNumber})`,
    `رسید نمبر: *${receipt.transactionId || `RCP-${receipt.paymentDate.replace(/-/g, '')}-${customer.customerNumber}`}*`,
    `تاریخ ادائیگی: *${receipt.paymentDate}*`,
    `پیکیج: *${receipt.package}* (${receipt.speedMbps} Mbps)`,
    ``,
    `پیکیج فیس / Package Rate: PKR ${receipt.nominalPrice}`,
    receipt.lateFee > 0 ? `لیٹ فیس / Late Surcharge: +PKR ${receipt.lateFee}` : null,
    receipt.discount > 0 ? `خصوصی رعایت / Discount: -PKR ${receipt.discount}${receipt.discountReason ? ` (${receipt.discountReason})` : ''}` : null,
    `وصول شدہ رقم / Amount Paid: *PKR ${receipt.paidAmount ?? receipt.amount ?? 0}* (${receipt.paymentMethod || 'Cash'})`,
    `*باقی واجب الادا / Balance Due: PKR ${balanceStr}*`,
    `حیثیت / Status: *${receipt.status}*`,
    ``,
    `بروقت ادائیگی کا شکریہ 🥰`,
    `شاہدرہ براڈبینڈ - 24/7 کسٹمر سپورٹ`
  ].filter(line => line !== null).join('\n');
}

/**
 * Generates RFC-4180 CSV export of overdue bills, late fees, and discounts.
 * @param {Object} state
 * @param {Object} [options]
 * @returns {string} CSV with UTF-8 BOM
 */
export function generateLateFeeDiscountsCsv(state, options = {}) {
  const audit = findOverdueBillsWithLateFeeStatus(state, options);
  const headers = [
    'Customer Number',
    'Customer Name',
    'Phone',
    'Mohalla',
    'Bill Month',
    'Due Date',
    'Days Overdue',
    'Base Bill (PKR)',
    'Late Fee (PKR)',
    'Late Fee Applied At',
    'Late Fee Reason',
    'Discounts Granted (PKR)',
    'Balance Due (PKR)',
    'Status'
  ];

  const escapeCsv = (val) => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = audit.rows.map(row => [
    row.customerNumber,
    row.customerName,
    row.phone,
    row.mohalla,
    row.month,
    row.dueDate,
    row.daysOverdue,
    row.dueAmount,
    row.lateFee,
    row.lateFeeAppliedAt || 'None',
    row.lateFeeReason || 'None',
    row.discounts,
    row.balanceDue,
    row.status.toUpperCase()
  ].map(escapeCsv).join(','));

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Generates printable HTML report for Late Fee & Discounts audit (A4 or 80mm POS slip).
 * @param {Object} params
 * @param {Object} params.state
 * @param {string} [params.format='a4'] - 'a4' or 'thermal'
 * @param {Object} [params.config]
 * @returns {string} HTML markup
 */
export function generateLateFeeAuditPrintHtml({ state, format = 'a4', config = null }) {
  const audit = findOverdueBillsWithLateFeeStatus(state, { config });
  const isThermal = format === 'thermal';
  const now = new Date().toISOString().slice(0, 10);

  if (isThermal) {
    const items = audit.rows.slice(0, 15).map(r => `
      <div style="border-bottom: 1px dashed #000; padding: 4px 0; font-size: 11px;">
        <div><strong>#${r.customerNumber} ${r.customerName}</strong> (${r.month})</div>
        <div>Overdue: ${r.daysOverdue} days | Due: ${r.dueDate}</div>
        <div>Bill: PKR ${r.dueAmount} | Late Fee: +${r.lateFee} | Disc: -${r.discounts}</div>
        <div><strong>Balance Due: PKR ${r.balanceDue}</strong></div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>80mm POS Slip - Overdue & Late Fees</title>
        <style>
          body { font-family: monospace; width: 80mm; margin: 0; padding: 6px; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; }
          .kpi { display: flex; justify-content: space-between; margin: 4px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3 style="margin:0;">SHAHDARA BROADBAND</h3>
          <div>Overdue Dues & Late Fees Manifest</div>
          <div>Date: ${now}</div>
        </div>
        <div class="kpi"><span>Overdue Bills:</span><span>${audit.metrics.totalOverdueCount}</span></div>
        <div class="kpi"><span>Late Fees Applied:</span><span>PKR ${audit.metrics.totalLateFeeAppliedPkr}</span></div>
        <div class="kpi"><span>Total Overdue:</span><span>PKR ${audit.metrics.totalOverdueBalancePkr}</span></div>
        <div style="margin-top:6px;">
          ${items}
        </div>
        <div style="text-align:center; margin-top:8px; font-size:10px;">
          *** END OF COLLECTION MANIFEST ***
        </div>
      </body>
      </html>
    `;
  }

  // Formal A4 Report
  const tableRows = audit.rows.map(r => `
    <tr>
      <td>#${r.customerNumber}</td>
      <td><strong>${r.customerName}</strong><br><small>${r.mohalla || 'Shahdara'}</small></td>
      <td>${r.month}</td>
      <td>${r.dueDate}<br><small style="color:#d9534f;">${r.daysOverdue}d overdue</small></td>
      <td>PKR ${r.dueAmount}</td>
      <td>${r.lateFee > 0 ? `<span style="color:#d9534f; font-weight:bold;">+PKR ${r.lateFee}</span>` : '<span style="color:#777;">None</span>'}</td>
      <td>${r.discounts > 0 ? `<span style="color:#28a745; font-weight:bold;">-PKR ${r.discounts}</span>` : '<span style="color:#777;">0</span>'}</td>
      <td><strong>PKR ${r.balanceDue}</strong></td>
      <td><span style="display:inline-block; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; ${r.status === 'paid' ? 'background:#d4edda; color:#155724;' : r.status === 'partial' ? 'background:#fff3cd; color:#856404;' : 'background:#f8d7da; color:#721c24;'}">${r.status.toUpperCase()}</span></td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Overdue Bills, Late Fees & Discounts Ledger - A4</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 20mm; color: #222; font-size: 13px; line-height: 1.4; }
        .head { display: flex; justify-content: space-between; border-bottom: 2px solid #0056b3; padding-bottom: 12px; margin-bottom: 16px; }
        .brand { font-size: 20px; font-weight: 800; color: #0056b3; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
        .kpi-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; }
        .kpi-box span { font-size: 11px; color: #6c757d; display: block; text-transform: uppercase; font-weight: bold; }
        .kpi-box strong { font-size: 18px; color: #212529; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #dee2e6; padding: 8px; text-align: left; }
        th { background: #e9ecef; font-weight: 600; font-size: 12px; }
        .footer { margin-top: 24px; font-size: 11px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 8px; display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="head">
        <div>
          <div class="brand">SHAHDARA BROADBAND ISP</div>
          <div style="font-size:14px; font-weight:600; color:#333;">Overdue Bills, Late Fees & Discounts Audit Ledger</div>
          <div style="color:#6c757d; font-size:12px;">Policy Status: ${audit.metrics.policyEnabled ? '<strong style="color:#28a745;">ACTIVE (Owner Controlled)</strong>' : '<strong style="color:#6c757d;">OFF (Default)</strong>'} · Default Fee: PKR ${audit.metrics.defaultFeeAmount}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Report Date:</strong> ${now}</div>
          <div><strong>Total Overdue Bills:</strong> ${audit.metrics.totalOverdueCount}</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-box"><span>Overdue Subscriptions</span><strong>${audit.metrics.totalOverdueCount}</strong></div>
        <div class="kpi-box"><span>Eligible for Late Fee</span><strong>${audit.metrics.eligibleCount}</strong></div>
        <div class="kpi-box"><span>Total Late Fees Applied</span><strong style="color:#d9534f;">PKR ${audit.metrics.totalLateFeeAppliedPkr}</strong></div>
        <div class="kpi-box"><span>Total Overdue Balance</span><strong style="color:#0056b3;">PKR ${audit.metrics.totalOverdueBalancePkr}</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Month</th>
            <th>Due Date</th>
            <th>Base Bill</th>
            <th>Late Fee</th>
            <th>Discounts</th>
            <th>Balance Due</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="9" style="text-align:center; padding:20px;">No overdue bills or late fees recorded.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <span>Shahdara ISP Local Billing Correctness System · No automatic late fees without owner authorization.</span>
        <span>Generated offline from browser local storage</span>
      </div>
    </body>
    </html>
  `;
}

/**
 * Renders pure-vector SVG visualization of Late Fee and Discount metrics.
 * @param {Object} metrics
 * @returns {string} SVG string
 */
export function renderLateFeeDiscountsSvg(metrics = {}) {
  const overdueCount = Number(metrics.totalOverdueCount) || 0;
  const eligibleCount = Number(metrics.eligibleCount) || 0;
  const appliedCount = Number(metrics.appliedCount) || 0;
  const lateFeePkr = Number(metrics.totalLateFeeAppliedPkr) || 0;
  const discountPkr = Number(metrics.totalDiscountsGivenPkr) || 0;
  const balancePkr = Number(metrics.totalOverdueBalancePkr) || 0;

  const maxVal = Math.max(1000, balancePkr + lateFeePkr + discountPkr);
  const barW = (val) => Math.min(260, Math.max(10, Math.round((val / maxVal) * 260)));

  return `
    <svg viewBox="0 0 540 220" width="100%" height="220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Late fee and discount analytics visualizer">
      <defs>
        <linearGradient id="lateFeeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#f97316"/>
        </linearGradient>
        <linearGradient id="discGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
        <linearGradient id="balanceGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#6366f1"/>
        </linearGradient>
      </defs>

      <!-- Background Card -->
      <rect x="0" y="0" width="540" height="220" rx="8" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5"/>

      <!-- Header Title -->
      <text x="20" y="28" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="var(--text-color, #1e293b)">Late Fee &amp; Discount Financial Impact</text>
      <text x="20" y="46" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #64748b)">Owner-authorized surcharges vs concessions across Shahdara customers</text>

      <!-- Bar 1: Overdue Balance -->
      <text x="20" y="78" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #334155)">Overdue Balance</text>
      <rect x="150" y="66" width="${barW(balancePkr)}" height="16" rx="4" fill="url(#balanceGrad)"/>
      <text x="${160 + barW(balancePkr)}" y="78" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--text-color, #1e293b)">PKR ${balancePkr}</text>

      <!-- Bar 2: Late Fees Applied -->
      <text x="20" y="112" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #334155)">Late Fees Applied</text>
      <rect x="150" y="100" width="${barW(lateFeePkr)}" height="16" rx="4" fill="url(#lateFeeGrad)"/>
      <text x="${160 + barW(lateFeePkr)}" y="112" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#ef4444">+PKR ${lateFeePkr} (${appliedCount} bills)</text>

      <!-- Bar 3: Discounts Granted -->
      <text x="20" y="146" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #334155)">Discounts Granted</text>
      <rect x="150" y="134" width="${barW(discountPkr)}" height="16" rx="4" fill="url(#discGrad)"/>
      <text x="${160 + barW(discountPkr)}" y="146" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#10b981">-PKR ${discountPkr}</text>

      <!-- KPI Pills at Bottom -->
      <line x1="20" y1="168" x2="520" y2="168" stroke="var(--border-color, #e2e8f0)" stroke-width="1"/>
      <rect x="20" y="178" width="155" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="30" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Total Overdue: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${overdueCount}</tspan></text>

      <rect x="190" y="178" width="155" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="200" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Fee Eligible: <tspan font-weight="700" fill="#ef4444">${eligibleCount}</tspan></text>

      <rect x="360" y="178" width="160" height="30" rx="6" fill="var(--badge-bg, #f1f5f9)"/>
      <text x="370" y="198" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #475569)">Policy: <tspan font-weight="700" fill="${metrics.policyEnabled ? '#10b981' : '#64748b'}">${metrics.policyEnabled ? 'ENABLED' : 'DISABLED (Default)'}</tspan></text>
    </svg>
  `;
}

/**
 * Controller to wire and manage the Late Fee & Discounts modal.
 * @param {Object} options
 * @param {Function} options.getState
 * @param {Function} options.updateState
 * @param {Function} options.toast
 * @returns {Object} Controller interface
 */
export function setupLateFeeModal({ getState, updateState, toast }) {
  const modal = document.getElementById('lateFeeManagerModal');
  if (!modal) return null;

  const togglePolicyCheckbox = document.getElementById('lateFeePolicyToggle');
  const defaultAmountInput = document.getElementById('lateFeeDefaultAmountInput');
  const graceDaysInput = document.getElementById('lateFeeGraceDaysInput');
  const reasonInput = document.getElementById('lateFeeReasonInput');
  const savePolicyBtn = document.getElementById('saveLateFeePolicyBtn');

  const kpiOverdueCount = document.getElementById('lateFeeKpiOverdueCount');
  const kpiEligibleCount = document.getElementById('lateFeeKpiEligibleCount');
  const kpiAppliedTotal = document.getElementById('lateFeeKpiAppliedTotal');
  const kpiDiscountsTotal = document.getElementById('lateFeeKpiDiscountsTotal');

  const tableBody = document.getElementById('lateFeeRosterTableBody');
  const emptyState = document.getElementById('lateFeeRosterEmpty');
  const selectAllCheckbox = document.getElementById('lateFeeSelectAllCheckbox');
  const batchApplyBtn = document.getElementById('lateFeeBatchApplyBtn');
  const batchWaiveBtn = document.getElementById('lateFeeBatchWaiveBtn');
  const printA4Btn = document.getElementById('lateFeePrintA4Btn');
  const printThermalBtn = document.getElementById('lateFeePrintThermalBtn');
  const exportCsvBtn = document.getElementById('lateFeeExportCsvBtn');
  const chartContainer = document.getElementById('lateFeeChartContainer');

  let currentAudit = null;

  const getSelectedKeys = () => {
    if (!tableBody) return [];
    const checked = tableBody.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checked).map(cb => ({
      customerId: cb.dataset.customerId,
      month: cb.dataset.month
    }));
  };

  const renderModalContent = () => {
    const state = getState();
    const config = getLateFeeConfig();

    if (togglePolicyCheckbox) togglePolicyCheckbox.checked = config.enabled;
    if (defaultAmountInput) defaultAmountInput.value = config.defaultAmount;
    if (graceDaysInput) graceDaysInput.value = config.graceDays;
    if (reasonInput) reasonInput.value = config.reason;

    currentAudit = findOverdueBillsWithLateFeeStatus(state, { config });

    if (kpiOverdueCount) kpiOverdueCount.textContent = currentAudit.metrics.totalOverdueCount;
    if (kpiEligibleCount) kpiEligibleCount.textContent = currentAudit.metrics.eligibleCount;
    if (kpiAppliedTotal) kpiAppliedTotal.textContent = `PKR ${currentAudit.metrics.totalLateFeeAppliedPkr}`;
    if (kpiDiscountsTotal) kpiDiscountsTotal.textContent = `PKR ${currentAudit.metrics.totalDiscountsGivenPkr}`;

    if (chartContainer) {
      chartContainer.innerHTML = renderLateFeeDiscountsSvg(currentAudit.metrics);
    }

    if (tableBody) {
      if (!currentAudit.rows.length) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.hidden = false;
      } else {
        if (emptyState) emptyState.hidden = true;
        tableBody.innerHTML = currentAudit.rows.map(row => {
          const feeBadge = row.hasLateFee
            ? `<span class="badge badge-warning" style="color:#d9534f; font-weight:bold;">+PKR ${row.lateFee}</span>`
            : row.eligibleForLateFee
              ? `<span class="badge badge-info" style="color:#0284c7;">Eligible</span>`
              : `<span class="badge" style="color:#64748b;">Not Due</span>`;

          const actionBtn = row.hasLateFee
            ? `<button type="button" class="secondary-button btn-xs waive-late-fee-row-btn" data-cust-id="${row.customerId}" data-month="${row.month}" title="Waive late fee from this bill">Waive</button>`
            : `<button type="button" class="primary-button btn-xs apply-late-fee-row-btn" data-cust-id="${row.customerId}" data-month="${row.month}" title="Apply configured late fee">Apply Fee</button>`;

          return `
            <tr data-cust-id="${row.customerId}" data-month="${row.month}">
              <td><input type="checkbox" data-customer-id="${row.customerId}" data-month="${row.month}" aria-label="Select #${row.customerNumber}"></td>
              <td><strong>#${row.customerNumber}</strong> ${row.customerName}</td>
              <td>${row.month}</td>
              <td>${row.dueDate} <small style="color:#ef4444;">(${row.daysOverdue}d)</small></td>
              <td>PKR ${row.dueAmount}</td>
              <td>${feeBadge}</td>
              <td>${row.discounts > 0 ? `<span style="color:#10b981; font-weight:bold;">-PKR ${row.discounts}</span>` : '0'}</td>
              <td><strong>PKR ${row.balanceDue}</strong></td>
              <td class="table-actions-cell">
                ${actionBtn}
                <button type="button" class="whatsapp-btn btn-xs whatsapp-late-fee-row-btn" data-cust-id="${row.customerId}" data-month="${row.month}" title="Prepare WhatsApp overdue notice">WhatsApp</button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  };

  // Event Listeners
  if (savePolicyBtn) {
    savePolicyBtn.addEventListener('click', () => {
      saveLateFeeConfig({
        enabled: togglePolicyCheckbox ? togglePolicyCheckbox.checked : false,
        defaultAmount: defaultAmountInput ? Number(defaultAmountInput.value) : 100,
        graceDays: graceDaysInput ? Number(graceDaysInput.value) : 0,
        reason: reasonInput ? reasonInput.value.trim() : ''
      });
      toast?.('Late fee policy configuration saved locally.');
      renderModalContent();
    });
  }

  if (selectAllCheckbox && tableBody) {
    selectAllCheckbox.addEventListener('change', () => {
      const cbs = tableBody.querySelectorAll('input[type="checkbox"]');
      cbs.forEach(cb => { cb.checked = selectAllCheckbox.checked; });
    });
  }

  if (batchApplyBtn) {
    batchApplyBtn.addEventListener('click', () => {
      const selected = getSelectedKeys();
      if (!selected.length) {
        toast?.('Select at least one customer bill to apply late fee.');
        return;
      }
      const config = getLateFeeConfig();
      const amount = config.defaultAmount;
      if (!window.confirm?.(`Apply PKR ${amount} late fee to ${selected.length} selected bills? This updates their outstanding balance.`)) {
        return;
      }
      const updated = applyLateFeeToEligibleBills(getState(), selected, {
        amount,
        reason: config.reason
      });
      updateState(updated);
      toast?.(`Applied PKR ${amount} late fee to ${selected.length} customer bills.`);
      renderModalContent();
    });
  }

  if (batchWaiveBtn) {
    batchWaiveBtn.addEventListener('click', () => {
      const selected = getSelectedKeys();
      if (!selected.length) {
        toast?.('Select at least one customer bill to waive late fee.');
        return;
      }
      if (!window.confirm?.(`Waive / remove late fee from ${selected.length} selected bills?`)) {
        return;
      }
      const updated = waiveLateFeeFromBills(getState(), selected, {
        reason: 'Late fee waived by owner'
      });
      updateState(updated);
      toast?.(`Waived late fee on ${selected.length} customer bills.`);
      renderModalContent();
    });
  }

  if (tableBody) {
    tableBody.addEventListener('click', (e) => {
      const applyBtn = e.target.closest('.apply-late-fee-row-btn');
      if (applyBtn) {
        const custId = applyBtn.dataset.custId;
        const month = applyBtn.dataset.month;
        const config = getLateFeeConfig();
        const updated = applyLateFeeToBill(getState(), custId, month, {
          amount: config.defaultAmount,
          reason: config.reason
        });
        updateState(updated);
        toast?.(`Applied PKR ${config.defaultAmount} late fee to bill ${month}.`);
        renderModalContent();
        return;
      }

      const waiveBtn = e.target.closest('.waive-late-fee-row-btn');
      if (waiveBtn) {
        const custId = waiveBtn.dataset.custId;
        const month = waiveBtn.dataset.month;
        const updated = waiveLateFeeFromBill(getState(), custId, month, {
          reason: 'Late fee waived by owner'
        });
        updateState(updated);
        toast?.(`Waived late fee from bill ${month}.`);
        renderModalContent();
        return;
      }

      const waBtn = e.target.closest('.whatsapp-late-fee-row-btn');
      if (waBtn) {
        const custId = waBtn.dataset.custId;
        const month = waBtn.dataset.month;
        const state = getState();
        const customer = state.customers.find(c => c.id === custId);
        const row = currentAudit?.rows.find(r => r.customerId === custId && r.month === month);
        if (customer && row) {
          const msg = formatLateFeeNoticeWhatsApp({ customer, row, config: getLateFeeConfig() });
          const phone = (customer.phone || '').replace(/\D/g, '');
          const intlPhone = phone.startsWith('92') ? phone : phone.startsWith('03') ? '92' + phone.slice(1) : phone;
          const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
          window.open(url, '_blank');
        }
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csv = generateLateFeeDiscountsCsv(getState());
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara-late-fees-discounts-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast?.('Exported late fees and discounts CSV.');
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const html = generateLateFeeAuditPrintHtml({ state: getState(), format: 'a4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      }
    });
  }

  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      const html = generateLateFeeAuditPrintHtml({ state: getState(), format: 'thermal' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      }
    });
  }

  const closeBtn = document.getElementById('closeLateFeeModalBtn');
  const closeSecondaryBtn = document.getElementById('closeLateFeeSecondaryBtn');
  const openTile = document.getElementById('quickActionLateFeeManager') || document.getElementById('openLateFeeManagerBtn');

  if (closeBtn) closeBtn.addEventListener('click', () => { modal.close?.() || (modal.hidden = true); });
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', () => { modal.close?.() || (modal.hidden = true); });
  if (openTile) openTile.addEventListener('click', () => { modal.showModal?.() || (modal.hidden = false); renderModalContent(); });

  return {
    open: () => {
      modal.showModal?.() || (modal.hidden = false);
      renderModalContent();
    },
    close: () => {
      modal.close?.() || (modal.hidden = true);
    },
    refresh: renderModalContent
  };
}
