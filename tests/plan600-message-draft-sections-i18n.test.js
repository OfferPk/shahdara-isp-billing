// Plan 600 — the eight message-draft sections speak the operator's
// language (D1(b) full keying via labels-objects, D3 one dft_ family,
// D4 this file + minimal extends to the eight section test files,
// D7 this file asserts the NEW total as its own guard and carries no
// bare digits of the previous total anywhere — not even in a comment).
// Rule: every key renders in Urdu through a caller-supplied labels
// object, and with no labels the English output is byte-identical to
// the shipped strings (the 591 header-strip pattern). The draft TEXT
// builders are out of scope and must read exactly as before.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';
import {
  buildWelcomePack,
  buildWelcomePackDraft,
  welcomePackSummaryText,
  welcomePackSentText,
  welcomePackHtml,
} from '../welcome-pack.js';
import {
  buildMonthlyStatement,
  buildStatementDraftText,
  statementDraftSummaryText,
  statementSentText,
  statementDraftHtml,
} from '../statement-draft.js';
import {
  buildBalanceReply,
  balanceReplySummaryText,
  balanceReplySentText,
  balanceReplyHtml,
} from '../balance-reply.js';
import {
  buildPaymentSlip,
  buildPaymentSlipText,
  paymentSlipSummaryText,
  paymentSlipSentText,
  paymentSlipHtml,
} from '../payment-slip.js';
import {
  buildInfoCard,
  infoCardSummaryText,
  infoCardSentText,
  infoCardHtml,
} from '../info-card.js';
import {
  buildStatusReply,
  statusReplySentText,
  statusReplyHtml,
} from '../status-reply.js';
import {
  customerTermsStatus,
  termsAckMethodLabel,
  termsAckSummaryText,
  termsAckHtml,
  termsAckStatusHtml,
  termsAckCsv,
} from '../terms-ack.js';
import {
  creditBalanceForCustomer,
  creditSummaryText,
  creditHtml,
} from '../credit-balance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const appJs = read('app.js');
const navJs = read('nav-language.js');
const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;

// Labels objects built from a dict exactly the way renderDetail builds
// them from t() — one object per module, same property names.
function labelsFor(dict) {
  return {
    welcome: { unavailable: dict.dft_wp_unavailable, ready: dict.dft_wp_ready, incomplete: dict.dft_wp_incomplete, notSent: dict.dft_wp_not_sent, sent1: dict.dft_wp_sent_on, sentN1: dict.dft_wp_sent_once_more, sentN: dict.dft_wp_sent_more, package: dict.dft_wp_package, monthlyAmount: dict.dft_wp_monthly_amount, due: dict.dft_wp_due, paymentMethods: dict.dft_wp_payment_methods, support: dict.dft_wp_support, missing: dict.dft_wp_missing_note, dueEveryMonth: dict.dft_wp_due_every_month, notSet: dict.prof_not_set },
    statement: { unavailable: dict.dft_statement_unavailable, summary: dict.dft_stmt_summary, notSent: dict.dft_stmt_not_sent, sent1: dict.dft_stmt_sent_on, sentN1: dict.dft_stmt_sent_once_more, sentN: dict.dft_stmt_sent_more, month: dict.dft_stmt_month, opening: dict.dft_stmt_opening, charges: dict.dft_stmt_charges, payments: dict.dft_stmt_payments, closing: dict.dft_stmt_closing, onePayment: dict.dft_stmt_one_payment, manyPayments: dict.dft_stmt_many_payments, noBill: dict.dft_stmt_no_bill, voidedCount: dict.dft_stmt_voided_count },
    balance: { unavailable: dict.dft_bal_summary_unavailable, noAmountDue: dict.dft_bal_no_amount_due, noUndisputed: dict.dft_bal_no_undisputed, undisputed: dict.dft_bal_undisputed, current: dict.dft_bal_current, notSent: dict.dft_bal_not_sent, sent1: dict.dft_bal_sent_on, sentN1: dict.dft_bal_sent_once_more, sentN: dict.dft_bal_sent_more, customer: dict.dft_bal_customer, noDueLine: dict.dft_bal_no_due_line, noUndisputedLine: dict.dft_bal_no_undisputed_line, undisputedLine: dict.dft_bal_undisputed_line, currentLine: dict.dft_bal_current_line, dueDate: dict.dft_bal_due_date, dueNotRecorded: dict.dft_bal_due_not_recorded, lastPaymentLine: dict.dft_bal_last_payment_line, lastNone: dict.dft_bal_last_none, disputeEntries: dict.dft_bal_dispute_entries },
    slip: { unavailable: dict.dft_slip_unavailable, summary: dict.dft_slip_summary, notSent: dict.dft_slip_not_sent, sent: dict.dft_slip_sent, noPayments: dict.dft_slip_no_payments, subtotal: dict.dft_slip_subtotal, currentLine: dict.dft_bal_current_line, voidStamp: dict.dft_slip_void_stamp, voidedExcluded: dict.dft_slip_voided_excluded, skippedRows: dict.dft_slip_skipped_rows, unavailableLong: dict.dft_slip_unavailable_long },
    info: { unavailable: dict.dft_ic_unavailable, summary: dict.dft_ic_summary, summaryDue: dict.dft_ic_summary_due, summaryPending: dict.dft_ic_summary_pending, notSent: dict.dft_ic_not_sent, sent1: dict.dft_ic_sent_on, sentN1: dict.dft_ic_sent_once_more, sentN: dict.dft_ic_sent_more, customer: dict.dft_bal_customer, package: dict.dft_wp_package, monthlyPrice: dict.dft_ic_monthly_price, cycleDue: dict.dft_ic_cycle_due, cycleDueDefault: dict.dft_ic_cycle_due_default, cycleNotRecorded: dict.dft_ic_cycle_not_recorded, nextDue: dict.dft_ic_next_due, nextDueNotRecorded: dict.dft_ic_next_due_not_recorded, status: dict.dft_ic_status, expiry: dict.dft_ic_expiry, expiryNotRecorded: dict.dft_ic_expiry_not_recorded, support: dict.dft_ic_support, changeNoted: dict.dft_ic_change_noted, notRecorded: dict.dft_ic_not_recorded },
    status: { notSent: dict.dft_slip_not_sent, sentDate: dict.dft_sr_sent_date, sentNoDate: dict.dft_sr_sent_nodate, noOpenCase: dict.dft_sr_no_open_case, openOne: dict.dft_sr_open_one, openMany: dict.dft_sr_open_many, unavailable: dict.dft_status_unavailable },
    terms: { unavailable: dict.dft_terms_unavailable, noVersion: dict.dft_terms_no_version, version: dict.dft_terms_version, acknowledged: dict.dft_terms_acknowledged, notAcknowledged: dict.dft_terms_not_acknowledged, detail: dict.dft_terms_detail, recordedBy: dict.dft_terms_recorded_by, neverAssumed: dict.dft_terms_never_assumed, methodInPerson: dict.dft_terms_method_in_person, methodMessage: dict.dft_terms_method_message, methodPaper: dict.dft_terms_method_paper, notRecorded: dict.prof_not_recorded },
    credit: { noRecord: dict.dft_credit_no_record, summary: dict.dft_credit_summary },
  };
}
const enLabels = labelsFor(en);
const urLabels = labelsFor(ur);

// ---- fixtures ----
const pack = buildWelcomePack({ customerId: 'c1', customerName: 'Ahmed', package: '20 Mbps', monthlyAmount: 3000, dueDate: '2026-11-05', paymentMethods: ['Cash'], supportContact: '0300-1234567' });
const packIncomplete = buildWelcomePack({ customerId: 'c1' });
const statement = buildMonthlyStatement({ customerId: 'c1', customerName: 'Ahmed', month: '2026-11', bills: [{ month: '2026-11', dueAmount: 3000 }], payments: [{ date: '2026-11-03', amount: 1000, method: 'Cash' }] });
const statementNoBill = buildMonthlyStatement({ customerId: 'c1', customerName: 'Ahmed', month: '2026-11', bills: [], payments: [] });
const statementVoided = buildMonthlyStatement({ customerId: 'c1', customerName: 'Ahmed', month: '2026-11', bills: [{ month: '2026-11', dueAmount: 3000 }], payments: [{ date: '2026-11-03', amount: 1000, method: 'Cash' }, { date: '2026-11-04', amount: 500, method: 'Cash', voided: true }] });
const reply = buildBalanceReply({ customerId: 'c1', customerName: 'Ahmed', outstanding: 1000, dueDate: '2026-11-05', lastPayment: { amount: 500, date: '2026-11-01' } });
const replyNone = buildBalanceReply({ customerId: 'c1', customerName: 'Ahmed', outstanding: 0, dueDate: null, lastPayment: null });
const replyDisputed = buildBalanceReply({ customerId: 'c1', customerName: 'Ahmed', outstanding: 1000, dueDate: '2026-11-05', lastPayment: { amount: 500, date: '2026-11-01' }, openDisputes: [{ disputedAmount: 500 }, { disputedAmount: 'bad' }] });
const slip = buildPaymentSlip({ customerId: 'c1', customerName: 'Ahmed', payments: [{ date: '2026-11-01', amount: 1000, channel: 'Cash' }, { date: '2026-11-02', amount: 500, channel: 'JazzCash', voided: true }, { date: '', amount: 100, channel: 'Cash' }], count: 6, balance: 500 });
const slipEmpty = buildPaymentSlip({ customerId: 'c1', customerName: 'Ahmed', payments: [], count: 6, balance: 500 });
const card = buildInfoCard({ customerId: 'c1', customerName: 'Ahmed', package: '20 Mbps', monthlyPrice: 3000, cycleDueDay: 5, cycleIsDefault: true, nextDueDate: '2026-12-05', connectionStatus: 'Active', expiryDate: '2026-12-31', supportContact: '0300-1234567' });
const cardPending = buildInfoCard({ customerId: 'c1', customerName: 'Ahmed', package: '20 Mbps', monthlyPrice: 3000, cycleDueDay: 5, cycleIsDefault: false, nextDueDate: '2026-12-05', connectionStatus: 'Active', expiryDate: '2026-12-31', supportContact: '0300-1234567', pendingChange: { proposedPackage: '50 Mbps', effectiveDate: '2026-12-01' } });
const statusOne = buildStatusReply({ customerId: 'c1', customerName: 'Ahmed', tickets: [{ customerId: 'c1', id: 'T-1', category: 'no_connection', status: 'open', reportedDate: '2026-11-01' }], requests: [] });
const statusTwo = buildStatusReply({ customerId: 'c1', customerName: 'Ahmed', tickets: [{ customerId: 'c1', id: 'T-1', category: 'no_connection', status: 'open', reportedDate: '2026-11-01' }], requests: [{ customerId: 'c1', id: 'R-1', type: 'relocation', status: 'pending', dateRequested: '2026-11-02' }] });
const statusNone = buildStatusReply({ customerId: 'c1', customerName: 'Ahmed', tickets: [], requests: [] });
const ackList = [{ id: 'a1', customer: 'C-1', customerName: 'Ahmed', termsVersion: 'v2', date: '2026-11-01', method: 'in-person', recordedBy: 'Saad' }];
const credit = creditBalanceForCustomer([{ id: 'e1', customerId: 'C-1', source: 'overpayment', sourcePaymentId: 'P-1', amountCents: 50000, date: '2026-11-01' }], [], 'C-1');
const sends1 = [{ customerId: 'c1', sentAt: '2026-11-04T10:00:00.000Z' }];
const sends2 = [{ customerId: 'c1', sentAt: '2026-11-04T10:00:00.000Z' }, { customerId: 'c1', sentAt: '2026-11-05T10:00:00.000Z' }];
const sends3 = [...sends2, { customerId: 'c1', sentAt: '2026-11-06T10:00:00.000Z' }];

// ================= G1 — parity guard (this file's own pin) =================

test('G1: parity is the new total in both dicts', () => {
  assert.equal(Object.keys(en).length, 5203, 'EN parity');
  assert.equal(Object.keys(ur).length, 5203, 'UR parity');
});

// ================= G2 — the dft_ family is complete and clean =================

test('G2a: exactly one dft_ family of the new keys, all with Urdu', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('dft_'));
  assert.equal(keys.length, 139, `expected the new dft_ keys, got ${keys.length}`);
  for (const key of keys) {
    assert.equal(typeof ur[key], 'string', `${key} must exist in UR`);
    assert.ok(ur[key].length > 0, `${key} UR must not be empty`);
  }
});

test('G2b: every UR value differs from EN except the VOID code stamp', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('dft_'));
  for (const key of keys) {
    if (key === 'dft_slip_void_stamp') {
      assert.equal(ur[key], 'VOID', 'the VOID stamp stays VOID in both languages');
    } else {
      assert.notEqual(ur[key], en[key], `${key} UR must differ from EN`);
    }
  }
});

test('G2c: no new key carries a money figure (D2)', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('dft_'));
  for (const key of keys) {
    assert.doesNotMatch(en[key], /Rs\.|PKR/, `${key} EN must carry no money token`);
    assert.doesNotMatch(ur[key], /Rs\.|PKR/, `${key} UR must carry no money token`);
  }
  assert.doesNotMatch(navJs, /Rs\./, 'no Rs. token anywhere in nav-language.js (Sharafat 85)');
});

// ================= G3 — template wiring =================

test('G3a: all eight headings and explainers render through t()', () => {
  for (const key of ['dft_welcome_heading', 'dft_statement_heading', 'dft_balance_heading', 'dft_slip_heading', 'dft_infocard_heading', 'dft_status_heading', 'dft_terms_heading', 'dft_credit_heading']) {
    assert.ok(appJs.includes(`t('${key}')`), `app.js must pass t('${key}')`);
  }
  for (const key of ['dft_welcome_explainer', 'dft_statement_explainer', 'dft_balance_explainer', 'dft_slip_explainer', 'dft_infocard_explainer', 'dft_status_explainer', 'dft_terms_explainer', 'dft_credit_explainer']) {
    assert.ok(appJs.includes(`t('${key}')`), `app.js must pass t('${key}')`);
  }
});

test('G3b: no template line still carries a hardcoded heading or explainer', () => {
  const lines = appJs.split('\n');
  const names = ['welcomePackSectionHtml', 'statementDraftSectionHtml', 'balanceReplySectionHtml', 'paymentSlipSectionHtml', 'infoCardSectionHtml', 'statusReplySectionHtml', 'termsAckSectionHtml', 'creditBalanceSectionHtml'];
  const sectionLines = lines.filter((l) => names.some((n) => l.includes(`${n} = \`<section`)));
  assert.equal(sectionLines.length, 8, `expected the eight section templates, got ${sectionLines.length}`);
  for (const heading of ['Welcome pack', 'Monthly statement', 'Balance enquiry reply', 'Payment history mini-slip', 'Package and service info card', 'Open fault and request status reply', 'Service terms acknowledgement', 'Customer credit balance']) {
    assert.ok(!sectionLines.some((l) => l.includes(`<h4>${heading}</h4>`)), `no template still hardcodes <h4>${heading}</h4>`);
  }
  for (const start of ['Send this once at activation', 'One clear page each month', 'When the customer asks "mera balance kitna hai?"', 'When the customer asks "maine kab kab pay kiya?"', 'When the customer asks "mera package kya hai,', 'When the customer chases an open fault', 'Which terms version this customer agreed to', 'Overpayments stay as this customer']) {
    assert.ok(!sectionLines.some((l) => l.includes(start)), `no template still hardcodes the explainer starting ${start}`);
  }
});

test('G3c: the six send ternaries and the six send handlers are keyed', () => {
  for (const key of ['dft_do_not_message', 'dft_no_whatsapp_number']) {
    assert.ok(appJs.includes(`t('${key}')`), `app.js must pass t('${key}')`);
  }
  for (const key of ['dft_welcome_send', 'dft_welcome_resend', 'dft_statement_send', 'dft_statement_resend', 'dft_balance_send', 'dft_balance_resend', 'dft_slip_send', 'dft_slip_resend', 'dft_infocard_send', 'dft_infocard_resend', 'dft_status_send', 'dft_status_resend']) {
    assert.ok(appJs.includes(`t('${key}')`), `app.js must pass t('${key}')`);
  }
  const noNumberSites = (appJs.match(/textContent = 'No WhatsApp number'/g) || []).length;
  assert.ok(noNumberSites >= 1, 'the out-of-scope features keep their own literal (untouched)');
  const ternaries = appJs.split('\n').filter((l) => l.includes('SendLabel = '));
  assert.equal(ternaries.length, 6, `expected the six send-label ternaries, got ${ternaries.length}`);
  for (const line of ternaries) {
    assert.ok(!line.includes("'Do not message'"), 'no ternary still hardcodes Do not message');
    assert.ok(!line.includes("'Send "), 'no ternary still hardcodes a Send label');
    assert.ok(!line.includes("'Re-send "), 'no ternary still hardcodes a Re-send label');
  }
});

test('G3d: every builder call in the eight sections passes its labels object', () => {
  for (const call of ['welcomePackHtml(welcomePack, { draftText: welcomePackDraft.text, sends: welcomePackSends, labels: welcomePackLabels }', 'statementDraftHtml(statementDraftCurrent.statement, { draftText: statementDraftCurrent.draft.text, sends: statementDraftSendsForMonth(statementDraftMonth), labels: statementDraftLabels }', 'balanceReplyHtml(balanceReplyCurrent, { draftText: balanceReplyCurrent.text, sends: balanceReplySends(), labels: balanceReplyLabels }', 'paymentSlipHtml(paymentSlipCurrent, { draftText: paymentSlipCurrent.text, sends: paymentSlipSends(), labels: paymentSlipLabels }', 'infoCardHtml(infoCardCurrent, { draftText: infoCardCurrent.text, sends: infoCardSends(), labels: infoCardLabels }', 'statusReplyHtml(statusReplyCurrent, { draftText: statusReplyCurrent.text, sends: statusReplySends(), labels: statusReplyLabels }', 'termsAckStatusHtml(termsAckStatus, termsAckLabels)', 'creditSummaryText(creditBalanceForCustomer(loadCreditEntries(), loadCreditApplications(), customer.id), creditBalanceLabels)']) {
    assert.ok(appJs.includes(call), `app.js must call ${call.slice(0, 40)}… with labels`);
  }
});

// ================= G4 — welcome-pack =================

test('G4a: welcome-pack summary and sent lines are byte-identical in EN by default', () => {
  assert.equal(welcomePackSummaryText(pack), 'Welcome pack ready for Ahmed — 20 Mbps, PKR 3,000.');
  assert.equal(welcomePackSummaryText(packIncomplete), 'Welcome pack incomplete — missing: package, monthly-amount, due-date.');
  assert.equal(welcomePackSummaryText(null), 'Welcome pack unavailable.');
  assert.equal(welcomePackSentText([]), 'Welcome pack not sent yet — send it once at activation.');
  assert.equal(welcomePackSentText(sends1), 'Welcome pack sent on 4 Nov 2026.');
  assert.equal(welcomePackSentText(sends2), 'Welcome pack sent on 4 Nov 2026 and 1 more time — re-send anytime from here.');
  assert.equal(welcomePackSentText(sends3), 'Welcome pack sent on 4 Nov 2026 and 2 more times — re-send anytime from here.');
});

test('G4b: welcome-pack Html fields are byte-identical in EN by default', () => {
  const html = welcomePackHtml(pack, { draftText: 'hi', sends: [] });
  for (const field of ['Package: 20 Mbps', 'Monthly amount: PKR 3,000', 'Due: 5 Nov 2026', 'Payment methods: Cash', 'Support: 0300-1234567']) {
    assert.ok(html.includes(field), `Html must carry ${field}`);
  }
  const incomplete = welcomePackHtml(packIncomplete, { draftText: '', sends: [] });
  assert.ok(incomplete.includes('Missing on the profile: package, monthly-amount, due-date — set it on the profile before sending, so the customer never receives a guessed figure.'));
  assert.equal(welcomePackHtml(null), '<p class="empty-state">Welcome pack unavailable.</p>');
  const dueDay = buildWelcomePack({ customerId: 'c1', customerName: 'Ahmed', package: '20 Mbps', monthlyAmount: 3000, dueDay: 5, paymentMethods: [] });
  assert.ok(welcomePackHtml(dueDay, { draftText: '', sends: [] }).includes('5th of every month'));
});

test('G4c: welcome-pack renders in Urdu through labels', () => {
  assert.equal(welcomePackSummaryText(pack, urLabels.welcome), 'ویلکم پیک تیار ہے Ahmed کے لیے — 20 Mbps، PKR 3,000۔');
  assert.equal(welcomePackSentText([], urLabels.welcome), 'ویلکم پیک ابھی نہیں بھیجا گیا — ایکٹیویشن پر ایک بار بھیجیں۔');
  const html = welcomePackHtml(pack, { draftText: '', sends: [], labels: urLabels.welcome });
  assert.ok(html.includes('پیکج: 20 Mbps'), 'UR Html must carry the package label');
  assert.ok(html.includes('ماہانہ رقم: PKR 3,000'), 'UR Html must carry the amount label');
  assert.ok(!html.includes('Package:'), 'UR Html must not carry the English label');
  const dueDay = buildWelcomePack({ customerId: 'c1', customerName: 'Ahmed', package: '20 Mbps', monthlyAmount: 3000, dueDay: 5, paymentMethods: [] });
  assert.ok(welcomePackHtml(dueDay, { draftText: '', sends: [], labels: urLabels.welcome }).includes('ہر ماہ کی 5th تاریخ'));
});

// ================= G5 — statement-draft =================

test('G5a: statement-draft summary and sent lines are byte-identical in EN by default', () => {
  assert.equal(statementDraftSummaryText(null), 'Monthly statement unavailable.');
  assert.equal(statementDraftSummaryText(statement), 'Monthly statement for Ahmed — Nov 2026: opening PKR 0, charges PKR 3,000, payments PKR 1,000, closing PKR 2,000.');
  assert.equal(statementSentText([]), 'Monthly statement not sent yet — send it once for this month.');
  assert.equal(statementSentText(sends1), 'Monthly statement sent on 4 Nov 2026.');
  assert.equal(statementSentText(sends2), 'Monthly statement sent on 4 Nov 2026 and 1 more time — re-send anytime from here.');
});

test('G5b: statement-draft Html fields are byte-identical in EN by default', () => {
  const html = statementDraftHtml(statement, { draftText: '', sends: [] });
  for (const field of ['Month: Nov 2026', 'Opening balance: PKR 0', "This month's charges: PKR 3,000", 'Payments received: PKR 1,000 (1 payment)', 'Closing balance: PKR 2,000']) {
    assert.ok(html.includes(field), `Html must carry ${field}`);
  }
  assert.ok(statementDraftHtml(statementNoBill, { draftText: '', sends: [] }).includes('No bill was raised for this month.'));
  const voided = statementDraftHtml(statementVoided, { draftText: '', sends: [] });
  assert.ok(voided.includes('Voided payments this month (not counted): 1'));
  assert.equal(statementDraftHtml(null), '<p class="empty-state">Monthly statement unavailable.</p>');
});

test('G5c: statement-draft renders in Urdu through labels', () => {
  assert.ok(statementDraftSummaryText(statement, urLabels.statement).includes('Ahmed کی ماہانہ اسٹیٹمنٹ — Nov 2026:'));
  const html = statementDraftHtml(statement, { draftText: '', sends: [], labels: urLabels.statement });
  assert.ok(html.includes('مہینہ: Nov 2026'), 'UR Html must carry the month label');
  assert.ok(html.includes('ابتدائی بقایا: PKR 0'), 'UR Html must carry the opening label');
  assert.ok(!html.includes('Opening balance:'), 'UR Html must not carry the English label');
});

// ================= G6 — balance-reply =================

test('G6a: balance-reply summary covers every branch byte-identically in EN by default', () => {
  assert.equal(balanceReplySummaryText(null), 'Balance reply unavailable — the outstanding figure is missing or unusable.');
  assert.equal(balanceReplySummaryText(replyNone), 'No amount due.');
  assert.equal(balanceReplySummaryText(reply), 'Current balance Rs. 1000.');
  assert.equal(balanceReplySummaryText(replyDisputed), 'Undisputed balance Rs. 500 (disputed Rs. 500 not included).');
  const zeroDisputed = buildBalanceReply({ customerId: 'c1', outstanding: 500, openDisputes: [{ disputedAmount: 500 }] });
  assert.equal(balanceReplySummaryText(zeroDisputed), 'No undisputed amount due (disputed Rs. 500 not included).');
  assert.equal(balanceReplySentText([]), 'Balance reply not sent yet.');
  assert.equal(balanceReplySentText(sends1), 'Balance reply sent on 2026-11-04.');
  assert.equal(balanceReplySentText(sends2), 'Balance reply sent on 2026-11-04 and 1 more time — re-send anytime from here.');
});

test('G6b: balance-reply Html fields are byte-identical in EN by default', () => {
  const html = balanceReplyHtml(reply, { draftText: '', sends: [] });
  for (const field of ['Customer: Ahmed', 'Current balance: Rs. 1000', 'Due date: 2026-11-05', 'Last payment: Rs. 500 on 2026-11-01']) {
    assert.ok(html.includes(field), `Html must carry ${field}`);
  }
  const none = balanceReplyHtml(replyNone, { draftText: '', sends: [] });
  assert.ok(none.includes('Balance: no amount due'));
  assert.ok(none.includes('Due date: not recorded'));
  assert.ok(none.includes('Last payment: none recorded'));
  assert.ok(balanceReplyHtml(replyDisputed, { draftText: '', sends: [] }).includes('Dispute entries with no usable amount: 1 (not counted)'));
  assert.equal(balanceReplyHtml(null), '<p class="empty-state">Balance reply unavailable — the outstanding figure is missing or unusable.</p>');
});

test('G6c: balance-reply renders in Urdu through labels', () => {
  assert.equal(balanceReplySummaryText(reply, urLabels.balance), 'موجودہ بیلنس Rs. 1000۔');
  const html = balanceReplyHtml(reply, { draftText: '', sends: [], labels: urLabels.balance });
  assert.ok(html.includes('گاہک: Ahmed'), 'UR Html must carry the customer label');
  assert.ok(html.includes('موجودہ بیلنس: Rs. 1000'), 'UR Html must carry the balance label');
  assert.ok(html.includes('آخری ادائیگی: Rs. 500، 2026-11-01 کو'), 'UR Html must carry the last-payment line');
  assert.ok(!html.includes('Current balance:'), 'UR Html must not carry the English label');
});

// ================= G7 — payment-slip =================

test('G7a: payment-slip summary and sent lines are byte-identical in EN by default', () => {
  assert.equal(paymentSlipSummaryText(null), 'Payment slip unavailable.');
  assert.equal(paymentSlipSummaryText(slip), 'Payment history: 1 live payment(s), 1 voided, subtotal Rs. 1000, current balance Rs. 500.');
  assert.equal(paymentSlipSentText([]), 'Not sent yet.');
  assert.equal(paymentSlipSentText(sends2), 'Sent 2 time(s), last 2026-11-05T10:00:00.000Z.');
});

test('G7b: payment-slip Html fields are byte-identical in EN by default', () => {
  const html = paymentSlipHtml(slip, { draftText: '', sends: [] });
  for (const field of ['Subtotal (live payments): Rs. 1000', 'Current balance: Rs. 500', '1 voided payment(s) excluded from the subtotal — not successful payments.', '1 payment row(s) could not be listed (no usable date or amount).', '<strong>VOID</strong>']) {
    assert.ok(html.includes(field), `Html must carry ${field}`);
  }
  assert.ok(paymentSlipHtml(slipEmpty, { draftText: '', sends: [] }).includes('No payments listed.'));
  assert.equal(paymentSlipHtml(null), '<p class="empty-state">Payment slip unavailable — the balance figure is missing or unusable.</p>');
});

test('G7c: payment-slip renders in Urdu through labels, VOID stamp unchanged', () => {
  assert.ok(paymentSlipSummaryText(slip, urLabels.slip).includes('ادائیگی کی تاریخ: 1 زندہ ادائیگیاں، 1 منسوخ، ذیلی مجموعہ Rs. 1000، موجودہ بیلنس Rs. 500۔'));
  const html = paymentSlipHtml(slip, { draftText: '', sends: [], labels: urLabels.slip });
  assert.ok(html.includes('ذیلی مجموعہ (زندہ ادائیگیاں): Rs. 1000'), 'UR Html must carry the subtotal label');
  assert.ok(html.includes('<strong>VOID</strong>'), 'the VOID stamp stays VOID');
  assert.ok(!html.includes('Subtotal (live payments):'), 'UR Html must not carry the English label');
});

// ================= G8 — info-card =================

test('G8a: info-card summary and sent lines are byte-identical in EN by default', () => {
  assert.equal(infoCardSummaryText(null), 'Info card unavailable — the package or monthly price is missing or unusable.');
  assert.equal(infoCardSummaryText(card), '20 Mbps — Rs. 3000 / month. Next due date 2026-12-05.');
  assert.ok(infoCardSummaryText(cardPending).includes('Package change noted: 50 Mbps (current package stays in force until applied).'));
  assert.equal(infoCardSentText([]), 'Info card not sent yet.');
  assert.equal(infoCardSentText(sends1), 'Info card sent on 2026-11-04.');
  assert.equal(infoCardSentText(sends2), 'Info card sent on 2026-11-04 and 1 more time — re-send anytime from here.');
});

test('G8b: info-card Html fields are byte-identical in EN by default', () => {
  const html = infoCardHtml(card, { draftText: '', sends: [] });
  for (const field of ['Customer: Ahmed', 'Package: 20 Mbps', 'Monthly price: Rs. 3000', 'Billing cycle: due on day 5 (default)', 'Next due date: 2026-12-05', 'Connection status: Active', 'Package expiry: 2026-12-31', 'Support contact: 0300-1234567']) {
    assert.ok(html.includes(field), `Html must carry ${field}`);
  }
  const pending = infoCardHtml(cardPending, { draftText: '', sends: [] });
  assert.ok(pending.includes('Billing cycle: due on day 5'));
  assert.ok(!pending.includes('(default)'), 'a non-default cycle carries no default marker');
  assert.ok(pending.includes('Package change noted: 50 Mbps — current package stays in force until applied'));
  const bare = buildInfoCard({ customerId: 'c1', package: '20 Mbps', monthlyPrice: 3000, cycleDueDay: null, nextDueDate: null, connectionStatus: '', expiryDate: null, supportContact: '' });
  const bareHtml = infoCardHtml(bare, { draftText: '', sends: [] });
  for (const field of ['Billing cycle: not recorded', 'Next due date: not recorded', 'Connection status: not recorded', 'Package expiry: not recorded', 'Support contact: not recorded']) {
    assert.ok(bareHtml.includes(field), `Html must carry ${field}`);
  }
  assert.ok(infoCardHtml(null).includes('Info card unavailable'));
});

test('G8c: info-card renders in Urdu through labels', () => {
  assert.equal(infoCardSummaryText(card, urLabels.info), '20 Mbps — Rs. 3000 / ماہ۔ اگلی مقررہ تاریخ 2026-12-05۔');
  const html = infoCardHtml(card, { draftText: '', sends: [], labels: urLabels.info });
  assert.ok(html.includes('گاہک: Ahmed'), 'UR Html must carry the customer label');
  assert.ok(html.includes('ماہانہ قیمت: Rs. 3000'), 'UR Html must carry the price label');
  assert.ok(html.includes('بلنگ سائیکل: ہر ماہ 5 تاریخ کو مقرر (طے شدہ)'), 'UR Html must carry the cycle line');
  assert.ok(!html.includes('Monthly price:'), 'UR Html must not carry the English label');
});

// ================= G9 — status-reply =================

test('G9a: status-reply summary and sent lines are byte-identical in EN by default', () => {
  assert.equal(statusReplyHtml(null), '<p class="empty-state">Status reply unavailable.</p>');
  assert.ok(statusReplyHtml(statusNone, { draftText: '', sends: [] }).includes('No open ticket or request for this customer.'));
  assert.ok(statusReplyHtml(statusOne, { draftText: '', sends: [] }).includes('1 open case: No connection.'));
  assert.ok(statusReplyHtml(statusTwo, { draftText: '', sends: [] }).includes('2 open cases: No connection, Relocation.'));
  assert.equal(statusReplySentText([]), 'Not sent yet.');
  assert.equal(statusReplySentText(sends1), 'Sent 1 time, last on 2026-11-04.');
  assert.equal(statusReplySentText(sends2), 'Sent 2 times, last on 2026-11-05.');
  assert.equal(statusReplySentText([{ customerId: 'c1', sentAt: '' }]), 'Sent 1 time.');
});

test('G9b: status-reply renders in Urdu through labels', () => {
  assert.ok(statusReplyHtml(statusNone, { draftText: '', sends: [], labels: urLabels.status }).includes('اس گاہک کا کوئی کھلا ٹکٹ یا درخواست نہیں۔'));
  assert.ok(statusReplyHtml(statusOne, { draftText: '', sends: [], labels: urLabels.status }).includes('1 کھلا کیس: No connection۔'));
  assert.equal(statusReplySentText(sends1, urLabels.status), '1 بار بھیجا گیا، آخری 2026-11-04 کو۔');
  assert.equal(statusReplySentText([{ customerId: 'c1', sentAt: '' }], urLabels.status), '1 بار بھیجا گیا۔');
});

// ================= G10 — terms-ack =================

test('G10a: terms-ack status line is byte-identical in EN by default', () => {
  assert.equal(termsAckStatusHtml(null), '<p class="chart-caption">Terms acknowledgement unavailable.</p>');
  assert.equal(termsAckStatusHtml(customerTermsStatus([], 'C-1', '')), '<p class="chart-caption">No current terms version set yet — set one in the Analytics terms panel first.</p>');
  assert.equal(termsAckStatusHtml(customerTermsStatus(ackList, 'C-1', 'v2')), '<p><strong>Current terms version v2:</strong> acknowledged on 2026-11-01 (In person), recorded by Saad</p>');
  const notYet = termsAckStatusHtml(customerTermsStatus(ackList, 'C-1', 'v9'));
  assert.ok(notYet.includes('Current terms version v9:'));
  assert.ok(notYet.includes('not yet acknowledged'));
  assert.ok(notYet.includes(' — never assumed.'));
  assert.equal(termsAckMethodLabel('in-person'), 'In person');
  assert.equal(termsAckMethodLabel('message'), 'By message');
  assert.equal(termsAckMethodLabel('paper'), 'On paper kept at the shop');
  assert.equal(termsAckMethodLabel('bogus'), 'Not recorded');
});

test('G10b: terms-ack status line renders in Urdu through labels', () => {
  const html = termsAckStatusHtml(customerTermsStatus(ackList, 'C-1', 'v2'), urLabels.terms);
  assert.ok(html.includes('شرائط کا موجودہ نسخہ v2:'), 'UR status must carry the version line');
  assert.ok(html.includes('تصدیق شدہ'), 'UR status must carry the acknowledged word');
  assert.ok(html.includes(' 2026-11-01 کو (ذاتی طور پر)'), 'UR status must carry the detail');
  assert.ok(html.includes('، درج کیا Saad نے'), 'UR status must carry the recorder');
  assert.ok(!html.includes('acknowledged'), 'UR status must not carry the English word');
  assert.equal(termsAckMethodLabel('message', urLabels.terms), 'پیغام سے');
});

test('G10c: the Analytics panel surfaces stay on the EN defaults (out of scope)', () => {
  assert.ok(termsAckHtml(ackList).includes('<th>Customer</th>'));
  assert.ok(termsAckHtml(ackList).includes('<th>How acknowledged</th>'));
  assert.ok(termsAckHtml(ackList).includes('In person'));
  assert.equal(termsAckSummaryText(ackList, 'v2'), '1 acknowledgement for 1 customer · current terms version v2');
  assert.ok(termsAckCsv(ackList).includes('In person'));
});

// ================= G11 — credit-balance =================

test('G11a: credit summary is byte-identical in EN by default (emitter unchanged)', () => {
  assert.equal(creditSummaryText(null), 'No credit record.');
  assert.equal(creditSummaryText(credit), 'Credit in Rs. 500.00 · applied Rs. 0.00 · remaining Rs. 500.00.');
});

test('G11b: credit summary renders in Urdu through labels', () => {
  assert.equal(creditSummaryText(credit, urLabels.credit), 'آیا ہوا کریڈٹ Rs. 500.00 · لگایا گیا Rs. 0.00 · باقی Rs. 500.00۔');
  assert.equal(creditSummaryText(null, urLabels.credit), 'کوئی کریڈٹ ریکارڈ نہیں۔');
});

test('G11c: the credit ledger table stays on the EN defaults (D5, out of scope)', () => {
  const html = creditHtml(credit);
  assert.ok(html.includes('<th>Credit in</th>'));
  assert.ok(html.includes('Credit in Rs. 500.00'));
  assert.ok(html.includes('Credit is applied only by a recorded application naming the bill; it is never converted to cash here.'));
});

// ================= G12 — draft TEXT builders untouched =================

test('G12: the draft texts still return the same Roman and Urdu variants', () => {
  assert.ok(buildWelcomePackDraft(pack).text.includes('Aap ka bill 5 Nov 2026 tak ada karna hai.'));
  assert.ok(buildWelcomePackDraft(pack, 'urdu').text.includes('آپ کا بل 5 Nov 2026 تک ادا کرنا ہے۔'));
  assert.ok(buildStatementDraftText(statement).text.includes('Opening balance: PKR 0.'));
  assert.ok(buildStatementDraftText(statement, 'urdu').text.includes('ابتدائی بقایا: PKR 0۔'));
  assert.ok(reply.text.includes('Your current balance is Rs. 1000.'));
  assert.ok(buildBalanceReply({ customerId: 'c1', outstanding: 1000, variant: 'urdu' }).text.includes('آپ کا موجودہ بقایا: Rs. 1000۔'));
  assert.ok(buildPaymentSlipText(slip).includes('Subtotal (live payments): Rs. 1000'));
  assert.ok(buildPaymentSlipText(slip).includes('No payments listed.') === false);
  assert.ok(card.text.includes('Aap ka current package: 20 Mbps'));
  assert.ok(buildInfoCard({ customerId: 'c1', package: '20 Mbps', monthlyPrice: 3000, cycleDueDay: 5, variant: 'urdu' }).text.includes('آپ کا موجودہ پیکج: 20 Mbps'));
  assert.ok(statusOne.text.includes('Ticket: No connection — Status: Open'));
  assert.ok(buildStatusReply({ customerId: 'c1', variant: 'urdu' }).text.includes('آپ کا کوئی کھلا کیس نہیں ہے'));
});
