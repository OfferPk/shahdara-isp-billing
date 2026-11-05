// Plan 258 — Spare part warranty claim link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validWarrantyClaimLinkDate,
  normalizeWarrantyClaimLinkList,
  recordWarrantyClaimLink,
  removeWarrantyClaimLink,
  findWarrantyClaimLink,
  supersedeWarrantyClaimLink,
  warrantyClaimLinkSorted,
  warrantyClaimLinksForPart,
  warrantyClaimLinkForPart,
  warrantyClaimLinksForClaim,
  warrantyClaimLinkParts,
  warrantyClaimLinkClaims,
  claimsWithoutLinkedPart,
  warrantyClaimLinkSummaryText,
  warrantyClaimLinkText,
  warrantyClaimLinkHtml,
  warrantyClaimLinkCsv,
  warrantyClaimLinkFilename,
} from '../warranty-claim-link.js';

const first = {
  id: 'WC-1',
  jobRef: 'JOB-101',
  partRef: 'ONU-AX-204',
  claimRef: 'CLM-9001',
  claimDate: '2026-10-14',
  claimStatus: 'filed',
};

const second = {
  id: 'WC-2',
  jobRef: 'JOB-102',
  partRef: 'SPL-1x8-07',
  claimRef: 'CLM-9002',
  claimDate: '2026-10-20',
  claimStatus: 'approved',
};

test('half-formed links are refused outright', () => {
  assert.deepEqual(recordWarrantyClaimLink([], { ...first, id: '' }), []);
  assert.deepEqual(recordWarrantyClaimLink([], { ...first, jobRef: '  ' }), []);
  assert.deepEqual(recordWarrantyClaimLink([], { ...first, partRef: '' }), []);
  assert.deepEqual(recordWarrantyClaimLink([], { ...first, claimRef: '' }), []);
  assert.deepEqual(recordWarrantyClaimLink([], { ...first, claimDate: '2026-02-30' }), []);
  assert.deepEqual(recordWarrantyClaimLink([], { ...first, claimStatus: '' }), []);
  assert.deepEqual(recordWarrantyClaimLink([], null), []);
  assert.deepEqual(recordWarrantyClaimLink([], { id: 'WC-9' }), []);
});

test('strict dates: leap years and month lengths', () => {
  assert.equal(validWarrantyClaimLinkDate('2026-02-29'), false);
  assert.equal(validWarrantyClaimLinkDate('2024-02-29'), true);
  assert.equal(validWarrantyClaimLinkDate('2026-04-31'), false);
  assert.equal(validWarrantyClaimLinkDate('2026-11-02'), true);
  assert.equal(validWarrantyClaimLinkDate('2026-13-01'), false);
  assert.equal(validWarrantyClaimLinkDate('02-11-2026'), false);
  assert.equal(validWarrantyClaimLinkDate(''), false);
  assert.equal(validWarrantyClaimLinkDate(null), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...first, surprise: 'x', billAmount: 500, supersededBy: '' };
  const frozen = JSON.parse(JSON.stringify(input));
  const out = recordWarrantyClaimLink([], input);
  assert.equal(out.length, 1);
  assert.deepEqual(Object.keys(out[0]).sort(), ['claimDate', 'claimRef', 'claimStatus', 'id', 'jobRef', 'partRef', 'supersededBy', 'supersededDate']);
  assert.equal(out[0].supersededBy, null);
  assert.equal(out[0].supersededDate, null);
  assert.deepEqual(input, frozen);
  assert.deepEqual(recordWarrantyClaimLink([], { ...first, supersededBy: 'WC-9', supersededDate: 'bad-date' }), []);
});

test('duplicate ids are never rewritten', () => {
  const list = recordWarrantyClaimLink([first], { ...first, claimStatus: 'paid' });
  assert.equal(list.length, 1);
  assert.equal(list[0].claimStatus, 'filed');
});

test('one current link per fitted part: a second live link for the same part is refused', () => {
  const list = recordWarrantyClaimLink([first], { ...second, partRef: 'onu-ax-204', id: 'WC-3' });
  assert.equal(list.length, 1);
  const superseded = supersedeWarrantyClaimLink([first], 'WC-1', {
    id: 'WC-4', jobRef: 'JOB-101', partRef: 'ONU-AX-204',
    claimRef: 'CLM-9010', claimDate: '2026-11-01', claimStatus: 'filed',
  });
  assert.equal(superseded.length, 2);
  assert.equal(warrantyClaimLinkForPart(superseded, 'onu-ax-204').id, 'WC-4');
});

test('find and remove', () => {
  const list = [first, second];
  assert.equal(findWarrantyClaimLink(list, 'WC-2').claimRef, 'CLM-9002');
  assert.equal(findWarrantyClaimLink(list, 'WC-9'), null);
  assert.equal(findWarrantyClaimLink(list, ''), null);
  assert.deepEqual(removeWarrantyClaimLink(list, 'WC-1').map((item) => item.id), ['WC-2']);
  assert.deepEqual(removeWarrantyClaimLink(list, 'WC-9').map((item) => item.id), ['WC-1', 'WC-2']);
  assert.deepEqual(removeWarrantyClaimLink(list, '').map((item) => item.id), ['WC-1', 'WC-2']);
});

test('sorting: claim date, then part, then id', () => {
  const out = warrantyClaimLinkSorted([second, first, { ...first, id: 'WC-0', claimDate: '2026-10-14', partRef: 'ONU-AX-100' }]);
  assert.deepEqual(out.map((item) => item.id), ['WC-0', 'WC-1', 'WC-2']);
});

test('listings by part and by claim, first spelling kept', () => {
  const list = [first, second, { ...second, id: 'WC-3', claimRef: 'clm-9002', partRef: 'SPL-1x8-09' }];
  assert.deepEqual(warrantyClaimLinksForPart(list, 'ONU-ax-204').map((item) => item.id), ['WC-1']);
  assert.equal(warrantyClaimLinkForPart(list, 'SPL-1x8-07').id, 'WC-2');
  assert.deepEqual(warrantyClaimLinksForClaim(list, 'CLM-9002').map((item) => item.id), ['WC-2', 'WC-3']);
  assert.deepEqual(warrantyClaimLinkParts(list), ['ONU-AX-204', 'SPL-1x8-07', 'SPL-1x8-09']);
  assert.deepEqual(warrantyClaimLinkClaims(list), ['CLM-9001', 'CLM-9002']);
  assert.deepEqual(warrantyClaimLinksForPart(list, ''), []);
  assert.deepEqual(warrantyClaimLinksForClaim(list, ''), []);
});

test('supersede: a dated newer link for the same part, old link never rewritten', () => {
  const next = {
    id: 'WC-4', jobRef: 'JOB-101', partRef: 'ONU-AX-204',
    claimRef: 'CLM-9010', claimDate: '2026-11-01', claimStatus: 'filed',
  };
  const out = supersedeWarrantyClaimLink([first], 'WC-1', next);
  assert.equal(out.length, 2);
  const old = findWarrantyClaimLink(out, 'WC-1');
  assert.equal(old.claimRef, 'CLM-9001');
  assert.equal(old.claimDate, '2026-10-14');
  assert.equal(old.claimStatus, 'filed');
  assert.equal(old.supersededBy, 'WC-4');
  assert.equal(old.supersededDate, '2026-11-01');
  assert.equal(findWarrantyClaimLink(out, 'WC-4').claimRef, 'CLM-9010');
  assert.equal(warrantyClaimLinkForPart(out, 'ONU-AX-204').id, 'WC-4');
});

test('supersede refusals: wrong part, earlier date, already superseded, duplicate new id', () => {
  const next = {
    id: 'WC-4', jobRef: 'JOB-101', partRef: 'ONU-AX-204',
    claimRef: 'CLM-9010', claimDate: '2026-11-01', claimStatus: 'filed',
  };
  const clean = normalizeWarrantyClaimLinkList([first]);
  assert.deepEqual(supersedeWarrantyClaimLink([first], 'WC-1', { ...next, partRef: 'ONU-AX-999' }), clean);
  assert.deepEqual(supersedeWarrantyClaimLink([first], 'WC-1', { ...next, claimDate: '2026-10-01' }), clean);
  assert.deepEqual(supersedeWarrantyClaimLink([first], 'WC-9', next), clean);
  assert.deepEqual(supersedeWarrantyClaimLink([first], 'WC-1', { ...next, id: 'WC-1' }), clean);
  assert.deepEqual(supersedeWarrantyClaimLink([first], 'WC-1', { ...next, claimDate: 'bad' }), clean);
  const once = supersedeWarrantyClaimLink([first], 'WC-1', next);
  assert.deepEqual(supersedeWarrantyClaimLink(once, 'WC-1', { ...next, id: 'WC-5', claimDate: '2026-11-05' }), once);
  assert.deepEqual(supersedeWarrantyClaimLink([first], 'WC-1', { ...next, supersededBy: 'WC-9', supersededDate: '2026-11-02' }), clean);
});

test('claims without a linked fitted part are listed as exceptions', () => {
  const out = claimsWithoutLinkedPart([first, second], ['CLM-9001', 'clm-9002', 'CLM-9999', '', 'CLM-9999', ' clm-9001 ']);
  assert.deepEqual(out, [{ claimRef: 'CLM-9999', status: 'no linked fitted part' }]);
  assert.deepEqual(claimsWithoutLinkedPart([first], []), []);
  assert.deepEqual(claimsWithoutLinkedPart([first], 'not a list'), []);
  assert.deepEqual(claimsWithoutLinkedPart([], ['CLM-1', 'CLM-2']).map((item) => item.claimRef), ['CLM-1', 'CLM-2']);
});

test('summary and link text', () => {
  assert.equal(warrantyClaimLinkSummaryText([]), 'No warranty claim links recorded.');
  assert.equal(warrantyClaimLinkSummaryText([first, second]), '2 warranty claim links: 2 current, 0 superseded.');
  const superseded = supersedeWarrantyClaimLink([first], 'WC-1', {
    id: 'WC-4', jobRef: 'JOB-101', partRef: 'ONU-AX-204',
    claimRef: 'CLM-9010', claimDate: '2026-11-01', claimStatus: 'filed',
  });
  assert.equal(warrantyClaimLinkSummaryText(superseded), '2 warranty claim links: 1 current, 1 superseded.');
  assert.equal(
    warrantyClaimLinkText(first),
    'Part ONU-AX-204 (job JOB-101) linked to claim CLM-9001 on 2026-10-14: filed.',
  );
  assert.equal(
    warrantyClaimLinkText(findWarrantyClaimLink(superseded, 'WC-1')),
    'Part ONU-AX-204 (job JOB-101) linked to claim CLM-9001 on 2026-10-14: filed. Superseded by WC-4 on 2026-11-01.',
  );
  assert.equal(warrantyClaimLinkText(null), 'No warranty claim link recorded.');
});

test('HTML escaping', () => {
  const entry = { ...first, claimStatus: 'filed <script>alert(1)</script>' };
  const html = warrantyClaimLinkHtml(entry);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(warrantyClaimLinkHtml(null), '<p>No warranty claim link recorded.</p>');
});

test('CSV export and filename', () => {
  const csv = warrantyClaimLinkCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","job reference","part reference","claim reference","claim date","claim status","superseded by","superseded date"');
  assert.equal(lines[1].startsWith('"WC-1","JOB-101","ONU-AX-204","CLM-9001","2026-10-14","filed","",""'), true);
  assert.equal(lines[2].startsWith('"WC-2","JOB-102","SPL-1x8-07","CLM-9002","2026-10-20","approved","",""'), true);
  assert.equal(warrantyClaimLinkFilename(), 'warranty-claim-links.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, claimStatus: 'paid' }, { id: 'WC-9' }, null, 'nope', second];
  assert.deepEqual(normalizeWarrantyClaimLinkList(messy).map((item) => item.id), ['WC-1', 'WC-2']);
  assert.deepEqual(normalizeWarrantyClaimLinkList('not a list'), []);
  assert.deepEqual(normalizeWarrantyClaimLinkList(undefined), []);
  const twoCurrentSamePart = normalizeWarrantyClaimLinkList([
    first,
    { ...second, partRef: 'ONU-AX-204', id: 'WC-3' },
  ]);
  assert.deepEqual(twoCurrentSamePart.map((item) => item.id), ['WC-1']);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../warranty-claim-link.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the RMA log and the fault parts-used log are untouched', () => {
  const source = readFileSync(new URL('../warranty-claim-link.js', import.meta.url), 'utf8');
  assert.equal(source.includes('warranty-returns'), false, 'module must not reference the RMA log module');
  assert.equal(source.includes('fault-parts'), false, 'module must not reference the fault parts-used module');
  assert.equal(existsSync(new URL('../warranty-returns.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../fault-parts.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'wcHeading', 'wcSummary', 'wcList', 'wcExportBtn',
    'wcJobRef', 'wcPartRef', 'wcClaimRef', 'wcClaimDate', 'wcClaimStatus', 'wcRecordBtn',
    'wcSupersedeOldId', 'wcSupersedeId', 'wcSupersedeJobRef', 'wcSupersedePartRef',
    'wcSupersedeClaimRef', 'wcSupersedeClaimDate', 'wcSupersedeClaimStatus', 'wcSupersedeBtn',
    'wcRemoveId', 'wcRemoveBtn',
    'wcPartRefCheck', 'wcPartBtn', 'wcPartBody',
    'wcExceptionsInput', 'wcExceptionsBtn', 'wcExceptionsBody',
    'wcClaimRefCheck', 'wcClaimBtn', 'wcClaimBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the warranty claim link panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './warranty-claim-link.js'"), true);
  assert.equal(source.includes('renderWarrantyClaimLinks()'), true);
  assert.equal(source.includes('WARRANTY_CLAIM_LINK_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
