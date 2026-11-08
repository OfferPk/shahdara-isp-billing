/*
 * Plan 518 — zone suggestions for the profile edit form.
 *
 * Area has a datalist of its 15 mohallas, but Zone was a bare
 * free-text input, so operators typed zone names freehand and the
 * same zone got spelled several ways. This module derives the
 * suggestions from the zones already used under the chosen area:
 * distinct zone spellings recorded on non-archived customers whose
 * area matches, sorted, so the operator picks an existing spelling
 * instead of inventing a new variant.
 *
 * The fixed Side 1–4c set was deliberately NOT used: those are
 * feeder sides for the separate feeder-zone field (FIBER_ZONES in
 * outage-impact.js), not the zone spellings operators record on
 * customers. Area matching is canonical (phase3 canonicalMohalla),
 * so "MOHALLA BANI", "Bani" and "BANII" are the same area.
 *
 * Pure and read-only: it takes the customers and the area and
 * returns a new array of strings. It never changes any customer,
 * bill, or payment record, adds no new field, and keeps no store.
 * With no area chosen, every recorded zone spelling is offered.
 * The datalist only suggests — free text is still allowed, and the
 * save path still takes the raw typed value.
 */

import { canonicalMohalla } from './phase3.js';

/** Distinct zone spellings already used under `area`, sorted.
 *  Archived customers never contribute; blank and non-string zones
 *  are ignored; exact duplicate spellings collapse to one option. */
export function zonesUnderArea(customers, area) {
  const list = Array.isArray(customers) ? customers : [];
  const areaKey = canonicalMohalla(area)?.key ?? null;
  const zones = new Set();
  for (const customer of list) {
    if (!customer || customer.archived) continue;
    const zone = typeof customer.zone === 'string' ? customer.zone.trim() : '';
    if (!zone) continue;
    if (areaKey !== null && canonicalMohalla(customer.mohalla)?.key !== areaKey) continue;
    zones.add(zone);
  }
  return [...zones].sort();
}
