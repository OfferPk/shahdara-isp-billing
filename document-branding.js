// Plan Q — Document branding: one header/footer system for every
// customer-facing document.
//
// Before this module, each document generator hardcoded its own header:
// the payment receipt alone had three different titles (thermal-58's
// Urdu-only "انٹرنیٹ ادائیگی رسید (58mm)", thermal-80's "Payment
// Receipt / رسید ادائیگی", A4's "Payment Receipt / رسید بل ادائیگی"),
// two different phone labels ("Tel:" vs "Phone:"), and three different
// receipt-number labels ("No:", "Receipt #:", "Permanent Receipt:").
// The footer was already unified for receipts by SISP-96
// (receipt-footer-studio.js); this module is the header counterpart and
// the single place that also assembles a document footer (thank-you
// line + studio footer block) for documents that previously had no
// studio footer at all (the printed statement, the clearance NOC).
//
// PRESENTATION ONLY. Nothing here touches money, totals, balances, or
// Plan K's VOID rule: it only formats brand identity (business name,
// phone, area), bilingual document titles, and footer lines. Every
// generator that uses it keeps its own body, figures, and layout;
// only the header block and the footer block come from here.
//
// Deliberate non-unifications (documented, not oversights):
// - Standalone documents with their own house print CSS (the
//   letterhead, the voucher book, the lineman payout slip, the expense
//   voucher) keep their own markup and their typographic
//   "SHAHDARA FIBER NET" brand — that brand is the letterhead's
//   registered-style name, not a second spelling of "Shahdara ISP".
//   They are out of scope for the HTML header builder; the payout slip
//   reuses brandMetaLine() for its meta line (same data, own markup).
// - A document's number label stays document-specific ("Permanent
//   Receipt:" on A4, "Clearance Receipt:" on a settlement) because it
//   says what the number IS; only the brand, title, and meta line are
//   canonicalised.
// - The A4 header keeps its "Official Customer Record ·" qualifier via
//   the metaPrefix option — it is part of that document's meaning,
//   not a branding inconsistency.

import { buildReceiptFooterHtml } from './receipt-footer-studio.js';

/** The house brand defaults — the same values receipt.js always used. */
export const BRAND_DEFAULTS = Object.freeze({
  businessName: 'Shahdara ISP',
  businessPhone: '0300-1234567',
  areaName: 'Shahdara, Islamabad'
});

/**
 * The canonical bilingual title of each receipt-family document, taken
 * verbatim from the generator that already used the bilingual form
 * (thermal-80's payment title; the kist / settlement / offset titles
 * as printed). A4's "رسید بل ادائیگی" and thermal-58's width-suffixed
 * Urdu-only title are normalised to the payment-receipt entry — same
 * document, same title, on every width.
 */
export const DOCUMENT_TITLES = Object.freeze({
  'payment-receipt': Object.freeze({ en: 'Payment Receipt', ur: 'رسید ادائیگی' }),
  'down-payment-kist': Object.freeze({ en: 'Down Payment Receipt', ur: 'پیشگی ادائیگی رسید' }),
  'deposit-settlement': Object.freeze({ en: 'Final Disconnection Clearance Receipt', ur: 'حتمی منقطعی کلیئرنس رسید' }),
  'deposit-offset': Object.freeze({ en: 'Security Deposit Offset Receipt', ur: 'سیکیورٹی ڈپازٹ تصفیہ رسید' })
});

const cleanText = (value, fallback) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitises a brand identity object. Blank, whitespace-only, or
 * non-string fields fall back to BRAND_DEFAULTS, so a half-configured
 * identity can never print a blank business name or phone. Pure.
 * @param {Object} [input]
 * @returns {{businessName: string, businessPhone: string, areaName: string}}
 */
export function sanitizeBrand(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    businessName: cleanText(source.businessName, BRAND_DEFAULTS.businessName),
    businessPhone: cleanText(source.businessPhone, BRAND_DEFAULTS.businessPhone),
    areaName: cleanText(source.areaName, BRAND_DEFAULTS.areaName)
  };
}

/**
 * The canonical meta line every receipt-family header prints:
 * "Shahdara, Islamabad · Tel: 0300-1234567". The "Tel:" label is the
 * canonical one (thermal-58 already used it); "Phone:" is retired.
 * @param {Object} brandInput - raw brand identity, sanitised here
 * @returns {string}
 */
export function brandMetaLine(brandInput = {}) {
  const brand = sanitizeBrand(brandInput);
  return `${brand.areaName} · Tel: ${brand.businessPhone}`;
}

/**
 * Resolves a document title: explicit titleEn/titleUr win, otherwise
 * the DOCUMENT_TITLES entry for `document`, otherwise empty sides.
 * @param {Object} [options]
 * @returns {{en: string, ur: string}}
 */
export function resolveDocumentTitle(options = {}) {
  const fromMap = DOCUMENT_TITLES[options.document] || null;
  return {
    en: cleanText(options.titleEn, fromMap ? fromMap.en : ''),
    ur: cleanText(options.titleUr, fromMap ? fromMap.ur : '')
  };
}

/**
 * Renders a bilingual title as "English / اردو", or the single side
 * when the other is empty, or '' when both are empty. Pure.
 * @param {{en: string, ur: string}} title
 * @returns {string}
 */
export function brandTitleLine(title = {}) {
  const en = typeof title.en === 'string' ? title.en.trim() : '';
  const ur = typeof title.ur === 'string' ? title.ur.trim() : '';
  if (en && ur) return `${en} / ${ur}`;
  return en || ur;
}

/**
 * The header content of a receipt-family document, without the
 * <header> wrapper (A4 headers carry a status-mark sibling inside the
 * header, so they use this plus their own wrapper; thermal headers
 * use brandHeaderHtml). Two variants, one data source:
 * - 'thermal': compact div lines (58mm/80mm print CSS sizes them).
 * - 'a4': the A4 structure (brand span, h1 title, meta paragraph,
 *   number badge) for full-width sheets.
 * The number line is omitted when documentNumber is empty.
 * @param {Object} brandInput - raw brand identity
 * @param {Object} [options]
 * @param {string} [options.document] - DOCUMENT_TITLES key
 * @param {string} [options.titleEn] - explicit title override (EN)
 * @param {string} [options.titleUr] - explicit title override (UR)
 * @param {string} [options.documentNumber]
 * @param {string} [options.documentNumberLabel] - e.g. 'Receipt #:'
 * @param {string} [options.documentNumberSuffix] - e.g. ' · Ref: OFF-1'
 * @param {string} [options.metaPrefix] - e.g. 'Official Customer Record'
 * @param {string} [options.variant='thermal'] - 'thermal' | 'a4'
 * @returns {string}
 */
export function brandHeaderContentHtml(brandInput = {}, options = {}) {
  const brand = sanitizeBrand(brandInput);
  const title = brandTitleLine(resolveDocumentTitle(options));
  const meta = options.metaPrefix
    ? `${String(options.metaPrefix).trim()} · ${brandMetaLine(brand)}`
    : brandMetaLine(brand);
  const number = typeof options.documentNumber === 'string' ? options.documentNumber.trim() : '';
  const numberLabel = typeof options.documentNumberLabel === 'string' ? options.documentNumberLabel.trim() : '';
  const numberSuffix = typeof options.documentNumberSuffix === 'string' ? options.documentNumberSuffix : '';
  const numberLine = number
    ? { thermal: `<div class="receipt-num">${escapeHtml(numberLabel)} <strong>${escapeHtml(number)}</strong>${escapeHtml(numberSuffix)}</div>`,
        a4: `<div class="receipt-num-badge">${escapeHtml(numberLabel)} <strong>${escapeHtml(number)}</strong>${escapeHtml(numberSuffix)}</div>` }[options.variant === 'a4' ? 'a4' : 'thermal']
    : '';
  if (options.variant === 'a4') {
    return `<div>
      <span class="receipt-brand">${escapeHtml(brand.businessName)}</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(meta)}</p>
      ${numberLine}
    </div>`;
  }
  return `<div class="receipt-brand">${escapeHtml(brand.businessName)}</div>
    <div class="receipt-subbrand">${escapeHtml(title)}</div>
    <div class="receipt-meta-line">${escapeHtml(meta)}</div>
    ${numberLine}`;
}

/**
 * The full header block for a receipt-family document (thermal
 * layouts and any other layout without a header sibling).
 * @param {Object} brandInput
 * @param {Object} [options] - same as brandHeaderContentHtml
 * @returns {string}
 */
export function brandHeaderHtml(brandInput = {}, options = {}) {
  return `<header class="receipt-head">
    ${brandHeaderContentHtml(brandInput, options)}
  </header>`;
}

/**
 * The footer content of a document: the caller's thank-you line (when
 * given — each layout keeps its own wording) followed by the single
 * SISP-96 studio footer block. '' when neither exists, so a document
 * with no configured footer and no thank-you line renders exactly
 * what it rendered before. The caller keeps its own <footer> wrapper.
 * @param {Object} footer - raw or sanitised receipt footer settings
 * @param {Object} [options]
 * @param {string} [options.thankYou]
 * @returns {string}
 */
export function documentFooterHtml(footer, options = {}) {
  const studio = buildReceiptFooterHtml(footer);
  const thankYou = typeof options.thankYou === 'string' ? options.thankYou.trim() : '';
  const thankYouLine = thankYou ? `<p class="receipt-footer-text">${escapeHtml(thankYou)}</p>` : '';
  if (!thankYouLine && !studio) return '';
  return `${thankYouLine}${studio ? `\n    ${studio}` : ''}`;
}
