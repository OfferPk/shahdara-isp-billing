import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalCampaignMohalla,
  validCampaignDate,
  normalizeCampaignWindow,
  campaignMohallaKeys,
  campaignMohallaLabels,
  normalizeCampaign,
  buildCampaign,
  findCampaign,
  upsertCampaign,
  removeCampaign,
  buildCampaignTargets,
  attributeCampaignCollections,
  buildCampaignSummary,
  campaignSummaryText,
  campaignHtml,
  campaignCsv,
  campaignFilename,
} from '../campaign-planner.js';

const campaign = (overrides = {}) => ({
  id: 'c1',
  name: 'Eid drive',
  startDate: '2026-03-20',
  endDate: '2026-03-31',
  mohallas: ['Bani', 'Kishti'],
  note: '',
  ...overrides,
});

const dues = [
  { customerId: 'a', customerName: 'Ahmed', mohalla: 'Bani', balanceDue: 1000 },
  { customerId: 'b', customerName: 'Bilal', mohalla: 'MOHALLA KISHTI', balanceDue: 500 },
  { customerId: 'c', customerName: 'Chaudhry', mohalla: 'Gangall', balanceDue: 700 },
  { customerId: 'd', customerName: 'Danish', mohalla: '', balanceDue: 400 },
  { customerId: 'e', customerName: 'Ehsan', mohalla: 'Bani', balanceDue: 0 },
  { customerId: 'f', customerName: 'Faraz', mohalla: 'Bani', balanceDue: -50 },
  { customerId: '', customerName: 'Ghost', mohalla: 'Bani', balanceDue: 900 },
];

test('canonical mohalla: bani, kishti and prefix spellings collapse to one key', () => {
  assert.equal(canonicalCampaignMohalla('Bani').key, canonicalCampaignMohalla('MOHALLA BANI').key);
  assert.equal(canonicalCampaignMohalla('Bani').key, canonicalCampaignMohalla('BANII').key);
  assert.equal(canonicalCampaignMohalla('kishti').key, canonicalCampaignMohalla('KISHTII').key);
  assert.equal(canonicalCampaignMohalla('chamyaa').key, canonicalCampaignMohalla('CHAMYAAA').key);
  assert.equal(canonicalCampaignMohalla(''), null);
  assert.equal(canonicalCampaignMohalla('New Street').label, 'New Street');
});

test('date validation: real dates kept, 2026-02-30 and bad formats rejected', () => {
  assert.equal(validCampaignDate('2026-03-20'), '2026-03-20');
  assert.equal(validCampaignDate('2024-02-29'), '2024-02-29');
  assert.equal(validCampaignDate('2026-02-30'), null);
  assert.equal(validCampaignDate('20-03-2026'), null);
  assert.equal(validCampaignDate(''), null);
});

test('window: valid window, missing dates, and start-after-end rejected', () => {
  assert.deepEqual(normalizeCampaignWindow('2026-03-20', '2026-03-31'), { valid: true, startDate: '2026-03-20', endDate: '2026-03-31', reason: null });
  assert.equal(normalizeCampaignWindow('2026-03-20', '2026-03-31').valid, true);
  assert.equal(normalizeCampaignWindow('2026-03-31', '2026-03-20').valid, false);
  assert.equal(normalizeCampaignWindow('2026-03-31', '2026-03-20').reason, 'start-after-end');
  assert.equal(normalizeCampaignWindow('', '2026-03-31').valid, false);
  assert.equal(normalizeCampaignWindow('2026-02-30', '2026-03-31').valid, false);
  assert.equal(normalizeCampaignWindow('2026-03-20', '2026-03-20').valid, true);
});

test('mohalla keys: deduplicated canonical keys in first-seen order, blanks dropped', () => {
  assert.deepEqual(campaignMohallaKeys(['Bani', 'BANII', 'kishti', '', '  ', 'New Street']), [
    canonicalCampaignMohalla('Bani').key,
    canonicalCampaignMohalla('kishti').key,
    canonicalCampaignMohalla('New Street').key,
  ]);
  assert.deepEqual(campaignMohallaKeys([]), []);
  assert.deepEqual(campaignMohallaLabels(['Bani', 'BANII']), ['Banii']);
});

test('campaign normalisation: blank id, blank name, or bad window rejected', () => {
  assert.equal(normalizeCampaign(campaign({ id: '' })), null);
  assert.equal(normalizeCampaign(campaign({ name: '  ' })), null);
  assert.equal(normalizeCampaign(campaign({ startDate: '2026-03-31', endDate: '2026-03-20' })), null);
  assert.equal(normalizeCampaign(null), null);
  const ok = normalizeCampaign(campaign());
  assert.equal(ok.name, 'Eid drive');
  assert.deepEqual(ok.mohallas, campaignMohallaKeys(['Bani', 'Kishti']));
  assert.equal(buildCampaign(campaign()).id, 'c1');
});

test('find/upsert/remove: one campaign per id, invalid rows dropped', () => {
  const list = upsertCampaign([], campaign());
  assert.equal(list.length, 1);
  const replaced = upsertCampaign(list, campaign({ name: 'School fees drive' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].name, 'School fees drive');
  assert.equal(findCampaign(replaced, 'c1').name, 'School fees drive');
  assert.equal(findCampaign(replaced, 'nope'), null);
  assert.equal(upsertCampaign(replaced, campaign({ name: '' })).length, 1);
  assert.deepEqual(removeCampaign(replaced, 'c1'), []);
  assert.equal(removeCampaign(replaced, 'nope').length, 1);
});

test('targets: exactly the selected mohallas\' due customers, summed per customer', () => {
  const result = buildCampaignTargets({ campaign: campaign(), dues });
  assert.equal(result.valid, true);
  assert.deepEqual(result.targets.map((t) => t.customerId), ['a', 'b']);
  assert.equal(result.targets[0].startingDues, 1000);
  assert.equal(result.targets[0].mohalla, 'Banii');
  assert.equal(result.totalStartingDues, 1500);
  assert.equal(result.targetCount, 2);
  assert.equal(result.counts.totalDues, 7);
  assert.equal(result.counts.excludedOtherMohalla, 1);
  assert.equal(result.counts.excludedNoMohalla, 1);
  assert.equal(result.counts.excludedZeroBalance, 2);
  assert.equal(result.counts.excludedInvalid, 1);
});

test('targets: one row per customer even with several due rows, sorted name A-Z', () => {
  const result = buildCampaignTargets({
    campaign: campaign(),
    dues: [
      { customerId: 'b', customerName: 'Bilal', mohalla: 'Kishti', balanceDue: 200 },
      { customerId: 'a', customerName: 'Ahmed', mohalla: 'Bani', balanceDue: 300 },
      { customerId: 'b', customerName: 'Bilal', mohalla: 'Kishti', balanceDue: 100 },
    ],
  });
  assert.deepEqual(result.targets.map((t) => t.customerId), ['a', 'b']);
  assert.equal(result.targets[1].startingDues, 300);
  assert.equal(result.targets[1].dueCount, 2);
});

test('targets: empty selection targets nobody, invalid campaign is invalid', () => {
  const empty = buildCampaignTargets({ campaign: campaign({ mohallas: [] }), dues });
  assert.equal(empty.valid, true);
  assert.equal(empty.targetCount, 0);
  assert.equal(empty.totalStartingDues, 0);
  assert.equal(buildCampaignTargets({ campaign: campaign({ name: '' }), dues }).valid, false);
});

test('attribution: window inclusive both ends, voided and outside-window excluded', () => {
  const targets = buildCampaignTargets({ campaign: campaign(), dues }).targets;
  const result = attributeCampaignCollections({
    campaign: campaign(),
    targets,
    payments: [
      { customerId: 'a', date: '2026-03-20', amount: 400 },
      { customerId: 'a', date: '2026-03-31', amount: 200 },
      { customerId: 'a', date: '2026-03-19', amount: 999 },
      { customerId: 'a', date: '2026-04-01', amount: 999 },
      { customerId: 'a', date: '2026-03-25', amount: 100, voided: true },
      { customerId: 'b', date: '2026-03-25', amount: 500 },
      { customerId: 'c', date: '2026-03-25', amount: 700 },
      { customerId: 'a', date: '2026-02-30', amount: 100 },
      { customerId: 'a', date: '2026-03-25', amount: 0 },
    ],
  });
  assert.equal(result.valid, true);
  assert.equal(result.collected, 1100);
  assert.equal(result.perTarget[0].collected, 600);
  assert.equal(result.perTarget[0].paymentCount, 2);
  assert.equal(result.perTarget[1].collected, 500);
  assert.equal(result.counts.attributedPayments, 3);
  assert.equal(result.counts.excludedVoided, 1);
  assert.equal(result.counts.excludedOutsideWindow, 3);
  assert.equal(result.counts.excludedNonTarget, 1);
  assert.equal(result.counts.excludedZeroBalance, 1);
});

test('summary: starting, collected and still outstanding balance exactly', () => {
  const summary = buildCampaignSummary({
    campaign: campaign(),
    dues,
    payments: [
      { customerId: 'a', date: '2026-03-22', amount: 400 },
      { customerId: 'b', date: '2026-03-22', amount: 600 },
    ],
  });
  assert.equal(summary.valid, true);
  assert.equal(summary.startingDues, 1500);
  assert.equal(summary.collected, 1000);
  assert.equal(summary.stillOutstanding, 600);
  assert.equal(summary.overCollected, 100);
  assert.equal(summary.collectionRatePercent, 66.7);
  assert.equal(summary.startingDues + summary.overCollected, summary.collected + summary.stillOutstanding);
  assert.equal(summary.targets[0].stillOutstanding, 600);
  assert.equal(summary.targets[1].stillOutstanding, 0);
  assert.equal(summary.targets[1].overCollected, 100);
});

test('summary: no starting dues means a null collection rate, never 0% over nothing', () => {
  const summary = buildCampaignSummary({ campaign: campaign(), dues: [], payments: [] });
  assert.equal(summary.valid, true);
  assert.equal(summary.collectionRatePercent, null);
  assert.equal(summary.startingDues, 0);
  assert.equal(summary.collected, 0);
  assert.equal(summary.stillOutstanding, 0);
});

test('summary: invalid campaign yields an invalid summary, never invented figures', () => {
  const summary = buildCampaignSummary({ campaign: campaign({ name: '' }), dues, payments: [] });
  assert.equal(summary.valid, false);
  assert.equal(summary.startingDues, 0);
  assert.equal(summary.collected, 0);
});

test('non-mutation: inputs are never changed by targets, attribution or summary', () => {
  const before = JSON.stringify({ dues, campaign: campaign() });
  buildCampaignSummary({
    campaign: campaign(),
    dues,
    payments: [{ customerId: 'a', date: '2026-03-22', amount: 400 }],
  });
  assert.equal(JSON.stringify({ dues, campaign: campaign() }), before);
});

test('summary text: names the campaign, window, counts and money', () => {
  const summary = buildCampaignSummary({
    campaign: campaign(),
    dues,
    payments: [{ customerId: 'a', date: '2026-03-22', amount: 400 }],
  });
  const textOut = campaignSummaryText(summary);
  assert.match(textOut, /Eid drive/);
  assert.match(textOut, /2026-03-20 to 2026-03-31/);
  assert.match(textOut, /2 target customers/);
  assert.match(textOut, /1500/);
  assert.match(textOut, /400/);
  assert.match(textOut, /1100/);
  assert.equal(campaignSummaryText({ valid: false }), 'No campaign selected.');
});

test('HTML: escapes names and shows the target table with a total row state', () => {
  const summary = buildCampaignSummary({
    campaign: campaign(),
    dues: [{ customerId: 'a', customerName: '<Ahmed & Co>', mohalla: 'Bani', balanceDue: 1000 }],
    payments: [],
  });
  const html = campaignHtml(summary);
  assert.match(html, /&lt;Ahmed &amp; Co&gt;/);
  assert.doesNotMatch(html, /<Ahmed/);
  assert.match(html, /Still outstanding/);
  assert.equal(campaignHtml({ valid: false }), '<p class="empty-state">No campaign selected.</p>');
});

test('CSV: header, rows, total line, and quoting for commas and quotes', () => {
  const summary = buildCampaignSummary({
    campaign: campaign(),
    dues: [
      { customerId: 'a', customerName: 'Ahmed, Jr.', mohalla: 'Bani', balanceDue: 1000 },
      { customerId: 'b', customerName: 'Bilal "B"', mohalla: 'Kishti', balanceDue: 500 },
    ],
    payments: [{ customerId: 'a', date: '2026-03-22', amount: 400 }],
  });
  const csv = campaignCsv(summary);
  assert.match(csv, /^Customer,Mohalla,Starting dues,Collected in window,Still outstanding,Payments\n/);
  assert.match(csv, /"Ahmed, Jr\."/);
  assert.match(csv, /"Bilal ""B"""/);
  assert.match(csv, /TOTAL,,1500,400,1100,/);
  assert.match(csv, /\n$/);
});

test('filename: slug from the campaign name, fallback when unnamed', () => {
  const summary = buildCampaignSummary({ campaign: campaign(), dues: [], payments: [] });
  assert.equal(campaignFilename(summary), 'campaign-eid-drive.csv');
  assert.equal(campaignFilename({ valid: false }), 'campaign-campaign.csv');
});
