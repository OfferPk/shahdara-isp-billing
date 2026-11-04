/**
 * plan64-dispute-resolutions.test.js — Plan 64: dispute resolution
 * checklist and owner sign-off for large adjustments.
 * Pins:
 * - a case cannot be marked resolved without a finding and an
 *   outcome — the resolve gate refuses either missing piece;
 * - an above-threshold correction or concession needs an owner
 *   sign-off note before the existing path is used; exactly at
 *   the threshold, a matched payment, a "none" path, and an
 *   unset threshold never need one;
 * - the resolved case links to the correction, concession, or
 *   payment it used — a money path without a link is refused;
 * - sign-off and resolution notes never change any total by
 *   themselves: the module holds no bill total, payment row,
 *   Waada field, or customer record, and inputs are never
 *   mutated;
 * - impossible dates (2026-02-30) are never stored as a date;
 *   amounts sum in integer cents.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESOLUTION_PATHS,
  RESOLUTION_PATH_LABELS,
  SIGNOFF_PATHS,
  validResolutionDate,
  thresholdCents,
  normalizeResolutionPath,
  normalizeResolution,
  normalizeDisputeResolutionList,
  upsertResolution,
  removeResolution,
  findResolution,
  signOffRequired,
  resolutionReadiness,
  resolutionChecklist,
  buildResolutionSummary,
  buildResolutionSummaryWithThreshold,
  resolutionSummaryText,
  resolutionHtml,
  resolutionCsv,
  resolutionFilename,
  checklistHtml,
} from '../dispute-resolutions.js';

function baseResolution(overrides = {}) {
  return {
    caseId: 'd1',
    finding: 'Bill charged the old package price after the upgrade.',
    outcome: 'Corrected to the new package price.',
    path: 'correction',
    adjustmentAmount: 500,
    linkedId: 'corr-001',
    signOffNote: '',
    signOffBy: '',
    dateResolved: '2026-10-20',
    ...overrides,
  };
}

test('date validation', () => {
  assert.equal(validResolutionDate('2026-02-30'), null);
  assert.equal(validResolutionDate('2024-02-29'), '2024-02-29');
  assert.equal(validResolutionDate('2026-10-20T09:00:00'), '2026-10-20');
  assert.equal(validResolutionDate('not a date'), null);
  assert.equal(validResolutionDate(''), null);
});

test('path catalogue', () => {
  assert.deepEqual(RESOLUTION_PATHS, ['correction', 'concession', 'matched_payment', 'none']);
  assert.equal(RESOLUTION_PATH_LABELS.correction, 'Correction via Plan K');
  assert.equal(RESOLUTION_PATH_LABELS.none, 'No adjustment — bill was right');
  assert.deepEqual(SIGNOFF_PATHS, ['correction', 'concession']);
  assert.equal(normalizeResolutionPath('Matched Payment'), 'matched_payment');
  assert.equal(normalizeResolutionPath('write-off'), null);
  assert.equal(normalizeResolutionPath(''), null);
});

test('threshold parsing never invents a limit', () => {
  assert.equal(thresholdCents(1000), 100000);
  assert.equal(thresholdCents('250.50'), 25050);
  assert.equal(thresholdCents(null), null);
  assert.equal(thresholdCents(''), null);
  assert.equal(thresholdCents(0), null);
  assert.equal(thresholdCents(-100), null);
  assert.equal(thresholdCents('not a number'), null);
  assert.equal(thresholdCents(true), null);
});

test('half-formed resolutions are refused, never stored half-formed', () => {
  assert.equal(normalizeResolution(baseResolution({ caseId: '' })), null);
  assert.equal(normalizeResolution(baseResolution({ finding: '   ' })), null);
  assert.equal(normalizeResolution(baseResolution({ outcome: '' })), null);
  assert.equal(normalizeResolution(baseResolution({ path: 'discount' })), null);
  assert.equal(normalizeResolution(baseResolution({ adjustmentAmount: 0 })), null);
  assert.equal(normalizeResolution(baseResolution({ adjustmentAmount: -50 })), null);
  assert.equal(normalizeResolution(baseResolution({ linkedId: '' })), null);
  // An impossible date is not stored as a date (Plan 61 precedent for
  // an optional date field); the record itself is still valid.
  assert.equal(normalizeResolution(baseResolution({ dateResolved: '2026-02-30' })).dateResolved, null);
});

test('a none path carries no amount and no link', () => {
  const item = normalizeResolution(baseResolution({
    path: 'none', adjustmentAmount: 500, linkedId: 'corr-001',
  }));
  assert.equal(item.path, 'none');
  assert.equal(item.adjustmentAmount, null);
  assert.equal(item.adjustmentAmountCents, null);
  assert.equal(item.linkedId, null);
});

test('a matched payment may carry an amount but needs its link', () => {
  const withAmount = normalizeResolution(baseResolution({
    path: 'matched_payment', adjustmentAmount: 1200, linkedId: 'claim-9',
  }));
  assert.equal(withAmount.adjustmentAmount, 1200);
  const withoutAmount = normalizeResolution(baseResolution({
    path: 'matched_payment', adjustmentAmount: '', linkedId: 'claim-9',
  }));
  assert.equal(withoutAmount.adjustmentAmount, null);
  assert.equal(normalizeResolution(baseResolution({
    path: 'matched_payment', linkedId: '',
  })), null);
});

test('sign-off is required only strictly above the threshold', () => {
  const above = baseResolution({ adjustmentAmount: 1000.01 });
  const at = baseResolution({ adjustmentAmount: 1000 });
  const below = baseResolution({ adjustmentAmount: 999.99 });
  assert.equal(signOffRequired(above, 1000), true);
  assert.equal(signOffRequired(at, 1000), false);
  assert.equal(signOffRequired(below, 1000), false);
  assert.equal(signOffRequired(above, null), false);
  assert.equal(signOffRequired(above, ''), false);
  assert.equal(signOffRequired(baseResolution({ path: 'matched_payment', linkedId: 'claim-9' }), 100), false);
  assert.equal(signOffRequired(baseResolution({ path: 'none', adjustmentAmount: '', linkedId: '' }), 100), false);
  assert.equal(signOffRequired(baseResolution({ path: 'concession', adjustmentAmount: 5000 }), 1000), true);
  assert.equal(signOffRequired({ nonsense: true }, 1000), false);
});

test('the resolve gate refuses a case without finding or outcome', () => {
  const missingFinding = resolutionReadiness(baseResolution({ finding: '' }), 1000);
  assert.equal(missingFinding.ready, false);
  assert.ok(missingFinding.reasons.length > 0);
  const missingOutcome = resolutionReadiness(baseResolution({ outcome: '' }), 1000);
  assert.equal(missingOutcome.ready, false);
  const missingLink = resolutionReadiness(baseResolution({ linkedId: '' }), 1000);
  assert.equal(missingLink.ready, false);
});

test('the resolve gate refuses an above-threshold adjustment without sign-off, and passes with one', () => {
  const blocked = resolutionReadiness(baseResolution({ adjustmentAmount: 5000, signOffNote: '' }), 1000);
  assert.equal(blocked.ready, false);
  assert.equal(blocked.signOffRequired, true);
  assert.equal(blocked.signOffPresent, false);
  assert.ok(blocked.reasons.some((reason) => reason.includes('sign-off')));
  const signed = resolutionReadiness(baseResolution({
    adjustmentAmount: 5000, signOffNote: 'Owner approved on 2026-10-20.', signOffBy: 'Owner',
  }), 1000);
  assert.equal(signed.ready, true);
  assert.equal(signed.signOffRequired, true);
  assert.equal(signed.signOffPresent, true);
  assert.deepEqual(signed.reasons, []);
  const below = resolutionReadiness(baseResolution({ adjustmentAmount: 500, signOffNote: '' }), 1000);
  assert.equal(below.ready, true);
  assert.equal(below.signOffRequired, false);
});

test('an already-resolved case is not re-resolved through the gate', () => {
  const result = resolutionReadiness(baseResolution({}), 1000, { status: 'resolved' });
  assert.equal(result.ready, false);
  assert.ok(result.reasons.some((reason) => reason.includes('already resolved')));
  const open = resolutionReadiness(baseResolution({}), 1000, { status: 'open' });
  assert.equal(open.ready, true);
});

test('checklist marks applicable items done and inapplicable ones not missing', () => {
  const complete = resolutionChecklist(baseResolution({
    adjustmentAmount: 500, signOffNote: '',
  }), 1000);
  assert.equal(complete.complete, true);
  assert.equal(complete.signOffRequired, false);
  assert.equal(complete.rows.find((row) => row.key === 'signoff').applies, false);
  const incomplete = resolutionChecklist(baseResolution({
    adjustmentAmount: 5000, signOffNote: '',
  }), 1000);
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.signOffRequired, true);
  assert.equal(incomplete.rows.find((row) => row.key === 'signoff').done, false);
  const nonePath = resolutionChecklist(baseResolution({
    path: 'none', adjustmentAmount: '', linkedId: '',
  }), 1000);
  assert.equal(nonePath.complete, true);
  assert.equal(nonePath.rows.find((row) => row.key === 'link').applies, false);
  assert.equal(nonePath.rows.find((row) => row.key === 'amount').applies, false);
  assert.ok(checklistHtml(complete).includes('Checklist complete'));
  assert.ok(checklistHtml(incomplete).includes('Checklist incomplete'));
});

test('upsert, find, and remove keep one resolution per case', () => {
  const first = upsertResolution([], baseResolution());
  assert.equal(first.length, 1);
  const replaced = upsertResolution(first, baseResolution({ finding: 'Updated finding.' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].finding, 'Updated finding.');
  const refused = upsertResolution(replaced, baseResolution({ caseId: 'd2', finding: '' }));
  assert.equal(refused.length, 1);
  assert.equal(findResolution(replaced, 'd1').caseId, 'd1');
  assert.equal(findResolution(replaced, 'd9'), null);
  assert.deepEqual(removeResolution(replaced, 'd1'), []);
  assert.deepEqual(normalizeDisputeResolutionList([baseResolution(), { junk: true }]).length, 1);
});

test('inputs are never mutated and no money field is held', () => {
  const raw = baseResolution();
  const snapshot = JSON.stringify(raw);
  const list = [raw];
  normalizeResolution(raw);
  upsertResolution(list, baseResolution({ finding: 'Other.' }));
  resolutionReadiness(raw, 1000);
  assert.equal(JSON.stringify(raw), snapshot);
  assert.equal(list.length, 1);
  const item = normalizeResolution(raw);
  assert.deepEqual(Object.keys(item).sort(), [
    'adjustmentAmount', 'adjustmentAmountCents', 'caseId', 'dateResolved',
    'finding', 'linkedId', 'outcome', 'path', 'signOffBy', 'signOffNote',
  ].sort());
  assert.ok(!('billTotal' in item || 'payment' in item || 'waada' in item || 'customer' in item));
});

test('summary sums adjustments in integer cents, threshold view counts awaiting sign-off', () => {
  const list = [
    baseResolution({ caseId: 'd1', adjustmentAmount: 333.33 }),
    baseResolution({ caseId: 'd2', path: 'concession', adjustmentAmount: 166.67, linkedId: 'conc-2' }),
    baseResolution({ caseId: 'd3', path: 'matched_payment', adjustmentAmount: 900, linkedId: 'claim-3' }),
    baseResolution({ caseId: 'd4', path: 'none', adjustmentAmount: '', linkedId: '' }),
  ];
  const summary = buildResolutionSummary(list);
  assert.equal(summary.total, 4);
  assert.equal(summary.totalAdjustment, 500);
  assert.equal(summary.totalAdjustmentCents, 50000);
  assert.equal(summary.byPath.correction, 1);
  assert.equal(summary.byPath.matched_payment, 1);
  assert.equal(summary.byPath.none, 1);
  const withThreshold = buildResolutionSummaryWithThreshold(list, 1000);
  assert.equal(withThreshold.awaitingSignOff, 0);
  assert.equal(withThreshold.thresholdSet, true);
  assert.equal(withThreshold.threshold, 1000);
  const above = [baseResolution({ adjustmentAmount: 5000, signOffNote: '' })];
  assert.equal(buildResolutionSummaryWithThreshold(above, 1000).awaitingSignOff, 1);
  assert.equal(buildResolutionSummaryWithThreshold(above, null).awaitingSignOff, 0);
  assert.equal(buildResolutionSummaryWithThreshold(above, null).thresholdSet, false);
  const text = resolutionSummaryText(withThreshold);
  assert.ok(text.includes('4 dispute resolutions'));
  assert.ok(text.includes('Rs. 500'));
  assert.ok(text.includes('Rs. 1000'));
  assert.ok(resolutionSummaryText(buildResolutionSummary(list)).includes('no owner sign-off threshold set'));
});

test('HTML escaping, CSV quoting, and filename', () => {
  const list = [baseResolution({ finding: 'Price <b>wrong</b> & "quoted"', signOffNote: 'Ok, "approved"' })];
  const html = resolutionHtml(list);
  assert.ok(html.includes('&lt;b&gt;wrong&lt;/b&gt;'));
  assert.ok(!html.includes('<b>wrong</b>'));
  const csv = resolutionCsv(list);
  assert.ok(csv.includes('"Price <b>wrong</b> & ""quoted"""'));
  assert.ok(csv.startsWith('caseId,finding,outcome,path,adjustmentAmount,linkedId,signOffNote,signOffBy,dateResolved'));
  assert.equal(resolutionFilename(), 'dispute-resolutions.csv');
  assert.ok(resolutionHtml([]).includes('No dispute resolutions recorded.'));
});
