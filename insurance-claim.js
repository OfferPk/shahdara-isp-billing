// Plan 303 (Plan 203-350) — Insurance claim note.
//
// When insured shop equipment is damaged or lost, the claim is
// chased by phone and memory, with no record of what was claimed
// and what was paid. This module adds only the missing piece: one
// insurance claim note per claim — the asset reference, the
// incident date, the claim date, the amount claimed in whole
// rupees, the status in plain words, and the amount settled in
// whole rupees — so claims are listed per asset with claimed and
// settled amounts visible.
//
// What this module is NOT, stated plainly:
//   - It is not the shop insurance and asset register (Plan
//     190). That register is the record of record for the
//     insured assets; it is neither read nor rewritten here.
//     A claim links to an asset by reference only, in plain
//     words, and never changes the register.
//   - It is not a bill, payment, asset, or register change.
//     Recording a claim never changes any bill, payment,
//     asset, or register record by itself, and the settlement
//     itself happens outside this record.
//   - It is not a live record. A claim note, once written, is
//     never silently edited: there is no edit function, only
//     record, find, and remove, so a wrong note is removed and
//     recorded again.
//   - It is not a claim filing or a settlement. A note records
//     what was claimed and what was settled; it never files a
//     claim, never pays anyone, and never sends anything.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     note, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A claim with no id, no asset reference, no strict
//     incident date, no strict claim date, or no whole-rupee
//     amount claimed of at least one rupee is refused
//     outright, as is a claim whose claim date falls before
//     its incident date. The amount settled is optional and,
//     when given, must be whole rupees of zero or more.
//     Unknown fields are dropped, so a claim can never grow
//     a bill, payment, asset, or register field.
//   - A duplicate id is never rewritten: the first claim stays.
//   - The status folds from plain spellings; a missing or
//     unclear status reads as filed, because a claim nobody
//     has updated yet is still only filed.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validInsuranceClaimDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > limit) return false;
  return true;
}

/** Whole rupees: an integer number, or a digit string, or null. */
function wholeRupees(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * Status folds from plain spellings. A missing or unclear
 * status reads as filed, because a claim nobody has updated
 * yet is still only filed.
 */
export function foldInsuranceClaimStatus(value) {
  const word = lower(value);
  if (['filed', 'submit', 'submitted', 'lodged', 'raised', '1'].includes(word)) return 'filed';
  if (['in review', 'under review', 'reviewing', 'processing', 'in progress', '2'].includes(word)) return 'in review';
  if (['approved', 'approve', 'accepted', 'sanctioned', '3'].includes(word)) return 'approved';
  if (['settled', 'settle', 'paid', 'closed', 'resolved', '4'].includes(word)) return 'settled';
  if (['rejected', 'reject', 'declined', 'refused', 'denied', '5'].includes(word)) return 'rejected';
  return 'filed';
}

/**
 * One insurance claim note, or null when half-formed. A claim
 * needs an id, an asset reference, a strict incident date, a
 * strict claim date, and a whole-rupee amount claimed of at
 * least one rupee. The claim date must not fall before the
 * incident date. The status folds from plain spellings and
 * reads as filed when missing or unclear. The amount settled
 * is optional and, when given, must be whole rupees of zero
 * or more. Unknown fields are dropped; the input is never
 * mutated.
 */
export function normalizeInsuranceClaim(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const assetRef = text(raw.assetRef);
  const incidentDate = text(raw.incidentDate);
  const claimDate = text(raw.claimDate);
  const amountClaimed = wholeRupees(raw.amountClaimed);
  const status = foldInsuranceClaimStatus(raw.status);
  const settledRaw = raw.amountSettled;
  const amountSettled =
    settledRaw === undefined || settledRaw === null || settledRaw === ''
      ? null
      : wholeRupees(settledRaw);
  if (!id) return null;
  if (!assetRef) return null;
  if (!validInsuranceClaimDay(incidentDate)) return null;
  if (!validInsuranceClaimDay(claimDate)) return null;
  if (claimDate < incidentDate) return null;
  if (amountClaimed === null || amountClaimed < 1) return null;
  if (settledRaw !== undefined && settledRaw !== null && settledRaw !== '' && amountSettled === null) return null;
  if (amountSettled !== null && amountSettled < 0) return null;
  return {
    id,
    assetRef,
    incidentDate,
    claimDate,
    amountClaimed,
    status,
    amountSettled,
  };
}

/** Normalised claims only. A duplicate id is never rewritten: the first claim stays. */
export function normalizeInsuranceClaimList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const claim = normalizeInsuranceClaim(raw);
    if (!claim) continue;
    if (seenIds.has(claim.id)) continue;
    seenIds.add(claim.id);
    out.push(claim);
  }
  return out;
}

export function findInsuranceClaim(list, id) {
  const clean = normalizeInsuranceClaimList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((claim) => claim.id === wanted) ?? null;
}

/**
 * Record an insurance claim. Refused when half-formed or when
 * its id is already recorded — the first claim for an id
 * always stays.
 */
export function recordInsuranceClaim(list, raw) {
  const clean = normalizeInsuranceClaimList(list);
  const claim = normalizeInsuranceClaim(raw);
  if (!claim) return clean;
  if (clean.some((item) => item.id === claim.id)) return clean;
  return [...clean, claim];
}

export function removeInsuranceClaim(list, id) {
  const clean = normalizeInsuranceClaimList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((claim) => claim.id !== wanted);
}

/** Claims by claim date, then asset reference A-Z, then id, so the same list always reads the same way. */
export function insuranceClaimsSorted(list) {
  const clean = normalizeInsuranceClaimList(list);
  return [...clean].sort((a, b) => {
    if (a.claimDate !== b.claimDate) return a.claimDate < b.claimDate ? -1 : 1;
    if (lower(a.assetRef) !== lower(b.assetRef)) return lower(a.assetRef) < lower(b.assetRef) ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Claims for one asset reference, in claim-date order; the match is case-insensitive. */
export function insuranceClaimsForAsset(list, assetRef) {
  const wanted = lower(assetRef);
  if (!wanted) return [];
  return insuranceClaimsSorted(list).filter((claim) => lower(claim.assetRef) === wanted);
}

/** Asset references with a claim, first spelling kept, A-Z. */
export function insuranceClaimAssets(list) {
  const clean = normalizeInsuranceClaimList(list);
  const seen = new Map();
  for (const claim of clean) {
    const key = lower(claim.assetRef);
    if (!seen.has(key)) seen.set(key, claim.assetRef);
  }
  return [...seen.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0));
}

/** Total rupees claimed across the list, by integer arithmetic only. */
export function insuranceClaimTotalClaimed(list) {
  return normalizeInsuranceClaimList(list).reduce((sum, claim) => sum + claim.amountClaimed, 0);
}

/** Total rupees settled across the list, by integer arithmetic only; unsettled claims add nothing. */
export function insuranceClaimTotalSettled(list) {
  return normalizeInsuranceClaimList(list).reduce(
    (sum, claim) => sum + (claim.amountSettled === null ? 0 : claim.amountSettled),
    0,
  );
}

export function insuranceClaimSummaryText(list) {
  const clean = normalizeInsuranceClaimList(list);
  if (clean.length === 0) return 'No insurance claims recorded.';
  const word = clean.length === 1 ? 'claim' : 'claims';
  const sorted = insuranceClaimsSorted(clean);
  const latest = sorted[sorted.length - 1];
  return `${clean.length} insurance ${word} recorded. Total claimed Rs ${insuranceClaimTotalClaimed(clean)}, total settled Rs ${insuranceClaimTotalSettled(clean)}. Latest: ${latest.assetRef}, ${latest.claimDate}, ${latest.status}.`;
}

/** Plain-words text for one claim: asset, dates, claimed and settled amounts, and status. */
export function insuranceClaimEntryText(claim) {
  const clean = normalizeInsuranceClaim(claim);
  if (!clean) return 'No insurance claim recorded.';
  const settledPart =
    clean.amountSettled === null ? 'Settled: not yet settled.' : `Settled: Rs ${clean.amountSettled}.`;
  return `${clean.claimDate} — ${clean.assetRef}: Incident ${clean.incidentDate}. Claimed: Rs ${clean.amountClaimed}. ${settledPart} Status: ${clean.status}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function insuranceClaimEntryHtml(claim) {
  const clean = normalizeInsuranceClaim(claim);
  if (!clean) return '<p>No insurance claim recorded.</p>';
  return `<p>${escapeHtml(insuranceClaimEntryText(clean))}</p>`;
}

export function insuranceClaimAllHtml(list) {
  const rows = insuranceClaimsSorted(list);
  if (!rows.length) return '<p>No insurance claims recorded.</p>';
  return `<ul>${rows.map((claim) => `<li>${escapeHtml(insuranceClaimEntryText(claim))}</li>`).join('')}</ul>`;
}

export function insuranceClaimsForAssetHtml(list, assetRef) {
  const rows = insuranceClaimsForAsset(list, assetRef);
  if (!rows.length) return '<p>No insurance claims recorded for this asset.</p>';
  return `<ul>${rows.map((claim) => `<li>${escapeHtml(insuranceClaimEntryText(claim))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function insuranceClaimCsv(list) {
  const rows = insuranceClaimsSorted(list);
  const lines = ['"id","asset","incident date","claim date","amount claimed (Rs)","status","amount settled (Rs)"'];
  for (const claim of rows) {
    lines.push([
      csvCell(claim.id),
      csvCell(claim.assetRef),
      csvCell(claim.incidentDate),
      csvCell(claim.claimDate),
      csvCell(claim.amountClaimed),
      csvCell(claim.status),
      csvCell(claim.amountSettled === null ? '' : claim.amountSettled),
    ].join(','));
  }
  return lines.join('\n');
}

export function insuranceClaimFilename() {
  return 'insurance-claim-notes.csv';
}
