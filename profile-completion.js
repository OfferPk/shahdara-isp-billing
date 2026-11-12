// profile-completion.js — field-completion counter for the Customer Profile.
//
// The counter counts exactly the editable controls the PR #813 per-field
// Save work covers: the keys of PROFILE_FIELD_SAVE_MAP — except the pure
// opt-in flags listed in PROFILE_COMPLETION_EXCLUDED_KEYS (Plan 513).
// Nothing here reads or writes any store, bill, payment, visit, or
// lifecycle record — it only counts values it is handed.
//
// Filled rule (stated plainly, so the counter is never ambiguous):
// - a string counts when it is non-blank and not literally "Not set"
//   (case-insensitive) — placeholders and unset selects are unfilled;
// - a finite number counts (0 is a recorded figure, not a blank);
// - a boolean counts only when true (an unchecked optional flag is the
//   "not chosen" state, not a completed field);
// - null, undefined, NaN and anything else do not count.
//
// Plan 513 — the counted total excludes the pure opt-in flags:
// `prefersSms` ("Prefers SMS") and `paused` ("Vacation hold — pause
// billing") are legitimately false for most customers, so counting them
// left a fully completed profile stuck at 68/68 forever — a counter
// that can never reach full marks teaches the operator to ignore it.
// The per-field-save map itself is unchanged (both flags still save
// per-field); they are simply not part of what "complete" means, so
// the total is 68 and a profile with every applicable field filled
// shows full marks. The missing-fields checklist is built from this
// same counted list (see app.js), so the two can never disagree.
import { PROFILE_FIELD_SAVE_MAP } from './profile-field-save.js';

export const PROFILE_COMPLETION_EXCLUDED_KEYS = Object.freeze(['prefersSms', 'paused']);

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
// (filled first, then total, so the order is never ambiguous). The
// total is the counted keys only — the pure opt-in flags in
// PROFILE_COMPLETION_EXCLUDED_KEYS are not part of it (Plan 513).
export function countProfileCompletion(record) {
  const keys = Object.values(PROFILE_FIELD_SAVE_MAP).filter((key) => !PROFILE_COMPLETION_EXCLUDED_KEYS.includes(key));
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

// Profile Polish B (12) — the completion bar for the counter pill:
// the filled share as a whole percent, with the tone following the
// same bands as the health colours (70%+ green, 40–69% yellow, below
// 40% red), so the operator reads it the same way everywhere. Bad
// inputs read as 0% red, never NaN.
export function profileCompletionBar(filled, total) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safeFilled = Number.isFinite(filled) && filled > 0 ? Math.min(filled, safeTotal) : 0;
  const percent = safeTotal === 0 ? 0 : Math.round((safeFilled / safeTotal) * 100);
  const tone = percent >= 70 ? 'green' : percent >= 40 ? 'yellow' : 'red';
  return { percent, tone };
}
