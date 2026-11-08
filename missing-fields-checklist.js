// missing-fields-checklist.js — which profile fields are still empty,
// listed by name with a jump to each field.
//
// The profile already shows a fields-filled counter (filled/total over
// the per-field-save controls), but the operator still has to hunt for
// WHICH fields are missing, so incomplete profiles stay incomplete.
// This module is the missing piece: given a customer record and the
// field list the counter itself counts, it returns exactly the fields
// that are empty, in the same order the form shows them, plus the
// section HTML that lists them by name. The list renders collapsed
// behind a <details> whose summary carries the heading and the count
// (Plan 512), so a sparse profile shows one line instead of dozens of
// rows. Tapping one jumps to that field for editing (the jump itself
// lives in app.js and reuses the existing error-jump scroll-and-focus
// behaviour).
//
// This module lists only. It fills nothing by itself, it scores
// nothing, and it holds no percentage or count of filled fields —
// the completeness score lives in a separate module and is not
// recomputed here. It reads no store and writes no record; the
// checklist never changes any bill, payment, or customer record by
// itself. The caller supplies the field list and the display names,
// so this module never reads the form or the clock and never drifts
// from the counter: the same field list and the same filled rule.
//
// Filled rule (identical to the counter's rule, stated plainly so the
// two can never disagree): a string counts when it is non-blank and
// not literally "Not set" (case-insensitive); a finite number counts
// (0 is a recorded figure, not a blank); a boolean counts only when
// true; an array counts when any entry counts; null, undefined, NaN
// and anything else do not count.

// A value counts as filled under the counter's rule.
function isProfileFieldFilledValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && trimmed.toLowerCase() !== 'not set';
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value === true;
  if (Array.isArray(value)) return value.some((entry) => isProfileFieldFilledValue(entry));
  return false;
}

// True when the value counts as missing under the counter's rule.
export function isProfileFieldMissing(value) {
  return !isProfileFieldFilledValue(value);
}

// The missing fields of a record, in the order the caller lists them.
// `fields` is an array of { controlId, fieldKey } — the caller passes
// the per-field-save controls in form order. Returns a fresh array of
// { controlId, fieldKey } for the entries whose record value is
// missing; a null record counts as every field missing. Inputs are
// never mutated.
export function missingProfileFields(record, fields) {
  const list = Array.isArray(fields) ? fields : [];
  const missing = [];
  for (const field of list) {
    const controlId = field?.controlId;
    const fieldKey = field?.fieldKey;
    if (typeof controlId !== 'string' || controlId === '') continue;
    if (typeof fieldKey !== 'string' || fieldKey === '') continue;
    if (isProfileFieldMissing(record?.[fieldKey])) missing.push({ controlId, fieldKey });
  }
  return missing;
}

function escapeMissingFieldsHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// The checklist section HTML for the profile. `missing` is the array
// from missingProfileFields; `labels` maps each control id to the
// display name the form itself shows (a missing label falls back to
// the field key, never to a blank); `texts` carries the heading and
// the all-filled line in the app's current language. A complete
// profile shows the all-filled line and no jump buttons. Every label
// is escaped, so a field name can never break the markup.
export function missingFieldsChecklistHtml(missing, labels, texts) {
  const items = Array.isArray(missing) ? missing : [];
  const names = labels && typeof labels === 'object' ? labels : {};
  const heading = texts?.heading || 'Missing fields';
  const allFilled = texts?.allFilled || 'All fields filled';
  if (items.length === 0) {
    return `<section class="mfc-checklist" aria-label="${escapeMissingFieldsHtml(heading)}"><h4 class="mfc-heading">${escapeMissingFieldsHtml(heading)}</h4><p class="mfc-all-filled">${escapeMissingFieldsHtml(allFilled)}</p></section>`;
  }
  const rows = items.map((item) => {
    const name = names[item.controlId] || item.fieldKey;
    return `<li><button type="button" class="mfc-jump" data-missing-field="${escapeMissingFieldsHtml(item.controlId)}">${escapeMissingFieldsHtml(name)}</button></li>`;
  }).join('');
  // Plan 512 — the list sits collapsed behind a <details>: a sparse
  // profile no longer renders dozens of jump rows above the profile
  // itself. The summary carries the heading and the count, so the
  // operator sees how many fields are missing without opening it;
  // expanding still shows the same jump buttons in the same order.
  return `<section class="mfc-checklist" aria-label="${escapeMissingFieldsHtml(heading)}"><details class="mfc-details"><summary class="mfc-summary">${escapeMissingFieldsHtml(heading)} (${items.length})</summary><ul class="mfc-list">${rows}</ul></details></section>`;
}
