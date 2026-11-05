import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validPrintTemplateDay,
  normalizePrintTemplate,
  normalizePrintTemplateList,
  findPrintTemplate,
  recordPrintTemplate,
  supersedePrintTemplate,
  printTemplateCurrentVersion,
  printTemplatesForName,
  printTemplatesByName,
  printTemplateNamesWithEntries,
  printTemplateSummaryText,
  printTemplateEntryText,
  printTemplateEntryHtml,
  printTemplatesByNameHtml,
  printTemplateAllHtml,
  printTemplateCsv,
  printTemplateFilename,
} from '../print-template-register.js';

const first = {
  id: 'PT-1',
  name: 'Customer info sheet',
  purpose: 'One-page sheet for a new customer with package and payment details',
  version: 'v1',
  date: '2026-11-01',
  serves: ['New customer onboarding', 'Info sheet printout'],
};
const second = {
  id: 'PT-2',
  name: 'Urdu receipt',
  purpose: 'Receipt printed in Urdu script after a payment',
  version: 'v2',
  date: '2026-11-03',
  serves: 'Payment receipt, Urdu receipt printout',
};
const third = {
  id: 'PT-3',
  name: 'customer info sheet',
  purpose: 'One-page sheet for a new customer with package and payment details',
  version: 'v2',
  date: '2026-11-04',
  serves: ['New customer onboarding'],
};

test('strict dates accept real calendar days and refuse the rest', () => {
  assert.equal(validPrintTemplateDay('2026-11-01'), true);
  assert.equal(validPrintTemplateDay('2028-02-29'), true);
  assert.equal(validPrintTemplateDay('2027-02-29'), false);
  assert.equal(validPrintTemplateDay('2026-04-31'), false);
  assert.equal(validPrintTemplateDay('2026-13-01'), false);
  assert.equal(validPrintTemplateDay('2026-11-1'), false);
  assert.equal(validPrintTemplateDay('01-11-2026'), false);
  assert.equal(validPrintTemplateDay(''), false);
  assert.equal(validPrintTemplateDay(null), false);
});

test('normalize refuses an entry missing id, name, purpose, version, or a strict date', () => {
  assert.equal(normalizePrintTemplate({ ...first, id: '' }), null);
  assert.equal(normalizePrintTemplate({ ...first, name: '  ' }), null);
  assert.equal(normalizePrintTemplate({ ...first, purpose: '' }), null);
  assert.equal(normalizePrintTemplate({ ...first, version: '' }), null);
  assert.equal(normalizePrintTemplate({ ...first, date: '2026-02-30' }), null);
  assert.equal(normalizePrintTemplate(null), null);
  assert.equal(normalizePrintTemplate([first]), null);
});

test('normalize drops unknown fields, so no bill, payment, or customer field can survive', () => {
  const entry = normalizePrintTemplate({
    ...first,
    amount: 3000,
    customerId: 'CUST-1',
    billMonth: '2026-11',
    extra: 'nope',
  });
  assert.deepEqual(entry, {
    id: 'PT-1',
    name: 'Customer info sheet',
    purpose: 'One-page sheet for a new customer with package and payment details',
    version: 'v1',
    date: '2026-11-01',
    serves: ['New customer onboarding', 'Info sheet printout'],
    status: 'current',
    supersededBy: '',
  });
});

test('serves accepts an array or a comma-separated string, and may be empty', () => {
  assert.deepEqual(normalizePrintTemplate({ ...first, serves: ['A', '  ', 'B'] }).serves, ['A', 'B']);
  assert.deepEqual(normalizePrintTemplate({ ...second }).serves, ['Payment receipt', 'Urdu receipt printout']);
  assert.deepEqual(normalizePrintTemplate({ ...first, serves: undefined }).serves, []);
  assert.deepEqual(normalizePrintTemplate({ ...first, serves: 42 }).serves, []);
});

test('status folds to current unless it literally reads superseded', () => {
  assert.equal(normalizePrintTemplate({ ...first, status: 'superseded' }).status, 'superseded');
  assert.equal(normalizePrintTemplate({ ...first, status: 'SUPERSEDED' }).status, 'superseded');
  assert.equal(normalizePrintTemplate({ ...first, status: 'old' }).status, 'current');
  assert.equal(normalizePrintTemplate({ ...first }).status, 'current');
  assert.equal(normalizePrintTemplate({ ...first, status: 'current', supersededBy: 'PT-9' }).supersededBy, '');
});

test('normalize list drops half-formed entries and never rewrites a duplicate id', () => {
  const list = normalizePrintTemplateList([first, { ...first, version: 'v9' }, second, { ...first, id: '' }]);
  assert.deepEqual(list.map((entry) => entry.id), ['PT-1', 'PT-2']);
  assert.equal(list[0].version, 'v1');
  assert.deepEqual(normalizePrintTemplateList('nope'), []);
});

test('find returns the entry by id and null for a missing id', () => {
  assert.equal(findPrintTemplate([first, second], 'PT-2').name, 'Urdu receipt');
  assert.equal(findPrintTemplate([first, second], 'PT-9'), null);
  assert.equal(findPrintTemplate([first, second], ''), null);
});

test('record adds a good entry and refuses a half-formed one or a duplicate id', () => {
  assert.equal(recordPrintTemplate([first], second).length, 2);
  assert.equal(recordPrintTemplate([first], { ...second, date: 'bad' }).length, 1);
  assert.equal(recordPrintTemplate([first], { ...first, version: 'v9' }).length, 1);
  assert.equal(recordPrintTemplate([first], { ...first, version: 'v9' })[0].version, 'v1');
});

test('supersede changes only that entry and the superseded entry stays listed, never deleted', () => {
  const list = [first, second, third];
  const next = supersedePrintTemplate(list, 'PT-1', 'PT-3');
  assert.equal(next.length, 3);
  assert.equal(next[0].status, 'superseded');
  assert.equal(next[0].supersededBy, 'PT-3');
  assert.equal(next[1].status, 'current');
  assert.equal(next[2].status, 'current');
  assert.equal(findPrintTemplate(list, 'PT-1').status, 'current');
});

test('supersede refuses an unknown id, a blank id, and an already-superseded entry', () => {
  const list = [first, second];
  const clean = normalizePrintTemplateList(list);
  assert.deepEqual(supersedePrintTemplate(list, 'PT-9', 'PT-2'), clean);
  assert.deepEqual(supersedePrintTemplate(list, '', 'PT-2'), clean);
  const once = supersedePrintTemplate(list, 'PT-1', 'PT-2');
  const twice = supersedePrintTemplate(once, 'PT-1', 'PT-2');
  assert.equal(twice[0].supersededBy, 'PT-2');
  assert.deepEqual(twice, once);
});

test('current version is the latest adopted current entry for a name, superseded entries never count', () => {
  assert.equal(printTemplateCurrentVersion([first, second, third], 'Customer info sheet'), 'v2');
  assert.equal(printTemplateCurrentVersion([first, second, third], 'CUSTOMER INFO SHEET'), 'v2');
  assert.equal(printTemplateCurrentVersion([first, second], 'Urdu receipt'), 'v2');
  assert.equal(printTemplateCurrentVersion([first, second], 'No such template'), null);
  assert.equal(printTemplateCurrentVersion([first, second], ''), null);
  const superseded = supersedePrintTemplate([first, third], 'PT-3', 'PT-9');
  assert.equal(printTemplateCurrentVersion(superseded, 'customer info sheet'), 'v1');
  const allSuperseded = supersedePrintTemplate(superseded, 'PT-1', 'PT-3');
  assert.equal(printTemplateCurrentVersion(allSuperseded, 'customer info sheet'), null);
});

test('entries for one name list in adoption date order, case-insensitively', () => {
  const found = printTemplatesForName([third, first, second], 'CUSTOMER info sheet');
  assert.deepEqual(found.map((entry) => entry.id), ['PT-1', 'PT-3']);
  assert.deepEqual(printTemplatesForName([first], ''), []);
});

test('entries group by template name A-Z with entries in adoption date order', () => {
  const groups = printTemplatesByName([second, first, third]);
  assert.deepEqual(groups.map((group) => group.name), ['Customer info sheet', 'Urdu receipt']);
  assert.deepEqual(groups[0].items.map((entry) => entry.id), ['PT-1', 'PT-3']);
  assert.deepEqual(printTemplateNamesWithEntries([second, first]), ['Customer info sheet', 'Urdu receipt']);
});

test('summary text counts templates, current versions, and superseded versions in plain words', () => {
  assert.equal(printTemplateSummaryText([]), 'No print templates registered.');
  assert.equal(
    printTemplateSummaryText([first, second, third]),
    '2 print templates registered: 3 current versions, 0 superseded versions.',
  );
  assert.equal(
    printTemplateSummaryText(supersedePrintTemplate([first, second], 'PT-1', 'PT-3')),
    '2 print templates registered: 1 current version, 1 superseded version.',
  );
});

test('entry text names the version, adoption date, purpose, and served sheets', () => {
  assert.equal(
    printTemplateEntryText(first),
    '2026-11-01 — Customer info sheet v1: One-page sheet for a new customer with package and payment details — serves New customer onboarding, Info sheet printout.',
  );
  assert.equal(
    printTemplateEntryText({ ...first, serves: [] }),
    '2026-11-01 — Customer info sheet v1: One-page sheet for a new customer with package and payment details.',
  );
  assert.equal(printTemplateEntryText({ ...first, status: 'superseded' }).endsWith('(superseded).'), true);
  assert.equal(printTemplateEntryText(null), '');
});

test('html escapes user text so a template name can never break the page', () => {
  const nasty = { ...first, name: '<script>alert(1)</script>', purpose: 'A & B <test>' };
  const html = printTemplateEntryHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('A &amp; B'), true);
  assert.equal(printTemplateEntryHtml(null), '');
  assert.equal(printTemplatesByNameHtml([]), '<p>No print templates registered.</p>');
  assert.equal(printTemplateAllHtml([]), '<p>No print templates registered.</p>');
  assert.equal(printTemplatesByNameHtml([second, first]).includes('<h4>Customer info sheet</h4>'), true);
});

test('csv lists entries by name then date with a stable header', () => {
  const csv = printTemplateCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,name,purpose,version,date,serves,status,supersededBy');
  assert.equal(lines[1].startsWith('PT-1,Customer info sheet,'), true);
  assert.equal(lines[2].startsWith('PT-2,Urdu receipt,'), true);
  assert.equal(printTemplateCsv([]), 'id,name,purpose,version,date,serves,status,supersededBy');
  assert.equal(printTemplateFilename(), 'print-templates.csv');
});

test('recording and superseding never mutate the input list', () => {
  const list = [first, second];
  const before = JSON.stringify(list);
  recordPrintTemplate(list, third);
  supersedePrintTemplate(list, 'PT-1', 'PT-3');
  assert.equal(JSON.stringify(list), before);
});

test('the module is pure: it reads no storage, clock, or network', () => {
  const source = readFileSync(new URL('../print-template-register.js', import.meta.url), 'utf8');
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('XMLHttpRequest'), false);
});
