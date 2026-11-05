import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validSpliceLossDate,
  normalizeSpliceLossList,
  recordSpliceLoss,
  removeSpliceLoss,
  findSpliceLoss,
  spliceLossSorted,
  spliceLossForJoint,
  spliceLossLatest,
  spliceLossJoints,
  spliceLossSummaryText,
  spliceLossText,
  spliceLossJointText,
  spliceLossHtml,
  spliceLossCsv,
  spliceLossFilename,
} from '../splice-loss.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'splice-loss.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const n1 = { id: 'SL-1', jointRef: 'JNT-A', date: '2026-03-02', loss: '0.25 dB', instrument: 'OTDR-2', technician: 'Saad' };
const n2 = { id: 'SL-2', jointRef: 'JNT-A', date: '2026-03-10', loss: '0.31 dB', instrument: '', technician: 'Saad' };
const n3 = { id: 'SL-3', jointRef: 'JNT-B', date: '2026-02-15', loss: '0.18 dB', instrument: 'Power meter', technician: '' };

test('half-formed refusal, including no joint reference, no date, and no loss reading', () => {
  assert.equal(recordSpliceLoss([], { jointRef: 'JNT-X', date: '2026-03-01', loss: '0.2 dB' }), null);
  assert.equal(recordSpliceLoss([], { id: 'SL-x', date: '2026-03-01', loss: '0.2 dB' }), null);
  assert.equal(recordSpliceLoss([], { id: 'SL-x', jointRef: 'JNT-X', loss: '0.2 dB' }), null);
  assert.equal(recordSpliceLoss([], { id: 'SL-x', jointRef: 'JNT-X', date: '2026-03-01' }), null);
  assert.equal(recordSpliceLoss([], { id: 'SL-x', jointRef: 'JNT-X', date: '2026-03-01', loss: '' }), null);
});

test('strict dates, including the leap-day rule', () => {
  assert.equal(validSpliceLossDate('2026-02-30'), false);
  assert.equal(validSpliceLossDate('2024-02-29'), true);
  assert.equal(validSpliceLossDate('2026-02-29'), false);
  assert.equal(validSpliceLossDate('2026-13-01'), false);
  assert.equal(recordSpliceLoss([], { ...n1, date: '2026-02-30' }), null);
  assert.notEqual(recordSpliceLoss([], { ...n1, date: '2024-02-29' }), null);
});

test('unknown-field drop and non-mutation', () => {
  const input = { ...n1, billTotal: 5000, faultId: 'F-9' };
  const next = recordSpliceLoss([], input);
  assert.equal(next.length, 1);
  assert.equal('billTotal' in next[0], false);
  assert.equal('faultId' in next[0], false);
  assert.equal(input.billTotal, 5000);
  assert.deepEqual(normalizeSpliceLossList([n1, { ...n2, id: 'SL-1' }]).length, 1);
});

test('duplicate id rule', () => {
  const one = recordSpliceLoss([], n1);
  assert.equal(recordSpliceLoss(one, { ...n2, id: 'SL-1' }), null);
  assert.equal(normalizeSpliceLossList([n1, { ...n2, id: 'SL-1' }]).length, 1);
});

test('find and remove', () => {
  const list = recordSpliceLoss(recordSpliceLoss([], n1), n2);
  assert.equal(findSpliceLoss(list, 'SL-2').loss, '0.31 dB');
  assert.equal(findSpliceLoss(list, 'SL-9'), null);
  assert.equal(findSpliceLoss(list, ''), null);
  assert.equal(removeSpliceLoss(list, 'SL-1').length, 1);
  assert.equal(removeSpliceLoss(list, 'SL-9').length, 2);
  assert.equal(removeSpliceLoss(list, '').length, 2);
});

test('notes for one joint list in date order', () => {
  const sorted = spliceLossSorted([n2, n3, n1]);
  assert.deepEqual(sorted.map((item) => item.id), ['SL-1', 'SL-2', 'SL-3']);
  assert.deepEqual(spliceLossForJoint([n2, n3, n1], 'JNT-A').map((item) => item.id), ['SL-1', 'SL-2']);
  assert.deepEqual(spliceLossForJoint([n2, n3, n1], 'JNT-Z'), []);
  assert.deepEqual(spliceLossForJoint([n2, n3, n1], ''), []);
});

test('latest reading alongside earlier ones', () => {
  const list = [n2, n3, n1];
  assert.equal(spliceLossLatest(list, 'JNT-A').id, 'SL-2');
  assert.equal(spliceLossLatest(list, 'JNT-B').id, 'SL-3');
  assert.equal(spliceLossLatest(list, 'JNT-Z'), null);
  const jointText = spliceLossJointText(list, 'JNT-A');
  assert.match(jointText, /latest reading: 0\.31 dB on 2026-03-10/);
  assert.match(jointText, /Earlier readings: 0\.25 dB on 2026-03-02/);
  assert.equal(spliceLossJointText([n3], 'JNT-B'), 'Joint JNT-B — latest reading: 0.18 dB on 2026-02-15.');
  assert.equal(spliceLossJointText(list, 'JNT-Z'), 'No loss notes for JNT-Z.');
});

test('a newer note never rewrites an earlier note', () => {
  const before = recordSpliceLoss([], n1);
  const after = recordSpliceLoss(before, n2);
  assert.equal(findSpliceLoss(after, 'SL-1').loss, '0.25 dB');
  assert.equal(findSpliceLoss(after, 'SL-1').date, '2026-03-02');
  assert.equal(after.length, 2);
});

test('loss reading kept exactly as entered', () => {
  const next = recordSpliceLoss([], { ...n1, loss: '0.25 dB (re-measured)' });
  assert.equal(next[0].loss, '0.25 dB (re-measured)');
});

test('summary text and joint list', () => {
  assert.equal(spliceLossSummaryText([]), 'No splice loss notes recorded.');
  assert.equal(spliceLossSummaryText([n1, n2, n3]), '3 loss notes across 2 joints.');
  assert.equal(spliceLossSummaryText([n1]), '1 loss note across 1 joint.');
  assert.deepEqual(spliceLossJoints([n2, n3, n1]), ['JNT-A', 'JNT-B']);
});

test('note text with fallbacks', () => {
  assert.equal(spliceLossText(n1), 'JNT-A — 2026-03-02 — loss 0.25 dB — OTDR-2 — Saad.');
  assert.equal(spliceLossText(n2), 'JNT-A — 2026-03-10 — loss 0.31 dB — No instrument noted — Saad.');
  assert.equal(spliceLossText(n3), 'JNT-B — 2026-02-15 — loss 0.18 dB — Power meter — No technician noted.');
  assert.equal(spliceLossText(null), '');
});

test('HTML escaping', () => {
  const html = spliceLossHtml({ ...n1, instrument: '<b>OTDR</b>', technician: 'Saad & Co' });
  assert.ok(!html.includes('<b>OTDR</b>'));
  assert.ok(html.includes('&lt;b&gt;OTDR&lt;/b&gt;'));
  assert.ok(html.includes('Saad &amp; Co'));
});

test('CSV and filename', () => {
  assert.equal(spliceLossFilename(), 'splice-loss-notes.csv');
  const csv = spliceLossCsv([n2, n1]);
  assert.ok(csv.startsWith('id,jointRef,date,loss,instrument,technician'));
  assert.ok(csv.includes('SL-1,JNT-A,2026-03-02,0.25 dB,OTDR-2,Saad'));
  assert.ok(csv.includes('SL-2,JNT-A,2026-03-10,0.31 dB,,Saad'));
});

test('list normalisation drops bad rows and keeps first of each id', () => {
  const cleaned = normalizeSpliceLossList([n1, null, { ...n2, date: '2026-02-30' }, 'junk', n1]);
  assert.deepEqual(cleaned.map((item) => item.id), ['SL-1']);
  assert.deepEqual(normalizeSpliceLossList('not a list'), []);
});

test('purity fence: no clock, storage, or network access', () => {
  assert.ok(!/new Date\(|Date\.now\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest/.test(moduleSrc));
});

test('neighbour-module fence: the repair record is neither read nor rewritten', () => {
  assert.ok(!moduleSrc.includes('splice-repair'));
  assert.ok(!moduleSrc.includes('spliceRepair'));
  assert.ok(!moduleSrc.includes("from './"));
});

test('never-changes fence: no bill, payment, customer, fault, or repair object is touched', () => {
  assert.ok(!/billTotal|paymentId|customerId|faultId|repairId/.test(moduleSrc));
  const before = [n1];
  const after = recordSpliceLoss(before, n2);
  assert.deepEqual(before, [n1]);
  assert.equal(after.length, 2);
});

test('panel ids present in index.html', () => {
  for (const id of ['slHeading', 'slSummary', 'slExportBtn', 'slJoint', 'slDate', 'slLoss', 'slInstrument', 'slTechnician', 'slSaveBtn', 'slRemoveId', 'slRemoveBtn', 'slFilter', 'slCheckJoint', 'slCheckBtn', 'slCheckOut', 'slBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring', () => {
  assert.ok(appJs.includes("from './splice-loss.js'"));
  assert.ok(appJs.includes('renderSpliceLoss()'));
  assert.ok(appJs.includes('SPLICE_LOSS_KEY'));
  assert.ok(appJs.includes('shahdara_splice_losses_v1'));
});

test('deployment guard: no standalone OLT word in app.js', () => {
  const standalone = appJs.match(/(?<![A-Za-z])OLT(?![A-Za-z])/g) || [];
  assert.equal(standalone.length, 0);
});
