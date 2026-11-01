/**
 * SISP-138 — Defaulter "Reminded Today" Cooldown Badge & Filter.
 *
 * Pins:
 *  - the stamp pair (lastContactedAt + lastContactChannel) is written
 *    only together, only by the stamp helpers, and sanitizes to absent
 *    as a pair when either half is junk;
 *  - cooldown is a PKT calendar-day rule (today 09:15 and today 00:05
 *    count; yesterday 23:59 does not);
 *  - the Reminder Queue's hideContactedToday option filters the
 *    working queue without touching the balance statistic;
 *  - the stamp survives readState (storage load) and a JSON backup
 *    merge round-trip, merging by recency with no conflicts;
 *  - every cct_* string exists in both dictionaries with matching
 *    placeholders, and every cct_* key referenced in code/HTML exists.
 *
 * All fixtures are synthetic; fixed clocks are injected everywhere so
 * the PKT day boundaries are exact (PKT = UTC+5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CONTACT_CHANNELS,
  contactBadgeHtml,
  contactBadgeText,
  contactChannelLabel,
  contactMarkedMessage,
  contactStampOf,
  contactTimeLabel,
  contactedToday,
  filterCustomersNotContactedToday,
  filterQueueItemsNotContactedToday,
  formatContactTimestamp,
  pktDateString,
  sanitizeContactChannel,
  sanitizeContactPair,
  sanitizeContactTimestamp,
  stampContact,
  stampContactInState
} from '../contact-cooldown-tracker.js';
import {
  addCustomer,
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge,
  readState
} from '../core.js';
import { getRemindersTodayQueue } from '../reminder-queue.js';
import { TRANSLATIONS, t } from '../nav-language.js';
import { ENTRY_FILES } from '../build.mjs';

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

// Fixed clocks (UTC instants; PKT is UTC+5):
const OCT29_0915_PKT = new Date(Date.UTC(2026, 9, 29, 4, 15));  // 09:15 PKT, 29 Oct
const OCT29_1800_PKT = new Date(Date.UTC(2026, 9, 29, 13, 0));  // 18:00 PKT, 29 Oct
const OCT29_0005_PKT = new Date(Date.UTC(2026, 9, 28, 19, 5));  // 00:05 PKT, 29 Oct
const OCT28_2359_PKT = new Date(Date.UTC(2026, 9, 28, 18, 59)); // 23:59 PKT, 28 Oct

const stamped = (at, channel = 'whatsapp') => ({ id: 'cx', name: 'Test Customer', lastContactedAt: at, lastContactChannel: channel });

test('SISP-138: PKT timestamp formatting uses the house datetime style', () => {
  assert.equal(formatContactTimestamp(OCT29_0915_PKT), '2026-10-29T09:15');
  assert.equal(formatContactTimestamp(OCT29_0005_PKT), '2026-10-29T00:05');
  assert.equal(formatContactTimestamp(OCT28_2359_PKT), '2026-10-28T23:59');
  assert.equal(pktDateString(OCT29_0005_PKT), '2026-10-29');
  assert.equal(formatContactTimestamp(new Date('not a date')), null);
  assert.equal(pktDateString(new Date('not a date')), null);
});

test('SISP-138: timestamp sanitizer is strict about format and real calendar days', () => {
  assert.equal(sanitizeContactTimestamp('2026-10-29T09:15'), '2026-10-29T09:15');
  assert.equal(sanitizeContactTimestamp(' 2026-10-29T09:15 '), '2026-10-29T09:15');
  assert.equal(sanitizeContactTimestamp('2026-02-30T10:00'), null, 'impossible day rejected');
  assert.equal(sanitizeContactTimestamp('2026-10-29T24:00'), null, 'hour 24 rejected');
  assert.equal(sanitizeContactTimestamp('2026-13-01T10:00'), null, 'month 13 rejected');
  assert.equal(sanitizeContactTimestamp('2026-10-29 09:15'), null, 'space separator rejected');
  assert.equal(sanitizeContactTimestamp('2026-10-29'), null, 'date alone rejected');
  assert.equal(sanitizeContactTimestamp('yesterday'), null);
  assert.equal(sanitizeContactTimestamp(20261029), null);
  assert.equal(sanitizeContactTimestamp(null), null);
  assert.equal(sanitizeContactTimestamp(undefined), null);
});

test('SISP-138: channel sanitizer accepts only the four real channels', () => {
  for (const ch of CONTACT_CHANNELS) assert.equal(sanitizeContactChannel(ch), ch);
  assert.equal(sanitizeContactChannel(' WhatsApp '), 'whatsapp');
  assert.equal(sanitizeContactChannel('CALL'), 'call');
  assert.equal(sanitizeContactChannel('pigeon'), null);
  assert.equal(sanitizeContactChannel(''), null);
  assert.equal(sanitizeContactChannel(null), null);
  assert.equal(sanitizeContactChannel(7), null);
});

test('SISP-138: the pair sanitizes together — one junk half voids the whole stamp', () => {
  assert.deepEqual(
    sanitizeContactPair({ lastContactedAt: '2026-10-29T09:15', lastContactChannel: 'visit' }),
    { lastContactedAt: '2026-10-29T09:15', lastContactChannel: 'visit' }
  );
  assert.deepEqual(
    sanitizeContactPair({ lastContactedAt: '2026-10-29T09:15', lastContactChannel: 'pigeon' }),
    { lastContactedAt: null, lastContactChannel: null }
  );
  assert.deepEqual(
    sanitizeContactPair({ lastContactedAt: 'not-a-date', lastContactChannel: 'call' }),
    { lastContactedAt: null, lastContactChannel: null }
  );
  assert.deepEqual(sanitizeContactPair({}), { lastContactedAt: null, lastContactChannel: null });
  assert.deepEqual(sanitizeContactPair(null), { lastContactedAt: null, lastContactChannel: null });
  assert.equal(contactStampOf({ name: 'Legacy' }), null);
  assert.deepEqual(contactStampOf(stamped('2026-10-29T09:15', 'sms')), { at: '2026-10-29T09:15', channel: 'sms' });
});

test('SISP-138: stampContact writes the pair together and never mutates its input', () => {
  const original = { id: 'c1', name: 'Test One' };
  const out = stampContact(original, 'visit', OCT29_0915_PKT);
  assert.notEqual(out, original);
  assert.equal(out.lastContactedAt, '2026-10-29T09:15');
  assert.equal(out.lastContactChannel, 'visit');
  assert.equal('lastContactedAt' in original, false, 'input untouched');
  assert.equal(stampContact(original, 'Call', OCT29_0915_PKT).lastContactChannel, 'call');
  assert.throws(() => stampContact(original, 'pigeon', OCT29_0915_PKT), /Unknown contact channel/);
});

test('SISP-138: stampContactInState stamps one customer; unknown id returns the same state', () => {
  const state = { customers: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
  const next = stampContactInState(state, 'b', 'sms', OCT29_0915_PKT);
  assert.notEqual(next, state);
  assert.equal(next.customers[0], state.customers[0], 'other customers reused untouched');
  assert.equal(next.customers[1].lastContactedAt, '2026-10-29T09:15');
  assert.equal(next.customers[1].lastContactChannel, 'sms');
  assert.equal('lastContactedAt' in state.customers[1], false, 'input state untouched');
  assert.equal(stampContactInState(state, 'missing', 'sms', OCT29_0915_PKT), state);
});

test('SISP-138: cooldown pins — today 09:15 and today 00:05 count, yesterday 23:59 does not', () => {
  assert.equal(contactedToday(stamped('2026-10-29T09:15'), OCT29_1800_PKT), true);
  assert.equal(contactedToday(stamped('2026-10-29T00:05'), OCT29_0005_PKT), true);
  assert.equal(contactedToday(stamped('2026-10-28T23:59'), OCT29_0005_PKT), false);
  assert.equal(contactedToday(stamped('2026-10-28T23:59'), OCT28_2359_PKT), true, 'it WAS today at 23:59 yesterday');
  assert.equal(contactedToday({ id: 'x', name: 'Never' }, OCT29_1800_PKT), false);
  assert.equal(contactedToday(stamped('junk', 'call'), OCT29_1800_PKT), false);
  assert.equal(contactTimeLabel(stamped('2026-10-29T09:15')), '09:15');
  assert.equal(contactTimeLabel({ id: 'x' }), null);
});

test('SISP-138: badge text carries the stamp time, only for today, in both languages', () => {
  const c = stamped('2026-10-29T09:15');
  assert.equal(contactBadgeText(c, OCT29_1800_PKT, 'en'), '✓ Reminded Today 09:15');
  const ur = contactBadgeText(c, OCT29_1800_PKT, 'ur');
  assert.ok(ur.includes('09:15'), 'Urdu badge keeps the Latin-digit time');
  assert.notEqual(ur, '✓ Reminded Today 09:15');
  assert.equal(contactBadgeText(stamped('2026-10-28T23:59'), OCT29_1800_PKT, 'en'), '');
  const html = contactBadgeHtml(c, OCT29_1800_PKT, 'en');
  assert.ok(html.includes('contact-cooldown-badge'));
  assert.ok(html.includes('09:15'));
  assert.equal(contactBadgeHtml({ id: 'x' }, OCT29_1800_PKT, 'en'), '');
  assert.equal(contactChannelLabel('visit', 'en'), 'Visit');
  assert.ok(contactMarkedMessage('call', 'en').includes('Call'));
});

test('SISP-138: badge/filter helpers never stamp or mutate (frozen records stay intact)', () => {
  const frozen = Object.freeze(stamped('2026-10-29T09:15'));
  assert.equal(contactedToday(frozen, OCT29_1800_PKT), true);
  assert.ok(contactBadgeHtml(frozen, OCT29_1800_PKT, 'en').length > 0);
  const list = Object.freeze([frozen, Object.freeze({ id: 'y', name: 'Plain' })]);
  assert.deepEqual(filterCustomersNotContactedToday(list, OCT29_1800_PKT).map(c => c.id), ['y']);
  assert.deepEqual(
    filterQueueItemsNotContactedToday([{ customer: frozen }, { customer: { id: 'y' } }], OCT29_1800_PKT).map(i => i.customer.id),
    ['y']
  );
});

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: key => { store.delete(key); },
    clear: () => store.clear(),
    get length() { return store.size; },
    key: index => Array.from(store.keys())[index] || null
  };
}

test('SISP-138: Reminder Queue hideContactedToday filters only today\'s contacts', () => {
  const storage = createMockStorage();
  const due = (id, num, name, extra = {}) => ({
    id, customerNumber: num, name, phone: '03001111111', customDueDate: 5,
    bills: [{ dueAmount: 1500, payments: [] }], ...extra
  });
  const state = {
    customers: [
      due('c1', 1, 'Test One'),
      due('c2', 2, 'Test Two', { lastContactedAt: '2026-10-05T09:15', lastContactChannel: 'whatsapp' }),
      due('c3', 3, 'Test Three', { lastContactedAt: '2026-10-04T23:59', lastContactChannel: 'call' })
    ]
  };
  const now = new Date('2026-10-05T10:00:00Z'); // 15:00 PKT on 2026-10-05

  const full = getRemindersTodayQueue(state, { todayString: '2026-10-05', storage, now });
  assert.equal(full.totalCount, 3, 'default queue is unchanged (option off)');
  assert.equal(full.overdueCustomersCount, 3);

  const filtered = getRemindersTodayQueue(state, { todayString: '2026-10-05', storage, now, hideContactedToday: true });
  assert.deepEqual(filtered.queue.map(i => i.customerId), ['c1', 'c3'], 'today-contacted c2 hidden; yesterday-contacted c3 stays');
  assert.equal(filtered.totalCount, 2);
  assert.equal(filtered.overdueCustomersCount, 3, 'the balance statistic is not a queue count and is not reduced');
});

test('SISP-138: stamp survives the storage load path (readState) — junk pairs load as never-contacted', () => {
  const ref = new Date(Date.UTC(2026, 9, 29, 0, 0));
  const base = addCustomer(createInitialState([]), 'Test Round Trip', ref, {});
  const id = base.customers[0].id;
  const stampedState = stampContactInState(base, id, 'whatsapp', OCT29_0915_PKT);

  const loaded = readState({ getItem: () => JSON.stringify(stampedState) });
  const loadedCustomer = loaded.customers.find(c => c.id === id);
  assert.equal(loadedCustomer.lastContactedAt, '2026-10-29T09:15');
  assert.equal(loadedCustomer.lastContactChannel, 'whatsapp');
  assert.equal(contactedToday(loadedCustomer, OCT29_1800_PKT), true);

  const junkState = JSON.parse(JSON.stringify(stampedState));
  junkState.customers[0].lastContactChannel = 'pigeon';
  const loadedJunk = readState({ getItem: () => JSON.stringify(junkState) });
  assert.equal(loadedJunk.customers[0].lastContactedAt, null);
  assert.equal(loadedJunk.customers[0].lastContactChannel, null);
  assert.equal(contactedToday(loadedJunk.customers[0], OCT29_1800_PKT), false);

  const legacy = readState({ getItem: () => JSON.stringify(base) });
  assert.equal(contactedToday(legacy.customers[0], OCT29_1800_PKT), false);
});

test('SISP-138: stamp survives a JSON backup merge round-trip; recency wins, never a conflict', () => {
  const ref = new Date(Date.UTC(2026, 9, 29, 0, 0));
  const base = addCustomer(createInitialState([]), 'Test Backup User', ref, {});
  const id = base.customers[0].id;

  // Device B holds the same customer with a visit stamp from today.
  const deviceB = stampContactInState(base, id, 'visit', OCT29_0915_PKT);
  const backupText = createJsonBackup(deviceB, new Date(Date.UTC(2026, 9, 29, 5, 0)));
  const preview = previewJsonBackupMerge(base, backupText);
  const merged = preview.state.customers.find(c => c.id === id);
  assert.equal(merged.lastContactedAt, '2026-10-29T09:15', 'incoming stamp adopted onto the unstamped local record');
  assert.equal(merged.lastContactChannel, 'visit');
  assert.equal(preview.conflicts.length, 0, 'contact stamps merge silently by recency');

  // Local stamp is NEWER than the incoming one -> local wins.
  const localNewer = stampContactInState(base, id, 'call', OCT29_1800_PKT);
  const preview2 = previewJsonBackupMerge(localNewer, backupText);
  const merged2 = preview2.state.customers.find(c => c.id === id);
  assert.equal(merged2.lastContactedAt, '2026-10-29T18:00');
  assert.equal(merged2.lastContactChannel, 'call');
  assert.equal(preview2.conflicts.length, 0);
});

test('SISP-138: i18n — every cct_* key exists in en + ur with matching placeholders', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter(k => k.startsWith('cct_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter(k => k.startsWith('cct_')).sort();
  assert.ok(enKeys.length >= 10, 'the cct_* family is present');
  assert.deepEqual(urKeys, enKeys, 'en/ur key parity');
  const placeholders = s => [...String(s).matchAll(/\{([a-zA-Z]+)\}/g)].map(m => m[1]).sort();
  for (const key of enKeys) {
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);
    assert.notEqual(t(key, 'en', { time: '09:15', channel: 'Call' }), key, `t() must resolve ${key}`);
  }
  for (const ch of CONTACT_CHANNELS) {
    assert.ok(enKeys.includes(`cct_channel_${ch}`), `channel key for ${ch}`);
  }
});

test('SISP-138: every cct_* key referenced in code or HTML exists in both dictionaries', () => {
  const referenced = new Set();
  for (const rel of ['contact-cooldown-tracker.js', 'app.js', 'field-mode.js', 'dashboard-top-defaulters.js', 'reminder-queue.js']) {
    for (const m of read(rel).matchAll(/['"`](cct_[a-z_]+)['"`]/g)) referenced.add(m[1]);
  }
  for (const m of read('index.html').matchAll(/data-i18n="(cct_[a-z_]+)"/g)) referenced.add(m[1]);
  assert.ok(referenced.size >= 5, 'references were found');
  for (const key of referenced) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing referenced ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing referenced ${key}`);
  }
});

test('SISP-138: wiring pins — surfaces, toggles, and the perf budget seam', () => {
  assert.ok(!ENTRY_FILES.includes('contact-cooldown-tracker.js'), 'module is not a build entry (app.js-only graph import)');

  const app = read('app.js');
  assert.ok(app.includes("from './contact-cooldown-tracker.js'"));
  assert.ok(app.includes('stampContactInState'), 'reminder dispatch stamps through the state helper');
  assert.ok(app.includes('reminderHideContactedTodayToggle'));
  assert.ok(app.includes('reminderQueueOptions()'), 'queue builds honour the toggle');

  const queue = read('reminder-queue.js');
  assert.ok(queue.includes('options.hideContactedToday'), 'queue builder carries the filter option');

  const fm = read('field-mode.js');
  assert.ok(fm.includes('contactBadgeHtml'), 'field cards render the badge');
  assert.ok(fm.includes('data-field-contact'), 'field sheet carries the mark-contacted chips');
  assert.ok(fm.includes('fieldModeHideContactedToggle'), 'field list honours its toggle');

  const td = read('dashboard-top-defaulters.js');
  assert.ok(td.includes('defaulter-contact-chip'), 'defaulter rows carry the channel picker');
  assert.ok(td.includes('applyContactStamp'), 'defaulter contacts stamp through one helper');
  assert.ok(td.includes('topDefaultersHideContactedBtn'), 'defaulter list honours its toggle');

  const html = read('index.html');
  for (const id of ['reminderHideContactedTodayToggle', 'topDefaultersHideContactedBtn', 'fieldModeHideContactedToggle']) {
    assert.ok(html.includes(`id="${id}"`), `index.html carries #${id}`);
  }
  assert.ok(html.includes('data-contact-channel="visit"'), 'reminder modal exposes the visit channel');

  const css = read('components.css');
  const block = css.slice(css.indexOf('SISP-138: contact cooldown'));
  assert.ok(block.includes('.contact-cooldown-badge'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-138 CSS is token-only (no hex)');
});
