// Urdu auto-translation phase 2: Dashboard screen via t() + dictionary.
// (a) Dictionary completeness: every dash_ key exists in BOTH en and ur, each
//     defined exactly once per block, and every ur value contains Urdu script.
// (b) REAL renderer tests (no fake stubs of the renderers themselves):
//     renderHomeTodaySummary + setupDailyClosingCard run for real against a
//     stub document — Urdu strings in 'ur' mode, exact English originals in
//     'en' mode, and the outgoing wa.me message body stays Roman Urdu.
// (c) renderDashboard strings are proven through the same t() path it uses:
//     exact-English pins taken from the pre-change code, Urdu-script
//     assertions for the same keys, a source-level proof that every literal
//     dash_ key renderDashboard calls exists in the dictionary, and a wiring
//     pin that the language-change listener re-renders the dashboard.
// (d) index.html pins: dashboard statics carry data-i18n, all 69 chart titles
//     carry it, business subtitles 3-20 carry it, engineering subtitles
//     21-69 deliberately do NOT (charts phase), and no dash_ data-i18n lives
//     inside a dialog (modals are a separate later phase).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { TRANSLATIONS, t, setAppLanguage, URDU_SCRIPT_PATTERN } = await import('../nav-language.js');
const { renderHomeTodaySummary } = await import('../home-today.js');
const { setupDailyClosingCard } = await import('../dashboard-daily-closing.js');

const URDU = /[\u0600-\u06FF]/;
assert.ok(URDU_SCRIPT_PATTERN, 'nav-language exports URDU_SCRIPT_PATTERN');
const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const navSrc = readFileSync(path.join(root, 'nav-language.js'), 'utf8');
const appSrc = readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSrc = readFileSync(path.join(root, 'index.html'), 'utf8');

function dictBlock(src, lang) {
  const start = src.indexOf(`  ${lang}: {`);
  const end = src.indexOf('\n};', start);
  return src.slice(start, end);
}

test('phase 2 dictionary: every dash_ key exists in en and ur, defined once, ur carries Urdu script', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('dash_'));
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('dash_'));
  assert.ok(enKeys.length >= 400, `expected 400+ dash_ keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys.sort(), enKeys.sort(), 'ur dict must carry exactly the en dash_ keys');
  for (const block of [dictBlock(navSrc, 'en'), dictBlock(navSrc, 'ur')]) {
    for (const key of enKeys) {
      const occurrences = (block.match(new RegExp(`^\\s*${key}:`, 'm')) || []).length;
      assert.equal(occurrences, 1, `${key}: must be defined exactly once per dict block`);
    }
  }
  for (const key of enKeys) {
    const ur = TRANSLATIONS.ur[key];
    assert.equal(typeof ur, 'string', `${key}: ur value must be a string`);
    assert.ok(URDU.test(ur), `${key}: ur value must contain Urdu script, got ${JSON.stringify(ur)}`);
    assert.ok(URDU_SCRIPT_PATTERN.test(ur), `${key}: ur value must match URDU_SCRIPT_PATTERN`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `${key}: en value must not be empty`);
  }
});

test('phase 2 dictionary: phase 1 cust_ keys are untouched', () => {
  assert.equal(t('cust_new_customers_eyebrow', 'en'), 'NEW CUSTOMERS');
  assert.equal(t('cust_table_empty', 'en'), 'No customers found.');
  assert.equal(t('cust_new_customers_eyebrow', 'ur'), 'نئے گاہک');
});

test('phase 2 dictionary: English pins are byte-identical to the pre-change strings', () => {
  const pins = {
    dash_shop_empty: 'No shop collections',
    dash_shop_empty_period: 'Unsettled cash sitting at shops',
    dash_cycle_empty: 'No cycle run yet',
    dash_cycle_period_empty: 'Run a monthly cycle with arrears & advance',
    dash_complaint_empty: 'No complaints',
    dash_complaint_period_empty: 'Open faults and resolution downtime',
    dash_ticket_empty: 'No field tickets',
    dash_ticket_period_empty: 'Lineman worklist and material use',
    dash_downtime_empty: 'No downtime',
    dash_downtime_period_empty: 'Per-customer and network outage hours',
    dash_splitter_empty: 'No splitter boxes',
    dash_splitter_period_empty: 'Splitter box port map and RX signal health',
    dash_report_period_empty: '4-part monthly report: summary, customers, causes, full log',
    dash_inv_empty: 'No stock recorded',
    dash_inv_period_empty: 'Fiber, routers, converters & field stock',
    dash_outage_empty: 'No feeder links',
    dash_outage_period_empty: 'Link customers to feeders to trace outages',
    dash_saad_empty: 'No visits yet',
    dash_saad_period_empty: 'Saad field visits, hours & payments',
    dash_install_empty: 'No requests yet',
    dash_install_period_empty: 'New connection requests & install delays',
    dash_pending_empty: 'Nothing pending',
    dash_pending_period_empty: 'Owner notes & reminders',
    dash_pole_empty: 'No poles mapped',
    dash_group_period_empty: 'Family / landlord groups',
    dash_recovery_period_empty: 'ISP-owned hardware at disconnected houses',
    dash_khata_empty: 'No activity',
    dash_wallet_empty: 'No digital payments',
    dash_wallet_period_empty: 'EasyPaisa · JazzCash · NayaPay · Bank Transfer',
    dash_no_payments: 'No payment entries',
    dash_no_bills: 'No bill entries',
    dash_no_entries: 'No entries',
    dash_no_activity: 'No recorded activity',
    dash_no_credit: 'No credit entries',
    dash_not_set: 'Not set',
    dash_margin_note: 'Selling amount − provider cost · expected margin, not collected cash profit',
    dash_excluded_default: 'Dues use each saved month’s bill snapshot after receipts and carry-forward credit; credits are not new cash.',
    dash_provcost_period: 'Expected recurring monthly cost · not cash paid',
    dash_provcost_empty: 'No provider-cost entries · not cash paid',
    dash_billstatus_empty: 'No bills recorded for current month',
    dash_kpi_rate_zero: '0% collected',
    dash_closing_copied: 'Daily closing slip copied to clipboard!',
    dash_closing_ready: 'Daily closing summary ready.',
    dash_today_live_suffix: 'Live closing register & collections',
    dash_today_no_overdue: '✅ No overdue accounts — all active customers cleared!',
    dash_today_wa_title: 'Send WhatsApp reminder',
    dash_today_collect_title: 'Collect payment',
    dash_today_collect_text: 'Collect',
    dash_closing_status_no: 'No Activity Today',
    dash_closing_status_met: 'Target Met (100%+)',
    dash_closing_status_track: 'On Track',
    dash_closing_status_below: 'Below Target',
  };
  for (const [key, english] of Object.entries(pins)) {
    assert.equal(t(key, 'en'), english, `${key}: English must stay ${JSON.stringify(english)}`);
    assert.notEqual(t(key, 'ur'), english, `${key}: Urdu must differ from English`);
    assert.ok(URDU.test(t(key, 'ur')), `${key}: Urdu must contain Urdu script`);
  }
});

test('phase 2 dictionary: interpolated keys keep their params in both languages', () => {
  assert.equal(t('dash_complaint_open', 'en', { open: 2, inProgress: 1 }), '2 open · 1 in progress');
  assert.equal(t('dash_complaint_open', 'ur', { open: 2, inProgress: 1 }), '2 کھلی · 1 زیر عمل');
  assert.equal(t('dash_excluded_default', 'en'), 'Dues use each saved month’s bill snapshot after receipts and carry-forward credit; credits are not new cash.');
  assert.equal(t('dash_profit_period', 'en', { collection: 'PKR 10,000', expenses: 'PKR 2,000' }), 'PKR 10,000 actual receipts − PKR 2,000 recorded expenses');
  assert.equal(t('dash_profit_period', 'ur', { collection: 'PKR 10,000', expenses: 'PKR 2,000' }), 'PKR 10,000 اصل رسیدیں − PKR 2,000 درج شدہ اخراجات');
  // The pre-change note kept the verb 'are' even for 1 — the key preserves it.
  assert.equal(t('dash_note_unpriced_sing', 'en', { count: 1 }), '1 pending bill without a recorded amount are excluded from due totals.');
  assert.equal(t('dash_note_unpriced_plur', 'en', { count: 2 }), '2 pending bills without a recorded amount are excluded from due totals.');
  assert.equal(t('dash_closing_value', 'en', { amount: 'PKR 5,000', count: 1 }), 'PKR 5,000 (1 txs)');
  assert.equal(t('dash_closing_value', 'ur', { amount: 'PKR 5,000', count: 1 }), 'PKR 5,000 (1 لین دین)');
  assert.equal(t('dash_closing_target', 'en', { target: 'PKR 97', pct: 5155, cash: 'PKR 5,000' }), 'Target: PKR 97/day (5155%) · Net Cash: PKR 5,000');
  assert.equal(t('dash_closing_target_alt', 'en', { target: 'PKR 0', pct: 0 }), 'Target: PKR 0 / day · 0% attainment');
  assert.equal(t('dash_overhead_due', 'en', { month: 'October 2026' }), 'Upstream bandwidth bill not yet paid for October 2026 — post it before the month closes so profit and partner shares stay true.');
  assert.ok(!t('dash_overhead_due', 'en', { month: 'October 2026' }).includes('{month}'), 'overhead params must interpolate');
});

function stubDoc() {
  const els = {};
  return {
    els,
    doc: { getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '' }) },
  };
}

const todayBase = {
  todayStr: '2026-10-28',
  todayCollected: 5000,
  cashCollected: 3000,
  digitalCollected: 2000,
  targetPct: 42,
  monthCollected: 90000,
  monthBilled: 120000,
  totalDue: 30000,
  customersWithDuesCount: 3,
  newCustomersThisMonth: 2,
};

test('phase 2 render: Today card in Urdu mode shows Urdu, never the English originals', () => {
  setAppLanguage('ur');
  const { els, doc } = stubDoc();
  renderHomeTodaySummary(doc, { ...todayBase, top5Overdue: [] });
  assert.equal(els.homeTodayDateText.textContent, '2026-10-28 · براہ راست بندش رجسٹر اور وصولیاں');
  assert.equal(els.homeTodayCashVsDigital.textContent, 'نقد: PKR 3,000 · ڈیجیٹل: PKR 2,000');
  assert.equal(els.homeTodayCollectedVsBilled.textContent, 'PKR 90,000 / PKR 120,000 بل شدہ');
  assert.equal(els.homeTodayDuesCount.textContent, '3 کھاتے واجبات کے ساتھ');
  assert.equal(els.homeTopOverdueList.innerHTML, '<li class="overdue-empty-item">✅ کوئی بقایا کھاتہ نہیں — تمام فعال گاہک صاف ہیں!</li>');
  assert.ok(!els.homeTopOverdueList.innerHTML.includes('No overdue accounts'), 'empty overdue must not be English');
  assert.ok(!els.homeTodayDateText.textContent.includes('Live closing'), 'date line must not be English');

  renderHomeTodaySummary(doc, {
    ...todayBase,
    top5Overdue: [{ id: 'c9', customerNumber: '35', name: 'RAJA ALI', phone: '03001234567', mohalla: 'Barrian', balanceDue: 6000 }],
  });
  const row = els.homeTopOverdueList.innerHTML;
  assert.ok(row.includes('title="واٹس ایپ یاد دہانی بھیجیں"'), 'WA link title must be Urdu');
  assert.ok(row.includes('aria-label="RAJA ALI کو واٹس ایپ بھیجیں"'), 'WA link aria must be Urdu');
  assert.ok(row.includes('title="ادائیگی وصول کریں"'), 'Collect title must be Urdu');
  assert.ok(row.includes('aria-label="RAJA ALI سے وصول کریں"'), 'Collect aria must be Urdu');
  assert.ok(row.includes('>وصول کریں</a>'), 'Collect text must be Urdu');
  assert.ok(!row.includes('Send WhatsApp reminder'), 'WA title must not be English');
  assert.ok(!row.includes('>Collect</a>'), 'Collect text must not be English');
  // The outgoing wa.me message body stays Roman Urdu (an outgoing message, not screen text).
  assert.ok(row.includes('wa.me/923001234567'), 'WA link must carry the normalized number');
  assert.ok(row.includes('Salam'), 'WA message body must stay Roman Urdu');
});

test('phase 2 render: Today card in English mode is byte-identical to the old strings', () => {
  setAppLanguage('en');
  const { els, doc } = stubDoc();
  renderHomeTodaySummary(doc, { ...todayBase, top5Overdue: [] });
  assert.equal(els.homeTodayDateText.textContent, '2026-10-28 · Live closing register & collections');
  assert.equal(els.homeTodayCashVsDigital.textContent, 'Cash: PKR 3,000 · Digital: PKR 2,000');
  assert.equal(els.homeTodayCollectedVsBilled.textContent, 'PKR 90,000 / PKR 120,000 billed');
  assert.equal(els.homeTodayDuesCount.textContent, '3 accounts with dues');
  assert.equal(els.homeTopOverdueList.innerHTML, '<li class="overdue-empty-item">✅ No overdue accounts — all active customers cleared!</li>');
});

test('phase 2 render: Daily Closing card in Urdu mode shows Urdu, never the English originals', () => {
  setAppLanguage('ur');
  const refDate = new Date('2026-10-28T00:00:00Z');
  const state = {
    customers: [{
      id: 'c9', customerNumber: '35', name: 'RAJA ALI', mohalla: 'Barrian',
      bills: [{ month: '2026-10', dueAmount: 3000, payments: [{ date: '2026-10-28', amount: 5000, method: 'Cash' }] }],
    }],
    expenses: [],
  };
  const els = {};
  const slipBtn = { dataset: {}, addEventListener() {} };
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'quickActionDailyClosingSlip') return slipBtn;
      return (els[id] ??= { textContent: '', className: '' });
    },
  };
  try {
    setupDailyClosingCard(state, refDate, { getState: () => state, onToast: () => {} });
  } finally {
    delete globalThis.document;
  }
  // monthBilled 3000 / 31 days -> target 97; 5000 collected -> 5155% -> exceeded.
  assert.equal(els.dashboardDailyClosingValue.textContent, 'PKR 5,000 (1 لین دین)');
  assert.equal(els.dashboardDailyClosingPeriod.textContent, 'ہدف: PKR 97/دن (5155%) · خالص نقد: PKR 5,000');
  assert.equal(els.dashboardClosingStatusBadge.textContent, 'ہدف مکمل (100%+)');
  assert.ok(!els.dashboardDailyClosingValue.textContent.includes('txs'), 'value must not be English');
  assert.ok(!els.dashboardClosingStatusBadge.textContent.includes('Target Met'), 'badge must not be English');

  const emptyEls = {};
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'quickActionDailyClosingSlip') return { dataset: {}, addEventListener() {} };
      return (emptyEls[id] ??= { textContent: '', className: '' });
    },
  };
  try {
    setupDailyClosingCard({ customers: [], expenses: [] }, refDate, { getState: () => ({ customers: [], expenses: [] }), onToast: () => {} });
  } finally {
    delete globalThis.document;
  }
  assert.equal(emptyEls.dashboardDailyClosingValue.textContent, 'کوئی ادائیگی درج نہیں');
  assert.equal(emptyEls.dashboardDailyClosingPeriod.textContent, 'ہدف: PKR 0 / دن · 0% تکمیل');
  assert.equal(emptyEls.dashboardClosingStatusBadge.textContent, 'آج کوئی سرگرمی نہیں');
});

test('phase 2 render: Daily Closing card in English mode is byte-identical to the old strings', () => {
  setAppLanguage('en');
  const refDate = new Date('2026-10-28T00:00:00Z');
  const state = {
    customers: [{
      id: 'c9', customerNumber: '35', name: 'RAJA ALI', mohalla: 'Barrian',
      bills: [{ month: '2026-10', dueAmount: 3000, payments: [{ date: '2026-10-28', amount: 5000, method: 'Cash' }] }],
    }],
    expenses: [],
  };
  const els = {};
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'quickActionDailyClosingSlip') return { dataset: {}, addEventListener() {} };
      return (els[id] ??= { textContent: '', className: '' });
    },
  };
  try {
    setupDailyClosingCard(state, refDate, { getState: () => state, onToast: () => {} });
  } finally {
    delete globalThis.document;
  }
  assert.equal(els.dashboardDailyClosingValue.textContent, 'PKR 5,000 (1 txs)');
  assert.equal(els.dashboardDailyClosingPeriod.textContent, 'Target: PKR 97/day (5155%) · Net Cash: PKR 5,000');
  assert.equal(els.dashboardClosingStatusBadge.textContent, 'Target Met (100%+)');
});

test('phase 2 wiring: every literal dash_ key renderDashboard calls exists in the dictionary', () => {
  const start = appSrc.indexOf('function renderDashboard()');
  const end = appSrc.indexOf('\nfunction ', start + 10);
  const renderDashboard = appSrc.slice(start, end);
  const called = new Set();
  for (const m of renderDashboard.matchAll(/t\(\s*'(dash_[^']+)'/g)) called.add(m[1]);
  for (const m of renderDashboard.matchAll(/\?\s*'(dash_[^']+)'\s*:\s*'(dash_[^']+)'/g)) { called.add(m[1]); called.add(m[2]); }
  assert.ok(called.size >= 100, `expected 100+ dash_ keys called from renderDashboard, got ${called.size}`);
  for (const key of called) {
    assert.ok(key in TRANSLATIONS.en, `renderDashboard calls ${key} but it is missing from the en dict`);
    assert.ok(key in TRANSLATIONS.ur, `renderDashboard calls ${key} but it is missing from the ur dict`);
  }
});

test('phase 2 wiring: the language-change listener re-renders the dashboard', () => {
  const m = appSrc.match(/window\.addEventListener\('shahdara:language-change', \(\) => \{([\s\S]*?)\}\);/);
  assert.ok(m, 'language-change listener must exist in app.js');
  assert.ok(m[1].includes('renderDashboard();'), 'listener must call renderDashboard()');
  assert.ok(m[1].includes('renderDetail();'), 'listener must keep renderDetail()');
  assert.ok(m[1].includes('renderCustomers();'), 'listener must keep renderCustomers()');
});

test('phase 2 wiring: dashboard statics carry data-i18n in index.html', () => {
  for (const key of [
    'dash_eyebrow_live', 'dash_title', 'dash_units', 'dash_add_payment', 'dash_guidance',
    'dash_kpi_today', 'dash_kpi_month', 'dash_kpi_dues', 'dash_kpi_defaulters',
    'dash_tile_collect_title', 'dash_tile_customer_title', 'dash_tile_dues_title', 'dash_tile_closing_title',
    'dash_today_badge', 'dash_today_heading', 'dash_today_wa_text', 'dash_today_label_collected',
    'dash_today_overdue_title', 'dash_today_overdue_all',
    'dash_card_closing', 'dash_card_shop', 'dash_card_cycle', 'dash_card_complaint',
    'dash_card_tickets', 'dash_card_downtime', 'dash_card_splitter', 'dash_card_monthly_report',
    'dash_card_roznamcha', 'dash_card_stock', 'dash_card_outage', 'dash_card_saad',
    'dash_card_install', 'dash_card_pending', 'dash_card_pole', 'dash_card_group',
    'dash_card_recovery', 'dash_card_khata', 'dash_card_wallet',
    'dash_card_month_due', 'dash_card_total_due', 'dash_card_today_coll', 'dash_card_month_coll',
    'dash_card_month_billed', 'dash_card_expenses', 'dash_card_profit', 'dash_card_profiles',
    'dash_card_active', 'dash_card_bill_status', 'dash_card_new_conn', 'dash_card_velocity',
    'dash_card_total_coll', 'dash_card_credit', 'dash_card_prev_coll',
    'dash_card_exp_profit', 'dash_card_prov_cost',
    'dash_btn_cash_suite', 'dash_btn_daily_register', 'dash_btn_daily_slip', 'dash_btn_staff_perf',
    'dash_btn_shop_settlement', 'dash_btn_billing_cycle', 'dash_btn_monthly_report',
    'dash_btn_roznamcha', 'dash_btn_trace_outage', 'dash_btn_saad_visits', 'dash_btn_cheatsheet',
    'dash_btn_wallet', 'dash_btn_target', 'dash_btn_worklists',
    'dash_target_title', 'dash_target_sub', 'dash_worklists_title', 'dash_worklists_sub',
    'dash_worklists_disc', 'dash_worklists_rec', 'dash_worklists_ready',
    'dash_charts_collapse', 'dash_charts_badge', 'dash_charts_eyebrow', 'dash_charts_heading', 'dash_charts_caption',
    'dash_prov_title', 'dash_prov_eyebrow', 'dash_prov_heading', 'dash_prov_explainer', 'dash_prov_empty',
    'dash_owner_eyebrow', 'dash_owner_heading', 'dash_owner_note', 'dash_owner_badge',
    'dash_owner_input_label', 'dash_owner_voice_btn', 'dash_owner_ask', 'dash_owner_voice_note',
  ]) {
    assert.ok(indexSrc.includes(`data-i18n="${key}"`), `index.html must carry data-i18n="${key}"`);
  }
  assert.ok(indexSrc.includes('data-i18n-aria-label="dash_kpi_region_aria"'), 'KPI region aria must be wired');
  assert.ok(indexSrc.includes('data-i18n-aria-label="dash_tile_collect_aria"'), 'collect tile aria must be wired');
  assert.ok(indexSrc.includes('data-i18n-aria-label="dash_today_wa_aria"'), 'WA button aria must be wired');
  assert.ok(indexSrc.includes('data-i18n-aria-label="dash_summary_grid_aria"'), 'summary grid aria must be wired');
  assert.ok(indexSrc.includes('data-i18n-aria-label="dash_velocity_aria"'), 'velocity aria must be wired');
  assert.ok(indexSrc.includes('data-i18n-aria-label="dash_target_gauge_aria"'), 'target gauge aria must be wired');
  assert.ok(indexSrc.includes('data-i18n-placeholder="dash_owner_placeholder"'), 'owner input placeholder must be wired');
  // The voice-language label wraps its <select>: data-i18n would destroy the
  // select, so it is deliberately NOT wired (charts/modals follow-up).
  const voiceLabel = indexSrc.match(/<label class="owner-voice-language"[^>]*>/);
  assert.ok(voiceLabel && !voiceLabel[0].includes('data-i18n'), 'voice-language label must not carry data-i18n (it wraps the select)');
});

test('phase 2 wiring: all 69 chart titles and business subtitles 3-20 are wired; engineering subtitles 21-69 are not', () => {
  const home = indexSrc.slice(indexSrc.indexOf('id="billingDashboard"'), indexSrc.indexOf('id="homeProviderCostDetails"'));
  const titles = [...home.matchAll(/<h4 class="chart-title"([^>]*)>/g)];
  assert.equal(titles.length, 69, `expected 69 chart titles, got ${titles.length}`);
  for (const [, attrs] of titles) assert.ok(attrs.includes('data-i18n="dash_'), `chart title must carry data-i18n, got <h4${attrs}>`);
  const subs = [...home.matchAll(/<p class="chart-subtitle"([^>]*)>/g)];
  assert.equal(subs.length, 69, `expected 69 chart subtitles, got ${subs.length}`);
  subs.forEach(([, attrs], i) => {
    const n = i + 1;
    if (n <= 20) {
      assert.ok(attrs.includes('data-i18n="dash_'), `business subtitle #${n} must carry data-i18n`);
    } else {
      assert.ok(!attrs.includes('data-i18n'), `engineering subtitle #${n} must NOT carry data-i18n yet (charts phase)`);
    }
  });
});

test('phase 2 wiring: no dash_ data-i18n lives inside a dialog', () => {
  const dialogs = [...indexSrc.matchAll(/<dialog[\s\S]*?<\/dialog>/g)].map((m) => m[0]);
  assert.ok(dialogs.length > 0, 'expected dialogs in index.html');
  for (const d of dialogs) {
    assert.ok(!d.includes('data-i18n="dash_'), 'a dialog must not carry a dash_ data-i18n (modals are a later phase)');
  }
});
