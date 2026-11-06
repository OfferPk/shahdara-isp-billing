import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validRestoreVerificationDay,
  foldRestoreVerificationCounts,
  normalizeRestoreVerification,
  normalizeRestoreVerificationList,
  findRestoreVerification,
  recordRestoreVerification,
  removeRestoreVerification,
  verifyRestoreVerification,
  restoreVerificationVerdict,
  restoreVerificationCountsMatch,
  unverifiedRestoreVerifications,
  restoreVerificationNoteSummaryText,
  restoreVerificationSummaryText,
  restoreVerificationNoteHtml,
  restoreVerificationHtml,
  restoreVerificationCsv,
  restoreVerificationFilename,
} from '../restore-verification.js';

function note(id, overrides = {}) {
  return {
    id,
    restoreDate: '2026-11-05',
    source: 'Shop USB 1',
    countsBefore: { customers: 100, bills: 120, payments: 95 },
    countsAfter: { customers: 100, bills: 120, payments: 95 },
    verifier: 'Saad',
    verified: true,
    ...overrides,
  };
}

function fixture() {
  return [
    note('RVN-1', { restoreDate: '2026-11-01', verified: true }),
    note('RVN-2', {
      restoreDate: '2026-11-03',
      countsAfter: { customers: 99, bills: 120, payments: 95 },
      verified: false,
    }),
    note('RVN-3', { restoreDate: '2026-11-05', verified: false }),
  ];
}

test('a valid note records and keeps its fields', () => {
  const next = recordRestoreVerification([], note('RVN-1'));
  assert.equal(next.length, 1);
  assert.equal(next[0].source, 'Shop USB 1');
  assert.equal(next[0].countsBefore.customers, 100);
  assert.equal(next[0].verified, true);
});

test('a note is refused with no id, no source, or no verifier', () => {
  assert.deepEqual(recordRestoreVerification([], note('', {})), []);
  assert.deepEqual(recordRestoreVerification([], note('RVN-1', { source: '   ' })), []);
  assert.deepEqual(recordRestoreVerification([], note('RVN-1', { verifier: '' })), []);
});

test('a note is refused with no strict restore date', () => {
  assert.deepEqual(recordRestoreVerification([], note('RVN-1', { restoreDate: '2026-02-30' })), []);
  assert.deepEqual(recordRestoreVerification([], note('RVN-1', { restoreDate: '2027-02-29' })), []);
  assert.deepEqual(recordRestoreVerification([], note('RVN-1', { restoreDate: '5 Nov 2026' })), []);
  assert.deepEqual(recordRestoreVerification([], note('RVN-1', { restoreDate: '' })), []);
});

test('a leap day restore date is accepted', () => {
  assert.equal(validRestoreVerificationDay('2028-02-29'), true);
  assert.equal(recordRestoreVerification([], note('RVN-1', { restoreDate: '2028-02-29' })).length, 1);
});

test('a note is refused with a bad count', () => {
  const badCounts = [
    { customers: -1, bills: 120, payments: 95 },
    { customers: 100.5, bills: 120, payments: 95 },
    { customers: 'many', bills: 120, payments: 95 },
    { customers: 100, bills: 120 },
    null,
  ];
  for (const counts of badCounts) {
    assert.deepEqual(recordRestoreVerification([], note('RVN-1', { countsBefore: counts })), []);
    assert.deepEqual(recordRestoreVerification([], note('RVN-1', { countsAfter: counts })), []);
  }
});

test('digit-string counts are accepted as whole numbers', () => {
  const next = recordRestoreVerification([], note('RVN-1', {
    countsBefore: { customers: '100', bills: '120', payments: '95' },
    countsAfter: { customers: '100', bills: '120', payments: '95' },
  }));
  assert.equal(next.length, 1);
  assert.equal(next[0].countsBefore.customers, 100);
});

test('a duplicate id is never rewritten', () => {
  const list = fixture();
  const next = recordRestoreVerification(list, note('RVN-1', { source: 'Other drive' }));
  assert.equal(next.length, 3);
  assert.equal(findRestoreVerification(next, 'RVN-1').source, 'Shop USB 1');
});

test('unknown fields are dropped so no bill, payment, or customer field survives', () => {
  const next = recordRestoreVerification([], note('RVN-1', { amount: 3000, customerId: 'C-1', paid: true }));
  assert.equal('amount' in next[0], false);
  assert.equal('customerId' in next[0], false);
  assert.equal('paid' in next[0], false);
});

test('the verdict matches when all counts are equal', () => {
  const verdict = restoreVerificationVerdict(note('RVN-1'));
  assert.equal(verdict.matched, true);
  assert.deepEqual(verdict.mismatches, []);
  assert.equal(restoreVerificationCountsMatch(note('RVN-1')), true);
});

test('the verdict names each mismatch with both counts', () => {
  const verdict = restoreVerificationVerdict(note('RVN-1', {
    countsAfter: { customers: 98, bills: 120, payments: 94 },
  }));
  assert.equal(verdict.matched, false);
  assert.deepEqual(verdict.mismatches, [
    { record: 'customers', before: 100, after: 98 },
    { record: 'payments', before: 95, after: 94 },
  ]);
  assert.equal(restoreVerificationCountsMatch(note('RVN-1', {
    countsAfter: { customers: 98, bills: 120, payments: 94 },
  })), false);
});

test('the verdict is null for a note that cannot be normalised', () => {
  assert.equal(restoreVerificationVerdict({ id: 'RVN-1' }), null);
});

test('marking a note verified changes only that note', () => {
  const next = verifyRestoreVerification(fixture(), 'RVN-2');
  assert.equal(findRestoreVerification(next, 'RVN-2').verified, true);
  assert.equal(findRestoreVerification(next, 'RVN-3').verified, false);
  assert.equal(findRestoreVerification(next, 'RVN-1').verified, true);
});

test('marking a missing note verified changes nothing', () => {
  const list = fixture();
  assert.deepEqual(verifyRestoreVerification(list, 'RVN-9'), list);
});

test('unverified restores list newest first and only the unverified ones', () => {
  const open = unverifiedRestoreVerifications(fixture());
  assert.deepEqual(open.map((entry) => entry.id), ['RVN-3', 'RVN-2']);
});

test('removing a note drops only that note', () => {
  const next = removeRestoreVerification(fixture(), 'RVN-2');
  assert.deepEqual(next.map((entry) => entry.id), ['RVN-1', 'RVN-3']);
  assert.deepEqual(removeRestoreVerification(fixture(), 'RVN-9').map((entry) => entry.id), ['RVN-1', 'RVN-2', 'RVN-3']);
});

test('the summary text counts matches, mismatches, and unverified notes', () => {
  assert.equal(
    restoreVerificationSummaryText(fixture()),
    '3 restore verification notes: 2 match, 1 mismatch, 2 unverified.',
  );
});

test('the note summary names the mismatch in plain words', () => {
  assert.equal(
    restoreVerificationNoteSummaryText(note('RVN-2', {
      restoreDate: '2026-11-03',
      countsAfter: { customers: 99, bills: 120, payments: 95 },
      verified: false,
    })),
    '2026-11-03 from Shop USB 1: mismatch — customers: 100 before, 99 after — unverified',
  );
});

test('the html shows counts side by side and escapes user text', () => {
  const html = restoreVerificationNoteHtml(note('RVN-1', { source: '<script>alert(1)</script>' }));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('<td>100</td>'), true);
  assert.equal(restoreVerificationHtml([]), '<p>No restore verifications recorded.</p>');
});

test('the csv carries every field and the filename is stable', () => {
  const csv = restoreVerificationCsv(fixture());
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,restore date,source,customers before,bills before,payments before,customers after,bills after,payments after,matched,verifier,verified');
  assert.equal(lines.length, 4);
  assert.equal(lines[2].includes('RVN-2'), true);
  assert.equal(lines[2].includes('mismatch'), true);
  assert.equal(restoreVerificationFilename(), 'restore-verification-notes.csv');
});

test('the module never mutates its input', () => {
  const frozen = Object.freeze(fixture().map((entry) => Object.freeze({
    ...entry,
    countsBefore: Object.freeze({ ...entry.countsBefore }),
    countsAfter: Object.freeze({ ...entry.countsAfter }),
  })));
  assert.doesNotThrow(() => {
    recordRestoreVerification(frozen, note('RVN-4'));
    verifyRestoreVerification(frozen, 'RVN-2');
    unverifiedRestoreVerifications(frozen);
    restoreVerificationCsv(frozen);
  });
  assert.equal(frozen[0].verified, true);
});

test('the module is pure: it reads no storage, clock, or network', () => {
  const source = readFileSync(new URL('../restore-verification.js', import.meta.url), 'utf8');
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('XMLHttpRequest'), false);
});

test('the module keeps its fences: no fenced file, no OLT', () => {
  const source = readFileSync(new URL('../restore-verification.js', import.meta.url), 'utf8');
  for (const fenced of ['restore-drill', 'backup-verification', 'backup-media-register']) {
    assert.equal(source.includes(fenced), false, `module must not name the fenced module ${fenced}`);
  }
  assert.equal(source.includes('OLT'), false);
});
