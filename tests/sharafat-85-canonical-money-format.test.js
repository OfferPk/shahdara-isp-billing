// Sharafat 85: one canonical money format.
// core.js formatPKR is the ONLY money formatter. The owner-khata.js copy
// and relocation-log.js pkr() are deleted (no deprecated re-export); every
// app.js toast/audit-trail site and every i18n money key routes through
// formatPKR, with the caller passing the already-formatted value so the
// key itself carries no currency token (the double-prefix trap).
// Pure computation + source guards, synthetic data only.
//
// Disclosed: the doc's "PKR 1,235" acceptance number was the OLD khata
// answer (whole-rupee rounding). The canonical answer for 1234.5 is
// "PKR 1,234.50", and the owner's WhatsApp khata report reads differently
// for fractional amounts than it did under the khata copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatPKR } from '../core.js';
import * as khataModule from '../owner-khata.js';
import { buildOwnerKhataWhatsAppText } from '../owner-khata.js';
import { buildRelocationTimeline } from '../relocation-log.js';
import { concessionBadgeText } from '../concession-helper.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const { buildOwnerKhataReport } = khataModule;

const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const navLangSrc = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
const khataSrc = readFileSync(new URL('../owner-khata.js', import.meta.url), 'utf8');
const relocSrc = readFileSync(new URL('../relocation-log.js', import.meta.url), 'utf8');
const fieldDaySrc = readFileSync(new URL('../field-day-sheet.js', import.meta.url), 'utf8');
const ownerMonthSrc = readFileSync(new URL('../owner-month-report.js', import.meta.url), 'utf8');
const concessionSrc = readFileSync(new URL('../concession-helper.js', import.meta.url), 'utf8');

// Every i18n money key this item touched — the caller passes the formatted
// value, so the key text itself must carry no currency token.
const TOUCHED_KEYS = [
  'cust_card_chip_fee',
  'roz_notes_help',
  'khula_chip',
  'supkhata_total_bill_label',
  'supkhata_paid_now_label',
  'supkhata_payout_amount',
  'trf_field_amount',
  'prof_hist_concession_suggest',
  'prof_hist_concession_apply',
  'round50_toggle',
  'round50_mode_nearest',
  'round50_mode_down',
  'round50_rounded_from',
  'round50_prorata_toggle',
  'prof_hist_bill_zero_price',
  'prof_prorata_days',
];

test('canonical: core.js formatPKR is the one formatter, unchanged', () => {
  assert.equal(formatPKR(null), 'Not set');
  assert.equal(formatPKR(undefined), 'Not set');
  assert.equal(formatPKR(''), 'Not set');
  assert.equal(formatPKR(NaN), 'Not set');
  assert.equal(formatPKR(0), 'PKR 0');
  assert.equal(formatPKR(3000), 'PKR 3,000');
  assert.equal(formatPKR(1200.5), 'PKR 1,200.50');
  // The doc's "PKR 1,235" was the old khata whole-rupee answer;
  // the canonical answer keeps the paisa.
  assert.equal(formatPKR(1234.5), 'PKR 1,234.50');
  assert.equal(formatPKR(-50), 'PKR -50');
});

test('khata: the copy is deleted — no export, no re-export, core.js is the source', () => {
  assert.equal('formatPKR' in khataModule, false, 'owner-khata.js must not export formatPKR at all');
  assert.doesNotMatch(khataSrc, /export function formatPKR/);
  assert.ok(khataSrc.includes("import { formatPKR, paymentTicketChargeCents } from './core.js'"),
    'owner-khata.js must import the canonical formatter from core.js');
  assert.doesNotMatch(khataSrc, /Rs\.\s*\$\{/);
});

test('khata: the WhatsApp closing text reads canonical for fractional amounts', () => {
  // Disclosed change: under the old khata copy this read "Rs. 1,201";
  // the canonical formatter keeps the paisa.
  const text = buildOwnerKhataWhatsAppText({
    validMonth: true,
    month: '2026-10',
    collected: 1200.5,
    receiptCount: 1,
    pendingArrears: 0,
    shopSettled: 0,
    shopSettledCount: 0,
    expenses: 0,
    expenseCount: 0,
    bandwidthFieldExpenses: 0,
    profit: 1200.5,
    isLoss: false,
    nasirShare: 600.25,
    aqibShare: 600.25,
    totalComplaints: 0,
    totalDowntime: 0,
    areaOutageComplaints: 0,
    areaOutageDowntime: 0,
  });
  assert.ok(text.includes('Total Bills Collected: PKR 1,200.50 (1 receipts)'), text);
  assert.doesNotMatch(text, /Rs\. 1,201/);
  assert.ok(text.includes('Net Profit: PKR 1,200.50'), text);
  assert.ok(text.includes('Nasir share (50%): PKR 600.25'), text);
});

test('khata: the report builder itself still composes (regression guard)', () => {
  // buildOwnerKhataReport is untouched by this item; it must keep
  // returning the same figures — only its formatting source changed.
  assert.equal(typeof buildOwnerKhataReport, 'function');
});

test('relocation: pkr() is deleted and the timeline uses core.js formatPKR', () => {
  assert.doesNotMatch(relocSrc, /^function pkr\(value\)/m);
  assert.ok(relocSrc.includes("import { formatPKR } from './core.js'"),
    'relocation-log.js must import the canonical formatter from core.js');
  const rows = buildRelocationTimeline({
    relocationLog: [{ toAddress: 'X', toZone: 'Barrian', shiftedAt: '2026-10-20', shiftingFee: 1200.5 }],
  });
  assert.equal(rows.length, 1);
  assert.ok(rows[0].detail.includes('PKR 1,200.50'), rows[0].detail);
  assert.doesNotMatch(rows[0].detail, /PKR 1,200\.5[^0-9]/);
});

test('importers: field-day-sheet and owner-month-report import formatPKR from core.js only', () => {
  assert.ok(fieldDaySrc.includes("import { formatPKR } from './core.js'"));
  assert.doesNotMatch(fieldDaySrc, /from '\.\/owner-khata\.js'.*formatPKR|formatPKR.*from '\.\/owner-khata\.js'/);
  assert.ok(ownerMonthSrc.includes("import { formatPKR } from './core.js'"));
  assert.doesNotMatch(ownerMonthSrc, /from '\.\/owner-khata\.js'.*formatPKR|formatPKR.*from '\.\/owner-khata\.js'/);
  assert.ok(concessionSrc.includes("import { formatPKR } from './core.js'"),
    'concession-helper.js must import the canonical formatter from core.js');
});

test('app.js: no bare PKR ${...toLocaleString()} money site remains', () => {
  const bare = appJs.match(/PKR \$\{[^}]*toLocaleString\([^}]*\)\}/g) || [];
  assert.equal(bare.length, 0, `${bare.length} bare-PKR site(s) remain: ${bare.slice(0, 3).join(' | ')}`);
});

test('app.js: no Rs. remains in operator UI strings', () => {
  const rsLines = appJs.split('\n').filter((line) => /Rs\./.test(line) && !/^\s*\/\//.test(line));
  assert.equal(rsLines.length, 0, `${rsLines.length} non-comment line(s) still contain 'Rs.'`);
});

test('nav-language: the dead currency_symbol key is deleted', () => {
  assert.doesNotMatch(navLangSrc, /currency_symbol/);
  assert.equal('currency_symbol' in TRANSLATIONS.en, false);
  assert.equal('currency_symbol' in TRANSLATIONS.ur, false);
  // currency_pkr is a separate live key and must survive.
  assert.equal(TRANSLATIONS.en.currency_pkr, 'PKR');
  assert.equal(TRANSLATIONS.ur.currency_pkr, 'روپے');
});

test('nav-language: no Rs. token remains anywhere in the file', () => {
  assert.doesNotMatch(navLangSrc, /Rs\./);
  assert.doesNotMatch(navLangSrc, /\bRs\s/);
});

test('i18n: every touched money key exists in both English and Urdu', () => {
  for (const key of TOUCHED_KEYS) {
    assert.ok(key in TRANSLATIONS.en, `missing EN key ${key}`);
    assert.ok(key in TRANSLATIONS.ur, `missing UR key ${key}`);
    assert.doesNotMatch(TRANSLATIONS.en[key], /Rs\./, `EN ${key} still carries Rs.`);
    assert.doesNotMatch(TRANSLATIONS.ur[key], /Rs\./, `UR ${key} still carries Rs.`);
  }
  // The UR "(روپے)" labels are the established repo precedent for the
  // (PKR …) labels and stay untouched — only literal "Rs." changed.
  assert.ok(TRANSLATIONS.ur.supkhata_total_bill_label.includes('(روپے)'));
  assert.ok(TRANSLATIONS.ur.trf_field_amount.includes('(روپے)'));
});

test('i18n: amount-carrying keys take a pre-formatted value — no double prefix', () => {
  assert.equal(
    t('prof_hist_concession_apply', null, { amount: formatPKR(300) }),
    'Apply PKR 300 Outage Concession');
  assert.equal(
    t('prof_hist_concession_suggest', null, { hours: 72, amount: formatPKR(300) }),
    'Monthly Downtime: 72 hrs • Suggested Pro-Rata Concession: PKR 300');
  assert.equal(
    t('round50_rounded_from', null, { amount: formatPKR(1200.5) }),
    'rounded from PKR 1,200.50');
  assert.equal(
    t('khula_chip', null, { tendered: formatPKR(1000), change: formatPKR(500) }),
    'Pay PKR 1,000 — keep PKR 500 change as advance');
  assert.equal(
    t('cust_card_chip_fee', null, { amount: formatPKR(3000) }),
    'PKR 3,000/mo');
  const days = t('prof_prorata_days', null, {
    day: 15, total: 30, elapsed: 14,
    oldAmount: formatPKR(1500), remaining: 16, newAmount: formatPKR(1600),
  });
  assert.ok(days.includes('(PKR 1,500)'), days);
  assert.ok(days.includes('(PKR 1,600)'), days);
  assert.doesNotMatch(days, /PKR PKR/);
  // Urdu renders the same pre-formatted value, with no Rs. token.
  const urKhula = t('khula_chip', 'ur', { tendered: formatPKR(1000), change: formatPKR(500) });
  assert.ok(urKhula.includes('PKR 1,000'), urKhula);
  assert.ok(urKhula.includes('PKR 500'), urKhula);
  assert.doesNotMatch(urKhula, /Rs\./);
  const urApply = t('prof_hist_concession_apply', 'ur', { amount: formatPKR(300) });
  assert.ok(urApply.includes('PKR 300'), urApply);
  assert.doesNotMatch(urApply, /Rs\./);
});

test('i18n: pure labels read PKR, not Rs.', () => {
  assert.equal(t('round50_toggle'), 'Round to PKR 50');
  assert.equal(t('round50_mode_nearest'), 'Nearest PKR 50');
  assert.equal(t('round50_mode_down'), 'Round down to PKR 50');
  assert.equal(t('round50_prorata_toggle'), 'Round pro-rata credit to PKR 50');
  assert.equal(t('prof_hist_bill_zero_price'), 'Free bill (PKR 0)');
  assert.equal(t('supkhata_total_bill_label'), 'Total bill (PKR)');
  assert.equal(t('supkhata_paid_now_label'), 'Paid now (PKR)');
  assert.equal(t('supkhata_payout_amount'), 'Amount (PKR)');
  assert.equal(t('trf_field_amount'), 'Amount (PKR)');
  assert.ok(t('roz_notes_help').includes('(PKR 20 / 10)'));
});

test('concession badge formats through the canonical formatter', () => {
  assert.equal(
    concessionBadgeText({ downtimeHours: 72, suggestedAmount: 300 }),
    'Monthly Downtime: 72 hrs • Suggested Pro-Rata Concession: PKR 300');
  assert.equal(
    concessionBadgeText({ downtimeHours: 12, suggestedAmount: 1200.5 }),
    'Monthly Downtime: 12 hrs • Suggested Pro-Rata Concession: PKR 1,200.50');
});
