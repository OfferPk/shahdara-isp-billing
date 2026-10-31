/**
 * charity-reserve.js — SISP-114: Optional Partner Profit Charity / Sadqah
 * & Emergency Reserve Calculator.
 *
 * The owner may optionally set aside a percentage of a month's POSITIVE
 * profit as a charity / sadqah & emergency reserve BEFORE the remainder
 * is split 50/50 between the partners (SISP-22 / PR #395 settlement:
 * share = 50% of positive profit, else 0). The percentage is a single
 * device setting, `charityReservePct` (default 0 = feature fully off).
 *
 * Design rules (all pinned by tests/charity-reserve.test.js):
 *
 * - DERIVED, NEVER STORED MONEY: the reserve is a computed line in the
 *   Partner Settlement report and the Owner Khata closing, exactly like
 *   the partner shares themselves. There is NO reserve ledger, NO stored
 *   balance and NO new persisted money record — the only persisted value
 *   is the percentage setting itself. Same month + same setting -> same
 *   reserve, always.
 * - INERT AT 0%: with charityReservePct 0 (or the setting absent), the
 *   settlement and Owner Khata reports are byte-identical to the
 *   pre-SISP-114 output — callers only engage this module's figures when
 *   pct > 0, and the report objects gain no new keys at 0%.
 * - POSITIVE PROFIT ONLY: on a loss / zero month the reserve is 0 and
 *   the shares stay 0, exactly as before. Reserve =
 *   round(profit * pct / 100); each partner's share =
 *   round((profit - reserve) * 0.5) — the same whole-rupee rounding and
 *   the same 0.5 rate the settlement already uses.
 * - SETTING STORAGE: localStorage key sisp_charity_reserve_v1 holds one
 *   small settings object { charityReservePct }. The sanitizer CLAMPS
 *   the percentage into [0, 100] (a typed 150 becomes 100, a negative
 *   becomes 0) and maps any non-finite / non-numeric value to 0, so a
 *   corrupt or hand-edited value can never break the settlement — it
 *   just turns the feature off or caps it.
 * - BACKUP: the setting travels in JSON backups as the optional
 *   `settings.charityReserve` section (see core.js createJsonBackup),
 *   written only when pct > 0 (0% is the default everywhere, so there is
 *   nothing to carry). Restore follows a STRICT safe-merge (see core.js
 *   previewJsonBackupMerge): the backup's percentage is adopted ONLY
 *   when this device has no charity setting stored at all; when a
 *   setting is already stored here and the backup's differs, the local
 *   value is kept and a conflict is reported — a restore can never
 *   silently enable, raise, lower or disable the reserve.
 *
 * This module imports nothing: core.js imports the sanitizer from here
 * for backup restore, and partner-settlement.js / owner-khata.js import
 * the pure calculator, so an import here could create a module cycle.
 * All helpers are pure except the load/save functions. Tests use
 * synthetic data only.
 */

export const CHARITY_RESERVE_KEY = 'sisp_charity_reserve_v1';
export const CHARITY_RESERVE_MIN_PCT = 0;
export const CHARITY_RESERVE_MAX_PCT = 100;

function wholeRupees(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Cleans one percentage value. CLAMPS into [0, 100]; non-finite or
 * non-numeric input becomes 0 (feature off). Kept to 2 decimal places
 * so stored values never carry float dust (e.g. 2.5 stays 2.5).
 */
export function sanitizeCharityReservePct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.min(CHARITY_RESERVE_MAX_PCT, Math.max(CHARITY_RESERVE_MIN_PCT, n));
  return Math.round(clamped * 100) / 100;
}

/**
 * Drops malformed settings; keeps only the known field. Accepts the
 * settings object form ({ charityReservePct }) or a bare number, so a
 * hand-written backup section still parses. Always returns a fresh
 * { charityReservePct } object — never null — so callers can read the
 * percentage without a guard.
 */
export function sanitizeCharityReserveSettings(value) {
  if (typeof value === 'number') return { charityReservePct: sanitizeCharityReservePct(value) };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { charityReservePct: 0 };
  return { charityReservePct: sanitizeCharityReservePct(value.charityReservePct) };
}

/** Reads the setting; { charityReservePct: 0 } on missing/corrupt storage. */
export function loadCharityReserveSettings(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return { charityReservePct: 0 };
    const raw = store.getItem(CHARITY_RESERVE_KEY);
    if (!raw) return { charityReservePct: 0 };
    return sanitizeCharityReserveSettings(JSON.parse(raw));
  } catch {
    return { charityReservePct: 0 };
  }
}

/** Persists the setting (sanitized first); never throws. */
export function saveCharityReserveSettings(settings, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(CHARITY_RESERVE_KEY, JSON.stringify(sanitizeCharityReserveSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure: the reserve split for one month's profit.
 *
 * Returns { charityReservePct, charityReserve, distributableProfit,
 * shareEach } where distributableProfit = profit - charityReserve and
 * shareEach is each partner's 50% of the distributable remainder.
 *
 * - pct <= 0 or profit <= 0 -> charityReserve 0; shareEach then equals
 *   the legacy settlement share exactly (round(profit * 0.5) on a
 *   positive profit, else 0), so engaging this helper can never drift
 *   the figures it replaces.
 * - Spec pin: profit 100,000 at 5% -> reserve 5,000, distributable
 *   95,000, shareEach 47,500.
 */
export function computeCharityReserve(profit, charityReservePct) {
  const pct = sanitizeCharityReservePct(charityReservePct);
  const profitWhole = wholeRupees(profit);
  if (profitWhole <= 0 || pct <= 0) {
    return {
      charityReservePct: pct,
      charityReserve: 0,
      distributableProfit: profitWhole > 0 ? profitWhole : 0,
      shareEach: profitWhole > 0 ? Math.round(profitWhole * 0.5) : 0
    };
  }
  const charityReserve = Math.round(profitWhole * pct / 100);
  const distributableProfit = profitWhole - charityReserve;
  return {
    charityReservePct: pct,
    charityReserve,
    distributableProfit,
    shareEach: Math.round(distributableProfit * 0.5)
  };
}
