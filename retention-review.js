// Plan 330 (Plan 203-350) — Data retention review log.
//
// The retention and archive policy (Plan 187) is written
// once and never reviewed, so it quietly goes out of
// date as the shop grows. This module adds only the
// missing piece: one review record per retention review
// — the review date, the reviewer, the policy sections
// checked, the findings, and a follow-up note — so each
// review lists the sections checked and any finding with
// a dated follow-up, and a review whose next review date
// has passed appears on an open list.
//
// What this module is NOT, stated plainly:
//   - It is not the retention and archive policy itself
//     (Plan 187). That policy already exists and is
//     neither read nor rewritten here; this log only
//     records that a review happened, it never changes
//     the policy text.
//   - It is not the quarterly business snapshot
//     (Plan 329), which composes quarterly figures from
//     monthly figures. That view already exists and is
//     neither read nor rewritten here; a review record
//     is about the retention policy, never about
//     quarterly figures.
//   - It is not the backup media register (Plan 331),
//     which registers the drives and disks that hold
//     backups. That register is a different plan and is
//     not implemented here; this log registers reviews
//     only, never backup media.
//   - It is not a bill, payment, customer, or record
//     change. Logging a review never changes any record,
//     bill, or payment by itself, and it never archives
//     anything: the log only lists reviews and their
//     findings.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every record, and the module never reads storage,
//     the clock, or the network, and never mutates an
//     input.
//   - A review with no id, no strict review date, no
//     reviewer, or no policy section checked is refused
//     outright. Unknown fields are dropped, so a review
//     can never grow a bill, payment, or customer field.
//   - A duplicate id is never rewritten: the first
//     review stays.
//   - Every finding must carry a dated follow-up: a
//     finding with no section, no finding in plain
//     words, or no strict follow-up date is dropped,
//     never kept undated.
//   - A review is overdue when its next review date has
//     passed (its next review date is before the
//     caller-supplied as-of date). A review with no next
//     review date is never listed as overdue: the log
//     never guesses a due date.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validRetentionReviewDay(value) {
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

/**
 * Policy sections checked, from an array or a
 * comma-separated string. Sections are trimmed, empty
 * entries are dropped, and repeats collapse to the
 * first spelling (case-insensitive).
 */
export function normalizeRetentionReviewSections(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const clean = text(item);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

/**
 * One finding, or null when half-formed. A finding
 * needs the policy section it is about, the finding in
 * plain words, and a strict follow-up date. A finding
 * with no dated follow-up is never kept.
 */
export function normalizeRetentionReviewFinding(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const section = text(raw.section);
  const finding = text(raw.finding);
  const followUpDate = text(raw.followUpDate);
  if (!section) return null;
  if (!finding) return null;
  if (!validRetentionReviewDay(followUpDate)) return null;
  return { section, finding, followUpDate };
}

/** Findings only, in the order given, malformed ones dropped. */
export function normalizeRetentionReviewFindings(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const raw of value) {
    const clean = normalizeRetentionReviewFinding(raw);
    if (clean) out.push(clean);
  }
  return out;
}

/**
 * One retention review record, or null when
 * half-formed. A review needs an id, a strict review
 * date, a reviewer, and at least one policy section
 * checked. The next review date is kept only when it
 * is a strict calendar date, otherwise it reads empty.
 * Unknown fields are dropped; the input is never
 * mutated.
 */
export function normalizeRetentionReview(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const reviewDate = text(raw.reviewDate);
  const reviewer = text(raw.reviewer);
  const sectionsChecked = normalizeRetentionReviewSections(raw.sectionsChecked);
  if (!id) return null;
  if (!validRetentionReviewDay(reviewDate)) return null;
  if (!reviewer) return null;
  if (!sectionsChecked.length) return null;
  const nextReviewDate = text(raw.nextReviewDate);
  return {
    id,
    reviewDate,
    reviewer,
    sectionsChecked,
    findings: normalizeRetentionReviewFindings(raw.findings),
    followUpNote: text(raw.followUpNote),
    nextReviewDate: validRetentionReviewDay(nextReviewDate) ? nextReviewDate : '',
  };
}

/** Normalised retention review records only; a duplicate id is never rewritten, the first stays. */
export function normalizeRetentionReviewList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const clean = normalizeRetentionReview(raw);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

/** Find one review by id, or null. */
export function findRetentionReview(list, id) {
  const clean = normalizeRetentionReviewList(list);
  return clean.find((entry) => entry.id === text(id)) ?? null;
}

/** Record one review; a half-formed review or a duplicate id leaves the list unchanged. */
export function recordRetentionReview(list, raw) {
  const clean = normalizeRetentionReviewList(list);
  const entry = normalizeRetentionReview(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

/** Remove one review by id; removing a missing id leaves the list unchanged. */
export function removeRetentionReview(list, id) {
  const clean = normalizeRetentionReviewList(list);
  const wanted = text(id);
  if (!clean.some((entry) => entry.id === wanted)) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

/** Reviews that checked one policy section, case-insensitive, newest review date first, then id A-Z. */
export function retentionReviewsForSection(list, section) {
  const wanted = text(section).toLowerCase();
  if (!wanted) return [];
  return normalizeRetentionReviewList(list)
    .filter((entry) => entry.sectionsChecked.some((name) => name.toLowerCase() === wanted))
    .sort((a, b) => (a.reviewDate < b.reviewDate ? 1 : a.reviewDate > b.reviewDate ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Policy sections checked anywhere in the log, A-Z, first spelling kept. */
export function retentionReviewSections(list) {
  const out = [];
  const seen = new Set();
  for (const entry of normalizeRetentionReviewList(list)) {
    for (const name of entry.sectionsChecked) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
}

/**
 * Overdue reviews: reviews whose next review date is
 * before the caller-supplied as-of date, oldest next
 * review date first, then id A-Z. A bad as-of date
 * returns an empty list, never a guessed list, and a
 * review with no next review date is never overdue.
 */
export function overdueRetentionReviews(list, asOf) {
  if (!validRetentionReviewDay(asOf)) return [];
  return normalizeRetentionReviewList(list)
    .filter((entry) => entry.nextReviewDate && entry.nextReviewDate < asOf)
    .sort((a, b) => (a.nextReviewDate < b.nextReviewDate ? -1 : a.nextReviewDate > b.nextReviewDate ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Open follow-ups: findings whose dated follow-up is
 * before the caller-supplied as-of date, earliest
 * follow-up first, then review id A-Z. Each row names
 * the review it belongs to. A bad as-of date returns
 * an empty list, never a guessed list.
 */
export function retentionReviewOpenFollowUps(list, asOf) {
  if (!validRetentionReviewDay(asOf)) return [];
  const out = [];
  for (const entry of normalizeRetentionReviewList(list)) {
    for (const finding of entry.findings) {
      if (finding.followUpDate < asOf) {
        out.push({
          reviewId: entry.id,
          reviewDate: entry.reviewDate,
          section: finding.section,
          finding: finding.finding,
          followUpDate: finding.followUpDate,
        });
      }
    }
  }
  return out.sort((a, b) => (a.followUpDate < b.followUpDate ? -1 : a.followUpDate > b.followUpDate ? 1 : a.reviewId < b.reviewId ? -1 : a.reviewId > b.reviewId ? 1 : 0));
}

/** Plain-words summary of the whole log. */
export function retentionReviewSummaryText(list) {
  const clean = normalizeRetentionReviewList(list);
  if (!clean.length) return 'No retention reviews logged.';
  const findingCount = clean.reduce((total, entry) => total + entry.findings.length, 0);
  const noun = clean.length === 1 ? 'retention review' : 'retention reviews';
  const findingNoun = findingCount === 1 ? 'finding' : 'findings';
  return `${clean.length} ${noun} logged, ${findingCount} ${findingNoun} with dated follow-ups.`;
}

/** One finding as one plain-words line. */
export function retentionReviewFindingText(finding) {
  const clean = normalizeRetentionReviewFinding(finding);
  if (!clean) return '';
  return `${clean.section}: ${clean.finding} (follow up by ${clean.followUpDate})`;
}

/** One review as plain words: date, reviewer, sections checked, findings, follow-up note. */
export function retentionReviewEntryText(entry) {
  const clean = normalizeRetentionReview(entry);
  if (!clean) return '';
  const sections = clean.sectionsChecked.join(', ');
  const findings = clean.findings.length
    ? ` — findings: ${clean.findings.map((item) => retentionReviewFindingText(item)).join('; ')}`
    : ' — no findings';
  const note = clean.followUpNote ? ` — follow-up note: ${clean.followUpNote}` : '';
  const next = clean.nextReviewDate ? ` — next review due ${clean.nextReviewDate}` : '';
  return `${clean.reviewDate}: review by ${clean.reviewer}, sections checked: ${sections}${findings}${note}${next}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** One review as one HTML list item, with user text escaped. */
export function retentionReviewEntryHtml(entry) {
  const clean = normalizeRetentionReview(entry);
  if (!clean) return '';
  return `<li>${escapeHtml(retentionReviewEntryText(clean))}</li>`;
}

/** All reviews as HTML: summary plus reviews newest first. */
export function retentionReviewsHtml(list) {
  const clean = normalizeRetentionReviewList(list);
  if (!clean.length) return '<p>No retention reviews logged.</p>';
  const sorted = [...clean].sort((a, b) => (a.reviewDate < b.reviewDate ? 1 : a.reviewDate > b.reviewDate ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const items = sorted.map((entry) => retentionReviewEntryHtml(entry)).join('');
  return `<p>${escapeHtml(retentionReviewSummaryText(clean))}</p><ul>${items}</ul>`;
}

/** Overdue reviews as HTML for the open list, oldest next review date first. */
export function overdueRetentionReviewsHtml(list, asOf) {
  const overdue = overdueRetentionReviews(list, asOf);
  if (!overdue.length) return '<p>No overdue retention reviews.</p>';
  const items = overdue
    .map((entry) => `<li>${escapeHtml(entry.id)}: next review was due ${escapeHtml(entry.nextReviewDate)} (reviewed ${escapeHtml(entry.reviewDate)} by ${escapeHtml(entry.reviewer)})</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  const clean = String(value ?? '');
  return /[",\n]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}

/** The whole log as CSV text, one row per review. */
export function retentionReviewCsv(list) {
  const clean = normalizeRetentionReviewList(list);
  const header = 'id,review date,reviewer,sections checked,findings,next review date,follow-up note';
  const rows = clean.map((entry) =>
    [
      entry.id,
      entry.reviewDate,
      entry.reviewer,
      entry.sectionsChecked.join('; '),
      entry.findings.map((item) => retentionReviewFindingText(item)).join('; '),
      entry.nextReviewDate,
      entry.followUpNote,
    ]
      .map((cell) => csvCell(cell))
      .join(','),
  );
  return [header, ...rows].join('\n');
}

/** CSV file name for the log export. */
export function retentionReviewFilename() {
  return 'retention-reviews.csv';
}
