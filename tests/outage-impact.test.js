// SISP-7: Daisy-Chain / Feeder Outage Impact & Bulk WhatsApp Alert Tool.
// Pure-function tests on synthetic data only. Spec test criterion
// (verbatim): linking House A -> House B -> House C and simulating an
// outage at House A accurately returns [House B, House C] as impacted
// downstream nodes (with cycle-prevention guard).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIBER_ZONES,
  OUTAGE_MESSAGE_ROMAN,
  buildDownstreamMap,
  buildOutageMessage,
  buildOutageQueue,
  buildOutageQueueText,
  normalizeFeederFields,
  normalizeFiberZone,
  outageWhatsAppLink,
  summarizeFeederNetwork,
  traceDownstreamImpact,
  validateUpstreamLink
} from '../outage-impact.js';

const house = (id, overrides = {}) => ({
  id,
  name: `House ${id}`,
  mohalla: 'Shahdara Town',
  phone: '+923001234567',
  archived: false,
  upstreamCustomerId: '',
  fiberZone: '',
  ...overrides
});

// A -> B -> C chain (B fed by A, C fed by B).
const chain = () => ([
  house('A'),
  house('B', { upstreamCustomerId: 'A' }),
  house('C', { upstreamCustomerId: 'B' })
]);

test('spec criterion verbatim: A -> B -> C trace from A returns [B, C]', () => {
  const impacted = traceDownstreamImpact(chain(), 'A');
  assert.deepEqual(impacted.map((c) => c.id), ['B', 'C']);
});

test('deeper chain: A -> B -> C -> D returns all three downstream', () => {
  const customers = [...chain(), house('D', { upstreamCustomerId: 'C' })];
  assert.deepEqual(traceDownstreamImpact(customers, 'A').map((c) => c.id), ['B', 'C', 'D']);
});

test('trace from the middle returns only further downstream', () => {
  assert.deepEqual(traceDownstreamImpact(chain(), 'B').map((c) => c.id), ['C']);
  assert.deepEqual(traceDownstreamImpact(chain(), 'C'), []);
});

test('diamond: each downstream customer listed once, nearest first', () => {
  const customers = [
    house('A'),
    house('B', { upstreamCustomerId: 'A' }),
    house('C', { upstreamCustomerId: 'A' }),
    house('D', { upstreamCustomerId: 'B' })
  ];
  // D is also fed by C in a second link? No — one upstream per customer,
  // so add a second branch instead: E fed by C.
  customers.push(house('E', { upstreamCustomerId: 'C' }));
  assert.deepEqual(traceDownstreamImpact(customers, 'A').map((c) => c.id), ['B', 'C', 'D', 'E']);
});

test('cycle guard: A -> B -> C -> A never loops, source never listed', () => {
  const customers = [
    house('A', { upstreamCustomerId: 'C' }),
    house('B', { upstreamCustomerId: 'A' }),
    house('C', { upstreamCustomerId: 'B' })
  ];
  assert.deepEqual(traceDownstreamImpact(customers, 'A').map((c) => c.id), ['B', 'C']);
  assert.deepEqual(traceDownstreamImpact(customers, 'B').map((c) => c.id), ['C', 'A']);
});

test('self-loop: a house feeding itself impacts nobody', () => {
  const customers = [house('A', { upstreamCustomerId: 'A' })];
  assert.deepEqual(traceDownstreamImpact(customers, 'A'), []);
});

test('unknown source impacts nobody', () => {
  assert.deepEqual(traceDownstreamImpact(chain(), 'ZZZ'), []);
});

test('archived houses are traversed through but never listed', () => {
  const customers = [
    house('A'),
    house('B', { upstreamCustomerId: 'A', archived: true }),
    house('C', { upstreamCustomerId: 'B' })
  ];
  assert.deepEqual(traceDownstreamImpact(customers, 'A').map((c) => c.id), ['C']);
});

test('downstream map groups children by upstream id', () => {
  const map = buildDownstreamMap(chain());
  assert.deepEqual((map.get('A') ?? []).map((c) => c.id), ['B']);
  assert.deepEqual((map.get('B') ?? []).map((c) => c.id), ['C']);
  assert.equal(map.has('C'), false);
});

test('upstream validation: empty, self, unknown, cycle, valid', () => {
  const customers = chain();
  assert.equal(validateUpstreamLink(customers, 'A', ''), null);
  assert.equal(validateUpstreamLink(customers, 'A', null), null);
  assert.match(validateUpstreamLink(customers, 'A', 'A'), /itself/);
  assert.match(validateUpstreamLink(customers, 'A', 'ZZZ'), /not found/);
  // C's chain already reaches A (C -> B -> A): linking A -> C closes a cycle.
  assert.match(validateUpstreamLink(customers, 'A', 'C'), /cycle/);
  // Fresh house D fed by A is fine.
  assert.equal(validateUpstreamLink([...customers, house('D')], 'D', 'A'), null);
});

test('fiber zones: Side 1 to Side 4c valid, anything else null', () => {
  assert.equal(FIBER_ZONES.length, 16);
  assert.equal(normalizeFiberZone('Side 1'), 'Side 1');
  assert.equal(normalizeFiberZone('Side 4c'), 'Side 4c');
  assert.equal(normalizeFiberZone('Side 5'), null);
  assert.equal(normalizeFiberZone(''), null);
  assert.equal(normalizeFiberZone(null), null);
});

test('normalizeFeederFields trims and coerces', () => {
  assert.deepEqual(
    normalizeFeederFields({ upstreamCustomerId: '  B ', fiberZone: 'Side 2a' }),
    { upstreamCustomerId: 'B', fiberZone: 'Side 2a' }
  );
  assert.deepEqual(
    normalizeFeederFields({ upstreamCustomerId: '', fiberZone: 'Side 9' }),
    { upstreamCustomerId: null, fiberZone: null }
  );
  assert.deepEqual(
    normalizeFeederFields({}),
    { upstreamCustomerId: null, fiberZone: null }
  );
});

test('outage message: spec Roman text exact, Urdu variant differs', () => {
  assert.equal(
    buildOutageMessage(),
    'Assalam-o-Alaikum, aap ki line par maintenance/power issue ki wajah se net aarzi band hai, jald bahal ho jayega'
  );
  assert.equal(buildOutageMessage({ urdu: false }), OUTAGE_MESSAGE_ROMAN);
  const urdu = buildOutageMessage({ urdu: true });
  assert.ok(urdu.length > 0 && urdu !== OUTAGE_MESSAGE_ROMAN);
});

test('WhatsApp links: international numbers link, local numbers never guess', () => {
  assert.equal(outageWhatsAppLink('+923001234567'), 'https://wa.me/923001234567');
  assert.equal(outageWhatsAppLink('923001234567'), 'https://wa.me/923001234567');
  assert.equal(outageWhatsAppLink('03001234567'), null);
  assert.equal(outageWhatsAppLink('123'), null);
  assert.equal(outageWhatsAppLink(''), null);
  assert.equal(outageWhatsAppLink(null), null);
});

test('outage queue: source + impacted entries with message and links', () => {
  const customers = [
    house('A'),
    house('B', { upstreamCustomerId: 'A', phone: '+923001234567' }),
    house('C', { upstreamCustomerId: 'B', phone: '03001234567' })
  ];
  const queue = buildOutageQueue(customers, 'A');
  assert.equal(queue.source.id, 'A');
  assert.deepEqual(queue.impacted.map((e) => e.customer.id), ['B', 'C']);
  assert.equal(queue.impacted[0].message, OUTAGE_MESSAGE_ROMAN);
  assert.equal(queue.impacted[0].whatsappLink, 'https://wa.me/923001234567');
  assert.equal(queue.impacted[1].whatsappLink, null);
  assert.equal(buildOutageQueue(customers, 'ZZZ'), null);
});

test('queue text names every impacted subscriber with the message', () => {
  const queue = buildOutageQueue(chain(), 'A');
  const text = buildOutageQueueText(queue);
  assert.match(text, /House B/);
  assert.match(text, /House C/);
  assert.match(text, /Assalam-o-Alaikum/);
  const empty = buildOutageQueue(chain(), 'C');
  assert.match(buildOutageQueueText(empty), /No downstream/);
});

test('feeder network summary: linked count and longest chain', () => {
  const customers = [
    ...chain(),
    house('D', { upstreamCustomerId: 'A' }),
    house('E')
  ];
  const summary = summarizeFeederNetwork(customers);
  assert.equal(summary.linkedCount, 3); // B, C, D
  assert.equal(summary.maxDownstream, 3); // A -> B, C, D
  assert.equal(summary.maxSource.id, 'A');
  assert.deepEqual(summarizeFeederNetwork([]), { linkedCount: 0, maxDownstream: 0, maxSource: null });
});
