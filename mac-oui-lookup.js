// SISP-113: 100% offline MAC address OUI vendor lookup + randomized-MAC
// guard. Pure and import-free: no network fetch of any vendor database,
// ever — the table below is a small curated subset of well-known IEEE
// MA-L (OUI) assignments for the CPE/router brands this ISP actually
// installs. It is public vendor reference data, NOT customer data.
//
// An OUI match is only ever a display hint: an unknown prefix shows
// nothing (no guessed vendor), a known prefix never blocks or changes
// saving, and the stored MAC is never rewritten.
//
// MAC normalization: this module keeps its own scoped bare-hex
// normalizer (normalizeMacHex) even though SISP-74 has since landed
// core.js normalizeIdentityValue. The two are NOT interchangeable:
// normalizeIdentityValue is a lenient dedup canonicalizer (it strips
// every non-hex character, so garbage silently vanishes), while this
// module's contract is strict validation — any non-hex character makes
// the value malformed (null), so a mistyped MAC can never be treated
// as a valid full MAC or matched to a vendor. The scoped normalizer is
// genuinely MAC-format-specific, so it stays; the shared helper is
// neither renamed nor duplicated for identity purposes.

const VENDOR_OUI_PREFIXES = Object.freeze({
  Tenda: ['C83A35'],
  'TP-Link': [
    '10FEED', '14CC20', '14CF92', '14E6E4', '50C7BF', '98DED0',
    'AC84C6', 'C025E9', 'EC086B', 'F4EC38', 'F4F26D', 'F81A67'
  ],
  Huawei: ['00E0FC', '149D09', '14A0F8', '14A51A', '14D11F', '80FB06', '884477', 'F823B2'],
  ZTE: ['D0154A'],
  FiberHome: [
    '0C8447', '1077B0', '1088CE', '10DC4A', '142233', '14E9B2',
    '185282', 'D041C9', 'F4573E', 'F84D33'
  ],
  Mercusys: ['386B1C', 'C0252F', 'C0A5DD', 'C8E7D8'],
  MikroTik: ['000C42', '4C5E0C', '48A98A', '64D154', 'CC2DE0', 'DC2C6E', 'E48D8C']
});

// Flat prefix -> vendor lookup, built once from the table above.
export const MAC_OUI_VENDORS = Object.freeze(Object.fromEntries(
  Object.entries(VENDOR_OUI_PREFIXES).flatMap(([vendor, prefixes]) => prefixes.map((prefix) => [prefix, vendor]))
));

// Second hex digit of the first octet when the locally-administered
// (U/L) bit is set on a unicast address: 2, 6, A or E.
const RANDOMIZED_SECOND_DIGITS = new Set(['2', '6', 'A', 'E']);

/**
 * Bare-hex MAC normalization: accepts colon, hyphen, dot or bare-hex
 * input in any case and returns the uppercase hex digits, or null when
 * the value is empty or contains anything that is not hex/separators.
 */
export function normalizeMacHex(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const hex = raw.replace(/[:\-.\s]/g, '');
  if (!hex || !/^[0-9A-Fa-f]+$/.test(hex)) return null;
  return hex.toUpperCase();
}

/** True only for a complete 48-bit MAC (exactly 12 hex digits). */
export function isFullMacAddress(value) {
  const hex = normalizeMacHex(value);
  return hex !== null && hex.length === 12;
}

/** The 3-octet OUI prefix (6 uppercase hex chars) of a full MAC, else null. */
export function macOuiPrefix(value) {
  const hex = normalizeMacHex(value);
  return hex !== null && hex.length === 12 ? hex.slice(0, 6) : null;
}

/**
 * Vendor name for a full MAC's OUI, or null when the prefix is not in
 * the offline table (unknown OUIs are never guessed). Partial or
 * malformed input also returns null.
 */
export function macOuiVendor(value) {
  const prefix = macOuiPrefix(value);
  return prefix === null ? null : (MAC_OUI_VENDORS[prefix] ?? null);
}

/**
 * True when the first octet carries the locally-administered bit
 * (second hex digit 2/6/A/E) — the mark of a phone's randomized MAC
 * rather than a factory router MAC. Needs only the first octet, so it
 * can warn while the address is still being typed; malformed input is
 * false, never a throw.
 */
export function isRandomizedMac(value) {
  const hex = normalizeMacHex(value);
  return hex !== null && hex.length >= 2 && RANDOMIZED_SECOND_DIGITS.has(hex[1]);
}

/** Combined lookup for UI surfaces: { vendor, randomized, prefix }. */
export function macOuiLookup(value) {
  return {
    vendor: macOuiVendor(value),
    randomized: isRandomizedMac(value),
    prefix: macOuiPrefix(value)
  };
}
