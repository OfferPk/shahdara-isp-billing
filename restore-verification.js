// Restore verification note (Plan 332): one verification note per
// restore, so a restore is proved complete before it is trusted.
// A note carries the restore date, the source it was restored from,
// the record counts before and after the restore, and the verifier.
// The counts are shown side by side and must match, or the mismatch
// is named in plain words. A restore whose check is still pending
// stays flagged as unverified. A note never changes any restored
// record, bill, or payment by itself.

const RESTORE_VERIFICATION_COUNT_FIELDS = ['customers', 'bills', 'payments'];

const RESTORE_VERIFICATION_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isRestoreVerificationLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validRestoreVerificationDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = RESTORE_VERIFICATION_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isRestoreVerificationLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function restoreVerificationText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function restoreVerificationWholeCount(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function foldRestoreVerificationCounts(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const counts = {};
  for (const field of RESTORE_VERIFICATION_COUNT_FIELDS) {
    const count = restoreVerificationWholeCount(raw[field]);
    if (count === null) return null;
    counts[field] = count;
  }
  return counts;
}

export function normalizeRestoreVerification(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = restoreVerificationText(raw.id);
  const restoreDate = restoreVerificationText(raw.restoreDate);
  const source = restoreVerificationText(raw.source);
  const verifier = restoreVerificationText(raw.verifier);
  const countsBefore = foldRestoreVerificationCounts(raw.countsBefore);
  const countsAfter = foldRestoreVerificationCounts(raw.countsAfter);
  if (!id || !validRestoreVerificationDay(restoreDate) || !source || !verifier) return null;
  if (countsBefore === null || countsAfter === null) return null;
  return {
    id,
    restoreDate,
    source,
    countsBefore,
    countsAfter,
    verifier,
    verified: raw.verified === true,
  };
}

export function normalizeRestoreVerificationList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeRestoreVerification(raw);
    if (note && !seen.has(note.id)) {
      seen.add(note.id);
      out.push(note);
    }
  }
  return out;
}

export function findRestoreVerification(list, id) {
  const clean = normalizeRestoreVerificationList(list);
  return clean.find((note) => note.id === id) || null;
}

export function recordRestoreVerification(list, note) {
  const clean = normalizeRestoreVerificationList(list);
  const next = normalizeRestoreVerification(note);
  if (!next) return clean;
  if (clean.some((entry) => entry.id === next.id)) return clean;
  return [...clean, next];
}

export function removeRestoreVerification(list, id) {
  const clean = normalizeRestoreVerificationList(list);
  return clean.filter((note) => note.id !== id);
}

export function verifyRestoreVerification(list, id) {
  const clean = normalizeRestoreVerificationList(list);
  return clean.map((note) => (note.id === id ? { ...note, verified: true } : note));
}

export function restoreVerificationVerdict(note) {
  const clean = normalizeRestoreVerification(note);
  if (!clean) return null;
  const mismatches = [];
  for (const field of RESTORE_VERIFICATION_COUNT_FIELDS) {
    const before = clean.countsBefore[field];
    const after = clean.countsAfter[field];
    if (before !== after) mismatches.push({ record: field, before, after });
  }
  return {
    verified: clean.verified,
    matched: mismatches.length === 0,
    mismatches,
  };
}

export function restoreVerificationCountsMatch(note) {
  const verdict = restoreVerificationVerdict(note);
  return verdict !== null && verdict.matched;
}

export function unverifiedRestoreVerifications(list) {
  const clean = normalizeRestoreVerificationList(list);
  return clean
    .filter((note) => !note.verified)
    .sort((a, b) => (a.restoreDate < b.restoreDate ? 1 : a.restoreDate > b.restoreDate ? -1 : a.id < b.id ? -1 : 1));
}

export function restoreVerificationNoteSummaryText(note) {
  const clean = normalizeRestoreVerification(note);
  if (!clean) return '';
  const verdict = restoreVerificationVerdict(clean);
  const status = clean.verified ? 'verified' : 'unverified';
  if (verdict.matched) {
    return `${clean.restoreDate} from ${clean.source}: counts match (${clean.countsBefore.customers} customers, ${clean.countsBefore.bills} bills, ${clean.countsBefore.payments} payments) — ${status}`;
  }
  const named = verdict.mismatches
    .map((mismatch) => `${mismatch.record}: ${mismatch.before} before, ${mismatch.after} after`)
    .join('; ');
  return `${clean.restoreDate} from ${clean.source}: mismatch — ${named} — ${status}`;
}

export function restoreVerificationSummaryText(list) {
  const clean = normalizeRestoreVerificationList(list);
  const verified = clean.filter((note) => note.verified).length;
  const matched = clean.filter((note) => restoreVerificationCountsMatch(note)).length;
  const unverified = clean.length - verified;
  return `${clean.length} restore verification note${clean.length === 1 ? '' : 's'}: ${matched} match, ${clean.length - matched} mismatch, ${unverified} unverified.`;
}

function escapeRestoreVerificationHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function restoreVerificationNoteHtml(note) {
  const clean = normalizeRestoreVerification(note);
  if (!clean) return '';
  const verdict = restoreVerificationVerdict(clean);
  const rows = RESTORE_VERIFICATION_COUNT_FIELDS.map((field) => {
    const before = clean.countsBefore[field];
    const after = clean.countsAfter[field];
    const mark = before === after ? '' : ' — mismatch';
    return `<tr><td>${field}</td><td>${before}</td><td>${after}</td><td>${mark}</td></tr>`;
  }).join('');
  const status = clean.verified ? 'Verified' : 'Unverified';
  return `<div><strong>${escapeRestoreVerificationHtml(clean.restoreDate)}</strong> — restored from ${escapeRestoreVerificationHtml(clean.source)}, checked by ${escapeRestoreVerificationHtml(clean.verifier)} (${status})<table><thead><tr><th>Record</th><th>Before</th><th>After</th><th></th></tr></thead><tbody>${rows}</tbody></table><p>${escapeRestoreVerificationHtml(restoreVerificationNoteSummaryText(clean))}</p></div>`;
}

export function restoreVerificationHtml(list) {
  const clean = normalizeRestoreVerificationList(list);
  if (!clean.length) return '<p>No restore verifications recorded.</p>';
  return clean.map((note) => restoreVerificationNoteHtml(note)).join('');
}

function restoreVerificationCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function restoreVerificationCsv(list) {
  const clean = normalizeRestoreVerificationList(list);
  const header = ['id', 'restore date', 'source', 'customers before', 'bills before', 'payments before', 'customers after', 'bills after', 'payments after', 'matched', 'verifier', 'verified'];
  const lines = [header.map(restoreVerificationCsvCell).join(',')];
  for (const note of clean) {
    const verdict = restoreVerificationVerdict(note);
    lines.push([
      note.id,
      note.restoreDate,
      note.source,
      note.countsBefore.customers,
      note.countsBefore.bills,
      note.countsBefore.payments,
      note.countsAfter.customers,
      note.countsAfter.bills,
      note.countsAfter.payments,
      verdict.matched ? 'match' : 'mismatch',
      note.verifier,
      note.verified ? 'verified' : 'unverified',
    ].map(restoreVerificationCsvCell).join(','));
  }
  return lines.join('\n');
}

export function restoreVerificationFilename() {
  return 'restore-verification-notes.csv';
}
