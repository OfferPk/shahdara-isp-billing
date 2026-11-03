import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_IDS,
  normalizeOnboardingTick,
  normalizeOnboardingTicks,
  buildOnboardingChecklist,
  tickOnboardingStep,
  untickOnboardingStep,
  findOnboardingTicks,
  upsertOnboardingChecklist,
  removeOnboardingChecklist,
  buildOnboardingEntry,
  pendingOnboardingList,
  onboardingSummaryText,
  onboardingChecklistHtml,
  onboardingPendingHtml,
  onboardingChecklistCsv,
} from '../onboarding-checklist.js';

const fullTicks = ONBOARDING_STEP_IDS.map((stepId) => ({
  stepId, completed: true, date: '2026-11-01', by: 'Saad',
}));

test('steps: seven steps in the plan order, ids frozen in order', () => {
  assert.deepEqual(ONBOARDING_STEP_IDS, [
    'enquiry', 'survey', 'cable', 'device', 'credentials', 'activation', 'first_bill',
  ]);
  assert.equal(ONBOARDING_STEPS[0].label, 'Enquiry');
  assert.equal(ONBOARDING_STEPS[6].label, 'First bill raised');
});

test('build: ticks in any input order still render in canonical order', () => {
  const checklist = buildOnboardingChecklist('c1', [
    { stepId: 'activation', completed: true, date: '2026-11-03', by: 'Saad' },
    { stepId: 'enquiry', completed: true, date: '2026-11-01', by: 'Owner' },
  ]);
  assert.deepEqual(checklist.steps.map((s) => s.stepId), ONBOARDING_STEP_IDS);
  assert.equal(checklist.done, 2);
  assert.equal(checklist.total, 7);
  assert.equal(checklist.complete, false);
  assert.equal(checklist.progressPercent, 29);
  assert.equal(checklist.nextStepId, 'survey');
  assert.equal(checklist.nextStepLabel, 'Survey / feasibility');
});

test('build: every new customer shows the same ordered steps, empty when no ticks', () => {
  const checklist = buildOnboardingChecklist('c9', []);
  assert.equal(checklist.steps.length, 7);
  assert.ok(checklist.steps.every((s) => s.completed === false));
  assert.equal(checklist.nextStepId, 'enquiry');
  assert.equal(checklist.progressPercent, 0);
});

test('normalise: unknown step dropped, never relabelled', () => {
  assert.equal(normalizeOnboardingTick({ stepId: 'router', completed: true }), null);
  const ticks = normalizeOnboardingTicks([
    { stepId: 'cable', completed: true },
    { stepId: 'mystery', completed: true },
  ]);
  assert.equal(ticks.filter((t) => t.completed).length, 1);
});

test('normalise: invalid date becomes null, never a guessed date', () => {
  assert.equal(normalizeOnboardingTick({ stepId: 'cable', completed: true, date: '2026-02-30' }).date, null);
  assert.equal(normalizeOnboardingTick({ stepId: 'cable', completed: true, date: 'soon' }).date, null);
  assert.equal(normalizeOnboardingTick({ stepId: 'cable', completed: true, date: '2026-11-03' }).date, '2026-11-03');
});

test('normalise: by trimmed, blank by becomes null; completed accepts true/1', () => {
  const tick = normalizeOnboardingTick({ stepId: 'survey', completed: 1, by: '  Saad  ' });
  assert.equal(tick.completed, true);
  assert.equal(tick.by, 'Saad');
  assert.equal(normalizeOnboardingTick({ stepId: 'survey', completed: true, by: '   ' }).by, null);
  assert.equal(normalizeOnboardingTick({ stepId: 'survey', completed: 'yes' }).completed, false);
});

test('normalise: repeated step keeps its last tick', () => {
  const ticks = normalizeOnboardingTicks([
    { stepId: 'cable', completed: true, date: '2026-11-01', by: 'Saad' },
    { stepId: 'cable', completed: true, date: '2026-11-02', by: 'Owner' },
  ]);
  const cable = ticks.find((t) => t.stepId === 'cable');
  assert.equal(cable.date, '2026-11-02');
  assert.equal(cable.by, 'Owner');
});

test('tick: sets date/by, does not mutate the input checklist', () => {
  const before = buildOnboardingChecklist('c1', [{ stepId: 'enquiry', completed: true }]);
  const snapshot = JSON.stringify(before);
  const after = tickOnboardingStep(before, 'survey', { date: '2026-11-02', by: 'Saad' });
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(after.steps.find((s) => s.stepId === 'survey').completed, true);
  assert.equal(after.steps.find((s) => s.stepId === 'survey').date, '2026-11-02');
  assert.equal(after.steps.find((s) => s.stepId === 'survey').by, 'Saad');
  assert.equal(after.done, 2);
});

test('tick: without date/by still counts as ticked, fields stay null', () => {
  const after = tickOnboardingStep(buildOnboardingChecklist('c1', []), 'cable', {});
  const cable = after.steps.find((s) => s.stepId === 'cable');
  assert.equal(cable.completed, true);
  assert.equal(cable.date, null);
  assert.equal(cable.by, null);
});

test('tick: unknown step returns the checklist unchanged', () => {
  const before = buildOnboardingChecklist('c1', []);
  assert.equal(tickOnboardingStep(before, 'router', { date: '2026-11-02', by: 'Saad' }), before);
  assert.equal(untickOnboardingStep(before, 'router'), before);
});

test('untick: clears only that step, date and by cleared with it', () => {
  const before = buildOnboardingChecklist('c1', fullTicks.slice(0, 3));
  const after = untickOnboardingStep(before, 'survey');
  assert.equal(after.steps.find((s) => s.stepId === 'survey').completed, false);
  assert.equal(after.steps.find((s) => s.stepId === 'survey').date, null);
  assert.equal(after.steps.find((s) => s.stepId === 'survey').by, null);
  assert.equal(after.steps.find((s) => s.stepId === 'enquiry').completed, true);
  assert.equal(after.done, 2);
});

test('complete: all seven ticked is complete with no next step and 100%', () => {
  const checklist = buildOnboardingChecklist('c1', fullTicks);
  assert.equal(checklist.complete, true);
  assert.equal(checklist.done, 7);
  assert.equal(checklist.progressPercent, 100);
  assert.equal(checklist.nextStepId, null);
  assert.equal(checklist.nextStepLabel, null);
});

test('store: find accepts customerId or id rows, upsert replaces, remove drops', () => {
  const stored = [
    { customerId: 'c1', ticks: [{ stepId: 'enquiry', completed: true }] },
    { id: 'c2', ticks: [{ stepId: 'survey', completed: true }] },
  ];
  assert.equal(findOnboardingTicks(stored, 'c1').find((t) => t.stepId === 'enquiry').completed, true);
  assert.equal(findOnboardingTicks(stored, 'c2').find((t) => t.stepId === 'survey').completed, true);
  assert.deepEqual(findOnboardingTicks(stored, 'cX'), []);
  assert.deepEqual(findOnboardingTicks(stored, ''), []);
  const replaced = upsertOnboardingChecklist(stored, 'c1', [{ stepId: 'cable', completed: true }]);
  assert.equal(stored.length, 2);
  assert.equal(replaced.length, 2);
  assert.equal(findOnboardingTicks(replaced, 'c1').filter((t) => t.completed).length, 1);
  assert.equal(removeOnboardingChecklist(replaced, 'c1').length, 1);
});

test('entry: name falls back to id, mohalla from area or mohalla', () => {
  const a = buildOnboardingEntry({ id: 'c1', area: 'Mohalla A' }, []);
  assert.equal(a.customerName, 'c1');
  assert.equal(a.mohalla, 'Mohalla A');
  const b = buildOnboardingEntry({ id: 'c2', customerName: 'Bilal', mohalla: 'Mohalla B' }, []);
  assert.equal(b.customerName, 'Bilal');
  assert.equal(b.mohalla, 'Mohalla B');
});

test('pending: complete checklists excluded, sorted by name then id', () => {
  const entries = [
    buildOnboardingEntry({ id: 'c2', name: 'bilal' }, []),
    buildOnboardingEntry({ id: 'c1', name: 'Ahmed' }, fullTicks),
    buildOnboardingEntry({ id: 'c3', name: 'Ahmed' }, []),
  ];
  const pending = pendingOnboardingList(entries);
  assert.deepEqual(pending.map((e) => e.customerId), ['c3', 'c2']);
  assert.deepEqual(pendingOnboardingList([buildOnboardingEntry({ id: 'c1', name: 'A' }, fullTicks)]), []);
});

test('pending: a customer with no ticks at all is pending, never dropped', () => {
  const pending = pendingOnboardingList([buildOnboardingEntry({ id: 'c1', name: 'New' }, [])]);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].checklist.nextStepId, 'enquiry');
});

test('summary: counts complete vs pending, empty state', () => {
  assert.equal(onboardingSummaryText([]), 'No onboarding checklists yet');
  assert.equal(onboardingSummaryText([
    buildOnboardingChecklist('c1', fullTicks),
    buildOnboardingChecklist('c2', []),
    buildOnboardingChecklist('c3', [{ stepId: 'enquiry', completed: true }]),
  ]), '1 of 3 fully onboarded · 2 pending');
});

test('html: checklist shows steps, state, next step, and the blocks-nothing note', () => {
  const html = onboardingChecklistHtml(
    buildOnboardingChecklist('c1', [{ stepId: 'enquiry', completed: true, date: '2026-11-01', by: 'Saad' }]),
    'Ahmed',
  );
  assert.ok(html.includes('Onboarding checklist — Ahmed'));
  assert.ok(html.includes('1 of 7 steps done'));
  assert.ok(html.includes('next: Survey / feasibility'));
  assert.ok(html.includes('Enquiry — 2026-11-01 · Saad'));
  assert.ok(html.includes('blocks nothing'));
  assert.equal(onboardingChecklistHtml(null), '<p class="empty-state">No onboarding checklist</p>');
});

test('html: checklist escapes names, dates and by values', () => {
  const html = onboardingChecklistHtml(
    buildOnboardingChecklist('c1', [{ stepId: 'enquiry', completed: true, by: '<b>Saad</b>' }]),
    '<script>alert(1)</script>',
  );
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;b&gt;Saad&lt;/b&gt;'));
});

test('html: pending list shows mohalla and next step, empty state when none', () => {
  const html = onboardingPendingHtml([
    buildOnboardingEntry({ id: 'c1', name: 'Ahmed', area: 'Mohalla A' }, []),
  ]);
  assert.ok(html.includes('Ahmed (Mohalla A)'));
  assert.ok(html.includes('next: Enquiry'));
  assert.equal(onboardingPendingHtml([]), '<p class="empty-state">No pending onboardings</p>');
});

test('csv: one row per step per customer, comma quoting', () => {
  const csv = onboardingChecklistCsv([
    { customerId: 'c1', customerName: 'Ahmed, Jr', ticks: [{ stepId: 'enquiry', completed: true, date: '2026-11-01', by: 'Saad' }] },
  ]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'customerId,customerName,step,completed,date,by');
  assert.equal(lines.length, 8);
  assert.ok(lines[1].startsWith('c1,"Ahmed, Jr",Enquiry,yes,2026-11-01,Saad'));
  assert.ok(lines[2].includes(',Survey / feasibility,no,,'));
});

test('csv and summary: pending-list entries carrying a checklist are accepted', () => {
  const entry = buildOnboardingEntry({ id: 'c1', name: 'Ahmed' }, [{ stepId: 'enquiry', completed: true }]);
  assert.equal(onboardingSummaryText([entry]), '0 of 1 fully onboarded · 1 pending');
  assert.ok(onboardingChecklistCsv([entry]).includes('Enquiry,yes'));
});

test('csv: checklist objects are accepted directly', () => {
  const csv = onboardingChecklistCsv([buildOnboardingChecklist('c1', fullTicks)]);
  assert.equal(csv.split('\n').length, 8);
  assert.ok(csv.includes('First bill raised,yes,2026-11-01,Saad'));
});
