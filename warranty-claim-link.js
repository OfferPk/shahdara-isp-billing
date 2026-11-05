// Plan 258 (Plan 203-350) — Spare part warranty claim link.
//
// A spare part fitted on a job later fails under warranty, but the
// link between the fitted part and its warranty claim is missing, so
// the claim cannot be evidenced. This module adds only the missing
// piece: one link per fitted spare part — the job reference, the part
// reference, the warranty claim reference, the claim date, and the
// claim status. It links records only.
//
// What this module is NOT, stated plainly:
//   - It is not the Plan 80 equipment warranty and supplier return
//     log, which is the claim log itself. That log is neither read
//     nor rewritten here, and this module imports nothing. A link
//     names a claim reference in plain text; it never creates,
//     updates, or closes a claim record.
//   - It is not the Plan 132 fault parts-used log, which records
//     which parts were used on a fault. That log is neither read
//     nor rewritten here. A link names a fitted part reference in
//     plain text; it never changes a parts-used record.
//   - A link is never edited, only superseded by a dated newer
//     link. There is no edit function: only record, supersede,
//     and remove. Superseding records the newer link for the same
//     fitted part and marks the old one with the newer link's id
//     and the superseded date, never rewriting the old link's job
//     reference, part reference, claim reference, claim date, or
//     claim status.
//   - One current link per fitted part: a second current link for
//     the same part reference is refused, so a part never shows
//     two different live claims at once.
//   - Claims without a linked fitted part are listed as
//     exceptions: a claim reference the caller supplies that no
//     link names appears in the exceptions list. The list is built
//     from the claim references the caller supplies, so it can
//     never disagree with the claims it was checked against.
//   - Creating a link never changes any bill, payment, customer,
//     job, stock, or return record by itself.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const WARRANTY_CLAIM_LINK_STORE = 'shahdara_warranty_claim_links_v1';
export const WARRANTY_CLAIM_LINK_FILENAME = 'warranty-claim-links.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validWarrantyClaimLinkDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const jobRef = text(raw.jobRef);
  const partRef = text(raw.partRef);
  const claimRef = text(raw.claimRef);
  const claimDate = text(raw.claimDate);
  const claimStatus = text(raw.claimStatus);
  if (!id || !jobRef || !partRef || !claimRef || !claimStatus) return null;
  if (!validWarrantyClaimLinkDate(claimDate)) return null;
  const supersededBy = text(raw.supersededBy);
  const supersededDate = text(raw.supersededDate);
  if (supersededBy && !validWarrantyClaimLinkDate(supersededDate)) return null;
  return {
    id,
    jobRef,
    partRef,
    claimRef,
    claimDate,
    claimStatus,
    supersededBy: supersededBy || null,
    supersededDate: supersededBy ? supersededDate : null,
  };
}

export function normalizeWarrantyClaimLinkList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCurrentParts = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    if (!entry.supersededBy) {
      const key = entry.partRef.toLowerCase();
      if (seenCurrentParts.has(key)) continue;
      seenCurrentParts.add(key);
    }
    seenIds.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordWarrantyClaimLink(list, raw) {
  const clean = normalizeWarrantyClaimLinkList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (!entry.supersededBy && clean.some((item) => !item.supersededBy && item.partRef.toLowerCase() === entry.partRef.toLowerCase())) return clean;
  return [...clean, entry];
}

export function removeWarrantyClaimLink(list, id) {
  const clean = normalizeWarrantyClaimLinkList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findWarrantyClaimLink(list, id) {
  const clean = normalizeWarrantyClaimLinkList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

// Supersede a link with a dated newer link for the same fitted
// part. The newer link must name the same part, carry a claim date
// on or after the old link's claim date, and use a fresh id. The
// old link is never rewritten: only its supersededBy id and the
// superseded date are marked. A link already superseded cannot be
// superseded again.
export function supersedeWarrantyClaimLink(list, oldId, raw) {
  const clean = normalizeWarrantyClaimLinkList(list);
  const wanted = text(oldId);
  if (!wanted) return clean;
  const old = clean.find((item) => item.id === wanted);
  if (!old || old.supersededBy) return clean;
  const next = normalizeEntry(raw);
  if (!next || next.supersededBy) return clean;
  if (next.partRef.toLowerCase() !== old.partRef.toLowerCase()) return clean;
  if (clean.some((item) => item.id === next.id)) return clean;
  if (next.claimDate < old.claimDate) return clean;
  return clean.map((item) => {
    if (item.id === old.id) {
      return { ...item, supersededBy: next.id, supersededDate: next.claimDate };
    }
    return item;
  }).concat([next]);
}

function compareEntries(a, b) {
  if (a.claimDate !== b.claimDate) return a.claimDate < b.claimDate ? -1 : 1;
  if (a.partRef !== b.partRef) return a.partRef < b.partRef ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function warrantyClaimLinkSorted(list) {
  return normalizeWarrantyClaimLinkList(list).sort(compareEntries);
}

export function warrantyClaimLinksForPart(list, partRef) {
  const wanted = text(partRef).toLowerCase();
  if (!wanted) return [];
  return warrantyClaimLinkSorted(list).filter((item) => item.partRef.toLowerCase() === wanted);
}

export function warrantyClaimLinkForPart(list, partRef) {
  const rows = warrantyClaimLinksForPart(list, partRef);
  return rows.find((item) => !item.supersededBy) || null;
}

export function warrantyClaimLinksForClaim(list, claimRef) {
  const wanted = text(claimRef).toLowerCase();
  if (!wanted) return [];
  return warrantyClaimLinkSorted(list).filter((item) => item.claimRef.toLowerCase() === wanted);
}

export function warrantyClaimLinkParts(list) {
  const seen = new Set();
  const out = [];
  for (const item of warrantyClaimLinkSorted(list)) {
    const key = item.partRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.partRef);
  }
  return out;
}

export function warrantyClaimLinkClaims(list) {
  const seen = new Set();
  const out = [];
  for (const item of warrantyClaimLinkSorted(list)) {
    const key = item.claimRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.claimRef);
  }
  return out;
}

// Claims without a linked fitted part, checked against the claim
// references the caller supplies as plain text. A claim appears
// here when no link at all names it. Blank references are
// dropped and duplicates are listed once, keeping the first
// spelling.
export function claimsWithoutLinkedPart(list, claimRefs) {
  if (!Array.isArray(claimRefs)) return [];
  const clean = normalizeWarrantyClaimLinkList(list);
  const seen = new Set();
  const out = [];
  for (const raw of claimRefs) {
    const claimRef = text(raw);
    if (!claimRef) continue;
    const key = claimRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const found = clean.find((item) => item.claimRef.toLowerCase() === key);
    if (!found) out.push({ claimRef, status: 'no linked fitted part' });
  }
  return out;
}

export function warrantyClaimLinkSummaryText(list) {
  const clean = normalizeWarrantyClaimLinkList(list);
  if (!clean.length) return 'No warranty claim links recorded.';
  const current = clean.filter((item) => !item.supersededBy).length;
  const superseded = clean.length - current;
  return `${clean.length} warranty claim link${clean.length === 1 ? '' : 's'}: ${current} current, ${superseded} superseded.`;
}

export function warrantyClaimLinkText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No warranty claim link recorded.';
  const superseded = clean.supersededBy
    ? ` Superseded by ${clean.supersededBy} on ${clean.supersededDate}.`
    : '';
  return `Part ${clean.partRef} (job ${clean.jobRef}) linked to claim ${clean.claimRef} on ${clean.claimDate}: ${clean.claimStatus.replace(/\.+$/, '')}.${superseded}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function warrantyClaimLinkHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No warranty claim link recorded.</p>';
  return `<p>${escapeHtml(warrantyClaimLinkText(entry))}</p>`;
}

export function warrantyClaimLinkAllHtml(list) {
  const sorted = warrantyClaimLinkSorted(list);
  if (!sorted.length) return '<p>No warranty claim links recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(warrantyClaimLinkText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function warrantyClaimLinkCsv(list) {
  const sorted = warrantyClaimLinkSorted(list);
  const header = ['id', 'job reference', 'part reference', 'claim reference', 'claim date', 'claim status', 'superseded by', 'superseded date'];
  const rows = sorted.map((item) => [
    item.id,
    item.jobRef,
    item.partRef,
    item.claimRef,
    item.claimDate,
    item.claimStatus,
    item.supersededBy || '',
    item.supersededDate || '',
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function warrantyClaimLinkFilename() {
  return 'warranty-claim-links.csv';
}
