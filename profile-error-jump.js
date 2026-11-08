// profile-error-jump.js — where a profile error banner jumps to.
//
// Pure rule only: given the field an error belongs to, resolve the jump
// target. The DOM work (scroll + focus) lives in app.js; this module
// decides, so the rule is testable without a DOM and can never invent
// a field link:
// - a known editable profile control id jumps to that control;
// - 'contributors' jumps to the Shared Router contributor editor (its
//   share amount is the field that needs changing);
// - anything else (empty, unknown, or a genuinely form-level error)
//   jumps to the top of the profile form, and the banner says so
//   plainly instead of faking a field link.
import { PROFILE_FIELD_SAVE_MAP } from './profile-field-save.js';

export function resolveProfileErrorTarget(fieldId) {
  if (fieldId === 'contributors') return { kind: 'contributors' };
  if (typeof fieldId === 'string' && Object.prototype.hasOwnProperty.call(PROFILE_FIELD_SAVE_MAP, fieldId)) {
    return { kind: 'field', id: fieldId };
  }
  return { kind: 'form' };
}

// Plan 501 — when typing clears the error banner. Pure rule only: the
// banner survives typing in any other field; only an edit to the field
// the error belongs to clears it. A form-level error (empty or unknown
// field) never clears on typing — only a tap on the banner does that.
// `input` is a plain descriptor, never a DOM node: { id, inContributors }.
export function profileErrorBannerClearsOnInput(errorField, input) {
  const target = resolveProfileErrorTarget(errorField);
  if (target.kind === 'field') return input?.id === target.id;
  if (target.kind === 'contributors') return input?.inContributors === true;
  return false;
}
