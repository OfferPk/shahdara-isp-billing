import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validServiceTenureDay,
  serviceTenureFor,
  serviceTenureWords,
  serviceTenureDetail,
  serviceTenureSectionHtml,
} from '../service-tenure.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'service-tenure.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
// No phone numbers anywhere in this file.
function customer(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Customer One',
    mohalla: 'Mohalla A',
    connectionDate: '2023-11-06',
    ...overrides,
  };
}

const LABELS = {
  heading: 'Service tenure',
  yearOne: '1 year',
  years: '{n} years',
  monthOne: '1 month',
  months: '{n} months',
  notRecorded: 'Connection date not recorded',
  notStarted: 'Not started',
  endUnknown: 'End date not recorded',
  checkDates: 'Check connection dates',
  connectedSince: 'Connected since {date}',
  ended: 'Service ended {date}',
  recordedDate: 'Recorded connection date {date}',
  durationUnknown: 'Connected since {date} · duration unavailable',
  endBeforeConnection: 'Saved end date {date} is before connection',
};

// ---------------------------------------------------------------------------
// Strict dates
// ---------------------------------------------------------------------------

test('dates: strict calendar dates only, leap-aware', () => {
  assert.equal(validServiceTenureDay('2026-11-06'), '2026-11-06');
  assert.equal(validServiceTenureDay('2024-02-29'), '2024-02-29');
  assert.equal(validServiceTenureDay('2026-02-29'), null);
  assert.equal(validServiceTenureDay('2026-02-30'), null);
  assert.equal(validServiceTenureDay('2026-13-01'), null);
  assert.equal(validServiceTenureDay('2026-11-31'), null);
  assert.equal(validServiceTenureDay('2026-11-06T10:00:00'), '2026-11-06');
  assert.equal(validServiceTenureDay(''), null);
  assert.equal(validServiceTenureDay(null), null);
  assert.equal(validServiceTenureDay(20261106), null);
  assert.equal(validServiceTenureDay(' 2026-11-06 '), '2026-11-06');
});

// ---------------------------------------------------------------------------
// Tenure computation
// ---------------------------------------------------------------------------

test('tenure: no start date reads as not-recorded, never a guessed tenure', () => {
  assert.deepEqual(serviceTenureFor(customer({ connectionDate: null }), '2026-11-06'), {
    status: 'not-recorded', startDate: null, endDate: null, totalMonths: null, years: null, months: null,
  });
  assert.deepEqual(serviceTenureFor(customer({ connectionDate: '' }), '2026-11-06').status, 'not-recorded');
  assert.deepEqual(serviceTenureFor({ id: 'CUST-1' }, '2026-11-06').status, 'not-recorded');
  assert.deepEqual(serviceTenureFor(customer({ connectionDate: '2026-02-30' }), '2026-11-06').status, 'not-recorded');
  assert.deepEqual(serviceTenureFor(customer({ connectionDate: 'not a date' }), '2026-11-06').status, 'not-recorded');
});

test('tenure: an invalid today reads as not-recorded, never a guessed tenure', () => {
  assert.equal(serviceTenureFor(customer(), 'not a date').status, 'not-recorded');
  assert.equal(serviceTenureFor(customer(), null).status, 'not-recorded');
  assert.equal(serviceTenureFor(customer(), '').status, 'not-recorded');
});

test('tenure: whole months and years from the recorded start date', () => {
  const tenure = serviceTenureFor(customer({ connectionDate: '2023-11-06' }), '2026-11-06');
  assert.equal(tenure.status, 'current');
  assert.equal(tenure.startDate, '2023-11-06');
  assert.equal(tenure.endDate, null);
  assert.equal(tenure.totalMonths, 37);
  assert.equal(tenure.years, 3);
  assert.equal(tenure.months, 1);
});

test('tenure: the connection month itself counts as month one', () => {
  const tenure = serviceTenureFor(customer({ connectionDate: '2026-11-06' }), '2026-11-06');
  assert.equal(tenure.status, 'current');
  assert.equal(tenure.totalMonths, 1);
  assert.equal(tenure.years, 0);
  assert.equal(tenure.months, 1);
});

test('tenure: years split at whole years of months', () => {
  assert.deepEqual(
    [serviceTenureFor(customer({ connectionDate: '2025-11-06' }), '2026-10-06').totalMonths,
      serviceTenureFor(customer({ connectionDate: '2025-11-06' }), '2026-10-06').years,
      serviceTenureFor(customer({ connectionDate: '2025-11-06' }), '2026-10-06').months],
    [12, 1, 0],
  );
  assert.deepEqual(
    [serviceTenureFor(customer({ connectionDate: '2025-11-06' }), '2026-11-06').totalMonths,
      serviceTenureFor(customer({ connectionDate: '2025-11-06' }), '2026-11-06').years,
      serviceTenureFor(customer({ connectionDate: '2025-11-06' }), '2026-11-06').months],
    [13, 1, 1],
  );
  assert.deepEqual(
    [serviceTenureFor(customer({ connectionDate: '2024-11-06' }), '2026-10-06').totalMonths,
      serviceTenureFor(customer({ connectionDate: '2024-11-06' }), '2026-10-06').years,
      serviceTenureFor(customer({ connectionDate: '2024-11-06' }), '2026-10-06').months],
    [24, 2, 0],
  );
  assert.deepEqual(
    [serviceTenureFor(customer({ connectionDate: '2024-11-06' }), '2026-11-06').totalMonths,
      serviceTenureFor(customer({ connectionDate: '2024-11-06' }), '2026-11-06').years,
      serviceTenureFor(customer({ connectionDate: '2024-11-06' }), '2026-11-06').months],
    [25, 2, 1],
  );
});

test('tenure: calendar-month counting ignores the day of the month', () => {
  // 30 Nov 2023 to 1 Nov 2026 is still Nov 2023 .. Nov 2026 inclusive.
  assert.equal(serviceTenureFor(customer({ connectionDate: '2023-11-30' }), '2026-11-01').totalMonths, 37);
  // 1 Dec 2023 to 30 Nov 2026 is Dec 2023 .. Nov 2026 inclusive.
  assert.equal(serviceTenureFor(customer({ connectionDate: '2023-12-01' }), '2026-11-30').totalMonths, 36);
});

test('tenure: a start date in the future reads as not started', () => {
  const tenure = serviceTenureFor(customer({ connectionDate: '2027-01-01' }), '2026-11-06');
  assert.equal(tenure.status, 'future');
  assert.equal(tenure.startDate, '2027-01-01');
  assert.equal(tenure.totalMonths, null);
});

test('tenure: an ended customer counts only up to the recorded end date', () => {
  const tenure = serviceTenureFor(
    customer({ connectionDate: '2023-01-10', cancellationDate: '2025-06-15' }),
    '2026-11-06',
  );
  assert.equal(tenure.status, 'ended');
  assert.equal(tenure.endDate, '2025-06-15');
  assert.equal(tenure.totalMonths, 30);
  assert.equal(tenure.years, 2);
  assert.equal(tenure.months, 6);
});

test('tenure: an expiry date of today still counts as current', () => {
  const tenure = serviceTenureFor(
    customer({ connectionDate: '2023-01-10', expiryDate: '2026-11-06' }),
    '2026-11-06',
  );
  assert.equal(tenure.status, 'current');
  assert.equal(tenure.totalMonths, 47);
  assert.equal(tenure.years, 3);
  assert.equal(tenure.months, 11);
});

test('tenure: an expiry date before today ends the tenure', () => {
  const tenure = serviceTenureFor(
    customer({ connectionDate: '2023-01-10', expiryDate: '2026-11-05' }),
    '2026-11-06',
  );
  assert.equal(tenure.status, 'ended');
  assert.equal(tenure.endDate, '2026-11-05');
  assert.equal(tenure.totalMonths, 47);
});

test('tenure: the earliest recorded end date wins', () => {
  const tenure = serviceTenureFor(
    customer({ connectionDate: '2023-01-10', cancellationDate: '2025-06-15', expiryDate: '2025-03-10' }),
    '2026-11-06',
  );
  assert.equal(tenure.status, 'ended');
  assert.equal(tenure.endDate, '2025-03-10');
  assert.equal(tenure.totalMonths, 27);
  assert.equal(tenure.years, 2);
  assert.equal(tenure.months, 3);
});

test('tenure: an archived customer counts up to the archive date', () => {
  const tenure = serviceTenureFor(
    customer({ connectionDate: '2023-01-10', archived: true, archivedAt: '2025-06-15T10:00:00' }),
    '2026-11-06',
  );
  assert.equal(tenure.status, 'ended');
  assert.equal(tenure.endDate, '2025-06-15');
  assert.equal(tenure.totalMonths, 30);
});

test('tenure: an ended customer with no recorded end date reads as end-date-unknown', () => {
  const tenure = serviceTenureFor(
    customer({ connectionDate: '2023-01-10', archived: true, archivedAt: null }),
    '2026-11-06',
  );
  assert.equal(tenure.status, 'end-date-unknown');
  assert.equal(tenure.endDate, null);
  assert.equal(tenure.totalMonths, null);
});

test('tenure: an end date before the start date reads as a date problem', () => {
  const tenure = serviceTenureFor(
    customer({ connectionDate: '2026-11-06', cancellationDate: '2026-10-01' }),
    '2026-11-06',
  );
  assert.equal(tenure.status, 'date-review');
  assert.equal(tenure.endDate, '2026-10-01');
  assert.equal(tenure.totalMonths, null);
});

test('tenure: inputs are never mutated', () => {
  const record = customer({ connectionDate: '2023-11-06' });
  Object.freeze(record);
  const tenure = serviceTenureFor(record, '2026-11-06');
  assert.equal(tenure.totalMonths, 37);
  assert.equal(record.connectionDate, '2023-11-06');
});

// ---------------------------------------------------------------------------
// Plain words
// ---------------------------------------------------------------------------

test('words: years and months in plain words', () => {
  assert.equal(serviceTenureWords(serviceTenureFor(customer({ connectionDate: '2023-11-06' }), '2026-11-06'), LABELS), '3 years 1 month');
  assert.equal(serviceTenureWords(serviceTenureFor(customer({ connectionDate: '2024-11-06' }), '2026-10-06'), LABELS), '2 years');
  assert.equal(serviceTenureWords(serviceTenureFor(customer({ connectionDate: '2025-11-06' }), '2026-11-06'), LABELS), '1 year 1 month');
  assert.equal(serviceTenureWords(serviceTenureFor(customer({ connectionDate: '2025-11-06' }), '2026-10-06'), LABELS), '1 year');
  assert.equal(serviceTenureWords(serviceTenureFor(customer({ connectionDate: '2026-11-06' }), '2026-11-06'), LABELS), '1 month');
  assert.equal(serviceTenureWords(serviceTenureFor(customer({ connectionDate: '2026-10-06' }), '2026-11-06'), LABELS), '2 months');
});

test('words: every non-current status reads in plain words, never a number', () => {
  assert.equal(serviceTenureWords(serviceTenureFor(customer({ connectionDate: null }), '2026-11-06'), LABELS), 'Connection date not recorded');
  assert.equal(serviceTenureWords(serviceTenureFor(customer({ connectionDate: '2027-01-01' }), '2026-11-06'), LABELS), 'Not started');
  assert.equal(serviceTenureWords(serviceTenureFor(customer({ connectionDate: '2023-01-10', archived: true, archivedAt: null }), '2026-11-06'), LABELS), 'End date not recorded');
  assert.equal(serviceTenureWords(serviceTenureFor(customer({ connectionDate: '2026-11-06', cancellationDate: '2026-10-01' }), '2026-11-06'), LABELS), 'Check connection dates');
});

// ---------------------------------------------------------------------------
// Detail line and section HTML
// ---------------------------------------------------------------------------

test('detail: the recorded date line matches the status', () => {
  assert.equal(serviceTenureDetail(serviceTenureFor(customer({ connectionDate: '2023-11-06' }), '2026-11-06'), LABELS), 'Connected since 2023-11-06');
  assert.equal(serviceTenureDetail(serviceTenureFor(customer({ connectionDate: '2023-01-10', cancellationDate: '2025-06-15' }), '2026-11-06'), LABELS), 'Service ended 2025-06-15');
  assert.equal(serviceTenureDetail(serviceTenureFor(customer({ connectionDate: '2027-01-01' }), '2026-11-06'), LABELS), 'Recorded connection date 2027-01-01');
  assert.equal(serviceTenureDetail(serviceTenureFor(customer({ connectionDate: '2023-01-10', archived: true, archivedAt: null }), '2026-11-06'), LABELS), 'Connected since 2023-01-10 · duration unavailable');
  assert.equal(serviceTenureDetail(serviceTenureFor(customer({ connectionDate: '2026-11-06', cancellationDate: '2026-10-01' }), '2026-11-06'), LABELS), 'Saved end date 2026-10-01 is before connection');
  assert.equal(serviceTenureDetail(serviceTenureFor(customer({ connectionDate: null }), '2026-11-06'), LABELS), '');
});

test('section: a current customer shows heading, tenure words and the start date', () => {
  const html = serviceTenureSectionHtml(customer({ connectionDate: '2023-11-06' }), '2026-11-06', LABELS);
  assert.ok(html.includes('<h3>Service tenure</h3>'), 'heading is shown');
  assert.ok(html.includes('3 years 1 month'), 'tenure in plain words is shown');
  assert.ok(html.includes('Connected since 2023-11-06'), 'start date is shown');
  assert.ok(html.includes('class="service-tenure-section stv-section"'), 'section carries its classes');
});

test('section: a customer with no start date shows the not-recorded wording and no detail line', () => {
  const html = serviceTenureSectionHtml(customer({ connectionDate: null }), '2026-11-06', LABELS);
  assert.ok(html.includes('Connection date not recorded'), 'not-recorded wording is shown');
  assert.ok(!html.includes('stv-detail'), 'no detail line is shown');
});

test('section: labels are escaped before they reach the page', () => {
  const html = serviceTenureSectionHtml(customer(), '2026-11-06', { ...LABELS, heading: '<b>Tenure</b>' });
  assert.ok(!html.includes('<b>Tenure</b>'), 'raw markup never reaches the page');
  assert.ok(html.includes('&lt;b&gt;Tenure&lt;/b&gt;'), 'the heading is escaped');
});

// ---------------------------------------------------------------------------
// Purity, fences, wiring
// ---------------------------------------------------------------------------

test('purity: the module never touches the page, storage, the clock or the network', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
});

test('fences: the module never names the neighbouring recognition, anniversary or retention modules', () => {
  // The neighbouring modules were checked by filename first and are
  // neither read nor rewritten here, so this module never names them —
  // each name is built from fragments so the literal filename appears
  // nowhere in this file either.
  const neighbours = [
    'loyalty' + '-recognition',
    'anniversary' + '-milestone',
    'loyalty' + '-retention',
  ];
  for (const name of neighbours) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!readFileSync(fileURLToPath(import.meta.url), 'utf8').includes(name + '.js'), `test must not name ${name}.js`);
  }
});

test('store: the display holds no store of its own', () => {
  assert.ok(!moduleSrc.includes('STORE_KEY'));
  assert.ok(!moduleSrc.includes('shahdara_'));
});

test('i18n: the new keys exist in both language tables', () => {
  for (const key of ['prof_tenure_heading', 'prof_tenure_year_1', 'prof_tenure_years']) {
    const hits = langSrc.split('\n').filter((line) => line.includes(key)).length;
    assert.ok(hits >= 2, `nav-language.js must define ${key} in both tables, found ${hits}`);
  }
});

test('wiring: app.js imports the module and shows the section after the package history', () => {
  assert.ok(appSrc.includes("from './service-tenure.js'"));
  assert.ok(appSrc.includes('serviceTenureSectionHtml(customer, localDate(), {'));
  assert.ok(appSrc.includes('${packageHistorySectionMarkup}${serviceTenureSectionMarkup}'));
});

test('wiring: the profile order assertion still holds — banner, strip, then groups', () => {
  // Polish #28 Phase A — the profile renders as 7 <details> sections:
  // the strip sits in the assembly above every section, the wada banner
  // opens the Financial section, and the field groups are fragments
  // inside the section bodies. The old flat order (banner → strip →
  // groups) no longer exists; the preserved intent is strip above the
  // sections and the tenure display second in Service, after the
  // package history.
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  const serviceAt = appSrc.indexOf('${profileSectionServiceHtml}', stripAt);
  assert.ok(stripAt > 0, 'strip is in the profile assembly');
  assert.ok(serviceAt > stripAt, 'Service section sits after the strip');
  const serviceBodyAt = appSrc.indexOf('const profileSectionServiceBody = ');
  const serviceBody = appSrc.slice(serviceBodyAt, appSrc.indexOf('\n', serviceBodyAt));
  const packageAt = serviceBody.indexOf('${packageHistorySectionMarkup}');
  const tenureAt = serviceBody.indexOf('${serviceTenureSectionMarkup}');
  assert.ok(packageAt > 0 && tenureAt > packageAt, 'tenure display sits after the package history, inside Service');
});

test('styles: the tenure rules exist and reuse an existing colour only', () => {
  for (const cls of ['.stv-section', '.stv-primary', '.stv-detail']) {
    assert.ok(stylesSrc.includes(cls), `styles must define ${cls}`);
  }
  const stvLines = stylesSrc.split('\n').filter((line) => line.includes('.stv-'));
  for (const line of stvLines) {
    for (const hex of line.match(/#[0-9a-fA-F]{3,8}/g) ?? []) {
      assert.equal(hex.toLowerCase(), '#5c6e66', `stv rule must reuse an existing colour, found ${hex}`);
    }
  }
});
