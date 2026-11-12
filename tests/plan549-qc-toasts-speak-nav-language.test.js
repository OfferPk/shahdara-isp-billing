/**
 * plan549-qc-toasts-speak-nav-language.test.js — Plan 549 of the
 * Plans 491–600 polish programme (record-payment batch, 521–550).
 *
 * The operator's case: the Quick Collect flow already localised most
 * messages through t() with en/ur keys, but a long tail of toasts was
 * hardcoded English in nav-quick-collect.js — concession
 * applied/removed, "Payment … saved" on close, second-connection
 * errors, "Area updated to …", undo confirmations/failures,
 * large-cash, leg-2 duplicate, "Payment … recorded", and the
 * share/print results. With the app's Roman Urdu preference, these
 * are the messages most likely to be read by the operator — and they
 * were the ones with no Urdu version.
 *
 * Pins:
 *  - dictionary: every new qc_toast_ key exists in BOTH en and ur,
 *    defined exactly once per dict block, the en value is
 *    byte-identical to the pre-change literal, every ur value carries
 *    Urdu script, and the en/ur param sets agree;
 *  - reused keys: the four qundo_/qcpkg_ keys this plan reuses keep
 *    their values — the undo success/failure strings and the
 *    'Payment recorded' / 'Undone' titles and the 'Undo' action
 *    label were already keyed for the app.js undo presenter;
 *  - source: no hardcoded literal remains at any listed toast site
 *    (message, title or action label), and every listed site now
 *    calls t() with its key;
 *  - behaviour: representative toasts render from t() in BOTH
 *    language settings through the real controller — recorded,
 *    large-cash, undo, saved-on-close, second-connection invalid
 *    amount, no-receipt-to-print, receipt-image-unsupported — with
 *    the English text byte-identical to before and the Urdu text the
 *    new dictionary value;
 *  - boundaries (deliberately untouched): the leg-2 duplicate CARD
 *    message is inline, not a toast; the Plan 547 inline errors and
 *    the Plan 543/296 TID-guard toast fallback are not toasts;
 *    err.message passthroughs stay as they are; the 'Customer not
 *    found.' throw in the customer lookup is an Error, not a toast.
 *
 * Harness: the Plan 547 controller harness (mock DOM), with a
 * working localStorage store so the language can be set per test
 * through LANGUAGE_STORAGE_KEY. Synthetic data only — no real
 * customer names, no realistic phone numbers (pattern-fake digits
 * only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations,
  saveBillMonth
} from '../core.js';
import {
  getPakistanLocalDate, setupQuickCollectModal
} from '../nav-quick-collect.js';
import {
  TRANSLATIONS, t, URDU_SCRIPT_PATTERN, LANGUAGE_STORAGE_KEY
} from '../nav-language.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const navSrc = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');

const now = new Date();
const today = getPakistanLocalDate(now);
const month = today.slice(0, 7);

/** [key, exact pre-change English, new Urdu] — en is byte-identical to the literal it replaces. */
const NEW_KEYS = [
  ['qc_toast_concession_applied', 'Outage concession of PKR {amount} applied to bill {month}.', 'بل {month} پر PKR {amount} کی بندش رعایت لاگو ہو گئی۔'],
  ['qc_toast_concession_removed', 'Outage concession removed from bill {month}.', 'بل {month} سے بندش رعایت ہٹا دی گئی۔'],
  ['qc_toast_payment_saved', 'Payment of PKR {amount} for {name} saved.', '{name} کی PKR {amount} ادائیگی محفوظ ہو گئی۔'],
  ['qc_toast_payment_saved_title', 'Payment saved', 'ادائیگی محفوظ ہو گئی'],
  ['qc_toast_second_invalid_amount', 'Enter a valid amount greater than zero for the second connection.', 'دوسرے کنکشن کے لیے صفر سے زیادہ درست رقم درج کریں۔'],
  ['qc_toast_second_customer_missing', 'Customer not found.', 'کسٹمر نہیں ملا۔'],
  ['qc_toast_second_first_gone', 'The first payment is no longer recorded, so the second connection cannot be recorded after it.', 'پہلی ادائیگی اب درج نہیں ہے، اس لیے اس کے بعد دوسرے کنکشن کی ادائیگی درج نہیں ہو سکتی۔'],
  ['qc_toast_second_recorded', 'Second payment of PKR {amount} recorded for {name}{total}.', 'دوسرے کنکشن کی PKR {amount} ادائیگی {name} کے لیے درج ہو گئی{total}۔'],
  ['qc_toast_second_recorded_total', ' — total paid this visit PKR {total}', ' — اس ملاقات میں کل ادا شدہ PKR {total}'],
  ['qc_toast_second_recorded_title', 'Second payment recorded', 'دوسری ادائیگی درج ہو گئی'],
  ['qc_toast_area_updated', 'Area updated to {area}.', 'علاقہ {area} کر دیا گیا۔'],
  ['qc_toast_area_updated_title', 'Area updated', 'علاقہ اپ ڈیٹ ہو گیا'],
  ['qc_toast_area_update_failed', 'Area could not be updated.', 'علاقہ اپ ڈیٹ نہیں ہو سکا۔'],
  ['qc_toast_undone_by_reversal', 'Payment of PKR {amount} for {name} undone by reversal. The original stays visible with its reversal.', '{name} کی PKR {amount} ادائیگی واپسی (ریورسل) سے واپس ہو گئی۔ اصل ادائیگی اپنی واپسی کے ساتھ نظر آتی رہے گی۔'],
  ['qc_toast_reversal_window_passed', 'The sixty-second undo window has passed. Use the correction flow to fix this payment.', 'ساٹھ سیکنڈ کی واپسی کی مہلت گزر چکی ہے۔ اس ادائیگی کو ٹھیک کرنے کے لیے درستگی (کریکشن) کا طریقہ استعمال کریں۔'],
  ['qc_toast_reversal_original_missing', 'Could not undo payment: the original payment was not found.', 'ادائیگی واپس نہیں ہو سکی: اصل ادائیگی نہیں ملی۔'],
  ['qc_toast_reversal_not_reversible', 'Could not undo payment: the original payment cannot be reversed.', 'ادائیگی واپس نہیں ہو سکی: اصل ادائیگی واپس نہیں ہو سکتی۔'],
  ['qc_toast_large_cash_approval', 'Large cash payments need the owner\'s approval recorded — enter the approver\'s name.', 'بڑی نقد ادائیگیوں کے لیے مالک کی منظوری درج ہونا ضروری ہے — منظوری دینے والے کا نام درج کریں۔'],
  ['qc_toast_leg2_duplicate', 'Leg 2 Transaction ID "{txn}" was already recorded on {date} for {name} (#{number}). Give leg 2 its own Transaction ID.', 'دوسرے حصے کا ٹرانزیکشن آئی ڈی "{txn}" پہلے ہی {date} کو {name} (#{number}) کے لیے درج ہو چکا ہے۔ دوسرے حصے کو اپنا ٹرانزیکشن آئی ڈی دیں۔'],
  ['qc_toast_payment_recorded', 'Payment of PKR {amount} recorded.', 'PKR {amount} کی ادائیگی درج ہو گئی۔'],
  ['qc_toast_whatsapp_draft_opened', 'WhatsApp receipt draft opened.', 'واٹس ایپ رسید کا مسودہ کھل گیا۔'],
  ['qc_toast_receipt_image_unsupported', 'Receipt image creation is not supported in this environment.', 'اس ماحول میں رسید کی تصویر بنانا ممکن نہیں ہے۔'],
  ['qc_toast_receipt_image_ready', 'Receipt image ready (downloaded / shared).', 'رسید کی تصویر تیار ہے (ڈاؤن لوڈ / شیئر ہو گئی)۔'],
  ['qc_toast_share_failed', 'Share failed: {error}', 'شیئر ناکام رہا: {error}'],
  ['qc_toast_no_receipt_to_print', 'No receipt to print yet.', 'ابھی چھاپنے کے لیے کوئی رسید نہیں ہے۔'],
  ['qc_toast_bluetooth_sent', 'Receipt sent to the Bluetooth printer.', 'رسید بلوٹوتھ پرنٹر پر بھیج دی گئی۔'],
  ['qc_toast_bluetooth_failed', 'Bluetooth print failed: {error}', 'بلوٹوتھ پرنٹ ناکام رہا: {error}'],
  ['qc_toast_no_phone_clipboard', 'No phone saved for this customer. The receipt text was copied to the clipboard instead.', 'اس کسٹمر کا فون نمبر محفوظ نہیں ہے۔ رسید کا متن کلپ بورڈ پر کاپی کر دیا گیا ہے۔'],
  ['qc_toast_no_phone', 'No phone number saved for this customer.', 'اس کسٹمر کا فون نمبر محفوظ نہیں ہے۔'],
  ['qc_toast_no_phone_title', 'No phone number', 'فون نمبر نہیں ہے'],
  ['qc_toast_add_phone', 'Add phone', 'فون شامل کریں'],
  // QC receipt-modal overhaul: the draft accordion's Copy Text toasts.
  ['qc_toast_draft_copied', 'Draft copied — paste it anywhere.', 'مسودہ کاپی ہو گیا — کہیں بھی پیسٹ کریں۔'],
  ['qc_toast_draft_copy_failed', 'Could not copy the draft — open the preview and copy it manually.', 'مسودہ کاپی نہیں ہو سکا — پیش نظارہ کھول کر دستی کاپی کریں۔'],
];

function paramsOf(text) {
  return [...(text.match(/\{(\w+)\}/g) || [])].map((p) => p.slice(1, -1)).sort();
}

function dictBlock(src, lang) {
  const start = src.indexOf(`  ${lang}: {`);
  const end = src.indexOf('\n};', start);
  return src.slice(start, end);
}

test('plan 549 dictionary: every new qc_toast_ key exists in en and ur, defined once, en byte-identical, ur carries Urdu script, params agree', () => {
  assert.equal(NEW_KEYS.length, 33, 'the plan covers 31 new keys + 2 draft-copy keys (QC receipt-modal overhaul)');
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('qc_toast_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('qc_toast_')).sort();
  assert.deepEqual(enKeys, NEW_KEYS.map(([k]) => k).sort(), 'en carries exactly the new qc_toast_ keys');
  assert.deepEqual(urKeys, enKeys, 'ur carries exactly the en qc_toast_ keys');
  for (const block of [dictBlock(navSrc, 'en'), dictBlock(navSrc, 'ur')]) {
    for (const [key] of NEW_KEYS) {
      const occurrences = (block.match(new RegExp(`^\\s*${key}:`, 'm')) || []).length;
      assert.equal(occurrences, 1, `${key}: must be defined exactly once per dict block`);
    }
  }
  for (const [key, en, ur] of NEW_KEYS) {
    assert.equal(TRANSLATIONS.en[key], en, `${key}: en must be byte-identical to the pre-change literal`);
    assert.equal(TRANSLATIONS.ur[key], ur, `${key}: ur value pinned`);
    assert.ok(URDU_SCRIPT_PATTERN.test(TRANSLATIONS.ur[key]), `${key}: ur value must carry Urdu script`);
    assert.deepEqual(paramsOf(TRANSLATIONS.ur[key]), paramsOf(TRANSLATIONS.en[key]), `${key}: en/ur params must agree`);
    assert.equal(t(key, 'en'), en, `${key}: t() resolves the English value`);
  }
});

test('plan 549 dictionary: the reused qundo_/qcpkg_ keys keep their values', () => {
  assert.equal(t('qundo_title', 'en'), 'Payment recorded');
  assert.equal(t('qundo_title', 'ur'), 'ادائیگی درج ہو گئی');
  assert.equal(t('qundo_undone_title', 'en'), 'Undone');
  assert.equal(t('qundo_undone_title', 'ur'), 'واپس ہو گیا');
  assert.equal(
    t('qundo_undone', 'en', { amount: 'PKR 1,000', name: 'Plan549 Tester' }),
    'Payment of PKR 1,000 for Plan549 Tester undone. Ledger restored.'
  );
  assert.equal(
    t('qundo_undone', 'ur', { amount: 'PKR 1,000', name: 'Plan549 Tester' }),
    'Plan549 Tester کی PKR 1,000 ادائیگی واپس ہو گئی۔ کھاتہ بحال ہو گیا۔'
  );
  assert.equal(t('qundo_failed', 'en', { error: 'boom' }), 'Could not undo payment: boom');
  assert.equal(t('qundo_failed', 'ur', { error: 'boom' }), 'ادائیگی واپس نہیں ہو سکی: boom');
  assert.equal(t('qcpkg_undo', 'en'), 'Undo');
  assert.equal(t('qcpkg_undo', 'ur'), 'واپس کریں');
});

/** Fragments of the old hardcoded calls — none may remain in nav-quick-collect.js. */
const GONE = [
  'onToast(`Outage concession of PKR ',
  'onToast(`Outage concession removed from bill ',
  'onToast(`Payment of PKR ${pendingUndo.amount.toLocaleString()} for ${pendingUndo.customerName} saved.`',
  "onToast('Enter a valid amount greater than zero for the second connection.'",
  "onToast('Customer not found.'",
  "onToast('The first payment is no longer recorded",
  'Second payment of PKR ${amountVal.toLocaleString',
  'onToast(`Area updated to ',
  "|| 'Area could not be updated.'",
  'onToast(`Payment of PKR ${amount.toLocaleString()} for ${customerName} undone. Ledger restored.`',
  'onToast(`Could not undo payment: ${err.message}`',
  "onToast('The sixty-second undo window has passed.",
  "onToast('Could not undo payment: the original payment was not found.'",
  "onToast('Could not undo payment: the original payment cannot be reversed.'",
  'undone by reversal. The original stays visible with its reversal.',
  "onToast('Large cash payments need the owner",
  'onToast(`Leg 2 Transaction ID ',
  'onToast(`Payment of PKR ${amountVal.toLocaleString()} recorded.`',
  "onToast('WhatsApp receipt draft opened.'",
  "warnNoPhone('No phone saved for this customer.",
  "warnNoPhone('No phone number saved for this customer.'",
  "onToast('Receipt image creation is not supported",
  "onToast('Receipt image ready (downloaded / shared).'",
  'onToast(`Share failed: ',
  "onToast('No receipt to print yet.'",
  "onToast('Receipt sent to the Bluetooth printer.'",
  'onToast(`Bluetooth print failed: ',
  "title: 'Payment saved'",
  "title: 'Second payment recorded'",
  "title: 'Area updated'",
  "title: 'Undone'",
  "title: 'Payment recorded'",
  "actionLabel: 'Undo'",
  "title: 'No phone number'",
  "opts.actionLabel = 'Add phone'",
];

/** The t() call each listed site must now use. */
const PRESENT = [
  "onToast(t('qc_toast_concession_applied'",
  "onToast(t('qc_toast_concession_removed'",
  "onToast(t('qc_toast_payment_saved'",
  "title: t('qc_toast_payment_saved_title')",
  "onToast(t('qc_toast_second_invalid_amount'",
  "onToast(t('qc_toast_second_customer_missing'",
  "onToast(t('qc_toast_second_first_gone'",
  "t('qc_toast_second_recorded'",
  "t('qc_toast_second_recorded_total'",
  "title: t('qc_toast_second_recorded_title')",
  "onToast(t('qc_toast_area_updated'",
  "title: t('qc_toast_area_updated_title')",
  "t('qc_toast_area_update_failed')",
  "onToast(t('qc_toast_undone_by_reversal'",
  "onToast(t('qc_toast_reversal_window_passed'",
  "onToast(t('qc_toast_reversal_original_missing'",
  "onToast(t('qc_toast_reversal_not_reversible'",
  "onToast(t('qc_toast_large_cash_approval'",
  "onToast(t('qc_toast_leg2_duplicate'",
  "onToast(t('qc_toast_payment_recorded'",
  "onToast(t('qc_toast_whatsapp_draft_opened'",
  "onToast(t('qc_toast_receipt_image_unsupported'",
  "onToast(t('qc_toast_receipt_image_ready'",
  "onToast(t('qc_toast_share_failed'",
  "onToast(t('qc_toast_no_receipt_to_print'",
  "onToast(t('qc_toast_bluetooth_sent'",
  "onToast(t('qc_toast_bluetooth_failed'",
  "t('qc_toast_no_phone_clipboard')",
  "t('qc_toast_no_phone')",
  "title: t('qc_toast_no_phone_title')",
  "t('qc_toast_add_phone')",
  "onToast(t('qundo_undone'",
  "onToast(t('qundo_failed'",
  "title: t('qundo_undone_title')",
  "title: t('qundo_title')",
  "actionLabel: t('qcpkg_undo')",
];

test('plan 549 wiring: no hardcoded literal remains at any listed toast site', () => {
  for (const fragment of GONE) {
    assert.ok(!wiringSrc.includes(fragment), `hardcoded fragment must be gone: ${fragment}`);
  }
});

test('plan 549 wiring: every listed site calls t() with its key, and the out-of-scope neighbours are untouched', () => {
  for (const fragment of PRESENT) {
    assert.ok(wiringSrc.includes(fragment), `missing t() call: ${fragment}`);
  }
  // The leg-2 duplicate CARD message is inline, not a toast — its
  // wording is a different surface and stays exactly as it was.
  assert.ok(wiringSrc.includes('leg2DupMsg.textContent = `Transaction ID'), 'leg-2 duplicate card message untouched');
  // The Plan 547 inline errors and the Plan 543/296 TID-guard toast
  // fallback are not toasts and are out of scope.
  assert.ok(wiringSrc.includes("showQuickCollectFieldError(dateInput, 'quickCollectDateError'"), 'Plan 547 date error untouched');
  assert.ok(wiringSrc.includes("showQuickCollectFieldError(amountInput, 'quickCollectAmountError'"), 'Plan 547 amount error untouched');
  assert.ok(wiringSrc.includes('onToast(txnMsg'), 'TID-guard toast fallback untouched');
  // Generic error passthroughs stay as they are — there is no
  // hardcoded string to localise in them.
  assert.ok(wiringSrc.includes('onToast(err.message)'), 'err.message passthroughs untouched');
  // The 'Customer not found.' throw in the customer lookup is an
  // Error, not a toast.
  assert.ok(wiringSrc.includes("throw new Error('Customer not found.');"), 'customer-lookup throw untouched');
  // No new hex, no new store key, no new element-id prefix.
  assert.ok(!wiringSrc.includes('shahdara_plan549'), 'no new store key');
});

/** One synthetic customer on the PKR 1,000 package, billed this month. */
function plan549State() {
  let state = createInitialState(['Plan549 Tester']);
  // The package is 600 and the bill is hand-priced at 1,000: the
  // partial payment (600) equals the package, so the auto-package
  // follow is a no-op (current fee === taken fee) and the bill keeps
  // its price — a 400 remainder survives, so the second-connection
  // step is still offered. A direct single collection that moved the
  // package would reprice the bill and leave no remainder (user
  // decision 2026-11-12), and the second-connection step would not
  // appear.
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 600
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  state = saveBillMonth(state, 'seed-001', { month, dueAmount: 1000, status: 'pending' }, now);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due');
  return state;
}

/** Plan 549 controller harness: the Plan 547 mock DOM, with a working localStorage store so the language is settable per test. */
function plan549Controller(initialState, lang = 'en') {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const classes = new Set();
    const el = {
      tagName: tag.toUpperCase(), textContent: '', innerHTML: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      classList: {
        toggle: (name, force) => {
          const on = force === undefined ? !classes.has(name) : !!force;
          if (on) classes.add(name); else classes.delete(name);
          return on;
        },
        add: (name) => classes.add(name),
        remove: (name) => classes.remove(name),
        contains: (name) => classes.has(name),
      },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      hasAttribute: () => false,
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      dispatchEvent: (evt) => {
        for (const h of (listeners[evt.type] || [])) h({ type: evt.type, target: el, preventDefault: () => {}, ...evt });
        return true;
      },
      click: async () => el.dispatch('click'),
      querySelector: () => null,
      querySelectorAll: () => [],
      closest: () => null,
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      insertAdjacentElement: (position, other) => { el.insertedAfter = { position, element: other }; return other; },
      before: () => {},
      after: () => {},
      scrollIntoView: (...args) => { el.scrolledIntoView = args; },
      focus: () => { el.focused = true; },
      select: () => {},
      showModal: () => { el.opened = true; el.open = true; },
      close: () => { el.open = false; },
      focused: false,
      insertedAfter: null,
      scrolledIntoView: null,
      opened: false,
      open: false
    };
    let idValue = String(id ?? '');
    Object.defineProperty(el, 'id', {
      get: () => idValue,
      set: (v) => { idValue = String(v ?? ''); if (idValue) registry.set(idValue, el); },
      enumerable: true, configurable: true
    });
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };

  // Every id the setup reads is pre-created here (the full
  // getElementById list from nav-quick-collect.js), EXCEPT the three
  // dynamically created inline errors — quickCollectTxnError (TID
  // guard) and quickCollectAmountError / quickCollectDateError (Plan
  // 547) — which must be absent until their guard creates them.
  // QC receipt-modal overhaul: qcSettleStatusBadge, quickCollectAnotherBtn,
  // rptRepeatPayment and snsSuccessNextSteps were removed from the success
  // step — the mock must not conjure elements the real DOM no longer has.
  const SETUP_IDS = ['bncBigNameConfirm', 'bwbOtherMethodBtn', 'closeQuickCollectModalBtn', 'customersView', 'dtpDailyTargetProgress', 'edsEndOfDaySummary', 'edsEndOfDaySummaryButton', 'kpdAmountKeypad', 'lfdLastFourList', 'mhfMohallaFilter', 'mhfMohallaFilterSummary', 'ncaNewCustomerButton', 'ncaQuickAddForm', 'nplNamePrefixList', 'osbOfflineSavedBadge', 'pcfPendingClearanceFlag', 'pcfSuccessPendingClearanceFlag', 'quickCollectAdvanceCheckbox', 'quickCollectAdvanceTargetMonth', 'quickCollectAllCount', 'quickCollectAmountInput', 'quickCollectAmountWordsLine', 'quickCollectBackToPickBtn', 'quickCollectBluetoothPrintBtn', 'quickCollectCashChangeBox', 'quickCollectCashChangeLine', 'quickCollectCashReceivedInput', 'quickCollectCategoryTagSelect', 'quickCollectCollectedByInput', 'quickCollectCollectionMohallaInput', 'quickCollectCollectionPlaceSelect', 'quickCollectConcessionBox', 'quickCollectConfirmBackBtn', 'quickCollectConfirmBtn', 'quickCollectConfirmSaveBtn', 'quickCollectConfirmSummary', 'quickCollectContributorField', 'quickCollectContributorSelect', 'quickCollectCrossPayerNameInput', 'quickCollectCrossPayerSelect', 'quickCollectCrossRelationshipInput', 'quickCollectCustomerHeader', 'quickCollectCustomerList', 'quickCollectDailyEntrySummary', 'quickCollectDateInput', 'quickCollectDigitalFields', 'quickCollectDoneCloseBtn', 'quickCollectDueAmountVal', 'quickCollectDuesCount', 'quickCollectDuplicateCancelBtn', 'quickCollectDuplicateMsg', 'quickCollectDuplicateProceedBtn', 'quickCollectDuplicateReasonInput', 'quickCollectDuplicateWarning', 'quickCollectExcessCashPurposeSelect', 'quickCollectGoToTransactionsBtn', 'quickCollectHandlingNoteBox', 'quickCollectHighDuesCount', 'quickCollectLargeCashApprover', 'quickCollectLargeCashThreshold', 'quickCollectLateFeeWaiverBox', 'quickCollectLooseChangeChips', 'quickCollectMethodSelect', 'quickCollectModal', 'quickCollectMonthSelect', 'quickCollectMoreOptions', 'quickCollectNextReceiptLine', 'quickCollectOpenOneScreenBtn', 'quickCollectOverpaymentChoice', 'quickCollectOverpaymentExtra', 'quickCollectOverrideDetails', 'quickCollectOverrideReasonInput', 'quickCollectOwnerPaymentInfo', 'quickCollectPackageBox', 'quickCollectPaidByInput', 'quickCollectPaymentForm', 'quickCollectPrefillLine', 'quickCollectPrintReceiptBtn', 'quickCollectPromiseLinkSelect', 'quickCollectReceiptCard', 'quickCollectRemainderWaadaRow', 'quickCollectRemoveScreenshotBtn', 'quickCollectReversalUndoBtn', 'quickCollectScreenshotInput', 'quickCollectScreenshotPreview', 'quickCollectScreenshotPreviewWrap', 'quickCollectSearchClearBtn', 'quickCollectSearchInput', 'quickCollectSenderDigitsInput', 'quickCollectSenderNameInput', 'quickCollectSettlementPreview', 'quickCollectShareImageBtn', 'quickCollectShopChips', 'quickCollectShopLabel', 'quickCollectShopRow', 'quickCollectSplitAmountInput', 'quickCollectSplitDigitalFields', 'quickCollectSplitFields', 'quickCollectSplitMethodSelect', 'quickCollectSplitOverrideReasonInput', 'quickCollectSplitSenderDigitsInput', 'quickCollectSplitSenderNameInput', 'quickCollectSplitToggle', 'quickCollectSplitTransactionIdInput', 'quickCollectStandingInstructionLine', 'quickCollectStepConfirm', 'quickCollectStepForm', 'quickCollectStepOneScreen', 'quickCollectStepPick', 'quickCollectStepSuccess', 'quickCollectSuccessHeading', 'quickCollectSuccessMessage', 'quickCollectSuspendedWarning', 'quickCollectTransactionIdInput', 'quickCollectUnderpaymentWarning', 'quickCollectUndoBtn', 'quickCollectUptimeLine', 'quickCollectUrduNoteInput', 'quickCollectWhatsAppBtn', 'rpvReceiptPreview', 'rqpRecentQuickPick', 'rsdReceiptShareDraft', 'rttRoundTotals', 'sccSecondConnectionAmount', 'sccSecondConnectionRecord', 'sccSecondConnectionStep', 'sccSecondConnectionTotal', 'sowStillOwesLine', 'transactionsView'];
  for (const setupId of SETUP_IDS) getEl(setupId);

  // The real DOM resets a select's value when its options are rebuilt
  // via innerHTML (the `selected` option wins). The billing month
  // select gets the same treatment, so a fresh open lands on its
  // default.
  const monthSelectEl = getEl('quickCollectMonthSelect');
  let monthHtml = '';
  Object.defineProperty(monthSelectEl, 'innerHTML', {
    get: () => monthHtml,
    set: (v) => {
      monthHtml = String(v ?? '');
      const m = monthHtml.match(/value="([^"]+)"\s+selected/);
      if (m) monthSelectEl.value = m[1];
    }
  });

  // Working localStorage: the language lives here, so a test sets it
  // per controller and t() follows it.
  const store = { [LANGUAGE_STORAGE_KEY]: lang };
  const origLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const origDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => registry.get(id) ?? null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
  };

  let state = initialState;
  const toasts = [];
  const controller = setupQuickCollectModal({
    getState: () => state,
    onSaveState: (next) => { state = next; },
    onToast: (msg, opts) => toasts.push({ msg, opts }),
    onSelectCustomer: () => {},
    onEditCustomer: () => {},
    // Plan 449: an active billing link for the seed customer, so the
    // second-connection step renders after a partial payment (it only
    // offers the other connection while dues remain).
    loadBillingLinks: () => [{ customer: 'seed-001', primaryConnection: 'Conn A', linkedConnection: 'Conn B' }]
  });

  return {
    getEl, toasts, controller,
    getError: (id) => registry.get(id) ?? null,
    get state() { return state; },
    async restore() {
      // The submit path schedules a ~60ms focus timer against
      // `document`; let it fire while the stub is still installed.
      await new Promise((r) => setTimeout(r, 130));
      globalThis.document = origDocument;
      globalThis.localStorage = origLocalStorage;
    }
  };
}

/** Open the form for the seed customer with a working requestSubmit. */
function openForm(h) {
  h.controller.open('seed-001');
  const form = h.getEl('quickCollectPaymentForm');
  form.requestSubmit = () => form.dispatch('submit');
  return form;
}

/** Submit a PKR 1,000 cash payment in full and wait for it to record. */
async function saveInFull(h) {
  const form = openForm(h);
  h.getEl('quickCollectAmountInput').value = '1000.00';
  h.getEl('quickCollectMethodSelect').value = 'Cash';
  await form.dispatch('submit');
  assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing');
  await h.getEl('quickCollectConfirmSaveBtn').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 0, 'payment recorded in full');
  await new Promise((r) => setTimeout(r, 120));
}

/** Submit a partial PKR 600 cash payment (PKR 400 stays due, so the second-connection step offers). */
async function savePartial(h) {
  const form = openForm(h);
  h.getEl('quickCollectAmountInput').value = '600.00';
  h.getEl('quickCollectMethodSelect').value = 'Cash';
  await form.dispatch('submit');
  assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing');
  await h.getEl('quickCollectConfirmSaveBtn').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 40000, 'partial payment recorded, 400 still due');
  await new Promise((r) => setTimeout(r, 120));
}

function findToast(h, text) {
  return h.toasts.find((entry) => entry.msg === text);
}

test('plan 549 (REPRO): the recorded toast speaks English in en mode', async () => {
  const h = plan549Controller(plan549State(), 'en');
  try {
    await saveInFull(h);
    const recorded = findToast(h, 'Payment of PKR 1,000 recorded.');
    assert.ok(recorded, `recorded toast must fire — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(recorded.opts?.type, 'success', 'recorded toast is a success toast');
    assert.equal(recorded.opts?.title, 'Payment recorded', 'title is the Payment recorded title');
    assert.equal(recorded.opts?.actionLabel, 'Undo', 'Undo action label present');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the recorded toast speaks Urdu in ur mode', async () => {
  const h = plan549Controller(plan549State(), 'ur');
  try {
    await saveInFull(h);
    const recorded = findToast(h, 'PKR 1,000 کی ادائیگی درج ہو گئی۔');
    assert.ok(recorded, `recorded toast must fire in Urdu — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(recorded.opts?.type, 'success', 'recorded toast is a success toast');
    assert.equal(recorded.opts?.title, 'ادائیگی درج ہو گئی', 'title is Urdu too');
    assert.equal(recorded.opts?.actionLabel, 'واپس کریں', 'Undo action label is Urdu too');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the large-cash refusal speaks English in en mode', async () => {
  const h = plan549Controller(plan549State(), 'en');
  try {
    const form = openForm(h);
    h.getEl('quickCollectLargeCashThreshold').value = '5000';
    h.getEl('quickCollectAmountInput').value = '10000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    await form.dispatch('submit');

    const refusal = findToast(h, 'Large cash payments need the owner\'s approval recorded — enter the approver\'s name.');
    assert.ok(refusal, `large-cash toast must fire — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(refusal.opts?.type, 'error', 'large-cash refusal is an error toast');
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'nothing recorded');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the large-cash refusal speaks Urdu in ur mode', async () => {
  const h = plan549Controller(plan549State(), 'ur');
  try {
    const form = openForm(h);
    h.getEl('quickCollectLargeCashThreshold').value = '5000';
    h.getEl('quickCollectAmountInput').value = '10000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    await form.dispatch('submit');

    const refusal = findToast(h, 'بڑی نقد ادائیگیوں کے لیے مالک کی منظوری درج ہونا ضروری ہے — منظوری دینے والے کا نام درج کریں۔');
    assert.ok(refusal, `large-cash toast must fire in Urdu — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(refusal.opts?.type, 'error', 'large-cash refusal is an error toast');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the undo toast speaks English in en mode', async () => {
  const h = plan549Controller(plan549State(), 'en');
  try {
    await saveInFull(h);
    assert.equal(h.getEl('quickCollectUndoBtn').hidden, false, 'precondition: the undo is offered');
    await h.getEl('quickCollectUndoBtn').click();

    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'ledger restored: full dues open again');
    const undone = findToast(h, 'Payment of PKR 1,000 for Plan549 Tester undone. Ledger restored.');
    assert.ok(undone, `undo toast must fire — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(undone.opts?.type, 'success', 'undo toast is a success toast');
    assert.equal(undone.opts?.title, 'Undone', 'title is the Undone title');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the undo toast speaks Urdu in ur mode', async () => {
  const h = plan549Controller(plan549State(), 'ur');
  try {
    await saveInFull(h);
    await h.getEl('quickCollectUndoBtn').click();

    const undone = findToast(h, 'Plan549 Tester کی PKR 1,000 ادائیگی واپس ہو گئی۔ کھاتہ بحال ہو گیا۔');
    assert.ok(undone, `undo toast must fire in Urdu — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(undone.opts?.title, 'واپس ہو گیا', 'title is Urdu too');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the saved-on-close toast speaks English in en mode', async () => {
  const h = plan549Controller(plan549State(), 'en');
  try {
    await saveInFull(h);
    await h.getEl('quickCollectModal').dispatch('close');

    const saved = findToast(h, 'Payment of PKR 1,000 for Plan549 Tester saved.');
    assert.ok(saved, `saved toast must fire on close — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(saved.opts?.type, 'success', 'saved toast is a success toast');
    assert.equal(saved.opts?.title, 'Payment saved', 'title is the Payment saved title');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the saved-on-close toast speaks Urdu in ur mode', async () => {
  const h = plan549Controller(plan549State(), 'ur');
  try {
    await saveInFull(h);
    await h.getEl('quickCollectModal').dispatch('close');

    const saved = findToast(h, 'Plan549 Tester کی PKR 1,000 ادائیگی محفوظ ہو گئی۔');
    assert.ok(saved, `saved toast must fire in Urdu on close — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(saved.opts?.title, 'ادائیگی محفوظ ہو گئی', 'title is Urdu too');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the second-connection invalid-amount toast speaks English in en mode', async () => {
  const h = plan549Controller(plan549State(), 'en');
  try {
    await savePartial(h);
    h.getEl('sccSecondConnectionAmount').value = '';
    await h.getEl('sccSecondConnectionStep').dispatch('click', { target: { id: 'sccSecondConnectionRecord' } });

    const refusal = findToast(h, 'Enter a valid amount greater than zero for the second connection.');
    assert.ok(refusal, `second-connection toast must fire — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(refusal.opts?.type, 'error', 'second-connection refusal is an error toast');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the second-connection invalid-amount toast speaks Urdu in ur mode', async () => {
  const h = plan549Controller(plan549State(), 'ur');
  try {
    await savePartial(h);
    h.getEl('sccSecondConnectionAmount').value = '';
    await h.getEl('sccSecondConnectionStep').dispatch('click', { target: { id: 'sccSecondConnectionRecord' } });

    const refusal = findToast(h, 'دوسرے کنکشن کے لیے صفر سے زیادہ درست رقم درج کریں۔');
    assert.ok(refusal, `second-connection toast must fire in Urdu — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(refusal.opts?.type, 'error', 'second-connection refusal is an error toast');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the no-receipt-to-print toast speaks English in en mode', async () => {
  const h = plan549Controller(plan549State(), 'en');
  try {
    await h.getEl('quickCollectBluetoothPrintBtn').click();

    const refusal = findToast(h, 'No receipt to print yet.');
    assert.ok(refusal, `no-receipt toast must fire — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(refusal.opts?.type, 'error', 'no-receipt refusal is an error toast');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the no-receipt-to-print toast speaks Urdu in ur mode', async () => {
  const h = plan549Controller(plan549State(), 'ur');
  try {
    await h.getEl('quickCollectBluetoothPrintBtn').click();

    const refusal = findToast(h, 'ابھی چھاپنے کے لیے کوئی رسید نہیں ہے۔');
    assert.ok(refusal, `no-receipt toast must fire in Urdu — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(refusal.opts?.type, 'error', 'no-receipt refusal is an error toast');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the receipt-image-unsupported toast speaks English in en mode', async () => {
  const h = plan549Controller(plan549State(), 'en');
  try {
    await saveInFull(h);
    await h.getEl('quickCollectShareImageBtn').click();

    const refusal = findToast(h, 'Receipt image creation is not supported in this environment.');
    assert.ok(refusal, `image-unsupported toast must fire — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(refusal.opts?.type, 'warning', 'image-unsupported toast is a warning toast');
  } finally {
    await h.restore();
  }
});

test('plan 549 (REPRO): the receipt-image-unsupported toast speaks Urdu in ur mode', async () => {
  const h = plan549Controller(plan549State(), 'ur');
  try {
    await saveInFull(h);
    await h.getEl('quickCollectShareImageBtn').click();

    const refusal = findToast(h, 'اس ماحول میں رسید کی تصویر بنانا ممکن نہیں ہے۔');
    assert.ok(refusal, `image-unsupported toast must fire in Urdu — got: ${JSON.stringify(h.toasts.map((entry) => entry.msg))}`);
    assert.equal(refusal.opts?.type, 'warning', 'image-unsupported toast is a warning toast');
  } finally {
    await h.restore();
  }
});
