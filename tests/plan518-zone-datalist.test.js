import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { zonesUnderArea } from '../zone-suggestions.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Plan 518 — Zone gets the same suggestions Area has: Area has a
// datalist (#mohallaInput + #mohallaOptions) but Zone (#zoneInput) was
// a bare free-text input, so operators typed zone names freehand and
// the same zone got spelled several ways. The fix: Zone gets its own
// datalist (#zoneOptions), filled with the zone spellings already used
// under the chosen area — the fixed Side 1–4c set was NOT used, because
// those are feeder sides for the separate feeder-zone field
// (#fiberZoneInput, FIBER_ZONES in outage-impact.js), not the zone
// spellings operators actually record on customers. No validation
// change: free text is still allowed, the datalist only suggests.
//
// Boundaries, stated plainly:
// - The profile edit form's Zone only (#zoneInput). The new-customer
//   form's zone input (#newCustomerZone) is untouched — a future plan
//   can give it the same treatment.
// - Area matching is canonical (phase3 canonicalMohalla): "MOHALLA
//   BANI", "Bani" and "BANII" are the same area. With no area chosen,
//   every recorded zone spelling is offered.
// - Archived customers never contribute suggestions; blank zones and
//   non-string zone values are ignored. Exact duplicate spellings
//   collapse to one option; case variants stay as separate suggestions
//   because they are distinct stored spellings.
// - The save path is untouched: the form still saves the raw typed
//   value (core.js cleanText, max 100).

function formHtml() {
  const html = read('index.html');
  const start = html.indexOf('id="customerProfileForm"');
  assert.notEqual(start, -1, 'profile form must exist');
  const end = html.indexOf('id="profileContributorsEditor"', start);
  assert.notEqual(end, -1, 'form must end before the contributors editor');
  return html.slice(start, end);
}

function fieldTag(form, id) {
  const re = new RegExp(`<(?:input|textarea)[^>]*id="${id}"[^>]*>`);
  const match = form.match(re);
  assert.ok(match, `field ${id} must exist in the profile form`);
  return match[0];
}

const customers = (rows) => rows.map((row, i) => ({ id: `c${i + 1}`, ...row }));

test('Plan 518: Zone input offers the Zone datalist, like Area does', () => {
  const tag = fieldTag(formHtml(), 'zoneInput');
  assert.match(tag, /list="zoneOptions"/, 'Zone input points at the Zone datalist');
  assert.match(tag, /type="text"/, 'Zone stays a free-text input');
  assert.doesNotMatch(tag, /required/, 'Zone stays optional — no validation change');
  assert.doesNotMatch(tag, /pattern=/, 'Zone carries no pattern — a new spelling can still be typed');
  assert.ok(formHtml().includes('<datalist id="zoneOptions"></datalist>'), 'Zone datalist exists in the form');
});

test('Plan 518: Area datalist is untouched', () => {
  const tag = fieldTag(formHtml(), 'mohallaInput');
  assert.match(tag, /list="mohallaOptions"/, 'Area still points at its own datalist');
  const options = formHtml().match(/<datalist id="mohallaOptions">([\s\S]*?)<\/datalist>/);
  assert.ok(options, 'Area datalist still exists');
  assert.equal((options[1].match(/<option/g) || []).length, 15, 'Area still offers its 15 mohallas');
});

test('Plan 518: zonesUnderArea returns the distinct zones under the chosen area, sorted', () => {
  const rows = customers([
    { mohalla: 'CHARYAA', zone: 'West' },
    { mohalla: 'CHARYAA', zone: 'East' },
    { mohalla: 'CHARYAA', zone: 'East' },
    { mohalla: 'GANGALL', zone: 'North' },
  ]);
  assert.deepEqual(zonesUnderArea(rows, 'CHARYAA'), ['East', 'West']);
});

test('Plan 518: area matching is canonical — MOHALLA BANI, Bani and BANII are one area', () => {
  const rows = customers([
    { mohalla: 'Bani', zone: 'Upper' },
    { mohalla: 'MOHALLA BANI', zone: 'Lower' },
    { mohalla: 'BANII', zone: 'Middle' },
    { mohalla: 'CHARYAA', zone: 'Elsewhere' },
  ]);
  assert.deepEqual(zonesUnderArea(rows, 'BANII'), ['Lower', 'Middle', 'Upper']);
  assert.deepEqual(zonesUnderArea(rows, 'Bani'), ['Lower', 'Middle', 'Upper']);
});

test('Plan 518: zones from other areas are never offered', () => {
  const rows = customers([
    { mohalla: 'CHARYAA', zone: 'East' },
    { mohalla: 'SODAA', zone: 'Riverside' },
  ]);
  assert.deepEqual(zonesUnderArea(rows, 'SODAA'), ['Riverside']);
});

test('Plan 518: archived customers and blank zones never contribute', () => {
  const rows = customers([
    { mohalla: 'CHARYAA', zone: 'East' },
    { mohalla: 'CHARYAA', zone: 'Old', archived: true },
    { mohalla: 'CHARYAA', zone: '   ' },
    { mohalla: 'CHARYAA', zone: '' },
    { mohalla: 'CHARYAA', zone: null },
    { mohalla: 'CHARYAA' },
  ]);
  assert.deepEqual(zonesUnderArea(rows, 'CHARYAA'), ['East']);
});

test('Plan 518: zone values are trimmed before they are offered', () => {
  const rows = customers([
    { mohalla: 'CHARYAA', zone: '  East  ' },
    { mohalla: 'CHARYAA', zone: 'East' },
  ]);
  assert.deepEqual(zonesUnderArea(rows, 'CHARYAA'), ['East']);
});

test('Plan 518: with no area chosen, every recorded zone spelling is offered', () => {
  const rows = customers([
    { mohalla: 'CHARYAA', zone: 'East' },
    { mohalla: 'SODAA', zone: 'Riverside' },
    { mohalla: '', zone: 'NoArea' },
  ]);
  assert.deepEqual(zonesUnderArea(rows, ''), ['East', 'NoArea', 'Riverside']);
  assert.deepEqual(zonesUnderArea(rows, '   '), ['East', 'NoArea', 'Riverside']);
});

test('Plan 518: no customers means no suggestions', () => {
  assert.deepEqual(zonesUnderArea([], 'CHARYAA'), []);
  assert.deepEqual(zonesUnderArea(null, 'CHARYAA'), []);
  assert.deepEqual(zonesUnderArea(undefined, 'CHARYAA'), []);
});

test('Plan 518: app.js imports the zone helper at the pinned version', () => {
  const app = read('app.js');
  assert.ok(app.includes("from './zone-suggestions.js?v=1.11.0'"), 'app.js imports zone-suggestions at the pinned version');
  assert.ok(app.includes('zonesUnderArea'), 'app.js uses the helper');
});

test('Plan 518: the form refreshes the Zone datalist when it opens', () => {
  const app = read('app.js');
  assert.ok(app.includes('refreshZoneOptions()'), 'form population refreshes the Zone options');
  assert.match(app, /function refreshZoneOptions\(\) \{[\s\S]*?zoneOptions[\s\S]*?zonesUnderArea\(state\.customers/, 'refreshZoneOptions rebuilds #zoneOptions from the customers under the chosen area');
});

test('Plan 518: changing the Area refreshes the Zone suggestions', () => {
  const app = read('app.js');
  assert.ok(app.includes("$('#mohallaInput').addEventListener('input', refreshZoneOptions)"), 'typing a new Area re-offers that area’s zones');
});

test('Plan 518: the save path still takes the raw typed Zone value', () => {
  const app = read('app.js');
  assert.ok(app.includes("zone:$('#zoneInput').value"), 'save still reads the Zone input verbatim — no validation change');
});
