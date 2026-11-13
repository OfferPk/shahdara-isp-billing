// Profile View Polish (user spec 2026-11-13, 2 screenshots + "Active
// badge 2 jaggah hai yeah 1 jaggah hona chahyee bass"): the top
// Customer Summary / Billing card and the `2. Info` tab — clean 2x2
// billing grid, one Active badge (header only), Call/WhatsApp beside
// the phone, Delete out of the action group into a danger zone at the
// Info-tab bottom, smart Clear dues state, concise utility labels,
// emerald zero-dues pill + 12px strip cards, one merged completion
// bar. Source-scan pins + module unit tests (no jsdom in the unit
// gate). Synthetic data only — pattern-fake numbers, no real customer
// names or phone numbers anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import { getCustomerPaymentDefaults } from '../nav-quick-collect.js';
import { contactActionTargets } from '../profile-ui.js';
import { buildProfileHeaderStrip, profileHeaderStripHtml } from '../profile-header-strip.js';
import { missingFieldsChecklistHtml } from '../missing-fields-checklist.js';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const index = read('index.html');
const app = read('app.js');
const styles = read('styles.css');
const tokens = read('tokens.css');

const today = new Date('2026-10-07T12:00:00+05:00');

// (1) The Active pill lives in the header title row only: the
// .profile-status-stack is the title row's second grid child (after
// the identity block), not a sibling row below it.
test('profile view polish: Active pill stack sits INSIDE the title row as its second child', () => {
  const titleRowAt = index.indexOf('<div class="detail-title-row">');
  assert.ok(titleRowAt >= 0, 'title row exists');
  const billAt = index.indexOf('id="customerCurrentBillSummary"', titleRowAt);
  const billDivAt = index.lastIndexOf('<div', billAt);
  const head = index.slice(titleRowAt, billDivAt);
  assert.ok(head.includes('<div class="profile-status-stack">'), 'status stack is inside the title row');
  assert.ok(head.indexOf('profile-identity-block') < head.indexOf('profile-status-stack'), 'identity block first, stack second');
  const opens = (head.match(/<div/g) || []).length;
  const closes = (head.match(/<\/div>/g) || []).length;
  assert.equal(opens, closes, 'the title row opens and closes inside the slice — the stack is not a sibling row');
});

// (2) The Info heading-badges row no longer repeats the derived
// service-status pill; the Service section keeps its word-only
// summary pill (Polish C (15), deliberate — a summary line, not a badge).
test('profile view polish: heading badges drop the service-status pill; Service summary word-only pill stays', () => {
  const badgesLine = app.split('\n').find((line) => line.includes('const headingBadgesHtml'));
  assert.ok(badgesLine, 'headingBadgesHtml line exists');
  assert.ok(!badgesLine.includes('profileServiceStatusPillHtml'), 'the badges row carries no service-status pill');
  assert.ok(app.includes('profileServiceStatusPillHtml(serviceState, { wordOnly: true })'), 'the Service section summary word-only pill is still rendered');
});

// (3) Call / WhatsApp icon buttons beside the phone: static anchors
// with the Phone / MessageCircle icons, hrefs set from the same
// contact targets the Contact group uses, disabled WhatsApp fallback
// when the number cannot do WhatsApp.
test('profile view polish: Call / WhatsApp anchors sit beside the phone line with tel: / wa.me targets', () => {
  assert.ok(index.includes('id="profileCallButton"'), 'Call button exists');
  assert.ok(index.includes('id="profileWhatsAppButton"'), 'WhatsApp button exists');
  assert.ok(index.includes('id="profileWhatsAppButtonDisabled"'), 'disabled WhatsApp fallback exists');
  const callLine = index.split('\n').find((line) => line.includes('id="profileCallButton"'));
  assert.ok(callLine.includes('data-ds-icon="Phone"'), 'Call carries the Phone icon');
  const waLine = index.split('\n').find((line) => line.includes('id="profileWhatsAppButton"'));
  assert.ok(waLine.includes('data-ds-icon="MessageCircle"'), 'WhatsApp carries the MessageCircle icon');
  assert.ok(app.includes('contactActionTargets(headerPhone)'), 'renderDetail builds the targets from the saved phone');
  assert.ok(app.includes('whatsappPhoneFor(customer)'), 'renderDetail resolves the WhatsApp number the same way as the Contact group');
  assert.ok(app.includes('headerWhatsapp'), 'renderDetail reads the resolved wa.me target');
  // Behavioural (pattern-fake numbers only): a Pakistani mobile gets
  // tel: + wa.me; a number that cannot do WhatsApp gets tel: only.
  assert.deepEqual(contactActionTargets('03012345678'), { tel: 'tel:03012345678', whatsapp: 'https://wa.me/923012345678' });
  const short = contactActionTargets('123');
  assert.equal(short.tel, 'tel:123');
  assert.equal(short.whatsapp, null);
  assert.equal(contactActionTargets('not a number'), null);
});

// (4) Action group is Edit / Clear dues / Wada / Record payment /
// Archive (no Delete); exactly one Delete button, inside the danger
// zone at the end of #customerProfileView, bound by delegation.
test('profile view polish: Delete leaves the action group for the Info-tab danger zone, bound by delegation', () => {
  const groupAt = index.indexOf('class="profile-action-group"');
  const detailsAt = index.indexOf('id="profileMoreActionsDetails"', groupAt);
  const order = ['editProfileButton', 'clearDuesButton', 'topWadaButton', 'currentBillPaymentShortcut', 'archiveCustomerButton'];
  let previousAt = groupAt;
  for (const id of order) {
    const at = index.indexOf(`id="${id}"`, groupAt);
    assert.ok(at > previousAt && at < detailsAt, `${id} follows the previous action, ahead of More actions`);
    previousAt = at;
  }
  assert.ok(!index.includes('id="deleteCustomerButton"'), 'no Delete button remains in the static action group');
  assert.ok(app.includes('id="deleteCustomerButton"'), 'the zone renders the Delete button with its id');
  assert.strictEqual((app.match(/deleteCustomerButton/g) || []).length, 2, 'exactly one rendered Delete button plus the delegation branch — no second copy');
  const zoneAt = app.indexOf('profile-danger-zone');
  assert.ok(zoneAt > app.indexOf('Object.entries(PROFILE_SECTION_TAB)'), 'the zone is appended after the section-move loop (bottom of the Info tab)');
  assert.ok(app.includes("$('#customerProfileView')?.addEventListener('click'"), 'the binding is delegated on #customerProfileView');
  assert.ok(app.includes("event.target.closest('#deleteCustomerButton')"), 'delegation branches on the Delete id');
  assert.ok(app.includes("t('prof_danger_zone_title')"), 'the zone heading is the i18n Danger zone key');
});

// (5) Smart Clear dues: disabled + '✓ All Dues Cleared' when the FULL
// payable total is 0 — and NOT disabled when only the current-month
// net due is 0 but charges still pend (the trigger is payableTotal,
// never the displayed net due).
test('profile view polish: Clear dues disables on payableTotal === 0, not on the displayed net due', () => {
  assert.ok(app.includes('getCustomerPaymentDefaults(state, customer.id, new Date(), loadTickets()).payableTotal'), 'the smart state reads the full payable total');
  assert.ok(app.includes('clearDuesPayable === 0'), 'the disabled branch keys on payableTotal === 0');
  assert.ok(app.includes("t('prof_action_dues_cleared')"), 'the cleared label is the new i18n key');
  assert.ok(app.includes("clearDuesBtn.classList.add('clear-dues-cleared')"), 'the cleared state carries its quiet class');
  assert.ok(app.includes("clearDuesBtn.setAttribute('aria-disabled', 'true')"), 'the cleared state is exposed to assistive tech');
  assert.equal(TRANSLATIONS.en.prof_action_dues_cleared, '✓ All Dues Cleared');
  assert.match(TRANSLATIONS.ur.prof_action_dues_cleared, /[\u0600-\u06FF]/, 'Urdu cleared label carries Urdu script');
  // Behavioural trigger: a customer with no bills and no charges owes
  // nothing; a customer whose bills are fully settled but a billed
  // ticket charge still pends still owes — the button must stay
  // enabled even though the displayed current-month net due is 0.
  let state = createInitialState(['Ali', 'Bina']);
  assert.equal(getCustomerPaymentDefaults(state, 'seed-001', today, []).payableTotal, 0, 'no bills, no charges: nothing payable');
  state = saveBillMonth(state, 'seed-001', { month: '2026-10', dueAmount: '1000', status: 'pending' }, today);
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-05', amount: '1000', method: 'Cash' }, today);
  const tickets = [{ id: 'TKT-1', customerId: 'seed-001', status: 'Resolved', billingType: 'billed', chargePaid: false, materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500 }], createdAt: '2026-10-05T10:00:00' }];
  assert.equal(getCustomerPaymentDefaults(state, 'seed-001', today, tickets).payableTotal, 500, 'bills settled but a ticket charge pends: only the charge is payable');
});

// (6) Utility labels are concise in both dicts, no duplicate speaker
// emoji in Speak Due, and the row rule is 0.75rem / 10px 6px.
test('profile view polish: utility labels concise, no duplicate speaker emoji, 12px / 10px-6px row', () => {
  assert.equal(TRANSLATIONS.en.prof_view_qr, 'QR Khata');
  assert.equal(TRANSLATIONS.ur.prof_view_qr, 'QR کھاتہ');
  assert.equal(TRANSLATIONS.en.prof_view_print_card, 'Print Card');
  assert.equal(TRANSLATIONS.en.speak_due_btn, 'Speak Due');
  assert.equal(TRANSLATIONS.ur.speak_due_btn, 'بقایا سنیں');
  assert.ok(!TRANSLATIONS.en.speak_due_btn.includes('🔊'), 'no speaker emoji in the English Speak Due label');
  assert.ok(!TRANSLATIONS.ur.speak_due_btn.includes('🔊'), 'no speaker emoji in the Urdu Speak Due label');
  assert.match(styles, /\.profile-view-actions>button\{[^}]*padding:10px 6px;[^}]*font-size:0\.75rem/, 'utility buttons are 0.75rem with 10px 6px padding');
});

// (7) Strip zero case: a zero balance reads soft emerald (modifier
// class + 'No amount due'), a positive balance stays red; the strip
// is a 2-column grid and the pills are 12px cards, not stadium ovals.
test('profile view polish: zero dues read soft emerald, positive dues stay red, strip is a 2-col grid of 12px cards', () => {
  const base = {
    customerId: 'CUST-1', customerName: 'Test Customer', outstanding: 0,
    packageLabel: '5 Mbps — 200 GB', packagePrice: 2000,
    lastPayment: { date: '2026-10-19', amount: 2000 }, nextDueDate: '2026-11-05',
  };
  const zeroHtml = profileHeaderStripHtml(buildProfileHeaderStrip(base));
  assert.ok(zeroHtml.includes('phs-pill-dues-zero'), 'the zero-dues pill carries the modifier class');
  assert.ok(zeroHtml.includes('No amount due'), 'the zero-dues text is unchanged');
  const owedHtml = profileHeaderStripHtml(buildProfileHeaderStrip({ ...base, outstanding: 3000 }));
  assert.ok(!owedHtml.includes('phs-pill-dues-zero'), 'a positive balance takes no zero modifier');
  assert.ok(owedHtml.includes('PKR 3000'), 'the owed figure is unchanged');
  assert.ok(tokens.includes('--phs-dues-zero-bg: #ECFDF5'), 'the zero background token exists');
  assert.ok(tokens.includes('--phs-dues-zero-border: #A7F3D0'), 'the zero border token exists');
  assert.match(styles, /\.phs-pill\{[^}]*border-radius:12px/, 'strip pills are 12px cards');
  assert.match(styles, /\.phs-pill-dues-zero\{[^}]*background:var\(--phs-dues-zero-bg\)/, 'the zero modifier reads the token, not a literal hex');
  assert.ok(read('profile-header-strip.js').includes('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr))'), 'the strip container is a 2-column grid');
});

// (8) Completion: one merged <details> with the summary text + neutral
// bar; the old counter <p> is gone from the view render; the jump
// handler still binds via .mfc-checklist; the form bar is untouched.
test('profile view polish: fields-filled + missing-fields merge into one collapsible bar', () => {
  const texts = {
    title: 'Profile Details (11/68 filled)',
    showMissing: 'Show 57 optional fields',
    hideMissing: 'Hide optional fields',
    allFilled: 'All fields filled',
    total: 68, filled: 11, percent: 16,
  };
  const missing = Array.from({ length: 57 }, (_, i) => ({ controlId: `c${i}`, fieldKey: `f${i}` }));
  const html = missingFieldsChecklistHtml(missing, {}, texts);
  assert.ok(html.includes('<details class="profile-completion-details mfc-checklist"'), 'one merged details keeps the mfc-checklist class');
  assert.ok(html.includes('Profile Details (11/68 filled)'), 'the summary carries the live filled/total title');
  assert.ok(html.includes('Show 57 optional fields ▾'), 'the summary carries the show-missing label');
  assert.ok(html.includes('class="profile-details-bar" role="progressbar"'), 'the summary carries the neutral bar');
  assert.ok(html.includes('width:16%'), 'the bar width is the live percent');
  assert.ok(!html.includes('mfc-count-pill'), 'no count pill any more');
  assert.ok(!html.includes('mfc-bar-fill-red'), 'no red/yellow tone band any more');
  assert.ok(html.includes('data-missing-field="c0"'), 'the jump list survives inside the details');
  const allFilled = missingFieldsChecklistHtml([], {}, texts);
  assert.ok(allFilled.includes('All fields filled'), 'a complete profile shows the all-filled line');
  assert.ok(!allFilled.includes('Show 57 optional fields'), 'no show label when nothing is missing');
  assert.ok(!app.includes('<p class="profile-completion-counter">'), 'the old counter <p> is gone from the view render');
  assert.ok(app.includes("querySelector('.mfc-checklist')?.addEventListener('click'"), 'the jump handler still binds on .mfc-checklist');
  assert.ok(app.includes("querySelector('.profile-view-heading')?.insertAdjacentHTML('afterend', missingFieldsChecklistHtml("), 'one insertion under the heading renders the merged bar');
  for (const cls of ['.profile-completion-details', '.profile-details-summary', '.profile-details-bar', '.profile-details-fill']) {
    assert.ok(styles.includes(cls), `styles must define ${cls}`);
  }
});

// New keys exist in both dicts (UR values carry Urdu script).
test('profile view polish: new i18n keys exist in English and Urdu', () => {
  for (const key of ['prof_danger_zone_title', 'prof_danger_zone_help', 'prof_completion_details_title', 'prof_completion_show_missing', 'prof_completion_hide_missing', 'prof_action_dues_cleared']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `${key} exists in English`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `${key} exists in Urdu`);
    assert.match(TRANSLATIONS.ur[key], /[\u0600-\u06FF]/, `${key} Urdu value carries Urdu script`);
  }
  assert.equal(TRANSLATIONS.en.prof_danger_zone_title, 'Danger zone');
  assert.equal(TRANSLATIONS.en.prof_completion_details_title, 'Profile Details ({filled}/{total} filled)');
});
