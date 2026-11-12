// Profile redesign (Step 2, after DS-0) — the full-profile overhaul:
// the stray </div> nesting fix, the derived service pill, the identity
// line, the .ds-stat-box billing grid, the 2-column More Actions bento
// with 6 categories, the QA tools bar (search + 6 chips + Recent /
// Favorites), Row 1 without + New customer (D6), the 32px help icon,
// the progress bar above the field counter, the complaints card, the
// sticky tabs (the html/body overflow-x rules that defeated sticky are
// gone), and the D-T6 bottom padding. The field counter total is 68.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { profileServiceState, profileIdentityLine } from '../profile-ui.js';
import {
  QA_RECENT_STORE_KEY, QA_RECENT_MAX, QA_FAVORITE_STORE_KEY, QA_RECENT_ROW_MAX,
  QA_TOOL_GROUPS, normalizeQaToolIdList, recordQaRecentTool, toggleQaFavoriteTool,
  qaToolMatches, qaVisibleToolIds, qaRowTools,
} from '../qa-tools-state.js';
import { countProfileCompletion } from '../profile-completion.js';
import { PROFILE_FIELD_SAVE_MAP } from '../profile-field-save.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const profileUi = read('profile-ui.js');
const styles = read('styles.css');
const navCss = read('nav.css');
const profileCss = read('profile-ui.css');
const lang = read('nav-language.js');
const completionSrc = read('profile-completion.js');

// (a) Nesting — the stray </div> (old index.html:7440) popped the
// billing block and the action group out of the card and the tabs out
// of #detailPane. After the fix the card holds header + billing +
// actions, and the tabs + mounts sit inside #detailPane, outside the
// card.
test('profile redesign: billing and actions sit inside the profile card; tabs and mounts sit inside #detailPane outside the card', () => {
  const cardStart = index.indexOf('<section class="customer-profile-card"');
  assert.ok(cardStart >= 0, 'profile card section exists');
  const cardEnd = index.indexOf('</section>', cardStart);
  assert.ok(cardEnd > cardStart, 'profile card section closes');
  const card = index.slice(cardStart, cardEnd);
  for (const id of ['detailName', 'profileServiceStatusBadge', 'customerCurrentBillSummary', 'editProfileButton', 'deleteCustomerButton', 'archiveCustomerButton', 'profileMoreActionsDetails', 'customerTechnicalToolsDetails']) {
    assert.ok(card.includes(`id="${id}"`), `${id} is inside the profile card`);
  }
  const paneStart = index.indexOf('<section id="detailPane"');
  // The pane close is the </section> at the pane's own indent: the
  // first </section> after the pane open is the nested CARD close.
  const paneEnd = index.indexOf('\n      </section>', paneStart);
  assert.ok(paneStart >= 0 && paneEnd > paneStart, 'detail pane section exists');
  for (const id of ['profileTabBilling', 'profileTabInfo', 'profileTabComplaints', 'profileContentMounts']) {
    const at = index.indexOf(`id="${id}"`);
    assert.ok(at > cardEnd, `${id} is outside the profile card`);
    assert.ok(at > paneStart && at < paneEnd, `${id} is inside #detailPane`);
  }
});

// (b) Header identity line — `{mohalla} · {phone}` under the name;
// a missing half is omitted, never dashed; the line is empty when
// both are missing.
test('profile redesign: identity line joins mohalla and phone, omitting a missing half', () => {
  assert.equal(profileIdentityLine({ mohalla: 'Sodaa', phone: '03012345678' }), 'Sodaa · 03012345678');
  assert.equal(profileIdentityLine({ mohalla: 'Sodaa' }), 'Sodaa');
  assert.equal(profileIdentityLine({ phone: '03012345678' }), '03012345678');
  assert.equal(profileIdentityLine({}), '');
  assert.equal(profileIdentityLine({ mohalla: '  ', phone: '' }), '');
  assert.ok(app.includes("document.querySelector('.detail-identity-line')"), 'renderDetail writes the identity line');
  assert.ok(app.includes('profileIdentityLine(customer)'), 'renderDetail uses the identity-line helper');
});

// (c) Header service pill — the badge shows the DERIVED service state
// (profileServiceState), not the stored status: Suspended > Expired >
// Vacation > Offline > Active > Not chosen.
test('profile redesign: header service pill follows the derived service state', () => {
  const suspended = profileServiceState({ serviceStatus: 'active' }, { today: '2026-11-10', openSuspension: { status: 'open', suspensionDate: '2026-11-01' } });
  assert.equal(suspended.state, 'suspended');
  assert.equal(suspended.modifier, 'offline');
  assert.equal(profileServiceState({ cancellationDate: '2026-11-01' }, { today: '2026-11-10' }).state, 'expired');
  assert.equal(profileServiceState({ expiryDate: '2026-11-01' }, { today: '2026-11-10' }).state, 'expired');
  assert.equal(profileServiceState({ expiryDate: '2026-12-01' }, { today: '2026-11-10' }).state, 'not-chosen');
  const vacation = profileServiceState({ paused: true, pauseStartDate: '2026-11-01' }, { today: '2026-11-10' });
  assert.equal(vacation.state, 'vacation');
  assert.equal(vacation.modifier, 'vacation');
  assert.equal(profileServiceState({ serviceStatus: 'offline' }, { today: '2026-11-10' }).state, 'offline');
  assert.equal(profileServiceState({ serviceStatus: 'active' }, { today: '2026-11-10' }).state, 'active');
  const notChosen = profileServiceState({}, { today: '2026-11-10' });
  assert.equal(notChosen.state, 'not-chosen');
  assert.equal(notChosen.modifier, 'not-set');
  assert.equal(profileServiceState({ serviceStatus: 'not-set' }, { today: '2026-11-10' }).state, 'not-chosen');
  assert.ok(app.includes('profileServiceState(customer,'), 'renderDetail derives the badge from profileServiceState');
  assert.ok(app.includes('derivedServiceState.modifier'), 'the badge class follows the derived modifier');
  assert.ok(app.includes("t('prof_service_badge_derived_aria'"), 'the badge aria label is the derived-state key');
});

// (d) More Actions — all 13 buttons, grouped under 6 category
// summaries in spec order (Payments, Documents, Communication,
// Financial, Support, Equipment). Dispute is Financial, KYC is Support.
// Profile Polish B (10): Record payment moved up into the header row
// and Archive moved down into Payments, so Payments now opens with
// Archive, Advance, back-dated — the count stays 13.
test('profile redesign: More Actions holds 13 buttons in 6 categories, in order', () => {
  const categories = [
    ['prof_ma_cat_payments', ['archiveCustomerButton', 'advancePaymentButton', 'backdatedPaymentButton']],
    ['prof_ma_cat_documents', ['openAccountStatementBtn', 'openBillInvoiceBtn', 'openServiceContractBtn']],
    ['prof_ma_cat_communication', ['openReminderModalBtn', 'openCustomerPromiseBtn']],
    ['prof_ma_cat_financial', ['openLedgerAuditBtn', 'openAdjustmentModalBtn', 'openDisputeClaimBtn']],
    ['prof_ma_cat_support', ['openKycAuditBtn']],
    ['prof_ma_cat_equipment', ['openEquipmentRetrievalBtn']],
  ];
  let previousAt = -1;
  for (const [key, ids] of categories) {
    const summaryAt = index.indexOf(`data-i18n="${key}"`);
    assert.ok(summaryAt > previousAt, `${key} summary follows the previous category`);
    previousAt = summaryAt;
    const detailsAt = index.lastIndexOf('<details class="profile-more-actions-category"', summaryAt);
    const detailsEnd = index.indexOf('</details>', summaryAt);
    assert.ok(detailsAt >= 0 && detailsEnd > summaryAt, `${key} category is a details block`);
    const block = index.slice(detailsAt, detailsEnd);
    for (const id of ids) {
      assert.ok(block.includes(`id="${id}"`), `${id} sits in the ${key} category`);
    }
  }
  const paymentsAt = index.indexOf('data-i18n="prof_ma_cat_payments"');
  const paymentsEnd = index.indexOf('</details>', paymentsAt);
  const payments = index.slice(paymentsAt, paymentsEnd);
  assert.ok(payments.indexOf('id="archiveCustomerButton"') < payments.indexOf('id="advancePaymentButton"'), 'Archive is first in Payments, Advance second');
  assert.match(profileCss, /\.profile-more-actions-category-grid > \.backdated-payment-link \{[^}]*grid-column: 1 \/ -1/, 'the back-dated entry spans the full category row');
  assert.match(profileCss, /\.profile-more-actions-category-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'category grids are 2-column');
  assert.match(profileCss, /\.profile-more-actions-category-grid > button \{[^}]*min-height: 52px/, 'action cards are 52px');
});

// (e) QA tools bar — all 29 buttons under 6 chips, search +
// no-result state, Recent (cap 4 shown, 8 stored) + Favorites rows.
test('profile redesign: QA holds 29 tools under 6 chips with search, Recent and Favorites', () => {
  const groupCounts = { optical: 8, otdr: 3, splicing: 8, safety: 9, service: 1 };
  const groups = index.match(/data-qa-group="/g) || [];
  assert.strictEqual(groups.length, 29, '29 QA tool buttons carry a group');
  for (const [group, count] of Object.entries(groupCounts)) {
    assert.strictEqual((index.match(new RegExp(`data-qa-group="${group}"`, 'g')) || []).length, count, `${group} holds ${count} tools`);
  }
  assert.strictEqual((index.match(/class="ds-chip qa-chip"/g) || []).length, 6, '6 filter chips');
  for (const chip of ['qa_chip_all', 'qa_chip_optical', 'qa_chip_otdr', 'qa_chip_splicing', 'qa_chip_safety', 'qa_chip_service']) {
    assert.ok(index.includes(`data-i18n="${chip}"`), `${chip} chip exists`);
  }
  assert.ok(index.includes('class="qa-search-input"'), 'search input exists');
  assert.ok(index.includes('class="qa-no-results"'), 'no-result state exists');
  assert.ok(index.includes('class="qa-favorites-row"'), 'Favorites row exists');
  assert.ok(index.includes('class="qa-recent-row"'), 'Recent row exists');
  assert.strictEqual((index.match(/data-qa-fav/g) || []).length, 29, 'every tool has a favourite star toggle');
  assert.ok(app.includes('wireQaToolsBar()'), 'the tools bar is wired');
  // Pure state: search matches label/title, chips filter by group.
  const tools = [
    { id: 'splice', label: 'Splicing', title: 'Splice fibre', group: 'splicing' },
    { id: 'otdr', label: 'OTDR Trace', title: 'Trace a fibre', group: 'otdr' },
  ];
  assert.ok(qaToolMatches(tools[0], 'splic', 'all'), 'label substring matches');
  assert.ok(qaToolMatches(tools[1], 'fibre', 'all'), 'title substring matches');
  assert.ok(!qaToolMatches(tools[0], '', 'optical'), 'chip filters by group');
  assert.deepEqual(qaVisibleToolIds(tools, 'otdr', 'all'), ['otdr'], 'visible ids follow the filter');
  assert.deepEqual(qaVisibleToolIds(tools, 'zzz', 'all'), [], 'no match means no visible tools');
  // Recent: cap 8 stored, 4 shown; favourites toggle.
  assert.equal(QA_RECENT_MAX, 8, 'recent store caps at 8');
  assert.equal(QA_RECENT_ROW_MAX, 4, 'recent row shows 4');
  assert.deepEqual(recordQaRecentTool(['1', '2', '3', '4', '5', '6', '7', '8'], '9').length, 8, 'recording a 9th recent drops the oldest');
  assert.deepEqual(recordQaRecentTool(['a', 'b'], 'a'), ['a', 'b'], 're-recording moves the tool to the front');
  assert.deepEqual(toggleQaFavoriteTool([], 'x'), ['x'], 'favourite adds');
  assert.deepEqual(toggleQaFavoriteTool(['x'], 'x'), [], 'favourite removes');
  assert.deepEqual(normalizeQaToolIdList(['a', 'a', '', null, 'b'], 8), ['a', 'b'], 'stored id lists dedupe and drop blanks');
  assert.equal(QA_RECENT_STORE_KEY, 'shahdara_qa_recent_tools_v1', 'recent store key is the D3 key');
  assert.equal(QA_FAVORITE_STORE_KEY, 'shahdara_qa_favorite_tools_v1', 'favourites store key is the D3 key');
  assert.deepEqual([...QA_TOOL_GROUPS], ['all', 'optical', 'otdr', 'splicing', 'safety', 'service'], 'chip order is All, Optical, OTDR, Splicing, Safety & Cable, Service');
});

// (f) Row 1 — D6: Edit / Archive / Delete ONLY. + New customer is
// gone from the profile header (the list keeps its own "+").
// Profile Polish B (10) (user request 2026-11-12) reorders Row 1 to
// Edit / Clear dues / Delete / Wada / Record payment; Archive moves
// down into More Actions > Payments. The D6 pins below (no +
// New customer, Edit primary, Delete wired with confirm + 5s undo)
// are unchanged.
test('profile redesign: Row 1 is Edit, Clear dues, Delete, Wada, Record payment — no + New customer (D6, Profile Polish B (10))', () => {
  assert.ok(!index.includes('profileNewCustomerButton'), 'no + New customer button in the profile markup');
  assert.ok(!app.includes('profileNewCustomerButton'), 'no + New customer wiring in app.js');
  const groupAt = index.indexOf('class="profile-action-group"');
  const editAt = index.indexOf('id="editProfileButton"', groupAt);
  const clearAt = index.indexOf('id="clearDuesButton"', groupAt);
  const deleteAt = index.indexOf('id="deleteCustomerButton"', groupAt);
  const wadaAt = index.indexOf('id="topWadaButton"', groupAt);
  const recordAt = index.indexOf('id="currentBillPaymentShortcut"', groupAt);
  const archiveAt = index.indexOf('id="archiveCustomerButton"', groupAt);
  assert.ok(editAt > groupAt && clearAt > editAt && deleteAt > clearAt && wadaAt > deleteAt && recordAt > wadaAt, 'Row 1 order is Edit, Clear dues, Delete, Wada, Record payment');
  const detailsAt = index.indexOf('id="profileMoreActionsDetails"', groupAt);
  assert.ok(detailsAt > recordAt, 'the More actions disclosure still follows Row 1');
  assert.ok(archiveAt > detailsAt, 'Archive moved down into the More actions disclosure');
  assert.ok(index.includes('id="editProfileButton" class="primary-button profile-action-btn profile-edit-button"'), 'Edit is the primary action');
  assert.ok(app.includes("$('#deleteCustomerButton').addEventListener"), 'Delete is still wired with its confirm + 5s undo');
  assert.ok(profileCss.includes('.profile-delete-btn'), 'Delete keeps its destructive treatment');
});

// (g) Tabs sticky — the tabs sit at 56px (the DS-0-measured topbar
// height) and the three html/body overflow rules that made sticky a
// no-op are gone. Closed-section summary height is unchanged (57px).
test('profile redesign: tabs are sticky at 56px and no html/body overflow rule defeats sticky', () => {
  assert.match(styles, /\.profile-tabs\{[^}]*position:sticky/, 'tabs are position:sticky');
  assert.match(styles, /\.profile-tabs\.profile-tabs \{ top: 56px; \}/, 'tabs sit at the 56px topbar height');
  for (const [name, css] of [['styles.css', styles], ['nav.css', navCss]]) {
    for (const match of css.matchAll(/html,\s*body\s*\{[^}]*\}/g)) {
      assert.ok(!/overflow/.test(match[0]), `${name}: no overflow rule on html/body (${match[0].slice(0, 60)})`);
    }
  }
  assert.match(styles, /\.profile-detail-section summary\{[^}]*min-height:57px/, 'closed-section summaries keep the 57px floor');
});

// (h) FAB clearance — the detail pane keeps max(96px, dial-clearance)
// bottom padding (D-T6) so the speed dial never covers content.
test('profile redesign: detail pane bottom padding clears the speed dial (D-T6)', () => {
  assert.match(styles, /\.detail-pane \{ padding: 18px 14px max\(96px, 126px\); \}/, 'detail pane padding is max(96px, 126px) at phone widths');
});

// Help icon — the 32x44 oval is gone: the bare `summary` selector
// (styles.css:174) floors every summary at 44px, so the fix pins the
// min-height too.
test('profile redesign: help icon is a 32px circle, not a 32x44 oval', () => {
  assert.match(profileCss, /\.help-icon \{ flex: none; align-self: center; min-height: 32px; \}/, 'help icon pins min-height 32px');
});

// Billing KPIs — all stats are .ds-stat-box; Net-due turns green at 0
// and red when owed; amounts keep their size (D5).
test('profile redesign: billing KPIs are .ds-stat-box with a coloured Net-due', () => {
  assert.ok(app.includes('class="current-bill-stat ds-stat-box"'), 'billing stats use the DS stat box');
  assert.ok(app.includes('is-due'), 'Net-due marks the owed state');
  assert.ok(app.includes('is-settled'), 'Net-due marks the settled state');
  assert.match(profileCss, /\.current-bill-stat\.ds-stat-box \{ padding: 8px; \}/, 'billing stats keep the domain 8px padding');
  assert.match(styles, /\.current-bill-stat>strong\.is-due\{color:var\(--ds-danger\)\}/, 'owed Net-due is the danger token');
  assert.match(styles, /\.current-bill-stat>strong\.is-settled\{color:var\(--ds-success\)\}/, 'settled Net-due is the success token');
});

// Progress bar — the visual bar sits directly above the field
// counter and syncs from the same count.
test('profile redesign: progress bar sits above the field counter', () => {
  const barAt = index.indexOf('class="profile-completion-bar"');
  const counterAt = index.indexOf('id="profileCompletionCounter"');
  assert.ok(barAt >= 0 && barAt < counterAt, 'bar is above the counter');
  assert.match(profileCss, /\.profile-completion-bar \{[^}]*height: 6px/, 'bar is 6px');
  assert.match(profileCss, /\.profile-completion-fill \{[^}]*background: var\(--ds-brand\)/, 'bar fill is the brand token');
  assert.ok(app.includes("document.querySelector('.profile-completion-fill')"), 'the counter syncs the bar fill');
});

// Complaints — the log (CMP-101) renders in a clean card container
// and Add complaint is the primary action.
test('profile redesign: complaints log renders in a clean card; Add complaint is primary', () => {
  assert.ok(app.includes('class="profile-complaints-section"'), 'complaints render in the card section');
  assert.match(profileCss, /\.profile-complaints-section \{[^}]*border: 1px solid var\(--line\)/, 'complaints card is bordered');
  assert.ok(index.includes('id="addIncidentButton" class="primary-button incident-add-button"'), 'Add complaint is the primary button');
  assert.ok(index.includes('data-ds-icon="Plus"'), 'Add complaint carries the Plus icon');
});

// Field counter — the total is 68 (70 mapped keys minus the 2
// Plan 513 opt-in flags). The stale "total is 67" comment is fixed.
test('profile redesign: field counter total is 68, not 67 or 69', () => {
  assert.ok(completionSrc.includes('the total is 68'), 'the stale "total is 67" comment is fixed');
  assert.ok(!completionSrc.includes('total is 67'), 'no "total is 67" remains');
  const full = {};
  for (const key of Object.values(PROFILE_FIELD_SAVE_MAP)) full[key] = 'x';
  assert.deepEqual(countProfileCompletion(full), { filled: 68, total: 68, text: '68/68 fields filled' }, 'a full profile counts 68/68');
  assert.deepEqual(countProfileCompletion({}), { filled: 0, total: 68, text: '0/68 fields filled' }, 'an empty profile counts 0/68');
});

// i18n — the 16 new keys exist in English and Urdu (Urdu values carry
// Urdu script, Plan 472). The dead + New customer key is gone; the QA
// label reads (29 tools).
test('profile redesign: new i18n keys exist in English and Urdu; the dead New-customer key is gone', () => {
  const keys = [
    'prof_ma_cat_payments', 'prof_ma_cat_documents', 'prof_ma_cat_communication',
    'prof_ma_cat_financial', 'prof_ma_cat_support', 'prof_ma_cat_equipment',
    'qa_search_placeholder', 'qa_chip_all', 'qa_chip_optical', 'qa_chip_otdr',
    'qa_chip_splicing', 'qa_chip_safety', 'qa_chip_service',
    'qa_recent_heading', 'qa_favorites_heading', 'qa_no_results',
    'prof_service_badge_derived_aria',
  ];
  for (const key of keys) {
    assert.ok(lang.includes(`${key}:`), `${key} exists`);
    assert.match(lang, new RegExp(`${key}:\\s*'[^']*[\\u0600-\\u06FF]`), `${key} Urdu value carries Urdu script`);
  }
  assert.ok(!lang.includes('prof_action_new_customer'), 'the dead + New customer key is gone');
  assert.ok(lang.includes("prof_qa_summary: 'Technical QA & Field Certificates (29 tools)'"), 'QA label reads (29 tools)');
  assert.ok(lang.includes("prof_qa_summary: 'تکنیکی QA اور فیلڈ سرٹیفکیٹ (29 ٹولز)'"), 'QA label Urdu reads (29 ٹولز)');
});

// Utility row — all four actions are present with their DS icons.
test('profile redesign: utility row keeps all four actions with DS icons', () => {
  assert.ok(app.includes('data-ds-icon="QrCode"'), 'QR action carries its icon');
  assert.ok(app.includes('data-ds-icon="Printer"'), 'Print action carries its icon');
  assert.ok(profileUi.includes('data-ds-icon="Volume2"'), 'Speak-due action carries its icon');
  assert.ok(profileUi.includes('data-ds-icon="FileText"'), 'Welcome-slip action carries its icon');
  assert.match(styles, /\.profile-view-actions\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/, 'utility row is an even 4-column grid');
});
