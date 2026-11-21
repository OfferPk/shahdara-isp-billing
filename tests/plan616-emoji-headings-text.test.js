// Plan 616 — Emoji headings become text headings.
//
// The 17 profile sub-section <h4> headings (app.js:8569-8766 +
// profile-ui.js:1227-1515) led with an emoji in their i18n values, in
// BOTH dicts, while the rest of the profile uses plain text headings
// (the 7 prof_sec_* h3s, the 6 pfh_* form h4s). Emoji headings render
// differently across devices and read badly in screen readers. The fix
// is value-only: the leading emoji + space was stripped from each value
// in nav-language.js (same keys, same words, same order, same
// treatment). No new key, no re-pin, no app.js / CSS / markup change.
//
// THE FE0F TRAP: prof_hold_heading was '🏖️ …' = U+1F3D6 + U+FE0F +
// space. A strip that removes one code point leaves a lone invisible
// variation selector at the start — the heading would LOOK fixed while
// still starting with a non-letter. C9 + B9 pin the exact stripped
// text, so a naive strip fails them.
//
// THE KASRA: the UR bd_heading value 'ناقابلِ وصول قرض (Bad Debt)'
// carries kasra U+0650 after ل (receipt-script.js:195 — copied
// byte-for-byte, never retyped). Only the leading emoji was stripped;
// B10 pins the exact value, kasra included.
//
// SCOPE (by design, not an oversight): dialog titles (Waada,
// Complaint Register, Field Tickets, Downtime Analytics — hardcoded
// in index.html), help-tip titles (help_waada_title /
// help_waada_score_title) and receipt labels (profile-ui.js:211-229 /
// :241-255) keep their emoji. The spec's "🤝 Waada" example pointed
// at the dialog title, not a profile heading; the complaints section
// has no heading at all (aria-label only); the print card has no
// emoji heading. Stripping those other surfaces is a separate
// decision, not part of this plan.
//
// The C + B tests pin the FULL EN + UR values, not just "no emoji",
// so a word lost in a future edit is caught. The three sections
// whose aria-label IS the heading key (upsell / winback / hwaudit —
// profile-ui.js:1428/:1469/:1515) get their screen-reader labels
// cleaned by the same value edits.
//
// This file asserts NO key-count total (values only, the count stays).
// It must contain NEITHER the current nor the previous count's bare
// digits, and no split-literal form of them either.
import test from 'node:test';
import assert from 'node:assert/strict';

import { TRANSLATIONS } from '../nav-language.js';

const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;

// Leading pictograph / symbol / dingbat / variation selector.
const LEADING_EMOJI = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
const stripLeadingEmoji = (value) => value.replace(LEADING_EMOJI, '').replace(/^\s+/, '');

// The 17 defect keys: [key, expected EN text, expected UR text] — the
// exact values after the leading emoji + space is stripped.
const HEADINGS = [
  ['prof_ticket_heading', 'Field tickets — Lineman worklist', 'فیلڈ ٹکٹ — لائن مین ورک لسٹ'],
  ['prof_downtime_heading', 'Downtime analytics', 'ڈاؤن ٹائم تجزیہ'],
  ['prof_ref_heading', 'Hamsaya Referral', 'ہمسایہ ریفرل'],
  ['prof_optical_heading', 'Optical splitter', 'آپٹیکل اسپلٹر'],
  ['prof_pole_heading', 'Pole & landmark', 'کھمبا اور نشانی'],
  ['prof_feeder_heading', 'Feeder & outage impact', 'فیڈر اور بندش کا اثر'],
  ['prof_kist_heading', 'Kist / Installments — Hardware & Wire', 'قسط / اقساط — ہارڈ ویئر اور تار'],
  ['prof_mikrotik_heading', 'MikroTik script', 'مائیکرو ٹک اسکرپٹ'],
  ['prof_hold_heading', 'Vacation hold — router', 'چھٹی ہولڈ — روٹر'],
  ['bd_heading', 'Bad Debt Write-Off', 'ناقابلِ وصول قرض (Bad Debt)'],
  ['prof_dep_heading', 'Security Deposit Settlement', 'سیکیورٹی ڈپازٹ تصفیہ'],
  ['prof_custody_heading', 'Hardware Custody — Returnable Equipment', 'ہارڈ ویئر تحویل — واپسی کے قابل سامان'],
  ['contrib_heading', 'Shared Router — Bill Split', 'مشترکہ راؤٹر — بل تقسیم'],
  ['nbp_heading', 'Next Month Bill (Projected)', 'اگلے مہینے کا بل (متوقع)'],
  ['prof_upsell_heading', 'Upgrade suggestion', 'اپ گریڈ تجویز'],
  ['winback_prof_heading', 'Disconnect details', 'منقطع تفصیل'],
  ['prof_hwaudit_heading', 'Hardware / Optical Bottleneck Suspected', 'ہارڈویئر / آپٹیکل رکاوٹ کا شبہ'],
];

for (const [key, expectedEn, expectedUr] of HEADINGS) {
  test(`C: ${key} is a plain text heading (EN)`, () => {
    assert.ok(en[key], `${key} must exist in the EN dict`);
    assert.ok(!LEADING_EMOJI.test(en[key]), `${key} EN still leads with an emoji: ${JSON.stringify(en[key])}`);
    assert.equal(en[key], expectedEn, `${key} EN words must be unchanged after the strip`);
  });

  test(`B: ${key} is a plain text heading (UR)`, () => {
    assert.ok(ur[key], `${key} must exist in the UR dict`);
    assert.ok(!LEADING_EMOJI.test(ur[key]), `${key} UR still leads with an emoji: ${JSON.stringify(ur[key])}`);
    assert.equal(ur[key], expectedUr, `${key} UR words must be unchanged after the strip`);
  });
}

test('S1: the seven Plan 495 detail-section h3 headings are already emoji-free (EN + UR)', () => {
  for (const key of ['prof_sec_customer', 'prof_sec_service', 'prof_sec_financial', 'prof_sec_connection', 'prof_sec_network', 'prof_sec_hardware', 'prof_sec_history']) {
    assert.ok(!LEADING_EMOJI.test(en[key]), `${key} EN leads with an emoji`);
    assert.ok(!LEADING_EMOJI.test(ur[key]), `${key} UR leads with an emoji`);
  }
});

test('S2: the six edit-form h4 headings are already emoji-free (EN + UR)', () => {
  for (const key of ['pfh_customer', 'pfh_service', 'pfh_financial', 'pfh_connection', 'pfh_network', 'pfh_hardware']) {
    assert.ok(!LEADING_EMOJI.test(en[key]), `${key} EN leads with an emoji`);
    assert.ok(!LEADING_EMOJI.test(ur[key]), `${key} UR leads with an emoji`);
  }
});

test('S3: the neighbouring profile headings are already emoji-free (EN + UR)', () => {
  for (const key of ['prv_wd_heading', 'prof_receipts_heading', 'prof_view_heading', 'prof_edit_heading', 'prof_clv_heading', 'boost_heading', 'prof_dfs_heading', 'prof_danger_zone_title']) {
    assert.ok(en[key], `${key} must exist in the EN dict`);
    assert.ok(!LEADING_EMOJI.test(en[key]), `${key} EN leads with an emoji`);
    assert.ok(!LEADING_EMOJI.test(ur[key]), `${key} UR leads with an emoji`);
  }
});

test('S4: the section aria-labels are already emoji-free (EN + UR)', () => {
  // 14 sections carry a dedicated *_aria key (already emoji-free). The
  // other three (upsell / winback / hwaudit, profile-ui.js:1428/1469/1515)
  // use the HEADING key itself as the aria-label, so the value-only fix
  // cleans their aria-labels too — verified by the C/B tests, not here.
  for (const key of ['prof_ticket_aria', 'prof_downtime_aria', 'prof_ref_aria', 'prof_optical_aria', 'prof_pole_aria', 'prof_feeder_aria', 'prof_kist_aria', 'prof_mikrotik_aria', 'prof_hold_aria', 'bd_aria', 'prof_dep_aria', 'prof_custody_aria', 'contrib_aria', 'nbp_aria']) {
    assert.ok(en[key], `${key} must exist in the EN dict`);
    assert.ok(!LEADING_EMOJI.test(en[key]), `${key} EN leads with an emoji`);
    assert.ok(!LEADING_EMOJI.test(ur[key]), `${key} UR leads with an emoji`);
  }
});

test('S5: stripping the emoji leaves the same words in UR too (no word lost)', () => {
  // Spot-check the UR values: after the strip they must still start with
  // the expected Urdu words (the full UR strings are pinned by the B tests).
  const urStarts = {
    prof_ticket_heading: 'فیلڈ ٹکٹ',
    prof_downtime_heading: 'ڈاؤن ٹائم',
    prof_ref_heading: 'ہمسایہ ریفرل',
    bd_heading: 'ناقابلِ وصول قرض',
    prof_dep_heading: 'سیکیورٹی ڈپازٹ تصفیہ',
    contrib_heading: 'مشترکہ راؤٹر',
  };
  for (const [key, start] of Object.entries(urStarts)) {
    assert.ok(stripLeadingEmoji(ur[key]).startsWith(start), `${key} UR after strip must start with ${start}, got ${JSON.stringify(ur[key])}`);
  }
});
