import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildProfilePrintCardHtml, validProfilePrintCardDay } from '../profile-print-card.js';
import { buildProfileHeaderStrip, profileHeaderStripHtml } from '../profile-header-strip.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'profile-print-card.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan362-profile-print-card.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

// Money is formatted exactly as the app formats it: PKR rupees, no conversion.
const format = (value) => `PKR ${value}`;

const fullFixture = () => ({
  customerId: 'CUST-1',
  customerName: 'Customer One',
  customerNumber: '36',
  businessName: 'Shahdara ISP',
  knownAs: 'Shuna',
  mohalla: 'Shahdara Village',
  packageLabel: '15 Mbps',
  packagePrice: 3000,
  outstanding: 3000,
  lastPayment: { amount: 3000, date: '2026-10-05' },
  contactNumber: '03012345678',
  handlingNote: 'Collect only from the father.',
  printDate: '2026-11-06',
});

test('Plan 362: full card carries all eight fields, the print date and the business name', () => {
  const card = buildProfilePrintCardHtml(fullFixture(), format);
  assert.ok(card);
  assert.ok(card.includes('Customer One'));
  assert.ok(card.includes('#36'));
  assert.ok(card.includes('Shahdara ISP'));
  assert.ok(card.includes('Shuna'));
  assert.ok(card.includes('Shahdara Village'));
  assert.ok(card.includes('15 Mbps'));
  assert.ok(card.includes('PKR 3000'));
  assert.ok(card.includes('2026-10-05'));
  assert.ok(card.includes('03012345678'));
  assert.ok(card.includes('Collect only from the father.'));
  assert.ok(card.includes('Printed on 2026-11-06'));
});

test('Plan 362: card figures match the profile strip on the same fixture', () => {
  const fixture = fullFixture();
  const strip = buildProfileHeaderStrip({
    customerId: fixture.customerId,
    customerName: fixture.customerName,
    outstanding: fixture.outstanding,
    packageLabel: fixture.packageLabel,
    packagePrice: fixture.packagePrice,
    lastPayment: fixture.lastPayment,
    nextDueDate: null,
  });
  assert.ok(strip, 'strip builds from the same fixture');
  const stripHtml = profileHeaderStripHtml(strip, format);
  const values = [...stripHtml.matchAll(/<strong class="phs-value"[^>]*>(.*?)<\/strong>/g)].map((m) => m[1]);
  assert.equal(values.length, 4, 'strip shows dues, package, last payment and next due');
  const card = buildProfilePrintCardHtml(fixture, format);
  assert.ok(card);
  // Dues, package and last payment on the card are the profile's own figures.
  for (const value of values.slice(0, 3)) {
    assert.ok(card.includes(value), `card must show the profile figure ${value}`);
  }
});

test('Plan 362: zero dues reads "No amount due"', () => {
  const card = buildProfilePrintCardHtml({ ...fullFixture(), outstanding: 0 }, format);
  assert.ok(card.includes('No amount due'));
});

test('Plan 362: missing or unusable dues reads "Not recorded", never a guessed zero', () => {
  for (const outstanding of [null, undefined, '', -5, 'not-a-number', true]) {
    const card = buildProfilePrintCardHtml({ ...fullFixture(), outstanding }, format);
    assert.ok(card.includes('Not recorded'), `outstanding ${String(outstanding)} must read Not recorded`);
    assert.ok(!card.includes('No amount due'), 'a missing due must not read as nothing due');
  }
});

test('Plan 362: no package label reads "No package recorded"', () => {
  const card = buildProfilePrintCardHtml({ ...fullFixture(), packageLabel: '', packagePrice: null }, format);
  assert.ok(card.includes('No package recorded'));
});

test('Plan 362: package label without a price shows the label only, never a guessed price', () => {
  const card = buildProfilePrintCardHtml({ ...fullFixture(), packagePrice: null }, format);
  assert.ok(card.includes('15 Mbps'));
  assert.ok(!card.includes('/month'), 'no price means no per-month price on the card');
});

test('Plan 362: no last payment reads "No payment yet"', () => {
  const card = buildProfilePrintCardHtml({ ...fullFixture(), lastPayment: null }, format);
  assert.ok(card.includes('No payment yet'));
});

test('Plan 362: last payment with a bad date or no amount reads "No payment yet"', () => {
  for (const lastPayment of [
    { amount: 3000, date: '2026-02-30' },
    { amount: 0, date: '2026-10-05' },
    { amount: null, date: '2026-10-05' },
    { amount: 3000, date: '' },
  ]) {
    const card = buildProfilePrintCardHtml({ ...fullFixture(), lastPayment }, format);
    assert.ok(card.includes('No payment yet'), `last payment ${JSON.stringify(lastPayment)} must not print`);
    assert.ok(!card.includes('2026-02-30'));
  }
});

test('Plan 362: missing known-as, mohalla and contact number read "Not recorded"', () => {
  const card = buildProfilePrintCardHtml({
    ...fullFixture(), knownAs: '', mohalla: '', contactNumber: '',
  }, format);
  assert.ok(card.includes('Not recorded'));
  assert.equal((card.match(/Not recorded/g) || []).length, 3, 'one Not recorded per missing field');
});

test('Plan 362: missing handling note reads "No handling note recorded"', () => {
  for (const handlingNote of ['', null, undefined]) {
    const card = buildProfilePrintCardHtml({ ...fullFixture(), handlingNote }, format);
    assert.ok(card.includes('No handling note recorded'));
  }
});

test('Plan 362: missing or unusable print date refuses the card — never print without a date', () => {
  for (const printDate of [null, undefined, '', 'not-a-date', '2026-02-30', '2026-02-29', '2026-13-01']) {
    assert.equal(
      buildProfilePrintCardHtml({ ...fullFixture(), printDate }, format),
      null,
      `print date ${String(printDate)} must refuse the card`,
    );
  }
});

test('Plan 362: leap-day print date is accepted in a leap year', () => {
  const card = buildProfilePrintCardHtml({ ...fullFixture(), printDate: '2024-02-29' }, format);
  assert.ok(card);
  assert.ok(card.includes('Printed on 2024-02-29'));
});

test('Plan 362: datetime print date contributes only its date part', () => {
  const card = buildProfilePrintCardHtml({ ...fullFixture(), printDate: '2026-11-06T10:15:00' }, format);
  assert.ok(card);
  assert.ok(card.includes('Printed on 2026-11-06'));
  assert.ok(!card.includes('10:15'));
});

test('Plan 362: user-entered text is escaped on the card', () => {
  const card = buildProfilePrintCardHtml({
    ...fullFixture(),
    customerName: 'A <script> & "B"',
    knownAs: '<b>nick</b>',
    handlingNote: 'Say "hi" <now> & go',
  }, format);
  assert.ok(card);
  assert.ok(!card.includes('<script>'));
  assert.ok(!card.includes('<b>nick</b>'));
  assert.ok(card.includes('A &lt;script&gt; &amp; &quot;B&quot;'));
  assert.ok(card.includes('&lt;b&gt;nick&lt;/b&gt;'));
  assert.ok(card.includes('Say &quot;hi&quot; &lt;now&gt; &amp; go'));
});

test('Plan 362: inputs are never mutated', () => {
  const fixture = fullFixture();
  const before = JSON.stringify(fixture);
  buildProfilePrintCardHtml(fixture, format);
  assert.equal(JSON.stringify(fixture), before);
});

test('Plan 362: the card is one standalone printable page', () => {
  const card = buildProfilePrintCardHtml(fullFixture(), format);
  assert.ok(card.startsWith('<!doctype html>'));
  assert.ok(card.includes('<title>Profile card — Customer One</title>'));
  assert.equal((card.match(/class="ppc-card"/g) || []).length, 1, 'exactly one card on the page');
  assert.ok(card.includes('@page'), 'print page size is set for one A4 sheet');
});

test('Plan 362: money is PKR only, never converted', () => {
  const card = buildProfilePrintCardHtml({ ...fullFixture(), packagePrice: 3000, outstanding: 1500 }, format);
  assert.ok(card.includes('PKR 3000'));
  assert.ok(card.includes('PKR 1500'));
  assert.ok(!card.includes('USD'));
  assert.ok(!card.includes('PKR 300000'), 'rupees must not be treated as cents');
});

test('Plan 362: business name defaults to Shahdara ISP and follows the caller', () => {
  const { businessName, ...rest } = fullFixture();
  assert.ok(buildProfilePrintCardHtml(rest, format).includes('Shahdara ISP'));
  const card = buildProfilePrintCardHtml({ ...fullFixture(), businessName: 'Shahdara Fiber Net' }, format);
  assert.ok(card.includes('Shahdara Fiber Net'));
});

test('Plan 362: a customer without a number shows no number fragment', () => {
  const card = buildProfilePrintCardHtml({ ...fullFixture(), customerNumber: '' }, format);
  assert.ok(card.includes('Customer One'));
  assert.ok(!card.includes('<span>#'), 'no number span when the record has no number');
});

test('Plan 362: strict day validation for the print date', () => {
  assert.equal(validProfilePrintCardDay('2026-11-06'), '2026-11-06');
  assert.equal(validProfilePrintCardDay('2024-02-29'), '2024-02-29');
  assert.equal(validProfilePrintCardDay('2026-02-29'), null);
  assert.equal(validProfilePrintCardDay('2026-02-30'), null);
  assert.equal(validProfilePrintCardDay('2026-04-31'), null);
  assert.equal(validProfilePrintCardDay('2026-13-01'), null);
  assert.equal(validProfilePrintCardDay('2026-00-10'), null);
  assert.equal(validProfilePrintCardDay(''), null);
  assert.equal(validProfilePrintCardDay(null), null);
  assert.equal(validProfilePrintCardDay(20261106), null);
  assert.equal(validProfilePrintCardDay('2026-11-06T09:00:00'), '2026-11-06');
});

test('Plan 362: module is pure — no page, storage, clock, network or standalone OLT', () => {
  assert.ok(!moduleSrc.includes('document.'));
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!moduleSrc.includes('new Date('));
  assert.ok(!moduleSrc.includes('Date.now('));
  assert.ok(!moduleSrc.includes('fetch('));
  assert.ok(!moduleSrc.includes('window.'));
  assert.ok(!moduleSrc.includes('import '));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  assert.ok(!/03\d{9}/.test(moduleSrc));
});

test('Plan 362: module holds no store of its own', () => {
  assert.ok(!moduleSrc.includes('shahdara_'), 'no store key in the module');
  assert.ok(!moduleSrc.includes('STORE_KEY'));
});

test('Plan 362: the print page reuses only colours already used by the existing print card', () => {
  const hexes = new Set(moduleSrc.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  for (const hex of hexes) {
    assert.ok(hex === '#111' || hex === '#444', `new hex colour ${hex} must not appear`);
  }
});

test('Plan 362: module header and tests never name fenced neighbour modules literally', () => {
  const fenced = [
    ['print', 'template', 'register'].join('-') + '.js',
    ['print', 'queue', 'log'].join('-') + '.js',
    ['qr', 'card'].join('-') + '.js',
    ['receipt'].join('-') + '.js',
    ['household', 'link'].join('-') + '.js',
    ['move', 'house', 'history'].join('-') + '.js',
    ['number', 'change', 'log'].join('-') + '.js',
    ['package', 'history', 'view'].join('-') + '.js',
    ['service', 'tenure'].join('-') + '.js',
    ['handling', 'note'].join('-') + '.js',
    ['known', 'as', 'name'].join('-') + '.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('Plan 362: app.js wires the module, the print button and the print binding', () => {
  assert.ok(appSrc.includes("from './profile-print-card.js'"));
  assert.ok(appSrc.includes('buildProfilePrintCardHtml'));
  assert.ok(appSrc.includes('id="profilePrintCardButton"'));
  assert.ok(appSrc.includes("t('prof_view_print_card')"));
  assert.ok(appSrc.includes("querySelector('#profilePrintCardButton')"));
});

test('Plan 362: print card label exists in both language tables', () => {
  const hits = langSrc.split('prof_view_print_card').length - 1;
  assert.ok(hits >= 2, `prof_view_print_card appears ${hits} times`);
});

test('Plan 362: the card needs no app stylesheet rule', () => {
  assert.ok(!stylesSrc.includes('ppc-'), 'the standalone print page carries its own styles');
});
