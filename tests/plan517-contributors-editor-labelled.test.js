// Plan 517 — Contributors editor is labelled and says how it saves.
// The form's #profileContributorsEditor had no line telling the operator
// how its rows save (the save map deliberately excludes contributors, and
// Plan 499/500 dirty semantics cover only the 69 mapped fields), so the
// editor now states it saves with Save profile. The heading half of the
// plan was already true at the Plan 516 head: the editor renders the same
// contrib_heading h4 as the view's contributor split section — the first
// test pins that instead of adding a duplicate heading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contributorSplitSectionHtml, contributorEditorHtml
} from '../profile-ui.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const MONTH = '2026-10';
const billOf = (month, payments = []) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending',
  payments, generated: true, priceSnapshot: 3000, createdAt: '2026-10-01T00:00:00.000Z', amountHistory: []
});
const customerWithContributors = {
  id: 'cust-1', customerNumber: 9, name: 'Main Holder', archived: false,
  billingStartMonth: null, monthlySellingAmount: 3000,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  subContributors: [
    { id: 'SC-1', name: 'Hamsaya A', sharePKR: 1000, phone: '' },
    { id: 'SC-2', name: 'Hamsaya B', sharePKR: 1000, phone: '' }
  ],
  bills: [billOf(MONTH)]
};
const customerWithoutContributors = { ...customerWithContributors, subContributors: [] };

test('plan 517: editor heading is the same as the view contributor heading', () => {
  const heading = `<h4>${t('contrib_heading')}</h4>`;
  const editor = contributorEditorHtml(customerWithContributors, 3000);
  assert.ok(editor.includes(heading), 'editor must carry the view contributor heading');
  const view = contributorSplitSectionHtml(customerWithContributors, { month: MONTH, price: 3000 });
  assert.ok(view.includes(heading), 'view must carry the same heading');
});

test('plan 517: editor states it saves with Save profile, before the rows', () => {
  const editor = contributorEditorHtml(customerWithContributors, 3000);
  assert.ok(editor.includes('contrib-save-note'), 'editor must carry the save note');
  assert.ok(editor.includes('Save profile'), 'save note must name the Save profile button');
  assert.ok(editor.includes('no separate save'), 'save note must say there is no separate save');
  assert.ok(editor.indexOf('contrib-save-note') < editor.indexOf('contrib-rows'), 'save note must read before the rows');
  assert.ok(editor.indexOf('contrib-save-note') < editor.indexOf('data-contrib-add'), 'save note must read before the add button');
});

test('plan 517: save note shows even with no neighbours yet', () => {
  const editor = contributorEditorHtml(customerWithoutContributors, 3000);
  assert.ok(editor.includes('contrib-save-note'), 'save note must show before any neighbour is added');
  assert.ok(editor.includes('contrib-empty'), 'empty state still renders');
});

test('plan 517: contrib_save_note exists in both dictionaries and resolves with {save}', () => {
  assert.equal(typeof TRANSLATIONS.en.contrib_save_note, 'string');
  assert.equal(typeof TRANSLATIONS.ur.contrib_save_note, 'string');
  assert.ok(TRANSLATIONS.en.contrib_save_note.includes('{save}'), 'en value must take the button label as a param');
  assert.ok(TRANSLATIONS.ur.contrib_save_note.includes('{save}'), 'ur value must take the button label as a param');
  assert.match(TRANSLATIONS.ur.contrib_save_note, /[\u0600-\u06FF]/, 'ur value must carry Urdu script');
  const en = t('contrib_save_note', 'en', { save: 'Save profile' });
  assert.ok(en.includes('Save profile'), 'en line must name the button');
  assert.equal(en.includes('{save}'), false, 'en line must resolve the param');
  const ur = t('contrib_save_note', 'ur', { save: 'پروفائل محفوظ کریں' });
  assert.ok(ur.includes('پروفائل محفوظ کریں'), 'ur line must name the button');
  assert.equal(ur.includes('{save}'), false, 'ur line must resolve the param');
});

test('plan 517: editor gains no per-field save; the contributors error jump stays wired', () => {
  const editor = contributorEditorHtml(customerWithContributors, 3000);
  assert.equal(editor.includes('profile-field-save'), false, 'contributors keep no per-field save (Plan 499/500 boundary)');
  assert.ok(editor.includes('data-error-jump="contributors"'), 'shares warning must keep its error-jump target');
});
