/**
 * wallet-reconciliation.js — SISP-21: EasyPaisa / JazzCash / NayaPay TID
 * Duplicate Guard & Digital Wallet Reconciliation.
 *
 * Pure module: no imports, no DOM, no ledger writes. It only reads plain
 * customer/settlement data and returns a reconciliation report.
 *
 * TID NORMALIZATION (the one rule, shared with core.js's duplicate guard):
 * a TID is compared after removing ALL whitespace and lowercasing it.
 * Wallet TIDs arrive from screenshots and WhatsApp messages with stray
 * spaces ("1234 5678 901") and mixed case ("txn-AB12"); without this rule
 * the same screenshot could be logged twice under two spellings. Two TIDs
 * that differ only by whitespace or case are the SAME TID.
 *
 * Wallet verification status lives on the payment itself:
 *   walletVerified === true  → "Verified in Statement"
 *   anything else (absent/false) → "Pending Screenshot Verification"
 * A payment with no wallet verification is never treated as verified.
 */

export const WALLET_METHODS = Object.freeze(['Easypaisa', 'JazzCash', 'NayaPay', 'Bank Transfer']);

/** Digital wallet methods shown as their own breakdown lines (Raast included). */
export const DIGITAL_BREAKDOWN_METHODS = Object.freeze(['Easypaisa', 'JazzCash', 'NayaPay', 'Bank Transfer', 'Raast']);

export function normalizeTid(tid) {
  return String(tid ?? '').replace(/\s+/g, '').toLowerCase();
}

/**
 * SISP-63: sender proof metadata readers — the SAME sanitization rule
 * as core.js's paymentSenderTitle / paymentSenderDigits /
 * paymentSenderLabel, mirrored here because this module stays
 * import-free (core.js imports normalizeTid FROM here). Keep the two
 * copies in lockstep: single-line title capped at 100 chars, digits
 * reduced to the last 4, label "Hamza (…3310)" / "Hamza" / "…3310" / ''.
 */
export function senderTitleOf(payment) {
  return String(payment?.senderTitle ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 100);
}
export function senderDigitsOf(payment) {
  return String(payment?.senderDigits ?? '').replace(/\D/g, '').slice(-4);
}
export function senderLabelOf(payment) {
  const title = senderTitleOf(payment);
  const digits = senderDigitsOf(payment);
  if (title && digits) return `${title} (…${digits})`;
  return title || (digits ? `…${digits}` : '');
}

function methodKey(method) {
  return String(method ?? '').trim().toLowerCase();
}

/** True for the four spec wallet methods (case-insensitive). */
export function isWalletMethod(method) {
  const m = methodKey(method);
  return m === 'easypaisa' || m === 'jazzcash' || m === 'nayapay' || m === 'bank transfer' || m === 'bank';
}

/** True for any digital wallet method, including Raast. */
export function isDigitalWalletMethod(method) {
  return isWalletMethod(method) || methodKey(method) === 'raast';
}

/** True for shop-counter cash methods ("Cash at <shop> shop"). */
export function isShopHandoverMethod(method) {
  return methodKey(method).startsWith('cash at ');
}

export function walletVerificationLabel(payment) {
  return payment && payment.walletVerified === true ? 'Verified in Statement' : 'Pending Screenshot Verification';
}

function emptyMethodLine() {
  return { amount: 0, count: 0, verifiedAmount: 0, verifiedCount: 0, pendingAmount: 0, pendingCount: 0 };
}

/** Canonical display label for a wallet method (SISP-51 reuses these labels
 * for the Owner Khata collection-channel split). */
export function canonicalWalletLabel(method) {
  const m = methodKey(method);
  if (m === 'easypaisa') return 'Easypaisa';
  if (m === 'jazzcash') return 'JazzCash';
  if (m === 'nayapay') return 'NayaPay';
  if (m === 'bank transfer' || m === 'bank') return 'Bank Transfer';
  if (m === 'raast') return 'Raast';
  return String(method ?? '').trim();
}

/**
 * Build the monthly wallet reconciliation for one YYYY-MM month.
 *
 * @param {Array} customers - state.customers (plain objects).
 * @param {string} month - 'YYYY-MM'. Payments are matched by payment DATE
 *   (same basis as the partner-share revenue: receipts by payment date).
 * @param {Array} settlements - SISP-1 shop settlement records
 *   ({ shop, amount, date }) for the shop-handover line.
 * @returns {object} breakdown + duplicate groups + pending-verification list
 *   + the flat digital payment list the ledger modal renders.
 */
export function buildWalletReconciliation(customers, month, settlements = []) {
  const byWallet = {};
  for (const label of DIGITAL_BREAKDOWN_METHODS) byWallet[label] = emptyMethodLine();
  const cash = { amount: 0, count: 0 };
  const shopPayments = { amount: 0, count: 0 };
  const payments = [];
  const tidGroups = new Map();

  for (const customer of (Array.isArray(customers) ? customers : [])) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
        if (!payment || typeof payment !== 'object') continue;
        if (typeof payment.date !== 'string' || payment.date.slice(0, 7) !== month) continue;
        const amount = Number(payment.amount) || 0;
        const method = String(payment.method || 'Cash').trim();
        if (methodKey(method) === 'cash') {
          cash.amount += amount;
          cash.count += 1;
          continue;
        }
        if (isShopHandoverMethod(method)) {
          shopPayments.amount += amount;
          shopPayments.count += 1;
          continue;
        }
        if (!isDigitalWalletMethod(method)) continue;
        const label = canonicalWalletLabel(method);
        if (!byWallet[label]) byWallet[label] = emptyMethodLine();
        const line = byWallet[label];
        line.amount += amount;
        line.count += 1;
        if (payment.walletVerified === true) {
          line.verifiedAmount += amount;
          line.verifiedCount += 1;
        } else {
          line.pendingAmount += amount;
          line.pendingCount += 1;
        }
        const entry = {
          customerId: customer.id,
          customerNumber: customer.customerNumber,
          customerName: customer.name,
          billMonth: bill.month,
          paymentId: payment.id,
          date: payment.date,
          amount,
          method,
          transactionId: payment.transactionId || payment.reference || '',
          // SISP-63: sender proof metadata rides the wallet entry so
          // the reconciliation ledger can show WHO sent each payment
          // next to its TID.
          senderTitle: senderTitleOf(payment),
          senderDigits: senderDigitsOf(payment),
          senderLabel: senderLabelOf(payment),
          walletVerified: payment.walletVerified === true
        };
        payments.push(entry);
        const normalized = normalizeTid(entry.transactionId);
        if (normalized) {
          if (!tidGroups.has(normalized)) tidGroups.set(normalized, []);
          tidGroups.get(normalized).push(entry);
        }
      }
    }
  }

  const duplicateGroups = [];
  for (const [normalized, group] of tidGroups) {
    if (group.length < 2) continue;
    duplicateGroups.push({
      normalizedTid: normalized,
      displayTid: group[0].transactionId,
      payments: [...group].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    });
  }
  duplicateGroups.sort((a, b) => String(a.payments[0].date).localeCompare(String(b.payments[0].date)));

  const shopHandovers = { amount: 0, count: 0, perShop: {} };
  for (const settlement of (Array.isArray(settlements) ? settlements : [])) {
    if (!settlement || typeof settlement !== 'object') continue;
    if (typeof settlement.date !== 'string' || settlement.date.slice(0, 7) !== month) continue;
    const amount = Number(settlement.amount) || 0;
    shopHandovers.amount += amount;
    shopHandovers.count += 1;
    const shop = String(settlement.shop || 'Shop');
    if (!shopHandovers.perShop[shop]) shopHandovers.perShop[shop] = { amount: 0, count: 0 };
    shopHandovers.perShop[shop].amount += amount;
    shopHandovers.perShop[shop].count += 1;
  }

  const digitalTotal = Object.values(byWallet).reduce((sum, line) => sum + line.amount, 0);
  const digitalCount = Object.values(byWallet).reduce((sum, line) => sum + line.count, 0);
  payments.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return {
    month,
    byWallet,
    cash,
    shopPayments,
    shopHandovers,
    digitalTotal,
    digitalCount,
    total: digitalTotal + cash.amount + shopPayments.amount,
    duplicateGroups,
    pendingVerification: payments.filter((p) => !p.walletVerified),
    payments
  };
}

/**
 * SISP-37: every recorded customer payment whose TID matches `tid`
 * under the normalizeTid rule above. The Suspense Payment Register
 * (suspense-payments.js) uses this before claiming an unidentified
 * transfer: if the TID is already a recorded payment, claiming it again
 * would count the same money twice, so the claim is refused. An empty
 * or whitespace-only TID matches nothing.
 */
export function findPaymentsByTid(customers, tid) {
  const normalized = normalizeTid(tid);
  if (!normalized) return [];
  const matches = [];
  for (const customer of (Array.isArray(customers) ? customers : [])) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
        if (!payment || typeof payment !== 'object') continue;
        if (payment.voided === true) continue;
        const paymentTid = payment.transactionId || payment.reference || '';
        if (normalizeTid(paymentTid) !== normalized) continue;
        matches.push({
          customerId: customer.id,
          customerNumber: customer.customerNumber,
          customerName: customer.name,
          billMonth: bill.month,
          paymentId: payment.id,
          date: payment.date,
          amount: Number(payment.amount) || 0,
          method: String(payment.method || 'Cash').trim(),
          transactionId: paymentTid
        });
      }
    }
  }
  matches.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return matches;
}

/** One-line Roman Urdu / English summary for copy/share. */
export function walletReconciliationSummaryText(report) {
  const lines = [`Digital Wallet Ledger — ${report.month}`];
  for (const label of DIGITAL_BREAKDOWN_METHODS) {
    const line = report.byWallet[label];
    if (line && line.count > 0) lines.push(`${label}: PKR ${line.amount} (${line.count} payments, ${line.verifiedCount} verified)`);
  }
  lines.push(`Cash: PKR ${report.cash.amount} (${report.cash.count})`);
  lines.push(`Shop handovers: PKR ${report.shopHandovers.amount} (${report.shopHandovers.count})`);
  if (report.duplicateGroups.length > 0) {
    lines.push(`Duplicate TIDs: ${report.duplicateGroups.length} (check before re-logging!)`);
  }
  if (report.pendingVerification.length > 0) {
    lines.push(`Pending screenshot verification: ${report.pendingVerification.length} payments`);
  }
  return lines.join('\n');
}
