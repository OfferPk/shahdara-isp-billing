// Plan 436 — Quick Collect offline saved badge: one saved badge on the
// Quick Collect success screen ("saved on this device", with the save
// time), shown for every offline save. It badges only and it syncs
// nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  offlineSavedBadgeTime,
  offlineSavedBadge,
  offlineSavedBadgeLatestTime,
  offlineSavedBadgeLineText,
  offlineSavedBadgeHtml,
} from '../offline-saved-badge.js';

const moduleSrc = readFileSync(new URL('../offline-saved-badge.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The save instant the recorder stamps: 2026-11-07 13:36 Pakistan time,
// stored as the UTC ISO stamp the payment record carries.
const SAVE_STAMP = '2026-11-07T08:36:41.123Z';

test('time: a UTC morning stamp reads as Pakistan afternoon time', () => {
  assert.equal(offlineSavedBadgeTime(SAVE_STAMP), '13:36');
  assert.equal(offlineSavedBadgeTime('2026-11-07T00:00:00.000Z'), '05:00');
  assert.equal(offlineSavedBadgeTime('2026-11-07T12:05:00.000Z'), '17:05');
});

test('time: a stamp past 19:00 UTC wraps to the next day early hours', () => {
  assert.equal(offlineSavedBadgeTime('2026-11-07T19:00:00.000Z'), '00:00');
  assert.equal(offlineSavedBadgeTime('2026-11-07T20:00:00.000Z'), '01:00');
  assert.equal(offlineSavedBadgeTime('2026-11-07T18:59:00.000Z'), '23:59');
});

test('time: non-string and malformed stamps give no time', () => {
  for (const bad of [null, undefined, 0, true, '', 'not a date', '2026-11-07', '2026/11/07 13:36', '2026-11-07 13:36']) {
    assert.equal(offlineSavedBadgeTime(bad), '', `expected no time for ${String(bad)}`);
  }
});

test('time: out-of-range fields give no time, never a guessed one', () => {
  for (const bad of ['2026-13-07T08:36:00.000Z', '2026-00-07T08:36:00.000Z', '2026-11-32T08:36:00.000Z', '2026-11-00T08:36:00.000Z', '2026-11-07T24:36:00.000Z', '2026-11-07T08:60:00.000Z']) {
    assert.equal(offlineSavedBadgeTime(bad), '', `expected no time for ${bad}`);
  }
});

test('badge: a usable stamp gives a badge carrying the save time', () => {
  assert.deepEqual(offlineSavedBadge(SAVE_STAMP), { time: '13:36' });
});

test('badge: a missing or unusable stamp gives no badge', () => {
  assert.equal(offlineSavedBadge(''), null);
  assert.equal(offlineSavedBadge(null), null);
  assert.equal(offlineSavedBadge('2026-13-07T08:36:00.000Z'), null);
});

test('latest: the later of two stamps wins', () => {
  assert.equal(
    offlineSavedBadgeLatestTime(['2026-11-07T08:30:00.000Z', '2026-11-07T08:36:41.123Z']),
    '2026-11-07T08:36:41.123Z'
  );
  assert.equal(
    offlineSavedBadgeLatestTime(['2026-11-07T08:36:41.123Z', '2026-11-07T08:30:00.000Z']),
    '2026-11-07T08:36:41.123Z'
  );
  assert.equal(offlineSavedBadgeLatestTime(['2026-11-07T08:36:41.123Z']), '2026-11-07T08:36:41.123Z');
});

test('latest: unusable stamps are ignored, and a non-array gives nothing', () => {
  assert.equal(offlineSavedBadgeLatestTime(['not a stamp', '2026-11-07T08:36:41.123Z', null]), '2026-11-07T08:36:41.123Z');
  assert.equal(offlineSavedBadgeLatestTime(['not a stamp', null]), '');
  assert.equal(offlineSavedBadgeLatestTime([]), '');
  assert.equal(offlineSavedBadgeLatestTime(null), '');
  assert.equal(offlineSavedBadgeLatestTime('2026-11-07T08:36:41.123Z'), '');
});

test('line text: a badge reads "saved on this device" with the time', () => {
  assert.equal(offlineSavedBadgeLineText({ time: '13:36' }), '✓ Saved on this device · 13:36');
});

test('line text: no badge gives no line', () => {
  assert.equal(offlineSavedBadgeLineText(null), '');
  assert.equal(offlineSavedBadgeLineText({}), '');
  assert.equal(offlineSavedBadgeLineText({ time: '' }), '');
});

test('html: a badge renders the badge paragraph', () => {
  assert.equal(
    offlineSavedBadgeHtml({ time: '13:36' }),
    '<p class="osb-saved-badge">✓ Saved on this device · 13:36</p>'
  );
});

test('html: no badge renders nothing, and a hostile time is escaped', () => {
  assert.equal(offlineSavedBadgeHtml(null), '');
  assert.equal(offlineSavedBadgeHtml({ time: '<b>13:36</b>' }), '<p class="osb-saved-badge">✓ Saved on this device · &lt;b&gt;13:36&lt;/b&gt;</p>');
});

test('acceptance: the badge appears with the correct save time after every save', () => {
  const badge = offlineSavedBadge(SAVE_STAMP);
  assert.ok(badge);
  assert.equal(badge.time, '13:36');
  assert.equal(offlineSavedBadgeLineText(badge), '✓ Saved on this device · 13:36');
  assert.match(offlineSavedBadgeHtml(badge), /13:36/);
});

test('acceptance: a payment not yet saved shows no badge', () => {
  assert.equal(offlineSavedBadge(''), null);
  assert.equal(offlineSavedBadgeLineText(offlineSavedBadge('')), '');
  assert.equal(offlineSavedBadgeHtml(offlineSavedBadge('')), '');
});

test('purity: the module never reads the clock', () => {
  const clockReads = ['new ' + 'Date(', 'Date.' + 'now('];
  for (const read of clockReads) {
    assert.ok(!moduleSrc.includes(read), `module must not read the clock via ${read}`);
  }
});

test('purity: the module holds no store and fetches nothing', () => {
  for (const banned of ['localStorage', 'sessionStorage', 'fetch(']) {
    assert.ok(!moduleSrc.includes(banned), `module must not use ${banned}`);
  }
});

test('fence: the module header never names a fenced filename literally', () => {
  const fenced = [
    'quick-collect-' + 'reversal-undo',
    'success-' + 'next-steps',
    'receipt-' + 'preview',
    'cash-change-' + 'calculator',
    'remembered-' + 'method',
    'dues-amount-' + 'default',
    'quick-collect-' + 'one-screen',
    'name-prefix-' + 'lookup',
    'recent-quick-' + 'pick',
    'one-screen-' + 'quick-amounts',
    'offline-queue-' + 'status',
    'save-confirmation-' + 'summary',
    'full-history-' + 'list',
    'balance-' + 'rollforward',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});

test('styles: the badge rule exists and introduces no new hex colour', () => {
  assert.ok(stylesSrc.includes('.osb-saved-badge'));
  const rules = stylesSrc.match(/\.osb-[^{]+\{[^}]*\}/g) || [];
  assert.equal(rules.length, 1, `expected one saved-badge rule, found ${rules.length}`);
  const baseline = stylesSrc.replace(/\.osb-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('wiring: the controller imports the badge module', () => {
  assert.match(wiringSrc, /offline-saved-badge\.js/);
  assert.match(wiringSrc, /offlineSavedBadge, offlineSavedBadgeHtml, offlineSavedBadgeLatestTime/);
});

test('wiring: the badge renders on both save paths', () => {
  const calls = wiringSrc.match(/renderOfflineSavedBadge\(\)/g) || [];
  // Plan 449: the second-connection record is a third save path, so the
  // badge renders there too — definition + 3 save-path calls.
  assert.equal(calls.length, 4, `expected definition + 3 save-path calls, found ${calls.length}`);
});

test('wiring: the render reads the saved payment recorded-at stamp and posts nothing', () => {
  const start = wiringSrc.indexOf('function renderOfflineSavedBadge()');
  assert.ok(start >= 0, 'render function missing');
  const end = wiringSrc.indexOf('\n  function ', start + 1);
  const slice = wiringSrc.slice(start, end === -1 ? undefined : end);
  assert.match(slice, /recordedAt/);
  assert.match(slice, /offlineSavedBadgeHtml/);
  assert.match(slice, /activeReceipt/);
  assert.ok(!slice.includes('onSaveState('), 'render must not post state');
  assert.ok(!slice.includes('addPayment('), 'render must not record a payment');
});

test('page: the success step carries the badge host', () => {
  assert.match(pageSrc, /id="osbOfflineSavedBadge"/);
  const start = pageSrc.indexOf('id="osbOfflineSavedBadge"');
  const stepStart = pageSrc.indexOf('id="quickCollectStepSuccess"');
  const receiptStart = pageSrc.indexOf('id="quickCollectReceiptCard"');
  assert.ok(stepStart >= 0 && start > stepStart, 'badge host must sit on the success step');
  assert.ok(receiptStart >= 0 && start < receiptStart, 'badge host must sit before the receipt card');
});
