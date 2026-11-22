import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 609 — Preview results announce themselves to screen readers.
// The two profile preview sections (first-bill + package-change) render
// their results into plain <div>s and update two status lines on a ready
// preview; a screen-reader operator tapping "Preview bill" heard nothing.
// The fix adds the app's owned live-region pattern (role="status" +
// aria-live="polite" — the same pair #customerProfitPreview already
// carries, and the same pair bulk-collect / customer-import use) to the
// four elements whose content changes when a preview is activated.
// No visual change, no behaviour change, no new keys.
//
// Scope note (re-scoped from the spec — 604 precedent): the spec's
// citations are all dead (app.js:10836-10873 is 601 labels code,
// index.html:7454/7458 are estimate fields, #profCountEl is 0x
// repo-wide, print-profile-menu.js does not exist). The real defect is
// exactly these four elements: the two result divs + the two shown/kept
// status lines. The four section headings are NOT targets — a heading
// must keep its heading role (Plan 611 owns their wording).
// This file asserts NO parity total (0 new keys — 602 / QC-top
// precedent); it must contain NEITHER the current, previous nor older
// parity bare digits (plan591 G5a sweep + pnl G4 count).

const appJs = read('app.js');
const indexHtml = read('index.html');

const tagFor = (id) => {
  const m = appJs.match(new RegExp(`<[^>]*id="${id}"[^>]*>`));
  assert.ok(m, `the #${id} element exists in app.js`);
  return m[0];
};

test('G1: the two preview result containers are polite live regions', () => {
  for (const id of ['firstBillPreviewResult', 'packageChangePreviewResult']) {
    const tag = tagFor(id);
    assert.ok(/role="status"/.test(tag), `#${id} carries role="status"`);
    assert.ok(/aria-live="polite"/.test(tag), `#${id} carries aria-live="polite"`);
  }
});

test('G2: the shown/kept status lines are polite live regions', () => {
  for (const id of ['firstBillPreviewShown', 'packageChangePreviewKept']) {
    const tag = tagFor(id);
    assert.ok(/role="status"/.test(tag), `#${id} carries role="status"`);
    assert.ok(/aria-live="polite"/.test(tag), `#${id} carries aria-live="polite"`);
  }
});

test('G3: the Show handlers still write into the live elements', () => {
  // First bill: the result div is re-rendered and the shown line updated.
  assert.ok(appJs.includes('resultEl.innerHTML = firstBillPreviewHtml(preview, formatAmount, firstBillPreviewLabels())'),
    'first-bill Show writes the result into #firstBillPreviewResult');
  assert.ok(appJs.includes('shownEl.textContent = firstBillPreviewShownText('),
    'a ready first-bill preview updates #firstBillPreviewShown');
  // Package change: the same pair.
  assert.ok(appJs.includes('resultEl.innerHTML = packageChangePreviewHtml(preview, formatAmount, packageChangeLabels())'),
    'package-change Show writes the result into #packageChangePreviewResult');
  assert.ok(appJs.includes('keptEl.textContent = packageChangePreviewStoredText('),
    'a ready package-change preview updates #packageChangePreviewKept');
});

test('G4: no heading in the preview templates carries a live-region role', () => {
  // A heading must keep its heading role — role="status" on an h1–h6
  // would override it and break heading navigation. The two preview
  // templates carry their headings via <summary> + i18n keys, not h-tags,
  // and no h-tag in the slice may gain a role.
  const start = appJs.indexOf('firstBillPreviewSectionHtml');
  const end = appJs.indexOf('\n  // Plan 47', appJs.indexOf('packageChangeSectionHtml'));
  const slice = appJs.slice(start, end);
  assert.ok(!/<h[1-6][^>]*role="status"/.test(slice), 'no preview heading carries role="status"');
  assert.ok(!/<h[1-6][^>]*aria-live/.test(slice), 'no preview heading carries aria-live');
});

test('G5: exactly two preview Show buttons — the scope is complete', () => {
  const btns = appJs.match(/id="[a-zA-Z]*PreviewShowBtn"/g) || [];
  assert.equal(btns.length, 2, 'only first-bill + package-change have a Preview Show button');
  assert.ok(btns.includes('id="firstBillPreviewShowBtn"'), 'first-bill Show button exists');
  assert.ok(btns.includes('id="packageChangePreviewShowBtn"'), 'package-change Show button exists');
});

test('G6: the edit-form profit preview already announces (pre-existing, untouched)', () => {
  const m = indexHtml.match(/<p id="customerProfitPreview"[^>]*>/);
  assert.ok(m, '#customerProfitPreview exists');
  assert.ok(/role="status"/.test(m[0]), '#customerProfitPreview already carries role="status"');
  assert.ok(/aria-live="polite"/.test(m[0]), '#customerProfitPreview already carries aria-live="polite"');
});

test('G7: this file pins no parity total and stays free of the parity bare digits', () => {
  // The digits are built from split literals so this file itself never
  // contains them (plan591 G5a sweeps the whole tests/ tree for the bare
  // digits of the current total, pnl G4 counts the files containing
  // them). This file asserts no parity total — 0 new keys.
  const selfSrc = read('tests/plan609-preview-results-status.test.js');
  assert.ok(!selfSrc.includes('52' + '23'), 'this file carries the current parity bare digits');
  assert.ok(!selfSrc.includes('52' + '22'), 'this file carries the previous parity bare digits');
  assert.ok(!selfSrc.includes('52' + '03'), 'this file carries the older parity bare digits');
});
