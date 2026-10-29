/**
 * default-customers.js — Owner default customer roster (ALEX, 2026-10-29).
 *
 * ALEX supplied his real customer list in writing (WhatsApp, 2026-10-29
 * 13:43 PKT) and directed that these customers be added BY DEFAULT into
 * the existing app: "BASS YEAH BY DEFAULT ADD HO JAY EXISTING APP MAI —
 * EN K PACKAGES OUR MOBILE NUMBER KHUD SY ADD KARY GA ADMIN" (packages
 * and mobile numbers are added by the admin himself later). The roster
 * below is that list transcribed EXACTLY: names verbatim as the owner
 * wrote them (spellings, mixed case and all), grouped by the owner's
 * mohalla labels. No package, mobile, balance or bill data is invented —
 * an imported record is a blank roster entry (the app's own addCustomer
 * defaults: no package, serviceStatus 'not-set', no bills) that the admin
 * completes later.
 *
 * FREE connections (owner amendment, 2026-10-29 13:46 PKT): AQIB 1,
 * AQIB 999 and FREE ID LINE MAN (all BARRIAN) are FREE by default. They
 * carry `free: true` here, land on the customer record as
 * `isFreeConnection: true`, show a visible FREE tag, and NEVER get a
 * bill: bill generation skips them (core generateMonthlyBills and the
 * SISP-2 billing cycle), and defaulter/grace outputs exclude them. They
 * still appear in the customer list and counts — their only purpose is
 * roster accuracy.
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

/** Bump when the owner supplies a corrected roster; the settings marker
 *  stores the version that already ran, so a bump re-runs the (still
 *  idempotent) planner once on every device. */
export const DEFAULT_ROSTER_VERSION = 1;

const entry = (name, mohalla, free = false) =>
  Object.freeze(free ? { name, mohalla, free: true } : { name, mohalla });

/** The owner's roster, verbatim, in his written order (93 entries). */
export const DEFAULT_CUSTOMER_ROSTER = Object.freeze([
  // CHARYAA (6)
  entry('TEHMINA KHALLA', 'CHARYAA'),
  entry('SAFAEER', 'CHARYAA'),
  entry('NAZEER', 'CHARYAA'),
  entry('AWAIS', 'CHARYAA'),
  entry('KHALEEL', 'CHARYAA'),
  entry('Afzal Shah darbar', 'CHARYAA'),
  // GANGALL (16)
  entry('AC FARM HOUSE', 'GANGALL'),
  entry('MNA FARM HOUSE', 'GANGALL'),
  entry('ZARSHAAD KHAN', 'GANGALL'),
  entry('CH BILAL', 'GANGALL'),
  entry('MUHAMMAD QASIM', 'GANGALL'),
  entry('RAJA JUNAID', 'GANGALL'),
  entry('RAJA USMAN URF SAMI', 'GANGALL'),
  entry('HAJI ZAFAR', 'GANGALL'),
  entry('RAJA USAMA', 'GANGALL'),
  entry('RAJA AQEEL', 'GANGALL'),
  entry('RAJA HASEEB', 'GANGALL'),
  entry('GULL ZAIB PATHAN', 'GANGALL'),
  entry('RAJA BILAL', 'GANGALL'),
  entry('RAJA JAWAAD', 'GANGALL'),
  entry('qari mubashir', 'GANGALL'),
  entry('FAREED ABBASI', 'GANGALL'),
  // BARRIAN (14) — the last three are the owner's FREE connections.
  entry('DOCTOR ESSAN', 'BARRIAN'),
  entry('DOCTOR ZAHID', 'BARRIAN'),
  entry('DIL NAWAZ ABBASI', 'BARRIAN'),
  entry('RAJA SAQIB', 'BARRIAN'),
  entry('RAJA RIAZ', 'BARRIAN'),
  entry('RAJA WAQAR', 'BARRIAN'),
  entry('JAHANGEER ABBASI', 'BARRIAN'),
  entry('RAJA NOMI', 'BARRIAN'),
  entry('MUFTI SADAQAT QUBAA MASJID', 'BARRIAN'),
  entry('RAJA MOHSIN', 'BARRIAN'),
  entry('RAJA SHARJELL', 'BARRIAN'),
  entry('AQIB 1', 'BARRIAN', true),
  entry('AQIB 999', 'BARRIAN', true),
  entry('FREE ID LINE MAN', 'BARRIAN', true),
  // CHAMYAAA (7)
  entry('RAJA TOUSEEF', 'CHAMYAAA'),
  entry('RAJA SHANI', 'CHAMYAAA'),
  entry('RAJA SIKANDAR 222', 'CHAMYAAA'),
  entry('KIRAN BILAL', 'CHAMYAAA'),
  entry('RAJA JAWAAD', 'CHAMYAAA'),
  entry('SHAHMEER SHAH', 'CHAMYAAA'),
  entry('sheraaz Shah', 'CHAMYAAA'),
  // PALALIYAA (10)
  entry('RAJA FAISAL', 'PALALIYAA'),
  entry('FAJA SHUNAID', 'PALALIYAA'),
  entry('RAJA TAIMOOR CHANDAAAL', 'PALALIYAA'),
  entry('BUTT FARM HOUSE', 'PALALIYAA'),
  entry('BAJWA FARM HOUSE', 'PALALIYAA'),
  entry('BANGISH FARM HOUSE', 'PALALIYAA'),
  entry('RAJA HAFEEZ', 'PALALIYAA'),
  entry('RAJA KHAZEER', 'PALALIYAA'),
  entry('MOLVI ZUBAIR', 'PALALIYAA'),
  entry('RAJA AQEEL', 'PALALIYAA'),
  // THALII (8)
  entry('Raja ARIF', 'THALII'),
  entry('RAJA MEHMOOD', 'THALII'),
  entry('RAJA SHEHZAAD', 'THALII'),
  entry('RAJA SADAAM', 'THALII'),
  entry('RAJA KASHIF', 'THALII'),
  entry('KASHIF ABBASI 100Gb', 'THALII'),
  entry('RIZWAN', 'THALII'),
  entry('PTA DIRECTOR', 'THALII'),
  // NAKAR (10)
  entry('RAJA IRFAN', 'NAKAR'),
  entry('RAJA FAIZAN', 'NAKAR'),
  entry('HAMZA URF BABLU', 'NAKAR'),
  entry('BABAR', 'NAKAR'),
  entry('QARI BAKAR', 'NAKAR'),
  entry('PEER MULAZAM SHAH', 'NAKAR'),
  entry('CH MURTAZA', 'NAKAR'),
  entry('CH MOIZ', 'NAKAR'),
  entry('CH SAQLAIN', 'NAKAR'),
  entry('SAWAAAR SHAH', 'NAKAR'),
  // BANII (4) — owner wrote "MOHALLA BANI"; canonical stored form is BANII.
  entry('Tahir MOLVI', 'BANII'),
  entry('RAJA MASROOR', 'BANII'),
  entry('RAJA TAIMOOR MANGRAYALL', 'BANII'),
  entry('RAJA MUJAHID', 'BANII'),
  // JABBIYAA (8)
  entry('MASTER ZAHEER', 'JABBIYAA'),
  entry('SHADI', 'JABBIYAA'),
  entry('RAB NAWAZ', 'JABBIYAA'),
  entry('SHAH NAWAZ', 'JABBIYAA'),
  entry('KHATTAK SWIMMING POOL', 'JABBIYAA'),
  entry('NADIR SHAH PULL', 'JABBIYAA'),
  entry('ORIOM SCHOOL', 'JABBIYAA'),
  entry('CH IFTHAKHAR', 'JABBIYAA'),
  // SODAA (6)
  entry('CH FAISAL', 'SODAA'),
  entry('CH NADIR GUJJAR', 'SODAA'),
  entry('CH SHAFEEQ', 'SODAA'),
  entry('ch sanwall', 'SODAA'),
  entry('ch ARBAB ALI', 'SODAA'),
  entry('CH SIKANDAR', 'SODAA'),
  // END POINT (4) — owner's own label, stored as written.
  entry('AKHTAR WAPDA HOUSE', 'END POINT'),
  entry('DC FARM HOUSE', 'END POINT'),
  entry('SSP FARM HOUSE', 'END POINT'),
  entry('RAJA ASAD FARM HOUSE', 'END POINT')
]);

/** Name comparison for roster matching: Unicode-normalized, whitespace
 *  collapsed, case-insensitive — so a hand-typed "nazeer" in the app
 *  satisfies the roster's "NAZEER". */
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
 * isFreeConnection for the owner's three free IDs) and stamps the
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
