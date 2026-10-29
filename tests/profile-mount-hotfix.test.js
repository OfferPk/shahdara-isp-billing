import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
