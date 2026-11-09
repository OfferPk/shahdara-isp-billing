import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const appSrc = read('app.js');
const stylesSrc = read('styles.css');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

// Polish #28 Phase A — the Customer Profile Info tab renders as 7
// expandable <details> sections (S1 Customer Information, S2 Service &
// Package, S3 Financial Details, S4 Connection & Installation, S5
// Network Configuration, S6 Hardware & Equipment, S7 History &
// Activity), per the field map in
// shahdara-isp-billing-analysis/polish-28-profile-seven-sections.md
// (Table B). Structure only, zero logic change: every one of the 67
// view items moves verbatim into exactly one section; the heading,
// quick actions row and header strip stay above the sections; the
// completion counter and missing-fields checklist stay directly under
// the heading; the Billing and Complaints tabs are untouched.
//
// The section-state module is loaded dynamically (not a static import)
// so the pre-fix check on the pristine base fails per-test — the module
// does not exist there yet — instead of failing the whole file at load.

const SECTIONS = ['Customer', 'Service', 'Financial', 'Connection', 'Network', 'Hardware', 'History'];

async function loadSectionsModule() {
  return import('../profile-sections.js');
}

function sectionBody(section) {
  const start = appSrc.indexOf(`const profileSection${section}Body = `);
  assert.notEqual(start, -1, `profileSection${section}Body must exist`);
  return appSrc.slice(start, appSrc.indexOf('\n', start));
}

function sectionBodies() {
  return Object.fromEntries(SECTIONS.map((s) => [s, sectionBody(s)]));
}

function viewAssembly() {
  const start = appSrc.indexOf("$('#customerProfileView').innerHTML = ");
  assert.notEqual(start, -1, 'view assembly must exist');
  return appSrc.slice(start, appSrc.indexOf('\n', start));
}

function groupFragments() {
  const start = appSrc.indexOf('const profileInfoGroupFragments = ');
  assert.notEqual(start, -1, 'profileInfoGroupFragments must exist');
  return appSrc.slice(start, appSrc.indexOf('\n', start));
}

// ------------------------------------------------------------ the field map
// Every view item (Audit 1 numbering) lives in exactly one section body.
// Markers are the interpolation each item renders as in the template.

const MEMBERSHIP = {
  Customer: [
    'handlingNoteSectionMarkup',
    'standingInstructionSectionMarkup',
    'spokenLanguageNoteSectionMarkup',
    'gateAccessInstructionSectionMarkup',
    'customerEmergencyContactSectionMarkup',
    'profile-freshness-group',
    'profileFreshnessStampMarkup',
    'profileVerificationTickSectionMarkup',
    'temporarilyAwayFlagSectionMarkup',
    'householdLinkSectionMarkup',
    'profileInfoGroupFragments.contact',
    'profileInfoGroupFragments.location',
    'welcomePackSectionHtml',
    'termsAckSectionHtml',
  ],
  Service: [
    'packageHistorySectionMarkup',
    'serviceTenureSectionMarkup',
    'profileInfoGroupFragments.service',
    'profileInfoGroupFragments.lifecycle',
    'upsellSectionHtml',
    'boostSectionHtml',
    'vacationHoldSectionHtml',
    'disconnectProfileHtml(customer)',
    'packageChangeSectionHtml',
    'qualityLogSectionHtml',
    'infoCardSectionHtml',
  ],
  Financial: [
    'wadaProfileBannerHtml(customer)',
    'duesBreakdownSectionMarkup',
    'profileInfoGroupFragments.money',
    'crossPaymentsMadeSectionMarkup',
    'referralSectionHtml',
    'contributorSectionHtml',
    'kistSectionHtml',
    'nextBillSectionHtml',
    'depositSettlementHtml',
    'depositOffsetHtml',
    'creditTransferSectionHtml',
    'badDebtSectionHtml',
    'firstBillPreviewSectionHtml',
    'billingCycleSectionHtml',
    'paymentChannelSectionHtml',
    'statementDraftSectionHtml',
    'balanceReplySectionHtml',
    'paymentSlipSectionHtml',
    'creditBalanceSectionHtml',
  ],
  Connection: [
    'profileInfoGroupFragments.install',
  ],
  Network: [
    'profileInfoGroupFragments.network',
    'bottleneckSectionHtml',
    'opticalSectionHtml',
    'gpsSectionHtml',
    'poleSectionHtml',
    'feederSectionHtml',
    'mikrotikSectionHtml',
    'routerCredSectionHtml',
  ],
  Hardware: [
    'profileInfoGroupFragments.hardware',
    'custodySectionHtml',
    'nocSectionHtml',
  ],
  History: [
    'lastInteractionLineMarkup',
    'moveHouseHistorySectionMarkup',
    'numberChangeLogSectionMarkup',
    'mohallaChangeRecordSectionMarkup',
    'rootCauseBanner',
    'ticketsSectionHtml',
    'downtimeSectionHtml',
    'uptimeCertSectionHtml',
    'lifecycleJourneyHtml(',
    'statusReplySectionHtml',
    'onboardingChecklistHtml(',
    'renderRelocationTimeline(customer)',
  ],
};

test('phase A membership: every view item renders inside exactly one of the 7 sections', () => {
  const bodies = sectionBodies();
  for (const [section, markers] of Object.entries(MEMBERSHIP)) {
    for (const marker of markers) {
      const hits = SECTIONS.filter((s) => bodies[s].includes(marker));
      assert.deepEqual(hits, [section], `${marker} must sit in ${section} only, found in: ${hits.join(', ') || 'none'}`);
    }
  }
});

test('phase A membership: the 7 section bodies exist, in the Req 1 order, after the strip', () => {
  const assembly = viewAssembly();
  const order = [
    'profile-view-heading',
    'profileQuickActionsRowMarkup',
    'profileHeaderStripSectionHtml',
    'profileSectionCustomerHtml',
    'profileSectionServiceHtml',
    'profileSectionFinancialHtml',
    'profileSectionConnectionHtml',
    'profileSectionNetworkHtml',
    'profileSectionHardwareHtml',
    'profileSectionHistoryHtml',
  ];
  let prev = -1;
  for (const token of order) {
    const at = assembly.indexOf(token);
    assert.notEqual(at, -1, `${token} must be in the view assembly`);
    assert.ok(at > prev, `${token} must follow the previous block in the assembly`);
    prev = at;
  }
});

test('phase A membership: heading, quick actions and header strip stay above the sections', () => {
  const bodies = sectionBodies();
  for (const token of ['profileQuickActionsRowMarkup', 'profileHeaderStripSectionHtml']) {
    for (const section of SECTIONS) {
      assert.ok(!bodies[section].includes(token), `${token} must not move inside ${section}`);
    }
  }
  // The heading div itself is not inside any section body either.
  for (const section of SECTIONS) {
    assert.ok(!bodies[section].includes('profile-view-heading'), `heading must not move inside ${section}`);
  }
});

test('phase A membership: the counter and checklist still sit directly under the heading', () => {
  // Plan 512 anchors are untouched: counter after the heading, checklist
  // after the counter — so the Req 1 order (heading → counter →
  // checklist → quick actions → strip → sections) holds in the DOM.
  assert.ok(appSrc.includes("querySelector('.profile-view-heading')?.insertAdjacentHTML('afterend', `<p class=\"profile-completion-counter\">"));
  assert.ok(appSrc.includes("querySelector('.profile-completion-counter')?.insertAdjacentHTML('afterend', missingFieldsChecklistHtml("));
});

// ------------------------------------------------------------ the appended items
// CLV, field-change history and preferred collection day are appended
// after the template lands, so they need section-body anchors — the old
// anchors would drop them in the wrong section (see the why-comments in
// app.js at each insert).

test('phase A appended: lifetime value lands last inside S3, not at the end of the view', () => {
  assert.ok(appSrc.includes("querySelector('[data-profile-section=\"financial\"] .profile-section-body')?.insertAdjacentHTML('beforeend', customerLifetimeValueMarkup(lifetimeValue))"),
    'CLV must append into the Financial section body (field map item 63)');
  assert.ok(!appSrc.includes("$('#customerProfileView').insertAdjacentHTML('beforeend', customerLifetimeValueMarkup(lifetimeValue))"),
    'CLV must no longer append at the end of the whole view');
});

test('phase A appended: field-change history lands last inside S7, not after the tenure section', () => {
  // The tenure section now lives inside S2, so the old .stv-section
  // anchor would have dropped the history list inside the Service
  // section — silently, via optional chaining.
  assert.ok(appSrc.includes("querySelector('[data-profile-section=\"history\"] .profile-section-body')?.insertAdjacentHTML('beforeend', fieldChangeHistorySectionHtml("),
    'history must append into the History section body (field map item 66)');
  assert.ok(!appSrc.includes("querySelector('.stv-section')?.insertAdjacentHTML('afterend', fieldChangeHistorySectionHtml("),
    'history must no longer anchor on the tenure section');
});

test('phase A appended: preferred collection day lands last inside S1, not after the history list', () => {
  // The old anchor chained off the history list, which now lives in S7;
  // following it would have dropped the collection-day note into S7.
  assert.ok(appSrc.includes("querySelector('[data-profile-section=\"customer\"] .profile-section-body')?.insertAdjacentHTML('beforeend', preferredCollectionDaySectionHtml("),
    'collection day must append into the Customer section body (field map item 67)');
  assert.ok(!appSrc.includes("querySelector('.profile-field-change-history')"), 'collection day must no longer anchor on the history list');
});

// ------------------------------------------------------------ the info-group split
// The four groups split into eight fragments (Table B). Rows move
// verbatim; fragment headings keep the original group heading.

test('phase A groups: eight fragments, one object, in original row order', () => {
  const frags = groupFragments();
  for (const key of ['contact', 'location', 'service', 'money', 'lifecycle', 'install', 'network', 'hardware']) {
    assert.ok(frags.includes(`${key}: profileInfoGroupMarkup(`), `fragment ${key} must exist`);
  }
  assert.ok(frags.indexOf('contact:') < frags.indexOf('location:'), 'Contact stays before Location');
  assert.ok(frags.indexOf('location:') < frags.indexOf('service:'), 'Location stays before Service');
  assert.ok(frags.indexOf('service:') < frags.indexOf('money:'), 'Service rows stay before the money rows');
  assert.ok(frags.indexOf('money:') < frags.indexOf('lifecycle:'), 'money rows stay before the lifecycle rows');
  assert.ok(frags.indexOf('lifecycle:') < frags.indexOf('install:'), 'lifecycle rows stay before the install rows');
  assert.ok(frags.indexOf('install:') < frags.indexOf('network:'), 'install rows stay before the network rows');
  assert.ok(frags.indexOf('network:') < frags.indexOf('hardware:'), 'network rows stay before the hardware rows');
});

test('phase A groups: money rows split out of Service, profit still right after selling', () => {
  const frags = groupFragments();
  const moneyAt = frags.indexOf('money: profileInfoGroupMarkup(');
  const money = frags.slice(moneyAt);
  // Polish #28 Phase B (Req 3) — the money rows now dash empty values
  // through the profile-empty helpers instead of reading "Not set";
  // the membership (which fragment each row lives in) is unchanged.
  assert.ok(money.includes("[t('prof_field_sales_tax'), profileEmptyTax(customerSalesTaxCents(customer))]"), 'tax row moves with the money fragment');
  assert.ok(money.includes("[t('prof_field_purchase_cost'), profileEmptyMoney(customer.monthlyPurchaseCost)]"), 'purchase cost moves with the money fragment');
  assert.ok(money.includes("[t('prof_field_selling'), profileEmptyMoney(customer.monthlySellingAmount)]"), 'selling moves with the money fragment');
  assert.ok(money.includes("[t('prof_field_profit'), profileProfitDisplay(customer, profit)]"), 'profit moves with the money fragment');
  const serviceAt = frags.indexOf('service: profileInfoGroupMarkup(');
  const service = frags.slice(serviceAt, moneyAt);
  assert.ok(service.includes("[t('prof_field_package'), profileEmptyText(customer.packageSpeed)]"), 'package stays with the service rows');
  assert.ok(!service.includes("prof_field_profit"), 'profit must not stay in the service fragment');
  assert.ok(!service.includes("prof_field_selling"), 'selling must not stay in the service fragment');
});

test('phase A groups: Connection rows split lifecycle / install / network / hardware, nothing lost', () => {
  const frags = groupFragments();
  const slice = (from, to) => frags.slice(frags.indexOf(`${from}: profileInfoGroupMarkup(`), to ? frags.indexOf(`${to}: profileInfoGroupMarkup(`) : undefined);
  const lifecycle = slice('lifecycle', 'install');
  // Polish #28 Phase B (Req 3) — the date rows now dash when empty
  // instead of reading "Not recorded"; the membership (which fragment
  // each row lives in) is unchanged.
  assert.ok(lifecycle.includes("customer.expiryDate ? humanDate(customer.expiryDate) : PROFILE_EMPTY_DASH"), 'expiry moves to the lifecycle fragment');
  assert.ok(lifecycle.includes("customer.cancellationDate ? humanDate(customer.cancellationDate) : PROFILE_EMPTY_DASH"), 'cancellation moves to the lifecycle fragment');
  const install = slice('install', 'network');
  for (const row of ['prof_field_conn_start', 'prof_field_conn_fee', 'prof_field_fiber', 'prof_field_fiber_rate', 'prof_field_lineman_fee', 'prof_field_install']) {
    assert.ok(install.includes(row), `install fragment must carry ${row}`);
  }
  assert.ok(!install.includes('prof_field_router'), 'router rows must not stay in the install fragment');
  const network = slice('network', 'hardware');
  for (const row of ['prof_field_pppoe', 'prof_field_static_ip', 'prof_field_mac']) {
    assert.ok(network.includes(row), `network fragment must carry ${row}`);
  }
  const hardware = slice('hardware', null);
  assert.ok(hardware.includes('prof_field_router'), 'router model moves to the hardware fragment');
  assert.ok(hardware.includes('prof_field_router_price'), 'router price moves to the hardware fragment');
  // Table B 20h lists only router model + router price, but Table A maps
  // the media-converter cost field to S6 too — the row follows the field,
  // so all 14 Connection rows are accounted for (2 + 6 + 3 + 3).
  assert.ok(hardware.includes('prof_field_mc_cost'), 'media-converter cost follows its field into the hardware fragment');
  // Polish #28 Phase B (Req 3) — no info-group row reads "Not
  // recorded" any more; the dash replaced all three date rows.
  assert.equal((frags.match(/t\('prof_not_recorded'\)/g) || []).length, 0, 'no date row may read Not recorded across the fragments any more');
});

test('phase A groups: Contact keeps its shortcuts block after the phone row', () => {
  const frags = groupFragments();
  assert.ok(frags.includes('contact: profileInfoGroupMarkup('), 'contact fragment must exist');
  // Phase A: the contact call ends `], contactActionsHtml)` inside the
  // fragments object (the old literal closed the template interpolation
  // with `)}` after it — same call, new container).
  assert.ok(frags.includes('], contactActionsHtml)'), 'Contact group must pass contactActionsHtml after its rows');
  assert.ok(frags.indexOf('contactActionsHtml') < frags.indexOf("t('prof_group_location')"), 'Contact group (with shortcuts) still comes before the Location group');
});

// ------------------------------------------------------------ the custody trap
// .profile-custody-section is shared by ~20 sections; the wiring at
// app.js:8154 used querySelector on it, which returns the FIRST match in
// DOM order — the handling-note section, not the custody section — so the
// disconnected-hardware "mark recovered" buttons were never wired.

test('phase A custody: the wiring no longer uses the shared first-match class', () => {
  assert.ok(!appSrc.includes("querySelector('.profile-custody-section')"), 'no wiring may query the shared class (first match is the handling note)');
  assert.ok(appSrc.includes("querySelector('.profile-hardware-custody')"), 'custody wiring must target the unique class');
});

test('phase A custody: the real custody section carries the unique class', () => {
  assert.ok(appSrc.includes('<section class="profile-custody-section profile-hardware-custody"'), 'custody section must carry the unique class alongside the shared one');
  const custodyAt = appSrc.indexOf('const custodySectionHtml = ');
  assert.notEqual(custodyAt, -1, 'custody section literal must exist');
  const line = appSrc.slice(custodyAt, appSrc.indexOf('\n', custodyAt));
  assert.ok(line.includes('data-profile-custody-recover'), 'recover buttons stay in the custody section');
  assert.ok(line.includes('profileCustodyRecoverAllBtn'), 'recover-all button stays in the custody section');
});

// ------------------------------------------------------------ summaries + i18n

test('phase A summaries: seven shells, each with a heading and a one-line summary', () => {
  // Shell consts are single lines, like the groups literal: extract each
  // `const profileSection<X>Html = ...;` line and check its arguments.
  const shells = {};
  for (const section of SECTIONS) {
    const start = appSrc.indexOf(`const profileSection${section}Html = `);
    assert.notEqual(start, -1, `profileSection${section}Html must exist`);
    shells[section] = appSrc.slice(start, appSrc.indexOf('\n', start));
  }
  assert.equal(Object.keys(shells).length, 7, 'exactly seven section shells');
  const keys = { Customer: 'customer', Service: 'service', Financial: 'financial', Connection: 'connection', Network: 'network', Hardware: 'hardware', History: 'history' };
  for (const [section, key] of Object.entries(keys)) {
    const call = shells[section];
    assert.ok(call.includes(`profileDetailSectionHtml({ key: '${key}'`), `${key} shell must name its key`);
    assert.ok(call.includes(`heading: t('prof_sec_${key}')`), `${key} heading must use its prof_sec_ key`);
    assert.ok(call.includes('summary: `'), `${key} summary must be a template literal`);
    assert.ok(call.includes('open: profileSectionOpenFor('), `${key} open state must come from the store`);
  }
});

test('phase A summaries: section heading keys exist in EN + UR with real values', async () => {
  const { TRANSLATIONS } = await import('../nav-language.js');
  const expected = {
    prof_sec_customer: ['Customer Information', 'کسٹمر کی معلومات'],
    prof_sec_service: ['Service & Package', 'سروس اور پیکج'],
    prof_sec_financial: ['Financial Details', 'مالی تفصیلات'],
    prof_sec_connection: ['Connection & Installation', 'کنکشن اور انسٹالیشن'],
    prof_sec_network: ['Network Configuration', 'نیٹ ورک کنفیگریشن'],
    prof_sec_hardware: ['Hardware & Equipment', 'ہارڈویئر اور آلات'],
    prof_sec_history: ['History & Activity', 'تاریخ اور سرگرمی'],
  };
  for (const [key, [en, ur]] of Object.entries(expected)) {
    assert.equal(TRANSLATIONS.en[key], en, `EN ${key}`);
    assert.equal(TRANSLATIONS.ur[key], ur, `UR ${key}`);
    assert.match(TRANSLATIONS.ur[key], /[\u0600-\u06FF]/, `UR ${key} must carry Urdu script`);
  }
});

// ------------------------------------------------------------ the store module

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    _store: store,
  };
}

test('phase A store: defaults open S1/S2/S3 and close the rest', async () => {
  const mod = await loadSectionsModule();
  assert.deepEqual(mod.PROFILE_SECTION_KEYS, ['customer', 'service', 'financial', 'connection', 'network', 'hardware', 'history']);
  assert.equal(mod.PROFILE_SECTION_OPEN_KEY, 'shahdara_profile_section_open_v1');
  assert.deepEqual(mod.PROFILE_SECTION_DEFAULT_OPEN, {
    customer: true, service: true, financial: true,
    connection: false, network: false, hardware: false, history: false,
  });
});

test('phase A store: open state round-trips per customer, unknown keys dropped', async () => {
  const mod = await loadSectionsModule();
  const storage = fakeStorage();
  assert.deepEqual(mod.loadProfileSectionOpen(storage), {}, 'empty store reads as no saved state');
  assert.equal(mod.saveProfileSectionOpen(storage, { c1: { customer: false, history: true } }), true);
  assert.deepEqual(mod.loadProfileSectionOpen(storage), { c1: { customer: false, history: true } });
  assert.equal(mod.profileSectionOpenFor('c1', mod.loadProfileSectionOpen(storage), 'customer'), false, 'stored closed wins over the default');
  assert.equal(mod.profileSectionOpenFor('c1', mod.loadProfileSectionOpen(storage), 'service'), true, 'missing key falls back to its default');
  assert.equal(mod.profileSectionOpenFor('c2', mod.loadProfileSectionOpen(storage), 'customer'), true, 'unknown customer falls back to defaults');
  assert.equal(mod.profileSectionOpenFor('c1', mod.loadProfileSectionOpen(storage), 'bogus'), false, 'unknown section reads closed');
  // Corrupt or wrong-shaped stores never throw and never invent state.
  assert.deepEqual(mod.loadProfileSectionOpen(fakeStorage({ [mod.PROFILE_SECTION_OPEN_KEY]: '{not json' })), {});
  assert.deepEqual(mod.loadProfileSectionOpen(fakeStorage({ [mod.PROFILE_SECTION_OPEN_KEY]: JSON.stringify({ c1: { customer: 'yes', history: 1, bogus: true } }) })), { c1: {} });
  assert.deepEqual(mod.loadProfileSectionOpen(null), {});
  assert.equal(mod.saveProfileSectionOpen(null, {}), false);
});

test('phase A store: withProfileSectionOpen is pure and merges per customer', async () => {
  const mod = await loadSectionsModule();
  const before = { c1: { customer: false } };
  const after = mod.withProfileSectionOpen(before, 'c1', 'history', true);
  assert.deepEqual(before, { c1: { customer: false } }, 'input map must not mutate');
  assert.deepEqual(after, { c1: { customer: false, history: true } });
  assert.deepEqual(mod.withProfileSectionOpen(after, 'c2', 'network', true), {
    c1: { customer: false, history: true },
    c2: { network: true },
  });
});

test('phase A shell: details markup, summary line, escaping, open attribute', async () => {
  const mod = await loadSectionsModule();
  const html = mod.profileDetailSectionHtml({
    key: 'financial', heading: 'Financial Details', summary: 'Dues PKR 1,000 · Monthly package profit PKR 1,800',
    body: '<p>BODY</p>', open: true,
  });
  assert.ok(html.startsWith('<details class="profile-detail-section" data-profile-section="financial" open>'), 'open section carries the open attribute');
  assert.ok(html.includes('<summary><h3>Financial Details</h3><span class="profile-section-summary">Dues PKR 1,000 · Monthly package profit PKR 1,800</span></summary>'), 'summary carries heading + one-line summary');
  assert.ok(html.includes('<div class="profile-section-body"><p>BODY</p></div></details>'), 'body sits in its own div, passed through');
  const closed = mod.profileDetailSectionHtml({ key: 'history', heading: 'History & Activity', summary: 'S', body: '', open: false });
  assert.ok(closed.startsWith('<details class="profile-detail-section" data-profile-section="history">'), 'closed section carries no open attribute');
  assert.ok(!closed.includes(' open>'), 'closed markup must not contain an open attribute');
  const escaped = mod.profileDetailSectionHtml({ key: 'customer', heading: 'A & B <C>', summary: 'x "y"', body: '', open: false });
  assert.ok(escaped.includes('A &amp; B &lt;C&gt;'), 'heading must be escaped');
  assert.ok(escaped.includes('x &quot;y&quot;'), 'summary must be escaped');
});

// ------------------------------------------------------------ wiring + styles

test('phase A wiring: section toggles persist, and render reads the store back', () => {
  assert.ok(appSrc.includes("querySelectorAll('.profile-detail-section')"), 'render must find the section shells');
  assert.ok(appSrc.includes("addEventListener('toggle'"), 'open/close must be watched via the toggle event');
  assert.ok(appSrc.includes('saveProfileSectionOpen('), 'toggle must save the new state');
  assert.ok(appSrc.includes('loadProfileSectionOpen(localStorage)'), 'render must read the saved state');
  assert.ok(appSrc.includes('profileSectionOpenFor('), 'render must resolve each section through its default');
  assert.ok(appSrc.includes("from './profile-sections.js"), 'app.js must import the section module');
});

test('phase A wiring: each section’s buttons are still wired after render (spot-check)', () => {
  // Wiring queries inside #customerProfileView find elements inside
  // collapsed <details> too, so moving markup into sections must not
  // rename the hooks the wiring looks for.
  for (const hook of [
    "querySelector('#wadaQuickForm')",
    "querySelector('#profileKistAddBtn')",
    "querySelector('#profileMikrotikCopyBtn')",
    "querySelector('#billingCycleSaveBtn')",
    "querySelector('#profileCustodyRecoverAllBtn')",
    "querySelector('#profileDepositSettleBtn')",
    "querySelector('#profileNocPrintBtn')",
    "querySelector('#profileCreditTransferBtn')",
    "querySelector('#profileBadDebtWriteOffBtn')",
    "querySelector('#profileSignalRecordBtn')",
  ]) {
    assert.ok(appSrc.includes(hook), `wiring must still find ${hook}`);
  }
});

test('phase A styles: section rules exist, chevron rotates on open, tokens only', () => {
  assert.ok(stylesSrc.includes('.profile-detail-section'), 'section shell must have rules');
  assert.ok(stylesSrc.includes('.profile-detail-section>summary') || stylesSrc.includes('.profile-detail-section summary'), 'summary row must have rules');
  assert.ok(stylesSrc.includes('.profile-section-summary'), 'summary line must have rules');
  assert.ok(stylesSrc.includes('.profile-section-body'), 'section body must have rules');
  assert.ok(stylesSrc.includes(".profile-detail-section summary::after"), 'summary must carry the month-card chevron');
  assert.ok(stylesSrc.includes("content:'⌄'"), 'chevron must be the month-card glyph');
  assert.ok(stylesSrc.includes('.profile-detail-section[open] summary::after'), 'chevron must rotate when open');
  // No new hex: every hex in the new rules already exists elsewhere.
  const rules = stylesSrc.match(/\.profile-detail-section[^{]*\{[^}]*\}|\.profile-section-[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 4, 'at least the shell, summary, summary-line and body rules must exist');
  const stripped = stylesSrc.replace(/\.profile-detail-section[^{]*\{[^}]*\}|\.profile-section-[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((stripped.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    for (const hex of rule.match(/#[0-9a-fA-F]{3,8}/g) || []) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex ${hex} in ${rule.slice(0, 60)}`);
    }
  }
});

test('phase A styles: the 2-column field grid still holds at ≤620px for every section grid', () => {
  // The trap from Audit 5: a bare .profile-readonly-grid collapses to 1
  // column at ≤620px; only the .profile-info-group override keeps 2.
  // The fragments keep the .profile-info-group wrapper, so the override
  // still applies to every section's field grid.
  assert.ok(stylesSrc.includes('.profile-info-group .profile-readonly-grid{grid-template-columns:repeat(2,minmax(0,1fr))'), 'override must still force 2 columns at phone width');
  const frags = groupFragments();
  assert.equal((frags.match(/profileInfoGroupMarkup\(/g) || []).length, 8, 'all eight fragments render through the info-group markup');
});

// ------------------------------------------------------------ pins (true on the pristine base too)

test('pin: every view item variable exists in app.js (membership counts items, not their existence)', () => {
  for (const marker of [
    'handlingNoteSectionMarkup', 'standingInstructionSectionMarkup', 'spokenLanguageNoteSectionMarkup',
    'gateAccessInstructionSectionMarkup', 'customerEmergencyContactSectionMarkup', 'profileFreshnessStampMarkup',
    'profileVerificationTickSectionMarkup', 'temporarilyAwayFlagSectionMarkup', 'householdLinkSectionMarkup',
    'welcomePackSectionHtml', 'termsAckSectionHtml', 'packageHistorySectionMarkup', 'serviceTenureSectionMarkup',
    'upsellSectionHtml', 'boostSectionHtml', 'vacationHoldSectionHtml', 'packageChangeSectionHtml',
    'qualityLogSectionHtml', 'infoCardSectionHtml', 'wadaProfileBannerHtml', 'duesBreakdownSectionMarkup',
    'crossPaymentsMadeSectionMarkup', 'referralSectionHtml', 'contributorSectionHtml', 'kistSectionHtml',
    'nextBillSectionHtml', 'depositSettlementHtml', 'depositOffsetHtml', 'creditTransferSectionHtml',
    'badDebtSectionHtml', 'firstBillPreviewSectionHtml', 'billingCycleSectionHtml', 'paymentChannelSectionHtml',
    'statementDraftSectionHtml', 'balanceReplySectionHtml', 'paymentSlipSectionHtml', 'creditBalanceSectionHtml',
    'bottleneckSectionHtml', 'opticalSectionHtml', 'gpsSectionHtml', 'poleSectionHtml', 'feederSectionHtml',
    'mikrotikSectionHtml', 'routerCredSectionHtml', 'custodySectionHtml', 'nocSectionHtml',
    'lastInteractionLineMarkup', 'moveHouseHistorySectionMarkup', 'numberChangeLogSectionMarkup',
    'mohallaChangeRecordSectionMarkup', 'rootCauseBanner', 'ticketsSectionHtml', 'downtimeSectionHtml',
    'uptimeCertSectionHtml', 'statusReplySectionHtml', 'renderRelocationTimeline',
  ]) {
    assert.ok(appSrc.includes(marker), `${marker} must exist in app.js`);
  }
});

test('pin: the info-group renderer still emits a section with h4 + 2-column grid', () => {
  const start = appSrc.indexOf('function profileReadonlyField(');
  assert.notEqual(start, -1, 'profileReadonlyField must exist');
  const markupStart = appSrc.indexOf('function profileInfoGroupMarkup(');
  assert.notEqual(markupStart, -1, 'profileInfoGroupMarkup must exist');
  const end = appSrc.indexOf('\n}\n', markupStart);
  assert.notEqual(end, -1, 'profileInfoGroupMarkup must end cleanly');
  const src = appSrc.slice(start, end + 3);
  const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Polish #28 Phase B (Req 3) — profileReadonlyField wraps the bare
  // dash in .profile-empty-value, so the dash constant must be in the
  // sandbox with it.
  const profileInfoGroupMarkup = runInNewContext(`${src}\nprofileInfoGroupMarkup;`, { escapeHtml, PROFILE_EMPTY_DASH: '—' });
  const html = profileInfoGroupMarkup('Contact', [['Phone', '03012345678'], ['CNIC', '35201-1234567-1']]);
  assert.ok(html.startsWith('<section class="profile-info-group"><h4>Contact</h4>'), 'section and heading unchanged');
  assert.ok(html.includes('<dl class="profile-readonly-grid">'), 'rows still render in the 2-column grid');
});

test('pin: the profile view heading stays the h3, so levels run h3 (view) then h3 (sections) then h4 (groups)', () => {
  assert.ok(appSrc.includes('<div class="profile-view-heading"><h3>${t(\'prof_view_heading\')}</h3>'), 'the profile view heading must stay the <h3>');
});

test('pin: no real customer names or phone numbers in this test', () => {
  // Pattern-based: an 11-digit Pakistani mobile shape must never appear.
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(testSrc), 'test must not contain a realistic phone number');
});
