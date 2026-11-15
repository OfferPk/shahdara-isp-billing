import test from 'node:test';
import assert from 'node:assert/strict';

import {
  matchCustomerByPhone,
  PaymentsInboxController
} from '../payments-inbox.js';

// Sharafat 56 — two customers sharing one phone match to the first one
// silently. The matcher now returns ALL matches; an ambiguous row never
// auto-matches and the operator must pick. Pattern-fake numbers only
// (03012345678 family) — no realistic numbers, no real customer names.

const SHARED = '03012345678';
const OTHER = '03012345679';

function holder(id, number, name, phone, extra = {}) {
  return { id, customerNumber: number, name, phone, archived: false, bills: [], ...extra };
}

const c1 = holder('c1', 101, 'Test One', SHARED);
const c2 = holder('c2', 102, 'Test Two', SHARED);
const c3 = holder('c3', 103, 'Test Three', OTHER);
// Number lives only in the legacy customerPhone alias.
const cAlias = holder('c4', 104, 'Test Alias', '', { customerPhone: SHARED });
// One customer holding the number via BOTH fields.
const cBoth = holder('c5', 105, 'Test Both', SHARED, { customerPhone: SHARED });
const cArchived = holder('c6', 106, 'Test Archived', SHARED, { archived: true });

function rowItem(overrides = {}) {
  return {
    txnId: 'TESTTXN0001',
    direction: 'Received',
    date: '2026-10-15',
    datetime: '2026-10-15 10:00',
    amount: 3000,
    senderName: 'Test One',
    senderNumber: SHARED,
    recorded: false,
    status: '',
    ...overrides
  };
}

function renderRow(item, customers, inbox = new PaymentsInboxController()) {
  return inbox.renderTransactionRow(item, customers, null);
}

// --- Matcher: ambiguity ---

test('sharafat 56: two customers sharing one phone are ambiguous, match is null', () => {
  const res = matchCustomerByPhone(SHARED, [c1, c2]);
  assert.equal(res.ambiguous, true);
  assert.equal(res.match, null);
  assert.deepEqual(res.matches.map(c => c.id), ['c1', 'c2']);
});

test('sharafat 56: reversed roster still ambiguous, matches follow roster order', () => {
  const res = matchCustomerByPhone(SHARED, [c2, c1]);
  assert.equal(res.ambiguous, true);
  assert.equal(res.match, null);
  assert.deepEqual(res.matches.map(c => c.id), ['c2', 'c1']);
});

test('sharafat 56: +92 sender form still finds both holders', () => {
  const res = matchCustomerByPhone('+92 301 2345678', [c1, c2]);
  assert.equal(res.ambiguous, true);
  assert.deepEqual(res.matches.map(c => c.id), ['c1', 'c2']);
});

// --- Matcher: single match still auto-matches ---

test('sharafat 56: single holder still auto-matches', () => {
  const res = matchCustomerByPhone(SHARED, [c1]);
  assert.equal(res.ambiguous, false);
  assert.equal(res.match?.id, 'c1');
  assert.deepEqual(res.matches.map(c => c.id), ['c1']);
});

test('sharafat 56: a different number matches only its own holder', () => {
  const res = matchCustomerByPhone(OTHER, [c1, c2, c3]);
  assert.equal(res.ambiguous, false);
  assert.equal(res.match?.id, 'c3');
});

test('sharafat 56: no holder is no match', () => {
  const res = matchCustomerByPhone(SHARED, [c3]);
  assert.equal(res.ambiguous, false);
  assert.equal(res.match, null);
  assert.deepEqual(res.matches, []);
});

test('sharafat 56: invalid input is no match', () => {
  assert.deepEqual(matchCustomerByPhone('', [c1]), { match: null, matches: [], ambiguous: false });
  assert.deepEqual(matchCustomerByPhone(SHARED, null), { match: null, matches: [], ambiguous: false });
});

// --- Matcher: archived excluded, dedupe by id ---

test('sharafat 56: only an archived holder is no match', () => {
  const res = matchCustomerByPhone(SHARED, [cArchived]);
  assert.equal(res.match, null);
  assert.equal(res.ambiguous, false);
});

test('sharafat 56: one live + one archived holder is NOT ambiguous', () => {
  const res = matchCustomerByPhone(SHARED, [c1, cArchived]);
  assert.equal(res.ambiguous, false);
  assert.equal(res.match?.id, 'c1');
  assert.deepEqual(res.matches.map(c => c.id), ['c1']);
});

test('sharafat 56: the same record twice is one holder, not two', () => {
  const res = matchCustomerByPhone(SHARED, [c1, c1]);
  assert.equal(res.ambiguous, false);
  assert.equal(res.match?.id, 'c1');
  assert.deepEqual(res.matches.map(c => c.id), ['c1']);
});

// --- Matcher: the legacy customerPhone alias counts (parent addition) ---

test('sharafat 56: a holder visible only via the customerPhone alias matches', () => {
  const res = matchCustomerByPhone(SHARED, [cAlias]);
  assert.equal(res.ambiguous, false);
  assert.equal(res.match?.id, 'c4');
});

test('sharafat 56: a phone-vs-alias pair sharing one number IS ambiguous', () => {
  const res = matchCustomerByPhone(SHARED, [c1, cAlias]);
  assert.equal(res.ambiguous, true);
  assert.equal(res.match, null);
  assert.deepEqual(res.matches.map(c => c.id), ['c1', 'c4']);
});

test('sharafat 56: one customer matching via both phone and alias counts once', () => {
  const res = matchCustomerByPhone(SHARED, [cBoth]);
  assert.equal(res.ambiguous, false);
  assert.equal(res.match?.id, 'c5');
  assert.deepEqual(res.matches.map(c => c.id), ['c5']);
});

// --- Row render: the ambiguous row asks the operator to choose ---

test('sharafat 56: ambiguous row shows "needs review — shared number", no auto-match', () => {
  const html = renderRow(rowItem(), [c1, c2]);
  assert.ok(html.includes('needs review — shared number'));
  assert.ok(!html.includes('✓ Matched'));
  assert.ok(!html.includes('selected'));
});

test('sharafat 56: single-match row still shows ✓ Matched with the option pre-selected', () => {
  const html = renderRow(rowItem(), [c1, c3]);
  assert.ok(html.includes('✓ Matched: #101 Test One'));
  assert.ok(html.includes('selected'));
});

test('sharafat 56: operator pick on an ambiguous row wins over the ambiguity', () => {
  const inbox = new PaymentsInboxController();
  inbox.selectedCustomerMatches.set('TESTTXN0001', 'c2');
  const html = renderRow(rowItem(), [c1, c2], inbox);
  assert.ok(html.includes('✓ Matched: #102 Test Two'));
  assert.ok(!html.includes('needs review — shared number'));
});

test('sharafat 56: no-match row still shows the link prompt', () => {
  const html = renderRow(rowItem(), [c3]);
  assert.ok(html.includes('-- Link to Customer --'));
  assert.ok(!html.includes('needs review — shared number'));
});
