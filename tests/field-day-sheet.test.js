/**
 * field-day-sheet.test.js — M10: Saad Field Day Sheet (printable,
 * read-only).
 *
 * Pins the sheet against the derivations it composes — never against
 * a parallel expectation:
 *  - pending installations = extras.installRequests filtered by
 *    install-tracker.js requestStatus === 'Pending' (the Morning
 *    Briefing's own pending rule), recorded order;
 *  - open complaints = the set buildComplaintSummary counts as open
 *    (status 'Open' + 'In Progress'; 'Resolved' never appears);
 *  - waadas due today = buildMorningBriefing's waadas.entries verbatim
 *    (settled + archived promises already dead in that derivation);
 *  - expired vacation holds = buildExpiredVacationHoldQueue verbatim
 *    (SISP-186; active + archived holds excluded by that builder);
 *  - every row carries name + mohalla + phone AS RECORDED (request's
 *    own phone, else the linked customer's; complaint/hold/waada
 *    contacts join by customerId; area outages keep their zone and
 *    carry no phone);
 *  - read-only: building + printing mutate nothing (state deep-equal
 *    before/after), and two builds are deep-equal;
 *  - print HTML escapes customer names with HTML-special characters,
 *    renders both languages with no raw fds_* keys, and DOES carry the
 *    recorded phone numbers (the paper stays with the owner) — while
 *    the module ships no WhatsApp/text variant at all;
 *  - mechanical i18n audit of every fds_* key in both languages, and
 *    the index.html / app.js wiring pins.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFieldDaySheet, buildFieldDaySheetPrintHtml } from '../field-day-sheet.js';
import { buildMorningBriefing } from '../morning-briefing.js';
import { buildComplaintSummary, AREA_OUTAGE_CUSTOMER_ID } from '../complaint-register.js';
import { requestStatus, requestNameLabel } from '../install-tracker.js';
import { buildExpiredVacationHoldQueue } from '../pause-billing.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const TODAY = '2026-10-30';
const NOW = new Date('2026-10-30T03:00:00.000Z'); // 08:00 PKT

function fixtureState() {
  return {
    customers: [
      {
        id: 'c1', customerNumber: 101, name: 'Test Waada One', nameUrdu: 'ٹیسٹ واعدہ ایک',
        mohalla: 'CHARYAA', phone: '0300-9999999',
        promiseDate: TODAY, promiseAmount: 1500,
        bills: [{ id: 'b1', month: '2026-10', dueAmount: 3000, payments: [] }]
      },
      {
        id: 'c2', customerNumber: 102, name: 'Test Waada Settled', mohalla: 'CHARYAA', phone: '0300-8888888',
        promiseDate: TODAY, promiseAmount: 1000,
        bills: [{
          id: 'b2', month: '2026-10', dueAmount: 1000,
          payments: [{ id: 'p2', date: '2026-10-06', amount: 1000, method: 'Cash' }]
        }]
      },
      {
        id: 'c3', customerNumber: 103, name: 'Test Hold Expired', mohalla: 'BANII', phone: '0300-7777777',
        paused: true, pauseStartDate: '2026-10-01', autoResumeDate: '2026-10-20', bills: []
      },
      {
        id: 'c4', customerNumber: 104, name: 'Test Hold Active', mohalla: 'BANII', phone: '0300-7777778',
        paused: true, pauseStartDate: '2026-10-25', autoResumeDate: '2026-11-15', bills: []
      },
      {
        id: 'c5', customerNumber: 105, name: 'Test Hold Archived', archived: true, mohalla: 'BANII', phone: '0300-7777779',
        paused: true, pauseStartDate: '2026-09-01', autoResumeDate: '2026-09-20', bills: []
      },
      {
        id: 'c6', customerNumber: 106, name: 'Test Complaint Linked', mohalla: 'NAKAR', phone: '0300-6666666',
        bills: []
      },
      {
        id: 'c7', customerNumber: 107, name: 'Test <Evil> & "Co"', mohalla: 'SODAA', phone: '0300-5555555',
        promiseDate: TODAY, promiseAmount: null,
        bills: [{ id: 'b7', month: '2026-10', dueAmount: 1200, payments: [] }]
      }
    ]
  };
}

function fixtureExtras() {
  return {
    complaints: [
      {
        id: 'CMP-1', customerId: 'c6', customerName: 'Test Complaint Linked', zone: '',
        issueCategory: 'No Internet', status: 'Open', reportedAt: '2026-10-29T09:15', resolvedAt: ''
      },
      {
        id: 'CMP-2', customerId: AREA_OUTAGE_CUSTOMER_ID, customerName: AREA_OUTAGE_CUSTOMER_ID, zone: 'GANGALL',
        issueCategory: 'Fiber Cut', status: 'In Progress', reportedAt: '2026-10-30T07:40', resolvedAt: ''
      },
      {
        id: 'CMP-3', customerId: 'c6', customerName: 'Test Complaint Linked', zone: '',
        issueCategory: 'Slow Speed', status: 'Resolved', reportedAt: '2026-10-28T10:00', resolvedAt: '2026-10-28T12:00'
      }
    ],
    settlements: [],
    installRequests: [
      { id: 'INS-1', requesterName: 'Test New Install', customerId: '', phone: '0300-4444444', requestDate: '2026-10-28', installDate: '' },
      { id: 'INS-2', requesterName: '', customerName: 'Test Linked Install', customerId: 'c6', customerNumber: 106, phone: '', requestDate: '2026-10-29' },
      { id: 'INS-3', requesterName: 'Test Done Install', customerId: '', phone: '0300-4444445', requestDate: '2026-10-18', installDate: '2026-10-20' }
    ],
    backupRecord: null,
    now: NOW
  };
}

test('M10 installs: exactly the Pending requests, recorded order, contacts as recorded', () => {
  const extras = fixtureExtras();
  const sheet = buildFieldDaySheet(fixtureState(), TODAY, extras);
  const expected = extras.installRequests.filter((r) => requestStatus(r) === 'Pending');
  assert.deepEqual(sheet.installs.map((row) => row.requestId), expected.map((r) => r.id));
  assert.deepEqual(sheet.installs.map((row) => row.name), expected.map((r) => requestNameLabel(r)));
  // Unlinked request: its own recorded phone, no mohalla recorded anywhere.
  assert.equal(sheet.installs[0].phone, '0300-4444444');
  assert.equal(sheet.installs[0].mohalla, '');
  assert.equal(sheet.installs[0].requestDate, '2026-10-28');
  // Linked request with no phone of its own: the customer record's phone + mohalla.
  assert.equal(sheet.installs[1].phone, '0300-6666666');
  assert.equal(sheet.installs[1].mohalla, 'NAKAR');
  assert.equal(sheet.counts.installs, 2);
});

test('M10 complaints: exactly the buildComplaintSummary open set; resolved never appears', () => {
  const extras = fixtureExtras();
  const sheet = buildFieldDaySheet(fixtureState(), TODAY, extras);
  const summary = buildComplaintSummary(extras.complaints, NOW);
  assert.equal(sheet.complaints.length, summary.open + summary.inProgress);
  assert.deepEqual(sheet.complaints.map((row) => row.complaintId), ['CMP-1', 'CMP-2']);
  assert.ok(sheet.complaints.every((row) => row.status !== 'Resolved'));
  // Linked complaint: customer label + the customer record's mohalla/phone.
  assert.equal(sheet.complaints[0].name, 'Test Complaint Linked');
  assert.equal(sheet.complaints[0].mohalla, 'NAKAR');
  assert.equal(sheet.complaints[0].phone, '0300-6666666');
  // Area outage: the register's own label, zone as the location, no phone.
  assert.equal(sheet.complaints[1].isAreaOutage, true);
  assert.equal(sheet.complaints[1].name, 'Area outage · GANGALL');
  assert.equal(sheet.complaints[1].mohalla, 'GANGALL');
  assert.equal(sheet.complaints[1].phone, '');
  assert.equal(sheet.counts.complaints, 2);
});

test('M10 waadas: exactly buildMorningBriefing entries, contacts joined by customerId', () => {
  const state = fixtureState();
  const extras = fixtureExtras();
  const sheet = buildFieldDaySheet(state, TODAY, extras);
  const briefing = buildMorningBriefing(state, TODAY, extras);
  assert.deepEqual(sheet.waadas.map((row) => row.customerId), briefing.waadas.entries.map((e) => e.customerId));
  assert.deepEqual(sheet.waadas.map((row) => row.customerId), ['c1', 'c7']);
  // The settled promise (c2) is dead in the briefing derivation and here.
  assert.ok(!sheet.waadas.some((row) => row.customerId === 'c2'));
  assert.equal(sheet.waadas[0].mohalla, 'CHARYAA');
  assert.equal(sheet.waadas[0].phone, '0300-9999999');
  assert.equal(sheet.waadas[0].promiseAmount, 1500);
  assert.equal(sheet.waadas[1].promiseAmount, null);
  assert.equal(sheet.counts.waadas, briefing.waadas.count);
});

test('M10 holds: exactly buildExpiredVacationHoldQueue; active + archived excluded by that builder', () => {
  const state = fixtureState();
  const sheet = buildFieldDaySheet(state, TODAY, fixtureExtras());
  const queue = buildExpiredVacationHoldQueue(state.customers, TODAY);
  assert.deepEqual(sheet.holds.map((row) => row.customerId), queue.map((row) => row.id));
  assert.deepEqual(sheet.holds.map((row) => row.customerId), ['c3']);
  assert.equal(sheet.holds[0].mohalla, 'BANII');
  assert.equal(sheet.holds[0].phone, '0300-7777777');
  assert.equal(sheet.holds[0].autoResumeDate, '2026-10-20');
  assert.equal(sheet.counts.holds, queue.length);
});

test('M10 purity: building + printing mutate nothing; two builds deep-equal', () => {
  const state = fixtureState();
  const extras = fixtureExtras();
  const before = structuredClone({ state, extras });
  const sheet = buildFieldDaySheet(state, TODAY, extras);
  buildFieldDaySheetPrintHtml(sheet);
  buildFieldDaySheetPrintHtml(sheet, { lang: 'ur' });
  assert.deepEqual({ state, extras }, before);
  assert.deepEqual(buildFieldDaySheet(state, TODAY, extras), sheet);
  assert.equal(sheet.dateStr, TODAY);
  assert.equal(sheet.counts.total,
    sheet.counts.installs + sheet.counts.complaints + sheet.counts.waadas + sheet.counts.holds);
});

test('M10 print HTML (en): sections, counts, recorded phones shown, names escaped, no raw keys', () => {
  const sheet = buildFieldDaySheet(fixtureState(), TODAY, fixtureExtras());
  const html = buildFieldDaySheetPrintHtml(sheet);
  assert.ok(html.includes(TRANSLATIONS.en.fds_title));
  assert.ok(html.includes(TRANSLATIONS.en.fds_installs));
  assert.ok(html.includes(TRANSLATIONS.en.fds_complaints));
  assert.ok(html.includes(TRANSLATIONS.en.fds_holds));
  // The printed sheet MAY carry phones — it never leaves the owner's hands.
  assert.ok(html.includes('0300-9999999'), 'waada phone printed');
  assert.ok(html.includes('0300-4444444'), 'install phone printed');
  assert.ok(html.includes('0300-7777777'), 'hold phone printed');
  // HTML-special characters in a customer name are escaped, never raw.
  assert.ok(html.includes('Test &lt;Evil&gt; &amp; &quot;Co&quot;'), 'evil name escaped');
  assert.ok(!html.includes('<Evil>'), 'no raw evil markup');
  // No resolved complaint and no installed request leak into the sheet.
  assert.ok(!html.includes('Slow Speed'), 'resolved complaint absent');
  assert.ok(!html.includes('Test Done Install'), 'installed request absent');
  assert.ok(!html.includes('fds_'), 'no raw i18n keys');
});

test('M10 print HTML (ur): Urdu headings + recorded Urdu name, no raw keys', () => {
  const sheet = buildFieldDaySheet(fixtureState(), TODAY, fixtureExtras());
  const html = buildFieldDaySheetPrintHtml(sheet, { lang: 'ur' });
  assert.ok(html.includes(TRANSLATIONS.ur.fds_title));
  assert.ok(html.includes(TRANSLATIONS.ur.fds_installs));
  assert.ok(html.includes('ٹیسٹ واعدہ ایک'), 'nameUrdu override rendered');
  assert.ok(html.includes('0300-9999999'), 'phone printed in ur sheet too');
  assert.ok(!html.includes('fds_'), 'no raw i18n keys');
});

test('M10 empty day: every section renders its empty line, counts all zero', () => {
  const sheet = buildFieldDaySheet({ customers: [] }, TODAY, { complaints: [], installRequests: [] });
  assert.deepEqual(sheet.counts, { installs: 0, complaints: 0, waadas: 0, holds: 0, total: 0 });
  const html = buildFieldDaySheetPrintHtml(sheet);
  assert.equal(html.split(TRANSLATIONS.en.fds_none).length - 1, 4);
});

const FDS_KEYS = [
  'fds_btn', 'fds_title', 'fds_installs', 'fds_complaints', 'fds_waadas',
  'fds_holds', 'fds_col_name', 'fds_col_mohalla', 'fds_col_phone', 'fds_col_detail',
  'fds_none', 'fds_requested_on', 'fds_resume_was', 'fds_popup_blocked', 'fds_foot'
];

test('M10 i18n audit: every fds_* key defined in both languages, t() resolves both', () => {
  assert.equal(FDS_KEYS.length, 15);
  for (const key of FDS_KEYS) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.equal(t(key, 'en'), TRANSLATIONS.en[key]);
    assert.equal(t(key, 'ur'), TRANSLATIONS.ur[key]);
  }
  // No fds_* key exists in one language only.
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('fds_'));
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('fds_'));
  assert.deepEqual(enKeys.sort(), urKeys.sort());
  assert.deepEqual(enKeys.sort(), [...FDS_KEYS].sort());
});

test('M10 wiring: one print button on the Morning Briefing card + app.js controller, no WhatsApp variant', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="fieldDaySheetBtn"'), 'button present');
  assert.ok(html.includes('data-i18n="fds_btn"'), 'button labelled from the dictionary');
  assert.equal(html.split('fieldDaySheetBtn').length - 1, 1, 'exactly one entry button');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("import { setupFieldDaySheet } from './field-day-sheet.js';"), 'app.js imports the controller');
  assert.ok(app.includes('setupFieldDaySheet(() => state'), 'app.js boots the controller');
  // The phone rule: the module ships NO WhatsApp/text variant at all.
  const moduleSource = readFileSync(new URL('../field-day-sheet.js', import.meta.url), 'utf8');
  assert.ok(!moduleSource.includes('wa.me'), 'no WhatsApp link anywhere in the module');
  assert.ok(!moduleSource.includes('buildFieldDaySheetText'), 'no text variant exported');
});
