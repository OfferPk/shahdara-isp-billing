import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validGuardDate,
  validGuardMonth,
  monthOfDate,
  normalizeClosedPeriod,
  normalizeClosedPeriodList,
  findClosedPeriod,
  recordClosedPeriod,
  normalizeHeldEntry,
  normalizeHeldEntryList,
  findHeldEntry,
  checkGuardPosting,
  holdEntry,
  approveHeldEntry,
  heldEntries,
  postedEntries,
  heldEntrySummaryText,
  heldEntryHtml,
  closedPeriodHtml,
  heldEntryCsv,
  heldEntryFilename,
} from '../closed-period-posting.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const closed = [{ month: '2026-09', closedDate: '2026-10-05', closedBy: 'Owner' }];

function entry(over = {}) {
  return {
    id: 'H-1',
    customer: 'Ayesha Khan',
    kind: 'payment',
    intendedDate: '2026-09-20',
    amount: 1500,
    ...over,
  };
}

test('strict dates and months: real dates pass, impossible dates refused', () => {
  assert.equal(validGuardDate('2026-02-29'), null);
  assert.equal(validGuardDate('2024-02-29'), '2024-02-29');
  assert.equal(validGuardDate('2026-02-30'), null);
  assert.equal(validGuardDate('2026-13-01'), null);
  assert.equal(validGuardDate('2026-09-20'), '2026-09-20');
  assert.equal(validGuardMonth('2026-09'), '2026-09');
  assert.equal(validGuardMonth('2026-13'), null);
  assert.equal(validGuardMonth('2026-9'), null);
  assert.equal(monthOfDate('2026-09-20'), '2026-09');
  assert.equal(monthOfDate('2026-02-30'), null);
});

test('closed period normalisation: half-formed refused, unknown fields dropped', () => {
  assert.equal(normalizeClosedPeriod({ month: '2026-09' }), null);
  assert.equal(normalizeClosedPeriod({ month: '2026-09', closedDate: '2026-02-30' }), null);
  assert.equal(normalizeClosedPeriod({ month: '2026-13', closedDate: '2026-10-05' }), null);
  const clean = normalizeClosedPeriod({ month: '2026-09', closedDate: '2026-10-05', closedBy: ' Owner ', snapshotTotal: 999 });
  assert.deepEqual(clean, { month: '2026-09', closedDate: '2026-10-05', closedBy: 'Owner' });
  assert.equal(findClosedPeriod(closed, '2026-09').month, '2026-09');
  assert.equal(findClosedPeriod(closed, '2026-10'), null);
  assert.equal(findClosedPeriod(closed, 'not-a-month'), null);
});

test('record closed period: duplicate month never rewritten', () => {
  const again = recordClosedPeriod(closed, { month: '2026-09', closedDate: '2026-10-06', closedBy: 'Someone else' });
  assert.deepEqual(again, closed);
  const added = recordClosedPeriod(closed, { month: '2026-10', closedDate: '2026-11-04', closedBy: 'Owner' });
  assert.equal(added.length, 2);
  assert.equal(recordClosedPeriod(closed, { month: '2026-10' }).length, 1);
  assert.deepEqual(normalizeClosedPeriodList([...closed, closed[0]]), closed);
});

test('guard check: blocked exactly when the intended month is closed', () => {
  assert.deepEqual(checkGuardPosting(closed, '2026-09-20'), { blocked: true, closedMonth: '2026-09' });
  assert.deepEqual(checkGuardPosting(closed, '2026-09-01'), { blocked: true, closedMonth: '2026-09' });
  assert.deepEqual(checkGuardPosting(closed, '2026-09-30'), { blocked: true, closedMonth: '2026-09' });
  assert.deepEqual(checkGuardPosting(closed, '2026-10-01'), { blocked: false, closedMonth: null });
  assert.deepEqual(checkGuardPosting(closed, '2026-02-30'), { blocked: false, closedMonth: null });
  assert.deepEqual(checkGuardPosting([], '2026-09-20'), { blocked: false, closedMonth: null });
});

test('held entry normalisation: half-formed refused, unknown fields dropped', () => {
  assert.equal(normalizeHeldEntry({ ...entry(), customer: '' }), null);
  assert.equal(normalizeHeldEntry({ ...entry(), kind: 'refund' }), null);
  assert.equal(normalizeHeldEntry({ ...entry(), intendedDate: '2026-02-30' }), null);
  assert.equal(normalizeHeldEntry({ ...entry(), status: 'deleted' }), null);
  assert.equal(normalizeHeldEntry({ ...entry(), amount: 'lots' }), null);
  const clean = normalizeHeldEntry({ ...entry(), billTotal: 5000, amountCents: 150000 });
  assert.equal(clean.amountCents, 150000);
  assert.equal(clean.intendedMonth, '2026-09');
  assert.equal(clean.status, 'held');
  assert.equal(clean.originalDateNoted, '2026-09-20');
  assert.equal('billTotal' in clean, false);
});

test('rupees convert exactly once, *Cents pass through as-is', () => {
  assert.equal(normalizeHeldEntry(entry()).amountCents, 150000);
  assert.equal(normalizeHeldEntry(entry({ amount: undefined, amountCents: 150000 })).amountCents, 150000);
  assert.equal(normalizeHeldEntry(entry({ amount: undefined })).amountCents, null);
});

test('hold entry: only closed-month entries are held, with the closed period as reason', () => {
  const held = holdEntry([], closed, entry());
  assert.equal(held.length, 1);
  assert.equal(held[0].status, 'held');
  assert.equal(held[0].reason, 'Intended date falls in closed period 2026-09.');
  assert.equal(held[0].postedToMonth, null);
  const open = holdEntry([], closed, entry({ id: 'H-2', intendedDate: '2026-10-02' }));
  assert.deepEqual(open, []);
  const half = holdEntry([], closed, entry({ customer: '' }));
  assert.deepEqual(half, []);
});

test('hold entry: duplicate id never rewritten', () => {
  const held = holdEntry([], closed, entry());
  const again = holdEntry(held, closed, entry({ amount: 9999 }));
  assert.deepEqual(again, held);
  assert.equal(again[0].amountCents, 150000);
});

test('approve held entry: needs approval id, approver, real date, note, and an open post-to month', () => {
  const held = holdEntry([], closed, entry());
  const noApproval = approveHeldEntry(held, closed, 'H-1', { approver: 'Owner', approvalDate: '2026-10-06', approvalNote: 'Late payment', postedToMonth: '2026-10' });
  assert.deepEqual(noApproval, held);
  const noNote = approveHeldEntry(held, closed, 'H-1', { approvalId: 'AP-1', approver: 'Owner', approvalDate: '2026-10-06', approvalNote: '', postedToMonth: '2026-10' });
  assert.deepEqual(noNote, held);
  const badDate = approveHeldEntry(held, closed, 'H-1', { approvalId: 'AP-1', approver: 'Owner', approvalDate: '2026-02-30', approvalNote: 'Late payment', postedToMonth: '2026-10' });
  assert.deepEqual(badDate, held);
  const closedTarget = approveHeldEntry(held, closed, 'H-1', { approvalId: 'AP-1', approver: 'Owner', approvalDate: '2026-10-06', approvalNote: 'Late payment', postedToMonth: '2026-09' });
  assert.deepEqual(closedTarget, held);
  const unknown = approveHeldEntry(held, closed, 'H-9', { approvalId: 'AP-1', approver: 'Owner', approvalDate: '2026-10-06', approvalNote: 'Late payment', postedToMonth: '2026-10' });
  assert.deepEqual(unknown, held);
});

test('approve held entry: original date stays noted, closed period untouched, never approved twice', () => {
  const held = holdEntry([], closed, entry());
  const posted = approveHeldEntry(held, closed, 'H-1', { approvalId: 'AP-1', approver: 'Owner', approvalDate: '2026-10-06', approvalNote: 'Late payment, genuinely received late', postedToMonth: '2026-10' });
  assert.equal(posted[0].status, 'posted');
  assert.equal(posted[0].postedToMonth, '2026-10');
  assert.equal(posted[0].originalDateNoted, '2026-09-20');
  assert.equal(posted[0].intendedDate, '2026-09-20');
  assert.equal(posted[0].approvalId, 'AP-1');
  assert.deepEqual(closed, [{ month: '2026-09', closedDate: '2026-10-05', closedBy: 'Owner' }]);
  const twice = approveHeldEntry(posted, closed, 'H-1', { approvalId: 'AP-2', approver: 'Owner', approvalDate: '2026-10-07', approvalNote: 'Again', postedToMonth: '2026-10' });
  assert.deepEqual(twice, posted);
});

test('held and posted lists: held only, oldest intended date first', () => {
  const one = holdEntry([], closed, entry({ id: 'H-2', intendedDate: '2026-09-25' }));
  const two = holdEntry(one, closed, entry({ id: 'H-1', intendedDate: '2026-09-10' }));
  assert.deepEqual(heldEntries(two).map((item) => item.id), ['H-1', 'H-2']);
  assert.deepEqual(postedEntries(two), []);
  const posted = approveHeldEntry(two, closed, 'H-1', { approvalId: 'AP-1', approver: 'Owner', approvalDate: '2026-10-06', approvalNote: 'Late', postedToMonth: '2026-10' });
  assert.deepEqual(heldEntries(posted).map((item) => item.id), ['H-2']);
  assert.deepEqual(postedEntries(posted).map((item) => item.id), ['H-1']);
  assert.equal(findHeldEntry(posted, 'H-1').status, 'posted');
  assert.equal(findHeldEntry(posted, 'H-9'), null);
});

test('non-mutation: holding and approving never change the inputs', () => {
  const before = [entry()];
  const snapshot = JSON.stringify(before);
  const held = holdEntry(before, closed, entry({ id: 'H-2', intendedDate: '2026-09-21' }));
  assert.equal(JSON.stringify(before), snapshot);
  const heldSnapshot = JSON.stringify(held);
  approveHeldEntry(held, closed, 'H-2', { approvalId: 'AP-1', approver: 'Owner', approvalDate: '2026-10-06', approvalNote: 'Late', postedToMonth: '2026-10' });
  assert.equal(JSON.stringify(held), heldSnapshot);
  assert.deepEqual(normalizeHeldEntryList([entry(), entry()]).length, 1);
});

test('summary, HTML escaping, CSV, and filename', () => {
  const held = holdEntry([], closed, entry());
  const posted = approveHeldEntry(held, closed, 'H-1', { approvalId: 'AP-1', approver: 'Owner', approvalDate: '2026-10-06', approvalNote: 'Late', postedToMonth: '2026-10' });
  assert.equal(heldEntrySummaryText(posted), '0 held for review, 1 approved and posted to the current period.');
  const html = heldEntryHtml({ ...entry(), customer: '<b>Ayesha</b>' });
  assert.match(html, /&lt;b&gt;Ayesha&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Ayesha<\/b>/);
  const csv = heldEntryCsv(posted);
  assert.match(csv, /^id,customer,kind,intended_date/);
  assert.match(csv, /H-1,Ayesha Khan,payment,2026-09-20,2026-09,150000,posted/);
  assert.match(csv, /2026-10,2026-09-20,AP-1,Owner,2026-10-06,Late/);
  assert.equal(heldEntryFilename(), 'closed-period-posting.csv');
  assert.match(closedPeriodHtml(closed[0]), /2026-09/);
  assert.equal(closedPeriodHtml({ month: '2026-13', closedDate: '2026-10-05' }), '');
});

test('purity fence: no imports, storage, DOM, network, or other-module identifiers', () => {
  const source = readFileSync(join(root, 'closed-period-posting.js'), 'utf8');
  assert.doesNotMatch(source, /^import\s/m);
  assert.doesNotMatch(source, /localStorage|document\.|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /month-close|month-snapshots|MONTH_CLOSE|MONTH_SNAPSHOTS|monthClose|monthSnapshot/);
  assert.doesNotMatch(source, /payment-clearance|bank-credits|billing-corrections/);
});

test('panel wiring: all guard element ids exist in index.html', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const ids = [
    'guardSummary', 'guardClosedBody', 'guardHeldBody',
    'guardClosedMonth', 'guardClosedDate', 'guardClosedBy', 'guardClosedSaveBtn',
    'guardCheckDate', 'guardCheckBtn', 'guardCheckResult',
    'guardEntryDate', 'guardEntryKind', 'guardEntryCustomer', 'guardEntryAmount', 'guardEntrySaveBtn',
    'guardApproveId', 'guardApprovalId', 'guardApprover', 'guardApprovalDate', 'guardApprovalNote', 'guardPostMonth', 'guardApproveBtn',
    'guardExportBtn',
  ];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
});
