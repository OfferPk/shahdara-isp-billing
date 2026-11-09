/* ipv4-validation.js — strict IPv4 validation for the profile's static
 * IP field (Polish #28 Phase E, Req 8). Pure and import-free: no DOM,
 * no state, no network — the same shape as mac-oui-lookup.js.
 *
 * A valid address is exactly four dot-separated parts, digits only,
 * each 0–255, with no leading zeros except a lone "0" (so 192.168.01.1
 * is a typo, not an address). IPv6 is out of scope (design Q7): the
 * field's maxlength (45) would fit it, but the RouterOS queue target
 * this field feeds is IPv4-only.
 *
 * The live-hint state mirrors the phone/CNIC validators
 * (form-validation.js): empty / valid / partial-tip (still typable
 * into a valid address) / malformed-invalid (cannot become valid by
 * typing more). The hint never blocks anything — only the save-time
 * check in updateCustomerProfile refuses an invalid value.
 */
export function isValidIpv4(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  const parts = raw.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^(0|[1-9][0-9]*)$/.test(part) && Number(part) <= 255);
}

export function ipv4HintState(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { empty: true, valid: false, tip: false };
  if (isValidIpv4(raw)) return { empty: false, valid: true, tip: false };
  // Partial: only digits and dots, at most four parts, and every
  // complete octet is in range with no leading zero — the operator
  // could still finish it, so it reads as a tip, not an error.
  if (/^[0-9.]+$/.test(raw)) {
    const parts = raw.split('.');
    if (parts.length <= 4 && parts.every((part) => part === '' || (/^(0|[1-9][0-9]*)$/.test(part) && Number(part) <= 255))) {
      return { empty: false, valid: false, tip: true };
    }
  }
  return { empty: false, valid: false, tip: false };
}
