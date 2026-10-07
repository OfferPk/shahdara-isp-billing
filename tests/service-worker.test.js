import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const workerSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function createWorker({ cacheNames = [], entries = [] } = {}) {
  const origin = 'https://billing.example';
  const handlers = new Map();
  const names = new Set(cacheNames);
  const stored = new Map([...names].map(name => [name, new Map()]));
  const deleted = [];
  const added = [];
  const matchOptions = [];
  const fetched = [];
  let fetchImpl = async request => {
    fetched.push(request.url);
    throw new Error('offline');
  };
  let skipWaitingCalls = 0;
  let claimCalls = 0;

  const urlFor = request => new URL(typeof request === 'string' ? request : request.url, `${origin}/`);
  for (const [name, path, value] of entries) {
    names.add(name);
    if (!stored.has(name)) stored.set(name, new Map());
    stored.get(name).set(urlFor(path).pathname, value);
  }
  const cacheFor = name => {
    names.add(name);
    if (!stored.has(name)) stored.set(name, new Map());
    return {
      addAll: async files => { added.push({ name, files:[...files] }); },
      put: async (request, response) => { stored.get(name).set(urlFor(request).pathname, response); }
    };
  };
  const caches = {
    open: async name => cacheFor(name),
    keys: async () => [...names],
    delete: async name => {
      deleted.push(name);
      stored.delete(name);
      return names.delete(name);
    },
    match: async (request, options = {}) => {
      matchOptions.push(options);
      const pathname = urlFor(request).pathname;
      for (const name of names) {
        const value = stored.get(name)?.get(pathname);
        if (value !== undefined) return value;
      }
      return undefined;
    }
  };
  const self = {
    location:{ origin },
    addEventListener:(type, callback) => handlers.set(type, callback),
    skipWaiting:() => { skipWaitingCalls += 1; return Promise.resolve(); },
    clients:{ claim:() => { claimCalls += 1; return Promise.resolve(); } }
  };
  runInNewContext(workerSource, { self, caches, fetch:request => fetchImpl(request), URL, Promise });

  return {
    names,
    deleted,
    added,
    matchOptions,
    fetched,
    get skipWaitingCalls() { return skipWaitingCalls; },
    get claimCalls() { return claimCalls; },
    setFetch:fn => { fetchImpl = fn; },
    async dispatch(type, request) {
      const waits = [];
      let responsePromise;
      let responded = false;
      const event = {
        request,
        waitUntil:promise => waits.push(Promise.resolve(promise)),
        respondWith:promise => { responded = true; responsePromise = Promise.resolve(promise); }
      };
      handlers.get(type)(event);
      await Promise.all(waits);
      return { responded, response:responded ? await responsePromise : undefined };
    }
  };
}

test('worker install precaches the offline shell before taking control', async () => {
  const worker = createWorker();
  await worker.dispatch('install');
  assert.equal(worker.skipWaitingCalls, 1);
  assert.equal(worker.added.length, 1);
  assert.equal(worker.added[0].name, 'shahdara-isp-billing-v32');
  assert.deepEqual(worker.added[0].files, [
    './','./index.html','./styles.css','./app.js','./profile-labels.js',
    './profile-ui.js','./receipt.js','./package-catalog.js','./core.js','./phase3.js','./owner-insights.js','./owner-ui.js','./manifest.webmanifest','./icon.svg'
  ]);
});

test('worker activation removes only older Shahdara caches and claims clients', async () => {
  const worker = createWorker({ cacheNames:[
    'shahdara-isp-billing-v19',
    'another-pwa-cache-v3',
    'tool-cache',
    'shahdara-isp-billing-v23',
    'shahdara-isp-billing-v30',
    'shahdara-isp-billing-v31',
    'shahdara-isp-billing-v32'
  ] });
  await worker.dispatch('activate');
  assert.deepEqual(worker.deleted, ['shahdara-isp-billing-v19','shahdara-isp-billing-v23','shahdara-isp-billing-v30','shahdara-isp-billing-v31']);
  assert.deepEqual([...worker.names].sort(), ['another-pwa-cache-v3','shahdara-isp-billing-v32','tool-cache'].sort());
  assert.equal(worker.claimCalls, 1);
});

test('worker serves a versioned app-module request from its cache despite query parameters', async () => {
  const worker = createWorker({
    cacheNames:['shahdara-isp-billing-v32'],
    entries:[['shahdara-isp-billing-v32','/app.js','cached module']]
  });
  const result = await worker.dispatch('fetch', { url:'https://billing.example/app.js?v=1.6.0', method:'GET' });
  assert.equal(result.responded, true);
  assert.equal(result.response, 'cached module');
  assert.equal(worker.matchOptions[0].ignoreSearch, true);
  assert.deepEqual(worker.fetched, []);
});

test('worker falls back to its cached app shell when a same-origin request fails offline', async () => {
  const worker = createWorker({
    cacheNames:['shahdara-isp-billing-v32'],
    entries:[['shahdara-isp-billing-v32','./index.html','cached offline shell']]
  });
  const result = await worker.dispatch('fetch', { url:'https://billing.example/uncached-route', method:'GET' });
  assert.equal(result.responded, true);
  assert.equal(result.response, 'cached offline shell');
  assert.deepEqual(worker.fetched, ['https://billing.example/uncached-route']);
});

test('worker leaves non-GET and cross-origin requests to the browser', async () => {
  const worker = createWorker();
  const post = await worker.dispatch('fetch', { url:'https://billing.example/records', method:'POST' });
  const external = await worker.dispatch('fetch', { url:'https://wa.me/12345678', method:'GET' });
  assert.equal(post.responded, false);
  assert.equal(external.responded, false);
  assert.deepEqual(worker.fetched, []);
});
