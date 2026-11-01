// SISP-128: Receipt "Last 3 Payments Mini-History" Block (پچھلی 3 ادائیگیاں).
//
// Pins:
//  - the block lists the customer's most recent recorded payments BEFORE
//    the payment this receipt is for — the current payment never appears
//    inside its own history, and payments recorded after it never leak
//    into a reprint of an older receipt;
//  - newest first, max 3: 0 priors -> block omitted everywhere and every
//    surface renders byte-identically to a pre-SISP-128 snapshot; 1-2
//    priors -> exactly those; 5+ priors -> exactly the latest 3;
//  - VOIDED payments (SISP-34) are always excluded and the next older
//    valid payment takes the freed slot; malformed dates are skipped,
//    never ranked or guessed;
//  - receipt reference = stored receiptNumber -> permanentReceiptNumber
//    -> readable-date fallback (Recent Payments precedent, PR #471);
//    NO receipt number is ever fabricated;
//  - amount = the payment record's own `amount` (the figure the profile
//    history shows; for a SISP-61 prepay that is the recorded net cash);
//    all recorded kinds count (regular / advance / kist-carrying);
//  - surfaces: HTML A4 + thermal-80 + thermal-58 (receipt.js), the PNG
//    model/layout (canvas grows past 2000px ONLY when history exists),
//    ESC/POS text (thermal-printer.js), the Quick Collect WhatsApp
//    draft (nav-quick-collect.js) and the profile WhatsApp draft
//    (profile-ui.js, caller-attached like the SISP-33 FIFO fields);
//  - every rcpt_hist_* key resolves in BOTH dictionaries.
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPaymentReceipt, generatePaymentReceiptHtml,
  buildReceiptPaymentHistory, receiptHistoryHeading
} from '../receipt.js';
import {
  PNG_RECEIPT_HEIGHT, buildPngReceiptModel, computePngReceiptLayout, generateReceiptPNG
} from '../png-receipt.js';
import { buildEscPosReceipt, escPosFieldsFromPaymentReceipt } from '../thermal-printer.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';
import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, addPayment
} from '../core.js';
import { executeQuickCollection, formatQuickCollectWhatsAppReceipt } from '../nav-quick-collect.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const payment = (id, amount, date, extra = {}) => ({ id, amount, date, method: 'Cash', ...extra });

function ledger(months) {
  const bills = months.map(({ month, dueAmount = 3000, payments = [] }) => ({
    id: `bill-${month}`, month, dueAmount, status: 'pending', payments
  }));
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer',
    packageSpeed: '15 Mbps', packageHistory: [], bills
  };
  return { customer, bills };
}

/** Jul 1 payment, Aug 2, Sep 2, plus the current October payment. */
function fivePriorLedger() {
  const current = payment('pay-oct', 3000, '2026-10-04');
  const { customer, bills } = ledger([
    { month: '2026-07', payments: [payment('pay-jul', 3000, '2026-07-05')] },
    { month: '2026-08', payments: [payment('pay-aug-1', 3000, '2026-08-03'), payment('pay-aug-2', 2500, '2026-08-20', { method: 'EasyPaisa' })] },
    { month: '2026-09', payments: [payment('pay-sep-1', 3000, '2026-09-02'), payment('pay-sep-2', 3000, '2026-09-18')] },
    { month: '2026-10', payments: [current] }
  ]);
  return { customer, bills, current };
}

test('selection: latest 3 before the current payment, newest first, current excluded', () => {
  const { customer, bills, current } = fivePriorLedger();
  const receipt = buildPaymentReceipt(customer, bills[3], current);
  assert.deepEqual(receipt.previousPayments.map((row) => row.date), ['2026-09-18', '2026-09-02', '2026-08-20']);
  assert.deepEqual(receipt.previousPayments.map((row) => row.amount), [3000, 3000, 2500]);
  assert.equal(receipt.previousPayments[2].method, 'EasyPaisa', 'recorded method string verbatim');
  assert.ok(receipt.previousPayments.every((row) => row.date !== '2026-10-04'), 'the current payment is not in its own history');
});

test('reprint of an older receipt shows only the payments before it', () => {
  const { customer, bills } = fivePriorLedger();
  const sepFirst = bills[2].payments[0];
  const receipt = buildPaymentReceipt(customer, bills[2], sepFirst);
  assert.deepEqual(receipt.previousPayments.map((row) => row.date), ['2026-08-20', '2026-08-03', '2026-07-05'],
    'the later September payment and the October payment never leak into the older receipt');
  const firstEver = buildPaymentReceipt(customer, bills[0], bills[0].payments[0]);
  assert.deepEqual(firstEver.previousPayments, [], 'the first recorded payment has no history');
});

test('same-bill partials: the second payment sees the first, the first sees nothing after it', () => {
  const p1 = payment('pay-1', 1500, '2026-10-02');
  const p2 = payment('pay-2', 1500, '2026-10-09');
  const { customer, bills } = ledger([{ month: '2026-10', payments: [p1, p2] }]);
  assert.deepEqual(buildPaymentReceipt(customer, bills[0], p2).previousPayments.map((row) => row.date), ['2026-10-02']);
  assert.deepEqual(buildPaymentReceipt(customer, bills[0], p1).previousPayments, []);
});

test('voided payment among the latest is skipped and the next older valid one takes its place', () => {
  const current = payment('pay-now', 3000, '2026-10-04');
  const { customer, bills } = ledger([
    { month: '2026-08', payments: [payment('pay-d', 3000, '2026-08-01'), payment('pay-c', 3000, '2026-08-15')] },
    { month: '2026-09', payments: [payment('pay-b', 3000, '2026-09-10'), payment('pay-a', 3000, '2026-09-25', { voided: true, voidReason: 'Duplicate entry' })] },
    { month: '2026-10', payments: [current] }
  ]);
  const history = buildPaymentReceipt(customer, bills[2], current).previousPayments;
  assert.deepEqual(history.map((row) => row.date), ['2026-09-10', '2026-08-15', '2026-08-01'],
    'voided 2026-09-25 excluded; the 4th-newest valid payment fills the slot');
});

test('malformed or missing dates are skipped, never ranked or guessed', () => {
  const current = payment('pay-now', 3000, '2026-10-04');
  const { customer, bills } = ledger([
    { month: '2026-09', payments: [payment('pay-bad', 3000, 'not-a-date'), payment('pay-none', 3000, ''), payment('pay-ok', 3000, '2026-09-10')] },
    { month: '2026-10', payments: [current] }
  ]);
  assert.deepEqual(buildPaymentReceipt(customer, bills[1], current).previousPayments.map((row) => row.date), ['2026-09-10']);
});

test('receipt reference chain: stored receiptNumber, then permanentReceiptNumber, then readable date — never fabricated', () => {
  const current = payment('pay-now', 3000, '2026-10-04');
  const { customer, bills } = ledger([
    {
      month: '2026-09',
      payments: [
        payment('pay-1', 3000, '2026-09-02', { receiptNumber: 'RCPT-42-2026-09-01' }),
        payment('pay-2', 3000, '2026-09-10', { permanentReceiptNumber: 'PERM-42-9' }),
        payment('pay-3', 3000, '2026-09-18')
      ]
    },
    { month: '2026-10', payments: [current] }
  ]);
  const history = buildPaymentReceipt(customer, bills[1], current).previousPayments;
  assert.equal(history[0].receiptRef, '', 'a payment that stored no number keeps an empty ref');
  assert.match(history[0].receiptLabel, /2026/, 'fallback label is the readable date');
  assert.notEqual(history[0].receiptLabel, '2026-09-18');
  assert.doesNotMatch(history[0].receiptLabel, /RCPT|PERM|REC-\d/, 'no number is invented for the fallback');
  assert.equal(history[1].receiptRef, 'PERM-42-9');
  assert.equal(history[1].receiptLabel, 'PERM-42-9');
  assert.equal(history[2].receiptRef, 'RCPT-42-2026-09-01');
  assert.equal(history[2].receiptLabel, 'RCPT-42-2026-09-01');
});

test('amount is the payment record amount field; advance/prepay kinds count as payments', () => {
  const current = payment('pay-now', 3000, '2026-10-04');
  const { customer, bills } = ledger([
    {
      month: '2026-09',
      payments: [
        payment('pay-adv', 1500, '2026-09-06', { kind: 'advance', advanceTargetMonth: '2026-10' }),
        // SISP-61 prepay shape: discount recorded separately, `amount` is
        // the net cash — the figure the profile history shows.
        payment('pay-prepay', 8500, '2026-09-20', { discount: 500, prepayMonths: 3, prepayGross: 9000, prepayRate: 3000 })
      ]
    },
    { month: '2026-10', payments: [current] }
  ]);
  const history = buildPaymentReceipt(customer, bills[1], current).previousPayments;
  assert.deepEqual(history.map((row) => row.amount), [8500, 1500], 'prepay shows its recorded net cash, not the gross coverage');
});

test('builder with no current payment returns the latest 3 overall (Quick Collect pre-payment seam)', () => {
  const { customer } = fivePriorLedger();
  assert.deepEqual(buildReceiptPaymentHistory(customer).map((row) => row.date), ['2026-10-04', '2026-09-18', '2026-09-02']);
  assert.deepEqual(buildReceiptPaymentHistory(null), []);
  assert.deepEqual(buildReceiptPaymentHistory({ bills: [] }), []);
});

test('0 priors: every surface omits the block and renders byte-identically to a pre-SISP-128 snapshot', () => {
  const only = payment('pay-only', 3000, '2026-10-04');
  const { customer, bills } = ledger([{ month: '2026-10', payments: [only] }]);
  const receipt = buildPaymentReceipt(customer, bills[0], only);
  assert.deepEqual(receipt.previousPayments, []);
  const legacy = { ...receipt };
  delete legacy.previousPayments;
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.equal(html, generatePaymentReceiptHtml(legacy, { format }), `${format}: no-history output is unchanged`);
    assert.ok(!html.includes('Last 3 Payments') && !html.includes('receipt-history'), `${format}: no history markup`);
  }
  const cust = { name: 'Synthetic Customer' };
  const model = buildPngReceiptModel(receipt, cust);
  const legacyModel = buildPngReceiptModel(legacy, cust);
  assert.deepEqual(model.history, []);
  assert.equal(model.historyHeading, '');
  const layout = computePngReceiptLayout(model);
  assert.deepEqual(layout, computePngReceiptLayout(legacyModel), 'PNG layout is unchanged without history');
  assert.equal(layout.height, PNG_RECEIPT_HEIGHT);
  const fields = escPosFieldsFromPaymentReceipt(receipt);
  const legacyFields = escPosFieldsFromPaymentReceipt(legacy);
  assert.equal(fields.historyHeading, '');
  assert.deepEqual(fields.historyLines, []);
  assert.equal(buildEscPosReceipt(fields).text, buildEscPosReceipt(legacyFields).text, 'ESC/POS text is unchanged without history');
  assert.ok(!buildEscPosReceipt(fields).text.includes('LAST 3 PAYMENTS'));
});

test('HTML surfaces carry the block: A4 with column header, thermals with heading + rows, above the footer note', () => {
  const { customer, bills, current } = fivePriorLedger();
  const receipt = buildPaymentReceipt(customer, bills[3], current);
  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.ok(a4.includes('Last 3 Payments / پچھلی 3 ادائیگیاں'), 'A4 heading is the bilingual dictionary pair');
  assert.ok(a4.includes('Receipt #'), 'A4 header row carries the Receipt # label');
  assert.ok(a4.includes('2026-09-18') && a4.includes('PKR 3,000'), 'A4 rows carry date + amount');
  assert.ok(a4.indexOf('receipt-history') < a4.indexOf('receipt-urdu-notice'), 'history is body content above the footer note');
  for (const format of ['thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes('Last 3 Payments'), `${format} heading present`);
    assert.ok(html.includes('2026-09-18') && html.includes('2026-08-20'), `${format} rows present`);
    assert.ok(!html.includes('2026-07-05'), `${format}: the 4th-oldest payment is not shown`);
  }
});

function stubCanvas() {
  const calls = [];
  const ctx = {
    calls, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
    textAlign: '', textBaseline: '', direction: '',
    fillRect: (...a) => calls.push(['fillRect', ...a]),
    strokeRect: (...a) => calls.push(['strokeRect', ...a]),
    fillText: (...a) => calls.push(['fillText', ...a]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...a) => calls.push(['moveTo', ...a]),
    lineTo: (...a) => calls.push(['lineTo', ...a]),
    arc: (...a) => calls.push(['arc', ...a]),
    stroke: () => calls.push(['stroke']),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    translate: (...a) => calls.push(['translate', ...a]),
    rotate: (...a) => calls.push(['rotate', ...a]),
    measureText: (tx) => ({ width: tx.length * 20 })
  };
  return {
    ctx, width: 0, height: 0,
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,FAKEPNG',
    toBlob: (cb) => cb({ type: 'image/png', size: 1234 })
  };
}

/** A receipt tall enough that its footer already sits near the 2000px foot. */
function tallReceipt(previousPayments) {
  return {
    receiptNumber: 'RCPT-42-2026-10-01', paymentDate: '2026-10-04', status: 'PAID',
    customerName: 'Synthetic Customer', customerId: '42', package: '15 Mbps', speedMbps: '15',
    servicePeriodStart: '2026-10-01', paymentMethod: 'Cash', transactionId: '',
    nominalPrice: 3000, lateFee: 150, discount: 100, concessionAmount: 200,
    referralCreditAmount: 0, depositOffsetAmount: 0, prepay: null, ticketCharges: [],
    paidAmount: 3000, balanceDueCents: 0, urduNote: '',
    arrearsBreakdown: { previousArrears: 1000, packageAmount: 3000, kistAmount: 0, kistLines: [], balanceDue: 0 },
    previousPayments
  };
}

test('PNG: model carries composed history lines; layout grows past 2000px only when history exists', async () => {
  const cust = { id: 'synthetic-customer', name: 'Synthetic Customer', mohalla: '', zone: '' };
  const rows = [
    { date: '2026-09-18', amount: 3000, method: 'Cash', receiptRef: '', receiptLabel: 'Sep 18 2026' },
    { date: '2026-09-02', amount: 2500, method: 'EasyPaisa', receiptRef: 'PERM-42-9', receiptLabel: 'PERM-42-9' },
    { date: '2026-08-20', amount: 3000, method: 'Cash', receiptRef: 'RCPT-42-2026-08-01', receiptLabel: 'RCPT-42-2026-08-01' }
  ];
  const plain = buildPngReceiptModel(tallReceipt([]), cust);
  const withHistory = buildPngReceiptModel(tallReceipt(rows), cust);
  assert.deepEqual(plain.history, []);
  assert.equal(withHistory.history.length, 3);
  assert.ok(withHistory.history[0].startsWith('2026-09-18 · PKR 3,000'));
  assert.ok(withHistory.history[1].includes('EasyPaisa') && withHistory.history[1].includes('PERM-42-9'));
  assert.equal(withHistory.historyHeading, 'Last 3 Payments / پچھلی 3 ادائیگیاں');

  const layoutPlain = computePngReceiptLayout(plain);
  assert.equal(layoutPlain.height, PNG_RECEIPT_HEIGHT, 'no history: canvas stays exactly 2000px');
  assert.ok(layoutPlain.footerY <= PNG_RECEIPT_HEIGHT, 'fixture sanity: the tall receipt still fits without history');

  const layoutHist = computePngReceiptLayout(withHistory);
  assert.ok(layoutHist.height > PNG_RECEIPT_HEIGHT, 'with history the canvas grows instead of clipping');
  assert.ok(layoutHist.footerY <= layoutHist.height, 'footer stays inside the grown canvas');
  for (const cmd of layoutHist.commands) {
    if (cmd.type === 'text') assert.ok(cmd.y <= layoutHist.height, `text command inside canvas: ${cmd.text}`);
    if (cmd.type === 'rect') assert.ok(cmd.y + cmd.h <= layoutHist.height + 200, 'rect command inside canvas');
  }
  const headingCmd = layoutHist.commands.find((cmd) => cmd.type === 'text' && cmd.text === withHistory.historyHeading);
  assert.ok(headingCmd, 'history heading is drawn');
  assert.ok(layoutHist.commands.some((cmd) => cmd.type === 'text' && cmd.text.startsWith('2026-09-18')), 'history rows are drawn');

  const canvas = stubCanvas();
  const png = await generateReceiptPNG(tallReceipt(rows), cust, { createCanvas: () => canvas });
  assert.equal(png.height, layoutHist.height, 'generated PNG reports the grown height');
  assert.equal(canvas.height, layoutHist.height, 'the canvas itself was resized before rendering');
  const canvasPlain = stubCanvas();
  const pngPlain = await generateReceiptPNG(tallReceipt([]), cust, { createCanvas: () => canvasPlain });
  assert.equal(pngPlain.height, PNG_RECEIPT_HEIGHT);
  assert.equal(canvasPlain.height, PNG_RECEIPT_HEIGHT);
});

test('ESC/POS: history lines print above the footer note; absent history leaves the slip unchanged', () => {
  const { customer, bills, current } = fivePriorLedger();
  const receipt = buildPaymentReceipt(customer, bills[3], current);
  const text = buildEscPosReceipt(escPosFieldsFromPaymentReceipt(receipt)).text;
  assert.ok(text.includes('LAST 3 PAYMENTS'), 'Latin-caps heading (printer charset limitation, per module header)');
  assert.ok(text.includes('2026-09-18') && text.includes('PKR 3,000'), 'history rows printed');
  assert.ok(text.indexOf('LAST 3 PAYMENTS') < text.indexOf('Thank you!'), 'history sits above the footer');
});

test('Quick Collect WhatsApp: prior payments attach to the receipt and render in the draft; the new payment is not among them', () => {
  const SEP_05 = new Date(2026, 8, 5, 12);
  const OCT_03 = new Date(2026, 9, 3, 12);
  let state = createInitialState(['History Tester']);
  state = updateCustomerProfile(state, 'seed-001', { packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000 }, SEP_05);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_03);
  state = addPayment(state, 'seed-001', '2026-09', { date: '2026-09-05', amount: 1000, method: 'Cash' }, SEP_05);

  const { receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-10', amount: 1000, date: '2026-10-03', method: 'Cash'
  }, OCT_03);
  assert.equal(receipt.previousPayments.length, 1, 'only the September payment precedes this collection');
  assert.equal(receipt.previousPayments[0].date, '2026-09-05');
  assert.equal(receipt.previousPayments[0].amount, 1000);
  const draft = formatQuickCollectWhatsAppReceipt(receipt);
  assert.ok(draft.text.includes('Last 3 Payments / پچھلی 3 ادائیگیاں'), 'WhatsApp draft carries the bilingual heading');
  assert.ok(draft.text.includes('2026-09-05') && draft.text.includes('PKR 1,000'), 'WhatsApp draft carries the prior row');
  assert.ok(draft.text.indexOf('Last 3 Payments') < draft.text.indexOf('Shukriya!'), 'history is above the thank-you lines');

  // First-ever collection: no history, draft unchanged.
  let fresh = createInitialState(['First Timer']);
  fresh = updateCustomerProfile(fresh, 'seed-001', { packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000 }, SEP_05);
  fresh = generateMonthlyBillsThroughCurrentMonth(fresh, SEP_05);
  const first = executeQuickCollection(fresh, {
    customerId: 'seed-001', month: '2026-09', amount: 1000, date: '2026-09-05', method: 'Cash'
  }, SEP_05);
  assert.deepEqual(first.receipt.previousPayments, []);
  assert.ok(!formatQuickCollectWhatsAppReceipt(first.receipt).text.includes('Last 3 Payments'));

  // The draft text is byte-identical whether previousPayments is an
  // empty array or absent entirely (pre-SISP-128 receipt objects).
  const bare = {
    receiptNumber: 'RCPT-7-2026-09-01', date: '2026-09-05', customerName: 'Synthetic Customer',
    customerNumber: 7, phone: '', area: 'BARRIAN', month: '2026-09', amount: 1000,
    method: 'Cash', transactionId: '', paidBy: '', newTotalDues: 0, ticketCharges: []
  };
  assert.equal(
    formatQuickCollectWhatsAppReceipt({ ...bare, previousPayments: [] }).text,
    formatQuickCollectWhatsAppReceipt(bare).text
  );
});

test('profile WhatsApp draft: attached previousPayments render; absent means no block', () => {
  const base = {
    customerName: 'Synthetic Customer', customerNumber: 42, amount: 3000,
    date: '2026-10-04', method: 'Cash', month: '2026-10',
    billStatus: 'paid', billAmount: 3000, balanceDueCents: 0, billDueDate: '2026-10-05'
  };
  const withHistory = createReceiptWhatsAppDraft('+92 300 123 4567', {
    ...base,
    previousPayments: [{ date: '2026-09-18', amount: 3000, method: 'EasyPaisa', receiptRef: '', receiptLabel: 'RCPT-42-2026-09-02' }]
  });
  assert.ok(withHistory.message.includes('Last 3 Payments / پچھلی 3 ادائیگیاں'));
  assert.ok(withHistory.message.includes('Sep 18 2026') && withHistory.message.includes('PKR 3,000') && withHistory.message.includes('RCPT-42-2026-09-02'));
  const without = createReceiptWhatsAppDraft('+92 300 123 4567', base);
  assert.ok(!without.message.includes('Last 3 Payments'), 'no attachment, no block — the approved template is untouched');
});

test('i18n: every rcpt_hist_* key resolves in both dictionaries and no source uses an undefined one', () => {
  const keys = ['rcpt_hist_heading', 'rcpt_hist_date', 'rcpt_hist_amount', 'rcpt_hist_method', 'rcpt_hist_receipt_no'];
  for (const key of keys) {
    assert.equal(t(key, 'en'), TRANSLATIONS.en[key], `${key} resolves in en`);
    assert.equal(t(key, 'ur'), TRANSLATIONS.ur[key], `${key} resolves in ur`);
    assert.notEqual(t(key, 'en'), key, `${key} never renders as a raw key (en)`);
    assert.notEqual(t(key, 'ur'), key, `${key} never renders as a raw key (ur)`);
  }
  assert.equal(receiptHistoryHeading(), 'Last 3 Payments / پچھلی 3 ادائیگیاں');
  for (const file of ['receipt.js', 'png-receipt.js', 'profile-ui.js', 'nav-quick-collect.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const used of source.match(/rcpt_hist_[a-z_]+/g) ?? []) {
      assert.ok(keys.includes(used), `${file} uses defined key ${used}`);
    }
  }
});
