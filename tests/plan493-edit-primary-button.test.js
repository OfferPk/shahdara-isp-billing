import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 493: Edit is the primary button in the profile heading, and the
// heading help no longer sits inside the action row covering the buttons.
// Polish #24 (2026-11-10): Edit MOVED out of the heading into the static
// header action group (visible on every tab), keeping its primary token
// class and its Edit-specific treatment class. The heading tests below
// now read the heading line without Edit; the Edit assertions read the
// static header markup in index.html instead.

const headingLine = () => {
  const app = read('app.js');
  // The render line carries the heading markup and the QR button; the
  // other 'profile-view-heading' line is a querySelector that inserts
  // after the heading, not the render itself.
  const lines = app.split('\n').filter((l) => l.includes('profile-view-heading') && l.includes('profileQrCardButton'));
  assert.equal(lines.length, 1, 'exactly one profile heading render must exist');
  return lines[0];
};

const headerEditLine = () => {
  const html = read('index.html');
  const lines = html.split('\n').filter((l) => l.includes('id="editProfileButton"'));
  assert.equal(lines.length, 1, 'exactly one static header Edit button must exist');
  return lines[0];
};

test('Plan 493: Edit is a primary-button in the header action group (polish #24)', () => {
  const line = headerEditLine();
  assert.ok(line.includes('id="editProfileButton" class="primary-button profile-action-btn profile-edit-button"'), 'Edit must carry the primary-button token class and its Edit-specific treatment class');
  assert.ok(!line.includes('id="editProfileButton" class="text-button'), 'Edit must no longer be a text-button');
});

// Polish #24 — QR, Print and Speak Due stay secondary in the heading
// row; Edit is no longer beside them (it moved to the header action
// group), so the heading line must not carry an Edit button any more.
test('Plan 493: QR, Print and Speak Due stay secondary in the heading row (Edit moved to the header group)', () => {
  const line = headingLine();
  assert.ok(!line.includes('id="editProfileButton"'), 'Edit no longer renders in the heading — it lives in the static header group');
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
  // Polish #24 — the button is static markup now, so its listener
  // attaches once at startup to the id directly, not through a
  // re-rendered querySelector. Same id, same edit flow.
  assert.ok(app.includes("$('#editProfileButton').addEventListener('click'"), 'Edit click listener must exist');
  assert.ok(app.includes('profileEditMode = true'), 'Edit must still open the edit flow');
});
