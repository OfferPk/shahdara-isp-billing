/**
 * receipt-footer-studio.test.js — SISP-96: Customizable Receipt Footer,
 * Shop List & Helpline Studio (sisp_receipt_footer_v1).
 *
 * Spec test criterion (verbatim): "Updating the custom footer in
 * sisp_receipt_footer_v1 immediately appears on all generated receipt
 * formats."
 *
 * Pins:
 * - sanitize/storage: empty factory defaults, bounds, unknown fields
 *   dropped, corrupt storage falls back to defaults, save/load round-trip.
 * - ONE builder: buildReceiptFooterLines order + verbatim owner text.
 * - Every format renders the SAME footer: HTML (a4 / thermal-80 /
 *   thermal-58), ESC/POS Bluetooth slip, PNG slip model+layout, the
 *   profile WhatsApp draft and the Quick Collect WhatsApp draft.
 * - Unconfigured = byte-identical: with no footer (or an all-empty one)
 *   every generator output equals the pre-studio output.
 * - Money integrity: a configured footer never changes receipt numbers
 *   or amounts on any format.
 * - Backup: settings.receiptFooter travels in JSON backups; restore
 *   adopts only on a fresh/default device and conflicts (never silently
 *   overwrites) when both sides hold different real footers.
 * - i18n: every rcptfoot_* key used in app.js / index.html / the studio
 *   module exists in BOTH the en and ur dictionaries.
 * Synthetic data only — the numbers below are fixtures, not real ones.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RECEIPT_FOOTER_STORAGE_KEY,
  getDefaultReceiptFooter,
  sanitizeReceiptFooter,
  isReceiptFooterConfigured,
  getReceiptFooter,
  saveReceiptFooter,
  buildReceiptFooterLines,
  buildReceiptFooterText,
  buildReceiptFooterHtml
} from '../receipt-footer-studio.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildEscPosReceipt, escPosFieldsFromPaymentReceipt } from '../thermal-printer.js';
import { PNG_RECEIPT_HEIGHT, buildPngReceiptModel, computePngReceiptLayout } from '../png-receipt.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';
import { formatQuickCollectWhatsAppReceipt } from '../nav-quick-collect.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const FOOTER = {
  footerText: 'شکریہ! بل ہر مہینے کی 5 تاریخ تک ادا کریں۔\nDuaon mai yaad rakhain.',
  easypaisaNumber: '03450001122',
  nayapayNumber: '03450003344',
  helplineWhatsapp: '03001112233',
  shopsText: 'Synthetic Shop A — Main Bazaar\nSynthetic Shop B — Station Road'
};
const EXPECTED_LINES = [
  'شکریہ! بل ہر مہینے کی 5 تاریخ تک ادا کریں۔',
  'Duaon mai yaad rakhain.',
  'EasyPaisa: 03450001122',
  'NayaPay: 03450003344',
  'Helpline (WhatsApp): 03001112233',
  'Synthetic Shop A — Main Bazaar',
  'Synthetic Shop B — Station Road'
];

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    map
  };
}

function receiptFixture() {
  const payment = { id: 'pay-1', amount: 2000, date: '2026-10-05', method: 'Cash' };
  const bill = { id: 'bill-2026-10', month: '2026-10', dueAmount: 2000, status: 'pending', payments: [payment] };
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer',
    packageSpeed: '5 Mbps', packageHistory: [], bills: [bill]
  };
  return { customer, bill, payment, receipt: buildPaymentReceipt(customer, bill, payment) };
}

// ---------------------------------------------------------------- sanitize

test('sanitize: factory default is all-empty and the studio ships unconfigured', () => {
  assert.deepEqual(getDefaultReceiptFooter(), {
    footerText: '', easypaisaNumber: '', nayapayNumber: '', helplineWhatsapp: '', shopsText: ''
  });
  assert.equal(isReceiptFooterConfigured(getDefaultReceiptFooter()), false);
  assert.equal(isReceiptFooterConfigured(null), false);
  assert.equal(isReceiptFooterConfigured(FOOTER), true);
  assert.deepEqual(sanitizeReceiptFooter(null), getDefaultReceiptFooter());
  assert.deepEqual(sanitizeReceiptFooter('junk'), getDefaultReceiptFooter());
  assert.deepEqual(sanitizeReceiptFooter([1, 2]), getDefaultReceiptFooter());
});

test('sanitize: trims, drops unknown fields, drops blank lines, bounds lengths', () => {
  const cleaned = sanitizeReceiptFooter({
    footerText: '  Pehli line  \n\n\nDusri line\n',
    easypaisaNumber: '  03450001122 ',
    junk: 'drop me',
    helplineWhatsapp: '0'.repeat(60)
  });
  assert.equal(cleaned.footerText, 'Pehli line\nDusri line');
  assert.equal(cleaned.easypaisaNumber, '03450001122');
  assert.equal(cleaned.junk, undefined);
  assert.equal(cleaned.helplineWhatsapp.length, 24, 'helpline bounded to 24 chars');
  const manyLines = sanitizeReceiptFooter({ footerText: Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n') });
  assert.equal(manyLines.footerText.split('\n').length, 8, 'footer text bounded to 8 lines');
});

// ---------------------------------------------------------------- storage

test('storage: save/load round-trip under sisp_receipt_footer_v1; corrupt data falls back to defaults', () => {
  const storage = fakeStorage();
  assert.deepEqual(getReceiptFooter(storage), getDefaultReceiptFooter());
  const saved = saveReceiptFooter(FOOTER, storage);
  assert.deepEqual(saved, sanitizeReceiptFooter(FOOTER));
  assert.ok(storage.map.has(RECEIPT_FOOTER_STORAGE_KEY), 'stored under the spec key');
  assert.equal(RECEIPT_FOOTER_STORAGE_KEY, 'sisp_receipt_footer_v1');
  assert.deepEqual(getReceiptFooter(storage), saved);
  storage.map.set(RECEIPT_FOOTER_STORAGE_KEY, '{not json');
  assert.deepEqual(getReceiptFooter(storage), getDefaultReceiptFooter(), 'corrupt JSON -> defaults');
  assert.deepEqual(getReceiptFooter(null), getDefaultReceiptFooter(), 'no storage -> defaults');
});

// ---------------------------------------------------------------- builders

test('builder: lines come in one fixed order, owner text verbatim, set fields only', () => {
  assert.deepEqual(buildReceiptFooterLines(FOOTER), EXPECTED_LINES);
  assert.deepEqual(buildReceiptFooterLines(getDefaultReceiptFooter()), []);
  assert.deepEqual(buildReceiptFooterLines({ easypaisaNumber: '03450001122' }), ['EasyPaisa: 03450001122']);
  assert.equal(buildReceiptFooterText(FOOTER), EXPECTED_LINES.join('\n'));
  assert.equal(buildReceiptFooterText(null), '');
});

test('builder: HTML block escapes owner text; empty when unconfigured', () => {
  assert.equal(buildReceiptFooterHtml(getDefaultReceiptFooter()), '');
  assert.equal(buildReceiptFooterHtml(null), '');
  const html = buildReceiptFooterHtml({ footerText: '<script>alert(1)</script>' });
  assert.ok(html.includes('&lt;script&gt;'), 'owner text is escaped');
  assert.ok(!html.includes('<script>'), 'no raw markup from owner text');
  const full = buildReceiptFooterHtml(FOOTER);
  for (const line of EXPECTED_LINES) assert.ok(full.includes(line), `HTML block carries: ${line}`);
});

// ---------------------------------------------------------------- HTML slips

test('HTML receipts (a4 / thermal-80 / thermal-58): the same configured footer appears on all three', () => {
  const { receipt } = receiptFixture();
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format, receiptFooter: FOOTER });
    assert.ok(html.includes('receipt-custom-footer'), `${format}: footer block present`);
    for (const line of EXPECTED_LINES) assert.ok(html.includes(line), `${format}: carries "${line}"`);
  }
});

test('HTML receipts: unconfigured footer is byte-identical to no footer option at all', () => {
  const { receipt } = receiptFixture();
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const plain = generatePaymentReceiptHtml(receipt, { format });
    const emptyOpt = generatePaymentReceiptHtml(receipt, { format, receiptFooter: getDefaultReceiptFooter() });
    const nullOpt = generatePaymentReceiptHtml(receipt, { format, receiptFooter: null });
    assert.equal(emptyOpt, plain, `${format}: empty footer option changes nothing`);
    assert.equal(nullOpt, plain, `${format}: null footer changes nothing`);
    assert.ok(!plain.includes('receipt-custom-footer'), `${format}: no footer block by default`);
  }
});

test('HTML receipts: a configured footer never changes the receipt number or amounts', () => {
  const { receipt } = receiptFixture();
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const plain = generatePaymentReceiptHtml(receipt, { format });
    const withFooter = generatePaymentReceiptHtml(receipt, { format, receiptFooter: FOOTER });
    assert.ok(withFooter.includes(receipt.receiptNumber), `${format}: receipt number intact`);
    assert.ok(withFooter.includes('PKR 2,000'), `${format}: paid amount intact`);
    // Removing the footer block from the configured output restores the
    // unconfigured output exactly — the footer is purely additive.
    const blockStart = withFooter.indexOf('\n    <div class="receipt-custom-footer">');
    assert.ok(blockStart > 0, `${format}: footer block locatable`);
    const blockEnd = withFooter.indexOf('</div>', blockStart) + '</div>'.length;
    assert.equal(withFooter.slice(0, blockStart) + withFooter.slice(blockEnd), plain, `${format}: footer is additive only`);
  }
});

// ---------------------------------------------------------------- ESC/POS

test('ESC/POS slip: configured footer lines print under the standard note; default slip byte-identical', () => {
  const { receipt } = receiptFixture();
  const configured = buildEscPosReceipt(escPosFieldsFromPaymentReceipt(receipt, { receiptFooter: FOOTER }));
  for (const line of ['EasyPaisa: 03450001122', 'NayaPay: 03450003344', 'Helpline (WhatsApp): 03001112233', 'Synthetic Shop A']) {
    assert.ok(configured.text.includes(line), `slip carries "${line}"`);
  }
  const plain = buildEscPosReceipt(escPosFieldsFromPaymentReceipt(receipt));
  const emptyOpt = buildEscPosReceipt(escPosFieldsFromPaymentReceipt(receipt, { receiptFooter: getDefaultReceiptFooter() }));
  assert.deepEqual(emptyOpt.bytes, plain.bytes, 'empty footer option -> identical bytes');
  assert.equal(emptyOpt.text, plain.text);
  // The standard note wraps at the 32-char slip width, so it never
  // appears as one contiguous string — check its wrapped fragments.
  assert.ok(plain.text.includes('Thank you! Please keep this'), 'standard note intact (wrapped line 1)');
  assert.ok(plain.text.includes('receipt.'), 'standard note intact (wrapped line 2)');
  assert.ok(!plain.text.includes('EasyPaisa'), 'no footer lines by default');
});

// ---------------------------------------------------------------- PNG slip

test('PNG slip: model carries the footer lines and the layout draws them inside the grown canvas', () => {
  const { customer, receipt } = receiptFixture();
  const model = buildPngReceiptModel(receipt, customer, { receiptFooter: FOOTER });
  assert.deepEqual(model.footerLines, EXPECTED_LINES);
  assert.ok(model.height > PNG_RECEIPT_HEIGHT, 'canvas grows for the footer');
  const layout = computePngReceiptLayout(model);
  assert.equal(layout.height, model.height);
  assert.ok(layout.footerY <= layout.height, `footerY ${layout.footerY} inside the grown canvas`);
  const texts = layout.commands.filter((cmd) => cmd.type === 'text').map((cmd) => cmd.text);
  for (const line of EXPECTED_LINES) assert.ok(texts.some((value) => value.includes(line)), `layout draws "${line}"`);
  for (const cmd of layout.commands) {
    if (cmd.type === 'text') assert.ok(cmd.y <= layout.height, 'every text command inside the canvas');
  }
});

test('PNG slip: unconfigured model is the standard 1600x2000 with no footer lines', () => {
  const { customer, receipt } = receiptFixture();
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(model.height, PNG_RECEIPT_HEIGHT);
  assert.deepEqual(model.footerLines, []);
  const layout = computePngReceiptLayout(model);
  assert.ok(layout.footerY <= PNG_RECEIPT_HEIGHT);
});

// ---------------------------------------------------------------- WhatsApp

test('profile WhatsApp draft: footer text closes the draft verbatim; absent by default', () => {
  const args = {
    customerName: 'Synthetic Customer', customerNumber: 42, amount: 2000,
    date: '2026-10-05', month: '2026-10', method: 'Cash',
    billStatus: 'paid', billAmount: 2000, balanceDueCents: 0
  };
  const footerText = buildReceiptFooterText(FOOTER);
  const withFooter = createReceiptWhatsAppDraft('+92 300 123 4567', { ...args, receiptFooterText: footerText });
  assert.ok(withFooter, 'draft builds');
  assert.ok(withFooter.message.endsWith(footerText), 'draft ends with the exact footer block');
  const plain = createReceiptWhatsAppDraft('+92 300 123 4567', args);
  assert.ok(!plain.message.includes('EasyPaisa'), 'no footer by default');
  const emptyOpt = createReceiptWhatsAppDraft('+92 300 123 4567', { ...args, receiptFooterText: '' });
  assert.equal(emptyOpt.message, plain.message, 'empty footer text -> identical draft');
});

test('Quick Collect WhatsApp draft: footer read from sisp_receipt_footer_v1 storage; clean when unset', () => {
  const qcReceipt = {
    receiptNumber: 'REC-1', date: '2026-10-05', customerName: 'Synthetic Customer',
    customerNumber: 42, phone: '03009998877', area: 'Barrian', month: '2026-10',
    amount: 2000, method: 'Cash', payableRemaining: 0
  };
  const storage = fakeStorage({ [RECEIPT_FOOTER_STORAGE_KEY]: JSON.stringify(FOOTER) });
  globalThis.localStorage = storage;
  try {
    const withFooter = formatQuickCollectWhatsAppReceipt(qcReceipt);
    for (const line of EXPECTED_LINES) assert.ok(withFooter.text.includes(line), `QC draft carries "${line}"`);
  } finally {
    delete globalThis.localStorage;
  }
  const plain = formatQuickCollectWhatsAppReceipt(qcReceipt);
  assert.ok(!plain.text.includes('EasyPaisa'), 'no footer when storage is unset');
});

// ------------------------------------------------------- spec criterion

test('spec criterion: updating the stored footer immediately changes every generated format', () => {
  const { customer, receipt } = receiptFixture();
  const storage = fakeStorage();
  saveReceiptFooter({ footerText: 'Pehla footer version.' }, storage);
  const v1 = getReceiptFooter(storage);
  assert.ok(generatePaymentReceiptHtml(receipt, { format: 'a4', receiptFooter: v1 }).includes('Pehla footer version.'));
  saveReceiptFooter({ footerText: 'Dusra footer version.' }, storage);
  const v2 = getReceiptFooter(storage);
  const html = generatePaymentReceiptHtml(receipt, { format: 'thermal-58', receiptFooter: v2 });
  assert.ok(html.includes('Dusra footer version.'), 'HTML shows the updated footer');
  assert.ok(!html.includes('Pehla footer version.'), 'old footer gone from HTML');
  const esc = buildEscPosReceipt(escPosFieldsFromPaymentReceipt(receipt, { receiptFooter: v2 }));
  assert.ok(esc.text.includes('Dusra footer version.'), 'ESC/POS shows the updated footer');
  const model = buildPngReceiptModel(receipt, customer, { receiptFooter: v2 });
  assert.deepEqual(model.footerLines, ['Dusra footer version.'], 'PNG model shows the updated footer');
});

// ---------------------------------------------------------------- backup

test('backup: configured footer travels as settings.receiptFooter; empty footer is omitted', () => {
  const ref = new Date('2026-10-29T10:00:00+05:00');
  const doc = JSON.parse(createJsonBackup(createInitialState(), ref, { receiptFooter: FOOTER }));
  assert.deepEqual(doc.settings?.receiptFooter, sanitizeReceiptFooter(FOOTER));
  const emptyDoc = JSON.parse(createJsonBackup(createInitialState(), ref, { receiptFooter: getDefaultReceiptFooter() }));
  assert.equal(emptyDoc.settings, undefined, 'nothing configured -> no settings section');
  const legacyDoc = JSON.parse(createJsonBackup(createInitialState(), ref));
  assert.equal(legacyDoc.settings, undefined, 'legacy callers unaffected');
});

test('backup restore: adopts on a fresh device, adopts over the empty default, conflicts when both sides differ', () => {
  const ref = new Date('2026-10-29T10:00:00+05:00');
  const backup = createJsonBackup(createInitialState(), ref, { receiptFooter: FOOTER });

  const fresh = previewJsonBackupMerge(createInitialState(), backup, {
    currentReceiptFooter: getDefaultReceiptFooter(), currentReceiptFooterStored: false
  });
  assert.equal(fresh.counts.receiptFooterRestored, 1);
  assert.equal(fresh.canApply, true, 'a footer-only restore is applicable');
  assert.deepEqual(fresh.receiptFooter, sanitizeReceiptFooter(FOOTER));
  assert.equal(fresh.conflicts.length, 0);

  const storedDefault = previewJsonBackupMerge(createInitialState(), backup, {
    currentReceiptFooter: getDefaultReceiptFooter(), currentReceiptFooterStored: true
  });
  assert.equal(storedDefault.counts.receiptFooterRestored, 1, 'stored-but-empty default still adopts');

  const identical = previewJsonBackupMerge(createInitialState(), backup, {
    currentReceiptFooter: FOOTER, currentReceiptFooterStored: true
  });
  assert.equal(identical.counts.receiptFooterRestored, 0);
  assert.equal(identical.receiptFooter, null);
  assert.ok(!identical.conflicts.some((row) => /Receipt footer/.test(row.field)), 'identical -> no conflict');

  const diverged = previewJsonBackupMerge(createInitialState(), backup, {
    currentReceiptFooter: { ...FOOTER, easypaisaNumber: '03999999999' }, currentReceiptFooterStored: true
  });
  assert.equal(diverged.receiptFooter, null, 'a restore never silently overwrites the device footer');
  assert.ok(diverged.conflicts.some((row) => /Receipt footer settings differ/.test(row.field)), 'difference is a conflict');
});

// ---------------------------------------------------------------- i18n + wiring

test('i18n audit: every rcptfoot_* key used in app.js, the studio module and index.html exists in en AND ur', () => {
  const sources = [
    fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../receipt-footer-studio.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  ].join('\n');
  const keys = new Set([...sources.matchAll(/rcptfoot_[a-z_]+/g)].map((match) => match[0]));
  assert.ok(keys.size >= 10, `expected the studio key set, found ${keys.size}`);
  for (const key of keys) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en dictionary missing ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur dictionary missing ${key}`);
    assert.notEqual(t(key, 'en'), key, `t('${key}','en') must not return the raw key`);
    assert.notEqual(t(key, 'ur'), key, `t('${key}','ur') must not return the raw key`);
  }
  assert.deepEqual(
    Object.keys(TRANSLATIONS.en).filter((key) => key.startsWith('rcptfoot_')).sort(),
    Object.keys(TRANSLATIONS.ur).filter((key) => key.startsWith('rcptfoot_')).sort(),
    'rcptfoot_* key parity between en and ur'
  );
});

test('wiring: studio dialog + trigger exist in index.html, app.js initializes the studio, module is not a build entry', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['receiptFooterStudioModal', 'receiptFooterStudioForm', 'settingReceiptFooterText', 'settingReceiptEasypaisaNumber', 'settingReceiptNayapayNumber', 'settingReceiptHelplineWhatsapp', 'settingReceiptShopsText', 'closeReceiptFooterStudioModalBtn', 'cancelReceiptFooterStudioBtn', 'mobileMoreReceiptFooterBtn']) {
    assert.ok(html.includes(`id="${id}"`), `index.html carries #${id}`);
  }
  assert.ok(html.includes('id="closeReceiptFooterStudioModalBtn" class="close-btn"'), 'studio uses the shared dialog close-button design');
  const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSource.includes('initReceiptFooterStudioModal'), 'app.js initializes the studio modal');
  assert.ok(appSource.includes('receiptFooter: getReceiptFooter()'), 'app.js feeds the footer into backups + receipts');
  const buildSource = fs.readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.ok(!buildSource.includes("'receipt-footer-studio.js'"), 'studio rides the bundle graph — not a new entry file (dist stays 25)');
});

test('dark mode: the studio module ships no hard-coded colours; its components.css block is token-only', () => {
  // 6/8-digit hex only: short '#NNN' strings in comments are issue
  // references (e.g. #359), not colours.
  const hexColour = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b|rgba?\s*\(/;
  const moduleSource = fs.readFileSync(new URL('../receipt-footer-studio.js', import.meta.url), 'utf8');
  assert.ok(!hexColour.test(moduleSource), 'no hex colours in the studio module');
  const css = fs.readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-96: Receipt Footer Studio'));
  assert.ok(block.includes('var(--modal-surface)') || block.includes('var(--surface)'), 'studio CSS uses theme tokens');
  assert.ok(!hexColour.test(block), 'no hex colours in the SISP-96 CSS block');
});
