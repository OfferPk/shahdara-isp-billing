/**
 * SISP-150: 150-Phase In-Browser Isolated Smoke-Test Runner.
 *
 * Pins:
 *  - runSelfTests() (the SAME pure function the browser button runs)
 *    executes 25+ phase-labelled end-to-end assertions against the
 *    app's real engines, and every one passes on this tree;
 *  - ISOLATION: the runner never touches storage — a spy localStorage
 *    installed before the module is imported records ZERO reads and
 *    writes across a full run; a live-ledger-shaped object in scope
 *    stays byte-identical; and the module source (comments stripped)
 *    contains no storage API at all;
 *  - FAILURE DETECTION: tampered checks passed through the runner's
 *    documented test seam are REPORTED as failed with their detail —
 *    failures are never swallowed;
 *  - the Health Center mount is a safe no-op without the SISP-100 host
 *    dialog, mounts button + panel with a fake DOM when the host
 *    exists, runs on click, and is idempotent;
 *  - i18n: every selftest_* key the feature can emit exists in BOTH
 *    dictionaries with matching placeholders; rendered markup leaks no
 *    raw key in either language;
 *  - wiring/perf: app.js imports the module and calls the setup; the
 *    module is NOT a build entry (dist budget stays 25); the CSS block
 *    is token-only (no hex).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../nav-language.js';

/* Storage spy installed BEFORE the module under test is imported, so
 * any storage access attributable to it is counted. */
const storageCalls = { getItem: 0, setItem: 0, removeItem: 0, clear: 0 };
const spyData = new Map();
globalThis.localStorage = {
  getItem(key) { storageCalls.getItem += 1; return spyData.get(key) ?? null; },
  setItem(key, value) { storageCalls.setItem += 1; spyData.set(key, String(value)); },
  removeItem(key) { storageCalls.removeItem += 1; spyData.delete(key); },
  clear() { storageCalls.clear += 1; spyData.clear(); },
  key(index) { return [...spyData.keys()][index] ?? null; },
  get length() { return spyData.size; }
};

const {
  SELF_TEST_CHECKS,
  runSelfTests,
  buildSelfTestButtonHtml,
  renderSelfTestResultsHtml,
  setupInAppSelfTest
} = await import('../in-app-self-test.js');

const moduleSource = readFileSync(new URL('../in-app-self-test.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const buildSource = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../components.css', import.meta.url), 'utf8');

/* ---------------- The runner ---------------- */

test('self-test: 25+ phase-labelled checks, all passing against the real engines', () => {
  assert.ok(SELF_TEST_CHECKS.length >= 25, `expected >= 25 checks, got ${SELF_TEST_CHECKS.length}`);
  const ids = new Set();
  for (const check of SELF_TEST_CHECKS) {
    assert.ok(check.id && !ids.has(check.id), `unique id for ${check.id}`);
    ids.add(check.id);
    assert.match(check.label, /·/, `label names its phase/engine: ${check.label}`);
    assert.equal(typeof check.run, 'function');
  }
  const report = runSelfTests();
  assert.equal(report.total, SELF_TEST_CHECKS.length);
  assert.equal(report.passed, report.total, `failures: ${JSON.stringify(report.results.filter((r) => !r.ok), null, 2)}`);
  assert.equal(report.failed, 0);
  assert.ok(Number.isFinite(report.durationMs) && report.durationMs >= 0);
  for (const row of report.results) {
    assert.deepEqual(Object.keys(row).sort(), ['detail', 'id', 'label', 'ok']);
    assert.equal(row.ok, true, `${row.id}: ${row.detail}`);
  }
});

test('self-test: required headline behaviours are all guarded', () => {
  const ids = SELF_TEST_CHECKS.map((check) => check.id);
  for (const required of [
    'net-due-arrears', // bill net-due math (package + arrears − advance)
    'net-due-advance',
    'engine-settles-paid', // payment settles → paid
    'engine-partial', // partial + remainder
    'fifo-default-order', // FIFO arrears → package → kist
    'fifo-priority-toggle', // FIFO priority toggle
    'void-restores-dues', // void restores dues
    'void-kills-credit', // void kills its credit
    'advance-settles-next-month', // advance credit settles next month
    'free-never-billed', // FREE generates no bill
    'kist-lands-on-bill', // kist lands on the bill
    'doctor-equals-engine', // Doctor == engine
    'referral-credit-settles', // FU1b referral credit
    'concession-settles', // FU1b concession
    'receipt-paid' // receipt status for a paid fixture
  ]) {
    assert.ok(ids.includes(required), `missing guard: ${required}`);
  }
});

/* ---------------- Isolation ---------------- */

test('self-test isolation: a full run makes zero storage calls and mutates no live-shaped state', () => {
  const liveLedger = {
    customers: [{ id: 'live-1', name: 'Live Record (untouched)', bills: [{ month: '2026-10', dueAmount: 3000, payments: [] }] }],
    settings: { note: 'live' }
  };
  const before = JSON.stringify(liveLedger);
  const callsBefore = { ...storageCalls };
  const report = runSelfTests();
  assert.equal(report.failed, 0);
  assert.equal(JSON.stringify(liveLedger), before, 'live-shaped object byte-identical after the run');
  assert.deepEqual(storageCalls, callsBefore, 'no storage reads or writes attributable to the runner');
  assert.equal(storageCalls.setItem, 0);
  assert.equal(storageCalls.removeItem, 0);
  assert.equal(storageCalls.clear, 0);
});

test('self-test isolation: the module source contains no storage API (comments stripped)', () => {
  const codeOnly = moduleSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!codeOnly.includes('localStorage'), 'no localStorage in runner code');
  assert.ok(!codeOnly.includes('sessionStorage'), 'no sessionStorage in runner code');
  assert.ok(!codeOnly.includes('persistState'), 'no persistState in runner code');
  assert.ok(codeOnly.includes('Self-Test Customer'), 'fixtures use synthetic names only');
});

/* ---------------- Failure detection ---------------- */

test('self-test failure detection: tampered checks are reported as failed with detail', () => {
  const tampered = [
    { id: 'tampered-throw', label: 'SISP-2 · Tampered guard (throws)', run() { throw new Error('netDue: expected 9999, got 3000'); } },
    { id: 'tampered-false', label: 'SISP-2 · Tampered guard (returns false)', run() { return false; } },
    SELF_TEST_CHECKS[0]
  ];
  const report = runSelfTests({ checks: tampered });
  assert.equal(report.total, 3);
  assert.equal(report.passed, 1);
  assert.equal(report.failed, 2);
  const thrown = report.results.find((row) => row.id === 'tampered-throw');
  assert.equal(thrown.ok, false);
  assert.match(thrown.detail, /expected 9999, got 3000/);
  const falsy = report.results.find((row) => row.id === 'tampered-false');
  assert.equal(falsy.ok, false);
  assert.ok(falsy.detail.length > 0);
  const real = report.results.find((row) => row.id === SELF_TEST_CHECKS[0].id);
  assert.equal(real.ok, true, 'the untampered check still passes alongside failures');
});

/* ---------------- Markup + mount ---------------- */

class FakeEl {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.id = '';
    this._innerHTML = '';
  }
  set innerHTML(value) {
    this._innerHTML = String(value);
    if (this._innerHTML.includes('<button')) {
      const button = new FakeEl('button');
      button.id = 'systemHealthSelfTestBtn';
      this.children = [button];
    }
  }
  get innerHTML() { return this._innerHTML; }
  get firstElementChild() { return this.children[0] ?? null; }
  querySelector(selector) {
    if (selector === 'button') return this.children.find((child) => child.tagName === 'BUTTON') ?? null;
    return null;
  }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  click() { for (const fn of this.listeners.click ?? []) fn(); }
}

function fakeDoc({ withHost }) {
  const actions = new FakeEl('div');
  const body = new FakeEl('div');
  const doc = {
    querySelector(selector) {
      if (selector === '#systemHealthSelfTestBtn') {
        return actions.children.find((child) => child.id === 'systemHealthSelfTestBtn') ?? null;
      }
      if (!withHost) return null;
      if (selector === '#systemHealthModal .system-health-actions') return actions;
      if (selector === '#systemHealthModal .modal-body') return body;
      return null;
    },
    createElement(tag) { return new FakeEl(tag); },
    _actions: actions,
    _body: body
  };
  return doc;
}

test('self-test mount: safe no-op when the System Health Center host is absent', () => {
  const doc = fakeDoc({ withHost: false });
  assert.equal(setupInAppSelfTest({ document: doc }), null);
  assert.equal(setupInAppSelfTest({ document: null }), null);
  assert.equal(doc._actions.children.length, 0);
  assert.equal(doc._body.children.length, 0);
});

test('self-test mount: button + panel mount into the host, run on click, idempotent', () => {
  const doc = fakeDoc({ withHost: true });
  let toasts = 0;
  const mounted = setupInAppSelfTest({ document: doc, onToast: () => { toasts += 1; } });
  assert.equal(mounted.mounted, true);
  assert.equal(doc._actions.children.length, 1, 'one button in the actions row');
  assert.equal(doc._body.children.length, 1, 'one results panel in the modal body');
  const button = doc._actions.children[0];
  assert.equal(button.id, 'systemHealthSelfTestBtn');
  button.click();
  const panel = doc._body.children[0];
  assert.match(panel.innerHTML, /checks passed/);
  assert.match(panel.innerHTML, /synthetic \(fake\) data/);
  assert.ok(!panel.innerHTML.includes('selftest_'), 'no raw i18n key in the rendered panel');
  assert.equal(toasts, 1, 'one summary toast per run');
  const again = setupInAppSelfTest({ document: doc });
  assert.equal(again.alreadyMounted, true);
  assert.equal(doc._actions.children.length, 1, 'no duplicate button');
});

test('self-test markup: button + results render in both languages with no raw keys', () => {
  const report = runSelfTests();
  for (const lang of ['en', 'ur']) {
    const buttonHtml = buildSelfTestButtonHtml({ lang });
    assert.ok(buttonHtml.includes('systemHealthSelfTestBtn'));
    assert.ok(!buttonHtml.includes('selftest_'), `button ${lang} has no raw key`);
    const html = renderSelfTestResultsHtml(report, { lang });
    assert.ok(!html.includes('selftest_'), `panel ${lang} has no raw key`);
    assert.match(html, /self-test-row--ok/);
    assert.ok(html.includes(`${report.passed}/${report.total}`) || /\d+\/\d+/.test(html));
  }
  assert.equal(renderSelfTestResultsHtml(null), '');
});

/* ---------------- i18n audit ---------------- */

test('self-test i18n audit: every emitted key exists in both dictionaries with matching placeholders', () => {
  const keys = new Set();
  for (const source of [moduleSource, appSource]) {
    for (const match of source.matchAll(/t\('(selftest_[a-z0-9_]+)'/g)) keys.add(match[1]);
  }
  assert.ok(keys.size >= 7, `expected the selftest_* key set, got ${[...keys].join(',')}`);
  const placeholders = (text) => [...String(text).matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const key of keys) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en dictionary missing ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur dictionary missing ${key}`);
    assert.equal(placeholders(TRANSLATIONS.en[key]), placeholders(TRANSLATIONS.ur[key]), `placeholder parity for ${key}`);
  }
});

/* ---------------- Wiring + perf budget ---------------- */

test('self-test wiring: app.js imports + mounts the module; it is not a build entry; CSS is token-only', () => {
  assert.ok(appSource.includes("import { setupInAppSelfTest } from './in-app-self-test.js';"), 'app.js imports the setup');
  assert.ok(appSource.includes('setupInAppSelfTest({'), 'app.js calls the setup');
  const entryLine = buildSource.match(/ENTRY_FILES = \[([^\]]+)\]/);
  assert.ok(entryLine && !entryLine[1].includes('in-app-self-test.js'), 'module is not an entry file (dist stays 25)');
  const cssBlock = cssSource.slice(cssSource.indexOf('/* SISP-150'));
  assert.ok(cssBlock.includes('.self-test-panel'), 'panel styles present');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(cssBlock), 'no hex colours in the self-test CSS block');
});
