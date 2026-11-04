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
