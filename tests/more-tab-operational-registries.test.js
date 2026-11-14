/**
 * more-tab-operational-registries.test.js — More Tab Operational
 * Registries polish: materials (job cost), RMA warranty,
 * equipment recovery, customer holds & suspensions.
 * Pins:
 * - no stale SISP-8 / Plan 85 sentence leaks into the UI
 *   (both Plan 85 sentences were factually stale — relocations
 *   are already wired into the resume queue);
 * - the four in-scope mohalla filters invite the word
 *   "Unassigned" instead of the "__unassigned__" sentinel
 *   (the resume filter never had a placeholder: its sentinel
 *   case bug is a flagged follow-up, out of scope);
 * - creation forms collapse behind <details> and close on a
 *   successful record (wired in app.js, pinned here by markup);
 * - holds and resume share one card with two segmented tabs;
 * - hide-at-0 wrapper rows exist for every registry section;
 * - conditional fields carry label ids for the visibility
 *   wiring in app.js;
 * - checkbox labels use the registry class (the global 44px
 *   input floor stacks bare labels on phones);
 * - empty bodies render nothing; the summary line stays the
 *   single empty state;
 * - holds and suspension money prints PKR 0, never Rs.
 * Synthetic data only; no bill, payment, or customer record
 * is ever changed by this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRmaSummary, rmaSummaryText, rmaHtml } from '../warranty-returns.js';
import { buildRecoverySummary, recoverySummaryText, recoveryHtml } from '../recovery-queue.js';
import { buildHoldSummary, holdSummaryText } from '../vacation-holds.js';
import { buildSuspensionSummary, suspensionSummaryText } from '../suspension-records.js';
import { buildResumeSummary, resumeSummaryText, resumeHtml } from '../resume-queue.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('no SISP-8 or stale Plan 85 sentence leaks into the More tab UI', () => {
  for (const leak of [
    'SISP-8 hold fields on the customer record are neither read nor written here',
    'Relocations join this queue with Plan 85',
    'Relocations from Plan 85 moves are included.',
  ]) {
    assert.ok(!html.includes(leak), `index.html still shows: ${leak}`);
    assert.ok(!appJs.includes(leak), `app.js still shows: ${leak}`);
  }
});

test('the four in-scope mohalla filters invite the word Unassigned', () => {
  for (const id of ['jobCostFilterMohalla', 'recoveryFilterMohalla', 'vacationFilterMohalla', 'suspensionFilterMohalla']) {
    const start = html.indexOf(`id="${id}"`);
    assert.ok(start >= 0, `missing input ${id}`);
    const tag = html.slice(start, html.indexOf('>', start));
    assert.ok(tag.includes('placeholder="Filter by mohalla (or Unassigned)"'), `${id} keeps the sentinel placeholder: ${tag}`);
  }
  // The resume filter never had a placeholder at all (it was not
  // one of the nine "__unassigned__" placeholders): its sentinel
  // case bug ('__UNASSIGNED__' never matches) is a flagged
  // follow-up, out of scope for this polish.
  const resumeStart = html.indexOf('id="resumeFilterMohalla"');
  const resumeTag = html.slice(resumeStart, html.indexOf('>', resumeStart));
  assert.ok(!resumeTag.includes('placeholder='), `resume filter gained a placeholder: ${resumeTag}`);
});

test('creation forms collapse behind details with one summary each', () => {
  for (const [id, summary] of [
    ['rmaCreateDetails', '+ Record Warranty Return'],
    ['vacationCreateDetails', '+ Add Customer Hold'],
    ['suspensionCreateDetails', '+ Record Suspension'],
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing details ${id}`);
    assert.ok(html.includes(`class="secondary-button registry-create-summary">${summary}</summary>`), `missing summary for ${id}`);
  }
});

test('holds and resume share one card with two segmented tabs', () => {
  assert.ok(html.includes('class="ds-segmented"'), 'segmented tab bar missing');
  assert.ok(html.includes('id="holdsTabBtn"'), 'holds tab button missing');
  assert.ok(html.includes('id="resumeTabBtn"'), 'resume tab button missing');
  assert.ok(html.includes('>Active Holds</button>'), 'Active Holds tab label missing');
  assert.ok(html.includes('>Resume Queue (7d)</button>'), 'Resume Queue (7d) tab label missing');
  assert.ok(html.includes('aria-selected="true"'), 'no tab carries aria-selected="true"');
  assert.ok(html.includes('id="holdsTabPanel"'), 'holds tab panel missing');
  assert.ok(html.includes('id="resumeTabPanel"'), 'resume tab panel missing');
  assert.ok(html.includes('id="resumeTabPanel" role="tabpanel" aria-labelledby="resumeTabBtn" hidden'), 'resume panel is not hidden by default');
  // One card, not two: the resume section no longer stands alone.
  assert.equal(html.split('id="resumeQueueHeading"').length - 1, 1, 'resume heading appears more than once');
});

test('hide-at-0 wrapper rows exist for every registry section', () => {
  for (const id of [
    'rmaFilterRow', 'rmaActionRow',
    'recoveryFilterRow', 'recoveryActionRow',
    'vacationFilterRow', 'vacationActionRow', 'vacationCheckRow',
    'suspensionFilterRow', 'suspensionChecklistRow', 'suspensionActionRow',
    'resumeWindowRow', 'resumeFilterRow', 'resumeActionRow',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing hide-at-0 wrapper ${id}`);
  }
  // The Window (days) row is a view control, not a filter: it is
  // the one row that stays visible at 0 resumes.
  const windowStart = html.indexOf('id="resumeWindowRow"');
  assert.ok(html.slice(windowStart, windowStart + 400).includes('id="resumeWindowDays"'), 'window row does not hold the Window (days) input');
});

test('conditional fields carry label ids for the visibility wiring', () => {
  for (const id of [
    'jobCostMaterialOtherLabel',
    'rmaReplacementSerialLabel', 'rmaReplacementConnectionIdLabel', 'rmaReasonLabel',
    'vacationRetentionLabel',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing conditional label ${id}`);
  }
});

test('checkbox labels use the registry class (one RMA + three suspension)', () => {
  assert.equal(html.split('class="registry-check-label"').length - 1, 4, 'expected 4 registry-check-label labels');
  assert.ok(html.includes('<label class="registry-check-label" style="font-size: 12px;"><input id="rmaShowAwaiting"'), 'RMA awaiting checkbox label missing the class');
});

test('registry CSS classes exist in styles.css', () => {
  for (const rule of ['.registry-check-label', '.registry-create-summary', '.job-cost-actions']) {
    assert.ok(css.includes(rule), `missing CSS rule ${rule}`);
  }
});

test('empty bodies render nothing; summaries stay the single empty state', () => {
  assert.equal(rmaHtml([]), '');
  assert.equal(recoveryHtml([]), '');
  assert.equal(resumeHtml([]), '');
  assert.equal(rmaSummaryText(buildRmaSummary([])), 'No warranty returns recorded yet.');
  assert.equal(recoverySummaryText(buildRecoverySummary([], [])), 'No equipment recovery records yet.');
  assert.equal(resumeSummaryText(buildResumeSummary([])), 'No resumes in the window and none overdue.');
});

test('holds and suspension money prints PKR 0, never Rs.', () => {
  const holdText = holdSummaryText(buildHoldSummary([]));
  assert.match(holdText, /PKR 0/);
  assert.ok(!holdText.includes('Rs.'), `holds summary still prints Rs.: ${holdText}`);
  const suspensionText = suspensionSummaryText(buildSuspensionSummary([]));
  assert.match(suspensionText, /PKR 0/);
  assert.ok(!suspensionText.includes('Rs.'), `suspension summary still prints Rs.: ${suspensionText}`);
});
