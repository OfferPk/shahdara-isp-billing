// Sharafat 72 — the complaint zone filter offered zones that match
// nothing: collectComplaintZones seeded its dropdown with
// ['Shahdara Town', 'Barrian', 'Palaliya', 'Chandall', 'Banii'] and
// never read complaint zones at all, while filterComplaints matched
// zone by exact string equality although complaint zones are stored
// as free text. The dropdown is now the 12 numbered mohallas always,
// plus zones actually in use on a customer or a complaint, and the
// filter matches through the canonical mohalla (rank-or-key), so
// spelling variants fold together. Tests on synthetic data only: no
// real customer names, no phone numbers anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectComplaintZones, filterComplaints } from '../complaint-register.js';
import { canonicalMohalla, recoveryMohallaRank } from '../phase3.js';

const c = (id, zone, extra = {}) => ({
  id, customerId: `c-${id}`, customerName: 'Test Customer', zone,
  issueCategory: 'Fiber Cut', reportedAt: '2026-10-28T10:00', status: 'Open', ...extra,
});

const complaints = [
  c('CMP-101', 'Palaliya'),
  c('CMP-102', 'Barrian'),
  c('CMP-103', 'THALII'),
  c('CMP-104', 'Haweli'),
  c('CMP-105', 'Bani'),
  c('CMP-106', 'PALALIYAA'),
  c('CMP-107', 'Chandall'),
];

const CANONICAL_12 = ['Charyaa', 'Gangall', 'Barrian', 'Chamyaaa', 'Malla', 'Palaliyaa', 'Thali', 'Nakar', 'Banii', 'Jabbiyaa', 'Sodaa', 'Haweli OR END Point'];

test('collection: the 12 canonical mohallas are always present, in numbered order', () => {
  assert.deepEqual(collectComplaintZones({ customers: [] }), CANONICAL_12);
  assert.deepEqual(collectComplaintZones({ customers: [] }, []), CANONICAL_12);
});

test('collection: no seed entries with nothing in use', () => {
  const zones = collectComplaintZones({ customers: [] });
  // 'Banii' is NOT in this list: it is the canonical #9 display label
  // (the owner's standard spelling), not a seed entry — the seed's
  // 'Banii' string coincides with it, so it cannot pin the seed's removal.
  for (const phantom of ['Chandall', 'Palaliya', 'Shahdara Town']) {
    assert.ok(!zones.includes(phantom), `${phantom} must not come from a seed`);
  }
  assert.ok(zones.includes('Banii'), 'Banii is the canonical #9 entry');
});

test('collection: a zone present only on a complaint appears', () => {
  const zones = collectComplaintZones({ customers: [] }, [c('CMP-201', 'Custom Zone')]);
  assert.ok(zones.includes('Custom Zone'));
});

test('collection: a zone present only on a customer appears', () => {
  const zones = collectComplaintZones({ customers: [{ zone: 'Custom Zone' }] });
  assert.ok(zones.includes('Custom Zone'));
});

test('collection: variants collapse to one canonical entry', () => {
  const zones = collectComplaintZones(
    { customers: [{ zone: 'PALALIYAA' }] },
    [c('CMP-201', 'Palaliya')],
  );
  assert.equal(zones.filter((z) => z === 'Palaliyaa').length, 1);
  assert.ok(!zones.includes('Palaliya'));
  assert.ok(!zones.includes('PALALIYAA'));
});

test('collection: a non-canonical zone in use appears raw, even Shahdara Town', () => {
  const zones = collectComplaintZones({ customers: [{ zone: 'Shahdara Town' }] }, [c('CMP-201', 'Chandall')]);
  assert.ok(zones.includes('Shahdara Town'));
  assert.ok(zones.includes('Chandall'));
});

test('collection: numbered first, then in-use extras alphabetically', () => {
  const zones = collectComplaintZones(
    { customers: [{ zone: 'Custom Zone' }, { zone: 'Another Zone' }] },
    [c('CMP-201', 'Chandall')],
  );
  assert.deepEqual(zones.slice(0, 12), CANONICAL_12);
  assert.deepEqual(zones.slice(12), ['Another Zone', 'Chandall', 'Custom Zone']);
});

test('collection: duplicate and blank zones are ignored', () => {
  const zones = collectComplaintZones({ customers: [{ zone: 'Barrian' }, { zone: 'Barrian' }, { zone: '' }, { zone: '   ' }] });
  assert.equal(zones.filter((z) => z === 'Barrian').length, 1);
  assert.deepEqual(zones, CANONICAL_12);
});

test('filter: Palaliyaa finds a complaint stored as Palaliya (acceptance case)', () => {
  assert.deepEqual(filterComplaints(complaints, { zone: 'Palaliyaa' }).map((x) => x.id), ['CMP-101', 'CMP-106']);
});

test('filter: THALI finds THALII, HAWELI OR END POINT finds Haweli, BANII finds Bani', () => {
  assert.deepEqual(filterComplaints(complaints, { zone: 'THALI' }).map((x) => x.id), ['CMP-103']);
  assert.deepEqual(filterComplaints(complaints, { zone: 'HAWELI OR END POINT' }).map((x) => x.id), ['CMP-104']);
  assert.deepEqual(filterComplaints(complaints, { zone: 'BANII' }).map((x) => x.id), ['CMP-105']);
});

test('filter: prefixed and case variants still match', () => {
  assert.deepEqual(filterComplaints(complaints, { zone: 'MOHALLA BANI' }).map((x) => x.id), ['CMP-105']);
  assert.deepEqual(filterComplaints(complaints, { zone: 'palaliyaa' }).map((x) => x.id), ['CMP-101', 'CMP-106']);
  assert.deepEqual(filterComplaints(complaints, { zone: '  Palaliya  ' }).map((x) => x.id), ['CMP-101', 'CMP-106']);
});

test('filter: a non-canonical stored zone is still findable by its own spelling', () => {
  assert.deepEqual(filterComplaints(complaints, { zone: 'Chandall' }).map((x) => x.id), ['CMP-107']);
  assert.deepEqual(filterComplaints(complaints, { zone: 'chandall' }).map((x) => x.id), ['CMP-107']);
});

test('filter: empty zone returns everything, an unmatched zone returns none', () => {
  assert.equal(filterComplaints(complaints, {}).length, 7);
  assert.equal(filterComplaints(complaints, { zone: '' }).length, 7);
  assert.deepEqual(filterComplaints(complaints, { zone: 'Nowhere' }), []);
});

test('alias: Palaliya folds to PALALIYAA, rank #6, prefixed spelling too', () => {
  assert.equal(canonicalMohalla('Palaliya').key, 'palaliyaa');
  assert.equal(canonicalMohalla('Palaliya').stored, 'PALALIYAA');
  assert.equal(recoveryMohallaRank('Palaliya').number, 6);
  assert.equal(recoveryMohallaRank('Palaliya').label, 'PALALIYAA');
  assert.equal(canonicalMohalla('MOHALLA PALALIYA').key, 'palaliyaa');
  assert.equal(recoveryMohallaRank('MOHALLA PALALIYA').number, 6);
  // The composite #12 label ranks to #12 too, so the dropdown's own
  // #12 option finds Haweli/End Point complaints (Sharafat 72: the
  // prep's rank-or-key rule alone does not fold it — recoveryMohallaRank
  // returned null for it — so 'haweli or end point' joins the #12 keys).
  assert.equal(recoveryMohallaRank('HAWELI OR END POINT').number, 12);
  assert.equal(recoveryMohallaRank('Haweli OR END Point').number, 12);
});
