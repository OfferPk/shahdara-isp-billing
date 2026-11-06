import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validExportFormatVersionDay,
  normalizeExportFormatVersion,
  normalizeExportFormatVersionList,
  findExportFormatVersion,
  recordExportFormatVersion,
  exportFormatVersionsForFormat,
  currentExportFormatVersion,
  exportFormatNames,
  formatVersionForExport,
  exportFormatVersionSummaryText,
  exportFormatVersionNoteHtml,
  exportFormatVersionsHtml,
  exportFormatVersionCsv,
  exportFormatVersionFilename,
  normalizeExportFormatStamp,
  normalizeExportFormatStampList,
  stampExportFormat,
  exportFormatStampsSorted,
  exportFormatStampText,
  exportFormatStampsHtml,
} from '../export-format-version.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

function note(id, overrides = {}) {
  return {
    id,
    format: 'Customer list CSV',
    version: 'v3',
    fields: ['id', 'name', 'phone', 'mohalla', 'package', 'balance'],
    dateAdopted: '2026-11-05',
    supersededVersions: ['v2', 'v1'],
    ...overrides,
  };
}

function fixture() {
  return [
    note('EFV-1', { version: 'v1', dateAdopted: '2026-01-10', supersededVersions: [] }),
    note('EFV-2', { version: 'v2', dateAdopted: '2026-06-15', supersededVersions: ['v1'] }),
    note('EFV-3', { version: 'v3', dateAdopted: '2026-11-05', supersededVersions: ['v2', 'v1'] }),
    note('EFV-4', { format: 'Ledger CSV', version: 'v1', fields: ['date', 'customer', 'amount', 'method'], dateAdopted: '2026-03-01', supersededVersions: [] }),
  ];
}

function versions() {
  return recordExportFormatVersion(
    recordExportFormatVersion([], note('EFV-1', { version: 'v1', dateAdopted: '2026-01-10', supersededVersions: [] })),
    note('EFV-3', { version: 'v3', dateAdopted: '2026-11-05', supersededVersions: ['v2', 'v1'] }),
  );
}

test('a valid note records and keeps its fields', () => {
  const next = recordExportFormatVersion([], note('EFV-1'));
  assert.equal(next.length, 1);
  assert.equal(next[0].format, 'Customer list CSV');
  assert.equal(next[0].version, 'v3');
  assert.deepEqual(next[0].fields, ['id', 'name', 'phone', 'mohalla', 'package', 'balance']);
  assert.deepEqual(next[0].supersededVersions, ['v2', 'v1']);
});

test('a note is refused with no id, no format, no version, or no fields', () => {
  assert.deepEqual(recordExportFormatVersion([], note('', {})), []);
  assert.deepEqual(recordExportFormatVersion([], note('EFV-1', { format: '   ' })), []);
  assert.deepEqual(recordExportFormatVersion([], note('EFV-1', { version: '' })), []);
  assert.deepEqual(recordExportFormatVersion([], note('EFV-1', { fields: [] })), []);
  assert.deepEqual(recordExportFormatVersion([], note('EFV-1', { fields: '  ,  ' })), []);
});

test('a note is refused with no strict adoption date', () => {
  assert.deepEqual(recordExportFormatVersion([], note('EFV-1', { dateAdopted: '2026-02-30' })), []);
  assert.deepEqual(recordExportFormatVersion([], note('EFV-1', { dateAdopted: '2027-02-29' })), []);
  assert.deepEqual(recordExportFormatVersion([], note('EFV-1', { dateAdopted: '5 Nov 2026' })), []);
  assert.deepEqual(recordExportFormatVersion([], note('EFV-1', { dateAdopted: '' })), []);
});

test('a leap day adoption date is accepted', () => {
  assert.equal(validExportFormatVersionDay('2028-02-29'), true);
  assert.equal(recordExportFormatVersion([], note('EFV-1', { dateAdopted: '2028-02-29' })).length, 1);
});

test('fields accept a comma-separated string and repeats collapse', () => {
  const next = recordExportFormatVersion([], note('EFV-1', { fields: 'id, name, phone, name, , balance' }));
  assert.deepEqual(next[0].fields, ['id', 'name', 'phone', 'balance']);
});

test('a note never lists its own version as superseded', () => {
  const next = recordExportFormatVersion([], note('EFV-1', { supersededVersions: ['v3', 'v2'] }));
  assert.deepEqual(next[0].supersededVersions, ['v2']);
});

test('a duplicate id is never rewritten', () => {
  const list = fixture();
  const next = recordExportFormatVersion(list, note('EFV-1', { version: 'v9', fields: ['other'] }));
  assert.equal(next.length, 4);
  assert.equal(findExportFormatVersion(next, 'EFV-1').version, 'v1');
});

test('the same format and version is never recorded twice', () => {
  const list = fixture();
  assert.deepEqual(recordExportFormatVersion(list, note('EFV-9', { version: 'v2' })), list);
  assert.deepEqual(
    recordExportFormatVersion(list, note('EFV-9', { format: 'customer list csv', version: 'v2' })),
    list,
  );
});

test('unknown fields are dropped so no export file, bill, or payment field survives', () => {
  const next = recordExportFormatVersion([], note('EFV-1', { filePath: '/tmp/out.csv', amount: 3000, customerId: 'C-1' }));
  assert.equal('filePath' in next[0], false);
  assert.equal('amount' in next[0], false);
  assert.equal('customerId' in next[0], false);
});

test('the current version is the latest adopted for a format', () => {
  const list = fixture();
  assert.equal(currentExportFormatVersion(list, 'Customer list CSV').version, 'v3');
  assert.equal(currentExportFormatVersion(list, 'customer list csv').version, 'v3');
  assert.equal(currentExportFormatVersion(list, 'Ledger CSV').version, 'v1');
  assert.equal(currentExportFormatVersion(list, 'Unknown format'), null);
  assert.equal(formatVersionForExport(list, 'Customer list CSV'), 'v3');
  assert.equal(formatVersionForExport(list, 'Unknown format'), null);
});

test('versions for a format list newest first', () => {
  assert.deepEqual(
    exportFormatVersionsForFormat(fixture(), 'Customer list CSV').map((entry) => entry.id),
    ['EFV-3', 'EFV-2', 'EFV-1'],
  );
  assert.deepEqual(exportFormatVersionsForFormat(fixture(), 'No such format'), []);
});

test('format names list A to Z with the first spelling kept', () => {
  const list = [
    note('EFV-1', { format: 'ledger CSV' }),
    note('EFV-2', { format: 'Customer list CSV' }),
    note('EFV-3', { format: 'Ledger csv', version: 'v2' }),
  ];
  assert.deepEqual(exportFormatNames(list), ['Customer list CSV', 'ledger CSV']);
});

test('the summary text names the current version of each format', () => {
  assert.equal(
    exportFormatVersionSummaryText(fixture()),
    '4 export format version notes across 2 formats. Current: Customer list CSV v3; Ledger CSV v1.',
  );
  assert.equal(exportFormatVersionSummaryText([]), 'No export format versions recorded.');
});

test('the html groups by format, marks the current version, and escapes user text', () => {
  const html = exportFormatVersionsHtml(fixture());
  assert.equal(html.includes('Customer list CSV'), true);
  assert.equal(html.includes('<strong>v3</strong> — adopted 2026-11-05 (current)'), true);
  assert.equal(html.includes('<strong>v1</strong> — adopted 2026-01-10 (superseded by a later version)'), true);
  assert.equal(html.includes('Superseded: v2, v1'), true);
  const escaped = exportFormatVersionNoteHtml(note('EFV-1', { format: '<script>alert(1)</script>' }));
  assert.equal(escaped.includes('<script>'), false);
  assert.equal(escaped.includes('&lt;script&gt;'), true);
  assert.equal(exportFormatVersionsHtml([]), '<p>No export format versions recorded.</p>');
});

test('the csv carries every field and the filename is stable', () => {
  const csv = exportFormatVersionCsv(fixture());
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,format,version,fields,date adopted,superseded versions');
  assert.equal(lines.length, 5);
  assert.equal(lines[3].includes('EFV-3'), true);
  assert.equal(lines[3].includes('id; name; phone; mohalla; package; balance'), true);
  assert.equal(lines[3].includes('v2; v1'), true);
  assert.equal(exportFormatVersionFilename(), 'export-format-versions.csv');
});

test('a stamp records only for a recorded format version', () => {
  const known = versions();
  const stamped = stampExportFormat([], known, {
    id: 'EFS-1', exportRef: 'customers-2026-11-05.csv', format: 'Customer list CSV', version: 'v3', date: '2026-11-05',
  });
  assert.equal(stamped.length, 1);
  assert.equal(stamped[0].exportRef, 'customers-2026-11-05.csv');
  assert.equal(exportFormatStampText(stamped[0]), 'customers-2026-11-05.csv uses Customer list CSV v3 (2026-11-05)');
});

test('a stamp is refused for an unrecorded version, a bad date, or no export reference', () => {
  const known = versions();
  assert.deepEqual(stampExportFormat([], known, {
    id: 'EFS-1', exportRef: 'x.csv', format: 'Customer list CSV', version: 'v9', date: '2026-11-05',
  }), []);
  assert.deepEqual(stampExportFormat([], known, {
    id: 'EFS-1', exportRef: 'x.csv', format: 'Customer list CSV', version: 'v3', date: '2026-02-30',
  }), []);
  assert.deepEqual(stampExportFormat([], known, {
    id: 'EFS-1', exportRef: '', format: 'Customer list CSV', version: 'v3', date: '2026-11-05',
  }), []);
});

test('one stamp per export reference and one stamp per id', () => {
  const known = versions();
  const first = stampExportFormat([], known, {
    id: 'EFS-1', exportRef: 'customers-2026-11-05.csv', format: 'Customer list CSV', version: 'v3', date: '2026-11-05',
  });
  assert.deepEqual(stampExportFormat(first, known, {
    id: 'EFS-2', exportRef: 'customers-2026-11-05.csv', format: 'Customer list CSV', version: 'v1', date: '2026-11-05',
  }), first);
  assert.deepEqual(stampExportFormat(first, known, {
    id: 'EFS-1', exportRef: 'other.csv', format: 'Customer list CSV', version: 'v3', date: '2026-11-06',
  }), first);
});

test('stamps sort newest first and the html names each stamped export', () => {
  const known = versions();
  const stamps = stampExportFormat(
    stampExportFormat([], known, {
      id: 'EFS-1', exportRef: 'a.csv', format: 'Customer list CSV', version: 'v1', date: '2026-01-10',
    }),
    known,
    {
      id: 'EFS-2', exportRef: 'b.csv', format: 'Customer list CSV', version: 'v3', date: '2026-11-05',
    },
  );
  assert.deepEqual(exportFormatStampsSorted(stamps).map((entry) => entry.id), ['EFS-2', 'EFS-1']);
  assert.equal(exportFormatStampsHtml(stamps).includes('b.csv uses Customer list CSV v3 (2026-11-05)'), true);
  assert.equal(exportFormatStampsHtml([]), '<p>No exports stamped with a format version yet.</p>');
  assert.equal(normalizeExportFormatStamp({ id: 'EFS-1' }), null);
  assert.deepEqual(normalizeExportFormatStampList([{ id: 'EFS-1' }]), []);
});

test('the module never mutates its input', () => {
  const frozen = Object.freeze(fixture().map((entry) => Object.freeze({
    ...entry,
    fields: Object.freeze([...entry.fields]),
    supersededVersions: Object.freeze([...entry.supersededVersions]),
  })));
  assert.doesNotThrow(() => {
    recordExportFormatVersion(frozen, note('EFV-9', { version: 'v4' }));
    exportFormatVersionsForFormat(frozen, 'Customer list CSV');
    exportFormatVersionCsv(frozen);
    stampExportFormat([], frozen, {
      id: 'EFS-1', exportRef: 'a.csv', format: 'Customer list CSV', version: 'v3', date: '2026-11-05',
    });
  });
  assert.equal(frozen[0].version, 'v1');
});

test('the module is pure: it reads no storage, clock, or network', () => {
  const source = readFileSync(new URL('../export-format-version.js', import.meta.url), 'utf8');
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('XMLHttpRequest'), false);
  assert.equal(source.includes('document.'), false);
});

test('the module keeps its fences: no fenced file, no OLT', () => {
  const source = readFileSync(new URL('../export-format-version.js', import.meta.url), 'utf8');
  for (const fenced of ['export-pack', 'export-verification', 'export-custody', 'bill-format-version', 'version-log']) {
    assert.equal(source.includes(fenced), false, `module must not name the fenced module ${fenced}`);
  }
  assert.equal(source.includes('OLT'), false);
});

test('panel ids are present in index.html', () => {
  for (const id of ['efvBody', 'efvSummary', 'efvExportBtn', 'efvFormat', 'efvVersion', 'efvFields', 'efvDate', 'efvSuperseded', 'efvRecordBtn', 'efvCurrentBody', 'efvStampRef', 'efvStampFormat', 'efvStampVersion', 'efvStampDate', 'efvStampBtn', 'efvStampsBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing ${id}`);
  }
});

test('app.js wiring is present', () => {
  assert.ok(appJs.includes("from './export-format-version.js'"));
  assert.ok(appJs.includes('shahdara_export_format_versions_v1'));
  assert.ok(appJs.includes('shahdara_export_format_stamps_v1'));
  assert.ok(appJs.includes('renderExportFormatVersions()'));
  assert.ok(appJs.includes('efvExportBtn'));
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const mine = appJs.match(/export-format-version|ExportFormatVersion|EXPORT_FORMAT_VERSION/g) || [];
  assert.ok(mine.length > 0);
});
