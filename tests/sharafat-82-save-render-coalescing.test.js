// Sharafat 82 — save() re-renders the entire app on every save.
//
// The live failure was one full render tail (9 calls) per save, so
// the void confirm handler's same-tick double save (save after
// voidPayment, then save again when addon charges reopen) ran the
// whole tail twice. The fix coalesces the tail: the first save in a
// synchronous stretch schedules ONE microtask pass and later saves
// in the same tick just join it. Persistence stays synchronous per
// save — only the renders are deferred — and the persistence-blocked
// failure branch keeps its 8 synchronous renders + `return false`.
//
// Method (the repro's template): the REAL save() is extracted from
// app.js source by brace-matching and evaluated in a harness with
// counting render stubs and a MANUAL microtask queue (the harness's
// local queueMicrotask shadows the global one, and flush() drains
// it). One "render pass" = one execution of the tail, counted by
// its first call (renderDashboard) — the blocked branch renders 8
// of the 9 tail calls, so counting by nines would under-count it.
// The harness also declares `let saveRendersPending = false;`,
// mirroring the module-scope flag declared immediately above save()
// in app.js (a source pin below asserts that placement).
//
// Fixtures are generic placeholders only — no customer names, no
// phone numbers anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');

// ---------- extraction (the repro's brace-matcher, verbatim shape) ----------

function extractSave(src) {
  const start = src.indexOf('function save() {');
  assert.ok(start >= 0, 'save() not found in app.js');
  let i = src.indexOf('{', start);
  let depth = 0;
  let state = 'code';
  for (; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === 'code') {
      if (ch === "'") state = 'sq';
      else if (ch === '"') state = 'dq';
      else if (ch === '`') state = 'tq';
      else if (ch === '/' && next === '/') state = 'line';
      else if (ch === '/' && next === '*') state = 'block';
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return src.slice(start, i + 1);
      }
    } else if (state === 'sq') {
      if (ch === '\\') i++;
      else if (ch === "'") state = 'code';
    } else if (state === 'dq') {
      if (ch === '\\') i++;
      else if (ch === '"') state = 'code';
    } else if (state === 'tq') {
      if (ch === '\\') i++;
      else if (ch === '`') state = 'code';
      else if (ch === '$' && next === '{') state = 'tpl';
    } else if (state === 'tpl') {
      if (ch === '}') state = 'tq';
    } else if (state === 'line') {
      if (ch === '\n') state = 'code';
    } else if (state === 'block') {
      if (ch === '*' && next === '/') { state = 'code'; i++; }
    }
  }
  throw new Error('save() braces never balanced');
}

const saveSrc = extractSave(app);
// The tail's call order, used by the C3 assertion at file scope. The
// harness below re-declares the same list inside its own scope,
// because passOrder() runs in the evaluated harness where this
// file-scope const is not visible.
const TAIL = ['renderDashboard', 'renderGlobalSearch', 'renderCustomers', 'renderTransactions', 'renderMonthlyReport', 'refreshOwnerCenter', 'renderPhase3', 'renderStorageWarning', 'registerRefresh'];
const MIRROR = ['renderGlobalSearch();', 'renderCustomers();', 'renderTransactions();', 'renderMonthlyReport();'];

// ---------- harness ----------

function makeHarness() {
  const harness = `
let state = { customers: [], version: 1 };
let persistenceBlocked = false;
let storageAvailable = true;
let quotaWarningShown = false;
let storageEstimateInfo = { supported: false };
// Mirrors the module-scope flag declared immediately above save()
// in app.js (pinned by the source test below).
let saveRendersPending = false;
// The tail's call order, in harness scope: passOrder() below runs
// inside this evaluated harness, so TAIL must be declared here —
// the file-scope const used to live outside it and was not visible
// to the evaluated code (ReferenceError on the C3 test).
const TAIL = ['renderDashboard', 'renderGlobalSearch', 'renderCustomers', 'renderTransactions', 'renderMonthlyReport', 'refreshOwnerCenter', 'renderPhase3', 'renderStorageWarning', 'registerRefresh'];
let scheduledMicrotasks = [];
const queueMicrotask = (fn) => { scheduledMicrotasks.push(fn); };
function flushMicrotasks() { const q = scheduledMicrotasks; scheduledMicrotasks = []; for (const fn of q) fn(); }
const localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); } };
const calls = { renders: [], persist: [], persistStates: [], toasts: [], flagAtFirstRender: [] };
function countRender(name) { calls.renders.push({ name, version: state.version }); }
function renderDashboard() { calls.flagAtFirstRender.push(saveRendersPending); countRender('renderDashboard'); }
function renderGlobalSearch() { countRender('renderGlobalSearch'); }
function renderCustomers() { countRender('renderCustomers'); }
function renderTransactions() { countRender('renderTransactions'); }
function renderMonthlyReport() { countRender('renderMonthlyReport'); }
function refreshOwnerCenter() { countRender('refreshOwnerCenter'); }
function renderPhase3() { countRender('renderPhase3'); }
function renderStorageWarning() { countRender('renderStorageWarning'); }
const dailyRegisterController = { refresh() { countRender('registerRefresh'); } };
function requestPersistenceOnFirstWrite() {}
function generateMonthlyBillsThroughCurrentMonth(s) { return s; }
function loadBillingCycleChoices() { return {}; }
function autoClosePreviousMonth(s) { return s; }
function assessSaveSize() { return { warn: false }; }
function reconcileReferralCredits() { return { changed: false }; }
function loadReferralCredits() { return []; }
function saveReferralCredits() {}
function persistState(s) { calls.persist.push(1); calls.persistStates.push(s.version); }
function isQuotaError() { return false; }
function saveFallbackAndWarn() {}
function toast(msg) { calls.toasts.push(msg); }
${saveSrc}
function passes() { return calls.renders.filter(r => r.name === 'renderDashboard').length; }
function passOrder() { return calls.renders.filter(r => TAIL.includes(r.name)).map(r => r.name); }
function reset() { calls.renders = []; calls.persist = []; calls.persistStates = []; calls.toasts = []; calls.flagAtFirstRender = []; scheduledMicrotasks = []; saveRendersPending = false; }
return { save, flushMicrotasks, calls, passes, passOrder, reset,
  get state() { return state; }, set state(v) { state = v; },
  get persistenceBlocked() { return persistenceBlocked; }, set persistenceBlocked(v) { persistenceBlocked = v; },
  get scheduled() { return scheduledMicrotasks.length; },
  get saveRendersPending() { return saveRendersPending; } };
`;
  return new Function(harness)();
}

function listenerSlice(source, id) {
  const start = source.indexOf(`$('#${id}')`);
  assert.ok(start >= 0, `#${id} listener not found in app.js`);
  const lineEnd = source.indexOf('\n', start);
  const line = source.slice(start, lineEnd);
  if (line.includes('});')) return line;
  const end = source.indexOf('\n});', start);
  assert.ok(end > start, `#${id} listener has no closing`);
  return source.slice(start, end);
}

function assertMirrorInOrder(slice, label) {
  let at = -1;
  for (const call of MIRROR) {
    const i = slice.indexOf(call, at + 1);
    assert.ok(i > at, `${label} must call ${call} after the previous call`);
    at = i;
  }
}

// ---- behaviour: coalescing ------------------------------------------

test('Sharafat 82: two save() calls in one tick produce one render pass (F1)', () => {
  const h = makeHarness();
  h.save(); h.save(); h.flushMicrotasks();
  assert.equal(h.passes(), 1, 'two saves in one tick must share one pass');
});

test('Sharafat 82: void-style save-mutate-save in one tick produces one render pass (F2)', () => {
  const h = makeHarness();
  h.save(); h.state = { customers: [], version: 2 }; h.save(); h.flushMicrotasks();
  assert.equal(h.passes(), 1, 'save-mutate-save in one tick must share one pass');
});

test('Sharafat 82: coalescing is per-tick, not permanent — save, save, flush, save, flush is two passes (F3)', () => {
  const h = makeHarness();
  h.save(); h.save(); h.flushMicrotasks(); h.save(); h.flushMicrotasks();
  assert.equal(h.passes(), 2, 'a save after the flush must start a fresh pass');
});

test('Sharafat 82: five save() calls in one tick produce one render pass (F4)', () => {
  const h = makeHarness();
  for (let i = 0; i < 5; i++) h.save();
  h.flushMicrotasks();
  assert.equal(h.passes(), 1, 'five saves in one tick must share one pass');
});

test('Sharafat 82: the single pass renders the LATEST state, not a snapshot (R4)', () => {
  const h = makeHarness();
  h.save(); h.state = { customers: [], version: 2 }; h.save(); h.flushMicrotasks();
  assert.equal(h.passes(), 1, 'the two saves must share one pass');
  const seen = h.calls.renders.filter(r => r.name === 'renderDashboard').map(r => r.version);
  assert.deepEqual(seen, [2], 'the pass must render the second save\'s mutations');
});

test('Sharafat 82: the flag is cleared BEFORE the renders run (R5)', () => {
  const h = makeHarness();
  h.save(); h.flushMicrotasks();
  assert.deepEqual(h.calls.flagAtFirstRender, [false], 'renderDashboard must see the flag already clear');
  assert.equal(h.saveRendersPending, false, 'the flag must be clear after the pass');
});

// ---- guards: persistence + failure branch ----------------------------

test('Sharafat 82: two save() calls still persist twice — persistence is not coalesced (G1)', () => {
  const h = makeHarness();
  h.save(); h.save(); h.flushMicrotasks();
  assert.equal(h.calls.persist.length, 2, 'each save must still write');
  assert.deepEqual(h.calls.persistStates, [1, 1], 'each write must carry its own save\'s state');
});

test('Sharafat 82: the persistence-blocked save renders synchronously without a flush (G2)', () => {
  const h = makeHarness();
  h.persistenceBlocked = true;
  assert.equal(h.save(), false, 'a blocked save must still return false synchronously');
  assert.equal(h.passes(), 1, 'the blocked branch must render before any flush');
  assert.equal(h.scheduled, 0, 'the blocked branch must not schedule a microtask');
  assert.equal(h.calls.persist.length, 0, 'a blocked save must not persist');
  h.persistenceBlocked = false;
});

// ---- controls ---------------------------------------------------------

test('Sharafat 82: a single save() produces exactly one render pass (C1)', () => {
  const h = makeHarness();
  h.save(); h.flushMicrotasks();
  assert.equal(h.passes(), 1, 'one save must produce one pass');
});

test('Sharafat 82: save() still returns storageAvailable synchronously (C2)', () => {
  const h = makeHarness();
  assert.equal(h.save(), true, 'save() must return true synchronously');
  assert.equal(h.passes(), 0, 'no pass has run yet — the tail is deferred');
  h.flushMicrotasks();
  assert.equal(h.passes(), 1, 'the pass runs on the flush');
});

test('Sharafat 82: the render tail keeps its order (C3)', () => {
  const h = makeHarness();
  h.save(); h.flushMicrotasks();
  assert.deepEqual(h.passOrder(), TAIL, 'the tail must keep all 9 calls in order');
});

// ---- source pins ------------------------------------------------------

test('Sharafat 82: the tail is scheduled through queueMicrotask, with persistState before it (S1/S3)', () => {
  assert.match(saveSrc, /queueMicrotask\s*\(/, 'save() must schedule the tail through queueMicrotask');
  assert.ok(
    saveSrc.indexOf('persistState') !== -1 && saveSrc.indexOf('persistState') < saveSrc.indexOf('queueMicrotask'),
    'persistState must precede the scheduling in save() — the render still runs after the persist'
  );
});

test('Sharafat 82: exactly one microtask is scheduled for two saves in one tick (S2)', () => {
  const h = makeHarness();
  h.save(); h.save();
  assert.equal(h.scheduled, 1, 'two saves in one tick must schedule exactly one microtask');
});

test('Sharafat 82: all nine tail calls live inside the scheduled callback (S4)', () => {
  const q = saveSrc.indexOf('queueMicrotask');
  assert.ok(q !== -1, 'no queueMicrotask in save()');
  const tail = saveSrc.slice(q);
  for (const name of ['renderDashboard', 'renderGlobalSearch', 'renderCustomers', 'renderTransactions', 'renderMonthlyReport', 'refreshOwnerCenter', 'renderPhase3', 'renderStorageWarning', 'dailyRegisterController']) {
    assert.ok(tail.includes(name), `${name} must live inside the scheduled callback`);
  }
  // No tail call may sit outside the callback (before queueMicrotask) —
  // except the persistence-blocked branch, which legitimately renders
  // synchronously BEFORE the scheduling (D3): its `return false;`
  // ends it, so only the region between that return and the
  // scheduling must hold no tail call.
  const blockedEnd = saveSrc.indexOf('return false;');
  assert.ok(blockedEnd !== -1, 'the blocked branch must still return false');
  const before = saveSrc.slice(blockedEnd, q);
  for (const name of ['renderDashboard();', 'renderGlobalSearch();', 'renderCustomers();', 'renderTransactions();', 'renderMonthlyReport();', 'refreshOwnerCenter();', 'renderPhase3();', 'renderStorageWarning();']) {
    assert.ok(!before.includes(name), `${name} must not run synchronously before the scheduling`);
  }
});

test('Sharafat 82: the pending flag is declared immediately above save() (D1)', () => {
  assert.ok(
    app.includes('let saveRendersPending = false;\nfunction save() {'),
    'the flag must be a module-scope let immediately above save()'
  );
  assert.equal(app.split('let saveRendersPending').length - 1, 1, 'the flag must be declared exactly once');
  assert.equal(app.split('queueMicrotask').length - 1, 1, 'queueMicrotask must appear exactly once in app.js — only save() schedules through it');
});

test('Sharafat 82: the persistence-blocked branch keeps its 8 synchronous renders and no scheduler (D3)', () => {
  const branchStart = saveSrc.indexOf('if (persistenceBlocked) {');
  assert.ok(branchStart !== -1, 'the blocked branch must still exist in save()');
  const branch = saveSrc.slice(branchStart, saveSrc.indexOf('return false;', branchStart));
  assert.ok(!branch.includes('queueMicrotask'), 'the blocked branch must not go through the scheduler');
  for (const call of ['renderStorageWarning();', 'renderDashboard();', 'renderGlobalSearch();', 'renderCustomers();', 'renderTransactions();', 'renderMonthlyReport();', 'refreshOwnerCenter();', 'renderPhase3();']) {
    assert.ok(branch.includes(call), `the blocked branch must keep its synchronous ${call}`);
  }
  assert.ok(!branch.includes('dailyRegisterController'), 'the blocked branch keeps its asymmetry: no register refresh');
});

test('Sharafat 82: the void confirm handler still saves twice in one synchronous stretch (the double save this item coalesces)', () => {
  // app.js wires the button with getElementById, not the $ helper.
  const handlerStart = app.indexOf("document.getElementById('voidPaymentConfirmBtn')");
  assert.ok(handlerStart !== -1, 'void confirm button not found');
  // The two saves sit ~55 lines into the handler (save after
  // voidPayment, save after addon charges reopen); an 8,000-char
  // window covers them both with room to spare.
  const handler = app.slice(handlerStart, handlerStart + 8000);
  // Anchor on the void itself, then the save right after it, then the
  // save after the addon charges reopen — the pair the coalescing
  // exists for. The only await in the handler sits BEFORE the void
  // (the pre-action snapshot), so nothing separates the two saves.
  const voidAt = handler.indexOf('voidPayment(state, target.customerId');
  assert.ok(voidAt !== -1, 'voidPayment call not found in the void confirm handler');
  const first = handler.indexOf('save();', voidAt);
  const second = handler.indexOf('save();', handler.indexOf('unsettleAddonChargesForPayment', voidAt));
  assert.ok(first !== -1 && second !== -1 && second > first, 'the void handler must hold the post-void save and the post-addon-reopen save');
  assert.ok(handler.slice(first, second).indexOf('await ') === -1, 'no await may sit between the two void saves — they must be the same tick');
});

// ---- what must NOT change ----------------------------------------------

test('Sharafat 82: the clear handlers keep their synchronous four-call mirror (C4, Sharafat 31)', () => {
  assertMirrorInOrder(listenerSlice(app, 'clearGlobalSearch'), '#clearGlobalSearch');
  assertMirrorInOrder(listenerSlice(app, 'clearGlobalSearchChip'), 'chip remove');
  assertMirrorInOrder(listenerSlice(app, 'clearCustomerListSearch'), 'list Clear');
  for (const id of ['clearGlobalSearch', 'clearGlobalSearchChip', 'clearCustomerListSearch']) {
    assert.ok(!listenerSlice(app, id).includes('queueMicrotask'), `${id} must not go through the scheduler`);
  }
});

// Hisaab H2: 94 → 96 — the Upstream tab adds exactly two bare save()
// sites, both following the postOverhead precedent (state reassigned to
// the mirrored expenses, then save()): the add/correct-bill submit and
// the bill delete handler in renderUpstream(). The saveUpstreamProviders
// calls do not match the 'save();' filter. The intent pins — no caller
// uses the return value, branches on it, or returns it — are unchanged.
test('Sharafat 82: no other save() call site changed — 96 sites, none using the return value', () => {
  const sites = app.split('\n').filter(l => l.includes('save();'));
  assert.equal(sites.length, 96, `save() must still have 96 call sites (found ${sites.length})`);
  assert.ok(!/= save\(\)/.test(app), 'no caller may use save()\'s return value');
  assert.ok(!/if \(save\(\)/.test(app), 'no caller may branch on save()');
  assert.ok(!/return save\(\)/.test(app), 'no caller may return save()');
});
