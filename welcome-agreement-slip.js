// SISP-110: Printable / WhatsApp Customer Welcome & Hardware Custody
// Agreement Slip.
//
// A 1-page bilingual (English + Urdu) slip handed to a new customer: it
// records the connection identity, the package rate, the monthly
// due-date rule, the shops where the bill can be paid, the SISP-14 QR
// Khata deep link, and the SISP-19 hardware custody / security-deposit
// terms. Pure builders only — generating, printing or sharing the slip
// never writes, stamps or mutates any record.
//
// WHERE EVERY FIGURE COMES FROM (nothing is invented here):
//  * Connection ID — the customer record's customerNumber.
//  * Package rate — applicablePriceForMonth (billing-cycle.js), the
//    same price the billing cycle charges for the month; null renders
//    the house "Not set" label, never a guessed amount.
//  * Router / media-converter ownership, serial and security deposit —
//    the customer's own SISP-19 custody fields, read through
//    hardware-custody.js normalizeCustodyFields. A customer with NO
//    deposit recorded gets the custody terms with NO deposit line —
//    an amount is never fabricated.
//  * Payment shops — enumerated from the app data, never hardcoded:
//    the "Cash at … shop" entries of PAYMENT_METHODS (core.js) first,
//    then any further shop resolved from recorded payments in the
//    ledger (shop-settlement.js resolveShopCollector /
//    collectShopPayments). A device whose data names different shops
//    prints those shops.
//  * Due-date rule — the app's real billing behaviour: the SISP-2
//    cycle stamps every generated bill dueDate `${month}-05`
//    (billing-cycle.js) and core.nextCycleDueDateFromBillMonth derives
//    the following cycle's fifth the same way. WELCOME_SLIP_DUE_DAY
//    mirrors that one rule for the printed policy line.
//  * QR payload — the exact SISP-14 deep link (qr-card.js
//    buildKhataDeepLink, ?customer=<id>&action=pay), unchanged; the
//    shipped parser resolves it back to this customer.

import { PAYMENT_METHODS, formatPKR } from './core.js';
import { applicablePriceForMonth } from './billing-cycle.js';
import { normalizeCustodyFields } from './hardware-custody.js';
import { collectShopPayments, pakistanToday, resolveShopCollector } from './shop-settlement.js';
import { buildKhataDeepLink, KHATA_ISP_NAME } from './qr-card.js';
import { t } from './nav-language.js';

// Mirrors the billing cycle's `${month}-05` due-date stamp — see header.
export const WELCOME_SLIP_DUE_DAY = 5;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * The payment shops this device actually knows, in a stable order:
 * shops behind the app's "Cash at … shop" payment methods first (the
 * methods are the app's own configuration), then any additional shop
 * that appears in recorded payments. Display names come from
 * shop-settlement.js resolveShopCollector ("Cash at <Name> shop" ->
 * "<Name> Shop"), the same derivation the settlement screens use.
 */
export function listWelcomePaymentShops(state) {
  const shops = [];
  const push = (name) => {
    const clean = String(name ?? '').trim();
    if (clean && !shops.includes(clean)) shops.push(clean);
  };
  for (const method of PAYMENT_METHODS) push(resolveShopCollector(method));
  for (const payment of collectShopPayments(state)) push(payment.shop);
  return shops;
}

/**
 * The slip model for ONE customer. month is the YYYY-MM the package
 * rate is priced at (the caller passes the current month); referenceDate
 * stamps the issue date. Returns null for a record without an id —
 * never a slip for nobody.
 */
export function buildWelcomeSlipModel(customer, state, { month = '', baseUrl, referenceDate = new Date() } = {}) {
  if (!customer || typeof customer !== 'object') return null;
  const id = String(customer.id ?? '').trim();
  if (!id) return null;
  const custody = normalizeCustodyFields(customer);
  const rate = applicablePriceForMonth(customer, month);
  return {
    ispName: KHATA_ISP_NAME,
    customerName: String(customer.name ?? '').trim() || 'Unnamed customer',
    customerId: id,
    connectionId: Number.isSafeInteger(customer.customerNumber) ? customer.customerNumber : null,
    connectionLabel: Number.isSafeInteger(customer.customerNumber) ? `#${customer.customerNumber}` : id,
    packageSpeed: String(customer.packageSpeed ?? '').trim(),
    packageRate: Number.isFinite(rate) ? rate : null,
    areaZone: [String(customer.mohalla ?? '').trim(), String(customer.zone ?? '').trim()]
      .filter(Boolean).join(' · '),
    dueDay: WELCOME_SLIP_DUE_DAY,
    shops: listWelcomePaymentShops(state),
    custody: {
      routerOwnership: custody.routerOwnership,
      mediaConverterOwnership: custody.mediaConverterOwnership,
      serialNumber: custody.serialNumber,
      securityDeposit: custody.securityDeposit
    },
    issuedDate: pakistanToday(referenceDate),
    deepLink: buildKhataDeepLink(id, { baseUrl, action: 'pay' })
  };
}

function ownershipText(value, lang) {
  if (value === 'isp-owned') return t('prof_custody_own_isp', lang);
  if (value === 'customer-owned') return t('prof_custody_own_customer', lang);
  return t('prof_not_recorded', lang);
}

/**
 * The slip's fixed wording for one language, resolved from the model.
 * Every fixed string goes through t() with an explicit language, so the
 * printed slip is bilingual by construction (English block + Urdu
 * block); customer data (name, amounts, shop names) stays verbatim.
 */
export function buildWelcomeSlipSections(model, lang) {
  const m = model || {};
  const custody = m.custody || {};
  const fields = [
    [t('welcome_label_customer', lang), m.customerName || ''],
    [t('welcome_label_connection', lang), m.connectionLabel || '']
  ];
  if (m.areaZone) fields.push([t('welcome_label_area', lang), m.areaZone]);
  if (m.packageSpeed) fields.push([t('welcome_label_package', lang), m.packageSpeed]);
  fields.push([t('welcome_label_rate', lang), m.packageRate === null || m.packageRate === undefined
    ? t('welcome_rate_not_set', lang)
    : t('welcome_rate_value', lang, { amount: formatPKR(m.packageRate) })]);
  const custodyLines = [
    t('welcome_router_line', lang, { label: ownershipText(custody.routerOwnership, lang) }),
    t('welcome_media_line', lang, { label: ownershipText(custody.mediaConverterOwnership, lang) })
  ];
  if (custody.serialNumber) custodyLines.push(t('welcome_serial_line', lang, { value: custody.serialNumber }));
  // The deposit line exists ONLY when a deposit is actually recorded —
  // the terms below print either way, an amount never does.
  if (custody.securityDeposit !== null && custody.securityDeposit !== undefined && custody.securityDeposit > 0) {
    custodyLines.push(`${t('welcome_label_deposit', lang)}: ${formatPKR(custody.securityDeposit)}`);
  }
  return {
    lang,
    title: t('welcome_title', lang),
    greeting: t('welcome_greeting', lang),
    fields,
    dueRule: t('welcome_due_rule', lang, { day: m.dueDay ?? WELCOME_SLIP_DUE_DAY }),
    shopsHeading: t('welcome_shops_heading', lang),
    shops: Array.isArray(m.shops) ? m.shops : [],
    custodyHeading: t('welcome_custody_heading', lang),
    custodyLines,
    terms: [
      t('welcome_term_property', lang),
      t('welcome_term_damage', lang),
      t('welcome_term_deposit', lang)
    ],
    scanNote: t('welcome_scan_note', lang),
    dateLine: t('welcome_date_line', lang, { date: m.issuedDate || '' }),
    signCustomer: t('welcome_sign_customer', lang),
    signIsp: t('welcome_sign_isp', lang)
  };
}

function sectionTextLines(section) {
  const lines = [
    section.title,
    section.greeting,
    ...section.fields.map(([label, value]) => `${label}: ${value}`),
    section.dueRule,
    `${section.shopsHeading} ${section.shops.join(' · ')}`,
    section.custodyHeading,
    ...section.custodyLines,
    ...section.terms
  ];
  return lines;
}

/**
 * The WhatsApp draft text: the full agreement wording in both
 * languages (the same content as the printed slip), ending with the
 * SISP-14 payment link. The caller wraps it in a wa.me URL — this
 * builder never sends anything.
 */
export function buildWelcomeSlipWhatsAppText(model) {
  const m = model || {};
  const en = buildWelcomeSlipSections(m, 'en');
  const ur = buildWelcomeSlipSections(m, 'ur');
  const lines = [
    `🧾 ${m.ispName || KHATA_ISP_NAME} — ${en.title}`,
    '',
    ...sectionTextLines(en),
    '',
    '━━━━━━━━━━━━━━',
    '',
    ...sectionTextLines(ur),
    '',
    en.scanNote
  ];
  if (m.deepLink) lines.push(`🔗 ${m.deepLink}`);
  return lines.join('\n');
}

function sectionPreviewHtml(section, extraClass = '') {
  const fields = section.fields
    .map(([label, value]) => `<p class="welcome-slip-line"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
    .join('');
  const custody = section.custodyLines.map((line) => `<p class="welcome-slip-line">${escapeHtml(line)}</p>`).join('');
  const terms = section.terms.map((line) => `<p class="welcome-slip-term">${escapeHtml(line)}</p>`).join('');
  return `<div class="welcome-slip-section ${extraClass}"${section.lang === 'ur' ? ' dir="rtl" lang="ur"' : ''}>
<h4>${escapeHtml(section.title)}</h4>
<p class="welcome-slip-greeting">${escapeHtml(section.greeting)}</p>
${fields}
<p class="welcome-slip-line">${escapeHtml(section.dueRule)}</p>
<p class="welcome-slip-line">${escapeHtml(section.shopsHeading)} <strong>${escapeHtml(section.shops.join(' · '))}</strong></p>
<h5>${escapeHtml(section.custodyHeading)}</h5>
${custody}
${terms}
</div>`;
}

/**
 * On-screen preview markup for the profile modal. Styling lives in
 * components.css (.welcome-slip-*) and uses theme tokens only — the
 * black-on-white paper look belongs to the print document alone.
 */
export function buildWelcomeSlipPreviewHtml(model) {
  const m = model || {};
  const en = buildWelcomeSlipSections(m, 'en');
  const ur = buildWelcomeSlipSections(m, 'ur');
  return `${sectionPreviewHtml(en)}${sectionPreviewHtml(ur, 'welcome-slip-section-ur')}`;
}

/**
 * Standalone printable document: one A4 page, black on white (house
 * print convention), English block then Urdu block, the SISP-14 QR
 * (rendered by the caller to a data URL, exactly like the QR Khata
 * card) and signature lines. Read-only: printing changes nothing.
 */
export function buildWelcomeSlipPrintHtml(model, qrDataUrl) {
  const m = model || {};
  const en = buildWelcomeSlipSections(m, 'en');
  const ur = buildWelcomeSlipSections(m, 'ur');
  const block = (section, rtl) => `
<section class="slip-block"${rtl ? ' dir="rtl" lang="ur"' : ''}>
<h2>${escapeHtml(section.title)}</h2>
<p class="greeting">${escapeHtml(section.greeting)}</p>
${section.fields.map(([label, value]) => `<p class="line"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join('\n')}
<p class="line">${escapeHtml(section.dueRule)}</p>
<p class="line">${escapeHtml(section.shopsHeading)} <strong>${escapeHtml(section.shops.join(' · '))}</strong></p>
<h3>${escapeHtml(section.custodyHeading)}</h3>
${section.custodyLines.map((line) => `<p class="line">${escapeHtml(line)}</p>`).join('\n')}
${section.terms.map((line) => `<p class="term">${escapeHtml(line)}</p>`).join('\n')}
</section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(en.title)} — ${escapeHtml(m.customerName || '')}</title>
<style>@page{size:A4;margin:12mm}body{font-family:system-ui,sans-serif;color:#111;margin:0;font-size:12px;line-height:1.45}h1{font-size:19px;text-align:center;margin:0 0 2px}.date{text-align:center;color:#444;margin:0 0 8px}.slip-block{border-top:2px solid #111;padding-top:8px;margin-top:10px}.slip-block h2{font-size:15px;margin:0 0 4px}.slip-block h3{font-size:13px;margin:8px 0 2px}.greeting{margin:2px 0 6px}.line{margin:2px 0}.term{margin:2px 0;color:#222}.qr{text-align:center;margin:12px 0 4px}.qr img{width:34mm;height:34mm}.qr p{font-size:10px;color:#444;margin:3px 0}.link{font-size:9px;word-break:break-all;color:#444;text-align:center;margin:2px 0}.signs{display:flex;justify-content:space-between;gap:24px;margin-top:26px}.sign{flex:1;border-top:1px solid #111;padding-top:4px;font-size:11px}.sign .ur{display:block;color:#444}</style></head><body>
<h1>${escapeHtml(m.ispName || KHATA_ISP_NAME)}</h1>
<p class="date">${escapeHtml(en.dateLine)} · ${escapeHtml(ur.dateLine)}</p>
${block(en, false)}
${block(ur, true)}
<div class="qr">${qrDataUrl ? `<img src="${escapeHtml(qrDataUrl)}" alt="QR code for shop counter lookup">` : `<p>${escapeHtml(en.scanNote)}</p>`}
<p>${escapeHtml(en.scanNote)}</p><p>${escapeHtml(ur.scanNote)}</p></div>
${m.deepLink ? `<p class="link">${escapeHtml(m.deepLink)}</p>` : ''}
<div class="signs"><div class="sign">${escapeHtml(en.signCustomer)}<span class="ur">${escapeHtml(ur.signCustomer)}</span></div><div class="sign">${escapeHtml(en.signIsp)}<span class="ur">${escapeHtml(ur.signIsp)}</span></div></div>
</body></html>`;
}
