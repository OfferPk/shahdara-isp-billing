import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validInsuranceClaimDay,
  foldInsuranceClaimStatus,
  normalizeInsuranceClaim,
  normalizeInsuranceClaimList,
  findInsuranceClaim,
  recordInsuranceClaim,
  removeInsuranceClaim,
  insuranceClaimsSorted,
  insuranceClaimsForAsset,
  insuranceClaimAssets,
  insuranceClaimTotalClaimed,
  insuranceClaimTotalSettled,
  insuranceClaimSummaryText,
  insuranceClaimEntryText,
  insuranceClaimEntryHtml,
  insuranceClaimAllHtml,
  insuranceClaimsForAssetHtml,
  insuranceClaimCsv,
  insuranceClaimFilename,
} from '../insurance-claim.js';

const first = {
  id: 'IC-1',
  assetRef: 'Main UPS',
  incidentDate: '2026-10-20',
  claimDate: '2026-10-22',
  amountClaimed: 15000,
  status: 'filed',
  amountSettled: null,
};
const second = {
  id: 'IC-2',
  assetRef: 'Main UPS',
  incidentDate: '2026-09-05',
  claimDate: '2026-09-08',
  amountClaimed: 8000,
  status: 'settled',
  amountSettled: 7500,
};
const third = {
  id: 'IC-3',
  assetRef: 'Shop shutter',
  incidentDate: '2026-11-01',
  claimDate: '2026-11-03',
  amountClaimed: 12000,
  status: 'In Review',
  amountSettled: null,
};
const fixture = [first, second, third];
// The module folds third's raw 'In Review' status to 'in review',
// so normalised lists carry the folded spelling.
const thirdClean = { ...third, status: 'in review' };

test('strict dates: real calendar days only', () => {
  assert.equal(validInsuranceClaimDay('2026-11-05'), true);
  assert.equal(validInsuranceClaimDay('2024-02-29'), true);
  assert.equal(validInsuranceClaimDay('2025-02-29'), false);
  assert.equal(validInsuranceClaimDay('2026-02-30'), false);
  assert.equal(validInsuranceClaimDay('2026-04-31'), false);
  assert.equal(validInsuranceClaimDay('2026-13-01'), false);
  assert.equal(validInsuranceClaimDay('2026-00-10'), false);
  assert.equal(validInsuranceClaimDay('2026-11-00'), false);
  assert.equal(validInsuranceClaimDay('2026-11-5'), false);
  assert.equal(validInsuranceClaimDay('05-11-2026'), false);
  assert.equal(validInsuranceClaimDay(''), false);
  assert.equal(validInsuranceClaimDay(null), false);
  assert.equal(validInsuranceClaimDay(20261105), false);
});

test('half-formed claims are refused', () => {
  assert.equal(normalizeInsuranceClaim(null), null);
  assert.equal(normalizeInsuranceClaim({}), null);
  assert.equal(normalizeInsuranceClaim({ ...first, id: '' }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, assetRef: '' }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, incidentDate: '' }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, incidentDate: '2025-02-29' }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, claimDate: '' }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, claimDate: '2026-11-5' }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, amountClaimed: '' }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, amountClaimed: 0 }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, amountClaimed: -500 }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, amountClaimed: 15000.5 }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, amountClaimed: 'fifteen thousand' }), null);
  // A digit string is a whole-rupee amount.
  assert.deepEqual(normalizeInsuranceClaim({ ...first, amountClaimed: '15000' }), first);
});

test('a claim date before its incident date is refused', () => {
  assert.equal(normalizeInsuranceClaim({ ...first, claimDate: '2026-10-19' }), null);
  assert.deepEqual(normalizeInsuranceClaim({ ...first, claimDate: '2026-10-20' }), {
    ...first,
    claimDate: '2026-10-20',
  });
});

test('the amount settled is optional but must be whole rupees when given', () => {
  assert.deepEqual(normalizeInsuranceClaim({ ...first, amountSettled: undefined }), first);
  assert.deepEqual(normalizeInsuranceClaim({ ...first, amountSettled: '' }), first);
  assert.deepEqual(normalizeInsuranceClaim({ ...first, amountSettled: 0 }), { ...first, amountSettled: 0 });
  assert.deepEqual(normalizeInsuranceClaim({ ...first, amountSettled: '7500' }), {
    ...first,
    amountSettled: 7500,
  });
  assert.equal(normalizeInsuranceClaim({ ...first, amountSettled: -1 }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, amountSettled: 7500.5 }), null);
  assert.equal(normalizeInsuranceClaim({ ...first, amountSettled: 'seven thousand' }), null);
});

test('status folds from plain spellings; missing or unclear reads as filed', () => {
  assert.equal(foldInsuranceClaimStatus('filed'), 'filed');
  assert.equal(foldInsuranceClaimStatus('Submitted'), 'filed');
  assert.equal(foldInsuranceClaimStatus('under review'), 'in review');
  assert.equal(foldInsuranceClaimStatus('REVIEWING'), 'in review');
  assert.equal(foldInsuranceClaimStatus('approved'), 'approved');
  assert.equal(foldInsuranceClaimStatus('Accepted'), 'approved');
  assert.equal(foldInsuranceClaimStatus('paid'), 'settled');
  assert.equal(foldInsuranceClaimStatus('Closed'), 'settled');
  assert.equal(foldInsuranceClaimStatus('rejected'), 'rejected');
  assert.equal(foldInsuranceClaimStatus('declined'), 'rejected');
  assert.equal(foldInsuranceClaimStatus(''), 'filed');
  assert.equal(foldInsuranceClaimStatus(null), 'filed');
  assert.equal(foldInsuranceClaimStatus('some day maybe'), 'filed');
  assert.deepEqual(normalizeInsuranceClaim({ ...first, status: 'Under Review' }), {
    ...first,
    status: 'in review',
  });
  assert.deepEqual(normalizeInsuranceClaim({ ...first, status: '' }), first);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billId: 'B-1', paymentId: 'P-1', assetId: 'A-1' };
  const before = JSON.stringify(raw);
  const clean = normalizeInsuranceClaim(raw);
  assert.deepEqual(clean, first);
  assert.equal(JSON.stringify(raw), before);
  const listBefore = JSON.stringify(fixture);
  normalizeInsuranceClaimList(fixture);
  assert.equal(JSON.stringify(fixture), listBefore);
});

test('a duplicate id is never rewritten: the first claim stays', () => {
  const again = { ...first, amountClaimed: 99999, status: 'settled' };
  assert.deepEqual(recordInsuranceClaim(fixture, again), [first, second, thirdClean]);
  assert.deepEqual(normalizeInsuranceClaimList([first, again]), [first]);
});

test('find and remove', () => {
  assert.deepEqual(findInsuranceClaim(fixture, 'IC-2'), second);
  assert.equal(findInsuranceClaim(fixture, 'IC-9'), null);
  assert.equal(findInsuranceClaim(fixture, ''), null);
  assert.deepEqual(removeInsuranceClaim(fixture, 'IC-2'), [first, thirdClean]);
  assert.deepEqual(removeInsuranceClaim(fixture, 'IC-9'), [first, second, thirdClean]);
});

test('claims sort by claim date, then asset, then id', () => {
  assert.deepEqual(insuranceClaimsSorted([third, first, second]), [second, first, thirdClean]);
  assert.deepEqual(insuranceClaimsSorted([{ ...third, id: 'IC-0' }, third]), [
    { ...third, id: 'IC-0', status: 'in review' },
    thirdClean,
  ]);
});

test('claims per asset and the asset list', () => {
  assert.deepEqual(insuranceClaimsForAsset(fixture, 'main ups'), [second, first]);
  assert.deepEqual(insuranceClaimsForAsset(fixture, 'MAIN UPS'), [second, first]);
  assert.deepEqual(insuranceClaimsForAsset(fixture, 'no such asset'), []);
  assert.deepEqual(insuranceClaimsForAsset(fixture, ''), []);
  assert.deepEqual(insuranceClaimAssets(fixture), ['Main UPS', 'Shop shutter']);
  assert.deepEqual(
    insuranceClaimAssets([{ ...first, assetRef: 'main ups' }, second, third]),
    ['main ups', 'Shop shutter'],
  );
});

test('totals use integer arithmetic only; unsettled claims add nothing to the settled total', () => {
  assert.equal(insuranceClaimTotalClaimed(fixture), 35000);
  assert.equal(insuranceClaimTotalSettled(fixture), 7500);
  assert.equal(insuranceClaimTotalClaimed([]), 0);
  assert.equal(insuranceClaimTotalSettled([]), 0);
  assert.equal(insuranceClaimTotalSettled([first, third]), 0);
});

test('summary text names the count, both totals, and the latest claim', () => {
  assert.equal(
    insuranceClaimSummaryText(fixture),
    '3 insurance claims recorded. Total claimed Rs 35000, total settled Rs 7500. Latest: Shop shutter, 2026-11-03, in review.',
  );
  assert.equal(
    insuranceClaimSummaryText([first]),
    '1 insurance claim recorded. Total claimed Rs 15000, total settled Rs 0. Latest: Main UPS, 2026-10-22, filed.',
  );
  assert.equal(insuranceClaimSummaryText([]), 'No insurance claims recorded.');
});

test('entry text shows asset, dates, claimed and settled amounts, and status', () => {
  assert.equal(
    insuranceClaimEntryText(first),
    '2026-10-22 — Main UPS: Incident 2026-10-20. Claimed: Rs 15000. Settled: not yet settled. Status: filed.',
  );
  assert.equal(
    insuranceClaimEntryText(second),
    '2026-09-08 — Main UPS: Incident 2026-09-05. Claimed: Rs 8000. Settled: Rs 7500. Status: settled.',
  );
  assert.equal(insuranceClaimEntryText(null), 'No insurance claim recorded.');
  assert.equal(insuranceClaimEntryText({ ...first, id: '' }), 'No insurance claim recorded.');
});

test('HTML is escaped', () => {
  const tricky = { ...first, assetRef: 'UPS <b>main</b> & "spare"' };
  const html = insuranceClaimEntryHtml(tricky);
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('&lt;b&gt;main&lt;/b&gt;'), true);
  assert.equal(html.includes('&amp;'), true);
  assert.equal(html.includes('&quot;spare&quot;'), true);
  assert.equal(insuranceClaimEntryHtml(null), '<p>No insurance claim recorded.</p>');
  assert.equal(insuranceClaimAllHtml([]), '<p>No insurance claims recorded.</p>');
  assert.equal(
    insuranceClaimsForAssetHtml(fixture, 'no such asset'),
    '<p>No insurance claims recorded for this asset.</p>',
  );
  assert.equal(insuranceClaimAllHtml(fixture).startsWith('<ul>'), true);
});

test('CSV export and filename', () => {
  assert.equal(insuranceClaimFilename(), 'insurance-claim-notes.csv');
  const csv = insuranceClaimCsv(fixture);
  const lines = csv.split('\n');
  assert.equal(
    lines[0],
    '"id","asset","incident date","claim date","amount claimed (Rs)","status","amount settled (Rs)"',
  );
  assert.equal(lines[1], '"IC-2","Main UPS","2026-09-05","2026-09-08","8000","settled","7500"');
  assert.equal(lines[2], '"IC-1","Main UPS","2026-10-20","2026-10-22","15000","filed",""');
  assert.equal(lines[3], '"IC-3","Shop shutter","2026-11-01","2026-11-03","12000","in review",""');
  assert.equal(lines.length, 4);
  assert.equal(insuranceClaimCsv([]).split('\n').length, 1);
});

test('list normalisation drops half-formed rows and keeps the first of a duplicate id', () => {
  assert.deepEqual(normalizeInsuranceClaimList(null), []);
  assert.deepEqual(normalizeInsuranceClaimList('nope'), []);
  assert.deepEqual(normalizeInsuranceClaimList([first, null, { ...second, id: '' }, first]), [first]);
  assert.deepEqual(normalizeInsuranceClaimList([second, first, second]), [second, first]);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../insurance-claim.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the shop insurance and asset register is untouched', () => {
  const source = readFileSync(new URL('../insurance-claim.js', import.meta.url), 'utf8');
  assert.equal(source.includes('shop-asset.js'), false, 'module must not reference the shop insurance and asset register file');
  assert.equal(existsSync(new URL('../shop-asset.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'icHeading', 'icSummary', 'icExportBtn', 'icAssetRef', 'icIncidentDate',
    'icClaimDate', 'icAmountClaimed', 'icStatus', 'icAmountSettled', 'icRecordBtn',
    'icRemoveId', 'icRemoveBtn', 'icAssetInput', 'icAssetBtn',
    'icAssetBody', 'icBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the insurance claim note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './insurance-claim.js'"), true);
  assert.equal(source.includes('renderInsuranceClaims();'), true);
  assert.equal(source.includes('shahdara_insurance_claims_v1'), true);
  assert.equal(source.includes('loadInsuranceClaims'), true);
  assert.equal(source.includes('saveInsuranceClaims'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
