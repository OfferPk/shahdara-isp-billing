// Plan 611 — The four section headings name the sections, not the page.
//
// The edit form's section headings reused the view's prof_sec_* keys
// verbatim, so the form read as a copy of the view pasted inside
// itself — its first heading even repeated the view's page-level
// "Customer information" h3. The form now carries its own headings
// through six new pfh_* keys (EN + UR), wired with the same heading
// treatment as the view: the same <h4 data-i18n> markup inside the
// same .profile-info-group sections, no new CSS, no field moves.
//
// Spec corrections (measured on the true base, not taken on trust):
// - The spec says FOUR headings (Plan 495's pre-Phase-C structure).
//   Polish #28 Phase C regrouped the form into SIX sections (S1–S6),
//   so this plan gives the form SIX own headings, one per section.
// - The spec's heading strings ("Location information", "Service
//   information", "Connection information") do not exist anywhere in
//   the repo; the real view headings are "Customer Information",
//   "Service & Package", "Financial Details", "Connection &
//   Installation", "Network Configuration", "Hardware & Equipment".
// - The spec's citation index.html:7458 is dead (that line is in the
//   extension-estimate area). The form headings live at index.html
//   :6946–:7019; the view headings come from app.js :8856–:8870.
// - "New heading IDs use the fresh pfh prefix" means the KEY names
//   (pfh_*), not element ids: the headings carry NO id (pinned by
//   plan495 + polish28-phase-c), and none is added here.
//
// This file asserts NO parity total (0 new keys would be wrong —
// six keys move the total, and the re-pin belongs to the pinning
// files). It must contain NEITHER the current nor the previous parity
// bare digits, and no split-literal form of them either — the
// plan591 G5a sweep and the pnl G4 count are the enforcement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TRANSLATIONS } from '../nav-language.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

const PFH = [
  ['pfh_customer', 'Contact details', 'رابطے کی تفصیلات'],
  ['pfh_service', 'Their service', 'ان کی سروس'],
  ['pfh_financial', 'Money details', 'رقم کی تفصیلات'],
  ['pfh_connection', 'Their connection', 'ان کا کنکشن'],
  ['pfh_network', 'Network settings', 'نیٹ ورک سیٹنگز'],
  ['pfh_hardware', 'Equipment details', 'آلات کی تفصیلات'],
];
const VIEW = [
  ['prof_sec_customer', 'Customer Information', 'کسٹمر کی معلومات'],
  ['prof_sec_service', 'Service & Package', 'سروس اور پیکج'],
  ['prof_sec_financial', 'Financial Details', 'مالی تفصیلات'],
  ['prof_sec_connection', 'Connection & Installation', 'کنکشن اور انسٹالیشن'],
  ['prof_sec_network', 'Network Configuration', 'نیٹ ورک کنفیگریشن'],
  ['prof_sec_hardware', 'Hardware & Equipment', 'ہارڈویئر اور آلات'],
];

function formHtml() {
  const html = read('index.html');
  const start = html.indexOf('id="customerProfileForm"');
  assert.notEqual(start, -1, 'profile form must exist');
  const end = html.indexOf('id="profileContributorsEditor"', start);
  assert.notEqual(end, -1, 'form must end before the contributors editor');
  return html.slice(start, end);
}

function parseSections(form) {
  const sections = [...form.matchAll(/<section class="profile-form-group profile-info-group" data-profile-form-section="([^"]+)"><h4 data-i18n="([^"]+)">([^<]*)<\/h4><div class="profile-grid">([\s\S]*?)<\/div><\/section>/g)];
  return sections.map(([, key, headingKey, fallback, body]) => ({
    key,
    headingKey,
    fallback,
    fields: [...body.matchAll(/<label class="profile-field" for="([^"]+)"/g)].map((m) => m[1]),
  }));
}

test('C1: the form shows six headings with the form\'s own pfh keys, in view order', () => {
  const sections = parseSections(formHtml());
  assert.equal(sections.length, 6, 'six sections: one per editable view section S1–S6');
  assert.deepEqual(
    sections.map((s) => s.key),
    ['customer', 'service', 'financial', 'connection', 'network', 'hardware'],
    'sections stay in view order Customer, Service, Financial, Connection, Network, Hardware',
  );
  assert.deepEqual(
    sections.map((s) => s.headingKey),
    PFH.map(([key]) => key),
    'each section must carry its own form heading key',
  );
});

test('C2: the six pfh keys exist in EN and UR with the decided wording', () => {
  for (const [key, en, ur] of PFH) {
    assert.equal(TRANSLATIONS.en[key], en, `${key} EN value`);
    assert.equal(TRANSLATIONS.ur[key], ur, `${key} UR value`);
  }
});

test('C3: the form headings are distinct from the view headings in both languages', () => {
  const viewEn = new Set(VIEW.map(([, en]) => en));
  const viewUr = new Set(VIEW.map(([, , ur]) => ur));
  for (const [key, en, ur] of PFH) {
    assert.ok(!viewEn.has(en), `${key} EN wording must differ from every view heading`);
    assert.ok(!viewUr.has(ur), `${key} UR wording must differ from every view heading`);
  }
  // The first heading no longer repeats the view's page-level h3.
  assert.notEqual(TRANSLATIONS.en.pfh_customer, TRANSLATIONS.en.prof_view_heading, 'the first form heading must not repeat the view page title');
});

test('C4: the static fallback text matches the EN key value', () => {
  const sections = parseSections(formHtml());
  for (const s of sections) {
    const [, en] = PFH.find(([key]) => key === s.headingKey);
    assert.equal(s.fallback, en, `${s.headingKey} fallback must read the new English wording before i18n paints`);
  }
});

test('S1: the view still renders its sections with the prof_sec keys', () => {
  const appJs = read('app.js');
  for (const [key] of VIEW) {
    assert.ok(appJs.includes(`t('${key}')`), `the view must still read ${key}`);
  }
  // The form is static markup — no JS renders its headings.
  assert.ok(!appJs.includes('pfh_customer'), 'no JS path writes the form headings');
});

test('S2: the view keys still exist with their EN and UR values', () => {
  for (const [key, en, ur] of VIEW) {
    assert.equal(TRANSLATIONS.en[key], en, `the view key ${key} must keep its English value`);
    assert.equal(TRANSLATIONS.ur[key], ur, `the view key ${key} must keep its Urdu value`);
  }
  assert.equal(TRANSLATIONS.en.prof_sec_history, 'History & Activity', 'the unedited seventh view key is untouched');
});

test('S3: no field moves — the same 69 fields sit under the same six sections', () => {
  const sections = parseSections(formHtml());
  const grouped = sections.flatMap((s) => s.fields);
  assert.equal(grouped.length, 69, 'all 69 fields grouped (item C moved phone out of the form to the top row)');
  assert.equal(new Set(grouped).size, 69, 'no field grouped twice');
  assert.equal(sections[0].fields[0], 'profileNameInput', 'the first field overall is still the name');
  assert.equal(sections[5].fields.at(-1), 'serialNumberInput', 'the last field overall is still the serial number');
});

test('S4: no new CSS, no new element ids, same heading treatment', () => {
  const form = formHtml();
  const headingTags = [...form.matchAll(/<h4[^>]*data-i18n="(pfh_[a-z]+)"[^>]*>/g)];
  assert.equal(headingTags.length, 6, 'six h4 headings, one per section');
  for (const [tag] of headingTags) {
    assert.ok(!tag.includes('id='), 'headings carry no new element id');
  }
  assert.ok(
    form.includes('<section class="profile-form-group profile-info-group" data-profile-form-section="'),
    'form sections keep the view group class plus their section key',
  );
  const styles = read('styles.css');
  assert.ok(styles.includes('.profile-info-group h4'), 'the view group h4 rule still styles the headings');
});

test('G: this file pins no parity total — the dicts agree, and exactly six pfh keys exist', () => {
  assert.equal(
    Object.keys(TRANSLATIONS.en).length,
    Object.keys(TRANSLATIONS.ur).length,
    'EN and UR dicts still agree in size',
  );
  const pfhKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('pfh_'));
  assert.deepEqual(
    pfhKeys.sort(),
    PFH.map(([key]) => key).sort(),
    'exactly the six new pfh keys exist — no more, no fewer',
  );
});
