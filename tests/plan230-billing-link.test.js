import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validBillingLinkDate,
  normalizeBillingLinkList,
  recordBillingLink,
  unlinkBillingLink,
  findBillingLink,
  billingLinksSorted,
  billingLinksActive,
  billingLinksHistory,
  billingLinksForCustomer,
  billingLinkDuesCents,
  billingLinkCombinedDues,
  billingLinkText,
  billingLinkSummaryText,
  billingLinkEntryHtml,
  billingLinkHtml,
  billingLinkCsv,
  billingLinkFilename,
} from '../billing-link.js';
import { buildCombinedDuesView } from '../combined-dues.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'billing-link.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const l1 = { id: 'BL-1', customer: 'Ahmed', primaryConnection: 'CONN-HOUSE', linkedConnection: 'CONN-SHOP', linkDate: '2026-01-05', linkNote: 'House and shop bill as one household visit.' };
const l2 = { id: 'BL-2', customer: 'Bilal', primaryConnection: 'CONN-A', linkedConnection: 'CONN-B', linkDate: '2026-02-01', linkNote: '' };

test('half-formed refusal, including no customer', () => {
  assert.equal(recordBillingLink([], { id: 'BL-x', primaryConnection: 'P', linkedConnection: 'L', linkDate: '2026-01-01' }), null);
  assert.equal(recordBillingLink([], { id: 'BL-x', customer: 'Ahmed', linkedConnection: 'L', linkDate: '2026-01-01' }), null);
  assert.equal(recordBillingLink([], { id: 'BL-x', customer: 'Ahmed', primaryConnection: 'P', linkDate: '2026-01-01' }), null);
  assert.equal(recordBillingLink([], { id: 'BL-x', customer: 'Ahmed', primaryConnection: 'P', linkedConnection: 'L' }), null);
  assert.equal(recordBillingLink([], { customer: 'Ahmed', primaryConnection: 'P', linkedConnection: 'L', linkDate: '2026-01-01' }), null);
});

test('same connection on both sides is refused', () => {
  assert.equal(recordBillingLink([], { ...l1, linkedConnection: 'CONN-HOUSE' }), null);
  assert.equal(recordBillingLink([], { ...l1, linkedConnection: 'conn-house' }), null);
});

test('strict dates', () => {
  assert.equal(validBillingLinkDate('2026-02-30'), false);
  assert.equal(validBillingLinkDate('2024-02-29'), true);
  assert.equal(validBillingLinkDate('2026-02-29'), false);
  assert.equal(validBillingLinkDate('2026-13-01'), false);
  assert.equal(recordBillingLink([], { ...l1, linkDate: '2026-02-30' }), null);
});

test('unknown-field drop and non-mutation', () => {
  const input = { ...l1, billTotal: 5000, moved: true };
  const next = recordBillingLink([], input);
  assert.equal(next.length, 1);
  assert.equal('billTotal' in next[0], false);
  assert.equal('moved' in next[0], false);
  assert.equal(input.billTotal, 5000);
  assert.equal(next[0].linkNote, l1.linkNote);
});

test('duplicate-id and one-active-link-per-customer rules', () => {
  assert.equal(recordBillingLink([l1], { ...l2, id: 'BL-1' }), null);
  assert.equal(recordBillingLink([l1], { ...l2, customer: 'ahmed' }), null);
  const clean = normalizeBillingLinkList([l1, { ...l2, id: 'BL-1' }, null, { customer: 'Noor' }, l2]);
  assert.deepEqual(clean.map((item) => item.id), ['BL-1', 'BL-2']);
  assert.deepEqual(normalizeBillingLinkList('not a list'), []);
});

test('find active link', () => {
  assert.equal(findBillingLink([l1, l2], 'ahmed').id, 'BL-1');
  assert.equal(findBillingLink([l1, l2], 'Noor'), null);
});

test('unlinking keeps a dated history', () => {
  const unlinked = unlinkBillingLink([l1, l2], 'BL-1', '2026-04-10');
  assert.equal(unlinked.length, 2);
  const kept = unlinked.find((item) => item.id === 'BL-1');
  assert.equal(kept.dateUnlinked, '2026-04-10');
  assert.deepEqual(billingLinksActive(unlinked).map((item) => item.id), ['BL-2']);
  assert.deepEqual(billingLinksHistory(unlinked).map((item) => item.id), ['BL-1']);
  assert.equal(findBillingLink(unlinked, 'Ahmed'), null);
});

test('unlink after unlink, bad date, and unknown id leave the list unchanged', () => {
  const once = unlinkBillingLink([l1], 'BL-1', '2026-04-10');
  assert.deepEqual(unlinkBillingLink(once, 'BL-1', '2026-05-01'), once);
  assert.deepEqual(unlinkBillingLink([l1], 'BL-1', '2026-02-30'), [normalizeBillingLinkList([l1])[0]]);
  assert.deepEqual(unlinkBillingLink([l1], 'BL-9', '2026-04-10'), normalizeBillingLinkList([l1]));
});

test('a customer may be linked again later with a fresh record', () => {
  const once = unlinkBillingLink([l1], 'BL-1', '2026-04-10');
  const again = recordBillingLink(once, { id: 'BL-3', customer: 'Ahmed', primaryConnection: 'CONN-HOUSE', linkedConnection: 'CONN-SHOP', linkDate: '2026-05-01', linkNote: 'Linked again.' });
  assert.equal(again.length, 2);
  assert.equal(findBillingLink(again, 'Ahmed').id, 'BL-3');
  assert.deepEqual(billingLinksHistory(again).map((item) => item.id), ['BL-1']);
});

test('sorting and customer filter', () => {
  assert.deepEqual(billingLinksSorted([l2, l1]).map((item) => item.id), ['BL-1', 'BL-2']);
  assert.deepEqual(billingLinksForCustomer([l1, l2], 'ahm').map((item) => item.id), ['BL-1']);
  assert.equal(billingLinksForCustomer([l1, l2], '').length, 2);
});

test('combined dues match the combined view on the same fixture', () => {
  const duesRows = [
    { connectionId: 'CONN-HOUSE', amountCents: 150000 },
    { connectionId: 'CONN-SHOP', amountCents: 250000 },
  ];
  const view = billingLinkCombinedDues(l1, duesRows);
  assert.equal(view.totalCents, 400000);
  assert.equal(view.primaryCents, 150000);
  assert.equal(view.linkedCents, 250000);
  assert.deepEqual(view.missing, []);
  const combinedView = buildCombinedDuesView('Ahmed', [
    { id: 'CONN-HOUSE', customer: 'Ahmed', amountCents: 150000, month: '2026-01' },
    { id: 'CONN-SHOP', customer: 'Ahmed', amountCents: 250000, month: '2026-01' },
  ]);
  assert.equal(combinedView.totalAmountCents, view.totalCents);
  assert.equal(combinedView.connectionCount, 2);
});

test('combined dues report a missing connection plainly', () => {
  const view = billingLinkCombinedDues(l1, [{ connectionId: 'CONN-HOUSE', amountCents: 150000 }]);
  assert.deepEqual(view.missing, ['CONN-SHOP']);
  assert.equal(view.totalCents, 150000);
  assert.equal(billingLinkCombinedDues(null, []), null);
});

test('rupees convert once, cents pass through as-is', () => {
  assert.equal(billingLinkDuesCents({ amountCents: 150000 }), 150000);
  assert.equal(billingLinkDuesCents({ amount: 1500 }), 150000);
  assert.equal(billingLinkDuesCents({ amount: '1500' }), null);
  const view = billingLinkCombinedDues(l1, [
    { connectionId: 'CONN-HOUSE', amount: 1500 },
    { connectionId: 'CONN-SHOP', amountCents: 250000 },
  ]);
  assert.equal(view.totalCents, 400000);
});

test('link text, summary text, and history text', () => {
  assert.equal(billingLinkText(l1), 'Ahmed — CONN-HOUSE linked with CONN-SHOP (from 2026-01-05). Note: House and shop bill as one household visit.');
  assert.equal(billingLinkText(l2), 'Bilal — CONN-A linked with CONN-B (from 2026-02-01).');
  assert.equal(billingLinkSummaryText([]), 'No billing links recorded.');
  assert.equal(billingLinkSummaryText([l1]), '1 customer has two connections linked for billing.');
  assert.equal(billingLinkSummaryText([l1, l2]), '2 customers have two connections linked for billing.');
  const unlinked = unlinkBillingLink([l1], 'BL-1', '2026-04-10');
  assert.equal(billingLinkSummaryText(unlinked), '0 active billing links, 1 unlinked link kept in history.');
  assert.ok(billingLinkText(unlinked[0]).includes('Unlinked on 2026-04-10.'));
});

test('HTML escaping', () => {
  const nasty = { ...l1, customer: '<b>Ahmed</b>', linkNote: '<script>alert(1)</script>' };
  const html = billingLinkEntryHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;b&gt;Ahmed&lt;/b&gt;'), true);
});

test('CSV and filename', () => {
  const csv = billingLinkCsv([l2, l1]);
  assert.ok(csv.startsWith('id,customer,primary_connection,linked_connection,link_date,link_note,date_unlinked'));
  assert.ok(csv.includes('BL-1,Ahmed,CONN-HOUSE,CONN-SHOP,2026-01-05'));
  assert.equal(billingLinkFilename(), 'billing-links.csv');
  assert.equal(billingLinkHtml([]), '');
});

test('purity fence: no storage, clock, or network in the module', () => {
  assert.equal(/localStorage|sessionStorage/.test(moduleSrc), false);
  assert.equal(/new Date\(|Date\.now\(/.test(moduleSrc), false);
  assert.equal(/fetch\(|XMLHttpRequest/.test(moduleSrc), false);
});

test('neighbour-module fence: combined view, registers, and bills are not read or rewritten', () => {
  assert.equal(/combined-dues|billing-register|connection-register/.test(moduleSrc), false);
  assert.equal(/import /.test(moduleSrc), false);
});

test('panel ids present in index.html', () => {
  for (const id of ['blBody', 'blHistoryBody', 'blSummary', 'blCustomer', 'blPrimary', 'blLinked', 'blDate', 'blNote', 'blSaveBtn', 'blUnlinkId', 'blUnlinkDate', 'blUnlinkBtn', 'blFilter', 'blCheckCustomer', 'blPrimaryDues', 'blLinkedDues', 'blDuesBtn', 'blDuesOut', 'blExportBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing index.html id ${id}`);
  }
});

test('app.js wiring', () => {
  assert.ok(appJs.includes("from './billing-link.js'"));
  assert.ok(appJs.includes('renderBillingLinks()'));
  assert.ok(appJs.includes('shahdara_billing_links_v1'));
});

test('deployment guard: no standalone OLT word added to app.js', () => {
  const standalone = appJs.match(/(?<![A-Za-z])OLT(?![A-Za-z])/g) || [];
  assert.equal(standalone.length, 0);
});
