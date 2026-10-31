// SISP-108: Customer Disconnect Reason Analytics & Win-Back Campaign
// Queue. Pure-function + core-integration tests on synthetic data only.
// Spec test criterion (verbatim): "Archiving a customer with
// disconnectReason: 'Temporary Travel' and winBackEligible: true
// includes them in the Win-Back Queue."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DISCONNECT_REASONS,
  DISCONNECT_REASON_LABEL_KEYS,
  buildDisconnectAnalytics,
  buildWinBackOfferText,
  buildWinBackQueue,
  defaultWinBackEligible,
  disconnectDetailsOf,
  disconnectReasonLabel,
  sanitizeDisconnectDetails,
  sanitizeDisconnectHistory
} from '../churn-winback.js';
import {
  addCustomer,
  archiveCustomer,
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge,
  readState,
  recordWinBackOfferSent,
  unarchiveCustomer,
  STORAGE_KEY
} from '../core.js';
import { disconnectProfileHtml } from '../profile-ui.js';
import { TRANSLATIONS } from '../nav-language.js';

const OCT_15 = new Date('2026-10-15T10:00:00');
const SEP_15 = new Date('2026-09-15T10:00:00');
const OCT_29 = new Date('2026-10-29T10:00:00');

function stateWithCustomer(name = 'Winback Test Customer', options = {}) {
  const state = addCustomer(createInitialState([]), name, OCT_15, options);
  return { state, customer: state.customers[state.customers.length - 1] };
}

function storageHolding(state) {
  const text = JSON.stringify(state);
  return { getItem: (key) => (key === STORAGE_KEY ? text : null), setItem: () => {} };
}

test('SPEC PIN: archiving with Temporary Travel + winBackEligible includes the customer in the Win-Back Queue', () => {
  const { state, customer } = stateWithCustomer('Travel Test Customer', { phone: '03001234567' });
  const archived = archiveCustomer(state, customer.id, OCT_15, { disconnectReason: 'temporary-travel', winBackEligible: true, disconnectNote: 'Gone to Dubai for work' });
  const stored = archived.customers.find(c => c.id === customer.id);
  assert.equal(stored.archived, true);
  assert.equal(stored.disconnectReason, 'temporary-travel');
  assert.equal(stored.winBackEligible, true);
  assert.equal(stored.disconnectNote, 'Gone to Dubai for work');
  assert.equal(stored.disconnectHistory.length, 1);
  assert.equal(stored.disconnectHistory[0].disconnectReason, 'temporary-travel');
  const queue = buildWinBackQueue(archived, 'en');
  assert.equal(queue.length, 1);
  assert.equal(queue[0].customerId, customer.id);
  assert.equal(queue[0].disconnectReason, 'temporary-travel');
  assert.equal(queue[0].reasonLabel, 'Temporary travel');
  assert.equal(queue[0].hasPhone, true);
  assert.match(queue[0].offerText, /Travel Test Customer/);
});

test('archive without capture details keeps the exact pre-SISP-108 behaviour (no stamped fields)', () => {
  const { state, customer } = stateWithCustomer();
  const archived = archiveCustomer(state, customer.id, OCT_15);
  const stored = archived.customers.find(c => c.id === customer.id);
  assert.equal(stored.archived, true);
  assert.ok(stored.archivedAt);
  // No capture was recorded: the fields sit at their empty defaults and
  // no history event was appended — identical outcome to pre-SISP-108.
  assert.equal(stored.disconnectReason, '');
  assert.equal(stored.winBackEligible, false);
  assert.deepEqual(stored.disconnectHistory, []);
  assert.equal(stored.winBackOfferSentAt, null);
  const details = disconnectDetailsOf(stored);
  assert.equal(details.disconnectReason, '');
  assert.equal(details.winBackEligible, false);
  assert.equal(details.hasRecordedReason, false);
  assert.equal(buildWinBackQueue(archived).length, 0);
});

test('non-eligible archivee stays out of the queue; eligible without a recorded reason stays out too', () => {
  const { state, customer } = stateWithCustomer('Competitor Test Customer');
  const notEligible = archiveCustomer(state, customer.id, OCT_15, { disconnectReason: 'competitor', winBackEligible: false });
  assert.equal(buildWinBackQueue(notEligible).length, 0);
  const noReason = archiveCustomer(state, customer.id, OCT_15, { disconnectReason: '', winBackEligible: true });
  assert.equal(buildWinBackQueue(noReason).length, 0);
});

test('restoring removes the customer from the queue and erases no history', () => {
  const { state, customer } = stateWithCustomer();
  let next = archiveCustomer(state, customer.id, OCT_15, { disconnectReason: 'temporary-travel', winBackEligible: true });
  assert.equal(buildWinBackQueue(next).length, 1);
  next = unarchiveCustomer(next, customer.id, OCT_29);
  const stored = next.customers.find(c => c.id === customer.id);
  assert.equal(stored.archived, false);
  assert.equal(buildWinBackQueue(next).length, 0);
  // The disconnect record survives the restore — it is history now.
  const details = disconnectDetailsOf(stored);
  assert.equal(details.disconnectHistory.length, 1);
  assert.equal(details.disconnectHistory[0].disconnectReason, 'temporary-travel');
  assert.equal(buildDisconnectAnalytics(next, OCT_29).totalArchived, 0);
});

test('re-archiving captures a NEW reason; history keeps both events, latest is current', () => {
  const { state, customer } = stateWithCustomer();
  let next = archiveCustomer(state, customer.id, SEP_15, { disconnectReason: 'shifted', winBackEligible: false });
  next = unarchiveCustomer(next, customer.id, OCT_15);
  next = archiveCustomer(next, customer.id, OCT_29, { disconnectReason: 'competitor', winBackEligible: true, disconnectNote: 'Joined rival ISP' });
  const stored = next.customers.find(c => c.id === customer.id);
  assert.equal(stored.disconnectReason, 'competitor');
  assert.equal(stored.disconnectHistory.length, 2);
  assert.equal(stored.disconnectHistory[0].disconnectReason, 'shifted');
  assert.equal(stored.disconnectHistory[1].disconnectReason, 'competitor');
  // A fresh archive resets the offer stamp — this disconnect has not been offered yet.
  assert.equal(stored.winBackOfferSentAt, null);
  const queue = buildWinBackQueue(next, 'en');
  assert.equal(queue.length, 1);
  assert.equal(queue[0].reasonLabel, 'Went to a competitor');
});

test('legacy archives (no reason) are counted as Not recorded — never guessed', () => {
  const { state, customer } = stateWithCustomer('Legacy Archived Customer');
  const archived = archiveCustomer(state, customer.id, OCT_15);
  const analytics = buildDisconnectAnalytics(archived, OCT_29);
  assert.equal(analytics.totalArchived, 1);
  assert.equal(analytics.recordedCount, 0);
  assert.equal(analytics.notRecorded.allTime, 1);
  assert.equal(analytics.notRecorded.thisMonth, 1);
  assert.ok(analytics.byReason.every(row => row.allTime === 0));
});

test('analytics split this-month vs all-time by archivedAt and count every reason', () => {
  let { state } = stateWithCustomer('Analytics One');
  const ids = [];
  for (const name of ['Analytics Two', 'Analytics Three', 'Analytics Four']) {
    state = addCustomer(state, name, OCT_15);
  }
  for (const customer of state.customers) ids.push(customer.id);
  state = archiveCustomer(state, ids[0], SEP_15, { disconnectReason: 'shifted', winBackEligible: false });
  state = archiveCustomer(state, ids[1], OCT_15, { disconnectReason: 'shifted', winBackEligible: false });
  state = archiveCustomer(state, ids[2], OCT_15, { disconnectReason: 'affordability', winBackEligible: true });
  state = archiveCustomer(state, ids[3], OCT_15, { disconnectReason: 'temporary-travel', winBackEligible: true });
  const analytics = buildDisconnectAnalytics(state, OCT_29);
  assert.equal(analytics.totalArchived, 4);
  assert.equal(analytics.recordedCount, 4);
  const shifted = analytics.byReason.find(row => row.reason === 'shifted');
  assert.equal(shifted.allTime, 2);
  assert.equal(shifted.thisMonth, 1);
  assert.equal(analytics.byReason.find(row => row.reason === 'affordability').thisMonth, 1);
  assert.equal(analytics.winBackEligibleCount, 2);
  assert.equal(analytics.winBackOfferedCount, 0);
});

test('capture survives a storage round-trip; corrupt values sanitize honestly', () => {
  const { state, customer } = stateWithCustomer();
  const archived = archiveCustomer(state, customer.id, OCT_15, { disconnectReason: 'affordability', winBackEligible: true, disconnectNote: 'Fee too high' });
  const restored = readState(storageHolding(archived));
  const stored = restored.customers.find(c => c.id === customer.id);
  assert.equal(stored.disconnectReason, 'affordability');
  assert.equal(stored.winBackEligible, true);
  assert.equal(stored.disconnectNote, 'Fee too high');
  assert.equal(stored.disconnectHistory.length, 1);

  const corrupt = JSON.parse(JSON.stringify(archived));
  const target = corrupt.customers.find(c => c.id === customer.id);
  target.disconnectReason = 'bogus-reason';
  target.winBackEligible = 'yes';
  target.disconnectHistory = [{ archivedAt: 'not-a-date', disconnectReason: 'shifted' }, null, { archivedAt: '2026-10-15T10:00', disconnectReason: 'also-bogus', winBackEligible: 1 }];
  const cleaned = readState(storageHolding(corrupt)).customers.find(c => c.id === customer.id);
  assert.equal(cleaned.disconnectReason, '');
  assert.equal(cleaned.winBackEligible, false);
  assert.deepEqual(cleaned.disconnectHistory, [{ archivedAt: '2026-10-15T10:00', disconnectReason: '', winBackEligible: false, disconnectNote: '' }]);
});

test('capture travels in JSON backups and history merges by union', () => {
  const { state, customer } = stateWithCustomer();
  const archived = archiveCustomer(state, customer.id, OCT_15, { disconnectReason: 'temporary-travel', winBackEligible: true });
  const backup = createJsonBackup(archived, OCT_29);
  const fresh = createInitialState([]);
  const preview = previewJsonBackupMerge(fresh, backup.text ?? backup, {});
  const merged = (preview.state ?? preview).customers.find(c => c.id === customer.id);
  assert.ok(merged, 'customer present after backup merge');
  assert.equal(merged.disconnectReason, 'temporary-travel');
  assert.equal(merged.winBackEligible, true);
  assert.equal(merged.disconnectHistory.length, 1);

  // Union: a second device archived the same customer again later —
  // both events survive the merge, neither is duplicated.
  let otherDevice = unarchiveCustomer(archived, customer.id, OCT_15);
  otherDevice = archiveCustomer(otherDevice, customer.id, OCT_29, { disconnectReason: 'shifted', winBackEligible: false });
  const backup2 = createJsonBackup(otherDevice, OCT_29);
  const preview2 = previewJsonBackupMerge(archived, backup2.text ?? backup2, {});
  const merged2 = (preview2.state ?? preview2).customers.find(c => c.id === customer.id);
  assert.equal(merged2.disconnectHistory.length, 2);
  const preview3 = previewJsonBackupMerge(preview2.state ?? preview2, backup2.text ?? backup2, {});
  const merged3 = (preview3.state ?? preview3).customers.find(c => c.id === customer.id);
  assert.equal(merged3.disconnectHistory.length, 2);
});

test('offer stamp: recordWinBackOfferSent marks the row but the customer STAYS in the queue', () => {
  const { state, customer } = stateWithCustomer();
  let next = archiveCustomer(state, customer.id, OCT_15, { disconnectReason: 'temporary-travel', winBackEligible: true });
  next = recordWinBackOfferSent(next, customer.id, OCT_29);
  const queue = buildWinBackQueue(next);
  assert.equal(queue.length, 1);
  assert.ok(queue[0].winBackOfferSentAt);
  assert.equal(buildDisconnectAnalytics(next, OCT_29).winBackOfferedCount, 1);
  // The stamp survives storage too.
  const restored = readState(storageHolding(next));
  assert.ok(restored.customers.find(c => c.id === customer.id).winBackOfferSentAt);
});

test('queue rows carry the offer text and an honest no-phone state', () => {
  const { state, customer } = stateWithCustomer('No Phone Customer');
  const archived = archiveCustomer(state, customer.id, OCT_15, { disconnectReason: 'shifted', winBackEligible: true });
  const [row] = buildWinBackQueue(archived, 'en');
  assert.equal(row.hasPhone, false);
  assert.match(buildWinBackOfferText({ name: 'No Phone Customer' }, 'en'), /No Phone Customer/);
  assert.match(buildWinBackOfferText({ name: 'No Phone Customer' }, 'en'), /FREE/);
});

test('defaultWinBackEligible pre-checks only Temporary Travel', () => {
  assert.equal(defaultWinBackEligible('temporary-travel'), true);
  for (const reason of ['shifted', 'competitor', 'affordability', '']) assert.equal(defaultWinBackEligible(reason), false);
});

test('sanitizers keep only the four spec reasons and cap the note', () => {
  assert.deepEqual(DISCONNECT_REASONS, ['shifted', 'competitor', 'affordability', 'temporary-travel']);
  assert.equal(sanitizeDisconnectDetails({ disconnectReason: 'competitor', winBackEligible: true, disconnectNote: '  x  ' }).disconnectNote, 'x');
  assert.equal(sanitizeDisconnectDetails({ disconnectReason: 'Competitor' }).disconnectReason, '');
  assert.equal(sanitizeDisconnectDetails({ disconnectNote: 'a'.repeat(600) }).disconnectNote.length, 500);
  assert.deepEqual(sanitizeDisconnectHistory('nope'), []);
  assert.equal(disconnectReasonLabel('', 'en'), 'Not recorded');
  assert.equal(disconnectReasonLabel('temporary-travel', 'en'), 'Temporary travel');
});

test('profile disconnect section renders for archived customers and stays empty for active ones', () => {
  const { state, customer } = stateWithCustomer('Profile Test Customer');
  assert.equal(disconnectProfileHtml(state.customers[0]), '');
  const archived = archiveCustomer(state, customer.id, OCT_15, { disconnectReason: 'temporary-travel', winBackEligible: true, disconnectNote: 'Back in March' });
  const html = disconnectProfileHtml(archived.customers.find(c => c.id === customer.id));
  assert.match(html, /Temporary travel/);
  assert.match(html, /Back in March/);
  assert.match(html, /Win-back eligible: Yes/);
});

test('i18n audit: every winback_* key used in code exists in BOTH dictionaries', () => {
  const used = new Set();
  for (const file of ['churn-winback.js', 'profile-ui.js', 'app.js', 'index.html']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/winback_[a-z_]+/g)) used.add(match[0]);
  }
  assert.ok(used.size >= 20, `expected a real key set, found ${used.size}`);
  for (const key of used) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `missing en key: ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `missing ur key: ${key}`);
  }
  for (const labelKey of Object.values(DISCONNECT_REASON_LABEL_KEYS)) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, labelKey) && Object.hasOwn(TRANSLATIONS.ur, labelKey), `reason label missing: ${labelKey}`);
  }
});

test('dashboard + dialog markup render from theme-token CSS classes only (no hardcoded colours in new styles)', () => {
  const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('/* SISP-108:'), css.indexOf('/* Owner feature 2026-10-29: Dashboard Advance Held'));
  assert.ok(block.length > 200);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="archiveCustomerModal"/);
  assert.match(html, /id="winbackList"/);
  assert.match(html, /id="winbackAnalytics"/);
});
