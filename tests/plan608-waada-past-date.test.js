// Plan 608 — the Waada custom-date picker refuses past dates.
//
// On the base, an operator could type a past date into any of the three
// live-Waada custom-date inputs (chip dialog #waadaChipCustomDate,
// profile banner #wadaQuickDate, field mode #fieldModeWaadaCustomDate)
// and save a Waada that was already overdue on the day it was made:
// none of the inputs carried a min, and no save path compared the date
// against today. The fix is two layers at each of the three entry
// points: min = PKT today on the input (so the native picker offers no
// past date) + a save guard on the pure helper isWaadaDateInPast, which
// refuses a typed past date with the one new keyed message
// (prv_wr_toast_past_date). Chips can never be past
// (computeWaadaChipDate rolls forward), so the guard fires only for a
// typed custom date.
//
// Deliberately NOT fixed here: the guard does NOT live in
// setCustomerWaada / setLiveWaada — past dates stay representable for
// legacy and broken promises (the tier pins past -> Broken, and the
// field-mode / top-defaulters paths re-stamp existing dates through the
// writer). The Pending Actions "Schedule Promise" form (#promiseDateInput)
// writes collection promises, a different store — out of scope (G9).
//
// This file asserts the new parity total (5,222) and is the 35th pinning
// file. It must contain NEITHER the previous total's bare digits nor
// the older total's (plan591 G5a sweep) — the self-guard below builds
// them from split literals, plan596/plan601 pattern (guard previous +
// older, NOT current: this file itself asserts the current total).
// NOTE: the G5a/pnl sweep counts 36 files containing the digits, not
// 35 — the 36th is the privacy canary (an invented CNIC inside
// tests/privacy-zero-pii-ratchet.test.js), which holds the digits
// without pinning the total.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS, t } from '../nav-language.js';
import {
  isWaadaDateInPast,
  computeWaadaChipDate,
  remainderWaadaChipDates,
  setCustomerWaada,
  getWaadaTier,
  getWaadaTodayString,
} from '../waada-queue.js';
import { setLiveWaada } from '../waada-write.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const navJs = read('nav-language.js');
const appJs = read('app.js');
const indexHtml = read('index.html');
const waadaQueueJs = read('waada-queue.js');
const fieldModeJs = read('field-mode.js');
const topDefaultersJs = read('dashboard-top-defaulters.js');
const pendingActionsJs = read('nav-pending-actions.js');
const selfSrc = read('tests/plan608-waada-past-date.test.js');
const { en, ur } = TRANSLATIONS;

// Fixed "today" so the helper tests stay deterministic; the live chip
// test (G7) uses the real PKT today instead.
const TODAY = '2026-11-19';
const PAST = '2026-11-10';
const FUTURE = '2026-11-25';

test('G1: parity is 5,222/5,222 in both dicts', () => {
  assert.equal(Object.keys(en).length, 5222, 'EN parity');
  assert.equal(Object.keys(ur).length, 5222, 'UR parity');
});

test('G2: isWaadaDateInPast classifies past / today / future / invalid', () => {
  assert.equal(isWaadaDateInPast(PAST, TODAY), true, 'a past date is in the past');
  assert.equal(isWaadaDateInPast(TODAY, TODAY), false, 'today itself is allowed');
  assert.equal(isWaadaDateInPast(FUTURE, TODAY), false, 'a future date is not in the past');
  assert.equal(isWaadaDateInPast('', TODAY), false, 'empty input is not "in the past"');
  assert.equal(isWaadaDateInPast(null, TODAY), false, 'null input is not "in the past"');
  assert.equal(isWaadaDateInPast('not-a-date', TODAY), false, 'an invalid date is not "in the past"');
  assert.equal(isWaadaDateInPast('2026-13-01', TODAY), false, 'an impossible month is not "in the past"');
  assert.equal(isWaadaDateInPast(PAST, 'not-a-date'), false, 'an invalid today never flags a date');
});

test('G3: min = PKT today on all three typed inputs', () => {
  // The dialog input is wired in JS (renderCurrent runs on every open,
  // so the min stays fresh across midnight).
  assert.ok(/customInput\.min\s*=\s*todayStr\(\)/.test(waadaQueueJs), 'dialog input gets min = todayStr() on every open');
  // The banner input is built in wadaProfileBannerHtml, where `today`
  // (getWaadaTodayString()) is in scope.
  const bannerTag = appJs.match(/<input[^>]*id="wadaQuickDate"[^>]*>/);
  assert.ok(bannerTag, 'the banner quick-add date input exists');
  assert.ok(/min="\$\{today\}"/.test(bannerTag[0]), 'banner input carries min="${today}"');
  // The field-mode input is built in renderPanel, where todayStr() is
  // in scope (the panel re-renders, so the min stays fresh).
  const fieldTag = fieldModeJs.match(/<input[^>]*id="fieldModeWaadaCustomDate"[^>]*>/);
  assert.ok(fieldTag, 'the field-mode custom-date input exists');
  assert.ok(/min="\$\{todayStr\(\)\}"/.test(fieldTag[0]), 'field-mode input carries min="${todayStr()}"');
});

test('G4: the save guard runs at all three entry points, before the writer', () => {
  // Chip dialog: applyChip consults the helper before setCustomerWaada.
  const applyChip = waadaQueueJs.slice(waadaQueueJs.indexOf('const applyChip'));
  assert.ok(applyChip.indexOf('isWaadaDateInPast') !== -1, 'applyChip consults the helper');
  assert.ok(applyChip.indexOf('isWaadaDateInPast') < applyChip.indexOf('setCustomerWaada'), 'the dialog guard runs before the write');
  // Profile banner: the submit handler consults the helper before setLiveWaada.
  const bannerHandler = appJs.slice(appJs.indexOf("querySelector('#wadaQuickForm')"));
  assert.ok(bannerHandler.indexOf('isWaadaDateInPast') !== -1, 'the banner handler consults the helper');
  assert.ok(bannerHandler.indexOf('isWaadaDateInPast') < bannerHandler.indexOf('setLiveWaada'), 'the banner guard runs before the write');
  // Field mode: applyWaada consults the helper before applyFieldModeWaadaChip.
  const applyWaada = fieldModeJs.slice(fieldModeJs.indexOf('function applyWaada'));
  assert.ok(applyWaada.indexOf('isWaadaDateInPast') !== -1, 'applyWaada consults the helper');
  assert.ok(applyWaada.indexOf('isWaadaDateInPast') < applyWaada.indexOf('applyFieldModeWaadaChip'), 'the field-mode guard runs before the write');
});

test('G5: the refusal message is keyed in both dicts, real EN + real UR', () => {
  const enMsg = en.prv_wr_toast_past_date;
  const urMsg = ur.prv_wr_toast_past_date;
  assert.equal(typeof enMsg, 'string', 'the EN refusal message exists');
  assert.ok(enMsg.length > 10, 'the EN message is a real sentence, not a stub');
  assert.equal(typeof urMsg, 'string', 'the UR refusal message exists');
  assert.ok(/[\u0600-\u06FF]/.test(urMsg), 'the UR message is Urdu script, not English');
  assert.notEqual(enMsg, urMsg, 'EN and UR values differ (no EN==UR pair)');
  assert.doesNotMatch(enMsg, /Rs\./, 'no Rs. token in the EN message (Sharafat 85)');
  assert.doesNotMatch(enMsg, /\bRs\s/, "no 'Rs ' in the EN message (Sharafat 85)");
  assert.equal(t('prv_wr_toast_past_date'), enMsg, 't() returns the EN message by default');
  assert.equal(t('prv_wr_toast_past_date', 'ur'), urMsg, 't() returns the UR message');
});

test('G6: both dialog hosts pass the keyed message as a setup option', () => {
  assert.ok(/setupWaadaChipDialog\(\{[\s\S]{0,600}?pastDateMessage:\s*t\('prv_wr_toast_past_date'\)/.test(appJs),
    'app.js passes pastDateMessage to the group Waada dialog');
  assert.ok(/setupWaadaChipDialog\(\{[\s\S]{0,600}?pastDateMessage:\s*t\('prv_wr_toast_past_date'\)/.test(topDefaultersJs),
    'dashboard-top-defaulters.js passes pastDateMessage to the top-defaulters Waada dialog');
});

test('G7: every chip date passes the guard (chips can never be past)', () => {
  const today = getWaadaTodayString();
  const chips = ['plus2', 'plus5', 'fifth', 'tenth', '29th', '30th', '31st'];
  for (const chip of chips) {
    const date = computeWaadaChipDate(chip, today);
    assert.ok(date, `${chip} resolves to a date`);
    assert.equal(isWaadaDateInPast(date, today), false, `${chip} (${date}) must not be in the past`);
  }
  const remainder = remainderWaadaChipDates(today);
  for (const [chip, date] of Object.entries(remainder)) {
    assert.equal(isWaadaDateInPast(date, today), false, `remainder ${chip} (${date}) must not be in the past`);
  }
});

test('G8: past dates stay representable — the writer is NOT the guard', () => {
  // A legacy/broken promise keeps its past date through both writers;
  // only the three entry points refuse to CREATE one.
  const customer = setCustomerWaada({ id: 'c1', name: 'Test Customer' }, { promiseDate: PAST });
  assert.equal(customer.promiseDate, PAST, 'the setter still accepts a past date');
  assert.equal(getWaadaTier(customer, 1000, TODAY), 'broken', 'a past promise still tiers as Broken');
  const written = setLiveWaada({ id: 'c1', name: 'Test Customer' }, [], { promiseDate: PAST, promiseAmount: 1000, promiseNote: '' });
  assert.equal(written.customer.promiseDate, PAST, 'the writer still accepts a past date');
});

test('G9: the collection-promise form is untouched (different store)', () => {
  const tag = indexHtml.match(/<input[^>]*id="promiseDateInput"[^>]*>/);
  assert.ok(tag, 'the Schedule Promise date input exists');
  assert.ok(!/min=/.test(tag[0]), 'no min on the collection-promise input (payment dates may be past)');
  assert.ok(!/isWaadaDateInPast/.test(pendingActionsJs), 'no Waada past-date guard in the pending-actions module');
});

test('G10: this file pins the new total and stays free of the previous and older total literals', () => {
  assert.ok(selfSrc.includes('5222'), 'this file pins the new total 5,222');
  // The previous total's digits and the older total's digits are built,
  // never spelled, so this guard cannot trip the sweep it guards.
  assert.ok(!selfSrc.includes('51' + '61'), 'this file must stay free of the previous-count literal');
  assert.ok(!selfSrc.includes('51' + '45'), 'this file must stay free of the older-count literal');
});
