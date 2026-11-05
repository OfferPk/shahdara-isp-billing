// Plan 327 (Plan 203-350) — Customer data completeness score per record.
//
// Some customer records are missing phone numbers,
// addresses, or package details, but nobody knows
// which records are incomplete or how bad the gap is
// shop-wide. This module adds only the missing piece:
// a completeness score for each customer record —
// fields present versus fields expected, with the
// missing fields listed per record — plus a shop-wide
// summary, so the shop can work through incomplete
// records a few at a time.
//
// What this module is NOT, stated plainly:
//   - It is not the profile-only field counter from
//     the profile polishes. That counter counts the
//     fields filled on one open profile; this score
//     is a record-only view across all customers,
//     computed from the record's own fields.
//   - It is not a record duplication check. That
//     check looks for the same record twice under
//     slightly different spellings; this score looks
//     at one record at a time and never compares
//     two records.
//   - It is not a monthly report pack assembly
//     checklist. That checklist tracks which reports
//     are in a month's pack; this score tracks which
//     fields are in a customer record.
//   - It is not a customer change. Scoring never
//     changes any customer record by itself: the
//     score is recomputed exactly from the record's
//     fields on the same fixture, and the record
//     itself is never written back.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every record, and the module never reads
//     storage, the clock, or the network, and never
//     mutates an input.
//   - The expected fields are fixed: name, phone,
//     mohalla, address, package. A field counts as
//     present only when it holds a real value, never
//     when it is blank, missing, or only spaces.
//   - The score is whole-number arithmetic: present
//     fields times one hundred over expected fields.
//     With five expected fields every score is an
//     exact whole percent, so no rounding is ever
//     invented.
//   - A record with no id cannot be scored, so it
//     returns null instead of a guessed score.

const EXPECTED_FIELDS = ['name', 'phone', 'mohalla', 'address', 'package'];

const FIELD_LABELS = {
  name: 'Name',
  phone: 'Phone',
  mohalla: 'Mohalla',
  address: 'Address',
  package: 'Package',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** The fixed list of fields every customer record is expected to carry. */
export function customerCompletenessFields() {
  return [...EXPECTED_FIELDS];
}

/** Plain-words label for one expected field. */
export function customerCompletenessFieldLabel(field) {
  return FIELD_LABELS[field] ?? text(field);
}

/** A field counts as present only when it holds a real value, never blank. */
export function customerCompletenessFieldPresent(value) {
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  return value === true;
}

/**
 * One customer record scored, or null when the record
 * is not an object or has no id. The score is the
 * present fields times one hundred over the expected
 * fields, an exact whole percent. Missing fields are
 * listed in expected-field order. The input is never
 * mutated.
 */
export function scoreCustomerCompleteness(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const id = text(record.id);
  if (!id) return null;
  const missingFields = EXPECTED_FIELDS.filter(
    (field) => !customerCompletenessFieldPresent(record[field]),
  );
  const present = EXPECTED_FIELDS.length - missingFields.length;
  return {
    id,
    name: text(record.name),
    present,
    expected: EXPECTED_FIELDS.length,
    missingFields,
    score: (present * 100) / EXPECTED_FIELDS.length,
    complete: missingFields.length === 0,
  };
}

/**
 * Every scorable record in a list, most incomplete
 * first, then name A-Z, then id. Records with no id
 * are skipped, never scored with a guessed id.
 */
export function scoreCustomerCompletenessList(records) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => scoreCustomerCompleteness(record))
    .filter((scored) => scored !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (nameA !== nameB) return nameA < nameB ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/** Only the incomplete records in a scored list. */
export function customerCompletenessIncomplete(scores) {
  if (!Array.isArray(scores)) return [];
  return scores.filter((scored) => scored && !scored.complete);
}

/**
 * The shop-wide summary for a scored list: how many
 * records, how many complete, how many incomplete,
 * fields present out of fields expected, the average
 * score as a whole percent rounded down, and for each
 * expected field how many records are missing it.
 * An empty list reads zero everywhere, never a
 * guessed average.
 */
export function customerCompletenessSummary(scores) {
  const clean = Array.isArray(scores) ? scores.filter((scored) => scored) : [];
  const totalPresent = clean.reduce((sum, scored) => sum + scored.present, 0);
  const totalExpected = clean.reduce((sum, scored) => sum + scored.expected, 0);
  const missingFieldCounts = {};
  for (const field of EXPECTED_FIELDS) {
    missingFieldCounts[field] = clean.filter((scored) =>
      scored.missingFields.includes(field),
    ).length;
  }
  return {
    totalRecords: clean.length,
    completeRecords: clean.filter((scored) => scored.complete).length,
    incompleteRecords: clean.filter((scored) => !scored.complete).length,
    totalPresent,
    totalExpected,
    averageScore: totalExpected === 0 ? 0 : Math.floor((totalPresent * 100) / totalExpected),
    missingFieldCounts,
  };
}

/** One scored record as plain words. */
export function customerCompletenessScoreText(scored) {
  if (!scored) return 'No completeness score.';
  const name = scored.name ? ` (${scored.name})` : '';
  if (scored.complete) {
    return `${scored.id}${name}: ${scored.score}% complete — ${scored.present} of ${scored.expected} fields present.`;
  }
  const missing = scored.missingFields
    .map((field) => customerCompletenessFieldLabel(field))
    .join(', ');
  return `${scored.id}${name}: ${scored.score}% complete — ${scored.present} of ${scored.expected} fields present; missing ${missing}.`;
}

/** The shop-wide summary as plain words. */
export function customerCompletenessSummaryText(scores) {
  const summary = customerCompletenessSummary(scores);
  if (summary.totalRecords === 0) return 'No customer records scored.';
  const missingBits = EXPECTED_FIELDS.filter(
    (field) => summary.missingFieldCounts[field] > 0,
  )
    .map(
      (field) =>
        `${summary.missingFieldCounts[field]} missing ${customerCompletenessFieldLabel(field)}`,
    )
    .join(', ');
  const missingText = missingBits ? ` Most missing: ${missingBits}.` : '';
  return (
    `${summary.totalRecords} customer records scored, ` +
    `${summary.completeRecords} complete, ${summary.incompleteRecords} incomplete, ` +
    `${summary.totalPresent} of ${summary.totalExpected} fields present, ` +
    `average ${summary.averageScore}%.${missingText}`
  );
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** One scored record as one HTML list item, with user text escaped. */
export function customerCompletenessScoreHtml(scored) {
  if (!scored) return '';
  return `<li>${escapeHtml(customerCompletenessScoreText(scored))}</li>`;
}

/** The scored list as HTML: summary plus each record, most incomplete first. */
export function customerCompletenessAllHtml(scores) {
  const clean = Array.isArray(scores) ? scores.filter((scored) => scored) : [];
  if (!clean.length) return '<p>No customer records scored.</p>';
  return (
    `<p>${escapeHtml(customerCompletenessSummaryText(clean))}</p>` +
    `<ul>${clean.map((scored) => customerCompletenessScoreHtml(scored)).join('')}</ul>`
  );
}

function csvCell(value) {
  const clean = String(value ?? '');
  return /[",\n]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}

/** The scored list as CSV text, one row per customer record. */
export function customerCompletenessCsv(scores) {
  const clean = Array.isArray(scores) ? scores.filter((scored) => scored) : [];
  const header = 'customer id,customer name,fields present,fields expected,score percent,complete,missing fields';
  const rows = clean.map((scored) =>
    [
      scored.id,
      scored.name,
      scored.present,
      scored.expected,
      scored.score,
      scored.complete ? 'yes' : 'no',
      scored.missingFields.map((field) => customerCompletenessFieldLabel(field)).join('; '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

/** CSV filename for the scored list. */
export function customerCompletenessFilename() {
  return 'customer-completeness.csv';
}
