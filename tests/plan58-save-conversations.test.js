/**
 * plan58-save-conversations.test.js — Plan 58: save conversation and
 * retention offer record.
 * Pins:
 * - each save conversation records exactly one offer and one
 *   outcome; an accepted offer must link to the change that
 *   fulfilled it, while a declined or still-deciding record needs
 *   no link;
 * - the save list is filterable by offer type and outcome;
 * - half-formed records are refused outright, never stored
 *   half-formed: no id, no customer, unknown offer/outcome, an
 *   impossible date (2026-02-30), or a reason outside Plan 57's six;
 * - a blank date or exit reason stays null, never a guessed value;
 * - recording a conversation never alters any bill, payment,
 *   package, or lifecycle record (the module holds no such field,
 *   and inputs are never mutated);
 * - the offer itself is never applied here: this record only ever
 *   points at the change made through its existing path (Plan 46
 *   preview, Plan 38 extension, Plan 37 repayment plan, or hold).
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_OFFERS,
  SAVE_OFFER_LABELS,
  SAVE_OUTCOMES,
  SAVE_OUTCOME_LABELS,
  validSaveDate,
  normalizeSaveConversation,
  normalizeSaveConversationList,
  findSaveConversation,
  upsertSaveConversation,
  removeSaveConversation,
  filterSaveConversations,
  sortedSaveConversations,
  buildSaveSummary,
  saveSummaryText,
  saveHtml,
  saveCsv,
  saveFilename,
} from '../save-conversations.js';

const base = {
  id: 'save-1',
  customerId: 'c1',
  customerName: 'Ayesha',
  conversationDate: '2026-11-01',
  exitReason: 'price',
  offer: 'package_change',
  outcome: 'still_deciding',
  note: 'Wants a cheaper package',
};

test('date validation accepts real dates and refuses impossible ones', () => {
  assert.equal(validSaveDate('2026-11-01'), '2026-11-01');
  assert.equal(validSaveDate('2024-02-29'), '2024-02-29');
  assert.equal(validSaveDate('2026-02-30'), null);
  assert.equal(validSaveDate('2026-13-01'), null);
  assert.equal(validSaveDate('not-a-date'), null);
  assert.equal(validSaveDate(''), null);
});

test('half-formed records are refused and blank date/reason stay null', () => {
  assert.equal(normalizeSaveConversation({ ...base, id: '' }), null);
  assert.equal(normalizeSaveConversation({ ...base, customerId: '' }), null);
  assert.equal(normalizeSaveConversation({ ...base, offer: 'discount' }), null);
  assert.equal(normalizeSaveConversation({ ...base, outcome: 'left_happily' }), null);
  assert.equal(normalizeSaveConversation({ ...base, conversationDate: '2026-02-30' }), null);
  assert.equal(normalizeSaveConversation({ ...base, exitReason: 'boredom' }), null);
  const blank = normalizeSaveConversation({ ...base, conversationDate: '', exitReason: '' });
  assert.equal(blank.conversationDate, null);
  assert.equal(blank.exitReason, null);
  assert.equal(blank.fulfilledChangeLink, null);
});

test('an accepted offer must link to its fulfilling change', () => {
  const noLink = normalizeSaveConversation({ ...base, outcome: 'accepted_stayed' });
  assert.equal(noLink, null);
  const linked = normalizeSaveConversation({
    ...base,
    outcome: 'accepted_stayed',
    fulfilledChangeLink: 'package-history-42',
  });
  assert.equal(linked.fulfilledChangeLink, 'package-history-42');
  const declined = normalizeSaveConversation({ ...base, outcome: 'declined_left' });
  assert.equal(declined.fulfilledChangeLink, null);
});

test('upsert replaces by id, find and remove work, list ignores bad rows', () => {
  const list = upsertSaveConversation([], base);
  assert.equal(list.length, 1);
  const replaced = upsertSaveConversation(list, { ...base, note: 'Updated note' });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].note, 'Updated note');
  assert.equal(findSaveConversation(replaced, 'save-1').customerId, 'c1');
  assert.equal(findSaveConversation(replaced, 'missing'), null);
  assert.equal(removeSaveConversation(replaced, 'save-1').length, 0);
  assert.equal(removeSaveConversation(replaced, 'missing').length, 1);
  const mixed = normalizeSaveConversationList([base, { ...base, id: 'bad', offer: 'nope' }]);
  assert.equal(mixed.length, 1);
});

test('the save list filters by offer type and outcome', () => {
  const list = [
    { ...base, id: 's1', offer: 'package_change', outcome: 'accepted_stayed', fulfilledChangeLink: 'chg-1' },
    { ...base, id: 's2', customerId: 'c2', offer: 'extension', outcome: 'declined_left' },
    { ...base, id: 's3', customerId: 'c3', offer: 'extension', outcome: 'still_deciding' },
  ];
  assert.equal(filterSaveConversations(list, { offer: 'extension' }).length, 2);
  assert.equal(filterSaveConversations(list, { outcome: 'accepted_stayed' }).length, 1);
  assert.equal(filterSaveConversations(list, { offer: 'extension', outcome: 'still_deciding' }).length, 1);
  assert.equal(filterSaveConversations(list, { offer: 'all', outcome: 'all' }).length, 3);
  assert.equal(filterSaveConversations(list, {}).length, 3);
});

test('sorting is newest date first, undated last, then name', () => {
  const list = [
    { ...base, id: 's-old', conversationDate: '2026-10-01' },
    { ...base, id: 's-undated', conversationDate: '' },
    { ...base, id: 's-new', conversationDate: '2026-11-02' },
  ];
  const sorted = sortedSaveConversations(list).map((row) => row.id);
  assert.deepEqual(sorted, ['s-new', 's-old', 's-undated']);
});

test('summary counts match the records on the same fixture', () => {
  const list = [
    { ...base, id: 's1', offer: 'package_change', outcome: 'accepted_stayed', fulfilledChangeLink: 'chg-1' },
    { ...base, id: 's2', customerId: 'c2', offer: 'extension', outcome: 'declined_left' },
    { ...base, id: 's3', customerId: 'c3', offer: 'repayment_plan', outcome: 'still_deciding' },
  ];
  const summary = buildSaveSummary(list);
  assert.equal(summary.total, 3);
  assert.equal(summary.saved, 1);
  assert.equal(summary.lost, 1);
  assert.equal(summary.deciding, 1);
  assert.equal(summary.byOffer.package_change, 1);
  assert.equal(summary.byOffer.extension, 1);
  assert.equal(summary.byOffer.repayment_plan, 1);
  assert.equal(summary.byOffer.pause_hold, 0);
  assert.equal(saveSummaryText(summary), '3 save conversation(s): 1 accepted and stayed, 1 declined and left, 1 still deciding.');
  assert.equal(saveSummaryText(buildSaveSummary([])), 'No save conversations recorded.');
});

test('catalogues carry exactly the plan offers and outcomes', () => {
  assert.deepEqual(SAVE_OFFERS, ['package_change', 'pause_hold', 'extension', 'repayment_plan', 'other']);
  assert.deepEqual(SAVE_OUTCOMES, ['accepted_stayed', 'declined_left', 'still_deciding']);
  assert.equal(SAVE_OFFER_LABELS.extension, 'Bill extension');
  assert.equal(SAVE_OUTCOME_LABELS.still_deciding, 'Still deciding');
});

test('no bill, payment, package, or lifecycle field on a record, and inputs are never mutated', () => {
  const record = normalizeSaveConversation(base);
  assert.deepEqual(Object.keys(record).sort(), [
    'conversationDate', 'customerId', 'customerName', 'exitReason',
    'fulfilledChangeLink', 'id', 'note', 'offer', 'outcome',
  ]);
  const frozen = { ...base };
  normalizeSaveConversation(frozen);
  upsertSaveConversation([frozen], { ...base, id: 's2' });
  assert.deepEqual(frozen, base);
});

test('summary text, HTML escaping, CSV quoting, and filename', () => {
  const list = [{ ...base, customerName: 'Ayesha <b>& Co', note: 'Said "too costly", left' }];
  const html = saveHtml(list);
  assert.ok(html.includes('Ayesha &lt;b&gt;&amp; Co'));
  assert.ok(!html.includes('<b>& Co'));
  const csv = saveCsv(list);
  assert.ok(csv.startsWith('id,customer,date,exit_reason,offer,outcome,fulfilling_change,note'));
  assert.ok(csv.includes('"Said ""too costly"", left"'));
  assert.equal(saveFilename(), 'save-conversations.csv');
  assert.equal(saveHtml([]), '<p style="font-size: 12px;">No save conversations recorded.</p>');
});
