import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');

// HOTFIX regression (2026-10-29): mountCustomerProfileContent() moves the
// static profile blocks out of #profileContentMounts into the tab panels and
// then removes the mounts container. The uptime feature added a SECOND
// '.incident-section' (the '.uptime-section') BEFORE the complaints/incident
// editor section, so the complaints group's '.incident-section' selector
// matched the uptime section (querySelector = first match) and the editor
// section — holding #addIncidentButton / #incidentForm /
// #cancelIncidentEditButton — was deleted with the mounts container. The
// top-level bindings for those elements then threw
// "Cannot read properties of null (reading 'addEventListener')" during app
// boot, aborting the rest of initialisation (dead buttons, zeroed dashboard).
// These tests simulate the mount algorithm against the real markup so the
// collision can never silently return.

// --- Extract the top-level children of #profileContentMounts, in order. ---
function mountsChildren(html) {
  const start = html.indexOf('id="profileContentMounts"');
  assert.ok(start >= 0, 'profileContentMounts exists in index.html');
  const openEnd = html.indexOf('>', start);
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  tagRe.lastIndex = openEnd + 1;
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  let depth = 1;
  let current = null;
  const children = [];
  let m;
  while ((m = tagRe.exec(html))) {
    const [, closing, tag, attrs] = m;
    const selfClosing = VOID.has(tag.toLowerCase()) || /\/\s*$/.test(attrs);
    if (!closing) {
      if (depth === 1) {
        current = {
          tag: tag.toLowerCase(),
          id: (attrs.match(/id="([^"]+)"/) || [])[1] ?? null,
          classes: ((attrs.match(/class="([^"]+)"/) || [])[1] ?? '').split(/\s+/).filter(Boolean),
          innerIds: []
        };
        children.push(current);
      } else if (current) {
        const id = (attrs.match(/id="([^"]+)"/) || [])[1];
        if (id) current.innerIds.push(id);
      }
      if (!selfClosing) depth++;
    } else {
      depth--;
      if (depth === 1) current = null;
      if (depth === 0) break;
    }
  }
  return children;
}

// --- Extract the mount groups from app.js, preserving order. ---
function mountGroups(appJs) {
  const fnStart = appJs.indexOf('function mountCustomerProfileContent()');
  assert.ok(fnStart >= 0, 'mountCustomerProfileContent exists');
  const block = appJs.slice(fnStart, appJs.indexOf('};', fnStart) + 2);
  const groups = [];
  for (const m of block.matchAll(/(\w+):\[([^\]]*)\]/g)) {
    groups.push([m[1], [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1])]);
  }
  assert.ok(groups.length >= 3, 'mount groups parsed');
  return groups;
}

function matchesSelector(el, selector) {
  const notMatch = selector.match(/:not\(\.([\w-]+)\)/);
  const base = selector.replace(/:not\(\.[\w-]+\)/, '');
  let ok;
  if (base.startsWith('#')) ok = el.id === base.slice(1);
  else if (base.startsWith('.')) ok = el.classes.includes(base.slice(1));
  else ok = false;
  if (ok && notMatch) ok = !el.classes.includes(notMatch[1]);
  return ok;
}

function simulateMount(children, groups) {
  const remaining = [...children];
  const panels = {};
  for (const [name, selectors] of groups) {
    panels[name] = [];
    for (const selector of selectors) {
      const idx = remaining.findIndex(el => matchesSelector(el, selector));
      if (idx >= 0) panels[name].push(remaining.splice(idx, 1)[0]);
    }
  }
  return { panels, remaining };
}

test('profile mount: incident editor section lands in the complaints panel, not the deleted mounts', () => {
  const children = mountsChildren(index);
  const { panels } = simulateMount(children, mountGroups(app));
  const editor = children.find(el => el.innerIds.includes('addIncidentButton'));
  assert.ok(editor, 'a mounts child contains #addIncidentButton');
  assert.ok(panels.complaints.includes(editor),
    'the section containing #addIncidentButton / #incidentForm must be mounted into the complaints panel');
  assert.ok(editor.innerIds.includes('incidentForm') && editor.innerIds.includes('cancelIncidentEditButton'),
    'editor section carries the whole incident form');
});

test('profile mount: uptime section lands in the info panel', () => {
  const children = mountsChildren(index);
  const { panels } = simulateMount(children, mountGroups(app));
  const uptime = children.find(el => el.innerIds.includes('uptimeSummaryBody'));
  assert.ok(uptime, 'a mounts child contains #uptimeSummaryBody');
  assert.ok(panels.info.includes(uptime),
    'the uptime section must be mounted into the info panel, not stolen by the complaints group');
});

test('profile mount: every mounts child is claimed by a panel (mounts.remove() deletes nothing)', () => {
  const children = mountsChildren(index);
  const { remaining } = simulateMount(children, mountGroups(app));
  assert.deepEqual(remaining.map(el => `${el.tag}#${el.id ?? ''}.${el.classes.join('.')}`), [],
    'no profile block may be left inside #profileContentMounts when it is removed');
});

test('incident editor bindings cannot kill app boot if the elements are ever missing again', () => {
  assert.match(app, /\$\('#addIncidentButton'\)\?\.addEventListener/);
  assert.match(app, /\$\('#incidentForm'\)\?\.addEventListener/);
  assert.match(app, /\$\('#cancelIncidentEditButton'\)\?\.addEventListener/);
});

// =====================================================================
// SISP-192 EXTENSION (2026-10-30): DOM mount & selector collision guard
// across ALL profile tabs and dashboard sections (PR #486 extension).
//
// Audit summary (current main, verified by the instrumented simulation
// in this file): mountCustomerProfileContent() in app.js is the ONLY
// pass in the whole app that reparents shipped static markup and then
// deletes its container:
//   * index.html has exactly one mounts container
//     (#profileContentMounts); no other JS file references it.
//   * screen-router.js inserts only a createElement() header, and the
//     dialog modules (bulk-collect.js, collect-setup.js,
//     customer-import.js) move nodes parsed from their OWN template
//     strings — never shipped markup.
//   * Dashboard/home sections are rendered in place; there is no
//     dashboard mounts container (pinned by the census test below).
// The PR #486 tests above simulate the mount at the TOP LEVEL only.
// That misses the real semantics of mounts.querySelector(): it is a
// DEEP, document-order search, so a selector can also match a
// DESCENDANT inside another group's section and rip it out of that
// section. The extended guard below models querySelector faithfully
// and pins, for the real markup and the real selectors parsed out of
// app.js:
//   1. every selector's match is a top-level mounts child ITSELF
//      (no descendant steals);
//   2. selector match sets are pairwise disjoint across groups — the
//      outcome no longer depends on group execution order;
//   3. every mounts child is claimed exactly once, so mounts.remove()
//      deletes nothing;
//   4. 100% survival of the protected form controllers (below), each
//      in its expected tab panel;
//   5. zero boot-abort risk: every mount group has a profileTabMap
//      entry and every tab/panel id exists in the markup (a missing
//      one makes the real code throw a TypeError while booting);
//   6. no dead selectors: a selector that matches nothing inside the
//      mounts means its section silently never reaches its tab — the
//      one documented exception is '#historyContainer' (see below).
// Three canaries at the bottom prove the guard can actually FAIL: the
// PR #480 selector regression, a duplicate-section accident, and a
// descendant-stealing selector.
//
// PROTECTED FORM CONTROLLERS (real ids from the shipped markup):
// Inside #profileContentMounts (mount-endangered):
//   #customerProfileForm (+ #saveMohallaButton /
//     #cancelProfileEditButton and the deposit field
//     #securityDepositInput) — info panel;
//   #incidentForm (+ #addIncidentButton / #incidentSubmitButton /
//     #cancelIncidentEditButton) — complaints panel;
//   #uptimeMonthSelect / #uptimeSummaryBody (Uptime) — info panel;
//   #customerProfileView — info panel: the render container into
//     which app.js injects the Referral, Custody and Deposit
//     Settlement sections on every profile render (they are NOT
//     static markup, so their survival rides on this container);
//   #customerExportButton — billing panel.
// Outside the mounts (the mount can never reach them; pinned to exist
// exactly once and outside the mounts subtree):
//   #quickCollectPaymentForm (Quick Collect dialog),
//   #advancePaymentForm (Advance Payment dialog),
//   #equipmentRetrievalForm (hardware custody / retrieval screen).
// Boot-critical note: $('#saveMohallaButton') and
// $('#customerExportButton') are bound at top level WITHOUT optional
// chaining, so survival of their sections is exactly what keeps app
// boot alive — the same failure mode as the PR #486 incident
// bindings.
// =====================================================================

// --- Extended parser: mounts children WITH full descendant lists. ---
function mountsTree(html) {
  const start = html.indexOf('id="profileContentMounts"');
  assert.ok(start >= 0, 'profileContentMounts exists in index.html');
  const openEnd = html.indexOf('>', start);
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  tagRe.lastIndex = openEnd + 1;
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const nodeOf = (tag, attrs) => ({
    tag: tag.toLowerCase(),
    id: (attrs.match(/id="([^"]+)"/) || [])[1] ?? null,
    classes: ((attrs.match(/class="([^"]+)"/) || [])[1] ?? '').split(/\s+/).filter(Boolean)
  });
  let depth = 1;
  let current = null;
  const children = [];
  let m;
  while ((m = tagRe.exec(html))) {
    const [, closing, tag, attrs] = m;
    const selfClosing = VOID.has(tag.toLowerCase()) || /\/\s*$/.test(attrs);
    if (!closing) {
      if (depth === 1) {
        current = { ...nodeOf(tag, attrs), descendants: [] };
        children.push(current);
      } else if (current) {
        current.descendants.push(nodeOf(tag, attrs));
      }
      if (!selfClosing) depth++;
    } else {
      depth--;
      if (depth === 1) current = null;
      if (depth === 0) break;
    }
  }
  for (const child of children) {
    child.innerIds = child.descendants.map(d => d.id).filter(Boolean);
    child.label = child.id ? `#${child.id}` : `.${child.classes.join('.')}`;
  }
  return children;
}

// --- Extract profileTabMap (group -> [tabId, panelId]) from app.js. ---
function profileTabMap(appJs) {
  const start = appJs.indexOf('const profileTabMap = {');
  assert.ok(start >= 0, 'profileTabMap exists in app.js');
  const block = appJs.slice(start, appJs.indexOf('};', start) + 2);
  const map = {};
  for (const m of block.matchAll(/(\w+):\['([^']+)','([^']+)'\]/g)) map[m[1]] = [m[2], m[3]];
  assert.ok(Object.keys(map).length >= 3, 'profileTabMap parsed');
  return map;
}

const allDocumentIds = html => new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
const countId = (html, id) => [...html.matchAll(new RegExp(` id="${id}"`, 'g'))].length;

// Faithful model of mounts.querySelector: deep, document order, first
// match — within each child the child itself is tested before its
// descendants. `gone` holds descendant nodes already ripped out by an
// earlier selector (the real mount removes them from the mounts tree).
function deepFirstMatch(remaining, selector, gone) {
  for (const child of remaining) {
    if (matchesSelector(child, selector)) return { child, node: child, self: true };
    const hit = child.descendants.find(d => !gone.has(d) && matchesSelector(d, selector));
    if (hit) return { child, node: hit, self: false };
  }
  return null;
}

// Faithful simulation of mountCustomerProfileContent(): groups run in
// source order; a group with no tab-map entry or a missing panel makes
// the real code throw (boot abort), modelled as an error + stop.
function faithfulMount(children, groups, tabMap, docIds) {
  const remaining = [...children];
  const gone = new Set();
  const panels = {};
  const steals = [];
  const errors = [];
  for (const [name, selectors] of groups) {
    const entry = tabMap[name];
    if (!entry) { errors.push(`group "${name}" has no profileTabMap entry — profileTabMap[name][1] would throw a TypeError and abort app boot`); break; }
    if (!docIds.has(entry[1])) { errors.push(`panel #${entry[1]} for group "${name}" is missing from index.html — panel.append would throw a TypeError and abort app boot`); break; }
    panels[name] = [];
    for (const selector of selectors) {
      const hit = deepFirstMatch(remaining, selector, gone);
      if (!hit) continue;
      if (hit.self) {
        panels[name].push(hit.child);
        remaining.splice(remaining.indexOf(hit.child), 1);
      } else {
        steals.push({ group: name, selector, node: hit.node, fromChild: hit.child });
        gone.add(hit.node);
      }
    }
  }
  return { panels, remaining, steals, errors };
}

// Selectors allowed to match nothing inside the mounts.
// '#historyContainer' is claimed by the billing group but the element
// deliberately lives OUTSIDE #profileContentMounts (a sibling right
// after it in the profile pane, rendered in place regardless of tab),
// so its selector is a documented no-op. If it is ever moved inside
// the mounts, the normal claim rules apply to it automatically.
const NO_MATCH_ALLOWED = new Set(['#historyContainer']);

// Protected form controllers inside the mounts, with the tab panel
// each must land in. Ids verified against the shipped index.html.
const PROTECTED_IN_MOUNTS = [
  ['customerProfileForm', 'info'],
  ['saveMohallaButton', 'info'],
  ['cancelProfileEditButton', 'info'],
  ['securityDepositInput', 'info'],
  ['customerProfileView', 'info'],
  ['uptimeMonthSelect', 'info'],
  ['uptimeSummaryBody', 'info'],
  ['packageHistoryList', 'info'],
  ['customerReceiptSummary', 'billing'],
  ['customerExportButton', 'billing'],
  ['customerEmptyNote', 'billing'],
  ['addIncidentButton', 'complaints'],
  ['incidentForm', 'complaints'],
  ['incidentSubmitButton', 'complaints'],
  ['cancelIncidentEditButton', 'complaints']
];

// Protected form controllers that live OUTSIDE the mounts subtree.
const PROTECTED_OUTSIDE_MOUNTS = [
  'quickCollectPaymentForm',
  'advancePaymentForm',
  'equipmentRetrievalForm'
];

// The full invariant set. Returns violation strings; [] means the
// mount is provably safe. Canary tests feed doctored inputs and
// expect violations, proving the guard can fail.
function mountViolations(children, groups, tabMap, docIds) {
  const violations = [];
  const { panels, remaining, steals, errors } = faithfulMount(children, groups, tabMap, docIds);
  violations.push(...errors);
  for (const s of steals) {
    violations.push(`descendant steal: ${s.group} selector "${s.selector}" matches ${s.node.id ? `#${s.node.id}` : `.${s.node.classes.join('.')}`} INSIDE ${s.fromChild.label} — the mount would rip it out of its own section`);
  }
  for (const child of remaining) {
    violations.push(`unclaimed mounts child ${child.label} would be DELETED by mounts.remove() (it carries: ${child.innerIds.slice(0, 4).join(', ') || 'no ids'})`);
  }
  // Disjointness: no child (itself or any descendant) may be matched
  // by selectors from two different groups — otherwise group order
  // decides who steals it, which is exactly how PR #480 broke the
  // app.
  for (const child of children) {
    const matchedBy = new Set();
    for (const [name, selectors] of groups) {
      if (selectors.some(sel => matchesSelector(child, sel) || child.descendants.some(d => matchesSelector(d, sel)))) matchedBy.add(name);
    }
    if (matchedBy.size > 1) {
      violations.push(`selector overlap: ${child.label} is matched by selectors from ${[...matchedBy].join(' + ')} — the mount outcome depends on group execution order`);
    }
  }
  // Dead selectors: a group selector matching nothing inside the
  // mounts means the section it should move never reaches its tab.
  for (const [name, selectors] of groups) {
    for (const sel of selectors) {
      if (NO_MATCH_ALLOWED.has(sel)) continue;
      const any = children.some(c => matchesSelector(c, sel) || c.descendants.some(d => matchesSelector(d, sel)));
      if (!any) violations.push(`dead selector: ${name} selector "${sel}" matches nothing inside #profileContentMounts — its section would silently never reach the ${name} panel`);
    }
  }
  // Survival of the protected controllers that live inside the
  // mounts.
  for (const [id, expectedGroup] of PROTECTED_IN_MOUNTS) {
    const owner = children.find(c => c.id === id || c.innerIds.includes(id));
    if (!owner) { violations.push(`protected controller #${id} is not inside #profileContentMounts at all`); continue; }
    const claimedBy = Object.entries(panels).find(([, list]) => list.includes(owner))?.[0];
    if (claimedBy !== expectedGroup) {
      violations.push(`protected controller #${id} (inside ${owner.label}) must land in the ${expectedGroup} panel, but ${claimedBy ? `it landed in ${claimedBy}` : 'its section was never claimed'}`);
    }
    if (steals.some(s => s.node.id === id)) {
      violations.push(`protected controller #${id} is ripped out of its section by a descendant-matching selector`);
    }
  }
  return violations;
}

test('mount census: exactly one mounts container, one mount pass, one container remove', () => {
  assert.equal(countId(index, 'profileContentMounts'), 1, 'exactly one #profileContentMounts in index.html');
  const mountsIds = [...index.matchAll(/ id="([^"]*Mounts)"/g)].map(m => m[1]);
  assert.deepEqual(mountsIds, ['profileContentMounts'], 'no other mounts container (e.g. a dashboard mount) exists in the markup');
  assert.equal([...app.matchAll(/function mountCustomerProfileContent\(\)/g)].length, 1, 'mount pass defined once');
  assert.equal([...app.matchAll(/mountCustomerProfileContent\(\);/g)].length, 1, 'mount pass runs exactly once at boot');
  assert.equal([...app.matchAll(/mounts\.remove\(\)/g)].length, 1, 'exactly one container remove, inside the mount pass');
  for (const file of readdirSync(new URL('../', import.meta.url)).filter(f => f.endsWith('.js'))) {
    if (file === 'app.js') continue;
    assert.ok(!read(file).includes('profileContentMounts'), `${file} must not reference the profile mounts container — app.js owns the only mount pass`);
  }
});

test('profile mount: groups and profileTabMap agree, and every tab and panel exists (zero TypeError)', () => {
  const groups = mountGroups(app);
  const tabMap = profileTabMap(app);
  assert.deepEqual(groups.map(([name]) => name).sort(), Object.keys(tabMap).sort(),
    'every mount group needs a profileTabMap entry and vice versa, or the real mount throws while booting');
  const docIds = allDocumentIds(index);
  for (const [name, [tabId, panelId]] of Object.entries(tabMap)) {
    assert.ok(docIds.has(tabId), `tab button #${tabId} (${name}) exists in index.html — activateProfileTab and the top-level tab bindings dereference it without optional chaining`);
    assert.ok(docIds.has(panelId), `panel #${panelId} (${name}) exists in index.html`);
  }
});

test('profile mount: faithful deep-querySelector simulation — every child claimed on itself, zero errors', () => {
  const children = mountsTree(index);
  const { panels, remaining, steals, errors } = faithfulMount(children, mountGroups(app), profileTabMap(app), allDocumentIds(index));
  assert.deepEqual(errors, [], 'no boot-abort (TypeError) conditions in the mount');
  assert.deepEqual(steals, [], 'no selector may match a descendant inside another section (deep querySelector steal)');
  assert.deepEqual(remaining.map(c => c.label), [], 'mounts.remove() deletes nothing');
  const placement = Object.fromEntries(Object.entries(panels).map(([k, v]) => [k, v.map(c => c.label)]));
  assert.deepEqual(placement, {
    billing: ['#customerReceiptSummary', '#manualBaqayaSection', '.ledger-heading', '.notice.history-retention-note', '#customerEmptyNote'],
    info: ['.customer-meta', '.package-history-section', '.incident-section.uptime-section'],
    complaints: ['.incident-section']
  }, 'every mounts child lands in its expected tab panel, in mount order');
});

test('profile mount: selector match sets are pairwise disjoint across groups (order-independent)', () => {
  const children = mountsTree(index);
  const groups = mountGroups(app);
  for (const child of children) {
    const matchedBy = groups
      .filter(([, selectors]) => selectors.some(sel => matchesSelector(child, sel) || child.descendants.some(d => matchesSelector(d, sel))))
      .map(([name]) => name);
    assert.equal(matchedBy.length, 1, `${child.label} must be matched by exactly one group (its owner), got ${matchedBy.join(' + ') || 'none'} — the mount outcome must never depend on group execution order`);
  }
});

test('profile mount: full invariant set holds on the real markup (SISP-192 guard)', () => {
  const violations = mountViolations(mountsTree(index), mountGroups(app), profileTabMap(app), allDocumentIds(index));
  assert.deepEqual(violations, []);
});

test('profile mount: 100% survival of protected form controllers inside the mounts', () => {
  const children = mountsTree(index);
  const { panels } = faithfulMount(children, mountGroups(app), profileTabMap(app), allDocumentIds(index));
  for (const [id, expectedGroup] of PROTECTED_IN_MOUNTS) {
    const owner = children.find(c => c.id === id || c.innerIds.includes(id));
    assert.ok(owner, `#${id} is inside #profileContentMounts`);
    assert.ok(panels[expectedGroup]?.includes(owner), `#${id} (inside ${owner.label}) survives into the ${expectedGroup} panel`);
  }
  // The Referral, Custody and Deposit Settlement sections are
  // rendered into #customerProfileView on every profile render — pin
  // that the render still targets the surviving container.
  assert.match(app, /\$\('#customerProfileView'\)\.innerHTML = `[\s\S]*?\$\{referralSectionHtml\}/, 'referral section renders into #customerProfileView');
  assert.match(app, /\$\('#customerProfileView'\)\.innerHTML = `[\s\S]*?\$\{custodySectionHtml\}/, 'custody section renders into #customerProfileView');
  assert.match(app, /\$\('#customerProfileView'\)\.innerHTML = `[\s\S]*?\$\{depositSettlementHtml\}/, 'deposit settlement renders into #customerProfileView');
});

test('profile mount: form controllers outside the mounts exist exactly once and stay out of reach', () => {
  const children = mountsTree(index);
  const insideIds = new Set(children.flatMap(c => [c.id, ...c.innerIds]).filter(Boolean));
  for (const id of PROTECTED_OUTSIDE_MOUNTS) {
    assert.equal(countId(index, id), 1, `#${id} exists exactly once in index.html`);
    assert.ok(!insideIds.has(id), `#${id} must stay outside #profileContentMounts, where mounts.remove() can never delete it`);
  }
  // Static-form census: #incidentForm is the ONLY static <form>
  // inside the mounts subtree; #customerProfileForm is a div-based
  // controller.
  const formIdsInside = children.flatMap(c => [
    ...(c.tag === 'form' && c.id ? [c.id] : []),
    ...c.descendants.filter(d => d.tag === 'form' && d.id).map(d => d.id)
  ]);
  assert.deepEqual(formIdsInside, ['incidentForm'], 'only #incidentForm is a static <form> inside the mounts');
  assert.equal(countId(index, 'historyContainer'), 1, '#historyContainer exists (outside the mounts, rendered in place)');
  assert.ok(!insideIds.has('historyContainer'), '#historyContainer stays outside #profileContentMounts — its billing selector is a documented no-op');
});

test('canary: reverting the complaints selector to plain .incident-section (the PR #480 accident) fails the guard', () => {
  const groups = mountGroups(app).map(([name, selectors]) =>
    name === 'complaints' ? [name, ['.incident-section']] : [name, selectors]);
  const violations = mountViolations(mountsTree(index), groups, profileTabMap(app), allDocumentIds(index));
  assert.ok(violations.length > 0, 'the guard must fail if the complaints selector ever loses its :not(.uptime-section) scoping');
  assert.ok(violations.some(v => /overlap|steal|uptime/i.test(v)), `violations must name the uptime collision, got: ${violations.join(' | ')}`);
});

test('canary: a duplicate .incident-section inserted before the editor fails the guard', () => {
  const children = mountsTree(index);
  const editorIdx = children.findIndex(c => c.innerIds.includes('incidentForm'));
  assert.ok(editorIdx >= 0, 'editor section located');
  const fake = {
    tag: 'section', id: null, classes: ['incident-section'],
    descendants: [{ tag: 'form', id: 'fakeIncidentForm', classes: [] }],
    innerIds: ['fakeIncidentForm'], label: '.incident-section (duplicate)'
  };
  const doctored = [...children.slice(0, editorIdx), fake, ...children.slice(editorIdx)];
  const violations = mountViolations(doctored, mountGroups(app), profileTabMap(app), allDocumentIds(index));
  assert.ok(violations.some(v => v.includes('#incidentForm') || v.includes('DELETED')), `the guard must catch the real editor being deleted, got: ${violations.join(' | ')}`);
});

test('canary: a selector that matches a descendant inside another section fails the guard', () => {
  const groups = mountGroups(app).map(([name, selectors]) =>
    name === 'billing' ? [name, [...selectors, '#incidentForm']] : [name, selectors]);
  const violations = mountViolations(mountsTree(index), groups, profileTabMap(app), allDocumentIds(index));
  assert.ok(violations.some(v => v.includes('descendant steal') && v.includes('#incidentForm')), `the guard must catch a descendant steal of #incidentForm, got: ${violations.join(' | ')}`);
});
