import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validReferralOutcomeDate,
  normalizeReferralOutcomeList,
  recordReferralOutcome,
  removeReferralOutcome,
  findReferralOutcome,
  addReferralOutcomeNote,
  referralOutcomeSorted,
  latestReferralOutcome,
  referralOutcomesForReferrer,
  referralOutcomeCounts,
  referralOutcomeReferrers,
  referralOutcomeSummaryText,
  referralOutcomeText,
  referralOutcomeHtml,
  referralOutcomeAllHtml,
  referralOutcomeCsv,
  referralOutcomeFilename,
} from '../referral-outcome.js';

const first = { id: 'RO-1', referrer: 'Ahmed Raza', referredCustomer: 'Bilal Ahmed', outcome: 'joined', date: '2026-11-01', note: 'Activated and online.' };
const second = { id: 'RO-2', referrer: 'Ahmed Raza', referredCustomer: 'Chaudhry Naveed', outcome: 'stayed', date: '2026-10-15', note: '' };
const third = { id: 'RO-3', referrer: 'Saad Khan', referredCustomer: 'Bilal Ahmed', outcome: 'left', date: '2026-11-05', note: 'Moved away.' };

test('half-formed outcome entries are refused', () => {
  assert.deepEqual(recordReferralOutcome([], { ...first, id: '' }), []);
  assert.deepEqual(recordReferralOutcome([], { ...first, referrer: '  ' }), []);
  assert.deepEqual(recordReferralOutcome([], { ...first, referredCustomer: '' }), []);
  assert.deepEqual(recordReferralOutcome([], { ...first, date: '' }), []);
  assert.deepEqual(recordReferralOutcome([], { ...first, date: '2026-02-30' }), []);
  assert.deepEqual(recordReferralOutcome([], { ...first, outcome: '' }), []);
  assert.deepEqual(recordReferralOutcome([], { ...first, outcome: 'maybe' }), []);
  assert.deepEqual(recordReferralOutcome([], { ...first, outcome: 'pending' }), []);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validReferralOutcomeDate('2026-08-31'), true);
  assert.equal(validReferralOutcomeDate('2026-10-31'), true);
  assert.equal(validReferralOutcomeDate('2026-12-31'), true);
  assert.equal(validReferralOutcomeDate('2026-02-29'), false);
  assert.equal(validReferralOutcomeDate('2028-02-29'), true);
  assert.equal(validReferralOutcomeDate('2026-04-31'), false);
  assert.equal(validReferralOutcomeDate('2026-13-01'), false);
  assert.equal(validReferralOutcomeDate('10-11-2026'), false);
  assert.equal(validReferralOutcomeDate(''), false);
  assert.equal(validReferralOutcomeDate(null), false);
});

test('outcome accepts joined/stayed/left words only, case-insensitively', () => {
  assert.equal(recordReferralOutcome([], { ...first, id: 'RO-9', outcome: 'JOINED' })[0].outcome, 'joined');
  assert.equal(recordReferralOutcome([], { ...first, id: 'RO-9', outcome: ' Stayed ' })[0].outcome, 'stayed');
  assert.equal(recordReferralOutcome([], { ...first, id: 'RO-9', outcome: 'LEFT' })[0].outcome, 'left');
  assert.deepEqual(recordReferralOutcome([], { ...first, outcome: true }), []);
  assert.deepEqual(recordReferralOutcome([], { ...first, outcome: undefined }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, creditAmount: 500, billId: 'B-1', paymentId: 'P-1', discount: '10%' };
  const recorded = recordReferralOutcome([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('creditAmount' in recorded[0], false);
  assert.equal('billId' in recorded[0], false);
  assert.equal('paymentId' in recorded[0], false);
  assert.equal('discount' in recorded[0], false);
  assert.equal(recorded[0].note, 'Activated and online.');
  assert.deepEqual(recorded[0].followups, []);
  const before = JSON.stringify(first);
  recordReferralOutcome([], first);
  assert.equal(JSON.stringify(first), before);
});

test('duplicate ids and a second entry for the same referred customer on the same date are refused', () => {
  const list = recordReferralOutcome([], first);
  assert.deepEqual(recordReferralOutcome(list, { ...first, outcome: 'stayed' }), list);
  assert.deepEqual(recordReferralOutcome(list, { ...second, id: 'RO-9', referredCustomer: 'bilal ahmed', date: '2026-11-01' }), list);
  const later = recordReferralOutcome(list, { ...first, id: 'RO-9', outcome: 'stayed', date: '2026-12-01' });
  assert.equal(later.length, 2);
  assert.deepEqual(recordReferralOutcome(later, { ...first, id: 'RO-10', outcome: 'left', date: '2026-12-01' }), later);
});

test('find and remove work by id only', () => {
  const list = recordReferralOutcome(recordReferralOutcome([], first), second);
  assert.equal(findReferralOutcome(list, 'RO-1').referredCustomer, 'Bilal Ahmed');
  assert.equal(findReferralOutcome(list, 'RO-9'), null);
  assert.equal(findReferralOutcome(list, ''), null);
  assert.deepEqual(removeReferralOutcome(list, 'RO-1').map((item) => item.id), ['RO-2']);
  assert.deepEqual(removeReferralOutcome(list, 'RO-9'), list);
});

test('entries sort by date, then referrer, then referred customer, then id', () => {
  const list = recordReferralOutcome(
    recordReferralOutcome(recordReferralOutcome([], third), first),
    second,
  );
  assert.deepEqual(referralOutcomeSorted(list).map((item) => item.id), ['RO-2', 'RO-1', 'RO-3']);
});

test('latest outcome per referred customer is the entry with the latest date', () => {
  const list = recordReferralOutcome(
    recordReferralOutcome(recordReferralOutcome([], first), second),
    { ...first, id: 'RO-9', outcome: 'left', date: '2026-12-01', note: 'Left after a month.' },
  );
  const latest = latestReferralOutcome(list, 'bilal ahmed');
  assert.equal(latest.outcome, 'left');
  assert.equal(latest.date, '2026-12-01');
  assert.equal(latestReferralOutcome(list, 'Nobody'), null);
  assert.equal(latestReferralOutcome(list, ''), null);
});

test('a referrer page shows referred customers with their latest outcome', () => {
  const list = recordReferralOutcome(
    recordReferralOutcome(recordReferralOutcome([], first), second),
    { ...first, id: 'RO-9', outcome: 'stayed', date: '2026-12-01', note: 'Still online.' },
  );
  const page = referralOutcomesForReferrer(list, 'ahmed raza');
  assert.deepEqual(page.map((row) => row.referredCustomer), ['Bilal Ahmed', 'Chaudhry Naveed']);
  assert.equal(page[0].outcome, 'stayed');
  assert.equal(page[0].date, '2026-12-01');
  assert.equal(page[1].outcome, 'stayed');
  assert.deepEqual(referralOutcomesForReferrer(list, 'Saad Khan'), []);
  assert.deepEqual(referralOutcomesForReferrer(list, ''), []);
});

test('counts sum to the referrals recorded, including no-outcome rows', () => {
  const list = recordReferralOutcome(recordReferralOutcome([], first), second);
  const counts = referralOutcomeCounts(list, 'Ahmed Raza', ['Bilal Ahmed', 'Chaudhry Naveed', 'Danish Ali', 'bilal ahmed', '  ']);
  assert.deepEqual(counts, { joined: 1, stayed: 1, left: 0, noOutcome: 1, total: 3 });
  assert.equal(counts.joined + counts.stayed + counts.left + counts.noOutcome, counts.total);
  assert.deepEqual(referralOutcomeCounts(list, 'Saad Khan', ['Bilal Ahmed']), { joined: 0, stayed: 0, left: 0, noOutcome: 1, total: 1 });
  assert.deepEqual(referralOutcomeCounts(list, '', ['Bilal Ahmed']), { joined: 0, stayed: 0, left: 0, noOutcome: 0, total: 0 });
});

test('an outcome entry is never edited, only annotated with dated notes', () => {
  const list = recordReferralOutcome([], first);
  const noted = addReferralOutcomeNote(list, 'RO-1', '2026-11-10', 'Checked in, still happy.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].outcome, 'joined');
  assert.equal(noted[0].date, '2026-11-01');
  assert.equal(noted[0].note, 'Activated and online.');
  assert.deepEqual(addReferralOutcomeNote(list, 'RO-1', '2026-02-30', 'Bad date.'), list);
  assert.deepEqual(addReferralOutcomeNote(list, 'RO-1', '2026-11-10', ''), list);
  assert.deepEqual(addReferralOutcomeNote(list, 'RO-9', '2026-11-10', 'Unknown id.'), list);
});

test('referrer list keeps first spelling only', () => {
  const list = recordReferralOutcome(
    recordReferralOutcome(recordReferralOutcome([], first), second),
    third,
  );
  assert.deepEqual(referralOutcomeReferrers(list), ['Ahmed Raza', 'Saad Khan']);
  assert.deepEqual(
    referralOutcomeReferrers(recordReferralOutcome(list, { ...second, id: 'RO-9', referrer: 'ahmed raza', referredCustomer: 'Ehsan Ali' })),
    ['Ahmed Raza', 'Saad Khan'],
  );
});

test('summary text counts outcomes', () => {
  assert.equal(referralOutcomeSummaryText([]), 'No referral outcomes recorded.');
  const list = recordReferralOutcome(
    recordReferralOutcome(recordReferralOutcome([], first), second),
    third,
  );
  assert.equal(referralOutcomeSummaryText(list), '3 referral outcomes: 1 joined, 1 stayed, 1 left.');
});

test('entry text, html escaping, and all-html list', () => {
  assert.equal(referralOutcomeText(first), 'Bilal Ahmed referred by Ahmed Raza — joined on 2026-11-01. Note: Activated and online.');
  assert.equal(referralOutcomeText(second), 'Chaudhry Naveed referred by Ahmed Raza — stayed on 2026-10-15.');
  assert.equal(referralOutcomeText(null), 'No referral outcome recorded.');
  const nasty = { ...first, id: 'RO-9', referredCustomer: '<b>Alice</b> & "Bob"' };
  assert.equal(referralOutcomeHtml(nasty).includes('<b>'), false);
  assert.equal(referralOutcomeHtml(nasty).includes('&lt;b&gt;Alice&lt;/b&gt;'), true);
  assert.equal(referralOutcomeHtml(null), '<p>No referral outcome recorded.</p>');
  assert.equal(referralOutcomeAllHtml([]), '<p>No referral outcomes recorded.</p>');
  assert.equal(referralOutcomeAllHtml([first]).startsWith('<ul>'), true);
});

test('csv export and filename', () => {
  const list = recordReferralOutcome(recordReferralOutcome([], first), second);
  const csv = referralOutcomeCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","referrer","referred customer","outcome","date","note","follow-ups"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('"RO-2"'), true);
  assert.equal(referralOutcomeFilename(), 'referral-outcomes.csv');
});

test('list normalisation drops bad rows, duplicate ids, and same-customer same-date rows', () => {
  const list = normalizeReferralOutcomeList([
    first,
    { ...first, outcome: 'stayed' },
    { ...first, id: 'RO-9', outcome: 'bogus' },
    null,
    second,
    { ...second, id: 'RO-2', referredCustomer: 'Someone Else' },
  ]);
  assert.deepEqual(list.map((item) => item.id), ['RO-1', 'RO-2']);
});

test('module stays pure: no storage, clock, or network access', () => {
  const source = readFileSync(new URL('../referral-outcome.js', import.meta.url), 'utf8');
  for (const banned of ['localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'window.', 'globalThis', 'new Date(', 'Date.now(']) {
    assert.equal(source.includes(banned), false, `banned token present: ${banned}`);
  }
});

test('neighbour modules are fenced off: no referral record or thank-you draft is read or written', () => {
  const source = readFileSync(new URL('../referral-outcome.js', import.meta.url), 'utf8');
  for (const fenced of ['referral-tracking.js', 'referral-thanks.js', 'referral-credits.js']) {
    assert.equal(source.includes(fenced), false, `fenced module referenced: ${fenced}`);
  }
  assert.equal(source.includes('import '), false);
});

test('panel ids exist in index.html and app.js wires the panel', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['roList', 'roSummary', 'roExportBtn', 'roReferrer', 'roReferred', 'roOutcome', 'roDate', 'roNote', 'roRecordBtn', 'roAnnotateId', 'roAnnotateDate', 'roAnnotateNote', 'roAnnotateBtn', 'roRemoveId', 'roRemoveBtn', 'roFilterReferrer', 'roFilterReferred', 'roFilterBtn', 'roFilterBody']) {
    assert.equal(html.includes(`id="${id}"`), true, `missing panel id: ${id}`);
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(app.includes('referral-outcome.js'), true);
  assert.equal(app.includes('loadReferralOutcomes'), true);
  assert.equal(app.includes('renderReferralOutcomes'), true);
  assert.equal(app.includes('shahdara_referral_outcomes_v1'), true);
});

test('deployment guard: app.js carries no standalone OLT word', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(app), false);
});
