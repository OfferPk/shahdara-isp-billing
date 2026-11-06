// Data quality review round (Plan 347): one dated review round record per
// review, so data quality improves in visible rounds instead of scattered
// fixes. A round names its date and reviewer, the areas checked, the issues
// found with references, and the issues cleared. A round lists its issues
// found and cleared with counts that reconcile (found equals cleared plus
// still open), and issues never cleared in any round carry forward to the
// next round visibly. A round is a review event only: it never fixes data
// itself and never changes any customer, bill, or payment record. It is
// distinct from the warning shown while adding or editing a profile, which
// is untouched. Inputs are never mutated, and the module never reads
// storage, the clock, the network, or the page.

const DATA_QUALITY_REVIEW_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isDataQualityReviewLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDataQualityReviewDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = DATA_QUALITY_REVIEW_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isDataQualityReviewLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanDataQualityReviewText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDataQualityReviewAreaList(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const text = cleanDataQualityReviewText(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function normalizeDataQualityReviewIssue(raw) {
  if (typeof raw === 'string') {
    const text = cleanDataQualityReviewText(raw);
    if (!text) return null;
    const colon = text.indexOf(':');
    if (colon === -1) return { reference: text, description: '' };
    const reference = text.slice(0, colon).trim();
    if (!reference) return null;
    return { reference, description: text.slice(colon + 1).trim() };
  }
  if (!raw || typeof raw !== 'object') return null;
  const reference = cleanDataQualityReviewText(raw.reference);
  if (!reference) return null;
  return { reference, description: cleanDataQualityReviewText(raw.description) };
}

export function normalizeDataQualityReviewIssues(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const clean = normalizeDataQualityReviewIssue(item);
    if (!clean) continue;
    const key = clean.reference.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export function normalizeDataQualityReviewCleared(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]/) : [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const reference = typeof item === 'string'
      ? cleanDataQualityReviewText(item)
      : cleanDataQualityReviewText(item?.reference);
    if (!reference) continue;
    const key = reference.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(reference);
  }
  return out;
}

export function normalizeDataQualityReview(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanDataQualityReviewText(raw.id);
  const roundDate = cleanDataQualityReviewText(raw.roundDate);
  const reviewer = cleanDataQualityReviewText(raw.reviewer);
  const areasChecked = normalizeDataQualityReviewAreaList(raw.areasChecked);
  const issuesFound = normalizeDataQualityReviewIssues(raw.issuesFound);
  const issuesCleared = normalizeDataQualityReviewCleared(raw.issuesCleared);
  if (!id) return null;
  if (!validDataQualityReviewDay(roundDate)) return null;
  if (!reviewer) return null;
  if (areasChecked.length === 0) return null;
  return { id, roundDate, reviewer, areasChecked, issuesFound, issuesCleared };
}

export function normalizeDataQualityReviewList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeDataQualityReview(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordDataQualityReview(list, round) {
  const clean = normalizeDataQualityReview(round);
  if (!clean) return list;
  const known = normalizeDataQualityReviewList(list);
  if (known.some((item) => item.id === clean.id)) return list;
  return [...known, clean];
}

export function dataQualityReviewRoundFor(list, id) {
  const known = normalizeDataQualityReviewList(list);
  const wanted = cleanDataQualityReviewText(id);
  return known.find((item) => item.id === wanted) ?? null;
}

export function dataQualityReviewCounts(round) {
  const clean = normalizeDataQualityReview(round);
  if (!clean) return { found: 0, cleared: 0, uncleared: 0 };
  const foundRefs = new Set(clean.issuesFound.map((issue) => issue.reference.toLowerCase()));
  let cleared = 0;
  for (const reference of clean.issuesCleared) {
    if (foundRefs.has(reference.toLowerCase())) cleared += 1;
  }
  return { found: clean.issuesFound.length, cleared, uncleared: clean.issuesFound.length - cleared };
}

function dataQualityReviewAllIssues(list) {
  const known = normalizeDataQualityReviewList(list);
  const out = [];
  const seen = new Set();
  for (const round of [...known].sort((a, b) => (a.roundDate < b.roundDate ? -1 : a.roundDate > b.roundDate ? 1 : a.id < b.id ? -1 : 1))) {
    for (const issue of round.issuesFound) {
      const key = issue.reference.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ reference: issue.reference, description: issue.description, roundDate: round.roundDate, roundId: round.id });
    }
  }
  return out;
}

function dataQualityReviewClearedRefs(list) {
  const known = normalizeDataQualityReviewList(list);
  const cleared = new Set();
  for (const round of known) {
    for (const reference of round.issuesCleared) {
      cleared.add(reference.toLowerCase());
    }
  }
  return cleared;
}

export function dataQualityReviewCarriedForward(list) {
  const cleared = dataQualityReviewClearedRefs(list);
  return dataQualityReviewAllIssues(list).filter((issue) => !cleared.has(issue.reference.toLowerCase()));
}

export function dataQualityReviewCountsAll(list) {
  const found = dataQualityReviewAllIssues(list);
  const clearedRefs = dataQualityReviewClearedRefs(list);
  let cleared = 0;
  for (const issue of found) {
    if (clearedRefs.has(issue.reference.toLowerCase())) cleared += 1;
  }
  return { rounds: normalizeDataQualityReviewList(list).length, found: found.length, cleared, uncleared: found.length - cleared };
}

export function dataQualityReviewSummaryText(list) {
  const counts = dataQualityReviewCountsAll(list);
  if (counts.rounds === 0) return 'No data quality review rounds recorded.';
  return `${counts.rounds} review round${counts.rounds === 1 ? '' : 's'} recorded, ${counts.found} issue${counts.found === 1 ? '' : 's'} found, ${counts.cleared} cleared, ${counts.uncleared} still open.`;
}

export function dataQualityReviewText(round) {
  const counts = dataQualityReviewCounts(round);
  return `${round.roundDate} — reviewed by ${round.reviewer}: ${round.areasChecked.join(', ')} checked, ${counts.found} found, ${counts.cleared} cleared, ${counts.uncleared} still open.`;
}

function escapeDataQualityReviewHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function dataQualityReviewRoundHtml(round) {
  const counts = dataQualityReviewCounts(round);
  const issues = round.issuesFound.map((issue) => {
    const detail = issue.description ? `: ${escapeDataQualityReviewHtml(issue.description)}` : '';
    return `<li>${escapeDataQualityReviewHtml(issue.reference)}${detail}</li>`;
  }).join('');
  const issuesPart = issues ? `<ul>${issues}</ul>` : '<p>No issues found in this round.</p>';
  return `<li>${escapeDataQualityReviewHtml(dataQualityReviewText(round))}${issuesPart}</li>`;
}

function dataQualityReviewRoundCompare(a, b) {
  if (a.roundDate !== b.roundDate) return a.roundDate < b.roundDate ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

export function dataQualityReviewRoundsHtml(list) {
  const known = normalizeDataQualityReviewList(list);
  const items = [...known].sort(dataQualityReviewRoundCompare).map(dataQualityReviewRoundHtml).join('');
  return `<ul>${items}</ul>`;
}

export function dataQualityReviewCarriedForwardHtml(list) {
  const items = dataQualityReviewCarriedForward(list).map((issue) => {
    const detail = issue.description ? `: ${escapeDataQualityReviewHtml(issue.description)}` : '';
    return `<li>${escapeDataQualityReviewHtml(issue.reference)}${detail} (found ${escapeDataQualityReviewHtml(issue.roundDate)})</li>`;
  }).join('');
  return `<ul>${items}</ul>`;
}

function dataQualityReviewCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function dataQualityReviewCsv(list) {
  const known = normalizeDataQualityReviewList(list);
  const header = ['id', 'roundDate', 'reviewer', 'areasChecked', 'issuesFound', 'issuesCleared', 'found', 'cleared', 'uncleared'];
  const lines = [header.map(dataQualityReviewCsvCell).join(',')];
  for (const round of [...known].sort(dataQualityReviewRoundCompare)) {
    const counts = dataQualityReviewCounts(round);
    lines.push([
      round.id,
      round.roundDate,
      round.reviewer,
      round.areasChecked.join('; '),
      round.issuesFound.map((issue) => issue.reference).join('; '),
      round.issuesCleared.join('; '),
      counts.found,
      counts.cleared,
      counts.uncleared,
    ].map(dataQualityReviewCsvCell).join(','));
  }
  return lines.join('\n');
}

export function dataQualityReviewFilename() {
  return 'data-quality-review-rounds.csv';
}
