/*
 * QC-3 — Proposed customer card (audit MISSING #9, user-specified
 * Image 2). The Quick Collect picker card and the Field Mode card
 * become: #ID + NAME, DUE badge, Mohalla · phone, Outstanding vs
 * Monthly package, and Call / Location / Collect buttons.
 *
 * This module is the shared read-only layer both card renderers use.
 * It composes three pieces that already exist, and invents nothing:
 * - Monthly package: packagePriceForCustomer (quick-amount-buttons.js)
 *   — the customer's monthlySellingAmount first, else the catalogue
 *   price for the packageSpeed label. A customer with no priced
 *   package gets null here, and the renderer shows the em dash —
 *   never a guessed amount.
 * - Call: contactActionTargets (profile-ui.js) — the profile contact
 *   shortcut action. The tel: link comes from the customer's own
 *   recorded phone field; a phone that cannot be dialled gives null
 *   and the renderer shows a disabled Call button.
 * - Location: googleMapsUrl (gps-pin-helper.js) — the customer's
 *   recorded GPS pin, already validated as a pair. No pin gives null
 *   and the renderer shows a disabled Location button — never an
 *   invented or guessed location.
 *
 * Collect is deliberately NOT a new flow: it is the existing
 * tap-to-collect behaviour as an explicit button, so this module
 * exports nothing for it — the click handlers fall through to the
 * card-tap path (openCustomerCollectionForm in the picker,
 * selectCustomer in Field Mode).
 *
 * Pure: no DOM, no clock, no storage, no mutation of its inputs.
 * The caller owns the customer record and passes it in; the pool
 * (getPendingCollectionCustomers) computes the fields once so both
 * renderers read them from the entry.
 */

import { contactActionTargets } from './profile-ui.js';
import { googleMapsUrl } from './gps-pin-helper.js';
import { packagePriceForCustomer } from './quick-amount-buttons.js';

/**
 * The customer's monthly package figure in rupees, or null when the
 * customer has no priced package. Non-object input is null.
 */
export function qc3MonthlyPackage(source, catalogue) {
  if (!source || typeof source !== 'object') return null;
  return packagePriceForCustomer(source, catalogue);
}

/**
 * One object per customer card: the monthly package figure, the
 * tel: link for the recorded phone, and the maps URL for the recorded
 * GPS pin. Each field is null when its data is missing — the
 * renderers show the honest disabled / em-dash state, never a guess.
 */
export function qc3CardActions(source, catalogue) {
  const customer = source && typeof source === 'object' ? source : {};
  const target = contactActionTargets(customer.phone);
  return {
    monthlyPackage: qc3MonthlyPackage(customer, catalogue),
    callHref: target?.tel ?? null,
    mapsUrl: googleMapsUrl(customer),
  };
}
