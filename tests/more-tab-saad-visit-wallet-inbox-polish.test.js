// More Tab & Wallet Inbox Polish (Nov 2026): the 22 registry &
// operations cards get single-row headers (DS-0 SVG tile + title +
// status metric), static section headers at their post-SCTI homes,
// zero-state values rendered as compact muted pills, singular/plural
// metrics, and the Wallet inbox gets a one-row toolbar, DS-0 token
// borders, compact review rows and an SVG empty state.
//
// Scope notes (read before "fixing" a failure here):
// - Saad Visit Log has exactly ONE home: the Reports "Workers & Field
//   Staff" section. It is not a Customers-tab, More-menu or profile
//   quick-action entry; the ticket "Log Saad Visit" button
//   (complaint-tickets.js) is a different surface (SISP-56) and KEEPS.
// - The zero-state pill is CLASS-only: the *_empty value TEXT is
//   unchanged (urdu-auto-phase2 pins those values byte-identical), so
//   this file pins the toggle + the class, never a new value string.
// - Group Billing moved WITHIN Reports (before the Workers header, so
//   Saad + Lineman sit together) — its SCTI home is unchanged.
// - The ~50% scrolling claim is an estimate, not a measurement: header
//   + padding alone save ~20%; the rest needs the Home-D3 follow-up's
//   collapsed accordions. Nothing here measures scroll height.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { TRANSLATIONS, t } = await import('../nav-language.js');
const { DS_ICON_NAMES } = await import('../ds-icons.js');

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appSrc = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const stylesCss = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const inboxSrc = fs.readFileSync(new URL('../payments-inbox.js', import.meta.url), 'utf8');
const inboxCss = fs.readFileSync(new URL('../payments-inbox.css', import.meta.url), 'utf8');
const ticketsSrc = fs.readFileSync(new URL('../complaint-tickets.js', import.meta.url), 'utf8');

// Pictographs (3D emoji + dingbats + variation selectors). Em-dash and
// middot are legitimate text in these cards and are excluded.
const PICTOGRAPH = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
const hasPictograph = (s) => PICTOGRAPH.test(s.replace(/[—·]/g, ''));

// The 22 ops cards, in document order.
const OPS_CARDS = [
  'summary-pending-works', 'summary-system-health',
  'summary-billing-cycle', 'summary-complaint-register',
  'summary-field-tickets', 'summary-monthly-complaint-report',
  'summary-group-billing', 'summary-saad-visits',
  'summary-lineman-scorecard', 'summary-downtime-analytics',
  'summary-upstream-sla', 'summary-fleet-uptime', 'summary-splitter-map',
  'summary-pon-capacity', 'summary-outage-impact', 'summary-daisy-chain',
  'summary-pole-landmark', 'summary-pole-registry', 'summary-power-backup',
  'summary-inventory-book', 'summary-fiber-drums',
  'summary-hardware-recovery',
];

function opsCardBlocks(source) {
  const blocks = [...source.matchAll(/<article[^>]*ops-card[^>]*>[\s\S]*?<\/article>/g)].map((m) => m[0]);
  assert.equal(blocks.length, 22, `expected 22 ops-card articles, got ${blocks.length}`);
  return blocks;
}

test('ops cards: all 22 carry the scoped class and a single-row header (tile + title span + metric)', () => {
  const blocks = opsCardBlocks(html);
  assert.deepEqual(
    blocks.map((b) => (b.match(/class="summary-card (summary-[a-z-]+)/) || [])[1]).sort(),
    [...OPS_CARDS].sort(),
    'the 22 ops cards are exactly the SCTI D2 set',
  );
  for (const block of blocks) {
    assert.ok(block.includes('class="ds-card-head"'), 'each ops card has a .ds-card-head row');
    assert.match(block, /<span class="ds-icon-tile" data-ds-icon="[A-Za-z]+" aria-hidden="true"><\/span>/, 'header tile is a DS-0 icon span');
    assert.match(block, /<span class="summary-label" data-i18n="[a-z0-9_]+">/, 'label is a span (not the old <p>) so the header stays one row');
    assert.match(block, /<strong id="dashboard[a-zA-Z]+" class="summary-value ds-card-metric">/, 'value carries .ds-card-metric');
    assert.ok(!hasPictograph(block), 'no pictograph survives inside an ops card');
  }
  // Header tiles: 22, button tiles: 29 — counted INSIDE the ops-card
  // blocks only (other surfaces use the same spans: profile actions,
  // speed dial, …). Fleet + PON have no buttons; the per-card button
  // counts are: Billing 2, Complaint 2, Field 1, Monthly 1, Saad 1,
  // Group 1, Lineman 1, Downtime 1, SLA 1, Splitter 4, Outage 3,
  // Daisy 1, PoleDir 1, PoleReg 1, Power 1, Stock 3, Drums 1,
  // Recovery 1, Pending 1, Health 1.
  const headerTiles = blocks.reduce((n, b) => n + ((b.match(/<span class="ds-icon-tile" data-ds-icon="/g) || []).length), 0);
  const buttonTiles = blocks.reduce((n, b) => n + ((b.match(/<span class="ds-icon-tile ds-icon-tile--sm" data-ds-icon="/g) || []).length), 0);
  assert.equal(headerTiles, 22);
  assert.equal(buttonTiles, 29);
  // Every icon named on an ops card exists in the DS-0 set.
  for (const block of blocks) {
    for (const [, name] of block.matchAll(/data-ds-icon="([A-Za-z]+)"/g)) {
      assert.ok(DS_ICON_NAMES.includes(name), `ops card icon ${name} must exist in ds-icons.js`);
    }
  }
});

test('section headers: one per destination, in order, Group Billing moved before Workers', () => {
  const headers = ['ops_section_billing', 'ops_section_workers', 'ops_section_network', 'ops_section_inventory'];
  for (const key of headers) {
    assert.equal((html.match(new RegExp(`data-i18n="${key}"`, 'g')) || []).length, 1, `${key} appears exactly once`);
  }
  const idx = (s) => html.indexOf(s);
  assert.ok(idx('ops_section_billing') < idx('summary-billing-cycle'));
  assert.ok(idx('summary-monthly-complaint-report') < idx('summary-group-billing'));
  assert.ok(idx('summary-group-billing') < idx('ops_section_workers'));
  assert.ok(idx('ops_section_workers') < idx('summary-saad-visits'));
  assert.ok(idx('summary-saad-visits') < idx('summary-lineman-scorecard'));
  assert.ok(idx('ops_section_network') < idx('summary-downtime-analytics'));
  assert.ok(idx('ops_section_inventory') < idx('summary-inventory-book'));
  assert.equal(t('ops_section_billing', 'en'), 'Billing Cycle & Complaints');
  assert.equal(t('ops_section_workers', 'en'), 'Workers & Field Staff');
  assert.equal(t('ops_section_network', 'en'), 'Network & PON');
  assert.equal(t('ops_section_inventory', 'en'), 'Inventory & Hardware');
  for (const key of headers) {
    assert.ok(/[؀-ۿ]/.test(t(key, 'ur')), `${key}: ur value must carry Urdu script`);
    assert.ok(!hasPictograph(t(key, 'en')) && !hasPictograph(t(key, 'ur')), `${key}: no emoji in either language`);
  }
});

test('Saad Visit Log: exactly one card, under Workers & Field Staff — nowhere else', () => {
  assert.equal((html.match(/data-i18n="dash_card_saad"/g) || []).length, 1);
  assert.equal((html.match(/data-i18n="dash_btn_saad_visits"/g) || []).length, 1);
  // No Saad entry in the More menu or the Customers tab.
  assert.ok(!/data-mobile-more="[^"]*saad[^"]*"/i.test(html));
  const customersStart = html.indexOf('id="customersView"');
  const customersEnd = html.indexOf('</section>', customersStart);
  assert.ok(!/saad/i.test(html.slice(customersStart, customersEnd)), 'no Saad entry inside #customersView');
  // The ticket workflow is a different surface and KEEPS (parent D2).
  assert.ok(ticketsSrc.includes('data-ticket-action="log-saad-visit"'));
  assert.ok(ticketsSrc.includes('Log Saad Visit from Ticket'));
});

test('card labels/buttons: the 40 scoped keys carry no emoji in either language', () => {
  const keys = [
    'dash_card_pending', 'dash_card_health', 'dash_btn_health',
    'dash_card_cycle', 'dash_btn_billing_cycle', 'dash_btn_month_end',
    'dash_card_complaint', 'prc_open_btn', 'dash_card_tickets',
    'dash_card_monthly_report', 'dash_btn_monthly_report',
    'dash_card_saad', 'dash_btn_saad_visits', 'dash_card_group',
    'dash_card_lineman', 'dash_btn_lineman', 'dash_card_downtime',
    'dash_card_upsla', 'upt_fleet_title', 'dash_card_splitter',
    'dash_btn_dark_fiber', 'jcmap_open_btn', 'obcalc_button',
    'dash_card_poncap', 'dash_card_outage', 'dash_btn_trace_outage',
    'runbook_open_btn', 'storm_btn_open', 'dash_card_daisychain',
    'dash_card_pole', 'dash_btn_cheatsheet', 'dash_card_polereg',
    'pwr_card_label', 'pwr_btn_open', 'dash_card_stock',
    'dash_card_field_bag', 'supkhata_btn_open', 'dash_drum_card',
    'dash_drum_btn', 'dash_card_recovery',
  ];
  assert.equal(keys.length, 40);
  for (const key of keys) {
    for (const lang of ['en', 'ur']) {
      assert.equal(typeof TRANSLATIONS[lang][key], 'string', `${key} must exist in ${lang}`);
      assert.ok(!hasPictograph(TRANSLATIONS[lang][key]), `${key} (${lang}) must carry no emoji, got ${JSON.stringify(TRANSLATIONS[lang][key])}`);
    }
  }
});

test('singular/plural: splitter ports + PON capacity pick the singular key', () => {
  assert.equal(t('dash_splitter_port_sing', 'en', { count: 1 }), '1 port used');
  assert.equal(t('dash_splitter_port_sing', 'ur', { count: 1 }), '1 پورٹ استعمال شدہ');
  assert.equal(t('poncap_value_1port', 'en', { ports: 1, onus: 5 }), '1 port · 5 active ONUs');
  assert.equal(t('poncap_value_1onu', 'en', { ports: 3, onus: 1 }), '3 ports · 1 active ONU');
  assert.equal(t('poncap_value_1port_1onu', 'en', { ports: 1, onus: 1 }), '1 port · 1 active ONU');
  assert.equal(t('poncap_value_1port', 'ur', { ports: 1, onus: 5 }), '1 پورٹ · 5 فعال ONUs');
  assert.equal(t('poncap_value_1onu', 'ur', { ports: 3, onus: 1 }), '3 پورٹس · 1 فعال ONU');
  assert.equal(t('poncap_value_1port_1onu', 'ur', { ports: 1, onus: 1 }), '1 پورٹ · 1 فعال ONU');
  assert.ok(appSrc.includes("overview.occupiedPorts === 1 ? 'dash_splitter_port_sing' : 'dash_splitter_ports'"));
  assert.ok(appSrc.includes("'poncap_value_1port_1onu'"));
  assert.ok(appSrc.includes("'poncap_value_1port'"));
  assert.ok(appSrc.includes("'poncap_value_1onu'"));
});

test('zero-state pills: one toggle per writer, class in styles.css, empty values untouched', () => {
  assert.equal((appSrc.match(/classList\.toggle\('ds-card-metric--empty'/g) || []).length, 22);
  assert.ok(stylesCss.includes('.ds-card-metric--empty'));
  assert.ok(stylesCss.includes('.summary-card.ops-card'));
  assert.ok(stylesCss.includes('.ds-card-head'));
  assert.ok(stylesCss.includes('.ops-section-header'));
  // The empty VALUE keys are still the ones the writers render — the pill
  // is class-only, so no value text changed here.
  const emptyKeys = [
    'dash_cycle_empty', 'dash_complaint_empty', 'dash_ticket_empty',
    'dash_downtime_empty', 'dash_upsla_empty', 'dash_splitter_empty',
    'poncap_empty', 'dash_inv_empty', 'dash_drum_empty',
    'dash_outage_empty', 'dash_daisychain_empty', 'dash_saad_empty',
    'dash_pending_empty', 'dash_pole_empty', 'dash_group_empty',
    'dash_polereg_empty', 'dash_health_empty', 'dash_lineman_empty',
    'pwr_card_none',
  ];
  for (const key of emptyKeys) {
    assert.ok(appSrc.includes(`t('${key}')`), `writer still renders ${key}`);
  }
});

test('wallet inbox: one-row toolbar, DS-0 tiles, token borders, compact rows, SVG empty state', () => {
  // Toolbar: Sync Sheet kept (text glyph ↻, not a 3D emoji), Paste gets a
  // ClipboardList tile, Settings is icon-only with an aria-label.
  assert.ok(inboxSrc.includes('Sync Sheet'));
  assert.ok(inboxSrc.includes("dsIcon('ClipboardList', 14)"));
  assert.ok(inboxSrc.includes('id="easypaisaSettingsBtn"'));
  assert.ok(inboxSrc.includes('aria-label="Configure Sheet URL & Owner Number"'));
  const btnStart = inboxSrc.indexOf('id="easypaisaSettingsBtn"');
  const btnInnerStart = inboxSrc.indexOf('>', btnStart) + 1;
  const settingsBtn = inboxSrc.slice(btnInnerStart, inboxSrc.indexOf('</button>', btnInnerStart));
  assert.ok(!settingsBtn.includes('Settings'), 'Settings button carries no visible text');
  assert.ok(!inboxSrc.includes('📥'), 'no inbox-emoji left in payments-inbox.js');
  assert.ok(inboxSrc.includes("dsIcon('Inbox', 40)"));
  // Compact rows: amount + action share one right column, both row types.
  assert.equal((inboxSrc.match(/class="wallet-review-side"/g) || []).length, 2);
  assert.ok(inboxSrc.includes('Mark verified'));
  assert.ok(inboxSrc.includes('data-wallet-toggle='));
  assert.ok(inboxSrc.includes('TID '));
  // CSS: toolbar never wraps; blue left borders are DS-0 tokens now.
  assert.ok(/\.easypaisa-top-actions\s*\{[^}]*flex-wrap:\s*nowrap/.test(inboxCss));
  assert.ok(!inboxCss.includes('--color-info-strong'), 'no info-blue token left in the inbox stylesheet');
  assert.ok(/\.easypaisa-kpi-card\.highlight-blue\s*\{[^}]*--color-slate-500/.test(inboxCss));
  assert.ok(/\.easypaisa-wallet-review\s*\{[^}]*--ds-brand/.test(inboxCss));
  assert.ok(inboxCss.includes('.wallet-review-side'));
  assert.ok(/\.easypaisa-empty-state \.empty-icon\s*\{[^}]*background:\s*var\(--color-success-bg\)/.test(inboxCss));
  assert.ok(/\.easypaisa-empty-state \.empty-icon\s*\{[^}]*border-radius:\s*50%/.test(inboxCss));
});
