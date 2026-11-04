import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeAnnouncementDraft,
  normalizeAnnouncementDraftList,
  findAnnouncementDraft,
  upsertAnnouncementDraft,
  buildAnnouncementCopy,
  copyAnnouncementDraft,
  removeAnnouncementDraft,
  markAnnouncementSent,
  markAnnouncementUnsent,
  announcementDraftsForMohalla,
  announcementDraftsForPackage,
  announcementDraftMohallas,
  announcementDraftPackages,
  announcementDraftSentList,
  announcementDraftUnsentList,
  announcementDraftText,
  announcementDraftSummaryText,
  announcementDraftHtml,
  announcementDraftAllHtml,
  announcementDraftMohallaHtml,
  announcementDraftCsv,
  announcementDraftFilename,
} from '../announcement-draft.js';

const dir = dirname(fileURLToPath(import.meta.url));

const draft = (over = {}) => ({
  id: 'AD-1',
  packageName: '50 Mbps',
  monthlyRate: 2500,
  description: 'Faster evenings for the whole street.',
  mohalla: 'Mohalla A',
  sent: false,
  sentDate: '',
  ...over,
});

test('plan166: half-formed draft refused (no id, package, rate, description, or mohalla)', () => {
  assert.equal(normalizeAnnouncementDraft(draft({ id: '  ' })), null);
  assert.equal(normalizeAnnouncementDraft(draft({ packageName: '' })), null);
  assert.equal(normalizeAnnouncementDraft(draft({ monthlyRate: undefined })), null);
  assert.equal(normalizeAnnouncementDraft(draft({ monthlyRate: -50 })), null);
  assert.equal(normalizeAnnouncementDraft(draft({ monthlyRate: 'free' })), null);
  assert.equal(normalizeAnnouncementDraft(draft({ description: '  ' })), null);
  assert.equal(normalizeAnnouncementDraft(draft({ mohalla: '' })), null);
  assert.equal(normalizeAnnouncementDraft(null), null);
  assert.equal(normalizeAnnouncementDraft('not an object'), null);
});

test('plan166: monthly rate accepts numeric strings, zero is a usable rate', () => {
  assert.equal(normalizeAnnouncementDraft(draft({ monthlyRate: '2500' })).monthlyRate, 2500);
  assert.equal(normalizeAnnouncementDraft(draft({ monthlyRate: 0 })).monthlyRate, 0);
  assert.equal(normalizeAnnouncementDraft(draft({ monthlyRate: '  2500  ' })).monthlyRate, 2500);
});

test('plan166: unknown fields dropped, so no customer, bill, payment, or enrolment field can creep in', () => {
  const record = normalizeAnnouncementDraft(draft({
    customer: 'Ahmed', billId: 'B-1', payment: 500, enrol: true, sendNow: true,
  }));
  assert.ok(record);
  assert.equal('customer' in record, false);
  assert.equal('billId' in record, false);
  assert.equal('payment' in record, false);
  assert.equal('enrol' in record, false);
  assert.equal('sendNow' in record, false);
});

test('plan166: duplicate ids never rewritten', () => {
  const base = [draft()];
  assert.deepEqual(upsertAnnouncementDraft(base, draft()), base);
  assert.deepEqual(upsertAnnouncementDraft(base, draft({ monthlyRate: 3000 })), base);
  assert.deepEqual(upsertAnnouncementDraft(base, draft({ description: 'Changed.' })), base);
});

test('plan166: one draft per package per mohalla, case-insensitive', () => {
  const base = [draft()];
  assert.deepEqual(
    upsertAnnouncementDraft(base, draft({ id: 'AD-2', packageName: '50 mbps', mohalla: 'mohalla a' })),
    base,
  );
  const otherMohalla = upsertAnnouncementDraft(base, draft({ id: 'AD-2', mohalla: 'Mohalla B' }));
  assert.equal(otherMohalla.length, 2);
  const otherPackage = upsertAnnouncementDraft(base, draft({ id: 'AD-3', packageName: '100 Mbps' }));
  assert.equal(otherPackage.length, 2);
});

test('plan166: copy changes only the mohalla, sent mark resets', () => {
  const source = draft({ sent: true, sentDate: '2026-11-01' });
  const copy = buildAnnouncementCopy(source, 'Mohalla B', 'AD-9');
  assert.ok(copy);
  assert.equal(copy.id, 'AD-9');
  assert.equal(copy.mohalla, 'Mohalla B');
  assert.equal(copy.packageName, '50 Mbps');
  assert.equal(copy.monthlyRate, 2500);
  assert.equal(copy.description, 'Faster evenings for the whole street.');
  assert.equal(copy.sent, false);
  assert.equal(copy.sentDate, '');
  assert.equal(buildAnnouncementCopy(source, '', 'AD-10'), null);
  assert.equal(buildAnnouncementCopy(null, 'Mohalla B', 'AD-10'), null);
});

test('plan166: copyAnnouncementDraft appends per mohalla and refuses the same mohalla again', () => {
  const base = [draft()];
  const copied = copyAnnouncementDraft(base, 'AD-1', 'Mohalla B', 'AD-2');
  assert.equal(copied.length, 2);
  assert.equal(findAnnouncementDraft(copied, 'AD-2').mohalla, 'Mohalla B');
  assert.deepEqual(copyAnnouncementDraft(base, 'AD-1', 'Mohalla A', 'AD-3'), base);
  assert.deepEqual(copyAnnouncementDraft(base, 'AD- missing', 'Mohalla B', 'AD-3'), base);
});

test('plan166: marking one copy sent never marks another mohalla sent', () => {
  const list = [draft(), draft({ id: 'AD-2', mohalla: 'Mohalla B' })];
  const marked = markAnnouncementSent(list, 'AD-1', '2026-11-04');
  assert.equal(findAnnouncementDraft(marked, 'AD-1').sent, true);
  assert.equal(findAnnouncementDraft(marked, 'AD-1').sentDate, '2026-11-04');
  assert.equal(findAnnouncementDraft(marked, 'AD-2').sent, false);
  assert.equal(findAnnouncementDraft(marked, 'AD-2').sentDate, '');
  assert.deepEqual(markAnnouncementSent(list, 'AD-1', '2026-02-30'), list);
  assert.deepEqual(markAnnouncementSent(list, 'AD-missing', '2026-11-04'), list);
  const unsent = markAnnouncementUnsent(marked, 'AD-1');
  assert.equal(findAnnouncementDraft(unsent, 'AD-1').sent, false);
  assert.equal(findAnnouncementDraft(unsent, 'AD-1').sentDate, '');
});

test('plan166: find and remove', () => {
  const list = [draft(), draft({ id: 'AD-2', mohalla: 'Mohalla B' })];
  assert.equal(findAnnouncementDraft(list, 'AD-2').mohalla, 'Mohalla B');
  assert.equal(findAnnouncementDraft(list, 'AD-missing'), null);
  assert.equal(findAnnouncementDraft(list, ''), null);
  assert.deepEqual(removeAnnouncementDraft(list, 'AD-1'), [draft({ id: 'AD-2', mohalla: 'Mohalla B' })]);
  assert.deepEqual(removeAnnouncementDraft(list, 'AD-missing'), list);
});

test('plan166: mohalla view is package-ordered and case-insensitive', () => {
  const list = [
    draft({ id: 'AD-2', packageName: '100 Mbps' }),
    draft({ id: 'AD-1', packageName: '50 Mbps' }),
    draft({ id: 'AD-3', packageName: '20 Mbps', mohalla: 'Mohalla B' }),
  ];
  const rows = announcementDraftsForMohalla(list, 'MOHALLA a');
  assert.deepEqual(rows.map((item) => item.id), ['AD-2', 'AD-1']);
  assert.deepEqual(announcementDraftsForMohalla(list, ''), []);
  assert.deepEqual(announcementDraftsForMohalla(list, 'Mohalla C'), []);
});

test('plan166: package view is mohalla-ordered', () => {
  const list = [
    draft({ id: 'AD-2', mohalla: 'Mohalla B' }),
    draft({ id: 'AD-1', mohalla: 'Mohalla A' }),
  ];
  const rows = announcementDraftsForPackage(list, '50 MBPS');
  assert.deepEqual(rows.map((item) => item.id), ['AD-1', 'AD-2']);
});

test('plan166: mohalla and package lists keep first spelling, sorted A-Z', () => {
  const list = [
    draft({ mohalla: 'Mohalla B' }),
    draft({ id: 'AD-2', mohalla: 'mohalla a', packageName: '100 Mbps' }),
    draft({ id: 'AD-3', mohalla: 'Mohalla A', packageName: '50 Mbps' }),
  ];
  assert.deepEqual(announcementDraftMohallas(list), ['Mohalla B', 'mohalla a']);
  assert.deepEqual(announcementDraftPackages(list), ['100 Mbps', '50 Mbps']);
});

test('plan166: sent and unsent lists', () => {
  const list = [
    draft({ sent: true, sentDate: '2026-11-01' }),
    draft({ id: 'AD-2', mohalla: 'Mohalla B' }),
  ];
  assert.deepEqual(announcementDraftSentList(list).map((item) => item.id), ['AD-1']);
  assert.deepEqual(announcementDraftUnsentList(list).map((item) => item.id), ['AD-2']);
});

test('plan166: draft text names the mohalla, package, rate, and description', () => {
  assert.equal(
    announcementDraftText(draft()),
    'New package in Mohalla A: 50 Mbps — Rs 2500/month. Faster evenings for the whole street.',
  );
  assert.equal(announcementDraftText(null), '');
});

test('plan166: summary text counts drafts, mohallas, and sent copies', () => {
  const list = [
    draft({ sent: true, sentDate: '2026-11-01' }),
    draft({ id: 'AD-2', mohalla: 'Mohalla B' }),
  ];
  assert.equal(announcementDraftSummaryText(list), '2 announcement drafts · 2 mohallas · 1 sent');
  assert.equal(announcementDraftSummaryText([]), '0 announcement drafts · 0 mohallas · 0 sent');
});

test('plan166: HTML escapes markup in package, mohalla, and description', () => {
  const html = announcementDraftHtml(draft({
    packageName: '<b>50 Mbps</b>', mohalla: 'Mohalla <A>', description: '<script>alert(1)</script>',
  }));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;b&gt;50 Mbps&lt;/b&gt;'));
  assert.ok(html.includes('Mohalla &lt;A&gt;'));
  assert.ok(html.includes('Not sent'));
  assert.equal(announcementDraftHtml(null), '');
  assert.ok(announcementDraftAllHtml([]).includes('No announcement drafts'));
  assert.ok(announcementDraftMohallaHtml([draft()], 'Mohalla C').includes('No announcement drafts for this mohalla.'));
});

test('plan166: CSV carries only draft fields, with a stable filename', () => {
  const csv = announcementDraftCsv([draft({ description: 'Fast, "really" fast' })]);
  assert.ok(csv.startsWith('id,packageName,monthlyRate,description,mohalla,sent,sentDate\n'));
  assert.ok(csv.includes('"Fast, ""really"" fast"'));
  assert.equal(announcementDraftFilename(), 'announcement-drafts.csv');
});

test('plan166: inputs are never mutated', () => {
  const input = draft();
  const snapshot = JSON.stringify(input);
  normalizeAnnouncementDraft(input);
  upsertAnnouncementDraft([input], draft({ id: 'AD-2', mohalla: 'Mohalla B' }));
  markAnnouncementSent([input], 'AD-1', '2026-11-04');
  assert.equal(JSON.stringify(input), snapshot);
});

test('plan166: list normalization drops bad rows, later duplicate ids, and later same pairs', () => {
  const list = normalizeAnnouncementDraftList([
    draft(),
    draft({ monthlyRate: -5 }),
    draft({ id: 'AD-1', monthlyRate: 3000 }),
    draft({ id: 'AD-2', packageName: '50 mbps', mohalla: 'MOHALLA A' }),
    draft({ id: 'AD-3', mohalla: 'Mohalla B' }),
    null,
  ]);
  assert.deepEqual(list.map((item) => item.id), ['AD-1', 'AD-3']);
  assert.deepEqual(normalizeAnnouncementDraftList('not a list'), []);
});

test('plan166: module is pure — no storage, network, or document access', () => {
  const source = readFileSync(join(dir, '..', 'announcement-draft.js'), 'utf8');
  for (const forbidden of ['localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'document.', 'window.']) {
    assert.equal(source.includes(forbidden), false, `module must not use ${forbidden}`);
  }
});

test('plan166: panel element ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['adSummary', 'adExportBtn', 'adPackage', 'adRate', 'adDescription', 'adMohalla', 'adSaveBtn', 'adCopyId', 'adCopyMohalla', 'adCopyBtn', 'adSentId', 'adSentDate', 'adMarkSentBtn', 'adMarkUnsentBtn', 'adRemoveId', 'adRemoveBtn', 'adFilter', 'adMohallaBody', 'adBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
