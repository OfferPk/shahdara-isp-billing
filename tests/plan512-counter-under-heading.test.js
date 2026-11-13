import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { missingFieldsChecklistHtml } from '../missing-fields-checklist.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

const TEXTS = { title: 'Profile Details (66/68 filled)', showMissing: 'Show 2 optional fields', hideMissing: 'Hide optional fields', allFilled: 'All fields filled', total: 68, filled: 66, percent: 97 };
const LABELS = { cnicInput: 'CNIC', phoneInput: 'Phone' };

test('plan512 html: missing fields render collapsed behind a details, with the title and show label in the summary', () => {
  const missing = [
    { controlId: 'cnicInput', fieldKey: 'cnic' },
    { controlId: 'phoneInput', fieldKey: 'phone' },
  ];
  const html = missingFieldsChecklistHtml(missing, LABELS, TEXTS);
  // Profile View Polish: the counter and the checklist merged into
  // ONE details bar — the summary carries the live title, the
  // show-missing label and the neutral filled bar; the count pill
  // and the red/yellow bar are gone.
  assert.ok(html.includes('<details class="profile-completion-details mfc-checklist"'), 'list must sit in a details element');
  assert.ok(!html.includes('<details open'), 'details must start collapsed');
  assert.ok(html.includes('<summary class="profile-details-summary">'), 'summary uses the merged-bar class');
  assert.ok(html.includes('Profile Details (66/68 filled)'), 'summary carries the live title');
  assert.ok(html.includes('Show 2 optional fields ▾'), 'summary carries the show label');
  assert.ok(html.includes('<span class="profile-details-fill" style="width:97%"></span>'), 'the bar is the filled share');
  assert.ok(!html.includes('mfc-count-pill'), 'no count pill any more');
  // The jump buttons live inside the details, in the same order.
  assert.ok(html.indexOf('<details') < html.indexOf('data-missing-field="cnicInput"'));
  assert.ok(html.indexOf('data-missing-field="phoneInput"') < html.indexOf('</details>'));
  assert.ok(html.includes('data-missing-field="cnicInput">CNIC</button>'));
  assert.ok(html.includes('data-missing-field="phoneInput">Phone</button>'));
  assert.ok(html.indexOf('cnicInput') < html.indexOf('phoneInput'));
});

test('plan512 html: a profile with 40 missing fields shows one collapsed line, not 40 rows', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ controlId: `field${i}Input`, fieldKey: `field${i}` }));
  const labels = Object.fromEntries(many.map((f, i) => [f.controlId, `Field ${i + 1}`]));
  const html = missingFieldsChecklistHtml(many, labels, { title: 'Profile Details (28/68 filled)', showMissing: 'Show 40 optional fields', hideMissing: 'Hide optional fields', allFilled: 'All fields filled', total: 68, filled: 28, percent: 41 });
  assert.equal((html.match(/<details/g) || []).length, 1, 'exactly one collapsed list');
  assert.ok(html.includes('Profile Details (28/68 filled)'), 'summary carries the live title');
  assert.ok(html.includes('Show 40 optional fields ▾'), 'summary carries the show label');
  assert.ok(!html.includes('<details open'), 'still collapsed with 40 missing');
  assert.equal((html.match(/data-missing-field=/g) || []).length, 40, 'every field still has its jump button');
  assert.ok(html.includes('data-missing-field="field39Input">Field 40</button>'));
});

test('plan512 html: a complete profile shows the all-filled line and no buttons', () => {
  // Profile View Polish: a complete profile still renders the merged
  // bar (so the "11/68 filled" title stays visible), with the
  // all-filled line inside and no show label, no jump buttons.
  const html = missingFieldsChecklistHtml([], LABELS, TEXTS);
  assert.ok(html.includes('<details class="profile-completion-details mfc-checklist"'));
  assert.ok(html.includes('<p class="mfc-all-filled">All fields filled</p>'));
  assert.ok(!html.includes('Show 2 optional fields'));
  assert.ok(!html.includes('data-missing-field'));
  assert.ok(!html.includes('<button'));
});

test('plan512 html: the summary title is escaped, and the show label is text, never markup', () => {
  const html = missingFieldsChecklistHtml(
    [{ controlId: 'phoneInput', fieldKey: 'phone' }],
    LABELS,
    { title: 'A & B', showMissing: 'Show 1 optional fields', hideMissing: 'Hide optional fields', allFilled: 'Done', percent: 99 },
  );
  assert.ok(html.includes('A &amp; B'), 'the title escapes');
  assert.ok(!html.includes('A & B (1)'), 'no raw count is ever glued to the title');
});

test('plan512 wiring: the merged bar is inserted after the view heading, not at the very top', () => {
  // Profile View Polish: the counter and the checklist merged into
  // ONE insertion — no separate counter <p>, no second insertion.
  // The preserved intent is one insertion, anchored on the heading,
  // with 'afterend'.
  const barLines = appSrc.split('\n').filter((l) => l.includes("querySelector('.profile-view-heading')") && l.includes('missingFieldsChecklistHtml(') && l.includes('insertAdjacentHTML'));
  assert.equal(barLines.length, 1, 'exactly one merged-bar insertion');
  assert.ok(barLines[0].includes("querySelector('.profile-view-heading')"), 'bar anchors on the heading');
  assert.ok(barLines[0].includes("'afterend'"), 'bar sits directly under the heading');
  assert.ok(!barLines[0].includes("'afterbegin'"), 'bar no longer renders above the heading');
  // The heading template itself comes first in the same render pass.
  assert.ok(appSrc.indexOf('<div class="profile-view-heading">') < appSrc.indexOf('missingFieldsChecklistHtml('), 'the heading template comes before the bar');
});

test('plan512 wiring: the checklist renders exactly once, as the merged bar', () => {
  const calls = appSrc.match(/missingFieldsChecklistHtml\(/g) ?? [];
  assert.equal(calls.length, 1, 'exactly one checklist call in app.js');
  assert.ok(appSrc.includes('missingFieldsChecklistHtml(missingFields, missingFieldLabels, {'));
});

test('plan512 styles: the merged summary reads like the heading it replaces', () => {
  // Profile View Polish: the summary is .profile-details-summary
  // now (the old .mfc-summary is dead CSS). It reads like the
  // heading it replaces — bold 13px Manrope, a real pointer — and
  // uses no hex, so the 614-colour ratchet is untouched.
  const summary = stylesSrc.match(/\.profile-details-summary\{([^}]*)\}/);
  assert.ok(summary, 'styles must define .profile-details-summary');
  assert.match(summary[1], /cursor:pointer/);
  assert.match(summary[1], /font:700 13px Manrope,sans-serif/);
  for (const hex of summary[1].match(/#[0-9a-fA-F]{3,8}/g) ?? []) {
    assert.fail(`profile-details-summary rule must use tokens, not a hex colour, found ${hex}`);
  }
});
