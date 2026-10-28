// SISP-9: lazy loading for the heavy telecom/engineering charts chunk.
// The loader is tested with fake importers (the real dynamic import is only
// exercised through the build output check: telecom code must NOT appear in
// the first-load chunks — see the build verification in the phase report).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadTelecomCharts,
  isTelecomChartsLoaded,
  renderTelecomChartsNow,
  queueTelecomCharts,
  resetTelecomLoaderForTests
} from '../lazy-telecom.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const flush = async (n = 5) => { for (let i = 0; i < n; i++) await tick(); };

function fakeModule() {
  const calls = [];
  return {
    calls,
    mod: {
      renderTelecomCharts(state, referenceDate, options) {
        calls.push({ state, referenceDate, options });
      }
    }
  };
}

function fakeObserverEnv(region) {
  let callback = null;
  const observed = [];
  class FakeIO {
    constructor(cb) { callback = cb; }
    observe(el) { observed.push(el); }
    disconnect() {}
  }
  return {
    IntersectionObserver: FakeIO,
    trigger: entries => callback(entries),
    observed,
    document: { querySelector: () => region }
  };
}

test('loadTelecomCharts imports once and shares the promise', async () => {
  resetTelecomLoaderForTests();
  let imports = 0;
  const importer = () => { imports += 1; return Promise.resolve({ marker: true }); };
  const [a, b] = await Promise.all([loadTelecomCharts(importer), loadTelecomCharts(importer)]);
  assert.equal(imports, 1);
  assert.equal(a, b);
  assert.equal(isTelecomChartsLoaded(), true);
  await loadTelecomCharts(importer);
  assert.equal(imports, 1, 'cached module is reused, not re-imported');
});

test('a failed load clears the cache so the next call retries', async () => {
  resetTelecomLoaderForTests();
  let attempts = 0;
  const importer = () => {
    attempts += 1;
    return attempts === 1 ? Promise.reject(new Error('chunk missing')) : Promise.resolve({ ok: true });
  };
  await assert.rejects(() => loadTelecomCharts(importer), /chunk missing/);
  assert.equal(isTelecomChartsLoaded(), false);
  const mod = await loadTelecomCharts(importer);
  assert.equal(mod.ok, true);
  assert.equal(attempts, 2);
});

test('renderTelecomChartsNow forwards state, date and options', async () => {
  resetTelecomLoaderForTests();
  const { calls, mod } = fakeModule();
  const state = { customers: [] };
  const date = new Date('2026-10-28T00:00:00Z');
  await renderTelecomChartsNow(state, date, { onToast: () => {} }, () => Promise.resolve(mod));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].state, state);
  assert.equal(calls[0].referenceDate, date);
});

test('queueTelecomCharts renders only when the charts region intersects', async () => {
  resetTelecomLoaderForTests();
  const { calls, mod } = fakeModule();
  const region = { id: 'region' };
  const env = fakeObserverEnv(region);
  let imports = 0;
  const importer = () => { imports += 1; return Promise.resolve(mod); };

  queueTelecomCharts({ customers: [] }, new Date(), {}, { ...env, importer });
  await flush();
  assert.equal(imports, 0, 'nothing loads while the region is off-screen');
  assert.deepEqual(env.observed, [region]);

  env.trigger([{ isIntersecting: false }]);
  await flush();
  assert.equal(imports, 0, 'a non-intersecting entry must not trigger a load');

  env.trigger([{ isIntersecting: true }]);
  await flush();
  assert.equal(imports, 1);
  assert.equal(calls.length, 1);
});

test('queueTelecomCharts renders only the newest args when re-queued during load', async () => {
  resetTelecomLoaderForTests();
  const { calls, mod } = fakeModule();
  const region = { id: 'region' };
  const env = fakeObserverEnv(region);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const importer = () => gate.then(() => mod);

  queueTelecomCharts({ tag: 'old' }, new Date(), {}, { ...env, importer });
  env.trigger([{ isIntersecting: true }]);
  queueTelecomCharts({ tag: 'new' }, new Date(), {}, { ...env, importer });
  release();
  await flush();
  assert.equal(calls.length, 1, 'one render, with the newest args');
  assert.equal(calls[0].state.tag, 'new');
});

test('queueTelecomCharts with an already-loaded chunk renders on a microtask', async () => {
  resetTelecomLoaderForTests();
  const { calls, mod } = fakeModule();
  const importer = () => Promise.resolve(mod);
  await loadTelecomCharts(importer);
  queueTelecomCharts({ tag: 'again' }, new Date(), {}, { document: { querySelector: () => null }, importer });
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].state.tag, 'again');
});

test('queueTelecomCharts falls back to idle scheduling without IntersectionObserver', async () => {
  resetTelecomLoaderForTests();
  const { calls, mod } = fakeModule();
  let idleCb = null;
  const env = {
    document: { querySelector: () => ({ id: 'region' }) },
    requestIdleCallback: cb => { idleCb = cb; },
    importer: () => Promise.resolve(mod)
  };
  queueTelecomCharts({ customers: [] }, new Date(), {}, env);
  await flush();
  assert.equal(calls.length, 0, 'nothing renders before the idle callback fires');
  idleCb();
  await flush();
  assert.equal(calls.length, 1);
});

test('queueTelecomCharts does nothing for documents without querySelector (test fakes)', async () => {
  resetTelecomLoaderForTests();
  let imports = 0;
  const importer = () => { imports += 1; return Promise.resolve({ renderTelecomCharts() {} }); };
  queueTelecomCharts({ customers: [] }, new Date(), {}, {
    document: { getElementById: () => null },
    setTimeout: () => { throw new Error('must not schedule'); },
    importer
  });
  await flush();
  assert.equal(imports, 0);
});

test('a failed queued load toasts once and never throws', async () => {
  resetTelecomLoaderForTests();
  const toasts = [];
  const env = {
    document: { querySelector: () => ({ id: 'region' }) },
    requestIdleCallback: cb => cb(),
    importer: () => Promise.reject(new Error('offline'))
  };
  queueTelecomCharts({ customers: [] }, new Date(), { onToast: msg => toasts.push(msg) }, env);
  await flush();
  assert.equal(toasts.length, 1);
  assert.match(toasts[0], /Telecom charts/);
});
