import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Plan 506 — Call/WhatsApp shortcuts and the profit line sit with their
// numbers: the contact shortcuts move from halfway down the profile view to
// immediately after the phone row inside the Contact group, and the profit
// line moves from a lone paragraph mid-page into the Service group beside
// the selling amount. No figure changes; all money stays PKR only.
//
// Polish #28 Phase A — the money rows (tax, purchase, selling, profit)
// moved out of the Service group into the money fragment, which renders
// in the Financial section; profit still sits immediately after selling.
//
// Boundaries, stated plainly: the print card and the header strip carry
// neither the shortcuts nor the profit line, so they are untouched. The
// `.profile-view-profit` CSS rule is left in place, unreferenced —
// removing it would mean editing dark-contrast.css's shared selector list
// for zero user-visible benefit.

function groupsLiteral() {
  const app = read('app.js');
  // Polish #28 Phase A — the four-groups literal became the eight
  // fragments object (profileInfoGroupFragments); the proximity pins
  // follow the new name, rows verbatim.
  const start = app.indexOf('const profileInfoGroupFragments = {');
  assert.notEqual(start, -1, 'fragments object must exist');
  const end = app.indexOf('\n', start);
  return app.slice(start, end);
}

function groupMarkupFunctions() {
  const app = read('app.js');
  const start = app.indexOf('function profileReadonlyField(');
  assert.notEqual(start, -1, 'profileReadonlyField must exist');
  const markupStart = app.indexOf('function profileInfoGroupMarkup(');
  assert.notEqual(markupStart, -1, 'profileInfoGroupMarkup must exist');
  const end = app.indexOf('\n}\n', markupStart);
  assert.notEqual(end, -1, 'profileInfoGroupMarkup must end cleanly');
  const src = app.slice(start, end + 3);
  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Polish #28 Phase B (Req 3) — profileReadonlyField wraps the bare
  // dash in .profile-empty-value, so the dash constant must be in the
  // sandbox with it.
  return runInNewContext(`${src}\nprofileInfoGroupMarkup;`, { escapeHtml, PROFILE_EMPTY_DASH: '—' });
}

function viewAssembly() {
  const app = read('app.js');
  const start = app.indexOf("$('#customerProfileView').innerHTML = ");
  assert.notEqual(start, -1, 'view assembly must exist');
  const end = app.indexOf('\n', start);
  return app.slice(start, end);
}

function contactActionsLine() {
  const app = read('app.js');
  const start = app.indexOf('const contactActionsHtml = ');
  assert.notEqual(start, -1, 'contactActionsHtml must exist');
  const end = app.indexOf('\n', start);
  return app.slice(start, end);
}

// ------------------------------------------------------------ the rule itself

test('Plan 506: the move is written down as code comments at the group renderer and the actions block', () => {
  const app = read('app.js');
  assert.ok(app.includes('Plan 506 — Call/WhatsApp shortcuts and the profit line sit with their'), 'rule comment must sit at profileInfoGroupMarkup');
  assert.ok(app.includes('immediately after its first row (the phone row)'), 'rule must name the phone-row placement');
  assert.ok(app.includes('the contact shortcuts (and the no-WhatsApp hint) travel with'), 'rule must name the travelling block');
});

// ------------------------------------------------------------ the group renderer

test('Plan 506: group markup renders the optional block immediately after the first row', () => {
  const profileInfoGroupMarkup = groupMarkupFunctions();
  const html = profileInfoGroupMarkup('Contact', [['Phone', '03012345678'], ['CNIC', '35201-1234567-1']], '<div class="profile-readonly-field-wide"><div class="profile-contact-shortcuts"><a>Call</a></div><p class="profile-contact-note">hint</p></div>');
  const phoneIdx = html.indexOf('<dt>Phone</dt>');
  const shortcutsIdx = html.indexOf('profile-contact-shortcuts');
  const cnicIdx = html.indexOf('<dt>CNIC</dt>');
  assert.ok(phoneIdx !== -1 && shortcutsIdx !== -1 && cnicIdx !== -1, 'phone row, shortcuts and CNIC row must all render');
  assert.ok(phoneIdx < shortcutsIdx && shortcutsIdx < cnicIdx, 'shortcuts must sit immediately after the phone row, before CNIC');
  assert.ok(html.includes('profile-readonly-field-wide'), 'actions block must span both grid columns');
  assert.ok(html.indexOf('profile-contact-note') > shortcutsIdx, 'the no-WhatsApp hint travels with the shortcuts');
  assert.ok(html.includes('<dd>03012345678</dd>'), 'phone value still renders');
});

test('Plan 506: without the block, the group renders its rows in order and unchanged', () => {
  const profileInfoGroupMarkup = groupMarkupFunctions();
  const html = profileInfoGroupMarkup('Contact', [['Phone', '03012345678'], ['CNIC', '35201-1234567-1']]);
  assert.ok(!html.includes('profile-contact-shortcuts'), 'no shortcuts without the block');
  assert.ok(html.indexOf('<dt>Phone</dt>') < html.indexOf('<dt>CNIC</dt>'), 'rows stay in order');
  assert.ok(html.startsWith('<section class="profile-info-group"><h4>Contact</h4>'), 'section and heading unchanged');
});

// ------------------------------------------------------------ the Contact group

test('Plan 506: Contact group passes the actions block as its third argument', () => {
  const groups = groupsLiteral();
  // Polish #28 Phase A — the contact call now ends `], contactActionsHtml)`
  // inside the fragments object (the old literal closed the template
  // interpolation with `)}` after it — same call, new container).
  assert.ok(groups.includes('], contactActionsHtml)'), 'Contact group must pass contactActionsHtml after its rows');
  assert.ok(groups.indexOf('contactActionsHtml') < groups.indexOf("t('prof_group_location')"), 'Contact group (with shortcuts) still comes before the Location group');
});

test('Plan 506: the actions block keeps the shortcuts div and the hint, spanning both columns', () => {
  const line = contactActionsLine();
  assert.ok(line.includes('(phoneActions || phoneHint)'), 'block renders only when there is something to show');
  assert.ok(line.includes('class="profile-readonly-field-wide"'), 'block spans both grid columns');
  assert.ok(line.includes('<div class="profile-contact-shortcuts">${phoneActions}</div>'), 'shortcuts keep their own div and styling');
  assert.ok(line.includes('${phoneHint}'), 'the no-WhatsApp hint travels with the shortcuts');
});

// ------------------------------------------------------------ the Service group

test('Plan 506: profit row sits immediately after the selling row in the money fragment', () => {
  const groups = groupsLiteral();
  // Polish #28 Phase A — tax, purchase, selling and profit moved out of
  // the Service group into the money fragment (Financial section); the
  // profit-after-selling adjacency is pinned inside that fragment.
  // Polish #28 Phase B (Req 3) — the null-profit branch now renders
  // the dash with the missing-component note (profileProfitDisplay),
  // not "Not set"; the adjacency is unchanged.
  const moneyAt = groups.indexOf('money: profileInfoGroupMarkup(');
  const money = groups.slice(moneyAt, groups.indexOf('lifecycle: profileInfoGroupMarkup(', moneyAt));
  const selling = "[t('prof_field_selling'), profileEmptyMoney(customer.monthlySellingAmount)]";
  const profit = "[t('prof_field_profit'), profileProfitDisplay(customer, profit)]";
  const sellingIdx = money.indexOf(selling);
  const profitIdx = money.indexOf(profit);
  assert.ok(sellingIdx !== -1, 'selling row must exist');
  assert.ok(profitIdx !== -1, 'profit row must exist beside it');
  assert.equal(money.slice(sellingIdx + selling.length, profitIdx), ', ', 'profit must follow selling with nothing between');
});

test('Plan 506: profit row uses the shared PKR format with the dash path, never a hand-built figure', () => {
  const groups = groupsLiteral();
  assert.ok(groups.includes("profileProfitDisplay(customer, profit)"), 'null profit reads the dash with the missing-component note, like the other money rows');
  assert.equal(groups.indexOf('toLocaleString'), -1, 'no hand-built number formatting may remain in the fragments');
});

// ------------------------------------------------------------ the old mid-page blocks are gone

test('Plan 506: view assembly no longer renders the shortcuts, hint or profit line mid-page', () => {
  const assembly = viewAssembly();
  assert.ok(!assembly.includes('profile-contact-shortcuts'), 'no standalone shortcuts div after the groups');
  assert.ok(!assembly.includes('${phoneHint}'), 'no phone hint after the groups');
  assert.ok(!assembly.includes('profile-view-profit'), 'no lone profit paragraph after the groups');
  assert.ok(!assembly.includes('prof_view_profit'), 'the old profit sentence key is no longer rendered');
  // Polish #28 Phase A — the groups are fragments inside section
  // bodies now; the money fragment still comes before the
  // cross-payments section, inside Financial.
  const app = read('app.js');
  const financialBodyAt = app.indexOf('const profileSectionFinancialBody = ');
  const financialBody = app.slice(financialBodyAt, app.indexOf('\n', financialBodyAt));
  assert.ok(financialBody.indexOf('profileInfoGroupFragments.money') < financialBody.indexOf('crossPaymentsMadeSectionMarkup'), 'money fragment still comes first, then the cross-payments section');
});

// ------------------------------------------------------------ i18n

test('Plan 506: prof_field_profit exists in English and Urdu with real values; the old sentence key is gone', () => {
  assert.equal(TRANSLATIONS.en.prof_field_profit, 'Monthly package profit');
  assert.equal(TRANSLATIONS.ur.prof_field_profit, 'ماہانہ پیکیج منافع');
  assert.match(TRANSLATIONS.ur.prof_field_profit, /[\u0600-\u06FF]/, 'ur value must carry Urdu script');
  assert.equal(TRANSLATIONS.en.prof_view_profit, undefined, 'old profit sentence key must be gone from EN');
  assert.equal(TRANSLATIONS.ur.prof_view_profit, undefined, 'old profit sentence key must be gone from UR');
});
