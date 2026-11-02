// SISP-19: Customer Hardware Custody and Returnable Equipment Log.
// Pure functions only — no DOM, no imports, no billing changes.
//
// WHAT THIS IS (spec verbatim, in two parts):
//  1. Equipment custody fields on the customer profile: router ownership
//     (ISP Owned — Returnable vs Customer Purchased), media converter / ONU
//     ownership, serial / MAC number, security deposit (PKR). The installed
//     fiber drop length is the existing `fiberMeters` field ("fiber wire
//     used") — it is displayed in the custody section, NOT duplicated.
//  2. Disconnection recovery checklist: when a customer is disconnected,
//     every ISP-owned item appears in the "Pending Hardware Recovery" list
//     until it is marked recovered (with a recovery date).
//
// "DISCONNECTED" MAPPING (documented, because the app has no literal
// "Disconnected" status value): archiving a customer IS the app's
// disconnect action (archiveCustomer sets archived:true and stops new
// bills). A customer counts as disconnected exactly when archived ===
// true. Manual serviceStatus 'offline' is NOT disconnection — the app
// treats it as a temporary state, not churn (see the cancellation-date
// field help: "Offline is not churn").
//
// The existing Subscriber Equipment Retrieval manifest modal
// (form-validation.js setupEquipmentRetrievalModal) is a SEPARATE
// operator tool for printing settlement manifests. It is NOT forked here:
// custody fields live on the customer record, and the pending list below
// is derived from them. The stock-book interface at the bottom is the
// one clean hook SISP-18 (unmerged) can consume at merge time; until
// then recovery marking works standalone and refuses nothing on stock
// grounds (available stock is unknowable without the inventory module).

export const CUSTODY_OWNERSHIP_NOT_RECORDED = '';
export const CUSTODY_OWNERSHIP_ISP_OWNED = 'isp-owned';
export const CUSTODY_OWNERSHIP_CUSTOMER_OWNED = 'customer-owned';

export const CUSTODY_OWNERSHIP_OPTIONS = [
  { value: CUSTODY_OWNERSHIP_NOT_RECORDED, label: 'Not recorded' },
  { value: CUSTODY_OWNERSHIP_ISP_OWNED, label: 'ISP Owned — Returnable' },
  { value: CUSTODY_OWNERSHIP_CUSTOMER_OWNED, label: 'Customer Purchased' }
];

// Item keys are stable: they are stored in hardwareRecovered and in the
// stock-book movement map below. Never rename them.
export const CUSTODY_ITEMS = [
  { key: 'router', label: 'Router', ownershipField: 'routerOwnership' },
  { key: 'mediaConverter', label: 'Media Converter / ONU', ownershipField: 'mediaConverterOwnership' }
];

// SISP-18 inventory item ids (read-only reference — this module imports
// nothing from the inventory module; app.js wires recoveryStockMovements
// into the inventory module's addMovement).
export const CUSTODY_STOCK_ITEM_IDS = {
  router: 'router',
  mediaConverter: 'media-converter'
};

export function isValidCustodyOwnership(value) {
  return value === '' || value === CUSTODY_OWNERSHIP_ISP_OWNED || value === CUSTODY_OWNERSHIP_CUSTOMER_OWNED;
}

export function custodyOwnershipLabel(value) {
  const found = CUSTODY_OWNERSHIP_OPTIONS.find(option => option.value === value);
  return found ? found.label : 'Not recorded';
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeRecovered(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const item of CUSTODY_ITEMS) {
    out[item.key] = isValidDateString(source[item.key]) ? source[item.key] : null;
  }
  return out;
}

// Safe defaults for any customer, old or new: unknown ownership, no
// serial, no deposit, nothing recovered. Never throws on legacy records.
export function normalizeCustodyFields(customer = {}) {
  const source = customer && typeof customer === 'object' ? customer : {};
  return {
    routerOwnership: isValidCustodyOwnership(source.routerOwnership) ? source.routerOwnership : '',
    mediaConverterOwnership: isValidCustodyOwnership(source.mediaConverterOwnership) ? source.mediaConverterOwnership : '',
    serialNumber: typeof source.serialNumber === 'string' ? source.serialNumber.trim().slice(0, 100) : '',
    securityDeposit: Number.isFinite(Number(source.securityDeposit)) && Number(source.securityDeposit) >= 0
      ? Math.round(Number(source.securityDeposit) * 100) / 100
      : null,
    hardwareRecovered: normalizeRecovered(source.hardwareRecovered)
  };
}

// The app's disconnect action is archiving (see the mapping note above).
export function isDisconnected(customer = {}) {
  return customer?.archived === true;
}

// Every custody item whose ownership is recorded, with its recovery state.
export function custodyItems(customer = {}) {
  const fields = normalizeCustodyFields(customer);
  return CUSTODY_ITEMS.map(item => ({
    key: item.key,
    label: item.label,
    ownership: fields[item.ownershipField],
    ownershipLabel: custodyOwnershipLabel(fields[item.ownershipField]),
    recoveredAt: fields.hardwareRecovered[item.key]
  }));
}

// The disconnection recovery checklist: only ISP-owned items, each with
// its recovered state. Empty for customers with no ISP-owned hardware.
export function disconnectionChecklist(customer = {}) {
  return custodyItems(customer)
    .filter(item => item.ownership === CUSTODY_OWNERSHIP_ISP_OWNED)
    .map(item => ({ ...item, recovered: item.recoveredAt !== null }));
}

// Pending recovery = disconnected AND holding at least one ISP-owned item
// that has not been marked recovered. Customer-owned items never pend;
// connected customers never pend, even with ISP-owned hardware installed.
export function pendingRecoveryItems(customer = {}) {
  if (!isDisconnected(customer)) return [];
  return disconnectionChecklist(customer).filter(item => !item.recovered);
}

export function isPendingHardwareRecovery(customer = {}) {
  return pendingRecoveryItems(customer).length > 0;
}

// Derived list for the dashboard card + modal. Sorted by customer number
// so the operator works through it in roster order.
export function pendingHardwareRecovery(customers = []) {
  const list = [];
  for (const customer of Array.isArray(customers) ? customers : []) {
    const items = pendingRecoveryItems(customer);
    if (items.length > 0) list.push({ customer, items });
  }
  list.sort((a, b) => (a.customer.customerNumber ?? 0) - (b.customer.customerNumber ?? 0));
  return list;
}

// Mark one item recovered. Pure: returns a NEW customer object, never
// mutates the input. Idempotent — an already-recovered item keeps its
// FIRST recovery date (recovery only moves forward, never rewrites
// history). Throws on an unknown item key or an invalid date so the UI
// can never record a meaningless recovery.
export function markHardwareRecovered(customer = {}, itemKey, recoveredDate) {
  const item = CUSTODY_ITEMS.find(entry => entry.key === itemKey);
  if (!item) throw new Error(`Unknown custody item: ${String(itemKey)}.`);
  if (!isValidDateString(recoveredDate)) throw new Error('Enter a valid recovery date.');
  const fields = normalizeCustodyFields(customer);
  if (fields.hardwareRecovered[itemKey] !== null) return { ...customer, hardwareRecovered: fields.hardwareRecovered };
  return {
    ...customer,
    hardwareRecovered: { ...fields.hardwareRecovered, [itemKey]: recoveredDate }
  };
}

export function markAllHardwareRecovered(customer = {}, recoveredDate) {
  if (!isValidDateString(recoveredDate)) throw new Error('Enter a valid recovery date.');
  let updated = { ...customer, hardwareRecovered: normalizeCustodyFields(customer).hardwareRecovered };
  for (const item of pendingRecoveryItems(customer)) {
    updated = markHardwareRecovered(updated, item.key, recoveredDate);
  }
  return updated;
}

// When an ISP-owned item is marked recovered, the device comes BACK into
// stock: one 'in' movement in exactly SISP-18's addMovement input shape.
// Returns null when there is nothing to consume (item not ISP-owned, or
// not marked recovered). This module never calls addMovement itself —
// app.js wires it at both mark-recovered call sites (profile checklist +
// recovery modal) via recoveryStockMovements below, AFTER the recovery
// record is saved, so a stock failure can never lose a recovery.
export function recoveryStockMovement(customer = {}, itemKey) {
  const fields = normalizeCustodyFields(customer);
  const item = CUSTODY_ITEMS.find(entry => entry.key === itemKey);
  if (!item) return null;
  const ownership = fields[item.ownershipField];
  const recoveredAt = fields.hardwareRecovered[itemKey];
  if (ownership !== CUSTODY_OWNERSHIP_ISP_OWNED || recoveredAt === null) return null;
  return {
    itemId: CUSTODY_STOCK_ITEM_IDS[itemKey],
    kind: 'in',
    qty: 1,
    date: recoveredAt,
    customerName: typeof customer?.name === 'string' ? customer.name : '',
    note: `Hardware recovered — ${item.label} (customer #${customer?.customerNumber ?? ''})`
  };
}

// Stock movements for a recovery transition: items that are ISP-owned,
// were unrecovered BEFORE and are recovered AFTER. This is the guard
// against double stock: re-marking an already-recovered item yields no
// movement (markHardwareRecovered is idempotent, so before == after for
// that item), and customer-owned items never appear (the checklist only
// lists ISP-owned items). Pure: inputs untouched, no inventory calls.
export function recoveryStockMovements(beforeCustomer = {}, afterCustomer = {}) {
  const before = disconnectionChecklist(beforeCustomer);
  const after = disconnectionChecklist(afterCustomer);
  const movements = [];
  for (const item of after) {
    const was = before.find(entry => entry.key === item.key);
    if (item.recovered && was && !was.recovered) {
      const movement = recoveryStockMovement(afterCustomer, item.key);
      if (movement) movements.push(movement);
    }
  }
  return movements;
}

// ------------------------------------------------------------------ SISP-50
// Disconnection Security Deposit Refund vs. Final Arrears Offset
// Calculator (enhances SISP-19 above).
//
// SPEC: "On archived/disconnected customers with securityDeposit > 0
// (SISP-19), calculate netDepositRefund = securityDeposit - unpaidArrears
// - unrecoveredHardwareCharge and allow 1-click settlement with a Final
// Disconnection Clearance Receipt." Test criterion: deposit 2000,
// arrears 1200, all hardware recovered -> netDepositRefund 800 and the
// settlement clears the arrears.
//
// DESIGN DECISIONS (where the spec text is silent):
//  * UNPAID ARREARS are an INPUT, computed by the caller from the app's
//    canonical engine (core calculatePaymentAllocations — the same
//    balances the dues lists, defaulters and profile net-due read).
//    This module stays import-free, like the rest of the file.
//  * UNRECOVERED HARDWARE CHARGE: each ISP-owned item still pending
//    recovery is charged at its recorded install cost on the customer
//    record — router -> routerPrice, media converter ->
//    mediaConverterCost. An item with no recorded price charges 0 and
//    is flagged priceRecorded:false (never an invented amount).
//  * OFFSET ORDER: the deposit clears ARREARS first, then covers the
//    hardware charge; the remainder is the refund. Whenever the deposit
//    covers everything, refund = deposit - arrears - hardwareCharge,
//    exactly the spec formula. A shortfall is reported on the record
//    (arrearsRemaining / hardwareOutstanding), never hidden.
//  * CLEARING MECHANISM: the arrears offset rides as audited BILL
//    fields — depositOffsetAmount + depositOffsetReason +
//    depositOffsetAppliedAt plus an amountHistory entry per bill,
//    distributed oldest month first — exactly the SISP-30 concession /
//    SISP-40 referral-credit shape, and the allocation engine subtracts
//    it from the bill's due. Two alternatives were rejected on
//    evidence: a concessionAmount bump does NOT clear arrears in the
//    app (calculatePaymentAllocations ignores concessions — verified),
//    and a zero-amount "payment" record fails core validatePayment on
//    backup restore (amount must be > 0, method must be a listed
//    payment method), which would have made a settled customer's
//    backup unrestorable. Bill fields keep every subsystem honest:
//    dues/defaulters/profile read the engine, receipts subtract the
//    offset like the concession, and no cash total can move because
//    no payment exists.
//  * ONE-SHOT: settlement stamps customer.depositSettlement and zeroes
//    securityDeposit. A settled customer can never settle again (the
//    quote reports 'already-settled'), so a deposit can never be
//    refunded or offset twice.

export const DEPOSIT_OFFSET_REASON = 'Security deposit offset — final disconnection settlement';

// The recorded install-cost field that prices each custody item when it
// is never recovered. Keys mirror CUSTODY_ITEMS.
const CUSTODY_ITEM_PRICE_FIELDS = {
  router: 'routerPrice',
  mediaConverter: 'mediaConverterCost'
};

const depCents = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};
const depRupees = (centsValue) => Math.round(centsValue) / 100;
const sanitizeMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
};
const isValidMonthKey = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

// The stored settlement record, normalized. Null when absent or when
// the record is too malformed to trust (no valid settlement date) —
// a malformed record must never pose as a completed settlement.
export function sanitizeDepositSettlement(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidDateString(raw.settledAt)) return null;
  const offsets = (Array.isArray(raw.offsets) ? raw.offsets : [])
    .filter((row) => row && isValidMonthKey(row.month) && Number.isFinite(Number(row.amount)) && Number(row.amount) > 0)
    .map((row) => ({ month: row.month, amount: Math.round(Number(row.amount) * 100) / 100 }));
  const hardwareCharges = (Array.isArray(raw.hardwareCharges) ? raw.hardwareCharges : [])
    .filter((row) => row && CUSTODY_ITEMS.some((item) => item.key === row.key))
    .map((row) => ({
      key: row.key,
      label: typeof row.label === 'string' && row.label ? row.label : (CUSTODY_ITEMS.find((item) => item.key === row.key)?.label ?? row.key),
      amount: sanitizeMoney(row.amount),
      priceRecorded: row.priceRecorded === true
    }));
  const settlement = {
    settledAt: raw.settledAt,
    securityDeposit: sanitizeMoney(raw.securityDeposit),
    arrearsOffset: sanitizeMoney(raw.arrearsOffset),
    unrecoveredHardwareCharge: sanitizeMoney(raw.unrecoveredHardwareCharge),
    hardwareCovered: sanitizeMoney(raw.hardwareCovered),
    refundAmount: sanitizeMoney(raw.refundAmount),
    arrearsRemaining: sanitizeMoney(raw.arrearsRemaining),
    hardwareOutstanding: sanitizeMoney(raw.hardwareOutstanding),
    receiptNumber: typeof raw.receiptNumber === 'string' ? raw.receiptNumber.trim().slice(0, 64) : '',
    offsets,
    hardwareCharges
  };
  // SISP-195: the owner's settle-time choice to record the cash refund
  // in the Daily Roznamcha (see syncDepositRefundRoznamcha below). Kept
  // ONLY when true, so a settlement recorded without the option keeps
  // exactly the pre-SISP-195 record shape.
  if (raw.roznamchaRefund === true) settlement.roznamchaRefund = true;
  return settlement;
}

export function depositSettlementOf(customer = {}) {
  return sanitizeDepositSettlement(customer?.depositSettlement);
}

// One charge line per ISP-owned item still pending recovery on a
// disconnected customer, priced from the recorded install cost.
export function unrecoveredHardwareCharges(customer = {}) {
  const source = customer && typeof customer === 'object' ? customer : {};
  return pendingRecoveryItems(source).map((item) => {
    const price = Number(source[CUSTODY_ITEM_PRICE_FIELDS[item.key]]);
    const priceRecorded = Number.isFinite(price) && price > 0;
    return {
      key: item.key,
      label: item.label,
      amount: priceRecorded ? Math.round(price * 100) / 100 : 0,
      priceRecorded
    };
  });
}

// The settlement quote. unpaidArrears is the caller's engine total
// (rupees); non-finite or negative input counts as 0.
export function depositSettlementQuote(customer = {}, unpaidArrears = 0) {
  const fields = normalizeCustodyFields(customer);
  const securityDeposit = fields.securityDeposit ?? 0;
  const arrears = sanitizeMoney(unpaidArrears);
  const hardwareCharges = unrecoveredHardwareCharges(customer);
  const hardwareCharge = hardwareCharges.reduce((sum, row) => sum + depCents(row.amount), 0);
  const alreadySettled = depositSettlementOf(customer) !== null;
  const disconnected = isDisconnected(customer);
  const reason = !disconnected ? 'not-disconnected'
    : alreadySettled ? 'already-settled'
      : !(securityDeposit > 0) ? 'no-deposit'
        : null;
  const depositC = depCents(securityDeposit);
  const arrearsC = depCents(arrears);
  const arrearsOffsetC = Math.min(depositC, arrearsC);
  const afterArrearsC = depositC - arrearsOffsetC;
  const hardwareCoveredC = Math.min(hardwareCharge, afterArrearsC);
  const refundC = afterArrearsC - hardwareCoveredC;
  return {
    eligible: reason === null,
    reason,
    alreadySettled,
    securityDeposit: depRupees(depositC),
    unpaidArrears: depRupees(arrearsC),
    unrecoveredItems: hardwareCharges,
    unrecoveredHardwareCharge: depRupees(hardwareCharge),
    arrearsOffset: depRupees(arrearsOffsetC),
    hardwareCovered: depRupees(hardwareCoveredC),
    netDepositRefund: depRupees(refundC),
    refundAmount: depRupees(refundC),
    arrearsRemaining: depRupees(arrearsC - arrearsOffsetC),
    hardwareOutstanding: depRupees(hardwareCharge - hardwareCoveredC)
  };
}

// Apply the 1-click settlement. billBalances = [{ month, balanceDue }]
// from the caller's engine snapshot (the quote's unpaidArrears is their
// total); the offset is distributed oldest month first and each bill's
// share is clamped to that bill's balance, so the recorded offset is
// exactly what was written even if the snapshot was stale. Pure:
// returns a NEW customer; the input is never mutated. Throws on an
// ineligible customer or an invalid date so the UI can never record a
// meaningless settlement.
export function applyDepositSettlement(customer = {}, unpaidArrears = 0, { date, billBalances = [], receiptNumber = '', recordRoznamchaRefund = false } = {}) {
  if (!isValidDateString(date)) throw new Error('Enter a valid settlement date.');
  const quote = depositSettlementQuote(customer, unpaidArrears);
  if (!quote.eligible) {
    throw new Error(quote.reason === 'already-settled'
      ? 'This security deposit was already settled.'
      : quote.reason === 'not-disconnected'
        ? 'Only a disconnected (archived) customer can settle a security deposit.'
        : 'No security deposit is recorded for this customer.');
  }
  let remainingC = depCents(quote.arrearsOffset);
  const offsets = [];
  const bills = (Array.isArray(customer?.bills) ? customer.bills : []).map((bill) => ({ ...bill }));
  const ordered = [...(Array.isArray(billBalances) ? billBalances : [])]
    .filter((row) => row && isValidMonthKey(row.month) && Number.isFinite(Number(row.balanceDue)) && Number(row.balanceDue) > 0)
    .sort((a, b) => a.month.localeCompare(b.month));
  for (const row of ordered) {
    if (remainingC <= 0) break;
    const index = bills.findIndex((bill) => bill && bill.month === row.month);
    if (index < 0) continue;
    const shareC = Math.min(remainingC, depCents(row.balanceDue));
    if (shareC <= 0) continue;
    const share = depRupees(shareC);
    const bill = bills[index];
    const previousOffset = sanitizeMoney(bill.depositOffsetAmount);
    const newOffset = Math.round((previousOffset + share) * 100) / 100;
    bills[index] = {
      ...bill,
      depositOffsetAmount: newOffset,
      depositOffsetReason: DEPOSIT_OFFSET_REASON,
      depositOffsetAppliedAt: date,
      amountHistory: [
        ...(Array.isArray(bill.amountHistory) ? bill.amountHistory : []),
        {
          changedAt: `${date}T00:00`,
          type: 'deposit_offset_applied',
          previousDepositOffset: previousOffset,
          depositOffset: newOffset,
          note: DEPOSIT_OFFSET_REASON
        }
      ]
    };
    offsets.push({ month: row.month, amount: share });
    remainingC -= shareC;
  }
  const appliedOffsetC = depCents(quote.arrearsOffset) - remainingC;
  // Recompute the money split from what was ACTUALLY written, so the
  // stamped record always reconciles with the ledger.
  const depositC = depCents(quote.securityDeposit);
  const afterArrearsC = depositC - appliedOffsetC;
  const hardwareCoveredC = Math.min(depCents(quote.unrecoveredHardwareCharge), afterArrearsC);
  const settlement = {
    settledAt: date,
    securityDeposit: quote.securityDeposit,
    arrearsOffset: depRupees(appliedOffsetC),
    unrecoveredHardwareCharge: quote.unrecoveredHardwareCharge,
    hardwareCovered: depRupees(hardwareCoveredC),
    refundAmount: depRupees(afterArrearsC - hardwareCoveredC),
    arrearsRemaining: depRupees(depCents(quote.unpaidArrears) - appliedOffsetC),
    hardwareOutstanding: depRupees(depCents(quote.unrecoveredHardwareCharge) - hardwareCoveredC),
    receiptNumber: typeof receiptNumber === 'string' ? receiptNumber.trim().slice(0, 64) : '',
    offsets,
    hardwareCharges: quote.unrecoveredItems
  };
  // SISP-195: stamp the owner's choice only when there is a cash
  // refund for the Roznamcha bridge to record — with a refund of 0
  // there is no drawer cash to log, so no stamp is written.
  if (recordRoznamchaRefund === true && settlement.refundAmount > 0) settlement.roznamchaRefund = true;
  return { ...customer, securityDeposit: 0, bills, depositSettlement: settlement };
}

// ------------------------------------------------------------------ SISP-195
// Optional Roznamcha Cash Refund Outflow Bridge for the settlement
// above (PR #489 companion: closingCashInHand reads the drawer through
// roznamcha.js, so the refund cash must leave the drawer exactly once
// or every later closing is overstated by the refund amount).
//
// The bridge follows the SISP-56 house precedent (saad-visits.js
// syncSaadPaymentLedgers) rule for rule:
//  * CHOICE IS A STAMP: applyDepositSettlement records
//    settlement.roznamchaRefund === true when the owner ticks the
//    "record in today's Roznamcha" option — the settlement record is
//    the source of truth, exactly like a Saad payment's paidFromDrawer.
//  * DETERMINISTIC ID: a settlement is ONE-SHOT per customer (the
//    quote refuses 'already-settled' forever), so the outflow id
//    `deposit-refund-<customer id>` can only ever name one refund.
//  * CONVERGENT SYNC: syncDepositRefundRoznamcha re-runs safely at
//    startup, after a restore and after every settle — a drifted
//    outflow is restored to the stamped refund, an outflow whose
//    settlement record has disappeared (e.g. a pre-settlement backup
//    was restored) is removed, and re-running changes nothing.
//    Settlements themselves can never be unsettled in the app (no
//    code path clears depositSettlement), so removal can only follow
//    the record, never an in-app undo that does not exist.
//  * CLOSED DAYS ARE NEVER MUTATED: a refund whose settlement day is
//    already closed is reported in skippedClosed and the outflow is
//    left unrecorded (the UI tells the owner); an outflow already
//    frozen into a closed day stays exactly as frozen.
//  * DRAWER-ONLY MONEY: a security deposit was the customer's own
//    money held against the connection — it was never ledger income,
//    so the refund is NOT an expense. roznamcha.js
//    syncRoznamchaExpenses skips `deposit-refund-` outflows (the same
//    prefix skip it applies to `saad-`), so the refund never reaches
//    the Expenses ledger, monthly P&L or the partners' 50% shares.
//    It exists only so buildRoznamchaDay's expected closing and the
//    Owner Khata closingCashInHand stay exact.
//  * The outflow date is the settlement's own settledAt — app.js
//    settles with the PKT today (getTodayDateString), i.e. the refund
//    lands in "today's Roznamcha" as the option promises, never on
//    the customer's disconnection date.

export const DEPOSIT_REFUND_ROZNAMCHA_CATEGORY = 'Security Deposit Refund';
const DEPOSIT_REFUND_OUTFLOW_PREFIX = 'deposit-refund-';

/** Deterministic roznamcha outflow id for a customer's deposit refund. */
export function syncedDepositRefundOutflowId(customerId) {
  return `${DEPOSIT_REFUND_OUTFLOW_PREFIX}${customerId}`;
}

const refundText = (value, maxLength) => (typeof value === 'string'
  ? value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, maxLength)
  : '');

/** Note text for the refund outflow (roznamcha caps notes at 200). */
export function buildDepositRefundOutflowNote(customer = {}) {
  const name = refundText(customer?.name, 100);
  const number = refundText(String(customer?.customerNumber ?? ''), 100);
  const head = `Security deposit refund${name ? ` · ${name}` : ''}${number ? ` (#${number})` : ''}`;
  return head.slice(0, 200);
}

function syncedDepositRefundOutflow(customer, settlement) {
  return {
    id: syncedDepositRefundOutflowId(customer.id),
    category: DEPOSIT_REFUND_ROZNAMCHA_CATEGORY,
    amount: Math.round(settlement.refundAmount * 100) / 100,
    lineman: '',
    note: buildDepositRefundOutflowNote(customer)
  };
}

function sameDepositRefundOutflow(a, b) {
  return a && b && a.category === b.category && a.amount === b.amount
    && a.lineman === b.lineman && a.note === b.note;
}

/**
 * Reconcile the roznamcha day ledger with every settlement that
 * carries the roznamchaRefund stamp. Pure: returns { days,
 * daysChanged, changed, added, updated, removed, skippedClosed } and
 * never mutates its inputs. `days` is the SAME array reference when
 * nothing changed, so callers can skip persisting. `days` is treated
 * as plain sanitized day data (see roznamcha.js
 * sanitizeRoznamchaDays); closed days are read but never written.
 */
export function syncDepositRefundRoznamcha(days, customers) {
  // Desired: one outflow per stamped settlement, keyed by its
  // deterministic id, dated on the settlement day.
  const desired = new Map();
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer.id !== 'string' || !customer.id) continue;
    const settlement = depositSettlementOf(customer);
    if (!settlement || settlement.roznamchaRefund !== true || !(settlement.refundAmount > 0)) continue;
    desired.set(syncedDepositRefundOutflowId(customer.id), {
      date: settlement.settledAt,
      outflow: syncedDepositRefundOutflow(customer, settlement)
    });
  }
  const currentDays = Array.isArray(days) ? days : [];
  let nextDays = currentDays;
  let added = 0;
  let updated = 0;
  let removed = 0;
  let skippedClosed = 0;
  const writableDays = () => {
    if (nextDays === currentDays) {
      nextDays = currentDays.map((d) => ({ ...d, outflows: [...(Array.isArray(d?.outflows) ? d.outflows : [])] }));
    }
    return nextDays;
  };
  // Pass 1: drop or repair existing bridge-owned outflows in OPEN
  // days; an outflow frozen into a closed day counts as present and
  // stays exactly as frozen.
  const present = new Set();
  currentDays.forEach((day, dayIndex) => {
    if (!day || !Array.isArray(day.outflows)) return;
    for (const outflow of day.outflows) {
      const outflowId = typeof outflow?.id === 'string' ? outflow.id : '';
      if (!outflowId.startsWith(DEPOSIT_REFUND_OUTFLOW_PREFIX)) continue;
      if (day.closed === true) { present.add(outflowId); continue; }
      const want = desired.get(outflowId);
      if (!want || want.date !== day.date) {
        const target = writableDays()[dayIndex];
        target.outflows = target.outflows.filter((o) => o.id !== outflowId);
        removed += 1;
        continue;
      }
      present.add(outflowId);
      if (!sameDepositRefundOutflow(outflow, want.outflow)) {
        const target = writableDays()[dayIndex];
        target.outflows = target.outflows.map((o) => (o.id === outflowId ? want.outflow : o));
        updated += 1;
      }
    }
  });
  // Pass 2: add missing outflows; a closed target day is reported in
  // skippedClosed, never mutated.
  for (const [outflowId, want] of desired) {
    if (present.has(outflowId)) continue;
    const existingIndex = currentDays.findIndex((d) => d && d.date === want.date);
    if (existingIndex >= 0 && currentDays[existingIndex].closed === true) {
      skippedClosed += 1;
      continue;
    }
    const target = writableDays();
    const writableIndex = target.findIndex((d) => d && d.date === want.date);
    if (writableIndex >= 0) {
      target[writableIndex].outflows = [...target[writableIndex].outflows, want.outflow];
    } else {
      target.push({ date: want.date, outflows: [want.outflow], closed: false });
      target.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    }
    present.add(outflowId);
    added += 1;
  }
  const daysChanged = added + updated + removed > 0;
  return {
    days: daysChanged ? nextDays : currentDays,
    daysChanged,
    changed: daysChanged,
    added,
    updated,
    removed,
    skippedClosed
  };
}
