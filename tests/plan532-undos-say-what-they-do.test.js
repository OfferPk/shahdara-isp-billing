// Plan 532 — The two undos say what they do: the success screen
// showed two undo buttons side by side with the same styling and
// near-identical labels, so an operator in a hurry could not tell
// which one keeps the audit trail. Wording only: the five-second
// undo now names that it deletes the payment, the sixty-second
// reversal undo names that the original stays visible, the reversal
// drops to plain secondary weight, and a one-line note explains
// when only the five-second undo is offered. No change to either
// undo's window, eligibility, or effect.
// Pattern-fake data only: Customer One (#41).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS,
  quickCollectReversalUndoButtonText,
  quickCollectReversalUndoIsPlainPayment,
} from '../quick-collect-reversal-undo.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const moduleSrc = readFileSync(new URL('../quick-collect-reversal-undo.js', import.meta.url), 'utf8');

const DELETE_LABEL = '↩ Undo — deletes this payment (5s)';
const REVERSAL_LABEL = '↩ Undo by reversal — original stays visible (60s)';
const NOTE_TEXT = 'Only the 5-second undo is available — this payment settled charges, waived a late fee, or recorded a waada.';

function buttonTag(buttonId) {
  const at = pageSrc.indexOf(`id="${buttonId}"`);
  assert.ok(at > 0, `expected a button with id ${buttonId}`);
  const start = pageSrc.lastIndexOf('<button', at);
  const end = pageSrc.indexOf('</button>', at);
  assert.ok(start > 0 && end > start, `expected a closed button tag for ${buttonId}`);
  return pageSrc.slice(start, end);
}

function buttonText(buttonId) {
  const tag = buttonTag(buttonId);
  const text = tag.slice(tag.indexOf('>') + 1).trim();
  return text;
}

test('labels: the five-second undo names that it deletes the payment', () => {
  assert.equal(buttonText('quickCollectUndoBtn'), DELETE_LABEL);
  // The live countdown keeps the same words while the seconds tick.
  assert.ok(wiringSrc.includes('undoBtn.textContent = `↩ Undo — deletes this payment (${left}s)`;'), 'countdown render carries the new words');
  // Both save paths set the same static label when the button appears.
  const sets = wiringSrc.match(/undoBtn\.textContent = '↩ Undo — deletes this payment \(5s\)';/g) || [];
  assert.equal(sets.length, 2, 'split and single save paths both set the delete label');
  assert.doesNotMatch(buttonTag('quickCollectUndoBtn'), /Undo Payment/);
});

test('labels: the reversal undo names that the original stays visible', () => {
  assert.equal(quickCollectReversalUndoButtonText(60), REVERSAL_LABEL);
  assert.equal(quickCollectReversalUndoButtonText(1), '↩ Undo by reversal — original stays visible (1s)');
  assert.equal(quickCollectReversalUndoButtonText(59.5), '↩ Undo by reversal — original stays visible (59s)');
  assert.equal(quickCollectReversalUndoButtonText(0), '↩ Undo by reversal — original stays visible');
  assert.equal(quickCollectReversalUndoButtonText(61), '↩ Undo by reversal — original stays visible');
  assert.equal(quickCollectReversalUndoButtonText(NaN), '↩ Undo by reversal — original stays visible');
  assert.equal(buttonText('quickCollectReversalUndoBtn'), REVERSAL_LABEL);
});

test('hierarchy: the reversal undo is secondary weight, the delete undo keeps its warning', () => {
  const reversalTag = buttonTag('quickCollectReversalUndoBtn');
  assert.match(reversalTag, /secondary-button qc-undo-btn/);
  assert.doesNotMatch(reversalTag, /var\(--overdue/);
  assert.doesNotMatch(reversalTag, /#c62828/);
  assert.doesNotMatch(reversalTag, /style=/);
  const deleteTag = buttonTag('quickCollectUndoBtn');
  assert.match(deleteTag, /secondary-button qc-undo-btn/);
  // Plan 548: the warning red moved off the tag into the stylesheet — the
  // tag carries no inline style any more; the red lives in the
  // #quickCollectUndoBtn rule (bulk-collect.css), still var(--color-overdue).
  // The rule hangs off the id, not the shared qc-undo-btn class, because
  // the reversal undo shares that class and must stay plain secondary.
  // The pin that the red still exists moved to plan548's test file.
  assert.doesNotMatch(deleteTag, /style=/);
  assert.doesNotMatch(deleteTag, /#c62828/);
});

test('note: a one-line note explains when only the five-second undo is offered', () => {
  const actionsAt = pageSrc.indexOf('class="qc-success-actions"');
  const noteAt = pageSrc.indexOf('qc-undo-note');
  const reversalAt = pageSrc.indexOf('id="quickCollectReversalUndoBtn"');
  assert.ok(actionsAt > 0 && noteAt > actionsAt && noteAt > reversalAt, 'note sits after the reversal button inside the success actions');
  const noteTag = pageSrc.slice(pageSrc.lastIndexOf('<p', noteAt), pageSrc.indexOf('</p>', noteAt));
  assert.match(noteTag, /class="field-help qc-undo-note"/);
  assert.match(noteTag, / hidden/);
  assert.ok(noteTag.includes(NOTE_TEXT), 'note names the charge/waiver/waada reason');
  assert.doesNotMatch(noteTag, /id=/);
});

test('wiring: the note shows when the reversal is ineligible and hides when it is armed', () => {
  const armAt = wiringSrc.indexOf('function armReversalUndo(');
  assert.ok(armAt > 0, 'arm function found');
  const armSlice = wiringSrc.slice(armAt, armAt + 1400);
  assert.match(armSlice, /quickCollectReversalUndoIsPlainPayment\(/);
  assert.match(armSlice, /if \(!plain\) \{\s*if \(reversalUndoNote\) reversalUndoNote\.hidden = false;\s*return;\s*\}/);
  const disarmAt = wiringSrc.indexOf('function disarmReversalUndo()');
  assert.ok(disarmAt > 0, 'disarm function found');
  const disarmSlice = wiringSrc.slice(disarmAt, disarmAt + 700);
  assert.match(disarmSlice, /if \(reversalUndoNote\) reversalUndoNote\.hidden = true;/);
  assert.match(disarmSlice, /if \(reversalUndoBtn\) reversalUndoBtn\.hidden = true;/);
  // Eligibility itself is unchanged: charges, waiver, or waada still
  // keep the reversal away.
  assert.equal(quickCollectReversalUndoIsPlainPayment({ ticketCharges: [{ id: 'T-1' }] }), false);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ hasWaiver: true }), false);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ hasWaadaStamp: true }), false);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ ticketCharges: [], addonCharges: [] }), true);
});

test('wiring: the note hides when the five-second window lapses', () => {
  // Both save paths arm the same five-second timeout (split + single);
  // the note's premise ("only the five-second undo is available")
  // stops being true when that window lapses, so each callback hides
  // it beside the button. Disarm hides it a third time.
  const hides = wiringSrc.match(/if \(reversalUndoNote\) reversalUndoNote\.hidden = true;/g) || [];
  assert.equal(hides.length, 3, 'disarm + both five-second timeout callbacks hide the note');
  const timeouts = wiringSrc.match(/undoTimeoutId = setTimeout\(\(\) => \{/g) || [];
  assert.equal(timeouts.length, 2, 'split and single save paths both arm the five-second timeout');
  for (const match of wiringSrc.matchAll(/undoTimeoutId = setTimeout\(\(\) => \{([\s\S]{0,400}?)\}, UNDO_WINDOW_MS\);/g)) {
    assert.match(match[1], /if \(undoBtn\) undoBtn\.hidden = true;/);
    assert.match(match[1], /if \(reversalUndoNote\) reversalUndoNote\.hidden = true;/);
  }
});

test('behaviour: neither undo window changes', () => {
  assert.equal(QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS, 60000);
  assert.match(wiringSrc, /const UNDO_WINDOW_MS = 5000;/);
  // The delete undo still deletes and the reversal still reverses.
  const undoAt = wiringSrc.indexOf('function executeUndo()');
  assert.ok(undoAt > 0, 'delete undo found');
  assert.match(wiringSrc.slice(undoAt, undoAt + 6000), /deletePayment\(/);
  const reversalAt = wiringSrc.indexOf('function executeReversalUndo()');
  assert.ok(reversalAt > 0, 'reversal undo found');
  assert.match(wiringSrc.slice(reversalAt, reversalAt + 6000), /quickCollectReversalUndoFields\(/);
});

test('labels: neither renamed label nor the note carries a money figure', () => {
  for (const text of [buttonText('quickCollectUndoBtn'), buttonText('quickCollectReversalUndoBtn'), NOTE_TEXT]) {
    assert.doesNotMatch(text, /Rs\b|PKR|\$|€|£|USD|¥/);
  }
});

test('purity: no new element id, no new store key, no new hex', () => {
  // The note is found by class through the undo button's own parent,
  // never through a new id or the bare document.
  assert.match(wiringSrc, /const reversalUndoNote = typeof undoBtn\?\.parentElement\?\.querySelector === 'function'\s*\? undoBtn\.parentElement\.querySelector\('\.qc-undo-note'\)\s*: null;/);
  assert.doesNotMatch(pageSrc, /id="[^"]*undo-note[^"]*"/i);
  assert.doesNotMatch(moduleSrc, /localStorage|document\./);
  assert.doesNotMatch(moduleSrc, /new Date\(|Date\.now\(/);
});
