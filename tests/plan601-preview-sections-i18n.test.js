// Plan 601 — the five preview templates + Waada banner + eight helper
// modules + five note explainers + cross-payments explainer + wada-record
// chrome speak the operator's language (one prv_ family, 232 new keys).
// The modules take a labels object built by app.js from t() calls and
// never import t() themselves (the 591/600 precedent); the English
// defaults are byte-identical to the strings they replace, so every
// existing EN assertion still passes unchanged.
//
// Disclosed in the PR body (kept here so the pins stay honest):
// - The prep counted 212 keys; the true count is 232 (this file pins
//   it), so parity is 5,138/5,138, not 5,118.
// - The prep repro's C-B-first-bill requires keying 'Rs 0' strings
//   verbatim, which Sharafat 85 forbids in nav-language.js. The three
//   fee/deposit assumption strings are keyed as {amount} templates and
//   the module fills 'Rs 0' at runtime (G8 pins both halves).
// - Three EN == UR exceptions, all deliberate: prv_wr_note (pure
//   punctuation + operator data, no words), prv_lc_package_detail
//   (a package label + price, no sentence to translate) and
//   prv_cp_paid_by_rel (' ({relationship})' — punctuation only).
// - A fix found while keying (G4a): buildFirstBillPreview never put
//   firstPeriodNote on the returned preview, so the base summary
//   rendered "(undefined)". The summary now reads the note off the
//   first-period line, so it reads "(Full month)" as intended.
// - The prep repro's substring checks cannot tell rendered text from
//   element ids, option values and data attributes: 'Date'/'Note' live
//   in #qualityLogDate/#qualityLogNote, 'Far room' in the option value,
//   '29th'/'30th'/'31st' in data-wada-quick-chip. Those three C-T
//   checks stay red in the repro; G3+G5 here pin the rendered text.
// - This file asserts the NEW total and contains no bare previous-total
//   or older-total literal anywhere (split literals only, G2e).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TRANSLATIONS } from '../nav-language.js';
import {
  buildFirstBillPreview, previewFromCustomer, firstBillPreviewSummaryText,
  firstBillPreviewHtml, firstBillPreviewShownText,
} from '../first-bill-preview.js';
import {
  buildPackageChangePreview, packageChangePreviewSummaryText,
  packageChangePreviewNote, packageChangePreviewHtml,
  packageChangePreviewStoredText,
} from '../package-change-preview.js';
import {
  billingCycleChoiceSummaryText, billingCycleChoiceHtml,
} from '../billing-cycle-choice.js';
import {
  paymentChannelSummaryText, paymentChannelHtml, paymentChannelInstructions,
} from '../payment-channel.js';
import { qualityLogSummaryText, qualityLogHtml } from '../quality-log.js';
import {
  resolveLifecycleStatus, buildLifecycleJourney, lifecycleJourneyHtml,
} from '../lifecycle-journey.js';
import {
  ONBOARDING_STEPS, buildOnboardingChecklist, buildOnboardingEntry,
  onboardingSummaryText, onboardingChecklistHtml, onboardingPendingHtml,
  onboardingChecklistCsv, onboardingStepLabel,
} from '../onboarding-checklist.js';
import {
  packageHistorySegmentsFor, packageHistorySegmentText, packageHistoryViewText,
  packageHistoryViewSectionHtml,
} from '../package-history-view.js';
import {
  wadaHealthText, wadaRecordText, wadaRecordHtml, wadaBannerHtml,
  wadaHistoryHtml,
} from '../wada-record.js';
import {
  crossPaymentNoteOf, crossPaymentNoteLineText, crossPaymentNoteMarkup,
  crossPaymentsMadeSectionHtml,
} from '../cross-payment-note.js';
import { handlingNoteSectionHtml } from '../handling-note.js';
import {
  standingInstructionSectionHtml, standingInstructionLineText,
} from '../standing-instruction-note.js';
import { spokenLanguageNoteSectionHtml } from '../spoken-language-note.js';
import { gateAccessInstructionSectionHtml } from '../gate-access-instruction.js';
import { customerEmergencyContactSectionHtml } from '../customer-emergency-contact.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const appJs = read('app.js');
const navJs = read('nav-language.js');
const selfSrc = readFileSync(join(dir, 'plan601-preview-sections-i18n.test.js'), 'utf8');
const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;

// The labels objects, property-for-property as the helpers in app.js
// build them (short property name -> dict key). The test builds them
// from each dict so defaults-vs-EN-labels equality proves the English
// defaults are byte-identical (G4) and UR labels really switch the
// rendering (G5, so G4 cannot pass vacuously through a bad property).
const LABEL_PROPS = {
  firstBill: { noPreview: 'prv_fb_no_preview', summaryIncomplete: 'prv_fb_summary_incomplete', lineInstallation: 'prv_fb_line_installation', lineFirstPeriod: 'prv_fb_line_first_period', lineDeposit: 'prv_fb_line_deposit', waived: 'prv_fb_waived', feeNotRecorded: 'prv_fb_fee_not_recorded', depositNotRecorded: 'prv_fb_deposit_not_recorded', feeAssumption: 'prv_fb_fee_assumption', prorataNote: 'prv_fb_prorata_note', assumptions: 'prv_fb_assumptions', incomplete: 'prv_fb_incomplete', summaryReady: 'prv_fb_summary_ready', notShown: 'prv_fb_not_shown', shownOn: 'prv_fb_shown_on', reasonPrice: 'prv_fb_reason_price', reasonDate: 'prv_fb_reason_date', missingFigures: 'prv_fb_missing_figures', tableItem: 'prv_table_item', tableAmount: 'prv_table_amount', tableNote: 'prv_ql_note', totalDue: 'prv_fb_total_due', previewOnly: 'prv_fb_preview_only', fullMonth: 'prv_fb_full_month' },
  packageChange: { noPreview: 'prv_pc_no_preview', summaryIncomplete: 'prv_pc_summary_incomplete', directionUpgrade: 'prv_pc_direction_upgrade', directionDowngrade: 'prv_pc_direction_downgrade', directionLateral: 'prv_pc_direction_lateral', estimateAfter: 'prv_pc_estimate_after', estimateFullRequested: 'prv_pc_estimate_full_requested', estimateFullStart: 'prv_pc_estimate_full_start', estimateProrata: 'prv_pc_estimate_prorata', dayOne: 'prv_pc_day_one', dayMany: 'prv_pc_day_many', lineFullEffect: 'prv_pc_line_full_effect', lineBefore: 'prv_pc_line_before', lineFrom: 'prv_pc_line_from', reasonPackage: 'prv_pc_reason_package', reasonEffective: 'prv_pc_reason_effective', reasonMonth: 'prv_pc_reason_month', reasonCurrentPrice: 'prv_pc_reason_current_price', reasonProposedPrice: 'prv_pc_reason_proposed_price', summaryReady: 'prv_pc_summary_ready', incomplete: 'prv_pc_incomplete', estimatedBill: 'prv_pc_estimated_bill', previewOnly: 'prv_pc_preview_only', storedNone: 'prv_pc_stored_none', storedKept: 'prv_pc_stored_kept', missingFigures: 'prv_fb_missing_figures', tableItem: 'prv_table_item', tableAmount: 'prv_table_amount', tableNote: 'prv_ql_note', fullMonth: 'prv_fb_full_month' },
  billingCycle: { noChoice: 'prv_bc_no_choice', dueOn: 'prv_bc_due_on', changedOn: 'prv_bc_changed_on', changeNotRecorded: 'prv_bc_change_not_recorded', note: 'prv_bc_note', day: 'prv_bc_day' },
  paymentChannel: { noChannelCustomer: 'prv_pch_no_channel_customer', preferredLabel: 'prv_pch_preferred_label', noChannelYet: 'prv_pch_no_channel_yet', summaryOne: 'prv_pch_summary_one', summaryMany: 'prv_pch_summary_many', cash: 'prv_pch_cash', wallet: 'prv_pch_wallet' },
  qualityLog: { noMeasurements: 'prv_ql_no_measurements', summary: 'prv_ql_summary', packageNotSet: 'prv_ql_package_not_set', packageSpeed: 'prv_ql_package_speed', below: 'prv_ql_below', above: 'prv_ql_above', at: 'prv_ql_at', belowPkg: 'prv_ql_below_pkg', noPackage: 'prv_ql_no_package', headerDate: 'prv_ql_date', headerDownload: 'prv_ql_header_download', headerUpload: 'prv_ql_header_upload', headerWhere: 'prv_ql_where', headerPackage: 'prv_ql_header_package', headerComparison: 'prv_ql_header_comparison', headerNote: 'prv_ql_note', headerTicket: 'prv_ql_header_ticket', locNear: 'prv_ql_loc_near', farRoom: 'prv_ql_far_room', notSet: 'prof_not_set', notRecorded: 'prof_not_recorded' },
  lifecycle: { active: 'prv_lc_active', offline: 'prv_lc_offline', notSet: 'prof_not_set', notRecorded: 'prof_not_recorded', notSetMoney: 'prv_lc_not_set', archived: 'prv_lc_archived', disconnectedReason: 'prv_lc_disconnected_reason', onHold: 'prv_lc_on_hold', holdResumes: 'prv_lc_hold_resumes', holdSince: 'prv_lc_hold_since', serviceNotRecorded: 'prv_lc_service_not_recorded', serviceStatus: 'prv_lc_service_status', added: 'prv_lc_added', addedSeparate: 'prv_lc_added_separate', addedSame: 'prv_lc_added_same', connected: 'prv_lc_connected', connectedDetail: 'prv_lc_connected_detail', packageChanged: 'prv_lc_package_changed', packageDetail: 'prv_lc_package_detail', statusChanged: 'prv_lc_status_changed', holdStarted: 'prv_lc_hold_started', holdResume: 'prv_lc_hold_resume', holdNoResume: 'prv_lc_hold_no_resume', holdEnded: 'prv_lc_hold_ended', holdResumed: 'prv_lc_hold_resumed', disconnected: 'prv_lc_disconnected', disconnectDetail: 'prv_lc_disconnect_detail', eligible: 'prv_lc_eligible', notEligible: 'prv_lc_not_eligible', disconnectNote: 'prv_lc_disconnect_note', disconnectNodate: 'prv_lc_disconnect_nodate', reasonShifted: 'prv_lc_reason_shifted', reasonCompetitor: 'prv_lc_reason_competitor', reasonAffordability: 'prv_lc_reason_affordability', reasonTravel: 'prv_lc_reason_travel', winbackSent: 'prv_lc_winback_sent', winbackDetail: 'prv_lc_winback_detail', restored: 'prv_lc_restored', restoredDetail: 'prv_lc_restored_detail', journey: 'prv_lc_journey', journeyAria: 'prv_lc_journey_aria', currentStatus: 'prv_lc_current_status', dateNotRecorded: 'prv_lc_date_not_recorded', undatedNote: 'prv_lc_undated_note', noEvents: 'prv_lc_no_events' },
  onboarding: { stepEnquiry: 'prv_ob_step_enquiry', stepSurvey: 'prv_ob_step_survey', stepCable: 'prv_ob_step_cable', stepDevice: 'prv_ob_step_device', stepCredentials: 'prv_ob_step_credentials', stepActivation: 'prv_ob_step_activation', stepFirstBill: 'prv_ob_step_first_bill', noChecklists: 'prv_ob_no_checklists', summary: 'prv_ob_summary', noChecklist: 'prv_ob_no_checklist', complete: 'prv_ob_complete', state: 'prv_ob_state', heading: 'prv_ob_heading', footer: 'prv_ob_footer', noPending: 'prv_ob_no_pending' },
  packageHistory: { notRecordedPkg: 'prv_ph_not_recorded_pkg', priceNotRecorded: 'prv_ph_price_not_recorded', priceMonth: 'prv_ph_price_month', since: 'prv_ph_since', sinceNotRecorded: 'prv_ph_since_not_recorded', startNotRecorded: 'prv_ph_start_not_recorded', endNotRecorded: 'prv_ph_end_not_recorded', dates: 'prv_ph_dates', currentSuffix: 'prv_ph_current_suffix', unavailable: 'prv_ph_unavailable', noHistory: 'prv_ph_no_history', undatedOne: 'prv_ph_undated_one', undatedMany: 'prv_ph_undated_many', priceNotRecordedCap: 'prv_ph_price_not_recorded_cap', sinceCap: 'prv_ph_since_cap', sinceNotRecordedCap: 'prv_ph_since_not_recorded_cap', current: 'prv_ph_current', gap: 'prv_ph_gap', none: 'prv_ph_none', heading: 'prv_ph_heading', explainer: 'prv_ph_explainer' },
  crossPayments: { heading: 'prv_cp_heading', explainer: 'prv_cp_explainer', paidBy: 'prv_cp_paid_by', paidByRel: 'prv_cp_paid_by_rel' },
  wadaRecord: { noWadas: 'prv_wr_no_wadas', health: 'prv_wr_health', promisedBy: 'prv_wr_promised_by', keptOn: 'prv_wr_kept_on', keptLateOn: 'prv_wr_kept_late_on', broken: 'prv_wr_broken', overdueSuffix: 'prv_wr_overdue_suffix', overdueLabel: 'prv_wr_overdue_label', note: 'prv_wr_note', poora: 'prv_wr_poora', toota: 'prv_wr_toota', remove: 'prv_wr_remove' },
};
const labelsFrom = (dict, group) => Object.fromEntries(Object.entries(LABEL_PROPS[group]).map(([prop, key]) => [prop, dict[key]]));
const labelsEn = (group) => labelsFrom(en, group);
const labelsUr = (group) => labelsFrom(ur, group);

// Fixtures (shapes proven by the prep repro + the implementer's probe).
const fmt = (n) => `PKR ${n}`;
const customer = { id: 'c1', name: 'Ahmed', customerName: 'Ahmed', customerNumber: '1', packageSpeed: '15 Mbps', monthlySellingAmount: 3000, serviceStatus: 'active', addedOn: '2026-06-01', connectionDate: '2026-06-01', createdAt: '2026-06-01' };
const fbReady = buildFirstBillPreview({ customerId: 'c1', customerName: 'Ahmed', monthlyAmount: 3000, connectionFee: 5000, securityDeposit: 2000, startDate: '2026-11-01', firstPeriodMode: 'auto' });
const fbMissing = buildFirstBillPreview({ customerId: 'c1', customerName: 'Ahmed', startDate: '2026-11-01', firstPeriodMode: 'auto' });
const fbShown = { customerId: 'c1', shownAt: '2026-11-01' };
const pcReady = buildPackageChangePreview({ customerId: 'c1', customerName: 'Ahmed', currentPackage: '15 Mbps', currentPrice: 3000, proposedPackage: '29 Mbps', proposedPackageKey: 'pkg29', proposedPrice: 3999, priceHistory: [], billMonth: '2026-12', effectiveDate: '2026-12-01', mode: 'auto' });
const bcChoice = { customerId: 'c1', dueDay: 15, changedAt: '2026-11-01' };
const pchRecord = { customerId: 'c1', channel: 'cash' };
const qlOne = [{ id: 'q1', customerId: 'c1', date: '2026-11-01', downloadMbps: 14, uploadMbps: 5, location: 'Near router', note: '', linkedTicketId: '' }];
const obChecklist = buildOnboardingChecklist('c1', []);
const obEntry = buildOnboardingEntry(customer, []);
const phView = packageHistorySegmentsFor({ packageHistory: [{ date: '2026-09-01', oldPackage: '5 Mbps', newPackage: '15 Mbps', oldMonthlyRate: 2000, newMonthlyRate: 3000, staffName: 'Saad' }], currentPackageLabel: '15 Mbps', currentPackagePrice: 3000 });
const wdPending = { id: 'w1', customer: 'c1', promisedDate: '2026-11-20', amountPromised: 3000, note: 'on Friday', status: 'pending' };
const wdKept = { id: 'w2', customer: 'c1', promisedDate: '2026-11-10', amountPromised: 3000, note: '', status: 'kept', closedDate: '2026-11-10' };
const cpPayment = { id: 'p1', customerId: 'c2', customerName: 'Bilal', customerNumber: '2', amount: 1000, date: '2026-11-01', method: 'Cash', crossPayment: { payerName: 'Ahmed', payerCustomerId: 'c1', relationship: 'brother' } };
const sinNote = { id: 's1', customerId: 'c1', amountCents: 300000, dayOfMonth: 5, method: 'Cash', recordedBy: 'Saad' };

// ================= G1 — parity guard (this file's own pin) =================

test('G1: parity is the new total in both dicts', () => {
  assert.equal(Object.keys(en).length, 5222, 'EN parity');
  assert.equal(Object.keys(ur).length, 5222, 'UR parity');
  const prvEn = Object.keys(en).filter((k) => k.startsWith('prv_'));
  const prvUr = Object.keys(ur).filter((k) => k.startsWith('prv_'));
  // Plan 608 adds the 240th prv_ key (prv_wr_toast_past_date, the
  // past-date refusal toast) — the family count moves 239 -> 240.
  assert.equal(prvEn.length, 240, 'exactly the new prv_ keys in EN');
  assert.equal(prvUr.length, 240, 'exactly the new prv_ keys in UR');
});

// ================= G2 — the prv_ family is complete and clean =================

test('G2a: every prv_ key has a non-empty Urdu value', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('prv_'));
  for (const key of keys) {
    assert.equal(typeof ur[key], 'string', `${key} must exist in UR`);
    assert.ok(ur[key].length > 0, `${key} UR must not be empty`);
  }
});

test('G2b: every UR value differs from EN except the three documented exceptions', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('prv_'));
  for (const key of keys) {
    if (key === 'prv_wr_note' || key === 'prv_lc_package_detail' || key === 'prv_cp_paid_by_rel') {
      assert.equal(ur[key], en[key], `${key} is the documented EN == UR exception`);
    } else {
      assert.notEqual(ur[key], en[key], `${key} UR must differ from EN`);
    }
  }
});

test('G2c: no two prv_ keys share one English value', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('prv_'));
  const seen = new Map();
  for (const key of keys) {
    assert.ok(!seen.has(en[key]), `${key} duplicates the EN value of ${seen.get(en[key])}`);
    seen.set(en[key], key);
  }
});

test('G2d: no new key carries a money figure, and nav-language.js carries no Rs. token', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('prv_'));
  for (const key of keys) {
    // PKR as a bare currency token inside a {param} template is fine
    // (the figure arrives from the module at runtime); what D2 forbids
    // is a money FIGURE baked into a value, and any Rs token at all.
    assert.doesNotMatch(en[key], /Rs\./, `${key} EN must carry no Rs. token`);
    assert.doesNotMatch(ur[key], /Rs\./, `${key} UR must carry no Rs. token`);
    assert.doesNotMatch(en[key], /\bRs\s/, `${key} EN must not carry 'Rs ' (Sharafat 85)`);
    assert.doesNotMatch(en[key], /(?:PKR|Rs)\s*\d|\d[\d,]*\s*(?:PKR|Rs)/, `${key} EN must carry no money figure`);
    assert.doesNotMatch(ur[key], /(?:PKR|Rs)\s*\d|\d[\d,]*\s*(?:PKR|Rs)/, `${key} UR must carry no money figure`);
  }
  assert.doesNotMatch(navJs, /Rs\./, 'no Rs. token anywhere in nav-language.js (Sharafat 85)');
  assert.doesNotMatch(navJs, /\bRs\s/, "no 'Rs ' anywhere in nav-language.js (Sharafat 85)");
});

test('G2e: this file stays free of the previous-total and older-total literals', () => {
  assert.ok(!selfSrc.includes('51' + '61'), 'no bare previous-total literal in this file');
  assert.ok(!selfSrc.includes('51' + '45'), 'no bare older-total literal in this file');
});

// ================= G3 — every key is wired through t() in app.js =================

test('G3: all 240 keys reach the templates and helpers through t()', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('prv_'));
  assert.equal(keys.length, 240, 'the family to wire');
  for (const key of keys) {
    assert.ok(appJs.includes(`t('${key}'`), `app.js must pass t('${key}')`);
  }
  // The labels helpers exist and are the ones the templates call.
  for (const helper of ['firstBillPreviewLabels()', 'packageChangeLabels()', 'billingCycleLabels()', 'paymentChannelLabels()', 'qualityLogLabels()', 'lifecycleLabels()', 'onboardingLabels()', 'packageHistoryLabels()', 'crossPaymentsLabels()', 'wadaRecordLabels()']) {
    assert.ok(appJs.includes(helper), `app.js must define ${helper}`);
  }
});

// ================= G4 — defaults are byte-identical to the EN dict =================
// Each module called with no labels must render exactly what it renders
// with the EN labels object: that is the proof the keying changed no
// English string. (G5 proves the labels objects really take effect, so
// these equalities cannot pass vacuously through a bad property name.)

test('G4-first-bill: summary, Html and shown text are unchanged in English', () => {
  assert.equal(firstBillPreviewSummaryText(fbReady), firstBillPreviewSummaryText(fbReady, labelsEn('firstBill')));
  assert.equal(firstBillPreviewHtml(fbReady, fmt), firstBillPreviewHtml(fbReady, fmt, labelsEn('firstBill')));
  assert.equal(firstBillPreviewShownText(fbShown), firstBillPreviewShownText(fbShown, labelsEn('firstBill')));
  assert.equal(firstBillPreviewSummaryText(fbMissing), firstBillPreviewSummaryText(fbMissing, labelsEn('firstBill')));
  assert.equal(previewFromCustomer(customer, { startDate: '2026-11-01', firstPeriodMode: 'auto' }).status, 'ready');
});

test('G4a-first-bill: the ready summary names the period instead of "(undefined)"', () => {
  const text = firstBillPreviewSummaryText(fbReady);
  assert.ok(text.includes('(Full month)'), 'a 1st-of-month start reads as a full month');
  assert.ok(!text.includes('({note})') && !text.includes('(undefined)'), 'no placeholder or undefined leaks into the summary');
  assert.ok(text.includes('Ahmed') && text.includes('10000'), 'name and total still render');
});

test('G4-package-change: summary, note, Html and stored text are unchanged in English', () => {
  assert.equal(packageChangePreviewSummaryText(pcReady), packageChangePreviewSummaryText(pcReady, labelsEn('packageChange')));
  assert.equal(packageChangePreviewNote(pcReady), packageChangePreviewNote(pcReady, labelsEn('packageChange')));
  assert.equal(packageChangePreviewHtml(pcReady, fmt), packageChangePreviewHtml(pcReady, fmt, labelsEn('packageChange')));
  assert.equal(packageChangePreviewStoredText(pcReady), packageChangePreviewStoredText(pcReady, labelsEn('packageChange')));
  assert.ok(packageChangePreviewSummaryText(pcReady).includes('999'), 'the monthly difference still renders');
});

test('G4-billing-cycle: summary and Html are unchanged in English', () => {
  assert.equal(billingCycleChoiceSummaryText(bcChoice), billingCycleChoiceSummaryText(bcChoice, labelsEn('billingCycle')));
  assert.equal(billingCycleChoiceHtml(bcChoice), billingCycleChoiceHtml(bcChoice, labelsEn('billingCycle')));
  assert.equal(billingCycleChoiceSummaryText(null), billingCycleChoiceSummaryText(null, labelsEn('billingCycle')));
  assert.ok(billingCycleChoiceSummaryText(bcChoice).includes('15th'), 'the ordinal suffix still renders in English');
});

test('G4-payment-channel: summary and Html are unchanged in English', () => {
  assert.equal(paymentChannelSummaryText([pchRecord]), paymentChannelSummaryText([pchRecord], labelsEn('paymentChannel')));
  assert.equal(paymentChannelSummaryText([]), paymentChannelSummaryText([], labelsEn('paymentChannel')));
  assert.equal(paymentChannelHtml(pchRecord), paymentChannelHtml(pchRecord, labelsEn('paymentChannel')));
  assert.equal(paymentChannelHtml(null), paymentChannelHtml(null, labelsEn('paymentChannel')));
});

test('G4-quality-log: summary and Html are unchanged in English', () => {
  assert.equal(qualityLogSummaryText([], 15), qualityLogSummaryText([], 15, labelsEn('qualityLog')));
  assert.equal(qualityLogHtml([], 15), qualityLogHtml([], 15, labelsEn('qualityLog')));
  assert.equal(qualityLogSummaryText(qlOne, 15), qualityLogSummaryText(qlOne, 15, labelsEn('qualityLog')));
  assert.equal(qualityLogHtml(qlOne, 15), qualityLogHtml(qlOne, 15, labelsEn('qualityLog')));
  assert.equal(qualityLogSummaryText([], 15), 'No speed measurements recorded yet.');
});

test('G4-lifecycle: status, journey and Html are unchanged in English', () => {
  assert.deepEqual(resolveLifecycleStatus(customer), resolveLifecycleStatus(customer, labelsEn('lifecycle')));
  assert.deepEqual(buildLifecycleJourney(customer), buildLifecycleJourney(customer, labelsEn('lifecycle')));
  assert.equal(lifecycleJourneyHtml(buildLifecycleJourney(customer)), lifecycleJourneyHtml(buildLifecycleJourney(customer), labelsEn('lifecycle')));
  assert.equal(resolveLifecycleStatus(customer).key, 'active');
  // The archived branch exercises the disconnect-reason labels
  // internally (the label helpers are not exported).
  const archived = { ...customer, archived: true, disconnectReason: 'moved' };
  assert.equal(resolveLifecycleStatus(archived, labelsEn('lifecycle')).key, 'archived');
  assert.deepEqual(resolveLifecycleStatus(archived), resolveLifecycleStatus(archived, labelsEn('lifecycle')));
});

test('G4-onboarding: summary, checklist, pending list and step label are unchanged in English', () => {
  assert.equal(onboardingSummaryText([obChecklist]), onboardingSummaryText([obChecklist], labelsEn('onboarding')));
  assert.equal(onboardingChecklistHtml(obChecklist, 'Ahmed'), onboardingChecklistHtml(obChecklist, 'Ahmed', labelsEn('onboarding')));
  assert.equal(onboardingPendingHtml([obEntry]), onboardingPendingHtml([obEntry], labelsEn('onboarding')));
  assert.equal(onboardingStepLabel('enquiry'), onboardingStepLabel('enquiry', labelsEn('onboarding')));
  assert.equal(onboardingStepLabel('enquiry'), 'Enquiry');
});

test('G4-package-history: segment, view and section are unchanged in English', () => {
  assert.equal(packageHistorySegmentText(phView.segments[0], fmt), packageHistorySegmentText(phView.segments[0], fmt, labelsEn('packageHistory')));
  assert.equal(packageHistoryViewText(phView, fmt), packageHistoryViewText(phView, fmt, labelsEn('packageHistory')));
  assert.equal(packageHistoryViewSectionHtml(customer, { label: '15 Mbps', price: 3000 }, fmt), packageHistoryViewSectionHtml(customer, { label: '15 Mbps', price: 3000 }, fmt, labelsEn('packageHistory')));
});

test('G4-wada: health, record, banner and history are unchanged in English', () => {
  assert.equal(wadaHealthText([wdPending], 'c1'), wadaHealthText([wdPending], 'c1', labelsEn('wadaRecord')));
  assert.equal(wadaRecordText(wdPending, '2026-11-19'), wadaRecordText(wdPending, '2026-11-19', labelsEn('wadaRecord')));
  assert.equal(wadaRecordHtml(wdPending, '2026-11-19'), wadaRecordHtml(wdPending, '2026-11-19', labelsEn('wadaRecord')));
  assert.equal(wadaBannerHtml([wdPending], '2026-11-19'), wadaBannerHtml([wdPending], '2026-11-19', labelsEn('wadaRecord')));
  assert.equal(wadaHistoryHtml([wdKept], '2026-11-19'), wadaHistoryHtml([wdKept], '2026-11-19', labelsEn('wadaRecord')));
});

test('G4-cross-payments: line, markup and section are unchanged in English', () => {
  const note = crossPaymentNoteOf(cpPayment);
  assert.equal(crossPaymentNoteLineText(note), crossPaymentNoteLineText(note, labelsEn('crossPayments')));
  assert.equal(crossPaymentNoteMarkup(cpPayment), crossPaymentNoteMarkup(cpPayment, labelsEn('crossPayments')));
  assert.equal(crossPaymentsMadeSectionHtml(customer, [cpPayment], fmt), crossPaymentsMadeSectionHtml(customer, [cpPayment], fmt, labelsEn('crossPayments')));
  assert.equal(crossPaymentNoteLineText(note), 'Paid by Ahmed (brother)');
});

test('G4-notes: the five explainers and the standing-instruction line are unchanged in English', () => {
  assert.equal(handlingNoteSectionHtml(customer, []), handlingNoteSectionHtml(customer, [], { explainer: en.prv_note_handling_explainer }));
  assert.equal(spokenLanguageNoteSectionHtml(customer, []), spokenLanguageNoteSectionHtml(customer, [], { explainer: en.prv_note_spoken_explainer }));
  assert.equal(gateAccessInstructionSectionHtml(customer, []), gateAccessInstructionSectionHtml(customer, [], { explainer: en.prv_note_gate_explainer }));
  assert.equal(customerEmergencyContactSectionHtml(customer, []), customerEmergencyContactSectionHtml(customer, [], { explainer: en.prv_note_emc_explainer }));
  assert.equal(standingInstructionSectionHtml(customer, []), standingInstructionSectionHtml(customer, [], { explainer: en.prv_note_sin_explainer, line: en.prv_note_sin_line, byMethod: en.prv_note_sin_by_method }));
  // The standing-instruction line keeps its older word-level fallback:
  // without the sentence template it still reads the same sentence.
  assert.equal(standingInstructionLineText(sinNote), 'Usually pays PKR 3,000 on the 5th by Cash');
  assert.equal(standingInstructionLineText(sinNote, { line: en.prv_note_sin_line, byMethod: en.prv_note_sin_by_method }), 'Usually pays PKR 3,000 on the 5th by Cash');
});

// ================= G5 — Urdu labels really switch the rendering =================

test('G5: Urdu labels change every surface (so G4 cannot pass vacuously)', () => {
  const pairs = [
    ['first-bill', firstBillPreviewSummaryText(fbReady, labelsEn('firstBill')), firstBillPreviewSummaryText(fbReady, labelsUr('firstBill'))],
    ['package-change', packageChangePreviewSummaryText(pcReady, labelsEn('packageChange')), packageChangePreviewSummaryText(pcReady, labelsUr('packageChange'))],
    ['billing-cycle', billingCycleChoiceSummaryText(bcChoice, labelsEn('billingCycle')), billingCycleChoiceSummaryText(bcChoice, labelsUr('billingCycle'))],
    ['payment-channel', paymentChannelSummaryText([pchRecord], labelsEn('paymentChannel')), paymentChannelSummaryText([pchRecord], labelsUr('paymentChannel'))],
    ['quality-log', qualityLogSummaryText([], 15, labelsEn('qualityLog')), qualityLogSummaryText([], 15, labelsUr('qualityLog'))],
    ['lifecycle', lifecycleJourneyHtml(buildLifecycleJourney(customer), labelsEn('lifecycle')), lifecycleJourneyHtml(buildLifecycleJourney(customer), labelsUr('lifecycle'))],
    ['onboarding', onboardingSummaryText([obChecklist], labelsEn('onboarding')), onboardingSummaryText([obChecklist], labelsUr('onboarding'))],
    ['package-history', packageHistoryViewText(phView, fmt, labelsEn('packageHistory')), packageHistoryViewText(phView, fmt, labelsUr('packageHistory'))],
    ['wada', wadaHealthText([wdPending], 'c1', labelsEn('wadaRecord')), wadaHealthText([wdPending], 'c1', labelsUr('wadaRecord'))],
    ['cross-payments', crossPaymentNoteLineText(crossPaymentNoteOf(cpPayment), labelsEn('crossPayments')), crossPaymentNoteLineText(crossPaymentNoteOf(cpPayment), labelsUr('crossPayments'))],
  ];
  for (const [name, enText, urText] of pairs) {
    assert.notEqual(urText, enText, `${name} must render differently in Urdu`);
    assert.ok(!/Due on the|First bill preview|Package change preview|No speed measurements|Paid by/.test(urText), `${name} Urdu output must carry no English chrome`);
  }
  // The Urdu billing-cycle summary takes the bare day (no 'th' suffix).
  assert.ok(!billingCycleChoiceSummaryText(bcChoice, labelsUr('billingCycle')).includes('15th'), 'Urdu takes the bare day, never the English ordinal');
  assert.ok(billingCycleChoiceSummaryText(bcChoice, labelsUr('billingCycle')).includes('15'), 'the day itself still renders');
  // The note explainers switch too.
  const handlingUr = handlingNoteSectionHtml(customer, [], { explainer: ur.prv_note_handling_explainer });
  assert.ok(handlingUr.includes(ur.prv_note_handling_explainer), 'the handling explainer renders in Urdu');
  assert.ok(!handlingUr.includes(en.prv_note_handling_explainer), 'the English explainer is gone in Urdu');
});

// ================= G6 — out of scope stays exactly as it was =================

test('G6a: the payment-channel draft lines are untouched (Roman + Urdu)', () => {
  assert.equal(paymentChannelInstructions('cash', 'roman').text, 'Payment method: Cash — pay the collector, who will give you a receipt.');
  assert.equal(paymentChannelInstructions('wallet', 'roman').text, 'Payment method: Easypaisa/wallet — please pay by wallet and note your name as the payment reference.');
  assert.equal(paymentChannelInstructions('cash', 'urdu').text, 'ادائیگی کا طریقہ: نقد — کلیکٹر سے ادائیگی کریں، وہ رسید دیں گے۔');
  assert.equal(paymentChannelInstructions('wallet', 'urdu').text, 'ادائیگی کا طریقہ: ایزی پیسہ/والیٹ — ادائیگی کریں اور اپنا نام بطور ریفرنس نوٹ کریں۔');
  assert.equal(paymentChannelInstructions(null, 'roman').text, 'Payment method: you can pay in cash through the collector or by Easypaisa/wallet.');
});

test('G6b: onboarding step labels stay canonical English, and the CSV keeps them', () => {
  assert.deepEqual(ONBOARDING_STEPS.map((s) => s.label), ['Enquiry', 'Survey / feasibility', 'Cable laid', 'Device installed', 'Credentials issued', 'Service activated', 'First bill raised']);
  assert.equal(onboardingStepLabel('enquiry', labelsUr('onboarding')), ur.prv_ob_step_enquiry, 'the Html label is keyed, the const is not');
  const csv = onboardingChecklistCsv([obEntry]);
  assert.ok(csv.includes('Enquiry') && csv.includes('Survey / feasibility'), 'the CSV keeps the canonical English labels');
  assert.ok(!csv.includes(ur.prv_ob_step_enquiry), 'the CSV never carries the Urdu label');
});

// ================= G7 — modules stay import-free =================

test('G7: none of the fifteen modules imports t() or nav-language.js', () => {
  const modules = ['first-bill-preview.js', 'package-change-preview.js', 'billing-cycle-choice.js', 'payment-channel.js', 'quality-log.js', 'lifecycle-journey.js', 'onboarding-checklist.js', 'package-history-view.js', 'wada-record.js', 'cross-payment-note.js', 'handling-note.js', 'standing-instruction-note.js', 'spoken-language-note.js', 'gate-access-instruction.js', 'customer-emergency-contact.js'];
  for (const name of modules) {
    const src = read(name);
    assert.doesNotMatch(src, /from\s+['"]\.\.?\/nav-language/, `${name} must never import nav-language.js`);
    assert.doesNotMatch(src, /import\s*\{[^}]*\bt\b[^}]*\}/, `${name} must never import t`);
    // Strip comments, then no real t('...') call may remain: the only
    // t(' hits in these files are // comments naming the keys and
    // .split('-') calls, neither of which is a translation call.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /(?<![A-Za-z_$])t\(['"]/, `${name} must never call t()`);
  }
});

// ================= G8 — the Rs 0 resolution =================

test('G8: the first-bill Rs 0 strings stay out of the dict and render at runtime', () => {
  for (const key of ['prv_fb_fee_assumption', 'prv_fb_fee_not_recorded', 'prv_fb_deposit_not_recorded']) {
    assert.ok(en[key].includes('{amount}'), `${key} is an {amount} template, not a verbatim Rs 0 string`);
    assert.ok(!en[key].includes('Rs'), `${key} carries no Rs token`);
  }
  // The missing-fee preview renders the assumption with Rs 0 supplied
  // by the module, so the English output is byte-identical to the base.
  assert.ok(firstBillPreviewSummaryText(fbMissing).includes('monthly-price-missing'), 'the incomplete reason still renders');
  const noFee = buildFirstBillPreview({ customerId: 'c1', customerName: 'Ahmed', monthlyAmount: 3000, startDate: '2026-11-01', firstPeriodMode: 'auto' });
  assert.ok(firstBillPreviewHtml(noFee, fmt, labelsEn('firstBill')).includes('counted as Rs 0'), 'the assumption renders Rs 0 at runtime');
  assert.ok(!navJs.includes('Rs 0'), 'no Rs 0 literal anywhere in nav-language.js');
});

// ================= G9 — the English literals really left app.js =================

test('G9: the keyed template literals no longer appear in app.js', () => {
  // Every one of these was a hardcoded English string in a 601 template
  // or handler on the base; each now rides a t() call (G3) instead.
  // 'Note (optional)' is deliberately NOT here: another profile form
  // still carries that literal, out of 601's scope.
  for (const literal of ['Promised date', 'Amount promised (Rs, optional)', 'Proposed package', 'Effective date', 'Next bill month', 'Measurement recorded.', 'Could not record: check the date', 'No speed measurements recorded yet', 'Preview incomplete', 'When a customer says', 'First bill preview', 'Quality log']) {
    assert.ok(!appJs.includes(literal), `app.js must no longer hardcode ${JSON.stringify(literal)}`);
  }
  // The Waada banner chips still switch on their English data values —
  // those are identifiers, not rendered text (the rendered chip text
  // is keyed, G3). The template must carry the keyed chip labels.
  for (const key of ['prv_wd_chip_29', 'prv_wd_chip_30', 'prv_wd_chip_31']) {
    assert.ok(appJs.includes(`t('${key}')`), `app.js must pass t('${key}')`);
  }
  // The quality-log option values stay canonical ('Near router' /
  // 'Far room') because they are stored data, never display text —
  // the displayed option labels are keyed (G3).
  assert.ok(appJs.includes(`t('prv_ql_near_router')`) || appJs.includes(`t('prv_ql_loc_near')`), 'the near-router option label is keyed');
});

// No real customer names or phone numbers in this test (PII ratchet:
// 'Ahmed'/'Bilal'/'Saad' are the generic fixtures the repo already uses).
