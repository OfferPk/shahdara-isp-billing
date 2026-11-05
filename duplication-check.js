// Plan 326 (Plan 203-350) — Record duplication check.
//
// The same customer, bill, or payment can exist twice
// under slightly different spellings, and nobody checks
// for duplicates except by accident. This module adds
// only the missing piece: a periodic duplication check
// routine that lists suspected duplicate records — each
// suspected pair with its matching fields, the date
// checked, and the operator decision — for operator
// review.
//
// What this module is NOT, stated plainly:
//   - It is not a merge. Merging duplicate records is
//     a different plan (Plan 348) and is not
//     implemented here; this check only lists suspected
//     pairs and records decisions about them, it never
//     merges, deletes, or changes any customer, bill,
//     or payment record.
//   - It is not the near-duplicate warning at entry
//     (Plan 87), which warns while a payment is being
//     entered. That warning already exists and is
//     neither read nor rewritten here; this routine
//     runs over records already in the app, on a date
//     the operator chooses.
//   - It is not the receipt gap audit (Plan 91), which
//     looks for missing receipt numbers. That audit
//     already exists and is neither read nor rewritten
//     here; this check looks for records that may be
//     the same record twice, never for gaps.
//   - It is not the data entry error log (Plan 325),
//     which records wrong entries and their
//     corrections. That log already exists and is
//     neither read nor rewritten here; a suspected
//     duplicate is a pair to review, never an error
//     record.
//   - It is not a bill, payment, or customer change.
//     Checking never changes any bill, payment, or
//     customer record by itself: the check only lists
//     suspected pairs and the operator decision on
//     each one.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every record and every check, and the module
//     never reads storage, the clock, or the network,
//     and never mutates an input.
//   - A check with no id, no strict date checked, or
//     no checker is refused outright. A pair with no
//     id, no record on either side, the same record
//     on both sides, or no matching field is refused
//     outright. Unknown fields are dropped, so a check
//     can never grow a bill, payment, or customer
//     field.
//   - A duplicate check id, or a duplicate pair id
//     inside one check, is never rewritten: the first
//     stays.
//   - Dismissing a pair requires a recorded reason: a
//     dismissal with no reason leaves the pair
//     exactly as it was.
//   - A single name match alone never suspects a
//     pair: a pair is suspected when the phone matches
//     or when two or more checked fields match, so
//     two customers who merely share a first name are
//     not flagged.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const RECORD_TYPES = ['customer', 'bill', 'payment', 'other'];

const PAIR_DECISIONS = ['open', 'dismissed', 'confirmed'];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validDuplicationCheckDay(value) {
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

/** Fold a record type to the fixed plain-words list; anything unknown reads as other. */
export function foldDuplicationCheckRecordType(value) {
  const clean = text(value).toLowerCase();
  return RECORD_TYPES.includes(clean) ? clean : 'other';
}

/** Fold a pair decision to the fixed list; anything unknown reads as open. */
export function foldDuplicationPairDecision(value) {
  const clean = text(value).toLowerCase();
  return PAIR_DECISIONS.includes(clean) ? clean : 'open';
}

/**
 * One suspected pair, or null when half-formed. A pair
 * needs an id, a different record on each side, and at
 * least one matching field. The decision folds to
 * open/dismissed/confirmed (missing or unknown reads as
 * open); a dismissed pair needs a recorded reason, so a
 * dismissal with no reason is refused. Unknown fields
 * are dropped; the input is never mutated.
 */
export function normalizeDuplicationPair(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const recordA = text(raw.recordA);
  const recordB = text(raw.recordB);
  if (!id) return null;
  if (!recordA || !recordB) return null;
  if (recordA === recordB) return null;
  const matchingFields = Array.isArray(raw.matchingFields)
    ? [...new Set(raw.matchingFields.map((field) => text(field).toLowerCase()).filter(Boolean))].sort()
    : [];
  if (!matchingFields.length) return null;
  const decision = foldDuplicationPairDecision(raw.decision);
  const reason = text(raw.reason);
  if (decision === 'dismissed' && !reason) return null;
  return {
    id,
    recordA,
    recordB,
    matchingFields,
    decision,
    reason,
    decidedBy: text(raw.decidedBy),
  };
}

/** Normalised suspected pairs only; a duplicate pair id is never rewritten, the first stays. */
export function normalizeDuplicationPairList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const clean = normalizeDuplicationPair(raw);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

/**
 * One duplication check run, or null when
 * half-formed. A check needs an id, a strict date
 * checked, and the person who checked. The record
 * type folds to customer/bill/payment/other. Pairs
 * are normalised; a check with no suspected pairs is
 * a clean check and stays. Unknown fields are
 * dropped; the input is never mutated.
 */
export function normalizeDuplicationCheck(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const dateChecked = text(raw.dateChecked);
  const checkedBy = text(raw.checkedBy);
  if (!id) return null;
  if (!validDuplicationCheckDay(dateChecked)) return null;
  if (!checkedBy) return null;
  return {
    id,
    dateChecked,
    checkedBy,
    recordType: foldDuplicationCheckRecordType(raw.recordType),
    pairs: normalizeDuplicationPairList(raw.pairs),
  };
}

/** Normalised duplication checks only; a duplicate check id is never rewritten, the first stays. */
export function normalizeDuplicationCheckList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const clean = normalizeDuplicationCheck(raw);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

/** Find one check by id, or null. */
export function findDuplicationCheck(list, id) {
  const clean = normalizeDuplicationCheckList(list);
  return clean.find((check) => check.id === text(id)) ?? null;
}

/** Record one check; a half-formed check or a duplicate id leaves the list unchanged. */
export function recordDuplicationCheck(list, raw) {
  const clean = normalizeDuplicationCheckList(list);
  const check = normalizeDuplicationCheck(raw);
  if (!check) return clean;
  if (clean.some((item) => item.id === check.id)) return clean;
  return [...clean, check];
}

/** Remove one check by id; removing a missing id leaves the list unchanged. */
export function removeDuplicationCheck(list, id) {
  const clean = normalizeDuplicationCheckList(list);
  const wanted = text(id);
  if (!clean.some((check) => check.id === wanted)) return clean;
  return clean.filter((check) => check.id !== wanted);
}

/** Checks of one record type, folded first, newest date checked first, then id A-Z. */
export function duplicationChecksForType(list, type) {
  const wanted = foldDuplicationCheckRecordType(type);
  return normalizeDuplicationCheckList(list)
    .filter((check) => check.recordType === wanted)
    .sort((a, b) => (a.dateChecked < b.dateChecked ? 1 : a.dateChecked > b.dateChecked ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Record types present in the list, A-Z. */
export function duplicationCheckRecordTypes(list) {
  return [...new Set(normalizeDuplicationCheckList(list).map((check) => check.recordType))].sort();
}

/** Open (undecided) pairs of one check, in pair id order. */
export function duplicationCheckOpenPairs(check) {
  const clean = normalizeDuplicationCheck(check);
  if (!clean) return [];
  return clean.pairs
    .filter((pair) => pair.decision === 'open')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Set the operator decision on one pair only. A
 * dismissal needs a recorded reason: dismissing with
 * no reason, deciding a missing check or pair, or an
 * unknown decision leaves the list exactly as it was.
 * The decision never merges, deletes, or changes any
 * customer, bill, or payment record: it only records
 * what the operator decided about this pair.
 */
export function decideDuplicationPair(list, checkId, pairId, decision, reason, decidedBy) {
  const clean = normalizeDuplicationCheckList(list);
  const wanted = foldDuplicationPairDecision(decision);
  const cleanReason = text(reason);
  if (wanted === 'dismissed' && !cleanReason) return clean;
  return clean.map((check) => {
    if (check.id !== text(checkId)) return check;
    return {
      ...check,
      pairs: check.pairs.map((pair) => {
        if (pair.id !== text(pairId)) return pair;
        return { ...pair, decision: wanted, reason: cleanReason, decidedBy: text(decidedBy) };
      }),
    };
  });
}

function normalizeFieldValue(value, field) {
  const clean = text(value);
  if (!clean) return '';
  if (field === 'phone') return clean.replace(/\D/g, '');
  return clean.toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Suspected duplicate pairs among caller-supplied
 * records. Each record needs an id and the checked
 * fields (default name and phone). A pair is suspected
 * when the phone matches, or when two or more checked
 * fields match after normalisation; a single name
 * match alone never suspects a pair. Pairs are in
 * record order, first record first, with matching
 * fields named. This only lists suspects: it never
 * merges, deletes, or changes any record.
 */
export function findSuspectedDuplicatePairs(records, fields = ['name', 'phone']) {
  if (!Array.isArray(records)) return [];
  const wanted = [...new Set((Array.isArray(fields) ? fields : []).map((field) => text(field).toLowerCase()).filter(Boolean))];
  if (!wanted.length) return [];
  const clean = records.filter((record) => record && typeof record === 'object' && !Array.isArray(record) && text(record.id));
  const out = [];
  for (let i = 0; i < clean.length; i += 1) {
    for (let j = i + 1; j < clean.length; j += 1) {
      const left = clean[i];
      const right = clean[j];
      if (text(left.id) === text(right.id)) continue;
      const matchingFields = wanted.filter((field) => {
        const a = normalizeFieldValue(left[field], field);
        const b = normalizeFieldValue(right[field], field);
        return a !== '' && a === b;
      });
      if (!matchingFields.length) continue;
      const phoneMatches = matchingFields.includes('phone');
      if (!phoneMatches && matchingFields.length < 2) continue;
      out.push({
        id: `${text(left.id)}~${text(right.id)}`,
        recordA: text(left.id),
        recordB: text(right.id),
        matchingFields,
        decision: 'open',
        reason: '',
        decidedBy: '',
      });
    }
  }
  return out;
}

/** Plain-words summary of one check run. */
export function duplicationCheckSummaryText(check) {
  const clean = normalizeDuplicationCheck(check);
  if (!clean) return '';
  const total = clean.pairs.length;
  const open = clean.pairs.filter((pair) => pair.decision === 'open').length;
  const dismissed = clean.pairs.filter((pair) => pair.decision === 'dismissed').length;
  const confirmed = clean.pairs.filter((pair) => pair.decision === 'confirmed').length;
  const noun = total === 1 ? 'suspected pair' : 'suspected pairs';
  return `Check ${clean.id} on ${clean.dateChecked} by ${clean.checkedBy} (${clean.recordType}): ${total} ${noun}, ${open} open, ${dismissed} dismissed, ${confirmed} confirmed.`;
}

/** Plain-words summary of the whole check list. */
export function duplicationChecksSummaryText(list) {
  const clean = normalizeDuplicationCheckList(list);
  if (!clean.length) return 'No duplication checks recorded.';
  const pairs = clean.flatMap((check) => check.pairs);
  const open = pairs.filter((pair) => pair.decision === 'open').length;
  const noun = clean.length === 1 ? 'duplication check' : 'duplication checks';
  const pairNoun = pairs.length === 1 ? 'suspected pair' : 'suspected pairs';
  return `${clean.length} ${noun}, ${pairs.length} ${pairNoun}, ${open} still open.`;
}

/** One suspected pair as one plain-words line. */
export function duplicationCheckPairText(pair) {
  const clean = normalizeDuplicationPair(pair);
  if (!clean) return '';
  const fields = clean.matchingFields.join(', ');
  const decision = clean.decision === 'open'
    ? 'open'
    : `${clean.decision}${clean.reason ? ` — ${clean.reason}` : ''}${clean.decidedBy ? ` (${clean.decidedBy})` : ''}`;
  return `${clean.recordA} and ${clean.recordB} match on ${fields} — ${decision}.`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** One suspected pair as one HTML list item, with user text escaped. */
export function duplicationCheckPairHtml(pair) {
  const clean = normalizeDuplicationPair(pair);
  if (!clean) return '';
  return `<li>${escapeHtml(duplicationCheckPairText(clean))}</li>`;
}

/** Open pairs of one check as HTML, or a plain line when none are open. */
export function duplicationCheckOpenHtml(check) {
  const clean = normalizeDuplicationCheck(check);
  if (!clean) return '<p>No duplication check.</p>';
  const open = duplicationCheckOpenPairs(clean);
  if (!open.length) return '<p>No open suspected pairs.</p>';
  return `<ul>${open.map((pair) => duplicationCheckPairHtml(pair)).join('')}</ul>`;
}

/** The whole check list as HTML: summary plus each check with its open pairs. */
export function duplicationCheckAllHtml(list) {
  const clean = normalizeDuplicationCheckList(list);
  if (!clean.length) return '<p>No duplication checks recorded.</p>';
  return `<p>${escapeHtml(duplicationChecksSummaryText(clean))}</p>${clean
    .map((check) => `<h4>${escapeHtml(duplicationCheckSummaryText(check))}</h4>${duplicationCheckOpenHtml(check)}`)
    .join('')}`;
}

function csvCell(value) {
  const clean = String(value ?? '');
  return /[",\n]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}

/** The whole check list as CSV text, one row per suspected pair. */
export function duplicationCheckCsv(list) {
  const clean = normalizeDuplicationCheckList(list);
  const header = 'check id,date checked,checked by,record type,pair id,record a,record b,matching fields,decision,reason,decided by';
  const rows = clean.flatMap((check) =>
    check.pairs.map((pair) =>
      [
        check.id,
        check.dateChecked,
        check.checkedBy,
        check.recordType,
        pair.id,
        pair.recordA,
        pair.recordB,
        pair.matchingFields.join('; '),
        pair.decision,
        pair.reason,
        pair.decidedBy,
      ]
        .map(csvCell)
        .join(','),
    ),
  );
  return [header, ...rows].join('\n');
}

/** CSV filename for the check list. */
export function duplicationCheckFilename() {
  return 'duplication-checks.csv';
}
