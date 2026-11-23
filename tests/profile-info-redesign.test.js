// Profile Info-tab redesign (user decision 2026-11-22) — the
// Connection, Network, Hardware and History sections render as native
// rows in ONE grouped inset list instead of four <details> boxes; a
// row tap opens a bottom sheet with that section's fields; the Danger
// zone box is gone, replaced by a slim standalone Delete Customer row
// opening a confirmation bottom sheet; the top tabs lose their
// number prefixes. NOT pinning, 0 parity literals.
//
// Harness: source-level, like the neighbour pin tests — read app.js,
// index.html, styles.css, nav.js, nav.css and profile-sections.js as
// text and assert on the rendered shapes. profile-sections.js is
// imported directly (pure module, no DOM) to pin its store intact.
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const app = read('app.js');
const index = read('index.html');
const styles = read('styles.css');
const navJs = read('nav.js');
const navCss = read('nav.css');
const profileSections = await import(pathToFileURL(join(dir, '..', 'profile-sections.js')).href);

const SECTION_KEYS = ['connection', 'network', 'hardware', 'history'];

// The grouped-list rows live in the profile view render; slice it out.
function viewSlice() {
  const start = app.indexOf('const profileSectionCustomerHtml = profileDetailSectionHtml(');
  const end = app.indexOf("$('#customerProfileView').innerHTML =", start);
  assert.notEqual(start, -1, 'profile view render must exist');
  assert.notEqual(end, -1, 'profile view innerHTML assignment must exist');
  return app.slice(start, end);
}

// The delegated delete handler block.
function deleteHandlerSlice() {
  const start = app.indexOf("event.target.closest('#deleteCustomerButton')");
  assert.notEqual(start, -1, 'delete delegation branch must exist');
  const end = app.indexOf('});', start);
  assert.notEqual(end, -1, 'delete handler must close');
  return app.slice(start, end);
}

test('C1: the four sections render as rows in ONE grouped inset list, not four <details> boxes', () => {
  const view = viewSlice();
  // One container holds all four rows.
  assert.ok(
    view.includes('profile-info-grouped-list'),
    'the view must render a single grouped-list container for the four sections',
  );
  for (const key of SECTION_KEYS) {
    assert.ok(
      view.includes(`data-profile-info-row="${key}"`),
      `${key} must render as a grouped-list row`,
    );
    assert.ok(
      !view.includes(`profileDetailSectionHtml({ key: '${key}'`),
      `${key} must no longer render as a <details> section shell`,
    );
  }
  assert.equal(
    (view.match(/profile-info-grouped-list/g) || []).length >= 1 && (view.match(/<div class="profile-info-grouped-list"/g) || []).length,
    1,
    'exactly one grouped-list container',
  );
});

test('C2: each row is a 56px native touch target with squircle + title + subtitle + one right chevron, no Edit, no down-chevron', () => {
  const view = viewSlice();
  for (const key of SECTION_KEYS) {
    const rowStart = view.indexOf(`data-profile-info-row="${key}"`);
    assert.notEqual(rowStart, -1, `${key} row must exist`);
    const rowEnd = view.indexOf('</button>', rowStart);
    const row = view.slice(rowStart, rowEnd === -1 ? rowStart + 1200 : rowEnd);
    assert.ok(row.includes('profile-info-row-icon'), `${key} row must carry the icon squircle`);
    assert.ok(row.includes('profile-info-row-title'), `${key} row must carry a 1-line title`);
    assert.ok(row.includes('profile-info-row-subtitle'), `${key} row must carry a 1-line subtitle`);
    assert.ok(row.includes('ChevronRight') || row.includes('profile-info-row-chevron'), `${key} row must carry a single right chevron`);
    assert.ok(!row.includes('profile-section-edit'), `${key} row must carry no Edit button`);
    assert.ok(!row.includes('⌄'), `${key} row must carry no downward chevron`);
  }
  // The row rules: 56px floor, squircle 36px, subtitle truncation.
  assert.match(styles, /\.profile-info-row\{[^}]*min-height:\s*56px/, 'row rule must set the 56px touch target');
  assert.match(styles, /\.profile-info-row-icon\{[^}]*width:\s*36px/, 'squircle rule must be 36px (w-9)');
  assert.match(styles, /\.profile-info-row-subtitle\{[^}]*text-overflow:\s*ellipsis/, 'subtitle rule must truncate');
});

test('C3: row subtitles show real values or muted Not set — never the bare dash pair', () => {
  // The subtitle helper is new code: it must exist, it must build the
  // four subtitles from the same per-part dash expressions the old
  // summaries used, and it must map a fully-empty subtitle to the
  // muted Not set text instead of rendering '— · —'.
  const at = app.indexOf('profileInfoRowSubtitle');
  assert.notEqual(at, -1, 'a row-subtitle helper must exist');
  const helper = app.slice(at, at + 2500);
  assert.ok(helper.includes('customer.connectionDate ? humanDate(customer.connectionDate) : PROFILE_EMPTY_DASH'), 'connection subtitle must still dash an empty date per part');
  assert.ok(helper.includes('profileEmptyMoney(customer.connectionFee)'), 'connection subtitle must still dash an empty fee per part');
  assert.ok(helper.includes('profileEmptyText(customer.pppoeUsername)'), 'network subtitle must still dash an empty PPPoE username per part');
  assert.ok(helper.includes('profileEmptyText(customer.macAddress)'), 'network subtitle must still dash an empty MAC per part');
  assert.ok(helper.includes('profileEmptyText(customer.routerModel)'), 'hardware subtitle must still dash an empty router model per part');
  assert.ok(helper.includes('profileEmptyText(custodyFields.serialNumber)'), 'hardware subtitle must still dash an empty custody serial per part');
  assert.ok(helper.includes("t('prof_not_set')"), 'a fully-empty row subtitle must read the Not set text');
  // …and the four rows must use the helper for their subtitles.
  const view = viewSlice();
  for (const key of SECTION_KEYS) {
    assert.ok(view.includes(`profileInfoRowSubtitle('${key}'`) || view.includes(`profileInfoRowSubtitle("${key}"`), `${key} row must use the subtitle helper`);
  }
});

test('C4: tapping a row opens a slide-up bottom sheet with drag handle + backdrop', () => {
  // The sheet element + backdrop exist in the static markup and reuse
  // the mobile-action-sheet slide-up pattern (nav.css:950-1000).
  assert.ok(index.includes('id="profileSectionSheet"'), 'the section sheet element must exist');
  assert.ok(index.includes('id="profileSectionSheetBackdrop"'), 'the section sheet backdrop must exist');
  assert.ok(index.includes('sheet-handle'), 'the sheet must carry a drag handle');
  assert.ok(navCss.includes('.mobile-action-sheet'), 'the sheet must reuse the slide-up sheet CSS');
  // Row taps are delegated to an open function.
  assert.ok(app.includes('openProfileSectionSheet('), 'a sheet-open function must exist');
  assert.ok(/data-profile-info-row/.test(app), 'row taps must be delegated by data attribute');
});

test('C5: the sheet shows that section’s fields and an Edit entry into the form', () => {
  // The sheet-open function is new code: it must exist, and within its
  // neighbourhood it must render the section body HTML verbatim (the
  // same bodies the <details> sections showed — no field lost or
  // rebuilt) plus an Edit control that opens the form at the section.
  const at = app.indexOf('openProfileSectionSheet');
  assert.notEqual(at, -1, 'the sheet-open function must exist');
  const fn = app.slice(at, at + 4000);
  for (const key of SECTION_KEYS) {
    const bodyVar = `profileSection${key[0].toUpperCase() + key.slice(1)}Body`;
    assert.ok(fn.includes(bodyVar), `${key} body must be rendered inside the sheet`);
  }
  assert.ok(fn.includes('data-profile-section-edit'), 'the sheet must carry an Edit control per section');
  assert.ok(fn.includes('openProfileFormAtSection('), 'the sheet Edit must open the form at the section');
});

test('C6: the bulky Danger zone box is gone; a slim standalone Delete Customer row stands alone', () => {
  assert.ok(!app.includes('class="profile-danger-zone"'), 'the danger-zone box must be gone from app.js');
  assert.ok(!index.includes('profile-danger-zone'), 'the danger-zone box must be gone from index.html');
  assert.ok(!styles.includes('.profile-danger-zone'), 'the danger-zone CSS must be gone');
  assert.ok(!app.includes("t('prof_danger_zone_title')"), 'the Danger zone heading must be gone from the render');
  // The row keeps the Delete id exactly once in the render …
  assert.equal((app.match(/id="deleteCustomerButton"/g) || []).length, 1, 'exactly one rendered Delete control keeps the id');
  // … plus the single delegation branch (the profile-view-polish count-2 pin).
  assert.equal((app.match(/deleteCustomerButton/g) || []).length, 2, 'exactly one render + one delegation branch reference the Delete id');
  assert.ok(app.includes('profile-delete-row'), 'the slim delete row must exist');
  assert.ok(app.includes("t('prof_action_delete')"), 'the row label must reuse the existing Delete customer key');
});

test('C7: the delete row opens a confirmation bottom sheet; confirm still snapshots, purges, deletes and offers the 5-second Undo', () => {
  const handler = deleteHandlerSlice();
  // No appConfirm dialog for this button any more — the row opens a sheet.
  assert.ok(!handler.includes('appConfirm'), 'the delete tap must not open the old appConfirm dialog');
  assert.ok(handler.includes('Sheet') || handler.includes('sheet'), 'the delete tap must open a confirmation sheet');
  // The destructive sequence is verbatim.
  assert.ok(handler.includes('snapshotBeforeDestructiveAction'), 'confirm must snapshot before deleting');
  assert.ok(handler.includes('purgeCustomerHistoryFromStorage'), 'confirm must purge the per-customer history stores');
  assert.ok(handler.includes('deleteCustomer(state, customer.id)'), 'confirm must delete the customer record');
  assert.ok(handler.includes('duration:5000'), 'the deleted toast must keep the 5-second Undo window');
  assert.ok(handler.includes("actionLabel:'Undo'"), 'the deleted toast must keep the Undo action');
  assert.ok(handler.includes('restoreCustomerHistoryToStorage'), 'Undo must restore the purged history');
});

test('C8: the top tabs read Billing, Info, Complaints, Baqaya with no number prefixes', () => {
  assert.ok(!index.includes('profile-tab-number'), 'no number span may remain in the tab bar');
  for (const [id, key] of [['profileTabBilling', 'prof_tab_billing'], ['profileTabInfo', 'prof_tab_info'], ['profileTabComplaints', 'prof_tab_complaints'], ['profileTabBaqaya', 'prof_tab_baqaya']]) {
    const at = index.indexOf(`id="${id}"`);
    assert.notEqual(at, -1, `${id} must exist`);
    const btn = index.slice(at, index.indexOf('</button>', at));
    assert.ok(btn.includes(`data-i18n="${key}"`), `${id} must keep its label key`);
    assert.ok(!btn.includes('1·') && !btn.includes('2·') && !btn.includes('3·') && !btn.includes('4·'), `${id} must carry no number prefix`);
  }
});

test('S1: Customer, Service and Financial sections still render as <details> shells', () => {
  const view = viewSlice();
  for (const key of ['customer', 'service', 'financial']) {
    assert.ok(view.includes(`profileDetailSectionHtml({ key: '${key}'`), `${key} must keep its <details> shell`);
  }
});

test('S2: the new grouped-list / row / sheet / delete-row rules use tokens only (no new hex)', () => {
  const rules = styles.match(/\.profile-info-(grouped-list|row|row-icon|row-title|row-subtitle|row-chevron)[^{]*\{[^}]*\}|\.profile-delete-row[^{]*\{[^}]*\}|\.profile-section-sheet[^{]*\{[^}]*\}/g) || [];
  const stripped = styles.replace(/\.profile-info-(grouped-list|row|row-icon|row-title|row-subtitle|row-chevron)[^{]*\{[^}]*\}|\.profile-delete-row[^{]*\{[^}]*\}|\.profile-section-sheet[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((stripped.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    for (const hex of rule.match(/#[0-9a-fA-F]{3,8}/g) || []) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex ${hex} in ${rule.slice(0, 60)}`);
    }
  }
});

test('S3: profile-sections.js is untouched — the open/closed store still covers all seven keys', () => {
  assert.deepEqual(profileSections.PROFILE_SECTION_KEYS, ['customer', 'service', 'financial', 'connection', 'network', 'hardware', 'history']);
  assert.equal(profileSections.PROFILE_SECTION_OPEN_KEY, 'shahdara_profile_section_open_v1');
  assert.deepEqual(profileSections.PROFILE_SECTION_DEFAULT_OPEN, {
    customer: true, service: true, financial: true,
    connection: false, network: false, hardware: false, history: false,
  });
});

test('B1: the History row carries no Edit entry (zero form fields, as today)', () => {
  const view = viewSlice();
  const rowStart = view.indexOf('data-profile-info-row="history"');
  assert.notEqual(rowStart, -1, 'history row must exist');
  const rowEnd = view.indexOf('</button>', rowStart);
  const row = view.slice(rowStart, rowEnd === -1 ? rowStart + 1200 : rowEnd);
  assert.ok(!row.includes('profile-section-edit'), 'history row must carry no Edit button');
});

test('B2: the section sheet closes via backdrop tap, Escape and swipe-down (the mobile-action-sheet behaviours)', () => {
  const sheetJs = app + '\n' + navJs;
  assert.ok(sheetJs.includes('profileSectionSheetBackdrop'), 'the sheet backdrop must be wired');
  assert.ok(/Escape/.test(sheetJs), 'Escape must close a sheet');
  assert.ok(navJs.includes('touchmove') || app.includes('touchmove'), 'swipe-down must dismiss the sheet');
});
