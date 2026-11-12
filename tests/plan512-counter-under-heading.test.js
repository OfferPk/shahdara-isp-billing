import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { missingFieldsChecklistHtml } from '../missing-fields-checklist.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

const TEXTS = { heading: 'Missing fields', allFilled: 'All fields filled' };
const LABELS = { cnicInput: 'CNIC', phoneInput: 'Phone' };

test('plan512 html: missing fields render collapsed behind a details, with the count in the summary', () => {
  const missing = [
    { controlId: 'cnicInput', fieldKey: 'cnic' },
    { controlId: 'phoneInput', fieldKey: 'phone' },
  ];
  const html = missingFieldsChecklistHtml(missing, LABELS, TEXTS);
  assert.ok(html.includes('<details class="mfc-details">'), 'list must sit in a details element');
  assert.ok(!html.includes('<details open'), 'details must start collapsed');
  // Profile Polish B (12): the count is a pill holding the plain
  // number (no parens); the bar is absent here because this call
  // passes no total.
  assert.ok(html.includes('<summary class="mfc-summary">Missing fields <span class="mfc-count-pill">2</span></summary>'), 'summary carries the heading and the count pill');
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
  const html = missingFieldsChecklistHtml(many, labels, TEXTS);
  assert.equal((html.match(/<details/g) || []).length, 1, 'exactly one collapsed list');
  // Profile Polish B (12): the count is a pill holding the plain
  // number (no parens).
  assert.ok(html.includes('<summary class="mfc-summary">Missing fields <span class="mfc-count-pill">40</span></summary>'));
  assert.ok(!html.includes('<details open'), 'still collapsed with 40 missing');
  assert.equal((html.match(/data-missing-field=/g) || []).length, 40, 'every field still has its jump button');
  assert.ok(html.includes('data-missing-field="field39Input">Field 40</button>'));
});

test('plan512 html: a complete profile is unchanged — all-filled line, no details, no buttons', () => {
  const html = missingFieldsChecklistHtml([], LABELS, TEXTS);
  assert.ok(html.includes('<h4 class="mfc-heading">Missing fields</h4>'));
  assert.ok(html.includes('<p class="mfc-all-filled">All fields filled</p>'));
  assert.ok(!html.includes('<details'));
  assert.ok(!html.includes('data-missing-field'));
  assert.ok(!html.includes('<button'));
});

test('plan512 html: the summary heading is escaped, and the count cannot be injected', () => {
  const html = missingFieldsChecklistHtml(
    [{ controlId: 'phoneInput', fieldKey: 'phone' }],
    LABELS,
    { heading: 'A & B', allFilled: 'Done' },
  );
  // Profile Polish B (12): the count is a pill holding the plain
  // number (no parens) — the heading still escapes, the count still
  // cannot be injected (it is a number, never the heading text).
  assert.ok(html.includes('<summary class="mfc-summary">A &amp; B <span class="mfc-count-pill">1</span></summary>'));
  assert.ok(!html.includes('A & B (1)'));
});

test('plan512 wiring: the counter is inserted after the view heading, not at the very top', () => {
  // Profile Polish B (12): the counter is computed once into
  // `completion` and rendered as a pill + progress bar, so the old
  // `countProfileCompletion(customer).text` inline call is gone. The
  // preserved intent is one insertion, anchored on the heading,
  // with 'afterend' — the checklist line also mentions the counter
  // class, so the filter keys on the heading anchor to stay unique.
  const counterLines = appSrc.split('\n').filter((l) => l.includes("querySelector('.profile-view-heading')") && l.includes('profile-completion-counter') && l.includes('insertAdjacentHTML'));
  assert.equal(counterLines.length, 1, 'exactly one view-counter insertion');
  assert.ok(counterLines[0].includes("querySelector('.profile-view-heading')"), 'counter anchors on the heading');
  assert.ok(counterLines[0].includes("'afterend'"), 'counter sits directly under the heading');
  assert.ok(!counterLines[0].includes("'afterbegin'"), 'counter no longer renders above the heading');
  assert.ok(counterLines[0].includes('profile-completion-pill'), 'the counter renders as a pill');
  // The heading template itself comes first in the same render pass.
  assert.ok(appSrc.indexOf('<div class="profile-view-heading">') < appSrc.indexOf('profile-completion-pill'), 'the heading template comes before the counter');
});

test('plan512 wiring: the checklist still renders immediately after the counter', () => {
  const checklistLines = appSrc.split('\n').filter((l) => l.includes("querySelector('.profile-completion-counter')"));
  assert.equal(checklistLines.length, 1, 'exactly one checklist insertion');
  assert.ok(checklistLines[0].includes("'afterend'"));
  assert.ok(checklistLines[0].includes('missingFieldsChecklistHtml('));
  // Profile Polish B (12): the counter text is computed into
  // `completion` now, so the marker is the counter pill, not the old
  // inline call — the order (counter first, checklist after) is
  // unchanged.
  assert.ok(appSrc.indexOf('profile-completion-pill') < appSrc.indexOf('missingFieldsChecklistHtml('));
});

test('plan512 styles: the collapsed summary reads like the heading it replaces', () => {
  const summary = stylesSrc.match(/\.mfc-summary\{([^}]*)\}/);
  assert.ok(summary, 'styles must define .mfc-summary');
  assert.match(summary[1], /cursor:pointer/);
  assert.match(summary[1], /font:700 15px Manrope,sans-serif/);
  for (const hex of summary[1].match(/#[0-9a-fA-F]{3,8}/g) ?? []) {
    assert.fail(`mfc-summary rule must use tokens, not a hex colour, found ${hex}`);
  }
});
