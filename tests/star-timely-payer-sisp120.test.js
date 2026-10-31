// SISP-120: Star Timely Payer recognition badge + receipt thank-you.
//
// The star is a live derivation, never a stored flag: the last three
// completed calendar months must each be fully paid under the existing
// allocation engine with the completing settlement recorded on/before
// the 10th, completed arrears must be zero, and the recorded Waada
// history must contain zero broken promises. All fixtures are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  countBrokenWaadas,
  evaluateStarTimelyPayer,
  isStarTimelyPayer,
  starBillSettlement
} from '../star-subscribers.js';
import { calculatePaymentAllocations } from '../core.js';
import { getWaadaTodayString } from '../waada-queue.js';
import {
  createReceiptWhatsAppDraft,
  resolveReceiptWhatsAppAction,
  starTimelyPayerBadgeHtml
} from '../profile-ui.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel, computePngReceiptLayout } from '../png-receipt.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = '2026-10-15';
const payment = (id, date, amount = 3000, extra = {}) => ({ id, date, amount, method: 'Cash', ...extra });
const bill = (month, payments, extra = {}) => ({
  id: `bill-${month}`,
  month,
  dueAmount: 3000,
  status: 'pending',
  payments,
  ...extra
});
const makeCustomer = (bills, extra = {}) => ({
  id: 'cust-star',
  customerNumber: 1201,
  name: 'Synthetic Timely Customer',
  phone: '+92 300 123 4567',
  packageSpeed: '15Mbps Unlimited',
  monthlySellingAmount: 3000,
  archived: false,
  isFreeConnection: false,
  bills,
  ...extra
});
const timelyBills = () => [
  bill('2026-07', [payment('pay-jul', '2026-07-10')]),
  bill('2026-08', [payment('pay-aug', '2026-08-09')]),
  bill('2026-09', [payment('pay-sep', '2026-09-10')])
];
const timelyCustomer = (extra = {}) => makeCustomer(timelyBills(), extra);
const clone = (value) => JSON.parse(JSON.stringify(value));

test('spec pin: three consecutive timely completed months and no broken Waada earns the star', () => {
  const customer = timelyCustomer();
  const state = { customers: [customer] };
  const before = JSON.stringify(state);

  const result = evaluateStarTimelyPayer(state, customer, REF);

  assert.equal(result.starred, true);
  assert.equal(result.reason, 'starred');
  assert.deepEqual(result.requiredMonths, ['2026-07', '2026-08', '2026-09']);
  assert.deepEqual(result.months.map((item) => item.completionDate), ['2026-07-10', '2026-08-09', '2026-09-10']);
  assert.deepEqual(result.months.map((item) => item.timely), [true, true, true]);
  assert.equal(result.brokenWaadaCount, 0);
  assert.equal(result.completedOutstandingCents, 0);
  assert.equal(isStarTimelyPayer(state, customer, REF), true);
  assert.equal(JSON.stringify(state), before, 'evaluation never mutates or stores the star');
  assert.equal('starTimelyPayer' in customer, false);
  assert.ok(starTimelyPayerBadgeHtml(state, customer, REF).includes(TRANSLATIONS.en.star_badge));
});

test('the current in-progress month neither earns nor breaks the streak', () => {
  const customer = timelyCustomer();
  customer.bills.push(bill('2026-10', []));
  const result = evaluateStarTimelyPayer({ customers: [customer] }, customer, REF);
  assert.equal(result.starred, true);
  assert.deepEqual(result.requiredMonths, ['2026-07', '2026-08', '2026-09']);
});

test('counter-pin: a month completed on the 11th earns no star', () => {
  const customer = timelyCustomer();
  customer.bills[2].payments = [
    payment('pay-sep-a', '2026-09-10', 2000),
    payment('pay-sep-b', '2026-09-11', 1000)
  ];
  const result = evaluateStarTimelyPayer({ customers: [customer] }, customer, REF);
  assert.equal(result.months[2].completionDate, '2026-09-11');
  assert.equal(result.months[2].timely, false);
  assert.equal(result.starred, false);
  assert.equal(result.reason, 'late-completion');
  assert.equal(starTimelyPayerBadgeHtml({ customers: [customer] }, customer, REF), '');
});

test('counter-pin: only two completed timely months earns no star', () => {
  const customer = makeCustomer(timelyBills().slice(0, 2));
  const result = evaluateStarTimelyPayer({ customers: [customer] }, customer, REF);
  assert.equal(result.starred, false);
  assert.equal(result.reason, 'missing-billed-month');
  assert.equal(result.months[2].billPresent, false);
});

test('a paused or skipped month inside the completed window breaks the streak', () => {
  const bills = timelyBills();
  bills.splice(1, 1); // August has no bill at all.
  bills.push(bill('2026-06', [payment('pay-jun', '2026-06-10')]));
  const customer = makeCustomer(bills);
  const result = evaluateStarTimelyPayer({ customers: [customer] }, customer, '2026-10-15');
  assert.equal(result.starred, false);
  assert.equal(result.reason, 'missing-billed-month');
});

test('counter-pin: a stamped Waada paid after its promise date is broken and blocks the star', () => {
  const bills = [
    bill('2026-06', [payment('pay-jun', '2026-06-09', 3000, {
      clearedWaada: { promiseDate: '2026-06-08', promiseAmount: 3000, promiseNote: '' }
    })]),
    ...timelyBills()
  ];
  const customer = makeCustomer(bills);
  const state = { customers: [customer] };
  assert.equal(countBrokenWaadas(state, customer, REF), 1);
  const result = evaluateStarTimelyPayer(state, customer, REF);
  assert.equal(result.brokenWaadaCount, 1);
  assert.equal(result.starred, false);
  assert.equal(result.reason, 'broken-waada');
});

test('live broken Waada uses the queue tier; a snoozed future promise is not broken', () => {
  const brokenCustomer = timelyCustomer({ promiseDate: '2026-10-05' });
  brokenCustomer.bills.push(bill('2026-10', []));
  assert.equal(countBrokenWaadas({ customers: [brokenCustomer] }, brokenCustomer, REF), 1);

  const snoozedCustomer = timelyCustomer({ promiseDate: '2026-10-20' });
  snoozedCustomer.bills.push(bill('2026-10', []));
  assert.equal(countBrokenWaadas({ customers: [snoozedCustomer] }, snoozedCustomer, REF), 0);
});

test('counter-pins: archived and FREE customers earn no star', () => {
  const archived = timelyCustomer({ archived: true });
  assert.equal(evaluateStarTimelyPayer({ customers: [archived] }, archived, REF).reason, 'archived');
  assert.equal(evaluateStarTimelyPayer({ customers: [archived] }, archived, REF).starred, false);

  const free = timelyCustomer({ isFreeConnection: true });
  assert.equal(evaluateStarTimelyPayer({ customers: [free] }, free, REF).reason, 'free-connection');
  assert.equal(evaluateStarTimelyPayer({ customers: [free] }, free, REF).starred, false);
});

test('older completed arrears outside the three-month window block the star', () => {
  const customer = makeCustomer([
    bill('2026-06', []),
    ...timelyBills()
  ]);
  const result = evaluateStarTimelyPayer({ customers: [customer] }, customer, REF);
  assert.equal(result.completedOutstanding, 3000);
  assert.equal(result.starred, false);
  assert.equal(result.reason, 'completed-arrears');
});

test('advance rule: carry-forward credit completes the next bill on the advance recorded date', () => {
  const customer = makeCustomer([
    bill('2026-07', [payment('pay-jul-advance', '2026-07-05', 6000, { kind: 'advance' })]),
    bill('2026-08', []),
    bill('2026-09', [payment('pay-sep', '2026-09-10')])
  ]);
  const state = { customers: [customer] };
  const allocations = calculatePaymentAllocations(state);
  const august = starBillSettlement(customer, customer.bills[1], allocations);
  assert.equal(august.status, 'paid');
  assert.equal(august.completionDate, '2026-07-05', 'the recorded advance date rules, not bill generation');
  assert.equal(august.timely, true);
  assert.equal(evaluateStarTimelyPayer(state, customer, REF).starred, true);
});

test('voiding the completing payment removes the star on the next derivation', () => {
  const customer = timelyCustomer();
  const state = { customers: [customer] };
  assert.equal(evaluateStarTimelyPayer(state, customer, REF).starred, true);

  const voided = clone(customer);
  voided.bills[2].payments[0].voided = true;
  const result = evaluateStarTimelyPayer({ customers: [voided] }, voided, REF);
  assert.equal(result.starred, false);
  assert.equal(result.completedOutstanding, 3000);
});

// Receipt fixtures are built relative to today so buildPaymentReceipt's
// live (uninjectable) evaluation sees the same completed-month window.
function monthShift(month, delta) {
  const [year, mon] = month.split('-').map(Number);
  const index = year * 12 + (mon - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}
function dynamicReceiptFixture({ starred = true } = {}) {
  const currentMonth = getWaadaTodayString().slice(0, 7);
  const bills = [];
  if (starred) {
    for (const delta of [-3, -2, -1]) {
      const month = monthShift(currentMonth, delta);
      bills.push(bill(month, [payment(`pay-${month}`, `${month}-10`)]));
    }
  }
  const currentPayment = payment('pay-current', `${currentMonth}-05`);
  bills.push(bill(currentMonth, [currentPayment]));
  const customer = makeCustomer(bills);
  return { customer, bill: bills.at(-1), payment: currentPayment, currentMonth };
}

test('receipt snapshot + HTML layouts: starred gets exactly one thank-you line, non-starred renders unchanged', () => {
  const starredFixture = dynamicReceiptFixture();
  const receipt = buildPaymentReceipt(starredFixture.customer, starredFixture.bill, starredFixture.payment);
  assert.equal(receipt.starTimelyPayer, true);
  assert.equal(receipt.starThankYouNote, TRANSLATIONS.en.star_receipt_thanks);

  const withoutNote = { ...receipt, starTimelyPayer: false, starThankYouNote: '' };
  const noteHtml = `<p class="receipt-reminder receipt-star-thanks">${TRANSLATIONS.en.star_receipt_thanks}</p>`;
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const withNoteHtml = generatePaymentReceiptHtml(receipt, { format });
    const unchangedHtml = generatePaymentReceiptHtml(withoutNote, { format });
    assert.equal(withNoteHtml.split(TRANSLATIONS.en.star_receipt_thanks).length - 1, 1, `${format} prints the note once`);
    assert.equal(withNoteHtml.replace(noteHtml, ''), unchangedHtml, `${format} differs only by the note`);
  }

  const plainFixture = dynamicReceiptFixture({ starred: false });
  const plainReceipt = buildPaymentReceipt(plainFixture.customer, plainFixture.bill, plainFixture.payment);
  assert.equal(plainReceipt.starTimelyPayer, false);
  assert.equal(plainReceipt.starThankYouNote, '');
  assert.equal(generatePaymentReceiptHtml(plainReceipt, { format: 'a4' }).includes('receipt-star-thanks'), false);
});

test('PNG receipt: the thank-you line is a layout command only for starred customers', () => {
  const starredFixture = dynamicReceiptFixture();
  const receipt = buildPaymentReceipt(starredFixture.customer, starredFixture.bill, starredFixture.payment);
  const model = buildPngReceiptModel(receipt, starredFixture.customer);
  assert.equal(model.starThankYouNote, TRANSLATIONS.en.star_receipt_thanks);
  const layout = computePngReceiptLayout(model, (value) => value.length * 24);
  assert.ok(layout.commands.some((command) => command.type === 'text' && command.text === TRANSLATIONS.en.star_receipt_thanks));
  assert.ok(layout.footerY <= layout.height);

  const plainFixture = dynamicReceiptFixture({ starred: false });
  const plainReceipt = buildPaymentReceipt(plainFixture.customer, plainFixture.bill, plainFixture.payment);
  const plainModel = buildPngReceiptModel(plainReceipt, plainFixture.customer);
  const plainLayout = computePngReceiptLayout(plainModel, (value) => value.length * 24);
  assert.equal(plainModel.starThankYouNote, '');
  assert.equal(plainLayout.commands.some((command) => command.text === TRANSLATIONS.en.star_receipt_thanks), false);
});

test('WhatsApp receipt draft: the thank-you line is appended only when the resolver derives the star', () => {
  const baseDraftInput = {
    customerName: 'Synthetic Timely Customer',
    customerNumber: 1201,
    amount: 3000,
    date: '2026-10-05',
    method: 'Cash',
    month: '2026-10',
    billAmount: 3000,
    balanceDueCents: 0,
    billStatus: 'paid'
  };
  const withoutStar = createReceiptWhatsAppDraft('+92 300 123 4567', baseDraftInput);
  const withStar = createReceiptWhatsAppDraft('+92 300 123 4567', { ...baseDraftInput, starTimelyPayer: true });
  assert.ok(withoutStar && withStar);
  assert.equal(withStar.message, `${withoutStar.message}\n\n${TRANSLATIONS.en.star_receipt_thanks}`);

  const starredFixture = dynamicReceiptFixture();
  const action = resolveReceiptWhatsAppAction(starredFixture.customer, {
    customerId: starredFixture.customer.id,
    date: starredFixture.payment.date,
    amount: starredFixture.payment.amount,
    method: starredFixture.payment.method,
    month: starredFixture.currentMonth,
    billAmount: 3000,
    balanceDueCents: 0,
    billStatus: 'paid'
  });
  assert.equal(action.type, 'draft');
  assert.ok(action.draft.message.includes(TRANSLATIONS.en.star_receipt_thanks));
});

test('i18n + wiring audit: every star key exists in en and ur, badge CSS uses no hex', () => {
  const sources = ['star-subscribers.js', 'profile-ui.js', 'receipt.js', 'app.js']
    .map((file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
    .join('\n');
  const usedKeys = [...new Set([...sources.matchAll(/t\(\s*['"](star_[a-z0-9_]+)['"]/g)].map((match) => match[1]))].sort();
  assert.deepEqual(usedKeys, ['star_badge', 'star_receipt_thanks']);
  for (const key of usedKeys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur fell back to the raw key for ${key}`);
  }

  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('starTimelyPayerBadgeHtml(state, customer)'));
  const css = fs.readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const badgeRule = css.match(/\.star-timely-payer-badge \{[^}]+\}/)?.[0] ?? '';
  assert.ok(badgeRule.includes('var(--'), 'badge uses theme tokens');
  assert.equal(/#[0-9a-f]{3,8}\b/i.test(badgeRule), false, 'badge introduces no hex color');
});
