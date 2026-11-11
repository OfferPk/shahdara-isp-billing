/**
 * plan66-pucho-box.test.js — Plan 66: Co-pilot "Pucho" box, plain
 * language questions over existing data, plus a morning action
 * queue. Pins:
 * - the catalogue is fixed and visible: exactly 12 supported
 *   questions, each with an id, title, and source screen;
 * - matching is case-insensitive, in Roman Urdu and English,
 *   and two matches are shown, most specific first;
 * - an unmatched question says plainly it cannot answer and
 *   lists the catalogue — no figure is invented for it;
 * - every answer's list amounts sum exactly to its headline
 *   total on the same fixture, in integer cents;
 * - dues by mohalla use the Plan T canonical rule (leading
 *   "Mohalla" stripped, case-insensitive, bani -> BANII,
 *   kishti -> KISHTII, chamyaa -> CHAMYAAA), and unassigned
 *   rows are never dropped;
 * - the mohalla-attention answer shows dues, overdue Waada,
 *   and open tickets separately, never blended into a score;
 * - the morning queue orders exactly by the fixed priority
 *   (overdue Waada band 15+ then 8-14 then 4-7 then 1-3,
 *   largest first inside a band; high-priority tickets,
 *   no-connection first, oldest first; largest dues;
 *   oldest suspense; expiring in 3 days, earliest first),
 *   capped at 10 with a hasMore flag;
 * - an empty source answers "koi record nahi", never zero as
 *   a fact about a missing source;
 * - asking never mutates the caller-supplied data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUCHO_QUESTIONS,
  PUCHO_UNMATCHED_MESSAGE,
  MORNING_QUEUE_ORDER_TEXT,
  validPuchoDate,
  puchoMohallaKey,
  matchPuchoQuestions,
  answerPucho,
  buildMorningQueue,
  puchoAnswerHtml,
  puchoHtml,
  puchoCatalogueHtml,
  morningQueueCsv,
  morningQueueFilename,
} from '../pucho-box.js';

const TODAY = '2026-11-04';

function fixture() {
  return {
    today: TODAY,
    dues: [
      { customerId: 'c1', customerName: 'Ahmed', mohalla: 'Mohalla Bani', outstandingCents: 33333 },
      { customerId: 'c2', customerName: 'Bilal', mohalla: 'bani', outstandingCents: 16667 },
      { customerId: 'c3', customerName: 'Usman', mohalla: 'Kishti', outstandingCents: 50000 },
      { customerId: 'c4', customerName: 'Zero', mohalla: 'Bani', outstandingCents: 0 },
    ],
    expiries: [
      { customerId: 'c1', customerName: 'Ahmed', mohalla: 'Bani', expiryDate: '2026-11-06' },
      { customerId: 'c2', customerName: 'Bilal', mohalla: 'Bani', expiryDate: '2026-11-11' },
      { customerId: 'c3', customerName: 'Usman', mohalla: 'Kishti', expiryDate: '2026-11-04' },
      { customerId: 'c4', customerName: 'Past', mohalla: 'Bani', expiryDate: '2026-11-03' },
      { customerId: 'c5', customerName: 'Bad', mohalla: 'Bani', expiryDate: '2026-02-30' },
    ],
    waada: [
      { customerId: 'c1', customerName: 'Ahmed', mohalla: 'Bani', promiseDate: '2026-10-15', promiseAmountCents: 100000 },
      { customerId: 'c2', customerName: 'Bilal', mohalla: 'Bani', promiseDate: '2026-10-25', promiseAmountCents: 50000 },
      { customerId: 'c3', customerName: 'Usman', mohalla: 'Kishti', promiseDate: '2026-11-01', promiseAmountCents: 20000 },
      { customerId: 'c4', customerName: 'Future', mohalla: 'Bani', promiseDate: '2026-11-10', promiseAmountCents: 90000 },
    ],
    suspense: [
      { id: 'S-1', amountCents: 25000, date: '2026-09-01', claimed: false },
      { id: 'S-2', amountCents: 10000, date: '2026-10-20', claimed: false },
      { id: 'S-3', amountCents: 99900, date: '2026-08-01', claimed: true },
    ],
    tickets: [
      { id: 'T-1', customerId: 'c1', customerName: 'Ahmed', mohalla: 'Bani', category: 'slow_speed', priority: 'low', status: 'open', reportedDate: '2026-11-01' },
      { id: 'T-2', customerId: 'c2', customerName: 'Bilal', mohalla: 'Bani', category: 'no_connection', priority: 'high', status: 'assigned', reportedDate: '2026-11-03' },
      { id: 'T-3', customerId: 'c3', customerName: 'Usman', mohalla: 'Kishti', category: 'no_connection', priority: 'urgent', status: 'open', reportedDate: '2026-11-02' },
      { id: 'T-4', customerId: 'c4', customerName: 'Done', mohalla: 'Bani', category: 'device_fault', priority: 'high', status: 'resolved', reportedDate: '2026-10-01' },
    ],
    repeatFlags: [
      { customerId: 'c1', customerName: 'Ahmed', mohalla: 'Bani', category: 'slow_speed', count: 4, ticketIds: ['T-1', 'T-5', 'T-6', 'T-7'] },
      { customerId: 'c2', customerName: 'Bilal', mohalla: 'Bani', category: 'no_connection', count: 3, ticketIds: ['T-2', 'T-8', 'T-9'] },
    ],
    atRisk: [
      { customerId: 'c1', customerName: 'Ahmed', mohalla: 'Bani', signals: ['Late payments', 'Contact gap'] },
      { customerId: 'c2', customerName: 'Bilal', mohalla: 'Bani', signals: ['Unhappy note'] },
    ],
    disputes: [
      { caseId: 'D-1', customerId: 'c1', customerName: 'Ahmed', mohalla: 'Bani', billId: 'B-1', billMonth: '2026-10', totalCents: 100000, disputedCents: 40000, status: 'open' },
      { caseId: 'D-2', customerId: 'c2', customerName: 'Bilal', mohalla: 'Bani', billId: 'B-2', billMonth: '2026-10', totalCents: 50000, disputedCents: 60000, status: 'investigating' },
      { caseId: 'D-3', customerId: 'c3', customerName: 'Usman', mohalla: 'Kishti', billId: 'B-3', billMonth: '2026-10', totalCents: 30000, disputedCents: 10000, status: 'resolved' },
    ],
    payments: [
      { date: '2026-11-04', amountCents: 200000, voided: false, customerName: 'Ahmed' },
      { date: '2026-11-04', amountCents: 50000, voided: true, customerName: 'Bilal' },
      { date: '2026-11-02', amountCents: 150000, voided: false, customerName: 'Usman' },
      { date: '2026-10-15', amountCents: 99900, voided: false, customerName: 'Old' },
    ],
  };
}

function answerFor(question, data = fixture()) {
  const result = answerPucho(question, data);
  assert.equal(result.unmatched, false, `expected a match for "${question}"`);
  return result.matched;
}

test('catalogue is fixed: exactly 12 questions with distinct ids', () => {
  assert.equal(PUCHO_QUESTIONS.length, 12);
  assert.equal(new Set(PUCHO_QUESTIONS.map((q) => q.id)).size, 12);
  for (const q of PUCHO_QUESTIONS) {
    assert.ok(q.title.length > 0);
    assert.ok(q.sourceScreen.length > 0);
    assert.ok(q.keywords.length > 0);
  }
});

test('matching is case-insensitive and covers Roman Urdu and English', () => {
  assert.deepEqual(matchPuchoQuestions('MOHALLA BAQAYA').map((q) => q.id).slice(0, 1), ['dues_by_mohalla']);
  assert.ok(matchPuchoQuestions('who owes money').some((q) => q.id === 'total_dues'));
  assert.ok(matchPuchoQuestions('waada overdue hai').some((q) => q.id === 'overdue_waada'));
  assert.ok(matchPuchoQuestions('aaj ki collection').some((q) => q.id === 'collections'));
});

test('two matches are shown, most specific first', () => {
  const matched = matchPuchoQuestions('mohalla baqaya');
  assert.ok(matched.some((q) => q.id === 'dues_by_mohalla'));
  assert.ok(matched.some((q) => q.id === 'total_dues'));
  assert.equal(matched[0].id, 'dues_by_mohalla');
});

test('unmatched question says plainly it cannot answer and lists the catalogue, inventing nothing', () => {
  const result = answerPucho('router ki speed kyun slow hai', fixture());
  assert.equal(result.unmatched, true);
  assert.equal(result.matched.length, 0);
  assert.equal(result.unmatchedMessage, PUCHO_UNMATCHED_MESSAGE);
  assert.equal(result.catalogue.length, 12);
  const html = puchoHtml(result);
  assert.ok(html.includes('Ye sawaal main abhi nahi samajh saka'));
  assert.ok(!html.includes('PKR'));
});

test('strict dates: impossible dates are not dates', () => {
  assert.equal(validPuchoDate('2026-02-30'), null);
  assert.equal(validPuchoDate('2026-11-04'), '2026-11-04');
  assert.equal(validPuchoDate('not a date'), null);
});

test('expiry this week: inside 7 days inclusive, ordered by date, past and day-8 excluded', () => {
  const [answer] = answerFor('expiry this week');
  assert.equal(answer.empty, false);
  assert.deepEqual(answer.rows.map((r) => r[0]), ['Usman', 'Ahmed', 'Bilal']);
  assert.ok(answer.headline.includes('3 customer'));
  assert.ok(answer.insights.some((line) => line.includes('2026-11-04')));
  assert.ok(answer.insights.some((line) => line.includes('1 expiry rows')));
});

test('total dues: exact cent sums, largest first, zero ignored', () => {
  const [answer] = answerFor('total dues');
  assert.equal(answer.headlineCents, 100000);
  assert.ok(answer.headline.includes('1000.00 PKR'));
  assert.deepEqual(answer.rows.map((r) => r[0]), ['Usman', 'Ahmed', 'Bilal']);
  const sum = answer.rows.reduce((total, r) => total + Math.round(Number(r[2]) * 100), 0);
  assert.equal(sum, answer.headlineCents);
});

test('dues by mohalla: canonical grouping, aliases, totals sum to headline', () => {
  assert.equal(puchoMohallaKey('Mohalla Bani'), 'BANII');
  assert.equal(puchoMohallaKey('bani'), 'BANII');
  assert.equal(puchoMohallaKey('kishti'), 'KISHTII');
  assert.equal(puchoMohallaKey('chamyaa'), 'CHAMYAAA');
  const [answer] = answerFor('mohalla baqaya');
  assert.equal(answer.headlineCents, 100000);
  const bani = answer.rows.find((r) => r[0] === 'Bani');
  assert.equal(bani[1], '2');
  assert.equal(bani[2], '500.00');
  const kishti = answer.rows.find((r) => r[0] === 'Kishti');
  assert.equal(kishti[2], '500.00');
  const sum = answer.rows.reduce((total, r) => total + Math.round(Number(r[2]) * 100), 0);
  assert.equal(sum, answer.headlineCents);
});

test('dues by mohalla: unassigned rows are never dropped', () => {
  const data = fixture();
  data.dues = [{ customerId: 'c9', customerName: 'NoArea', mohalla: '', outstandingCents: 70000 }];
  const [answer] = answerFor('mohalla dues', data);
  assert.equal(answer.rows.length, 1);
  assert.equal(answer.rows[0][0], 'No mohalla recorded');
  assert.equal(answer.rows[0][2], '700.00');
});

test('overdue Waada: oldest band first, then oldest promise first', () => {
  const [answer] = answerFor('overdue waada');
  assert.deepEqual(answer.rows.map((r) => r[0]), ['Ahmed', 'Bilal', 'Usman']);
  assert.deepEqual(answer.rows.map((r) => r[4]), ['15+', '8-14', '1-3']);
  assert.ok(answer.headline.includes('3 overdue Waada'));
});

test('suspense unclaimed: oldest first, claimed excluded, exact total', () => {
  const [answer] = answerFor('suspense unclaimed');
  assert.equal(answer.headlineCents, 35000);
  assert.deepEqual(answer.rows.map((r) => r[0]), ['S-1', 'S-2']);
  assert.ok(answer.insights.some((line) => line.includes('S-1') && line.includes('64 days')));
});

test('open tickets: priority then age, resolved excluded', () => {
  const [answer] = answerFor('open tickets');
  assert.deepEqual(answer.rows.map((r) => r[0]), ['Usman', 'Bilal', 'Ahmed']);
  assert.ok(answer.headline.includes('3 open ticket'));
});

test('repeat faults and at-risk: flags and triggering signals shown', () => {
  const [repeat] = answerFor('repeat faults');
  assert.deepEqual(repeat.rows.map((r) => r[0]), ['Ahmed', 'Bilal']);
  assert.equal(repeat.rows[0][3], '4');
  const [risk] = answerFor('at risk customers');
  assert.equal(risk.rows[0][0], 'Ahmed');
  assert.ok(risk.rows[0][2].includes('Late payments'));
});

test('disputed bills: open only, undisputed exact, over-total excess reported not hidden', () => {
  const [answer] = answerFor('disputed bills');
  assert.equal(answer.rows.length, 2);
  assert.equal(answer.rows[0][4], '600.00');
  assert.equal(answer.rows[1][4], '0.00');
  assert.ok(answer.insights.some((line) => line.includes('excess 100.00 PKR')));
});

test('collections: today and month exact, voided excluded', () => {
  const [answer] = answerFor("today's collections");
  assert.ok(answer.headline.includes('2000.00 PKR'));
  assert.ok(answer.headline.includes('3500.00 PKR'));
  assert.equal(answer.rows.length, 1);
  assert.equal(answer.rows[0][2], '2000.00');
});

test('mohalla attention: dues, Waada, tickets separate, ordered by dues, no score', () => {
  const [answer] = answerFor('which mohalla needs attention first');
  // No score field anywhere: no score column, no score key on the
  // answer. (The denial wording itself mentions the word score.)
  assert.ok(!('score' in answer));
  assert.ok(!answer.columns.some((c) => /score/i.test(c)));
  assert.ok(answer.insights.some((line) => line.includes('koi blended score nahi')));
  assert.equal(answer.rows[0][0], 'Bani');
  assert.equal(answer.rows[0][1], '500.00');
  assert.equal(answer.rows[0][3], '2');
  assert.equal(answer.rows[0][4], '2');
  assert.ok(answer.insights.some((line) => line.includes('alag alag')));
});

test('morning queue: exact fixed priority across sections', () => {
  const queue = buildMorningQueue(fixture());
  assert.equal(queue.orderText, MORNING_QUEUE_ORDER_TEXT);
  // Waada band 15+ (Ahmed) before 8-14 (Bilal) before 1-3 (Usman),
  // then high tickets no-connection oldest first (Usman T-3 before
  // Bilal T-2), then largest dues (Usman, Ahmed, Bilal), then
  // oldest suspense (S-1, S-2), then expiring in 3 days (Usman).
  assert.deepEqual(
    queue.items.map((item) => `${item.section}:${item.customerName}`),
    [
      'Overdue Waada:Ahmed', 'Overdue Waada:Bilal', 'Overdue Waada:Usman',
      'Open ticket:Usman', 'Open ticket:Bilal',
      'Largest dues:Usman', 'Largest dues:Ahmed', 'Largest dues:Bilal',
      'Suspense unclaimed:Payer not identified', 'Suspense unclaimed:Payer not identified',
    ],
  );
  assert.equal(queue.totalCount, 12);
  assert.equal(queue.shownCount, 10);
  assert.equal(queue.hasMore, true);
  assert.equal(queue.items[0].action, 'Waada follow-up');
  assert.equal(queue.items[3].action, 'Ticket dekhein');
  assert.equal(queue.items[5].action, 'Reminder draft');
});

test('morning queue: Waada largest first inside a band, cap 10', () => {
  const data = fixture();
  data.waada = [
    { customerId: 'c1', customerName: 'Small', mohalla: 'Bani', promiseDate: '2026-10-15', promiseAmountCents: 10000 },
    { customerId: 'c2', customerName: 'Big', mohalla: 'Bani', promiseDate: '2026-10-16', promiseAmountCents: 90000 },
  ];
  data.tickets = [];
  data.dues = [];
  data.suspense = [];
  data.expiries = [];
  const queue = buildMorningQueue(data);
  assert.deepEqual(queue.items.map((item) => item.customerName), ['Big', 'Small']);
  assert.equal(queue.hasMore, false);
});

test('morning queue answer carries the printed order and the cap note', () => {
  const [answer] = answerFor('morning queue');
  assert.ok(answer.insights.some((line) => line.includes('Overdue Waada (band 15+')));
  assert.ok(answer.insights.some((line) => line.includes('Baqi dekhein')));
});

test('empty source answers koi record nahi, never zero as fact', () => {
  const [answer] = answerFor('total dues', { today: TODAY, dues: [] });
  assert.equal(answer.empty, true);
  assert.equal(answer.headline, 'koi record nahi');
  assert.equal(answer.headlineCents, null);
  assert.equal(answer.rows.length, 0);
  const queue = buildMorningQueue({ today: TODAY });
  assert.equal(queue.empty, true);
});

test('asking never mutates the caller-supplied data', () => {
  const data = fixture();
  const before = JSON.stringify(data);
  answerPucho('mohalla baqaya', data);
  answerPucho('morning queue', data);
  answerPucho('total dues', data);
  assert.equal(JSON.stringify(data), before);
});

test('HTML escapes names and catalogue renders all 12 titles', () => {
  const data = fixture();
  data.dues = [{ customerId: 'c1', customerName: '<script>alert(1)</script>', mohalla: 'Bani', outstandingCents: 10000 }];
  const [answer] = answerFor('total dues', data);
  const html = puchoAnswerHtml(answer);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  const catalogue = puchoCatalogueHtml();
  // Owner 5-part fix: the catalogue is twelve clickable chips, not
  // a static bullet list — each chip carries the question's full
  // title in data-pucho-question and shows the short label.
  assert.ok(!catalogue.includes('<ul>'), 'catalogue is chips, not a bullet list');
  assert.equal((catalogue.match(/data-pucho-question="/g) || []).length, 12);
  for (const q of PUCHO_QUESTIONS) assert.ok(catalogue.includes(`data-pucho-question="${q.title.replaceAll("'", '&#39;')}"`));
});

test('morning queue CSV quotes fields and filename is fixed', () => {
  const queue = buildMorningQueue(fixture());
  const csv = morningQueueCsv(queue);
  assert.ok(csv.startsWith('#, Section, Customer, Mohalla, Detail, Amount (PKR), Action'));
  assert.equal(csv.split('\n').length, 11);
  assert.equal(morningQueueFilename(), 'morning-action-queue.csv');
});
