import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isStrictDate,
  normalizeRetentionRule,
  normalizeRetentionRuleList,
  findRetentionRule,
  findRuleForKind,
  recordRetentionRule,
  removeRetentionRule,
  retentionRulesSorted,
  retentionKinds,
  overdueRetentionRules,
  retentionRuleText,
  retentionRuleSummaryText,
  retentionRuleHtml,
  retentionRuleAllHtml,
  retentionRuleCsv,
  retentionRuleFilename,
} from '../retention-policy.js';

const dir = dirname(fileURLToPath(import.meta.url));

const rule = (over = {}) => ({
  id: 'RP-1',
  kind: 'Bills',
  keepPeriod: '7 years',
  archiveAction: 'Archive to Drive',
  reviewDate: '2027-01-15',
  note: 'Owner review',
  ...over,
});

test('half-formed rules are refused', () => {
  assert.equal(normalizeRetentionRule(null), null);
  assert.equal(normalizeRetentionRule({ kind: 'Bills', keepPeriod: '7 years', archiveAction: 'Archive', reviewDate: '2027-01-15' }), null);
  assert.equal(normalizeRetentionRule(rule({ kind: '' })), null);
  assert.equal(normalizeRetentionRule(rule({ keepPeriod: '' })), null);
  assert.equal(normalizeRetentionRule(rule({ archiveAction: '' })), null);
  assert.equal(normalizeRetentionRule(rule({ reviewDate: '' })), null);
});

test('strict dates: 31-day months, Feb 29 leap and non-leap', () => {
  assert.equal(isStrictDate('2026-08-31'), true);
  assert.equal(isStrictDate('2026-10-31'), true);
  assert.equal(isStrictDate('2026-12-31'), true);
  assert.equal(isStrictDate('2024-02-29'), true);
  assert.equal(isStrictDate('2026-02-29'), false);
  assert.equal(isStrictDate('2026-02-30'), false);
  assert.equal(isStrictDate('2026-13-01'), false);
  assert.equal(isStrictDate('2026-04-31'), false);
  assert.equal(isStrictDate('not-a-date'), false);
  assert.equal(normalizeRetentionRule(rule({ reviewDate: '2026-02-29' })), null);
  assert.ok(normalizeRetentionRule(rule({ reviewDate: '2024-02-29' })));
});

test('unknown fields are dropped', () => {
  const entry = normalizeRetentionRule(rule({ billId: 'B-1', payment: 500, sendNow: true }));
  assert.deepEqual(Object.keys(entry).sort(), ['archiveAction', 'id', 'keepPeriod', 'kind', 'note', 'reviewDate']);
});

test('duplicate ids are never rewritten', () => {
  const list = [rule()];
  assert.deepEqual(recordRetentionRule(list, rule({ keepPeriod: '1 year' })), list);
  assert.equal(recordRetentionRule(list, rule({ id: 'RP-1' })).length, 1);
});

test('one rule per record kind, case-insensitive', () => {
  const list = [rule()];
  assert.equal(recordRetentionRule(list, rule({ id: 'RP-2', kind: 'bills' })).length, 1);
  assert.equal(recordRetentionRule(list, rule({ id: 'RP-2', kind: 'Receipts' })).length, 2);
  assert.equal(findRuleForKind(list, 'BILLS').id, 'RP-1');
  assert.equal(findRuleForKind(list, 'Receipts'), null);
});

test('list normalization drops bad rows and duplicate kinds', () => {
  const list = normalizeRetentionRuleList([rule(), rule({ id: 'RP-2', kind: 'BILLS' }), rule({ id: 'RP-1' }), null, { id: 'RP-3' }]);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'RP-1');
});

test('find and remove', () => {
  const list = [rule(), rule({ id: 'RP-2', kind: 'Receipts', reviewDate: '2027-03-01' })];
  assert.equal(findRetentionRule(list, 'RP-2').kind, 'Receipts');
  assert.equal(findRetentionRule(list, 'RP-9'), null);
  assert.deepEqual(removeRetentionRule(list, 'RP-1').map((item) => item.id), ['RP-2']);
  assert.equal(removeRetentionRule(list, 'RP-9').length, 2);
});

test('rules sort kind A-Z, kinds list keeps first spelling', () => {
  const list = retentionRulesSorted([
    rule({ id: 'RP-2', kind: 'receipts', reviewDate: '2027-03-01' }),
    rule({ id: 'RP-1', kind: 'Bills', reviewDate: '2027-01-15' }),
    rule({ id: 'RP-3', kind: 'Faults', reviewDate: '2027-02-01' }),
  ]);
  assert.deepEqual(list.map((item) => item.kind), ['Bills', 'Faults', 'receipts']);
  assert.deepEqual(retentionKinds([rule({ kind: 'Bills' }), rule({ id: 'RP-2', kind: 'bills' })]), ['Bills']);
});

test('overdue reviews are strictly before today', () => {
  const list = [
    rule({ id: 'RP-1', reviewDate: '2026-11-01' }),
    rule({ id: 'RP-2', kind: 'Receipts', reviewDate: '2026-11-05' }),
    rule({ id: 'RP-3', kind: 'Faults', reviewDate: '2026-11-10' }),
  ];
  assert.deepEqual(overdueRetentionRules(list, '2026-11-05').map((item) => item.id), ['RP-1']);
  assert.deepEqual(overdueRetentionRules(list, 'not-a-date'), []);
});

test('summary text names overdue counts plainly', () => {
  assert.equal(retentionRuleSummaryText([], '2026-11-05'), 'No retention rules recorded');
  assert.equal(retentionRuleSummaryText([rule()], '2026-11-05'), '1 retention rule recorded, none overdue for review');
  assert.equal(
    retentionRuleSummaryText([rule(), rule({ id: 'RP-2', kind: 'Receipts', reviewDate: '2026-11-01' })], '2026-11-05'),
    '2 retention rules recorded, 1 overdue for review',
  );
});

test('rule text states kind, keep period, action, and review date', () => {
  assert.equal(
    retentionRuleText(rule()),
    'Keep Bills for 7 years. Archive action: Archive to Drive. Review by 2027-01-15. Note: Owner review.',
  );
  assert.equal(
    retentionRuleText(rule({ note: '' })),
    'Keep Bills for 7 years. Archive action: Archive to Drive. Review by 2027-01-15.',
  );
  assert.equal(retentionRuleText(null), '');
});

test('html escapes input', () => {
  const html = retentionRuleHtml(rule({ kind: '<Bills & "Co">', note: '<script>' }));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;Bills &amp; &quot;Co&quot;&gt;'));
  assert.equal(retentionRuleHtml(null), '');
  assert.ok(retentionRuleAllHtml([rule()]).includes('Bills'));
});

test('csv and filename', () => {
  const csv = retentionRuleCsv([rule()]);
  assert.ok(csv.startsWith('"id","kind","keepPeriod","archiveAction","reviewDate","note"'));
  assert.ok(csv.includes('"RP-1","Bills","7 years","Archive to Drive","2027-01-15","Owner review"'));
  assert.equal(retentionRuleFilename(), 'retention-rules.csv');
});

test('inputs are never mutated', () => {
  const raw = rule();
  const snapshot = JSON.stringify(raw);
  normalizeRetentionRule(raw);
  recordRetentionRule([], raw);
  assert.equal(JSON.stringify(raw), snapshot);
  const list = [rule()];
  const listSnapshot = JSON.stringify(list);
  recordRetentionRule(list, rule({ id: 'RP-2', kind: 'Receipts' }));
  removeRetentionRule(list, 'RP-1');
  assert.equal(JSON.stringify(list), listSnapshot);
});

test('purity fence: no storage, clock, or network in the module', () => {
  const source = readFileSync(join(dir, '..', 'retention-policy.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('deleteRecord'));
  assert.ok(!source.includes('archiveRecord'));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['rpHeading', 'rpSummary', 'rpExportBtn', 'rpKind', 'rpKeep', 'rpAction', 'rpReview', 'rpNote', 'rpSaveBtn', 'rpRemoveId', 'rpRemoveBtn', 'rpFilter', 'rpBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the retention module and render function', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes("from './retention-policy.js'"));
  assert.ok(app.includes('renderRetentionRules()'));
  assert.ok(app.includes('shahdara_retention_rules_v1'));
});
