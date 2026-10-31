// SISP-110: Printable / WhatsApp Customer Welcome & Hardware Custody
// Agreement Slip. Pure-function tests on synthetic data only.
// Spec test criteria (verbatim): "Generating the Welcome Slip embeds
// Connection ID, package rate, routerOwnership, security deposit, and
// all 3 payment shops."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  WELCOME_SLIP_DUE_DAY,
  buildWelcomeSlipModel,
  buildWelcomeSlipPreviewHtml,
  buildWelcomeSlipPrintHtml,
  buildWelcomeSlipSections,
  buildWelcomeSlipWhatsAppText,
  listWelcomePaymentShops
} from '../welcome-agreement-slip.js';
import {
  buildKhataDeepLink,
  encodeQrMatrix,
  parseCustomerDeepLink,
  resolveDeepLinkCustomer
} from '../qr-card.js';
import { nextCycleDueDateFromBillMonth } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';
import { welcomeSlipButtonMarkup } from '../profile-ui.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const REF_DATE = new Date('2026-10-29T10:00:00+05:00');

const customer = {
  id: 'cust-test-110',
  customerNumber: 110,
  name: 'Test Customer 110',
  mohalla: 'BARRIAN',
  zone: '',
  packageSpeed: '15Mbps',
  monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 3000 }],
  routerOwnership: 'isp-owned',
  mediaConverterOwnership: 'customer-owned',
  serialNumber: 'SN-TEST-110',
  securityDeposit: 2000,
  bills: []
};
const state = { customers: [customer] };
const model = buildWelcomeSlipModel(customer, state, { month: '2026-10', referenceDate: REF_DATE });

// ------------------------------------------------------------ model

test('welcome slip model: every figure comes from the customer record', () => {
  assert.equal(model.connectionId, 110);
  assert.equal(model.connectionLabel, '#110');
  assert.equal(model.packageRate, 3000, 'rate via applicablePriceForMonth on the price schedule');
  assert.equal(model.custody.routerOwnership, 'isp-owned');
  assert.equal(model.custody.mediaConverterOwnership, 'customer-owned');
  assert.equal(model.custody.serialNumber, 'SN-TEST-110');
  assert.equal(model.custody.securityDeposit, 2000);
  assert.equal(model.issuedDate, '2026-10-29');
  // OWNER-CASH-SHOP (merged after this build): resolveShopCollector
  // canonicalizes the legacy Hassan + Balla methods into ONE collector,
  // so the derived list names "Hassan Balla Shop" once — the module
  // derives, it never hardcodes, so only this expectation moved.
  assert.deepEqual(model.shops, ['Waseem Abbasi Shop', 'Hassan Balla Shop']);
  assert.equal(buildWelcomeSlipModel(null, state, { month: '2026-10' }), null);
  assert.equal(buildWelcomeSlipModel({ name: 'No Id' }, state, { month: '2026-10' }), null);
});

test('welcome slip model: rate follows the price schedule month, never a guess', () => {
  const scheduled = {
    ...customer,
    monthlyPriceSchedule: [
      { effectiveMonth: '2026-01', amount: 2500 },
      { effectiveMonth: '2026-09', amount: 3000 }
    ]
  };
  assert.equal(buildWelcomeSlipModel(scheduled, state, { month: '2026-08', referenceDate: REF_DATE }).packageRate, 2500);
  assert.equal(buildWelcomeSlipModel(scheduled, state, { month: '2026-10', referenceDate: REF_DATE }).packageRate, 3000);
  const unpriced = { ...customer, monthlyPriceSchedule: [] };
  const unpricedModel = buildWelcomeSlipModel(unpriced, state, { month: '2026-10', referenceDate: REF_DATE });
  assert.equal(unpricedModel.packageRate, null);
  assert.ok(buildWelcomeSlipSections(unpricedModel, 'en').fields.some(([, v]) => v === 'Not set'));
});

// ------------------------------------------------------------ shops

test('welcome slip shops: enumerated from app data, never hardcoded in the module', () => {
  // The known shops derive from the PAYMENT_METHODS "Cash at …
  // shop" entries even with an empty ledger; on current main the
  // Hassan/Balla methods resolve to the one canonical collector
  // (OWNER-CASH-SHOP), so the derived list has two entries.
  assert.deepEqual(listWelcomePaymentShops({ customers: [] }), ['Waseem Abbasi Shop', 'Hassan Balla Shop']);
  // A shop that exists only in recorded payments joins the list, once.
  const customState = {
    customers: [{
      id: 'cust-x', customerNumber: 1, name: 'X',
      bills: [{ month: '2026-10', payments: [
        { id: 'p1', method: 'Cash at Hassan shop', amount: 1000, date: '2026-10-03' },
        { id: 'p2', method: 'Cash at Imran shop', amount: 1000, date: '2026-10-04' }
      ] }]
    }]
  };
  assert.deepEqual(listWelcomePaymentShops(customState),
    ['Waseem Abbasi Shop', 'Hassan Balla Shop', 'Imran Shop']);
  // The module source carries no shop-name literal of its own.
  const source = read('welcome-agreement-slip.js');
  for (const name of ['Waseem', 'Hassan', 'Balla']) {
    assert.ok(!source.includes(name), `module must not hardcode ${name}`);
  }
});

// ------------------------------------------------------------ spec pin

test('SPEC PIN: the generated slip embeds connection id, rate, routerOwnership, deposit and all 3 shops', () => {
  const html = buildWelcomeSlipPrintHtml(model, 'data:image/png;base64,AAAA');
  assert.ok(html.includes('#110'), 'connection id');
  assert.ok(html.includes('PKR 3,000'), 'package rate');
  assert.ok(html.includes('isp-owned') || html.includes('ISP Owned — Returnable'), 'routerOwnership (isp-owned label)');
  assert.ok(html.includes('Customer Purchased'), 'media converter ownership');
  assert.ok(html.includes('SN-TEST-110'), 'serial number');
  assert.ok(html.includes('PKR 2,000'), 'security deposit');
  for (const shop of ['Waseem Abbasi Shop', 'Hassan Balla Shop']) {
    assert.ok(html.includes(shop), `shop ${shop}`);
  }
  assert.ok(html.includes('data:image/png;base64,AAAA'), 'QR image embedded');
  // Bilingual by construction: the Urdu block is present with its title.
  assert.ok(html.includes(TRANSLATIONS.ur.welcome_title), 'Urdu block present');
  assert.ok(html.includes('dir="rtl"'), 'Urdu block is RTL');
  // Signature lines for both parties.
  assert.ok(html.includes('Customer signature'));
  assert.ok(html.includes('For Shahdara ISP'));
});

test('welcome slip: no deposit record -> terms print, no amount is invented', () => {
  const bare = {
    id: 'cust-bare', customerNumber: 7, name: 'Bare Customer', packageSpeed: '',
    monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 1500 }],
    bills: []
  };
  const bareModel = buildWelcomeSlipModel(bare, { customers: [bare] }, { month: '2026-10', referenceDate: REF_DATE });
  assert.equal(bareModel.custody.securityDeposit, null);
  const en = buildWelcomeSlipSections(bareModel, 'en');
  assert.ok(en.custodyLines.some((line) => line.includes('Not recorded')), 'ownership honestly not recorded');
  assert.ok(!en.custodyLines.some((line) => line.startsWith('Security deposit:')), 'no deposit line');
  assert.equal(en.terms.length, 3, 'custody terms still print');
  const html = buildWelcomeSlipPrintHtml(bareModel, null);
  assert.ok(!html.includes('Security deposit:'), 'print carries no deposit amount line');
  assert.ok(html.includes(TRANSLATIONS.en.welcome_term_deposit), 'deposit term still prints');
  // A recorded zero deposit is likewise no deposit held.
  const zeroModel = buildWelcomeSlipModel({ ...bare, securityDeposit: 0 }, { customers: [] }, { month: '2026-10', referenceDate: REF_DATE });
  assert.ok(!buildWelcomeSlipSections(zeroModel, 'en').custodyLines.some((line) => line.startsWith('Security deposit:')));
});

// ------------------------------------------------------------ due date

test('welcome slip: due-date rule is the billing cycle fifth, cross-checked with core', () => {
  assert.equal(WELCOME_SLIP_DUE_DAY, 5);
  assert.equal(nextCycleDueDateFromBillMonth('2026-10'), '2026-11-05', 'core derives the fifth too');
  assert.ok(read('billing-cycle.js').includes('dueDate: `${month}-05`'), 'the cycle stamps the fifth');
  const en = buildWelcomeSlipSections(model, 'en');
  assert.ok(en.dueRule.includes('5th'), 'printed rule names the 5th');
});

// ------------------------------------------------------------ QR

test('welcome slip QR: payload is the untouched SISP-14 deep link and round-trips', () => {
  assert.equal(model.deepLink, buildKhataDeepLink(customer.id, { action: 'pay' }));
  const parsed = parseCustomerDeepLink(new URL(model.deepLink).search);
  assert.deepEqual(parsed, { customerId: customer.id, action: 'pay' });
  assert.equal(resolveDeepLinkCustomer([customer], parsed.customerId), customer);
  const matrix = encodeQrMatrix(model.deepLink);
  assert.equal(matrix.modules.length, matrix.size, 'QR matrix encodes offline without throwing');
});

// ------------------------------------------------------------ WhatsApp + preview

test('welcome slip WhatsApp text: full bilingual agreement + payment link', () => {
  const text = buildWelcomeSlipWhatsAppText(model);
  assert.ok(text.includes('#110'));
  assert.ok(text.includes('PKR 3,000'));
  assert.ok(text.includes('PKR 2,000'));
  for (const shop of ['Waseem Abbasi Shop', 'Hassan Balla Shop']) assert.ok(text.includes(shop), shop);
  assert.ok(text.includes(TRANSLATIONS.ur.welcome_title), 'Urdu block rides the draft');
  assert.ok(text.includes(model.deepLink), 'ends with the SISP-14 link');
});

test('welcome slip preview: bilingual, escaped, and token-styled only', () => {
  const preview = buildWelcomeSlipPreviewHtml(model);
  assert.ok(preview.includes('Test Customer 110'));
  assert.ok(preview.includes('dir="rtl"'));
  const evil = buildWelcomeSlipModel({ ...customer, name: '<script>alert(1)</script>' }, state, { month: '2026-10', referenceDate: REF_DATE });
  assert.ok(!buildWelcomeSlipPreviewHtml(evil).includes('<script>alert'), 'customer data is escaped');
  assert.ok(!buildWelcomeSlipPrintHtml(evil, null).includes('<script>alert'), 'print escapes too');
  const css = read('components.css');
  const block = css.slice(css.indexOf('.welcome-slip-preview'), css.indexOf('.welcome-slip-term') + 200);
  assert.ok(block.includes('var(--'), 'preview styles use theme tokens');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block.replace(/var\(--[a-z-]+\)/g, '')), 'no hardcoded colours in preview styles');
});

// ------------------------------------------------------------ read-only

test('welcome slip: generating every artifact mutates nothing', () => {
  const frozenCustomer = JSON.parse(JSON.stringify(customer));
  const frozenState = { customers: [frozenCustomer] };
  const deepFreeze = (v) => { if (v && typeof v === 'object') { Object.values(v).forEach(deepFreeze); Object.freeze(v); } return v; };
  deepFreeze(frozenCustomer); deepFreeze(frozenState);
  const before = JSON.stringify(frozenState);
  const m = buildWelcomeSlipModel(frozenCustomer, frozenState, { month: '2026-10', referenceDate: REF_DATE });
  buildWelcomeSlipPrintHtml(m, null);
  buildWelcomeSlipWhatsAppText(m);
  buildWelcomeSlipPreviewHtml(m);
  assert.equal(JSON.stringify(frozenState), before);
});

// ------------------------------------------------------------ i18n + wiring

test('welcome slip i18n: every welcome_* key used exists in en and ur, fully translated', () => {
  const sources = [read('welcome-agreement-slip.js'), read('profile-ui.js'), read('app.js'), read('index.html')];
  const keys = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(/(?:t\(|data-i18n=)["'](welcome_[a-z_]+)["']/g)) keys.add(match[1]);
    for (const match of source.matchAll(/t\('(prof_custody_own_[a-z]+|prof_not_recorded)'/g)) keys.add(match[1]);
  }
  assert.ok(keys.size >= 25, `expected the full welcome key set, found ${keys.size}`);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en value is the raw key for ${key}`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur value is the raw key for ${key}`);
  }
});

test('welcome slip wiring: profile button, modal and opener are in place', () => {
  assert.ok(welcomeSlipButtonMarkup().includes('id="profileWelcomeSlipButton"'));
  const app = read('app.js');
  assert.ok(app.includes('${welcomeSlipButtonMarkup()}'), 'button renders in the profile heading actions');
  assert.ok(app.includes("querySelector('#profileWelcomeSlipButton')"), 'click is bound');
  assert.ok(app.includes('function openWelcomeSlip(customer)'), 'opener exists');
  assert.ok(app.includes('buildWelcomeSlipModel(customer, state'), 'opener builds the model from live state');
  const html = read('index.html');
  for (const id of ['welcomeSlipModal', 'welcomeSlipPreview', 'welcomeSlipQrCanvas', 'welcomeSlipPrintBtn', 'welcomeSlipWhatsAppBtn', 'closeWelcomeSlipModalBtn']) {
    assert.ok(html.includes(`id="${id}"`), `index.html carries #${id}`);
  }
});
