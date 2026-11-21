// Plan 613 — The edit form gets its own h3 heading.
//
// The edit form opened straight into its six section headings with no
// page-level heading of its own, while the view has its "Customer
// information" h3 — a screen reader entering the form heard section
// headings with no parent heading. The form now carries one h3 at its
// top ("Edit customer", fresh key prof_edit_heading, EN + UR), placed
// before the completion bar and before the first pfh h4, with the same
// plain <h3 data-i18n> treatment as the view heading. No field or
// button change, no new CSS, no JS write path (the form is static
// markup — plan611 S1).
//
// Spec corrections (measured on the true base, not taken on trust):
// - The spec says FOUR section headings; the form has SIX (Plan 611),
//   all <h4>, one per section.
// - prof_receipts_edit already carries the EN wording 'Edit customer'
//   but is receipts-context; the form heading uses the fresh
//   prof_edit_heading key instead.
//
// This file asserts NO parity total (one key moves the total, and the
// re-pin belongs to the pinning files). It must contain NEITHER the
// current nor the previous parity bare digits, and no split-literal
// form of them either — the plan591 G5a sweep and the pnl G4 count
// are the enforcement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TRANSLATIONS } from '../nav-language.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

const html = read('index.html');
const appJs = read('app.js');

// The form is static markup: slice from its opening div to the sticky
// save bar at its end (the last element inside the form).
const formStart = html.indexOf('id="customerProfileForm"');
const formEnd = html.indexOf('id="profileStickySaveBar"', formStart);
const form = html.slice(formStart, formEnd);
const firstPfh = form.indexOf('<h4 data-i18n="pfh_');
const h3BeforeFirstPfh = [...form.matchAll(/<h3[^>]*>/g)].filter((m) => m.index < firstPfh);
const headingKey = h3BeforeFirstPfh.length === 1
  ? (h3BeforeFirstPfh[0][0].match(/data-i18n="([^"]+)"/) || [])[1] || null
  : null;

test('C1: exactly one h3 sits at the top of the edit form, before the first section heading', () => {
  assert.equal(h3BeforeFirstPfh.length, 1, `expected one h3 before the first pfh h4, found ${h3BeforeFirstPfh.length}`);
  // The heading is a page heading, not a section heading: it must sit
  // outside every <section class="profile-form-group"> (plan495's
  // section regex), i.e. before the first section opens.
  const firstSection = form.indexOf('<section class="profile-form-group');
  assert.ok(h3BeforeFirstPfh[0].index < firstSection, 'the h3 precedes the first form section');
  assert.ok(!h3BeforeFirstPfh[0][0].includes('id='), 'the heading carries no id (plan611 S4 pattern)');
});

test('C2: the form h3 carries a data-i18n key present in both dicts', () => {
  assert.ok(headingKey, 'the h3 carries a data-i18n key');
  assert.ok(headingKey in TRANSLATIONS.en, `${headingKey} exists in EN`);
  assert.ok(headingKey in TRANSLATIONS.ur, `${headingKey} exists in UR`);
});

test('C2b: the form h3 is a fresh key, not the receipts-context key', () => {
  // prof_receipts_edit already says 'Edit customer' in the receipt
  // summary heading; reusing it would couple the form heading to the
  // receipts flow. The form heading must be its own key.
  assert.notEqual(headingKey, 'prof_receipts_edit');
  assert.equal(TRANSLATIONS.en[headingKey], 'Edit customer');
});

test('S1: the view still opens with its own h3 and the six view headings in order', () => {
  assert.ok(appJs.includes("<h3>${t('prof_view_heading')}</h3>"), 'view template still opens with the prof_view_heading h3');
  const viewKeys = ['prof_sec_customer', 'prof_sec_service', 'prof_sec_financial', 'prof_sec_connection', 'prof_sec_network', 'prof_sec_hardware'];
  const positions = viewKeys.map((k) => appJs.indexOf(`t('${k}')`));
  assert.ok(positions.every((i) => i >= 0), 'all six prof_sec_* keys still render in app.js');
  assert.ok(positions.every((v, i, a) => i === 0 || v > a[i - 1]), 'the six prof_sec_* keys still render in order');
});

test('S2: the six pfh h4 section headings are unchanged', () => {
  const pfhTags = [...form.matchAll(/<h4 data-i18n="(pfh_[a-z]+)">/g)].map((m) => m[1]);
  assert.deepEqual(pfhTags, ['pfh_customer', 'pfh_service', 'pfh_financial', 'pfh_connection', 'pfh_network', 'pfh_hardware']);
});

test('B1: the form heading reads in Urdu mode', () => {
  assert.ok(headingKey, 'the h3 carries a data-i18n key');
  assert.match(TRANSLATIONS.ur[headingKey], /[\u0600-\u06FF]/, 'the UR value contains Urdu script');
  assert.notEqual(TRANSLATIONS.ur[headingKey], TRANSLATIONS.en[headingKey], 'the UR value differs from EN');
  assert.notEqual(TRANSLATIONS.en[headingKey], TRANSLATIONS.en.prof_view_heading, 'the form heading does not repeat the view page title');
});
