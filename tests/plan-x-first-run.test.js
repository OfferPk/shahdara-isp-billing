import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  DEFAULT_BUSINESS_NAME,
  sanitizeBusinessName,
  validateOwnerPhone,
  businessSetupChecklist,
  isFreshBusiness,
  emptyBusinessHtml,
  firstRunBannerHtml,
  MANIFEST_SHORTCUTS,
  shortcutActionFromUrl,
  manifestShortcutAlignment,
} from '../first-run.js';

import { parsePwaActionFromUrl } from '../nav-pwa.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Business name ---

test('blank business name falls back to the house default', () => {
  assert.equal(sanitizeBusinessName(''), DEFAULT_BUSINESS_NAME);
  assert.equal(sanitizeBusinessName('   '), DEFAULT_BUSINESS_NAME);
  assert.equal(sanitizeBusinessName(null), DEFAULT_BUSINESS_NAME);
  assert.equal(sanitizeBusinessName(undefined), DEFAULT_BUSINESS_NAME);
});

test('business name is trimmed and kept verbatim otherwise', () => {
  assert.equal(sanitizeBusinessName('  My ISP  '), 'My ISP');
});

test('business name is bounded so a long paste cannot blow up the banner', () => {
  assert.equal(sanitizeBusinessName('x'.repeat(200)).length, 100);
});

// --- Owner phone ---

test('local 03 mobile validates and normalises to itself', () => {
  assert.deepEqual(validateOwnerPhone('03001234567'), { valid: true, normalized: '03001234567', reason: null });
});

test('+92 form validates to the 03 form', () => {
  assert.deepEqual(validateOwnerPhone('+923001234567'), { valid: true, normalized: '03001234567', reason: null });
});

test('92 form without the plus validates to the 03 form', () => {
  assert.deepEqual(validateOwnerPhone('923001234567'), { valid: true, normalized: '03001234567', reason: null });
});

test('spaces and dashes inside the number are ignored', () => {
  assert.equal(validateOwnerPhone('0300 - 123 4567').normalized, '03001234567');
});

test('empty phone is missing, not invalid', () => {
  assert.deepEqual(validateOwnerPhone(''), { valid: false, normalized: '', reason: 'empty' });
  assert.deepEqual(validateOwnerPhone(null), { valid: false, normalized: '', reason: 'empty' });
});

test('short, landline, and lettered numbers are invalid', () => {
  assert.equal(validateOwnerPhone('03001234').reason, 'invalid');
  assert.equal(validateOwnerPhone('04237123456').reason, 'invalid');
  assert.equal(validateOwnerPhone('0300abc4567').reason, 'invalid');
});

// --- Setup checklist ---

test('empty settings leave every step undone', () => {
  const checklist = businessSetupChecklist({});
  assert.equal(checklist.total, 3);
  assert.equal(checklist.doneCount, 0);
  assert.equal(checklist.complete, false);
  assert.deepEqual(checklist.steps.map((s) => s.key), ['business-name', 'whatsapp-identity', 'receipt-branding']);
});

test('house default title counts as the business-name step done', () => {
  const checklist = businessSetupChecklist({ digitalSettings: { ownerAccountTitle: 'Shahdara Fiber Net' } });
  assert.equal(checklist.steps[0].done, true);
  assert.equal(checklist.steps[0].detail, 'Shahdara Fiber Net');
});

test('owner phone marks the WhatsApp step done with the normalised number', () => {
  const checklist = businessSetupChecklist({ digitalSettings: { ownerPhone: '+923001234567' } });
  assert.equal(checklist.steps[1].done, true);
  assert.equal(checklist.steps[1].detail, '03001234567');
});

test('fallback WhatsApp phone (backup-restore mirror) marks the step done', () => {
  const checklist = businessSetupChecklist({ ownerWhatsappPhone: '03001234567' });
  assert.equal(checklist.steps[1].done, true);
});

test('an invalid phone never marks the WhatsApp step done', () => {
  const checklist = businessSetupChecklist({ digitalSettings: { ownerPhone: '04237123456' } });
  assert.equal(checklist.steps[1].done, false);
});

test('each receipt-branding field alone marks the branding step done', () => {
  for (const footer of [
    { footerText: 'Thank you' },
    { helplineWhatsapp: '03001234567' },
    { shopsText: 'Shop 1' },
    { easypaisaNumber: '03001234567' },
    { nayapayNumber: '03001234567' },
  ]) {
    assert.equal(businessSetupChecklist({ receiptFooter: footer }).steps[2].done, true);
  }
});

test('blank footer fields leave the branding step undone', () => {
  const checklist = businessSetupChecklist({ receiptFooter: { footerText: '   ', helplineWhatsapp: '' } });
  assert.equal(checklist.steps[2].done, false);
});

test('all three steps done means complete', () => {
  const checklist = businessSetupChecklist({
    digitalSettings: { ownerAccountTitle: 'My ISP', ownerPhone: '03001234567' },
    receiptFooter: { footerText: 'Thank you' },
  });
  assert.equal(checklist.doneCount, 3);
  assert.equal(checklist.complete, true);
});

test('checklist tolerates null and non-object inputs', () => {
  assert.equal(businessSetupChecklist(null).doneCount, 0);
  assert.equal(businessSetupChecklist({ digitalSettings: 'nope', receiptFooter: 42 }).doneCount, 0);
});

// --- Fresh business ---

test('zero customers with nothing configured is a fresh business', () => {
  assert.equal(isFreshBusiness({ customerCount: 0 }), true);
});

test('any customer at all means not fresh', () => {
  assert.equal(isFreshBusiness({ customerCount: 1 }), false);
  assert.equal(isFreshBusiness({ customerCount: 100 }), false);
});

test('a configured WhatsApp identity means not fresh, even with zero customers', () => {
  assert.equal(isFreshBusiness({ customerCount: 0, digitalSettings: { ownerPhone: '03001234567' } }), false);
});

test('configured receipt branding means not fresh, even with zero customers', () => {
  assert.equal(isFreshBusiness({ customerCount: 0, receiptFooter: { footerText: 'Hi' } }), false);
});

test('a business name alone does not count as configured', () => {
  assert.equal(isFreshBusiness({ customerCount: 0, digitalSettings: { ownerAccountTitle: 'Shahdara Fiber Net' } }), true);
});

test('negative or non-finite customer counts are never fresh', () => {
  assert.equal(isFreshBusiness({ customerCount: -1 }), false);
  assert.equal(isFreshBusiness({ customerCount: 'many' }), false);
});

// --- Empty-business copy: no demo data, ever ---

test('empty state welcomes by business name and states no samples are included', () => {
  const html = emptyBusinessHtml({ businessName: 'My ISP' });
  assert.match(html, /Welcome to My ISP/);
  assert.match(html, /No sample customers are included/);
});

test('empty state carries the three guided actions', () => {
  const html = emptyBusinessHtml({});
  assert.match(html, /data-first-run="digital-settings"/);
  assert.match(html, /data-first-run="receipt-footer"/);
  assert.match(html, /data-first-run="add-customer"/);
});

test('empty state shows the setup progress count', () => {
  const checklist = businessSetupChecklist({
    digitalSettings: { ownerAccountTitle: 'My ISP', ownerPhone: '03001234567' },
  });
  assert.match(emptyBusinessHtml({ businessName: 'My ISP', checklist }), /2 of 3 steps done/);
});

test('empty state escapes a hostile business name', () => {
  const html = emptyBusinessHtml({ businessName: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('empty state contains no invented customer rows', () => {
  const html = emptyBusinessHtml({});
  assert.doesNotMatch(html, /customerNumber|0300|PKR [1-9]/);
});

test('banner wraps the empty state with a labelled section', () => {
  const html = firstRunBannerHtml({ businessName: 'My ISP' });
  assert.match(html, /id="firstRunBannerContent"/);
  assert.match(html, /Welcome to My ISP/);
});

// --- Manifest shortcuts ---

test('exactly four manifest shortcuts are pinned', () => {
  assert.equal(MANIFEST_SHORTCUTS.length, 4);
  assert.deepEqual(
    MANIFEST_SHORTCUTS.map((s) => s.action),
    ['quick-collect', 'add-customer', 'today-dues', 'payments-inbox'],
  );
});

test('shortcut URLs resolve to the actions they promise', () => {
  for (const shortcut of MANIFEST_SHORTCUTS) {
    assert.equal(shortcutActionFromUrl(shortcut.url), shortcut.action);
  }
});

test('shortcut URL parsing handles ./, #/, and the legacy aliases', () => {
  assert.equal(shortcutActionFromUrl('./#quick-collect'), 'quick-collect');
  assert.equal(shortcutActionFromUrl('#/easypaisa'), 'payments-inbox');
  assert.equal(shortcutActionFromUrl('#dues'), 'today-dues');
  assert.equal(shortcutActionFromUrl('#unknown-thing'), null);
  assert.equal(shortcutActionFromUrl(''), null);
});

test('shortcut URLs agree with the real nav-pwa parser', () => {
  for (const shortcut of MANIFEST_SHORTCUTS) {
    assert.equal(parsePwaActionFromUrl(shortcut.url), shortcut.action);
  }
});

test('the shipped manifest declares all four shortcuts with matching URLs', () => {
  const manifest = JSON.parse(readFileSync(path.join(__dirname, '..', 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Shahdara ISP Billing');
  const alignment = manifestShortcutAlignment(manifest);
  assert.equal(alignment.length, 4);
  for (const entry of alignment) {
    assert.equal(entry.inManifest, true, entry.name);
    assert.equal(entry.urlMatches, true, entry.name);
    assert.equal(entry.resolvesToAction, true, entry.name);
  }
});

test('alignment flags a shortcut missing from a manifest', () => {
  const alignment = manifestShortcutAlignment({ shortcuts: [] });
  assert.ok(alignment.every((entry) => entry.inManifest === false));
});

test('alignment flags a shortcut whose URL drifted from the manifest', () => {
  const manifest = {
    shortcuts: MANIFEST_SHORTCUTS.map((s) => (s.action === 'today-dues' ? { ...s, url: './#dues-list' } : s)),
  };
  const entry = manifestShortcutAlignment(manifest).find((e) => e.action === 'today-dues');
  assert.equal(entry.inManifest, true);
  assert.equal(entry.urlMatches, false);
});
