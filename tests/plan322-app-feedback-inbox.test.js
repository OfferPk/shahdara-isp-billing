import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_FEEDBACK_STATUSES,
  validAppFeedbackDay,
  appFeedbackStatusLabel,
  normalizeAppFeedback,
  normalizeAppFeedbackList,
  findAppFeedback,
  recordAppFeedback,
  removeAppFeedback,
  closeAppFeedback,
  appFeedbackOpen,
  appFeedbackOpenByScreen,
  appFeedbackForScreen,
  appFeedbackOpenScreens,
  appFeedbackSummaryText,
  appFeedbackEntryText,
  appFeedbackEntryHtml,
  appFeedbackOpenHtml,
  appFeedbackAllHtml,
  appFeedbackCsv,
  appFeedbackFilename,
} from '../app-feedback-inbox.js';

const first = {
  id: 'AF-1',
  screen: 'Customers',
  problem: 'Customer list loads slowly on the field phone',
  date: '2026-11-04',
  reporter: 'Saad',
  status: 'noted',
  resolutionNote: '',
  resolutionDate: '',
};
const second = {
  id: 'AF-2',
  screen: 'Billing',
  problem: 'Bill month is hard to find on the receipt',
  date: '2026-11-02',
  reporter: 'Owner',
  status: 'noted',
  resolutionNote: '',
  resolutionDate: '',
};
const third = {
  id: 'AF-3',
  screen: 'Customers',
  problem: 'Search box clears itself after each search',
  date: '2026-11-05',
  reporter: 'Saad',
  status: 'noted',
  resolutionNote: '',
  resolutionDate: '',
};
const fixed = {
  id: 'AF-4',
  screen: 'Billing',
  problem: 'Amount field jumps while typing',
  date: '2026-10-28',
  reporter: 'Saad',
  status: 'fixed',
  resolutionNote: 'Field keeps its place while typing now',
  resolutionDate: '2026-11-01',
};
const declined = {
  id: 'AF-5',
  screen: 'Dashboard',
  problem: 'Dashboard should show a weather widget',
  date: '2026-10-20',
  reporter: 'Owner',
  status: 'declined',
  resolutionNote: 'Out of scope for the billing screen',
  resolutionDate: '2026-10-22',
};

test('strict dates: real calendar days pass, impossible days and wrong shapes fail', () => {
  assert.equal(validAppFeedbackDay('2026-11-05'), true);
  assert.equal(validAppFeedbackDay('2024-02-29'), true);
  assert.equal(validAppFeedbackDay('2026-02-29'), false);
  assert.equal(validAppFeedbackDay('2026-04-31'), false);
  assert.equal(validAppFeedbackDay('2026-13-01'), false);
  assert.equal(validAppFeedbackDay('2026-11-5'), false);
  assert.equal(validAppFeedbackDay('05-11-2026'), false);
  assert.equal(validAppFeedbackDay(''), false);
  assert.equal(validAppFeedbackDay(null), false);
});

test('statuses are noted, fixed, and declined; labels fold plain spellings', () => {
  assert.deepEqual([...APP_FEEDBACK_STATUSES], ['noted', 'fixed', 'declined']);
  assert.equal(appFeedbackStatusLabel('FIXED'), 'fixed');
  assert.equal(appFeedbackStatusLabel('Declined'), 'declined');
  assert.equal(appFeedbackStatusLabel('unknown'), 'noted');
  assert.equal(appFeedbackStatusLabel(''), 'noted');
});

test('normalize keeps a full noted entry and drops unknown fields without mutating the input', () => {
  const raw = { ...first, customerId: 'CUST-1', billAmount: 3000 };
  const frozen = Object.freeze({ ...raw });
  const clean = normalizeAppFeedback(frozen);
  assert.equal(clean.screen, 'Customers');
  assert.equal(clean.status, 'noted');
  assert.equal(clean.resolutionNote, '');
  assert.equal(clean.resolutionDate, '');
  assert.equal('customerId' in clean, false);
  assert.equal('billAmount' in clean, false);
});

test('normalize refuses an entry missing screen, problem, date, reporter, or id', () => {
  assert.equal(normalizeAppFeedback({ ...first, screen: '' }), null);
  assert.equal(normalizeAppFeedback({ ...first, screen: '   ' }), null);
  assert.equal(normalizeAppFeedback({ ...first, problem: '' }), null);
  assert.equal(normalizeAppFeedback({ ...first, date: '2026-02-29' }), null);
  assert.equal(normalizeAppFeedback({ ...first, date: '2026-11-04', reporter: '' }), null);
  assert.equal(normalizeAppFeedback({ ...first, id: '' }), null);
  assert.equal(normalizeAppFeedback(null), null);
  assert.equal(normalizeAppFeedback([first]), null);
});

test('normalize folds a plain status spelling and drops resolution fields from a noted entry', () => {
  const clean = normalizeAppFeedback({ ...first, status: 'Noted', resolutionNote: 'later', resolutionDate: '2026-11-06' });
  assert.equal(clean.status, 'noted');
  assert.equal(clean.resolutionNote, '');
  assert.equal(clean.resolutionDate, '');
  assert.equal(normalizeAppFeedback({ ...first, status: 'bogus' }).status, 'noted');
});

test('normalize refuses a fixed or declined entry without a dated note', () => {
  assert.equal(normalizeAppFeedback({ ...fixed, resolutionNote: '' }), null);
  assert.equal(normalizeAppFeedback({ ...fixed, resolutionDate: '' }), null);
  assert.equal(normalizeAppFeedback({ ...fixed, resolutionDate: '2026-02-29' }), null);
  assert.equal(normalizeAppFeedback({ ...fixed, resolutionDate: '2026-10-20' }), null);
  assert.equal(normalizeAppFeedback({ ...declined, resolutionNote: '  ' }), null);
  assert.equal(normalizeAppFeedback({ ...fixed }).status, 'fixed');
  assert.equal(normalizeAppFeedback({ ...declined }).status, 'declined');
});

test('normalize keeps a resolution date on the reported date itself', () => {
  const clean = normalizeAppFeedback({ ...fixed, resolutionDate: '2026-10-28' });
  assert.equal(clean.resolutionDate, '2026-10-28');
});

test('list normalize drops half-formed entries and keeps the first entry per id', () => {
  const clean = normalizeAppFeedbackList([second, { ...first, problem: '' }, first, { ...first, screen: 'Billing' }, 'nope']);
  assert.deepEqual(clean.map((entry) => entry.id), ['AF-2', 'AF-1']);
  assert.deepEqual(normalizeAppFeedbackList(null), []);
  assert.deepEqual(normalizeAppFeedbackList('nope'), []);
});

test('find returns the entry by id and null for a missing or blank id', () => {
  assert.equal(findAppFeedback([first, second], 'AF-2').screen, 'Billing');
  assert.equal(findAppFeedback([first, second], 'AF-9'), null);
  assert.equal(findAppFeedback([first], ''), null);
});

test('record adds a new entry, refuses a half-formed entry, and never rewrites a duplicate id', () => {
  const added = recordAppFeedback([first], second);
  assert.equal(added.length, 2);
  assert.equal(recordAppFeedback([first], { ...second, problem: '' }).length, 1);
  assert.equal(recordAppFeedback([first], { ...first, screen: 'Billing' }).length, 1);
  assert.equal(recordAppFeedback([first], { ...first, screen: 'Billing' })[0].screen, 'Customers');
});

test('remove drops only the named entry and leaves the rest alone', () => {
  assert.deepEqual(removeAppFeedback([first, second, third], 'AF-2').map((entry) => entry.id), ['AF-1', 'AF-3']);
  assert.equal(removeAppFeedback([first], 'AF-9').length, 1);
  assert.equal(removeAppFeedback([first], '').length, 1);
});

test('close marks a noted entry fixed with a dated note and changes nothing else', () => {
  const next = closeAppFeedback([first, second], 'AF-1', 'fixed', { note: 'List loads in under a second now', date: '2026-11-06' });
  assert.equal(next[0].status, 'fixed');
  assert.equal(next[0].resolutionNote, 'List loads in under a second now');
  assert.equal(next[0].resolutionDate, '2026-11-06');
  assert.equal(next[1].status, 'noted');
  assert.equal(next[0].screen, 'Customers');
});

test('close marks an entry declined and folds a plain status spelling', () => {
  const next = closeAppFeedback([second], 'AF-2', 'Declined', { note: 'Kept as it is for now', date: '2026-11-03' });
  assert.equal(next[0].status, 'declined');
  assert.equal(next[0].resolutionDate, '2026-11-03');
});

test('close refuses a missing note, a missing or bad date, a date before the report, and any other status', () => {
  assert.deepEqual(closeAppFeedback([first], 'AF-1', 'fixed', { note: '', date: '2026-11-06' }), [first]);
  assert.deepEqual(closeAppFeedback([first], 'AF-1', 'fixed', { note: 'done', date: '' }), [first]);
  assert.deepEqual(closeAppFeedback([first], 'AF-1', 'fixed', { note: 'done', date: '2026-02-29' }), [first]);
  assert.deepEqual(closeAppFeedback([first], 'AF-1', 'fixed', { note: 'done', date: '2026-11-03' }), [first]);
  assert.deepEqual(closeAppFeedback([first], 'AF-1', 'noted', { note: 'done', date: '2026-11-06' }), [first]);
  assert.deepEqual(closeAppFeedback([first], 'AF-1', 'done', { note: 'done', date: '2026-11-06' }), [first]);
  assert.deepEqual(closeAppFeedback([first], 'AF-9', 'fixed', { note: 'done', date: '2026-11-06' }), [first]);
});

test('close never closes an already closed entry a second time', () => {
  const once = closeAppFeedback([first], 'AF-1', 'fixed', { note: 'Fixed now', date: '2026-11-06' });
  const twice = closeAppFeedback(once, 'AF-1', 'declined', { note: 'Changed mind', date: '2026-11-07' });
  assert.deepEqual(twice, once);
  assert.equal(twice[0].status, 'fixed');
});

test('open list shows noted entries only, by screen then by date', () => {
  const open = appFeedbackOpen([third, fixed, first, declined, second]);
  assert.deepEqual(open.map((entry) => entry.id), ['AF-2', 'AF-1', 'AF-3']);
  assert.deepEqual(appFeedbackOpen([fixed, declined]), []);
});

test('open by screen groups open entries under A-Z screens in date order', () => {
  const groups = appFeedbackOpenByScreen([third, fixed, first, declined, second]);
  assert.deepEqual(groups.map((group) => group.screen), ['Billing', 'Customers']);
  assert.deepEqual(groups[1].items.map((entry) => entry.id), ['AF-1', 'AF-3']);
  assert.deepEqual(appFeedbackOpenByScreen([fixed]), []);
  assert.deepEqual(appFeedbackOpenScreens([third, first, second]), ['Billing', 'Customers']);
});

test('entries for one screen match case-insensitively and list in date order, any status', () => {
  const entries = appFeedbackForScreen([third, fixed, first, declined, second], 'customers');
  assert.deepEqual(entries.map((entry) => entry.id), ['AF-1', 'AF-3']);
  assert.deepEqual(appFeedbackForScreen([first], 'Billing'), []);
  assert.deepEqual(appFeedbackForScreen([first], ''), []);
});

test('summary counts recorded, open, fixed, and declined in plain words', () => {
  assert.equal(appFeedbackSummaryText([]), 'No app feedback recorded.');
  assert.equal(
    appFeedbackSummaryText([first, second, third, fixed, declined]),
    '5 app feedback notes recorded: 3 still open, 1 fixed, 1 declined.',
  );
  assert.equal(
    appFeedbackSummaryText([first]),
    '1 app feedback note recorded: 1 still open, 0 fixed, 0 declined.',
  );
});

test('entry text names the screen, the problem, the reporter, and the status with its dated note', () => {
  assert.equal(
    appFeedbackEntryText(first),
    '2026-11-04 — Customers: Customer list loads slowly on the field phone (reported by Saad), noted.',
  );
  assert.equal(
    appFeedbackEntryText(fixed),
    '2026-10-28 — Billing: Amount field jumps while typing (reported by Saad), fixed 2026-11-01 — Field keeps its place while typing now.',
  );
  assert.equal(
    appFeedbackEntryText(declined),
    '2026-10-20 — Dashboard: Dashboard should show a weather widget (reported by Owner), declined 2026-10-22 — Out of scope for the billing screen.',
  );
  assert.equal(appFeedbackEntryText({ ...first, problem: '' }), '');
});

test('entry html escapes user text and the open html groups by screen with empty states', () => {
  const html = appFeedbackEntryHtml({ ...first, problem: '<script>alert(1)</script>' });
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(appFeedbackEntryHtml({ ...first, problem: '' }), '');
  const open = appFeedbackOpenHtml([third, fixed, first, second]);
  assert.equal(open.includes('<h4>Billing</h4>'), true);
  assert.equal(open.includes('<h4>Customers</h4>'), true);
  assert.equal(open.includes('Amount field jumps'), false);
  assert.equal(appFeedbackOpenHtml([fixed]), '<p>No open app feedback.</p>');
  assert.equal(appFeedbackAllHtml([]), '<p>No app feedback recorded.</p>');
  assert.equal(appFeedbackAllHtml([fixed]).includes('fixed 2026-11-01'), true);
});

test('csv has one row per entry in screen then date order with the filename', () => {
  const csv = appFeedbackCsv([third, fixed, declined, first, second]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,screen,problem,date,reporter,status,resolution_note,resolution_date');
  assert.equal(lines.length, 6);
  assert.equal(lines[1].startsWith('AF-4,Billing,Amount field jumps'), true);
  assert.equal(lines[2].startsWith('AF-2,Billing,Bill month is hard to find'), true);
  assert.equal(lines[3].startsWith('AF-1,Customers,Customer list loads slowly'), true);
  assert.equal(lines[5].startsWith('AF-5,Dashboard,Dashboard should show a weather widget'), true);
  assert.equal(appFeedbackFilename(), 'app-feedback-inbox.csv');
});
