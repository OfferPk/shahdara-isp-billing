// Owner feature: live "active since" counter on the customer cards and
// the profile. The counter shows how long the customer has been in
// their CURRENT service status, counted from the recorded status
// history (uptime-tracking.js currentStatusSession) — the same history
// the PR #480 month summary reads, so the two can never disagree.
// Honesty pins: a legacy record without a status stamp gets a
// date-level line for Active (whole days from the recorded connection
// or profile-added date, hours never invented) and NO line for
// Offline; 'not-set' never shows a counter. The per-minute tick
// (refreshLiveSessionCounters) rewrites only counter nodes' text —
// the DOM nodes themselves survive, asserted with a mock DOM.
// Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addCustomer,
  createInitialState,
  updateCustomerProfile
} from '../core.js';
import {
  buildMonthlyUptime,
  collectOfflineIntervals,
  currentStatusSession,
  parsePkDateTime,
  refreshLiveSessionCounters
} from '../uptime-tracking.js';
import { TRANSLATIONS } from '../nav-language.js';

const at = (pkDateTime) => new Date(parsePkDateTime(pkDateTime));
const customer = (overrides = {}) => ({
  id: 'c-live',
  customerNumber: 7,
  name: 'Test Customer 7',
  connectionDate: '2026-09-01',
  addedOn: '2026-09-01',
  serviceStatus: 'active',
  serviceStatusHistory: [],
  incidents: [],
  bills: [],
  archived: false,
  ...overrides
});

// ---------- session math (datetime precision) ----------

test('session: offline flip at T reads 2 days 3 hours 4 min at T+2d3h4m', () => {
  const c = customer({
    serviceStatus: 'offline',
    serviceStatusHistory: [
      { status: 'active', at: '2026-10-20T09:00' },
      { status: 'offline', at: '2026-10-27T10:00' }
    ]
  });
  const session = currentStatusSession(c, at('2026-10-29T13:04'));
  assert.equal(session.status, 'offline');
  assert.equal(session.precision, 'datetime');
  assert.equal(session.since, '2026-10-27T10:00');
  assert.equal(session.sinceMs, parsePkDateTime('2026-10-27T10:00'));
  assert.equal(session.days, 2);
  assert.equal(session.hours, 3);
  assert.equal(session.minutes, 4);
  assert.equal(session.totalMinutes, 2 * 1440 + 3 * 60 + 4);
});

test('session: the trailing run of same-status stamps sets the start, not the last stamp alone', () => {
  // Consecutive duplicates cannot be produced by core.js (it appends
  // only on a real flip) but can arrive through backup merges; the
  // session must start at the run's first stamp.
  const c = customer({
    serviceStatus: 'active',
    serviceStatusHistory: [
      { status: 'active', at: '2026-10-25T08:00' },
      { status: 'offline', at: '2026-10-26T08:00' },
      { status: 'active', at: '2026-10-28T08:00' },
      { status: 'active', at: '2026-10-28T09:30' }
    ]
  });
  const session = currentStatusSession(c, at('2026-10-28T13:00'));
  assert.equal(session.precision, 'datetime');
  assert.equal(session.since, '2026-10-28T08:00');
  assert.equal(session.days, 0);
  assert.equal(session.hours, 5);
  assert.equal(session.minutes, 0);
});

test('session: online since creation stamp counts exact hours', () => {
  const c = customer({
    serviceStatus: 'active',
    serviceStatusHistory: [{ status: 'active', at: '2026-10-29T06:15' }]
  });
  const session = currentStatusSession(c, at('2026-10-29T13:00'));
  assert.equal(session.precision, 'datetime');
  assert.equal(session.hours, 6);
  assert.equal(session.minutes, 45);
});

// ---------- honesty: legacy records without a usable stamp ----------

test('legacy: active with a connection date gets whole days only — hours are never invented', () => {
  const c = customer({ serviceStatus: 'active', serviceStatusHistory: [], connectionDate: '2026-10-09', addedOn: '2026-10-09' });
  const session = currentStatusSession(c, at('2026-10-29T13:00'));
  assert.equal(session.precision, 'date');
  assert.equal(session.sinceDate, '2026-10-09');
  assert.equal(session.days, 20);
  assert.equal(session.hours, null);
  assert.equal(session.minutes, null);
  assert.equal(session.sinceMs, null);
});

test('legacy: active with only a profile-added date falls back to that date', () => {
  const c = customer({ serviceStatus: 'active', serviceStatusHistory: [], connectionDate: null, addedOn: '2026-10-19' });
  const session = currentStatusSession(c, at('2026-10-29T13:00'));
  assert.equal(session.precision, 'date');
  assert.equal(session.sinceDate, '2026-10-19');
  assert.equal(session.days, 10);
});

test('legacy: offline without a stamp has no honest start — no counter', () => {
  const c = customer({ serviceStatus: 'offline', serviceStatusHistory: [] });
  const session = currentStatusSession(c, at('2026-10-29T13:00'));
  assert.equal(session.status, 'offline');
  assert.equal(session.precision, null);
  assert.equal(session.since, null);
  assert.equal(session.sinceMs, null);
  assert.equal(session.days, null);
});

test('legacy: a history whose newest stamp disagrees with the current status is not trusted for hours', () => {
  const c = customer({
    serviceStatus: 'active',
    connectionDate: '2026-10-09',
    addedOn: '2026-10-09',
    serviceStatusHistory: [{ status: 'offline', at: '2026-10-28T10:00' }]
  });
  const session = currentStatusSession(c, at('2026-10-29T13:00'));
  assert.equal(session.precision, 'date');
  assert.equal(session.sinceDate, '2026-10-09');
  assert.equal(session.hours, null);
});

test('not-set never has a session, even with history present', () => {
  const c = customer({
    serviceStatus: 'not-set',
    serviceStatusHistory: [{ status: 'not-set', at: '2026-10-01T09:00' }]
  });
  const session = currentStatusSession(c, at('2026-10-29T13:00'));
  assert.equal(session.status, 'not-set');
  assert.equal(session.precision, null);
  assert.equal(session.totalMinutes, null);
});

// ---------- the card-button flip path stamps + the counter follows ----------

test('flip path: the exact updateCustomerProfile call the card buttons make stamps history and the session switches', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Synthetic Flip Customer', at('2026-10-01T09:00'), { serviceStatus: 'active' });
  const id = state.customers.at(-1).id;
  const saved = () => state.customers.find(c => c.id === id);

  // Created active at 09:00 — three hours in, the counter runs from
  // the creation stamp with datetime precision.
  let session = currentStatusSession(saved(), at('2026-10-01T12:00'));
  assert.equal(session.precision, 'datetime');
  assert.equal(session.hours, 3);

  // The card's Offline button (app.js setManualServiceStatus) is this
  // exact core call — the flip is stamped and the session restarts.
  state = updateCustomerProfile(state, id, { serviceStatus: 'offline' }, at('2026-10-05T10:00'));
  assert.equal(saved().serviceStatusHistory.length, 2);
  session = currentStatusSession(saved(), at('2026-10-07T13:00'));
  assert.equal(session.status, 'offline');
  assert.equal(session.since, '2026-10-05T10:00');
  assert.equal(session.days, 2);
  assert.equal(session.hours, 3);

  // The PR #480 month summary reads the same span: offline minutes and
  // the open-since instant agree with the counter to the minute.
  const summary = buildMonthlyUptime(saved(), '2026-10', at('2026-10-07T13:00'));
  assert.equal(summary.offlineMinutes, 2 * 1440 + 3 * 60);
  assert.equal(summary.openSinceMs, parsePkDateTime('2026-10-05T10:00'));

  // Flipping back online closes the offline period in the same
  // history and starts a fresh online session.
  state = updateCustomerProfile(state, id, { serviceStatus: 'active' }, at('2026-10-07T14:00'));
  session = currentStatusSession(saved(), at('2026-10-07T16:30'));
  assert.equal(session.status, 'active');
  assert.equal(session.since, '2026-10-07T14:00');
  assert.equal(session.hours, 2);
  assert.equal(session.minutes, 30);
  const spans = collectOfflineIntervals(saved()).filter(span => span.source === 'status');
  assert.equal(spans.length, 1);
  assert.equal(spans[0].startMs, parsePkDateTime('2026-10-05T10:00'));
  assert.equal(spans[0].endMs, parsePkDateTime('2026-10-07T14:00'));
});

// ---------- the tick: text-only updates, nodes survive ----------

class FakeCounterNode {
  constructor(id) {
    this.dataset = { liveSessionFor: id };
    this._text = '';
    this.writes = 0;
  }
  set textContent(value) { this._text = value; this.writes += 1; }
  get textContent() { return this._text; }
  set innerHTML(_value) { throw new Error('the tick must never touch innerHTML (that would be a re-render)'); }
}

const tickFormat = (c, now) => {
  const s = currentStatusSession(c, now);
  if (s.precision === 'datetime') return `${s.status}:${s.days}d ${s.hours}h ${s.minutes}m`;
  if (s.precision === 'date') return `${s.status}:${s.days}d`;
  return '';
};

test('tick: updates only textContent, the node object survives, unchanged text is not rewritten', () => {
  const c = customer({
    id: 'c-tick',
    serviceStatus: 'offline',
    serviceStatusHistory: [
      { status: 'active', at: '2026-10-20T09:00' },
      { status: 'offline', at: '2026-10-27T10:00' }
    ]
  });
  const node = new FakeCounterNode('c-tick');
  const stray = new FakeCounterNode('c-missing');
  const nodes = [node, stray];
  const root = {
    querySelectorAll(selector) {
      assert.equal(selector, '[data-live-session-for]');
      return nodes;
    }
  };
  const getCustomer = id => (id === 'c-tick' ? c : undefined);

  const first = refreshLiveSessionCounters(root, { getCustomer, formatText: tickFormat, now: at('2026-10-29T13:04') });
  assert.equal(first, 1, 'only the resolvable node changed');
  assert.equal(node.textContent, 'offline:2d 3h 4m');
  assert.equal(node.writes, 1);
  assert.equal(stray.writes, 0, 'unknown customers are skipped');

  const again = refreshLiveSessionCounters(root, { getCustomer, formatText: tickFormat, now: at('2026-10-29T13:04') });
  assert.equal(again, 0, 'same instant, same text — no rewrite');
  assert.equal(node.writes, 1);

  const later = refreshLiveSessionCounters(root, { getCustomer, formatText: tickFormat, now: at('2026-10-29T14:04') });
  assert.equal(later, 1);
  assert.equal(node.textContent, 'offline:2d 4h 4m');
  assert.equal(nodes[0], node, 'the very same node object was updated in place — no re-render');
  assert.equal(nodes.length, 2, 'no nodes added or removed by the tick');
});

test('tick: missing dependencies are a safe no-op', () => {
  assert.equal(refreshLiveSessionCounters(null, {}), 0);
  assert.equal(refreshLiveSessionCounters({ querySelectorAll: () => [] }, {}), 0);
});

// ---------- wiring pins (app.js source) ----------

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('wiring: both surfaces render through the one shared markup builder', () => {
  assert.match(app, /import \{[^}]*currentStatusSession[^}]*refreshLiveSessionCounters[^}]*\} from '\.\/uptime-tracking\.js';/);
  assert.equal((app.match(/function liveSessionText/g) || []).length, 1, 'one shared text builder');
  assert.equal((app.match(/function liveSessionMarkup/g) || []).length, 1, 'one shared markup builder');

  const cardAt = app.indexOf('function customerCardMarkup');
  const cardSlice = app.slice(cardAt, app.indexOf('\n}', cardAt));
  const pillsAt = cardSlice.indexOf('service-choice-group');
  const counterAt = cardSlice.indexOf('liveSessionMarkup(customer)');
  assert.ok(pillsAt > -1 && counterAt > pillsAt, 'card counter sits under the status pills');

  const panelAt = app.indexOf('function renderUptimePanel');
  const panelSlice = app.slice(panelAt, app.indexOf('\n}', panelAt));
  assert.ok(panelSlice.includes('liveSessionMarkup(customer)'), 'profile uptime panel uses the same builder');
  assert.ok(panelSlice.includes('liveLine'), 'profile renders the counter line');
});

test('wiring: one shared per-minute ticker, hidden-tab guard, text-only updater', () => {
  assert.match(app, /window\.setInterval\(tickLiveSessionCounters, 60_000\)/);
  assert.match(app, /function tickLiveSessionCounters\(\) \{\s*if \(typeof document === 'undefined' \|\| document\.hidden\) return;/);
  assert.match(app, /refreshLiveSessionCounters\(document, \{/);
});

test('wiring: the field enrollment wizard no longer writes serviceStatus directly — addCustomer stamps it', () => {
  assert.doesNotMatch(app, /addedCustomer\.serviceStatus\s*=/, 'no direct serviceStatus mutation remains');
  const wizardAt = app.indexOf('customerEnrollmentWizard = setupCustomerEnrollmentWizard');
  assert.ok(wizardAt > -1, 'enrollment wizard setup found');
  const wizardSlice = app.slice(wizardAt, app.indexOf('onToast', wizardAt));
  assert.ok(wizardSlice.includes('wizardServiceStatus'), 'wizard normalizes its initial status');
  assert.ok(wizardSlice.includes('serviceStatus: wizardServiceStatus'), 'status is passed into addCustomer so the creation stamp is recorded');
});

// ---------- i18n audit ----------

test('i18n: every live-counter string exists in both dictionaries with its placeholders', () => {
  for (const key of ['upt_live_online', 'upt_live_offline', 'upt_live_active_since']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  for (const lang of ['en', 'ur']) {
    assert.ok(TRANSLATIONS[lang].upt_live_online.includes('{duration}'), `${lang} online keeps {duration}`);
    assert.ok(TRANSLATIONS[lang].upt_live_online.includes('{datetime}'), `${lang} online keeps {datetime}`);
    assert.ok(TRANSLATIONS[lang].upt_live_offline.includes('{duration}'), `${lang} offline keeps {duration}`);
    assert.ok(TRANSLATIONS[lang].upt_live_offline.includes('{datetime}'), `${lang} offline keeps {datetime}`);
    assert.ok(TRANSLATIONS[lang].upt_live_active_since.includes('{date}'), `${lang} fallback keeps {date}`);
    assert.ok(TRANSLATIONS[lang].upt_live_active_since.includes('{duration}'), `${lang} fallback keeps {duration}`);
  }
});
