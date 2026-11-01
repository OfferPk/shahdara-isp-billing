// SISP-143: Tenant (کرائے دار) vs. Homeowner Tag & Guarantor/Deposit Guard.
//
// Three optional fields ride the customer record:
//   residenceType            'owner' | 'tenant' | 'commercial_shop'
//   landlordOrGuarantorName  free text (single line, max 100 chars)
//   landlordPhone            free text (single line, max 40 chars)
// All three are absent-by-default: legacy records carry none of them and
// behave exactly as before (no migration). Sanitizers here are the single
// reading point — any value that is not exactly one of the enum values
// (residenceType) normalizes to '' (not recorded), and the text fields
// are trimmed, flattened to a single line and length-capped, mirroring
// the SISP-19 custody sanitizers in hardware-custody.js. Junk in storage
// or in a backup therefore degrades to "not recorded", never to a crash
// and never to invented data.
//
// The guard is a pure derivation: a TENANT holding ISP-owned hardware
// (SISP-19 custody) with NO security deposit recorded is a deposit risk
// — the ISP's router/ONU can walk away with the tenant. Owner and
// commercial customers with the same hardware and no deposit do NOT
// warn (the rule is tenant-specific by design), and a tenant who has
// paid any deposit does not warn either. The warning is display-only;
// nothing in this module writes state or blocks any flow.
import { CUSTODY_OWNERSHIP_ISP_OWNED, normalizeCustodyFields } from './hardware-custody.js';

export const RESIDENCE_TYPES = Object.freeze(['owner', 'tenant', 'commercial_shop']);
export const LANDLORD_NAME_MAX_LENGTH = 100;
export const LANDLORD_PHONE_MAX_LENGTH = 40;

const singleLine = (value, maxLength) => String(value ?? '')
  .replace(/[\r\n\u2028\u2029]+/g, ' ')
  .trim()
  .slice(0, maxLength);

/** Enum reader: only the exact stored values count; anything else is absent. */
export function sanitizeResidenceType(value) {
  return RESIDENCE_TYPES.includes(value) ? value : '';
}

export function sanitizeLandlordOrGuarantorName(value) {
  return typeof value === 'string' ? singleLine(value, LANDLORD_NAME_MAX_LENGTH) : '';
}

export function sanitizeLandlordPhone(value) {
  return typeof value === 'string' ? singleLine(value, LANDLORD_PHONE_MAX_LENGTH) : '';
}

/** Safe occupancy fields for any customer, old or new. Never throws. */
export function normalizeOccupancyFields(customer = {}) {
  const source = customer && typeof customer === 'object' ? customer : {};
  return {
    residenceType: sanitizeResidenceType(source.residenceType),
    landlordOrGuarantorName: sanitizeLandlordOrGuarantorName(source.landlordOrGuarantorName),
    landlordPhone: sanitizeLandlordPhone(source.landlordPhone)
  };
}

/** True when at least one occupancy/guarantor field is actually recorded. */
export function hasOccupancyRecord(customer = {}) {
  const fields = normalizeOccupancyFields(customer);
  return Boolean(fields.residenceType || fields.landlordOrGuarantorName || fields.landlordPhone);
}

/** True when the customer holds any ISP-owned custody hardware (SISP-19). */
export function holdsIspOwnedHardware(customer = {}) {
  const custody = normalizeCustodyFields(customer);
  return custody.routerOwnership === CUSTODY_OWNERSHIP_ISP_OWNED
    || custody.mediaConverterOwnership === CUSTODY_OWNERSHIP_ISP_OWNED;
}

/**
 * The deposit guard: tenant + ISP-owned hardware + no security deposit.
 * securityDeposit reads through the custody normalizer, so an absent,
 * zero or unreadable deposit all count as "no deposit"; any positive
 * recorded deposit clears the risk.
 */
export function tenantDepositRisk(customer = {}) {
  if (normalizeOccupancyFields(customer).residenceType !== 'tenant') return false;
  if (!holdsIspOwnedHardware(customer)) return false;
  const deposit = normalizeCustodyFields(customer).securityDeposit;
  return !(deposit > 0);
}
