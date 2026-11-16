// Sharafat 64 — one write path for live Waada promises.
//
// The live promise lives on the customer record (SISP-3, waada-queue.js
// setCustomerWaada) while the history/points dashboard reads only the
// polish-#5 wada-record store — and the only writer into that store was
// the profile banner quick-add form. A waada set from the chip dialog or
// a remainder waada never appeared in the dashboard/history, and a
// banner-recorded wada never became the live promise / queue tier.
//
// This module is the single writer both directions: setLiveWaada sets
// the live promise AND mirrors the same promise into the wada-record
// store; clearLiveWaadaIfMatched clears the live promise when a wada
// record is marked kept and matches it. The live promise stays the
// source of truth for tiers, queues, reminders and the SISP-98 score;
// the record store is a derived history mirror, never the other way
// round. Collection promises (v1/v2) are out of scope here — a separate
// split with its own migration design — so this module must not present
// the dashboard as covering them.
//
// Purity: this module imports two import-free modules only, so no cycle
// is possible. It never reads storage, the clock (except Date.now for
// the record id, as the banner does today), or the network, and it never
// mutates its inputs. Void/undo restores must NOT call this module: a
// restored promise is not a new promise, and mirroring it would
// double-count history and dashboard points.
//
// Two traps the writer closes (both silent failures before):
//   - recordWadaRecord dedupes by id ONLY, so re-setting the same
//     promise with a fresh id would create a duplicate pending record
//     and double-count dashboard points. The writer dedupes by
//     (customer, promisedDate, amountPromised) against pending records
//     first and reports 'duplicate'.
//   - cleanWholeRupees silently refuses a non-whole amount, while
//     setCustomerWaada never rounds to whole rupees (remainder amounts
//     are rounded to cents). The writer rounds the mirrored amount to
//     whole rupees, and compares list lengths against the NORMALIZED
//     base so a refused mirror is surfaced as 'refused', never dropped
//     silently.
import { setCustomerWaada, clearCustomerWaada } from './waada-queue.js';
import {
  recordWadaRecord,
  normalizeWadaRecordList,
  activeWadaRecordsForCustomer
} from './wada-record.js';

// Record ids follow the banner's WD-<millis> convention, with a
// per-call suffix so two different promises set in the same
// millisecond cannot collide on the id (recordWadaRecord dedupes by id
// and would refuse the second one).
let mirrorSequence = 0;

/** A promise amount as whole rupees, or null when none was given. */
function toWholeRupees(amount) {
  if (amount === null || amount === undefined || amount === '') return null;
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value) : null;
}

/**
 * Sets (or replaces) the live Waada promise on a customer record and
 * mirrors the same promise into the wada-record store.
 * Returns { customer, records, mirrorWritten, mirrorStatus } where
 * mirrorStatus is 'written' | 'duplicate' | 'refused':
 *   - 'written': the mirror record was added; save `records`.
 *   - 'duplicate': a pending record for the same customer, date and
 *     amount already exists; the live promise was still set, and
 *     `records` is the normalized input unchanged.
 *   - 'refused': the record could not be written (no customer id, or
 *     a non-positive rounded amount, which the record store cannot
 *     represent); the live promise was still set, and the caller must
 *     surface the refusal — never drop it silently.
 * The input customer and records list are never mutated. Throws on an
 * invalid promise date or a non-positive promise amount, exactly like setCustomerWaada.
 */
export function setLiveWaada(customer, records, { promiseDate, promiseAmount, promiseNote } = {}) {
  const updated = setCustomerWaada(customer, { promiseDate, promiseAmount, promiseNote });
  const base = normalizeWadaRecordList(records);
  const customerId = typeof updated.id === 'string' ? updated.id.trim() : '';
  const date = updated.promiseDate;
  const rounded = toWholeRupees(updated.promiseAmount);
  const refused = { customer: updated, records: base, mirrorWritten: false, mirrorStatus: 'refused' };
  if (!customerId) return refused;
  if (rounded !== null && rounded <= 0) return refused;
  const duplicate = activeWadaRecordsForCustomer(base, customerId)
    .some((record) => record.promisedDate === date && record.amountPromised === rounded);
  if (duplicate) {
    return { customer: updated, records: base, mirrorWritten: false, mirrorStatus: 'duplicate' };
  }
  mirrorSequence += 1;
  const next = recordWadaRecord(base, {
    id: `WD-${Date.now()}-${mirrorSequence}`,
    customer: customerId,
    promisedDate: date,
    amountPromised: rounded,
    note: updated.promiseNote ?? '',
    status: 'pending',
    closedDate: ''
  });
  // Compare against the NORMALIZED base, not the caller's list: a list
  // that arrived with invalid rows is shorter after normalize, and
  // that shortening must never read as a write.
  if (next.length === base.length) return refused;
  return { customer: updated, records: next, mirrorWritten: true, mirrorStatus: 'written' };
}

/**
 * Clears the live Waada promise, but only when the given wada record
 * matches it: same customer, same promised date, and the same amount
 * (both rounded to whole rupees the way the mirror was written; null
 * matches null). Returns the cleared customer, or the input unchanged
 * when anything differs — so marking an old record kept never wipes a
 * newer live promise. A record marked broken must never call this: the
 * 'broken' tier IS the follow-up signal, and clearing the live promise
 * would hide the customer from the broken queue.
 */
export function clearLiveWaadaIfMatched(customer, record) {
  if (!customer || typeof customer !== 'object') return customer;
  if (!record || typeof record !== 'object') return customer;
  const liveDate = typeof customer.promiseDate === 'string' ? customer.promiseDate.trim() : '';
  if (!liveDate) return customer;
  if (typeof record.promisedDate !== 'string' || record.promisedDate.trim() !== liveDate) return customer;
  const customerId = typeof customer.id === 'string' ? customer.id.trim() : '';
  const recordCustomer = typeof record.customer === 'string' ? record.customer.trim() : '';
  if (!customerId || !recordCustomer || recordCustomer !== customerId) return customer;
  const liveAmount = toWholeRupees(customer.promiseAmount);
  const recordAmount = record.amountPromised ?? null;
  if (liveAmount !== recordAmount) return customer;
  return clearCustomerWaada(customer);
}
