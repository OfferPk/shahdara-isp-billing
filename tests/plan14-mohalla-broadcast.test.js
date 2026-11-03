import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BROADCAST_TEMPLATE_KINDS,
  BROADCAST_DRAFT_VARIANTS,
  DEFAULT_BROADCAST_TEMPLATES,
  canonicalBroadcastMohalla,
  resolveBroadcastMohallas,
  buildBroadcastMohallaOptions,
  buildBroadcastAudience,
  normalizeBroadcastTemplates,
  buildBroadcastDraft,
  broadcastWhatsAppUrl,
  logBroadcastSent,
  broadcastSentAt,
  broadcastCoverage,
  broadcastSummaryText,
  broadcastFilename,
  broadcastHtml,
  broadcastCsv,
} from '../mohalla-broadcast.js';

const customers = [
  { id: 'c1', name: 'Ahmed', mohalla: 'MOHALLA BANI' },
  { id: 'c2', name: 'Bilal', mohalla: 'Bani' },
  { id: 'c3', name: 'Chaudhry', mohalla: 'Gangall' },
  { id: 'c4', name: 'Danish', mohalla: '' },
  { id: 'c5', name: 'Ehsan', mohalla: 'Gangall', archived: true },
];

test('canonical rule: MOHALLA BANI, Bani and BANII are one mohalla', () => {
  const a = canonicalBroadcastMohalla('MOHALLA BANI');
  const b = canonicalBroadcastMohalla('Bani');
  const c = canonicalBroadcastMohalla('BANII');
  assert.equal(a.key, b.key);
  assert.equal(b.key, c.key);
  assert.equal(a.stored, 'BANII');
  assert.equal(canonicalBroadcastMohalla(''), null);
  assert.equal(canonicalBroadcastMohalla('   '), null);
});

test('canonical aliases: kishti and chamyaa collapse to stored spellings', () => {
  assert.equal(canonicalBroadcastMohalla('kishti').stored, 'KISHTII');
  assert.equal(canonicalBroadcastMohalla('CHAMYAA').stored, 'CHAMYAAA');
  assert.equal(canonicalBroadcastMohalla('MOHALLA CHAMYAA').key, canonicalBroadcastMohalla('chamyaa').key);
});

test('unknown mohalla keeps its own key and label, never dropped', () => {
  const canon = canonicalBroadcastMohalla('New Colony');
  assert.equal(canon.key, 'new colony');
  assert.equal(canon.label, 'New Colony');
});

test('resolve: duplicates collapse, blanks skipped and counted, order kept', () => {
  const resolved = resolveBroadcastMohallas(['MOHALLA BANI', 'Bani', '', 'Gangall', 'BANII']);
  assert.deepEqual(resolved.mohallas.map((m) => m.key), ['banii', 'gangall']);
  assert.equal(resolved.counts.selected, 5);
  assert.equal(resolved.counts.resolved, 2);
  assert.equal(resolved.counts.skippedBlank, 1);
  assert.equal(resolved.counts.collapsedDuplicates, 2);
});

test('resolve: all selects the standard list, once each', () => {
  const resolved = resolveBroadcastMohallas(['all']);
  assert.ok(resolved.mohallas.length >= 15);
  assert.equal(new Set(resolved.mohallas.map((m) => m.key)).size, resolved.mohallas.length);
  const single = resolveBroadcastMohallas('all');
  assert.deepEqual(single.mohallas.map((m) => m.key), resolved.mohallas.map((m) => m.key));
});

test('resolve: all with a caller universe uses exactly that universe', () => {
  const resolved = resolveBroadcastMohallas(['all'], { allMohallas: ['Bani', 'Gangall'] });
  assert.deepEqual(resolved.mohallas.map((m) => m.key), ['banii', 'gangall']);
});

test('resolve: empty and blank-only selections resolve to nothing', () => {
  assert.deepEqual(resolveBroadcastMohallas([]).mohallas, []);
  assert.deepEqual(resolveBroadcastMohallas(['', '  ']).mohallas, []);
  assert.deepEqual(resolveBroadcastMohallas(null).mohallas, []);
});

test('resolve does not mutate the input selection', () => {
  const selection = ['Bani', 'Gangall'];
  const before = [...selection];
  resolveBroadcastMohallas(selection);
  assert.deepEqual(selection, before);
});

test('options: customer mohallas first, then standard mohallas with no customer', () => {
  const options = buildBroadcastMohallaOptions({ customers });
  assert.equal(options[0].key, 'banii');
  assert.equal(options[1].key, 'gangall');
  assert.ok(options.length >= 15);
  assert.equal(new Set(options.map((m) => m.key)).size, options.length);
  const empty = buildBroadcastMohallaOptions({ customers: [] });
  assert.ok(empty.length >= 15);
});

test('audience: exact canonical match, blank never assigned, archived separate', () => {
  const audience = buildBroadcastAudience({ customers, mohallas: resolveBroadcastMohallas(['Bani', 'Gangall']).mohallas });
  const bani = audience.mohallas.find((m) => m.key === 'banii');
  const gangall = audience.mohallas.find((m) => m.key === 'gangall');
  assert.equal(bani.customerCount, 2);
  assert.equal(gangall.customerCount, 1);
  assert.equal(gangall.archivedCount, 1);
  assert.equal(audience.addressedCustomers, 3);
  assert.equal(audience.unaddressedCustomers, 1);
  assert.equal(audience.totalCustomers, 5);
});

test('templates: custom text wins, blank edit falls back to default, input untouched', () => {
  const custom = { maintenance: { roman: 'Custom maintenance {{mohallas}}.', urdu: '' } };
  const merged = normalizeBroadcastTemplates(custom);
  assert.equal(merged.maintenance.roman, 'Custom maintenance {{mohallas}}.');
  assert.equal(merged.maintenance.urdu, DEFAULT_BROADCAST_TEMPLATES.maintenance.urdu);
  assert.equal(merged.outage.roman, DEFAULT_BROADCAST_TEMPLATES.outage.roman);
  assert.equal(custom.maintenance.urdu, '');
  assert.notEqual(merged.maintenance.roman, '');
});

test('draft: addresses exactly the selected mohallas, Roman and Urdu', () => {
  const roman = buildBroadcastDraft({ kind: 'maintenance', variant: 'roman', selection: ['Bani', 'Gangall'] });
  assert.ok(roman.text.includes('Banii'));
  assert.ok(roman.text.includes('Gangall'));
  assert.ok(!roman.text.includes('{{mohallas}}'));
  assert.deepEqual(roman.mohallaKeys, ['banii', 'gangall']);
  const urdu = buildBroadcastDraft({ kind: 'maintenance', variant: 'urdu', selection: ['Bani'] });
  assert.ok(urdu.text.includes('شاہدرہ فائبر نیٹ'));
  assert.equal(urdu.variant, BROADCAST_DRAFT_VARIANTS.URDU);
});

test('draft: detail is appended verbatim, absent detail is never invented', () => {
  const withDetail = buildBroadcastDraft({ kind: 'outage', selection: ['Bani'], detail: 'Sunday 9am to 12pm.' });
  assert.ok(withDetail.text.includes('Sunday 9am to 12pm.'));
  assert.equal(withDetail.detail, 'Sunday 9am to 12pm.');
  const without = buildBroadcastDraft({ kind: 'outage', selection: ['Bani'] });
  assert.equal(without.detail, '');
});

test('draft: template without placeholder still carries the mohalla line', () => {
  const draft = buildBroadcastDraft({
    kind: 'general',
    selection: ['Gangall'],
    templates: { general: { roman: 'A short notice.', urdu: 'ایک مختصر اطلاع۔' } },
  });
  assert.ok(draft.text.includes('Gangall'));
});

test('draft: unknown kind falls back to general, unknown variant to Roman', () => {
  const draft = buildBroadcastDraft({ kind: 'bogus', variant: 'bogus', selection: ['Bani'] });
  assert.equal(draft.kind, BROADCAST_TEMPLATE_KINDS.GENERAL);
  assert.equal(draft.variant, BROADCAST_DRAFT_VARIANTS.ROMAN);
});

test('draft: null when nothing is addressed', () => {
  assert.equal(buildBroadcastDraft({ kind: 'maintenance', selection: [] }), null);
  assert.equal(buildBroadcastDraft({ kind: 'maintenance', selection: ['  '] }), null);
});

test('draft: audience on the same fixture matches the selection exactly', () => {
  const draft = buildBroadcastDraft({ kind: 'maintenance', selection: ['Bani', 'Gangall'], customers });
  assert.equal(draft.audience.addressedCustomers, 3);
  assert.equal(draft.audience.unaddressedCustomers, 1);
  assert.equal(draft.counts.resolved, 2);
});

test('draft does not mutate selection or templates', () => {
  const selection = ['Bani'];
  const templates = { maintenance: { roman: 'Hi {{mohallas}}.', urdu: 'سلام {{mohallas}}۔' } };
  buildBroadcastDraft({ kind: 'maintenance', selection, templates });
  assert.deepEqual(selection, ['Bani']);
  assert.equal(templates.maintenance.roman, 'Hi {{mohallas}}.');
});

test('WhatsApp route: no-recipient draft URL, text encoded, empty text gives base URL', () => {
  assert.equal(broadcastWhatsAppUrl('Hello Banii'), 'https://wa.me/?text=Hello%20Banii');
  assert.ok(broadcastWhatsAppUrl('سلام').includes('%D8%B3'));
  assert.equal(broadcastWhatsAppUrl(''), 'https://wa.me/');
  assert.equal(broadcastWhatsAppUrl(null), 'https://wa.me/');
});

test('send log: one entry per mohalla, with time, channel and kind', () => {
  const log = logBroadcastSent([], { mohallas: ['Bani', 'Gangall'], sentAt: '2026-11-03T10:00:00Z', channel: 'whatsapp', kind: 'maintenance' });
  assert.equal(log.length, 2);
  assert.equal(log[0].mohallaKey, 'banii');
  assert.equal(log[1].mohallaKey, 'gangall');
  assert.equal(log[0].sentAt, '2026-11-03T10:00:00Z');
  assert.equal(log[0].channel, 'whatsapp');
  assert.equal(log[0].kind, 'maintenance');
});

test('send log: duplicates in one call collapse, and the old log is untouched', () => {
  const before = [];
  const log = logBroadcastSent(before, { mohallas: ['Bani', 'MOHALLA BANI'], sentAt: '2026-11-03T10:00:00Z' });
  assert.equal(log.length, 1);
  assert.deepEqual(before, []);
});

test('send log: no mohallas or no time records nothing', () => {
  assert.deepEqual(logBroadcastSent([], { mohallas: [], sentAt: '2026-11-03T10:00:00Z' }), []);
  assert.deepEqual(logBroadcastSent([], { mohallas: ['Bani'], sentAt: '' }), []);
});

test('sentAt: latest send wins, canonical key match, null when never sent', () => {
  let log = logBroadcastSent([], { mohallas: ['Bani'], sentAt: '2026-11-03T10:00:00Z' });
  log = logBroadcastSent(log, { mohallas: ['MOHALLA BANI'], sentAt: '2026-11-04T10:00:00Z' });
  assert.equal(broadcastSentAt(log, 'Bani'), '2026-11-04T10:00:00Z');
  assert.equal(broadcastSentAt(log, 'Gangall'), null);
});

test('coverage: covered, uncovered and total over exactly the draft mohallas', () => {
  const log = logBroadcastSent([], { mohallas: ['Bani'], sentAt: '2026-11-03T10:00:00Z' });
  const coverage = broadcastCoverage(log, resolveBroadcastMohallas(['Bani', 'Gangall']).mohallas);
  assert.equal(coverage.total, 2);
  assert.equal(coverage.covered, 1);
  assert.equal(coverage.uncovered, 1);
  assert.equal(coverage.rows.find((r) => r.key === 'banii').sentAt, '2026-11-03T10:00:00Z');
  assert.equal(coverage.rows.find((r) => r.key === 'gangall').sentAt, null);
});

test('summary and filename', () => {
  const draft = buildBroadcastDraft({ kind: 'maintenance', selection: ['Bani'], customers });
  assert.ok(broadcastSummaryText(draft).includes('1 mohalla'));
  assert.ok(broadcastSummaryText(draft).includes('Nothing sent yet'));
  assert.equal(broadcastSummaryText(null), 'Broadcast draft unavailable.');
  assert.equal(broadcastFilename('2026-11-03'), 'mohalla-broadcasts-2026-11-03.csv');
  assert.equal(broadcastFilename('bogus'), 'mohalla-broadcasts-unknown-date.csv');
});

test('HTML: draft text, mohalla rows, send buttons, sent state, escaping', () => {
  const draft = buildBroadcastDraft({ kind: 'maintenance', selection: ['Bani', 'Gangall'], customers });
  const log = logBroadcastSent([], { mohallas: ['Bani'], sentAt: '2026-11-03T10:00:00.000Z' });
  const html = broadcastHtml(draft, log);
  assert.ok(html.includes('Banii'));
  assert.ok(html.includes('Gangall'));
  assert.ok(html.includes('mohalla-broadcast-send-btn'));
  assert.ok(html.includes('Sent 2026-11-03 10:00 UTC'));
  assert.ok(html.includes('Not sent'));
  const evil = buildBroadcastDraft({ kind: 'general', selection: ['<script>'], detail: '<b>bold</b>' });
  const evilHtml = broadcastHtml(evil, []);
  assert.ok(!evilHtml.includes('<script>'));
  assert.ok(!evilHtml.includes('<b>bold</b>'));
});

test('HTML: unavailable and empty drafts', () => {
  assert.ok(broadcastHtml(null).includes('unavailable'));
  assert.ok(broadcastHtml({ mohallas: [] }).includes('No mohalla selected'));
});

test('CSV: one row per addressed mohalla, with sent state and quoting', () => {
  const draft = buildBroadcastDraft({ kind: 'price_change', selection: ['Bani', 'Gangall'], customers });
  const log = logBroadcastSent([], { mohallas: ['Bani'], sentAt: '2026-11-03T10:00:00Z', channel: 'whatsapp' });
  const csv = broadcastCsv(draft, log);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Mohalla, Customers addressed, Sent at, Channel, Kind');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes('Banii'));
  assert.ok(lines[1].includes('2026-11-03T10:00:00Z'));
  assert.ok(lines[1].includes('price_change'));
  assert.ok(lines[2].includes('Gangall'));
  const quoted = broadcastCsv(buildBroadcastDraft({ kind: 'general', selection: ['Pull Side'] }), []);
  assert.ok(quoted.includes('Pull Side'));
});
