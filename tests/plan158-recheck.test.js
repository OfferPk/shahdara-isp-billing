import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeRecheck,
  normalizeRecheckList,
  findRecheck,
  upsertRecheck,
  removeRecheck,
  ticketRechecks,
  recheckTickets,
  failedFollowUp,
  recheckSummaryText,
  recheckAllHtml,
  recheckTicketHtml,
  recheckFollowUpHtml,
  recheckCsv,
  recheckFilename,
} from '../recheck.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'R-1',
  ticketId: 'T-100',
  recheckDate: '2026-11-04',
  result: 'holding',
  note: 'Still working',
  ...over,
});

test('strict dates: real calendar dates pass, impossible dates refused', () => {
  assert.equal(normalizeRecheck(record({ recheckDate: '2026-08-31' })).recheckDate, '2026-08-31');
  assert.equal(normalizeRecheck(record({ recheckDate: '2026-10-31' })).recheckDate, '2026-10-31');
  assert.equal(normalizeRecheck(record({ recheckDate: '2026-12-31' })).recheckDate, '2026-12-31');
  assert.equal(normalizeRecheck(record({ recheckDate: '2024-02-29' })).recheckDate, '2024-02-29');
  assert.equal(normalizeRecheck(record({ recheckDate: '2026-02-30' })), null);
  assert.equal(normalizeRecheck(record({ recheckDate: '2026-02-29' })), null);
  assert.equal(normalizeRecheck(record({ recheckDate: '2026-04-31' })), null);
});

test('half-formed refusal: no ticket, no result, or bad result refused', () => {
  assert.equal(normalizeRecheck(record({ ticketId: '' })), null);
  assert.equal(normalizeRecheck(record({ ticketId: '   ' })), null);
  assert.equal(normalizeRecheck(record({ result: '' })), null);
  assert.equal(normalizeRecheck(record({ result: 'ok' })), null);
  assert.equal(normalizeRecheck(record({ result: 'passed' })), null);
  assert.equal(normalizeRecheck(record({ id: '' })), null);
  assert.equal(normalizeRecheck(record({ recheckDate: '' })), null);
  assert.equal(normalizeRecheck(null), null);
  assert.equal(normalizeRecheck('nope'), null);
});

test('result case is normalized, note is optional', () => {
  assert.equal(normalizeRecheck(record({ result: 'FAILED' })).result, 'failed');
  assert.equal(normalizeRecheck(record({ result: 'Holding' })).result, 'holding');
  const noNote = normalizeRecheck(record({ note: undefined }));
  assert.equal(noNote.note, '');
});

test('unknown fields dropped, list normalization drops half-formed', () => {
  const clean = normalizeRecheck(record({ billId: 'B-1', paymentId: 'P-1', status: 'closed' }));
  assert.equal(clean.billId, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.status, undefined);
  const list = normalizeRecheckList([record(), record({ id: 'R-2', ticketId: '' }), record({ id: 'R-3', result: 'failed' })]);
  assert.deepEqual(list.map((item) => item.id), ['R-1', 'R-3']);
  assert.deepEqual(normalizeRecheckList(null), []);
  assert.deepEqual(normalizeRecheckList('nope'), []);
});

test('duplicate ids never rewritten', () => {
  const base = [record()];
  assert.deepEqual(upsertRecheck(base, record()), base);
  assert.deepEqual(upsertRecheck(base, record({ note: 'Changed' })), base);
  const added = upsertRecheck(base, record({ id: 'R-2', result: 'failed' }));
  assert.equal(added.length, 2);
  assert.deepEqual(upsertRecheck(base, record({ ticketId: '' })), base);
});

test('find and remove', () => {
  const list = [record(), record({ id: 'R-2', ticketId: 'T-200', result: 'failed' })];
  assert.equal(findRecheck(list, 'R-2').ticketId, 'T-200');
  assert.equal(findRecheck(list, 'R-9'), null);
  assert.deepEqual(removeRecheck(list, 'R-1').map((item) => item.id), ['R-2']);
  assert.deepEqual(removeRecheck(list, 'R-9'), list);
});

test('ticket re-checks newest first, then id A-Z', () => {
  const list = [
    record({ id: 'R-1', recheckDate: '2026-11-01' }),
    record({ id: 'R-2', recheckDate: '2026-11-05', result: 'failed' }),
    record({ id: 'R-3', recheckDate: '2026-11-05' }),
    record({ id: 'R-4', ticketId: 'T-200', recheckDate: '2026-11-06' }),
  ];
  assert.deepEqual(ticketRechecks(list, 'T-100').map((item) => item.id), ['R-2', 'R-3', 'R-1']);
  assert.deepEqual(ticketRechecks(list, ''), []);
  assert.deepEqual(ticketRechecks(list, 'T-999'), []);
});

test('tickets list A-Z, follow-up list holds failed tickets only', () => {
  const list = [
    record({ id: 'R-1', ticketId: 'T-200', result: 'holding' }),
    record({ id: 'R-2', ticketId: 'T-100', result: 'failed', recheckDate: '2026-11-02' }),
    record({ id: 'R-3', ticketId: 'T-100', result: 'failed', recheckDate: '2026-11-05' }),
    record({ id: 'R-4', ticketId: 'T-300', result: 'failed', recheckDate: '2026-11-03' }),
    record({ id: 'R-5', ticketId: 'T-200', result: 'failed', recheckDate: '2026-11-04' }),
  ];
  assert.deepEqual(recheckTickets(list), ['T-100', 'T-200', 'T-300']);
  const followUp = failedFollowUp(list);
  assert.deepEqual(followUp.map((entry) => entry.ticketId), ['T-100', 'T-200', 'T-300']);
  assert.equal(followUp[0].failedCount, 2);
  assert.equal(followUp[0].latestFailedDate, '2026-11-05');
  assert.equal(followUp[1].failedCount, 1);
  assert.deepEqual(failedFollowUp([record()]), []);
  assert.deepEqual(failedFollowUp([]), []);
});

test('summary text counts records, tickets, and follow-up tickets', () => {
  const list = [record(), record({ id: 'R-2', result: 'failed' })];
  assert.equal(recheckSummaryText(list), '2 re-checks across 1 ticket, 1 ticket on the failed follow-up list.');
  assert.equal(recheckSummaryText([]), '0 re-checks across 0 tickets, 0 tickets on the failed follow-up list.');
  assert.equal(recheckSummaryText([record()]), '1 re-check across 1 ticket, 0 tickets on the failed follow-up list.');
});

test('all HTML newest first with failed flagged; ticket HTML and empty states', () => {
  const list = [record(), record({ id: 'R-2', result: 'failed', recheckDate: '2026-11-06' })];
  const all = recheckAllHtml(list);
  assert.ok(all.indexOf('R-2') < all.indexOf('R-1'));
  assert.ok(all.includes('⚠ failed'));
  assert.ok(recheckAllHtml([]).includes('No fault re-checks recorded yet.'));
  const ticket = recheckTicketHtml(list, 'T-100');
  assert.ok(ticket.includes('R-1') && ticket.includes('R-2'));
  assert.ok(recheckTicketHtml(list, 'T-999').includes('No re-checks for this ticket yet.'));
  const followUp = recheckFollowUpHtml(list);
  assert.ok(followUp.includes('T-100') && followUp.includes('1'));
  assert.ok(recheckFollowUpHtml([record()]).includes('No ticket on the failed follow-up list.'));
});

test('HTML escaping keeps markup out of rendered rows', () => {
  const list = [record({ ticketId: '<script>alert(1)</script>', note: '<b>bold</b>' })];
  const html = recheckAllHtml(list);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;b&gt;'));
});

test('CSV export and filename', () => {
  const list = [record(), record({ id: 'R-2', result: 'failed', note: 'Dropped, "again"' })];
  const csv = recheckCsv(list);
  assert.ok(csv.startsWith('id,ticketId,recheckDate,result,note'));
  assert.ok(csv.includes('R-1,T-100,2026-11-04,holding,Still working'));
  assert.ok(csv.includes('"Dropped, ""again"""'));
  assert.equal(recheckCsv([]), 'id,ticketId,recheckDate,result,note');
  assert.equal(recheckFilename(), 'fault-rechecks.csv');
});

test('inputs never mutated', () => {
  const input = record({ extra: 'x' });
  const frozen = JSON.stringify(input);
  normalizeRecheck(input);
  upsertRecheck([input], record({ id: 'R-2' }));
  removeRecheck([input], 'R-1');
  ticketRechecks([input], 'T-100');
  assert.equal(JSON.stringify(input), frozen);
});

test('purity fence: module imports nothing and reads no storage, clock, or network', () => {
  const source = readFileSync(join(dir, '..', 'recheck.js'), 'utf8');
  assert.ok(!/^\s*import\s/m.test(source));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('sessionStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('Date.now'));
  assert.ok(!source.includes('new Date('));
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['recheckTicket', 'recheckDate', 'recheckResult', 'recheckNote', 'recheckSaveBtn', 'recheckRemoveId', 'recheckRemoveBtn', 'recheckFilter', 'recheckBody', 'recheckFollowUpBody', 'recheckSummary', 'recheckExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
