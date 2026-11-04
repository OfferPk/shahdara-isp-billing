import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeTaxPack,
  normalizeTaxPackList,
  findTaxPack,
  recordTaxPack,
  removeTaxPack,
  markTaxFigure,
  taxPackFigures,
  figuresByStatus,
  incompleteFigures,
  taxPackStatus,
  taxPackStatusText,
  taxPacksSorted,
  taxPackStarters,
  taxPackSummaryText,
  taxPackText,
  taxPackHtml,
  taxPackCsv,
  taxPackFilename,
} from '../tax-figures.js';

const dir = dirname(fileURLToPath(import.meta.url));

const pack = (over = {}) => ({
  id: 'TF-1',
  name: 'Tax-season figures',
  period: '2025-26',
  figures: [
    { figure: 'Total collections', source: 'Owner Khata report', status: 'ready', note: '' },
    { figure: 'Total expenses', source: 'Expense ledger', status: 'missing', note: 'Ask accountant' },
  ],
  ...over,
});

test('half-formed packs and figures are refused', () => {
  assert.equal(normalizeTaxPack(null), null);
  assert.equal(normalizeTaxPack({ name: 'X', period: '2025-26', figures: [{ figure: 'A', source: 'S' }] }), null);
  assert.equal(normalizeTaxPack({ id: 'TF-1', period: '2025-26', figures: [{ figure: 'A', source: 'S' }] }), null);
  assert.equal(normalizeTaxPack({ id: 'TF-1', name: 'X', figures: [{ figure: 'A', source: 'S' }] }), null);
  assert.equal(normalizeTaxPack({ id: 'TF-1', name: 'X', period: '2025-26', figures: [] }), null);
  assert.equal(normalizeTaxPack({ id: 'TF-1', name: 'X', period: '2025-26', figures: [{ source: 'S' }] }), null);
  assert.equal(normalizeTaxPack({ id: 'TF-1', name: 'X', period: '2025-26', figures: 'not-a-list' }), null);
});

test('unknown statuses fall back to missing, never ready', () => {
  const entry = normalizeTaxPack(pack({
    figures: [
      { figure: 'A', source: 'S', status: 'done' },
      { figure: 'B', source: 'S', status: 'READY' },
      { figure: 'C', source: 'S' },
    ],
  }));
  assert.equal(entry.figures[0].status, 'missing');
  assert.equal(entry.figures[1].status, 'ready');
  assert.equal(entry.figures[2].status, 'missing');
});

test('unknown fields are dropped from packs and figures', () => {
  const entry = normalizeTaxPack(pack({
    amount: 5000,
    total: 99,
    figures: [{ figure: 'A', source: 'S', status: 'ready', taxDue: 100, customerId: 'C1' }],
  }));
  assert.equal('amount' in entry, false);
  assert.equal('total' in entry, false);
  assert.equal('taxDue' in entry.figures[0], false);
  assert.equal('customerId' in entry.figures[0], false);
});

test('duplicate pack ids are never rewritten', () => {
  const first = recordTaxPack([], pack());
  const same = recordTaxPack(first, pack());
  assert.equal(same.length, 1);
  const changed = recordTaxPack(first, pack({ name: 'Changed name' }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].name, 'Tax-season figures');
});

test('duplicate figure names inside a pack keep only the first', () => {
  const entry = normalizeTaxPack(pack({
    figures: [
      { figure: 'Total collections', source: 'Owner Khata report', status: 'ready' },
      { figure: 'total COLLECTIONS', source: 'Other report', status: 'missing' },
    ],
  }));
  assert.equal(entry.figures.length, 1);
  assert.equal(entry.figures[0].source, 'Owner Khata report');
});

test('find and remove work case-insensitively', () => {
  const list = recordTaxPack([], pack());
  assert.equal(findTaxPack(list, 'tf-1').name, 'Tax-season figures');
  assert.equal(findTaxPack(list, 'TF-9'), null);
  assert.equal(removeTaxPack(list, 'TF-1').length, 0);
  assert.equal(removeTaxPack(list, '').length, 1);
});

test('marking a figure changes only its status', () => {
  const list = recordTaxPack([], pack());
  const marked = markTaxFigure(list, 'TF-1', 'Total expenses', 'ready');
  assert.equal(marked[0].figures[1].status, 'ready');
  assert.equal(marked[0].figures[0].status, 'ready');
  assert.equal(marked[0].figures[1].note, 'Ask accountant');
  const unknown = markTaxFigure(list, 'TF-1', 'No such figure', 'ready');
  assert.deepEqual(unknown, list);
  const badStatus = markTaxFigure(list, 'TF-1', 'Total collections', 'done');
  assert.equal(badStatus[0].figures[0].status, 'missing');
});

test('status views split ready from missing', () => {
  assert.equal(figuresByStatus(pack(), 'ready').length, 1);
  assert.equal(figuresByStatus(pack(), 'missing').length, 1);
  assert.equal(figuresByStatus(pack(), 'done').length, 1);
  assert.equal(taxPackFigures(null).length, 0);
});

test('a pack is complete only when every figure is ready with a source', () => {
  assert.equal(taxPackStatus(pack()), 'incomplete');
  const ready = pack({ figures: [{ figure: 'A', source: 'S', status: 'ready' }] });
  assert.equal(taxPackStatus(ready), 'complete');
  const sourceless = pack({ figures: [{ figure: 'A', source: '', status: 'ready' }] });
  assert.equal(taxPackStatus(sourceless), 'incomplete');
  assert.equal(taxPackStatus(null), 'incomplete');
  assert.equal(incompleteFigures(pack()).length, 1);
});

test('incomplete packs are plainly marked, naming what is missing', () => {
  const text = taxPackStatusText(pack());
  assert.match(text, /Incomplete pack/);
  assert.match(text, /Total expenses/);
  const sourceless = taxPackStatusText(pack({ figures: [{ figure: 'A', source: '', status: 'ready' }] }));
  assert.match(sourceless, /No source named: A/);
  const complete = taxPackStatusText(pack({ figures: [{ figure: 'A', source: 'S', status: 'ready' }] }));
  assert.match(complete, /Complete pack/);
});

test('packs sort by period then name', () => {
  const sorted = taxPacksSorted([
    pack({ id: 'TF-2', name: 'B pack', period: '2026-27' }),
    pack({ id: 'TF-1', name: 'A pack', period: '2025-26' }),
    pack({ id: 'TF-3', name: 'C pack', period: '2025-26' }),
  ]);
  assert.deepEqual(sorted.map((entry) => entry.id), ['TF-1', 'TF-3', 'TF-2']);
});

test('starter pack starts plainly incomplete', () => {
  const starters = taxPackStarters();
  assert.equal(starters.length, 1);
  assert.equal(starters[0].id, 'TF-DEFAULT');
  assert.ok(starters[0].figures.length >= 4);
  assert.equal(taxPackStatus(starters[0]), 'incomplete');
  const twice = recordTaxPack(recordTaxPack([], starters[0]), starters[0]);
  assert.equal(twice.length, 1);
});

test('summary counts packs and complete packs', () => {
  assert.equal(taxPackSummaryText([]), '0 tax packs, 0 complete');
  const list = recordTaxPack([], pack());
  assert.equal(taxPackSummaryText(list), '1 tax pack, 0 complete');
  const ready = recordTaxPack([], pack({ figures: [{ figure: 'A', source: 'S', status: 'ready' }] }));
  assert.equal(taxPackSummaryText(ready), '1 tax pack, 1 complete');
});

test('pack text lists every figure with source and status', () => {
  const text = taxPackText(pack());
  assert.match(text, /Tax figures pack — Tax-season figures \(2025-26\)/);
  assert.match(text, /Total collections — ready\. Source report: Owner Khata report\./);
  assert.match(text, /Total expenses — missing\. Source report: Expense ledger\. Note: Ask accountant/);
  assert.equal(taxPackText(null), '');
});

test('html escapes user text', () => {
  const html = taxPackHtml(pack({ name: '<b>Tax</b>', figures: [{ figure: 'A<script>', source: 'S & co', status: 'ready', note: '' }] }));
  assert.ok(!html.includes('<b>Tax</b>'));
  assert.ok(html.includes('&lt;b&gt;Tax&lt;/b&gt;'));
  assert.ok(html.includes('A&lt;script&gt;'));
  assert.ok(html.includes('S &amp; co'));
  assert.equal(taxPackHtml(null), '');
});

test('csv and filename cover every figure', () => {
  const csv = taxPackCsv([pack()]);
  assert.ok(csv.startsWith('id,name,period,figure,source,status,note'));
  assert.ok(csv.includes('"TF-1","Tax-season figures","2025-26","Total collections","Owner Khata report","ready",""'));
  assert.equal(taxPackFilename(), 'tax-figures.csv');
});

test('inputs are never mutated', () => {
  const raw = pack();
  const snapshot = JSON.stringify(raw);
  normalizeTaxPack(raw);
  recordTaxPack([], raw);
  markTaxFigure([raw], 'TF-1', 'Total expenses', 'ready');
  assert.equal(JSON.stringify(raw), snapshot);
});

test('list normalization drops bad entries and duplicate ids', () => {
  const list = normalizeTaxPackList([pack(), null, pack({ name: 'Other' }), 'junk']);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Tax-season figures');
});

test('module stays pure: no storage, clock, or network reads', () => {
  const source = readFileSync(join(dir, '..', 'tax-figures.js'), 'utf8');
  for (const token of ['localStorage', 'fetch(', 'XMLHttpRequest', 'new Date(', 'Date.now(']) {
    assert.ok(!source.includes(token), `purity fence tripped on ${token}`);
  }
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['tfHeading', 'tfSummary', 'tfName', 'tfPeriod', 'tfFigures', 'tfSaveBtn', 'tfStarterBtn', 'tfMarkPackId', 'tfMarkFigure', 'tfMarkStatus', 'tfMarkBtn', 'tfRemoveId', 'tfRemoveBtn', 'tfExportBtn', 'tfBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the tax-figures store', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes("from './tax-figures.js'"));
  assert.ok(app.includes('shahdara_tax_figures_v1'));
  assert.ok(app.includes('renderTaxFigures'));
});
