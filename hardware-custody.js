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
