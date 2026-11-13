import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Profile Inner Tabs Overhaul — the profile's seven inner sections are
// strictly filtered by sub-tab (D1), the §2/§3/§4 defects are fixed, and
// the four secondary forms collapse into accordions (§6). The Financial
// section is MOVED into the Billing panel (the prep's "no DOM moves
// needed" was wrong: the sections are built inside #customerProfileView,
// which the boot mount put in the Info panel). Generic placeholders
// only — no figure, name, or number from any user screenshot.

// ------------------------------------------------------------ §2: the raw-code leak

test('Inner Tabs: the money class rides the extraClass route, never as visible HTML', () => {
  const app = read('app.js');
  assert.ok(app.includes("netDisplay]], '', 'profile-info-group--money'"), 'money passes the class as the 4th arg (extraClass)');
  assert.ok(!app.includes("netDisplay]], 'profile-info-group--money'"), 'the 3rd-arg (visible HTML) form is gone');
  assert.ok(!app.includes("]], 'profile-info-group--money'"), 'no fragment passes the class as visible HTML');
});

// ------------------------------------------------------------ §1: clipping

test('Inner Tabs: the Financial summary can shrink so its subtitle cannot overlap the title', () => {
  const styles = read('styles.css');
  const rule = styles.match(/\.profile-section-summary\{[^}]*\}/);
  assert.ok(rule, 'the summary rule must exist');
  assert.ok(rule[0].includes('min-width:0'), 'the summary needs min-width:0 to shrink inside the flex summary');
});

test('Inner Tabs: the first-bill table scrolls horizontally instead of clipping', () => {
  const styles = read('styles.css');
  const rule = styles.match(/#firstBillPreviewResult \.first-bill-preview\{[^}]*\}/);
  assert.ok(rule, 'the first-bill card rule must exist');
  assert.ok(rule[0].includes('overflow-x:auto'), 'the table wrapper scrolls horizontally at the phone edge');
  assert.ok(!rule[0].includes('overflow:hidden'), 'the blanket overflow:hidden clip is gone');
});

test('Inner Tabs: the kist down-payment checkbox keeps a 22px box', () => {
  const styles = read('styles.css');
  const rule = styles.match(/\.kist-add-grid input\[type="checkbox"\]\{[^}]*\}/);
  assert.ok(rule, 'the checkbox override must exist');
  assert.ok(rule[0].includes('width:22px'), 'checkbox is 22px wide, not the grid 100%');
  assert.ok(rule[0].includes('height:22px'), 'checkbox is 22px tall, not the grid 40px');
});

test('Inner Tabs: profile help buttons are 32px round, not stretched ovals', () => {
  const styles = read('styles.css');
  const rule = styles.match(/\.profile-detail-section \.help-info-btn\{[^}]*\}/);
  assert.ok(rule, 'the profile-scoped help-button rule must exist');
  assert.ok(rule[0].includes('width:32px'), '32px wide');
  assert.ok(rule[0].includes('height:32px'), '32px tall');
  assert.ok(rule[0].includes('min-height:32px!important'), 'the 44px global button floor is beaten, button-only');
  assert.ok(rule[0].includes('flex-shrink:0'), 'the button never squeezes in the flex summary');
});

test('Inner Tabs: phone-width form labels stack above their inputs (360px fit, rule-based)', () => {
  const styles = read('styles.css');
  const media = styles.match(/@media\(max-width:620px\)\{\.pcp-form label\{[^}]*\}[^}]*\}/);
  assert.ok(media, 'the phone-width pcp-form stacking rule must exist');
  assert.ok(media[0].includes('flex-direction:column'), 'labels stack above inputs');
  assert.ok(media[0].includes('flex-basis:100%'), 'each label takes a full row');
});

// ------------------------------------------------------------ §3: one source of truth

test('Inner Tabs: the month snapshot pills read the allocation engine, with the recorded fields as fallback', () => {
  const app = read('app.js');
  assert.ok(app.includes('monthAllocation?.billAmountCents'), 'bill amount comes from the engine billed total');
  assert.ok(app.includes('monthAllocation?.actualReceiptsCents'), 'receipts come from the safeCents-guarded engine total');
  assert.ok(app.includes('(bill ? recordedAmount(bill) : 0)'), 'unpriced months still fall back to the recorded receipts');
  assert.ok(!app.includes('const received = bill ? recordedAmount(bill) : 0;'), 'receipts no longer read the recorded field first');
  assert.ok(!app.includes('const effectiveAmount = bill?.dueAmount ?? null;'), 'the recorded bill amount no longer feeds the pill first');
});

test('Inner Tabs: the stored selling price is labelled as stored, and the pinned key is untouched', () => {
  const app = read('app.js');
  assert.ok(app.includes("[t('prof_field_selling_stored'), profileEmptyMoney(customer.monthlySellingAmount)]"), 'the money fragment labels the stored price');
  assert.ok('prof_field_selling_stored' in TRANSLATIONS.en, 'the stored label exists in EN');
  assert.ok('prof_field_selling_stored' in TRANSLATIONS.ur, 'the stored label exists in UR');
  assert.match(TRANSLATIONS.en.prof_field_selling_stored, /not this month/, 'the EN label says it is not this month\'s billed amount');
  assert.match(TRANSLATIONS.ur.prof_field_selling_stored, /[\u0600-\u06FF]/, 'the UR label reads Urdu');
  assert.ok('prof_field_selling' in TRANSLATIONS.en && 'prof_field_selling' in TRANSLATIONS.ur, 'the pinned selling key stays in both dicts');
});

// ------------------------------------------------------------ §4: dedup

test('Inner Tabs: the bill-clarity strip is gone from the month summary; the helper stays', () => {
  const app = read('app.js');
  assert.equal((app.match(/billClarityMarkup\(customer, bill, allocations\)/g) || []).length, 1, 'only the helper definition keeps the signature — no render call feeds the strip');
  assert.ok(!app.includes('${clarityMarkup}'), 'no clarity markup rides the summary');
  assert.ok(app.includes('function billClarityMarkup(customer, bill, allocations)'), 'the helper itself stays for its direct module tests');
});

test('Inner Tabs: the first-bill section renders only before the first bill', () => {
  const app = read('app.js');
  assert.ok(app.includes("(customer.bills ?? []).length > 0 ? '' : `<details"), 'a customer with bills gets no section at all');
  assert.ok(!app.includes('This customer already has bills'), 'the in-section banner for billed customers is gone with the section');
});

test('Inner Tabs: Wada keeps one empty state — the health line', () => {
  const app = read('app.js');
  const start = app.indexOf('function wadaProfileBannerHtml(customer) {');
  assert.notEqual(start, -1, 'the banner function must exist');
  const fn = app.slice(start, app.indexOf('\nfunction renderDetail() {', start));
  assert.ok(!fn.includes('<p class="wada-banner-none">'), 'the duplicate empty line is gone from the banner');
  assert.ok(!fn.includes('No open wada for this customer.'), 'the duplicate empty text is gone from the banner');
  assert.ok(fn.includes('class="wada-health"'), 'the health line is the single empty state');
  const record = read('wada-record.js');
  assert.ok(record.includes("return 'No wadas recorded for this customer.'"), 'no wadas reads through the health line');
});

test('Inner Tabs: the Wada form is chips on one row above a 2-col date | amount row', () => {
  const styles = read('styles.css');
  assert.ok(styles.includes('.wada-quick-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'), 'the form is a 2-col grid');
  assert.ok(styles.includes('.wada-quick-form .waada-chip-row{grid-column:1/-1}'), 'chips span the full row');
  assert.ok(styles.includes('.wada-quick-form label[for="wadaQuickNote"]{grid-column:1/-1}'), 'the note spans the full row');
  assert.ok(styles.includes('.wada-quick-form #wadaQuickSaveBtn{grid-column:1/-1}'), 'the button spans the full row');
});

// ------------------------------------------------------------ D1: strict filter

test('Inner Tabs (D1): only Financial is mapped to Billing; History stays in Info', () => {
  const app = read('app.js');
  const map = app.match(/const PROFILE_SECTION_TAB = \{[^}]*\};/);
  assert.ok(map, 'the section-to-tab mapping must exist in one place');
  assert.ok(map[0].includes("financial: 'billing'"), 'Financial lives under Billing');
  for (const key of ['customer', 'service', 'connection', 'network', 'hardware', 'history', 'complaints', 'baqaya']) {
    assert.ok(!map[0].includes(key), `${key} is not mapped away from Info`);
  }
  assert.ok(app.includes('Object.entries(PROFILE_SECTION_TAB)'), 'the move is driven by the mapping');
  assert.ok(app.includes('panel.append(section)'), 'the section node is moved, not re-rendered');
  assert.ok(app.includes("querySelector(`[data-profile-section=\"${sectionKey}\"]`)"), 'the move targets the section by key');
});

test('Inner Tabs (D1): the move runs after the section wiring, so no listener is lost', () => {
  const app = read('app.js');
  const moveAt = app.indexOf('Object.entries(PROFILE_SECTION_TAB)');
  assert.ok(moveAt > 0, 'the move must exist');
  for (const anchor of [
    "querySelector('#firstBillPreviewShowBtn')",
    "querySelector('#packageChangePreviewShowBtn')",
    "querySelector('#qualityLogAddBtn')",
    "querySelector('#wadaQuickForm')",
    "querySelector('#profileKistAddBtn')",
  ]) {
    assert.ok(app.indexOf(anchor) !== -1 && app.indexOf(anchor) < moveAt, `${anchor} must be wired before the move`);
  }
});

test('Inner Tabs (D1): Financial handlers re-query document-wide, so their buttons still work after the move', () => {
  const app = read('app.js');
  for (const query of [
    "document.querySelector('#firstBillPreviewStartDate')",
    "document.querySelector('#statementDraftMonth')",
    "document.querySelector('#balanceReplyVariant')",
    "document.querySelector('#paymentSlipVariant')",
    "document.querySelector('#billingCycleDueDay')",
    "document.querySelector('#paymentChannelSelect')",
    'document.querySelector(target.selector)',
  ]) {
    assert.ok(app.includes(query), `${query} must read document-wide after the move`);
  }
  for (const stale of [
    "$('#customerProfileView').querySelector('#firstBillPreviewStartDate')",
    "$('#customerProfileView').querySelector('#statementDraftMonth')",
    "$('#customerProfileView').querySelector('#balanceReplyVariant')",
    "$('#customerProfileView').querySelector('#billingCycleDueDay')",
  ]) {
    assert.ok(!app.includes(stale), `${stale} must not survive — the view no longer contains the moved section`);
  }
});

test('Inner Tabs (D1): editing from Billing lands on the Info tab, where the form lives', () => {
  const app = read('app.js');
  const fn = app.match(/function openProfileFormAtSection\(sectionKey\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, 'openProfileFormAtSection must exist');
  assert.ok(fn[0].indexOf("activateProfileTab('info');") < fn[0].indexOf('profileEditMode = true;'), 'the section Edit lands on Info before opening the form');
});

// ------------------------------------------------------------ §6: accordions

test('Inner Tabs (§6): the four secondary forms collapse into accordions, default closed', () => {
  const app = read('app.js');
  const ui = read('profile-ui.js');
  assert.ok(app.includes('<details class="profile-custody-section profile-accordion" aria-label="Package change preview"><summary>Package change preview</summary>'), 'package preview is a collapsed accordion');
  assert.ok(app.includes('<details class="profile-custody-section profile-accordion" aria-label="First-bill preview"><summary>First-bill preview</summary>'), 'first-bill preview is a collapsed accordion');
  assert.ok(app.includes('<details class="profile-accordion"><summary>Record measurement</summary>'), 'the quality-log form is a collapsed accordion');
  assert.ok(app.includes("<details class=\"profile-accordion\"><summary>${t('prof_kist_add_title')}</summary>"), 'the kist add form is a collapsed accordion');
  assert.ok(ui.includes("<details class=\"profile-accordion\"><summary>${esc(t('boost_add'))}</summary>"), 'the boost add form is a collapsed accordion');
  for (const source of [app, ui]) {
    for (const tag of source.match(/<details[^>]*profile-accordion[^>]*>/g) ?? []) {
      assert.ok(!tag.includes(' open'), `no accordion opens by default: ${tag}`);
    }
  }
  const styles = read('styles.css');
  assert.ok(styles.includes('.profile-accordion summary{'), 'the accordion summary is styled');
  assert.ok(styles.includes('.profile-accordion-body{'), 'the accordion body is styled');
});
