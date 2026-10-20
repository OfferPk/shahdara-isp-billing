import test from 'node:test';
import assert from 'node:assert/strict';
import { addPayment, createInitialState, saveBillMonth } from '../core.js';
import { addExpense } from '../phase3.js';
import { answerOwnerCommand } from '../owner-insights.js';

// Fixed fixture, reference Wednesday 7 Oct 2026 (PKT). Every figure asserted
// below is computed by hand from these rows:
//   Ali         10 Mbps · Mohalla A · active  · added 2026-10-07
//               Sep bill 1500 paid 1500 Cash 2026-09-05; Oct bill 1500, paid 1000 Easypaisa 2026-10-06 (500 left)
//   Ali Raza    10 Mbps · Mohalla A · active  · added 2026-10-01, connected 2026-10-02
//               Oct bill 1500 paid 1500 JazzCash 2026-10-07
//   Raja Ali    20 Mbps · Mohalla B · active  · added 2026-09-15
//               Sep bill 2000 unpaid; Oct bill 2000 unpaid (4000 outstanding)
//   Usman Tariq  5 Mbps · Mohalla B · offline · added 2026-10-07, connected 2026-09-20 · no bills
//   Hassan Raza 20 Mbps · Mohalla A · active  · added 2025-01-10
//               Aug bill 1200 unpaid (due 2026-08-05); Sep bill 1200 paid 1200 Cash 2026-09-10;
//               Oct bill 1200, paid 600 Cash 2026-10-01 (600 left)
//   Expenses: 2026-10-07 Cable 500 · 2026-10-03 Electricity 2000 · 2026-10-05 Cable 300 · 2026-09-10 Cable 900
const today = new Date('2026-10-07T12:00:00+05:00');

function fixtureState() {
  let state = createInitialState(['Ali', 'Ali Raza', 'Raja Ali', 'Usman Tariq', 'Hassan Raza']);
  const profile = {
    'seed-001': { packageSpeed:'10 Mbps', mohalla:'Mohalla A', serviceStatus:'active', addedOn:'2026-10-07', connectionDate:null },
    'seed-002': { packageSpeed:'10 Mbps', mohalla:'Mohalla A', serviceStatus:'active', addedOn:'2026-10-01', connectionDate:'2026-10-02' },
    'seed-003': { packageSpeed:'20 Mbps', mohalla:'Mohalla B', serviceStatus:'active', addedOn:'2026-09-15', connectionDate:null },
    'seed-004': { packageSpeed:'5 Mbps', mohalla:'Mohalla B', serviceStatus:'offline', addedOn:'2026-10-07', connectionDate:'2026-09-20' },
    'seed-005': { packageSpeed:'20 Mbps', mohalla:'Mohalla A', serviceStatus:'active', addedOn:'2025-01-10', connectionDate:null }
  };
  state = { ...state, customers: state.customers.map(customer => ({ ...customer, ...profile[customer.id] })) };
  const bill = (id, month, amount) => { state = saveBillMonth(state, id, { month, dueAmount:String(amount), status:'pending' }, today); };
  const pay = (id, month, date, amount, method) => { state = addPayment(state, id, month, { date, amount:String(amount), method }, today); };
  bill('seed-001', '2026-09', 1500); pay('seed-001', '2026-09', '2026-09-05', 1500, 'Cash');
  bill('seed-001', '2026-10', 1500); pay('seed-001', '2026-10', '2026-10-06', 1000, 'Easypaisa');
  bill('seed-002', '2026-10', 1500); pay('seed-002', '2026-10', '2026-10-07', 1500, 'JazzCash');
  bill('seed-003', '2026-09', 2000);
  bill('seed-003', '2026-10', 2000);
  bill('seed-005', '2026-08', 1200);
  bill('seed-005', '2026-09', 1200); pay('seed-005', '2026-09', '2026-09-10', 1200, 'Cash');
  bill('seed-005', '2026-10', 1200); pay('seed-005', '2026-10', '2026-10-01', 600, 'Cash');
  state = addExpense(state, { date:'2026-10-07', amount:'500', category:'Cable', notes:'' }, today);
  state = addExpense(state, { date:'2026-10-03', amount:'2000', category:'Electricity', notes:'' }, today);
  state = addExpense(state, { date:'2026-10-05', amount:'300', category:'Cable', notes:'' }, today);
  state = addExpense(state, { date:'2026-09-10', amount:'900', category:'Cable', notes:'' }, today);
  return state;
}
const state = fixtureState();
const ask = question => answerOwnerCommand(state, question, today);
const names = rows => rows.map(row => row.name);

const BANK = [
  // --- new customers (the screenshot question first, verbatim) ---
  ['Ajj kon sy new customers add hovy?', 'new-customers', a => { assert.equal(a.count, 1); assert.deepEqual(names(a.rows), ['Ali']); assert.equal(a.rows[0].date, '2026-10-07'); }],
  ['Which new customers were added today?', 'new-customers', a => { assert.equal(a.count, 1); assert.deepEqual(names(a.rows), ['Ali']); }],
  ['aaj naye customer kitne aye?', 'new-customers', a => { assert.equal(a.count, 1); }],
  ['How many new customers this month?', 'new-customers', a => { assert.equal(a.count, 2); assert.deepEqual(names(a.rows), ['Ali', 'Ali Raza']); }],
  ['new customers in September', 'new-customers', a => { assert.equal(a.count, 2); assert.deepEqual(names(a.rows), ['Usman Tariq', 'Raja Ali']); }],
  ['new customers in last 7 days', 'new-customers', a => { assert.equal(a.count, 2); }],
  // --- who paid / who did not ---
  ['aaj kis kis ne payment di?', 'paid-list', a => { assert.equal(a.total, 1500); assert.equal(a.count, 1); assert.equal(a.rows[0].name, 'Ali Raza'); assert.equal(a.rows[0].method, 'JazzCash'); assert.equal(a.rows[0].date, '2026-10-07'); }],
  ['Who paid today?', 'paid-list', a => { assert.equal(a.total, 1500); assert.equal(a.count, 1); }],
  ['Who paid yesterday?', 'paid-list', a => { assert.equal(a.total, 1000); assert.equal(a.rows[0].name, 'Ali'); assert.equal(a.rows[0].method, 'Easypaisa'); }],
  ['kal kis ne payment di?', 'paid-list', a => { assert.equal(a.total, 1000); assert.equal(a.rows[0].date, '2026-10-06'); }],
  ['آج کس نے ادائیگی کی؟', 'paid-list', a => { assert.equal(a.count, 1); assert.equal(a.rows[0].name, 'Ali Raza'); }],
  ['aaj kis kis ne payment nahi di?', 'pending-list', a => { assert.equal(a.rows.length, 3); assert.equal(a.pendingTotal, 3100); }],
  ['Who has not paid this month?', 'pending-list', a => { assert.equal(a.rows.length, 3); assert.deepEqual(names(a.rows).sort(), ['Ali', 'Hassan Raza', 'Raja Ali']); }],
  ['آج کس کس نے ادائیگی نہیں کی؟', 'pending-list', a => { assert.equal(a.rows.length, 3); }],
  // --- periods: day / week / ranges / months ---
  ['aj collection kitni hui?', 'daily-collection', a => { assert.equal(a.collection, 1500); assert.equal(a.receiptCount, 1); }],
  ['Collection in the last 7 days', 'period-collection', a => { assert.equal(a.collection, 3100); assert.equal(a.receiptCount, 3); }],
  ['is hafte ki collection', 'period-collection', a => { assert.equal(a.collection, 2500); assert.equal(a.from, '2026-10-05'); assert.equal(a.to, '2026-10-07'); }],
  ['Collection in the last 30 days', 'period-collection', a => { assert.equal(a.collection, 4300); assert.equal(a.receiptCount, 4); }],
  ['pichle 7 din ki collection', 'period-collection', a => { assert.equal(a.collection, 3100); }],
  ['October collection', 'monthly-collection', a => { assert.equal(a.collection, 3100); assert.equal(a.receiptCount, 3); assert.equal(a.month, '2026-10'); }],
  ['September collection', 'monthly-collection', a => { assert.equal(a.collection, 2700); assert.equal(a.receiptCount, 2); }],
  ['October mein kitna paisa aya?', 'monthly-collection', a => { assert.equal(a.collection, 3100); }],
  ['pichhle maheene collection kitni thi?', 'monthly-collection', a => { assert.equal(a.collection, 2700); assert.equal(a.month, '2026-09'); }],
  ['Today collection and expense', 'daily-summary', a => { assert.equal(a.collection, 1500); assert.equal(a.expenses, 500); }],
  ['aaj ka kharcha', 'daily-expenses', a => { assert.equal(a.expenses, 500); assert.equal(a.expenseCount, 1); }],
  ['is maheene ka kharcha kitna hai?', 'monthly-expenses', a => { assert.equal(a.expenses, 2800); assert.equal(a.expenseCount, 3); }],
  ['This month profit', 'monthly-profit', a => { assert.equal(a.profit, 300); assert.equal(a.collection, 3100); assert.equal(a.expenses, 2800); }],
  ['September profit', 'monthly-profit', a => { assert.equal(a.profit, 1800); assert.equal(a.month, '2026-09'); }],
  ['اس مہینے منافع کتنا ہے؟', 'monthly-profit', a => { assert.equal(a.profit, 300); }],
  // --- payment methods ---
  ['is maheene cash kitna aya aur easypaisa kitna?', 'method-collection', a => {
    assert.equal(a.total, 3100); assert.equal(a.focusMethod, 'Cash'); assert.equal(a.focusAmount, 600);
    const byMethod = Object.fromEntries(a.rows.map(row => [row.method, row.amount]));
    assert.equal(byMethod.Cash, 600); assert.equal(byMethod.Easypaisa, 1000); assert.equal(byMethod.JazzCash, 1500);
  }],
  ['Easypaisa collection this month', 'method-collection', a => { assert.equal(a.focusMethod, 'Easypaisa'); assert.equal(a.focusAmount, 1000); }],
  ['Cash collection today', 'method-collection', a => { assert.equal(a.focusMethod, 'Cash'); assert.equal(a.focusAmount, 0); assert.equal(a.rows.find(row => row.method === 'JazzCash').amount, 1500); }],
  // --- comparisons ---
  ['pichle maheene se collection zyada hai ya kam?', 'month-comparison', a => { assert.equal(a.focus, 'collection'); assert.equal(a.direction, 'up'); assert.equal(a.focusChange, 400); assert.equal(a.focusPercentChange, 14.8); assert.equal(a.monthA, '2026-09'); assert.equal(a.monthB, '2026-10'); }],
  ['Is collection higher than last month?', 'month-comparison', a => { assert.equal(a.direction, 'up'); assert.equal(a.focusChange, 400); }],
  ['October vs September expenses', 'month-comparison', a => { assert.equal(a.focus, 'expenses'); assert.equal(a.focusChange, 1900); const row = a.rows.find(item => item.key === 'expenses'); assert.equal(row.from, 900); assert.equal(row.to, 2800); }],
  // --- expenses breakdown ---
  ['Expense breakdown this month', 'expense-breakdown', a => { assert.equal(a.total, 2800); assert.equal(a.rows[0].category, 'Electricity'); assert.equal(a.rows[0].amount, 2000); assert.equal(a.rows[1].category, 'Cable'); assert.equal(a.rows[1].amount, 800); assert.equal(a.rows[1].count, 2); }],
  ['اس مہینے خرچہ کس چیز پر سب سے زیادہ ہوا؟', 'expense-breakdown', a => { assert.equal(a.rows[0].category, 'Electricity'); assert.equal(a.rows[0].amount, 2000); assert.equal(a.total, 2800); }],
  // --- areas ---
  ['Area wise collection this month', 'area-collection', a => { assert.equal(a.total, 3100); assert.equal(a.rows.length, 1); assert.equal(a.rows[0].area, 'Mohalla A'); assert.equal(a.rows[0].customers, 3); }],
  ['Mohalla B collection this month', 'area-collection', a => { assert.equal(a.areaFilter, 'Mohalla B'); assert.equal(a.rows.length, 0); assert.equal(a.total, 0); }],
  ['Area-wise pending', 'area-pending', a => { assert.equal(a.rows[0].area, 'Mohalla B'); assert.equal(a.rows[0].outstanding, 2000); assert.equal(a.rows[1].area, 'Mohalla A'); assert.equal(a.rows[1].outstanding, 1100); assert.equal(a.rows[1].customers, 2); }],
  // --- outstanding: defaulters, thresholds, totals, aging ---
  ['sab se zyada baqaya kis ka hai?', 'top-defaulters', a => { assert.equal(a.rows[0].name, 'Raja Ali'); assert.equal(a.rows[0].outstanding, 4000); assert.equal(a.rows.length, 3); }],
  ['Who has the highest outstanding?', 'top-defaulters', a => { assert.equal(a.rows[0].name, 'Raja Ali'); assert.equal(a.rows[0].outstanding, 4000); }],
  ['Top 2 defaulters', 'top-defaulters', a => { assert.equal(a.rows.length, 2); assert.deepEqual(a.rows.map(row => row.outstanding), [4000, 1800]); }],
  ['Customers above 1000 outstanding', 'threshold-outstanding', a => { assert.equal(a.threshold, 1000); assert.equal(a.rows.length, 2); }],
  ['customers above 2k outstanding', 'threshold-outstanding', a => { assert.equal(a.threshold, 2000); assert.equal(a.rows.length, 1); assert.equal(a.rows[0].name, 'Raja Ali'); }],
  ['2 hazar se zyada baqaya', 'threshold-outstanding', a => { assert.equal(a.threshold, 2000); assert.equal(a.rows.length, 1); }],
  ['5 hazar se zyada baqaya kis ka hai?', 'threshold-outstanding', a => { assert.equal(a.threshold, 5000); assert.equal(a.rows.length, 0); }],
  ['total baqaya kitna hai?', 'total-outstanding', a => { assert.equal(a.total, 6300); assert.equal(a.customers, 3); }],
  ['Dues older than 60 days', 'overdue-aging', a => { assert.equal(a.minDays, 60); assert.equal(a.rows.length, 1); assert.equal(a.rows[0].name, 'Hassan Raza'); assert.equal(a.rows[0].overdueDays, 63); assert.equal(a.rows[0].outstanding, 1800); }],
  ['Overdue dues aging', 'overdue-aging', a => { assert.equal(a.total, 6300); assert.deepEqual(a.rows.map(row => [row.label, row.amount]), [['1–30 days', 3100], ['31–60 days', 2000], ['61–90 days', 1200]]); }],
  // --- packages ---
  ['10 Mbps walay kitne customer hain?', 'package-customers', a => { assert.equal(a.package, '10 Mbps'); assert.equal(a.count, 2); assert.equal(a.duesTotal, 500); }],
  ['How many customers are on 10 Mbps?', 'package-customers', a => { assert.equal(a.count, 2); }],
  ['20 Mbps package customers', 'package-customers', a => { assert.equal(a.count, 2); assert.equal(a.duesTotal, 5800); }],
  ['Package wise customers', 'package-customers', a => { assert.equal(a.distribution, true); assert.equal(a.count, 5); assert.equal(a.rows.find(row => row.package === '5 Mbps').customers, 1); }],
  // --- counts ---
  ['Total kitne customer hain?', 'counts-overview', a => { assert.equal(a.total, 5); assert.equal(a.active, 4); assert.equal(a.offline, 1); assert.equal(a.withDues, 3); assert.equal(a.duesTotal, 6300); assert.equal(a.billedThisMonth, 4); }],
  ['How many customers have dues?', 'counts-overview', a => { assert.equal(a.withDues, 3); }],
  ['is maheene kitne bill bane?', 'counts-overview', a => { assert.equal(a.billedThisMonth, 4); }],
  // --- single customers: balance, candidates, detail ---
  ['Ali ka balance', 'customer-balance', a => { assert.equal(a.rows.length, 1); assert.equal(a.rows[0].name, 'Ali'); assert.equal(a.rows[0].bill, 1500); assert.equal(a.rows[0].paid, 1000); assert.equal(a.rows[0].remaining, 500); assert.equal(a.rows[0].totalOutstanding, 500); }],
  ['Ali Raza ka balance', 'customer-balance', a => { assert.equal(a.rows[0].remaining, 0); assert.equal(a.rows[0].totalOutstanding, 0); }],
  ['Raja Ali ka balance kitna hai?', 'customer-balance', a => { assert.equal(a.rows[0].remaining, 2000); assert.equal(a.rows[0].totalOutstanding, 4000); }],
  ['Raza ka balance', 'customer-candidates', a => { assert.equal(a.rows.length, 2); assert.deepEqual(names(a.rows).sort(), ['Ali Raza', 'Hassan Raza']); }],
  ['Hasan Raza ka balance', 'customer-balance', a => { assert.equal(a.rows[0].name, 'Hassan Raza'); assert.equal(a.rows[0].totalOutstanding, 1800); }],
  ['Usman Tariq ka balance', 'customer-balance', a => { assert.equal(a.rows[0].bill, null); assert.equal(a.rows[0].totalOutstanding, 0); }],
  ['Ali', 'customer-balance', a => { assert.equal(a.rows[0].name, 'Ali'); }],
  ['Ali ne last payment kab di thi?', 'customer-detail', a => { assert.equal(a.name, 'Ali'); assert.equal(a.lastPayment.date, '2026-10-06'); assert.equal(a.lastPayment.amount, 1000); assert.equal(a.lastPayment.method, 'Easypaisa'); assert.equal(a.totalPaid, 2500); assert.equal(a.totalPayments, 2); assert.equal(a.totalOutstanding, 500); assert.equal(a.currentBill.balanceDue, 500); assert.equal(a.since, '2026-10-07'); }],
  ['Hassan Raza ne total kitna diya hai?', 'customer-detail', a => { assert.equal(a.totalPaid, 1800); assert.equal(a.totalPayments, 2); assert.equal(a.lastPayment.date, '2026-10-01'); assert.equal(a.lastPayment.amount, 600); assert.equal(a.lastPayment.method, 'Cash'); assert.equal(a.totalOutstanding, 1800); }],
  // --- fallback behaviour ---
  ['delete Ali', 'help', a => { assert.ok(Array.isArray(a.suggestions)); assert.ok(a.suggestions.length >= 3); }],
  ['weather kaisa hai?', 'help', a => { assert.ok(a.suggestions.length >= 3); assert.ok(a.suggestions.every(item => typeof item === 'string' && item.length > 3)); }],
  ['Shahid ka balance kitna hai?', 'help', a => { assert.ok(a.suggestions.length >= 3); }]
];

test('owner assistant question bank: English, Roman Urdu and Urdu questions get correct local answers', () => {
  assert.ok(BANK.length >= 45, `question bank covers ${BANK.length} questions (at least 45 required)`);
  for (const [question, intent, check] of BANK) {
    const answer = ask(question);
    assert.equal(answer.intent, intent, `intent for "${question}" — got "${answer.intent}" (${JSON.stringify(answer).slice(0, 200)})`);
    if (check) check(answer, question);
  }
});

test('the screenshot question no longer falls back to help', () => {
  const answer = ask('Ajj kon sy new customers add hovy?');
  assert.notEqual(answer.intent, 'help');
  assert.equal(answer.intent, 'new-customers');
});

test('smart fallback suggests real supported questions and did-you-mean names', () => {
  const weather = ask('weather kaisa hai?');
  assert.equal(weather.intent, 'help');
  assert.ok(weather.suggestions.includes('Ajj kon sy new customers add hovy?') || weather.suggestions.length >= 3);
  const typo = ask('Hasan ka balance batao');
  assert.equal(typo.intent, 'customer-balance');
  assert.equal(typo.rows[0].name, 'Hassan Raza');
});

test('smart assistant answers never mutate state', () => {
  const before = JSON.stringify(state);
  for (const [question] of BANK) ask(question);
  assert.equal(JSON.stringify(state), before);
});
