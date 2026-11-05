import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validPurchaseApprovalDay,
  foldPurchaseApprovalStatus,
  normalizePurchaseApproval,
  normalizePurchaseApprovalList,
  findPurchaseApproval,
  recordPurchaseApproval,
  removePurchaseApproval,
  purchaseApprovalsSorted,
  purchaseApprovalsForItem,
  purchaseApprovalItems,
  purchaseApprovalsForApprover,
  purchaseApprovalApprovers,
  purchaseApprovalTotalApproved,
  purchaseApprovalTotalAmount,
  purchaseApprovalSummaryText,
  purchaseApprovalEntryText,
  purchaseApprovalEntryHtml,
  purchaseApprovalAllHtml,
  purchaseApprovalsForItemHtml,
  purchaseApprovalCsv,
  purchaseApprovalFilename,
} from '../equipment-purchase-approval.js';

const first = {
  id: 'PA-1',
  item: 'Second OLT',
  reason: 'First OLT is nearing capacity',
  amount: 250000,
  approver: 'Owner',
  date: '2026-11-02',
  status: 'approved',
};
const second = {
  id: 'PA-2',
  item: 'Second OLT',
  reason: 'Spare power supply for the new OLT',
  amount: 45000,
  approver: 'owner',
  date: '2026-10-20',
  status: 'pending',
};
const third = {
  id: 'PA-3',
  item: 'Fibre splicer',
  reason: 'Old splicer keeps failing on joints',
  amount: 180000,
  approver: 'Saad',
  date: '2026-11-04',
  status: 'requested',
};

test('strict dates: real calendar days only', () => {
  assert.equal(validPurchaseApprovalDay('2026-11-05'), true);
  assert.equal(validPurchaseApprovalDay('2024-02-29'), true);
  assert.equal(validPurchaseApprovalDay('2026-02-29'), false);
  assert.equal(validPurchaseApprovalDay('2026-04-31'), false);
  assert.equal(validPurchaseApprovalDay('2026-13-01'), false);
  assert.equal(validPurchaseApprovalDay('2026-11-5'), false);
  assert.equal(validPurchaseApprovalDay('05-11-2026'), false);
  assert.equal(validPurchaseApprovalDay(''), false);
  assert.equal(validPurchaseApprovalDay(null), false);
  assert.equal(validPurchaseApprovalDay(20261105), false);
});

test('half-formed approvals are refused', () => {
  assert.equal(normalizePurchaseApproval(null), null);
  assert.equal(normalizePurchaseApproval('nope'), null);
  assert.equal(normalizePurchaseApproval({ ...first, id: '' }), null);
  assert.equal(normalizePurchaseApproval({ ...first, item: '  ' }), null);
  assert.equal(normalizePurchaseApproval({ ...first, reason: '' }), null);
  assert.equal(normalizePurchaseApproval({ ...first, amount: 0 }), null);
  assert.equal(normalizePurchaseApproval({ ...first, amount: -100 }), null);
  assert.equal(normalizePurchaseApproval({ ...first, amount: 99.5 }), null);
  assert.equal(normalizePurchaseApproval({ ...first, amount: 'many' }), null);
  assert.equal(normalizePurchaseApproval({ ...first, approver: '' }), null);
  assert.equal(normalizePurchaseApproval({ ...first, date: '2026-02-29' }), null);
  assert.equal(normalizePurchaseApproval({ ...first, date: '2026-11-32' }), null);
  assert.deepEqual(normalizePurchaseApproval({ ...first, amount: '250000' }), first);
});

test('status folds from plain spellings; missing or unclear reads as pending', () => {
  assert.equal(foldPurchaseApprovalStatus('approved'), 'approved');
  assert.equal(foldPurchaseApprovalStatus('Accepted'), 'approved');
  assert.equal(foldPurchaseApprovalStatus('sanctioned'), 'approved');
  assert.equal(foldPurchaseApprovalStatus('Declined'), 'declined');
  assert.equal(foldPurchaseApprovalStatus('rejected'), 'declined');
  assert.equal(foldPurchaseApprovalStatus('requested'), 'requested');
  assert.equal(foldPurchaseApprovalStatus('Proposed'), 'requested');
  assert.equal(foldPurchaseApprovalStatus('pending'), 'pending');
  assert.equal(foldPurchaseApprovalStatus('waiting'), 'pending');
  assert.equal(foldPurchaseApprovalStatus(''), 'pending');
  assert.equal(foldPurchaseApprovalStatus(undefined), 'pending');
  assert.equal(foldPurchaseApprovalStatus('something else'), 'pending');
  assert.equal(normalizePurchaseApproval({ ...first, status: undefined }).status, 'pending');
  assert.equal(normalizePurchaseApproval({ ...first, status: 'APPROVED' }).status, 'approved');
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billId: 'B-9', paymentId: 'P-9', stockQty: 5, extra: 'x' };
  const before = JSON.stringify(raw);
  const clean = normalizePurchaseApproval(raw);
  assert.deepEqual(Object.keys(clean).sort(), ['amount', 'approver', 'date', 'id', 'item', 'reason', 'status']);
  assert.equal(JSON.stringify(raw), before);
  const listBefore = JSON.stringify([raw]);
  assert.deepEqual(normalizePurchaseApprovalList([raw]), [clean]);
  assert.equal(JSON.stringify([raw]), listBefore);
});

test('a duplicate id is never rewritten: the first approval stays', () => {
  const changed = { ...first, amount: 1, reason: 'Changed later' };
  assert.deepEqual(recordPurchaseApproval([first], changed), [first]);
  assert.deepEqual(recordPurchaseApproval([], first), [first]);
  assert.deepEqual(recordPurchaseApproval([], { ...first, id: '' }), []);
});

test('find and remove', () => {
  const list = [first, second, third];
  assert.deepEqual(findPurchaseApproval(list, 'PA-2'), second);
  assert.equal(findPurchaseApproval(list, 'PA-9'), null);
  assert.equal(findPurchaseApproval(list, ''), null);
  assert.deepEqual(removePurchaseApproval(list, 'PA-2'), [first, third]);
  assert.deepEqual(removePurchaseApproval(list, 'PA-9'), list);
  assert.deepEqual(removePurchaseApproval(list, ''), list);
});

test('approvals sort by date, then item, then id', () => {
  assert.deepEqual(purchaseApprovalsSorted([third, first, second]), [second, first, third]);
  assert.deepEqual(
    purchaseApprovalsSorted([{ ...first, id: 'PA-9' }, first]),
    [first, { ...first, id: 'PA-9' }],
  );
});

test('approvals per item and the item list', () => {
  assert.deepEqual(purchaseApprovalsForItem([first, second, third], 'second olt'), [second, first]);
  assert.deepEqual(purchaseApprovalsForItem([first, second, third], 'Fibre splicer'), [third]);
  assert.deepEqual(purchaseApprovalsForItem([first, second, third], ''), []);
  assert.deepEqual(purchaseApprovalItems([third, first, second]), ['Fibre splicer', 'Second OLT']);
  assert.deepEqual(purchaseApprovalItems([{ ...first, item: 'second olt' }, first]), ['second olt']);
});

test('approvals per approver and the approver list', () => {
  assert.deepEqual(purchaseApprovalsForApprover([first, second, third], 'OWNER'), [second, first]);
  assert.deepEqual(purchaseApprovalsForApprover([first, second, third], 'Saad'), [third]);
  assert.deepEqual(purchaseApprovalsForApprover([first, second, third], ''), []);
  assert.deepEqual(purchaseApprovalApprovers([third, first, second]), ['Owner', 'Saad']);
});

test('totals use integer arithmetic only; only approved approvals count toward the approved total', () => {
  assert.equal(purchaseApprovalTotalAmount([first, second, third]), 475000);
  assert.equal(purchaseApprovalTotalApproved([first, second, third]), 250000);
  assert.equal(purchaseApprovalTotalApproved([]), 0);
  assert.equal(purchaseApprovalTotalAmount([]), 0);
});

test('summary text names the count, the approved count, both totals, and the latest approval', () => {
  assert.equal(purchaseApprovalSummaryText([]), 'No purchase approvals recorded.');
  const text = purchaseApprovalSummaryText([first, second, third]);
  assert.equal(
    text,
    '3 purchase approvals recorded, 1 approved. Total requested Rs 475000, total approved Rs 250000. Latest: Fibre splicer, 2026-11-04, requested.',
  );
  assert.equal(
    purchaseApprovalSummaryText([first]),
    '1 purchase approval recorded, 1 approved. Total requested Rs 250000, total approved Rs 250000. Latest: Second OLT, 2026-11-02, approved.',
  );
});

test('entry text shows item, reason, amount, approver, date, and status', () => {
  assert.equal(purchaseApprovalEntryText(null), 'No purchase approval recorded.');
  assert.equal(
    purchaseApprovalEntryText(first),
    '2026-11-02 — Second OLT: First OLT is nearing capacity. Amount: Rs 250000. Approver: Owner. Status: approved.',
  );
  assert.equal(
    purchaseApprovalEntryText({ ...second, status: undefined }),
    '2026-10-20 — Second OLT: Spare power supply for the new OLT. Amount: Rs 45000. Approver: owner. Status: pending.',
  );
});

test('HTML is escaped', () => {
  const nasty = { ...first, item: '<script>alert(1)</script>', reason: 'A & B "quoted"' };
  const html = purchaseApprovalEntryHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('A &amp; B'), true);
  assert.equal(purchaseApprovalEntryHtml(null), '<p>No purchase approval recorded.</p>');
  assert.equal(purchaseApprovalAllHtml([]), '<p>No purchase approvals recorded.</p>');
  assert.equal(purchaseApprovalAllHtml([first]).includes('<li>'), true);
  assert.equal(purchaseApprovalsForItemHtml([first], 'Nope'), '<p>No purchase approvals recorded for this item.</p>');
  assert.equal(purchaseApprovalsForItemHtml([first], 'Second OLT').includes('<li>'), true);
});

test('CSV export and filename', () => {
  const csv = purchaseApprovalCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","item","reason","amount (Rs)","approver","date","status"');
  assert.equal(lines[1], '"PA-2","Second OLT","Spare power supply for the new OLT","45000","owner","2026-10-20","pending"');
  assert.equal(lines[2], '"PA-1","Second OLT","First OLT is nearing capacity","250000","Owner","2026-11-02","approved"');
  assert.equal(purchaseApprovalCsv([]), '"id","item","reason","amount (Rs)","approver","date","status"');
  assert.equal(purchaseApprovalFilename(), 'equipment-purchase-approvals.csv');
});

test('list normalisation drops half-formed rows and keeps the first of a duplicate id', () => {
  assert.deepEqual(normalizePurchaseApprovalList(null), []);
  assert.deepEqual(normalizePurchaseApprovalList('nope'), []);
  assert.deepEqual(normalizePurchaseApprovalList([first, null, { ...second, id: '' }, first]), [first]);
  assert.deepEqual(normalizePurchaseApprovalList([second, first, second]), [second, first]);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../equipment-purchase-approval.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: stock register, spare-parts reorder, and replacement reserve tracker are untouched', () => {
  const source = readFileSync(new URL('../equipment-purchase-approval.js', import.meta.url), 'utf8');
  assert.equal(source.includes('stock-register.js'), false, 'module must not reference the stock register file');
  assert.equal(source.includes('spare-reorder.js'), false, 'module must not reference the spare-parts reorder file');
  assert.equal(source.includes('equipment-ageing.js'), false, 'module must not reference the replacement reserve tracker file');
  assert.equal(existsSync(new URL('../stock-register.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../spare-reorder.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../equipment-ageing.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'epaHeading', 'epaSummary', 'epaExportBtn', 'epaItem', 'epaReason',
    'epaAmount', 'epaApprover', 'epaDate', 'epaStatus', 'epaRecordBtn',
    'epaRemoveId', 'epaRemoveBtn', 'epaItemInput', 'epaItemBtn',
    'epaItemBody', 'epaBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the equipment purchase approval note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './equipment-purchase-approval.js'"), true);
  assert.equal(source.includes('renderPurchaseApprovals();'), true);
  assert.equal(source.includes('shahdara_purchase_approvals_v1'), true);
  assert.equal(source.includes('loadPurchaseApprovals'), true);
  assert.equal(source.includes('savePurchaseApprovals'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
