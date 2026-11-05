// Plan 279 (Plan 203-350) — Referral reward eligibility note.
//
// Whether a referrer has earned a reward is decided informally, with
// no record of the eligibility check behind the decision. This module
// adds only the missing piece: one eligibility note per referrer per
// referral — the referral link, the eligibility rule applied in plain
// words, eligible yes or no, and the date checked.
//
// What this module is NOT, stated plainly:
//   - It is not the referral record itself. The Plan 28 referral
//     record stores who referred whom at onboarding; this module
//     only notes whether a recorded referral is eligible for a
//     reward, and the referral record is neither read nor rewritten
//     here. The caller supplies the referral links, and this module
//     never touches them.
//   - It is not the outcome log. The Plan 263 outcome log records
//     what happened to each referred customer afterwards; it is
//     neither read nor rewritten here. An eligibility note says
//     only whether the reward rule is met.
//   - It is not the hamsaya credit engine, and it neither reads
//     nor writes it. An eligibility note carries no credit,
//     discount, or offer field at all, and an eligible note never
//     creates a credit, a payment, or a bill change by itself. The
//     operator applies any reward separately through the existing
//     concession/discount path with its own audit note.
//   - It never changes any referral record, any customer record,
//     any bill, or any payment. Recording eligibility never changes
//     any of those, and this module holds no customer, bill, or
//     payment field beyond the names on the note itself, so there
//     is nothing here that could rewrite one.
//   - A second note for the same referral is allowed only as a
//     dated re-check, never an edit. There is no edit function:
//     only record, find, and remove. A re-check must carry a later
//     checked date than every note already recorded for that
//     referral; a note with the same or an earlier date is refused.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every note,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A note with no id, no referrer, no referral link, no rule,
//     no clear eligible answer, or no strict date is refused
//     outright. Unknown fields are dropped, so a note can never
//     grow a credit, bill, or payment field.
//   - A duplicate id is never rewritten.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validReferralEligibilityDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

export function foldEligible(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const folded = text(value).toLowerCase().replace(/[\s_]+/g, ' ');
  if (folded === 'yes' || folded === 'eligible' || folded === 'true' || folded === '1') return true;
  if (folded === 'no' || folded === 'not eligible' || folded === 'false' || folded === '0') return false;
  return null;
}

export function normalizeReferralEligibility(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const referrer = text(raw.referrer);
  const referralId = text(raw.referralId);
  const rule = text(raw.rule);
  const eligible = foldEligible(raw.eligible);
  const dateChecked = text(raw.dateChecked);
  if (!id || !referrer || !referralId || !rule || eligible === null) return null;
  if (!validReferralEligibilityDate(dateChecked)) return null;
  return {
    id,
    referrer,
    referralId,
    rule,
    eligible,
    dateChecked,
    note: text(raw.note),
  };
}

export function normalizeReferralEligibilityList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeReferralEligibility(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findReferralEligibility(list, id) {
  const clean = normalizeReferralEligibilityList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordReferralEligibility(list, raw) {
  const clean = normalizeReferralEligibilityList(list);
  const entry = normalizeReferralEligibility(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  const previous = clean.filter((item) => item.referralId === entry.referralId);
  if (previous.length) {
    const latest = previous.map((item) => item.dateChecked).sort().at(-1);
    if (entry.dateChecked <= latest) return clean;
  }
  return [...clean, entry];
}

export function removeReferralEligibility(list, id) {
  const clean = normalizeReferralEligibilityList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

export function referralEligibilitySorted(list) {
  return normalizeReferralEligibilityList(list).slice().sort((a, b) => {
    if (a.dateChecked !== b.dateChecked) return a.dateChecked < b.dateChecked ? -1 : 1;
    if (a.referrer !== b.referrer) return a.referrer < b.referrer ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function referralEligibilityForReferrer(list, referrer) {
  const wanted = text(referrer).toLowerCase();
  if (!wanted) return [];
  return referralEligibilitySorted(list).filter(
    (entry) => entry.referrer.toLowerCase() === wanted,
  );
}

export function latestReferralEligibility(list, referralId) {
  const wanted = text(referralId);
  if (!wanted) return null;
  const rows = referralEligibilitySorted(list).filter((entry) => entry.referralId === wanted);
  return rows.length ? rows.at(-1) : null;
}

export function referralEligibilityReferrers(list) {
  const seen = new Map();
  for (const entry of normalizeReferralEligibilityList(list)) {
    const key = entry.referrer.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.referrer);
  }
  return [...seen.values()];
}

export function referralEligibilityCounts(list) {
  const clean = normalizeReferralEligibilityList(list);
  const eligible = clean.filter((entry) => entry.eligible).length;
  return { total: clean.length, eligible, notEligible: clean.length - eligible };
}

export function referralEligibilitySummaryText(list) {
  const counts = referralEligibilityCounts(list);
  if (counts.total === 0) return 'No referral eligibility notes recorded.';
  const word = counts.total === 1 ? 'note' : 'notes';
  return `${counts.total} referral eligibility ${word} recorded, ${counts.eligible} eligible and ${counts.notEligible} not eligible.`;
}

export function referralEligibilityText(entry) {
  const clean = normalizeReferralEligibility(entry);
  if (!clean) return 'No referral eligibility note recorded.';
  const answer = clean.eligible ? 'Eligible for a reward' : 'Not eligible for a reward';
  const note = clean.note ? ` — ${clean.note}` : '';
  return `${clean.referrer} — referral ${clean.referralId} — ${answer} — rule: ${clean.rule} — checked ${clean.dateChecked}${note}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function referralEligibilityHtml(entry) {
  const clean = normalizeReferralEligibility(entry);
  if (!clean) return '<p>No referral eligibility note recorded.</p>';
  return `<p>${escapeHtml(referralEligibilityText(clean))}</p>`;
}

export function referralEligibilityAllHtml(list) {
  const rows = referralEligibilitySorted(list);
  if (!rows.length) return '<p>No referral eligibility notes recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(referralEligibilityText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function referralEligibilityCsv(list) {
  const rows = referralEligibilitySorted(list);
  const lines = ['"id","referrer","referral","rule","eligible","date checked","note"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.referrer),
      csvCell(entry.referralId),
      csvCell(entry.rule),
      csvCell(entry.eligible ? 'yes' : 'no'),
      csvCell(entry.dateChecked),
      csvCell(entry.note),
    ].join(','));
  }
  return lines.join('\n');
}

export function referralEligibilityFilename() {
  return 'referral-eligibility-notes.csv';
}
