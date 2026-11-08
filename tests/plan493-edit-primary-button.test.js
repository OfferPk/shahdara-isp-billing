import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 493: Edit is the primary button in the profile heading, and the
// heading help no longer sits inside the action row covering the buttons.

const headingLine = () => {
  const app = read('app.js');
  const lines = app.split('\n').filter((l) => l.includes('profile-view-heading') && l.includes('editProfileButton'));
  assert.equal(lines.length, 1, 'exactly one profile heading render must exist');
  return lines[0];
};

test('Plan 493: Edit is a primary-button in the profile heading', () => {
  const line = headingLine();
  assert.ok(line.includes('id="editProfileButton" class="primary-button profile-edit-button"'), 'Edit must carry the primary-button token class');
  assert.ok(!line.includes('id="editProfileButton" class="text-button'), 'Edit must no longer be a text-button');
});

test('Plan 493: QR, Print and Speak Due stay secondary beside Edit', () => {
  const line = headingLine();
  assert.ok(line.includes('id="profileQrCardButton" class="secondary-button"'), 'QR Khata Card stays secondary');
  assert.ok(line.includes('id="profilePrintCardButton" class="secondary-button"'), 'Print card stays secondary');
  assert.ok(line.includes('speakDueButtonMarkup(customer.customerNumber)'), 'Speak Due is still rendered in the heading row');
  assert.ok(line.includes('welcomeSlipButtonMarkup()'), 'welcome slip button is still rendered in the heading row');
});

test('Plan 493: heading help sits outside the action row', () => {
  const line = headingLine();
  const detailsAt = line.indexOf('<details class="help-tip">');
  const actionsAt = line.indexOf('<div class="profile-view-actions">');
  assert.ok(detailsAt > -1, 'heading help details must still exist');
  assert.ok(actionsAt > -1, 'profile-view-actions row must still exist');
  assert.ok(detailsAt < actionsAt, 'help details must come before the actions row, not inside it');
  const actionsSegment = line.slice(actionsAt);
  assert.ok(!actionsSegment.includes('<details'), 'no help details may remain inside the actions row');
});

test('Plan 493: help guidance is unchanged, only relocated', () => {
  const line = headingLine();
  assert.ok(line.includes('aria-controls="customerInfoGuidance"'), 'help aria-controls id is unchanged');
  assert.ok(line.includes('id="customerInfoGuidance" class="help-tip-content" role="tooltip"'), 'help content id and role are unchanged');
  assert.ok(line.includes("t('prof_view_help')"), 'help text still renders via t()');
  assert.ok(line.includes("t('prof_view_help_aria')"), 'help aria label still renders via t()');
});

test('Plan 493: the stale small-button rule is gone from styles.css', () => {
  const css = read('styles.css');
  assert.ok(!css.includes('.profile-edit-button'), 'styles.css must not carry a .profile-edit-button rule any more — the button is a primary-button now, and ui-feedback.css carries the Edit-specific 48px treatment');
  assert.match(css, /\.primary-button\{border:1px solid var\(--green\);background:var\(--green\);color:white\}/, 'the primary-button token rule must still exist');
});

test('Plan 493: Edit behaviour is untouched', () => {
  const app = read('app.js');
  assert.ok(app.includes("querySelector('#editProfileButton').addEventListener('click'"), 'Edit click listener must exist');
  assert.ok(app.includes('profileEditMode = true'), 'Edit must still open the edit flow');
});
