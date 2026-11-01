// SISP-157: Zone Daisy-Chain Topology Tree & Hop 3+ Deep-Chain Warning.
// Pure-function tests on synthetic data only. The chain model is SISP-7's
// upstreamCustomerId on the customer record (outage-impact.js); this
// phase only renders it as a Zone → Splitter Box → root → descendants
// tree. Decisions pinned here:
// - roots group by the ROOT's zone (canonicalMohalla) and the ROOT's
//   splitter box; descendants follow their root;
// - archived homes render in place (marked) and the chain passes
//   THROUGH them, so downstream actives are never orphaned;
// - a dangling upstream id makes the customer a root with a marker;
// - rootless cycle components are rooted at their lowest
//   customerNumber member with a cycleRoot flag, and any back-link to
//   an ancestor renders once as a terminal cycle node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  buildDaisyChainTree,
  renderDaisyChainTreeHtml,
  DEEP_CHAIN_MIN_HOP,
  DAISY_INDENT_CAP_HOP
} from '../daisy-chain-tree-view.js';
import { TRANSLATIONS } from '../nav-language.js';
import { canonicalMohalla } from '../phase3.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

function customer(id, num, name, extra = {}) {
  return {
    id,
    customerNumber: num,
    name,
    mohalla: 'BARRIAN',
    area: '',
    splitterBoxId: '',
    splitterPort: null,
    upstreamCustomerId: '',
    archived: false,
    ...extra
  };
}

// Root R feeds A, A feeds B, B feeds C — all on box DB-01 in BARRIAN.
function deepChain() {
  return [
    customer('cust-r', 1, 'Test Root', { splitterBoxId: 'DB-01' }),
    customer('cust-a', 2, 'Test Home A', { splitterBoxId: 'DB-01', upstreamCustomerId: 'cust-r' }),
    customer('cust-b', 3, 'Test Home B', { splitterBoxId: 'DB-01', upstreamCustomerId: 'cust-a' }),
    customer('cust-c', 4, 'Test Home C', { splitterBoxId: 'DB-01', upstreamCustomerId: 'cust-b' })
  ];
}

function onlyBox(tree) {
  assert.equal(tree.zones.length, 1, 'one zone');
  assert.equal(tree.zones[0].boxes.length, 1, 'one box');
  return tree.zones[0].boxes[0];
}

function rowsByCustomer(html) {
  const rows = {};
  for (const m of html.matchAll(/<button[^>]*data-daisy-customer="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)) {
    rows[m[1]] = m[2];
  }
  return rows;
}

test('tree construction: hops 1-4 assigned, Hop >= 3 flagged deep', () => {
  assert.equal(DEEP_CHAIN_MIN_HOP, 3);
  const tree = buildDaisyChainTree({ customers: deepChain() });
  const box = onlyBox(tree);
  assert.equal(box.boxId, 'DB-01');
  assert.equal(box.roots.length, 1);
  const r = box.roots[0];
  assert.equal(r.id, 'cust-r');
  assert.equal(r.hop, 1);
  assert.equal(r.deepChain, false);
  const a = r.children[0];
  assert.equal(a.id, 'cust-a');
  assert.equal(a.hop, 2);
  assert.equal(a.deepChain, false);
  const b = a.children[0];
  assert.equal(b.id, 'cust-b');
  assert.equal(b.hop, 3);
  assert.equal(b.deepChain, true);
  const c = b.children[0];
  assert.equal(c.id, 'cust-c');
  assert.equal(c.hop, 4);
  assert.equal(c.deepChain, true);
  assert.deepEqual(tree.totals, {
    placed: 4, roots: 1, deepChain: 2, cycleLinks: 0, cycleRoots: 0, archived: 0, maxHop: 4
  });
});

test('tree construction: two roots share one box, children in number order', () => {
  const customers = [
    customer('cust-r2', 10, 'Test Root Two', { splitterBoxId: 'DB-02' }),
    customer('cust-r1', 5, 'Test Root One', { splitterBoxId: 'DB-02' }),
    customer('cust-k2', 9, 'Test Kid Two', { splitterBoxId: 'DB-02', upstreamCustomerId: 'cust-r1' }),
    customer('cust-k1', 7, 'Test Kid One', { splitterBoxId: 'DB-02', upstreamCustomerId: 'cust-r1' })
  ];
  const box = onlyBox(buildDaisyChainTree({ customers }));
  assert.deepEqual(box.roots.map((n) => n.id), ['cust-r1', 'cust-r2']);
  assert.deepEqual(box.roots[0].children.map((n) => n.id), ['cust-k1', 'cust-k2']);
});

test('tree construction: box-less root lands in the honest no-box bucket', () => {
  const tree = buildDaisyChainTree({ customers: [customer('cust-x', 1, 'Test Lonely')] });
  const box = onlyBox(tree);
  assert.equal(box.boxId, '');
  assert.equal(box.roots[0].id, 'cust-x');
  const html = renderDaisyChainTreeHtml(tree, 'en');
  assert.ok(html.includes('No splitter box recorded'), 'no-box label renders');
});

test('tree construction: dangling upstream becomes a marked root, never a crash', () => {
  const customers = [
    customer('cust-d', 1, 'Test Dangling', { upstreamCustomerId: 'cust-ghost' }),
    customer('cust-e', 2, 'Test Below', { upstreamCustomerId: 'cust-d' })
  ];
  const tree = buildDaisyChainTree({ customers });
  const box = onlyBox(tree);
  assert.equal(box.roots.length, 1);
  assert.equal(box.roots[0].id, 'cust-d');
  assert.equal(box.roots[0].danglingUpstream, true);
  assert.equal(box.roots[0].children[0].id, 'cust-e');
  assert.equal(tree.totals.placed, 2);
});

test('zones: mohalla variants fold into one canonical zone, zones in canonical order', () => {
  const customers = [
    customer('cust-bani', 1, 'Test Bani', { mohalla: 'Mohalla Bani' }),
    customer('cust-bani2', 2, 'Test Bani Two', { mohalla: 'BANII' }),
    customer('cust-char', 3, 'Test Charyaa', { mohalla: 'CHARYAA' })
  ];
  const tree = buildDaisyChainTree({ customers });
  assert.equal(tree.zones.length, 2, 'Bani variants share one zone');
  const baniiKey = canonicalMohalla('BANII').key;
  const baniZone = tree.zones.find((z) => z.zoneKey === baniiKey);
  assert.ok(baniZone, 'canonical BANII zone exists');
  assert.equal(baniZone.boxes[0].roots.length, 2);
  assert.equal(tree.zones[0].zoneKey, canonicalMohalla('CHARYAA').key, 'canonical order: CHARYAA before BANII');
});

test('cycle detection: A<->B loop terminates, flagged, nothing vanishes', () => {
  const customers = [
    customer('cust-a', 1, 'Test Loop A', { upstreamCustomerId: 'cust-b' }),
    customer('cust-b', 2, 'Test Loop B', { upstreamCustomerId: 'cust-a' })
  ];
  const tree = buildDaisyChainTree({ customers });
  assert.equal(tree.totals.placed, 2, 'both members placed exactly once');
  assert.equal(tree.totals.cycleRoots, 1);
  assert.equal(tree.totals.cycleLinks, 1);
  const box = onlyBox(tree);
  assert.equal(box.roots.length, 1);
  const rootNode = box.roots[0];
  assert.equal(rootNode.id, 'cust-a', 'rooted at the lowest customerNumber');
  assert.equal(rootNode.cycleRoot, true);
  const b = rootNode.children[0];
  assert.equal(b.id, 'cust-b');
  assert.equal(b.hop, 2);
  const backLink = b.children[0];
  assert.equal(backLink.id, 'cust-a');
  assert.equal(backLink.cycle, true);
  assert.deepEqual(backLink.children, [], 'cycle node never expands');
});

test('cycle detection: self-loop flagged; real children still placed below', () => {
  const customers = [
    customer('cust-s', 1, 'Test Self', { upstreamCustomerId: 'cust-s' }),
    customer('cust-k', 2, 'Test Kid', { upstreamCustomerId: 'cust-s' })
  ];
  const tree = buildDaisyChainTree({ customers });
  assert.equal(tree.totals.placed, 2);
  const box = onlyBox(tree);
  const rootNode = box.roots[0];
  assert.equal(rootNode.cycleRoot, true);
  const kinds = rootNode.children.map((n) => `${n.id}:${n.cycle ? 'cycle' : 'ok'}`);
  assert.deepEqual(kinds, ['cust-s:cycle', 'cust-k:ok']);
});

test('cycle detection: in-feeding tree of a rootless cycle is fully placed', () => {
  const customers = [
    customer('cust-a', 1, 'Test Loop A', { upstreamCustomerId: 'cust-b' }),
    customer('cust-b', 2, 'Test Loop B', { upstreamCustomerId: 'cust-a' }),
    customer('cust-d', 3, 'Test Fed By Loop', { upstreamCustomerId: 'cust-a' })
  ];
  const tree = buildDaisyChainTree({ customers });
  assert.equal(tree.totals.placed, 3);
  const rootNode = onlyBox(tree).roots[0];
  assert.deepEqual(rootNode.children.map((n) => n.id), ['cust-b', 'cust-d']);
});

test('archived middle home renders in place and never orphans downstream', () => {
  const customers = [
    customer('cust-r', 1, 'Test Root'),
    customer('cust-m', 2, 'Test Middle', { upstreamCustomerId: 'cust-r', archived: true }),
    customer('cust-l', 3, 'Test Leaf', { upstreamCustomerId: 'cust-m' })
  ];
  const tree = buildDaisyChainTree({ customers });
  const rootNode = onlyBox(tree).roots[0];
  const middle = rootNode.children[0];
  assert.equal(middle.archived, true);
  assert.equal(middle.children[0].id, 'cust-l', 'active leaf stays nested under the archived home');
  assert.equal(tree.totals.archived, 1);
  const rows = rowsByCustomer(renderDaisyChainTreeHtml(tree, 'en'));
  assert.ok(rows['cust-m'].includes('Archived'), 'archived chip renders');
});

test('hop-depth badge rendering: warning on Hop 3 rows, absent on Hop 2 rows', () => {
  const tree = buildDaisyChainTree({ customers: deepChain() });
  const html = renderDaisyChainTreeHtml(tree, 'en');
  const rows = rowsByCustomer(html);
  assert.ok(rows['cust-b'].includes('⚠️ Deep Chain (Hop 3+) — Recommend Direct Drop'), 'hop 3 row carries the spec warning');
  assert.ok(rows['cust-c'].includes('⚠️ Deep Chain (Hop 3+) — Recommend Direct Drop'), 'hop 4 row carries the spec warning');
  assert.ok(!rows['cust-a'].includes('Deep Chain'), 'hop 2 row has no deep warning');
  assert.ok(!rows['cust-r'].includes('Deep Chain'), 'hop 1 row has no deep warning');
  assert.ok(rows['cust-a'].includes('Hop 2'), 'hop badge renders');
  const urdu = renderDaisyChainTreeHtml(tree, 'ur');
  assert.ok(urdu.includes('گہری چین'), 'Urdu warning renders');
});

test('cycle rendering: circular markers appear in the HTML', () => {
  const customers = [
    customer('cust-a', 1, 'Test Loop A', { upstreamCustomerId: 'cust-b' }),
    customer('cust-b', 2, 'Test Loop B', { upstreamCustomerId: 'cust-a' })
  ];
  const html = renderDaisyChainTreeHtml(buildDaisyChainTree({ customers }), 'en');
  assert.ok(html.includes('Circular feeder link'), 'back-link marker renders');
  assert.ok(html.includes('Circular chain'), 'cycle-root marker renders');
});

test('indent cap: very deep rows stop indenting at the cap hop', () => {
  const customers = [customer('cust-0', 1, 'Test Deep Root')];
  for (let i = 1; i <= 8; i += 1) {
    customers.push(customer(`cust-${i}`, i + 1, `Test Deep ${i}`, { upstreamCustomerId: `cust-${i - 1}` }));
  }
  const html = renderDaisyChainTreeHtml(buildDaisyChainTree({ customers }), 'en');
  assert.ok(html.includes(`--hop:${DAISY_INDENT_CAP_HOP}`), 'deepest rows use the capped indent');
  assert.ok(!html.includes('--hop:9'), 'no row indents past the cap');
});

test('purity: building and rendering mutate nothing', () => {
  const state = { customers: deepChain() };
  const before = JSON.stringify(state);
  const tree = buildDaisyChainTree(state);
  renderDaisyChainTreeHtml(tree, 'en');
  renderDaisyChainTreeHtml(tree, 'ur');
  assert.equal(JSON.stringify(state), before, 'input state byte-identical');
});

test('empty state: no customers renders the honest empty note', () => {
  const tree = buildDaisyChainTree({ customers: [] });
  assert.equal(tree.totals.placed, 0);
  assert.deepEqual(tree.zones, []);
  const html = renderDaisyChainTreeHtml(tree, 'en');
  assert.ok(html.includes('No feeder chains recorded yet'), 'empty note renders');
});

test('i18n audit: every key the module and surfaces use exists in en AND ur', () => {
  const moduleSource = read('daisy-chain-tree-view.js');
  const keys = new Set();
  for (const m of moduleSource.matchAll(/t\('([a-z0-9_]+)'/g)) keys.add(m[1]);
  for (const m of read('app.js').matchAll(/t\('(dash_daisychain_[a-z0-9_]+)'/g)) keys.add(m[1]);
  const html = read('index.html');
  for (const m of html.matchAll(/data-i18n="(dash_card_daisychain|daisychain_title)"/g)) keys.add(m[1]);
  assert.ok(keys.size >= 15, `expected 15+ audited keys, found ${keys.size}`);
  for (const key of keys) {
    for (const lang of ['en', 'ur']) {
      assert.equal(typeof TRANSLATIONS[lang][key], 'string', `${key} missing in ${lang}`);
      assert.ok(TRANSLATIONS[lang][key].length > 0, `${key} empty in ${lang}`);
    }
    const enParams = [...TRANSLATIONS.en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const urParams = [...TRANSLATIONS.ur[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(urParams, enParams, `${key} placeholder parity en/ur`);
  }
});

test('wiring: app.js-only import, dialog + card present, CSS token-only', () => {
  const app = read('app.js');
  assert.ok(app.includes("from './daisy-chain-tree-view.js'"), 'app.js imports the module');
  assert.ok(app.includes('setupDaisyChainTreeModal('), 'app.js sets the controller up');
  assert.ok(app.includes('daisyChainTreeModalController'), 'controller exported');
  const build = read('build.mjs');
  const entryLine = build.split('\n').find((line) => line.includes('ENTRY_FILES'));
  assert.ok(entryLine && !entryLine.includes('daisy-chain-tree-view.js'), 'module is NOT a build entry (dist budget)');
  const html = read('index.html');
  assert.ok(html.includes('id="daisyChainTreeModal"'), 'dialog present');
  assert.ok(html.includes('id="daisyChainTreeCloseBtn" class="modal-close"'), 'shared close button');
  assert.ok(html.includes('id="openDaisyChainTreeModalBtn"'), 'open button present');
  assert.ok(html.includes('id="dashboardDaisyChainValue"'), 'dashboard card present');
  const css = read('components.css');
  const block = css.slice(css.indexOf('/* SISP-157'), css.indexOf('/* SISP-157') + 2200);
  assert.ok(block.includes('.daisy-node'), 'tree styles present');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hex colours in the SISP-157 CSS block');
  assert.ok(!read('nav.css').includes('daisy'), 'nav.css untouched by this feature');
});
