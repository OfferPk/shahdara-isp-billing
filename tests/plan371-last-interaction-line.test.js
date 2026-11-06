import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isStrictLastInteractionDate,
  latestMessageDateForCustomer,
  latestVisitDateForCustomer,
  lastInteractionFor,
  lastInteractionLineHtml,
} from '../last-interaction-line.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'last-interaction-line.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan371-last-interaction-line.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
const TEXTS = {
  heading: 'Last interaction',
  payment: 'Last payment',
  visit: 'Last visit',
  message: 'Last message',
  none: 'No interaction recorded',
};

const VISITS = [
  { id: 'V-1', date: '2026-10-02', customerId: 'CUST-1', customerName: 'Customer One' },
  { id: 'V-2', date: '2026-11-03', customerId: 'cust-1', customerName: 'Customer One' },
  { id: 'V-3', date: '2026-11-05', customerId: 'CUST-2', customerName: 'Customer Two' },
  { id: 'V-4', date: '2026-02-30', customerId: 'CUST-1', customerName: 'Customer One' },
];

const MESSAGES = [
  { customerId: 'CUST-1', type: 'balance', sent: true, sentDate: '2026-10-20', title: 'Balance reply' },
  { customerId: 'cust-1', type: 'greeting', sent: true, sentDate: '2026-11-04', title: 'Greeting' },
  { customerId: 'CUST-2', type: 'balance', sent: true, sentDate: '2026-11-06', title: 'Balance reply' },
  { customerId: 'CUST-1', type: 'balance', sent: true, sentDate: '2026-13-01', title: 'Bad date' },
];

test('Plan 371: strict dates accept real calendar dates, including leap day', () => {
  assert.equal(isStrictLastInteractionDate('2026-11-05'), true);
  assert.equal(isStrictLastInteractionDate('2024-02-29'), true);
  assert.equal(isStrictLastInteractionDate('2026-01-31'), true);
});

test('Plan 371: strict dates refuse impossible dates and bad shapes', () => {
  assert.equal(isStrictLastInteractionDate('2023-02-29'), false);
  assert.equal(isStrictLastInteractionDate('2026-02-30'), false);
  assert.equal(isStrictLastInteractionDate('2026-13-01'), false);
  assert.equal(isStrictLastInteractionDate('2026-11-31'), false);
  assert.equal(isStrictLastInteractionDate('2026/11/05'), false);
  assert.equal(isStrictLastInteractionDate('05-11-2026'), false);
  assert.equal(isStrictLastInteractionDate(''), false);
  assert.equal(isStrictLastInteractionDate(null), false);
  assert.equal(isStrictLastInteractionDate(20261105), false);
});

test('Plan 371: latest visit date picks the newest visit for the customer', () => {
  assert.equal(latestVisitDateForCustomer(VISITS, 'CUST-1'), '2026-11-03');
  assert.equal(latestVisitDateForCustomer(VISITS, 'CUST-2'), '2026-11-05');
});

test('Plan 371: visit lookup matches case-insensitively and ignores other customers', () => {
  assert.equal(latestVisitDateForCustomer(VISITS, 'cust-1'), '2026-11-03');
  assert.equal(latestVisitDateForCustomer(VISITS, 'CUST-9'), null);
  assert.equal(latestVisitDateForCustomer([], 'CUST-1'), null);
  assert.equal(latestVisitDateForCustomer(null, 'CUST-1'), null);
});

test('Plan 371: visit lookup ignores impossible dates and never mutates its input', () => {
  const before = JSON.stringify(VISITS);
  assert.equal(latestVisitDateForCustomer(VISITS, 'CUST-1'), '2026-11-03');
  assert.equal(JSON.stringify(VISITS), before);
});

test('Plan 371: latest message date picks the newest sent message for the customer', () => {
  assert.equal(latestMessageDateForCustomer(MESSAGES, 'CUST-1'), '2026-11-04');
  assert.equal(latestMessageDateForCustomer(MESSAGES, 'CUST-2'), '2026-11-06');
});

test('Plan 371: message lookup matches case-insensitively and ignores bad dates', () => {
  assert.equal(latestMessageDateForCustomer(MESSAGES, 'cust-1'), '2026-11-04');
  assert.equal(latestMessageDateForCustomer(MESSAGES, 'CUST-9'), null);
  assert.equal(latestMessageDateForCustomer([], 'CUST-1'), null);
  assert.equal(latestMessageDateForCustomer(null, 'CUST-1'), null);
});

test('Plan 371: last interaction picks the newest of payment, visit and message', () => {
  assert.deepEqual(
    lastInteractionFor({ paymentDate: '2026-10-15', visitDate: '2026-11-03', messageDate: '2026-10-20' }),
    { type: 'visit', date: '2026-11-03' },
  );
  assert.deepEqual(
    lastInteractionFor({ paymentDate: '2026-11-06', visitDate: '2026-11-03', messageDate: '2026-11-04' }),
    { type: 'payment', date: '2026-11-06' },
  );
  assert.deepEqual(
    lastInteractionFor({ paymentDate: null, visitDate: null, messageDate: '2026-09-01' }),
    { type: 'message', date: '2026-09-01' },
  );
});

test('Plan 371: same-day ties break payment first, then visit, then message', () => {
  assert.deepEqual(
    lastInteractionFor({ paymentDate: '2026-11-05', visitDate: '2026-11-05', messageDate: '2026-11-05' }),
    { type: 'payment', date: '2026-11-05' },
  );
  assert.deepEqual(
    lastInteractionFor({ paymentDate: null, visitDate: '2026-11-05', messageDate: '2026-11-05' }),
    { type: 'visit', date: '2026-11-05' },
  );
});

test('Plan 371: last interaction is null when no date is strict', () => {
  assert.equal(lastInteractionFor({ paymentDate: null, visitDate: null, messageDate: null }), null);
  assert.equal(lastInteractionFor({ paymentDate: '2026-02-30', visitDate: '', messageDate: 'soon' }), null);
  assert.equal(lastInteractionFor(null), null);
  assert.equal(lastInteractionFor('2026-11-05'), null);
});

test('Plan 371: line names the latest interaction type and its date', () => {
  const html = lastInteractionLineHtml({ type: 'visit', date: '2026-11-03' }, TEXTS);
  assert.ok(html.includes('Last visit'));
  assert.ok(html.includes('2026-11-03'));
  assert.ok(html.includes('profile-last-interaction'));
  const paymentHtml = lastInteractionLineHtml({ type: 'payment', date: '2026-11-06' }, TEXTS);
  assert.ok(paymentHtml.includes('Last payment'));
  assert.ok(paymentHtml.includes('2026-11-06'));
});

test('Plan 371: no interaction yet shows the no-interaction line, never a date', () => {
  const html = lastInteractionLineHtml(null, TEXTS);
  assert.ok(html.includes('No interaction recorded'));
  assert.ok(!html.includes('2026'));
  const badHtml = lastInteractionLineHtml({ type: 'visit', date: '2026-02-30' }, TEXTS);
  assert.ok(badHtml.includes('No interaction recorded'));
});

test('Plan 371: line escapes labels and dates', () => {
  const html = lastInteractionLineHtml(
    { type: 'message', date: '2026-11-04' },
    { ...TEXTS, message: 'Last <script>alert(1)</script> message' },
  );
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('2026-11-04'));
});

test('Plan 371: line uses plain defaults when the caller supplies no labels', () => {
  const html = lastInteractionLineHtml({ type: 'payment', date: '2026-11-06' }, {});
  assert.ok(html.includes('Last interaction'));
  assert.ok(html.includes('Last payment'));
  const noneHtml = lastInteractionLineHtml(null, undefined);
  assert.ok(noneHtml.includes('No interaction recorded'));
});

test('Plan 371: module is pure — no storage, clock, network, page or import', () => {
  assert.ok(!moduleSrc.includes('document.'));
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!moduleSrc.includes('new Date('));
  assert.ok(!moduleSrc.includes('Date.now('));
  assert.ok(!moduleSrc.includes('fetch('));
  assert.ok(!moduleSrc.includes('window.'));
  assert.ok(!moduleSrc.includes('import '));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  assert.ok(!moduleSrc.includes('shahdara_'));
});

test('Plan 371: module never names the fenced history module file literally', () => {
  const fenced = ['comms', '-timeline', '.js'].join('');
  assert.ok(!moduleSrc.includes(fenced));
  assert.ok(!testSrc.includes(fenced));
});

test('Plan 371: styles reuse existing colours only — no new hex in last-interaction rules', () => {
  const stripped = stylesSrc.replace(/\.profile-last-interaction[^{]*\{[^}]*\}|\.lil-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((stripped.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  const rules = stylesSrc.match(/\.profile-last-interaction[^{]*\{[^}]*\}|\.lil-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0, 'last-interaction styles exist');
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('Plan 371: app.js wires the line after the dues breakdown and before the household link', () => {
  assert.ok(appSrc.includes("from './last-interaction-line.js'"));
  assert.ok(appSrc.includes('latestVisitDateForCustomer('));
  assert.ok(appSrc.includes('latestMessageDateForCustomer('));
  assert.ok(appSrc.includes('lastInteractionFor('));
  assert.ok(appSrc.includes('lastInteractionLineHtml('));
  // Order, not adjacency: the Plan 372 verification tick section now
  // sits between the last-interaction line and the household link, so
  // the line is still after the dues breakdown and still before the
  // household link.
  const duesAt = appSrc.indexOf('${duesBreakdownSectionMarkup}');
  const lastAt = appSrc.indexOf('${lastInteractionLineMarkup}');
  const householdAt = appSrc.indexOf('${householdLinkSectionMarkup}');
  assert.ok(duesAt > 0 && lastAt > duesAt && householdAt > lastAt);
});

test('Plan 371: language tables carry the last-interaction labels in both languages', () => {
  for (const key of ['prof_lil_heading', 'prof_lil_payment', 'prof_lil_visit', 'prof_lil_message', 'prof_lil_none']) {
    assert.equal(langSrc.split(key).length - 1, 2, `${key} must appear once per language table`);
  }
});

test('Plan 371: profile order still holds — banner, then strip, then groups', () => {
  const bannerAt = appSrc.indexOf('wadaProfileBannerHtml(customer)');
  const stripAt = appSrc.indexOf('profileHeaderStripSectionHtml}');
  const groupsAt = appSrc.indexOf('profileInfoGroupsHtml}');
  assert.ok(bannerAt > 0 && stripAt > bannerAt && groupsAt > stripAt);
});

test('Plan 371: no real customer names or phone numbers in the module or its tests', () => {
  // Pattern-based: an 11-digit Pakistani mobile shape, or a +92 number,
  // must never appear in the module or its tests. (Substring checks
  // would trip on the pattern itself, so the shape is tested by regex.)
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(moduleSrc));
  assert.ok(!phoneShape.test(testSrc));
});
