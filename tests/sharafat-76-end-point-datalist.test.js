// Sharafat 76 — "End Point" is missing from the canonical mohalla list.
//
// The canonical JS lists already carried END POINT as the 16th mohalla
// (Mohalla Numbering #1364), but the hardcoded Area datalist
// #mohallaOptions in index.html still offered only 15 — so End Point
// never appeared in the mohalla suggestions on the profile,
// new-customer, wizard and quick-add forms. This file pins the datalist
// itself: 16 options, exactly DEFAULT_MOHALLAS in order, END POINT last,
// and all four inputs pointing at the shared datalist.
//
// The canonical pins are NOT duplicated here — they live in
// mohalla-canonical.test.js / mohalla-numbering.test.js.
// Tests use generic mohalla names only — no real customer names, no
// phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DEFAULT_MOHALLAS } from '../phase3.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

function datalistOptions() {
  const html = read('index.html');
  const match = html.match(/<datalist id="mohallaOptions">([\s\S]*?)<\/datalist>/);
  assert.ok(match, 'Area datalist #mohallaOptions still exists');
  return [...match[1].matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
}

test('Area datalist offers all 16 mohallas', () => {
  assert.equal(datalistOptions().length, 16);
});

test('END POINT is the last Area datalist option', () => {
  const options = datalistOptions();
  assert.equal(options[options.length - 1], 'END POINT');
});

test('Area datalist options equal DEFAULT_MOHALLAS exactly, in order', () => {
  assert.deepEqual(datalistOptions(), [...DEFAULT_MOHALLAS]);
});

test('profile Area input points at the shared datalist', () => {
  const html = read('index.html');
  const tag = html.match(/<(?:input|textarea)[^>]*id="mohallaInput"[^>]*>/);
  assert.ok(tag, 'profile Area input #mohallaInput must exist');
  assert.match(tag[0], /list="mohallaOptions"/, 'profile Area input points at #mohallaOptions');
});

test('new-customer mohalla input points at the shared datalist', () => {
  const html = read('index.html');
  const tag = html.match(/<(?:input|textarea)[^>]*id="newCustomerMohalla"[^>]*>/);
  assert.ok(tag, 'new-customer mohalla input #newCustomerMohalla must exist');
  assert.match(tag[0], /list="mohallaOptions"/, 'new-customer input points at #mohallaOptions');
});

test('wizard mohalla input points at the shared datalist', () => {
  const html = read('index.html');
  const tag = html.match(/<(?:input|textarea)[^>]*id="wizardMohallaInput"[^>]*>/);
  assert.ok(tag, 'wizard mohalla input #wizardMohallaInput must exist');
  assert.match(tag[0], /list="mohallaOptions"/, 'wizard input points at #mohallaOptions');
});

test('quick-add mohalla input points at the shared datalist', () => {
  // The quick-add input is generated in JS, not static HTML.
  const source = read('quick-collect-new-customer-quick-add.js');
  const tag = source.match(/<input[^>]*id="ncaMohalla"[^>]*>/);
  assert.ok(tag, 'quick-add mohalla input #ncaMohalla must exist in the quick-add source');
  assert.match(tag[0], /list="mohallaOptions"/, 'quick-add input points at #mohallaOptions');
});
