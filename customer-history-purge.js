/* Polish #24 — full-history delete: every record keyed to a deleted
 * customer goes with them.
 *
 * Deleting a customer used to remove only the customer record (the
 * polish #10 clean-account gate refused anything else). The user
 * changed the rule on 2026-11-09: deleting a customer deletes the
 * profile AND its entire history, no matter what payments they made —
 * the main use case is a duplicate profile for one household.
 *
 * What rides the record already goes with it: `deleteCustomer` in
 * the ledger core removes the record, and the record carries its
 * bills (with their payments), manual baqaya, complaint tickets
 * (incidents), installment plans, sub-contributors, package history,
 * relocation log, service-status history, disconnect history, monthly
 * price schedule, deposit offsets and pause-skipped months. The gap
 * was the separate per-customer stores — each a localStorage key
 * holding rows keyed to a customer id — whose rows stayed behind as
 * orphans keyed to a customer id that no longer exists.
 *
 * This module is the registry of those stores and the pure
 * purge/restore over them. It never reads storage, the clock or the
 * network, and never mutates an input: the caller supplies the parsed
 * store values (or a storage-like object for the wrappers) and gets
 * new values back. A store whose value does not match its expected
 * shape is left exactly as it was — the purge never guesses.
 *
 * Match kinds:
 *   'customerId' — array of records; record.customerId is the owner.
 *   'customer' — array of records; record.customer is the owner
 *     (wada records and collection promises use `customer`, not
 *     `customerId`).
 *   'either' — household links; record.customerA or record.customerB
 *     is the deleted customer (a link to a deleted customer is dead).
 *   'nestedCustomer' — array of records; record.customer.id is the
 *     owner (optical acceptance certs nest the subscriber).
 *   'complaintRef' — array of records; record.complaintRef is one of
 *     the deleted customer's incident ids (follow-ups, reopen notes
 *     and escalations are filed against the complaint, not the
 *     customer).
 *   'ticketId' — array of records; record.ticketId is one of the
 *     deleted customer's incident ids (satisfaction notes).
 *   'caseId' — array of records; record.caseId is one of the deleted
 *     customer's dispute case ids (resolutions). The case ids come
 *     from the dispute cases removed in the first pass.
 *   'caseRef' — array of records; record.caseRef is one of the deleted
 *     customer's dispute case ids (evidence).
 *   'routeNotes' — one day's object { date, notes: { customerId:
 *     note } }; the deleted customer's note is removed.
 *   'routeOutcomes' — one day's object { date, outcomes: {
 *     customerId: outcome } }; the deleted customer's outcome is
 *     removed.
 *   'routeProgress' — one day's object { date, collectedIds: [...] };
 *     the deleted customer leaves the collected list.
 *
 * Deliberately NOT in the registry (documented, not an oversight):
 *   - Audit trails (the operator audit log, the payment deletion
 *     log) — deleting them would destroy the record of what the
 *     operator did, including the delete itself.
 *   - Splice inspection certs — their records carry no customer key
 *     (enclosure id and location only); they are plant records, not
 *     customer history.
 *   - Referral tracking — a referral record names both the referrer
 *     and the new customer; deleting the referrer must not erase the
 *     new customer's referral, so it needs its own rule, not a blind
 *     customer-id match.
 *   - Any store not listed here: the registry extends one line per
 *     store, once its record shape is verified the same way.
 */

export const CUSTOMER_HISTORY_STORES = Object.freeze([
  // Billing, promises and service state — the customer's money history.
  { key: 'shahdara_wada_records_v1', match: 'customer' },
  { key: 'shahdara_collection_promises_v1', match: 'customer' },
  { key: 'shahdara_collection_promises_v2', match: 'customer' },
  { key: 'shahdara_suspension_records_v1', match: 'customerId' },
  { key: 'shahdara_payment_claims_v1', match: 'customerId' },
  { key: 'shahdara_customer_adjustments', match: 'customerId' },
  { key: 'shahdara_reminder_log_v1', match: 'customerId' },
  // Complaints and disputes — the customer's complaint history.
  { key: 'shahdara_complaint_acks_v1', match: 'customerId' },
  { key: 'shahdara_complaint_followups_v1', match: 'complaintRef' },
  { key: 'shahdara_complaint_reopen_notes_v1', match: 'complaintRef' },
  { key: 'shahdara_complaint_escalations_v1', match: 'complaintRef' },
  { key: 'shahdara_satisfaction_notes_v1', match: 'ticketId' },
  { key: 'shahdara_dispute_cases_v1', match: 'customerId' },
  { key: 'shahdara_dispute_claims', match: 'customerId' },
  { key: 'shahdara_dispute_followups_v1', match: 'customerId' },
  { key: 'shahdara_dispute_letters_sent_v1', match: 'customerId' },
  { key: 'shahdara_dispute_resolutions_v1', match: 'caseId' },
  { key: 'shahdara_dispute_evidence_v1', match: 'caseRef' },
  // Contacts, notes and change history — the customer's record.
  { key: 'shahdara_emc_contacts_v1', match: 'customerId' },
  { key: 'shahdara_chn_notes_v1', match: 'customerId' },
  { key: 'shahdara_gai_notes_v1', match: 'customerId' },
  { key: 'shahdara_hea_notes_v1', match: 'customerId' },
  { key: 'shahdara_sln_notes_v1', match: 'customerId' },
  { key: 'shahdara_sin_notes_v1', match: 'customerId' },
  { key: 'shahdara_taw_flags_v1', match: 'customerId' },
  { key: 'shahdara_fch_changes_v1', match: 'customerId' },
  { key: 'shahdara_mcr_changes_v1', match: 'customerId' },
  { key: 'shahdara_ncl_logs_v1', match: 'customerId' },
  { key: 'shahdara_mvh_moves_v1', match: 'customerId' },
  { key: 'shahdara_hhl_links_v1', match: 'either' },
  { key: 'shahdara_pcd_notes_v1', match: 'customerId' },
  // Service and field QA records for the customer's connection.
  { key: 'shahdara_service_agreements', match: 'customerId' },
  { key: 'shahdara_equipment_retrievals_v1', match: 'customerId' },
  { key: 'shahdara_plan_migrations_v1', match: 'customerId' },
  { key: 'shahdara_orl_certs_v1', match: 'customerId' },
  { key: 'shahdara_ddmi_certs_v1', match: 'customerId' },
  { key: 'shahdara_drop_inspections_v1', match: 'customerId' },
  { key: 'shahdara_ethernet_cert_v1', match: 'customerId' },
  { key: 'shahdara_optical_acceptance_v1', match: 'nestedCustomer' },
  // Today's field route state — date-scoped, gone at midnight anyway.
  { key: 'shahdara_field_route_notes', match: 'routeNotes' },
  { key: 'shahdara_field_route_outcomes', match: 'routeOutcomes' },
  { key: 'shahdara_field_route_progress', match: 'routeProgress' },
]);

const DISPUTE_CASES_KEY = 'shahdara_dispute_cases_v1';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rowBelongsToCustomer(row, entry, customerId) {
  if (!isObject(row)) return false;
  switch (entry.match) {
    case 'customerId': return row.customerId === customerId;
    case 'customer': return row.customer === customerId;
    case 'either': return row.customerA === customerId || row.customerB === customerId;
    case 'nestedCustomer': return isObject(row.customer) && row.customer.id === customerId;
    default: return false;
  }
}

// Purge one array store. Returns { kept, removed } where removed is
// [{ index, row }] — the index is kept so restore puts each row back
// at its exact position.
function purgeArrayStore(value, belongs) {
  if (!Array.isArray(value)) return null;
  const kept = [];
  const removed = [];
  value.forEach((row, index) => {
    if (belongs(row)) removed.push({ index, row });
    else kept.push(row);
  });
  return { kept, removed };
}

function purgeRouteMapStore(value, containerField, customerId) {
  if (!isObject(value) || !isObject(value[containerField])) return null;
  if (!(customerId in value[containerField])) return { kept: value, removed: null };
  const keptContainer = { ...value[containerField] };
  const removedValue = keptContainer[customerId];
  delete keptContainer[customerId];
  return { kept: { ...value, [containerField]: keptContainer }, removed: { [customerId]: removedValue } };
}

function purgeRouteProgressStore(value, customerId) {
  if (!isObject(value) || !Array.isArray(value.collectedIds)) return null;
  const index = value.collectedIds.indexOf(customerId);
  if (index < 0) return { kept: value, removed: null };
  const keptIds = [...value.collectedIds];
  keptIds.splice(index, 1);
  return { kept: { ...value, collectedIds: keptIds }, removed: { index, customerId } };
}

/**
 * Purge every registry store row keyed to the deleted customer.
 * `stores` is a plain object of parsed store values ({ storeKey:
 * parsedValue }); it is never mutated. `complaintRefs` is the deleted
 * customer's incident ids (their complaint tickets ride the customer
 * record, so the caller passes them in). Returns { stores, removed }:
 * `stores` holds the kept values, `removed` holds exactly what was
 * taken out, keyed by store — the 5-second Undo restores from it.
 */
export function purgeCustomerHistoryStores(stores, { customerId, complaintRefs = [] } = {}) {
  const source = isObject(stores) ? stores : {};
  const removed = {};
  const next = { ...source };
  if (typeof customerId !== 'string' || customerId === '') return { stores: next, removed };
  const complaintRefSet = new Set(Array.isArray(complaintRefs) ? complaintRefs.filter(ref => typeof ref === 'string') : []);
  const disputeCaseIds = new Set();

  // Pass 1 — everything keyed directly to the customer. The dispute
  // cases removed here give the case ids for pass 2.
  for (const entry of CUSTOMER_HISTORY_STORES) {
    if (!(entry.key in source)) continue;
    const value = source[entry.key];
    let result = null;
    if (entry.match === 'routeNotes') result = purgeRouteMapStore(value, 'notes', customerId);
    else if (entry.match === 'routeOutcomes') result = purgeRouteMapStore(value, 'outcomes', customerId);
    else if (entry.match === 'routeProgress') result = purgeRouteProgressStore(value, customerId);
    else if (['customerId', 'customer', 'either', 'nestedCustomer'].includes(entry.match)) {
      result = purgeArrayStore(value, row => rowBelongsToCustomer(row, entry, customerId));
    } else continue;
    if (result === null) continue;
    if (result.removed === null || (Array.isArray(result.removed) && result.removed.length === 0)) continue;
    next[entry.key] = result.kept;
    removed[entry.key] = result.removed;
    if (entry.key === DISPUTE_CASES_KEY) {
      for (const { row } of result.removed) {
        if (isObject(row) && typeof row.id === 'string') disputeCaseIds.add(row.id);
      }
    }
  }

  // Pass 2 — rows filed against the customer's complaints and dispute
  // cases, not against the customer directly.
  for (const entry of CUSTOMER_HISTORY_STORES) {
    if (!(entry.key in source)) continue;
    if (entry.match !== 'complaintRef' && entry.match !== 'ticketId' && entry.match !== 'caseId' && entry.match !== 'caseRef') continue;
    const field = entry.match;
    const ids = (field === 'complaintRef' || field === 'ticketId') ? complaintRefSet : disputeCaseIds;
    if (ids.size === 0) continue;
    const result = purgeArrayStore(source[entry.key], row => isObject(row) && typeof row[field] === 'string' && ids.has(row[field]));
    if (result === null || result.removed.length === 0) continue;
    next[entry.key] = result.kept;
    removed[entry.key] = result.removed;
  }

  return { stores: next, removed };
}

/**
 * Put a removed bundle back, exactly: array rows return to their
 * recorded positions, route entries return to their maps, the
 * collected id returns to its slot. `stores` is never mutated.
 */
export function restoreCustomerHistoryStores(stores, removed) {
  const source = isObject(stores) ? stores : {};
  const bundle = isObject(removed) ? removed : {};
  const next = { ...source };
  for (const entry of CUSTOMER_HISTORY_STORES) {
    if (!(entry.key in bundle)) continue;
    const taken = bundle[entry.key];
    const value = source[entry.key];
    if (entry.match === 'routeNotes' || entry.match === 'routeOutcomes') {
      const field = entry.match === 'routeNotes' ? 'notes' : 'outcomes';
      if (!isObject(taken)) continue;
      const base = isObject(value) && isObject(value[field]) ? { ...value } : { [field]: {} };
      base[field] = { ...base[field], ...taken };
      next[entry.key] = base;
    } else if (entry.match === 'routeProgress') {
      if (!isObject(taken) || typeof taken.customerId !== 'string' || !Number.isInteger(taken.index)) continue;
      const ids = isObject(value) && Array.isArray(value.collectedIds) ? [...value.collectedIds] : [];
      if (!ids.includes(taken.customerId)) ids.splice(Math.min(taken.index, ids.length), 0, taken.customerId);
      next[entry.key] = isObject(value) ? { ...value, collectedIds: ids } : { collectedIds: ids };
    } else {
      if (!Array.isArray(taken)) continue;
      const kept = Array.isArray(value) ? [...value] : [];
      const ordered = [...taken].sort((a, b) => a.index - b.index);
      for (const { index, row } of ordered) {
        if (!isObject(row) || !Number.isInteger(index)) continue;
        kept.splice(Math.min(index, kept.length), 0, row);
      }
      next[entry.key] = kept;
    }
  }
  return next;
}

function readStore(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    if (raw === null || raw === undefined) return { present: false, value: undefined };
    return { present: true, value: JSON.parse(raw) };
  } catch {
    return { present: false, value: undefined };
  }
}

function writeStore(storage, key, value) {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
  } catch { /* a failed write leaves the previous value in place */ }
}

/**
 * Storage wrapper for the delete handler: purge the registry stores
 * in a storage-like object ({ getItem, setItem }) and return the
 * removed bundle for the Undo. Only stores that actually change are
 * written back. Never throws — unreadable storage simply purges
 * nothing.
 */
export function purgeCustomerHistoryFromStorage(storage, { customerId, complaintRefs = [] } = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return { removed: {} };
  const parsed = {};
  for (const entry of CUSTOMER_HISTORY_STORES) {
    const { present, value } = readStore(storage, entry.key);
    if (present) parsed[entry.key] = value;
  }
  const { stores, removed } = purgeCustomerHistoryStores(parsed, { customerId, complaintRefs });
  for (const key of Object.keys(removed)) writeStore(storage, key, stores[key]);
  return { removed };
}

/**
 * Storage wrapper for the Undo: put a removed bundle back into a
 * storage-like object. Never throws.
 */
export function restoreCustomerHistoryToStorage(storage, removed) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return;
  if (!isObject(removed)) return;
  const parsed = {};
  for (const key of Object.keys(removed)) {
    const { present, value } = readStore(storage, key);
    if (present) parsed[key] = value;
  }
  const restored = restoreCustomerHistoryStores(parsed, removed);
  for (const key of Object.keys(removed)) writeStore(storage, key, restored[key]);
}
