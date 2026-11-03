import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPANSION_STEP_IDS,
  expansionAreaKey,
  normalizeExpansionTick,
  normalizeExpansionTicks,
  buildExpansionChecklist,
  normalizeExpansionChecklist,
  findExpansionChecklist,
  tickExpansionStep,
  untickExpansionStep,
  upsertExpansionChecklist,
  removeExpansionChecklist,
  buildExpansionChecklistList,
  expansionSummaryText,
  expansionChecklistHtml,
  expansionChecklistCsv,
  expansionChecklistFilename,
} from '../expansion-checklist.js';

const tick = (stepId, completed = true, date = null, by = null) => ({
  stepId, completed, date, by,
});

test('catalogue: exactly the plan steps in order — survey, splitter, route, prices, announcement', () => {
  assert.deepEqual([...EXPANSION_STEP_IDS], ['survey', 'splitter', 'route', 'prices', 'announcement']);
});

test('area key: trimmed and case-insensitive, so Bani and BANI are one area', () => {
  assert.equal(expansionAreaKey('  Bani '), 'bani');
  assert.equal(expansionAreaKey('BANI'), 'bani');
  assert.equal(expansionAreaKey(''), '');
});

test('date validation: real dates kept, 2026-02-30 and bad formats rejected', () => {
  assert.equal(normalizeExpansionTick(tick('survey', true, '2026-03-05')).date, '2026-03-05');
  assert.equal(normalizeExpansionTick(tick('survey', true, '2024-02-29')).date, '2024-02-29');
  assert.equal(normalizeExpansionTick(tick('survey', true, '2026-02-30')).date, null);
  assert.equal(normalizeExpansionTick(tick('survey', true, '2026-13-01')).date, null);
  assert.equal(normalizeExpansionTick(tick('survey', true, '05-03-2026')).date, null);
  assert.equal(normalizeExpansionTick(tick('survey', true, undefined)).date, null);
});

test('normalisation: unknown step dropped, tick without date/by still counts with nulls', () => {
  assert.equal(normalizeExpansionTick({ stepId: 'launch' }), null);
  const kept = normalizeExpansionTick(tick('survey'));
  assert.equal(kept.completed, true);
  assert.equal(kept.date, null);
  assert.equal(kept.by, null);
  const unticked = normalizeExpansionTick(tick('survey', false));
  assert.equal(unticked.completed, false);
});

test('tick order: input in any order still renders in canonical step order', () => {
  const ticks = normalizeExpansionTicks([tick('prices'), tick('survey')]);
  assert.deepEqual(ticks.map((t) => t.stepId), [...EXPANSION_STEP_IDS]);
  assert.equal(ticks[0].completed, true);
  assert.equal(ticks[3].completed, true);
  assert.equal(ticks[1].completed, false);
});

test('repeated step: last tick wins, no duplicate step', () => {
  const ticks = normalizeExpansionTicks([
    tick('survey', true, '2026-03-01', 'Saad'),
    tick('survey', true, '2026-03-05', 'Owner'),
  ]);
  assert.equal(ticks[0].date, '2026-03-05');
  assert.equal(ticks[0].by, 'Owner');
  assert.equal(ticks.filter((t) => t.stepId === 'survey').length, 1);
});

test('build: done/total/percent/next step derived from steps, blank area rejected', () => {
  const built = buildExpansionChecklist('Bani', [tick('survey'), tick('splitter')]);
  assert.equal(built.done, 2);
  assert.equal(built.total, 5);
  assert.equal(built.progressPercent, 40);
  assert.equal(built.complete, false);
  assert.equal(built.nextStep, 'Cable route planned');
  assert.equal(built.nextStepId, 'route');
  assert.equal(buildExpansionChecklist('   ', []), null);
  assert.equal(buildExpansionChecklist('', []), null);
});

test('ready gate: unticked step means never ready, even with a note', () => {
  const built = buildExpansionChecklist('Bani', [tick('survey'), tick('splitter'), tick('route'), tick('prices')], 'GO');
  assert.equal(built.complete, false);
  assert.equal(built.ready, false);
});

test('ready gate: all steps ticked but no note means never ready', () => {
  const built = buildExpansionChecklist('Bani', EXPANSION_STEP_IDS.map((id) => tick(id)));
  assert.equal(built.complete, true);
  assert.equal(built.ready, false);
  assert.equal(built.goNoGoNote, null);
  assert.equal(built.nextStep, null);
});

test('ready gate: all steps ticked plus a note means ready', () => {
  const built = buildExpansionChecklist('Bani', EXPANSION_STEP_IDS.map((id) => tick(id)), 'GO — splitter confirmed');
  assert.equal(built.complete, true);
  assert.equal(built.ready, true);
  assert.equal(built.progressPercent, 100);
});

test('tick/untick: returns a new checklist, input never mutated, unknown step is a no-op', () => {
  const before = buildExpansionChecklist('Bani', [tick('survey')], 'GO');
  const after = tickExpansionStep(before, 'route', { date: '2026-03-10', by: 'Saad' });
  assert.equal(before.done, 1);
  assert.equal(after.done, 2);
  assert.equal(after.steps[2].date, '2026-03-10');
  assert.equal(after.steps[2].by, 'Saad');
  assert.equal(after.goNoGoNote, 'GO');
  const unticked = untickExpansionStep(after, 'route');
  assert.equal(unticked.done, 1);
  assert.equal(unticked.steps[2].completed, false);
  assert.equal(unticked.steps[2].date, null);
  assert.equal(tickExpansionStep(before, 'launch'), before);
  assert.equal(untickExpansionStep(before, 'launch'), before);
});

test('upsert: one checklist per area, same area replaces, never piles up', () => {
  let list = upsertExpansionChecklist([], 'Bani', [tick('survey')], null);
  list = upsertExpansionChecklist(list, 'BANI', [tick('survey'), tick('splitter')], 'GO');
  assert.equal(list.length, 1);
  assert.equal(list[0].area, 'BANI');
  assert.equal(list[0].done, 2);
  assert.equal(list[0].goNoGoNote, 'GO');
  list = upsertExpansionChecklist(list, '   ', [tick('survey')], null);
  assert.equal(list.length, 1);
});

test('find/remove: case-insensitive find, remove drops only that area', () => {
  const list = upsertExpansionChecklist(
    upsertExpansionChecklist([], 'Bani', [tick('survey')], null),
    'Chamyaa', [], null,
  );
  assert.equal(findExpansionChecklist(list, 'bani').area, 'Bani');
  assert.equal(findExpansionChecklist(list, 'Nope'), null);
  const removed = removeExpansionChecklist(list, 'BANI');
  assert.equal(removed.length, 1);
  assert.equal(removed[0].area, 'Chamyaa');
  assert.equal(list.length, 2);
});

test('normalise list: bad rows dropped, duplicate area keeps last, sorted name A–Z', () => {
  const rows = buildExpansionChecklistList([
    { area: 'Chamyaa', steps: [] },
    { area: 'Bani', steps: [tick('survey')] },
    { area: 'Bani', steps: [tick('survey'), tick('splitter')] },
    { area: '   ', steps: [] },
    null,
  ]);
  assert.deepEqual(rows.map((r) => r.area), ['Bani', 'Chamyaa']);
  assert.equal(rows[0].done, 2);
});

test('summary: counts ready, in progress and not started exactly', () => {
  const list = [
    buildExpansionChecklist('Bani', EXPANSION_STEP_IDS.map((id) => tick(id)), 'GO'),
    buildExpansionChecklist('Chamyaa', [tick('survey')], null),
    buildExpansionChecklist('Kishti', [], null),
  ];
  assert.equal(expansionSummaryText(list), '3 expansion areas · 1 ready · 1 in progress · 1 not started');
  assert.equal(expansionSummaryText([]), '0 expansion areas · 0 ready · 0 in progress · 0 not started');
});

test('html: escaping, READY badge only when ready, note shown or Not recorded', () => {
  const ready = buildExpansionChecklist('Bani<script>', EXPANSION_STEP_IDS.map((id) => tick(id)), 'GO & go');
  const html = expansionChecklistHtml([ready]);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('READY'));
  assert.ok(html.includes('GO &amp; go'));
  const pending = buildExpansionChecklist('Chamyaa', [tick('survey')], null);
  const pendingHtml = expansionChecklistHtml([pending]);
  assert.ok(!pendingHtml.includes('READY'));
  assert.ok(pendingHtml.includes('Not recorded'));
  assert.ok(pendingHtml.includes('Next step: Splitter capacity confirmed'));
  assert.equal(expansionChecklistHtml([]), '<p>No expansion areas yet.</p>');
});

test('csv: header, rows, quoting, and filename', () => {
  const list = [buildExpansionChecklist('Bani, North', EXPANSION_STEP_IDS.map((id) => tick(id)), 'GO, "now"')];
  const csv = expansionChecklistCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Area,Done,Total,Progress %,Ready,Next step,Go / no-go note');
  assert.ok(lines[1].startsWith('"Bani, North",5,5,100,Yes,,'));
  assert.ok(lines[1].includes('"GO, ""now"""'));
  assert.equal(expansionChecklistFilename(), 'expansion-checklist.csv');
});

test('tick never creates customers, bills or port assignments: checklist carries none of those fields', () => {
  const built = buildExpansionChecklist('Bani', EXPANSION_STEP_IDS.map((id) => tick(id)), 'GO');
  assert.equal('customerId' in built, false);
  assert.equal('billId' in built, false);
  assert.equal('port' in built, false);
  assert.equal(built.ready, true);
});
