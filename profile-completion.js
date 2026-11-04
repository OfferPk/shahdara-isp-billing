// profile-completion.js — field-completion counter for the Customer Profile.
//
// The counter counts exactly the editable controls the PR #813 per-field
// Save work covers: the keys of PROFILE_FIELD_SAVE_MAP. Nothing here
// reads or writes any store, bill, payment, visit, or lifecycle record —
// it only counts values it is handed.
//
// Filled rule (stated plainly, so the counter is never ambiguous):
// - a string counts when it is non-blank and not literally "Not set"
//   (case-insensitive) — placeholders and unset selects are unfilled;
// - a finite number counts (0 is a recorded figure, not a blank);
// - a boolean counts only when true (an unchecked optional flag is the
//   "not chosen" state, not a completed field);
// - null, undefined, NaN and anything else do not count.
import { PROFILE_FIELD_SAVE_MAP } from './profile-field-save.js';

export function isProfileFieldFilled(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && trimmed.toLowerCase() !== 'not set';
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value === true;
  if (Array.isArray(value)) return value.some((entry) => isProfileFieldFilled(entry));
  return false;
}

// Count a customer record (field key -> value). Returns filled, total
// and the exact label text the profile shows: "11/20 fields filled"
// (filled first, then total, so the order is never ambiguous).
export function countProfileCompletion(record) {
  const keys = Object.values(PROFILE_FIELD_SAVE_MAP);
  let filled = 0;
  for (const key of keys) {
    if (isProfileFieldFilled(record?.[key])) filled++;
  }
  return { filled, total: keys.length, text: `${filled}/${keys.length} fields filled` };
}

// Count the live edit form from duck-typed controls ({ id, type, value,
// checked }) — the same map, so the form counter and the saved-record
// counter can never drift apart. Controls outside the map are ignored.
export function countProfileCompletionFromControls(controls) {
  const record = {};
  for (const control of controls ?? []) {
    const key = PROFILE_FIELD_SAVE_MAP[control?.id];
    if (!key) continue;
    record[key] = control.type === 'checkbox' ? control.checked === true : control.value;
  }
  return countProfileCompletion(record);
}
