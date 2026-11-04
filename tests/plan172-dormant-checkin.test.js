import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDormantSettings,
  normalizeDormantCustomer,
  normalizeDormantCustomerList,
  findDormantCustomer,
  recordDormantCustomer,
  removeDormantCustomer,
  dormantLastContactDate,
  dormantSilentDays,
  dormantIsDormant,
  dormantCheckinList,
  dormantCheckinForCustomer,
  markDormantContacted,
  dormantCheckinDraftText,
  dormantCustomers,
  dormantCheckinSummaryText,
  dormantCheckinAllHtml,
  dormantCheckinCsv,
  dormantCheckinFilename,
} from '../dormant-checkin.js';

const dir = dirname(fileURLToPath(import.meta.url));
const today = '2026-11-04';
const settings = { silenceDays: 90 };

const customer = (over = {}) => ({
  id: 'DC-1',
  customerId: 'Cust A',
  mohalla: 'Mohalla One',
  paidUp: true,
  contactDate: '2026-06-01',
  visitDate: '',
  feedbackDate: '',
  ...over,
});

test('half-formed record refused: no id or no customer', () => {
  assert.equal(normalizeDormantCustomer({ customerId: 'Cust A' }), null);
  assert.equal(normalizeDormantCustomer({ id: 'DC-1' }), null);
  assert.equal(normalizeDormantCustomer(null), null);
  assert.equal(normalizeDormantCustomer('nope'), null);
});

test('strict dates: impossible dates refused, never guessed', () => {
  const record = normalizeDormantCustomer(customer({ contactDate: '2026-02-30', visitDate: '2026-04-31' }));
  assert.equal(record.contactDate, '');
  assert.equal(record.visitDate, '');
  const leap = normalizeDormantCustomer(customer({ contactDate: '2024-02-29' }));
  assert.equal(leap.contactDate, '2024-02-29');
  const nonLeap = normalizeDormantCustomer(customer({ contactDate: '2026-02-29' }));
  assert.equal(nonLeap.contactDate, '');
  const thirtyFirst = normalizeDormantCustomer(customer({ contactDate: '2026-08-31' }));
  assert.equal(thirtyFirst.contactDate, '2026-08-31');
});

test('unknown fields dropped, so no bill, payment, package, status, or sending field can creep in', () => {
  const record = normalizeDormantCustomer(customer({ billId: 'B-1', amount: 500, status: 'active', sendNow: true }));
  assert.deepEqual(Object.keys(record).sort(), ['contactDate', 'customerId', 'feedbackDate', 'id', 'mohalla', 'paidUp', 'visitDate']);
});

test('duplicate id never rewritten, identical or different', () => {
  const list = [customer()];
  assert.equal(recordDormantCustomer(list, customer()).length, 1);
  assert.equal(recordDormantCustomer(list, customer({ mohalla: 'Other' }))[0].mohalla, 'Mohalla One');
});

test('one record per customer, case-insensitive', () => {
  const list = [customer()];
  assert.equal(recordDormantCustomer(list, customer({ id: 'DC-2', customerId: 'cust a' })).length, 1);
});

test('last-contact date is the latest of contact, visit, and feedback dates', () => {
  assert.equal(dormantLastContactDate(customer({ contactDate: '2026-06-01', visitDate: '2026-07-15', feedbackDate: '2026-07-01' })), '2026-07-15');
  assert.equal(dormantLastContactDate(customer({ contactDate: '2026-06-01', visitDate: '', feedbackDate: '2026-08-01' })), '2026-08-01');
  assert.equal(dormantLastContactDate(customer({ contactDate: '', visitDate: '', feedbackDate: '' })), '');
});

test('dormant only when paid up and past the silence period', () => {
  assert.equal(dormantIsDormant(customer({ contactDate: '2026-06-01' }), settings, today), true);
  assert.equal(dormantIsDormant(customer({ contactDate: '2026-10-01' }), settings, today), false);
  assert.equal(dormantIsDormant(customer({ contactDate: '2026-06-01', paidUp: false }), settings, today), false);
  assert.equal(dormantIsDormant(customer({ contactDate: '', visitDate: '', feedbackDate: '' }), settings, today), true);
});

test('silence boundary is strict: exactly the period is not dormant, one day past is', () => {
  assert.equal(dormantIsDormant(customer({ contactDate: '2026-08-06' }), settings, today), false);
  assert.equal(dormantIsDormant(customer({ contactDate: '2026-08-05' }), settings, today), true);
});

test('future last-contact date is never dormant', () => {
  assert.equal(dormantIsDormant(customer({ contactDate: '2026-12-01' }), settings, today), false);
});

test('owner-set silence period is honoured, invalid values fall back to 90 days', () => {
  assert.equal(dormantIsDormant(customer({ contactDate: '2026-09-15' }), { silenceDays: 30 }, today), true);
  assert.equal(dormantIsDormant(customer({ contactDate: '2026-09-15' }), { silenceDays: 60 }, today), false);
  assert.equal(normalizeDormantSettings({ silenceDays: 0 }).silenceDays, 90);
  assert.equal(normalizeDormantSettings({ silenceDays: 'abc' }).silenceDays, 90);
  assert.equal(normalizeDormantSettings(null).silenceDays, 90);
});

test('list is oldest-silent first, never-contacted first, then customer A-Z', () => {
  const list = [
    customer({ id: 'DC-1', customerId: 'Cust B', contactDate: '2026-08-01' }),
    customer({ id: 'DC-2', customerId: 'Cust A', contactDate: '' }),
    customer({ id: 'DC-3', customerId: 'Cust C', contactDate: '2026-05-01' }),
    customer({ id: 'DC-4', customerId: 'Cust D', contactDate: '2026-10-20' }),
  ];
  const ids = dormantCheckinList(list, settings, today).map((item) => item.id);
  assert.deepEqual(ids, ['DC-2', 'DC-3', 'DC-1']);
});

test('list shows last-contact date and mohalla, and excludes the not-paid-up', () => {
  const list = [customer(), customer({ id: 'DC-2', customerId: 'Cust B', paidUp: false, contactDate: '2025-01-01' })];
  const html = dormantCheckinAllHtml(list, settings, today);
  assert.match(html, /Cust A/);
  assert.match(html, /Mohalla One/);
  assert.match(html, /2026-06-01/);
  assert.doesNotMatch(html, /Cust B/);
});

test('a newer visit or feedback refreshes the list without extra bookkeeping', () => {
  const list = [customer({ contactDate: '2026-06-01' })];
  assert.equal(dormantCheckinList(list, settings, today).length, 1);
  const refreshed = [{ ...list[0], visitDate: '2026-10-20' }];
  assert.equal(dormantCheckinList(refreshed, settings, today).length, 0);
});

test('contacting a customer updates only the last-contact date', () => {
  const list = [customer()];
  const next = markDormantContacted(list, 'DC-1', '2026-11-04');
  assert.equal(next[0].contactDate, '2026-11-04');
  assert.equal(next[0].mohalla, 'Mohalla One');
  assert.equal(next[0].paidUp, true);
  assert.equal(dormantCheckinList(next, settings, today).length, 0);
  assert.deepEqual(markDormantContacted(list, 'DC-1', '2026-02-30'), list);
  assert.deepEqual(markDormantContacted(list, 'DC-9', '2026-11-04'), list);
});

test('check-in draft promises nothing and is sent by hand only', () => {
  const draft = dormantCheckinDraftText(customer());
  assert.match(draft, /Cust A/);
  assert.doesNotMatch(draft, /discount|offer|free|credit/i);
});

test('find, remove, and customers list', () => {
  const list = [customer(), customer({ id: 'DC-2', customerId: 'Cust B' })];
  assert.equal(findDormantCustomer(list, 'DC-2').customerId, 'Cust B');
  assert.equal(findDormantCustomer(list, 'DC-9'), null);
  assert.equal(removeDormantCustomer(list, 'DC-1').length, 1);
  assert.deepEqual(dormantCustomers([customer(), customer({ id: 'DC-2', customerId: 'cust a' })]), ['Cust A']);
});

test('summary text counts dormant of paid-up', () => {
  const list = [customer(), customer({ id: 'DC-2', customerId: 'Cust B', contactDate: '2026-10-20' })];
  assert.equal(dormantCheckinSummaryText(list, settings, today), '1 dormant-but-paid of 2 paid-up customers, silence period 90 days');
});

test('CSV rows carry id, customer, mohalla, last contact, silent days, dormant flag', () => {
  const list = [customer()];
  const csv = dormantCheckinCsv(list, settings, today);
  assert.match(csv, /^id,customer,mohalla,last contact,silent days,dormant/);
  assert.match(csv, /DC-1,Cust A,Mohalla One,2026-06-01,156,yes/);
  assert.equal(dormantCheckinFilename(), 'shahdara_dormant_checkin.csv');
});

test('inputs never mutated and lists normalize', () => {
  const input = customer({ extra: 'x' });
  const frozen = JSON.stringify(input);
  recordDormantCustomer([], input);
  markDormantContacted([input], 'DC-1', '2026-11-04');
  assert.equal(JSON.stringify(input), frozen);
  assert.equal(normalizeDormantCustomerList('nope').length, 0);
  assert.equal(normalizeDormantCustomerList([customer(), null, 'x']).length, 1);
});

test('panel wiring: all panel element ids exist in index.html, no standalone OLT in app.js', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['dcHeading', 'dcSummary', 'dcExportBtn', 'dcCustomer', 'dcMohalla', 'dcPaidUp', 'dcContactDate', 'dcVisitDate', 'dcFeedbackDate', 'dcSaveBtn', 'dcRemoveId', 'dcRemoveBtn', 'dcFilter', 'dcBody', 'dcContactId', 'dcContactedDate', 'dcContactBtn', 'dcSilenceDays', 'dcSettingsBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
