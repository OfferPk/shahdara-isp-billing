import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildOnboardingChecklist, onboardingChecklistHtml } from '../onboarding-checklist.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const app = read('app.js');
const styles = read('styles.css');
const profileUi = read('profile-ui.css');

// Profile Polish F (user spec 2026-11-12, item (22) BLANKET RULE of the
// 22-part profile spec): ALL remaining profile sections in the SAME pill
// style wherever required; where a pill does not fit, a different matching
// COLOURFUL style; one comprehensive pass, done ONCE.
//
// Palette map, published in the PR body and pinned here:
//  - Row groups keep the ID-pill rotation (identity, not state): contact
//    yellow slot 1, location orange slot 7, money teal slot 6 (the same
//    teal Polish E used for Financial rows), install green slot 2,
//    network info-blue slot 3, hardware slate slot 4.
//  - Explainors and prose use the info-blue note (.pcp-explainer
//    values); draft results use info-blue pills (Polish E (20)).
//    Recorded data rows: teal for Financial + History, info-blue for
//    Customer-info notes and Network. States: mint = settled/done,
//    amber = pending/warning, rose = arrears/danger (var(--qc-*) only).
//  - Dues by month is Polish E territory — untouched. The Financial
//    header summary (figures only, no status word) is untouched. The
//    edit form (#customerProfileForm) is not a profile section — view
//    only. The complaints section lives on the Complaints tab, not the
//    profile Info view — untouched.
// No figure changes anywhere: the same labels, the same values, the
// same wiring — only what shows, in what shape, and what a tap does.

// The F block runs from its header comment to the .mvh-none rule that
// follows it (the pcp block ends just above).
function fBlock() {
  const start = styles.indexOf('/* Profile Polish F (22) BLANKET RULE:');
  assert.notEqual(start, -1, 'the F block header comment must exist');
  const end = styles.indexOf('.mvh-none{color:#5c6e66;font-size:12px}', start);
  assert.notEqual(end, -1, 'the F block must end before the .mvh-none rule');
  return styles.slice(start, end);
}

// ------------------------------------------------------------ ratchets

test('Polish F: styles.css stays at exactly 614 distinct hex colours — no new hex anywhere', () => {
  const distinct = new Set(styles.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.equal(distinct.size, 614, `styles.css has ${distinct.size} distinct hex colours, expected exactly 614`);
});

test('Polish F: the F block uses only hex already in the file (ID-pill slots, wada greens/reds, neutrals)', () => {
  const block = fBlock();
  const hexes = new Set(block.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  const allowed = new Set([
    '#fef3c7', '#704600', '#e7c77e', // contact yellow slot 1
    '#fff0e8', '#8a2b12', '#dc9478', // location orange slot 7
    '#e7f2ec', '#0e5b4d', '#9acbad', // money teal slot 6
    '#dcfce7', '#145b38', '#5fa876', // install green slot 2
    '#e5efff', '#174b87', '#adc9f1', // network info-blue slot 3
    '#334155', '#fff', // hardware slate slot 4
    '#fdeceb', '#a3433a', '#f0dbd8', // wada overdue red (root-cause banner)
    '#f1f4f2', '#5c6e66', '#dce6e1', // neutral grey (pending onboarding steps)
  ]);
  for (const hex of hexes) {
    assert.ok(allowed.has(hex), `F block uses hex ${hex}, which is not in the allowed palette`);
  }
  // State colours come from the --qc-* tokens, never as literal hex.
  assert.ok(block.includes('var(--qc-mint-bg)'), 'settled uses the mint token');
  assert.ok(block.includes('var(--qc-amber-soft-bg)'), 'pending uses the amber token');
  assert.ok(block.includes('var(--qc-rose-bg)'), 'arrears uses the rose token');
});

test('Polish F: the F block never touches Dues by month (Polish E territory)', () => {
  assert.ok(!fBlock().includes('dmb'), 'no dmb selector inside the F block');
});

test('Polish F: profile-ui.css stays hex-free — More Actions colours are tokens only', () => {
  const distinct = new Set(profileUi.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.equal(distinct.size, 0, `profile-ui.css has ${distinct.size} distinct hex colours, expected 0`);
});

// ------------------------------------------------------------ row groups

function groupsLiteral() {
  const start = app.indexOf('const profileInfoGroupFragments = {');
  assert.notEqual(start, -1, 'fragments object must exist');
  return app.slice(start, app.indexOf('\n', start));
}

test('Polish F: the six remaining groups take their rotation class (extraClass route only)', () => {
  const groups = groupsLiteral();
  assert.ok(groups.includes("contactActionsHtml, 'profile-info-group--contact'"), 'contact takes the yellow class');
  assert.ok(groups.includes("true]], 'profile-info-group--location'"), 'location takes the orange class');
  assert.ok(groups.includes("netDisplay]], 'profile-info-group--money'"), 'money takes the teal class');
  assert.ok(groups.includes("investmentRecoveryDisplay]], 'profile-info-group--install'"), 'install takes the green class');
  assert.ok(groups.includes("'macAddress']], 'profile-info-group--network'"), 'network takes the info-blue class');
  assert.ok(groups.includes("profileEmptyMoney(customer.mediaConverterCost)]], 'profile-info-group--hardware'"), 'hardware takes the slate class');
  // Polish D's classes are unchanged by F.
  assert.ok(groups.includes("'profile-info-group--service'"), 'service keeps its class');
});

test('Polish F: each group pill is a real pill in its rotation colour', () => {
  const pills = [
    ['contact', '#fef3c7', '#e7c77e', '#704600'],
    ['location', '#fff0e8', '#dc9478', '#8a2b12'],
    ['money', '#e7f2ec', '#9acbad', '#0e5b4d'],
    ['install', '#dcfce7', '#5fa876', '#145b38'],
    ['network', '#e5efff', '#adc9f1', '#174b87'],
    ['hardware', '#334155', '#334155', '#fff'],
  ];
  for (const [group, bg, border, text] of pills) {
    const rule = styles.match(new RegExp(`\\.profile-info-group--${group} \\.profile-readonly-field\\{[^}]*\\}`));
    assert.ok(rule, `the ${group} pill rule must exist`);
    assert.ok(rule[0].includes('border-radius:999px'), `${group}: a real pill`);
    assert.ok(rule[0].includes(`background:${bg}`), `${group}: background ${bg}`);
    assert.ok(rule[0].includes(`border:1px solid ${border}`), `${group}: border ${border}`);
    const dtRule = styles.match(new RegExp(`\\.profile-info-group--${group} \\.profile-readonly-field dt\\{[^}]*\\}`));
    const ddRule = styles.match(new RegExp(`\\.profile-info-group--${group} \\.profile-readonly-field dd\\{[^}]*\\}`));
    assert.ok(dtRule && dtRule[0].includes(`color:${text}`), `${group}: label in ${text}`);
    assert.ok(ddRule && ddRule[0].includes(`color:${text}`), `${group}: value in ${text}`);
  }
});

// ------------------------------------------------------------ explainers

test('Polish F: explainer prose is an info note, not a data pill', () => {
  const block = fBlock();
  assert.ok(block.includes('section[aria-label="First-bill preview"] > p:first-of-type'), 'first-bill explainer is a note');
  assert.ok(block.includes('section[aria-label="Welcome pack"] > p:first-of-type'), 'welcome-pack explainer is a note');
  assert.ok(block.includes('.profile-handling-note > p:first-of-type'), 'handling-note explainer is a note');
  assert.ok(block.includes('.profile-field-change-history > p:first-of-type'), 'field-change explainer is a note');
  const note = block.match(/\.profile-cross-payments > p:first-of-type,[^{]*\{[^}]*\}/);
  assert.ok(note, 'the explainer-note rule must exist');
  assert.ok(note[0].includes('border-radius:12px'), 'a note, not a 999px pill');
  assert.ok(note[0].includes('background:#e5efff'), 'info-blue note background');
  assert.ok(note[0].includes('color:#174b87'), 'info-blue note text');
});

// ------------------------------------------------------------ Financial + History

test('Polish F: Financial data rows are teal pills', () => {
  const block = fBlock();
  for (const selector of [
    '.profile-deposit-settlement > p',
    '.profile-deposit-offset > p',
    '.profile-credit-transfer-section > p',
    '.profile-hardware-custody > p',
    'section[aria-label="Welcome pack"] > p',
    'section[aria-label="Billing cycle"] > p',
    'section[aria-label="Preferred payment channel"] > p',
    '#statementDraftResult p',
    '#balanceReplyResult p',
    '#paymentSlipResult p',
    '#statusReplyResult p',
    '.profile-downtime-section > p',
    '.profile-lifecycle-section .lifecycle-status-banner',
    '.profile-field-change-history .fch-summary',
    '.profile-move-house-history .mvh-current',
    '.profile-number-change-log .ncl-current',
    '.profile-mohalla-change-record .mcr-current',
  ]) {
    assert.ok(block.includes(selector), `teal pill list must include ${selector}`);
  }
  const teal = block.match(/\.profile-deposit-settlement > p,[^{]*\{[^}]*\}/);
  assert.ok(teal && teal[0].includes('background:#e7f2ec'), 'teal pill background');
  assert.ok(teal[0].includes('border-radius:999px'), 'teal pill shape');
});

test('Polish F: bad debt — arrears rose, written-off mint, reason teal, note info', () => {
  const block = fBlock();
  const roseAt = block.indexOf('.profile-bad-debt-section > p:first-of-type{');
  const mintAt = block.indexOf('.profile-bad-debt-section > p.custody-recovered,');
  assert.ok(roseAt !== -1, 'the arrears rose rule must exist');
  assert.ok(mintAt !== -1, 'the written-off mint rule must exist');
  assert.ok(roseAt < mintAt, 'the mint rule comes AFTER the rose rule (same specificity) so the recovered line wins when it is first');
  assert.ok(block.includes('.profile-bad-debt-section > p.profile-custody-reason'), 'the reason line is a teal pill');
  assert.ok(block.includes('.profile-bad-debt-section > p.profile-custody-note'), 'the note line is an info note');
  assert.ok(app.includes('<p class="profile-custody-reason">${escapeHtml(badDebtPres.reasonLabel)}</p>'), 'the reason line carries its class (markup hook only)');
});

test('Polish F: first-bill preview form reuses the .pcp-form row (Polish E (19) pattern)', () => {
  assert.ok(app.includes('<div class="pcp-form"><label>Start date <input id="firstBillPreviewStartDate"'), 'the first-bill form carries the pcp-form class');
  const block = fBlock();
  assert.ok(block.includes('#firstBillPreviewResult .first-bill-preview{'), 'the preview table becomes a teal card');
  assert.ok(block.includes('#firstBillPreviewResult .first-bill-preview tfoot td{font-weight:700;color:#0e5b4d}'), 'the preview total stays bold teal');
  assert.ok(block.includes('#firstBillPreviewResult .first-bill-preview-incomplete{'), 'the incomplete note is an amber pill');
});

test('Polish F: kist, next bill and CLV keep their data and gain pills', () => {
  const block = fBlock();
  assert.ok(block.includes('.profile-kist-section .kist-plan-head'), 'kist plan head is a teal pill');
  assert.ok(block.includes('.profile-next-bill-section .profile-next-bill-month{font-weight:700}'), 'next-bill month is a prominent teal pill');
  assert.ok(block.includes('.profile-next-bill-section .next-bill-total{border:1px solid #0e5b4d;font-weight:700}'), 'next-bill total has the stronger border');
  assert.ok(block.includes('.customer-lifetime-value .customer-lifetime-grid>div{'), 'CLV cells are teal pill-cards');
  assert.ok(block.includes('.customer-lifetime-value .customer-lifetime-note,'), 'CLV note is an info note');
});

// ------------------------------------------------------------ notes + network

test('Polish F: Customer-info note lines are info-blue pills', () => {
  const block = fBlock();
  for (const selector of [
    '.profile-handling-note .chn-current',
    '.profile-standing-instruction .sin-current',
    '.profile-spoken-language-note .sln-current',
    '.profile-gate-access-instruction .gai-current',
    '.profile-customer-emergency-contact .emc-current',
    '.profile-verification-tick .pvt-current',
    '.profile-household-link .hhl-list li',
    '.profile-last-interaction .lil-line',
    '.profile-freshness-stamp .dfs-stamp',
  ]) {
    assert.ok(block.includes(selector), `info-blue pill list must include ${selector}`);
  }
});

test('Polish F: Network rows are info-blue pills; router-cred rows keep their masked values and buttons', () => {
  const block = fBlock();
  assert.ok(block.includes('.profile-splitter-section > p'), 'optical/pole/GPS fact lines are info-blue pills');
  assert.ok(block.includes('.profile-splitter-section .signal-history-list li'), 'signal history rows are info-blue pills');
  assert.ok(block.includes('.profile-outage-section > p'), 'feeder lines are info-blue pills');
  assert.ok(block.includes('.profile-router-cred-section .router-cred-row'), 'router-cred rows are info-blue pills');
  assert.ok(block.includes('.profile-mikrotik-section .profile-mikrotik-note'), 'MikroTik note is an info note (script and Copy untouched)');
  const info = block.match(/\.profile-handling-note \.chn-current,[^{]*\{[^}]*\}/);
  assert.ok(info && info[0].includes('background:#e5efff'), 'info-blue pill background');
  assert.ok(info[0].includes('border-radius:999px'), 'info-blue pill shape');
});

test('Polish F: referral, upsell and bottleneck share the info-blue pill (one section class)', () => {
  const block = fBlock();
  assert.ok(block.includes('.profile-referral-section > p'), 'referral/upsell/bottleneck lines are info-blue pills');
  assert.ok(block.includes('.profile-referral-section .profile-referral-list li'), 'referral list rows are info-blue pills');
  assert.ok(block.includes('.profile-contributors-section .profile-referral-list li'), 'contributor rows are info-blue pills');
});

// ------------------------------------------------------------ states + banners

test('Polish F: settled is mint, pending is amber — via tokens, never literal hex', () => {
  const block = fBlock();
  assert.ok(block.includes('.profile-clearance-noc > p.custody-recovered'), 'NOC eligible is a mint pill');
  assert.ok(block.includes('.profile-clearance-noc > p.custody-pending'), 'NOC blockers are an amber pill');
  assert.ok(block.includes('.profile-deposit-settlement > p.custody-recovered'), 'deposit settled is a mint pill');
  assert.ok(block.includes('.profile-deposit-settlement > p.custody-pending'), 'deposit still-due is an amber pill');
  assert.ok(block.includes('.profile-tickets-section .profile-tickets-warning'), 'tickets warning is an amber pill');
  assert.ok(block.includes('.profile-hardware-custody .occupancy-risk-warning'), 'occupancy risk is an amber pill (role=alert kept in markup)');
  assert.ok(block.includes('.root-cause-banner{'), 'root-cause banner is a rose pill-card');
  assert.ok(block.includes('.root-cause-banner .root-cause-title{font-weight:700}'), 'root-cause title stays bold');
});

test('Polish F: onboarding steps carry a done/pending class and pill mint / neutral', () => {
  const html = onboardingChecklistHtml(
    buildOnboardingChecklist('c1', [{ stepId: 'enquiry', completed: true, date: '2026-11-01', by: 'Saad' }]),
    'Ahmed',
  );
  assert.ok(html.includes('<li class="onb-done">✓ Enquiry — 2026-11-01 · Saad</li>'), 'a done step carries onb-done with its mark, date and by-line');
  assert.ok(html.includes('<li class="onb-pending">○ Survey / feasibility</li>'), 'a pending step carries onb-pending');
  const block = fBlock();
  assert.ok(block.includes('.onboarding-checklist ol li.onb-done{'), 'done steps pill mint');
  assert.ok(block.includes('.onboarding-checklist ol li.onb-pending{'), 'pending steps pill neutral grey');
  assert.ok(block.includes('.onboarding-checklist > p:first-of-type'), 'the state line is a teal pill');
  assert.ok(block.includes('.onboarding-checklist > p:last-of-type'), 'the closing line is an info note');
});

test('Polish F: disconnect rows are slate pills (archived state, not an error)', () => {
  const block = fBlock();
  const rule = block.match(/\.profile-disconnect-section > p,\.profile-disconnect-section li\{[^}]*\}/);
  assert.ok(rule, 'the disconnect pill rule must exist');
  assert.ok(rule[0].includes('background:#334155'), 'slate background');
  assert.ok(rule[0].includes('color:#fff'), 'white text on slate');
});

// ------------------------------------------------------------ Billing tab

test('Polish F: month-card summary stats are teal pills, wide rows info-blue (partial badge keeps amber)', () => {
  const block = fBlock();
  const stat = block.match(/\.month-card \.month-summary-stat\{[^}]*\}/);
  assert.ok(stat, 'the stat pill rule must exist');
  assert.ok(stat[0].includes('background:#e7f2ec'), 'stat pill is teal');
  assert.ok(stat[0].includes('border-radius:999px'), 'stat pill shape');
  assert.ok(block.includes('.month-card .month-summary-wide:not(.month-status){'), 'wide rows are info-blue pills, excluding the partial badge');
  assert.ok(block.includes('.month-card .month-summary-wide:not(.month-status){display:inline-flex'), 'wide pill is inline-flex');
  // The partial badge is already an amber pill via .status-pending — F must not restyle it.
  assert.ok(!block.includes('.month-status.status-pending'), 'no F rule touches the partial badge');
});

test('Polish F: payment rows pill their amount+meta span — teal, voided rose', () => {
  const block = fBlock();
  assert.ok(block.includes('.month-card li.payment-row > .payment-main{'), 'payment rows pill the amount+meta span');
  assert.ok(block.includes('.month-card li.payment-row-voided > .payment-main{'), 'voided rows pill rose');
  assert.ok(block.includes('.month-card .carry-credit-source{'), 'carry-credit source is a teal pill');
  assert.ok(block.includes('.month-card .empty-month{'), 'empty month is a teal pill');
  assert.ok(block.includes('.month-card .bill-audit summary{'), 'bill audit summary is a teal pill');
  assert.ok(block.includes('.payment-form .field-help.payment-guidance{'), 'payment-form guidance is an info note');
});

// ------------------------------------------------------------ More Actions

test('Polish F: More Actions gives each category its own token colour (fixed index.html order)', () => {
  const expected = [
    ['1', '--qc-mint-bg', '--qc-emerald-text', 'Payments'],
    ['2', '--qc-blue-bg', '--qc-blue-text', 'Documents'],
    ['3', '--qc-purple-bg', '--qc-purple-text', 'Customer Communication'],
    ['4', '--qc-amber-bg', '--qc-amber-text', 'Financial Management'],
    ['5', '--qc-rose-bg', '--qc-rose-text', 'Customer Support'],
    ['6', '--qc-indigo-bg', '--qc-indigo-text', 'Equipment Management'],
  ];
  for (const [n, bg, text, label] of expected) {
    const rule = profileUi.match(new RegExp(`\\.profile-more-actions-category:nth-of-type\\(${n}\\) \\.profile-more-actions-category-grid > button \\{[^}]*\\}`));
    assert.ok(rule, `the ${label} category rule must exist`);
    assert.ok(rule[0].includes(`background: var(${bg})`), `${label}: background ${bg}`);
    assert.ok(rule[0].includes(`color: var(${text})`), `${label}: text ${text}`);
  }
  // The category order in index.html is the order the nth-of-type rules assume.
  const html = read('index.html');
  const order = ['prof_ma_cat_payments', 'prof_ma_cat_documents', 'prof_ma_cat_communication', 'prof_ma_cat_financial', 'prof_ma_cat_support', 'prof_ma_cat_equipment'];
  let last = -1;
  for (const key of order) {
    const at = html.indexOf(key);
    assert.ok(at > last, `${key} must follow the previous category in index.html`);
    last = at;
  }
});
