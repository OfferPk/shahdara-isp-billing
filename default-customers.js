/**
 * default-customers.js — Default customer roster import machinery.
 *
 * PRIVACY (owner order, 2026-10-29): customer names are intentionally
 * NOT shipped in this public repository. The shipped roster below is
 * EMPTY, so the import adds nobody: the app starts with an empty
 * customer list and every record is entered by the owner locally. The
 * planner/import plumbing is kept fully working so a future PRIVATE
 * roster can be supplied outside this repo without code changes.
 *
 * Roster entries may carry `free: true`; such an entry lands on the
 * customer record as `isFreeConnection: true`, shows a visible FREE
 * tag, and NEVER gets a bill: bill generation skips free connections
 * (core generateMonthlyBills and the SISP-2 billing cycle), and
 * defaulter/grace outputs exclude them.
 *
 * Import behaviour (runs once on app load, see app.js):
 *  - A settings marker (`state.settings.defaultCustomersImport`) records
 *    { doneAt, rosterVersion } once the import has run for the current
 *    DEFAULT_ROSTER_VERSION, so later loads skip it entirely.
 *  - The planner is independently idempotent: it counts, per
 *    (canonical mohalla, normalized name) group, how many ACTIVE
 *    (non-archived) customers already exist versus how many the roster
 *    lists, and adds ONLY the shortfall — so running it twice adds 0
 *    the second time, and a device that already has some of these
 *    customers (typed in by hand, or restored from a backup without the
 *    marker) is topped up, never duplicated. Existing customers are
 *    never modified, renamed or deleted by this import.
 *  - New records are created through the app's real creation path
 *    (core addCustomer), so customerNumber assignment and record shape
 *    match a hand-added customer exactly.
 */

import { addCustomer } from './core.js';
import { canonicalMohalla } from './phase3.js';

/** Bump when a (private) roster is supplied or corrected; the settings
 *  marker stores the version that already ran, so a bump re-runs the
 *  (still idempotent) planner once on every device. Bumped to 2 for the
 *  2026-10-29 privacy cleanup that emptied the shipped roster. */
export const DEFAULT_ROSTER_VERSION = 2;

const entry = (name, mohalla, free = false) =>
  Object.freeze(free ? { name, mohalla, free: true } : { name, mohalla });

/** The shipped roster is intentionally EMPTY (privacy, see header):
 *  no customer names are bundled with this public app. `entry` above
 *  documents the entry shape a future private roster would use. */
export const DEFAULT_CUSTOMER_ROSTER = Object.freeze([]);

/** Name comparison for roster matching: Unicode-normalized, whitespace
 *  collapsed, case-insensitive — so a hand-typed name in the app
 *  satisfies the same name on a roster regardless of case/spacing. */
export function normalizeRosterName(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
}

/** Group identity for reconciliation: canonical mohalla + normalized
 *  name. The same name in a different mohalla is a different group and
 *  never satisfies this mohalla's count. */
export function rosterGroupKey(name, mohalla) {
  return `${canonicalMohalla(mohalla)?.key ?? ''}|${normalizeRosterName(name)}`;
}

/**
 * Pure reconciliation planner: (existingCustomers, roster) → the list of
 * roster entries to add. For each (mohalla, name) group the roster's
 * multiplicity is compared with the count of ACTIVE (non-archived)
 * existing customers in that group; only the shortfall is planned, in
 * roster order. Existing records are never returned for modification —
 * the output is additions only.
 */
export function planDefaultCustomerAdditions(customers, roster = DEFAULT_CUSTOMER_ROSTER) {
  const list = Array.isArray(customers) ? customers : [];
  const rosterTotals = new Map();
  for (const item of roster) {
    const key = rosterGroupKey(item.name, item.mohalla);
    rosterTotals.set(key, (rosterTotals.get(key) ?? 0) + 1);
  }
  const existingCounts = new Map();
  for (const customer of list) {
    if (!customer || customer.archived === true) continue;
    const key = rosterGroupKey(customer.name, customer.mohalla);
    if (!rosterTotals.has(key)) continue;
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  }
  const planned = new Map();
  const additions = [];
  for (const item of roster) {
    const key = rosterGroupKey(item.name, item.mohalla);
    const shortfall = Math.max(0, (rosterTotals.get(key) ?? 0) - (existingCounts.get(key) ?? 0));
    const alreadyPlanned = planned.get(key) ?? 0;
    if (alreadyPlanned < shortfall) {
      planned.set(key, alreadyPlanned + 1);
      additions.push({ name: item.name, mohalla: item.mohalla, free: item.free === true });
    }
  }
  return additions;
}

/**
 * One-shot default import, run on app load. Returns the SAME state
 * reference when the settings marker shows the current roster version
 * already ran. Otherwise adds the planned shortfall through core
 * addCustomer (blank records: name + mohalla only, plus
 * isFreeConnection for entries flagged free) and stamps the
 * marker. The input state is never mutated.
 */
export function applyDefaultCustomerRoster(state, referenceDate = new Date(), roster = DEFAULT_CUSTOMER_ROSTER) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.customers)) return state;
  const marker = state.settings?.defaultCustomersImport;
  if (marker && Number(marker.rosterVersion) >= DEFAULT_ROSTER_VERSION) return state;
  const additions = planDefaultCustomerAdditions(state.customers, roster);
  let next = state;
  for (const addition of additions) {
    next = addCustomer(next, addition.name, referenceDate, {
      mohalla: addition.mohalla,
      // Roster names legitimately repeat (same name, another mohalla —
      // and the planner has already removed every satisfied entry), so
      // the hand-entry duplicate guard must not refuse them.
      allowDuplicateName: true,
      isFreeConnection: addition.free === true
    });
  }
  const doneAt = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate.toISOString()
    : new Date().toISOString();
  return {
    ...next,
    settings: {
      ...(next.settings ?? {}),
      defaultCustomersImport: { doneAt, rosterVersion: DEFAULT_ROSTER_VERSION, addedCount: additions.length }
    }
  };
}
